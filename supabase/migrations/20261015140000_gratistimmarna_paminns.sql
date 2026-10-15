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
--   · planens gratis timme, när den gäller längre än planen
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
-- Villkoren sa att gratistimmar "förfaller utan påminnelse". Det är
-- borta, så versionen är 2026-10-16 och alla får frågan igen.
--
-- Tar inte bort något, varken objekt eller rader, så den kan köras hel i
-- ett do-block utan verktygets bekräftelse (CLAUDE.md avsnitt 5).
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 0. driften är som den lästes ----------
do $$
declare
  def text;
begin
  def := pg_get_functiondef('intern.timmar_gar_ut_koa(timestamptz)'::regprocedure);
  if position('gratistimmarna_paminns' in def) = 0 and md5(def) <> '2c8fa4565f71b2e16c6e29b1e85257b4' then
    raise exception 'intern.timmar_gar_ut_koa har ändrats sedan gratistimmarna_paminns skrevs (md5 %). Läs driften och skriv om migrationen.',
      md5(def);
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
   tipstimmarna en gång per sista dag). */
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
  nya    int := 0;
begin
  if timme < 9 or timme >= 20 then
    return 0;
  end if;

  for k in
    -- Köpta timmar. gratistimmarna_60_dagar: en gratis timme som inte
    -- använts går inte ut med planen, så den räknas inte här utan nedan.
    -- timmarna_delas (2026-10-14): timmar köpta till planen räknas med den.
    select s.id, s.parent_id, x.kvar, s.giltigt_till as dag, false as gratis
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
    select s.id, s.parent_id, s.kvar, s.giltigt_till, true
      from public.klippkort_saldo s
     where s.status = 'betald'
       and s.erbjudande = 'gratis'
       and s.kvar > 0
       and s.giltigt_till between idag and idag + dagar

    -- Planens gratis timme, när den gäller efter planens sista dag.
    union all
    select s.id, s.parent_id, s.gratis_kvar, s.gratis_till, true
      from public.klippkort_saldo s
     where s.status = 'betald'
       and s.erbjudande is distinct from 'gratis'
       and s.gratis_kvar > 0
       and s.gratis_till > s.giltigt_till
       and s.gratis_till between idag and idag + dagar

    -- Tipstimmarna, en rad per familj och sista dag.
    union all
    select null::uuid, t.person_id, count(*)::int, d.dag, true
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

    data := jsonb_strip_nulls(jsonb_build_object('datum', k.dag, 'kvar', k.kvar, 'klippkort', k.id))
            || case when k.gratis then jsonb_build_object('gratis', true) else '{}'::jsonb end;

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


-- ---------- 2. villkoren ----------
-- "utan påminnelse" är borta ur Gratistimmar. Sidans datum och versionen
-- följs åt (kolla-villkor.py), och alla får frågan igen vid nästa
-- inloggning.
create or replace function intern.villkor_version()
returns text
language sql
immutable
set search_path = pg_temp
as $$ select '2026-10-16'::text $$;
