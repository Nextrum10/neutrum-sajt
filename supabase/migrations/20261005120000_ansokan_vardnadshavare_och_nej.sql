-- ============================================================
-- NEXTRUM — jobbansökan: vårdnadshavarens godkännande, och nejet som mejlas
-- (2026-10-05)
--
-- Leo: "jobbansökan, fråga om den sökande är under 18, är den det så ber du
-- den skriva in sina föräldrars mail och dokumenterar det, föräldrarna får
-- automatiskt ett mail om att deras barn har sökt en tjänst och att vi
-- behöver deras skriftliga bekräftelse skickad till vår mail med dennes
-- barns namn och efternamn som bekräftelse. efter det så kan vi dokumentera
-- det och lägga in kopia av mail till barnet." Och: "klickar vi i avböjd i
-- ansökningarna så skickas automatiskt ett mail till den sökande om att vi
-- har valt att gå vidare med en annan."
--
--
-- VÅRDNADSHAVAREN
--
-- Formuläret frågar redan efter åldern. Är den under 18 frågar det också
-- efter vårdnadshavarens e-post (vardnadshavare_epost), och databasen
-- mejlar vårdnadshavaren direkt (steget 'vardnadshavare' i ansokan_utskick):
-- barnet har sökt, och vi behöver ett skriftligt godkännande, som ett svar
-- på mejlet med barnets för- och efternamn. När svaret kommit lägger admin
-- in det i ansökan: när (vardnadshavare_godkand_at) och en kopia av mejlet
-- (vardnadshavare_svar).
--
-- Regel 1 för beskeden var att INSERT-grenen bara läser kvittot, eftersom
-- vem som helst kan skriva en rad i applications. Adressen till
-- vårdnadshavaren är ett undantag, och det är ett beslut: samma broms som
-- kvittot (fem på en minut, tjugo på en timme), och dessutom samma adress
-- högst en gång per dygn. Mejlet återger ingenting ur ansökan utom
-- förnamnet, och knappen går till vår egen sida. Adressen sparas bara för
-- den som är under 18 (skydda_ansokningsfalt). Godkännandet och kopian går
-- inte att skriva utifrån.
--
-- Rättar admin adressen (Redigera uppgifterna) mejlas den nya adressen, en
-- gång per adress. Finns godkännandet redan mejlas ingen.
--
--
-- NEJET
--
-- Regel 4 var att ett nej skrivs av en människa: den som söker är ofta
-- sexton, och ett felklick som genast mejlar ett nej går inte att ta
-- tillbaka. Leo vill att det mejlas. Skälet till regeln står kvar, så nejet
-- går inte genast: det köas med skicka_efter, tidigast 30 minuter efter
-- klicket, och aldrig mellan 20 och 9 svensk tid (då kl. 9). Byts läget
-- tillbaka före dess går det inget mejl (ansokan_besked_ta hoppar över
-- raden), och avböjs hen igen köas samma rad om, med ny tid. Ett nej som
-- redan gått mejlas aldrig igen.
--
-- Adminvyn frågar innan läget sätts och visar mejlet. Texten står också i
-- nextrum-admin-rekrytering.js (NEJ_MEJLET), och verktyg/kolla-mejltexter.py
-- håller dem lika.
--
--
-- KÖR SÅ HÄR
--
-- Efter merge, före edge-funktionen ansokan-notis (som har mallarna för de
-- två nya stegen). Vyerna och formuläret tål att migrationen saknas.
-- Avsnitt 2 har ett `drop constraint`: check-villkoret på steg går inte att
-- vidga på annat sätt. Verktygen ber om en bekräftelse för det.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Vakten: funktionerna som skrivs om nedan ska vara de som lästes ur
--    driften 2026-10-05. Har någon annan session ändrat en av dem sedan
--    stannar migrationen här, i stället för att skriva över ändringen.
--    En funktion som redan bär den här migrationens märke släpps förbi,
--    så att filen går att köra två gånger.
-- ------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select * from (values
      ('public.skydda_ansokningsfalt()', 'd87a3bb5bdaca0ac7436956485c5e686'),
      ('intern.ansokan_besked()', '4448f85bc2b3b53aedf5cab0723fb891'),
      ('public.ansokan_besked_ta(uuid)', 'e058c994a4d850f0add60d5edd583b23'),
      ('intern.ansokan_besked_igen()', 'a6d0514832181642dc2ac8c89d22e78d'),
      ('intern.ansokan_gallras_fran(public.applications)', 'afa7161ca76e76aff3e7cef38584cc31')
    ) as v(sig, summa)
  loop
    if not exists (
      select 1 from pg_proc p
       where p.oid = f.sig::regprocedure
         and (md5(p.prosrc) = f.summa or p.prosrc like '%ansokan_vardnadshavare_och_nej%')
    ) then
      raise exception 'ansokan_vardnadshavare_och_nej: % har ändrats i driften sedan 2026-10-05. Läs driften och skriv om migrationen.', f.sig;
    end if;
  end loop;
end $$;


-- ------------------------------------------------------------
-- 2. Kolumnerna
-- ------------------------------------------------------------
alter table public.applications
  add column if not exists vardnadshavare_epost text,
  add column if not exists vardnadshavare_godkand_at timestamptz,
  add column if not exists vardnadshavare_svar text;

comment on column public.applications.vardnadshavare_epost is
  'Vårdnadshavarens e-post, bara för den som är under 18 (skydda_ansokningsfalt). Mejlas av steget vardnadshavare.';
comment on column public.applications.vardnadshavare_godkand_at is
  'När admin lade in vårdnadshavarens skriftliga godkännande. Sätts aldrig utifrån.';
comment on column public.applications.vardnadshavare_svar is
  'Kopia av vårdnadshavarens svar, inklistrad av admin. Fritext: aldrig i auditloggen.';

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.applications'::regclass
                    and conname = 'applications_vardnadshavare_svar_langd') then
    alter table public.applications add constraint applications_vardnadshavare_svar_langd
      check (vardnadshavare_svar is null or char_length(vardnadshavare_svar) <= 20000);
  end if;
end $$;

alter table public.ansokan_utskick
  add column if not exists skicka_efter timestamptz;

comment on column public.ansokan_utskick.skicka_efter is
  'Tidigast då. Bara nejet har en (intern.ansokan_nej_tid): ett felklick ska gå att ångra innan mejlet går.';

alter table public.ansokan_utskick drop constraint if exists ansokan_utskick_steg_check;
alter table public.ansokan_utskick add constraint ansokan_utskick_steg_check
  check (steg = any (array['mottagen', 'mote', 'utbildning', 'prov', 'prov_paminnelse', 'prov_sista_dagen',
                           'sista_steget', 'valkommen', 'vardnadshavare', 'avbojd']));


-- ------------------------------------------------------------
-- 3. Skyddet: adressen bara under 18, godkännandet aldrig utifrån
-- ------------------------------------------------------------
create or replace function public.skydda_ansokningsfalt()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
-- ansokan_vardnadshavare_och_nej (2026-10-05): vårdnadshavarens adress och godkännande.
declare
  klanger text := current_setting('request.jwt.claims', true);
  jwtroll text := case when klanger ~ '^\s*\{' then (klanger::json ->> 'role') else null end;
  giltiga text[];
begin
  if public.is_admin()
     or jwtroll = 'service_role'
     or (jwtroll is null and session_user in ('postgres', 'supabase_admin'))
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Läget och tidsstämplarna sätts av Nextrum, aldrig av den som söker.
    new.status       := 'new';
    new.kontaktad_at := null;
    new.intervju_at  := null;
    new.utbildad_at  := null;
    new.notering     := null;
    -- Fas 16.1: mötet också. Ett mötesmejl byggs på de här två fälten,
    -- och en länk som den som söker själv skrivit in är en nätfiskelänk
    -- i ett mejl från vår domän.
    new.mote_tid     := null;
    new.mote_lank    := null;
    -- Fas 16.1c: och när ansökan kom in. Kvittobromsen räknar på den,
    -- och en tid den som postar själv väljer är ingen broms.
    new.created_at   := now();
    -- Fas 22.1: och provet. Påminnelsejobbet mejlar alla med en satt
    -- sista dag, och en egen nyckel hade varit ett prov man själv
    -- bestämt facit till.
    new.utbildningsmote_at := null;
    new.prov_sista_dag     := null;
    new.prov_nyckel        := null;
    new.prov_godkant_at    := null;
    -- 2026-10-05: och vårdnadshavarens godkännande. Det läggs in av admin
    -- när svaret kommit, aldrig av den som söker.
    new.vardnadshavare_godkand_at := null;
    new.vardnadshavare_svar       := null;

    -- Bara tjänster som faktiskt går att söka till. En kod som inte
    -- gör det skrivs om i stället för att neka ansökan — vi ska inte
    -- straffa någon för att vår katalog ändrats under tiden.
    select array_agg(k) into giltiga
      from unnest(coalesce(new.tjanster, '{}'::text[])) as k
     where exists (select 1 from public.tjanster t
                    where t.kod = k and t.aktiv and t.for_jobb);

    if giltiga is null or cardinality(giltiga) = 0 then
      select array[t.kod] into giltiga
        from public.tjanster t
       where t.aktiv and t.for_jobb
       order by t.ordning, t.kod
       limit 1;
    end if;
    new.tjanster := coalesce(giltiga, array['laxhjalp']);

    -- Längdtaken. Samma skäl som för leads: utan dem kan vem som
    -- helst posta en rad på flera megabyte mot det öppna API:et, och
    -- den raden läses sedan av adminvyn och av notismejlet.
    new.name         := left(new.name, 120);
    new.email        := left(new.email, 200);
    new.school       := left(new.school, 120);
    new.subjects     := left(new.subjects, 200);
    new.availability := left(new.availability, 200);
    new.why          := left(new.why, 4000);
    -- 2026-10-05: vårdnadshavarens adress sparas bara för den som är under
    -- 18. Den mejlas av ansokan_besked, och för den som är vuxen finns inget
    -- skäl att ha den, eller att mejla den.
    new.vardnadshavare_epost := case
      when new.age between 1 and 17 then nullif(left(btrim(new.vardnadshavare_epost), 200), '')
      else null
    end;
  else
    new.status       := old.status;
    new.kontaktad_at := old.kontaktad_at;
    new.intervju_at  := old.intervju_at;
    new.utbildad_at  := old.utbildad_at;
    new.notering     := old.notering;
    new.tjanster     := old.tjanster;
    new.mote_tid     := old.mote_tid;
    new.mote_lank    := old.mote_lank;
    new.created_at   := old.created_at;
    new.utbildningsmote_at := old.utbildningsmote_at;
    new.prov_sista_dag     := old.prov_sista_dag;
    new.prov_nyckel        := old.prov_nyckel;
    new.prov_godkant_at    := old.prov_godkant_at;
    new.vardnadshavare_epost      := old.vardnadshavare_epost;
    new.vardnadshavare_godkand_at := old.vardnadshavare_godkand_at;
    new.vardnadshavare_svar       := old.vardnadshavare_svar;
  end if;
  return new;
end $function$;


-- ------------------------------------------------------------
-- 4. Nejets tid: tidigast 30 minuter efter klicket, aldrig på kvällen
-- ------------------------------------------------------------
-- Ett felklick ska gå att ångra innan mejlet går, och ett nej ska inte
-- komma till en sextonåring klockan elva på kvällen. Mellan 20 och 9 svensk
-- tid väntar det till kl. 9. Tiden är ett argument för att proven ska kunna
-- pröva sommartid, vintertid och kvällen.
create or replace function intern.ansokan_nej_tid(p_nu timestamptz)
 returns timestamptz
 language sql
 stable
 set search_path to 'pg_catalog'
as $function$
  select case
    when (t at time zone 'Europe/Stockholm')::time < time '09:00'
      then ((t at time zone 'Europe/Stockholm')::date + time '09:00') at time zone 'Europe/Stockholm'
    when (t at time zone 'Europe/Stockholm')::time >= time '20:00'
      then ((t at time zone 'Europe/Stockholm')::date + 1 + time '09:00') at time zone 'Europe/Stockholm'
    else t
  end
  from (select p_nu + interval '30 minutes' as t) x
$function$;

revoke execute on function intern.ansokan_nej_tid(timestamptz) from public;

-- Köar nejet, eller köar om det: ett nej som ångrats ('hoppad') eller
-- ännu inte gått ('vantar') får en ny tid när hen avböjs igen. Ett som
-- redan skickats, eller som håller på, rörs inte: ett steg mejlas en gång.
-- Ingen pg_net här: omförsöksjobbet tar raden när tiden kommit.
create or replace function intern.ansokan_nej_koa(p_ansokan uuid)
 returns void
 language sql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  insert into public.ansokan_utskick as u (ansokan_id, steg, nyckel, status, skicka_efter)
  values (p_ansokan, 'avbojd', 'avbojd', 'vantar', intern.ansokan_nej_tid(now()))
  on conflict (ansokan_id, nyckel) do update
     set status = 'vantar', skicka_efter = excluded.skicka_efter, forsok = 0,
         fel = null, lanad_till = null, uppdaterad = now()
   where u.status in ('vantar', 'hoppad');
$function$;

revoke execute on function intern.ansokan_nej_koa(uuid) from public;


-- ------------------------------------------------------------
-- 5. Triggern: vårdnadshavaren vid INSERT, nejet vid Avböjd
-- ------------------------------------------------------------
create or replace function intern.ansokan_besked()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
-- ansokan_vardnadshavare_och_nej (2026-10-05): vårdnadshavarens mejl och nejet.
declare
  minut integer;
  timme integer;
  samma integer;
  samma_vh integer;
  broms text := null;
  vh_broms text;
begin
  -- Ett fel här får aldrig stoppa ansökan eller adminens klick. Ett
  -- uteblivet mejl är ett mindre fel än en ansökan som inte sparas.
  begin
    if tg_op = 'INSERT' then
      -- Kvittot, och vårdnadshavarens mejl (2026-10-05). Ingenting annat i
      -- raden läses, eftersom raden kan vara skriven av vem som helst.
      -- created_at är satt av skydda_ansokningsfalt (Fas 16.1c), inte av
      -- den som postade, och adressen till vårdnadshavaren finns bara för
      -- den som är under 18.
      select count(*) filter (where a.created_at > now() - interval '1 minute'),
             count(*)
        into minut, timme
        from public.applications a
       where a.created_at > now() - interval '1 hour';
      select count(*) into samma from public.applications a
       where intern.epost_nyckel(a.email) = intern.epost_nyckel(new.email)
         and a.id <> new.id
         and a.created_at > now() - interval '24 hours';
      if minut > 5 then
        broms := 'Fler än fem ansökningar den senaste minuten.';
      elsif timme > 20 then
        broms := 'Fler än tjugo ansökningar den senaste timmen.';
      elsif samma > 0 then
        broms := 'Adressen har redan sökt det senaste dygnet.';
      end if;
      perform intern.ansokan_besked_koa(new.id, 'mottagen', 'mottagen', broms);

      -- Vårdnadshavaren: samma broms som kvittot, och samma adress högst en
      -- gång per dygn. Annars hade formuläret varit ett sätt att få oss att
      -- mejla en främling om och om igen.
      if new.vardnadshavare_epost is not null then
        select count(*) into samma_vh from public.applications a
         where intern.epost_nyckel(a.vardnadshavare_epost) = intern.epost_nyckel(new.vardnadshavare_epost)
           and a.id <> new.id
           and a.created_at > now() - interval '24 hours';
        vh_broms := coalesce(broms, case when samma_vh > 0
          then 'Vårdnadshavarens adress har redan fått ett mejl om en ansökan det senaste dygnet.' end);
        perform intern.ansokan_besked_koa(new.id, 'vardnadshavare',
          'vardnadshavare:' || md5(intern.epost_nyckel(new.vardnadshavare_epost)), vh_broms);
      end if;
      return new;
    end if;

    -- Avböjd (2026-10-05): nejet köas, men går tidigast efter en halvtimme
    -- (intern.ansokan_nej_koa). Inga andra steg för den som är avböjd.
    if new.status = 'rejected' then
      if old.status is distinct from 'rejected' then
        perform intern.ansokan_nej_koa(new.id);
      end if;
      return new;
    end if;

    -- Vårdnadshavarens adress satt eller rättad av admin: den nya adressen
    -- mejlas, en gång per adress. Finns godkännandet redan behövs inget.
    if new.vardnadshavare_epost is not null
       and intern.epost_nyckel(new.vardnadshavare_epost)
           is distinct from intern.epost_nyckel(old.vardnadshavare_epost)
       and new.vardnadshavare_godkand_at is null
       and new.status is distinct from 'approved' then
      perform intern.ansokan_besked_koa(new.id, 'vardnadshavare',
        'vardnadshavare:' || md5(intern.epost_nyckel(new.vardnadshavare_epost)));
    end if;

    -- Mötet: en ny tid eller en ny länk ger ett nytt mejl. Ett möte som
    -- redan varit (admin som för in det i efterhand) mejlas inte.
    if new.mote_tid is not null and new.mote_tid > now()
       and new.status is distinct from 'approved' and new.intervju_at is null
       and (old.mote_tid is distinct from new.mote_tid
            or old.mote_lank is distinct from new.mote_lank) then
      perform intern.ansokan_besked_koa(new.id, 'mote',
        'mote:' || extract(epoch from new.mote_tid)::bigint || ':' || md5(coalesce(new.mote_lank, '')));
    end if;

    if old.intervju_at is null and new.intervju_at is not null
       and new.utbildad_at is null and new.status is distinct from 'approved' then
      perform intern.ansokan_besked_koa(new.id, 'utbildning', 'utbildning');
    end if;

    -- Fas 22.1: provet öppnas, eller öppnas igen med nya dagar. Nyckeln
    -- bär sista dagen, så varje fönster mejlas en gång.
    if new.prov_sista_dag is not null
       and new.prov_sista_dag is distinct from old.prov_sista_dag
       and new.prov_sista_dag >= (now() at time zone 'Europe/Stockholm')::date
       and new.prov_godkant_at is null and new.utbildad_at is null
       and new.status is distinct from 'approved' then
      perform intern.ansokan_besked_koa(new.id, 'prov', 'prov:' || new.prov_sista_dag);
    end if;

    if old.utbildad_at is null and new.utbildad_at is not null
       and new.status is distinct from 'approved' then
      perform intern.ansokan_besked_koa(new.id, 'sista_steget', 'sista_steget');
    end if;

    if new.status = 'approved' and old.status is distinct from 'approved' then
      perform intern.ansokan_besked_koa(new.id, 'valkommen', 'valkommen');
    end if;
  exception when others then
    raise warning 'ansokan_besked: % (%)', sqlerrm, sqlstate;
  end;
  return new;
end $function$;

-- En UPDATE OF-trigger går bara på kolumnerna i själva UPDATE:n. Adressen
-- till vårdnadshavaren står därför i listan, som utbildningsmote_at gör av
-- samma skäl (minne/notiser.md, utbildningsprovet).
create or replace trigger ansokan_besked
  after insert or update of status, mote_tid, mote_lank, intervju_at, utbildad_at, utbildningsmote_at,
                            prov_sista_dag, vardnadshavare_epost
  on public.applications
  for each row execute function intern.ansokan_besked();


-- ------------------------------------------------------------
-- 6. Att låna en rad: tiden, nejet och vårdnadshavaren
-- ------------------------------------------------------------
create or replace function public.ansokan_besked_ta(p_id uuid)
 returns table(id uuid, steg text, namn text, epost text, mote_tid timestamp with time zone, mote_lank text, ombokat boolean, forsok integer, prov_nyckel uuid, prov_sista_dag date)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
-- ansokan_vardnadshavare_och_nej (2026-10-05): skicka_efter, nejet och vårdnadshavaren.
declare
  r public.ansokan_utskick%rowtype;
  a public.applications%rowtype;
begin
  -- En rad med skicka_efter lånas inte före den tiden (nejet).
  update public.ansokan_utskick u
     set status = 'skickar', forsok = u.forsok + 1,
         lanad_till = now() + interval '2 minutes', uppdaterad = now()
   where u.id = p_id
     and u.forsok < 3
     and (u.skicka_efter is null or u.skicka_efter <= now())
     and (u.status in ('vantar', 'fel') or (u.status = 'skickar' and u.lanad_till < now()))
  returning u.* into r;
  if not found then
    return;
  end if;

  select * into a from public.applications x where x.id = r.ansokan_id;

  if a.id is null then
    update public.ansokan_utskick set status = 'hoppad', fel = 'ansökan är borta',
           lanad_till = null, uppdaterad = now() where ansokan_utskick.id = r.id;
    return;
  end if;

  -- Läget kan ha ändrats sedan raden köades. Nejet går bara medan ansökan
  -- fortfarande är avböjd: ett felklick som ångrats ska inte bli ett mejl.
  -- Allt annat går bara så länge den INTE är avböjd.
  if r.steg = 'avbojd' then
    if a.status is distinct from 'rejected' then
      update public.ansokan_utskick set status = 'hoppad', fel = 'läget ändrades innan mejlet gick',
             lanad_till = null, uppdaterad = now() where ansokan_utskick.id = r.id;
      return;
    end if;
  elsif a.status = 'rejected' then
    update public.ansokan_utskick set status = 'hoppad', fel = 'ansökan är avböjd',
           lanad_till = null, uppdaterad = now() where ansokan_utskick.id = r.id;
    return;
  end if;

  -- Vårdnadshavaren: inte om godkännandet redan finns, och inte till en
  -- adress som admin hunnit rätta. Nyckeln bär adressen.
  if r.steg = 'vardnadshavare'
     and (a.vardnadshavare_godkand_at is not null or a.vardnadshavare_epost is null
          or r.nyckel is distinct from 'vardnadshavare:' || md5(intern.epost_nyckel(a.vardnadshavare_epost))) then
    update public.ansokan_utskick set status = 'hoppad', fel = 'godkännandet finns redan, eller adressen är ändrad',
           lanad_till = null, uppdaterad = now() where ansokan_utskick.id = r.id;
    return;
  end if;

  if r.steg = 'mote' and (a.mote_tid is null or r.nyckel is distinct from
       'mote:' || extract(epoch from a.mote_tid)::bigint || ':' || md5(coalesce(a.mote_lank, ''))) then
    update public.ansokan_utskick set status = 'hoppad', fel = 'mötet har fått en nyare tid',
           lanad_till = null, uppdaterad = now() where ansokan_utskick.id = r.id;
    return;
  end if;

  -- Fas 22.1: ett provmejl om ett prov som redan är klart, stängt
  -- eller har fått nya dagar är fel besked. Nyckeln bär sista dagen.
  if r.steg in ('prov', 'prov_paminnelse', 'prov_sista_dagen') then
    if a.prov_godkant_at is not null or a.utbildad_at is not null or a.status = 'approved' then
      update public.ansokan_utskick set status = 'hoppad', fel = 'provet är redan klart',
             lanad_till = null, uppdaterad = now() where ansokan_utskick.id = r.id;
      return;
    end if;
    if a.prov_sista_dag is null or a.prov_nyckel is null
       or split_part(r.nyckel, ':', 2) is distinct from a.prov_sista_dag::text
       or a.prov_sista_dag < (now() at time zone 'Europe/Stockholm')::date then
      update public.ansokan_utskick set status = 'hoppad', fel = 'provet är stängt eller har fått nya dagar',
             lanad_till = null, uppdaterad = now() where ansokan_utskick.id = r.id;
      return;
    end if;
  end if;

  -- Mejlet till vårdnadshavaren går till vårdnadshavaren, med den sökandes
  -- namn (mallen tar bara förnamnet). Allt annat går till den som sökt.
  return query select r.id, r.steg, a.name,
    case when r.steg = 'vardnadshavare' then a.vardnadshavare_epost else a.email end,
    a.mote_tid, a.mote_lank,
    exists (select 1 from public.ansokan_utskick x
             where x.ansokan_id = r.ansokan_id and x.steg = 'mote' and x.id <> r.id
               and x.status = 'skickad'),
    r.forsok,
    case when r.steg like 'prov%' then a.prov_nyckel end,
    case when r.steg like 'prov%' then a.prov_sista_dag end;
end $function$;


-- ------------------------------------------------------------
-- 7. Omförsöken tar nejet när tiden kommit
-- ------------------------------------------------------------
-- Raden för ett nej köas utan anrop till edge-funktionen; det här jobbet
-- (ansokan-besked, var femte minut) väcker den när skicka_efter passerat.
-- Dygnet räknas från den tiden, inte från när raden skapades.
create or replace function intern.ansokan_besked_igen()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
-- ansokan_vardnadshavare_och_nej (2026-10-05): skicka_efter.
declare
  r record;
  n integer := 0;
begin
  for r in
    select u.id from public.ansokan_utskick u
     where coalesce(u.skicka_efter, u.skapad) > now() - interval '24 hours'
       and u.forsok < 3
       and ((u.status = 'vantar' and case when u.skicka_efter is null
                                          then u.skapad < now() - interval '2 minutes'
                                          else u.skicka_efter <= now() end)
         or (u.status = 'fel' and u.uppdaterad < now() - make_interval(mins => 5 * greatest(u.forsok, 1)))
         or (u.status = 'skickar' and u.lanad_till < now()))
     order by coalesce(u.skicka_efter, u.skapad)
     limit 20
  loop
    perform intern.ansokan_besked_skicka(r.id);
    n := n + 1;
  end loop;
  return n;
end $function$;


-- ------------------------------------------------------------
-- 8. Gallringen räknar godkännandet som ett steg
-- ------------------------------------------------------------
-- Ett nytt rekryteringssteg med tidsstämpel ska in här (CLAUDE.md, avsnitt 5).
create or replace function intern.ansokan_gallras_fran(a applications)
 returns timestamp with time zone
 language sql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
  -- ansokan_vardnadshavare_och_nej (2026-10-05): vardnadshavare_godkand_at är ett steg.
  with steg as (
    select greatest(a.kontaktad_at, a.mote_tid, a.intervju_at, a.utbildningsmote_at,
                    (a.prov_sista_dag + 1)::timestamp at time zone 'Europe/Stockholm',
                    a.prov_godkant_at, a.utbildad_at, a.vardnadshavare_godkand_at) as senast
  ),
  hjalpare as (
    -- Senaste gången studiehjälparen med samma adress var aktiv: kontot,
    -- inloggningen, ett pass som inte avbokats eller en rapport. Bara en
    -- godkänd studiehjälpare räknas, som i skyddsnätet förut.
    select max(greatest(
             t.created_at, p.created_at, p.last_seen_at, u.last_sign_in_at,
             (select max(b.wanted_date)::timestamp at time zone 'Europe/Stockholm'
                from public.bookings b
               where b.tutor_id = t.id and b.status <> 'cancelled'),
             (select max(r.created_at) from public.lesson_reports r where r.tutor_id = t.id)
           )) as senast
      from public.profiles p
      join public.tutor_profiles t on t.id = p.id
      left join auth.users u on u.id = p.id
     where a.status <> 'rejected'
       and t.status = 'approved'
       and intern.epost_nyckel(a.email) <> ''
       and intern.epost_nyckel(p.email) = intern.epost_nyckel(a.email)
  )
  select case
    when h.senast is not null then h.senast + interval '2 years'
    when a.status = 'approved' then greatest(a.created_at, s.senast) + interval '2 years'
    else greatest(a.created_at + interval '1 year', s.senast + interval '30 days')
  end
  from steg s, hjalpare h
$function$;


-- ------------------------------------------------------------
-- 9. Auditloggen: när godkännandet lades in, och av vem
-- ------------------------------------------------------------
-- Tidpunkten, aldrig adressen eller kopian: auditloggen tar inga namn och
-- ingen fritext.
create or replace trigger applications_audit
  after update of status, kontaktad_at, intervju_at, utbildad_at, utbildningsmote_at, prov_sista_dag,
                  prov_godkant_at, vardnadshavare_godkand_at
  on public.applications
  for each row execute function logga_andring('ansokan', 'id', 'status', 'kontaktad_at', 'intervju_at',
    'utbildad_at', 'utbildningsmote_at', 'prov_sista_dag', 'prov_godkant_at', 'vardnadshavare_godkand_at');
