-- ============================================================
-- nyheter (2026-10-30): nyheterna på /nyheter, och ett mejl till
-- nyhetsbrevet när en nyhet publiceras.
--
-- Leo: "bygg en sida för nyhetsbrev, nyheter och när vi postar de får
-- medlemmar automatiskt mejl om de nyheterna".
--
-- En nyhet skrivs i adminvyn (Nyheter), bara av en superadmin och bara
-- genom funktionerna nedan. Den är ett utkast tills den publiceras, och
-- då syns den på /nyheter för alla. Publiceras den med mejl väcker
-- databasen edge-funktionen nyheter-utskick, som mejlar varje bekräftad
-- adress i nyhetsbrevet (tabellen nyhetsbrev, 20261028120000) i partier
-- om hundra. Varje adress får nyheten en gång: nyheter_utskick har en
-- rad per nyhet och adress, och partiet bär Resends idempotensnyckel.
--
-- VEM SOM FÅR MEJLET: den som bekräftat sin adress senast när nyheten
-- publicerades. En som bekräftar efteråt får nästa nyhet, inte den här
-- (annars hade ett omförsök en vecka senare mejlat en gammal nyhet till
-- den som just anmält sig).
--
-- OMFÖRSÖK: ett parti som tagits men inte skickats tas igen efter tio
-- minuter (funktionen dog, nätet glappade), och jobbet nyheter-utskick
-- väcker funktionen var tionde minut så länge en nyhet har mottagare
-- kvar. Ett parti som Resend nekat tre gånger ges upp och blir en
-- uppgift; de adresserna får inte nyheten.
--
-- GALLRINGEN: raderna i nyheter_utskick säger vilken adress som fått
-- vilken nyhet. De står så länge adressen står i nyhetsbrevet och går
-- med den (on delete cascade): en avanmälan raderar dem. DATASKYDD.md
-- rad 40.
--
-- Ingen delete i någon funktion: en nyhet tas inte bort utan döljs
-- (dold_at), och ett utkast som inte ska ut döljs likadant.
-- ============================================================

-- ---------- 1. nyheterna ----------
create table public.nyheter (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 90),
  rubrik        text not null check (length(btrim(rubrik)) between 3 and 140),
  ingress       text check (length(ingress) <= 400),
  text          text not null check (length(btrim(text)) between 1 and 20000),
  publicerad_at timestamptz,
  dold_at       timestamptz,
  mejlas        boolean not null default false,
  mejlad_at     timestamptz,
  mejl_antal    integer not null default 0,
  skapad_av     uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  andrad_at     timestamptz not null default now()
);

create index nyheter_publicerad on public.nyheter (publicerad_at desc) where publicerad_at is not null and dold_at is null;

alter table public.nyheter enable row level security;
revoke all on public.nyheter from anon, authenticated, service_role;

-- Den publika läsningen: bara det sidan visar, och bara publicerat och
-- inte dolt. Utkasten, mejlets läge och vem som skrev läser adminvyn
-- genom nyheter_admin().
grant select (id, slug, rubrik, ingress, text, publicerad_at) on public.nyheter to anon, authenticated;

create policy "nyheter publicerade" on public.nyheter
  for select to anon, authenticated
  using (publicerad_at is not null and publicerad_at <= now() and dold_at is null);

comment on table public.nyheter is
  'Nyheterna på /nyheter. Skrivs bara genom nyhet_spara, nyhet_publicera och nyhet_dolj (superadmin). '
  'Publicerad med mejlas = true mejlas till nyhetsbrevet av edge-funktionen nyheter-utskick.';

-- ---------- 2. vem som fått vilken nyhet ----------
create table public.nyheter_utskick (
  nyhet_id      uuid not null references public.nyheter(id),
  nyhetsbrev_id uuid not null references public.nyhetsbrev(id) on delete cascade,
  parti         uuid not null,
  tagen_at      timestamptz not null default now(),
  skickad_at    timestamptz,
  forsok        integer not null default 0,
  gav_upp_at    timestamptz,
  primary key (nyhet_id, nyhetsbrev_id)
);

create index nyheter_utskick_parti on public.nyheter_utskick (parti);
create index nyheter_utskick_kvar on public.nyheter_utskick (nyhet_id) where skickad_at is null and gav_upp_at is null;

alter table public.nyheter_utskick enable row level security;
revoke all on public.nyheter_utskick from anon, authenticated, service_role;

comment on table public.nyheter_utskick is
  'En rad per nyhet och adress i nyhetsbrevet: tagen i ett parti, skickad eller uppgiven. Går med adressen '
  'när den avanmäls. Skrivs bara av nyheter_utskick_ta, _skickad och _misslyckad. DATASKYDD.md rad 40.';

-- ---------- 3. adressen till funktionen ----------
alter table public.notis_konfig add column if not exists nyheter_url text;

comment on column public.notis_konfig.nyheter_url is
  'Adressen till edge-funktionen nyheter-utskick. intern.nyheter_vack() väcker den när en nyhet publiceras '
  'med mejl och var tionde minut så länge en nyhet har mottagare kvar. Null: inget mejlas, och det blir en uppgift.';

update public.notis_konfig
   set nyheter_url = regexp_replace(arbetare_url, '/notis-ko/?$', '/nyheter-utskick')
 where id = 1 and nyheter_url is null and arbetare_url ~ '/notis-ko/?$';

-- ---------- 4. adressen i länken ----------
-- Ur rubriken: gemener, å ä ö utan prickar, allt annat ett bindestreck.
-- Den sätts när nyheten skapas och ändras aldrig, för den står i mejlen.
create or replace function intern.nyhet_slug(p_rubrik text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  bas      text;
  kandidat text;
  n        integer := 1;
begin
  bas := lower(translate(btrim(p_rubrik), 'ÅÄÖåäöÉéÈèÜüÆæØø', 'aaoaaoeeeeuuaaoo'));
  bas := regexp_replace(bas, '[^a-z0-9]+', '-', 'g');
  bas := btrim(left(bas, 80), '-');
  if bas = '' then bas := 'nyhet'; end if;
  kandidat := bas;
  while exists (select 1 from public.nyheter where nyheter.slug = kandidat) loop
    n := n + 1;
    kandidat := bas || '-' || n;
  end loop;
  return kandidat;
end $$;

revoke all on function intern.nyhet_slug(text) from public, anon, authenticated;

-- ---------- 5. väckningen ----------
create or replace function intern.nyheter_vack()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  k       public.notis_konfig%rowtype;
  begaran bigint;
begin
  select * into k from public.notis_konfig where id = 1;

  if k.nyheter_url is null or k.hemlighet is null then
    perform public.skapa_uppgift(
      'Nyheten kunde inte mejlas',
      'nyheter:adress',
      'problem',
      'notis_konfig saknar nyheter_url eller hemligheten, så nyhetsbrevet fick inte den publicerade nyheten. '
        || 'Sätt adressen (migrationen nyheter), så mejlar jobbet nyheter-utskick inom tio minuter.',
      null, null, (now() at time zone 'Europe/Stockholm')::date);
    return jsonb_build_object('begaran', null, 'orsak', 'adressen eller hemligheten saknas');
  end if;

  -- Två minuter: funktionen skickar parti efter parti tills det är klart
  -- eller dess egen tid tar slut, och jobbet tar resten.
  select intern.natanrop('nyheter-utskick',
    url := k.nyheter_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-nextrum-notis', k.hemlighet),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000) into begaran;

  return jsonb_build_object('begaran', begaran);
end $$;

revoke execute on function intern.nyheter_vack() from public, anon, authenticated;

create or replace function intern.nyheter_vack_om_arbete()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.nyheter
              where mejlas and publicerad_at is not null and mejlad_at is null and dold_at is null) then
    perform intern.nyheter_vack();
  end if;
end $$;

revoke execute on function intern.nyheter_vack_om_arbete() from public, anon, authenticated;

-- ---------- 6. adminvyn ----------
create or replace function public.nyheter_admin()
returns table (
  id uuid, slug text, rubrik text, ingress text, text text, publicerad_at timestamptz, dold_at timestamptz,
  mejlas boolean, mejlad_at timestamptz, mejl_antal integer, mejl_uppgivna integer,
  created_at timestamptz, andrad_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'Bara en superadmin.' using errcode = '42501'; end if;
  return query
    select n.id, n.slug, n.rubrik, n.ingress, n.text, n.publicerad_at, n.dold_at,
           n.mejlas, n.mejlad_at, n.mejl_antal,
           (select count(*)::integer from public.nyheter_utskick u where u.nyhet_id = n.id and u.gav_upp_at is not null),
           n.created_at, n.andrad_at
      from public.nyheter n
     order by coalesce(n.publicerad_at, n.created_at) desc;
end $$;

-- Hur många som får nästa nyhet, och hur många som inte bekräftat än.
create or replace function public.nyhetsbrev_antal()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'Bara en superadmin.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'bekraftade', (select count(*) from public.nyhetsbrev where lage = 'bekraftad'),
    'vantar',     (select count(*) from public.nyhetsbrev where lage = 'vantar'));
end $$;

create or replace function public.nyhet_spara(p_id uuid, p_rubrik text, p_ingress text, p_text text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ut uuid;
begin
  if not public.is_admin() then raise exception 'Bara en superadmin.' using errcode = '42501'; end if;
  p_ingress := nullif(btrim(coalesce(p_ingress, '')), '');

  if p_id is null then
    insert into public.nyheter (slug, rubrik, ingress, text, skapad_av)
    values (intern.nyhet_slug(p_rubrik), btrim(p_rubrik), p_ingress, btrim(p_text), auth.uid())
    returning nyheter.id into ut;
    return ut;
  end if;

  -- En publicerad nyhet går att rätta: sidan visar det rättade, men ett
  -- mejl som gått ut är ute. Adressen (slug) ändras aldrig.
  update public.nyheter
     set rubrik = btrim(p_rubrik), ingress = p_ingress, text = btrim(p_text), andrad_at = now()
   where nyheter.id = p_id
  returning nyheter.id into ut;
  if ut is null then raise exception 'Nyheten finns inte.' using errcode = 'P0002'; end if;
  return ut;
end $$;

create or replace function public.nyhet_publicera(p_id uuid, p_mejla boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n public.nyheter%rowtype;
begin
  if not public.is_admin() then raise exception 'Bara en superadmin.' using errcode = '42501'; end if;

  select * into n from public.nyheter where id = p_id for update;
  if not found then raise exception 'Nyheten finns inte.' using errcode = 'P0002'; end if;
  if n.publicerad_at is not null then raise exception 'Nyheten är redan publicerad.' using errcode = 'P0001'; end if;

  update public.nyheter
     set publicerad_at = now(), dold_at = null, mejlas = coalesce(p_mejla, false), andrad_at = now()
   where id = p_id;

  if coalesce(p_mejla, false) then
    perform intern.nyheter_vack();
  end if;

  return jsonb_build_object(
    'mottagare', case when coalesce(p_mejla, false)
                      then (select count(*) from public.nyhetsbrev where lage = 'bekraftad')
                      else 0 end);
end $$;

-- Dölj tar nyheten från sidan och stoppar ett utskick som inte är klart.
-- Visa igen sätter tillbaka den med samma datum; ett stoppat utskick
-- fortsätter då där det slutade.
create or replace function public.nyhet_dolj(p_id uuid, p_dold boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'Bara en superadmin.' using errcode = '42501'; end if;
  update public.nyheter
     set dold_at = case when p_dold then coalesce(dold_at, now()) else null end, andrad_at = now()
   where id = p_id;
  if not found then raise exception 'Nyheten finns inte.' using errcode = 'P0002'; end if;
end $$;

revoke all on function public.nyheter_admin() from public, anon;
revoke all on function public.nyhetsbrev_antal() from public, anon;
revoke all on function public.nyhet_spara(uuid, text, text, text) from public, anon;
revoke all on function public.nyhet_publicera(uuid, boolean) from public, anon;
revoke all on function public.nyhet_dolj(uuid, boolean) from public, anon;
grant execute on function public.nyheter_admin(), public.nyhetsbrev_antal(),
  public.nyhet_spara(uuid, text, text, text), public.nyhet_publicera(uuid, boolean),
  public.nyhet_dolj(uuid, boolean) to authenticated;

-- ---------- 7. utskicket (bara edge-funktionen, med service_role) ----------

-- Nästa parti för en nyhet. Tar först ett parti som stått otaget i tio
-- minuter, sedan upp till p_antal nya adresser. En nyhet åt gången:
-- raden låses, så två körningar samtidigt tar aldrig samma adress.
-- Inget kvar: nyheten är mejlad.
create or replace function public.nyheter_utskick_ta(p_nyhet uuid, p_antal integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n       public.nyheter%rowtype;
  v_parti uuid;
  rader   jsonb;
begin
  select * into n from public.nyheter where id = p_nyhet for update;
  if not found or not n.mejlas or n.publicerad_at is null or n.mejlad_at is not null or n.dold_at is not null then
    return jsonb_build_object('klar', true, 'mottagare', '[]'::jsonb);
  end if;

  -- Ett parti som någon annan körning håller på med: vänta.
  if exists (select 1 from public.nyheter_utskick
              where nyhet_id = p_nyhet and skickad_at is null and gav_upp_at is null
                and tagen_at > now() - interval '10 minutes') then
    return jsonb_build_object('klar', false, 'vanta', true, 'mottagare', '[]'::jsonb);
  end if;

  -- Ett gammalt parti tas igen, med samma id, så att Resends
  -- idempotensnyckel säger att det redan gått om det gjorde det.
  select u.parti into v_parti from public.nyheter_utskick u
   where u.nyhet_id = p_nyhet and u.skickad_at is null and u.gav_upp_at is null
   order by u.tagen_at limit 1;

  if v_parti is not null then
    update public.nyheter_utskick set tagen_at = now() where parti = v_parti and skickad_at is null;
  else
    v_parti := gen_random_uuid();
    insert into public.nyheter_utskick (nyhet_id, nyhetsbrev_id, parti)
    select p_nyhet, b.id, v_parti
      from public.nyhetsbrev b
     where b.lage = 'bekraftad' and b.bekraftad_at <= n.publicerad_at
       and not exists (select 1 from public.nyheter_utskick u where u.nyhet_id = p_nyhet and u.nyhetsbrev_id = b.id)
     order by b.id
     limit greatest(1, least(coalesce(p_antal, 100), 100));
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('epost', b.epost, 'token', b.token) order by b.id), '[]'::jsonb)
    into rader
    from public.nyheter_utskick u join public.nyhetsbrev b on b.id = u.nyhetsbrev_id
   where u.parti = v_parti and u.skickad_at is null;

  if jsonb_array_length(rader) = 0 then
    update public.nyheter set mejlad_at = now() where id = p_nyhet;
    return jsonb_build_object('klar', true, 'mottagare', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'klar', false, 'parti', v_parti, 'mottagare', rader,
    'nyhet', jsonb_build_object('slug', n.slug, 'rubrik', n.rubrik, 'ingress', n.ingress, 'text', n.text));
end $$;

create or replace function public.nyheter_utskick_skickad(p_parti uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  antal integer;
  v_nyhet uuid;
begin
  with gjorda as (
    update public.nyheter_utskick set skickad_at = now()
     where parti = p_parti and skickad_at is null
    returning nyhet_id)
  select count(*), min(nyhet_id::text)::uuid into antal, v_nyhet from gjorda;
  if antal > 0 then
    update public.nyheter set mejl_antal = mejl_antal + antal where id = v_nyhet;
  end if;
end $$;

-- Resend sa nej till själva mejlen (ett fel som inte blir bättre av att
-- vänta). Partiet släpps direkt, så att nästa nyheter_utskick_ta tar det
-- igen i stället för att vänta tio minuter; tredje gången ges det upp och
-- blir en uppgift, och resten av utskicket fortsätter.
create or replace function public.nyheter_utskick_misslyckad(p_parti uuid, p_fel text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nyhet  uuid;
  v_forsok integer;
begin
  with gjorda as (
    update public.nyheter_utskick set forsok = forsok + 1, tagen_at = now() - interval '10 minutes'
     where parti = p_parti and skickad_at is null
    returning nyhet_id, forsok)
  select min(nyhet_id::text)::uuid, max(forsok) into v_nyhet, v_forsok from gjorda;
  if v_nyhet is null or v_forsok < 3 then return; end if;

  update public.nyheter_utskick set gav_upp_at = now() where parti = p_parti and skickad_at is null;
  perform public.skapa_uppgift(
    'Ett parti av en nyhet gick inte att mejla',
    'nyheter:gav-upp:' || v_nyhet,
    'problem',
    'Resend nekade samma parti tre gånger (' || left(coalesce(p_fel, 'okänt fel'), 200) || '). '
      || 'De adresserna får inte nyheten; resten av utskicket fortsätter. Se funktionens logg för nyheter-utskick.',
    'nyheter', v_nyhet::text, (now() at time zone 'Europe/Stockholm')::date);
end $$;

-- Nyheterna som har mottagare kvar.
create or replace function public.nyheter_att_mejla()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from public.nyheter
   where mejlas and publicerad_at is not null and mejlad_at is null and dold_at is null
   order by publicerad_at;
$$;

revoke all on function public.nyheter_utskick_ta(uuid, integer) from public, anon, authenticated;
revoke all on function public.nyheter_utskick_skickad(uuid) from public, anon, authenticated;
revoke all on function public.nyheter_utskick_misslyckad(uuid, text) from public, anon, authenticated;
revoke all on function public.nyheter_att_mejla() from public, anon, authenticated;
grant execute on function public.nyheter_utskick_ta(uuid, integer), public.nyheter_utskick_skickad(uuid),
  public.nyheter_utskick_misslyckad(uuid, text), public.nyheter_att_mejla() to service_role;

-- ---------- 8. schemat ----------
select cron.unschedule(jobid) from cron.job where jobname = 'nyheter-utskick';
select cron.schedule('nyheter-utskick', '*/10 * * * *', $$select intern.nyheter_vack_om_arbete()$$);
