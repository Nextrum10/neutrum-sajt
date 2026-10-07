-- ============================================================
-- NEXTRUM — provobjekten tas bort (2026-10-07)
--
-- Tio funktioner public.zz_prov_* och tabellen public.zz_prov_ddl låg kvar
-- i driften efter ett prov 2026-10-02 av vilka satser verktygen ber om en
-- bekräftelse för (minne/databasen.md, Att köra en migration i driften).
-- De skapades utan fil, vilket CLAUDE.md avsnitt 5 förbjuder, och gav nio
-- varningar i säkerhetskontrollen (search_path som går att ändra).
--
-- Ingen kod, inget jobb och ingen annan funktion nämner dem, och ingen roll
-- utom ägaren kunde köra dem. Men zz_prov_k1 var en kopia av morgonmejlets
-- körning (admin_paminnelser, med SECURITY DEFINER) och hade skickat mejl
-- om någon kört den, och fem andra skrev i morgonmejlets tabeller.
-- Tabellen var tom. Leo: "Fixa ... skräp i databasen".
--
-- Filen har drop, så verktygen ber om en bekräftelse. Ett prov av vad som
-- kräver en bekräftelse görs i en transaktion som rullas tillbaka, aldrig
-- med objekt som blir kvar.
-- ============================================================

drop function if exists public.zz_prov_f();
drop function if exists public.zz_prov_k1();
drop function if exists public.zz_prov_r1();
drop function if exists public.zz_prov_r2();
drop function if exists public.zz_prov_r3();
drop function if exists public.zz_prov_r4();
drop function if exists public.zz_prov_v1a();
drop function if exists public.zz_prov_v1b();
drop function if exists public.zz_prov_v2();
drop function if exists public.zz_prov_v3();

-- Indexet zz_prov_ddl_igen och policyn "zz prov" följer med tabellen.
drop table if exists public.zz_prov_ddl;
