-- ============================================================
-- NEXTRUM — Fas 16.1c: kvittobromsen går inte att bakdatera
--
-- Bromsen på ansökningskvittot (Fas 16.1) räknade ansökningar efter
-- applications.created_at: fler än fem den senaste minuten, eller
-- samma adress det senaste dygnet. Men created_at skrevs av den som
-- postade. anon har INSERT på kolumnen, och skydda_ansokningsfalt
-- rörde den inte. En rad med created_at = '2000-01-01' räknades
-- alltså aldrig, och ett skript som bakdaterade varje rad kunde få
-- oss att skicka hur många kvitton som helst till en adress det valt,
-- från info@nextrum.se med godkänd DKIM.
--
-- Tre rättelser:
--
-- 1. created_at sätts av databasen på en insert utifrån, och kan inte
--    ändras efteråt. Då är det den bromsen räknar på.
--
-- 2. Samma adress jämförs som mejlet faktiskt levereras: utan
--    mellanslag i kanterna, utan skiftläge och utan plustillägg.
--    "anna+1@gmail.com" och "anna+2@gmail.com" hamnar i samma
--    inkorg, och en broms som ser dem som två olika adresser bromsar
--    ingenting. (Punkter i Gmail-adresser går inte att normalisera
--    utan att gissa leverantör. Taket nedan täcker det.)
--
-- 3. Ett tak per timme ovanpå taket per minut. Fem i minuten är
--    7 200 kvitton per dygn för den som håller takten. Nextrum får
--    några ansökningar i veckan; tjugo i timmen är ingen verklig
--    rekrytering som bromsas.
--
-- Den bromsade raden skrivs som förut, med skälet, så att den syns i
-- rekryteringsrutan. Aviseringen till oss påverkas inte.
--
--
-- SAMMA HÅL I LEADS
--
-- lead-notis bromsar kvittot till familjer på precis samma sätt, med
-- leads.created_at, och skydda_leadfalt rörde inte heller den. Samma
-- rättelse där (punkt 4). Den skyddar dessutom analysvyerna, som
-- räknar anmälningar per månad på samma kolumn: en bakdaterad rad
-- hamnade förut i en månad som redan var stängd.
-- ============================================================

-- ---------- 1. created_at är Nextrums ----------
create or replace function public.skydda_ansokningsfalt()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  klanger text := current_setting('request.jwt.claims', true);
  jwtroll text := case when klanger ~ '^\s*\{' then (klanger::json ->> 'role') else null end;
  giltiga text[];
begin
  if public.is_admin()
     or jwtroll = 'service_role'
     or (jwtroll is null and session_user in ('postgres', 'supabase_admin'))
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Läget och tidsstämplarna sätts av Nextrum, aldrig av den som söker.
    new.status       := 'new';
    new.kontaktad_at := null;
    new.intervju_at  := null;
    new.utbildad_at  := null;
    new.notering     := null;
    -- Fas 16.1: mötet också. Ett mötesmejl byggs på de här två fälten,
    -- och en länk som den som söker själv skrivit in är en nätfiskelänk
    -- i ett mejl från vår domän.
    new.mote_tid     := null;
    new.mote_lank    := null;
    -- Fas 16.1c: och när ansökan kom in. Kvittobromsen räknar på den,
    -- och en tid den som postar själv väljer är ingen broms.
    new.created_at   := now();

    -- Bara tjänster som faktiskt går att söka till. En kod som inte
    -- gör det skrivs om i stället för att neka ansökan — vi ska inte
    -- straffa någon för att vår katalog ändrats under tiden.
    select array_agg(k) into giltiga
      from unnest(coalesce(new.tjanster, '{}'::text[])) as k
     where exists (select 1 from public.tjanster t
                    where t.kod = k and t.aktiv and t.for_jobb);

    if giltiga is null or cardinality(giltiga) = 0 then
      select array[t.kod] into giltiga
        from public.tjanster t
       where t.aktiv and t.for_jobb
       order by t.ordning, t.kod
       limit 1;
    end if;
    new.tjanster := coalesce(giltiga, array['laxhjalp']);

    -- Längdtaken. Samma skäl som för leads: utan dem kan vem som
    -- helst posta en rad på flera megabyte mot det öppna API:et, och
    -- den raden läses sedan av adminvyn och av notismejlet.
    new.name         := left(new.name, 120);
    new.email        := left(new.email, 200);
    new.school       := left(new.school, 120);
    new.subjects     := left(new.subjects, 200);
    new.availability := left(new.availability, 200);
    new.why          := left(new.why, 4000);
  else
    new.status       := old.status;
    new.kontaktad_at := old.kontaktad_at;
    new.intervju_at  := old.intervju_at;
    new.utbildad_at  := old.utbildad_at;
    new.notering     := old.notering;
    new.tjanster     := old.tjanster;
    new.mote_tid     := old.mote_tid;
    new.mote_lank    := old.mote_lank;
    new.created_at   := old.created_at;
  end if;
  return new;
end $function$;

-- ---------- 2. adressen som den levereras ----------
create or replace function intern.epost_nyckel(p text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select regexp_replace(lower(btrim(coalesce(p, ''))), '\+[^@]*@', '@')
$$;

comment on function intern.epost_nyckel(text) is
  'En adress som den levereras: utan kantmellanslag, skiftläge och plustillägg. '
  'Bara för att jämföra, aldrig för att skicka till.';

-- ---------- 3. triggern, med bromsen omskriven ----------
create or replace function intern.ansokan_besked()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  minut integer;
  timme integer;
  samma integer;
  broms text := null;
begin
  -- Ett fel här får aldrig stoppa ansökan eller adminens klick. Ett
  -- uteblivet mejl är ett mindre fel än en ansökan som inte sparas.
  begin
    if tg_op = 'INSERT' then
      -- BARA kvittot. Ingenting annat i raden läses, eftersom raden
      -- kan vara skriven av vem som helst. created_at är satt av
      -- skydda_ansokningsfalt (Fas 16.1c), inte av den som postade.
      select count(*) filter (where a.created_at > now() - interval '1 minute'),
             count(*)
        into minut, timme
        from public.applications a
       where a.created_at > now() - interval '1 hour';
      select count(*) into samma from public.applications a
       where intern.epost_nyckel(a.email) = intern.epost_nyckel(new.email)
         and a.id <> new.id
         and a.created_at > now() - interval '24 hours';
      if minut > 5 then
        broms := 'Fler än fem ansökningar den senaste minuten.';
      elsif timme > 20 then
        broms := 'Fler än tjugo ansökningar den senaste timmen.';
      elsif samma > 0 then
        broms := 'Adressen har redan sökt det senaste dygnet.';
      end if;
      perform intern.ansokan_besked_koa(new.id, 'mottagen', 'mottagen', broms);
      return new;
    end if;

    if new.status = 'rejected' then
      return new;
    end if;

    -- Mötet: en ny tid eller en ny länk ger ett nytt mejl. Ett möte som
    -- redan varit (admin som för in det i efterhand) mejlas inte.
    if new.mote_tid is not null and new.mote_tid > now()
       and new.status is distinct from 'approved' and new.intervju_at is null
       and (old.mote_tid is distinct from new.mote_tid
            or old.mote_lank is distinct from new.mote_lank) then
      perform intern.ansokan_besked_koa(new.id, 'mote',
        'mote:' || extract(epoch from new.mote_tid)::bigint || ':' || md5(coalesce(new.mote_lank, '')));
    end if;

    if old.intervju_at is null and new.intervju_at is not null
       and new.utbildad_at is null and new.status is distinct from 'approved' then
      perform intern.ansokan_besked_koa(new.id, 'utbildning', 'utbildning');
    end if;

    if old.utbildad_at is null and new.utbildad_at is not null
       and new.status is distinct from 'approved' then
      perform intern.ansokan_besked_koa(new.id, 'sista_steget', 'sista_steget');
    end if;

    if new.status = 'approved' and old.status is distinct from 'approved' then
      perform intern.ansokan_besked_koa(new.id, 'valkommen', 'valkommen');
    end if;
  exception when others then
    raise warning 'ansokan_besked: % (%)', sqlerrm, sqlstate;
  end;
  return new;
end $$;

-- ---------- 4. samma sak för intresseanmälan ----------
create or replace function public.skydda_leadfalt()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  klanger text := current_setting('request.jwt.claims', true);
  jwtroll text := case when klanger ~ '^\s*\{' then (klanger::json ->> 'role') else null end;
begin
  if public.is_admin()
     or jwtroll = 'service_role'
     or (jwtroll is null and session_user in ('postgres', 'supabase_admin'))
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.kund_id      := null;
    new.uppdrag_id   := null;
    new.status       := 'new';
    new.kontaktad_at := null;
    new.notering     := null;
    -- Fas 16.1c: kvittobromsen i lead-notis och analysvyerna räknar på
    -- den här. En tid den som postar själv väljer är ingen broms.
    new.created_at   := now();
    if new.tjanst is null
       or not exists (select 1 from public.tjanster t
                       where t.kod = new.tjanst and t.aktiv and t.for_kund) then
      new.tjanst := public.standard_tjanst();
    end if;

    -- Längdtaken. Utan dem kan vem som helst posta en rad på flera
    -- megabyte mot det öppna API:et, och den raden läses sedan av
    -- adminvyn, av notismejlet och av AI:ns läsverktyg.
    new.parent_name := left(new.parent_name, 120);
    new.email       := left(new.email, 200);
    new.child_name  := left(new.child_name, 120);
    new.grade       := left(new.grade, 60);
    new.subject     := left(new.subject, 200);
    new.message     := left(new.message, 4000);

    -- Källfälten kommer ur adressraden och är alltså skrivna av
    -- besökaren själv. Samma tak, och tomt räknas som okänt: en
    -- tom sträng och null ska inte bli två kanaler i statistiken.
    new.kalla         := nullif(left(new.kalla, 120), '');
    new.medium        := nullif(left(new.medium, 120), '');
    new.kampanj       := nullif(left(new.kampanj, 120), '');
    new.annonsvariant := nullif(left(new.annonsvariant, 120), '');
    new.sokord        := nullif(left(new.sokord, 120), '');
    new.hanvisare     := nullif(left(new.hanvisare, 200), '');
    new.landningssida := nullif(left(new.landningssida, 200), '');
  else
    new.kund_id      := old.kund_id;
    new.uppdrag_id   := old.uppdrag_id;
    new.status       := old.status;
    new.kontaktad_at := old.kontaktad_at;
    new.notering     := old.notering;
    new.created_at   := old.created_at;

    -- Källan är en uppgift om besöket, inte om anmälan. Den kan
    -- aldrig bli sannare i efterhand, bara annorlunda.
    new.kalla         := old.kalla;
    new.medium        := old.medium;
    new.kampanj       := old.kampanj;
    new.annonsvariant := old.annonsvariant;
    new.sokord        := old.sokord;
    new.hanvisare     := old.hanvisare;
    new.landningssida := old.landningssida;
  end if;
  return new;
end $function$;
