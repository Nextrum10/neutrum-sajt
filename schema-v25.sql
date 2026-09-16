-- ============================================================
-- NEXTRUM — schema v25
-- TVÅ TRIGGRAR SOM SKICKAR MEJL, UTAN ATT NÅGON KLISTRAR IN NÅGOT
--
-- Körs efter schema-v24.sql. Idempotent.
--
-- Skapar:
--   1. "nytt-passforslag" på bookings  → pass-notis
--   2. "nytt-meddelande"  på messages  → meddelande-notis
--
--
-- VARFÖR schema-v22 ERSÄTTS AV DEN HÄR FILEN
--
-- v22 gjorde samma sak för bookings, men krävde tre steg av en
-- människa: slumpa en sträng, sätta den som secret, och klistra in
-- SAMMA sträng i triggern här nedanför där det stod HEMLIGHET.
--
-- Den uppställningen har vi redan sett gå fel en gång. NOTIS_HEMLIGHET
-- blev satt till den bokstavliga texten "openssl rand -hex 32" —
-- kommandot hade klistrats in i stället för körts — och notiserna
-- fungerade ändå, eftersom headern hade samma fel. Skyddet var noll
-- och ingenting såg trasigt ut. Det var därför schema-v17 flyttade
-- hemligheten till en tabell.
--
-- Här hämtas den ur den tabellen. Blocket nedan läser notis_konfig
-- och bygger triggerdefinitionen med format(), så att värdet aldrig
-- syns på en skärm, aldrig hamnar i en fil, och aldrig behöver skrivas
-- av för hand. Kör filen, klart.
--
-- Följden är att alla tre notisfunktionerna — lead-notis, pass-notis
-- och meddelande-notis — nu delar EN hemlighet på ETT ställe. Roteras
-- den (blocket i schema-v17) byts alla tre samtidigt.
--
--
-- FÖRUTSÄTTNING
--
-- Båda funktionerna måste vara deployade. En trigger som pekar på en
-- adress som inte svarar sväljer felet — en bokning ska aldrig falla
-- för att ett mejl inte gick iväg — och då har man en trigger som
-- inte gör något, vilket är värre än ingen trigger alls, för nästa
-- person tror att mejlen skickas.
-- ============================================================


-- ------------------------------------------------------------
-- 1. BOOKINGS → pass-notis
--
-- bookings får rader från båda håll. Familjen som bokar själv har
-- redan sett vad de gjorde; ett mejl om det är ett kvitto ingen bad
-- om. Bara rader där created_by är någon ANNAN än parent_id är ett
-- förslag som kräver ett svar från någon som inte var där när raden
-- skapades.
--
-- WHEN-villkoret gör att funktionen inte ens anropas för familjens
-- egna bokningar. Det sparar ett HTTP-anrop per bokning och gör
-- regeln läsbar på ett ställe.
--
--
-- 2. MESSAGES → meddelande-notis
--
-- Här finns inget motsvarande villkor att lägga i triggern: varje
-- rad har en avsändare och en motpart, och motparten ska alltid veta
-- att något kommit. Det enda som stoppas här är rader som saknar
-- någon av parterna.
--
-- Tystnadsfönstret — max en notis i timmen per tråd — ligger i
-- funktionen, inte här. En chatt är korta repliker, och den som får
-- fem mejl på tre minuter slutar läsa det sjätte. Det är en
-- bedömning som kan behöva justeras, och då är det lättare att
-- deploya om en funktion än att skriva om en trigger.
-- ------------------------------------------------------------

do $$
declare
  h    text;
  bas  text := 'https://ddkfiuvcppalutfulvbi.supabase.co/functions/v1/';
begin
  select hemlighet into strict h from public.notis_konfig where id = 1;

  execute format(
    'create or replace trigger "nytt-passforslag"
       after insert on public.bookings
       for each row
       when (
         new.status = ''requested''
         and new.created_by is not null
         and new.parent_id is not null
         and new.created_by <> new.parent_id
       )
       execute function supabase_functions.http_request(%L, %L, %L, %L, %L)',
    bas || 'pass-notis',
    'POST',
    json_build_object('x-nextrum-notis', h)::text,
    '{}',
    '5000'
  );

  execute format(
    'create or replace trigger "nytt-meddelande"
       after insert on public.messages
       for each row
       when (
         new.parent_id is not null
         and new.tutor_id is not null
         and new.sender_id is not null
       )
       execute function supabase_functions.http_request(%L, %L, %L, %L, %L)',
    bas || 'meddelande-notis',
    'POST',
    json_build_object('x-nextrum-notis', h)::text,
    '{}',
    '5000'
  );
end $$;


-- ============================================================
-- EFTERÅT
--
--   select tgname from pg_trigger
--    where tgname in ('nytt-passforslag', 'nytt-meddelande');
--   -- två rader
--
-- Vill man se att hemligheten verkligen kom med, jämför LÄNGDEN —
-- aldrig värdet:
--
--   select tgname, length(pg_get_triggerdef(oid)) from pg_trigger
--    where tgname in ('nytt-passforslag', 'nytt-meddelande');
-- ============================================================
