-- ============================================================
-- NEXTRUM — intresseanmälningar avidentifieras, oanvända konton
-- blir en uppgift
--
-- GDPR art. 5.1 e: uppgifter får inte sparas längre än ändamålet
-- kräver. Integritetspolicyn sa "tills vi svarat och ärendet är
-- avslutat" om intresseanmälningar och "tills ni ber oss ta bort dem"
-- om konton, och ingenting verkställde något av det. Ansökningarna
-- och CV:na gallras sedan tidigare av ansokan-gallring; det här är
-- resten.
--
-- INTRESSEANMÄLNINGAR AVIDENTIFIERAS, DE TAS INTE BORT
--
-- Sex månader efter senaste kontakten (kontaktad_at, annars
-- created_at) töms allt som pekar ut en person: förälderns namn och
-- e-post, barnets namn, fritexten och vår egen notering. Kvar står
-- datum, läge, tjänst, årskurs, ämne och källfälten, så att
-- analysvyerna (Fas 9.6) räknar lika många anmälningar som förut.
-- En borttagen rad hade gjort varje siffra bakåt i tiden lägre, och en
-- siffra som krymper av sig själv går inte att stämma av.
--
-- Årskurs och ämne ensamma pekar inte ut ett barn. Blev familjen kund
-- finns deras uppgifter i kontot; kund_id står kvar som koppling.
--
-- parent_name och email är NOT NULL, så de blir 'Gallrad' och
-- 'gallrad'. Det är också markeringen: en rad med email = 'gallrad'
-- är avidentifierad och rörs inte igen.
--
-- Körs som postgres från pg_cron. skydda_leadfalt släpper igenom
-- postgres utan JWT, och leads_audit reagerar bara på läge och
-- kopplingar, så ingen rad i auditloggen bär något av det som töms.
--
-- KONTON RADERAS INTE AUTOMATISKT
--
-- Ett konto bär ett barns studiehistorik och hänger ihop med pass,
-- rapporter och betalningar som bokföringslagen kräver i sju år. Att
-- radera det automatiskt är fel verktyg. I stället blir ett konto som
-- inte använts på två år en uppgift för admin: hör av er, radera det
-- som inte ska finnas kvar, behåll bokföringsunderlaget. Senast
-- använt är det senaste av inloggning, senaste aktivitet och när
-- kontot skapades: last_seen_at sattes bara för en tredjedel av
-- kontona när det här skrevs.
--
-- ETT JOBB SOM TYST SLUTAR GÖRA NÅGOT SER UT SOM ETT SOM INTE HAR
-- NÅGOT ATT GÖRA
--
-- Står en anmälan kvar oavidentifierad en vecka efter fristen skapas
-- uppgiften "Avidentifieringen av intresseanmälningar har fastnat".
--
-- Schemaläggningen står i nästa migration, efter att funktionerna
-- körts och lästs för hand (Fas 7:s regel).
-- ============================================================

create or replace function intern.leads_avidentifieras_fran(l public.leads)
returns timestamptz
language sql
immutable
set search_path = pg_catalog
as $$
  select greatest(l.created_at, coalesce(l.kontaktad_at, l.created_at)) + interval '6 months'
$$;

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
     set parent_name = 'Gallrad',
         email       = 'gallrad',
         child_name  = null,
         message     = null,
         notering    = null
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

create or replace function intern.konton_oanvanda()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select p.id
      from public.profiles p
      left join auth.users u on u.id = p.id
     where not coalesce(p.is_admin, false)
       and greatest(p.created_at, coalesce(p.last_seen_at, p.created_at),
                    coalesce(u.last_sign_in_at, p.created_at)) < now() - interval '2 years'
  loop
    -- Titeln och beskrivningen bär inget namn: uppgiften pekar på
    -- kontot, och namnet står där.
    perform public.skapa_uppgift(
      'Konto oanvänt i två år: gå igenom och radera',
      'gallring:konto:' || r.id,
      'uppfoljning',
      'Kontot har inte använts på två år. Integritetspolicyn lovar att vi hör av oss och sedan '
        || 'raderar det som inte ska finnas kvar. Bokföringsunderlag (betalningar, underlag, '
        || 'fakturor) sparas ändå i sju år. DATASKYDD.md, Gallring.',
      'profiles', r.id::text,
      ((now() at time zone 'Europe/Stockholm')::date + 30), 'system');
    n := n + 1;
  end loop;
  return jsonb_build_object('uppgifter', n);
end $$;

revoke execute on function intern.leads_avidentifieras_fran(public.leads) from public, anon, authenticated;
revoke execute on function intern.leads_avidentifiera() from public, anon, authenticated;
revoke execute on function intern.konton_oanvanda() from public, anon, authenticated;
