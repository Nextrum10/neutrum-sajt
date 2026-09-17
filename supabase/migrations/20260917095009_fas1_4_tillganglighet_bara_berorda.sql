-- ============================================================
-- NEXTRUM — Fas 1.4 (F-3)
-- STUDIEHJÄLPARNAS VECKOSCHEMAN SYNS BARA FÖR BERÖRDA
--
-- VAD SOM VAR FEL
--
-- "alla läser tillgängliga tider" var using (true) för public.
-- En oinloggad besökare läste vilka veckodagar och klockslag varje
-- studiehjälpare är ledig — tillsammans med F-1 namn, ålder, skola,
-- ort och schema för en ofta minderårig person.
--
--
-- VEM SOM FAKTISKT BEHÖVER TIDERNA
--
--   studiehjälparen själv  — egen policy, ALL, finns redan
--   den matchade familjen  — bokningen och flytta-rutan
--                            (NX.hämtaTillganglighet, foralder.html)
--   admin                  — detaljpanelen och vyn
--                            matchningsunderlag, som läser med
--                            anroparens rättigheter. Admin hade
--                            ingen egen policy och läste via den
--                            öppna, så den läggs in här.
--
-- is_my_matched_tutor() svarar ja både på familjens match och på
-- varje enskilt barns, så en familj med två studiehjälpare ser båda.
-- ============================================================

drop policy if exists "alla läser tillgängliga tider" on public.tutor_availability;

drop policy if exists "berörda läser tillgängliga tider" on public.tutor_availability;
create policy "berörda läser tillgängliga tider"
  on public.tutor_availability
  for select
  to authenticated
  using (
    auth.uid() = tutor_id
    or public.is_admin()
    or public.is_my_matched_tutor(tutor_id)
  );
