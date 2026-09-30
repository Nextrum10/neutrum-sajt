-- ============================================================
-- NexLäx: tolv hjälpfunktioner får en fast search_path
--
-- Supabases advisor larmade (function_search_path_mutable) på tolv
-- funktioner i intern som Fas 23.1 och 23.2 skrev utan SET. De är
-- SECURITY INVOKER och nås inte genom PostgREST, så ingen kunde
-- utnyttja det, men en funktion som slår upp tabeller och typer
-- genom anroparens search_path svarar olika beroende på vem som
-- anropar. Resten av databasen har 'public, pg_temp'.
--
-- ALTER FUNCTION ... SET ändrar inte prosrc: md5-vakterna i senare
-- migrationer som läser funktionskroppen träffar samma text som förut.
-- Skrivs en av dem om med create or replace ska SET stå med där,
-- annars försvinner den igen.
-- ============================================================

alter function intern.niva_norm(text)                          set search_path = public, pg_temp;
alter function intern.niva_lika(text, text)                    set search_path = public, pg_temp;
alter function intern.niva_tal(text, boolean)                  set search_path = public, pg_temp;
alter function intern.niva_facit(public.niva_fragor)           set search_path = public, pg_temp;
alter function intern.niva_ratta(public.niva_fragor, jsonb)    set search_path = public, pg_temp;
alter function intern.niva_fraga_ut(public.niva_fragor)        set search_path = public, pg_temp;
alter function intern.nexlax_vikt(text)                        set search_path = public, pg_temp;
alter function intern.nexlax_fraga_xp(uuid, uuid, uuid)        set search_path = public, pg_temp;
alter function intern.nexlax_omrade_klart(uuid, text, text, text) set search_path = public, pg_temp;
alter function intern.nexlax_handelser(uuid)                   set search_path = public, pg_temp;
alter function intern.nexlax_mastarfragor(public.nivaer)       set search_path = public, pg_temp;
alter function intern.nexlax_repetitionsfragor(public.nivaer, uuid) set search_path = public, pg_temp;
