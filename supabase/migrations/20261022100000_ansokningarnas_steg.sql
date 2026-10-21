-- ============================================================
-- Ansökningarnas steg: Ny, Intervju, Utbildning och Konto skapat
-- (2026-10-22)
--
-- Beställningen (Leo, 2026-10-22): "Lägen: Ny, Intervju, Utbildning,
-- Konto skapat. En ansökan finns i exakt ett läge åt gången. Vyn 'Alla
-- ansökningar' visar bara de som ligger i Ny. ... Statusövergångar
-- tvingas i databasen (trigger). Tillåtet: ny till intervju, intervju
-- till ny (ångra), intervju till utbildning, utbildning till konto
-- skapat." Och: "Utbildning hållen ... Idempotent, kan inte skapa två
-- konton för samma ansökan."
--
-- STEGET RÄKNAS UR DET ANSÖKAN REDAN BÄR, det lagras inte en gång till.
-- Tidsstämplarna finns sedan förut och läses av gallringen, auditloggen,
-- mejlen och Ta in i poolen: till_intervju_at (Skicka vidare till
-- intervju), intervju_at (intervjun hållen, Till utbildning),
-- utbildningsmote_at och utbildad_at. Ett eget lägesfält bredvid dem hade
-- varit en andra sanning som kan glida isär från den första. Kolumnen
-- steg är därför genererad (intern.ansokan_steg), och "exakt ett läge åt
-- gången" gäller av konstruktion.
--
--   1. applications.konto_id: kontot ansökan blev. Satt bara av
--      ansokan_utbildning_hallen(), och en ansökan kan ha ett konto och ett
--      konto en ansökan (unikt index). Det är vad som gör Utbildning hållen
--      idempotent: förut kopplade inget en ansökan till sitt konto, och en
--      ändrad adress hade kunnat ge två konton för samma person.
--   2. applications.steg (genererad): konto_skapat när kontot är kopplat
--      eller läget är Godkänd (en ansökan som togs in i poolen före i dag
--      har inget konto_id), utbildning när intervjun är hållen eller
--      utbildningen påbörjad, intervju när hen skickats vidare, annars ny.
--      Avböjd är inget steg: det är ett beslut som läget bär, och en avböjd
--      ansökan står utanför stegen (vyn har en egen flik för dem). Nejet
--      mejlas som förut.
--   3. intern.ansokan_steg_vakt(): stegen byts bara som beställningen
--      säger, för admin också. Konto skapat nås bara genom
--      ansokan_utbildning_hallen(). Databasen själv (tjänstekontot,
--      gallringen, en kaskad) går förbi vakten, som alla vakter här.
--   4. ansokan_steg_logg: en rad per steg en ansökan tagit, med tid och
--      vem. Den ändras aldrig, och den följer med när ansökan gallras.
--   5. ansokan_intervjulank_igen(): Skicka intervjulänk igen. Intervjumejlet
--      köas en gång till genom notiskön, med en egen nyckel, högst en gång
--      i tio minuter, och bara medan ansökan står i Intervju.
--   6. ansokan_utbildning_hallen(): kopplar kontot, godkänner profilen med
--      uppgifterna ur ansökan och timpenningen, och sätter utbildad och
--      Godkänd, i en transaktion. Kontot skapas före, av bjud-in, som förut.
--   7. notis_utskick_ta: ett köat intervjumejl går bara medan ansökan står
--      i Intervju. Förut gick det också när hen hunnit skickas vidare till
--      utbildningen.
--
-- I driften när filen skrevs: inget. Filen är skriven och provad mot en
-- lokal databas byggd ur alla migrationer (verktyg/lokal-databas.sh).
-- Funktionen som lappas prövas mot driften som den byggs ur
-- migrationerna, och en som redan bär ändringen släpps igenom, så filen
-- går att köra två gånger. Inget drop och inget delete.
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 0. driften är som den lästes ----------
do $$
declare
  def text;
begin
  def := pg_get_functiondef('public.notis_utskick_ta(integer)'::regprocedure);
  if position('ansokningarnas_steg' in def) = 0
     and position('elsif an.till_intervju_at is null then' in def) = 0 then
    raise exception 'notis_utskick_ta har ändrats sedan ansokningarnas_steg skrevs. Läs driften och skriv om migrationen.';
  end if;
end $$;


-- ---------- 1. kontot ansökan blev ----------
alter table public.applications
  add column if not exists konto_id uuid references public.profiles(id) on delete set null;

create unique index if not exists applications_ett_konto
  on public.applications (konto_id) where konto_id is not null;

comment on column public.applications.konto_id is
  '2026-10-22 (ansokningarnas_steg). Studiehjälparkontot ansökan blev. Sätts bara av ansokan_utbildning_hallen(), '
  'och ett konto hör till en ansökan (applications_ett_konto). Utbildning hållen med samma konto igen gör ingenting.';


-- ---------- 2. steget, räknat ur det ansökan bär ----------
create or replace function intern.ansokan_steg(
  p_konto uuid, p_status text, p_till_intervju timestamptz, p_intervju timestamptz,
  p_utbmote timestamptz, p_utbildad timestamptz)
 returns text
 language sql
 immutable
 parallel safe
 set search_path to ''
as $function$
  -- ansokningarnas_steg (2026-10-22). Samma regel i kolumnen steg, i vakten
  -- och i vyn (ansSteg i nextrum-admin-rekrytering.js). Ändras den här ska
  -- kolumnen räknas om: en lagrad genererad kolumn räknas bara när raden skrivs.
  select case
    when p_konto is not null or p_status = 'approved' then 'konto_skapat'
    when p_intervju is not null or p_utbmote is not null or p_utbildad is not null then 'utbildning'
    when p_till_intervju is not null then 'intervju'
    else 'ny'
  end
$function$;

-- Den genererade kolumnen räknas som den som skriver raden, också anon när
-- ansökan skickas: funktionen ska gå att köra för alla, som en funktion
-- bakom ett CHECK-villkor (CLAUDE.md avsnitt 6). Den läser ingenting, och
-- schemat intern når ingen genom API:t.
grant execute on function intern.ansokan_steg(uuid, text, timestamptz, timestamptz, timestamptz, timestamptz)
  to anon, authenticated, service_role;

alter table public.applications
  add column if not exists steg text
  generated always as (intern.ansokan_steg(konto_id, status, till_intervju_at, intervju_at,
                                           utbildningsmote_at, utbildad_at)) stored;

comment on column public.applications.steg is
  '2026-10-22 (ansokningarnas_steg). Var ansökan står: ny, intervju, utbildning eller konto_skapat. Räknas ur '
  'konto_id, läget och tidsstämplarna (intern.ansokan_steg), och byts bara som intern.ansokan_steg_vakt tillåter. '
  'En avböjd ansökan (status rejected) står utanför stegen.';


-- ---------- 3. vakten ----------
create or replace function intern.ansokan_steg_vakt()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- ansokningarnas_steg (2026-10-22). Före ansokan_till_intervju och efter
-- applications_skydda i namnordning, så stegen den ser är de som sparas.
declare
  klanger text := current_setting('request.jwt.claims', true);
  jwtroll text := case when klanger ~ '^\s*\{' then (klanger::json ->> 'role') else null end;
  betrodd boolean := jwtroll = 'service_role'
                     or (jwtroll is null and session_user in ('postgres', 'supabase_admin'));
  genom_knappen boolean;
  fran text;
  till text;
  namn constant jsonb := '{"ny": "Ny", "intervju": "Intervju", "utbildning": "Utbildning",
                           "konto_skapat": "Konto skapat"}';
begin
  if tg_op = 'INSERT' then
    -- Kontot kopplas bara av Utbildning hållen. En ansökan som kommer in med
    -- ett konto hade lagt beslag på en studiehjälpares konto.
    if not betrodd then
      new.konto_id := null;
    end if;
    return new;
  end if;

  -- Databasen själv, och en ändring som en annan trigger eller en kaskad gör
  -- (ett raderat konto nollar konto_id), går förbi.
  if betrodd or pg_trigger_depth() > 1 then
    return new;
  end if;

  genom_knappen := coalesce(current_setting('nextrum.ansokan_konto', true), '') = new.id::text;

  if new.konto_id is distinct from old.konto_id and not genom_knappen then
    raise exception using errcode = '42501',
      message = 'Kontot kopplas till ansökan med Utbildning hållen, inte för hand.';
  end if;

  -- Ett nej är ett beslut, inget steg: det går att avböja i varje steg.
  if new.status = 'rejected' then
    return new;
  end if;

  fran := intern.ansokan_steg(old.konto_id, old.status, old.till_intervju_at, old.intervju_at,
                              old.utbildningsmote_at, old.utbildad_at);
  till := intern.ansokan_steg(new.konto_id, new.status, new.till_intervju_at, new.intervju_at,
                              new.utbildningsmote_at, new.utbildad_at);
  if fran = till then
    return new;
  end if;

  if (fran = 'ny' and till = 'intervju')
     or (fran = 'intervju' and till = 'ny')
     or (fran = 'intervju' and till = 'utbildning') then
    return new;
  end if;
  if fran = 'utbildning' and till = 'konto_skapat' then
    if genom_knappen then
      return new;
    end if;
    raise exception using errcode = '42501',
      message = 'En ansökan får sitt konto med Utbildning hållen, som skapar kontot och godkänner profilen.';
  end if;

  raise exception using errcode = '23514',
    message = format('Ansökan kan inte gå från %s till %s. Stegen är Ny, Intervju, Utbildning och Konto skapat, '
                     'i den ordningen, och bara Intervju går att ångra.',
                     namn ->> fran, namn ->> till);
end $function$;

revoke all on function intern.ansokan_steg_vakt() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.applications'::regclass
                  and tgname = 'applications_steg_vakt') then
    create trigger applications_steg_vakt
      before insert or update on public.applications
      for each row execute function intern.ansokan_steg_vakt();
  end if;
end $$;


-- ---------- 4. loggen över stegen ----------
create table if not exists public.ansokan_steg_logg (
  id          bigint generated always as identity primary key,
  ansokan_id  uuid not null references public.applications(id) on delete cascade,
  fran        text check (fran in ('ny', 'intervju', 'utbildning', 'konto_skapat')),
  till        text not null check (till in ('ny', 'intervju', 'utbildning', 'konto_skapat')),
  andrad_av   uuid references public.profiles(id) on delete set null,
  andrad_at   timestamptz not null default now()
);
create index if not exists ansokan_steg_logg_ansokan on public.ansokan_steg_logg (ansokan_id, andrad_at);

comment on table public.ansokan_steg_logg is
  '2026-10-22 (ansokningarnas_steg). En rad per steg en ansökan tagit: varifrån, vart, vem och när. Skrivs bara av '
  'databasen (intern.ansokan_steg_logga), ändras aldrig och följer med ansökan när den gallras. Bara superadmin läser.';

create or replace function intern.ansokan_steg_logga()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- ansokningarnas_steg (2026-10-22). Efter skrivningen: den genererade
-- kolumnen är räknad, och raden är den som sparades.
begin
  if tg_op = 'INSERT' then
    insert into public.ansokan_steg_logg (ansokan_id, fran, till, andrad_av)
    values (new.id, null, new.steg, auth.uid());
  elsif new.steg is distinct from old.steg then
    insert into public.ansokan_steg_logg (ansokan_id, fran, till, andrad_av)
    values (new.id, old.steg, new.steg, auth.uid());
  end if;
  return null;
end $function$;

revoke all on function intern.ansokan_steg_logga() from public, anon, authenticated;

-- Den inloggade som skrev raden kan sakna profil (anon skickar ansökan): då ingen.
create or replace function intern.ansokan_steg_logg_ny()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  if new.andrad_av is not null and not exists (select 1 from public.profiles p where p.id = new.andrad_av) then
    new.andrad_av := null;
  end if;
  new.andrad_at := now();
  return new;
end $function$;

revoke all on function intern.ansokan_steg_logg_ny() from public, anon, authenticated;

create or replace function intern.ansokan_steg_logg_star_fast()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
-- Loggen ändras aldrig. Den raderas bara med sin ansökan (kaskaden körs av
-- en referenstrigger, alltså ett steg djupare än en radering för hand).
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception using errcode = '42501',
    message = 'Loggen över ansökningarnas steg ändras aldrig. Den följer med ansökan när den gallras.';
end $function$;

revoke all on function intern.ansokan_steg_logg_star_fast() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.applications'::regclass
                  and tgname = 'applications_steg_logg') then
    create trigger applications_steg_logg
      after insert or update on public.applications
      for each row execute function intern.ansokan_steg_logga();
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.ansokan_steg_logg'::regclass
                  and tgname = 'ansokan_steg_logg_ny') then
    create trigger ansokan_steg_logg_ny
      before insert on public.ansokan_steg_logg
      for each row execute function intern.ansokan_steg_logg_ny();
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.ansokan_steg_logg'::regclass
                  and tgname = 'ansokan_steg_logg_star_fast') then
    create trigger ansokan_steg_logg_star_fast
      before update or delete on public.ansokan_steg_logg
      for each row execute function intern.ansokan_steg_logg_star_fast();
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.ansokan_steg_logg'::regclass
                  and tgname = 'ansokan_steg_logg_toms_aldrig') then
    create trigger ansokan_steg_logg_toms_aldrig
      before truncate on public.ansokan_steg_logg
      for each statement execute function intern.ansokan_steg_logg_star_fast();
  end if;
end $$;

alter table public.ansokan_steg_logg enable row level security;
revoke all on public.ansokan_steg_logg from anon, authenticated;
grant select on public.ansokan_steg_logg to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nextrum_barn') then
    execute 'revoke all on public.ansokan_steg_logg from nextrum_barn';
  end if;
  if exists (select 1 from pg_roles where rolname = 'nextrum_ai') then
    execute 'revoke all on public.ansokan_steg_logg from nextrum_ai';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ansokan_steg_logg'
                  and policyname = 'admin läser ansökningarnas steg') then
    create policy "admin läser ansökningarnas steg" on public.ansokan_steg_logg for select to authenticated
      using ((select public.is_admin()));
  end if;
end $$;

-- Ansökningarna som finns: kontot för dem som redan tagits in, och ett
-- första steg i loggen. Kontot är det godkända studiehjälparkonto som har
-- ansökans adress, för den senaste ansökan med den adressen (en adress
-- kan ha sökt två gånger, och ett konto hör till en ansökan).
with kandidat as (
  select distinct on (p.id) a.id as ansokan, p.id as konto
    from public.applications a
    join public.profiles p
      on intern.epost_nyckel(p.email) = intern.epost_nyckel(a.email)
     and intern.epost_nyckel(a.email) <> ''
    join public.tutor_profiles t on t.id = p.id and t.status = 'approved'
   where a.status = 'approved' and a.konto_id is null and p.role = 'tutor'
   order by p.id, a.created_at desc
)
update public.applications a
   set konto_id = k.konto
  from kandidat k
 where a.id = k.ansokan
   and not exists (select 1 from public.applications x where x.konto_id = k.konto);

insert into public.ansokan_steg_logg (ansokan_id, fran, till, andrad_at)
select a.id, null, a.steg,
       coalesce(case a.steg
                  when 'intervju' then a.till_intervju_at
                  when 'utbildning' then coalesce(a.intervju_at, a.utbildningsmote_at, a.utbildad_at)
                  when 'konto_skapat' then coalesce(a.utbildad_at, a.intervju_at, a.till_intervju_at)
                end, a.created_at)
  from public.applications a
 where not exists (select 1 from public.ansokan_steg_logg l where l.ansokan_id = a.id);


-- ---------- 5. Skicka intervjulänk igen ----------
create or replace function public.ansokan_intervjulank_igen(p_ansokan uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- ansokningarnas_steg (2026-10-22). Samma mejl som när hen skickades
-- vidare (ansokan_intervju, Leos text med länken till bokningssidan), köat
-- en gång till med en egen nyckel. Kön prövar läget igen när det går.
declare
  a public.applications%rowtype;
  senast timestamptz;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara admin skickar mejl till den som sökt.';
  end if;

  select * into a from public.applications x where x.id = p_ansokan for update;
  if not found then
    return jsonb_build_object('ok', false, 'fel', 'Ansökan finns inte.');
  end if;
  if a.status = 'rejected' then
    return jsonb_build_object('ok', false, 'fel', 'Ansökan är avböjd.');
  end if;
  if a.steg is distinct from 'intervju' then
    return jsonb_build_object('ok', false, 'fel', 'Länken skickas bara medan hen står i Intervju.');
  end if;
  if nullif(btrim(coalesce(a.email, '')), '') is null then
    return jsonb_build_object('ok', false, 'fel', 'Ansökan saknar e-postadress.');
  end if;

  -- Två tryck, eller två flikar, blir ett mejl.
  select max(q.skapad) into senast
    from public.notis_utskick q
   where q.ansokan_id = a.id and q.typ = 'ansokan_intervju'
     and q.status in ('vantar', 'skickar', 'skickad', 'loggad');
  if senast is not null and senast > now() - interval '10 minutes' then
    return jsonb_build_object('ok', false, 'fel', 'Länken mejlades för mindre än tio minuter sedan.');
  end if;

  insert into public.notis_utskick (ansokan_id, kanal, typ, data, idempotens, skicka_efter)
  values (a.id, 'mejl', 'ansokan_intervju', '{}'::jsonb,
          'ansokan_intervju:' || a.id::text || ':igen:' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
          now());

  return jsonb_build_object('ok', true);
end $function$;

revoke all on function public.ansokan_intervjulank_igen(uuid) from public, anon;
grant execute on function public.ansokan_intervjulank_igen(uuid) to authenticated;

comment on function public.ansokan_intervjulank_igen(uuid) is
  '2026-10-22 (ansokningarnas_steg). Skicka intervjulänk igen: köar intervjumejlet en gång till, högst en gång i tio '
  'minuter och bara medan ansökan står i Intervju. Bara superadmin.';


-- ---------- 6. Utbildning hållen ----------
create or replace function public.ansokan_utbildning_hallen(
  p_ansokan uuid, p_konto uuid, p_timpenning numeric, p_amnen text[], p_ort text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- ansokningarnas_steg (2026-10-22). Kontot skapas före, av bjud-in med
-- adressen i ansökan (eller finns redan med den adressen). Här kopplas det,
-- profilen godkänns med uppgifterna ur ansökan, och ansökan blir utbildad
-- och Godkänd, i samma transaktion. Samma konto igen gör ingenting, och
-- ett annat konto nekas: en ansökan, ett konto.
declare
  a          public.applications%rowtype;
  p          public.profiles%rowtype;
  v_amnen    text[];
  v_tjanster text[];
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara admin tar in en studiehjälpare.';
  end if;

  select * into a from public.applications x where x.id = p_ansokan for update;
  if not found then
    return jsonb_build_object('ok', false, 'fel', 'Ansökan finns inte.');
  end if;
  if a.konto_id = p_konto then
    return jsonb_build_object('ok', true, 'redan', true, 'konto', p_konto);
  end if;
  if a.konto_id is not null then
    return jsonb_build_object('ok', false, 'fel', 'Ansökan har redan ett konto. En ansökan blir ett konto.');
  end if;
  if a.status = 'rejected' then
    return jsonb_build_object('ok', false, 'fel', 'Ansökan är avböjd.');
  end if;
  if a.steg is distinct from 'utbildning' then
    return jsonb_build_object('ok', false, 'fel', 'Hen står inte i Utbildning. Skicka vidare dit först.');
  end if;
  if p_timpenning is null or p_timpenning < 1 or p_timpenning > 2000 then
    return jsonb_build_object('ok', false, 'fel', 'Fyll i timpenningen i kronor.');
  end if;

  select * into p from public.profiles x where x.id = p_konto;
  if not found or p.raderad_at is not null then
    return jsonb_build_object('ok', false, 'fel', 'Kontot finns inte.');
  end if;
  if p.role is distinct from 'tutor' then
    return jsonb_build_object('ok', false, 'fel', 'Kontot är inte ett studiehjälparkonto.');
  end if;
  if intern.epost_nyckel(p.email) = '' or intern.epost_nyckel(p.email) <> intern.epost_nyckel(a.email) then
    return jsonb_build_object('ok', false, 'fel',
      'Kontot har en annan adress än ansökan. Rätta adressen i ansökan om hen bytt, så kopplas rätt konto.');
  end if;
  if exists (select 1 from public.applications x where x.konto_id = p_konto) then
    return jsonb_build_object('ok', false, 'fel', 'Kontot hör redan till en annan ansökan.');
  end if;

  select array_agg(btrim(x)) into v_amnen
    from unnest(coalesce(p_amnen, '{}'::text[])) as x
   where btrim(x) <> '';
  select coalesce(
           (select array_agg(k) from unnest(coalesce(a.tjanster, '{}'::text[])) as k
             where exists (select 1 from public.tjanster t where t.kod = k and t.aktiv and t.for_jobb)),
           (select array[t.kod] from public.tjanster t where t.aktiv and t.for_jobb
             order by coalesce(t.ordning, 100), t.kod limit 1))
    into v_tjanster;

  -- Vakterna på ansökan släpper igenom kontot och steget för just den här
  -- ansökan, i den här transaktionen.
  perform set_config('nextrum.ansokan_konto', a.id::text, true);

  update public.tutor_profiles t
     set status = 'approved',
         subjects = v_amnen,
         city = nullif(btrim(coalesce(p_ort, '')), ''),
         school = a.school,
         age = a.age,
         availability = a.availability,
         hourly_rate = round(p_timpenning),
         tjanster = v_tjanster
   where t.id = p_konto;
  if not found then
    perform set_config('nextrum.ansokan_konto', '', true);
    return jsonb_build_object('ok', false, 'fel', 'Kontot har ingen studiehjälparprofil.');
  end if;

  update public.applications x
     set konto_id = p_konto,
         utbildad_at = coalesce(x.utbildad_at, now()),
         status = 'approved'
   where x.id = a.id;

  perform set_config('nextrum.ansokan_konto', '', true);
  return jsonb_build_object('ok', true, 'redan', false, 'konto', p_konto);
end $function$;

revoke all on function public.ansokan_utbildning_hallen(uuid, uuid, numeric, text[], text) from public, anon;
grant execute on function public.ansokan_utbildning_hallen(uuid, uuid, numeric, text[], text) to authenticated;

comment on function public.ansokan_utbildning_hallen(uuid, uuid, numeric, text[], text) is
  '2026-10-22 (ansokningarnas_steg). Utbildning hållen: kopplar studiehjälparkontot (samma adress som ansökan) till '
  'ansökan, godkänner profilen och sätter utbildad och Godkänd. En ansökan blir ett konto; samma konto igen gör '
  'ingenting. Kontot skapas före, av bjud-in. Bara superadmin.';


-- ---------- 7. kön skickar intervjumejlet bara i Intervju ----------
do $$
declare
  def  text;
  fore constant text := '      elsif an.till_intervju_at is null then';
  ny   constant text := '      -- ansokningarnas_steg (2026-10-22): bara medan hen står i Intervju.' || chr(10)
                     || '      elsif an.till_intervju_at is null or an.steg is distinct from ''intervju'' then';
  n integer;
begin
  def := pg_get_functiondef('public.notis_utskick_ta(integer)'::regprocedure);
  if position('ansokningarnas_steg' in def) > 0 then
    return;
  end if;
  n := (char_length(def) - char_length(replace(def, fore, ''))) / char_length(fore);
  if n <> 1 then
    raise exception 'notis_utskick_ta: villkoret för intervjumejlet träffade % ställen, inte ett.', n;
  end if;
  execute replace(def, fore, ny);
end $$;
