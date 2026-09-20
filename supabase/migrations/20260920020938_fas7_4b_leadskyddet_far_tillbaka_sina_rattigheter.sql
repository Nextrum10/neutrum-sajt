-- ============================================================
-- NEXTRUM — Fas 7.4b: leadskyddet får tillbaka sina rättigheter
--
-- 7.4 lade till en rad i skydda_leadfalt som anropar
-- standard_tjanst() när anmälan gäller en tjänst som inte är aktiv.
-- Men 7.1b hade gjort triggern SECURITY INVOKER, och
-- standard_tjanst() har execute återkallat för anon sedan Fas 1.6.
-- Alltså: varje intresseanmälan från en besökare med en inaktiv
-- tjänstekod hade svarat
--   42501 permission denied for function standard_tjanst
-- Fångat i ett rullat prov innan någon besökare hann märka det.
--
-- Rättningen går tillbaka till SECURITY DEFINER — men det är INTE
-- att backa 7.1b. Felet där var aldrig DEFINER i sig, utan att
-- undantaget läste current_user, som i en DEFINER-ram är funktionens
-- ägare och därmed alltid matchade. Undantaget läser nu förfrågans
-- egna claims, som ingen funktionsram ändrar.
--
-- Den tredje grenen läser dessutom session_user, inte current_user:
-- session_user är 'authenticator' för allt som kommer via
-- PostgREST och 'postgres' bara för en riktig databasförbindelse
-- (SQL Editor, cron). SECURITY DEFINER ändrar inte session_user, så
-- grenen kan inte öppnas av ett anrop utifrån ens om claims skulle
-- saknas.
-- ============================================================

create or replace function public.skydda_leadfalt()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
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
    if new.tjanst is null
       or not exists (select 1 from public.tjanster t
                       where t.kod = new.tjanst and t.aktiv and t.for_kund) then
      new.tjanst := public.standard_tjanst();
    end if;
  else
    new.kund_id      := old.kund_id;
    new.uppdrag_id   := old.uppdrag_id;
    new.status       := old.status;
    new.kontaktad_at := old.kontaktad_at;
    new.notering     := old.notering;
  end if;
  return new;
end $$;

revoke execute on function public.skydda_leadfalt() from public, anon, authenticated;
