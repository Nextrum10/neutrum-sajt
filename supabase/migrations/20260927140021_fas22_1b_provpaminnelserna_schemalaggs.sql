-- ============================================================
-- NEXTRUM — Fas 22.1b: påminnelserna om utbildningsprovet schemaläggs
--
-- intern.utbildningsprov_paminn() kom med Fas 22.1 men schemalades
-- inte där. Fas 7:s regel: ett jobb schemaläggs när det gått att köra
-- och läsa för hand, aldrig före. Det har det nu: i ett rullat prov
-- köade den påminnelsen dagen efter och den sista dagen en gång var,
-- också när den kördes två gånger, och för hand mot driften svarade den
-- 0 när inget prov var öppet.
--
-- Varje timme, på minut 13 för att inte krocka med timmar-gar-ut på
-- minut 7. Funktionen gör ingenting före klockan nio svensk tid, och
-- nyckeln (steg + sista dag) är unik, så en påminnelse går en gång
-- oavsett hur många gånger jobbet kör. Går den inte fram tar
-- ansokan-besked (var femte minut) om den, som alla ansökningsmejl.
-- ============================================================

select cron.unschedule(jobid) from cron.job where jobname = 'utbildningsprov-paminn';
select cron.schedule('utbildningsprov-paminn', '13 * * * *', $$select intern.utbildningsprov_paminn()$$);
