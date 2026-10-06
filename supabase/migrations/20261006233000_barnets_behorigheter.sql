-- ============================================================
-- Barnets behörigheter (2026-10-06)
--
-- Leo: "familjen som skapar elev väljer vilka behörigheter barnet ska
-- vara". Föräldern väljer, när barnets inloggning skapas och när som
-- helst efteråt, vad barnet får se och göra i elevvyn:
--
--   pass         sina pass, kommande och genomförda, och timmarna
--   studieplan   studieplanen
--   rapporter    rapporterna från passen (kolumnen visa_rapporter, som
--                fanns sedan barnkonton_och_admin; av som förval)
--   nexlax       NexLäx: nivåerna, läget och bocken på en uppgift
--   meddelanden  Nextrums notiser om passen (barn_notiser)
--   chatt        tråden med studiehjälparen (barn_meddelanden, barnets_chatt)
--
-- Det barnet aldrig får (boka, avboka, svara, priser, betalningar,
-- föräldern) står inte här: det går inte att slå på.
--
-- SPÄRREN LIGGER I DATABASEN, inte i vyn. Barnets roll når inga tabeller
-- (nextrum_barn), bara barnets egna funktioner, och de prövar valet:
--   · barn_oversikt() lämnar inte ut passen, timmarna eller studieplanen
--     som är avstängda (intern.barn_behorigt), och säger vad som är på;
--   · barn_notiser() och barn_markera_last() svarar som för ett pausat
--     barn när meddelandena är av;
--   · barn_nexlax() svarar {lage: 'avstangd'}, och de fem funktioner som
--     släpper in barnet i NexLäx (niva_starta, niva_svara, niva_genomgang,
--     nexlax_lage, barn_uppgift) frågar intern.mitt_nexlax_barn() i
--     stället för intern.mitt_aktiva_barn(), så att ett barn utan NexLäx
--     inte kan spela genom att anropa dem själv;
--   · rapportera_fragefel() (nexlax_felrapporter, som går före den här)
--     tar inte emot en rapport från ett barn utan NexLäx;
--   · barn_chatt(), barn_chatt_last() och barn_chatt_skriv() (barnets_chatt,
--     som går före den här) svarar {lage: 'avstangd'} när tråden är av, och
--     studiehjälparen skriver inte heller i den: barnchatt_skriv() svarar
--     likadant, och barnchatt_tradar() och barnchatt_trad() säger det
--     (avstangd, kan_skriva). Tråden står kvar och går att läsa för
--     studiehjälparen och föräldern;
--   · barn_oversikt():s antal (barnets_chatt) går med passen.
-- Notiserna skapas som förut när meddelandena är av; de lämnas bara inte
-- ut. Mejlen till barnets egen adress följer sitt eget val (barn_epost).
--
-- Valet ändras bara av föräldern: skydda_studentfalt håller kolumnen för
-- alla andra, som visa_rapporter, och en inloggning som tas bort tar
-- valen med sig (nästa inloggning börjar från förvalet). Föräldern läser
-- valen med mina_barns_behorigheter() och sparar dem med
-- barn_behorigheter_satt(): vyn tål att funktionerna saknas (PGRST202),
-- och en lista med en kolumn som inte finns hade fällt barnlistan.
--
-- Barn som redan har en inloggning får allt utom rapporterna, alltså det
-- de hade: förvalet är det som gällde före den här migrationen, också
-- tråden, som Leo ville ha på direkt.
--
-- Körs EFTER barnets_chatt (20261006230000): den skapar funktionerna som
-- lappas här, och hade den körts efter hade den skrivit över lapparna.
-- Första avsnittet stannar därför om den inte är körd.
--
-- Lapparna går på driftens text (pg_get_functiondef) med en vakt som
-- räknar träffarna (CLAUDE.md avsnitt 5), och hoppar över en funktion
-- som redan är lappad (den bär ordet barnets_behorigheter eller
-- mitt_nexlax_barn), så att filen går att köra två gånger. Inga drop.
-- ============================================================

-- ------------------------------------------------------------
-- 0. barnets_chatt först
-- ------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.barn_chatt()') is null then
    raise exception 'Kör barnets_chatt (20261006230000) före barnets_behorigheter.';
  end if;
end $$;


-- ------------------------------------------------------------
-- 1. Kolumnen
-- ------------------------------------------------------------
alter table public.students
  add column if not exists barn_behorigheter text[] not null default '{chatt,meddelanden,nexlax,pass,studieplan}';

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'students_barn_behorigheter_kanda'
                    and conrelid = 'public.students'::regclass) then
    -- Samma lista som intern.barn_behorigheter_alla() utan rapporterna,
    -- som står i visa_rapporter. verktyg/kolla-behorigheter.py jämför dem
    -- med föräldrarnas ruta.
    alter table public.students add constraint students_barn_behorigheter_kanda
      check (barn_behorigheter <@ array['chatt', 'meddelanden', 'nexlax', 'pass', 'studieplan']::text[]);
  end if;
end $$;

comment on column public.students.barn_behorigheter is
  'Vad barnet får se och göra med sin egen inloggning, valt av föräldern (barnets_behorigheter): '
  'pass, studieplan, nexlax, meddelanden, chatt. Rapporterna står i visa_rapporter. Bara föräldern ändrar den.';


-- ------------------------------------------------------------
-- 2. Hjälparna i intern
-- ------------------------------------------------------------
-- Alla behörigheter föräldern kan välja, i den ordning vyn visar dem.
create or replace function intern.barn_behorigheter_alla()
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select array['pass', 'studieplan', 'rapporter', 'nexlax', 'meddelanden', 'chatt']::text[]
$$;

-- Det barnet har, rapporterna medräknade, i bokstavsordning.
create or replace function intern.barnets_behorigheter(s public.students)
returns text[]
language sql
stable
set search_path = public, pg_temp
as $$
  select array(select x
                 from unnest(coalesce(s.barn_behorigheter, '{}'::text[])
                             || case when s.visa_rapporter then array['rapporter'] else '{}'::text[] end) x
                order by x)
$$;

-- barn_oversikt():s svar utan det föräldern stängt av, och med listan.
create or replace function intern.barn_behorigt(b public.students, svar jsonb)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select (svar
          - case when 'pass' = any (b.barn_behorigheter) then '{}'::text[]
                 else array['kommande', 'genomforda', 'timmar', 'antal'] end
          - case when 'studieplan' = any (b.barn_behorigheter) then '{}'::text[]
                 else array['studieplan'] end)
         || jsonb_build_object('behorigheter', to_jsonb(intern.barnets_behorigheter(b)))
$$;

-- Barnets id när den inloggade är ett barnkonto med aktiv inloggning OCH
-- NexLäx påslaget av föräldern, annars null. NexLäx-funktionernas dörr
-- för barnet; intern.mitt_aktiva_barn() är kvar för det som inte är NexLäx.
create or replace function intern.mitt_nexlax_barn()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select b.id from intern.mitt_barn() b where b.barn_aktiv and 'nexlax' = any (b.barn_behorigheter)
$$;

revoke all on function intern.barn_behorigheter_alla() from public, anon, authenticated;
revoke all on function intern.barnets_behorigheter(public.students) from public, anon, authenticated;
revoke all on function intern.barn_behorigt(public.students, jsonb) from public, anon, authenticated;
revoke all on function intern.mitt_nexlax_barn() from public, anon, authenticated;

comment on function intern.mitt_nexlax_barn() is
  'Barnets id när den inloggade är ett barnkonto med aktiv inloggning och NexLäx påslaget, annars null (barnets_behorigheter).';


-- ------------------------------------------------------------
-- 3. Lapparna
--
-- En rad per ändring: funktionen, texten som byts, den nya texten och
-- hur många gånger texten ska stå. Alla ändringar i en funktion görs i
-- samma create or replace: barn_oversikt():s två delar (en parentes som
-- öppnas och en som stängs) hade inte gått att köra var för sig.
-- ------------------------------------------------------------
do $$
declare
  lappar text[][] := array[
    -- barn_oversikt: svaret går genom intern.barn_behorigt.
    array['public.barn_oversikt()',
          $g$  return jsonb_build_object(
    'lage', 'ok',
    'fornamn', intern.fornamn(b.name),$g$,
          $n$  -- barnets_behorigheter: det föräldern stängt av lämnas inte ut.
  return intern.barn_behorigt(b, jsonb_build_object(
    'lage', 'ok',
    'fornamn', intern.fornamn(b.name),$n$, '1'],
    array['public.barn_oversikt()',
          $g$order by r0.lesson_date desc nulls last, r0.created_at desc limit 20) r), '[]'::jsonb) end
  );$g$,
          $n$order by r0.lesson_date desc nulls last, r0.created_at desc limit 20) r), '[]'::jsonb) end
  ));$n$, '1'],
    -- Meddelandena av: som för ett pausat barn.
    array['public.barn_notiser()',
          $g$  if b.id is null or not b.barn_aktiv then$g$,
          $n$  if b.id is null or not b.barn_aktiv
     -- barnets_behorigheter: föräldern har stängt av meddelandena.
     or not ('meddelanden' = any (b.barn_behorigheter)) then$n$, '1'],
    array['public.barn_markera_last(uuid)',
          $g$  if b.id is null or not b.barn_aktiv then$g$,
          $n$  if b.id is null or not b.barn_aktiv
     -- barnets_behorigheter: föräldern har stängt av meddelandena.
     or not ('meddelanden' = any (b.barn_behorigheter)) then$n$, '1'],
    -- NexLäx av: banan lämnas inte ut.
    array['public.barn_nexlax()',
          $g$  if not b.barn_aktiv then
    return jsonb_build_object('lage', 'pausad');
  end if;$g$,
          $n$  if not b.barn_aktiv then
    return jsonb_build_object('lage', 'pausad');
  end if;
  -- barnets_behorigheter: föräldern har stängt av NexLäx.
  if not ('nexlax' = any (b.barn_behorigheter)) then
    return jsonb_build_object('lage', 'avstangd');
  end if;$n$, '1'],
    -- NexLäx av: barnet spelar inte genom att anropa funktionerna själv.
    array['public.niva_starta(uuid, uuid)', 'intern.mitt_aktiva_barn()', 'intern.mitt_nexlax_barn()', '2'],
    array['public.niva_svara(uuid, uuid, jsonb)', 'intern.mitt_aktiva_barn()', 'intern.mitt_nexlax_barn()', '1'],
    array['public.niva_genomgang(uuid)', 'intern.mitt_aktiva_barn()', 'intern.mitt_nexlax_barn()', '1'],
    array['public.nexlax_lage(uuid)', 'intern.mitt_aktiva_barn()', 'intern.mitt_nexlax_barn()', '1'],
    array['public.barn_uppgift(uuid, text)', 'intern.mitt_aktiva_barn()', 'intern.mitt_nexlax_barn()', '1'],
    -- Rapportknappen (nexlax_felrapporter) hör till spelet: utan NexLäx ingen rapport.
    array['public.rapportera_fragefel(uuid, text)',
          $g$  if (intern.mitt_barn()).id is not null then
    v_konto := 'barn';$g$,
          $n$  if (intern.mitt_barn()).id is not null then
    -- barnets_behorigheter: ett barn utan NexLäx spelar inte och rapporterar inte.
    if intern.mitt_nexlax_barn() is null then
      raise exception 'NexLäx är avstängt' using errcode = '42501';
    end if;
    v_konto := 'barn';$n$, '1'],
    -- Tråden av: barnet läser och skriver inte, och studiehjälparen skriver inte.
    array['public.barn_chatt()',
          $g$    return jsonb_build_object('lage', 'saknas');
  end if;
$g$,
          $n$    return jsonb_build_object('lage', 'saknas');
  end if;
  -- barnets_behorigheter: föräldern har stängt av tråden.
  if not exists (select 1 from public.students x where x.id = barn and 'chatt' = any (x.barn_behorigheter)) then
    return jsonb_build_object('lage', 'avstangd');
  end if;
$n$, '1'],
    array['public.barn_chatt_skriv(text)',
          $g$    return jsonb_build_object('lage', 'saknas');
  end if;
$g$,
          $n$    return jsonb_build_object('lage', 'saknas');
  end if;
  -- barnets_behorigheter: föräldern har stängt av tråden.
  if not exists (select 1 from public.students x where x.id = barn and 'chatt' = any (x.barn_behorigheter)) then
    return jsonb_build_object('lage', 'avstangd');
  end if;
$n$, '1'],
    array['public.barn_chatt_last()',
          $g$  if barn is null then
    return 0;
  end if;
$g$,
          $n$  if barn is null then
    return 0;
  end if;
  -- barnets_behorigheter: föräldern har stängt av tråden.
  if not exists (select 1 from public.students x where x.id = barn and 'chatt' = any (x.barn_behorigheter)) then
    return 0;
  end if;
$n$, '1'],
    array['public.barnchatt_skriv(uuid, text)',
          $g$    return jsonb_build_object('lage', 'ingen_inloggning');
  end if;
$g$,
          $n$    return jsonb_build_object('lage', 'ingen_inloggning');
  end if;
  -- barnets_behorigheter: föräldern har stängt av tråden.
  if not ('chatt' = any (s.barn_behorigheter)) then
    return jsonb_build_object('lage', 'avstangd');
  end if;
$n$, '1'],
    array['public.barnchatt_trad(uuid)',
          $g$    'kan_skriva', s.user_id is not null and s.match_status = 'matched',
$g$,
          $n$    'kan_skriva', s.user_id is not null and s.match_status = 'matched' and 'chatt' = any (s.barn_behorigheter),
    -- barnets_behorigheter: föräldern har stängt av tråden.
    'avstangd', not ('chatt' = any (s.barn_behorigheter)),
$n$, '1'],
    array['public.barnchatt_tradar()',
          $g$                   s.user_id is not null and s.match_status = 'matched' as kan_skriva,
$g$,
          $n$                   s.user_id is not null and s.match_status = 'matched'
                     and 'chatt' = any (s.barn_behorigheter) as kan_skriva,
                   -- barnets_behorigheter: föräldern har stängt av tråden.
                   not ('chatt' = any (s.barn_behorigheter)) as avstangd,
$n$, '1'],
    array['public.barnchatt_tradar()',
          $g$             'olasta', x.olasta, 'senaste', x.senaste)$g$,
          $n$             'olasta', x.olasta, 'senaste', x.senaste, 'avstangd', x.avstangd)$n$, '1'],
    -- Bara föräldern ändrar valen, och utan inloggning börjar de om.
    array['public.skydda_studentfalt()',
          $g$      new.visa_rapporter := old.visa_rapporter;$g$,
          $n$      new.visa_rapporter := old.visa_rapporter;
      -- barnets_behorigheter: valen är förälderns, som rapporterna.
      new.barn_behorigheter := old.barn_behorigheter;$n$, '1'],
    array['public.skydda_studentfalt()',
          $g$    new.visa_rapporter            := false;$g$,
          $n$    new.visa_rapporter            := false;
    new.barn_behorigheter         := '{chatt,meddelanden,nexlax,pass,studieplan}';$n$, '1'],
    array['public.skydda_studentfalt_ny()',
          $g$    new.visa_rapporter            := false;$g$,
          $n$    new.visa_rapporter            := false;
    -- barnets_behorigheter: ett nytt barn börjar från förvalet.
    new.barn_behorigheter         := '{chatt,meddelanden,nexlax,pass,studieplan}';$n$, '1']
  ];
  funktioner text[] := array['public.barn_oversikt()', 'public.barn_notiser()', 'public.barn_markera_last(uuid)',
                             'public.barn_nexlax()', 'public.niva_starta(uuid, uuid)',
                             'public.niva_svara(uuid, uuid, jsonb)', 'public.niva_genomgang(uuid)',
                             'public.nexlax_lage(uuid)', 'public.barn_uppgift(uuid, text)',
                             'public.rapportera_fragefel(uuid, text)',
                             'public.barn_chatt()', 'public.barn_chatt_skriv(text)', 'public.barn_chatt_last()',
                             'public.barnchatt_skriv(uuid, text)', 'public.barnchatt_trad(uuid)',
                             'public.barnchatt_tradar()',
                             'public.skydda_studentfalt()', 'public.skydda_studentfalt_ny()'];
  fn     text;
  fore   text;
  ny     text;
  i      integer;
  n      integer;
begin
  foreach fn in array funktioner loop
    fore := pg_get_functiondef(fn::regprocedure);
    if position('barnets_behorigheter' in fore) > 0 or position('mitt_nexlax_barn' in fore) > 0 then
      raise notice '% är redan lappad.', fn;
      continue;
    end if;
    ny := fore;
    for i in 1 .. array_length(lappar, 1) loop
      if lappar[i][1] <> fn then
        continue;
      end if;
      n := (length(ny) - length(replace(ny, lappar[i][2], ''))) / length(lappar[i][2]);
      if n <> lappar[i][4]::integer then
        raise exception '%: texten som ska bytas hittades % gånger, väntat %. Läs driften.', fn, n, lappar[i][4];
      end if;
      ny := replace(ny, lappar[i][2], lappar[i][3]);
    end loop;
    execute ny;
  end loop;
end $$;


-- ------------------------------------------------------------
-- 4. Auditloggen tar valen med
-- ------------------------------------------------------------
create or replace trigger students_barnkonto_audit
  after update on public.students
  for each row execute function public.logga_andring('barnkonto', 'id', 'user_id', 'barn_aktiv', 'visa_rapporter',
                                                     'barn_behorigheter');


-- ------------------------------------------------------------
-- 5. Föräldern läser och sparar
-- ------------------------------------------------------------
-- Valen för den inloggades barn, och listan över alla val. Bara egna barn:
-- auth.uid() är föräldern, aldrig ett argument.
create or replace function public.mina_barns_behorigheter()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'alla', to_jsonb(intern.barn_behorigheter_alla()),
    'barn', coalesce((
      select jsonb_agg(jsonb_build_object('barn_id', s.id,
                                          'behorigheter', to_jsonb(intern.barnets_behorigheter(s)))
                       order by s.created_at, s.id)
        from public.students s
       where s.parent_id = auth.uid() and s.raderad_at is null), '[]'::jsonb))
$$;

-- Föräldern sparar hela listan för ett barn med inloggning. Rapporterna
-- går till visa_rapporter, resten till barn_behorigheter. Svarar med det
-- som gäller efteråt.
create or replace function public.barn_behorigheter_satt(p_barn uuid, p_lista text[])
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s     public.students%rowtype;
  lista text[] := coalesce(p_lista, '{}'::text[]);
  okand text;
begin
  if auth.uid() is null or coalesce(auth.jwt() -> 'app_metadata' ->> 'roll', '') = 'barn' then
    raise exception using errcode = '42501', message = 'Bara föräldern väljer vad barnet får göra.';
  end if;
  select x into okand from unnest(lista) x where not (x = any (intern.barn_behorigheter_alla())) limit 1;
  if found then
    raise exception using errcode = '22023', message = 'Okänd behörighet: ' || coalesce(okand, 'tom');
  end if;
  select * into s from public.students
   where id = p_barn and parent_id = auth.uid() and raderad_at is null
   for update;
  if not found then
    raise exception using errcode = '42501', message = 'Barnet finns inte bland dina barn.';
  end if;
  if s.user_id is null then
    raise exception using errcode = '55000', message = 'Skapa barnets inloggning först.';
  end if;

  update public.students
     set visa_rapporter    = coalesce('rapporter' = any (lista), false),
         barn_behorigheter = array(select distinct x from unnest(lista) x where x <> 'rapporter' order by x)
   where id = s.id;

  return (select jsonb_build_object('barn_id', x.id, 'behorigheter', to_jsonb(intern.barnets_behorigheter(x)))
            from public.students x where x.id = s.id);
end $$;

revoke all on function public.mina_barns_behorigheter() from public, anon;
revoke all on function public.barn_behorigheter_satt(uuid, text[]) from public, anon;
grant execute on function public.mina_barns_behorigheter() to authenticated;
grant execute on function public.barn_behorigheter_satt(uuid, text[]) to authenticated;

comment on function public.mina_barns_behorigheter() is
  'Vad den inloggades barn får se och göra i elevvyn, och alla val (barnets_behorigheter).';
comment on function public.barn_behorigheter_satt(uuid, text[]) is
  'Föräldern sparar vad barnet får se och göra; bara för ett eget barn med inloggning (barnets_behorigheter).';
