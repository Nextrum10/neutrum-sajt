-- ============================================================
-- NEXTRUM — schema v3: gör att de inloggade vyerna faktiskt fungerar
-- Kör EFTER schema.sql och schema-v2.sql. Rensar inget, går att
-- köra om utan att något går sönder.
--
-- Varför den här filen behövs: v1 och v2 skapade tabellerna, men
-- RLS-reglerna var skrivna innan vyerna fanns. Resultatet var att
-- en förälder inte kunde läsa namnet på sin egen tilldelade lärare,
-- en lärare inte kunde se vilka elever hen fått, och ingen lärare
-- kunde markera ett pass som genomfört. Allt det fixas här.
-- ============================================================

-- ============================================================
-- 1. BOKNING KOPPLAS TILL ETT SPECIFIKT BARN
-- En förälder kan ha flera barn. Utan detta går det inte att veta
-- vilket barn ett pass gäller, och lektionsrapporten kan inte
-- kopplas till rätt elev.
-- ============================================================
alter table public.bookings
  add column if not exists student_id uuid references public.students(id) on delete set null;

-- ============================================================
-- 2. HJÄLPFUNKTIONER (SECURITY DEFINER)
-- Samma princip som is_admin() i schema.sql: en policy på "profiles"
-- som själv frågar "profiles" ger "infinite recursion detected in
-- policy". SECURITY DEFINER kör frågan med funktionsägarens
-- rättigheter och bryter kedjan. Funktionerna lämnar bara ut
-- true/false, aldrig data.
-- ============================================================

-- Är den här användaren MIN tilldelade lärare?
-- (Används av föräldern för att få läsa lärarens namn.)
create or replace function public.is_my_matched_tutor(tutor_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.matched_tutor_id = tutor_uuid
  )
$$;

-- Är det här barnet ett av mina elever (dvs. tillhör en förälder
-- som är matchad med mig)? Används för att stoppa en lärare från
-- att skriva rapporter om barn hen inte har.
create or replace function public.is_my_student(student_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.students s
    join public.profiles p on p.id = s.parent_id
    where s.id = student_uuid and p.matched_tutor_id = auth.uid()
  )
$$;

-- ============================================================
-- 3. PROFILES — vem får se vems namn
-- ============================================================

-- Föräldern får läsa sin tilldelade lärares profil. Utan denna
-- visade föräldravyn "din lärare: (okänd)" trots att matchningen
-- fanns i databasen.
drop policy if exists "förälder läser sin matchade lärares profil" on public.profiles;
create policy "förälder läser sin matchade lärares profil" on public.profiles
  for select using (public.is_my_matched_tutor(profiles.id));

-- Läraren får läsa profilerna för de föräldrar hen är matchad med.
-- Ingen hjälpfunktion behövs här: villkoret tittar på raden som
-- redan hämtas, inte på en ny fråga mot profiles, så ingen rekursion.
drop policy if exists "lärare läser sina matchade föräldrars profiler" on public.profiles;
create policy "lärare läser sina matchade föräldrars profiler" on public.profiles
  for select using (profiles.matched_tutor_id = auth.uid());

-- ============================================================
-- 4. BOOKINGS — vem får ändra ett pass
-- ============================================================

-- Läraren markerar pass som genomfört. Detta är hela grunden för
-- timrapporteringen, utan den kan tutor_hours aldrig räknas upp.
drop policy if exists "lärare uppdaterar egna bokningar" on public.bookings;
create policy "lärare uppdaterar egna bokningar" on public.bookings
  for update using (auth.uid() = tutor_id) with check (auth.uid() = tutor_id);

-- Föräldern får avboka sitt eget pass.
drop policy if exists "förälder uppdaterar egna bokningar" on public.bookings;
create policy "förälder uppdaterar egna bokningar" on public.bookings
  for update using (auth.uid() = parent_id) with check (auth.uid() = parent_id);

-- ============================================================
-- 5. LESSON_REPORTS — stäng hålet
-- v2 tillät en lärare att skriva en rapport på VILKET student_id
-- som helst, så länge tutor_id var hens eget. I praktiken svårt att
-- utnyttja (man ser inte andras student-id), men "svårt att gissa"
-- är inte samma sak som "spärrat". Nu krävs faktisk matchning.
-- ============================================================
drop policy if exists "tilldelad lärare skriver och läser rapporter" on public.lesson_reports;
drop policy if exists "lärare läser egna rapporter" on public.lesson_reports;
create policy "lärare läser egna rapporter" on public.lesson_reports
  for select using (auth.uid() = tutor_id);

drop policy if exists "lärare skriver rapport för egen elev" on public.lesson_reports;
create policy "lärare skriver rapport för egen elev" on public.lesson_reports
  for insert with check (auth.uid() = tutor_id and public.is_my_student(student_id));

drop policy if exists "lärare uppdaterar egen rapport" on public.lesson_reports;
create policy "lärare uppdaterar egen rapport" on public.lesson_reports
  for update using (auth.uid() = tutor_id) with check (auth.uid() = tutor_id);

-- ============================================================
-- 6. STUDY_PLANS — samma sak
-- ============================================================
drop policy if exists "tilldelad lärare hanterar studieplan" on public.study_plans;
drop policy if exists "lärare läser egna studieplaner" on public.study_plans;
create policy "lärare läser egna studieplaner" on public.study_plans
  for select using (auth.uid() = tutor_id);

drop policy if exists "lärare skapar studieplan för egen elev" on public.study_plans;
create policy "lärare skapar studieplan för egen elev" on public.study_plans
  for insert with check (auth.uid() = tutor_id and public.is_my_student(student_id));

drop policy if exists "lärare uppdaterar egen studieplan" on public.study_plans;
create policy "lärare uppdaterar egen studieplan" on public.study_plans
  for update using (auth.uid() = tutor_id) with check (auth.uid() = tutor_id);

-- ============================================================
-- 7. STUDENTS — läraren måste kunna se barnets uppgifter
-- v2 hade redan select-policyn, men inte raderingsskydd mot att
-- föräldern tar bort ett barn som har bokningar. on delete cascade
-- på students → bookings.student_id är satt till "set null" ovan,
-- så historiken överlever. Inget mer behövs här, kommentaren finns
-- för att du ska slippa undra.
-- ============================================================

-- ============================================================
-- KLART.
--
-- Så här matchar ni en familj manuellt (det är hela affärsmodellen,
-- så det är värt att veta exakt):
--
-- 1. Familjen skickar intresseanmälan på hemsidan → hamnar i "leads"
-- 2. Ni ringer/mejlar och väljer lärare
-- 3. Familjen skapar konto på foralder.html (roll: förälder)
-- 4. Ni går till Table Editor → profiles → familjens rad:
--       match_status     = 'matched'
--       matched_tutor_id = lärarens id (kopiera från lärarens rad)
-- 5. Föräldern lägger till sitt barn i sin vy, ELLER ni lägger in
--    raden i "students" åt dem
-- 6. Läraren skriver studieplanen i sin vy
--
-- Först efter steg 4 låses föräldravyn upp. Innan dess ser familjen
-- ett väntläge, inte en trasig sida.
-- ============================================================

-- ============================================================
-- 8. SKYDD MOT SJÄLVUPPGRADERING  ← VIKTIGT
--
-- Hittat när de inloggade vyerna byggdes. Policyn "uppdatera egen
-- profil" från schema.sql tillåter en användare att uppdatera SIN
-- EGEN rad i profiles. Det låter oskyldigt, men den säger inget om
-- VILKA KOLUMNER. Alltså kunde vem som helst med ett konto köra:
--
--     update profiles set is_admin = true where id = auth.uid();
--
-- ...och därmed läsa alla intresseanmälningar, alla meddelanden,
-- alla bokningar och alla familjers uppgifter. Samma sak med
-- match_status/matched_tutor_id: en förälder kunde matcha sig själv
-- med vilken lärare som helst och läsa dennes uppgifter. Och en
-- lärare kunde sätta status='approved' på sig själv och publicera
-- sig på startsidan utan att ni godkänt något.
--
-- RLS kan inte begränsa kolumner. Lösningen är en trigger som
-- helt enkelt vägrar ändra de känsliga fälten om den som kör inte
-- är admin. Ni ändrar dem i Table Editor som vanligt, det går via
-- service_role och påverkas inte.
-- ============================================================

create or replace function public.skydda_profilfalt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- admin och serverjobb (auth.uid() är null) får ändra fritt
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

drop trigger if exists profiles_skydda on public.profiles;
create trigger profiles_skydda
  before update on public.profiles
  for each row execute function public.skydda_profilfalt();

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
  new.status := old.status;
  new.id     := old.id;
  return new;
end $$;

drop trigger if exists tutor_profiles_skydda on public.tutor_profiles;
create trigger tutor_profiles_skydda
  before update on public.tutor_profiles
  for each row execute function public.skydda_tutorfalt();

-- ============================================================
-- 9. ADMIN SAKNADE UPDATE-RÄTT PÅ PROFILES
-- schema.sql gav admin bara SELECT på profiles, aldrig UPDATE.
-- Det betyder att matchningen (att sätta match_status och
-- matched_tutor_id) bara gick att göra via Table Editor, aldrig
-- från ett eget adminverktyg. Ni kommer vilja bygga det senare.
-- ============================================================
drop policy if exists "admin uppdaterar profiler" on public.profiles;
create policy "admin uppdaterar profiler" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());
