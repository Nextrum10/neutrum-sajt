-- ============================================================
-- Fyll timbanken: klippkorten till 399 kr i timmen, sex månader (2026-10-12, Leo)
--
-- Leo: "klippkort ska heta köp timmar till timbanken, de lägg ju in i
-- timbanken ... de ska kosta 399kr", och på frågan om timmarna ska gå
-- ut: "6 månader, fyll timbanken ska det heta".
--
--   kod        timmar  rabatt  giltig    förut
--   klipp10        10     0 %   6 mån     5 %, 6 mån
--   klipp20        20     0 %   6 mån     5 %, 6 mån
--   klipp30        30     0 %   6 mån     5 %, 6 mån
--   klipp60        60     0 %   6 mån     5 %, 12 mån
--   klipp100      100     0 %   6 mån     5 %, 18 mån
--
-- Med 399 kr i timmen: 3 990, 7 980, 11 970, 23 940 och 39 900 kr.
-- erbjudanden_pris räknar priset ur tjanster och rabatten, så ingen vy
-- och ingen funktion ändras för priset. Namnet är raden i Stripes kassa
-- och på kvittot (kassarad i _delad/erbjudanden.ts), och sorten heter
-- fortfarande 'klippkort' i databasen: det är samma sak som förut,
-- förbetalda timmar med ett sista datum, under ett nytt namn utåt.
--
-- Planerna rörs inte (379 kr i timmen, en månad). Strömbrytarens
-- beskrivning i flaggor säger Fyll timbanken i stället för klippkort.
--
--
-- DET SOM INTE RÖRS
--
-- Ett köpt kort bär sina frysta kolumner (timmar, rabatt_procent,
-- giltig_manader, timpris_ore, begart_ore), och villkoren lovar det
-- (prisgarantin). Inget klippkort var köpt 2026-10-12 (läst i driften:
-- det enda köpet är Leos Standardplan), men ingen update på klippkort
-- här ändå. Ett väntande köp med det gamla innehållet återanvänds inte
-- (sammaInnehall i stripe-checkout).
--
--
-- VILLKOREN
--
-- Villkoren sade "timmar i förväg till ett lägre pris: en plan ... eller
-- ett klippkort" och att 60 och 100 timmar gäller i 12 och 18 månader.
-- Texten är ny, och versionen byts till sidans datum
-- (verktyg/kolla-villkor.py), så alla får frågan igen vid nästa
-- inloggning och kan inte boka eller köpa timmar innan de svarat.
--
-- Körs efter merge, direkt: från merge säger prissidan 399 kr i rubriken
-- (siffrorna i korten skrivs ur vyn), och tills den här körts tar kassan
-- 379 kr och skriver det gamla namnet på kvittot. Ingen funktion behöver
-- driftsättas. Ingen drop och ingen delete. Går att köra två gånger.
-- ============================================================

-- ---------- katalogen ----------
update public.erbjudanden
   set namn = 'Fyll timbanken, ' || timmar || ' timmar',
       rabatt_procent = 0,
       giltig_manader = 6
 where sort = 'klippkort'
   and kod in ('klipp10', 'klipp20', 'klipp30', 'klipp60', 'klipp100')
   and (namn, rabatt_procent, giltig_manader)
       is distinct from ('Fyll timbanken, ' || timmar || ' timmar', 0, 6);

-- ---------- strömbrytarens text ----------
-- Adminvyn visar beskrivningen under Betalningar → Inställningar, och
-- den sade "Planer och klippkort". flaggor_stampla fryser beskrivningen
-- vid varje update, så den står av bara runt den här raden, som i
-- fas14_9_bokforingen_i_fortnox. flaggor_audit rörs inte: den loggar
-- bara när aktiv ändras, och det gör den inte här. vantar_pa är en
-- anteckning om driftsättningen och står kvar som den skrevs.
alter table public.flaggor disable trigger flaggor_stampla;

update public.flaggor
   set beskrivning = 'Planer och Fyll timbanken går att köpa i studievyn, och pass går att betala med köpta timmar. '
                  || 'Av: erbjudandena syns men går inte att köpa.'
 where kod = 'erbjudanden'
   and beskrivning like 'Planer och klippkort%';

alter table public.flaggor enable trigger flaggor_stampla;

do $$
begin
  if (select tgenabled from pg_trigger
       where tgrelid = 'public.flaggor'::regclass and tgname = 'flaggor_stampla') is distinct from 'O' then
    raise exception 'flaggor_stampla är inte påslagen igen.';
  end if;
end $$;

-- ---------- villkorens version ----------
create or replace function intern.villkor_version()
returns text
language sql
immutable
set search_path = pg_temp
as $$ select '2026-10-12'::text $$;
