-- ============================================================
-- NEXTRUM — Fas 8.3b: räkningen bryts ut så att den går att prova
--
-- matchningsforslag_rader läser tabeller, och en funktion som läser
-- tabeller går bara att prova genom att först bygga en värld. Då
-- provas sällan mer än ett par fall, och det är i kanterna reglerna
-- bor: tomma listor, "Åk 7–9" mot "Åk 8", "NO / Fysik" mot "fysik",
-- 24,5 poäng som ska bli 25 och inte 24.
--
-- Själva räkningen tar därför bara det den behöver, och kan
-- jämföras rad för rad mot JavaScript-versionen med slumpade fall —
-- samma metod som _delad/pris_test.ts använder för faktureringen.
-- Beteendet är oförändrat: matchningsforslag_rader anropar nu den
-- här i stället för att räkna själv.
-- ============================================================

create or replace function public.matchningspoang(
  p_elev_amnen     text[],
  p_elev_arskurs   text,
  p_tutor_amnen    text[],
  p_tutor_arskurser text[],
  p_antal_elever   integer,
  p_genomforda_pass integer,
  p_regler         jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
immutable
set search_path to 'public'
as $$
declare
  regler  jsonb := coalesce(nullif(p_regler, '{}'::jsonb), '{}'::jsonb);
  v_amne  numeric := coalesce((regler ->> 'amne')::numeric, 50);
  v_ars   numeric := coalesce((regler ->> 'arskurs')::numeric, 30);
  v_utr   numeric := coalesce((regler ->> 'utrymme')::numeric, 12);
  v_erf   numeric := coalesce((regler ->> 'erfarenhet')::numeric, 8);
  a       jsonb := public.amnen_mots(p_elev_amnen, p_tutor_amnen);
  n       boolean := public.niva_tacker(p_tutor_arskurser, p_elev_arskurs);
  elever  numeric := coalesce(p_antal_elever, 0);
  pass    numeric := coalesce(p_genomforda_pass, 0);
  p_amne  numeric;
  p_ars   numeric;
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

  amne_nej := (a is not null and (a ->> 'traffar')::numeric = 0);
  ars_nej  := (n is not null and n = false);

  poang := round(p_amne + p_ars
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
    'hart_nej', (amne_nej or ars_nej));
end $$;

revoke execute on function public.matchningspoang(text[], text, text[], text[], integer, integer, jsonb)
  from public, anon, authenticated;

-- ------------------------------------------------------------
-- Samma funktion som förut, men räkningen ligger nu i
-- matchningspoang. Kolumnerna och ordningen är oförändrade.
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
  elev   record;
  regler jsonb;
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

  return query
  with raknat as (
    select m.tutor_id,
           coalesce(m.antal_elever, 0)::integer    as elever,
           coalesce(m.genomforda_pass, 0)::integer as pass,
           public.matchningspoang(elev.subjects, elev.grade, m.amnen, m.arskurser,
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
end $$;

revoke execute on function public.matchningsforslag_rader(uuid) from public, anon, authenticated;
