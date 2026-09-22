-- ============================================================
-- NEXTRUM — Fas 12.1: Stripe Connect och betalning per pass
--
-- Arkitekturen är den Stripe-säljaren rekommenderade och som
-- SKISS-BETALNING-STRIPE.md beskriver: anslutna konton per
-- studiehjälpare, kortbetalning i Checkout och destination charges
-- med en application fee till Nextrum. Skissen står kvar oförändrad
-- och säger emot det här valet; den är kvar med flit, så att den som
-- läser om ett år ser att invändningen fanns och att beslutet togs
-- ändå.
--
-- MIGRATIONEN SKRIVER INGA BELOPP OCH SLÅR INTE PÅ NÅGOT.
-- Den lägger kolumner, ett tak mot dubbla webhookar och ett skydd.
--
--
-- 0. SKYDDET FÖRST, AV ETT SKÄL SOM REDAN KOSTAT EN GÅNG
--
-- skydda_tutorfalt() var en NEKA-lista: den nollställde de kolumner
-- som räknades upp och släppte igenom allt annat. Filhuvudet i
-- schema-v8 berättar vad det kostade förra gången — hourly_rate stod
-- öppen, och "så länge siffran bara visades i en ruta var det en
-- skönhetsfläck; med utbetalningar är det pengar".
--
-- Samma fälla står och väntar här. Läggs stripe_kan_ta_emot till utan
-- att listan rörs kan en godkänd studiehjälpare sätta den på sig själv
-- via API:t och ta emot pengar utan att ha gjort onboardingen. Ingen vy
-- visar det. RLS är radbaserad, och UPDATE är tillåtet på egen rad.
--
-- Triggern blir därför en TILLÅT-lista, precis som skydda_bokningsfalt
-- redan är (`to_jsonb(new) - fria`). Då är varje framtida kolumn fryst
-- som förval, och den här buggen kan inte begås en tredje gång.
--
-- FÖLJD SOM ÄR AVSIKTLIG: tjanster och visa_publikt gick tidigare att
-- sätta från en inloggad session, eftersom de inte stod i neka-listan.
-- De är frysta nu. Ingen vy skriver dem, och vilka tjänster någon får
-- utföra och om profilen syns publikt hänger ihop med godkännandet,
-- som admin äger.
-- ============================================================

create or replace function public.skydda_tutorfalt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Vad studiehjälparen själv råder över. Allt annat ärvs från old.
  -- Listan speglar exakt vad profilformuläret i studiehjälparvyn
  -- skickar, plus de två fält adminvyn fyller i vid rekryteringen och
  -- som personen rimligen får rätta själv.
  fria      text[] := array['school', 'city', 'subjects', 'grade_levels',
                            'formats', 'bio', 'age', 'availability'];
  andringar jsonb;
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;

  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    into andringar
    from jsonb_each(to_jsonb(new)) as e
   where e.key = any(fria);

  -- Basen anges som en NULL av tabellens egen typ. jsonb_populate_record
  -- är polymorf, och OLD är `record` i plpgsql: skickas OLD direkt in
  -- kan typen inte bestämmas vid kompileringen.
  new := jsonb_populate_record(null::public.tutor_profiles, to_jsonb(old) || andringar);
  return new;
end $$;

comment on function public.skydda_tutorfalt() is
  'Tillåt-lista: bara fälten i fria kan ändras från en inloggad session. Allt annat, inklusive varje ny kolumn, ärvs från raden som redan finns.';


-- ============================================================
-- 1. KONTOTS TILLSTÅND ÄR FEM SAKER, INTE EN
--
-- stripe_klar var en enda boolean. Säljaren pekade på precis varför
-- det inte räcker: att användaren kommer tillbaka till return_url
-- betyder inte att onboardingen är klar, och Stripe kan begära
-- komplettering i efterhand. En boolean satt vid återkomsten ljuger
-- förr eller senare, och den ljuger åt det håll som kostar pengar.
--
-- stripe_klar finns kvar, men är HÄRLEDD och skrivs bara av
-- edge-funktionen: den är sann när kontot både kan ta emot en
-- överföring och har utbetalningar igång. Två vyer läser den redan
-- (nextrum-larare-vy.js, nextrum-admin-detalj.js) och behöver inte
-- ändras.
-- ============================================================

alter table public.tutor_profiles
  add column if not exists stripe_onboarding text not null default 'ej_paborjad',
  add column if not exists stripe_kan_ta_emot boolean not null default false,
  add column if not exists stripe_utbetalning_aktiv boolean not null default false,
  add column if not exists stripe_krav text[] not null default '{}',
  add column if not exists stripe_kontrollerad_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tutor_profiles_stripe_onboarding_check'
  ) then
    alter table public.tutor_profiles
      add constraint tutor_profiles_stripe_onboarding_check
      check (stripe_onboarding in ('ej_paborjad', 'pagar', 'klar'));
  end if;
end $$;

comment on column public.tutor_profiles.stripe_onboarding is
  'ej_paborjad | pagar | klar. Klar betyder att Stripe inte längre begär något, inte att personen klickat sig tillbaka.';
comment on column public.tutor_profiles.stripe_kan_ta_emot is
  'Kontot kan ta emot en överföring. Ingen betalning får peka på ett konto där den är false.';
comment on column public.tutor_profiles.stripe_utbetalning_aktiv is
  'Stripe betalar ut till bankkontot. Kan vara false medan kan_ta_emot är true: pengarna kommer in men stannar.';
comment on column public.tutor_profiles.stripe_krav is
  'Vad Stripe saknar just nu. Visas för personen så att hen vet vad som ska kompletteras.';
comment on column public.tutor_profiles.stripe_kontrollerad_at is
  'När tillståndet senast lästes från Stripe. Utan den går det inte att skilja "allt är bra" från "vi har inte frågat".';
comment on column public.tutor_profiles.stripe_klar is
  'HÄRLEDD: kan_ta_emot och utbetalning_aktiv. Skrivs bara av edge-funktionen stripe-konto. Sätt den aldrig för hand.';


-- ============================================================
-- 2. BETALNINGEN PÅ PASSET
--
-- Beloppen FRYSES när Checkout-sessionen skapas, av samma skäl som
-- bookings.rabatt_ore redan fryses vid bokningen: annars ändrar sig ett
-- gammalt pass pris den dag någon justerar koden eller prislistan.
-- Det som står här är vad kunden faktiskt betalade, vad
-- studiehjälparen faktiskt fick och vad Nextrum faktiskt behöll.
--
-- Kolumnerna skyddas automatiskt. skydda_bokningsfalt är redan en
-- tillåt-lista (`to_jsonb(new) - fria`), och de nya namnen står inte i
-- fria — alltså kan ingen inloggad session sätta dem. Bara
-- edge-funktionen, med service_role, skriver här. Samma regel som att
-- invoices och payouts med flit saknar INSERT-policy för användare:
-- kan ingen skriva belopp från webbläsaren kan ingen skriva fel belopp.
-- ============================================================

alter table public.bookings
  add column if not exists betalning_status text not null default 'ingen',
  add column if not exists stripe_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_transfer_id text,
  add column if not exists stripe_charge_id text,
  add column if not exists betalt_ore bigint,
  add column if not exists ersattning_ore bigint,
  add column if not exists avgift_ore bigint,
  add column if not exists betald_at timestamptz,
  add column if not exists aterbetald_ore bigint not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_betalning_status_check'
  ) then
    alter table public.bookings
      add constraint bookings_betalning_status_check
      check (betalning_status in ('ingen', 'vantar', 'betald', 'aterbetald', 'tvist', 'misslyckad'));
  end if;
end $$;

-- Ett pass kan bara ha en session och en betalning. Unikt index i
-- stället för en kontroll i koden: två samtidiga anrop hinner båda
-- förbi ett `select ... where is null`, men inte förbi det här.
create unique index if not exists bookings_stripe_session_uniq
  on public.bookings (stripe_session_id) where stripe_session_id is not null;
create unique index if not exists bookings_stripe_pi_uniq
  on public.bookings (stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create unique index if not exists bookings_stripe_transfer_uniq
  on public.bookings (stripe_transfer_id) where stripe_transfer_id is not null;

comment on column public.bookings.betalning_status is
  'ingen | vantar | betald | aterbetald | tvist | misslyckad. Sätts bara av webhooken, aldrig av en redirect.';
comment on column public.bookings.betalt_ore is
  'Vad familjen betalade, fryst när sessionen skapades.';
comment on column public.bookings.ersattning_ore is
  'Studiehjälparens del, fryst. Räknas ALDRIG om ur betalt_ore i efterhand.';
comment on column public.bookings.avgift_ore is
  'Nextrums application fee, fryst. betalt_ore minus ersattning_ore.';


-- ============================================================
-- 3. WEBHOOKEN FÅR KOMMA TVÅ GÅNGER
--
-- Stripe garanterar minst en leverans, inte exakt en. Samma händelse
-- kan alltså komma igen efter en timeout, och en andra körning av
-- "betald" som också skapar en överföring är pengar som går iväg två
-- gånger.
--
-- Taket är en tabell med händelsens id som primärnyckel. Är insert:en
-- en konflikt har händelsen redan hanterats, och funktionen svarar 200
-- utan att göra något. 200 är rätt: ett fel hade fått Stripe att
-- försöka igen, i all oändlighet, med en händelse som redan är klar.
--
-- Ingen RLS-policy, med flit. Tabellen är bara service_role:s, precis
-- som notis_konfig och fortnox_token.
-- ============================================================

create table if not exists public.stripe_handelser (
  id           text primary key,
  typ          text not null,
  mottagen_at  timestamptz not null default now(),
  hanterad_at  timestamptz,
  resultat     text
);

alter table public.stripe_handelser enable row level security;

comment on table public.stripe_handelser is
  'Sedda webhookhändelser. Primärnyckeln ÄR idempotensen: en andra leverans av samma id blir en konflikt och hanteras inte igen.';
