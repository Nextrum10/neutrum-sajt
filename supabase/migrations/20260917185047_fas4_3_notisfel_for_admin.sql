-- ============================================================
-- NEXTRUM — Fas 4.3: admin kan se notiser som inte gick fram
--
-- Notiserna skickas av databastriggrar via pg_net. Triggern sväljer
-- felet med flit: en intresseanmälan ska sparas även när mejlet om
-- den inte går att skicka. Priset är att ett misslyckat utskick inte
-- syns någonstans i appen — spåret finns bara i net._http_response,
-- ett schema ingen roll utom postgres får läsa.
--
-- Det gjorde att en trasig notis kunde pågå i veckor. Precis så låg
-- hemligheten "openssl rand -hex 32" och gav 401 på varje anmälan,
-- utan att någon såg det.
--
-- Funktionen är SECURITY DEFINER och kontrollerar is_admin() FÖRST.
-- Den lämnar ut statuskod, tidpunkt och felmeddelande — aldrig
-- svarskroppen, som kan innehålla uppgifter ur anmälan.
--
-- Raderna är färskvara: pg_net städar bort svar efter några timmar.
-- Vyn svarar alltså på "gick det fram nyss?", inte på "vad hände i
-- augusti?". Ett riktigt utskickslager hör till Fas 9.
-- ============================================================

create or replace function public.notisfel(timmar integer default 24)
returns table (id bigint, tidpunkt timestamptz, status_kod integer, tog_slut boolean, fel text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select r.id, r.created, r.status_code, r.timed_out,
         left(coalesce(r.error_msg, ''), 300)
    from net._http_response r
   where public.is_admin()
     and r.created > now() - make_interval(hours => greatest(1, least(coalesce(timmar, 24), 168)))
     and (r.status_code is null or r.status_code >= 400 or r.error_msg is not null)
   order by r.created desc
   limit 200
$$;

revoke execute on function public.notisfel(integer) from public, anon;
grant execute on function public.notisfel(integer) to authenticated;

comment on function public.notisfel(integer) is
  'Notisutskick som inte gick fram de senaste timmarna. Bara admin: is_admin() står i WHERE, så en icke-admin får noll rader.';
