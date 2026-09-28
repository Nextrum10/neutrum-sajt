-- ============================================================
-- NEXTRUM — behörighetstester (Fas 1, 2, 5, 6, 7, 8, 9, 14, 16, 18, 19, 20, 21, 22, 23 och gallringen)
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
-- Svaret är en tabell: test, ok, detalj. Varje rad ska vara ok. Ett
-- villkor som blir null (ett kort som saknas jämfört med ett id) visas
-- som false, inte som en tom ruta: tre prov stod null utan att någon
-- såg det (2026-09-28).
--
-- Förutsättning: migrationerna för Fas 1.1–1.6, Fas 2.1–2.3,
-- Fas 5.1–5.6, Fas 6.1–6.2, Fas 7, Fas 8, Fas 9.1–9.4,
-- Fas 14.2–14.6, Fas 15.1–15.4, Fas 16.1 (ansökningsmejlen,
-- 16.1–16.1c), Fas 16.1 (erbjudandena, 16.1–16.1e), Fas 16.2,
-- Fas 18.1 (Meet-länken), Fas 19.1–19.6 (19.5: det frysta priset,
-- 19.6: OCR), Fas 20.1 (den hållna tiden), Fas 20.2 (bokslutet),
-- Fas 21.1–21.2, admin_laser_ansokans_cv (admin läser CV:t), Fas 22.1
-- (timbanken), timbanken_foljer_passet, Fas 22.2 (timmarna betalar
-- passen), ansokningar_gallras_efter_ett_ar (gallringen),
-- notisfelen_bara_egna_utskick, klientfelen_minns_vem, Fas 22.3
-- (lediga timmar betalar nästa pass),
-- godkand_ansokan_gallras_tva_ar_efter_sista_passet,
-- ai_texterna_och_avslutade_uppgifter_gallras, Fas 22.4 (timmen dras
-- när förslaget skickas) och Fas 23.1 (de digitala uppgifterna) är körda.
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

-- Fas 16.1: ansökningsmejlen. Triggern ansokan_besked på applications
-- får vara PÅ, för proven längst ned mäter just vad den köar. Adressen
-- till funktionen töms i stället, så att intern.ansokan_besked_skicka()
-- returnerar innan pg_net ens anropas. Rullas tillbaka som allt annat.
update public.notis_konfig set ansokan_url = null where id = 1;

-- Fas 22.2: med flaggan erbjudanden på betalar köpta timmar ett pass
-- av sig själva när det bekräftas eller genomförs. Proven nedan är
-- skrivna för pass som står obetalda tills någon betalar dem, så
-- flaggan står av under körningen, oavsett hur den står i driften, och
-- slås på i blocken för 22.2 och 22.3. Rullas tillbaka som allt annat.
update public.flaggor set aktiv = false where kod = 'erbjudanden';

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

-- Bara raderna den här körningen skapade (created_at sätts till now()
-- av triggern, och now() är transaktionens tid). Adminvyns knapp "Gör
-- till uppgift" på en avvikelse skriver samma nyckelform, och en sådan
-- rad ÄR en människas: den står rätt som 'manniska'. Provet räknade
-- förut hela tabellen och föll på den första riktiga knapptryckningen
-- i driften (2026-09-25).
insert into utfall (test, ok, detalj)
select '7.4 adminknappen stämplar maskinens uppgifter som system',
       count(*) > 0 and bool_and(skapad_av_typ = 'system' and skapad_av is null),
       'uppgifter: ' || count(*) || ', typer: ' || coalesce(string_agg(distinct skapad_av_typ, ','), 'inga')
from public.uppgifter
where (nyckel like 'kontroll:%' or nyckel like 'avvikelse:%' or nyckel like 'uppfoljning:%')
  and created_at = now();

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
  -- Hinkens namn med citattecken: bibliotekets policy (Fas 13.2) nämner
  -- tabellen biblioteksmaterial och is_admin(), och räknades förut med.
  and qual like '%is_admin()%' and qual like '%''material''%';

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
--
-- SEDAN FAS 19.2 GÅR SPÄRREN INTE ATT SLÅ PÅ: check-villkoret
-- flaggor_kortsparr_av nekar det, också för admin (proven under Fas
-- 19.2 längre ned). Koden i skydda_bokningsfalt står kvar för den dag
-- villkoren går tillbaka till betalning före passet, och proven här
-- håller den i form. Därför lyfter varje prov villkoret själv, inne i
-- sin egen deltransaktion, och det rullas tillbaka med provet. Förut
-- satte proven flaggan rakt av, och från Fas 19.2 föll alla med 23514.
create function pg_temp.sparren_pa() returns void
language plpgsql as $$
begin
  alter table public.flaggor drop constraint flaggor_kortsparr_av;
  update public.flaggor set aktiv = true where kod = 'kortsparr';
end $$;

select pg_temp.prova_med('14.2 spärren av: rapport på obetalt pass gör det genomfört',
  array[$q$update public.flaggor set aktiv = false where kod = 'kortsparr'$q$],
  '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
          values ('00000000-0000-4000-8000-0000000005e1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b4c1', 'x', current_date, 'narvarande')$q$,
        $q$select 1 from public.bookings where id = '00000000-0000-4000-8000-00000000b4c1' and status = 'completed'$q$],
  'ok');

select pg_temp.prova_med('14.2 spärren på: rapport på obetalt pass nekas',
  array[$q$select pg_temp.sparren_pa()$q$],
  '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
          values ('00000000-0000-4000-8000-0000000005e1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b4c1', 'x', current_date, 'narvarande')$q$],
  'nekad');

select pg_temp.prova_med('14.2 spärren på: rapport på betalt pass gör det genomfört',
  array[$q$select pg_temp.sparren_pa()$q$,
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
  array[$q$select pg_temp.sparren_pa()$q$,
        $q$update public.bookings set betalning_status = 'tvist' where id = '00000000-0000-4000-8000-00000000b4c1'$q$],
  '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
          values ('00000000-0000-4000-8000-0000000005e1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b4c1', 'x', current_date, 'narvarande')$q$],
  'ok');

-- Ett pass Nextrum undantagit ska aldrig betalas, och får därför
-- aldrig fastna på att det inte är betalt.
select pg_temp.prova_med('14.2 spärren på: undantaget pass stoppas inte',
  array[$q$select pg_temp.sparren_pa()$q$,
        $q$update public.bookings set fakturerbar = false, fakturerbar_anledning = 'prov'
           where id = '00000000-0000-4000-8000-00000000b4c1'$q$],
  '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
          values ('00000000-0000-4000-8000-0000000005e1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b4c1', 'x', current_date, 'narvarande')$q$],
  'ok');

select pg_temp.prova_med('14.2 spärren på: en öppnad betalsida är ingen betalning',
  array[$q$select pg_temp.sparren_pa()$q$,
        $q$update public.bookings set betalning_status = 'vantar' where id = '00000000-0000-4000-8000-00000000b4c1'$q$],
  '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
          values ('00000000-0000-4000-8000-0000000005e1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b4c1', 'x', current_date, 'narvarande')$q$],
  'nekad');

select pg_temp.prova_med('14.2 spärren på: ett återbetalt pass är inte betalt',
  array[$q$select pg_temp.sparren_pa()$q$,
        $q$update public.bookings set betalning_status = 'aterbetald' where id = '00000000-0000-4000-8000-00000000b4c1'$q$],
  '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
          values ('00000000-0000-4000-8000-0000000005e1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b4c1', 'x', current_date, 'narvarande')$q$],
  'nekad');

-- Vägen runt rapporten: passet har redan en rapport, och
-- studiehjälparen försöker sätta genomfört direkt.
select pg_temp.prova_med('14.2 spärren på: direkt statusbyte på obetalt pass nekas',
  array[$q$select pg_temp.sparren_pa()$q$],
  '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set status = 'completed', attendance = 'narvarande'
          where id = '00000000-0000-4000-8000-00000000b4a2'$q$],
  'nekad');

-- Admin går förbi, som i resten av skydda_bokningsfalt. Det är vägen
-- för ett pass som ändå ska räknas, till exempel en betalning som
-- kommit in utanför Stripe.
select pg_temp.prova_med('14.2 spärren på: admin sätter genomfört ändå',
  array[$q$select pg_temp.sparren_pa()$q$],
  '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.bookings set status = 'completed', attendance = 'narvarande'
          where id = '00000000-0000-4000-8000-00000000b4a2'$q$],
  'ok');

-- ---------- flaggan ----------
select pg_temp.prova('14.2 studiehjälparen slår på spärren', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.flaggor set aktiv = true where kod = 'kortsparr'$q$], 'nekad');

select pg_temp.prova('14.2 familjen slår på spärren', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.flaggor set aktiv = true where kod = 'kortsparr'$q$], 'nekad');

-- Policyn släpper igenom admin. Att villkoret från Fas 19.2 ändå nekar
-- prövas under Fas 19.2; här är det lyft, så att det är policyn som mäts.
select pg_temp.prova_med('14.2 admin slår på spärren, med villkoret från 19.2 lyft',
  array[$q$alter table public.flaggor drop constraint flaggor_kortsparr_av$q$],
  '00000000-0000-4000-8000-0000000000ad',
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
  array[$q$select pg_temp.sparren_pa()$q$,
        $q$update public.bookings set betalning_status = 'faktura' where id = '00000000-0000-4000-8000-00000000b6d1'$q$],
  '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
          values ('00000000-0000-4000-8000-0000000005f6', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b6d1', 'x', current_date, 'narvarande')$q$,
        $q$select 1 from public.bookings where id = '00000000-0000-4000-8000-00000000b6d1' and status = 'completed'$q$],
  'ok');

-- Samma pass som kortpass: undantaget får inte ha öppnat spärren.
select pg_temp.prova_med('14.6 spärren på: ett obetalt kortpass nekas fortfarande',
  array[$q$select pg_temp.sparren_pa()$q$],
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

select pg_temp.prova('14.6 admin skriver in fakturanumret från Fortnox', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.invoices set fortnox_fakturanummer = '1042', status = 'skickad',
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
    update public.invoices set fortnox_fakturanummer = '<script>'
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

-- ------------------------------------------------------------
-- Fas 16.1: beskeden till den som söker jobb
-- ------------------------------------------------------------

-- En ansökan utifrån får ett kvitto i kön och ingenting annat, och
-- inget av Nextrums fält går att skriva in utifrån. Skrivs som anon,
-- läses som admin: anon får inte läsa applications, så en läsning som
-- anon hade gett noll av fel skäl (se 10.4 ovan).
do $$
declare
  kvitto bigint; ovrigt bigint; skyddad bigint; plus text; fel text;
begin
  begin
    perform pg_temp.bli(null);
    insert into public.applications (id, name, email, created_at, mote_tid, mote_lank, status, intervju_at)
    values ('00000000-0000-4000-8000-0000000016a1', 'Prov Sökande', 'rls-161@example.invalid',
            '2000-01-01', now() + interval '1 day', 'https://ond.example/logga-in', 'approved', now());
    insert into public.applications (id, name, email)
    values ('00000000-0000-4000-8000-0000000016a2', 'Prov Plus', 'rls-plus@example.invalid');
    insert into public.applications (id, name, email)
    values ('00000000-0000-4000-8000-0000000016a3', 'Prov Plus', '  RLS-plus+2@example.invalid ');

    perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
    select count(*) into kvitto from public.ansokan_utskick
     where ansokan_id = '00000000-0000-4000-8000-0000000016a1' and steg = 'mottagen' and status = 'vantar';
    select count(*) into ovrigt from public.ansokan_utskick
     where ansokan_id = '00000000-0000-4000-8000-0000000016a1' and steg <> 'mottagen';
    select count(*) into skyddad from public.applications
     where id = '00000000-0000-4000-8000-0000000016a1'
       and created_at > now() - interval '1 minute'
       and mote_tid is null and mote_lank is null and status = 'new' and intervju_at is null;
    select status into plus from public.ansokan_utskick
     where ansokan_id = '00000000-0000-4000-8000-0000000016a3';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', null, true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('16.1 ansökan utifrån', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('16.1 en ansökan utifrån får ett kvitto i kön', kvitto = 1, 'rader: ' || kvitto),
      ('16.1 och inget stegmejl, vad raden än påstår', ovrigt = 0, 'rader: ' || ovrigt),
      ('16.1c tid, möte, läge och intervju utifrån skrivs över', skyddad = 1, 'rader: ' || skyddad),
      ('16.1c samma adress med plustillägg och versaler bromsas', plus = 'bromsad', 'status: ' || coalesce(plus, 'ingen rad'));
  end if;
end $$;

-- Samma rättelse i leads: kvittobromsen i lead-notis och analysvyerna
-- räknar på created_at, och en tid den som postar väljer själv
-- bromsar ingenting.
do $$
declare n bigint; fel text;
begin
  begin
    perform pg_temp.bli(null);
    insert into public.leads (parent_name, email, subject, tjanst, created_at)
    values ('Prov Bakdaterad', 'rls-bakdat@example.invalid', 'Matte', 'laxhjalp', '2000-01-01');
    reset role;
    perform set_config('request.jwt.claims', null, true);
    select count(*) into n from public.leads
     where email = 'rls-bakdat@example.invalid' and created_at > now() - interval '1 minute';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', null, true);
  insert into utfall (test, ok, detalj)
  values ('16.1c en intresseanmälan utifrån kan inte bakdateras', fel = 'rulla tillbaka' and n = 1,
          case when fel = 'rulla tillbaka' then 'rader med dagens tid: ' || n else fel end);
end $$;

-- Stegen: vad admin gör, och vad som köas av det. Körs som admin, med
-- ansökan skapad som postgres så att bara stegmejlen mäts.
do $$
declare
  mote1 bigint; mote2 bigint; mote3 bigint; utb bigint; nej bigint; fel text;
  a constant uuid := '00000000-0000-4000-8000-0000000016b1';
begin
  begin
    insert into public.applications (id, name, email)
    values (a, 'Prov Steg', 'rls-steg@example.invalid');

    perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
    update public.applications set mote_tid = date_trunc('minute', now()) + interval '2 days',
                                   mote_lank = 'https://meet.example.com/abc' where id = a;
    update public.applications set mote_lank = 'https://meet.example.com/abc' where id = a;
    select count(*) into mote1 from public.ansokan_utskick where ansokan_id = a and steg = 'mote';
    update public.applications set mote_tid = date_trunc('minute', now()) + interval '3 days' where id = a;
    select count(*) into mote2 from public.ansokan_utskick where ansokan_id = a and steg = 'mote';
    -- Ett möte som redan varit mejlas inte.
    update public.applications set mote_tid = now() - interval '1 day' where id = a;
    select count(*) into mote3 from public.ansokan_utskick where ansokan_id = a and steg = 'mote';

    update public.applications set intervju_at = now() where id = a;
    update public.applications set intervju_at = null where id = a;
    update public.applications set intervju_at = now() where id = a;
    select count(*) into utb from public.ansokan_utskick where ansokan_id = a and steg = 'utbildning';

    update public.applications set status = 'rejected', utbildad_at = now() where id = a;
    select count(*) into nej from public.ansokan_utskick where ansokan_id = a and steg in ('sista_steget', 'valkommen');
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', null, true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('16.1 stegen', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('16.1 ett bokat möte köar ett mejl, samma tid igen inget', mote1 = 1, 'rader: ' || mote1),
      ('16.1 en ny tid köar ett nytt', mote2 = 2, 'rader: ' || mote2),
      ('16.1 en tid som redan varit köar inget', mote3 = 2, 'rader: ' || mote3),
      ('16.1 mötet hållet, ångrat och hållet igen mejlas en gång', utb = 1, 'rader: ' || utb),
      ('16.1 en avböjd ansökan köar inget, inte heller för andra steg', nej = 0, 'rader: ' || nej);
  end if;
end $$;

-- Vem som ser beskeden och vem som kan låna en rad. En rad finns, så
-- att noll betyder "får inte se", inte "finns inget".
insert into public.applications (id, name, email)
values ('00000000-0000-4000-8000-0000000016c1', 'Prov Läs', 'rls-las@example.invalid');

select pg_temp.rakna('16.1 admin ser ansökans besked', '00000000-0000-4000-8000-0000000000ad',
  $q$select count(*) from public.ansokan_utskick where ansokan_id = '00000000-0000-4000-8000-0000000016c1'$q$, 1);

select pg_temp.rakna('16.1 en studiehjälpare ser dem inte', '00000000-0000-4000-8000-0000000000a1',
  $q$select count(*) from public.ansokan_utskick where ansokan_id = '00000000-0000-4000-8000-0000000016c1'$q$, 0);

select pg_temp.prova('16.1 anon kan inte låna en rad ur kön', null,
  array[$q$select * from public.ansokan_besked_ta('00000000-0000-4000-8000-000000000000')$q$],
  'nekad');

select pg_temp.prova('16.1 inte en inloggad heller', '00000000-0000-4000-8000-0000000000f1',
  array[$q$select * from public.ansokan_besked_ta('00000000-0000-4000-8000-000000000000')$q$],
  'nekad');

select pg_temp.prova('16.1 och ingen kan markera ett besked skickat', '00000000-0000-4000-8000-0000000000ad',
  array[$q$select public.ansokan_besked_klar('00000000-0000-4000-8000-000000000000', true, null, null, false)$q$],
  'nekad');

-- ------------------------------------------------------------
-- Fas 22.1: utbildningsprovet
-- ------------------------------------------------------------

-- En ansökan utifrån kan inte öppna ett prov åt sig själv: sista
-- dagen, nyckeln och mötet sätts av Nextrum. Påminnelsejobbet mejlar
-- varje rad med en satt sista dag, så det här är skyddet mot att
-- formuläret blir ett sätt att få oss att mejla främlingar.
do $$
declare skyddad bigint; fel text;
begin
  begin
    perform pg_temp.bli(null);
    insert into public.applications (id, name, email, utbildningsmote_at, prov_sista_dag, prov_nyckel, prov_godkant_at)
    values ('00000000-0000-4000-8000-0000000022a1', 'Prov Prov', 'rls-221@example.invalid',
            now(), current_date + 3, '00000000-0000-4000-8000-0000000022ff', now());
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
    select count(*) into skyddad from public.applications
     where id = '00000000-0000-4000-8000-0000000022a1'
       and utbildningsmote_at is null and prov_sista_dag is null
       and prov_nyckel is null and prov_godkant_at is null;
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', null, true);
  insert into utfall (test, ok, detalj)
  values ('22.1 provets fält går inte att sätta utifrån', fel = 'rulla tillbaka' and skyddad = 1,
          case when fel = 'rulla tillbaka' then 'rader: ' || skyddad else fel end);
end $$;

-- Admin markerar mötet: provet öppnas i tre dagar räknat i svensk tid,
-- en nyckel skapas, och länken köas en gång. Klarar hen provet blir
-- hen utbildad och mejlet om kontot köas. 23 av 30 räcker inte, och
-- det elfte försöket samma dygn tas inte emot.
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-0000000022b1';
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  r public.applications%rowtype;
  provmejl bigint; stangt date; under record; over record; konto bigint;
  tak text; fel text; n int;
begin
  begin
    insert into public.applications (id, name, email, status)
    values (a, 'Prov Utbildning', 'rls-utb@example.invalid', 'contacted');

    perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
    update public.applications set utbildningsmote_at = now() where id = a;
    update public.applications set utbildningsmote_at = null where id = a;
    select prov_sista_dag into stangt from public.applications where id = a;
    update public.applications set utbildningsmote_at = now() where id = a;
    select * into r from public.applications where id = a;
    select count(*) into provmejl from public.ansokan_utskick where ansokan_id = a and steg = 'prov';
    reset role;
    perform set_config('request.jwt.claims', null, true);

    select * into under from public.utbildningsprov_lamna(r.prov_nyckel, 23, 30, '{}');
    select * into over from public.utbildningsprov_lamna(r.prov_nyckel, 24, 30, '{}');
    select count(*) into konto from public.ansokan_utskick where ansokan_id = a and steg = 'sista_steget';

    -- Taket: en ny ansökan, tio underkända, och ett elfte.
    update public.applications set prov_godkant_at = null, utbildad_at = null where id = a;
    delete from public.utbildningsprov_forsok where ansokan_id = a;
    for n in 1..10 loop perform public.utbildningsprov_lamna(r.prov_nyckel, 1, 30, '{}'); end loop;
    select utfall into tak from public.utbildningsprov_lamna(r.prov_nyckel, 30, 30, '{}');
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', null, true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('22.1 provet', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('22.1 mötet öppnar provet till och med dag tre', r.prov_sista_dag = idag + 3 and r.prov_nyckel is not null,
       coalesce(r.prov_sista_dag::text, 'null') || ' mot ' || (idag + 3)),
      ('22.1 att ångra mötet stänger provet', stangt is null, coalesce(stangt::text, 'null')),
      ('22.1 länken köas en gång, också när mötet ångras och markeras igen', provmejl = 1, 'rader: ' || provmejl),
      ('22.1 23 av 30 är inte godkänt', under.utfall = 'ok' and not under.godkant, under::text),
      ('22.1 24 av 30 är godkänt, och mejlet om kontot köas', over.godkant and konto = 1,
       over::text || ' konto: ' || konto),
      ('22.1 elfte försöket samma dygn tas inte emot', tak = 'for_manga', coalesce(tak, 'null'));
  end if;
end $$;

select pg_temp.prova('22.1 anon läser inte provets läge', null,
  array[$q$select * from public.utbildningsprov_lage('00000000-0000-4000-8000-000000000000')$q$],
  'nekad');

select pg_temp.prova('22.1 anon lämnar inte in ett försök förbi funktionen', null,
  array[$q$select * from public.utbildningsprov_lamna('00000000-0000-4000-8000-000000000000', 30, 30, '{}')$q$],
  'nekad');

select pg_temp.prova('22.1 inte en inloggad heller', '00000000-0000-4000-8000-0000000000f1',
  array[$q$select * from public.utbildningsprov_lamna('00000000-0000-4000-8000-000000000000', 30, 30, '{}')$q$],
  'nekad');

insert into public.applications (id, name, email) values
  ('00000000-0000-4000-8000-0000000022c1', 'Prov Försök', 'rls-forsok@example.invalid');
insert into public.utbildningsprov_forsok (ansokan_id, ratt, antal, godkant)
values ('00000000-0000-4000-8000-0000000022c1', 20, 30, false);

select pg_temp.rakna('22.1 admin ser provförsöken', '00000000-0000-4000-8000-0000000000ad',
  $q$select count(*) from public.utbildningsprov_forsok where ansokan_id = '00000000-0000-4000-8000-0000000022c1'$q$, 1);

select pg_temp.rakna('22.1 en studiehjälpare ser dem inte', '00000000-0000-4000-8000-0000000000a1',
  $q$select count(*) from public.utbildningsprov_forsok where ansokan_id = '00000000-0000-4000-8000-0000000022c1'$q$, 0);

select pg_temp.prova('22.1 admin skriver inga försök själv', '00000000-0000-4000-8000-0000000000ad',
  array[$q$insert into public.utbildningsprov_forsok (ansokan_id, ratt, antal, godkant)
           values ('00000000-0000-4000-8000-0000000022c1', 30, 30, true)$q$],
  'nekad');

-- ------------------------------------------------------------
-- Fas 16.2: kvittot till familjen bromsas som ansökningskvittot
-- ------------------------------------------------------------
-- Sviten har redan lagt in anmälningar tidigare i samma transaktion,
-- och de har alla now() som tid. Utan det första uppdraget slår
-- minuttaket till före adresskontrollen, och provet mäter fel broms.
-- Bara fixturerna flyttas (example.invalid), och allt rullas tillbaka.
do $$
declare samma text; annan text; flod text; fel text;
begin
  begin
    update public.leads set created_at = now() - interval '2 days' where email like '%@example.invalid';
    insert into public.leads (id, parent_name, email, subject, tjanst)
    values ('00000000-0000-4000-8000-0000000016d1', 'Prov Kvitto', 'rls-kvitto@example.invalid', 'Matte', 'laxhjalp');
    samma := public.lead_kvitto_broms('  RLS-kvitto+2@example.invalid ', '00000000-0000-4000-8000-0000000016d2');
    annan := public.lead_kvitto_broms('rls-kvitto-annan@example.invalid', null);
    insert into public.leads (parent_name, email, subject, tjanst)
    select 'Prov Flod', 'rls-flod' || g || '@example.invalid', 'Matte', 'laxhjalp' from generate_series(1, 6) g;
    flod := public.lead_kvitto_broms('rls-flod-ny@example.invalid', null);
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('16.2 kvittobromsen', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('16.2 samma adress med plustillägg och versaler bromsas', samma like 'Adressen%', coalesce(samma, 'släpptes igenom')),
      ('16.2 en ny adress släpps igenom', annan is null, coalesce(annan, 'släpptes igenom')),
      ('16.2 fler än fem på en minut bromsas', flod like 'Fler än fem%', coalesce(flod, 'släpptes igenom'));
  end if;
end $$;

select pg_temp.prova('16.2 anon kan inte fråga bromsen', null,
  array[$q$select public.lead_kvitto_broms('x@example.invalid', null)$q$], 'nekad');

select pg_temp.prova('16.2 inte admin heller', '00000000-0000-4000-8000-0000000000ad',
  array[$q$select public.lead_kvitto_broms('x@example.invalid', null)$q$], 'nekad');

-- ============================================================
-- FAS 16.1 — planer och klippkort
--
-- Katalogen och priset läses av alla, också anon (prissidan). Köpen
-- läses bara av familjen själv och admin, och skrivs av ingen utom
-- service_role: ingen skrivpolicy, som payouts. Timmarna dras bara i
-- klippkort_dra(), som bara service_role når. Proven som drar timmar
-- körs därför som postgres i egna block, och rullas tillbaka där.
--
-- EGNA FIXTURER: ett barn, två pass om sex dagar (ett med ett barn,
-- ett med två) och ett betalt klippkort på tio timmar.
-- ============================================================
insert into public.students (id, parent_id, name, matched_tutor_id, match_status, created_at) values
  ('00000000-0000-4000-8000-000000000516', '00000000-0000-4000-8000-0000000000f1', 'Klippkortsprov',
   '00000000-0000-4000-8000-0000000000a1', 'matched', now());

insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status, antal_barn) values
  ('00000000-0000-4000-8000-00000000b16a', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
   '00000000-0000-4000-8000-000000000516', '00000000-0000-4000-8000-0000000000f1',
   (now() at time zone 'Europe/Stockholm')::date + 6, '09:00', 60, 'confirmed', 1),
  ('00000000-0000-4000-8000-00000000b16b', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
   '00000000-0000-4000-8000-000000000516', '00000000-0000-4000-8000-0000000000f1',
   (now() at time zone 'Europe/Stockholm')::date + 6, '11:00', 60, 'confirmed', 2);

insert into public.klippkort (id, parent_id, erbjudande, namn, sort, timmar, giltig_manader, rabatt_procent,
                              timpris_ore, begart_ore, betalt_ore, status, giltigt_till, betald_at, stripe_charge_id) values
  ('00000000-0000-4000-8000-00000000c16a', '00000000-0000-4000-8000-0000000000f1', 'klipp10', 'Klippkort 10 timmar',
   'klippkort', 10, 6, 5, 37900, 360000, 360000, 'betald',
   ((now() at time zone 'Europe/Stockholm')::date + interval '6 months')::date, now(), 'ch_rlsprov_16_1');

-- ---------- katalogen och priset ----------
select pg_temp.rakna('16.1 anon läser samma priser som databasen', null,
  'select count(*) from public.erbjudanden_pris', (select count(*) from public.erbjudanden_pris));

select pg_temp.rakna('16.1 anon ser minst en plan och ett klippkort', null,
  $q$select count(distinct sort) from public.erbjudanden_pris$q$, 2);

select pg_temp.rakna('16.1d summan är timpriset gånger timmarna', null,
  'select count(*) from public.erbjudanden_pris where pris_ore <> timmar * rabatterat_timpris_ore', 0);

select pg_temp.prova('16.1 familjen ändrar inte katalogen', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.erbjudanden set rabatt_procent = 50 where kod = 'klipp10'$q$],
  'nekad');

-- ---------- köpen ----------
select pg_temp.rakna('16.1 anon läser inga köp', null,
  'select count(*) from public.klippkort', 0);

select pg_temp.prova('16.1 anon når inte saldot', null,
  array['select * from public.klippkort_saldo'],
  'nekad');

select pg_temp.rakna('16.1 familj P ser sitt kort', '00000000-0000-4000-8000-0000000000f1',
  $q$select count(*) from public.klippkort_saldo where id = '00000000-0000-4000-8000-00000000c16a'$q$, 1);

select pg_temp.rakna('16.1 familj Q ser inte P:s kort', '00000000-0000-4000-8000-0000000000f2',
  'select count(*) from public.klippkort_saldo', 0);

select pg_temp.rakna('16.1 studiehjälparen ser inga köp', '00000000-0000-4000-8000-0000000000a1',
  'select count(*) from public.klippkort', 0);

select pg_temp.rakna('16.1 admin ser kortet', '00000000-0000-4000-8000-0000000000ad',
  $q$select count(*) from public.klippkort_saldo where id = '00000000-0000-4000-8000-00000000c16a'$q$, 1);

select pg_temp.prova('16.1 familjen skapar inget kort själv', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.klippkort (parent_id, erbjudande, namn, sort, timmar, giltig_manader, rabatt_procent,
                                         timpris_ore, begart_ore, status, giltigt_till)
          values ('00000000-0000-4000-8000-0000000000f1', 'klipp100', 'x', 'klippkort', 100, 18, 5,
                  37900, 100, 'betald', current_date + 500)$q$],
  'nekad');

select pg_temp.prova('16.1 familjen ändrar inte sitt kort', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.klippkort set timmar = 100 where id = '00000000-0000-4000-8000-00000000c16a'$q$],
  'nekad');

-- ---------- timmarna dras bara av systemet ----------
select pg_temp.prova('16.1 familjen drar inga timmar själv', '00000000-0000-4000-8000-0000000000f1',
  array[$q$select public.klippkort_dra('00000000-0000-4000-8000-00000000b16a', '00000000-0000-4000-8000-0000000000f1')$q$],
  'nekad');

select pg_temp.prova('16.1 familjen sätter inte kortet på ett pass', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set klippkort_id = '00000000-0000-4000-8000-00000000c16a'
          where id = '00000000-0000-4000-8000-00000000b16a'$q$],
  'nekad');

-- Kontrollprovet visar att förslaget annars går igenom, så att provet
-- efter det nekas för klippkortets skull och inte för något annat.
select pg_temp.prova('16.1 kontroll: familjen föreslår ett pass', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-000000000516', '00000000-0000-4000-8000-0000000000f1',
                  (now() at time zone 'Europe/Stockholm')::date + 10, '10:00', 60, 'requested')$q$],
  'ok');

select pg_temp.prova('16.1 familjen föreslår inget pass som redan bär ett kort', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status, klippkort_id)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-000000000516', '00000000-0000-4000-8000-0000000000f1',
                  (now() at time zone 'Europe/Stockholm')::date + 10, '10:00', 60, 'requested',
                  '00000000-0000-4000-8000-00000000c16a')$q$],
  'nekad');

-- Fas 21.1: familjen avbokar ett pass betalt med timmar själv. Förut
-- nekades det som varje annat betalt pass (Fas 14.1). Skälet krävs som
-- för alla avbokningar, och ett pass med kortpengar på är låst som förut.
select pg_temp.prova_med('21.1 familjen avbokar inte ett timpass utan skäl',
  array[$q$select public.klippkort_dra('00000000-0000-4000-8000-00000000b16a', '00000000-0000-4000-8000-0000000000f1')$q$],
  '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set status = 'cancelled' where id = '00000000-0000-4000-8000-00000000b16a'$q$],
  'nekad');

select pg_temp.prova_med('21.1 familjen avbokar ett pass betalt med timmar',
  array[$q$select public.klippkort_dra('00000000-0000-4000-8000-00000000b16a', '00000000-0000-4000-8000-0000000000f1')$q$],
  '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set status = 'cancelled', avbokningsskal = 'sjukdom'
          where id = '00000000-0000-4000-8000-00000000b16a'$q$],
  'ok');

select pg_temp.prova_med('21.1 studiehjälparen avbokar ett pass betalt med timmar',
  array[$q$select public.klippkort_dra('00000000-0000-4000-8000-00000000b16a', '00000000-0000-4000-8000-0000000000f1')$q$],
  '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set status = 'cancelled', avbokningsskal = 'forhinder'
          where id = '00000000-0000-4000-8000-00000000b16a'$q$],
  'ok');

select pg_temp.prova_med('21.1 ett timpass med kortpengar på avbokas inte av familjen',
  array[$q$select public.klippkort_dra('00000000-0000-4000-8000-00000000b16a', '00000000-0000-4000-8000-0000000000f1')$q$,
        $q$update public.bookings set betalt_ore = 37900 where id = '00000000-0000-4000-8000-00000000b16a'$q$],
  '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set status = 'cancelled', avbokningsskal = 'sjukdom'
          where id = '00000000-0000-4000-8000-00000000b16a'$q$],
  'nekad');

select pg_temp.prova_med('21.1 familjen avbokar inte ett pass betalt med kort',
  array[$q$update public.bookings set betalning_status = 'betald', betalt_ore = 37900, betald_at = now()
          where id = '00000000-0000-4000-8000-00000000b16a'$q$],
  '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set status = 'cancelled', avbokningsskal = 'sjukdom'
          where id = '00000000-0000-4000-8000-00000000b16a'$q$],
  'nekad');

-- Familjens avbokning: timmen tillbaka, passet obetalt, inget larm.
do $$
declare
  kvar1 int; kvar2 int; st text; larm int; fel text;
begin
  begin
    perform public.klippkort_dra('00000000-0000-4000-8000-00000000b16a', '00000000-0000-4000-8000-0000000000f1');
    select kvar into kvar1 from public.klippkort_saldo where id = '00000000-0000-4000-8000-00000000c16a';
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000f1');
    update public.bookings set status = 'cancelled', avbokningsskal = 'sjukdom'
     where id = '00000000-0000-4000-8000-00000000b16a';
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select kvar into kvar2 from public.klippkort_saldo where id = '00000000-0000-4000-8000-00000000c16a';
    select betalning_status into st from public.bookings where id = '00000000-0000-4000-8000-00000000b16a';
    select count(*) into larm from public.avvikelser_rader()
     where typ = 'betald_men_avbokad' and objekt_id = '00000000-0000-4000-8000-00000000b16a';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('21.1 familjens avbokning', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('21.1 familjen avbokar: timmen kommer tillbaka', kvar1 = 9 and kvar2 = 10, kvar1 || ' → ' || kvar2),
    ('21.1 familjens avbokade timpass är inte betalt', st = 'ingen', 'status ' || st),
    ('21.1 och larmar inte som betalt men avbokat', larm = 0, 'rader: ' || larm);
end $$;

-- Dragningen, avbokningen och pengarna tillbaka, i ett block som postgres.
do $$
declare
  svar jsonb; kvar1 int; st1 text; kk1 uuid; bo1 int;
  kvar2 int; st2 text; larm int;
  anger int; uppsag int; frist date;
  fel text;
begin
  begin
    svar := public.klippkort_dra('00000000-0000-4000-8000-00000000b16a', '00000000-0000-4000-8000-0000000000f1');
    select kvar, vid_anger_ore, vid_uppsagning_ore, angerfrist_till into kvar1, anger, uppsag, frist
      from public.klippkort_saldo where id = '00000000-0000-4000-8000-00000000c16a';
    select betalning_status, klippkort_id, betalt_ore into st1, kk1, bo1
      from public.bookings where id = '00000000-0000-4000-8000-00000000b16a';

    perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
    update public.bookings set status = 'cancelled' where id = '00000000-0000-4000-8000-00000000b16a';
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select kvar into kvar2 from public.klippkort_saldo where id = '00000000-0000-4000-8000-00000000c16a';
    select betalning_status into st2 from public.bookings where id = '00000000-0000-4000-8000-00000000b16a';
    select count(*) into larm from public.avvikelser_rader()
     where typ = 'betald_men_avbokad' and objekt_id = '00000000-0000-4000-8000-00000000b16a';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('16.1 dragningen', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('16.1 systemet drar en timme för ett pass på en timme',
     (svar->>'ok')::boolean is true and kvar1 = 9, 'svar ' || svar::text || ', kvar ' || kvar1),
    ('16.1 passet blir betalt med kortet, utan kortbelopp',
     st1 = 'betald' and kk1 = '00000000-0000-4000-8000-00000000c16a' and bo1 is null,
     'status ' || st1 || ', betalt_ore ' || coalesce(bo1::text, 'null')),
    ('16.1e inom fristen räknas timmen till det betalda priset',
     anger = 360000 - 36000, 'vid_anger_ore ' || anger),
    ('16.1e efter fristen räknas timmen till ordinarie pris',
     uppsag = 360000 - 37900, 'vid_uppsagning_ore ' || uppsag),
    ('16.1e fristen är fjorton dagar från köpet',
     frist = (now() at time zone 'Europe/Stockholm')::date + 14, 'angerfrist_till ' || frist),
    ('16.1 admin avbokar: timmen kommer tillbaka', kvar2 = 10, 'kvar ' || kvar2),
    ('16.1c ett avbokat klippkortspass är inte betalt', st2 = 'ingen', 'status ' || st2),
    ('16.1c och larmar inte som betalt men avbokat', larm = 0, 'rader: ' || larm);
end $$;

-- Det dragningen vägrar. Varje svar är ett besked, inte ett fel.
do $$
declare
  tva jsonb; annan jsonb; utgangen jsonb; tvist jsonb; fel text;
begin
  begin
    tva := public.klippkort_dra('00000000-0000-4000-8000-00000000b16b', '00000000-0000-4000-8000-0000000000f1');
    annan := public.klippkort_dra('00000000-0000-4000-8000-00000000b16a', '00000000-0000-4000-8000-0000000000f2');
    update public.klippkort set giltigt_till = (now() at time zone 'Europe/Stockholm')::date - 1
     where id = '00000000-0000-4000-8000-00000000c16a';
    utgangen := public.klippkort_dra('00000000-0000-4000-8000-00000000b16a', '00000000-0000-4000-8000-0000000000f1');
    update public.klippkort set giltigt_till = (now() at time zone 'Europe/Stockholm')::date + 30, status = 'tvist'
     where id = '00000000-0000-4000-8000-00000000c16a';
    tvist := public.klippkort_dra('00000000-0000-4000-8000-00000000b16a', '00000000-0000-4000-8000-0000000000f1');
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('16.1 dragningen vägrar', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('16.1 ett pass med två barn betalas inte med timmar', tva ? 'fel', tva::text),
    ('16.1 en annan familj betalar inte passet med sina timmar', annan ? 'fel', annan::text),
    ('16.1 ett kort som gått ut drar inget', utgangen ? 'fel', utgangen::text),
    ('16.1 ett kort i tvist drar inget', tvist ? 'fel', tvist::text);
end $$;

-- ------------------------------------------------------------
-- Fas 18.1: Meet-länken
--
-- Länken läggs in som postgres i varje prov (prova_med), inte bland
-- fixturerna. Körs sviten mot en databas där migrationen saknas blir
-- det röda rader här, inte en krasch i fixturerna som tar hela
-- sviten med sig.
--
-- Passet b0d1 är familj P:s, hos studiehjälpare A, om en vecka.
-- ------------------------------------------------------------
select pg_temp.prova_med('18.1 familjen läser länken till sitt pass',
  array[$q$insert into public.pass_moten (booking_id, lank, rum)
          values ('00000000-0000-4000-8000-00000000b0d1', 'https://meet.google.com/abc-defg-hij', 'spaces/rlsprov')$q$],
  '00000000-0000-4000-8000-0000000000f1',
  array[$q$select 1 from public.pass_moten where booking_id = '00000000-0000-4000-8000-00000000b0d1'$q$],
  'ok');

select pg_temp.prova_med('18.1 studiehjälparen läser länken till sitt pass',
  array[$q$insert into public.pass_moten (booking_id, lank, rum)
          values ('00000000-0000-4000-8000-00000000b0d1', 'https://meet.google.com/abc-defg-hij', 'spaces/rlsprov')$q$],
  '00000000-0000-4000-8000-0000000000a1',
  array[$q$select 1 from public.pass_moten where booking_id = '00000000-0000-4000-8000-00000000b0d1'$q$],
  'ok');

select pg_temp.prova_med('18.1 admin läser länken',
  array[$q$insert into public.pass_moten (booking_id, lank, rum)
          values ('00000000-0000-4000-8000-00000000b0d1', 'https://meet.google.com/abc-defg-hij', 'spaces/rlsprov')$q$],
  '00000000-0000-4000-8000-0000000000ad',
  array[$q$select 1 from public.pass_moten where booking_id = '00000000-0000-4000-8000-00000000b0d1'$q$],
  'ok');

-- Länken är vägen in till ett barns pass. Den som inte hör till
-- passet ska inte ens se att den finns.
select pg_temp.prova_med('18.1 en annan familj ser inte länken',
  array[$q$insert into public.pass_moten (booking_id, lank, rum)
          values ('00000000-0000-4000-8000-00000000b0d1', 'https://meet.google.com/abc-defg-hij', 'spaces/rlsprov')$q$],
  '00000000-0000-4000-8000-0000000000f2',
  array[$q$select 1 from public.pass_moten where booking_id = '00000000-0000-4000-8000-00000000b0d1'$q$],
  'nekad');

select pg_temp.prova_med('18.1 en annan studiehjälpare ser inte länken',
  array[$q$insert into public.pass_moten (booking_id, lank, rum)
          values ('00000000-0000-4000-8000-00000000b0d1', 'https://meet.google.com/abc-defg-hij', 'spaces/rlsprov')$q$],
  '00000000-0000-4000-8000-0000000000b1',
  array[$q$select 1 from public.pass_moten where booking_id = '00000000-0000-4000-8000-00000000b0d1'$q$],
  'nekad');

select pg_temp.prova_med('18.1 anon ser inte länken',
  array[$q$insert into public.pass_moten (booking_id, lank, rum)
          values ('00000000-0000-4000-8000-00000000b0d1', 'https://meet.google.com/abc-defg-hij', 'spaces/rlsprov')$q$],
  null,
  array[$q$select 1 from public.pass_moten where booking_id = '00000000-0000-4000-8000-00000000b0d1'$q$],
  'nekad');

-- Bara google-meet, med service_role, skriver. En länk som familjen
-- kunde sätta hade kunnat leda studiehjälparen vart som helst.
select pg_temp.prova_med('18.1 familjen kan inte lägga in en länk',
  null,
  '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.pass_moten (booking_id, lank, rum)
          values ('00000000-0000-4000-8000-00000000b0d1', 'https://meet.google.com/abc-defg-hij', 'spaces/egen')$q$],
  'nekad');

select pg_temp.prova_med('18.1 studiehjälparen kan inte byta länken',
  array[$q$insert into public.pass_moten (booking_id, lank, rum)
          values ('00000000-0000-4000-8000-00000000b0d1', 'https://meet.google.com/abc-defg-hij', 'spaces/rlsprov')$q$],
  '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.pass_moten set lank = 'https://meet.google.com/zzz-zzzz-zzz'
          where booking_id = '00000000-0000-4000-8000-00000000b0d1'$q$],
  'nekad');

-- Tokenen till Nextrums Google-konto. Inte ens admin ser den med sin
-- egen token; adminvyn läser statusen i integrationer.
select pg_temp.prova_med('18.1 admin ser inte Google-nyckeln',
  array[$q$insert into public.google_koppling (konto, refresh_token, scopes)
          values ('info@nextrum.se', 'rls-prov', 'openid')$q$],
  '00000000-0000-4000-8000-0000000000ad',
  array[$q$select 1 from public.google_koppling$q$],
  'nekad');

-- Villkoret på kolumnen gäller också service_role, som går förbi RLS.
-- Ett fel i google-meet ska inte kunna spara en länk någon annanstans.
do $$
declare fel text;
begin
  begin
    insert into public.pass_moten (booking_id, lank, rum)
    values ('00000000-0000-4000-8000-00000000b0d1', 'https://meet.google.com.evil.example/abc-defg-hij', 'spaces/x');
    raise exception 'gick igenom';
  exception
    when check_violation then fel := 'nekad av villkoret';
    when others then fel := sqlerrm;
  end;
  insert into utfall (test, ok, detalj)
  values ('18.1 en länk utanför meet.google.com går inte att spara', fel = 'nekad av villkoret', fel);
end $$;

-- ------------------------------------------------------------
-- Fas 19.1: familjen bekräftar rapporten
--
-- Rapporten e0a2 hör till P:s barn Äldst. Bara P får bekräfta den,
-- bara i eget namn och bara med databasens klocka.
-- ------------------------------------------------------------

select pg_temp.prova('19.1 P bekräftar sitt barns rapport', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.rapport_bekraftelser (rapport_id) values ('00000000-0000-4000-8000-00000000e0a2')$q$],
  'ok');

select pg_temp.prova('19.1 Q bekräftar P:s rapport', '00000000-0000-4000-8000-0000000000f2',
  array[$q$insert into public.rapport_bekraftelser (rapport_id) values ('00000000-0000-4000-8000-00000000e0a2')$q$],
  'nekad');

select pg_temp.prova('19.1 studiehjälparen bekräftar åt familjen', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.rapport_bekraftelser (rapport_id) values ('00000000-0000-4000-8000-00000000e0a2')$q$],
  'nekad');

-- Admin ser allt, men en bekräftelse admin skrivit är inte familjens.
select pg_temp.prova('19.1 admin bekräftar åt familjen', '00000000-0000-4000-8000-0000000000ad',
  array[$q$insert into public.rapport_bekraftelser (rapport_id) values ('00000000-0000-4000-8000-00000000e0a2')$q$],
  'nekad');

select pg_temp.prova('19.1 anon bekräftar', null,
  array[$q$insert into public.rapport_bekraftelser (rapport_id) values ('00000000-0000-4000-8000-00000000e0a2')$q$],
  'nekad');

select pg_temp.prova('19.1 P bekräftar i Q:s namn', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.rapport_bekraftelser (rapport_id, foralder_id)
          values ('00000000-0000-4000-8000-00000000e0a2', '00000000-0000-4000-8000-0000000000f2')$q$],
  'nekad');

select pg_temp.prova('19.1 P bakdaterar sin bekräftelse', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.rapport_bekraftelser (rapport_id, bekraftad_at)
          values ('00000000-0000-4000-8000-00000000e0a2', now() - interval '30 days')$q$],
  'nekad');

-- En bekräftelse är något som hänt. Den går inte att ta tillbaka.
select pg_temp.prova('19.1 P tar bort sin bekräftelse', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.rapport_bekraftelser (rapport_id) values ('00000000-0000-4000-8000-00000000e0a2')$q$,
        $q$delete from public.rapport_bekraftelser where rapport_id = '00000000-0000-4000-8000-00000000e0a2'$q$],
  'nekad');

select pg_temp.prova_med('19.1 P ser sin bekräftelse',
  array[$q$insert into public.rapport_bekraftelser (rapport_id, foralder_id)
          values ('00000000-0000-4000-8000-00000000e0a2', '00000000-0000-4000-8000-0000000000f1')$q$],
  '00000000-0000-4000-8000-0000000000f1',
  array[$q$select 1 from public.rapport_bekraftelser where rapport_id = '00000000-0000-4000-8000-00000000e0a2'$q$],
  'ok');

select pg_temp.prova_med('19.1 Q ser inte P:s bekräftelse',
  array[$q$insert into public.rapport_bekraftelser (rapport_id, foralder_id)
          values ('00000000-0000-4000-8000-00000000e0a2', '00000000-0000-4000-8000-0000000000f1')$q$],
  '00000000-0000-4000-8000-0000000000f2',
  array[$q$select 1 from public.rapport_bekraftelser$q$],
  'nekad');

select pg_temp.prova_med('19.1 admin ser bekräftelsen',
  array[$q$insert into public.rapport_bekraftelser (rapport_id, foralder_id)
          values ('00000000-0000-4000-8000-00000000e0a2', '00000000-0000-4000-8000-0000000000f1')$q$],
  '00000000-0000-4000-8000-0000000000ad',
  array[$q$select 1 from public.rapport_bekraftelser where rapport_id = '00000000-0000-4000-8000-00000000e0a2'$q$],
  'ok');

-- ------------------------------------------------------------
-- Fas 19.2: spärren kortsparr går inte att slå på
--
-- Villkoren låter familjen betala efter passet, och spärren nekar just
-- den rapporten familjen ska bekräfta. Inte ens admin, som annars får
-- slå om flaggorna, kommer förbi villkoret. Nekat av villkoret och
-- inget annat: ett RLS-fel hade sett ut som ett skydd men betytt att
-- adminens knapp slutat fungera för alla flaggor.
-- ------------------------------------------------------------
do $$
declare fel text;
begin
  begin
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
    update public.flaggor set aktiv = true where kod = 'kortsparr';
    raise exception 'gick igenom';
  exception
    when check_violation then fel := 'nekad av villkoret';
    when others then fel := sqlerrm;
  end;
  insert into utfall (test, ok, detalj)
  values ('19.2 admin kan inte slå på kortsparr', fel = 'nekad av villkoret', fel);
end $$;

select pg_temp.prova('19.2 admin slår fortfarande om fakturaflaggan', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.flaggor set aktiv = not aktiv where kod = 'faktura'$q$],
  'ok');

-- ------------------------------------------------------------
-- Fas 20.1: passet debiteras på den tid det faktiskt hölls
--
-- Passet b0c1 är familj P:s, hos A, igår kl. 15, bokat på en timme.
-- 15:00–16:20 är 80 minuter och debiteras som 90 (påbörjad kvart).
-- Rapporten läggs in i varje prov för sig, så att inget prov ser ett
-- annat provs tid.
-- ------------------------------------------------------------
select pg_temp.prova('20.1 A rapporterar med samma tid som bokat, utan skäl', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid)
          values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b0c1', 'x', current_date, 'narvarande', '15:00', '16:00')$q$],
  'ok');

select pg_temp.prova('20.1 A rapporterar längre tid utan skäl', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid)
          values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b0c1', 'x', current_date, 'narvarande', '15:00', '16:20')$q$],
  'nekad');

select pg_temp.prova('20.1 A rapporterar längre tid med skäl', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid, avvikelse_skal)
          values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b0c1', 'x', current_date, 'narvarande', '15:00', '16:20',
                  'Provet på fredag, vi körde klart kapitlet')$q$],
  'ok');

-- Kontrollprovet visar att A annars får ändra sin rapport, så att de
-- två efter det nekas för tidens skull och inte för något annat.
select pg_temp.prova('20.1 kontroll: A ändrar anteckningen i efterhand', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (id, student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid)
          values ('00000000-0000-4000-8000-00000000e201', '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b0c1', 'x', current_date, 'narvarande', '15:00', '16:00')$q$,
        $q$update public.lesson_reports set raw_notes = 'y' where id = '00000000-0000-4000-8000-00000000e201'$q$],
  'ok');

select pg_temp.prova('20.1 A drar ut tiden i efterhand', '00000000-0000-4000-8000-0000000000a1',
  array[$q$insert into public.lesson_reports (id, student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid)
          values ('00000000-0000-4000-8000-00000000e201', '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-00000000b0c1', 'x', current_date, 'narvarande', '15:00', '16:00')$q$,
        $q$update public.lesson_reports set slut_tid = '17:00', avvikelse_skal = 'z' where id = '00000000-0000-4000-8000-00000000e201'$q$],
  'nekad');

select pg_temp.prova('20.1 A sätter en tid i efterhand på en rapport utan', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.lesson_reports set start_tid = '16:00', slut_tid = '19:00', avvikelse_skal = 'z'
          where id = '00000000-0000-4000-8000-00000000e0a2'$q$],
  'nekad');

select pg_temp.prova('20.1 familjen skriver inget tillägg själv', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.pass_tillagg (booking_id, minuter, begart_ore, status)
          values ('00000000-0000-4000-8000-00000000b0c1', 30, 1, 'betald')$q$],
  'nekad');

select pg_temp.prova('20.1 familjen sätter inte stripe_minuter på ett bokat pass', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set stripe_minuter = 180 where id = '00000000-0000-4000-8000-00000000b0d1'$q$],
  'nekad');

-- Siffrorna, som postgres, i ett block som rullas tillbaka.
do $$
declare
  deb int; betalda int; lon int; larm int; larm2 int; belopp bigint; fel text;
  deb_p int; lon_a int; syns_q int; syns_p int; kvar1 int; kvar2 int; lon_k int; ej int;
begin
  -- 1. Betalt i förväg för en timme, höll 80 minuter.
  begin
    update public.bookings set betalning_status = 'betald', betald_at = now(), betalt_ore = 37900, stripe_minuter = 60
     where id = '00000000-0000-4000-8000-00000000b0c1';
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid, avvikelse_skal)
    values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b0c1', 'x', current_date, 'narvarande', '15:00', '16:20', 'prov');
    select debiterade_min, betalda_min, lon_min into deb, betalda, lon
      from public.passunderlag where id = '00000000-0000-4000-8000-00000000b0c1';
    select count(*) into larm from public.avvikelser_rader()
     where typ = 'tillagg_obetalt' and objekt_id = '00000000-0000-4000-8000-00000000b0c1';

    -- Studiehjälparen och familjen läser samma vy med sin egen RLS.
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000a1');
    select lon_min into lon_a from public.passunderlag where id = '00000000-0000-4000-8000-00000000b0c1';
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000f1');
    select debiterade_min into deb_p from public.passunderlag where id = '00000000-0000-4000-8000-00000000b0c1';
    reset role;
    perform set_config('request.jwt.claims', '', true);

    insert into public.pass_tillagg (booking_id, minuter, begart_ore, status, betalt_ore, betald_at)
    values ('00000000-0000-4000-8000-00000000b0c1', 30, 18950, 'betald', 18950, now());
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000f1');
    select count(*) into syns_p from public.pass_tillagg;
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000f2');
    select count(*) into syns_q from public.pass_tillagg;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select count(*) into larm2 from public.avvikelser_rader()
     where typ = 'tillagg_obetalt' and objekt_id = '00000000-0000-4000-8000-00000000b0c1';
    select betalda_min, lon_min into betalda, lon_k
      from public.passunderlag where id = '00000000-0000-4000-8000-00000000b0c1';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('20.1 övertid på förbetalt pass', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('20.1 80 minuter debiteras som 90', deb = 90, 'debiterade_min ' || deb),
      ('20.1 obetald övertid höjer inte lönen', lon = 60, 'lon_min ' || lon),
      ('20.1 obetald övertid larmar', larm = 1, 'rader: ' || larm),
      ('20.1 studiehjälparen läser sin lön i vyn', lon_a = 60, 'lon_min ' || coalesce(lon_a::text, 'null')),
      ('20.1 familjen läser den debiterade tiden i vyn', deb_p = 90, 'debiterade_min ' || coalesce(deb_p::text, 'null')),
      ('20.1 familjen ser sitt tillägg', syns_p = 1, 'rader: ' || syns_p),
      ('20.1 en annan familj ser inte tillägget', syns_q = 0, 'rader: ' || syns_q),
      ('20.1 betalt tillägg: larmet går', larm2 = 0, 'rader: ' || larm2),
      ('20.1 betalt tillägg: övertiden räknas i lönen', betalda = 90 and lon_k = 90,
       'betalda_min ' || betalda || ', lon_min ' || lon_k);
  end if;

  -- 2. Betalt i förväg för en timme, höll en halv.
  fel := null;
  begin
    update public.bookings set betalning_status = 'betald', betald_at = now(), betalt_ore = 37900, stripe_minuter = 60
     where id = '00000000-0000-4000-8000-00000000b0c1';
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid, avvikelse_skal)
    values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b0c1', 'x', current_date, 'narvarande', '15:00', '15:30', 'prov');
    select lon_min into lon from public.passunderlag where id = '00000000-0000-4000-8000-00000000b0c1';
    select sum(a.belopp_ore) into belopp from public.avvikelser_rader() a
     where a.typ = 'betalt_for_lange' and a.objekt_id = '00000000-0000-4000-8000-00000000b0c1';
    update public.bookings set aterbetald_ore = 18950 where id = '00000000-0000-4000-8000-00000000b0c1';
    select count(*) into larm from public.avvikelser_rader()
     where typ = 'betalt_for_lange' and objekt_id = '00000000-0000-4000-8000-00000000b0c1';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('20.1 kortare än förbetalt', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('20.1 kortare pass sänker lönen', lon = 30, 'lon_min ' || lon),
      ('20.1 kortare pass larmar med halva beloppet', belopp = 18950, 'belopp ' || coalesce(belopp::text, 'null')),
      ('20.1 återbetalt: larmet går', larm = 0, 'rader: ' || larm);
  end if;

  -- 3. Betalt efter passet, för den hållna tiden.
  fel := null;
  begin
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid, avvikelse_skal)
    values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b0c1', 'x', current_date, 'narvarande', '15:00', '16:20', 'prov');
    select count(*) into ej from public.avvikelser_rader()
     where typ = 'ej_betalt' and objekt_id = '00000000-0000-4000-8000-00000000b0c1';
    update public.bookings set betalning_status = 'betald', betald_at = now(), betalt_ore = 56850, stripe_minuter = 90
     where id = '00000000-0000-4000-8000-00000000b0c1';
    select lon_min into lon from public.passunderlag where id = '00000000-0000-4000-8000-00000000b0c1';
    select count(*) into larm from public.avvikelser_rader()
     where typ in ('tillagg_obetalt', 'betalt_for_lange') and objekt_id = '00000000-0000-4000-8000-00000000b0c1';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('20.1 betalt efter passet', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('20.1 obetalt pass med övertid larmar som ej_betalt', ej = 1, 'rader: ' || ej),
      ('20.1 betalt för den hållna tiden: övertiden i lönen', lon = 90, 'lon_min ' || lon),
      ('20.1 betalt för den hållna tiden: inget tillägg, ingen återbetalning', larm = 0, 'rader: ' || larm);
  end if;

  -- 4. Klippkortet: ett pass på två timmar som höll i 50 minuter drar en.
  fel := null;
  begin
    update public.bookings set duration_min = 120 where id = '00000000-0000-4000-8000-00000000b16a';
    perform public.klippkort_dra('00000000-0000-4000-8000-00000000b16a', '00000000-0000-4000-8000-0000000000f1');
    select kvar into kvar1 from public.klippkort_saldo where id = '00000000-0000-4000-8000-00000000c16a';
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid, avvikelse_skal)
    values ('00000000-0000-4000-8000-000000000516', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b16a', 'x', current_date, 'narvarande', '09:00', '09:50', 'prov');
    select kvar into kvar2 from public.klippkort_saldo where id = '00000000-0000-4000-8000-00000000c16a';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('20.1 klippkortet', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('20.1 två bokade timmar drar två', kvar1 = 8, 'kvar ' || kvar1),
      ('20.1 höll 50 minuter: en timme tillbaka', kvar2 = 9, 'kvar ' || kvar2);
  end if;

  -- 5. Det som inte går att skriva in.
  fel := null;
  begin
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid)
    values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b0c1', 'x', current_date, 'franvarande', '15:00', '16:00');
    fel := 'gick igenom';
  exception when check_violation then fel := 'nekad';
  end;
  insert into utfall (test, ok, detalj) values ('20.1 ett uteblivet pass har ingen tid', fel = 'nekad', fel);

  fel := null;
  begin
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid)
    values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b0c1', 'x', current_date, 'narvarande', '16:00', '15:00');
    fel := 'gick igenom';
  exception when check_violation then fel := 'nekad';
  end;
  insert into utfall (test, ok, detalj) values ('20.1 slutet kommer efter början', fel = 'nekad', fel);
end $$;

-- ------------------------------------------------------------
-- Fas 20.2: månaden stängs i bokföringen
--
-- En egen månad för proven, ett halvår bakåt, med ett undantaget pass
-- (fakturerbar = false) och dess rapport: undantaget ger inga larm, så
-- månaden går att stänga. Det andra passet, som räknas, ger larm.
-- ------------------------------------------------------------
insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time,
                             duration_min, status, fakturerbar, fakturerbar_anledning) values
  ('00000000-0000-4000-8000-00000000b202', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
   '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1',
   (date_trunc('month', now() at time zone 'Europe/Stockholm') - interval '6 months')::date + 9, '15:00', 60,
   'completed', false, 'rlsprov');
insert into public.lesson_reports (id, student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro) values
  ('00000000-0000-4000-8000-00000000e202', '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
   '00000000-0000-4000-8000-00000000b202', 'fixtur', current_date, 'narvarande');

do $$
declare
  m date := (date_trunc('month', now() at time zone 'Europe/Stockholm') - interval '6 months')::date;
  fel text; lage jsonb; resultat text[] := '{}';
  steg text;
begin
  begin
    -- 1. Den pågående månaden går inte att stänga.
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
    begin
      perform public.stang_manad((now() at time zone 'Europe/Stockholm')::date);
      steg := 'gick igenom';
    exception when others then steg := sqlerrm;
    end;
    resultat := resultat || ('pågående|' || (steg = 'Månaden är inte slut än.')::text || '|' || steg);

    -- 2. En familj stänger ingenting, och läser inget bokslut.
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000f1');
    begin
      perform public.stang_manad(m);
      steg := 'gick igenom';
    exception when others then steg := sqlstate;
    end;
    resultat := resultat || ('familj|' || (steg = '42501')::text || '|' || steg);

    -- 3. Ett pass som räknas ger larm, och larm hindrar stängningen.
    reset role; perform set_config('request.jwt.claims', '', true);
    update public.bookings set fakturerbar = true, fakturerbar_anledning = null
     where id = '00000000-0000-4000-8000-00000000b202';
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
    lage := public.manad_lage(m);
    begin
      perform public.stang_manad(m);
      steg := 'gick igenom';
    exception when others then steg := sqlerrm;
    end;
    resultat := resultat || ('larm|' || (jsonb_array_length(lage -> 'larm') > 0 and steg like 'Månaden har % larm kvar.%')::text
                             || '|' || jsonb_array_length(lage -> 'larm') || ' larm, ' || steg);
    reset role; perform set_config('request.jwt.claims', '', true);
    update public.bookings set fakturerbar = false, fakturerbar_anledning = 'rlsprov'
     where id = '00000000-0000-4000-8000-00000000b202';

    -- 4. Utan larm stänger admin.
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
    lage := public.stang_manad(m);
    resultat := resultat || ('stängd|' || ((lage -> 'bokslut' ->> 'stangd')::boolean)::text || '|' || coalesce(lage -> 'bokslut' ->> 'stangd', 'null'));

    -- 5. Studiehjälparen ändrar närvaron: nekad. Texten: går igenom.
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000a1');
    begin
      update public.lesson_reports set narvaro = 'sen' where id = '00000000-0000-4000-8000-00000000e202';
      steg := 'gick igenom';
    exception when others then steg := sqlstate;
    end;
    resultat := resultat || ('närvaro|' || (steg = '42501')::text || '|' || steg);
    begin
      update public.lesson_reports set raw_notes = 'omskriven' where id = '00000000-0000-4000-8000-00000000e202';
      steg := 'gick igenom';
    exception when others then steg := sqlerrm;
    end;
    resultat := resultat || ('text|' || (steg = 'gick igenom')::text || '|' || steg);

    -- 6. Admin ändrar passet i den stängda månaden: nekad.
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
    begin
      update public.bookings set subject = 'Kemi' where id = '00000000-0000-4000-8000-00000000b202';
      steg := 'gick igenom';
    exception when others then steg := sqlstate;
    end;
    resultat := resultat || ('admin|' || (steg = '42501')::text || '|' || steg);

    -- 7. Systemet (webhooken, ingen inloggning) skriver igenom låset.
    reset role; perform set_config('request.jwt.claims', '', true);
    update public.bookings set aterbetald_ore = 0 where id = '00000000-0000-4000-8000-00000000b202';
    resultat := resultat || ('system|' || found::text || '|' || found::text);

    -- 8. Öppna kräver ett skäl, och sedan går ändringen igenom.
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
    begin
      perform public.oppna_manad(m, 'x');
      steg := 'gick igenom';
    exception when others then steg := sqlerrm;
    end;
    resultat := resultat || ('skäl|' || (steg = 'Skriv varför månaden öppnas.')::text || '|' || steg);
    lage := public.oppna_manad(m, 'Rättelse av ämnet på ett pass');
    update public.bookings set subject = 'Kemi' where id = '00000000-0000-4000-8000-00000000b202';
    resultat := resultat || ('öppnad|' || (found and not (lage -> 'bokslut' ->> 'stangd')::boolean)::text || '|' || found::text);

    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('20.2 bokslutet', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj)
  select '20.2 ' || case split_part(r, '|', 1)
           when 'pågående' then 'den pågående månaden går inte att stänga'
           when 'familj'   then 'en familj stänger ingen månad'
           when 'larm'     then 'larm i månaden hindrar stängningen'
           when 'stängd'   then 'admin stänger en månad utan larm'
           when 'närvaro'  then 'studiehjälparen ändrar inte närvaron i en stängd månad'
           when 'text'     then 'rapportens text går att skriva om i en stängd månad'
           when 'admin'    then 'admin ändrar inte ett pass i en stängd månad'
           when 'system'   then 'webhooken skriver igenom låset'
           when 'skäl'     then 'en månad öppnas inte utan skäl'
           when 'öppnad'   then 'öppnad månad går att ändra igen'
         end,
         split_part(r, '|', 2)::boolean, split_part(r, '|', 3)
    from unnest(resultat) r;
end $$;

select pg_temp.rakna('20.2 studiehjälparen läser inget bokslut', '00000000-0000-4000-8000-0000000000a1',
  'select count(*) from public.manadsbokslut', 0);

-- ------------------------------------------------------------
-- Fas 19.3: ett omdöme gäller passets egen studiehjälpare
--
-- b0e1 är P:s genomförda pass med A och barnet Äldst. Förut prövade
-- policyn bara att passet var P:s, så P kunde skriva om B, eller om
-- Q:s barn, genom att peka på b0e1.
-- ------------------------------------------------------------

select pg_temp.prova('19.3 P skriver omdöme om passets studiehjälpare', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.tutor_reviews (booking_id, tutor_id, parent_id, student_id, rating)
          values ('00000000-0000-4000-8000-00000000b0e1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000005a1', 5)$q$],
  'ok');

select pg_temp.prova('19.3 P skriver omdöme om en annan studiehjälpare', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.tutor_reviews (booking_id, tutor_id, parent_id, rating)
          values ('00000000-0000-4000-8000-00000000b0e1', '00000000-0000-4000-8000-0000000000b1',
                  '00000000-0000-4000-8000-0000000000f1', 1)$q$],
  'nekad');

select pg_temp.prova('19.3 P skriver omdöme om Q:s barn', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.tutor_reviews (booking_id, tutor_id, parent_id, student_id, rating)
          values ('00000000-0000-4000-8000-00000000b0e1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000005c1', 1)$q$],
  'nekad');

select pg_temp.prova('19.3 Q skriver omdöme på P:s pass', '00000000-0000-4000-8000-0000000000f2',
  array[$q$insert into public.tutor_reviews (booking_id, tutor_id, parent_id, rating)
          values ('00000000-0000-4000-8000-00000000b0e1', '00000000-0000-4000-8000-0000000000a1',
                  '00000000-0000-4000-8000-0000000000f2', 1)$q$],
  'nekad');

-- ------------------------------------------------------------
-- Fas 19.4: ingen triggerfunktion går att anropa utifrån
--
-- Att triggrarna ändå körs för anon och authenticated provas redan av
-- 16.1-raderna ovan (klippkortet på ett nytt pass nekas, kvittot till
-- den som söker köas). Den här raden fångar nästa triggerfunktion som
-- får EXECUTE av Supabases förval.
-- ------------------------------------------------------------
insert into utfall (test, ok, detalj)
select '19.4 ingen triggerfunktion går att anropa', count(*) = 0,
       coalesce(string_agg(p.oid::regprocedure::text, ', '), 'inga')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where p.prorettype = 'trigger'::regtype and n.nspname in ('public', 'intern')
   and (has_function_privilege('anon', p.oid, 'execute')
        or has_function_privilege('authenticated', p.oid, 'execute'));

-- ------------------------------------------------------------
-- Fas 19.5: priset fryses på passet, och första timmen bjuds
--
-- Familj Q har inga pass i fixturerna, så Q är en ny familj. Barnet
-- matchas med A inne i blocket, och allt rullas tillbaka i slutet.
-- Pass 1 (en timme) har fullt pris, pass 2 (en timme, föreslaget av
-- studiehjälparen) når två timmar och blir gratis, pass 3 har fullt pris.
-- ------------------------------------------------------------
do $$
declare
  qid uuid := '00000000-0000-4000-8000-0000000000f2';
  aid uuid := '00000000-0000-4000-8000-0000000000a1';
  sid uuid := '00000000-0000-4000-8000-0000000005c1';
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  r1 record; r2 record; r3 record;
  prisfel text; rabattfel text; kk jsonb; larm_gratis int; fel text;
begin
  begin
    update public.students set matched_tutor_id = aid, match_status = 'matched' where id = sid;

    perform pg_temp.bli(qid);
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status, timpris_ore, extra_ore)
    values ('00000000-0000-4000-8000-0000000019b1', qid, aid, sid, qid, idag + 5, '10:00', 60, 'requested', 100, 0);
    perform pg_temp.bli(aid);
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status)
    values ('00000000-0000-4000-8000-0000000019b2', qid, aid, sid, aid, idag + 6, '10:00', 60, 'requested');
    perform pg_temp.bli(qid);
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status)
    values ('00000000-0000-4000-8000-0000000019b3', qid, aid, sid, qid, idag + 7, '10:00', 120, 'requested');

    begin
      update public.bookings set timpris_ore = 1 where id = '00000000-0000-4000-8000-0000000019b3';
      prisfel := 'gick igenom';
    exception when others then prisfel := sqlstate;
    end;
    begin
      update public.bookings set startrabatt = false, rabatt_ore = null where id = '00000000-0000-4000-8000-0000000019b2';
      rabattfel := 'gick igenom';
    exception when others then rabattfel := sqlstate;
    end;

    reset role;
    perform set_config('request.jwt.claims', '', true);
    select timpris_ore, extra_ore, startrabatt, rabatt_ore into r1 from public.bookings where id = '00000000-0000-4000-8000-0000000019b1';
    select timpris_ore, extra_ore, startrabatt, rabatt_ore into r2 from public.bookings where id = '00000000-0000-4000-8000-0000000019b2';
    select timpris_ore, extra_ore, startrabatt, rabatt_ore into r3 from public.bookings where id = '00000000-0000-4000-8000-0000000019b3';

    -- Pass 2 hålls: ett pass på noll kronor larmar inte som obetalt,
    -- och klippkortet betalar det inte.
    -- Klockan 13: fixturen b4c1 (Fas 14.2) står redan i går klockan 10
    -- hos A, och på samma tid krockade passet med bookings_tutor_slot_unique.
    update public.bookings set status = 'confirmed', wanted_date = idag - 1, wanted_time = '13:00'
     where id = '00000000-0000-4000-8000-0000000019b2';
    kk := public.klippkort_dra('00000000-0000-4000-8000-0000000019b2', qid);
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
    values (sid, aid, '00000000-0000-4000-8000-0000000019b2', 'fixtur', current_date, 'narvarande');
    select count(*) into larm_gratis from public.avvikelser_rader()
     where typ = 'ej_betalt' and objekt_id = '00000000-0000-4000-8000-0000000019b2';

    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('19.5 priset och första timmen', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('19.5 familjens eget pris skrivs över med tjänstens', r1.timpris_ore = 37900 and r1.extra_ore = 6900,
     r1.timpris_ore || '/' || r1.extra_ore),
    ('19.5 första timmen har fullt pris', not r1.startrabatt and r1.rabatt_ore is null,
     r1.startrabatt || '/' || coalesce(r1.rabatt_ore::text, 'null')),
    ('19.5 andra timmen bjuds, också när studiehjälparen föreslår', r2.startrabatt and r2.rabatt_ore = 37900,
     r2.startrabatt || '/' || coalesce(r2.rabatt_ore::text, 'null')),
    ('19.5 tredje passet har fullt pris', not r3.startrabatt and r3.rabatt_ore is null,
     r3.startrabatt || '/' || coalesce(r3.rabatt_ore::text, 'null')),
    ('19.5 familjen ändrar inte priset', prisfel = '42501', prisfel),
    ('19.5 familjen tar inte bort rabatten', rabattfel = '42501', rabattfel),
    ('19.5 ett pass på noll kronor larmar inte som obetalt', larm_gratis = 0, larm_gratis::text),
    ('19.5 klippkortet betalar inte ett pass med startrabatt', kk->>'fel' like 'Första timmen%', kk::text);
end $$;

-- ============================================================
-- FAS 21.2 — påminnelsen tio dagar innan timmarna går ut
--
-- Körs som postgres, som schemat. Tiden skickas in (kl. 12 och kl. 3
-- svensk tid i dag), annars hade fönstret 9–20 avgjort om proven gick
-- igenom. Kortet är fixturen från 16.1, med tio timmar kvar.
-- ============================================================
do $$
declare
  idag   date := (now() at time zone 'Europe/Stockholm')::date;
  mitt   timestamptz := (idag + time '12:00') at time zone 'Europe/Stockholm';
  natt   timestamptz := (idag + time '03:00') at time zone 'Europe/Stockholm';
  langt  int; forsta int; igen int; nattn int; aterb int; nytt int;
  ko     record; ko_n int; val int; fel text;
begin
  begin
    update public.klippkort set giltigt_till = idag + 11 where id = '00000000-0000-4000-8000-00000000c16a';
    langt := intern.timmar_gar_ut_koa(mitt);

    update public.klippkort set giltigt_till = idag + 10 where id = '00000000-0000-4000-8000-00000000c16a';
    nattn := intern.timmar_gar_ut_koa(natt);
    forsta := intern.timmar_gar_ut_koa(mitt);
    igen := intern.timmar_gar_ut_koa(mitt);
    select count(*) into ko_n from public.notis_utskick where typ = 'timmar_gar_ut'
       and mottagare = '00000000-0000-4000-8000-0000000000f1';
    select * into ko from public.notis_utskick where typ = 'timmar_gar_ut'
       and mottagare = '00000000-0000-4000-8000-0000000000f1' limit 1;

    -- Nytt sista datum (admin förlänger): en ny påminnelse.
    update public.klippkort set giltigt_till = idag + 9 where id = '00000000-0000-4000-8000-00000000c16a';
    nytt := intern.timmar_gar_ut_koa(mitt);

    update public.klippkort set status = 'aterbetald', giltigt_till = idag + 8
     where id = '00000000-0000-4000-8000-00000000c16a';
    aterb := intern.timmar_gar_ut_koa(mitt);

    -- Familjen kan stänga av typen under Profil → Notiser.
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000f1');
    insert into public.notis_val (profil_id, typ, kanal, pa)
    values ('00000000-0000-4000-8000-0000000000f1', 'timmar_gar_ut', 'mejl', false);
    get diagnostics val = row_count;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('21.2 påminnelsen', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('21.2 elva dagar kvar: ingen påminnelse än', langt = 0, langt::text),
    ('21.2 ingen påminnelse klockan tre på natten', nattn = 0, nattn::text),
    ('21.2 tio dagar kvar: en påminnelse', forsta = 1, forsta::text),
    ('21.2 samma kort och dag påminns en gång', igen = 0 and ko_n = 1, igen || ', i kön ' || ko_n),
    ('21.2 mejlet bär timmarna kvar och sista dagen',
     (ko.data ->> 'kvar')::int = 10 and ko.data ->> 'datum' = (idag + 10)::text and ko.kanal = 'mejl',
     coalesce(ko.data::text, 'ingen rad')),
    ('21.2 mejlet går inte ut efter sista dagen',
     ko.skicka_senast = ((idag + 11)::timestamp at time zone 'Europe/Stockholm'),
     coalesce(ko.skicka_senast::text, 'null')),
    ('21.2 ett nytt sista datum ger en ny påminnelse', nytt = 1, nytt::text),
    ('21.2 ett återbetalt kort påminns inte', aterb = 0, aterb::text),
    ('21.2 familjen kan stänga av påminnelsen', val = 1, val::text);
end $$;

select pg_temp.prova('21.2 familjen kör inte påminnelsen själv', '00000000-0000-4000-8000-0000000000f1',
  array['select intern.timmar_gar_ut_koa()'],
  'nekad');

-- ============================================================
-- FAS 22.1 — timbanken
--
-- Samma fixturer som Fas 16.1 och 20.1: klippkortet c16a (tio timmar,
-- familj P), klippkortspassen b16a och b16b om sex dagar, och P:s pass
-- b0c1 (igår, en timme) och b0d1 (om en vecka, en timme), båda hos A.
-- Banken fylls i varje block för sig, som postgres, och rullas tillbaka.
-- Block 6 och 7 är rättelserna i timbanken_foljer_passet: övertiden
-- räknas från det kortet betalade, och uttagen följer passet när admin
-- ändrar det.
--
-- FIXTURERNA STÄLLS TILLBAKA HÄR, för timmarnas alla prov (22.1–22.4).
-- De är skrivna mot b0d1 bekräftat om en vecka, och mot b16a och b16b
-- som P:s enda andra pass som väntar på timmar. Så såg det inte ut när
-- hela filen kördes: blocket för Fas 9.3/9.4 avbokar b0d1 på riktigt,
-- och b6c1 från Fas 14.6 står bekräftat och obetalt om fem dagar, så
-- timmarna gav sig på det före provens egna pass. Sex prov föll eller
-- blev null (2026-09-28), och null syns inte som ett fel i en lista
-- över ok. Sedan det här kommer hit rör inget prov b6c1.
-- ============================================================
update public.bookings set status = 'confirmed', avbokad_at = null, avbokad_av = null, avbokningsskal = null
 where id = '00000000-0000-4000-8000-00000000b0d1';
update public.bookings set status = 'cancelled', avbokningsskal = 'annat'
 where id = '00000000-0000-4000-8000-00000000b6c1';

select pg_temp.prova('22.1 familjen skriver inte en kortbetalning genom timbanken', '00000000-0000-4000-8000-0000000000f1',
  array[$q$select public.timbank_kort_vinner('00000000-0000-4000-8000-00000000b0d1', '{}'::jsonb)$q$],
  'nekad');

select pg_temp.prova('22.1 familjen skriver inga minuter i banken själv', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.timbank_uttag (parent_id, booking_id, sort, minuter)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-00000000b0d1', 'pass', 60)$q$],
  'nekad');

select pg_temp.prova('22.1 familjen tar inte ut en utbetalning ur uttagen', '00000000-0000-4000-8000-0000000000f1',
  array[$q$delete from public.timbank_uttag where parent_id = '00000000-0000-4000-8000-0000000000f1'$q$],
  'nekad');

select pg_temp.prova('22.1 familjen betalar inte ett pass med banken förbi funktionen', '00000000-0000-4000-8000-0000000000f1',
  array[$q$select public.timbank_dra('00000000-0000-4000-8000-00000000b0d1', '00000000-0000-4000-8000-0000000000f1')$q$],
  'nekad');

select pg_temp.prova('22.1 familjen betalar inte ut sin egen bank', '00000000-0000-4000-8000-0000000000f1',
  array[$q$select public.timbank_utbetald('00000000-0000-4000-8000-0000000000f1')$q$],
  'nekad');

select pg_temp.prova('22.1 anon når inte saldot', null,
  array['select * from public.timbank_saldo'],
  'nekad');

select pg_temp.rakna('22.1 familj P ser sitt saldo', '00000000-0000-4000-8000-0000000000f1',
  $q$select count(*) from public.timbank_saldo where parent_id = '00000000-0000-4000-8000-0000000000f1'$q$, 1);

select pg_temp.rakna('22.1 familj Q ser inte P:s saldo', '00000000-0000-4000-8000-0000000000f2',
  $q$select count(*) from public.timbank_saldo where parent_id = '00000000-0000-4000-8000-0000000000f1'$q$, 0);

do $$
declare
  fel text; kvar int; s1 int; s2 int; s_a int; s_q int; s_p int; v_p int; v_a int;
  deb int; betalda int; bank int; lon int; larm int; ror int; efter_ratt int;
  s_del int; larm_del int; bank_del int; ej int; att_betala int;
  svar jsonb; svar_q jsonb; svar_lite jsonb; st text; s_hel int; s_avb int; st_avb text;
  vann boolean; st_vann text; s_vann int; ut jsonb; ut2 jsonb; s_ut int; flerbarn int;
  pi_vann text; min_vann int; tut_vann uuid; vann2 boolean; vann_fel boolean; st_fel text;
  s_kort int; bank_kort int; betalda_kort int; larm_kort int;
  u_lang int; s_lang int; s_tillbaka int; s_barn int; bank_barn int; s_barn1 int;
  s_undantag int; s_langd int;
begin
  -- 1. Ett klippkortspass på två timmar höll 1 h 15: två timmar dras, 45
  --    minuter går in. Nästa pass, betalt med kort, drog över en kvart,
  --    och banken tar den.
  begin
    update public.bookings set duration_min = 120 where id = '00000000-0000-4000-8000-00000000b16a';
    perform public.klippkort_dra('00000000-0000-4000-8000-00000000b16a', '00000000-0000-4000-8000-0000000000f1');
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid, avvikelse_skal)
    values ('00000000-0000-4000-8000-000000000516', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b16a', 'x', current_date, 'narvarande', '09:00', '10:15', 'prov');
    select k.kvar into kvar from public.klippkort_saldo k where k.id = '00000000-0000-4000-8000-00000000c16a';
    s1 := intern.timbank_saldo('00000000-0000-4000-8000-0000000000f1');

    update public.bookings set betalning_status = 'betald', betald_at = now(), betalt_ore = 37900, stripe_minuter = 60
     where id = '00000000-0000-4000-8000-00000000b0c1';
    insert into public.lesson_reports (id, student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid, avvikelse_skal)
    values ('00000000-0000-4000-8000-00000000e221', '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b0c1', 'x', current_date, 'narvarande', '15:00', '16:15', 'prov');
    s2 := intern.timbank_saldo('00000000-0000-4000-8000-0000000000f1');
    select debiterade_min, betalda_min, timbank_min, lon_min into deb, betalda, bank, lon
      from public.passunderlag where id = '00000000-0000-4000-8000-00000000b0c1';
    select count(*) into larm from public.avvikelser_rader()
     where typ in ('tillagg_obetalt', 'betalt_for_lange') and objekt_id = '00000000-0000-4000-8000-00000000b0c1';

    perform pg_temp.bli('00000000-0000-4000-8000-0000000000a1');
    select saldo_min, varde_ore into s_a, v_a from public.timbank_saldo where parent_id = '00000000-0000-4000-8000-0000000000f1';
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000f2');
    select count(*) into s_q from public.timbank_rorelser;
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000f1');
    select saldo_min, varde_ore into s_p, v_p from public.timbank_saldo where parent_id = '00000000-0000-4000-8000-0000000000f1';
    select count(*) into ror from public.timbank_rorelser;
    reset role;
    perform set_config('request.jwt.claims', '', true);

    -- Admin rättar tiden: passet drog inte över, och kvarten går tillbaka.
    update public.lesson_reports set slut_tid = '16:00', avvikelse_skal = null
     where id = '00000000-0000-4000-8000-00000000e221';
    efter_ratt := intern.timbank_saldo('00000000-0000-4000-8000-0000000000f1');
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('22.1 in och övertid', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('22.1 1 h 15 ur klippkortet drar två timmar', kvar = 8, 'kvar ' || kvar),
      ('22.1 och 45 minuter går in i banken', s1 = 45, 'saldo ' || s1),
      ('22.1 övertiden tas ur banken', s2 = 30 and bank = 15, 'saldo ' || s2 || ', timbank_min ' || bank),
      ('22.1 övertiden ur banken är betald', deb = 75 and betalda = 75 and larm = 0,
       'debiterade ' || deb || ', betalda ' || betalda || ', larm ' || larm),
      ('22.1 övertiden ur banken räknas i lönen', lon = 75, 'lon_min ' || lon),
      ('22.1 studiehjälparen ser familjens minuter men inte beloppet', s_a = 30 and v_a is null,
       coalesce(s_a::text, 'null') || ' / ' || coalesce(v_a::text, 'null')),
      ('22.1 familjen ser sina minuter och vad de är värda', s_p = 30 and v_p = 18950,
       coalesce(s_p::text, 'null') || ' / ' || coalesce(v_p::text, 'null')),
      ('22.1 familjen ser in och ut', ror = 2, 'rader: ' || ror),
      ('22.1 en annan familj ser inga rörelser', s_q = 0, 'rader: ' || s_q),
      ('22.1 rättad tid: kvarten går tillbaka', efter_ratt = 45, 'saldo ' || efter_ratt);
  end if;

  -- 2. Banken räcker inte till hela övertiden: den tar det den har, och
  --    resten är ett tillägg. Betalt efter passet tar kassan bara det
  --    banken inte täckte.
  fel := null;
  begin
    perform public.klippkort_dra('00000000-0000-4000-8000-00000000b16a', '00000000-0000-4000-8000-0000000000f1');
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid, avvikelse_skal)
    values ('00000000-0000-4000-8000-000000000516', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b16a', 'x', current_date, 'narvarande', '09:00', '09:45', 'prov');
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid, avvikelse_skal)
    values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b0c1', 'x', current_date, 'narvarande', '15:00', '16:30', 'prov');
    select timbank_min, debiterade_min - timbank_min into bank_del, att_betala
      from public.passunderlag where id = '00000000-0000-4000-8000-00000000b0c1';
    s_del := intern.timbank_saldo('00000000-0000-4000-8000-0000000000f1');
    select count(*) into ej from public.avvikelser_rader()
     where typ = 'ej_betalt' and objekt_id = '00000000-0000-4000-8000-00000000b0c1';
    update public.bookings set betalning_status = 'betald', betald_at = now(), betalt_ore = 37900, stripe_minuter = 60
     where id = '00000000-0000-4000-8000-00000000b0c1';
    select count(*) into larm_del from public.avvikelser_rader()
     where typ = 'tillagg_obetalt' and objekt_id = '00000000-0000-4000-8000-00000000b0c1';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('22.1 banken räcker inte', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('22.1 banken tar det den har av övertiden', bank_del = 15 and s_del = 0,
       'timbank_min ' || bank_del || ', saldo ' || s_del),
      ('22.1 betalt efter passet: kassan tar det banken inte täckte', att_betala = 75, 'minuter ' || att_betala),
      ('22.1 obetalt pass larmar fortfarande', ej = 1, 'rader: ' || ej),
      ('22.1 resten av övertiden är ett tillägg', larm_del = 1, 'rader: ' || larm_del);
  end if;

  -- 3. Ett helt pass med banken, och avbokningen som ger minuterna
  --    tillbaka. Två klippkortspass på en timme som höll en kvart och en
  --    halvtimme ger 45 + 30.
  fel := null;
  begin
    update public.bookings set antal_barn = 1 where id = '00000000-0000-4000-8000-00000000b16b';
    perform public.klippkort_dra('00000000-0000-4000-8000-00000000b16a', '00000000-0000-4000-8000-0000000000f1');
    perform public.klippkort_dra('00000000-0000-4000-8000-00000000b16b', '00000000-0000-4000-8000-0000000000f1');
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid, avvikelse_skal)
    values ('00000000-0000-4000-8000-000000000516', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b16a', 'x', current_date, 'narvarande', '09:00', '09:15', 'prov'),
           ('00000000-0000-4000-8000-000000000516', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b16b', 'x', current_date, 'narvarande', '11:00', '11:30', 'prov');
    svar_q := public.timbank_dra('00000000-0000-4000-8000-00000000b0d1', '00000000-0000-4000-8000-0000000000f2');
    svar := public.timbank_dra('00000000-0000-4000-8000-00000000b0d1', '00000000-0000-4000-8000-0000000000f1');
    select betalning_status into st from public.bookings where id = '00000000-0000-4000-8000-00000000b0d1';
    s_hel := intern.timbank_saldo('00000000-0000-4000-8000-0000000000f1');
    svar_lite := public.timbank_dra('00000000-0000-4000-8000-00000000b0c1', '00000000-0000-4000-8000-0000000000f1');

    perform pg_temp.bli('00000000-0000-4000-8000-0000000000f1');
    update public.bookings set status = 'cancelled', avbokningsskal = 'forhinder'
     where id = '00000000-0000-4000-8000-00000000b0d1';
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select betalning_status into st_avb from public.bookings where id = '00000000-0000-4000-8000-00000000b0d1';
    s_avb := intern.timbank_saldo('00000000-0000-4000-8000-0000000000f1');
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('22.1 ett helt pass med banken', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('22.1 en annan familj betalar inte med P:s bank', svar_q->>'fel' like 'Det är familjen%', svar_q::text),
      ('22.1 75 minuter betalar ett pass på en timme', (svar->>'ok')::boolean and st = 'betald' and s_hel = 15,
       svar::text || ', ' || st || ', saldo ' || s_hel),
      ('22.1 15 minuter räcker inte till nästa', svar_lite->>'fel' like 'Timbanken räcker inte%', svar_lite::text),
      ('22.1 familjen avbokar passet och minuterna kommer tillbaka', st_avb = 'ingen' and s_avb = 75,
       st_avb || ', saldo ' || s_avb);
  end if;

  -- 4. Kortet vinner: en öppen kassa betalades efter att banken tagit
  --    passet. Kortbetalningen skrivs och minuterna går tillbaka i samma
  --    anrop, och en andra leverans gör ingenting. Admin betalar sedan ut
  --    banken, en gång.
  fel := null;
  begin
    update public.bookings set antal_barn = 1 where id = '00000000-0000-4000-8000-00000000b16b';
    perform public.klippkort_dra('00000000-0000-4000-8000-00000000b16a', '00000000-0000-4000-8000-0000000000f1');
    perform public.klippkort_dra('00000000-0000-4000-8000-00000000b16b', '00000000-0000-4000-8000-0000000000f1');
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid, avvikelse_skal)
    values ('00000000-0000-4000-8000-000000000516', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b16a', 'x', current_date, 'narvarande', '09:00', '09:15', 'prov'),
           ('00000000-0000-4000-8000-000000000516', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b16b', 'x', current_date, 'narvarande', '11:00', '11:30', 'prov');
    perform public.timbank_dra('00000000-0000-4000-8000-00000000b0d1', '00000000-0000-4000-8000-0000000000f1');
    -- Ett pass som inte är betalt med banken rörs inte.
    vann_fel := public.timbank_kort_vinner('00000000-0000-4000-8000-00000000b0c1',
      '{"betalning_status": "betald", "stripe_payment_intent_id": "pi_rlsprov0", "betalt_ore": 37900}');
    select betalning_status into st_fel from public.bookings where id = '00000000-0000-4000-8000-00000000b0c1';
    vann := public.timbank_kort_vinner('00000000-0000-4000-8000-00000000b0d1',
      '{"betalning_status": "betald", "betald_at": "2026-09-27T12:00:00Z", "stripe_payment_intent_id": "pi_rlsprov1",
        "stripe_charge_id": "ch_rlsprov1", "stripe_skarp": false, "betalt_ore": 37900, "stripe_minuter": 60,
        "aterbetald_ore": 0, "tutor_id": "00000000-0000-4000-8000-0000000000a2"}');
    vann2 := public.timbank_kort_vinner('00000000-0000-4000-8000-00000000b0d1',
      '{"betalning_status": "betald", "stripe_payment_intent_id": "pi_rlsprov1", "betalt_ore": 37900}');
    select betalning_status, stripe_payment_intent_id, stripe_minuter, tutor_id into st_vann, pi_vann, min_vann, tut_vann
      from public.bookings where id = '00000000-0000-4000-8000-00000000b0d1';
    s_vann := intern.timbank_saldo('00000000-0000-4000-8000-0000000000f1');

    perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
    ut := public.timbank_utbetald('00000000-0000-4000-8000-0000000000f1');
    ut2 := public.timbank_utbetald('00000000-0000-4000-8000-0000000000f1');
    reset role;
    perform set_config('request.jwt.claims', '', true);
    s_ut := intern.timbank_saldo('00000000-0000-4000-8000-0000000000f1');
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('22.1 kortet vinner och utbetalningen', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('22.1 kortet vinner: betalningen skrivs och minuterna går tillbaka i samma anrop',
       vann and st_vann = 'betald' and pi_vann = 'pi_rlsprov1' and min_vann = 60 and s_vann = 75,
       coalesce(vann::text, 'null') || ', ' || st_vann || ', ' || coalesce(pi_vann, 'null')
       || ', ' || coalesce(min_vann::text, 'null') || ' min, saldo ' || s_vann),
      ('22.1 kortet vinner: bara betalningens kolumner når passet', tut_vann = '00000000-0000-4000-8000-0000000000a1',
       coalesce(tut_vann::text, 'null')),
      ('22.1 kortet vinner: en andra leverans gör ingenting', vann2 = false, coalesce(vann2::text, 'null')),
      ('22.1 kortet vinner inte på ett pass som inte är betalt med banken', vann_fel = false and st_fel = 'ingen',
       coalesce(vann_fel::text, 'null') || ', ' || st_fel),
      ('22.1 admin betalar ut hela banken till ordinarie pris', (ut->>'minuter')::int = 75
         and (ut->>'varde_ore')::int = 47375 and s_ut = 0, ut::text || ', saldo ' || s_ut),
      ('22.1 en tom bank betalas inte ut två gånger', ut2->>'fel' = 'Timbanken är tom.', ut2::text);
  end if;

  -- 5. Ett pass med två barn tar inget ur banken.
  fel := null;
  begin
    perform public.klippkort_dra('00000000-0000-4000-8000-00000000b16a', '00000000-0000-4000-8000-0000000000f1');
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid, avvikelse_skal)
    values ('00000000-0000-4000-8000-000000000516', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b16a', 'x', current_date, 'narvarande', '09:00', '09:15', 'prov');
    update public.bookings set antal_barn = 2 where id = '00000000-0000-4000-8000-00000000b0c1';
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid, avvikelse_skal)
    values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b0c1', 'x', current_date, 'narvarande', '15:00', '16:15', 'prov');
    flerbarn := intern.timbank_saldo('00000000-0000-4000-8000-0000000000f1');
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('22.1 flera barn', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('22.1 ett pass med två barn tar inget ur banken', flerbarn = 45, 'saldo ' || flerbarn);
  end if;

  -- 6. Kortet betalade efter passet, och admin rättar tiden uppåt. Banken
  --    hade 15 när rapporten skrevs och tog dem av en halvtimmes övertid,
  --    och kortet betalade resten, 75 minuter. Med 30 nya minuter i banken
  --    rättas passet till 1 h 45: banken tar de 30 som ligger utöver det
  --    kortet betalade. Räknat från det bokade hade den tagit 45, och
  --    passet hade stått som betalt för länge.
  fel := null;
  begin
    update public.bookings set antal_barn = 1 where id = '00000000-0000-4000-8000-00000000b16b';
    perform public.klippkort_dra('00000000-0000-4000-8000-00000000b16a', '00000000-0000-4000-8000-0000000000f1');
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid, avvikelse_skal)
    values ('00000000-0000-4000-8000-000000000516', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b16a', 'x', current_date, 'narvarande', '09:00', '09:45', 'prov');
    insert into public.lesson_reports (id, student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid, avvikelse_skal)
    values ('00000000-0000-4000-8000-00000000e221', '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b0c1', 'x', current_date, 'narvarande', '15:00', '16:30', 'prov');
    update public.bookings set betalning_status = 'betald', betald_at = now(), betalt_ore = 47375, stripe_minuter = 75
     where id = '00000000-0000-4000-8000-00000000b0c1';
    perform public.klippkort_dra('00000000-0000-4000-8000-00000000b16b', '00000000-0000-4000-8000-0000000000f1');
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid, avvikelse_skal)
    values ('00000000-0000-4000-8000-000000000516', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b16b', 'x', current_date, 'narvarande', '11:00', '11:30', 'prov');
    update public.lesson_reports set slut_tid = '16:45' where id = '00000000-0000-4000-8000-00000000e221';
    s_kort := intern.timbank_saldo('00000000-0000-4000-8000-0000000000f1');
    select timbank_min, betalda_min into bank_kort, betalda_kort
      from public.passunderlag where id = '00000000-0000-4000-8000-00000000b0c1';
    select count(*) into larm_kort from public.avvikelser_rader()
     where typ in ('tillagg_obetalt', 'betalt_for_lange') and objekt_id = '00000000-0000-4000-8000-00000000b0c1';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('22.1 rättad tid efter kortet', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('22.1 rättad tid: banken tar bara det kortet inte betalat', s_kort = 15 and bank_kort = 30,
       'saldo ' || s_kort || ', timbank_min ' || bank_kort),
      ('22.1 rättad tid: passet är betalt precis, inget larm', betalda_kort = 105 and larm_kort = 0,
       'betalda ' || betalda_kort || ', larm ' || larm_kort);
  end if;

  -- 7. Admin ändrar ett pass som drog en kvart över, med 45 i banken. Två
  --    barn tar inget ur banken, ett barn igen tar kvarten, ett undantaget
  --    pass tar inget, och ett pass bokat på två timmar som höll 1 h 15
  --    har ingen övertid.
  fel := null;
  begin
    perform public.klippkort_dra('00000000-0000-4000-8000-00000000b16a', '00000000-0000-4000-8000-0000000000f1');
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid, avvikelse_skal)
    values ('00000000-0000-4000-8000-000000000516', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b16a', 'x', current_date, 'narvarande', '09:00', '09:15', 'prov');
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid, avvikelse_skal)
    values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b0c1', 'x', current_date, 'narvarande', '15:00', '16:15', 'prov');
    update public.bookings set antal_barn = 2 where id = '00000000-0000-4000-8000-00000000b0c1';
    s_barn := intern.timbank_saldo('00000000-0000-4000-8000-0000000000f1');
    select timbank_min into bank_barn from public.passunderlag where id = '00000000-0000-4000-8000-00000000b0c1';
    update public.bookings set antal_barn = 1 where id = '00000000-0000-4000-8000-00000000b0c1';
    s_barn1 := intern.timbank_saldo('00000000-0000-4000-8000-0000000000f1');
    update public.bookings set fakturerbar = false, fakturerbar_anledning = 'prov'
     where id = '00000000-0000-4000-8000-00000000b0c1';
    s_undantag := intern.timbank_saldo('00000000-0000-4000-8000-0000000000f1');
    update public.bookings set fakturerbar = true, fakturerbar_anledning = null, duration_min = 120
     where id = '00000000-0000-4000-8000-00000000b0c1';
    s_langd := intern.timbank_saldo('00000000-0000-4000-8000-0000000000f1');
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('22.1 admin ändrar passet', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('22.1 två barn i efterhand: kvarten går tillbaka', s_barn = 45 and bank_barn = 0,
       'saldo ' || s_barn || ', timbank_min ' || bank_barn),
      ('22.1 ett barn igen: banken tar kvarten', s_barn1 = 30, 'saldo ' || s_barn1),
      ('22.1 undantaget i efterhand: kvarten går tillbaka', s_undantag = 45, 'saldo ' || s_undantag),
      ('22.1 längre bokning i efterhand: ingen övertid', s_langd = 45, 'saldo ' || s_langd);
  end if;

  -- 8. Ett helt pass ur banken, och admin gör det längre i efterhand. Banken
  --    har 75, passet höll en timme och betalas med banken: 15 kvar. Bokat
  --    på två timmar drar uttaget två timmar, och timmen som inte hölls
  --    kommer tillbaka: fortfarande 15, för banken betalar det som hölls.
  --    Stod uttaget kvar på en timme hade familjen fått timmen gratis.
  fel := null;
  begin
    update public.bookings set antal_barn = 1 where id = '00000000-0000-4000-8000-00000000b16b';
    perform public.klippkort_dra('00000000-0000-4000-8000-00000000b16a', '00000000-0000-4000-8000-0000000000f1');
    perform public.klippkort_dra('00000000-0000-4000-8000-00000000b16b', '00000000-0000-4000-8000-0000000000f1');
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid, avvikelse_skal)
    values ('00000000-0000-4000-8000-000000000516', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b16a', 'x', current_date, 'narvarande', '09:00', '09:15', 'prov'),
           ('00000000-0000-4000-8000-000000000516', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b16b', 'x', current_date, 'narvarande', '11:00', '11:30', 'prov');
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid)
    values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b0c1', 'x', current_date, 'narvarande', '15:00', '16:00');
    svar := public.timbank_dra('00000000-0000-4000-8000-00000000b0c1', '00000000-0000-4000-8000-0000000000f1');
    update public.bookings set duration_min = 120 where id = '00000000-0000-4000-8000-00000000b0c1';
    select minuter into u_lang from public.timbank_uttag
     where booking_id = '00000000-0000-4000-8000-00000000b0c1' and sort = 'pass';
    s_lang := intern.timbank_saldo('00000000-0000-4000-8000-0000000000f1');
    update public.bookings set duration_min = 60 where id = '00000000-0000-4000-8000-00000000b0c1';
    s_tillbaka := intern.timbank_saldo('00000000-0000-4000-8000-0000000000f1');
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('22.1 ett helt pass görs längre', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('22.1 längre pass ur banken: uttaget följer det bokade', (svar->>'ok')::boolean and u_lang = 120 and s_lang = 15,
       svar::text || ', uttag ' || coalesce(u_lang::text, 'null') || ', saldo ' || s_lang),
      ('22.1 och tillbaka till en timme: samma saldo', s_tillbaka = 15, 'saldo ' || s_tillbaka);
  end if;
end $$;

-- ============================================================
-- FAS 22.2 — timmarna betalar passen av sig själva
--
-- Flaggan erbjudanden står av i resten av körningen (överst). Här slås
-- den på i varje block. Klippkortet c16a (tio timmar, familj P, sex
-- månader) och passen är fixturerna från början och från Fas 16.1: b0c1
-- igår och b0d1 om en vecka, b16a om sex dagar och b16b med två barn,
-- alla bekräftade och obetalda. De nya passen ligger på egna tider hos
-- A, så att överlappsregeln inte slår till.
-- ============================================================

-- 1. Studiehjälparen bekräftar familjens förslag. Timmarna betalar ett
--    pass med ett barn inom kortets giltighet, och inga andra.
do $$
declare
  p    uuid := '00000000-0000-4000-8000-0000000000f1';
  a    uuid := '00000000-0000-4000-8000-0000000000a1';
  s    uuid := '00000000-0000-4000-8000-000000000516';
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  st1 text; kk1 uuid; kvar1 int; kod1 text;
  st2 text; st3 text; st4 text; st5 text;
  fel text;
begin
  begin
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status, antal_barn) values
      ('00000000-0000-4000-8000-0000000022a1', p, a, s, p, idag + 3, '10:00', 120, 'requested', 1),
      ('00000000-0000-4000-8000-0000000022a2', p, a, s, p, idag + 4, '10:00', 60, 'requested', 2),
      ('00000000-0000-4000-8000-0000000022a3', p, a, s, p, idag + 5, '10:00', 60, 'requested', 1),
      ('00000000-0000-4000-8000-0000000022a4', p, a, s, p, idag + 250, '10:00', 60, 'requested', 1),
      ('00000000-0000-4000-8000-0000000022a5', p, a, s, p, idag + 8, '10:00', 60, 'requested', 1);
    update public.bookings set startrabatt = true where id = '00000000-0000-4000-8000-0000000022a3';
    -- Flaggan slås på efter förslagen: sedan Fas 22.4 betalar timmarna
    -- ett förslag redan när det skapas, och här provas bekräftelsen.
    update public.flaggor set aktiv = true where kod = 'erbjudanden';

    perform pg_temp.bli(a);
    update public.bookings set status = 'confirmed'
     where id in ('00000000-0000-4000-8000-0000000022a1', '00000000-0000-4000-8000-0000000022a2',
                  '00000000-0000-4000-8000-0000000022a3', '00000000-0000-4000-8000-0000000022a4');
    reset role;
    perform set_config('request.jwt.claims', '', true);

    update public.flaggor set aktiv = false where kod = 'erbjudanden';
    perform pg_temp.bli(a);
    update public.bookings set status = 'confirmed' where id = '00000000-0000-4000-8000-0000000022a5';
    reset role;
    perform set_config('request.jwt.claims', '', true);

    select betalning_status, klippkort_id into st1, kk1 from public.bookings where id = '00000000-0000-4000-8000-0000000022a1';
    select kvar into kvar1 from public.klippkort_saldo where id = '00000000-0000-4000-8000-00000000c16a';
    kod1 := intern.betalsatt_kod('00000000-0000-4000-8000-0000000022a1');
    select betalning_status into st2 from public.bookings where id = '00000000-0000-4000-8000-0000000022a2';
    select betalning_status into st3 from public.bookings where id = '00000000-0000-4000-8000-0000000022a3';
    select betalning_status into st4 from public.bookings where id = '00000000-0000-4000-8000-0000000022a4';
    select betalning_status into st5 from public.bookings where id = '00000000-0000-4000-8000-0000000022a5';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('22.2 bekräftelsen', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('22.2 studiehjälparen bekräftar: timmarna betalar passet',
     st1 = 'betald' and kk1 = '00000000-0000-4000-8000-00000000c16a' and kvar1 = 8,
     st1 || ', ' || coalesce(kk1::text, 'inget kort') || ', kvar ' || kvar1),
    ('22.2 mejlet om passet får koden timmar', kod1 = 'timmar', coalesce(kod1, 'null')),
    ('22.2 ett pass med två barn betalas inte med timmarna', st2 = 'ingen', st2),
    ('22.2 passet med första timmen bjuden betalas inte med timmarna', st3 = 'ingen', st3),
    ('22.2 ett pass efter kortets sista dag betalas inte med kortet', st4 = 'ingen', st4),
    ('22.2 flaggan av: timmarna betalar ingenting själva', st5 = 'ingen', st5);
end $$;

-- 2. Familjen bekräftar studiehjälparens förslag. Kortet som går ut
--    först betalar, sedan nästa kort, och utan ett kort som går att
--    använda betalar timbanken när minuterna räcker till det bokade.
do $$
declare
  p    uuid := '00000000-0000-4000-8000-0000000000f1';
  a    uuid := '00000000-0000-4000-8000-0000000000a1';
  s    uuid := '00000000-0000-4000-8000-000000000516';
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  kk1 uuid; kk2 uuid; fore int; st3 text; uttag3 int; saldo3 int; kod3 text; st4 text;
  fel text;
begin
  begin
    insert into public.klippkort (id, parent_id, erbjudande, namn, sort, timmar, giltig_manader, rabatt_procent,
                                  timpris_ore, begart_ore, betalt_ore, status, giltigt_till, betald_at, stripe_charge_id)
    values ('00000000-0000-4000-8000-00000000c22b', p, 'klipp10', 'Prov 1 timme', 'klippkort', 1, 1, 5,
            37900, 36000, 36000, 'betald', idag + 30, now(), 'ch_rlsprov_22_2b');
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status, antal_barn) values
      ('00000000-0000-4000-8000-0000000022b1', p, a, s, a, idag + 3, '12:00', 60, 'requested', 1),
      ('00000000-0000-4000-8000-0000000022b2', p, a, s, a, idag + 4, '12:00', 120, 'requested', 1),
      ('00000000-0000-4000-8000-0000000022b3', p, a, s, a, idag + 5, '12:00', 60, 'requested', 1),
      ('00000000-0000-4000-8000-0000000022b4', p, a, s, a, idag + 9, '12:00', 60, 'requested', 1);
    -- Efter förslagen, som i 1: här provas bekräftelsen, inte förslaget (Fas 22.4).
    update public.flaggor set aktiv = true where kod = 'erbjudanden';

    perform pg_temp.bli(p);
    update public.bookings set status = 'confirmed' where id = '00000000-0000-4000-8000-0000000022b1';
    update public.bookings set status = 'confirmed' where id = '00000000-0000-4000-8000-0000000022b2';
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select klippkort_id into kk1 from public.bookings where id = '00000000-0000-4000-8000-0000000022b1';
    select klippkort_id into kk2 from public.bookings where id = '00000000-0000-4000-8000-0000000022b2';

    -- Två klippkortspass som höll en kvart och en halvtimme lägger
    -- 45 + 30 minuter i banken, som i 22.1. Sedan är båda korten i tvist.
    update public.bookings set antal_barn = 1 where id = '00000000-0000-4000-8000-00000000b16b';
    perform public.klippkort_dra('00000000-0000-4000-8000-00000000b16a', p);
    perform public.klippkort_dra('00000000-0000-4000-8000-00000000b16b', p);
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid, avvikelse_skal)
    values (s, a, '00000000-0000-4000-8000-00000000b16a', 'x', current_date, 'narvarande', '09:00', '09:15', 'prov'),
           (s, a, '00000000-0000-4000-8000-00000000b16b', 'x', current_date, 'narvarande', '11:00', '11:30', 'prov');
    update public.klippkort set status = 'tvist'
     where id in ('00000000-0000-4000-8000-00000000c16a', '00000000-0000-4000-8000-00000000c22b');
    fore := intern.timbank_saldo(p);

    perform pg_temp.bli(p);
    update public.bookings set status = 'confirmed' where id = '00000000-0000-4000-8000-0000000022b3';
    update public.bookings set status = 'confirmed' where id = '00000000-0000-4000-8000-0000000022b4';
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select betalning_status into st3 from public.bookings where id = '00000000-0000-4000-8000-0000000022b3';
    select minuter into uttag3 from public.timbank_uttag
     where booking_id = '00000000-0000-4000-8000-0000000022b3' and sort = 'pass';
    saldo3 := intern.timbank_saldo(p);
    kod3 := intern.betalsatt_kod('00000000-0000-4000-8000-0000000022b3');
    select betalning_status into st4 from public.bookings where id = '00000000-0000-4000-8000-0000000022b4';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('22.2 korten och banken', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('22.2 familjen bekräftar: kortet som går ut först betalar', kk1 = '00000000-0000-4000-8000-00000000c22b',
     coalesce(kk1::text, 'inget kort')),
    ('22.2 räcker det kortet inte betalar nästa', kk2 = '00000000-0000-4000-8000-00000000c16a',
     coalesce(kk2::text, 'inget kort')),
    ('22.2 utan kort betalar timbanken det bokade', fore = 75 and st3 = 'betald' and uttag3 = 60 and saldo3 = 15,
     'före ' || fore || ', ' || st3 || ', uttag ' || coalesce(uttag3::text, 'null') || ', saldo ' || saldo3),
    ('22.2 mejlet säger timmar också för timbanken', kod3 = 'timmar', coalesce(kod3, 'null')),
    ('22.2 räcker minuterna inte står passet obetalt', st4 = 'ingen', st4);
end $$;

-- 3. Rapporten gör ett obetalt pass genomfört, och timmarna betalar det.
--    b0c1 höll 45 minuter: en timme dras, och en kvart går in i banken.
do $$
declare
  p  uuid := '00000000-0000-4000-8000-0000000000f1';
  st text; kk uuid; kvar int; larm int; saldo int; fel text;
begin
  begin
    update public.flaggor set aktiv = true where kod = 'erbjudanden';
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000a1');
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid, avvikelse_skal)
    values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b0c1', 'x', current_date, 'narvarande', '15:00', '15:45', 'Eleven var trött');
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select betalning_status, klippkort_id into st, kk from public.bookings where id = '00000000-0000-4000-8000-00000000b0c1';
    select k.kvar into kvar from public.klippkort_saldo k where k.id = '00000000-0000-4000-8000-00000000c16a';
    select count(*) into larm from public.avvikelser_rader()
     where typ = 'ej_betalt' and objekt_id = '00000000-0000-4000-8000-00000000b0c1';
    saldo := intern.timbank_saldo(p);
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('22.2 rapporten', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('22.2 rapporten gör passet genomfört, och timmarna betalar det',
     st = 'betald' and kk = '00000000-0000-4000-8000-00000000c16a' and kvar = 9,
     st || ', ' || coalesce(kk::text, 'inget kort') || ', kvar ' || kvar),
    ('22.2 det genomförda passet larmar inte som obetalt', larm = 0, 'rader: ' || larm),
    ('22.2 och det som blev över av timmen går in i banken', saldo = 15, 'saldo ' || saldo);
end $$;

-- 4. Ett köp blir betalt (webhooken, klippkort_betald). De nya timmarna
--    betalar P:s bekräftade pass från och med i dag i datumordning: 22c1
--    (tre timmar), 22c2 ryms inte (tre timmar, en kassa påbörjad) och
--    hoppas över, 22c3 (en timme, kortet nekades förra gången) och b16a.
--    Sedan är de fem timmarna slut, och b0d1 står obetalt. Två barn,
--    faktura, ett passerat pass och ett pass med första timmen bjuden
--    rörs inte. c16a har timmar kvar men betalar ingenting här: bara det
--    nya kortet gör det.
do $$
declare
  p    uuid := '00000000-0000-4000-8000-0000000000f1';
  a    uuid := '00000000-0000-4000-8000-0000000000a1';
  s    uuid := '00000000-0000-4000-8000-000000000516';
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  ny   uuid := '00000000-0000-4000-8000-00000000c22c';
  blev boolean; igen boolean; kvar int; kvar16 int;
  k1 uuid; k2 uuid; k3 uuid; k16a uuid; kd1 uuid; k0 uuid; k8 uuid; kc1 uuid;
  st2 text; st5 text; st_d1 text;
  fel text;
begin
  begin
    update public.flaggor set aktiv = true where kod = 'erbjudanden';
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status, antal_barn, betalning_status) values
      ('00000000-0000-4000-8000-0000000022c0', p, a, s, p, idag + 1, '10:00', 60, 'confirmed', 2, 'ingen'),
      ('00000000-0000-4000-8000-0000000022c5', p, a, s, p, idag + 1, '12:00', 60, 'confirmed', 1, 'faktura'),
      ('00000000-0000-4000-8000-0000000022c8', p, a, s, p, idag + 1, '14:00', 60, 'confirmed', 1, 'ingen'),
      ('00000000-0000-4000-8000-0000000022c1', p, a, s, p, idag + 2, '10:00', 180, 'confirmed', 1, 'ingen'),
      ('00000000-0000-4000-8000-0000000022c2', p, a, s, p, idag + 3, '12:00', 180, 'confirmed', 1, 'vantar'),
      ('00000000-0000-4000-8000-0000000022c3', p, a, s, p, idag + 4, '14:00', 60, 'confirmed', 1, 'misslyckad');
    update public.bookings set startrabatt = true where id = '00000000-0000-4000-8000-0000000022c8';
    insert into public.klippkort (id, parent_id, erbjudande, namn, sort, timmar, giltig_manader, rabatt_procent,
                                  timpris_ore, begart_ore, status)
    values (ny, p, 'klipp10', 'Prov 5 timmar', 'klippkort', 5, 6, 5, 37900, 180000, 'vantar');

    blev := public.klippkort_betald(ny, 180000, 'pi_rlsprov_22_2c', 'ch_rlsprov_22_2c', null, null, null, false);
    igen := public.klippkort_betald(ny, 180000, 'pi_rlsprov_22_2c', 'ch_rlsprov_22_2c', null, null, null, false);

    select k.kvar into kvar from public.klippkort_saldo k where k.id = ny;
    select k.kvar into kvar16 from public.klippkort_saldo k where k.id = '00000000-0000-4000-8000-00000000c16a';
    select klippkort_id into k1 from public.bookings where id = '00000000-0000-4000-8000-0000000022c1';
    select klippkort_id, betalning_status into k2, st2 from public.bookings where id = '00000000-0000-4000-8000-0000000022c2';
    select klippkort_id into k3 from public.bookings where id = '00000000-0000-4000-8000-0000000022c3';
    select klippkort_id into k16a from public.bookings where id = '00000000-0000-4000-8000-00000000b16a';
    select klippkort_id, betalning_status into kd1, st_d1 from public.bookings where id = '00000000-0000-4000-8000-00000000b0d1';
    select klippkort_id into k0 from public.bookings where id = '00000000-0000-4000-8000-0000000022c0';
    select klippkort_id into k8 from public.bookings where id = '00000000-0000-4000-8000-0000000022c8';
    select klippkort_id into kc1 from public.bookings where id = '00000000-0000-4000-8000-00000000b0c1';
    select betalning_status into st5 from public.bookings where id = '00000000-0000-4000-8000-0000000022c5';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('22.2 köpet betalar passen', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('22.2 köpet blir betalt: timmarna betalar de kommande passen i datumordning',
     blev and k1 = ny and k3 = ny and k16a = ny and kvar = 0,
     coalesce(blev::text, 'null') || ', 22c1 ' || coalesce(k1::text, '-') || ', 22c3 ' || coalesce(k3::text, '-')
     || ', b16a ' || coalesce(k16a::text, '-') || ', kvar ' || kvar),
    ('22.2 ett pass som inte ryms hoppas över', k2 is null and st2 = 'vantar', coalesce(k2::text, '-') || ', ' || st2),
    ('22.2 när timmarna är slut står nästa pass obetalt', kd1 is null and st_d1 = 'ingen',
     coalesce(kd1::text, '-') || ', ' || st_d1),
    ('22.2 två barn, faktura, första timmen och ett passerat pass rörs inte',
     k0 is null and k8 is null and kc1 is null and st5 = 'faktura',
     coalesce(k0::text, '-') || ', ' || coalesce(k8::text, '-') || ', ' || coalesce(kc1::text, '-') || ', ' || st5),
    ('22.2 bara det nya kortet betalar', kvar16 = 10, 'c16a kvar ' || kvar16),
    ('22.2 en andra leverans betalar ingenting', igen = false, coalesce(igen::text, 'null'));
end $$;

-- 5. Kortets giltighet, en påbörjad kassa som ryms, och flaggan. b16a och
--    b0d1 avbokas först, så att de inte tar timmarna.
do $$
declare
  p    uuid := '00000000-0000-4000-8000-0000000000f1';
  a    uuid := '00000000-0000-4000-8000-0000000000a1';
  s    uuid := '00000000-0000-4000-8000-000000000516';
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  kd1 uuid; kd2 uuid; kd3 uuid; kvar int; std2 text;
  fel text;
begin
  begin
    update public.flaggor set aktiv = true where kod = 'erbjudanden';
    update public.bookings set status = 'cancelled'
     where id in ('00000000-0000-4000-8000-00000000b16a', '00000000-0000-4000-8000-00000000b0d1');
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status, antal_barn, betalning_status) values
      ('00000000-0000-4000-8000-0000000022d1', p, a, s, p, idag + 40, '10:00', 60, 'confirmed', 1, 'ingen'),
      ('00000000-0000-4000-8000-0000000022d2', p, a, s, p, idag + 10, '10:00', 60, 'confirmed', 1, 'vantar'),
      ('00000000-0000-4000-8000-0000000022d3', p, a, s, p, idag + 12, '10:00', 60, 'confirmed', 1, 'ingen');
    insert into public.klippkort (id, parent_id, erbjudande, namn, sort, timmar, giltig_manader, rabatt_procent,
                                  timpris_ore, begart_ore, status)
    values ('00000000-0000-4000-8000-00000000c22d', p, 'klipp10', 'Prov plan 3 timmar', 'plan', 3, 1, 10, 37900, 102300, 'vantar'),
           ('00000000-0000-4000-8000-00000000c22e', p, 'klipp10', 'Prov 1 timme', 'klippkort', 1, 6, 5, 37900, 36000, 'vantar');

    -- Planen har tre timmar och gäller en månad. 22d2 om tio dagar (en
    -- påbörjad kassa) och 22d3 om tolv tar två av dem. 22d1 om fyrtio
    -- dagar ligger efter sista dagen, och en timme blir kvar.
    perform public.klippkort_betald('00000000-0000-4000-8000-00000000c22d', 102300, 'pi_rlsprov_22_2d', 'ch_rlsprov_22_2d', null, null, null, false);
    select klippkort_id into kd1 from public.bookings where id = '00000000-0000-4000-8000-0000000022d1';
    select klippkort_id, betalning_status into kd2, std2 from public.bookings where id = '00000000-0000-4000-8000-0000000022d2';
    select k.kvar into kvar from public.klippkort_saldo k where k.id = '00000000-0000-4000-8000-00000000c22d';

    -- Med flaggan av betalar ett nytt köp ingenting. 22d1 ligger kvar
    -- obetalt, inom det nya kortets sex månader.
    update public.flaggor set aktiv = false where kod = 'erbjudanden';
    perform public.klippkort_betald('00000000-0000-4000-8000-00000000c22e', 36000, 'pi_rlsprov_22_2e', 'ch_rlsprov_22_2e', null, null, null, false);
    select klippkort_id into kd3 from public.bookings where id = '00000000-0000-4000-8000-0000000022d1';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('22.2 giltigheten och flaggan', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('22.2 ett pass efter köpets sista dag betalas inte', kd1 is null and kvar = 1,
     coalesce(kd1::text, '-') || ', kvar ' || kvar),
    ('22.2 ett pass med en påbörjad kassa betalas när det ryms',
     kd2 = '00000000-0000-4000-8000-00000000c22d' and std2 = 'betald', coalesce(kd2::text, '-') || ', ' || std2),
    ('22.2 flaggan av: ett nytt köp betalar ingenting', kd3 is null, coalesce(kd3::text, '-'));
end $$;

-- 6. Vilka pass korten betalat. Ett pass på två timmar som höll 1 h 15
--    drar två timmar, i vyn som i saldot. Bara familjen ser sina rader.
do $$
declare
  p uuid := '00000000-0000-4000-8000-0000000000f1';
  rader_p int; timmar_p int; anv int; rader_q int; rader_a int; kod_kort text; kod_faktura text; kod_ingen text;
  fel text;
begin
  begin
    update public.bookings set duration_min = 120 where id = '00000000-0000-4000-8000-00000000b16a';
    perform public.klippkort_dra('00000000-0000-4000-8000-00000000b16a', p);
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid, avvikelse_skal)
    values ('00000000-0000-4000-8000-000000000516', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-00000000b16a', 'x', current_date, 'narvarande', '09:00', '10:15', 'prov');
    update public.bookings set betalning_status = 'betald', betald_at = now(), betalt_ore = 37900,
                               stripe_payment_intent_id = 'pi_rlsprov_22_2f'
     where id = '00000000-0000-4000-8000-00000000b0d1';
    update public.bookings set betalning_status = 'faktura' where id = '00000000-0000-4000-8000-00000000b0c1';
    kod_kort := intern.betalsatt_kod('00000000-0000-4000-8000-00000000b0d1');
    kod_faktura := intern.betalsatt_kod('00000000-0000-4000-8000-00000000b0c1');
    kod_ingen := intern.betalsatt_kod('00000000-0000-4000-8000-00000000b0f1');
    select k.anvanda into anv from public.klippkort_saldo k where k.id = '00000000-0000-4000-8000-00000000c16a';

    perform pg_temp.bli(p);
    select count(*), coalesce(sum(timmar), 0) into rader_p, timmar_p from public.klippkort_rorelser
     where klippkort_id = '00000000-0000-4000-8000-00000000c16a';
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000f2');
    select count(*) into rader_q from public.klippkort_rorelser;
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000a1');
    select count(*) into rader_a from public.klippkort_rorelser;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('22.2 klippkortets rörelser', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('22.2 familjen ser passen kortet betalat, med samma timmar som saldot',
     rader_p = 1 and timmar_p = 2 and anv = 2, 'rader ' || rader_p || ', timmar ' || timmar_p || ', anvanda ' || anv),
    ('22.2 en annan familj ser inga rader', rader_q = 0, 'rader: ' || rader_q),
    ('22.2 studiehjälparen ser inga rader', rader_a = 0, 'rader: ' || rader_a),
    ('22.2 mejlets kod: kort, faktura och obetalt',
     kod_kort is null and kod_faktura = 'faktura' and kod_ingen is null,
     coalesce(kod_kort, 'null') || ' / ' || coalesce(kod_faktura, 'null') || ' / ' || coalesce(kod_ingen, 'null'));
end $$;

select pg_temp.prova('22.2 anon når inte klippkortets rörelser', null,
  array['select * from public.klippkort_rorelser'],
  'nekad');

select pg_temp.prova('22.2 familjen läser inte mejlets kod själv', '00000000-0000-4000-8000-0000000000f1',
  array[$q$select intern.betalsatt_kod('00000000-0000-4000-8000-00000000b0d1')$q$],
  'nekad');

-- 7. Mejlet: notistriggern slås på i blocket, och bekräftelsen till
--    familjen bär koden timmar. Kön rullas tillbaka med allt annat, och
--    ingenting i notisvägen går ut på nätet förrän schemat läser kön.
do $$
declare
  p    uuid := '00000000-0000-4000-8000-0000000000f1';
  a    uuid := '00000000-0000-4000-8000-0000000000a1';
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  kod_mejl text; fel text;
begin
  begin
    update public.flaggor set aktiv = true where kod = 'erbjudanden';
    alter table public.bookings enable trigger bookings_notis;
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status, antal_barn) values
      ('00000000-0000-4000-8000-0000000022e1', p, a, '00000000-0000-4000-8000-000000000516', p, idag + 3, '16:00', 60, 'requested', 1);
    perform pg_temp.bli(a);
    update public.bookings set status = 'confirmed' where id = '00000000-0000-4000-8000-0000000022e1';
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select n.data ->> 'betalsatt' into kod_mejl from public.notiser n
     where n.pass_id = '00000000-0000-4000-8000-0000000022e1' and n.mottagare = p and n.typ = 'pass_bekraftat';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('22.2 mejlet', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('22.2 bekräftelsen till familjen säger att timmarna betalat passet', kod_mejl = 'timmar', coalesce(kod_mejl, 'ingen notis'));
end $$;

-- ============================================================
-- FAS 22.3 — timmar som blir lediga betalar nästa pass
--
-- intern.timmar_betalar_obetalda() körs här direkt, för familj P, i
-- stället för att vänta på schemat. Där ett nytt kort ska betala sätts
-- c16a i tvist, så att dess tio timmar inte hinner först. De nya passen
-- ligger klockan 13 hos A, där inget annat pass står.
-- ============================================================

-- 1. En avbokning och ett kort som vann ger tillbaka en timme var, och
--    jobbet låter den betala nästa bekräftade pass. En körning till
--    betalar ingenting.
do $$
declare
  p    uuid := '00000000-0000-4000-8000-0000000000f1';
  a    uuid := '00000000-0000-4000-8000-0000000000a1';
  s    uuid := '00000000-0000-4000-8000-000000000516';
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  kort uuid := '00000000-0000-4000-8000-00000000c22f';
  st3_fore text; n1 int; k3 uuid; st4_fore text; n2 int; k4 uuid; n3 int; kvar int;
  fel text;
begin
  begin
    update public.flaggor set aktiv = true where kod = 'erbjudanden';
    update public.klippkort set status = 'tvist' where id = '00000000-0000-4000-8000-00000000c16a';
    update public.bookings set status = 'cancelled'
     where id in ('00000000-0000-4000-8000-00000000b16a', '00000000-0000-4000-8000-00000000b0d1');
    insert into public.klippkort (id, parent_id, erbjudande, namn, sort, timmar, giltig_manader, rabatt_procent,
                                  timpris_ore, begart_ore, betalt_ore, status, giltigt_till, betald_at, stripe_charge_id)
    values (kort, p, 'klipp10', 'Prov 2 timmar', 'klippkort', 2, 1, 5,
            37900, 72000, 72000, 'betald', idag + 30, now(), 'ch_rlsprov_22_3a');
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status, antal_barn) values
      ('00000000-0000-4000-8000-0000000022f1', p, a, s, p, idag + 2, '13:00', 60, 'requested', 1),
      ('00000000-0000-4000-8000-0000000022f2', p, a, s, p, idag + 3, '13:00', 60, 'requested', 1),
      ('00000000-0000-4000-8000-0000000022f3', p, a, s, p, idag + 4, '13:00', 60, 'requested', 1),
      ('00000000-0000-4000-8000-0000000022f4', p, a, s, p, idag + 5, '13:00', 60, 'requested', 1);

    -- Två timmar: 22f1 och 22f2 betalas redan när de föreslås (Fas
    -- 22.4), 22f3 och 22f4 ryms inte. En sats per pass, för en sats över
    -- flera rader besöker dem i ingen bestämd ordning. Familjen avbokar
    -- sedan 22f1, och timmen kommer tillbaka. Jobbet ger den till 22f3,
    -- som ligger före förslaget 22f4.
    perform pg_temp.bli(a);
    update public.bookings set status = 'confirmed' where id = '00000000-0000-4000-8000-0000000022f1';
    update public.bookings set status = 'confirmed' where id = '00000000-0000-4000-8000-0000000022f2';
    update public.bookings set status = 'confirmed' where id = '00000000-0000-4000-8000-0000000022f3';
    perform pg_temp.bli(p);
    update public.bookings set status = 'cancelled', avbokningsskal = 'sjukdom'
     where id = '00000000-0000-4000-8000-0000000022f1';
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select betalning_status into st3_fore from public.bookings where id = '00000000-0000-4000-8000-0000000022f3';
    n1 := intern.timmar_betalar_obetalda(p);
    select klippkort_id into k3 from public.bookings where id = '00000000-0000-4000-8000-0000000022f3';

    -- 22f4 bekräftas utan timmar kvar. Sedan vinner kortet över 22f2:
    -- webhooken skriver kortbetalningen och släpper klippkortet.
    perform pg_temp.bli(a);
    update public.bookings set status = 'confirmed' where id = '00000000-0000-4000-8000-0000000022f4';
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select betalning_status into st4_fore from public.bookings where id = '00000000-0000-4000-8000-0000000022f4';
    update public.bookings set klippkort_id = null, betalt_ore = 37900, betald_at = now(),
                               stripe_payment_intent_id = 'pi_rlsprov_22_3a'
     where id = '00000000-0000-4000-8000-0000000022f2';
    n2 := intern.timmar_betalar_obetalda(p);
    select klippkort_id into k4 from public.bookings where id = '00000000-0000-4000-8000-0000000022f4';
    n3 := intern.timmar_betalar_obetalda(p);
    select k.kvar into kvar from public.klippkort_saldo k where k.id = kort;
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('22.3 avbokningen och kortet som vann', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('22.3 en avbokning: timmen betalar nästa bekräftade pass',
     st3_fore = 'ingen' and n1 = 1 and k3 = '00000000-0000-4000-8000-00000000c22f',
     'före ' || st3_fore || ', betalade ' || n1 || ', 22f3 ' || coalesce(k3::text, 'inget kort')),
    ('22.3 kortet vann: timmen betalar nästa bekräftade pass',
     st4_fore = 'ingen' and n2 = 1 and k4 = '00000000-0000-4000-8000-00000000c22f',
     'före ' || st4_fore || ', betalade ' || n2 || ', 22f4 ' || coalesce(k4::text, 'inget kort')),
    ('22.3 en körning till betalar ingenting', n3 = 0 and kvar = 0, 'betalade ' || n3 || ', kvar ' || kvar);
end $$;

-- 2. 2231 bekräftas med flaggan av, och jobbet rör det inte så länge
--    den står av. Sedan slås den på, timbanken fylls till 75 minuter som
--    i 22.2, och c16a hamnar i tvist: jobbet betalar 2231 med banken, och
--    b0d1 om en vecka ryms inte i kvarten som blir kvar.
do $$
declare
  p    uuid := '00000000-0000-4000-8000-0000000000f1';
  a    uuid := '00000000-0000-4000-8000-0000000000a1';
  s    uuid := '00000000-0000-4000-8000-000000000516';
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  n0 int; st0 text; fore int; n1 int; st1 text; uttag int; saldo int; st_d1 text;
  fel text;
begin
  begin
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status, antal_barn) values
      ('00000000-0000-4000-8000-000000002231', p, a, s, p, idag + 3, '13:00', 60, 'requested', 1);
    perform pg_temp.bli(a);
    update public.bookings set status = 'confirmed' where id = '00000000-0000-4000-8000-000000002231';
    reset role;
    perform set_config('request.jwt.claims', '', true);
    n0 := intern.timmar_betalar_obetalda(p);
    select betalning_status into st0 from public.bookings where id = '00000000-0000-4000-8000-000000002231';

    update public.flaggor set aktiv = true where kod = 'erbjudanden';
    update public.bookings set antal_barn = 1 where id = '00000000-0000-4000-8000-00000000b16b';
    perform public.klippkort_dra('00000000-0000-4000-8000-00000000b16a', p);
    perform public.klippkort_dra('00000000-0000-4000-8000-00000000b16b', p);
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid, avvikelse_skal)
    values (s, a, '00000000-0000-4000-8000-00000000b16a', 'x', current_date, 'narvarande', '09:00', '09:15', 'prov'),
           (s, a, '00000000-0000-4000-8000-00000000b16b', 'x', current_date, 'narvarande', '11:00', '11:30', 'prov');
    update public.klippkort set status = 'tvist' where id = '00000000-0000-4000-8000-00000000c16a';
    fore := intern.timbank_saldo(p);

    n1 := intern.timmar_betalar_obetalda(p);
    select betalning_status into st1 from public.bookings where id = '00000000-0000-4000-8000-000000002231';
    select minuter into uttag from public.timbank_uttag
     where booking_id = '00000000-0000-4000-8000-000000002231' and sort = 'pass';
    saldo := intern.timbank_saldo(p);
    select betalning_status into st_d1 from public.bookings where id = '00000000-0000-4000-8000-00000000b0d1';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('22.3 flaggan och timbanken', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('22.3 flaggan av: jobbet betalar ingenting', n0 = 0 and st0 = 'ingen', 'betalade ' || n0 || ', ' || st0),
    ('22.3 timbanken som fyllts på betalar ett bekräftat pass',
     fore = 75 and n1 = 1 and st1 = 'betald' and uttag = 60 and saldo = 15,
     'före ' || fore || ', betalade ' || n1 || ', ' || st1 || ', uttag ' || coalesce(uttag::text, 'null') || ', saldo ' || saldo),
    ('22.3 räcker minuterna inte står nästa pass obetalt', st_d1 = 'ingen', st_d1);
end $$;

-- 3. Jobbet betalar samma pass som bekräftelsen och inga andra. c16a (tio
--    timmar) betalar 2244 med en påbörjad kassa, b16a och b0d1 i
--    datumordning. Två barn, första timmen bjuden, faktura, b0c1 igår
--    och ett pass efter kortets sista dag rörs inte.
do $$
declare
  p    uuid := '00000000-0000-4000-8000-0000000000f1';
  a    uuid := '00000000-0000-4000-8000-0000000000a1';
  s    uuid := '00000000-0000-4000-8000-000000000516';
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  c16a uuid := '00000000-0000-4000-8000-00000000c16a';
  n int; k0 uuid; k1 uuid; st2 text; k3 uuid; k4 uuid; kb16a uuid; kd1 uuid; kc1 uuid; kb16b uuid;
  fel text;
begin
  begin
    update public.flaggor set aktiv = true where kod = 'erbjudanden';
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status, antal_barn, betalning_status) values
      ('00000000-0000-4000-8000-000000002240', p, a, s, p, idag + 2, '13:00', 60, 'confirmed', 2, 'ingen'),
      ('00000000-0000-4000-8000-000000002241', p, a, s, p, idag + 3, '13:00', 60, 'confirmed', 1, 'ingen'),
      ('00000000-0000-4000-8000-000000002242', p, a, s, p, idag + 4, '13:00', 60, 'confirmed', 1, 'faktura'),
      ('00000000-0000-4000-8000-000000002244', p, a, s, p, idag + 5, '13:00', 60, 'confirmed', 1, 'vantar'),
      ('00000000-0000-4000-8000-000000002243', p, a, s, p, idag + 250, '13:00', 60, 'confirmed', 1, 'ingen');
    update public.bookings set startrabatt = true where id = '00000000-0000-4000-8000-000000002241';

    n := intern.timmar_betalar_obetalda(p);
    select klippkort_id into k0 from public.bookings where id = '00000000-0000-4000-8000-000000002240';
    select klippkort_id into k1 from public.bookings where id = '00000000-0000-4000-8000-000000002241';
    select betalning_status into st2 from public.bookings where id = '00000000-0000-4000-8000-000000002242';
    select klippkort_id into k3 from public.bookings where id = '00000000-0000-4000-8000-000000002243';
    select klippkort_id into k4 from public.bookings where id = '00000000-0000-4000-8000-000000002244';
    select klippkort_id into kb16a from public.bookings where id = '00000000-0000-4000-8000-00000000b16a';
    select klippkort_id into kd1 from public.bookings where id = '00000000-0000-4000-8000-00000000b0d1';
    select klippkort_id into kc1 from public.bookings where id = '00000000-0000-4000-8000-00000000b0c1';
    select klippkort_id into kb16b from public.bookings where id = '00000000-0000-4000-8000-00000000b16b';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('22.3 vilka pass jobbet betalar', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('22.3 jobbet betalar de bekräftade passen timmarna räcker till',
     n = 3 and k4 = c16a and kb16a = c16a and kd1 = c16a,
     'betalade ' || n || ', 2244 ' || coalesce(k4::text, '-') || ', b16a ' || coalesce(kb16a::text, '-')
     || ', b0d1 ' || coalesce(kd1::text, '-')),
    ('22.3 två barn, första timmen, faktura, igår och efter kortets sista dag rörs inte',
     k0 is null and k1 is null and st2 = 'faktura' and k3 is null and kc1 is null and kb16b is null,
     coalesce(k0::text, '-') || ', ' || coalesce(k1::text, '-') || ', ' || st2 || ', ' || coalesce(k3::text, '-')
     || ', ' || coalesce(kc1::text, '-') || ', ' || coalesce(kb16b::text, '-'));
end $$;

-- 4. Schemats anrop gäller alla familjer. Det provas för sig, och rullas
--    tillbaka: i driften kan det finnas riktiga pass att betala. Av
--    fixturerna betalar c16a b16a och b0d1.
do $$
declare
  n int; fel text;
begin
  begin
    update public.flaggor set aktiv = true where kod = 'erbjudanden';
    n := intern.timmar_betalar_obetalda();
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  insert into utfall (test, ok, detalj) values
    ('22.3 schemats anrop för alla familjer går igenom', fel = 'rulla tillbaka' and n >= 2,
     coalesce(fel, 'null') || ', betalade ' || coalesce(n::text, 'null'));
end $$;

insert into utfall (test, ok, detalj)
select '22.3 schemat kör jobbet var femte minut', count(*) = 1,
       coalesce(string_agg(schedule || ' ' || command, '; '), 'inget jobb')
  from cron.job
 where jobname = 'timmar-betalar' and active and schedule = '*/5 * * * *'
   and command like '%intern.timmar_betalar_obetalda()%';

select pg_temp.prova('22.3 familjen kör inte jobbet själv', '00000000-0000-4000-8000-0000000000f1',
  array['select intern.timmar_betalar_obetalda()'],
  'nekad');

-- ============================================================
-- FAS 22.4 — timmen dras när familjen föreslår passet
--
-- Familj P föreslår som föräldravyn gör: inloggad, med samma kolumner.
-- P:s andra kommande pass som väntar på timmar avbokas först i varje
-- block där det spelar roll, så att jobbet och köpet inte ger dem
-- timmarna och kvar bara räknar provets egna pass. De nya passen ligger
-- klockan 19 och 20, där inget annat pass står.
-- ============================================================

-- 1. Förslaget tar timmen, motförslaget behåller den, ett ja drar
--    ingenting till, och ett nej eller ett tillbakadraget förslag ger
--    tillbaka den.
do $$
declare
  p    uuid := '00000000-0000-4000-8000-0000000000f1';
  a    uuid := '00000000-0000-4000-8000-0000000000a1';
  s    uuid := '00000000-0000-4000-8000-000000000516';
  c16a uuid := '00000000-0000-4000-8000-00000000c16a';
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  f1 uuid; f2 uuid; f3 uuid;
  kvar0 int; kvar1 int; kvar2 int; kvar3 int; kvar4 int; kvar5 int;
  st1 text; kk1 uuid; st2 text; kk2 uuid; dag2 date; st3 text; kk3 uuid; st4 text; st5 text;
  fel text;
begin
  begin
    update public.flaggor set aktiv = true where kod = 'erbjudanden';
    update public.bookings set status = 'cancelled'
     where parent_id = p and status in ('requested', 'confirmed') and wanted_date >= idag;
    select kvar into kvar0 from public.klippkort_saldo where id = c16a;

    perform pg_temp.bli(p);
    insert into public.bookings (parent_id, tutor_id, student_id, created_by, subject, tjanst, antal_barn,
                                 wanted_date, wanted_time, duration_min, format, status)
    values (p, a, s, p, 'Matematik', 'laxhjalp', 1, idag + 3, '19:00', 60, 'Online', 'requested')
    returning id into f1;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select betalning_status, klippkort_id into st1, kk1 from public.bookings where id = f1;
    select kvar into kvar1 from public.klippkort_saldo where id = c16a;

    -- Studiehjälparen kan inte den tiden och föreslår dagen efter.
    perform pg_temp.bli(a);
    update public.bookings set wanted_date = idag + 4, wanted_time = '19:00', status = 'requested', created_by = a
     where id = f1;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select betalning_status, klippkort_id, wanted_date into st2, kk2, dag2 from public.bookings where id = f1;
    select kvar into kvar2 from public.klippkort_saldo where id = c16a;

    perform pg_temp.bli(p);
    update public.bookings set status = 'confirmed' where id = f1;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select betalning_status, klippkort_id into st3, kk3 from public.bookings where id = f1;
    select kvar into kvar3 from public.klippkort_saldo where id = c16a;

    -- Ett förslag till, som studiehjälparen avböjer.
    perform pg_temp.bli(p);
    insert into public.bookings (parent_id, tutor_id, student_id, created_by, subject, tjanst, antal_barn,
                                 wanted_date, wanted_time, duration_min, format, status)
    values (p, a, s, p, 'Matematik', 'laxhjalp', 1, idag + 5, '19:00', 60, 'Online', 'requested')
    returning id into f2;
    perform pg_temp.bli(a);
    update public.bookings set status = 'cancelled' where id = f2;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select betalning_status into st4 from public.bookings where id = f2;
    select kvar into kvar4 from public.klippkort_saldo where id = c16a;

    -- Ett förslag på två timmar, som familjen drar tillbaka.
    perform pg_temp.bli(p);
    insert into public.bookings (parent_id, tutor_id, student_id, created_by, subject, tjanst, antal_barn,
                                 wanted_date, wanted_time, duration_min, format, status)
    values (p, a, s, p, 'Matematik', 'laxhjalp', 1, idag + 2, '19:00', 120, 'Online', 'requested')
    returning id into f3;
    update public.bookings set status = 'cancelled', avbokningsskal = 'annat' where id = f3;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select betalning_status into st5 from public.bookings where id = f3;
    select kvar into kvar5 from public.klippkort_saldo where id = c16a;
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('22.4 förslaget', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('22.4 familjen föreslår: timmen dras direkt',
     st1 = 'betald' and kk1 = c16a and kvar1 = kvar0 - 1,
     coalesce(st1, '-') || ', ' || coalesce(kk1::text, 'inget kort') || ', kvar ' || kvar0 || ' → ' || kvar1),
    ('22.4 studiehjälparen föreslår en annan tid: samma timme betalar passet',
     st2 = 'betald' and kk2 = c16a and dag2 = idag + 4 and kvar2 = kvar0 - 1,
     coalesce(st2, '-') || ', ' || coalesce(kk2::text, 'inget kort') || ', ' || dag2 || ', kvar ' || kvar2),
    ('22.4 familjen säger ja: inget dras till',
     st3 = 'betald' and kk3 = c16a and kvar3 = kvar0 - 1,
     coalesce(st3, '-') || ', ' || coalesce(kk3::text, 'inget kort') || ', kvar ' || kvar3),
    ('22.4 studiehjälparen avböjer: timmen kommer tillbaka', st4 = 'ingen' and kvar4 = kvar0 - 1,
     coalesce(st4, '-') || ', kvar ' || kvar4),
    ('22.4 familjen drar tillbaka: timmarna kommer tillbaka', st5 = 'ingen' and kvar5 = kvar0 - 1,
     coalesce(st5, '-') || ', kvar ' || kvar5);
end $$;

-- 2. Ett förslag som ingen svarat på när dagen gått lämnar tillbaka
--    timmen när jobbet kör, men ett bekräftat pass som varit behåller
--    sin. Ett obetalt bekräftat pass som flyttas blir ett förslag igen
--    och betalas som ett.
do $$
declare
  p    uuid := '00000000-0000-4000-8000-0000000000f1';
  a    uuid := '00000000-0000-4000-8000-0000000000a1';
  s    uuid := '00000000-0000-4000-8000-000000000516';
  c16a uuid := '00000000-0000-4000-8000-00000000c16a';
  g1   uuid := '00000000-0000-4000-8000-0000000224b1';
  m1   uuid := '00000000-0000-4000-8000-0000000224b2';
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  kvar0 int; kvar1 int; n int;
  st_fore text; kk_fore uuid; st_g1 text; kk_g1 uuid; st_c1 text; kk_c1 uuid; st_m1 text; kk_m1 uuid;
  fel text;
begin
  begin
    update public.flaggor set aktiv = true where kod = 'erbjudanden';
    update public.bookings set status = 'cancelled'
     where parent_id = p and status in ('requested', 'confirmed') and wanted_date >= idag;
    select kvar into kvar0 from public.klippkort_saldo where id = c16a;

    -- I går, och ingen svarade. Som postgres: en vy skapar inget pass
    -- bakåt i tiden.
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status, antal_barn)
    values (g1, p, a, s, p, idag - 1, '20:00', 60, 'requested', 1);
    select betalning_status, klippkort_id into st_fore, kk_fore from public.bookings where id = g1;
    perform public.klippkort_dra('00000000-0000-4000-8000-00000000b0c1', p);

    -- Bokat med flaggan av, alltså obetalt, och familjen flyttar det.
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status, antal_barn)
    values (m1, p, a, s, p, idag + 6, '20:00', 60, 'confirmed', 1);
    perform pg_temp.bli(p);
    update public.bookings set wanted_date = idag + 8, wanted_time = '20:00', status = 'requested', created_by = p
     where id = m1;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select betalning_status, klippkort_id into st_m1, kk_m1 from public.bookings where id = m1;

    n := intern.timmar_betalar_obetalda(p);
    select betalning_status, klippkort_id into st_g1, kk_g1 from public.bookings where id = g1;
    select betalning_status, klippkort_id into st_c1, kk_c1 from public.bookings where id = '00000000-0000-4000-8000-00000000b0c1';
    select kvar into kvar1 from public.klippkort_saldo where id = c16a;
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('22.4 förslag som ingen svarat på', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('22.4 ett förslag som ingen svarat på när dagen gått ger tillbaka timmen',
     st_fore = 'betald' and kk_fore = c16a and st_g1 = 'ingen' and kk_g1 is null,
     'före ' || coalesce(st_fore, '-') || ', efter ' || coalesce(st_g1, '-') || ', ' || coalesce(kk_g1::text, 'inget kort')),
    ('22.4 ett bekräftat pass som varit behåller sin timme', st_c1 = 'betald' and kk_c1 = c16a,
     coalesce(st_c1, '-') || ', ' || coalesce(kk_c1::text, 'inget kort')),
    ('22.4 ett obetalt bekräftat pass som flyttas betalas som ett nytt förslag', st_m1 = 'betald' and kk_m1 = c16a,
     coalesce(st_m1, '-') || ', ' || coalesce(kk_m1::text, 'inget kort')),
    ('22.4 jobbet räknar inte släppet som en betalning, och kvar stämmer', n = 0 and kvar1 = kvar0 - 2,
     'betalade ' || n || ', kvar ' || kvar0 || ' → ' || kvar1);
end $$;

-- 3. Ett förslag som skickas utan timmar kvar står obetalt. Köper
--    familjen nya betalar de det, och blir en timme ledig betalar jobbet
--    nästa förslag. c16a hamnar i tvist, så att dess timmar inte hinner
--    först.
do $$
declare
  p    uuid := '00000000-0000-4000-8000-0000000000f1';
  a    uuid := '00000000-0000-4000-8000-0000000000a1';
  s    uuid := '00000000-0000-4000-8000-000000000516';
  ny   uuid := '00000000-0000-4000-8000-0000000224d0';
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  u1 uuid; u2 uuid;
  st1_fore text; blev boolean; k1 uuid; st2_fore text; n int; k2 uuid;
  fel text;
begin
  begin
    update public.flaggor set aktiv = true where kod = 'erbjudanden';
    update public.klippkort set status = 'tvist' where id = '00000000-0000-4000-8000-00000000c16a';
    update public.bookings set status = 'cancelled'
     where parent_id = p and status in ('requested', 'confirmed') and wanted_date >= idag;

    perform pg_temp.bli(p);
    insert into public.bookings (parent_id, tutor_id, student_id, created_by, subject, tjanst, antal_barn,
                                 wanted_date, wanted_time, duration_min, format, status)
    values (p, a, s, p, 'Matematik', 'laxhjalp', 1, idag + 3, '19:00', 60, 'Online', 'requested')
    returning id into u1;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select betalning_status into st1_fore from public.bookings where id = u1;

    insert into public.klippkort (id, parent_id, erbjudande, namn, sort, timmar, giltig_manader, rabatt_procent,
                                  timpris_ore, begart_ore, status)
    values (ny, p, 'klipp10', 'Prov 1 timme', 'klippkort', 1, 6, 5, 37900, 36000, 'vantar');
    blev := public.klippkort_betald(ny, 36000, 'pi_rlsprov_22_4c', 'ch_rlsprov_22_4c', null, null, null, false);
    select klippkort_id into k1 from public.bookings where id = u1;

    perform pg_temp.bli(p);
    insert into public.bookings (parent_id, tutor_id, student_id, created_by, subject, tjanst, antal_barn,
                                 wanted_date, wanted_time, duration_min, format, status)
    values (p, a, s, p, 'Matematik', 'laxhjalp', 1, idag + 4, '19:00', 60, 'Online', 'requested')
    returning id into u2;
    update public.bookings set status = 'cancelled', avbokningsskal = 'annat' where id = u1;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select betalning_status into st2_fore from public.bookings where id = u2;
    n := intern.timmar_betalar_obetalda(p);
    select klippkort_id into k2 from public.bookings where id = u2;
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('22.4 köpet och jobbet', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('22.4 ett förslag utan timmar kvar står obetalt', st1_fore = 'ingen' and st2_fore = 'ingen',
     coalesce(st1_fore, '-') || ' / ' || coalesce(st2_fore, '-')),
    ('22.4 köpet blir betalt: de nya timmarna betalar förslaget', blev and k1 = ny,
     coalesce(blev::text, 'null') || ', ' || coalesce(k1::text, 'inget kort')),
    ('22.4 en timme blir ledig: jobbet betalar nästa förslag', n = 1 and k2 = ny,
     'betalade ' || n || ', ' || coalesce(k2::text, 'inget kort'));
end $$;

-- 4. Samma undantag som bekräftelsen. Första timmen bjuden avgörs i
--    bookings_startrabatt, före timmarna: familj Q:s första förslag på
--    två timmar får timmen bjuden och betalas inte med timmarna, nästa
--    gör det. Ett förslag med två barn betalas inte, och med flaggan av
--    betalar timmarna ingenting.
do $$
declare
  p    uuid := '00000000-0000-4000-8000-0000000000f1';
  q    uuid := '00000000-0000-4000-8000-0000000000f2';
  a    uuid := '00000000-0000-4000-8000-0000000000a1';
  b    uuid := '00000000-0000-4000-8000-0000000000b1';
  s    uuid := '00000000-0000-4000-8000-000000000516';
  sq   uuid := '00000000-0000-4000-8000-0000000005c1';
  cq   uuid := '00000000-0000-4000-8000-0000000224e0';
  q1   uuid := '00000000-0000-4000-8000-0000000224e1';
  q2   uuid := '00000000-0000-4000-8000-0000000224e2';
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  x2 uuid; x3 uuid;
  rab1 boolean; st_q1 text; st_q2 text; kk_q2 uuid; st_x2 text; st_x3 text;
  fel text;
begin
  begin
    update public.flaggor set aktiv = true where kod = 'erbjudanden';
    insert into public.klippkort (id, parent_id, erbjudande, namn, sort, timmar, giltig_manader, rabatt_procent,
                                  timpris_ore, begart_ore, betalt_ore, status, giltigt_till, betald_at, stripe_charge_id)
    values (cq, q, 'klipp10', 'Prov 5 timmar', 'klippkort', 5, 6, 5,
            37900, 180000, 180000, 'betald', idag + 30, now(), 'ch_rlsprov_22_4e');
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status, antal_barn)
    values (q1, q, b, sq, q, idag + 3, '19:00', 120, 'requested', 1);
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status, antal_barn)
    values (q2, q, b, sq, q, idag + 4, '19:00', 60, 'requested', 1);
    select startrabatt, betalning_status into rab1, st_q1 from public.bookings where id = q1;
    select betalning_status, klippkort_id into st_q2, kk_q2 from public.bookings where id = q2;

    perform pg_temp.bli(p);
    insert into public.bookings (parent_id, tutor_id, student_id, created_by, subject, tjanst, antal_barn,
                                 wanted_date, wanted_time, duration_min, format, status)
    values (p, a, s, p, 'Matematik', 'laxhjalp', 2, idag + 3, '20:00', 60, 'Online', 'requested')
    returning id into x2;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select betalning_status into st_x2 from public.bookings where id = x2;

    update public.flaggor set aktiv = false where kod = 'erbjudanden';
    perform pg_temp.bli(p);
    insert into public.bookings (parent_id, tutor_id, student_id, created_by, subject, tjanst, antal_barn,
                                 wanted_date, wanted_time, duration_min, format, status)
    values (p, a, s, p, 'Matematik', 'laxhjalp', 1, idag + 4, '20:00', 60, 'Online', 'requested')
    returning id into x3;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select betalning_status into st_x3 from public.bookings where id = x3;
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('22.4 undantagen', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('22.4 första timmen bjuden avgörs före timmarna, och det förslaget betalas inte med dem',
     rab1 and st_q1 = 'ingen', coalesce(rab1::text, 'null') || ', ' || coalesce(st_q1, '-')),
    ('22.4 nästa förslag från samma familj betalas med timmarna', st_q2 = 'betald' and kk_q2 = cq,
     coalesce(st_q2, '-') || ', ' || coalesce(kk_q2::text, 'inget kort')),
    ('22.4 ett förslag med två barn betalas inte med timmarna', st_x2 = 'ingen', coalesce(st_x2, '-')),
    ('22.4 flaggan av: förslaget betalas inte', st_x3 = 'ingen', coalesce(st_x3, '-'));
end $$;

-- 5. Timbanken betalar ett förslag när det skapas. Uttaget skrivs i samma
--    skrivning som passet, innan passets rad finns, och prövas mot det
--    vid commit; set constraints tvingar fram den prövningen här. Ett
--    förslag i går som ingen svarat på lämnar tillbaka minuterna.
--    Timbanken fylls till 75 minuter som i 22.2, och c16a hamnar i tvist.
do $$
declare
  p    uuid := '00000000-0000-4000-8000-0000000000f1';
  a    uuid := '00000000-0000-4000-8000-0000000000a1';
  s    uuid := '00000000-0000-4000-8000-000000000516';
  t0   uuid := '00000000-0000-4000-8000-0000000224c0';
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  t1 uuid;
  fore int; st0_fore text; saldo0 int; st0 text; uttag0 int; saldo1 int;
  st1 text; uttag1 int; saldo2 int; kod1 text;
  fel text;
begin
  begin
    update public.flaggor set aktiv = true where kod = 'erbjudanden';
    update public.bookings set antal_barn = 1 where id = '00000000-0000-4000-8000-00000000b16b';
    perform public.klippkort_dra('00000000-0000-4000-8000-00000000b16a', p);
    perform public.klippkort_dra('00000000-0000-4000-8000-00000000b16b', p);
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, start_tid, slut_tid, avvikelse_skal)
    values (s, a, '00000000-0000-4000-8000-00000000b16a', 'x', current_date, 'narvarande', '09:00', '09:15', 'prov'),
           (s, a, '00000000-0000-4000-8000-00000000b16b', 'x', current_date, 'narvarande', '11:00', '11:30', 'prov');
    update public.klippkort set status = 'tvist' where id = '00000000-0000-4000-8000-00000000c16a';
    update public.bookings set status = 'cancelled'
     where parent_id = p and status in ('requested', 'confirmed') and wanted_date >= idag;
    fore := intern.timbank_saldo(p);

    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status, antal_barn)
    values (t0, p, a, s, p, idag - 1, '20:00', 60, 'requested', 1);
    select betalning_status into st0_fore from public.bookings where id = t0;
    saldo0 := intern.timbank_saldo(p);
    perform intern.timmar_betalar_obetalda(p);
    select betalning_status into st0 from public.bookings where id = t0;
    select count(*) into uttag0 from public.timbank_uttag where booking_id = t0;
    saldo1 := intern.timbank_saldo(p);

    perform pg_temp.bli(p);
    insert into public.bookings (parent_id, tutor_id, student_id, created_by, subject, tjanst, antal_barn,
                                 wanted_date, wanted_time, duration_min, format, status)
    values (p, a, s, p, 'Matematik', 'laxhjalp', 1, idag + 3, '19:00', 60, 'Online', 'requested')
    returning id into t1;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    set constraints public.timbank_uttag_booking_id_fkey immediate;
    select betalning_status into st1 from public.bookings where id = t1;
    select minuter into uttag1 from public.timbank_uttag where booking_id = t1 and sort = 'pass';
    saldo2 := intern.timbank_saldo(p);
    kod1 := intern.betalsatt_kod(t1);
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('22.4 timbanken', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('22.4 timbanken betalar förslaget direkt, och uttaget pekar på passet vid commit',
     fore = 75 and st1 = 'betald' and uttag1 = 60 and saldo2 = 15 and kod1 = 'timmar',
     'före ' || fore || ', ' || coalesce(st1, '-') || ', uttag ' || coalesce(uttag1::text, 'null')
     || ', saldo ' || saldo2 || ', ' || coalesce(kod1, 'null')),
    ('22.4 minuterna på ett förslag som ingen svarat på kommer tillbaka',
     st0_fore = 'betald' and saldo0 = 15 and st0 = 'ingen' and uttag0 = 0 and saldo1 = 75,
     coalesce(st0_fore, '-') || ', saldo ' || saldo0 || ' → ' || coalesce(st0, '-') || ', uttag ' || uttag0 || ', saldo ' || saldo1);
end $$;

insert into utfall (test, ok, detalj)
select '22.4 förslagets trigger kör efter skydden och startrabatten', count(*) = 1,
       coalesce(string_agg(pg_get_triggerdef(t.oid), '; '), 'ingen trigger')
  from pg_trigger t
 where t.tgrelid = 'public.bookings'::regclass
   and t.tgname = 'bookings_timmar_betalar_forslaget'
   and not t.tgisinternal
   and t.tgname > 'bookings_skydda_klippkortet'
   and t.tgname > 'bookings_startrabatt';

insert into utfall (test, ok, detalj)
select '22.4 timbankens uttag prövas mot passet vid commit', coalesce(bool_and(c.condeferrable and c.condeferred), false),
       coalesce(string_agg('deferrable ' || c.condeferrable || ', deferred ' || c.condeferred, '; '), 'ingen nyckel')
  from pg_constraint c
 where c.conrelid = 'public.timbank_uttag'::regclass and c.conname = 'timbank_uttag_booking_id_fkey';

select pg_temp.prova('22.4 familjen släpper inga timmar själv', '00000000-0000-4000-8000-0000000000f1',
  array['select intern.obesvarade_forslag_slapper_timmarna()'],
  'nekad');

-- ------------------------------------------------------------
-- CV:t i en ansökan: admin läser, ingen annan (admin_laser_ansokans_cv)
--
-- Hinken cv hade bara skrivpolicyn för anon, så adminvyn kunde inte
-- öppna ett enda CV. Filen läggs in som postgres: anon får inte läsa
-- tillbaka det hen laddat upp, och då hade noll betytt "finns inte" i
-- stället för "får inte se".
-- ------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', null, true);

insert into storage.objects (bucket_id, name)
values ('cv', '1700000000000-rlsprov-Prov_CV.pdf');

select pg_temp.rakna('CV admin ser CV:t', '00000000-0000-4000-8000-0000000000ad',
  $q$select count(*) from storage.objects
      where bucket_id = 'cv' and name = '1700000000000-rlsprov-Prov_CV.pdf'$q$, 1);
select pg_temp.rakna('CV studiehjälparen ser det inte', '00000000-0000-4000-8000-0000000000a1',
  $q$select count(*) from storage.objects
      where bucket_id = 'cv' and name = '1700000000000-rlsprov-Prov_CV.pdf'$q$, 0);
select pg_temp.rakna('CV familjen ser det inte', '00000000-0000-4000-8000-0000000000f1',
  $q$select count(*) from storage.objects
      where bucket_id = 'cv' and name = '1700000000000-rlsprov-Prov_CV.pdf'$q$, 0);
select pg_temp.rakna('CV anon ser det inte', null,
  $q$select count(*) from storage.objects
      where bucket_id = 'cv' and name = '1700000000000-rlsprov-Prov_CV.pdf'$q$, 0);

-- Formuläret laddar upp utan konto, och det ska det fortsätta göra.
select pg_temp.prova('CV anon laddar fortfarande upp', null,
  array[$q$insert into storage.objects (bucket_id, name)
           values ('cv', '1700000000001-rlsprov-Nytt_CV.pdf')$q$], 'ok');

insert into utfall (test, ok, detalj)
select 'CV hinken cv är privat', not b.public, 'public = ' || b.public
from storage.buckets b where b.id = 'cv';

-- ------------------------------------------------------------
-- Fas 19.6: fakturan bär sitt OCR-nummer
--
-- Admin skriver in OCR:et från Fortnox. Kontrollsiffran prövas av
-- villkoret invoices_ocr_giltigt, och ett felskrivet ska nekas av
-- VILLKORET (23514), inte med permission denied: villkoret körs som
-- anroparen, och intern.ocr_giltigt måste vara nåbar för admin.
--
-- Svaren samlas i variabler och skrivs efter återrullningen, som i
-- blocken ovan. Blocket skrev dem först inne i deltransaktionen, som
-- inloggad: utfall ägs av postgres, så första raden nekades, och det
-- enda som stod kvar var "19.6 OCR: permission denied for table
-- utfall". Hade skrivningen gått igenom hade återrullningen tagit den.
-- ------------------------------------------------------------
do $$
declare
  fel text; kod text; n_admin int; n_familj int; o text;
begin
  begin
    insert into public.invoices (id, parent_id, period, status, belopp_ore)
    values ('00000000-0000-4000-8000-0000000019f6', '00000000-0000-4000-8000-0000000000f1', '2026-09-01', 'utkast', 37900);

    perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
    update public.invoices set status = 'skickad', fortnox_fakturanummer = '1001', ocr = '49927398716'
     where id = '00000000-0000-4000-8000-0000000019f6';
    get diagnostics n_admin = row_count;

    begin
      update public.invoices set ocr = '49927398717' where id = '00000000-0000-4000-8000-0000000019f6';
      kod := 'gick igenom';
    exception when others then kod := sqlstate;
    end;

    perform pg_temp.bli('00000000-0000-4000-8000-0000000000f1');
    select ocr into o from public.invoices where id = '00000000-0000-4000-8000-0000000019f6';
    update public.invoices set ocr = '18' where id = '00000000-0000-4000-8000-0000000019f6';
    get diagnostics n_familj = row_count;

    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('19.6 OCR', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('19.6 admin sparar ett giltigt OCR', n_admin = 1, 'rader ' || n_admin),
      ('19.6 ett felskrivet OCR nekas av villkoret', kod = '23514', kod),
      ('19.6 familjen läser OCR på sin faktura', o = '49927398716', coalesce(o, 'null')),
      ('19.6 familjen skriver inte OCR', n_familj = 0, 'rader ' || n_familj);
  end if;
end $$;

-- ------------------------------------------------------------
-- Notisfelen är bara databasens egna utskick (2026-09-27)
--
-- notisfel() läste förut hela net._http_response, och fem prov som
-- sessioner gjort efter en driftsättning stod en eftermiddag som
-- notiser som inte gick fram. Nu räknas bara svar på anrop som gått
-- genom intern.natanrop eller webhooken för intresseanmälan. Svaren
-- läggs in för hand med negativa id, som inget riktigt anrop får.
-- Anropet genom natanrop köas i pg_net, men rullas tillbaka innan
-- pg_net ser det.
-- ------------------------------------------------------------
do $$
declare
  rader jsonb; n_familj bigint; b bigint; minns bigint; fel text;
begin
  begin
    insert into net._http_response (id, status_code, timed_out, created, headers) values
      (-9001, 401, false, now(), '{}'::jsonb),
      (-9002, 405, false, now(), '{}'::jsonb),
      (-9003, 200, false, now(), '{}'::jsonb),
      (-9004, 500, false, now(), '{}'::jsonb),
      (-9005, 401, false, now(), '{"sb-error-code": "UNAUTHORIZED_NO_AUTH_HEADER"}'::jsonb);
    -- -9002 är provet: ett svar ingen av vägarna minns
    insert into intern.natanrop_logg (id, mal) values
      (-9001, 'notis-ko'), (-9003, 'notis-ko'), (-9005, 'ansokan-gallring');
    insert into supabase_functions.hooks (hook_table_id, hook_name, request_id)
    values (0, 'ny-intresseanmalan', -9004);

    b := intern.natanrop('rls-prov', url := 'https://example.invalid/nextrum-rls-test');
    select count(*) into minns from intern.natanrop_logg where id = b and mal = 'rls-prov';

    perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
    select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'kalla', x.kalla, 'grindfel', x.grindfel)
                              order by x.id), '[]')
      into rader from public.notisfel(24) x where x.id < 0;
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000f1');
    select count(*) into n_familj from public.notisfel(24);
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('notisfel', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('notisfel: admin ser de egna felen och vägen, inte provet eller det som gick fram',
       rader = '[{"id": -9005, "kalla": "ansokan-gallring", "grindfel": "UNAUTHORIZED_NO_AUTH_HEADER"},
                 {"id": -9004, "kalla": "lead-notis", "grindfel": null},
                 {"id": -9001, "kalla": "notis-ko", "grindfel": null}]'::jsonb,
       rader::text),
      ('notisfel: en familj får noll rader', n_familj = 0, 'rader: ' || n_familj),
      ('natanrop minns sitt anrop', minns = 1, 'rader: ' || minns);
  end if;
end $$;

insert into utfall (test, ok, detalj)
select 'natanrop och dess logg går inte att nå utifrån',
       coalesce(not has_function_privilege('anon', to_regprocedure('intern.natanrop(text,text,jsonb,jsonb,integer)'), 'execute')
            and not has_function_privilege('authenticated', to_regprocedure('intern.natanrop(text,text,jsonb,jsonb,integer)'), 'execute')
            and not has_table_privilege('anon', to_regclass('intern.natanrop_logg'), 'select')
            and not has_table_privilege('authenticated', to_regclass('intern.natanrop_logg'), 'select'), false),
       case when to_regprocedure('intern.natanrop(text,text,jsonb,jsonb,integer)') is null
            then 'funktionen finns inte' else 'anon/authenticated' end;

-- Nästa funktion som ringer pg_net direkt syns inte i notisfel() när
-- anropet går fel. Den här raden fångar den.
insert into utfall (test, ok, detalj)
select 'ingen funktion ringer net.http_* förbi intern.natanrop', count(*) = 0,
       coalesce(string_agg(p.oid::regprocedure::text, ', '), 'inga')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('public', 'intern')
   and p.prosrc ~ 'net\.http_(post|get|delete)\s*\('
   and p.oid is distinct from to_regprocedure('intern.natanrop(text,text,jsonb,jsonb,integer)');

-- ------------------------------------------------------------
-- Klientfelen minns vem det gällde (2026-09-28)
--
-- Databasen sätter klientfel.anvandare ur auth.uid() och skriver över
-- det klienten skickar: insert-policyn släpper in vem som helst, och
-- ett fel i någon annans namn hade fått Skriv till de drabbade att
-- mejla fel person. P försöker lägga sitt fel på Q.
-- ------------------------------------------------------------
do $$
declare
  inloggad uuid; utloggad uuid; utan_profil uuid; n_utan int; fel text;
begin
  begin
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000f1');
    insert into public.klientfel (meddelande, sida, anvandare)
    values ('rls-vem-inloggad', '/foralder', '00000000-0000-4000-8000-0000000000f2');
    perform pg_temp.bli(null);
    insert into public.klientfel (meddelande, sida, anvandare)
    values ('rls-vem-utloggad', '/', '00000000-0000-4000-8000-0000000000f2');
    perform set_config('request.jwt.claims',
      '{"sub":"00000000-0000-4000-8000-00000000dead","role":"authenticated"}', true);
    execute 'set local role authenticated';
    insert into public.klientfel (meddelande, sida) values ('rls-vem-utan-profil', '/admin');
    reset role;
    perform set_config('request.jwt.claims', '', true);

    select anvandare into inloggad from public.klientfel where meddelande = 'rls-vem-inloggad';
    select anvandare into utloggad from public.klientfel where meddelande = 'rls-vem-utloggad';
    select anvandare, 1 into utan_profil, n_utan from public.klientfel where meddelande = 'rls-vem-utan-profil';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('klientfel minns vem', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('klientfel: det inloggade kontot, inte det klienten skickade',
       inloggad is not distinct from '00000000-0000-4000-8000-0000000000f1'::uuid, coalesce(inloggad::text, 'null')),
      ('klientfel: utloggad blir null, fast klienten skickade ett id', utloggad is null, coalesce(utloggad::text, 'null')),
      ('klientfel: ett konto utan profil sparas ändå, utan id', n_utan = 1 and utan_profil is null,
       coalesce(utan_profil::text, 'null') || ', rader ' || coalesce(n_utan, 0));
  end if;
end $$;

-- ------------------------------------------------------------
-- Gallringen: ansökningar och CV:n tas bort efter ett år
-- (ansokningar_gallras_efter_ett_ar)
--
-- Regeln, spärren som håller filen före raden, filerna utan ansökan
-- och vem som når dörrarna. Att en fil faktiskt försvinner går bara att
-- se genom Storage-API:t och provades mot driften med en provfil.
-- Filerna här är rader i storage.objects utan någon fil bakom, och
-- rullas tillbaka som allt annat.
-- ------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', null, true);

insert into utfall (test, ok, detalj)
select 'Gallring CV-raden läses bara på en egen rad', v = array['1600000000000-abc-Mitt_CV.pdf'], array_to_string(v, ', ')
from (select intern.ansokan_cv_namn(
  E'Mitt CV: cv/inte-egen-rad.pdf\r\nRad två.\n\nCV: cv/1600000000000-abc-Mitt_CV.pdf\r\nKälla: okänd') as v) x;

insert into utfall (test, ok, detalj)
select 'Gallring en uppladdning som inte gick fram pekar inte ut någon fil', v = '{}', array_to_string(v, ', ')
from (select intern.ansokan_cv_namn(
  'CV: bifogad fil "a.pdf" kunde inte laddas upp — be om den via mejl') as v) x;

-- En borttagning ska ta bort innehållet. Med versionshantering på hinken
-- hade en borttagen fil kunnat ligga kvar som en äldre version.
insert into utfall (test, ok, detalj)
select 'Gallring hinken cv har ingen versionshantering',
       coalesce(to_jsonb(b) ->> 'versioning_status', 'DISABLED') = 'DISABLED',
       coalesce(to_jsonb(b) ->> 'versioning_status', 'kolumnen saknas')
from storage.buckets b where b.id = 'cv';

-- Regeln. Ansökningarna läggs in som postgres, så att created_at och
-- stegen står som provet säger; utifrån skrivs de över (16.1c).
do $$
declare
  lista uuid[]; fel text;
  g1 constant uuid := '00000000-0000-4000-8000-00000000cc01';
  g2 constant uuid := '00000000-0000-4000-8000-00000000cc02';
  g3 constant uuid := '00000000-0000-4000-8000-00000000cc03';
  g4 constant uuid := '00000000-0000-4000-8000-00000000cc04';
  g5 constant uuid := '00000000-0000-4000-8000-00000000cc05';
  g6 constant uuid := '00000000-0000-4000-8000-00000000cc06';
  g7 constant uuid := '00000000-0000-4000-8000-00000000cc07';
  g8 constant uuid := '00000000-0000-4000-8000-00000000cc08';
  g9 constant uuid := '00000000-0000-4000-8000-00000000cc09';
  g10 constant uuid := '00000000-0000-4000-8000-00000000cc10';
  g11 constant uuid := '00000000-0000-4000-8000-00000000cc11';
  g12 constant uuid := '00000000-0000-4000-8000-00000000cc12';
  slutad constant uuid := '00000000-0000-4000-8000-0000000000c9';
  tva_ar constant timestamptz := now() - interval '2 years';
  tre_ar constant timestamptz := now() - interval '3 years';
begin
  begin
    -- Studiehjälpare B är inte godkänd i det här provet. A är det.
    update public.tutor_profiles set status = 'pending' where id = '00000000-0000-4000-8000-0000000000b1';

    -- En godkänd studiehjälpare som slutade för tre år sedan: kontot,
    -- inloggningen och profilen är tre år gamla, och inga pass.
    insert into auth.users (id, email, raw_user_meta_data, created_at, last_sign_in_at) values
      (slutad, 'rls-slutad@example.invalid', '{"role":"tutor","full_name":"Test Slutad"}', tre_ar, tre_ar);
    update public.profiles set created_at = tre_ar, last_seen_at = null where id = slutad;
    update public.tutor_profiles set status = 'approved', created_at = tre_ar where id = slutad;

    insert into public.applications (id, name, email, status, created_at, kontaktad_at, mote_tid, prov_sista_dag) values
      (g1, 'Prov Avböjd',   'rls-gall-1@example.invalid',   'rejected',  tva_ar, null, null, null),
      (g2, 'Prov Godkänd',  'rls-gall-2@example.invalid',   'approved',  now() - interval '1 year', null, null, null),
      (g3, 'Prov Anna',     'rls-a@example.invalid',        'new',       tva_ar, null, null, null),
      (g4, 'Prov Anna',     ' RLS-A+igen@example.invalid',  'rejected',  tva_ar, null, null, null),
      (g5, 'Prov Kontakt',  'rls-gall-5@example.invalid',   'contacted', tva_ar, now() - interval '10 days', null, null),
      (g6, 'Prov Möte',     'rls-gall-6@example.invalid',   'contacted', tva_ar, null, now() + interval '10 days', null),
      (g7, 'Prov Ung',      'rls-gall-7@example.invalid',   'new',       now() - interval '11 months', null, null, null),
      (g8, 'Prov Provet',   'rls-gall-8@example.invalid',   'new',       tva_ar, null, null, current_date - 40),
      (g9, 'Prov Bo',       'rls-b@example.invalid',        'new',       tva_ar, null, null, null),
      (g10, 'Prov Gammal',  'rls-gall-10@example.invalid',  'approved',  tre_ar, null, null, null),
      (g11, 'Prov Anna',    'rls-a@example.invalid',        'approved',  tre_ar, null, null, null),
      (g12, 'Prov Slutad',  'rls-slutad@example.invalid',   'approved',  tre_ar, null, null, null);

    select array_agg(l.ansokan_id) into lista
      from public.ansokan_gallring_lista(1000) l
     where l.ansokan_id in (g1, g2, g3, g4, g5, g6, g7, g8, g9, g10, g11, g12);
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;

  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Gallring regeln', false, fel);
  else
    lista := coalesce(lista, '{}');
    insert into utfall (test, ok, detalj) values
      ('Gallring en avböjd ansökan äldre än ett år gallras', g1 = any (lista), 'med: ' || (g1 = any (lista))),
      ('Gallring en godkänd ansökan utan konto står kvar i två år', not g2 = any (lista), 'med: ' || (g2 = any (lista))),
      ('Gallring men gallras två år efter sitt senaste steg', g10 = any (lista), 'med: ' || (g10 = any (lista))),
      ('Gallring en godkänd ansökan står kvar så länge studiehjälparen är aktiv', not g11 = any (lista), 'med: ' || (g11 = any (lista))),
      ('Gallring och gallras två år efter att studiehjälparen slutat', g12 = any (lista), 'med: ' || (g12 = any (lista))),
      ('Gallring samma adress som en godkänd studiehjälpare håller kvar en ny ansökan', not g3 = any (lista), 'med: ' || (g3 = any (lista))),
      ('Gallring men inte en avböjd, inte heller med plustillägg', g4 = any (lista), 'med: ' || (g4 = any (lista))),
      ('Gallring ett steg de senaste trettio dagarna håller kvar ansökan', not g5 = any (lista), 'med: ' || (g5 = any (lista))),
      ('Gallring ett bokat möte håller kvar ansökan', not g6 = any (lista), 'med: ' || (g6 = any (lista))),
      ('Gallring en ansökan under ett år står kvar', not g7 = any (lista), 'med: ' || (g7 = any (lista))),
      ('Gallring provets sista dag är ett steg, och trettio dagar efter gallras ansökan', g8 = any (lista), 'med: ' || (g8 = any (lista))),
      ('Gallring en studiehjälpare som inte är godkänd skyddar ingenting', g9 = any (lista), 'med: ' || (g9 = any (lista)));
  end if;
end $$;

-- Filen först, raden sedan. Spärren sitter i ansokan_gallra(), inte i
-- edge-funktionen: raden går inte att ta bort medan dess fil finns.
do $$
declare
  fel text;
  filer1 text[]; filer3 text[];
  u1 text; u2 text; u3 text; u4 text; u5 text;
  kvar1 bigint; kvar2 bigint; utskick2 bigint; uppgift2 bigint; delad bigint;
  audit jsonb;
  h1 constant uuid := '00000000-0000-4000-8000-00000000cd01';
  h2 constant uuid := '00000000-0000-4000-8000-00000000cd02';
  h3 constant uuid := '00000000-0000-4000-8000-00000000cd03';
  h4 constant uuid := '00000000-0000-4000-8000-00000000cd04';
  tva_ar constant timestamptz := now() - interval '2 years';
begin
  begin
    insert into storage.objects (bucket_id, name) values
      ('cv', '1600000000000-gprov-Finns.pdf'),
      ('cv', '1600000000002-gprov-Delad.pdf');

    insert into public.applications (id, name, email, status, created_at, why) values
      (h1, 'Prov Fil',    'rls-gfil-1@example.invalid', 'rejected', tva_ar, E'Hej.\n\nCV: cv/1600000000000-gprov-Finns.pdf'),
      (h2, 'Prov Borta',  'rls-gfil-2@example.invalid', 'rejected', tva_ar, E'Hej.\n\nCV: cv/1600000000001-gprov-Borta.pdf'),
      (h3, 'Prov Delad',  'rls-gfil-3@example.invalid', 'rejected', tva_ar, E'CV: cv/1600000000002-gprov-Delad.pdf'),
      (h4, 'Prov Delad',  'rls-gfil-4@example.invalid', 'approved', now() - interval '1 year', E'CV: cv/1600000000002-gprov-Delad.pdf');

    perform public.skapa_uppgift('Obesvarad ansökan (prov)', 'rls:gallring:' || h2, 'uppfoljning',
      null, 'applications', h2::text, current_date);

    select l.filer into filer1 from public.ansokan_gallring_lista(1000) l where l.ansokan_id = h1;
    select l.filer into filer3 from public.ansokan_gallring_lista(1000) l where l.ansokan_id = h3;

    u1 := public.ansokan_gallra(h1);
    u2 := public.ansokan_gallra(h2);
    u3 := public.ansokan_gallra(h3);
    u4 := public.ansokan_gallra(h4);
    u5 := public.ansokan_gallra('00000000-0000-4000-8000-000000000000');

    select count(*) into kvar1 from public.applications where id = h1;
    select count(*) into kvar2 from public.applications where id = h2;
    select count(*) into utskick2 from public.ansokan_utskick where ansokan_id = h2;
    select count(*) into uppgift2 from public.uppgifter where kopplad_tabell = 'applications' and kopplad_id = h2::text;
    select count(*) into delad from storage.objects where bucket_id = 'cv' and name = '1600000000002-gprov-Delad.pdf';
    select l.fore into audit from public.audit_logg l
     where l.tabell = 'applications' and l.objekt_id = h2::text and l.handling = 'ansokan.borttagen';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;

  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Gallring filen före raden', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('Gallring listan bär ansökans fil', filer1 = array['1600000000000-gprov-Finns.pdf'], coalesce(array_to_string(filer1, ', '), 'ingen rad')),
      ('Gallring raden står kvar så länge filen finns', u1 = 'filen_finns_kvar' and kvar1 = 1, u1 || ', rader: ' || kvar1),
      ('Gallring utan fil i hinken tas raden bort', u2 = 'borttagen' and kvar2 = 0, u2 || ', rader: ' || kvar2),
      ('Gallring beskeden följer med', utskick2 = 0, 'rader: ' || utskick2),
      ('Gallring uppgifterna om ansökan följer med', uppgift2 = 0, 'rader: ' || uppgift2),
      ('Gallring borttagningen står i auditloggen, med läge och ålder',
        audit ->> 'status' = 'rejected' and audit ? 'created_at', coalesce(audit::text, 'ingen rad')),
      ('Gallring men utan namn, adress eller text',
        audit is not null and not (audit ?| array['name', 'email', 'why', 'school', 'notering', 'mote_lank']),
        coalesce((select string_agg(k, ', ') from jsonb_object_keys(audit) k), 'ingen rad')),
      ('Gallring en fil som en kvarvarande ansökan pekar ut står inte i listan', filer3 = '{}', coalesce(array_to_string(filer3, ', '), 'ingen rad')),
      ('Gallring och spärrar inte den andra ansökan', u3 = 'borttagen' and delad = 1, u3 || ', filen: ' || delad),
      ('Gallring en godkänd ansökan tas inte bort före sin tid, ens på begäran', u4 = 'inte_forfallen', u4),
      ('Gallring ett okänt id', u5 = 'finns_inte', u5);
  end if;
end $$;

-- Filer utan ansökan: ett år från uppladdningen, bara i hinken cv.
do $$
declare
  lista text[]; fel text;
begin
  begin
    insert into storage.objects (bucket_id, name, created_at) values
      ('cv', '1500000000000-gprov-Foraldralos.pdf', now() - interval '2 years'),
      ('cv', '1500000000001-gprov-Ung.pdf', now() - interval '11 months'),
      ('cv', '1500000000002-gprov-Pekad.pdf', now() - interval '2 years'),
      ('dokument', '00000000-0000-4000-8000-00000000ce01/1500000000003-gprov-Annan.pdf', now() - interval '2 years');
    insert into public.applications (id, name, email, why)
    values ('00000000-0000-4000-8000-00000000ce02', 'Prov Pekar', 'rls-gorf@example.invalid',
            E'Hej.\n\nCV: cv/1500000000002-gprov-Pekad.pdf');

    select array_agg(f.namn) into lista from public.cv_foraldralosa(1000) f where f.namn like '%gprov%';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;

  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Gallring filer utan ansökan', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('Gallring en fil utan ansökan gallras ett år efter uppladdningen',
        lista = array['1500000000000-gprov-Foraldralos.pdf'], coalesce(array_to_string(lista, ', '), 'inga'));
  end if;
end $$;

-- Väckningen och vakten. Adressen pekar på en domän som inte finns, och
-- anropet köas i samma deltransaktion som rullas tillbaka: pg_net
-- skickar bara det som checkats in.
do $$
declare
  svar jsonb; svar2 jsonb; oppna bigint; fel text;
begin
  begin
    update public.notis_konfig set gallring_url = 'https://example.invalid/functions/v1/ansokan-gallring' where id = 1;
    insert into public.applications (id, name, email, status, created_at)
    values ('00000000-0000-4000-8000-00000000cf01', 'Prov Fastnad', 'rls-gfast@example.invalid',
            'rejected', now() - interval '3 years');

    svar := intern.ansokan_gallring_vack();
    svar2 := intern.ansokan_gallring_vack();
    select count(*) into oppna from public.uppgifter
     where nyckel = 'gallring:ansokan:fastnat' and status = 'oppen';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;

  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Gallring väckningen', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('Gallring något att gallra väcker funktionen',
        (svar ->> 'ansokningar')::int >= 1 and svar ->> 'begaran' is not null, svar::text),
      ('Gallring det som borde varit borta för en vecka sedan blir en uppgift, en gång',
        (svar2 ->> 'fastnade')::int >= 1 and oppna = 1, 'öppna: ' || oppna || ', ' || svar2::text);
  end if;
end $$;

-- Vem som når dörrarna: bara service_role. Admin ingår inte, för
-- admin tar inte bort ansökningar för hand här heller.
select pg_temp.prova('Gallring anon når inte listan', null,
  array['select * from public.ansokan_gallring_lista()'], 'nekad');
select pg_temp.prova('Gallring inte en inloggad familj heller', '00000000-0000-4000-8000-0000000000f1',
  array['select * from public.ansokan_gallring_lista()'], 'nekad');
select pg_temp.prova('Gallring inte admin heller', '00000000-0000-4000-8000-0000000000ad',
  array['select * from public.ansokan_gallring_lista()'], 'nekad');
select pg_temp.prova('Gallring anon når inte filerna utan ansökan', null,
  array['select * from public.cv_foraldralosa()'], 'nekad');
-- En förfallen ansökan finns, så att noll betyder "får inte", inte
-- "finns inget att ta bort".
select pg_temp.prova_med('Gallring admin kan inte gallra en ansökan',
  array[$q$insert into public.applications (id, name, email, status, created_at)
           values ('00000000-0000-4000-8000-00000000cf02', 'Prov Admin', 'rls-gadm@example.invalid',
                   'rejected', now() - interval '2 years')$q$],
  '00000000-0000-4000-8000-0000000000ad',
  array[$q$select public.ansokan_gallra('00000000-0000-4000-8000-00000000cf02')$q$], 'nekad');
select pg_temp.prova_med('Gallring och ingen tar bort en ansökan direkt, inte admin heller',
  array[$q$insert into public.applications (id, name, email, status, created_at)
           values ('00000000-0000-4000-8000-00000000cf02', 'Prov Admin', 'rls-gadm@example.invalid',
                   'rejected', now() - interval '2 years')$q$],
  '00000000-0000-4000-8000-0000000000ad',
  array[$q$delete from public.applications where id = '00000000-0000-4000-8000-00000000cf02'$q$], 'nekad');

do $$
declare n bigint; fel text;
begin
  begin
    perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
    execute 'set local role service_role';
    select count(*) into n from public.ansokan_gallring_lista();
    select count(*) into n from public.cv_foraldralosa();
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', null, true);
  insert into utfall (test, ok, detalj)
  values ('Gallring service_role når dörrarna', fel = 'rulla tillbaka', fel);
end $$;

-- AI-texterna och de avslutade uppgifterna (2026-09-28). Motiveringen
-- töms 90 dagar efter beslutet, klara uppgifter tas bort efter ett år,
-- och frysningen släpper bara igenom just den tömningen, utan inloggad
-- användare.
do $$
declare
  fel text; v jsonb;
  m1 text; m2 text; n1 bigint; n2 bigint; n3 bigint;
  skriva text; inloggad text;
  f1 constant uuid := '00000000-0000-4000-8000-00000000ce01';
  f2 constant uuid := '00000000-0000-4000-8000-00000000ce02';
  u1 constant uuid := '00000000-0000-4000-8000-00000000cf01';
  u2 constant uuid := '00000000-0000-4000-8000-00000000cf02';
  u3 constant uuid := '00000000-0000-4000-8000-00000000cf03';
begin
  begin
    insert into public.ai_forslag (id, typ, payload, motivering, status, nyckel, beslutad, skapad) values
      (f1, 'lead_status', '{}', 'Gammal motivering', 'avvisad', 'rls:ai:gammal', now() - interval '100 days', now() - interval '101 days'),
      (f2, 'lead_status', '{}', 'Ny motivering',     'avvisad', 'rls:ai:ny',     now() - interval '10 days',  now() - interval '11 days');
    -- uppgift_stampel sätter klar_at vid skrivning; stängs av för att
    -- kunna backdatera.
    alter table public.uppgifter disable trigger user;
    insert into public.uppgifter (id, typ, titel, status, klar_at, uppdaterad, created_at, skapad_av_typ) values
      (u1, 'ovrigt', 'Prov klar gammal', 'klar', now() - interval '2 years', now() - interval '2 years', now() - interval '2 years', 'manniska'),
      (u2, 'ovrigt', 'Prov klar ny',     'klar', now() - interval '1 month', now() - interval '1 month', now() - interval '2 years', 'manniska'),
      (u3, 'ovrigt', 'Prov öppen gammal', 'oppen', null, now() - interval '2 years', now() - interval '2 years', 'manniska');
    alter table public.uppgifter enable trigger user;

    v := intern.ai_och_uppgifter_gallra();
    select motivering into m1 from public.ai_forslag where id = f1;
    select motivering into m2 from public.ai_forslag where id = f2;
    select count(*) into n1 from public.uppgifter where id = u1;
    select count(*) into n2 from public.uppgifter where id = u2;
    select count(*) into n3 from public.uppgifter where id = u3;

    begin
      update public.ai_forslag set motivering = 'Utbytt' where id = f2;
      skriva := 'tillåten';
    exception when others then skriva := 'nekad';
    end;
    begin
      perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
      update public.ai_forslag set motivering = null where id = f2;
      inloggad := 'tillåten';
    exception when others then inloggad := 'nekad';
    end;
    reset role;
    perform set_config('request.jwt.claims', null, true);
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', null, true);

  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('AI-gallring', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('AI-gallring motiveringen töms 90 dagar efter beslutet', m1 is null, coalesce(m1, 'tömd')),
      ('AI-gallring men inte före', m2 = 'Ny motivering', coalesce(m2, 'tömd')),
      ('AI-gallring frysningen nekar fortfarande en ny motivering', skriva = 'nekad', skriva),
      ('AI-gallring och en inloggad får inte tömma den', inloggad = 'nekad', inloggad),
      ('Uppgiftsgallring en klar uppgift äldre än ett år tas bort', n1 = 0, 'rader: ' || n1),
      ('Uppgiftsgallring en nyss klar står kvar', n2 = 1, 'rader: ' || n2),
      ('Uppgiftsgallring en öppen rörs aldrig', n3 = 1, 'rader: ' || n3);
  end if;
end $$;

-- ------------------------------------------------------------
-- Fas 23.1: de digitala uppgifterna
--
-- Allt i ett block som rullas tillbaka, så att nivån, frågorna och
-- försöken aldrig syns för något prov efter det. Utfallet samlas i en
-- variabel (de överlever återrullningen) och skrivs efteråt.
--
-- Rättningen görs i databasen och prövas här: frågorna lämnas ut utan
-- facit, familjen skriver inget resultat själv, en digital uppgift
-- bockas inte av för hand, och bara familjen, elevens studiehjälpare
-- och admin läser försöken. Och den rättning som felade en gång:
-- facit "5y" lästes som talet 5 med enheten y, så "5" och "5x"
-- rättades som rätt.
-- ------------------------------------------------------------
do $$
declare
  ut     jsonb := '[]'::jsonb;
  fel    text;
  r      jsonb;
  forsok uuid;
  n      int;
  st     text;
  P    constant uuid := '00000000-0000-4000-8000-0000000000f1';
  Q    constant uuid := '00000000-0000-4000-8000-0000000000f2';
  A    constant uuid := '00000000-0000-4000-8000-0000000000a1';
  B    constant uuid := '00000000-0000-4000-8000-0000000000b1';
  ADM  constant uuid := '00000000-0000-4000-8000-0000000000ad';
  ELEV constant uuid := '00000000-0000-4000-8000-0000000005a1';
  NIVA constant uuid := '00000000-0000-4000-8000-00000000c2a1';
  F1   constant uuid := '00000000-0000-4000-8000-00000000c2b1';
  F2   constant uuid := '00000000-0000-4000-8000-00000000c2b2';
  F3   constant uuid := '00000000-0000-4000-8000-00000000c2b3';
  F4   constant uuid := '00000000-0000-4000-8000-00000000c2b4';
  F5   constant uuid := '00000000-0000-4000-8000-00000000c2b5';
  HD   constant uuid := '00000000-0000-4000-8000-00000000c2c1';
  HV   constant uuid := '00000000-0000-4000-8000-00000000c2c2';
begin
  begin
    -- Fixturen, som postgres.
    insert into public.nivaer (id, nyckel, amne, arskurs, omrade, titel, ordning)
    values (NIVA, 'rls-prov-niva', 'Matematik', 'ak8', 'Algebra', 'RLS-nivå', 1);
    insert into public.niva_fragor (id, niva_id, ordning, typ, fraga, alternativ, ratt, forklaring) values
      (F1, NIVA, 1, 'val',   'Vilket är störst?', '["1/2","1/3","1/4"]', '0', 'Halva är mest.'),
      (F2, NIVA, 2, 'skriv', 'Vad är 1 000 + 250?', null, '["1250"]', null),
      (F3, NIVA, 3, 'skriv', 'Förenkla 7y − 2y.', null, '["5y"]', null),
      (F4, NIVA, 4, 'ordna', 'Bygg meningen.', '["hund"]', '["Jag","har","en","katt"]', null),
      (F5, NIVA, 5, 'skriv', 'Skriv en halv som decimaltal.', null, '["0,5"]', null);
    insert into public.homework (id, student_id, tutor_id, title, niva_id) values
      (HD, ELEV, A, 'RLS digital uppgift', NIVA),
      (HV, ELEV, A, 'RLS vanlig uppgift', null);

    select antal_fragor into n from public.nivaer where id = NIVA;
    ut := ut || jsonb_build_object('t', 'UPG antal_fragor räknas av triggern', 'ok', n = 5, 'd', n::text);

    ut := ut || jsonb_build_object('t', 'UPG rättning: 1 250 är 1250', 'ok', intern.niva_lika('1250', '1 250'), 'd', null)
             || jsonb_build_object('t', 'UPG rättning: 0.50 är 0,5', 'ok', intern.niva_lika('0,5', '0.50'), 'd', null)
             || jsonb_build_object('t', 'UPG rättning: Went. är went', 'ok', intern.niva_lika('went', ' Went. '), 'd', null)
             || jsonb_build_object('t', 'UPG rättning: 12 cm är 12', 'ok', intern.niva_lika('12', '12 cm'), 'd', null)
             || jsonb_build_object('t', 'UPG rättning: −3 är -3', 'ok', intern.niva_lika('-3', '−3'), 'd', null)
             || jsonb_build_object('t', 'UPG rättning: 5 är inte 5y', 'ok', not intern.niva_lika('5y', '5'), 'd', null)
             || jsonb_build_object('t', 'UPG rättning: 5x är inte 5y', 'ok', not intern.niva_lika('5y', '5x'), 'd', null)
             || jsonb_build_object('t', 'UPG rättning: 3/4 är inte 0,75', 'ok', not intern.niva_lika('3/4', '0,75'), 'd', null)
             || jsonb_build_object('t', 'UPG rättning: tomt är fel', 'ok', not intern.niva_lika('12', '  '), 'd', null);

    -- Fel familj och anon startar inte.
    begin
      perform pg_temp.bli(Q);
      r := public.niva_starta(NIVA, ELEV);
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    reset role;
    ut := ut || jsonb_build_object('t', 'UPG annan familj startar inte nivån åt barnet', 'ok', fel = '42501', 'd', fel);
    begin
      perform pg_temp.bli(null);
      r := public.niva_starta(NIVA, ELEV);
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    reset role;
    ut := ut || jsonb_build_object('t', 'UPG anon startar inte', 'ok', fel = '42501', 'd', fel);

    perform pg_temp.bli(P);
    r := public.niva_starta(NIVA, ELEV);
    forsok := (r ->> 'forsok')::uuid;
    ut := ut || jsonb_build_object('t', 'UPG start: frågorna utan facit', 'ok',
                jsonb_array_length(r -> 'fragor') = 5 and position('"ratt"' in r::text) = 0
                and position('katt' in (r -> 'fragor' -> 3 ->> 'fraga')) = 0, 'd', left(r::text, 200))
             || jsonb_build_object('t', 'UPG start: brickorna med den extra', 'ok',
                jsonb_array_length(r -> 'fragor' -> 3 -> 'brickor') = 5, 'd', r -> 'fragor' -> 3 ->> 'brickor')
             || jsonb_build_object('t', 'UPG start: sifferknappar för ett tal, inte för 5y', 'ok',
                (r -> 'fragor' -> 1 ->> 'numerisk')::boolean and not (r -> 'fragor' -> 2 ->> 'numerisk')::boolean,
                'd', (r -> 'fragor' -> 1 ->> 'numerisk') || '/' || (r -> 'fragor' -> 2 ->> 'numerisk'));
    select status into st from public.homework where id = HD;
    ut := ut || jsonb_build_object('t', 'UPG start: den digitala uppgiften blir påbörjad', 'ok', st = 'pagaende', 'd', st);
    r := public.niva_starta(NIVA, ELEV);
    ut := ut || jsonb_build_object('t', 'UPG start igen fortsätter samma försök', 'ok', (r ->> 'forsok')::uuid = forsok, 'd', r ->> 'forsok');

    select count(*) into n from public.niva_fragor;
    ut := ut || jsonb_build_object('t', 'UPG familjen läser inga frågor med facit', 'ok', n = 0, 'd', n::text);

    begin
      insert into public.niva_forsok (niva_id, student_id, fragor, klar_at, antal, ratt_direkt, stjarnor, godkand)
      values (NIVA, ELEV, array[F1], now(), 1, 1, 3, true);
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'UPG familjen skriver inget eget resultat', 'ok', fel = '42501', 'd', fel);
    begin
      update public.niva_forsok set stjarnor = 3 where id = forsok;
      get diagnostics n = row_count;
      fel := 'rader ' || n;
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'UPG familjen skriver inte om ett försök', 'ok', fel in ('42501', 'rader 0'), 'd', fel);
    begin
      insert into public.niva_svar (forsok_id, fraga_id, svar, ratt, forsta) values (forsok, F1, '{"val":0}', true, true);
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'UPG familjen skriver inget eget svar', 'ok', fel = '42501', 'd', fel);

    begin
      update public.homework set status = 'klar' where id = HD;
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'UPG familjen bockar inte av en digital uppgift', 'ok', fel = '42501', 'd', fel);
    update public.homework set status = 'klar' where id = HV;
    get diagnostics n = row_count;
    ut := ut || jsonb_build_object('t', 'UPG familjen bockar av en vanlig uppgift', 'ok', n = 1, 'd', n::text);
    -- Luckan som stängdes: bibliotek_id gick att skriva om, och läxan gav
    -- då läsrätt till materialet. e3 är studiehjälpare A:s eget.
    update public.homework set bibliotek_id = '00000000-0000-4000-8000-0000000000e3', niva_id = null where id = HV;
    select coalesce(bibliotek_id::text, 'null') || '/' || coalesce(niva_id::text, 'null') into st
      from public.homework where id = HV;
    ut := ut || jsonb_build_object('t', 'UPG familjen pekar inte om uppgiften till annat material', 'ok', st = 'null/null', 'd', st);
    select count(*) into n from public.biblioteksmaterial where id = '00000000-0000-4000-8000-0000000000e3';
    ut := ut || jsonb_build_object('t', 'UPG och når därför inte A:s eget material', 'ok', n = 0, 'd', n::text);

    -- Svaren. Fråga 1 fel och sedan rätt, fråga 3 med "5" (fel) och sedan 5y.
    r := public.niva_svara(forsok, F1, '{"val":2}');
    ut := ut || jsonb_build_object('t', 'UPG fel svar ger facit och förklaring', 'ok',
                not (r ->> 'ratt')::boolean and (r ->> 'facit')::int = 0 and r ->> 'forklaring' = 'Halva är mest.', 'd', r::text);
    r := public.niva_svara(forsok, F1, '{"val":0}');
    r := public.niva_svara(forsok, F1, '{"val":0}');
    select count(*) into n from public.niva_svar where forsok_id = forsok;
    ut := ut || jsonb_build_object('t', 'UPG ett dubbeltryck ger ingen ny rad', 'ok', n = 2, 'd', n::text);
    r := public.niva_svara(forsok, F2, '{"text":"1 250"}');
    ut := ut || jsonb_build_object('t', 'UPG skriv: tal med mellanslag rättas som tal', 'ok', (r ->> 'ratt')::boolean, 'd', r::text);
    r := public.niva_svara(forsok, F3, '{"text":"5"}');
    ut := ut || jsonb_build_object('t', 'UPG skriv: 5 är fel när facit är 5y', 'ok', not (r ->> 'ratt')::boolean, 'd', r::text);
    r := public.niva_svara(forsok, F3, '{"text":"5Y"}');
    r := public.niva_svara(forsok, F4, '"skräp"');
    ut := ut || jsonb_build_object('t', 'UPG ett trasigt svar är fel, inte ett fel', 'ok', not (r ->> 'ratt')::boolean, 'd', r::text);
    r := public.niva_svara(forsok, F4, '{"ordning":["Jag","har","en","katt"]}');
    begin
      r := public.niva_svara(forsok, '00000000-0000-4000-8000-00000000c2b9', '{"val":0}');
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'UPG en fråga utanför nivån nekas', 'ok', fel = '22023', 'd', fel);
    -- Fel först på fråga 1, 3 och 4: 2 av 5 rätt direkt, 40 procent.
    -- Nivån blir klar (allt är till slut rätt besvarat) men inte klarad.
    r := public.niva_svara(forsok, F5, '{"text":"0.5"}');
    ut := ut || jsonb_build_object('t', 'UPG sista rätta svaret avslutar nivån: 2 av 5 direkt = 0 stjärnor, inte klarad', 'ok',
                (r ->> 'klar')::boolean and (r -> 'resultat' ->> 'stjarnor')::int = 0
                and (r -> 'resultat' ->> 'ratt_direkt')::int = 2 and not (r -> 'resultat' ->> 'godkand')::boolean, 'd', r ->> 'resultat');
    select status into st from public.homework where id = HD;
    ut := ut || jsonb_build_object('t', 'UPG under 60 procent gör inte uppgiften klar', 'ok', st = 'pagaende', 'd', st);
    r := public.niva_genomgang(forsok);
    ut := ut || jsonb_build_object('t', 'UPG genomgången: varje fråga, med alla svar', 'ok',
                jsonb_array_length(r -> 'fragor') = 5 and jsonb_array_length(r -> 'fragor' -> 0 -> 'svar') = 2, 'd', left(r::text, 120));

    -- Ett nytt försök med allt rätt direkt: tre stjärnor, och uppgiften blir klar.
    r := public.niva_starta(NIVA, ELEV);
    forsok := (r ->> 'forsok')::uuid;
    perform public.niva_svara(forsok, F1, '{"val":0}');
    perform public.niva_svara(forsok, F2, '{"text":"1250"}');
    perform public.niva_svara(forsok, F3, '{"text":"5y"}');
    perform public.niva_svara(forsok, F4, '{"ordning":["Jag","har","en","katt"]}');
    r := public.niva_svara(forsok, F5, '{"text":",5"}');
    ut := ut || jsonb_build_object('t', 'UPG allt rätt direkt = 3 stjärnor, och förut 0', 'ok',
                (r -> 'resultat' ->> 'stjarnor')::int = 3 and (r -> 'resultat' ->> 'forut')::int = 0
                and (r -> 'resultat' ->> 'godkand')::boolean, 'd', r ->> 'resultat');
    select status into st from public.homework where id = HD;
    ut := ut || jsonb_build_object('t', 'UPG en klarad nivå gör den digitala uppgiften klar', 'ok', st = 'klar', 'd', st);

    -- Exakt 60 procent (3 av 5) ger en stjärna. Förut är nu tre.
    r := public.niva_starta(NIVA, ELEV);
    forsok := (r ->> 'forsok')::uuid;
    perform public.niva_svara(forsok, F1, '{"val":1}');
    perform public.niva_svara(forsok, F1, '{"val":0}');
    perform public.niva_svara(forsok, F2, '{"text":"125"}');
    perform public.niva_svara(forsok, F2, '{"text":"1250"}');
    perform public.niva_svara(forsok, F3, '{"text":"5y"}');
    perform public.niva_svara(forsok, F4, '{"ordning":["Jag","har","en","katt"]}');
    r := public.niva_svara(forsok, F5, '{"text":"0,5"}');
    ut := ut || jsonb_build_object('t', 'UPG 3 av 5 direkt (60 procent) = 1 stjärna, och förut 3', 'ok',
                (r -> 'resultat' ->> 'stjarnor')::int = 1 and (r -> 'resultat' ->> 'forut')::int = 3
                and (r -> 'resultat' ->> 'godkand')::boolean, 'd', r ->> 'resultat');
    reset role;

    -- Vem läser försöken.
    perform pg_temp.bli(Q);
    select count(*) into n from public.niva_forsok where niva_id = NIVA;
    ut := ut || jsonb_build_object('t', 'UPG annan familj ser inga försök', 'ok', n = 0, 'd', n::text);
    select count(*) into n from public.niva_svar s join public.niva_forsok f on f.id = s.forsok_id where f.niva_id = NIVA;
    ut := ut || jsonb_build_object('t', 'UPG annan familj ser inga svar', 'ok', n = 0, 'd', n::text);
    begin
      r := public.niva_genomgang(forsok);
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'UPG annan familj får ingen genomgång', 'ok', fel = '42501', 'd', fel);
    reset role;
    perform pg_temp.bli(A);
    select count(*) into n from public.niva_forsok where niva_id = NIVA;
    ut := ut || jsonb_build_object('t', 'UPG elevens studiehjälpare ser försöken', 'ok', n = 3, 'd', n::text);
    select count(*) into n from public.niva_fragor where niva_id = NIVA;
    ut := ut || jsonb_build_object('t', 'UPG godkänd studiehjälpare läser frågorna med facit', 'ok', n = 5, 'd', n::text);
    r := public.niva_genomgang(forsok);
    ut := ut || jsonb_build_object('t', 'UPG elevens studiehjälpare får genomgången', 'ok', r ? 'fragor', 'd', null);
    begin
      r := public.niva_starta(NIVA, ELEV);
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'UPG studiehjälparen startar inte nivån åt eleven', 'ok', fel = '42501', 'd', fel);
    reset role;
    perform pg_temp.bli(B);
    select count(*) into n from public.niva_forsok where niva_id = NIVA;
    ut := ut || jsonb_build_object('t', 'UPG en annan studiehjälpare ser inga försök', 'ok', n = 0, 'd', n::text);
    reset role;
    perform pg_temp.bli(ADM);
    select count(*) into n from public.niva_forsok where niva_id = NIVA;
    ut := ut || jsonb_build_object('t', 'UPG admin ser försöken', 'ok', n = 3, 'd', n::text);
    reset role;
    perform pg_temp.bli(null);
    begin
      select count(*) into n from public.nivaer;
      fel := 'rader ' || n;
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'UPG anon läser inga nivåer', 'ok', fel in ('42501', 'rader 0'), 'd', fel);
    reset role;

    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', null, true);

  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('UPG Fas 23.1', false, fel);
  else
    insert into utfall (test, ok, detalj)
    select x ->> 't', (x ->> 'ok')::boolean, x ->> 'd' from jsonb_array_elements(ut) x;
  end if;
end $$;

-- Fas 23.1: banken rättas som den står. Varje godtaget svar på varje
-- aktiv fråga ska rättas som rätt av databasens egen rättning, och
-- sifferknappsatsen ska bara visas när varje godtaget svar går att
-- skriva med den. Ett fel här är en fråga som barnet inte kan klara,
-- och det syns inte i någon vy: det ser ut som att barnet svarade fel.
-- Innan banken är inläst finns inga rader, och proven går igenom.
--
-- I ett block, och bara när tabellen finns: är Fas 23.1 inte körd
-- blir det en röd rad som säger det. Stod satserna fritt hade de
-- avbrutit hela filen, och en svit som inte går att köra provar
-- ingenting.
do $$
begin
  if to_regclass('public.niva_fragor') is null then
    insert into utfall (test, ok, detalj)
    values ('UPG banken', false, 'Fas 23.1 är inte körd: niva_fragor finns inte');
    return;
  end if;

  insert into utfall (test, ok, detalj)
  select 'UPG banken: varje godtaget skrivsvar rättas rätt', count(*) = 0,
         coalesce(string_agg(q.id::text || ' "' || a || '"', ', '), 'inga')
    from public.niva_fragor q, jsonb_array_elements_text(q.ratt) a
   where q.aktiv and q.typ = 'skriv' and not intern.niva_ratta(q, jsonb_build_object('text', a));

  insert into utfall (test, ok, detalj)
  select 'UPG banken: rätt alternativ rättas rätt, och inget annat', count(*) = 0,
         coalesce(string_agg(q.id::text || ' ' || i, ', '), 'inga')
    from public.niva_fragor q, generate_series(0, jsonb_array_length(q.alternativ) - 1) i
   where q.aktiv and q.typ = 'val'
     and intern.niva_ratta(q, jsonb_build_object('val', i)) <> (i = (q.ratt #>> '{}')::int);

  insert into utfall (test, ok, detalj)
  select 'UPG banken: rätt ordning rättas rätt, omvänd fel', count(*) = 0,
         coalesce(string_agg(q.id::text, ', '), 'inga')
    from public.niva_fragor q
   where q.aktiv and q.typ = 'ordna'
     and (not intern.niva_ratta(q, jsonb_build_object('ordning', q.ratt))
          or intern.niva_ratta(q, jsonb_build_object('ordning',
               (select jsonb_agg(x order by n desc) from jsonb_array_elements(q.ratt) with ordinality y(x, n)))));

  insert into utfall (test, ok, detalj)
  select 'UPG banken: sifferknappar bara när varje svar är siffror', count(*) = 0,
         coalesce(string_agg(q.id::text, ', '), 'inga')
    from public.niva_fragor q
   where q.aktiv and q.typ = 'skriv' and (intern.niva_fraga_ut(q) ->> 'numerisk')::boolean
     and exists (select 1 from jsonb_array_elements_text(q.ratt) a where a !~ '^[0-9 ,.%]+$');
end $$;

select test, ok is true as ok, detalj from utfall order by nr;

rollback;
