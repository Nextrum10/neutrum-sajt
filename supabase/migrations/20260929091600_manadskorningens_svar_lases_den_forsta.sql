-- ============================================================
-- Månadskörningens svar läses den 1:a
--
-- INTE KÖRD I DRIFTEN ÄN (2026-09-29). Körs efter
-- manadskorningens_svar_blir_en_uppgift, och först när funktionen körts
-- och lästs för hand. Fas 7:s regel: ett jobb schemaläggs när det gått
-- att köra och läsa för hand, aldrig före. Som postgres:
--
--   select intern.manadskorning_vack(true);
--
-- vänta en minut, och läs svaret:
--
--   select intern.manadskorning_svar();
--
-- Det ska vara lage ok och svar 200, utan uppgift. Döp sedan om filen
-- till versionen apply_migration ger den (CLAUDE.md avsnitt 5), och
-- gör det före den 1:a klockan 04:47 UTC, annars läses inte månadens
-- körning.
--
-- Klockan 04:47 UTC den 1:a, en halvtimme efter manadskorning (04:17).
-- Funktionen läser anrop från den senaste timmen, så flyttas det ena
-- jobbet ska det andra flyttas med: rls-test.sql prövar båda schemana.
-- Med true är ett anrop som saknas också ett fel. Inget annat jobb går
-- 04:47 utom notis-minut.
-- ============================================================

select cron.unschedule(jobid) from cron.job where jobname = 'manadskorning-svar';
select cron.schedule('manadskorning-svar', '47 4 1 * *', $$select intern.manadskorning_svar(true)$$);
