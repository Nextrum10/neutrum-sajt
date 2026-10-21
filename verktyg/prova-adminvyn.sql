-- ============================================================
-- NEXTRUM — data för röktestet av adminvyn (verktyg/prova-adminvyn.js)
--
-- Körs som postgres mot en LOKAL databas byggd ur alla migrationer
-- (verktyg/lokal-databas.sh), aldrig mot driften. Som postgres är
-- auth.uid() null, så skydden släpper igenom fixturerna, och betalningar
-- som skrivs här bokförs i liggaren som när tjänstekontot gör det.
--
-- Två admins (superadmin och en med behörigheter), tre studiehjälpare
-- (två godkända), tre familjer med barn, pass i varje läge med rapporter,
-- anmälningar, en ansökan i varje steg, ett köp och en kortbetalning (en
-- skarp, en test), koderna och en tråd. Tillräckligt för att varje sektion
-- har något att rita och varje fråga körs mot riktiga tabeller.
-- ============================================================
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1000000-0000-4000-8000-0000000000ad', 'prov-admin@example.invalid', '{"role":"parent","full_name":"Ada Admin"}'),
  ('a1000000-0000-4000-8000-0000000000ae', 'prov-beh@example.invalid',   '{"role":"parent","full_name":"Bea Behörig"}'),
  ('a1000000-0000-4000-8000-0000000000a1', 'prov-tutor1@example.invalid', '{"role":"tutor","full_name":"Tove Hjälpare"}'),
  ('a1000000-0000-4000-8000-0000000000a2', 'prov-tutor2@example.invalid', '{"role":"tutor","full_name":"Tim Hjälpare"}'),
  ('a1000000-0000-4000-8000-0000000000a3', 'prov-tutor3@example.invalid', '{"role":"tutor","full_name":"Tea Väntar"}'),
  ('a1000000-0000-4000-8000-0000000000f1', 'prov-fam1@example.invalid',  '{"role":"parent","full_name":"Familjen Ett"}'),
  ('a1000000-0000-4000-8000-0000000000f2', 'prov-fam2@example.invalid',  '{"role":"parent","full_name":"Familjen Två"}'),
  ('a1000000-0000-4000-8000-0000000000f3', 'prov-fam3@example.invalid',  '{"role":"parent","full_name":"Familjen Tre"}');

update public.profiles set is_admin = true where id = 'a1000000-0000-4000-8000-0000000000ad';
insert into public.admin_roller (user_id, ar_superadmin, behorigheter)
values ('a1000000-0000-4000-8000-0000000000ae', false,
        array['leads', 'anvandare_las', 'bokningar_las', 'rapporter_las', 'matchning', 'studiehjalpare_godkann'])
on conflict (user_id) do update set ar_superadmin = excluded.ar_superadmin, behorigheter = excluded.behorigheter;

insert into public.villkor_godkannanden (anvandare, version, kalla)
select u.id, intern.villkor_version(), 'registrering' from auth.users u where u.email like 'prov-%@example.invalid';

update public.tutor_profiles
   set status = 'approved', hourly_rate = 180, school = 'Provskolan', age = 19, city = 'Stockholm',
       subjects = '{Matematik,Svenska}', grade_levels = '{Åk 7–9}', visa_publikt = true
 where id in ('a1000000-0000-4000-8000-0000000000a1', 'a1000000-0000-4000-8000-0000000000a2');

insert into public.students (id, parent_id, name, grade, matched_tutor_id, match_status, created_at, subjects) values
  ('a1000000-0000-4000-8000-0000000005a1', 'a1000000-0000-4000-8000-0000000000f1', 'Alva Ett', 'Åk 8',
   'a1000000-0000-4000-8000-0000000000a1', 'matched', now() - interval '20 days', '{Matematik}'),
  ('a1000000-0000-4000-8000-0000000005a2', 'a1000000-0000-4000-8000-0000000000f1', 'Axel Ett', 'Åk 5',
   'a1000000-0000-4000-8000-0000000000a1', 'matched', now() - interval '20 days', '{Svenska}'),
  ('a1000000-0000-4000-8000-0000000005b1', 'a1000000-0000-4000-8000-0000000000f2', 'Bo Två', 'Åk 9',
   'a1000000-0000-4000-8000-0000000000a2', 'matched', now() - interval '15 days', '{Matematik}'),
  ('a1000000-0000-4000-8000-0000000005c1', 'a1000000-0000-4000-8000-0000000000f3', 'Cleo Tre', 'Åk 7',
   null, 'pending', now() - interval '2 days', '{Engelska}');

-- Passen, i varje läge. Klockslagen skiljer sig, så att överlappsregeln inte slår till.
insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min,
                             status, subject, tjanst) values
  ('a1000000-0000-4000-8000-00000000b001', 'a1000000-0000-4000-8000-0000000000f1', 'a1000000-0000-4000-8000-0000000000a1',
   'a1000000-0000-4000-8000-0000000005a1', 'a1000000-0000-4000-8000-0000000000f1',
   (now() at time zone 'Europe/Stockholm')::date - 7, '15:00', 60, 'confirmed', 'Matematik', 'laxhjalp'),
  ('a1000000-0000-4000-8000-00000000b002', 'a1000000-0000-4000-8000-0000000000f1', 'a1000000-0000-4000-8000-0000000000a1',
   'a1000000-0000-4000-8000-0000000005a1', 'a1000000-0000-4000-8000-0000000000f1',
   (now() at time zone 'Europe/Stockholm')::date + 5, '16:00', 60, 'confirmed', 'Matematik', 'laxhjalp'),
  ('a1000000-0000-4000-8000-00000000b003', 'a1000000-0000-4000-8000-0000000000f2', 'a1000000-0000-4000-8000-0000000000a2',
   'a1000000-0000-4000-8000-0000000005b1', 'a1000000-0000-4000-8000-0000000000f2',
   (now() at time zone 'Europe/Stockholm')::date + 6, '17:00', 60, 'requested', 'Matematik', 'laxhjalp'),
  ('a1000000-0000-4000-8000-00000000b004', 'a1000000-0000-4000-8000-0000000000f2', 'a1000000-0000-4000-8000-0000000000a2',
   'a1000000-0000-4000-8000-0000000005b1', 'a1000000-0000-4000-8000-0000000000f2',
   (now() at time zone 'Europe/Stockholm')::date - 3, '18:00', 60, 'cancelled', 'Matematik', 'laxhjalp'),
  ('a1000000-0000-4000-8000-00000000b005', 'a1000000-0000-4000-8000-0000000000f2', 'a1000000-0000-4000-8000-0000000000a2',
   'a1000000-0000-4000-8000-0000000005b1', 'a1000000-0000-4000-8000-0000000000f2',
   (now() at time zone 'Europe/Stockholm')::date - 10, '15:00', 120, 'confirmed', 'Matematik', 'laxhjalp');

-- Rapporterna gör passen genomförda (triggern), med den hållna tiden.
insert into public.lesson_reports (id, student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, amne,
                                   start_tid, slut_tid) values
  ('a1000000-0000-4000-8000-00000000e001', 'a1000000-0000-4000-8000-0000000005a1', 'a1000000-0000-4000-8000-0000000000a1',
   'a1000000-0000-4000-8000-00000000b001', 'Vi gick igenom ekvationer.', (now() at time zone 'Europe/Stockholm')::date - 7,
   'narvarande', 'Matematik', '15:00', '16:00'),
  ('a1000000-0000-4000-8000-00000000e002', 'a1000000-0000-4000-8000-0000000005b1', 'a1000000-0000-4000-8000-0000000000a2',
   'a1000000-0000-4000-8000-00000000b005', 'Bråk och procent.', (now() at time zone 'Europe/Stockholm')::date - 10,
   'narvarande', 'Matematik', '15:00', '17:00');

-- Betalningar: passet med kort (skarp), ett köp av en plan (test).
update public.bookings
   set betalning_status = 'betald', betald_at = now() - interval '6 days', betalt_ore = 39900, aterbetald_ore = 0,
       stripe_payment_intent_id = 'pi_provadmin1', stripe_charge_id = 'ch_provadmin1', stripe_skarp = true
 where id = 'a1000000-0000-4000-8000-00000000b001';

insert into public.klippkort (id, parent_id, erbjudande, namn, sort, timmar, giltig_manader, rabatt_procent,
                              timpris_ore, begart_ore, status)
values ('a1000000-0000-4000-8000-00000000c001', 'a1000000-0000-4000-8000-0000000000f2', 'plan_standard',
        'Standard', 'plan', 8, 1, 5, 39900, 303200, 'vantar');
select public.klippkort_betald('a1000000-0000-4000-8000-00000000c001', 303200, 'pi_provadmin2', 'ch_provadmin2',
                               null, null, null, false);

-- Gratistimmar med orsak och månad (timmar_med_orsak, 2026-10-21), insatta av
-- superadmin genom funktionen, som i vyn: familjens panel läser raden.
select set_config('request.jwt.claims',
                  json_build_object('sub', 'a1000000-0000-4000-8000-0000000000ad', 'role', 'authenticated')::text, false);
set role authenticated;
select public.ge_gratistimmar('a1000000-0000-4000-8000-0000000000f1', 2, 'Provkörning: passet ställdes in av oss', null);
reset role;
select set_config('request.jwt.claims', '', false);

insert into public.leads (id, parent_name, email, child_name, grade, subject, message, status, tjanst, created_at) values
  ('a1000000-0000-4000-8000-00000000d001', 'Linda Lead', 'prov-lead1@example.invalid', 'Lisa', 'Åk 6', 'Matematik',
   'Vi behöver hjälp med matten.', 'new', 'laxhjalp', now() - interval '1 day'),
  ('a1000000-0000-4000-8000-00000000d002', 'Lars Lead', 'prov-lead2@example.invalid', 'Leo', 'Åk 9', 'Engelska',
   'Inför proven.', 'contacted', 'laxhjalp', now() - interval '9 days');

-- En ansökan i varje steg, och en avböjd.
insert into public.applications (id, name, email, age, school, subjects, availability, why, tjanster, status,
                                 created_at, till_intervju_at, intervju_at, utbildad_at) values
  ('a1000000-0000-4000-8000-00000000a001', 'Nora Ny', 'prov-ans1@example.invalid', 18, 'Provgymnasiet', 'Matematik',
   'Vardagar', 'Jag vill hjälpa.', '{laxhjalp}', 'new', now() - interval '1 day', null, null, null),
  ('a1000000-0000-4000-8000-00000000a002', 'Ivan Intervju', 'prov-ans2@example.invalid', 19, 'Provgymnasiet', 'Svenska',
   'Helger', 'Jag gillar svenska.', '{laxhjalp}', 'new', now() - interval '5 days', now() - interval '3 days', null, null),
  ('a1000000-0000-4000-8000-00000000a003', 'Ulla Utbildning', 'prov-ans3@example.invalid', 20, 'KTH', 'Matematik, Fysik',
   'Kvällar', 'Erfarenhet av läxhjälp.', '{laxhjalp}', 'new', now() - interval '9 days', now() - interval '8 days',
   now() - interval '6 days', null),
  ('a1000000-0000-4000-8000-00000000a004', 'Tove Hjälpare', 'prov-tutor1@example.invalid', 19, 'Provskolan',
   'Matematik', 'Vardagar', 'Jag vill bli studiehjälpare.', '{laxhjalp}', 'approved', now() - interval '40 days',
   now() - interval '38 days', now() - interval '35 days', now() - interval '30 days'),
  ('a1000000-0000-4000-8000-00000000a005', 'Rolf Nej', 'prov-ans5@example.invalid', 25, null, 'Kemi', null,
   'Hej', '{laxhjalp}', 'rejected', now() - interval '12 days', null, null, null);

insert into public.messages (parent_id, tutor_id, sender_id, body, created_at) values
  ('a1000000-0000-4000-8000-0000000000f1', 'a1000000-0000-4000-8000-0000000000a1',
   'a1000000-0000-4000-8000-0000000000f1', 'Hej! Går det bra på torsdag?', now() - interval '2 days');

insert into public.homework (student_id, tutor_id, title, instructions, subject, due_date, status) values
  ('a1000000-0000-4000-8000-0000000005a1', 'a1000000-0000-4000-8000-0000000000a1', 'Ekvationer 3.1',
   'Gör uppgift 1 till 10.', 'Matematik', (now() at time zone 'Europe/Stockholm')::date + 3, 'ej_paborjad');

insert into public.rabattkoder (kod, beskrivning, typ, varde, sort, partner_namn, max_per_familj, aktiv) values
  ('PROVRABATT', 'Provkod', 'procent', 10, 'rabatt', null, 1, true),
  ('PROVPARTNER', 'Provpartner', 'belopp', 0, 'partner', 'Provföreningen', null, true);
-- Utlagd hos familjen (koderna_agare_och_en_gang, 2026-10-21).
update public.rabattkoder set agare = 'a1000000-0000-4000-8000-0000000000f1' where kod = 'PROVRABATT';

-- Tipskoderna, som Koder skapar när vyn öppnas.
select intern.ny_tipskod(p.id, case when p.role = 'tutor' then 'studiehjalpare' else 'familj' end)
  from public.profiles p
 where p.id in ('a1000000-0000-4000-8000-0000000000f1', 'a1000000-0000-4000-8000-0000000000a1');

-- Syskontillägget som skuld (syskontillagg_som_skuld, 2026-10-21): strömbrytaren
-- står på bara medan passen skrivs, så att Syskontillägg under Betalningar har
-- en familj med ett upplupet tillägg och ett bokat. Sedan av igen, som i driften.
update public.tillagg_installning set villkor_version = '2026-10-21' where id = 1;
update public.flaggor set aktiv = true where kod = 'syskonskuld';
insert into public.tillagg_godkannanden (familj, version) values ('a1000000-0000-4000-8000-0000000000f1', '2026-10-21');
insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min,
                             status, subject, tjanst, extra_barn) values
  ('a1000000-0000-4000-8000-00000000b006', 'a1000000-0000-4000-8000-0000000000f1', 'a1000000-0000-4000-8000-0000000000a1',
   'a1000000-0000-4000-8000-0000000005a1', 'a1000000-0000-4000-8000-0000000000f1',
   (now() at time zone 'Europe/Stockholm')::date - 4, '17:00', 60, 'confirmed', 'Matematik', 'laxhjalp',
   array['a1000000-0000-4000-8000-0000000005a2']::uuid[]),
  ('a1000000-0000-4000-8000-00000000b007', 'a1000000-0000-4000-8000-0000000000f1', 'a1000000-0000-4000-8000-0000000000a1',
   'a1000000-0000-4000-8000-0000000005a1', 'a1000000-0000-4000-8000-0000000000f1',
   (now() at time zone 'Europe/Stockholm')::date + 8, '17:00', 60, 'confirmed', 'Matematik', 'laxhjalp',
   array['a1000000-0000-4000-8000-0000000005a2']::uuid[]);
-- Granskningen 2026-10-21: ett betalt tillägg (Betala tillägg nu), så att Betalningar, Månadens ekonomi och
-- bokslutet räknar ett syskontillägg, och ett som väntar på Klarna, så att Släpp betalningen syns.
insert into public.bookings (id, parent_id, tutor_id, student_id, created_by, wanted_date, wanted_time, duration_min,
                             status, subject, tjanst, extra_barn) values
  ('a1000000-0000-4000-8000-00000000b008', 'a1000000-0000-4000-8000-0000000000f1', 'a1000000-0000-4000-8000-0000000000a1',
   'a1000000-0000-4000-8000-0000000005a1', 'a1000000-0000-4000-8000-0000000000f1',
   (now() at time zone 'Europe/Stockholm')::date - 6, '17:00', 60, 'confirmed', 'Matematik', 'laxhjalp',
   array['a1000000-0000-4000-8000-0000000005a2']::uuid[]),
  ('a1000000-0000-4000-8000-00000000b009', 'a1000000-0000-4000-8000-0000000000f1', 'a1000000-0000-4000-8000-0000000000a1',
   'a1000000-0000-4000-8000-0000000005a1', 'a1000000-0000-4000-8000-0000000000f1',
   (now() at time zone 'Europe/Stockholm')::date - 5, '17:00', 60, 'confirmed', 'Matematik', 'laxhjalp',
   array['a1000000-0000-4000-8000-0000000005a2']::uuid[]);
do $$
declare
  f jsonb;
begin
  update public.bookings set status = 'completed' where id = 'a1000000-0000-4000-8000-00000000b008';
  f := public.tillagg_forsok_skapa('a1000000-0000-4000-8000-0000000000f1', 'manuell');
  perform public.tillagg_forsok_betald((f ->> 'forsok')::uuid, 'pi_provsyskon', 'ch_provsyskon',
                                       (f ->> 'belopp_ore')::int, true, 450, 6450);
  update public.bookings set status = 'completed' where id = 'a1000000-0000-4000-8000-00000000b009';
  f := public.tillagg_forsok_skapa('a1000000-0000-4000-8000-0000000000f1', 'manuell');
  perform public.tillagg_forsok_vantar((f ->> 'forsok')::uuid, 'cs_provklarna');
end $$;
insert into public.lesson_reports (id, student_id, tutor_id, booking_id, raw_notes, lesson_date, narvaro, amne,
                                   start_tid, slut_tid) values
  ('a1000000-0000-4000-8000-00000000e003', 'a1000000-0000-4000-8000-0000000005a1', 'a1000000-0000-4000-8000-0000000000a1',
   'a1000000-0000-4000-8000-00000000b006', 'Båda barnen räknade bråk.', (now() at time zone 'Europe/Stockholm')::date - 4,
   'narvarande', 'Matematik', '17:00', '18:00');
update public.flaggor set aktiv = false where kod = 'syskonskuld';
update public.tillagg_installning set villkor_version = 'utkast' where id = 1;

-- Värvningsbonusen (varvningsbonus, 2026-10-21): tre ansökningar med Toves
-- kod. Kalle får sitt konto och bonusen tjänas in, Kim väntar, och Tea hade
-- redan ett konto när hon sökte, så hennes rad är annullerad med skälet.
insert into public.applications (id, name, email, kod, tjanster, status, created_at) values
  ('a1000000-0000-4000-8000-00000000a006', 'Kalle Kompis', 'prov-kompis1@example.invalid',
   (select kod from public.tipskoder where person_id = 'a1000000-0000-4000-8000-0000000000a1'), '{laxhjalp}', 'new', now()),
  ('a1000000-0000-4000-8000-00000000a007', 'Kim Kompis', 'prov-kompis2@example.invalid',
   (select kod from public.tipskoder where person_id = 'a1000000-0000-4000-8000-0000000000a1'), '{laxhjalp}', 'new', now()),
  ('a1000000-0000-4000-8000-00000000a008', 'Tea Väntar', 'prov-tutor3@example.invalid',
   (select kod from public.tipskoder where person_id = 'a1000000-0000-4000-8000-0000000000a1'), '{laxhjalp}', 'new',
   now() + interval '1 minute');
insert into auth.users (id, email, raw_user_meta_data) values
  ('a1000000-0000-4000-8000-0000000000a6', 'prov-kompis1@example.invalid', '{"role":"tutor","full_name":"Kalle Kompis"}');
update public.tutor_profiles set status = 'approved', hourly_rate = 160 where id = 'a1000000-0000-4000-8000-0000000000a6';

commit;
