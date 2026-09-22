-- ============================================================
-- NEXTRUM — program 2, Fas 1.6: studiehjälparen ser bara sina
-- egna elever
--
-- integritetspolicy.html lovar: "En studiehjälpare ser bara de
-- elever hen är matchad med." Driften höll inte det löftet.
-- Policyn "tilldelad lärare ser sina elever" var
-- is_matched_tutor_of(parent_id), alltså matchad med FAMILJEN — och
-- den släpper igenom familjens alla barn så fort ett av dem är
-- matchat. Studiehjälparvyn hämtar eleverna utan filter, så
-- syskonen syntes i elevkorten, i räknaren och i trådens rubrik.
-- Samma sak gällde uppdragen, ett per barn.
--
-- Skrivningarna var redan rätt (is_my_student per elev sedan Fas
-- 1.1). Det här gör läsningen likadan: en elev syns för den
-- studiehjälpare hen är matchad med, och inte för någon annan.
-- Villkoret är is_my_student utskrivet, så att policyn inte anropar
-- en funktion som i sin tur läser samma tabell.
--
-- Pausade elever syns fortfarande (match_status <> 'pending'), som
-- i is_my_student. Om en pausad matchning ska stänga läsningen är
-- ett eget beslut.
--
-- Familjens profil och bokningsförslaget lämnas som de är:
-- "lärare läser sina matchade föräldrars profiler" och "studiehjälpare
-- föreslår tid" gäller familjen, inte ett barn, och att ändra dem
-- hänger på beslutet om syskon med olika studiehjälpare.
-- ============================================================

drop policy if exists "tilldelad lärare ser sina elever" on public.students;
drop policy if exists "studiehjälparen ser sina elever" on public.students;
create policy "studiehjälparen ser sina elever" on public.students
  for select to authenticated
  using (matched_tutor_id = auth.uid() and match_status <> 'pending');

drop policy if exists "matchad studiehjälpare ser uppdraget" on public.uppdrag;
drop policy if exists "studiehjälparen ser sina elevers uppdrag" on public.uppdrag;
create policy "studiehjälparen ser sina elevers uppdrag" on public.uppdrag
  for select to authenticated
  using (exists (select 1 from public.students s
                  where s.uppdrag_id = uppdrag.id
                    and s.matched_tutor_id = auth.uid()
                    and s.match_status <> 'pending'));
