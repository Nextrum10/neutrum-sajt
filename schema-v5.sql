-- ============================================================
-- NEXTRUM — schema v5: från bokningssystem till studieplattform
-- Kör EFTER schema.sql, v2, v3 och v4. Rensar ingenting.
--
-- Det v4 gav var kontakten. Det här ger själva studiearbetet:
-- läxor, material, kunskapsområden, närvaro, tillgänglighet och
-- arbetade timmar — allt kopplat till samma elev, så att det
-- studiehjälparen gör syns hos familjen utan mellansteg.
-- ============================================================


-- ============================================================
-- 1. PROFILER — bild, presentation, telefon
-- avatar_url pekar på en fil i Storage (bucketen skapas i det steg
-- där uppladdningen byggs, inte här — en kolumn utan bild är
-- ofarlig, en bucket utan uppladdning är bara skräp).
-- ============================================================
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists bio text,
  add column if not exists phone text;

-- Timpenning för studiehjälparen. Medvetet utan defaultvärde:
-- ingen siffra ska hittas på, vyn visar "inte satt" tills ni satt
-- den i Table Editor.
alter table public.tutor_profiles
  add column if not exists hourly_rate numeric(8,2);


-- ============================================================
-- 2. ELEVEN — en riktig profil, inte bara ett namn
-- ============================================================
alter table public.students
  add column if not exists school text,
  add column if not exists goals text,
  add column if not exists subjects text[] not null default '{}',
  add column if not exists about text;

-- Familjens egna anteckningar om barnet. Syns INTE för
-- studiehjälparen — därför en egen kolumn och inte "notes".
alter table public.students
  add column if not exists family_notes text;


-- ============================================================
-- 3. PASSEN — längd och närvaro
-- Utan duration_min går arbetade timmar inte att räkna: ett pass
-- har hittills bara haft en starttid. 60 minuter är den längd
-- verksamheten faktiskt kör, så den är default här.
-- ============================================================
alter table public.bookings
  add column if not exists duration_min int not null default 60,
  add column if not exists attendance text
    check (attendance in ('narvarande','sen','franvarande'));


-- ============================================================
-- 4. LEKTIONSRAPPORTEN — de fyra fälten som saknades
-- raw_notes finns kvar som "vad ni gjorde". Resten är de frågor
-- en förälder faktiskt vill ha svar på efter ett pass.
-- ============================================================
alter table public.lesson_reports
  add column if not exists went_well text,
  add column if not exists needs_practice text,
  add column if not exists next_focus text;


-- ============================================================
-- 5. LÄXOR
--
-- Tre lägen lagras, inte fyra: 'forsenad' räknas fram ur
-- due_date i vyn i stället för att sparas. En sparad
-- försenad-status hade krävt ett schemalagt jobb som vänder den
-- vid midnatt, och varit fel varje gång jobbet inte kört.
-- ============================================================
create table if not exists public.homework (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  instructions text,
  subject text,
  due_date date,
  status text not null default 'ej_paborjad'
    check (status in ('ej_paborjad','pagaende','klar')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.homework enable row level security;

create index if not exists homework_elev_idx
  on public.homework (student_id, due_date);

drop policy if exists "studiehjälpare hanterar läxor för egen elev" on public.homework;
create policy "studiehjälpare hanterar läxor för egen elev" on public.homework
  for all using (auth.uid() = tutor_id and public.is_my_student(student_id))
  with check (auth.uid() = tutor_id and public.is_my_student(student_id));

drop policy if exists "familjen läser sina läxor" on public.homework;
create policy "familjen läser sina läxor" on public.homework
  for select using (
    exists (select 1 from public.students s
            where s.id = homework.student_id and s.parent_id = auth.uid())
  );

-- Familjen får uppdatera raden, men triggern nedan bestämmer VAD.
drop policy if exists "familjen bockar av läxan" on public.homework;
create policy "familjen bockar av läxan" on public.homework
  for update using (
    exists (select 1 from public.students s
            where s.id = homework.student_id and s.parent_id = auth.uid())
  );

drop policy if exists "admin full åtkomst läxor" on public.homework;
create policy "admin full åtkomst läxor" on public.homework
  for all using (public.is_admin());

-- RLS kan inte begränsa kolumner. Utan den här kunde familjen
-- skriva om läxans titel, instruktion och deadline — alltså ändra
-- vad som var uppgiften efter att den bockats av. Nu får de bara
-- röra status, och completed_at sätts av databasen.
create or replace function public.skydda_laxa()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or auth.uid() = old.tutor_id or auth.uid() is null then
    -- studiehjälparen och admin får ändra fritt; stämpla bara av-tiden
    if new.status = 'klar' and old.status is distinct from 'klar' then
      new.completed_at := now();
    elsif new.status <> 'klar' then
      new.completed_at := null;
    end if;
    return new;
  end if;

  -- familjen: bara status
  new.id           := old.id;
  new.student_id   := old.student_id;
  new.tutor_id     := old.tutor_id;
  new.title        := old.title;
  new.instructions := old.instructions;
  new.subject      := old.subject;
  new.due_date     := old.due_date;
  new.created_at   := old.created_at;

  if new.status = 'klar' and old.status is distinct from 'klar' then
    new.completed_at := now();
  elsif new.status <> 'klar' then
    new.completed_at := null;
  else
    new.completed_at := old.completed_at;
  end if;

  return new;
end $$;

drop trigger if exists homework_skydda on public.homework;
create trigger homework_skydda
  before update on public.homework
  for each row execute function public.skydda_laxa();


-- ============================================================
-- 6. MATERIAL
-- kind avgör vad raden betyder: en fil i Storage, en länk utåt,
-- eller en anteckning som bara är text.
-- ============================================================
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  kind text not null default 'lank' check (kind in ('fil','lank','anteckning')),
  url text,
  body text,
  subject text,
  created_at timestamptz not null default now()
);

alter table public.materials enable row level security;

create index if not exists materials_elev_idx
  on public.materials (student_id, created_at desc);

drop policy if exists "studiehjälpare hanterar material för egen elev" on public.materials;
create policy "studiehjälpare hanterar material för egen elev" on public.materials
  for all using (auth.uid() = tutor_id and public.is_my_student(student_id))
  with check (auth.uid() = tutor_id and public.is_my_student(student_id));

drop policy if exists "familjen läser sitt material" on public.materials;
create policy "familjen läser sitt material" on public.materials
  for select using (
    exists (select 1 from public.students s
            where s.id = materials.student_id and s.parent_id = auth.uid())
  );

drop policy if exists "admin full åtkomst material" on public.materials;
create policy "admin full åtkomst material" on public.materials
  for all using (public.is_admin());


-- ============================================================
-- 7. KUNSKAPSOMRÅDEN
-- Ett område per rad: ämne + område + nivå. Det är det som gör
-- utvecklingen synlig för eleven utan att någon behöver sätta
-- betyg.
-- ============================================================
create table if not exists public.progress_items (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  area text not null,
  level text not null default 'behover_trana'
    check (level in ('behover_trana','pa_god_vag','bra')),
  comment text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (student_id, subject, area)
);

alter table public.progress_items enable row level security;

drop policy if exists "studiehjälpare hanterar progress för egen elev" on public.progress_items;
create policy "studiehjälpare hanterar progress för egen elev" on public.progress_items
  for all using (auth.uid() = tutor_id and public.is_my_student(student_id))
  with check (auth.uid() = tutor_id and public.is_my_student(student_id));

drop policy if exists "familjen läser sin progress" on public.progress_items;
create policy "familjen läser sin progress" on public.progress_items
  for select using (
    exists (select 1 from public.students s
            where s.id = progress_items.student_id and s.parent_id = auth.uid())
  );

drop policy if exists "admin full åtkomst progress" on public.progress_items;
create policy "admin full åtkomst progress" on public.progress_items
  for all using (public.is_admin());


-- ============================================================
-- 8. TILLGÄNGLIGHET
-- Två tabeller: återkommande veckotider, och enstaka dagar eller
-- tider som är blockerade. Bokningsflödet ska kunna svara på
-- "kan jag boka torsdag 17:00?" utan att veta något personligt.
-- weekday: 0 = måndag, 6 = söndag.
-- ============================================================
create table if not exists public.tutor_availability (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

alter table public.tutor_availability enable row level security;

drop policy if exists "studiehjälpare hanterar sin tillgänglighet" on public.tutor_availability;
create policy "studiehjälpare hanterar sin tillgänglighet" on public.tutor_availability
  for all using (auth.uid() = tutor_id) with check (auth.uid() = tutor_id);

-- Veckotiderna är inte personliga — de måste kunna läsas av den
-- som ska boka, annars går det inte att gråa ut omöjliga tider.
drop policy if exists "alla läser tillgängliga tider" on public.tutor_availability;
create policy "alla läser tillgängliga tider" on public.tutor_availability
  for select using (true);

create table if not exists public.tutor_blocked (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  block_date date not null,
  block_time text,          -- null = hela dagen
  reason text,
  created_at timestamptz not null default now()
);

alter table public.tutor_blocked enable row level security;

drop policy if exists "studiehjälpare hanterar sina spärrar" on public.tutor_blocked;
create policy "studiehjälpare hanterar sina spärrar" on public.tutor_blocked
  for all using (auth.uid() = tutor_id) with check (auth.uid() = tutor_id);

-- Skälet till en spärr kan vara privat ("läkarbesök"), så det
-- lämnas inte ut. Vyn ger bara vilken tid som är upptagen.
create or replace view public.blockerade_tider as
  select tutor_id, block_date, block_time from public.tutor_blocked;

grant select on public.blockerade_tider to anon, authenticated;


-- ============================================================
-- 9. ARBETADE TIMMAR
-- Räknas ur genomförda pass och deras längd. Bara 'completed'
-- räknas — ett bokat pass är inte en arbetad timme.
-- security_invoker gör att vyn lyder bookings egna RLS-regler,
-- så en studiehjälpare bara ser sina egna rader.
-- ============================================================
create or replace view public.arbetade_timmar as
  select
    tutor_id,
    round(sum(duration_min) / 60.0, 2) as timmar_totalt,
    round(sum(duration_min) filter (
      where wanted_date >= date_trunc('week', current_date)::date) / 60.0, 2) as timmar_vecka,
    round(sum(duration_min) filter (
      where wanted_date >= date_trunc('month', current_date)::date) / 60.0, 2) as timmar_manad,
    count(*) as pass_totalt
  from public.bookings
  where status = 'completed' and tutor_id is not null
  group by tutor_id;

alter view public.arbetade_timmar set (security_invoker = true);
grant select on public.arbetade_timmar to authenticated;


-- ============================================================
-- KLART.
--
-- Vad som fortfarande görs för hand i Table Editor:
--   · matchningen familj ↔ studiehjälpare (se schema-v3.sql)
--   · tutor_profiles.hourly_rate — sätt den innan ersättning visas
--
-- Vad som medvetet INTE finns:
--   · elevkonton. Familjen loggar in, barnen är rader i students.
--     Ska eleven kunna logga in själv är det en egen roll i
--     profiles och en koppling students.profile_id — en ändring
--     som rör auth, inte bara tabeller.
--   · lagringsbucket för material och profilbilder. Den skapas i
--     samma steg som uppladdningen byggs.
-- ============================================================
