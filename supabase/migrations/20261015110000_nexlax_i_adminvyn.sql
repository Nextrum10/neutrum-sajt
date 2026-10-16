-- ============================================================
-- nexlax_i_adminvyn (2026-10-15)
--
-- Adminvyn har haft felrapporterna men ingen vy över nivåerna själva
-- (CLAUDE.md avsnitt 11). Två funktioner för Material i adminvyn, bara
-- för en superadmin:
--
--   · nexlax_banor(): en rad per bana (ämne, årskurs och spår) med
--     nivåerna, provnivåerna, frågorna, försöken, de klara och godkända,
--     eleverna, de öppna felrapporterna och det senaste försöket
--   · nexlax_nivaer(ämne, årskurs, spår): samma tal för varje nivå i
--     banan, i spelets ordning, och snittet av stjärnorna
--
-- Bara antal: aldrig en fråga, ett alternativ eller ett facit (frågorna
-- går ut utan facit, och den här vyn behöver inget av det). Försöken är
-- fler än tusen, så de räknas här och inte i webbläsaren (PostgREST
-- lämnar ut högst tusen rader). Barn i familjer med en adminroll räknas
-- inte, som i analysvyerna (intern.utanfor_statistiken): provbarnen
-- hade annars varit de flitigaste.
--
-- Filen tar inte bort något och kan köras hel i ett do-block (CLAUDE.md
-- avsnitt 5).
-- ============================================================

set local lock_timeout = '5s';

/* Försöken som räknas: på aktiva nivåer, av barn i familjer utan
   adminroll. intern, för den är ingen fråga någon annan får ställa. */
create or replace function intern.nexlax_forsok_raknas()
returns table (niva_id uuid, student_id uuid, klar_at timestamptz, godkand boolean,
               stjarnor smallint, startad_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select fo.niva_id, fo.student_id, fo.klar_at, fo.godkand, fo.stjarnor, fo.startad_at
    from public.niva_forsok fo
    join public.students s on s.id = fo.student_id
   where not intern.utanfor_statistiken(s.parent_id)
$$;

revoke all on function intern.nexlax_forsok_raknas() from public, anon, authenticated;

comment on function intern.nexlax_forsok_raknas() is
  'nexlax_i_adminvyn (2026-10-15). Försöken som adminvyns nivåöversikt räknar: utan barn i familjer med en '
  'adminroll (intern.utanfor_statistiken). Inga svar, inga frågor.';


create or replace function public.nexlax_banor()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Bara för admin' using errcode = '42501';
  end if;
  -- Försöken grupperas en gång per nivå och per bana, inte en gång per
  -- nivå och fråga: de är tusentals.
  return coalesce((
    with fo as (select * from intern.nexlax_forsok_raknas()),
    per_niva as (
      select fo.niva_id, count(*)::int as forsok,
             count(*) filter (where fo.klar_at is not null)::int as klara,
             count(*) filter (where fo.godkand)::int as godkanda,
             max(fo.startad_at) as senast
        from fo
       group by fo.niva_id
    ),
    per_bana as (
      select n.amne, n.arskurs, n.spar, count(distinct fo.student_id)::int as elever
        from fo
        join public.nivaer n on n.id = fo.niva_id
       where n.aktiv
       group by n.amne, n.arskurs, n.spar
    ),
    fel as (
      select f.niva_id, count(*)::int as antal
        from public.niva_felrapporter r
        join public.niva_fragor f on f.id = r.fraga_id
       where r.hanterad_at is null
       group by f.niva_id
    )
    select jsonb_agg(to_jsonb(b) order by b.amne, b.arskurs, b.spar)
      from (
        select n.amne, n.arskurs, n.spar,
               count(*) filter (where n.sort = 'vanlig')::int as nivaer,
               count(*) filter (where n.sort <> 'vanlig')::int as prov,
               coalesce(sum(n.antal_fragor) filter (where n.sort = 'vanlig'), 0)::int as fragor,
               coalesce(sum(a.forsok), 0)::int as forsok,
               coalesce(sum(a.klara), 0)::int as klara,
               coalesce(sum(a.godkanda), 0)::int as godkanda,
               coalesce(max(e.elever), 0)::int as elever,
               coalesce(sum(f.antal), 0)::int as felrapporter,
               max(a.senast) as senast
          from public.nivaer n
          left join per_niva a on a.niva_id = n.id
          left join fel f on f.niva_id = n.id
          left join per_bana e on e.amne = n.amne and e.arskurs = n.arskurs and e.spar = n.spar
         where n.aktiv
         group by n.amne, n.arskurs, n.spar
      ) b), '[]'::jsonb);
end $$;

revoke execute on function public.nexlax_banor() from public, anon;
grant execute on function public.nexlax_banor() to authenticated;

comment on function public.nexlax_banor() is
  'nexlax_i_adminvyn (2026-10-15). Adminvyns översikt: en rad per bana med nivåerna, frågorna, försöken, '
  'eleverna och de öppna felrapporterna. Bara antal, aldrig frågor eller facit. Bara superadmin.';


create or replace function public.nexlax_nivaer(p_amne text, p_arskurs text, p_spar text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Bara för admin' using errcode = '42501';
  end if;
  return coalesce((
    with banan as (
      select n.id, n.nyckel, n.titel, n.omrade, n.sort, n.ordning, n.antal_fragor
        from public.nivaer n
       where n.aktiv and n.amne = p_amne and n.arskurs = p_arskurs and n.spar = p_spar
    ),
    per_niva as (
      select fo.niva_id, count(*)::int as forsok,
             count(*) filter (where fo.klar_at is not null)::int as klara,
             count(*) filter (where fo.godkand)::int as godkanda,
             count(distinct fo.student_id)::int as elever,
             round(avg(fo.stjarnor) filter (where fo.klar_at is not null), 1) as stjarnor
        from intern.nexlax_forsok_raknas() fo
       where fo.niva_id in (select id from banan)
       group by fo.niva_id
    ),
    fel as (
      select f.niva_id, count(*)::int as antal
        from public.niva_felrapporter r
        join public.niva_fragor f on f.id = r.fraga_id
       where r.hanterad_at is null and f.niva_id in (select id from banan)
       group by f.niva_id
    )
    select jsonb_agg(to_jsonb(x) order by x.ordning, x.titel)
      from (
        select b.id, b.nyckel, b.titel, b.omrade, b.sort, b.ordning, b.antal_fragor,
               coalesce(a.forsok, 0) as forsok, coalesce(a.klara, 0) as klara,
               coalesce(a.godkanda, 0) as godkanda, coalesce(a.elever, 0) as elever,
               a.stjarnor, coalesce(f.antal, 0) as felrapporter
          from banan b
          left join per_niva a on a.niva_id = b.id
          left join fel f on f.niva_id = b.id
      ) x), '[]'::jsonb);
end $$;

revoke execute on function public.nexlax_nivaer(text, text, text) from public, anon;
grant execute on function public.nexlax_nivaer(text, text, text) to authenticated;

comment on function public.nexlax_nivaer(text, text, text) is
  'nexlax_i_adminvyn (2026-10-15). Nivåerna i en bana med försöken, de klara, eleverna, stjärnorna och de '
  'öppna felrapporterna. Bara antal, aldrig frågor eller facit. Bara superadmin.';
