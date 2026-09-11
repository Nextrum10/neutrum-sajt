-- ============================================================
-- NEXTRUM — schema v14
-- MATCHNINGEN FLYTTAR NER PÅ ELEVNIVÅ
--
-- Kör en gång i Supabase → SQL Editor. Den är idempotent: kör den
-- två gånger och ingenting händer andra gången.
--
--
-- VARFÖR
--
-- Matchningen har suttit på FAMILJEN: profiles.matched_tutor_id
-- pekar från en förälder till en studiehjälpare. Det betyder att
-- två syskon måste dela studiehjälpare, även när den ena läser
-- matte i åttan och den andra svenska i femman.
--
-- Allt annat i systemet hänger redan på eleven. Läxor, material,
-- studieplan, rapporter och utvecklingsområden bär ett student_id,
-- och ett pass bokas åt en elev. Matchningen var det enda som låg
-- ett steg för högt upp.
--
--
-- HUR, UTAN ATT NÅGOT GÅR SÖNDER
--
-- Migrationen är additiv. Ingen kolumn tas bort, ingen policy
-- skrivs om, och de två inloggade vyerna behöver inte röras för
-- att fortsätta fungera. Tre delar:
--
--   1. students får matched_tutor_id och match_status, ifyllda
--      från förälderns nuvarande matchning.
--
--   2. De två hjälpfunktionerna som ALL matchnings-RLS går igenom
--      — is_my_matched_tutor och is_matched_tutor_of — svarar ja
--      om relationen finns på ENDERA stället. Fem policyer i fyra
--      tabeller börjar därmed gälla per elev utan att en enda av
--      dem skrivs om.
--
--   3. En trigger håller profiles.matched_tutor_id i takt som
--      "familjens studiehjälpare". Studievyn och studiehjälpar-
--      vyn läser fortfarande den, och fortsätter fungera exakt
--      som förut för en familj med ett barn.
--
-- Steg 3 är övergången. När vyerna läser per elev kan kolumnen
-- på profiles sluta underhållas — men inte förrän dess, och inte
-- i samma migration som den här.
--
--
-- SÄKERHETEN, SOM ÄR HELA POÄNGEN MED ATT LÄSA VIDARE
--
-- En förälder får idag uppdatera sina egna barn helt fritt:
--
--   policy "förälder uppdaterar egna barn"
--   using (auth.uid() = parent_id)     -- utan with_check
--
-- Utan skydd hade de nya kolumnerna alltså gått att sätta själv.
-- Och att sätta matched_tutor_id är inte en anteckning: det är
-- vad som ger läsrätt på studiehjälparens profil och vad som ger
-- studiehjälparen läsrätt på eleven. En förälder hade kunnat
-- koppla sig till vem som helst.
--
-- Del 4 nedan stoppar det, byggd precis som skydda_profilfalt i
-- v3: fälten skrivs tillbaka till sina gamla värden om den som
-- frågar inte är admin.
-- ============================================================


-- ============================================================
-- 1. KOLUMNERNA
-- ============================================================

alter table public.students
  add column if not exists matched_tutor_id uuid references public.profiles(id) on delete set null,
  add column if not exists match_status text not null default 'pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'students_match_status_check'
  ) then
    alter table public.students
      add constraint students_match_status_check
      check (match_status in ('pending', 'matched', 'paused'));
  end if;
end $$;

comment on column public.students.matched_tutor_id is
  'Elevens studiehjälpare. Sätts bara av admin — se skydda_studentfalt.';
comment on column public.students.match_status is
  'pending | matched | paused. paused = relationen finns men vilar.';

-- Studiehjälparvyn frågar "vilka elever är mina?" vid varje
-- sidladdning. Utan index blir det en full scan per fråga.
create index if not exists students_matched_tutor_idx
  on public.students (matched_tutor_id)
  where matched_tutor_id is not null;


-- ============================================================
-- 2. BACKFILL
--
-- Varje elev ärver förälderns nuvarande matchning. Bara elever
-- som inte redan har en egen — så att en omkörning inte skriver
-- över något någon satt i adminvyn under tiden.
-- ============================================================

update public.students s
set matched_tutor_id = p.matched_tutor_id,
    match_status     = case when p.match_status = 'matched' then 'matched' else 'pending' end
from public.profiles p
where p.id = s.parent_id
  and s.matched_tutor_id is null
  and p.matched_tutor_id is not null;


-- ============================================================
-- 3. HJÄLPFUNKTIONERNA
--
-- Här sker själva växlingen. Båda svarar nu ja om relationen
-- finns på familjen ELLER på någon av familjens elever.
--
-- Varför detta räcker: varenda policy som rör matchning går
-- igenom en av de här två. Att ändra dem är att ändra alla fem
-- policyer på en gång, och att inte kunna glömma någon.
-- ============================================================

create or replace function public.is_my_matched_tutor(tutor_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    -- familjens studiehjälpare (gamla vägen)
    select 1 from public.profiles p
    where p.id = auth.uid() and p.matched_tutor_id = tutor_uuid
  ) or exists (
    -- någon av mina elevers studiehjälpare (nya vägen)
    select 1 from public.students s
    where s.parent_id = auth.uid()
      and s.matched_tutor_id = tutor_uuid
      and s.match_status <> 'pending'
  )
$function$;

comment on function public.is_my_matched_tutor(uuid) is
  'Är den här studiehjälparen min? Sant om relationen finns på familjen eller på någon av mina elever.';

create or replace function public.is_matched_tutor_of(parent_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles p
    where p.id = parent_uuid and p.matched_tutor_id = auth.uid()
  ) or exists (
    select 1 from public.students s
    where s.parent_id = parent_uuid
      and s.matched_tutor_id = auth.uid()
      and s.match_status <> 'pending'
  )
$function$;

comment on function public.is_matched_tutor_of(uuid) is
  'Är jag studiehjälpare åt den här familjen? Sant om relationen finns på familjen eller på något av deras barn.';

-- Ny, och smalare än de två ovan: gäller EN elev, inte hela
-- familjen. Den är det som gör per-elev-matchningen meningsfull —
-- utan den ser en studiehjälpare fortfarande alla syskon.
create or replace function public.ar_min_elev(elev_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.students s
    where s.id = elev_uuid
      and s.matched_tutor_id = auth.uid()
      and s.match_status <> 'pending'
  )
$function$;

comment on function public.ar_min_elev(uuid) is
  'Är den här eleven min? Till skillnad från is_matched_tutor_of gäller den en elev, inte familjen.';


-- ============================================================
-- 4. SKYDDET
--
-- Se rubriken högst upp. Utan den här triggern kan en förälder
-- koppla sitt barn till vilken studiehjälpare som helst, och
-- därmed ge sig själv läsrätt på en främmande profil.
--
-- Samma konstruktion som skydda_profilfalt i v3: fälten skrivs
-- tillbaka i stället för att uppdateringen avvisas. Skälet är
-- att studievyn skickar hela raden när den sparar skola och
-- ämnen — ett undantag hade gjort den sparningen omöjlig, ett
-- tyst återställande gör bara de skyddade fälten orörliga.
--
-- auth.uid() is null släpper igenom: det är service_role och
-- SQL Editor, alltså backfillen ovan och adminfunktionerna.
-- ============================================================

create or replace function public.skydda_studentfalt()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  new.matched_tutor_id := old.matched_tutor_id;
  new.match_status     := old.match_status;
  new.parent_id        := old.parent_id;
  new.id               := old.id;
  return new;
end $function$;

drop trigger if exists students_skydda on public.students;
create trigger students_skydda
  before update on public.students
  for each row execute function public.skydda_studentfalt();

-- Och vid INSERT: en förälder som lägger till ett barn ska inte
-- kunna skicka med en studiehjälpare på köpet.
create or replace function public.skydda_studentfalt_ny()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  new.matched_tutor_id := null;
  new.match_status     := 'pending';
  return new;
end $function$;

drop trigger if exists students_skydda_ny on public.students;
create trigger students_skydda_ny
  before insert on public.students
  for each row execute function public.skydda_studentfalt_ny();


-- ============================================================
-- 5. ÖVERGÅNGEN
--
-- Studievyn och studiehjälparvyn läser profiles.matched_tutor_id
-- på ett fyrtiotal ställen. Att skriva om dem hör inte hemma i en
-- migration — men de får heller inte sluta fungera i minuten den
-- här körs.
--
-- Därför den här triggern: när en elevs matchning ändras räknas
-- familjens om till "studiehjälparen för det först matchade
-- barnet". För en familj med ett barn, vilket är nästan alla, är
-- det exakt samma värde som förut och vyerna märker ingenting.
--
-- För en familj med två barn hos olika studiehjälpare visar de
-- gamla vyerna den ena. Sämre än sanningen, men inte fel — och
-- RLS-funktionerna ovan släpper igenom båda, så ingen tappar
-- åtkomst. Den halvsanningen försvinner när vyerna läser per
-- elev, och då kan triggern och kolumnen tas bort.
-- ============================================================

create or replace function public.synka_familjens_match()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  forald uuid := coalesce(new.parent_id, old.parent_id);
  vald   uuid;
begin
  select s.matched_tutor_id into vald
  from public.students s
  where s.parent_id = forald
    and s.matched_tutor_id is not null
    and s.match_status = 'matched'
  order by s.created_at
  limit 1;

  update public.profiles p
  set matched_tutor_id = vald,
      match_status     = case when vald is null then 'pending' else 'matched' end
  where p.id = forald
    and (p.matched_tutor_id is distinct from vald
         or p.match_status is distinct from (case when vald is null then 'pending' else 'matched' end));

  return null;
end $function$;

drop trigger if exists students_synka_match on public.students;
create trigger students_synka_match
  after insert or update of matched_tutor_id, match_status or delete
  on public.students
  for each row execute function public.synka_familjens_match();


-- ============================================================
-- 6. ADMINVYNS MATCHNINGSUNDERLAG
--
-- Adminvyn behöver, per elev, veta vilka godkända studiehjälpare
-- som passar. Frågan ställs en gång per sidladdning och gäller
-- alla elever, så den ligger som en vy i stället för som en
-- fråga per elev i klienten.
--
-- Vyn RANKAR INTE. Den lämnar ut rådata — ämnen, årskurser,
-- format, ort — och låter adminvyn räkna. Skälet är att en
-- ranking i SQL blir en siffra utan förklaring, och det som
-- gör en matchningslista användbar är just att den kan säga
-- VARFÖR någon passar.
-- ============================================================

create or replace view public.matchningsunderlag
with (security_invoker = true) as
select
  t.id                                as tutor_id,
  p.full_name                         as namn,
  p.email,
  t.city                              as ort,
  t.subjects                          as amnen,
  t.grade_levels                      as arskurser,
  t.formats                           as format,
  t.hourly_rate                       as timpris,
  t.bio,
  (select count(*) from public.students s
    where s.matched_tutor_id = t.id and s.match_status = 'matched') as antal_elever,
  (select count(*) from public.bookings b
    where b.tutor_id = t.id and b.status = 'completed')             as genomforda_pass,
  (select array_agg(distinct a.weekday order by a.weekday)
     from public.tutor_availability a where a.tutor_id = t.id)      as veckodagar
from public.tutor_profiles t
join public.profiles p on p.id = t.id
where t.status = 'approved';

comment on view public.matchningsunderlag is
  'Godkända studiehjälpare med det adminvyn behöver för att föreslå matchningar. Rankar inte — klienten räknar, så att den kan visa varför.';

revoke all on public.matchningsunderlag from public;
grant select on public.matchningsunderlag to authenticated;


-- ============================================================
-- 7. EFTERÅT
--
-- Kontrollera att backfillen tog:
--
--   select s.name, s.match_status, p.full_name as studiehjalpare
--   from public.students s
--   left join public.profiles p on p.id = s.matched_tutor_id
--   order by s.created_at;
--
-- Kontrollera att skyddet håller. Logga in som en förälder i
-- webbläsaren och kör i konsolen:
--
--   await supa.from('students')
--     .update({ matched_tutor_id: '<någon annans id>' })
--     .eq('id', '<eget barns id>');
--
-- Anropet ska svara utan fel — och kolumnen ska vara oförändrad
-- när du läser tillbaka raden. Det är triggern som gör det, inte
-- ett avslag, och skillnaden är avsiktlig (se del 4).
--
--
-- EN FÄLLA NÄR NI TESTAR
--
-- Skyddet släpper igenom den som är admin. Är ditt eget konto
-- både förälder OCH admin — vilket det lätt blir, för man sätter
-- is_admin på sig själv och har sina egna testbarn — går
-- uppdateringen igenom, och det ser ut som att triggern inte
-- fungerar.
--
-- Den gör det. Testa med ett konto som inte har is_admin.
-- ============================================================
