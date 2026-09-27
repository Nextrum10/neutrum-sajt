-- ============================================================
-- Fas 20.3: ej_utbetalt räknar lönetiden, inte den bokade
--
-- Vyn räknade sum(duration_min), alltså det bokade. Sedan Fas 20.1 får
-- studiehjälparen lön för passunderlag.lon_min: den hållna tiden nedåt
-- alltid, uppåt bara när övertiden är betald. En vy som visar något
-- annat än underlaget den 25:e är en siffra någon litar på och som är fel.
--
-- Studiehjälparvyn läser inte vyn längre (Fas 20.2: ersättningen visas
-- månad för månad ur passunderlag), men den står kvar och är läsbar, så
-- den ska säga samma sak. Samma urval som förut: genomfört, med rapport,
-- fakturerbart och inte redan på ett underlag.
-- ============================================================

set local lock_timeout = '5s';

create or replace view public.ej_utbetalt with (security_invoker = true) as
select p.tutor_id,
       count(*) as pass,
       coalesce(sum(p.lon_min), 0::bigint) as minuter
  from public.passunderlag p
 where p.tutor_id is not null
   and p.fakturerbar
   and p.har_rapport
   and not p.pa_underlag
 group by p.tutor_id;
