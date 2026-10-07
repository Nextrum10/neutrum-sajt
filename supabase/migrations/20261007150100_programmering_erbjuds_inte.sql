-- ============================================================
-- Programmering erbjuds inte (2026-10-07, Leo)
--
-- Nextrum erbjuder inte programmering. Ämnet står inte längre i
-- NX.AMNEN, och databasen följer med här:
--
--   · Betygsgarantin går inte att anmäla i programmering. Listan står
--     också i NX.GARANTI_AMNEN och ändras tillsammans med den. När den
--     ändrades fanns ingen anmälan i programmering.
--   · Materialbankens två programmeringsblad stängs av. De raderas
--     inte, och inget av dem var utdelat som läxa när de stängdes av.
--
-- NexLäx-nivåerna i programmering stängs av i
-- 20261007150000_uppgiftsbanken_utan_programmering, som resten av
-- banken: en nivå som tagits bort ur filerna stängs av, den tas inte
-- bort.
--
-- Ingen drop och ingen delete. Går att köra två gånger.
-- ============================================================

create or replace function intern.betygsgaranti_amnen()
returns text[]
language sql
immutable
set search_path = pg_temp
as $$
  select array['Matematik', 'Svenska', 'Svenska som andraspråk', 'Engelska',
               'Biologi', 'Fysik', 'Kemi', 'Historia', 'Samhällskunskap',
               'Spanska', 'Tyska', 'Franska']
$$;

revoke all on function intern.betygsgaranti_amnen() from public, anon, authenticated;

update public.biblioteksmaterial
   set aktiv = false
 where amne = 'Programmering'
   and aktiv;
