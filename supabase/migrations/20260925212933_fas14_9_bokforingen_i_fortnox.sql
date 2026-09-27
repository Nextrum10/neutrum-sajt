-- ============================================================
-- NEXTRUM — Fas 14.9: bokföringen i Fortnox
--
-- Beslutet (Leo 2026-09-25): bokföringen, kundfakturorna och lönen
-- sköts i Fortnox i stället för i Wint, som blev för dyrt. Bytet avgör
-- inte om studiehjälparna är anställda: det är en egen fråga, och den
-- står i foretagsfakta.studiehjalpare_form.
--
-- INGEN KOPPLING, MED FLIT. Flödet från Fas 14.6 är detsamma, bara i
-- Fortnox: månadskörningen skapar ett utkast per familj som valt
-- faktura, admin lägger in det i Fortnox för hand, skriver in
-- fakturanumret från Fortnox och förfallodagen här, och markerar
-- fakturan betald när Fortnox visar det. Fortnox skickar fakturan, och
-- påminnelserna i Fortnox ställs utan avgift: villkoren nämner ingen,
-- så ingen får tas ut. Fortnox har ett dokumenterat API, så en koppling
-- för fakturor och lönetransaktioner går att bygga senare. Den byggs
-- först när handarbetet faktiskt kostar tid, för en koppling mot
-- bokföringen som går sönder tyst är värre än ingen.
--
-- Fortnox får därför ingen rad i integrationer, av samma skäl som Wint
-- inte fick någon i Fas 14.8: det finns ingen koppling att rapportera
-- status för. Fas 14.8 tog bort den aldrig kopplade Fortnox-kopplingen
-- (fortnox_token) när bokföringen skulle ligga i Wint. Den kommer inte
-- tillbaka här.
--
--
-- VAD SOM ÄNDRAS
--
-- 1. invoices.wint_fakturanummer heter fortnox_fakturanummer, med sitt
--    check-villkor och sitt unika index. Samma regel, samma index. Ingen
--    faktura har ett nummer än, och vakten först ser till att det
--    stämmer: ett nummer från Wint i en kolumn som heter Fortnox hade
--    varit ett nummer som ingen hittar i Fortnox.
--
-- 2. invoices_audit loggar kolumnen under det nya namnet.
--    logga_andring() plockar kolumnerna ur triggerns argument med
--    k = any(kolumner). Stod det gamla namnet kvar hade fakturanumret
--    tyst slutat loggas, och en ändring av bara numret hade inte gett
--    någon rad alls.
--
-- 3. Flaggan faktura säger Fortnox i vantar_pa. stampla_flaggan()
--    skriver tillbaka de gamla texterna vid VARJE update, inte bara när
--    en vy slår om flaggan: texterna ägs av migrationerna, och triggern
--    ser inte skillnad på en migration och en vy. Den stängs därför av
--    runt just den här raden och slås på direkt efter, i samma
--    transaktion. Stämpeln sätts för hand, för det är triggern som
--    annars sätter den.
--
-- 4. Tre funktioner nämner Wint: avvikelser_rader (två kommentarer),
--    kontroll_ekonomiska_avvikelser (två uppgiftstexter och en rubrik)
--    och paminnelse_forfallna_fakturor (kolumnen och två meningar i
--    uppgiften). De står här i sin helhet, eftersom create or replace
--    kräver det, hämtade ur driften med pg_get_functiondef. Det enda som
--    skiljer är Wint → Fortnox och kolumnnamnet. create or replace
--    behåller ägaren, EXECUTE-rättigheterna (bara postgres och
--    service_role) och kommentaren, så inga grants skrivs här.
--
-- Uppgifter som redan skapats med den gamla texten skrivs inte om. Det
-- fanns inga när utkastet skrevs, och nycklarna är desamma, så en ny
-- kontroll skapar ingen dubblett.
--
--
-- ORDNINGEN
--
-- Vakterna först: numren, och att de tre funktionerna och flaggans
-- vantar_pa ser ut som när utkastet skrevs. Har någon ändrat en av dem
-- i driften sedan dess hade create or replace, eller updaten av
-- flaggan, skrivit över den ändringen tyst.
--
-- lock_timeout: rename och trigger tar ACCESS EXCLUSIVE på invoices.
-- Håller något annat ett lås där ska migrationen ge upp och rullas
-- tillbaka, inte stå i kö medan varje läsning av invoices köar bakom
-- den och vyerna hänger.
--
-- Adminvyn och föräldravyn läser kolumnen under det nya namnet; ingen
-- edge function läser den. PostgREST läser om schemat av sig själv
-- efter DDL (pgrst_ddl_watch), men mellan migrationen och
-- driftsättningen av vyerna frågar den ena sidan efter ett namn som
-- den andra inte har, och får ett fel. Föräldravyn hämtar fakturorna
-- vid varje start: felet hamnar i konsolen och vyn ritar som om det
-- inte fanns några. Det stämmer i dag, för det finns ingen faktura och
-- flaggan faktura står av. Kör migrationen och driftsätt vyerna i
-- samma arbetspass.
-- ============================================================

set local lock_timeout = '5s';

-- ---------- vakterna ----------
do $$
begin
  if exists (select 1 from public.invoices where wint_fakturanummer is not null) then
    raise exception 'invoices har fakturanummer från Wint. De är inte nummer i Fortnox: bestäm vad som gäller för de fakturorna, och kör sedan om.';
  end if;

  -- stampla_flaggan fryser texten, så bara en migration kan ändra den,
  -- och updaten nedan skriver över hela. md5 hämtad ur driften när
  -- utkastet skrevs.
  if (select md5(vantar_pa) from public.flaggor where kod = 'faktura')
     is distinct from '8a3d9b9e0e95d84aea5623458a6b149c' then
    raise exception 'flaggor.faktura.vantar_pa har ändrats sedan Fas 14.9 skrevs. Hämta texten på nytt och byt Wint mot Fortnox i den.';
  end if;

  -- md5 av pg_get_functiondef, hämtad ur driften när utkastet skrevs.
  if md5(pg_get_functiondef('public.avvikelser_rader()'::regprocedure)) <> '34bce1b0a3158e191c3605be448df3e6' then
    raise exception 'public.avvikelser_rader har ändrats sedan Fas 14.9 skrevs. Hämta den på nytt och gör bytet Wint → Fortnox i den versionen.';
  end if;
  if md5(pg_get_functiondef('public.kontroll_ekonomiska_avvikelser()'::regprocedure)) <> '277b322fff1ef9d8d0f59936c81381a3' then
    raise exception 'public.kontroll_ekonomiska_avvikelser har ändrats sedan Fas 14.9 skrevs. Hämta den på nytt och gör bytet Wint → Fortnox i den versionen.';
  end if;
  if md5(pg_get_functiondef('public.paminnelse_forfallna_fakturor()'::regprocedure)) <> '2278396192f64fcd1887ed3595a93c78' then
    raise exception 'public.paminnelse_forfallna_fakturor har ändrats sedan Fas 14.9 skrevs. Hämta den på nytt och gör bytet Wint → Fortnox i den versionen.';
  end if;
end $$;


-- ---------- 1. kolumnen ----------
alter table public.invoices rename column wint_fakturanummer to fortnox_fakturanummer;

-- Villkoret och indexet pekar på kolumnen, inte på namnet, och följer
-- med av sig själva. Namnen byts så att ett fel i driften säger rätt
-- system.
alter table public.invoices
  rename constraint invoices_wint_fakturanummer_check to invoices_fortnox_fakturanummer_check;
alter index public.invoices_wint_fakturanummer_key rename to invoices_fortnox_fakturanummer_key;

-- Kommentaren säger bara hur det är nu. Historien står i filhuvudet
-- ovan, och vakten sist kräver att ingen kommentar nämner Wint.
comment on column public.invoices.fortnox_fakturanummer is
  'Numret fakturan fick i Fortnox (Fas 14.6, i Fortnox sedan Fas 14.9). Skrivs av admin när '
  'fakturan lagts in där. Det är det familjen ser, och det Fortnox och banken känner igen.';


-- ---------- 2. auditen ----------
-- Samma trigger som i driften, med kolumnen under sitt nya namn.
drop trigger if exists invoices_audit on public.invoices;
create trigger invoices_audit
  after insert or delete or update on public.invoices
  for each row execute function public.logga_andring(
    'faktura', 'id', 'parent_id', 'period', 'status', 'belopp_ore', 'rut_ore', 'rut_ar', 'valuta',
    'forfaller', 'skickad_at', 'betald_at', 'stripe_invoice_id', 'fortnox_fakturanummer');


-- ---------- 3. flaggan faktura ----------
-- flaggor_stampla fryser beskrivning och vantar_pa vid varje update.
-- Av bara runt den här raden. flaggor_audit rörs inte: den loggar bara
-- när aktiv ändras, och det gör den inte här.
alter table public.flaggor disable trigger flaggor_stampla;

update public.flaggor
   set vantar_pa = 'Bolaget är registrerat och har Fortnox med bankgiro. Villkoren, prissidan, FAQ:n, '
                || 'maskoten, mejlen och /en/ säger att faktura finns, med tio dagars betalningstid och utan '
                || 'avgift, och villkoren beskriver ångerrätten (DEPLOY-BETALNING.md 9.11). Befintliga '
                || 'kontohavare har fått beskedet 30 dagar i förväg. Påminnelserna i Fortnox tar ingen avgift.',
       -- Det triggern annars hade satt: raden ändrades nu, och av en
       -- migration, inte av en person.
       uppdaterad    = now(),
       uppdaterad_av = null
 where kod = 'faktura';

alter table public.flaggor enable trigger flaggor_stampla;


-- ---------- 4. funktionerna ----------
-- Ordagrant ur driften (pg_get_functiondef), med bara Wint → Fortnox
-- och kolumnnamnet bytta. Diffen ligger bredvid utkastet.

CREATE OR REPLACE FUNCTION public.avvikelser_rader()
 RETURNS TABLE(typ text, objekt_tabell text, objekt_id text, datum date, belopp_ore bigint, kund_id uuid, studiehjalpare_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- två gånger: kreditera raden i Fortnox.
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
  -- Utkast som aldrig lagts in i Fortnox.
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

CREATE OR REPLACE FUNCTION public.kontroll_ekonomiska_avvikelser()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      ('betald_och_fakturerad',   'Betalt två gånger',        'Passet är betalt med kort och står dessutom på en faktura. Kreditera raden i Fortnox, så att familjen inte betalar två gånger.'),
      ('betald_men_avbokad',      'Betalt men avbokat',       'Passet är avbokat men familjen har betalat det. Villkoren lovar hela beloppet tillbaka för ett pass som aldrig hölls: återbetala under Kortbetalningar.'),
      ('ej_utbetalt',             'Inte utbetalt',            'Klart för underlag, men månaden det hölls är slut.'),
      ('faktura_gammalt_utkast',  'Faktura inte i Fortnox',   'Fakturan har stått som utkast i över en vecka. Lägg in den i Fortnox och skriv in fakturanumret under Ekonomi → Fakturor, eller ta bort utkastet.'),
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

CREATE OR REPLACE FUNCTION public.paminnelse_forfallna_fakturor()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n integer := 0;
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  f record;
begin
  for f in
    select i.id, i.forfaller, i.belopp_ore, i.fortnox_fakturanummer
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
           || case when f.fortnox_fakturanummer is not null then ' ' || f.fortnox_fakturanummer else '' end
           || ' är skickad, obetald och förfallodagen har passerat ('
           || to_char(f.forfaller, 'YYYY-MM-DD') || ', '
           || to_char(round(f.belopp_ore / 100.0), 'FM999G999') || ' kr). '
           || 'Se efter i Fortnox om den är betald. Är den det: markera den betald under '
           || 'Ekonomi → Fakturor. Annars skickas påminnelsen från Fortnox, utan avgift: '
           || 'ingen påminnelseavgift står i villkoren.',
         'invoices', f.id::text,
         idag + 1) is not null
    then n := n + 1;
    end if;
  end loop;
  return n;
end $function$;


-- ---------- vakten efteråt ----------
-- Fångar ett fel i utkastet innan det blir sant i driften: då rullas
-- hela migrationen tillbaka i stället för att hälften står kvar.
do $$
begin
  if (select tgenabled from pg_trigger
       where tgrelid = 'public.flaggor'::regclass and tgname = 'flaggor_stampla') is distinct from 'O' then
    raise exception 'flaggor_stampla är inte påslagen igen.';
  end if;
  if not exists (select 1 from public.flaggor
                  where kod = 'faktura' and vantar_pa ~ 'Fortnox' and vantar_pa !~* 'wint') then
    raise exception 'Flaggan faktura säger inte Fortnox i vantar_pa.';
  end if;
  if pg_get_triggerdef((select oid from pg_trigger
                         where tgrelid = 'public.invoices'::regclass and tgname = 'invoices_audit'))
     !~ '''fortnox_fakturanummer''' then
    raise exception 'invoices_audit loggar inte fortnox_fakturanummer.';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname in ('public', 'intern') and p.prosrc ~* 'wint') then
    raise exception 'En funktion i public eller intern nämner fortfarande Wint.';
  end if;
  if exists (select 1 from pg_description where description ~* 'wint') then
    raise exception 'En kommentar i databasen nämner fortfarande Wint.';
  end if;
end $$;


-- ---------- kontrollfrågan ----------
-- Kör efteråt. Varje kolumn ska vara true, och rattigheter ska vara
-- {postgres=X/postgres,service_role=X/postgres} för alla tre, som före
-- migrationen. md5-summorna är de nya definitionerna i
-- fas14_9_bokforingen_i_fortnox_diff.txt, räknade på pg_get_functiondef.
--
-- select
--   exists (select 1 from information_schema.columns
--            where table_schema = 'public' and table_name = 'invoices'
--              and column_name = 'fortnox_fakturanummer')                     as kolumnen,
--   not exists (select 1 from information_schema.columns
--                where column_name ~* 'wint')                                  as ingen_wintkolumn,
--   (select pg_get_constraintdef(oid) from pg_constraint
--     where conrelid = 'public.invoices'::regclass
--       and conname = 'invoices_fortnox_fakturanummer_check')
--     = 'CHECK (((fortnox_fakturanummer IS NULL) OR (fortnox_fakturanummer ~ ''^[A-Za-z0-9-]{1,30}$''::text)))'
--                                                                             as villkoret,
--   pg_get_indexdef('public.invoices_fortnox_fakturanummer_key'::regclass)
--     = 'CREATE UNIQUE INDEX invoices_fortnox_fakturanummer_key ON public.invoices USING btree (fortnox_fakturanummer) WHERE (fortnox_fakturanummer IS NOT NULL)'
--                                                                             as indexet,
--   (select pg_get_triggerdef(oid) from pg_trigger
--     where tgrelid = 'public.invoices'::regclass and tgname = 'invoices_audit')
--     ~ '''stripe_invoice_id'', ''fortnox_fakturanummer''\)$'                as auditen,
--   (select tgenabled from pg_trigger
--     where tgrelid = 'public.flaggor'::regclass and tgname = 'flaggor_stampla') = 'O'
--                                                                             as stamplingen_pa,
--   (select md5(vantar_pa) from public.flaggor where kod = 'faktura')
--     = '684588624fab629b485be2dfea63ec5d'                                    as flaggan,
--   md5(pg_get_functiondef('public.avvikelser_rader()'::regprocedure))
--     = '4553f77090ca766d8320542a28c329cd'                                    as avvikelser_rader,
--   md5(pg_get_functiondef('public.kontroll_ekonomiska_avvikelser()'::regprocedure))
--     = '4e91e940dc2fb727b215b9a5db91308f'                                    as kontroll_ekonomiska_avvikelser,
--   md5(pg_get_functiondef('public.paminnelse_forfallna_fakturor()'::regprocedure))
--     = '0ae2d35726aa723ce97850b0aaeb37bd'                                    as paminnelse_forfallna_fakturor,
--   (select count(*) from pg_proc where prosrc ~* 'wint')
--   + (select count(*) from pg_description where description ~* 'wint')
--   + (select count(*) from pg_trigger where pg_get_triggerdef(oid) ~* 'wint')
--   + (select count(*) from pg_constraint where conname ~* 'wint' or pg_get_constraintdef(oid) ~* 'wint')
--   + (select count(*) from pg_class where relname ~* 'wint')
--   + (select count(*) from public.flaggor where (beskrivning || coalesce(vantar_pa, '')) ~* 'wint')
--     = 0                                                                     as inget_wint_kvar,
--   not exists (select 1 from information_schema.tables
--                where table_name = 'fortnox_token')                           as ingen_fortnox_token,
--   not exists (select 1 from public.integrationer
--                where tjanst = 'fortnox')                                      as ingen_integrationsrad,
--   (select string_agg(p.proname || '=' || coalesce(p.proacl::text, '(förval)'), ', ' order by p.proname)
--      from pg_proc p
--     where p.oid in ('public.avvikelser_rader()'::regprocedure,
--                     'public.kontroll_ekonomiska_avvikelser()'::regprocedure,
--                     'public.paminnelse_forfallna_fakturor()'::regprocedure)) as rattigheter;
