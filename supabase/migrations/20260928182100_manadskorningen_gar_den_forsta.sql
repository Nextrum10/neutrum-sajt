-- ============================================================
-- NEXTRUM — månadskörningen går av sig själv den 1:a
--
-- INTE KÖRD I DRIFTEN ÄN (2026-09-28). Den körs sist av stegen i
-- DEPLOY-BETALNING.md avsnitt 6, när provpassen är undantagna och
-- väckningen torrkörts, och filen döps då om till versionen
-- apply_migration ger den.
--
-- intern.manadskorning_vack() kom i manadskorningen_vacks_av_databasen
-- men schemalades inte där. Fas 7:s regel: ett jobb schemaläggs när det
-- gått att köra och läsa för hand, aldrig före. Kör den torrt mot
-- driften först, select intern.manadskorning_vack(true), och läs svaret
-- i net._http_response: 200 med förra månadens sammanfattning, och
-- 401 för ett anrop utan hemligheten.
--
-- Den 1:a klockan 04:17 UTC, alltså 05:17 på vintern och 06:17 på
-- sommaren i Stockholm. Förra månaden är slut i svensk tid oavsett
-- sommartid (fakturering räknar månaden i Europe/Stockholm), och
-- lönespecifikationerna och fakturautkasten finns när dagen börjar:
-- fakturan ska gå ut den 1:a. Ett pass som rapporteras efter körningen
-- kommer med nästa månad, som med knappen (fakturering, PERIODEN), och
-- lönespecifikationen säger det under summan. Inget annat jobb går
-- 04:17 utom notis-minut.
-- ============================================================

select cron.unschedule(jobid) from cron.job where jobname = 'manadskorning';
select cron.schedule('manadskorning', '17 4 1 * *', $$select intern.manadskorning_vack()$$);
