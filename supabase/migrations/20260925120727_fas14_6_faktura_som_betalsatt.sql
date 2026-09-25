-- ============================================================
-- NEXTRUM — Fas 14.6: familjen kan betala ett pass mot faktura
--
-- Under "Betala med kort" kan familjen välja "Betala med faktura i
-- stället". Beslutet (Leo 2026-09-25): en MÅNADSFAKTURA i efterskott,
-- tio dagars betalningstid, ingen avgift, och valet finns för alla
-- familjer. Fakturan skapas och skickas i Wint, som också sköter
-- bokföringen. Nextrum skapar underlaget, Wint skickar fakturan.
--
--
-- ETT NYTT LÄGE, INTE EN NY KOLUMN
--
-- betalning_status får värdet 'faktura': "det här passet betalas mot
-- faktura". Sex listor över obetalda lägen (avvikelsen ej_betalt,
-- analys_ekonomi, OBETALDA_LAGEN i pris.ts, två i adminvyn och en i
-- föräldravyn) är TILLÅT-listor över ingen, vantar och misslyckad. Ett
-- nytt läge hamnar därför utanför dem utan att någon av dem behöver
-- ändras, och ett fakturapass larmar aldrig som obetalt med kort.
--
-- Att fakturan är BETALD står inte på passet. Det står på fakturan
-- (invoices.status, betald_at), och passet pekar dit genom
-- invoice_lines. En sanning per betalning: kortets på passet, fakturans
-- på fakturan. Hade passet också fått 'betald' hade två rader kunnat
-- säga olika saker om samma pengar.
--
--
-- STRÖMBRYTAREN ÄR FLAGGAN 'faktura', OCH DEN STÅR AV
--
-- Samma mekanism som kortsparr och notiser_mejl. Bolaget är inte
-- registrerat, och Wint tar bara aktiebolag. Villkoren, prissidan och
-- FAQ:n säger ännu att familjen betalar med kort. Slås flaggan på innan
-- de säger något annat erbjuder vyn ett betalsätt som familjen aldrig
-- godkänt villkoren för. vantar_pa säger vad som ska vara klart.
--
-- När flaggan är på gäller valet alla familjer. faktura_sparr är
-- bromsen för en enskild familj, satt av admin. En familj som redan
-- valt faktura behåller sina fakturapass om spärren sätts: de är
-- avtalade, och ska faktureras.
--
--
-- VALET GÖRS PÅ PASSET, AV FAMILJEN, OCH PRÖVAS HÄR
--
-- skydda_bokningsfalt släpper igenom ETT byte av betalning_status från
-- en inloggad familj, och ingenting annat i samma skrivning:
--
--   ingen, vantar, misslyckad → faktura   när flaggan är på och
--                                         familjen inte är spärrad
--   faktura → ingen                       tills passet står på en
--                                         faktura
--
-- 'vantar' är med med flit. En familj som öppnat kassan och stängt den
-- står i vantar i upp till ett dygn, och hade annars inte kunnat välja
-- faktura under tiden. Betalar de den gamla kassan ändå tar webhooken
-- emot betalningen (kortet vinner, pengarna är dragna), och avvikelsen
-- betald_och_fakturerad larmar om passet redan hunnit faktureras.
--
-- Bytet gäller också ett genomfört pass. Sex genomförda pass i driften
-- är obetalda och bokades när villkoren lovade månadsfaktura; en
-- faktura är den naturliga vägen för dem.
--
--
-- SPÄRREN "INGEN BETALNING, INGET PASS" släpper igenom 'faktura'.
-- Fakturan kommer efter månaden, per konstruktion: ett fakturapass
-- hålls innan det är betalt.
--
--
-- FAKTURAN
--
-- invoices och invoice_lines bär fakturan, som de gjorde före Fas 14.2.
-- UNIQUE(parent_id, period) är precis en månadsfaktura per familj, och
-- faktura_forfallen, faktura_gammalt_utkast, faktura_summa_fel,
-- admin_lage och familjens läsrätt fungerar som de är.
-- wint_fakturanummer är numret fakturan fick i Wint. Det skrivs in av
-- admin när fakturan lagts in där, och är det familjen ser på sin
-- faktura.
--
--
-- NOTISERNA får koden betalsatt = 'faktura' för ett fakturapass, så
-- att bekräftelsen och påminnelsen inte ber familjen betala med kort.
-- En KOD, som skälet för avbokningen: mallen skriver orden.
-- ============================================================

-- ---------- läget ----------
alter table public.bookings drop constraint if exists bookings_betalning_status_check;
alter table public.bookings add constraint bookings_betalning_status_check
  check (betalning_status in ('ingen', 'vantar', 'betald', 'aterbetald', 'tvist', 'misslyckad', 'faktura'));

comment on column public.bookings.betalning_status is
  'Hur det går med betalningen. ingen/vantar/misslyckad: obetalt. betald/tvist/aterbetald: kortet, '
  'satt av stripe-webhook. faktura: familjen betalar passet mot månadsfaktura (Fas 14.6); att '
  'fakturan är betald står på invoices, dit passet pekar genom invoice_lines. Familjen väljer '
  'faktura och tillbaka själv, prövat i skydda_bokningsfalt.';

-- ---------- strömbrytaren ----------
insert into public.flaggor (kod, aktiv, beskrivning, vantar_pa) values (
  'faktura', false,
  'Faktura som betalsätt. På: familjen kan välja "Betala med faktura i stället" under kortknappen, '
  || 'och passet kommer med på en månadsfaktura i början av nästa månad, att betala inom tio dagar. '
  || 'Av: bara kort. Pass som redan valts för faktura faktureras ändå.',
  'Bolaget är registrerat och har ett Wint-konto med bankgiro. Villkoren, prissidan, FAQ:n, '
  || 'maskoten, mejlen och /en/ säger att faktura finns, med tio dagars betalningstid och utan '
  || 'avgift, och villkoren beskriver ångerrätten (DEPLOY-BETALNING.md 9.11). Befintliga '
  || 'kontohavare har fått beskedet 30 dagar i förväg. Wints påminnelser tar ingen avgift.'
) on conflict (kod) do nothing;

-- ---------- spärren per familj ----------
create table if not exists public.faktura_sparr (
  parent_id uuid primary key references public.profiles(id) on delete cascade,
  satt_at   timestamptz not null default now(),
  satt_av   uuid default auth.uid() references public.profiles(id) on delete set null
);

comment on table public.faktura_sparr is
  'Familjer som inte får välja faktura (Fas 14.6). En rad = spärrad. Sätts och tas bort av admin. '
  'Skälet står inte här: fritext om en familj hör hemma i admin_noteringar, inte i en tabell '
  'auditloggen läser.';

alter table public.faktura_sparr enable row level security;

drop policy if exists "admin sköter fakturaspärren" on public.faktura_sparr;
create policy "admin sköter fakturaspärren" on public.faktura_sparr
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "familjen ser sin egen spärr" on public.faktura_sparr;
create policy "familjen ser sin egen spärr" on public.faktura_sparr
  for select to authenticated using (parent_id = auth.uid());

revoke all on public.faktura_sparr from anon;

drop trigger if exists faktura_sparr_audit on public.faktura_sparr;
create trigger faktura_sparr_audit
  after insert or delete on public.faktura_sparr
  for each row execute function public.logga_andring('fakturasparr', 'parent_id', 'parent_id', 'satt_at');

-- ---------- får den här familjen välja faktura ----------
-- I intern: triggern behöver svaret om en ANNAN rad än anroparens egen
-- (passets förälder), och ett API som svarar om vilken person som helst
-- är precis det ar_godkand_studiehjalpare fick rättas för (Fas 14.0b).
create or replace function intern.faktura_tillaten(p_foralder uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select p_foralder is not null
     and coalesce((select f.aktiv from public.flaggor f where f.kod = 'faktura'), false)
     and not exists (select 1 from public.faktura_sparr s where s.parent_id = p_foralder);
$$;

revoke all on function intern.faktura_tillaten(uuid) from public, anon, authenticated;

-- Vyn frågar bara om sig själv. Ingen parameter: en fråga om någon
-- annan går inte ens att ställa.
create or replace function public.faktura_mojlig()
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select intern.faktura_tillaten(auth.uid());
$$;

revoke all on function public.faktura_mojlig() from public, anon;
grant execute on function public.faktura_mojlig() to authenticated;

-- ---------- fakturan ----------
alter table public.invoices add column if not exists wint_fakturanummer text;

alter table public.invoices drop constraint if exists invoices_wint_fakturanummer_check;
alter table public.invoices add constraint invoices_wint_fakturanummer_check
  check (wint_fakturanummer is null or wint_fakturanummer ~ '^[A-Za-z0-9-]{1,30}$');

create unique index if not exists invoices_wint_fakturanummer_key
  on public.invoices (wint_fakturanummer) where wint_fakturanummer is not null;

comment on column public.invoices.wint_fakturanummer is
  'Numret fakturan fick i Wint (Fas 14.6). Skrivs av admin när fakturan lagts in där. Det är det '
  'familjen ser, och det Wint och banken känner igen.';

drop trigger if exists invoices_audit on public.invoices;
create trigger invoices_audit
  after insert or delete or update on public.invoices
  for each row execute function public.logga_andring(
    'faktura', 'id', 'parent_id', 'period', 'status', 'belopp_ore', 'rut_ore', 'rut_ar', 'valuta',
    'forfaller', 'skickad_at', 'betald_at', 'stripe_invoice_id', 'wint_fakturanummer');

-- ---------- skydda_bokningsfalt ----------
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
       migrationen fas14_6a för hålet det här stänger. Faktura väljs
       också på ett bokat pass, inte när det skapas: valet prövas i en
       enda gren nedan, och en andra väg in hade varit en andra regel. */
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

  -- ---------- betalsättet (Fas 14.6) ----------
  /* Familjen väljer faktura, eller kort igen, och i samma skrivning
     ändras ingenting annat. Grenen står FÖRE låset på genomförda pass:
     ett pass som hållits kan fortfarande betalas mot faktura. Se
     filhuvudet i migrationen fas14_6. */
  if new.betalning_status is distinct from old.betalning_status
     and (to_jsonb(new) - 'betalning_status') = (to_jsonb(old) - 'betalning_status') then
    if jag is distinct from old.parent_id then
      raise exception using errcode = '42501',
        message = 'Det är familjen som väljer hur passet betalas.';
    end if;
    if old.status = 'cancelled' then
      raise exception using errcode = '42501',
        message = 'Passet är avbokat och ska inte betalas.';
    end if;
    if not old.fakturerbar then
      raise exception using errcode = '42501',
        message = 'Passet är undantaget och ska inte betalas.';
    end if;

    if new.betalning_status = 'faktura' then
      if old.betalning_status not in ('ingen', 'vantar', 'misslyckad') then
        raise exception using errcode = '42501',
          message = 'Passet är redan betalt, eller betalas redan på annat sätt.';
      end if;
      if not intern.faktura_tillaten(jag) then
        raise exception using errcode = '42501',
          message = 'Faktura går inte att välja just nu. Betala med kort, eller skriv till oss.';
      end if;
    elsif new.betalning_status = 'ingen' and old.betalning_status = 'faktura' then
      if exists (select 1 from public.invoice_lines l where l.booking_id = old.id) then
        raise exception using errcode = '42501',
          message = 'Passet står redan på en faktura och betalas genom den.';
      end if;
    else
      raise exception using errcode = '42501',
        message = 'Betalningen sätts när passet betalas, inte härifrån.';
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
         en återbetalning ingen beslutat om.

         Ett fakturapass går att avboka: det faktureras först när det
         hållits, och ett avbokat pass hålls aldrig. */
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
         den betalningen. Faktura släpps igenom (Fas 14.6): fakturan
         kommer efter månaden, så ett fakturapass hålls innan det är
         betalt, per konstruktion. Ett pass Nextrum undantagit
         (fakturerbar = false) ska inte betalas och ska därför inte
         heller stoppas. Saknas flaggraden är spärren av, inte på — ett
         fel i en konfigurationstabell ska inte stänga ute alla
         studiehjälpare. */
      if old.fakturerbar
         and old.betalning_status not in ('betald', 'tvist', 'faktura')
         and coalesce((select f.aktiv from public.flaggor f where f.kod = 'kortsparr'), false) then
        raise exception using errcode = '42501',
          message = 'Passet är inte betalt, så rapporten kan inte sparas än. Familjen betalar passet i sin vy, och rapporten går att spara när betalningen kommit in.';
      end if;
    end if;
  end if;

  return new;
end $function$;

-- ---------- avvikelserna ----------
create or replace function public.avvikelser_rader()
returns table(typ text, objekt_tabell text, objekt_id text, datum date, belopp_ore bigint, kund_id uuid, studiehjalpare_id uuid)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  idag     date := (now() at time zone 'Europe/Stockholm')::date;
  manad    date := date_trunc('month', now() at time zone 'Europe/Stockholm')::date;
  rut_ar   int  := extract(year from (now() at time zone 'Europe/Stockholm') + interval '10 days')::int;
begin
  return query
  -- Genomfört pass utan rapport: räknas inte och betalas inte ut.
  select 'pass_utan_rapport', 'bookings', p.id::text, p.wanted_date, null::bigint, p.parent_id, p.tutor_id
    from public.passunderlag p
   where p.fakturerbar and not p.har_rapport and not p.fakturerad and not p.pa_underlag
  union all
  -- Rapport som inte hör till något pass.
  select 'fristaende_rapport', 'lesson_reports', r.id::text, r.lesson_date, null, null, r.tutor_id
    from public.lesson_reports r where r.booking_id is null
  -- Hölls och rapporterades, men familjen har inte betalat (Fas 14.2).
  -- Ersätter ej_fakturerat: familjen får ingen månadsfaktura längre,
  -- så det finns ingen dag då ett obetalt pass blir betalt av sig
  -- självt, och därför ingen datumgräns. Ett pass på en äldre faktura
  -- drivs in genom den och räknas inte här. Ett fakturapass (Fas 14.6)
  -- är inte obetalt med kort, och står inte i listan.
  union all
  select 'ej_betalt', 'bookings', p.id::text, p.wanted_date, null, p.parent_id, p.tutor_id
    from public.passunderlag p
   where p.fakturerbar and p.har_rapport and not p.fakturerad
     and p.betalning_status in ('ingen', 'vantar', 'misslyckad')
  union all
  -- FAS 14.6. Ett fakturapass från en månad som är slut, som inte står
  -- på någon faktura. Månadskörningen skapar fakturan; har den inte
  -- körts, eller föll passet ur den, är det här enda stället det syns.
  select 'faktura_saknas', 'bookings', p.id::text, p.wanted_date, null, p.parent_id, p.tutor_id
    from public.passunderlag p
   where p.fakturerbar and p.har_rapport and not p.fakturerad
     and p.betalning_status = 'faktura'
     and p.wanted_date < manad
  -- FAS 14.6. Betalt med kort OCH fakturerat. Händer bara om familjen
  -- valde faktura medan en kassa stod öppen, betalade den ändå, och
  -- passet hann komma med på fakturan emellan. Familjen ska inte betala
  -- två gånger: kreditera raden i Wint.
  union all
  select 'betald_och_fakturerad', 'bookings', p.id::text, p.wanted_date, null, p.parent_id, p.tutor_id
    from public.passunderlag p
   where p.fakturerad and p.betalning_status in ('betald', 'tvist')
  union all
  -- Avbokat men betalt (Fas 14.2c). Beloppet är det som inte gått
  -- tillbaka än. Saknas betalt_ore på en betald rad är det också fel,
  -- och då larmar raden utan belopp i stället för att tiga.
  select 'betald_men_avbokad', 'bookings', b.id::text, b.wanted_date,
         (b.betalt_ore - coalesce(b.aterbetald_ore, 0))::bigint, b.parent_id, b.tutor_id
    from public.bookings b
   where b.status = 'cancelled' and b.betalning_status = 'betald'
     and (b.betalt_ore is null or b.betalt_ore > coalesce(b.aterbetald_ore, 0))
  union all
  select 'ej_utbetalt', 'bookings', p.id::text, p.wanted_date, null, p.parent_id, p.tutor_id
    from public.passunderlag p
   where p.fakturerbar and p.har_rapport and not p.pa_underlag and p.tutor_id is not null
     and p.wanted_date < manad
  union all
  -- Skickad faktura efter förfallodagen, obetald.
  select 'faktura_forfallen', 'invoices', i.id::text, i.forfaller, i.belopp_ore, i.parent_id, null
    from public.invoices i
   where i.status in ('skickad', 'forfallen') and i.betald_at is null and i.forfaller < idag
  union all
  -- Utkast som aldrig lagts in i Wint.
  select 'faktura_gammalt_utkast', 'invoices', i.id::text, i.period, i.belopp_ore, i.parent_id, null
    from public.invoices i
   where i.status = 'utkast' and i.created_at < now() - interval '7 days'
  union all
  -- Utbetalning som inte gjorts, för en månad före förra.
  select 'utbetalning_vantar', 'payouts', u.id::text, u.period, u.belopp_ore, null, u.tutor_id
    from public.payouts u
   where u.status in ('utkast', 'godkand')
     and u.period < (manad - interval '1 month')::date
  union all
  select 'utbetalning_misslyckad', 'payouts', u.id::text, u.period, u.belopp_ore, null, u.tutor_id
    from public.payouts u where u.status = 'misslyckad'
  union all
  -- Pass klart för utbetalning men ingen ersättning att räkna med.
  select 'timpenning_saknas', 'bookings', b.id::text, b.wanted_date, null, b.parent_id, b.tutor_id
    from public.passunderlag b
    left join public.tutor_profiles tp on tp.id = b.tutor_id
    left join public.tjanster t on t.kod = b.tjanst
   where b.tutor_id is not null and b.fakturerbar and b.har_rapport and not b.pa_underlag
     and coalesce(tp.hourly_rate, 0) = 0 and coalesce(t.ersattning_per_timme_ore, 0) = 0
  union all
  select 'pass_utan_studiehjalpare', 'bookings', b.id::text, b.wanted_date, null, b.parent_id, null
    from public.bookings b where b.status = 'completed' and b.tutor_id is null
  union all
  -- RUT-pass där kunden saknar skatteuppgifter: faktureras utan avdrag.
  select 'rut_utan_skatteuppgifter', 'bookings', b.id::text, b.wanted_date, null, b.parent_id, b.tutor_id
    from public.passunderlag b
    join public.tjanster t on t.kod = b.tjanst
   where t.rut_berattigad and t.rut_procent > 0 and b.fakturerbar and b.har_rapport and not b.fakturerad
     and not exists (select 1 from public.kund_skatteuppgifter k where k.kund_id = b.parent_id)
  union all
  -- RUT-pass men inget tak inlagt för året avdraget räknas mot.
  select 'rut_utan_tak', 'rut_tak', rut_ar::text, null, null, null, null
   where exists (select 1 from public.passunderlag b join public.tjanster t on t.kod = b.tjanst
                  where t.rut_berattigad and t.rut_procent > 0 and b.fakturerbar and b.har_rapport and not b.fakturerad)
     and not exists (select 1 from public.rut_tak where ar = rut_ar)
  union all
  select 'rut_over_tak', 'profiles', r.kund_id::text, make_date(r.ar, 12, 31), r.rut_ore, r.kund_id, null
    from public.rut_underlag r where r.kvar_ore < 0
  union all
  -- Fakturans summa stämmer inte med raderna.
  select 'faktura_summa_fel', 'invoices', i.id::text, i.period, i.belopp_ore, i.parent_id, null
    from public.invoices i
   where i.belopp_ore <> coalesce((select sum(l.belopp_ore) from public.invoice_lines l where l.invoice_id = i.id), 0)
  union all
  select 'utbetalning_summa_fel', 'payouts', u.id::text, u.period, u.belopp_ore, null, u.tutor_id
    from public.payouts u
   where u.belopp_ore <> coalesce((select sum(l.belopp_ore) from public.payout_lines l where l.payout_id = u.id), 0)
  union all
  -- Fakturerat pass som inte längre är genomfört eller fakturerbart.
  select 'fakturerat_ogiltigt_pass', 'invoice_lines', l.id::text, b.wanted_date, l.belopp_ore, b.parent_id, b.tutor_id
    from public.invoice_lines l join public.bookings b on b.id = l.booking_id
   where b.status <> 'completed' or not b.fakturerbar;
end $function$;

create or replace function public.kontroll_ekonomiska_avvikelser()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n integer := 0;
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  a record;
  rubrik text;
  text_ text;
  tabell text;
begin
  for a in select * from public.avvikelser_rader()
            where typ not in ('pass_utan_rapport', 'faktura_forfallen')
  loop
    select t.rubrik, t.beskrivning into rubrik, text_ from (values
      ('fristaende_rapport',      'Rapport utan pass',        'Rapporten hör inte till något pass och kan därför varken räknas eller betalas ut. Koppla den till rätt pass.'),
      ('ej_betalt',               'Inte betalt',              'Passet hölls och rapporterades, men familjen har inte betalat det. Betala-knappen ligger kvar på passet i familjens vy.'),
      ('faktura_saknas',          'Fakturapass utan faktura', 'Familjen valde faktura för passet, månaden är slut och passet står inte på någon faktura. Kör månadskörningen under Ekonomi → Månadskörning.'),
      ('betald_och_fakturerad',   'Betalt två gånger',        'Passet är betalt med kort och står dessutom på en faktura. Kreditera raden i Wint, så att familjen inte betalar två gånger.'),
      ('betald_men_avbokad',      'Betalt men avbokat',       'Passet är avbokat men familjen har betalat det. Villkoren lovar hela beloppet tillbaka för ett pass som aldrig hölls: återbetala under Kortbetalningar.'),
      ('ej_utbetalt',             'Inte utbetalt',            'Klart för underlag, men månaden det hölls är slut.'),
      ('faktura_gammalt_utkast',  'Faktura inte i Wint',      'Fakturan har stått som utkast i över en vecka. Lägg in den i Wint och skriv in fakturanumret under Ekonomi → Fakturor, eller ta bort utkastet.'),
      ('utbetalning_vantar',      'Utbetalning väntar',       'Underlaget är äldre än förra månaden och pengarna har inte gått iväg.'),
      ('utbetalning_misslyckad',  'Utbetalning misslyckades', 'Överföringen gick inte igenom. Ta reda på varför innan nästa körning.'),
      ('timpenning_saknas',       'Timpenning saknas',        'Passet kan inte betalas ut: varken studiehjälparen eller tjänsten har en ersättning.'),
      ('pass_utan_studiehjalpare','Pass utan studiehjälpare', 'Passet är genomfört men ingen studiehjälpare står på det.'),
      ('rut_utan_skatteuppgifter','RUT utan skatteuppgifter', 'Passet är RUT-berättigat men kunden saknar skatteuppgifter. Fakturan skulle skickas utan avdrag.'),
      ('rut_utan_tak',            'RUT-taket saknas',         'Ingen rad i rut_tak för året avdraget räknas mot. Fyll i taket under System → Inställningar.'),
      ('rut_over_tak',            'RUT över taket',           'Kunden har dragit av mer än årets tak tillåter.'),
      ('faktura_summa_fel',       'Fakturasumman stämmer inte','Fakturans belopp är inte summan av dess rader.'),
      ('utbetalning_summa_fel',   'Utbetalningssumman stämmer inte','Underlagets belopp är inte summan av dess rader.'),
      ('fakturerat_ogiltigt_pass','Fakturerat ogiltigt pass', 'En fakturarad pekar på ett pass som inte längre är genomfört eller fakturerbart.')
    ) as t(typ, rubrik, beskrivning) where t.typ = a.typ;

    tabell := a.objekt_tabell;

    if public.skapa_uppgift(
         coalesce(rubrik, a.typ) || case when a.datum is not null
                                    then ' ' || to_char(a.datum, 'YYYY-MM-DD') else '' end,
         'avvikelse:' || a.typ || ':' || a.objekt_tabell || ':' || a.objekt_id,
         'problem',
         text_,
         tabell,
         a.objekt_id,
         idag + 5) is not null
    then n := n + 1;
    end if;
  end loop;
  return n;
end $function$;

create or replace function public.paminnelse_forfallna_fakturor()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n integer := 0;
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  f record;
begin
  for f in
    select i.id, i.forfaller, i.belopp_ore, i.wint_fakturanummer
      from public.invoices i
     where i.status in ('skickad', 'forfallen')
       and i.betald_at is null
       and i.forfaller < idag
     order by i.forfaller
  loop
    if public.skapa_uppgift(
         'Förfallen faktura ' || to_char(f.forfaller, 'YYYY-MM-DD'),
         'avvikelse:faktura_forfallen:invoices:' || f.id::text,
         'problem',
         'Fakturan'
           || case when f.wint_fakturanummer is not null then ' ' || f.wint_fakturanummer else '' end
           || ' är skickad, obetald och förfallodagen har passerat ('
           || to_char(f.forfaller, 'YYYY-MM-DD') || ', '
           || to_char(round(f.belopp_ore / 100.0), 'FM999G999') || ' kr). '
           || 'Se efter i Wint om den är betald. Är den det: markera den betald under '
           || 'Ekonomi → Fakturor. Annars skickas påminnelsen från Wint, utan avgift: '
           || 'ingen påminnelseavgift står i villkoren.',
         'invoices', f.id::text,
         idag + 1) is not null
    then n := n + 1;
    end if;
  end loop;
  return n;
end $function$;

-- ---------- läget för adminvyn ----------
create or replace view public.admin_lage with (security_invoker = true) as
 SELECT ( SELECT count(*) AS count
           FROM leads
          WHERE leads.status = 'new'::text) AS nya_leads,
    ( SELECT count(*) AS count
           FROM applications
          WHERE applications.status = 'new'::text) AS nya_ansokningar,
    ( SELECT count(*) AS count
           FROM tutor_profiles
          WHERE tutor_profiles.status = 'pending'::text) AS vantande_studiehjalpare,
    ( SELECT count(*) AS count
           FROM profiles
          WHERE profiles.role = 'parent'::text AND profiles.match_status = 'pending'::text) AS omatchade_familjer,
    ( SELECT count(*) AS count
           FROM contact_messages
          WHERE contact_messages.hanterad_at IS NULL) AS ohanterade_meddelanden,
    ( SELECT count(*) AS count
           FROM bookings
          WHERE (bookings.status = ANY (ARRAY['requested'::text, 'confirmed'::text])) AND bookings.wanted_date >= CURRENT_DATE) AS kommande_pass,
    ( SELECT count(*) AS count
           FROM bookings
          WHERE bookings.status = 'requested'::text) AS obesvarade_pass,
    ( SELECT count(*) AS count
           FROM invoices
          WHERE invoices.status = ANY (ARRAY['skickad'::text, 'forfallen'::text])) AS obetalda_fakturor,
    ( SELECT COALESCE(sum(invoices.belopp_ore), 0::numeric) AS "coalesce"
           FROM invoices
          WHERE invoices.status = ANY (ARRAY['skickad'::text, 'forfallen'::text])) AS obetalt_ore,
    ( SELECT count(*) AS count
           FROM payouts
          WHERE payouts.status = ANY (ARRAY['utkast'::text, 'godkand'::text])) AS vantande_utbetalningar,
    ( SELECT COALESCE(sum(payouts.belopp_ore), 0::numeric) AS "coalesce"
           FROM payouts
          WHERE payouts.status = ANY (ARRAY['utkast'::text, 'godkand'::text])) AS att_betala_ut_ore,
    ( SELECT count(*) AS count
           FROM passunderlag p
          WHERE p.fakturerbar AND NOT p.har_rapport AND NOT p.fakturerad AND NOT p.pa_underlag) AS pass_utan_rapport,
    ( SELECT count(*) AS count
           FROM invoices i
          WHERE (i.status = ANY (ARRAY['skickad'::text, 'forfallen'::text])) AND i.betald_at IS NULL AND i.forfaller < (now() AT TIME ZONE 'Europe/Stockholm'::text)::date) AS forfallna_fakturor,
    ( SELECT count(*) AS count
           FROM uppgifter u
          WHERE u.status = ANY (ARRAY['oppen'::text, 'pagar'::text])) AS oppna_uppgifter,
    ( SELECT count(*) AS count
           FROM uppgifter u
          WHERE (u.status = ANY (ARRAY['oppen'::text, 'pagar'::text])) AND u.forfallodag < (now() AT TIME ZONE 'Europe/Stockholm'::text)::date) AS forsenade_uppgifter,
    ( SELECT count(*) AS count
           FROM klientfel k
          WHERE k.created_at > (now() - '24:00:00'::interval)) AS klientfel_24h,
    -- FAS 14.6. Fakturor som månadskörningen skapat men som ingen lagt
    -- in i Wint än. De står i arbetskön, för ingen annan än vi kan göra
    -- det.
    ( SELECT count(*) AS count
           FROM invoices i
          WHERE i.status = 'utkast'::text) AS fakturor_att_lagga_in;

-- ---------- notiserna: betalsättet som en kod ----------
create or replace function public.notis_vid_pass()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  aktor uuid := auth.uid();
  typ   text;
  bas   jsonb;
  elev  text;
  hjalp text;
  m     uuid;
begin
  if tg_op = 'INSERT' then
    typ := 'pass_nytt';
  elsif new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    typ := case when old.status = 'requested' and aktor is not null and aktor is distinct from old.created_by
                then 'pass_avbojt' else 'pass_avbokat' end;
  elsif new.status in ('requested', 'confirmed')
        and (new.wanted_date is distinct from old.wanted_date or new.wanted_time is distinct from old.wanted_time) then
    typ := 'pass_flyttat';
  elsif old.status = 'requested' and new.status = 'confirmed' then
    typ := 'pass_bekraftat';
  else
    return null;
  end if;

  select intern.fornamn(s.name) into elev from public.students s where s.id = new.student_id;
  select intern.fornamn(p.full_name) into hjalp from public.profiles p where p.id = new.tutor_id;

  bas := jsonb_strip_nulls(jsonb_build_object(
    'datum', new.wanted_date, 'tid', new.wanted_time, 'langd_min', new.duration_min,
    'amne', intern.fornamn(new.subject), 'studiehjalpare', hjalp, 'status', new.status,
    'fran_datum', case when typ = 'pass_flyttat' then old.wanted_date end,
    'fran_tid', case when typ = 'pass_flyttat' then old.wanted_time end,
    -- En kod ur bookings_avbokningsskal_check, aldrig text. renData()
    -- släpper bara igenom de sex koderna, och mallen skriver orden.
    'skal', case when typ = 'pass_avbokat' then new.avbokningsskal end,
    -- FAS 14.6. Samma sorts kod: mallen ska inte be en familj som valt
    -- faktura att betala med kort.
    'betalsatt', case when new.betalning_status = 'faktura' then 'faktura' end));

  foreach m in array array[new.parent_id, new.tutor_id] loop
    continue when m is null or m = aktor;
    perform intern.notis_skapa(m, typ, new.id, new.student_id, new.parent_id, new.tutor_id,
      case when elev is not null and intern.far_se_eleven(m, new.student_id)
           then bas || jsonb_build_object('elev', elev) else bas end);
  end loop;
  return null;
exception when others then
  insert into public.notis_fel (kalla, fel) values ('notis_vid_pass ' || coalesce(new.id::text, ''), left(sqlerrm, 500));
  return null;
end $function$;

create or replace function public.notis_planera()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  inst   public.notis_installning%rowtype;
  h      int;
  b      record;
  paminn timestamptz;
  m      uuid;
  bas    jsonb;
  data   jsonb;
  elev   text;
  hjalp  text;
  nya    int := 0;
begin
  select * into inst from public.notis_installning where id = 1;
  if inst.paminnelser_timmar is null or cardinality(inst.paminnelser_timmar) = 0 then
    return 0;
  end if;

  foreach h in array inst.paminnelser_timmar loop
    for b in
      select bk.id, bk.parent_id, bk.tutor_id, bk.student_id, bk.wanted_date, bk.wanted_time,
             bk.duration_min, bk.subject, bk.created_at, bk.betalning_status,
             (bk.wanted_date + bk.wanted_time::time) at time zone 'Europe/Stockholm' as start
        from public.bookings bk
       where bk.status = 'confirmed'
         and bk.wanted_time is not null
         and bk.wanted_date between (now() at time zone 'Europe/Stockholm')::date - 1
                                and (now() at time zone 'Europe/Stockholm')::date + 8
    loop
      paminn := b.start - make_interval(hours => h);
      continue when paminn > now()                          -- inte dags än
                 or b.start <= now()                        -- passet har börjat
                 or paminn < now() - interval '30 minutes'  -- för sent, cron har stått still
                 or b.created_at > paminn;                  -- bokat efter påminnelsetiden

      select intern.fornamn(s.name) into elev from public.students s where s.id = b.student_id;
      select intern.fornamn(p.full_name) into hjalp from public.profiles p where p.id = b.tutor_id;
      bas := jsonb_strip_nulls(jsonb_build_object(
        'datum', b.wanted_date, 'tid', b.wanted_time, 'langd_min', b.duration_min,
        'amne', intern.fornamn(b.subject), 'studiehjalpare', hjalp, 'timmar', h, 'start', b.start,
        -- FAS 14.6. Se notis_vid_pass.
        'betalsatt', case when b.betalning_status = 'faktura' then 'faktura' end));

      foreach m in array array[b.parent_id, b.tutor_id] loop
        continue when m is null;
        data := case when elev is not null and intern.far_se_eleven(m, b.student_id)
                     then bas || jsonb_build_object('elev', elev) else bas end;

        if not exists (select 1 from public.notiser n
                        where n.pass_id = b.id and n.mottagare = m and n.typ = 'paminnelse'
                          and n.data ->> 'timmar' = h::text and (n.data ->> 'start')::timestamptz = b.start) then
          insert into public.notiser (mottagare, typ, pass_id, elev_id, trad_parent, trad_tutor, data)
          values (m, 'paminnelse', b.id, b.student_id, b.parent_id, b.tutor_id, data);
          nya := nya + 1;
        end if;

        if public.notis_vill(m, 'paminnelse', 'mejl') then
          perform intern.notis_koa(m, 'mejl', 'paminnelse', b.id, b.parent_id, b.tutor_id, data, null,
            'paminnelse:mejl:' || m || ':' || b.id || ':' || h || ':' || extract(epoch from b.start)::bigint,
            now(), b.start);
        end if;
        if public.notis_vill(m, 'paminnelse', 'sms') then
          perform intern.notis_koa(m, 'sms', 'paminnelse', b.id, b.parent_id, b.tutor_id, data, null,
            'paminnelse:sms:' || m || ':' || b.id || ':' || h || ':' || extract(epoch from b.start)::bigint,
            now(), b.start);
        end if;
      end loop;
    end loop;
  end loop;
  return nya;
end $function$;
