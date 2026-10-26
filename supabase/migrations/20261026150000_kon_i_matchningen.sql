-- ============================================================
-- NEXTRUM — studiehjälparen väljer om hen hjälper elever av
-- båda könen (2026-10-26)
--
-- Leo: "studiehjälparen ska lägga in om de vill bara hjälpa elever
-- av samma kön eller motsatta, alla profiler klickar in vilket kön
-- de är, man eller kvinna, eller pojke eller flicka. vill
-- studiehjälparen inte hjälpa motsatta könet syns då inte den
-- studiehjälparen i matchning."
--
-- Tre saker:
--   1. Eleven har ett kön (students.kon), som föräldern anger i
--      studievyn och admin i Ta in familjen och i elevens panel.
--   2. Studiehjälparen anger sitt kön och om hen bara vill hjälpa
--      elever av samma kön, i sin profil (matchningsval).
--   3. Matchningen visar inte en studiehjälpare som bara vill hjälpa
--      sitt eget kön för en elev av ett annat, eller vars kön inte är
--      angivet (matchningsforslag_rader), och databasen nekar en ny
--      sådan matchning, oavsett vem som försöker (students_vakt_kon).
--
-- FÖRÄLDERNS KÖN SPARAS INTE. Leo skrev "alla profiler", men
-- matchningen frågar bara om elevens kön och studiehjälparens, och en
-- uppgift utan ändamål ska inte samlas in (artikel 5.1 c).
--
-- TVÅ KODER FÖR ALLA: kvinna och man. Vyn säger flicka och pojke om en
-- elev; databasen jämför lika med lika. Fältet får stå tomt, och tomt
-- är inget svar: en studiehjälpare som bara vill hjälpa sitt eget kön
-- föreslås då inte, för vi vet inte att eleven är det.
--
-- STUDIEHJÄLPARENS VAL STÅR I EN EGEN TABELL, INTE PÅ tutor_profiles.
-- Familjen läser sin studiehjälpares rad i tutor_profiles (policyn
-- "familj läser matchad studiehjälpare"), och RLS begränsar inte
-- kolumner. Valet är inget familjen behöver, och det kan läsas som
-- något mer än det är. matchningsval läser bara studiehjälparen själv
-- och vi.
--
-- EN MATCHNING SOM REDAN FINNS RIVS INTE. Slår studiehjälparen på
-- valet, eller rättar föräldern barnets kön, när en sådan matchning
-- redan står, blir det en uppgift till oss (skapa_uppgift), och vi
-- byter studiehjälpare. Passen avbokas inte av en kryssruta.
--
-- Ingen sats i filen river något: villkor, policyer och triggrar
-- skapas efter en kontroll, och matchningsforslag_rader lappas med
-- replace() och en vakt (minne/databasen.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Elevens kön
-- ------------------------------------------------------------
alter table public.students
  add column if not exists kon text;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'students_kon_koder'
                    and conrelid = 'public.students'::regclass) then
    alter table public.students
      add constraint students_kon_koder check (kon is null or kon in ('kvinna', 'man'));
  end if;
end $$;

comment on column public.students.kon is
  'Elevens kön för matchningen: kvinna eller man (vyn säger flicka eller pojke), eller null när det inte '
  'angetts. Föräldern och admin skriver det. Töms när eleven avidentifieras (students_vakt_kon).';


-- ------------------------------------------------------------
-- 2. Studiehjälparens val
-- ------------------------------------------------------------
create table if not exists public.matchningsval (
  tutor_id       uuid primary key references public.tutor_profiles(id) on delete cascade,
  kon            text,
  bara_samma_kon boolean not null default false,
  andrad_at      timestamptz not null default now(),
  constraint matchningsval_kon_koder check (kon is null or kon in ('kvinna', 'man')),
  -- Utan ett eget kön finns inget "samma".
  constraint matchningsval_samma_kon_kraver_kon check (not bara_samma_kon or kon is not null)
);

comment on table public.matchningsval is
  'Studiehjälparens val för matchningen (kon_i_matchningen, 2026-10-26): sitt kön och om hen bara vill hjälpa '
  'elever av samma kön. Studiehjälparen och vi läser det, aldrig familjen. Raderas med kontot och när det '
  'avidentifieras (profiles_matchningsval_raderas).';
comment on column public.matchningsval.bara_samma_kon is
  'Sant: matchningen visar inte studiehjälparen för en elev av ett annat kön eller utan angivet kön, och '
  'databasen nekar en ny sådan matchning (students_vakt_kon).';

alter table public.matchningsval enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'matchningsval'
                  and policyname = 'studiehjälparen läser sitt val') then
    create policy "studiehjälparen läser sitt val" on public.matchningsval for select to authenticated
      using (tutor_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'matchningsval'
                  and policyname = 'studiehjälparen skriver sitt val') then
    create policy "studiehjälparen skriver sitt val" on public.matchningsval for insert to authenticated
      with check (tutor_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'matchningsval'
                  and policyname = 'studiehjälparen ändrar sitt val') then
    create policy "studiehjälparen ändrar sitt val" on public.matchningsval for update to authenticated
      using (tutor_id = (select auth.uid())) with check (tutor_id = (select auth.uid()));
  end if;
  -- Superadmin kan sätta valet åt studiehjälparen, när hen bett om det.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'matchningsval'
                  and policyname = 'admin hanterar matchningsvalen') then
    create policy "admin hanterar matchningsvalen" on public.matchningsval for all to authenticated
      using ((select public.is_admin())) with check ((select public.is_admin()));
  end if;
  -- Den som matchar eller läser studiehjälparna ser valet, som
  -- tutor_profiles. matchningsunderlag läser det med deras rättigheter.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'matchningsval'
                  and policyname = 'behörighet läser matchningsvalen') then
    create policy "behörighet läser matchningsvalen" on public.matchningsval for select to authenticated
      using ((select public.har_nagon_behorighet(array['anvandare_las', 'anvandare_redigera', 'matchning',
                                                       'studiehjalpare_godkann'])));
  end if;
end $$;

-- Tiden sätts av databasen, inte av vyn.
create or replace function intern.matchningsval_andrad()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.andrad_at := now();
  return new;
end $$;
revoke all on function intern.matchningsval_andrad() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger
                  where tgname = 'matchningsval_andrad'
                    and tgrelid = 'public.matchningsval'::regclass and not tgisinternal) then
    create trigger matchningsval_andrad
      before insert or update on public.matchningsval
      for each row execute function intern.matchningsval_andrad();
  end if;
end $$;


-- ------------------------------------------------------------
-- 3. Matchningen
-- ------------------------------------------------------------
-- Underlaget får kolumnerna sist: create or replace view kan bara
-- lägga till. Vyn läser med den inloggades rättigheter
-- (security_invoker), och policyerna ovan släpper in samma admins som
-- ser studiehjälparna.
create or replace view public.matchningsunderlag
with (security_invoker = true) as
 SELECT t.id AS tutor_id,
    p.full_name AS namn,
    p.email,
    t.city AS ort,
    t.subjects AS amnen,
    t.grade_levels AS arskurser,
    t.formats AS format,
    t.hourly_rate AS timpris,
    t.bio,
    ( SELECT count(*) AS count
           FROM public.students s
          WHERE s.matched_tutor_id = t.id AND s.match_status = 'matched'::text) AS antal_elever,
    ( SELECT count(*) AS count
           FROM public.bookings b
          WHERE b.tutor_id = t.id AND b.status = 'completed'::text) AS genomforda_pass,
    ( SELECT array_agg(DISTINCT a.weekday ORDER BY a.weekday) AS array_agg
           FROM public.tutor_availability a
          WHERE a.tutor_id = t.id) AS veckodagar,
    t.styrkor,
    v.kon,
    COALESCE(v.bara_samma_kon, false) AS bara_samma_kon
   FROM public.tutor_profiles t
     JOIN public.profiles p ON p.id = t.id
     LEFT JOIN public.matchningsval v ON v.tutor_id = t.id
  WHERE t.status = 'approved'::text;

-- Förslagen: en studiehjälpare som bara vill hjälpa sitt eget kön står
-- inte med för en elev av ett annat eller utan angivet kön. Elevens
-- nuvarande studiehjälpare står alltid med: adminvyn ska kunna visa
-- hur den matchningen ligger till, också när den krockar med valet.
-- Lappas med replace() och en vakt, som behov_i_matchningen lappade
-- skydda_tutorfalt: en annan session kan ha ändrat funktionen.
do $lapp$
declare
  forut text := pg_get_functiondef('public.matchningsforslag_rader(uuid)'::regprocedure);
  sedan text;
  n     int;
  gammal1 constant text := 'select s.id, s.subjects, s.grade, s.behov, u.tjanst';
  ny1     constant text := 'select s.id, s.subjects, s.grade, s.behov, s.kon, s.matched_tutor_id, u.tjanst';
  gammal2 constant text := E'      from public.matchningsunderlag m\n  )';
  ny2     constant text := E'      from public.matchningsunderlag m\n'
    || E'     -- kon_i_matchningen: studiehjälparens val, utom för den nuvarande.\n'
    || E'     where not (m.bara_samma_kon and m.kon is distinct from elev.kon)\n'
    || E'        or m.tutor_id = elev.matched_tutor_id\n  )';
begin
  if position('kon_i_matchningen' in forut) > 0 then
    return;
  end if;
  n := (length(forut) - length(replace(forut, gammal1, ''))) / length(gammal1);
  if n <> 1 then
    raise exception 'matchningsforslag_rader har % rader "%", väntat en', n, gammal1;
  end if;
  n := (length(forut) - length(replace(forut, gammal2, ''))) / length(gammal2);
  if n <> 1 then
    raise exception 'matchningsforslag_rader har % rader "%", väntat en', n, gammal2;
  end if;
  sedan := replace(replace(forut, gammal1, ny1), gammal2, ny2);
  execute sedan;
end
$lapp$;

-- Vakten: ingen ny matchning mot studiehjälparens val, vem som än
-- försöker (adminvyn, en behörighet, ett godkänt AI-förslag). Bara en
-- NY studiehjälpare prövas: en matchning som redan står rivs inte här,
-- den blir en uppgift (nedan). Och när eleven avidentifieras töms
-- könet, i samma trigger, för den ser raderingen (elev_rensa sätter
-- raderad_at).
--
-- Namnet börjar med v, så att den går sist av BEFORE-triggrarna på
-- students (namnordning): skydda_studentfalt har då redan skrivit
-- tillbaka det en förälder inte får ändra, och vakten ser det som
-- faktiskt sparas.
create or replace function intern.elevens_kon()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  val record;
begin
  if tg_op = 'UPDATE' and new.raderad_at is not null and old.raderad_at is null then
    new.kon := null;
  end if;

  if new.matched_tutor_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.matched_tutor_id is not distinct from old.matched_tutor_id then
    return new;
  end if;

  select v.kon, v.bara_samma_kon into val
    from public.matchningsval v
   where v.tutor_id = new.matched_tutor_id;
  if found and val.bara_samma_kon and val.kon is distinct from new.kon then
    raise exception using errcode = '23514',
      message = case when new.kon is null
        then 'Studiehjälparen vill bara hjälpa elever av samma kön som hen, och elevens kön är inte angivet. '
             || 'Ange elevens kön först, eller välj en annan studiehjälpare.'
        else 'Studiehjälparen vill bara hjälpa elever av samma kön som hen. Välj en annan studiehjälpare.' end;
  end if;
  return new;
end $$;
revoke all on function intern.elevens_kon() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger
                  where tgname = 'students_vakt_kon'
                    and tgrelid = 'public.students'::regclass and not tgisinternal) then
    create trigger students_vakt_kon
      before insert or update of matched_tutor_id, raderad_at on public.students
      for each row execute function intern.elevens_kon();
  end if;
end $$;


-- ------------------------------------------------------------
-- 4. En krock som uppstår efteråt blir en uppgift till oss
-- ------------------------------------------------------------
-- En uppgift per elev och studiehjälpare (nyckeln), utan namn: titeln
-- står i morgonmejlet. Uppgiften pekar på eleven, och elev_rensa tar
-- bort den med eleven.
create or replace function intern.kon_krock_uppgift(p_elev uuid, p_tutor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.skapa_uppgift(
    'En matchning krockar med studiehjälparens val om kön',
    'kon_krock:' || p_elev || ':' || p_tutor,
    'problem',
    'Studiehjälparen vill bara hjälpa elever av samma kön som hen, och eleven är av ett annat kön eller har '
      || 'inget angivet. Matchningen står kvar tills ni ändrar den: välj en annan studiehjälpare under '
      || 'Matchning, eller rätta elevens kön om det står fel.',
    'students', p_elev::text);
end $$;
revoke all on function intern.kon_krock_uppgift(uuid, uuid) from public, anon, authenticated;

-- Studiehjälparen slår på valet, eller byter sitt kön.
create or replace function intern.matchningsval_krock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  e uuid;
begin
  if not new.bara_samma_kon then
    return null;
  end if;
  for e in
    select s.id from public.students s
     where s.matched_tutor_id = new.tutor_id
       and s.match_status = 'matched'
       and s.raderad_at is null
       and s.kon is distinct from new.kon
  loop
    perform intern.kon_krock_uppgift(e, new.tutor_id);
  end loop;
  return null;
end $$;
revoke all on function intern.matchningsval_krock() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger
                  where tgname = 'matchningsval_krock'
                    and tgrelid = 'public.matchningsval'::regclass and not tgisinternal) then
    create trigger matchningsval_krock
      after insert or update on public.matchningsval
      for each row execute function intern.matchningsval_krock();
  end if;
end $$;

-- Elevens kön ändras medan hen är matchad.
create or replace function intern.elevens_kon_krock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.matched_tutor_id is null or new.match_status <> 'matched' or new.raderad_at is not null then
    return null;
  end if;
  if exists (select 1 from public.matchningsval v
              where v.tutor_id = new.matched_tutor_id
                and v.bara_samma_kon
                and v.kon is distinct from new.kon) then
    perform intern.kon_krock_uppgift(new.id, new.matched_tutor_id);
  end if;
  return null;
end $$;
revoke all on function intern.elevens_kon_krock() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger
                  where tgname = 'students_kon_krock'
                    and tgrelid = 'public.students'::regclass and not tgisinternal) then
    create trigger students_kon_krock
      after update of kon on public.students
      for each row when (old.kon is distinct from new.kon)
      execute function intern.elevens_kon_krock();
  end if;
end $$;


-- ------------------------------------------------------------
-- 5. Valet går med kontot
-- ------------------------------------------------------------
-- Raderas kontot helt följer raden med tutor_profiles (on delete
-- cascade). Avidentifieras det (radera_person sätter raderad_at och
-- lämnar tutor_profiles kvar för bokföringen) tas raden bort här.
create or replace function intern.matchningsval_raderas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.matchningsval where tutor_id = new.id;
  return null;
end $$;
revoke all on function intern.matchningsval_raderas() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger
                  where tgname = 'profiles_matchningsval_raderas'
                    and tgrelid = 'public.profiles'::regclass and not tgisinternal) then
    create trigger profiles_matchningsval_raderas
      after update of raderad_at on public.profiles
      for each row when (old.raderad_at is null and new.raderad_at is not null)
      execute function intern.matchningsval_raderas();
  end if;
end $$;
