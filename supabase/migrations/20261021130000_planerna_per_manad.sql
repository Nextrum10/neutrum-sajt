-- ============================================================
-- Planerna per kalendermånad, och ett köp som betalas tillbaka
-- (2026-10-21, Fas 3.2)
--
-- Beställningen (Leo, 2026-10-21): en plan köps för "Den här månaden"
-- eller "Nästa månad", och timmarna går ut när månaden är slut.
-- Timbanken visar båda månaderna ("3 av 8 timmar återstår", "0 av 0").
-- En återbetalning drar tillbaka timmar, men aldrig under det som
-- använts.
--
-- Förut gällde en plan en månad från betalningen (giltig_manader från
-- betaldagen), och ett köp hade ingen första dag. Fyll timbanken (sex
-- månader från köpet), gratistimmarna (60 dagar) och tipstimmen är som
-- förut: bara planerna följer kalendern.
--
--   1. klippkort.galler_fran: planens första dag, den 1:a i den här
--      eller nästa månad (Stockholms tid). Skrivs av stripe-checkout och
--      prövas här (intern.klippkort_manad, BEFORE INSERT); timmar till
--      planen (plan_extra) tar planens. Null för allt annat och för
--      planer köpta före den här filen, som behåller sina datum.
--   2. klippkort_betald: en plan med galler_fran gäller till och med
--      månadens sista dag. Betalas den efter sin månad blir det en
--      uppgift till oss.
--   3. intern.timmar_fordela: ett köp betalar inget pass före sin första
--      dag, och timmar som betalats tillbaka finns inte.
--   4. extra_timmar_erbjudande: Köp till timmar går till planen för den
--      här månaden, aldrig till nästa månads och aldrig till ett köp av
--      timmar till planen (förut kunde den senaste raden vara ett sådant).
--   5. klippkort.aterbetalda_timmar och klippkort_aterbetalningar: en
--      återbetalning genom adminvyn drar tillbaka timmar. Raden per
--      återbetalning (Stripes re_-id) gör att stripe-aterbetalning och
--      webhooken kan skriva samma återbetalning utan att räkna den två
--      gånger. klippkort_aterbetalning_lage() räknar vad som går att
--      betala tillbaka: aldrig timmar som använts.
--   6. klippkort_saldo: kvar och brukbar räknar månaden och de
--      återbetalda timmarna; galler_fran och aterbetalda_timmar sist.
--
-- Vakterna prövar funktionerna mot driften som den byggs ur
-- migrationerna (md5), och en kropp som redan bär ändringen släpps
-- igenom, så filen går att köra två gånger. Inget drop och inget delete.
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 0. driften är som den lästes ----------
do $$
declare
  f   record;
  def text;
begin
  for f in
    select * from (values
      ('intern.timmar_fordela(uuid, date, integer, uuid)',                         '8f08933f1777669332f1905aa39e4ecf'),
      ('public.klippkort_betald(uuid, integer, text, text, text, integer, integer, boolean)', '54c6d6df44b6997563c57149dcd73cf9'),
      ('public.extra_timmar_erbjudande(integer)',                                 '18b9715330d555d5630119b10348c308')
    ) as x(fn, summa)
  loop
    def := pg_get_functiondef(f.fn::regprocedure);
    if position('planerna_per_manad' in def) = 0 and md5(def) <> f.summa then
      raise exception '% har ändrats sedan planerna per månad skrevs (md5 %). Läs driften och skriv om migrationen.',
        f.fn, md5(def);
    end if;
  end loop;
end $$;


-- ---------- 1. kolumnerna ----------
alter table public.klippkort add column if not exists galler_fran date;
alter table public.klippkort add column if not exists aterbetalda_timmar integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.klippkort'::regclass
                  and conname = 'klippkort_aterbetalda_timmar') then
    alter table public.klippkort add constraint klippkort_aterbetalda_timmar
      check (aterbetalda_timmar >= 0 and aterbetalda_timmar <= timmar);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.klippkort'::regclass
                  and conname = 'klippkort_galler_fran_forsta') then
    alter table public.klippkort add constraint klippkort_galler_fran_forsta
      check (galler_fran is null or extract(day from galler_fran) = 1);
  end if;
end $$;

comment on column public.klippkort.galler_fran is
  '2026-10-21 (planerna_per_manad). Planens första dag, den 1:a i månaden den köptes för (den här eller nästa). '
  'Planen gäller till och med månadens sista dag. Null för köp som gäller från betalningen.';
comment on column public.klippkort.aterbetalda_timmar is
  '2026-10-21 (planerna_per_manad). Timmar som dragits tillbaka när köpet betalades tillbaka genom adminvyn '
  '(klippkort_aterbetalningar). Kvar är timmar minus använda minus de här.';

create or replace function intern.klippkort_manad()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- planerna_per_manad (2026-10-21). En plan gäller den här eller nästa
-- kalendermånad, räknat i Stockholms tid. Timmar till planen tar
-- planens månad. Allt annat gäller från betalningen.
declare
  manad date := date_trunc('month', now() at time zone 'Europe/Stockholm')::date;
begin
  if new.till_plan is not null then
    new.galler_fran := (select p.galler_fran from public.klippkort p where p.id = new.till_plan);
    return new;
  end if;
  if new.sort = 'plan' and new.erbjudande is distinct from 'gratis' then
    if new.galler_fran is null then
      new.galler_fran := manad;
    elsif new.galler_fran not in (manad, (manad + interval '1 month')::date) then
      raise exception using errcode = '22023',
        message = 'En plan köps för den här månaden eller nästa.';
    end if;
  else
    new.galler_fran := null;
  end if;
  return new;
end $function$;

revoke all on function intern.klippkort_manad() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.klippkort'::regclass
                  and tgname = 'klippkort_manad') then
    create trigger klippkort_manad
      before insert on public.klippkort
      for each row execute function intern.klippkort_manad();
  end if;
end $$;


-- ---------- 2. planen gäller till månadens slut ----------
do $$
declare
  def     text;
  gammal1 text := '         giltigt_till = case when till_plan is not null' || chr(10)
               || '                             then greatest(coalesce(planens_sista, idag), idag)' || chr(10)
               || '                             else ((now() at time zone ''Europe/Stockholm'')::date';
  ny1     text := '         giltigt_till = case when till_plan is not null' || chr(10)
               || '                             then greatest(coalesce(planens_sista, idag), idag)' || chr(10)
               || '                             -- planerna_per_manad (2026-10-21): en plan gäller sin kalendermånad.' || chr(10)
               || '                             when galler_fran is not null' || chr(10)
               || '                             then (galler_fran + make_interval(months => giltig_manader) - interval ''1 day'')::date' || chr(10)
               || '                             else ((now() at time zone ''Europe/Stockholm'')::date';
  gammal2 text := '  blev := found;' || chr(10);
  ny2     text := '  blev := found;' || chr(10) || chr(10)
               || '  -- planerna_per_manad (2026-10-21): en plan som betalades efter sin månad.' || chr(10)
               || '  if blev and exists (select 1 from public.klippkort k where k.id = p_id and k.till_plan is null' || chr(10)
               || '                        and k.galler_fran is not null and k.giltigt_till < idag) then' || chr(10)
               || '    perform public.skapa_uppgift(' || chr(10)
               || '      ''En plan betalades efter sin månad'',' || chr(10)
               || '      ''plan_efter_manaden:'' || p_id,' || chr(10)
               || '      ''kontroll'',' || chr(10)
               || '      ''Betalningen för planen kom först efter planens sista dag, så timmarna går inte att använda. Hör av er '' ' || chr(10)
               || '        || ''till familjen och betala tillbaka planen under Betalningar.'',' || chr(10)
               || '      ''profiles'', (select k.parent_id::text from public.klippkort k where k.id = p_id));' || chr(10)
               || '  end if;' || chr(10);
  n1 int; n2 int;
begin
  def := pg_get_functiondef('public.klippkort_betald(uuid, integer, text, text, text, integer, integer, boolean)'::regprocedure);
  if position('planerna_per_manad' in def) > 0 then
    return;
  end if;
  n1 := (length(def) - length(replace(def, gammal1, ''))) / length(gammal1);
  n2 := (length(def) - length(replace(def, gammal2, ''))) / length(gammal2);
  if n1 <> 1 or n2 <> 1 then
    raise exception 'klippkort_betald: väntade en träff var, fick % och %', n1, n2;
  end if;
  execute replace(replace(def, gammal1, ny1), gammal2, ny2);
end $$;


-- ---------- 3. ett köp betalar inget före sin första dag ----------
do $$
declare
  def    text;
  gammal text := '                   intern.kortets_timmar(kk.giltigt_till, kk.betald_at, kk.timmar, kk.timmar_pa_kopet,' || chr(10)
              || '                                         a.anv, p_dag) as har,';
  ny     text := '                   -- planerna_per_manad (2026-10-21): ett köp betalar inget före sin första' || chr(10)
              || '                   -- dag, och timmar som betalats tillbaka finns inte.' || chr(10)
              || '                   case when kk.galler_fran is not null and kk.galler_fran > p_dag then 0' || chr(10)
              || '                        else intern.kortets_timmar(kk.giltigt_till, kk.betald_at,' || chr(10)
              || '                                                   kk.timmar - kk.aterbetalda_timmar, kk.timmar_pa_kopet,' || chr(10)
              || '                                                   a.anv, p_dag) end as har,';
  n int;
begin
  def := pg_get_functiondef('intern.timmar_fordela(uuid, date, integer, uuid)'::regprocedure);
  if position('planerna_per_manad' in def) > 0 then
    return;
  end if;
  n := (length(def) - length(replace(def, gammal, ''))) / length(gammal);
  if n <> 1 then
    raise exception 'timmar_fordela: väntade en träff, fick %', n;
  end if;
  execute replace(def, gammal, ny);
end $$;


-- ---------- 4. Köp till timmar går till månadens plan ----------
do $$
declare
  def    text;
  gammal text := '   where k.parent_id = jag and k.sort = ''plan'' and k.status = ''betald''' || chr(10)
              || '     and k.giltigt_till > idag' || chr(10);
  ny     text := '   where k.parent_id = jag and k.sort = ''plan'' and k.status = ''betald''' || chr(10)
              || '     and k.giltigt_till > idag' || chr(10)
              || '     -- planerna_per_manad (2026-10-21): planen för den här månaden, aldrig nästa' || chr(10)
              || '     -- månads och aldrig timmar som köpts till en plan.' || chr(10)
              || '     and (k.galler_fran is null or k.galler_fran <= idag) and k.till_plan is null' || chr(10);
  n int;
begin
  def := pg_get_functiondef('public.extra_timmar_erbjudande(integer)'::regprocedure);
  if position('planerna_per_manad' in def) > 0 then
    return;
  end if;
  n := (length(def) - length(replace(def, gammal, ''))) / length(gammal);
  if n <> 1 then
    raise exception 'extra_timmar_erbjudande: väntade en träff, fick %', n;
  end if;
  execute replace(def, gammal, ny);
end $$;


-- ---------- 5. ett köp som betalas tillbaka ----------
create table if not exists public.klippkort_aterbetalningar (
  stripe_refund text primary key check (stripe_refund ~ '^re_[A-Za-z0-9_]+$'),
  klippkort_id  uuid not null references public.klippkort(id) on delete cascade,
  timmar        integer not null check (timmar >= 0),
  belopp_ore    integer not null check (belopp_ore > 0),
  hela          boolean not null default false,
  av            uuid references public.profiles(id) on delete set null,
  anledning     text check (anledning is null or char_length(anledning) <= 300),
  skapad_at     timestamptz not null default now()
);
create index if not exists klippkort_aterbetalningar_kort on public.klippkort_aterbetalningar (klippkort_id);

comment on table public.klippkort_aterbetalningar is
  '2026-10-21 (planerna_per_manad). En återbetalning av ett köp av timmar genom adminvyn: Stripes re_-id, köpet, hur '
  'många timmar som drogs tillbaka och beloppet. Skrivs av stripe-aterbetalning och av webhooken (samma rad två gånger '
  'blir en). Raderas inte: den är en del av bokföringen. Bara superadmin läser.';

alter table public.klippkort_aterbetalningar enable row level security;
revoke all on public.klippkort_aterbetalningar from anon, authenticated;
grant select on public.klippkort_aterbetalningar to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nextrum_barn') then
    execute 'revoke all on public.klippkort_aterbetalningar from nextrum_barn';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'klippkort_aterbetalningar'
                  and policyname = 'admin läser återbetalningarna av köp') then
    create policy "admin läser återbetalningarna av köp" on public.klippkort_aterbetalningar for select to authenticated
      using ((select public.is_admin()));
  end if;
end $$;


-- ---------- 6. saldot ----------
create or replace view public.klippkort_saldo
with (security_invoker = true) as
 SELECT k.id,
    k.parent_id,
    k.erbjudande,
    k.namn,
    k.sort,
    k.timmar,
    COALESCE(a.anvanda, 0) AS anvanda,
    -- planerna_per_manad (2026-10-21): timmar som betalats tillbaka finns inte.
    CASE WHEN k.aterkallad_at IS NOT NULL THEN 0
         ELSE GREATEST(k.timmar - COALESCE(a.anvanda, 0) - k.aterbetalda_timmar, 0) END AS kvar,
    k.giltigt_till,
    k.status,
    k.begart_ore,
    k.betalt_ore,
    k.aterbetald_ore,
    k.timpris_ore,
    k.betald_at,
    k.created_at,
    k.status = 'betald'::text AND k.aterkallad_at IS NULL
      -- planerna_per_manad (2026-10-21): nästa månads plan går inte att använda än.
      AND (k.galler_fran IS NULL OR k.galler_fran <= (now() AT TIME ZONE 'Europe/Stockholm'::text)::date)
      AND (k.giltigt_till >= (now() AT TIME ZONE 'Europe/Stockholm'::text)::date
             AND (k.timmar - COALESCE(a.anvanda, 0) - k.aterbetalda_timmar) > 0
           OR k.timmar_pa_kopet > COALESCE(a.anvanda, 0) AND k.betald_at IS NOT NULL
             AND (k.betald_at AT TIME ZONE 'Europe/Stockholm'::text)::date + 60
                 >= (now() AT TIME ZONE 'Europe/Stockholm'::text)::date) AS brukbar,
    GREATEST(COALESCE(k.betalt_ore, 0) - k.aterbetald_ore
             - COALESCE(a.anvanda, 0) * (k.timpris_ore - COALESCE(k.familjerabatt_ore, 0)), 0) AS vid_uppsagning_ore,
    (k.betald_at AT TIME ZONE 'Europe/Stockholm'::text)::date + 14 AS angerfrist_till,
    GREATEST(COALESCE(k.betalt_ore, 0) - k.aterbetald_ore - floor(COALESCE(a.anvanda, 0)::numeric * COALESCE(k.betalt_ore, 0)::numeric / k.timmar::numeric)::integer, 0) AS vid_anger_ore,
    CASE WHEN k.aterkallad_at IS NOT NULL THEN 0
         ELSE GREATEST(k.timmar_pa_kopet - COALESCE(a.anvanda, 0), 0) END AS gratis_kvar,
    CASE WHEN k.timmar_pa_kopet > 0 AND k.betald_at IS NOT NULL
         THEN (k.betald_at AT TIME ZONE 'Europe/Stockholm'::text)::date + 60 END AS gratis_till,
    k.aterkallad_at,
    k.till_plan,
    (floor(k.timpris_ore::numeric * (100 - COALESCE(k.rabatt_procent, 0))::numeric / 10000::numeric) * 100::numeric)::integer
      AS rabatterat_timpris_ore,
    k.familjerabatt_ore,
    k.galler_fran,
    k.aterbetalda_timmar
   FROM klippkort k
     LEFT JOIN LATERAL ( SELECT sum(CASE WHEN b.forsta_klippkort_id = k.id
                                         THEN LEAST(b.forsta_klippkort_timmar::numeric, d.a)
                                         ELSE GREATEST(d.a - COALESCE(b.forsta_klippkort_timmar, 0)::numeric, 0::numeric)
                                    END)::integer AS anvanda
           FROM bookings b
             CROSS JOIN LATERAL ( SELECT GREATEST(GREATEST(1::numeric, ceil(LEAST(COALESCE(b.duration_min, 60), COALESCE(intern.debiterade_min(b.id), b.duration_min, 60))::numeric / 60.0))
                                                  - CASE WHEN b.startrabatt THEN 1 ELSE 0 END::numeric, 0::numeric) AS a) d
          WHERE (b.klippkort_id = k.id OR b.forsta_klippkort_id = k.id)
            AND b.klippkort_id IS NOT NULL
            AND b.status <> 'cancelled'::text) a ON true;

comment on column public.klippkort_saldo.galler_fran is
  '2026-10-21 (planerna_per_manad). Planens första dag; null för köp som gäller från betalningen.';
comment on column public.klippkort_saldo.aterbetalda_timmar is
  '2026-10-21 (planerna_per_manad). Timmar som dragits tillbaka när köpet betalades tillbaka.';


-- ---------- 7. vad som går att betala tillbaka ----------
create or replace function public.klippkort_aterbetalning_lage(p_id uuid, p_timmar integer default null)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
-- planerna_per_manad (2026-10-21). Vad en återbetalning av ett köp blir:
-- utan antal (eller med alla) är det hela köpet, och då är beloppet det
-- villkoren lovar den som slutar (vid_uppsagning_ore: använda timmar
-- till ordinarie timpris); med ett antal är det timmarna till det pris
-- familjen betalade per timme, aldrig mer än hela köpets belopp. Timmar
-- som använts dras aldrig tillbaka. Admin, eller tjänstekontot.
declare
  s        record;
  k        record;
  betalda  integer;
  obet     integer;
  per      integer;
  n        integer;
  belopp   integer;
  hela     boolean;
  idag     date := (now() at time zone 'Europe/Stockholm')::date;
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara admin betalar tillbaka.';
  end if;
  select * into s from public.klippkort_saldo x where x.id = p_id;
  if not found then
    return jsonb_build_object('fel', 'Köpet finns inte.');
  end if;
  select kk.stripe_payment_intent_id as pi, kk.timmar_pa_kopet into k from public.klippkort kk where kk.id = p_id;
  if s.erbjudande = 'gratis' or coalesce(s.betalt_ore, 0) <= 0 then
    return jsonb_build_object('fel', 'Gratistimmar betalas inte tillbaka. Ta tillbaka dem i familjens panel i stället.');
  end if;
  if s.status <> 'betald' then
    return jsonb_build_object('fel', case s.status
      when 'tvist' then 'Köpet är bestridet: tvisten avgör pengarna.'
      when 'aterbetald' then 'Köpet är redan återbetalt.'
      else 'Köpet är inte betalt.' end);
  end if;
  if k.pi is null then
    return jsonb_build_object('fel', 'Köpet saknar en betalning i Stripe.');
  end if;
  if coalesce(s.betalt_ore, 0) <= coalesce(s.aterbetald_ore, 0) then
    return jsonb_build_object('fel', 'Det finns inget kvar att betala tillbaka.');
  end if;

  betalda := greatest(s.timmar - coalesce(k.timmar_pa_kopet, 0), 1);
  obet := greatest(s.kvar - s.gratis_kvar, 0);
  per := floor(s.betalt_ore::numeric / betalda)::integer;
  hela := p_timmar is null or p_timmar >= obet;
  if not hela and p_timmar < 1 then
    return jsonb_build_object('fel', 'Välj minst en timme.');
  end if;
  n := case when hela then obet else p_timmar end;
  belopp := case when hela then s.vid_uppsagning_ore else least(n * per, s.vid_uppsagning_ore) end;
  if coalesce(belopp, 0) <= 0 then
    return jsonb_build_object('fel', 'Det finns inget att betala tillbaka: timmarna är använda.');
  end if;
  return jsonb_build_object(
    'ok', true,
    'klippkort', s.id,
    'namn', s.namn,
    'familj', s.parent_id,
    'pi', k.pi,
    'hela', hela,
    'timmar', n,
    'kvar_betalda', obet,
    'kvar', s.kvar,
    'per_timme_ore', per,
    'belopp_ore', belopp,
    'vid_uppsagning_ore', s.vid_uppsagning_ore,
    'betalt_ore', s.betalt_ore,
    'aterbetald_ore', s.aterbetald_ore,
    'giltigt_till', s.giltigt_till,
    'utgangen', s.giltigt_till < idag);
end $function$;

create or replace function public.klippkort_aterbetalad(
  p_refund text, p_kort uuid, p_timmar integer, p_belopp integer, p_hela boolean,
  p_av uuid default null, p_anledning text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- planerna_per_manad (2026-10-21). Skriver en återbetalning av ett köp
-- som Stripe har gjort: timmarna dras tillbaka, aldrig under det som
-- använts. Samma återbetalning två gånger (funktionen och webhooken)
-- blir en rad. Tjänstekontot.
declare
  s      record;
  n      integer;
  forut  integer;
begin
  if p_refund is null or p_refund !~ '^re_[A-Za-z0-9_]+$' or coalesce(p_belopp, 0) <= 0 then
    return jsonb_build_object('fel', 'Återbetalningen saknas.');
  end if;
  perform 1 from public.klippkort k where k.id = p_kort for update;
  if not found then
    return jsonb_build_object('fel', 'Köpet finns inte.');
  end if;

  insert into public.klippkort_aterbetalningar (stripe_refund, klippkort_id, timmar, belopp_ore, hela, av, anledning)
  values (p_refund, p_kort, greatest(coalesce(p_timmar, 0), 0), p_belopp, coalesce(p_hela, false), p_av,
          left(nullif(btrim(coalesce(p_anledning, '')), ''), 300))
  on conflict (stripe_refund) do nothing;
  if not found then
    return jsonb_build_object('ok', true, 'redan', true);
  end if;

  select x.kvar, x.gratis_kvar, x.aterbetalda_timmar into s from public.klippkort_saldo x where x.id = p_kort;
  forut := s.aterbetalda_timmar;
  -- En del av köpet tar betalda timmar, aldrig den gratis timmen; hela köpet tar allt som är kvar.
  n := case when p_hela then s.kvar
            else least(greatest(coalesce(p_timmar, 0), 0), greatest(s.kvar - s.gratis_kvar, 0)) end;
  -- Beloppet står direkt på köpet, så att en andra återbetalning före
  -- webhooken räknas på det som redan gått tillbaka. Webhooken skriver
  -- Stripes summa när den kommer, och den är aldrig mindre.
  update public.klippkort k
     set aterbetalda_timmar = k.aterbetalda_timmar + n,
         aterbetald_ore = greatest(coalesce(k.aterbetald_ore, 0),
                                   (select coalesce(sum(x.belopp_ore), 0)::integer from public.klippkort_aterbetalningar x
                                     where x.klippkort_id = p_kort)),
         status = case when p_hela then 'aterbetald' else k.status end
   where k.id = p_kort;
  update public.klippkort_aterbetalningar set timmar = n where stripe_refund = p_refund;

  if not p_hela and n < coalesce(p_timmar, 0) then
    perform public.skapa_uppgift(
      'Färre timmar drogs tillbaka än det betalades tillbaka för',
      'aterbetalda_timmar_anvandes:' || p_refund,
      'kontroll',
      'Timmar användes medan köpet betalades tillbaka, så ' || n || ' i stället för ' || p_timmar || ' timmar drogs '
        || 'tillbaka. Stäm av beloppet med familjen.',
      'profiles', (select k.parent_id::text from public.klippkort k where k.id = p_kort));
  end if;
  return jsonb_build_object('ok', true, 'timmar', n, 'aterbetalda_timmar', forut + n);
end $function$;

revoke all on function public.klippkort_aterbetalning_lage(uuid, integer) from public, anon;
grant execute on function public.klippkort_aterbetalning_lage(uuid, integer) to authenticated, service_role;
revoke all on function public.klippkort_aterbetalad(text, uuid, integer, integer, boolean, uuid, text) from public, anon, authenticated;
grant execute on function public.klippkort_aterbetalad(text, uuid, integer, integer, boolean, uuid, text) to service_role;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nextrum_barn') then
    execute 'revoke all on function public.klippkort_aterbetalning_lage(uuid, integer) from nextrum_barn';
  end if;
end $$;


-- ---------- 8. månaderna, för vyn ----------
-- Vyn visar valet Den här månaden och Nästa månad bara när den här
-- funktionen finns, och då med databasens datum. Utan den (före
-- migrationen) står ett Köp som förut, och kassan får ingen månad.
create or replace function public.planens_manader()
 returns jsonb
 language sql
 stable
 set search_path to ''
as $function$
  -- planerna_per_manad (2026-10-21). Den 1:a i den här och nästa månad,
  -- och dagen, i Stockholms tid.
  select jsonb_build_object(
    'denna', date_trunc('month', now() at time zone 'Europe/Stockholm')::date,
    'nasta', (date_trunc('month', now() at time zone 'Europe/Stockholm') + interval '1 month')::date,
    'idag', (now() at time zone 'Europe/Stockholm')::date)
$function$;
revoke all on function public.planens_manader() from public, anon;
grant execute on function public.planens_manader() to authenticated, service_role;
