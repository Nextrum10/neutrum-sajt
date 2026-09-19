-- Fas 5 — de interna kolumnerna i tjänstekatalogen syns inte för anon.
--
-- RLS är radbaserad: "alla läser aktiva tjänster" lämnar ut HELA raden
-- för en aktiv tjänst. Med 5.1 fick raden kolumner som inte hör hemma
-- på den publika sajten — vad Nextrum betalar den som utför tjänsten,
-- och de interna kraven och matchningsreglerna. Granskningen visade att
-- vem som helst med den publika nyckeln kunde läsa dem.
--
-- Anon får därför läsa alla kolumner UTOM de tre. Inloggade läser som
-- förut (adminvyn läser hela katalogen; en studiehjälpare får se vad
-- ett uppdrag betalar). Policyerna är oförändrade.
--
-- Följd att känna till: en anon-fråga med select=* på tjanster nekas
-- nu (42501). Gränssnittet frågar efter namngivna kolumner
-- (nextrum-tjanster.js), och count(*) fungerar fortfarande.

revoke select on public.tjanster from anon;
grant select (
  kod, namn, kort, for_kund, for_jobb, pris_per_timme_ore, aktiv, ordning, uppdaterad,
  namn_en, kort_en, extra_personer_ore, extra_personer_max,
  bokningstyp, min_alder, rapportkrav, rut_berattigad, rut_procent, kundtyp, jobbtyp
) on public.tjanster to anon;
