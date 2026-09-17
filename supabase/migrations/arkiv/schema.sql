-- ============================================================
-- NEXTRUM — databasschema för Supabase (Postgres)
-- Klistra in HELA denna fil i Supabase → SQL Editor → Run.
-- Säkert att köra om (DROP-satser längst upp) om du vill börja om.
-- ============================================================

-- ---------- rensa (valfritt, bra vid ombyggnad) ----------
drop table if exists public.bookings cascade;
drop table if exists public.applications cascade;
drop table if exists public.contact_messages cascade;
drop table if exists public.tutor_profiles cascade;
drop table if exists public.profiles cascade;

-- ============================================================
-- PROFILES — en rad per inloggad användare (förälder/elev, läxhjälpare, admin)
-- Skapas automatiskt av triggern längst ner när någon registrerar sig.
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('parent','tutor','admin')),
  full_name text not null,
  email text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ---------- hjälpfunktion: är denna användare admin? ----------
-- En policy på "profiles" som frågar "profiles" för att kolla
-- is_admin skulle trigga sina egna RLS-regler igen, om igen, för
-- alltid ("infinite recursion detected in policy for relation
-- profiles"). Testat och bekräftat mot en riktig databas. Lösningen
-- är detta väldokumenterade Supabase-mönster: en SECURITY DEFINER-
-- funktion. Den kör med funktionens ägares rättigheter (postgres,
-- om du kör detta i SQL Editor), vilket kringgår RLS på just den
-- interna frågan. Funktionen läcker ingenting, den svarar bara
-- true/false.
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = uid), false)
$$;

create policy "läs egen profil" on public.profiles
  for select using (auth.uid() = id);

create policy "admin läser alla profiler" on public.profiles
  for select using (public.is_admin());

create policy "uppdatera egen profil" on public.profiles
  for update using (auth.uid() = id);

-- ============================================================
-- TUTOR_PROFILES — läxhjälparens ansökningsuppgifter + godkännandestatus
-- status: 'pending' tills du manuellt godkänner i Table Editor, efter
-- bakgrundskontroll. Endast 'approved' visas publikt på sidan.
-- ============================================================
create table public.tutor_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  age int,
  school text,
  subjects text[] not null default '{}',
  grade_levels text[] not null default '{}',
  formats text[] not null default '{}',
  availability text,
  city text,
  bio text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

alter table public.tutor_profiles enable row level security;

create policy "alla kan läsa godkända profiler" on public.tutor_profiles
  for select using (status = 'approved');

create policy "läxhjälpare läser egen profil oavsett status" on public.tutor_profiles
  for select using (auth.uid() = id);

create policy "läxhjälpare uppdaterar egen profil" on public.tutor_profiles
  for update using (auth.uid() = id);

create policy "admin fullständig åtkomst" on public.tutor_profiles
  for all using (public.is_admin());

-- ============================================================
-- APPLICATIONS — rå ansökningsdata från "Bli studiehjälpare"-formuläret,
-- innan personen ens skapat konto. Du granskar i Table Editor och
-- kontaktar den som ska bli godkänd.
-- ============================================================
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age int,
  email text not null,
  school text,
  subjects text,
  availability text,
  why text,
  status text not null default 'new' check (status in ('new','contacted','approved','rejected')),
  created_at timestamptz not null default now()
);

alter table public.applications enable row level security;

create policy "vem som helst kan skicka en ansökan" on public.applications
  for insert with check (true);

create policy "endast admin läser ansökningar" on public.applications
  for select using (public.is_admin());

-- ============================================================
-- CONTACT_MESSAGES — kontaktformuläret längst ner på sidan
-- ============================================================
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  role text,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

create policy "vem som helst kan skicka meddelande" on public.contact_messages
  for insert with check (true);

create policy "endast admin läser meddelanden" on public.contact_messages
  for select using (public.is_admin());

-- ============================================================
-- BOOKINGS — bokningsförfrågningar. Betalning är fortfarande inte
-- kopplad (nästa steg, kräver Stripe), men dubbelbokning stoppas
-- av det unika indexet längre ner i denna sektion.
-- ============================================================
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  tutor_id uuid references public.profiles(id) on delete set null,
  subject text,
  grade_level text,
  format text,
  wanted_date date,
  wanted_time text,
  status text not null default 'requested' check (status in ('requested','confirmed','cancelled','completed')),
  created_at timestamptz not null default now()
);

alter table public.bookings enable row level security;

create policy "förälder ser egna bokningar" on public.bookings
  for select using (auth.uid() = parent_id);

create policy "läxhjälpare ser egna bokningar" on public.bookings
  for select using (auth.uid() = tutor_id);

create policy "förälder skapar bokning" on public.bookings
  for insert with check (auth.uid() = parent_id);

create policy "admin fullständig åtkomst bokningar" on public.bookings
  for all using (public.is_admin());

-- ---------- kollisionsskydd ----------
-- Två aktiva bokningar (requested/confirmed) kan inte dela tutor_id +
-- datum + tid. Detta är den enda garanten som håller även om två
-- föräldrar klickar "slutför bokning" samtidigt, frontend kan bara
-- försöka undvika det i förväg, inte garantera det. Ett insert som
-- krockar avvisas av databasen med felkod 23505, vilket sidan redan
-- fångar upp och visar som "tiden är redan bokad".
create unique index if not exists bookings_tutor_slot_unique
  on public.bookings (tutor_id, wanted_date, wanted_time)
  where status in ('requested','confirmed');

-- ---------- publik vy över upptagna tider ----------
-- Så att bokningsflödet kan gråa ut redan tagna tider INNAN någon
-- försöker boka, utan att exponera vem som bokat eller vilket ämne.
-- Vyn kringgår RLS på bookings med flit (det är hela poängen), den
-- lämnar bara ut tutor_id + datum + tid, inget personligt.
create or replace view public.tutor_busy_slots as
  select tutor_id, wanted_date, wanted_time
  from public.bookings
  where status in ('requested','confirmed');

grant select on public.tutor_busy_slots to anon, authenticated;

-- ============================================================
-- TRIGGER — skapar automatiskt en profiles-rad när någon registrerar
-- sig via auth.signUp(). role och full_name skickas med som metadata
-- från frontend (se app.js).
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'parent'),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  );

  if coalesce(new.raw_user_meta_data->>'role', 'parent') = 'tutor' then
    insert into public.tutor_profiles (id) values (new.id);
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- INGEN SEED-DATA HÄR, MEDVETET.
-- Ett tidigare utkast av den här filen försökte skapa två
-- demoprofiler (Emma/Oscar) direkt i public.profiles. Det går inte:
-- profiles.id har en foreign key mot auth.users(id), och det finns
-- ingen riktig inloggning bakom påhittade id:n, så inserten skulle
-- krascha med "violates foreign key constraint" när du kör filen.
-- Testat och bekräftat mot en riktig Postgres-databas.
--
-- Matchningssektionen på sidan visar därför ärligt "inga
-- studiehjälpare än" tills den första riktiga registrerar sig och
-- du godkänner dem, se steg nedan. Det är samma princip som resten
-- av det här projektet: hellre en tom lista än påhittade personer.
--
-- KLART. Gå till Table Editor och sätt is_admin = true på din egen
-- rad i "profiles" efter att du registrerat ditt eget konto på sidan
-- — det gör dig till admin utan att skriva någon kod. Godkänn en
-- läxhjälpare genom att sätta status='approved' på deras rad i
-- tutor_profiles efter att de registrerat sig med rollen läxhjälpare.
-- ============================================================
