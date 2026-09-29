-- ============================================================
-- Månadskörningens svar blir en uppgift
--
-- INTE KÖRD I DRIFTEN ÄN (2026-09-29). Den körs efter merge, med
-- apply_migration, och filen döps då om till versionen den får
-- (CLAUDE.md avsnitt 5). Jobbet som läser svaret kommer i en egen
-- migration, manadskorningens_svar_lases_den_forsta, när funktionen
-- körts och lästs för hand (Fas 7:s regel, DEPLOY-BETALNING.md
-- avsnitt 6).
--
-- pg_cron-jobbet manadskorning väcker fakturering den 1:a klockan
-- 04:17 UTC, och ingen läser svaret. Gick det fel stod det under
-- System → Fel, men net._http_response glömmer svaren efter sex timmar
-- (pg_net.ttl), alltså vid lunch samma dag. Den som tittade efter det
-- såg bara larmen ej_utbetalt och faktura_saknas på passen, och de
-- säger inte att körningen misslyckades. En studiehjälpare kunde stå
-- utan lönespecifikation utan att något sa varför.
--
-- intern.manadskorning_svar() läser svaret en halvtimme efter
-- körningen och gör allt utom 200 till en uppgift som står kvar tills
-- någon stänger den: 207 (en del av skrivningarna gick fel), 4xx, 5xx,
-- tidsgränsen, ett anrop som aldrig kom fram och ett som inte fått
-- något svar alls. När pg_cron kör den är också ett anrop som saknas
-- ett fel: jobbet gick inte, eller föll innan det anropade. Utom när
-- adressen saknas, för då har väckningen redan gjort uppgiften
-- manadskorning:adress, och när jobbet står av. Uppgiften säger vad
-- som hände och var det görs för hand, Ekonomi → Månadskörning, och
-- bär inga namn, inga belopp och ingenting ur svaret: svaret räknar
-- upp studiehjälpare och familjer med id och belopp.
--
-- EN UPPGIFT PER MÅNAD. Nyckeln är manadskorning:svar:<månaden>, och
-- finns en uppgift med den nyckeln, öppen eller stängd, skapas ingen
-- till. skapa_uppgift() nekar bara när en öppen finns, och hade gjort
-- en ny av samma körning när den första stängts.
--
-- DEN SENASTE TIMMEN, INTE DET SENASTE DYGNET. pg_net tar bort svar
-- som är äldre än sex timmar när arbetaren har något att göra, inte på
-- klockslaget: 2026-09-29 låg fjorton timmar gamla svar kvar. Ett
-- anrop äldre än sex timmar kan alltså ha ett svar eller inget, och
-- hade kunnat läsas som "inget svar" fast det gick. En timme täcker
-- körningen 04:17 med råge när kontrollen går 04:47. Torrkörningen går
-- samma väg (målet fakturering) och svarar alltid 200. Görs en för
-- hand mellan körningen och kontrollen är det den som läses; den som
-- gör det tittar redan på svaret.
--
-- I DATABASEN, INTE I FAKTURERING. Funktionen kunde skapa uppgiften
-- själv när schemat anropar, men den ser aldrig det som går fel innan
-- den körs: 401 från Supabases grind, 404, ett anrop som aldrig kom
-- fram, tidsgränsen. Och den hade behövt driftsättas igen och jämföras
-- byte för byte. Den som ligger ute, version 32, är byte för byte lik
-- main.
--
-- Tidsgränsen är en minut (manadskorning_vack). Ett anrop som tog slut
-- på tiden kan ha gått klart ändå, för funktionen fortsätter när pg_net
-- slutat vänta. Uppgiften säger det, och torrkörningen visar om något
-- saknas.
-- ============================================================

-- p_schemat är true när pg_cron kör den, en halvtimme efter
-- manadskorning. Då skulle ett anrop finnas, och ett som saknas är ett
-- fel. För hand (false) finns det bara inget att läsa.
create or replace function intern.manadskorning_svar(p_schemat boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  manader  constant text[] := array['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli',
                                    'augusti', 'september', 'oktober', 'november', 'december'];
  k        public.notis_konfig%rowtype;
  begaran  bigint;
  anropat  timestamptz;
  kod      integer;
  tog_slut boolean;
  grind    text;
  lage     text;
  lokal    timestamp;
  manaden  date;
  namn     text;
  nar      text;
  nyckeln  text;
  titel    text;
  vad      text;
  uppgift  uuid;
begin
  -- Bara intern.manadskorning_vack() anropar fakturering genom
  -- natanrop. Knapparna under Ekonomi → Månadskörning går direkt från
  -- webbläsaren och syns inte här.
  select l.id, l.skapad into begaran, anropat
    from intern.natanrop_logg l
   where l.mal = 'fakturering' and l.skapad > now() - interval '1 hour'
   order by l.skapad desc, l.id desc
   limit 1;

  if not found then
    if not coalesce(p_schemat, false) then
      return jsonb_build_object('begaran', null, 'lage', 'inget_anrop', 'uppgift', null);
    end if;
    -- Saknas adressen har väckningen redan gjort uppgiften
    -- manadskorning:adress, och en till om samma sak är brus. Ett jobb
    -- som står av är ett beslut, och adminvyn säger det
    -- (manadskorning_lage).
    select * into k from public.notis_konfig where id = 1;
    if k.fakturering_url is null or k.hemlighet is null then
      return jsonb_build_object('begaran', null, 'lage', 'ingen_adress', 'uppgift', null);
    end if;
    if not exists (select 1 from cron.job j where j.jobname = 'manadskorning' and j.active) then
      return jsonb_build_object('begaran', null, 'lage', 'schemat_av', 'uppgift', null);
    end if;
    lage := 'inget_anrop';
    lokal := now() at time zone 'Europe/Stockholm';
  else
    lokal := anropat at time zone 'Europe/Stockholm';
    select r.status_code, coalesce(r.timed_out, false), r.headers ->> 'sb-error-code'
      into kod, tog_slut, grind
      from net._http_response r
     where r.id = begaran;
    if not found then
      -- Tidsgränsen är en minut, så ett anrop yngre än två minuter kan
      -- fortfarande vara på väg. Det läses nästa gång.
      if anropat > now() - interval '2 minutes' then
        return jsonb_build_object('begaran', begaran, 'lage', 'vantar', 'uppgift', null);
      end if;
      lage := 'inget_svar';
    elsif kod = 200 then lage := 'ok';
    elsif kod = 207 then lage := 'delvis';
    elsif kod between 400 and 499 then lage := 'nekad';
    elsif kod >= 500 then lage := 'gick_sonder';
    elsif kod is not null then lage := 'annat';
    elsif tog_slut then lage := 'tidsgrans';
    else lage := 'kom_inte_fram';
    end if;
  end if;

  -- Samma månad som fakturering räknar: förra månaden i svensk tid,
  -- räknat från anropet.
  manaden := (date_trunc('month', lokal) - interval '1 month')::date;

  if lage = 'ok' then
    return jsonb_build_object('begaran', begaran, 'period', to_char(manaden, 'YYYY-MM'),
                              'svar', kod, 'lage', lage, 'uppgift', null);
  end if;

  nyckeln := 'manadskorning:svar:' || to_char(manaden, 'YYYY-MM');
  select u.id into uppgift
    from public.uppgifter u
   where u.nyckel = nyckeln
   order by u.created_at
   limit 1;
  if found then
    return jsonb_build_object('begaran', begaran, 'period', to_char(manaden, 'YYYY-MM'),
                              'svar', kod, 'lage', lage, 'uppgift', uppgift, 'ny', false);
  end if;

  namn := manader[extract(month from manaden)::int];
  nar := 'den ' || extract(day from lokal)::int || ' ' || manader[extract(month from lokal)::int]
         || ' ' || to_char(lokal, 'HH24:MI');

  titel := 'Månadskörningen för ' || namn || ' ' || extract(year from manaden)::int || ' '
    || case lage
         when 'delvis'        then 'skrev bara en del'
         when 'nekad'         then 'nekades (' || kod || ')'
         when 'gick_sonder'   then 'gick sönder (' || kod || ')'
         when 'annat'         then 'svarade ' || kod
         when 'tidsgrans'     then 'svarade inte i tid'
         when 'kom_inte_fram' then 'nådde inte fram'
         when 'inget_svar'    then 'fick inget svar'
         else 'gick inte'
       end;

  -- Vad som hände. Det står efter vad som ska göras, för adminvyn visar
  -- bara början av beskrivningen i listorna: 180 tecken under
  -- Uppgifter och 160 under Automationer.
  vad := case
    when lage = 'delvis' then
      'Svaret ' || nar || ' var 207: något underlag eller fakturautkast gick inte att spara. '
      || 'Det som sparades står kvar och skrivs inte två gånger.'
    when lage = 'nekad' and grind like 'UNAUTHORIZED%' then
      'Svaret ' || nar || ' var ' || kod || ' från Supabases grind: fakturering kräver inloggning igen, '
      || 'och raden för den i supabase/config.toml saknas eller kom inte med när den driftsattes. Ingenting skrevs.'
    when lage = 'nekad' and kod = 401 then
      'Svaret ' || nar || ' var 401: hemligheten stämmer inte med den i notis_konfig. '
      || 'Ingenting skrevs, och vägen behöver lagas före nästa månad.'
    when lage = 'nekad' and kod = 404 then
      'Svaret ' || nar || ' var 404: det finns ingen funktion på adressen i notis_konfig.fakturering_url. '
      || 'Ingenting skrevs, och vägen behöver lagas före nästa månad.'
    when lage = 'nekad' then
      'Svaret ' || nar || ' var ' || kod || ': fakturering nekade anropet. Ingenting skrevs.'
    when lage = 'gick_sonder' then
      'Svaret ' || nar || ' var ' || kod || ': funktionen gick sönder. Varför står i dess logg i Supabase, '
      || 'och det som hann sparas står kvar.'
    when lage = 'annat' then
      'Svaret ' || nar || ' var ' || kod || ', och bara 200 betyder att allt skrevs.'
    when lage = 'tidsgrans' then
      'fakturering svarade inte inom en minut ' || nar || '. Den kan ha gått klart ändå, '
      || 'och då finns inget att skapa.'
    when lage = 'kom_inte_fram' then
      'Anropet ' || nar || ' nådde aldrig funktionen. Ingenting skrevs.'
    when lage = 'inget_svar' then
      'pg_net har inget svar på anropet ' || nar || ': det skickades aldrig, eller svaret kom inte tillbaka. '
      || 'Om funktionen körde står i dess logg i Supabase.'
    else
      'Jobbet manadskorning anropade aldrig fakturering: det gick inte, eller föll innan anropet, '
      || 'och cron.job_run_details säger vilket. Ingenting skrevs.'
  end;

  uppgift := public.skapa_uppgift(
    titel,
    nyckeln,
    'problem',
    'Torrkör ' || namn || ' under Ekonomi → Månadskörning och skapa det som saknas. ' || vad,
    null, null, (now() at time zone 'Europe/Stockholm')::date);

  return jsonb_build_object('begaran', begaran, 'period', to_char(manaden, 'YYYY-MM'),
                            'svar', kod, 'lage', lage, 'uppgift', uppgift, 'ny', uppgift is not null);
end $$;

comment on function intern.manadskorning_svar(boolean) is
  'Läser svaret på den senaste månadskörningen (anropet till fakturering den senaste timmen) och gör allt utom 200 '
  'till en uppgift, en per månad (manadskorning:svar:ÅÅÅÅ-MM), som står kvar tills någon stänger den. Med true '
  '(pg_cron manadskorning-svar, en halvtimme efter körningen) är ett anrop som saknas också ett fel. Svarar med vad '
  'den såg: lage är ok, delvis, nekad, gick_sonder, annat, tidsgrans, kom_inte_fram, inget_svar, vantar, '
  'inget_anrop, ingen_adress eller schemat_av.';

-- Bara postgres, alltså pg_cron. anon och authenticated har USAGE på
-- intern, så EXECUTE måste tas bort uttryckligen.
revoke execute on function intern.manadskorning_svar(boolean) from public, anon, authenticated;
