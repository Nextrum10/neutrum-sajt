-- ============================================================
-- Fas 16.1d — timpriset i ett erbjudande är en hel krona
--
-- Fas 16.1 avrundade TOTALEN nedåt: 20 timmar à 379 kr med 5 % blev
-- 7 201 kr, medan studievyn och prissidan skrev "360 kr per timme".
-- 20 × 360 är 7 200. En sida som visar ett timpris och en summa som
-- inte går ihop är en fråga i första samtalet, och på 100 timmar är
-- glappet fem kronor åt fel håll för familjen.
--
-- Nu avrundas TIMPRISET nedåt till hel krona, och summan är timpriset
-- gånger timmarna. Rabatten blir fortfarande aldrig mindre än den som
-- står på sidan. Planerna ändras inte (341 kr × 4 och × 8 var redan
-- jämna); klippkorten blir en till fem kronor billigare.
--
-- rabatterat_timpris_ore läggs sist: create or replace view får bara
-- lägga till kolumner i slutet.
-- ============================================================

create or replace view public.erbjudanden_pris with (security_invoker = true) as
select e.kod, e.sort, e.namn, e.timmar, e.rabatt_procent, e.giltig_manader, e.ordning,
       t.pris_per_timme_ore                                   as timpris_ore,
       e.timmar * t.pris_per_timme_ore                        as ordinarie_ore,
       (e.timmar * floor(t.pris_per_timme_ore::numeric * (100 - e.rabatt_procent) / 10000) * 100)::int
                                                              as pris_ore,
       (floor(t.pris_per_timme_ore::numeric * (100 - e.rabatt_procent) / 10000) * 100)::int
                                                              as rabatterat_timpris_ore
  from public.erbjudanden e
  /* Samma regel som standard_tjanst(): den första aktiva tjänsten
     kunder kan köpa. Funktionen själv går inte att anropa som anon, och
     vyn läses av prissidan utan inloggning. */
  cross join lateral (
    select pris_per_timme_ore from public.tjanster
     where aktiv and for_kund order by ordning, kod limit 1
  ) t
 where e.aktiv and t.pris_per_timme_ore > 0;

comment on view public.erbjudanden_pris is
  'Fas 16.1d. Priset per erbjudande: standardtjänstens timpris med rabatt, nedåt till hel krona, gånger timmarna. Enda stället priset räknas.';

grant select on public.erbjudanden_pris to anon, authenticated;
