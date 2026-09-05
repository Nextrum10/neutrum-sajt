-- ============================================================
-- NEXTRUM — schema v9: pass i hela timmar, utan överlapp
-- Kör EFTER v8. Rensar ingenting.
--
-- Tre saker hänger ihop här:
--
--   1. Pass bokas i hela timmar (60/120/180), eftersom vi fakturerar
--      per timme. Ett 90-minuterspass går inte att sätta på en
--      faktura utan att någon får räkna halvtimmar för hand.
--
--   2. Ett långt pass måste blockera alla sina timmar. Idag listar
--      tutor_busy_slots bara STARTTIDEN, så ett tvåtimmarspass kl. 16
--      lämnar 17:00 ledigt att boka — mitt i det pågående passet.
--
--   3. Databasen måste garantera det, inte gränssnittet. Det unika
--      indexet skyddar bara mot identisk starttid, alltså exakt det
--      fall som är minst troligt när passen är olika långa.
-- ============================================================


-- ============================================================
-- 1. LÄS DET HÄR FÖRST — finns det redan överlappande pass?
--
-- Steg 3 nedan MISSLYCKAS om två aktiva pass hos samma
-- studiehjälpare krockar. Kör den här frågan först. Får du noll
-- rader kan du köra hela filen rakt av. Får du rader måste de redas
-- ut (avboka ett, eller ändra tiden) innan villkoret går att lägga på.
-- ============================================================
-- select a.id, b.id, a.tutor_id, a.wanted_date, a.wanted_time, a.duration_min,
--        b.wanted_time, b.duration_min
--   from public.bookings a
--   join public.bookings b
--     on a.tutor_id = b.tutor_id and a.wanted_date = b.wanted_date and a.id < b.id
--  where a.status in ('requested','confirmed')
--    and b.status in ('requested','confirmed')
--    and public.pass_intervall(a.wanted_date, a.wanted_time, a.duration_min)
--     && public.pass_intervall(b.wanted_date, b.wanted_time, b.duration_min);
--
-- OBS: funktionen skapas längre ned i filen. Vill du köra kontrollen
-- innan resten, använd tsrange direkt — utanför ett index spelar
-- volatiliteten ingen roll.


-- ============================================================
-- 2. UPPTAGNA TIDER — en rad per timme, inte per pass
--
-- Vyn ligger till grund för vilka tider som gråas ut i kalendern.
-- Med en rad per påbörjad timme blir ett tvåtimmarspass två
-- upptagna timmar, och kalendern kan sluta ljuga.
-- ============================================================
-- ============================================================
-- PASSETS TIDSINTERVALL — som en IMMUTABLE funktion
--
-- Första versionen räknade fram intervallet direkt i villkoret med
-- wanted_time::time och (... || ' minutes')::interval. Postgres
-- vägrade: båda casterna är STABLE, inte immutable, och får därför
-- inte förekomma i ett indexuttryck. (text_in är immutable, men
-- time_in och interval_in är det inte — kontrollera i pg_proc om du
-- undrar över någon annan.)
--
-- Att bara märka en wrapper som immutable vore ett löfte man inte
-- kan hålla, och ett brutet löfte här ger ett tyst trasigt index.
-- Det här räknar i stället ur heltal: split_part, int4in, make_time
-- och make_interval är alla genuint immutable.
-- ============================================================
create or replace function public.pass_intervall(d date, t text, minuter int)
returns tsrange
language sql
immutable
as $$
  select tsrange(
    d + make_time(split_part(t, ':', 1)::int, split_part(t, ':', 2)::int, 0),
    d + make_time(split_part(t, ':', 1)::int, split_part(t, ':', 2)::int, 0)
      + make_interval(mins => coalesce(minuter, 60))
  );
$$;


create or replace view public.tutor_busy_slots as
  select
    b.tutor_id,
    b.wanted_date,
    to_char(
      make_time(split_part(b.wanted_time, ':', 1)::int,
                split_part(b.wanted_time, ':', 2)::int, 0)
        + make_interval(hours => n),
      'HH24:MI') as wanted_time
  from public.bookings b
  cross join lateral generate_series(
    0,
    greatest(ceil(coalesce(b.duration_min, 60) / 60.0)::int - 1, 0)
  ) as n
  where b.status in ('requested','confirmed')
    and b.tutor_id is not null
    and b.wanted_date is not null
    and b.wanted_time is not null;

grant select on public.tutor_busy_slots to anon, authenticated;


-- ============================================================
-- 3. INGEN ÖVERLAPPNING — garanterat av databasen
--
-- Ett unikt index kan bara säga "inte exakt samma starttid". Att
-- två tidsintervall inte får korsa varandra är ett annat slags
-- villkor, och PostgreSQL har ett för just det: EXCLUDE med &&.
--
-- btree_gist behövs för att kunna jämföra tutor_id med = i samma
-- villkor som intervallet jämförs med &&.
--
-- Frontend fångar redan 23505 ("tiden är bokad"). Det här villkoret
-- ger 23P01 i stället, och vyerna hanterar båda.
-- ============================================================
create extension if not exists btree_gist;

alter table public.bookings
  drop constraint if exists bookings_ingen_overlapp;

alter table public.bookings
  add constraint bookings_ingen_overlapp
  exclude using gist (
    tutor_id with =,
    public.pass_intervall(wanted_date, wanted_time, duration_min) with &&
  )
  where (
    status in ('requested','confirmed')
    and tutor_id is not null
    and wanted_date is not null
    and wanted_time is not null
  );

-- Det gamla indexet är nu överflödigt: identisk starttid är ett
-- specialfall av överlappning. Det lämnas kvar med flit ändå — det
-- är billigare att kontrollera, och 23505 är felkoden vyerna känt
-- till längst.


-- ============================================================
-- 4. HELA TIMMAR
--
-- Bokningarna ska vara 60, 120 eller 180 minuter. Villkoret hindrar
-- inte gamla rader — det gäller bara nya och ändrade, så historiken
-- med 30- och 90-minuterspass står kvar orörd och kan fortfarande
-- faktureras för det den var.
-- ============================================================
alter table public.bookings
  drop constraint if exists bookings_hela_timmar;

alter table public.bookings
  add constraint bookings_hela_timmar
  check (duration_min is null or duration_min % 60 = 0)
  not valid;


-- ============================================================
-- KLART.
--
-- Körd mot produktion 2026-09-05. Verifierat med fyra prov, alla
-- återställda: överlapp stoppas, angränsande pass tillåts (18:00
-- direkt efter ett pass 16–18 går igenom), 90 minuter nekas, och ett
-- tvåtimmarspass upptar två timmar i tutor_busy_slots.
--
-- Vad som INTE ändras här, med flit:
--
--   · Standardtiderna 15–19 på vardagar tas bort i frontend, inte i
--     databasen. Det fanns aldrig en rad någonstans som sa att de
--     gällde — det var en gissning i JavaScript, och en gissning om
--     när någon annan kan jobba hör inte hemma i ett bokningssystem.
--
--   · Helger. De har alltid gått att lägga in: tutor_availability
--     tar weekday 0–6, och 5 och 6 är lördag och söndag. Det var
--     bara reservtiderna som hoppade över dem, och de finns inte
--     längre.
-- ============================================================
