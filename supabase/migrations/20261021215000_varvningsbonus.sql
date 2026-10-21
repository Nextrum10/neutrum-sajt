-- ============================================================
-- Värvningsbonusen (2026-10-21)
--
-- Leo: "en studiehjälpare som värvar en kompis får en bonus på 300 kr
-- brutto, inklusive semesterersättning, när kompisen har fått sitt
-- studiehjälparkonto. Systemet betalar INGENTING ut. Det registrerar och
-- visar bonusen som underlag för Leos utbetalning."
--
-- DET HÄR FANNS REDAN, och byggs vidare på, inte bredvid: studiehjälparens
-- tipskod (tipskoder, sort 'studiehjalpare') gäller jobbansökan
-- (applications.kod, prövad av intern.ansokan_tipskod), och den vars kod
-- en ny studiehjälpare sökte med fick 300 kr i lönen när vi tog in hen
-- (tipsbonus, 2026-10-13). En andra tabell för samma bonus hade gett två
-- bonusar för samma kompis. Därför:
--   - "Värvningskoden" är studiehjälparens tipskod. Den skapas nu av sig
--     själv när någon blir godkänd i poolen, och en ny kod har åtta tecken
--     ur gen_random_bytes (svårgissad). Koden gäller bara medan ägaren är
--     godkänd, som förut.
--   - Kopplingen står på ansökan: kod (koden, "varvad_av_kod_id") och
--     varvad_av_profil_id (värvaren), satta av databasen när ansökan
--     kommer in. Bara admin ändrar dem.
--   - varvningsbonus ersätter tipsbonus för nya bonusar: en rad när ansökan
--     kommer in (vantar), intjänad en gång när händelsen inträffar, med
--     beloppet delat i grundersättning och semesterersättning, och läget
--     vantar → intjanad|annullerad, intjanad → utbetald|annullerad.
--     Raden raderas aldrig. tipsbonus får inga nya rader; det som står där
--     flyttas hit (tipsbonus_id) och står kvar som historik.
--
-- DET SOM GÅR ATT STÄLLA står på ett ställe, varvning_installning, med
-- beställningens namn: VARVNINGSBONUS_BRUTTO_KR (brutto_ore),
-- SEMESTERERSATTNING_PROCENT (semester_procent) och VARVNINGSBONUS_TRIGGER
-- (utlosare: konto_skapat, prov_godkant eller forsta_pass_genomfort). En
-- ändring där rör aldrig en intjänad rad: beloppet och delningen är
-- ögonblicksbilder.
--
-- MISSBRUKET: ingen bonus för sin egen kod (adressen och kontot), högst en
-- bonus per person (en HMAC av den normaliserade adressen, unik över alla
-- bonusar), den som sökt förut eller hade ett konto när hen sökte räknas
-- inte som ny (raden skrivs som annullerad med skälet), och värvaren ska
-- vara godkänd och aktiv när bonusen tjänas in. Flaggan tipsbonus stänger
-- av erbjudandet, som förut.
--
-- Ingen drop och inget delete. Funktionerna som skrivs om prövas mot sin
-- md5 i driften (som de byggs ur migrationerna), och en som redan bär
-- ändringen släpps igenom, så filen går att köra två gånger.
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 0. driften är som den lästes ----------
do $$
declare
  f text;
  r record;
begin
  for r in select * from (values
      ('public.mina_tips()', 'd32f225f179ab3d51ba529586fbd19aa'),
      ('intern.tipsbonus_vid_intag()', '8fc3b6a9333409bd9c49c84ed3a281c6'),
      ('intern.ansokan_tipskod()', '56f8070db92853622464d5cf42eab566'),
      ('intern.ny_tipskod(uuid,text)', 'a50b0e66e9d0097f16dca60982a86b46'),
      ('intern.tipsbonus_ore()', '47beafaa7045899c791355e9c2e425a3'),
      ('public.koder_lage(text)', '41c48521de91a3cf7f89a6ffec326d62')) v(namn, summa)
  loop
    select prosrc into f from pg_proc where oid = r.namn::regprocedure;
    if md5(f) <> r.summa and position('varvningsbonus' in f) = 0 then
      raise exception '% är inte den som lästes 2026-10-21 (md5 %). Läs driften och skriv om migrationen.', r.namn, md5(f);
    end if;
  end loop;
end $$;


-- ---------- 1. inställningarna ----------
create table if not exists public.varvning_installning (
  id                smallint primary key default 1 check (id = 1),
  -- VARVNINGSBONUS_BRUTTO_KR, i ören: bonusen inklusive semesterersättning.
  brutto_ore        integer not null default 30000 check (brutto_ore between 100 and 1000000),
  -- SEMESTERERSATTNING_PROCENT: delen av bruttot som är semesterersättning.
  semester_procent  numeric(5,2) not null default 12 check (semester_procent between 0 and 50),
  -- VARVNINGSBONUS_TRIGGER: när bonusen tjänas in.
  utlosare          text not null default 'konto_skapat'
                    check (utlosare in ('konto_skapat', 'prov_godkant', 'forsta_pass_genomfort')),
  uppdaterad        timestamptz not null default now()
);

insert into public.varvning_installning (id) values (1) on conflict (id) do nothing;

comment on table public.varvning_installning is
  '2026-10-21 (varvningsbonus). Värvningsbonusens belopp, semesterersättningens del och händelsen som tjänar in den. '
  'Ändras med SQL; en intjänad bonus behåller sitt belopp och sin delning. Ändras beloppet eller händelsen ska '
  'villkoren för tips (#tips) ändras samtidigt.';

create or replace function intern.varvning_installning_stampel()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
-- varvningsbonus (2026-10-21).
begin
  new.uppdaterad := now();
  return new;
end $function$;

revoke all on function intern.varvning_installning_stampel() from public, anon, authenticated;

create or replace trigger varvning_installning_stampel
  before update on public.varvning_installning
  for each row execute function intern.varvning_installning_stampel();

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'varvning_installning_audit'
                   and tgrelid = 'public.varvning_installning'::regclass) then
    create trigger varvning_installning_audit
      after insert or update on public.varvning_installning
      for each row execute function public.logga_andring('varvning_installning', 'id', 'brutto_ore', 'semester_procent', 'utlosare');
  end if;
end $$;

-- Beloppet läses härifrån (förut en fast siffra i funktionen).
create or replace function intern.tipsbonus_ore()
 returns integer
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  -- varvningsbonus (2026-10-21): beloppet står i varvning_installning.
  select v.brutto_ore from public.varvning_installning v where v.id = 1
$function$;

revoke all on function intern.tipsbonus_ore() from public, anon, authenticated;


-- ---------- 2. koden: svårgissad, och av sig själv ----------
/* Personens kod, skapad om den saknas. Samma alfabet som förut (32 tecken,
   utan I, O, 0 och 1: koden skrivs av och sägs i telefon), men slumpen ur
   gen_random_bytes i stället för random(), och en studiehjälpares kod har
   åtta tecken: den ger en bonus och prövas av vem som helst i jobbansökan.
   Koder som redan finns står kvar. */
create or replace function intern.ny_tipskod(p_person uuid, p_sort text)
 returns public.tipskoder
 language plpgsql
 volatile
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
-- varvningsbonus (2026-10-21): slumpen ur gen_random_bytes, och åtta tecken för en studiehjälpare.
declare
  alfabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  langd   integer := case when p_sort = 'studiehjalpare' then 8 else 6 end;
  k       public.tipskoder;
  ny      text;
  b       bytea;
  forsok  integer := 0;
begin
  select * into k from public.tipskoder where person_id = p_person;
  if found then
    return k;
  end if;
  loop
    b := extensions.gen_random_bytes(langd);
    ny := '';
    for i in 0..langd - 1 loop
      -- 256 är delbart med 32, så varje tecken är lika troligt.
      ny := ny || substr(alfabet, 1 + (get_byte(b, i) % 32), 1);
    end loop;
    begin
      insert into public.tipskoder (kod, sort, person_id) values (ny, p_sort, p_person) returning * into k;
      return k;
    exception when unique_violation then
      -- Samma kod fanns, eller ett annat anrop hann skapa personens.
      select * into k from public.tipskoder where person_id = p_person;
      if found then
        return k;
      end if;
      forsok := forsok + 1;
      if forsok > 20 then
        raise;
      end if;
    end;
  end loop;
end $function$;

revoke all on function intern.ny_tipskod(uuid, text) from public, anon, authenticated;


-- ---------- 3. kopplingen på ansökan ----------
alter table public.applications
  add column if not exists varvad_av_profil_id uuid references public.profiles(id) on delete set null;

create index if not exists applications_varvad_av_idx
  on public.applications (varvad_av_profil_id) where varvad_av_profil_id is not null;

comment on column public.applications.varvad_av_profil_id is
  '2026-10-21 (varvningsbonus). Studiehjälparen vars kod ansökan kom in med: ägaren till applications.kod när '
  'ansökan skickades. Sätts av intern.ansokan_tipskod, aldrig av den som söker; bara admin ändrar koden, och '
  'värvaren följer den. Gallras med ansökan.';

/* Koden i jobbansökan. Den som söker skickar bara texten: en okänd kod,
   en familjs eller kampanjs, eller en kod vars ägare inte är godkänd blir
   null, och ansökan går in ändå. Värvaren sätts här, ur koden, och vad
   den sökande skickat i den kolumnen räknas inte. Efteråt ändrar bara
   admin koden (och värvaren följer den); databasens egna vägar, som en
   kaskad när en kod eller ett konto tas bort, går igenom. */
create or replace function intern.ansokan_tipskod()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
-- varvningsbonus (2026-10-21): värvaren följer koden, och bara admin ändrar dem.
declare
  ren text;
begin
  if tg_op = 'UPDATE' then
    if (new.kod is distinct from old.kod or new.varvad_av_profil_id is distinct from old.varvad_av_profil_id)
       and auth.uid() is not null and not public.is_admin() then
      raise exception using errcode = '42501', message = 'Koden i en ansökan ändrar bara Nextrum.';
    end if;
    if new.kod is not null then
      ren := upper(regexp_replace(new.kod, '[[:space:]]', '', 'g'));
      new.kod := case when ren ~ '^[A-Z0-9][A-Z0-9-]{2,23}$' then ren end;
      if new.kod is distinct from old.kod and new.kod is not null
         and not exists (select 1 from public.tipskoder t where t.kod = new.kod and t.sort = 'studiehjalpare') then
        raise exception using errcode = '23514',
          message = 'Bara en studiehjälpares kod gäller jobbansökan.';
      end if;
    end if;
    -- En intjänad eller utbetald bonus följer inte med ett byte: den
    -- annulleras först (en utbetald står fast). Databasens egna vägar går igenom.
    if new.kod is distinct from old.kod and auth.uid() is not null
       and exists (select 1 from public.varvningsbonus x
                    where x.varvad_ansokan_id = new.id and x.status in ('intjanad', 'utbetald')) then
      raise exception using errcode = '23514',
        message = 'Bonusen för ansökan är redan intjänad. Annullera den under Värvningsbonus innan koden ändras.';
    end if;
    if new.kod is distinct from old.kod then
      new.varvad_av_profil_id := (select t.person_id from public.tipskoder t
                                   where t.kod = new.kod and t.sort = 'studiehjalpare');
    elsif new.varvad_av_profil_id is distinct from old.varvad_av_profil_id and new.varvad_av_profil_id is not null
          and new.varvad_av_profil_id is distinct from (select t.person_id from public.tipskoder t
                                                         where t.kod = new.kod and t.sort = 'studiehjalpare') then
      -- Till null går för sig (ett konto som tas bort), och till kodens ägare;
      -- en annan värvare kommer med en annan kod.
      raise exception using errcode = '23514', message = 'Värvaren följer koden. Ändra koden i stället.';
    end if;
    return new;
  end if;

  new.varvad_av_profil_id := null;
  if new.kod is null then
    return new;
  end if;
  ren := upper(regexp_replace(new.kod, '[[:space:]]', '', 'g'));
  -- En studiehjälpare som är godkänd i poolen, med en kod som inte är
  -- avstängd. Läget läses här: ar_godkand_studiehjalpare() svarar nej
  -- för en anonym anropare.
  if ren !~ '^[A-Z0-9][A-Z0-9-]{2,23}$'
     or not exists (select 1 from public.tipskoder t
                      join public.tutor_profiles tp on tp.id = t.person_id
                      join public.profiles p on p.id = t.person_id
                     where t.kod = ren and t.aktiv and t.sort = 'studiehjalpare'
                       and tp.status = 'approved' and p.raderad_at is null) then
    new.kod := null;
  else
    new.kod := ren;
    new.varvad_av_profil_id := (select t.person_id from public.tipskoder t where t.kod = ren);
  end if;
  return new;
end $function$;

revoke all on function intern.ansokan_tipskod() from public, anon, authenticated;

-- Namnet gör att den kör efter applications_skydda (namnordning). Värvaren
-- är med i listan, så att en ändring av bara den också prövas.
create or replace trigger applications_tipskod
  before insert or update of kod, varvad_av_profil_id on public.applications
  for each row execute function intern.ansokan_tipskod();


-- ---------- 4. bonusen ----------
create table if not exists public.varvningsbonus (
  id                      uuid primary key default gen_random_uuid(),
  -- Den vars kod användes, och som får bonusen. Raderas aldrig: kontot
  -- avidentifieras i stället (raden är lön).
  varvare_profil_id       uuid not null references public.profiles(id) on delete restrict,
  -- Ansökan den kom ur. Blir null när ansökan gallras; raden står kvar.
  varvad_ansokan_id       uuid references public.applications(id) on delete set null,
  -- Kontot ansökan blev, satt när kontot kopplas.
  varvad_profil_id        uuid references public.profiles(id) on delete set null,
  -- HMAC av den värvades normaliserade adress: en intjänad bonus per
  -- person, över alla bonusar, också efter att ansökan gallrats. Aldrig
  -- adressen.
  varvad_epost_hmac       text not null,
  -- Ögonblicksbilder: bruttot när raden skrevs, delningen när den tjänades in.
  brutto_ore              integer not null check (brutto_ore > 0),
  semester_procent        numeric(5,2),
  grundersattning_ore     integer,
  semesterersattning_ore  integer,
  -- Händelsen som tjänade in den (varvning_installning.utlosare då), eller
  -- tipsbonus för en bonus som flyttades hit.
  utlosare                text check (utlosare is null
                                      or utlosare in ('konto_skapat', 'prov_godkant', 'forsta_pass_genomfort', 'tipsbonus')),
  status                  text not null default 'vantar'
                          check (status in ('vantar', 'intjanad', 'utbetald', 'annullerad')),
  skapad_at               timestamptz not null default now(),
  intjanad_at             timestamptz,
  utbetald_at             timestamptz,
  -- Lönemånaden den betalades i, ÅÅÅÅ-MM.
  utbetald_period         text check (utbetald_period is null or utbetald_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  annullerad_at           timestamptz,
  annullerad_orsak        text check (annullerad_orsak is null or char_length(btrim(annullerad_orsak)) between 3 and 500),
  -- Vem av oss som markerade utbetald eller annullerade. Null: databasen.
  andrad_av               uuid,
  -- En bonus som flyttades från tipsbonus (2026-10-21).
  tipsbonus_id            uuid unique,
  constraint varvningsbonus_inte_egen check (varvad_profil_id is distinct from varvare_profil_id),
  constraint varvningsbonus_delning check (
    (grundersattning_ore is null and semesterersattning_ore is null)
    or (grundersattning_ore >= 0 and semesterersattning_ore >= 0
        and grundersattning_ore + semesterersattning_ore = brutto_ore)),
  constraint varvningsbonus_intjanad check (
    status not in ('intjanad', 'utbetald')
    or (intjanad_at is not null and grundersattning_ore is not null and semester_procent is not null and utlosare is not null)),
  constraint varvningsbonus_utbetald check ((status = 'utbetald') = (utbetald_at is not null and utbetald_period is not null)),
  constraint varvningsbonus_annullerad check ((status = 'annullerad') = (annullerad_at is not null and annullerad_orsak is not null))
);

-- En levande rad (inte annullerad) per ansökan och per konto, och en
-- intjänad eller utbetald per person. En annullerad rad spärrar inget: den
-- betalas aldrig, och skälet står på den. Så kan en ansökan som någon annan
-- skickat in med en kompis adress aldrig låsa kompisens bonus.
create unique index if not exists varvningsbonus_en_per_ansokan
  on public.varvningsbonus (varvad_ansokan_id) where varvad_ansokan_id is not null and status <> 'annullerad';
create unique index if not exists varvningsbonus_en_per_konto
  on public.varvningsbonus (varvad_profil_id) where varvad_profil_id is not null and status <> 'annullerad';
create unique index if not exists varvningsbonus_en_per_person
  on public.varvningsbonus (varvad_epost_hmac) where status in ('intjanad', 'utbetald');
create index if not exists varvningsbonus_person on public.varvningsbonus (varvad_epost_hmac);
create index if not exists varvningsbonus_varvare on public.varvningsbonus (varvare_profil_id, status);

comment on table public.varvningsbonus is
  '2026-10-21 (varvningsbonus). En rad per ansökan med en studiehjälpares kod: vantar när ansökan kommer in, '
  'intjanad en gång när händelsen i varvning_installning inträffar, utbetald när admin markerat den med lönemånaden, '
  'annullerad med ett skäl. Skrivs bara av databasen och admins två funktioner; raderas aldrig. Underlag för lönen, '
  'inget betalas ut härifrån.';

/* Lägena och det som står fast. vantar → intjanad|annullerad, intjanad →
   utbetald|annullerad; utbetald och annullerad är slutgiltiga. Vem bonusen
   gäller, bruttot och delningen ändras aldrig; ansökan och kontot bara
   till null (gallring och radering), och kontot kopplas en gång. */
create or replace function intern.varvningsbonus_vakt()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
-- varvningsbonus (2026-10-21).
begin
  -- Ansökan gallras eller tas bort innan bonusen tjänats in (nyckeln blir
  -- null genom främmande nyckeln): den kan inte längre bli ett konto.
  if old.status = 'vantar' and new.status = 'vantar' and old.varvad_ansokan_id is not null
     and new.varvad_ansokan_id is null and pg_trigger_depth() > 1 then
    new.status := 'annullerad';
    new.annullerad_at := now();
    new.annullerad_orsak := 'Ansökan gallrades eller togs bort innan bonusen tjänades in.';
  end if;
  if new.id is distinct from old.id
     or new.varvare_profil_id is distinct from old.varvare_profil_id
     or new.varvad_epost_hmac is distinct from old.varvad_epost_hmac
     or new.brutto_ore is distinct from old.brutto_ore
     or new.skapad_at is distinct from old.skapad_at
     or new.tipsbonus_id is distinct from old.tipsbonus_id then
    raise exception using errcode = '42501', message = 'Vem bonusen gäller och beloppet står fast.';
  end if;
  if new.varvad_ansokan_id is distinct from old.varvad_ansokan_id and new.varvad_ansokan_id is not null then
    raise exception using errcode = '42501', message = 'Ansökan en bonus kom ur byts inte.';
  end if;
  if new.varvad_profil_id is distinct from old.varvad_profil_id and new.varvad_profil_id is not null
     and (old.varvad_profil_id is not null or old.status <> 'vantar') then
    raise exception using errcode = '42501', message = 'Kontot en bonus gäller kopplas en gång.';
  end if;
  if old.grundersattning_ore is not null
     and (new.grundersattning_ore is distinct from old.grundersattning_ore
          or new.semesterersattning_ore is distinct from old.semesterersattning_ore
          or new.semester_procent is distinct from old.semester_procent) then
    raise exception using errcode = '42501', message = 'Delningen av en intjänad bonus står fast.';
  end if;
  if (old.intjanad_at is not null and new.intjanad_at is distinct from old.intjanad_at)
     or (old.utlosare is not null and new.utlosare is distinct from old.utlosare) then
    raise exception using errcode = '42501', message = 'När och hur en bonus tjänades in står fast.';
  end if;

  if new.status is distinct from old.status then
    if not ((old.status = 'vantar' and new.status in ('intjanad', 'annullerad'))
            or (old.status = 'intjanad' and new.status in ('utbetald', 'annullerad'))) then
      raise exception using errcode = '23514',
        message = format('En värvningsbonus går inte från %s till %s.', old.status, new.status);
    end if;
    if new.status = 'intjanad' and new.varvad_profil_id is null then
      raise exception using errcode = '23514', message = 'En bonus tjänas in för ett konto.';
    end if;
  elsif new.utbetald_at is distinct from old.utbetald_at
        or new.utbetald_period is distinct from old.utbetald_period
        or new.annullerad_at is distinct from old.annullerad_at
        or new.annullerad_orsak is distinct from old.annullerad_orsak
        or new.andrad_av is distinct from old.andrad_av then
    raise exception using errcode = '23514', message = 'Utbetald och annullerad sätts när läget byts.';
  end if;

  if old.status in ('utbetald', 'annullerad')
     and (to_jsonb(new) - 'varvad_ansokan_id' - 'varvad_profil_id')
         is distinct from (to_jsonb(old) - 'varvad_ansokan_id' - 'varvad_profil_id') then
    raise exception using errcode = '23514', message = 'En utbetald eller annullerad bonus ändras inte.';
  end if;
  return new;
end $function$;

revoke all on function intern.varvningsbonus_vakt() from public, anon, authenticated;

create or replace trigger varvningsbonus_vakt
  before update on public.varvningsbonus
  for each row execute function intern.varvningsbonus_vakt();

/* En ny rad börjar som väntande, eller annullerad med skälet; intjänad
   blir den bara genom intern.varvning_prova. Bara flytten ur tipsbonus
   (tipsbonus_id) tar med sitt läge. */
create or replace function intern.varvningsbonus_ny()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
-- varvningsbonus (2026-10-21).
begin
  if new.tipsbonus_id is null
     and (new.status not in ('vantar', 'annullerad') or new.grundersattning_ore is not null
          or new.intjanad_at is not null or new.utbetald_at is not null) then
    raise exception using errcode = '23514',
      message = 'En värvningsbonus börjar som väntande; den tjänas in av databasen.';
  end if;
  return new;
end $function$;

revoke all on function intern.varvningsbonus_ny() from public, anon, authenticated;

create or replace trigger varvningsbonus_ny
  before insert on public.varvningsbonus
  for each row execute function intern.varvningsbonus_ny();

create or replace function intern.varvningsbonus_raderas_aldrig()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
-- varvningsbonus (2026-10-21): bonusen är underlag för lönen och raderas aldrig.
begin
  raise exception using errcode = '42501', message = 'En värvningsbonus raderas aldrig. Annullera den med ett skäl.';
end $function$;

revoke all on function intern.varvningsbonus_raderas_aldrig() from public, anon, authenticated;

create or replace trigger varvningsbonus_raderas_aldrig
  before delete on public.varvningsbonus
  for each row execute function intern.varvningsbonus_raderas_aldrig();
create or replace trigger varvningsbonus_toms_aldrig
  before truncate on public.varvningsbonus
  for each statement execute function intern.varvningsbonus_raderas_aldrig();

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'varvningsbonus_audit'
                   and tgrelid = 'public.varvningsbonus'::regclass) then
    -- Aldrig skälet: det är fritext.
    create trigger varvningsbonus_audit
      after insert or update on public.varvningsbonus
      for each row execute function public.logga_andring('varvningsbonus', 'id', 'varvare_profil_id', 'varvad_profil_id',
        'varvad_ansokan_id', 'status', 'brutto_ore', 'grundersattning_ore', 'semesterersattning_ore', 'utbetald_period',
        'utlosare', 'andrad_av');
  end if;
end $$;


-- ---------- 5. vem som är ny ----------
/* Adressen som den räknas för en person i värvningen: som
   intern.epost_nyckel (gemener, utan +tagg), och för Gmail utan punkter
   före @ och med googlemail.com som gmail.com, för där är kim.kompis och
   kimkompis samma brevlåda. Bara värvningen räknar så; resten av
   databasen jämför adresser som förut. */
create or replace function intern.varvning_epost_nyckel(p_epost text)
 returns text
 language sql
 immutable
 set search_path to ''
as $function$
  select case when split_part(x.k, '@', 2) in ('gmail.com', 'googlemail.com')
              then replace(split_part(x.k, '@', 1), '.', '') || '@gmail.com'
              else x.k end
    from (select intern.epost_nyckel(p_epost) as k) x
$function$;

revoke all on function intern.varvning_epost_nyckel(text) from public, anon, authenticated;

/* HMAC av adressen så som den räknas för en person, med
   notiskonfigurationens nyckel (samma som rabattkodernas försök). Null för
   en tom adress. Byts nyckeln räknas en tidigare värvad som ny: byt den
   inte. */
create or replace function intern.varvning_epost_hmac(p_epost text)
 returns text
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select case when intern.varvning_epost_nyckel(p_epost) = '' then null else coalesce(
    (select encode(extensions.hmac(convert_to('varvning:v1:' || intern.varvning_epost_nyckel(p_epost), 'UTF8'),
                                   decode(k.barn_nyckel, 'base64'), 'sha256'), 'base64')
       from public.notis_konfig k where k.id = 1 and k.barn_nyckel is not null),
    encode(extensions.digest(convert_to('varvning:v1:' || intern.varvning_epost_nyckel(p_epost), 'UTF8'), 'sha256'),
           'base64'))
  end
$function$;

revoke all on function intern.varvning_epost_hmac(text) from public, anon, authenticated;


-- ---------- 6. intjänandet ----------
/* Kontot en bonus gäller: det som kopplats, annars det ansökan blev
   (konto_id, Utbildning hållen), annars en studiehjälpare med ansökans
   adress (godkänd i poolen utan Utbildning hållen, som före 2026-10-21).
   Att det är rätt ansökans konto prövar intern.varvning_prova. */
create or replace function intern.varvning_kontot(p_bonus uuid)
 returns uuid
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select coalesce(v.varvad_profil_id, a.konto_id,
           (select p.id from public.profiles p join public.tutor_profiles t on t.id = p.id
             where intern.varvning_epost_nyckel(p.email) = intern.varvning_epost_nyckel(a.email)
               and intern.varvning_epost_nyckel(a.email) <> ''
               and p.raderad_at is null
             order by p.created_at limit 1))
    from public.varvningsbonus v
    left join public.applications a on a.id = v.varvad_ansokan_id
   where v.id = p_bonus
$function$;

revoke all on function intern.varvning_kontot(uuid) from public, anon, authenticated;

/* Pröva en väntande bonus. Den följer ansökan som blev kontot, och
   personen ska vara ny: det prövas här, när kontot finns och med kontots
   adress, för adressen i ansökan kan ha rättats sedan raden skrevs (en
   ansökan som avböjts, en annan ansökan som blev kontot, ett konto som
   fanns före ansökan eller en tidigare ansökan ger ingen bonus). Sedan
   kopplas kontot, och bonusen tjänas in om händelsen i inställningen har
   inträffat, med värvaren godkänd och flaggan tipsbonus på. Exakt en
   gång: bara en rad i vantar ändras, under radlås. Ett nej annullerar
   raden med skälet. Svarar läget efteråt. */
create or replace function intern.varvning_prova(p_bonus uuid)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- varvningsbonus (2026-10-21).
declare
  v      public.varvningsbonus%rowtype;
  a      public.applications%rowtype;
  inst   public.varvning_installning%rowtype;
  konto  uuid;
  knyck  text;
  vnyck  text;
  skett  boolean;
  orsak  text;
  grund  integer;
  data   jsonb;
begin
  select * into v from public.varvningsbonus x where x.id = p_bonus for update;
  if not found or v.status <> 'vantar' then
    return coalesce(v.status, 'saknas');
  end if;
  konto := intern.varvning_kontot(p_bonus);
  if konto is null then
    return 'vantar';
  end if;
  select * into a from public.applications x where x.id = v.varvad_ansokan_id;
  knyck := intern.varvning_epost_nyckel((select p.email from public.profiles p where p.id = konto));
  vnyck := intern.varvning_epost_nyckel((select p.email from public.profiles p where p.id = v.varvare_profil_id));

  orsak := case
    when a.id is null
      then 'Ansökan finns inte längre.'
    when exists (select 1 from public.applications x where x.konto_id = konto and x.id <> a.id)
      then 'En annan ansökan från samma person blev kontot.'
    when a.status = 'rejected'
      then 'Ansökan avböjdes.'
    when konto = v.varvare_profil_id or (knyck <> '' and knyck = vnyck)
      then 'Egen kod: kontot är värvarens eget.'
    when (select p.created_at from public.profiles p where p.id = konto) < a.created_at
      then 'Hade redan ett konto hos oss när ansökan kom in, och räknas inte som ny.'
    when exists (select 1 from public.applications x
                  where x.id <> a.id and (x.created_at, x.id) < (a.created_at, a.id)
                    and (x.konto_id = konto
                         or (knyck <> '' and intern.varvning_epost_nyckel(x.email) = knyck)
                         or intern.varvning_epost_nyckel(x.email) = intern.varvning_epost_nyckel(a.email)))
      then 'Har sökt förut, och räknas inte som ny.'
    when exists (select 1 from public.varvningsbonus x
                  where x.id <> v.id and x.status in ('intjanad', 'utbetald')
                    and (x.varvad_profil_id = konto
                         or x.varvad_epost_hmac in (v.varvad_epost_hmac, coalesce(intern.varvning_epost_hmac(knyck), ''))))
      then 'Personen har redan gett en bonus.'
    end;
  if orsak is not null then
    update public.varvningsbonus x set status = 'annullerad', annullerad_at = now(), annullerad_orsak = orsak
     where x.id = v.id;
    return 'annullerad';
  end if;

  -- Det här är rätt ansökans rad. En annan väntande rad som kopplats till
  -- kontot (en annan ansökan med samma adress) är inaktuell.
  if v.varvad_profil_id is null then
    update public.varvningsbonus x
       set status = 'annullerad', annullerad_at = now(),
           annullerad_orsak = 'En annan ansökan från samma person blev kontot.'
     where x.varvad_profil_id = konto and x.status = 'vantar' and x.id <> v.id;
    update public.varvningsbonus x set varvad_profil_id = konto where x.id = v.id;
  end if;

  select * into inst from public.varvning_installning where id = 1;
  skett := case inst.utlosare
    when 'konto_skapat' then
      exists (select 1 from public.tutor_profiles t join public.profiles p on p.id = t.id
               where t.id = konto and t.status = 'approved' and p.raderad_at is null)
      or a.konto_id = konto
    when 'prov_godkant' then
      exists (select 1 from public.prov_studiehjalpare s where s.id = konto and s.utbildningsprov_godkant_at is not null)
    when 'forsta_pass_genomfort' then
      exists (select 1 from public.lesson_reports r where r.tutor_id = konto and r.booking_id is not null)
    else false end;
  if not coalesce(skett, false) then
    return 'vantar';
  end if;

  orsak := case
    when not coalesce((select f.aktiv from public.flaggor f where f.kod = 'tipsbonus'), false)
      then 'Bonusen för tips var avstängd när den skulle tjänas in.'
    when not exists (select 1 from public.tutor_profiles t join public.profiles p on p.id = t.id
                      where t.id = v.varvare_profil_id and t.status = 'approved' and p.raderad_at is null)
      then 'Värvaren var inte godkänd och aktiv när bonusen skulle tjänas in.'
    end;
  if orsak is not null then
    update public.varvningsbonus x set status = 'annullerad', annullerad_at = now(), annullerad_orsak = orsak
     where x.id = v.id;
    return 'annullerad';
  end if;

  -- Grund = bruttot delat med 1 + procenten, avrundat; semestern är resten,
  -- så att summan alltid är exakt bruttot.
  grund := round(v.brutto_ore / (1 + inst.semester_procent / 100))::integer;
  update public.varvningsbonus x
     set status = 'intjanad', intjanad_at = now(), semester_procent = inst.semester_procent,
         grundersattning_ore = grund, semesterersattning_ore = v.brutto_ore - grund, utlosare = inst.utlosare
   where x.id = v.id;

  -- Mejlet till värvaren: bara beloppet och att den hanteras enligt villkoren.
  begin
    data := jsonb_build_object('belopp', v.brutto_ore);
    insert into public.notiser (mottagare, typ, trad_tutor, data)
    values (v.varvare_profil_id, 'varvningsbonus', v.varvare_profil_id, data);
    if public.notis_vill(v.varvare_profil_id, 'varvningsbonus', 'mejl') then
      perform intern.notis_koa(v.varvare_profil_id, 'mejl', 'varvningsbonus', null, null, v.varvare_profil_id, data, null,
        'varvningsbonus:mejl:' || v.id, now(), null);
    end if;
  exception when others then
    -- Ett mejl som inte gick att köa får aldrig ta bonusen med sig.
    insert into public.notis_fel (kalla, fel) values ('varvningsbonus ' || v.id, left(sqlerrm, 500));
  end;
  return 'intjanad';
end $function$;

revoke all on function intern.varvning_prova(uuid) from public, anon, authenticated;

/* Pröva alla väntande bonusar för ett konto: de som kopplats till det,
   den vars ansökan blev det, och de vars ansökan har kontots adress. Den
   ansökan som blev kontot prövas först, så att dess rad vinner. */
create or replace function intern.varvning_prova_konto(p_konto uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- varvningsbonus (2026-10-21).
declare
  id_ uuid;
  ep  text := (select intern.varvning_epost_nyckel(p.email) from public.profiles p where p.id = p_konto);
begin
  for id_ in
    select v.id from public.varvningsbonus v
      left join public.applications a on a.id = v.varvad_ansokan_id
     where v.status = 'vantar'
       and (v.varvad_profil_id = p_konto
            or (v.varvad_profil_id is null
                and (a.konto_id = p_konto or (coalesce(ep, '') <> '' and intern.varvning_epost_nyckel(a.email) = ep))))
     order by (a.konto_id is not distinct from p_konto) desc, v.skapad_at, v.id
  loop
    perform intern.varvning_prova(id_);
  end loop;
end $function$;

revoke all on function intern.varvning_prova_konto(uuid) from public, anon, authenticated;


-- ---------- 7. raden när ansökan kommer in ----------
/* En ansökan med en giltig kod ger en rad: vantar om den som söker är ny,
   annars annullerad med skälet, så att beslutet syns. Ingen rad när
   flaggan tipsbonus står av. Byter admin koden annulleras den väntande
   raden för den förra värvaren och en ny skrivs för den nya, och den
   prövas direkt, för kontot kan redan finnas; en intjänad rad hindrar
   bytet (intern.ansokan_tipskod). Triggern går på kod också: värvaren
   sätts av en BEFORE-trigger, och en UPDATE OF ser bara kolumnerna i
   själva UPDATE:n. */
create or replace function intern.varvning_skapa()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- varvningsbonus (2026-10-21).
declare
  nyckel text := intern.varvning_epost_nyckel(new.email);
  h      text;
  orsak  text;
  id_    uuid;
begin
  if tg_op = 'UPDATE' then
    if new.varvad_av_profil_id is not distinct from old.varvad_av_profil_id then
      return null;
    end if;
    update public.varvningsbonus x
       set status = 'annullerad', annullerad_at = now(),
           annullerad_orsak = case when new.varvad_av_profil_id is null then 'Koden togs bort ur ansökan.'
                                   else 'Koden i ansökan byttes.' end
     where x.varvad_ansokan_id = new.id and x.status = 'vantar';
  end if;
  if new.varvad_av_profil_id is null then
    return null;
  end if;
  if not coalesce((select f.aktiv from public.flaggor f where f.kod = 'tipsbonus'), false) then
    return null;
  end if;
  h := intern.varvning_epost_hmac(new.email);
  if h is null then
    return null;
  end if;

  orsak := case
    when intern.varvning_epost_nyckel((select p.email from public.profiles p where p.id = new.varvad_av_profil_id)) = nyckel
      then 'Egen kod: den som sökte äger koden.'
    when exists (select 1 from public.applications a
                  where a.id <> new.id and intern.varvning_epost_nyckel(a.email) = nyckel
                    and (a.created_at, a.id) < (new.created_at, new.id))
      then 'Har sökt förut, och räknas inte som ny.'
    when exists (select 1 from public.profiles p
                  where intern.varvning_epost_nyckel(p.email) = nyckel and p.created_at < new.created_at)
      then 'Hade redan ett konto hos oss när ansökan kom in, och räknas inte som ny.'
    when exists (select 1 from public.varvningsbonus v
                  where v.varvad_epost_hmac = h and v.status in ('intjanad', 'utbetald'))
      then 'Personen har redan gett en bonus.'
    end;

  insert into public.varvningsbonus (varvare_profil_id, varvad_ansokan_id, varvad_epost_hmac, brutto_ore,
                                     status, annullerad_at, annullerad_orsak)
  values (new.varvad_av_profil_id, new.id, h, intern.tipsbonus_ore(),
          case when orsak is null then 'vantar' else 'annullerad' end,
          case when orsak is null then null else now() end, orsak)
  on conflict do nothing
  returning id into id_;
  if id_ is not null and orsak is null and tg_op = 'UPDATE' then
    perform intern.varvning_prova(id_);
  end if;
  return null;
end $function$;

revoke all on function intern.varvning_skapa() from public, anon, authenticated;

create or replace trigger applications_varvning
  after insert or update of kod, varvad_av_profil_id on public.applications
  for each row execute function intern.varvning_skapa();


-- ---------- 8. händelserna ----------
-- Kontot kopplas till ansökan (Utbildning hållen, ansokningarnas_steg).
create or replace function intern.varvning_konto_kopplat()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- varvningsbonus (2026-10-21).
begin
  if new.konto_id is not null and new.konto_id is distinct from old.konto_id then
    perform intern.varvning_prova_konto(new.konto_id);
  end if;
  return null;
end $function$;

revoke all on function intern.varvning_konto_kopplat() from public, anon, authenticated;

create or replace trigger applications_varvning_konto
  after update of konto_id on public.applications
  for each row execute function intern.varvning_konto_kopplat();

/* Den som blir godkänd i poolen: koden skapas (aldrig åt en admin), och
   bonusen för den som värvat hen prövas. Triggern tutor_profiles_tipsbonus
   står kvar och kallar den här; tipsbonus får inga nya rader. */
create or replace function intern.tipsbonus_vid_intag()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
-- varvningsbonus (2026-10-21): koden skapas och värvningsbonusen prövas; tipsbonus får inga nya rader.
begin
  if exists (select 1 from public.profiles p where p.id = new.id and p.raderad_at is null)
     and not exists (select 1 from public.admin_roller r where r.user_id = new.id)
     and not coalesce((select p.is_admin from public.profiles p where p.id = new.id), false) then
    perform intern.ny_tipskod(new.id, 'studiehjalpare');
  end if;
  perform intern.varvning_prova_konto(new.id);
  return null;
end $function$;

revoke all on function intern.tipsbonus_vid_intag() from public, anon, authenticated;

-- Utbildningsprovet godkänt (VARVNINGSBONUS_TRIGGER = prov_godkant).
create or replace function intern.varvning_prov_godkant()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- varvningsbonus (2026-10-21).
begin
  if new.utbildningsprov_godkant_at is not null
     and (tg_op = 'INSERT' or old.utbildningsprov_godkant_at is null) then
    perform intern.varvning_prova_konto(new.id);
  end if;
  return null;
end $function$;

revoke all on function intern.varvning_prov_godkant() from public, anon, authenticated;

create or replace trigger prov_studiehjalpare_varvning
  after insert or update of utbildningsprov_godkant_at on public.prov_studiehjalpare
  for each row execute function intern.varvning_prov_godkant();

-- Första passet genomfört (VARVNINGSBONUS_TRIGGER = forsta_pass_genomfort):
-- passet är genomfört när rapporten finns.
create or replace function intern.varvning_rapport()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- varvningsbonus (2026-10-21).
begin
  if new.booking_id is not null
     and exists (select 1 from public.varvningsbonus v where v.status = 'vantar'
                  and (v.varvad_profil_id = new.tutor_id or v.varvad_profil_id is null)) then
    perform intern.varvning_prova_konto(new.tutor_id);
  end if;
  return null;
end $function$;

revoke all on function intern.varvning_rapport() from public, anon, authenticated;

create or replace trigger lesson_reports_varvning
  after insert on public.lesson_reports
  for each row execute function intern.varvning_rapport();

-- Händelsen i inställningen byts: de väntande prövas mot den nya direkt, i
-- stället för först när något händer kompisen igen. Beloppet på en väntande
-- rad står fast (det fryses när raden skrivs).
create or replace function intern.varvning_installning_andrad()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- varvningsbonus (2026-10-21).
declare
  id_ uuid;
begin
  if new.utlosare is distinct from old.utlosare then
    for id_ in select v.id from public.varvningsbonus v where v.status = 'vantar' order by v.skapad_at, v.id loop
      perform intern.varvning_prova(id_);
    end loop;
  end if;
  return null;
end $function$;

revoke all on function intern.varvning_installning_andrad() from public, anon, authenticated;

create or replace trigger varvning_installning_andrad
  after update of utlosare on public.varvning_installning
  for each row execute function intern.varvning_installning_andrad();


-- ---------- 9. admins två knappar ----------
/* Markera utbetald: de intjänade bland raderna, med lönemånaden. Svarar
   hur många som markerades. Bara superadmin. */
create or replace function public.varvningsbonus_utbetald(p_ids uuid[], p_period text)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- varvningsbonus (2026-10-21).
declare
  n integer;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara admin markerar en bonus som utbetald.';
  end if;
  if p_period is null or p_period !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception using errcode = '22023', message = 'Skriv lönemånaden som ÅÅÅÅ-MM.';
  end if;
  update public.varvningsbonus v
     set status = 'utbetald', utbetald_at = now(), utbetald_period = p_period, andrad_av = auth.uid()
   where v.id = any (coalesce(p_ids, '{}')) and v.status = 'intjanad';
  get diagnostics n = row_count;
  return n;
end $function$;

revoke all on function public.varvningsbonus_utbetald(uuid[], text) from public, anon;
grant execute on function public.varvningsbonus_utbetald(uuid[], text) to authenticated;

/* Annullera: en väntande eller intjänad bonus, med skälet. Svarar
   'annullerad', 'redan' eller 'utbetald' (som inte går). Bara superadmin. */
create or replace function public.varvningsbonus_annullera(p_id uuid, p_orsak text)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- varvningsbonus (2026-10-21).
declare
  v public.varvningsbonus%rowtype;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara admin annullerar en bonus.';
  end if;
  if p_orsak is null or char_length(btrim(p_orsak)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'Skriv skälet, 3–500 tecken.';
  end if;
  select * into v from public.varvningsbonus x where x.id = p_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'Bonusen finns inte.';
  end if;
  if v.status = 'annullerad' then
    return 'redan';
  end if;
  if v.status = 'utbetald' then
    return 'utbetald';
  end if;
  update public.varvningsbonus x
     set status = 'annullerad', annullerad_at = now(), annullerad_orsak = btrim(p_orsak), andrad_av = auth.uid()
   where x.id = p_id;
  return 'annullerad';
end $function$;

revoke all on function public.varvningsbonus_annullera(uuid, text) from public, anon;
grant execute on function public.varvningsbonus_annullera(uuid, text) to authenticated;


-- ---------- 10. studiehjälparens kod och värvade ----------
/* mina_tips skrivs om i sin helhet. Familjens del är ordagrant som förut;
   studiehjälparens läser värvningsbonusen: summorna, inställningen och en
   lista med bara läget och dagarna, och förnamnet först när kontot finns.
   Inget om ansökan, ingen adress, och inga annullerade. */
create or replace function public.mina_tips()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
-- varvningsbonus (2026-10-21): studiehjälparens del läser varvningsbonus.
declare
  jag     uuid := auth.uid();
  p       public.profiles;
  k       public.tipskoder;
  s       text;
  timmar  integer;
  anvanda integer;
  inst    public.varvning_installning%rowtype;
begin
  if jag is null then
    raise exception 'Logga in först.' using errcode = '42501';
  end if;

  select * into p from public.profiles where id = jag;
  if not found or p.raderad_at is not null then
    raise exception 'Kontot finns inte.' using errcode = '42501';
  end if;

  if p.role = 'parent' then
    s := 'familj';
  elsif p.role = 'tutor' and public.ar_godkand_studiehjalpare(jag) then
    s := 'studiehjalpare';
  else
    raise exception 'Bara familjer och godkända studiehjälpare har en kod.' using errcode = '42501';
  end if;

  k := intern.ny_tipskod(jag, s);

  if k.sort = 'familj' then
    timmar := intern.tipstimmar_intjanade(jag);
    anvanda := intern.tipstimmar_anvanda(jag);
    return jsonb_build_object(
      'kod', k.kod,
      'sort', k.sort,
      'aktiv', k.aktiv,
      'anmalda', intern.anmalningar_med_kod(k.kod),
      'kunder', (select count(*) from intern.tipsade_familjer(k.kod)),
      'timmar', timmar,
      'anvanda', anvanda,
      -- gratistimmarna_60_dagar: bara de som gäller i dag, och sista dagen
      -- för den som gäller längst (priset vid knappen gäller en dag).
      'kvar', intern.tipstimmar_kvar(jag, null),
      'kvar_till', (select max(till) from intern.tipstimmar_oanvanda(jag) till
                     where till >= (now() at time zone 'Europe/Stockholm')::date),
      'timme_ges', coalesce((select f.aktiv from public.flaggor f where f.kod = 'tipstimme'), false)
    );
  end if;

  -- Studiehjälparen: koden gäller jobbansökan, och bonusen är lön.
  select * into inst from public.varvning_installning where id = 1;
  return jsonb_build_object(
    'kod', k.kod,
    'sort', k.sort,
    'aktiv', k.aktiv,
    'ansokningar', (select count(*) from public.applications a where a.kod = k.kod),
    'intagna', (select count(*) from public.varvningsbonus b
                 where b.varvare_profil_id = jag and b.status in ('intjanad', 'utbetald')),
    'bonus_ore', (select coalesce(sum(b.brutto_ore), 0) from public.varvningsbonus b
                   where b.varvare_profil_id = jag and b.status in ('intjanad', 'utbetald')),
    'bonus_utbetald_ore', (select coalesce(sum(b.brutto_ore), 0) from public.varvningsbonus b
                            where b.varvare_profil_id = jag and b.status = 'utbetald'),
    'bonus_ges', coalesce((select f.aktiv from public.flaggor f where f.kod = 'tipsbonus'), false),
    'bonus_belopp_ore', inst.brutto_ore,
    'semester_procent', inst.semester_procent,
    'utlosare', inst.utlosare,
    -- Bara läget och bonusens egna dagar, i Stockholms tid: aldrig när
    -- kompisen sökte, som är en uppgift ur ansökan.
    'varvningar', (select coalesce(jsonb_agg(jsonb_build_object(
                     'id', b.id,
                     'status', b.status,
                     'intjanad', (b.intjanad_at at time zone 'Europe/Stockholm')::date,
                     'utbetald', (b.utbetald_at at time zone 'Europe/Stockholm')::date,
                     'period', b.utbetald_period,
                     'belopp_ore', b.brutto_ore,
                     -- Förnamnet först när kontot finns, och bara det.
                     'fornamn', case when b.varvad_profil_id is not null then
                                  nullif(split_part(btrim(coalesce(
                                    (select x.full_name from public.profiles x
                                      where x.id = b.varvad_profil_id and x.raderad_at is null), '')), ' ', 1), '')
                                end)
                     order by b.skapad_at desc, b.id), '[]'::jsonb)
                     from public.varvningsbonus b
                    where b.varvare_profil_id = jag and b.status <> 'annullerad'
                      and not (b.status = 'vantar'
                               and exists (select 1 from public.applications x
                                            where x.id = b.varvad_ansokan_id and x.status = 'rejected')))
  );
end $function$;

revoke all on function public.mina_tips() from public, anon;
grant execute on function public.mina_tips() to authenticated;


/* Koder i adminvyn skrivs om i sin helhet: studiehjälparnas tal läser
   varvningsbonus. Familjernas är ordagrant som förut. kunder och belonade
   är de intjänade och utbetalda bonusarna, bonus_ore deras summa. */
create or replace function public.koder_lage(p_sort text)
 returns table(person_id uuid, kod text, aktiv boolean, kod_skapad timestamp with time zone, anvanda integer,
               kunder integer, belonade integer, timmar_anvanda integer, bonus_ore bigint, bonus_utbetald_ore bigint)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
-- varvningsbonus (2026-10-21): studiehjälparnas tal läser varvningsbonus.
begin
  if not public.is_admin() then
    raise exception 'Bara admin.' using errcode = '42501';
  end if;
  if p_sort is null or p_sort not in ('familj', 'studiehjalpare') then
    raise exception 'Välj familjer eller studiehjälpare.' using errcode = '22023';
  end if;

  -- Allas kod: den som inte öppnat Tipsa i sin vy får sin kod nu, med
  -- samma form som mina_tips() hade gett den. Ett adminkonto har ofta
  -- rollen parent men är ingen familj, och får ingen kod härifrån.
  perform intern.ny_tipskod(p.id, p_sort)
     from public.profiles p
    where p.raderad_at is null
      and not intern.har_adminroll(p.id)
      and not exists (select 1 from public.tipskoder t where t.person_id = p.id)
      and case when p_sort = 'familj' then p.role = 'parent'
               else p.role = 'tutor'
                    and exists (select 1 from public.tutor_profiles tp where tp.id = p.id and tp.status = 'approved')
          end;

  -- Familjer: anvanda är anmälningarna med koden, kunder de nya familjer
  -- som blivit kunder, belonade de som haft två timmar (en timme var i
  -- timbanken). Studiehjälpare: anvanda är ansökningarna, kunder och
  -- belonade de vars bonus tjänats in (intjänad eller utbetald).
  return query
  select k.person_id, k.kod, k.aktiv, k.created_at,
         case when k.sort = 'familj'
              then intern.anmalningar_med_kod(k.kod)
              else (select count(*)::integer from public.applications a where a.kod = k.kod) end,
         case when k.sort = 'familj'
              then (select count(*)::integer from intern.tipsade_familjer(k.kod))
              else (select count(*)::integer from public.varvningsbonus b
                     where b.varvare_profil_id = k.person_id and b.status in ('intjanad', 'utbetald')) end,
         case when k.sort = 'familj'
              then (select count(*)::integer from intern.tipsade_familjer(k.kod) t
                     where intern.tva_timmar_hallna(t.kund_id) is not null)
              else (select count(*)::integer from public.varvningsbonus b
                     where b.varvare_profil_id = k.person_id and b.status in ('intjanad', 'utbetald')) end,
         case when k.sort = 'familj' then intern.tipstimmar_anvanda(k.person_id) end,
         case when k.sort = 'studiehjalpare'
              then (select coalesce(sum(b.brutto_ore), 0)::bigint from public.varvningsbonus b
                     where b.varvare_profil_id = k.person_id and b.status in ('intjanad', 'utbetald')) end,
         case when k.sort = 'studiehjalpare'
              then (select coalesce(sum(b.brutto_ore), 0)::bigint from public.varvningsbonus b
                     where b.varvare_profil_id = k.person_id and b.status = 'utbetald') end
    from public.tipskoder k
   where k.sort = p_sort
   order by k.created_at, k.kod;
end $function$;


-- ---------- 11. koden prövas i jobbansökan ----------
/* Formuläret frågar om koden gäller, så att den som söker får ett tydligt
   besked och fältet töms. Svaret säger bara gäller eller inte, aldrig
   vems. En okänd kod räknas mot ett tak per IP-nummer (en HMAC av det,
   ett dygn, som rabattkodernas försök): tio i timmen. Över taket svarar
   den 'for_manga', och ansökan går in ändå; databasen prövar koden igen. */
create or replace function public.prova_jobbkod(p_kod text)
 returns text
 language plpgsql
 volatile
 security definer
 set search_path to ''
as $function$
-- varvningsbonus (2026-10-21).
declare
  ren    text := upper(regexp_replace(coalesce(p_kod, ''), '[[:space:]]', '', 'g'));
  h      json;
  ip     text;
  nyckel text;
begin
  if ren = '' then
    return 'tom';
  end if;
  begin
    h := current_setting('request.headers', true)::json;
  exception when others then
    h := null;
  end;
  -- Cloudflares cf-connecting-ip går inte att skicka med själv genom
  -- Cloudflare; finns den inte, det första numret i x-forwarded-for, som
  -- barninloggningens räknare. Taket är ett hinder, inget skydd: koden
  -- prövas igen när ansökan kommer in.
  ip := coalesce(nullif(btrim(h ->> 'cf-connecting-ip'), ''),
                 nullif(btrim(split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1)), ''),
                 nullif(btrim(h ->> 'x-real-ip'), ''), 'okand');
  nyckel := 'jobbkod:' || coalesce(
    (select encode(extensions.hmac(convert_to('jobbkod-forsok:v1:' || ip, 'UTF8'),
                                   decode(k.barn_nyckel, 'base64'), 'sha256'), 'base64')
       from public.notis_konfig k where k.id = 1 and k.barn_nyckel is not null),
    encode(extensions.digest(convert_to('jobbkod-forsok:v1:' || ip, 'UTF8'), 'sha256'), 'base64'));
  -- Ett tak för alla tillsammans också, så att ett nytt nummer i varje anrop
  -- inte fyller tabellen: 500 okända koder i timmen.
  if intern.rabattkod_for_manga(nyckel)
     or (select count(*) from intern.rabattkod_forsok f
          where f.nyckel like 'jobbkod:%' and f.tid > now() - interval '1 hour') >= 500 then
    return 'for_manga';
  end if;
  if ren ~ '^[A-Z0-9][A-Z0-9-]{2,23}$'
     and exists (select 1 from public.tipskoder t
                   join public.tutor_profiles tp on tp.id = t.person_id
                   join public.profiles p on p.id = t.person_id
                  where t.kod = ren and t.aktiv and t.sort = 'studiehjalpare'
                    and tp.status = 'approved' and p.raderad_at is null) then
    return 'ok';
  end if;
  perform intern.rabattkod_forsok_notera(nyckel);
  return 'okand';
end $function$;

revoke all on function public.prova_jobbkod(text) from public;
grant execute on function public.prova_jobbkod(text) to anon, authenticated;


-- ---------- 12. det som redan finns ----------
-- Koder åt godkända studiehjälpare som saknar en (aldrig åt en admin).
do $$
declare
  id_ uuid;
begin
  for id_ in
    select t.id from public.tutor_profiles t join public.profiles p on p.id = t.id
     where t.status = 'approved' and p.raderad_at is null and not coalesce(p.is_admin, false)
       and not exists (select 1 from public.admin_roller r where r.user_id = t.id)
       and not exists (select 1 from public.tipskoder k where k.person_id = t.id)
  loop
    perform intern.ny_tipskod(id_, 'studiehjalpare');
  end loop;
end $$;

/* Bonusarna i tipsbonus flyttas hit, en gång (tipsbonus_id): utkast och
   godkänd blir intjänad, utbetald utbetald med sin period, struken
   annullerad. Delningen räknas med dagens procent. tipsbonus står kvar,
   orörd, som historik; inget skriver där längre. */
insert into public.varvningsbonus (varvare_profil_id, varvad_ansokan_id, varvad_profil_id, varvad_epost_hmac,
                                   brutto_ore, semester_procent, grundersattning_ore, semesterersattning_ore, utlosare,
                                   status, skapad_at, intjanad_at, utbetald_at, utbetald_period, annullerad_at,
                                   annullerad_orsak, tipsbonus_id)
select t.studiehjalpare_id,
       case when exists (select 1 from public.varvningsbonus v where v.varvad_ansokan_id = t.ansokan_id) then null
            else t.ansokan_id end,
       case when t.ny_studiehjalpare_id = t.studiehjalpare_id
              or exists (select 1 from public.varvningsbonus v where v.varvad_profil_id = t.ny_studiehjalpare_id) then null
            else t.ny_studiehjalpare_id end,
       coalesce(intern.varvning_epost_hmac((select a.email from public.applications a where a.id = t.ansokan_id)),
                intern.varvning_epost_hmac((select p.email from public.profiles p where p.id = t.ny_studiehjalpare_id)),
                'tipsbonus:' || t.id::text),
       t.belopp_ore, i.semester_procent,
       round(t.belopp_ore / (1 + i.semester_procent / 100))::integer,
       t.belopp_ore - round(t.belopp_ore / (1 + i.semester_procent / 100))::integer,
       'tipsbonus',
       case t.status when 'utbetald' then 'utbetald' when 'struken' then 'annullerad' else 'intjanad' end,
       t.created_at, t.intjanad_at,
       case when t.status = 'utbetald' then coalesce(t.utbetald_at, now()) end,
       case when t.status = 'utbetald' then to_char(t.period, 'YYYY-MM') end,
       case when t.status = 'struken' then now() end,
       case when t.status = 'struken' then 'Struken under Löner före 2026-10-21.' end,
       t.id
  from public.tipsbonus t
  cross join public.varvning_installning i
 where i.id = 1
   and not exists (select 1 from public.varvningsbonus v where v.tipsbonus_id = t.id)
on conflict do nothing;

-- Värvaren på ansökningar som redan bär en kod och är på väg (inte avböjda,
-- inte intagna): triggern skriver deras bonusrad, som förut hade skrivits
-- när de togs in. En som redan tagits in får ingen bonus i efterhand; den
-- fick sin i tipsbonus, eller ingen. Efter flytten, så att en ansökan som
-- redan har en bonus inte får en till.
update public.applications a
   set varvad_av_profil_id = k.person_id
  from public.tipskoder k
 where k.kod = a.kod and k.sort = 'studiehjalpare' and a.varvad_av_profil_id is null
   and a.status not in ('approved', 'rejected') and a.konto_id is null
   and not exists (select 1 from public.varvningsbonus v where v.varvad_ansokan_id = a.id);

comment on table public.tipsbonus is
  '2026-10-13 till 2026-10-21. Bonusen för tips, ersatt av varvningsbonus (varvningsbonus, 2026-10-21): raderna '
  'flyttades dit (varvningsbonus.tipsbonus_id), och inget skriver här längre. Står kvar som historik.';


-- ---------- 13. notisen ----------
-- Typen i båda listorna, och i _delad/notiser/typer.ts i samma ändring.
do $lapp$
declare
  namn    text;
  fore    text;
  gammal  text := $g$'tillagg_kvitto']$g$;
  ny      text := $n$'tillagg_kvitto', 'varvningsbonus']$n$;
  traffar integer;
begin
  foreach namn in array array['public.notis_typer()', 'public.notis_mejlbara()'] loop
    fore := pg_get_functiondef(namn::regprocedure);
    if position('''varvningsbonus''' in fore) > 0 then
      continue;
    end if;
    traffar := (length(fore) - length(replace(fore, gammal, ''))) / length(gammal);
    if traffar <> 1 then
      raise exception '%: listan slutar inte på tillagg_kvitto (% träffar). Kör syskontillagg_som_skuld först.', namn, traffar;
    end if;
    execute replace(fore, gammal, ny);
  end loop;
end $lapp$;


-- ---------- 14. raderingen ----------
/* En värvare med en intjänad bonus som inte är utbetald raderas inte, och
   en med en bonusrad alls avidentifieras i stället för att tas bort: raden
   är lön. Den värvade raderas som förut; raden tappar bara kontot. */
do $lapp$
declare
  fore    text;
  traffar integer;
  a1 text := $a$hinder := hinder || intern.radering_rad('tipsbonus', n, m);$a$;
  b1 text := $b$hinder := hinder || intern.radering_rad('tipsbonus', n, m);

    -- varvningsbonus (2026-10-21): en intjänad bonus som inte är utbetald.
    select count(*), coalesce(sum(t.brutto_ore), 0) into n, m from public.varvningsbonus t
     where t.varvare_profil_id = p_id and t.status = 'intjanad';
    hinder := hinder || intern.radering_rad('varvningsbonus', n, m);$b$;
  a2 text := $a$or exists (select 1 from public.tipsbonus t where t.studiehjalpare_id = p_id)$a$;
  b2 text := $b$or exists (select 1 from public.tipsbonus t where t.studiehjalpare_id = p_id)
       -- varvningsbonus (2026-10-21): raden raderas aldrig.
       or exists (select 1 from public.varvningsbonus t where t.varvare_profil_id = p_id)$b$;
  a3 text := $a$'tipsbonus', (select count(*) from public.tipsbonus t where t.studiehjalpare_id = p_id),$a$;
  b3 text := $b$'tipsbonus', (select count(*) from public.tipsbonus t where t.studiehjalpare_id = p_id),
        'varvningsbonus', (select count(*) from public.varvningsbonus t where t.varvare_profil_id = p_id),$b$;
begin
  fore := pg_get_functiondef('intern.radering_underlag(text,uuid)'::regprocedure);
  if position('varvningsbonus' in fore) > 0 then
    return;
  end if;
  traffar := (length(fore) - length(replace(fore, a1, ''))) / length(a1);
  if traffar <> 1 then
    raise exception 'radering_underlag: % träffar på tipsbonus-hindret. Läs driften.', traffar;
  end if;
  traffar := (length(fore) - length(replace(fore, a2, ''))) / length(a2);
  if traffar <> 1 then
    raise exception 'radering_underlag: % träffar på tipsbonus i avidentifieringen. Läs driften.', traffar;
  end if;
  traffar := (length(fore) - length(replace(fore, a3, ''))) / length(a3);
  if traffar <> 1 then
    raise exception 'radering_underlag: % träffar på tipsbonus i det som står kvar. Läs driften.', traffar;
  end if;
  execute replace(replace(replace(fore, a1, b1), a2, b2), a3, b3);
end $lapp$;


-- ---------- 15. rättigheter ----------
alter table public.varvning_installning enable row level security;
alter table public.varvningsbonus enable row level security;

revoke all on public.varvning_installning, public.varvningsbonus from anon, authenticated;
do $$
declare
  roll text;
begin
  foreach roll in array array['nextrum_barn', 'nextrum_ai'] loop
    if exists (select 1 from pg_roles where rolname = roll) then
      execute format('revoke all on public.varvning_installning, public.varvningsbonus from %I', roll);
    end if;
  end loop;
end $$;
grant select on public.varvning_installning, public.varvningsbonus to authenticated;
-- Inte heller tjänstekontot (edge-funktionerna) skriver i dem: bara
-- databasens egna funktioner, som körs som ägaren, och Leo med SQL.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    revoke insert, update, delete, truncate on public.varvning_installning, public.varvningsbonus from service_role;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'varvning_installning'
                   and policyname = 'inloggade läser värvningens inställning') then
    create policy "inloggade läser värvningens inställning" on public.varvning_installning
      for select to authenticated using (true);
  end if;
  -- Bara admin läser raderna. Värvaren ser sina genom mina_tips(), med bara
  -- läget och förnamnet, aldrig ansökan eller den värvades konto.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'varvningsbonus'
                   and policyname = 'admin läser värvningsbonusarna') then
    create policy "admin läser värvningsbonusarna" on public.varvningsbonus
      for select to authenticated using (public.is_admin());
  end if;
end $$;

comment on function public.varvningsbonus_utbetald(uuid[], text) is
  '2026-10-21 (varvningsbonus). Markera utbetald: de intjänade bonusarna med lönemånaden ÅÅÅÅ-MM. Bara superadmin.';
comment on function public.varvningsbonus_annullera(uuid, text) is
  '2026-10-21 (varvningsbonus). Annullera en väntande eller intjänad bonus med ett skäl. Bara superadmin.';
comment on function public.prova_jobbkod(text) is
  '2026-10-21 (varvningsbonus). Gäller koden i jobbansökan? ok, okand, tom eller for_manga (tio okända i timmen per '
  'IP-nummer). Säger aldrig vems koden är.';
