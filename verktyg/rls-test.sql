-- ============================================================
-- NEXTRUM — behörighetstester (Fas 1 och Fas 2)
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
-- Notistriggern på bookings stängs av under körningen, så att
-- fixturpassen aldrig kan bli ett mejl. Även den ändringen rullas
-- tillbaka.
--
-- Svaret är en tabell: test, ok, detalj. Varje rad ska vara ok.
--
-- Förutsättning: migrationerna för Fas 1.1–1.6 och Fas 2.1–2.3 är
-- körda. Körs filen före dem är det väntat att de berörda raderna
-- faller — det är så man ser att testerna faktiskt mäter något.
-- ============================================================

begin;

alter table public.bookings disable trigger "nytt-passforslag";

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
-- en som hör till passet b0a2.
insert into public.lesson_reports (id, student_id, tutor_id, booking_id, raw_notes, lesson_date) values
  ('00000000-0000-4000-8000-00000000e0a1', '00000000-0000-4000-8000-0000000005a1',
   '00000000-0000-4000-8000-0000000000a1', null, 'fixtur', current_date),
  ('00000000-0000-4000-8000-00000000e0a2', '00000000-0000-4000-8000-0000000005a1',
   '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000b0a2', 'fixtur', current_date);

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
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes)
          values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b0c1', 'x')$q$,
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
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes)
          values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b0f1', 'x')$q$,
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
  array[$q$update public.lesson_reports set booking_id = '00000000-0000-4000-8000-00000000b0e1'
          where id = '00000000-0000-4000-8000-00000000e0a1' and booking_id is null$q$],
  $q$select count(*) from public.passunderlag
     where id = '00000000-0000-4000-8000-00000000b0e1' and har_rapport and fakturerbar and not fakturerad$q$, 1);

select pg_temp.rakna_efter('F2 ej_utbetalt räknar passet när rapporten är kopplad', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.lesson_reports set booking_id = '00000000-0000-4000-8000-00000000b0e1'
          where id = '00000000-0000-4000-8000-00000000e0a1'$q$],
  $q$select coalesce(sum(pass), 0) from public.ej_utbetalt
     where tutor_id = '00000000-0000-4000-8000-0000000000a1'$q$, 1);

select pg_temp.rakna_efter('F2 rapport med närvaro gör passet genomfört', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, narvaro)
          values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b0c1', 'x', 'sen')$q$],
  $q$select count(*) from public.bookings
     where id = '00000000-0000-4000-8000-00000000b0c1' and status = 'completed' and attendance = 'sen'$q$, 1);

select pg_temp.rakna_efter('F2 rapport utan närvaro lämnar passet orört (gamla vyn)', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes)
          values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b0c1', 'x')$q$],
  $q$select count(*) from public.bookings
     where id = '00000000-0000-4000-8000-00000000b0c1' and status = 'confirmed'$q$, 1);

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
  'public.rapport_gor_passet_genomfort()'
]) f;

insert into utfall (test, ok, detalj)
select 'RPC som gränssnittet använder är kvar: ' || f,
       coalesce(has_function_privilege('authenticated', to_regprocedure(f), 'execute'), false),
       case when to_regprocedure(f) is null then 'funktionen finns inte' else 'authenticated execute' end
from unnest(array[
  'public.kolla_rabattkod(text, text, bigint)', 'public.publika_studiehjalpare()'
]) f;

select test, ok, detalj from utfall order by nr;

rollback;
