-- ============================================================
-- NEXTRUM — AI-texterna och de avslutade uppgifterna gallras
--
-- GDPR art. 5.1 e. Tre ställen där text om familjer och elever blev
-- kvar för alltid, hittade vid genomgången 2026-09-28:
--
-- 1. AGENTLOGGEN. gallra_agentloggen() fanns (Fas 8) men kördes bara
--    om någon tryckte på knappen. Frågan och svaret till agenterna,
--    och varje verktygssteg, kan bära elevers initialer, årskurs och
--    maskad fritext. Nu körs den varje natt med 90 dagar, samma tid
--    som knappens förval. Körningen står kvar med status och tokens;
--    texten töms (funktionens eget val).
--
-- 2. AI-FÖRSLAGENS MOTIVERING. ai_forslag.motivering är modellens
--    text, upp till 2 000 tecken, om en anmälan, en elev eller ett
--    pass. Raden måste stå kvar, för en nyckel är ett förslag för
--    alltid (ett avvisat par ska inte komma tillbaka). Motiveringen
--    töms 90 dagar efter beslutet. frys_forslaget nekade varje ändring
--    av motiveringen, också den; den släpper nu igenom exakt det här
--    och inget annat: till null, på ett avgjort förslag, utan inloggad
--    användare (pg_cron). Det admin godkände var det AI:n föreslog, och
--    det står i auditloggen, som inte loggar motiveringen.
--
-- 3. UPPGIFTERNA. En uppgift admin skriver kan heta "Ring Annas mamma
--    om Elsas matte". Klara och avbrutna uppgifter tas bort ett år
--    efter att de stängdes. Öppna rörs aldrig. uppgifter_audit loggar
--    borttagningen med läge och kopplingar, inte titel eller text.
--
-- Och en fjärde, i avidentifieringen: landningssida kapas vid "?".
-- nextrum-app.js sparar sedan i dag bara våra egna utm-taggar där,
-- men en äldre version sparade hela adressen, med annonsnätverkens
-- klick-id (gclid, fbclid). Ett klick-id i en avidentifierad rad
-- vore inte avidentifierat. Inga rader i driften hade något.
-- ============================================================

create or replace function public.frys_forslaget()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.id is distinct from old.id
     or new.typ is distinct from old.typ
     or new.payload is distinct from old.payload
     or (new.motivering is distinct from old.motivering
         and not (new.motivering is null
                  and old.status <> 'foreslagen'
                  and auth.uid() is null))
     or new.nyckel is distinct from old.nyckel
     or new.korning_id is distinct from old.korning_id
     or new.skapad is distinct from old.skapad
     or new.kopplad_tabell is distinct from old.kopplad_tabell
     or new.kopplad_id is distinct from old.kopplad_id
  then
    raise exception using errcode = '42501',
      message = 'Ett förslag går inte att skriva om efter att det skapats. '
             || 'Det admin godkänner ska vara det AI:n föreslog.';
  end if;
  return new;
end $$;

create or replace function intern.ai_och_uppgifter_gallra()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  agent    jsonb;
  forslag  integer;
  uppg     integer;
begin
  agent := public.gallra_agentloggen(90);

  update public.ai_forslag f
     set motivering = null
   where f.motivering is not null
     and f.status <> 'foreslagen'
     and f.beslutad < now() - interval '90 days';
  get diagnostics forslag = row_count;

  delete from public.uppgifter u
   where u.status in ('klar', 'avbruten')
     and coalesce(u.klar_at, u.uppdaterad, u.created_at) < now() - interval '1 year';
  get diagnostics uppg = row_count;

  return jsonb_build_object('agentloggen', agent, 'motiveringar', forslag, 'uppgifter', uppg);
end $$;

create or replace function intern.leads_avidentifiera()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n        integer;
  fastnade integer;
begin
  update public.leads l
     set parent_name   = 'Gallrad',
         email         = 'gallrad',
         child_name    = null,
         message       = null,
         notering      = null,
         landningssida = nullif(split_part(l.landningssida, '?', 1), '')
   where l.email <> 'gallrad'
     and intern.leads_avidentifieras_fran(l) <= now();
  get diagnostics n = row_count;

  select count(*) into fastnade
    from public.leads l
   where l.email <> 'gallrad'
     and intern.leads_avidentifieras_fran(l) <= now() - interval '7 days';

  if fastnade > 0 then
    perform public.skapa_uppgift(
      'Avidentifieringen av intresseanmälningar har fastnat',
      'gallring:leads:fastnat',
      'problem',
      fastnade || ' intresseanmälningar skulle ha avidentifierats för mer än en vecka sedan. '
        || 'Jobbet heter leads-avidentifiering i pg_cron; dess utfall står i cron.job_run_details. '
        || 'DATASKYDD.md, Gallring.',
      null, null, (now() at time zone 'Europe/Stockholm')::date, 'system');
  end if;

  return jsonb_build_object('avidentifierade', n, 'fastnade', fastnade);
end $$;

revoke execute on function public.frys_forslaget() from public, anon, authenticated;
revoke execute on function intern.ai_och_uppgifter_gallra() from public, anon, authenticated;
revoke execute on function intern.leads_avidentifiera() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'ai-och-uppgifter-gallring';
select cron.schedule('ai-och-uppgifter-gallring', '51 3 * * *', $$select intern.ai_och_uppgifter_gallra()$$);
