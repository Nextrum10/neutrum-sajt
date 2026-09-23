/* ============================================================
   Fas 14.0 — passunderlag ser kortbetalningen

   Vyn passunderlag svarar på frågan "kan det här passet behandlas".
   Den har svarat på fyra saker: har_rapport, fakturerbar, fakturerad
   och pa_underlag. Den har INTE svarat på om familjen redan betalat
   passet med kort — bookings.betalning_status fanns inte ens att
   välja i frågan.

   Följden: månadskörningen läser vyn, ser ett genomfört pass med
   rapport som inte står på någon faktura, och skriver en fakturarad.
   Att familjen redan dragit beloppet på kortet syns ingenstans i
   underlaget. Körs båda vägarna skarpt betalar familjen två gånger
   för samma timme, och den enda som upptäcker det är familjen.

   Kolumnen läggs till i vyn. Att HOPPA över raden är fakturerings-
   funktionens beslut, inte vyns: vyn ska beskriva verkligheten, och
   den som läser den ska kunna se varför ett pass inte togs med.

   Studiehjälparens underlag rörs inte. Hen har hållit passet oavsett
   hur familjen betalade, och ersättningen den 25:e ska räknas fram
   precis som förut — det är bara familjehalvan som ska hoppas över.

   KOLUMNEN LIGGER SIST, inte där den hör hemma logiskt. `create or
   replace view` får bara lägga till kolumner på slutet; stoppas en
   in i mitten svarar Postgres "cannot change name of view column".
   Att droppa och skapa om vyn hade tagit med analysvyerna som läser
   den i fallet, och det är ett värre pris än en kolumn i fel ordning.
   ============================================================ */

create or replace view public.passunderlag
with (security_invoker = true) as
select b.id,
       b.parent_id,
       b.tutor_id,
       b.student_id,
       b.subject,
       b.tjanst,
       b.wanted_date,
       b.wanted_time,
       b.duration_min,
       b.antal_barn,
       b.rabatt_ore,
       b.fakturerbar,
       b.fakturerbar_anledning,
       exists (select 1 from public.lesson_reports r where r.booking_id = b.id) as har_rapport,
       exists (select 1 from public.invoice_lines l where l.booking_id = b.id) as fakturerad,
       exists (select 1 from public.payout_lines l where l.booking_id = b.id) as pa_underlag,
       b.betalning_status
from public.bookings b
where b.status = 'completed';

comment on view public.passunderlag is
  'Varje genomfört pass och om det kan behandlas: har_rapport, fakturerbar, fakturerad, pa_underlag, betalning_status. fakturering tar pass där har_rapport och fakturerbar är sanna, och hoppar över FAMILJENS rad när betalning_status visar att kortvägen rört passet (vantar, betald, aterbetald, tvist). Studiehjälparens underlag skapas ändå. Läser med anroparens rättigheter.';

revoke all on public.passunderlag from anon;
