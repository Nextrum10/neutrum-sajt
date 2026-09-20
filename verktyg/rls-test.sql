-- ============================================================
-- NEXTRUM — behörighetstester (Fas 1, 2, 5 och 6)
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
-- Notistriggrarna på bookings OCH leads stängs av under körningen,
-- så att fixturpassen och provanmälningarna aldrig kan bli ett mejl.
-- Även de ändringarna rullas tillbaka.
--
-- OBS vid körning mot skarp drift: att stänga av en trigger tar
-- ACCESS EXCLUSIVE-lås på tabellen, och låset hålls tills
-- transaktionen rullat tillbaka. Under körningen väntar alltså varje
-- besökare som skickar intresseanmälan på nextrum.se. Kör sviten när
-- formuläret är lugnt, eller mot en gren.
--
-- Svaret är en tabell: test, ok, detalj. Varje rad ska vara ok.
--
-- Förutsättning: migrationerna för Fas 1.1–1.6, Fas 2.1–2.3 och
-- Fas 5.1–5.6 och Fas 6.1–6.2 är körda. Körs filen före dem är det väntat att de berörda raderna
-- faller — det är så man ser att testerna faktiskt mäter något.
-- ============================================================

begin;

alter table public.bookings disable trigger "nytt-passforslag";
alter table public.leads disable trigger "ny-intresseanmalan";

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

select pg_temp.prova('F-6 A avbokar kommande pass', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set status = 'cancelled' where id = '00000000-0000-4000-8000-00000000b0d1'$q$],
  'ok');

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
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, status)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  (now() at time zone 'Europe/Stockholm')::date + 2, '18:00', 'completed')$q$],
  'nekad');

select pg_temp.prova('F-6 A skapar pass bakåt i tiden', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, status)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  (now() at time zone 'Europe/Stockholm')::date - 2, '18:00', 'requested')$q$],
  'nekad');

select pg_temp.prova('F-6 A föreslår pass för B:s elev', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, status)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-0000000005b1', '00000000-0000-4000-8000-0000000000a1',
                  (now() at time zone 'Europe/Stockholm')::date + 2, '18:00', 'requested')$q$],
  'nekad');

select pg_temp.prova('F-6 A föreslår pass med flerbarnstillägg', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, status, antal_barn)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  (now() at time zone 'Europe/Stockholm')::date + 2, '18:00', 'requested', 2)$q$],
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
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, tjanst, status)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1',
                  (now() at time zone 'Europe/Stockholm')::date + 3, '15:00', 'barnvakt', 'requested')$q$],
  'nekad');

select pg_temp.prova('F-6 P bokar för en annan familjs barn', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, status)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-0000000005c1', '00000000-0000-4000-8000-0000000000f1',
                  (now() at time zone 'Europe/Stockholm')::date + 3, '15:00', 'requested')$q$],
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
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, status, fakturerbar)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1',
                  (now() at time zone 'Europe/Stockholm')::date + 3, '15:00', 'requested', false)$q$],
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
select pg_temp.rakna('5.2 studiehjälpare A ser sin familjs uppdrag, inte Q:s', '00000000-0000-4000-8000-0000000000a1',
  $q$select count(*) from public.uppdrag where kund_id in ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000f2')$q$, 2);
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

-- Det AI:n föreslog ska vara det admin godkänner.
insert into public.ai_forslag (typ, nyckel, payload, motivering)
values ('matchning', 'prov:frys:8',
        jsonb_build_object('elev_id', '00000000-0000-4000-8000-0000000005a1',
                           'studiehjalpare_id', '00000000-0000-4000-8000-0000000000a1'),
        'Ursprunglig motivering');
update public.ai_forslag
   set typ = 'lead_status',
       payload = '{"lead_id":"00000000-0000-4000-8000-00000000000b","status":"matched"}'::jsonb,
       motivering = 'Utbytt',
       nyckel = 'prov:frys:8b'
 where nyckel = 'prov:frys:8';

insert into utfall (test, ok, detalj)
select '8.2 förslaget går inte att skriva om efter att det skapats',
       count(*) = 1, 'oförändrade rader: ' || count(*)
from public.ai_forslag
where nyckel = 'prov:frys:8' and typ = 'matchning' and motivering = 'Ursprunglig motivering';

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
  'public.bekrafta_inom_schemat()', 'public.skydda_studentfalt()', 'public.las_fakturabelopp()',
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
  'public.matchningspoang(text[], text, text[], text[], integer, integer, jsonb)'
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
  'public.avvisa_forslag(uuid, text)', 'public.matchningsforslag(uuid)'
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

select test, ok, detalj from utfall order by nr;

rollback;
