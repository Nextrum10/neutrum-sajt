-- ============================================================
-- NexLäx i barnets vy (2026-10-01)
--
-- Leo: "Nexläx syns inte i barnens vy". Barnets roll (nextrum_barn) når
-- inga tabeller (barnkonton_och_admin), och nivåerna startas, rättas och
-- räknas i fyra funktioner som bara släppte in föräldern, elevens
-- studiehjälpare och admin. Nu släpper de också in barnet självt:
--   niva_starta, niva_svara, niva_genomgang, nexlax_lage
-- men bara för barnets eget id, och bara medan inloggningen är aktiv: en
-- pausad inloggning har kvar en token i upp till en timme, och den ska
-- inte kunna spela (intern.mitt_aktiva_barn).
--
-- Barnet läser sin bana genom barn_nexlax(): katalogen, sina försök, de
-- påbörjade och uppgifterna från studiehjälparen. Det bockar av en vanlig
-- uppgift genom barn_uppgift(), som familjen gör i studievyn; en digital
-- uppgift blir klar när nivån klaras, som förut. Ingen tabellrättighet
-- ges: rollen har fortfarande inga, och rls-test.sql provar det.
--
-- Material från biblioteket följer med bara som länk. En fil hämtas ur
-- en privat hink med en signerad adress, och den vägen har barnet inte;
-- den öppnas i familjens inloggning.
--
-- Ett försök som barnet startar har startad_av null: kolumnen pekar på
-- profiles, och ett barnkonto har ingen profil.
--
-- Lapparna prövar sina träffar (CLAUDE.md avsnitt 5) och går att köra
-- två gånger.
-- ============================================================

-- Barnets id när den inloggade är ett barnkonto med aktiv inloggning,
-- annars null. Token och tabellen ska säga samma sak (intern.mitt_barn).
create or replace function intern.mitt_aktiva_barn()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select b.id from intern.mitt_barn() b where b.barn_aktiv
$$;

revoke all on function intern.mitt_aktiva_barn() from public, anon, authenticated;

comment on function intern.mitt_aktiva_barn() is
  'Barnets id när den inloggade är ett barnkonto med aktiv inloggning, annars null (nexlax_for_barnet).';

-- ------------------------------------------------------------
-- Lapparna: barnet släpps in i de fyra funktionerna.
-- ------------------------------------------------------------
do $$
declare
  fore   text;
  ankare text;
  ny     text;
  n      integer;
  lappar text[][] := array[
    array['public.niva_starta(uuid, uuid)',
          $g$  if not exists (select 1 from public.students s where s.id = p_elev and s.parent_id = auth.uid()) then$g$,
          $n$  if not (exists (select 1 from public.students s where s.id = p_elev and s.parent_id = auth.uid())
          or coalesce(intern.mitt_aktiva_barn() = p_elev, false)) then$n$],
    array['public.niva_starta(uuid, uuid)',
          $g$    values (p_niva, p_elev, v_fragor, auth.uid())$g$,
          $n$    values (p_niva, p_elev, v_fragor, case when intern.mitt_aktiva_barn() is null then auth.uid() end)$n$],
    array['public.niva_svara(uuid, uuid, jsonb)',
          $g$  if not found or not exists (
      select 1 from public.students s where s.id = f.student_id and s.parent_id = auth.uid()) then$g$,
          $n$  if not found or not (exists (
      select 1 from public.students s where s.id = f.student_id and s.parent_id = auth.uid())
      or coalesce(intern.mitt_aktiva_barn() = f.student_id, false)) then$n$],
    array['public.niva_genomgang(uuid)',
          $g$       or public.is_my_student(f.student_id)
       or public.is_admin()) then$g$,
          $n$       or public.is_my_student(f.student_id)
       or public.is_admin()
       or coalesce(intern.mitt_aktiva_barn() = f.student_id, false)) then$n$],
    array['public.nexlax_lage(uuid)',
          $g$          or public.is_my_student(p_elev) or public.is_admin()) then$g$,
          $n$          or public.is_my_student(p_elev) or public.is_admin()
          or coalesce(intern.mitt_aktiva_barn() = p_elev, false)) then$n$]
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

grant execute on function public.niva_starta(uuid, uuid) to nextrum_barn;
grant execute on function public.niva_svara(uuid, uuid, jsonb) to nextrum_barn;
grant execute on function public.niva_genomgang(uuid) to nextrum_barn;
grant execute on function public.nexlax_lage(uuid) to nextrum_barn;

-- ------------------------------------------------------------
-- barn_nexlax(): det NexLäx ritar, för barnet självt. Samma kolumner som
-- studievyn hämtar (NXUppgifter.laddaKatalog, laddaFörsök,
-- laddaPågående och uppgifterna i laddaLaxor), i ett svar: ett jsonb är
-- en rad, så PostgREST:s tak på tusen rader gäller inte.
-- ------------------------------------------------------------
create or replace function public.barn_nexlax()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  b public.students%rowtype;
begin
  b := intern.mitt_barn();
  if b.id is null then
    return jsonb_build_object('lage', 'saknas');
  end if;
  if not b.barn_aktiv then
    return jsonb_build_object('lage', 'pausad');
  end if;

  return jsonb_build_object(
    'lage', 'ok',
    'elev', b.id,
    'arskurs', b.grade,
    'amnen', coalesce(to_jsonb(b.subjects), '[]'::jsonb),
    'katalog', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', n.id, 'nyckel', n.nyckel, 'amne', n.amne, 'arskurs', n.arskurs, 'omrade', n.omrade,
               'titel', n.titel, 'beskrivning', n.beskrivning, 'ordning', n.ordning,
               'antal_fragor', n.antal_fragor, 'aktiv', n.aktiv, 'sort', n.sort, 'lastext', n.lastext)
             order by n.amne, n.arskurs, n.ordning, n.id)
        from public.nivaer n
       where n.aktiv), '[]'::jsonb),
    'forsok', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', f.id, 'niva_id', f.niva_id, 'student_id', f.student_id,
               'startad_at', f.startad_at, 'klar_at', f.klar_at, 'antal', f.antal,
               'ratt_direkt', f.ratt_direkt, 'stjarnor', f.stjarnor, 'godkand', f.godkand)
             order by f.startad_at, f.id)
        from public.niva_forsok f
       where f.student_id = b.id), '[]'::jsonb),
    -- Det senaste påbörjade försöket per nivå från det senaste dygnet, med
    -- hur många frågor som redan är rätt besvarade (samma som niva_starta
    -- fortsätter i).
    'pagaende', coalesce((
      select jsonb_object_agg(x.niva_id, jsonb_build_object(
               'forsok', x.id, 'startad_at', x.startad_at, 'totalt', cardinality(x.fragor),
               'klara', (select count(distinct s.fraga_id) from public.niva_svar s
                          where s.forsok_id = x.id and s.ratt)))
        from (select distinct on (f.niva_id) f.*
                from public.niva_forsok f
               where f.student_id = b.id and f.klar_at is null
                 and f.startad_at > now() - interval '1 day'
               order by f.niva_id, f.startad_at desc) x), '{}'::jsonb),
    'uppgifter', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', h.id, 'student_id', h.student_id, 'title', h.title,
               'instructions', h.instructions, 'subject', h.subject, 'due_date', h.due_date,
               'status', h.status, 'completed_at', h.completed_at, 'created_at', h.created_at,
               'niva_id', h.niva_id,
               'bibliotek_id', case when m.lank is not null then h.bibliotek_id end,
               'biblioteksmaterial', case when m.lank is not null
                                          then jsonb_build_object('titel', m.titel, 'lank', m.lank) end,
               'nivaer', case when n.id is not null then jsonb_build_object(
                           'id', n.id, 'titel', n.titel, 'amne', n.amne, 'arskurs', n.arskurs,
                           'omrade', n.omrade, 'beskrivning', n.beskrivning,
                           'antal_fragor', n.antal_fragor, 'aktiv', n.aktiv) end)
             order by h.due_date nulls last, h.created_at desc)
        from public.homework h
        left join public.biblioteksmaterial m on m.id = h.bibliotek_id
        left join public.nivaer n on n.id = h.niva_id
       where h.student_id = b.id), '[]'::jsonb)
  );
end $$;

revoke all on function public.barn_nexlax() from public, anon, authenticated;
grant execute on function public.barn_nexlax() to nextrum_barn;

comment on function public.barn_nexlax() is
  'NexLäx för barnet självt: katalogen, försöken, de påbörjade och uppgifterna från studiehjälparen (nexlax_for_barnet).';

-- ------------------------------------------------------------
-- barn_uppgift(): barnet bockar av en vanlig uppgift, som familjen gör i
-- studievyn. Bara status; skydda_laxa() håller resten, och en digital
-- uppgift blir klar när nivån klaras.
-- ------------------------------------------------------------
create or replace function public.barn_uppgift(p_id uuid, p_status text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_barn uuid := intern.mitt_aktiva_barn();
  h      public.homework%rowtype;
begin
  if v_barn is null then
    raise exception 'Logga in först.' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('ej_paborjad', 'pagaende', 'klar') then
    raise exception 'Okänt läge för en uppgift.' using errcode = '22023';
  end if;
  select * into h from public.homework where id = p_id and student_id = v_barn;
  if not found then
    raise exception 'Uppgiften finns inte.' using errcode = '42501';
  end if;
  if h.niva_id is not null then
    raise exception 'En digital uppgift blir klar när nivån är klarad, inte med en bock.'
      using errcode = '42501';
  end if;
  update public.homework set status = p_status where id = h.id;
  return true;
end $$;

revoke all on function public.barn_uppgift(uuid, text) from public, anon, authenticated;
grant execute on function public.barn_uppgift(uuid, text) to nextrum_barn;

comment on function public.barn_uppgift(uuid, text) is
  'Barnet bockar av en vanlig uppgift från studiehjälparen (nexlax_for_barnet). Bara status, bara barnets egna.';
