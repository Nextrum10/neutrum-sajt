-- ============================================================
-- Betygsgarantin i användarvillkoren (2026-10-07)
-- ============================================================
-- Villkoren fick avsnittet Betygsgaranti (#betygsgaranti), och två
-- meningar ändrades med det: Vad Nextrum är och Vårt ansvar. Det är en
-- ändring i sak, så versionen byts till sidans nya datum, och alla får
-- frågan igen vid nästa inloggning (villkoren_godkanns). Den som inte
-- godkänt kan inte boka eller köpa timmar förrän hen gjort det.
--
-- kolla-villkor.py håller datumet här lika med anvandarvillkor.html.
-- Bara kroppen byts: create or replace behåller rättigheterna och
-- kommentaren från villkoren_godkanns.
--
-- Garantin i sig har ingen tabell. Anmälan och anspråket är mejl till
-- info@, och prövningen läser det som redan finns: hållen tid,
-- bookings.attendance, homework och betalningarna.
-- ------------------------------------------------------------
create or replace function intern.villkor_version()
returns text
language sql
immutable
set search_path = pg_temp
as $$ select '2026-10-07'::text $$;
