-- ============================================================
-- NEXTRUM — NexLäx: uppdragen och NP-spåret (2026-10-06)
--
-- Leo 2026-10-06: "Ta inspiration från duolingo ... gör ett quest
-- system", och "gör en inför nationella prov-sektion i varje ämne som
-- har nationella prov". Två tillägg. Rättningen, stjärnorna och XP:n är
-- som förut: inget här ändrar vad ett svar är värt.
--
-- 1. NP-SPÅRET (nivaer.spar). 'vag' är vägen, som förut. 'np' är
--    sektionen Inför nationella provet: områden som tränar det provet
--    frågar efter. bygg-uppgifter.py sätter spåret ur områdets namn
--    (NP-träning, inför NP), och vyerna lägger de nivåerna i en egen
--    sektion där alla är öppna. Det är en spelregel, som upplåsningen,
--    inget skydd: databasen rättar och räknar dem som alla andra nivåer.
--
-- 2. UPPDRAGEN (intern.nexlax_uppdrag, nexlax_lage().uppdrag). Tre om
--    dagen, ett i veckan och en utmaning i månaden. De RÄKNAS ur svaren
--    och försöken, som stjärnorna, serien och XP:n, och sparas aldrig:
--    ett uppdrag i en egen tabell hade kunnat säga något annat än raderna
--    det bygger på. Reglerna står här och bara här, och vyerna ritar det
--    som kommer ur nexlax_lage().
--      · Dagens tre: ett ur varje grupp (xp, nivaer, kunna), valt ur
--        elevens id och dagen. Samma elev får samma tre hela dagen, på
--        alla enheter, och en annan elev andra.
--      · Veckans: ett ur gruppen vecka, valt ur elevens id och veckan.
--      · Månadens utmaning: klara 20 av dagens uppdrag under månaden.
--    Ett uppdrag ger INGA XP: XP mäter vad eleven kan (Fas 23.2), och ett
--    uppdrag mäter att hen övat. Belöningen är att det syns, dagens kista
--    och märkena i vyn. Belöningar är märken, inte pengar.
--    Ingenting påminner om uppdragen, som om serien: ingen notistyp och
--    inget mejl. Ett uppdrag som inte blir klart försvinner vid midnatt
--    utan att något går förlorat.
--
-- KATALOGEN ÄR HISTORIK. Ett uppdrag har en dag det gäller från
-- ('fran'). Dagar före den har inte uppdraget, så det som redan räknats
-- (hur många uppdrag eleven klarat) står still när ett nytt läggs till.
-- Ändra därför aldrig ett befintligt uppdrags mål eller mått, och ta
-- inte bort ett: lägg till ett nytt id med ett nytt 'fran'.
--
-- Lapparna på nexlax_lage() och barn_nexlax() prövar sina träffar
-- (CLAUDE.md avsnitt 5), lästa i driften 2026-10-06, och går att köra
-- två gånger. Inget drop och ingen delete: kolumnen läggs till med sitt
-- villkor.
-- ============================================================

-- ---------- NP-spåret ----------
alter table public.nivaer
  add column if not exists spar text not null default 'vag'
    constraint nivaer_spar_check check (spar in ('vag', 'np'));

comment on column public.nivaer.spar is
  'vag: vägen. np: sektionen Inför nationella provet, där varje nivå är öppen. '
  'Skrivs av bygg-uppgifter.py ur områdets namn (nexlax_uppdrag_och_np).';

-- ---------- katalogen över uppdragen ----------
-- matt är vad som räknas, för perioden (dagen eller veckan):
--   xp       XP ur intern.nexlax_handelser, som totalen
--   nivaer   olika nivåer klarade (minst en stjärna)
--   direkt   svar som var rätt första gången i sitt försök
--   rad      längsta raden av rätta svar i följd, i den ordning de gavs
--   tre      klara försök med tre stjärnor
--   amnen    olika ämnen med en klarad nivå
--   dagar    olika dagar med en klarad nivå
--   omraden  områden som blev klara (som 100 XP-händelserna)
create or replace function intern.nexlax_uppdragen()
returns table (id text, grupp text, matt text, mal int, text text, fran date)
language sql
immutable
set search_path = public, pg_temp
as $$
  select * from (values
    ('xp-50',      'xp',     'xp',      50,  'Samla 50 XP',                                  date '2026-10-06'),
    ('xp-100',     'xp',     'xp',      100, 'Samla 100 XP',                                 date '2026-10-06'),
    ('xp-150',     'xp',     'xp',      150, 'Samla 150 XP',                                 date '2026-10-06'),
    ('nivaer-1',   'nivaer', 'nivaer',  1,   'Klara en nivå',                                date '2026-10-06'),
    ('nivaer-2',   'nivaer', 'nivaer',  2,   'Klara två olika nivåer',                       date '2026-10-06'),
    ('nivaer-3',   'nivaer', 'nivaer',  3,   'Klara tre olika nivåer',                       date '2026-10-06'),
    ('direkt-10',  'kunna',  'direkt',  10,  'Svara rätt direkt på 10 uppgifter',            date '2026-10-06'),
    ('direkt-15',  'kunna',  'direkt',  15,  'Svara rätt direkt på 15 uppgifter',            date '2026-10-06'),
    ('rad-5',      'kunna',  'rad',     5,   'Svara rätt fem gånger i rad',                  date '2026-10-06'),
    ('rad-8',      'kunna',  'rad',     8,   'Svara rätt åtta gånger i rad',                 date '2026-10-06'),
    ('tre-1',      'kunna',  'tre',     1,   'Klara en nivå med tre stjärnor',               date '2026-10-06'),
    ('amnen-2',    'kunna',  'amnen',   2,   'Klara nivåer i två olika ämnen',               date '2026-10-06'),
    ('v-dagar-3',  'vecka',  'dagar',   3,   'Klara en nivå tre olika dagar den här veckan', date '2026-10-06'),
    ('v-nivaer-6', 'vecka',  'nivaer',  6,   'Klara sex olika nivåer den här veckan',        date '2026-10-06'),
    ('v-omrade-1', 'vecka',  'omraden', 1,   'Gör klart ett helt område den här veckan',     date '2026-10-06'),
    ('v-xp-400',   'vecka',  'xp',      400, 'Samla 400 XP den här veckan',                  date '2026-10-06')
  ) u(id, grupp, matt, mal, text, fran)
$$;

comment on function intern.nexlax_uppdragen() is
  'Uppdragen i NexLäx (nexlax_uppdrag_och_np). Historik: ändra aldrig ett mål, lägg till ett nytt id med ett nytt fran.';

-- Hur många av dagens uppdrag månadens utmaning kräver. Står bara här.
create or replace function intern.nexlax_manadsmal()
returns int
language sql
immutable
set search_path = public, pg_temp
as $$ select 20 $$;

-- Ett stabilt tal ur en text, för att välja uppdrag. md5 och inte
-- hashtext(): hashtext kan räkna annorlunda efter en uppgradering, och då
-- hade elevens uppdrag bytts mitt på dagen och historiken räknats om.
create or replace function intern.nexlax_lott(p text)
returns bigint
language sql
immutable
set search_path = public, pg_temp
as $$ select ('x' || substr(md5(p), 1, 12))::bit(48)::bigint $$;

-- ---------- uppdragen för en elev ----------
-- Räknar perioderna ur raderna och väljer uppdragen ur katalogen. Allt
-- är dagar i svensk tid, som serien. Bara dagar och veckor med något
-- gjort räknas fram i historiken: en dag utan svar klarar inget uppdrag.
create or replace function intern.nexlax_uppdrag(p_elev uuid, p_idag date)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_start   date := (select min(u.fran) from intern.nexlax_uppdragen() u);
  v_fran    timestamptz;
  v_vecka   date := date_trunc('week', p_idag)::date;
  v_manad   date := date_trunc('month', p_idag)::date;
  v_ut      jsonb;
begin
  -- Midnatt den första dagen med uppdrag, i svensk tid.
  v_fran := (v_start::timestamp at time zone 'Europe/Stockholm');

  with
  h as (
    select x.sort, x.xp, (x.at at time zone 'Europe/Stockholm')::date as d
      from intern.nexlax_handelser(p_elev) x
     where x.at >= v_fran),
  svar as (
    select s.id, s.ratt, s.forsta, s.besvarad_at,
           (s.besvarad_at at time zone 'Europe/Stockholm')::date as d
      from public.niva_svar s
      join public.niva_forsok f on f.id = s.forsok_id
     where f.student_id = p_elev and s.besvarad_at >= v_fran),
  forsok as (
    select f.niva_id, f.stjarnor, f.godkand, m.amne,
           (f.klar_at at time zone 'Europe/Stockholm')::date as d
      from public.niva_forsok f
      join public.nivaer m on m.id = f.niva_id
     where f.student_id = p_elev and f.klar_at is not null and f.klar_at >= v_fran),
  -- Rätt i rad: varje fel svar börjar en ny grupp, och raden är det
  -- största antalet rätta svar i en grupp. Svaren står i den ordning de
  -- gavs, över nivåerna, inom samma dag.
  grupper as (
    select d, ratt,
           sum(case when ratt then 0 else 1 end) over (partition by d order by besvarad_at, id) as g
      from svar),
  rad as (
    select d, max(n)::int as rad
      from (select d, g, count(*) filter (where ratt) as n from grupper group by d, g) x
     group by d),
  -- Dagarna att räkna: de med något gjort, och i dag.
  dagar as (
    select d from svar union select d from forsok union select d from h
    union select p_idag),
  -- Talen per dag, med en gruppering per källa (inte en delfråga per
  -- dag: historiken växer med varje dag eleven övat).
  dag as (
    select k.d,
           coalesce(hx.xp, 0) as xp, coalesce(fx.nivaer, 0) as nivaer, coalesce(sx.direkt, 0) as direkt,
           coalesce(r.rad, 0) as rad, coalesce(fx.tre, 0) as tre, coalesce(fx.amnen, 0) as amnen
      from dagar k
      left join (select d, sum(xp)::int as xp from h group by d) hx on hx.d = k.d
      left join (select d, count(distinct niva_id) filter (where godkand)::int as nivaer,
                        count(*) filter (where stjarnor = 3)::int as tre,
                        count(distinct amne) filter (where godkand)::int as amnen
                   from forsok group by d) fx on fx.d = k.d
      left join (select d, count(*) filter (where forsta and ratt)::int as direkt
                   from svar group by d) sx on sx.d = k.d
      left join rad r on r.d = k.d
     where k.d >= v_start),
  -- Dagens tre: ett per grupp, det med lägst lott bland dem som gällde
  -- den dagen.
  dagsuppdrag as (
    select k.d, u.id, u.grupp, u.mal, u.text,
           case u.matt when 'xp' then k.xp when 'nivaer' then k.nivaer when 'direkt' then k.direkt
                       when 'rad' then k.rad when 'tre' then k.tre when 'amnen' then k.amnen end as har
      from dag k
      cross join lateral (
        select distinct on (u.grupp) u.*
          from intern.nexlax_uppdragen() u
         where u.grupp in ('xp', 'nivaer', 'kunna') and u.fran <= k.d
         order by u.grupp, intern.nexlax_lott(p_elev::text || '|' || k.d::text || '|' || u.id), u.id) u),
  -- Veckorna: de med något gjort, och den här.
  veckor as (
    select distinct date_trunc('week', d)::date as v from dag),
  vecka as (
    select w.v,
           coalesce(hx.xp, 0) as xp, coalesce(fx.nivaer, 0) as nivaer,
           coalesce(fx.dagar, 0) as dagar, coalesce(hx.omraden, 0) as omraden
      from veckor w
      left join (select date_trunc('week', d)::date as v, sum(xp)::int as xp,
                        count(*) filter (where sort = 'omrade')::int as omraden
                   from h group by 1) hx on hx.v = w.v
      left join (select date_trunc('week', d)::date as v,
                        count(distinct niva_id) filter (where godkand)::int as nivaer,
                        count(distinct d) filter (where godkand)::int as dagar
                   from forsok group by 1) fx on fx.v = w.v),
  veckouppdrag as (
    select w.v, u.id, u.mal, u.text,
           case u.matt when 'xp' then w.xp when 'nivaer' then w.nivaer when 'dagar' then w.dagar
                       when 'omraden' then w.omraden end as har
      from vecka w
      cross join lateral (
        select u.* from intern.nexlax_uppdragen() u
         where u.grupp = 'vecka' and u.fran <= w.v + 6
         order by intern.nexlax_lott(p_elev::text || '|v' || w.v::text || '|' || u.id), u.id
         limit 1) u),
  -- Månaderna: hur många av dagens uppdrag som klarades.
  manader as (
    select date_trunc('month', d)::date as m, count(*) filter (where har >= mal)::int as klara
      from dagsuppdrag group by 1)
  select jsonb_build_object(
    'dag', p_idag,
    'idag', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'grupp', x.grupp, 'text', x.text, 'mal', x.mal,
                                          'har', least(x.har, x.mal), 'klart', x.har >= x.mal)
                       order by array_position(array['xp', 'nivaer', 'kunna'], x.grupp))
        from dagsuppdrag x where x.d = p_idag), '[]'::jsonb),
    'kista', coalesce((select bool_and(x.har >= x.mal) and count(*) = 3 from dagsuppdrag x where x.d = p_idag), false),
    'vecka', (select jsonb_build_object('id', x.id, 'text', x.text, 'mal', x.mal, 'har', least(x.har, x.mal),
                                        'klart', x.har >= x.mal, 'till', x.v + 6)
                from veckouppdrag x where x.v = v_vecka),
    'manad', jsonb_build_object('manad', to_char(v_manad, 'YYYY-MM'), 'mal', intern.nexlax_manadsmal(),
                                'har', least(coalesce((select klara from manader where m = v_manad), 0), intern.nexlax_manadsmal()),
                                'klart', coalesce((select klara from manader where m = v_manad), 0) >= intern.nexlax_manadsmal()),
    'totalt', (select count(*) from dagsuppdrag where har >= mal)::int
              + (select count(*) from veckouppdrag where har >= mal)::int,
    'hela_dagar', (select count(*) from (select d from dagsuppdrag group by d
                                          having count(*) = 3 and bool_and(har >= mal)) x)::int,
    'veckor', (select count(*) from veckouppdrag where har >= mal)::int,
    'manader', (select count(*) from manader where klara >= intern.nexlax_manadsmal())::int)
  into v_ut;

  return v_ut;
end $$;

comment on function intern.nexlax_uppdrag(uuid, date) is
  'Dagens tre uppdrag, veckans, månadens utmaning och hur många som klarats, räknat ur svaren och '
  'försöken. Sparas aldrig (nexlax_uppdrag_och_np).';

revoke execute on function intern.nexlax_uppdragen(), intern.nexlax_manadsmal(), intern.nexlax_lott(text),
  intern.nexlax_uppdrag(uuid, date) from public, anon, authenticated;

-- ------------------------------------------------------------
-- Lapparna: nexlax_lage() får uppdragen och barn_nexlax() spåret.
-- ------------------------------------------------------------
do $$
declare
  fore   text;
  ankare text;
  ny     text;
  n      integer;
  lappar text[][] := array[
    array['public.nexlax_lage(uuid)',
          $g$    'regler', jsonb_build_object('val', intern.nexlax_vikt('val'), 'svarare', intern.nexlax_vikt('skriv'),$g$,
          $n$    'uppdrag', intern.nexlax_uppdrag(p_elev, v_idag),
    'regler', jsonb_build_object('val', intern.nexlax_vikt('val'), 'svarare', intern.nexlax_vikt('skriv'),$n$],
    array['public.barn_nexlax()',
          $g$'antal_fragor', n.antal_fragor, 'aktiv', n.aktiv, 'sort', n.sort, 'lastext', n.lastext)$g$,
          $n$'antal_fragor', n.antal_fragor, 'aktiv', n.aktiv, 'sort', n.sort, 'lastext', n.lastext,
               'spar', n.spar)$n$]
  ];
  i integer;
begin
  for i in 1 .. array_length(lappar, 1) loop
    fore := pg_get_functiondef(lappar[i][1]::regprocedure);
    ankare := lappar[i][2];
    ny := lappar[i][3];
    if position(ny in fore) > 0 then
      raise notice '% är redan lappad.', lappar[i][1];
      continue;
    end if;
    n := (length(fore) - length(replace(fore, ankare, ''))) / length(ankare);
    if n <> 1 then
      raise exception '%: texten som ska bytas hittades % gånger, väntat en. Läs driften.', lappar[i][1], n;
    end if;
    execute replace(fore, ankare, ny);
  end loop;
end $$;

comment on function public.nexlax_lage(uuid) is
  'XP, serien i dagar, uppdragen och underlaget för utvecklingen i NexLäx, räknat ur svaren och försöken '
  '(Fas 23.2, nexlax_uppdrag_och_np).';
