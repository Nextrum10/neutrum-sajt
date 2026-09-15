-- ============================================================
-- NEXTRUM — schema v21
-- FAMILJEN FÅR TA BORT ETT BARN, MEN INTE HISTORIEN
--
-- Körs efter schema-v20.sql. Idempotent.
--
--
-- VAD SOM VAR FEL
--
-- `students` har ingen DELETE-policy för föräldern. Bara admin har
-- ALL. En förälder som lagt till fel barn kunde alltså aldrig ta
-- bort det, och knappen fanns inte — vilket åtminstone var ärligt.
--
--
-- VARFÖR DET INTE RÄCKER ATT LÄGGA TILL POLICYN
--
-- De främmande nycklarna mot students är hårda:
--
--   lesson_reports, homework, study_plans, progress_items,
--   materials, student_notes   → CASCADE
--   bookings, tutor_reviews    → SET NULL
--
-- En rak DELETE tar alltså med sig varje rapport som skrivits om
-- barnet, och lämnar samtidigt genomförda pass utan elev. De passen
-- kan redan vara fakturerade. Resultatet är en faktura ingen kan
-- förklara och en historik som inte går att få tillbaka.
--
-- Därför: policyn OCH en spärr. Föräldern får ta bort ett barn som
-- inte hunnit få någon historia — alltså det man just lade till av
-- misstag. Ett barn med pass eller rapporter går inte att ta bort
-- från vyn, och felmeddelandet säger varför i stället för att bara
-- vägra.
--
-- Admin går förbi spärren. Den som behöver radera på riktigt, till
-- exempel efter en begäran om radering enligt GDPR, ska kunna det —
-- men det ska vara ett medvetet beslut av någon som ser hela bilden,
-- inte ett klick i en kontovy.
-- ============================================================


-- ============================================================
-- 1. POLICYN
-- ============================================================

drop policy if exists "förälder tar bort eget barn" on public.students;
create policy "förälder tar bort eget barn" on public.students
  for delete using (parent_id = auth.uid());


-- ============================================================
-- 2. SPÄRREN
-- ============================================================

create or replace function public.skydda_elevradering()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  pass integer;
  rapporter integer;
begin
  -- Admin och service_role går förbi. Se resonemanget överst.
  if public.is_admin() or auth.uid() is null then
    return old;
  end if;

  select count(*) into pass from public.bookings where student_id = old.id;
  select count(*) into rapporter from public.lesson_reports where student_id = old.id;

  if pass > 0 or rapporter > 0 then
    raise exception using
      errcode = 'P0001',
      message = 'Det går inte att ta bort ett barn som har bokade pass eller rapporter.',
      hint = 'Hör av dig till oss så hjälper vi er.';
  end if;

  return old;
end $function$;

drop trigger if exists students_skydda_radering on public.students;
create trigger students_skydda_radering
  before delete on public.students
  for each row execute function public.skydda_elevradering();


-- ============================================================
-- EFTERÅT
--
--   -- Som förälder, i webbläsaren: ta bort ett nyss tillagt barn.
--   -- Ska fungera.
--
--   -- Försök sedan ta bort ett barn med ett pass.
--   -- Ska ge "Det går inte att ta bort ett barn som har bokade
--   -- pass eller rapporter."
-- ============================================================
