-- ============================================================
-- NEXTRUM — behörighetstester (Fas 1, 2, 5, 6, 7, 8 och 9)
--
-- Kör hela filen som ETT anrop i Supabase SQL Editor (eller via
-- execute_sql). Allt sker i en transaktion som rullas tillbaka på
-- sista raden: fixturerna — två studiehjälpare, två familjer, tre
-- barn, pass och en admin — finns bara medan testerna körs.
--
-- Varje test körs dessutom i en egen deltransaktion som alltid
-- rullas tillbaka, så att ett test aldrig ser ett annat tests
-- ändringar. Rollen och inloggningen (request.jwt.claims) sätts
-- per test, precis som PostgREST gör det.
--
-- Notistriggrarna på bookings, leads, messages och lesson_reports
-- stängs av under körningen, så att fixturpassen och provanmälningarna
-- aldrig kan bli ett mejl. Även de ändringarna rullas tillbaka.
-- Triggrarna slås upp på sin funktion, inte på sitt namn — se
-- kommentaren vid do-blocket nedan om varför.
--
-- OBS vid körning mot skarp drift: att stänga av en trigger tar
-- ACCESS EXCLUSIVE-lås på tabellen, och låset hålls tills
-- transaktionen rullat tillbaka. Under körningen väntar alltså varje
-- besökare som skickar intresseanmälan på nextrum.se. Kör sviten när
-- formuläret är lugnt, eller mot en gren.
--
-- Svaret är en tabell: test, ok, detalj. Varje rad ska vara ok.
--
-- Förutsättning: migrationerna för Fas 1.1–1.6, Fas 2.1–2.3,
-- Fas 5.1–5.6, Fas 6.1–6.2, Fas 7, Fas 8, Fas 9.1–9.4,
-- Fas 14.2–14.6 och Fas 15.1–15.4 är körda.
-- Körs filen före dem är det väntat att de berörda raderna faller —
-- det är så man ser att testerna faktiskt mäter något.
-- ============================================================

begin;

-- Notistriggrarna stängs av, så att fixturpassen och provanmälningarna
-- aldrig kan bli ett mejl. Också de ändringarna rullas tillbaka.
--
-- NAMNEN SLÅS UPP, DE STÅR INTE SKRIVNA HÄR. Raderna löd förut
--
--   alter table public.bookings disable trigger "nytt-passforslag";
--
-- och den triggern finns inte längre: Runda 2 bytte webhooken mot
-- kötriggern bookings_notis, och messages och lesson_reports fick
-- sina egna. Hela sviten kraschade då på den första satsen efter
-- begin, med 42704, innan ett enda test hunnit köras — och en svit
-- som inte går att köra provar ingenting.
--
-- Uppslaget går på FUNKTIONEN, inte på triggerns namn. Ett namn är
-- godtyckligt och byts när något skrivs om; funktionen säger vad
-- triggern faktiskt gör.
do $$
declare t record;
begin
  for t in
    select c.relname as tabell, tg.tgname as namn
      from pg_trigger tg
      join pg_class c on c.oid = tg.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_proc p on p.oid = tg.tgfoid
     where not tg.tgisinternal
       and n.nspname = 'public'
       and c.relname in ('bookings', 'leads', 'messages', 'lesson_reports')
       and (p.proname = 'http_request' or p.proname like 'notis%')
  loop
    execute format('alter table public.%I disable trigger %I', t.tabell, t.namn);
  end loop;
end $$;

create temp table utfall (
  nr     serial,
  test   text,
  ok     boolean,
  detalj text
) on commit drop;

-- ------------------------------------------------------------
-- hjälpare
-- ------------------------------------------------------------

-- Bli en viss användare, eller anon med null.
create function pg_temp.bli(uid uuid) returns void
language plpgsql as $$
begin
  if uid is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
  else
    perform set_config('request.jwt.claims',
      json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
  end if;
end $$;

-- Kör en eller flera satser som uid. ska = 'ok' kräver att sista
-- satsen påverkade minst en rad. ska = 'nekad' kräver behörighetsfel
-- (42501, som både RLS och skydda_bokningsfalt ger) ELLER noll rader
-- (RLS nekar en uppdatering tyst genom att inte träffa något). Ett
-- annat fel — ett stavfel i testet, en saknad kolumn — räknas INTE
-- som nekad, annars kunde ett trasigt test se grönt ut.
create function pg_temp.prova(p_test text, p_uid uuid, p_sql text[], p_ska text)
returns void language plpgsql as $$
declare
  n    bigint := 0;
  fel  text;
  kod  text;
  s    text;
begin
  begin
    perform pg_temp.bli(p_uid);
    foreach s in array p_sql loop
      execute s;
      get diagnostics n = row_count;
    end loop;
    raise exception 'PROVA_KLAR:%', n;
  exception when others then
    fel := sqlerrm;
    kod := sqlstate;
  end;

  if fel like 'PROVA_KLAR:%' then
    n := split_part(fel, ':', 2)::bigint;
    insert into utfall (test, ok, detalj)
    values (p_test,
            (p_ska = 'ok' and n > 0) or (p_ska = 'nekad' and n = 0),
            'gick igenom, rader: ' || n);
  else
    insert into utfall (test, ok, detalj)
    values (p_test, p_ska = 'nekad' and kod = '42501', 'fel ' || kod || ': ' || fel);
  end if;
end $$;

-- Räkna rader som uid och jämför med ett väntat tal.
create function pg_temp.rakna(p_test text, p_uid uuid, p_sql text, p_vantat bigint)
returns void language plpgsql as $$
declare
  n   bigint;
  fel text;
begin
  begin
    perform pg_temp.bli(p_uid);
    execute p_sql into n;
    raise exception 'PROVA_KLAR:%', n;
  exception when others then
    fel := sqlerrm;
  end;

  if fel like 'PROVA_KLAR:%' then
    n := split_part(fel, ':', 2)::bigint;
    insert into utfall (test, ok, detalj)
    values (p_test, n = p_vantat, 'fick ' || n || ', väntat ' || p_vantat);
  else
    insert into utfall (test, ok, detalj)
    values (p_test, false, 'fel: ' || fel);
  end if;
end $$;

-- Som rakna, men kör först några satser som samma användare —
-- till exempel en rapport — och räknar sedan.
create function pg_temp.rakna_efter(p_test text, p_uid uuid, p_forst text[], p_sql text, p_vantat bigint)
returns void language plpgsql as $$
declare
  n   bigint;
  fel text;
  s   text;
begin
  begin
    perform pg_temp.bli(p_uid);
    foreach s in array p_forst loop
      execute s;
    end loop;
    execute p_sql into n;
    raise exception 'PROVA_KLAR:%', n;
  exception when others then
    fel := sqlerrm;
  end;

  if fel like 'PROVA_KLAR:%' then
    n := split_part(fel, ':', 2)::bigint;
    insert into utfall (test, ok, detalj)
    values (p_test, n = p_vantat, 'fick ' || n || ', väntat ' || p_vantat);
  else
    insert into utfall (test, ok, detalj)
    values (p_test, false, 'fel: ' || fel);
  end if;
end $$;

-- Som prova, men p_forst körs som postgres INNAN rollen byts, i
-- samma deltransaktion. Det är så ett prov ställer upp just sitt eget
-- läge (en flagga på, ett pass betalt) utan att nästa prov ser det:
-- allt rullas tillbaka med provet.
create function pg_temp.prova_med(p_test text, p_forst text[], p_uid uuid, p_sql text[], p_ska text)
returns void language plpgsql as $$
declare
  n    bigint := 0;
  fel  text;
  kod  text;
  s    text;
begin
  begin
    foreach s in array coalesce(p_forst, '{}') loop
      execute s;
    end loop;
    perform pg_temp.bli(p_uid);
    foreach s in array p_sql loop
      execute s;
      get diagnostics n = row_count;
    end loop;
    raise exception 'PROVA_KLAR:%', n;
  exception when others then
    fel := sqlerrm;
    kod := sqlstate;
  end;

  if fel like 'PROVA_KLAR:%' then
    n := split_part(fel, ':', 2)::bigint;
    insert into utfall (test, ok, detalj)
    values (p_test,
            (p_ska = 'ok' and n > 0) or (p_ska = 'nekad' and n = 0),
            'gick igenom, rader: ' || n);
  else
    insert into utfall (test, ok, detalj)
    values (p_test, p_ska = 'nekad' and kod = '42501', 'fel ' || kod || ': ' || fel);
  end if;
end $$;

-- ------------------------------------------------------------
-- fixturer (som postgres: auth.uid() är null, så skydden släpper)
-- ------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000a1', 'rls-a@example.invalid',     '{"role":"tutor","full_name":"Test Anna"}'),
  ('00000000-0000-4000-8000-0000000000b1', 'rls-b@example.invalid',     '{"role":"tutor","full_name":"Test Bo"}'),
  ('00000000-0000-4000-8000-0000000000f1', 'rls-p@example.invalid',     '{"role":"parent","full_name":"Test Familj P"}'),
  ('00000000-0000-4000-8000-0000000000f2', 'rls-q@example.invalid',     '{"role":"parent","full_name":"Test Familj Q"}'),
  ('00000000-0000-4000-8000-0000000000ad', 'rls-admin@example.invalid', '{"role":"parent","full_name":"Test Admin"}');

update public.profiles set is_admin = true
where id = '00000000-0000-4000-8000-0000000000ad';

update public.tutor_profiles
set status = 'approved', hourly_rate = 150, school = 'Testskolan', age = 17, city = 'Teststad',
    visa_publikt = (id = '00000000-0000-4000-8000-0000000000a1')
where id in ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1');

insert into public.tutor_availability (tutor_id, weekday, start_time, end_time) values
  ('00000000-0000-4000-8000-0000000000a1', 1, '15:00', '19:00'),
  ('00000000-0000-4000-8000-0000000000b1', 2, '15:00', '19:00');

-- Familj P: äldsta barnet hos A, yngsta hos B. Familjens match blir
-- därför A — precis det läge där F-2 slog fel.
insert into public.students (id, parent_id, name, matched_tutor_id, match_status, created_at) values
  ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1', 'Äldst',
   '00000000-0000-4000-8000-0000000000a1', 'matched', now() - interval '2 days'),
  ('00000000-0000-4000-8000-0000000005b1', '00000000-0000-4000-8000-0000000000f1', 'Yngst',
   '00000000-0000-4000-8000-0000000000b1', 'matched', now() - interval '1 day'),
  ('00000000-0000-4000-8000-0000000005c1', '00000000-0000-4000-8000-0000000000f2', 'Annan familj',
   null, 'pending', now());

-- Pass. Olika klockslag, så att överlappsregeln inte slår till.
insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status) values
  -- bekräftat, igår, bokat av familjen
  ('00000000-0000-4000-8000-00000000b0c1', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
   '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1',
   (now() at time zone 'Europe/Stockholm')::date - 1, '15:00', 60, 'confirmed'),
  -- studiehjälparens eget förslag, igår, aldrig besvarat
  ('00000000-0000-4000-8000-00000000b0f1', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
   '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
   (now() at time zone 'Europe/Stockholm')::date - 1, '17:00', 60, 'requested'),
  -- bekräftat, om en vecka
  ('00000000-0000-4000-8000-00000000b0d1', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
   '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1',
   (now() at time zone 'Europe/Stockholm')::date + 7, '15:00', 60, 'confirmed'),
  -- bekräftat, igår, rapport finns redan
  ('00000000-0000-4000-8000-00000000b0a2', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
   '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1',
   (now() at time zone 'Europe/Stockholm')::date - 1, '16:00', 60, 'confirmed'),
  -- avbokat, igår
  ('00000000-0000-4000-8000-00000000b0b1', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
   '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1',
   (now() at time zone 'Europe/Stockholm')::date - 1, '18:00', 60, 'cancelled'),
  -- redan genomfört
  ('00000000-0000-4000-8000-00000000b0e1', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
   '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1',
   (now() at time zone 'Europe/Stockholm')::date - 3, '15:00', 60, 'completed');

-- Två rapporter som A skrivit om sin egen elev: en fristående, och
-- en som hör till passet b0a2. Sedan Fas 3.7 måste en rapport med
-- pass ha närvaro, och då gör triggern passet genomfört. Testerna
-- nedan vill ha b0a2 bekräftat MED en rapport, så det återställs här
-- (som postgres släpper skydden igenom det).
insert into public.lesson_reports (id, student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro) values
  ('00000000-0000-4000-8000-00000000e0a1', '00000000-0000-4000-8000-0000000005a1',
   '00000000-0000-4000-8000-0000000000a1', null, 'fixtur', current_date, null),
  ('00000000-0000-4000-8000-00000000e0a2', '00000000-0000-4000-8000-0000000005a1',
   '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000b0a2', 'fixtur', current_date, 'narvarande');
update public.bookings set status = 'confirmed', attendance = null
 where id = '00000000-0000-4000-8000-00000000b0a2';

-- ------------------------------------------------------------
-- F-1 och publika listan
-- ------------------------------------------------------------
select pg_temp.rakna('F-1 anon läser tutor_profiles', null,
  'select count(*) from public.tutor_profiles', 0);

select pg_temp.rakna('F-1 anon läser profiles', null,
  'select count(*) from public.profiles', 0);

select pg_temp.rakna('F-1 publika listan = godkända med visa_publikt och namn', null,
  'select count(*) from public.publika_studiehjalpare()',
  (select count(*) from public.tutor_profiles tp join public.profiles p on p.id = tp.id
   where tp.status = 'approved' and tp.visa_publikt and btrim(coalesce(p.full_name, '')) <> ''));

select pg_temp.rakna('F-1 publika listan innehåller inte B (visa_publikt av)', null,
  $q$select count(*) from public.publika_studiehjalpare() where id = '00000000-0000-4000-8000-0000000000b1'$q$, 0);

select pg_temp.rakna('F-1 familj P ser sina två studiehjälpare', '00000000-0000-4000-8000-0000000000f1',
  'select count(*) from public.tutor_profiles', 2);

select pg_temp.rakna('F-1 studievyns fråga (foralder.html:826) fungerar', '00000000-0000-4000-8000-0000000000f1',
  $q$select count(*) from public.tutor_profiles where id = '00000000-0000-4000-8000-0000000000a1'$q$, 1);

select pg_temp.rakna('F-1 familj Q utan match ser ingen studiehjälpare', '00000000-0000-4000-8000-0000000000f2',
  'select count(*) from public.tutor_profiles', 0);

select pg_temp.rakna('F-1 studiehjälpare A ser bara sig själv', '00000000-0000-4000-8000-0000000000a1',
  'select count(*) from public.tutor_profiles', 1);

select pg_temp.rakna('F-1 admin ser alla studiehjälpare', '00000000-0000-4000-8000-0000000000ad',
  'select count(*) from public.tutor_profiles',
  (select count(*) from public.tutor_profiles));

-- ------------------------------------------------------------
-- F-3 tillgänglighet
-- ------------------------------------------------------------
select pg_temp.rakna('F-3 anon läser tillgänglighet', null,
  'select count(*) from public.tutor_availability', 0);

select pg_temp.rakna('F-3 familj P ser A:s och B:s tider', '00000000-0000-4000-8000-0000000000f1',
  'select count(*) from public.tutor_availability', 2);

select pg_temp.rakna('F-3 familj Q ser inga tider', '00000000-0000-4000-8000-0000000000f2',
  'select count(*) from public.tutor_availability', 0);

select pg_temp.rakna('F-3 studiehjälpare A ser bara sina tider', '00000000-0000-4000-8000-0000000000a1',
  'select count(*) from public.tutor_availability', 1);

select pg_temp.rakna('F-3 admin ser alla tider', '00000000-0000-4000-8000-0000000000ad',
  'select count(*) from public.tutor_availability',
  (select count(*) from public.tutor_availability));

-- ------------------------------------------------------------
-- F-2 syskonen
-- ------------------------------------------------------------
select pg_temp.prova('F-2 A skriver rapport om B:s elev', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, raw_notes)
          values ('00000000-0000-4000-8000-0000000005b1', '00000000-0000-4000-8000-0000000000a1', 'x')$q$],
  'nekad');

select pg_temp.prova('F-2 B skriver rapport om sin egen elev', '00000000-0000-4000-8000-0000000000b1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, raw_notes)
          values ('00000000-0000-4000-8000-0000000005b1', '00000000-0000-4000-8000-0000000000b1', 'x')$q$],
  'ok');

select pg_temp.prova('F-2 A skriver rapport om sin egen elev', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, raw_notes)
          values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1', 'x')$q$],
  'ok');

select pg_temp.prova('F-2 A flyttar sin rapport till B:s elev', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.lesson_reports set student_id = '00000000-0000-4000-8000-0000000005b1'
          where id = '00000000-0000-4000-8000-00000000e0a1'$q$],
  'nekad');

select pg_temp.prova('F-2 A laddar upp material i B:s elevs mapp', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into storage.objects (bucket_id, name, owner)
          values ('material', '00000000-0000-4000-8000-0000000005b1/x.pdf', '00000000-0000-4000-8000-0000000000a1')$q$],
  'nekad');

-- ------------------------------------------------------------
-- F-6 bokningarna
-- ------------------------------------------------------------
select pg_temp.prova('F-6 A höjer duration_min till 600', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set duration_min = 600 where id = '00000000-0000-4000-8000-00000000b0c1'$q$],
  'nekad');

select pg_temp.prova('F-6 A byter parent_id', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set parent_id = '00000000-0000-4000-8000-0000000000f2' where id = '00000000-0000-4000-8000-00000000b0c1'$q$],
  'nekad');

select pg_temp.prova('F-6 A höjer antal_barn', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set antal_barn = 3 where id = '00000000-0000-4000-8000-00000000b0c1'$q$],
  'nekad');

select pg_temp.prova('F-6 A byter tjänst', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set tjanst = 'barnvakt' where id = '00000000-0000-4000-8000-00000000b0c1'$q$],
  'nekad');

select pg_temp.prova('F-6 P byter studiehjälpare', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set tutor_id = '00000000-0000-4000-8000-0000000000b1' where id = '00000000-0000-4000-8000-00000000b0c1'$q$],
  'nekad');

select pg_temp.prova('F-6 A markerar genomfört utan rapport', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set status = 'completed' where id = '00000000-0000-4000-8000-00000000b0c1'$q$],
  'nekad');

select pg_temp.prova('F-6 A rapporterar bekräftat pass och markerar genomfört', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, narvaro)
          values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b0c1', 'x', 'narvarande')$q$,
        $q$update public.bookings set status = 'completed', attendance = 'narvarande'
          where id = '00000000-0000-4000-8000-00000000b0c1'$q$],
  'ok');

select pg_temp.prova('F-6 P markerar pass med rapport som genomfört', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set status = 'completed' where id = '00000000-0000-4000-8000-00000000b0a2'$q$],
  'nekad');

select pg_temp.prova('F-6 A markerar pass med rapport som genomfört', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set status = 'completed', attendance = 'sen'
          where id = '00000000-0000-4000-8000-00000000b0a2'$q$],
  'ok');

select pg_temp.prova('F-6 B markerar A:s pass som genomfört', '00000000-0000-4000-8000-0000000000b1',
  array[$q$update public.bookings set status = 'completed' where id = '00000000-0000-4000-8000-00000000b0a2'$q$],
  'nekad');

select pg_temp.prova('F-6 P sätter närvaro utan rapport', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set attendance = 'franvarande' where id = '00000000-0000-4000-8000-00000000b0c1'$q$],
  'nekad');

select pg_temp.prova('F-6 A rapporterar eget obesvarat förslag som genomfört', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, narvaro)
          values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b0f1', 'x', 'narvarande')$q$,
        $q$update public.bookings set status = 'completed' where id = '00000000-0000-4000-8000-00000000b0f1'$q$],
  'nekad');

select pg_temp.prova('F-6 A bekräftar sitt eget förslag', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set status = 'confirmed' where id = '00000000-0000-4000-8000-00000000b0f1'$q$],
  'nekad');

select pg_temp.prova('F-6 P bekräftar A:s förslag', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set status = 'confirmed' where id = '00000000-0000-4000-8000-00000000b0f1'$q$],
  'ok');

-- Sedan Fas 15.2 kräver en avbokning ett skäl, i samma skrivning.
select pg_temp.prova('F-6 A avbokar kommande pass (med skäl)', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set status = 'cancelled', avbokningsskal = 'forhinder'
          where id = '00000000-0000-4000-8000-00000000b0d1'$q$],
  'ok');

select pg_temp.prova('15.2 A avbokar kommande pass utan skäl', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set status = 'cancelled' where id = '00000000-0000-4000-8000-00000000b0d1'$q$],
  'nekad');

-- Att avböja en tid motparten föreslagit är inte att avboka ett pass,
-- och frågar inte efter skäl. b0f1 är A:s eget förslag till P.
select pg_temp.prova('15.2 P avböjer A:s förslag utan skäl', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set status = 'cancelled' where id = '00000000-0000-4000-8000-00000000b0f1'$q$],
  'ok');

-- Men den som drar tillbaka sitt EGET förslag avbokar, och ska säga varför.
select pg_temp.prova('15.2 A drar tillbaka sitt eget förslag utan skäl', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set status = 'cancelled' where id = '00000000-0000-4000-8000-00000000b0f1'$q$],
  'nekad');

-- Nextrums egna koder väljs inte av en familj eller en studiehjälpare.
select pg_temp.prova('15.2 P avbokar med Nextrums kod familjen_avslutar', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set status = 'cancelled', avbokningsskal = 'familjen_avslutar'
          where id = '00000000-0000-4000-8000-00000000b0d1'$q$],
  'nekad');

select pg_temp.prova('F-6 P flyttar kommande pass (som foralder.html gör)', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings
          set wanted_date = wanted_date + 1, wanted_time = '16:00',
              status = 'requested', created_by = '00000000-0000-4000-8000-0000000000f1'
          where id = '00000000-0000-4000-8000-00000000b0d1'$q$],
  'ok');

select pg_temp.prova('F-6 P flyttar pass bakåt i tiden', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings
          set wanted_date = (now() at time zone 'Europe/Stockholm')::date - 5,
              status = 'requested', created_by = '00000000-0000-4000-8000-0000000000f1'
          where id = '00000000-0000-4000-8000-00000000b0d1'$q$],
  'nekad');

select pg_temp.prova('F-6 P flyttar pass men behåller bekräftat', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set wanted_date = wanted_date + 1
          where id = '00000000-0000-4000-8000-00000000b0d1'$q$],
  'nekad');

select pg_temp.prova('F-6 A ändrar genomfört pass', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set duration_min = 180 where id = '00000000-0000-4000-8000-00000000b0e1'$q$],
  'nekad');

select pg_temp.prova('F-6 P avbokar genomfört pass', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set status = 'cancelled' where id = '00000000-0000-4000-8000-00000000b0e1'$q$],
  'nekad');

select pg_temp.prova('F-6 A skapar pass direkt som genomfört', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  (now() at time zone 'Europe/Stockholm')::date + 2, '18:00', 60, 'completed')$q$],
  'nekad');

select pg_temp.prova('F-6 A skapar pass bakåt i tiden', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  (now() at time zone 'Europe/Stockholm')::date - 2, '18:00', 60, 'requested')$q$],
  'nekad');

select pg_temp.prova('F-6 A föreslår pass för B:s elev', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-0000000005b1', '00000000-0000-4000-8000-0000000000a1',
                  (now() at time zone 'Europe/Stockholm')::date + 2, '18:00', 60, 'requested')$q$],
  'nekad');

select pg_temp.prova('F-6 A föreslår pass med flerbarnstillägg', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status, antal_barn)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  (now() at time zone 'Europe/Stockholm')::date + 2, '18:00', 60, 'requested', 2)$q$],
  'nekad');

select pg_temp.prova('F-6 A föreslår vanligt pass (som larare.html gör)', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, series_id, subject, tjanst,
                                        format, duration_min, wanted_date, wanted_time, status)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  gen_random_uuid(), 'Matematik', 'laxhjalp', 'På plats', 120,
                  (now() at time zone 'Europe/Stockholm')::date + 2, '15:00', 'requested')$q$],
  'ok');

select pg_temp.prova('F-6 P bokar tio timmar', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1',
                  (now() at time zone 'Europe/Stockholm')::date + 3, '15:00', 600, 'requested')$q$],
  'nekad');

select pg_temp.prova('F-6 P bokar en inaktiv tjänst', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, tjanst, status)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1',
                  (now() at time zone 'Europe/Stockholm')::date + 3, '15:00', 60, 'barnvakt', 'requested')$q$],
  'nekad');

select pg_temp.prova('F-6 P bokar för en annan familjs barn', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-0000000005c1', '00000000-0000-4000-8000-0000000000f1',
                  (now() at time zone 'Europe/Stockholm')::date + 3, '15:00', 60, 'requested')$q$],
  'nekad');

select pg_temp.prova('F-6 P bokar vanligt pass (som foralder.html gör)', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, subject, tjanst, antal_barn,
                                        format, location, wanted_date, wanted_time, duration_min, status)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1',
                  'Svenska', 'laxhjalp', 2, 'På plats', 'Hemma',
                  (now() at time zone 'Europe/Stockholm')::date + 3, '16:00', 60, 'requested')$q$],
  'ok');

select pg_temp.prova('F-6 admin rättar ett genomfört pass', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.bookings set duration_min = 120 where id = '00000000-0000-4000-8000-00000000b0e1'$q$],
  'ok');

-- ------------------------------------------------------------
-- Fas 2: fakturerbar, passunderlag och rapporten som gör passet
-- genomfört
-- ------------------------------------------------------------
select pg_temp.prova('F2 P bokar ett pass som inte ska faktureras', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status, fakturerbar)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1',
                  (now() at time zone 'Europe/Stockholm')::date + 3, '15:00', 60, 'requested', false)$q$],
  'nekad');

select pg_temp.prova('F2 P undantar sitt eget pass', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set fakturerbar = false, fakturerbar_anledning = 'x'
          where id = '00000000-0000-4000-8000-00000000b0c1'$q$],
  'nekad');

select pg_temp.prova('F2 admin undantar ett genomfört pass', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.bookings set fakturerbar = false, fakturerbar_anledning = 'testpass'
          where id = '00000000-0000-4000-8000-00000000b0e1'$q$],
  'ok');

select pg_temp.rakna('F2 passunderlaget: genomfört pass utan rapport', '00000000-0000-4000-8000-0000000000ad',
  $q$select count(*) from public.passunderlag
     where id = '00000000-0000-4000-8000-00000000b0e1' and not har_rapport and fakturerbar$q$, 1);

select pg_temp.prova('F2 anon läser inte passunderlaget', null,
  array['select * from public.passunderlag'], 'nekad');

select pg_temp.rakna('F2 ofakturerat räknar inte pass utan rapport', '00000000-0000-4000-8000-0000000000f1',
  $q$select coalesce(sum(pass), 0) from public.ofakturerat
     where parent_id = '00000000-0000-4000-8000-0000000000f1'$q$, 0);

select pg_temp.rakna_efter('F2 admin kopplar en rapport, passet blir fakturerbart', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.lesson_reports set booking_id = '00000000-0000-4000-8000-00000000b0e1', narvaro = 'narvarande'
          where id = '00000000-0000-4000-8000-00000000e0a1' and booking_id is null$q$],
  $q$select count(*) from public.passunderlag
     where id = '00000000-0000-4000-8000-00000000b0e1' and har_rapport and fakturerbar and not fakturerad$q$, 1);

select pg_temp.rakna_efter('F2 ej_utbetalt räknar passet när rapporten är kopplad', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.lesson_reports set booking_id = '00000000-0000-4000-8000-00000000b0e1', narvaro = 'narvarande'
          where id = '00000000-0000-4000-8000-00000000e0a1'$q$],
  $q$select coalesce(sum(pass), 0) from public.ej_utbetalt
     where tutor_id = '00000000-0000-4000-8000-0000000000a1'$q$, 1);

select pg_temp.rakna_efter('F2 rapport med närvaro gör passet genomfört', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, narvaro)
          values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b0c1', 'x', 'sen')$q$],
  $q$select count(*) from public.bookings
     where id = '00000000-0000-4000-8000-00000000b0c1' and status = 'completed' and attendance = 'sen'$q$, 1);

-- Fas 3.7: en rapport som hör till ett pass måste ha närvaro. Förut
-- lämnade en sådan rapport passet orört (den gamla vyn); nu nekas den
-- av check-villkoret rapport_med_pass_har_narvaro (23514).
do $$
declare kod text := null;
begin
  begin
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000a1');
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes)
    values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b0c1', 'x');
    kod := 'gick igenom';
    raise exception 'KLAR';
  exception when others then
    if kod is null then kod := sqlstate; end if;
  end;
  insert into utfall (test, ok, detalj)
  values ('3.7 rapport med pass men utan närvaro nekas', kod = '23514', 'fick ' || kod);
end $$;

select pg_temp.prova('F2 rapport med närvaro på obesvarat eget förslag', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, narvaro)
          values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b0f1', 'x', 'narvarande')$q$],
  'nekad');

select pg_temp.prova('F2 rapport med närvaro på avbokat pass', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, narvaro)
          values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b0b1', 'x', 'narvarande')$q$],
  'nekad');

select pg_temp.prova('F2 rapport med närvaro på kommande pass', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, narvaro)
          values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b0d1', 'x', 'narvarande')$q$],
  'nekad');

select pg_temp.rakna_efter('F2 andra rapporten på ett genomfört pass ändrar inget', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, narvaro)
          values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b0c1', 'x', 'sen')$q$,
        $q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, narvaro)
          values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b0c1', 'y', 'narvarande')$q$],
  $q$select count(*) from public.bookings
     where id = '00000000-0000-4000-8000-00000000b0c1' and attendance = 'sen'$q$, 1);

-- ------------------------------------------------------------
-- F-7 och triggerfunktionerna
-- ------------------------------------------------------------
select pg_temp.rakna('F-7 anon ser bara aktiva tjänster', null,
  'select count(*) from public.tjanster where not aktiv', 0);

select pg_temp.rakna('F-7 anon ser de aktiva tjänsterna', null,
  'select count(*) from public.tjanster',
  (select count(*) from public.tjanster where aktiv));

select pg_temp.rakna('F-7 familj ser bara aktiva tjänster', '00000000-0000-4000-8000-0000000000f1',
  'select count(*) from public.tjanster where not aktiv', 0);

select pg_temp.rakna('F-7 admin ser hela katalogen', '00000000-0000-4000-8000-0000000000ad',
  'select count(*) from public.tjanster',
  (select count(*) from public.tjanster));


-- ------------------------------------------------------------
-- Fas 5.2: uppdrag
-- Fixturbarnen lades in som postgres, och triggern gav dem var sitt
-- uppdrag. Fixturpassen hamnade på barnets uppdrag.
-- ------------------------------------------------------------
insert into utfall (test, ok, detalj)
select '5.2 varje fixturbarn fick ett eget uppdrag',
       count(distinct s.uppdrag_id) = 3 and count(*) filter (where u.kund_id = s.parent_id) = 3,
       'barn med uppdrag: ' || count(s.uppdrag_id)
  from public.students s left join public.uppdrag u on u.id = s.uppdrag_id
 where s.parent_id in ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000f2');

insert into utfall (test, ok, detalj)
select '5.2 fixturpassen ligger på barnets uppdrag',
       count(*) = count(*) filter (where b.uppdrag_id = s.uppdrag_id),
       count(*) filter (where b.uppdrag_id = s.uppdrag_id) || ' av ' || count(*)
  from public.bookings b join public.students s on s.id = b.student_id
 where b.parent_id = '00000000-0000-4000-8000-0000000000f1';

select pg_temp.prova('5.2 anon läser uppdrag', null,
  array[$q$select * from public.uppdrag$q$], 'nekad');
select pg_temp.rakna('5.2 familj P ser sina två uppdrag', '00000000-0000-4000-8000-0000000000f1',
  'select count(*) from public.uppdrag', 2);
select pg_temp.rakna('5.2 familj Q ser bara sitt eget', '00000000-0000-4000-8000-0000000000f2',
  'select count(*) from public.uppdrag', 1);
-- EN, inte två. Testet väntade sig förut familjens BÅDA uppdrag, och
-- det var den läcka Runda 2 stängde: policyn var matchad mot familjen
-- (is_matched_tutor_of(parent_id)) och släppte därför igenom alla
-- syskon så fort ett av dem var matchat. Migrationen
-- r2_fas1_6_studiehjalparen_ser_bara_sina_elever säger det rakt ut:
-- "Samma sak gällde uppdragen, ett per barn."
--
-- A är matchad med familj P:s äldsta barn. Syskonet har B som
-- studiehjälpare, och dess uppdrag ska A inte se. Står det 2 här igen
-- är det löftet i integritetspolicyn som brustit, inte testet.
select pg_temp.rakna('5.2 studiehjälpare A ser sin elevs uppdrag, inte syskonets eller Q:s', '00000000-0000-4000-8000-0000000000a1',
  $q$select count(*) from public.uppdrag where kund_id in ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000f2')$q$, 1);
select pg_temp.rakna('5.2 admin ser alla', '00000000-0000-4000-8000-0000000000ad',
  $q$select count(*) from public.uppdrag where kund_id in ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000f2')$q$, 3);

select pg_temp.prova('5.2 familj skapar uppdrag själv', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.uppdrag (kund_id, tjanst) values ('00000000-0000-4000-8000-0000000000f1', 'laxhjalp')$q$], 'nekad');
select pg_temp.prova('5.2 familj ändrar sitt uppdrag', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.uppdrag set status = 'avslutat' where kund_id = '00000000-0000-4000-8000-0000000000f1'$q$], 'nekad');

-- Familjen försöker peka sitt barn på Q:s uppdrag. skydda_studentfalt
-- låser fältet, så raden uppdateras men värdet står kvar.
select pg_temp.rakna_efter('5.2 familj kan inte flytta barnet till ett annat uppdrag', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.students set uppdrag_id = '$q$
        || (select uppdrag_id::text from public.students where id = '00000000-0000-4000-8000-0000000005c1')
        || $q$' where id = '00000000-0000-4000-8000-0000000005a1'$q$],
  $q$select count(*) from public.students where id = '00000000-0000-4000-8000-0000000005a1'
     and uppdrag_id = '$q$ || (select uppdrag_id::text from public.students where id = '00000000-0000-4000-8000-0000000005a1') || $q$'$q$, 1);

select pg_temp.rakna_efter('5.2 nytt barn får ett eget uppdrag', '00000000-0000-4000-8000-0000000000f2',
  array[$q$insert into public.students (parent_id, name) values ('00000000-0000-4000-8000-0000000000f2', 'Nytt barn')$q$],
  'select count(*) from public.uppdrag', 2);

select pg_temp.rakna_efter('5.2 nytt barn får eget uppdrag även med syskonets id', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.students (parent_id, name, uppdrag_id) values ('00000000-0000-4000-8000-0000000000f1', 'Tredje', '$q$
        || (select uppdrag_id::text from public.students where id = '00000000-0000-4000-8000-0000000005a1')
        || $q$')$q$],
  $q$select count(*) from public.students where name = 'Tredje'
     and uppdrag_id is distinct from '$q$ || (select uppdrag_id::text from public.students where id = '00000000-0000-4000-8000-0000000005a1') || $q$'$q$, 1);

select pg_temp.rakna_efter('5.2 nytt pass hamnar på barnets uppdrag', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1',
                  (now() at time zone 'Europe/Stockholm')::date + 14, '10:00', 60, 'requested')$q$],
  $q$select count(*) from public.bookings b join public.students s on s.id = b.student_id
     where b.wanted_time = '10:00' and b.uppdrag_id = s.uppdrag_id$q$, 1);

-- Sedan 5.4: den som inte är admin väljer inte uppdrag till ett barn.
-- Ett främmande uppdrag byts mot barnets eget — passet går igenom men
-- hamnar rätt. Utan barn prövas uppdraget mot familjen och nekas.
select pg_temp.rakna_efter('5.2 främmande uppdrag på ett barns pass byts mot barnets', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status, uppdrag_id)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1',
                  (now() at time zone 'Europe/Stockholm')::date + 14, '11:00', 60, 'requested', '$q$
        || (select uppdrag_id::text from public.students where id = '00000000-0000-4000-8000-0000000005c1')
        || $q$')$q$],
  $q$select count(*) from public.bookings b join public.students s on s.id = b.student_id
     where b.wanted_time = '11:00' and b.uppdrag_id = s.uppdrag_id$q$, 1);

select pg_temp.prova('5.2 pass utan barn på en annan familjs uppdrag nekas', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status, uppdrag_id)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1', null, '00000000-0000-4000-8000-0000000000f1',
                  (now() at time zone 'Europe/Stockholm')::date + 14, '12:00', 60, 'requested', '$q$
        || (select uppdrag_id::text from public.students where id = '00000000-0000-4000-8000-0000000005c1')
        || $q$')$q$], 'nekad');

-- ------------------------------------------------------------
-- Fas 5.3: skatteuppgifter och RUT
-- ------------------------------------------------------------
select pg_temp.prova('5.3 anon läser skatteuppgifter', null,
  array[$q$select * from public.kund_skatteuppgifter$q$], 'nekad');
select pg_temp.prova('5.3 familj läser skatteuppgifter', '00000000-0000-4000-8000-0000000000f1',
  array[$q$select * from public.kund_skatteuppgifter$q$], 'nekad');
select pg_temp.prova('5.3 familj läser via funktionen', '00000000-0000-4000-8000-0000000000f1',
  array[$q$select * from public.las_skatteuppgifter('00000000-0000-4000-8000-0000000000f1')$q$], 'nekad');
select pg_temp.prova('5.3 studiehjälpare sparar personnummer', '00000000-0000-4000-8000-0000000000a1',
  array[$q$select public.spara_skatteuppgifter('00000000-0000-4000-8000-0000000000f1', '198112189876')$q$], 'nekad');
select pg_temp.prova('5.3 anon anropar spara', null,
  array[$q$select public.spara_skatteuppgifter('00000000-0000-4000-8000-0000000000f1', '198112189876')$q$], 'nekad');

select pg_temp.rakna_efter('5.3 admin sparar och läser tillbaka personnumret', '00000000-0000-4000-8000-0000000000ad',
  array[$q$select public.spara_skatteuppgifter('00000000-0000-4000-8000-0000000000f1', '19811218-9876', 'Test 1:2')$q$],
  $q$select count(*) from public.las_skatteuppgifter('00000000-0000-4000-8000-0000000000f1') where personnummer = '19811218-9876'$q$, 1);

select pg_temp.prova('5.3 admin läser tabellen direkt', '00000000-0000-4000-8000-0000000000ad',
  array[$q$select * from public.kund_skatteuppgifter$q$], 'nekad');

select pg_temp.prova('5.3 anon läser rut_tak', null,
  array[$q$select * from public.rut_tak$q$], 'nekad');
select pg_temp.rakna('5.3 familj ser inget rut_tak', '00000000-0000-4000-8000-0000000000f1',
  'select count(*) from public.rut_tak', 0);

-- En faktura att pröva beloppslåset på.
insert into public.invoices (parent_id, period, belopp_ore, rut_ore)
values ('00000000-0000-4000-8000-0000000000f1', '2026-01-01', 1000, 0);

select pg_temp.prova('5.3 familj ändrar RUT på sin faktura', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.invoices set rut_ore = 500 where parent_id = '00000000-0000-4000-8000-0000000000f1'$q$], 'nekad');
select pg_temp.rakna_efter('5.3 inte ens admin ändrar RUT på en skapad faktura', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.invoices set rut_ore = 500 where parent_id = '00000000-0000-4000-8000-0000000000f1'$q$],
  $q$select count(*) from public.invoices where parent_id = '00000000-0000-4000-8000-0000000000f1' and rut_ore = 0$q$, 1);

select pg_temp.prova('5.1 anon läser ersättningen i tjänstekatalogen', null,
  array[$q$select ersattning_per_timme_ore from public.tjanster$q$], 'nekad');
select pg_temp.prova('5.1 anon läser krav och matchningsregler', null,
  array[$q$select krav, matchningsregler from public.tjanster$q$], 'nekad');
select pg_temp.rakna('5.1 anon läser katalogens publika kolumner', null,
  $q$select count(*) from (select kod, namn, namn_en, kort, kort_en, for_kund, for_jobb, aktiv, ordning,
       pris_per_timme_ore, extra_personer_ore, extra_personer_max, bokningstyp, rapportkrav,
       rut_berattigad, rut_procent, kundtyp, jobbtyp, min_alder from public.tjanster) x$q$,
  (select count(*) from public.tjanster where aktiv));

select pg_temp.rakna('5.1 läxhjälpen är inte RUT-berättigad', null,
  $q$select count(*) from public.tjanster where kod = 'laxhjalp' and not rut_berattigad and rut_procent = 0$q$, 1);


-- ------------------------------------------------------------
-- Fas 6: auditlogg, uppgifter, avvikelser
-- ------------------------------------------------------------
select pg_temp.prova('6.1 anon läser auditloggen', null,
  array[$q$select * from public.audit_logg$q$], 'nekad');
select pg_temp.rakna('6.1 familj ser ingen auditlogg', '00000000-0000-4000-8000-0000000000f1',
  'select count(*) from public.audit_logg', 0);
select pg_temp.rakna('6.1 studiehjälpare ser ingen auditlogg', '00000000-0000-4000-8000-0000000000a1',
  'select count(*) from public.audit_logg', 0);
select pg_temp.prova('6.1 admin skriver i auditloggen', '00000000-0000-4000-8000-0000000000ad',
  array[$q$insert into public.audit_logg (aktor_typ, handling, tabell, objekt_id) values ('admin', 'x.y', 't', '1')$q$], 'nekad');
select pg_temp.prova('6.1 admin raderar ur auditloggen', '00000000-0000-4000-8000-0000000000ad',
  array[$q$delete from public.audit_logg$q$], 'nekad');

-- En matchning av admin blir en rad i loggen, utan barnets namn.
select pg_temp.rakna_efter('6.1 matchning loggas utan namn', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.students set matched_tutor_id = null, match_status = 'pending'
          where id = '00000000-0000-4000-8000-0000000005a1'$q$],
  $q$select count(*) from public.audit_logg where handling = 'matchning.andrad'
     and objekt_id = '00000000-0000-4000-8000-0000000005a1'
     and aktor = '00000000-0000-4000-8000-0000000000ad' and aktor_typ = 'admin'
     and (coalesce(fore::text, '') || coalesce(efter::text, '')) not like '%Äldst%'$q$, 1);

select pg_temp.prova('6.2 anon läser uppgifter', null,
  array[$q$select * from public.uppgifter$q$], 'nekad');
select pg_temp.prova('6.2 studiehjälpare skapar en uppgift', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.uppgifter (titel) values ('x')$q$], 'nekad');
select pg_temp.rakna_efter('6.2 admin skapar en uppgift som människa', '00000000-0000-4000-8000-0000000000ad',
  array[$q$insert into public.uppgifter (titel, skapad_av_typ) values ('Prov', 'ai')$q$],
  $q$select count(*) from public.uppgifter where titel = 'Prov'
     and skapad_av_typ = 'manniska' and skapad_av = '00000000-0000-4000-8000-0000000000ad'$q$, 1);
select pg_temp.prova('6.2 familj anropar ekonomiska_avvikelser', '00000000-0000-4000-8000-0000000000f1',
  array[$q$select * from public.ekonomiska_avvikelser()$q$], 'nekad');
select pg_temp.prova('6.2 anon läser admin_lage', null,
  array[$q$select * from public.admin_lage$q$], 'nekad');

-- ============================================================
-- FAS 7 — kundresan och automationerna
--
-- OBS om formen: pg_temp.prova rullar tillbaka sin egen
-- deltransaktion (den avslutar med raise). Raden den skapar finns
-- alltså inte för nästa test. Fixturen nedan läggs därför in med
-- vanliga satser, med rollen satt via pg_temp.bli, och räknas i en
-- EGEN sats — en sats ser inte vad den själv skriver.
-- ============================================================

-- Anmälningsformuläret är öppet för vem som helst, och RLS kan inte
-- begränsa kolumner. Triggern skydda_leadfalt ska därför nolla det
-- en besökare inte får bestämma: kopplingen, läget och noteringen.
select pg_temp.prova('7.1 anon skickar en intresseanmälan', null,
  array[$q$insert into public.leads (parent_name, email, subject, tjanst, kund_id, status, notering, kontaktad_at)
        values ('Prov Fas7', 'prov-fas7@example.invalid', 'Matte', 'laxhjalp',
                '00000000-0000-4000-8000-0000000000f1', 'matched', 'skriven av angripare', now())$q$], 'ok');

-- Samma anmälan igen, men utanför prova, så att raden blir kvar.
select pg_temp.bli(null);
insert into public.leads (parent_name, email, subject, tjanst, kund_id, status, notering, kontaktad_at)
values ('Prov Fas7', 'prov-fas7@example.invalid', 'Matte', 'laxhjalp',
        '00000000-0000-4000-8000-0000000000f1', 'matched', 'skriven av angripare', now());
reset role;

insert into utfall (test, ok, detalj)
select '7.1 anon kan inte skriva kopplingen på en anmälan',
       count(*) = 1,
       'rader som klarade kontrollen: ' || count(*)
from public.leads
where email = 'prov-fas7@example.invalid'
  and kund_id is null and uppdrag_id is null and status = 'new'
  and notering is null and kontaktad_at is null;

-- Det publika formuläret ska fortfarande fungera oförändrat.
select pg_temp.bli(null);
insert into public.leads (parent_name, email, child_name, grade, subject, tjanst, message)
values ('Prov Form', 'prov-form7@example.invalid', 'Barn', 'Åk 8', 'Matte', 'laxhjalp', 'Hej');
reset role;

insert into utfall (test, ok, detalj)
select '7.1 anmälan med formulärets fält går igenom oförändrad',
       count(*) = 1, 'rader: ' || count(*)
from public.leads
where email = 'prov-form7@example.invalid' and parent_name = 'Prov Form'
  and child_name = 'Barn' and grade = 'Åk 8' and subject = 'Matte' and message = 'Hej';

-- Admin får skriva kopplingen, och bara admin.
select pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
update public.leads set kund_id = '00000000-0000-4000-8000-0000000000f1',
       status = 'contacted', kontaktad_at = now()
 where email = 'prov-fas7@example.invalid';
reset role;

insert into utfall (test, ok, detalj)
select '7.1 admin sätter kopplingen på anmälan', count(*) = 1, 'rader: ' || count(*)
from public.leads
where email = 'prov-fas7@example.invalid'
  and kund_id = '00000000-0000-4000-8000-0000000000f1' and status = 'contacted';

select pg_temp.prova('7.1 familj ändrar en anmälan', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.leads set kund_id = null where email = 'prov-fas7@example.invalid'$q$], 'nekad');

-- Auditloggen ska följa kundresan, utan persondata i raden.
insert into utfall (test, ok, detalj)
select '7.1c auditrad för anmälan, utan persondata', count(*) = 1, 'rader: ' || count(*)
from public.audit_logg
where handling = 'anmalan.status'
  and aktor = '00000000-0000-4000-8000-0000000000ad' and aktor_typ = 'admin'
  and (coalesce(fore::text, '') || coalesce(efter::text, '')) not like '%example.invalid%'
  and (coalesce(fore::text, '') || coalesce(efter::text, '')) not like '%Prov Fas7%';

-- Serverkoden som automationerna använder får inte gå att nå från en vy.
select pg_temp.prova('7.3 familj anropar skapa_uppgift', '00000000-0000-4000-8000-0000000000f1',
  array[$q$select public.skapa_uppgift('Prov', 'prov:fran:vyn')$q$], 'nekad');
select pg_temp.prova('7.3 studiehjälpare kör kontrollerna', '00000000-0000-4000-8000-0000000000a1',
  array[$q$select public.kor_kontrollerna()$q$], 'nekad');
select pg_temp.prova('7.3 familj läser avvikelser_rader', '00000000-0000-4000-8000-0000000000f1',
  array[$q$select * from public.avvikelser_rader()$q$], 'nekad');

-- Nyckeln är hela dubblettskyddet. Anropen står i egna satser: en
-- sats ser inte raderna den själv skapar, och ett test som räknar i
-- samma sats mäter därför ingenting.
--
-- Claims nollas först. reset role byter tillbaka rollen men LÄMNAR
-- request.jwt.claims kvar — den sattes med set_config(..., true),
-- alltså för hela transaktionen. Utan den här raden ser
-- uppgift_stampel en inloggad människa och stämplar uppgiften som
-- skapad av admin, och testet nedan mäter fel sak.
select set_config('request.jwt.claims', null, true);

select public.skapa_uppgift('Prov dubblett', 'prov:dubblett:7');
select public.skapa_uppgift('Prov dubblett', 'prov:dubblett:7');

insert into utfall (test, ok, detalj)
select '7.3a skapa_uppgift skapar ingen dubblett', count(*) = 1, 'antal rader: ' || count(*)
from public.uppgifter where nyckel = 'prov:dubblett:7';

insert into utfall (test, ok, detalj)
select '7.3a maskinens uppgift stämplas som system',
       coalesce(bool_and(skapad_av_typ = 'system' and skapad_av is null), false),
       coalesce(string_agg(skapad_av_typ, ','), 'ingen rad')
from public.uppgifter where nyckel = 'prov:dubblett:7';

-- En klar uppgift ska inte blockera nästa gång samma sak inträffar:
-- samma faktura kan förfalla igen, och samma pass kan sakna rapport
-- en gång till efter att någon stängt uppgiften.
update public.uppgifter set status = 'klar' where nyckel = 'prov:dubblett:7';
select public.skapa_uppgift('Prov igen', 'prov:dubblett:7');

insert into utfall (test, ok, detalj)
select '7.3a klar uppgift blockerar inte en ny', count(*) = 2, 'antal rader: ' || count(*)
from public.uppgifter where nyckel = 'prov:dubblett:7';

-- Kontrollerna ska gå att köra två gånger utan att listan dubbleras.
select public.dagliga_kontroller();
insert into utfall (test, ok, detalj)
select '7.3c andra körningen skapar inget nytt',
       (k ->> 'nya_uppgifter')::int = 0, 'svar: ' || k::text
from (select public.dagliga_kontroller() as k) t;

-- Den väg som faktiskt körs i dag är knappen i adminvyn, alltså med
-- en inloggad admin. Triggern uppgift_stampel stämplade förut om
-- maskinens uppgifter till 'manniska' just då, och testet ovan såg
-- det inte eftersom det nollar claims. Det här provet gör tvärtom.
select pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
select public.kor_kontrollerna();
reset role;

insert into utfall (test, ok, detalj)
select '7.4 adminknappen stämplar maskinens uppgifter som system',
       count(*) > 0 and bool_and(skapad_av_typ = 'system' and skapad_av is null),
       'uppgifter: ' || count(*) || ', typer: ' || coalesce(string_agg(distinct skapad_av_typ, ','), 'inga')
from public.uppgifter where nyckel like 'kontroll:%' or nyckel like 'avvikelse:%' or nyckel like 'uppfoljning:%';

-- En avbruten uppgift är ett svar: "det här tänker vi inte göra".
-- Kommer den tillbaka nästa körning är knappen Avbryt utan verkan.
update public.uppgifter set status = 'avbruten' where nyckel = 'prov:dubblett:7';
select public.skapa_uppgift('Prov efter avbruten', 'prov:dubblett:7');

insert into utfall (test, ok, detalj)
select '7.4 avbruten uppgift återskapas inte', count(*) = 2, 'antal rader: ' || count(*)
from public.uppgifter where nyckel = 'prov:dubblett:7';

-- Anmälan om en tjänst som inte är lanserad skrivs om till
-- standardtjänsten. Fältet är det enda affärsfält en besökare kan
-- välja, och Fas 7 skriver in det på uppdraget.
select pg_temp.bli(null);
insert into public.leads (parent_name, email, subject, tjanst)
values ('Prov tjänst', 'prov-tjanst7@example.invalid', 'Matte', 'barnvakt');
reset role;

insert into utfall (test, ok, detalj)
select '7.4 anmälan om inaktiv tjänst skrivs om till standardtjänsten',
       count(*) = 1, 'tjänst: ' || coalesce(string_agg(tjanst, ','), 'ingen rad')
from public.leads
where email = 'prov-tjanst7@example.invalid' and tjanst = public.standard_tjanst();

-- ============================================================
-- FAS 8 — AI-lagret
--
-- Det viktigaste provet här är inte att en policy nekar, utan att
-- ROLLEN inte kan något: nextrum_ai har inga tabellrättigheter alls,
-- och det är den garantin hela AI-lagret vilar på. En policy går att
-- lägga till av misstag; ett saknat grant gör att koden helt enkelt
-- inte fungerar.
-- ============================================================

select pg_temp.prova('8.2 anon läser förslagen', null,
  array[$q$select * from public.ai_forslag$q$], 'nekad');
select pg_temp.prova('8.2 familj läser förslagen', '00000000-0000-4000-8000-0000000000f1',
  array[$q$select * from public.ai_forslag$q$], 'nekad');
select pg_temp.prova('8.2 familj skriver ett förslag', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.ai_forslag (typ, nyckel) values ('matchning', 'prov:fusk:8')$q$], 'nekad');
select pg_temp.prova('8.5 familj öppnar AI-dörren', '00000000-0000-4000-8000-0000000000f1',
  array[$q$select public.ai_verktyg('nya_leads')$q$], 'nekad');
select pg_temp.prova('8.6 familj godkänner ett förslag', '00000000-0000-4000-8000-0000000000f1',
  array[$q$select public.godkann_forslag(gen_random_uuid())$q$], 'nekad');
select pg_temp.prova('8.3 familj läser matchningsförslag', '00000000-0000-4000-8000-0000000000f1',
  array[$q$select * from public.matchningsforslag('00000000-0000-4000-8000-0000000005a1')$q$], 'nekad');

-- Rollen själv. Provet BLIR rollen och prövar tre saker den inte ska
-- kunna. Svaren skrivs först efter reset role — rollen får inte
-- skriva ens i resultattabellen, vilket första versionen av det här
-- provet fick lära sig genom att fälla hela körningen på 42501.
-- Garantin gäller alltså också provet, och det är egentligen det
-- starkaste beviset som finns.
select set_config('request.jwt.claims', null, true);
do $$
declare
  skriva text := 'ingen';
  lasa   text := 'ingen';
  forslag text := 'ingen';
begin
  set local role nextrum_ai;

  begin
    update public.students set grade = 'hackad';
    skriva := 'INGEN SPÄRR';
  exception when others then skriva := sqlstate;
  end;

  begin
    perform 1 from public.students limit 1;
    lasa := 'INGEN SPÄRR';
  exception when others then lasa := sqlstate;
  end;

  begin
    insert into public.ai_forslag (typ, nyckel) values ('matchning', 'prov:roll:8');
    forslag := 'INGEN SPÄRR';
  exception when others then forslag := sqlstate;
  end;

  reset role;

  insert into utfall (test, ok, detalj) values
    ('8.5 rollen nextrum_ai kan inte skriva i students', skriva = '42501', 'fick ' || skriva),
    ('8.5 rollen nextrum_ai kan inte ens läsa students', lasa = '42501', 'fick ' || lasa),
    ('8.5 rollen nextrum_ai kan inte skriva förslag direkt', forslag = '42501', 'fick ' || forslag);
end $$;

-- Det AI:n föreslog ska vara det admin godkänner. Frysningen KASTAR
-- sedan 8.8 i stället för att rätta tyst: ett skydd som inte syns är
-- ett skydd nästa läsare inte vet om. Försöket ligger därför i ett
-- eget block, annars faller hela körningen på just det som ska hända.
do $$
declare fel text := 'ingen';
begin
  insert into public.ai_forslag (typ, nyckel, payload, motivering)
  values ('matchning', 'prov:frys:8',
          jsonb_build_object('elev_id', '00000000-0000-4000-8000-0000000005a1',
                             'studiehjalpare_id', '00000000-0000-4000-8000-0000000000a1'),
          'Ursprunglig motivering');

  begin
    update public.ai_forslag
       set typ = 'lead_status',
           payload = '{"lead_id":"00000000-0000-4000-8000-00000000000b","status":"matched"}'::jsonb,
           motivering = 'Utbytt',
           nyckel = 'prov:frys:8b'
     where nyckel = 'prov:frys:8';
    fel := 'SLÄPPTES IGENOM';
  exception when others then fel := sqlstate;
  end;

  insert into utfall (test, ok, detalj)
  values ('8.2 förslaget går inte att skriva om efter att det skapats', fel = '42501', 'fick ' || fel);

  insert into utfall (test, ok, detalj)
  select '8.2 förslaget står kvar oförändrat efter försöket',
         count(*) = 1, 'oförändrade rader: ' || count(*)
    from public.ai_forslag
   where nyckel = 'prov:frys:8' and typ = 'matchning' and motivering = 'Ursprunglig motivering';
end $$;

-- ============================================================
-- FAS 9 — det som var osant, och tidpunkterna som saknades
--
-- Fas 9 börjar med att rätta det som ljuger i dag. Två av raderna
-- nedan föll mot driften innan 9.1 och 9.2 kördes, och det var så
-- felet hittades: materialpolicyn jämförde elevens NAMN med mappens
-- uuid, så ingen förälder kunde se sitt barns material.
-- ============================================================

reset role;
select set_config('request.jwt.claims', null, true);

insert into storage.objects (bucket_id, name, owner) values
  ('material', '00000000-0000-4000-8000-0000000005a1/prov.pdf',
   '00000000-0000-4000-8000-0000000000a1');

select pg_temp.rakna('9.1 familjen ser sitt eget barns material', '00000000-0000-4000-8000-0000000000f1',
  $q$select count(*) from storage.objects
      where bucket_id = 'material' and name like '00000000-0000-4000-8000-0000000005a1/%'$q$, 1);

select pg_temp.rakna('9.1 annan familj ser inte materialet', '00000000-0000-4000-8000-0000000000f2',
  $q$select count(*) from storage.objects
      where bucket_id = 'material' and name like '00000000-0000-4000-8000-0000000005a1/%'$q$, 0);

select pg_temp.rakna('9.2 admin ser materialet', '00000000-0000-4000-8000-0000000000ad',
  $q$select count(*) from storage.objects
      where bucket_id = 'material' and name like '00000000-0000-4000-8000-0000000005a1/%'$q$, 1);

-- Adminvyn raderade raden i materials och lämnade filen kvar i
-- lagringen, eftersom admin inte fick ta bort den. Då blev filen
-- omöjlig att hitta men fanns kvar.
--
-- Själva DELETE går inte att prova härifrån: storage.objects bär en
-- SATSTRIGGER (protect_objects_delete) som vägrar all direkt radering
-- oavsett policy — vägen går genom Storage-API:et. Provet delas
-- därför i två: att policyn finns på DELETE, och att villkoret i den
-- är sant för admin och falskt för andra.
insert into utfall (test, ok, detalj)
select '9.2 det finns en DELETE-policy för admin på material',
       count(*) = 1, coalesce(string_agg(policyname, ', '), 'ingen')
from pg_policies
where schemaname = 'storage' and tablename = 'objects' and cmd = 'DELETE'
  and qual like '%is_admin()%' and qual like '%material%';

select pg_temp.rakna('9.2 admin uppfyller villkoret', '00000000-0000-4000-8000-0000000000ad',
  $q$select count(*) from storage.objects
      where bucket_id = 'material'
        and name = '00000000-0000-4000-8000-0000000005a1/prov.pdf'
        and public.is_admin()$q$, 1);

select pg_temp.rakna('9.2 studiehjälparen uppfyller inte adminvillkoret', '00000000-0000-4000-8000-0000000000a1',
  $q$select count(*) from storage.objects
      where bucket_id = 'material'
        and name = '00000000-0000-4000-8000-0000000005a1/prov.pdf'
        and public.is_admin()$q$, 0);

-- ---------- 9.3 auditen täcker det den påstår sig täcka ----------
-- 9.4 stämplarna: avbokad_at, avbokad_av och matchad_at
--
-- Provet går HELA vägen: familjen avbokar som familjen, och först
-- efter reset role läses auditloggen och stämplarna. En avbokning
-- som bara syns när postgres gör den bevisar ingenting.

reset role;
select set_config('request.jwt.claims', null, true);

do $$
declare
  fore_id   bigint;
  loggat    bigint;
  n_at      timestamptz;
  n_av      uuid;
  matchad   timestamptz;
  fore_om   timestamptz;
  efter_om  timestamptz;
  skal_fel  text := 'ingen';
begin
  select coalesce(max(id), 0) into fore_id from public.audit_logg;

  -- familjen avbokar sitt bekräftade pass om en vecka (med skäl,
  -- som Fas 15.2 kräver)
  perform pg_temp.bli('00000000-0000-4000-8000-0000000000f1');
  update public.bookings set status = 'cancelled', avbokningsskal = 'sjukdom'
   where id = '00000000-0000-4000-8000-00000000b0d1';
  reset role;
  perform set_config('request.jwt.claims', null, true);

  select count(*) into loggat from public.audit_logg
   where id > fore_id and handling = 'pass.status'
     and objekt_id = '00000000-0000-4000-8000-00000000b0d1';
  select avbokad_at, avbokad_av into n_at, n_av from public.bookings
   where id = '00000000-0000-4000-8000-00000000b0d1';

  insert into utfall (test, ok, detalj) values
    ('9.3 avbokningen hamnar i auditloggen', loggat = 1, 'rader: ' || loggat),
    ('9.4 avbokad_at sätts av databasen', n_at is not null, coalesce(n_at::text, 'null')),
    ('9.4 avbokad_av är den som avbokade',
     n_av = '00000000-0000-4000-8000-0000000000f1', coalesce(n_av::text, 'null'));

  -- okänd skälkod stoppas av CHECK, inte av en vänlig påminnelse i vyn
  begin
    update public.bookings set avbokningsskal = 'för att'
     where id = '00000000-0000-4000-8000-00000000b0d1';
  exception when others then skal_fel := sqlstate;
  end;
  insert into utfall (test, ok, detalj)
  values ('9.4 avbokningsskäl måste vara en känd kod', skal_fel = '23514', 'fick ' || skal_fel);

  -- matchad_at: en elev som matchas för första gången.
  -- Tidpunkten kan inte jämföras med en annan rads: now() är
  -- transaktionens starttid, så allt som sker här får samma klockslag.
  -- Provet sparar därför värdet före ommatchningen och jämför med sig
  -- självt.
  select matchad_at into fore_om from public.students
   where id = '00000000-0000-4000-8000-0000000005a1';

  perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
  update public.students
     set matched_tutor_id = '00000000-0000-4000-8000-0000000000a1', match_status = 'matched'
   where id = '00000000-0000-4000-8000-0000000005c1';
  -- och en ommatchning, som inte ska flytta tidpunkten
  update public.students set matched_tutor_id = '00000000-0000-4000-8000-0000000000b1'
   where id = '00000000-0000-4000-8000-0000000005a1';
  reset role;
  perform set_config('request.jwt.claims', null, true);

  select matchad_at into matchad from public.students
   where id = '00000000-0000-4000-8000-0000000005c1';
  select matchad_at into efter_om from public.students
   where id = '00000000-0000-4000-8000-0000000005a1';

  insert into utfall (test, ok, detalj) values
    ('9.4 matchad_at sätts vid första matchningen', matchad is not null, coalesce(matchad::text, 'null')),
    ('9.4 en ommatchning flyttar inte matchad_at',
     efter_om is not null and efter_om = fore_om,
     coalesce(fore_om::text, 'null') || ' → ' || coalesce(efter_om::text, 'null'));
end $$;

reset role;
select set_config('request.jwt.claims', null, true);

-- Sedan Fas 15.2 står avbokningsskal i vitlistan `fria`, men bara i
-- samma skrivning som avbokningen. Ett skäl på ett pass som gäller
-- nekas fortfarande.
select pg_temp.prova('9.4 familjen sätter avbokningsskäl på ett bokat pass', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set avbokningsskal = 'sjukdom'
           where id = '00000000-0000-4000-8000-00000000b0c1'$q$], 'nekad');

-- Samma svep: det är precis så vyerna avbokar sedan Fas 15.2.
select pg_temp.prova('15.2 familjen avbokar och sätter skäl i samma svep', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set status = 'cancelled', avbokningsskal = 'sjukdom'
           where id = '00000000-0000-4000-8000-00000000b0c1'$q$], 'ok');

select pg_temp.prova('9.4 studiehjälparen sätter avbokningsskäl', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set avbokningsskal = 'forhinder'
           where id = '00000000-0000-4000-8000-00000000b0c1'$q$], 'nekad');

select pg_temp.prova('9.4 admin sätter avbokningsskäl på ett avbokat pass', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.bookings set avbokningsskal = 'ingen_hjalpare'
           where id = '00000000-0000-4000-8000-00000000b0b1'$q$], 'ok');

-- Familjen får fortfarande avboka. Ett skydd som råkar låsa det
-- legitima flödet är ett fel, inte en extra försiktighet.
-- b0c1, inte b0d1: do-blocket ovan avbokade b0d1 på riktigt (det
-- rullas inte tillbaka), och ett avbokat pass går inte att ändra.
select pg_temp.prova('9.4 familjen kan fortfarande avboka', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set status = 'cancelled', avbokningsskal = 'annat'
           where id = '00000000-0000-4000-8000-00000000b0c1'$q$], 'ok');

select pg_temp.rakna('9.3 icke-admin läser fortfarande 0 auditrader', '00000000-0000-4000-8000-0000000000f1',
  $q$select count(*) from public.audit_logg$q$, 0);

-- ---------- 9.7 ett pass utan längd ----------
-- Hålet var att null < 60 är null, inte sant: villkoret var falskt
-- och passet gick igenom utan längd. Faktureringen räknade sedan
-- en timme på det, eftersom pris.ts säger duration_min || 60.

select pg_temp.prova('9.7 P bokar ett pass utan längd', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by,
                                        wanted_date, wanted_time, status)
           values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                   '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1',
                   (now() at time zone 'Europe/Stockholm')::date + 4, '15:00', 'requested')$q$],
  'nekad');

insert into utfall (test, ok, detalj)
select '9.7 duration_min går inte att lämna tom i schemat heller',
       is_nullable = 'NO', 'is_nullable = ' || is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'bookings' and column_name = 'duration_min';

-- ---------- 9.5 anmälans källa ----------
-- Källan skrivs av en anonym besökare ur adressraden. Provet gör
-- alltså det den gör: blir anon och postar mot det öppna API:et.

do $$
declare
  r   public.leads%rowtype;
  fel text := 'ingen';
  nu  text;
begin
  perform pg_temp.bli(null);
  begin
    insert into public.leads (parent_name, email, message, tjanst,
                              kalla, medium, kampanj, annonsvariant,
                              hanvisare, landningssida)
    values ('Prov Förälder', 'rls-kalla@example.invalid', 'provtext', 'laxhjalp',
            'google', 'cpc', repeat('x', 400), '',
            'instagram.com', '/laxhjalp-farsta?utm_source=google');
  exception when others then fel := sqlstate || ': ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', null, true);

  if fel <> 'ingen' then
    insert into utfall (test, ok, detalj) values ('9.5 anon kan skriva källfälten', false, fel);
  else
    select * into r from public.leads where email = 'rls-kalla@example.invalid';
    insert into utfall (test, ok, detalj) values
      ('9.5 anon kan skriva källfälten', r.kalla = 'google' and r.medium = 'cpc',
       coalesce(r.kalla, 'null') || ' / ' || coalesce(r.medium, 'null')),
      ('9.5 kampanjen kapas vid 120 tecken', length(r.kampanj) = 120,
       coalesce(length(r.kampanj)::text, 'null')),
      ('9.5 tom sträng blir null, inte en egen kanal', r.annonsvariant is null,
       coalesce(r.annonsvariant, 'null')),
      ('9.5 statusen sätts fortfarande av triggern', r.status = 'new', coalesce(r.status, 'null'));

    -- Källan är en uppgift om besöket. Den kan bara bli annorlunda i
    -- efterhand, aldrig sannare.
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000f1');
    begin
      update public.leads set kalla = 'omskriven' where email = 'rls-kalla@example.invalid';
    exception when others then null;
    end;
    reset role;
    perform set_config('request.jwt.claims', null, true);
    select kalla into nu from public.leads where email = 'rls-kalla@example.invalid';
    insert into utfall (test, ok, detalj)
    values ('9.5 källan går inte att skriva om i efterhand', nu = 'google', coalesce(nu, 'null'));
  end if;
end $$;

reset role;
select set_config('request.jwt.claims', null, true);

-- Källfälten formuleras av en främling i adressraden. Auditloggen går
-- inte att rätta, så de får aldrig stå i dess vitlista.
insert into utfall (test, ok, detalj)
select '9.5 auditen bär inte källfälten', count(*) = 0,
       coalesce(string_agg(x, ', '), 'inga')
from (
  select btrim(btrim(a), '''') as x
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid,
  lateral unnest(string_to_array(
            rtrim(split_part(pg_get_triggerdef(t.oid), 'logga_andring(', 2), ')'), ', ')) as u3(a)
  where n.nspname = 'public' and not t.tgisinternal
    and c.relname = 'leads' and p.proname = 'logga_andring'
) v
where x in ('kalla', 'medium', 'kampanj', 'annonsvariant', 'sokord', 'hanvisare', 'landningssida');

-- ---------- 9.8 sökningen i auditloggen ----------
-- Det viktiga är inte att filtret fungerar, utan att TOTALEN gör
-- det: förut hämtades 300 rader och räknades i webbläsaren, så
-- antalet blev antalet träffar BLAND de 300 senaste.

-- anon får inte ens anropa funktionen: execute är återkallat. Därför
-- prova och inte rakna — svaret är ett fel, inte en tom lista.
select pg_temp.prova('9.8 anon söker i auditloggen', null,
  array[$q$select * from public.audit_sok()$q$], 'nekad');
-- Familjen FÅR anropa den, och får noll rader. Det är policyn som
-- svarar, inte en gömd knapp.
select pg_temp.rakna('9.8 familjen söker i auditloggen', '00000000-0000-4000-8000-0000000000f1',
  $q$select count(*) from public.audit_sok()$q$, 0);

do $$
declare
  b        uuid;
  i        int;
  rader    bigint;
  totalt   bigint;
  typrader bigint;
begin
  -- 12 rader som admin, genom att ändra närvaron fram och tillbaka
  perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
  b := '00000000-0000-4000-8000-00000000b0c1';
  for i in 1..12 loop
    update public.bookings
       set attendance = case when i % 2 = 0 then 'narvarande' else 'sen' end
     where id = b;
  end loop;

  select count(*), max(a.totalt) into rader, totalt
    from public.audit_sok(null, null, null, null, false, 5) a;
  -- Fixturerna skapar fakturor, så det FINNS fakturarader. Provet är
  -- därför att filtret inte släpper igenom något annat, inte att
  -- listan är tom.
  select count(*) into typrader
    from public.audit_sok('faktura', null, null, null, false, 50) a
   where a.objekt_typ <> 'faktura';
  reset role;
  perform set_config('request.jwt.claims', null, true);

  insert into utfall (test, ok, detalj) values
    ('9.8 limit ger en sida', rader = 5, 'rader: ' || rader),
    ('9.8 totalt räknar hela träffmängden, inte sidan', totalt >= 12,
     'totalt: ' || coalesce(totalt::text, 'null')),
    ('9.8 filtret på sort gäller i databasen', typrader = 0,
     'rader av fel sort: ' || typrader);
end $$;

reset role;
select set_config('request.jwt.claims', null, true);

insert into utfall (test, ok, detalj)
select '9.8 audit_sok är SECURITY INVOKER', not p.prosecdef,
       case when p.prosecdef then 'DEFINER — går förbi policyn' else 'INVOKER' end
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'audit_sok';

insert into utfall (test, ok, detalj)
select '9.8 objekt_typ är genererad, inte skriven', a.is_generated = 'ALWAYS',
       'is_generated = ' || a.is_generated
from information_schema.columns a
where a.table_schema = 'public' and a.table_name = 'audit_logg' and a.column_name = 'objekt_typ';

-- ---------- 9.9 drift-agentens nya verktyg ----------
-- Analysvyerna har security_invoker, och rollen nextrum_ai har inga
-- tabellrättigheter. Utan omslag svarar de permission denied, inte
-- tom lista — och en agent som får "inga avvikelser" när den egentligen
-- nekades är värre än en som får ett fel.

select set_config('request.jwt.claims', null, true);
do $$
declare
  fel_a  text := 'ingen';
  fel_b  text := 'ingen';
  fel_vy text := 'INGEN SPÄRR';
begin
  set local role nextrum_ai;
  begin
    perform 1 from public.ai_analys(6);
  exception when others then fel_a := sqlstate;
  end;
  begin
    perform 1 from public.ai_avvikelser();
  exception when others then fel_b := sqlstate;
  end;
  begin
    perform 1 from public.analys_leads_per_kalla limit 1;
  exception when others then fel_vy := sqlstate;
  end;
  reset role;

  insert into utfall (test, ok, detalj) values
    ('9.9 rollen nextrum_ai kan köra ai_analys', fel_a = 'ingen', 'fick ' || fel_a),
    ('9.9 rollen nextrum_ai kan köra ai_avvikelser', fel_b = 'ingen', 'fick ' || fel_b),
    ('9.9 rollen når inte analysvyn direkt', fel_vy = '42501', 'fick ' || fel_vy);
end $$;

reset role;
select set_config('request.jwt.claims', null, true);

-- Omslagen lämnar ut en FAST kolumnlista. Provet läser den ur
-- katalogen, så ett nytt fält måste passera här.
insert into utfall (test, ok, detalj)
select '9.9 ai_analys lämnar inga namn- eller textfält', count(*) = 0,
       coalesce(string_agg(x, ', '), 'inga')
from (
  select btrim(split_part(btrim(k), ' ', 1)) as x
  from unnest(string_to_array(
         btrim(replace(pg_get_function_result(
           to_regprocedure('public.ai_analys(integer)')), 'TABLE(', ''), ')'), ',')) k
) f
where x ~ '(name|namn|email|epost|kalla|kampanj|medium|sokord|hanvisare|landning|message|meddelande|titel|anteckning)';

insert into utfall (test, ok, detalj)
select '9.9 ai_avvikelser lämnar inga namn- eller textfält', count(*) = 0,
       coalesce(string_agg(x, ', '), 'inga')
from (
  select btrim(split_part(btrim(k), ' ', 1)) as x
  from unnest(string_to_array(
         btrim(replace(pg_get_function_result(
           to_regprocedure('public.ai_avvikelser()')), 'TABLE(', ''), ')'), ',')) k
) f
where x ~ '(name|namn|email|epost|message|meddelande|titel|anteckning)';

insert into utfall (test, ok, detalj)
select '9.9 AI-omslagen är inte anropbara för inloggade: ' || f,
       coalesce(not has_function_privilege('authenticated', to_regprocedure(f), 'execute')
            and not has_function_privilege('anon', to_regprocedure(f), 'execute'), false),
       case when to_regprocedure(f) is null then 'funktionen finns inte' else 'anon/authenticated execute' end
from unnest(array['public.ai_analys(integer)', 'public.ai_avvikelser()']) f;

insert into utfall (test, ok, detalj)
select '9.9 dörren ai_verktyg ägs fortfarande av nextrum_ai',
       pg_get_userbyid(p.proowner) = 'nextrum_ai',
       'ägare: ' || pg_get_userbyid(p.proowner)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'ai_verktyg';

-- ---------- 9.10 handlingar och hinken dokument ----------
-- Hinken är admin ensam. Undervisningsmaterial hör INTE hit: det har
-- en egen hink vars policyer släpper in familjen, och en provräkning
-- som hamnar här blir osynlig för dem den gäller.

insert into public.handlingar (id, typ, titel, kopplad_tabell, kopplad_id, uppladdad_av)
values ('00000000-0000-4000-8000-00000000d0c1', 'avtal', 'Provavtal',
        'profiles', '00000000-0000-4000-8000-0000000000a1',
        '00000000-0000-4000-8000-0000000000ad');

select pg_temp.rakna('9.10 admin ser handlingen', '00000000-0000-4000-8000-0000000000ad',
  $q$select count(*) from public.handlingar
      where id = '00000000-0000-4000-8000-00000000d0c1'$q$, 1);
select pg_temp.rakna('9.10 familjen ser 0 handlingar', '00000000-0000-4000-8000-0000000000f1',
  $q$select count(*) from public.handlingar$q$, 0);
select pg_temp.rakna('9.10 studiehjälparen ser 0 handlingar', '00000000-0000-4000-8000-0000000000a1',
  $q$select count(*) from public.handlingar$q$, 0);
select pg_temp.rakna('9.10 anon ser 0 handlingar', null,
  $q$select count(*) from public.handlingar$q$, 0);

select pg_temp.prova('9.10 familjen skriver en handling', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.handlingar (typ, titel) values ('avtal', 'Fusk')$q$], 'nekad');

-- Sökvägen ÄR handlingens id. En fil utan rad är en fil ingen hittar
-- och ingen kan städa — samma fel som 9.2 rättade i materiallistan.
select pg_temp.prova('9.10 admin lägger en fil utan handling', '00000000-0000-4000-8000-0000000000ad',
  array[$q$insert into storage.objects (bucket_id, name, owner)
           values ('dokument', '00000000-0000-4000-8000-00000000dead/los.pdf',
                   '00000000-0000-4000-8000-0000000000ad')$q$], 'nekad');

select pg_temp.prova('9.10 admin lägger en fil under handlingens id', '00000000-0000-4000-8000-0000000000ad',
  array[$q$insert into storage.objects (bucket_id, name, owner)
           values ('dokument', '00000000-0000-4000-8000-00000000d0c1/avtal.pdf',
                   '00000000-0000-4000-8000-0000000000ad')$q$], 'ok');

insert into utfall (test, ok, detalj)
select '9.10 hinken dokument är privat', not b.public, 'public = ' || b.public
from storage.buckets b where b.id = 'dokument';

-- Auditloggens vitlistor får bara nämna kolumner som finns. En
-- felstavad kolumn i tg_argv ger inget fel — den loggar bara
-- ingenting, för alltid, tyst.
insert into utfall (test, ok, detalj)
with vitlista as (
  select c.relname as tabell, btrim(btrim(x), '''') as kolumn
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid,
  lateral unnest(string_to_array(
            rtrim(split_part(pg_get_triggerdef(t.oid), 'logga_andring(', 2), ')'), ', '))
          with ordinality as u(x, ord)
  where n.nspname = 'public' and not t.tgisinternal
    and p.proname = 'logga_andring' and u.ord > 1
)
select '9.3 auditens vitlistor nämner bara kolumner som finns',
       count(*) filter (where c.column_name is null) = 0,
       coalesce(string_agg(v.tabell || '.' || v.kolumn, ', ')
                filter (where c.column_name is null), 'alla ' || count(*) || ' finns')
from vitlista v
left join information_schema.columns c
  on c.table_schema = 'public' and c.table_name = v.tabell and c.column_name = v.kolumn;

-- Auditloggen får aldrig bära namn, adress eller fritext. Den går
-- inte att rätta i efterhand, så en vitlista med ett sådant fält är
-- ett läckage utan slut.
insert into utfall (test, ok, detalj)
with vitlista as (
  select c.relname as tabell, btrim(btrim(x), '''') as kolumn
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid,
  lateral unnest(string_to_array(
            rtrim(split_part(pg_get_triggerdef(t.oid), 'logga_andring(', 2), ')'), ', '))
          with ordinality as u(x, ord)
  where n.nspname = 'public' and not t.tgisinternal
    and p.proname = 'logga_andring' and u.ord > 1
)
select '9.3 ingen vitlista bär namn, adress eller fritext',
       count(*) = 0, coalesce(string_agg(tabell || '.' || kolumn, ', '), 'inga')
from vitlista
where kolumn ~ '(name|namn|email|epost|message|meddelande|summary|note|anteckning|adress|location|stack|beskrivning|motivering)';

-- ============================================================
-- FAS 10 — en tjänst kan aktiveras kontrollerat
--
-- Provet skrevs FÖRE migrationen och kördes då: de fyra raderna om
-- "nekas" gick igenom, alltså var spärren obyggd. Ett prov som
-- skrivs efter migrationen bevisar bara att koden gör det koden gör.
--
-- DE TVÅ VIKTIGASTE RADERNA ÄR INTE DE SOM NEKAR. Det är de två som
-- ska gå igenom: läxhjälp är aktiv i drift MED ersattning = null och
-- krav = '{}', och ett ovillkorligt krav på de fälten hade gjort
-- 379-kronorsraden omöjlig att spara. Den fällan kostar ingenting att
-- gå i och allt att upptäcka i efterhand.
-- ============================================================

-- Fixtur: en tjänst att leka med, så att provet aldrig rör de fyra
-- riktiga raderna. Läggs som postgres, där skydden släpper igenom.
insert into public.tjanster (kod, namn, kort, ordning, aktiv, for_kund, for_jobb,
                             pris_per_timme_ore, extra_personer_ore, extra_personer_max)
values ('provtjanst', 'Provtjänst', 'Finns bara i provet.', 900, false, true, true,
        null, null, 1);

select pg_temp.prova('10.1 admin aktiverar en kundtjänst utan pris', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.tjanster set aktiv = true where kod = 'provtjanst'$q$], 'nekad');

select pg_temp.prova('10.1 admin aktiverar en kundtjänst MED pris', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.tjanster set pris_per_timme_ore = 45000, aktiv = true
           where kod = 'provtjanst'$q$], 'ok');

-- Adminvyn skickar aktiv OCH fälten i EN update. Kan den vägen inte
-- gå är spärren värdelös: då finns ingen väg alls att aktivera.
select pg_temp.prova('10.1 pris och kryss i samma spara går igenom', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.tjanster
            set pris_per_timme_ore = 45000, extra_personer_ore = 5000,
                extra_personer_max = 2, aktiv = true
          where kod = 'provtjanst'$q$], 'ok');

select pg_temp.prova('10.1 flerbarnstillägg utan belopp nekas', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.tjanster
            set pris_per_timme_ore = 45000, extra_personer_max = 3, aktiv = true
          where kod = 'provtjanst'$q$], 'nekad');

-- forsaljning har for_kund = false: den säljs inte, den söks till.
-- Ett ovillkorligt krav på kundpris hade gjort den omöjlig att lansera.
select pg_temp.prova('10.1 en ren jobbtjänst aktiveras utan kundpris', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.tjanster set aktiv = true where kod = 'forsaljning'$q$], 'ok');

select pg_temp.prova('10.1 varken kund eller jobb går inte att aktivera', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.tjanster
            set for_kund = false, for_jobb = false, pris_per_timme_ore = 45000, aktiv = true
          where kod = 'provtjanst'$q$], 'nekad');

-- ---------- fällan: läxhjälp ----------
-- Aktiv i drift med ersattning = null och krav = '{}'. Går de här två
-- sönder är triggern skriven som ett förbud i stället för som en grind.
select pg_temp.prova('10.1 läxhjälp går att spara oförändrad', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.tjanster set uppdaterad = now() where kod = 'laxhjalp'$q$], 'ok');

select pg_temp.prova('10.1 läxhjälp går att prisändra trots ersattning = null', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.tjanster set pris_per_timme_ore = 38900 where kod = 'laxhjalp'$q$], 'ok');

-- En aktiv tjänst får inte tömmas på det som gör fakturan rätt.
select pg_temp.prova('10.1 priset går inte att tömma på en aktiv tjänst', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.tjanster set pris_per_timme_ore = null where kod = 'laxhjalp'$q$], 'nekad');

-- Avstängning ska alltid gå. Den är nödbromsen.
select pg_temp.prova('10.1 en tjänst går alltid att stänga av', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.tjanster set aktiv = false where kod = 'laxhjalp'$q$], 'ok');

-- ---------- 10.4 olanserade tjänster syns inte ----------
-- Kravet är "osynliga också via API:t", inte "osynliga i gränssnittet".

select pg_temp.rakna('10.4 anon ser bara aktiva tjänster', null,
  $q$select count(*) from public.tjanster where not aktiv$q$, 0);

-- tjanstkoder_finns svarade true för barnvakt åt vem som helst. Det är
-- ett orakel: man behöver inte läsa tabellen för att få koden bekräftad.
--
-- Lagningen är INTE en revoke. Det provades, och det slog sönder hela
-- ansökningsvägen: ett CHECK-villkor körs som ANROPAREN, inte som
-- tabellägaren, så anon fick permission denied så fort en rad skrevs.
-- Funktionen flyttades i stället till schemat `intern`, som PostgREST
-- inte exponerar. Därför prövas frånvaron ur public, inte en felkod.
insert into utfall (test, ok, detalj)
select '10.4 oraklet finns inte i det exponerade schemat', count(*) = 0,
       count(*) || ' funktioner som heter tjanstkoder_finns i public'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'tjanstkoder_finns';

insert into utfall (test, ok, detalj)
select '10.4 oraklet finns kvar i intern, där villkoren når det', count(*) = 1,
       count(*) || ' i intern'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'intern' and p.proname = 'tjanstkoder_finns';

-- Och villkoret måste fortfarande neka en kod som inte finns alls.
-- Utan den raden kunde flytten ha tystat villkoret i stället för att
-- flytta det. `prova` duger inte här: den räknar bara 42501 som nekad,
-- och ett CHECK-villkor ger 23514.
do $$
declare fel text := 'SLÄPPTES IGENOM';
begin
  perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
  begin
    insert into public.applications (name, email, tjanster)
    values ('Prov', 'rls-fejk@example.invalid', array['finns_inte_alls']);
  exception when others then fel := sqlstate;
  end;
  reset role;
  perform set_config('request.jwt.claims', null, true);
  insert into utfall (test, ok, detalj)
  values ('10.4 en ansökan på en påhittad kod nekas av villkoret', fel = '23514', 'fick ' || fel);
end $$;

reset role;
select set_config('request.jwt.claims', null, true);

-- Hålet som Fas 7.4 stängde för leads stod öppet för applications:
-- en anonym POST kunde lägga en ansökan på en olanserad tjänst.
--
-- Provet MÅSTE skriva som anon och läsa som admin. Första versionen
-- gjorde båda som anon och blev grön av fel skäl: anon får inte läsa
-- applications, så noll rader betydde "ingen läsrätt", inte "ingen
-- rad". Ett prov som är grönt för att det inte kan se är värre än
-- inget prov.
do $$
declare kvar bigint; fel text := 'ingen';
begin
  perform pg_temp.bli(null);
  begin
    insert into public.applications (name, email, tjanster)
    values ('Provsökande', 'rls-ans@example.invalid', array['barnvakt']);
  exception when others then fel := sqlstate;
  end;
  perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
  select count(*) into kvar from public.applications
   where email = 'rls-ans@example.invalid' and 'barnvakt' = any (tjanster);
  reset role;
  perform set_config('request.jwt.claims', null, true);

  insert into utfall (test, ok, detalj)
  values ('10.4 anons ansökan hamnar inte på en olanserad tjänst', kvar = 0,
          'rader med barnvakt: ' || kvar || ' (insert: ' || fel || ')');
end $$;

reset role;
select set_config('request.jwt.claims', null, true);

reset role;
select set_config('request.jwt.claims', null, true);

-- to_regprocedure ger null för en funktion som inte finns, så att
-- filen går att köra även före migrationerna (raden blir då röd).
insert into utfall (test, ok, detalj)
select 'Triggerfunktion ej anropbar: ' || f,
       coalesce(not has_function_privilege('anon', to_regprocedure(f), 'execute')
            and not has_function_privilege('authenticated', to_regprocedure(f), 'execute'), false),
       case when to_regprocedure(f) is null then 'funktionen finns inte' else 'anon/authenticated execute' end
from unnest(array[
  'public.rakna_rabattkod()', 'public.skydda_elevradering()', 'public.skydda_rabatt()',
  'public.synka_laxhjalpspris()', 'public.skydda_bokningsfalt()',
  'public.rapport_gor_passet_genomfort()',
  'public.skydda_studentfalt()', 'public.las_fakturabelopp()',
  'intern.progress_steg_och_niva()', 'intern.progress_historik_skriv()',
  'public.elevens_uppdrag()', 'public.stada_elevens_uppdrag()', 'public.koppla_passets_uppdrag()',
  'public.standard_tjanst()', 'public.personnummer_ok(text)',
  'public.logga_andring()', 'public.uppgift_stampel()', 'public.skydda_leadfalt()',
  'public.skapa_uppgift(text, text, text, text, text, text, date, text)',
  'public.avvikelser_rader()', 'public.dagliga_kontroller()',
  'public.kontroll_saknade_rapporter(integer)', 'public.kontroll_ekonomiska_avvikelser()',
  'public.paminnelse_forfallna_fakturor()',
  'public.uppfoljning_leads_och_ansokningar(integer, integer)',
  'public.ai_nya_leads(integer)', 'public.ai_omatchade_elever()',
  'public.ai_kommande_pass(integer)', 'public.ai_saknade_rapporter(integer)',
  'public.ai_skapa_forslag(text, text, jsonb, text, uuid, text, text)',
  'public.matchningsforslag_rader(uuid)', 'public.ai_finns(text, uuid)',
  'public.frys_forslaget()', 'public.ai_taket_racker()',
  'public.matchningspoang(text[], text, text[], text[], integer, integer, jsonb)',
  'public.stampla_matchningen()', 'public.stampla_avbokningen()',
  'public.ai_analys(integer)', 'public.ai_avvikelser()'
]) f;

insert into utfall (test, ok, detalj)
select 'RPC som gränssnittet använder är kvar: ' || f,
       coalesce(has_function_privilege('authenticated', to_regprocedure(f), 'execute'), false),
       case when to_regprocedure(f) is null then 'funktionen finns inte' else 'authenticated execute' end
from unnest(array[
  'public.kolla_rabattkod(text, text, bigint)', 'public.publika_studiehjalpare()',
  'public.spara_skatteuppgifter(uuid, text, text, text, text)',
  'public.las_skatteuppgifter(uuid)', 'public.radera_skatteuppgifter(uuid)',
  'public.ekonomiska_avvikelser()', 'public.kor_kontrollerna()',
  'public.ai_verktyg(text, jsonb)', 'public.godkann_forslag(uuid)',
  'public.avvisa_forslag(uuid, text)', 'public.matchningsforslag(uuid)',
  'public.audit_sok(text, uuid, date, date, boolean, integer, integer)'
]) f;

insert into utfall (test, ok, detalj)
select 'Skattefunktion ej anropbar för anon: ' || f,
       coalesce(not has_function_privilege('anon', to_regprocedure(f), 'execute'), false),
       case when to_regprocedure(f) is null then 'funktionen finns inte' else 'anon execute' end
from unnest(array[
  'public.spara_skatteuppgifter(uuid, text, text, text, text)',
  'public.las_skatteuppgifter(uuid)', 'public.radera_skatteuppgifter(uuid)',
  'public.ekonomiska_avvikelser()', 'public.kor_kontrollerna()',
  'public.ai_verktyg(text, jsonb)', 'public.godkann_forslag(uuid)',
  'public.avvisa_forslag(uuid, text)'
]) f;

-- ------------------------------------------------------------
-- MATERIALBIBLIOTEKET (Fas 13.2)
--
-- Biblioteket är KURERAT. Studiehjälparen läser, admin skriver, och
-- ingen annan ser något. Går den gränsen sönder är det inte en
-- läcka av personuppgifter men det är slutet på urvalet: ett
-- bibliotek vem som helst fyller på är en hög filer.
--
-- Familjen ska däremot se det material en läxa bygger på. En läxa
-- vars material ger tomt svar är en läxa som inte går att göra, och
-- en policy som nekar för mycket ser ut som en tom lista.
-- ------------------------------------------------------------

insert into public.biblioteksmaterial (id, titel, amne, arskurs, lank, beskrivning, delad, skapad_av) values
  ('00000000-0000-4000-8000-0000000000e1', 'RLS aktivt material', 'Matematik', 'ak7',
   'https://exempel.invalid/a', 'Aktivt', true, '00000000-0000-4000-8000-0000000000ad'),
  ('00000000-0000-4000-8000-0000000000e2', 'RLS avstängt material', 'Matematik', 'ak7',
   'https://exempel.invalid/b', 'Avstängt', true, '00000000-0000-4000-8000-0000000000ad'),
  -- Fas 13.3: studiehjälparens eget. Bara A ser det, bara A ändrar det.
  ('00000000-0000-4000-8000-0000000000e3', 'RLS A:s eget material', 'Svenska', 'ak5',
   'https://exempel.invalid/c', 'Eget', false, '00000000-0000-4000-8000-0000000000a1');

update public.biblioteksmaterial set aktiv = false
where id = '00000000-0000-4000-8000-0000000000e2';

-- Familj P:s äldsta barn får en läxa som pekar på det AVSTÄNGDA
-- materialet. Med flit: en läxa som redan är given ska inte tappa
-- sitt material för att biblioteket städats.
insert into public.homework (id, student_id, tutor_id, title, bibliotek_id) values
  ('00000000-0000-4000-8000-0000000000e9',
   '00000000-0000-4000-8000-0000000005a1',
   '00000000-0000-4000-8000-0000000000a1',
   'RLS läxa med material',
   '00000000-0000-4000-8000-0000000000e2');

select pg_temp.rakna('BIB-1 godkänd studiehjälpare ser aktivt material, inte avstängt',
  '00000000-0000-4000-8000-0000000000a1',
  'select count(*) from public.biblioteksmaterial where titel like ''RLS %''', 2);

select pg_temp.rakna('BIB-2 admin ser allt',
  '00000000-0000-4000-8000-0000000000ad',
  'select count(*) from public.biblioteksmaterial where titel like ''RLS %''', 3);

select pg_temp.rakna('BIB-3 anon ser ingenting',
  null,
  'select count(*) from public.biblioteksmaterial where titel like ''RLS %''', 0);

-- Familj P når det avstängda materialet, för deras barn har läxan.
select pg_temp.rakna('BIB-4 familj når materialet sin läxa bygger på, även avstängt',
  '00000000-0000-4000-8000-0000000000f1',
  'select count(*) from public.biblioteksmaterial where id = ''00000000-0000-4000-8000-0000000000e2''', 1);

-- Familj Q har ingen sådan läxa.
select pg_temp.rakna('BIB-5 annan familj når det inte',
  '00000000-0000-4000-8000-0000000000f2',
  'select count(*) from public.biblioteksmaterial where titel like ''RLS %''', 0);

select pg_temp.prova('BIB-6 studiehjälpare kan inte lägga till i BANKEN',
  '00000000-0000-4000-8000-0000000000a1',
  array['insert into public.biblioteksmaterial (titel, amne, arskurs, lank, delad, skapad_av)
         values (''Smyg'', ''Matematik'', ''ak7'', ''https://exempel.invalid/d'', true,
                 ''00000000-0000-4000-8000-0000000000a1'')'],
  'nekad');

select pg_temp.prova('BIB-7 studiehjälpare kan inte ändra i banken',
  '00000000-0000-4000-8000-0000000000a1',
  array['update public.biblioteksmaterial set titel = ''Kapad''
         where id = ''00000000-0000-4000-8000-0000000000e1'''],
  'nekad');

select pg_temp.prova('BIB-8 familj kan inte lägga till i biblioteket',
  '00000000-0000-4000-8000-0000000000f1',
  array['insert into public.biblioteksmaterial (titel, amne, arskurs, lank)
         values (''Smyg'', ''Matematik'', ''ak7'', ''https://exempel.invalid/e'')'],
  'nekad');

-- ---- Fas 13.3: delningen ----
-- `delad` skiljer Nextrums bank från studiehjälparens eget. Går den
-- att slå på nerifrån är kureringen en artighet, inte en regel.

select pg_temp.rakna('BIB-13 en annan studiehjälpare ser inte A:s eget',
  '00000000-0000-4000-8000-0000000000b1',
  'select count(*) from public.biblioteksmaterial where titel like ''RLS %''', 1);

select pg_temp.prova('BIB-14 studiehjälpare lägger till EGET material',
  '00000000-0000-4000-8000-0000000000a1',
  array['insert into public.biblioteksmaterial (titel, amne, arskurs, lank, delad, skapad_av)
         values (''Nytt eget'', ''Svenska'', ''ak5'', ''https://exempel.invalid/f'', false,
                 ''00000000-0000-4000-8000-0000000000a1'')'],
  'ok');

select pg_temp.prova('BIB-15 studiehjälpare kan inte skriva i någon annans namn',
  '00000000-0000-4000-8000-0000000000a1',
  array['insert into public.biblioteksmaterial (titel, amne, arskurs, lank, delad, skapad_av)
         values (''I B:s namn'', ''Svenska'', ''ak5'', ''https://exempel.invalid/g'', false,
                 ''00000000-0000-4000-8000-0000000000b1'')'],
  'nekad');

select pg_temp.prova('BIB-16 studiehjälpare kan INTE lyfta sitt eget in i banken',
  '00000000-0000-4000-8000-0000000000a1',
  array['update public.biblioteksmaterial set delad = true
         where id = ''00000000-0000-4000-8000-0000000000e3'''],
  'nekad');

select pg_temp.prova('BIB-17 studiehjälpare ändrar sitt egets rubrik',
  '00000000-0000-4000-8000-0000000000a1',
  array['update public.biblioteksmaterial set titel = ''RLS A:s eget, ändrad''
         where id = ''00000000-0000-4000-8000-0000000000e3'''],
  'ok');

select pg_temp.prova('BIB-18 en annan studiehjälpare kan inte ta bort A:s eget',
  '00000000-0000-4000-8000-0000000000b1',
  array['delete from public.biblioteksmaterial where id = ''00000000-0000-4000-8000-0000000000e3'''],
  'nekad');

select pg_temp.prova('BIB-19 admin lyfter in ett eget i banken',
  '00000000-0000-4000-8000-0000000000ad',
  array['update public.biblioteksmaterial set delad = true
         where id = ''00000000-0000-4000-8000-0000000000e3'''],
  'ok');

select pg_temp.prova('BIB-9 admin lägger till',
  '00000000-0000-4000-8000-0000000000ad',
  array['insert into public.biblioteksmaterial (titel, amne, arskurs, lank)
         values (''Adminmaterial'', ''Svenska'', ''gy2'', ''https://exempel.invalid/e'')'],
  'ok');

-- Predikatet. Raden löd fram till Fas 14.0b
--
--   select public.ar_godkand_studiehjalpare('…a1')
--      and not public.ar_godkand_studiehjalpare('…f1')
--
-- körd som den yttre rollen, alltså utan inloggad användare — och den
-- gick igenom, för funktionen svarade om vem som helst för vem som
-- helst. Det var precis felet: den saknade is_admins vakt. Nu prövas
-- den som varje roll för sig, vilket också är så den faktiskt
-- används (policyerna anropar den utan argument).
select pg_temp.rakna('BIB-10 hjälparen får svar om SIG SJÄLV',
  '00000000-0000-4000-8000-0000000000a1',
  $q$select count(*) from (select 1 where public.ar_godkand_studiehjalpare()) x$q$, 1);

select pg_temp.rakna('BIB-10b hjälparen får INTE svar om en annan hjälpare',
  '00000000-0000-4000-8000-0000000000a1',
  $q$select count(*) from (select 1 where
      public.ar_godkand_studiehjalpare('00000000-0000-4000-8000-0000000000b1')) x$q$, 0);

select pg_temp.rakna('BIB-10c admin får svar om vem som helst',
  '00000000-0000-4000-8000-0000000000ad',
  $q$select count(*) from (select 1 where
      public.ar_godkand_studiehjalpare('00000000-0000-4000-8000-0000000000a1')) x$q$, 1);

select pg_temp.rakna('BIB-10d familjen är inte en godkänd studiehjälpare',
  '00000000-0000-4000-8000-0000000000f1',
  $q$select count(*) from (select 1 where public.ar_godkand_studiehjalpare()) x$q$, 0);

-- Fram till Fas 14.0b svarade den här som anon true om en godkänd
-- hjälpare. Nu är EXECUTE återkallad, så anropet självt nekas.
select pg_temp.prova('BIB-10e anon får inte ens anropa predikatet',
  null,
  array[$q$select public.ar_godkand_studiehjalpare('00000000-0000-4000-8000-0000000000a1')$q$],
  'nekad');


-- Check-villkoren. En rad utan innehåll och en årskurs som är
-- fritext ska båda falla — det är de två sätt biblioteket annars
-- tyst hade tappat rader på.
do $$
declare klar boolean := false;
begin
  begin
    insert into public.biblioteksmaterial (titel, amne, arskurs)
    values ('Tom', 'Matematik', 'ak7');
  exception when check_violation then klar := true;
  end;
  insert into utfall (test, ok, detalj)
  values ('BIB-11 rad utan fil och länk nekas', klar,
          case when klar then 'check_violation' else 'gick igenom' end);
end $$;

do $$
declare klar boolean := false;
begin
  begin
    insert into public.biblioteksmaterial (titel, amne, arskurs, lank)
    values ('Fritext', 'Matematik', 'Åk 7', 'https://exempel.invalid/f');
  exception when check_violation then klar := true;
  end;
  insert into utfall (test, ok, detalj)
  values ('BIB-12 årskurs som fritext nekas', klar,
          case when klar then 'check_violation' else 'gick igenom' end);
end $$;

-- ------------------------------------------------------------
-- Fas 15.1: ingen bokning bekräftas av sig själv
-- ------------------------------------------------------------
-- Tisdag 15–19 finns som veckotid för B i fixturerna. Förut blev en
-- bokning inom den 'confirmed' direkt; nu är den ett förslag som
-- studiehjälparen svarar på.
reset role;
select set_config('request.jwt.claims', null, true);

do $$
declare
  dag   date := (now() at time zone 'Europe/Stockholm')::date + 8;
  nytt  uuid;
  lage  text;
begin
  while extract(isodow from dag) <> 3 loop dag := dag + 1; end loop;   -- en onsdag (weekday 2)
  perform pg_temp.bli('00000000-0000-4000-8000-0000000000f1');
  insert into public.bookings (parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status)
  values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000b1',
          '00000000-0000-4000-8000-0000000005b1', '00000000-0000-4000-8000-0000000000f1',
          dag, '16:00', 60, 'requested')
  returning id, status into nytt, lage;
  reset role;
  perform set_config('request.jwt.claims', null, true);
  insert into utfall (test, ok, detalj)
  values ('15.1 en bokning inom gamla veckotider blir ett förslag', lage = 'requested', 'fick ' || lage);
  delete from public.bookings where id = nytt;
exception when others then
  reset role;
  perform set_config('request.jwt.claims', null, true);
  insert into utfall (test, ok, detalj) values ('15.1 en bokning inom gamla veckotider blir ett förslag', false, sqlstate || ': ' || sqlerrm);
end $$;

insert into utfall (test, ok, detalj)
select '15.1 triggern bookings_tid_inom_schemat är borta', count(*) = 0, 'triggrar: ' || count(*)
  from pg_trigger where tgrelid = 'public.bookings'::regclass and tgname = 'bookings_tid_inom_schemat';

-- ------------------------------------------------------------
-- Fas 15.3: fem steg, mål och historik
-- ------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', null, true);

-- 9.4 ommatchade Äldst till B för att prova matchad_at, och det
-- rullas inte tillbaka. Utan återställningen är A inte längre elevens
-- studiehjälpare: A:s uppdateringar nedan träffar tyst noll rader
-- under RLS, och B ser historiken som B inte ska se. Det såg ut som
-- fyra fel i triggern och var ett i testordningen.
update public.students
   set matched_tutor_id = '00000000-0000-4000-8000-0000000000a1', match_status = 'matched'
 where id = '00000000-0000-4000-8000-0000000005a1';

insert into public.progress_items (id, student_id, tutor_id, subject, area, steg) values
  ('00000000-0000-4000-8000-0000000009a1', '00000000-0000-4000-8000-0000000005a1',
   '00000000-0000-4000-8000-0000000000a1', 'Matematik', 'Bråk', 2);

insert into utfall (test, ok, detalj)
select '15.3 level sätts ur steg vid insert', level = 'behover_trana', 'level ' || level
  from public.progress_items where id = '00000000-0000-4000-8000-0000000009a1';

insert into utfall (test, ok, detalj)
select '15.3 en rad historik vid insert', count(*) = 1, 'rader: ' || count(*)
  from public.progress_historik where progress_id = '00000000-0000-4000-8000-0000000009a1';

-- A flyttar steget som sig själv: level följer med och en rad till
-- läggs i historiken, med A som bedömare.
do $$
declare n bigint; niva text; av uuid;
begin
  perform pg_temp.bli('00000000-0000-4000-8000-0000000000a1');
  update public.progress_items set steg = 5, mal_steg = 5
   where id = '00000000-0000-4000-8000-0000000009a1';
  reset role;
  perform set_config('request.jwt.claims', null, true);
  select level into niva from public.progress_items where id = '00000000-0000-4000-8000-0000000009a1';
  select count(*) into n from public.progress_historik where progress_id = '00000000-0000-4000-8000-0000000009a1';
  select bedomd_av into av from public.progress_historik
   where progress_id = '00000000-0000-4000-8000-0000000009a1' and steg = 5;
  insert into utfall (test, ok, detalj) values
    ('15.3 level följer steg (5 → bra)', niva = 'bra', 'level ' || coalesce(niva, 'null')),
    ('15.3 ändrat steg ger en rad historik till', n = 2, 'rader: ' || n),
    ('15.3 historiken säger vem som bedömde', av = '00000000-0000-4000-8000-0000000000a1', coalesce(av::text, 'null'));

  -- En äldre klient som bara skriver level: steg följer med.
  perform pg_temp.bli('00000000-0000-4000-8000-0000000000a1');
  update public.progress_items set level = 'pa_god_vag'
   where id = '00000000-0000-4000-8000-0000000009a1';
  reset role;
  perform set_config('request.jwt.claims', null, true);
  select count(*) into n from public.progress_items
   where id = '00000000-0000-4000-8000-0000000009a1' and steg = 3 and level = 'pa_god_vag';
  insert into utfall (test, ok, detalj)
  values ('15.3 en äldre klient som skriver level flyttar steg', n = 1, 'träffar: ' || n);
exception when others then
  reset role;
  perform set_config('request.jwt.claims', null, true);
  insert into utfall (test, ok, detalj) values ('15.3 A flyttar steget', false, sqlstate || ': ' || sqlerrm);
end $$;

reset role;
select set_config('request.jwt.claims', null, true);

select pg_temp.rakna('15.3 familj P läser sitt barns historik', '00000000-0000-4000-8000-0000000000f1',
  $q$select count(*) from public.progress_historik where progress_id = '00000000-0000-4000-8000-0000000009a1'$q$,
  (select count(*) from public.progress_historik where progress_id = '00000000-0000-4000-8000-0000000009a1'));

select pg_temp.rakna('15.3 familj Q läser inte P:s historik', '00000000-0000-4000-8000-0000000000f2',
  $q$select count(*) from public.progress_historik where progress_id = '00000000-0000-4000-8000-0000000009a1'$q$, 0);

select pg_temp.rakna('15.3 studiehjälpare B läser inte A:s elevs historik', '00000000-0000-4000-8000-0000000000b1',
  $q$select count(*) from public.progress_historik where progress_id = '00000000-0000-4000-8000-0000000009a1'$q$, 0);

-- anon har inte ens select på tabellen, så svaret är 42501 och inte
-- noll rader. prova räknar båda som nekad; rakna hade kallat det fel.
select pg_temp.prova('15.3 anon läser ingen historik', null,
  array[$q$select * from public.progress_historik$q$], 'nekad');

select pg_temp.prova('15.3 A skriver själv i historiken', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.progress_historik (progress_id, student_id, subject, area, steg)
          values ('00000000-0000-4000-8000-0000000009a1', '00000000-0000-4000-8000-0000000005a1', 'Matematik', 'Bråk', 5)$q$],
  'nekad');

select pg_temp.prova('15.3 A rättar en rad i historiken', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.progress_historik set steg = 1
          where progress_id = '00000000-0000-4000-8000-0000000009a1'$q$],
  'nekad');

do $$
declare klar boolean := false;
begin
  begin
    update public.progress_items set steg = 6 where id = '00000000-0000-4000-8000-0000000009a1';
  exception when check_violation then klar := true;
  end;
  insert into utfall (test, ok, detalj)
  values ('15.3 steg utanför 1–5 nekas', klar, case when klar then 'check_violation' else 'gick igenom' end);
end $$;

-- ------------------------------------------------------------
-- Fas 15.4: barnets behov är fasta koder
-- ------------------------------------------------------------
select pg_temp.prova('15.4 familjen anger behov och format för sitt barn', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.students set behov = array['prov', 'struktur'], format_onskemal = 'online'
          where id = '00000000-0000-4000-8000-0000000005a1'$q$],
  'ok');

select pg_temp.prova('15.4 familj Q ändrar P:s barns behov', '00000000-0000-4000-8000-0000000000f2',
  array[$q$update public.students set behov = array['prov']
          where id = '00000000-0000-4000-8000-0000000005a1'$q$],
  'nekad');

do $$
declare klar boolean := false;
begin
  begin
    update public.students set behov = array['prov', 'diagnos: adhd']
     where id = '00000000-0000-4000-8000-0000000005a1';
  exception when check_violation then klar := true;
  end;
  insert into utfall (test, ok, detalj)
  values ('15.4 behov som fritext nekas', klar, case when klar then 'check_violation' else 'gick igenom' end);
end $$;

do $$
declare klar boolean := false;
begin
  begin
    update public.students set format_onskemal = 'hemma'
     where id = '00000000-0000-4000-8000-0000000005a1';
  exception when check_violation then klar := true;
  end;
  insert into utfall (test, ok, detalj)
  values ('15.4 okänt format nekas', klar, case when klar then 'check_violation' else 'gick igenom' end);
end $$;

-- ============================================================
-- FAS 14.2 — ingen månadsfaktura, och spärren "ingen betalning,
-- inget pass"
--
-- EGNA FIXTURER, MED FLIT. Äldst och b0c1 har passerat 9.4 och 9.8
-- innan sviten kommer hit, och de blocken rullas inte tillbaka: b0c1
-- har fått närvaro som admin, och Äldst matchades om till B och
-- tillbaka. Ett prov som står på ett annat provs rester mäter
-- testordningen, inte spärren.
--
-- SPÄRREN PROVAS I BÅDA LÄGENA, oavsett vad driften står på. Flaggan
-- kortsparr är av i drift tills en provbetalning gått hela vägen, och
-- de prov som vill ha den på slår på den i sin egen deltransaktion
-- (prova_med). Provet med spärren av slår av den uttryckligen, så att
-- det inte börjar falla den dag flaggan slås på.
-- ============================================================

insert into public.students (id, parent_id, name, matched_tutor_id, match_status, created_at) values
  ('00000000-0000-4000-8000-0000000005e1', '00000000-0000-4000-8000-0000000000f1', 'Betalprov',
   '00000000-0000-4000-8000-0000000000a1', 'matched', now());

insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status) values
  -- bekräftat, igår, obetalt, ingen rapport
  ('00000000-0000-4000-8000-00000000b4c1', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
   '00000000-0000-4000-8000-0000000005e1', '00000000-0000-4000-8000-0000000000f1',
   (now() at time zone 'Europe/Stockholm')::date - 1, '10:00', 60, 'confirmed'),
  -- bekräftat, igår, rapport finns (för den direkta statusvägen)
  ('00000000-0000-4000-8000-00000000b4a2', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
   '00000000-0000-4000-8000-0000000005e1', '00000000-0000-4000-8000-0000000000f1',
   (now() at time zone 'Europe/Stockholm')::date - 1, '11:00', 60, 'confirmed');

insert into public.lesson_reports (id, student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro) values
  ('00000000-0000-4000-8000-00000000e4a2', '00000000-0000-4000-8000-0000000005e1',
   '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000b4a2', 'fixtur', current_date, 'narvarande');
update public.bookings set status = 'confirmed', attendance = null
 where id = '00000000-0000-4000-8000-00000000b4a2';

-- ---------- spärren ----------
-- Rapporten gör passet genomfört i samma skrivning
-- (rapport_gor_passet_genomfort), så det är rapporten spärren stoppar.

select pg_temp.prova_med('14.2 spärren av: rapport på obetalt pass gör det genomfört',
  array[$q$update public.flaggor set aktiv = false where kod = 'kortsparr'$q$],
  '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
          values ('00000000-0000-4000-8000-0000000005e1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b4c1', 'x', current_date, 'narvarande')$q$,
        $q$select 1 from public.bookings where id = '00000000-0000-4000-8000-00000000b4c1' and status = 'completed'$q$],
  'ok');

select pg_temp.prova_med('14.2 spärren på: rapport på obetalt pass nekas',
  array[$q$update public.flaggor set aktiv = true where kod = 'kortsparr'$q$],
  '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
          values ('00000000-0000-4000-8000-0000000005e1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b4c1', 'x', current_date, 'narvarande')$q$],
  'nekad');

select pg_temp.prova_med('14.2 spärren på: rapport på betalt pass gör det genomfört',
  array[$q$update public.flaggor set aktiv = true where kod = 'kortsparr'$q$,
        $q$update public.bookings set betalning_status = 'betald' where id = '00000000-0000-4000-8000-00000000b4c1'$q$],
  '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
          values ('00000000-0000-4000-8000-0000000005e1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b4c1', 'x', current_date, 'narvarande')$q$,
        $q$select 1 from public.bookings where id = '00000000-0000-4000-8000-00000000b4c1' and status = 'completed'$q$],
  'ok');

-- En tvist är pengar som kommit in och som banken ännu inte tagit
-- tillbaka. Passet har hållits på den betalningen.
select pg_temp.prova_med('14.2 spärren på: tvist räknas som betalt',
  array[$q$update public.flaggor set aktiv = true where kod = 'kortsparr'$q$,
        $q$update public.bookings set betalning_status = 'tvist' where id = '00000000-0000-4000-8000-00000000b4c1'$q$],
  '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
          values ('00000000-0000-4000-8000-0000000005e1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b4c1', 'x', current_date, 'narvarande')$q$],
  'ok');

-- Ett pass Nextrum undantagit ska aldrig betalas, och får därför
-- aldrig fastna på att det inte är betalt.
select pg_temp.prova_med('14.2 spärren på: undantaget pass stoppas inte',
  array[$q$update public.flaggor set aktiv = true where kod = 'kortsparr'$q$,
        $q$update public.bookings set fakturerbar = false, fakturerbar_anledning = 'prov'
           where id = '00000000-0000-4000-8000-00000000b4c1'$q$],
  '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
          values ('00000000-0000-4000-8000-0000000005e1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b4c1', 'x', current_date, 'narvarande')$q$],
  'ok');

select pg_temp.prova_med('14.2 spärren på: en öppnad betalsida är ingen betalning',
  array[$q$update public.flaggor set aktiv = true where kod = 'kortsparr'$q$,
        $q$update public.bookings set betalning_status = 'vantar' where id = '00000000-0000-4000-8000-00000000b4c1'$q$],
  '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
          values ('00000000-0000-4000-8000-0000000005e1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b4c1', 'x', current_date, 'narvarande')$q$],
  'nekad');

select pg_temp.prova_med('14.2 spärren på: ett återbetalt pass är inte betalt',
  array[$q$update public.flaggor set aktiv = true where kod = 'kortsparr'$q$,
        $q$update public.bookings set betalning_status = 'aterbetald' where id = '00000000-0000-4000-8000-00000000b4c1'$q$],
  '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
          values ('00000000-0000-4000-8000-0000000005e1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b4c1', 'x', current_date, 'narvarande')$q$],
  'nekad');

-- Vägen runt rapporten: passet har redan en rapport, och
-- studiehjälparen försöker sätta genomfört direkt.
select pg_temp.prova_med('14.2 spärren på: direkt statusbyte på obetalt pass nekas',
  array[$q$update public.flaggor set aktiv = true where kod = 'kortsparr'$q$],
  '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set status = 'completed', attendance = 'narvarande'
          where id = '00000000-0000-4000-8000-00000000b4a2'$q$],
  'nekad');

-- Admin går förbi, som i resten av skydda_bokningsfalt. Det är vägen
-- för ett pass som ändå ska räknas, till exempel en betalning som
-- kommit in utanför Stripe.
select pg_temp.prova_med('14.2 spärren på: admin sätter genomfört ändå',
  array[$q$update public.flaggor set aktiv = true where kod = 'kortsparr'$q$],
  '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.bookings set status = 'completed', attendance = 'narvarande'
          where id = '00000000-0000-4000-8000-00000000b4a2'$q$],
  'ok');

-- ---------- flaggan ----------
select pg_temp.prova('14.2 studiehjälparen slår på spärren', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.flaggor set aktiv = true where kod = 'kortsparr'$q$], 'nekad');

select pg_temp.prova('14.2 familjen slår på spärren', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.flaggor set aktiv = true where kod = 'kortsparr'$q$], 'nekad');

select pg_temp.prova('14.2 admin slår på spärren', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.flaggor set aktiv = true where kod = 'kortsparr'$q$], 'ok');

-- Beskrivningen och vantar_pa är det som säger vad flaggan gör och
-- vad den väntar på. De skrivs i en migration, inte i en vy.
select pg_temp.prova('14.2 admin skriver om spärrens beskrivning', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.flaggor set beskrivning = 'x' where kod = 'kortsparr'$q$], 'nekad');

-- Studiehjälparvyn läser flaggan för att veta om den ska visa
-- betalläget. Kan den inte läsa den ser spärren ut att vara av.
select pg_temp.rakna('14.2 studiehjälparen läser spärren', '00000000-0000-4000-8000-0000000000a1',
  $q$select count(*) from public.flaggor where kod = 'kortsparr'$q$, 1);

select pg_temp.prova('14.2 anon läser inte spärren', null,
  array[$q$select 1 from public.flaggor where kod = 'kortsparr'$q$], 'nekad');

-- ---------- avvikelserna ----------
insert into utfall (test, ok, detalj)
select '14.2 ej_fakturerat finns inte längre', count(*) = 0, 'rader: ' || count(*)
  from public.avvikelser_rader() where typ = 'ej_fakturerat';

do $$
declare n_hallet int; n_betalt int; n_uppg int; fel text;
begin
  begin
    -- som postgres: rapporten gör passet genomfört utan spärr
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
    values ('00000000-0000-4000-8000-0000000005e1', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b4c1', 'x', current_date, 'narvarande');
    select count(*) into n_hallet from public.avvikelser_rader()
     where typ = 'ej_betalt' and objekt_id = '00000000-0000-4000-8000-00000000b4c1';

    perform public.kontroll_ekonomiska_avvikelser();
    select count(*) into n_uppg from public.uppgifter
     where nyckel = 'avvikelse:ej_betalt:bookings:00000000-0000-4000-8000-00000000b4c1'
       and titel like 'Inte betalt %' and status = 'oppen';

    update public.bookings set betalning_status = 'betald'
     where id = '00000000-0000-4000-8000-00000000b4c1';
    select count(*) into n_betalt from public.avvikelser_rader()
     where typ = 'ej_betalt' and objekt_id = '00000000-0000-4000-8000-00000000b4c1';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('14.2 ej_betalt', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('14.2 ett hållet obetalt pass är ej_betalt', n_hallet = 1, 'rader: ' || n_hallet),
      ('14.2 kontrollen gör det till en uppgift', n_uppg = 1, 'uppgifter: ' || n_uppg),
      ('14.2 ett betalt pass är inte ej_betalt', n_betalt = 0, 'efter betalning: ' || n_betalt);
  end if;
end $$;

-- 14.2c: betalsidan kan ligga öppen medan passet avbokas, och Stripe
-- drar pengarna om familjen betalar efteråt. Villkoren lovar hela
-- beloppet tillbaka, så avvikelsen står kvar tills det är gjort.
do $$
declare delvis bigint; n_klar int; n_galler int; fel text;
begin
  begin
    update public.bookings
       set status = 'cancelled', avbokningsskal = 'sjukdom',
           betalning_status = 'betald', betalt_ore = 37900, aterbetald_ore = 10000
     where id = '00000000-0000-4000-8000-00000000b4c1';
    select belopp_ore into delvis from public.avvikelser_rader()
     where typ = 'betald_men_avbokad' and objekt_id = '00000000-0000-4000-8000-00000000b4c1';

    update public.bookings set betalning_status = 'aterbetald', aterbetald_ore = 37900
     where id = '00000000-0000-4000-8000-00000000b4c1';
    select count(*) into n_klar from public.avvikelser_rader()
     where typ = 'betald_men_avbokad' and objekt_id = '00000000-0000-4000-8000-00000000b4c1';

    -- ett betalt pass som gäller är ingen avvikelse
    update public.bookings set betalning_status = 'betald', betalt_ore = 37900, aterbetald_ore = 0
     where id = '00000000-0000-4000-8000-00000000b4a2';
    select count(*) into n_galler from public.avvikelser_rader()
     where typ = 'betald_men_avbokad' and objekt_id = '00000000-0000-4000-8000-00000000b4a2';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('14.2c betald_men_avbokad', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('14.2c avbokat och delvis återbetalt larmar med resten', delvis = 27900,
       'belopp: ' || coalesce(delvis::text, 'ingen rad')),
      ('14.2c helt återbetalt larmar inte', n_klar = 0, 'rader: ' || n_klar),
      ('14.2c ett betalt pass som gäller larmar inte', n_galler = 0, 'rader: ' || n_galler);
  end if;
end $$;

-- 14.2b: kortbetalningarna syns i siffrorna, på dagen pengarna kom in.
do $$
declare
  denna date := date_trunc('month', now() at time zone 'Europe/Stockholm')::date;
  fore_kort bigint; efter_kort bigint; fore_ai bigint; efter_ai bigint; fel text;
begin
  begin
    select coalesce(sum(kortbetalt_ore), 0) into fore_kort from public.analys_ekonomi where manad = denna;
    select coalesce(sum(betalt_ore), 0) into fore_ai from public.ai_analys(1) where manad = denna;
    update public.bookings set betalning_status = 'betald', betalt_ore = 37900, betald_at = now()
     where id = '00000000-0000-4000-8000-00000000b4c1';
    select coalesce(sum(kortbetalt_ore), 0) into efter_kort from public.analys_ekonomi where manad = denna;
    select coalesce(sum(betalt_ore), 0) into efter_ai from public.ai_analys(1) where manad = denna;
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('14.2b analysen', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('14.2b en kortbetalning syns i analys_ekonomi samma månad', efter_kort - fore_kort = 37900,
       fore_kort || ' → ' || efter_kort),
      ('14.2b och i agentens betalt', efter_ai - fore_ai = 37900, fore_ai || ' → ' || efter_ai);
  end if;
end $$;

-- ---------- RUT och kortbetalningen ----------
-- Kortbetalningen drar inte RUT-avdraget. En RUT-tjänst för kunder
-- hade tagit fullt pris av en familj som lovats halva.
select pg_temp.prova('14.2 en RUT-berättigad kundtjänst går inte att slå på', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.tjanster
            set pris_per_timme_ore = 45000, rut_berattigad = true, rut_procent = 50, aktiv = true
          where kod = 'provtjanst'$q$], 'nekad');

select pg_temp.prova('14.2 läxhjälpen kan inte bli RUT-berättigad medan den är aktiv', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.tjanster set rut_berattigad = true, rut_procent = 50 where kod = 'laxhjalp'$q$], 'nekad');

-- Att PLANERA en RUT-tjänst ska gå. Spärren gäller en aktiv rad.
select pg_temp.prova('14.2 en avstängd tjänst får planeras med RUT', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.tjanster set rut_berattigad = true, rut_procent = 50
          where kod = 'provtjanst' and not aktiv$q$], 'ok');

-- ============================================================
-- FAS 14.3 — korttvisterna
--
-- stripe_tvister skrivs bara av stripe-webhook med service_role, och
-- bara admin läser. Tvisten gäller familjens eget pass, men familjen
-- ska inte se den här: det är vårt underlag för att svara Stripe, och
-- den som bestridit ett köp har sin egen bank att fråga. Ingen, inte
-- ens admin, skriver en rad från en vy. En tvist som gick att skapa
-- eller stänga härifrån hade kunnat dölja en svarsdag.
-- ============================================================
insert into public.stripe_tvister (id, booking_id, charge_id, orsak, lage, belopp_ore, svara_senast)
values ('dp_rlsTest1', '00000000-0000-4000-8000-00000000b4c1', 'ch_rlsTest1', 'fraudulent', 'needs_response',
        37900, now() + interval '7 days');

select pg_temp.rakna('14.3 admin läser korttvisterna', '00000000-0000-4000-8000-0000000000ad',
  $q$select count(*) from public.stripe_tvister where id = 'dp_rlsTest1'$q$, 1);

select pg_temp.rakna('14.3 familjen ser inte tvisten på sitt eget pass', '00000000-0000-4000-8000-0000000000f1',
  $q$select count(*) from public.stripe_tvister$q$, 0);

select pg_temp.rakna('14.3 studiehjälparen ser inte tvisten på sitt pass', '00000000-0000-4000-8000-0000000000a1',
  $q$select count(*) from public.stripe_tvister$q$, 0);

select pg_temp.prova('14.3 anon läser inte korttvisterna', null,
  array[$q$select * from public.stripe_tvister$q$], 'nekad');

select pg_temp.prova('14.3 admin skapar ingen korttvist från en vy', '00000000-0000-4000-8000-0000000000ad',
  array[$q$insert into public.stripe_tvister (id, charge_id, lage) values ('dp_rlsTest2', 'ch_rlsTest2', 'needs_response')$q$],
  'nekad');

select pg_temp.prova('14.3 admin stänger ingen korttvist från en vy', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.stripe_tvister set lage = 'won', stangd = now() where id = 'dp_rlsTest1'$q$], 'nekad');

select pg_temp.prova('14.3 admin raderar ingen korttvist', '00000000-0000-4000-8000-0000000000ad',
  array[$q$delete from public.stripe_tvister where id = 'dp_rlsTest1'$q$], 'nekad');

select pg_temp.prova('14.3 familjen skapar ingen korttvist', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.stripe_tvister (id, booking_id, charge_id, lage)
          values ('dp_rlsTest3', '00000000-0000-4000-8000-00000000b4c1', 'ch_rlsTest3', 'won')$q$], 'nekad');

-- ============================================================
-- FAS 14.6a — ett nytt pass föds obetalt
--
-- INSERT-grenen i skydda_bokningsfalt prövade status, närvaro, längd,
-- tjänst och barn, men inte en enda betalningskolumn. En familj kunde
-- skapa ett pass som redan stod 'betald': det slapp spärren, larmade
-- aldrig som ej_betalt och kom med på studiehjälparens underlag den
-- 25:e. Samma sak för studiehjälparens "föreslå tid". Proven skapar
-- passet precis som vyerna gör, med en betalningskolumn till.
-- ============================================================
select pg_temp.prova('14.6a familjen skapar ett pass som redan är betalt', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, subject, tjanst,
                                        wanted_date, wanted_time, duration_min, status,
                                        betalning_status, betald_at, betalt_ore)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1',
                  'Svenska', 'laxhjalp', (now() at time zone 'Europe/Stockholm')::date + 4, '16:00', 60,
                  'requested', 'betald', now(), 37900)$q$],
  'nekad');

select pg_temp.prova('14.6a studiehjälparen föreslår ett pass som redan är betalt', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, subject, tjanst,
                                        wanted_date, wanted_time, duration_min, status, betalning_status)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  'Svenska', 'laxhjalp', (now() at time zone 'Europe/Stockholm')::date + 4, '17:00', 60,
                  'requested', 'betald')$q$],
  'nekad');

select pg_temp.prova('14.6a familjen skapar ett pass med ett påhittat Stripe-id', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, subject, tjanst,
                                        wanted_date, wanted_time, duration_min, status, stripe_charge_id)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1',
                  'Svenska', 'laxhjalp', (now() at time zone 'Europe/Stockholm')::date + 4, '18:00', 60,
                  'requested', 'ch_rlsPahittad')$q$],
  'nekad');

select pg_temp.prova('14.6a familjen skapar ett pass med ett återbetalt belopp', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, subject, tjanst,
                                        wanted_date, wanted_time, duration_min, status, aterbetald_ore)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1',
                  'Svenska', 'laxhjalp', (now() at time zone 'Europe/Stockholm')::date + 4, '19:00', 60,
                  'requested', 100)$q$],
  'nekad');

-- Betalningen skrivs av webhooken med service_role, där auth.uid() är
-- null. Den vägen ska gå, och den ska synas i auditloggen: förut
-- fanns ingen betalningsändring där alls, varken från Stripe eller
-- från en admin som skrev 'betald' för hand.
do $$
declare
  fore bigint; efter bigint; senast jsonb; fel text;
begin
  begin
    select count(*) into fore from public.audit_logg
     where tabell = 'bookings' and objekt_id = '00000000-0000-4000-8000-00000000b4c1';
    update public.bookings set betalning_status = 'betald', betald_at = now(), betalt_ore = 37900
     where id = '00000000-0000-4000-8000-00000000b4c1';
    select count(*) into efter from public.audit_logg
     where tabell = 'bookings' and objekt_id = '00000000-0000-4000-8000-00000000b4c1';
    select a.efter into senast from public.audit_logg a
     where a.tabell = 'bookings' and a.objekt_id = '00000000-0000-4000-8000-00000000b4c1'
     order by a.id desc limit 1;
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('14.6a betalningen i auditloggen', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('14.6a en betalning blir en rad i auditloggen', efter - fore = 1, fore || ' → ' || efter),
      ('14.6a raden bär läget', senast ->> 'betalning_status' = 'betald',
       coalesce(senast::text, 'ingen rad'));
  end if;
end $$;

-- ============================================================
-- FAS 14.6 — faktura som betalsätt
--
-- Familjen väljer faktura på ett pass, eller kort igen, och ingenting
-- annat i samma skrivning. Flaggan 'faktura' är strömbrytaren och står
-- av i drift; proven som vill ha den på slår på den i sin egen
-- deltransaktion, och provet med den av slår av den uttryckligen.
--
-- EGNA FIXTURER, av samma skäl som under FAS 14.2: de äldre passen har
-- hunnit ändras av blocken ovan.
-- ============================================================
insert into public.students (id, parent_id, name, matched_tutor_id, match_status, created_at) values
  ('00000000-0000-4000-8000-0000000005f6', '00000000-0000-4000-8000-0000000000f1', 'Fakturaprov',
   '00000000-0000-4000-8000-0000000000a1', 'matched', now());

insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status) values
  -- bekräftat, om fem dagar
  ('00000000-0000-4000-8000-00000000b6c1', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
   '00000000-0000-4000-8000-0000000005f6', '00000000-0000-4000-8000-0000000000f1',
   (now() at time zone 'Europe/Stockholm')::date + 5, '09:00', 60, 'confirmed'),
  -- bekräftat, igår, ingen rapport (för spärren)
  ('00000000-0000-4000-8000-00000000b6d1', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
   '00000000-0000-4000-8000-0000000005f6', '00000000-0000-4000-8000-0000000000f1',
   (now() at time zone 'Europe/Stockholm')::date - 1, '09:00', 60, 'confirmed'),
  -- genomfört förra månaden, med rapport, obetalt (för avvikelserna och fakturan)
  ('00000000-0000-4000-8000-00000000b6e1', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
   '00000000-0000-4000-8000-0000000005f6', '00000000-0000-4000-8000-0000000000f1',
   (date_trunc('month', now() at time zone 'Europe/Stockholm') - interval '10 days')::date, '09:00', 60, 'completed');

insert into public.lesson_reports (id, student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro) values
  ('00000000-0000-4000-8000-00000000e6e1', '00000000-0000-4000-8000-0000000005f6',
   '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000b6e1', 'fixtur',
   (date_trunc('month', now() at time zone 'Europe/Stockholm') - interval '10 days')::date, 'narvarande');
update public.bookings set status = 'completed' where id = '00000000-0000-4000-8000-00000000b6e1';

-- ---------- valet ----------
select pg_temp.prova_med('14.6 flaggan av: familjen kan inte välja faktura',
  array[$q$update public.flaggor set aktiv = false where kod = 'faktura'$q$],
  '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set betalning_status = 'faktura' where id = '00000000-0000-4000-8000-00000000b6c1'$q$],
  'nekad');

select pg_temp.prova_med('14.6 flaggan på: familjen väljer faktura på ett bekräftat pass',
  array[$q$update public.flaggor set aktiv = true where kod = 'faktura'$q$],
  '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set betalning_status = 'faktura' where id = '00000000-0000-4000-8000-00000000b6c1'$q$],
  'ok');

select pg_temp.prova_med('14.6 familjen väljer faktura medan kassan står öppen',
  array[$q$update public.flaggor set aktiv = true where kod = 'faktura'$q$,
        $q$update public.bookings set betalning_status = 'vantar' where id = '00000000-0000-4000-8000-00000000b6c1'$q$],
  '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set betalning_status = 'faktura' where id = '00000000-0000-4000-8000-00000000b6c1'$q$],
  'ok');

select pg_temp.prova_med('14.6 familjen väljer faktura på ett genomfört obetalt pass',
  array[$q$update public.flaggor set aktiv = true where kod = 'faktura'$q$],
  '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set betalning_status = 'faktura' where id = '00000000-0000-4000-8000-00000000b6e1'$q$],
  'ok');

select pg_temp.prova_med('14.6 ett betalt pass kan inte bli fakturapass',
  array[$q$update public.flaggor set aktiv = true where kod = 'faktura'$q$,
        $q$update public.bookings set betalning_status = 'betald' where id = '00000000-0000-4000-8000-00000000b6c1'$q$],
  '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set betalning_status = 'faktura' where id = '00000000-0000-4000-8000-00000000b6c1'$q$],
  'nekad');

select pg_temp.prova_med('14.6 en spärrad familj kan inte välja faktura',
  array[$q$update public.flaggor set aktiv = true where kod = 'faktura'$q$,
        $q$insert into public.faktura_sparr (parent_id) values ('00000000-0000-4000-8000-0000000000f1')$q$],
  '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set betalning_status = 'faktura' where id = '00000000-0000-4000-8000-00000000b6c1'$q$],
  'nekad');

select pg_temp.prova_med('14.6 studiehjälparen väljer inte betalsätt åt familjen',
  array[$q$update public.flaggor set aktiv = true where kod = 'faktura'$q$],
  '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set betalning_status = 'faktura' where id = '00000000-0000-4000-8000-00000000b6c1'$q$],
  'nekad');

select pg_temp.prova_med('14.6 valet får inte ändra något annat i samma skrivning',
  array[$q$update public.flaggor set aktiv = true where kod = 'faktura'$q$],
  '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set betalning_status = 'faktura', duration_min = 180
          where id = '00000000-0000-4000-8000-00000000b6c1'$q$],
  'nekad');

select pg_temp.prova('14.6 familjen kan inte skriva betald själv', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set betalning_status = 'betald' where id = '00000000-0000-4000-8000-00000000b6c1'$q$],
  'nekad');

select pg_temp.prova_med('14.6 familjen byter tillbaka till kort innan passet fakturerats',
  array[$q$update public.bookings set betalning_status = 'faktura' where id = '00000000-0000-4000-8000-00000000b6c1'$q$],
  '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set betalning_status = 'ingen' where id = '00000000-0000-4000-8000-00000000b6c1'$q$],
  'ok');

select pg_temp.prova_med('14.6 ett fakturerat pass går inte att byta till kort',
  array[$q$update public.bookings set betalning_status = 'faktura' where id = '00000000-0000-4000-8000-00000000b6e1'$q$,
        $q$insert into public.invoices (id, parent_id, period, status, belopp_ore)
           values ('00000000-0000-4000-8000-00000000f6a1', '00000000-0000-4000-8000-0000000000f1',
                   date_trunc('month', now() at time zone 'Europe/Stockholm')::date, 'utkast', 37900)$q$,
        $q$insert into public.invoice_lines (invoice_id, booking_id, beskrivning, minuter, pris_per_timme_ore, belopp_ore)
           values ('00000000-0000-4000-8000-00000000f6a1', '00000000-0000-4000-8000-00000000b6e1', 'x', 60, 37900, 37900)$q$],
  '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set betalning_status = 'ingen' where id = '00000000-0000-4000-8000-00000000b6e1'$q$],
  'nekad');

-- ---------- vad familjen får veta ----------
select pg_temp.prova('14.6 anon frågar inte om faktura', null,
  array[$q$select public.faktura_mojlig()$q$], 'nekad');

do $$
declare av boolean; pa boolean; sparrad boolean; fel text;
begin
  begin
    update public.flaggor set aktiv = false where kod = 'faktura';
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000f1');
    select public.faktura_mojlig() into av;
    reset role;
    update public.flaggor set aktiv = true where kod = 'faktura';
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000f1');
    select public.faktura_mojlig() into pa;
    reset role;
    insert into public.faktura_sparr (parent_id) values ('00000000-0000-4000-8000-0000000000f1');
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000f1');
    select public.faktura_mojlig() into sparrad;
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('14.6 faktura_mojlig', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('14.6 faktura_mojlig är falsk när flaggan är av', av is false, coalesce(av::text, 'null')),
      ('14.6 faktura_mojlig är sann när flaggan är på', pa is true, coalesce(pa::text, 'null')),
      ('14.6 faktura_mojlig är falsk för en spärrad familj', sparrad is false, coalesce(sparrad::text, 'null'));
  end if;
end $$;

select pg_temp.prova('14.6 familjen spärrar inte en annan familj', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.faktura_sparr (parent_id) values ('00000000-0000-4000-8000-0000000000f2')$q$],
  'nekad');

select pg_temp.prova_med('14.6 familjen tar inte bort sin egen spärr',
  array[$q$insert into public.faktura_sparr (parent_id) values ('00000000-0000-4000-8000-0000000000f1')$q$],
  '00000000-0000-4000-8000-0000000000f1',
  array[$q$delete from public.faktura_sparr where parent_id = '00000000-0000-4000-8000-0000000000f1'$q$],
  'nekad');

select pg_temp.prova('14.6 admin spärrar en familj', '00000000-0000-4000-8000-0000000000ad',
  array[$q$insert into public.faktura_sparr (parent_id) values ('00000000-0000-4000-8000-0000000000f2')$q$],
  'ok');

-- ---------- spärren "ingen betalning, inget pass" ----------
select pg_temp.prova_med('14.6 spärren på: ett fakturapass går att rapportera',
  array[$q$update public.flaggor set aktiv = true where kod = 'kortsparr'$q$,
        $q$update public.bookings set betalning_status = 'faktura' where id = '00000000-0000-4000-8000-00000000b6d1'$q$],
  '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
          values ('00000000-0000-4000-8000-0000000005f6', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b6d1', 'x', current_date, 'narvarande')$q$,
        $q$select 1 from public.bookings where id = '00000000-0000-4000-8000-00000000b6d1' and status = 'completed'$q$],
  'ok');

-- Samma pass som kortpass: undantaget får inte ha öppnat spärren.
select pg_temp.prova_med('14.6 spärren på: ett obetalt kortpass nekas fortfarande',
  array[$q$update public.flaggor set aktiv = true where kod = 'kortsparr'$q$],
  '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
          values ('00000000-0000-4000-8000-0000000005f6', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b6d1', 'x', current_date, 'narvarande')$q$],
  'nekad');

-- ---------- avvikelserna ----------
do $$
declare ej_betalt_fore int; ej_betalt_efter int; saknas int; dubbel int; fel text;
begin
  begin
    select count(*) into ej_betalt_fore from public.avvikelser_rader()
     where typ = 'ej_betalt' and objekt_id = '00000000-0000-4000-8000-00000000b6e1';
    update public.bookings set betalning_status = 'faktura' where id = '00000000-0000-4000-8000-00000000b6e1';
    select count(*) into ej_betalt_efter from public.avvikelser_rader()
     where typ = 'ej_betalt' and objekt_id = '00000000-0000-4000-8000-00000000b6e1';
    select count(*) into saknas from public.avvikelser_rader()
     where typ = 'faktura_saknas' and objekt_id = '00000000-0000-4000-8000-00000000b6e1';
    insert into public.invoices (id, parent_id, period, status, belopp_ore)
    values ('00000000-0000-4000-8000-00000000f6a2', '00000000-0000-4000-8000-0000000000f1',
            date_trunc('month', now() at time zone 'Europe/Stockholm')::date, 'skickad', 37900);
    insert into public.invoice_lines (invoice_id, booking_id, beskrivning, minuter, pris_per_timme_ore, belopp_ore)
    values ('00000000-0000-4000-8000-00000000f6a2', '00000000-0000-4000-8000-00000000b6e1', 'x', 60, 37900, 37900);
    update public.bookings set betalning_status = 'betald' where id = '00000000-0000-4000-8000-00000000b6e1';
    select count(*) into dubbel from public.avvikelser_rader()
     where typ = 'betald_och_fakturerad' and objekt_id = '00000000-0000-4000-8000-00000000b6e1';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('14.6 avvikelserna', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('14.6 ett obetalt genomfört pass larmar som ej_betalt', ej_betalt_fore = 1, 'rader: ' || ej_betalt_fore),
      ('14.6 samma pass som fakturapass larmar inte som ej_betalt', ej_betalt_efter = 0, 'rader: ' || ej_betalt_efter),
      ('14.6 ett fakturapass från en slutad månad utan faktura larmar', saknas = 1, 'rader: ' || saknas),
      ('14.6 betalt med kort och fakturerat larmar', dubbel = 1, 'rader: ' || dubbel);
  end if;
end $$;

-- ---------- fakturan ----------
insert into public.invoices (id, parent_id, period, status, belopp_ore)
values ('00000000-0000-4000-8000-00000000f6a3', '00000000-0000-4000-8000-0000000000f1',
        (date_trunc('month', now() at time zone 'Europe/Stockholm') - interval '1 month')::date, 'utkast', 37900);

select pg_temp.prova('14.6 admin skriver in Wints fakturanummer', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.invoices set wint_fakturanummer = '1042', status = 'skickad',
            skickad_at = now(), forfaller = current_date + 10
          where id = '00000000-0000-4000-8000-00000000f6a3'$q$],
  'ok');

-- Ett check-villkor svarar 23514, inte 42501, så prova() hade räknat
-- det som ett trasigt test. Därför ett eget block.
do $$
declare kod text;
begin
  begin
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
    update public.invoices set wint_fakturanummer = '<script>'
     where id = '00000000-0000-4000-8000-00000000f6a3';
    raise exception using errcode = 'P0001', message = 'gick igenom';
  exception when others then kod := sqlstate;
  end;
  reset role;
  insert into utfall (test, ok, detalj) values
    ('14.6 ett fakturanummer är bara siffror, bokstäver och bindestreck', kod = '23514', 'sqlstate ' || kod);
end $$;

select pg_temp.prova('14.6 familjen markerar inte sin faktura betald', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.invoices set status = 'betald', betald_at = now()
          where id = '00000000-0000-4000-8000-00000000f6a3'$q$],
  'nekad');

select pg_temp.rakna('14.6 familjen ser sin faktura', '00000000-0000-4000-8000-0000000000f1',
  $q$select count(*) from public.invoices where id = '00000000-0000-4000-8000-00000000f6a3'$q$, 1);

select pg_temp.rakna('14.6 en annan familj ser den inte', '00000000-0000-4000-8000-0000000000f2',
  $q$select count(*) from public.invoices where id = '00000000-0000-4000-8000-00000000f6a3'$q$, 0);

select test, ok, detalj from utfall order by nr;

rollback;
