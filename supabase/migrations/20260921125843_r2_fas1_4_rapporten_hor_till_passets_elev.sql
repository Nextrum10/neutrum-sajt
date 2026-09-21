-- ============================================================
-- NEXTRUM — program 2, Fas 1.4: rapporten hör till passets elev
--
-- Ett av de tre kända hålen är studiehjälparen som skriver rapport om
-- fel elev. F-2 stängde det för rapportens student_id: den måste vara
-- en egen elev. Men rapporten bär också booking_id, och ingenting
-- krävde att passet och rapporten gällde samma barn:
--
--   · Ett pass UTAN elev gick att rapportera på vilken egen elev som
--     helst. Studiehjälparvyn sparar då rapporten på den elev som
--     råkar vara vald (S.aktivElev), och triggern för genomfört
--     nöjde sig med att någon rapport pekade på passet. Ett pass hos
--     Alva kunde alltså bli genomfört med en rapport om Olle.
--   · En studiehjälpare kunde själv föreslå ett pass utan elev —
--     skydda_bokningsfalt prövar ar_min_elev bara när student_id
--     finns. Det var så ett sådant pass kunde uppstå.
--   · En rapport kunde flyttas: policyn för UPDATE låste inte
--     booking_id, så samma rapport kunde "genomföra" flera pass.
--
-- Passdetaljen i Fas 1 lägger "Skriv rapport" på fler ställen, så
-- hålet täpps före den, inte efter.
--
-- Två nya triggrar, inga ändringar i befintliga. skydda_bokningsfalt
-- (F-6) och policyerna på lesson_reports står orörda; de här läggs
-- bredvid och kan bara neka mer, aldrig släppa igenom mer.
-- Admin och databasens egna anrop (auth.uid() null) släpps igenom,
-- samma regel som i alla skydda_*: adminvyns "Koppla" i Ekonomi är
-- vägen för ett gammalt pass som saknar elev.
-- ============================================================

create or replace function public.skydda_rapportens_pass()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  pass_tutor uuid;
  pass_elev  uuid;
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.booking_id is not null and new.booking_id is distinct from old.booking_id then
      raise exception using errcode = '42501',
        message = 'En rapport som hör till ett pass kan inte flyttas till ett annat pass.';
    end if;
    if new.student_id is distinct from old.student_id then
      raise exception using errcode = '42501',
        message = 'En rapport kan inte flyttas till en annan elev.';
    end if;
  end if;

  if new.booking_id is not null
     and (tg_op = 'INSERT' or new.booking_id is distinct from old.booking_id) then
    select b.tutor_id, b.student_id into pass_tutor, pass_elev
      from public.bookings b where b.id = new.booking_id;
    if not found or pass_tutor is distinct from new.tutor_id then
      raise exception using errcode = '42501',
        message = 'Rapporten kan bara skrivas för ett av dina egna pass.';
    end if;
    if pass_elev is null then
      raise exception using errcode = '42501',
        message = 'Passet saknar elev. Be Nextrum koppla passet till rätt elev innan du skriver rapporten.';
    end if;
    if pass_elev <> new.student_id then
      raise exception using errcode = '42501',
        message = 'Rapporten gäller en annan elev än passet.';
    end if;
  end if;

  return new;
end $$;

revoke execute on function public.skydda_rapportens_pass() from public, anon, authenticated;

drop trigger if exists lesson_reports_skydda_pass on public.lesson_reports;
create trigger lesson_reports_skydda_pass before insert or update on public.lesson_reports
  for each row execute function public.skydda_rapportens_pass();

-- Ett pass gäller alltid en elev. Familjens bokning skickar redan
-- barnet (studievyn bokar åt det valda barnet), så det här stoppar
-- bara det som inte har ett legitimt flöde.
create or replace function public.pass_kraver_elev()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  if new.student_id is null then
    raise exception using errcode = '42501', message = 'Ett pass måste gälla en elev.';
  end if;
  return new;
end $$;

revoke execute on function public.pass_kraver_elev() from public, anon, authenticated;

drop trigger if exists bookings_pass_kraver_elev on public.bookings;
create trigger bookings_pass_kraver_elev before insert on public.bookings
  for each row execute function public.pass_kraver_elev();
