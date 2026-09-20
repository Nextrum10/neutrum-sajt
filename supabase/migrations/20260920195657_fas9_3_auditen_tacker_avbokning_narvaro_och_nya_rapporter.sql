-- ============================================================
-- NEXTRUM — Fas 9.3: auditloggen täcker det den påstår sig täcka
--
-- Fas 9:s klartkriterium är att loggen täcker alla känsliga
-- åtgärder. Den gör det inte i dag, och luckorna är inte små:
--
--   · bookings_audit fyrar BARA på fakturerbar. En avbokning, ett
--     byte av status och en ändrad närvaro loggas inte alls — och
--     status är det fält hela pengaflödet hänger på.
--   · lesson_reports_audit fyrar bara på UPDATE. Att en rapport
--     SKAPAS — det som gör passet genomfört och fakturerbart —
--     syns inte.
--   · ai_konfig kan sänkas eller höjas av vem som helst med
--     service_role utan spår. Taket är det som hindrar en skenande
--     AI-kostnad; att ändra det ska synas.
--   · contact_messages: vem som tog hand om ett meddelande.
--   · klientfel: fliken Fel RADERAR rader. Att fel städas bort utan
--     spår är hur ett återkommande fel blir osynligt.
--   · foretagsfakta styr momsperiod, bolagsform och om
--     studiehjälparna är anställda. Ekonomiagenten läser den.
--
-- VITLISTORNA BÄR INGEN PERSONDATA, som i 6.1 och 7.1c. Inga namn,
-- inga adresser, inget rapportinnehåll, ingen fritext. Det som
-- loggas är tillstånd, kopplingar och tidpunkter.
--
-- Två saker loggas MED FLIT INTE:
--   · materials och admin_noteringar. Ett filnamn heter i praktiken
--     "Provräkning Alva v42.pdf" och en notering är fritext om en
--     familj. Auditloggen går inte att rätta i efterhand, och då är
--     det fel ställe för sådant.
--   · kund_skatteuppgifter. Funktionerna spara_/las_/radera_ skriver
--     redan sina egna auditrader; en trigger hade dubbelloggat.
--
-- AVSTÄMNING: loggen är tom, så kriteriet kan inte kontrolleras mot
-- data. Det kontrolleras mot pg_trigger plus ett rullat DO-block per
-- känslig åtgärd — ett sådant ligger i verktyg/rls-test.sql.
-- ============================================================

-- Passet: hela dess liv, inte bara undantagandet.
drop trigger if exists bookings_audit on public.bookings;
create trigger bookings_audit
  after insert or update of status, attendance, fakturerbar, wanted_date, wanted_time
  on public.bookings
  for each row execute function public.logga_andring(
    'pass', 'id', 'status', 'attendance', 'fakturerbar', 'wanted_date', 'wanted_time',
    'parent_id', 'tutor_id', 'student_id', 'uppdrag_id');

-- Rapporten: att den skapas är själva händelsen.
drop trigger if exists lesson_reports_audit on public.lesson_reports;
create trigger lesson_reports_audit
  after insert or update of booking_id, narvaro on public.lesson_reports
  for each row execute function public.logga_andring(
    'rapport', 'id', 'booking_id', 'narvaro', 'student_id', 'tutor_id', 'lesson_date');

-- Taket för vad AI:n får kosta.
drop trigger if exists ai_konfig_audit on public.ai_konfig;
create trigger ai_konfig_audit
  after insert or update on public.ai_konfig
  for each row execute function public.logga_andring(
    'ai_konfig', 'id', 'dygnstak_tokens');

-- Vem som tog hand om ett kontaktmeddelande. Inte innehållet.
drop trigger if exists contact_messages_audit on public.contact_messages;
create trigger contact_messages_audit
  after update of hanterad_at, hanterad_av on public.contact_messages
  for each row execute function public.logga_andring(
    'kontaktmeddelande', 'id', 'hanterad_at', 'hanterad_av');

-- Att ett klientfel städas bort. Meddelandet och stacken loggas inte:
-- de kan innehålla en adress eller ett id ur en trasig sida.
drop trigger if exists klientfel_audit on public.klientfel;
create trigger klientfel_audit
  after delete on public.klientfel
  for each row execute function public.logga_andring(
    'klientfel', 'id', 'sida');

-- Bolagsfakta styr moms, bolagsform och anställningsfrågan.
-- anteckningar och redovisningskonsult är fritext respektive en
-- person, och står därför inte i listan.
drop trigger if exists foretagsfakta_audit on public.foretagsfakta;
create trigger foretagsfakta_audit
  after update on public.foretagsfakta
  for each row execute function public.logga_andring(
    'bolagsfakta', 'id', 'organisationsnummer', 'bolagsform', 'rakenskapsar_slut',
    'momsregistrerad', 'momsperiod', 'f_skatt', 'arbetsgivarregistrerad',
    'studiehjalpare_form', 'bokforingssystem');
