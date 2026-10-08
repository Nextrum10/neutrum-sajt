-- ============================================================
-- Timpriset 399 kr utan bindning, paketen 379 kr i timmen (2026-10-08, Leo)
--
-- Leo: "Läxhjälpen ska kosta 399kr standard obundet. Sen på våra paket
-- blir man bunden i 1 månad och de kostar 379kr per [timme]", och "inte
-- från utan för, detta är vårt takpris utan tillägg".
--
--   kod            timmar  på köpet  rabatt  med 399 kr i timmen
--   plan_basic         4         0     5 %   1 516 kr (ordinarie 1 596)
--   plan_standard      8         0     5 %   3 032 kr (ordinarie 3 192)
--   plan_intensiv     12         0     5 %   4 548 kr (ordinarie 4 788)
--   klipp10–100    10–100        0     5 %   379 kr i timmen, som förut 360
--
-- 399 × 0,95 = 379,05, och erbjudanden_pris rundar timpriset nedåt till
-- hel krona (Fas 16.1d): 379 kr. Rabatten är alltså densamma som förut
-- på Basic, Intensiv och klippkorten, och det är timpriset som flyttar
-- alla siffror. Standard förlorar sin timme på köpet ("8 timmar för
-- priset av 7") och får samma 5 % som de andra: paketen kostar 379 kr i
-- timmen, alla tre.
--
--
-- VAR PRISET STÅR
--
-- erbjudanden_pris har inget eget tal: vyn läser den första aktiva
-- tjänsten kunder kan köpa (läxhjälpen) och räknar rabatten på den
-- (läst i driften 2026-10-08). Därför ändras bara tjanster här, och
-- vyn står orörd. Triggern tjanster_synka_pris skriver samma pris till
-- prissattning, den gamla reserven som fortfarande har läsare
-- (AVVECKLA-PRISSATTNING.md); förvalet på dess kolumn följer med, så
-- att en tom tabell aldrig får tillbaka 379. Ingen funktion i public
-- eller intern har 379 eller 37900 i sin text (läst samma dag).
--
--
-- PLAN_STANDARD FÅR NYTT INNEHÅLL UNDER SAMMA KOD
--
-- Planerna fick nya koder 2026-10-07 för att ett köp pekade på den
-- gamla. Inget köp pekar på plan_standard (läst i driften 2026-10-08:
-- det enda köpet är Leos 'standard'), och ett köp bär ändå sina frysta
-- kolumner (timmar, timmar_pa_kopet, rabatt_procent, timpris_ore), så
-- ett framtida köp ändras inte av katalogen. Ett väntande köp med det
-- gamla innehållet återanvänds inte (sammaInnehall i stripe-checkout).
--
--
-- DET SOM INTE RÖRS
--
-- Priset är fryst på varje bokat pass (bookings.timpris_ore, Fas 19.5)
-- och på varje köpt kort (klippkort.timpris_ore och begart_ore), och
-- villkoren lovar det: en prishöjning gäller bara pass som bokas efter
-- den, och köpta timmar kostar aldrig mer (prisgarantin). Därför ingen
-- update på bookings eller klippkort. Syskontillägget (69 kr),
-- startrabatten och tipstimmen är oförändrade; startrabatten är en
-- timme till passets frysta pris och följer med av sig själv.
--
-- Körs efter merge, direkt: från merge säger sajten 399 kr
-- (nextrum-config.js), och tills den här körts tar kassan 379. Ingen
-- funktion behöver driftsättas före. Ingen drop och ingen delete. Går
-- att köra två gånger.
-- ============================================================

-- ---------- timpriset ----------
update public.tjanster
   set pris_per_timme_ore = 39900
 where kod = 'laxhjalp'
   and pris_per_timme_ore is distinct from 39900;

-- Triggern har redan skrivit raden; det här gör samma sak där triggern
-- saknas (en lokal kopia byggd utan den) och ändrar inget annars.
update public.prissattning
   set pris_per_timme_ore = 39900, uppdaterad = now()
 where pris_per_timme_ore is distinct from 39900;

alter table public.prissattning alter column pris_per_timme_ore set default 39900;

-- ---------- Standard ----------
update public.erbjudanden
   set rabatt_procent = 5, timmar_pa_kopet = 0
 where kod = 'plan_standard'
   and (rabatt_procent, timmar_pa_kopet) is distinct from (5, 0);

comment on view public.erbjudanden_pris is
  '2026-10-08. Priset per erbjudande: standardtjänstens timpris (399 kr) med rabatt, nedåt till hel krona (Fas 16.1d; 5 % ger 379 kr), gånger de betalda timmarna (timmar − timmar_pa_kopet). Enda stället priset räknas.';
