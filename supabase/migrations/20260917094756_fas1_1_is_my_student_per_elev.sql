-- ============================================================
-- NEXTRUM — Fas 1.1 (F-2)
-- is_my_student() FRÅGAR OM ELEVEN, INTE OM FAMILJEN
--
-- VAD SOM VAR FEL
--
-- is_my_student() avgör vem som får skriva läxor, material,
-- utvecklingsområden, studieplan och rapport för en elev — och
-- vem som får ladda upp och ta bort filer i hinken material. Den
-- frågade om FAMILJENS match:
--
--     profiles.matched_tutor_id = auth.uid()
--
-- profiles.matched_tutor_id sätts av synka_familjens_match() till
-- det ÄLDSTA matchade barnets studiehjälpare. Två syskon med var sin
-- studiehjälpare gav alltså: A (äldsta barnet) fick skriva om B:s
-- elev, och B fick inte skriva om sin egen.
--
-- Systerfunktionen ar_min_elev() (v14) frågar redan rätt fråga.
-- is_my_student() får samma kropp. Namnet behålls, eftersom sex
-- tabellpolicyer och tre lagringspolicyer anropar det.
--
-- Kontrollerat före körning: 0 elever vars egen matchning skiljer
-- sig från familjens, så ingen som skriver i dag låses ute.
--
--
-- UPPDATERINGSPOLICYERNA
--
-- "lärare uppdaterar egen rapport" och "lärare uppdaterar egen
-- studieplan" kontrollerade bara tutor_id. En studiehjälpare kunde
-- därför skriva en rapport om sin egen elev och sedan byta
-- student_id till vilken elev som helst. with_check kräver nu att
-- eleven efter ändringen också är hens.
-- ============================================================

create or replace function public.is_my_student(student_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.students s
    where s.id = student_uuid
      and s.matched_tutor_id = auth.uid()
      and s.match_status <> 'pending'
  )
$function$;

alter policy "lärare uppdaterar egen rapport" on public.lesson_reports
  with check ((auth.uid() = tutor_id) and public.is_my_student(student_id));

alter policy "lärare uppdaterar egen studieplan" on public.study_plans
  with check ((auth.uid() = tutor_id) and public.is_my_student(student_id));
