-- ============================================================
-- NEXTRUM — avidentifieringen och kontogenomgången schemaläggs
--
-- Funktionerna kom i intresseanmalningar_avidentifieras_konton_granskas
-- och provades mot driften den 27 september 2026 i ett block som
-- alltid rullades tillbaka, med mejltriggern ny-intresseanmalan
-- avstängd under provet: en anmälan åtta månader gammal utan kontakt
-- avidentifierades (namn, e-post, barnets namn, fritext och notering
-- tomma, källa och årskurs kvar), en lika gammal som kontaktats för
-- två månader sedan och en en månad gammal stod kvar, den riktiga
-- anmälan rördes inte, och inget konto var gammalt nog för en uppgift.
--
-- Anmälningarna en gång per natt, 03:47 UTC, efter ansokan-gallring.
-- Kontona den första i månaden, 04:53 UTC: en uppgift om ett konto
-- som varit oanvänt i två år har ingen brådska, och skapa_uppgift()
-- skapar ingen ny så länge en öppen med samma nyckel finns.
-- ============================================================

select cron.unschedule(jobid) from cron.job where jobname in ('leads-avidentifiering', 'konton-oanvanda');
select cron.schedule('leads-avidentifiering', '47 3 * * *', $$select intern.leads_avidentifiera()$$);
select cron.schedule('konton-oanvanda', '53 4 1 * *', $$select intern.konton_oanvanda()$$);
