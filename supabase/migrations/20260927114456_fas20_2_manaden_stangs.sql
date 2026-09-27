-- ============================================================
-- Fas 20.2: månaden stängs i bokföringen
--
-- Leo 2026-09-27: "i adminvyn ska vi kunna filtrera och stänga
-- böckerna ... månadsvis". Två beslut samma dag:
--
--   1. En stängd månad är LÅST. Databasen nekar att en rapport eller
--      ett pass i den månaden skrivs, ändras eller tas bort, också för
--      admin. Admin kan öppna månaden igen, men måste skriva ett skäl,
--      och öppningen står i auditloggen. Så fungerar en låst period i
--      Fortnox också: rättelsen görs i en öppen period, eller efter att
--      någon medvetet öppnat.
--   2. En månad stängs bara när dess larm är noll. stang_manad() frågar
--      avvikelser_rader() om varje larm vars datum ligger i månaden, och
--      vägrar med en lista över dem. Knappen i adminvyn är grå av samma
--      skäl, men det är databasen som bestämmer.
--
-- MÅNADEN ÄR PASSETS MÅNAD (wanted_date), inte betalningens. Ett pass i
-- september som betalas den 3 oktober hör till september: det är den
-- månadens rapporter, lön och larm som stängs. För en rapport utan pass
-- gäller rapportens datum.
--
-- SYSTEMET GÅR IGENOM LÅSET. stripe-webhook, månadskörningen och
-- triggrarna skriver utan inloggning (auth.uid() är null). En
-- återbetalning eller en tvist som kommer från Stripe efter att månaden
-- stängts har redan hänt hos banken, och att vägra skriva ner den hade
-- gjort raden osann, inte månaden stängd. Samma gräns som alla
-- skydda_-triggrar: det är människor i vyerna som hålls utanför.
--
-- VAD LÅSET RÖR, OCH VAD DET INTE RÖR:
--   bookings        allt, i båda riktningar (också ett pass som flyttas
--                   IN i en stängd månad)
--   lesson_reports  pass, elev, datum, närvaro och tid. Texten gör det
--                   inte: en rapport som skrivs om åt föräldern
--                   (ai_feedback) ändrar ingen siffra, och knappen ska
--                   fortsätta fungera på en gammal rapport.
--   payouts, invoices  INTE. Underlaget för september betalas ut den 25
--                   oktober, och fakturan förfaller efter månadsskiftet.
--                   Att markera dem betalda är kassaflöde, inte månadens
--                   innehåll, och larmen ser till att de finns.
--
-- summering sparar månadens siffror som de såg ut när den stängdes. En
-- siffra som ändras efter stängningen är då synlig som en skillnad, inte
-- som en ny sanning.
-- ============================================================

set local lock_timeout = '5s';

create table public.manadsbokslut (
  id          uuid primary key default gen_random_uuid(),
  manad       date not null unique check (manad = date_trunc('month', manad)::date),
  stangd      boolean not null default true,
  stangd_at   timestamptz,
  stangd_av   uuid references public.profiles(id),
  oppnad_at   timestamptz,
  oppnad_av   uuid references public.profiles(id),
  oppnad_skal text check (oppnad_skal is null or char_length(oppnad_skal) between 5 and 500),
  summering   jsonb
);

comment on table public.manadsbokslut is
  'Fas 20.2: stängda månader. Skrivs bara av stang_manad() och oppna_manad(); läses av admin.';

alter table public.manadsbokslut enable row level security;
revoke all on public.manadsbokslut from anon, authenticated;
grant select on public.manadsbokslut to authenticated;

create policy "admin läser bokslutet"
  on public.manadsbokslut for select to authenticated
  using (public.is_admin());

-- Skälet är admins fritext och står med flit inte i loggen.
create trigger manadsbokslut_audit
  after insert or update of stangd on public.manadsbokslut
  for each row execute function public.logga_andring('bokslut', 'id', 'manad', 'stangd');

-- ---------- är dagen i en stängd månad ----------
create or replace function intern.manad_stangd(p_dag date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_dag is not null and exists (
    select 1 from public.manadsbokslut m
     where m.manad = date_trunc('month', p_dag)::date and m.stangd)
$$;

revoke execute on function intern.manad_stangd(date) from public, anon;
grant execute on function intern.manad_stangd(date) to authenticated, service_role;

-- ---------- låset ----------
create or replace function intern.las_stangd_manad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fore date;
  efter date;
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'bookings' then
    fore  := case when tg_op in ('UPDATE', 'DELETE') then old.wanted_date end;
    efter := case when tg_op in ('INSERT', 'UPDATE') then new.wanted_date end;
  else
    if tg_op = 'UPDATE'
       and new.booking_id is not distinct from old.booking_id
       and new.student_id is not distinct from old.student_id
       and new.lesson_date is not distinct from old.lesson_date
       and new.narvaro is not distinct from old.narvaro
       and new.start_tid is not distinct from old.start_tid
       and new.slut_tid is not distinct from old.slut_tid
       and new.avvikelse_skal is not distinct from old.avvikelse_skal then
      return new;
    end if;
    if tg_op in ('UPDATE', 'DELETE') then
      fore := coalesce((select b.wanted_date from public.bookings b where b.id = old.booking_id), old.lesson_date);
    end if;
    if tg_op in ('INSERT', 'UPDATE') then
      efter := coalesce((select b.wanted_date from public.bookings b where b.id = new.booking_id), new.lesson_date);
    end if;
  end if;

  if intern.manad_stangd(fore) or intern.manad_stangd(efter) then
    raise exception using errcode = '42501',
      message = 'Månaden är stängd i bokföringen. Nextrum kan öppna den om något måste ändras.';
  end if;
  return coalesce(new, old);
end $$;

revoke execute on function intern.las_stangd_manad() from public, anon, authenticated;

create trigger bookings_las_stangd_manad
  before insert or update or delete on public.bookings
  for each row execute function intern.las_stangd_manad();

create trigger lesson_reports_las_stangd_manad
  before insert or update or delete on public.lesson_reports
  for each row execute function intern.las_stangd_manad();

-- ---------- månadens läge ----------
/* Allt adminvyn visar för en månad, räknat i databasen: passen, tiden,
   pengarna, underlaget, fakturorna och larmen. Samma svar sparas i
   summering när månaden stängs.

   Pengarna är passens, inte bankens: betalningar på pass i månaden,
   oavsett när de kom. Testbetalningar (stripe_skarp = false) räknas för
   sig och aldrig in i summan: ett testpass i den riktiga databasen ska
   inte se ut som intäkt (Fas 14.7).

   Ingen text om en person: bara antal, minuter, ören och larmens koder
   och id:n. Adminvyn slår upp namnen själv, med sin egen RLS. */
create or replace function public.manad_lage(p_manad date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  forsta date := date_trunc('month', p_manad)::date;
  sista  date := (date_trunc('month', p_manad) + interval '1 month')::date;
  svar   jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum ser bokslutet.';
  end if;

  select jsonb_build_object(
    'manad', forsta,
    'pagar', forsta >= date_trunc('month', now() at time zone 'Europe/Stockholm')::date,
    'bokslut', (select to_jsonb(m) - 'summering' - 'id' from public.manadsbokslut m where m.manad = forsta),
    'pass', (
      select jsonb_build_object(
        'bokade',      count(*) filter (where b.status <> 'cancelled'),
        'genomforda',  count(*) filter (where b.status = 'completed'),
        'avbokade',    count(*) filter (where b.status = 'cancelled'),
        'med_rapport', (select count(*) from public.passunderlag p
                         where p.wanted_date >= forsta and p.wanted_date < sista and p.har_rapport),
        'bokade_min',  coalesce(sum(b.duration_min) filter (where b.status = 'completed'), 0),
        'debiterade_min', (select coalesce(sum(p.debiterade_min), 0) from public.passunderlag p
                            where p.wanted_date >= forsta and p.wanted_date < sista),
        'lon_min',     (select coalesce(sum(p.lon_min), 0) from public.passunderlag p
                         where p.wanted_date >= forsta and p.wanted_date < sista),
        'avvikande',   (select count(*) from public.passunderlag p
                         where p.wanted_date >= forsta and p.wanted_date < sista
                           and p.debiterade_min <> p.duration_min))
        from public.bookings b
       where b.wanted_date >= forsta and b.wanted_date < sista),
    'kort', (
      select jsonb_build_object(
        'antal',        count(*),
        'betalt_ore',   coalesce(sum(b.betalt_ore), 0),
        'aterbetalt_ore', coalesce(sum(b.aterbetald_ore), 0),
        'avgift_ore',   coalesce(sum(b.stripe_avgift_ore), 0),
        'netto_ore',    coalesce(sum(b.stripe_netto_ore), 0),
        'utan_avgift',  count(*) filter (where b.stripe_avgift_ore is null))
        from public.bookings b
       where b.wanted_date >= forsta and b.wanted_date < sista
         and b.betalt_ore is not null and b.stripe_skarp is not false),
    'tillagg', (
      select jsonb_build_object(
        'antal', count(*),
        'betalt_ore', coalesce(sum(t.betalt_ore), 0),
        'aterbetalt_ore', coalesce(sum(t.aterbetald_ore), 0))
        from public.pass_tillagg t
        join public.bookings b on b.id = t.booking_id
       where b.wanted_date >= forsta and b.wanted_date < sista
         and t.status in ('betald', 'aterbetald', 'tvist') and t.stripe_skarp is not false),
    'test', (
      select count(*) from public.bookings b
       where b.wanted_date >= forsta and b.wanted_date < sista and b.stripe_skarp is false),
    'timmar', (
      select count(*) from public.bookings b
       where b.wanted_date >= forsta and b.wanted_date < sista
         and b.klippkort_id is not null and b.status <> 'cancelled'),
    'faktura', (
      select jsonb_build_object('pass', count(*))
        from public.bookings b
       where b.wanted_date >= forsta and b.wanted_date < sista
         and b.betalning_status = 'faktura' and b.status <> 'cancelled'),
    'underlag', (
      select jsonb_build_object(
        'antal', count(*),
        'belopp_ore', coalesce(sum(u.belopp_ore), 0),
        'betalda', count(*) filter (where u.status = 'betald'))
        from public.payouts u where u.period = forsta),
    'fakturor', (
      select jsonb_build_object(
        'antal', count(*),
        'belopp_ore', coalesce(sum(i.belopp_ore), 0),
        'betalda', count(*) filter (where i.betald_at is not null))
        from public.invoices i where i.period = forsta),
    'larm', coalesce((
      select jsonb_agg(jsonb_build_object(
               'typ', a.typ, 'objekt_tabell', a.objekt_tabell, 'objekt_id', a.objekt_id,
               'datum', a.datum, 'belopp_ore', a.belopp_ore) order by a.datum, a.typ)
        from public.avvikelser_rader() a
       where a.datum >= forsta and a.datum < sista), '[]'::jsonb)
  ) into svar;

  return svar;
end $$;

revoke execute on function public.manad_lage(date) from public, anon;
grant execute on function public.manad_lage(date) to authenticated;

-- ---------- stäng ----------
create or replace function public.stang_manad(p_manad date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  forsta date := date_trunc('month', p_manad)::date;
  lage   jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum stänger en månad.';
  end if;
  if forsta >= date_trunc('month', now() at time zone 'Europe/Stockholm')::date then
    raise exception using errcode = '22023', message = 'Månaden är inte slut än.';
  end if;

  -- Två admins som trycker samtidigt: den andra ser den första.
  perform pg_advisory_xact_lock(hashtextextended('bokslut:' || forsta::text, 0));

  if exists (select 1 from public.manadsbokslut where manad = forsta and stangd) then
    raise exception using errcode = '22023', message = 'Månaden är redan stängd.';
  end if;

  lage := public.manad_lage(forsta);
  if jsonb_array_length(lage -> 'larm') > 0 then
    raise exception using errcode = '22023',
      message = format('Månaden har %s larm kvar. Lös dem först.', jsonb_array_length(lage -> 'larm'));
  end if;

  insert into public.manadsbokslut (manad, stangd, stangd_at, stangd_av, summering)
  values (forsta, true, now(), auth.uid(), lage)
  on conflict (manad) do update
     set stangd = true, stangd_at = now(), stangd_av = auth.uid(), summering = excluded.summering;

  return public.manad_lage(forsta);
end $$;

revoke execute on function public.stang_manad(date) from public, anon;
grant execute on function public.stang_manad(date) to authenticated;

-- ---------- öppna ----------
create or replace function public.oppna_manad(p_manad date, p_skal text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  forsta date := date_trunc('month', p_manad)::date;
  skal   text := btrim(coalesce(p_skal, ''));
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum öppnar en månad.';
  end if;
  if char_length(skal) < 5 then
    raise exception using errcode = '22023', message = 'Skriv varför månaden öppnas.';
  end if;

  update public.manadsbokslut
     set stangd = false, oppnad_at = now(), oppnad_av = auth.uid(), oppnad_skal = left(skal, 500)
   where manad = forsta and stangd;
  if not found then
    raise exception using errcode = '22023', message = 'Månaden är inte stängd.';
  end if;

  return public.manad_lage(forsta);
end $$;

revoke execute on function public.oppna_manad(date, text) from public, anon;
grant execute on function public.oppna_manad(date, text) to authenticated;

-- ---------- vakten ----------
do $$
begin
  if has_function_privilege('authenticated', 'intern.las_stangd_manad()', 'execute') then
    raise exception 'En ny triggerfunktion går att anropa.';
  end if;
  if has_function_privilege('anon', 'public.stang_manad(date)', 'execute')
     or has_function_privilege('anon', 'public.manad_lage(date)', 'execute') then
    raise exception 'Bokslutet går att nå utan inloggning.';
  end if;
end $$;
