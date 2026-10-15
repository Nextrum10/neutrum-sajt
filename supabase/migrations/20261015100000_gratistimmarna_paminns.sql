-- ============================================================
-- gratistimmarna_paminns (2026-10-15)
--
-- Påminnelsen tio dagar innan timmar går ut (Fas 21.2, notistypen
-- timmar_gar_ut) gäller också timmar som är gratis:
--
--   · gratistimmar från oss (klippkort med erbjudandet 'gratis'), som går
--     ut med kortet (giltigt_till, 60 dagar efter insättningen)
--   · planens gratis timme när den gäller efter planens månad
--     (gratistimmarna_60_dagar), som går ut 60 dagar efter köpet
--     (gratis_till)
--
-- Förut hoppade påminnelsen över båda, för mejlet säger "köpta timmar"
-- och lovar att resten betalas tillbaka, och en gratis timme betalas
-- aldrig ut. Nu går de med samma notistyp och samma val under Profil →
-- Notiser, med 'gratis' i datan: mallen i notis-ko säger då att timmarna
-- är gratis och förfaller, och lovar inget tillbaka. notis-ko driftsätts
-- därför FÖRE den här filen: en äldre notis-ko läser inte 'gratis' och
-- skickar mejlet om köpta timmar, med löftet.
--
-- En familj utan studiehjälpare kan inte boka (vyn väntar, S.väntar), så
-- den får inget mejl om att boka. Det blir en uppgift till oss i stället,
-- en gång per kort och dag: matcha familjen, eller ta tillbaka timmarna
-- och sätt in nya. Får familjen en studiehjälpare innan dagen går mejlet
-- som vanligt vid nästa körning.
--
-- Köpta timmar påminns som förut. Filen tar inte bort något, varken
-- objekt eller rader, och kan köras hel i ett do-block (CLAUDE.md
-- avsnitt 5).
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 0. driften är som den lästes ----------
do $$
declare
  def text := pg_get_functiondef('intern.timmar_gar_ut_koa(timestamptz)'::regprocedure);
begin
  if position('gratistimmarna_paminns' in def) = 0 and md5(def) <> '2c8fa4565f71b2e16c6e29b1e85257b4' then
    raise exception 'intern.timmar_gar_ut_koa har ändrats sedan gratistimmarna_paminns skrevs (md5 %). Läs driften och skriv om migrationen.',
      md5(def);
  end if;
  def := pg_get_viewdef('public.klippkort_saldo'::regclass, true);
  if md5(def) <> 'a34041ef762316f238c6902224864a89' then
    raise exception 'klippkort_saldo har ändrats sedan gratistimmarna_paminns skrevs (md5 %). Läs driften.', md5(def);
  end if;
end $$;


-- ---------- 1. påminnelsen ----------
/* Tio dagar innan: köpta timmar som förut (timmar köpta till en plan
   räknas med planen, och en gratis timme som går ut senare räknas inte),
   och sedan gratistimmarna_paminns de gratis timmarna, var för sig med
   sin egen sista dag. Ett mejl per kort och dag, som förut. */
create or replace function intern.timmar_gar_ut_koa(p_nu timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    -- använts går inte ut med planen, så den räknas inte här.
    -- timmarna_delas (2026-10-14): timmar köpta till planen räknas med den.
    select s.id, s.parent_id, x.kvar, s.giltigt_till as sista, false as gratis
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
    union all
    -- gratistimmarna_paminns: gratistimmar från oss går ut med kortet. Ett
    -- återkallat kort har inget kvar (klippkort_saldo).
    select s.id, s.parent_id, s.kvar, s.giltigt_till, true
      from public.klippkort_saldo s
     where s.status = 'betald'
       and s.erbjudande = 'gratis'
       and s.kvar > 0
       and s.giltigt_till between idag and idag + dagar
    union all
    -- ... och planens gratis timme, när den gäller efter planens månad.
    select s.id, s.parent_id, s.gratis_kvar, s.gratis_till, true
      from public.klippkort_saldo s
     where s.status = 'betald'
       and s.erbjudande is distinct from 'gratis'
       and s.till_plan is null
       and s.gratis_kvar > 0
       and s.gratis_till > s.giltigt_till
       and s.gratis_till between idag and idag + dagar
  loop
    continue when exists (
      select 1 from public.notiser n
       where n.mottagare = k.parent_id and n.typ = 'timmar_gar_ut'
         and n.data ->> 'klippkort' = k.id::text
         and n.data ->> 'datum' = k.sista::text);

    -- Utan studiehjälpare kan familjen inte boka, så ett mejl om att boka
    -- vore fel. Uppgiften kommer en gång per kort och dag, också efter att
    -- den klarmarkerats: skapa_uppgift släpper en ny när den gamla är klar.
    if k.gratis and not exists (
         select 1 from public.profiles p
          where p.id = k.parent_id and p.match_status = 'matched' and p.matched_tutor_id is not null) then
      uppg := 'gratistimmar_utan_hjalpare:' || k.id || ':' || k.sista;
      if not exists (select 1 from public.uppgifter u where u.nyckel = uppg) then
        perform public.skapa_uppgift(
          'Gratis timmar går ut innan familjen har en studiehjälpare',
          uppg,
          'kontroll',
          'Familjen har ' || k.kvar || case when k.kvar = 1 then ' gratis timme' else ' gratis timmar' end
            || ' som går ut ' || to_char(k.sista, 'YYYY-MM-DD') || ', men ingen studiehjälpare än, så de kan inte '
            || 'boka och får ingen påminnelse. Matcha familjen, eller ta tillbaka timmarna och sätt in nya.',
          'profiles', k.parent_id::text, k.sista);
      end if;
      continue;
    end if;

    data := jsonb_build_object('datum', k.sista, 'kvar', k.kvar, 'klippkort', k.id);
    if k.gratis then
      data := data || jsonb_build_object('gratis', true);
    end if;

    insert into public.notiser (mottagare, typ, trad_parent, data)
    values (k.parent_id, 'timmar_gar_ut', k.parent_id, data);
    nya := nya + 1;

    if public.notis_vill(k.parent_id, 'timmar_gar_ut', 'mejl') then
      -- Sista chansen att skicka är sista dagens slut: efter det är
      -- påminnelsen om timmar som redan förfallit.
      perform intern.notis_koa(k.parent_id, 'mejl', 'timmar_gar_ut', null, k.parent_id, null, data, null,
        'timmar_gar_ut:mejl:' || k.parent_id || ':' || k.id || ':' || k.sista,
        p_nu, ((k.sista + 1)::timestamp at time zone 'Europe/Stockholm'));
    end if;
  end loop;
  return nya;
end $function$;

revoke execute on function intern.timmar_gar_ut_koa(timestamptz) from public, anon, authenticated;

comment on function intern.timmar_gar_ut_koa(timestamptz) is
  'Fas 21.2. Köar påminnelsen timmar_gar_ut tio dagar innan ett betalt kort med timmar kvar går ut. En gång '
  'per kort och sista dag. Körs av pg_cron timmar-gar-ut. gratistimmarna_paminns: också gratis timmar '
  '(data.gratis), och för en familj utan studiehjälpare en uppgift till oss i stället för mejlet.';
