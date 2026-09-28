-- ============================================================
-- NEXTRUM — ansökningar och CV:n gallras efter ett år
--
-- Integritetspolicyn lovar: "Ansökningar som inte leder till
-- anställning — högst ett år". Ingenting höll det. applications hade
-- ingen DELETE-policy, hinken cv ingen radering, och inget av
-- pg_cron-jobben rörde någondera. En ansökan blev kvar för alltid, och
-- CV:t med den: namn, skola och ofta personnummer, ofta en
-- sextonårings.
--
--
-- VAD SOM RÄKNAS SOM ANSTÄLLNING
--
-- status = 'approved'. Det sätts av "Ta in i poolen" och av Godkänd i
-- rullgardinen, och det är beslutet rekryteringen slutar i. En godkänd
-- ansökan gallras ALDRIG av den här regeln: den hör till anställningen,
-- och hur länge en studiehjälpares uppgifter sparas efter att hen
-- slutat är inte avgjort (CLAUDE.md avsnitt 11).
--
-- Plus ett skyddsnät: en ansökan som inte är avböjd och har samma
-- adress (intern.epost_nyckel) som en godkänd studiehjälpare gallras
-- inte heller. "Ta in i poolen" godkänner profilen först och sätter
-- ansökans läge sedan, utan att läsa svaret på den andra skrivningen.
-- Går den inte fram står ansökan kvar som ny eller kontaktad, fast
-- personen arbetar hos oss. En AVBÖJD ansökan gallras däremot alltid:
-- den som fick nej, sökte igen och fick ja har två ansökningar, och
-- bara den andra ledde till anställning.
--
--
-- ETT ÅR FRÅN ANSÖKAN, MEN INTE MITT I EN REKRYTERING
--
-- Klockan går från created_at, för det är vad policyn lovar. Men
-- policyn säger också "så att vi kan höra av oss om något dyker upp",
-- och den som hörs av i månad elva ska inte få ansökan borttagen mitt
-- i mötet eller provet. En ansökan väntar därför till trettio dagar
-- efter sitt senaste steg: kontakten, mötet, det hållna mötet,
-- utbildningsmötet, provets sista dag, det godkända provet,
-- utbildningen. Ett steg framåt i tiden, ett bokat möte, räknas från
-- sin egen dag. intern.ansokan_gallras_fran() är regeln, och det enda
-- stället den står. Får rekryteringen ett nytt steg med en egen
-- tidsstämpel ska det stå där.
--
--
-- FILEN FÖRST, RADEN SEDAN — OCH DATABASEN VAKTAR ORDNINGEN
--
-- storage.objects har satstriggern protect_objects_delete: en rad där
-- går inte att ta bort med SQL, bara genom Storage-API:t, som också
-- tar bort själva filen. Gallringen görs därför av edge-funktionen
-- ansokan-gallring, med service_role:
--
--   pg_cron ansokan-gallring, varje natt    (egen migration, efter provet)
--     → intern.ansokan_gallring_vack()      finns det något att göra?
--     → pg_net → ansokan-gallring           hemligheten i x-nextrum-notis
--         → ansokan_gallring_lista()        ansökan och dess filer
--         → Storage tar bort filerna        svaret läses
--         → ansokan_gallra(id)              raden, om filerna är borta
--         → cv_foraldralosa() → Storage     filer som ingen ansökan pekar ut
--
-- ansokan_gallra() tar inte bort raden så länge en av dess filer finns
-- kvar i storage.objects. Ordningen hänger alltså inte på att
-- funktionen kommer ihåg den. Försvinner raden först är sökvägen borta,
-- för den står bara i why, och filen går inte längre att koppla till
-- någon.
--
--
-- KOPPLINGEN ÄR EN RAD I why
--
-- NX.kopplaAnsökan skriver "CV: cv/<sökväg>" på en egen rad, och CV_RAD
-- i nextrum-admin-rekrytering.js läser den. Här läses raden av
-- intern.ansokan_cv_namn(), och bara namn som faktiskt finns i hinken
-- cv lämnas ut till funktionen, som alltså aldrig tolkar något själv.
-- Tolkningen är med flit vidare än CV_RAD: en för snäv tolkning hade
-- fått varje CV att se föräldralöst ut.
--
-- En fil som två ansökningar pekar ut tas bort först när ingen av dem
-- ska vara kvar.
--
--
-- FÖRÄLDRALÖSA FILER: SAMMA ÅR, RÄKNAT FRÅN UPPLADDNINGEN
--
-- En uppladdning där ansökan sedan inte gick att spara, eller en rad
-- som tagits bort för hand i dashboarden, lämnar en fil som ingen
-- ansökan pekar ut. Den gallras ett år efter uppladdningen. Året är
-- också ett skydd: ändras formatet på CV-raden utan att tolkningen här
-- följer med ser varje CV föräldralöst ut, och då tas ändå ingen fil
-- bort som inte redan var ett år gammal.
--
--
-- VAD SOM FÖLJER MED
--
-- ansokan_utskick och utbildningsprov_forsok har on delete cascade.
-- Uppgifter kopplade till ansökan tas bort i samma skrivning: de är
-- inaktuella utan den, och en uppgift som en människa skrivit kan bära
-- namnet.
--
-- Auditloggen går inte att ändra, och det är med flit. Dess rader om
-- ansökan bär bara läge och tidsstämplar, aldrig namn, adress eller
-- text, och står kvar. Borttagningen får en egen rad, ansokan.borttagen,
-- med läget och tidsstämplarna som visar att ansökan var förfallen. Egen
-- trigger och inte en rad till i applications_audit: den skrivs om av
-- rekryteringens egna migrationer (senast Fas 22.1), och en
-- borttagningsgren där hade försvunnit nästa gång.
--
--
-- ETT TRASIGT SYSTEM SKA INTE SE UT SOM ETT SOM INTE HAR NÅGOT ATT GÖRA
--
-- intern.ansokan_gallring_vack() räknar också det som borde ha varit
-- borta för en vecka sedan, och finns det något skapas uppgiften
-- "Gallringen av ansökningar har fastnat". Vakten räknar utfallet, inte
-- vägen: en funktion som svarar 401, en fil Storage vägrar ta bort och
-- en rad som väntar på sin fil syns alla där. Den körs i databasen,
-- för är det funktionen som är trasig är databasen det enda som
-- fortfarande kör.
--
--
-- INGET SCHEMA ÄN
--
-- Fas 7:s regel: ett jobb schemaläggs när det gått att köra och läsa
-- för hand, aldrig före. Jobbet kommer i en egen migration efter provet
-- mot driften.
-- ============================================================

-- ---------- 1. vart funktionen bor ----------
alter table public.notis_konfig add column if not exists gallring_url text;

comment on column public.notis_konfig.gallring_url is
  'Adressen till edge-funktionen ansokan-gallring. intern.ansokan_gallring_vack() väcker den med pg_net '
  'och hemligheten i x-nextrum-notis. Null betyder att ingenting gallras, och efter en vecka blir det en uppgift.';

-- Härledd ur arbetarens adress, som ansokan_url i Fas 16.1: samma
-- projekt, samma bas, och ingen projektreferens hårdkodad i en migration.
update public.notis_konfig
   set gallring_url = regexp_replace(arbetare_url, '/notis-ko/?$', '/ansokan-gallring')
 where id = 1 and gallring_url is null and arbetare_url ~ '/notis-ko/?$';

-- ---------- 2. CV-raderna i en ansökan ----------
-- Varje rad som börjar med "CV: cv/", och namnet efter den. Raden
-- "CV: bifogad fil … kunde inte laddas upp" har ingen sökväg och ger
-- ingenting. \r och mellanslag i kanterna bort: fritexten före kan ha
-- Windows-radbrytningar.
create or replace function intern.ansokan_cv_namn(p_why text)
returns text[]
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(array_agg(x.namn), '{}')
    from (select nullif(btrim(m[1], E' \r'), '') as namn
            from regexp_matches(coalesce(p_why, ''), '^CV: cv/(.+)$', 'gn') as m) x
   where x.namn is not null
$$;

-- ---------- 3. regeln ----------
-- Från och med när ansökan ska vara borta. Null: aldrig, efter den här
-- regeln. Se huvudet för varför varje gren finns.
create or replace function intern.ansokan_gallras_fran(a public.applications)
returns timestamptz
language sql
stable
set search_path = public, pg_temp
as $$
  select case
    when a.status = 'approved' then null
    when a.status <> 'rejected'
         and intern.epost_nyckel(a.email) <> ''
         and exists (
           select 1
             from public.profiles p
             join public.tutor_profiles t on t.id = p.id
            where t.status = 'approved'
              and intern.epost_nyckel(p.email) = intern.epost_nyckel(a.email)) then null
    else greatest(
           a.created_at + interval '1 year',
           greatest(a.kontaktad_at, a.mote_tid, a.intervju_at, a.utbildningsmote_at,
                    (a.prov_sista_dag + 1)::timestamp at time zone 'Europe/Stockholm',
                    a.prov_godkant_at, a.utbildad_at) + interval '30 days')
  end
$$;

-- ---------- 4. filer som ingen ansökan pekar ut ----------
create or replace function intern.cv_utan_ansokan(p_aldre_an interval)
returns table (namn text, uppladdad timestamptz)
language sql
stable
set search_path = public, pg_temp
as $$
  with pekade as (
    select distinct unnest(intern.ansokan_cv_namn(a.why)) as namn
      from public.applications a
  )
  select o.name, o.created_at
    from storage.objects o
   where o.bucket_id = 'cv'
     and o.created_at < now() - p_aldre_an
     and not exists (select 1 from pekade p where p.namn = o.name)
$$;

-- ---------- 5. vad funktionen får veta ----------
-- De förfallna ansökningarna, äldst först, med de filer som ska bort
-- innan raden kan tas bort. En fil som en ansökan som ska vara kvar
-- pekar ut hör till den och står inte med.
create or replace function public.ansokan_gallring_lista(p_grans integer default 50)
returns table (ansokan_id uuid, filer text[])
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with forfallna as (
    select a.id, a.why, a.created_at
      from public.applications a
     where intern.ansokan_gallras_fran(a) <= now()
  ),
  kvar as (
    select distinct unnest(intern.ansokan_cv_namn(a.why)) as namn
      from public.applications a
     where not exists (select 1 from forfallna f where f.id = a.id)
  )
  select f.id,
         coalesce((select array_agg(o.name order by o.name)
                     from storage.objects o
                    where o.bucket_id = 'cv'
                      and o.name = any (intern.ansokan_cv_namn(f.why))
                      and not exists (select 1 from kvar k where k.namn = o.name)), '{}')
    from forfallna f
   order by f.created_at
   limit greatest(coalesce(p_grans, 50), 1)
$$;

-- Filer i cv som ingen ansökan pekar ut, uppladdade för mer än ett år
-- sedan. Äldst först.
create or replace function public.cv_foraldralosa(p_grans integer default 100)
returns table (namn text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.namn
    from intern.cv_utan_ansokan(interval '1 year') u
   order by u.uppladdad
   limit greatest(coalesce(p_grans, 100), 1)
$$;

-- ---------- 6. raden, när filerna är borta ----------
-- Utfall: 'borttagen', 'finns_inte', 'inte_forfallen' (regeln prövas
-- igen här, inte bara i listan: ett möte kan ha bokats sedan dess) och
-- 'filen_finns_kvar'.
create or replace function public.ansokan_gallra(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  a    public.applications%rowtype;
  fran timestamptz;
begin
  -- Låst, så att ett klick i adminvyn under tiden antingen hinner före
  -- och flyttar dagen, eller väntar tills raden är borta.
  select * into a from public.applications x where x.id = p_id for update;
  if not found then
    return 'finns_inte';
  end if;

  fran := intern.ansokan_gallras_fran(a);
  if fran is null or fran > now() then
    return 'inte_forfallen';
  end if;

  -- Filen först. Varje fil raden pekar ut ska vara borta ur hinken,
  -- utom den som en ansökan som ska vara kvar också pekar ut.
  if exists (
    select 1
      from storage.objects o
     where o.bucket_id = 'cv'
       and o.name = any (intern.ansokan_cv_namn(a.why))
       and not exists (
         select 1 from public.applications b
          where b.id <> a.id
            and o.name = any (intern.ansokan_cv_namn(b.why))
            and coalesce(intern.ansokan_gallras_fran(b) > now(), true))) then
    return 'filen_finns_kvar';
  end if;

  delete from public.uppgifter u
   where u.kopplad_tabell = 'applications' and u.kopplad_id = a.id::text;
  delete from public.applications x where x.id = a.id;
  return 'borttagen';
end $$;

-- ---------- 7. borttagningen i auditloggen ----------
drop trigger if exists applications_audit_borttagen on public.applications;
create trigger applications_audit_borttagen
  after delete on public.applications
  for each row execute function public.logga_andring('ansokan', 'id', 'status', 'created_at',
    'kontaktad_at', 'mote_tid', 'intervju_at', 'utbildningsmote_at', 'prov_sista_dag',
    'prov_godkant_at', 'utbildad_at');

-- ---------- 8. väckningen och vakten ----------
-- Väcker funktionen bara när det finns något att göra. Svaret är till
-- för den som kör den för hand; pg_cron läser det inte.
create or replace function intern.ansokan_gallring_vack()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  k           public.notis_konfig%rowtype;
  ansokningar integer;
  filer       integer;
  fastnade    integer;
  begaran     bigint;
begin
  select count(*) into ansokningar
    from public.applications a
   where intern.ansokan_gallras_fran(a) <= now();
  select count(*) into filer from intern.cv_utan_ansokan(interval '1 year');

  select (select count(*) from public.applications a
           where intern.ansokan_gallras_fran(a) <= now() - interval '7 days')
       + (select count(*) from intern.cv_utan_ansokan(interval '1 year 7 days'))
    into fastnade;

  if fastnade > 0 then
    perform public.skapa_uppgift(
      'Gallringen av ansökningar har fastnat',
      'gallring:ansokan:fastnat',
      'problem',
      fastnade || ' ansökningar eller CV-filer skulle ha tagits bort för mer än en vecka sedan, '
        || 'och integritetspolicyn lovar högst ett år. Svaret från edge-funktionen ansokan-gallring '
        || 'står i net._http_response och dess logg i Supabase. CLAUDE.md, avsnitt 5: Gallringen.',
      null, null, (now() at time zone 'Europe/Stockholm')::date);
  end if;

  if ansokningar + filer > 0 then
    select * into k from public.notis_konfig where id = 1;
    if k.gallring_url is not null and k.hemlighet is not null then
      select net.http_post(
        url := k.gallring_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-nextrum-notis', k.hemlighet),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000) into begaran;
    end if;
  end if;

  return jsonb_build_object('ansokningar', ansokningar, 'foraldralosa', filer,
                            'fastnade', fastnade, 'begaran', begaran);
end $$;

-- ---------- 9. rättigheterna ----------
-- Bara service_role når dörrarna, och bara postgres (pg_cron) väcker.
revoke execute on function intern.ansokan_cv_namn(text) from public, anon, authenticated;
revoke execute on function intern.ansokan_gallras_fran(public.applications) from public, anon, authenticated;
revoke execute on function intern.cv_utan_ansokan(interval) from public, anon, authenticated;
revoke execute on function intern.ansokan_gallring_vack() from public, anon, authenticated;
revoke execute on function public.ansokan_gallring_lista(integer) from public, anon, authenticated;
revoke execute on function public.cv_foraldralosa(integer) from public, anon, authenticated;
revoke execute on function public.ansokan_gallra(uuid) from public, anon, authenticated;
grant execute on function public.ansokan_gallring_lista(integer) to service_role;
grant execute on function public.cv_foraldralosa(integer) to service_role;
grant execute on function public.ansokan_gallra(uuid) to service_role;
