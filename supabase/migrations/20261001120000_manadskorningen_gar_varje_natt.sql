-- ============================================================
-- Månadskörningen går varje natt (2026-10-01)
--
-- Leo 2026-10-01: "passen som är hållna i september ska spärras av för
-- september". fakturering lägger sedan samma dag ett pass som
-- rapporterats sent på sin egen månads utkast, i stället för på nästa
-- månads (PASSETS MÅNAD i fakturering/index.ts, malmanad() i
-- _delad/pris.ts). Det hjälper bara om körningen går efter att rapporten
-- skrivits. Den gick den 1:a och aldrig mer, så ett pass den 30
-- september som rapporterades på förmiddagen den 1 oktober kom med först
-- på oktobers underlag och faktura, en månad för sent.
--
-- Nu går jobbet varje natt 04:17 UTC, för förra månaden som förut. Den
-- 1:a skapar det månadens underlag och fakturautkast. Resten av månaden
-- lägger det till det som rapporterats eller valts som faktura sedan
-- natten före, så länge månadens utkast inte är godkänt eller skickat.
-- En natt utan något nytt skriver ingenting och svarar 200.
--
-- KÖRS EFTER att fakturering med PASSETS MÅNAD är driftsatt. Den gamla
-- funktionen hade krockat med månadens underlag varje natt där en
-- studiehjälpare hade ett sent pass, och svarat 207
-- (unique(tutor_id, period)).
--
-- manadskorning-svar flyttas med, en halvtimme efter (04:47): den läser
-- anrop från den senaste timmen. Uppgiften är fortfarande en per månad
-- (manadskorning:svar:ÅÅÅÅ-MM). En natt som går fel efter att månadens
-- uppgift stängts blir ingen ny uppgift; den står under System → Fel.
-- rls-test.sql prövar båda schemana.
-- ============================================================

select cron.unschedule(jobid) from cron.job where jobname = 'manadskorning';
select cron.schedule('manadskorning', '17 4 * * *', $$select intern.manadskorning_vack()$$);

select cron.unschedule(jobid) from cron.job where jobname = 'manadskorning-svar';
select cron.schedule('manadskorning-svar', '47 4 * * *', $$select intern.manadskorning_svar(true)$$);

comment on function intern.manadskorning_vack(boolean) is
  'Väcker fakturering, som skriver förra månadens underlag (studiehjälparnas lönespecifikationer) och '
  'fakturautkast, och lägger sent rapporterade pass till på utkasten. pg_cron manadskorning kör den varje natt. '
  'Med true torrkör den.';

comment on column public.notis_konfig.fakturering_url is
  'Adressen till edge-funktionen fakturering. intern.manadskorning_vack() väcker den varje natt '
  'med pg_net och hemligheten i x-nextrum-notis, och den skriver förra månadens underlag och fakturautkast. '
  'Null betyder att ingenting körs av sig självt, och då blir det en uppgift.';
