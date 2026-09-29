-- ============================================================
-- Månadskörningens svar läses den 1:a
--
-- Körd 2026-09-29, sist av stegen i DEPLOY-BETALNING.md avsnitt 6, när
-- manadskorningens_svar_blir_en_uppgift var körd och funktionen körts
-- och lästs för hand. Fas 7:s regel: ett jobb schemaläggs när det gått
-- att köra och läsa för hand, aldrig före. Som postgres gav
--
--   select intern.manadskorning_vack(true);
--
-- en torrkörning som svarade 200, för augusti, och
--
--   select intern.manadskorning_svar();
--
-- läste den som lage ok och svar 200, utan uppgift.
--
-- Klockan 04:47 UTC den 1:a, en halvtimme efter manadskorning (04:17).
-- Funktionen läser anrop från den senaste timmen, så flyttas det ena
-- jobbet ska det andra flyttas med: rls-test.sql prövar båda schemana.
-- Med true är ett anrop som saknas också ett fel. Inget annat jobb går
-- 04:47 utom notis-minut.
-- ============================================================

select cron.unschedule(jobid) from cron.job where jobname = 'manadskorning-svar';
select cron.schedule('manadskorning-svar', '47 4 1 * *', $$select intern.manadskorning_svar(true)$$);
