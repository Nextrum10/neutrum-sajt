-- ============================================================
-- NEXTRUM — schema v8: fakturor och utbetalningar
-- Kör EFTER v7. Rensar ingenting.
--
-- Modellen: familjen får en samlingsfaktura i månaden för de pass
-- som faktiskt genomförts, och studiehjälparen ett underlag för
-- samma pass. Ett pass som ställs in faktureras aldrig, och ett
-- pass blir genomfört först när rapporten är skriven — den regeln
-- fanns redan och är hela grunden för att det här går att lita på.
--
-- Pengar lagras som ören i bigint, aldrig som float. 0.1 + 0.2 är
-- inte 0.3 i flyttal, och en faktura som är en krona fel är en
-- faktura någon måste reda ut för hand.
-- ============================================================


-- ============================================================
-- 0. TIMPENNINGEN VAR OSKYDDAD
--
-- skydda_tutorfalt() återställde bara status och id. hourly_rate
-- stod öppen, så en godkänd studiehjälpare kunde sätta sin egen
-- timpenning via API:t — ingen vy visade det, men RLS är radbaserad
-- och UPDATE var tillåtet. Så länge siffran bara visades i en ruta
-- var det en skönhetsfläck. Med utbetalningar är det pengar.
-- ============================================================
create or replace function public.skydda_tutorfalt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  new.status            := old.status;
  new.id                := old.id;
  new.hourly_rate       := old.hourly_rate;
  new.stripe_account_id := old.stripe_account_id;
  new.stripe_klar       := old.stripe_klar;
  return new;
end $$;


-- ============================================================
-- 1. STRIPE-KONTOT PÅ STUDIEHJÄLPAREN
-- Sätts av edge-funktionen, aldrig av användaren själv (se ovan).
-- ============================================================
alter table public.tutor_profiles
  add column if not exists stripe_account_id text,
  add column if not exists stripe_klar boolean not null default false;


-- ============================================================
-- 2. PRISET PÅ ETT STÄLLE
--
-- Priset bor idag i nextrum-config.js, alltså i webbläsaren. Det
-- duger för att visa en siffra på en sida, men inte för att räkna
-- fram en faktura: vem som helst kan ändra det som ligger i
-- webbläsaren. Fakturan läser härifrån i stället.
--
-- Exakt en rad, garanterat av primärnyckeln.
-- ============================================================
create table if not exists public.prissattning (
  id boolean primary key default true check (id),
  pris_per_timme_ore bigint not null default 37900,
  uppdaterad timestamptz not null default now()
);

insert into public.prissattning (id) values (true) on conflict (id) do nothing;

alter table public.prissattning enable row level security;

drop policy if exists "alla inloggade läser priset" on public.prissattning;
create policy "alla inloggade läser priset" on public.prissattning
  for select to authenticated using (true);

drop policy if exists "bara admin ändrar priset" on public.prissattning;
create policy "bara admin ändrar priset" on public.prissattning
  for all using (public.is_admin()) with check (public.is_admin());


-- ============================================================
-- 3. FAKTUROR — familjen betalar
--
-- period är alltid den första i månaden. Det gör unique-villkoret
-- meningsfullt: en familj kan bara ha en faktura per månad, så en
-- körning som råkar gå två gånger skapar inte dubbletter.
-- ============================================================
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete restrict,
  period date not null,
  status text not null default 'utkast'
    check (status in ('utkast','skickad','betald','forfallen','makulerad')),
  belopp_ore bigint not null default 0 check (belopp_ore >= 0),
  valuta text not null default 'SEK',
  forfaller date,
  skickad_at timestamptz,
  betald_at timestamptz,
  stripe_invoice_id text unique,
  stripe_url text,
  created_at timestamptz not null default now(),
  unique (parent_id, period)
);

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  beskrivning text not null,
  minuter int not null check (minuter > 0),
  pris_per_timme_ore bigint not null,
  belopp_ore bigint not null
);

-- Ett pass får faktureras en gång. Inte en gång per faktura — en
-- gång, punkt. Utan det här indexet skulle en omkörning av
-- faktureringen kunna ta betalt två gånger för samma lektion.
create unique index if not exists invoice_lines_ett_pass_en_gang
  on public.invoice_lines (booking_id) where booking_id is not null;

create index if not exists invoice_lines_faktura_idx
  on public.invoice_lines (invoice_id);


-- ============================================================
-- 4. UTBETALNINGAR — studiehjälparen får betalt
-- ============================================================
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete restrict,
  period date not null,
  status text not null default 'utkast'
    check (status in ('utkast','godkand','utbetald','misslyckad')),
  belopp_ore bigint not null default 0 check (belopp_ore >= 0),
  minuter int not null default 0,
  valuta text not null default 'SEK',
  utbetald_at timestamptz,
  stripe_transfer_id text unique,
  fel text,
  created_at timestamptz not null default now(),
  unique (tutor_id, period)
);

create table if not exists public.payout_lines (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.payouts(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  beskrivning text not null,
  minuter int not null check (minuter > 0),
  timpenning_ore bigint not null,
  belopp_ore bigint not null
);

create unique index if not exists payout_lines_ett_pass_en_gang
  on public.payout_lines (booking_id) where booking_id is not null;

create index if not exists payout_lines_utbetalning_idx
  on public.payout_lines (payout_id);


-- ============================================================
-- 5. VEM FÅR SE VAD
--
-- Ingen skriver till de här tabellerna från webbläsaren. Fakturor
-- och utbetalningar skapas av edge-funktionen med service_role.
-- Därför finns bara SELECT-policyer för användarna: kan man inte
-- skriva kan man inte heller skriva fel belopp.
-- ============================================================
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.payouts enable row level security;
alter table public.payout_lines enable row level security;

drop policy if exists "familjen läser sina fakturor" on public.invoices;
create policy "familjen läser sina fakturor" on public.invoices
  for select using (auth.uid() = parent_id);

drop policy if exists "admin full åtkomst fakturor" on public.invoices;
create policy "admin full åtkomst fakturor" on public.invoices
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "familjen läser sina fakturarader" on public.invoice_lines;
create policy "familjen läser sina fakturarader" on public.invoice_lines
  for select using (exists (
    select 1 from public.invoices i
    where i.id = invoice_id and i.parent_id = auth.uid()));

drop policy if exists "admin full åtkomst fakturarader" on public.invoice_lines;
create policy "admin full åtkomst fakturarader" on public.invoice_lines
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "studiehjälparen läser sina utbetalningar" on public.payouts;
create policy "studiehjälparen läser sina utbetalningar" on public.payouts
  for select using (auth.uid() = tutor_id);

drop policy if exists "admin full åtkomst utbetalningar" on public.payouts;
create policy "admin full åtkomst utbetalningar" on public.payouts
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "studiehjälparen läser sina utbetalningsrader" on public.payout_lines;
create policy "studiehjälparen läser sina utbetalningsrader" on public.payout_lines
  for select using (exists (
    select 1 from public.payouts p
    where p.id = payout_id and p.tutor_id = auth.uid()));

drop policy if exists "admin full åtkomst utbetalningsrader" on public.payout_lines;
create policy "admin full åtkomst utbetalningsrader" on public.payout_lines
  for all using (public.is_admin()) with check (public.is_admin());


-- ============================================================
-- 6. DET SOM ÄNNU INTE FAKTURERATS
--
-- Vyerna svarar på frågan båda parter faktiskt ställer: "vad har
-- jag dragit ihop den här månaden?" security_invoker gör att
-- bookings egna RLS gäller, så familjen ser bara sina egna pass
-- och studiehjälparen sina.
-- ============================================================
create or replace view public.ofakturerat as
  select
    b.parent_id,
    count(*)                       as pass,
    coalesce(sum(b.duration_min),0) as minuter
  from public.bookings b
  left join public.invoice_lines l on l.booking_id = b.id
  where b.status = 'completed' and l.id is null and b.parent_id is not null
  group by b.parent_id;

alter view public.ofakturerat set (security_invoker = true);
grant select on public.ofakturerat to authenticated;

create or replace view public.ej_utbetalt as
  select
    b.tutor_id,
    count(*)                       as pass,
    coalesce(sum(b.duration_min),0) as minuter
  from public.bookings b
  left join public.payout_lines l on l.booking_id = b.id
  where b.status = 'completed' and l.id is null and b.tutor_id is not null
  group by b.tutor_id;

alter view public.ej_utbetalt set (security_invoker = true);
grant select on public.ej_utbetalt to authenticated;


-- ============================================================
-- KLART.
--
-- Vad som INTE ligger här, med flit:
--
--   · Inga kortuppgifter. Nextrum lagrar aldrig ett kortnummer.
--     Stripe är värd för betalsidan, och vi sparar bara id:t och
--     adressen dit. Det är skillnaden mellan att hantera
--     kortdata och att slippa hantera kortdata.
--
--   · Ingen INSERT-policy för användarna. Belopp sätts av
--     edge-funktionen med service_role, aldrig från webbläsaren.
--
--   · Ingen automatisk körning. Faktureringen startas av
--     edge-funktionen fakturering; sätt ett schema på den i
--     Supabase när ni är redo. Det ska vara ett aktivt beslut när
--     riktiga pengar börjar röra sig.
-- ============================================================
