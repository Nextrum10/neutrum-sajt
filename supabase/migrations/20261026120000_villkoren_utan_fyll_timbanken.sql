-- ============================================================
-- NEXTRUM — villkoren utan Fyll timbanken (2026-10-26)
--
-- Leo 2026-10-26: "fixa villkoren". Fyll timbanken säljs inte sedan
-- 2026-10-24 (PR #331: bara planerna Basic, Standard och Intensiv, och
-- stripe-checkout nekar ett köp av en annan sort), men användarvillkoren
-- sa fortfarande att timbanken fylls med en plan ELLER Fyll timbanken.
-- Versionen 2026-10-26 säger att timbanken fylls med en plan, att Fyll
-- timbanken inte säljs längre och att timmar som redan köpts med den
-- gäller som förut. Fyll timbanken är struken där villkoren räknar upp vad
-- man kan köpa (familjerabatten, betalningen, syskontillägget,
-- köpvillkoren, Planer och timbanken och ångerrätten). Reglerna för timmar
-- som redan köpts med den står kvar: sex månader, timbanken, prisgarantin
-- och Att sluta. Inga köp av Fyll timbanken fanns i driften.
--
-- Syskontilläggets egen version (tillagg_installning.villkor_version,
-- 2026-10-23) står kvar: dess regel är densamma, och bara listan över köp
-- av timmar i punkten tappade en sort som inte säljs. Strömbrytaren
-- syskonskuld står av, och ingen familj har godkänt tillägget.
--
-- Det är en ny version, så alla får frågan igen vid nästa inloggning, och
-- ingen föreslår pass eller köper timmar innan dess (bookings_kraver_villkor,
-- klippkort_kraver_villkor). Den sena avbokningen gäller fortfarande pass
-- som föreslogs efter ett godkännande av 2026-10-23 eller senare
-- (intern.familjen_har_avbokningsregeln jämför med >=), så den som godkänner
-- 2026-10-26 omfattas som förut. Datumet är dagen villkoren går ut; blir
-- det en annan dag byts det här och på båda sidorna (kolla-villkor.py).
-- ============================================================

-- ---------- 0. vakten ----------
-- Villkoren skrevs mot versionen i driften 2026-10-26. Har någon annan
-- bytt den sedan dess står en annan text på sidan än den här filen utgår
-- från: läs driften och sidan innan filen skrivs om.
do $vakt$
begin
  if intern.villkor_version() <> '2026-10-23' then
    raise exception 'Villkorens version är %, inte 2026-10-23 som den här filen utgår från. Läs driften.',
      intern.villkor_version();
  end if;
end $vakt$;


-- ---------- 1. versionen ----------
create or replace function intern.villkor_version()
returns text
language sql
immutable
set search_path = pg_temp
as $$ select '2026-10-26'::text $$;
