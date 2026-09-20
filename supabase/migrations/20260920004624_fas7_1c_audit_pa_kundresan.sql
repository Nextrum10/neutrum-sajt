-- ============================================================
-- NEXTRUM — Fas 7.1c: auditloggen följer med kundresan
--
-- Fas 6 satte auditloggen på pengarna, behörigheterna och
-- tjänsterna. Kundresan stod utanför: en anmälan kunde byta status,
-- en ansökan kunde bli intervjuad och ett uppdrag kunde skapas eller
-- raderas utan att något av det syntes någonstans.
--
-- Det måste vara på plats FÖRE automationerna i 7.2 och 7.3.
-- En automation som skapar uppgifter i en tabell ingen loggar är en
-- maskin som arbetar osedd — och då går det inte att svara på frågan
-- "vem bestämde det här?" efteråt.
--
-- VITLISTORNA BÄR INGEN PERSONDATA. Namn, e-postadresser,
-- meddelandetexter, noteringar, uppgiftstitlar och beskrivningar
-- loggas INTE. Det som loggas är tillstånd och kopplingar: status,
-- vem raden pekar på, och när stegen togs. Samma regel som i 6.1 —
-- en logg som samlar barns uppgifter är en ny sorts risk, inte ett
-- skydd.
--
-- Anmälningar och ansökningar loggas bara vid UPDATE, som students
-- och tutor_profiles: raden finns kvar och går att läsa, och varje
-- publik anmälan som blev en auditrad hade bara gjort loggen svårare
-- att läsa. Uppdrag och uppgifter loggas även vid INSERT och DELETE,
-- som fakturor och utbetalningar: de SKAPAS av maskiner, och då är
-- själva skapandet det intressanta.
-- ============================================================

drop trigger if exists leads_audit on public.leads;
create trigger leads_audit
  after update of status, kund_id, uppdrag_id, kontaktad_at, tjanst on public.leads
  for each row execute function public.logga_andring(
    'anmalan', 'id', 'status', 'kund_id', 'uppdrag_id', 'kontaktad_at', 'tjanst');

drop trigger if exists applications_audit on public.applications;
create trigger applications_audit
  after update of status, kontaktad_at, intervju_at, utbildad_at on public.applications
  for each row execute function public.logga_andring(
    'ansokan', 'id', 'status', 'kontaktad_at', 'intervju_at', 'utbildad_at');

drop trigger if exists uppdrag_audit on public.uppdrag;
create trigger uppdrag_audit
  after insert or delete or update on public.uppdrag
  for each row execute function public.logga_andring(
    'uppdrag', 'id', 'kund_id', 'tjanst', 'typ', 'status');

drop trigger if exists uppgifter_audit on public.uppgifter;
create trigger uppgifter_audit
  after insert or delete or update on public.uppgifter
  for each row execute function public.logga_andring(
    'uppgift', 'id', 'typ', 'status', 'ansvarig', 'nyckel',
    'kopplad_tabell', 'kopplad_id', 'forfallodag', 'skapad_av', 'skapad_av_typ');
