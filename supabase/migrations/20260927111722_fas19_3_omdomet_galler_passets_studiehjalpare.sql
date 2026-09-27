-- ============================================================
-- Fas 19.3: ett omdöme gäller passets egen studiehjälpare
--
-- tutor_reviews (v7) har noll rader och ingen vy skriver dit, men
-- insert-policyn prövade bara att passet var familjens och genomfört.
-- tutor_id och student_id valde familjen själv. En familj kunde alltså
-- skriva ett omdöme om vilken studiehjälpare som helst, och om någon
-- annans barn, genom att peka på ett eget genomfört pass. Studiehjälparen
-- läser sina omdömen (policyn "studiehjälparen läser sina omdömen"), så
-- ett sådant omdöme hade nått en sextonåring som aldrig träffat familjen.
--
-- CLAUDE.md sa "laga det innan något gör det". Nu: tutor_id måste vara
-- passets studiehjälpare, och student_id passets elev eller tomt.
-- Policyn byts i en transaktion, så det finns inget ögonblick utan den.
-- ============================================================

set local lock_timeout = '5s';

drop policy "familjen skriver omdöme" on public.tutor_reviews;

create policy "familjen skriver omdöme" on public.tutor_reviews
  for insert with check (
    auth.uid() = parent_id
    and exists (
      select 1 from public.bookings b
       where b.id = tutor_reviews.booking_id
         and b.parent_id = auth.uid()
         and b.status = 'completed'
         and b.tutor_id = tutor_reviews.tutor_id
         and (tutor_reviews.student_id is null or b.student_id = tutor_reviews.student_id)
    )
  );
