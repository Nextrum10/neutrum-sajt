-- ============================================================
-- Betalningsliggaren och kassans godkännande (2026-10-21, Fas 3.1)
--
-- Beställningen (Leo, 2026-10-21): en tabell betalningar med en rad per
-- betalning, med familj, belopp, valuta, typ (plan eller pass),
-- Stripes id:n, status, kod och tider. Den skrivs bara av webhooken
-- (aldrig för att någon kommer tillbaka till en tacksida), har inga
-- policyer för UPDATE och DELETE, raderas ALDRIG och ingår inte i något
-- städjobb: den är bokföringsunderlag i sju år.
--
-- Pengarna står redan på raden de betalar (bookings, klippkort,
-- pass_tillagg), och det är webhooken som skriver dem där. Liggaren är
-- därför en spegel som triggrar skriver i samma transaktion: varje gång
-- tjänstekontot (webhooken, återbetalningen, kortdragningen) sätter en
-- betalning med ett PaymentIntent bokförs den, och när den återbetalas
-- eller blir en tvist ändras radens status. En rad per PaymentIntent.
--
--   1. betalningar: familj (on delete restrict: en familj med pengar
--      avidentifieras, raderas aldrig helt), typ ('plan' för en plan och
--      timmar till planen, 'timbank' för Fyll timbanken, 'pass',
--      'tillagg'), vad den betalade (klippkort_id eller booking_id, som
--      blir null om raden de pekar på tas bort: liggaren står kvar),
--      belopp_ore, aterbetalt_ore, valuta, status, kod (rabattkoden),
--      Stripes id:n, avgift och netto, skarp eller test, betald_at och
--      bokford_at. Bara det som kan ändras i Stripe efteråt (återbetalt,
--      status, charge, avgift och netto) får ändras, av databasen själv.
--   2. intern.betalningar_bokfor(): AFTER-triggrar på bookings,
--      klippkort och pass_tillagg. Bokför bara när tjänstekontot eller
--      databasen skriver (auth.uid() är null): en admin som ändrar en
--      betalningskolumn för hand skriver ingen bokföring.
--   3. betalning_utan_rad(): webhooken bokför en betalning den inte
--      kunde skriva ner på sin rad (två kassor stod öppna), så att också
--      de pengarna står i liggaren. betalning_aterbetald(): återbetalning
--      av en sådan.
--   4. Liggaren fylls i med det som redan är betalt.
--   5. kopvillkor_godkannanden: när någon kryssade i köpvillkoren i
--      kassan (köp, pass, tillägg eller kortet), skrivet av
--      stripe-checkout med databasens tid.
--   6. intern.radering_underlag: en familj med en rad i liggaren
--      avidentifieras, aldrig helt (nyckeln är restrict).
--
-- Vakterna prövar funktionerna mot driften som den byggs ur
-- migrationerna (md5), och en som redan bär liggaren släpps igenom, så
-- filen går att köra två gånger. Inget drop. Inget delete: liggaren
-- nekar delete och truncate med triggrar.
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 0. driften är som den lästes ----------
do $$
declare
  def text;
begin
  def := pg_get_functiondef('intern.radering_underlag(text, uuid)'::regprocedure);
  if position('betalningar' in def) = 0 and md5(def) <> '40e04ff7611c604ce1eeb1966527b9cd' then
    raise exception 'intern.radering_underlag har ändrats sedan liggaren skrevs (md5 %). Läs driften och skriv om migrationen.',
      md5(def);
  end if;
end $$;


-- ---------- 1. liggaren ----------
create table if not exists public.betalningar (
  id                    uuid primary key default gen_random_uuid(),
  familj                uuid not null references public.profiles(id) on delete restrict,
  typ                   text not null check (typ in ('plan', 'timbank', 'pass', 'tillagg')),
  erbjudande            text,
  klippkort_id          uuid references public.klippkort(id) on delete set null,
  booking_id            uuid references public.bookings(id) on delete set null,
  belopp_ore            integer not null check (belopp_ore > 0),
  aterbetalt_ore        integer not null default 0 check (aterbetalt_ore >= 0),
  valuta                text not null default 'sek' check (valuta = 'sek'),
  status                text not null check (status in ('betald', 'delvis_aterbetald', 'aterbetald', 'tvist')),
  kod                   text,
  stripe_payment_intent text not null unique check (stripe_payment_intent ~ '^pi_[A-Za-z0-9_]+$'),
  stripe_charge         text,
  avgift_ore            integer,
  netto_ore             integer,
  skarp                 boolean,
  utan_rad              boolean not null default false,
  betald_at             timestamptz not null,
  bokford_at            timestamptz not null default now(),
  andrad_at             timestamptz,
  constraint betalningar_aterbetalt_hogst_beloppet check (aterbetalt_ore <= belopp_ore)
);
create index if not exists betalningar_familj on public.betalningar (familj, betald_at desc);
create index if not exists betalningar_betald on public.betalningar (betald_at desc);
create index if not exists betalningar_klippkort on public.betalningar (klippkort_id) where klippkort_id is not null;
create index if not exists betalningar_pass on public.betalningar (booking_id) where booking_id is not null;

comment on table public.betalningar is
  '2026-10-21 (betalningsliggaren). En rad per betalning med kort (ett PaymentIntent): en plan, timmar till en plan, '
  'Fyll timbanken, ett pass eller ett tillägg. Skrivs bara av databasen när webhooken, återbetalningen eller '
  'kortdragningen skrivit betalningen på sin rad (intern.betalningar_bokfor), eller av betalning_utan_rad(). Raderas '
  'aldrig och gallras aldrig: bokföringsunderlag i sju år (bokföringslagen 7 kap. 2 §). Bara superadmin läser.';
comment on column public.betalningar.utan_rad is
  'Betalningen kunde inte skrivas ner på raden den gällde (raden bar redan en annan betalning, oftast en andra kassa). '
  'Pengarna ska tillbaka; uppgiften ej-nedskriven:<pi> säger det.';

-- Det enda som får ändras är det Stripe kan ändra efteråt, och bara databasen ändrar det.
create or replace function intern.betalningar_star_fast()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
-- betalningsliggaren (2026-10-21). Bokföringsunderlag: raden raderas
-- aldrig, och det som bokfördes står fast.
begin
  if tg_op = 'DELETE' or tg_op = 'TRUNCATE' then
    raise exception using errcode = '42501',
      message = 'Betalningsliggaren raderas aldrig: den är bokföringsunderlag i sju år.';
  end if;
  if (new.id, new.familj, new.typ, new.erbjudande, new.belopp_ore, new.valuta, new.kod, new.stripe_payment_intent,
      new.skarp, new.utan_rad, new.betald_at, new.bokford_at)
     is distinct from
     (old.id, old.familj, old.typ, old.erbjudande, old.belopp_ore, old.valuta, old.kod, old.stripe_payment_intent,
      old.skarp, old.utan_rad, old.betald_at, old.bokford_at) then
    raise exception using errcode = '42501',
      message = 'Det som bokförts i betalningsliggaren står fast. Bara återbetalt, status och Stripes avgift ändras.';
  end if;
  if new.aterbetalt_ore < old.aterbetalt_ore then
    raise exception using errcode = '42501',
      message = 'En återbetalning går inte att ta tillbaka i liggaren.';
  end if;
  return new;
end $function$;

revoke all on function intern.betalningar_star_fast() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.betalningar'::regclass
                  and tgname = 'betalningar_star_fast') then
    create trigger betalningar_star_fast
      before update or delete on public.betalningar
      for each row execute function intern.betalningar_star_fast();
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.betalningar'::regclass
                  and tgname = 'betalningar_toms_aldrig') then
    create trigger betalningar_toms_aldrig
      before truncate on public.betalningar
      for each statement execute function intern.betalningar_star_fast();
  end if;
end $$;

alter table public.betalningar enable row level security;
revoke all on public.betalningar from anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nextrum_barn') then
    execute 'revoke all on public.betalningar from nextrum_barn';
  end if;
  if exists (select 1 from pg_roles where rolname = 'nextrum_ai') then
    execute 'revoke all on public.betalningar from nextrum_ai';
  end if;
end $$;
grant select on public.betalningar to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'betalningar'
                  and policyname = 'admin läser liggaren') then
    create policy "admin läser liggaren" on public.betalningar for select to authenticated
      using ((select public.is_admin()));
  end if;
end $$;


-- ---------- 2. bokföringen ----------
create or replace function intern.betalning_lage(p_kallans text, p_belopp bigint, p_aterbetalt bigint)
 returns text
 language sql
 immutable
 set search_path to ''
as $function$
  select case
           when p_kallans = 'tvist' then 'tvist'
           when coalesce(p_aterbetalt, 0) >= p_belopp then 'aterbetald'
           when coalesce(p_aterbetalt, 0) > 0 then 'delvis_aterbetald'
           else 'betald'
         end
$function$;

create or replace function intern.betalningar_bokfor()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- betalningsliggaren (2026-10-21). Körs efter att en betalning skrivits
-- på sin rad. Bara tjänstekontot och databasen bokför: en inloggad som
-- ändrar en betalningskolumn (en admin för hand) skriver ingen liggare.
declare
  pi        text;
  belopp    integer;
  ater      integer;
  kallans   text;
  v_typ     text;
  v_familj  uuid;
  v_erb     text;
  v_kk      uuid;
  v_bk      uuid;
  v_kod     text;
  v_charge  text;
  v_avgift  integer;
  v_netto   integer;
  v_skarp   boolean;
  v_betald  timestamptz;
begin
  if auth.uid() is not null then
    return null;
  end if;

  if tg_table_name = 'bookings' then
    pi := new.stripe_payment_intent_id; belopp := new.betalt_ore; ater := new.aterbetald_ore;
    kallans := new.betalning_status; v_typ := 'pass'; v_familj := new.parent_id; v_bk := new.id;
    v_kod := new.rabattkod; v_charge := new.stripe_charge_id; v_avgift := new.stripe_avgift_ore;
    v_netto := new.stripe_netto_ore; v_skarp := new.stripe_skarp; v_betald := new.betald_at;
  elsif tg_table_name = 'klippkort' then
    pi := new.stripe_payment_intent_id; belopp := new.betalt_ore; ater := new.aterbetald_ore;
    kallans := new.status;
    v_typ := case when new.sort = 'plan' or new.erbjudande = 'plan_extra' then 'plan' else 'timbank' end;
    v_familj := new.parent_id; v_kk := new.id; v_erb := new.erbjudande; v_kod := new.rabattkod;
    v_charge := new.stripe_charge_id; v_avgift := new.stripe_avgift_ore; v_netto := new.stripe_netto_ore;
    v_skarp := new.stripe_skarp; v_betald := new.betald_at;
  else
    pi := new.stripe_payment_intent_id; belopp := new.betalt_ore; ater := new.aterbetald_ore;
    kallans := new.status; v_typ := 'tillagg'; v_bk := new.booking_id;
    select b.parent_id into v_familj from public.bookings b where b.id = new.booking_id;
    v_charge := new.stripe_charge_id; v_avgift := new.stripe_avgift_ore; v_netto := new.stripe_netto_ore;
    v_skarp := new.stripe_skarp; v_betald := new.betald_at;
  end if;

  if pi is null or pi !~ '^pi_[A-Za-z0-9_]+$' or coalesce(belopp, 0) <= 0 or v_familj is null
     or kallans not in ('betald', 'aterbetald', 'tvist') then
    return null;
  end if;
  ater := least(greatest(coalesce(ater, 0), 0), belopp);

  insert into public.betalningar as x
    (familj, typ, erbjudande, klippkort_id, booking_id, belopp_ore, aterbetalt_ore, status, kod,
     stripe_payment_intent, stripe_charge, avgift_ore, netto_ore, skarp, betald_at)
  values
    (v_familj, v_typ, v_erb, v_kk, v_bk, belopp, ater, intern.betalning_lage(kallans, belopp, ater), v_kod,
     pi, v_charge, v_avgift, v_netto, v_skarp, coalesce(v_betald, now()))
  on conflict (stripe_payment_intent) do update
     set aterbetalt_ore = greatest(x.aterbetalt_ore, least(excluded.aterbetalt_ore, x.belopp_ore)),
         status = intern.betalning_lage(kallans, x.belopp_ore, greatest(x.aterbetalt_ore, least(excluded.aterbetalt_ore, x.belopp_ore))),
         stripe_charge = coalesce(excluded.stripe_charge, x.stripe_charge),
         avgift_ore = coalesce(excluded.avgift_ore, x.avgift_ore),
         netto_ore = coalesce(excluded.netto_ore, x.netto_ore),
         andrad_at = now()
   where (x.aterbetalt_ore, x.status, x.stripe_charge, x.avgift_ore, x.netto_ore)
         is distinct from
         (greatest(x.aterbetalt_ore, least(excluded.aterbetalt_ore, x.belopp_ore)),
          intern.betalning_lage(kallans, x.belopp_ore, greatest(x.aterbetalt_ore, least(excluded.aterbetalt_ore, x.belopp_ore))),
          coalesce(excluded.stripe_charge, x.stripe_charge),
          coalesce(excluded.avgift_ore, x.avgift_ore),
          coalesce(excluded.netto_ore, x.netto_ore));
  return null;
end $function$;

revoke all on function intern.betalningar_bokfor() from public, anon, authenticated;
revoke all on function intern.betalning_lage(text, bigint, bigint) from public, anon;

-- En trigger för en ny rad och en för en ändrad: den ändrade körs bara
-- när något i betalningen ändrats, så passens andra ändringar kostar
-- ingenting. Bara efter: liggaren ser det som faktiskt sparades.
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('bookings',     'betalning_status'),
      ('klippkort',    'status'),
      ('pass_tillagg', 'status')
    ) as x(tabell, lage)
  loop
    if not exists (select 1 from pg_trigger where tgrelid = ('public.' || t.tabell)::regclass
                    and tgname = t.tabell || '_bokfors_ny') then
      execute format(
        'create trigger %I after insert on public.%I for each row '
        'when (new.stripe_payment_intent_id is not null and coalesce(new.betalt_ore, 0) > 0) '
        'execute function intern.betalningar_bokfor()',
        t.tabell || '_bokfors_ny', t.tabell);
    end if;
    if not exists (select 1 from pg_trigger where tgrelid = ('public.' || t.tabell)::regclass
                    and tgname = t.tabell || '_bokfors') then
      execute format(
        'create trigger %I after update on public.%I for each row '
        'when (new.stripe_payment_intent_id is not null and coalesce(new.betalt_ore, 0) > 0 '
        'and (new.betalt_ore, new.aterbetald_ore, new.%I, new.stripe_payment_intent_id, new.stripe_charge_id, '
        'new.stripe_avgift_ore, new.stripe_netto_ore) is distinct from (old.betalt_ore, old.aterbetald_ore, old.%I, '
        'old.stripe_payment_intent_id, old.stripe_charge_id, old.stripe_avgift_ore, old.stripe_netto_ore)) '
        'execute function intern.betalningar_bokfor()',
        t.tabell || '_bokfors', t.tabell, t.lage, t.lage);
    end if;
  end loop;
end $$;


-- ---------- 3. betalningar som inte kunde skrivas ner ----------
create or replace function public.betalning_utan_rad(
  p_pi text, p_belopp integer, p_charge text, p_skarp boolean,
  p_booking uuid default null, p_klippkort uuid default null, p_tillagg boolean default false)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- betalningsliggaren (2026-10-21). Webhooken bokför en betalning som
-- raden den gällde inte tog emot. Familjen läses ur raden, aldrig ur
-- anropet. Svarar sant om den bokfördes nu.
declare
  v_familj uuid;
  v_typ    text;
  v_erb    text;
begin
  if p_pi is null or p_pi !~ '^pi_[A-Za-z0-9_]+$' or coalesce(p_belopp, 0) <= 0 then
    return false;
  end if;
  if p_klippkort is not null then
    select k.parent_id, case when k.sort = 'plan' or k.erbjudande = 'plan_extra' then 'plan' else 'timbank' end,
           k.erbjudande
      into v_familj, v_typ, v_erb
      from public.klippkort k where k.id = p_klippkort;
  elsif p_booking is not null then
    select b.parent_id, case when p_tillagg then 'tillagg' else 'pass' end
      into v_familj, v_typ
      from public.bookings b where b.id = p_booking;
  end if;
  if v_familj is null then
    return false;
  end if;
  insert into public.betalningar
    (familj, typ, erbjudande, klippkort_id, booking_id, belopp_ore, status, stripe_payment_intent,
     stripe_charge, skarp, utan_rad, betald_at)
  values
    (v_familj, v_typ, v_erb, p_klippkort, p_booking, p_belopp, 'betald', p_pi, p_charge, p_skarp, true, now())
  on conflict (stripe_payment_intent) do nothing;
  return found;
end $function$;

create or replace function public.betalning_aterbetald(p_pi text, p_aterbetalt integer, p_tvist boolean default false)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- betalningsliggaren (2026-10-21). En återbetalning eller tvist på en
-- betalning som ingen rad bär (betalning_utan_rad). Rader som en
-- betalning står på uppdateras av triggrarna i stället.
begin
  update public.betalningar x
     set aterbetalt_ore = greatest(x.aterbetalt_ore, least(coalesce(p_aterbetalt, 0), x.belopp_ore)),
         status = intern.betalning_lage(case when p_tvist then 'tvist' else 'betald' end, x.belopp_ore,
                                        greatest(x.aterbetalt_ore, least(coalesce(p_aterbetalt, 0), x.belopp_ore))),
         andrad_at = now()
   where x.stripe_payment_intent = p_pi and x.utan_rad;
  return found;
end $function$;

revoke all on function public.betalning_utan_rad(text, integer, text, boolean, uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.betalning_aterbetald(text, integer, boolean) from public, anon, authenticated;
grant execute on function public.betalning_utan_rad(text, integer, text, boolean, uuid, uuid, boolean) to service_role;
grant execute on function public.betalning_aterbetald(text, integer, boolean) to service_role;


-- ---------- 4. det som redan är betalt ----------
insert into public.betalningar
  (familj, typ, erbjudande, klippkort_id, booking_id, belopp_ore, aterbetalt_ore, status, kod,
   stripe_payment_intent, stripe_charge, avgift_ore, netto_ore, skarp, betald_at)
select k.parent_id,
       case when k.sort = 'plan' or k.erbjudande = 'plan_extra' then 'plan' else 'timbank' end,
       k.erbjudande, k.id, null, k.betalt_ore, least(coalesce(k.aterbetald_ore, 0), k.betalt_ore),
       intern.betalning_lage(k.status, k.betalt_ore, least(coalesce(k.aterbetald_ore, 0), k.betalt_ore)),
       k.rabattkod, k.stripe_payment_intent_id, k.stripe_charge_id, k.stripe_avgift_ore, k.stripe_netto_ore,
       k.stripe_skarp, coalesce(k.betald_at, k.created_at)
  from public.klippkort k
 where k.stripe_payment_intent_id ~ '^pi_[A-Za-z0-9_]+$' and coalesce(k.betalt_ore, 0) > 0
   and k.status in ('betald', 'aterbetald', 'tvist')
on conflict (stripe_payment_intent) do nothing;

insert into public.betalningar
  (familj, typ, booking_id, belopp_ore, aterbetalt_ore, status, kod,
   stripe_payment_intent, stripe_charge, avgift_ore, netto_ore, skarp, betald_at)
select b.parent_id, 'pass', b.id, b.betalt_ore, least(coalesce(b.aterbetald_ore, 0), b.betalt_ore),
       intern.betalning_lage(b.betalning_status, b.betalt_ore, least(coalesce(b.aterbetald_ore, 0), b.betalt_ore)),
       b.rabattkod, b.stripe_payment_intent_id, b.stripe_charge_id, b.stripe_avgift_ore, b.stripe_netto_ore,
       b.stripe_skarp, coalesce(b.betald_at, b.created_at)
  from public.bookings b
 where b.stripe_payment_intent_id ~ '^pi_[A-Za-z0-9_]+$' and coalesce(b.betalt_ore, 0) > 0
   and b.betalning_status in ('betald', 'aterbetald', 'tvist') and b.parent_id is not null
on conflict (stripe_payment_intent) do nothing;

insert into public.betalningar
  (familj, typ, booking_id, belopp_ore, aterbetalt_ore, status,
   stripe_payment_intent, stripe_charge, avgift_ore, netto_ore, skarp, betald_at)
select b.parent_id, 'tillagg', t.booking_id, t.betalt_ore, least(coalesce(t.aterbetald_ore, 0), t.betalt_ore),
       intern.betalning_lage(t.status, t.betalt_ore, least(coalesce(t.aterbetald_ore, 0), t.betalt_ore)),
       t.stripe_payment_intent_id, t.stripe_charge_id, t.stripe_avgift_ore, t.stripe_netto_ore,
       t.stripe_skarp, coalesce(t.betald_at, t.created_at)
  from public.pass_tillagg t
  join public.bookings b on b.id = t.booking_id
 where t.stripe_payment_intent_id ~ '^pi_[A-Za-z0-9_]+$' and coalesce(t.betalt_ore, 0) > 0
   and t.status in ('betald', 'aterbetald', 'tvist') and b.parent_id is not null
on conflict (stripe_payment_intent) do nothing;


-- ---------- 5. kassans godkännande ----------
create table if not exists public.kopvillkor_godkannanden (
  id              uuid primary key default gen_random_uuid(),
  anvandare       uuid not null references public.profiles(id) on delete cascade,
  avser           text not null check (avser in ('kop', 'pass', 'tillagg', 'kort')),
  referens        uuid,
  villkor_version text not null,
  godkant_at      timestamptz not null default now()
);
create index if not exists kopvillkor_godkannanden_anvandare on public.kopvillkor_godkannanden (anvandare, godkant_at desc);

comment on table public.kopvillkor_godkannanden is
  '2026-10-21 (betalningsliggaren). Att någon kryssade i köpvillkoren i kassan innan den öppnades: vad det gällde '
  '(ett köp av timmar, ett pass, ett tillägg eller att spara kortet), raden det gällde, användarvillkorens version och '
  'databasens tid. Skrivs bara av stripe-checkout med tjänstekontot. Bara superadmin läser.';

create or replace function intern.kopvillkor_tid()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
-- Tiden och versionen är databasens, aldrig anropets.
begin
  new.godkant_at := now();
  new.villkor_version := intern.villkor_version();
  return new;
end $function$;
revoke all on function intern.kopvillkor_tid() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.kopvillkor_godkannanden'::regclass
                  and tgname = 'kopvillkor_godkannanden_tid') then
    create trigger kopvillkor_godkannanden_tid
      before insert on public.kopvillkor_godkannanden
      for each row execute function intern.kopvillkor_tid();
  end if;
end $$;

alter table public.kopvillkor_godkannanden enable row level security;
revoke all on public.kopvillkor_godkannanden from anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nextrum_barn') then
    execute 'revoke all on public.kopvillkor_godkannanden from nextrum_barn';
  end if;
  if exists (select 1 from pg_roles where rolname = 'nextrum_ai') then
    execute 'revoke all on public.kopvillkor_godkannanden from nextrum_ai';
  end if;
end $$;
grant select on public.kopvillkor_godkannanden to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kopvillkor_godkannanden'
                  and policyname = 'admin läser godkännandena i kassan') then
    create policy "admin läser godkännandena i kassan" on public.kopvillkor_godkannanden for select to authenticated
      using ((select public.is_admin()));
  end if;
end $$;


-- ---------- 6. raderingen räknar liggaren ----------
do $$
declare
  def    text;
  gammal text := '    if exists (select 1 from public.klippkort k where k.parent_id = p_id)' || chr(10)
                 || '       or exists (select 1 from public.timbank_uttag u where u.parent_id = p_id)';
  ny     text := '    if exists (select 1 from public.klippkort k where k.parent_id = p_id)' || chr(10)
                 || '       -- betalningsliggaren (2026-10-21): raden raderas aldrig, och nyckeln är restrict.' || chr(10)
                 || '       or exists (select 1 from public.betalningar x where x.familj = p_id)' || chr(10)
                 || '       or exists (select 1 from public.timbank_uttag u where u.parent_id = p_id)';
  traffar int;
begin
  def := pg_get_functiondef('intern.radering_underlag(text, uuid)'::regprocedure);
  if position('public.betalningar' in def) > 0 then
    return;
  end if;
  traffar := (length(def) - length(replace(def, gammal, ''))) / length(gammal);
  if traffar <> 1 then
    raise exception 'radering_underlag: väntade en träff, fick %', traffar;
  end if;
  execute replace(def, gammal, ny);
end $$;
