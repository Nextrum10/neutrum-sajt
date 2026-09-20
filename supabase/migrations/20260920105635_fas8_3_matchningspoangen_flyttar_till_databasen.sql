-- ============================================================
-- NEXTRUM — Fas 8.3: matchningspoängen flyttar till databasen
--
-- Poängsättningen har bott i adminvyns JavaScript. Den fungerar, men
-- den går inte att fråga: en agent, ett schema eller en kontroll kan
-- inte veta vem som passar en elev utan att rita en sida först.
--
-- Reglerna är ORDAGRANT desamma. Det är hela poängen, och därför
-- står varje term här med samma vikt, samma reservläge och samma
-- tak som i nextrum-admin-drift.js:
--
--   ämne 50, årskurs 30, utrymme 12, erfarenhet 8
--   · ett kriterium vi inte VET något om ger halva poängen, aldrig
--     noll — att straffa en elev för ett tomt fält är att straffa
--     fel person
--   · utrymme: full poäng vid noll elever, ingen vid fem
--   · erfarenhet: full poäng vid tio genomförda pass
--   · ett hårt nej (fel ämne eller fel årskurs) kapar poängen till
--     49, så att den aldrig kan gå om någon utan hårt nej. Fel
--     årskurs är fel person, hur många pass hen än kört.
--
-- TRE SAKER SOM MÅSTE RÄKNAS I SQL, INTE SOM I JAVASCRIPT:
--
--   1. round() på float8 i Postgres avrundar till JÄMNT tal: 24.5
--      blir 24, medan JavaScript ger 25. Allt räknas därför i
--      numeric, där round() avrundar uppåt från .5 som JS gör.
--   2. Ämnesjämförelsen är delsträng ÅT BÅDA HÅLL. "NO fysik kemi"
--      hos eleven och "fysik" hos hjälparen är en träff.
--   3. Dubbletter i elevens ämnen räknas som dubbletter, precis som
--      i JavaScript-versionen, eftersom andelen är träffar delat med
--      antalet ämnen som står skrivna.
--
-- Vikterna kan sättas per tjänst i tjanster.matchningsregler
-- (kolumnen kom i Fas 5.1 och är tom för alla tjänster i dag). Är
-- den tom gäller siffrorna ovan, alltså exakt dagens svar.
--
-- SVARET BÄR INGA NAMN. Funktionen ger id, poäng, utfall och tal.
-- Meningarna skrivs i gränssnittet — dels för att svensk
-- gränssnittstext inte hör hemma i databasen, dels för att samma
-- svar ska kunna läsas av en agent utan att den får personuppgifter
-- på köpet.
-- ============================================================

-- ------------------------------------------------------------
-- Årskursen kommer in som fritext från två håll som aldrig pratat
-- med varandra: elevens "Åk 8" ur en rullgardin, och hjälparens
-- "Åk 7–9" eller "Gymnasiet", handskrivet. Parsern läser siffror och
-- ordet gymnasiet och struntar i resten. Tankstreck och bindestreck
-- är samma sak för den, vilket de inte är för en strängjämförelse.
-- ------------------------------------------------------------
create or replace function public.niva_tolk(p text)
returns jsonb
language plpgsql
immutable
set search_path to 'public'
as $$
declare
  t       text := lower(coalesce(p, ''));
  gym     boolean := position('gymnas' in t) > 0;
  siffror int[] := array(select (m[1])::int from regexp_matches(t, '\d+', 'g') m);
  antal   int := coalesce(array_length(siffror, 1), 0);
begin
  if gym then
    -- Samma som JavaScript: "siffror[0] || null" gör en nolla till
    -- ingenting, och för gymnasiet spelar siffrorna ändå ingen roll.
    return jsonb_build_object(
      'gym', true,
      'fran', case when antal >= 1 then nullif(siffror[1], 0) end,
      'till', case when antal >= 2 then nullif(siffror[2], 0)
                   when antal = 1 then nullif(siffror[1], 0) end);
  end if;
  if antal = 0 then
    return null;                       -- vet ej
  end if;
  return jsonb_build_object('gym', false, 'fran', siffror[1],
    'till', case when antal > 1 then siffror[2] else siffror[1] end);
end $$;

-- true, false eller null. null betyder "vet ej" och ger halva
-- poängen längre ner — inte noll.
create or replace function public.niva_tacker(p_tutor text[], p_elev text)
returns boolean
language plpgsql
immutable
set search_path to 'public'
as $$
declare
  e      jsonb := public.niva_tolk(p_elev);
  n      jsonb;
  x      text;
  nagon  boolean := false;
  tacker boolean := false;
begin
  if e is null then return null; end if;
  foreach x in array coalesce(p_tutor, '{}'::text[]) loop
    n := public.niva_tolk(x);
    if n is null then continue; end if;
    nagon := true;
    if (e ->> 'gym')::boolean then
      tacker := tacker or (n ->> 'gym')::boolean;
    elsif (n ->> 'gym')::boolean then
      null;                            -- gymnasielärare täcker inte grundskolan
    else
      tacker := tacker or ((e ->> 'fran')::int >= (n ->> 'fran')::int
                       and (e ->> 'fran')::int <= (n ->> 'till')::int);
    end if;
  end loop;
  if not nagon then return null; end if;
  return tacker;
end $$;

-- null = vet ej. Annars {traffar, av}.
create or replace function public.amnen_mots(p_elev text[], p_tutor text[])
returns jsonb
language plpgsql
immutable
set search_path to 'public'
as $$
declare
  e       text[];
  t       text[];
  x       text;
  traffar int := 0;
begin
  select array(select btrim(regexp_replace(lower(v), '[^a-zåäö0-9]+', ' ', 'g'))
                 from unnest(coalesce(p_elev, '{}'::text[])) v
                where btrim(regexp_replace(lower(v), '[^a-zåäö0-9]+', ' ', 'g')) <> '')
    into e;
  select array(select btrim(regexp_replace(lower(v), '[^a-zåäö0-9]+', ' ', 'g'))
                 from unnest(coalesce(p_tutor, '{}'::text[])) v
                where btrim(regexp_replace(lower(v), '[^a-zåäö0-9]+', ' ', 'g')) <> '')
    into t;

  if coalesce(array_length(e, 1), 0) = 0 or coalesce(array_length(t, 1), 0) = 0 then
    return null;
  end if;

  foreach x in array e loop
    if exists (select 1 from unnest(t) y where position(x in y) > 0 or position(y in x) > 0) then
      traffar := traffar + 1;
    end if;
  end loop;

  return jsonb_build_object('traffar', traffar, 'av', array_length(e, 1));
end $$;

-- ------------------------------------------------------------
-- Själva rankningen. Utan grind — den finns i wrappern nedan, precis
-- som avvikelser_rader / ekonomiska_avvikelser (Fas 7.3b).
--
-- STABLE, inte VOLATILE: en STABLE-funktion kan inte skriva. Det är
-- läsgarantin, i databasen i stället för i en kommentar.
-- ------------------------------------------------------------
create or replace function public.matchningsforslag_rader(p_elev uuid)
returns table (
  tutor_id        uuid,
  poang           integer,
  amne_utfall     text,
  amne_traffar    integer,
  amne_av         integer,
  arskurs_utfall  text,
  antal_elever    integer,
  genomforda_pass integer,
  hart_nej        boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  elev     record;
  regler   jsonb;
  v_amne   numeric;
  v_ars    numeric;
  v_utr    numeric;
  v_erf    numeric;
begin
  select s.id, s.subjects, s.grade, u.tjanst
    into elev
    from public.students s
    left join public.uppdrag u on u.id = s.uppdrag_id
   where s.id = p_elev;

  if not found then return; end if;

  select coalesce(nullif(t.matchningsregler, '{}'::jsonb), '{}'::jsonb)
    into regler
    from public.tjanster t
   where t.kod = coalesce(elev.tjanst, public.standard_tjanst());

  regler := coalesce(regler, '{}'::jsonb);
  v_amne := coalesce((regler ->> 'amne')::numeric, 50);
  v_ars  := coalesce((regler ->> 'arskurs')::numeric, 30);
  v_utr  := coalesce((regler ->> 'utrymme')::numeric, 12);
  v_erf  := coalesce((regler ->> 'erfarenhet')::numeric, 8);

  return query
  with grund as (
    select m.tutor_id,
           public.amnen_mots(elev.subjects, m.amnen)      as a,
           public.niva_tacker(m.arskurser, elev.grade)    as n,
           coalesce(m.antal_elever, 0)::numeric           as elever,
           coalesce(m.genomforda_pass, 0)::numeric        as pass
      from public.matchningsunderlag m
  ),
  delar as (
    select g.tutor_id, g.a, g.n, g.elever, g.pass,
           case when g.a is null then v_amne / 2
                when (g.a ->> 'traffar')::numeric > 0
                  then v_amne * ((g.a ->> 'traffar')::numeric / (g.a ->> 'av')::numeric)
                else 0 end                                            as p_amne,
           case when g.n is null then v_ars / 2
                when g.n then v_ars
                else 0 end                                            as p_ars,
           v_utr * greatest(0, 1 - g.elever / 5)                       as p_utr,
           v_erf * least(1, g.pass / 10)                              as p_erf,
           (g.a is not null and (g.a ->> 'traffar')::numeric = 0)      as amne_nej,
           (g.n is not null and g.n = false)                           as ars_nej
      from grund g
  )
  select d.tutor_id,
         case when d.amne_nej or d.ars_nej
              then least(round(d.p_amne + d.p_ars + d.p_utr + d.p_erf), 49)
              else round(d.p_amne + d.p_ars + d.p_utr + d.p_erf) end::integer,
         case when d.a is null then 'vet_ej'
              when (d.a ->> 'traffar')::numeric > 0 then 'ja'
              else 'nej' end,
         case when d.a is null then null else (d.a ->> 'traffar')::integer end,
         case when d.a is null then coalesce(array_length(elev.subjects, 1), 0)
              else (d.a ->> 'av')::integer end,
         case when d.n is null then 'vet_ej' when d.n then 'ja' else 'nej' end,
         d.elever::integer,
         d.pass::integer,
         (d.amne_nej or d.ars_nej)
    from delar d
   order by 2 desc, 1;                 -- poäng, sedan id: samma ordning varje gång
end $$;

comment on function public.matchningsforslag_rader(uuid) is
  'Rankar studiehjälpare för en elev. Ingen behörighetskontroll — bara för serverkod. Ordningen vid lika poäng avgörs av id, så att två körningar ger samma lista.';

revoke execute on function public.matchningsforslag_rader(uuid) from public, anon, authenticated;

-- Den publika vägen: samma svar, med adminvakten framför.
create or replace function public.matchningsforslag(p_elev uuid)
returns table (
  tutor_id        uuid,
  poang           integer,
  amne_utfall     text,
  amne_traffar    integer,
  amne_av         integer,
  arskurs_utfall  text,
  antal_elever    integer,
  genomforda_pass integer,
  hart_nej        boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum ser matchningsförslagen.';
  end if;
  return query select * from public.matchningsforslag_rader(p_elev);
end $$;

revoke execute on function public.matchningsforslag(uuid) from public, anon;
grant execute on function public.matchningsforslag(uuid) to authenticated;
