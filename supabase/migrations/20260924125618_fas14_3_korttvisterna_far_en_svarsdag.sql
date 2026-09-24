-- ============================================================
-- NEXTRUM — Fas 14.3: en korttvist har en sista svarsdag, en orsak
-- och ett utfall
--
-- Punkt 9 på säljarens MVP-lista (DEPLOY-BETALNING.md 9.8): "process
-- för korttvister". Webhooken satte betalning_status = 'tvist' och
-- ingenting mer. Det som avgör om Nextrum får behålla pengarna stod
-- ingenstans:
--
--   · SISTA SVARSDAGEN. Stripe ger en frist för att skicka in
--     underlag. Missas den är tvisten förlorad utan att någon ens sett
--     den, och då är både beloppet och Stripes tvistavgift borta.
--   · ORSAKEN. "Bedrägeri" och "tjänsten levererades inte" kräver
--     olika underlag. Utan orsaken vet ingen vad som ska samlas.
--   · UTFALLET. En förlorad tvist och en öppen såg likadana ut: båda
--     stod som 'tvist' för alltid. En förfrågan som stängdes utan
--     återkrav (warning_closed) stod också kvar som tvist.
--
-- En egen tabell, inte fler kolumner på bookings. Ett pass kan få mer
-- än en tvist (en per betalning, och ett pass kan betalas igen efter
-- en återbetalning), och bookings är tabellen skydda_bokningsfalt
-- vaktar kolumn för kolumn.
--
-- BARA DET STRIPE SÄGER OM TVISTEN SPARAS: id, orsakens KOD, läge,
-- belopp och datum. Inget underlag, ingen text från kortinnehavaren,
-- inget namn. Underlaget skickas in i Stripes dashboard, där det hör
-- hemma; tabellen finns för att ingen ska missa dagen.
--
-- Läge och orsak är Stripes egna koder och prövas bara till FORMEN,
-- inte mot en lista. Lägger Stripe till en kod hade en lista gjort att
-- webhooken föll på insert, svarade 500, och Stripe skickat samma
-- tvist om och om igen utan att den någonsin syntes här.
--
-- Skrivs bara av stripe-webhook (service_role). Admin läser. RLS utan
-- en enda policy för andra ÄR skyddet, som för stripe_handelser.
-- ============================================================

create table if not exists public.stripe_tvister (
  id            text primary key check (id ~ '^[a-z]{2,8}_[A-Za-z0-9]{4,}$'),
  booking_id    uuid references public.bookings(id) on delete set null,
  charge_id     text not null check (char_length(charge_id) between 4 and 255),
  orsak         text check (orsak is null or orsak ~ '^[a-z_]{2,60}$'),
  lage          text not null check (lage ~ '^[a-z_]{2,60}$'),
  belopp_ore    integer check (belopp_ore is null or belopp_ore >= 0),
  svara_senast  timestamptz,
  skarp         boolean not null default false,
  skapad        timestamptz not null default now(),
  stangd        timestamptz,
  uppdaterad    timestamptz not null default now()
);

create index if not exists stripe_tvister_booking_idx on public.stripe_tvister (booking_id);
create index if not exists stripe_tvister_oppna_idx on public.stripe_tvister (svara_senast) where stangd is null;

comment on table public.stripe_tvister is
  'Korttvister från Stripe (Fas 14.3). Skrivs bara av stripe-webhook. Bara koder, belopp och datum: '
  'underlaget skickas in i Stripes dashboard och sparas aldrig här.';
comment on column public.stripe_tvister.svara_senast is
  'evidence_details.due_by. Efter den tiden går inget underlag att skicka in, och tvisten är förlorad.';
comment on column public.stripe_tvister.lage is
  'Stripes status: needs_response, under_review, won, lost, warning_needs_response, warning_under_review, warning_closed.';
comment on column public.stripe_tvister.skarp is
  'livemode. Avgör om länken till Stripes dashboard ska gå till testläget eller det skarpa.';

alter table public.stripe_tvister enable row level security;

revoke all on public.stripe_tvister from anon, authenticated;
grant select on public.stripe_tvister to authenticated;

drop policy if exists "admin läser korttvister" on public.stripe_tvister;
create policy "admin läser korttvister" on public.stripe_tvister
  for select to authenticated
  using (public.is_admin());
