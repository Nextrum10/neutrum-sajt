-- ============================================================
-- Fas 17.1: lönefilen till Fortnox
--
-- Timmarna finns redan i payouts och payout_lines. Det som saknades
-- för att göra dem till en lönefil var två saker som bara lönesystemet
-- vet: vilket ANSTÄLLNINGSNUMMER varje studiehjälpare har där, och
-- vilken LÖNEART timlönen har. Utan dem hade filen antingen matchat
-- ingen, eller matchat fel person.
--
--
-- ANSTÄLLNINGSNUMRET BOR I EN EGEN TABELL, INTE I tutor_profiles
--
-- tutor_profiles har policyn "läxhjälpare uppdaterar egen profil".
-- En kolumn där hade betytt att studiehjälparen kunde skriva in en
-- kollegas nummer och få sina timmar utbetalda till fel person, eller
-- sin kollegas till sig själv. skydda_tutorfalt() hade kunnat vakta
-- den, men då hade skyddet hängt på att nästa person som skriver om
-- triggern kommer ihåg kolumnen. Här finns ingen policy för någon
-- annan än admin, så det finns ingenting att komma ihåg.
--
-- Inget personnummer. Lönesystemet har det, och filen behöver det
-- inte: PAXml matchar på anstid.
--
--
-- LÖNEARTEN STÅR I BOLAGSFAKTA
--
-- Den är en egenskap hos bolagets lönesystem, inte hos en person.
-- Semesterersättningen räknas INTE i filen. Fortnox lägger på den på
-- timlönen, och hade filen också gjort det hade den betalats två gånger.
-- ============================================================

create table public.lon_anstallning (
  id                  uuid primary key references public.tutor_profiles(id) on delete cascade,
  anstallningsnummer  text not null unique
                      check (anstallningsnummer ~ '^[0-9A-Za-z-]{1,20}$'),
  satt_at             timestamptz not null default now()
);

comment on table public.lon_anstallning is
  'Studiehjälparens anställningsnummer i lönesystemet (anstid i PAXml). Bara admin läser och skriver. Ligger inte i tutor_profiles, som studiehjälparen själv får uppdatera.';

alter table public.lon_anstallning enable row level security;

create policy "admin läser anställningsnummer" on public.lon_anstallning
  for select to authenticated using (public.is_admin());
create policy "admin skapar anställningsnummer" on public.lon_anstallning
  for insert to authenticated with check (public.is_admin());
create policy "admin ändrar anställningsnummer" on public.lon_anstallning
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin tar bort anställningsnummer" on public.lon_anstallning
  for delete to authenticated using (public.is_admin());

-- Ett ändrat nummer flyttar timmar mellan personer i lönesystemet.
-- Kopplingen loggas; den är inget innehåll.
create trigger lon_anstallning_audit
  after insert or update or delete on public.lon_anstallning
  for each row execute function public.logga_andring(
    'anstallningsnummer', 'id', 'id', 'anstallningsnummer');

alter table public.foretagsfakta
  add column lonart_timlon text
  check (lonart_timlon is null or lonart_timlon ~ '^[0-9A-Za-z]{1,10}$');

comment on column public.foretagsfakta.lonart_timlon is
  'Löneartens nummer för timlön i lönesystemet. Lönefilen skriver timmarna på den. Semesterersättningen läggs på av lönesystemet, inte av filen.';

drop trigger if exists foretagsfakta_audit on public.foretagsfakta;
create trigger foretagsfakta_audit
  after update on public.foretagsfakta
  for each row execute function public.logga_andring(
    'bolagsfakta', 'id', 'organisationsnummer', 'bolagsform', 'rakenskapsar_slut',
    'momsregistrerad', 'momsperiod', 'f_skatt', 'arbetsgivarregistrerad',
    'studiehjalpare_form', 'bokforingssystem', 'lonart_timlon');
