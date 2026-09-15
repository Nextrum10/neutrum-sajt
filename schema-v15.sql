-- ============================================================
-- NEXTRUM — schema v15
-- VAR PASSET HÅLLS
--
-- Kör en gång i Supabase → SQL Editor. Den är idempotent: kör den
-- två gånger och ingenting händer andra gången.
--
--
-- VARFÖR
--
-- Läxhjälpen är tänkt att ske på plats. Bokningen har hittills
-- kunnat säga ATT ett pass är på plats — bookings.format är
-- "På plats" eller "Online" — men aldrig VAR. Familjen och
-- studiehjälparen fick komma överens i chatten, och beskedet låg
-- sedan någonstans i en tråd i stället för på passet.
--
-- Det gör tre saker sämre. Studiehjälparen som ska ta sig någonstans
-- ser inte vart på sin egen passlista. Den som bokar om ett pass
-- tappar platsen. Och ett pass som flyttas från online till på plats
-- lämnar inget spår av att frågan ens ställdes.
--
--
-- HUR
--
-- En kolumn. Fritext, för det är vad en plats är — "hemma hos oss",
-- "biblioteket i Vasastan", en adress. Ingen validering och inget
-- register över platser: ett sådant hade krävt att någon underhöll
-- det, och de flesta familjer har exakt en plats.
--
-- Frivillig. Den som inte bestämt än ska inte hindras från att boka,
-- och vyerna säger då "Bestäms i chatten" i stället för att låtsas
-- att frågan är avklarad.
--
-- Ingen ny RLS-regel behövs. Kolumnen ärver bookings egna policyer,
-- som redan säger att en rad syns för familjen den gäller, för
-- studiehjälparen som ska hålla passet, och för admin.
-- ============================================================

alter table public.bookings
  add column if not exists location text;

comment on column public.bookings.location is
  'Var ett pass på plats hålls. Fritext, frivillig. Tom = familjen och studiehjälparen kommer överens i chatten.';

-- Vyerna som lämnar ut pass till motparten listar sina kolumner
-- explicit, så en ny kolumn syns inte förrän den skrivs in. De som
-- inte behöver platsen lämnas ifred — tutor_busy_slots ska bara
-- säga att en timme är upptagen, inte var någon befinner sig.
