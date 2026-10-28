-- ============================================================
-- NEXTRUM — repetitionen i förhandsvisningen (2026-10-28)
--
-- Förhandsvisningen spelar den riktiga banan sedan 20261028110000, men
-- repetitionen nekades: den drar elevens senast missade frågor ur
-- niva_svar, och förhandsvisningens elev har inga rader där. Svaren står
-- i webbläsaren.
--
-- Urvalet bryts därför ut ur intern.nexlax_repetitionsfragor till
-- intern.nexlax_repetition_ur, som tar de missade frågorna (senaste först)
-- och de klarade nivåerna som listor. Elevens repetition läser dem ur
-- tabellerna som förut och lämnar dem dit; förhandsvisningen skickar sina
-- egna. Regeln (högst åtta, missade först, resten ur klarade nivåer i
-- samma ämne och årskurs, bara vanliga nivåer utan lästext) står kvar på
-- ett ställe, så förhandsvisningen kan inte glida isär från elevens.
-- ============================================================

do $$
begin
  if md5(pg_get_functiondef('intern.nexlax_repetitionsfragor(public.nivaer, uuid)'::regprocedure))
     <> '4e2204bb25342bf35ce9be021ef68bc6' then
    raise exception 'intern.nexlax_repetitionsfragor är inte den som lästes 2026-10-28: läs driften först.';
  end if;
end $$;

create or replace function intern.nexlax_repetition_ur(n public.nivaer, p_missade uuid[], p_klara uuid[])
returns uuid[]
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_miss uuid[];
  v_fyll uuid[];
begin
  select array_agg(x.id order by x.nr) into v_miss
    from (select d.id, d.nr
            from (select distinct on (u.id) u.id, u.nr
                    from unnest(coalesce(p_missade, '{}'::uuid[])) with ordinality u(id, nr)
                   order by u.id, u.nr) d
            join public.niva_fragor q on q.id = d.id and q.aktiv
            join public.nivaer m on m.id = q.niva_id
           where m.amne = n.amne and m.arskurs = n.arskurs
             and m.sort = 'vanlig' and m.aktiv and m.lastext is null
           order by d.nr
           limit 8) x;

  if coalesce(cardinality(v_miss), 0) < 8 then
    select array_agg(y.id) into v_fyll
      from (select q.id
              from public.niva_fragor q
              join public.nivaer m on m.id = q.niva_id
             where q.aktiv and m.aktiv and m.sort = 'vanlig' and m.lastext is null
               and m.amne = n.amne and m.arskurs = n.arskurs
               and not (q.id = any (coalesce(v_miss, '{}'::uuid[])))
               and m.id = any (coalesce(p_klara, '{}'::uuid[]))
             order by random()
             limit 8 - coalesce(cardinality(v_miss), 0)) y;
  end if;

  return (select array_agg(z order by random())
            from unnest(coalesce(v_miss, '{}'::uuid[]) || coalesce(v_fyll, '{}'::uuid[])) z);
end $$;

create or replace function intern.nexlax_repetitionsfragor(n public.nivaer, p_elev uuid)
returns uuid[]
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_miss  uuid[];
  v_klara uuid[];
begin
  with senast as (
    select distinct on (s.fraga_id) s.fraga_id, s.ratt, s.besvarad_at
      from public.niva_svar s
      join public.niva_forsok f on f.id = s.forsok_id
     where f.student_id = p_elev and s.forsta
     order by s.fraga_id, s.besvarad_at desc, s.id desc)
  select array_agg(se.fraga_id order by se.besvarad_at desc) into v_miss
    from senast se
   where not se.ratt;

  select array_agg(distinct g.niva_id) into v_klara
    from public.niva_forsok g
   where g.student_id = p_elev and g.godkand;

  return intern.nexlax_repetition_ur(n, v_miss, v_klara);
end $$;

revoke all on function intern.nexlax_repetition_ur(public.nivaer, uuid[], uuid[]) from public, anon, authenticated, service_role;
revoke all on function intern.nexlax_repetitionsfragor(public.nivaer, uuid) from public, anon, authenticated, service_role;

create or replace function public.forhandsvisning_repetition(p_niva uuid, p_missade uuid[], p_klara uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_niva   public.nivaer;
  v_fragor uuid[];
begin
  if not public.is_admin() then
    raise exception 'Förhandsvisningen är bara för admin.' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_missade), 0) > 500 or coalesce(cardinality(p_klara), 0) > 2000 then
    raise exception 'För många frågor eller nivåer.' using errcode = '22023';
  end if;
  select * into v_niva from public.nivaer where id = p_niva and aktiv and sort = 'repetition';
  if not found then
    raise exception 'Nivån är ingen repetition.' using errcode = 'P0002';
  end if;
  v_fragor := intern.nexlax_repetition_ur(v_niva, p_missade, p_klara);
  if v_fragor is null then
    raise exception 'Det finns inget att repetera än. Klara en nivå i ämnet först.' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'niva', jsonb_build_object('id', v_niva.id, 'titel', v_niva.titel, 'amne', v_niva.amne,
                               'omrade', v_niva.omrade, 'arskurs', v_niva.arskurs,
                               'sort', v_niva.sort, 'lastext', v_niva.lastext),
    'fragor', (select jsonb_agg(intern.niva_fraga_ut(f) order by u.nr)
                 from unnest(v_fragor) with ordinality u(id, nr)
                 join public.niva_fragor f on f.id = u.id));
end $$;

revoke all on function public.forhandsvisning_repetition(uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.forhandsvisning_repetition(uuid, uuid[], uuid[]) to authenticated;

comment on function intern.nexlax_repetition_ur(public.nivaer, uuid[], uuid[]) is
  'Repetitionens urval (2026-10-28): högst åtta, de missade först (senaste först), resten ur klarade nivåer i samma ämne och årskurs.';
comment on function public.forhandsvisning_repetition(uuid, uuid[], uuid[]) is
  'Förhandsvisningen (2026-10-28): en repetition ur webbläsarens missade frågor och klarade nivåer, utan facit, för superadmin. Sparar inget.';
