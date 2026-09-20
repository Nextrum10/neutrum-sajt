-- ============================================================
-- NEXTRUM — Fas 10.3: oraklet flyttar ut ur det exponerade schemat
--
-- tjanstkoder_finns() svarar "ja" på frågan om en kod finns i
-- katalogen. Den har EXECUTE åt PUBLIC och ligger i `public`, alltså
-- det schema PostgREST exponerar — vem som helst kunde POSTa mot
-- /rest/v1/rpc/tjanstkoder_finns med ['barnvakt'] och få koden
-- bekräftad utan att läsa en enda rad ur tabellen. Fas 1.6 stängde
-- tabellen men lämnade funktionen, med noteringen att den "används
-- när ansökningsformuläret sparar".
--
-- FÖRSTA FÖRSÖKET VAR FEL, OCH PROVET FÄLLDE DET.
-- En enkel `revoke execute ... from public` slog sönder HELA
-- ansökningsvägen: `permission denied for function tjanstkoder_finns`
-- så fort någon skrev en rad i applications. CHECK-villkor körs som
-- ANROPAREN, inte som tabellägaren — tvärtemot vad jag antog. Utan
-- ett rullat prov hade det gått till drift och tystat
-- rekryteringsformuläret. Grantet återställdes omedelbart.
--
-- DEN RIKTIGA LAGNINGEN är den som Supabase-advisorn själv föreslår:
-- flytta funktionen ut ur det exponerade schemat. Då finns ingen
-- RPC-väg fram till den, samtidigt som villkoren kan anropa den precis
-- som förut. Ingen klientfil och ingen edge-funktion anropar den —
-- kontrollerat med grep över hela repot.
--
-- Schemat heter `intern` och är till för just detta: funktioner som
-- måste finnas för databasens egen skull men som inte är ett API.
-- USAGE ges åt anon och authenticated, för villkoren prövas i deras
-- sessioner. Det är EN funktion som svarar ja eller nej om en kod
-- finns — den går inte att nå utifrån, och den lämnar inte ut något
-- ens om den gjorde det.
-- ============================================================

create schema if not exists intern;

comment on schema intern is
  'Funktioner databasen behöver för sin egen skull och som INTE är ett API. '
  'Schemat är med flit inte exponerat i PostgREST. Lägg inget här som ett '
  'gränssnitt ska anropa — det hör hemma i public.';

grant usage on schema intern to anon, authenticated, service_role;

-- Kroppen är ordagrant den som låg i public, läst med
-- pg_get_functiondef före flytten. Bara schemanamnet är nytt.
create or replace function intern.tjanstkoder_finns(koder text[])
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select koder is null
      or not exists (
        select 1 from unnest(koder) k
        where k not in (select kod from public.tjanster)
      );
$function$;

comment on function intern.tjanstkoder_finns(text[]) is
  'Backar CHECK-villkoren på applications.tjanster och tutor_profiles.tjanster. '
  'Låg i public till Fas 10.3 och var då nåbar som RPC, alltså ett orakel som '
  'bekräftade olanserade tjänstekoder åt vem som helst.';

-- Villkoren pekas om. De måste bytas ut, inte ändras: ett CHECK-villkor
-- bär funktionsreferensen i sitt uttryck.
alter table public.applications drop constraint if exists applications_tjanster_check;
alter table public.applications
  add constraint applications_tjanster_check check (intern.tjanstkoder_finns(tjanster));

alter table public.tutor_profiles drop constraint if exists tutor_profiles_tjanster_check;
alter table public.tutor_profiles
  add constraint tutor_profiles_tjanster_check check (intern.tjanstkoder_finns(tjanster));

-- Först när ingenting pekar på den längre.
drop function if exists public.tjanstkoder_finns(text[]);
