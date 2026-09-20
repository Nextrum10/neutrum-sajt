-- ============================================================
-- NEXTRUM — Fas 8.5b: dörren får en kontrollfunktion
--
-- ai_verktyg kontrollerade att eleven fanns med en egen
-- `select 1 from students`. Den raden nekades — av databasen, som
-- den ska: dörren kör som nextrum_ai, och rollen har ingen SELECT på
-- någon tabell. Garantin fungerade alltså direkt, och det första den
-- stoppade var min egen kod.
--
-- Rätt svar är inte att ge rollen läsrätt på students. Det är att ge
-- den EN funktion som svarar ja eller nej på frågan "finns den här
-- raden?", utan att lämna ut någonting annat. Den läcker inte:
-- svaret är en boolean, och tabellnamnet måste vara ett av fem.
-- ============================================================

create or replace function public.ai_finns(p_tabell text, p_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  ja boolean := false;
begin
  if p_id is null then return false; end if;

  case p_tabell
    when 'students' then
      select exists (select 1 from public.students s where s.id = p_id) into ja;
    when 'studiehjalpare' then
      -- Vyn matchningsunderlag visar bara godkända studiehjälpare,
      -- och det är just "godkänd" frågan gäller.
      select exists (select 1 from public.matchningsunderlag m where m.tutor_id = p_id) into ja;
    when 'leads' then
      select exists (select 1 from public.leads l where l.id = p_id) into ja;
    when 'bookings' then
      select exists (select 1 from public.bookings b where b.id = p_id) into ja;
    when 'invoices' then
      select exists (select 1 from public.invoices i where i.id = p_id) into ja;
    when 'payouts' then
      select exists (select 1 from public.payouts u where u.id = p_id) into ja;
    else
      return false;
  end case;

  return ja;
end $$;

revoke execute on function public.ai_finns(text, uuid) from public, anon, authenticated;
grant execute on function public.ai_finns(text, uuid) to nextrum_ai;

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
      if not public.ai_finns('students', elev) then
        return jsonb_build_object('fel', 'Eleven finns inte.');
      end if;
      if not public.ai_finns('studiehjalpare', hjalpare) then
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
      if not public.ai_finns(tabell, objekt) then
        return jsonb_build_object('fel', 'Raden finns inte.');
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

revoke execute on function public.ai_verktyg(text, jsonb) from public, anon;
grant execute on function public.ai_verktyg(text, jsonb) to authenticated;
