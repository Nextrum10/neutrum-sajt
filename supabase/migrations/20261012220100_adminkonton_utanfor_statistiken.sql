-- ============================================================
-- Adminkontona räknas inte i statistiken (2026-10-12)
--
-- Leo: "detta är för att vi inte ska ha riktiga konton i vyerna samt att
-- det ska visas felaktig statistik för oss, så våra adminkonton ska inte
-- synas i statistik men vi ska kunna förhandsgranska vyerna som om vi
-- hade riktiga konton".
--
-- Den som ville se studievyn hade ett adminkonto som också var förälder:
-- i driften 2026-10-12 hade ett av de två superadminkontona ett barn och
-- alla 16 passen i databasen. De räknades som verksamhet: aktiva elever,
-- genomförda pass, betalt och avbokningar. Förhandsvisningen i adminvyn
-- (nextrum-forhandsvisning.js) visar vyerna utan konto, och den här
-- migrationen tar bort det som redan finns ur siffrorna.
--
-- REGELN: en rad räknas inte när familjen eller studiehjälparen har en
-- adminroll (admin_roller, superadmin eller med behörigheter). Det gäller
-- de fem analysvyerna, och därmed Statistik i adminvyn och drift-agentens
-- siffror (ai_analys). Inget annat: passen, betalningarna, fakturorna och
-- lönerna står kvar där de står, och Betalningar, Månadens ekonomi och
-- Löner räknar som förut, för de är bokföring, inte statistik. Blir en av
-- oss en riktig studiehjälpare räknas inte de passen heller, så länge
-- rollen finns.
--
-- Testbetalningarna (stripe_skarp = false) räknades i analys_ekonomi fast
-- kärnan säger att de aldrig räknas (avsnitt 1); vyn räknar dem inte nu.
--
-- Vyerna är security_invoker, så frågan om en person är admin ställs som
-- den som läser. intern.utanfor_statistiken() svarar bara en admin och
-- databasen själv: en familj eller en studiehjälpare som läser en
-- analysvy får aldrig veta om någon annan är admin, och deras egna
-- siffror räknas som förut.
--
-- Kolumnerna är desamma, i samma ordning, så create or replace räcker, och
-- security_invoker skrivs ut igen: utan den hade create or replace tagit
-- bort den. Kommentarerna står kvar på vyerna. Inga drop.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Vem som inte räknas
-- ------------------------------------------------------------
create or replace function intern.utanfor_statistiken(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select uid is not null
     and ((auth.uid() is null and coalesce(auth.role(), '') <> 'anon')
          or public.is_admin()
          or public.har_behorighet('admin_hantera'))
     and exists (select 1 from public.admin_roller r where r.user_id = uid)
$$;

comment on function intern.utanfor_statistiken(uuid) is
  'Sant när kontot har en adminroll och den som frågar är admin eller databasen själv '
  '(adminkonton_utanfor_statistiken, 2026-10-12). Analysvyerna räknar inte en sådan familj eller studiehjälpare.';

-- Vyerna är security_invoker: funktionen körs som den som läser dem.
revoke all on function intern.utanfor_statistiken(uuid) from public;
grant execute on function intern.utanfor_statistiken(uuid) to anon, authenticated, service_role;


-- ------------------------------------------------------------
-- 2. Anmälningar per källa, och konverteringen
--
-- En anmälan som blev ett adminkonto (vi provade formuläret och tog in
-- oss själva) räknas inte. En anmälan utan konto räknas som förut.
-- ------------------------------------------------------------
create or replace view public.analys_leads_per_kalla
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
where not intern.utanfor_statistiken(l.kund_id)
group by 1, 2, 3;

create or replace view public.analys_konvertering
with (security_invoker = true) as
select date_trunc('month', l.created_at at time zone 'Europe/Stockholm')::date as manad,
       count(*)                                                            as anmalningar,
       count(*) filter (where l.kontaktad_at is not null)                  as kontaktade,
       count(*) filter (where l.kund_id is not null)                       as blev_kund,
       count(*) filter (where l.kund_id is not null
                          and exists (select 1 from public.students s
                                       where s.parent_id = l.kund_id))      as fick_elev,
       count(*) filter (where l.kund_id is not null
                          and exists (select 1 from public.students s
                                       where s.parent_id = l.kund_id
                                         and s.matched_tutor_id is not null)) as blev_matchad,
       count(*) filter (where l.kund_id is not null
                          and exists (select 1 from public.passunderlag p
                                       where p.parent_id = l.kund_id
                                         and p.har_rapport))                as fick_forsta_passet,
       count(*) filter (where l.kund_id is null and l.status = 'matched')  as ej_sparbara,
       count(*)                                                            as underlag_rader
from public.leads l
where not intern.utanfor_statistiken(l.kund_id)
group by 1;


-- ------------------------------------------------------------
-- 3. Aktiva elever och genomförda pass
-- ------------------------------------------------------------
create or replace view public.analys_aktiva
with (security_invoker = true) as
select date_trunc('month', p.wanted_date)::date              as manad,
       count(distinct p.student_id)                          as aktiva_elever,
       count(distinct p.tutor_id)                            as aktiva_studiehjalpare,
       count(*)                                              as genomforda_pass,
       coalesce(sum(p.duration_min), 0)                      as minuter,
       count(*) filter (where p.student_id is null)          as pass_utan_elev,
       count(*)                                              as underlag_rader
from public.passunderlag p
where p.har_rapport
  and not intern.utanfor_statistiken(p.parent_id)
  and not intern.utanfor_statistiken(p.tutor_id)
group by 1;


-- ------------------------------------------------------------
-- 4. Avbokningarna
-- ------------------------------------------------------------
create or replace view public.analys_avbokningar
with (security_invoker = true) as
select date_trunc('month', b.avbokad_at at time zone 'Europe/Stockholm')::date as manad,
       b.avbokningsskal,
       count(*)                                                    as avbokningar,
       count(*) filter (where b.avbokad_av = b.parent_id)          as av_familjen,
       count(*) filter (where b.avbokad_av = b.tutor_id)           as av_studiehjalparen,
       count(*) filter (where b.avbokad_av is not null
                          and b.avbokad_av is distinct from b.parent_id
                          and b.avbokad_av is distinct from b.tutor_id) as av_nagon_annan,
       count(*) filter (where b.avbokad_av is null)                as utan_avsandare,
       count(*)                                                    as underlag_rader
from public.bookings b
where b.status = 'cancelled'
  and not intern.utanfor_statistiken(b.parent_id)
  and not intern.utanfor_statistiken(b.tutor_id)
group by 1, 2;


-- ------------------------------------------------------------
-- 5. Ekonomin
--
-- Samma fem delar som förut. Familjens pass, fakturor och betalningar
-- och studiehjälparens underlag räknas inte när personen är admin, och en
-- testbetalning räknas aldrig.
-- ------------------------------------------------------------
create or replace view public.analys_ekonomi
with (security_invoker = true) as
with manader as (
  select date_trunc('month', p.wanted_date)::date as manad
    from public.passunderlag p
   where p.har_rapport
     and not intern.utanfor_statistiken(p.parent_id) and not intern.utanfor_statistiken(p.tutor_id)
  union
  select date_trunc('month', i.period)::date from public.invoices i
   where not intern.utanfor_statistiken(i.parent_id)
  union
  select date_trunc('month', u.period)::date from public.payouts u
   where not intern.utanfor_statistiken(u.tutor_id)
  union
  select date_trunc('month', b.betald_at at time zone 'Europe/Stockholm')::date
    from public.bookings b
   where b.betald_at is not null and b.stripe_skarp is not false
     and not intern.utanfor_statistiken(b.parent_id) and not intern.utanfor_statistiken(b.tutor_id)
),
pass as (
  select date_trunc('month', p.wanted_date)::date as manad,
         count(*) as genomforda_pass,
         coalesce(sum(p.duration_min), 0) as minuter,
         count(*) filter (where not p.fakturerad) as ej_fakturerade,
         count(*) filter (where not p.pa_underlag) as ej_pa_underlag,
         count(*) filter (where p.fakturerbar and not p.fakturerad
                            and p.betalning_status in ('ingen', 'vantar', 'misslyckad')) as ej_betalda
    from public.passunderlag p
   where p.har_rapport
     and not intern.utanfor_statistiken(p.parent_id) and not intern.utanfor_statistiken(p.tutor_id)
   group by 1
),
fakt as (
  select date_trunc('month', i.period)::date as manad,
         count(*) as fakturor,
         coalesce(sum(i.belopp_ore), 0) as fakturerat_ore,
         coalesce(sum(i.belopp_ore) filter (where i.betald_at is not null), 0) as betalt_ore,
         coalesce(sum(i.rut_ore), 0) as rut_ore
    from public.invoices i
   where not intern.utanfor_statistiken(i.parent_id)
   group by 1
),
utb as (
  select date_trunc('month', u.period)::date as manad,
         count(*) as underlag,
         coalesce(sum(u.belopp_ore), 0) as att_betala_ut_ore,
         coalesce(sum(u.belopp_ore) filter (where u.status = 'utbetald'), 0) as utbetalt_ore
    from public.payouts u
   where not intern.utanfor_statistiken(u.tutor_id)
   group by 1
),
kort as (
  select date_trunc('month', b.betald_at at time zone 'Europe/Stockholm')::date as manad,
         count(*) as kortbetalningar,
         coalesce(sum(b.betalt_ore), 0) as kortbetalt_ore,
         coalesce(sum(b.aterbetald_ore), 0) as aterbetalt_ore
    from public.bookings b
   where b.betald_at is not null and b.stripe_skarp is not false
     and not intern.utanfor_statistiken(b.parent_id) and not intern.utanfor_statistiken(b.tutor_id)
   group by 1
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
         + coalesce(u.underlag, 0) + coalesce(k.kortbetalningar, 0) as underlag_rader,
       coalesce(p.ej_betalda, 0)         as ej_betalda,
       coalesce(k.kortbetalningar, 0)    as kortbetalningar,
       coalesce(k.kortbetalt_ore, 0)     as kortbetalt_ore,
       coalesce(k.aterbetalt_ore, 0)     as aterbetalt_ore
from manader m
left join pass p on p.manad = m.manad
left join fakt f on f.manad = m.manad
left join utb  u on u.manad = m.manad
left join kort k on k.manad = m.manad;
