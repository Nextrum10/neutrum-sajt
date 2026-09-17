-- ============================================================
-- NEXTRUM — Fas 3.7: en rapport som hör till ett pass måste säga
-- om eleven var där
--
-- Triggern från Fas 2.3 (lesson_reports_gor_passet_genomfort) sätter
-- passet till completed när rapporten skrivs. Den gör det bara när
-- narvaro är ifylld, och det var med flit: den gamla studiehjälparvyn
-- skickade ingen närvaro, och under övergången skulle en rapport från
-- den vyn inte avbrytas.
--
-- Övergången är över. Den nya vyn ligger i main och i drift, och
-- rapportformuläret skickar alltid narvaro när rapporten hör till ett
-- pass (select:en har ett valt värde från början, se larare.html).
-- Utan det här kravet kan en rapport tyst hamna vid sidan av: passet
-- står kvar som bekräftat, faktureringen hoppar över det, och ingen
-- ser något fel någonstans.
--
-- NOT VALID med flit. Två av dagens fyra rapporter har booking_id men
-- ingen narvaro — de skrevs innan kolumnen fanns. Att skriva om gammal
-- data för att en ny regel ska gå jämnt ut är att ändra historien.
-- Regeln gäller allt som skrivs från och med nu; de gamla raderna
-- lämnas som de är, och syns i adminvyns avvikelselista.
-- ============================================================

alter table public.lesson_reports
  add constraint rapport_med_pass_har_narvaro
  check (booking_id is null or narvaro is not null)
  not valid;
