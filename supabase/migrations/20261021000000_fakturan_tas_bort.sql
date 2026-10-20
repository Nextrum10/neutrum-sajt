-- ============================================================
-- Fakturan tas bort, del 1 av 2: ingenting läser eller skapar den längre
-- (2026-10-21)
--
-- Leo: "Ta bort fakturasystemet helt: UI, funktioner, edge functions,
-- notismallar, tabeller, texter på sajten (priser, FAQ, villkorstext som
-- nämner faktura). Det har aldrig använts på riktigt. Kontrollera ändå
-- först att alla fakturarader tillhör testkontot Leo Trikke."
--
-- Fakturan kom tillbaka som betalsätt i Fas 14.6, och 2026-10-16 lades
-- obetalda pass på den av sig själva. Ingen faktura har gått till en
-- familj: bolaget, bankgirot och provfaktureringen återstod
-- (DEPLOY-BETALNING.md 9.11). Familjen betalar nu varje pass med kort,
-- med timmarna i timbanken eller med kassan efter passet.
--
-- DEN HÄR FILEN TAR INTE BORT NÅGOT. Tabellerna står kvar tills del 2
-- (fakturans_tabeller_tas_bort) körs, för hand, efter en backup:
--   1. Vakten: varje rad i invoices, invoice_lines, faktura_sparr och varje
--      pass med betalningen 'faktura' ska höra till testkontot (namnet Leo
--      Trikke). Annars stannar filen innan något ändrats, och säger hur
--      många och vems: också ett annat adminkonto är "någon annan" (Leo:
--      "Finns rader som tillhör någon annan, avbryt droppen, behåll
--      tabellerna och rapportera").
--   2. Strömbrytaren faktura står av och kan inte slås på
--      (flaggor_faktura_av), som kortsparr.
--   3. Familjen väljer inte längre betalsätt på passet: grenen i
--      skydda_bokningsfalt som släppte igenom 'faktura' är borta, och
--      valj_kort byter inte längre faktura mot kort.
--   4. Det som delas med lönerna och larmen skrivs om utan fakturan:
--      passunderlag (fakturerad är alltid falsk, och 'faktura' räknas inte
--      som betalt), avvikelser_rader och dess texter (inga fakturalarm),
--      manad_lage (bokslutet), admin_att_gora (morgonmejlet),
--      betalsatt_kod (mejlen), passet_bar_bokforing och
--      radering_underlag (raderingen), betygsgaranti_underlag (inga sena
--      fakturor), mitt_villkorslage (obetalda_fran), dagliga_kontroller
--      (inga förfallna fakturor), admin_lage och analys_ekonomi (fakturans
--      kolumner står kvar som noll, så att ingen vy eller AI-funktion
--      behöver tas bort och skapas om), och texterna i
--      manadskorning_vack och manadskorning_svar.
--   5. Funktionerna som bara fanns för fakturan gör ingenting:
--      fakturera_obetalda svarar med en tom lista (fakturering v35 i
--      driften anropar den varje natt tills den nya versionen är ute),
--      faktura_mojlig och faktura_tillaten svarar nej, och
--      paminnelse_forfallna_fakturor räknar noll. Del 2 tar bort dem.
--   6. AI-verktygen och uppgifterna kopplar inte längre till invoices.
--   7. Användarvillkoren har versionen 2026-10-21: punkten om fakturan och
--      meningarna om den är borta, så alla får frågan igen.
--
-- Månadskörningen (fakturering) står kvar: den skriver studiehjälparnas
-- underlag, och lönespecen den 25:e. Bara fakturahalvan tas bort, i
-- funktionen, som driftsätts FÖRE den här filen (DEPLOY-BETALNING.md 9.18).
--
-- RUT drogs bara på fakturan (Fas 5.3), och larmen för RUT läste den.
-- De går med den. rut_tak och kund_skatteuppgifter står kvar orörda.
--
-- Funktionerna skrivs om med en vakt på driftens md5 (som lästs ur en
-- databas byggd ur alla migrationer t.o.m. 20261016110000, och som
-- minne/databasen.md säger är driftens), eller lappas med replace() och
-- räknade träffar där andra migrationer också lappar dem. En som redan
-- är omskriven släpps igenom, så filen går att köra två gånger. Inget
-- drop och ingen delete.
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 1. vakten: bara testkontots rader ----------
do $$
declare
  fel   text[] := '{}';
  n     bigint;
  agare text;
begin
  -- Del 2 har redan tagit bort tabellerna: inget att vakta.
  if to_regclass('public.invoices') is null then
    return;
  end if;

  -- Testkontot är namnet Leo Trikke och inget annat.
  create temp table if not exists faktura_testkonton on commit drop as
    select p.id from public.profiles p
     where lower(btrim(coalesce(p.full_name, ''))) = 'leo trikke';

  select count(*) into n from public.invoices i
   where i.parent_id not in (select id from faktura_testkonton);
  if n > 0 then fel := fel || (n || ' fakturor')::text; end if;

  select count(*) into n from public.invoice_lines l
    join public.invoices i on i.id = l.invoice_id
   where i.parent_id not in (select id from faktura_testkonton);
  if n > 0 then fel := fel || (n || ' fakturarader')::text; end if;

  select count(*) into n from public.faktura_sparr s
   where s.parent_id not in (select id from faktura_testkonton);
  if n > 0 then fel := fel || (n || ' fakturaspärrar')::text; end if;

  select count(*) into n from public.bookings b
   where b.betalning_status = 'faktura' and b.parent_id not in (select id from faktura_testkonton);
  if n > 0 then fel := fel || (n || ' pass mot faktura')::text; end if;

  if cardinality(fel) > 0 then
    -- Vems raderna är, så att svaret går att läsa utan en fråga till.
    select string_agg(distinct coalesce(nullif(btrim(p.full_name), ''), '(utan namn)') || ' (' || p.id || ')', ', ')
      into agare
      from (select i.parent_id from public.invoices i
            union select s.parent_id from public.faktura_sparr s
            union select b.parent_id from public.bookings b where b.betalning_status = 'faktura') x
      join public.profiles p on p.id = x.parent_id
     where x.parent_id not in (select id from faktura_testkonton);
    raise exception 'fakturan_tas_bort: % tillhör någon annan än testkontot Leo Trikke (%). Ingenting är ändrat. '
      'Läs raderna och bestäm vad som ska hända med dem innan fakturan tas bort.', array_to_string(fel, ', '), agare;
  end if;
end $$;


-- ---------- 2. driften är som den lästes ----------
do $$
declare
  f   record;
  def text;
begin
  for f in
    select * from (values
      ('public.avvikelser_rader()',                     '6bb8c40c29062fb2d974c44136f3f141'),
      ('public.kontroll_ekonomiska_avvikelser()',       '4e91e940dc2fb727b215b9a5db91308f'),
      ('public.manad_lage(date)',                       '9050493571dfbacbc546bbe7d573b4b1'),
      ('intern.admin_att_gora()',                       '2e4fb2b24152b9fb3ebab59fec377d0b'),
      ('intern.betalsatt_kod(uuid)',                    '61599b9686565852e0d7aab8aceec296'),
      ('intern.passet_bar_bokforing(public.bookings)',  '871c606c646670fae4ae64b927519a34'),
      ('public.dagliga_kontroller()',                   '81775b7a4736fd7acd0d95d1c05a2606'),
      ('public.mitt_villkorslage()',                    'c7afb309acbd46bf32295f762befb600'),
      ('public.ai_finns(text, uuid)',                   '4bf39c2fce2b9417b803cfbc5625194a'),
      ('public.fakturera_obetalda(date, boolean)',      '48ffa223c27b62d33d7fd033d62f2f67'),
      ('public.faktura_mojlig()',                       'cd487d1bb89cfbd86ed43f298157946a'),
      ('intern.faktura_tillaten(uuid)',                 'b0c8f2ee1a573b99e2ee615844c075c1'),
      ('public.paminnelse_forfallna_fakturor()',        '0ae2d35726aa723ce97850b0aaeb37bd')) v(namn, summa)
  loop
    -- Del 2 tar bort fakturans egna funktioner; en som saknas är borttagen.
    continue when to_regprocedure(f.namn) is null;
    def := pg_get_functiondef(f.namn::regprocedure);
    if position('fakturan_tas_bort' in def) = 0 and md5(def) <> f.summa then
      raise exception '% har ändrats sedan fakturan_tas_bort skrevs (md5 %). Läs driften och skriv om migrationen.',
        f.namn, md5(def);
    end if;
  end loop;

  -- Villkoren skrevs mot versionen 2026-10-16. Har någon annan bytt den
  -- sedan dess står en annan text på sidan än den här filen utgår från.
  if intern.villkor_version() not in ('2026-10-16', '2026-10-21') then
    raise exception 'Villkorens version är %, inte 2026-10-16 som fakturan_tas_bort utgår från. Läs driften.',
      intern.villkor_version();
  end if;

  for f in
    select * from (values
      ('passunderlag',   '93b026c90d863119fb3c6d0c7ea55330'),
      ('admin_lage',     '90b90f0c3f6b93049a1b0572541f5c62'),
      ('analys_ekonomi', '61c7d7237f621c7e585d2a02cd86283e')) v(namn, summa)
  loop
    def := pg_get_viewdef(('public.' || f.namn)::regclass, true);
    if position('invoice' in def) > 0 and md5(def) <> f.summa then
      raise exception 'Vyn % har ändrats sedan fakturan_tas_bort skrevs (md5 %). Läs driften.', f.namn, md5(def);
    end if;
  end loop;
end $$;


-- ---------- 3. strömbrytaren står av ----------
-- flaggor_stampla skriver vem och när, som för varje annan ändring.
update public.flaggor set aktiv = false where kod = 'faktura' and aktiv;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.flaggor'::regclass
                  and conname = 'flaggor_faktura_av') then
    alter table public.flaggor
      add constraint flaggor_faktura_av check (kod <> 'faktura' or not aktiv);
  end if;
end $$;


-- ---------- 4. passunderlag: ingenting är fakturerat ----------
-- Kolumnen fakturerad står kvar (falsk), för sex vyer bygger på vyn och
-- kolumnerna går inte att ta bort utan att de skapas om. security_invoker
-- måste stå med: create or replace utan den gör vyn till ägarens, och då
-- läser en familj allas pass genom analysvyerna.
create or replace view public.passunderlag with (security_invoker = true) as
select b.id,
       b.parent_id,
       b.tutor_id,
       b.student_id,
       b.subject,
       b.tjanst,
       b.wanted_date,
       b.wanted_time,
       b.duration_min,
       b.antal_barn,
       b.rabatt_ore,
       b.fakturerbar,
       b.fakturerbar_anledning,
       exists (select 1 from public.lesson_reports r where r.booking_id = b.id) as har_rapport,
       false as fakturerad,
       exists (select 1 from public.payout_lines l where l.booking_id = b.id) as pa_underlag,
       b.betalning_status,
       b.timpris_ore,
       b.extra_ore,
       b.startrabatt,
       t.deb as debiterade_min,
       t.betalda as betalda_min,
       case when t.deb <= b.duration_min or t.betalda >= t.deb then t.deb else b.duration_min end as lon_min,
       t.bank as timbank_min
  from public.bookings b
 cross join lateral (select coalesce(intern.debiterade_min(b.id), b.duration_min) as deb) d
 cross join lateral (select coalesce((select u.minuter from public.timbank_uttag u
                                       where u.booking_id = b.id and u.sort = 'overtid'), 0) as bank) tb
 cross join lateral (
   select d.deb, tb.bank,
          case
            when b.betalning_status in ('betald', 'tvist') and b.klippkort_id is not null then b.duration_min
            when b.betalning_status in ('betald', 'tvist') then coalesce(b.stripe_minuter, b.duration_min)
            else 0
          end
          + coalesce((select pt.minuter from public.pass_tillagg pt
                       where pt.booking_id = b.id and pt.status in ('betald', 'tvist')), 0)
          + tb.bank as betalda) t
 where b.status = 'completed';

comment on column public.passunderlag.fakturerad is
  'Alltid falsk sedan 2026-10-21 (fakturan_tas_bort). Står kvar för vyerna som bygger på passunderlag.';


-- ---------- 5. larmen ----------
create or replace function public.avvikelser_rader()
 returns table(typ text, objekt_tabell text, objekt_id text, datum date, belopp_ore bigint, kund_id uuid, studiehjalpare_id uuid)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
-- fakturan_tas_bort (2026-10-21): inga fakturalarm och inga RUT-larm. RUT
-- drogs bara på fakturan.
declare
  manad    date := date_trunc('month', now() at time zone 'Europe/Stockholm')::date;
begin
  return query
  -- Genomfört pass utan rapport: räknas inte och betalas inte ut.
  select 'pass_utan_rapport', 'bookings', p.id::text, p.wanted_date, null::bigint, p.parent_id, p.tutor_id
    from public.passunderlag p
   where p.fakturerbar and not p.har_rapport and not p.pa_underlag
  union all
  -- Rapport som inte hör till något pass.
  select 'fristaende_rapport', 'lesson_reports', r.id::text, r.lesson_date, null, null, r.tutor_id
    from public.lesson_reports r where r.booking_id is null
  -- Hölls och rapporterades, men familjen har inte betalat (Fas 14.2).
  -- Ingen datumgräns: det finns ingen dag då ett obetalt pass blir
  -- betalt av sig självt.
  union all
  select 'ej_betalt', 'bookings', p.id::text, p.wanted_date, null, p.parent_id, p.tutor_id
    from public.passunderlag p
   where p.fakturerbar and p.har_rapport
     and p.betalning_status in ('ingen', 'vantar', 'misslyckad')
     -- Fas 19.5: ett pass där rabatten täcker hela priset (första timmen
     -- bjuds) har ingenting att betala.
     and not (p.timpris_ore is not null
              and coalesce(p.rabatt_ore, 0) >= round((p.timpris_ore
                    + case when coalesce(p.antal_barn, 1) > 1 then coalesce(p.extra_ore, 0) else 0 end)
                    * (coalesce(p.debiterade_min, p.duration_min, 60) - coalesce(p.timbank_min, 0)) / 60.0))
  union all
  -- FAS 20.1. Betalt, drog över, tillägget obetalt.
  select 'tillagg_obetalt', 'bookings', p.id::text, p.wanted_date, null, p.parent_id, p.tutor_id
    from public.passunderlag p
   where p.fakturerbar and p.betalning_status = 'betald'
     and p.debiterade_min > p.betalda_min
     -- Fas 20.4: ett återbetalt tillägg är ett beslut, inte en skuld.
     and not exists (select 1 from public.pass_tillagg t
                      where t.booking_id = p.id and t.status = 'aterbetald')
  union all
  -- FAS 20.1. Betalt med kort för mer tid än passet höll.
  select 'betalt_for_lange', 'bookings', x.id::text, x.wanted_date, x.kvar, x.parent_id, x.tutor_id
    from (
      select p.id, p.wanted_date, p.parent_id, p.tutor_id,
             (b.betalt_ore - coalesce(b.aterbetald_ore, 0)
              - greatest(round((p.timpris_ore
                                + case when coalesce(p.antal_barn, 1) > 1 then coalesce(p.extra_ore, 0) else 0 end)
                               * p.debiterade_min / 60.0)
                         - coalesce(p.rabatt_ore, 0), 0))::bigint as kvar
        from public.passunderlag p
        join public.bookings b on b.id = p.id
       where p.betalning_status = 'betald' and b.klippkort_id is null and b.betalt_ore is not null
         and p.timpris_ore is not null
         and p.debiterade_min < coalesce(b.stripe_minuter, b.duration_min)
    ) x
   where x.kvar > 0
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
  select 'utbetalning_summa_fel', 'payouts', u.id::text, u.period, u.belopp_ore, null, u.tutor_id
    from public.payouts u
   where u.belopp_ore <> coalesce((select sum(l.belopp_ore) from public.payout_lines l where l.payout_id = u.id), 0);
end $function$;

create or replace function public.kontroll_ekonomiska_avvikelser()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
-- fakturan_tas_bort (2026-10-21): inga texter för fakturan och RUT.
declare
  n integer := 0;
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  a record;
  rubrik text;
  text_ text;
  tabell text;
begin
  for a in select * from public.avvikelser_rader()
            where typ <> 'pass_utan_rapport'
  loop
    select t.rubrik, t.beskrivning into rubrik, text_ from (values
      ('fristaende_rapport',      'Rapport utan pass',        'Rapporten hör inte till något pass och kan därför varken räknas eller betalas ut. Koppla den till rätt pass.'),
      ('ej_betalt',               'Inte betalt',              'Passet hölls och rapporterades, men familjen har inte betalat det. Betala-knappen ligger kvar på passet i familjens vy.'),
      ('betald_men_avbokad',      'Betalt men avbokat',       'Passet är avbokat men familjen har betalat det. Villkoren lovar hela beloppet tillbaka för ett pass som aldrig hölls: återbetala under Kortbetalningar.'),
      ('ej_utbetalt',             'Inte utbetalt',            'Klart för underlag, men månaden det hölls är slut.'),
      ('utbetalning_vantar',      'Utbetalning väntar',       'Underlaget är äldre än förra månaden och pengarna har inte gått iväg.'),
      ('utbetalning_misslyckad',  'Utbetalning misslyckades', 'Överföringen gick inte igenom. Ta reda på varför innan nästa körning.'),
      ('timpenning_saknas',       'Timpenning saknas',        'Passet kan inte betalas ut: varken studiehjälparen eller tjänsten har en ersättning.'),
      ('pass_utan_studiehjalpare','Pass utan studiehjälpare', 'Passet är genomfört men ingen studiehjälpare står på det.'),
      ('utbetalning_summa_fel',   'Utbetalningssumman stämmer inte','Underlagets belopp är inte summan av dess rader.')
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


-- ---------- 6. bokslutet, morgonmejlet och kontrollerna ----------
create or replace function public.manad_lage(p_manad date)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
-- fakturan_tas_bort (2026-10-21): inga nycklar för fakturan.
declare
  forsta date := date_trunc('month', p_manad)::date;
  sista  date := (date_trunc('month', p_manad) + interval '1 month')::date;
  svar   jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum ser bokslutet.';
  end if;

  select jsonb_build_object(
    'manad', forsta,
    'pagar', forsta >= date_trunc('month', now() at time zone 'Europe/Stockholm')::date,
    'bokslut', (select to_jsonb(m) - 'summering' - 'id' from public.manadsbokslut m where m.manad = forsta),
    'pass', (
      select jsonb_build_object(
        'bokade',      count(*) filter (where b.status <> 'cancelled'),
        'genomforda',  count(*) filter (where b.status = 'completed'),
        'avbokade',    count(*) filter (where b.status = 'cancelled'),
        'med_rapport', (select count(*) from public.passunderlag p
                         where p.wanted_date >= forsta and p.wanted_date < sista and p.har_rapport),
        'bokade_min',  coalesce(sum(b.duration_min) filter (where b.status = 'completed'), 0),
        'debiterade_min', (select coalesce(sum(p.debiterade_min), 0) from public.passunderlag p
                            where p.wanted_date >= forsta and p.wanted_date < sista),
        'lon_min',     (select coalesce(sum(p.lon_min), 0) from public.passunderlag p
                         where p.wanted_date >= forsta and p.wanted_date < sista),
        'avvikande',   (select count(*) from public.passunderlag p
                         where p.wanted_date >= forsta and p.wanted_date < sista
                           and p.debiterade_min <> p.duration_min))
        from public.bookings b
       where b.wanted_date >= forsta and b.wanted_date < sista),
    'kort', (
      select jsonb_build_object(
        'antal',        count(*),
        'betalt_ore',   coalesce(sum(b.betalt_ore), 0),
        'aterbetalt_ore', coalesce(sum(b.aterbetald_ore), 0),
        'avgift_ore',   coalesce(sum(b.stripe_avgift_ore), 0),
        'netto_ore',    coalesce(sum(b.stripe_netto_ore), 0),
        'utan_avgift',  count(*) filter (where b.stripe_avgift_ore is null))
        from public.bookings b
       where b.wanted_date >= forsta and b.wanted_date < sista
         and b.betalt_ore is not null and b.stripe_skarp is not false),
    'tillagg', (
      select jsonb_build_object(
        'antal', count(*),
        'betalt_ore', coalesce(sum(t.betalt_ore), 0),
        'aterbetalt_ore', coalesce(sum(t.aterbetald_ore), 0))
        from public.pass_tillagg t
        join public.bookings b on b.id = t.booking_id
       where b.wanted_date >= forsta and b.wanted_date < sista
         and t.status in ('betald', 'aterbetald', 'tvist') and t.stripe_skarp is not false),
    'test', (
      select count(*) from public.bookings b
       where b.wanted_date >= forsta and b.wanted_date < sista and b.stripe_skarp is false),
    'timmar', (
      select count(*) from public.bookings b
       where b.wanted_date >= forsta and b.wanted_date < sista
         and b.klippkort_id is not null and b.status <> 'cancelled'),
    'timbank', (
      select jsonb_build_object(
        'pass', count(*) filter (where u.sort = 'pass'),
        'pass_min', coalesce(sum(u.minuter) filter (where u.sort = 'pass'), 0),
        'overtid_min', coalesce(sum(u.minuter) filter (where u.sort = 'overtid'), 0))
        from public.timbank_uttag u
        join public.bookings b on b.id = u.booking_id
       where b.wanted_date >= forsta and b.wanted_date < sista and b.status <> 'cancelled'),
    'underlag', (
      select jsonb_build_object(
        'antal', count(*),
        'belopp_ore', coalesce(sum(u.belopp_ore), 0),
        'betalda', count(*) filter (where u.status = 'utbetald'))
        from public.payouts u where u.period = forsta),
    'larm', coalesce((
      select jsonb_agg(jsonb_build_object(
               'typ', a.typ, 'objekt_tabell', a.objekt_tabell, 'objekt_id', a.objekt_id,
               'datum', a.datum, 'belopp_ore', a.belopp_ore) order by a.datum, a.typ)
        from public.avvikelser_rader() a
       where a.datum >= forsta and a.datum < sista), '[]'::jsonb)
  ) into svar;

  return svar;
end $function$;

create or replace function intern.admin_att_gora()
 returns table(typ text, objekt_id text)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  -- fakturan_tas_bort (2026-10-21): inga fakturor att lägga in eller driva in.
  -- Ingen intresseanmälan (lead-notis mejlar den direkt) och ingen jobbansökan
  -- (triggern admin_ansokan_direkt mejlar den direkt): båda finns i Att göra i
  -- vyn, men ska inte komma en gång till i morgonmejlet.
  select 'sh_godkann'::text, t.id::text from public.tutor_profiles t where t.status = 'pending'
  -- Elevens egen matchning, inte familjens, och inte ett avidentifierat barn.
  union all
  select 'elev_utan_sh', s.id::text from public.students s
   where s.raderad_at is null
     and (s.matched_tutor_id is null or s.match_status is distinct from 'matched')
  union all
  select 'fraga', m.id::text from public.contact_messages m where m.hanterad_at is null
  union all
  select 'pass_saknar_rapport', b.id::text from public.bookings b
   where b.status not in ('cancelled', 'completed')
     and b.wanted_date < (now() at time zone 'Europe/Stockholm')::date
  union all
  select 'genomfort_utan_rapport', p.id::text from public.passunderlag p
   where p.fakturerbar and not p.har_rapport and not p.pa_underlag
  union all
  select 'utbetalning', u.id::text from public.payouts u where u.status in ('utkast', 'godkand')
  -- Bara här: rapporten är skriven men familjen har inte bekräftat den.
  union all
  select 'rapport_obekraftad', r.id::text from public.lesson_reports r
    join public.students s on s.id = r.student_id and s.raderad_at is null
   where not exists (select 1 from public.rapport_bekraftelser b where b.rapport_id = r.id)
  -- Bara här: det systemet själv lagt (kontrollerna, månadskörningens svar).
  union all
  select 'uppgift', u.id::text from public.uppgifter u
   where u.status in ('oppen', 'pagar') and u.skapad_av_typ in ('system', 'ai')
$function$;

create or replace function public.dagliga_kontroller()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
-- fakturan_tas_bort (2026-10-21): inga förfallna fakturor att påminna om.
declare
  a integer; b integer; d integer;
  fel jsonb := '[]'::jsonb;
begin
  begin a := public.kontroll_saknade_rapporter();
  exception when others then
    fel := fel || jsonb_build_object('kontroll', 'saknade_rapporter', 'fel', sqlerrm);
  end;
  begin b := public.kontroll_ekonomiska_avvikelser();
  exception when others then
    fel := fel || jsonb_build_object('kontroll', 'ekonomiska_avvikelser', 'fel', sqlerrm);
  end;
  begin d := public.uppfoljning_leads_och_ansokningar();
  exception when others then
    fel := fel || jsonb_build_object('kontroll', 'uppfoljningar', 'fel', sqlerrm);
  end;

  return jsonb_build_object(
    'kord', (now() at time zone 'Europe/Stockholm'),
    'saknade_rapporter', a,
    'ekonomiska_avvikelser', b,
    'uppfoljningar', d,
    'nya_uppgifter', coalesce(a, 0) + coalesce(b, 0) + coalesce(d, 0),
    'fel', fel);
end $function$;


-- ---------- 7. mejlen, raderingen och betygsgarantin ----------
create or replace function intern.betalsatt_kod(p_pass uuid)
 returns text
 language sql
 stable
 set search_path to 'public'
as $function$
  -- fakturan_tas_bort (2026-10-21): bara timmarna har en egen kod.
  select case
           when b.betalning_status = 'betald'
                and b.stripe_payment_intent_id is null
                and coalesce(b.betalt_ore, 0) = 0
                and (b.klippkort_id is not null or intern.timbank_betalt(b.id)) then 'timmar'
         end
    from public.bookings b
   where b.id = p_pass
$function$;

create or replace function intern.passet_bar_bokforing(b public.bookings)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  -- fakturan_tas_bort (2026-10-21): ingen fakturarad att fråga efter.
  select b.status = 'completed'
      or coalesce(b.betalning_status, 'ingen') <> 'ingen'
      or b.betalt_ore is not null or b.begart_ore is not null
      or b.klippkort_id is not null
      or b.stripe_session_id is not null or b.stripe_payment_intent_id is not null
      or b.stripe_charge_id is not null
      or intern.manad_stangd(b.wanted_date)
      or exists (select 1 from public.lesson_reports r where r.booking_id = b.id)
      or exists (select 1 from public.timbank_uttag u where u.booking_id = b.id)
      or exists (select 1 from public.pass_tillagg t where t.booking_id = b.id)
      or exists (select 1 from public.payout_lines l where l.booking_id = b.id)
      or exists (select 1 from public.stripe_tvister t where t.booking_id = b.id)
$function$;

create or replace function public.mitt_villkorslage()
 returns jsonb
 language sql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
  -- fakturan_tas_bort (2026-10-21): obetalda_fran gick med fakturan.
  select jsonb_build_object(
    'version', intern.villkor_version(),
    'godkant_at', (select g.godkant_at from public.villkor_godkannanden g
                    where g.anvandare = (select auth.uid()) and g.version = intern.villkor_version()),
    'tidigare', exists (select 1 from public.villkor_godkannanden g
                         where g.anvandare = (select auth.uid()) and g.version <> intern.villkor_version()))
$function$;

create or replace function public.ai_finns(p_tabell text, p_id uuid)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
-- fakturan_tas_bort (2026-10-21): invoices är inte längre en tabell AI:n pekar på.
declare
  ja boolean := false;
begin
  if p_id is null then return false; end if;

  case p_tabell
    when 'students' then
      select exists (select 1 from public.students s where s.id = p_id) into ja;
    when 'studiehjalpare' then
      -- Vyn matchningsunderlag visar bara godkända studiehjälpare,
      -- och det är just "godkänd" frågan gäller.
      select exists (select 1 from public.matchningsunderlag m where m.tutor_id = p_id) into ja;
    when 'leads' then
      select exists (select 1 from public.leads l where l.id = p_id) into ja;
    when 'bookings' then
      select exists (select 1 from public.bookings b where b.id = p_id) into ja;
    when 'payouts' then
      select exists (select 1 from public.payouts u where u.id = p_id) into ja;
    else
      return false;
  end case;

  return ja;
end $function$;

do $$
declare
  f       record;
  def     text;
  traffar integer;
  ny      text;
  forut   text[];
begin
  -- (funktion, gammal text, ny text, antal träffar), i den ordning de lappas.
  -- En funktion som bar 'fakturan_tas_bort' redan före blocket lappades vid
  -- en tidigare körning och hoppas över. Det avgörs en gång, före den första
  -- lappen: markören som sätts efter en funktions första lapp får inte
  -- stoppa dess andra (skydda_bokningsfalt har fyra, ai_verktyg tre).
  create temp table fakturan_lappar on commit drop as
    select * from (values
      -- skydda_bokningsfalt: familjen väljer inte längre betalsätt.
      (1, 'public.skydda_bokningsfalt()',
       E'  -- ---------- betalsättet (Fas 14.6) ----------\n'
       || E'  /* Familjen väljer faktura, eller kort igen, och i samma skrivning\n'
       || E'     ändras ingenting annat. Grenen står FÖRE låset på genomförda pass:\n'
       || E'     ett pass som hållits kan fortfarande betalas mot faktura. Se\n'
       || E'     filhuvudet i migrationen fas14_6. */\n'
       || E'  if new.betalning_status is distinct from old.betalning_status\n'
       || E'     and (to_jsonb(new) - ''betalning_status'') = (to_jsonb(old) - ''betalning_status'') then\n'
       || E'    if jag is distinct from old.parent_id then\n'
       || E'      raise exception using errcode = ''42501'',\n'
       || E'        message = ''Det är familjen som väljer hur passet betalas.'';\n'
       || E'    end if;\n'
       || E'    if old.status = ''cancelled'' then\n'
       || E'      raise exception using errcode = ''42501'',\n'
       || E'        message = ''Passet är avbokat och ska inte betalas.'';\n'
       || E'    end if;\n'
       || E'    if not old.fakturerbar then\n'
       || E'      raise exception using errcode = ''42501'',\n'
       || E'        message = ''Passet är undantaget och ska inte betalas.'';\n'
       || E'    end if;\n'
       || E'\n'
       || E'    if new.betalning_status = ''faktura'' then\n'
       || E'      if old.betalning_status not in (''ingen'', ''vantar'', ''misslyckad'') then\n'
       || E'        raise exception using errcode = ''42501'',\n'
       || E'          message = ''Passet är redan betalt, eller betalas redan på annat sätt.'';\n'
       || E'      end if;\n'
       || E'      if not intern.faktura_tillaten(jag) then\n'
       || E'        raise exception using errcode = ''42501'',\n'
       || E'          message = ''Faktura går inte att välja just nu. Betala med kort, eller skriv till oss.'';\n'
       || E'      end if;\n'
       || E'    elsif new.betalning_status = ''ingen'' and old.betalning_status = ''faktura'' then\n'
       || E'      if exists (select 1 from public.invoice_lines l where l.booking_id = old.id) then\n'
       || E'        raise exception using errcode = ''42501'',\n'
       || E'          message = ''Passet står redan på en faktura och betalas genom den.'';\n'
       || E'      end if;\n'
       || E'    else\n'
       || E'      raise exception using errcode = ''42501'',\n'
       || E'        message = ''Betalningen sätts när passet betalas, inte härifrån.'';\n'
       || E'    end if;\n'
       || E'\n'
       || E'    return new;\n'
       || E'  end if;\n',
       E'  -- ---------- betalsättet ----------\n'
       || E'  /* fakturan_tas_bort (2026-10-21): familjen väljer inte längre\n'
       || E'     betalsätt på passet. Betalningen sätts av webhooken, timmarna och\n'
       || E'     databasens egna vägar, aldrig härifrån. */\n'
       || E'  if new.betalning_status is distinct from old.betalning_status\n'
       || E'     and (to_jsonb(new) - ''betalning_status'') = (to_jsonb(old) - ''betalning_status'') then\n'
       || E'    raise exception using errcode = ''42501'',\n'
       || E'      message = ''Betalningen sätts när passet betalas, inte härifrån.'';\n'
       || E'  end if;\n',
       1),
      (2, 'public.skydda_bokningsfalt()',
       E'\n         Ett fakturapass går att avboka: det faktureras först när det\n'
       || E'         hållits, och ett avbokat pass hålls aldrig. */',
       E' */',
       1),
      (3, 'public.skydda_bokningsfalt()',
       E'         den betalningen. Faktura släpps igenom (Fas 14.6): fakturan\n'
       || E'         kommer efter månaden, så ett fakturapass hålls innan det är\n'
       || E'         betalt, per konstruktion. Ett pass Nextrum undantagit\n',
       E'         den betalningen. Ett pass Nextrum undantagit\n',
       1),
      (4, 'public.skydda_bokningsfalt()',
       E'and old.betalning_status not in (''betald'', ''tvist'', ''faktura'')',
       E'and old.betalning_status not in (''betald'', ''tvist'')',
       1),
      -- radering_underlag: en faktura gör inte längre raderingen till en avidentifiering.
      (5, 'intern.radering_underlag(text, uuid)',
       E'       or exists (select 1 from public.invoices i where i.parent_id = p_id)\n',
       E'',
       1),
      (6, 'intern.radering_underlag(text, uuid)',
       E',\n        ''fakturor'', (select count(*) from public.invoices i where i.parent_id = p_id));',
       E');',
       1),
      -- radera_person: fakturaspärren finns inte.
      (7, 'public.radera_person(text, uuid)',
       E'      delete from public.faktura_sparr where parent_id = p_id;\n',
       E'',
       1),
      -- betygsgaranti_underlag: inga sena fakturor.
      (8, 'public.betygsgaranti_underlag(uuid, integer)',
       E',\n      ''sena_fakturor'', coalesce((\n'
       || E'        select jsonb_agg(jsonb_build_object(''period'', i.period, ''forfaller'', i.forfaller,\n'
       || E'                                            ''betald'', (i.betald_at at time zone ''Europe/Stockholm'')::date)\n'
       || E'                         order by i.period)\n'
       || E'          from public.invoices i\n'
       || E'         where i.parent_id = familj and i.status <> ''makulerad''\n'
       || E'           and p.anmald is not null and i.period >= date_trunc(''month'', p.anmald)::date and i.period <= slut\n'
       || E'           and i.forfaller is not null\n'
       || E'           and (((i.betald_at at time zone ''Europe/Stockholm'')::date > i.forfaller)\n'
       || E'                or (i.betald_at is null and i.forfaller < idag))), ''[]''::jsonb)',
       E'',
       1),
      -- valj_kort: fakturan finns inte att byta från.
      (9, 'public.valj_kort(uuid, boolean)',
       E'Kort går inte att välja just nu. Betala efter passet, eller välj faktura.',
       E'Kort går inte att välja just nu. Betala efter passet.',
       1),
      (10, 'public.valj_kort(uuid, boolean)',
       E'  if b.betalning_status = ''faktura'' then\n'
       || E'    update public.bookings set betalning_status = ''ingen'' where id = p_bokning;\n'
       || E'    select * into b from public.bookings where id = p_bokning;\n'
       || E'  end if;\n',
       E'',
       1),
      -- AI-verktygen och uppgifterna pekar inte på invoices.
      (11, 'public.ai_verktyg(text, jsonb)',
       E'tabell not in (''leads'', ''students'', ''bookings'', ''invoices'', ''payouts'')',
       E'tabell not in (''leads'', ''students'', ''bookings'', ''payouts'')',
       1),
      (12, 'public.ai_verktyg(text, jsonb)',
       E'flagga_problem kräver objekt_id och en tabell: leads, students, bookings, invoices eller payouts.',
       E'flagga_problem kräver objekt_id och en tabell: leads, students, bookings eller payouts.',
       1),
      (13, 'public.ai_verktyg(text, jsonb)',
       E'          when ''invoices'' then ''AI: titta på en faktura''\n',
       E'',
       1),
      (14, 'public.skapa_uppgift(text, text, text, text, text, text, date, text)',
       E'''invoices'',''payouts''',
       E'''payouts''',
       1),
      -- Månadskörningens texter: underlagen, inga fakturautkast.
      (15, 'intern.manadskorning_vack(boolean)',
       E'så månadens underlag och fakturautkast ''\n',
       E'så månadens underlag ''\n',
       1),
      (16, 'intern.manadskorning_svar(boolean)',
       E'något underlag eller fakturautkast gick inte att spara.',
       E'något underlag gick inte att spara.',
       1),
      (17, 'public.skydda_bokningsfalt()',
       E'migrationen fas14_6a för hålet det här stänger. Faktura väljs\n'
       || E'       också på ett bokat pass, inte när det skapas: valet prövas i en\n'
       || E'       enda gren nedan, och en andra väg in hade varit en andra regel. */',
       E'migrationen fas14_6a för hålet det här stänger. */',
       1),
      -- Texten i uppgiften om ett oanvänt konto, och notistriggerns kommentar.
      (18, 'intern.konton_oanvanda()',
       E'Bokföringsunderlag (betalningar, underlag, ''\n'
       || E'        || ''fakturor) sparas ändå i sju år.',
       E'Bokföringsunderlag (betalningar och ''\n'
       || E'        || ''underlag) sparas ändå i sju år.',
       1),
      (19, 'public.notis_vid_pass()',
       E'    -- FAS 14.6. Samma sorts kod: mallen ska inte be en familj som valt\n'
       || E'    -- faktura att betala med kort.\n',
       E'    -- FAS 14.6. Samma sorts kod: mallen ska inte be en familj vars\n'
       || E'    -- timmar betalar passet att betala med kort.\n',
       1)
    ) v(nr, namn, gammalt, nytt, antal);

  select coalesce(array_agg(distinct l.namn), '{}') into forut
    from fakturan_lappar l
   where position('fakturan_tas_bort' in pg_get_functiondef(l.namn::regprocedure)) > 0;

  for f in select * from fakturan_lappar order by nr loop
    continue when f.namn = any (forut);
    def := pg_get_functiondef(f.namn::regprocedure);
    traffar := (length(def) - length(replace(def, f.gammalt, ''))) / length(f.gammalt);
    if traffar <> f.antal then
      raise exception 'fakturan_tas_bort, lapp %: % har texten % gånger, väntat %. Läs driften.',
        f.nr, f.namn, traffar, f.antal;
    end if;
    ny := replace(def, f.gammalt, f.nytt);
    -- Markören, så att lappen inte görs två gånger. Efter första raden
    -- med AS $function$, i funktionens kropp.
    if position('-- fakturan_tas_bort' in ny) = 0 then
      ny := regexp_replace(ny, E'(\\nAS \\$function\\$\\n?)', E'\\1-- fakturan_tas_bort (2026-10-21)\n');
    end if;
    execute ny;
  end loop;
end $$;


-- ---------- 8. funktionerna som bara fanns för fakturan gör ingenting ----------
-- Del 2 tar bort dem. Rättigheterna står kvar (create or replace). Har del
-- 2 redan körts skapas de inte igen: en ny funktion får EXECUTE för alla.
do $$
begin
  if to_regclass('public.invoices') is null then
    return;
  end if;

  execute $f$
create or replace function public.fakturera_obetalda(p_fore date, p_torr boolean default false)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- fakturan_tas_bort (2026-10-21): inga pass läggs på någon faktura. Den
-- gamla månadskörningen (fakturering v35) anropar funktionen varje natt
-- tills den nya versionen är driftsatt, och ska då inte få något svar
-- som skriver.
begin
  if coalesce(nullif(auth.role(), ''), 'service_role') <> 'service_role' then
    raise exception 'Bara månadskörningen anropar den här.' using errcode = '42501';
  end if;
  return '[]'::jsonb;
end $function$
$f$;

  execute $f$
create or replace function public.faktura_mojlig()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  -- fakturan_tas_bort (2026-10-21): fakturan går inte att välja.
  select false;
$function$
$f$;

  execute $f$
create or replace function intern.faktura_tillaten(p_foralder uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  -- fakturan_tas_bort (2026-10-21): fakturan går inte att välja.
  select false;
$function$
$f$;

  execute $f$
create or replace function public.paminnelse_forfallna_fakturor()
 returns integer
 language sql
 security definer
 set search_path to 'public'
as $function$
  -- fakturan_tas_bort (2026-10-21): inga fakturor att påminna om.
  select 0;
$function$
$f$;
end $$;


-- ---------- 9. vyerna för adminvyn och statistiken ----------
-- Fakturans kolumner står kvar som noll, så att adminvyns konsol och
-- ai_analys inte behöver skrivas om samtidigt som vyerna.
create or replace view public.admin_lage with (security_invoker = true) as
select (select count(*) from public.leads where leads.status = 'new') as nya_leads,
       (select count(*) from public.applications where applications.status = 'new') as nya_ansokningar,
       (select count(*) from public.tutor_profiles where tutor_profiles.status = 'pending') as vantande_studiehjalpare,
       (select count(*) from public.profiles
         where profiles.role = 'parent' and profiles.match_status = 'pending') as omatchade_familjer,
       (select count(*) from public.contact_messages where contact_messages.hanterad_at is null) as ohanterade_meddelanden,
       (select count(*) from public.bookings
         where bookings.status in ('requested', 'confirmed') and bookings.wanted_date >= current_date) as kommande_pass,
       (select count(*) from public.bookings where bookings.status = 'requested') as obesvarade_pass,
       0::bigint as obetalda_fakturor,
       0::numeric as obetalt_ore,
       (select count(*) from public.payouts where payouts.status in ('utkast', 'godkand')) as vantande_utbetalningar,
       (select coalesce(sum(payouts.belopp_ore), 0::numeric) from public.payouts
         where payouts.status in ('utkast', 'godkand')) as att_betala_ut_ore,
       (select count(*) from public.passunderlag p
         where p.fakturerbar and not p.har_rapport and not p.pa_underlag) as pass_utan_rapport,
       0::bigint as forfallna_fakturor,
       (select count(*) from public.uppgifter u where u.status in ('oppen', 'pagar')) as oppna_uppgifter,
       (select count(*) from public.uppgifter u
         where u.status in ('oppen', 'pagar')
           and u.forfallodag < (now() at time zone 'Europe/Stockholm')::date) as forsenade_uppgifter,
       (select count(*) from public.klientfel k where k.created_at > now() - interval '24 hours') as klientfel_24h,
       0::bigint as fakturor_att_lagga_in;

comment on view public.admin_lage is
  'Adminvyns tal. obetalda_fakturor, obetalt_ore, forfallna_fakturor och fakturor_att_lagga_in är noll sedan '
  '2026-10-21 (fakturan_tas_bort).';

create or replace view public.analys_ekonomi
with (security_invoker = true) as
with manader as (
  select date_trunc('month', p_1.wanted_date::timestamp with time zone)::date as manad
    from public.passunderlag p_1
   where p_1.har_rapport and not intern.utanfor_statistiken(p_1.parent_id) and not intern.utanfor_statistiken(p_1.tutor_id)
  union
  select date_trunc('month', u_1.period::timestamp with time zone)::date
    from public.payouts u_1
   where not intern.utanfor_statistiken(u_1.tutor_id)
  union
  select date_trunc('month', b.betald_at at time zone 'Europe/Stockholm')::date
    from public.bookings b
   where b.betald_at is not null and b.stripe_skarp is not false
     and not intern.utanfor_statistiken(b.parent_id) and not intern.utanfor_statistiken(b.tutor_id)
), pass as (
  select date_trunc('month', p_1.wanted_date::timestamp with time zone)::date as manad,
         count(*) as genomforda_pass,
         coalesce(sum(p_1.duration_min), 0::bigint) as minuter,
         count(*) filter (where not p_1.pa_underlag) as ej_pa_underlag,
         count(*) filter (where p_1.fakturerbar and p_1.betalning_status in ('ingen', 'vantar', 'misslyckad')) as ej_betalda
    from public.passunderlag p_1
   where p_1.har_rapport and not intern.utanfor_statistiken(p_1.parent_id) and not intern.utanfor_statistiken(p_1.tutor_id)
   group by 1
), utb as (
  select date_trunc('month', u_1.period::timestamp with time zone)::date as manad,
         count(*) as underlag,
         coalesce(sum(u_1.belopp_ore), 0::numeric) as att_betala_ut_ore,
         coalesce(sum(u_1.belopp_ore) filter (where u_1.status = 'utbetald'), 0::numeric) as utbetalt_ore
    from public.payouts u_1
   where not intern.utanfor_statistiken(u_1.tutor_id)
   group by 1
), kort as (
  select date_trunc('month', b.betald_at at time zone 'Europe/Stockholm')::date as manad,
         count(*) as kortbetalningar,
         coalesce(sum(b.betalt_ore), 0::numeric) as kortbetalt_ore,
         coalesce(sum(b.aterbetald_ore), 0::numeric) as aterbetalt_ore
    from public.bookings b
   where b.betald_at is not null and b.stripe_skarp is not false
     and not intern.utanfor_statistiken(b.parent_id) and not intern.utanfor_statistiken(b.tutor_id)
   group by 1
)
select m.manad,
       coalesce(p.genomforda_pass, 0::bigint) as genomforda_pass,
       coalesce(p.minuter, 0::bigint) as minuter,
       0::bigint as ej_fakturerade,
       coalesce(p.ej_pa_underlag, 0::bigint) as ej_pa_underlag,
       0::bigint as fakturor,
       0::numeric as fakturerat_ore,
       0::numeric as betalt_ore,
       0::numeric as rut_ore,
       coalesce(u.underlag, 0::bigint) as underlag,
       coalesce(u.att_betala_ut_ore, 0::numeric) as att_betala_ut_ore,
       coalesce(u.utbetalt_ore, 0::numeric) as utbetalt_ore,
       coalesce(p.genomforda_pass, 0::bigint) + coalesce(u.underlag, 0::bigint)
         + coalesce(k.kortbetalningar, 0::bigint) as underlag_rader,
       coalesce(p.ej_betalda, 0::bigint) as ej_betalda,
       coalesce(k.kortbetalningar, 0::bigint) as kortbetalningar,
       coalesce(k.kortbetalt_ore, 0::numeric) as kortbetalt_ore,
       coalesce(k.aterbetalt_ore, 0::numeric) as aterbetalt_ore
  from manader m
  left join pass p on p.manad = m.manad
  left join utb u on u.manad = m.manad
  left join kort k on k.manad = m.manad;

comment on view public.analys_ekonomi is
  'Ekonomin per månad. ej_fakturerade, fakturor, fakturerat_ore, betalt_ore och rut_ore är noll sedan 2026-10-21 '
  '(fakturan_tas_bort): betalningarna står i kortbetalt_ore.';


-- ---------- 10. användarvillkoren ----------
-- Punkten om fakturan och meningarna om den är borta ur villkoren
-- (anvandarvillkor.html, båda språken). Alla får frågan igen.
create or replace function intern.villkor_version()
returns text
language sql
immutable
set search_path = pg_temp
as $$ select '2026-10-21'::text $$;
