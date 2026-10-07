-- ============================================================
-- Planerna heter Basic, Standard och Intensiv (2026-10-07, Leo)
--
-- Leo: "Ändra namnet på standard planen till basic planen och namnet på
-- intensiv planen till standard planen. Och skapa en intensiv plan med
-- 12 timmars läxhjälp varje månad. Basic planen kan ha 5% rabbat,
-- standard planen en timme på köpet och intensiv planen 5% rabbat."
-- Och på frågorna samma dag: Standard är 8 timmar där familjen betalar
-- för 7, och Intensiv är 12 timmar med 5 %, fast den då blir dyrare per
-- timme än Standard.
--
--   kod            namn      timmar  på köpet  rabatt  med 379 kr i timmen
--   plan_basic     Basic          4         0     5 %   1 440 kr (ordinarie 1 516)
--   plan_standard  Standard       8         1     0 %   2 653 kr (ordinarie 3 032)
--   plan_intensiv  Intensiv      12         0     5 %   4 320 kr (ordinarie 4 548)
--
--
-- NYA KODER, OCH DE GAMLA STÄNGS
--
-- 'standard' (4 timmar, −10 %) och 'intensiv' (8 timmar, −10 %) får inte
-- nytt innehåll. Leos testköp pekar på 'standard' med en främmande nyckel
-- utan ON UPDATE, så koden går inte att döpa om, och ett gammalt köp som
-- pekade på en kod med nytt innehåll hade sett ut som något annat än det
-- som köptes. Katalogen är historik, som uppdragen i NexLäx: nytt
-- innehåll får en ny kod. De gamla raderna stängs (aktiv = false) och
-- står kvar; köpen bär sina frysta kolumner och ändras inte.
--
-- Det skyddar också fönstret mellan merge och den här migrationen: den
-- nya prissidan frågar efter plan_*, som inte finns än, och döljer korten
-- i stället för att skriva ett pris kassan inte drar. Efter migrationen
-- finns de gamla koderna inte i vyn, och en gammal sida döljer sina.
--
--
-- EN TIMME PÅ KÖPET ÄR TIMMAR, INTE EN PROCENT
--
-- timmar_pa_kopet är hur många av timmarna som inte kostar något, och
-- priset är det rabatterade timpriset gånger de BETALDA timmarna. En
-- procent hade inte gått: en åttondel är 12,5 %, som inte ryms i
-- rabatt_procent (heltal), och med timpriset nedåt till hel krona (Fas
-- 16.1d) hade 12,5 % blivit 331 kr × 8 = 2 648 kr i stället för 7 × 379
-- = 2 653 kr. Det sidan lovar är "8 timmar för priset av 7", och det är
-- vad vyn räknar. Ett snittpris (331,63 kr) visas aldrig.
--
-- timmar betyder fortfarande ALLA timmar på kortet, också den på köpet.
-- Därför behöver inget av det som räknar ett köpt kort ändras:
-- klippkort_saldo drar varje pass ur alla timmarna, ångerrätten räknar
-- de använda timmarna till det timpris familjen faktiskt betalade
-- (betalt / timmar), och när en familj slutar räknas de använda timmarna
-- till ordinarie timpris, som förut. ordinarie_ore är också alla
-- timmarna, så "ni sparar" på Standard är en hel timme, 379 kr.
--
-- Kolumnen fryses i klippkort vid köpet, som rabatten, och står i
-- auditens vitlistor. Ett villkor håller den mindre än timmarna: ett
-- erbjudande där allt är på köpet kostar ingenting och kan inte köpas.
--
-- Vyn får kolumnen SIST: create or replace view får bara lägga till
-- kolumner i slutet, och de elva som fanns står kvar i samma ordning,
-- med samma namn och typer (lästa i driften 2026-10-07).
--
-- Körs efter merge och FÖRE stripe-checkout från main, som väljer
-- kolumnen. Ingen drop och ingen delete. Går att köra två gånger.
-- ============================================================

-- ---------- kolumnerna ----------
alter table public.erbjudanden add column if not exists timmar_pa_kopet int not null default 0;
alter table public.klippkort   add column if not exists timmar_pa_kopet int not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.erbjudanden'::regclass
                    and conname = 'erbjudanden_timmar_pa_kopet_check') then
    alter table public.erbjudanden add constraint erbjudanden_timmar_pa_kopet_check
      check (timmar_pa_kopet >= 0 and timmar_pa_kopet < timmar);
  end if;
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.klippkort'::regclass
                    and conname = 'klippkort_timmar_pa_kopet_check') then
    alter table public.klippkort add constraint klippkort_timmar_pa_kopet_check
      check (timmar_pa_kopet >= 0 and timmar_pa_kopet < timmar);
  end if;
end $$;

comment on column public.erbjudanden.timmar_pa_kopet is
  '2026-10-07. Hur många av timmarna som inte kostar något. Priset räknas i erbjudanden_pris på de andra.';
comment on column public.klippkort.timmar_pa_kopet is
  '2026-10-07. Fryst vid köpet, som rabatten. Timmarna på köpet ingår i timmar och dras som de andra.';

-- ---------- auditen ----------
-- Samma triggrar med kolumnen i listorna. create or replace trigger,
-- inte drop och create: samma namn, samma plats i namnordningen.
create or replace trigger erbjudanden_audit
  after update of aktiv, timmar, rabatt_procent, giltig_manader, timmar_pa_kopet on public.erbjudanden
  for each row execute function public.logga_andring(
    'erbjudande', 'kod', 'aktiv', 'timmar', 'rabatt_procent', 'giltig_manader', 'timmar_pa_kopet');

create or replace trigger klippkort_audit
  after insert or update of status, giltigt_till, aterbetald_ore on public.klippkort
  for each row execute function public.logga_andring(
    'klippkort', 'id', 'parent_id', 'erbjudande', 'timmar', 'timmar_pa_kopet', 'status', 'giltigt_till',
    'begart_ore', 'betalt_ore', 'aterbetald_ore');

-- ---------- priset ----------
create or replace view public.erbjudanden_pris with (security_invoker = true) as
select e.kod, e.sort, e.namn, e.timmar, e.rabatt_procent, e.giltig_manader, e.ordning,
       t.pris_per_timme_ore                                   as timpris_ore,
       -- Alla timmarna, också de på köpet: det familjen hade betalat utan erbjudandet.
       e.timmar * t.pris_per_timme_ore                        as ordinarie_ore,
       ((e.timmar - e.timmar_pa_kopet)
         * floor(t.pris_per_timme_ore::numeric * (100 - e.rabatt_procent) / 10000) * 100)::int
                                                              as pris_ore,
       (floor(t.pris_per_timme_ore::numeric * (100 - e.rabatt_procent) / 10000) * 100)::int
                                                              as rabatterat_timpris_ore,
       e.timmar_pa_kopet
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
  '2026-10-07. Priset per erbjudande: standardtjänstens timpris med rabatt, nedåt till hel krona (Fas 16.1d), gånger de betalda timmarna (timmar − timmar_pa_kopet). Enda stället priset räknas.';

grant select on public.erbjudanden_pris to anon, authenticated;

-- ---------- katalogen ----------
update public.erbjudanden set aktiv = false
 where kod in ('standard', 'intensiv') and aktiv;

insert into public.erbjudanden (kod, sort, namn, timmar, timmar_pa_kopet, rabatt_procent, giltig_manader, ordning) values
  ('plan_basic',    'plan', 'Basic',     4, 0, 5, 1, 10),
  ('plan_standard', 'plan', 'Standard',  8, 1, 0, 1, 20),
  ('plan_intensiv', 'plan', 'Intensiv', 12, 0, 5, 1, 25)
on conflict (kod) do nothing;
