-- ============================================================
-- NEXTRUM — Fas 8.5: AI:ns roll, och den enda dörren
--
-- Regeln är "ingen AI-väg skriver direkt i affärstabeller". Den ska
-- hålla även om edge-funktionen har en bugg, och därför får den inte
-- bo i TypeScript.
--
-- Rollen nextrum_ai har inga tabellrättigheter alls. Inte SELECT,
-- inte INSERT, ingenting. Den kan köra sju funktioner, och det är
-- hela dess värld:
--   · fyra läsningar (Fas 8.4), med beslutade fältlistor
--   · matchningsrankningen
--   · ett förslag (ai_skapa_forslag)
--   · en uppgift (skapa_uppgift)
-- Skriver någon en åttonde funktion och glömmer ett grant händer
-- ingenting — den blir bara inte anropbar. Det är rätt håll att
-- misslyckas åt.
--
-- ai_verktyg är dörren. Den ÄGS av nextrum_ai och är SECURITY
-- DEFINER, alltså kör den som den rollen: försöker något inuti den
-- skriva i students svarar databasen "permission denied", inte
-- "policy". Framför står adminvakten, för det är en inloggad admin
-- som startar en körning.
--
-- CREATE på schemat ges och tas tillbaka i samma migration. Postgres
-- kräver att en ny ägare kan skapa i schemat vid ägarbytet, men
-- rollen ska inte behålla rätten: den ska kunna köra sju funktioner,
-- inte skapa en åttonde.
--
-- VARFÖR INTE EN EGEN JWT?
-- Det naturliga vore att låta edge-funktionen tala med PostgREST som
-- nextrum_ai. Det kräver att funktionen kan signera en token, alltså
-- att projektets JWT-hemlighet ligger som en secret i just den kod
-- som läser text från publika formulär — en hemlighet som kan göra
-- vem som helst till vem som helst. Dörren här ger samma garanti
-- utan den hemligheten.
--
-- AI:N FORMULERAR ALDRIG EN NYCKEL.
-- Nycklar och titlar byggs här, av kod, ur typ och id. Fritext från
-- modellen får bara hamna i motivering och beskrivning — fält som
-- INTE står i auditloggens vitlistor. Auditloggen går inte att
-- rätta, och text som kommit via ett publikt formulär ska inte kunna
-- ta sig in i den.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'nextrum_ai') then
    create role nextrum_ai nologin noinherit;
  end if;
end $$;

grant nextrum_ai to postgres;          -- krävs för att få sätta ägaren
grant usage on schema public to nextrum_ai;
grant create on schema public to nextrum_ai;   -- tas tillbaka längst ned

grant execute on function public.ai_nya_leads(integer) to nextrum_ai;
grant execute on function public.ai_omatchade_elever() to nextrum_ai;
grant execute on function public.ai_kommande_pass(integer) to nextrum_ai;
grant execute on function public.ai_saknade_rapporter(integer) to nextrum_ai;
grant execute on function public.matchningsforslag_rader(uuid) to nextrum_ai;
grant execute on function public.ai_skapa_forslag(text, text, jsonb, text, uuid, text, text) to nextrum_ai;
grant execute on function public.skapa_uppgift(text, text, text, text, text, text, date, text) to nextrum_ai;

create or replace function public.ai_verktyg(p_verktyg text, p_arg jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  arg      jsonb := coalesce(p_arg, '{}'::jsonb);
  ut       jsonb;
  elev     uuid;
  hjalpare uuid;
  tabell   text;
  objekt   uuid;
  nyid     uuid;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum kör AI-verktygen.';
  end if;

  case p_verktyg

    when 'nya_leads' then
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into ut
        from public.ai_nya_leads(coalesce((arg ->> 'dagar')::int, 21)) t;

    when 'omatchade_elever' then
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into ut
        from public.ai_omatchade_elever() t;

    when 'kommande_pass' then
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into ut
        from public.ai_kommande_pass(coalesce((arg ->> 'dagar')::int, 7)) t;

    when 'saknade_rapporter' then
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into ut
        from public.ai_saknade_rapporter(coalesce((arg ->> 'dagar')::int, 45)) t;

    when 'matchningsforslag' then
      elev := nullif(arg ->> 'elev_id', '')::uuid;
      if elev is null then
        return jsonb_build_object('fel', 'matchningsforslag kräver elev_id.');
      end if;
      -- Bara de tio bästa. Modellen ska välja bland kandidater, inte
      -- läsa hela poolen, och varje rad kostar tokens.
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into ut
        from (select * from public.matchningsforslag_rader(elev) limit 10) t;

    when 'foresla_matchning' then
      elev := nullif(arg ->> 'elev_id', '')::uuid;
      hjalpare := nullif(arg ->> 'studiehjalpare_id', '')::uuid;
      if elev is null or hjalpare is null then
        return jsonb_build_object('fel', 'foresla_matchning kräver elev_id och studiehjalpare_id.');
      end if;
      if not exists (select 1 from public.students s where s.id = elev) then
        return jsonb_build_object('fel', 'Eleven finns inte.');
      end if;
      if not exists (select 1 from public.matchningsunderlag m where m.tutor_id = hjalpare) then
        return jsonb_build_object('fel', 'Studiehjälparen finns inte eller är inte godkänd.');
      end if;

      -- Nyckeln byggs här, av id:n. Paret är det som avgör: avvisas
      -- förslaget kommer just det paret inte tillbaka, men ett annat
      -- par är ett annat förslag.
      nyid := public.ai_skapa_forslag(
        'matchning',
        'match:elev:' || elev::text || ':hjalpare:' || hjalpare::text,
        jsonb_build_object('elev_id', elev, 'studiehjalpare_id', hjalpare),
        left(coalesce(arg ->> 'motivering', ''), 2000),
        nullif(arg ->> 'korning_id', '')::uuid,
        'students', elev::text);
      ut := jsonb_build_object('skapat', nyid is not null, 'forslag_id', nyid);

    when 'flagga_problem' then
      tabell := coalesce(arg ->> 'tabell', '');
      objekt := nullif(arg ->> 'objekt_id', '')::uuid;
      if objekt is null or tabell not in ('leads', 'students', 'bookings', 'invoices', 'payouts') then
        return jsonb_build_object('fel',
          'flagga_problem kräver objekt_id och en tabell: leads, students, bookings, invoices eller payouts.');
      end if;

      -- Titeln är en mall, inte modellens text. Beskrivningen får
      -- vara fri, men den hamnar aldrig i auditloggen.
      nyid := public.skapa_uppgift(
        case tabell
          when 'leads' then 'AI: titta på en intresseanmälan'
          when 'students' then 'AI: titta på en elev'
          when 'bookings' then 'AI: titta på ett pass'
          when 'invoices' then 'AI: titta på en faktura'
          else 'AI: titta på en utbetalning'
        end,
        'ai:problem:' || tabell || ':' || objekt::text,
        'problem',
        left(coalesce(arg ->> 'varfor', 'AI:n flaggade raden utan att skriva varför.'), 2000),
        tabell, objekt::text,
        (now() at time zone 'Europe/Stockholm')::date + 3,
        'ai');
      ut := jsonb_build_object('skapat', nyid is not null, 'uppgift_id', nyid);

    else
      return jsonb_build_object('fel', 'Okänt verktyg: ' || coalesce(p_verktyg, '(tomt)'));
  end case;

  return coalesce(ut, '[]'::jsonb);
end $$;

alter function public.ai_verktyg(text, jsonb) owner to nextrum_ai;

comment on function public.ai_verktyg(text, jsonb) is
  'Den enda väg drift-agenten talar med databasen. Ägs av rollen nextrum_ai, som saknar alla tabellrättigheter — en skrivning utanför listan nekas av databasen, inte av koden.';

revoke execute on function public.ai_verktyg(text, jsonb) from public, anon;
grant execute on function public.ai_verktyg(text, jsonb) to authenticated;

revoke create on schema public from nextrum_ai;
