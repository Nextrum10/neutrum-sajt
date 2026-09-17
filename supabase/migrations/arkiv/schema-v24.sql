-- ============================================================
-- NEXTRUM — schema v24
-- REKRYTERINGEN OCH KONTAKTEN FÅR SPÅR
--
-- Körs efter schema-v23.sql. Idempotent. Additiv: fyra kolumner på
-- applications, två på leads, inga policyer och ingen data rörd.
--
--
-- VARFÖR
--
-- En ansökan kunde bara vara Ny, Kontaktad, Godkänd eller Avböjd.
-- Det gick alltså inte att skilja "vi har mejlat men inte hört
-- något" från "intervjuad, väntar på beslut" — och en ansökan som
-- legat still i tre veckor såg ut precis som en som kom in idag.
--
-- Rekryteringen är i praktiken fyra steg: höra av sig, intervjua,
-- utbilda, ta in i poolen. Tidsstämplar i stället för fler
-- statuslägen, för det man vill veta är NÄR något hände, inte bara
-- att det hänt. En tom stämpel säger "inte gjort" utan att man
-- behöver en status som heter det.
--
--
-- VARFÖR UTBILDNINGEN ÄR ETT EGET STEG
--
-- En studiehjälpare som inte vet hur rapporten fungerar lämnar inga
-- rapporter, och utan rapport blir passet aldrig genomfört — alltså
-- aldrig fakturerat och aldrig utbetalt. Introduktionen är inte en
-- artighet, den är det som gör att kedjan går ihop. Därför en egen
-- stämpel som adminvyn kan kräva innan någon tas in i poolen.
--
--
-- NOTERINGARNA
--
-- applications och leads har ingen SELECT-policy för någon annan än
-- admin, så fältet syns aldrig för den sökande eller familjen. Det
-- är samma resonemang som bakom admin_noteringar i schema-v13.
-- ============================================================

alter table public.applications
  add column if not exists kontaktad_at   timestamptz,
  add column if not exists intervju_at    timestamptz,
  add column if not exists utbildad_at    timestamptz,
  add column if not exists notering       text;

comment on column public.applications.kontaktad_at is
  'När vi hörde av oss första gången. Sätts när mejlutkastet öppnas i adminvyn.';
comment on column public.applications.intervju_at is
  'Bokad eller genomförd intervju. Fritt satt av admin.';
comment on column public.applications.utbildad_at is
  'När introduktionen är gjord. Ett krav innan personen tas in i poolen — en studiehjälpare som inte vet hur rapporten fungerar lämnar inga rapporter.';
comment on column public.applications.notering is
  'Ledningens egna anteckningar om den sökande. Syns aldrig för den sökande: applications har ingen SELECT-policy för någon annan än admin.';

alter table public.leads
  add column if not exists kontaktad_at timestamptz,
  add column if not exists notering     text;

comment on column public.leads.kontaktad_at is
  'När vi svarade familjen. Sätts när mejlutkastet öppnas i adminvyn.';


-- ============================================================
-- EFTERÅT
--
--   select status, count(*) filter (where kontaktad_at is not null) as kontaktade,
--          count(*) filter (where intervju_at is not null)  as intervjuade,
--          count(*) filter (where utbildad_at is not null)  as utbildade
--   from public.applications group by status;
-- ============================================================
