-- ============================================================
-- NEXTRUM — schema v16, rapportomdömet
-- LEKTIONSRAPPORTEN FÅR ETT OMDÖME
--
-- ÄR APPLICERAD. Två migrationer skrevs som v16 på var sin gren
-- och båda kördes mot samma databas: schema-v16.sql stängde två
-- informationsläckor, den här la till omdömet på
-- lektionsrapporten. De rör inga gemensamma objekt. Filnamnet
-- skiljer dem åt i efterhand; numret gör det inte.
-- Samma sak hände med de två v13-filerna.
--
-- Körs efter schema-v15.sql. Kör en gång i Supabase → SQL Editor.
-- Idempotent.
--
-- Skrevs ursprungligen som v15 på en egen gren, samtidigt som den
-- v15 som redan låg i main (platsen för passet). Två olika
-- migrationer kan inte heta samma sak, så den här fick nästa
-- lediga nummer. Innehållet är orört.
--
--
-- VARFÖR
--
-- Rapporten har varit fyra fritextfält. Den som skrivit tio av dem
-- vet att de tre första blir korta och det sista blir tomt, och den
-- som LÄSER dem — familjen, och vi — får ingen aning om hur det
-- faktiskt gick utan att läsa varje ord.
--
-- Ett omdöme i tre lägen svarar på den frågan direkt, tar ett klick
-- att sätta, och går att räkna på. "Behöver följas upp" blir ett
-- larm i adminvyn i stället för en mening någon måste hitta.
--
--
-- VARFÖR EN KOLUMN OCH INTE ETT FÄLT I raw_notes
--
-- Därför att det ska gå att FRÅGA på. "Vilka elever har tre pass i
-- rad som behöver följas upp" är en fråga man vill kunna ställa,
-- och den går inte att ställa till fritext.
-- ============================================================


-- ============================================================
-- 1. OMDÖMET
-- ============================================================

alter table public.lesson_reports
  add column if not exists gick text,
  add column if not exists amne text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lesson_reports_gick_check') then
    alter table public.lesson_reports
      add constraint lesson_reports_gick_check
      check (gick is null or gick in ('mycket_bra', 'bra', 'folja_upp'));
  end if;
end $$;

comment on column public.lesson_reports.gick is
  'Hur passet gick, satt av studiehjälparen: mycket_bra | bra | folja_upp. Null på rapporter skrivna före v16.';
comment on column public.lesson_reports.amne is
  'Vad de arbetade med. Kopieras från bokningen när rapporten hör till ett pass.';

-- Adminvyn frågar "vilka pass behöver följas upp". Utan index blir
-- det en full scan, och rapporterna är den tabell som växer snabbast
-- av alla — en per genomfört pass, för alltid.
create index if not exists lesson_reports_folja_upp_idx
  on public.lesson_reports (tutor_id, lesson_date desc)
  where gick = 'folja_upp';


-- ============================================================
-- 2. BACKFILL AV ÄMNET
--
-- Rapporter som hör till ett pass ärver passets ämne. De som inte
-- gör det lämnas tomma — att gissa vore att skriva in något ingen
-- sagt.
-- ============================================================

update public.lesson_reports r
set amne = b.subject
from public.bookings b
where b.id = r.booking_id
  and r.amne is null
  and b.subject is not null;


-- ============================================================
-- 3. EFTERÅT
--
-- Omdömet är NULL på allt som skrevs före den här migrationen, och
-- ska förbli det. En gammal rapport utan omdöme är inte "bra" och
-- inte "behöver följas upp" — vi vet inte, och vyerna säger det.
--
--   select gick, count(*) from public.lesson_reports group by gick;
-- ============================================================
