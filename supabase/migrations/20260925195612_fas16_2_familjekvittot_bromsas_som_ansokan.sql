-- ============================================================
-- NEXTRUM — Fas 16.2: kvittot till familjen bromsas som ansökningskvittot
--
-- lead-notis räknade sin broms själv, med två frågor mot leads: fler
-- än fem anmälningar den senaste minuten, eller samma adress det
-- senaste dygnet. Adressen jämfördes med ilike, alltså exakt utom
-- skiftläget. "offer+1@gmail.com", "offer+2@gmail.com" … hamnar i
-- samma inkorg, och var och en fick sitt eget kvitto från
-- info@nextrum.se. Fem i minuten är dessutom 7 200 kvitton per dygn
-- för den som håller takten.
--
-- Ansökningskvittot fick båda skydden i Fas 16.1c. Samma regler här,
-- och samma jämförelse: intern.epost_nyckel(), en gång, i databasen.
-- En kopia av normaliseringen i TypeScript hade glidit isär från den
-- i SQL förr eller senare, och då bromsar de två kvittona olika.
--
-- Tjugo i timmen är taket. Nextrum får några anmälningar om dagen,
-- och det enda som bromsas är kvittot: aviseringen till oss går ut
-- oavsett, så en verklig anmälan blir aldrig osedd.
--
-- Funktionen ligger i public för att edge-funktionen når den genom
-- PostgREST, men bara service_role får köra den. Den svarar med ett
-- skäl eller null, aldrig med en adress eller en rad.
-- ============================================================

create or replace function public.lead_kvitto_broms(p_epost text, p_id uuid default null)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with takt as (
    select count(*) filter (where l.created_at > now() - interval '1 minute') as minut,
           count(*) as timme
      from public.leads l
     where l.created_at > now() - interval '1 hour'
  ), samma as (
    select count(*) as antal
      from public.leads l
     where intern.epost_nyckel(l.email) = intern.epost_nyckel(p_epost)
       and l.id is distinct from p_id
       and l.created_at > now() - interval '24 hours'
  )
  select case
    when takt.minut > 5 then 'Fler än fem anmälningar den senaste minuten.'
    when takt.timme > 20 then 'Fler än tjugo anmälningar den senaste timmen.'
    when samma.antal > 0 then 'Adressen har redan anmält sig det senaste dygnet.'
  end
  from takt, samma
$$;

comment on function public.lead_kvitto_broms(text, uuid) is
  'Skälet att inte skicka kvittot på en intresseanmälan, eller null. Bara för lead-notis (service_role).';

revoke execute on function public.lead_kvitto_broms(text, uuid) from public, anon, authenticated;
grant execute on function public.lead_kvitto_broms(text, uuid) to service_role;
