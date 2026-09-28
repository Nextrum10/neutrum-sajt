-- ============================================================
-- NEXTRUM — kontaktmeddelanden och klientfel gallras
--
-- GDPR art. 5.1 e. Kontaktformuläret på Frågor och svar skriver namn,
-- e-post och fritext i contact_messages, och klientfel sparar vilken
-- användare som fick ett fel, på vilken sida och i vilken webbläsare.
-- Ingetdera rensades, och integritetspolicyn nämnde ingetdera.
--
-- Ett kontaktmeddelande tas bort sex månader efter att det kom in
-- eller hanterades, det som är senast: samma frist som
-- intresseanmälningarna. Här tas raden bort i stället för att
-- avidentifieras, för ingen analysvy räknar kontaktmeddelanden.
-- Ett meddelande som aldrig hanterats tas också bort: ett halvårsgammalt
-- obesvarat meddelande är inte ett ärende längre, och fristen är ett
-- löfte till den som skrev.
--
-- Ett klientfel tas bort efter nittio dagar. Ett fel som inte lagats
-- på tre månader syns igen om det finns kvar. klientfel_audit loggar
-- varje borttagen rad med id och sida, aldrig användaren eller texten.
--
-- Körs som postgres från pg_cron. contact_messages_audit reagerar bara
-- på update av hanterad_at och hanterad_av, så ingenting ur
-- meddelandet hamnar i auditloggen.
-- ============================================================

create or replace function intern.kontakt_och_fel_gallra()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  kontakt integer;
  fel     integer;
begin
  delete from public.contact_messages c
   where greatest(c.created_at, coalesce(c.hanterad_at, c.created_at)) < now() - interval '6 months';
  get diagnostics kontakt = row_count;

  delete from public.klientfel k
   where k.created_at < now() - interval '90 days';
  get diagnostics fel = row_count;

  return jsonb_build_object('kontaktmeddelanden', kontakt, 'klientfel', fel);
end $$;

revoke execute on function intern.kontakt_och_fel_gallra() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'kontakt-och-fel-gallring';
select cron.schedule('kontakt-och-fel-gallring', '44 3 * * *', $$select intern.kontakt_och_fel_gallra()$$);
