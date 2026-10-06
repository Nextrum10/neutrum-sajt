-- ============================================================
-- NEXTRUM — behörighetstester (Fas 1, 2, 5, 6, 7, 8, 9, 14, 16, 18, 19, 20, 21, 22, 23, gallringen, månadskörningen, schemat, raderingen, de delade dokumenten, taken för det anonyma, chatten som admin öppnar, svaret på en föreslagen tid, tipskoderna, barnkontona, adminbehörigheterna, påminnelserna till admin, vårdnadshavaren och nejet i ansökan, det admin sett, barnets chatt och barnets behörigheter)
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
-- när förslaget skickas), manadskorningen_vacks_av_databasen,
-- manadskorningen_gar_den_forsta, Fas 23.1 (de digitala uppgifterna),
-- personer_redigeras_och_raderas, dokument_delas_med_personen,
-- schemalagda_korningar_syns, manadskorningens_svar_blir_en_uppgift,
-- manadskorningens_svar_lases_den_forsta, anonyma_skrivningar_far_tak,
-- Fas 23.2 (NexLäx, fas23_2_nexlax, med sin bank), admin_oppnar_chatten,
-- avbokningar_och_svar, tipskoder_och_kampanjkoder,
-- barnkonton_och_admin, manadskorningen_gar_varje_natt, admin_paminnelser,
-- ansokan_vardnadshavare_och_nej, admin_sett, nexlax_uppdrag_och_np,
-- nexlax_felrapporter, barnets_chatt och barnets_behorigheter är körda.
--
-- Lokalt: verktyg/lokal-databas.sh bygger databasen i Docker och kör
-- hela filen mot den.
-- Körs filen före dem är det väntat att de berörda raderna faller —
-- det är så man ser att testerna faktiskt mäter något.
-- ============================================================

begin;

-- Månader som stängts i bokföringen på riktigt öppnas, bara i den här
-- transaktionen. Fixturerna lägger pass i förra månaden och längre
-- bak, och en stängd månad nekar varje skrivning där (Fas 20.2): när
-- september stängdes 2026-10-03 föll "14.6 familjen väljer faktura på
-- ett genomfört obetalt pass" med 42501, fast inget i fakturan ändrats.
-- Proven för själva låset stänger sina egna månader.
update public.manadsbokslut set stangd = false where stangd;

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
-- Samma för mejlen till admin (avsnitt 16): triggern admin_ansokan_direkt köar ett mejl för varje ansökan,
-- också de som läggs in i avsnitten här ovanför.
update public.notis_konfig set admin_paminnelse_url = null where id = 1;

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

-- ---------- dokumentet delas med personen (dokument_delas_med_personen) ----------
-- Leo 2026-09-29: ett anställningsavtal eller ett avtal med en familj
-- ska personen själv kunna läsa, under Profil & inställningar →
-- Dokument. Admin väljer personen. Personen når aldrig tabellen, bara
-- mina_handlingar() och exakt den fil raden pekar ut; en annan fil i
-- samma mapp är inte hens. Allt byggs i en deltransaktion som rullas
-- tillbaka, så att handlingarna inte står kvar för proven längre ned.
do $$
declare
  adm  constant uuid := '00000000-0000-4000-8000-0000000000ad';
  a    constant uuid := '00000000-0000-4000-8000-0000000000a1';
  b    constant uuid := '00000000-0000-4000-8000-0000000000b1';
  p    constant uuid := '00000000-0000-4000-8000-0000000000f1';
  q    constant uuid := '00000000-0000-4000-8000-0000000000f2';
  h1   constant uuid := '00000000-0000-4000-8000-00000000d0d1';
  h2   constant uuid := '00000000-0000-4000-8000-00000000d0d2';
  h3   constant uuid := '00000000-0000-4000-8000-00000000d0d3';
  f1   constant text := '00000000-0000-4000-8000-00000000d0d1/1500000000001-avtal.pdf';
  f1b  constant text := '00000000-0000-4000-8000-00000000d0d1/1500000000002-annat.pdf';
  f2   constant text := '00000000-0000-4000-8000-00000000d0d2/1500000000003-kundavtal.pdf';
  fel text; kod text;
  a_lista uuid[]; a_filer text[]; a_tabell bigint; a_andra bigint; a_flytta bigint; a_upp text;
  b_lista bigint; b_filer bigint; q_lista bigint; q_filer bigint;
  p_fore bigint; p_filer_fore bigint; p_lista uuid[]; p_filer text[];
  utan_person text; versaler text; kvar_p jsonb; n_audit bigint;
begin
  if to_regprocedure('public.mina_handlingar()') is null then
    insert into utfall (test, ok, detalj)
    values ('Dokument delas: migrationen dokument_delas_med_personen är körd', false,
            'mina_handlingar() finns inte');
    return;
  end if;

  begin
    insert into public.handlingar (id, typ, titel, fil, mimetyp, kopplad_tabell, kopplad_id,
                                   delad_med_personen, uppladdad_av)
    values (h1, 'avtal', 'Provanställning A', f1, 'application/pdf', 'profiles', a::text, true, adm),
           (h2, 'avtal', 'Kundavtal P', f2, 'application/pdf', 'profiles', p::text, false, adm),
           -- Uppladdningen pågår: raden finns, filen inte än.
           (h3, 'avtal', 'Halvfärdigt P', null, null, 'profiles', p::text, true, adm);
    insert into storage.objects (bucket_id, name, owner) values
      ('dokument', f1, adm), ('dokument', f1b, adm), ('dokument', f2, adm);

    -- Studiehjälparen A: sitt avtal, bara den fil raden pekar ut, och
    -- inget att skriva.
    perform pg_temp.bli(a);
    select array_agg(x.id) into a_lista from public.mina_handlingar() x;
    select array_agg(o.name order by o.name) into a_filer
      from storage.objects o where o.bucket_id = 'dokument';
    select count(*) into a_tabell from public.handlingar;
    update public.handlingar set delad_med_personen = false where id = h1;
    get diagnostics a_andra = row_count;
    update storage.objects set name = f1b where bucket_id = 'dokument' and name = f1;
    get diagnostics a_flytta = row_count;
    begin
      insert into storage.objects (bucket_id, name, owner)
      values ('dokument', '00000000-0000-4000-8000-00000000d0d1/1500000000009-eget.pdf', a);
      a_upp := 'gick igenom';
    exception when others then a_upp := sqlstate;
    end;
    reset role;
    perform set_config('request.jwt.claims', '', true);

    -- Studiehjälparen B och familj Q har inget delat med sig.
    perform pg_temp.bli(b);
    select count(*) into b_lista from public.mina_handlingar();
    select count(*) into b_filer from storage.objects where bucket_id = 'dokument';
    reset role;
    perform set_config('request.jwt.claims', '', true);
    perform pg_temp.bli(q);
    select count(*) into q_lista from public.mina_handlingar();
    select count(*) into q_filer from storage.objects where bucket_id = 'dokument';
    reset role;
    perform set_config('request.jwt.claims', '', true);

    -- Familj P: kundavtalet är inte delat än, och den halvfärdiga
    -- handlingen har ingen fil.
    perform pg_temp.bli(p);
    select count(*) into p_fore from public.mina_handlingar();
    select count(*) into p_filer_fore from storage.objects where bucket_id = 'dokument';
    reset role;
    perform set_config('request.jwt.claims', '', true);

    -- Admin delar kundavtalet. Delningen står i auditloggen.
    perform pg_temp.bli(adm);
    update public.handlingar set delad_med_personen = true where id = h2;
    kvar_p := public.radering_lage('familj', p) -> 'star_kvar';
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select count(*) into n_audit from public.audit_logg
     where tabell = 'handlingar' and objekt_id = h2::text and aktor = adm
       and (efter ->> 'delad_med_personen')::boolean;

    perform pg_temp.bli(p);
    select array_agg(x.id) into p_lista from public.mina_handlingar() x;
    select array_agg(o.name) into p_filer from storage.objects o where o.bucket_id = 'dokument';
    reset role;
    perform set_config('request.jwt.claims', '', true);

    -- Villkoren: en delning utan person, och ett id med versaler som
    -- auth.uid() aldrig skriver.
    begin
      update public.handlingar set kopplad_tabell = null, kopplad_id = null where id = h1;
      utan_person := 'gick igenom';
    exception when others then utan_person := sqlstate;
    end;
    begin
      update public.handlingar set kopplad_id = upper(a::text) where id = h1;
      versaler := 'gick igenom';
    exception when others then versaler := sqlstate;
    end;

    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm; kod := sqlstate;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Dokument delas', false, coalesce(kod, '') || ' ' || fel);
    return;
  end if;

  insert into utfall (test, ok, detalj) values
    ('Dokument delas: studiehjälparen ser sitt avtal', a_lista = array[h1], coalesce(a_lista::text, 'inget')),
    ('Dokument delas: studiehjälparen läser bara filen raden pekar ut',
      a_filer = array[f1], coalesce(a_filer::text, 'ingen fil')),
    ('Dokument delas: studiehjälparen läser fortfarande inte tabellen', a_tabell = 0, 'rader: ' || a_tabell),
    ('Dokument delas: studiehjälparen ändrar inte delningen', a_andra = 0, 'rader: ' || a_andra),
    ('Dokument delas: studiehjälparen flyttar inte filen', a_flytta = 0, 'rader: ' || a_flytta),
    ('Dokument delas: studiehjälparen laddar inte upp i mappen', a_upp = '42501', a_upp),
    ('Dokument delas: en annan studiehjälpare ser ingenting', b_lista = 0 and b_filer = 0,
      'lista ' || b_lista || ', filer ' || b_filer),
    ('Dokument delas: en annan familj ser ingenting', q_lista = 0 and q_filer = 0,
      'lista ' || q_lista || ', filer ' || q_filer),
    ('Dokument delas: ett odelat avtal syns inte för familjen', p_fore = 0 and p_filer_fore = 0,
      'lista ' || p_fore || ', filer ' || p_filer_fore),
    ('Dokument delas: familjen ser avtalet när admin delat det, och en rad utan fil står inte med',
      p_lista = array[h2] and p_filer = array[f2],
      coalesce(p_lista::text, 'inget') || ' ' || coalesce(p_filer::text, 'ingen fil')),
    ('Dokument delas: delningen står i auditloggen', n_audit = 1, 'rader: ' || n_audit),
    ('Dokument delas: raderingsrutan räknar familjens handlingar',
      (kvar_p ->> 'handlingar')::int = 2, coalesce(kvar_p::text, 'null')),
    ('Dokument delas: nekas utan person', utan_person = '23514', utan_person),
    ('Dokument delas: nekas med ett id som auth.uid() aldrig skriver', versaler = '23514', versaler);
end $$;

select pg_temp.prova('Dokument delas: anon når inte mina_handlingar', null,
  array[$q$select * from public.mina_handlingar()$q$], 'nekad');

insert into utfall (test, ok, detalj)
select 'Dokument delas: mina_handlingar lämnar inte ut anteckningen',
       coalesce(pg_get_function_result(f) not like '%anteckning%', false),
       coalesce(pg_get_function_result(f), 'funktionen finns inte')
  from (select to_regprocedure('public.mina_handlingar()') f) x;

insert into utfall (test, ok, detalj)
select 'Dokument delas: hinkens hjälpare nås av inloggade, inte av anon',
       coalesce(f is not null and has_function_privilege('authenticated', f, 'execute')
                and not has_function_privilege('anon', f, 'execute'), false),
       coalesce(f::text, 'intern.handling_delad_med_mig finns inte')
  from (select to_regprocedure('intern.handling_delad_med_mig(text)') f) x;

-- ---------- avtalet klistras in som text (avtal_som_text) ----------
-- Leo 2026-10-05: ett avtal ska kunna klistras in och lagras hos oss
-- och hos familjen, med vilket namn som helst. En handling är en fil
-- eller en text. Texten ändras aldrig, inte ens av admin; personen
-- läser den bara genom min_handling_text(), bara sin egen och bara när
-- den är delad; och den står aldrig i auditloggen. Deltransaktion som
-- rullas tillbaka, som avsnittet ovan.
do $$
declare
  adm  constant uuid := '00000000-0000-4000-8000-0000000000ad';
  a    constant uuid := '00000000-0000-4000-8000-0000000000a1';
  p    constant uuid := '00000000-0000-4000-8000-0000000000f1';
  q    constant uuid := '00000000-0000-4000-8000-0000000000f2';
  t1   constant uuid := '00000000-0000-4000-8000-00000000d0e1';
  t2   constant uuid := '00000000-0000-4000-8000-00000000d0e2';
  t3   constant uuid := '00000000-0000-4000-8000-00000000d0e3';
  avtal constant text := E'Avtal mellan Nextrum och familjen P\n\n1. Priset är 379 kr per timme.\n';
  fel text; kod text;
  titel_andrad bigint; text_andrad text; bada text; tom text;
  p_lista uuid[]; p_text text; p_odelad text; p_annans text; p_tabell bigint;
  q_text text; a_text text; a_andrar bigint; n_audit bigint; n_audit_text bigint;
begin
  if to_regprocedure('public.min_handling_text(uuid)') is null then
    insert into utfall (test, ok, detalj)
    values ('Avtal som text: migrationen avtal_som_text är körd', false,
            'min_handling_text() finns inte');
    return;
  end if;

  begin
    -- Admin klistrar in tre texter: en delad med familj P, en P inte
    -- ser än, och en delad med studiehjälpare A. Titeln är fri.
    perform pg_temp.bli(adm);
    insert into public.handlingar (id, typ, titel, innehall, kopplad_tabell, kopplad_id,
                                   delad_med_personen, uppladdad_av)
    values (t1, 'avtal', 'Vad som helst – familjen P, höst 2026 ✓', avtal, 'profiles', p::text, true, adm),
           (t2, 'avtal', 'Utkast', 'Inte delat än', 'profiles', p::text, false, adm),
           (t3, 'ovrigt', 'Studiehjälpare A', 'Avtalet med A', 'profiles', a::text, true, adm);
    update public.handlingar set titel = 'Ett annat namn' where id = t1;
    get diagnostics titel_andrad = row_count;
    begin
      update public.handlingar set innehall = avtal || 'Och en rad till.' where id = t1;
      text_andrad := 'gick igenom';
    exception when others then text_andrad := sqlstate;
    end;
    begin
      insert into public.handlingar (typ, titel, fil, innehall)
      values ('avtal', 'Båda', '00000000-0000-4000-8000-00000000d0e9/1-x.pdf', 'text');
      bada := 'gick igenom';
    exception when others then bada := sqlstate;
    end;
    begin
      insert into public.handlingar (typ, titel, innehall) values ('avtal', 'Tom', E'  \n\t ');
      tom := 'gick igenom';
    exception when others then tom := sqlstate;
    end;
    reset role;
    perform set_config('request.jwt.claims', '', true);

    -- Familj P: sin delade text i listan och att läsa, inte den odelade
    -- och inte A:s.
    perform pg_temp.bli(p);
    select array_agg(x.id) into p_lista from public.mina_handlingar() x;
    p_text := public.min_handling_text(t1);
    p_odelad := public.min_handling_text(t2);
    p_annans := public.min_handling_text(t3);
    select count(*) into p_tabell from public.handlingar;
    reset role;
    perform set_config('request.jwt.claims', '', true);

    perform pg_temp.bli(q);
    q_text := public.min_handling_text(t1);
    reset role;
    perform set_config('request.jwt.claims', '', true);

    -- Studiehjälpare A läser sitt, och ändrar inget.
    perform pg_temp.bli(a);
    a_text := public.min_handling_text(t3);
    update public.handlingar set titel = 'A byter namn' where id = t3;
    get diagnostics a_andrar = row_count;
    reset role;
    perform set_config('request.jwt.claims', '', true);

    select count(*) into n_audit from public.audit_logg
     where tabell = 'handlingar' and objekt_id = t1::text;
    select count(*) into n_audit_text from public.audit_logg
     where tabell = 'handlingar' and objekt_id in (t1::text, t2::text, t3::text)
       and (coalesce(fore::text, '') || coalesce(efter::text, '')) ~ '(innehall|379 kr|Inte delat|Avtalet med A)';

    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm; kod := sqlstate;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Avtal som text', false, coalesce(kod, '') || ' ' || fel);
    return;
  end if;

  insert into utfall (test, ok, detalj) values
    ('Avtal som text: familjen har texten i sin lista, inte den odelade',
      p_lista = array[t1], coalesce(p_lista::text, 'inget')),
    ('Avtal som text: familjen läser texten precis som den klistrades in',
      p_text is not distinct from avtal, coalesce(left(p_text, 40), 'null')),
    ('Avtal som text: en odelad text läses inte', p_odelad is null, coalesce(p_odelad, 'null')),
    ('Avtal som text: någon annans text läses inte',
      p_annans is null and q_text is null, coalesce(p_annans, 'null') || ' / ' || coalesce(q_text, 'null')),
    ('Avtal som text: familjen läser fortfarande inte tabellen', p_tabell = 0, 'rader: ' || p_tabell),
    ('Avtal som text: studiehjälparen läser sin', a_text is not distinct from 'Avtalet med A',
      coalesce(a_text, 'null')),
    ('Avtal som text: studiehjälparen ändrar ingenting', a_andrar = 0, 'rader: ' || a_andrar),
    ('Avtal som text: titeln går att byta', titel_andrad = 1, 'rader: ' || titel_andrad),
    ('Avtal som text: texten ändras inte, inte ens av admin', text_andrad = '23514', text_andrad),
    ('Avtal som text: en fil och en text på samma handling nekas', bada = '23514', bada),
    ('Avtal som text: en tom text nekas', tom = '23514', tom),
    ('Avtal som text: auditloggen har handlingen men aldrig texten',
      n_audit >= 1 and n_audit_text = 0, 'rader ' || n_audit || ', med text ' || n_audit_text);
end $$;

select pg_temp.prova('Avtal som text: anon når inte min_handling_text', null,
  array[$q$select public.min_handling_text('00000000-0000-4000-8000-00000000d0e1')$q$], 'nekad');

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
                             duration_min, status, fakturerbar, fakturerbar_anledning, location) values
  ('00000000-0000-4000-8000-00000000b202', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
   '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1',
   (date_trunc('month', now() at time zone 'Europe/Stockholm') - interval '6 months')::date + 9, '15:00', 60,
   'completed', false, 'rlsprov', 'Provgatan 3');
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

    -- 6b. Raderingen (personer_redigeras_och_raderas) tömmer platsen och
    --     raden till studiehjälparen också i en stängd månad. Bara
    --     tömningen går igenom: en ny adress, eller tömningen tillsammans
    --     med något annat, är fortfarande en ändring av passet.
    begin
      update public.bookings set location = 'Annan gata' where id = '00000000-0000-4000-8000-00000000b202';
      steg := 'gick igenom';
    exception when others then steg := sqlstate;
    end;
    resultat := resultat || ('ny adress|' || (steg = '42501')::text || '|' || steg);
    begin
      update public.bookings set location = null, subject = 'Kemi' where id = '00000000-0000-4000-8000-00000000b202';
      steg := 'gick igenom';
    exception when others then steg := sqlstate;
    end;
    resultat := resultat || ('tömd och ändrad|' || (steg = '42501')::text || '|' || steg);
    begin
      update public.bookings set location = null, note = null where id = '00000000-0000-4000-8000-00000000b202';
      steg := 'gick igenom';
    exception when others then steg := sqlerrm;
    end;
    resultat := resultat || ('tömd|' || (steg = 'gick igenom')::text || '|' || steg);

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
           when 'ny adress' then 'admin skriver ingen ny adress på ett pass i en stängd månad'
           when 'tömd och ändrad' then 'raderingens tömning släpper inte igenom andra ändringar'
           when 'tömd'     then 'platsen och raden till studiehjälparen töms i en stängd månad'
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
    -- Sedan 2026-09-30 säger studiehjälparen varför (avbokningar_och_svar).
    perform pg_temp.bli(a);
    update public.bookings set status = 'cancelled', svar_meddelande = 'Den tiden har jag träning.' where id = f2;
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
-- Sökvägen har den form NX.kopplaAnsökan bygger: tid, högst sex tecken
-- slump och filnamnet (anonyma_skrivningar_far_tak). Filen ovan läggs
-- in som postgres och prövas inte mot policyn.
select pg_temp.prova('CV anon laddar fortfarande upp', null,
  array[$q$insert into storage.objects (bucket_id, name)
           values ('cv', '1700000000001-rlspro-Nytt_CV.pdf')$q$], 'ok');

insert into utfall (test, ok, detalj)
select 'CV hinken cv är privat', not b.public, 'public = ' || b.public
from storage.buckets b where b.id = 'cv';

-- ------------------------------------------------------------
-- Det anonyma har tak (anonyma_skrivningar_far_tak)
--
-- Fyra vägar in tog emot vad som helst: länken i biblioteket,
-- klientfel, kontaktformuläret och hinken cv. Taken räknar hela
-- tabellen, också det driften fått den senaste minuten eller timmen,
-- så proven räknar det först och fyller upp till taket i stället för
-- att räkna med en tom tabell. En fil i en hink går dessutom inte att
-- ta bort med SQL. Varje prov rullas tillbaka för sig.
-- ------------------------------------------------------------

-- En länk är en webbadress. Studiehjälparen lägger sitt eget material,
-- och familjen öppnar länken med window.open: förut var det bara CSP:n
-- som stoppade en javascript:-adress.
do $$
declare js text; mellanslag text; andrad text; versaler text;
begin
  begin
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000a1');
    insert into public.biblioteksmaterial (titel, amne, arskurs, lank, delad, skapad_av)
    values ('RLS javascript', 'Svenska', 'ak5', 'javascript:alert(1)', false,
            '00000000-0000-4000-8000-0000000000a1');
    raise exception using errcode = 'P0001', message = 'gick igenom';
  exception when others then js := sqlstate;
  end;
  begin
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000a1');
    insert into public.biblioteksmaterial (titel, amne, arskurs, lank, delad, skapad_av)
    values ('RLS mellanslag', 'Svenska', 'ak5', 'https://exempel.invalid/a b', false,
            '00000000-0000-4000-8000-0000000000a1');
    raise exception using errcode = 'P0001', message = 'gick igenom';
  exception when others then mellanslag := sqlstate;
  end;
  begin
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000a1');
    update public.biblioteksmaterial set lank = 'javascript:alert(1)'
     where id = '00000000-0000-4000-8000-0000000000e3';
    raise exception using errcode = 'P0001', message = 'gick igenom';
  exception when others then andrad := sqlstate;
  end;
  begin
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000a1');
    insert into public.biblioteksmaterial (titel, amne, arskurs, lank, delad, skapad_av)
    values ('RLS versaler', 'Svenska', 'ak5', 'HTTPS://Exempel.invalid/Blad', false,
            '00000000-0000-4000-8000-0000000000a1');
    raise exception using errcode = 'P0001', message = 'gick igenom';
  exception when others then versaler := case when sqlerrm = 'gick igenom' then 'gick igenom' else sqlstate end;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into utfall (test, ok, detalj) values
    ('Taken: en javascript:-länk nekas i biblioteket', js = '23514', 'sqlstate ' || coalesce(js, 'inget')),
    ('Taken: en länk med mellanslag nekas', mellanslag = '23514', 'sqlstate ' || coalesce(mellanslag, 'inget')),
    ('Taken: en länk går inte att ändra till javascript:', andrad = '23514', 'sqlstate ' || coalesce(andrad, 'inget')),
    ('Taken: en https-adress går in, också i versaler', versaler = 'gick igenom', coalesce(versaler, 'inget'));
end $$;

-- klientfel kapas till samma längder som nextrum-fel.js skickar, och
-- tiden är databasens. Över sextio rader på en minut tas raden tyst
-- bort: felrapporteringen ska aldrig själv ge ett fel.
do $$
declare
  b bigint; n bigint; i int; fel text;
  lm int; ls int; lst int; lw int; tid timestamptz;
begin
  begin
    select count(*) into b from public.klientfel where created_at > now() - interval '1 minute';
    perform pg_temp.bli(null);
    insert into public.klientfel (meddelande, sida, stack, webblasare, created_at)
    values ('rls-tak-langd ' || repeat('m', 900), repeat('s', 400), repeat('t', 3000), repeat('w', 400),
            now() - interval '3 days');
    for i in 1 .. 60 loop
      insert into public.klientfel (meddelande, sida) values ('rls-tak-flod ' || i, '/');
    end loop;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select length(meddelande), length(sida), length(stack), length(webblasare), created_at
      into lm, ls, lst, lw, tid
      from public.klientfel where meddelande like 'rls-tak-langd %';
    select count(*) into n from public.klientfel where meddelande like 'rls-tak-flod %';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Taken: klientfel', false, fel);
  else
    -- Raden med de långa fälten är en av sextio, så floden får plats
    -- med 59 minus det som redan fanns.
    insert into utfall (test, ok, detalj) values
      ('Taken: klientfel kapas till samma längder som nextrum-fel.js',
       lm = 500 and ls = 300 and lst = 2000 and lw = 300,
       format('%s, %s, %s, %s', lm, ls, lst, lw)),
      ('Taken: klientfel får databasens tid, inte den som postar', tid = now(), coalesce(tid::text, 'ingen rad')),
      ('Taken: över sextio klientfel på en minut tas tyst bort', n = 59 - b,
       format('%s av 60 kom in, %s fanns redan', n, b));
  end if;
end $$;

-- Kontaktformuläret: fälten har en längd, och formuläret nekas med ett
-- besked över tre meddelanden i timmen från samma adress eller trettio
-- totalt. Adressen jämförs som den levereras (intern.epost_nyckel), och
-- tiden är databasens: annars går bromsen runt med en bakdaterad rad.
do $$
declare
  b bigint; i int; fel text;
  lang text; n_samma bigint; tid timestamptz; fjarde text; fjarde_text text;
  n_flod bigint; trettiofirsta text;
begin
  begin
    perform pg_temp.bli(null);
    insert into public.contact_messages (name, email, message)
    values ('RLS Tak', 'rls-tak-lang@example.invalid', repeat('x', 5001));
    raise exception using errcode = 'P0001', message = 'gick igenom';
  exception when others then lang := sqlstate;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  begin
    perform pg_temp.bli(null);
    insert into public.contact_messages (name, email, message, created_at)
    values ('RLS Tak', 'rls-tak@example.invalid', 'Ett', now() - interval '2 days');
    insert into public.contact_messages (name, email, message)
    values ('RLS Tak', 'RLS-Tak+tva@example.invalid', 'Två');
    insert into public.contact_messages (name, email, message)
    values ('RLS Tak', ' rls-tak+tre@Example.invalid ', 'Tre');
    begin
      insert into public.contact_messages (name, email, message)
      values ('RLS Tak', 'rls-tak+fyra@example.invalid', 'Fyra');
      fjarde := 'gick igenom';
    exception when others then fjarde := sqlstate; fjarde_text := sqlerrm;
    end;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select count(*), min(created_at) into n_samma, tid from public.contact_messages where name = 'RLS Tak';
    raise exception 'rulla tillbaka';
  exception when others then
    if sqlerrm <> 'rulla tillbaka' then fel := concat_ws('; ', fel, 'samma adress: ' || sqlerrm); end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  begin
    select count(*) into b from public.contact_messages where created_at > now() - interval '1 hour';
    perform pg_temp.bli(null);
    for i in 1 .. 30 - b loop
      insert into public.contact_messages (name, email, message)
      values ('RLS Flod', 'rls-flod-' || i || '@example.invalid', 'Hej');
    end loop;
    begin
      insert into public.contact_messages (name, email, message)
      values ('RLS Flod', 'rls-flod-sist@example.invalid', 'Hej');
      trettiofirsta := 'gick igenom';
    exception when others then trettiofirsta := sqlstate;
    end;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select count(*) into n_flod from public.contact_messages where name = 'RLS Flod';
    raise exception 'rulla tillbaka';
  exception when others then
    if sqlerrm <> 'rulla tillbaka' then fel := concat_ws('; ', fel, 'trettio: ' || sqlerrm); end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  insert into utfall (test, ok, detalj) values
    ('Taken: ett kontaktmeddelande över 5 000 tecken nekas', lang = '23514', 'sqlstate ' || coalesce(lang, 'inget')),
    ('Taken: tre meddelanden från samma adress går in, med databasens tid',
     fel is null and n_samma = 3 and tid = now(),
     coalesce(fel, format('%s rader, tidigast %s', n_samma, tid))),
    ('Taken: det fjärde från samma adress nekas med ett besked',
     fjarde = 'P0001' and fjarde_text like 'För många meddelanden%',
     coalesce(fjarde, 'inget') || ': ' || coalesce(fjarde_text, '')),
    ('Taken: över trettio meddelanden i timmen nekas',
     fel is null and trettiofirsta = 'P0001' and n_flod = 30 - b,
     coalesce(fel, format('%s kom in, %s fanns redan, den trettioförsta: %s', n_flod, b, trettiofirsta)));
end $$;

-- Hinken cv tar bara sökvägen formuläret bygger, och högst tjugo filer
-- i timmen. Filerna före taket läggs in som postgres, för anon får inte
-- läsa hinken tillbaka.
select pg_temp.prova('Taken: anon laddar inte upp ett CV under eget namn', null,
  array[$q$insert into storage.objects (bucket_id, name)
           values ('cv', 'Alva_Berg_CV.pdf')$q$], 'nekad');
select pg_temp.prova('Taken: anon laddar inte upp ett CV i en egen mapp', null,
  array[$q$insert into storage.objects (bucket_id, name)
           values ('cv', 'mapp/1700000000002-abc123-CV.pdf')$q$], 'nekad');

do $$
declare b bigint; i int; fel text; tjugonde text; tjugoforsta text;
begin
  begin
    select count(*) into b from storage.objects
     where bucket_id = 'cv' and created_at > now() - interval '1 hour';
    for i in 1 .. 19 - b loop
      insert into storage.objects (bucket_id, name)
      values ('cv', (1700000001000 + i)::text || '-rlstak-CV.pdf');
    end loop;
    perform pg_temp.bli(null);
    begin
      insert into storage.objects (bucket_id, name) values ('cv', '1700000002000-rlstak-Tjugonde.pdf');
      tjugonde := 'gick igenom';
    exception when others then tjugonde := sqlstate;
    end;
    begin
      insert into storage.objects (bucket_id, name) values ('cv', '1700000002001-rlstak-Over.pdf');
      tjugoforsta := 'gick igenom';
    exception when others then tjugoforsta := sqlstate;
    end;
    raise exception 'rulla tillbaka';
  exception when others then
    if sqlerrm <> 'rulla tillbaka' then fel := sqlerrm; end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into utfall (test, ok, detalj) values
    ('Taken: den tjugonde filen i timmen går in', fel is null and tjugonde = 'gick igenom',
     coalesce(fel, format('%s fanns redan, den tjugonde: %s', b, tjugonde))),
    ('Taken: den tjugoförsta nekas', fel is null and tjugoforsta = '42501',
     coalesce(fel, 'den tjugoförsta: ' || coalesce(tjugoforsta, 'inget')));
end $$;

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
--
-- Perioden är en månad ingen annan fixtur räknar fram. Den stod som
-- 2026-09-01, och 2026-10-01 blev det förra månaden: fakturan för Fas
-- 14.6 (förra månaden, samma familj) krockade med den, och hela
-- sviten var röd från midnatt.
-- ------------------------------------------------------------
do $$
declare
  fel text; kod text; n_admin int; n_familj int; o text;
begin
  begin
    insert into public.invoices (id, parent_id, period, status, belopp_ore)
    values ('00000000-0000-4000-8000-0000000019f6', '00000000-0000-4000-8000-0000000000f1', '2025-01-01', 'utkast', 37900);

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
-- Månadskörningen (2026-09-28): pg_cron väcker fakturering den 1:a,
-- som skriver förra månadens underlag, alltså studiehjälparnas
-- lönespecifikationer. Adressen pekar på en domän som inte finns, och
-- anropet köas i en deltransaktion som rullas tillbaka: pg_net skickar
-- bara det som checkats in.
-- ------------------------------------------------------------
do $$
declare
  svar jsonb; utan jsonb; mal text; hdr jsonb; kropp jsonb; oppna bigint; fel text;
begin
  begin
    update public.notis_konfig set fakturering_url = 'https://example.invalid/functions/v1/fakturering' where id = 1;
    svar := intern.manadskorning_vack(true);
    select l.mal into mal from intern.natanrop_logg l where l.id = (svar ->> 'begaran')::bigint;
    select q.headers, convert_from(q.body, 'utf8')::jsonb into hdr, kropp
      from net.http_request_queue q where q.id = (svar ->> 'begaran')::bigint;
    update public.notis_konfig set fakturering_url = null where id = 1;
    utan := intern.manadskorning_vack();
    select count(*) into oppna from public.uppgifter where nyckel = 'manadskorning:adress' and status = 'oppen';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;

  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Månadskörning väckningen', false, fel);
  else
    insert into utfall (test, ok, detalj) values
      ('Månadskörning väckningen går genom natanrop, med hemligheten',
        mal = 'fakturering' and hdr ? 'x-nextrum-notis', coalesce(mal, 'inget anrop')),
      ('Månadskörning torrkörningen säger det i anropet',
        (kropp ->> 'torrkorning')::boolean, coalesce(kropp::text, 'ingen kropp')),
      ('Månadskörning utan adress anropas inget, och det blir en uppgift',
        utan ->> 'begaran' is null and oppna = 1, 'öppna: ' || oppna || ', ' || utan::text);
  end if;
end $$;

select pg_temp.prova('Månadskörning anon kör inte schemat', null,
  array['select intern.manadskorning_vack()'], 'nekad');
select pg_temp.prova('Månadskörning inte en studiehjälpare heller', '00000000-0000-4000-8000-0000000000a1',
  array['select intern.manadskorning_vack(true)'], 'nekad');
-- Läget i adminvyn: admin ser om schemat är på, ingen annan.
select pg_temp.prova('Månadskörning admin ser om schemat är på', '00000000-0000-4000-8000-0000000000ad',
  array['select public.manadskorning_lage()'], 'ok');
select pg_temp.prova('Månadskörning en familj ser inte schemat', '00000000-0000-4000-8000-0000000000f1',
  array['select public.manadskorning_lage()'], 'nekad');
select pg_temp.prova('Månadskörning anon ser inte schemat', null,
  array['select public.manadskorning_lage()'], 'nekad');

-- Varje natt sedan manadskorningen_gar_varje_natt (2026-10-01): sent
-- rapporterade pass läggs till på sin månads utkast.
insert into utfall (test, ok, detalj)
select 'Månadskörning går varje natt', count(*) = 1,
       coalesce(string_agg(schedule || ' ' || command, '; '), 'inget jobb')
  from cron.job
 where jobname = 'manadskorning' and active and schedule = '17 4 * * *'
   and command = 'select intern.manadskorning_vack()';

-- ------------------------------------------------------------
-- Månadskörningens svar blir en uppgift (2026-09-29)
--
-- net._http_response glömmer svaren efter sex timmar, så en körning den
-- 1:a som gick fel syntes under System → Fel bara till förmiddagen.
-- intern.manadskorning_svar() läser svaret en halvtimme efter
-- körningen, och allt utom 200 blir en uppgift som står kvar tills
-- någon stänger den.
--
-- Anropen görs genom väckningen, som schemat gör dem, och flyttas en
-- halvtimme bakåt: i provet står klockan still hela transaktionen, och
-- ett anrop som inte har något svar än kan vara på väg. Svaren läggs in
-- för hand med anropets id, och kroppen får inte synas i uppgiften.
-- Varje fall rullas tillbaka för sig. Driftens egna anrop till
-- fakturering och uppgifter om månadskörningens svar flyttas undan
-- först, så att provet inte beror på vad driften råkar ha.
-- ------------------------------------------------------------
create function pg_temp.manadskorning_rent() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  delete from public.uppgifter where nyckel like 'manadskorning:svar:%';
  delete from intern.natanrop_logg where mal = 'fakturering';
  update public.notis_konfig set fakturering_url = 'https://example.invalid/functions/v1/fakturering' where id = 1;
end $$;

-- Ett anrop genom väckningen, p_alder gammalt, och ett svar med samma
-- id om p_svar. pg_net ser aldrig anropet: det rullas tillbaka.
create function pg_temp.manadskorning_anrop(p_alder interval, p_kod integer default null,
                                            p_svar boolean default true, p_tog_slut boolean default false,
                                            p_huvuden jsonb default '{}'::jsonb)
returns bigint language plpgsql as $$
declare b bigint;
begin
  b := (intern.manadskorning_vack() ->> 'begaran')::bigint;
  if b is null then
    raise exception 'väckningen anropade inget';
  end if;
  update intern.natanrop_logg set skapad = now() - p_alder where id = b;
  if p_svar then
    insert into net._http_response (id, status_code, timed_out, error_msg, content, created, headers)
    values (b, p_kod, p_tog_slut, case when p_tog_slut then 'Timeout of 60000 ms reached' end,
            '{"problem": ["utbetalning SVARSKROPPEN: duplicate key value"]}', now() - p_alder, p_huvuden);
  end if;
  return b;
end $$;

do $$
declare
  -- Månaden fakturering räknar för ett anrop för en halvtimme sedan,
  -- och för ett schema som inte anropade alls.
  period    text := to_char(date_trunc('month', (now() - interval '30 minutes') at time zone 'Europe/Stockholm')
                            - interval '1 month', 'YYYY-MM');
  period_nu text := to_char(date_trunc('month', now() at time zone 'Europe/Stockholm')
                            - interval '1 month', 'YYYY-MM');
  b bigint;
  r1 jsonb; r2 jsonb; r3 jsonb; u jsonb; kvar text; antal bigint;
  r_forst jsonb; r_klar jsonb; antal_klar bigint;
  ok200 jsonb; n200 bigint;
  tid jsonb; tid_titel text;
  inget jsonb; inget_titel text;
  grind jsonb; grind_u jsonb;
  vantar jsonb; n_vantar bigint;
  schemat jsonb; for_hand jsonb; n_schemat bigint;
  adress jsonb; n_adress bigint;
  fel text;
begin
  -- En 207: en uppgift, samma månad igen ger ingen ny, och den står
  -- kvar när pg_net tagit bort svaret och anropet blivit gammalt.
  begin
    perform pg_temp.manadskorning_rent();
    b := pg_temp.manadskorning_anrop(interval '30 minutes', 207);
    r1 := intern.manadskorning_svar(true);
    select to_jsonb(x) into u from public.uppgifter x where x.id = (r1 ->> 'uppgift')::uuid;
    r2 := intern.manadskorning_svar(true);
    delete from net._http_response where id = b;
    update intern.natanrop_logg set skapad = now() - interval '7 hours' where id = b;
    r3 := intern.manadskorning_svar();
    select x.status into kvar from public.uppgifter x where x.id = (r1 ->> 'uppgift')::uuid;
    select count(*) into antal from public.uppgifter where nyckel like 'manadskorning:svar:%';
    raise exception 'rulla tillbaka';
  exception when others then
    if sqlerrm <> 'rulla tillbaka' then fel := concat_ws('; ', fel, '207: ' || sqlerrm); end if;
  end;

  -- En stängd uppgift kommer inte tillbaka för samma månad: det är
  -- samma körning.
  begin
    perform pg_temp.manadskorning_rent();
    b := pg_temp.manadskorning_anrop(interval '30 minutes', 207);
    r_forst := intern.manadskorning_svar(true);
    update public.uppgifter set status = 'klar' where id = (r_forst ->> 'uppgift')::uuid;
    r_klar := intern.manadskorning_svar(true);
    select count(*) into antal_klar from public.uppgifter where nyckel like 'manadskorning:svar:%';
    raise exception 'rulla tillbaka';
  exception when others then
    if sqlerrm <> 'rulla tillbaka' then fel := concat_ws('; ', fel, 'klar: ' || sqlerrm); end if;
  end;

  begin
    perform pg_temp.manadskorning_rent();
    b := pg_temp.manadskorning_anrop(interval '30 minutes', 200);
    ok200 := intern.manadskorning_svar(true);
    select count(*) into n200 from public.uppgifter where nyckel like 'manadskorning:svar:%';
    raise exception 'rulla tillbaka';
  exception when others then
    if sqlerrm <> 'rulla tillbaka' then fel := concat_ws('; ', fel, '200: ' || sqlerrm); end if;
  end;

  begin
    perform pg_temp.manadskorning_rent();
    b := pg_temp.manadskorning_anrop(interval '30 minutes', null, true, true);
    tid := intern.manadskorning_svar(true);
    select x.titel into tid_titel from public.uppgifter x where x.id = (tid ->> 'uppgift')::uuid;
    raise exception 'rulla tillbaka';
  exception when others then
    if sqlerrm <> 'rulla tillbaka' then fel := concat_ws('; ', fel, 'tidsgräns: ' || sqlerrm); end if;
  end;

  begin
    perform pg_temp.manadskorning_rent();
    b := pg_temp.manadskorning_anrop(interval '30 minutes', null, false);
    inget := intern.manadskorning_svar(true);
    select x.titel into inget_titel from public.uppgifter x where x.id = (inget ->> 'uppgift')::uuid;
    raise exception 'rulla tillbaka';
  exception when others then
    if sqlerrm <> 'rulla tillbaka' then fel := concat_ws('; ', fel, 'inget svar: ' || sqlerrm); end if;
  end;

  -- 401 från Supabases grind, inte från funktionen: JWT-kravet är
  -- påslaget igen, och det är config.toml som ska lagas.
  begin
    perform pg_temp.manadskorning_rent();
    b := pg_temp.manadskorning_anrop(interval '30 minutes', 401, true, false,
                                     '{"sb-error-code": "UNAUTHORIZED_NO_AUTH_HEADER"}'::jsonb);
    grind := intern.manadskorning_svar(true);
    select to_jsonb(x) into grind_u from public.uppgifter x where x.id = (grind ->> 'uppgift')::uuid;
    raise exception 'rulla tillbaka';
  exception when others then
    if sqlerrm <> 'rulla tillbaka' then fel := concat_ws('; ', fel, 'grinden: ' || sqlerrm); end if;
  end;

  -- Ett anrop som nyss gjorts och inte har något svar kan vara på väg.
  begin
    perform pg_temp.manadskorning_rent();
    b := pg_temp.manadskorning_anrop(interval '0', null, false);
    vantar := intern.manadskorning_svar(true);
    select count(*) into n_vantar from public.uppgifter where nyckel like 'manadskorning:svar:%';
    raise exception 'rulla tillbaka';
  exception when others then
    if sqlerrm <> 'rulla tillbaka' then fel := concat_ws('; ', fel, 'väntar: ' || sqlerrm); end if;
  end;

  -- Inget anrop alls. Från schemat gick jobbet inte, eller föll före
  -- anropet. För hand finns det bara inget att läsa. Kräver att jobbet
  -- manadskorning finns och är på, som provet ovanför.
  begin
    perform pg_temp.manadskorning_rent();
    for_hand := intern.manadskorning_svar();
    schemat := intern.manadskorning_svar(true);
    select count(*) into n_schemat from public.uppgifter where nyckel = 'manadskorning:svar:' || period_nu;
    raise exception 'rulla tillbaka';
  exception when others then
    if sqlerrm <> 'rulla tillbaka' then fel := concat_ws('; ', fel, 'inget anrop: ' || sqlerrm); end if;
  end;

  -- Utan adress har väckningen gjort manadskorning:adress själv.
  begin
    perform pg_temp.manadskorning_rent();
    update public.notis_konfig set fakturering_url = null where id = 1;
    adress := intern.manadskorning_svar(true);
    select count(*) into n_adress from public.uppgifter where nyckel like 'manadskorning:svar:%';
    raise exception 'rulla tillbaka';
  exception when others then
    if sqlerrm <> 'rulla tillbaka' then fel := concat_ws('; ', fel, 'utan adress: ' || sqlerrm); end if;
  end;

  if fel is not null then
    insert into utfall (test, ok, detalj) values ('Månadskörningens svar', false, fel);
  end if;
  insert into utfall (test, ok, detalj) values
    ('Månadskörningens svar: en 207 från schemat blir en öppen uppgift för månaden',
     coalesce(r1 ->> 'lage' = 'delvis' and (r1 ->> 'ny')::boolean
              and u ->> 'nyckel' = 'manadskorning:svar:' || period and u ->> 'typ' = 'problem'
              and u ->> 'status' = 'oppen' and u ->> 'skapad_av_typ' = 'system'
              and (u ->> 'forfallodag')::date = (now() at time zone 'Europe/Stockholm')::date, false),
     coalesce(r1::text, 'inget svar') || ' ' || coalesce(u ->> 'titel', '')),
    ('Månadskörningens svar: uppgiften pekar på Ekonomi → Månadskörning först, utan svarskropp, id eller belopp',
     coalesce(position('Ekonomi → Månadskörning' in u ->> 'beskrivning')
                between 1 and 160 - char_length('Ekonomi → Månadskörning')
              and position('SVARSKROPPEN' in concat(u ->> 'titel', u ->> 'beskrivning')) = 0
              and concat(u ->> 'titel', u ->> 'beskrivning') !~* '[0-9a-f]{8}-[0-9a-f]{4}-'
              and concat(u ->> 'titel', u ->> 'beskrivning') !~* '\m(kr|kronor|öre)\M', false),
     coalesce(u ->> 'beskrivning', 'ingen uppgift')),
    ('Månadskörningens svar: samma månad igen ger ingen ny uppgift',
     coalesce(r2 ->> 'uppgift' = r1 ->> 'uppgift' and not (r2 ->> 'ny')::boolean, false),
     coalesce(r2::text, 'inget svar')),
    ('Månadskörningens svar: uppgiften står kvar när pg_net tagit bort svaret',
     coalesce(kvar = 'oppen' and antal = 1 and r3 ->> 'lage' = 'inget_anrop', false),
     coalesce(kvar, 'borta') || ', uppgifter: ' || coalesce(antal::text, '?') || ', ' || coalesce(r3::text, '')),
    ('Månadskörningens svar: en stängd uppgift kommer inte tillbaka för samma månad',
     coalesce(antal_klar = 1 and r_klar ->> 'uppgift' = r_forst ->> 'uppgift', false),
     'uppgifter: ' || coalesce(antal_klar::text, '?') || ', ' || coalesce(r_klar::text, '')),
    ('Månadskörningens svar: en 200 ger ingen uppgift',
     coalesce(ok200 ->> 'lage' = 'ok' and n200 = 0, false),
     coalesce(ok200::text, 'inget svar') || ', uppgifter: ' || coalesce(n200::text, '?')),
    ('Månadskörningens svar: tidsgränsen blir en uppgift',
     coalesce(tid ->> 'lage' = 'tidsgrans' and tid_titel like '%svarade inte i tid', false),
     coalesce(tid_titel, tid::text, 'inget svar')),
    ('Månadskörningens svar: ett anrop utan svar blir en uppgift',
     coalesce(inget ->> 'lage' = 'inget_svar' and inget_titel like '%fick inget svar', false),
     coalesce(inget_titel, inget::text, 'inget svar')),
    ('Månadskörningens svar: 401 från grinden pekar på config.toml',
     coalesce(grind ->> 'lage' = 'nekad' and grind_u ->> 'titel' like '%nekades (401)'
              and position('supabase/config.toml' in grind_u ->> 'beskrivning') > 0, false),
     coalesce(grind_u ->> 'beskrivning', grind::text, 'inget svar')),
    ('Månadskörningens svar: ett anrop som kan vara på väg väntar',
     coalesce(vantar ->> 'lage' = 'vantar' and n_vantar = 0, false),
     coalesce(vantar::text, 'inget svar') || ', uppgifter: ' || coalesce(n_vantar::text, '?')),
    ('Månadskörningens svar: schemat utan anrop blir en uppgift, för hand inte',
     coalesce(schemat ->> 'lage' = 'inget_anrop' and schemat ->> 'uppgift' is not null
              and for_hand ->> 'lage' = 'inget_anrop' and for_hand ->> 'uppgift' is null
              and n_schemat = 1, false),
     coalesce(schemat::text, 'inget svar') || ' / ' || coalesce(for_hand::text, 'inget svar')),
    ('Månadskörningens svar: utan adress ingen andra uppgift',
     coalesce(adress ->> 'lage' = 'ingen_adress' and n_adress = 0, false),
     coalesce(adress::text, 'inget svar'));
end $$;

select pg_temp.prova('Månadskörningens svar anon läser det inte', null,
  array['select intern.manadskorning_svar()'], 'nekad');
select pg_temp.prova('Månadskörningens svar inte admin heller, bara schemat', '00000000-0000-4000-8000-0000000000ad',
  array['select intern.manadskorning_svar(true)'], 'nekad');

-- En halvtimme efter körningen (17 4 * * *, provet ovanför). Funktionen
-- läser anrop från den senaste timmen, så de två schemana hör ihop.
insert into utfall (test, ok, detalj)
select 'Månadskörningens svar läses 04:47 varje natt', count(*) = 1,
       coalesce(string_agg(schedule || ' ' || command, '; '), 'inget jobb')
  from cron.job
 where jobname = 'manadskorning-svar' and active and schedule = '47 4 * * *'
   and command = 'select intern.manadskorning_svar(true)';

-- ------------------------------------------------------------
-- De schemalagda körningarna (2026-09-29)
--
-- driftkorningar() visar adminvyn varje pg_cron-jobb med sin senaste
-- körning. Bara admin når den: anon har ingen EXECUTE, och en inloggad
-- som inte är admin stoppas av vakten på första raden. Kommandot lämnas
-- aldrig ut, och av ett fel bara första raden, med hemligheten, e-post
-- och id:n utbytta.
--
-- Felet läggs in för hand med ett negativt runid, som pg_cron aldrig
-- ger, och en starttid efter allt annat, så att det är jobbets senaste
-- körning också om notis-minut hinner köra medan sviten går. Hemligheten
-- är provets egen och saknar siffror, så att det är utbytet av just
-- hemligheten som provas och inte regeln för långa nycklar. Driftens
-- egen hade hamnat i detaljen om provet föll.
-- ------------------------------------------------------------
select pg_temp.prova('Schemat en familj ser inte körningarna', '00000000-0000-4000-8000-0000000000f1',
  array['select * from public.driftkorningar(7)'], 'nekad');
select pg_temp.prova('Schemat en studiehjälpare ser inte körningarna', '00000000-0000-4000-8000-0000000000a1',
  array['select * from public.driftkorningar(7)'], 'nekad');
select pg_temp.prova('Schemat anon ser inte körningarna', null,
  array['select * from public.driftkorningar(7)'], 'nekad');

insert into utfall (test, ok, detalj)
select 'Schemat anon når inte funktionen, och ingen utifrån når felets tvätt',
       coalesce(not has_function_privilege('anon', to_regprocedure('public.driftkorningar(integer)'), 'execute')
            and has_function_privilege('authenticated', to_regprocedure('public.driftkorningar(integer)'), 'execute')
            and not has_function_privilege('anon', to_regprocedure('intern.driftsvar(text,text[])'), 'execute')
            and not has_function_privilege('authenticated', to_regprocedure('intern.driftsvar(text,text[])'), 'execute'),
            false),
       case when to_regprocedure('public.driftkorningar(integer)') is null then 'funktionen finns inte'
            else 'anon/authenticated' end;

insert into utfall (test, ok, detalj)
select 'Schemat lämnar aldrig ut kommandot',
       coalesce(pg_get_function_result(to_regprocedure('public.driftkorningar(integer)')) !~* 'command|kommando', false),
       coalesce(pg_get_function_result(to_regprocedure('public.driftkorningar(integer)')), 'funktionen finns inte');

do $$
declare
  adm   constant uuid := '00000000-0000-4000-8000-0000000000ad';
  prov  constant text := 'RLS-PROV-HEMLIGHET-UTAN-SIFFROR';
  ett bigint; namn text; jobben bigint; rader bigint; har_konfig boolean;
  st text; sv text; missl int; senaste_fel text; fel text;
begin
  select count(*) into jobben from cron.job;
  select j.jobid, coalesce(j.jobname, 'jobb ' || j.jobid) into ett, namn from cron.job j order by j.jobid limit 1;
  if ett is null then
    insert into utfall (test, ok, detalj) values ('Schemat', false, 'cron.job är tom: inget jobb att lägga felet på');
    return;
  end if;
  select exists (select 1 from public.notis_konfig where id = 1) into har_konfig;

  begin
    update public.notis_konfig set hemlighet = prov where id = 1;
    insert into cron.job_run_details (jobid, runid, job_pid, database, username, command, status,
                                      return_message, start_time, end_time)
    values (ett, -9101, 0, current_database(), 'postgres', 'select 1', 'failed',
            'ERROR:  prov med ' || prov || ' för anna.berg@example.se och 2b1c8e2e-5f0a-4c1e-9a33-0d6c5f1d2e3f'
              || E'\nDETAIL:  Failing row contains (Alva Berg).',
            now() + interval '1 hour', now() + interval '1 hour');

    perform pg_temp.bli(adm);
    select count(*) into rader from public.driftkorningar(7);
    select x.status, x.svar, x.misslyckade, x.fel into st, sv, missl, senaste_fel
      from public.driftkorningar(7) x where x.jobb = namn;
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Schemat', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('Schemat admin får en rad per jobb, också de som inte kört i veckan', rader = jobben,
      'rader: ' || rader || ', jobb i cron.job: ' || jobben),
    ('Schemat den misslyckade körningen är jobbets senaste, med svaret',
      st = 'failed' and sv is not null and missl >= 1 and senaste_fel = sv,
      coalesce(st, 'null') || ', misslyckade: ' || coalesce(missl::text, 'null')),
    ('Schemat svaret är första raden, utan hemligheten, e-posten eller id:t',
      sv is not null and length(sv) <= 200
        and position(prov in sv) = 0 and (not har_konfig or position('[hemlighet]' in sv) > 0)
        and position('anna.berg' in sv) = 0 and position('2b1c8e2e' in sv) = 0
        and position('Alva' in sv) = 0 and position('ERROR' in sv) = 0,
      coalesce(sv, 'null'));
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

-- ------------------------------------------------------------
-- Fas 23.2: NexLäx
--
-- Ett eget område i en egen bana (Matematik gy3, som banken inte har)
-- och en egen elev, så att banken och fixturrapporterna inte stör:
-- en rapport är en dag i serien. Allt i ett block som rullas tillbaka.
--
-- Prövar matchningen (villkoret, rättningen, att facit inte lämnas
-- ut), mästarprovet och repetitionen (frågorna dras ur områdets och
-- banans nivåer, aldrig ur en lästext), XP-reglerna (10 för val, 20
-- för skriv, ordna och para, EN gång per fråga, 50 för en nivå första
-- gången, 100 för ett område, och 100 står kvar när området får en ny
-- nivå), serien i dagar i svensk tid (ett pass med rapport räknas,
-- frånvaro gör det inte, och den bryts först efter en hel dag), och
-- vem som får läget: familjen, elevens studiehjälpare och admin.
-- ------------------------------------------------------------
do $$
declare
  ut     jsonb := '[]'::jsonb;
  fel    text;
  r      jsonb;
  l      jsonb;
  forsok uuid;
  n      int;
  st     text;
  P    constant uuid := '00000000-0000-4000-8000-0000000000f1';
  Q    constant uuid := '00000000-0000-4000-8000-0000000000f2';
  A    constant uuid := '00000000-0000-4000-8000-0000000000a1';
  B    constant uuid := '00000000-0000-4000-8000-0000000000b1';
  ADM  constant uuid := '00000000-0000-4000-8000-0000000000ad';
  ELEV constant uuid := '00000000-0000-4000-8000-00000000d2e1';
  N1   constant uuid := '00000000-0000-4000-8000-00000000d2a1';
  N2   constant uuid := '00000000-0000-4000-8000-00000000d2a2';
  NM   constant uuid := '00000000-0000-4000-8000-00000000d2a3';
  NR   constant uuid := '00000000-0000-4000-8000-00000000d2a4';
  NL   constant uuid := '00000000-0000-4000-8000-00000000d2a5';
  F1   constant uuid := '00000000-0000-4000-8000-00000000d2b1';
  F2   constant uuid := '00000000-0000-4000-8000-00000000d2b2';
  F3   constant uuid := '00000000-0000-4000-8000-00000000d2b3';
  F4   constant uuid := '00000000-0000-4000-8000-00000000d2b4';
  F5   constant uuid := '00000000-0000-4000-8000-00000000d2b5';
  F6   constant uuid := '00000000-0000-4000-8000-00000000d2b6';
  FL   constant uuid := '00000000-0000-4000-8000-00000000d2b7';
begin
  begin
    -- En egen elev hos familj P och studiehjälpare A: 05a1 har
    -- fixturrapporter i dag, och en rapport är en dag i serien.
    insert into public.students (id, parent_id, name, matched_tutor_id, match_status, created_at)
    values (ELEV, P, 'NexLäx-prov', A, 'matched', now());

    -- Ett eget område i en egen bana, så att banken inte stör.
    insert into public.nivaer (id, nyckel, amne, arskurs, omrade, titel, ordning, sort) values
      (N1, 'nx-prov-1', 'Matematik', 'gy3', 'Provområde', 'Nivå ett', 1, 'vanlig'),
      (N2, 'nx-prov-2', 'Matematik', 'gy3', 'Provområde', 'Nivå två', 2, 'vanlig'),
      (NM, 'nx-prov-m', 'Matematik', 'gy3', 'Provområde', 'Mästarprov', 3, 'mastare'),
      (NR, 'nx-prov-r', 'Matematik', 'gy3', 'Repetition', 'Repetition', 9, 'repetition');
    insert into public.nivaer (id, nyckel, amne, arskurs, omrade, titel, ordning, sort, lastext) values
      (NL, 'nx-prov-l', 'Matematik', 'gy3', 'Läsning', 'Läs och svara', 4, 'vanlig', 'Katten sov på mattan hela dagen.');
    insert into public.niva_fragor (id, niva_id, ordning, typ, fraga, alternativ, ratt, forklaring) values
      (F1, N1, 1, 'val',   'Vilket är störst?', '["1/2","1/3"]', '0', null),
      (F2, N1, 2, 'para',  'Para ihop.', null, '[["2·3","6"],["2+3","5"],["2−3","−1"]]', 'Räkna varje.'),
      (F3, N1, 3, 'skriv', 'Vad är 7·8?', null, '["56"]', null),
      (F4, N2, 1, 'val',   'Sant eller falskt: 0 är jämnt.', '["Sant","Falskt"]', '0', null),
      (F5, N2, 2, 'ordna', 'Minst först.', null, '["1","2","3"]', null),
      (F6, N2, 3, 'skriv', 'Vad är 10−4?', null, '["6"]', null),
      (FL, NL, 1, 'val',   'Var sov katten?', '["På mattan","I sängen"]', '0', null);

    -- Enheter med snedstreck rättas som talet, som "12 cm".
    ut := ut || jsonb_build_object('t', 'NX rättning: 15 km/h är 15', 'ok', intern.niva_lika('15', '15 km/h'), 'd', null)
             || jsonb_build_object('t', 'NX rättning: 9.8 N/kg är 9,8', 'ok', intern.niva_lika('9,8', '9.8 N/kg'), 'd', null)
             || jsonb_build_object('t', 'NX rättning: 20 cm2 och 60 dm^3 är talen', 'ok',
                intern.niva_lika('20', '20 cm2') and intern.niva_lika('60', '60 dm^3') and intern.niva_lika('20', '20 cm²'), 'd', null)
             || jsonb_build_object('t', 'NX rättning: 0,25 mol/dm3 och 2 m/s^2 är talen', 'ok',
                intern.niva_lika('0,25', '0,25 mol/dm3') and intern.niva_lika('2', '2 m/s^2') and intern.niva_lika('2', '2 m/s2'), 'd', null)
             || jsonb_build_object('t', 'NX rättning: 3x2 är inte 3', 'ok', not intern.niva_lika('3', '3x2'), 'd', null)
             || jsonb_build_object('t', 'NX rättning: 5 är fortfarande inte 5y', 'ok', not intern.niva_lika('5y', '5'), 'd', null)
             || jsonb_build_object('t', 'NX rättning: 3/4 är fortfarande inte 0,75', 'ok', not intern.niva_lika('0,75', '3/4'), 'd', null);

    -- Villkoret på matchningen.
    begin
      insert into public.niva_fragor (id, niva_id, ordning, typ, fraga, alternativ, ratt)
      values (gen_random_uuid(), N1, 9, 'para', 'Trasig.', null, '[["a","b","c"],["d","e"]]');
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'NX para: ett par med tre delar nekas', 'ok', fel = '23514', 'd', fel);
    begin
      insert into public.niva_fragor (id, niva_id, ordning, typ, fraga, alternativ, ratt)
      values (gen_random_uuid(), N1, 9, 'para', 'Trasig.', null, '[["a",""],["d","e"]]');
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'NX para: en tom sida nekas', 'ok', fel = '23514', 'd', fel);
    begin
      insert into public.niva_fragor (id, niva_id, ordning, typ, fraga, alternativ, ratt)
      values (gen_random_uuid(), N1, 9, 'para', 'Trasig.', null, '["a","b"]');
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'NX para: par som inte är par nekas', 'ok', fel = '23514', 'd', fel);
    begin
      update public.nivaer set lastext = 'Text.' where id = NM;
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'NX lästext bara på en vanlig nivå', 'ok', fel = '23514', 'd', fel);

    -- Rättningen av matchningen.
    ut := ut || jsonb_build_object('t', 'NX para: rätt i vänsterns ordning', 'ok',
                intern.niva_ratta((select x from public.niva_fragor x where x.id = F2), '{"par":["6","5","−1"]}'), 'd', null)
             || jsonb_build_object('t', 'NX para: två par bytta är fel', 'ok',
                not intern.niva_ratta((select x from public.niva_fragor x where x.id = F2), '{"par":["5","6","−1"]}'), 'd', null)
             || jsonb_build_object('t', 'NX para: för få par är fel', 'ok',
                not intern.niva_ratta((select x from public.niva_fragor x where x.id = F2), '{"par":["6","5"]}'), 'd', null)
             || jsonb_build_object('t', 'NX para: skräp är fel, inte ett fel', 'ok',
                not intern.niva_ratta((select x from public.niva_fragor x where x.id = F2), '"x"'), 'd', null);
    r := intern.niva_fraga_ut((select x from public.niva_fragor x where x.id = F2));
    ut := ut || jsonb_build_object('t', 'NX para ut: vänster i ordning, höger blandad, inget facit', 'ok',
                r -> 'vanster' = '["2·3","2+3","2−3"]'::jsonb and jsonb_array_length(r -> 'hoger') = 3
                and r -> 'hoger' <> '["6","5","−1"]'::jsonb and not (r ? 'ratt'), 'd', r::text);

    -- Repetitionen utan något gjort.
    perform pg_temp.bli(P);
    begin
      r := public.niva_starta(NR, ELEV);
      fel := 'gick';
    exception when others then fel := sqlstate || ' ' || sqlerrm;
    end;
    ut := ut || jsonb_build_object('t', 'NX repetition utan något gjort säger det', 'ok', fel like 'P0002%', 'd', fel);

    -- Mästarprovet: frågorna ur områdets två nivåer, inte ur lästexten.
    r := public.niva_starta(NM, ELEV);
    ut := ut || jsonb_build_object('t', 'NX mästarprovet drar områdets sex frågor', 'ok',
                jsonb_array_length(r -> 'fragor') = 6 and r -> 'niva' ->> 'sort' = 'mastare'
                and position('"ratt"' in r::text) = 0, 'd', left(r::text, 160));
    reset role;
    perform set_config('request.jwt.claims', null, true);
    delete from public.niva_forsok where niva_id = NM;

    -- Nivå ett: val rätt, para fel och sedan rätt, skriv rätt.
    perform pg_temp.bli(P);
    r := public.niva_starta(N1, ELEV);
    forsok := (r ->> 'forsok')::uuid;
    ut := ut || jsonb_build_object('t', 'NX start: sort och ingen lästext', 'ok',
                r -> 'niva' ->> 'sort' = 'vanlig' and (r -> 'niva' -> 'lastext') = 'null'::jsonb, 'd', r ->> 'niva');
    r := public.niva_svara(forsok, F1, '{"val":0}');
    ut := ut || jsonb_build_object('t', 'NX val rätt direkt ger 10 XP', 'ok', (r ->> 'xp')::int = 10, 'd', r::text);
    r := public.niva_svara(forsok, F1, '{"val":0}');
    ut := ut || jsonb_build_object('t', 'NX samma svar igen ger samma 10', 'ok', (r ->> 'xp')::int = 10, 'd', r::text);
    r := public.niva_svara(forsok, F2, '{"par":["5","6","−1"]}');
    ut := ut || jsonb_build_object('t', 'NX para fel ger 0 XP och facit', 'ok',
                (r ->> 'xp')::int = 0 and not (r ->> 'ratt')::boolean and r -> 'facit' = '[["2·3","6"],["2+3","5"],["2−3","−1"]]'::jsonb, 'd', r::text);
    r := public.niva_svara(forsok, F2, '{"par":["6","5","−1"]}');
    ut := ut || jsonb_build_object('t', 'NX para rätt andra gången ger 0 XP', 'ok',
                (r ->> 'xp')::int = 0 and (r ->> 'ratt')::boolean, 'd', r::text);
    r := public.niva_svara(forsok, F3, '{"text":"56"}');
    ut := ut || jsonb_build_object('t', 'NX skriv rätt direkt ger 20 XP', 'ok', (r ->> 'xp')::int = 20, 'd', r::text);
    ut := ut || jsonb_build_object('t', 'NX nivån klar: 2 av 3 = 1 stjärna, 30 + 50 XP, området inte klart', 'ok',
                (r ->> 'klar')::boolean and (r -> 'resultat' ->> 'stjarnor')::int = 1
                and (r -> 'resultat' ->> 'xp_fragor')::int = 30 and (r -> 'resultat' ->> 'xp_niva')::int = 50
                and (r -> 'resultat' ->> 'xp_omrade')::int = 0, 'd', r ->> 'resultat');

    -- Samma nivå igen, allt rätt direkt: bara paret ger nya XP, inga nivå-XP.
    r := public.niva_starta(N1, ELEV);
    forsok := (r ->> 'forsok')::uuid;
    perform public.niva_svara(forsok, F1, '{"val":0}');
    r := public.niva_svara(forsok, F2, '{"par":["6","5","−1"]}');
    ut := ut || jsonb_build_object('t', 'NX omgång två: den missade frågan ger sina 20 nu', 'ok', (r ->> 'xp')::int = 20, 'd', r::text);
    r := public.niva_svara(forsok, F3, '{"text":"56"}');
    ut := ut || jsonb_build_object('t', 'NX omgång två: 3 stjärnor, 20 XP frågor, 0 för nivån', 'ok',
                (r -> 'resultat' ->> 'stjarnor')::int = 3 and (r -> 'resultat' ->> 'xp_fragor')::int = 20
                and (r -> 'resultat' ->> 'xp_niva')::int = 0 and (r -> 'resultat' ->> 'forut')::int = 1, 'd', r ->> 'resultat');

    -- Nivå två klarar området.
    r := public.niva_starta(N2, ELEV);
    forsok := (r ->> 'forsok')::uuid;
    perform public.niva_svara(forsok, F4, '{"val":1}');
    perform public.niva_svara(forsok, F4, '{"val":0}');
    perform public.niva_svara(forsok, F5, '{"ordning":["1","2","3"]}');
    r := public.niva_svara(forsok, F6, '{"text":"6"}');
    ut := ut || jsonb_build_object('t', 'NX sista nivån i området: +50 och +100', 'ok',
                (r -> 'resultat' ->> 'godkand')::boolean and (r -> 'resultat' ->> 'xp_niva')::int = 50
                and (r -> 'resultat' ->> 'xp_omrade')::int = 100 and (r -> 'resultat' ->> 'xp_fragor')::int = 40, 'd', r ->> 'resultat');
    r := public.niva_svara(forsok, F6, '{"text":"6"}');
    ut := ut || jsonb_build_object('t', 'NX samma svar efter klar ger samma bonus', 'ok',
                (r -> 'resultat' ->> 'xp_omrade')::int = 100 and (r -> 'resultat' ->> 'xp_niva')::int = 50, 'd', r ->> 'resultat');

    -- Repetitionen: F4 (sant/falskt) missades senast första gången.
    r := public.niva_starta(NR, ELEV);
    ut := ut || jsonb_build_object('t', 'NX repetitionen tar den missade frågan och fyller på', 'ok',
                r -> 'fragor' @> jsonb_build_array(jsonb_build_object('id', F4))
                and jsonb_array_length(r -> 'fragor') = 6 and position(FL::text in r::text) = 0, 'd', left(r::text, 200));
    forsok := (r ->> 'forsok')::uuid;
    r := public.niva_svara(forsok, F4, '{"val":0}');
    ut := ut || jsonb_build_object('t', 'NX den missade frågan rätt i repetitionen ger 10', 'ok', (r ->> 'xp')::int = 10, 'd', r::text);

    -- Lästexten följer med.
    r := public.niva_starta(NL, ELEV);
    ut := ut || jsonb_build_object('t', 'NX lästexten lämnas ut med nivån', 'ok',
                r -> 'niva' ->> 'lastext' = 'Katten sov på mattan hela dagen.', 'd', r ->> 'niva');

    -- Läget.
    l := public.nexlax_lage(ELEV);
    -- XP: F1 10, F3 20, F2 20, F4 10, F5 20, F6 20 = 100; N1 50, N2 50 = 100; området 100. 300.
    ut := ut || jsonb_build_object('t', 'NX läget: 300 XP', 'ok', (l ->> 'xp')::int = 300, 'd', l::text)
             || jsonb_build_object('t', 'NX läget: allt i dag', 'ok', (l ->> 'xp_idag')::int = 300 and (l ->> 'xp_vecka')::int = 300, 'd', null)
             || jsonb_build_object('t', 'NX läget: serien är en dag, i dag', 'ok',
                (l -> 'serie' ->> 'nu')::int = 1 and (l -> 'serie' ->> 'idag')::boolean and (l -> 'serie' ->> 'basta')::int = 1, 'd', l ->> 'serie')
             || jsonb_build_object('t', 'NX läget: området klart', 'ok', jsonb_array_length(l -> 'omraden') = 1, 'd', l ->> 'omraden')
             || jsonb_build_object('t', 'NX läget: banan har 300', 'ok',
                l -> 'banor' @> '[{"amne":"Matematik","arskurs":"gy3","xp":300}]', 'd', l ->> 'banor')
             || jsonb_build_object('t', 'NX läget: nivå ett har 100 XP och 3 frågor direkt', 'ok',
                (l -> 'nivaer' -> N1::text ->> 'xp')::int = 100 and (l -> 'nivaer' -> N1::text ->> 'direkt')::int = 3, 'd', l ->> 'nivaer')
             || jsonb_build_object('t', 'NX läget: inget missat kvar', 'ok', jsonb_array_length(l -> 'missade') = 0, 'd', l ->> 'missade')
             || jsonb_build_object('t', 'NX läget: reglerna', 'ok',
                l -> 'regler' = '{"val":10,"svarare":20,"niva":50,"omrade":100}'::jsonb, 'd', l ->> 'regler');
    reset role;
    perform set_config('request.jwt.claims', null, true);

    -- En nivå läggs till i området efteråt: XP står kvar.
    -- created_at är klockan nu, inte transaktionens start: i en
    -- transaktion är now() starttiden, och den ligger före försöken.
    insert into public.nivaer (id, nyckel, amne, arskurs, omrade, titel, ordning, sort, created_at)
    values (gen_random_uuid(), 'nx-prov-ny', 'Matematik', 'gy3', 'Provområde', 'Ny nivå', 5, 'vanlig', clock_timestamp());
    perform pg_temp.bli(P);
    l := public.nexlax_lage(ELEV);
    ut := ut || jsonb_build_object('t', 'NX en ny nivå i området tar inte tillbaka 100 XP', 'ok', (l ->> 'xp')::int = 300, 'd', l ->> 'xp');
    reset role;
    perform set_config('request.jwt.claims', null, true);

    -- Serien över dagar: flytta försöken bakåt.
    update public.niva_forsok set klar_at = klar_at - interval '1 day' where niva_id = N1;
    update public.niva_forsok set klar_at = klar_at - interval '2 day' where niva_id = N2;
    delete from public.niva_forsok where niva_id in (NR, NL);
    insert into public.lesson_reports (student_id, tutor_id, raw_notes, lesson_date, narvaro)
    values (ELEV, A, 'NexLäx-prov', (now() at time zone 'Europe/Stockholm')::date - 3, 'narvarande'),
           (ELEV, A, 'NexLäx-prov', (now() at time zone 'Europe/Stockholm')::date - 5, 'franvarande');
    perform pg_temp.bli(P);
    l := public.nexlax_lage(ELEV);
    ut := ut || jsonb_build_object('t', 'NX serien: i går, i förrgår och passet dagen före = 3, inte i dag', 'ok',
                (l -> 'serie' ->> 'nu')::int = 3 and not (l -> 'serie' ->> 'idag')::boolean, 'd', l ->> 'serie');
    reset role;
    perform set_config('request.jwt.claims', null, true);
    update public.niva_forsok set klar_at = klar_at - interval '1 day' where niva_id = N1;
    perform pg_temp.bli(P);
    l := public.nexlax_lage(ELEV);
    ut := ut || jsonb_build_object('t', 'NX serien bryts efter en hel dag utan något', 'ok',
                (l -> 'serie' ->> 'nu')::int = 0 and (l -> 'serie' ->> 'basta')::int = 2, 'd', l ->> 'serie');
    reset role;
    perform set_config('request.jwt.claims', null, true);

    -- Vem får läget.
    perform pg_temp.bli(Q);
    begin l := public.nexlax_lage(ELEV); fel := 'gick'; exception when others then fel := sqlstate; end;
    reset role;
    perform set_config('request.jwt.claims', null, true);
    perform set_config('request.jwt.claims', null, true);
    ut := ut || jsonb_build_object('t', 'NX annan familj får inget läge', 'ok', fel = '42501', 'd', fel);
    perform pg_temp.bli(B);
    begin l := public.nexlax_lage(ELEV); fel := 'gick'; exception when others then fel := sqlstate; end;
    reset role;
    perform set_config('request.jwt.claims', null, true);
    perform set_config('request.jwt.claims', null, true);
    ut := ut || jsonb_build_object('t', 'NX annan studiehjälpare får inget läge', 'ok', fel = '42501', 'd', fel);
    perform pg_temp.bli(null);
    begin l := public.nexlax_lage(ELEV); fel := 'gick'; exception when others then fel := sqlstate; end;
    reset role;
    perform set_config('request.jwt.claims', null, true);
    perform set_config('request.jwt.claims', null, true);
    ut := ut || jsonb_build_object('t', 'NX anon får inget läge', 'ok', fel = '42501', 'd', fel);
    perform pg_temp.bli(A);
    l := public.nexlax_lage(ELEV);
    reset role;
    perform set_config('request.jwt.claims', null, true);
    -- 290: repetitionsförsöket, där F4 gav sina 10, togs bort ovan.
    ut := ut || jsonb_build_object('t', 'NX elevens studiehjälpare får läget', 'ok', (l ->> 'xp')::int = 290, 'd', l ->> 'xp');
    perform pg_temp.bli(ADM);
    l := public.nexlax_lage(ELEV);
    reset role;
    perform set_config('request.jwt.claims', null, true);
    ut := ut || jsonb_build_object('t', 'NX admin får läget', 'ok', (l ->> 'xp')::int = 290, 'd', l ->> 'xp');

    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', null, true);

  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('NX Fas 23.2', false, fel);
  else
    insert into utfall (test, ok, detalj)
    select x ->> 't', (x ->> 'ok')::boolean, x ->> 'd' from jsonb_array_elements(ut) x;
  end if;
end $$;

-- Fas 23.2: banken med de nya typerna. Varje matchning rättas rätt i
-- sin egen ordning och fel när högersidan flyttas ett steg, Mästarprov
-- och repetition har inga egna frågor (de dras ur nivåerna, och ett
-- eget facit hade kunnat glida isär från dem), och varje Mästarprov har
-- något att dra. Innan Fas 23.2 är körd blir det en röd rad som säger
-- det, inte ett avbrott: en svit som inte går att köra provar ingenting.
do $$
begin
  if to_regclass('public.niva_fragor') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'nivaer' and column_name = 'sort') then
    insert into utfall (test, ok, detalj)
    values ('NX banken', false, 'Fas 23.2 är inte körd: nivaer.sort finns inte');
    return;
  end if;

  insert into utfall (test, ok, detalj)
  select 'NX banken: rätt parning rättas rätt, förskjuten fel', count(*) = 0,
         coalesce(string_agg(q.id::text, ', '), 'inga')
    from public.niva_fragor q
   where q.aktiv and q.typ = 'para'
     and (not intern.niva_ratta(q, jsonb_build_object('par',
            (select jsonb_agg(p -> 1 order by n) from jsonb_array_elements(q.ratt) with ordinality y(p, n))))
          or intern.niva_ratta(q, jsonb_build_object('par',
            (select jsonb_agg(q.ratt -> (n::int % jsonb_array_length(q.ratt)) -> 1 order by n)
               from jsonb_array_elements(q.ratt) with ordinality y(p, n)))));

  insert into utfall (test, ok, detalj)
  select 'NX banken: mästarprov och repetition har inga egna frågor', count(*) = 0,
         coalesce(string_agg(distinct n.nyckel, ', '), 'inga')
    from public.nivaer n
    join public.niva_fragor q on q.niva_id = n.id and q.aktiv
   where n.sort <> 'vanlig';

  insert into utfall (test, ok, detalj)
  select 'NX banken: varje Mästarprov har frågor att dra', count(*) = 0,
         coalesce(string_agg(n.nyckel, ', '), 'inga')
    from public.nivaer n
   where n.aktiv and n.sort = 'mastare'
     and coalesce(cardinality(intern.nexlax_mastarfragor(n)), 0) = 0;
end $$;

-- ============================================================
-- RADERA EN PERSON (personer_redigeras_och_raderas)
--
-- Varje prov bygger sin egen familj, studiehjälpare, anmälan eller
-- ansökan i en deltransaktion och rullar tillbaka den. Fixturerna ovan
-- används bara som motpart: studiehjälpare A, familj Q och admin. De
-- nya passen ligger klockan 06 hos A, där inget annat pass står.
-- ============================================================

-- 1. Vem som når dörrarna. Hjälparna i intern når ingen.
select pg_temp.prova('Radera anon når inte underlaget', null,
  array[$q$select public.radering_lage('familj', '00000000-0000-4000-8000-0000000000f1')$q$], 'nekad');
select pg_temp.prova('Radera anon raderar ingen', null,
  array[$q$select public.radera_person('familj', '00000000-0000-4000-8000-0000000000f1')$q$], 'nekad');
select pg_temp.prova('Radera en familj når inte underlaget', '00000000-0000-4000-8000-0000000000f1',
  array[$q$select public.radering_lage('familj', '00000000-0000-4000-8000-0000000000f2')$q$], 'nekad');
select pg_temp.prova('Radera en familj raderar inte en annan', '00000000-0000-4000-8000-0000000000f1',
  array[$q$select public.radera_person('familj', '00000000-0000-4000-8000-0000000000f2')$q$], 'nekad');
select pg_temp.prova('Radera en studiehjälpare raderar inte sin elev', '00000000-0000-4000-8000-0000000000a1',
  array[$q$select public.radera_person('elev', '00000000-0000-4000-8000-0000000005a1')$q$], 'nekad');
select pg_temp.prova('Radera admin når inte hjälparna i intern', '00000000-0000-4000-8000-0000000000ad',
  array[$q$select intern.radering_underlag('familj', '00000000-0000-4000-8000-0000000000f1')$q$], 'nekad');

-- 2. Ett adminkonto raderas inte här, inte heller ens eget.
do $$
declare fel text; kod text;
begin
  begin
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
    perform public.radera_person('familj', '00000000-0000-4000-8000-0000000000ad');
    fel := 'gick igenom';
  exception when others then fel := sqlerrm; kod := sqlstate;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into utfall (test, ok, detalj)
  values ('Radera admin raderar inte ett adminkonto', fel = 'Ett adminkonto raderas inte här.',
          coalesce(kod, '') || ' ' || fel);
end $$;

-- 3. En familj utan bokföring tas bort helt. Anmälan och
--    kontaktmeddelandet med samma adress följer med, det kommande
--    passet avbokas först, och studiehjälparen får mejlet.
do $$
declare
  adm   constant uuid := '00000000-0000-4000-8000-0000000000ad';
  a     constant uuid := '00000000-0000-4000-8000-0000000000a1';
  fam   constant uuid := '00000000-0000-4000-8000-00000000d1f1';
  elev  constant uuid := '00000000-0000-4000-8000-00000000d1e1';
  pass  constant uuid := '00000000-0000-4000-8000-00000000d1b1';
  anm   constant uuid := '00000000-0000-4000-8000-00000000d1a1';
  kon   constant uuid := '00000000-0000-4000-8000-00000000d1c1';
  idag  date := (now() at time zone 'Europe/Stockholm')::date;
  lage jsonb; svar jsonb; fel text;
  kvar bigint; l_epost text; l_kund uuid; l_status text; n_kon bigint; n_mejl bigint; n_eget bigint; n_audit bigint;
begin
  begin
    alter table public.bookings enable trigger bookings_notis;
    insert into auth.users (id, email, raw_user_meta_data)
    values (fam, 'rls-radera-f@example.invalid', '{"role":"parent","full_name":"Radera Familj"}');
    insert into public.students (id, parent_id, name) values (elev, fam, 'Radera Barn');
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time,
                                 duration_min, status, location)
    values (pass, fam, a, elev, fam, idag + 45, '06:00', 60, 'confirmed', 'Radergatan 1');
    insert into public.leads (id, parent_name, email, child_name)
    values (anm, 'Radera Förälder', 'rls-radera-f@example.invalid', 'Radera Barn');
    update public.leads set kund_id = fam where id = anm;
    insert into public.contact_messages (id, name, email, message)
    values (kon, 'Radera', 'RLS-Radera-F+fraga@example.invalid', 'Hej');

    perform pg_temp.bli(adm);
    lage := public.radering_lage('familj', fam);
    svar := public.radera_person('familj', fam);
    reset role;
    perform set_config('request.jwt.claims', '', true);

    select (select count(*) from auth.users where id = fam) + (select count(*) from public.profiles where id = fam)
         + (select count(*) from public.students where id = elev) + (select count(*) from public.bookings where id = pass)
      into kvar;
    select l.email, l.kund_id, l.status into l_epost, l_kund, l_status from public.leads l where l.id = anm;
    select count(*) into n_kon from public.contact_messages where id = kon;
    select count(*) into n_mejl from public.notis_utskick
     where mottagare = a and typ = 'pass_avbokat' and data ->> 'skal' = 'familjen_avslutar';
    select count(*) into n_eget from public.notis_utskick where mottagare = fam;
    select count(*) into n_audit from public.audit_logg
     where handling = 'konto.raderat' and objekt_id = fam::text and aktor = adm;
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Radera familj utan bokföring', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('Radera familj utan bokföring tas bort helt',
      lage ->> 'satt' = 'helt' and svar ->> 'gjort' = 'raderat' and (lage ->> 'avbokas')::int = 1
      and jsonb_array_length(lage -> 'hinder') = 0, lage::text),
    ('Radera inloggningen, kontot, barnet och passet är borta', kvar = 0, 'kvar: ' || kvar),
    ('Radera anmälan avidentifieras och stängs',
      l_epost = 'gallrad' and l_kund is null and l_status = 'declined',
      coalesce(l_epost, 'null') || ' ' || coalesce(l_status, 'null')),
    ('Radera kontaktmeddelandet med samma adress tas bort', n_kon = 0, 'kvar: ' || n_kon),
    ('Radera studiehjälparen får mejlet om det avbokade passet', n_mejl = 1, 'mejl: ' || n_mejl),
    ('Radera familjen själv får inget mejl', n_eget = 0, 'mejl: ' || n_eget),
    ('Radera auditloggen säger vem som raderade', n_audit = 1, 'rader: ' || n_audit);
end $$;

-- 4. En familj med ett betalt, hållet pass i en stängd månad
--    avidentifieras. Passet och rapporten står kvar, utan adress och
--    text; det kommande passet avbokas; inloggningen stängs.
do $$
declare
  adm      constant uuid := '00000000-0000-4000-8000-0000000000ad';
  a        constant uuid := '00000000-0000-4000-8000-0000000000a1';
  fam      constant uuid := '00000000-0000-4000-8000-00000000d2f1';
  elev     constant uuid := '00000000-0000-4000-8000-00000000d2e1';
  hallet   constant uuid := '00000000-0000-4000-8000-00000000d2b1';
  kommande constant uuid := '00000000-0000-4000-8000-00000000d2b2';
  rapport  constant uuid := '00000000-0000-4000-8000-00000000d2d1';
  idag  date := (now() at time zone 'Europe/Stockholm')::date;
  dag   date := (date_trunc('month', (now() at time zone 'Europe/Stockholm')) - interval '3 months')::date + 9;
  lage jsonb; svar jsonb; fel text;
  pr public.profiles; el public.students; rp public.lesson_reports; bh public.bookings; bk public.bookings;
  u_epost text; u_raderad timestamptz; u_sparr timestamptz; n_ident bigint;
  n_rest bigint; vill boolean; n_audit bigint;
begin
  begin
    insert into auth.users (id, email, raw_user_meta_data)
    values (fam, 'rls-radera-g@example.invalid', '{"role":"parent","full_name":"Radera Gamla"}');
    insert into auth.identities (provider_id, user_id, identity_data, provider)
    values (fam::text, fam, jsonb_build_object('sub', fam::text, 'email', 'rls-radera-g@example.invalid'), 'email');
    insert into public.students (id, parent_id, name, school, goals, matched_tutor_id, match_status)
    values (elev, fam, 'Radera Alva', 'Raderskolan', 'Klara bråken', a, 'matched');
    -- Svaret (avbokningar_och_svar) töms som adressen, också i en stängd månad.
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time,
                                 duration_min, status, location, note, svar_meddelande)
    values (hallet, fam, a, elev, fam, dag, '06:00', 60, 'confirmed', 'Hemgatan 2', 'Ring på', 'Alva hade feber sist');
    insert into public.lesson_reports (id, student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, went_well)
    values (rapport, elev, a, hallet, 'Alva räknade bråk', dag, 'narvarande', 'Bråken satt');
    update public.bookings
       set betalning_status = 'betald', betalt_ore = 37900, betald_at = now(), stripe_payment_intent_id = 'pi_rls_radera'
     where id = hallet;
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time,
                                 duration_min, status, location)
    values (kommande, fam, a, elev, fam, idag + 46, '06:00', 60, 'confirmed', 'Hemgatan 2');
    insert into public.messages (parent_id, tutor_id, sender_id, body) values (fam, a, fam, 'Hej Anna, Alva är sjuk');
    insert into public.homework (student_id, tutor_id, title) values (elev, a, 'Bråk sidan 12');
    insert into public.study_plans (student_id, tutor_id, plan_text) values (elev, a, 'Alva ska klara bråk');
    insert into public.manadsbokslut (manad, stangd, stangd_at) values (date_trunc('month', dag)::date, true, now());

    perform pg_temp.bli(adm);
    lage := public.radering_lage('familj', fam);
    svar := public.radera_person('familj', fam);
    reset role;
    perform set_config('request.jwt.claims', '', true);

    select * into pr from public.profiles where id = fam;
    select u.email, u.deleted_at, u.banned_until into u_epost, u_raderad, u_sparr from auth.users u where u.id = fam;
    select count(*) into n_ident from auth.identities where user_id = fam;
    select * into el from public.students where id = elev;
    select * into rp from public.lesson_reports where id = rapport;
    select * into bh from public.bookings where id = hallet;
    select * into bk from public.bookings where id = kommande;
    select (select count(*) from public.messages where parent_id = fam)
         + (select count(*) from public.homework where student_id = elev)
         + (select count(*) from public.study_plans where student_id = elev)
      into n_rest;
    vill := public.notis_vill(fam, 'pass_avbokat', 'mejl');
    select count(*) into n_audit from public.audit_logg
     where handling = 'konto.avidentifierat' and objekt_id = fam::text and aktor = adm;
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Radera familj med bokföring', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('Radera familj med bokföring avidentifieras',
      lage ->> 'satt' = 'avidentifieras' and svar ->> 'gjort' = 'avidentifierat'
      and (lage ->> 'avbokas')::int = 1 and jsonb_array_length(lage -> 'hinder') = 0, lage::text),
    ('Radera kontot står kvar utan namn, adress och telefon',
      pr.full_name = 'Raderad familj' and pr.email = '' and pr.phone is null and pr.raderad_at is not null,
      coalesce(pr.full_name, 'borta') || ' / ' || coalesce(pr.email, 'null')),
    ('Radera inloggningen stängs som GoTrues mjuka radering',
      u_epost is null and u_raderad is not null and u_sparr > now() + interval '50 years' and n_ident = 0,
      coalesce(u_epost, 'ingen adress') || ', identiteter: ' || n_ident),
    ('Radera barnet står kvar utan uppgifter och utan studiehjälpare',
      el.name = 'Raderad elev' and el.school is null and el.goals is null
      and el.matched_tutor_id is null and el.raderad_at is not null,
      coalesce(el.name, 'borta')),
    ('Radera rapporten står kvar, utan text', rp.id is not null and rp.raw_notes = '' and rp.went_well is null
      and rp.narvaro = 'narvarande', coalesce(rp.raw_notes, 'borta')),
    ('Radera det betalda passet står kvar i den stängda månaden, utan adress',
      bh.id is not null and bh.betalt_ore = 37900 and bh.location is null and bh.note is null
      and bh.svar_meddelande is null,
      coalesce(bh.location, 'ingen adress') || ', ' || coalesce(bh.betalt_ore::text, 'inget belopp')),
    ('Radera det kommande passet avbokas', bk.status = 'cancelled' and bk.avbokningsskal = 'familjen_avslutar',
      coalesce(bk.status, 'borta') || ' ' || coalesce(bk.avbokningsskal, '')),
    ('Radera chatten, läxan och studieplanen tas bort', n_rest = 0, 'kvar: ' || n_rest),
    ('Radera ett raderat konto vill inga mejl', not vill, vill::text),
    ('Radera auditloggen skriver avidentifierat', n_audit = 1, 'rader: ' || n_audit);
end $$;

-- 5. Pengar som inte är uppgjorda hindrar raderingen: ett pass betalt
--    med kort som inte hållits, och ett som passerat utan rapport.
do $$
declare
  adm      constant uuid := '00000000-0000-4000-8000-0000000000ad';
  a        constant uuid := '00000000-0000-4000-8000-0000000000a1';
  fam      constant uuid := '00000000-0000-4000-8000-00000000d3f1';
  elev     constant uuid := '00000000-0000-4000-8000-00000000d3e1';
  idag  date := (now() at time zone 'Europe/Stockholm')::date;
  lage jsonb; fel text; kod text; slut text; hinder text; kvar bigint;
begin
  begin
    insert into auth.users (id, email, raw_user_meta_data)
    values (fam, 'rls-radera-h@example.invalid', '{"role":"parent","full_name":"Radera Hinder"}');
    insert into public.students (id, parent_id, name) values (elev, fam, 'Radera Hinder');
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time,
                                 duration_min, status)
    values ('00000000-0000-4000-8000-00000000d3b1', fam, a, elev, fam, idag + 47, '06:00', 60, 'confirmed'),
           ('00000000-0000-4000-8000-00000000d3b2', fam, a, elev, fam, idag - 2, '06:00', 60, 'confirmed');
    update public.bookings
       set betalning_status = 'betald', betalt_ore = 37900, stripe_payment_intent_id = 'pi_rls_hinder'
     where id = '00000000-0000-4000-8000-00000000d3b1';

    perform pg_temp.bli(adm);
    lage := public.radering_lage('familj', fam);
    begin
      perform public.radera_person('familj', fam);
      fel := 'gick igenom';
    exception when others then fel := sqlerrm; kod := sqlstate;
    end;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select string_agg(h ->> 'kod', ',' order by h ->> 'kod') into hinder from jsonb_array_elements(lage -> 'hinder') h;
    select count(*) into kvar from public.profiles where id = fam and raderad_at is null;
    raise exception 'rulla tillbaka';
  exception when others then slut := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if slut <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Radera hinder', false, slut);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('Radera betalt och inte hållet, och passerat utan rapport, är hinder',
      hinder = 'betalt_ej_hallet,ej_rapporterat', coalesce(hinder, 'inga')),
    ('Radera databasen vägrar så länge hindren finns',
      kod = '23514' and fel like 'Något måste göras först%' and kvar = 1, coalesce(kod, '') || ' ' || fel);
end $$;

-- 6. Filen först: finns profilbilden kvar i lagringen vägrar databasen.
do $$
declare
  adm constant uuid := '00000000-0000-4000-8000-0000000000ad';
  fam constant uuid := '00000000-0000-4000-8000-00000000d4f1';
  lage jsonb; fel text; slut text;
begin
  begin
    insert into auth.users (id, email, raw_user_meta_data)
    values (fam, 'rls-radera-i@example.invalid', '{"role":"parent","full_name":"Radera Bild"}');
    insert into storage.objects (bucket_id, name) values ('avatarer', fam::text || '/bild.png');
    perform pg_temp.bli(adm);
    lage := public.radering_lage('familj', fam);
    begin
      perform public.radera_person('familj', fam);
      fel := 'gick igenom';
    exception when others then fel := sqlerrm;
    end;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    raise exception 'rulla tillbaka';
  exception when others then slut := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if slut <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Radera filen först', false, slut);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('Radera profilbilden står bland filerna som ska bort först',
      jsonb_array_length(lage -> 'filer') = 1 and lage -> 'filer' -> 0 ->> 'hink' = 'avatarer', (lage -> 'filer')::text),
    ('Radera databasen vägrar medan filen finns kvar', fel like 'Filerna finns kvar%', fel);
end $$;

-- 7. Studiehjälpare: en matchad elev hindrar. A har Äldst.
do $$
declare lage jsonb; fel text;
begin
  begin
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
    lage := public.radering_lage('studiehjalpare', '00000000-0000-4000-8000-0000000000a1');
    reset role;
    perform set_config('request.jwt.claims', '', true);
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into utfall (test, ok, detalj)
  values ('Radera en studiehjälpare med matchade elever hindras',
          fel = 'rulla tillbaka' and exists (select 1 from jsonb_array_elements(lage -> 'hinder') h
                                              where h ->> 'kod' = 'matchade_elever'),
          coalesce((lage -> 'hinder')::text, fel));
end $$;

-- 8. En studiehjälpare som aldrig hållit ett pass tas bort helt, med
--    sin ansökan.
do $$
declare
  adm constant uuid := '00000000-0000-4000-8000-0000000000ad';
  t   constant uuid := '00000000-0000-4000-8000-00000000d5a1';
  app constant uuid := '00000000-0000-4000-8000-00000000d5a2';
  lage jsonb; svar jsonb; fel text; kvar bigint; n_audit bigint;
begin
  begin
    insert into auth.users (id, email, raw_user_meta_data)
    values (t, 'rls-radera-t@example.invalid', '{"role":"tutor","full_name":"Radera Hjälpare"}');
    update public.tutor_profiles set status = 'approved', hourly_rate = 150 where id = t;
    insert into public.applications (id, name, email, why)
    values (app, 'Radera Hjälpare', 'rls-radera-t@example.invalid', 'Jag vill hjälpa till');
    perform pg_temp.bli(adm);
    lage := public.radering_lage('studiehjalpare', t);
    svar := public.radera_person('studiehjalpare', t);
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select (select count(*) from auth.users where id = t) + (select count(*) from public.tutor_profiles where id = t)
         + (select count(*) from public.applications where id = app)
      into kvar;
    select count(*) into n_audit from public.audit_logg
     where aktor = adm and ((handling = 'konto.raderat' and objekt_id = t::text)
                         or (handling = 'ansokan.borttagen' and objekt_id = app::text));
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Radera studiehjälpare utan pass', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('Radera studiehjälpare utan pass tas bort helt, med ansökan',
      lage ->> 'satt' = 'helt' and (lage -> 'tas_bort' ->> 'ansokningar')::int = 1 and kvar = 0, lage::text),
    ('Radera auditloggen har kontot och ansökan', n_audit = 2, 'rader: ' || n_audit);
end $$;

-- 9. En studiehjälpare med en rapport avidentifieras: rapporten och
--    timpenningen står kvar för lönen, det kommande passet avbokas.
do $$
declare
  adm      constant uuid := '00000000-0000-4000-8000-0000000000ad';
  q        constant uuid := '00000000-0000-4000-8000-0000000000f2';
  qelev    constant uuid := '00000000-0000-4000-8000-0000000005c1';
  t        constant uuid := '00000000-0000-4000-8000-00000000d6a1';
  hallet   constant uuid := '00000000-0000-4000-8000-00000000d6b1';
  kommande constant uuid := '00000000-0000-4000-8000-00000000d6b2';
  rapport  constant uuid := '00000000-0000-4000-8000-00000000d6d1';
  idag  date := (now() at time zone 'Europe/Stockholm')::date;
  lage jsonb; svar jsonb; fel text;
  pr public.profiles; tp public.tutor_profiles; n_rapport bigint; bk public.bookings; n_medd bigint;
begin
  begin
    insert into auth.users (id, email, raw_user_meta_data)
    values (t, 'rls-radera-u@example.invalid', '{"role":"tutor","full_name":"Radera Lärd"}');
    update public.tutor_profiles
       set status = 'approved', hourly_rate = 150, school = 'Hjälparskolan', bio = 'Jag heter Lärd'
     where id = t;
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time,
                                 duration_min, status)
    values (hallet, q, t, qelev, q, idag - 30, '06:00', 60, 'confirmed'),
           (kommande, q, t, qelev, q, idag + 48, '06:00', 60, 'confirmed');
    -- Studiehjälparens svar på ett förslag är hens ord, som chatten.
    update public.bookings set svar_meddelande = 'Den tiden kan jag inte' where id = hallet;
    insert into public.lesson_reports (id, student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
    values (rapport, qelev, t, hallet, 'Bra pass', idag - 30, 'narvarande');
    insert into public.messages (parent_id, tutor_id, sender_id, body) values (q, t, t, 'Hej från Lärd');

    perform pg_temp.bli(adm);
    lage := public.radering_lage('studiehjalpare', t);
    svar := public.radera_person('studiehjalpare', t);
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select * into pr from public.profiles where id = t;
    select * into tp from public.tutor_profiles where id = t;
    select count(*) into n_rapport from public.lesson_reports where id = rapport and tutor_id = t;
    select * into bk from public.bookings where id = kommande;
    select count(*) into n_medd from public.messages where tutor_id = t;
    n_medd := n_medd + (select count(*) from public.bookings where tutor_id = t and svar_meddelande is not null);
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Radera studiehjälpare med rapport', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('Radera studiehjälpare med rapport avidentifieras',
      lage ->> 'satt' = 'avidentifieras' and svar ->> 'gjort' = 'avidentifierat', lage::text),
    ('Radera profilen står kvar utan namn och text, utanför poolen',
      pr.full_name = 'Raderad studiehjälpare' and pr.email = '' and tp.status = 'rejected'
      and tp.school is null and tp.bio is null and not tp.visa_publikt,
      coalesce(pr.full_name, 'borta') || ' ' || coalesce(tp.status, '')),
    ('Radera timpenningen och rapporten står kvar för lönen', tp.hourly_rate = 150 and n_rapport = 1,
      coalesce(tp.hourly_rate::text, 'ingen') || ', rapporter: ' || n_rapport),
    ('Radera det kommande passet avbokas med skälet ingen studiehjälpare',
      bk.status = 'cancelled' and bk.avbokningsskal = 'ingen_hjalpare',
      coalesce(bk.status, 'borta') || ' ' || coalesce(bk.avbokningsskal, '')),
    ('Radera chatten och svaren på förslagen tas bort', n_medd = 0, 'kvar: ' || n_medd);
end $$;

-- 10. En intresseanmälan avidentifieras, med alla anmälningar och
--     kontaktmeddelanden från samma adress och uppgifterna om dem.
do $$
declare
  adm constant uuid := '00000000-0000-4000-8000-0000000000ad';
  l1  constant uuid := '00000000-0000-4000-8000-00000000d7a1';
  l2  constant uuid := '00000000-0000-4000-8000-00000000d7a2';
  k1  constant uuid := '00000000-0000-4000-8000-00000000d7c1';
  lage jsonb; svar jsonb; fel text;
  kvar bigint; st1 text; st2 text; n_kon bigint; n_upg bigint; n_audit bigint;
begin
  begin
    insert into public.leads (id, parent_name, email, child_name, message, status)
    values (l1, 'Radera Lead', 'Rls-Radera-L@example.invalid', 'Barnet', 'Vi bor på Storgatan', 'new'),
           (l2, 'Radera Lead', 'rls-radera-l+igen@example.invalid', null, null, 'contacted');
    insert into public.contact_messages (id, name, email, message)
    values (k1, 'Lead', 'rls-radera-l@example.invalid', 'En fråga');
    insert into public.uppgifter (titel, kopplad_tabell, kopplad_id, skapad_av_typ)
    values ('Ring Radera Lead', 'leads', l1::text, 'manniska');

    perform pg_temp.bli(adm);
    lage := public.radering_lage('anmalan', l1);
    svar := public.radera_person('anmalan', l1);
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select count(*) into kvar from public.leads
     where id in (l1, l2) and (email <> 'gallrad' or parent_name <> 'Gallrad' or child_name is not null or message is not null);
    select status into st1 from public.leads where id = l1;
    select status into st2 from public.leads where id = l2;
    select count(*) into n_kon from public.contact_messages where id = k1;
    select count(*) into n_upg from public.uppgifter where kopplad_tabell = 'leads' and kopplad_id = l1::text;
    select count(*) into n_audit from public.audit_logg where handling = 'anmalan.avidentifierad' and objekt_id = l1::text;
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Radera anmälan', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('Radera anmälan räknar med samma adress, också med plustillägg',
      (lage -> 'tas_bort' ->> 'anmalningar')::int = 2 and (lage -> 'tas_bort' ->> 'kontaktmeddelanden')::int = 1,
      (lage -> 'tas_bort')::text),
    ('Radera båda anmälningarna avidentifieras och stängs',
      kvar = 0 and st1 = 'declined' and st2 = 'declined', 'kvar: ' || kvar || ', ' || st1 || '/' || st2),
    ('Radera kontaktmeddelandet och uppgiften tas bort', n_kon = 0 and n_upg = 0, n_kon || '/' || n_upg),
    ('Radera auditloggen skriver att anmälan avidentifierats', n_audit = 1, 'rader: ' || n_audit);
end $$;

-- 11. En ansökan: med CV:t kvar i lagringen vägrar databasen. Utan CV
--     tas den bort, och auditloggen säger av vem.
do $$
declare
  adm  constant uuid := '00000000-0000-4000-8000-0000000000ad';
  app  constant uuid := '00000000-0000-4000-8000-00000000d8a1';
  app2 constant uuid := '00000000-0000-4000-8000-00000000d8a2';
  lage jsonb; svar jsonb; fel text; slut text; kvar bigint; n_audit bigint;
begin
  begin
    insert into public.applications (id, name, email, why)
    values (app, 'Radera Sökande', 'rls-radera-s@example.invalid',
            'Jag vill jobba' || E'\n' || 'CV: cv/1700000000000-rlsprov-Radera.pdf'),
           (app2, 'Radera Annan', 'rls-radera-s2@example.invalid', 'Jag vill också');
    insert into storage.objects (bucket_id, name) values ('cv', '1700000000000-rlsprov-Radera.pdf');
    perform pg_temp.bli(adm);
    lage := public.radering_lage('ansokan', app);
    begin
      perform public.radera_person('ansokan', app);
      fel := 'gick igenom';
    exception when others then fel := sqlerrm;
    end;
    svar := public.radera_person('ansokan', app2);
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select count(*) into kvar from public.applications where id = app2;
    select count(*) into n_audit from public.audit_logg
     where handling = 'ansokan.borttagen' and objekt_id = app2::text and aktor = adm;
    raise exception 'rulla tillbaka';
  exception when others then slut := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if slut <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Radera ansökan', false, slut);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('Radera CV:t står bland filerna som ska bort först',
      lage -> 'filer' @> '[{"hink": "cv", "namn": "1700000000000-rlsprov-Radera.pdf"}]', (lage -> 'filer')::text),
    ('Radera databasen vägrar medan CV:t finns kvar', fel like 'Filerna finns kvar%', fel),
    ('Radera en ansökan utan CV tas bort, och loggas med vem', kvar = 0 and n_audit = 1,
      'kvar: ' || kvar || ', rader: ' || n_audit);
end $$;

-- 12. Ett kontaktmeddelande tas bort och loggas.
do $$
declare
  adm constant uuid := '00000000-0000-4000-8000-0000000000ad';
  k   constant uuid := '00000000-0000-4000-8000-00000000d9c1';
  fel text; kvar bigint; n_audit bigint;
begin
  begin
    insert into public.contact_messages (id, name, email, message)
    values (k, 'Radera Fråga', 'rls-radera-k@example.invalid', 'Hej');
    perform pg_temp.bli(adm);
    perform public.radera_person('kontakt', k);
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select count(*) into kvar from public.contact_messages where id = k;
    select count(*) into n_audit from public.audit_logg
     where handling = 'kontaktmeddelande.borttagen' and objekt_id = k::text and aktor = adm;
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into utfall (test, ok, detalj)
  values ('Radera ett kontaktmeddelande tas bort och loggas',
          fel = 'rulla tillbaka' and kvar = 0 and n_audit = 1,
          case when fel = 'rulla tillbaka' then 'kvar: ' || kvar || ', rader: ' || n_audit else fel end);
end $$;

-- 13. Ett barn i en familj som står kvar: utan rapporter bort helt,
--     med en rapport kvar som "Raderad elev" som familjen inte ser.
do $$
declare
  adm constant uuid := '00000000-0000-4000-8000-0000000000ad';
  a   constant uuid := '00000000-0000-4000-8000-0000000000a1';
  q   constant uuid := '00000000-0000-4000-8000-0000000000f2';
  c1  constant uuid := '00000000-0000-4000-8000-00000000dae1';
  c2  constant uuid := '00000000-0000-4000-8000-00000000dae2';
  pass constant uuid := '00000000-0000-4000-8000-00000000dab1';
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  s1 jsonb; s2 jsonb; fel text; n1 bigint; namn2 text; syns bigint; fam bigint;
begin
  begin
    insert into public.students (id, parent_id, name) values (c1, q, 'Radera Syskon'), (c2, q, 'Radera Syskon Två');
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time,
                                 duration_min, status)
    values (pass, q, a, c2, q, idag - 40, '06:00', 60, 'confirmed');
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
    values (c2, a, pass, 'Syskonet räknade', idag - 40, 'narvarande');

    perform pg_temp.bli(adm);
    s1 := public.radera_person('elev', c1);
    s2 := public.radera_person('elev', c2);
    perform pg_temp.bli(q);
    select count(*) into syns from public.students where id = c2;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select count(*) into n1 from public.students where id = c1;
    select name into namn2 from public.students where id = c2;
    select count(*) into fam from public.profiles where id = q and raderad_at is null;
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Radera ett barn', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('Radera ett barn utan rapporter tas bort helt', s1 ->> 'gjort' = 'raderad' and n1 = 0, s1::text),
    ('Radera ett barn med rapport står kvar utan namn', s2 ->> 'gjort' = 'avidentifierad' and namn2 = 'Raderad elev',
      coalesce(namn2, 'borta')),
    ('Radera familjen ser inte det raderade barnet, och står själv kvar', syns = 0 and fam = 1,
      'syns: ' || syns || ', familjen: ' || fam);
end $$;

-- 14. Markeringen går inte att sätta, eller ta bort, från en vy.
do $$
declare
  p  constant uuid := '00000000-0000-4000-8000-0000000000f1';
  fel text; prof timestamptz; barn timestamptz;
begin
  begin
    perform pg_temp.bli(p);
    update public.profiles set raderad_at = now() where id = p;
    update public.students set raderad_at = now() where id = '00000000-0000-4000-8000-0000000005a1';
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select raderad_at into prof from public.profiles where id = p;
    select raderad_at into barn from public.students where id = '00000000-0000-4000-8000-0000000005a1';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into utfall (test, ok, detalj)
  values ('Radera en familj markerar inte sig själv eller sitt barn som raderade',
          fel = 'rulla tillbaka' and prof is null and barn is null,
          case when fel = 'rulla tillbaka' then coalesce(prof::text, 'null') || ' / ' || coalesce(barn::text, 'null') else fel end);
end $$;

-- 15. Barnets försök på de digitala uppgifterna (Fas 23.1) följer inte
--     med ett avidentifierat barn. Före fas23_1_uppgifterna_blir_digitala
--     finns tabellen inte, och då säger raden det i stället.
do $$
declare
  adm  constant uuid := '00000000-0000-4000-8000-0000000000ad';
  a    constant uuid := '00000000-0000-4000-8000-0000000000a1';
  q    constant uuid := '00000000-0000-4000-8000-0000000000f2';
  barn constant uuid := '00000000-0000-4000-8000-00000000dbe1';
  pass constant uuid := '00000000-0000-4000-8000-00000000dbb1';
  niva constant uuid := '00000000-0000-4000-8000-00000000dba1';
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  lage jsonb; svar jsonb; fel text; kvar bigint;
begin
  if to_regclass('public.niva_forsok') is null then
    insert into utfall (test, ok, detalj)
    values ('Radera ett barns digitala försök (Fas 23.1 är inte körd)', true, 'niva_forsok finns inte än');
    return;
  end if;
  begin
    insert into public.students (id, parent_id, name) values (barn, q, 'Radera Nivåbarn');
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time,
                                 duration_min, status)
    values (pass, q, a, barn, q, idag - 41, '06:00', 60, 'confirmed');
    -- Studiehjälparens svar om barnet töms med barnet (avbokningar_och_svar).
    update public.bookings set svar_meddelande = 'Nivåbarnet var sjukt' where id = pass;
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
    values (barn, a, pass, 'Nivåbarnet räknade', idag - 41, 'narvarande');
    execute 'insert into public.nivaer (id, nyckel, amne, arskurs, omrade, titel, ordning)
             values ($1, ''rls-radera-niva'', ''Matematik'', ''ak8'', ''Algebra'', ''RLS radera'', 1)' using niva;
    execute 'insert into public.niva_forsok (niva_id, student_id, fragor) values ($1, $2, array[$1])'
      using niva, barn;

    perform pg_temp.bli(adm);
    lage := public.radering_lage('elev', barn);
    svar := public.radera_person('elev', barn);
    reset role;
    perform set_config('request.jwt.claims', '', true);
    execute 'select count(*) from public.niva_forsok where student_id = $1' into kvar using barn;
    kvar := kvar + (select count(*) from public.bookings where id = pass and svar_meddelande is not null);
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Radera ett barns digitala försök', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('Radera ett barns digitala försök räknas i rutan', (lage -> 'tas_bort' ->> 'forsok')::int = 1, lage::text),
    ('Radera ett barns digitala försök och svaren om barnet tas bort när barnet avidentifieras',
      svar ->> 'gjort' = 'avidentifierad' and kvar = 0, svar::text || ' kvar: ' || kvar);
end $$;

-- ============================================================
-- CHATTEN ÖPPNAS AV ADMIN (admin_oppnar_chatten)
--
-- chatt_las() är adminvyns Öppna chatt: hela tråden mellan en familj
-- och en studiehjälpare, och en rad i auditloggen för varje öppning.
-- Parterna ska inte märka något: read_at står kvar, och bara admin når
-- funktionen. Tråden P–A är fixturens (Äldst är matchad med A); en
-- tråd P–B finns för att visa att den andra tråden inte följer med.
-- ============================================================

select pg_temp.prova('Chatten anon öppnar ingen chatt', null,
  array[$q$select * from public.chatt_las('00000000-0000-4000-8000-0000000000f1',
                                          '00000000-0000-4000-8000-0000000000a1')$q$], 'nekad');
select pg_temp.prova('Chatten familjen läser inte genom adminvägen', '00000000-0000-4000-8000-0000000000f1',
  array[$q$select * from public.chatt_las('00000000-0000-4000-8000-0000000000f1',
                                          '00000000-0000-4000-8000-0000000000a1')$q$], 'nekad');
select pg_temp.prova('Chatten studiehjälparen läser inte genom adminvägen', '00000000-0000-4000-8000-0000000000a1',
  array[$q$select * from public.chatt_las('00000000-0000-4000-8000-0000000000f1',
                                          '00000000-0000-4000-8000-0000000000a1')$q$], 'nekad');

insert into utfall (test, ok, detalj)
select 'Chatten bara inloggade når funktionen, den är DEFINER och skriver (VOLATILE)',
       coalesce(not has_function_privilege('anon', to_regprocedure('public.chatt_las(uuid,uuid)'), 'execute')
            and has_function_privilege('authenticated', to_regprocedure('public.chatt_las(uuid,uuid)'), 'execute')
            and p.prosecdef and p.provolatile = 'v', false),
       case when p.oid is null then 'funktionen finns inte'
            else 'definer: ' || p.prosecdef || ', volatile: ' || p.provolatile::text end
  from (select 1) x
  left join pg_proc p on p.oid = to_regprocedure('public.chatt_las(uuid,uuid)');

do $$
declare
  adm constant uuid := '00000000-0000-4000-8000-0000000000ad';
  a   constant uuid := '00000000-0000-4000-8000-0000000000a1';
  b   constant uuid := '00000000-0000-4000-8000-0000000000b1';
  p   constant uuid := '00000000-0000-4000-8000-0000000000f1';
  m1  constant uuid := '00000000-0000-4000-8000-00000000dc01';
  m2  constant uuid := '00000000-0000-4000-8000-00000000dc02';
  fel text; kod text; slut text;
  n bigint; totalt bigint; forsta uuid; andra_tradens bigint; olasta bigint;
  n_audit bigint; audit public.audit_logg; n_audit_nekad bigint;
  n_stor bigint; totalt_stor bigint; nyast_stor timestamptz; nyast_alla timestamptz;
begin
  begin
    insert into public.messages (id, parent_id, tutor_id, sender_id, body, created_at) values
      (m1, p, a, p, 'Hej Anna, Äldst har prov på fredag', now() - interval '2 hours'),
      (m2, p, a, a, 'Då tar vi bråken på torsdag', now() - interval '1 hour');
    insert into public.messages (parent_id, tutor_id, sender_id, body)
    values (p, b, p, 'Hej Bo, det här är en annan tråd');

    -- En familj som försöker skriver ingen rad i loggen.
    perform pg_temp.bli(p);
    begin
      perform public.chatt_las(p, a);
    exception when others then null;
    end;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select count(*) into n_audit_nekad from public.audit_logg where handling = 'chatt.oppnad' and objekt_id = p::text;

    perform pg_temp.bli(adm);
    select count(*), max(c.totalt) into n, totalt from public.chatt_las(p, a) c;
    select c.id into forsta from public.chatt_las(p, a) c limit 1;
    select count(*) into andra_tradens from public.chatt_las(p, a) c where c.body like 'Hej Bo%';
    reset role;
    perform set_config('request.jwt.claims', '', true);

    select count(*) into olasta from public.messages where id in (m1, m2) and read_at is null;
    select count(*) into n_audit from public.audit_logg
     where handling = 'chatt.oppnad' and objekt_id = p::text and aktor = adm;
    select * into audit from public.audit_logg
     where handling = 'chatt.oppnad' and objekt_id = p::text and aktor = adm order by id limit 1;

    -- En tråd längre än 500: de 500 NYASTE kommer, och totalt säger hur
    -- många tråden har.
    insert into public.messages (parent_id, tutor_id, sender_id, body, created_at)
    select p, a, p, 'rad ' || g, now() - interval '30 days' + g * interval '1 minute'
      from generate_series(1, 510) g;
    select max(created_at) into nyast_alla from public.messages where parent_id = p and tutor_id = a;
    perform pg_temp.bli(adm);
    select count(*), max(c.totalt), max(c.created_at) into n_stor, totalt_stor, nyast_stor
      from public.chatt_las(p, a) c;
    reset role;
    perform set_config('request.jwt.claims', '', true);

    -- Utan någon av parterna finns ingen tråd att läsa.
    perform pg_temp.bli(adm);
    begin
      perform public.chatt_las(p, null);
      fel := 'gick igenom';
    exception when others then fel := sqlerrm; kod := sqlstate;
    end;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    raise exception 'rulla tillbaka';
  exception when others then slut := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if slut <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Chatten admin öppnar tråden', false, slut);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('Chatten admin läser hela tråden, nyast först',
      n = 2 and totalt = 2 and forsta = m2, 'rader: ' || n || ', totalt: ' || totalt),
    ('Chatten den andra tråden följer inte med', andra_tradens = 0, 'rader: ' || andra_tradens),
    ('Chatten parterna märker inget: read_at står kvar', olasta = 2, 'olästa: ' || olasta),
    ('Chatten varje öppning står i auditloggen, med vem', n_audit = 3, 'rader: ' || n_audit),
    ('Chatten loggraden bär studiehjälparen och antalet, aldrig texten',
      audit.aktor_typ = 'admin' and audit.tabell = 'messages' and audit.fore is null
      and audit.efter = jsonb_build_object('tutor_id', a, 'meddelanden', 2),
      coalesce(audit.efter::text, 'ingen rad')),
    ('Chatten ett nekat försök skriver ingen rad', n_audit_nekad = 0, 'rader: ' || n_audit_nekad),
    ('Chatten en lång tråd ger de 500 nyaste och säger hur många det är',
      n_stor = 500 and totalt_stor = 512 and nyast_stor = nyast_alla,
      'rader: ' || n_stor || ', totalt: ' || totalt_stor),
    ('Chatten utan studiehjälpare finns ingen tråd', kod = '22023', coalesce(kod, '') || ' ' || fel);
end $$;

-- ============================================================
-- SVARET PÅ FÖRSLAGET OCH AVBOKADE PASS (avbokningar_och_svar)
--
-- Studiehjälparen avslår en tid familjen föreslagit och skriver varför,
-- eller föreslår en annan tid med några rader. Den som fick ett
-- motförslag svarar ja eller nej. avbokad_fran säger om ett avbokat
-- pass var bekräftat (en avbokning) eller ett förslag (inte en), och
-- stämplas av databasen. Svaret töms efter 30 dagar.
--
-- Fixturerna ligger långt fram och klockan 11, där inget annat prov
-- har något hos A: s1 och s2 är familjen P:s förslag, s3 ett
-- bekräftat pass och s4 studiehjälparen A:s eget förslag.
-- ============================================================

insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, subject, tjanst, format,
                             antal_barn, wanted_date, wanted_time, duration_min, status) values
  ('00000000-0000-4000-8000-000000009301', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
   '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1', 'Matematik', 'laxhjalp', 'Online',
   1, (now() at time zone 'Europe/Stockholm')::date + 40, '11:00', 60, 'requested'),
  ('00000000-0000-4000-8000-000000009302', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
   '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1', 'Matematik', 'laxhjalp', 'Online',
   1, (now() at time zone 'Europe/Stockholm')::date + 41, '11:00', 60, 'requested'),
  ('00000000-0000-4000-8000-000000009303', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
   '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1', 'Matematik', 'laxhjalp', 'Online',
   1, (now() at time zone 'Europe/Stockholm')::date + 42, '11:00', 60, 'confirmed'),
  ('00000000-0000-4000-8000-000000009304', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
   '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1', 'Matematik', 'laxhjalp', 'Online',
   1, (now() at time zone 'Europe/Stockholm')::date + 43, '11:00', 60, 'requested');

-- Ett steg i ett flöde: kör en sats som uid och svara 'ok', 'noll'
-- (RLS träffade ingen rad) eller felkoden. Ett lyckat steg står kvar
-- till nästa steg i samma block; ett nekat rullas tillbaka för sig.
create function pg_temp.svar_som(p_uid uuid, p_sql text) returns text
language plpgsql as $$
declare
  kod text;
  n   bigint;
begin
  begin
    perform pg_temp.bli(p_uid);
    execute p_sql;
    get diagnostics n = row_count;
    kod := case when n > 0 then 'ok' else 'noll' end;
  exception when others then
    kod := sqlstate;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return kod;
end $$;

-- ---------- stämplarna sätts bara av databasen ----------
select pg_temp.prova('Svar familjen skriver inte avbokad_fran själv', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set avbokad_fran = 'confirmed' where id = '00000000-0000-4000-8000-000000009303'$q$],
  'nekad');
select pg_temp.prova('Svar familjen skriver inte avbokad_at själv', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set avbokad_at = now() where id = '00000000-0000-4000-8000-000000009303'$q$],
  'nekad');
select pg_temp.prova('Svar studiehjälparen skriver inte motforslag_at själv', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set motforslag_at = now() where id = '00000000-0000-4000-8000-000000009301'$q$],
  'nekad');
select pg_temp.rakna_efter('Svar ett nytt pass från en vy bär inga stämplar och inget svar',
  '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, subject, tjanst, format,
            antal_barn, wanted_date, wanted_time, duration_min, status,
            avbokad_at, avbokad_av, avbokad_fran, motforslag_at, svar_meddelande)
          values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1', 'Matematik', 'laxhjalp',
            'Online', 1, (now() at time zone 'Europe/Stockholm')::date + 44, '11:00', 60, 'requested',
            now(), '00000000-0000-4000-8000-0000000000f1', 'confirmed', now(), 'påhittat')$q$],
  $q$select count(*) from public.bookings
      where wanted_date = (now() at time zone 'Europe/Stockholm')::date + 44 and wanted_time = '11:00'
        and parent_id = '00000000-0000-4000-8000-0000000000f1'
        and avbokad_at is null and avbokad_av is null and avbokad_fran is null
        and motforslag_at is null and svar_meddelande is null$q$, 1);

-- ---------- avbokningarna räknas rätt ----------
select pg_temp.rakna_efter('Svar ett bekräftat pass som familjen avbokar räknas, av familjen',
  '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set status = 'cancelled', avbokningsskal = 'sjukdom'
            where id = '00000000-0000-4000-8000-000000009303'$q$],
  $q$select count(*) from public.bookings where id = '00000000-0000-4000-8000-000000009303'
      and avbokad_fran = 'confirmed' and avbokad_av = parent_id and avbokad_at is not null$q$, 1);
select pg_temp.rakna_efter('Svar ett bekräftat pass som studiehjälparen avbokar räknas, av studiehjälparen',
  '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set status = 'cancelled', avbokningsskal = 'forhinder'
            where id = '00000000-0000-4000-8000-000000009303'$q$],
  $q$select count(*) from public.bookings where id = '00000000-0000-4000-8000-000000009303'
      and avbokad_fran = 'confirmed' and avbokad_av = tutor_id$q$, 1);
select pg_temp.rakna_efter('Svar ett förslag som familjen drar tillbaka räknas inte som avbokning',
  '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set status = 'cancelled', avbokningsskal = 'annat'
            where id = '00000000-0000-4000-8000-000000009301'$q$],
  $q$select count(*) from public.bookings where id = '00000000-0000-4000-8000-000000009301'
      and status = 'cancelled' and avbokad_fran = 'requested'$q$, 1);

do $$
declare
  adm constant uuid := '00000000-0000-4000-8000-0000000000ad';
  s3  constant uuid := '00000000-0000-4000-8000-000000009303';
  k1 text; k2 text; forr timestamptz; efter timestamptz; fran text; fel text;
begin
  begin
    update public.bookings set status = 'cancelled' where id = s3;
    update public.bookings set avbokad_at = '2026-09-01 10:00+02' where id = s3;
    -- En andra "avbokning" är ingen övergång och stämplar ingenting.
    k1 := pg_temp.svar_som(adm, $q$update public.bookings set status = 'cancelled', avbokningsskal = 'annat'
                                   where id = '00000000-0000-4000-8000-000000009303'$q$);
    k2 := pg_temp.svar_som('00000000-0000-4000-8000-0000000000f1',
      $q$update public.bookings set status = 'confirmed' where id = '00000000-0000-4000-8000-000000009303'$q$);
    select avbokad_at, avbokad_fran into efter, fran from public.bookings where id = s3;
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Svar en avbokning stämplas en gång', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('Svar en avbokning stämplas en gång', k1 = 'ok' and efter = '2026-09-01 10:00+02' and fran = 'confirmed',
      k1 || ' ' || coalesce(efter::text, 'null') || ' ' || coalesce(fran, 'null')),
    ('Svar familjen väcker inte ett avbokat pass', k2 = '42501', k2);
end $$;

-- ---------- vem som får svara ----------
select pg_temp.rakna('Svar familj Q ser inte familj P:s pass och svar', '00000000-0000-4000-8000-0000000000f2',
  $q$select count(*) from public.bookings where id in ('00000000-0000-4000-8000-000000009301',
     '00000000-0000-4000-8000-000000009302', '00000000-0000-4000-8000-000000009303',
     '00000000-0000-4000-8000-000000009304')$q$, 0);
select pg_temp.prova('Svar familj Q svarar inte på familj P:s förslag', '00000000-0000-4000-8000-0000000000f2',
  array[$q$update public.bookings set status = 'confirmed' where id = '00000000-0000-4000-8000-000000009304'$q$],
  'nekad');
select pg_temp.prova('Svar studiehjälpare B svarar inte på ett förslag till A', '00000000-0000-4000-8000-0000000000b1',
  array[$q$update public.bookings set status = 'confirmed' where id = '00000000-0000-4000-8000-000000009301'$q$],
  'nekad');
select pg_temp.prova('Svar studiehjälpare B avslår inte ett förslag till A', '00000000-0000-4000-8000-0000000000b1',
  array[$q$update public.bookings set status = 'cancelled', svar_meddelande = 'Nej'
            where id = '00000000-0000-4000-8000-000000009301'$q$],
  'nekad');
select pg_temp.prova('Svar studiehjälpare B föreslår inte tid för en familj hen inte är matchad med',
  '00000000-0000-4000-8000-0000000000b1',
  array[$q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, subject, tjanst, format,
            antal_barn, wanted_date, wanted_time, duration_min, status)
          values ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000b1',
            '00000000-0000-4000-8000-0000000005c1', '00000000-0000-4000-8000-0000000000b1', 'Matematik', 'laxhjalp',
            'Online', 1, (now() at time zone 'Europe/Stockholm')::date + 44, '12:00', 60, 'requested')$q$],
  'nekad');
select pg_temp.prova('Svar familjen skriver inget svar på sitt eget förslag', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set svar_meddelande = 'Hej' where id = '00000000-0000-4000-8000-000000009301'$q$],
  'nekad');
select pg_temp.prova('Svar familjen avböjer inte med ett svar, som studiehjälparen', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set status = 'cancelled', svar_meddelande = 'Nej tack'
            where id = '00000000-0000-4000-8000-000000009304'$q$],
  'nekad');
select pg_temp.prova('Svar familjen avböjer studiehjälparens förslag utan svar', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set status = 'cancelled' where id = '00000000-0000-4000-8000-000000009304'$q$],
  'ok');
select pg_temp.prova('Svar studiehjälparen bekräftar inte sitt eget förslag', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set status = 'confirmed' where id = '00000000-0000-4000-8000-000000009304'$q$],
  'nekad');

-- ---------- statusövergångarna ----------
select pg_temp.prova('Svar ett framtida förslag blir inte genomfört', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set status = 'completed' where id = '00000000-0000-4000-8000-000000009301'$q$],
  'nekad');
select pg_temp.prova('Svar ett bekräftat pass blir inte förslag igen utan ny tid', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set status = 'requested' where id = '00000000-0000-4000-8000-000000009303'$q$],
  'nekad');
select pg_temp.prova_med('Svar ett avslaget förslag går inte att väcka igen',
  array[$q$update public.bookings set status = 'cancelled', svar_meddelande = 'Nej'
            where id = '00000000-0000-4000-8000-000000009301'$q$],
  '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set status = 'requested' where id = '00000000-0000-4000-8000-000000009301'$q$],
  'nekad');
select pg_temp.prova('Svar svaret skrivs inte på ett bekräftat pass', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set svar_meddelande = 'Ta med boken' where id = '00000000-0000-4000-8000-000000009303'$q$],
  'nekad');
select pg_temp.prova('Svar svaret skrivs inte när studiehjälparen accepterar', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set status = 'confirmed', svar_meddelande = 'Kul'
            where id = '00000000-0000-4000-8000-000000009301'$q$],
  'nekad');

-- ---------- avslaget kräver ett svar, högst 500 tecken ----------
select pg_temp.prova('Svar avslag utan svar nekas', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set status = 'cancelled' where id = '00000000-0000-4000-8000-000000009301'$q$],
  'nekad');
select pg_temp.prova('Svar avslag med bara blanktecken nekas', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set status = 'cancelled', svar_meddelande = E'  \n\t '
            where id = '00000000-0000-4000-8000-000000009301'$q$],
  'nekad');
select pg_temp.prova('Svar avslag med 501 tecken nekas', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set status = 'cancelled', svar_meddelande = repeat('å', 501)
            where id = '00000000-0000-4000-8000-000000009301'$q$],
  'nekad');
select pg_temp.prova('Svar avslag med 500 tecken går igenom', '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set status = 'cancelled', svar_meddelande = repeat('å', 500)
            where id = '00000000-0000-4000-8000-000000009301'$q$],
  'ok');
select pg_temp.rakna_efter('Svar texten sparas som den skrevs och avslaget är inte en avbokning',
  '00000000-0000-4000-8000-0000000000a1',
  array[$q$update public.bookings set status = 'cancelled', svar_meddelande = '<script>alert(1)</script>'
            where id = '00000000-0000-4000-8000-000000009301'$q$],
  $q$select count(*) from public.bookings where id = '00000000-0000-4000-8000-000000009301'
      and svar_meddelande = '<script>alert(1)</script>' and avbokad_fran = 'requested'
      and avbokad_av = tutor_id and avbokningsskal is null$q$, 1);

do $$
declare
  a  constant uuid := '00000000-0000-4000-8000-0000000000a1';
  s1 constant uuid := '00000000-0000-4000-8000-000000009301';
  k text; n_status bigint; n_text bigint; fel text;
begin
  begin
    k := pg_temp.svar_som(a, $q$update public.bookings set status = 'cancelled', svar_meddelande = 'Hemligt om Äldst'
                               where id = '00000000-0000-4000-8000-000000009301'$q$);
    select count(*) into n_status from public.audit_logg
     where tabell = 'bookings' and objekt_id = s1::text and efter ->> 'status' = 'cancelled';
    select count(*) into n_text from public.audit_logg
     where objekt_id = s1::text and (coalesce(fore::text, '') || coalesce(efter::text, '')) like '%Hemligt%';
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Svar auditloggen', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('Svar avslaget står i auditloggen, utan texten', k = 'ok' and n_status = 1 and n_text = 0,
      k || ', statusrader: ' || n_status || ', med texten: ' || n_text),
    ('Svar notisen läser aldrig svaret',
      position('svar_meddelande' in pg_get_functiondef('public.notis_vid_pass'::regproc)) = 0, 'notis_vid_pass');
end $$;

-- ---------- motförslaget ----------
-- Familjen P föreslog s2. A svarar med en annan tid och några rader.
do $$
declare
  p  constant uuid := '00000000-0000-4000-8000-0000000000f1';
  a  constant uuid := '00000000-0000-4000-8000-0000000000a1';
  s2 constant uuid := '00000000-0000-4000-8000-000000009302';
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  k_mot text; k_familj_flytt text; k_egen_ja text; k_andra text; k_ja text; k_krock text; k_gamla text;
  mot_at timestamptz; mot_at2 timestamptz; bk public.bookings; fel text;
begin
  begin
    k_mot := pg_temp.svar_som(a, format($q$update public.bookings
        set wanted_date = %L, wanted_time = '12:00', status = 'requested', created_by = %L,
            svar_meddelande = 'Klockan 11 har jag träning. Går 12?'
      where id = %L$q$, idag + 45, a, s2));
    select motforslag_at into mot_at from public.bookings where id = s2;
    -- Familjen svarar inte med en tredje tid.
    k_familj_flytt := pg_temp.svar_som(p, format($q$update public.bookings
        set wanted_date = %L, wanted_time = '14:00', status = 'requested', created_by = %L where id = %L$q$,
      idag + 45, p, s2));
    -- Studiehjälparen bekräftar inte sitt eget motförslag.
    k_egen_ja := pg_temp.svar_som(a, format($q$update public.bookings set status = 'confirmed' where id = %L$q$, s2));
    -- Men ändrar det, innan familjen svarat.
    k_andra := pg_temp.svar_som(a, format($q$update public.bookings
        set wanted_date = %L, wanted_time = '13:00', status = 'requested', created_by = %L,
            svar_meddelande = 'Förlåt, 13 i stället.'
      where id = %L$q$, idag + 45, a, s2));
    select motforslag_at into mot_at2 from public.bookings where id = s2;
    -- Den ursprungliga tiden är ledig direkt.
    k_gamla := pg_temp.svar_som(p, format($q$insert into public.bookings (parent_id, tutor_id, student_id, created_by,
        subject, tjanst, format, antal_barn, wanted_date, wanted_time, duration_min, status)
      values (%L, %L, '00000000-0000-4000-8000-0000000005a1', %L, 'Engelska', 'laxhjalp', 'Online', 1, %L, '11:00', 60,
              'requested')$q$, p, a, p, idag + 41));
    -- Familjen säger ja.
    k_ja := pg_temp.svar_som(p, format($q$update public.bookings set status = 'confirmed' where id = %L$q$, s2));
    select * into bk from public.bookings where id = s2;
    -- Den nya tiden är upptagen.
    k_krock := pg_temp.svar_som(p, format($q$insert into public.bookings (parent_id, tutor_id, student_id, created_by,
        subject, tjanst, format, antal_barn, wanted_date, wanted_time, duration_min, status)
      values (%L, %L, '00000000-0000-4000-8000-0000000005a1', %L, 'Engelska', 'laxhjalp', 'Online', 1, %L, '13:00', 60,
              'requested')$q$, p, a, p, idag + 45));
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Svar motförslaget', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('Svar studiehjälparen föreslår en annan tid med några rader', k_mot = 'ok' and mot_at is not null, k_mot),
    ('Svar familjen svarar inte på ett motförslag med en tredje tid', k_familj_flytt = '42501', k_familj_flytt),
    ('Svar studiehjälparen bekräftar inte sitt eget motförslag', k_egen_ja = '42501', k_egen_ja),
    ('Svar studiehjälparen ändrar sitt motförslag innan familjen svarat, och det är fortfarande ett motförslag',
      k_andra = 'ok' and mot_at2 is not null, k_andra),
    ('Svar den ursprungliga tiden är ledig direkt efter motförslaget', k_gamla = 'ok', k_gamla),
    ('Svar familjen säger ja, och passet står bekräftat på den nya tiden',
      k_ja = 'ok' and bk.status = 'confirmed' and bk.wanted_date = idag + 45 and bk.wanted_time = '13:00'
      and bk.svar_meddelande = 'Förlåt, 13 i stället.',
      k_ja || ' ' || coalesce(bk.status, '') || ' ' || coalesce(bk.wanted_time, '')),
    ('Svar den nya tiden är bokad', k_krock in ('23P01', '23505'), k_krock);
end $$;

-- Två motförslag på samma tid, och ett motförslag på ett bekräftat pass.
do $$
declare
  a  constant uuid := '00000000-0000-4000-8000-0000000000a1';
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  k1 text; k2 text; k3 text; fel text;
begin
  begin
    k1 := pg_temp.svar_som(a, format($q$update public.bookings
        set wanted_date = %L, wanted_time = '14:00', status = 'requested', created_by = %L
      where id = '00000000-0000-4000-8000-000000009301'$q$, idag + 46, a));
    k2 := pg_temp.svar_som(a, format($q$update public.bookings
        set wanted_date = %L, wanted_time = '14:00', status = 'requested', created_by = %L
      where id = '00000000-0000-4000-8000-000000009302'$q$, idag + 46, a));
    -- s3 är bekräftat idag + 42 klockan 11.
    k3 := pg_temp.svar_som(a, format($q$update public.bookings
        set wanted_date = %L, wanted_time = '11:00', status = 'requested', created_by = %L
      where id = '00000000-0000-4000-8000-000000009302'$q$, idag + 42, a));
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Svar krockarna', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('Svar två motförslag på samma tid: det andra krockar', k1 = 'ok' and k2 in ('23P01', '23505'), k1 || ' ' || k2),
    ('Svar ett motförslag på ett bekräftat pass krockar', k3 in ('23P01', '23505'), k3);
end $$;

-- Studiehjälparens eget förslag s4: familjen svarar med en annan tid,
-- och då är det studiehjälparen som svarar ja eller nej.
do $$
declare
  p  constant uuid := '00000000-0000-4000-8000-0000000000f1';
  a  constant uuid := '00000000-0000-4000-8000-0000000000a1';
  s4 constant uuid := '00000000-0000-4000-8000-000000009304';
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  k_familj text; k_hjalp_flytt text; k_utan text; k_med text; mot_at timestamptz; fel text;
begin
  begin
    k_familj := pg_temp.svar_som(p, format($q$update public.bookings
        set wanted_date = %L, wanted_time = '15:00', status = 'requested', created_by = %L where id = %L$q$,
      idag + 43, p, s4));
    select motforslag_at into mot_at from public.bookings where id = s4;
    k_hjalp_flytt := pg_temp.svar_som(a, format($q$update public.bookings
        set wanted_date = %L, wanted_time = '16:00', status = 'requested', created_by = %L where id = %L$q$,
      idag + 43, a, s4));
    k_utan := pg_temp.svar_som(a, format($q$update public.bookings set status = 'cancelled' where id = %L$q$, s4));
    k_med := pg_temp.svar_som(a, format($q$update public.bookings set status = 'cancelled',
        svar_meddelande = 'Den dagen är jag bortrest.' where id = %L$q$, s4));
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Svar familjens motförslag', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('Svar familjen svarar på studiehjälparens förslag med en annan tid', k_familj = 'ok' and mot_at is not null, k_familj),
    ('Svar studiehjälparen svarar inte på familjens motförslag med en tredje tid', k_hjalp_flytt = '42501', k_hjalp_flytt),
    ('Svar studiehjälparen avslår familjens motförslag bara med ett svar', k_utan = '42501' and k_med = 'ok',
      k_utan || ' ' || k_med);
end $$;

-- Kortpengar på passet: nej går inte härifrån, så ett motförslag får
-- en ny tid som svar.
select pg_temp.prova_med('Svar ett motförslag på ett kortbetalt pass får besvaras med en ny tid',
  array[$q$update public.bookings set wanted_date = (now() at time zone 'Europe/Stockholm')::date + 47,
            wanted_time = '11:00', created_by = '00000000-0000-4000-8000-0000000000a1'
            where id = '00000000-0000-4000-8000-000000009302'$q$,
        $q$update public.bookings set betalning_status = 'betald', betalt_ore = 37900, betald_at = now(),
            stripe_payment_intent_id = 'pi_rls_svar' where id = '00000000-0000-4000-8000-000000009302'$q$],
  '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.bookings set wanted_date = (now() at time zone 'Europe/Stockholm')::date + 47,
            wanted_time = '15:00', status = 'requested', created_by = '00000000-0000-4000-8000-0000000000f1'
            where id = '00000000-0000-4000-8000-000000009302'$q$],
  'ok');

-- Ett bekräftat pass som flyttas är ett nytt förslag, och ett gammalt
-- svar hör till en tid som inte gäller.
do $$
declare
  p  constant uuid := '00000000-0000-4000-8000-0000000000f1';
  s3 constant uuid := '00000000-0000-4000-8000-000000009303';
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  k text; bk public.bookings; fel text;
begin
  begin
    update public.bookings set svar_meddelande = 'Gammalt svar', motforslag_at = now() where id = s3;
    k := pg_temp.svar_som(p, format($q$update public.bookings
        set wanted_date = %L, wanted_time = '16:00', status = 'requested', created_by = %L where id = %L$q$,
      idag + 47, p, s3));
    select * into bk from public.bookings where id = s3;
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Svar ett flyttat pass', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('Svar ett bekräftat pass som flyttas blir ett nytt förslag utan gammalt svar',
      k = 'ok' and bk.status = 'requested' and bk.svar_meddelande is null and bk.motforslag_at is null,
      k || ' ' || coalesce(bk.svar_meddelande, 'inget svar'));
end $$;

-- ---------- månadslåset ----------
do $$
declare
  adm constant uuid := '00000000-0000-4000-8000-0000000000ad';
  s3  constant uuid := '00000000-0000-4000-8000-000000009303';
  dag date := (date_trunc('month', (now() at time zone 'Europe/Stockholm')) - interval '4 months')::date + 11;
  k_tom text; k_byt text; fel text;
begin
  begin
    -- Två satser: ett bekräftat pass som flyttas tappar sitt svar (stampla_avbokningen).
    update public.bookings set wanted_date = dag where id = s3;
    update public.bookings set svar_meddelande = 'Svar i en stängd månad' where id = s3;
    insert into public.manadsbokslut (manad, stangd, stangd_at) values (date_trunc('month', dag)::date, true, now());
    k_byt := pg_temp.svar_som(adm, format($q$update public.bookings set svar_meddelande = 'Ett annat svar' where id = %L$q$, s3));
    k_tom := pg_temp.svar_som(adm, format($q$update public.bookings set svar_meddelande = null where id = %L$q$, s3));
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Svar månadslåset', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('Svar i en stängd månad går svaret att tömma men inte ändra', k_byt = '42501' and k_tom = 'ok',
      k_byt || ' ' || k_tom);
end $$;

-- ---------- gallringen ----------
do $$
declare
  s1 constant uuid := '00000000-0000-4000-8000-000000009301';
  s2 constant uuid := '00000000-0000-4000-8000-000000009302';
  s3 constant uuid := '00000000-0000-4000-8000-000000009303';
  s4 constant uuid := '00000000-0000-4000-8000-000000009304';
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  fore_rader jsonb; efter_rader jsonb; n integer; n_rader bigint; t1 text; t2 text; t3 text; fel text;
begin
  begin
    -- s1: avslaget för 31 dagar sedan. s2: för 29 dagar sedan.
    -- s3: ett motförslag som blev ett pass för 31 dagar sedan.
    update public.bookings set status = 'cancelled', svar_meddelande = 'Gammalt nej' where id = s1;
    update public.bookings set avbokad_at = now() - interval '31 days' where id = s1;
    update public.bookings set status = 'cancelled', svar_meddelande = 'Nytt nej' where id = s2;
    update public.bookings set avbokad_at = now() - interval '29 days' where id = s2;
    update public.bookings set wanted_date = idag - 31 where id = s3;
    update public.bookings set svar_meddelande = 'Går 12?' where id = s3;
    select jsonb_object_agg(id, to_jsonb(b) - 'svar_meddelande') into fore_rader
      from public.bookings b where id in (s1, s2, s3, s4);
    n := intern.svar_gallra();
    select jsonb_object_agg(id, to_jsonb(b) - 'svar_meddelande') into efter_rader
      from public.bookings b where id in (s1, s2, s3, s4);
    select count(*) into n_rader from public.bookings where id in (s1, s2, s3, s4);
    select svar_meddelande into t1 from public.bookings where id = s1;
    select svar_meddelande into t2 from public.bookings where id = s2;
    select svar_meddelande into t3 from public.bookings where id = s3;
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Svar gallringen', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('Svar gallringen tömmer svaret 30 dagar efter avslaget och passet',
      n = 2 and t1 is null and t3 is null, 'tömda: ' || n),
    ('Svar gallringen rör inte ett svar som är yngre', t2 = 'Nytt nej', coalesce(t2, 'tomt')),
    ('Svar gallringen tar inte bort några pass och ändrar inget annat',
      n_rader = 4 and fore_rader = efter_rader, 'rader: ' || n_rader);
end $$;

select pg_temp.prova('Svar familjen kör inte gallringen', '00000000-0000-4000-8000-0000000000f1',
  array['select intern.svar_gallra()'], 'nekad');
select pg_temp.prova('Svar studiehjälparen kör inte gallringen', '00000000-0000-4000-8000-0000000000a1',
  array['select intern.svar_gallra()'], 'nekad');
select pg_temp.prova('Svar anon kör inte gallringen', null,
  array['select intern.svar_gallra()'], 'nekad');
insert into utfall (test, ok, detalj)
select 'Svar gallringen är schemalagd varje natt', count(*) = 1, 'jobb: ' || count(*)
  from cron.job where jobname = 'svar-gallring' and active and command = 'select intern.svar_gallra()';

-- ============================================================
-- TIPSKODER OCH KAMPANJKODER (2026-09-30)
--
-- En kod per familj och godkänd studiehjälpare, skapad av mina_tips(),
-- och kampanjkoder som admin skapar. Koden följer med anmälan, och en
-- okänd kod fäller aldrig anmälan. Familjen som tipsat får en timme
-- på köpet per ny familj som haft sitt första pass: samma rabatt som
-- prissidans första timme, märkt rabattkod 'TIPS'.
-- ============================================================

select pg_temp.prova('Tips anon läser inga koder', null,
  array['select * from public.tipskoder'], 'nekad');
select pg_temp.prova('Tips anon får ingen kod', null,
  array['select public.mina_tips()'], 'nekad');
select pg_temp.prova('Tips familjen ser inte adminens lista', '00000000-0000-4000-8000-0000000000f1',
  array['select * from public.tipskoder_lage()'], 'nekad');
select pg_temp.prova('Tips familjen skapar ingen kampanjkod', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.tipskoder (kod, sort, namn) values ('RLS-FAMILJ', 'kampanj', 'Prov')$q$], 'nekad');
select pg_temp.prova('Tips familjen skapar ingen personkod åt sig själv', '00000000-0000-4000-8000-0000000000f1',
  array[$q$insert into public.tipskoder (kod, sort, person_id) values ('RLS-EGEN', 'familj', '00000000-0000-4000-8000-0000000000f1')$q$], 'nekad');
select pg_temp.prova('Tips admin skapar en kampanjkod', '00000000-0000-4000-8000-0000000000ad',
  array[$q$insert into public.tipskoder (kod, sort, namn) values ('RLS-AFFISCH', 'kampanj', 'Prov affisch')$q$], 'ok');
select pg_temp.prova('Tips admin skapar ingen personkod i någons namn', '00000000-0000-4000-8000-0000000000ad',
  array[$q$insert into public.tipskoder (kod, sort, person_id) values ('RLS-ANNAN', 'familj', '00000000-0000-4000-8000-0000000000f2')$q$], 'nekad');

-- 'TIPS' är markeringen på ett pass med tipstimmen. Raden finns i
-- rabattkoder (bookings.rabattkod pekar dit) och kan aldrig slås på:
-- då hade en familj kunnat skriva in den själv.
do $$
declare v_fel text := 'gick igenom'; v_aktiv boolean;
begin
  select r.aktiv into v_aktiv from public.rabattkoder r where r.kod = 'TIPS';
  begin
    update public.rabattkoder r set aktiv = true where r.kod = 'TIPS';
    raise exception 'rulla tillbaka';
  exception
    when check_violation then v_fel := sqlstate;
    when others then if sqlerrm <> 'rulla tillbaka' then v_fel := sqlstate; end if;
  end;
  insert into utfall (test, ok, detalj) values
    ('Tips markeringen TIPS finns som avstängd rabattkod', v_aktiv is false, coalesce(v_aktiv::text, 'saknas')),
    ('Tips markeringen TIPS går inte att slå på', v_fel = '23514', v_fel);
end $$;

-- ---------- koden, läsningen och anmälan ----------
do $$
declare
  p   constant uuid := '00000000-0000-4000-8000-0000000000f1';
  a   constant uuid := '00000000-0000-4000-8000-0000000000a1';
  b   constant uuid := '00000000-0000-4000-8000-0000000000b1';
  adm constant uuid := '00000000-0000-4000-8000-0000000000ad';
  l1  constant uuid := '00000000-0000-4000-8000-00000000d101';
  l2  constant uuid := '00000000-0000-4000-8000-00000000d102';
  l3  constant uuid := '00000000-0000-4000-8000-00000000d103';
  l4  constant uuid := '00000000-0000-4000-8000-00000000d104';
  jp jsonb; jp2 jsonb; ja jsonb; k_b text; n_p bigint; n_a bigint; n_adm bigint;
  u_p text; kod1 text; kod2 text; kod3 text; kod4 text; lage bigint; fel text;
begin
  begin
    perform pg_temp.bli(p);
    jp := public.mina_tips();
    jp2 := public.mina_tips();
    select count(*) into n_p from public.tipskoder;
    perform pg_temp.bli(a);
    ja := public.mina_tips();
    select count(*) into n_a from public.tipskoder;
    reset role;
    perform set_config('request.jwt.claims', '', true);

    u_p := pg_temp.svar_som(p, format($q$update public.tipskoder set aktiv = false where kod = %L$q$, jp->>'kod'));

    update public.tutor_profiles set status = 'pending' where id = b;
    k_b := pg_temp.svar_som(b, 'select public.mina_tips()');

    perform pg_temp.bli(adm);
    select count(*) into n_adm from public.tipskoder;
    insert into public.tipskoder (kod, sort, namn, aktiv) values ('RLS-AV', 'kampanj', 'Avstängd affisch', false);
    select count(*) into lage from public.tipskoder_lage();
    reset role;
    perform set_config('request.jwt.claims', '', true);

    -- Anon skickar anmälningar: koden med gemener och mellanslag, en
    -- kod som inte finns, en avstängd kod och skräp.
    perform pg_temp.bli(null);
    insert into public.leads (id, parent_name, email, kod)
    values (l1, 'Tips Ett', 'tips-ett@example.invalid', ' ' || lower(jp->>'kod') || ' ');
    insert into public.leads (id, parent_name, email, kod)
    values (l2, 'Tips Två', 'tips-tva@example.invalid', 'FINNS-INTE');
    insert into public.leads (id, parent_name, email, kod)
    values (l3, 'Tips Tre', 'tips-tre@example.invalid', 'RLS-AV');
    insert into public.leads (id, parent_name, email, kod)
    values (l4, 'Tips Fyra', 'tips-fyra@example.invalid', '<script>');
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select kod into kod1 from public.leads where id = l1;
    select kod into kod2 from public.leads where id = l2;
    select kod into kod3 from public.leads where id = l3;
    select kod into kod4 from public.leads where id = l4;
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Tips koden och anmälan', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('Tips familjen får en kod med sex tecken', jp->>'kod' ~ '^[A-HJ-NP-Z2-9]{6}$' and jp->>'sort' = 'familj',
      coalesce(jp::text, 'inget svar')),
    ('Tips samma kod andra gången', jp->>'kod' = jp2->>'kod', coalesce(jp2->>'kod', 'ingen')),
    ('Tips familjen räknas från noll',
      (jp->>'anmalda')::int = 0 and (jp->>'kvar')::int = 0 and (jp->>'timme_ges')::boolean,
      coalesce(jp::text, 'inget svar')),
    ('Tips familjen ser bara sin egen kod', n_p = 1, 'rader: ' || n_p),
    ('Tips studiehjälparen får en kod utan timmar',
      ja->>'sort' = 'studiehjalpare' and ja->'timmar' = 'null'::jsonb and n_a = 1,
      coalesce(ja::text, 'inget svar')),
    ('Tips familjen stänger inte av sin kod själv', u_p = 'noll', u_p),
    ('Tips en studiehjälpare som inte är godkänd får ingen kod', k_b = '42501', k_b),
    ('Tips admin ser alla koder', n_adm >= 2 and lage = n_adm + 1, n_adm || ' och ' || lage),
    ('Tips koden sparas med versaler och utan mellanslag', kod1 = jp->>'kod', coalesce(kod1, 'null')),
    ('Tips en kod som inte finns fäller inte anmälan', kod2 is null, coalesce(kod2, 'null')),
    ('Tips en avstängd kod följer inte med', kod3 is null, coalesce(kod3, 'null')),
    ('Tips skräp i kodfältet blir null', kod4 is null, coalesce(kod4, 'null'));
end $$;

-- ---------- timmen på köpet ----------
--
-- Familj Q anmäler sig med familj P:s kod, blir kund och har sitt
-- första pass. P:s nästa förslag får en timme bjuden och nästa pass
-- efter det fullt pris. Avböjs passet med timmen kommer den tillbaka.
-- Q är ny i fixturerna (Fas 19.5 räknar med samma sak). Erbjudandena
-- slås på, så att det syns att köpta timmar inte betalar passet.
do $$
declare
  p   constant uuid := '00000000-0000-4000-8000-0000000000f1';
  q   constant uuid := '00000000-0000-4000-8000-0000000000f2';
  a   constant uuid := '00000000-0000-4000-8000-0000000000a1';
  sp  constant uuid := '00000000-0000-4000-8000-0000000005a1';
  sq  constant uuid := '00000000-0000-4000-8000-0000000005c1';
  lq  constant uuid := '00000000-0000-4000-8000-00000000d1a1';
  qb  constant uuid := '00000000-0000-4000-8000-00000000d1b1';
  pb0 constant uuid := '00000000-0000-4000-8000-00000000d1c0';
  pb1 constant uuid := '00000000-0000-4000-8000-00000000d1c1';
  pb2 constant uuid := '00000000-0000-4000-8000-00000000d1c2';
  pb3 constant uuid := '00000000-0000-4000-8000-00000000d1c3';
  pb4 constant uuid := '00000000-0000-4000-8000-00000000d1c4';
  idag date := (now() at time zone 'Europe/Stockholm')::date;
  jp jsonb; j1 jsonb; j2 jsonb; fore_ny int; efter_gammal int; efter_stangd int;
  r1 record; r2 record; r3 record; r4 record; fal record;
  k_forfalska text; k_andra text; kod_efter text; fel text;
begin
  begin
    -- Prissidans första timme går före tipstimmen. P har redan fått
    -- den i fixturerna, eller får den här.
    if not exists (select 1 from public.bookings where parent_id = p and startrabatt and status <> 'cancelled') then
      update public.bookings set startrabatt = true where id = '00000000-0000-4000-8000-00000000b0e1';
    end if;

    perform pg_temp.bli(p);
    jp := public.mina_tips();
    reset role;
    perform set_config('request.jwt.claims', '', true);

    -- Utan intjänad timme: en familj kan inte märka sitt eget pass.
    k_forfalska := pg_temp.svar_som(p, format($q$insert into public.bookings
        (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status, rabattkod, rabatt_ore)
        values (%L, %L, %L, %L, %L, %L, '13:00', 60, 'requested', 'TIPS', 37900)$q$,
      pb0, p, a, sp, p, idag + 74));
    select rabattkod, rabatt_ore, startrabatt into fal from public.bookings where id = pb0;
    delete from public.bookings where id = pb0;

    -- Q anmäler sig med koden, blir kund och har ett hållet pass.
    perform pg_temp.bli(null);
    insert into public.leads (id, parent_name, email, kod)
    values (lq, 'Test Familj Q', 'rls-q@example.invalid', jp->>'kod');
    reset role;
    perform set_config('request.jwt.claims', '', true);
    update public.leads set kund_id = q where id = lq;
    update public.students set matched_tutor_id = a, match_status = 'matched' where id = sq;
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status)
    values (qb, q, a, sq, q, idag - 2, '12:00', 60, 'confirmed');
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
    values (sq, a, qb, 'fixtur', idag - 2, 'narvarande');

    -- Anmälan står på i dag och passet hölls i förrgår: Q hade redan
    -- haft pass när koden skickades, och det ger ingen timme.
    efter_gammal := intern.tipstimmar_intjanade(p);
    -- Anmälan kom före passet: Q var ny.
    update public.leads set created_at = now() - interval '10 days' where id = lq;
    fore_ny := intern.tipstimmar_intjanade(p);

    update public.flaggor set aktiv = true where kod = 'erbjudanden';

    -- P föreslår två pass. Det första får timmen, det andra inte.
    perform pg_temp.bli(p);
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status)
    values (pb1, p, a, sp, p, idag + 70, '13:00', 120, 'requested');
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status)
    values (pb2, p, a, sp, p, idag + 71, '13:00', 60, 'requested');
    j1 := public.mina_tips();
    reset role;
    perform set_config('request.jwt.claims', '', true);
    k_andra := pg_temp.svar_som(p, format($q$update public.bookings set rabattkod = null where id = %L$q$, pb1));
    select startrabatt, rabattkod, rabatt_ore, timpris_ore, klippkort_id into r1 from public.bookings where id = pb1;
    select startrabatt, rabattkod, rabatt_ore, klippkort_id into r2 from public.bookings where id = pb2;

    -- Passet med timmen avböjs: timmen kommer tillbaka och går till nästa.
    update public.bookings set status = 'cancelled' where id = pb1;
    perform pg_temp.bli(p);
    j2 := public.mina_tips();
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status)
    values (pb3, p, a, sp, p, idag + 72, '13:00', 60, 'requested');
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select startrabatt, rabattkod, rabatt_ore, timpris_ore into r3 from public.bookings where id = pb3;

    -- Med flaggan av ges det som tjänats in innan den stängdes.
    update public.bookings set status = 'cancelled' where id = pb3;
    update public.flaggor set aktiv = false where kod = 'tipstimme';
    perform pg_temp.bli(p);
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status)
    values (pb4, p, a, sp, p, idag + 73, '13:00', 60, 'requested');
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select startrabatt, rabattkod, rabatt_ore into r4 from public.bookings where id = pb4;
    -- Stängdes den innan Q:s första pass räknas Q inte. stampla_flaggan
    -- sätter alltid uppdaterad till nu, så den stängs av en stund.
    alter table public.flaggor disable trigger flaggor_stampla;
    update public.flaggor set uppdaterad = now() - interval '5 days' where kod = 'tipstimme';
    alter table public.flaggor enable trigger flaggor_stampla;
    efter_stangd := intern.tipstimmar_intjanade(p);

    -- P avidentifieras: koden försvinner, och anmälan tappar den.
    update public.profiles set raderad_at = now() where id = p;
    select kod into kod_efter from public.leads where id = lq;
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Tips timmen på köpet', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('Tips familjen märker inte ett eget pass som tipstimme',
      k_forfalska = 'ok' and fal.rabattkod is null and fal.rabatt_ore is null and not fal.startrabatt,
      k_forfalska || ' ' || coalesce(fal.rabattkod, 'null') || '/' || coalesce(fal.rabatt_ore::text, 'null')),
    ('Tips en familj som redan haft pass ger ingen timme', efter_gammal = 0, efter_gammal::text),
    ('Tips en ny familj som haft sitt första pass ger en timme', fore_ny = 1, fore_ny::text),
    ('Tips nästa förslag får en timme bjuden',
      r1.startrabatt and r1.rabattkod = 'TIPS' and r1.rabatt_ore = r1.timpris_ore,
      r1.startrabatt || ' ' || coalesce(r1.rabattkod, 'null') || '/' || coalesce(r1.rabatt_ore::text, 'null')),
    ('Tips köpta timmar betalar inte passet med timmen', r1.klippkort_id is null,
      coalesce(r1.klippkort_id::text, 'null')),
    ('Tips en timme per familj, och nästa pass betalas som vanligt',
      not r2.startrabatt and r2.rabattkod is null and r2.rabatt_ore is null and r2.klippkort_id is not null,
      r2.startrabatt || ' ' || coalesce(r2.rabattkod, 'null') || ' kort ' || coalesce(r2.klippkort_id::text, 'null')),
    ('Tips vyn ser att timmen är använd', (j1->>'timmar')::int = 1 and (j1->>'kvar')::int = 0
      and (j1->>'anmalda')::int = 1 and (j1->>'kunder')::int = 1, coalesce(j1::text, 'inget svar')),
    ('Tips familjen tar inte bort markeringen', k_andra = '42501', k_andra),
    ('Tips ett avböjt pass lämnar tillbaka timmen', (j2->>'kvar')::int = 1, coalesce(j2::text, 'inget svar')),
    ('Tips timmen går till nästa pass', r3.startrabatt and r3.rabattkod = 'TIPS' and r3.rabatt_ore = r3.timpris_ore,
      r3.startrabatt || ' ' || coalesce(r3.rabattkod, 'null')),
    ('Tips med flaggan av ges timmen som redan tjänats in', r4.startrabatt and r4.rabattkod = 'TIPS',
      r4.startrabatt || ' ' || coalesce(r4.rabattkod, 'null')),
    ('Tips med flaggan av räknas inte en familj vars första pass kom efter', efter_stangd = 0,
      efter_stangd::text),
    ('Tips en raderad familjs kod försvinner ur anmälan', kod_efter is null, coalesce(kod_efter, 'null'));
end $$;

-- ============================================================
-- BARNKONTON OCH ADMIN MED BEHÖRIGHETER (barnkonton_och_admin)
--
-- Barnet provas som PostgREST provar det: rollen nextrum_barn och
-- token med app_metadata (roll, barn_id, forald_id). Två barnkonton:
-- Äldst i familj P och Annan familj i familj Q. Yngst (familj P) har
-- ingen inloggning. Fyra begränsade admins och två blivande.
--
-- Fixturerna står i huvudtransaktionen, sist i filen: inget prov
-- efter dem kan se dem. Varje prov rullas tillbaka.
-- ============================================================

reset role;
select set_config('request.jwt.claims', null, true);

-- Ett barnkonto skapas bara genom ett skapandefönster för just sitt id
-- (barnkonto_skapas_genom_auth), som barn-konto öppnar. Tiden tas ur
-- klockan: now() står still hela sviten, och fönstret prövas mot
-- clock_timestamp(). I ett block: före rättelsen finns inte kolumnerna,
-- och då skapas kontona som förut.
create function pg_temp.skapandefonster(p_barn uuid, p_konto uuid, p_namn text, p_alder interval default '0 seconds')
returns void language plpgsql as $$
declare
  t timestamptz := clock_timestamp() - p_alder;
begin
  insert into public.barn_andringsfonster (barn_id, andring, user_id, anvandarnamn, skapad, giltig_till)
  values (p_barn, 'skapa', p_konto, p_namn, t, t + interval '60 seconds');
end $$;

do $$
begin
  perform pg_temp.skapandefonster('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000bc0c1', 'aldst.p');
  perform pg_temp.skapandefonster('00000000-0000-4000-8000-0000000005c1', '00000000-0000-4000-8000-0000000bc0c2', 'annan.q');
exception when others then
  raise notice 'skapandefönstret: %', sqlerrm;
end $$;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000bc0c1', 'aldst.p@barn.nextrum.se',
   '{"provider":"email","roll":"barn","barn_id":"00000000-0000-4000-8000-0000000005a1","forald_id":"00000000-0000-4000-8000-0000000000f1"}',
   '{"role":"tutor","full_name":"Försök till studiehjälpare"}'),
  ('00000000-0000-4000-8000-0000000bc0c2', 'annan.q@barn.nextrum.se',
   '{"roll":"barn","barn_id":"00000000-0000-4000-8000-0000000005c1","forald_id":"00000000-0000-4000-8000-0000000000f2"}',
   '{}');

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000bcad1', 'rls-l1@example.invalid', '{"full_name":"Test Leads"}'),
  ('00000000-0000-4000-8000-0000000bcad2', 'rls-l2@example.invalid', '{"full_name":"Test Hanterar"}'),
  ('00000000-0000-4000-8000-0000000bcad3', 'rls-l3@example.invalid', '{"full_name":"Test Matchar"}'),
  ('00000000-0000-4000-8000-0000000bcad4', 'rls-l4@example.invalid', '{"full_name":"Test Notiser"}'),
  ('00000000-0000-4000-8000-0000000bcad5', 'rls-s2@example.invalid', '{"full_name":"Test Blivande Super"}'),
  ('00000000-0000-4000-8000-0000000bcad6', 'rls-t6@example.invalid', '{"full_name":"Test Blivande"}');

-- I ett block: körs filen före migrationen finns inte admin_roller, och
-- då ska raderna nedan bli röda i stället för att hela körningen faller.
do $$
begin
  insert into public.admin_roller (user_id, behorigheter) values
    ('00000000-0000-4000-8000-0000000bcad1', '{leads}'),
    ('00000000-0000-4000-8000-0000000bcad2', '{admin_hantera,leads}'),
    ('00000000-0000-4000-8000-0000000bcad3', '{matchning,anvandare_las}'),
    ('00000000-0000-4000-8000-0000000bcad4', '{notiskonfig}');
exception when others then
  raise notice 'admin_roller: %', sqlerrm;
end $$;

insert into public.leads (id, parent_name, email, child_name, grade, subject, tjanst, message)
values ('00000000-0000-4000-8000-0000000bc1e1', 'Test Anmälan', 'rls-anmalan@example.invalid', 'Barn', 'Åk 5',
        'Matte', 'laxhjalp', 'Hej');

-- Kör p_forst som postgres och p_sql som barnet; svaret är sista satsens
-- värde som text, eller "FEL <kod>: <text>". Allt rullas tillbaka.
create function pg_temp.som_barn(p_uid uuid, p_barn uuid, p_forald uuid, p_forst text[], p_sql text)
returns text language plpgsql as $$
declare
  ut  text;
  fel text;
  kod text;
  det text;
  s   text;
begin
  begin
    foreach s in array coalesce(p_forst, '{}') loop
      execute s;
    end loop;
    perform set_config('request.jwt.claims', json_build_object(
      'sub', p_uid, 'role', 'nextrum_barn',
      'app_metadata', json_build_object('roll', 'barn', 'barn_id', p_barn, 'forald_id', p_forald))::text, true);
    execute 'set local role nextrum_barn';
    execute p_sql into ut;
    raise exception using message = 'SOM_KLAR', detail = coalesce(ut, '<null>');
  exception when others then
    get stacked diagnostics fel = message_text, kod = returned_sqlstate, det = pg_exception_detail;
  end;
  if fel = 'SOM_KLAR' then
    return det;
  end if;
  return 'FEL ' || kod || ': ' || fel;
end $$;

-- Samma sak för en inloggad (authenticated), eller för systemet med null.
create function pg_temp.som(p_uid uuid, p_forst text[], p_sql text)
returns text language plpgsql as $$
declare
  ut  text;
  fel text;
  kod text;
  det text;
  s   text;
begin
  begin
    foreach s in array coalesce(p_forst, '{}') loop
      execute s;
    end loop;
    if p_uid is not null then
      perform pg_temp.bli(p_uid);
    end if;
    execute p_sql into ut;
    raise exception using message = 'SOM_KLAR', detail = coalesce(ut, '<null>');
  exception when others then
    get stacked diagnostics fel = message_text, kod = returned_sqlstate, det = pg_exception_detail;
  end;
  if fel = 'SOM_KLAR' then
    return det;
  end if;
  return 'FEL ' || kod || ': ' || fel;
end $$;

-- Svaret som jsonb, eller null när det var ett fel: ett felsvar som
-- tolkas som json hade fällt hela körningen, inte bara provet.
create function pg_temp.j(t text) returns jsonb language plpgsql immutable as $$
begin
  return t::jsonb;
exception when others then
  return null;
end $$;

create function pg_temp.i(t text) returns bigint language plpgsql immutable as $$
begin
  return t::bigint;
exception when others then
  return null;
end $$;

reset role;
select set_config('request.jwt.claims', null, true);

-- ------------------------------------------------------------
-- 1. Kontot: rollen, ingen profil, kopplingen
-- ------------------------------------------------------------
insert into utfall (test, ok, detalj)
select 'Barn: kontot får rollen nextrum_barn', coalesce(role = 'nextrum_barn', false), coalesce(role, 'inget konto')
  from auth.users where id = '00000000-0000-4000-8000-0000000bc0c1'
union all
select 'Barn: kontot får ingen profil och ingen studiehjälparprofil',
       not exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-0000000bc0c1')
       and not exists (select 1 from public.tutor_profiles where id = '00000000-0000-4000-8000-0000000bc0c1'),
       'user_metadata bad om rollen tutor'
union all
select 'Barn: kontot kopplas till barnet med användarnamn och godkännande', r = 'true', r
  from (select pg_temp.som(null, null,
          $q$select (user_id = '00000000-0000-4000-8000-0000000bc0c1' and anvandarnamn = 'aldst.p'
                     and barn_aktiv and not visa_rapporter and vardnadshavare_godkand_at is not null)::text
               from public.students where id = '00000000-0000-4000-8000-0000000005a1'$q$) r) x;

-- ------------------------------------------------------------
-- 2. Barnet når ingenting direkt. Loopen tar varje tabell och vy i
--    public, så att en tabell som läggs till i morgon provas av sig själv.
-- ------------------------------------------------------------
do $$
declare
  t       record;
  s       text;
  lackor  text[] := '{}';
  prov    integer := 0;
  fel     text;
  kod     text;
  n       bigint;
  forsta  text;
begin
  if not exists (select 1 from pg_roles where rolname = 'nextrum_barn') then
    insert into utfall (test, ok, detalj) values
      ('Barn: ingen tabell eller vy i public går att läsa eller skriva (loop)', false, 'rollen nextrum_barn finns inte');
    return;
  end if;
  for t in
    select c.relname, c.relkind
      from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
     where ns.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p', 'f')
     order by c.relname
  loop
    select a.attname into forsta from pg_attribute a
     where a.attrelid = format('public.%I', t.relname)::regclass and a.attnum > 0 and not a.attisdropped
     order by a.attnum limit 1;
    foreach s in array array[
      format('select 1 from public.%I', t.relname),
      format('insert into public.%I default values', t.relname),
      format('update public.%I set %I = %I', t.relname, forsta, forsta),
      format('delete from public.%I', t.relname)]
    loop
      prov := prov + 1;
      n := 0;
      begin
        perform set_config('request.jwt.claims', json_build_object(
          'sub', '00000000-0000-4000-8000-0000000bc0c1', 'role', 'nextrum_barn',
          'app_metadata', json_build_object('roll', 'barn',
            'barn_id', '00000000-0000-4000-8000-0000000005a1',
            'forald_id', '00000000-0000-4000-8000-0000000000f1'))::text, true);
        execute 'set local role nextrum_barn';
        execute s;
        get diagnostics n = row_count;
        raise exception using message = 'PROVA_KLAR:' || n;
      exception when others then
        get stacked diagnostics fel = message_text, kod = returned_sqlstate;
      end;
      -- Ett läckage är en sats som gick igenom och gav eller rörde rader.
      -- Ett fel av annat slag (en vy som inte går att skriva, en
      -- identitetskolumn) är ingen väg in; att rollen saknar rättigheter
      -- helt provas för sig nedan.
      if fel like 'PROVA_KLAR:%' and fel <> 'PROVA_KLAR:0' then
        lackor := lackor || (s || ' → ' || coalesce(kod, '') || ' ' || coalesce(fel, ''));
      end if;
    end loop;
  end loop;
  reset role;
  perform set_config('request.jwt.claims', null, true);

  insert into utfall (test, ok, detalj) values
    ('Barn: ingen tabell eller vy i public går att läsa eller skriva (loop)', cardinality(lackor) = 0,
     case when cardinality(lackor) = 0 then prov || ' satser prövade, ingen gav eller rörde en rad'
          else array_to_string(lackor[1:5], ' | ') end);
end $$;

reset role;
select set_config('request.jwt.claims', null, true);

insert into utfall (test, ok, detalj)
select 'Barn: rollen har ingen rättighet på någon relation i public eller storage', r = 'inga', r
  from (select pg_temp.som(null, null,
          $q$select coalesce(string_agg(n.nspname || '.' || c.relname, ', '), 'inga')
               from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname in ('public', 'storage') and c.relkind in ('r', 'v', 'm', 'p', 'f')
                and (has_table_privilege('nextrum_barn', c.oid, 'select') or has_table_privilege('nextrum_barn', c.oid, 'insert')
                     or has_table_privilege('nextrum_barn', c.oid, 'update') or has_table_privilege('nextrum_barn', c.oid, 'delete'))$q$) r) x;

-- Barnet kan köra en SECURITY DEFINER-funktion bara om den är en av
-- barnets egna, en av NexLäx-funktionerna som prövar barnet själva
-- (nexlax_for_barnet, avsnitt 14), eller en av hjälparna som bara svarar
-- om auth.uid() själv. En ny funktion som glömt sitt revoke från PUBLIC
-- fångas här.
insert into utfall (test, ok, detalj)
select 'Barn: kör bara sina egna funktioner bland SECURITY DEFINER', r = 'inga', r
  from (select pg_temp.som(null, null,
          $q$select coalesce(string_agg(p.oid::regprocedure::text, ', '), 'inga')
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
                and has_function_privilege('nextrum_barn', p.oid, 'execute')
                and p.proname not in ('barn_oversikt', 'barn_notiser', 'barn_markera_last',
                                      'barn_nexlax', 'barn_uppgift',
                                      -- barnets_epost: inställningarna, valen och länken
                                      -- i bekräftelsemejlet (den är öppen för alla).
                                      'barn_installningar', 'barn_notisval', 'barn_epost_bekrafta',
                                      'niva_starta', 'niva_svara', 'niva_genomgang', 'nexlax_lage',
                                      -- Fel i en fråga (nexlax_felrapporter, 2026-10-06).
                                      'rapportera_fragefel',
                                      -- Tråden med studiehjälparen (barnets_chatt, 2026-10-06).
                                      'barn_chatt', 'barn_chatt_last', 'barn_chatt_skriv',
                                      'ar_matchade', 'ar_min_elev', 'is_admin', 'is_matched_tutor_of',
                                      'is_my_matched_tutor', 'is_my_student')$q$) r) x;

insert into utfall (test, ok, detalj)
select 'Barn: rabattkoderna går inte att pröva', r = 'false|true|true', r
  from (select pg_temp.som(null, null,
          $q$select has_function_privilege('nextrum_barn', 'public.kolla_rabattkod(text, text, bigint)'::regprocedure, 'execute')::text
                    || '|' || has_function_privilege('anon', 'public.kolla_rabattkod(text, text, bigint)'::regprocedure, 'execute')::text
                    || '|' || has_function_privilege('authenticated', 'public.kolla_rabattkod(text, text, bigint)'::regprocedure, 'execute')::text$q$) r) x;

-- ------------------------------------------------------------
-- 3. barn_oversikt
-- ------------------------------------------------------------
insert into utfall (test, ok, detalj)
select 'Barn: översikten är barnets egen', (pg_temp.j(r) ->> 'lage') = 'ok' and (pg_temp.j(r) ->> 'fornamn') = 'Äldst'
       and (pg_temp.j(r) ->> 'studiehjalpare') = 'Test', left(r, 200)
  from (select pg_temp.som_barn('00000000-0000-4000-8000-0000000bc0c1', '00000000-0000-4000-8000-0000000005a1',
          '00000000-0000-4000-8000-0000000000f1', null, 'select public.barn_oversikt()::text') r) x
union all
select 'Barn: översikten bär inget om föräldern, priser eller syskon',
       r not like 'FEL%' and r not like '%rls-p@%' and r not like '%Familj%' and r not like '%Yngst%'
       and r not like '%Annan familj%' and r not like '%_ore%' and r not like '%pris%'
       and r not like '%betal%' and r not like '%telefon%' and r not like '%phone%', left(r, 200)
  from (select pg_temp.som_barn('00000000-0000-4000-8000-0000000bc0c1', '00000000-0000-4000-8000-0000000005a1',
          '00000000-0000-4000-8000-0000000000f1', null, 'select public.barn_oversikt()::text') r) x
union all
select 'Barn: kommande och genomförda pass, timmar och studieplan finns',
       pg_temp.j(r) ? 'kommande' and jsonb_array_length(pg_temp.j(r) -> 'kommande') >= 1
       and jsonb_array_length(pg_temp.j(r) -> 'genomforda') >= 1
       and (pg_temp.j(r) -> 'timmar' ->> 'genomforda')::numeric > 0 and pg_temp.j(r) ? 'studieplan', left(r, 200)
  from (select pg_temp.som_barn('00000000-0000-4000-8000-0000000bc0c1', '00000000-0000-4000-8000-0000000005a1',
          '00000000-0000-4000-8000-0000000000f1',
          array[$q$insert into public.study_plans (student_id, tutor_id, subject, goals, plan_text)
                   values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                           'Matematik', 'Klara E', 'Bråk varje vecka')$q$,
                $q$insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status)
                   values ('00000000-0000-4000-8000-0000000bcb11', '00000000-0000-4000-8000-0000000000f1',
                           '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000005a1',
                           '00000000-0000-4000-8000-0000000000f1', (now() at time zone 'Europe/Stockholm')::date + 17,
                           '19:00', 60, 'confirmed'),
                          ('00000000-0000-4000-8000-0000000bcb12', '00000000-0000-4000-8000-0000000000f1',
                           '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000005a1',
                           '00000000-0000-4000-8000-0000000000f1', (now() at time zone 'Europe/Stockholm')::date - 11,
                           '12:00', 60, 'confirmed')$q$,
                $q$insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
                   values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
                           '00000000-0000-4000-8000-0000000bcb12', 'Bra', (now() at time zone 'Europe/Stockholm')::date - 11,
                           'narvarande')$q$],
          'select public.barn_oversikt()::text') r) x
union all
select 'Barn: med rapporterna av syns inga rapporter', (pg_temp.j(r) -> 'rapporter') = 'null'::jsonb
       and (pg_temp.j(r) ->> 'visa_rapporter') = 'false', left(r, 200)
  from (select pg_temp.som_barn('00000000-0000-4000-8000-0000000bc0c1', '00000000-0000-4000-8000-0000000005a1',
          '00000000-0000-4000-8000-0000000000f1', null, 'select public.barn_oversikt()::text') r) x
union all
select 'Barn: föräldern slår på rapporterna, och barnet ser dem',
       jsonb_array_length(pg_temp.j(r) -> 'rapporter') >= 1 and r not like '%raw_notes%', left(r, 200)
  from (select pg_temp.som_barn('00000000-0000-4000-8000-0000000bc0c1', '00000000-0000-4000-8000-0000000005a1',
          '00000000-0000-4000-8000-0000000000f1',
          array[$q$select pg_temp.bli('00000000-0000-4000-8000-0000000000f1')$q$,
                $q$update public.students set visa_rapporter = true where id = '00000000-0000-4000-8000-0000000005a1'$q$,
                'reset role'],
          'select public.barn_oversikt()::text') r) x
union all
select 'Barn: ett pausat barn får ingenting', pg_temp.j(r) = '{"lage": "pausad"}'::jsonb, left(r, 200)
  from (select pg_temp.som_barn('00000000-0000-4000-8000-0000000bc0c1', '00000000-0000-4000-8000-0000000005a1',
          '00000000-0000-4000-8000-0000000000f1',
          array[$q$update public.students set barn_aktiv = false where id = '00000000-0000-4000-8000-0000000005a1'$q$],
          'select public.barn_oversikt()::text') r) x
union all
select 'Barn: token och koppling måste säga samma sak', (pg_temp.j(r) ->> 'lage') = 'saknas', left(r, 200)
  from (select pg_temp.som_barn('00000000-0000-4000-8000-0000000bc0c1', '00000000-0000-4000-8000-0000000005c1',
          '00000000-0000-4000-8000-0000000000f2', null, 'select public.barn_oversikt()::text') r) x
union all
select 'Barn: rollen utan roll barn i app_metadata får ingenting', (pg_temp.j(r) ->> 'lage') = 'saknas', left(r, 200)
  from (select pg_temp.som(null,
          array[$q$select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000bc0c1","role":"nextrum_barn","user_metadata":{"roll":"barn","barn_id":"00000000-0000-4000-8000-0000000005a1","forald_id":"00000000-0000-4000-8000-0000000000f1"}}', true)$q$,
                'set local role nextrum_barn'],
          'select public.barn_oversikt()::text') r) x
union all
select 'Barn: föräldern kan inte köra barnets funktioner', r like 'FEL 42501%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000000f1', null, 'select public.barn_oversikt()::text') r) x;

-- ------------------------------------------------------------
-- 4. Barnet bokar, avbokar och svarar inte
-- ------------------------------------------------------------
insert into utfall (test, ok, detalj)
select 'Barn: kan inte boka', r like 'FEL 42501%', r
  from (select pg_temp.som_barn('00000000-0000-4000-8000-0000000bc0c1', '00000000-0000-4000-8000-0000000005a1',
          '00000000-0000-4000-8000-0000000000f1', null,
          $q$insert into public.bookings (parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status)
             values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
                     '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000bc0c1',
                     current_date + 30, '15:00', 60, 'requested') returning id::text$q$) r) x
union all
select 'Barn: kan inte avboka', r like 'FEL 42501%', r
  from (select pg_temp.som_barn('00000000-0000-4000-8000-0000000bc0c1', '00000000-0000-4000-8000-0000000005a1',
          '00000000-0000-4000-8000-0000000000f1', null,
          $q$update public.bookings set status = 'cancelled', avbokningsskal = 'annat'
              where id = '00000000-0000-4000-8000-00000000b0d1' returning id::text$q$) r) x
union all
select 'Barn: kan inte svara på ett förslag', r like 'FEL 42501%', r
  from (select pg_temp.som_barn('00000000-0000-4000-8000-0000000bc0c1', '00000000-0000-4000-8000-0000000005a1',
          '00000000-0000-4000-8000-0000000000f1', null,
          $q$update public.bookings set status = 'confirmed'
              where id = '00000000-0000-4000-8000-00000000b0f1' returning id::text$q$) r) x
union all
select 'Barn: kan inte ändra sin egen rad i students', r like 'FEL 42501%', r
  from (select pg_temp.som_barn('00000000-0000-4000-8000-0000000bc0c1', '00000000-0000-4000-8000-0000000005a1',
          '00000000-0000-4000-8000-0000000000f1', null,
          $q$update public.students set visa_rapporter = true, barn_aktiv = true
              where id = '00000000-0000-4000-8000-0000000005a1' returning id::text$q$) r) x;

-- ------------------------------------------------------------
-- 5. Barnets notiser
-- ------------------------------------------------------------
do $$
declare
  f1 text; f2 text; f3 text; f4 text; f5 text; f6 text; lista text; markerad text; annans text; fel text;
  nytt uuid := '00000000-0000-4000-8000-0000000bcb01';
begin
  begin
    -- Ett förslag från familjen om tre veckor, som studiehjälparen svarar på.
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status)
    values (nytt, '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000f1',
            (now() at time zone 'Europe/Stockholm')::date + 21, '16:00', 60, 'requested');
    select count(*)::text into f1 from public.barn_notiser where pass_id = nytt;

    update public.bookings set status = 'confirmed' where id = nytt;
    select string_agg(typ || ':' || text, ' | ') into f2 from public.barn_notiser where pass_id = nytt;

    update public.bookings set status = 'cancelled', avbokningsskal = 'annat' where id = nytt;
    select string_agg(typ, ',' order by skapad, typ) into f3 from public.barn_notiser where pass_id = nytt;

    -- Yngst har ingen inloggning och får inga notiser.
    update public.bookings set status = 'cancelled', avbokningsskal = 'annat'
     where student_id = '00000000-0000-4000-8000-0000000005b1' and status in ('requested', 'confirmed');
    select count(*)::text into f4 from public.barn_notiser where barn_id = '00000000-0000-4000-8000-0000000005b1';

    -- Ett genomfört pass (rapport med närvaro) ger en notis. Passet
    -- skapas bekräftat, och den notisen tas bort först.
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status)
    values ('00000000-0000-4000-8000-0000000bcb02', '00000000-0000-4000-8000-0000000000f1',
            '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000005a1',
            '00000000-0000-4000-8000-0000000000f1', (now() at time zone 'Europe/Stockholm')::date - 12,
            '13:00', 60, 'confirmed');
    delete from public.barn_notiser where pass_id = '00000000-0000-4000-8000-0000000bcb02';
    insert into public.lesson_reports (student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
    values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000000a1',
            '00000000-0000-4000-8000-0000000bcb02', 'Bra pass', (now() at time zone 'Europe/Stockholm')::date - 12,
            'narvarande');
    select string_agg(typ, ',') into f5 from public.barn_notiser where pass_id = '00000000-0000-4000-8000-0000000bcb02';
    select count(*)::text into f6 from public.notis_utskick u
      join auth.users a on a.id = u.mottagare where lower(a.email) like '%@barn.nextrum.se';

    lista := pg_temp.som_barn('00000000-0000-4000-8000-0000000bc0c1', '00000000-0000-4000-8000-0000000005a1',
      '00000000-0000-4000-8000-0000000000f1', null, 'select count(*)::text from public.barn_notiser()');
    markerad := pg_temp.som_barn('00000000-0000-4000-8000-0000000bc0c1', '00000000-0000-4000-8000-0000000005a1',
      '00000000-0000-4000-8000-0000000000f1', null,
      format('select public.barn_markera_last(%L)::text', (select id from public.barn_notiser where pass_id = nytt limit 1)));
    annans := pg_temp.som_barn('00000000-0000-4000-8000-0000000bc0c2', '00000000-0000-4000-8000-0000000005c1',
      '00000000-0000-4000-8000-0000000000f2', null,
      format('select public.barn_markera_last(%L)::text', (select id from public.barn_notiser where pass_id = nytt limit 1)));
    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('Barn: notiserna', false, fel);
    return;
  end if;
  insert into utfall (test, ok, detalj) values
    ('Barn: ett nytt förslag är ingen notis', f1 = '0', f1),
    ('Barn: ett bekräftat pass blir en notis utan namn', f2 like 'bekraftat:Ditt pass % är bekräftat.'
      and f2 not like '%Test%', coalesce(f2, 'ingen')),
    ('Barn: ett avbokat pass blir en notis', f3 = 'avbokat,bekraftat' or f3 = 'bekraftat,avbokat', coalesce(f3, 'ingen')),
    ('Barn: ett barn utan inloggning får inga notiser', f4 = '0', f4),
    ('Barn: ett genomfört pass blir en notis', f5 = 'genomfort', coalesce(f5, 'ingen')),
    ('Barn: ingen notis köas som mejl till en barnadress', f6 = '0', f6),
    ('Barn: barnet läser sina notiser', pg_temp.i(lista) >= 2, lista),
    ('Barn: barnet markerar sin notis som läst', markerad = 'true', markerad),
    ('Barn: ett annat barn markerar den inte', annans = 'false', annans);
end $$;

reset role;
select set_config('request.jwt.claims', null, true);

insert into utfall (test, ok, detalj)
select 'Barn: ett pausat barn ser inga notiser och markerar ingenting', r = '0|false', r
  from (select pg_temp.som_barn('00000000-0000-4000-8000-0000000bc0c1', '00000000-0000-4000-8000-0000000005a1',
          '00000000-0000-4000-8000-0000000000f1',
          array[$q$insert into public.barn_notiser (id, barn_id, typ, text) values
                   ('00000000-0000-4000-8000-0000000bcf02', '00000000-0000-4000-8000-0000000005a1', 'avbokat', 'Prov')$q$,
                $q$update public.students set barn_aktiv = false where id = '00000000-0000-4000-8000-0000000005a1'$q$],
          $q$select (select count(*) from public.barn_notiser())::text || '|' ||
                    public.barn_markera_last('00000000-0000-4000-8000-0000000bcf02')::text$q$) r) x;

-- ------------------------------------------------------------
-- 6. Föräldern: sina egna barn, aldrig en annan familjs
-- ------------------------------------------------------------
insert into utfall (test, ok, detalj)
select 'Barn: föräldern ser sina barns inloggningar', r = '1', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000000f1', null,
          $q$select count(*)::text from public.mina_barnkonton() where anvandarnamn is not null$q$) r) x
union all
select 'Barn: förälder A ser inte förälder B:s barns inloggning', r = '0', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000000f1', null,
          $q$select (count(*) + (select count(*) from public.mina_barnkonton() where barn_id = '00000000-0000-4000-8000-0000000005c1'))::text
               from public.students where id = '00000000-0000-4000-8000-0000000005c1'$q$) r) x
union all
select 'Barn: förälder A ändrar inte förälder B:s barn', r = '0', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000000f1', null,
          $q$with u as (update public.students set visa_rapporter = true
                         where id = '00000000-0000-4000-8000-0000000005c1' returning 1)
             select count(*)::text from u$q$) r) x
union all
select 'Barn: förälder A kan inte skapa en inloggning åt förälder B:s barn', r like 'FEL 42501%', r
  from (select pg_temp.som(null, null,
          $q$insert into auth.users (id, email, raw_app_meta_data) values
               ('00000000-0000-4000-8000-0000000bc0c9', 'kapning@barn.nextrum.se',
                '{"roll":"barn","barn_id":"00000000-0000-4000-8000-0000000005c1","forald_id":"00000000-0000-4000-8000-0000000000f1"}')
             returning id::text$q$) r) x
union all
select 'Barn: föräldern ändrar inte inloggningens kolumner själv',
       r = 'aldst.p|true|00000000-0000-4000-8000-0000000bc0c1', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000000f1', null,
          $q$with u as (update public.students set anvandarnamn = 'kapad', barn_aktiv = false, user_id = null
                         where id = '00000000-0000-4000-8000-0000000005a1' returning anvandarnamn, barn_aktiv, user_id)
             select anvandarnamn || '|' || barn_aktiv || '|' || user_id from u$q$) r) x
union all
select 'Barn: föräldern slår på rapporterna', r = 'true', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000000f1', null,
          $q$with u as (update public.students set visa_rapporter = true
                         where id = '00000000-0000-4000-8000-0000000005a1' returning visa_rapporter)
             select visa_rapporter::text from u$q$) r) x
union all
select 'Barn: en admin ändrar inte barnets inloggning eller rapportvalet',
       r = 'aldst.p|true|false', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000000ad', null,
          $q$with u as (update public.students set anvandarnamn = 'admin', barn_aktiv = false, visa_rapporter = true
                         where id = '00000000-0000-4000-8000-0000000005a1'
                         returning anvandarnamn, barn_aktiv, visa_rapporter)
             select anvandarnamn || '|' || barn_aktiv || '|' || visa_rapporter from u$q$) r) x
union all
select 'Barn: ändringsfönstret når ingen inloggad, inte ens admin', r like 'FEL 42501%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000000ad', null,
          $q$select count(*)::text from public.barn_andringsfonster$q$) r) x
union all
select 'Barn: föräldern öppnar inget fönster själv', r like 'FEL 42501%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000000f1', null,
          $q$insert into public.barn_andringsfonster (barn_id) values ('00000000-0000-4000-8000-0000000005a1') returning id::text$q$) r) x
union all
select 'Barn: föräldern loggar inte ut barnet själv, det gör edge-funktionen', r like 'FEL 42501%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000000f1', null,
          $q$select public.barnkonto_logga_ut('00000000-0000-4000-8000-0000000005a1')::text$q$) r) x
union all
select 'Barn: utloggningen tar barnets sessioner', r = '0', r
  from (select pg_temp.som(null,
          array[$q$insert into auth.sessions (id, user_id) values (gen_random_uuid(), '00000000-0000-4000-8000-0000000bc0c1')$q$,
                $q$select public.barnkonto_logga_ut('00000000-0000-4000-8000-0000000005a1')$q$],
          $q$select count(*)::text from auth.sessions where user_id = '00000000-0000-4000-8000-0000000bc0c1'$q$) r) x;

-- ------------------------------------------------------------
-- 7. auth.users: låset, fönstret och barnadresserna
-- ------------------------------------------------------------
insert into utfall (test, ok, detalj)
select 'Barn: lösenordet byts inte utan fönster', r like 'FEL 42501%', r
  from (select pg_temp.som(null, null,
          $q$update auth.users set encrypted_password = 'nytt' where id = '00000000-0000-4000-8000-0000000bc0c1' returning id::text$q$) r) x
union all
select 'Barn: lösenordet byts med ett giltigt fönster, som förbrukas', r = 'true|0', r
  from (select pg_temp.som(null,
          array[$q$insert into public.barn_andringsfonster (barn_id) values ('00000000-0000-4000-8000-0000000005a1')$q$,
                $q$update auth.users set encrypted_password = 'nytt' where id = '00000000-0000-4000-8000-0000000bc0c1'$q$],
          $q$select (select (encrypted_password = 'nytt')::text from auth.users where id = '00000000-0000-4000-8000-0000000bc0c1')
                    || '|' || (select count(*) from public.barn_andringsfonster
                                where barn_id = '00000000-0000-4000-8000-0000000005a1')::text$q$) r) x
union all
select 'Barn: ett fönster räcker till ett byte', r like 'FEL 42501%', r
  from (select pg_temp.som(null,
          array[$q$insert into public.barn_andringsfonster (barn_id) values ('00000000-0000-4000-8000-0000000005a1')$q$,
                $q$update auth.users set encrypted_password = 'ett' where id = '00000000-0000-4000-8000-0000000bc0c1'$q$],
          $q$update auth.users set encrypted_password = 'två' where id = '00000000-0000-4000-8000-0000000bc0c1' returning id::text$q$) r) x
union all
select 'Barn: ett utgånget fönster nekas', r like 'FEL 42501%', r
  from (select pg_temp.som(null,
          array[$q$insert into public.barn_andringsfonster (barn_id, skapad, giltig_till)
                   values ('00000000-0000-4000-8000-0000000005a1', now() - interval '2 minutes', now() - interval '1 minute')$q$],
          $q$update auth.users set encrypted_password = 'nytt' where id = '00000000-0000-4000-8000-0000000bc0c1' returning id::text$q$) r) x
union all
select 'Barn: ett fönster för ett annat barn gäller inte', r like 'FEL 42501%', r
  from (select pg_temp.som(null,
          array[$q$insert into public.barn_andringsfonster (barn_id) values ('00000000-0000-4000-8000-0000000005c1')$q$],
          $q$update auth.users set encrypted_password = 'nytt' where id = '00000000-0000-4000-8000-0000000bc0c1' returning id::text$q$) r) x
union all
select 'Barn: fönstret kan inte göras längre än en minut', r like 'FEL 23514%', r
  from (select pg_temp.som(null, null,
          $q$insert into public.barn_andringsfonster (barn_id, giltig_till)
             values ('00000000-0000-4000-8000-0000000005a1', now() + interval '1 hour') returning id::text$q$) r) x
union all
select 'Barn: e-posten byts inte, inte heller med ett fönster', r like 'FEL 42501%', r
  from (select pg_temp.som(null,
          array[$q$insert into public.barn_andringsfonster (barn_id) values ('00000000-0000-4000-8000-0000000005a1')$q$],
          $q$update auth.users set email = 'riktig@example.invalid' where id = '00000000-0000-4000-8000-0000000bc0c1' returning id::text$q$) r) x
union all
select 'Barn: e-postbytet påbörjas inte', r like 'FEL 42501%', r
  from (select pg_temp.som(null, null,
          $q$update auth.users set email_change = 'riktig@example.invalid', email_change_token_new = 'x'
              where id = '00000000-0000-4000-8000-0000000bc0c1' returning id::text$q$) r) x
union all
select 'Barn: återställningen sparar ingen token', r like 'FEL 42501%', r
  from (select pg_temp.som(null, null,
          $q$update auth.users set recovery_token = 'x', recovery_sent_at = now()
              where id = '00000000-0000-4000-8000-0000000bc0c1' returning id::text$q$) r) x
union all
select 'Barn: inloggningen går igenom och stämplas för föräldern', r = 'true', r
  from (select pg_temp.som(null,
          array[$q$update auth.users set last_sign_in_at = now(), updated_at = now()
                   where id = '00000000-0000-4000-8000-0000000bc0c1'$q$],
          $q$select (senast_inloggad is not null)::text from public.students
              where id = '00000000-0000-4000-8000-0000000005a1'$q$) r) x
union all
select 'Barn: pausen (banned_until) går igenom', r = '1', r
  from (select pg_temp.som(null, null,
          $q$with u as (update auth.users set banned_until = now() + interval '100 years'
                         where id = '00000000-0000-4000-8000-0000000bc0c1' returning 1)
             select count(*)::text from u$q$) r) x
union all
select 'Barn: rollen går inte att byta tillbaka till authenticated', r = 'nextrum_barn', r
  from (select pg_temp.som(null, null,
          $q$update auth.users set role = 'authenticated' where id = '00000000-0000-4000-8000-0000000bc0c1'
             returning role$q$) r) x
union all
select 'Barn: ett barnkonto förblir ett barnkonto när GoTrue skriver app_metadata ur minnet',
       r = 'barn|00000000-0000-4000-8000-0000000005a1|nextrum_barn', r
  from (select pg_temp.som(null, null,
          $q$with u as (update auth.users set raw_app_meta_data = '{"provider":"email","providers":["email"]}',
                                              role = 'authenticated'
                         where id = '00000000-0000-4000-8000-0000000bc0c1' returning raw_app_meta_data, role)
             select (raw_app_meta_data ->> 'roll') || '|' || (raw_app_meta_data ->> 'barn_id') || '|' || role from u$q$) r) x
union all
select 'Barn: ett barnkonto byter inte barn eller familj',
       r = '00000000-0000-4000-8000-0000000005a1|00000000-0000-4000-8000-0000000000f1', r
  from (select pg_temp.som(null, null,
          $q$with u as (update auth.users
                           set raw_app_meta_data = raw_app_meta_data
                               || '{"barn_id":"00000000-0000-4000-8000-0000000005b1","forald_id":"00000000-0000-4000-8000-0000000000f2"}'
                         where id = '00000000-0000-4000-8000-0000000bc0c1' returning raw_app_meta_data)
             select (raw_app_meta_data ->> 'barn_id') || '|' || (raw_app_meta_data ->> 'forald_id') from u$q$) r) x
union all
select 'Barn: GoTrues egna fält i app_metadata går igenom', r = '1', r
  from (select pg_temp.som(null, null,
          $q$with u as (update auth.users set raw_app_meta_data = raw_app_meta_data || '{"providers":["email"]}'
                         where id = '00000000-0000-4000-8000-0000000bc0c1' returning 1)
             select count(*)::text from u$q$) r) x
union all
select 'Barn: ett vanligt konto blir inte ett barnkonto', r like 'FEL 42501%', r
  from (select pg_temp.som(null, null,
          $q$update auth.users set raw_app_meta_data = '{"roll":"barn","barn_id":"00000000-0000-4000-8000-0000000005b1","forald_id":"00000000-0000-4000-8000-0000000000f1"}'
              where id = '00000000-0000-4000-8000-0000000000f1' returning id::text$q$) r) x
union all
select 'Barn: en barnadress utan roll barn nekas vid registrering', r like 'FEL 42501%', r
  from (select pg_temp.som(null, null,
          $q$insert into auth.users (id, email, raw_user_meta_data) values
               ('00000000-0000-4000-8000-0000000bc0c8', 'ockupant@barn.nextrum.se', '{"role":"parent"}') returning id::text$q$) r) x
union all
select 'Barn: en barnadress går inte att byta till', r like 'FEL 42501%', r
  from (select pg_temp.som(null, null,
          $q$update auth.users set email_change = 'aldst.p2@barn.nextrum.se'
              where id = '00000000-0000-4000-8000-0000000000f1' returning id::text$q$) r) x
union all
select 'Barn: ett andra barnkonto för samma barn nekas, också med ett fönster', r like 'FEL 42501%', r
  from (select pg_temp.som(null,
          array[$q$select pg_temp.skapandefonster('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000bc0c7', 'andra.p')$q$],
          $q$insert into auth.users (id, email, raw_app_meta_data) values
               ('00000000-0000-4000-8000-0000000bc0c7', 'andra.p@barn.nextrum.se',
                '{"roll":"barn","barn_id":"00000000-0000-4000-8000-0000000005a1","forald_id":"00000000-0000-4000-8000-0000000000f1"}')
             returning id::text$q$) r) x
union all
select 'Barn: ett upptaget användarnamn nekas', r like 'FEL 23505%', r
  from (select pg_temp.som(null,
          array[$q$select pg_temp.skapandefonster('00000000-0000-4000-8000-0000000005b1', '00000000-0000-4000-8000-0000000bc0c6', 'aldst.p')$q$],
          $q$insert into auth.users (id, email, raw_app_meta_data) values
               ('00000000-0000-4000-8000-0000000bc0c6', 'aldst.p@barn.nextrum.se',
                '{"roll":"barn","barn_id":"00000000-0000-4000-8000-0000000005b1","forald_id":"00000000-0000-4000-8000-0000000000f1"}')
             returning id::text$q$) r) x
union all
select 'Barn: vanliga konton påverkas inte av låset', r = '1', r
  from (select pg_temp.som(null, null,
          $q$with u as (update auth.users set encrypted_password = 'nytt', email = 'rls-p2@example.invalid'
                         where id = '00000000-0000-4000-8000-0000000000f1' returning 1)
             select count(*)::text from u$q$) r) x;

-- ------------------------------------------------------------
-- 7b. Skapandefönstret och mejlspärren (barnkonto_skapas_genom_auth)
--
-- GoTrue skriver raden med app_metadata {provider, providers} och lägger
-- till roll, bekräftelse och resten i UPDATE efteråt (admin.go,
-- adminUserCreate). Det första provet gör exakt så; fixturerna ovan skrev
-- app_metadata i INSERT och kunde aldrig se att det inte gick.
-- ------------------------------------------------------------
insert into utfall (test, ok, detalj)
select 'Barn: kontot skapas som GoTrue gör det, raden först och resten efteråt',
       r = 'nextrum_barn|barn|00000000-0000-4000-8000-0000000005b1|00000000-0000-4000-8000-0000000000f1|yngst.p|true|0|0|{"email_verified": true}',
       r
  from (select pg_temp.som(null,
          array[$q$select pg_temp.skapandefonster('00000000-0000-4000-8000-0000000005b1', '00000000-0000-4000-8000-0000000bc0d1', 'yngst.p')$q$,
                $q$insert into auth.users (id, email, role, raw_app_meta_data, raw_user_meta_data,
                                           confirmation_token, recovery_token, email_change_token_new, email_change)
                   values ('00000000-0000-4000-8000-0000000bc0d1', 'yngst.p@barn.nextrum.se', '',
                           '{"provider":"email","providers":["email"]}', '{}', '', '', '', '')$q$,
                $q$update auth.users set role = 'authenticated' where id = '00000000-0000-4000-8000-0000000bc0d1'$q$,
                $q$update auth.users set confirmation_token = '', email_confirmed_at = now()
                    where id = '00000000-0000-4000-8000-0000000bc0d1'$q$,
                $q$update auth.users set raw_user_meta_data = '{"email_verified": true}'
                    where id = '00000000-0000-4000-8000-0000000bc0d1'$q$],
          $q$select concat_ws('|', u.role, u.raw_app_meta_data ->> 'roll', u.raw_app_meta_data ->> 'barn_id',
                              u.raw_app_meta_data ->> 'forald_id', s.anvandarnamn, (s.user_id = u.id)::text,
                              (select count(*) from public.barn_andringsfonster f where f.barn_id = s.id)::text,
                              (select count(*) from public.profiles p where p.id = u.id)::text,
                              u.raw_user_meta_data::text)
               from auth.users u join public.students s on s.id = '00000000-0000-4000-8000-0000000005b1'
              where u.id = '00000000-0000-4000-8000-0000000bc0d1'$q$) r) x
union all
select 'Barn: en registrering på barnadressen nekas också medan fönstret är öppet', r like 'FEL 42501%', r
  from (select pg_temp.som(null,
          array[$q$select pg_temp.skapandefonster('00000000-0000-4000-8000-0000000005b1', '00000000-0000-4000-8000-0000000bc0d1', 'yngst.p')$q$],
          $q$insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
               ('00000000-0000-4000-8000-0000000bc0d2', 'yngst.p@barn.nextrum.se',
                '{"provider":"email","providers":["email"]}', '{"role":"parent"}') returning id::text$q$) r) x
union all
select 'Barn: fönstret gäller bara sitt användarnamn', r like 'FEL 42501%', r
  from (select pg_temp.som(null,
          array[$q$select pg_temp.skapandefonster('00000000-0000-4000-8000-0000000005b1', '00000000-0000-4000-8000-0000000bc0d1', 'yngst.p')$q$],
          $q$insert into auth.users (id, email, raw_app_meta_data) values
               ('00000000-0000-4000-8000-0000000bc0d1', 'annat.p@barn.nextrum.se', '{"provider":"email"}') returning id::text$q$) r) x
union all
select 'Barn: ett utgånget skapandefönster nekas', r like 'FEL 42501%', r
  from (select pg_temp.som(null,
          array[$q$select pg_temp.skapandefonster('00000000-0000-4000-8000-0000000005b1', '00000000-0000-4000-8000-0000000bc0d1',
                                                  'yngst.p', interval '2 minutes')$q$],
          $q$insert into auth.users (id, email, raw_app_meta_data) values
               ('00000000-0000-4000-8000-0000000bc0d1', 'yngst.p@barn.nextrum.se', '{"provider":"email"}') returning id::text$q$) r) x
union all
select 'Barn: familjen i anropet ska vara fönstrets', r like 'FEL 42501%', r
  from (select pg_temp.som(null,
          array[$q$select pg_temp.skapandefonster('00000000-0000-4000-8000-0000000005b1', '00000000-0000-4000-8000-0000000bc0d1', 'yngst.p')$q$],
          $q$insert into auth.users (id, email, raw_app_meta_data) values
               ('00000000-0000-4000-8000-0000000bc0d1', 'yngst.p@barn.nextrum.se',
                '{"roll":"barn","barn_id":"00000000-0000-4000-8000-0000000005b1","forald_id":"00000000-0000-4000-8000-0000000000f2"}')
             returning id::text$q$) r) x
union all
select 'Barn: föräldern öppnar inget skapandefönster själv', r like 'FEL 42501%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000000f1', null,
          $q$insert into public.barn_andringsfonster (barn_id, andring, user_id, anvandarnamn)
             values ('00000000-0000-4000-8000-0000000005b1', 'skapa', '00000000-0000-4000-8000-0000000bc0d1', 'yngst.p')
             returning id::text$q$) r) x
union all
select 'Barn: ett skapandefönster har ett id och ett giltigt användarnamn', r like 'FEL 23514%', r
  from (select pg_temp.som(null, null,
          $q$insert into public.barn_andringsfonster (barn_id, andring, anvandarnamn)
             values ('00000000-0000-4000-8000-0000000005b1', 'skapa', 'Yngst P') returning id::text$q$) r) x
union all
select 'Barn: ett lösenordsfönster bär inget id', r like 'FEL 23514%', r
  from (select pg_temp.som(null, null,
          $q$insert into public.barn_andringsfonster (barn_id, user_id)
             values ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000bc0c1') returning id::text$q$) r) x
union all
select 'Barn: Auth skickar inga mejl till ett barnkonto (spärren i *_sent_at)', r = 'true|true|true|true', r
  from (select pg_temp.som(null, null,
          $q$select concat_ws('|', (confirmation_sent_at > now() + interval '900 years')::text,
                              (recovery_sent_at > now() + interval '900 years')::text,
                              (email_change_sent_at > now() + interval '900 years')::text,
                              (reauthentication_sent_at > now() + interval '900 years')::text)
               from auth.users where id = '00000000-0000-4000-8000-0000000bc0c1'$q$) r) x
union all
select 'Barn: mejlspärren står kvar när lösenordet byts som Auth byter det', r = 'true|true', r
  from (select pg_temp.som(null,
          array[$q$insert into public.barn_andringsfonster (barn_id) values ('00000000-0000-4000-8000-0000000005a1')$q$,
                $q$update auth.users
                      set encrypted_password = 'nytt', confirmation_token = '', confirmation_sent_at = null,
                          recovery_token = '', recovery_sent_at = null, email_change_token_current = '',
                          email_change_token_new = '', email_change_sent_at = null, phone_change_token = '',
                          phone_change_sent_at = null, reauthentication_token = '', reauthentication_sent_at = null
                    where id = '00000000-0000-4000-8000-0000000bc0c1'$q$],
          $q$select (encrypted_password = 'nytt')::text || '|' || (recovery_sent_at > now() + interval '900 years')::text
               from auth.users where id = '00000000-0000-4000-8000-0000000bc0c1'$q$) r) x
union all
select 'Barn: mejlspärren går inte att flytta bakåt', r = 'true', r
  from (select pg_temp.som(null, null,
          $q$with u as (update auth.users set recovery_sent_at = now() - interval '1 day'
                         where id = '00000000-0000-4000-8000-0000000bc0c1' returning recovery_sent_at)
             select (recovery_sent_at > now() + interval '900 years')::text from u$q$) r) x
union all
select 'Barn: vanliga konton får ingen mejlspärr', r = 'true', r
  from (select pg_temp.som(null, null,
          $q$with u as (update auth.users set recovery_sent_at = now() - interval '1 day'
                         where id = '00000000-0000-4000-8000-0000000000f1' returning recovery_sent_at)
             select (recovery_sent_at < now())::text from u$q$) r) x;

-- ------------------------------------------------------------
-- 8. Städningen
-- ------------------------------------------------------------
insert into utfall (test, ok, detalj)
select 'Barn: tas inloggningen bort följer namnet och notiserna med', r = 'null|true|false|0', r
  from (select pg_temp.som(null,
          array[$q$insert into public.barn_notiser (barn_id, typ, text) values ('00000000-0000-4000-8000-0000000005a1', 'avbokat', 'Prov')$q$,
                $q$update public.students set visa_rapporter = true where id = '00000000-0000-4000-8000-0000000005a1'$q$,
                $q$delete from auth.users where id = '00000000-0000-4000-8000-0000000bc0c1'$q$],
          $q$select coalesce(anvandarnamn, 'null') || '|' || barn_aktiv || '|' || visa_rapporter || '|' ||
                    (select count(*) from public.barn_notiser where barn_id = s.id)
               from public.students s where s.id = '00000000-0000-4000-8000-0000000005a1'$q$) r) x
union all
select 'Barn: tas barnet bort tas inloggningen bort', r = '0', r
  from (select pg_temp.som(null,
          array[$q$insert into public.students (id, parent_id, name) values
                   ('00000000-0000-4000-8000-0000000bc5a3', '00000000-0000-4000-8000-0000000000f1', 'Nytt barn')$q$,
                $q$select pg_temp.skapandefonster('00000000-0000-4000-8000-0000000bc5a3', '00000000-0000-4000-8000-0000000bc0c3', 'nytt.p')$q$,
                $q$insert into auth.users (id, email, raw_app_meta_data) values
                   ('00000000-0000-4000-8000-0000000bc0c3', 'nytt.p@barn.nextrum.se',
                    '{"roll":"barn","barn_id":"00000000-0000-4000-8000-0000000bc5a3","forald_id":"00000000-0000-4000-8000-0000000000f1"}')$q$,
                $q$delete from public.students where id = '00000000-0000-4000-8000-0000000bc5a3'$q$],
          $q$select count(*)::text from auth.users where id = '00000000-0000-4000-8000-0000000bc0c3'$q$) r) x
union all
select 'Barn: avidentifieras barnet tas inloggningen bort', r = '0|null', r
  from (select pg_temp.som(null,
          array[$q$update public.students set raderad_at = now() where id = '00000000-0000-4000-8000-0000000005a1'$q$],
          $q$select (select count(*) from auth.users where id = '00000000-0000-4000-8000-0000000bc0c1')::text || '|' ||
                    coalesce((select user_id::text from public.students where id = '00000000-0000-4000-8000-0000000005a1'), 'null')$q$) r) x;

-- ------------------------------------------------------------
-- 9. Notiskön mejlar aldrig ett barnkonto
--
-- Ett barn kan inte stå som mottagare (ingen profil). Provet ger
-- därför ett barnkonto en profil i blocket, med triggrarna förbi, och
-- köar ett utskick till det: raden ska hoppas över och aldrig lämnas ut.
-- ------------------------------------------------------------
insert into utfall (test, ok, detalj)
select 'Barn: notiskön hoppar över ett barnkonto', r = '0|hoppad|barnkonton får inga mejl', r
  from (select pg_temp.som(null,
          array[$q$update public.flaggor set aktiv = true where kod = 'notiser_mejl'$q$,
                $q$insert into public.profiles (id, role, full_name, email)
                   values ('00000000-0000-4000-8000-0000000bc0c2', 'parent', 'Konstgjord', 'annan.q@barn.nextrum.se')$q$,
                $q$insert into public.notis_utskick (id, mottagare, kanal, typ, data, idempotens, skicka_efter)
                   values ('00000000-0000-4000-8000-0000000bcf01', '00000000-0000-4000-8000-0000000bc0c2', 'mejl',
                           'timmar_gar_ut', '{}', 'barnprov', '2000-01-01')$q$,
                $q$create temp table barn_ko_svar as select id from public.notis_utskick_ta(100)$q$],
          $q$select (select count(*) from barn_ko_svar where id = '00000000-0000-4000-8000-0000000bcf01')::text || '|' ||
                    (select status || '|' || coalesce(fel, '') from public.notis_utskick
                      where id = '00000000-0000-4000-8000-0000000bcf01')$q$) r) x;

-- ------------------------------------------------------------
-- 10. Admin: sanningen, spegeln och frågorna
-- ------------------------------------------------------------
insert into utfall (test, ok, detalj)
select 'Admin: dagens admin blev superadmin', r = 'true', r
  from (select pg_temp.som(null, null,
          $q$select ar_superadmin::text from public.admin_roller
              where user_id = '00000000-0000-4000-8000-0000000000ad'$q$) r) x
union all
select 'Admin: listan i villkoret och i funktionen är samma', r = 'true', r
  from (select pg_temp.som(null, null,
          $q$select (pg_get_constraintdef(c.oid) like '%' || array_to_string(array(select quote_literal(b) || '::text'
                       from unnest(intern.admin_behorigheter()) b), ', ') || '%')::text
               from pg_constraint c where c.conname = 'admin_roller_behorigheter_kanda'$q$) r) x
union all
select 'Admin: profiles.is_admin speglar superadmin, inte en begränsad roll',
       (select is_admin from public.profiles where id = '00000000-0000-4000-8000-0000000000ad')
       and not (select is_admin from public.profiles where id = '00000000-0000-4000-8000-0000000bcad1'), 'ad/l1'
union all
select 'Admin: en begränsad admin är inte is_admin men har sin behörighet', r = 'false|true|false', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad1', null,
          $q$select public.is_admin()::text || '|' || public.har_behorighet('leads')::text || '|' ||
                    public.har_behorighet('bokningar_las')::text$q$) r) x
union all
select 'Admin: mina_behorigheter säger vad den inloggade får', r = '{"admin": true, "superadmin": false, "behorigheter": ["leads"]}', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad1', null, $q$select public.mina_behorigheter()::text$q$) r) x
union all
select 'Admin: en superadmin har alla behörigheter', r = 'true|9', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000000ad', null,
          $q$select (public.mina_behorigheter() ->> 'superadmin') || '|' ||
                    jsonb_array_length(public.mina_behorigheter() -> 'behorigheter')::text$q$) r) x
union all
select 'Admin: receptet i SQL ger en superadmin', r = 'true|true', r
  from (select pg_temp.som(null,
          array[$q$update public.profiles set is_admin = true where id = '00000000-0000-4000-8000-0000000bcad6'$q$],
          $q$select (select ar_superadmin::text from public.admin_roller where user_id = '00000000-0000-4000-8000-0000000bcad6')
                    || '|' || (select is_admin::text from public.profiles where id = '00000000-0000-4000-8000-0000000bcad6')$q$) r) x;

-- ------------------------------------------------------------
-- 11. Admin: behörigheten X krävs för X
-- ------------------------------------------------------------
insert into utfall (test, ok, detalj)
select 'Admin leads: läser och ändrar intresseanmälningar', r = '1|contacted', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad1', null,
          $q$with u as (update public.leads set status = 'contacted', notering = 'Ringt'
                         where id = '00000000-0000-4000-8000-0000000bc1e1' returning status)
             select (select count(*) from public.leads where id = '00000000-0000-4000-8000-0000000bc1e1')::text
                    || '|' || (select status from u)$q$) r) x
union all
select 'Admin utan leads: ser inga intresseanmälningar', r = '0', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad3', null,
          $q$select count(*)::text from public.leads$q$) r) x
union all
select 'Admin leads: ser inga pass, rapporter, betalningar eller chattar', r = '0|0|0|0|0', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad1', null,
          $q$select (select count(*) from public.bookings)::text || '|' || (select count(*) from public.lesson_reports)
               || '|' || (select count(*) from public.invoices) || '|' || (select count(*) from public.messages)
               || '|' || (select count(*) from public.audit_logg)$q$) r) x
union all
select 'Admin leads: ser bara sin egen profil', r = '1', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad1', null,
          $q$select count(*)::text from public.profiles$q$) r) x
union all
select 'Admin leads: kan inte radera en person', r like 'FEL 42501%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad1', null,
          $q$select public.radera_person('familj', '00000000-0000-4000-8000-0000000000f2')::text$q$) r) x
union all
select 'Admin leads: kan inte läsa en chatt', r like 'FEL 42501%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad1', null,
          $q$select count(*)::text from public.chatt_las('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a1')$q$) r) x
union all
select 'Admin matchning: matchar en elev med en godkänd studiehjälpare', r = '00000000-0000-4000-8000-0000000000b1|matched', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad3', null,
          $q$with u as (update public.students set matched_tutor_id = '00000000-0000-4000-8000-0000000000b1', match_status = 'matched'
                         where id = '00000000-0000-4000-8000-0000000005c1' returning matched_tutor_id, match_status)
             select matched_tutor_id::text || '|' || match_status from u$q$) r) x
union all
select 'Admin matchning: ändrar inget annat på eleven', r = 'Annan familj|00000000-0000-4000-8000-0000000000b1', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad3', null,
          $q$with u as (update public.students set name = 'Nytt namn', school = 'Ny skola',
                                matched_tutor_id = '00000000-0000-4000-8000-0000000000b1', match_status = 'matched'
                         where id = '00000000-0000-4000-8000-0000000005c1' returning name, matched_tutor_id)
             select name || '|' || matched_tutor_id from u$q$) r) x
union all
select 'Admin matchning: ser matchningsförslagen', r not like 'FEL%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad3', null,
          $q$select count(*)::text from public.matchningsforslag('00000000-0000-4000-8000-0000000005c1')$q$) r) x
union all
select 'Admin utan matchning: matchar inte', r = '0', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad1', null,
          $q$with u as (update public.students set matched_tutor_id = '00000000-0000-4000-8000-0000000000b1', match_status = 'matched'
                         where id = '00000000-0000-4000-8000-0000000005c1' returning 1)
             select count(*)::text from u$q$) r) x
union all
select 'Admin utan matchning: ser inte matchningsförslagen', r like 'FEL 42501%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad1', null,
          $q$select count(*)::text from public.matchningsforslag('00000000-0000-4000-8000-0000000005c1')$q$) r) x
union all
select 'Admin matchning: en studiehjälpare matchar inte sig själv', r = '00000000-0000-4000-8000-0000000000a1', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000000b1',
          array[$q$insert into public.admin_roller (user_id, behorigheter) values ('00000000-0000-4000-8000-0000000000b1', '{matchning}')$q$],
          $q$with u as (update public.students set matched_tutor_id = '00000000-0000-4000-8000-0000000000b1'
                         where id = '00000000-0000-4000-8000-0000000005a1' returning matched_tutor_id)
             select coalesce((select matched_tutor_id::text from u), 'ingen rad')$q$) r) x
union all
select 'Admin anvandare_las: läser familjer, elever och studiehjälpare', r not like 'FEL%' and pg_temp.i(split_part(r, '|', 1)) > 3
       and pg_temp.i(split_part(r, '|', 2)) >= 3 and pg_temp.i(split_part(r, '|', 3)) >= 2, r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad3', null,
          $q$select (select count(*) from public.profiles)::text || '|' || (select count(*) from public.students)
               || '|' || (select count(*) from public.tutor_profiles)$q$) r) x
union all
select 'Admin utan anvandare_redigera: ändrar inte en profil', r = '0', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad3', null,
          $q$with u as (update public.profiles set full_name = 'Ändrad' where id = '00000000-0000-4000-8000-0000000000f2' returning 1)
             select count(*)::text from u$q$) r) x
union all
select 'Admin anvandare_redigera: ändrar namnet men inte rollen eller matchningen',
       r = 'Ändrad|' || (select role || '|' || match_status from public.profiles
                          where id = '00000000-0000-4000-8000-0000000000f2'), r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad6',
          array[$q$insert into public.admin_roller (user_id, behorigheter) values ('00000000-0000-4000-8000-0000000bcad6', '{anvandare_las,anvandare_redigera}')$q$],
          $q$with u as (update public.profiles set full_name = 'Ändrad', role = 'tutor', match_status = 'matched'
                         where id = '00000000-0000-4000-8000-0000000000f2' returning full_name, role, match_status)
             select full_name || '|' || role || '|' || match_status from u$q$) r) x
union all
select 'Admin studiehjalpare_godkann: sätter läget på en studiehjälpare men inte timpenningen', r = 'rejected|150.00', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad6',
          array[$q$insert into public.admin_roller (user_id, behorigheter) values ('00000000-0000-4000-8000-0000000bcad6', '{studiehjalpare_godkann}')$q$],
          $q$with u as (update public.tutor_profiles set status = 'rejected', hourly_rate = 999
                         where id = '00000000-0000-4000-8000-0000000000b1' returning status, hourly_rate)
             select status || '|' || hourly_rate from u$q$) r) x
union all
select 'Admin studiehjalpare_godkann: godkänner inte sig själv', r = 'pending', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad6',
          array[$q$insert into public.tutor_profiles (id, status) values ('00000000-0000-4000-8000-0000000bcad6', 'pending')$q$,
                $q$insert into public.admin_roller (user_id, behorigheter) values ('00000000-0000-4000-8000-0000000bcad6', '{studiehjalpare_godkann}')$q$],
          $q$with u as (update public.tutor_profiles set status = 'approved'
                         where id = '00000000-0000-4000-8000-0000000bcad6' returning status)
             select status from u$q$) r) x
union all
select 'Admin utan studiehjalpare_godkann: godkänner inte', r = '0', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad1', null,
          $q$with u as (update public.tutor_profiles set status = 'rejected'
                         where id = '00000000-0000-4000-8000-0000000000b1' returning 1)
             select count(*)::text from u$q$) r) x
union all
select 'Admin bokningar_las: läser passen men ändrar dem inte', pg_temp.i(split_part(r, '|', 1)) > 0 and split_part(r, '|', 2) = '0', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad6',
          array[$q$insert into public.admin_roller (user_id, behorigheter) values ('00000000-0000-4000-8000-0000000bcad6', '{bokningar_las}')$q$],
          $q$with u as (update public.bookings set status = 'cancelled' where id = '00000000-0000-4000-8000-00000000b0d1' returning 1)
             select (select count(*) from public.bookings)::text || '|' || (select count(*) from u)$q$) r) x
union all
select 'Admin rapporter_las: läser rapporterna men inte passen', pg_temp.i(split_part(r, '|', 1)) > 0 and split_part(r, '|', 2) = '0', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad6',
          array[$q$insert into public.admin_roller (user_id, behorigheter) values ('00000000-0000-4000-8000-0000000bcad6', '{rapporter_las}')$q$],
          $q$select (select count(*) from public.lesson_reports)::text || '|' || (select count(*) from public.bookings)$q$) r) x
union all
select 'Admin notiskonfig: ser notisernas läge och slår om mejlen', r like '{%|1', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad4', null,
          $q$with u as (update public.flaggor set aktiv = not aktiv where kod = 'notiser_mejl' returning 1)
             select left(public.notis_lage()::text, 20) || '|' || (select count(*) from u)$q$) r) x
union all
select 'Admin notiskonfig: slår inte om andra flaggor', r = '0', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad4', null,
          $q$with u as (update public.flaggor set aktiv = not aktiv where kod = 'faktura' returning 1)
             select count(*)::text from u$q$) r) x
union all
select 'Admin utan notiskonfig: ser inte notisernas läge', r like 'FEL 42501%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad1', null, $q$select public.notis_lage()::text$q$) r) x
union all
select 'Admin: en begränsad admin står som admin i auditloggen', r = 'admin', r
  from (select pg_temp.som(null,
          array[$q$select pg_temp.bli('00000000-0000-4000-8000-0000000bcad1')$q$,
                $q$update public.leads set status = 'contacted' where id = '00000000-0000-4000-8000-0000000bc1e1'$q$,
                'reset role'],
          $q$select aktor_typ from public.audit_logg where objekt_id = '00000000-0000-4000-8000-0000000bc1e1'
              and aktor = '00000000-0000-4000-8000-0000000bcad1' order by tid desc limit 1$q$) r) x
union all
select 'Admin: ett begränsat adminkonto raderas inte', r like '%adminkonto%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000000ad',
          array[$q$update public.profiles set role = 'parent' where id = '00000000-0000-4000-8000-0000000bcad1'$q$],
          $q$select public.radering_lage('familj', '00000000-0000-4000-8000-0000000bcad1')::text$q$) r) x;

-- ------------------------------------------------------------
-- 12. Admin: vem får ändra vem
-- ------------------------------------------------------------
insert into utfall (test, ok, detalj)
select 'Admin hantera: gör någon till admin med en behörighet hen har', r like '%"leads"%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad2', null,
          $q$select public.gor_till_admin('00000000-0000-4000-8000-0000000bcad6', '{leads}')::text$q$) r) x
union all
select 'Admin hantera: ger inte en behörighet hen saknar', r like 'FEL 42501%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad2', null,
          $q$select public.gor_till_admin('00000000-0000-4000-8000-0000000bcad6', '{leads,bokningar_las}')::text$q$) r) x
union all
select 'Admin hantera: skapar ingen superadmin', r like 'FEL 42501%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad2', null,
          $q$select public.gor_till_admin('00000000-0000-4000-8000-0000000bcad6', '{}', true)::text$q$) r) x
union all
select 'Admin hantera: ändrar inte sina egna behörigheter', r like 'FEL 42501%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad2', null,
          $q$select public.gor_till_admin('00000000-0000-4000-8000-0000000bcad2', '{leads}')::text$q$) r) x
union all
select 'Admin hantera: rör inte en superadmin', r like 'FEL 42501%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad2', null,
          $q$select public.ta_bort_admin('00000000-0000-4000-8000-0000000000ad')::text$q$) r) x
union all
select 'Admin hantera: rör inte den som har mer än hen själv', r like 'FEL 42501%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad2', null,
          $q$select public.ta_bort_admin('00000000-0000-4000-8000-0000000bcad3')::text$q$) r) x
union all
select 'Admin hantera: tar bort en admin med mindre än hen själv', r = 'true', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad2', null,
          $q$select public.ta_bort_admin('00000000-0000-4000-8000-0000000bcad1')::text$q$) r) x
union all
select 'Admin utan admin_hantera: gör ingen till admin', r like 'FEL 42501%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad1', null,
          $q$select public.gor_till_admin('00000000-0000-4000-8000-0000000bcad6', '{leads}')::text$q$) r) x
union all
select 'Admin: redigera kräver läs', r like 'FEL 22023%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000000ad', null,
          $q$select public.gor_till_admin('00000000-0000-4000-8000-0000000bcad6', '{anvandare_redigera}')::text$q$) r) x
union all
select 'Admin: okänd behörighet nekas', r like 'FEL 22023%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000000ad', null,
          $q$select public.gor_till_admin('00000000-0000-4000-8000-0000000bcad6', '{betalningar}')::text$q$) r) x
union all
select 'Admin: pre-kollen säger samma sak som vakten', r = 'Du kan inte ge en behörighet du inte har själv.|<null>', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad2', null,
          $q$select coalesce(public.admin_kan_ge('{bokningar_las}'), '<null>') || '|' ||
                    coalesce(public.admin_kan_ge('{leads}'), '<null>')$q$) r) x
union all
select 'Admin: en superadmin skapar en superadmin', r like '%"superadmin": true%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000000ad', null,
          $q$select public.gor_till_admin('00000000-0000-4000-8000-0000000bcad5', '{}', true)::text$q$) r) x
union all
select 'Admin: den sista superadminen tas inte bort', r like 'FEL 42501%', r
  from (select pg_temp.som(null,
          array[$q$delete from public.admin_roller where ar_superadmin and user_id <> '00000000-0000-4000-8000-0000000000ad'$q$],
          $q$delete from public.admin_roller where user_id = '00000000-0000-4000-8000-0000000000ad' returning user_id::text$q$) r) x
union all
select 'Admin: den sista superadminen nedgraderas inte', r like 'FEL 42501%', r
  from (select pg_temp.som(null,
          array[$q$delete from public.admin_roller where ar_superadmin and user_id <> '00000000-0000-4000-8000-0000000000ad'$q$],
          $q$update public.admin_roller set ar_superadmin = false, behorigheter = '{leads}'
              where user_id = '00000000-0000-4000-8000-0000000000ad' returning user_id::text$q$) r) x
union all
select 'Admin: med två superadmins tar den ena bort den andra', r = 'true', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad5',
          array[$q$insert into public.admin_roller (user_id, ar_superadmin) values ('00000000-0000-4000-8000-0000000bcad5', true)$q$],
          $q$select public.ta_bort_admin('00000000-0000-4000-8000-0000000000ad')::text$q$) r) x
union all
select 'Admin: ett barnkonto blir aldrig admin', r like 'FEL 42501%barnkonto%', r
  from (select pg_temp.som(null, null,
          $q$insert into public.admin_roller (user_id, ar_superadmin) values ('00000000-0000-4000-8000-0000000bc0c2', true)
             returning user_id::text$q$) r) x
union all
select 'Admin: ett barnkonto görs inte till admin från vyn', r like 'FEL%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000000ad', null,
          $q$select public.gor_till_admin('00000000-0000-4000-8000-0000000bc0c2', '{leads}')::text$q$) r) x
union all
select 'Admin: en icke-admin skriver inte i admin_roller', r like 'FEL 42501%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000000f1', null,
          $q$insert into public.admin_roller (user_id, ar_superadmin) values ('00000000-0000-4000-8000-0000000000f1', true)
             returning user_id::text$q$) r) x
union all
select 'Admin: en icke-admin gör sig inte till admin med gor_till_admin', r like 'FEL 42501%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000000f1', null,
          $q$select public.gor_till_admin('00000000-0000-4000-8000-0000000000f1', '{}', true)::text$q$) r) x
union all
select 'Admin: en icke-admin gör sig inte till admin på profilen', r = 'false|false', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000000f1', null,
          $q$with u as (update public.profiles set is_admin = true where id = '00000000-0000-4000-8000-0000000000f1' returning is_admin)
             select coalesce((select is_admin::text from u), 'ingen rad') || '|' || public.is_admin()::text$q$) r) x
union all
select 'Admin: en begränsad admin gör sig inte till superadmin på profilen', r = 'false|false', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad2', null,
          $q$with u as (update public.profiles set is_admin = true where id = '00000000-0000-4000-8000-0000000bcad2' returning is_admin)
             select coalesce((select is_admin::text from u), 'ingen rad') || '|' || public.is_admin()::text$q$) r) x
union all
select 'Admin: en superadmin ändrar inte behörigheter på profilen', r like 'FEL 42501%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000000ad', null,
          $q$update public.profiles set is_admin = true where id = '00000000-0000-4000-8000-0000000bcad6' returning id::text$q$) r) x
union all
select 'Admin: en begränsad admin ser bara sin egen roll utan admin_hantera', r = '1', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad1', null,
          $q$select count(*)::text from public.admin_roller$q$) r) x
union all
select 'Admin hantera: ser alla roller', pg_temp.i(r) >= 5, r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad2', null,
          $q$select count(*)::text from public.admin_roller$q$) r) x;

-- ------------------------------------------------------------
-- 13. Adminloggen skrivs av databasen och går inte att ändra
-- ------------------------------------------------------------
insert into utfall (test, ok, detalj)
select 'Adminlogg: en ny admin loggas med vem och vad', r = 'skapad|00000000-0000-4000-8000-0000000000ad|gor_till_admin|["leads"]', r
  from (select pg_temp.som(null,
          array[$q$select pg_temp.bli('00000000-0000-4000-8000-0000000000ad')$q$,
                $q$select public.gor_till_admin('00000000-0000-4000-8000-0000000bcad6', '{leads}')$q$,
                'reset role'],
          $q$select handling || '|' || aktor || '|' || (detaljer ->> 'via') || '|' || (detaljer -> 'efter' -> 'behorigheter')::text
               from public.admin_logg where mal_anvandare = '00000000-0000-4000-8000-0000000bcad6'
              order by id desc limit 1$q$) r) x
union all
select 'Adminlogg: en ändring och en borttagning loggas', r = 'andrad,borttagen', r
  from (select pg_temp.som(null,
          array[$q$select pg_temp.bli('00000000-0000-4000-8000-0000000000ad')$q$,
                $q$select public.gor_till_admin('00000000-0000-4000-8000-0000000bcad4', '{notiskonfig,leads}')$q$,
                $q$select public.ta_bort_admin('00000000-0000-4000-8000-0000000bcad4')$q$,
                'reset role'],
          $q$select string_agg(handling, ',' order by id) from public.admin_logg
              where mal_anvandare = '00000000-0000-4000-8000-0000000bcad4' and aktor = '00000000-0000-4000-8000-0000000000ad'$q$) r) x
union all
select 'Adminlogg: går inte att ändra', r like 'FEL 42501%', r
  from (select pg_temp.som(null, null,
          $q$update public.admin_logg set handling = 'andrad' returning id::text$q$) r) x
union all
select 'Adminlogg: går inte att radera', r like 'FEL 42501%', r
  from (select pg_temp.som(null, null, $q$delete from public.admin_logg returning id::text$q$) r) x
union all
select 'Adminlogg: går inte att tömma', r like 'FEL 42501%', r
  from (select pg_temp.som(null, null, $q$truncate public.admin_logg$q$) r) x
union all
select 'Adminlogg: en inloggad skriver inte i den', r like 'FEL 42501%', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000000ad', null,
          $q$insert into public.admin_logg (handling, mal_anvandare) values ('skapad', '00000000-0000-4000-8000-0000000000ad') returning id::text$q$) r) x
union all
select 'Adminlogg: läses inte utan admin_hantera', r = '0', r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad1', null, $q$select count(*)::text from public.admin_logg$q$) r) x
union all
select 'Adminlogg: läses med admin_hantera', pg_temp.i(r) > 0, r
  from (select pg_temp.som('00000000-0000-4000-8000-0000000bcad2', null, $q$select count(*)::text from public.admin_logg$q$) r) x;

reset role;
select set_config('request.jwt.claims', null, true);

-- ------------------------------------------------------------
-- 14. NexLäx i barnets vy (nexlax_for_barnet)
--
-- Barnet spelar själv: startar, svarar, ser rättningen, sitt läge och
-- sin bana, och bockar av en vanlig uppgift. Bara sitt eget, bara med
-- aktiv inloggning, och fortfarande utan tabellrättigheter (avsnitt 2).
-- Allt i ett block som rullas tillbaka; utfallet samlas i en variabel.
-- ------------------------------------------------------------
create function pg_temp.bli_barn(p_uid uuid, p_barn uuid, p_forald uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', p_uid, 'role', 'nextrum_barn',
    'app_metadata', json_build_object('roll', 'barn', 'barn_id', p_barn, 'forald_id', p_forald))::text, true);
  execute 'set local role nextrum_barn';
end $$;

do $$
declare
  ut     jsonb := '[]'::jsonb;
  fel    text;
  r      jsonb;
  forsok uuid;
  st     text;
  av     uuid;
  klar   timestamptz;
  E   constant uuid := '00000000-0000-4000-8000-0000000005a1';
  EQ  constant uuid := '00000000-0000-4000-8000-0000000005c1';
  KE  constant uuid := '00000000-0000-4000-8000-0000000bc0c1';
  P   constant uuid := '00000000-0000-4000-8000-0000000000f1';
  Q   constant uuid := '00000000-0000-4000-8000-0000000000f2';
  A   constant uuid := '00000000-0000-4000-8000-0000000000a1';
  N   constant uuid := '00000000-0000-4000-8000-00000000c4a1';
  F   constant uuid := '00000000-0000-4000-8000-00000000c4b1';
  FQ  constant uuid := '00000000-0000-4000-8000-00000000c4e1';
  HV  constant uuid := '00000000-0000-4000-8000-00000000c4c1';
  HD  constant uuid := '00000000-0000-4000-8000-00000000c4c2';
  HQ  constant uuid := '00000000-0000-4000-8000-00000000c4c3';
  HL  constant uuid := '00000000-0000-4000-8000-00000000c4c4';
  HF  constant uuid := '00000000-0000-4000-8000-00000000c4c5';
  ML  constant uuid := '00000000-0000-4000-8000-00000000c4d1';
  MF  constant uuid := '00000000-0000-4000-8000-00000000c4d2';
begin
  begin
    -- Fixturen, som postgres.
    insert into public.nivaer (id, nyckel, amne, arskurs, omrade, titel, ordning)
    values (N, 'rls-barnets-niva', 'Matematik', 'ak6', 'Bråk', 'RLS-barnets nivå', 1);
    insert into public.niva_fragor (id, niva_id, ordning, typ, fraga, alternativ, ratt, forklaring)
    values (F, N, 1, 'val', 'Vilket är störst?', '["1/2","1/3"]', '0', 'Halva är mest.');
    insert into public.biblioteksmaterial (id, titel, amne, arskurs, lank)
    values (ML, 'RLS-länk', 'Matematik', 'ak6', 'https://example.org/brak');
    insert into public.biblioteksmaterial (id, titel, amne, arskurs, filvag)
    values (MF, 'RLS-fil', 'Matematik', 'ak6', 'rls/hemlig-fil.pdf');
    insert into public.homework (id, student_id, tutor_id, title, niva_id, bibliotek_id) values
      (HV, E, A, 'RLS barnets vanliga', null, null),
      (HD, E, A, 'RLS barnets digitala', N, null),
      (HQ, EQ, A, 'RLS en annan familjs', null, null),
      (HL, E, A, 'RLS med länk', null, ML),
      (HF, E, A, 'RLS med fil', null, MF);
    insert into public.niva_forsok (id, niva_id, student_id, fragor)
    values (FQ, N, EQ, array[F]);

    perform pg_temp.bli_barn(KE, E, P);

    r := public.barn_nexlax();
    ut := ut || jsonb_build_object('t', 'NL barn: banan är barnets egen', 'ok',
            r ->> 'lage' = 'ok' and (r ->> 'elev')::uuid = E
            and jsonb_array_length(r -> 'katalog') > 0
            and exists (select 1 from jsonb_array_elements(r -> 'uppgifter') x where (x ->> 'id')::uuid = HV)
            and not exists (select 1 from jsonb_array_elements(r -> 'uppgifter') x where (x ->> 'student_id')::uuid <> E)
            and not exists (select 1 from jsonb_array_elements(r -> 'forsok') x where (x ->> 'student_id')::uuid <> E),
            'd', left(r::text, 200));
    ut := ut || jsonb_build_object('t', 'NL barn: material följer med som länk, aldrig som fil', 'ok',
            (select x -> 'biblioteksmaterial' ->> 'lank' from jsonb_array_elements(r -> 'uppgifter') x
              where (x ->> 'id')::uuid = HL) = 'https://example.org/brak'
            and (select x -> 'biblioteksmaterial' from jsonb_array_elements(r -> 'uppgifter') x
                  where (x ->> 'id')::uuid = HF) = 'null'::jsonb
            and position('hemlig-fil' in r::text) = 0 and position('filvag' in r::text) = 0,
            'd', null);

    -- Spela: starta, svara, se rättningen och läget.
    r := public.niva_starta(N, E);
    forsok := (r ->> 'forsok')::uuid;
    ut := ut || jsonb_build_object('t', 'NL barn: startar en nivå åt sig själv, utan facit', 'ok',
            forsok is not null and jsonb_array_length(r -> 'fragor') = 1
            and not exists (select 1 from jsonb_array_elements(r -> 'fragor') fr where fr ? 'ratt')
            and position('Halva' in r::text) = 0,
            'd', left(r::text, 200));
    r := public.barn_nexlax();
    ut := ut || jsonb_build_object('t', 'NL barn: det påbörjade försöket syns', 'ok',
            (r -> 'pagaende' -> N::text ->> 'forsok')::uuid = forsok
            and (r -> 'pagaende' -> N::text ->> 'totalt')::int = 1
            and (r -> 'pagaende' -> N::text ->> 'klara')::int = 0,
            'd', (r -> 'pagaende')::text);
    r := public.niva_svara(forsok, F, '{"val":0}');
    ut := ut || jsonb_build_object('t', 'NL barn: svarar, och nivån blir klar', 'ok',
            (r ->> 'ratt')::boolean and (r ->> 'klar')::boolean, 'd', left(r::text, 200));
    r := public.niva_genomgang(forsok);
    ut := ut || jsonb_build_object('t', 'NL barn: ser rättningen av sitt försök', 'ok', r ? 'fragor', 'd', null);
    r := public.nexlax_lage(E);
    ut := ut || jsonb_build_object('t', 'NL barn: ser sitt läge', 'ok', r is not null and r ? 'xp', 'd', left(coalesce(r::text, 'null'), 120));

    -- Bara sitt eget.
    begin
      perform public.niva_starta(N, EQ);
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'NL barn: startar ingen nivå åt ett annat barn', 'ok', fel = '42501', 'd', fel);
    begin
      perform public.niva_svara(FQ, F, '{"val":0}');
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'NL barn: svarar inte i ett annat barns försök', 'ok', fel = '42501', 'd', fel);
    begin
      perform public.niva_genomgang(FQ);
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'NL barn: ser inte ett annat barns rättning', 'ok', fel = '42501', 'd', fel);
    begin
      perform public.nexlax_lage(EQ);
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'NL barn: läser inte ett annat barns läge', 'ok', fel = '42501', 'd', fel);

    -- Bocka av.
    perform public.barn_uppgift(HV, 'klar');
    begin
      perform public.barn_uppgift(HD, 'pagaende');
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'NL barn: en digital uppgift bockas inte av', 'ok', fel = '42501', 'd', fel);
    begin
      perform public.barn_uppgift(HQ, 'klar');
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'NL barn: bockar inte ett annat barns uppgift', 'ok', fel = '42501', 'd', fel);
    begin
      perform public.barn_uppgift(HV, 'raderad');
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'NL barn: ett okänt läge nekas', 'ok', fel = '22023', 'd', fel);
    reset role;
    perform set_config('request.jwt.claims', null, true);

    select status, completed_at into st, klar from public.homework where id = HV;
    ut := ut || jsonb_build_object('t', 'NL barn: den vanliga uppgiften är bockad', 'ok', st = 'klar' and klar is not null, 'd', st);
    select status into st from public.homework where id = HD;
    ut := ut || jsonb_build_object('t', 'NL barn: en klarad nivå gör den digitala uppgiften klar', 'ok', st = 'klar', 'd', st);
    select startad_av into av from public.niva_forsok where id = forsok;
    ut := ut || jsonb_build_object('t', 'NL barn: barnets försök har ingen startad_av', 'ok', av is null, 'd', coalesce(av::text, 'null'));

    -- Föräldern spelar som förut, och står som den som startade.
    perform pg_temp.bli(P);
    r := public.niva_starta(N, E);
    reset role;
    perform set_config('request.jwt.claims', null, true);
    select startad_av into av from public.niva_forsok where id = (r ->> 'forsok')::uuid;
    ut := ut || jsonb_build_object('t', 'NL föräldern: startar som förut och står som startad_av', 'ok', av = P, 'd', coalesce(av::text, 'null'));

    -- En token som inte stämmer med tabellen: ingenting.
    perform pg_temp.bli_barn(KE, E, Q);
    r := public.barn_nexlax();
    begin
      perform public.niva_starta(N, E);
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'NL barn: fel familj i token ger ingen bana och ingen nivå', 'ok',
            r ->> 'lage' = 'saknas' and fel = '42501', 'd', (r ->> 'lage') || ' ' || fel);
    reset role;
    perform set_config('request.jwt.claims', null, true);

    -- Pausad inloggning: en token som fortfarande gäller spelar inte.
    update public.students set barn_aktiv = false where id = E;
    perform pg_temp.bli_barn(KE, E, P);
    r := public.barn_nexlax();
    begin
      perform public.niva_starta(N, E);
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'NL barn: en pausad inloggning får ingen bana och startar ingen nivå', 'ok',
            r ->> 'lage' = 'pausad' and fel = '42501', 'd', (r ->> 'lage') || ' ' || fel);
    begin
      perform public.barn_uppgift(HV, 'pagaende');
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'NL barn: en pausad inloggning bockar inte', 'ok', fel = '42501', 'd', fel);
    reset role;
    perform set_config('request.jwt.claims', null, true);

    -- Barnets två funktioner är bara barnets.
    ut := ut || jsonb_build_object('t', 'NL: barn_nexlax och barn_uppgift går inte att köra som vuxen eller anonym', 'ok',
            not has_function_privilege('authenticated', 'public.barn_nexlax()', 'execute')
            and not has_function_privilege('anon', 'public.barn_nexlax()', 'execute')
            and not has_function_privilege('authenticated', 'public.barn_uppgift(uuid, text)', 'execute')
            and not has_function_privilege('anon', 'public.barn_uppgift(uuid, text)', 'execute'),
            'd', null);

    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', null, true);

  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('NL NexLäx i barnets vy', false, fel);
  else
    insert into utfall (test, ok, detalj)
    select x ->> 't', (x ->> 'ok')::boolean, x ->> 'd' from jsonb_array_elements(ut) x;
  end if;
end $$;

reset role;
select set_config('request.jwt.claims', null, true);

-- ------------------------------------------------------------
-- 15. Barnets egen e-post (barnets_epost)
--
-- Föräldern lägger till, den som har inkorgen bekräftar, inloggningen
-- slår upp och räknar, kön tar barnets rader och prövar allt igen, och
-- ingen annan når adressen. Flaggan slås på och av här inne. Allt i ett
-- block som rullas tillbaka; utfallet samlas i en variabel.
--
-- Inga alias som e, p, q, a eller y nedan: PL/pgSQL skiljer inte på
-- stora och små bokstäver, och konstanterna heter så.
-- ------------------------------------------------------------
do $$
declare
  ut    jsonb := '[]'::jsonb;
  fel   text;
  r     jsonb;
  bk    text;
  bk2   text;
  rad   record;
  n     integer;
  E     constant uuid := '00000000-0000-4000-8000-0000000005a1';
  Y     constant uuid := '00000000-0000-4000-8000-0000000005b1';
  EQ    constant uuid := '00000000-0000-4000-8000-0000000005c1';
  KE    constant uuid := '00000000-0000-4000-8000-0000000bc0c1';
  P     constant uuid := '00000000-0000-4000-8000-0000000000f1';
  Q     constant uuid := '00000000-0000-4000-8000-0000000000f2';
  A     constant uuid := '00000000-0000-4000-8000-0000000000a1';
  PASS1 constant uuid := '00000000-0000-4000-8000-00000000e5a1';
begin
  begin
    -- Flaggan av: ingen adress går att lägga till.
    update public.flaggor set aktiv = false where flaggor.kod = 'barn_epost';
    perform pg_temp.bli(P);
    begin
      perform public.barn_epost_satt(E, 'alva@example.org');
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BE: med flaggan av går ingen adress att lägga till', 'ok', fel = '55000', 'd', fel);
    reset role;
    perform set_config('request.jwt.claims', null, true);

    update public.flaggor set aktiv = true where flaggor.kod in ('barn_epost', 'notiser_mejl');
    update public.notis_drift set mejl_sandlada = null where notis_drift.id = 1;

    -- Föräldern lägger till.
    perform pg_temp.bli(P);
    r := public.barn_epost_satt(E, '  Alva@Example.ORG ');
    ut := ut || jsonb_build_object('t', 'BE förälder: lägger till barnets adress, i små bokstäver och obekräftad', 'ok',
            r ->> 'epost' = 'alva@example.org' and r ->> 'bekraftad' is null and not (r ->> 'notiser')::boolean,
            'd', left(r::text, 200));
    begin
      perform public.barn_epost_satt(Y, 'yngst@example.org');
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BE förälder: ett barn utan inloggning får ingen adress', 'ok', fel = '55000', 'd', fel);
    begin
      perform public.barn_epost_satt(E, 'RLS-P@example.invalid');
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BE förälder: förälderns egen adress nekas', 'ok', fel = '22023', 'd', fel);
    begin
      perform public.barn_epost_satt(E, 'nagon@barn.nextrum.se');
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BE förälder: en teknisk barnadress nekas', 'ok', fel = '22023', 'd', fel);
    begin
      perform public.barn_epost_satt(E, 'inte en adress');
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BE förälder: något som inte är en adress nekas', 'ok', fel = '22023', 'd', fel);
    begin
      perform public.barn_epost_skicka_igen(E);
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BE förälder: ett nytt bekräftelsemejl inom en minut nekas', 'ok', fel = 'P0001', 'd', fel);
    reset role;
    perform set_config('request.jwt.claims', null, true);

    -- En annan förälder, studiehjälparen och barnet.
    perform pg_temp.bli(Q);
    begin
      perform public.barn_epost_satt(E, 'q@example.org');
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BE: en annan förälder lägger inte till en adress åt barnet', 'ok', fel = '42501', 'd', fel);
    begin
      perform public.barn_epost_ta_bort(E);
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BE: en annan förälder tar inte bort barnets adress', 'ok', fel = '42501', 'd', fel);
    r := public.mina_barns_epost();
    ut := ut || jsonb_build_object('t', 'BE: en annan förälder ser inte barnets adress', 'ok',
            position('alva@' in r::text) = 0, 'd', left(r::text, 200));
    reset role;
    perform set_config('request.jwt.claims', null, true);

    perform pg_temp.bli(A);
    begin
      perform count(*) from public.barn_epost;
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BE: studiehjälparen läser inte barn_epost', 'ok', fel = '42501', 'd', fel);
    reset role;
    perform set_config('request.jwt.claims', null, true);

    perform pg_temp.bli_barn(KE, E, P);
    begin
      perform count(*) from public.barn_epost;
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BE: barnet läser inte barn_epost direkt', 'ok', fel = '42501', 'd', fel);
    begin
      perform public.barn_epost_satt(E, 'jag@example.org');
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BE: barnet lägger inte till eller byter adressen', 'ok', fel = '42501', 'd', fel);
    reset role;
    perform set_config('request.jwt.claims', null, true);

    -- Kön: bekräftelsen väntar, utan adress och utan kod.
    select ue.* into rad from public.notis_utskick ue
     where ue.barn_id = E and ue.typ = 'barn_bekrafta_epost' and ue.status = 'vantar';
    ut := ut || jsonb_build_object('t', 'BE kön: bekräftelsen väntar, utan adress och utan kod', 'ok',
            rad.id is not null and rad.mottagare is null and position('alva' in rad.data::text) = 0
            and not (rad.data ? 'kod') and rad.data ? 'omgang',
            'd', coalesce(rad.data::text, 'ingen rad'));

    select * into rad from public.notis_utskick_ta(100) tx where tx.mottagare = E;
    bk := rad.data ->> 'kod';
    ut := ut || jsonb_build_object('t', 'BE kön: bekräftelsen går till barnets adress, med koden och utan namn', 'ok',
            rad.roll = 'barn' and rad.epost = 'alva@example.org' and rad.fornamn is null
            and bk ~ ('^' || E::text || '\.[A-Za-z0-9_-]{43}$'),
            'd', coalesce(rad.roll, '') || ' ' || coalesce(rad.epost, '') || ' ' || coalesce(bk, ''));

    -- Bekräftelsen, utan inloggning.
    perform pg_temp.bli(null);
    ut := ut || jsonb_build_object('t', 'BE: en ändrad eller trasig kod bekräftar ingenting', 'ok',
            public.barn_epost_bekrafta(left(bk, length(bk) - 1) || case when right(bk, 1) = 'A' then 'B' else 'A' end) = 'ogiltig'
            and public.barn_epost_bekrafta(EQ::text || substr(bk, 37)) = 'ogiltig'
            and public.barn_epost_bekrafta('skräp') = 'ogiltig'
            and public.barn_epost_bekrafta(null) = 'ogiltig',
            'd', null);
    ut := ut || jsonb_build_object('t', 'BE: koden bekräftar adressen, utan inloggning', 'ok',
            public.barn_epost_bekrafta(bk) = 'ok', 'd', null);
    ut := ut || jsonb_build_object('t', 'BE: samma kod en gång till säger redan', 'ok',
            public.barn_epost_bekrafta(bk) = 'redan', 'd', null);
    reset role;
    perform set_config('request.jwt.claims', null, true);

    ut := ut || jsonb_build_object('t', 'BE: händelserna loggas, adressen aldrig', 'ok',
            (select count(*) from public.audit_logg al where al.tabell = 'barn_epost' and al.objekt_id = E::text) >= 2
            and not exists (select 1 from public.audit_logg al where al.tabell = 'barn_epost'
                             and (coalesce(al.fore::text, '') || coalesce(al.efter::text, '')) like '%example%'),
            'd', null);

    -- Inloggningen: uppslaget och spärrarna.
    r := public.barn_inloggning_uppslag(' ALVA@example.org', '192.0.2.1');
    ut := ut || jsonb_build_object('t', 'BE inloggning: en bekräftad adress ger barnets tekniska adress', 'ok',
            r ->> 'lage' = 'ok' and r ->> 'adress' = 'aldst.p@barn.nextrum.se', 'd', left(r::text, 120));
    perform public.barn_inloggning_lyckades(r ->> 'e', r ->> 'i');
    ut := ut || jsonb_build_object('t', 'BE inloggning: en lyckad inloggning nollar adressens försök', 'ok',
            not exists (select 1 from intern.barn_inloggning_forsok f where f.nyckel = r ->> 'e'), 'd', null);
    r := public.barn_inloggning_uppslag('okand@example.org', '192.0.2.2');
    ut := ut || jsonb_build_object('t', 'BE inloggning: en okänd adress ger inget', 'ok',
            r ->> 'lage' = 'okand' and not (r ? 'adress'), 'd', left(r::text, 120));
    for n in 1 .. 9 loop
      perform public.barn_inloggning_uppslag('okand@example.org', '192.0.2.' || (10 + n));
    end loop;
    r := public.barn_inloggning_uppslag('okand@example.org', '192.0.2.99');
    ut := ut || jsonb_build_object('t', 'BE inloggning: tio försök på en adress, sedan nekas den en stund', 'ok',
            r ->> 'lage' = 'sparrad', 'd', r ->> 'lage');
    for n in 1 .. 20 loop
      perform public.barn_inloggning_uppslag('nummer' || n || '@example.org', '198.51.100.7');
    end loop;
    r := public.barn_inloggning_uppslag('alva@example.org', '198.51.100.7');
    ut := ut || jsonb_build_object('t', 'BE inloggning: tjugo försök från ett nummer, sedan nekas det en stund', 'ok',
            r ->> 'lage' = 'sparrad', 'd', r ->> 'lage');
    ut := ut || jsonb_build_object('t', 'BE inloggning: försöken sparas utan adress och nummer', 'ok',
            not exists (select 1 from intern.barn_inloggning_forsok f
                         where f.nyckel like '%example%' or f.nyckel like '%198.51%' or f.nyckel like '%192.0%')
            and not exists (select 1 from intern.barn_inloggning_forsok f where f.nyckel !~ '^[ei]:[0-9a-f]{64}$'),
            'd', null);

    -- Barnets inställningar och val.
    perform pg_temp.bli_barn(KE, E, P);
    r := public.barn_installningar();
    ut := ut || jsonb_build_object('t', 'BE barnet: ser sin bekräftade adress och att mejlen inte är påslagna', 'ok',
            r ->> 'lage' = 'ok' and r ->> 'epost' = 'alva@example.org' and r ->> 'bekraftad' is not null
            and not (r ->> 'notiser')::boolean and jsonb_array_length(r -> 'typer') = 3
            and not exists (select 1 from jsonb_array_elements(r -> 'typer') x where not (x ->> 'pa')::boolean),
            'd', left(r::text, 200));
    r := public.barn_notisval('barn_paminnelse', false);
    ut := ut || jsonb_build_object('t', 'BE barnet: stänger av påminnelserna själv', 'ok',
            exists (select 1 from jsonb_array_elements(r -> 'typer') x
                     where x ->> 'typ' = 'barn_paminnelse' and not (x ->> 'pa')::boolean),
            'd', (r -> 'typer')::text);
    begin
      perform public.barn_notisval('pass_nytt', false);
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BE barnet: en sort som inte är barnets nekas', 'ok', fel = '22023', 'd', fel);
    begin
      perform public.barn_epost_notiser(E, true);
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BE barnet: slår inte på mejlen åt sig själv', 'ok', fel = '42501', 'd', fel);
    reset role;
    perform set_config('request.jwt.claims', null, true);

    perform pg_temp.bli_barn(KE, E, Q);
    r := public.barn_installningar();
    begin
      perform public.barn_notisval('barn_pass_bokat', false);
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BE barnet: fel familj i token ger inga inställningar och inga val', 'ok',
            r ->> 'lage' = 'saknas' and fel = '42501', 'd', (r ->> 'lage') || ' ' || fel);
    reset role;
    perform set_config('request.jwt.claims', null, true);

    -- Föräldern slår på barnets mejl.
    perform pg_temp.bli(P);
    r := public.barn_epost_notiser(E, true);
    ut := ut || jsonb_build_object('t', 'BE förälder: slår på barnets mejl', 'ok', (r ->> 'notiser')::boolean, 'd', left(r::text, 200));
    r := public.mina_barns_epost();
    ut := ut || jsonb_build_object('t', 'BE förälder: ser flaggan, adressen och att den är bekräftad', 'ok',
            (r ->> 'pa')::boolean
            and exists (select 1 from jsonb_array_elements(r -> 'barn') x
                         where (x ->> 'barn_id')::uuid = E and x ->> 'epost' = 'alva@example.org' and x ->> 'bekraftad' is not null)
            and not exists (select 1 from jsonb_array_elements(r -> 'barn') x where (x ->> 'barn_id')::uuid = Y),
            'd', left(r::text, 300));
    reset role;
    perform set_config('request.jwt.claims', null, true);

    ut := ut || jsonb_build_object('t', 'BE: barnet vill ha bokade pass men inte påminnelser, och ett annat barn ingenting', 'ok',
            intern.barn_vill_mejl(E, 'barn_pass_bokat') and not intern.barn_vill_mejl(E, 'barn_paminnelse')
            and not intern.barn_vill_mejl(EQ, 'barn_pass_bokat') and not intern.barn_vill_mejl(E, 'pass_nytt'),
            'd', null);

    -- Ett bokat pass köar ett mejl till barnet; avbokat inom samlingstiden blir ett.
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, subject, wanted_date, wanted_time,
                                 duration_min, status)
    values (PASS1, P, A, E, P, 'Matematik', current_date + 20, '17:00', 60, 'confirmed');
    select ue.* into rad from public.notis_utskick ue where ue.barn_id = E and ue.pass_id = PASS1 and ue.status = 'vantar';
    ut := ut || jsonb_build_object('t', 'BE kön: ett bokat pass köar ett mejl till barnet, utan betalning och adress', 'ok',
            rad.typ = 'barn_pass_bokat' and rad.data ->> 'tid' = '17:00'
            and rad.data ->> 'datum' = (current_date + 20)::text and rad.data ->> 'amne' = 'Matematik'
            and not (rad.data ? 'betalsatt') and position('example' in rad.data::text) = 0,
            'd', coalesce(rad.typ, 'ingen rad') || ' ' || coalesce(rad.data::text, ''));
    update public.bookings set status = 'cancelled', avbokningsskal = 'forhinder' where bookings.id = PASS1;
    select count(*), max(ue.typ) into n, fel from public.notis_utskick ue
     where ue.barn_id = E and ue.pass_id = PASS1 and ue.status = 'vantar';
    ut := ut || jsonb_build_object('t', 'BE kön: avbokat inom samlingstiden blir ett mejl, om avbokningen', 'ok',
            n = 1 and fel = 'barn_pass_avbokat', 'd', n || ' ' || coalesce(fel, ''));

    -- Kön prövar igen när det är dags: en pausad inloggning får inget.
    update public.notis_utskick ue set skicka_efter = now() where ue.barn_id = E and ue.pass_id = PASS1 and ue.status = 'vantar';
    update public.students set barn_aktiv = false where students.id = E;
    perform * from public.notis_utskick_ta(100);
    select ue.status, ue.fel into rad from public.notis_utskick ue where ue.barn_id = E and ue.pass_id = PASS1;
    ut := ut || jsonb_build_object('t', 'BE kön: en pausad inloggning får inget mejl, prövat när det ska gå', 'ok',
            rad.status = 'hoppad' and rad.fel = 'avstängt för barnet',
            'd', coalesce(rad.status, '') || ' ' || coalesce(rad.fel, ''));
    update public.students set barn_aktiv = true where students.id = E;

    -- Avanmälan ur mejlet: bara av, bara barnets.
    perform public.barn_notis_avregistrera(E, 'barn_pass_bokat');
    ut := ut || jsonb_build_object('t', 'BE avanmälan: stänger av en sort för barnet', 'ok',
            not intern.barn_vill_mejl(E, 'barn_pass_bokat') and intern.barn_vill_mejl(E, 'barn_pass_avbokat'), 'd', null);
    begin
      perform public.barn_notis_avregistrera(Y, 'barn_pass_bokat');
      fel := 'gick';
    exception when others then fel := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BE avanmälan: ett barn utan adress ger ogiltig', 'ok', fel = '22023', 'd', fel);

    -- Samma adress för ett annat barn, och en gammal kod.
    perform pg_temp.bli(Q);
    perform public.barn_epost_satt(EQ, 'alva@example.org');
    reset role;
    perform set_config('request.jwt.claims', null, true);
    select * into rad from public.notis_utskick_ta(100) tx where tx.mottagare = EQ;
    bk2 := rad.data ->> 'kod';
    perform pg_temp.bli(null);
    ut := ut || jsonb_build_object('t', 'BE: en adress som är bekräftad för ett annat barn går inte att bekräfta igen', 'ok',
            public.barn_epost_bekrafta(bk2) = 'upptagen', 'd', null);
    reset role;
    perform set_config('request.jwt.claims', null, true);
    update public.barn_epost set kod_skapad = now() - interval '8 days' where barn_epost.barn_id = EQ;
    perform pg_temp.bli(null);
    ut := ut || jsonb_build_object('t', 'BE: en kod äldre än sju dagar bekräftar inte', 'ok',
            public.barn_epost_bekrafta(bk2) = 'gammal', 'd', null);
    reset role;
    perform set_config('request.jwt.claims', null, true);

    -- Gallringen.
    perform intern.barnkonton_gallra();
    ut := ut || jsonb_build_object('t', 'BE gallring: en obekräftad adress står kvar efter åtta dagar', 'ok',
            exists (select 1 from public.barn_epost be2 where be2.barn_id = EQ), 'd', null);
    update public.barn_epost set kod_skapad = now() - interval '31 days' where barn_epost.barn_id = EQ;
    insert into intern.barn_inloggning_forsok (nyckel, tid) values ('e:' || repeat('0', 64), now() - interval '2 days');
    perform intern.barnkonton_gallra();
    ut := ut || jsonb_build_object('t', 'BE gallring: obekräftad efter 30 dagar och försök efter ett dygn tas bort', 'ok',
            not exists (select 1 from public.barn_epost be2 where be2.barn_id = EQ)
            and not exists (select 1 from intern.barn_inloggning_forsok f where f.tid < now() - interval '1 day')
            and exists (select 1 from public.barn_epost be2 where be2.barn_id = E),
            'd', null);

    -- Flaggan av: inloggningen och mejlen stannar, men föräldern kan
    -- alltid slå av och ta bort.
    update public.flaggor set aktiv = false where flaggor.kod = 'barn_epost';
    r := public.barn_inloggning_uppslag('alva@example.org', '192.0.2.50');
    ut := ut || jsonb_build_object('t', 'BE flaggan av: inloggningen med barnets adress nekas', 'ok', r ->> 'lage' = 'av', 'd', r ->> 'lage');
    ut := ut || jsonb_build_object('t', 'BE flaggan av: inga mejl till barnet', 'ok',
            not intern.barn_vill_mejl(E, 'barn_pass_avbokat'), 'd', null);
    perform pg_temp.bli(P);
    r := public.barn_epost_notiser(E, false);
    perform public.barn_epost_ta_bort(E);
    reset role;
    perform set_config('request.jwt.claims', null, true);
    ut := ut || jsonb_build_object('t', 'BE flaggan av: föräldern slår av och tar bort adressen ändå', 'ok',
            not exists (select 1 from public.barn_epost be2 where be2.barn_id = E), 'd', null);

    -- Inloggningen borta: adressen och barnets rader i kön följer med.
    insert into public.barn_epost (barn_id, epost, kod_omgang, bekraftad) values (E, 'alva@example.org', 1, now());
    delete from auth.users where users.id = KE;
    ut := ut || jsonb_build_object('t', 'BE: tas inloggningen bort följer adressen och barnets rader i kön med', 'ok',
            not exists (select 1 from public.barn_epost be2 where be2.barn_id = E)
            and not exists (select 1 from public.notis_utskick ue where ue.barn_id = E),
            'd', null);

    ut := ut || jsonb_build_object('t', 'BE rättigheter: tabellen och uppslaget är stängda, länken öppen', 'ok',
            not has_table_privilege('authenticated', 'public.barn_epost', 'select')
            and not has_table_privilege('anon', 'public.barn_epost', 'select')
            and not has_table_privilege('nextrum_barn', 'public.barn_epost', 'select')
            and not has_function_privilege('anon', 'public.barn_inloggning_uppslag(text, text)', 'execute')
            and not has_function_privilege('authenticated', 'public.barn_inloggning_uppslag(text, text)', 'execute')
            and not has_function_privilege('nextrum_barn', 'public.barn_inloggning_uppslag(text, text)', 'execute')
            and not has_function_privilege('authenticated', 'public.barn_inloggning_lyckades(text, text)', 'execute')
            and not has_function_privilege('authenticated', 'public.barn_notis_avregistrera(uuid, text)', 'execute')
            and not has_function_privilege('authenticated', 'public.barn_installningar()', 'execute')
            and not has_function_privilege('anon', 'public.barn_epost_satt(uuid, text)', 'execute')
            and has_function_privilege('anon', 'public.barn_epost_bekrafta(text)', 'execute')
            and has_function_privilege('nextrum_barn', 'public.barn_installningar()', 'execute'),
            'd', null);

    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', null, true);

  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('BE Barnets egen e-post', false, fel);
  else
    insert into utfall (test, ok, detalj)
    select x ->> 't', (x ->> 'ok')::boolean, x ->> 'd' from jsonb_array_elements(ut) x;
  end if;
end $$;

-- ------------------------------------------------------------
-- 16. Mejlen till admin (admin_paminnelser, 2026-10-02)
--
-- En jobbansökan mejlas direkt av triggern admin_ansokan_direkt, och det
-- som ligger kvar i Att göra går i ETT mejl kl. 9 svensk tid
-- (intern.admin_paminnelse_kor(), som får klockan som argument så att
-- sommartid, vintertid och 08:59 går att prova). Proven mäter listan mot
-- fixturerna, att en intresseanmälan och en ansökan aldrig kommer i
-- morgonmejlet, klockan, att en sak mejlas en gång, direktmejlet och
-- bromsen, vilka som får mejlet, och att ingen inloggad når tabellerna
-- eller dörrarna.
--
-- Adressen till funktionen töms överst i filen, så att
-- intern.admin_paminnelse_skicka() returnerar innan pg_net anropas:
-- sviten ska aldrig kunna bli ett mejl.
-- ------------------------------------------------------------

-- Vem som läser: tabellerna fylls av jobbet, och en inloggad får bara
-- läsa om hen är superadmin.
select pg_temp.prova_med('AP superadmin läser listan', array['select intern.admin_paminnelse_kor(''2026-10-02 12:00:00+00'')'],
  '00000000-0000-4000-8000-0000000000ad', array['select * from public.admin_paminnelser'], 'ok');
select pg_temp.prova_med('AP familjen läser inte listan', array['select intern.admin_paminnelse_kor(''2026-10-02 12:00:00+00'')'],
  '00000000-0000-4000-8000-0000000000f1', array['select * from public.admin_paminnelser'], 'nekad');
select pg_temp.prova_med('AP studiehjälparen läser inte listan', array['select intern.admin_paminnelse_kor(''2026-10-02 12:00:00+00'')'],
  '00000000-0000-4000-8000-0000000000a1', array['select * from public.admin_paminnelser'], 'nekad');
select pg_temp.prova('AP anon läser inte listan', null,
  array['select * from public.admin_paminnelser'], 'nekad');

select pg_temp.prova_med('AP superadmin läser utskicken',
  array['insert into public.admin_paminnelse_utskick (antal) values (''{"ny_lead": 1}'')'],
  '00000000-0000-4000-8000-0000000000ad', array['select * from public.admin_paminnelse_utskick'], 'ok');
select pg_temp.prova_med('AP familjen läser inte utskicken',
  array['insert into public.admin_paminnelse_utskick (antal) values (''{"ny_lead": 1}'')'],
  '00000000-0000-4000-8000-0000000000f1', array['select * from public.admin_paminnelse_utskick'], 'nekad');
select pg_temp.prova('AP anon läser inte utskicken', null,
  array['select * from public.admin_paminnelse_utskick'], 'nekad');

-- Ingen skriver: inte ens en superadmin. Det gör jobbet, och bara det.
select pg_temp.prova('AP superadmin skriver inte i listan', '00000000-0000-4000-8000-0000000000ad',
  array['insert into public.admin_paminnelser (typ, objekt_id) values (''ny_lead'', ''x'')'], 'nekad');
select pg_temp.prova('AP superadmin ändrar inte listan', '00000000-0000-4000-8000-0000000000ad',
  array['update public.admin_paminnelser set mejlad_at = now()'], 'nekad');
select pg_temp.prova('AP superadmin tar inte bort ur listan', '00000000-0000-4000-8000-0000000000ad',
  array['delete from public.admin_paminnelser'], 'nekad');
select pg_temp.prova('AP superadmin skriver inte i utskicken', '00000000-0000-4000-8000-0000000000ad',
  array['insert into public.admin_paminnelse_utskick (antal) values (''{"ny_lead": 1}'')'], 'nekad');
select pg_temp.prova('AP superadmin ändrar inte utskicken', '00000000-0000-4000-8000-0000000000ad',
  array['update public.admin_paminnelse_utskick set status = ''skickad'''], 'nekad');

-- Dörrarna är bara för service_role, och jobbet bara för schemat.
select pg_temp.prova('AP superadmin tar inte en rad', '00000000-0000-4000-8000-0000000000ad',
  array['select * from public.admin_paminnelse_ta(gen_random_uuid())'], 'nekad');
select pg_temp.prova('AP familjen tar inte en rad', '00000000-0000-4000-8000-0000000000f1',
  array['select * from public.admin_paminnelse_ta(gen_random_uuid())'], 'nekad');
select pg_temp.prova('AP anon tar inte en rad', null,
  array['select * from public.admin_paminnelse_ta(gen_random_uuid())'], 'nekad');
select pg_temp.prova('AP superadmin kvitterar inget utfall', '00000000-0000-4000-8000-0000000000ad',
  array['select public.admin_paminnelse_klar(gen_random_uuid(), true, null, null, false)'], 'nekad');
select pg_temp.prova('AP anon kvitterar inget utfall', null,
  array['select public.admin_paminnelse_klar(gen_random_uuid(), true, null, null, false)'], 'nekad');
select pg_temp.prova('AP superadmin kör inte jobbet', '00000000-0000-4000-8000-0000000000ad',
  array['select intern.admin_paminnelse_koa()'], 'nekad');
select pg_temp.prova('AP superadmin kör inte jobbet med en egen klocka', '00000000-0000-4000-8000-0000000000ad',
  array['select intern.admin_paminnelse_kor(now())'], 'nekad');
select pg_temp.prova('AP anon kör inte jobbet', null,
  array['select intern.admin_paminnelse_koa()'], 'nekad');
-- Den som söker jobb är anon. Triggern får aldrig stoppa ansökan, och anon får inte behöva
-- något i schemat intern för att den ska gå igenom.
select pg_temp.prova('AP anon kan skicka en ansökan: triggern som mejlar admin stoppar den inte', null,
  array['insert into public.applications (name, email) values (''Prov Anon'', ''ap-anon@example.invalid'')'], 'ok');
select pg_temp.prova('AP superadmin läser inte listan genom funktionen', '00000000-0000-4000-8000-0000000000ad',
  array['select * from intern.admin_att_gora()'], 'nekad');
select pg_temp.prova('AP superadmin kör inte rensningen', '00000000-0000-4000-8000-0000000000ad',
  array['select intern.admin_paminnelse_stada()'], 'nekad');

insert into utfall (test, ok, detalj)
select 'AP jobbet går var femte minut', count(*) = 1, coalesce(string_agg(schedule || ' ' || command, '; '), 'inget jobb')
  from cron.job
 where jobname = 'admin-paminnelse' and active and schedule = '*/5 * * * *'
   and command = 'select intern.admin_paminnelse_koa()';

do $$
declare
  ut    jsonb := '[]'::jsonb;
  fel   text;
  n     integer;
  rap   uuid;
  utsk  uuid;
  mott  text[];
  ant   jsonb;
  P     constant uuid := '00000000-0000-4000-8000-0000000000f1';
  A     constant uuid := '00000000-0000-4000-8000-0000000000a1';
  -- Egna rader: ett gemensamt pass eller barn kan ha ändrats av ett prov
  -- ovanför, och det här blocket ska inte bero på det.
  PASS1 constant uuid := '00000000-0000-4000-8000-0000000a9c01';
  PASS2 constant uuid := '00000000-0000-4000-8000-0000000a9c02';
  PASS3 constant uuid := '00000000-0000-4000-8000-0000000a9c03';
  PASS4 constant uuid := '00000000-0000-4000-8000-0000000a9c04';
  ELEV  constant uuid := '00000000-0000-4000-8000-0000000a9a01';
  ELEV2 constant uuid := '00000000-0000-4000-8000-0000000a9a02';
  RAP0  constant uuid := '00000000-0000-4000-8000-0000000a9b01';
begin
  begin
    insert into public.students (id, parent_id, name, matched_tutor_id, match_status) values
      (ELEV,  P, 'AP matchad', A, 'matched'),
      (ELEV2, P, 'AP omatchad', null, 'pending');
    insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min, status) values
      (PASS1, P, A, ELEV, P, (now() at time zone 'Europe/Stockholm')::date - 5, '10:00', 60, 'confirmed'),
      (PASS2, P, A, ELEV, P, (now() at time zone 'Europe/Stockholm')::date - 5, '11:30', 60, 'cancelled'),
      (PASS3, P, A, ELEV, P, (now() at time zone 'Europe/Stockholm')::date - 5, '13:00', 60, 'completed'),
      (PASS4, P, A, ELEV, P, (now() at time zone 'Europe/Stockholm')::date + 9, '10:00', 60, 'confirmed');
    insert into public.lesson_reports (id, student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro)
    values (RAP0, ELEV, A, null, 'fixtur', current_date, null);

    -- Samma utgångsläge i en tom databas och i driften: allt som redan
    -- står i listan är mejlat, och inga utskick finns kvar att räkna.
    -- Klockan 14 svensk tid, så att körningen aldrig skriver ett morgonmejl, vad klockan än är när sviten går.
    perform intern.admin_paminnelse_kor('2026-10-02 12:00:00+00');
    update public.admin_paminnelser set mejlad_at = now() where mejlad_at is null;
    delete from public.admin_paminnelse_utskick;

    -- Listan mot fixturerna.
    ut := ut || jsonb_build_object('t', 'AP Att göra: ett bekräftat pass igår utan rapport kommer med', 'ok',
            exists (select 1 from intern.admin_att_gora() al where al.typ = 'pass_saknar_rapport' and al.objekt_id = PASS1::text), 'd', null);
    ut := ut || jsonb_build_object('t', 'AP Att göra: avbokade, genomförda och kommande pass kommer inte med', 'ok',
            not exists (select 1 from intern.admin_att_gora() al where al.typ = 'pass_saknar_rapport'
                        and al.objekt_id in (PASS2::text, PASS3::text, PASS4::text)), 'd', null);
    ut := ut || jsonb_build_object('t', 'AP Att göra: ett barn utan studiehjälpare kommer med, ett matchat inte', 'ok',
            exists (select 1 from intern.admin_att_gora() al where al.typ = 'elev_utan_sh' and al.objekt_id = ELEV2::text)
            and not exists (select 1 from intern.admin_att_gora() al where al.typ = 'elev_utan_sh' and al.objekt_id = ELEV::text), 'd', null);

    -- Rapporten som familjen inte bekräftat: med i listan tills den bekräftas.
    rap := RAP0;
    ut := ut || jsonb_build_object('t', 'AP Att göra: en rapport utan bekräftelse kommer med', 'ok',
            exists (select 1 from intern.admin_att_gora() al where al.typ = 'rapport_obekraftad' and al.objekt_id = rap::text), 'd', null);
    insert into public.rapport_bekraftelser (rapport_id, foralder_id) values (rap, P);
    ut := ut || jsonb_build_object('t', 'AP Att göra: en bekräftad rapport tas ur listan', 'ok',
            not exists (select 1 from intern.admin_att_gora() al where al.typ = 'rapport_obekraftad' and al.objekt_id = rap::text), 'd', null);

    -- Intresseanmälan och ansökan mejlas direkt och står aldrig i morgonmejlets lista.
    insert into public.leads (parent_name, email, child_name, grade, subject, tjanst, status)
    values ('Prov Pia', 'ap-prov@example.invalid', 'Prov Pelle', 'Åk 5', 'Matte', 'laxhjalp', 'new');
    delete from public.admin_paminnelse_utskick;
    insert into public.applications (name, email) values ('Prov Per', 'ap-ans@example.invalid');
    ut := ut || jsonb_build_object('t', 'AP Att göra i databasen har varken intresseanmälan eller ansökan', 'ok',
            not exists (select 1 from intern.admin_att_gora() al where al.typ in ('ny_lead', 'ny_ansokan')), 'd', null);

    -- Direktmejlet: en ansökan, ett mejl, utan en uppgift om vem som sökt.
    ut := ut || jsonb_build_object('t', 'AP en ansökan ger ETT direktmejl, utan uppgifter om vem', 'ok',
            (select count(*) from public.admin_paminnelse_utskick where slag = 'direkt') = 1
            and (select antal from public.admin_paminnelse_utskick where slag = 'direkt') = '{"ny_ansokan": 1}'::jsonb, 'd', null);
    update public.applications set name = 'Prov Per, ändrad' where email = 'ap-ans@example.invalid';
    ut := ut || jsonb_build_object('t', 'AP en ändrad ansökan ger inget nytt direktmejl', 'ok',
            (select count(*) from public.admin_paminnelse_utskick where slag = 'direkt') = 1, 'd', null);
    -- Bromsen: fler än fem direktmejl på tio minuter, och alla ansökningar sparas ändå.
    insert into public.applications (name, email)
    select 'Prov Flod', 'ap-flod' || g || '@example.invalid' from generate_series(1, 8) g;
    ut := ut || jsonb_build_object('t', 'AP bromsen: högst fem direktmejl på tio minuter, alla ansökningar sparade', 'ok',
            (select count(*) from public.admin_paminnelse_utskick where slag = 'direkt') = 5
            and (select count(*) from public.applications where email like 'ap-flod%@example.invalid') = 8, 'd', null);
    delete from public.admin_paminnelse_utskick;

    -- Klockan. Ett pass utan rapport ligger kvar och är inte mejlat.
    perform intern.admin_paminnelse_kor('2026-10-02 12:00:00+00');
    update public.admin_paminnelser set mejlad_at = now() where mejlad_at is null;
    update public.admin_paminnelser set mejlad_at = null where typ = 'pass_saknar_rapport' and objekt_id = PASS1::text;

    n := intern.admin_paminnelse_kor('2026-10-03 06:59:00+00');
    ut := ut || jsonb_build_object('t', 'AP 08:59 svensk tid går inget mejl', 'ok',
            n = 0 and not exists (select 1 from public.admin_paminnelse_utskick where slag = 'morgon'), 'd', 'mejlade: ' || n);

    n := intern.admin_paminnelse_kor('2026-10-03 07:00:00+00');
    ut := ut || jsonb_build_object('t', 'AP 09:00 svensk sommartid går ETT mejl med det som låg kvar', 'ok',
            n >= 1 and (select count(*) from public.admin_paminnelse_utskick where slag = 'morgon') = 1
            and (select (antal ->> 'pass_saknar_rapport')::int from public.admin_paminnelse_utskick where slag = 'morgon') = 1
            and not exists (select 1 from public.admin_paminnelse_utskick where slag = 'morgon' and antal ?| array['ny_lead', 'ny_ansokan'])
            and not exists (select 1 from public.admin_paminnelser ap where ap.mejlad_at is null), 'd', 'mejlade: ' || n);

    -- En gång per dag, hur många gånger jobbet än går och vad som än kommit emellan.
    insert into public.contact_messages (name, email, message) values ('Prov Frida', 'ap-fraga@example.invalid', 'Prov');
    n := intern.admin_paminnelse_kor('2026-10-03 07:05:00+00');
    ut := ut || jsonb_build_object('t', 'AP 09:05 samma dag går inget andra mejl', 'ok',
            n = 0 and (select count(*) from public.admin_paminnelse_utskick where slag = 'morgon') = 1, 'd', 'mejlade: ' || n);
    n := intern.admin_paminnelse_kor('2026-10-03 08:00:00+00');
    ut := ut || jsonb_build_object('t', 'AP 10:00 går inget', 'ok', n = 0, 'd', 'mejlade: ' || n);

    -- Nästa morgon: bara det nya. Det som mejlats kommer inte igen.
    n := intern.admin_paminnelse_kor('2026-10-04 07:00:00+00');
    ut := ut || jsonb_build_object('t', 'AP nästa morgon går bara det nya, inget gammalt igen', 'ok',
            n = 1 and (select count(*) from public.admin_paminnelse_utskick where slag = 'morgon') = 2
            and exists (select 1 from public.admin_paminnelse_utskick where slag = 'morgon' and antal = '{"fraga": 1}'::jsonb), 'd', 'mejlade: ' || n);

    -- En morgon utan något nytt ger inget mejl.
    n := intern.admin_paminnelse_kor('2026-10-05 07:00:00+00');
    ut := ut || jsonb_build_object('t', 'AP en morgon utan något nytt ger inget mejl', 'ok',
            n = 0 and (select count(*) from public.admin_paminnelse_utskick where slag = 'morgon') = 2, 'd', 'mejlade: ' || n);

    -- En sak som hanteras före kl. 9 lämnar listan och mejlas aldrig.
    insert into public.contact_messages (name, email, message) values ('Prov Fredrik', 'ap-fraga2@example.invalid', 'Prov');
    n := intern.admin_paminnelse_kor('2026-10-06 03:00:00+00');
    update public.contact_messages set hanterad_at = now() where email = 'ap-fraga2@example.invalid';
    n := intern.admin_paminnelse_kor('2026-10-06 07:00:00+00');
    ut := ut || jsonb_build_object('t', 'AP en sak som hanterats före kl. 9 får inget mejl', 'ok',
            n = 0 and (select count(*) from public.admin_paminnelse_utskick where slag = 'morgon') = 2, 'd', 'mejlade: ' || n);

    -- Vintertid: 9 svensk tid är 08:00 UTC, inte 07:00.
    insert into public.contact_messages (name, email, message) values ('Prov Fanny', 'ap-fraga3@example.invalid', 'Prov');
    n := intern.admin_paminnelse_kor('2026-11-10 07:00:00+00');
    ut := ut || jsonb_build_object('t', 'AP vintertid: 08:00 svensk tid går inget', 'ok',
            n = 0 and (select count(*) from public.admin_paminnelse_utskick where slag = 'morgon') = 2, 'd', 'mejlade: ' || n);
    n := intern.admin_paminnelse_kor('2026-11-10 08:00:00+00');
    ut := ut || jsonb_build_object('t', 'AP vintertid: 09:00 svensk tid (08:00 UTC) går mejlet', 'ok',
            n = 1 and (select count(*) from public.admin_paminnelse_utskick where slag = 'morgon') = 3, 'd', 'mejlade: ' || n);

    -- Databasen håller ett morgonmejl per svensk dag; ett direktmejl och ett testmejl samma dag går.
    begin
      insert into public.admin_paminnelse_utskick (antal, slag, skapad) values ('{"fraga": 1}', 'morgon', '2026-11-10 08:30:00+00');
      ut := ut || jsonb_build_object('t', 'AP ett andra morgonmejl samma svenska dag nekas av indexet', 'ok', false, 'd', 'gick in');
    exception when unique_violation then
      ut := ut || jsonb_build_object('t', 'AP ett andra morgonmejl samma svenska dag nekas av indexet', 'ok', true, 'd', null);
    end;
    insert into public.admin_paminnelse_utskick (antal, slag, skapad) values
      ('{"ny_ansokan": 1}', 'direkt', '2026-11-10 08:30:00+00'), ('{"fraga": 1}', 'prov', '2026-11-10 08:30:00+00');
    ut := ut || jsonb_build_object('t', 'AP direkt och prov samma dag som ett morgonmejl går', 'ok', true, 'd', null);
    delete from public.admin_paminnelse_utskick where skapad = '2026-11-10 08:30:00+00' and slag <> 'morgon';

    -- Rensningen: utskick äldre än 90 dagar går, nyare står kvar.
    insert into public.admin_paminnelse_utskick (id, antal, status, skapad) values
      ('00000000-0000-4000-8000-0000000a9e01', '{"ny_lead": 1}', 'skickad', now() - interval '91 days'),
      ('00000000-0000-4000-8000-0000000a9e02', '{"ny_lead": 1}', 'skickad', now() - interval '89 days');
    perform intern.admin_paminnelse_stada();
    ut := ut || jsonb_build_object('t', 'AP rensningen tar bort utskick äldre än 90 dagar och inget annat', 'ok',
            not exists (select 1 from public.admin_paminnelse_utskick where id = '00000000-0000-4000-8000-0000000a9e01')
            and exists (select 1 from public.admin_paminnelse_utskick where id = '00000000-0000-4000-8000-0000000a9e02'), 'd', null);

    -- Mottagarna: superadminarna, inte familjer och inte studiehjälpare. Slaget följer med i antal.
    select u.id into utsk from public.admin_paminnelse_utskick u where u.slag = 'morgon' order by u.skapad desc limit 1;
    select ta.till, ta.antal into mott, ant from public.admin_paminnelse_ta(utsk) ta;
    ut := ut || jsonb_build_object('t', 'AP mottagarna är superadminarna, inte familjer eller studiehjälpare', 'ok',
            mott @> array['rls-admin@example.invalid'] and not (mott && array['rls-a@example.invalid', 'rls-b@example.invalid',
            'rls-p@example.invalid', 'rls-q@example.invalid']), 'd', 'antal mottagare: ' || coalesce(cardinality(mott), 0));
    ut := ut || jsonb_build_object('t', 'AP dörren lägger slaget i antal', 'ok', ant ->> 'slag' = 'morgon', 'd', null);

    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', null, true);

  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('AP Påminnelserna till admin', false, fel);
  else
    insert into utfall (test, ok, detalj)
    select x ->> 't', (x ->> 'ok')::boolean, x ->> 'd' from jsonb_array_elements(ut) x;
  end if;
end $$;

-- ------------------------------------------------------------
-- 17. Jobbansökan: vårdnadshavaren och nejet
--     (ansokan_vardnadshavare_och_nej, 2026-10-05)
--
-- Den som är under 18 skriver vårdnadshavarens e-post, och databasen köar
-- ett mejl dit med samma broms som kvittot. Godkännandet läggs in av
-- admin och går inte att skriva utifrån. Avböjd köar ett nej som går
-- tidigast efter en halvtimme och aldrig mellan 20 och 9, hoppas över om
-- läget hunnit bytas, köas om vid ett nytt nej och mejlas en gång.
--
-- Adressen till funktionen är tömd överst i filen: inget av det här blir
-- ett mejl.
-- ------------------------------------------------------------

-- Nejets tid, i svensk tid, sommar och vinter. I ett block: körs filen
-- före migrationen ska raderna bli röda, inte hela körningen falla.
do $$
declare
  v record;
  fick timestamptz;
begin
  for v in
    select * from (values
      ('17 nejet: mitt på dagen en halvtimme senare', '2026-10-05 10:00:00+00'::timestamptz, '2026-10-05 10:30:00+00'::timestamptz),
      ('17 nejet: 19:20 svensk tid går 19:50', '2026-10-05 17:20:00+00', '2026-10-05 17:50:00+00'),
      ('17 nejet: 19:40 svensk tid väntar till 09:00 dagen efter', '2026-10-05 17:40:00+00', '2026-10-06 07:00:00+00'),
      ('17 nejet: 07:00 svensk tid väntar till 09:00 samma dag', '2026-10-05 05:00:00+00', '2026-10-05 07:00:00+00'),
      ('17 nejet: vintertid 23:00 väntar till 09:00 dagen efter', '2026-12-03 22:00:00+00', '2026-12-04 08:00:00+00'),
      ('17 nejet: vintertid efter midnatt väntar till 09:00 samma dag', '2026-12-03 23:45:00+00', '2026-12-04 08:00:00+00')
    ) as x(t, in_tid, ut_tid)
  loop
    begin
      fick := intern.ansokan_nej_tid(v.in_tid);
      insert into utfall (test, ok, detalj) values (v.t, fick = v.ut_tid, fick::text || ' mot ' || v.ut_tid::text);
    exception when others then
      insert into utfall (test, ok, detalj) values (v.t, false, sqlerrm);
    end;
  end loop;
end $$;

do $$
declare
  ut    jsonb := '[]'::jsonb;
  fel   text;
  ung   constant uuid := '00000000-0000-4000-8000-0000000017a1';
  vuxen constant uuid := '00000000-0000-4000-8000-0000000017a2';
  syster constant uuid := '00000000-0000-4000-8000-0000000017a3';
  a     public.applications%rowtype;
  rad   record;
  n     integer;
  vh_id uuid;
  nej   public.ansokan_utskick%rowtype;
  igen  integer;
begin
  begin
    -- Utifrån: sexton år, vårdnadshavarens adress, och ett försök att
    -- skriva godkännandet själv.
    perform pg_temp.bli(null);
    insert into public.applications (id, name, email, age, vardnadshavare_epost, vardnadshavare_godkand_at, vardnadshavare_svar)
    values (ung, 'Prov Ung', 'rls-ung@example.invalid', 16, '  RLS-Mamma@example.invalid ', now(), 'Jag godkänner');
    insert into public.applications (id, name, email, age, vardnadshavare_epost)
    values (vuxen, 'Prov Vuxen', 'rls-vuxen@example.invalid', 22, 'rls-mamma2@example.invalid');
    insert into public.applications (id, name, email, age, vardnadshavare_epost)
    values (syster, 'Prov Syster', 'rls-syster@example.invalid', 15, 'rls-mamma@example.invalid');
    reset role;
    perform set_config('request.jwt.claims', null, true);

    select * into a from public.applications where id = ung;
    ut := ut || jsonb_build_object('t', '17 adressen sparas för den som är under 18, utan kantmellanslag', 'ok',
            a.vardnadshavare_epost = 'RLS-Mamma@example.invalid', 'd', a.vardnadshavare_epost);
    ut := ut || jsonb_build_object('t', '17 godkännandet går inte att skriva utifrån', 'ok',
            a.vardnadshavare_godkand_at is null and a.vardnadshavare_svar is null, 'd', null);
    select count(*) into n from public.ansokan_utskick
     where ansokan_id = ung and steg = 'vardnadshavare' and status = 'vantar'
       and nyckel = 'vardnadshavare:' || md5(intern.epost_nyckel('rls-mamma@example.invalid'));
    ut := ut || jsonb_build_object('t', '17 vårdnadshavaren mejlas, en rad per adress', 'ok', n = 1, 'd', 'rader: ' || n);
    select * into a from public.applications where id = vuxen;
    select count(*) into n from public.ansokan_utskick where ansokan_id = vuxen and steg = 'vardnadshavare';
    ut := ut || jsonb_build_object('t', '17 den som är vuxen: ingen adress sparas och ingen mejlas', 'ok',
            a.vardnadshavare_epost is null and n = 0, 'd', coalesce(a.vardnadshavare_epost, '') || ' rader: ' || n);
    select u.status, u.fel into rad from public.ansokan_utskick u where u.ansokan_id = syster and u.steg = 'vardnadshavare';
    ut := ut || jsonb_build_object('t', '17 samma vårdnadshavare igen samma dygn bromsas', 'ok',
            rad.status = 'bromsad', 'd', coalesce(rad.status, 'ingen rad') || ': ' || coalesce(rad.fel, ''));

    -- Dörren: raden till vårdnadshavaren bär hens adress, inte den sökandes.
    select id into vh_id from public.ansokan_utskick where ansokan_id = ung and steg = 'vardnadshavare';
    select * into rad from public.ansokan_besked_ta(vh_id);
    ut := ut || jsonb_build_object('t', '17 mejlet till vårdnadshavaren går till vårdnadshavaren', 'ok',
            rad.epost = 'RLS-Mamma@example.invalid' and rad.namn = 'Prov Ung', 'd', coalesce(rad.epost, 'ingen rad'));
    perform public.ansokan_besked_klar(vh_id, true, null, 'prov', false);

    -- Admin rättar adressen: ny adress, nytt mejl. Samma adress igen: inget.
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
    update public.applications set vardnadshavare_epost = 'rls-pappa@example.invalid' where id = ung;
    update public.applications set vardnadshavare_epost = 'RLS-Pappa@Example.invalid' where id = ung;
    reset role;
    perform set_config('request.jwt.claims', null, true);
    select count(*) into n from public.ansokan_utskick where ansokan_id = ung and steg = 'vardnadshavare';
    ut := ut || jsonb_build_object('t', '17 en rättad adress mejlas, samma adress igen gör det inte', 'ok', n = 2, 'd', 'rader: ' || n);

    -- Godkännandet läggs in: loggas utan text, och den köade raden hoppas över.
    select id into vh_id from public.ansokan_utskick
     where ansokan_id = ung and steg = 'vardnadshavare' and status = 'vantar';
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
    update public.applications set vardnadshavare_godkand_at = now(), vardnadshavare_svar = 'Från: pappa. Jag godkänner.'
     where id = ung;
    update public.applications set vardnadshavare_epost = 'rls-tredje@example.invalid' where id = ung;
    reset role;
    perform set_config('request.jwt.claims', null, true);
    select count(*) into n from public.ansokan_utskick where ansokan_id = ung and steg = 'vardnadshavare';
    ut := ut || jsonb_build_object('t', '17 med godkännandet inlagt mejlas ingen ny adress', 'ok', n = 2, 'd', 'rader: ' || n);
    perform public.ansokan_besked_ta(vh_id);
    select u.status into rad from public.ansokan_utskick u where u.id = vh_id;
    ut := ut || jsonb_build_object('t', '17 ett köat mejl till vårdnadshavaren hoppas över när godkännandet finns', 'ok',
            rad.status = 'hoppad', 'd', rad.status);
    select count(*) into n from public.audit_logg
     where tabell = 'applications' and objekt_id = ung::text and efter ? 'vardnadshavare_godkand_at'
       and not (coalesce(efter, '{}') ? 'vardnadshavare_svar') and not (coalesce(efter, '{}') ? 'vardnadshavare_epost');
    ut := ut || jsonb_build_object('t', '17 auditloggen får tiden för godkännandet, aldrig kopian eller adressen', 'ok',
            n = 1, 'd', 'rader: ' || n);

    -- Nejet: köas med en tid, lånas inte ut före den, och omförsöken tar det först när det är dags.
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
    update public.applications set status = 'rejected' where id = vuxen;
    reset role;
    perform set_config('request.jwt.claims', null, true);
    select * into nej from public.ansokan_utskick where ansokan_id = vuxen and steg = 'avbojd';
    ut := ut || jsonb_build_object('t', '17 Avböjd köar ett nej med en tid', 'ok',
            nej.status = 'vantar' and nej.skicka_efter = intern.ansokan_nej_tid(now()), 'd',
            coalesce(nej.status, 'ingen rad') || ' ' || coalesce(nej.skicka_efter::text, ''));
    select count(*) into n from public.ansokan_besked_ta(nej.id);
    ut := ut || jsonb_build_object('t', '17 nejet lånas inte ut före sin tid', 'ok', n = 0, 'd', 'rader: ' || n);
    igen := intern.ansokan_besked_igen();
    ut := ut || jsonb_build_object('t', '17 omförsöken tar inte nejet före sin tid', 'ok', igen = 0, 'd', 'tog: ' || igen);
    update public.ansokan_utskick set skicka_efter = now() - interval '1 minute' where id = nej.id;
    igen := intern.ansokan_besked_igen();
    ut := ut || jsonb_build_object('t', '17 omförsöken tar nejet när tiden kommit', 'ok', igen = 1, 'd', 'tog: ' || igen);
    select * into rad from public.ansokan_besked_ta(nej.id);
    ut := ut || jsonb_build_object('t', '17 nejet går till den som sökt', 'ok',
            rad.steg = 'avbojd' and rad.epost = 'rls-vuxen@example.invalid', 'd', coalesce(rad.epost, 'ingen rad'));
    perform public.ansokan_besked_klar(nej.id, true, null, 'prov', false);

    -- Ett nej mejlas en gång: tillbaka och avböjd igen köar inget nytt.
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
    update public.applications set status = 'contacted' where id = vuxen;
    update public.applications set status = 'rejected' where id = vuxen;
    reset role;
    perform set_config('request.jwt.claims', null, true);
    select count(*) filter (where status = 'skickad'), count(*) into igen, n
      from public.ansokan_utskick where ansokan_id = vuxen and steg = 'avbojd';
    ut := ut || jsonb_build_object('t', '17 ett nej som gått mejlas aldrig igen', 'ok', n = 1 and igen = 1, 'd',
            'rader: ' || n || ', skickade: ' || igen);

    -- Ångrat: läget byts tillbaka före tiden, och raden hoppas över. Avböjd
    -- igen köar samma rad om, med ny tid.
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
    update public.applications set status = 'rejected' where id = syster;
    update public.applications set status = 'contacted' where id = syster;
    reset role;
    perform set_config('request.jwt.claims', null, true);
    select * into nej from public.ansokan_utskick where ansokan_id = syster and steg = 'avbojd';
    update public.ansokan_utskick set skicka_efter = now() - interval '1 minute' where id = nej.id;
    select count(*) into n from public.ansokan_besked_ta(nej.id);
    select * into nej from public.ansokan_utskick where id = nej.id;
    ut := ut || jsonb_build_object('t', '17 ett ångrat nej går inte', 'ok', n = 0 and nej.status = 'hoppad', 'd',
            nej.status || ': ' || coalesce(nej.fel, ''));
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
    update public.applications set status = 'rejected' where id = syster;
    reset role;
    perform set_config('request.jwt.claims', null, true);
    select * into nej from public.ansokan_utskick where id = nej.id;
    ut := ut || jsonb_build_object('t', '17 avböjd igen köar samma rad om, med ny tid', 'ok',
            nej.status = 'vantar' and nej.skicka_efter > now() and nej.forsok = 0, 'd',
            nej.status || ' ' || nej.skicka_efter::text || ' försök ' || nej.forsok);

    -- Villkoret på steg tar de två nya, och bara kända steg.
    begin
      insert into public.ansokan_utskick (ansokan_id, steg, nyckel) values (ung, 'nej', 'nej');
      ut := ut || jsonb_build_object('t', '17 ett okänt steg nekas', 'ok', false, 'd', 'gick igenom');
    exception when check_violation then
      ut := ut || jsonb_build_object('t', '17 ett okänt steg nekas', 'ok', true, 'd', null);
    end;

    -- Gallringen räknar godkännandet som ett steg.
    update public.applications set created_at = now() - interval '2 years', vardnadshavare_godkand_at = now() - interval '10 days',
           status = 'contacted' where id = ung;
    select * into a from public.applications where id = ung;
    ut := ut || jsonb_build_object('t', '17 gallringen räknar från godkännandet', 'ok',
            intern.ansokan_gallras_fran(a) = a.vardnadshavare_godkand_at + interval '30 days', 'd',
            intern.ansokan_gallras_fran(a)::text);

    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', null, true);

  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('17 Vårdnadshavaren och nejet', false, fel);
  else
    insert into utfall (test, ok, detalj)
    select x ->> 't', (x ->> 'ok')::boolean, x ->> 'd' from jsonb_array_elements(ut) x;
  end if;
end $$;

-- Ingen utom admin ändrar en ansökan, och därmed inte godkännandet. I ett
-- block, av samma skäl som ovan.
do $$
begin
  insert into public.applications (id, name, email, age, vardnadshavare_epost)
  values ('00000000-0000-4000-8000-0000000017b1', 'Prov Läs Ung', 'rls-lasung@example.invalid', 16, 'rls-x@example.invalid');
exception when others then
  raise notice '17b1: %', sqlerrm;
end $$;
select pg_temp.prova('17 familjen lägger inte in ett godkännande', '00000000-0000-4000-8000-0000000000f1',
  array[$q$update public.applications set vardnadshavare_godkand_at = now()
          where id = '00000000-0000-4000-8000-0000000017b1'$q$], 'nekad');
select pg_temp.prova('17 anon lägger inte in ett godkännande', null,
  array[$q$update public.applications set vardnadshavare_godkand_at = now()
          where id = '00000000-0000-4000-8000-0000000017b1'$q$], 'nekad');
select pg_temp.prova('17 admin lägger in godkännandet', '00000000-0000-4000-8000-0000000000ad',
  array[$q$update public.applications set vardnadshavare_godkand_at = now(), vardnadshavare_svar = 'Ja'
          where id = '00000000-0000-4000-8000-0000000017b1'$q$], 'ok');
select pg_temp.prova('17 anon köar inget nej', null,
  array[$q$select intern.ansokan_nej_koa('00000000-0000-4000-8000-0000000017b1')$q$], 'nekad');

-- ------------------------------------------------------------
-- 18. Det admin sett (admin_sett, 2026-10-05)
--
-- En tid per admin och område, skriven bara av admin_sett_markera():
-- aldrig bakåt, aldrig förbi nu, och bara för det man får se.
-- Intresseanmälningarna kräver behörigheten leads, ansökningarna
-- superadmin. Var och en läser bara sina egna rader.
-- ------------------------------------------------------------
select pg_temp.prova('18 superadmin markerar ansökningarna', '00000000-0000-4000-8000-0000000000ad',
  array[$q$select public.admin_sett_markera('ansokningar', '2026-10-01 10:00:00+00')$q$], 'ok');
select pg_temp.prova('18 admin med leads markerar anmälningarna', '00000000-0000-4000-8000-0000000bcad1',
  array[$q$select public.admin_sett_markera('leads', now())$q$], 'ok');
select pg_temp.prova('18 admin med leads markerar inte ansökningarna', '00000000-0000-4000-8000-0000000bcad1',
  array[$q$select public.admin_sett_markera('ansokningar', now())$q$], 'nekad');
select pg_temp.prova('18 admin utan leads markerar inte anmälningarna', '00000000-0000-4000-8000-0000000bcad3',
  array[$q$select public.admin_sett_markera('leads', now())$q$], 'nekad');
select pg_temp.prova('18 familjen markerar ingenting', '00000000-0000-4000-8000-0000000000f1',
  array[$q$select public.admin_sett_markera('leads', now())$q$], 'nekad');
select pg_temp.prova('18 anon markerar ingenting', null,
  array[$q$select public.admin_sett_markera('leads', now())$q$], 'nekad');
select pg_temp.prova('18 superadmin skriver inte i tabellen direkt', '00000000-0000-4000-8000-0000000000ad',
  array[$q$insert into public.admin_sett (user_id, omrade, sett_till)
          values ('00000000-0000-4000-8000-0000000000ad', 'leads', now())$q$], 'nekad');

do $$
declare
  ut  jsonb := '[]'::jsonb;
  fel text;
  v1  timestamptz;
  v2  timestamptz;
  v3  timestamptz;
  n   bigint;
  kod text;
begin
  begin
    perform pg_temp.bli('00000000-0000-4000-8000-0000000000ad');
    v1 := public.admin_sett_markera('ansokningar', '2026-10-01 10:00:00+00');
    v2 := public.admin_sett_markera('ansokningar', '2026-09-01 10:00:00+00');
    v3 := public.admin_sett_markera('leads', now() + interval '1 day');
    ut := ut || jsonb_build_object('t', '18 tiden går aldrig bakåt', 'ok', v2 = v1, 'd', v2::text);
    ut := ut || jsonb_build_object('t', '18 och aldrig förbi nu', 'ok', v3 <= now(), 'd', v3::text);
    select count(*) into n from public.admin_sett;
    ut := ut || jsonb_build_object('t', '18 superadmin ser sina två rader', 'ok', n = 2, 'd', 'rader: ' || n);

    perform pg_temp.bli('00000000-0000-4000-8000-0000000bcad1');
    perform public.admin_sett_markera('leads', now());
    select count(*) into n from public.admin_sett;
    ut := ut || jsonb_build_object('t', '18 en annan admin ser bara sin egen rad', 'ok', n = 1, 'd', 'rader: ' || n);

    begin
      perform public.admin_sett_markera('bokningar', now());
      kod := 'inget fel';
    exception when others then kod := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', '18 ett okänt område nekas', 'ok', kod in ('22023', '42501'), 'd', kod);

    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', null, true);

  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('18 Det admin sett', false, fel);
  else
    insert into utfall (test, ok, detalj)
    select x ->> 't', (x ->> 'ok')::boolean, x ->> 'd' from jsonb_array_elements(ut) x;
  end if;
end $$;

-- ------------------------------------------------------------
-- 19. NexLäx: uppdragen och NP-spåret (nexlax_uppdrag_och_np, 2026-10-06)
--
-- Uppdragen räknas ur svaren och försöken och sparas aldrig. Provet
-- spelar en nivå med sex frågor, allt rätt direkt, och prövar att varje
-- uppdrag som valdes står med rätt tal, vilket det än blev: valet är
-- elevens id och dagen, och det ska provet inte bero på. NP-spåret är
-- en kolumn med ett villkor, och banken sätter den ur områdets namn.
-- ------------------------------------------------------------
do $$
declare
  ut     jsonb := '[]'::jsonb;
  fel    text;
  kod    text;
  r      jsonb;
  r2     jsonb;
  u      jsonb;
  forsok uuid;
  n      int;
  varde  int;
  E   constant uuid := '00000000-0000-4000-8000-0000000005a1';
  KE  constant uuid := '00000000-0000-4000-8000-0000000bc0c1';
  P   constant uuid := '00000000-0000-4000-8000-0000000000f1';
  Q   constant uuid := '00000000-0000-4000-8000-0000000000f2';
  NV  constant uuid := '00000000-0000-4000-8000-00000000c9a1';
  -- Talen efter en nivå med sex valfrågor, allt rätt direkt, ensam i sitt
  -- område: 6 · 10 XP för frågorna, 50 för nivån och 100 för området.
  XP  constant int := 6 * 10 + 50 + 100;
begin
  begin
    -- Spåret: förval vägen, och bara vag och np går att skriva.
    insert into public.nivaer (id, nyckel, amne, arskurs, omrade, titel, ordning)
    values (NV, 'rls-uppdragens-niva', 'Matematik', 'ak5', 'RLS-uppdragen', 'RLS-uppdragens nivå', 1);
    select count(*) into n from public.nivaer where id = NV and spar = 'vag';
    ut := ut || jsonb_build_object('t', '19 en ny nivå står på vägen', 'ok', n = 1, 'd', n::text);
    begin
      update public.nivaer set spar = 'prov' where id = NV;
      kod := 'inget fel';
    exception when others then kod := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', '19 spåret är vag eller np', 'ok', kod = '23514', 'd', kod);

    -- Banken: NP-spåret är NP-träningens områden och inga andra. Faller
    -- innan banken med spåret är inläst.
    select count(*) into n from public.nivaer
     where aktiv and nyckel not like 'rls-%'
       and (spar = 'np') is distinct from (omrade ~ '(NP-träning|inför NP\M)');
    ut := ut || jsonb_build_object('t', '19 banken: NP-spåret är NP-träningens områden', 'ok', n = 0, 'd', 'avvikande: ' || n);
    select count(*) into n from public.nivaer where aktiv and spar = 'np';
    ut := ut || jsonb_build_object('t', '19 banken har ett NP-spår', 'ok', n > 0, 'd', 'nivåer: ' || n);

    insert into public.niva_fragor (id, niva_id, ordning, typ, fraga, alternativ, ratt)
    select gen_random_uuid(), NV, g, 'val', 'RLS-uppdragsfråga ' || g, '["rätt","fel"]', '0'
      from generate_series(1, 6) g;

    -- Det interna räknas inte av en inloggad.
    perform pg_temp.bli(P);
    begin
      r := intern.nexlax_uppdrag(E, current_date);
      kod := 'inget fel';
    exception when others then kod := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', '19 uppdragen räknas inte av en inloggad direkt', 'ok', kod = '42501', 'd', kod);

    -- Före: tre uppdrag, ett per grupp, och samma tre vid nästa läsning.
    r := public.nexlax_lage(E) -> 'uppdrag';
    ut := ut || jsonb_build_object('t', '19 dagens tre: ett per grupp', 'ok',
            jsonb_array_length(r -> 'idag') = 3
            and (select array_agg(x ->> 'grupp' order by x ->> 'grupp') from jsonb_array_elements(r -> 'idag') x)
                = array['kunna', 'nivaer', 'xp'],
            'd', left((r -> 'idag')::text, 300));
    r2 := public.nexlax_lage(E) -> 'uppdrag';
    ut := ut || jsonb_build_object('t', '19 samma tre vid nästa läsning', 'ok',
            (select array_agg(x ->> 'id') from jsonb_array_elements(r -> 'idag') x)
            = (select array_agg(x ->> 'id') from jsonb_array_elements(r2 -> 'idag') x), 'd', null);
    ut := ut || jsonb_build_object('t', '19 veckans och månadens finns', 'ok',
            r -> 'vecka' ->> 'id' like 'v-%' and (r -> 'manad' ->> 'mal')::int = 20
            and (r -> 'manad' ->> 'manad') = to_char((now() at time zone 'Europe/Stockholm')::date, 'YYYY-MM'),
            'd', (r -> 'vecka')::text || ' ' || (r -> 'manad')::text);

    -- Spela nivån: sex rätt i följd.
    r2 := public.niva_starta(NV, E);
    forsok := (r2 ->> 'forsok')::uuid;
    perform public.niva_svara(forsok, (x ->> 'id')::uuid, '{"val":0}')
       from jsonb_array_elements(r2 -> 'fragor') x;
    select count(*) into n from public.niva_forsok where id = forsok and godkand and stjarnor = 3;
    ut := ut || jsonb_build_object('t', '19 nivån klarad med tre stjärnor', 'ok', n = 1, 'd', n::text);

    r := public.nexlax_lage(E) -> 'uppdrag';
    -- Varje valt uppdrag har rätt tal, vilket det än är.
    select count(*) into n from jsonb_array_elements(r -> 'idag') u2
     where (u2 ->> 'har')::int is distinct from least((u2 ->> 'mal')::int,
             case split_part(u2 ->> 'id', '-', 1)
               when 'xp' then XP when 'nivaer' then 1 when 'direkt' then 6 when 'rad' then 6
               when 'tre' then 1 when 'amnen' then 1 end)
        or (u2 ->> 'klart')::boolean is distinct from ((u2 ->> 'har')::int >= (u2 ->> 'mal')::int);
    ut := ut || jsonb_build_object('t', '19 dagens uppdrag räknas ur svaren', 'ok', n = 0, 'd', left((r -> 'idag')::text, 400));
    ut := ut || jsonb_build_object('t', '19 kistan är öppen bara när alla tre är klara', 'ok',
            (r ->> 'kista')::boolean = (select bool_and((x ->> 'klart')::boolean) from jsonb_array_elements(r -> 'idag') x),
            'd', r ->> 'kista');
    u := r -> 'vecka';
    varde := case u ->> 'id' when 'v-dagar-3' then 1 when 'v-nivaer-6' then 1 when 'v-omrade-1' then 1
                             when 'v-xp-400' then XP end;
    ut := ut || jsonb_build_object('t', '19 veckans uppdrag räknas ur veckan', 'ok',
            (u ->> 'har')::int = least(varde, (u ->> 'mal')::int)
            and (u ->> 'klart')::boolean = (varde >= (u ->> 'mal')::int), 'd', u::text);
    select count(*) into n from jsonb_array_elements(r -> 'idag') x where (x ->> 'klart')::boolean;
    ut := ut || jsonb_build_object('t', '19 månaden och totalen räknar de klara', 'ok',
            (r -> 'manad' ->> 'har')::int >= n
            and (r ->> 'totalt')::int = n + case when (u ->> 'klart')::boolean then 1 else 0 end
                                          + (select count(*) from jsonb_array_elements('[]'::jsonb))::int,
            'd', 'klara i dag: ' || n || ', ' || (r -> 'manad')::text || ', totalt ' || (r ->> 'totalt'));
    -- XP ändras inte av uppdragen.
    ut := ut || jsonb_build_object('t', '19 uppdragen ger inga XP', 'ok',
            (public.nexlax_lage(E) ->> 'xp_idag')::int = XP, 'd', public.nexlax_lage(E) ->> 'xp_idag');

    -- En annan familj läser inte uppdragen.
    perform pg_temp.bli(Q);
    begin
      r := public.nexlax_lage(E);
      kod := 'inget fel';
    exception when others then kod := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', '19 en annan familj läser inte uppdragen', 'ok', kod = '42501', 'd', kod);

    -- Barnet ser sina egna, och spåret i sin katalog.
    reset role;
    perform pg_temp.bli_barn(KE, E, P);
    r := public.nexlax_lage(E) -> 'uppdrag';
    ut := ut || jsonb_build_object('t', '19 barnet ser sina uppdrag', 'ok', jsonb_array_length(r -> 'idag') = 3, 'd', null);
    r := public.barn_nexlax();
    ut := ut || jsonb_build_object('t', '19 barnets katalog bär spåret', 'ok',
            (select x ->> 'spar' from jsonb_array_elements(r -> 'katalog') x where (x ->> 'id')::uuid = NV) = 'vag',
            'd', null);

    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', null, true);

  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('19 Uppdragen och NP-spåret', false, fel);
  else
    insert into utfall (test, ok, detalj)
    select x ->> 't', (x ->> 'ok')::boolean, x ->> 'd' from jsonb_array_elements(ut) x;
  end if;
end $$;

-- ------------------------------------------------------------
-- 20. NexLäx: fel i en fråga (nexlax_felrapporter, 2026-10-06)
--
-- Familjen, barnet och studiehjälparen rapporterar genom
-- rapportera_fragefel. Ingen inloggad läser tabellen, bara admin ser
-- rapporterna och stänger dem, och rapporten bär ingen person.
-- ------------------------------------------------------------
do $$
declare
  ut   jsonb := '[]'::jsonb;
  fel  text;
  kod  text;
  r    jsonb;
  n    int;
  F    uuid := gen_random_uuid();
  E   constant uuid := '00000000-0000-4000-8000-0000000005a1';
  KE  constant uuid := '00000000-0000-4000-8000-0000000bc0c1';
  P   constant uuid := '00000000-0000-4000-8000-0000000000f1';
  AD  constant uuid := '00000000-0000-4000-8000-0000000000ad';
  NV  constant uuid := '00000000-0000-4000-8000-00000000c9b1';
begin
  begin
    insert into public.nivaer (id, nyckel, amne, arskurs, omrade, titel, ordning)
    values (NV, 'rls-felrapportens-niva', 'Matematik', 'ak5', 'RLS-felrapporten', 'RLS-felrapportens nivå', 1);
    insert into public.niva_fragor (id, niva_id, ordning, typ, fraga, alternativ, ratt)
    values (F, NV, 1, 'val', 'RLS-felrapportens fråga', '["rätt","fel"]', '0');

    perform pg_temp.bli(null);
    begin perform public.rapportera_fragefel(F, 'facit'); kod := 'inget fel';
    exception when others then kod := sqlstate; end;
    ut := ut || jsonb_build_object('t', '20 anon rapporterar inte', 'ok', kod = '42501', 'd', kod);

    perform pg_temp.bli(P);
    ut := ut || jsonb_build_object('t', '20 familjen rapporterar', 'ok', public.rapportera_fragefel(F, 'facit'), 'd', null);
    begin perform public.rapportera_fragefel(F, 'tråkig'); kod := 'inget fel';
    exception when others then kod := sqlstate; end;
    ut := ut || jsonb_build_object('t', '20 ett okänt skäl nekas', 'ok', kod = '22023', 'd', kod);
    begin perform public.rapportera_fragefel(gen_random_uuid(), 'facit'); kod := 'inget fel';
    exception when others then kod := sqlstate; end;
    ut := ut || jsonb_build_object('t', '20 en okänd fråga nekas', 'ok', kod = 'P0002', 'd', kod);
    begin select count(*) into n from public.niva_felrapporter; kod := 'inget fel';
    exception when others then kod := sqlstate; end;
    ut := ut || jsonb_build_object('t', '20 familjen läser inte tabellen', 'ok', kod = '42501', 'd', kod);
    begin r := public.nexlax_felrapporter(); kod := 'inget fel';
    exception when others then kod := sqlstate; end;
    ut := ut || jsonb_build_object('t', '20 familjen ser inte listan', 'ok', kod = '42501', 'd', kod);
    begin perform public.nexlax_felrapport_hanterad(F); kod := 'inget fel';
    exception when others then kod := sqlstate; end;
    ut := ut || jsonb_build_object('t', '20 familjen stänger inget', 'ok', kod = '42501', 'd', kod);

    perform pg_temp.bli_barn(KE, E, P);
    ut := ut || jsonb_build_object('t', '20 barnet rapporterar', 'ok', public.rapportera_fragefel(F, 'otydlig'), 'd', null);

    perform pg_temp.bli(AD);
    r := (select x from jsonb_array_elements(public.nexlax_felrapporter()) x where x ->> 'fraga_id' = F::text);
    ut := ut || jsonb_build_object('t', '20 admin ser frågan med skälen och facit', 'ok',
            (r ->> 'antal')::int = 2 and (r ->> 'facit')::int = 1 and (r ->> 'otydlig')::int = 1 and r ->> 'ratt' = '0',
            'd', left(coalesce(r::text, 'ingen rad'), 300));

    -- Taket: tjugo öppna per fråga, och svaret är detsamma över taket.
    perform pg_temp.bli(P);
    for n in 1 .. 25 loop perform public.rapportera_fragefel(F, 'annat'); end loop;
    perform pg_temp.bli(AD);
    r := (select x from jsonb_array_elements(public.nexlax_felrapporter()) x where x ->> 'fraga_id' = F::text);
    ut := ut || jsonb_build_object('t', '20 högst tjugo öppna per fråga', 'ok', (r ->> 'antal')::int = 20, 'd', r ->> 'antal');
    n := public.nexlax_felrapport_hanterad(F);
    ut := ut || jsonb_build_object('t', '20 admin stänger frågans rapporter', 'ok', n = 20, 'd', n::text);
    r := (select x from jsonb_array_elements(public.nexlax_felrapporter()) x where x ->> 'fraga_id' = F::text);
    ut := ut || jsonb_build_object('t', '20 en stängd fråga står inte kvar', 'ok', r is null, 'd', left(coalesce(r::text, ''), 200));

    execute 'reset role';
    perform set_config('request.jwt.claims', null, true);
    select count(*) into n from public.niva_felrapporter where fraga_id = F and konto = 'barn';
    ut := ut || jsonb_build_object('t', '20 barnets rapport står som barn', 'ok', n = 1, 'd', n::text);
    select count(*) into n from public.niva_felrapporter where fraga_id = F and konto = 'familj';
    ut := ut || jsonb_build_object('t', '20 familjens rapporter står som familj', 'ok', n = 19, 'd', n::text);

    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('20 Felrapporterna', false, fel);
  else
    insert into utfall (test, ok, detalj)
    select x ->> 't', (x ->> 'ok')::boolean, x ->> 'd' from jsonb_array_elements(ut) x;
  end if;
end $$;

-- ------------------------------------------------------------
-- 21. Barnets chatt med studiehjälparen (barnets_chatt, 2026-10-06)
--
-- Barnet och studiehjälparen skriver genom var sin funktion, föräldern
-- läser sina barns trådar men skriver inte, en annan familj och en annan
-- studiehjälpare ser ingenting, och admin läser genom barnchatt_las, som
-- skriver i auditloggen. Barnets roll får fortfarande ingen tabell.
-- ------------------------------------------------------------
do $$
declare
  ut   jsonb := '[]'::jsonb;
  fel  text;
  kod  text;
  r    jsonb;
  n    int;
  m    int;
  E   constant uuid := '00000000-0000-4000-8000-0000000005a1';
  EB  constant uuid := '00000000-0000-4000-8000-0000000005b1';
  KE  constant uuid := '00000000-0000-4000-8000-0000000bc0c1';
  P   constant uuid := '00000000-0000-4000-8000-0000000000f1';
  Q   constant uuid := '00000000-0000-4000-8000-0000000000f2';
  A   constant uuid := '00000000-0000-4000-8000-0000000000a1';
  B   constant uuid := '00000000-0000-4000-8000-0000000000b1';
  AD  constant uuid := '00000000-0000-4000-8000-0000000000ad';
begin
  begin
    -- Utgångsläget: barnet har en aktiv inloggning och studiehjälparen A.
    update public.students set barn_aktiv = true, match_status = 'matched', matched_tutor_id = A where id = E;

    perform pg_temp.bli_barn(KE, E, P);
    r := public.barn_chatt();
    ut := ut || jsonb_build_object('t', '21 barnet ser sin tomma tråd och studiehjälparens förnamn', 'ok',
            r ->> 'lage' = 'ok' and r ->> 'studiehjalpare' = 'Test' and (r ->> 'kan_skriva')::boolean
            and jsonb_array_length(r -> 'meddelanden') = 0 and (r ->> 'olasta')::int = 0,
            'd', left(r::text, 200));
    r := public.barn_chatt_skriv('  Hej Anna, jag fattar inte bråk  ');
    ut := ut || jsonb_build_object('t', '21 barnet skriver', 'ok', r ->> 'lage' = 'ok', 'd', r::text);
    ut := ut || jsonb_build_object('t', '21 ett tomt meddelande sparas inte', 'ok',
            public.barn_chatt_skriv('   ') ->> 'lage' = 'tom', 'd', null);
    ut := ut || jsonb_build_object('t', '21 ett för långt meddelande sparas inte', 'ok',
            public.barn_chatt_skriv(repeat('a', 2001)) ->> 'lage' = 'lang', 'd', null);
    begin select count(*) into n from public.barn_meddelanden; kod := 'inget fel';
    exception when others then kod := sqlstate; end;
    ut := ut || jsonb_build_object('t', '21 barnet läser inte tabellen', 'ok', kod = '42501', 'd', kod);
    begin perform public.barnchatt_tradar(); kod := 'inget fel';
    exception when others then kod := sqlstate; end;
    ut := ut || jsonb_build_object('t', '21 barnet kör inte studiehjälparens funktioner', 'ok', kod = '42501', 'd', kod);
    r := public.barn_chatt();
    ut := ut || jsonb_build_object('t', '21 meddelandet står trimmat i barnets tråd', 'ok',
            jsonb_array_length(r -> 'meddelanden') = 1
            and r -> 'meddelanden' -> 0 ->> 'text' = 'Hej Anna, jag fattar inte bråk'
            and r -> 'meddelanden' -> 0 ->> 'fran' = 'barn' and r -> 'meddelanden' -> 0 -> 'last' = 'null'::jsonb,
            'd', left(r::text, 200));

    -- Notisen till studiehjälparen, med barnets förnamn.
    execute 'reset role';
    perform set_config('request.jwt.claims', null, true);
    select count(*) into n from public.notiser
     where mottagare = A and typ = 'meddelande' and trad_parent = P and trad_tutor = A
       and data ->> 'fran' = 'Äldst' and last_at is null;
    ut := ut || jsonb_build_object('t', '21 studiehjälparen får en notis med barnets förnamn', 'ok', n = 1, 'd', n::text);

    -- Studiehjälparen A.
    perform pg_temp.bli(A);
    r := (select x from jsonb_array_elements(public.barnchatt_tradar()) x where (x ->> 'elev')::uuid = E);
    ut := ut || jsonb_build_object('t', '21 studiehjälparen ser eleven med ett oläst', 'ok',
            r ->> 'namn' = 'Äldst' and (r ->> 'olasta')::int = 1 and (r ->> 'kan_skriva')::boolean
            and (r ->> 'inloggning')::boolean,
            'd', left(coalesce(r::text, 'ingen rad'), 200));
    r := public.barnchatt_trad(E);
    ut := ut || jsonb_build_object('t', '21 studiehjälparen läser tråden', 'ok',
            r ->> 'lage' = 'ok' and jsonb_array_length(r -> 'meddelanden') = 1, 'd', left(r::text, 200));
    r := (select x from jsonb_array_elements(public.barnchatt_tradar()) x where (x ->> 'elev')::uuid = E);
    ut := ut || jsonb_build_object('t', '21 det studiehjälparen läst är inte olästa längre', 'ok',
            (r ->> 'olasta')::int = 0, 'd', r ->> 'olasta');
    r := public.barnchatt_skriv(E, 'Vi tar det på passet!');
    ut := ut || jsonb_build_object('t', '21 studiehjälparen skriver', 'ok', r ->> 'lage' = 'ok', 'd', r::text);
    begin insert into public.barn_meddelanden (student_id, parent_id, tutor_id, fran, body)
          values (E, P, A, 'studiehjalpare', 'förbi funktionen'); kod := 'inget fel';
    exception when others then kod := sqlstate; end;
    ut := ut || jsonb_build_object('t', '21 studiehjälparen skriver inte i tabellen direkt', 'ok', kod = '42501', 'd', kod);
    begin select count(*) into n from public.barn_meddelanden; kod := 'inget fel';
    exception when others then kod := sqlstate; end;
    ut := ut || jsonb_build_object('t', '21 studiehjälparen läser inte tabellen direkt', 'ok',
            kod = 'inget fel' and n = 0, 'd', kod || ' ' || coalesce(n::text, ''));
    r := public.barnchatt_skriv(EB, 'Hej');
    ut := ut || jsonb_build_object('t', '21 studiehjälparen skriver inte till en annans elev', 'ok',
            r ->> 'lage' = 'ingen', 'd', r::text);

    -- Studiehjälparen B, som har familjens yngsta men inte Äldst.
    perform pg_temp.bli(B);
    ut := ut || jsonb_build_object('t', '21 en annan studiehjälpare läser inte tråden', 'ok',
            public.barnchatt_trad(E) ->> 'lage' = 'ingen', 'd', null);
    ut := ut || jsonb_build_object('t', '21 en annan studiehjälpare skriver inte', 'ok',
            public.barnchatt_skriv(E, 'Hej') ->> 'lage' = 'ingen', 'd', null);
    ut := ut || jsonb_build_object('t', '21 till en elev utan inloggning går inget', 'ok',
            public.barnchatt_skriv(EB, 'Hej') ->> 'lage' = 'ingen_inloggning', 'd', null);
    ut := ut || jsonb_build_object('t', '21 en elev utan inloggning och tråd står inte i listan', 'ok',
            not exists (select 1 from jsonb_array_elements(public.barnchatt_tradar()) x where (x ->> 'elev')::uuid = EB),
            'd', null);

    -- Barnet läser svaret.
    perform pg_temp.bli_barn(KE, E, P);
    r := public.barn_chatt();
    ut := ut || jsonb_build_object('t', '21 barnet har ett oläst svar', 'ok',
            (r ->> 'olasta')::int = 1 and jsonb_array_length(r -> 'meddelanden') = 2
            -- Båda står med samma now() i provets transaktion, så ordningen
            -- prövas inte här: barnets eget är läst av studiehjälparen.
            and exists (select 1 from jsonb_array_elements(r -> 'meddelanden') x
                         where x ->> 'fran' = 'barn' and x ->> 'last' is not null),
            'd', left(r::text, 300));
    ut := ut || jsonb_build_object('t', '21 barnet markerar svaret som läst', 'ok', public.barn_chatt_last() = 1, 'd', null);
    ut := ut || jsonb_build_object('t', '21 sedan finns inget oläst', 'ok',
            (public.barn_chatt() ->> 'olasta')::int = 0, 'd', null);

    -- Föräldern läser, men skriver inte och markerar inget.
    perform pg_temp.bli(P);
    select count(*) into n from public.barn_meddelanden where student_id = E;
    ut := ut || jsonb_build_object('t', '21 föräldern läser barnets tråd', 'ok', n = 2, 'd', n::text);
    begin insert into public.barn_meddelanden (student_id, parent_id, tutor_id, fran, body)
          values (E, P, A, 'barn', 'i barnets namn'); kod := 'inget fel';
    exception when others then kod := sqlstate; end;
    ut := ut || jsonb_build_object('t', '21 föräldern skriver inte i barnets tråd', 'ok', kod = '42501', 'd', kod);
    begin update public.barn_meddelanden set read_at = null where student_id = E; kod := 'inget fel';
    exception when others then kod := sqlstate; end;
    ut := ut || jsonb_build_object('t', '21 föräldern ändrar inget i barnets tråd', 'ok', kod = '42501', 'd', kod);
    begin perform public.barn_chatt_skriv('Hej'); kod := 'inget fel';
    exception when others then kod := sqlstate; end;
    ut := ut || jsonb_build_object('t', '21 föräldern kör inte barnets funktioner', 'ok', kod = '42501', 'd', kod);
    begin r := public.barnchatt_las(P, A); kod := 'inget fel';
    exception when others then kod := sqlstate; end;
    ut := ut || jsonb_build_object('t', '21 föräldern kör inte adminens läsning', 'ok', kod = '42501', 'd', kod);

    perform pg_temp.bli(Q);
    select count(*) into n from public.barn_meddelanden;
    ut := ut || jsonb_build_object('t', '21 en annan familj ser ingenting', 'ok', n = 0, 'd', n::text);
    perform pg_temp.bli(null);
    begin select count(*) into n from public.barn_meddelanden; kod := 'inget fel';
    exception when others then kod := sqlstate; end;
    ut := ut || jsonb_build_object('t', '21 anon läser inte tabellen', 'ok', kod = '42501', 'd', kod);

    -- Admin läser genom funktionen, och öppningen står i loggen.
    perform pg_temp.bli(AD);
    select count(*), count(*) filter (where x.read_at is not null) into n, m from public.barnchatt_las(P, A) x;
    ut := ut || jsonb_build_object('t', '21 admin läser barnens trådar i familjen', 'ok', n = 2 and m = 2, 'd', n || ' ' || m);
    execute 'reset role';
    perform set_config('request.jwt.claims', null, true);
    select count(*) into n from public.audit_logg
     where handling = 'chatt.oppnad' and tabell = 'barn_meddelanden' and objekt_id = P::text
       and aktor = AD and (efter ->> 'meddelanden')::int = 2 and position('fattar' in efter::text) = 0;
    ut := ut || jsonb_build_object('t', '21 öppningen står i auditloggen, utan texten', 'ok', n = 1, 'd', n::text);

    -- Antalet pass i barnets översikt.
    perform pg_temp.bli_barn(KE, E, P);
    r := public.barn_oversikt();
    ut := ut || jsonb_build_object('t', '21 översikten räknar genomförda och kommande pass', 'ok',
            r -> 'antal' ? 'genomforda' and r -> 'antal' ? 'kommande'
            and (r -> 'antal' ->> 'kommande')::int = jsonb_array_length(r -> 'kommande'),
            'd', coalesce((r -> 'antal')::text, 'saknas'));

    -- Taket: tjugo på tio minuter.
    for n in 1 .. 25 loop perform public.barn_chatt_skriv('rad ' || n); end loop;
    execute 'reset role';
    perform set_config('request.jwt.claims', null, true);
    select count(*) into n from public.barn_meddelanden where student_id = E and fran = 'barn';
    ut := ut || jsonb_build_object('t', '21 barnet skriver högst tjugo på tio minuter', 'ok', n = 20, 'd', n::text);

    -- En vilande relation går att läsa men inte skriva i.
    update public.students set match_status = 'paused' where id = E;
    perform pg_temp.bli_barn(KE, E, P);
    r := public.barn_chatt();
    ut := ut || jsonb_build_object('t', '21 vilande: barnet läser men kan inte skriva', 'ok',
            r ->> 'lage' = 'ok' and not (r ->> 'kan_skriva')::boolean
            and public.barn_chatt_skriv('Hej') ->> 'lage' = 'ingen', 'd', left(r::text, 120));
    perform pg_temp.bli(A);
    ut := ut || jsonb_build_object('t', '21 vilande: studiehjälparen läser men skriver inte', 'ok',
            public.barnchatt_trad(E) ->> 'lage' = 'ok' and public.barnchatt_skriv(E, 'Hej') ->> 'lage' = 'ingen', 'd', null);

    -- En pausad inloggning gör ingenting.
    execute 'reset role';
    perform set_config('request.jwt.claims', null, true);
    update public.students set match_status = 'matched', barn_aktiv = false where id = E;
    perform pg_temp.bli_barn(KE, E, P);
    ut := ut || jsonb_build_object('t', '21 pausad inloggning: ingen tråd och inget skrivet', 'ok',
            public.barn_chatt() ->> 'lage' = 'saknas' and public.barn_chatt_skriv('Hej') ->> 'lage' = 'saknas'
            and public.barn_chatt_last() = 0, 'd', null);

    -- Ett byte av studiehjälpare: den förra når inte tråden.
    execute 'reset role';
    perform set_config('request.jwt.claims', null, true);
    update public.students set barn_aktiv = true, matched_tutor_id = B where id = E;
    perform pg_temp.bli(A);
    ut := ut || jsonb_build_object('t', '21 den förra studiehjälparen når inte tråden', 'ok',
            public.barnchatt_trad(E) ->> 'lage' = 'ingen', 'd', null);
    perform pg_temp.bli_barn(KE, E, P);
    r := public.barn_chatt();
    ut := ut || jsonb_build_object('t', '21 barnet ser bara tråden med den nya studiehjälparen', 'ok',
            r ->> 'lage' = 'ok' and jsonb_array_length(r -> 'meddelanden') = 0, 'd', left(r::text, 120));

    -- Raderas familjen går trådarna med.
    execute 'reset role';
    perform set_config('request.jwt.claims', null, true);
    update public.profiles set raderad_at = now() where id = P;
    select count(*) into n from public.barn_meddelanden where parent_id = P;
    ut := ut || jsonb_build_object('t', '21 en raderad familj har inga trådar kvar', 'ok', n = 0, 'd', n::text);

    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('21 Barnets chatt', false, fel);
  else
    insert into utfall (test, ok, detalj)
    select x ->> 't', (x ->> 'ok')::boolean, x ->> 'd' from jsonb_array_elements(ut) x;
  end if;
end $$;

reset role;
select set_config('request.jwt.claims', null, true);

-- ------------------------------------------------------------
-- 22. Barnets behörigheter (barnets_behorigheter, 2026-10-06)
--
-- Föräldern väljer vad barnet får se och göra: pass, studieplan,
-- rapporter, nexlax, meddelanden och chatt. Valet hålls i databasen:
-- barnets funktioner lämnar inte ut det som är av, NexLäx-funktionerna
-- släpper inte in ett barn utan NexLäx, och i en avstängd tråd skriver
-- varken barnet eller studiehjälparen. Bara föräldern ändrar valet.
-- Allt i ett block som rullas tillbaka; utfallet samlas i en variabel.
-- ------------------------------------------------------------
do $$
declare
  ut   jsonb := '[]'::jsonb;
  fel  text;
  r    jsonb;
  t    text;
  kod  text;
  E    constant uuid := '00000000-0000-4000-8000-0000000005a1';
  EY   constant uuid := '00000000-0000-4000-8000-0000000005b1';
  EQ   constant uuid := '00000000-0000-4000-8000-0000000005c1';
  KE   constant uuid := '00000000-0000-4000-8000-0000000bc0c1';
  P    constant uuid := '00000000-0000-4000-8000-0000000000f1';
  Q    constant uuid := '00000000-0000-4000-8000-0000000000f2';
  A    constant uuid := '00000000-0000-4000-8000-0000000000a1';
  AD   constant uuid := '00000000-0000-4000-8000-0000000000ad';
  N    constant uuid := '00000000-0000-4000-8000-00000000cb01';
  F    constant uuid := '00000000-0000-4000-8000-00000000cb02';
  HV   constant uuid := '00000000-0000-4000-8000-00000000cb03';
  NO   constant uuid := '00000000-0000-4000-8000-00000000cb04';
begin
  begin
    -- Fixturen, som postgres: en nivå, en vanlig uppgift och en notis.
    insert into public.nivaer (id, nyckel, amne, arskurs, omrade, titel, ordning)
    values (N, 'rls-behorighetens-niva', 'Matematik', 'ak6', 'Bråk', 'RLS-behörighetens nivå', 1);
    insert into public.niva_fragor (id, niva_id, ordning, typ, fraga, alternativ, ratt, forklaring)
    values (F, N, 1, 'val', 'Vilket är störst?', '["1/2","1/3"]', '0', 'Halva är mest.');
    insert into public.homework (id, student_id, tutor_id, title) values (HV, E, A, 'RLS behörighetens uppgift');
    insert into public.barn_notiser (id, barn_id, typ, text) values (NO, E, 'avbokat', 'Prov');
    -- Barnet har en aktiv inloggning och studiehjälparen A, som i avsnitt 21.
    update public.students set barn_aktiv = true, match_status = 'matched', matched_tutor_id = A where id = E;

    select array_to_string(barn_behorigheter, ',') || '|' || visa_rapporter::text into t
      from public.students where id = E;
    ut := ut || jsonb_build_object('t', 'BB förvalet: allt utom rapporterna', 'ok',
            t = 'chatt,meddelanden,nexlax,pass,studieplan|false', 'd', t);

    -- Föräldern läser.
    perform pg_temp.bli(P);
    r := public.mina_barns_behorigheter();
    ut := ut || jsonb_build_object('t', 'BB föräldern läser sina barns val, och alla val i ordning', 'ok',
            r -> 'alla' = '["pass","studieplan","rapporter","nexlax","meddelanden","chatt"]'::jsonb
            and exists (select 1 from jsonb_array_elements(r -> 'barn') x where (x ->> 'barn_id')::uuid = E
                          and x -> 'behorigheter' = '["chatt","meddelanden","nexlax","pass","studieplan"]'::jsonb)
            and not exists (select 1 from jsonb_array_elements(r -> 'barn') x where (x ->> 'barn_id')::uuid = EQ),
            'd', left(r::text, 200));
    reset role;
    perform pg_temp.bli(Q);
    r := public.mina_barns_behorigheter();
    ut := ut || jsonb_build_object('t', 'BB en annan förälder ser inte barnets val', 'ok',
            not exists (select 1 from jsonb_array_elements(r -> 'barn') x where (x ->> 'barn_id')::uuid = E),
            'd', left(r::text, 200));

    -- Föräldern stänger av NexLäx, notiserna och tråden.
    reset role;
    perform pg_temp.bli(P);
    r := public.barn_behorigheter_satt(E, array['pass', 'studieplan']);
    ut := ut || jsonb_build_object('t', 'BB föräldern stänger av NexLäx, notiserna och tråden', 'ok',
            r -> 'behorigheter' = '["pass","studieplan"]'::jsonb, 'd', r::text);

    reset role;
    perform set_config('request.jwt.claims', null, true);
    select count(*)::text into t from public.audit_logg
     where tabell = 'students' and objekt_id = E::text and handling = 'barnkonto.andrad'
       and efter ? 'barn_behorigheter' and aktor = P;
    ut := ut || jsonb_build_object('t', 'BB valet skrivs i auditloggen med föräldern som aktör', 'ok', t = '1', 'd', t);

    perform pg_temp.bli_barn(KE, E, P);
    r := public.barn_nexlax();
    ut := ut || jsonb_build_object('t', 'BB barnet utan NexLäx får ingen bana', 'ok',
            r = '{"lage": "avstangd"}'::jsonb, 'd', left(r::text, 200));
    begin
      perform public.niva_starta(N, E);
      kod := 'inget fel';
    exception when others then kod := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BB barnet utan NexLäx startar ingen nivå', 'ok', kod = '42501', 'd', kod);
    begin
      perform public.nexlax_lage(E);
      kod := 'inget fel';
    exception when others then kod := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BB barnet utan NexLäx läser inte sitt läge', 'ok', kod = '42501', 'd', kod);
    begin
      perform public.barn_uppgift(HV, 'klar');
      kod := 'inget fel';
    exception when others then kod := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BB barnet utan NexLäx bockar inte av en uppgift', 'ok', kod = '42501', 'd', kod);
    begin
      perform public.rapportera_fragefel(F, 'facit');
      kod := 'inget fel';
    exception when others then kod := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BB barnet utan NexLäx rapporterar inget fel i en fråga', 'ok', kod = '42501', 'd', kod);
    select count(*)::text into t from public.barn_notiser();
    ut := ut || jsonb_build_object('t', 'BB barnet utan meddelanden ser inga notiser', 'ok', t = '0', 'd', t);
    ut := ut || jsonb_build_object('t', 'BB barnet utan meddelanden markerar ingenting', 'ok',
            public.barn_markera_last(NO) = false, 'd', null);
    r := public.barn_oversikt();
    ut := ut || jsonb_build_object('t', 'BB översikten säger vad som är på', 'ok',
            r ->> 'lage' = 'ok' and r -> 'behorigheter' = '["pass","studieplan"]'::jsonb
            and r ? 'kommande' and r ? 'timmar' and r ? 'antal' and r ? 'studieplan', 'd', left(r::text, 200));

    -- Tråden av: barnet läser och skriver inte.
    r := public.barn_chatt();
    ut := ut || jsonb_build_object('t', 'BB barnet utan tråden läser den inte', 'ok',
            r = '{"lage": "avstangd"}'::jsonb, 'd', left(r::text, 200));
    r := public.barn_chatt_skriv('Hej, får jag skriva?');
    ut := ut || jsonb_build_object('t', 'BB barnet utan tråden skriver inte', 'ok',
            r ->> 'lage' = 'avstangd', 'd', r::text);
    ut := ut || jsonb_build_object('t', 'BB barnet utan tråden markerar ingenting', 'ok',
            public.barn_chatt_last() = 0, 'd', null);

    -- Studiehjälparen skriver inte heller, och ser varför.
    reset role;
    perform pg_temp.bli(A);
    r := public.barnchatt_skriv(E, 'Hej från studiehjälparen');
    ut := ut || jsonb_build_object('t', 'BB studiehjälparen skriver inte i en avstängd tråd', 'ok',
            r ->> 'lage' = 'avstangd', 'd', r::text);
    r := public.barnchatt_trad(E);
    ut := ut || jsonb_build_object('t', 'BB studiehjälparen läser tråden och ser att den är avstängd', 'ok',
            r ->> 'lage' = 'ok' and not (r ->> 'kan_skriva')::boolean and (r ->> 'avstangd')::boolean,
            'd', left(r::text, 200));
    r := public.barnchatt_tradar();
    ut := ut || jsonb_build_object('t', 'BB studiehjälparens lista säger att tråden är avstängd', 'ok',
            exists (select 1 from jsonb_array_elements(r) x where (x ->> 'elev')::uuid = E
                      and (x ->> 'avstangd')::boolean and not (x ->> 'kan_skriva')::boolean),
            'd', left(r::text, 200));
    reset role;
    perform set_config('request.jwt.claims', null, true);
    select count(*)::text into t from public.barn_meddelanden where student_id = E;
    ut := ut || jsonb_build_object('t', 'BB ingenting skrevs i den avstängda tråden', 'ok', t = '0', 'd', t);
    perform pg_temp.bli_barn(KE, E, P);

    -- Familjens egen inloggning gör NexLäx som förut.
    reset role;
    perform pg_temp.bli(P);
    begin
      perform public.niva_starta(N, E);
      kod := 'ok';
    exception when others then kod := sqlstate || ' ' || sqlerrm;
    end;
    ut := ut || jsonb_build_object('t', 'BB familjen gör NexLäx åt barnet också med barnets NexLäx av', 'ok', kod = 'ok', 'd', kod);

    -- Passen och studieplanen av, NexLäx, notiserna och tråden på igen.
    r := public.barn_behorigheter_satt(E, array['nexlax', 'meddelanden', 'chatt']);
    reset role;
    perform pg_temp.bli_barn(KE, E, P);
    r := public.barn_oversikt();
    ut := ut || jsonb_build_object('t', 'BB utan passen och studieplanen lämnas de inte ut', 'ok',
            r ->> 'lage' = 'ok' and r ->> 'fornamn' = 'Äldst'
            and not (r ? 'kommande') and not (r ? 'genomforda') and not (r ? 'timmar') and not (r ? 'antal')
            and not (r ? 'studieplan')
            and r -> 'behorigheter' = '["chatt","meddelanden","nexlax"]'::jsonb, 'd', left(r::text, 200));
    r := public.barn_nexlax();
    ut := ut || jsonb_build_object('t', 'BB med NexLäx på igen får barnet sin bana', 'ok', r ->> 'lage' = 'ok', 'd', r ->> 'lage');
    ut := ut || jsonb_build_object('t', 'BB med NexLäx på igen rapporterar barnet ett fel i en fråga', 'ok',
            public.rapportera_fragefel(F, 'otydlig'), 'd', null);
    select count(*)::text into t from public.barn_notiser();
    ut := ut || jsonb_build_object('t', 'BB med meddelandena på igen ser barnet notisen', 'ok', t::integer >= 1, 'd', t);
    r := public.barn_chatt();
    ut := ut || jsonb_build_object('t', 'BB med tråden på igen läser barnet den', 'ok',
            r ->> 'lage' = 'ok' and (r ->> 'kan_skriva')::boolean, 'd', left(r::text, 200));
    r := public.barn_chatt_skriv('Nu går det');
    ut := ut || jsonb_build_object('t', 'BB med tråden på igen skriver barnet', 'ok', r ->> 'lage' = 'ok', 'd', r::text);

    -- Rapporterna går genom listan, till visa_rapporter.
    reset role;
    perform pg_temp.bli(P);
    r := public.barn_behorigheter_satt(E, array['rapporter', 'pass', 'pass']);
    ut := ut || jsonb_build_object('t', 'BB rapporterna sparas i visa_rapporter, och dubbletter försvinner', 'ok',
            r -> 'behorigheter' = '["pass","rapporter"]'::jsonb
            and (select visa_rapporter and barn_behorigheter = '{pass}' from public.students where id = E),
            'd', r::text);
    reset role;
    perform pg_temp.bli_barn(KE, E, P);
    r := public.barn_oversikt();
    ut := ut || jsonb_build_object('t', 'BB barnet ser rapporterna när de är på', 'ok',
            r ->> 'visa_rapporter' = 'true' and r -> 'behorigheter' = '["pass","rapporter"]'::jsonb, 'd', left(r::text, 200));

    -- Ingen annan ändrar valet.
    reset role;
    perform pg_temp.bli(Q);
    begin
      perform public.barn_behorigheter_satt(E, '{}');
      kod := 'inget fel';
    exception when others then kod := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BB en annan förälder ändrar inte valet', 'ok', kod = '42501', 'd', kod);
    reset role;
    perform pg_temp.bli(A);
    begin
      perform public.barn_behorigheter_satt(E, '{}');
      kod := 'inget fel';
    exception when others then kod := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BB studiehjälparen ändrar inte valet', 'ok', kod = '42501', 'd', kod);
    update public.students set barn_behorigheter = '{}' where id = E;
    reset role;
    perform pg_temp.bli(AD);
    begin
      perform public.barn_behorigheter_satt(E, '{}');
      kod := 'inget fel';
    exception when others then kod := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BB admin ändrar inte valet genom funktionen', 'ok', kod = '42501', 'd', kod);
    update public.students set barn_behorigheter = '{}' where id = E;
    reset role;
    perform set_config('request.jwt.claims', null, true);
    select array_to_string(barn_behorigheter, ',') into t from public.students where id = E;
    ut := ut || jsonb_build_object('t', 'BB studiehjälparen och admin ändrar inte kolumnen direkt', 'ok', t = 'pass', 'd', t);

    perform pg_temp.bli_barn(KE, E, P);
    begin
      perform public.barn_behorigheter_satt(E, array['nexlax']);
      kod := 'inget fel';
    exception when others then kod := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BB barnet ändrar inte sitt eget val', 'ok', kod = '42501', 'd', kod);
    begin
      perform public.mina_barns_behorigheter();
      kod := 'inget fel';
    exception when others then kod := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BB barnet läser inte förälderns lista', 'ok', kod = '42501', 'd', kod);

    -- Det som inte går.
    reset role;
    perform pg_temp.bli(P);
    begin
      perform public.barn_behorigheter_satt(E, array['boka']);
      kod := 'inget fel';
    exception when others then kod := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BB en okänd behörighet nekas', 'ok', kod = '22023', 'd', kod);
    begin
      perform public.barn_behorigheter_satt(EY, array['pass']);
      kod := 'inget fel';
    exception when others then kod := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BB ett barn utan inloggning får inga val', 'ok', kod = '55000', 'd', kod);
    begin
      update public.students set barn_behorigheter = '{boka}' where id = E;
      kod := 'inget fel';
    exception when others then kod := sqlstate;
    end;
    ut := ut || jsonb_build_object('t', 'BB villkoret nekar en okänd behörighet i kolumnen', 'ok', kod = '23514', 'd', kod);

    -- En inloggning som tas bort tar valen med sig.
    reset role;
    perform set_config('request.jwt.claims', null, true);
    delete from auth.users where id = KE;
    select array_to_string(barn_behorigheter, ',') || '|' || visa_rapporter::text into t
      from public.students where id = E;
    ut := ut || jsonb_build_object('t', 'BB utan inloggning börjar valen om från förvalet', 'ok',
            t = 'chatt,meddelanden,nexlax,pass,studieplan|false', 'd', t);

    ut := ut || jsonb_build_object('t', 'BB anon når inte funktionerna', 'ok',
            not has_function_privilege('anon', 'public.mina_barns_behorigheter()', 'execute')
            and not has_function_privilege('anon', 'public.barn_behorigheter_satt(uuid, text[])', 'execute')
            and not has_function_privilege('nextrum_barn', 'public.barn_behorigheter_satt(uuid, text[])', 'execute'),
            'd', null);

    raise exception 'rulla tillbaka';
  exception when others then fel := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', null, true);

  if fel <> 'rulla tillbaka' then
    insert into utfall (test, ok, detalj) values ('BB Barnets behörigheter', false, fel);
  else
    insert into utfall (test, ok, detalj)
    select x ->> 't', (x ->> 'ok')::boolean, x ->> 'd' from jsonb_array_elements(ut) x;
  end if;
end $$;

reset role;
select set_config('request.jwt.claims', null, true);

select test, ok is true as ok, detalj from utfall order by nr;

rollback;
