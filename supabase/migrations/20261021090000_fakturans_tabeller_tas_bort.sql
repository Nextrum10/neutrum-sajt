-- ============================================================
-- Fakturan tas bort, del 2 av 2: tabellerna och funktionerna (2026-10-21)
--
-- TA EN BACKUP FÖRST. Den här filen droppar invoices, invoice_lines,
-- faktura_sparr och intern.kassan_oppnad, och det som bara fanns för dem.
-- En droppad tabell kommer bara tillbaka ur en backup (Database →
-- Backups i Supabase, eller pg_dump av de fyra tabellerna).
--
-- Körs för hand, efter del 1 (fakturan_tas_bort) och efter att
-- fakturering, stripe-checkout, stripe-webhook, ekonomi och drift är
-- driftsatta utan fakturan (DEPLOY-BETALNING.md 9.18). Del 1 lämnar
-- tabellerna orörda men oanvända, så det går att vänta med den här så
-- länge som helst. Filen är en transaktion: i SQL Editor är hela skriptet
-- ett anrop, och lokalt kör lokal-databas.sh den med -1. Stannar något
-- rullas allt tillbaka.
--
--   0. Vakten: del 1 är körd, och varje rad i tabellerna hör till
--      testkontot (namnet Leo Trikke) eller ett adminkonto, som i del 1.
--      Hör en rad till någon annan stannar filen, säger vems, och
--      tabellerna står kvar.
--      Ingen funktion utom de som droppas här nämner det som droppas.
--   1. Testkontots och adminkontonas fakturapass blir obetalda ('ingen'), och 'faktura' är
--      inte längre ett betalningsläge.
--   2. Vyerna ofakturerat och rut_underlag, triggern som skrev när en kassa
--      öppnades, och de fyra tabellerna. Inget cascade: beror något annat
--      på dem stannar filen.
--   3. Funktionerna som bara fanns för fakturan.
--   4. Strömbrytaren faktura tas bort ur flaggor. Villkoret
--      flaggor_faktura_av står kvar, så att den inte kan komma tillbaka på.
--
-- Står kvar: kolumnerna passunderlag.fakturerad (alltid falsk) och
-- admin_lage/analys_ekonomi:s fakturakolumner (alltid noll), för vyer och
-- AI-funktioner bygger på dem. bookings.fakturerbar är lönens och larmens
-- (ett pass som inte ska räknas), inte fakturans. RUT (rut_tak,
-- kund_skatteuppgifter och tjänsternas RUT-fält) rörs inte: RUT kan inte
-- slås på sedan Fas 14.2 (skydda_tjansteaktivering). Auditloggens rader om
-- fakturor står kvar; den går inte att ändra.
--
-- Filen går att köra igen: när tabellerna är borta gör den ingenting.
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 0. vakten ----------
do $$
declare
  fel   text[] := '{}';
  n     bigint;
  namn  text;
  agare text;
begin
  if to_regclass('public.invoices') is null then
    raise notice 'fakturans_tabeller_tas_bort: tabellerna är redan borta.';
    return;
  end if;

  -- Del 1 är körd: strömbrytaren är låst av, och passets betalningsläge
  -- sätts inte längre till faktura.
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.flaggor'::regclass and conname = 'flaggor_faktura_av')
     or position('fakturan_tas_bort' in pg_get_functiondef('public.fakturera_obetalda(date, boolean)'::regprocedure)) = 0 then
    raise exception 'Kör fakturan_tas_bort (del 1) först. Ingenting är ändrat.';
  end if;

  -- Testkontot är namnet Leo Trikke, och ett adminkonto räknas som test,
  -- som i del 1.
  create temp table if not exists faktura_testkonton on commit drop as
    select p.id from public.profiles p
     where lower(btrim(coalesce(p.full_name, ''))) = 'leo trikke'
    union
    select r.user_id from public.admin_roller r;

  select count(*) into n from public.invoices i
   where i.parent_id not in (select id from faktura_testkonton);
  if n > 0 then fel := fel || (n || ' fakturor')::text; end if;
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
    raise exception 'fakturans_tabeller_tas_bort: % tillhör någon annan än testkontot Leo Trikke och adminkontona (%). '
      'Ingenting är ändrat, och tabellerna står kvar.', array_to_string(fel, ', '), agare;
  end if;

  -- En funktion som nämner det som droppas slutar fungera när den körs,
  -- inte när den skapas: Postgres följer inte namnen i en funktionskropp.
  select string_agg(p.oid::regprocedure::text, ', ') into namn
    from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname in ('public', 'intern')
     and p.prosrc ~ '(invoices|invoice_lines|faktura_sparr|kassan_oppnad|ofakturerat|rut_underlag|faktura_tillaten|faktura_mojlig|fakturera_obetalda|paminnelse_forfallna_fakturor|obetalt_till_fakturan|obetalda_faktureras_fran|las_fakturabelopp|ocr_giltigt)'
     and p.oid not in (
       select x from unnest(array[
         to_regprocedure('public.fakturera_obetalda(date, boolean)'),
         to_regprocedure('public.faktura_mojlig()'),
         to_regprocedure('intern.faktura_tillaten(uuid)'),
         to_regprocedure('public.paminnelse_forfallna_fakturor()'),
         to_regprocedure('intern.obetalt_till_fakturan(public.bookings)'),
         to_regprocedure('intern.kassan_oppnades()'),
         to_regprocedure('intern.obetalda_faktureras_fran()'),
         to_regprocedure('public.las_fakturabelopp()'),
         to_regprocedure('intern.ocr_giltigt(text)')]) x
        where x is not null)
     -- Kommentarerna som del 1 lämnar efter sig.
     and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ '(invoices|invoice_lines|faktura_sparr|kassan_oppnad|ofakturerat|rut_underlag|faktura_tillaten|faktura_mojlig|fakturera_obetalda|paminnelse_forfallna_fakturor|obetalt_till_fakturan|obetalda_faktureras_fran|las_fakturabelopp|ocr_giltigt)';
  if namn is not null then
    raise exception 'fakturans_tabeller_tas_bort: % nämner fakturan. Skriv om dem först. Ingenting är ändrat.', namn;
  end if;
end $$;


-- ---------- 1. betalningsläget ----------
-- Bara testkontots och adminkontonas pass (vakten). Ett fakturapass som aldrig fakturerades
-- är obetalt, och ett som fakturerades betalades aldrig: inget gick till en
-- familj.
update public.bookings set betalning_status = 'ingen'
 where betalning_status = 'faktura';

alter table public.bookings drop constraint if exists bookings_betalning_status_check;
alter table public.bookings add constraint bookings_betalning_status_check
  check (betalning_status in ('ingen', 'vantar', 'betald', 'aterbetald', 'tvist', 'misslyckad'));


-- ---------- 2. vyerna, triggern och tabellerna ----------
drop view if exists public.ofakturerat;
drop view if exists public.rut_underlag;
drop trigger if exists bookings_kassan_oppnad on public.bookings;
drop table if exists public.invoice_lines;
drop table if exists public.invoices;
drop table if exists public.faktura_sparr;
drop table if exists intern.kassan_oppnad;


-- ---------- 3. funktionerna ----------
drop function if exists public.fakturera_obetalda(date, boolean);
drop function if exists public.faktura_mojlig();
drop function if exists intern.faktura_tillaten(uuid);
drop function if exists public.paminnelse_forfallna_fakturor();
drop function if exists intern.obetalt_till_fakturan(public.bookings);
drop function if exists intern.kassan_oppnades();
drop function if exists intern.obetalda_faktureras_fran();
drop function if exists public.las_fakturabelopp();
drop function if exists intern.ocr_giltigt(text);


-- ---------- 4. strömbrytaren ----------
delete from public.flaggor where kod = 'faktura';
