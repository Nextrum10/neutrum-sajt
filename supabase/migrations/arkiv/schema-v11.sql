-- ============================================================
-- NEXTRUM — schema v11
--
-- Körs efter schema-v10.sql. Tre saker som alla fanns som hål
-- mellan koden och databasen: sidan frågade efter något RLS aldrig
-- gav, formuläret laddade upp till en hink som inte fanns, och en
-- driftsatt funktion som ingenting anropade.
--
-- Del 1 och 2 ÄR redan applicerade i projektet ddkfiuvcppalutfulvbi.
-- Del 3 måste köras för hand i SQL Editor — se noten där.
-- ============================================================


-- ============================================================
-- 1. Publik vy: godkända studiehjälpare för startsidan
--
-- Startsidan hämtade tutor_profiles med en inbäddad join mot
-- profiles för att få namnet. Anonyma besökare får aldrig läsa
-- profiles (RLS släpper bara in egen rad, admin och matchad
-- motpart), så joinen kom alltid tillbaka som null och kortet
-- filtrerades bort. Inga riktiga studiehjälpare kunde visas —
-- bara de tre exempelkorten i markupen.
--
-- Lösningen är INTE en läspolicy på profiles. RLS är radbaserad,
-- inte kolumnbaserad — en policy som släpper fram namnet släpper
-- fram hela raden, alltså också e-post, telefon och
-- matched_tutor_id. Samma fälla som student_notes i v5.
--
-- security_invoker = false med flit: vyn körs som sin ägare och
-- passerar RLS på de underliggande tabellerna. Filtret på
-- status = 'approved' nedan är då det enda som avgör vad som syns.
--
-- Bara FÖRNAMNET publiceras. Studiehjälparna är ofta minderåriga
-- och hela namnet hör inte hemma på en öppen marknadssida. Det
-- följer också exempelkorten, som visar "Elsa, 19".
--
-- Bara första tecknet versaliseras. initcap() hade gjort "McKay"
-- till "Mckay", och att förstöra ett rätt skrivet namn är värre än
-- att låta ett litet "l" stå kvar.
-- ============================================================

create or replace view public.studiehjalpare_publika
with (security_invoker = false) as
select
  tp.id,
  upper(left(split_part(btrim(p.full_name), ' ', 1), 1))
    || substr(split_part(btrim(p.full_name), ' ', 1), 2) as fornamn,
  tp.age,
  tp.school,
  tp.city,
  tp.subjects,
  tp.grade_levels,
  tp.bio
from public.tutor_profiles tp
join public.profiles p on p.id = tp.id
where tp.status = 'approved'
  and btrim(coalesce(p.full_name, '')) <> '';

comment on view public.studiehjalpare_publika is
  'Godkända studiehjälpare för startsidan. Endast förnamn och de fält som ska vara publika. Ersätter den inbäddade joinen mot profiles, som RLS alltid nollade för anonyma besökare.';

revoke all on public.studiehjalpare_publika from public;
grant select on public.studiehjalpare_publika to anon, authenticated;


-- ============================================================
-- 2. Lagringshinken "cv"
--
-- Ansökningsformuläret på bli-studiehjalpare laddar upp ett
-- valfritt CV. Hinken har aldrig funnits, så uppladdningen
-- misslyckades tyst och ansökan sparades med en notering om att
-- filen skulle efterfrågas via mejl. Ingen fil har kommit fram.
--
-- PRIVAT, inte publik. Ett CV bär namn, adress, skola och ofta
-- personnummer. Med en publik hink räcker det att någon gissar
-- eller läcker adressen för att läsa vem som helsts ansökan.
-- Samma val som för material- och avatarhinkarna i v6.
--
-- Skrivning är öppen för anonyma, för formuläret är öppet och den
-- som söker har inget konto än. Det gör hinken skrivbar av vem som
-- helst, så gränserna är det som håller emot: fem megabyte och bara
-- dokumentformat. Läsning är stängd för alla utom service_role —
-- ansökningarna öppnas i Supabases Storage-vy.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cv', 'cv', false, 5242880,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vem som helst kan ladda upp cv" on storage.objects;
create policy "vem som helst kan ladda upp cv"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'cv');


-- ============================================================
-- 3. Databaswebhook: ny intresseanmälan -> lead-notis
--
--    ⚠ INTE APPLICERAD. Kör det här blocket i SQL Editor.
--    Byt först ut HEMLIGHETEN_HÄR mot samma sträng som du lägger
--    in som secreten NOTIS_HEMLIGHET på edge-funktionen.
--    Generera en med: openssl rand -hex 32
--
-- Funktionen lead-notis är driftsatt men ingenting anropar den.
-- Det här är avfyrningen. Motsvarar exakt det Database → Webhooks
-- bygger i gränssnittet: en trigger efter INSERT som lägger ett
-- HTTP-anrop i pg_nets kö. Alternativet är att klicka ihop samma
-- sak där, med tabell leads, bara Insert, och headern
-- x-nextrum-notis.
--
-- VARFÖR TRIGGERN OCH INTE ETT ANROP FRÅN FORMULÄRET
-- Adressen till en edge-funktion står i JavaScript på en publik
-- sida. Tog funktionen emot formulärdata direkt från webbläsaren
-- vore den en öppen väg att fylla inkorgen — vem som helst kan läsa
-- adressen och anropa den i en slinga. Triggern kör på Supabases
-- sida först när raden faktiskt skapats, så det som mejlas är
-- alltid något som verkligen står i databasen.
--
-- Mejlet är en avisering ovanpå, inte i stället för. Går anropet
-- fel ligger raden kvar i leads — därför sväljer undantagshanteraren
-- felet. En trasig avisering får aldrig hindra någon från att
-- skicka en intresseanmälan.
--
-- pg_net ÄR redan installerad i projektet.
-- ============================================================

-- create extension if not exists pg_net;

-- create or replace function public.notis_ny_lead()
-- returns trigger
-- language plpgsql
-- security definer
-- set search_path = ''
-- as $$
-- begin
--   begin
--     perform net.http_post(
--       url     := 'https://ddkfiuvcppalutfulvbi.supabase.co/functions/v1/lead-notis',
--       headers := jsonb_build_object(
--         'Content-Type',    'application/json',
--         'x-nextrum-notis', 'HEMLIGHETEN_HÄR'
--       ),
--       body    := jsonb_build_object(
--         'type',   'INSERT',
--         'table',  'leads',
--         'schema', 'public',
--         'record', to_jsonb(new)
--       )
--     );
--   exception when others then
--     raise warning 'notis_ny_lead: aviseringen gick inte fram (%), raden är sparad ändå', sqlerrm;
--   end;
--   return new;
-- end;
-- $$;

-- comment on function public.notis_ny_lead is
--   'Avfyrar edge-funktionen lead-notis när en intresseanmälan skapas. Fel sväljs med flit: aviseringen får inte kunna stoppa en anmälan.';

-- revoke all on function public.notis_ny_lead() from public, anon, authenticated;

-- drop trigger if exists ny_intresseanmalan on public.leads;
-- create trigger ny_intresseanmalan
--   after insert on public.leads
--   for each row execute function public.notis_ny_lead();
