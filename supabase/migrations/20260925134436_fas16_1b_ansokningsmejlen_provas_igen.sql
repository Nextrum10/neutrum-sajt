-- ============================================================
-- NEXTRUM — Fas 16.1b: ansökningsmejlen prövas igen av sig själva
--
-- intern.ansokan_besked_igen() kom med Fas 16.1 men schemalades inte
-- där. Fas 7:s regel: ett jobb schemaläggs när det gått att köra och
-- läsa för hand, aldrig före. Det har det nu: en rad satt som 'fel'
-- togs upp av svepet, skickades igen med samma idempotensnyckel och
-- landade som 'skickad' på andra försöket.
--
-- Utan jobbet är ett mejl som inte gick fram borta för gott. Triggern
-- väcker funktionen en gång, och pg_net försöker inte igen: går
-- Resend ner i tio minuter får den som sökte under de tio minuterna
-- aldrig sitt kvitto, och den som fick sitt möte bokat då får aldrig
-- veta när det är.
--
-- Var femte minut räcker. Det är ingen kö som ska tömmas i takt med
-- att den fylls, det är ett skyddsnät under en väg som oftast går
-- fram på första försöket. Svepet tar högst tjugo rader, bara de
-- senaste dygnets, och ger upp efter tredje försöket; raden står då
-- kvar som 'fel' och syns i adminvyn.
-- ============================================================

select cron.unschedule(jobid) from cron.job where jobname = 'ansokan-besked';
select cron.schedule('ansokan-besked', '*/5 * * * *', $$select intern.ansokan_besked_igen()$$);
