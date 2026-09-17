-- ============================================================
-- NEXTRUM — schema v2: matchning, elever, studieplaner, lektionsrapporter
-- Kör EFTER schema.sql (den här bygger vidare, den rensar inget).
-- Klistra in hela filen i Supabase → SQL Editor → Run.
-- ============================================================

-- ---------- matchningsstatus på föräldrakontot ----------
alter table public.profiles
  add column if not exists match_status text not null default 'pending'
    check (match_status in ('pending','matched')),
  add column if not exists matched_tutor_id uuid references public.profiles(id);

-- ============================================================
-- LEADS — intresseanmälningar från hemsidans huvudsida (inte ansökan
-- om att bli lärare, det är "applications". Detta är familjer som
-- vill ha hjälp). Ni granskar i Table Editor och matchar manuellt,
-- sen skapar familjen ett konto (eller redan har ett) och ni sätter
-- match_status='matched' + matched_tutor_id på deras profiles-rad.
-- ============================================================
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  parent_name text not null,
  email text not null,
  child_name text,
  grade text,
  subject text,
  message text,
  status text not null default 'new' check (status in ('new','contacted','matched','declined')),
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;

create policy "vem som helst kan skicka intresseanmälan" on public.leads
  for insert with check (true);

create policy "endast admin läser intresseanmälningar" on public.leads
  for select using (public.is_admin());

-- ============================================================
-- STUDENTS — barnet/eleven, kopplat till förälderns konto.
-- En förälder kan ha fler än ett barn, därför egen tabell.
-- ============================================================
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  grade text,
  created_at timestamptz not null default now()
);

alter table public.students enable row level security;

create policy "förälder ser egna barn" on public.students
  for select using (auth.uid() = parent_id);

create policy "förälder hanterar egna barn" on public.students
  for insert with check (auth.uid() = parent_id);

create policy "förälder uppdaterar egna barn" on public.students
  for update using (auth.uid() = parent_id);

-- ---------- hjälpfunktion: är jag den tilldelade läraren för detta barns förälder? ----------
-- Samma anledning som is_admin() i schema.sql: en policy (här på
-- "students") som frågar "profiles" skulle annars trigga profiles
-- egna RLS-regler, vilket inkluderar den admin-koll som i sin tur
-- skulle rekursera. SECURITY DEFINER bryter kedjan. Definieras här
-- eftersom den hör ihop med matchningsfunktionen i den här filen,
-- men fungerar precis som is_admin().
create or replace function public.is_matched_tutor_of(parent_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = parent_uuid and p.matched_tutor_id = auth.uid()
  )
$$;

create policy "tilldelad lärare ser sina elever" on public.students
  for select using (public.is_matched_tutor_of(students.parent_id));

create policy "admin fullständig åtkomst elever" on public.students
  for all using (public.is_admin());

-- ============================================================
-- STUDY_PLANS — en skräddarsydd plan per elev, skriven av den
-- tilldelade läraren efter matchning. Ämne, mål, själva planen.
-- ============================================================
create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  tutor_id uuid not null references public.profiles(id),
  subject text,
  goals text,
  plan_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.study_plans enable row level security;

create policy "förälder läser sitt barns studieplan" on public.study_plans
  for select using (
    exists (select 1 from public.students s where s.id = study_plans.student_id and s.parent_id = auth.uid())
  );

create policy "tilldelad lärare hanterar studieplan" on public.study_plans
  for all using (auth.uid() = tutor_id) with check (auth.uid() = tutor_id);

create policy "admin fullständig åtkomst studieplaner" on public.study_plans
  for all using (public.is_admin());

-- ============================================================
-- LESSON_REPORTS — rapport efter varje lektion. raw_notes är det
-- läraren faktiskt skriver, ai_feedback är den polerade versionen
-- som visas för föräldern (fylls i av Edge Function, se README).
-- Tills AI-funktionen är på plats visas raw_notes rakt av, det är
-- en fallback, inte ett fel.
-- ============================================================
create table if not exists public.lesson_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  tutor_id uuid not null references public.profiles(id),
  booking_id uuid references public.bookings(id) on delete set null,
  lesson_date date not null default current_date,
  raw_notes text not null,
  ai_feedback text,
  created_at timestamptz not null default now()
);

alter table public.lesson_reports enable row level security;

create policy "förälder läser sitt barns lektionsrapporter" on public.lesson_reports
  for select using (
    exists (select 1 from public.students s where s.id = lesson_reports.student_id and s.parent_id = auth.uid())
  );

create policy "tilldelad lärare skriver och läser rapporter" on public.lesson_reports
  for all using (auth.uid() = tutor_id) with check (auth.uid() = tutor_id);

create policy "admin fullständig åtkomst rapporter" on public.lesson_reports
  for all using (public.is_admin());

-- ============================================================
-- ARBETADE TIMMAR — härleds från bokningar markerade 'completed'.
-- Ingen ny tabell behövs, bara en vy som summerar per lärare.
-- Läraren kan bara se sin egen rad.
-- ============================================================
create or replace view public.tutor_hours as
  select
    tutor_id,
    count(*) filter (where status = 'completed') as passed_completed,
    count(*) filter (where status = 'confirmed') as passed_kommande
  from public.bookings
  where tutor_id is not null
  group by tutor_id;

alter view public.tutor_hours set (security_invoker = true);
-- security_invoker gör att vyn respekterar bookings-tabellens egna
-- RLS-regler (läraren ser bara rader där tutor_id = de själva),
-- till skillnad från tutor_busy_slots i schema.sql som medvetet
-- kringgår RLS för att vara publik.

grant select on public.tutor_hours to authenticated;

-- ============================================================
-- KLART. Nästa steg (separat): Edge Function som tar raw_notes,
-- anropar Claude, och fyller i ai_feedback. Se generate-feedback.ts
-- och DEPLOY-INSTRUKTIONER.md.
-- ============================================================
