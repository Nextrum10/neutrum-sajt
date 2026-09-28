-- ============================================================
-- NEXTRUM — en månadskörning som bara skrev en del syns under System → Fel
--
-- INTE KÖRD I DRIFTEN ÄN (2026-09-28). Den körs efter merge, med
-- apply_migration, och filen döps då om till versionen den får
-- (CLAUDE.md avsnitt 5). Tills dess stämmer versionen i filnamnet inte
-- mot supabase_migrations.schema_migrations. Jobbet manadskorning går
-- första gången den 1 oktober 04:17 UTC, och det är den körningen den
-- här ändringen finns för.
--
-- fakturering svarar 207 när en del av skrivningarna gick fel: ett
-- underlag eller ett fakturautkast som krockade med unique(tutor_id,
-- period) eller unique(parent_id, period), eller vars rader inte gick
-- in. Vad som inte gick står i svarets problem. Knappen under Ekonomi →
-- Månadskörning visar det, men när schemat väcker funktionen den 1:a
-- (manadskorningen_vacks_av_databasen) läser ingen svaret, och
-- notisfel() tog bara med 400 och uppåt. En studiehjälpare kunde alltså
-- stå utan lönespecifikation och en familj utan fakturautkast, med
-- larmen ej_utbetalt och faktura_saknas som enda spår. Migrationen om
-- väckningen sa att det står under System → Fel när anropet går fel.
-- Det gjorde det bara när hela anropet gick fel.
--
-- Nu tar notisfel() med 207 också, men bara från fakturering. Ingen
-- annan väg svarar 207 i dag: notis-ko, ansokan-notis, ansokan-gallring
-- och lead-notis svarar 200 eller en felkod, och ett delvis misslyckat
-- utskick svarar 500 (notis-ko, ansokan-gallring). En väg som en dag
-- svarar 207 med betydelsen "gick, med undantag" ska inte börja se ut
-- som ett fel utan att någon bestämt det. Målet läses i
-- intern.natanrop_logg, så det är bara databasens egen väckning som
-- räknas.
--
-- Varför inte 500 från funktionen när schemat anropar: 207 säger det
-- som hände, att det som gick in står kvar. Adminvyn säger för 5xx att
-- funktionen gick sönder, och en 500 hade dessutom krävt att
-- fakturering driftsattes igen. Den som ligger ute, version 32, är byte
-- för byte lik main.
--
-- Svaren finns fortfarande bara i sex timmar (pg_net.ttl). Jobbet går
-- 04:17 UTC, så raden står kvar till ungefär 10:17 UTC samma dag, alltså
-- förmiddagen den 1:a i svensk tid. Efter det är larmen på passen det
-- som syns.
--
-- LAPPAS, SKRIVS INTE OM. Flera sessioner ändrar samma funktioner
-- (CLAUDE.md avsnitt 5), så definitionen läses ur databasen och
-- villkoret byts med replace(). Står det inte exakt en gång stannar
-- migrationen i stället för att gissa. create or replace behåller
-- ägaren och rättigheterna.
-- ============================================================

do $$
declare
  def    text;
  gammalt constant text := 'r.status_code >= 400 or r.error_msg is not null)';
  nytt    constant text := 'r.status_code >= 400 or r.error_msg is not null'
                        || E'\n          or (r.status_code = 207 and a.mal = ''fakturering''))';
  n      integer;
begin
  def := pg_get_functiondef('public.notisfel(integer)'::regprocedure);
  n := (length(def) - length(replace(def, gammalt, ''))) / length(gammalt);
  if n <> 1 then
    raise exception 'notisfel(): villkoret för vad som är ett fel står % gånger, väntat en', n;
  end if;
  execute replace(def, gammalt, nytt);
end $$;

comment on function public.notisfel(integer) is
  'Utskick databasen själv gjort (intern.natanrop, webhooken för intresseanmälan) som inte gick fram de senaste timmarna, och månadskörningar (fakturering) som svarade 207 för att en del av skrivningarna gick fel. pg_net sparar svaren i sex timmar. Bara admin: is_admin() står i WHERE, så en icke-admin får noll rader.';
