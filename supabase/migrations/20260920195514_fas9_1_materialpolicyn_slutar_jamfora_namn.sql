-- ============================================================
-- NEXTRUM — Fas 9.1: materialpolicyn jämförde elevens NAMN
--
-- Policyn "berörda läser material" har två grenar: studiehjälparen
-- läser sin elevs material, och familjen läser sitt barns. Den andra
-- grenen har aldrig kunnat bli sann.
--
--   s.id = mapp_uuid(s.name)
--
-- s.name är elevens NAMN. mapp_uuid plockar ut ett uuid ur en
-- filsökväg, och ett namn som "Alva Berg" innehåller inget uuid — så
-- uttrycket jämför elevens id med null. Meningen var att läsa
-- filsökvägen, alltså storage.objects.name, men kolumnen skuggades
-- av tabellaliaset s i EXISTS-satsen och ingen märkte det: en policy
-- som nekar för mycket ser ut som en tom lista, inte som ett fel.
--
-- FÖLJDEN I DRIFT: familjen ser inte material som studiehjälparen
-- laddat upp till deras barn. Studievyn hämtar raderna ur materials
-- (som har en egen, fungerande policy) och begär sedan en signerad
-- länk till filen — och den begäran nekas. Det finns en materialfil
-- i driften i dag, och den ligger under ett barn som har en förälder.
--
-- Kolumnen kvalificeras nu explicit med tabellnamnet, så att
-- skuggningen inte kan uppstå igen. Studiehjälpargrenen är orörd.
--
-- Det här är första steget i Fas 9 med flit: analysvyerna ska inte
-- byggas ovanpå fält som ljuger, och en dokumenthink senare i fasen
-- hade annars kopierat just det här mönstret.
-- ============================================================

drop policy if exists "berörda läser material" on storage.objects;

create policy "berörda läser material" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'material'
    and (
      public.is_my_student(public.mapp_uuid(storage.objects.name))
      or exists (
        select 1 from public.students s
         where s.id = public.mapp_uuid(storage.objects.name)
           and s.parent_id = auth.uid()
      )
    )
  );
