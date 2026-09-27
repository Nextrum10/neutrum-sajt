-- ============================================================
-- Fas 19.4: tre triggerfunktioner går inte att anropa utifrån
--
-- v14b och v16c återkallade EXECUTE på varje triggerfunktion. Fas 16.1
-- skapade tre nya, och Supabases förvalda rättigheter gav dem EXECUTE
-- för anon och authenticated igen:
--
--   public.skydda_klippkortet       (klippkortets skydd på bookings)
--   public.klippkortspass_avbokat   (avbokat timpass blir obetalt)
--   intern.ansokan_besked           (köar mejlen till den som söker)
--
-- Ingen av dem gör något som RPC: Postgres vägrar köra en
-- triggerfunktion utanför en trigger. Men säkerhetsadvisorn listar de
-- två i public som nåbara via /rest/v1/rpc, och en lista där det
-- väntade blandas med det nya är en lista ingen läser. Samma regel som
-- förut: en triggerfunktion har ingen anropare utom sin trigger.
--
-- EXECUTE prövas när triggern SKAPAS, inte när den körs, så triggrarna
-- fortsätter gälla för alla roller. verktyg/rls-test.sql provar det.
-- ============================================================

revoke execute on function public.skydda_klippkortet()     from public, anon, authenticated;
revoke execute on function public.klippkortspass_avbokat() from public, anon, authenticated;
revoke execute on function intern.ansokan_besked()         from public, anon, authenticated;

do $$
declare f text;
begin
  for f in
    select p.oid::regprocedure::text
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where p.prorettype = 'trigger'::regtype and n.nspname in ('public', 'intern')
       and (has_function_privilege('anon', p.oid, 'execute')
            or has_function_privilege('authenticated', p.oid, 'execute'))
  loop
    raise exception 'Triggerfunktionen % går fortfarande att anropa.', f;
  end loop;
end $$;
