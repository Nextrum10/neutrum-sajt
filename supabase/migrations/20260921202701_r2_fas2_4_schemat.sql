-- ============================================================
-- NEXTRUM — program 2, Fas 2.4: schemat
--
-- Arbetaren har körts för hand ("Kör nu") och syns i notis_korningar.
-- Först nu väcks den varje minut. Fas 7:s regel: ett jobb schemaläggs
-- när det gått att köra och läsa för hand, aldrig före.
--
-- notis_minut planerar påminnelserna och väcker notis-ko bara när
-- något väntar, så en tom minut kostar en fråga och inget anrop.
-- Hemligheten läses ur notis_konfig när funktionen körs och står
-- därför aldrig i cron.job.
--
-- cron.job_run_details växer med en rad i minuten; den rensas efter en
-- vecka, annars är den tabellen större än allt annat inom ett år.
-- ============================================================

create extension if not exists pg_cron;

select cron.schedule('notis-minut', '* * * * *', $$select public.notis_minut()$$);
select cron.schedule('notis-stada', '17 3 * * *', $$select public.notis_stada()$$);
select cron.schedule('cron-stada', '23 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$);
