-- ============================================================
-- NEXTRUM — villkoren för familjerabatten (2026-10-16)
--
-- Leo 2026-10-16: "fixa villkoren". Familjerabatten (familjerabatter,
-- 2026-10-15) står nu i användarvillkoren (anvandarvillkor.html,
-- Familjerabatt under Pris och betalning): vad den gäller, att den gäller
-- tills vidare och att vi kan ändra eller ta bort den, och att det som
-- redan är bokat eller köpt behåller sitt pris. Att sluta under Planer och
-- timbanken säger nu det som databasen redan räknar för en familj med
-- rabatt: de använda timmarna till ordinarie timpris med rabatten på köpet
-- dragen (klippkort_saldo.vid_uppsagning_ore), och de sparade minuterna
-- likaså (intern.timbank_varde). Förut lovade villkoren minuterna tillbaka
-- till ordinarie timpris, och för en familj med rabatt hade det varit mer
-- än databasen betalar tillbaka. Ingen familj hade en rabatt.
--
-- Samma version tar bort två meningar som Leo bestämt ska gå med nästa
-- version, för en version bara för dem hade gett alla frågan igen:
-- "kan vi, om vi kommit överens om det" om första timmen pass för pass
-- (ges inte sedan 2026-10-15; ingen familj hade valet) och "utan
-- påminnelse" om gratistimmarna (gratistimmarna_paminns påminner sedan
-- 2026-10-15).
--
-- Det är en ny version, så alla får frågan igen vid nästa inloggning, och
-- ingen föreslår pass, köper timmar eller väljer kortet innan dess
-- (bookings_kraver_villkor, klippkort_kraver_villkor,
-- kortreservationer_kraver_villkor). Datumet är dagen villkoren går ut;
-- blir det en annan dag byts det här och på båda sidorna
-- (kolla-villkor.py).
-- ============================================================

-- ---------- 0. vakten ----------
-- Villkoren skrevs mot versionen i driften 2026-10-16. Har någon annan
-- bytt den sedan dess står en annan text på sidan än den här filen utgår
-- från: läs driften och sidan innan filen skrivs om.
do $vakt$
begin
  if intern.villkor_version() <> '2026-10-15' then
    raise exception 'Villkorens version är %, inte 2026-10-15 som den här filen utgår från. Läs driften.',
      intern.villkor_version();
  end if;
end $vakt$;


-- ---------- 1. versionen ----------
create or replace function intern.villkor_version()
returns text
language sql
immutable
set search_path = pg_temp
as $$ select '2026-10-16'::text $$;
