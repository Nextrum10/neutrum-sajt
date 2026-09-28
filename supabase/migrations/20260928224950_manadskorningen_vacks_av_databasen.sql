-- ============================================================
-- NEXTRUM — månadskörningen väcks av databasen
--
-- Leo 2026-09-28: "skriv lönespec för månaden efter att månaden är
-- klar för studiehjälparen, under utbetalning för månaden. Så ska det
-- vara för varje månad." Lönespecifikationen i studiehjälparvyn är
-- underlaget i payouts, och underlaget skrevs bara när admin tryckte
-- Skapa utkast under Ekonomi → Månadskörning. fakturering har haft en
-- väg in för ett schema sedan Fas 2 (x-fakturering-nyckel), men schemat
-- byggdes aldrig: adminvyn sa att det kom senare. Utan det finns ingen
-- lönespec för en månad förrän någon kommer ihåg knappen, och
-- studiehjälparen ser en tom ruta.
--
-- Samma väg som notiserna och gallringen: intern.natanrop, adressen i
-- notis_konfig och hemligheten i x-nextrum-notis. Nyckelvägen hade
-- behövt FAKTURERING_NYCKEL på två ställen, som secret och i en
-- tabell, och två kopior av en hemlighet glider isär. Det var så
-- notishemligheten en gång svarade 401 på varje anmälan (CLAUDE.md
-- avsnitt 6).
--
-- fakturering skriver alltid FÖRRA månaden när anropet kommer den här
-- vägen, vad kroppen än säger. Hemligheten delas med notisfunktionerna,
-- och den som kommit över den ska inte kunna skriva ett underlag för
-- en månad som pågår. Samma underlag och samma fakturautkast som
-- knappen, och en omkörning ger inga dubbletter: unique(tutor_id,
-- period) på payouts och unique(parent_id, period) på invoices.
--
-- Går anropet fel står svaret under System → Fel (notisfel(), källan
-- fakturering), och passen larmar som ej_utbetalt tills någon kört
-- knappen. Saknas adressen eller hemligheten anropas ingenting, och
-- det blir en uppgift i stället för en tyst månad.
--
--
-- INGET SCHEMA ÄN
--
-- Fas 7:s regel: ett jobb schemaläggs när det gått att köra och läsa
-- för hand, aldrig före. Kör select intern.manadskorning_vack(true)
-- mot driften: den torrkör, skriver ingenting och svarar med förra
-- månadens sammanfattning i net._http_response. Jobbet kommer i
-- manadskorningen_gar_den_forsta.
-- ============================================================

-- ---------- 1. vart funktionen bor ----------
alter table public.notis_konfig add column if not exists fakturering_url text;

comment on column public.notis_konfig.fakturering_url is
  'Adressen till edge-funktionen fakturering. intern.manadskorning_vack() väcker den den 1:a varje månad '
  'med pg_net och hemligheten i x-nextrum-notis, och den skriver förra månadens underlag och fakturautkast. '
  'Null betyder att ingenting körs av sig självt, och då blir det en uppgift.';

-- Härledd ur arbetarens adress, som ansokan_url och gallring_url: samma
-- projekt, samma bas, och ingen projektreferens hårdkodad i en migration.
update public.notis_konfig
   set fakturering_url = regexp_replace(arbetare_url, '/notis-ko/?$', '/fakturering')
 where id = 1 and fakturering_url is null and arbetare_url ~ '/notis-ko/?$';

-- ---------- 2. väckningen ----------
-- p_torr torrkör: fakturering räknar ut allt och svarar med vad som
-- SKULLE skrivas, utan att skriva en rad. Så provas vägen för hand
-- innan jobbet schemaläggs, och efter varje ändring i den.
create or replace function intern.manadskorning_vack(p_torr boolean default false)
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

  if k.fakturering_url is null or k.hemlighet is null then
    perform public.skapa_uppgift(
      'Månadskörningen kunde inte starta',
      'manadskorning:adress',
      'problem',
      'notis_konfig saknar fakturering_url eller hemligheten, så månadens underlag och fakturautkast '
        || 'skrevs inte av sig själva, och studiehjälparna har ingen lönespecifikation för förra månaden. '
        || 'Kör månadskörningen under Ekonomi → Månadskörning, och sätt adressen: '
        || 'CLAUDE.md avsnitt 5 och migrationen manadskorningen_vacks_av_databasen.',
      null, null, (now() at time zone 'Europe/Stockholm')::date);
    return jsonb_build_object('begaran', null, 'orsak', 'adressen eller hemligheten saknas');
  end if;

  -- En minut räcker med råge: några frågor och en skrivning per
  -- studiehjälpare och familj. Standarden i natanrop är fem sekunder,
  -- och ett anrop som tar slut på tiden står som fel fast det gick.
  select intern.natanrop('fakturering',
    url := k.fakturering_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-nextrum-notis', k.hemlighet),
    body := jsonb_build_object('torrkorning', coalesce(p_torr, false)),
    timeout_milliseconds := 60000) into begaran;

  return jsonb_build_object('begaran', begaran, 'torrkorning', coalesce(p_torr, false));
end $$;

comment on function intern.manadskorning_vack(boolean) is
  'Väcker fakturering, som skriver förra månadens underlag (studiehjälparnas lönespecifikationer) och '
  'fakturautkast. pg_cron manadskorning kör den den 1:a varje månad. Med true torrkör den.';

-- Bara postgres, alltså pg_cron. anon och authenticated har USAGE på
-- intern, så EXECUTE måste tas bort uttryckligen.
revoke execute on function intern.manadskorning_vack(boolean) from public, anon, authenticated;

-- ---------- 3. läget, för adminvyn ----------
-- Jobbet finns bara i cron.job, som ingen vy når. Adminvyn sa att
-- månadskörningen gick av sig själv, och ett schema som står av och ett
-- som fungerar hade sett likadana ut därifrån: flaggan notiser_mejl stod
-- av i månader utan att någon såg det (CLAUDE.md avsnitt 5). Rutan under
-- Ekonomi → Månadskörning frågar därför här: finns jobbet, när går det,
-- och finns adressen. Om underlagen blev rätt säger larmen, inte det här.
create or replace function public.manadskorning_lage()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  aktivt  boolean;
  schemat text;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum ser månadskörningens schema.';
  end if;
  select j.active, j.schedule into aktivt, schemat from cron.job j where j.jobname = 'manadskorning';
  return jsonb_build_object(
    'pa', coalesce(aktivt, false),
    'schema', schemat,
    'adress', coalesce((select k.fakturering_url is not null from public.notis_konfig k where k.id = 1), false));
end $$;

comment on function public.manadskorning_lage() is
  'Om pg_cron-jobbet manadskorning finns och är aktivt, dess schema (UTC) och om notis_konfig har adressen. '
  'Bara för admin. Adminvyn visar det under Ekonomi → Månadskörning.';

revoke execute on function public.manadskorning_lage() from public, anon;
grant execute on function public.manadskorning_lage() to authenticated;
