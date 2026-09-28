-- ============================================================
-- Notisfelen är bara databasens egna utskick
--
-- System → Fel visade 8 fel den 27 september. Tre var samma fel i
-- adminvyns kod (auditloggen, rättad i samma ändring). De fem andra var
-- inga utskick alls: två sessioner hade provat klippkort-betala,
-- notis-ko och ansokan-gallring efter att ha driftsatt dem, genom
-- pg_net utan hemligheten och en gång med GET. Funktionerna svarade som
-- de ska, 401 och 405, och svaren stod sedan i sex timmar som "notiser
-- som inte gick fram", också på översikten.
--
-- notisfel() läste hela net._http_response, och där hamnar varje
-- anrop genom pg_net, vem som än gjort det. Tabellen har ingen adress,
-- så svaret säger inte vart anropet gick. Ett prov och ett utskick med
-- fel hemlighet ger samma 401, och det senare är precis det listan
-- finns för (Fas 4.3: en hemlighet gav 401 på varje anmälan i veckor).
-- Skillnaden går alltså bara att se när anropet görs.
--
-- Därför går databasens egna anrop nu genom intern.natanrop(), som
-- minns anropets id och vilken väg det gällde. Webhooken för
-- intresseanmälan minns redan sina i supabase_functions.hooks.
-- notisfel() visar bara svar på de anropen, och säger vilken väg det
-- var. Ett anrop som går förbi intern.natanrop syns inte när det går
-- fel: rls-test.sql har en rad som fångar nästa funktion som ringer
-- net.http_post direkt.
--
-- Svaren finns fortfarande bara i sex timmar (pg_net.ttl). Listan
-- svarar på "gick det fram nyss?", inte på "vad hände i natt?".
-- ============================================================

create table if not exists intern.natanrop_logg (
  id     bigint primary key,   -- net.http_post:s id, samma som net._http_response.id
  mal    text not null check (length(mal) between 1 and 60),
  skapad timestamptz not null default now()
);

-- Bara databasen själv. intern exponeras inte av PostgREST, och ingen
-- roll utom ägaren har något att göra här.
revoke all on intern.natanrop_logg from public, anon, authenticated, service_role;

comment on table intern.natanrop_logg is
  'Id:t på varje pg_net-anrop databasen själv gjort, och vilken väg det gällde. Skrivs bara av intern.natanrop(). notisfel() visar bara svar på de här anropen och på webhooken för intresseanmälan.';

-- Parametrarna heter som net.http_post:s, så att ett anrop blir ett
-- anrop hit genom att bara få målet först:
--   net.http_post(url := …)  →  intern.natanrop('notis-ko', url := …)
create or replace function intern.natanrop(
  mal text,
  url text,
  headers jsonb default '{"Content-Type": "application/json"}'::jsonb,
  body jsonb default '{}'::jsonb,
  timeout_milliseconds integer default 5000)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  begaran bigint;
begin
  begaran := net.http_post(
    url := natanrop.url,
    body := natanrop.body,
    headers := natanrop.headers,
    timeout_milliseconds := natanrop.timeout_milliseconds);

  -- Ett id som kommer tillbaka (pg_net installerat på nytt) gäller det
  -- senaste anropet, inte det gamla.
  insert into intern.natanrop_logg (id, mal)
  values (begaran, natanrop.mal)
  on conflict (id) do update set mal = excluded.mal, skapad = now();

  -- pg_net glömmer svaren efter sex timmar. En vecka räcker med råge,
  -- och tabellen blir aldrig större än en veckas anrop.
  delete from intern.natanrop_logg where skapad < now() - interval '7 days';

  return begaran;
end $$;

revoke execute on function intern.natanrop(text, text, jsonb, jsonb, integer) from public, anon, authenticated;

comment on function intern.natanrop(text, text, jsonb, jsonb, integer) is
  'Enda vägen ut genom pg_net. Som net.http_post, men minns anropets id och mål i intern.natanrop_logg, så att notisfel() kan skilja databasens egna utskick från ett prov. Ring aldrig net.http_post direkt.';

-- ------------------------------------------------------------
-- De tre som ringde net.http_post direkt
--
-- Lappas i stället för att skrivas om: flera sessioner ändrar i samma
-- databas (CLAUDE.md, avsnitt 5), och ansokan_gallring_vack kom till i
-- en annan gren samma eftermiddag. Varje funktion ska ringa exakt en
-- gång; annars stannar migrationen i stället för att gissa.
-- ------------------------------------------------------------
do $$
declare
  f   text;
  m   text;
  def text;
  n   integer;
begin
  for f, m in
    select v.funktion, v.mal from (values
      ('public.notis_minut()',               'notis-ko'),
      ('intern.ansokan_besked_skicka(uuid)', 'ansokan-notis'),
      ('intern.ansokan_gallring_vack()',     'ansokan-gallring')) as v(funktion, mal)
  loop
    if to_regprocedure(f) is null then
      raise notice '% finns inte här, hoppas över', f;
      continue;
    end if;
    def := pg_get_functiondef(to_regprocedure(f));
    n := (length(def) - length(replace(def, 'net.http_post(', ''))) / length('net.http_post(');
    if n <> 1 then
      raise exception '% ringer net.http_post % gånger, väntat en', f, n;
    end if;
    execute replace(def, 'net.http_post(', format('intern.natanrop(%L, ', m));
  end loop;
end $$;

-- ------------------------------------------------------------
-- notisfel(): samma fråga, bara om de egna anropen
--
-- kalla är vägen: notis-ko, ansokan-notis, ansokan-gallring eller
-- lead-notis. grindfel är Supabases egen kod när det var grinden och
-- inte funktionen som nekade (sb-error-code): UNAUTHORIZED_… betyder
-- att JWT-kravet slagits på igen (supabase/config.toml), och det är ett
-- annat fel än en hemlighet som inte stämmer, fast båda är 401.
-- Svarskroppen lämnas fortfarande aldrig ut.
--
-- Returtypen ändras, och den går inte att ändra med create or replace.
-- ------------------------------------------------------------
drop function if exists public.notisfel(integer);

create function public.notisfel(timmar integer default 24)
returns table (id bigint, tidpunkt timestamptz, status_kod integer, tog_slut boolean, fel text,
               kalla text, grindfel text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select r.id, r.created, r.status_code, r.timed_out,
         left(coalesce(r.error_msg, ''), 300),
         coalesce(a.mal, case h.hook_name when 'ny-intresseanmalan' then 'lead-notis' else h.hook_name end),
         left(r.headers ->> 'sb-error-code', 60)
    from net._http_response r
    left join intern.natanrop_logg a on a.id = r.id
    left join supabase_functions.hooks h
           on h.request_id = r.id and h.created_at > now() - interval '8 days'
   where public.is_admin()
     and (a.id is not null or h.id is not null)
     and r.created > now() - make_interval(hours => greatest(1, least(coalesce(timmar, 24), 168)))
     and (r.status_code is null or r.status_code >= 400 or r.error_msg is not null)
   order by r.created desc
   limit 200
$$;

revoke execute on function public.notisfel(integer) from public, anon;
grant execute on function public.notisfel(integer) to authenticated;

comment on function public.notisfel(integer) is
  'Utskick databasen själv gjort (intern.natanrop, webhooken för intresseanmälan) som inte gick fram de senaste timmarna. pg_net sparar svaren i sex timmar. Bara admin: is_admin() står i WHERE, så en icke-admin får noll rader.';
