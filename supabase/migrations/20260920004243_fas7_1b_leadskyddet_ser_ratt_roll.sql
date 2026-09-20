-- ============================================================
-- NEXTRUM — Fas 7.1b: leadskyddet såg fel roll
--
-- skydda_leadfalt() skrevs SECURITY DEFINER, som de andra
-- skydda_*-triggrarna. Det gjorde undantaget verkningslöst: i en
-- SECURITY DEFINER-funktion är current_user funktionens ÄGARE
-- (postgres), inte anroparens roll. Alltså tog undantaget
-- "current_user in ('service_role','postgres',…)" för ALLA, och en
-- anonym anmälan kunde fortfarande skriva kund_id, status, notering
-- och kontaktad_at. Bevisat i en rullad transaktion: anmälan gick in
-- med kund_id satt och status 'matched'.
--
-- Rättningen är att köra triggern som anroparen (SECURITY INVOKER,
-- alltså utan raden). Då är current_user den roll PostgREST satte:
-- 'anon' för det publika formuläret, 'authenticated' för en inloggad,
-- 'service_role' för en edge-funktion och 'postgres' i SQL Editor
-- och för framtida cron-jobb.
--
-- Triggern behöver ingen egen behörighet: den läser bara NEW och
-- OLD, och is_admin() är SECURITY DEFINER sedan tidigare.
--
-- De andra skydda_*-triggrarna är ORÖRDA. De har ett annat och
-- fungerande undantag (auth.uid() is null), som duger där eftersom
-- de tabellerna aldrig skrivs av någon utan inloggning. leads gör
-- just det, och därför kan den inte använda samma regel.
-- ============================================================

create or replace function public.skydda_leadfalt()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if public.is_admin()
     or current_user in ('service_role', 'postgres', 'supabase_admin')
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.kund_id      := null;
    new.uppdrag_id   := null;
    new.status       := 'new';
    new.kontaktad_at := null;
    new.notering     := null;
  else
    new.kund_id      := old.kund_id;
    new.uppdrag_id   := old.uppdrag_id;
  end if;
  return new;
end $$;

revoke execute on function public.skydda_leadfalt() from public, anon, authenticated;
