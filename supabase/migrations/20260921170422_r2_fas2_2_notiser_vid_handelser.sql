-- ============================================================
-- NEXTRUM — program 2, Fas 2.2: notiser vid pass, meddelanden och
-- rapporter
--
-- Tre triggrar skapar notiserna. De köar mejl genom
-- intern.notis_skapa, som vet vilka typer som mejlas och vad
-- mottagaren valt. Inget skickas härifrån: arbetaren (2.3) tömmer kön.
--
-- EN FUNKTION PER TABELL, EN HÄNDELSETYP PER ÄNDRING. En flytt är en
-- enda UPDATE som ändrar tid, status och created_by; två triggrar hade
-- gett två notiser. Genomfört ger ingen notis: rapporten gör det, och
-- rapporten sätter passet till genomfört i samma transaktion.
--
-- VEM SOM GJORDE ÄNDRINGEN läses ur auth.uid(), inte ur created_by.
-- Admin går förbi skydda_bokningsfalt och sätter inte alltid
-- created_by. Motparten får notisen; gjorde någon annan ändringen
-- (admin eller databasen själv) får både familjen och
-- studiehjälparen den.
--
-- AVBÖJT OCH AVBOKAT ÄR OLIKA BESKED. Ett önskat pass som motparten
-- säger nej till är avböjt; ett pass som någon ställer in är avbokat.
--
-- BARNETS NAMN FÖLJER BARA MED TILL DEN SOM FÅR SE BARNET. Familjen
-- alltid. Studiehjälparen bara om eleven är hens (Fas 1.6): ett pass
-- för ett syskon kan i dag hamna hos familjens studiehjälpare, och en
-- notis med syskonets namn hade gått förbi RLS.
--
-- EN NOTIS FÅR ALDRIG FÄLLA EN BOKNING. Ett fel fångas, skrivs i
-- notis_fel och syns i adminvyn. Passet, meddelandet eller rapporten
-- sparas ändå.
-- ============================================================

-- Får den här mottagaren se elevens namn?
create or replace function intern.far_se_eleven(p_mottagare uuid, p_elev uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.students s
     where s.id = p_elev
       and (s.parent_id = p_mottagare
            or (s.matched_tutor_id = p_mottagare and s.match_status <> 'pending')))
$$;

revoke execute on function intern.far_se_eleven(uuid, uuid) from public, anon, authenticated;

create or replace function public.notis_vid_pass()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  aktor uuid := auth.uid();
  typ   text;
  bas   jsonb;
  elev  text;
  hjalp text;
  m     uuid;
begin
  if tg_op = 'INSERT' then
    typ := 'pass_nytt';
  elsif new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    typ := case when old.status = 'requested' and aktor is not null and aktor is distinct from old.created_by
                then 'pass_avbojt' else 'pass_avbokat' end;
  elsif new.status in ('requested', 'confirmed')
        and (new.wanted_date is distinct from old.wanted_date or new.wanted_time is distinct from old.wanted_time) then
    typ := 'pass_flyttat';
  elsif old.status = 'requested' and new.status = 'confirmed' then
    typ := 'pass_bekraftat';
  else
    return null;
  end if;

  select intern.fornamn(s.name) into elev from public.students s where s.id = new.student_id;
  select intern.fornamn(p.full_name) into hjalp from public.profiles p where p.id = new.tutor_id;

  bas := jsonb_strip_nulls(jsonb_build_object(
    'datum', new.wanted_date, 'tid', new.wanted_time, 'langd_min', new.duration_min,
    'amne', intern.fornamn(new.subject), 'studiehjalpare', hjalp, 'status', new.status,
    'fran_datum', case when typ = 'pass_flyttat' then old.wanted_date end,
    'fran_tid', case when typ = 'pass_flyttat' then old.wanted_time end));

  foreach m in array array[new.parent_id, new.tutor_id] loop
    continue when m is null or m = aktor;
    perform intern.notis_skapa(m, typ, new.id, new.student_id, new.parent_id, new.tutor_id,
      case when elev is not null and intern.far_se_eleven(m, new.student_id)
           then bas || jsonb_build_object('elev', elev) else bas end);
  end loop;
  return null;
exception when others then
  insert into public.notis_fel (kalla, fel) values ('notis_vid_pass ' || coalesce(new.id::text, ''), left(sqlerrm, 500));
  return null;
end $$;

revoke execute on function public.notis_vid_pass() from public, anon, authenticated;

drop trigger if exists bookings_notis on public.bookings;
create trigger bookings_notis after insert or update of status, wanted_date, wanted_time on public.bookings
  for each row execute function public.notis_vid_pass();

-- Chatt. Motparten till avsändaren; sammanslaget per tråd.
create or replace function public.notis_vid_meddelande()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  m    uuid;
  namn text;
begin
  if new.parent_id is null or new.tutor_id is null or new.sender_id is null then
    return null;
  end if;
  m := case when new.sender_id = new.parent_id then new.tutor_id else new.parent_id end;
  select intern.fornamn(p.full_name) into namn from public.profiles p where p.id = new.sender_id;
  perform intern.notis_skapa(m, 'meddelande', null, null, new.parent_id, new.tutor_id,
    jsonb_strip_nulls(jsonb_build_object('fran', namn)));
  return null;
exception when others then
  insert into public.notis_fel (kalla, fel) values ('notis_vid_meddelande ' || coalesce(new.id::text, ''), left(sqlerrm, 500));
  return null;
end $$;

revoke execute on function public.notis_vid_meddelande() from public, anon, authenticated;

drop trigger if exists messages_notis on public.messages;
create trigger messages_notis after insert on public.messages
  for each row execute function public.notis_vid_meddelande();

-- Rapport. Till familjen, bara i appen (rapport mejlas inte). Bara vid
-- insert: generate-feedback uppdaterar ai_feedback i efterhand, och
-- det är ingen ny rapport.
create or replace function public.notis_vid_rapport()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  familj uuid;
  elev   text;
  hjalp  text;
begin
  select s.parent_id, intern.fornamn(s.name) into familj, elev from public.students s where s.id = new.student_id;
  select intern.fornamn(p.full_name) into hjalp from public.profiles p where p.id = new.tutor_id;
  perform intern.notis_skapa(familj, 'rapport', new.booking_id, new.student_id, familj, new.tutor_id,
    jsonb_strip_nulls(jsonb_build_object('datum', new.lesson_date, 'elev', elev, 'studiehjalpare', hjalp)));
  return null;
exception when others then
  insert into public.notis_fel (kalla, fel) values ('notis_vid_rapport ' || coalesce(new.id::text, ''), left(sqlerrm, 500));
  return null;
end $$;

revoke execute on function public.notis_vid_rapport() from public, anon, authenticated;

drop trigger if exists lesson_reports_notis on public.lesson_reports;
create trigger lesson_reports_notis after insert on public.lesson_reports
  for each row execute function public.notis_vid_rapport();

-- ---------- de gamla webhookarna ----------

-- nytt-passforslag och nytt-meddelande ersätts av triggrarna ovan och
-- kön. De har aldrig körts i driften (supabase_functions.hooks har noll
-- anrop), så inget mejl som går i dag försvinner. Hade de fått stå
-- kvar hade varje meddelande blivit två mejl den dag flaggan slås på.
-- Kvar blir ny-intresseanmalan (lead-notis), som fungerar och inte hör
-- till Fas 2. Den är nu den enda trigger som bär hemligheten i sin
-- header, så roteringsblocket i arkiv/schema-v17.sql byter alla
-- headers som finns.
drop trigger if exists "nytt-passforslag" on public.bookings;
drop trigger if exists "nytt-meddelande" on public.messages;
