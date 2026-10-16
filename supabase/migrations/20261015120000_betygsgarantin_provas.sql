-- ============================================================
-- betygsgarantin_provas (2026-10-15)
--
-- Betygsgarantin säljs och anmäls sedan 2026-10-07, men inget i systemet
-- prövade ett anspråk (CLAUDE.md avsnitt 11): admin fick räkna ur vyerna.
-- Två funktioner:
--
--   · betygsgaranti_underlag(elev, läsår), bara superadmin: det villkoren
--     säger att vi prövar, ur det som står i familjens vy (#betygsgaranti:
--     "hållen tid, rapporterna, uteblivna pass, uppgifterna och
--     betalningarna"). Räknat, aldrig bedömt: slutbetyget (kopian),
--     lovveckorna, skolavslutningen, om en vecka togs igen när vi eller
--     studiehjälparen avbokade, och om ett ämne inte gick upp för att
--     tiden lagts på ett annat bedömer vi själva, och vyn säger det.
--   · mina_elevers_garantiamnen(), för studiehjälparen: vilka ämnen hens
--     elever har garanti i det här läsåret, aldrig betygen. Garantin
--     räknar tiden ur rapportens ämne ("Vilket ämne passet gällde ser vi
--     i rapporten"), så den som skriver rapporten behöver veta vilka
--     ämnen som räknas.
--
-- Ingen ny uppgift sparas: underlaget räknas när admin frågar. Filen tar
-- inte bort något och kan köras hel i ett do-block (CLAUDE.md avsnitt 5).
-- ============================================================

set local lock_timeout = '5s';

/* Läsåret ett datum hör till: året det börjar, den 1 juli. Samma regel
   som anmal_betygsgaranti, som bara tar emot anmälningar juli till
   december och då skriver årets tal. */
create or replace function intern.lasaret(p_dag date)
returns integer
language sql
immutable
set search_path = pg_temp
as $$
  select case when extract(month from p_dag) >= 7 then extract(year from p_dag)::int
              else extract(year from p_dag)::int - 1 end
$$;

revoke all on function intern.lasaret(date) from public, anon, authenticated;


/* UNDERLAGET

   Perioden börjar med det första passet efter anmälan i något av ämnena
   och slutar i dag, eller den 30 juni när läsåret är slut. Skolavslutningen
   och lovveckorna står med som vanliga veckor: dem stryker vi själva.

   En rapport räknas för garantin när dess ämne är ett av ämnena med
   garanti (stavat som i listan, utan hänsyn till stora bokstäver). Ett
   ämne som saknas, eller en grupp ur bokningen som "NO / Fysik / Kemi /
   Biologi" där ett av ämnena står, är oklart och står för sig: det
   avgör vi. Hållen tid är rapportens tider; saknas de räknas passets
   längd, och de passen räknas upp. En rapport där eleven inte kom räknas
   inte som tid, utan som ett uteblivet pass.

   "Togs igen" räknar överskottet över två timmar de två veckorna efter en
   vecka med för lite, och är tomt när de veckorna inte har gått än.

   Uppgifterna: de som studiehjälparen lagt i ämnet under perioden, med ett
   slutdatum som har passerat. Klar i tid är klar senast slutdatumet
   (completed_at, som skydda_laxa stämplar).

   Betalningarna: pass som avvikelsen Inte betalt räknar (avvikelser_rader,
   samma regel), och familjens fakturor från anmälan som betalades efter
   förfallodagen eller inte är betalda fast den har passerat. Fakturans
   betald_at är dagen admin markerade den, inte bankens. */
create or replace function public.betygsgaranti_underlag(p_elev uuid, p_lasar integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  idag   date := (now() at time zone 'Europe/Stockholm')::date;
  slut   date;
  jul    date;
  familj uuid;
begin
  if not public.is_admin() then
    raise exception 'Bara för admin' using errcode = '42501';
  end if;
  if p_lasar is null or p_lasar < 2020 or p_lasar > 2100 then
    raise exception 'Läsåret ska vara året det börjar.' using errcode = '22023';
  end if;
  select s.parent_id into familj from public.students s where s.id = p_elev;
  if not found then
    raise exception 'Eleven finns inte.' using errcode = 'P0002';
  end if;
  slut := least(make_date(p_lasar + 1, 6, 30), idag);
  jul  := make_date(p_lasar, 12, 31);

  return (
    with g as (
      select b.amne, b.betyg, b.anmald_at, (b.anmald_at at time zone 'Europe/Stockholm')::date as anmald
        from public.betygsgarantier b
       where b.student_id = p_elev and b.lasar = p_lasar
    ),
    r as (
      select l.lesson_date as datum, nullif(btrim(l.amne), '') as amne,
             l.narvaro is not distinct from 'franvarande' as uteblev,
             coalesce(l.hallna_min, bk.duration_min, 60) as minuter,
             l.hallna_min is null as utan_tider,
             case
               when exists (select 1 from g where lower(g.amne) = lower(btrim(l.amne))) then 'garanti'
               when nullif(btrim(l.amne), '') is null
                 or (position('/' in l.amne) > 0
                     and exists (select 1 from g where position(lower(g.amne) in lower(l.amne)) > 0)) then 'oklar'
               else 'annat'
             end as sort
        from public.lesson_reports l
        left join public.bookings bk on bk.id = l.booking_id
       where l.student_id = p_elev
    ),
    forsta as (
      select g.amne, min(r.datum) as datum
        from g
        join r on not r.uteblev and r.sort = 'garanti' and lower(r.amne) = lower(g.amne) and r.datum >= g.anmald
       group by g.amne
    ),
    period as (
      select (select min(f.datum) from forsta f) as fran, (select min(g.anmald) from g) as anmald
    ),
    i_period as (
      select r.* from r, period p where p.fran is not null and r.datum between p.fran and slut
    ),
    veckor as (
      select v.vecka::date as vecka,
             coalesce((select sum(x.minuter) from i_period x
                        where not x.uteblev and x.sort = 'garanti'
                          and x.datum >= v.vecka::date and x.datum < v.vecka::date + 7), 0)::int as minuter,
             coalesce((select sum(x.minuter) from i_period x
                        where not x.uteblev and x.sort = 'oklar'
                          and x.datum >= v.vecka::date and x.datum < v.vecka::date + 7), 0)::int as oklara,
             coalesce((select sum(x.minuter) from i_period x
                        where not x.uteblev and x.sort = 'annat'
                          and x.datum >= v.vecka::date and x.datum < v.vecka::date + 7), 0)::int as andra
        from period p,
             generate_series(date_trunc('week', p.fran::timestamp), date_trunc('week', slut::timestamp),
                             interval '1 week') v(vecka)
       where p.fran is not null
    ),
    veckor2 as (
      select v.*,
             v.minuter < 120 as under,
             case when v.minuter >= 120 then null
                  when v.vecka + 21 > idag + 1 then null
                  else coalesce(lead(greatest(v.minuter - 120, 0), 1) over w, 0)
                     + coalesce(lead(greatest(v.minuter - 120, 0), 2) over w, 0) >= 120 - v.minuter
             end as igen
        from veckor v
      window w as (order by v.vecka)
    )
    select jsonb_build_object(
      'lasar', p_lasar,
      'fran', p.fran,
      'till', slut,
      'sista_anmalan', jul,
      'amnen', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'amne', g.amne, 'betyg', g.betyg, 'anmald', g.anmald,
                 'forsta_pass', f.datum,
                 'i_tid', g.anmald <= jul and f.datum is not null and f.datum <= jul,
                 'minuter', coalesce((select sum(x.minuter) from i_period x
                                       where not x.uteblev and x.sort = 'garanti'
                                         and lower(x.amne) = lower(g.amne)), 0),
                 'pass', (select count(*) from i_period x
                           where not x.uteblev and x.sort = 'garanti' and lower(x.amne) = lower(g.amne)),
                 'uppgifter', (
                   select jsonb_build_object(
                            'totalt', count(*),
                            'i_tid', count(*) filter (
                              where h.status = 'klar'
                                and (h.completed_at at time zone 'Europe/Stockholm')::date <= h.due_date))
                     from public.homework h
                    where h.student_id = p_elev
                      and p.fran is not null
                      and (h.created_at at time zone 'Europe/Stockholm')::date between p.fran and slut
                      and h.due_date is not null and h.due_date < idag
                      and (lower(btrim(h.subject)) = lower(g.amne)
                           or exists (select 1 from public.nivaer n
                                       where n.id = h.niva_id and lower(n.amne) = lower(g.amne))))
               ) order by g.amne)
          from g left join forsta f on f.amne = g.amne), '[]'::jsonb),
      'veckor', coalesce((
        select jsonb_agg(jsonb_build_object('vecka', v.vecka, 'minuter', v.minuter, 'oklara', v.oklara,
                                            'andra', v.andra, 'under', v.under, 'igen', v.igen)
                         order by v.vecka)
          from veckor2 v), '[]'::jsonb),
      'oklara', coalesce((
        select jsonb_agg(jsonb_build_object('datum', x.datum, 'amne', x.amne, 'minuter', x.minuter)
                         order by x.datum)
          from i_period x where not x.uteblev and x.sort = 'oklar'), '[]'::jsonb),
      'utan_tider', (select count(*) from i_period x where not x.uteblev and x.sort = 'garanti' and x.utan_tider),
      'uteblivna', coalesce((
        select jsonb_agg(jsonb_build_object('datum', x.datum, 'amne', x.amne) order by x.datum)
          from r x where x.uteblev and p.anmald is not null and x.datum between p.anmald and slut), '[]'::jsonb),
      'avbokade', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'datum', b.wanted_date,
                 'av', case when b.avbokad_av is null then 'okänt'
                            when b.avbokad_av = b.tutor_id then 'studiehjälparen'
                            when b.avbokad_av = b.parent_id
                              or b.avbokad_av = (select s.user_id from public.students s where s.id = p_elev)
                              then 'familjen'
                            when exists (select 1 from public.admin_roller a where a.user_id = b.avbokad_av)
                              then 'Nextrum'
                            else 'okänt' end,
                 'skal', b.avbokningsskal) order by b.wanted_date)
          from public.bookings b
         where b.student_id = p_elev and b.status = 'cancelled'
           and p.anmald is not null and b.wanted_date between p.anmald and slut), '[]'::jsonb),
      'obetalda', coalesce((
        select jsonb_agg(jsonb_build_object('datum', a.datum) order by a.datum)
          from public.avvikelser_rader() a
          join public.bookings b on b.id::text = a.objekt_id
         where a.typ = 'ej_betalt' and b.student_id = p_elev
           and p.anmald is not null and a.datum between p.anmald and slut), '[]'::jsonb),
      'sena_fakturor', coalesce((
        select jsonb_agg(jsonb_build_object('period', i.period, 'forfaller', i.forfaller,
                                            'betald', (i.betald_at at time zone 'Europe/Stockholm')::date)
                         order by i.period)
          from public.invoices i
         where i.parent_id = familj and i.status <> 'makulerad'
           and p.anmald is not null and i.period >= date_trunc('month', p.anmald)::date and i.period <= slut
           and i.forfaller is not null
           and (((i.betald_at at time zone 'Europe/Stockholm')::date > i.forfaller)
                or (i.betald_at is null and i.forfaller < idag))), '[]'::jsonb)
    )
    from period p
  );
end $$;

revoke execute on function public.betygsgaranti_underlag(uuid, integer) from public, anon;
grant execute on function public.betygsgaranti_underlag(uuid, integer) to authenticated;

comment on function public.betygsgaranti_underlag(uuid, integer) is
  'betygsgarantin_provas (2026-10-15). Underlaget för att pröva ett anspråk: ämnena, första passet, hållen tid '
  'per vecka, oklara ämnen, uteblivna och avbokade pass, uppgifterna i tid och betalningarna. Räknat, aldrig '
  'bedömt. Bara superadmin.';


/* Vilka ämnen studiehjälparens elever har garanti i det här läsåret.
   Aldrig betyget: det är familjens och vårt. */
create or replace function public.mina_elevers_garantiamnen()
returns table (student_id uuid, amne text)
language sql
stable
security definer
set search_path = ''
as $$
  select g.student_id, g.amne
    from public.betygsgarantier g
   where public.is_my_student(g.student_id)
     and g.lasar = intern.lasaret((now() at time zone 'Europe/Stockholm')::date)
   order by g.student_id, g.amne
$$;

revoke execute on function public.mina_elevers_garantiamnen() from public, anon;
grant execute on function public.mina_elevers_garantiamnen() to authenticated;

comment on function public.mina_elevers_garantiamnen() is
  'betygsgarantin_provas (2026-10-15). Ämnena studiehjälparens elever har betygsgaranti i det här läsåret, '
  'så att rapportens ämne blir rätt. Aldrig betyget.';
