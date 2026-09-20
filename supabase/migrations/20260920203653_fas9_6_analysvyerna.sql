-- ============================================================
-- NEXTRUM — Fas 9.6: analysvyerna
--
-- Fem vyer, alla med security_invoker=true, så att RLS gäller:
-- en vy är inte en väg runt behörigheterna, den är bara en fråga
-- med ett namn.
--
-- TRE REGLER GÄLLER ALLA FEM:
--
-- 1. "Genomfört pass" betyder passunderlag.har_rapport, aldrig
--    status='completed'. Ordlistan i CLAUDE.md säger att passet är
--    genomfört först när rapporten finns, och tre av fem completed-
--    pass i driften saknar rapport. Räknas de med blir varje siffra
--    om verksamhet, ersättning och beläggning för hög.
--
-- 2. Varje rad bär underlag_rader: hur många rader ur grundtabellen
--    just den raden räknats fram ur. Planens test är att varje
--    nyckeltal ska gå att stämma av mot en rå SQL-fråga, och utan
--    den kolumnen går det bara att stämma av totalen.
--
-- 3. Luckor redovisas, de fylls inte. Anmälningar utan kalla,
--    avbokningar utan avbokad_at och konverteringar utan kund_id
--    får egna kolumner eller egna rader med null — de göms inte i
--    "direkt", i innevarande månad eller i "ej konverterad". En
--    lucka som ser ut som ett svar är värre än en tom ruta.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Anmälningar per källa
--
-- kalla är null för allt som kom in före Fas 9.5. Den raden är
-- OKÄND källa, inte "direkt" — gränssnittet måste säga det.
-- ------------------------------------------------------------
drop view if exists public.analys_leads_per_kalla;
create view public.analys_leads_per_kalla
with (security_invoker = true) as
select date_trunc('month', l.created_at at time zone 'Europe/Stockholm')::date as manad,
       l.kalla,
       l.medium,
       count(*)                                                as anmalningar,
       count(*) filter (where l.kontaktad_at is not null)      as kontaktade,
       count(*) filter (where l.status = 'matched')            as matchade,
       count(*) filter (where l.status = 'declined')           as avbojda,
       count(*) filter (where l.kund_id is not null)           as blev_kund,
       count(*)                                                as underlag_rader
from public.leads l
group by 1, 2, 3;

comment on view public.analys_leads_per_kalla is
  'Anmälningar per månad och kanal. kalla = null betyder okänd källa '
  '(anmälan kom in före Fas 9.5), inte direkttrafik.';

-- ------------------------------------------------------------
-- 2. Konvertering: anmälan → kund → elev → första genomförda pass
--
-- Kedjan hänger på leads.kund_id, som sätts vid konvertering sedan
-- Fas 7. Äldre anmälningar konverterades utan att kopplingen
-- skrevs, och de bakfylldes med flit inte: en gissad koppling blir
-- en påhittad konvertering. De räknas därför i ej_sparbara, som är
-- vyns egen varningslampa — är den hög är resten av raden för låg.
-- ------------------------------------------------------------
drop view if exists public.analys_konvertering;
create view public.analys_konvertering
with (security_invoker = true) as
select date_trunc('month', l.created_at at time zone 'Europe/Stockholm')::date as manad,
       count(*)                                           as anmalningar,
       count(*) filter (where l.kontaktad_at is not null) as kontaktade,
       count(*) filter (where l.kund_id is not null)      as blev_kund,
       count(*) filter (
         where l.kund_id is not null
           and exists (select 1 from public.students s where s.parent_id = l.kund_id)
       )                                                  as fick_elev,
       count(*) filter (
         where l.kund_id is not null
           and exists (select 1 from public.students s
                        where s.parent_id = l.kund_id and s.matched_tutor_id is not null)
       )                                                  as blev_matchad,
       count(*) filter (
         where l.kund_id is not null
           and exists (select 1 from public.passunderlag p
                        where p.parent_id = l.kund_id and p.har_rapport)
       )                                                  as fick_forsta_passet,
       count(*) filter (where l.kund_id is null and l.status = 'matched')
                                                          as ej_sparbara,
       count(*)                                           as underlag_rader
from public.leads l
group by 1;

comment on view public.analys_konvertering is
  'Trattens fyra steg per månad. ej_sparbara = anmälningar som är märkta '
  'matchade men saknar kund_id; de kan inte följas vidare, och ingen '
  'koppling gissas fram. Är ej_sparbara hög är resten av raden för låg.';

-- ------------------------------------------------------------
-- 3. Aktiva elever och studiehjälpare
--
-- Aktiv = höll eller fick minst ett GENOMFÖRT pass under månaden.
-- Inte "finns i tabellen": en elev som inte haft ett pass på ett
-- halvår är inte aktiv, hur många rader hen än har.
-- ------------------------------------------------------------
drop view if exists public.analys_aktiva;
create view public.analys_aktiva
with (security_invoker = true) as
select date_trunc('month', p.wanted_date)::date        as manad,
       count(distinct p.student_id)                    as aktiva_elever,
       count(distinct p.tutor_id)                      as aktiva_studiehjalpare,
       count(*)                                        as genomforda_pass,
       coalesce(sum(p.duration_min), 0)                as minuter,
       count(*) filter (where p.student_id is null)    as pass_utan_elev,
       count(*)                                        as underlag_rader
from public.passunderlag p
where p.har_rapport
group by 1;

comment on view public.analys_aktiva is
  'Aktiv betyder minst ett genomfört pass under månaden — alltså ett pass '
  'med rapport. pass_utan_elev räknar pass som inte är kopplade till någon '
  'elev; de kan inte räknas in i aktiva_elever.';

-- ------------------------------------------------------------
-- 4. Pass, fakturerat, betalt och utbetalt
--
-- Månaden kommer från TRE håll: passet från wanted_date, fakturan
-- och underlaget från period. De är inte samma månad, och de ska
-- inte tvingas vara det — ett pass i mars faktureras i april.
-- Därför en ryggrad av månader och tre vänsterjoins, inte en join
-- mellan pass och fakturor.
-- ------------------------------------------------------------
drop view if exists public.analys_ekonomi;
create view public.analys_ekonomi
with (security_invoker = true) as
with manader as (
  select date_trunc('month', p.wanted_date)::date as manad
    from public.passunderlag p where p.har_rapport
  union
  select date_trunc('month', i.period)::date from public.invoices i
  union
  select date_trunc('month', u.period)::date from public.payouts u
),
pass as (
  select date_trunc('month', p.wanted_date)::date as manad,
         count(*) as genomforda_pass,
         coalesce(sum(p.duration_min), 0) as minuter,
         count(*) filter (where not p.fakturerad) as ej_fakturerade,
         count(*) filter (where not p.pa_underlag) as ej_pa_underlag
    from public.passunderlag p where p.har_rapport group by 1
),
fakt as (
  select date_trunc('month', i.period)::date as manad,
         count(*) as fakturor,
         coalesce(sum(i.belopp_ore), 0) as fakturerat_ore,
         coalesce(sum(i.belopp_ore) filter (where i.betald_at is not null), 0) as betalt_ore,
         coalesce(sum(i.rut_ore), 0) as rut_ore
    from public.invoices i group by 1
),
utb as (
  select date_trunc('month', u.period)::date as manad,
         count(*) as underlag,
         coalesce(sum(u.belopp_ore), 0) as att_betala_ut_ore,
         coalesce(sum(u.belopp_ore) filter (where u.status = 'utbetald'), 0) as utbetalt_ore
    from public.payouts u group by 1
)
select m.manad,
       coalesce(p.genomforda_pass, 0)    as genomforda_pass,
       coalesce(p.minuter, 0)            as minuter,
       coalesce(p.ej_fakturerade, 0)     as ej_fakturerade,
       coalesce(p.ej_pa_underlag, 0)     as ej_pa_underlag,
       coalesce(f.fakturor, 0)           as fakturor,
       coalesce(f.fakturerat_ore, 0)     as fakturerat_ore,
       coalesce(f.betalt_ore, 0)         as betalt_ore,
       coalesce(f.rut_ore, 0)            as rut_ore,
       coalesce(u.underlag, 0)           as underlag,
       coalesce(u.att_betala_ut_ore, 0)  as att_betala_ut_ore,
       coalesce(u.utbetalt_ore, 0)       as utbetalt_ore,
       coalesce(p.genomforda_pass, 0) + coalesce(f.fakturor, 0)
         + coalesce(u.underlag, 0)       as underlag_rader
from manader m
left join pass p on p.manad = m.manad
left join fakt f on f.manad = m.manad
left join utb  u on u.manad = m.manad;

comment on view public.analys_ekonomi is
  'Passets månad är wanted_date, fakturans och underlagets är period. De är '
  'olika månader med flit — ett pass i mars faktureras i april. Belopp i ören.';

-- ------------------------------------------------------------
-- 5. Avbokningar
--
-- manad = null är avbokningar från före Fas 9.4, då avbokad_at inte
-- fanns. De går inte att placera i en månad, och de placeras därför
-- inte: de får en egen rad. Att lägga dem på wanted_date hade varit
-- att räkna en avbokning i mars som en avbokning i maj.
--
-- avbokningsskal är null tills admin satt en kod. Ett skäl som
-- saknas är inte "annat".
-- ------------------------------------------------------------
drop view if exists public.analys_avbokningar;
create view public.analys_avbokningar
with (security_invoker = true) as
select date_trunc('month', b.avbokad_at at time zone 'Europe/Stockholm')::date as manad,
       b.avbokningsskal,
       count(*)                                                        as avbokningar,
       count(*) filter (where b.avbokad_av = b.parent_id)              as av_familjen,
       count(*) filter (where b.avbokad_av = b.tutor_id)               as av_studiehjalparen,
       count(*) filter (where b.avbokad_av is not null
                          and b.avbokad_av is distinct from b.parent_id
                          and b.avbokad_av is distinct from b.tutor_id) as av_nagon_annan,
       count(*) filter (where b.avbokad_av is null)                    as utan_avsandare,
       count(*)                                                        as underlag_rader
from public.bookings b
where b.status = 'cancelled'
group by 1, 2;

comment on view public.analys_avbokningar is
  'manad = null är avbokningar från före Fas 9.4, då tidpunkten inte '
  'sparades. De placeras inte i en månad de inte hör hemma i. '
  'avbokningsskal = null betyder att admin inte satt någon kod — inte "annat".';
