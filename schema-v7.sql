-- ============================================================
-- NEXTRUM — schema v7: serier, notiser och förberedda omdömen
-- Kör EFTER v6. Rensar ingenting.
-- ============================================================


-- ============================================================
-- 1. ÅTERKOMMANDE PASS
-- Ett återkommande pass är inte en egen sorts rad — det är flera
-- vanliga pass som delar series_id. Då fungerar allt annat som
-- förut (avboka ett, flytta ett, rapportera ett), och den som vill
-- avboka hela serien kan göra det på id:t.
-- ============================================================
alter table public.bookings
  add column if not exists series_id uuid;

create index if not exists bookings_serie_idx
  on public.bookings (series_id) where series_id is not null;


-- ============================================================
-- 2. SENAST SEDD
-- Notiserna behöver veta vad som är nytt sedan sist. Utan en
-- tidpunkt att jämföra mot går det bara att räkna olästa
-- meddelanden, inte "två nya läxor sedan du var här".
-- ============================================================
alter table public.profiles
  add column if not exists last_seen_at timestamptz;

-- Egen rad, eget fält. Triggern skydda_profilfalt() i v3 återställer
-- allt utom det den listar, så last_seen_at måste släppas fram
-- uttryckligen — annars kan ingen någonsin uppdatera den.
create or replace function public.skydda_profilfalt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;

  new.is_admin         := old.is_admin;
  new.role             := old.role;
  new.match_status     := old.match_status;
  new.matched_tutor_id := old.matched_tutor_id;
  new.id               := old.id;
  return new;
end $$;


-- ============================================================
-- 3. OMDÖMEN — förberett, inte påslaget
--
-- Tabellen finns så att strukturen är genomtänkt när ni vill börja
-- samla in dem: ett omdöme hör till ett genomfört pass, inte till
-- en studiehjälpare i allmänhet, annars går det inte att veta vad
-- det handlar om. Ingen vy skriver till den än.
-- ============================================================
create table if not exists public.tutor_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  rating smallint check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (booking_id)
);

alter table public.tutor_reviews enable row level security;

-- Familjen skriver om sitt eget genomförda pass.
drop policy if exists "familjen skriver omdöme" on public.tutor_reviews;
create policy "familjen skriver omdöme" on public.tutor_reviews
  for insert with check (
    auth.uid() = parent_id
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.parent_id = auth.uid() and b.status = 'completed'
    )
  );

drop policy if exists "familjen läser sina omdömen" on public.tutor_reviews;
create policy "familjen läser sina omdömen" on public.tutor_reviews
  for select using (auth.uid() = parent_id);

-- Studiehjälparen ser vad som skrivits om hen, men kan inte ändra
-- det. Ett omdöme man kan skriva om själv är inget omdöme.
drop policy if exists "studiehjälparen läser sina omdömen" on public.tutor_reviews;
create policy "studiehjälparen läser sina omdömen" on public.tutor_reviews
  for select using (auth.uid() = tutor_id);

drop policy if exists "admin full åtkomst omdömen" on public.tutor_reviews;
create policy "admin full åtkomst omdömen" on public.tutor_reviews
  for all using (public.is_admin());


-- ============================================================
-- 4. FAMILJENS EGNA ANTECKNINGAR — egen tabell, inte en kolumn
--
-- Först låg de i students.family_notes. Det höll inte: studiehjälparen
-- måste kunna läsa elevraden för att undervisa, och RLS är radbaserad,
-- inte kolumnbaserad. Hen hade alltså kunnat hämta anteckningen via
-- API:t fastän ingen vy visade den. En egen tabell är enda sättet att
-- verkligen hålla löftet "bara ni ser dem".
-- ============================================================
create table if not exists public.student_notes (
  student_id uuid primary key references public.students(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.student_notes enable row level security;

drop policy if exists "bara familjen läser sina anteckningar" on public.student_notes;
create policy "bara familjen läser sina anteckningar" on public.student_notes
  for select using (auth.uid() = parent_id);

drop policy if exists "bara familjen skriver sina anteckningar" on public.student_notes;
create policy "bara familjen skriver sina anteckningar" on public.student_notes
  for all using (auth.uid() = parent_id) with check (
    auth.uid() = parent_id
    and exists (select 1 from public.students s
                where s.id = student_id and s.parent_id = auth.uid())
  );

-- Ingen adminpolicy med flit: det här är det enda i systemet som är
-- privat även för oss. Behövs det någonsin finns service_role, och då
-- är det ett aktivt beslut.

alter table public.students drop column if exists family_notes;


-- ============================================================
-- KLART.
--
-- Kvar som fortfarande sköts i Table Editor: matchningen mellan
-- familj och studiehjälpare, godkännande av studiehjälpare, och
-- timpenningen. Det är medvetet — ett eget adminverktyg är en egen
-- vy med egna behörigheter, inte en knapp i studiehjälparvyn.
-- ============================================================
