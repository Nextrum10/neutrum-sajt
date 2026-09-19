-- Fas 4.5 — en tid som redan har börjat bekräftas inte av sig själv.
--
-- bekrafta_inom_schemat (4.4) bekräftade varje familjebokning som låg
-- inom studiehjälparens veckotider, utan att se på klockan. Gränssnittet
-- erbjuder bara tider minst en timme fram (NX.tiderFörDatum, och samma
-- regel i "Önska en annan tid"), men en insert förbi gränssnittet kunde
-- ge ett bekräftat pass som redan varit — ett pass som sedan väntar på
-- rapport och kan faktureras utan att någon kommit överens om det.
--
-- Nu: har passets starttid passerat (svensk tid) blir raden kvar som
-- 'requested'. skydda_bokningsfalt stoppar redan en passerad DAG; det här
-- gäller timmarna tidigare samma dag. Resten av funktionen är oförändrad,
-- läst med pg_get_functiondef före ändringen.
--
-- Provat 2026-09-19 16:09 i en transaktion som rullades tillbaka:
--   idag 08:00 → requested, idag 21:00 → confirmed, imorgon 10:00 2 h → confirmed.

create or replace function public.bekrafta_inom_schemat()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  start_s  int;
  slut_s   int;
  veckodag int;
begin
  if new.status is distinct from 'requested'
     or new.created_by is distinct from new.parent_id
     or new.tutor_id is null
     or new.wanted_date is null
     or new.wanted_time is null
     or new.wanted_time !~ '^\d{2}:00' then
    return new;
  end if;

  -- Eget steg, inte ett villkor till ovan: timmen tolkas som ett tal,
  -- och det får bara ske när formatet redan är kontrollerat.
  if new.wanted_date + make_interval(hours => split_part(new.wanted_time, ':', 1)::int)
       <= (now() at time zone 'Europe/Stockholm') then
    return new;
  end if;

  start_s  := split_part(new.wanted_time, ':', 1)::int * 3600;
  slut_s   := start_s + greatest(1, ceil(coalesce(new.duration_min, 60) / 60.0)::int) * 3600;
  veckodag := extract(isodow from new.wanted_date)::int - 1;          -- 0 = måndag, som i tutor_availability

  if exists (
    select 1
      from public.tutor_availability a
     where a.tutor_id = new.tutor_id
       and a.weekday  = veckodag
       and extract(epoch from a.start_time) <= start_s
       and extract(epoch from a.end_time)   >= slut_s
  ) then
    new.status := 'confirmed';
  end if;

  return new;
end $function$;

revoke execute on function public.bekrafta_inom_schemat() from public, anon, authenticated;
