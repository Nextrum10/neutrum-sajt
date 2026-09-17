-- ============================================================
-- NEXTRUM — schema v12
--
-- Körs efter schema-v11.sql. ÄR applicerad i projektet
-- ddkfiuvcppalutfulvbi.
--
-- Skolan ut ur den publika vyn.
--
-- Sidan slutade visa skolan samtidigt som det här kördes, men så
-- länge kolumnen låg kvar i vyn kunde vem som helst läsa den via
-- REST-API:t — och en sida som inte visar ett fält är inte samma sak
-- som ett fält som inte går att hämta.
--
-- Att en namngiven, ofta minderårig studiehjälpare går på en viss
-- skola är mer om henne än tjänsten behöver publicera. Det hör inte
-- hemma bakom en öppen adress.
--
-- Fältet finns kvar i tutor_profiles. Det används för matchningen och
-- i admin, alltså bakom RLS. Det är bara den PUBLIKA vägen som stängs.
--
-- drop + create, inte create or replace: Postgres vägrar ta bort en
-- kolumn ur en befintlig vy.
-- ============================================================

drop view if exists public.studiehjalpare_publika;

create view public.studiehjalpare_publika
with (security_invoker = false) as
select
  tp.id,
  upper(left(split_part(btrim(p.full_name), ' ', 1), 1))
    || substr(split_part(btrim(p.full_name), ' ', 1), 2) as fornamn,
  tp.age,
  tp.city,
  tp.subjects,
  tp.grade_levels,
  tp.bio
from public.tutor_profiles tp
join public.profiles p on p.id = tp.id
where tp.status = 'approved'
  and btrim(coalesce(p.full_name, '')) <> '';

comment on view public.studiehjalpare_publika is
  'Godkända studiehjälpare för startsidan. Endast förnamn, ålder, ort, ämnen och text. Skolan är MEDVETET utelämnad: den hör inte hemma på en öppen adress kopplad till en namngiven minderårig.';

revoke all on public.studiehjalpare_publika from public;
grant select on public.studiehjalpare_publika to anon, authenticated;
