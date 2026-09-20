-- ============================================================
-- NEXTRUM — Fas 9.4: när matchningen och avbokningen skedde
--
-- Fas 9 ska kunna svara på "hur lång tid tar det från anmälan till
-- matchning" och "hur många pass avbokades i mars". Ingen av de
-- frågorna går att besvara i dag, och det värsta svaret vore ett
-- ungefärligt:
--
--   · students bär matched_tutor_id men ingen tidpunkt. Tiden till
--     matchning gick bara att gissa ur created_at, alltså ur när
--     barnet lades in — inte ur när det matchades.
--   · ett avbokat pass bär bara status='cancelled'. En vy över
--     "avbokningar per månad" hade fått använda wanted_date, alltså
--     månaden passet SKULLE ha hållits. Ett pass i maj som avbokas i
--     mars hade räknats som en avbokning i maj.
--
-- SÄTTS AV DATABASEN, INTE AV KLIENTEN. En tidpunkt som klienten
-- skickar med är en tidpunkt klienten kan ha fel om — och avbokad_av
-- vore direkt osann om den gick att välja.
--
-- F-6 RÖRS INTE. skydda_bokningsfalt har en vitlista `fria` över vad
-- den som inte är admin får ändra på ett bokat pass, och de tre nya
-- fälten står inte i den. Stämpeltriggern namnges så att den kör
-- EFTER skyddet (BEFORE-triggrar kör i bokstavsordning, och
-- "bookings_stampla_..." kommer efter "bookings_skydda_..."), så att
-- skyddets jämförelse hinner ske innan stämpeln sätts.
--
-- Därför kan familjen och studiehjälparen inte heller välja SKÄL:
-- att släppa in avbokningsskal i `fria` hade varit att vidga F-6:s
-- vitlista, och det gör den här fasen inte. Skälet sätts av admin i
-- adminvyn, som en fast kod. Avvikelse mot spaningen, som antog att
-- den som avbokar väljer skäl.
--
-- INGEN BAKFYLLNAD. De elever som redan är matchade får matchad_at
-- null. En påhittad tidpunkt är sämre än ingen: den räknas med i
-- medelvärdet utan att någon ser att den är gissad.
-- ============================================================

alter table public.students
  add column if not exists matchad_at timestamptz;

comment on column public.students.matchad_at is
  'När eleven matchades FÖRSTA gången. Sätts av students_stampla_matchning. '
  'Null för elever matchade före Fas 9 — det är okänt, inte noll.';

alter table public.bookings
  add column if not exists avbokad_at   timestamptz,
  add column if not exists avbokad_av   uuid references public.profiles(id) on delete set null,
  add column if not exists avbokningsskal text;

alter table public.bookings
  drop constraint if exists bookings_avbokningsskal_check;
alter table public.bookings
  add constraint bookings_avbokningsskal_check check (
    avbokningsskal is null or avbokningsskal in (
      'sjukdom', 'forhinder', 'ombokat',
      'ingen_hjalpare', 'familjen_avslutar', 'annat'));

comment on column public.bookings.avbokad_at is
  'När passet avbokades — inte när det skulle ha hållits.';
comment on column public.bookings.avbokad_av is
  'Vem som avbokade. Jämför med parent_id och tutor_id för att se vilken sida.';
comment on column public.bookings.avbokningsskal is
  'Fast kod, satt av admin i efterhand. Aldrig fritext: skälet hamnar i auditloggen.';

-- ---------- stämplarna ----------

create or replace function public.stampla_matchningen()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Bara första matchningen. En ommatchning byter hjälpare, men
  -- frågan "hur lång tid tog det innan familjen fick någon" har bara
  -- ett svar.
  if new.matched_tutor_id is not null and new.matchad_at is null then
    new.matchad_at := now();
  end if;
  return new;
end $$;

revoke execute on function public.stampla_matchningen() from public, anon, authenticated;

drop trigger if exists students_stampla_matchning on public.students;
create trigger students_stampla_matchning
  before insert or update of matched_tutor_id on public.students
  for each row execute function public.stampla_matchningen();

create or replace function public.stampla_avbokningen()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    new.avbokad_at := now();
    new.avbokad_av := auth.uid();   -- null när fakturering eller ett schema avbokar
  end if;
  return new;
end $$;

revoke execute on function public.stampla_avbokningen() from public, anon, authenticated;

-- Namnet är inte kosmetik: BEFORE-triggrar kör i bokstavsordning, och
-- "stampla" måste komma efter "skydda" för att F-6:s jämförelse ska
-- se ett oförändrat fält.
drop trigger if exists bookings_stampla_avbokning on public.bookings;
create trigger bookings_stampla_avbokning
  before update of status on public.bookings
  for each row execute function public.stampla_avbokningen();

-- ---------- auditen känner till de nya fälten ----------
-- Alla tre är tillstånd eller kopplingar, inget av dem är fritext.

drop trigger if exists students_audit on public.students;
create trigger students_audit
  after update of matched_tutor_id, match_status on public.students
  for each row execute function public.logga_andring(
    'matchning', 'id', 'parent_id', 'matched_tutor_id', 'match_status',
    'uppdrag_id', 'matchad_at');

drop trigger if exists bookings_audit on public.bookings;
create trigger bookings_audit
  after insert or update of status, attendance, fakturerbar, wanted_date,
                            wanted_time, avbokningsskal
  on public.bookings
  for each row execute function public.logga_andring(
    'pass', 'id', 'status', 'attendance', 'fakturerbar', 'wanted_date', 'wanted_time',
    'parent_id', 'tutor_id', 'student_id', 'uppdrag_id',
    'avbokad_at', 'avbokad_av', 'avbokningsskal');
