-- ============================================================
-- FAS 14.2b — kortbetalningarna syns i siffrorna
--
-- analys_ekonomi räknade intäkten ur invoices. Sedan Fas 14.2 får
-- familjen ingen faktura, och vyn hade visat noll kronor för varje ny
-- månad medan pengarna kom in på kort. Adminvyns statistik läser vyn
-- direkt, och drift-agenten läser den genom ai_analys().
--
-- Nya kolumner, SIST, så att den som läser de gamla inte märker något
-- (create or replace view får bara lägga till kolumner i slutet):
--
--   · ej_betalda      — hållna och rapporterade pass som familjen inte
--                       betalat, på passets månad. Samma tre lägen som
--                       avvikelsen ej_betalt och OBETALDA_LAGEN i pris.ts.
--   · kortbetalningar, kortbetalt_ore, aterbetalt_ore — på
--                       BETALNINGSMÅNADEN, betald_at i svensk tid.
--
-- Månaden kommer nu från fyra håll. Ett pass den 3 mars som betalas
-- den 28 februari står på två månader, och det är rätt: pengarna kom
-- i februari och arbetet gjordes i mars. Att tvinga dem till samma
-- månad hade varit att flytta en av dem.
--
-- underlag_rader räknar kortbetalningarna också, så att talet går att
-- stämma av mot en rå fråga precis som förut.
--
-- ai_analys() behåller sin form, men betalt_ore är nu allt som betalats:
-- äldre fakturor plus kortbetalningar, efter återbetalningar. Förut var
-- det bara fakturor, och med månadsfakturan borta hade agenten läst
-- noll intäkt som ett tapp — samma fel REGEL 6 i dess systemprompt
-- varnar för, fast åt andra hållet.
-- ============================================================

create or replace view public.analys_ekonomi
with (security_invoker = true) as
with manader as (
  select date_trunc('month', p.wanted_date)::date as manad
    from public.passunderlag p where p.har_rapport
  union
  select date_trunc('month', i.period)::date from public.invoices i
  union
  select date_trunc('month', u.period)::date from public.payouts u
  union
  select date_trunc('month', b.betald_at at time zone 'Europe/Stockholm')::date
    from public.bookings b where b.betald_at is not null
),
pass as (
  select date_trunc('month', p.wanted_date)::date as manad,
         count(*) as genomforda_pass,
         coalesce(sum(p.duration_min), 0) as minuter,
         count(*) filter (where not p.fakturerad) as ej_fakturerade,
         count(*) filter (where not p.pa_underlag) as ej_pa_underlag,
         count(*) filter (where p.fakturerbar and not p.fakturerad
                            and p.betalning_status in ('ingen', 'vantar', 'misslyckad')) as ej_betalda
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
),
kort as (
  select date_trunc('month', b.betald_at at time zone 'Europe/Stockholm')::date as manad,
         count(*) as kortbetalningar,
         coalesce(sum(b.betalt_ore), 0) as kortbetalt_ore,
         coalesce(sum(b.aterbetald_ore), 0) as aterbetalt_ore
    from public.bookings b where b.betald_at is not null group by 1
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

comment on view public.analys_ekonomi is
  'Passets månad är wanted_date, fakturans och underlagets är period, '
  'kortbetalningens är betald_at i svensk tid. De är olika månader med '
  'flit — ett pass i mars kan betalas i februari och komma på underlaget '
  'i april. betalt_ore gäller bara äldre fakturor; kortbetalt_ore minus '
  'aterbetalt_ore är det som kommit in på kort. Belopp i ören.';

-- Hela funktionen. Det enda som är nytt är raden för betalt_ore.
create or replace function public.ai_analys(p_manader integer default 6)
 returns table(manad date, genomforda_pass bigint, minuter bigint, aktiva_elever bigint, aktiva_studiehjalpare bigint, anmalningar bigint, blev_kund bigint, fick_forsta_passet bigint, ej_sparbara bigint, fakturerat_ore bigint, betalt_ore bigint, utbetalt_ore bigint, avbokningar bigint)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with granser as (
    select (date_trunc('month', (now() at time zone 'Europe/Stockholm'))
            - make_interval(months => greatest(1, least(coalesce(p_manader, 6), 36)) - 1))::date as fran
  ),
  avbok as (
    select manad, sum(avbokningar) as avbokningar
      from public.analys_avbokningar where manad is not null group by 1
  )
  select e.manad,
         e.genomforda_pass::bigint,
         e.minuter::bigint,
         coalesce(a.aktiva_elever, 0)::bigint,
         coalesce(a.aktiva_studiehjalpare, 0)::bigint,
         coalesce(k.anmalningar, 0)::bigint,
         coalesce(k.blev_kund, 0)::bigint,
         coalesce(k.fick_forsta_passet, 0)::bigint,
         coalesce(k.ej_sparbara, 0)::bigint,
         e.fakturerat_ore::bigint,
         (e.betalt_ore + e.kortbetalt_ore - e.aterbetalt_ore)::bigint,
         e.utbetalt_ore::bigint,
         coalesce(v.avbokningar, 0)::bigint
    from public.analys_ekonomi e
    cross join granser g
    left join public.analys_aktiva a       on a.manad = e.manad
    left join public.analys_konvertering k on k.manad = e.manad
    left join avbok v                      on v.manad = e.manad
   where e.manad >= g.fran
   order by e.manad desc;
$function$;
