-- ============================================================
-- Rabattkoden krockar inte med gratis timmar eller timbanken
-- (2026-10-13)
--
-- Leo: "rabattkoden, fixa det ... koden får inte krocka med gratis
-- timmar. jag ska bygga nytt system för gratis timmarna. gratis timmarna
-- räknas i timbanken".
--
-- Förut kunde ett pass få en kod och något annat på samma gång:
--   · Första timmen (forsta_timmen_bjuds) lades OVANPÅ koden, och passet
--     fick båda rabatterna.
--   · Tipstimmen gavs bara utan kod. En kod sköt timmen till ett senare
--     pass, och familjen fick koden i stället för timmen.
--   · Köpta timmar och timbankens minuter betalade passet också med en
--     kod. Koden stod kvar på passet och räknades som använd, fast den
--     inte ändrade något.
--
-- Nu gäller koden bara det familjen betalar med pengar:
--   1. EN GRATIS TIMME GÅR FÖRST. Får passet första timmen eller
--      tipstimmen tas koden bort från passet, och rabatten är timmen och
--      inget mer.
--   2. TIMBANKEN GÅR FÖRE KODEN. Betalar köpta timmar eller timbankens
--      minuter passet, när det skapas eller senare (bekräftelsen, jobbet
--      timmar-betalar, ett köp som blir betalt, Betala med timmar), tas
--      koden bort från passet.
--   3. Annars gäller koden, som förut (skydda_rabatt).
--
-- En kod som tas bort när passet skapas räknas inte som använd:
-- rakna_rabattkod räknar efter INSERT, med det BEFORE-triggrarna
-- lämnat. En kod som tas bort senare har redan räknats, som en kod på
-- ett pass som avbokas.
--
-- Gratistimmarna ska byggas om så att de står i timbanken. Då följer de
-- regel 2 utan att något här ändras.
--
-- Inget drop och inget delete. Funktionen lappas på driftens text
-- (pg_get_functiondef), med en vakt som räknar träffarna (kärnan avsnitt
-- 5), och en funktion som redan bär lappen hoppas över.
-- ============================================================

set local lock_timeout = '5s';

-- ------------------------------------------------------------
-- 1. Gratis timmar går före koden
-- ------------------------------------------------------------
do $lapp$
declare
  fore text := pg_get_functiondef('public.forsta_timmen_bjuds()'::regprocedure);
  ny   text;
  lappar text[][] := array[
    -- Första timmen: koden tas bort, och timmen läggs inte ovanpå den.
    array[$g$      new.startrabatt := true;
      new.rabatt_ore := least(coalesce(new.rabatt_ore, 0) + timme, brutto);
      return new;$g$,
          $n$      new.startrabatt := true;
      -- rabattkoden_krockar_inte (2026-10-13): timmen går före en kod, och
      -- de läggs inte ihop.
      new.rabattkod := null;
      new.rabatt_ore := least(timme, brutto);
      return new;$n$],
    -- Tipstimmen: ges också när familjen skrivit en kod, som då tas bort.
    array[$g$  if new.rabattkod is null
     and intern.tipstimmar_intjanade(new.parent_id) > intern.tipstimmar_anvanda(new.parent_id) then
    new.startrabatt := true;
    new.rabattkod := 'TIPS';
    new.rabatt_ore := least(coalesce(new.rabatt_ore, 0) + timme, brutto);
  end if;$g$,
          $n$  -- rabattkoden_krockar_inte (2026-10-13): också med en kod. Timmen
  -- går före koden, TIPS tar kodens plats, och de läggs inte ihop.
  if intern.tipstimmar_intjanade(new.parent_id) > intern.tipstimmar_anvanda(new.parent_id) then
    new.startrabatt := true;
    new.rabattkod := 'TIPS';
    new.rabatt_ore := least(timme, brutto);
  end if;$n$]
  ];
  i integer;
  n integer;
begin
  if position('rabattkoden_krockar_inte' in fore) > 0 then
    raise notice 'forsta_timmen_bjuds är redan lappad.';
    return;
  end if;
  ny := fore;
  for i in 1 .. array_length(lappar, 1) loop
    n := (length(ny) - length(replace(ny, lappar[i][1], ''))) / length(lappar[i][1]);
    if n <> 1 then
      raise exception 'forsta_timmen_bjuds: lapp % hittades % gånger, väntat 1. Läs driften.', i, n;
    end if;
    ny := replace(ny, lappar[i][1], lappar[i][2]);
  end loop;
  execute ny;
end $lapp$;


-- ------------------------------------------------------------
-- 2. Timbanken går före koden
--
-- En egen trigger i stället för lappar i varje väg som betalar med
-- timmar (intern.timmar_betala, klippkort_dra, timbank_dra): den ser
-- passet efter att timmarna betalat det, oavsett vem som betalade.
--
-- Namnet bestämmer ordningen: efter bookings_timmar_betalar och
-- bookings_timmar_betalar_forslaget, som betalar med timmarna, och före
-- bookings_timmarna_tillbaka, som ska vara den sista BEFORE-triggern.
-- Ingen UPDATE OF-lista: bekräftelsen skriver bara status, och timmarna
-- sätts av en BEFORE-trigger, som en UPDATE OF-trigger inte ser.
-- WHEN läser bara kolumner. timbank_betalt prövas i funktionen, som
-- ägs av databasen: den som bokar har ingen rätt till intern.
-- ------------------------------------------------------------
create or replace function intern.timmar_betalar_utan_kod()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.klippkort_id is not null or intern.timbank_betalt(new.id) then
    new.rabattkod := null;
    new.rabatt_ore := null;
  end if;
  return new;
end $$;

revoke execute on function intern.timmar_betalar_utan_kod() from public, anon, authenticated;

comment on function intern.timmar_betalar_utan_kod() is
  'rabattkoden_krockar_inte (2026-10-13): ett pass som köpta timmar eller timbankens minuter betalar bär ingen rabattkod. Koden gäller bara det familjen betalar med pengar.';

create or replace trigger bookings_timmar_betalar_utan_kod
  before insert or update on public.bookings
  for each row
  when (new.rabattkod is not null and new.rabattkod <> 'TIPS' and new.betalning_status = 'betald')
  execute function intern.timmar_betalar_utan_kod();
