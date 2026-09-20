-- ============================================================
-- NEXTRUM — Fas 10.2: olanserade tjänster syns inte utåt
--
-- Fasens klartkriterium är att barnvakt, hushållsnära och försäljning
-- är osynliga "också via API:t". Två vägar stod öppna.
--
-- 1. ORAKLET. tjanstkoder_finns() är SECURITY DEFINER och har EXECUTE
--    åt PUBLIC (proacl `=X/postgres`). Vem som helst kunde alltså
--    fråga /rest/v1/rpc/tjanstkoder_finns om 'barnvakt' och få ja.
--    Man behövde aldrig läsa tabellen — funktionen bekräftade koden.
--
--    Den lagas med en REVOKE, inte med `and t.aktiv` i kroppen.
--    Funktionen backar två CHECK-villkor (applications_tjanster_check
--    och tutor_profiles_tjanster_check), och ett villkor prövas om
--    vid varje framtida uppdatering av raden. Hade kroppen krävt
--    aktiv, hade en gammal ansökan på en tjänst som senare stängs av
--    blivit omöjlig att röra. En REVOKE ändrar ingenting för
--    villkoren: de körs med tabellägarens rättigheter.
--
-- 2. ANSÖKNINGARNA. `applications` har INSERT-policyn "vem som helst
--    kan skicka en ansökan" med `with check (true)` och INGET skydd
--    på fälten. Det betyder tre saker, och bara den första hör till
--    Fas 10:
--      · en anonym POST kunde lägga en ansökan på 'barnvakt', alltså
--        en tjänst som inte finns publikt
--      · den kunde sätta status = 'approved' direkt
--      · den kunde skriva fritext utan längdgräns — samma öppna API
--        som Fas 8.8 kapade för leads, men aldrig för ansökningar
--
--    Det är samma hål Fas 7.1 stängde för `leads`, lämnat öppet på
--    grannbordet. skydda_ansokningsfalt() speglar skydda_leadfalt():
--    samma undantag för admin, service_role och postgres-sessionen,
--    samma sätt att skriva om en okänd tjänst till en giltig i stället
--    för att neka anmälan. En sökande ska inte mötas av ett felmeddelande
--    för att vi ändrat vår katalog.
-- ============================================================

revoke execute on function public.tjanstkoder_finns(text[]) from public;

comment on function public.tjanstkoder_finns(text[]) is
  'Backar CHECK-villkoren på applications.tjanster och tutor_profiles.tjanster. '
  'EXECUTE åt PUBLIC återkallades i Fas 10.2: funktionen svarade ja på '
  '"finns barnvakt?" åt vem som helst, alltså ett orakel över olanserade '
  'tjänster. Villkoren fungerar ändå — de körs med tabellägarens rättigheter.';

create or replace function public.skydda_ansokningsfalt()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  klanger text := current_setting('request.jwt.claims', true);
  jwtroll text := case when klanger ~ '^\s*\{' then (klanger::json ->> 'role') else null end;
  giltiga text[];
begin
  if public.is_admin()
     or jwtroll = 'service_role'
     or (jwtroll is null and session_user in ('postgres', 'supabase_admin'))
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Läget och tidsstämplarna sätts av Nextrum, aldrig av den som söker.
    new.status       := 'new';
    new.kontaktad_at := null;
    new.intervju_at  := null;
    new.utbildad_at  := null;
    new.notering     := null;

    -- Bara tjänster som faktiskt går att söka till. En kod som inte
    -- gör det skrivs om i stället för att neka ansökan — vi ska inte
    -- straffa någon för att vår katalog ändrats under tiden.
    select array_agg(k) into giltiga
      from unnest(coalesce(new.tjanster, '{}'::text[])) as k
     where exists (select 1 from public.tjanster t
                    where t.kod = k and t.aktiv and t.for_jobb);

    if giltiga is null or cardinality(giltiga) = 0 then
      select array[t.kod] into giltiga
        from public.tjanster t
       where t.aktiv and t.for_jobb
       order by t.ordning, t.kod
       limit 1;
    end if;
    new.tjanster := coalesce(giltiga, array['laxhjalp']);

    -- Längdtaken. Samma skäl som för leads: utan dem kan vem som
    -- helst posta en rad på flera megabyte mot det öppna API:et, och
    -- den raden läses sedan av adminvyn och av notismejlet.
    new.name         := left(new.name, 120);
    new.email        := left(new.email, 200);
    new.school       := left(new.school, 120);
    new.subjects     := left(new.subjects, 200);
    new.availability := left(new.availability, 200);
    new.why          := left(new.why, 4000);
  else
    new.status       := old.status;
    new.kontaktad_at := old.kontaktad_at;
    new.intervju_at  := old.intervju_at;
    new.utbildad_at  := old.utbildad_at;
    new.notering     := old.notering;
    new.tjanster     := old.tjanster;
  end if;
  return new;
end $function$;

comment on function public.skydda_ansokningsfalt() is
  'Speglar skydda_leadfalt för det andra publika formuläret. Ansökningar '
  'kommer in genom en policy med `with check (true)`, så allt som ska vara '
  'sant om raden måste vara sant här.';

revoke execute on function public.skydda_ansokningsfalt() from public, anon, authenticated;

drop trigger if exists applications_skydda on public.applications;
create trigger applications_skydda
  before insert or update on public.applications
  for each row execute function public.skydda_ansokningsfalt();
