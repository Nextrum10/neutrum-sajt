-- ============================================================
-- NEXTRUM — Fas 13.1: kortvägen lagas innan månadsfakturan stängs
--
-- Beslutet är att familjen betalar kort per pass och att ingen
-- månadsfaktura skickas. Innan den omställningen görs måste sex fel i
-- den redan driftsatta kortvägen bort. Tre av dem bor här.
--
--
-- 1. VI SPARADE VÅRT EGET PÅSTÅENDE OCH KALLADE DET ETT KVITTO
--
-- betalt_ore skrevs av stripe-checkout när SESSIONEN skapades, alltså
-- innan familjen betalat. Kolumnkommentaren sa det rakt ut ("fryst när
-- Checkout-sessionen skapades") men namnet sa något annat, och varje
-- läsare har läst namnet.
--
-- Skillnaden är inte teoretisk. Ändras rabatten eller längden mellan
-- att sessionen skapas och att familjen betalar, betalar de ETT belopp
-- medan vi sparat ett ANNAT. Samma siffra är dessutom taket i
-- stripe-aterbetalning, så en återbetalning hade räknats mot fel tal.
--
-- Därför delas de två: begart_ore är vad vi bad om, betalt_ore blir
-- vad Stripe faktiskt drog och skrivs bara av webhooken.
--
--
-- 2. INGEN VÄG FRÅN EN BETALNING TILL BANKRADEN
--
-- Stripe betalar ut i KLUMPAR, netto efter avgift, med fördröjning.
-- Ingen rad på bankkontot motsvarar ett enskilt pass. Det enda som
-- binder ihop dem är balanstransaktionen (txn_), och den sparade vi
-- inte. Utan den går bokföringen inte att stämma av — någonsin, inte
-- heller i efterhand, för uppgiften finns bara hos Stripe.
--
-- Kolumnerna läggs NU, innan den första riktiga betalningen, just för
-- att en betalning som redan skett inte går att komplettera.
--
--
-- 3. EN FAMILJ KUNDE AVBOKA ETT BETALT PASS OCH VI BEHÖLL PENGARNA
--
-- skydda_bokningsfalt hade `if new.status = 'cancelled' then null;` —
-- avbokning var helt oprövad. Föräldravyn skriver status='cancelled'
-- utan att titta på betalningen (nextrum-studie-vy.js:843), och
-- 'status' står i triggerns tillåt-lista. En familj kunde alltså
-- avboka ett pass de betalat, och ingenting i systemet sa till.
--
-- Med månadsfaktura var det ofarligt: det fanns ingen betalning att
-- behålla. Med kort per pass är det pengar på vårt konto som tillhör
-- någon annan.
--
-- Avbokningen NEKAS nu, i stället för att tyst utlösa en återbetalning.
-- Om pengar ska tillbaka är det ett beslut om hur mycket och varför,
-- och det beslutet hör till en människa — se DEPLOY-BETALNING.md om
-- avbokningspolicyn, som fortfarande inte är skriven.
--
-- 'aterbetald' släpps igenom: pengarna är redan tillbaka.
-- 'vantar' och 'misslyckad' släpps igenom: ingen betalning finns.
--
--
-- SPÄRREN "INGEN BETALNING, INGET PASS" LIGGER INTE HÄR
--
-- Den hör till Fas 13.2. Kravet att ett pass ska vara betalt för att
-- få bli 'completed' kan inte slås på förrän kortvägen bevisligen
-- fungerar: i dag är STRIPE_WEBHOOK_SECRET inte satt och ingen
-- betalning har någonsin gått igenom, så spärren hade låst varenda
-- studiehjälpare från att rapportera ett enda pass.
-- ============================================================

alter table public.bookings
  add column if not exists begart_ore                  bigint,
  add column if not exists stripe_balanstransaktion_id text,
  add column if not exists stripe_avgift_ore           bigint,
  add column if not exists stripe_netto_ore            bigint;

comment on column public.bookings.begart_ore is
  'Vad vi BAD Stripe om när Checkout-sessionen skapades. Vårt påstående, '
  'inte ett kvitto. Skrivs av stripe-checkout. Jämför betalt_ore: '
  'skiljer de sig betalade familjen något annat än vi räknade med.';

comment on column public.bookings.betalt_ore is
  'Vad Stripe FAKTISKT drog, läst ur checkout-sessionens amount_total. '
  'Skrivs BARA av stripe-webhook, aldrig av stripe-checkout. Fram till '
  'Fas 13.1 skrevs den vid sessionens skapande och var alltså vårt '
  'påstående — se begart_ore.';

comment on column public.bookings.stripe_balanstransaktion_id is
  'Balanstransaktionen (txn_) för betalningen. ENDA vägen från ett pass '
  'till den bankrad Stripe till slut betalar ut: utbetalningen är en '
  'klump av många balanstransaktioner, netto efter avgift. Utan den går '
  'bokföringen inte att stämma av, och uppgiften finns bara hos Stripe.';

comment on column public.bookings.stripe_avgift_ore is
  'Stripes avgift för betalningen, ur balanstransaktionens fee. En '
  'kostnad som aldrig syns i vad familjen betalade.';

comment on column public.bookings.stripe_netto_ore is
  'Vad Stripe krediterar oss, ur balanstransaktionens net. '
  'betalt_ore minus stripe_avgift_ore, men läst från Stripe i stället '
  'för uträknat, så att avrundning aldrig kan skilja dem åt.';

-- Kolumnerna står MED FLIT inte i tillåt-listan i skydda_bokningsfalt
-- nedan. Ingen inloggad session kan alltså skriva dem; bara
-- edge-funktionerna med service_role, där auth.uid() är null.

create or replace function public.skydda_bokningsfalt()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  jag   uuid := auth.uid();
  idag  date := (now() at time zone 'Europe/Stockholm')::date;
  fria  text[] := array['status', 'wanted_date', 'wanted_time', 'created_by', 'attendance'];
  flytt boolean;
begin
  if public.is_admin() or jag is null then
    return new;
  end if;

  -- ---------- ny bokning ----------
  if tg_op = 'INSERT' then
    if new.status is distinct from 'requested' then
      raise exception using errcode = '42501',
        message = 'Ett nytt pass måste börja som förfrågan.';
    end if;

    if new.attendance is not null then
      raise exception using errcode = '42501',
        message = 'Närvaro sätts när passet rapporteras, inte när det bokas.';
    end if;

    if new.fakturerbar is distinct from true or new.fakturerbar_anledning is not null then
      raise exception using errcode = '42501',
        message = 'Bara Nextrum kan undanta ett pass från fakturering.';
    end if;

    if new.wanted_date is null or new.wanted_date < idag then
      raise exception using errcode = '42501',
        message = 'Ett pass kan bara bokas idag eller framåt.';
    end if;

    -- "is null" är Fas 9.7. Utan det var villkoret falskt för ett
    -- pass utan längd, och faktureringen räknade en timme på det.
    if new.duration_min is null or new.duration_min < 60 or new.duration_min > 180 then
      raise exception using errcode = '42501',
        message = 'Ett pass är en, två eller tre timmar.';
    end if;

    if not exists (
      select 1 from public.tjanster t
      where t.kod = new.tjanst and t.aktiv and t.for_kund
    ) then
      raise exception using errcode = '42501',
        message = 'Tjänsten går inte att boka.';
    end if;

    if new.student_id is not null and not exists (
      select 1 from public.students s
      where s.id = new.student_id and s.parent_id = new.parent_id
    ) then
      raise exception using errcode = '42501',
        message = 'Barnet hör inte till familjen.';
    end if;

    if jag = new.tutor_id then
      if new.student_id is not null and not public.ar_min_elev(new.student_id) then
        raise exception using errcode = '42501',
          message = 'Du kan bara föreslå pass för dina egna elever.';
      end if;
      if new.antal_barn <> 1 then
        raise exception using errcode = '42501',
          message = 'Antalet barn väljer familjen när den bokar.';
      end if;
    end if;

    return new;
  end if;

  -- ---------- befintlig bokning ----------
  if old.status in ('completed', 'cancelled') then
    if to_jsonb(new) is distinct from to_jsonb(old) then
      raise exception using errcode = '42501',
        message = 'Ett genomfört eller avbokat pass går inte att ändra.';
    end if;
    return new;
  end if;

  if (to_jsonb(new) - fria) is distinct from (to_jsonb(old) - fria) then
    raise exception using errcode = '42501',
      message = 'På ett bokat pass kan bara status och tid ändras.';
  end if;

  flytt := new.wanted_date is distinct from old.wanted_date
        or new.wanted_time is distinct from old.wanted_time;

  if flytt then
    if new.status <> 'requested' or new.created_by is distinct from jag then
      raise exception using errcode = '42501',
        message = 'En flyttad tid måste bekräftas av motparten.';
    end if;
    if new.wanted_date is null or new.wanted_date < idag then
      raise exception using errcode = '42501',
        message = 'Ett pass kan bara flyttas till idag eller framåt.';
    end if;
  elsif new.created_by is distinct from old.created_by then
    raise exception using errcode = '42501',
      message = 'Vem som föreslog passet ändras bara när tiden flyttas.';
  end if;

  if new.attendance is distinct from old.attendance and new.status <> 'completed' then
    raise exception using errcode = '42501',
      message = 'Närvaro sätts när passet rapporteras.';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'cancelled' then
      /* FAS 13.1. Här stod tidigare bara "null" — avbokning var det
         enda statusbytet som inte prövades alls.

         Betalda pengar ligger på Nextrums konto och tillhör familjen
         tills någon bestämt något annat. Att låta avbokningen gå
         igenom hade lämnat dem där utan att någon fick veta det.

         Vi utlöser INTE en återbetalning automatiskt: hur mycket som
         ska tillbaka beror på när avbokningen sker, och den policyn
         är inte skriven än. Ett nej som säger varför är ärligare än
         en återbetalning ingen beslutat om. */
      if old.betalning_status in ('betald', 'tvist') then
        raise exception using errcode = '42501',
          message = 'Passet är betalt och går inte att avboka härifrån. Kontakta Nextrum, så tar vi hand om återbetalningen.';
      end if;

    elsif new.status = 'confirmed' then
      if old.status <> 'requested' or old.created_by is not distinct from jag then
        raise exception using errcode = '42501',
          message = 'Ett pass bekräftas av motparten, inte av den som föreslog det.';
      end if;

    elsif new.status = 'requested' then
      if not flytt then
        raise exception using errcode = '42501',
          message = 'Ett bekräftat pass blir förfrågan igen bara när tiden flyttas.';
      end if;

    elsif new.status = 'completed' then
      if jag is distinct from old.tutor_id then
        raise exception using errcode = '42501',
          message = 'Bara passets studiehjälpare kan markera det som genomfört.';
      end if;
      if flytt or old.wanted_date is null or old.wanted_date > idag then
        raise exception using errcode = '42501',
          message = 'Ett pass kan markeras som genomfört först när det har varit.';
      end if;
      if not (old.status = 'confirmed'
              or (old.status = 'requested' and old.created_by = old.parent_id)) then
        raise exception using errcode = '42501',
          message = 'Familjen har inte bekräftat passet, så det kan inte markeras som genomfört.';
      end if;
      if not exists (
        select 1 from public.lesson_reports r
        where r.booking_id = old.id
          and r.tutor_id = jag
          and (old.student_id is null or r.student_id = old.student_id)
      ) then
        raise exception using errcode = '42501',
          message = 'Passet saknar rapport och kan inte markeras som genomfört.';
      end if;
    end if;
  end if;

  return new;
end $function$;
