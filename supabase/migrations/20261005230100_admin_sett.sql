-- ============================================================
-- NEXTRUM — vad varje admin har sett av anmälningarna och ansökningarna
-- (2026-10-05)
--
-- Leo: "notis systemet i intresseanmälning och ansökning, i själva
-- plattformen som vi byggt, notiserna ska försvinna efter vi klickat på
-- områden och exempelvis sett att en ansökan kommit in, och just vilken
-- ansökan som kommit in."
--
-- Siffran vid Intresseanmälningar och Ansökningar i menyn räknade allt med
-- läget Ny, och stod kvar tills någon bytte läget. Den sa alltså "något
-- väntar" när man redan sett det, och gick inte att få bort genom att
-- titta. Nu räknar den det som kommit in sedan DU senast öppnade
-- sektionen, och raderna som är nya sedan dess märks i listan.
--
-- En rad per admin och område: hur långt hen har sett (sett_till, den
-- senaste anmälan eller ansökan som stod i listan när hen öppnade den).
-- Per admin och inte per rad: att en admin sett en ansökan säger ingenting
-- om att den andra har det. Raden skrivs bara genom admin_sett_markera(),
-- som aldrig flyttar tiden bakåt och aldrig förbi nu.
--
-- Adminvyn tål att tabellen saknas: då räknas läget Ny som förut.
-- ============================================================

create table if not exists public.admin_sett (
  user_id   uuid not null references auth.users (id) on delete cascade,
  omrade    text not null check (omrade in ('leads', 'ansokningar')),
  sett_till timestamptz not null,
  primary key (user_id, omrade)
);

comment on table public.admin_sett is
  'Hur långt varje admin har sett anmälningarna och ansökningarna. Skrivs bara av admin_sett_markera().';

alter table public.admin_sett enable row level security;
revoke all on public.admin_sett from anon, authenticated, nextrum_barn;
grant select on public.admin_sett to authenticated;

-- Var och en läser bara sina egna rader. Ingen skrivpolicy: raden skrivs
-- av funktionen nedan.
do $$
begin
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'admin_sett'
                    and policyname = 'admin läser vad hen själv sett') then
    create policy "admin läser vad hen själv sett" on public.admin_sett
      for select to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- Markerar att den inloggade sett området till och med p_till: den
-- senaste raden som stod i listan, inte klockan, så att något som kommer
-- in medan sidan ritas inte räknas som sett. Bara den som får se området:
-- intresseanmälningarna med behörigheten leads, ansökningarna superadmin.
create or replace function public.admin_sett_markera(p_omrade text, p_till timestamptz)
 returns timestamptz
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Inte inloggad.' using errcode = '42501';
  end if;
  if p_omrade = 'leads' then
    if not public.har_behorighet('leads') then
      raise exception 'Ingen behörighet.' using errcode = '42501';
    end if;
  elsif p_omrade = 'ansokningar' then
    if not public.is_admin() then
      raise exception 'Ingen behörighet.' using errcode = '42501';
    end if;
  else
    raise exception 'Okänt område.' using errcode = '22023';
  end if;

  v := least(coalesce(p_till, now()), now());
  insert into public.admin_sett as s (user_id, omrade, sett_till)
  values (auth.uid(), p_omrade, v)
  on conflict (user_id, omrade) do update set sett_till = greatest(s.sett_till, excluded.sett_till)
  returning s.sett_till into v;
  return v;
end $function$;

revoke execute on function public.admin_sett_markera(text, timestamptz) from public, anon, nextrum_barn;
grant execute on function public.admin_sett_markera(text, timestamptz) to authenticated;
