-- ============================================================
-- Fas 20.1: passet debiteras på den tid det faktiskt hölls
--
-- Leo 2026-09-27: "man måste kunna skriva in exakta tiden själv ifall
-- det har skett avvikelser så att vi kan debitera mer eller mindre".
-- Ett pass bokat på två timmar som höll på i två och en kvart ska
-- kosta två och en kvart, och ett som slutade efter en och en halv ska
-- kosta en och en halv.
--
-- TRE BESLUT, ALLA LEOS SAMMA DAG:
--
--   1. Per påbörjad kvart. 2 h 05 min debiteras som 2 h 15 min.
--   2. Är passet redan betalt (kort eller timmar) och det drog över,
--      betalar familjen TILLÄGGET med kort när de bekräftar rapporten.
--      Är det betalt och blev kortare larmar det med beloppet att
--      betala tillbaka (betalt_for_lange); timmar på ett klippkort går
--      tillbaka av sig själva.
--   3. Lönen följer tiden NEDÅT alltid, UPPÅT bara när övertiden är
--      betald. Den som skriver in tiden är den som får lönen, och en
--      längre tid ingen betalat för ska inte bli en högre lön.
--
-- TIDEN STÅR PÅ RAPPORTEN, INTE PÅ PASSET. Passet bär det som
-- bokades, och det ska det fortsätta göra: ångerrätten, klippkortets
-- draget och skydda_bokningsfalt läser duration_min som det avtalade.
-- Rapporten är där studiehjälparen säger vad som hände. Saknar
-- rapporten tid (äldre rapporter, fristående, en elev som uteblev)
-- gäller det bokade, precis som förut.
--
-- TIDEN ÄNDRAS INTE I EFTERHAND AV STUDIEHJÄLPAREN. Policyn låter hen
-- uppdatera sin egen rapport, och RLS kan inte begränsa kolumner. Utan
-- spärren hade tiden gått att dra ut efter att familjen bekräftat och
-- betalat, och lönen hade följt med. En felskriven tid rättar admin.
--
-- EN AVVIKELSE KRÄVER ETT SKÄL. Familjen ser skälet bredvid tiden när
-- de bekräftar rapporten, och admin ser det i passets detalj. Skälet
-- mejlas aldrig: notis_vid_rapport läser inga fält ur rapporten.
--
-- TILLÄGGET ÄR EN EGEN BETALNING I EN EGEN TABELL, inte fler kolumner
-- på passet. Passets betalningskolumner beskriver EN betalning, och
-- stripe-webhook skriver återbetalningar och tvister på den rad som
-- bär chargen. Hade tillägget legat på samma rad hade en återbetalning
-- av tillägget skrivit över passets egen.
--
-- stripe_minuter är hur många minuter kortbetalningen avsåg, skrivet
-- av webhooken ur sessionens metadata. Namnet börjar med stripe_ med
-- flit: skydda_bokningsfalt nekar redan varje stripe_-kolumn på ett
-- nytt pass, och ett bokat pass släpper bara igenom sin vitlista. Ingen
-- familj kan alltså skriva att hen betalat för tre timmar.
-- ============================================================

set local lock_timeout = '5s';

-- ---------- rapporten bär tiden ----------
alter table public.lesson_reports
  add column start_tid      time,
  add column slut_tid       time,
  add column avvikelse_skal text,
  add column hallna_min     int generated always as
    ((extract(epoch from (slut_tid - start_tid)) / 60)::int) stored,
  -- Per påbörjad kvart. Räknas ur tiderna, inte ur hallna_min: en
  -- genererad kolumn får inte läsa en annan.
  add column debiterade_min int generated always as
    ((ceil(extract(epoch from (slut_tid - start_tid)) / 60 / 15.0) * 15)::int) stored;

alter table public.lesson_reports
  add constraint lesson_reports_tid_hel
    check ((start_tid is null) = (slut_tid is null)),
  -- Samma dag, framåt. Ett pass över midnatt finns inte.
  add constraint lesson_reports_tid_ordning
    check (slut_tid > start_tid),
  -- Tre timmar bokade och en timme över är gränsen för vad som går att
  -- skriva in. Mer än så är ett skrivfel, inte ett pass.
  add constraint lesson_reports_tid_langd
    check (slut_tid - start_tid <= interval '4 hours'),
  add constraint lesson_reports_tid_har_pass
    check (start_tid is null or booking_id is not null),
  -- Uteblev eleven kostar passet det bokade (villkoren), och en tid
  -- hade sett ut som att något hölls.
  add constraint lesson_reports_tid_inte_uteblev
    check (start_tid is null or narvaro is distinct from 'franvarande'),
  add constraint lesson_reports_avvikelse_skal_langd
    check (avvikelse_skal is null or char_length(avvikelse_skal) between 1 and 300);

comment on column public.lesson_reports.start_tid is
  'Fas 20.1: när passet faktiskt började. Saknas den gäller det bokade.';
comment on column public.lesson_reports.debiterade_min is
  'Fas 20.1: den hållna tiden per påbörjad kvart. Det familjen betalar för, och lönen nedåt.';
comment on column public.lesson_reports.avvikelse_skal is
  'Fas 20.1: varför passet blev längre eller kortare än bokat. Krävs vid avvikelse, visas för familjen.';

-- ---------- skyddet ----------
create or replace function intern.skydda_rapportens_tid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bokat  int;
  debit  int;
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.start_tid is distinct from old.start_tid
       or new.slut_tid is distinct from old.slut_tid
       or new.avvikelse_skal is distinct from old.avvikelse_skal then
      raise exception using errcode = '42501',
        message = 'Tiden i rapporten ändras inte i efterhand. Skriv till Nextrum om den blev fel.';
    end if;
    return new;
  end if;

  new.avvikelse_skal := nullif(btrim(new.avvikelse_skal), '');
  if new.start_tid is null then
    new.avvikelse_skal := null;
    return new;
  end if;

  /* En andra rapport på samma pass får inte ha en egen tid. Två tider
     på ett pass hade gett två svar på vad det kostar. */
  if exists (select 1 from public.lesson_reports r
              where r.booking_id = new.booking_id and r.start_tid is not null) then
    raise exception using errcode = '42501',
      message = 'Passet har redan en rapport med tid.';
  end if;

  select b.duration_min into bokat from public.bookings b where b.id = new.booking_id;
  -- Genererade kolumner är inte räknade än i en before-trigger.
  debit := (ceil(extract(epoch from (new.slut_tid - new.start_tid)) / 60 / 15.0) * 15)::int;

  if debit is distinct from bokat then
    if new.avvikelse_skal is null then
      raise exception using errcode = '42501',
        message = 'Passet blev längre eller kortare än bokat. Skriv varför, så att familjen förstår beloppet.';
    end if;
  else
    -- Ingen avvikelse, inget skäl: ett skäl som inte förklarar något
    -- får familjen att leta efter en avvikelse som inte finns.
    new.avvikelse_skal := null;
  end if;

  return new;
end $$;

create trigger lesson_reports_skydda_tid
  before insert or update on public.lesson_reports
  for each row execute function intern.skydda_rapportens_tid();

revoke execute on function intern.skydda_rapportens_tid() from public, anon, authenticated;

-- Tiden hör till auditloggen: den styr pengar. Skälet är fritext och
-- står med flit inte med.
drop trigger if exists lesson_reports_audit on public.lesson_reports;
create trigger lesson_reports_audit
  after insert or update of booking_id, narvaro, start_tid, slut_tid on public.lesson_reports
  for each row execute function public.logga_andring(
    'rapport', 'id', 'booking_id', 'narvaro', 'student_id', 'tutor_id', 'lesson_date',
    'start_tid', 'slut_tid');

-- ---------- den debiterade tiden, på ett ställe ----------
/* Rapportens tid för ett pass, eller null. Anroparens RLS gäller:
   funktionen svarar bara om en rapport den som frågar redan får läsa.
   I intern, så att den inte blir ett API.

   EXECUTE står kvar för ALLA roller, också anon, med flit. Vyerna som
   anropar den är security_invoker, och ett villkor eller en vy körs som
   anroparen (avsnitt 6, Fas 10-fällan): en återkallad rättighet hade
   gjort klippkort_saldo till "permission denied" i stället för ett tomt
   svar. Funktionen lämnar inte ut något RLS inte redan lämnar ut. */
create or replace function intern.debiterade_min(p_booking uuid)
returns int
language sql
stable
set search_path = public
as $$
  select r.debiterade_min
    from public.lesson_reports r
   where r.booking_id = p_booking and r.start_tid is not null
   order by r.created_at
   limit 1
$$;

grant execute on function intern.debiterade_min(uuid) to anon, authenticated, service_role;

-- ---------- vad kortbetalningen avsåg ----------
alter table public.bookings
  add column stripe_minuter int check (stripe_minuter is null or stripe_minuter between 15 and 240);

comment on column public.bookings.stripe_minuter is
  'Fas 20.1: minuterna kortbetalningen avsåg, ur sessionens metadata. Bara stripe-webhook skriver den.';

-- ---------- tillägget ----------
create table public.pass_tillagg (
  id                          uuid primary key default gen_random_uuid(),
  booking_id                  uuid not null unique references public.bookings(id) on delete cascade,
  minuter                     int  not null check (minuter between 1 and 240),
  begart_ore                  int  not null check (begart_ore > 0),
  status                      text not null default 'vantar'
                              check (status in ('vantar', 'betald', 'misslyckad', 'aterbetald', 'tvist')),
  betalt_ore                  int,
  aterbetald_ore              int  not null default 0,
  betald_at                   timestamptz,
  stripe_session_id           text,
  stripe_payment_intent_id    text,
  stripe_charge_id            text unique,
  stripe_balanstransaktion_id text,
  stripe_avgift_ore           int,
  stripe_netto_ore            int,
  stripe_skarp                boolean,
  created_at                  timestamptz not null default now()
);

comment on table public.pass_tillagg is
  'Fas 20.1: familjen betalar övertiden på ett pass som redan var betalt. Skrivs bara av stripe-checkout och stripe-webhook.';

alter table public.pass_tillagg enable row level security;
revoke all on public.pass_tillagg from anon, authenticated;
grant select on public.pass_tillagg to authenticated;

-- Studiehjälparen läser för att hens timmar räknas ur den (lon_min).
create policy "parterna och admin läser tillägget"
  on public.pass_tillagg for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.bookings b
                where b.id = booking_id
                  and (b.parent_id = auth.uid() or b.tutor_id = auth.uid()))
  );

create trigger pass_tillagg_audit
  after insert or update of status, minuter, begart_ore, betalt_ore, aterbetald_ore
  on public.pass_tillagg
  for each row execute function public.logga_andring(
    'tillagg', 'id', 'booking_id', 'status', 'minuter', 'begart_ore', 'betalt_ore', 'aterbetald_ore');

-- ---------- passunderlaget ----------
/* Tre nya kolumner, sist så att vyerna som bygger på den står kvar, och
   efter de tre Fas 19.5 lade till samma dag (det frysta priset):
     debiterade_min  det familjen ska betala för
     betalda_min     det familjen har betalat för: kortet (stripe_minuter),
                     timmarna (upp till det bokade), fakturan (allt, den
                     byggs ur debiterade_min) och tillägget
     lon_min         det studiehjälparen får betalt för: den debiterade
                     tiden om den är kortare eller betald, annars den bokade */
create or replace view public.passunderlag with (security_invoker = true) as
select b.id,
       b.parent_id,
       b.tutor_id,
       b.student_id,
       b.subject,
       b.tjanst,
       b.wanted_date,
       b.wanted_time,
       b.duration_min,
       b.antal_barn,
       b.rabatt_ore,
       b.fakturerbar,
       b.fakturerbar_anledning,
       (exists (select 1 from public.lesson_reports r where r.booking_id = b.id)) as har_rapport,
       (exists (select 1 from public.invoice_lines l where l.booking_id = b.id)) as fakturerad,
       (exists (select 1 from public.payout_lines l where l.booking_id = b.id)) as pa_underlag,
       b.betalning_status,
       b.timpris_ore,
       b.extra_ore,
       b.startrabatt,
       t.deb as debiterade_min,
       t.betalda as betalda_min,
       case when t.deb <= b.duration_min or t.betalda >= t.deb then t.deb else b.duration_min end as lon_min
  from public.bookings b
  cross join lateral (select coalesce(intern.debiterade_min(b.id), b.duration_min) as deb) d
  cross join lateral (
    select d.deb,
           (case
              when b.betalning_status = 'faktura' then d.deb
              when b.betalning_status in ('betald', 'tvist') and b.klippkort_id is not null then b.duration_min
              when b.betalning_status in ('betald', 'tvist') then coalesce(b.stripe_minuter, b.duration_min)
              else 0
            end)
           + coalesce((select pt.minuter from public.pass_tillagg pt
                        where pt.booking_id = b.id and pt.status in ('betald', 'tvist')), 0) as betalda
  ) t
 where b.status = 'completed';

-- Studiehjälparens timmar är de hen får betalt för.
create or replace view public.arbetade_timmar with (security_invoker = true) as
select tutor_id,
       round(sum(lon_min)::numeric / 60.0, 2) as timmar_totalt,
       round(sum(lon_min) filter (where wanted_date >= date_trunc('week', current_date::timestamptz)::date)::numeric / 60.0, 2) as timmar_vecka,
       round(sum(lon_min) filter (where wanted_date >= date_trunc('month', current_date::timestamptz)::date)::numeric / 60.0, 2) as timmar_manad,
       count(*) as pass_totalt
  from public.passunderlag
 where tutor_id is not null
 group by tutor_id;

-- ---------- klippkortet: timmar går tillbaka när passet blev kortare ----------
/* Villkoren: "Varje påbörjad timme av passet drar en timme." Ett pass
   bokat på två timmar som slutade efter en drar alltså en. Övertiden
   drar INGA timmar: den betalas med kort som ett tillägg, för saldot
   kan vara slut, och en dragning ingen bett om är inte ett köp. */
create or replace view public.klippkort_saldo with (security_invoker = true) as
 select k.id,
    k.parent_id,
    k.erbjudande,
    k.namn,
    k.sort,
    k.timmar,
    coalesce(a.anvanda, 0) as anvanda,
    greatest(k.timmar - coalesce(a.anvanda, 0), 0) as kvar,
    k.giltigt_till,
    k.status,
    k.begart_ore,
    k.betalt_ore,
    k.aterbetald_ore,
    k.timpris_ore,
    k.betald_at,
    k.created_at,
    k.status = 'betald'::text and k.giltigt_till >= (now() at time zone 'Europe/Stockholm'::text)::date and (k.timmar - coalesce(a.anvanda, 0)) > 0 as brukbar,
    greatest(coalesce(k.betalt_ore, 0) - k.aterbetald_ore - coalesce(a.anvanda, 0) * k.timpris_ore, 0) as vid_uppsagning_ore,
    (k.betald_at at time zone 'Europe/Stockholm'::text)::date + 14 as angerfrist_till,
    greatest(coalesce(k.betalt_ore, 0) - k.aterbetald_ore - floor(coalesce(a.anvanda, 0)::numeric * coalesce(k.betalt_ore, 0)::numeric / k.timmar::numeric)::integer, 0) as vid_anger_ore
   from public.klippkort k
     left join lateral (
       select sum(greatest(1::numeric, ceil(least(coalesce(b.duration_min, 60),
                                                  coalesce(intern.debiterade_min(b.id), b.duration_min, 60))::numeric / 60.0)))::integer as anvanda
         from public.bookings b
        where b.klippkort_id = k.id and b.status <> 'cancelled'::text) a on true;

/* klippkort_dra LAPPAS, den skrivs inte om. Fas 19.5 lappade samma
   funktion samma dag (ett pass med första timmen bjuden betalas inte med
   timmar), och en omskrivning från en äldre kopia hade tagit bort det.
   Varje ersättning prövas: hittas texten inte exakt så många gånger som
   väntat rullas migrationen tillbaka. */
do $$
declare
  fore   text := pg_get_functiondef('public.klippkort_dra'::regproc);
  behov1 text := $g$  behov := greatest(1, ceil(coalesce(b.duration_min, 60) / 60.0))::int;$g$;
  behov2 text := $n$  /* Fas 20.1: ett genomfört pass som blev kortare än bokat drar bara
     de påbörjade timmar som hölls. Samma uttryck som i klippkort_saldo. */
  behov := greatest(1, ceil(least(coalesce(b.duration_min, 60),
                                  coalesce(intern.debiterade_min(b.id), b.duration_min, 60)) / 60.0))::int;$n$;
  anv1   text := $g$ceil(coalesce(x.duration_min, 60) / 60.0)$g$;
  anv2   text := $n$ceil(least(coalesce(x.duration_min, 60), coalesce(intern.debiterade_min(x.id), x.duration_min, 60)) / 60.0)$n$;
begin
  if (length(fore) - length(replace(fore, behov1, ''))) / length(behov1) <> 1 then
    raise exception 'klippkort_dra: raden med behov hittades inte exakt en gång.';
  end if;
  if (length(fore) - length(replace(fore, anv1, ''))) / length(anv1) <> 2 then
    raise exception 'klippkort_dra: de använda timmarna hittades inte exakt två gånger.';
  end if;
  execute replace(replace(fore, behov1, behov2), anv1, anv2);
end $$;

-- ---------- larmen ----------
/* avvikelser_rader LAPPAS också, av samma skäl: Fas 19.5 lade till att
   ett pass där rabatten täcker hela priset inte är obetalt. Två lappar:

   1. Fas 19.5:s villkor räknar på den debiterade tiden. Ett pass med
      första timmen bjuden som drog över har något att betala.
   2. Två nya larm före faktura_saknas:
        tillagg_obetalt   passet var betalt och drog över, och tillägget
                          är inte betalt. Samma sak som ej_betalt för
                          övertiden, och av samma skäl larmar det direkt.
                          Beloppet räknas i stripe-checkout.
        betalt_for_lange  betalt med kort för mer tid än passet höll.
                          Beloppet är det betalda minus vad den hållna
                          tiden kostar, till passets frysta pris och med
                          dess rabatt (Fas 19.5), minus det som redan
                          gått tillbaka. Återbetalningen är knappen under
                          Kortbetalningar. Timmar på ett klippkort går
                          tillbaka av sig själva. */
do $$
declare
  fore  text := pg_get_functiondef('public.avvikelser_rader'::regproc);
  pris1 text := $g$                    * coalesce(p.duration_min, 60) / 60.0))
  union all$g$;
  pris2 text := $n$                    * coalesce(p.debiterade_min, p.duration_min, 60) / 60.0))
  union all$n$;
  fore_faktura text := $g$  select 'faktura_saknas'$g$;
  nya text := $n$  -- FAS 20.1. Betalt, drog över, tillägget obetalt.
  select 'tillagg_obetalt', 'bookings', p.id::text, p.wanted_date, null, p.parent_id, p.tutor_id
    from public.passunderlag p
   where p.fakturerbar and p.betalning_status = 'betald'
     and p.debiterade_min > p.betalda_min
  union all
  -- FAS 20.1. Betalt med kort för mer tid än passet höll.
  select 'betalt_for_lange', 'bookings', x.id::text, x.wanted_date, x.kvar, x.parent_id, x.tutor_id
    from (
      select p.id, p.wanted_date, p.parent_id, p.tutor_id,
             (b.betalt_ore - coalesce(b.aterbetald_ore, 0)
              - greatest(round((p.timpris_ore
                                + case when coalesce(p.antal_barn, 1) > 1 then coalesce(p.extra_ore, 0) else 0 end)
                               * p.debiterade_min / 60.0)
                         - coalesce(p.rabatt_ore, 0), 0))::bigint as kvar
        from public.passunderlag p
        join public.bookings b on b.id = p.id
       where p.betalning_status = 'betald' and b.klippkort_id is null and b.betalt_ore is not null
         and p.timpris_ore is not null
         and p.debiterade_min < coalesce(b.stripe_minuter, b.duration_min)
    ) x
   where x.kvar > 0
  union all
  select 'faktura_saknas'$n$;
begin
  if (length(fore) - length(replace(fore, pris1, ''))) / length(pris1) <> 1 then
    raise exception 'avvikelser_rader: Fas 19.5:s prisvillkor hittades inte exakt en gång.';
  end if;
  if (length(fore) - length(replace(fore, fore_faktura, ''))) / length(fore_faktura) <> 1 then
    raise exception 'avvikelser_rader: faktura_saknas hittades inte exakt en gång.';
  end if;
  execute replace(replace(fore, pris1, pris2), fore_faktura, nya);
end $$;

-- ---------- vakten ----------
do $$
begin
  if position('Fas 20.1' in pg_get_functiondef('public.klippkort_dra'::regproc)) = 0
     or position('startrabatt' in pg_get_functiondef('public.klippkort_dra'::regproc)) = 0 then
    raise exception 'klippkort_dra blev inte ändrad, eller tappade Fas 19.5.';
  end if;
  if position('tillagg_obetalt' in pg_get_functiondef('public.avvikelser_rader'::regproc)) = 0
     or position('Fas 19.5' in pg_get_functiondef('public.avvikelser_rader'::regproc)) = 0 then
    raise exception 'avvikelser_rader blev inte ändrad, eller tappade Fas 19.5.';
  end if;
  if has_function_privilege('authenticated', 'intern.skydda_rapportens_tid()', 'execute') then
    raise exception 'En ny triggerfunktion går att anropa.';
  end if;
end $$;
