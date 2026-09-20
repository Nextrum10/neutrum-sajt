-- ============================================================
-- NEXTRUM — Fas 7.3c: fyra namngivna kontroller
--
-- Planen säger namngivna funktioner, inte en regelmotor. Skälet är
-- granskbarhet: en motor flyttar logiken till rader i en tabell som
-- ingen läser i en PR, och ingen minns varför en regel finns. Här är
-- varje kontroll en funktion med ett namn, ett syfte och ett test.
--
-- GEMENSAMMA REGLER
--  · Ingen av dem skickar något. De skapar UPPGIFTER, och en
--    människa avgör vad som ska hända. Ett mejl som gick iväg medan
--    ingen tittade går inte att ta tillbaka.
--  · Alla går genom skapa_uppgift, alltså med nyckel och utan
--    dubbletter. Att köra samma kontroll två gånger ska ge samma
--    läge, inte dubbla listor.
--  · Alla räknar datum i (now() at time zone 'Europe/Stockholm').
--    Cron kör i GMT, och ett dygn som börjar i fel tidszon ger fel
--    dag i uppgiftens titel och fel förfallodag.
--  · Ingen av dem schemaläggs här. De körs för hand med select
--    tills pg_cron finns, och det är med flit: en automation som
--    aldrig har körts synligt ska inte få sitt första försök i
--    tysthet klockan fem på morgonen.
--  · Titlarna bär ingen persondata. Raden pekas ut med
--    kopplad_tabell och kopplad_id, och namnen står i adminvyn.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Pass som varit men saknar rapport.
--
-- Läser bookings DIREKT, inte vyn passunderlag: den vyn visar bara
-- pass med status 'completed', och ett pass BLIR completed först när
-- rapporten skrivs (rapport_gor_passet_genomfort). Ett bekräftat pass
-- utan rapport syns alltså aldrig där — vilket är precis det vi
-- letar efter.
-- ------------------------------------------------------------
create or replace function public.kontroll_saknade_rapporter(p_timmar integer default 24)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n integer := 0;
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  r record;
begin
  for r in
    select b.id, b.wanted_date
      from public.bookings b
     where b.status = 'confirmed'
       and b.fakturerbar
       and b.wanted_date is not null
       and b.wanted_time is not null
       and upper(public.pass_intervall(b.wanted_date, b.wanted_time, b.duration_min))
           < (now() at time zone 'Europe/Stockholm') - make_interval(hours => greatest(p_timmar, 1))
       and not exists (select 1 from public.lesson_reports lr where lr.booking_id = b.id)
     order by b.wanted_date
  loop
    if public.skapa_uppgift(
         'Pass utan rapport ' || to_char(r.wanted_date, 'YYYY-MM-DD'),
         'kontroll:saknad_rapport:bookings:' || r.id::text,
         'kontroll',
         'Passet är bekräftat och har varit, men ingen rapport är skriven. Utan rapport '
           || 'räknas passet inte som genomfört: det faktureras inte och betalas inte ut. '
           || 'Öppna passet under Drift → Lektioner och koppla en rapport, eller markera '
           || 'passet som ej fakturerbart med en anledning.',
         'bookings', r.id::text,
         idag + 2) is not null
    then n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- ------------------------------------------------------------
-- 2. Ekonomiska avvikelser som kräver ett beslut.
--
-- Nyckeln är EXAKT densamma som knappen "Gör till uppgift" i
-- adminvyn använder (nextrum-admin-ekonomi.js: avvNyckel). Annars
-- blir en avvikelse två uppgifter: en som jobbet skapade och en som
-- någon klickade fram, och båda ser rätt ut.
--
-- Två typer hanteras av andra: pass_utan_rapport har en egen
-- kontroll ovan, och faktura_forfallen ägs av påminnelsen nedan.
-- ------------------------------------------------------------
create or replace function public.kontroll_ekonomiska_avvikelser()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
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
      ('fristaende_rapport',      'Rapport utan pass',        'Rapporten hör inte till något pass och kan därför varken faktureras eller betalas ut. Koppla den till rätt pass.'),
      ('ej_fakturerat',           'Inte fakturerat',          'Klart för faktura, men månaden det hölls är slut. Kör månadskörningen.'),
      ('ej_utbetalt',             'Inte utbetalt',            'Klart för underlag, men månaden det hölls är slut.'),
      ('faktura_gammalt_utkast',  'Gammalt fakturautkast',    'Fakturan har stått som utkast i över en vecka. Skicka den eller ta bort den.'),
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
end $$;

-- ------------------------------------------------------------
-- 3. Förfallna fakturor.
--
-- Skickar INGEN påminnelse. Den lägger en uppgift, och människan
-- trycker på knappen "Påminn" i adminvyn, som går genom
-- faktura-utskick med inloggning. Ett schema som mejlar kunder utan
-- godkännande är exakt det planen säger att vi inte ska bygga.
--
-- Använder avvikelsens nyckelformat, så att adminvyn visar
-- "Uppgift finns" på samma rad i stället för att erbjuda en till.
-- ------------------------------------------------------------
create or replace function public.paminnelse_forfallna_fakturor()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n integer := 0;
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  f record;
begin
  for f in
    select i.id, i.forfaller, i.belopp_ore
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
         'Fakturan är skickad, obetald och förfallodagen har passerat ('
           || to_char(f.forfaller, 'YYYY-MM-DD') || ', '
           || to_char(round(f.belopp_ore / 100.0), 'FM999G999') || ' kr). '
           || 'Öppna Ekonomi → Fakturor och skicka en påminnelse, eller kryssa i betald '
           || 'om pengarna kommit. Ingen påminnelse skickas automatiskt.',
         'invoices', f.id::text,
         idag + 1) is not null
    then n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- ------------------------------------------------------------
-- 4. Uppföljning av anmälningar och ansökningar.
--
-- Två steg med var sin nyckel. Delar de nyckel blockerar den första
-- uppföljningen den andra, och en anmälan som kontaktats en gång
-- försvinner ur kön för alltid.
-- ------------------------------------------------------------
create or replace function public.uppfoljning_leads_och_ansokningar(
  p_dagar_obesvarad integer default 2,
  p_dagar_efter_kontakt integer default 7
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n integer := 0;
  nu timestamptz := now();
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  r record;
begin
  for r in
    select l.id, 'obesvarad' as steg, l.created_at as sedan
      from public.leads l
     where l.status = 'new'
       and l.created_at < nu - make_interval(days => greatest(p_dagar_obesvarad, 1))
    union all
    select l.id, 'efter_kontakt', coalesce(l.kontaktad_at, l.created_at)
      from public.leads l
     where l.status = 'contacted'
       and coalesce(l.kontaktad_at, l.created_at)
           < nu - make_interval(days => greatest(p_dagar_efter_kontakt, 1))
  loop
    if public.skapa_uppgift(
         case r.steg
           when 'obesvarad' then 'Obesvarad intresseanmälan sedan ' || to_char(r.sedan, 'YYYY-MM-DD')
           else 'Kontaktad familj utan beslut sedan ' || to_char(r.sedan, 'YYYY-MM-DD')
         end,
         'uppfoljning:lead:' || r.id::text || ':' || r.steg,
         'uppfoljning',
         case r.steg
           when 'obesvarad' then 'Anmälan har legat obesvarad. Ring familjen eller bjud in dem, '
             || 'och markera anmälan som kontaktad så att den lämnar kön.'
           else 'Familjen är kontaktad men har varken blivit elev eller fått anmälan stängd. '
             || 'Följ upp, eller sätt status till stängd om det inte blir något.'
         end,
         'leads', r.id::text,
         idag + 1) is not null
    then n := n + 1;
    end if;
  end loop;

  for r in
    select a.id, 'obesvarad' as steg, a.created_at as sedan
      from public.applications a
     where a.status = 'new'
       and a.created_at < nu - make_interval(days => greatest(p_dagar_obesvarad, 1))
  loop
    if public.skapa_uppgift(
         'Obesvarad ansökan sedan ' || to_char(r.sedan, 'YYYY-MM-DD'),
         'uppfoljning:ansokan:' || r.id::text || ':' || r.steg,
         'uppfoljning',
         'Ansökan till studiehjälpare har legat obesvarad. Ta ställning under Rekrytering.',
         'applications', r.id::text,
         idag + 1) is not null
    then n := n + 1;
    end if;
  end loop;

  return n;
end $$;

-- ------------------------------------------------------------
-- En väg in för schemat: alla fyra i en körning, med ett svar som
-- går att läsa i cron.job_run_details.
-- ------------------------------------------------------------
create or replace function public.dagliga_kontroller()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  a integer; b integer; c integer; d integer;
begin
  a := public.kontroll_saknade_rapporter();
  b := public.kontroll_ekonomiska_avvikelser();
  c := public.paminnelse_forfallna_fakturor();
  d := public.uppfoljning_leads_och_ansokningar();
  return jsonb_build_object(
    'kord', (now() at time zone 'Europe/Stockholm'),
    'saknade_rapporter', a,
    'ekonomiska_avvikelser', b,
    'forfallna_fakturor', c,
    'uppfoljningar', d,
    'nya_uppgifter', a + b + c + d);
end $$;

revoke execute on function public.kontroll_saknade_rapporter(integer) from public, anon, authenticated;
revoke execute on function public.kontroll_ekonomiska_avvikelser() from public, anon, authenticated;
revoke execute on function public.paminnelse_forfallna_fakturor() from public, anon, authenticated;
revoke execute on function public.uppfoljning_leads_och_ansokningar(integer, integer) from public, anon, authenticated;
revoke execute on function public.dagliga_kontroller() from public, anon, authenticated;
