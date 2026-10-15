-- ============================================================
-- NEXTRUM — gratis timmar påminns innan de går ut (2026-10-15)
--
-- Leo 2026-10-15: "fixa påminelse". Påminnelsen tio dagar innan
-- (Fas 21.2, intern.timmar_gar_ut_koa) gällde bara köpta timmar, och
-- gratistimmarna (2026-10-13) gick ut utan ett ord. Nu påminns alla
-- timmar i timbanken som går ut, med samma mejltyp och samma val under
-- Profil → Notiser:
--
--   · köpta timmar som förut, med timmarna köpta till planen
--   · gratistimmar vi satt in (klippkort med erbjudandet 'gratis')
--   · planens gratis timme, när den gäller efter planen
--     (klippkort_saldo.gratis_till efter giltigt_till; går de ut samma
--     dag räknas den med i planens mejl, som förut)
--   · tipstimmarna, som inte är kort (intern.tipstimmar_oanvanda)
--
-- De gratis märks med "gratis": true i datan, och mejlet (notis-ko,
-- mallen timmar_gar_ut) lovar då inga pengar tillbaka: en gåva betalas
-- aldrig ut. notis-ko ska därför driftsättas FÖRE den här filen; utan den
-- nya mallen får familjen köptimmarnas text, som lovar återbetalning.
-- Ett återkallat kort har inga timmar kvar (klippkort_saldo) och påminns
-- aldrig.
--
-- En familj utan studiehjälpare kan inte boka (vyn väntar, S.väntar), så
-- den får inget mejl om gratis timmar. Vi får en uppgift i stället, en
-- gång per kort och dag (idén och nyckeln kommer från PR #287, som byggde
-- samma påminnelse samma kväll; Leo valde en). Köpta timmar påminns som
-- förut, också utan studiehjälpare: det mejlet erbjuder pengarna
-- tillbaka, och det går utan att boka.
--
-- Villkoren säger fortfarande att gratistimmar "förfaller utan
-- påminnelse" (#gratistimmar). Orden tas bort i nästa version, inte i en
-- egen: alla har fått frågan nästan varje dag sedan 2026-10-07, och en
-- påminnelse till är inget familjen förlorar på (Leo samma kväll).
--
-- Tar inte bort något, varken objekt eller rader, så den kan köras hel i
-- ett do-block utan verktygets bekräftelse (CLAUDE.md avsnitt 5).
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 0. driften är som den lästes ----------
-- Bara funktionen timmarna_delas_och_kops_till lämnade, eller den här
-- filens: en annan version (till exempel #287:s, med samma namn) stoppar
-- filen i stället för att skrivas över utan ett ord.
do $$
declare
  def text;
begin
  def := pg_get_functiondef('intern.timmar_gar_ut_koa(timestamptz)'::regprocedure);
  if md5(def) not in ('2c8fa4565f71b2e16c6e29b1e85257b4', 'c54a9b637a7c7d056b232e355b5bec2f') then
    raise exception 'intern.timmar_gar_ut_koa är varken den timmarna_delas_och_kops_till lämnade eller den här filens (md5 %). Läs driften och skriv om migrationen.',
      md5(def);
  end if;
  def := pg_get_viewdef('public.klippkort_saldo'::regclass, true);
  if md5(def) <> 'a34041ef762316f238c6902224864a89' then
    raise exception 'klippkort_saldo har ändrats sedan gratistimmarna_paminns skrevs (md5 %). Läs driften.', md5(def);
  end if;
  if to_regprocedure('intern.tipstimmar_oanvanda(uuid)') is null then
    raise exception 'intern.tipstimmar_oanvanda saknas. Kör tipskoder_bonus_och_timbanken och timmarna_delas_och_kops_till först.';
  end if;
end $$;


-- ---------- 1. påminnelsen ----------
/* Påminnelsen tio dagar innan, för köpta och gratis timmar. Timmar som
   köpts till en plan går ut samma dag som planen och räknas med i planens
   mejl, så att familjen får ett mejl om dagen och inte ett per köp. Köps
   de när planens mejl redan gått kommer inget nytt: familjen har just
   valt dagen. Varje kort och sista dag påminns en gång (gratistimmarna_paminns:
   tipstimmarna en gång per familj och sista dag). */
create or replace function intern.timmar_gar_ut_koa(p_nu timestamp with time zone default now())
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  idag   date := (p_nu at time zone 'Europe/Stockholm')::date;
  timme  int  := extract(hour from p_nu at time zone 'Europe/Stockholm')::int;
  -- Hur många dagar före sista dagen. Leo 2026-09-27.
  dagar  constant int := 10;
  k      record;
  data   jsonb;
  uppg   text;
  nya    int := 0;
begin
  if timme < 9 or timme >= 20 then
    return 0;
  end if;

  for k in
    -- Köpta timmar. gratistimmarna_60_dagar: en gratis timme som inte
    -- använts går inte ut med planen, så den räknas inte här utan nedan.
    -- timmarna_delas (2026-10-14): timmar köpta till planen räknas med den.
    select s.id, s.parent_id, x.kvar, s.giltigt_till as dag, 'kopt'::text as slag
      from public.klippkort_saldo s
      cross join lateral (
        select s.kvar - case when s.gratis_till > s.giltigt_till then s.gratis_kvar else 0 end
               + coalesce((select sum(e.kvar)::int from public.klippkort_saldo e
                            where e.till_plan = s.id and e.status = 'betald'
                              and e.giltigt_till = s.giltigt_till), 0) as kvar) x
     where s.status = 'betald'
       and s.erbjudande is distinct from 'gratis'
       and s.till_plan is null
       and x.kvar > 0
       and s.giltigt_till between idag and idag + dagar

    -- gratistimmarna_paminns (2026-10-15): gratistimmarna vi satt in.
    union all
    select s.id, s.parent_id, s.kvar, s.giltigt_till, 'gratistimmar'
      from public.klippkort_saldo s
     where s.status = 'betald'
       and s.erbjudande = 'gratis'
       and s.kvar > 0
       and s.giltigt_till between idag and idag + dagar

    -- Planens gratis timme, när den gäller efter planens sista dag.
    union all
    select s.id, s.parent_id, s.gratis_kvar, s.gratis_till, 'planens'
      from public.klippkort_saldo s
     where s.status = 'betald'
       and s.erbjudande is distinct from 'gratis'
       and s.till_plan is null
       and s.gratis_kvar > 0
       and s.gratis_till > s.giltigt_till
       and s.gratis_till between idag and idag + dagar

    -- Tipstimmarna, en rad per familj och sista dag.
    union all
    select null::uuid, t.person_id, count(*)::int, d.dag, 'tips'
      from (select distinct c.person_id from public.tipskoder c
             where c.sort = 'familj' and c.person_id is not null) t
      join public.profiles p on p.id = t.person_id and p.raderad_at is null
      cross join lateral intern.tipstimmar_oanvanda(t.person_id) d(dag)
     where d.dag between idag and idag + dagar
     group by t.person_id, d.dag
  loop
    -- Kortets id och dagen skiljer påminnelserna åt: planens gratis timme
    -- har planens id men en senare dag, och tipstimmarna har inget kort.
    continue when exists (
      select 1 from public.notiser n
       where n.mottagare = k.parent_id and n.typ = 'timmar_gar_ut'
         and n.data ->> 'klippkort' is not distinct from k.id::text
         and n.data ->> 'datum' = k.dag::text);

    -- Utan studiehjälpare kan familjen inte boka (S.väntar i vyn), så ett
    -- mejl om att boka vore fel: gratis timmar blir en uppgift till oss.
    -- En gång per kort och dag, också efter att den klarmarkerats, för
    -- skapa_uppgift släpper annars en ny när den gamla är klar. Får
    -- familjen en studiehjälpare innan dagen går mejlet vid nästa körning.
    if k.slag <> 'kopt' and not exists (
         select 1 from public.profiles p
          where p.id = k.parent_id and p.match_status = 'matched' and p.matched_tutor_id is not null) then
      uppg := 'gratistimmar_utan_hjalpare:' || coalesce(k.id::text, 'tips:' || k.parent_id) || ':' || k.dag;
      if not exists (select 1 from public.uppgifter u where u.nyckel = uppg) then
        perform public.skapa_uppgift(
          'Gratis timmar går ut innan familjen har en studiehjälpare',
          uppg,
          'kontroll',
          'Familjen har ' || k.kvar || case when k.kvar = 1 then ' gratis timme' else ' gratis timmar' end
            || case k.slag when 'tips' then ' för tips' when 'planens' then ' kvar på sin plan' else '' end
            || ' som går ut ' || to_char(k.dag, 'YYYY-MM-DD') || ', men ingen studiehjälpare än, så de kan inte '
            || 'boka och får ingen påminnelse. '
            || case when k.slag = 'gratistimmar' then 'Matcha familjen, eller ta tillbaka timmarna och sätt in nya.'
                    else 'Matcha familjen.' end,
          'profiles', k.parent_id::text, k.dag);
      end if;
      continue;
    end if;

    data := jsonb_strip_nulls(jsonb_build_object('datum', k.dag, 'kvar', k.kvar, 'klippkort', k.id))
            || case when k.slag <> 'kopt' then jsonb_build_object('gratis', true) else '{}'::jsonb end;

    insert into public.notiser (mottagare, typ, trad_parent, data)
    values (k.parent_id, 'timmar_gar_ut', k.parent_id, data);
    nya := nya + 1;

    if public.notis_vill(k.parent_id, 'timmar_gar_ut', 'mejl') then
      -- Sista chansen att skicka är sista dagens slut: efter det är
      -- påminnelsen om timmar som redan förfallit.
      perform intern.notis_koa(k.parent_id, 'mejl', 'timmar_gar_ut', null, k.parent_id, null, data, null,
        'timmar_gar_ut:mejl:' || k.parent_id || ':' || coalesce(k.id::text, 'tips') || ':' || k.dag,
        p_nu, ((k.dag + 1)::timestamp at time zone 'Europe/Stockholm'));
    end if;
  end loop;
  return nya;
end $function$;

revoke execute on function intern.timmar_gar_ut_koa(timestamptz) from public, anon, authenticated;

comment on function intern.timmar_gar_ut_koa(timestamptz) is
  'Fas 21.2. Köar påminnelsen timmar_gar_ut tio dagar innan timmar går ut, en gång per kort och sista dag. Körs av '
  'pg_cron timmar-gar-ut. gratistimmarna_paminns: också gratistimmar, planens gratis timme efter planen och '
  'tipstimmarna (data.gratis), och för en familj utan studiehjälpare en uppgift till oss i stället för mejlet.';
