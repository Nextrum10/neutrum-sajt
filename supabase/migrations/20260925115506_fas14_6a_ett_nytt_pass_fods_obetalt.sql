-- ============================================================
-- NEXTRUM — Fas 14.6a: ett nytt pass föds obetalt, och varje
-- betalning syns i auditloggen
--
-- HÅLET. INSERT-grenen i skydda_bokningsfalt prövade status, närvaro,
-- fakturerbar, datum, längd, tjänst och barn, men inte en enda
-- betalningskolumn. authenticated har INSERT-rätt på alla kolumner,
-- och de två INSERT-policyerna prövar bara vem passet gäller. En
-- familj kunde alltså skapa ett pass som redan stod 'betald', med
-- betald_at och betalt_ore ifyllda, och studiehjälparen kunde göra
-- detsamma genom "föreslå tid". Ett sådant pass
--
--   · slapp spärren "ingen betalning, inget pass" när den är på,
--   · larmade aldrig som ej_betalt,
--   · fick "redan betalt" av stripe-checkout, och
--   · kom med på studiehjälparens underlag den 25:e.
--
-- Prövat mot driften före ändringen, i en transaktion som rullades
-- tillbaka: alla tre försöken gick igenom. Proven står nu i
-- verktyg/rls-test.sql under FAS 14.6a.
--
-- Ett nytt pass har ingen betalning. Allt som beskriver en betalning
-- skrivs av betalningen själv: stripe-checkout, stripe-webhook och
-- stripe-aterbetalning, alla med service_role där auth.uid() är null
-- och triggern släpper igenom. Admin går förbi, som i resten av
-- triggern.
--
-- STRIPE-KOLUMNERNA LÄSES UR RADEN, DE RÄKNAS INTE UPP. En ny
-- stripe_-kolumn hade annars varit öppen tills någon mindes att lägga
-- till den här. De andra betalningskolumnerna har inget gemensamt
-- prefix och står uppräknade; lägger du till en: lägg till den här.
--
-- AUDITEN. bookings_audit loggade status, närvaro, datum och
-- avbokning, men ingen betalning. En betalning som kom in från Stripe
-- och en 'betald' som admin skrev för hand i Table Editor lämnade
-- samma spår: inget. Läget och dagen är tillstånd, inte innehåll, och
-- hör hemma i vitlistan. Beloppen står inte där: de finns i raden och
-- hos Stripe, och en auditrad är till för att se VEM som ändrade
-- läget och NÄR.
-- ============================================================

create or replace function public.skydda_bokningsfalt()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  jag   uuid := auth.uid();
  idag  date := (now() at time zone 'Europe/Stockholm')::date;
  fria  text[] := array['status', 'wanted_date', 'wanted_time', 'created_by', 'attendance',
                          'avbokningsskal'];
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

    /* FAS 14.6a. Ett nytt pass har ingen betalning. Se filhuvudet i
       migrationen fas14_6a för hålet det här stänger. */
    if new.betalning_status is distinct from 'ingen'
       or new.betald_at is not null
       or new.betalt_ore is not null
       or new.begart_ore is not null
       or coalesce(new.aterbetald_ore, 0) <> 0
       or new.ersattning_ore is not null
       or new.avgift_ore is not null
       or exists (
         select 1 from jsonb_each(to_jsonb(new)) k
          where k.key like 'stripe\_%' and k.value <> 'null'::jsonb
       ) then
      raise exception using errcode = '42501',
        message = 'Ett nytt pass har ingen betalning. Den sätts när passet betalas.';
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

  -- FAS 15.2. Skälet står i vitlistan, men bara i samma skrivning som
  -- avbokningen — ett skäl på ett pass som fortfarande gäller är
  -- ingenting, och ett skäl som byts efteråt hade gjort mejlet som
  -- redan gått till motparten osant. Rättelser i efterhand gör admin.
  if new.avbokningsskal is distinct from old.avbokningsskal then
    if new.status is distinct from 'cancelled' then
      raise exception using errcode = '42501',
        message = 'Skälet anges när passet avbokas.';
    end if;
    if new.avbokningsskal is null
       or new.avbokningsskal not in ('sjukdom', 'forhinder', 'ombokat', 'annat') then
      raise exception using errcode = '42501',
        message = 'Det skälet sätter bara Nextrum.';
    end if;
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

      /* FAS 15.2. Ett avbokat pass säger varför. Att AVBÖJA en tid
         motparten föreslagit gör det inte — det passet fanns aldrig.
         Skillnaden är densamma som notis_vid_pass gör mellan
         pass_avbojt och pass_avbokat, så ett mejl om ett avbokat pass
         från en familj eller en studiehjälpare har alltid ett skäl. */
      if not (old.status = 'requested' and old.created_by is distinct from jag)
         and new.avbokningsskal is null then
        raise exception using errcode = '42501',
          message = 'Välj ett skäl till avbokningen.';
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

      /* FAS 14.2. Ingen betalning, inget pass — när flaggan kortsparr
         är på. Den står AV tills en provbetalning gått hela vägen; på
         utan en kortväg som bevisligen fungerar hade den låst varje
         studiehjälpare ute från att rapportera ett enda pass.

         Prövningen ligger här och inte i rapportformuläret, för att
         rapporten gör passet genomfört i databasen
         (rapport_gor_passet_genomfort) och den skrivningen går genom
         den här triggern. Ett obetalt pass får alltså ingen rapport,
         och utan rapport kommer det aldrig med på underlaget den 25:e.

         Tvist släpps igenom: familjen HAR betalat, och passet hölls på
         den betalningen. Ett pass Nextrum undantagit (fakturerbar =
         false) ska inte betalas och ska därför inte heller stoppas.
         Saknas flaggraden är spärren av, inte på — ett fel i en
         konfigurationstabell ska inte stänga ute alla studiehjälpare. */
      if old.fakturerbar
         and old.betalning_status not in ('betald', 'tvist')
         and coalesce((select f.aktiv from public.flaggor f where f.kod = 'kortsparr'), false) then
        raise exception using errcode = '42501',
          message = 'Passet är inte betalt, så rapporten kan inte sparas än. Familjen betalar passet i sin vy, och rapporten går att spara när betalningen kommit in.';
      end if;
    end if;
  end if;

  return new;
end $function$;

-- ---------- auditen ----------
drop trigger if exists bookings_audit on public.bookings;
create trigger bookings_audit
  after insert or update of status, attendance, fakturerbar, wanted_date, wanted_time, avbokningsskal,
                           betalning_status, betald_at
  on public.bookings
  for each row execute function public.logga_andring(
    'pass', 'id', 'status', 'attendance', 'fakturerbar', 'wanted_date', 'wanted_time',
    'parent_id', 'tutor_id', 'student_id', 'uppdrag_id', 'avbokad_at', 'avbokad_av', 'avbokningsskal',
    'betalning_status', 'betald_at');
