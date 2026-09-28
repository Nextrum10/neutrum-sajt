-- ============================================================
-- NEXTRUM — gallringen av ansökningar schemaläggs
--
-- intern.ansokan_gallring_vack() kom i ansokningar_gallras_efter_ett_ar
-- men schemalades inte där. Fas 7:s regel: ett jobb schemaläggs när
-- det gått att köra och läsa för hand, aldrig före. Det har det nu,
-- mot driften den 27 september 2026, med tre provansökningar och fyra
-- provfiler i hinken cv, uppladdade som anon genom Storage-API:t precis
-- som formuläret gör. Första körningen tog bort den avböjda ansökan och
-- dess CV, den nya ansökan utan CV och en fil utan ansökan, och lät den
-- godkända ansökan och en ung fil stå. Andra körningen, med den
-- godkända avböjd och den unga filen åldrad, tog resten. Båda svarade
-- 200 utan fel, auditloggen fick en ansokan.borttagen per ansökan, och
-- ett anrop utan hemligheten fick 401.
--
-- En gång per natt räcker: löftet gäller ett år, inte en minut. 03:41
-- UTC ligger efter notis-stada och cron-stada. Väckningen anropar
-- funktionen bara när något är förfallet, så en vanlig natt är ett par
-- räkningar i databasen och inget anrop alls.
-- ============================================================

select cron.unschedule(jobid) from cron.job where jobname = 'ansokan-gallring';
select cron.schedule('ansokan-gallring', '41 3 * * *', $$select intern.ansokan_gallring_vack()$$);
