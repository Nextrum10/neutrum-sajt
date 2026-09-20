-- ============================================================
-- NEXTRUM — Fas 9.9: drift-agenten får se siffrorna
--
-- Planen vill att agenten ska kunna svara på "sammanfatta dagens
-- avvikelser". Den kan det inte: analysvyerna har
-- security_invoker=true, och rollen nextrum_ai har inga
-- tabellrättigheter alls. En invoker-vy som nextrum_ai läser är en
-- vy vars underliggande tabeller den inte får röra — svaret blir
-- permission denied, inte en tom lista.
--
-- Det är inte ett fel att laga i vyerna. Invoker är rätt där: en vy
-- ska inte vara en väg runt RLS. Två SECURITY DEFINER-omslag i
-- stället, av exakt samma sort som ai_nya_leads och de andra, och
-- med samma två regler:
--
--   1. INGA NAMN, INGEN FRITEXT. ai_analys lämnar bara ut tal och
--      datum. ai_avvikelser lämnar ut typ, tabell, id, datum och
--      belopp — samma form som avvikelser_rader redan har.
--
--   2. KÄLLFÄLTEN LÄMNAS UTE MED FLIT. analys_leads_per_kalla är
--      den enda analysvy som bär text, och den texten skriver en
--      anonym besökare själv i adressraden (?utm_campaign=...). Att
--      skicka den till modellen vore att öppna en injektionsväg som
--      ingen behöver: agenten ska sammanfatta driften, inte
--      marknadsföringen.
--
-- Omslagen ägs av postgres och körs som postgres, alltså förbi RLS.
-- Det är hela poängen med ett omslag, och därför är de smala: de
-- lämnar ut en fast kolumnlista, aldrig select *.
-- ============================================================

create or replace function public.ai_analys(p_manader integer default 6)
returns table (
  manad                 date,
  genomforda_pass       bigint,
  minuter               bigint,
  aktiva_elever         bigint,
  aktiva_studiehjalpare bigint,
  anmalningar           bigint,
  blev_kund             bigint,
  fick_forsta_passet    bigint,
  ej_sparbara           bigint,
  fakturerat_ore        bigint,
  betalt_ore            bigint,
  utbetalt_ore          bigint,
  avbokningar           bigint)
language sql
stable
security definer
set search_path to 'public'
as $$
  with granser as (
    select (date_trunc('month', (now() at time zone 'Europe/Stockholm'))
            - make_interval(months => greatest(1, least(coalesce(p_manader, 6), 36)) - 1))::date as fran
  ),
  avbok as (
    select manad, sum(avbokningar) as avbokningar
      from public.analys_avbokningar where manad is not null group by 1
  )
  select e.manad,
         e.genomforda_pass::bigint,
         e.minuter::bigint,
         coalesce(a.aktiva_elever, 0)::bigint,
         coalesce(a.aktiva_studiehjalpare, 0)::bigint,
         coalesce(k.anmalningar, 0)::bigint,
         coalesce(k.blev_kund, 0)::bigint,
         coalesce(k.fick_forsta_passet, 0)::bigint,
         coalesce(k.ej_sparbara, 0)::bigint,
         e.fakturerat_ore::bigint,
         e.betalt_ore::bigint,
         e.utbetalt_ore::bigint,
         coalesce(v.avbokningar, 0)::bigint
    from public.analys_ekonomi e
    cross join granser g
    left join public.analys_aktiva a       on a.manad = e.manad
    left join public.analys_konvertering k on k.manad = e.manad
    left join avbok v                      on v.manad = e.manad
   where e.manad >= g.fran
   order by e.manad desc;
$$;

comment on function public.ai_analys(integer) is
  'Verksamheten i tal per månad, för drift-agenten. Bara tal och datum: inga namn, '
  'ingen fritext, och med flit inga källfält — de skrivs av en anonym besökare i '
  'adressraden och hör inte hemma i en modellprompt.';

create or replace function public.ai_avvikelser()
returns table (
  typ               text,
  objekt_tabell     text,
  objekt_id         text,
  datum             date,
  belopp_ore        bigint,
  kund_id           uuid,
  studiehjalpare_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $$
  select r.typ, r.objekt_tabell, r.objekt_id, r.datum, r.belopp_ore,
         r.kund_id, r.studiehjalpare_id
    from public.avvikelser_rader() r;
$$;

comment on function public.ai_avvikelser() is
  'Det som inte går ihop i fakturor och utbetalningar, för drift-agenten. Samma '
  'form som avvikelser_rader: koder, id och belopp — aldrig namn.';

-- Bara AI-vägen. Adminvyn har redan ekonomiska_avvikelser() och
-- läser analysvyerna direkt, under sin egen policy.
revoke execute on function public.ai_analys(integer) from public, anon, authenticated;
revoke execute on function public.ai_avvikelser() from public, anon, authenticated;
grant execute on function public.ai_analys(integer) to nextrum_ai;
grant execute on function public.ai_avvikelser() to nextrum_ai;

-- ---------- dörren får två nya grenar ----------
-- Läst ur driften med pg_get_functiondef före ändringen. Allt utom
-- de två nya when-grenarna är ordagrant kvar.

create or replace function public.ai_verktyg(p_verktyg text, p_arg jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  arg      jsonb := coalesce(p_arg, '{}'::jsonb);
  ut       jsonb;
  elev     uuid;
  hjalpare uuid;
  tabell   text;
  objekt   uuid;
  nyid     uuid;
  rank     record;
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

    -- Fas 9.9
    when 'analys' then
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into ut
        from public.ai_analys(coalesce((arg ->> 'manader')::int, 6)) t;

    when 'avvikelser' then
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into ut
        from public.ai_avvikelser() t;

    when 'matchningsforslag' then
      elev := nullif(arg ->> 'elev_id', '')::uuid;
      if elev is null then
        return jsonb_build_object('fel', 'matchningsforslag kräver elev_id.');
      end if;
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

      select * into rank from public.matchningsforslag_rader(elev) r where r.tutor_id = hjalpare;
      if found and rank.hart_nej then
        return jsonb_build_object('fel',
          'Den studiehjälparen har ett hårt nej för eleven (ämne: ' || rank.amne_utfall
          || ', årskurs: ' || rank.arskurs_utfall || '). Förslaget skapades inte. '
          || 'Fel ämne eller fel årskurs är fel person, oavsett vad texten säger.');
      end if;

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
end $function$;

-- Dörren ägs av nextrum_ai. Ägandet är garantin: försöker något i
-- dörren skriva i en affärstabell svarar databasen permission denied.
alter function public.ai_verktyg(text, jsonb) owner to nextrum_ai;
revoke execute on function public.ai_verktyg(text, jsonb) from public, anon;
grant execute on function public.ai_verktyg(text, jsonb) to authenticated;
