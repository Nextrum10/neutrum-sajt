-- ============================================================
-- NEXTRUM — behoven styr matchningen (2026-10-21)
--
-- Leo: "det är ju behovet som ska ge oss den statistiken". Familjen
-- har kunnat ange behov på barnet sedan Fas 15.4 (students.behov),
-- men ingenting matchade mot dem: studiehjälparen hade ingen
-- motsvarighet, och intresseanmälan frågade inte.
--
-- Nu tre saker:
--   1. Intresseanmälan sparar behov och önskat upplägg som koder
--      (leads.behov, leads.format_onskemal). Adminvyn för dem vidare
--      till eleven när familjen tas in.
--   2. Studiehjälparen väljer sina styrkor bland samma sex behov
--      (tutor_profiles.styrkor), i sin profil. skydda_tutorfalt
--      släpper igenom kolumnen.
--   3. matchningspoang() ger poäng för elevens behov som möts av en
--      styrka. Vikterna fördelas om så att summan fortfarande är 100,
--      för adminvyn visar poängen som procent: ämne 45, årskurs 27,
--      behov 12, utrymme 10, erfarenhet 6 (förut 50, 30, -, 12, 8).
--      Vet ingen sida något om behov blir det halva, som för ämne och
--      årskurs: en tom profil ska inte straffas som ett nej.
--
-- Koderna är NX.BEHOV och students.behov: laxor, prov, ikapp,
-- utmaning, struktur, motivation. Aldrig hälsouppgifter.
--
-- matchningspoang() med sju argument står kvar och anropar den nya
-- med tomma behov: ai_verktyg och allt annat som anropar den gamla
-- signaturen fungerar som förut, utan ett drop.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Intresseanmälan
-- ------------------------------------------------------------
alter table public.leads
  add column if not exists behov text[] not null default '{}',
  add column if not exists format_onskemal text;

alter table public.leads
  add constraint leads_behov_koder check (
    behov <@ array['laxor','prov','ikapp','utmaning','struktur','motivation']::text[]
    and cardinality(behov) <= 6),
  add constraint leads_format_onskemal_koder check (
    format_onskemal is null or format_onskemal in ('online','pa_plats','bada'));

comment on column public.leads.behov is
  'Vad familjen vill att hjälpen ska göra, fasta koder som students.behov (NX.BEHOV). Skrivs av en anonym besökare, men villkoret släpper bara igenom koderna. Förs till eleven när familjen tas in.';
comment on column public.leads.format_onskemal is
  'Önskat upplägg ur anmälan: online, pa_plats eller bada. Null = spelar ingen roll. Förs till eleven när familjen tas in.';

-- ------------------------------------------------------------
-- 2. Studiehjälparens styrkor
-- ------------------------------------------------------------
alter table public.tutor_profiles
  add column if not exists styrkor text[] not null default '{}';

alter table public.tutor_profiles
  add constraint tutor_profiles_styrkor_koder check (
    styrkor <@ array['laxor','prov','ikapp','utmaning','struktur','motivation']::text[]
    and cardinality(styrkor) <= 6);

comment on column public.tutor_profiles.styrkor is
  'Vilka av elevernas behov studiehjälparen är bra på, samma koder som students.behov. Väljs i profilen, och matchningspoang() ger poäng när de möter elevens behov.';

-- skydda_tutorfalt släpper bara igenom en vitlista. Styrkorna läggs
-- till där, med samma lapp som annars: replace() på den körda
-- funktionen, och ett fel om listan inte hittas, i stället för att
-- skriva över en funktion en annan session kan ha ändrat.
do $lapp$
declare
  forut text := pg_get_functiondef('public.skydda_tutorfalt()'::regprocedure);
  sedan text;
begin
  if forut like '%''availability'', ''styrkor''%' then
    return;
  end if;
  sedan := replace(forut,
    $a$'formats', 'bio', 'age', 'availability'];$a$,
    $a$'formats', 'bio', 'age', 'availability', 'styrkor'];$a$);
  if sedan = forut then
    raise exception 'skydda_tutorfalt: hittade inte vitlistan, inget ändrat';
  end if;
  execute sedan;
end
$lapp$;

-- ------------------------------------------------------------
-- 3. Matchningen
-- ------------------------------------------------------------
create or replace view public.matchningsunderlag
with (security_invoker = true) as
 SELECT t.id AS tutor_id,
    p.full_name AS namn,
    p.email,
    t.city AS ort,
    t.subjects AS amnen,
    t.grade_levels AS arskurser,
    t.formats AS format,
    t.hourly_rate AS timpris,
    t.bio,
    ( SELECT count(*) AS count
           FROM students s
          WHERE s.matched_tutor_id = t.id AND s.match_status = 'matched'::text) AS antal_elever,
    ( SELECT count(*) AS count
           FROM bookings b
          WHERE b.tutor_id = t.id AND b.status = 'completed'::text) AS genomforda_pass,
    ( SELECT array_agg(DISTINCT a.weekday ORDER BY a.weekday) AS array_agg
           FROM tutor_availability a
          WHERE a.tutor_id = t.id) AS veckodagar,
    t.styrkor
   FROM tutor_profiles t
     JOIN profiles p ON p.id = t.id
  WHERE t.status = 'approved'::text;

create or replace function public.behov_mots(p_elev text[], p_tutor text[])
returns jsonb
language sql
immutable
set search_path to 'public'
as $f$
  -- Null när någon sida inte angett något: vet ej, inte nej.
  select case
    when coalesce(cardinality(p_elev), 0) = 0 or coalesce(cardinality(p_tutor), 0) = 0 then null
    else jsonb_build_object(
      'traffar', (select count(distinct x) from unnest(p_elev) x where x = any(p_tutor)),
      'av',      (select count(distinct x) from unnest(p_elev) x))
  end;
$f$;

comment on function public.behov_mots(text[], text[]) is
  'Hur många av elevens behov som studiehjälparens styrkor möter: {traffar, av}, eller null när någon sida saknar dem. Används av matchningspoang().';

create or replace function public.matchningspoang(
  p_elev_amnen      text[],
  p_elev_arskurs    text,
  p_elev_behov      text[],
  p_tutor_amnen     text[],
  p_tutor_arskurser text[],
  p_tutor_styrkor   text[],
  p_antal_elever    integer,
  p_genomforda_pass integer,
  p_regler          jsonb
)
returns jsonb
language plpgsql
immutable
set search_path to 'public'
as $f$
declare
  regler  jsonb := coalesce(nullif(p_regler, '{}'::jsonb), '{}'::jsonb);
  v_amne  numeric := coalesce((regler ->> 'amne')::numeric, 45);
  v_ars   numeric := coalesce((regler ->> 'arskurs')::numeric, 27);
  v_beh   numeric := coalesce((regler ->> 'behov')::numeric, 12);
  v_utr   numeric := coalesce((regler ->> 'utrymme')::numeric, 10);
  v_erf   numeric := coalesce((regler ->> 'erfarenhet')::numeric, 6);
  a       jsonb := public.amnen_mots(p_elev_amnen, p_tutor_amnen);
  n       boolean := public.niva_tacker(p_tutor_arskurser, p_elev_arskurs);
  b       jsonb := public.behov_mots(p_elev_behov, p_tutor_styrkor);
  elever  numeric := coalesce(p_antal_elever, 0);
  pass    numeric := coalesce(p_genomforda_pass, 0);
  p_amne  numeric;
  p_ars   numeric;
  p_beh   numeric;
  amne_nej boolean;
  ars_nej  boolean;
  poang   numeric;
begin
  if a is null then
    p_amne := v_amne / 2;                                   -- vet ej: halva, aldrig noll
  elsif (a ->> 'traffar')::numeric > 0 then
    p_amne := v_amne * ((a ->> 'traffar')::numeric / (a ->> 'av')::numeric);
  else
    p_amne := 0;
  end if;

  p_ars := case when n is null then v_ars / 2 when n then v_ars else 0 end;

  -- Behoven är aldrig ett hårt nej: en studiehjälpare utan just den
  -- styrkan kan fortfarande vara rätt person. De flyttar bara ordningen.
  p_beh := case when b is null then v_beh / 2
                else v_beh * ((b ->> 'traffar')::numeric / (b ->> 'av')::numeric) end;

  amne_nej := (a is not null and (a ->> 'traffar')::numeric = 0);
  ars_nej  := (n is not null and n = false);

  poang := round(p_amne + p_ars + p_beh
                 + v_utr * greatest(0, 1 - elever / 5)
                 + v_erf * least(1, pass / 10));

  -- Ett hårt nej kapar under 50. Fel årskurs är fel person, hur
  -- många pass hen än kört.
  if amne_nej or ars_nej then
    poang := least(poang, 49);
  end if;

  return jsonb_build_object(
    'poang', poang::integer,
    'amne_utfall', case when a is null then 'vet_ej'
                        when (a ->> 'traffar')::numeric > 0 then 'ja' else 'nej' end,
    'amne_traffar', case when a is null then null else (a ->> 'traffar')::integer end,
    'amne_av', case when a is null then coalesce(array_length(p_elev_amnen, 1), 0)
                    else (a ->> 'av')::integer end,
    'arskurs_utfall', case when n is null then 'vet_ej' when n then 'ja' else 'nej' end,
    'behov_utfall', case when b is null then 'vet_ej'
                         when (b ->> 'traffar')::numeric > 0 then 'ja' else 'nej' end,
    'behov_traffar', case when b is null then null else (b ->> 'traffar')::integer end,
    'behov_av', case when b is null then coalesce(cardinality(p_elev_behov), 0)
                     else (b ->> 'av')::integer end,
    'hart_nej', (amne_nej or ars_nej));
end $f$;

-- Den gamla signaturen: samma räkning utan behov.
create or replace function public.matchningspoang(
  p_elev_amnen      text[],
  p_elev_arskurs    text,
  p_tutor_amnen     text[],
  p_tutor_arskurser text[],
  p_antal_elever    integer,
  p_genomforda_pass integer,
  p_regler          jsonb default '{}'::jsonb
)
returns jsonb
language sql
immutable
set search_path to 'public'
as $f$
  select public.matchningspoang(p_elev_amnen, p_elev_arskurs, '{}'::text[],
                                p_tutor_amnen, p_tutor_arskurser, '{}'::text[],
                                p_antal_elever, p_genomforda_pass, coalesce(p_regler, '{}'::jsonb));
$f$;

create or replace function public.matchningsforslag_rader(p_elev uuid)
returns table(tutor_id uuid, poang integer, amne_utfall text, amne_traffar integer, amne_av integer,
              arskurs_utfall text, antal_elever integer, genomforda_pass integer, hart_nej boolean)
language plpgsql
stable security definer
set search_path to 'public'
as $f$
declare
  elev   record;
  regler jsonb;
begin
  select s.id, s.subjects, s.grade, s.behov, u.tjanst
    into elev
    from public.students s
    left join public.uppdrag u on u.id = s.uppdrag_id
   where s.id = p_elev;

  if not found then return; end if;

  select coalesce(nullif(t.matchningsregler, '{}'::jsonb), '{}'::jsonb)
    into regler
    from public.tjanster t
   where t.kod = coalesce(elev.tjanst, public.standard_tjanst());

  return query
  with raknat as (
    select m.tutor_id,
           coalesce(m.antal_elever, 0)::integer    as elever,
           coalesce(m.genomforda_pass, 0)::integer as pass,
           public.matchningspoang(elev.subjects, elev.grade, coalesce(elev.behov, '{}'::text[]),
                                  m.amnen, m.arskurser, coalesce(m.styrkor, '{}'::text[]),
                                  coalesce(m.antal_elever, 0)::integer,
                                  coalesce(m.genomforda_pass, 0)::integer,
                                  coalesce(regler, '{}'::jsonb)) as r
      from public.matchningsunderlag m
  )
  select k.tutor_id,
         (k.r ->> 'poang')::integer,
         (k.r ->> 'amne_utfall'),
         nullif(k.r ->> 'amne_traffar', '')::integer,
         (k.r ->> 'amne_av')::integer,
         (k.r ->> 'arskurs_utfall'),
         k.elever,
         k.pass,
         (k.r ->> 'hart_nej')::boolean
    from raknat k
   order by 2 desc, 1;
end $f$;

-- Rättigheterna som den gamla räkningen: bara serverkod.
revoke execute on function public.matchningspoang(text[], text, text[], text[], text[], text[], integer, integer, jsonb)
  from public, anon, authenticated;
revoke execute on function public.behov_mots(text[], text[]) from public, anon;
