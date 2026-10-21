-- ============================================================
-- NEXTRUM — Nex skriver månadsrapporten av sig själv (2026-10-21)
--
-- Leo: "det är ju bra att den automatiskt ger en inblick i läget av
-- företaget varje månad". Drift-agenten svarade bara på fråga, och en
-- rapport som ingen ber om blir aldrig skriven. Den här migrationen
-- väcker edge-funktionen nex-manadsrapport den 1:a varje månad, som
-- skriver förra månadens rapport och lägger en uppgift om att den är
-- klar (Att göra, och morgonmejlet kl. 9).
--
-- Samma mönster som månadskörningen (manadskorningen_vacks_av_databasen):
-- adressen i notis_konfig, härledd ur arbetarens, hemligheten i
-- x-nextrum-notis, och en uppgift om något saknas.
--
-- 06.13 UTC den 1:a: två timmar efter månadskörningen (04.17), så att
-- förra månadens löneunderlag finns när Nex läser utbetalt.
-- ============================================================

-- ---------- 1. vart funktionen bor ----------
alter table public.notis_konfig add column if not exists nex_url text;

comment on column public.notis_konfig.nex_url is
  'Adressen till edge-funktionen nex-manadsrapport. intern.nex_manadsrapport_vack() väcker den den 1:a '
  'varje månad med pg_net och hemligheten i x-nextrum-notis. Null betyder att ingen rapport skrivs av '
  'sig själv, och då blir det en uppgift.';

update public.notis_konfig
   set nex_url = regexp_replace(arbetare_url, '/notis-ko/?$', '/nex-manadsrapport')
 where id = 1 and nex_url is null and arbetare_url ~ '/notis-ko/?$';

-- ---------- 2. väckningen ----------
create or replace function intern.nex_manadsrapport_vack()
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

  if k.nex_url is null or k.hemlighet is null then
    perform public.skapa_uppgift(
      'Nex månadsrapport kunde inte starta',
      'nex-manad:adress',
      'problem',
      'notis_konfig saknar nex_url eller hemligheten, så förra månadens rapport skrevs inte av sig själv. '
        || 'Tryck Skriv nu under Nex månadsrapport på Översikt, och sätt adressen: migrationen nex_manadsrapport.',
      null, null, (now() at time zone 'Europe/Stockholm')::date);
    return jsonb_build_object('begaran', null, 'orsak', 'adressen eller hemligheten saknas');
  end if;

  -- Två minuter: sex läsningar och ett modellanrop. Standarden i natanrop
  -- är fem sekunder, och ett anrop som tar slut på tiden står som fel.
  select intern.natanrop('nex-manadsrapport',
    url := k.nex_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-nextrum-notis', k.hemlighet),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000) into begaran;

  return jsonb_build_object('begaran', begaran);
end $$;

comment on function intern.nex_manadsrapport_vack() is
  'Väcker nex-manadsrapport, som skriver Nex rapport om förra månaden. pg_cron nex-manadsrapport kör den '
  'den 1:a varje månad. En rapport per månad: finns den redan skrivs den inte om.';

-- Bara postgres, alltså pg_cron. anon och authenticated har USAGE på
-- intern, så EXECUTE måste tas bort uttryckligen.
revoke execute on function intern.nex_manadsrapport_vack() from public, anon, authenticated;

-- ---------- 3. schemat ----------
select cron.unschedule(jobid) from cron.job where jobname = 'nex-manadsrapport';
select cron.schedule('nex-manadsrapport', '13 6 1 * *', $$select intern.nex_manadsrapport_vack()$$);
