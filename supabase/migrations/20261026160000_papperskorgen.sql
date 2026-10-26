-- ============================================================
-- NEXTRUM — papperskorgen under Intresseanmälningar och
-- Ansökningar (2026-10-26)
--
-- Leo: "i intresseanmälningar och ansökan, under varje flik, gör en
-- knapp för papperskorg, vilket är radera uppgifter från det stället.
-- alltså finns personen i familj och intresseanmälan och jag raderar
-- den personen från intresseanmälan så finns personen kvar i vårt
-- system och i familj. när en person blir raderad och det stället är
-- det sista stället den är med i så kommer en notis om att det kan ta
-- bort personen helt och sen avbryt eller gå vidare."
--
-- RADERA FINNS REDAN, OCH ÄR NÅGOT ANNAT. radera_person() tar bort en
-- person ur våra system (personer_redigeras_och_raderas): en anmälan
-- tar med sig alla anmälningar och frågor från samma adress, en
-- ansökan alla ansökningar och frågor. Det är vägen för den som ber
-- oss radera allt (artikel 17), och den står kvar sist i panelen.
-- Papperskorgen tar bort EN rad ur EN lista, och personen står kvar
-- överallt annars: under Familjer, Studiehjälpare, Kommunikation och i
-- en annan anmälan eller ansökan med samma adress.
--
-- VAR PERSONEN FINNS KVAR räknas här, inte i vyn
-- (intern.stalle_underlag): andra anmälningar och ansökningar med
-- samma adress, frågor under Kommunikation, och konton med samma
-- adress eller det konto raden pekar ut (leads.kund_id,
-- applications.konto_id). Samma adressnyckel som radera_person()
-- (intern.epost_nyckel). Finns personen ingen annanstans är raden det
-- sista stället, och då tar papperskorgen bort personen helt.
-- ta_bort_ur_stallet() kräver då p_helt, så att en ruta som öppnades
-- medan personen fanns kvar någon annanstans aldrig tar bort hen helt
-- utan att ha sagt det.
--
-- EN ANMÄLAN AVIDENTIFIERAS, som när radera_person() eller nattjobbet
-- gör det: namnet, adressen och det familjen skrev tas bort, och raden
-- står kvar utan dem, så att statistiken räknar lika många anmälningar
-- bakåt i tiden och koden och familjen den ledde till står kvar för
-- tipstimmen. En avidentifierad anmälan står inte i listan.
--
-- EN ANSÖKAN TAS BORT, som när gallringen gör det
-- (public.ansokan_gallra): CV:t först, raden sedan. Adminvyn tar bort
-- filen, och ta_bort_ur_stallet() vägrar så länge en fil som bara den
-- här ansökan pekar ut finns kvar. Loggen över stegen och mejlen till
-- hen går med raden (främmande nycklar), och en värvningsbonus som
-- väntar på ansökan annulleras med skälet (intern.varvningsbonus_vakt).
-- Rutan säger det innan.
--
-- EN SATS SOM RIVER PER FUNKTION. Verktyget som kör migrationer i
-- driften frågar efter en funktion med två delete, eller ett delete och
-- två update, och hänger sig när ingen svarar (CLAUDE.md avsnitt 5).
-- Därför har varje sak sin egen lilla funktion.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Var personen finns kvar, och vad raden tar med sig
--
-- Svarar med:
--   namn       namnet på raden, för rutans rubrik
--   sista      personen finns ingen annanstans hos oss
--   kvar       anmalningar, ansokningar och kontakt (antal med samma
--              adress, utom raden själv), och konton: [{id, roll, admin}]
--   filer      CV:n som bara den här ansökan pekar ut ({hink, namn})
--   varningar  bonus: värvare vars bonus väntar på ansökan;
--              mejl: steg vars mejl till hen inte gått än;
--              vardnadshavare: när vårdnadshavaren godkände, om personen
--              är studiehjälpare hos oss
-- eller med fel, när raden inte finns.
-- ------------------------------------------------------------
create or replace function intern.stalle_underlag(p_stalle text, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  l       public.leads;
  a       public.applications;
  nyckel  text;
  kopplad uuid;
  namn    text;
  anm     bigint;
  ans     bigint;
  kon     bigint;
  konton  jsonb;
  filer   jsonb := '[]';
  varn    jsonb := '{}';
begin
  if p_stalle = 'anmalan' then
    select * into l from public.leads x where x.id = p_id;
    if not found or l.email = 'gallrad' then
      return jsonb_build_object('fel', 'Anmälan finns inte längre, eller är redan borttagen.');
    end if;
    nyckel := nullif(intern.epost_nyckel(l.email), '');
    kopplad := l.kund_id;
    namn := coalesce(nullif(btrim(l.parent_name), ''), l.email);
  elsif p_stalle = 'ansokan' then
    select * into a from public.applications x where x.id = p_id;
    if not found then
      return jsonb_build_object('fel', 'Ansökan finns inte längre.');
    end if;
    nyckel := nullif(intern.epost_nyckel(a.email), '');
    kopplad := a.konto_id;
    namn := coalesce(nullif(btrim(a.name), ''), a.email);
  else
    return jsonb_build_object('fel', 'Papperskorgen finns bara under Intresseanmälningar och Ansökningar.');
  end if;

  select count(*) into anm from public.leads x
   where x.email <> 'gallrad' and nyckel is not null and intern.epost_nyckel(x.email) = nyckel
     and not (p_stalle = 'anmalan' and x.id = p_id);
  select count(*) into ans from public.applications x
   where nyckel is not null and intern.epost_nyckel(x.email) = nyckel
     and not (p_stalle = 'ansokan' and x.id = p_id);
  select count(*) into kon from public.contact_messages x
   where nyckel is not null and intern.epost_nyckel(x.email) = nyckel;
  -- Ett konto som är raderat eller avidentifierat är ingen person längre.
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'roll', p.role, 'admin', intern.har_adminroll(p.id))
                            order by p.created_at), '[]')
    into konton
    from public.profiles p
   where p.raderad_at is null
     and (p.id = kopplad or (nyckel is not null and intern.epost_nyckel(p.email) = nyckel));

  if p_stalle = 'ansokan' then
    -- Samma regel som intern.radering_filer och ansokan_gallra: en fil som
    -- en annan ansökan också pekar ut står kvar.
    select coalesce(jsonb_agg(jsonb_build_object('hink', o.bucket_id, 'namn', o.name) order by o.name), '[]')
      into filer
      from storage.objects o
     where o.bucket_id = 'cv'
       and o.name = any (intern.ansokan_cv_namn(a.why))
       and not exists (select 1 from public.applications b
                        where b.id <> a.id and o.name = any (intern.ansokan_cv_namn(b.why)));

    varn := jsonb_build_object(
      'bonus', (select coalesce(jsonb_agg(v.varvare_profil_id order by v.skapad_at), '[]')
                  from public.varvningsbonus v
                 where v.varvad_ansokan_id = a.id and v.status = 'vantar'),
      'mejl', (select coalesce(jsonb_agg(distinct u.steg), '[]')
                 from (select x.steg from public.ansokan_utskick x
                        where x.ansokan_id = a.id and x.status in ('vantar', 'skickar')
                       union all
                       select 'intervju' from public.notis_utskick n
                        where n.ansokan_id = a.id and n.status in ('vantar', 'skickar')) u),
      -- Godkännandet är beviset på att den som är under 18 fick ta jobbet
      -- (föräldrabalken), och det går med ansökan. Det spelar roll när hen
      -- är studiehjälpare hos oss.
      'vardnadshavare', case
        when a.vardnadshavare_godkand_at is not null
             and exists (select 1 from jsonb_array_elements(konton) k where k ->> 'roll' = 'tutor')
        then to_jsonb(a.vardnadshavare_godkand_at) end);
  end if;

  return jsonb_build_object(
    'stalle', p_stalle,
    'namn', namn,
    'sista', anm = 0 and ans = 0 and kon = 0 and jsonb_array_length(konton) = 0,
    'kvar', jsonb_build_object('anmalningar', anm, 'ansokningar', ans, 'kontakt', kon, 'konton', konton),
    'filer', filer,
    'varningar', jsonb_strip_nulls(varn));
end $$;

comment on function intern.stalle_underlag(text, uuid) is
  'Papperskorgen (2026-10-26): var personen på en anmälan eller ansökan finns kvar hos oss, om raden är det sista '
  'stället, vilka CV-filer som går med den och vad rutan ska varna för. Samma svar för stalle_lage() och '
  'ta_bort_ur_stallet(), så att rutan lovar det som händer.';

revoke all on function intern.stalle_underlag(text, uuid) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 2. Det rutan frågar
-- ------------------------------------------------------------
create or replace function public.stalle_lage(p_stalle text, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  -- Svaret säger var en person finns, så vakten står först.
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum ser vad papperskorgen tar med sig.';
  end if;
  return intern.stalle_underlag(p_stalle, p_id);
end $$;

comment on function public.stalle_lage(text, uuid) is
  'Papperskorgen (2026-10-26): vad det betyder att ta bort en anmälan eller ansökan ur sin lista. Bara superadmin.';

revoke all on function public.stalle_lage(text, uuid) from public, anon, nextrum_barn;
grant execute on function public.stalle_lage(text, uuid) to authenticated;


-- ------------------------------------------------------------
-- 3. Det som tas bort, en sak per funktion
-- ------------------------------------------------------------

-- Samma fält som radera_person() och nattjobbet (intern.leads_avidentifiera).
-- Står den kvar som ny eller kontaktad skapar uppföljningen en uppgift om
-- den varje natt, så den blir avböjd.
create or replace function intern.anmalan_i_papperskorgen(p_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.leads
     set parent_name = 'Gallrad', email = 'gallrad', child_name = null, message = null, notering = null,
         landningssida = nullif(split_part(landningssida, '?', 1), ''),
         status = case when status in ('new', 'contacted') then 'declined' else status end
   where id = p_id and email <> 'gallrad';
$$;

revoke all on function intern.anmalan_i_papperskorgen(uuid) from public, anon, authenticated;

-- Stegen, mejlen och intervjumejlet i kön går med raden (on delete
-- cascade), och en väntande värvningsbonus annulleras när nyckeln blir
-- null (intern.varvningsbonus_vakt). applications_audit_borttagen loggar.
create or replace function intern.ansokan_i_papperskorgen(p_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.applications where id = p_id;
$$;

revoke all on function intern.ansokan_i_papperskorgen(uuid) from public, anon, authenticated;

-- Uppgifterna i Att göra om raden: utan raden finns inget att göra.
create or replace function intern.uppgifter_om_raden_bort(p_tabell text, p_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.uppgifter where kopplad_tabell = p_tabell and kopplad_id = p_id::text;
$$;

revoke all on function intern.uppgifter_om_raden_bort(text, uuid) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 4. Papperskorgen
--
-- p_helt är rutans svar på frågan om personen ska bort helt. Är raden
-- det sista stället och p_helt inte satt, händer ingenting.
-- ------------------------------------------------------------
create or replace function public.ta_bort_ur_stallet(p_stalle text, p_id uuid, p_helt boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  jag   uuid := auth.uid();
  lage  jsonb;
  sista boolean;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum tar bort ur listorna.';
  end if;

  -- Samma lås som radera_person(): två tryck på samma rad väntar på
  -- varandra, och den andra får beskedet att raden är borta.
  perform pg_advisory_xact_lock(hashtextextended('radera:' || p_id::text, 0));
  if p_stalle = 'anmalan' then
    perform 1 from public.leads where id = p_id for update;
  elsif p_stalle = 'ansokan' then
    perform 1 from public.applications where id = p_id for update;
  end if;

  lage := intern.stalle_underlag(p_stalle, p_id);
  if lage ? 'fel' then
    raise exception using errcode = '22023', message = lage ->> 'fel';
  end if;
  sista := (lage ->> 'sista')::boolean;
  if sista and not coalesce(p_helt, false) then
    raise exception using errcode = '23514',
      message = 'Det här är det sista stället personen finns hos oss, och då tas hen bort helt. '
        || 'Öppna papperskorgen igen, så frågar den först.';
  end if;
  if jsonb_array_length(lage -> 'filer') > 0 then
    raise exception using errcode = '23514',
      message = 'CV:t finns kvar i lagringen. Det tas bort först, så att ingen fil blir kvar utan en ansökan '
        || 'som pekar ut den.';
  end if;

  if p_stalle = 'anmalan' then
    perform intern.anmalan_i_papperskorgen(p_id);
    perform intern.uppgifter_om_raden_bort('leads', p_id);
    insert into public.audit_logg (aktor, aktor_typ, handling, tabell, objekt_id, efter)
    values (jag, 'admin', 'anmalan.avidentifierad', 'leads', p_id::text,
            jsonb_build_object('papperskorgen', true, 'sista', sista));
  else
    perform intern.uppgifter_om_raden_bort('applications', p_id);
    perform intern.ansokan_i_papperskorgen(p_id);
  end if;

  return jsonb_build_object('ok', true, 'stalle', p_stalle, 'sista', sista, 'kvar', lage -> 'kvar');
end $$;

comment on function public.ta_bort_ur_stallet(text, uuid, boolean) is
  'Papperskorgen (2026-10-26): tar bort en anmälan (avidentifieras) eller en ansökan (tas bort) ur sin lista, och '
  'inget annat. Är raden det sista stället personen finns krävs p_helt. Bara superadmin. Radera hela personen: '
  'radera_person().';

revoke all on function public.ta_bort_ur_stallet(text, uuid, boolean) from public, anon, nextrum_barn;
grant execute on function public.ta_bort_ur_stallet(text, uuid, boolean) to authenticated;
