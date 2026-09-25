-- ============================================================
-- NEXTRUM — Fas 16.1: den som söker får besked i varje steg
--
-- En intresseanmälan har fått ett kvitto sedan länge. En ansökan om
-- att bli studiehjälpare fick ingenting: ingen trigger, inget mejl,
-- bara tystnad tills någon hos oss hann skriva för hand. Den som
-- söker vet därför aldrig om ansökan kommit fram, och än mindre var
-- i processen hen står.
--
-- Nu får hen ett mejl när ansökan kommit in och ett när hen flyttas
-- framåt: mötet bokat (och ombokat), mötet hållet, introduktionen
-- klar, godkänd. Varje mejl visar alla fyra stegen och vilket hen
-- står på.
--
--
-- DATABASEN BESTÄMMER VILKET MEJL, FUNKTIONEN SKICKAR DET
--
-- Triggern ansokan_besked jämför gammalt och nytt och lägger en rad
-- per besked i ansokan_utskick. Nyckeln (ansokan, steg) är unik, så
-- ett steg som ångras och görs om mejlas inte två gånger. Mötet är
-- undantaget: dess nyckel bär tiden och länken, så en ny tid ger ett
-- nytt mejl och samma tid inget.
--
-- Rader skickas av edge-funktionen ansokan-notis, som väcks med
-- pg_net och samma delade hemlighet som notis-ko. Adressen står i
-- notis_konfig.ansokan_url, inte i triggerns definition: leads-
-- webhooken bär sin hemlighet i klartext i pg_trigger, och en
-- hemlighet som ska kunna roteras i en transaktion hör inte hemma där.
--
--
-- BARA KVITTOT KAN UTLÖSAS UTIFRÅN
--
-- applications tar emot INSERT från vem som helst. Triggerns INSERT-
-- gren tittar därför bara på ett steg, mottagen, och läser ingenting
-- annat ur raden. Stegmejlen utlöses bara av UPDATE, och UPDATE är
-- admin-only i policyn.
--
-- skydda_ansokningsfalt nollade redan läget och tidsstämplarna på en
-- insert utifrån, men INTE mote_tid och mote_lank, som kom till i Fas
-- 13.1. De är Nextrums fält, satta av admin. Utan den här rättelsen
-- hade vem som helst kunnat skicka in en ansökan med en främlings
-- adress och en egen länk, och ett mötesmejl byggt på fälten hade
-- blivit en DKIM-signerad nätfiskelänk från info@nextrum.se. Fälten
-- nollas nu på samma sätt som de andra.
--
--
-- BROMSARNA PÅ KVITTOT
--
-- Samma som lead-notis, av samma skäl: en öppen INSERT och ett kvitto
-- till en adress som den som postar väljer är en mejlbomb på vår
-- domän. En adress får ett kvitto per dygn, och kommer det fler än
-- fem ansökningar på en minut går inga kvitton ut förrän det lugnat
-- sig. Raden skrivs ändå, som 'bromsad' med skälet, så att det syns.
--
--
-- AVBÖJD FÅR INGET AUTOMATISKT MEJL, MED FLIT
--
-- Ett nej ska skrivas av en människa. Det är ofta en sextonåring som
-- söker sitt första jobb, och ett felklick på "Avböjd" som genast
-- mejlar ett nej går inte att ta tillbaka.
-- ============================================================

-- ---------- 1. mote_tid och mote_lank sätts av Nextrum ----------
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
  end if;
  return new;
end $function$;

-- ---------- 2. vart funktionen bor ----------
alter table public.notis_konfig add column if not exists ansokan_url text;

comment on column public.notis_konfig.ansokan_url is
  'Adressen till edge-funktionen ansokan-notis. Triggern ansokan_besked väcker den med pg_net '
  'och hemligheten i x-nextrum-notis. Null betyder att inga ansökningsmejl skickas.';

-- Härledd ur arbetarens adress i stället för skriven: samma projekt,
-- samma bas, och ingen projektreferens hårdkodad i en migration.
update public.notis_konfig
   set ansokan_url = regexp_replace(arbetare_url, '/notis-ko/?$', '/ansokan-notis')
 where id = 1 and ansokan_url is null and arbetare_url ~ '/notis-ko/?$';

-- ---------- 3. ett besked per rad ----------
create table if not exists public.ansokan_utskick (
  id            uuid primary key default gen_random_uuid(),
  ansokan_id    uuid not null references public.applications(id) on delete cascade,
  steg          text not null
                check (steg in ('mottagen', 'mote', 'utbildning', 'sista_steget', 'valkommen')),
  nyckel        text not null,
  status        text not null default 'vantar'
                check (status in ('vantar', 'skickar', 'skickad', 'fel', 'bromsad', 'hoppad')),
  forsok        integer not null default 0,
  lanad_till    timestamptz,
  fel           text,
  leverantor_id text,
  skapad        timestamptz not null default now(),
  uppdaterad    timestamptz not null default now(),
  unique (ansokan_id, nyckel)
);

comment on table public.ansokan_utskick is
  'Mejlen till den som sökt jobb: kvittot och ett per steg. Skrivs av triggern ansokan_besked, '
  'skickas av ansokan-notis. (ansokan_id, nyckel) är unik, så ett steg mejlas en gång. '
  'Ingen brödtext och ingen adress lagras här — de läses ur ansökan när mejlet skrivs.';

create index if not exists ansokan_utskick_igen on public.ansokan_utskick (status, uppdaterad)
  where status in ('vantar', 'skickar', 'fel');

alter table public.ansokan_utskick enable row level security;
revoke all on public.ansokan_utskick from anon, authenticated;
grant select on public.ansokan_utskick to authenticated;

drop policy if exists "admin läser ansökningsbeskeden" on public.ansokan_utskick;
create policy "admin läser ansökningsbeskeden" on public.ansokan_utskick
  for select to authenticated using (public.is_admin());

-- ---------- 4. väck funktionen ----------
create or replace function intern.ansokan_besked_skicka(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  k public.notis_konfig%rowtype;
begin
  select * into k from public.notis_konfig where id = 1;
  -- Utan adress eller hemlighet ligger raden kvar som 'vantar' och syns
  -- i adminvyn. Att kasta här hade rullat tillbaka ansökan själv.
  if k.ansokan_url is null or k.hemlighet is null then
    return;
  end if;
  perform net.http_post(
    url := k.ansokan_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-nextrum-notis', k.hemlighet),
    body := jsonb_build_object('id', p_id),
    timeout_milliseconds := 15000);
end $$;

create or replace function intern.ansokan_besked_koa(
  p_ansokan uuid, p_steg text, p_nyckel text, p_bromsad text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.ansokan_utskick (ansokan_id, steg, nyckel, status, fel)
  values (p_ansokan, p_steg, p_nyckel,
          case when p_bromsad is null then 'vantar' else 'bromsad' end, p_bromsad)
  on conflict (ansokan_id, nyckel) do nothing
  returning id into v_id;

  if v_id is not null and p_bromsad is null then
    perform intern.ansokan_besked_skicka(v_id);
  end if;
end $$;

-- ---------- 5. triggern ----------
create or replace function intern.ansokan_besked()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  flod  integer;
  samma integer;
  broms text := null;
begin
  -- Ett fel här får aldrig stoppa ansökan eller adminens klick. Ett
  -- uteblivet mejl är ett mindre fel än en ansökan som inte sparas.
  begin
    if tg_op = 'INSERT' then
      -- BARA kvittot. Ingenting annat i raden läses, eftersom raden
      -- kan vara skriven av vem som helst.
      select count(*) into flod from public.applications a
       where a.created_at > now() - interval '1 minute';
      select count(*) into samma from public.applications a
       where lower(a.email) = lower(new.email) and a.id <> new.id
         and a.created_at > now() - interval '24 hours';
      if flod > 5 then
        broms := 'Fler än fem ansökningar den senaste minuten.';
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

drop trigger if exists ansokan_besked on public.applications;
create trigger ansokan_besked
  after insert or update of status, mote_tid, mote_lank, intervju_at, utbildad_at
  on public.applications
  for each row execute function intern.ansokan_besked();

-- ---------- 6. funktionens två dörrar, bara för service_role ----------
create or replace function public.ansokan_besked_ta(p_id uuid)
returns table (id uuid, steg text, namn text, epost text, mote_tid timestamptz,
               mote_lank text, ombokat boolean, forsok integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.ansokan_utskick%rowtype;
  a public.applications%rowtype;
begin
  update public.ansokan_utskick u
     set status = 'skickar', forsok = u.forsok + 1,
         lanad_till = now() + interval '2 minutes', uppdaterad = now()
   where u.id = p_id
     and u.forsok < 3
     and (u.status in ('vantar', 'fel') or (u.status = 'skickar' and u.lanad_till < now()))
  returning u.* into r;
  if not found then
    return;
  end if;

  select * into a from public.applications x where x.id = r.ansokan_id;

  -- Läget kan ha ändrats sedan raden köades. Ett nej, eller ett möte
  -- som redan fått en nyare tid, ska inte ge ett mejl om det gamla.
  if a.id is null or a.status = 'rejected' then
    update public.ansokan_utskick set status = 'hoppad', fel = 'ansökan är avböjd eller borta',
           lanad_till = null, uppdaterad = now() where ansokan_utskick.id = r.id;
    return;
  end if;
  if r.steg = 'mote' and (a.mote_tid is null or r.nyckel is distinct from
       'mote:' || extract(epoch from a.mote_tid)::bigint || ':' || md5(coalesce(a.mote_lank, ''))) then
    update public.ansokan_utskick set status = 'hoppad', fel = 'mötet har fått en nyare tid',
           lanad_till = null, uppdaterad = now() where ansokan_utskick.id = r.id;
    return;
  end if;

  return query select r.id, r.steg, a.name, a.email, a.mote_tid, a.mote_lank,
    exists (select 1 from public.ansokan_utskick x
             where x.ansokan_id = r.ansokan_id and x.steg = 'mote' and x.id <> r.id
               and x.status = 'skickad'),
    r.forsok;
end $$;

create or replace function public.ansokan_besked_klar(
  p_id uuid, p_ok boolean, p_fel text, p_leverantor_id text, p_permanent boolean)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.ansokan_utskick
     set status = case when p_ok then 'skickad' else 'fel' end,
         fel = case when p_ok then null else left(p_fel, 300) end,
         leverantor_id = case when p_ok then left(p_leverantor_id, 100) else leverantor_id end,
         -- Ett fel som inte blir bättre av ett nytt försök (ogiltig adress)
         -- ska inte prövas två gånger till.
         forsok = case when p_permanent then 3 else forsok end,
         lanad_till = null, uppdaterad = now()
   where id = p_id;
$$;

revoke execute on function public.ansokan_besked_ta(uuid) from public, anon, authenticated;
revoke execute on function public.ansokan_besked_klar(uuid, boolean, text, text, boolean) from public, anon, authenticated;
grant execute on function public.ansokan_besked_ta(uuid) to service_role;
grant execute on function public.ansokan_besked_klar(uuid, boolean, text, text, boolean) to service_role;

-- ---------- 7. omförsöken ----------
-- Schemaläggs INTE här. Fas 7:s regel: ett jobb schemaläggs när det
-- gått att köra och läsa för hand, aldrig före.
create or replace function intern.ansokan_besked_igen()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select u.id from public.ansokan_utskick u
     where u.skapad > now() - interval '24 hours'
       and u.forsok < 3
       and ((u.status = 'vantar' and u.skapad < now() - interval '2 minutes')
         or (u.status = 'fel' and u.uppdaterad < now() - make_interval(mins => 5 * greatest(u.forsok, 1)))
         or (u.status = 'skickar' and u.lanad_till < now()))
     order by u.skapad
     limit 20
  loop
    perform intern.ansokan_besked_skicka(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
