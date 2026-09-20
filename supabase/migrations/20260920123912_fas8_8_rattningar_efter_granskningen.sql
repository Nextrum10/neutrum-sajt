-- ============================================================
-- NEXTRUM — Fas 8.8: rättningar efter granskningen
--
-- Den blockerande: ai_nya_leads lämnade ut leads.grade och
-- leads.subject RÅTT. Migrationen 8.4 påstod att message var "det
-- enda fält där en utomstående skriver fritt", och det var fel.
-- Ämnesrutan i anmälningsformuläret har ett "annat"-fält utan
-- längdgräns, och den som vill kan dessutom posta rakt mot API:et
-- med den publika nyckeln.
--
-- Två följder, båda bevisade i en rullad transaktion:
--   · "spanska, ring Anna 070-1234567" i ämnesrutan gick ordagrant
--     till modellen, medan samma nummer i meddelandet maskerades
--   · en anmälan med 50 000 tecken i årskursfältet gick in utan
--     invändning, och hela raden skulle skickas till modellen
--
-- Rättningen görs på BÅDA ställena, för de skyddar mot olika saker:
--   1. skydda_leadfalt kapar fälten redan vid skrivningen, så att
--      ingen rad i tabellen kan bli obegränsat lång. Det skyddar
--      också allt annat som någonsin läser leads.
--   2. ai_nya_leads maskar och kapar det den lämnar ut, så att
--      skyddet inte hänger på att steg 1 aldrig ändras.
--
-- Maskningen får en egen funktion, eftersom den gamla raden missade
-- e-post och nummer med punkter och samtidigt åt upp ISO-datum som
-- agenten behöver.
-- ============================================================

-- ------------------------------------------------------------
-- Maskningen. Datumen skyddas först, e-post och sifferföljder
-- maskas sedan, och datumen läggs tillbaka. Tecknet chr(1) används
-- som tillfällig markör: det kan inte komma från ett formulär.
-- ------------------------------------------------------------
create or replace function public.maska_kontakt(p text)
returns text
language plpgsql
immutable
set search_path to 'public'
as $$
declare
  t text := coalesce(p, '');
begin
  -- ISO-datum undantas: "2026-09-20" är inte ett telefonnummer, och
  -- drift-agenten arbetar med datum.
  t := regexp_replace(t, '(\d{4})-(\d{2})-(\d{2})', '\1' || chr(1) || '\2' || chr(1) || '\3', 'g');

  t := regexp_replace(t, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[e-post]', 'g');

  -- En sifferföljd som börjar och slutar med en siffra och är minst
  -- sex tecken lång. Fyrsiffriga årtal går alltså igenom, medan
  -- 070-123 45 67, 0701234567 och +46 70 123 45 67 maskas.
  t := regexp_replace(t, '[0-9][0-9 .+()/-]{4,}[0-9]', '[nummer]', 'g');

  return replace(t, chr(1), '-');
end $$;

revoke execute on function public.maska_kontakt(text) from public, anon, authenticated;
grant execute on function public.maska_kontakt(text) to nextrum_ai;

-- ------------------------------------------------------------
-- 1. Fälten kapas redan när anmälan skrivs.
--
-- Längderna är satta efter vad fälten ÄR: en årskurs är "Åk 8", ett
-- ämne är en handfull ord, ett meddelande är några stycken. Admin
-- och service_role går förbi som förut — de skriver inte formulär.
-- ------------------------------------------------------------
create or replace function public.skydda_leadfalt()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  klanger text := current_setting('request.jwt.claims', true);
  jwtroll text := case when klanger ~ '^\s*\{' then (klanger::json ->> 'role') else null end;
begin
  if public.is_admin()
     or jwtroll = 'service_role'
     or (jwtroll is null and session_user in ('postgres', 'supabase_admin'))
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.kund_id      := null;
    new.uppdrag_id   := null;
    new.status       := 'new';
    new.kontaktad_at := null;
    new.notering     := null;
    if new.tjanst is null
       or not exists (select 1 from public.tjanster t
                       where t.kod = new.tjanst and t.aktiv and t.for_kund) then
      new.tjanst := public.standard_tjanst();
    end if;

    -- Längdtaken. Utan dem kan vem som helst posta en rad på flera
    -- megabyte mot det öppna API:et, och den raden läses sedan av
    -- adminvyn, av notismejlet och av AI:ns läsverktyg.
    new.parent_name := left(new.parent_name, 120);
    new.email       := left(new.email, 200);
    new.child_name  := left(new.child_name, 120);
    new.grade       := left(new.grade, 60);
    new.subject     := left(new.subject, 200);
    new.message     := left(new.message, 4000);
  else
    new.kund_id      := old.kund_id;
    new.uppdrag_id   := old.uppdrag_id;
    new.status       := old.status;
    new.kontaktad_at := old.kontaktad_at;
    new.notering     := old.notering;
  end if;
  return new;
end $$;

revoke execute on function public.skydda_leadfalt() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 2. Och läsverktyget maskar och kapar det det lämnar ut.
--
-- har_uppgift i saknade_rapporter ser nu ALLA öppna uppgifter om
-- passet, inte bara den dagliga kontrollens nyckel. Förut flaggade
-- agenten om samma pass varje körning, eftersom den aldrig såg sina
-- egna uppgifter — och varje sådant anrop åt ett steg ur taket.
-- ------------------------------------------------------------
create or replace function public.ai_nya_leads(p_dagar integer default 21)
returns table (
  id        uuid,
  skapad    date,
  status    text,
  tjanst    text,
  arskurs   text,
  amne      text,
  meddelande text,
  dagar_gammal integer
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select l.id,
         (l.created_at at time zone 'Europe/Stockholm')::date,
         l.status,
         l.tjanst,
         left(public.maska_kontakt(l.grade), 60),
         left(public.maska_kontakt(l.subject), 200),
         left(public.maska_kontakt(l.message), 500),
         (current_date - (l.created_at at time zone 'Europe/Stockholm')::date)::integer
    from public.leads l
   where l.created_at > now() - make_interval(days => greatest(p_dagar, 1))
   order by l.created_at desc
   limit 100;
$$;

create or replace function public.ai_saknade_rapporter(p_dagar integer default 45)
returns table (
  id       uuid,
  datum    date,
  amne     text,
  status   text,
  elev_id  uuid,
  studiehjalpare_id uuid,
  har_uppgift boolean
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select b.id, b.wanted_date, left(public.maska_kontakt(b.subject), 120), b.status,
         b.student_id, b.tutor_id,
         exists (select 1 from public.uppgifter u
                  where u.kopplad_tabell = 'bookings' and u.kopplad_id = b.id::text
                    and u.status in ('oppen', 'pagar'))
    from public.bookings b
   where b.status in ('confirmed', 'completed')
     and b.fakturerbar
     and b.wanted_date > (now() at time zone 'Europe/Stockholm')::date
                         - make_interval(days => greatest(p_dagar, 1))
     and b.wanted_date < (now() at time zone 'Europe/Stockholm')::date
     and not exists (select 1 from public.lesson_reports lr where lr.booking_id = b.id)
   order by b.wanted_date
   limit 200;
$$;

revoke execute on function public.ai_nya_leads(integer) from public, anon, authenticated;
revoke execute on function public.ai_saknade_rapporter(integer) from public, anon, authenticated;
grant execute on function public.ai_nya_leads(integer) to nextrum_ai;
grant execute on function public.ai_saknade_rapporter(integer) to nextrum_ai;

-- ------------------------------------------------------------
-- 3. Ett förslag får inte gå emot systemets egen rankning.
--
-- Regeln "en hjälpare med hårt nej ska inte föreslås" stod bara i
-- systemprompten. En prompt är en önskan — och modellen läser text
-- som vem som helst har skrivit. Nu prövas paret mot samma
-- rankning som adminvyn visar, innan förslaget ens skapas.
-- ------------------------------------------------------------
create or replace function public.ai_verktyg(p_verktyg text, p_arg jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  arg      jsonb := coalesce(p_arg, '{}'::jsonb);
  ut       jsonb;
  elev     uuid;
  hjalpare uuid;
  tabell   text;
  objekt   uuid;
  nyid     uuid;
  rank     record;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum kör AI-verktygen.';
  end if;

  case p_verktyg

    when 'nya_leads' then
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into ut
        from public.ai_nya_leads(coalesce((arg ->> 'dagar')::int, 21)) t;

    when 'omatchade_elever' then
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into ut
        from public.ai_omatchade_elever() t;

    when 'kommande_pass' then
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into ut
        from public.ai_kommande_pass(coalesce((arg ->> 'dagar')::int, 7)) t;

    when 'saknade_rapporter' then
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into ut
        from public.ai_saknade_rapporter(coalesce((arg ->> 'dagar')::int, 45)) t;

    when 'matchningsforslag' then
      elev := nullif(arg ->> 'elev_id', '')::uuid;
      if elev is null then
        return jsonb_build_object('fel', 'matchningsforslag kräver elev_id.');
      end if;
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into ut
        from (select * from public.matchningsforslag_rader(elev) limit 10) t;

    when 'foresla_matchning' then
      elev := nullif(arg ->> 'elev_id', '')::uuid;
      hjalpare := nullif(arg ->> 'studiehjalpare_id', '')::uuid;
      if elev is null or hjalpare is null then
        return jsonb_build_object('fel', 'foresla_matchning kräver elev_id och studiehjalpare_id.');
      end if;
      if not public.ai_finns('students', elev) then
        return jsonb_build_object('fel', 'Eleven finns inte.');
      end if;
      if not public.ai_finns('studiehjalpare', hjalpare) then
        return jsonb_build_object('fel', 'Studiehjälparen finns inte eller är inte godkänd.');
      end if;

      select * into rank from public.matchningsforslag_rader(elev) r where r.tutor_id = hjalpare;
      if found and rank.hart_nej then
        return jsonb_build_object('fel',
          'Den studiehjälparen har ett hårt nej för eleven (ämne: ' || rank.amne_utfall
          || ', årskurs: ' || rank.arskurs_utfall || '). Förslaget skapades inte. '
          || 'Fel ämne eller fel årskurs är fel person, oavsett vad texten säger.');
      end if;

      nyid := public.ai_skapa_forslag(
        'matchning',
        'match:elev:' || elev::text || ':hjalpare:' || hjalpare::text,
        jsonb_build_object('elev_id', elev, 'studiehjalpare_id', hjalpare),
        left(coalesce(arg ->> 'motivering', ''), 2000),
        nullif(arg ->> 'korning_id', '')::uuid,
        'students', elev::text);
      ut := jsonb_build_object('skapat', nyid is not null, 'forslag_id', nyid);

    when 'flagga_problem' then
      tabell := coalesce(arg ->> 'tabell', '');
      objekt := nullif(arg ->> 'objekt_id', '')::uuid;
      if objekt is null or tabell not in ('leads', 'students', 'bookings', 'invoices', 'payouts') then
        return jsonb_build_object('fel',
          'flagga_problem kräver objekt_id och en tabell: leads, students, bookings, invoices eller payouts.');
      end if;
      if not public.ai_finns(tabell, objekt) then
        return jsonb_build_object('fel', 'Raden finns inte.');
      end if;

      nyid := public.skapa_uppgift(
        case tabell
          when 'leads' then 'AI: titta på en intresseanmälan'
          when 'students' then 'AI: titta på en elev'
          when 'bookings' then 'AI: titta på ett pass'
          when 'invoices' then 'AI: titta på en faktura'
          else 'AI: titta på en utbetalning'
        end,
        'ai:problem:' || tabell || ':' || objekt::text,
        'problem',
        left(coalesce(arg ->> 'varfor', 'AI:n flaggade raden utan att skriva varför.'), 2000),
        tabell, objekt::text,
        (now() at time zone 'Europe/Stockholm')::date + 3,
        'ai');
      ut := jsonb_build_object('skapat', nyid is not null, 'uppgift_id', nyid);

    else
      return jsonb_build_object('fel', 'Okänt verktyg: ' || coalesce(p_verktyg, '(tomt)'));
  end case;

  return coalesce(ut, '[]'::jsonb);
end $$;

revoke execute on function public.ai_verktyg(text, jsonb) from public, anon;
grant execute on function public.ai_verktyg(text, jsonb) to authenticated;

-- ------------------------------------------------------------
-- 4. Ett gammalt förslag får inte skriva över en färskare matchning.
--
-- Scenariot: AI:n föreslår elev → T1 medan eleven är omatchad. Dagen
-- efter sätter ni T2 för hand. En vecka senare rensar någon
-- förslagskön och trycker Godkänn på den gamla raden. Utan den här
-- kontrollen matchas eleven tyst om till T1.
-- ------------------------------------------------------------
create or replace function public.godkann_forslag(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  f        public.ai_forslag%rowtype;
  elev     uuid;
  hjalpare uuid;
  pass     uuid;
  lead_id  uuid;
  nystatus text;
  nuvarande uuid;
  nulage   text;
  rader    integer;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum godkänner förslag.';
  end if;

  select * into f from public.ai_forslag where id = p_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Förslaget finns inte.';
  end if;
  if f.status <> 'foreslagen' then
    raise exception using errcode = '22023',
      message = 'Förslaget är redan avgjort (' || f.status || ').';
  end if;

  case f.typ

    when 'matchning' then
      elev := nullif(f.payload ->> 'elev_id', '')::uuid;
      hjalpare := nullif(f.payload ->> 'studiehjalpare_id', '')::uuid;
      if elev is null or hjalpare is null then
        raise exception using errcode = '22023', message = 'Förslaget saknar elev eller studiehjälpare.';
      end if;
      if not exists (select 1 from public.tutor_profiles t
                      where t.id = hjalpare and t.status = 'approved') then
        raise exception using errcode = '22023',
          message = 'Studiehjälparen är inte godkänd längre. Förslaget utfördes inte.';
      end if;

      select s.matched_tutor_id, s.match_status into nuvarande, nulage
        from public.students s where s.id = elev;

      if nuvarande is not null and nulage = 'matched' and nuvarande <> hjalpare then
        raise exception using errcode = '22023',
          message = 'Eleven har matchats med någon annan sedan förslaget lämnades. '
                 || 'Ta bort den matchningen först om du vill byta.';
      end if;

      update public.students
         set matched_tutor_id = hjalpare,
             match_status = 'matched'
       where id = elev;
      get diagnostics rader = row_count;
      if rader = 0 then
        raise exception using errcode = '22023', message = 'Eleven finns inte längre.';
      end if;

    when 'pass_ej_fakturerbart' then
      pass := nullif(f.payload ->> 'pass_id', '')::uuid;
      if pass is null then
        raise exception using errcode = '22023', message = 'Förslaget saknar pass.';
      end if;
      update public.bookings
         set fakturerbar = false,
             fakturerbar_anledning = left(coalesce(f.payload ->> 'anledning',
               'Undantaget efter AI-förslag.'), 200)
       where id = pass;
      get diagnostics rader = row_count;
      if rader = 0 then
        raise exception using errcode = '22023', message = 'Passet finns inte längre.';
      end if;

    when 'lead_status' then
      lead_id := nullif(f.payload ->> 'lead_id', '')::uuid;
      nystatus := f.payload ->> 'status';
      if lead_id is null or nystatus not in ('new', 'contacted', 'matched', 'declined') then
        raise exception using errcode = '22023', message = 'Förslaget har ingen giltig status för anmälan.';
      end if;
      update public.leads set status = nystatus where id = lead_id;
      get diagnostics rader = row_count;
      if rader = 0 then
        raise exception using errcode = '22023', message = 'Anmälan finns inte längre.';
      end if;

    else
      raise exception using errcode = '22023',
        message = 'Typen ' || f.typ || ' har ingen väg att utföras. Lägg till en gren i godkann_forslag.';
  end case;

  update public.ai_forslag
     set status = 'utford',
         beslutad_av = auth.uid(),
         beslutad = now(),
         utford = now(),
         fel = null
   where id = p_id;

  return jsonb_build_object('id', p_id, 'typ', f.typ, 'status', 'utford');
end $$;

revoke execute on function public.godkann_forslag(uuid) from public, anon;
grant execute on function public.godkann_forslag(uuid) to authenticated;

-- ------------------------------------------------------------
-- 5. Frysningen säger ifrån i stället för att rätta tyst.
--
-- Förut skrevs det gamla värdet tillbaka utan ett ljud. Ett fel i en
-- framtida funktion hade då blivit en ändring som försvann — ingen
-- rad, inget fel, inget test som går rött.
-- ------------------------------------------------------------
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
     or new.motivering is distinct from old.motivering
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

revoke execute on function public.frys_forslaget() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 6. Gallringen av agentloggen.
--
-- agent_steg sparar 500 tecken av varje verktygssvar. För
-- drift-agenten betyder det elevinitialer och familjers fritext, och
-- tabellen hade ingen bortre gräns alls. Auditloggen ska INTE gallras
-- — den här ska.
-- ------------------------------------------------------------
create or replace function public.gallra_agentloggen(p_dagar integer default 90)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  gransen timestamptz := now() - make_interval(days => greatest(p_dagar, 7));
  steg    integer;
  korn    integer;
begin
  if not public.is_admin() and auth.uid() is not null then
    raise exception using errcode = '42501', message = 'Bara Nextrum gallrar agentloggen.';
  end if;

  delete from public.agent_steg s
   using public.agent_korningar k
   where s.korning_id = k.id and k.skapad < gransen;
  get diagnostics steg = row_count;

  -- Själva körningen behålls, men texten i den tas bort: antal,
  -- status och tokens är det som gör loggen användbar i efterhand,
  -- och de bär inga personuppgifter.
  update public.agent_korningar
     set fraga = '[gallrad]', svar = null
   where skapad < gransen and fraga <> '[gallrad]';
  get diagnostics korn = row_count;

  return jsonb_build_object('gallrade_steg', steg, 'gallrade_korningar', korn,
                            'aldre_an', gransen);
end $$;

revoke execute on function public.gallra_agentloggen(integer) from public, anon;
grant execute on function public.gallra_agentloggen(integer) to authenticated;
