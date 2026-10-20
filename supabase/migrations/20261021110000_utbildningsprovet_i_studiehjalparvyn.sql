-- ============================================================
-- Utbildningsprovet i studiehjälparvyn (2026-10-21)
--
-- Beställningen (Leo, 2026-10-21): ett prov som studiehjälparen gör vid
-- första inloggningen, innan studiehjälparvyn öppnas. Mer än 50 % rätt
-- är godkänt, och gränsen står i en inställning, inte i koden. Provet
-- görs en gång: när det är godkänt sätts utbildningsprov_godkant_at.
-- Rättningen sker på servern och facit når aldrig studiehjälparens
-- webbläsare: funktionen som delar ut frågorna har inget facit, och den
-- som tar emot svaren svarar bara med poängen och godkänt eller inte.
-- Den som inte klarar det gör om provet tidigast 24 timmar senare, och
-- admin kan nollställa. Spärren ligger i databasen, inte i vyn. Den
-- gäller först när det finns minst fem aktiva frågor (annars en varning
-- i adminvyn), studiehjälpare som var godkända före den här filen
-- slipper, och admin kan slå på kravet för en person.
--
-- Det här är INTE provet i rekryteringen (Fas 22.1: utbildningsprov.html,
-- edge-funktionen utbildningsprov, applications.prov_* och
-- utbildningsprov_forsok), som den som söker gör genom en länk i ett
-- mejl. Det står kvar orört. Det här provet görs av den som redan är
-- godkänd och har ett konto, och frågorna skrivs i adminvyn.
--
--   1. prov_installning (en rad): gränsen i procent (godkänt är MER än
--      den), hur många aktiva frågor som krävs innan spärren gäller, och
--      väntetiden efter ett underkänt försök.
--   2. prov_fragor: frågan, alternativen och facit (ratt_svar, ett index
--      i alternativen). Bara superadmin läser och skriver, och bara
--      genom spara_provfraga(). Ingen fråga tas bort: den stängs av.
--   3. prov_forsok: varje inlämnat försök, med svaren och vilka som var
--      rätt. Skrivs bara av lamna_in_utbildningsprov(); den som gjort
--      provet läser aldrig raden, för de rätta svaren står i den.
--   4. prov_studiehjalpare: läget per studiehjälpare (kravs,
--      utbildningsprov_godkant_at, aterstalld_at). En egen tabell och
--      inte kolumner på tutor_profiles: skydda_tutorfalt släpper bara
--      igenom en vitlista när studiehjälparen själv ändrar sin rad, och
--      provet lämnas in som studiehjälparen. Ingen rad betyder att
--      provet krävs. De som var godkända när filen kördes får en rad
--      där det inte krävs.
--   5. intern.provet_sparrar(): sant för en studiehjälpare (utan
--      adminroll) som ska göra provet och inte klarat det, när spärren
--      gäller. Restriktiva policyer på tabellerna med familjernas och
--      elevernas uppgifter (bookings, students, lesson_reports,
--      messages, study_plans, tutor_reviews, notiser och andras
--      profiles), is_my_student() (som läxorna, materialet, utvecklingen
--      och NexLäx-försöken bygger på) och barnchattens tre funktioner
--      släpper inte fram något förrän provet är klart. Det som hänger på
--      passen och eleverna (förberedelsen, mötet, tilläggen, timbankens
--      uttag och uppdragen) läser bookings och students i sina
--      policyer, och spärras därmed också.
--   6. Funktionerna: mitt_utbildningsprov() och
--      lamna_in_utbildningsprov() för studiehjälparen; spara_provfraga(),
--      satt_provinstallning(), satt_provkrav(),
--      aterstall_utbildningsprov() och utbildningsprovet_lage() för
--      admin. Frågorna och inställningen ändrar bara superadmin; kravet,
--      nollställningen och resultaten också den med behörigheten
--      studiehjalpare_godkann.
--   7. radera_person: försöken tas bort när en studiehjälpare raderas
--      eller avidentifieras (intern.provet_rensa).
--   8. Auditloggen: kravet, godkännandet, nollställningen, inställningen
--      och om en fråga är på.
--
-- Funktionerna som lappas prövas mot driften som den byggs ur
-- migrationerna (md5 på pg_get_functiondef); en som redan bär
-- provet_sparrar släpps igenom, så filen går att köra två gånger. Inget
-- drop. Ett delete finns bara i intern.provet_rensa (en sats).
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 0. driften är som den lästes ----------
do $$
declare
  f   record;
  def text;
begin
  for f in
    select * from (values
      ('public.is_my_student(uuid)',          '380f2edeb1def8df8545141ff2c9469b'),
      ('public.barnchatt_skriv(uuid, text)',  'c900c3fc422f6db7745b91d1ed4742ac'),
      ('public.barnchatt_trad(uuid)',         '0a5939c8805d84596778ea73d6185c32'),
      ('public.barnchatt_tradar()',           '07c302547c7b446019f7d860bfa877b0'),
      ('public.radera_person(text, uuid)',    '68fdec157f49d4f12f5aab4dad1f6134')) v(namn, summa)
  loop
    def := pg_get_functiondef(f.namn::regprocedure);
    if position('provet_' in def) = 0 and md5(def) <> f.summa then
      raise exception '% har ändrats sedan utbildningsprovet_i_studiehjalparvyn skrevs (md5 %). Läs driften och skriv om migrationen.',
        f.namn, md5(def);
    end if;
  end loop;
end $$;


-- ---------- 1. inställningen ----------
create table if not exists public.prov_installning (
  id                smallint primary key default 1 check (id = 1),
  grans_procent     numeric(5,2) not null default 50 check (grans_procent >= 0 and grans_procent < 100),
  min_aktiva_fragor integer not null default 5 check (min_aktiva_fragor between 1 and 100),
  vantetid_timmar   integer not null default 24 check (vantetid_timmar between 0 and 720),
  andrad_at         timestamptz,
  andrad_av         uuid references public.profiles(id) on delete set null
);
-- Raden skrivs i avsnitt 4, efter undantagen: den säger att filen körts.

comment on table public.prov_installning is
  '2026-10-21 (utbildningsprovet_i_studiehjalparvyn). En rad. Godkänt är MER än grans_procent rätt; spärren gäller '
  'först när minst min_aktiva_fragor frågor är på; ett underkänt försök kan göras om efter vantetid_timmar. Ändras '
  'bara genom satt_provinstallning() (superadmin).';


-- ---------- 2. frågorna ----------
create table if not exists public.prov_fragor (
  id         uuid primary key default gen_random_uuid(),
  fraga      text not null check (char_length(btrim(fraga)) between 3 and 600),
  alternativ text[] not null check (cardinality(alternativ) between 2 and 6),
  ratt_svar  smallint not null check (ratt_svar >= 0),
  aktiv      boolean not null default true,
  ordning    integer not null default 100,
  skapad_at  timestamptz not null default now(),
  skapad_av  uuid references public.profiles(id) on delete set null,
  andrad_at  timestamptz,
  andrad_av  uuid references public.profiles(id) on delete set null,
  constraint prov_fragor_facit_i_alternativen check (ratt_svar < cardinality(alternativ))
);
create index if not exists prov_fragor_aktiva on public.prov_fragor (ordning, skapad_at) where aktiv;

comment on table public.prov_fragor is
  '2026-10-21. Utbildningsprovets frågor. ratt_svar är facit (ett index i alternativ) och läses bara av superadmin; '
  'studiehjälparen får frågorna utan facit genom mitt_utbildningsprov(). Skrivs bara av spara_provfraga(). En fråga '
  'tas aldrig bort, den stängs av (aktiv), för försöken pekar på den.';


-- ---------- 3. försöken ----------
create table if not exists public.prov_forsok (
  id                uuid primary key default gen_random_uuid(),
  studiehjalpare_id uuid not null references public.profiles(id) on delete cascade,
  inlamnad_at       timestamptz not null default now(),
  antal             integer not null check (antal > 0),
  ratt              integer not null check (ratt >= 0),
  procent           numeric(5,2) not null,
  grans_procent     numeric(5,2) not null,
  godkand           boolean not null,
  svar              jsonb not null default '[]'::jsonb,
  constraint prov_forsok_ratt_av_antal check (ratt <= antal)
);
create index if not exists prov_forsok_person on public.prov_forsok (studiehjalpare_id, inlamnad_at desc);

comment on table public.prov_forsok is
  '2026-10-21. Ett inlämnat försök på utbildningsprovet: poängen, gränsen då, och svaren med vilka som var rätt '
  '([{fraga, svar, ratt}]). Skrivs bara av lamna_in_utbildningsprov(). Den som gjort provet läser aldrig raden, för de '
  'rätta svaren står i den. Tas bort när personen raderas eller avidentifieras (intern.provet_rensa).';


-- ---------- 4. läget per studiehjälpare ----------
create table if not exists public.prov_studiehjalpare (
  id                         uuid primary key references public.profiles(id) on delete cascade,
  kravs                      boolean not null default true,
  utbildningsprov_godkant_at timestamptz,
  aterstalld_at              timestamptz,
  undantagen                 text,
  andrad_at                  timestamptz not null default now(),
  andrad_av                  uuid references public.profiles(id) on delete set null
);

comment on table public.prov_studiehjalpare is
  '2026-10-21. Utbildningsprovets läge per studiehjälpare. Ingen rad betyder att provet krävs. kravs slås av och på '
  'av admin (satt_provkrav), utbildningsprov_godkant_at sätts när ett försök är godkänt, och aterstalld_at när admin '
  'nollställt provet: väntetiden räknar bara försök efter den. undantagen säger varför provet inte krävs (de som var '
  'godkända när provet kom). Skrivs bara av databasens funktioner.';

-- De som är godkända studiehjälpare nu slipper provet, men bara första
-- gången filen körs. Ingen rad betyder att provet krävs, så en andra
-- körning hade annars undantagit den som godkänts sedan dess. Att
-- inställningens rad finns säger att filen redan körts: den skrivs direkt
-- efter undantagen. Ett läge som redan finns rörs aldrig.
do $$
begin
  if not exists (select 1 from public.prov_installning i where i.id = 1) then
    insert into public.prov_studiehjalpare (id, kravs, undantagen)
    select t.id, false, 'godkänd före provet (2026-10-21)'
      from public.tutor_profiles t
      join public.profiles p on p.id = t.id
     where t.status = 'approved'
    on conflict (id) do nothing;
  end if;
end $$;
insert into public.prov_installning (id) values (1) on conflict (id) do nothing;


-- ---------- rättigheterna ----------
alter table public.prov_installning    enable row level security;
alter table public.prov_fragor         enable row level security;
alter table public.prov_forsok         enable row level security;
alter table public.prov_studiehjalpare enable row level security;

revoke all on public.prov_installning, public.prov_fragor, public.prov_forsok, public.prov_studiehjalpare
  from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.prov_installning, public.prov_fragor, public.prov_forsok, public.prov_studiehjalpare
  from authenticated;
grant select on public.prov_installning, public.prov_fragor, public.prov_forsok, public.prov_studiehjalpare
  to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nextrum_barn') then
    execute 'revoke all on public.prov_installning, public.prov_fragor, public.prov_forsok, '
         || 'public.prov_studiehjalpare from nextrum_barn';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prov_fragor'
                  and policyname = 'superadmin läser provets frågor') then
    create policy "superadmin läser provets frågor" on public.prov_fragor
      for select to authenticated using ((select public.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prov_installning'
                  and policyname = 'admin läser provets inställning') then
    create policy "admin läser provets inställning" on public.prov_installning
      for select to authenticated
      using ((select public.is_admin()) or (select public.har_behorighet('studiehjalpare_godkann')));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prov_forsok'
                  and policyname = 'admin läser försöken') then
    create policy "admin läser försöken" on public.prov_forsok
      for select to authenticated
      using ((select public.is_admin()) or (select public.har_behorighet('studiehjalpare_godkann')));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prov_studiehjalpare'
                  and policyname = 'admin läser provets läge') then
    create policy "admin läser provets läge" on public.prov_studiehjalpare
      for select to authenticated
      using ((select public.is_admin()) or (select public.har_behorighet('studiehjalpare_godkann')));
  end if;
end $$;


-- ---------- 5. spärren ----------
create or replace function intern.provet_sparrar(uid uuid default auth.uid())
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  -- utbildningsprovet_i_studiehjalparvyn (2026-10-21). Sant för en
  -- studiehjälpare utan adminroll som ska göra provet och inte klarat
  -- det, när det finns tillräckligt många aktiva frågor. Ingen rad i
  -- prov_studiehjalpare betyder att provet krävs. Läser med ägarens
  -- rättigheter, så policyerna som anropar den läser inte sig själva.
  select uid is not null
     and exists (select 1 from public.tutor_profiles t where t.id = uid)
     and not exists (select 1 from public.admin_roller r where r.user_id = uid)
     and coalesce((select p.kravs and p.utbildningsprov_godkant_at is null
                     from public.prov_studiehjalpare p where p.id = uid), true)
     and (select count(*) from public.prov_fragor f where f.aktiv)
         >= coalesce((select i.min_aktiva_fragor from public.prov_installning i where i.id = 1), 5)
$function$;

comment on function intern.provet_sparrar(uuid) is
  '2026-10-21. Sant när studiehjälparen ska göra utbildningsprovet och inte klarat det, och spärren gäller (minst '
  'min_aktiva_fragor aktiva frågor). Admins och familjer spärras aldrig. Används i de restriktiva policyerna, i '
  'is_my_student() och i barnchattens funktioner.';

revoke all on function intern.provet_sparrar(uuid) from public;
grant execute on function intern.provet_sparrar(uuid) to authenticated, service_role;

-- Restriktiva policyer: de läggs ovanpå de vanliga och måste också
-- släppa igenom raden. För alla andra än en spärrad studiehjälpare är
-- de sanna. (select ...) räknas en gång per fråga, inte per rad.
do $$
declare
  t text;
begin
  foreach t in array array['bookings', 'students', 'lesson_reports', 'messages', 'study_plans',
                           'tutor_reviews', 'notiser'] loop
    if to_regclass('public.' || t) is not null
       and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t
                        and policyname = 'utbildningsprovet först') then
      execute format('create policy "utbildningsprovet först" on public.%I as restrictive for all to authenticated '
                     'using ((select not intern.provet_sparrar())) with check ((select not intern.provet_sparrar()))', t);
    end if;
  end loop;

  -- Sin egen profil läser och ändrar studiehjälparen alltid: provet står i vyn.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
                  and policyname = 'utbildningsprovet först') then
    create policy "utbildningsprovet först" on public.profiles as restrictive for all to authenticated
      using (id = (select auth.uid()) or (select not intern.provet_sparrar()))
      with check (id = (select auth.uid()) or (select not intern.provet_sparrar()));
  end if;
end $$;


-- ---------- is_my_student och barnchatten ----------
create or replace function public.is_my_student(student_uuid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  -- utbildningsprovet_i_studiehjalparvyn (2026-10-21): en studiehjälpare
  -- som ska göra provet når inga elever förrän det är klart. Spärren
  -- prövas bara när eleven är hens, så familjernas frågor kostar inget.
  select case when exists (
    select 1 from public.students s
    where s.id = student_uuid
      and s.matched_tutor_id = auth.uid()
      and s.match_status <> 'pending'
  ) then not intern.provet_sparrar() else false end
$function$;

do $$
declare
  lappar constant text[][] := array[
    array['public.barnchatt_skriv(uuid, text)',
          'or intern.barnchatt_hjalpare(s.id) is distinct from jag' || chr(10) || '     or s.match_status <> ''matched'' then',
          'or intern.barnchatt_hjalpare(s.id) is distinct from jag' || chr(10) || '     or s.match_status <> ''matched''' || chr(10)
            || '     -- utbildningsprovet_i_studiehjalparvyn (2026-10-21): inte förrän provet är klart.' || chr(10)
            || '     or intern.provet_sparrar(jag) then'],
    array['public.barnchatt_trad(uuid)',
          'if jag is null or s.id is null or intern.barnchatt_hjalpare(s.id) is distinct from jag then',
          'if jag is null or s.id is null or intern.barnchatt_hjalpare(s.id) is distinct from jag' || chr(10)
            || '     -- utbildningsprovet_i_studiehjalparvyn (2026-10-21): inte förrän provet är klart.' || chr(10)
            || '     or intern.provet_sparrar(jag) then'],
    array['public.barnchatt_tradar()',
          'if jag is null then',
          '-- utbildningsprovet_i_studiehjalparvyn (2026-10-21): inte förrän provet är klart.' || chr(10)
            || '  if jag is null or intern.provet_sparrar(jag) then'],
    array['public.radera_person(text, uuid)',
          '    delete from public.tutor_reviews where tutor_id = p_id;',
          '    delete from public.tutor_reviews where tutor_id = p_id;' || chr(10)
            || '    -- utbildningsprovet_i_studiehjalparvyn (2026-10-21): försöken, med svaren.' || chr(10)
            || '    perform intern.provet_rensa(p_id);']];
  i   integer;
  def text;
  n   integer;
begin
  for i in 1 .. array_length(lappar, 1) loop
    def := pg_get_functiondef(lappar[i][1]::regprocedure);
    if position('provet_' in def) > 0 then
      continue;
    end if;
    n := (char_length(def) - char_length(replace(def, lappar[i][2], ''))) / char_length(lappar[i][2]);
    if n <> 1 then
      raise exception 'Lappen för % träffade % ställen, inte ett. Läs driften.', lappar[i][1], n;
    end if;
    execute replace(def, lappar[i][2], lappar[i][3]);
  end loop;
end $$;


-- ---------- 7. försöken tas bort med personen ----------
create or replace function intern.provet_rensa(p_id uuid)
 returns void
 language sql
 security definer
 set search_path to ''
as $function$
  -- utbildningsprovet_i_studiehjalparvyn (2026-10-21). Anropas av
  -- radera_person för en studiehjälpare: försöken bär svaren, och de
  -- ska inte stå kvar med ett avidentifierat konto. Läget (bara
  -- tidpunkter) går med kontot när det raderas helt.
  delete from public.prov_forsok where studiehjalpare_id = p_id;
$function$;
revoke all on function intern.provet_rensa(uuid) from public, anon, authenticated;


-- ---------- 6. studiehjälparens två funktioner ----------
create or replace function public.mitt_utbildningsprov()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
-- utbildningsprovet_i_studiehjalparvyn (2026-10-21). Läget för den som
-- är inloggad, och frågorna UTAN facit när provet ska göras nu.
declare
  jag     uuid := (select auth.uid());
  st      public.prov_studiehjalpare%rowtype;
  ins     public.prov_installning%rowtype;
  senaste public.prov_forsok%rowtype;
  sparr   boolean;
  vantar  timestamptz;
begin
  if jag is null or not exists (select 1 from public.tutor_profiles t where t.id = jag) then
    return jsonb_build_object('studiehjalpare', false, 'kravs', false);
  end if;
  select * into ins from public.prov_installning i where i.id = 1;
  select * into st from public.prov_studiehjalpare p where p.id = jag;
  sparr := intern.provet_sparrar(jag);

  select * into senaste from public.prov_forsok f
   where f.studiehjalpare_id = jag and f.inlamnad_at > coalesce(st.aterstalld_at, '-infinity'::timestamptz)
   order by f.inlamnad_at desc limit 1;
  if senaste.id is not null and not senaste.godkand
     and senaste.inlamnad_at + make_interval(hours => ins.vantetid_timmar) > now() then
    vantar := senaste.inlamnad_at + make_interval(hours => ins.vantetid_timmar);
  end if;

  return jsonb_build_object(
    'studiehjalpare', true,
    'kravs', sparr,
    'godkant_at', st.utbildningsprov_godkant_at,
    'grans_procent', ins.grans_procent,
    'kan_gora_om_fran', vantar,
    'senaste', case when senaste.id is not null then
      jsonb_build_object('inlamnad_at', senaste.inlamnad_at, 'ratt', senaste.ratt, 'antal', senaste.antal,
                         'godkand', senaste.godkand) end,
    'fragor', case when sparr and vantar is null then coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'fraga', f.fraga, 'alternativ', to_jsonb(f.alternativ))
                       order by f.ordning, f.skapad_at, f.id)
        from public.prov_fragor f where f.aktiv), '[]'::jsonb)
      else '[]'::jsonb end);
end $function$;

comment on function public.mitt_utbildningsprov() is
  '2026-10-21. Utbildningsprovets läge för den inloggade studiehjälparen: om provet krävs nu (kravs), när det '
  'godkändes, gränsen, när ett underkänt försök kan göras om, det senaste försökets poäng, och frågorna utan facit '
  'när provet ska göras.';

create or replace function public.lamna_in_utbildningsprov(p_svar jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- utbildningsprovet_i_studiehjalparvyn (2026-10-21). Rättar på servern
-- och svarar bara med poängen och om det är godkänt. Svaren är
-- {"<frågans id>": <alternativets index>} för varje aktiv fråga.
declare
  jag    uuid := (select auth.uid());
  st     public.prov_studiehjalpare%rowtype;
  ins    public.prov_installning%rowtype;
  sen    public.prov_forsok%rowtype;
  f      record;
  v      jsonb;
  val    numeric;
  antal  integer := 0;
  ratt   integer := 0;
  detalj jsonb := '[]'::jsonb;
  pct    numeric(5,2);
  ok     boolean;
begin
  if jag is null then
    raise exception 'Logga in först.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tutor_profiles t where t.id = jag) then
    raise exception 'Provet är för studiehjälpare.' using errcode = '42501';
  end if;
  if not intern.provet_sparrar(jag) then
    raise exception 'Du behöver inte göra provet.' using errcode = '22023';
  end if;

  -- Ett försök i taget: raden låses, och läget läses efter låset.
  insert into public.prov_studiehjalpare (id) values (jag) on conflict (id) do nothing;
  select * into st from public.prov_studiehjalpare p where p.id = jag for update;
  select * into ins from public.prov_installning i where i.id = 1;

  if st.utbildningsprov_godkant_at is not null then
    raise exception 'Du har redan klarat provet.' using errcode = '22023';
  end if;

  select * into sen from public.prov_forsok x
   where x.studiehjalpare_id = jag and x.inlamnad_at > coalesce(st.aterstalld_at, '-infinity'::timestamptz)
   order by x.inlamnad_at desc limit 1;
  if sen.id is not null and not sen.godkand
     and sen.inlamnad_at + make_interval(hours => ins.vantetid_timmar) > now() then
    raise exception 'Du kan göra om provet tidigast %.',
      to_char((sen.inlamnad_at + make_interval(hours => ins.vantetid_timmar)) at time zone 'Europe/Stockholm',
              'YYYY-MM-DD HH24:MI')
      using errcode = '22023';
  end if;

  if p_svar is null or jsonb_typeof(p_svar) <> 'object' then
    raise exception 'Svaren saknas.' using errcode = '22023';
  end if;

  for f in select q.id, q.ratt_svar, cardinality(q.alternativ) as n
             from public.prov_fragor q where q.aktiv
            order by q.ordning, q.skapad_at, q.id loop
    v := p_svar -> f.id::text;
    if v is null or jsonb_typeof(v) <> 'number' then
      raise exception 'Svara på alla frågor.' using errcode = '22023';
    end if;
    val := (v #>> '{}')::numeric;
    if val <> trunc(val) or val < 0 or val >= f.n then
      raise exception 'Ett svar finns inte bland alternativen.' using errcode = '22023';
    end if;
    antal := antal + 1;
    if val::integer = f.ratt_svar then
      ratt := ratt + 1;
    end if;
    detalj := detalj || jsonb_build_object('fraga', f.id, 'svar', val::integer, 'ratt', val::integer = f.ratt_svar);
  end loop;

  if antal = 0 then
    raise exception 'Provet har inga frågor än.' using errcode = '22023';
  end if;

  pct := round(100.0 * ratt / antal, 2);
  ok  := 100.0 * ratt / antal > ins.grans_procent;

  insert into public.prov_forsok (studiehjalpare_id, antal, ratt, procent, grans_procent, godkand, svar)
  values (jag, antal, ratt, pct, ins.grans_procent, ok, detalj);

  if ok then
    update public.prov_studiehjalpare
       set utbildningsprov_godkant_at = now(), andrad_at = now(), andrad_av = jag
     where id = jag;
  end if;

  return jsonb_build_object('ratt', ratt, 'antal', antal, 'godkand', ok);
end $function$;

comment on function public.lamna_in_utbildningsprov(jsonb) is
  '2026-10-21. Rättar utbildningsprovet på servern och svarar bara {ratt, antal, godkand}. Godkänt är MER än '
  'prov_installning.grans_procent rätt. Ett underkänt försök kan göras om efter vantetid_timmar; ett godkänt görs inte om.';


-- ---------- admins funktioner ----------
create or replace function public.spara_provfraga(p_id uuid, p_fraga text, p_alternativ text[],
                                                  p_ratt_svar integer, p_aktiv boolean default true,
                                                  p_ordning integer default null)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- utbildningsprovet_i_studiehjalparvyn (2026-10-21). Bara superadmin.
-- En ny fråga när p_id är null, annars en ändring. Ingen fråga tas bort.
declare
  jag  uuid := (select auth.uid());
  alt  text[];
  ut   uuid;
begin
  if not public.is_admin() then
    raise exception 'Bara superadmin skriver provets frågor.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_fraga, ''))) not between 3 and 600 then
    raise exception 'Frågan ska vara 3–600 tecken.' using errcode = '22023';
  end if;
  select array_agg(btrim(a) order by o) into alt
    from unnest(coalesce(p_alternativ, '{}'::text[])) with ordinality u(a, o);
  if alt is null or cardinality(alt) not between 2 and 6 then
    raise exception 'En fråga har 2–6 alternativ.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(alt) a where char_length(a) not between 1 and 200) then
    raise exception 'Varje alternativ ska vara 1–200 tecken.' using errcode = '22023';
  end if;
  if (select count(distinct lower(a)) from unnest(alt) a) <> cardinality(alt) then
    raise exception 'Två alternativ är lika.' using errcode = '22023';
  end if;
  if p_ratt_svar is null or p_ratt_svar < 0 or p_ratt_svar >= cardinality(alt) then
    raise exception 'Välj vilket alternativ som är rätt.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.prov_fragor (fraga, alternativ, ratt_svar, aktiv, ordning, skapad_av)
    values (btrim(p_fraga), alt, p_ratt_svar, coalesce(p_aktiv, true),
            coalesce(p_ordning, (select coalesce(max(q.ordning), 0) + 10 from public.prov_fragor q)), jag)
    returning id into ut;
  else
    update public.prov_fragor
       set fraga = btrim(p_fraga), alternativ = alt, ratt_svar = p_ratt_svar,
           aktiv = coalesce(p_aktiv, aktiv), ordning = coalesce(p_ordning, ordning),
           andrad_at = now(), andrad_av = jag
     where id = p_id
    returning id into ut;
    if ut is null then
      raise exception 'Frågan finns inte.' using errcode = '22023';
    end if;
  end if;
  return ut;
end $function$;

create or replace function public.satt_provinstallning(p_grans_procent numeric, p_min_aktiva_fragor integer,
                                                       p_vantetid_timmar integer)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- utbildningsprovet_i_studiehjalparvyn (2026-10-21). Bara superadmin.
begin
  if not public.is_admin() then
    raise exception 'Bara superadmin ändrar provets inställning.' using errcode = '42501';
  end if;
  if p_grans_procent is null or p_grans_procent < 0 or p_grans_procent >= 100 then
    raise exception 'Gränsen är 0–99 procent: godkänt är mer än den.' using errcode = '22023';
  end if;
  if p_min_aktiva_fragor is null or p_min_aktiva_fragor not between 1 and 100 then
    raise exception 'Minsta antal frågor är 1–100.' using errcode = '22023';
  end if;
  if p_vantetid_timmar is null or p_vantetid_timmar not between 0 and 720 then
    raise exception 'Väntetiden är 0–720 timmar.' using errcode = '22023';
  end if;
  update public.prov_installning
     set grans_procent = p_grans_procent, min_aktiva_fragor = p_min_aktiva_fragor,
         vantetid_timmar = p_vantetid_timmar, andrad_at = now(), andrad_av = (select auth.uid())
   where id = 1;
end $function$;

create or replace function public.satt_provkrav(p_studiehjalpare uuid, p_kravs boolean)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- utbildningsprovet_i_studiehjalparvyn (2026-10-21). Kräv prov för en
-- person, eller låt bli. Superadmin eller studiehjalpare_godkann.
begin
  if not (public.is_admin() or public.har_behorighet('studiehjalpare_godkann')) then
    raise exception 'Du får inte ändra provets krav.' using errcode = '42501';
  end if;
  if p_kravs is null or not exists (select 1 from public.tutor_profiles t where t.id = p_studiehjalpare) then
    raise exception 'Studiehjälparen finns inte.' using errcode = '22023';
  end if;
  insert into public.prov_studiehjalpare (id, kravs, andrad_at, andrad_av)
  values (p_studiehjalpare, p_kravs, now(), (select auth.uid()))
  on conflict (id) do update
     set kravs = excluded.kravs, andrad_at = now(), andrad_av = excluded.andrad_av,
         undantagen = case when excluded.kravs then null else public.prov_studiehjalpare.undantagen end;
end $function$;

create or replace function public.aterstall_utbildningsprov(p_studiehjalpare uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- utbildningsprovet_i_studiehjalparvyn (2026-10-21). Provet görs om:
-- godkännandet tas bort, provet krävs, och väntetiden räknar bara försök
-- efter nu. Försöken står kvar. Superadmin eller studiehjalpare_godkann.
begin
  if not (public.is_admin() or public.har_behorighet('studiehjalpare_godkann')) then
    raise exception 'Du får inte nollställa provet.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tutor_profiles t where t.id = p_studiehjalpare) then
    raise exception 'Studiehjälparen finns inte.' using errcode = '22023';
  end if;
  insert into public.prov_studiehjalpare (id, kravs, utbildningsprov_godkant_at, aterstalld_at, andrad_at, andrad_av)
  values (p_studiehjalpare, true, null, now(), now(), (select auth.uid()))
  on conflict (id) do update
     set kravs = true, utbildningsprov_godkant_at = null, aterstalld_at = now(), undantagen = null,
         andrad_at = now(), andrad_av = excluded.andrad_av;
end $function$;

create or replace function public.utbildningsprovet_lage()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
-- utbildningsprovet_i_studiehjalparvyn (2026-10-21). Inställningen, hur
-- många frågor som är på och om spärren gäller, för adminvyns varning.
-- Superadmin eller studiehjalpare_godkann. Inga frågor och inget facit.
declare
  ins    public.prov_installning%rowtype;
  aktiva integer;
begin
  if not (public.is_admin() or public.har_behorighet('studiehjalpare_godkann')) then
    raise exception 'Bara admin.' using errcode = '42501';
  end if;
  select * into ins from public.prov_installning i where i.id = 1;
  select count(*) into aktiva from public.prov_fragor f where f.aktiv;
  return jsonb_build_object(
    'grans_procent', ins.grans_procent, 'min_aktiva_fragor', ins.min_aktiva_fragor,
    'vantetid_timmar', ins.vantetid_timmar, 'aktiva', aktiva,
    'alla', (select count(*) from public.prov_fragor),
    'sparr_galler', aktiva >= ins.min_aktiva_fragor);
end $function$;

-- Supabase ger varje ny funktion EXECUTE som förval (CLAUDE.md avsnitt 6).
revoke all on function public.mitt_utbildningsprov() from public, anon;
revoke all on function public.lamna_in_utbildningsprov(jsonb) from public, anon;
revoke all on function public.spara_provfraga(uuid, text, text[], integer, boolean, integer) from public, anon;
revoke all on function public.satt_provinstallning(numeric, integer, integer) from public, anon;
revoke all on function public.satt_provkrav(uuid, boolean) from public, anon;
revoke all on function public.aterstall_utbildningsprov(uuid) from public, anon;
revoke all on function public.utbildningsprovet_lage() from public, anon;
grant execute on function public.mitt_utbildningsprov(), public.lamna_in_utbildningsprov(jsonb),
  public.spara_provfraga(uuid, text, text[], integer, boolean, integer),
  public.satt_provinstallning(numeric, integer, integer), public.satt_provkrav(uuid, boolean),
  public.aterstall_utbildningsprov(uuid), public.utbildningsprovet_lage()
  to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nextrum_barn') then
    execute 'revoke all on function public.mitt_utbildningsprov(), public.lamna_in_utbildningsprov(jsonb), '
         || 'public.spara_provfraga(uuid, text, text[], integer, boolean, integer), '
         || 'public.satt_provinstallning(numeric, integer, integer), public.satt_provkrav(uuid, boolean), '
         || 'public.aterstall_utbildningsprov(uuid), public.utbildningsprovet_lage() from nextrum_barn';
  end if;
end $$;


-- ---------- 8. auditloggen ----------
do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.prov_studiehjalpare'::regclass
                  and tgname = 'prov_studiehjalpare_audit') then
    create trigger prov_studiehjalpare_audit
      after insert or update of kravs, utbildningsprov_godkant_at, aterstalld_at on public.prov_studiehjalpare
      for each row execute function public.logga_andring('prov', 'kravs', 'utbildningsprov_godkant_at', 'aterstalld_at');
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.prov_installning'::regclass
                  and tgname = 'prov_installning_audit') then
    create trigger prov_installning_audit
      after update of grans_procent, min_aktiva_fragor, vantetid_timmar on public.prov_installning
      for each row execute function public.logga_andring('prov', 'grans_procent', 'min_aktiva_fragor', 'vantetid_timmar');
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.prov_fragor'::regclass
                  and tgname = 'prov_fragor_audit') then
    create trigger prov_fragor_audit
      after insert or update of aktiv on public.prov_fragor
      for each row execute function public.logga_andring('prov', 'aktiv');
  end if;
end $$;
