-- ============================================================
-- nyhetsbrev (2026-10-28): anmälan till nyhetsbrevet, med dubbel opt-in.
--
-- En rad per adress. Edge-funktionen nyhetsbrev skriver och läser med
-- service_role; ingen inloggad och ingen anonym når tabellen (RLS utan
-- policy, och rättigheterna tagna). Tokenen står i mejlets länkar och
-- både bekräftar och avanmäler. En avanmälan raderar raden. En
-- obekräftad rad raderas efter sju dagar, och IP-numrets hash töms när
-- adressen bekräftas: den finns bara för taket.
-- ============================================================

create table public.nyhetsbrev (
  id           uuid primary key default gen_random_uuid(),
  epost        text not null unique check (epost = lower(epost) and length(epost) between 6 and 254),
  lage         text not null default 'vantar' check (lage in ('vantar', 'bekraftad')),
  token        text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  kalla        text check (length(kalla) <= 40),
  sida         text check (length(sida) <= 200),
  ip_nyckel    text,
  created_at   timestamptz not null default now(),
  bekraftad_at timestamptz
);

create index nyhetsbrev_skapad on public.nyhetsbrev (created_at);
create index nyhetsbrev_ip on public.nyhetsbrev (ip_nyckel, created_at) where ip_nyckel is not null;

alter table public.nyhetsbrev enable row level security;
revoke all on public.nyhetsbrev from anon, authenticated;

comment on table public.nyhetsbrev is
  'Nyhetsbrevet: en rad per adress, skriven bara av edge-funktionen nyhetsbrev. DATASKYDD.md rad 40.';

create or replace function intern.nyhetsbrev_gallra()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.nyhetsbrev
   where lage = 'vantar' and created_at < now() - interval '7 days';
$$;

revoke all on function intern.nyhetsbrev_gallra() from public, anon, authenticated;

select cron.schedule('nyhetsbrev-gallra', '41 3 * * *', $$select intern.nyhetsbrev_gallra()$$);
