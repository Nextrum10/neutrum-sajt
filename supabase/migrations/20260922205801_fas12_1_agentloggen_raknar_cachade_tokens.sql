-- ============================================================
-- Fas 12.1: agentloggen räknar också de cachade tokenen
--
-- OBS namnkrocken: en annan gren registrerade också ett "fas12_1"
-- (stripe_connect_och_passbetalning). Versionerna skiljer sig, så
-- databasen är nöjd, men numret säger inte längre vilken fas som är
-- vilken. Sanningen står i schema_migrations, inte i filnamnet.
--
-- usage.input_tokens UTESLUTER allt som lästes ur promptcachen. Från
-- den dag prompt caching slogs på visade därför agent_korningar en
-- lägre insiffra än körningen faktiskt hade, och det gick inte längre
-- att räkna ut vad en körning kostade.
--
-- De fyra posterna har olika taxa, och det är hela skälet till att de
-- måste stå var för sig i stället för att summeras ihop:
--   vanlig in        1x
--   cacheskrivning   1,25x   (fem minuters livslängd)
--   cacheläsning     0,1x    (0,05x på Opus 5.5)
--   ut               (egen taxa)
--
-- Utan de här två kolumnerna går det heller inte att se OM cachen
-- fungerar. En cache som tyst slutat träffa ser ut som en dyrare
-- körning, inte som ett fel.
-- ============================================================

alter table public.agent_korningar
  add column if not exists cache_las_tokens integer not null default 0,
  add column if not exists cache_skriv_tokens integer not null default 0;

comment on column public.agent_korningar.cache_las_tokens is
  'Tokens lästa ur promptcachen. Räknas INTE i in_tokens.';

comment on column public.agent_korningar.cache_skriv_tokens is
  'Tokens skrivna till promptcachen. Räknas INTE i in_tokens.';
