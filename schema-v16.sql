-- ============================================================
-- NEXTRUM — schema v16
-- Stänger två informationsläckor och tystar två riktiga varningar.
--
-- Körs i Supabase SQL Editor. Additiv och idempotent: den byter ut
-- fyra funktionskroppar och rör inte en enda policy, tabell eller
-- rad data.
-- ============================================================


-- ============================================================
-- 1. is_admin — svarar bara om dig själv
--
-- Bakgrund: det finns EN is_admin, med default-argument. Alla ~30
-- policies anropar is_admin() utan argument, vilket är samma
-- funktion med uid = auth.uid(). Den är SECURITY DEFINER och ligger
-- i public, så PostgREST exponerar den på /rest/v1/rpc/is_admin —
-- och därmed kunde vem som helst, utan att logga in, fråga
--
--     POST /rest/v1/rpc/is_admin {"uid": "<någons id>"}
--
-- och få veta om den personen är admin.
--
-- Att återkalla EXECUTE hade låst ute alla: policyuttryck körs med
-- den frågande rollens rättigheter, så varje SELECT mot varje
-- skyddad tabell hade dött på "permission denied for function".
-- Att flytta funktionen till ett eget schema hade betytt att skriva
-- om fyrtio policyuttryck i en transaktion mot produktion.
--
-- Den här vägen är billigare och lika tät: funktionen svarar om dig
-- själv, eller om vem som helst om DU är admin. Anrop om någon
-- annan svarar false oavsett sanning.
--
-- Uppslaget på auth.uid() är inte rekursivt — det läser profiles
-- direkt, samma tabell, och funktionen är redan SECURITY DEFINER så
-- RLS gäller inte inuti den.
-- ============================================================
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce((
    select p.is_admin
    from public.profiles p
    where p.id = uid
      and (
        uid is not distinct from auth.uid()
        or coalesce((select a.is_admin from public.profiles a where a.id = auth.uid()), false)
      )
  ), false)
$function$;


-- ============================================================
-- 2. ar_matchade — svarar bara om dig och din motpart
--
-- Samma sorts läcka: två uuid in, ett ja eller nej ut, utan att
-- den som frågar behöver ha med saken att göra. Studiehjälparnas
-- id:n ligger dessutom framme på startsidan, eftersom godkända
-- profiler är publika.
--
-- Enda anroparen är insert-policyn på messages, och där är den som
-- skriver alltid antingen föräldern eller studiehjälparen i tråden:
--
--   sender_id = auth.uid()
--   and (auth.uid() = parent_id or auth.uid() = tutor_id)
--   and ar_matchade(parent_id, tutor_id)
--
-- Villkoret nedan är alltså redan uppfyllt där det används.
-- ============================================================
create or replace function public.ar_matchade(parent_uuid uuid, tutor_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(
    exists (
      select 1 from public.profiles p
      where p.id = parent_uuid
        and p.matched_tutor_id = tutor_uuid
        and p.match_status = 'matched'
    )
    and (
      auth.uid() = parent_uuid
      or auth.uid() = tutor_uuid
      or coalesce((select a.is_admin from public.profiles a where a.id = auth.uid()), false)
    ),
    false)
$function$;

-- Ytterhöljet av coalesce är inte pynt. Utan det svarar funktionen
-- NULL i stället för false för en utloggad besökare, eftersom
-- auth.uid() då är null och null = parent_uuid är null. I ett
-- policyuttryck behandlas NULL som falskt, så säkerheten hade hållit
-- ändå — men en funktion som lovar boolean ska svara ja eller nej.


-- ============================================================
-- 3. Låst search_path på de två som saknade den
--
-- Utan SET search_path avgörs det av den som anropar vilka
-- scheman som genomsöks. För en SECURITY INVOKER-funktion är det
-- mindre allvarligt än för en DEFINER, men båda används i
-- policyuttryck, och en funktion som ingår i ett rättighetsbeslut
-- ska inte kunna peka på något annat än det den skrevs för.
--
-- Allt i kropparna är antingen schemakvalificerat (storage.foldername)
-- eller ligger i pg_catalog (tsrange, make_time, split_part,
-- make_interval), som alltid genomsöks först. Tom sökväg ändrar
-- alltså ingenting i vad de gör.
-- ============================================================
create or replace function public.mapp_uuid(sokvag text)
returns uuid
language plpgsql
immutable
set search_path to ''
as $function$
declare u uuid;
begin
  begin
    u := (storage.foldername(sokvag))[1]::uuid;
  exception when others then
    return null;
  end;
  return u;
end $function$;

create or replace function public.pass_intervall(d date, t text, minuter integer)
returns tsrange
language sql
immutable
set search_path to ''
as $function$
  select tsrange(
    d + make_time(split_part(t, ':', 1)::int, split_part(t, ':', 2)::int, 0),
    d + make_time(split_part(t, ':', 1)::int, split_part(t, ':', 2)::int, 0)
      + make_interval(mins => coalesce(minuter, 60))
  );
$function$;


-- ============================================================
-- 4. De fyra som får stå kvar, och varför
--
-- Rådgivaren listar sex SECURITY DEFINER-funktioner som anropbara
-- utifrån. Fyra av dem läcker ingenting, eftersom de inte tar emot
-- något att fråga om — de svarar bara om den inloggade:
--
--   is_my_student(student_uuid)      jämför mot auth.uid()
--   is_my_matched_tutor(tutor_uuid)  jämför mot auth.uid()
--   is_matched_tutor_of(parent_uuid) jämför mot auth.uid()
--   ar_min_elev(elev_uuid)           jämför mot auth.uid()
--
-- Den som inte är inloggad får false på allt. Den som är inloggad
-- får svar om sina egna relationer, vilket hen redan ser i sin vy.
-- De ligger kvar exponerade med flit, och rådgivarens varning för
-- dem är en varning om formen, inte om innehållet.
--
-- fortnox_token har RLS på utan en enda policy. Det är inte ett
-- misstag utan hela poängen: tabellen håller en OAuth-token, och
-- den ska bara nås av service_role, som går förbi RLS. En policy
-- hade öppnat den för någon.
-- ============================================================

comment on table public.fortnox_token is
  'OAuth-token mot Fortnox. RLS på utan policy med flit: bara service_role (som går förbi RLS) ska läsa den. Lägg inte till en policy.';


-- ============================================================
-- 5. synka_laxhjalpspris — återkallad EXECUTE
--
-- v14 tog bort EXECUTE från public på tio triggerfunktioner. Den
-- här missades, antagligen för att den kom till med tjanster-
-- tabellen efteråt.
--
-- PostgREST kan ändå inte anropa en triggerfunktion — försöket dör
-- på "trigger functions can only be called as triggers" — så
-- rådgivarens varning var aldrig något att utnyttja. Men en
-- rättighet som inte behövs ska inte finnas, och triggern kör
-- vidare oavsett: den ägs av tabellen, inte av den som skriver.
-- ============================================================
revoke execute on function public.synka_laxhjalpspris() from public;


-- ============================================================
-- 6. tjanstkoder_finns — får stå kvar
--
-- Den svarar på om en uppsättning tjänstekoder finns. Tabellen
-- tjanster har policyn "alla läser tjänster" med uttrycket true,
-- alltså är koderna redan publika. Funktionen lämnar inte ut något
-- som inte står att hämta direkt.
-- ============================================================
