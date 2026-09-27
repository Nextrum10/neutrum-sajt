-- ============================================================
-- Admin läser CV:t i en ansökan
--
-- Hinken cv (v11, cv_hink_for_ansokningar) fick en enda policy:
-- vem som helst laddar upp, för den som söker har inget konto än.
-- Läsningen lämnades åt service_role, och v11 skrev att ansökningarna
-- öppnas i Supabases Storage-vy. Följden var att CV:t kom fram men
-- inte gick att öppna där ansökan läses: adminvyn visade bara raden
-- "CV: cv/<sökväg>" i ansökans text, och den som ville läsa filen fick
-- leta upp samma namn i dashboarden.
--
-- Läsrätten är admins och ingen annans, med samma villkor som hinken
-- dokument (Fas 9.10). Ett CV bär namn, skola och ofta personnummer,
-- och den som söker är ofta sexton. En studiehjälpare eller en familj
-- ser ingenting, och inte den sökande själv heller: filen laddas upp
-- innan det finns ett konto, så det finns ingen ägare att släppa in.
--
-- Bara SELECT. Skrivpolicyn för anon står kvar som den är.
-- ============================================================

drop policy if exists "admin läser cv" on storage.objects;
create policy "admin läser cv"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'cv' and public.is_admin());
