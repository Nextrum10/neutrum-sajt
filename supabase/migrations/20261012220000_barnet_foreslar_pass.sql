-- ============================================================
-- Barnet föreslår pass, föräldern skickar vidare (2026-10-12)
--
-- Leo: "barn ska kunna boka pass med läxhjälparen själva, då är
-- processen följande: barn skickar förslag, precis som förälder, men ser
-- inte priset. förälder får förslaget och kan ändra i förslaget, samt
-- ser pris och kan ange rabattkod om det finns. sedan godkänner
-- föräldern förslaget och det går vidare till studiehjälparen som ska
-- godkänna det. men om föräldern skickar förslaget ursprungligen så är
-- det så som det är nu. förälder väljer också i sina inställningar om
-- barnet ska kunna boka pass."
--
-- BARNETS FÖRSLAG ÄR INGET PASS. Det står i en egen tabell,
-- barn_passforslag, tills föräldern skickat det. Ett pass med en ny
-- status ("väntar på föräldern") hade varit en femte status, och
-- klippkort_saldo, timmarnas jobb, krockvillkoret, raderingen och ett
-- trettiotal funktioner räknar på de fyra som finns (kärnan avsnitt 1:
-- inga nya statusar). Ett förslag i bookings hade dessutom upptagit
-- studiehjälparens timme, dragit en köpt timme (klippkort_dra) och
-- mejlat studiehjälparen innan föräldern sagt något.
--
-- FÖRÄLDERN SKICKAR PASSET SOM SITT EGET. skicka_barnets_forslag() är
-- SECURITY INVOKER: passet skrivs med förälderns egen inloggning, genom
-- policyn "förälder skapar bokning" och alla triggrar på bookings, alltså
-- priset (frys_passets_pris), rabattkoden (skydda_rabatt), första timmen
-- och tipstimmen (forsta_timmen_bjuds), timmarna (timmar_betalar_passet),
-- villkoren (pass_kraver_villkor) och notisen till studiehjälparen.
-- Ingen regel för ett pass står två gånger. Förslaget markeras i samma
-- transaktion: går passet inte att skapa står förslaget kvar och väntar.
--
-- BARNET SER INGET PRIS. Barnets roll (nextrum_barn) når fortfarande inga
-- tabeller, bara sina funktioner: barn_foresla_pass(), barn_passforslag(),
-- barn_upptagna_tider() och barn_aterkalla_forslag(). Ingen av dem nämner
-- pris, rabatt, timmar eller betalning.
--
-- FÖRÄLDERN VÄLJER. Behörigheten boka är av som förval och står i en egen
-- kolumn, students.far_boka, som rapporterna står i visa_rapporter: att
-- lägga den i barn_behorigheter hade krävt att villkoret
-- students_barn_behorigheter_kanda togs bort och skrevs om, och verktygen
-- som ändrar driften stannar på varje drop (kärnan avsnitt 5).
-- barn_behorigheter_satt() tar 'boka' i listan som förut, och
-- intern.barnets_behorigheter() lägger tillbaka den i svaret.
--
-- FÖRÄLDERN FÅR VETA. Ett förslag blir en notis av den nya typen
-- barnforslag: en rad i notiser och ett mejl, ett per familj och
-- samlingsfönster, som hoppas över om förslagen hunnit besvaras innan
-- det gick. notis-ko känner typen först när den driftsatts från main,
-- så den driftsätts FÖRE den här migrationen.
--
-- Barnet får ingen notis om förälderns svar: barn_notiser bär ett
-- villkor över typerna, och att skriva om det är också en drop. Barnet ser
-- svaret i sin lista, och när studiehjälparen bekräftar passet får barnet
-- notisen om det som förut (bookings_barnnotis).
--
-- Utan drop och utan delete utanför en funktion (kärnan avsnitt 5):
-- policyerna och triggrarna skapas bakom en kontroll, varje funktion som
-- tar bort rader tar bort på ett ställe, och lapparna hoppar över en
-- funktion som redan är lappad. Filen går att köra två gånger.
-- ============================================================


-- ------------------------------------------------------------
-- 0. Det här bygger på
-- ------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.barn_behorigheter_satt(uuid, text[])') is null then
    raise exception 'Kör barnets_behorigheter (20261006233000) före barnet_foreslar_pass.';
  end if;
  if to_regprocedure('intern.villkoren_godkanda(uuid)') is null then
    raise exception 'Kör villkoren_godkanns (20261007120000) före barnet_foreslar_pass.';
  end if;
end $$;


-- ------------------------------------------------------------
-- 1. Föräldern väljer om barnet får föreslå pass
-- ------------------------------------------------------------
alter table public.students
  add column if not exists far_boka boolean not null default false;

comment on column public.students.far_boka is
  'Barnet får föreslå pass i sin vy, som föräldern sedan skickar vidare (barnet_foreslar_pass, 2026-10-12). '
  'Behörigheten boka i barn_behorigheter_satt(); av som förval, och bara föräldern ändrar den.';

-- Alla behörigheter föräldern kan välja, i den ordning vyn visar dem.
-- verktyg/kolla-behorigheter.py jämför listan med vyerna.
create or replace function intern.barn_behorigheter_alla()
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select array['pass', 'boka', 'studieplan', 'rapporter', 'nexlax', 'meddelanden', 'chatt']::text[]
$$;


-- ------------------------------------------------------------
-- 2. Lapparna: valet sparas, läses, skyddas och följer med i loggen
--
-- På driftens text (pg_get_functiondef), med en vakt som räknar
-- träffarna (kärnan avsnitt 5). En funktion som redan bär far_boka är
-- lappad och hoppas över.
-- ------------------------------------------------------------
do $$
declare
  lappar text[][] := array[
    -- Det barnet har, boka medräknad, som rapporterna.
    array['intern.barnets_behorigheter(public.students)',
          $g$case when s.visa_rapporter then array['rapporter'] else '{}'::text[] end)$g$,
          $n$case when s.visa_rapporter then array['rapporter'] else '{}'::text[] end
                             -- barnet_foreslar_pass: boka står i far_boka.
                             || case when s.far_boka then array['boka'] else '{}'::text[] end)$n$, '1'],
    -- Föräldern sparar boka i sin kolumn.
    array['public.barn_behorigheter_satt(uuid, text[])',
          $g$     set visa_rapporter    = coalesce('rapporter' = any (lista), false),$g$,
          $n$     set visa_rapporter    = coalesce('rapporter' = any (lista), false),
         -- barnet_foreslar_pass: boka står i far_boka, som rapporterna i visa_rapporter.
         far_boka          = coalesce('boka' = any (lista), false),$n$, '1'],
    array['public.barn_behorigheter_satt(uuid, text[])',
          $g$where x <> 'rapporter' order by x$g$,
          $n$where x not in ('rapporter', 'boka') order by x$n$, '1'],
    -- Bara föräldern ändrar valet, och utan inloggning börjar det om.
    array['public.skydda_studentfalt()',
          $g$      new.barn_behorigheter := old.barn_behorigheter;$g$,
          $n$      new.barn_behorigheter := old.barn_behorigheter;
      -- barnet_foreslar_pass: att barnet föreslår pass är förälderns val.
      new.far_boka := old.far_boka;$n$, '1'],
    array['public.skydda_studentfalt()',
          $g$    new.barn_behorigheter         := '{chatt,meddelanden,nexlax,pass,studieplan}';$g$,
          $n$    new.barn_behorigheter         := '{chatt,meddelanden,nexlax,pass,studieplan}';
    new.far_boka                  := false;$n$, '1'],
    array['public.skydda_studentfalt_ny()',
          $g$    new.barn_behorigheter         := '{chatt,meddelanden,nexlax,pass,studieplan}';$g$,
          $n$    new.barn_behorigheter         := '{chatt,meddelanden,nexlax,pass,studieplan}';
    -- barnet_foreslar_pass: ett nytt barn föreslår inga pass.
    new.far_boka                  := false;$n$, '1']
  ];
  funktioner text[] := array['intern.barnets_behorigheter(public.students)',
                             'public.barn_behorigheter_satt(uuid, text[])',
                             'public.skydda_studentfalt()', 'public.skydda_studentfalt_ny()'];
  fn   text;
  fore text;
  ny   text;
  i    integer;
  n    integer;
begin
  foreach fn in array funktioner loop
    fore := pg_get_functiondef(fn::regprocedure);
    if position('far_boka' in fore) > 0 then
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

-- Valet står i auditloggen med föräldern som aktör, som de andra.
create or replace trigger students_barnkonto_audit
  after update on public.students
  for each row execute function public.logga_andring('barnkonto', 'id', 'user_id', 'barn_aktiv', 'visa_rapporter',
                                                     'barn_behorigheter', 'far_boka');


-- ------------------------------------------------------------
-- 3. Förslagen
--
-- En rad per förslag. Barnet skriver bara genom barn_foresla_pass(), och
-- läget ändras bara av funktionerna: föräldern skickar (skickat, med
-- passet i pass_id) eller låter bli (nej), och barnet kan ta tillbaka ett
-- som väntar (aterkallat). Raden tas aldrig bort av en vy; gallringen
-- (avsnitt 8) och raderingen (avsnitt 9) gör det.
--
-- Kolumnerna är passets, med svenska namn: dag, starttid, längd, ämne,
-- var man ses och en rad till studiehjälparen. Ingen kolumn för pris,
-- antal barn eller rabattkod: det väljer föräldern när förslaget skickas.
-- ------------------------------------------------------------
create table if not exists public.barn_passforslag (
  id         uuid primary key default gen_random_uuid(),
  barn_id    uuid not null references public.students (id) on delete cascade,
  parent_id  uuid not null references public.profiles (id) on delete cascade,
  tutor_id   uuid references public.profiles (id) on delete set null,
  datum      date not null,
  tid        text not null check (tid ~ '^([01][0-9]|2[0-3]):00$'),
  langd_min  integer not null check (langd_min in (60, 120, 180)),
  amne       text not null check (char_length(btrim(amne)) between 1 and 60),
  format     text not null check (format in ('Online', 'På plats')),
  plats      text check (char_length(plats) <= 160),
  rad        text check (char_length(rad) <= 300),
  lage       text not null default 'vantar' check (lage in ('vantar', 'skickat', 'nej', 'aterkallat')),
  pass_id    uuid references public.bookings (id) on delete set null,
  skapad     timestamptz not null default now(),
  besvarad   timestamptz,
  constraint barn_passforslag_besvarad check ((lage = 'vantar') = (besvarad is null)),
  constraint barn_passforslag_plats check (format <> 'På plats' or char_length(btrim(coalesce(plats, ''))) >= 3)
);

comment on table public.barn_passforslag is
  'Pass som ett barn föreslagit i sin vy och som väntar på föräldern (barnet_foreslar_pass, 2026-10-12). '
  'Blir ett pass först när föräldern skickar det med skicka_barnets_forslag(). Barnet skriver bara genom '
  'barn_foresla_pass(); föräldern läser sina barns förslag. Gallras 30 dagar efter svaret eller dagen.';
comment on column public.barn_passforslag.tutor_id is
  'Barnets studiehjälpare när förslaget skrevs. Passet går till den studiehjälpare barnet har när föräldern skickar.';
comment on column public.barn_passforslag.pass_id is
  'Passet föräldern skapade när förslaget skickades. Föräldern kan ha ändrat tid, längd och plats.';

create index if not exists barn_passforslag_barn_idx on public.barn_passforslag (barn_id, skapad desc);
create index if not exists barn_passforslag_vantar_idx on public.barn_passforslag (parent_id) where lage = 'vantar';

alter table public.barn_passforslag enable row level security;

-- Supabase ger anon och authenticated rättigheter på varje ny tabell.
-- RLS stoppar dem, men ingen ska skriva här annat än genom funktionerna,
-- och anon ska inte ens kunna läsa. Barnets roll får ingenting.
revoke all on public.barn_passforslag from anon, nextrum_barn;
revoke insert, update, delete, truncate, references, trigger on public.barn_passforslag from authenticated;
grant select on public.barn_passforslag to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'barn_passforslag'
                    and policyname = 'föräldern läser barnens förslag') then
    create policy "föräldern läser barnens förslag" on public.barn_passforslag
      for select to authenticated
      using (parent_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'barn_passforslag'
                    and policyname = 'admin läser barnens förslag') then
    create policy "admin läser barnens förslag" on public.barn_passforslag
      for select to authenticated
      using (public.is_admin() or public.har_behorighet('bokningar_las'));
  end if;
end $$;


-- ------------------------------------------------------------
-- 4. Hjälparna i intern
-- ------------------------------------------------------------
-- Barnets studiehjälpare när förslaget kan skickas: matchad, inte pausad,
-- och ingen av dem raderad. Samma relation som barnets tråd skriver i
-- (intern.barnchatt_hjalpare), utan den vilande.
create or replace function intern.barnforslag_hjalpare(p_barn uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.matched_tutor_id
    from public.students s
    join public.profiles p on p.id = s.matched_tutor_id
   where s.id = p_barn
     and s.raderad_at is null
     and p.raderad_at is null
     and s.match_status = 'matched'
$$;

-- Förslagets mejl till föräldern hoppas över när inget av familjens
-- förslag väntar längre: föräldern har redan svarat i vyn, eller barnet
-- tagit tillbaka dem, innan samlingsfönstret gick ut.
create or replace function intern.barnforslag_post_hoppas(p_parent uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notis_utskick q
     set status = 'hoppad', fel = 'förslagen är redan besvarade', uppdaterad = now()
   where q.samlingsnyckel = 'barnforslag:' || p_parent::text
     and q.status = 'vantar'
     and not exists (select 1 from public.barn_passforslag f
                      where f.parent_id = p_parent and f.lage = 'vantar')
$$;

-- Förslaget föräldern ska skicka, låst för resten av transaktionen. Bara
-- förälderns eget barns förslag, och bara ett som väntar. Ett barnkonto
-- skickar inget, och funktionen svarar aldrig om någon annans förslag.
create or replace function intern.barnforslag_las(p_id uuid)
returns public.barn_passforslag
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  f public.barn_passforslag;
begin
  if auth.uid() is null or coalesce(auth.jwt() -> 'app_metadata' ->> 'roll', '') = 'barn' then
    raise exception using errcode = '42501', message = 'Bara föräldern skickar barnets förslag.';
  end if;
  select * into f from public.barn_passforslag x where x.id = p_id and x.parent_id = auth.uid() for update;
  if not found then
    raise exception using errcode = '42501', message = 'Förslaget finns inte bland era barns förslag.';
  end if;
  if f.lage <> 'vantar' then
    raise exception using errcode = 'P0001', hint = 'barnforslag',
      message = case f.lage
        when 'aterkallat' then 'Barnet har tagit tillbaka förslaget.'
        when 'skickat' then 'Förslaget är redan skickat till studiehjälparen.'
        else 'Ni har redan svarat på förslaget.' end;
  end if;
  return f;
end $$;

-- Förslaget blir skickat, med passet föräldern just skapat. Passet ska
-- vara förälderns eget förslag om samma barn, skapat i samma transaktion
-- (created_at är transaktionens tid), så att ett gammalt pass inte kan
-- märkas som barnets förslag.
create or replace function intern.barnforslag_skickat(p_id uuid, p_pass uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  jag uuid := auth.uid();
begin
  update public.barn_passforslag f
     set lage = 'skickat', pass_id = p_pass, besvarad = now()
   where f.id = p_id and f.parent_id = jag and f.lage = 'vantar'
     and exists (select 1 from public.bookings b
                  where b.id = p_pass and b.parent_id = jag and b.created_by = jag
                    and b.student_id = f.barn_id and b.status = 'requested' and b.created_at = now());
  if not found then
    raise exception using errcode = '42501', message = 'Förslaget och passet hör inte ihop.';
  end if;
  perform intern.barnforslag_post_hoppas(jag);
end $$;

revoke all on function intern.barnforslag_post_hoppas(uuid) from public, anon, authenticated;
-- De tre nedan anropas av skicka_barnets_forslag(), som körs som föräldern
-- själv (SECURITY INVOKER), och behöver därför EXECUTE för authenticated.
-- Schemat intern är inget API (kärnan avsnitt 5), så de nås bara genom
-- den funktionen. barnforslag_las och barnforslag_skickat prövar att den
-- inloggade är förslagets förälder; barnforslag_hjalpare får bara ett
-- barn som barnforslag_las redan släppt fram.
revoke all on function intern.barnforslag_hjalpare(uuid) from public, anon;
revoke all on function intern.barnforslag_las(uuid) from public, anon;
revoke all on function intern.barnforslag_skickat(uuid, uuid) from public, anon;
grant execute on function intern.barnforslag_hjalpare(uuid) to authenticated;
grant execute on function intern.barnforslag_las(uuid) to authenticated;
grant execute on function intern.barnforslag_skickat(uuid, uuid) to authenticated;


-- ------------------------------------------------------------
-- 5. Barnets funktioner
-- ------------------------------------------------------------
-- Ett förslag. Svaret är ett läge, aldrig ett fel som säger något om
-- någon annan:
--   ok          sparat; föräldern får en notis
--   saknas      ingen aktiv inloggning
--   avstangd    föräldern har inte slagit på boka
--   ingen       barnet har ingen studiehjälpare just nu
--   ogiltigt    något av fälten (falt säger vilket)
--   tak         fem förslag väntar redan, eller tio på ett dygn
-- Tiderna prövas som vyn erbjuder dem: hela timmar, idag minst en timme
-- fram och högst tre månader bort. Vilka klockslag på dagen som går står
-- bara i vyn, som för familjens förslag (kärnan avsnitt 1); föräldern ser
-- förslaget innan det går någonstans.
create or replace function public.barn_foresla_pass(p_datum date, p_tid text, p_langd integer, p_amne text,
                                                   p_format text, p_plats text, p_rad text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  barn  uuid := intern.mitt_aktiva_barn();
  s     public.students%rowtype;
  hj    uuid;
  idag  date := (now() at time zone 'Europe/Stockholm')::date;
  amne  text := btrim(regexp_replace(coalesce(p_amne, ''), '\s+', ' ', 'g'));
  plats text := nullif(btrim(coalesce(p_plats, '')), '');
  rad   text := nullif(btrim(coalesce(p_rad, '')), '');
  ny    uuid;
begin
  if barn is null then
    return jsonb_build_object('lage', 'saknas');
  end if;
  select * into s from public.students x where x.id = barn;
  if not s.far_boka then
    return jsonb_build_object('lage', 'avstangd');
  end if;
  hj := intern.barnforslag_hjalpare(barn);
  if hj is null then
    return jsonb_build_object('lage', 'ingen');
  end if;

  if p_datum is null or p_datum < idag
     or p_datum > (date_trunc('month', idag) + interval '3 months')::date - 1 then
    return jsonb_build_object('lage', 'ogiltigt', 'falt', 'datum');
  end if;
  if p_tid is null or p_tid !~ '^([01][0-9]|2[0-3]):00$'
     or (p_datum + p_tid::time) at time zone 'Europe/Stockholm' < now() + interval '1 hour' then
    return jsonb_build_object('lage', 'ogiltigt', 'falt', 'tid');
  end if;
  if p_langd is null or p_langd not in (60, 120, 180)
     or split_part(p_tid, ':', 1)::integer + p_langd / 60 > 24 then
    return jsonb_build_object('lage', 'ogiltigt', 'falt', 'langd');
  end if;
  if char_length(amne) not between 1 and 60 or amne !~ '[[:alpha:]]' then
    return jsonb_build_object('lage', 'ogiltigt', 'falt', 'amne');
  end if;
  if p_format is null or p_format not in ('Online', 'På plats') then
    return jsonb_build_object('lage', 'ogiltigt', 'falt', 'format');
  end if;
  if p_format = 'Online' then
    plats := null;
  elsif plats is null or char_length(plats) < 3 or char_length(plats) > 160 then
    return jsonb_build_object('lage', 'ogiltigt', 'falt', 'plats');
  end if;
  if char_length(coalesce(rad, '')) > 300 then
    return jsonb_build_object('lage', 'ogiltigt', 'falt', 'rad');
  end if;

  -- Taket, med ett lås per barn så att två tryck samtidigt inte blir sex.
  perform pg_advisory_xact_lock(hashtextextended('barnforslag:' || barn::text, 0));
  if (select count(*) from public.barn_passforslag f where f.barn_id = barn and f.lage = 'vantar') >= 5
     or (select count(*) from public.barn_passforslag f
          where f.barn_id = barn and f.skapad > now() - interval '24 hours') >= 10 then
    return jsonb_build_object('lage', 'tak');
  end if;

  insert into public.barn_passforslag (barn_id, parent_id, tutor_id, datum, tid, langd_min, amne, format, plats, rad)
  values (barn, s.parent_id, hj, p_datum, p_tid, p_langd, amne, p_format, plats, rad)
  returning id into ny;

  -- Notisen till föräldern stoppar aldrig förslaget, samma regel som
  -- notis_vid_pass: ett fel blir en rad i notis_fel. Mejlet bär barnets
  -- förnamn, dagen, tiden och ämnet, aldrig platsen eller raden.
  begin
    perform intern.notis_skapa(s.parent_id, 'barnforslag', null, barn, null, null,
      jsonb_strip_nulls(jsonb_build_object('elev', intern.fornamn(s.name), 'datum', p_datum,
                                           'tid', p_tid, 'amne', amne)));
  exception when others then
    insert into public.notis_fel (kalla, fel) values ('barn_foresla_pass ' || ny::text, left(sqlerrm, 500));
  end;

  return jsonb_build_object('lage', 'ok', 'id', ny);
end $$;

-- Barnets förslag: de som väntar, och de som besvarats de senaste 14
-- dagarna. Ett skickat förslag bär passets läge och tid bara när barnet
-- får se sina pass (barnets_behorigheter): föräldern kan ha ändrat tiden,
-- och passet är ett pass. Inget pris, ingen rabatt, inga timmar.
create or replace function public.barn_passforslag()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  b  public.students%rowtype;
  hj uuid;
begin
  b := intern.mitt_barn();
  if b.id is null then
    return jsonb_build_object('lage', 'saknas');
  end if;
  if not b.barn_aktiv then
    return jsonb_build_object('lage', 'pausad');
  end if;
  if not b.far_boka then
    return jsonb_build_object('lage', 'avstangd');
  end if;
  hj := intern.barnforslag_hjalpare(b.id);
  return jsonb_build_object(
    'lage', 'ok',
    'studiehjalpare', (select intern.fornamn(p.full_name) from public.profiles p where p.id = hj),
    'kan_foresla', hj is not null,
    'far_se_passen', 'pass' = any (b.barn_behorigheter),
    'forslag', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', f.id, 'datum', f.datum, 'tid', f.tid, 'langd_min', f.langd_min, 'amne', f.amne,
               'format', f.format, 'lage', f.lage, 'skapad', f.skapad, 'besvarad', f.besvarad,
               'pass', case when f.pass_id is not null and 'pass' = any (b.barn_behorigheter) then (
                         select jsonb_build_object('status', x.status, 'datum', x.wanted_date,
                                                   'tid', left(x.wanted_time, 5), 'langd_min', x.duration_min)
                           from public.bookings x where x.id = f.pass_id) end)
             order by f.skapad desc)
        from (select * from public.barn_passforslag f0
               where f0.barn_id = b.id
                 and (f0.lage = 'vantar' or f0.besvarad > now() - interval '14 days')
               order by f0.skapad desc
               limit 20) f), '[]'::jsonb));
end $$;

-- De upptagna timmarna hos barnets studiehjälpare, som upptagna_tider()
-- ger föräldern: att timmen är tagen, aldrig av vem. Bara för ett barn
-- som får föreslå pass och har en studiehjälpare; annars ingenting.
create or replace function public.barn_upptagna_tider(p_fran date, p_till date)
returns table (datum date, tid text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  b  public.students%rowtype;
  hj uuid;
begin
  b := intern.mitt_barn();
  if b.id is null or not b.barn_aktiv or not b.far_boka then
    return;
  end if;
  hj := intern.barnforslag_hjalpare(b.id);
  if hj is null then
    return;
  end if;
  if p_fran is null or p_till is null or p_till < p_fran or p_till - p_fran > 200 then
    raise exception using errcode = '22023', message = 'Välj högst ett halvår i taget.';
  end if;

  return query
    select distinct x.wanted_date,
           lpad((split_part(x.wanted_time, ':', 1)::int + h)::text, 2, '0') || ':00'
      from public.bookings x
     cross join lateral generate_series(0, greatest(1, ceil(x.duration_min / 60.0)::int) - 1) as h
     where x.tutor_id = hj
       and x.status in ('requested', 'confirmed')
       and x.wanted_date between p_fran and p_till
       and x.wanted_time ~ '^[0-9]{1,2}:[0-9]{2}'
     order by 1, 2;
end $$;

-- Barnet tar tillbaka ett förslag som fortfarande väntar.
create or replace function public.barn_aterkalla_forslag(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  barn uuid := intern.mitt_aktiva_barn();
  fp   uuid;
begin
  if barn is null then
    return jsonb_build_object('lage', 'saknas');
  end if;
  update public.barn_passforslag f
     set lage = 'aterkallat', besvarad = now()
   where f.id = p_id and f.barn_id = barn and f.lage = 'vantar'
  returning f.parent_id into fp;
  if fp is null then
    return jsonb_build_object('lage', 'redan');
  end if;
  perform intern.barnforslag_post_hoppas(fp);
  return jsonb_build_object('lage', 'ok');
end $$;


-- ------------------------------------------------------------
-- 6. Förälderns funktioner
-- ------------------------------------------------------------
-- Föräldern skickar inte förslaget. Barnet ser svaret i sin lista.
create or replace function public.barnforslag_neka(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  jag uuid := auth.uid();
begin
  if jag is null or coalesce(auth.jwt() -> 'app_metadata' ->> 'roll', '') = 'barn' then
    raise exception using errcode = '42501', message = 'Bara föräldern svarar på barnets förslag.';
  end if;
  update public.barn_passforslag f
     set lage = 'nej', besvarad = now()
   where f.id = p_id and f.parent_id = jag and f.lage = 'vantar';
  if not found then
    if exists (select 1 from public.barn_passforslag f where f.id = p_id and f.parent_id = jag) then
      return jsonb_build_object('lage', 'redan');
    end if;
    raise exception using errcode = '42501', message = 'Förslaget finns inte bland era barns förslag.';
  end if;
  perform intern.barnforslag_post_hoppas(jag);
  return jsonb_build_object('lage', 'ok');
end $$;

-- Föräldern skickar förslaget, så som föräldern ändrat det, till barnets
-- studiehjälpare. SECURITY INVOKER: passet skrivs som förälderns eget
-- förslag, genom samma policy och samma triggrar som när föräldern bokar
-- själv, och ett fel där (en krock, villkoren, en tjänst som inte går att
-- boka) rullar tillbaka allt, också förslagets läge. p_pass bär
-- förälderns val: datum, tid, minuter, amne, tjanst, barn (antal),
-- format, plats, not och rabattkod. Barnet, föräldern och studiehjälparen
-- tas aldrig ur anropet.
--
-- Svaret är det vyn behöver för kvittot: passets id och läge, och vad
-- databasen gjorde med priset (timmarna, rabattkoden, första timmen).
create or replace function public.skicka_barnets_forslag(p_id uuid, p_pass jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  f  public.barn_passforslag;
  hj uuid;
  ny public.bookings;
begin
  f := intern.barnforslag_las(p_id);
  hj := intern.barnforslag_hjalpare(f.barn_id);
  if hj is null then
    raise exception using errcode = 'P0001', hint = 'barnforslag',
      message = 'Barnet har ingen studiehjälpare just nu, så förslaget kan inte skickas.';
  end if;

  insert into public.bookings (parent_id, tutor_id, student_id, created_by, subject, tjanst, antal_barn,
                               wanted_date, wanted_time, duration_min, format, location, note, status, rabattkod)
  values (auth.uid(), hj, f.barn_id, auth.uid(),
          nullif(btrim(coalesce(p_pass ->> 'amne', '')), ''),
          coalesce(nullif(btrim(coalesce(p_pass ->> 'tjanst', '')), ''), 'laxhjalp'),
          coalesce((p_pass ->> 'barn')::integer, 1),
          (p_pass ->> 'datum')::date,
          nullif(btrim(coalesce(p_pass ->> 'tid', '')), ''),
          (p_pass ->> 'minuter')::integer,
          nullif(p_pass ->> 'format', ''),
          nullif(btrim(coalesce(p_pass ->> 'plats', '')), ''),
          nullif(btrim(coalesce(p_pass ->> 'not', '')), ''),
          'requested',
          nullif(upper(btrim(coalesce(p_pass ->> 'rabattkod', ''))), ''))
  returning * into ny;

  perform intern.barnforslag_skickat(p_id, ny.id);

  return jsonb_build_object('id', ny.id, 'status', ny.status, 'klippkort_id', ny.klippkort_id,
                            'betalning_status', ny.betalning_status, 'rabattkod', ny.rabattkod,
                            'rabatt_ore', ny.rabatt_ore, 'startrabatt', ny.startrabatt);
end $$;


-- ------------------------------------------------------------
-- 7. Notisen till föräldern
--
-- Typen barnforslag i båda listorna, och i _delad/notiser/typer.ts i
-- samma ändring. notis_skapa köar mejl bara för pass och meddelanden;
-- ett förslag har inget pass än, så det får en egen gren, med en
-- samlingsnyckel per familj: två förslag på en gång blir ett mejl.
-- ------------------------------------------------------------
create or replace function public.notis_typer()
returns text[]
language sql
immutable
set search_path to 'public'
as $$
  select array['pass_nytt', 'pass_bekraftat', 'pass_flyttat', 'pass_avbokat', 'pass_avbojt',
               'meddelande', 'rapport', 'paminnelse', 'timmar_gar_ut', 'barnforslag']
$$;

create or replace function public.notis_mejlbara()
returns text[]
language sql
immutable
set search_path to 'public'
as $$
  select array['pass_nytt', 'pass_bekraftat', 'pass_flyttat', 'pass_avbokat', 'pass_avbojt',
               'meddelande', 'paminnelse', 'timmar_gar_ut', 'barnforslag']
$$;

do $lapp$
declare
  fore    text := pg_get_functiondef('intern.notis_skapa(uuid, text, uuid, uuid, uuid, uuid, jsonb)'::regprocedure);
  ankare  text := $a$  elsif p_pass is not null then
$a$;
  tillagg text := $n$  -- barnet_foreslar_pass: ett förslag har inget pass än. Ett mejl per
  -- familj och samlingsfönster; det hoppas över om förslagen hunnit
  -- besvaras (intern.barnforslag_post_hoppas).
  elsif p_typ = 'barnforslag' then
    perform intern.notis_koa(p_mottagare, 'mejl', p_typ, null, null, null,
      coalesce(p_data, '{}'::jsonb),
      'barnforslag:' || p_mottagare,
      p_typ || ':' || p_mottagare || ':' || gen_random_uuid(),
      now() + make_interval(mins => coalesce(inst.pass_samla_minuter, 3)), null);
$n$;
  traffar integer;
begin
  if position('barnforslag' in fore) > 0 then
    raise notice 'notis_skapa köar redan barnens förslag.';
    return;
  end if;
  traffar := (length(fore) - length(replace(fore, ankare, ''))) / length(ankare);
  if traffar <> 1 then
    raise exception 'notis_skapa: ankaret står % gånger, inte en. Läs driften.', traffar;
  end if;
  execute replace(fore, ankare, tillagg || ankare);
end $lapp$;


-- ------------------------------------------------------------
-- 8. Gallringen
--
-- Ett förslag behövs bara tills det är besvarat: ett skickat är ett pass,
-- och det är passet som sparas. 30 dagar efter svaret, eller 30 dagar
-- efter dagen för ett som aldrig besvarades, tas raden bort.
-- ------------------------------------------------------------
create or replace function intern.barnforslag_gallra()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  antal integer;
begin
  delete from public.barn_passforslag f
   where (f.lage <> 'vantar' and f.besvarad < now() - interval '30 days')
      or (f.lage = 'vantar' and f.datum < (now() at time zone 'Europe/Stockholm')::date - 30);
  get diagnostics antal = row_count;
  return antal;
end $$;

revoke all on function intern.barnforslag_gallra() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'barnforslag-gallring';
select cron.schedule('barnforslag-gallring', '38 3 * * *', $$select intern.barnforslag_gallra()$$);


-- ------------------------------------------------------------
-- 9. Raderingen
--
-- radera_person() sätter raderad_at först, både när personen tas bort
-- helt och när den avidentifieras. Förslagen bär en plats och en rad som
-- barnet skrivit, så de går i samma transaktion: barnets med barnet, och
-- familjens med familjen. En rensning per funktion. En hel radering tar
-- dem också genom de främmande nycklarna.
-- ------------------------------------------------------------
create or replace function intern.barnforslag_elev_raderad()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.barn_passforslag where barn_id = new.id;
  return null;
end $$;

create or replace function intern.barnforslag_familj_raderad()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.barn_passforslag where parent_id = new.id;
  return null;
end $$;

revoke all on function intern.barnforslag_elev_raderad() from public, anon, authenticated;
revoke all on function intern.barnforslag_familj_raderad() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger
                  where tgname = 'students_barnforslag_raderas' and tgrelid = 'public.students'::regclass) then
    create trigger students_barnforslag_raderas after update of raderad_at on public.students
      for each row when (old.raderad_at is null and new.raderad_at is not null)
      execute function intern.barnforslag_elev_raderad();
  end if;
  if not exists (select 1 from pg_trigger
                  where tgname = 'profiles_barnforslag_raderas' and tgrelid = 'public.profiles'::regclass) then
    create trigger profiles_barnforslag_raderas after update of raderad_at on public.profiles
      for each row when (old.raderad_at is null and new.raderad_at is not null)
      execute function intern.barnforslag_familj_raderad();
  end if;
end $$;


-- ------------------------------------------------------------
-- 10. Rättigheterna
--
-- Supabase ger varje ny funktion EXECUTE till alla. Barnets fyra går
-- bara till barnets roll; förälderns två till authenticated, och de
-- prövar själva att det är förslagets förälder.
-- ------------------------------------------------------------
revoke execute on function public.barn_foresla_pass(date, text, integer, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.barn_passforslag() from public, anon, authenticated;
revoke execute on function public.barn_upptagna_tider(date, date) from public, anon, authenticated;
revoke execute on function public.barn_aterkalla_forslag(uuid) from public, anon, authenticated;
grant execute on function public.barn_foresla_pass(date, text, integer, text, text, text, text) to nextrum_barn;
grant execute on function public.barn_passforslag() to nextrum_barn;
grant execute on function public.barn_upptagna_tider(date, date) to nextrum_barn;
grant execute on function public.barn_aterkalla_forslag(uuid) to nextrum_barn;

revoke execute on function public.barnforslag_neka(uuid) from public, anon, nextrum_barn;
revoke execute on function public.skicka_barnets_forslag(uuid, jsonb) from public, anon, nextrum_barn;
grant execute on function public.barnforslag_neka(uuid) to authenticated;
grant execute on function public.skicka_barnets_forslag(uuid, jsonb) to authenticated;
