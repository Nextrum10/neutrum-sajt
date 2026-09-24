-- ============================================================
-- NEXTRUM — Fas 15.4: familjen berättar vad barnet behöver
--
-- Leo 2026-09-24: "När man lägger till barn ska man skriva lite mer
-- om barnet för att matcha deras behov med en studiehjälpare."
--
-- students hade namn, årskurs, skola, ämnen, mål och en fritext
-- (about). Matchningen i adminvyn hade alltså bara fritexten att gå
-- på för det viktigaste — VARFÖR familjen vill ha hjälp — och en
-- fritext går inte att filtrera eller jämföra.
--
-- Två nya fält, båda FASTA KODER:
--
--   behov            vad hjälpen ska göra, flera val. Speglar NX.BEHOV
--                    i nextrum-app.js:
--                      laxor, prov, ikapp, utmaning, struktur, motivation
--   format_onskemal  online, pa_plats eller bada. Speglar
--                    NX.FORMAT_ONSKEMAL.
--
-- INGA HÄLSOUPPGIFTER. Det finns med flit inget fält för diagnos,
-- NPF eller liknande. Det är känsliga personuppgifter (GDPR art. 9)
-- om ett barn, och de behövs inte för att välja studiehjälpare —
-- "Planering och studieteknik" säger det matchningen behöver veta.
-- Vill familjen berätta mer finns about, och den läses av människor.
--
-- Villkoren är rena uttryck, inga funktioner. Ett CHECK-villkor körs
-- som anroparen (CLAUDE.md avsnitt 6), och ett som anropar en funktion
-- kan därför slås sönder av en revoke långt senare.
--
-- skydda_studentfalt är en svartlista (matched_tutor_id, match_status,
-- parent_id, id, uppdrag_id), så familjen kan skriva de nya fälten
-- utan att triggern behöver ändras. Auditloggen tar inte med dem:
-- de beskriver barnet, inte ett tillstånd.
--
-- Ändras listan i nextrum-app.js ska villkoret här ändras i samma
-- ändring, annars svarar databasen med ett check-fel på ett val
-- formuläret erbjöd.
-- ============================================================

alter table public.students
  add column if not exists behov           text[] not null default '{}',
  add column if not exists format_onskemal text;

alter table public.students
  drop constraint if exists students_behov_check;
alter table public.students
  add constraint students_behov_check check (
    behov <@ array['laxor', 'prov', 'ikapp', 'utmaning', 'struktur', 'motivation']::text[]);

alter table public.students
  drop constraint if exists students_format_onskemal_check;
alter table public.students
  add constraint students_format_onskemal_check check (
    format_onskemal is null or format_onskemal in ('online', 'pa_plats', 'bada'));

comment on column public.students.behov is
  'Vad hjälpen ska göra, fasta koder (NX.BEHOV): laxor, prov, ikapp, utmaning, struktur, motivation. '
  'Aldrig hälsouppgifter.';
comment on column public.students.format_onskemal is
  'Familjens önskemål: online, pa_plats eller bada. Null = inte angivet.';
