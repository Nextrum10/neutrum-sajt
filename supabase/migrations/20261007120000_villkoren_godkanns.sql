-- ============================================================
-- NEXTRUM — villkoren godkänns (2026-10-07)
--
-- Leo: "Fixa den gamla luckan". Ingen godkände användarvillkoren när
-- kontot skapades, varken den som registrerade sig själv eller den vi
-- tog in med bjud-in. Villkoren stod på sajten, men ingenting visade att
-- någon sagt ja till dem, och en familj som aldrig fått frågan har inte
-- ingått avtalet på det sätt villkoren beskriver.
--
-- Nu sparas ett godkännande per konto och version, och databasen sätter
-- tiden och versionen, aldrig anropet:
--
--   · registreringen: kryssrutan skickar villkor: true i user_metadata,
--     och triggern på auth.users skriver raden när kontot skapas;
--   · alla andra (kontot vi skapat, den som registrerade sig före i dag,
--     och alla när villkoren ändras) får en ruta vid inloggningen som
--     inte går att stänga, och godkann_villkor() skriver raden.
--
-- Och det krävs, i databasen och inte bara i vyn: ett pass föreslås och
-- bekräftas, och timmar köps, bara av den som godkänt den gällande
-- versionen. Avbokningar, betalningar av redan bokade pass och allt
-- databasen gör själv stoppas aldrig, och admin går förbi.
--
-- Filen har ingen drop och ingen delete, så den går att köra avsnitt för
-- avsnitt utan bekräftelser, eller hel (minne/databasen.md).
-- ============================================================


-- ------------------------------------------------------------
-- 1. Versionen
--
-- Datumet som står sist i anvandarvillkor.html ("Senast uppdaterad 30
-- september 2026"). verktyg/kolla-villkor.py håller sidan och den här
-- funktionen lika: ändras villkoren skrivs en ny migration som byter
-- datumet här, och alla får frågan igen vid nästa inloggning.
-- ------------------------------------------------------------
create or replace function intern.villkor_version()
returns text
language sql
immutable
set search_path = pg_temp
as $$ select '2026-09-30'::text $$;

comment on function intern.villkor_version() is
  'Den gällande versionen av användarvillkoren: datumet sist i anvandarvillkor.html. Ändras med villkoren '
  '(verktyg/kolla-villkor.py), och då får alla frågan igen.';

-- mitt_villkorslage() läser den som anroparen.
revoke all on function intern.villkor_version() from public, anon;
grant execute on function intern.villkor_version() to authenticated;


-- ------------------------------------------------------------
-- 2. Godkännandena
-- ------------------------------------------------------------
create table if not exists public.villkor_godkannanden (
  anvandare  uuid not null references auth.users (id) on delete cascade,
  version    text not null check (version ~ '^\d{4}-\d{2}-\d{2}$'),
  godkant_at timestamptz not null default now(),
  kalla      text not null check (kalla in ('registrering', 'inloggning')),
  primary key (anvandare, version)
);

comment on table public.villkor_godkannanden is
  'Vem som godkänt vilken version av användarvillkoren, och när (2026-10-07). Skrivs bara av triggern på '
  'auth.users (registreringen) och av godkann_villkor(); tiden och versionen sätts av databasen.';
comment on column public.villkor_godkannanden.kalla is
  'registrering: kryssrutan när kontot skapades. inloggning: rutan i vyn, för ett konto vi skapat, ett äldre '
  'konto eller nya villkor.';

alter table public.villkor_godkannanden enable row level security;

-- Supabase ger anon och authenticated rättigheter på varje ny tabell.
-- Ingen inloggad skriver här, och anon ska inte ens kunna läsa.
revoke all on public.villkor_godkannanden from anon;
revoke insert, update, delete, truncate, references, trigger on public.villkor_godkannanden from authenticated;

-- Den som läser personer i adminvyn ser också om de godkänt villkoren:
-- samma lista som policyn på profiles, så att panelen aldrig säger "inte
-- godkänt" för att policyn nekade.
do $$
begin
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'villkor_godkannanden'
                    and policyname = 'kontot läser sina godkännanden') then
    create policy "kontot läser sina godkännanden" on public.villkor_godkannanden
      for select to authenticated
      using (anvandare = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'villkor_godkannanden'
                    and policyname = 'behörighet läser godkännandena') then
    create policy "behörighet läser godkännandena" on public.villkor_godkannanden
      for select to authenticated
      using (public.har_nagon_behorighet(array['anvandare_las', 'anvandare_redigera', 'matchning',
               'studiehjalpare_godkann', 'bokningar_las', 'rapporter_las', 'admin_hantera']));
  end if;
end $$;


-- ------------------------------------------------------------
-- 3. Har kontot godkänt den gällande versionen?
--
-- Svarar om en PERSON, så den nås inte utifrån: triggrarna nedan frågar
-- den, och de körs som ägaren.
-- ------------------------------------------------------------
create or replace function intern.villkoren_godkanda(p_anvandare uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.villkor_godkannanden g
                  where g.anvandare = p_anvandare and g.version = intern.villkor_version())
$$;

revoke all on function intern.villkoren_godkanda(uuid) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 4. Registreringen
--
-- Kryssrutan i Skapa konto (studievyn och studiehjälparvyn) skickar
-- villkor: true i user_metadata. Raden skrivs när kontot skapas, med den
-- version som gäller då, för det är den sidan länken i kryssrutan visar.
-- user_metadata skriver personen själv, men det enda den kan åstadkomma
-- här är sitt eget godkännande. Ett barnkonto får ingen rad: barnet är
-- ingen avtalspart (villkoren, Konto), och handle_new_user ger det ingen
-- profil av samma skäl. Ett konto vi skapar (bjud-in) har ingen kryssruta
-- och får frågan vid första inloggningen.
-- ------------------------------------------------------------
create or replace function intern.villkor_vid_registrering()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'villkor', '') = 'true'
     and coalesce(new.raw_app_meta_data ->> 'roll', '') <> 'barn' then
    insert into public.villkor_godkannanden (anvandare, version, kalla)
    values (new.id, intern.villkor_version(), 'registrering')
    on conflict (anvandare, version) do nothing;
  end if;
  return null;
end $$;

revoke all on function intern.villkor_vid_registrering() from public, anon, authenticated;

create or replace trigger auth_villkor_vid_registrering
  after insert on auth.users
  for each row execute function intern.villkor_vid_registrering();


-- ------------------------------------------------------------
-- 5. Vyernas två anrop
--
-- mitt_villkorslage() säger om rutan ska visas: den gällande versionen,
-- när kontot godkände den (null om inte), och om kontot godkänt en äldre
-- (då säger rutan att villkoren ändrats). Den läser som anroparen,
-- genom policyn ovan.
-- ------------------------------------------------------------
create or replace function public.mitt_villkorslage()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'version', intern.villkor_version(),
    'godkant_at', (select g.godkant_at from public.villkor_godkannanden g
                    where g.anvandare = (select auth.uid()) and g.version = intern.villkor_version()),
    'tidigare', exists (select 1 from public.villkor_godkannanden g
                         where g.anvandare = (select auth.uid()) and g.version <> intern.villkor_version()))
$$;

-- godkann_villkor() skriver raden för den inloggade, med databasens tid.
-- Versionen skickas med och prövas: har villkoren ändrats medan rutan
-- stod öppen ska ingen godkänna en version hen inte sett.
create or replace function public.godkann_villkor(p_version text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  vem uuid := auth.uid();
begin
  if vem is null then
    raise exception 'Logga in för att godkänna villkoren.' using errcode = '42501';
  end if;
  -- En vuxen med konto: ett barn har ingen profil, och barnkontots token
  -- bär rollen i app_metadata, som bara service_role skriver.
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'roll', '') = 'barn'
     or not exists (select 1 from public.profiles p where p.id = vem) then
    raise exception 'Villkoren godkänns av en vuxen med eget konto.' using errcode = '42501';
  end if;
  if p_version is distinct from intern.villkor_version() then
    raise exception 'Villkoren har ändrats sedan sidan laddades. Ladda om sidan och läs dem igen.'
      using errcode = '22023';
  end if;

  insert into public.villkor_godkannanden (anvandare, version, kalla)
  values (vem, p_version, 'inloggning')
  on conflict (anvandare, version) do nothing;

  return public.mitt_villkorslage();
end $$;

revoke execute on function public.mitt_villkorslage() from public, anon;
revoke execute on function public.godkann_villkor(text) from public, anon;
grant execute on function public.mitt_villkorslage() to authenticated;
grant execute on function public.godkann_villkor(text) to authenticated;


-- ------------------------------------------------------------
-- 6. Spärren: bokningen
--
-- Den som föreslår ett pass, och den som bekräftar en tid, ska ha
-- godkänt den gällande versionen: det är då avtalet om passet ingås.
-- Prövningen gäller den inloggade, familjen eller studiehjälparen, och
-- bara när ett pass skapas eller blir bekräftat. En avbokning, ett
-- betalt pass och en rapport stoppas aldrig, för en familj ska alltid
-- kunna lämna, också den som inte godkänt nya villkor.
--
-- Databasens egna vägar (jobben, webhooken, service_role) har ingen
-- inloggad, och admin bokar åt familjen: de går förbi.
--
-- Felet bär en mening, för vyerna visar databasens text (NX.felText),
-- och ledtråden villkor, så att en vy kan känna igen det.
--
-- Namnet sorterar före bookings_timmarna_tillbaka, som ska vara den
-- sista before-triggern (CLAUDE.md, avsnitt 1). Den ändrar ingenting i
-- raden, och ett nej rullar tillbaka det triggrarna före gjort.
-- ------------------------------------------------------------
create or replace function intern.pass_kraver_villkor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  vem uuid := auth.uid();
begin
  if vem is null or public.is_admin() then
    return new;
  end if;
  if tg_op = 'UPDATE' and not (new.status = 'confirmed' and old.status is distinct from 'confirmed') then
    return new;
  end if;
  if (vem = new.parent_id or vem = new.tutor_id) and not intern.villkoren_godkanda(vem) then
    raise exception 'Godkänn användarvillkoren först. Ladda om sidan, så kommer frågan.'
      using errcode = 'P0001', hint = 'villkor';
  end if;
  return new;
end $$;

revoke all on function intern.pass_kraver_villkor() from public, anon, authenticated;

create or replace trigger bookings_kraver_villkor
  before insert or update on public.bookings
  for each row execute function intern.pass_kraver_villkor();


-- ------------------------------------------------------------
-- 7. Spärren: köpet av timmar
--
-- Kassan (stripe-checkout) skriver köpet i klippkort med service_role, så
-- det är familjen på raden som prövas, inte den som skriver. Ingen annan
-- väg skapar ett köp.
-- ------------------------------------------------------------
create or replace function intern.kop_kraver_villkor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not intern.villkoren_godkanda(new.parent_id) then
    raise exception 'Godkänn användarvillkoren först. Ladda om sidan, så kommer frågan.'
      using errcode = 'P0001', hint = 'villkor';
  end if;
  return new;
end $$;

revoke all on function intern.kop_kraver_villkor() from public, anon, authenticated;

create or replace trigger klippkort_kraver_villkor
  before insert on public.klippkort
  for each row execute function intern.kop_kraver_villkor();
