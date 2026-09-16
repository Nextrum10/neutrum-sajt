-- ============================================================
-- NEXTRUM — schema v17, sökvägen och fortnox_token
--
-- ÄR APPLICERAD. Tredje gången två migrationer fått samma nummer
-- på var sin gren (se även v13 och v16). Den här satte sökvägar
-- och tog bort grants; schema-v17.sql flyttade notishemligheten
-- till en tabell. De rör inga gemensamma objekt.
--
-- FOTNOT: sökvägarna nedan är sedan överskrivna av schema-v16.sql
-- (informationsläckorna), som satte dem till tomt i stället —
-- strängare och bättre. Raderna här är alltså historik, inte det
-- som gäller.
-- TVÅ LÅS SOM STOD OLÅSTA
--
-- Körs efter schema-v16.sql. Idempotent, och ändrar ingenting
-- som syns i någon vy. Båda punkterna kommer från Supabases egen
-- databaslinter (2026-09-15), inte från en bugg någon märkt av.
--
--
-- 1. SÖKVÄGEN I TVÅ FUNKTIONER
--
-- mapp_uuid() och pass_intervall() saknade `search_path`. En
-- funktion utan satt sökväg slår upp sina egna anrop i den sökväg
-- den som ANROPAR den råkar ha. För en SECURITY DEFINER-funktion
-- är det en känd väg till rättighetseskalering; de här två är
-- SECURITY INVOKER, så det är hängslen snarare än bälte — men
-- pass_intervall sitter i ett GiST-index på bookings, och ett
-- index vars uttryck kan betyda olika saker vid olika anrop är en
-- dålig idé oavsett rättigheter.
--
-- Sökvägen sätts som metadata. Funktionskropparna rörs inte, så
-- indexet bookings_ingen_overlapp påverkas inte och behöver inte
-- byggas om.
--
--
-- 2. BORDSRÄTTIGHETERNA PÅ fortnox_token
--
-- Tabellen har RLS påslaget och noll policyer. Det är MED FLIT:
-- en tabell med ett API-token ska inte kunna läsas av någon som
-- kommer via PostgREST, bara av edge-funktionerna som går in med
-- service_role och därmed förbi RLS.
--
-- Men anon och authenticated hade fortfarande Supabases
-- standardgrants på bordet. RLS stoppar dem idag. Den dagen
-- någon lägger till en policy "bara för att kunna läsa status"
-- öppnas hela tabellen, och det är precis den sortens ändring
-- som görs i förbifarten. Grants bort = två lås i stället för
-- ett, och nästa policy räcker inte längre för att läcka token.
-- ============================================================


-- ============================================================
-- 1. SÖKVÄGEN
-- ============================================================

-- mapp_uuid läser storage.foldername, alltså måste storage stå med.
alter function public.mapp_uuid(text)
  set search_path = pg_catalog, storage, public;

-- pass_intervall använder bara pg_catalog (make_time, make_interval,
-- split_part, tsrange). public står med för typerna i signaturen.
alter function public.pass_intervall(date, text, integer)
  set search_path = pg_catalog, public;


-- ============================================================
-- 2. fortnox_token
-- ============================================================

revoke all on public.fortnox_token from anon;
revoke all on public.fortnox_token from authenticated;

comment on table public.fortnox_token is
  'Fortnox OAuth-token. RLS på, noll policyer, och inga grants till anon eller authenticated — med flit. Läses bara av edge-funktionen ekonomi, som går in med service_role och därmed förbi RLS. Lägg ALDRIG till en policy här.';


-- ============================================================
-- EFTERÅT
--
--   select proname, proconfig from pg_proc
--   where proname in ('mapp_uuid','pass_intervall');
--   -- båda ska visa en search_path-rad
--
--   select grantee from information_schema.role_table_grants
--   where table_name = 'fortnox_token';
--   -- bara postgres och service_role ska stå kvar
--
--
-- KVAR, MEDVETET INTE GJORT HÄR
--
-- Lintern varnar också för att sex SECURITY DEFINER-funktioner
-- (is_admin, is_my_student, is_my_matched_tutor,
-- is_matched_tutor_of, ar_min_elev, ar_matchade) går att anropa
-- som RPC av vem som helst. Fyra av dem jämför mot auth.uid() och
-- berättar alltså bara om anroparen själv. Två gör det inte:
-- is_admin(uid) och ar_matchade(parent, tutor) svarar ja eller nej
-- om ANDRAS id:n — fast bara för den som redan har ett internt
-- uuid, som inte står någonstans publikt.
--
-- Rätt åtgärd är att flytta dem till ett schema PostgREST inte
-- exponerar. Det går inte att göra i förbifarten: is_admin ensam
-- står i 31 policyer, och en policy som pekar på en funktion som
-- flyttat slutar släppa igenom någon alls. Den migrationen ska
-- skrivas och verifieras för sig, inte klämmas in här.
-- ============================================================
