-- ============================================================
-- NEXTRUM — Fas 15.1: ett pass är bekräftat först när
-- studiehjälparen sagt ja
--
-- Fas 4.4 gav familjen två vägar: boka en tid inom studiehjälparens
-- veckotider (bekräftades direkt av triggern bekrafta_inom_schemat)
-- eller önska en annan tid (blev en förfrågan).
--
-- Leo bytte modell 2026-09-24. Familjen har en tom kalender, trycker
-- på en dag, väljer ämne, tid och antal barn och FÖRESLÅR tiden.
-- Studiehjälparen accepterar eller föreslår en annan tid under
-- Föreslagna tider, och först då hamnar passet under Mina lektioner.
-- Veckotiderna ("Dina tider") är borta ur studiehjälparvyn.
--
-- Triggern hade då gjort det nya flödet till en lögn: en tid som
-- råkade ligga inom ett gammalt veckofönster hade blivit 'confirmed'
-- utan att någon tackat ja, och aldrig synts under Föreslagna tider.
-- Den tas bort, och funktionen med den — en trigger som ingen kör
-- men som finns kvar är precis den sortens halvfärdighet CLAUDE.md
-- varnar för.
--
-- tutor_availability TAS INTE BORT. Raderna är historik över vad
-- studiehjälparna en gång angav, och ingenting läser tabellen längre
-- (nextrum-app.js hämtaTillganglighet togs bort i samma ändring).
-- En tabell kan tas bort senare; en tabell som tagits bort går inte
-- att läsa i efterhand.
--
-- skydda_bokningsfalt rörs inte här. Den kräver redan att varje ny
-- bokning börjar som 'requested' och att bekräftelsen kommer från
-- motparten — det var bara den här triggern som gick förbi det.
-- ============================================================

drop trigger if exists bookings_tid_inom_schemat on public.bookings;
drop function if exists public.bekrafta_inom_schemat();

comment on table public.tutor_availability is
  'Studiehjälparnas veckotider fram till 2026-09-24. Läses inte längre av '
  'något: familjen föreslår en tid och studiehjälparen svarar (Fas 15.1). '
  'Sparad som historik.';
