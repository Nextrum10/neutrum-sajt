-- ============================================================
-- NEXTRUM — program 2, Fas 2.3: arbetaren, påminnelserna och
-- avregistreringen
--
-- Kön töms av edge-funktionen notis-ko. Den tar över namnet efter den
-- sovande koden i driften (supabase/funktioner-arkiv/), men talar med
-- databasen genom funktionerna här, med nya namn. Tre regler:
--
-- 1. DATABASEN BESTÄMMER, ARBETAREN SKICKAR. notis_utskick_ta() prövar
--    varje rad igen när den ska gå: är passet fortfarande bokat på den
--    tiden, vill mottagaren fortfarande ha det, är chatten redan läst i
--    appen, är utskicket för sent, är flaggan på. Arbetaren får bara de
--    rader som faktiskt ska skickas, med adressen ur auth.users — inte
--    ur profiles, där användaren själv kan skriva vilken adress som
--    helst.
-- 2. INGEN RAD TAS TVÅ GÅNGER. Raderna tas med FOR UPDATE SKIP LOCKED
--    och lånas i fem minuter; en arbetare som dör lämnar tillbaka dem
--    när lånet gått ut.
-- 3. BARA service_role når funktionerna (och postgres, för cron). De
--    lämnar ut mejladresser och telefonnummer, och en vanlig inloggning
--    ska aldrig kunna anropa dem via /rpc.
--
-- PÅMINNELSERNA planeras här, i SQL, av notis_planera(). En påminnelse
-- går aldrig för ett pass som bokades efter påminnelsetiden, aldrig
-- efter att passet börjat, och aldrig mer än 30 minuter sent. Bara
-- bekräftade pass påminns; ett önskat pass kan fortfarande bli avböjt.
--
-- SCHEMALÄGGNINGEN kommer i 2.4, efter att arbetaren driftsatts och
-- körts för hand med knappen "Kör nu" i adminvyn. Fas 7:s regel: ett
-- jobb körs synligt innan det körs av sig självt.
-- ============================================================

-- ---------- nycklar och adress i notis_konfig ----------

-- Kolumnerna heter inte avanmal_nyckel och lage (de hade väckt den
-- gamla koden i driften).
alter table public.notis_konfig
  add column if not exists avregistreringsnyckel text not null
    default encode(extensions.gen_random_bytes(32), 'base64');
alter table public.notis_konfig
  add column if not exists arbetare_url text;

update public.notis_konfig
   set arbetare_url = 'https://ddkfiuvcppalutfulvbi.supabase.co/functions/v1/notis-ko'
 where id = 1 and arbetare_url is null;

-- ---------- telefonnumret ----------

-- Ett svenskt mobilnummer i E.164 (+467XXXXXXXX), eller null. Samma
-- regel som Swishnumret i 1.7.
create or replace function intern.sms_nummer(p text)
returns text language sql immutable set search_path = pg_catalog as $$
  select case
    when n ~ '^07[0-9]{8}$' then '+46' || substr(n, 2)
    when n ~ '^467[0-9]{8}$' then '+' || n
    when n ~ '^00467[0-9]{8}$' then '+' || substr(n, 3)
    else null end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as n) x
$$;

revoke execute on function intern.sms_nummer(text) from public, anon, authenticated;

-- ---------- påminnelserna ----------

create or replace function public.notis_planera()
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  inst   public.notis_installning%rowtype;
  h      int;
  b      record;
  paminn timestamptz;
  m      uuid;
  bas    jsonb;
  data   jsonb;
  elev   text;
  hjalp  text;
  nya    int := 0;
begin
  select * into inst from public.notis_installning where id = 1;
  if inst.paminnelser_timmar is null or cardinality(inst.paminnelser_timmar) = 0 then
    return 0;
  end if;

  foreach h in array inst.paminnelser_timmar loop
    for b in
      select bk.id, bk.parent_id, bk.tutor_id, bk.student_id, bk.wanted_date, bk.wanted_time,
             bk.duration_min, bk.subject, bk.created_at,
             (bk.wanted_date + bk.wanted_time::time) at time zone 'Europe/Stockholm' as start
        from public.bookings bk
       where bk.status = 'confirmed'
         and bk.wanted_time is not null
         and bk.wanted_date between (now() at time zone 'Europe/Stockholm')::date - 1
                                and (now() at time zone 'Europe/Stockholm')::date + 8
    loop
      paminn := b.start - make_interval(hours => h);
      continue when paminn > now()                          -- inte dags än
                 or b.start <= now()                        -- passet har börjat
                 or paminn < now() - interval '30 minutes'  -- för sent, cron har stått still
                 or b.created_at > paminn;                  -- bokat efter påminnelsetiden

      select intern.fornamn(s.name) into elev from public.students s where s.id = b.student_id;
      select intern.fornamn(p.full_name) into hjalp from public.profiles p where p.id = b.tutor_id;
      bas := jsonb_strip_nulls(jsonb_build_object(
        'datum', b.wanted_date, 'tid', b.wanted_time, 'langd_min', b.duration_min,
        'amne', intern.fornamn(b.subject), 'studiehjalpare', hjalp, 'timmar', h, 'start', b.start));

      foreach m in array array[b.parent_id, b.tutor_id] loop
        continue when m is null;
        data := case when elev is not null and intern.far_se_eleven(m, b.student_id)
                     then bas || jsonb_build_object('elev', elev) else bas end;

        if not exists (select 1 from public.notiser n
                        where n.pass_id = b.id and n.mottagare = m and n.typ = 'paminnelse'
                          and n.data ->> 'timmar' = h::text and (n.data ->> 'start')::timestamptz = b.start) then
          insert into public.notiser (mottagare, typ, pass_id, elev_id, trad_parent, trad_tutor, data)
          values (m, 'paminnelse', b.id, b.student_id, b.parent_id, b.tutor_id, data);
          nya := nya + 1;
        end if;

        if public.notis_vill(m, 'paminnelse', 'mejl') then
          perform intern.notis_koa(m, 'mejl', 'paminnelse', b.id, b.parent_id, b.tutor_id, data, null,
            'paminnelse:mejl:' || b.id || ':' || h || ':' || extract(epoch from b.start)::bigint,
            now(), b.start);
        end if;
        if public.notis_vill(m, 'paminnelse', 'sms') then
          perform intern.notis_koa(m, 'sms', 'paminnelse', b.id, b.parent_id, b.tutor_id, data, null,
            'paminnelse:sms:' || b.id || ':' || h || ':' || extract(epoch from b.start)::bigint,
            now(), b.start);
        end if;
      end loop;
    end loop;
  end loop;
  return nya;
end $$;

revoke execute on function public.notis_planera() from public, anon, authenticated;

-- ---------- arbetarens två funktioner ----------

create or replace function public.notis_utskick_ta(p_max int default 25)
returns table (id uuid, kanal text, typ text, antal int, data jsonb, roll text, fornamn text,
               epost text, telefon text, till_sandlada boolean, sms_lage text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  u        record;
  drift    public.notis_drift%rowtype;
  mejl_pa  boolean := public.flagga_pa('notiser_mejl');
  sms_pa   boolean := public.flagga_pa('notiser_sms');
  prov     boolean;
  skal     text;
  adress   text;
  nummer   text;
  sms_idag int;
begin
  select * into drift from public.notis_drift where id = 1;

  -- Lån som gått ut: arbetaren dog mitt i. Tillbaka i kön, utom där
  -- en nyare rad redan väntar på samma samlingsnyckel; då tar den
  -- över (och Resends idempotensnyckel skyddar om den förra hann gå).
  update public.notis_utskick q set status = 'hoppad', fel = 'ersatt av ett nyare utskick', lanad_till = null,
         uppdaterad = now()
   where q.status = 'skickar' and q.lanad_till < now() and q.samlingsnyckel is not null
     and exists (select 1 from public.notis_utskick v
                  where v.samlingsnyckel = q.samlingsnyckel and v.status = 'vantar');
  update public.notis_utskick q set status = 'vantar', lanad_till = null, uppdaterad = now()
   where q.status = 'skickar' and q.lanad_till < now();

  select count(*) into sms_idag from public.notis_utskick q
   where q.kanal = 'sms' and q.status = 'skickad' and q.uppdaterad > now() - interval '24 hours';

  for u in
    select q.* from public.notis_utskick q
     where q.status = 'vantar' and q.skicka_efter <= now()
     order by q.skicka_efter
     limit greatest(1, least(coalesce(p_max, 25), 100))
     for update skip locked
  loop
    prov := coalesce((u.data ->> 'prov')::boolean, false);
    skal := null;

    if u.skicka_senast is not null and u.skicka_senast < now() then
      skal := 'för sent';
    elsif not prov and not public.notis_vill(u.mottagare, u.typ, u.kanal) then
      skal := 'avstängt av mottagaren';
    elsif u.typ = 'paminnelse' and not prov and not exists (
            select 1 from public.bookings b
             where b.id = u.pass_id and b.status = 'confirmed'
               and (b.wanted_date + b.wanted_time::time) at time zone 'Europe/Stockholm'
                   = (u.data ->> 'start')::timestamptz) then
      skal := 'passet är inte längre bokat på den tiden';
    elsif u.typ = 'meddelande' and not prov and not exists (
            select 1 from public.notiser n
             where n.mottagare = u.mottagare and n.typ = 'meddelande' and n.last_at is null
               and n.trad_parent = u.trad_parent and n.trad_tutor = u.trad_tutor) then
      skal := 'redan läst i appen';
    elsif u.typ like 'pass\_%' and not prov and u.pass_id is null then
      skal := 'passet finns inte längre';
    end if;

    if skal is not null then
      update public.notis_utskick q set status = 'hoppad', fel = skal, uppdaterad = now() where q.id = u.id;
      continue;
    end if;

    adress := null;
    nummer := null;
    if u.kanal = 'mejl' then
      if prov or mejl_pa then
        select a.email into adress from auth.users a where a.id = u.mottagare;
      elsif drift.mejl_sandlada is not null then
        adress := drift.mejl_sandlada;
      else
        update public.notis_utskick q set status = 'loggad', uppdaterad = now() where q.id = u.id;
        continue;
      end if;
      if adress is null then
        update public.notis_utskick q set status = 'fel', fel = 'mottagaren saknar e-postadress', uppdaterad = now()
         where q.id = u.id;
        continue;
      end if;
    else
      if not sms_pa then
        update public.notis_utskick q set status = 'loggad', uppdaterad = now() where q.id = u.id;
        continue;
      end if;
      if sms_idag >= drift.sms_tak_per_dygn then
        update public.notis_utskick q set status = 'hoppad', fel = 'dygnstaket för SMS är nått', uppdaterad = now()
         where q.id = u.id;
        continue;
      end if;
      select intern.sms_nummer(p.phone) into nummer from public.profiles p where p.id = u.mottagare;
      if nummer is null then
        update public.notis_utskick q set status = 'hoppad', fel = 'inget giltigt mobilnummer', uppdaterad = now()
         where q.id = u.id;
        continue;
      end if;
      sms_idag := sms_idag + 1;
    end if;

    update public.notis_utskick q
       set status = 'skickar', lanad_till = now() + interval '5 minutes', forsok = q.forsok + 1,
           till_sandlada = (u.kanal = 'mejl' and not prov and not mejl_pa), uppdaterad = now()
     where q.id = u.id;

    return query
      select u.id, u.kanal, u.typ, u.antal, u.data,
             case when p.role = 'tutor' then 'tutor' else 'parent' end,
             intern.fornamn(p.full_name), adress, nummer,
             (u.kanal = 'mejl' and not prov and not mejl_pa), drift.sms_lage
        from public.profiles p where p.id = u.mottagare;
  end loop;
end $$;

create or replace function public.notis_utskick_klar(
  p_id uuid, p_ok boolean, p_fel text default null, p_leverantor_id text default null,
  p_permanent boolean default false, p_loggad boolean default false)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Ett misslyckat utskick som ska försökas igen viker för en nyare
  -- väntande rad med samma samlingsnyckel, annars krockar de.
  update public.notis_utskick q
     set status = case
                    when p_ok and p_loggad then 'loggad'
                    when p_ok then 'skickad'
                    when p_permanent or q.forsok >= 5 then 'fel'
                    when q.samlingsnyckel is not null and exists (
                           select 1 from public.notis_utskick v
                            where v.samlingsnyckel = q.samlingsnyckel and v.status = 'vantar' and v.id <> q.id)
                      then 'hoppad'
                    else 'vantar' end,
         skicka_efter = case when not p_ok then now() + make_interval(mins => q.forsok * q.forsok) else q.skicka_efter end,
         fel = case when p_ok then null else left(coalesce(p_fel, 'okänt fel'), 500) end,
         leverantor_id = coalesce(left(p_leverantor_id, 200), q.leverantor_id),
         lanad_till = null,
         uppdaterad = now()
   where q.id = p_id and q.status = 'skickar';
end $$;

create or replace function public.notis_arbetare_klar(
  p_behandlade int, p_skickade int, p_misslyckade int, p_meddelande text default null)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.notis_korningar (behandlade, skickade, misslyckade, meddelande)
  values (greatest(p_behandlade, 0), greatest(p_skickade, 0), greatest(p_misslyckade, 0), left(p_meddelande, 500))
$$;

-- ---------- avregistreringen ----------

create or replace function public.notis_avregistreringsnyckel()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select k.avregistreringsnyckel from public.notis_konfig k where k.id = 1
$$;

-- Tokenen bär bara uid, kanal och typ, och den kan bara stänga av. Den
-- rör aldrig profiles: en funktion som skrev i profiles med
-- service_role utifrån en länk hade gått förbi skydda_profilfalt.
create or replace function public.notis_avregistrera(p_profil uuid, p_typ text, p_kanal text)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  typer text[];
begin
  if p_kanal not in ('mejl', 'sms') then
    raise exception using errcode = '22023', message = 'Okänd kanal.';
  end if;
  if p_typ = 'alla' then
    typer := case when p_kanal = 'mejl' then public.notis_mejlbara() else array['paminnelse'] end;
  elsif p_typ = any (public.notis_typer()) then
    typer := array[p_typ];
  else
    raise exception using errcode = '22023', message = 'Okänd notistyp.';
  end if;
  if not exists (select 1 from public.profiles where id = p_profil) then
    raise exception using errcode = '22023', message = 'Kontot finns inte.';
  end if;

  insert into public.notis_val (profil_id, typ, kanal, pa)
  select p_profil, t, p_kanal, false from unnest(typer) t
  on conflict (profil_id, typ, kanal) do update set pa = false;
  return cardinality(typer);
end $$;

-- ---------- väckarklockan och knapparna ----------

-- Det cron anropar varje minut (2.4), och det "Kör nu" anropar.
-- Hemligheten läses ur notis_konfig när funktionen körs, så att den
-- aldrig står i cron.job eller i en triggers argument.
create or replace function public.notis_minut()
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  k     public.notis_konfig%rowtype;
  nya   int;
  begar bigint;
begin
  nya := public.notis_planera();
  if exists (select 1 from public.notis_utskick q
              where (q.status = 'vantar' and q.skicka_efter <= now())
                 or (q.status = 'skickar' and q.lanad_till < now())) then
    select * into k from public.notis_konfig where id = 1;
    if k.arbetare_url is not null then
      select net.http_post(
        url := k.arbetare_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-nextrum-notis', k.hemlighet),
        body := '{}'::jsonb,
        timeout_milliseconds := 20000) into begar;
    end if;
  end if;
  return nya;
end $$;

create or replace function public.notis_kor_nu()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  nya int;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum kan köra notiserna för hand.';
  end if;
  nya := public.notis_minut();
  return jsonb_build_object(
    'nya_paminnelser', nya,
    'vantar', (select count(*) from public.notis_utskick where status = 'vantar' and skicka_efter <= now()));
end $$;

-- Ett provmejl av varje sort till den som trycker, oavsett flaggan.
-- Det är så DKIM och utseendet provas innan någon familj får något.
create or replace function public.notis_provmejl()
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  t text;
  n int := 0;
  exempel jsonb := jsonb_build_object(
    'prov', true, 'datum', (now() at time zone 'Europe/Stockholm')::date + 1, 'tid', '16:00',
    'langd_min', 60, 'amne', 'Matematik', 'elev', 'Alva', 'studiehjalpare', 'Tove', 'fran', 'Tove',
    'fran_datum', (now() at time zone 'Europe/Stockholm')::date + 2, 'fran_tid', '15:00', 'timmar', 24);
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum kan skicka provmejl.';
  end if;
  foreach t in array public.notis_mejlbara() loop
    perform intern.notis_koa(auth.uid(), 'mejl', t, null, null, null, exempel, null,
      'prov:' || t || ':' || gen_random_uuid(), now(), now() + interval '1 hour');
    n := n + 1;
  end loop;
  return n;
end $$;

-- Gallring. Körs av cron en gång per dygn (2.4).
create or replace function public.notis_stada()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.notiser where skapad < now() - interval '180 days';
  delete from public.notis_utskick where skapad < now() - interval '90 days' and status not in ('vantar', 'skickar');
  delete from public.notis_korningar where tid < now() - interval '30 days';
  delete from public.notis_fel where skapad < now() - interval '90 days';
end $$;

-- ---------- rättigheterna ----------

revoke execute on function public.notis_utskick_ta(int) from public, anon, authenticated;
revoke execute on function public.notis_utskick_klar(uuid, boolean, text, text, boolean, boolean) from public, anon, authenticated;
revoke execute on function public.notis_arbetare_klar(int, int, int, text) from public, anon, authenticated;
revoke execute on function public.notis_avregistreringsnyckel() from public, anon, authenticated;
revoke execute on function public.notis_avregistrera(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.notis_minut() from public, anon, authenticated;
revoke execute on function public.notis_stada() from public, anon, authenticated;
grant execute on function public.notis_utskick_ta(int) to service_role;
grant execute on function public.notis_utskick_klar(uuid, boolean, text, text, boolean, boolean) to service_role;
grant execute on function public.notis_arbetare_klar(int, int, int, text) to service_role;
grant execute on function public.notis_avregistreringsnyckel() to service_role;
grant execute on function public.notis_avregistrera(uuid, text, text) to service_role;

revoke execute on function public.notis_kor_nu() from public, anon;
revoke execute on function public.notis_provmejl() from public, anon;
grant execute on function public.notis_kor_nu() to authenticated;
grant execute on function public.notis_provmejl() to authenticated;
