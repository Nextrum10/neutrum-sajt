-- ============================================================
-- NEXTRUM — Fas 4.4: en bokning inom studiehjälparens tider
-- bekräftas direkt
--
-- Leo valde 2026-09-18 två vägar för familjen:
--
--   · boka en tid studiehjälparen själv markerat som ledig — den är
--     redan ett ja, och ska inte behöva vänta på ett andra ja
--   · önska vilken dag och tid som helst — den blir en förfrågan
--     som studiehjälparen bekräftar eller avböjer
--
-- VARFÖR I DATABASEN OCH INTE I WEBBLÄSAREN
--
-- skydda_bokningsfalt (Fas 1.5) kräver att varje ny bokning börjar
-- som 'requested', och att bekräftelsen kommer från motparten. Det
-- skyddet försvagas inte: klienten skickar fortfarande 'requested',
-- och skydda_bokningsfalt kontrollerar det som vanligt. Den här
-- triggern körs EFTER den (BEFORE-triggrar körs i namnordning:
-- skydda_bokningsfalt, skydda_rabatt, tid_inom_schemat) och är den
-- enda som kan sätta 'confirmed' vid insert — och bara när servern
-- själv har sett att tiden ligger inom studiehjälparens tider.
--
-- En webbläsare som skickar 'confirmed' stoppas av skydda_bokningsfalt
-- precis som förut.
--
-- VILLKOREN, ALLA MÅSTE STÄMMA
--   · familjen bokar själv (created_by = parent_id)
--   · passet börjar på hel timme
--   · HELA passet ligger i ett och samma fönster i tutor_availability
--     för den veckodagen — ett tvåtimmarspass som börjar sista timmen
--     i ett fönster är en förfrågan, inte en bokning
--
-- Krockar kontrolleras inte här. Exclusion-constrainten
-- bookings_ingen_overlapp och unika indexet bookings_tutor_slot_unique
-- gäller både requested och confirmed, så en bokning som krockar
-- sparas inte alls.
--
-- Undantagsdagarna (tutor_blocked) läses inte längre. Leo tog bort
-- funktionen i studiehjälparvyn samma dag: veckotiderna är det enda
-- som gäller. Den enda raden i tabellen (2026-09-07) har passerat.
--
-- Testat 2026-09-19 i en transaktion som rullades tillbaka:
--   inom fönstret (1 h och hela 3 h)  -> confirmed
--   sticker ut ur fönstret, utanför    -> requested
--   studiehjälparens eget förslag       -> requested
--   vanlig användare skickar confirmed  -> nekad (42501)
--   krock med en befintlig bokning       -> nekad (23505)
-- ============================================================

create or replace function public.bekrafta_inom_schemat()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
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
end $$;

revoke execute on function public.bekrafta_inom_schemat() from public, anon, authenticated;

create trigger bookings_tid_inom_schemat
  before insert on public.bookings
  for each row execute function public.bekrafta_inom_schemat();
