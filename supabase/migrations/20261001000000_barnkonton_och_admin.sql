-- ============================================================
-- NEXTRUM — barnkonton, och admin med behörigheter
--
-- Två saker i samma migration, för de delar ett grundantagande: vem
-- som är inloggad avgörs av databasen, aldrig av en vy.
--
--
-- DEL 1: BARNKONTON
--
-- Föräldern kan ge ett barn en egen inloggning. Barnet ser sina pass,
-- sin studieplan, sina timmar, sina notiser och (om föräldern slagit på
-- det) rapporterna. Inget annat: inga priser, ingen betalning, ingen
-- förälder, inga syskon, inga andra familjer.
--
-- BARNET ÄR EN EGEN DATABASROLL, nextrum_barn, inte authenticated.
-- Barnkontots auth.users.role är 'nextrum_barn', och GoTrue skriver den
-- i token; PostgREST, Storage och Realtime byter till den rollen. Rollen
-- har INGA tabellrättigheter, bara EXECUTE på tre funktioner. Varför:
--
--   · en restriktiv policy per tabell hade krävt en ny rad för varje ny
--     tabell, och den som glömde den hade öppnat tabellen för barnen.
--     En roll utan grants är stängd för framtida tabeller av sig själv,
--     eftersom Supabases förvalda rättigheter bara går till anon,
--     authenticated och service_role.
--   · två vyer går med flit förbi RLS (tutor_busy_slots och
--     blockerade_tider), och sex tabeller läses av "alla inloggade"
--     (priset, erbjudandena, tjänsterna, flaggorna, nivåerna och
--     notisinställningen). Som authenticated hade barnet nått alla.
--
-- Rollen sätts av triggern auth_barnkonto_skapas, inte av den som
-- skapar kontot: ett konto med app_metadata.roll = 'barn' får alltid
-- rollen nextrum_barn, och rollen följer med vid varje uppdatering.
-- Kräver att authenticator är medlem i rollen (grant nedan), annars
-- nekar PostgREST barnets anrop i stället för att släppa in dem.
--
-- BEHÖRIGHETEN LÄSES UR app_metadata, som bara service_role skriver.
-- user_metadata skriver användaren själv och används aldrig. Barnets
-- funktioner kräver att app_metadata och students.user_id säger samma
-- sak: rollen barn, barnet, föräldern och inloggningen.
--
-- INGEN PROFIL. handle_new_user hoppar över barnkonton. En rad i
-- profiles är vad varje policy frågar efter, och ett barn som hade haft
-- en hade varit en förälder utan barn.
--
-- LÖSENORD OCH E-POST ÄR LÅSTA i databasen (auth_barnkonto_las): e-post,
-- e-postbyte, återställning, bekräftelse, telefon och lösenord går inte
-- att ändra på ett barnkonto. Lösenordet är undantaget, och bara när
-- edge-funktionen barn-konto öppnat ett fönster i barn_andringsfonster
-- (60 sekunder, en gång) efter att ha prövat att anroparen är barnets
-- förälder. Fönstret släpper BARA igenom lösenordet: e-post och
-- återställning behövs aldrig för ett barn, och ett fönster som
-- släppte igenom dem hade kunnat användas av barnet självt under de
-- sekunderna. Inloggningen, förnyelsen och allt annat GoTrue skriver
-- (last_sign_in_at, banned_until, app_metadata.provider) går igenom.
--
-- OBS: GoTrue skickar återställningsmejlet INNAN det skriver token.
-- Låset hindrar alltså att en token sparas (länken fungerar aldrig),
-- men inte att GoTrue försöker skicka till <namn>@barn.nextrum.se.
-- barn.nextrum.se ska därför aldrig ha en brevlåda (null-MX i DNS).
-- Nextrums egna mejl (notis-ko) går aldrig dit: notis_utskick_ta och
-- ko.ts hoppar båda över barnkonton.
--
-- TIMBANKEN FÖR ETT BARN är barnets egna timmar: genomförda och bokade.
-- Köpta timmar (klippkort) och timbankens minuter finns, men de är
-- familjens köp, räknas i kronor och delas mellan syskonen. De visas
-- inte för barnet.
--
--
-- DEL 2: ADMIN MED BEHÖRIGHETER
--
-- admin_roller är sanningen. Två sorter: superadmin (allt, som alla
-- admins var förut) och en admin med en lista behörigheter.
--
-- is_admin() BETYDER FORTFARANDE FULL ADMIN, alltså superadmin. Det är
-- avsiktligt, och det är det som gör ändringen säker:
--
--   · de 190 policyerna och de SECURITY DEFINER-funktioner som frågar
--     is_admin() ger en begränsad admin ingenting, tills en policy här
--     uttryckligen släpper in behörigheten. Allt som inte står nedan
--     är stängt för en begränsad admin, också det som skrivs i morgon.
--     Hade is_admin() betytt "någon adminroll" hade varje behörighet
--     utom de uppräknade gett tillgång till betalningar, chattar,
--     löner och raderingar, och listan i adminvyn hade varit en lögn.
--   · profiles.is_admin är en SPEGEL av ar_superadmin. Edge-funktionerna
--     som ligger i drift läser kolumnen (kravAdmin i _delad/auth.ts), och
--     de fortsätter därmed att bara släppa in full admin, utan att
--     driftsättas om.
--   · receptet i CLAUDE.md, update public.profiles set is_admin = true,
--     fungerar i SQL och ger en superadmin. Från en vy nekas det:
--     behörigheter ändras bara med gor_till_admin och ta_bort_admin.
--
-- har_behorighet(x) är sann för en superadmin och för den som har x.
-- Reglerna för vem som får ändra vad står i triggern admin_roller_vakt,
-- inte i funktionerna, så att de gäller vilken väg skrivningen än tar.
-- Varje ändring skrivs i admin_logg av databasen.
--
-- Mappningen behörighet → data står i avsnitt 17 och i adminvyn
-- (nextrum-admin-behorighet.js), och de ska säga samma sak.
--
--
-- KÖRNING. Filen är skriven för att köras som en transaktion, som
-- apply_migration och verktyg/lokal-databas.sh (psql -1) gör; den
-- innehåller därför inget eget begin/commit, som ingen annan migration
-- gör. Den går att köra två gånger. Funktioner som skrivs om i sin
-- helhet har en vakt på sin md5 i main 2026-09-30, och de som lappas
-- har en vakt som räknar att texten hittades exakt en gång: har någon
-- annan ändrat dem i driften faller migrationen i stället för att
-- skriva över den andras ändring (CLAUDE.md avsnitt 5).
-- ============================================================


-- ------------------------------------------------------------
-- 1. Barnets roll
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'nextrum_barn') then
    create role nextrum_barn nologin noinherit;
  end if;
end $$;

grant nextrum_barn to authenticator;   -- PostgREST byter till rollen ur token
grant nextrum_barn to postgres;        -- set role i verktyg/rls-test.sql, som för anon
grant usage on schema public to nextrum_barn;
-- Samma tak som authenticated har i Supabase. Utan det kör ett anrop
-- från barnvyn utan tidsgräns.
alter role nextrum_barn set statement_timeout = '8s';

comment on role nextrum_barn is
  'Barnkontona (app_metadata.roll = barn). Inga tabellrättigheter; EXECUTE bara på barn_oversikt, '
  'barn_notiser och barn_markera_last. Sätts av triggern auth_barnkonto_skapas.';


-- ------------------------------------------------------------
-- 2. Adminrollerna och loggen
-- ------------------------------------------------------------
create table if not exists public.admin_roller (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  ar_superadmin boolean not null default false,
  behorigheter  text[] not null default '{}',
  skapad_av     uuid references auth.users(id) on delete set null,
  skapad_at     timestamptz not null default now(),
  andrad_at     timestamptz not null default now()
);

-- Listan står som en literal och inte som ett funktionsanrop: ett
-- CHECK-villkor körs som anroparen (CLAUDE.md avsnitt 6). Samma lista
-- står i intern.admin_behorigheter(); rls-test.sql prövar att de är lika.
alter table public.admin_roller drop constraint if exists admin_roller_behorigheter_kanda;
alter table public.admin_roller add constraint admin_roller_behorigheter_kanda
  check (behorigheter <@ array['leads', 'matchning', 'anvandare_las', 'anvandare_redigera',
                               'studiehjalpare_godkann', 'bokningar_las', 'rapporter_las',
                               'notiskonfig', 'admin_hantera']::text[]);
-- Att ändra användare utan att se dem går inte att göra i vyn, och
-- en behörighet som inte går att använda är en behörighet ingen förstår.
alter table public.admin_roller drop constraint if exists admin_roller_redigera_kraver_las;
alter table public.admin_roller add constraint admin_roller_redigera_kraver_las
  check (not ('anvandare_redigera' = any (behorigheter)) or 'anvandare_las' = any (behorigheter));
-- En admin utan behörigheter är ingen admin. Ta bort raden i stället.
alter table public.admin_roller drop constraint if exists admin_roller_nagot;
alter table public.admin_roller add constraint admin_roller_nagot
  check (ar_superadmin or cardinality(behorigheter) > 0);

comment on table public.admin_roller is
  'Vem som är admin, och med vilka behörigheter. Sanningen: profiles.is_admin speglar ar_superadmin. '
  'Skrivs bara av gor_till_admin, ta_bort_admin och SQL; reglerna står i triggern admin_roller_vakt.';

alter table public.admin_roller enable row level security;
revoke all on public.admin_roller from anon, authenticated, nextrum_barn;
grant select on public.admin_roller to authenticated;

create table if not exists public.admin_logg (
  id            bigint generated always as identity primary key,
  tid           timestamptz not null default now(),
  aktor         uuid,
  handling      text not null check (handling in ('skapad', 'andrad', 'borttagen')),
  mal_anvandare uuid not null,
  detaljer      jsonb not null default '{}'::jsonb
);
create index if not exists admin_logg_tid on public.admin_logg (tid desc);

-- Inget namn och ingen adress: aktören och personen är id:n, som i
-- auditloggen. Vyn slår upp namnen, och en borttagen person står kvar
-- som ett id i stället för att raderas ur historiken.
comment on table public.admin_logg is
  'Varje ny, ändrad och borttagen adminroll. Skrivs bara av triggern admin_roller_efter; går inte att '
  'ändra eller tömma, inte ens för admin. Läses av superadmin och den med admin_hantera.';

alter table public.admin_logg enable row level security;
revoke all on public.admin_logg from anon, authenticated, nextrum_barn;
grant select on public.admin_logg to authenticated;

create or replace function public.admin_logg_las()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  raise exception using errcode = '42501',
    message = 'Adminloggen går inte att ändra eller tömma.';
end $$;

drop trigger if exists admin_logg_las on public.admin_logg;
create trigger admin_logg_las
  before update or delete on public.admin_logg
  for each row execute function public.admin_logg_las();
drop trigger if exists admin_logg_las_tomning on public.admin_logg;
create trigger admin_logg_las_tomning
  before truncate on public.admin_logg
  for each statement execute function public.admin_logg_las();


-- ------------------------------------------------------------
-- 3. Frågorna: är den inloggade admin, och får hen det här?
-- ------------------------------------------------------------
create or replace function intern.admin_behorigheter()
returns text[]
language sql
immutable
set search_path to 'pg_catalog'
as $$
  select array['leads', 'matchning', 'anvandare_las', 'anvandare_redigera',
               'studiehjalpare_godkann', 'bokningar_las', 'rapporter_las',
               'notiskonfig', 'admin_hantera']::text[]
$$;

-- Någon adminroll alls. För auditloggens aktor_typ och raderingens
-- "ett adminkonto raderas inte här", inte för att släppa in någon.
create or replace function intern.har_adminroll(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select uid is not null and exists (select 1 from public.admin_roller r where r.user_id = uid)
$$;

-- Bara om den inloggade själv. Ingen parameter för en annan person:
-- en fråga om någon annans behörigheter är en fråga om en person
-- (CLAUDE.md avsnitt 6), och den behövs inte.
create or replace function public.har_behorighet(p_behorighet text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.admin_roller r
     where r.user_id = auth.uid()
       and (r.ar_superadmin or p_behorighet = any (r.behorigheter)))
$$;

create or replace function public.har_nagon_behorighet(p_lista text[])
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.admin_roller r
     where r.user_id = auth.uid()
       and (r.ar_superadmin or r.behorigheter && p_lista))
$$;

-- is_admin skrivs om: samma namn, samma signatur och samma vakt (bara
-- ens egen rad, eller vilken som helst för en superadmin), men läst ur
-- admin_roller. Full admin, som förut.
do $$
declare
  v text;
begin
  select md5(prosrc) into v from pg_proc where oid = 'public.is_admin(uuid)'::regprocedure;
  if v = '2347e30b3c32b78dd5103bb93671d5a4' then
    execute $f$
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $b$
  -- barnkonton_och_admin: sanningen är admin_roller, och is_admin är
  -- full admin (superadmin). En begränsad admin frågar har_behorighet.
  select coalesce((
    select r.ar_superadmin
    from public.admin_roller r
    where r.user_id = uid
      and (
        uid is not distinct from auth.uid()
        or exists (select 1 from public.admin_roller a
                    where a.user_id = auth.uid() and a.ar_superadmin)
      )
  ), false)
$b$;
$f$;
  elsif position('admin_roller' in (select prosrc from pg_proc where oid = 'public.is_admin(uuid)'::regprocedure)) > 0 then
    raise notice 'is_admin läser redan admin_roller, hoppar över.';
  else
    raise exception 'is_admin är inte den i main 2026-09-30 (md5 %). Läs driften och skriv om migrationen.', v;
  end if;
end $$;

create or replace function public.mina_behorigheter()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object(
    'admin', r.user_id is not null,
    'superadmin', coalesce(r.ar_superadmin, false),
    'behorigheter', to_jsonb(case when r.ar_superadmin then intern.admin_behorigheter()
                                  else coalesce(r.behorigheter, '{}'::text[]) end))
  from (select 1) x
  left join public.admin_roller r on r.user_id = auth.uid()
$$;


-- ------------------------------------------------------------
-- 4. Vakten, loggen och spegeln
-- ------------------------------------------------------------

-- Reglerna, på ett ställe och för varje väg in. En inloggad som
-- skriver här har gått genom gor_till_admin eller ta_bort_admin (det
-- finns ingen skrivpolicy), men reglerna står här och inte där, så att
-- en framtida väg inte kan glömma dem. SQL och systemet (auth.uid() är
-- null) går förbi reglerna om vem, men aldrig förbi barnspärren eller
-- den sista superadminen.
create or replace function intern.admin_roller_vakt()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  jag   uuid := auth.uid();
  mal   uuid := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  jag_roll   public.admin_roller%rowtype;
  andra integer;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
      raise exception using errcode = '42501', message = 'En adminroll byter inte person.';
    end if;

    -- En superadmin har allt; en lista bredvid säger ingenting.
    new.behorigheter := case when new.ar_superadmin then '{}'::text[]
      else (select coalesce(array_agg(distinct b order by b), '{}'::text[])
              from unnest(coalesce(new.behorigheter, '{}'::text[])) b) end;

    if tg_op = 'INSERT' then
      new.skapad_at := now();
      new.andrad_at := now();
      new.skapad_av := coalesce(jag, new.skapad_av);
    else
      new.skapad_at := old.skapad_at;
      new.andrad_at := now();
      -- Den som skapade rollen står kvar, utom när hen själv tas bort.
      new.skapad_av := case when new.skapad_av is null then null else old.skapad_av end;
    end if;

    if exists (select 1 from auth.users u
                where u.id = new.user_id and (u.raw_app_meta_data ->> 'roll') = 'barn') then
      raise exception using errcode = '42501', message = 'Ett barnkonto kan aldrig bli admin.';
    end if;
  end if;

  if jag is not null then
    if jag = mal then
      raise exception using errcode = '42501', message = 'Du kan inte ändra dina egna adminbehörigheter.';
    end if;

    select * into jag_roll from public.admin_roller where user_id = jag;
    if not found or not (jag_roll.ar_superadmin or 'admin_hantera' = any (jag_roll.behorigheter)) then
      raise exception using errcode = '42501',
        message = 'Bara en superadmin eller den som får hantera admins kan ändra adminbehörigheter.';
    end if;

    if not jag_roll.ar_superadmin then
      if tg_op in ('INSERT', 'UPDATE') and new.ar_superadmin then
        raise exception using errcode = '42501', message = 'Bara en superadmin kan göra någon till superadmin.';
      end if;
      if tg_op in ('UPDATE', 'DELETE') and old.ar_superadmin then
        raise exception using errcode = '42501', message = 'Bara en superadmin kan ändra eller ta bort en superadmin.';
      end if;
      if tg_op in ('INSERT', 'UPDATE') and not (new.behorigheter <@ jag_roll.behorigheter) then
        raise exception using errcode = '42501', message = 'Du kan inte ge en behörighet du inte har själv.';
      end if;
      -- Den som har mer än man själv ändras av en superadmin. Annars
      -- kunde den med admin_hantera och lite annat ta bort det som en
      -- annan admin behöver, i ett område hen inte själv har.
      if tg_op in ('UPDATE', 'DELETE') and not (old.behorigheter <@ jag_roll.behorigheter) then
        raise exception using errcode = '42501',
          message = 'Personen har behörigheter du inte har, och ändras bara av en superadmin.';
      end if;
    end if;
  end if;

  -- Den sista superadminen. Låset först: två som nedgraderar var sin
  -- superadmin samtidigt ska inte båda se den andra som kvar.
  if (tg_op = 'DELETE' and old.ar_superadmin)
     or (tg_op = 'UPDATE' and old.ar_superadmin and not new.ar_superadmin) then
    perform 1 from public.admin_roller r where r.ar_superadmin for update;
    select count(*) into andra from public.admin_roller r
     where r.ar_superadmin and r.user_id <> old.user_id;
    if andra = 0 then
      raise exception using errcode = '42501',
        message = 'Den sista superadminen kan inte tas bort eller nedgraderas. Gör någon annan till superadmin först.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

drop trigger if exists admin_roller_vakt on public.admin_roller;
create trigger admin_roller_vakt
  before insert or update or delete on public.admin_roller
  for each row execute function intern.admin_roller_vakt();

create or replace function intern.admin_roller_efter()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  mal uuid := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  f   jsonb;
  e   jsonb;
begin
  -- Spegeln. Uppdateringen skriver ingenting själv: profiles_spegel_admin
  -- räknar om kolumnen ur admin_roller. Hoppas över när ändringen kom
  -- från profilen (receptet i SQL), för då skrivs raden redan.
  if coalesce(current_setting('nextrum.admin_fran_profil', true), '') <> 'på' then
    update public.profiles set is_admin = is_admin where id = mal;
  end if;

  if tg_op = 'UPDATE' and new.ar_superadmin = old.ar_superadmin
     and new.behorigheter = old.behorigheter then
    return null;
  end if;

  if tg_op <> 'INSERT' then
    f := jsonb_build_object('superadmin', old.ar_superadmin, 'behorigheter', to_jsonb(old.behorigheter));
  end if;
  if tg_op <> 'DELETE' then
    e := jsonb_build_object('superadmin', new.ar_superadmin, 'behorigheter', to_jsonb(new.behorigheter));
  end if;

  insert into public.admin_logg (aktor, handling, mal_anvandare, detaljer)
  values (auth.uid(),
          case tg_op when 'INSERT' then 'skapad' when 'UPDATE' then 'andrad' else 'borttagen' end,
          mal,
          jsonb_strip_nulls(jsonb_build_object(
            'fore', f, 'efter', e,
            'via', nullif(current_setting('nextrum.admin_via', true), ''))));
  return null;
end $$;

drop trigger if exists admin_roller_efter on public.admin_roller;
create trigger admin_roller_efter
  after insert or update or delete on public.admin_roller
  for each row execute function intern.admin_roller_efter();

-- Spegeln på profilen. Namnet sorterar efter profiles_skydda, så att
-- skydda_profilfalt har gjort sitt först (triggrar på samma händelse
-- körs i namnordning). Kolumnen räknas om vid varje skrivning och kan
-- därför inte glida från admin_roller.
create or replace function intern.profil_admin_spegel()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if tg_op = 'UPDATE' and new.is_admin is distinct from old.is_admin then
    if auth.uid() is not null then
      raise exception using errcode = '42501',
        message = 'Adminbehörigheten ändras under System → Adminhantering, inte på profilen.';
    end if;
    -- Receptet i SQL (CLAUDE.md): update public.profiles set is_admin = true where …
    -- ger en superadmin, och false tar bort adminrollen helt.
    perform set_config('nextrum.admin_fran_profil', 'på', true);
    perform set_config('nextrum.admin_via', 'profiles.is_admin', true);
    if new.is_admin then
      insert into public.admin_roller (user_id, ar_superadmin) values (new.id, true)
      on conflict (user_id) do update set ar_superadmin = true;
    else
      delete from public.admin_roller where user_id = new.id;
    end if;
    perform set_config('nextrum.admin_fran_profil', '', true);
    perform set_config('nextrum.admin_via', '', true);
    return new;
  end if;

  new.is_admin := exists (select 1 from public.admin_roller r where r.user_id = new.id and r.ar_superadmin);
  return new;
end $$;

drop trigger if exists profiles_spegel_admin on public.profiles;
create trigger profiles_spegel_admin
  before insert or update on public.profiles
  for each row execute function intern.profil_admin_spegel();


-- ------------------------------------------------------------
-- 5. Dagens admins blir superadmins
-- ------------------------------------------------------------
do $$
begin
  perform set_config('nextrum.admin_via', 'migrering', true);
  insert into public.admin_roller (user_id, ar_superadmin)
  select p.id, true
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.is_admin
  on conflict (user_id) do nothing;
  perform set_config('nextrum.admin_via', '', true);
end $$;


-- ------------------------------------------------------------
-- 6. Att göra någon till admin, ändra och ta bort
-- ------------------------------------------------------------

-- Prövar en lista innan något skrivs. Används av edge-funktionen
-- admin-skapa, så att en inbjudan inte skickas till någon som sedan
-- inte får rollen. Vakten i admin_roller är det som faktiskt bestämmer.
create or replace function public.admin_kan_ge(p_behorigheter text[], p_superadmin boolean default false)
returns text
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  jag_roll   public.admin_roller%rowtype;
  lista text[] := coalesce(p_behorigheter, '{}'::text[]);
  okand text[];
begin
  if auth.uid() is null then
    return 'Logga in först.';
  end if;
  select * into jag_roll from public.admin_roller where user_id = auth.uid();
  if not found or not (jag_roll.ar_superadmin or 'admin_hantera' = any (jag_roll.behorigheter)) then
    return 'Bara en superadmin eller den som får hantera admins kan skapa admins.';
  end if;
  select coalesce(array_agg(b), '{}'::text[]) into okand
    from unnest(lista) b where not (b = any (intern.admin_behorigheter()));
  if cardinality(okand) > 0 then
    return 'Okänd behörighet: ' || array_to_string(okand, ', ') || '.';
  end if;
  if not coalesce(p_superadmin, false) and cardinality(lista) = 0 then
    return 'Välj minst en behörighet.';
  end if;
  if not coalesce(p_superadmin, false) and 'anvandare_redigera' = any (lista)
     and not ('anvandare_las' = any (lista)) then
    return 'Ändra användare kräver Läsa användare.';
  end if;
  if not jag_roll.ar_superadmin then
    if coalesce(p_superadmin, false) then
      return 'Bara en superadmin kan göra någon till superadmin.';
    end if;
    if not (lista <@ jag_roll.behorigheter) then
      return 'Du kan inte ge en behörighet du inte har själv.';
    end if;
  end if;
  return null;
end $$;

create or replace function public.gor_till_admin(
  p_user_id uuid, p_behorigheter text[], p_superadmin boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  lista text[] := coalesce(p_behorigheter, '{}'::text[]);
  okand text[];
  rad   public.admin_roller%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Logga in först.';
  end if;
  select coalesce(array_agg(b), '{}'::text[]) into okand
    from unnest(lista) b where not (b = any (intern.admin_behorigheter()));
  if cardinality(okand) > 0 then
    raise exception using errcode = '22023', message = 'Okänd behörighet: ' || array_to_string(okand, ', ') || '.';
  end if;
  if not coalesce(p_superadmin, false) and cardinality(lista) = 0 then
    raise exception using errcode = '22023',
      message = 'Välj minst en behörighet, eller ta bort personen som admin.';
  end if;
  if not coalesce(p_superadmin, false) and 'anvandare_redigera' = any (lista)
     and not ('anvandare_las' = any (lista)) then
    raise exception using errcode = '22023', message = 'Ändra användare kräver Läsa användare.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id and p.raderad_at is null) then
    raise exception using errcode = '22023', message = 'Personen har inget konto hos oss.';
  end if;

  perform set_config('nextrum.admin_via', 'gor_till_admin', true);
  insert into public.admin_roller as r (user_id, ar_superadmin, behorigheter)
  values (p_user_id, coalesce(p_superadmin, false), lista)
  on conflict (user_id) do update
    set ar_superadmin = excluded.ar_superadmin, behorigheter = excluded.behorigheter
  returning * into rad;
  perform set_config('nextrum.admin_via', '', true);

  return jsonb_build_object('user_id', rad.user_id, 'superadmin', rad.ar_superadmin,
                            'behorigheter', to_jsonb(rad.behorigheter));
end $$;

create or replace function public.ta_bort_admin(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Logga in först.';
  end if;
  perform set_config('nextrum.admin_via', 'ta_bort_admin', true);
  delete from public.admin_roller where user_id = p_user_id;
  get diagnostics n = row_count;
  perform set_config('nextrum.admin_via', '', true);
  return n > 0;
end $$;


-- ------------------------------------------------------------
-- 7. Barnets kolumner
-- ------------------------------------------------------------
alter table public.students
  add column if not exists user_id                   uuid,
  add column if not exists anvandarnamn              text,
  add column if not exists barn_aktiv                boolean not null default true,
  add column if not exists visa_rapporter            boolean not null default false,
  add column if not exists vardnadshavare_godkand_at timestamptz,
  add column if not exists senast_inloggad           timestamptz;

alter table public.students drop constraint if exists students_user_id_fkey;
alter table public.students add constraint students_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;
alter table public.students drop constraint if exists students_user_id_key;
alter table public.students add constraint students_user_id_key unique (user_id);
alter table public.students drop constraint if exists students_anvandarnamn_key;
alter table public.students add constraint students_anvandarnamn_key unique (anvandarnamn);
-- Gemener, siffror, punkt, understreck och bindestreck. Samma regel
-- som _delad/barnkonto.ts och barninloggningen.
alter table public.students drop constraint if exists students_anvandarnamn_form;
alter table public.students add constraint students_anvandarnamn_form
  check (anvandarnamn is null or anvandarnamn ~ '^[a-z0-9._-]{3,20}$');
-- En inloggning har ett namn och ett godkännande från vårdnadshavaren,
-- och ett namn utan inloggning finns inte.
alter table public.students drop constraint if exists students_barnkonto_helt;
alter table public.students add constraint students_barnkonto_helt
  check ((user_id is null) = (anvandarnamn is null)
         and (user_id is null or vardnadshavare_godkand_at is not null));

comment on column public.students.user_id is
  'Barnets egen inloggning (auth.users, roll nextrum_barn). Skapas och tas bort bara av edge-funktionen '
  'barn-konto; kopplas av triggern auth_barnkonto_kopplas.';
comment on column public.students.anvandarnamn is
  'Barnets användarnamn: inloggningen är <anvandarnamn>@barn.nextrum.se. Gemener, 3–20 tecken.';
comment on column public.students.barn_aktiv is
  'Falsk = barnets inloggning är pausad av föräldern. Barnets funktioner lämnar då ingenting ut.';
comment on column public.students.visa_rapporter is
  'Föräldern har valt att barnet ser lektionsrapporterna. Bara föräldern ändrar den.';
comment on column public.students.vardnadshavare_godkand_at is
  'När vårdnadshavaren godkände att barnet använder Nextrum med egen inloggning.';
comment on column public.students.senast_inloggad is
  'Barnets senaste inloggning, stämplad av triggern auth_barnkonto_las.';

drop trigger if exists students_barnkonto_audit on public.students;
create trigger students_barnkonto_audit
  after update on public.students
  for each row execute function public.logga_andring('barnkonto', 'id', 'user_id', 'barn_aktiv', 'visa_rapporter');


-- ------------------------------------------------------------
-- 8. Skydden på students
--
-- Båda skrivs om i sin helhet (vakt på md5). Tre saker tillkommer:
--   · barnets inloggning ändras aldrig av en inloggad, inte ens admin:
--     bara edge-funktionen (service_role) och databasen. visa_rapporter
--     ändras bara av föräldern.
--   · en admin med behörigheten matchning byter studiehjälpare, och
--     bara det om hen inte också får ändra användare. Aldrig till sig
--     själv: en studiehjälpare som var admin hade annars kunnat ge sig
--     själv tillgång till vilket barn som helst.
--   · en inloggning som försvunnit tar användarnamnet med sig.
-- ------------------------------------------------------------
do $$
declare
  v text;
begin
  select md5(prosrc) into v from pg_proc where oid = 'public.skydda_studentfalt()'::regprocedure;
  if position('BARNETS INLOGGNING' in (select prosrc from pg_proc where oid = 'public.skydda_studentfalt()'::regprocedure)) > 0 then
    raise notice 'skydda_studentfalt har redan barnets inloggning, hoppar över.';
  elsif v <> 'd1d6317fe43c97df1a3447f50335ad4c' then
    raise exception 'skydda_studentfalt är inte den i main 2026-09-30 (md5 %). Läs driften och skriv om migrationen.', v;
  else
    execute $f$
create or replace function public.skydda_studentfalt()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $b$
declare
  jag    uuid := auth.uid();
  super  boolean;
  forald boolean;
  matcha boolean;
begin
  if jag is not null then
    super  := public.is_admin();
    forald := jag = old.parent_id;
    matcha := not super and public.har_behorighet('matchning')
              and new.matched_tutor_id is distinct from jag;

    if not super then
      -- Matchning utan att få ändra användare: matchningen och inget annat.
      if not forald and not public.har_behorighet('anvandare_redigera') then
        new := jsonb_populate_record(null::public.students, to_jsonb(old)
               || jsonb_build_object('matched_tutor_id', new.matched_tutor_id,
                                     'match_status', new.match_status));
      end if;
      if not matcha then
        new.matched_tutor_id := old.matched_tutor_id;
        new.match_status     := old.match_status;
      end if;
      new.parent_id        := old.parent_id;
      new.id               := old.id;
      new.raderad_at       := old.raderad_at;
      new.uppdrag_id       := old.uppdrag_id;
    end if;

    /* BARNETS INLOGGNING (barnkonton_och_admin). Ingen inloggad ändrar
       den, inte ens admin. Undantaget är när inloggningen redan är
       borta i auth.users: då är det främmande nyckelns "set null" som
       skriver, och den ska gå igenom. */
    if new.user_id is distinct from old.user_id
       and not (new.user_id is null
                and not exists (select 1 from auth.users u where u.id = old.user_id)) then
      new.user_id := old.user_id;
    end if;
    new.anvandarnamn              := old.anvandarnamn;
    new.barn_aktiv                := old.barn_aktiv;
    new.vardnadshavare_godkand_at := old.vardnadshavare_godkand_at;
    new.senast_inloggad           := old.senast_inloggad;
    if not forald then
      new.visa_rapporter := old.visa_rapporter;
    end if;
  end if;

  -- Utan inloggning finns inget användarnamn, inget godkännande och
  -- inget att visa: nästa inloggning börjar från början.
  if new.user_id is null then
    new.anvandarnamn              := null;
    new.vardnadshavare_godkand_at := null;
    new.senast_inloggad           := null;
    new.barn_aktiv                := true;
    new.visa_rapporter            := false;
  end if;
  return new;
end $b$;
$f$;
  end if;

  select md5(prosrc) into v from pg_proc where oid = 'public.skydda_studentfalt_ny()'::regprocedure;
  if position('BARNETS INLOGGNING' in (select prosrc from pg_proc where oid = 'public.skydda_studentfalt_ny()'::regprocedure)) > 0 then
    raise notice 'skydda_studentfalt_ny har redan barnets inloggning, hoppar över.';
  elsif v <> '397313b0f7d1c63c1759b916ee221b0b' then
    raise exception 'skydda_studentfalt_ny är inte den i main 2026-09-30 (md5 %). Läs driften och skriv om migrationen.', v;
  else
    execute $f$
create or replace function public.skydda_studentfalt_ny()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $b$
begin
  if auth.uid() is not null then
    /* BARNETS INLOGGNING (barnkonton_och_admin): ett nytt barn har
       ingen. Den skapas bara av edge-funktionen barn-konto. */
    new.user_id                   := null;
    new.senast_inloggad           := null;
    if not public.is_admin() then
      new.matched_tutor_id := null;
      new.match_status     := 'pending';
    end if;
  end if;
  if new.user_id is null then
    new.anvandarnamn              := null;
    new.vardnadshavare_godkand_at := null;
    new.senast_inloggad           := null;
    new.barn_aktiv                := true;
    new.visa_rapporter            := false;
  end if;
  return new;
end $b$;
$f$;
  end if;
end $$;


-- ------------------------------------------------------------
-- 9. handle_new_user: ett barnkonto får ingen profil
-- ------------------------------------------------------------
do $$
declare
  fore   text := pg_get_functiondef('public.handle_new_user()'::regprocedure);
  ankare constant text := $g$begin
  insert into public.profiles (id, role, full_name, email)$g$;
  ny     constant text := $n$begin
  -- barnkonton_och_admin: ett barnkonto (app_metadata, som bara
  -- service_role skriver) får ingen profil. En rad i profiles är vad
  -- varje policy frågar efter; utan den är barnet ingen förälder.
  if new.raw_app_meta_data ->> 'roll' = 'barn' then
    return new;
  end if;

  insert into public.profiles (id, role, full_name, email)$n$;
begin
  if position('barnkonton_och_admin' in fore) > 0 then
    raise notice 'handle_new_user hoppar redan över barnkonton.';
    return;
  end if;
  if (length(fore) - length(replace(fore, ankare, ''))) / length(ankare) <> 1 then
    raise exception 'handle_new_user: början hittades inte exakt en gång. Läs driften.';
  end if;
  execute replace(fore, ankare, ny);
end $$;


-- ------------------------------------------------------------
-- 10. auth.users: barnadresserna, rollen, låset och fönstret
-- ------------------------------------------------------------
create or replace function intern.uuid_eller_null(t text)
returns uuid
language sql
immutable
set search_path to 'pg_catalog'
as $$
  select case when t ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then t::uuid end
$$;

create table if not exists public.barn_andringsfonster (
  id          uuid primary key default gen_random_uuid(),
  barn_id     uuid not null references public.students(id) on delete cascade,
  andring     text not null default 'losenord',
  skapad      timestamptz not null default now(),
  giltig_till timestamptz not null default now() + interval '60 seconds'
);
alter table public.barn_andringsfonster drop constraint if exists barn_andringsfonster_andring;
alter table public.barn_andringsfonster add constraint barn_andringsfonster_andring
  check (andring = 'losenord');
alter table public.barn_andringsfonster drop constraint if exists barn_andringsfonster_kort;
alter table public.barn_andringsfonster add constraint barn_andringsfonster_kort
  check (giltig_till <= skapad + interval '60 seconds');

comment on table public.barn_andringsfonster is
  'Ett fönster på högst 60 sekunder då barnets lösenord får bytas. Öppnas av edge-funktionen barn-konto '
  'efter att den prövat att anroparen är barnets förälder, förbrukas av auth_barnkonto_las. RLS utan '
  'policy: bara service_role, inte ens admin.';

alter table public.barn_andringsfonster enable row level security;
revoke all on public.barn_andringsfonster from anon, authenticated, nextrum_barn;

-- Före insert: barnadressen hör till ett barnkonto, och ett barnkonto
-- pekar på ett barn i familjen som inte redan har en inloggning.
create or replace function intern.auth_barnkonto_skapas()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  roll   text := new.raw_app_meta_data ->> 'roll';
  epost  text := lower(coalesce(new.email, ''));
  barn   uuid := intern.uuid_eller_null(new.raw_app_meta_data ->> 'barn_id');
  forald uuid := intern.uuid_eller_null(new.raw_app_meta_data ->> 'forald_id');
begin
  if epost like '%@barn.nextrum.se' and roll is distinct from 'barn' then
    raise exception using errcode = '42501',
      message = 'Adresser på barn.nextrum.se är barnkonton och skapas bara från studievyn.';
  end if;
  if roll is distinct from 'barn' then
    return new;
  end if;

  if epost !~ '^[a-z0-9._-]{3,20}@barn\.nextrum\.se$' then
    raise exception using errcode = '42501',
      message = 'Ett barnkonto har adressen <användarnamn>@barn.nextrum.se.';
  end if;
  if barn is null or forald is null or not exists (
       select 1 from public.students s
        where s.id = barn and s.parent_id = forald and s.raderad_at is null and s.user_id is null) then
    raise exception using errcode = '42501',
      message = 'Barnkontot pekar inte på ett barn i familjen, eller barnet har redan en inloggning.';
  end if;

  new.role := 'nextrum_barn';
  new.raw_user_meta_data := '{}'::jsonb;
  return new;
end $$;

-- Efter insert: kopplingen, i samma transaktion som kontot. Går den
-- inte att göra finns inget konto heller.
create or replace function intern.auth_barnkonto_kopplas()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.raw_app_meta_data ->> 'roll' is distinct from 'barn' then
    return null;
  end if;
  update public.students s
     set user_id = new.id,
         anvandarnamn = split_part(lower(new.email), '@', 1),
         barn_aktiv = true,
         vardnadshavare_godkand_at = now(),
         senast_inloggad = null
   where s.id = intern.uuid_eller_null(new.raw_app_meta_data ->> 'barn_id')
     and s.parent_id = intern.uuid_eller_null(new.raw_app_meta_data ->> 'forald_id')
     and s.user_id is null
     and s.raderad_at is null;
  if not found then
    raise exception using errcode = '42501',
      message = 'Barnkontot gick inte att koppla till barnet.';
  end if;
  return null;
end $$;

-- Före update: låset. Bara de känsliga kolumnerna prövas, så att
-- inloggningen, förnyelsen, pausen och det GoTrue själv skriver går
-- igenom.
create or replace function intern.auth_barnkonto_las()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  fore    text := old.raw_app_meta_data ->> 'roll';
  efter   text := new.raw_app_meta_data ->> 'roll';
  fonster uuid;
begin
  if fore is distinct from efter and (fore = 'barn' or efter = 'barn') then
    raise exception using errcode = '42501',
      message = 'Ett barnkonto förblir ett barnkonto, och ett annat konto blir aldrig ett.';
  end if;

  if efter is distinct from 'barn' then
    -- Ingen annan tar en barnadress, inte heller genom ett adressbyte.
    if (lower(coalesce(new.email, '')) like '%@barn.nextrum.se' and new.email is distinct from old.email)
       or (lower(coalesce(new.email_change, '')) like '%@barn.nextrum.se'
           and new.email_change is distinct from old.email_change) then
      raise exception using errcode = '42501',
        message = 'Adresser på barn.nextrum.se är barnkonton och skapas bara från studievyn.';
    end if;
    return new;
  end if;

  -- Ett barnkonto.
  if (new.raw_app_meta_data -> 'barn_id') is distinct from (old.raw_app_meta_data -> 'barn_id')
     or (new.raw_app_meta_data -> 'forald_id') is distinct from (old.raw_app_meta_data -> 'forald_id') then
    raise exception using errcode = '42501', message = 'Ett barnkonto byter inte barn eller familj.';
  end if;
  new.role := 'nextrum_barn';

  if coalesce(new.email, '')                      is distinct from coalesce(old.email, '')
     or coalesce(new.email_change, '')               is distinct from coalesce(old.email_change, '')
     or coalesce(new.email_change_token_new, '')     is distinct from coalesce(old.email_change_token_new, '')
     or coalesce(new.email_change_token_current, '') is distinct from coalesce(old.email_change_token_current, '')
     or coalesce(new.recovery_token, '')             is distinct from coalesce(old.recovery_token, '')
     or coalesce(new.confirmation_token, '')         is distinct from coalesce(old.confirmation_token, '')
     or coalesce(new.reauthentication_token, '')     is distinct from coalesce(old.reauthentication_token, '')
     or coalesce(new.phone, '')                      is distinct from coalesce(old.phone, '')
     or coalesce(new.phone_change, '')               is distinct from coalesce(old.phone_change, '')
     or coalesce(new.phone_change_token, '')         is distinct from coalesce(old.phone_change_token, '') then
    raise exception using errcode = '42501',
      message = 'Ett barnkontos e-post, telefon och återställning går inte att ändra. Föräldern byter lösenordet i studievyn.';
  end if;

  if new.encrypted_password is distinct from old.encrypted_password then
    delete from public.barn_andringsfonster f
     where f.id = (select g.id from public.barn_andringsfonster g
                    where g.barn_id = intern.uuid_eller_null(new.raw_app_meta_data ->> 'barn_id')
                      and g.andring = 'losenord'
                      and g.giltig_till > clock_timestamp()
                    order by g.giltig_till
                    limit 1
                    for update skip locked)
    returning f.id into fonster;
    if fonster is null then
      raise exception using errcode = '42501', message = 'Barnets lösenord byts av föräldern i studievyn.';
    end if;
  end if;

  -- Senast inloggad, för föräldern. Går den inte att skriva ska barnet
  -- ändå komma in: en tidsstämpel är inte värd en nekad inloggning.
  -- Felet hamnar i Postgres logg.
  if new.last_sign_in_at is distinct from old.last_sign_in_at and new.last_sign_in_at is not null then
    begin
      update public.students s set senast_inloggad = new.last_sign_in_at where s.user_id = new.id;
    exception when others then
      raise warning 'senast_inloggad för ett barnkonto gick inte att skriva: %', sqlerrm;
    end;
  end if;
  return new;
end $$;

drop trigger if exists auth_barnkonto_skapas on auth.users;
create trigger auth_barnkonto_skapas
  before insert on auth.users
  for each row execute function intern.auth_barnkonto_skapas();
drop trigger if exists auth_barnkonto_kopplas on auth.users;
create trigger auth_barnkonto_kopplas
  after insert on auth.users
  for each row execute function intern.auth_barnkonto_kopplas();
drop trigger if exists auth_barnkonto_las on auth.users;
create trigger auth_barnkonto_las
  before update on auth.users
  for each row execute function intern.auth_barnkonto_las();


-- ------------------------------------------------------------
-- 11. Barnets notiser
-- ------------------------------------------------------------
create table if not exists public.barn_notiser (
  id      uuid primary key default gen_random_uuid(),
  barn_id uuid not null references public.students(id) on delete cascade,
  pass_id uuid references public.bookings(id) on delete cascade,
  typ     text not null,
  text    text not null,
  skapad  timestamptz not null default now(),
  last_at timestamptz
);
alter table public.barn_notiser drop constraint if exists barn_notiser_typ;
alter table public.barn_notiser add constraint barn_notiser_typ
  check (typ in ('bekraftat', 'avbokat', 'avslaget', 'motforslag', 'genomfort'));
alter table public.barn_notiser drop constraint if exists barn_notiser_text;
alter table public.barn_notiser add constraint barn_notiser_text
  check (char_length(text) between 1 and 300);
create index if not exists barn_notiser_barn on public.barn_notiser (barn_id, skapad desc);

comment on table public.barn_notiser is
  'Notiserna i barnvyn: när ett av barnets pass bekräftas, avbokas, avslås, får ett motförslag eller '
  'genomförs. Text utan namn, pris eller plats. Skrivs av triggern bookings_barnnotis; barnet läser och '
  'markerar genom barn_notiser() och barn_markera_last(). Mejlas aldrig. Gallras efter 180 dagar.';

alter table public.barn_notiser enable row level security;
revoke all on public.barn_notiser from anon, authenticated, nextrum_barn;

-- "tisdag 7 oktober". Här och inte med to_char: månadens och dagens
-- namn beror där på lc_time, och driften är inte på svenska.
create or replace function intern.barn_dag(d date)
returns text
language sql
immutable
set search_path to 'pg_catalog'
as $$
  select (array['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag'])[extract(isodow from d)::int]
      || ' ' || extract(day from d)::int || ' '
      || (array['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti',
                'september', 'oktober', 'november', 'december'])[extract(month from d)::int]
$$;

-- Namnet börjar inte på "notis": rls-test.sql stänger av triggrar vars
-- funktion heter notis* under körningen, och de här ska provas.
create or replace function intern.barnnotis_vid_pass()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  vad    text;
  b      public.students%rowtype;
  tid    text := left(coalesce(new.wanted_time, ''), 5);
  nar    text;
  besked text;
begin
  if tg_op = 'INSERT' then
    if new.status = 'confirmed' then vad := 'bekraftat'; else return null; end if;
  elsif new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    vad := case when old.status = 'requested' then 'avslaget' else 'avbokat' end;
  elsif new.status = 'completed' and old.status is distinct from 'completed' then
    -- Genomfört för barnet är ett pass barnet var med på.
    if exists (select 1 from public.lesson_reports r
                where r.booking_id = new.id and r.narvaro = 'franvarande') then
      return null;
    end if;
    vad := 'genomfort';
  elsif old.status = 'requested' and new.status = 'confirmed' then
    vad := 'bekraftat';
  elsif new.status = 'requested' and new.motforslag_at is not null
        and new.motforslag_at is distinct from old.motforslag_at then
    vad := 'motforslag';
  else
    return null;
  end if;

  select * into b from public.students s where s.id = new.student_id;
  if not found or b.user_id is null or not b.barn_aktiv or b.raderad_at is not null then
    return null;
  end if;

  nar := intern.barn_dag(new.wanted_date) || case when tid <> '' then ' kl. ' || tid else '' end;
  besked := case vad
    when 'bekraftat'  then 'Ditt pass ' || nar || ' är bekräftat.'
    when 'avbokat'    then 'Passet ' || nar || ' är avbokat.'
    when 'avslaget'   then 'Tiden ' || nar || ' blev inte av.'
    when 'motforslag' then 'Det finns ett förslag på en ny tid: ' || nar || '. Din förälder svarar på det.'
    else                   'Passet ' || intern.barn_dag(new.wanted_date) || ' är klart. Bra jobbat!'
  end;
  insert into public.barn_notiser (barn_id, pass_id, typ, text) values (b.id, new.id, vad, besked);
  return null;
exception when others then
  -- Ett pass ska aldrig stoppas av en notis, samma regel som notis_vid_pass.
  insert into public.notis_fel (kalla, fel)
  values ('barnnotis_vid_pass ' || coalesce(new.id::text, ''), left(sqlerrm, 500));
  return null;
end $$;

drop trigger if exists bookings_barnnotis on public.bookings;
create trigger bookings_barnnotis
  after insert or update on public.bookings
  for each row execute function intern.barnnotis_vid_pass();

create or replace function intern.barnkonton_gallra()
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $$
  delete from public.barn_notiser where skapad < now() - interval '180 days';
  delete from public.barn_andringsfonster where giltig_till < now() - interval '1 hour';
$$;

select cron.schedule('barnkonton-gallring', '59 3 * * *', $$select intern.barnkonton_gallra()$$);


-- ------------------------------------------------------------
-- 12. Barnets tre funktioner
--
-- Det enda barnet når. Barnet härleds ur token (app_metadata) OCH
-- students.user_id, och de måste säga samma sak. Pausat barn, eller ett
-- konto utan koppling, får ingenting.
-- ------------------------------------------------------------
create or replace function intern.mitt_barn()
returns public.students
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select s.*
    from public.students s
   where auth.uid() is not null
     and s.user_id = auth.uid()
     and (auth.jwt() -> 'app_metadata' ->> 'roll') = 'barn'
     and s.id = intern.uuid_eller_null(auth.jwt() -> 'app_metadata' ->> 'barn_id')
     and s.parent_id = intern.uuid_eller_null(auth.jwt() -> 'app_metadata' ->> 'forald_id')
     and s.raderad_at is null
$$;

create or replace function public.barn_oversikt()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  b  public.students%rowtype;
  nu timestamptz := now();
begin
  b := intern.mitt_barn();
  if b.id is null then
    return jsonb_build_object('lage', 'saknas');
  end if;
  if not b.barn_aktiv then
    return jsonb_build_object('lage', 'pausad');
  end if;

  return jsonb_build_object(
    'lage', 'ok',
    'fornamn', intern.fornamn(b.name),
    'studiehjalpare', (select intern.fornamn(p.full_name) from public.profiles p
                        where p.id = b.matched_tutor_id and b.match_status <> 'pending'),
    'kommande', coalesce((
      select jsonb_agg(jsonb_build_object(
               'datum', x.wanted_date, 'tid', left(x.wanted_time, 5), 'langd_min', x.duration_min,
               'status', x.status, 'amne', x.subject)
             order by x.wanted_date, x.wanted_time)
        from public.bookings x
       where x.student_id = b.id and x.status in ('requested', 'confirmed')
         and (x.wanted_date + coalesce(x.wanted_time, '00:00')::time) at time zone 'Europe/Stockholm'
             + make_interval(mins => coalesce(x.duration_min, 60)) > nu), '[]'::jsonb),
    'genomforda', coalesce((
      select jsonb_agg(jsonb_build_object(
               'datum', g.wanted_date, 'tid', left(g.wanted_time, 5), 'langd_min', g.duration_min,
               'amne', g.subject)
             order by g.wanted_date desc, g.wanted_time desc)
        from (select x.* from public.bookings x
               where x.student_id = b.id and x.status = 'completed'
                 and exists (select 1 from public.lesson_reports r
                              where r.booking_id = x.id and r.narvaro is distinct from 'franvarande')
               order by x.wanted_date desc, x.wanted_time desc
               limit 50) g), '[]'::jsonb),
    'timmar', jsonb_build_object(
      'genomforda', (select round(coalesce(sum(x.duration_min), 0) / 60.0, 1)
                       from public.bookings x
                      where x.student_id = b.id and x.status = 'completed'
                        and exists (select 1 from public.lesson_reports r
                                     where r.booking_id = x.id and r.narvaro is distinct from 'franvarande')),
      'bokade', (select round(coalesce(sum(x.duration_min), 0) / 60.0, 1)
                   from public.bookings x
                  where x.student_id = b.id and x.status = 'confirmed'
                    and (x.wanted_date + coalesce(x.wanted_time, '00:00')::time) at time zone 'Europe/Stockholm' > nu)),
    'studieplan', (select jsonb_build_object('amne', p.subject, 'mal', p.goals, 'text', p.plan_text,
                                             'uppdaterad', p.updated_at)
                     from public.study_plans p where p.student_id = b.id
                    order by p.updated_at desc nulls last limit 1),
    'visa_rapporter', b.visa_rapporter,
    'rapporter', case when b.visa_rapporter then coalesce((
      select jsonb_agg(jsonb_build_object(
               'datum', r.lesson_date, 'amne', r.amne, 'gick', r.gick,
               'text', nullif(coalesce(r.ai_feedback, r.raw_notes), ''),
               'trana', r.needs_practice, 'nasta', r.next_focus)
             order by r.lesson_date desc nulls last, r.created_at desc)
        from (select * from public.lesson_reports r0 where r0.student_id = b.id
               order by r0.lesson_date desc nulls last, r0.created_at desc limit 20) r), '[]'::jsonb) end
  );
end $$;

create or replace function public.barn_notiser()
returns table (id uuid, typ text, text text, skapad timestamptz, last_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  b public.students%rowtype;
begin
  b := intern.mitt_barn();
  if b.id is null or not b.barn_aktiv then
    return;
  end if;
  return query
    select n.id, n.typ, n.text, n.skapad, n.last_at
      from public.barn_notiser n
     where n.barn_id = b.id
     order by n.skapad desc
     limit 50;
end $$;

create or replace function public.barn_markera_last(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  b public.students%rowtype;
  n integer;
begin
  b := intern.mitt_barn();
  if b.id is null or not b.barn_aktiv then
    return false;
  end if;
  update public.barn_notiser set last_at = now()
   where id = p_id and barn_id = b.id and last_at is null;
  get diagnostics n = row_count;
  return n > 0;
end $$;


-- ------------------------------------------------------------
-- 13. Föräldern läser barnens inloggningar
--
-- Kolumnerna står på students, som föräldern redan läser. Funktionen
-- finns för att studievyn ska tåla att migrationen saknas: en lista
-- med kolumner som inte finns gör att hela barnlistan dör, och ett
-- anrop till en funktion som saknas går att känna igen (PGRST202).
-- ------------------------------------------------------------
create or replace function public.mina_barnkonton()
returns table (barn_id uuid, anvandarnamn text, barn_aktiv boolean, visa_rapporter boolean,
               vardnadshavare_godkand_at timestamptz, senast_inloggad timestamptz)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select s.id, s.anvandarnamn, s.barn_aktiv, s.visa_rapporter, s.vardnadshavare_godkand_at, s.senast_inloggad
    from public.students s
   where s.parent_id = auth.uid() and s.raderad_at is null
   order by s.created_at
$$;


-- Loggar ut barnet på alla enheter: när föräldern pausar kontot eller
-- byter lösenordet, för att någon annan kan ha lösenordet. Förnyelsen
-- nekas sedan, och en åtkomsttoken som redan lämnats ut gäller högst en
-- timme till, då barnets funktioner redan ser pausen. Bara service_role
-- (edge-funktionen barn-konto), efter att den prövat föräldern.
create or replace function public.barnkonto_logga_ut(p_barn uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  konto uuid;
  n     integer;
begin
  select s.user_id into konto from public.students s where s.id = p_barn;
  if konto is null then
    return 0;
  end if;
  delete from auth.refresh_tokens where user_id = konto::text;
  delete from auth.sessions where user_id = konto;
  get diagnostics n = row_count;
  return n;
end $$;


-- ------------------------------------------------------------
-- 14. Städningen
--
-- Tas barnet bort (eller avidentifieras av radera_person) tas
-- inloggningen bort, och med den sessionerna. Tas inloggningen bort
-- följer notiserna med. Barnet självt, notiserna och fönstren går med
-- students genom främmande nycklar.
-- ------------------------------------------------------------
create or replace function intern.barnkonto_stadas()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if tg_op = 'DELETE' then
    if old.user_id is not null then
      delete from auth.users where id = old.user_id;
    end if;
    return null;
  end if;

  if old.raderad_at is null and new.raderad_at is not null and new.user_id is not null then
    delete from auth.users where id = new.user_id;
  end if;
  if old.user_id is not null and new.user_id is null then
    delete from public.barn_notiser where barn_id = new.id;
    delete from public.barn_andringsfonster where barn_id = new.id;
  end if;
  return null;
end $$;

drop trigger if exists students_barnkonto_stadas on public.students;
create trigger students_barnkonto_stadas
  after update or delete on public.students
  for each row execute function intern.barnkonto_stadas();


-- ------------------------------------------------------------
-- 15. Notiskön mejlar aldrig ett barnkonto
--
-- Ett barn har ingen profil och kan därför inte stå som mottagare i
-- notis_utskick (främmande nyckeln). Det här är den andra spärren, för
-- den dag någon ger barn en profil: raden hoppas över innan en adress
-- ens väljs, och en adress på barn.nextrum.se lämnas aldrig ut, inte
-- heller som sandlåda.
-- ------------------------------------------------------------
do $$
declare
  fore    text := pg_get_functiondef('public.notis_utskick_ta(integer)'::regprocedure);
  ankare1 constant text := $g$    elsif u.typ like 'pass\_%' and not prov and u.pass_id is null then
      skal := 'passet finns inte längre';
    end if;$g$;
  ny1     constant text := $n$    elsif u.typ like 'pass\_%' and not prov and u.pass_id is null then
      skal := 'passet finns inte längre';
    elsif exists (select 1 from auth.users a
                   where a.id = u.mottagare
                     and ((a.raw_app_meta_data ->> 'roll') = 'barn'
                          or lower(coalesce(a.email, '')) like '%@barn.nextrum.se')) then
      skal := 'barnkonton får inga mejl';
    end if;$n$;
  ankare2 constant text := $g$      if adress is null then
        update public.notis_utskick q set status = 'fel', fel = 'mottagaren saknar e-postadress', uppdaterad = now()
         where q.id = u.id;
        continue;
      end if;$g$;
  ny2     constant text := $n$      if adress is null then
        update public.notis_utskick q set status = 'fel', fel = 'mottagaren saknar e-postadress', uppdaterad = now()
         where q.id = u.id;
        continue;
      end if;
      if lower(adress) like '%@barn.nextrum.se' then
        update public.notis_utskick q set status = 'hoppad', fel = 'barnkonton får inga mejl', uppdaterad = now()
         where q.id = u.id;
        continue;
      end if;$n$;
begin
  if position('barnkonton får inga mejl' in fore) > 0 then
    raise notice 'notis_utskick_ta hoppar redan över barnkonton.';
    return;
  end if;
  if (length(fore) - length(replace(fore, ankare1, ''))) / length(ankare1) <> 1 then
    raise exception 'notis_utskick_ta: skälen hittades inte exakt en gång. Läs driften.';
  end if;
  if (length(fore) - length(replace(fore, ankare2, ''))) / length(ankare2) <> 1 then
    raise exception 'notis_utskick_ta: adresskollen hittades inte exakt en gång. Läs driften.';
  end if;
  execute replace(replace(fore, ankare1, ny1), ankare2, ny2);
end $$;


-- ------------------------------------------------------------
-- 16. Rabattkoderna når inte barnen
--
-- kolla_rabattkod var körbar för PUBLIC, och därmed för varje roll,
-- också nextrum_barn. Den svarar om en kod finns och vad den ger, och
-- det är ett pris. Samma roller som förut, uttryckligen.
-- ------------------------------------------------------------
revoke execute on function public.kolla_rabattkod(text, text, bigint) from public;
grant execute on function public.kolla_rabattkod(text, text, bigint) to anon, authenticated, service_role;


-- ------------------------------------------------------------
-- 17. Policyerna per behörighet
--
-- Behörighet → data. Superadmin har allt genom is_admin() som förut.
--
--   leads                   intresseanmälningarna (läsa och ändra)
--   matchning               eleverna och studiehjälparna, tillgängligheten,
--                           matchningsförslagen; ändrar bara matchningen
--   anvandare_las           familjerna, eleverna och studiehjälparna
--   anvandare_redigera      samma, och ändra det vyerna själva skriver
--   studiehjalpare_godkann  studiehjälparna; ändrar läget och om profilen
--                           syns publikt
--   bokningar_las           passen, med namnen
--   rapporter_las           lektionsrapporterna, med namnen
--   notiskonfig             notisernas drift, inställning, kö, körningar,
--                           fel och strömbrytarna för mejl och SMS
--   admin_hantera           adminrollerna, loggen och namnen
--
-- Allt annat (betalningar, fakturor, löner, chattar, ansökningar,
-- raderingen, AI:n, agenterna, tjänsterna, systemet) är superadmin.
-- Barnens inloggning och ändringsfönstret når ingen admin.
-- ------------------------------------------------------------

-- Intresseanmälningarna: de två adminpolicyerna byts, för leads är
-- självklart (en superadmin har behörigheten ändå).
drop policy if exists "endast admin läser intresseanmälningar" on public.leads;
create policy "endast admin läser intresseanmälningar" on public.leads
  for select using (public.har_behorighet('leads'));
drop policy if exists "admin uppdaterar intresseanmälningar" on public.leads;
create policy "admin uppdaterar intresseanmälningar" on public.leads
  for update using (public.har_behorighet('leads')) with check (public.har_behorighet('leads'));

-- Personerna. Egna policyer bredvid adminens, så att inget som
-- superadmin redan har rörs.
drop policy if exists "behörighet läser personer" on public.profiles;
create policy "behörighet läser personer" on public.profiles
  for select to authenticated
  using (public.har_nagon_behorighet(array['anvandare_las', 'anvandare_redigera', 'matchning',
                                           'studiehjalpare_godkann', 'bokningar_las', 'rapporter_las',
                                           'admin_hantera']));
drop policy if exists "behörighet redigerar personer" on public.profiles;
create policy "behörighet redigerar personer" on public.profiles
  for update to authenticated
  using (public.har_behorighet('anvandare_redigera')) with check (public.har_behorighet('anvandare_redigera'));

drop policy if exists "behörighet läser elever" on public.students;
create policy "behörighet läser elever" on public.students
  for select to authenticated
  using (public.har_nagon_behorighet(array['anvandare_las', 'anvandare_redigera', 'matchning',
                                           'bokningar_las', 'rapporter_las']));
drop policy if exists "behörighet ändrar elever" on public.students;
create policy "behörighet ändrar elever" on public.students
  for update to authenticated
  using (public.har_nagon_behorighet(array['anvandare_redigera', 'matchning']))
  with check (public.har_nagon_behorighet(array['anvandare_redigera', 'matchning']));

drop policy if exists "behörighet läser studiehjälpare" on public.tutor_profiles;
create policy "behörighet läser studiehjälpare" on public.tutor_profiles
  for select to authenticated
  using (public.har_nagon_behorighet(array['anvandare_las', 'anvandare_redigera', 'matchning',
                                           'studiehjalpare_godkann']));
drop policy if exists "behörighet ändrar studiehjälpare" on public.tutor_profiles;
create policy "behörighet ändrar studiehjälpare" on public.tutor_profiles
  for update to authenticated
  using (public.har_nagon_behorighet(array['anvandare_redigera', 'studiehjalpare_godkann']))
  with check (public.har_nagon_behorighet(array['anvandare_redigera', 'studiehjalpare_godkann']));

drop policy if exists "behörighet ser tillgängligheten" on public.tutor_availability;
create policy "behörighet ser tillgängligheten" on public.tutor_availability
  for select to authenticated using (public.har_behorighet('matchning'));

drop policy if exists "behörighet läser bokningar" on public.bookings;
create policy "behörighet läser bokningar" on public.bookings
  for select to authenticated using (public.har_behorighet('bokningar_las'));

drop policy if exists "behörighet läser rapporter" on public.lesson_reports;
create policy "behörighet läser rapporter" on public.lesson_reports
  for select to authenticated using (public.har_behorighet('rapporter_las'));

-- Notiserna: adminpolicyerna byts, notiskonfig är självklart.
drop policy if exists "admin läser notisdriften" on public.notis_drift;
create policy "admin läser notisdriften" on public.notis_drift
  for select to authenticated using (public.har_behorighet('notiskonfig'));
drop policy if exists "admin ändrar notisdriften" on public.notis_drift;
create policy "admin ändrar notisdriften" on public.notis_drift
  for update to authenticated
  using (public.har_behorighet('notiskonfig')) with check (public.har_behorighet('notiskonfig'));
drop policy if exists "admin ändrar notisinställningen" on public.notis_installning;
create policy "admin ändrar notisinställningen" on public.notis_installning
  for update to authenticated
  using (public.har_behorighet('notiskonfig')) with check (public.har_behorighet('notiskonfig'));
drop policy if exists "admin läser utskicken" on public.notis_utskick;
create policy "admin läser utskicken" on public.notis_utskick
  for select to authenticated using (public.har_behorighet('notiskonfig'));
drop policy if exists "admin läser körningarna" on public.notis_korningar;
create policy "admin läser körningarna" on public.notis_korningar
  for select to authenticated using (public.har_behorighet('notiskonfig'));
drop policy if exists "admin läser notisfelen" on public.notis_fel;
create policy "admin läser notisfelen" on public.notis_fel
  for select to authenticated using (public.har_behorighet('notiskonfig'));
drop policy if exists "behörighet slår om notisernas strömbrytare" on public.flaggor;
create policy "behörighet slår om notisernas strömbrytare" on public.flaggor
  for update to authenticated
  using (public.har_behorighet('notiskonfig') and kod in ('notiser_mejl', 'notiser_sms'))
  with check (public.har_behorighet('notiskonfig') and kod in ('notiser_mejl', 'notiser_sms'));

-- Adminrollerna och loggen. Man ser alltid sin egen roll.
drop policy if exists "adminrollerna läses av den som hanterar dem" on public.admin_roller;
create policy "adminrollerna läses av den som hanterar dem" on public.admin_roller
  for select to authenticated
  using (user_id = auth.uid() or public.har_behorighet('admin_hantera'));
drop policy if exists "adminloggen läses av den som hanterar admins" on public.admin_logg;
create policy "adminloggen läses av den som hanterar admins" on public.admin_logg
  for select to authenticated using (public.har_behorighet('admin_hantera'));


-- ------------------------------------------------------------
-- 18. Funktionerna som frågar is_admin() men hör till en behörighet
-- ------------------------------------------------------------
do $$
declare
  fore text;
  n    integer;
  ankare text;
  ny     text;
  -- funktion, text som byts, ny text
  lappar constant text[][] := array[
    array['public.skydda_leadfalt()',
          $g$  if public.is_admin()
     or jwtroll = 'service_role'$g$,
          $n$  if public.is_admin() or public.har_behorighet('leads')
     or jwtroll = 'service_role'$n$],
    array['public.matchningsforslag(uuid)',
          $g$  if not public.is_admin() then$g$,
          $n$  if not public.har_behorighet('matchning') then$n$],
    array['public.notis_lage()',
          $g$  if not public.is_admin() then$g$,
          $n$  if not public.har_behorighet('notiskonfig') then$n$],
    array['public.notis_kor_nu()',
          $g$  if not public.is_admin() then$g$,
          $n$  if not public.har_behorighet('notiskonfig') then$n$],
    array['public.notis_provmejl(text)',
          $g$  if not public.is_admin() then$g$,
          $n$  if not public.har_behorighet('notiskonfig') then$n$],
    array['public.notisfel(integer)',
          $g$   where public.is_admin()$g$,
          $n$   where public.har_behorighet('notiskonfig')$n$],
    -- En begränsad admin är admin i auditloggen också.
    array['public.logga_andring()',
          $g$when public.is_admin() then 'admin'$g$,
          $n$when intern.har_adminroll(uid) then 'admin'$n$]
  ];
  i integer;
begin
  for i in 1 .. array_length(lappar, 1) loop
    fore := pg_get_functiondef(lappar[i][1]::regprocedure);
    ankare := lappar[i][2];
    ny := lappar[i][3];
    if position(ny in fore) > 0 then
      raise notice '% är redan lappad.', lappar[i][1];
      continue;
    end if;
    n := (length(fore) - length(replace(fore, ankare, ''))) / length(ankare);
    if n <> 1 then
      raise exception '%: texten som ska bytas hittades % gånger, väntat en. Läs driften.', lappar[i][1], n;
    end if;
    execute replace(fore, ankare, ny);
  end loop;

  -- Raderingen: ett adminkonto raderas inte här, vilken adminroll det
  -- än har. Två ställen, familj och studiehjälpare.
  fore := pg_get_functiondef('intern.radering_underlag(text, uuid)'::regprocedure);
  if position('intern.har_adminroll(p.id)' in fore) > 0 then
    raise notice 'radering_underlag är redan lappad.';
  else
    ankare := $g$    elsif p.is_admin then$g$;
    n := (length(fore) - length(replace(fore, ankare, ''))) / length(ankare);
    if n <> 2 then
      raise exception 'radering_underlag: adminkollen hittades % gånger, väntat två. Läs driften.', n;
    end if;
    execute replace(fore, ankare, $n$    elsif intern.har_adminroll(p.id) then$n$);
  end if;

  -- Studiehjälparens profil: den som godkänner studiehjälpare sätter
  -- läget och om profilen syns publikt, inte på sin egen profil.
  fore := pg_get_functiondef('public.skydda_tutorfalt()'::regprocedure);
  if position('studiehjalpare_godkann' in fore) > 0 then
    raise notice 'skydda_tutorfalt är redan lappad.';
  else
    ankare := $g$  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
$g$;
    n := (length(fore) - length(replace(fore, ankare, ''))) / length(ankare);
    if n <> 1 then
      raise exception 'skydda_tutorfalt: början hittades % gånger, väntat en. Läs driften.', n;
    end if;
    execute replace(fore, ankare, ankare || $n$
  -- barnkonton_och_admin: behörigheten studiehjalpare_godkann.
  if public.har_behorighet('studiehjalpare_godkann') and old.id is distinct from auth.uid() then
    fria := fria || array['status', 'visa_publikt'];
  end if;
$n$);
  end if;
end $$;


-- ------------------------------------------------------------
-- 19. Vem kör vad
--
-- Triggerfunktionerna har ingen EXECUTE (rls-test.sql fångar nästa).
-- Barnets tre funktioner kan bara barnet köra; föräldrarnas en bara
-- en inloggad. Resten av de nya går till authenticated, och
-- har_behorighet också till anon, eftersom policyer som är "to public"
-- frågar den (Fas 10-fällan i CLAUDE.md avsnitt 6).
-- ------------------------------------------------------------
revoke execute on function public.admin_logg_las() from public, anon, authenticated;
revoke execute on function intern.admin_roller_vakt() from public, anon, authenticated;
revoke execute on function intern.admin_roller_efter() from public, anon, authenticated;
revoke execute on function intern.profil_admin_spegel() from public, anon, authenticated;
revoke execute on function intern.auth_barnkonto_skapas() from public, anon, authenticated;
revoke execute on function intern.auth_barnkonto_kopplas() from public, anon, authenticated;
revoke execute on function intern.auth_barnkonto_las() from public, anon, authenticated;
revoke execute on function intern.barnnotis_vid_pass() from public, anon, authenticated;
revoke execute on function intern.barnkonto_stadas() from public, anon, authenticated;
revoke execute on function intern.barnkonton_gallra() from public, anon, authenticated;
revoke execute on function intern.mitt_barn() from public, anon, authenticated;
revoke execute on function intern.har_adminroll(uuid) from public, anon, authenticated;

revoke execute on function public.barn_oversikt() from public, anon, authenticated;
revoke execute on function public.barn_notiser() from public, anon, authenticated;
revoke execute on function public.barn_markera_last(uuid) from public, anon, authenticated;
grant execute on function public.barn_oversikt() to nextrum_barn;
grant execute on function public.barn_notiser() to nextrum_barn;
grant execute on function public.barn_markera_last(uuid) to nextrum_barn;

revoke execute on function public.mina_barnkonton() from public, anon;
grant execute on function public.mina_barnkonton() to authenticated;
revoke execute on function public.barnkonto_logga_ut(uuid) from public, anon, authenticated;
grant execute on function public.barnkonto_logga_ut(uuid) to service_role;

revoke execute on function public.har_behorighet(text) from public;
grant execute on function public.har_behorighet(text) to anon, authenticated, service_role;
revoke execute on function public.har_nagon_behorighet(text[]) from public;
grant execute on function public.har_nagon_behorighet(text[]) to anon, authenticated, service_role;
revoke execute on function public.mina_behorigheter() from public, anon;
grant execute on function public.mina_behorigheter() to authenticated;
revoke execute on function public.admin_kan_ge(text[], boolean) from public, anon;
grant execute on function public.admin_kan_ge(text[], boolean) to authenticated;
revoke execute on function public.gor_till_admin(uuid, text[], boolean) from public, anon;
grant execute on function public.gor_till_admin(uuid, text[], boolean) to authenticated;
revoke execute on function public.ta_bort_admin(uuid) from public, anon;
grant execute on function public.ta_bort_admin(uuid) to authenticated;
