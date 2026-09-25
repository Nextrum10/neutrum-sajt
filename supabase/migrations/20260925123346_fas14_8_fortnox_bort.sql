-- ============================================================
-- NEXTRUM — Fas 14.8: Fortnox bort
--
-- Bokföringen och fakturorna sköts i Wint. Fortnox kopplades aldrig:
-- fortnox_token var tom, integrationer-raden stod på "inte kopplad",
-- och ekonomiagentens verktyg las_fortnox svarade alltid att
-- integrationen saknades. En halvbyggd koppling till ett system man
-- inte ska använda är en väg nästa person bygger vidare på.
--
-- Wint får INGEN rad i integrationer. Det finns ingen koppling att
-- rapportera status för: admin lägger in fakturan i Wint för hand
-- (Fas 14.6), och Wint har varken webhookar eller en sandlåda att
-- prova mot. En statusrad för något som inte är kopplat hade varit
-- samma halvfärdighet en gång till.
--
-- ORDNINGEN: ekonomi-funktionen driftsattes utan Fortnox INNAN den här
-- migrationen kördes. Den gamla läste fortnox_token med service_role,
-- och hade fått ett fel i stället för "inte kopplat" om tabellen
-- försvann under den.
-- ============================================================

-- Vakten. Tabellen ska vara tom: en token i den är en inloggning hos
-- Fortnox som ingen längre vet om, och den ska återkallas hos Fortnox,
-- inte försvinna tyst härifrån.
do $$
begin
  if exists (select 1 from public.fortnox_token) then
    raise exception 'fortnox_token har rader. Återkalla kopplingen i Fortnox först, töm tabellen, och kör sedan om.';
  end if;
end $$;

delete from public.integrationer where tjanst = 'fortnox';

alter table public.integrationer drop constraint integrationer_tjanst_check;
alter table public.integrationer add constraint integrationer_tjanst_check
  check (tjanst = any (array['google_workspace'::text]));

-- Utan cascade, med flit: hänger något på tabellen ska det synas som
-- ett fel här, inte försvinna med den.
drop table public.fortnox_token;
