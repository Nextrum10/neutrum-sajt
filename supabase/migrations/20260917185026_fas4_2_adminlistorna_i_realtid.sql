-- ============================================================
-- NEXTRUM — Fas 4.2: adminvyns tre listor kommer i realtid
--
-- leads, applications och contact_messages är de tre borden som fylls
-- UTIFRÅN: en familj skickar en intresseanmälan, någon söker jobb,
-- någon skriver i kontaktformuläret. Allt annat i adminvyn ändras av
-- admin själv, och de raderna ritas redan om när de ändras.
--
-- Adminvyn frågade förut efter antalet i alla tre var 60:e sekund,
-- och hämtade om listorna när summan vuxit. Nu kommer raden i stället.
--
-- RLS SLÄPPER BARA IGENOM ADMIN. Alla tre har exakt en SELECT-policy
-- ("endast admin läser …"), och Realtime kör samma policy som REST med
-- anroparens egen token. En inloggad familj som prenumererar på
-- kanalen får därför ingenting — vilket testas, inte antas.
--
-- Att anon får SKRIVA i leads och contact_messages (formulären på
-- sajten) ändras inte här, och spelar ingen roll för det som skickas
-- ut: en INSERT som anon inte får läsa tillbaka når heller ingen
-- anon-prenumerant.
-- ============================================================

alter publication supabase_realtime add table public.leads;
alter publication supabase_realtime add table public.applications;
alter publication supabase_realtime add table public.contact_messages;
