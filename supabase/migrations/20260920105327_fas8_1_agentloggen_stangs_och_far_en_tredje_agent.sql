-- ============================================================
-- NEXTRUM — Fas 8.1: agentloggen stängs, och får en tredje agent
--
-- TVÅ SAKER, OCH DEN FÖRSTA ÄR EN STÄDNING SOM BORDE GJORTS I FAS 1.
--
-- agent_korningar och agent_steg har haft Supabases standardgrants:
-- anon och authenticated har INSERT, UPDATE, DELETE och TRUNCATE.
-- RLS räddar det mesta — båda tabellerna har bara en SELECT-policy
-- för admin, och utan policy nekas skrivning — men TRUNCATE prövas
-- ALDRIG mot RLS. Att det inte går att nå genom PostgREST i dag är
-- ett lyckligt sammanträffande, inte ett skydd.
--
-- Det blir viktigare nu: Fas 8 gör loggen till det som ska kunna
-- svara på frågan "vad gjorde AI:n?". En logg som andra kan tömma är
-- ingen logg. Läsningen lämnas som den är, och gatas som förut av
-- policyn "admin laser korningar".
--
-- Motsvarande spärr för audit_logg finns sedan 6.3 (auditlogg_las).
-- Den här tabellen får ingen sådan trigger: agent_steg ska gå att
-- gallra, vilket audit_logg inte ska. Gallringen kommer i 8.7 och
-- körs av serverkod, inte av någon som råkar vara inloggad.
--
-- Den andra saken: 'drift' blir en giltig agent. Kontrollvillkoret
-- listade juridik och ekonomi, och en insert med 'drift' hade fallit
-- på 23514 — vilket med den nya regeln i startaKorning betyder att
-- hela körningen vägrar starta i stället för att köra ologgad.
-- ============================================================

revoke insert, update, delete, truncate, references, trigger
  on public.agent_korningar from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.agent_steg from anon, authenticated;

alter table public.agent_korningar drop constraint if exists agent_korningar_agent_check;
alter table public.agent_korningar
  add constraint agent_korningar_agent_check
  check (agent in ('juridik', 'ekonomi', 'drift'));

comment on column public.agent_korningar.agent is
  'juridik, ekonomi eller drift. Drift-agenten (Fas 8) läser verksamhetens egna siffror och föreslår — den har inga utgående verktyg.';
