-- ============================================================
-- NEXTRUM — schema v22
-- MEJL NÄR STUDIEHJÄLPAREN FÖRESLÅR EN TID
--
-- Körs efter schema-v21.sql. Idempotent.
--
-- KÖR INTE DEN HÄR FILEN FÖRRÄN pass-notis ÄR DEPLOYAD.
-- Triggern anropar en adress som annars inte svarar. Den sväljer
-- felet — en bokning ska aldrig falla för att ett mejl inte gick
-- iväg — men då har ni en trigger som inte gör något, vilket är
-- värre än ingen trigger, för nästa person tror att mejlen skickas.
--
--
-- STEGEN
--
--   1. supabase secrets set PASS_NOTIS_HEMLIGHET="<slumpa 32 tecken>"
--   2. supabase functions deploy pass-notis --no-verify-jwt
--   3. Byt ut HEMLIGHET nedan mot samma sträng och kör filen.
--
-- Hemligheten står i klartext i triggerdefinitionen, precis som för
-- ny-intresseanmalan. Det är Supabases eget mönster för http_request
-- och den är bara läsbar för den som redan kommer åt pg_trigger,
-- alltså någon med databasåtkomst.
--
--
-- VARFÖR ETT MEJL BEHÖVS NÄR NOTISEN REDAN FINNS
--
-- Förslaget syns i studievyn som en notis, överst, med datum och
-- tid. Men en familj som inte loggar in ser det aldrig — och tiden
-- står bokad hos studiehjälparen tills någon svarar. Det är den
-- väntan mejlet är till för att korta.
--
--
-- VARFÖR VILLKORET LIGGER I TRIGGERN
--
-- bookings får rader från båda håll. Familjen som bokar själv har
-- redan sett vad de gjorde; ett mejl om det är ett kvitto ingen bad
-- om. Bara rader där created_by är någon ANNAN än parent_id är ett
-- förslag som kräver svar.
--
-- WHEN-villkoret gör att funktionen inte ens anropas för familjens
-- egna bokningar. Det sparar ett HTTP-anrop per bokning och gör
-- regeln läsbar på ett ställe.
-- ============================================================

drop trigger if exists "nytt-passforslag" on public.bookings;

create trigger "nytt-passforslag"
  after insert on public.bookings
  for each row
  when (
    new.status = 'requested'
    and new.created_by is not null
    and new.parent_id is not null
    and new.created_by <> new.parent_id
  )
  execute function supabase_functions.http_request(
    'https://ddkfiuvcppalutfulvbi.supabase.co/functions/v1/pass-notis',
    'POST',
    '{"x-nextrum-notis":"HEMLIGHET"}',
    '{}',
    '5000'
  );


-- ============================================================
-- EFTERÅT
--
--   select tgname from pg_trigger
--   where tgrelid = 'public.bookings'::regclass and not tgisinternal;
--   -- nytt-passforslag ska stå med
--
-- Testa sedan på riktigt: föreslå en tid som studiehjälpare till en
-- familj vars konto har en adress ni kan läsa. Kommer inget mejl,
-- titta i Edge Functions → pass-notis → Logs. 401 betyder att
-- hemligheten i triggern och secreten inte är samma sträng.
--
--
-- ATT TA BORT DEN
--
--   drop trigger "nytt-passforslag" on public.bookings;
--
-- Notisen i studievyn påverkas inte — den läser bookings direkt och
-- har aldrig behövt den här triggern.
-- ============================================================
