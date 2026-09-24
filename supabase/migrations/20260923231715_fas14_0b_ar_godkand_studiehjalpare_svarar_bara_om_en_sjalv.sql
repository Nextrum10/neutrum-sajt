/* ============================================================
   Fas 14.0b — ar_godkand_studiehjalpare svarar bara om en själv

   Funktionen kom med Fas 13.2 och var den första policyn som ställde
   frågan "är den här personen godkänd" i databasen. Den fick samma
   form som is_admin — SECURITY DEFINER, uid med auth.uid() som
   förval — men INTE is_admins vakt.

   Skillnaden spelar roll. is_admin lämnar bara ut raden när uid är
   ens eget ELLER anroparen själv är admin. Den här lämnade ut svaret
   för vilket uuid som helst, till vem som helst: prövat som anon mot
   driften svarade ar_godkand_studiehjalpare(<en godkänd hjälpare>)
   true, medan is_admin(<samma uuid>) svarade false.

   HUR ALLVARLIGT ÄR DET I DAG: lite. publika_studiehjalpare() lämnar
   redan ut id på varje godkänd studiehjälpare till anon, så mängden
   går att få fram ändå. Det som rättas är alltså inte en läcka i
   dag — det är att mönstret CLAUDE.md pekar ut som skälet till att
   is_admin är ofarlig inte gällde här. Den dagen publika_
   studiehjalpare slutar lämna ut id:t hade det blivit en läcka, och
   ingen hade kopplat de två sakerna till varandra.

   TVÅ ÅTGÄRDER, INTE EN:

   1. Vakten, ordagrant som is_admins. Efter den svarar funktionen
      false i stället för att lämna ut något, oavsett vem som frågar.
   2. revoke execute från anon. Det är säkert HÄR — alla fem policyer
      som backar funktionen är `to authenticated`, och inget check-
      villkor, ingen vy och ingen annan funktion nämner den
      (kontrollerat mot pg_constraint, pg_proc och pg_class innan den
      här skrevs).

      Punkt 2 är med flit prövad först. Fas 10 kostade en omgång på
      precis det här: en revoke på tjanstkoder_finns, som backade ett
      CHECK-villkor, slog sönder hela ansökningsvägen med "permission
      denied", eftersom ett CHECK-villkor körs som ANROPAREN. Hade
      någon av de fem policyerna varit `to anon` hade samma sak hänt
      här, och biblioteket blivit oläsbart.

   Kontrollerat efteråt med BIB13-raderna i verktyg/rls-test.sql:
   hjälparen ser fortfarande sin egen rad, kan fortfarande inte
   skriva i den delade banken, och anon ser fortfarande ingenting.
   ============================================================ */

create or replace function public.ar_godkand_studiehjalpare(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.tutor_profiles t
    where t.id = uid
      and t.status = 'approved'
      and (
        uid is not distinct from auth.uid()
        or coalesce((select a.is_admin from public.profiles a where a.id = auth.uid()), false)
      )
  )
$function$;

comment on function public.ar_godkand_studiehjalpare(uuid) is
  'Är personen en godkänd studiehjälpare? Svarar bara när uid är anroparens eget eller anroparen är admin — samma vakt som is_admin. Utan den var funktionen ett orakel för vem som helst med ett uuid.';

revoke execute on function public.ar_godkand_studiehjalpare(uuid) from public, anon;
grant execute on function public.ar_godkand_studiehjalpare(uuid) to authenticated;
