-- ============================================================
-- NEXTRUM — Fas 9.2: admin når materialfilerna
--
-- Adminvyn tar bort material i två steg: först filen ur hinken,
-- sedan raden i materials. Men hinken har bara policyer för
-- studiehjälparen och (sedan 9.1) familjen — admin har ingen.
--
-- Följden: filborttagningen nekas TYST (svaret läses aldrig,
-- nextrum-admin-detalj.js), raden försvinner, och filen blir kvar i
-- hinken utan någon rad som pekar på den. Sökvägen fanns bara i
-- raden, så filen är därefter både omöjlig att nå och omöjlig att
-- städa. Precis det som kommentaren i koden säger att ordningen
-- finns för att undvika.
--
-- Admin får därför läsa och ta bort i hinken material. Inte skriva:
-- material laddas upp av studiehjälparen, och en fil som familjen
-- ser ska komma från den de känner. Adminvyns egen uppladdning
-- använder redan studiehjälparens väg.
--
-- Avatarhinken och cv-hinken lämnas som de är i den här fasen. De
-- har egna problem (avatarer är läsbar för varje inloggad, cv är
-- skrivbar för anon), men de hör inte till spårbarhet och analys,
-- och en policyändring på en hink som fungerar är inte gratis.
-- ============================================================

drop policy if exists "admin läser material" on storage.objects;
create policy "admin läser material" on storage.objects
  for select to authenticated
  using (bucket_id = 'material' and public.is_admin());

drop policy if exists "admin tar bort material" on storage.objects;
create policy "admin tar bort material" on storage.objects
  for delete to authenticated
  using (bucket_id = 'material' and public.is_admin());
