-- ============================================================
-- Anmälan flyttas till familjen när familjen tas in (2026-10-21)
--
-- Leo: "när en intresseanmälan blir en familj ska en SECURITY DEFINER-
-- funktion intag_lead(lead_id) (a) kopiera källa, kampanj och utm till
-- familjens profil, (b) markera familjen som intagen och (c) radera
-- lead-raden så den inte tar plats i listan. Bygg samma sak som knapp i
-- admin. Hira finns redan som familj: gör en engångsfix för henne."
--
-- Varför anmälan inte bara raderas. Tre saker i databasen läser raden
-- efter att familjen blivit kund:
--   - tipstimmen: intern.tipsade_familjer hittar den nya familjen genom
--     leads.kund_id och leads.kod. Utan raden får familjen som tipsat
--     ingen timme, och koden räknas som oanvänd.
--   - koderna: mina_tips, tipskoder_lage och koder_lage räknar
--     anmälningarna med koden.
--   - statistiken: analys_konvertering och analys_leads_per_kalla räknar
--     anmälningarna, och blev_kund är just de som raderats.
-- Därför flyttas det som inte är personuppgifter till en egen tabell,
-- intagna_anmalningar, med samma id, och de fem läser båda. Familjens
-- profil får inga nya kolumner: profiles skyddas av en lista över
-- kolumner familjen inte får skriva (skydda_profilfalt), och en ny
-- kolumn där hade varit skrivbar för familjen själv. Källan står i
-- familjens panel i adminvyn, där bara vi läser den.
--
--   1. intagna_anmalningar: anmälans id, familjen, när den anmälde sig,
--      kontaktades och togs in, och av vem, tjänsten, årskursen, ämnet,
--      de sju källfälten, koden och meddelandet. Meddelandet (telefonen,
--      när det passar att ringa och familjens önskemål) gallras som
--      förut, sex månader efter kontakten (leads_avidentifiera).
--   2. intag_lead(anmälan, familj): bara superadmin, som Ta in familjen.
--      Familjen är den som anges, annars anmälans kund_id, annars den
--      enda familjen med anmälans adress. Telefonnumret ur meddelandets
--      första rad går till familjens profil om den saknar ett. Svarar
--      med familjen och vad som flyttades. En anmälan som redan flyttats
--      svarar med det, så knappen går att trycka två gånger.
--   3. Tipstimmen, koderna och statistiken läser intagna_anmalningar
--      också.
--   4. Gallringen och raderingen: meddelandet och adressens frågesträng
--      gallras som i leads, och radera_person tömmer dem för en familj
--      som raderas.
--   5. Anmälningar som redan är intagna (kund_id och läget matched,
--      alltså Ta in familjen hela vägen) flyttas nu.
--   6. Hira: en familj som fanns innan anmälan kopplades. Anmälan med
--      förnamnet Hira, utan kund_id, kopplas till familjen med samma
--      adress eller förnamn och flyttas. Hittas inte exakt en av varje
--      görs ingenting, och en NOTICE säger varför. Går att köra igen.
--
-- Matchningen ligger redan på barnet (students.matched_tutor_id och
-- match_status, sedan schema-v14): profiles bär bara en spegel av det
-- första matchade barnet (synka_familjens_match). Ingen policy flyttas
-- här; adminvyn visar Matchad på barnet och Intagen på familjen.
--
-- Funktionerna lappas med replace() och räknade träffar, eller skrivs om
-- med en vakt på driftens md5, så att filen inte skriver över någon
-- annans ändring. Inget drop. delete finns bara i intern.intag_lead (en
-- sats), så filen går hel i ett do-block (CLAUDE.md avsnitt 5).
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 0. driften är som den lästes ----------
do $$
declare
  f   record;
  def text;
begin
  for f in
    select * from (values
      ('intern.tipsade_familjer(text)',    '89e84330a0a221b4166075f32c3569d8'),
      ('intern.leads_avidentifiera()',      '5e2c135929eb4e6dd8451273dc01d953')) v(namn, summa)
  loop
    def := pg_get_functiondef(f.namn::regprocedure);
    if position('intagna_anmalningar' in def) = 0 and md5(def) <> f.summa then
      raise exception '% har ändrats sedan anmalan_flyttas_till_familjen skrevs (md5 %). Läs driften och skriv om migrationen.',
        f.namn, md5(def);
    end if;
  end loop;

  for f in
    select * from (values
      ('analys_konvertering',    'e3d6dedb2f02901937f7405c538251c6'),
      ('analys_leads_per_kalla', '3eabf5c59f65474b6e00670f93abe406')) v(namn, summa)
  loop
    def := pg_get_viewdef(('public.' || f.namn)::regclass, true);
    if position('intagna_anmalningar' in def) = 0 and md5(def) <> f.summa then
      raise exception 'Vyn % har ändrats sedan anmalan_flyttas_till_familjen skrevs (md5 %). Läs driften.',
        f.namn, md5(def);
    end if;
  end loop;
end $$;


-- ---------- 1. tabellen ----------
create table if not exists public.intagna_anmalningar (
  id            uuid primary key,
  parent_id     uuid references public.profiles(id) on delete set null,
  anmald_at     timestamptz not null,
  kontaktad_at  timestamptz,
  intagen_at    timestamptz not null default now(),
  intagen_av    uuid references public.profiles(id) on delete set null,
  tjanst        text references public.tjanster(kod),
  grade         text,
  subject       text,
  kalla         text,
  medium        text,
  kampanj       text,
  annonsvariant text,
  sokord        text,
  hanvisare     text,
  landningssida text,
  kod           text references public.tipskoder(kod) on update cascade on delete set null,
  meddelande    text
);

create index if not exists intagna_anmalningar_familj on public.intagna_anmalningar (parent_id);
create index if not exists intagna_anmalningar_kod on public.intagna_anmalningar (kod) where kod is not null;
create index if not exists intagna_anmalningar_anmald on public.intagna_anmalningar (anmald_at);

comment on table public.intagna_anmalningar is
  '2026-10-21 (anmalan_flyttas_till_familjen). En intresseanmälan som blivit en familj, flyttad ur leads av '
  'intag_lead() med samma id. Namn och adress står på familjens konto; här står varifrån familjen kom, koden och '
  'meddelandet. Bara intern.intag_lead skriver; de som läser intresseanmälningar läser. Tipstimmen, koderna och '
  'statistiken läser den som en anmälan.';
comment on column public.intagna_anmalningar.meddelande is
  'Anmälans meddelande (telefonen, när det passar att ringa, önskemålen). Gallras som i leads: sex månader efter '
  'kontakten (intern.leads_avidentifiera), och när familjen raderas (radera_person).';
comment on column public.intagna_anmalningar.parent_id is
  'Familjen. Blir null när kontot tas bort helt; raden står kvar i statistiken, som en avidentifierad anmälan.';

alter table public.intagna_anmalningar enable row level security;
revoke all on public.intagna_anmalningar from anon, nextrum_barn;
revoke insert, update, delete, truncate, references, trigger on public.intagna_anmalningar from authenticated;
grant select on public.intagna_anmalningar to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'intagna_anmalningar'
                  and policyname = 'admin läser intagna anmälningar') then
    -- Samma behörighet som läser leads: det är samma rader.
    create policy "admin läser intagna anmälningar" on public.intagna_anmalningar
      for select to authenticated using (public.har_behorighet('leads'));
  end if;
end $$;


-- ---------- 2. flytten ----------
create or replace function intern.intag_lead(p_lead uuid, p_familj uuid, p_av uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  l       public.leads;
  familj  uuid := p_familj;
  antal   integer;
  telefon text;
begin
  select * into l from public.leads where id = p_lead for update;
  if not found then
    if exists (select 1 from public.intagna_anmalningar i where i.id = p_lead) then
      return jsonb_build_object('redan', true,
        'familj', (select i.parent_id from public.intagna_anmalningar i where i.id = p_lead));
    end if;
    raise exception using errcode = 'P0002', message = 'Anmälan finns inte.';
  end if;

  familj := coalesce(familj, l.kund_id);
  if familj is null and l.email <> 'gallrad' then
    -- Som adminvyns anmälansFamilj: den enda familjen med anmälans adress.
    select count(*), min(p.id::text)::uuid into antal, familj
      from public.profiles p
     where p.role = 'parent' and p.raderad_at is null
       and intern.epost_nyckel(p.email) = intern.epost_nyckel(l.email);
    if antal <> 1 then
      familj := null;
    end if;
  end if;
  if familj is null then
    raise exception using errcode = '22023',
      message = 'Anmälan har ingen familj än. Ta in familjen först, så skapas kontot.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = familj and p.role = 'parent' and p.raderad_at is null) then
    raise exception using errcode = '22023', message = 'Det kontot är ingen familj.';
  end if;

  insert into public.intagna_anmalningar (
    id, parent_id, anmald_at, kontaktad_at, intagen_av, tjanst, grade, subject,
    kalla, medium, kampanj, annonsvariant, sokord, hanvisare, landningssida, kod, meddelande)
  values (
    l.id, familj, l.created_at, l.kontaktad_at, p_av, l.tjanst, l.grade, l.subject,
    l.kalla, l.medium, l.kampanj, l.annonsvariant, l.sokord, l.hanvisare, l.landningssida, l.kod,
    nullif(btrim(coalesce(l.message, '')), ''));

  -- Telefonen står på första raden ("Telefon: …", intresseanmalan.html).
  telefon := nullif(btrim(substring(split_part(coalesce(l.message, ''), E'\n', 1) from '^Telefon:\s*(.+)$')), '');
  if telefon is not null and char_length(telefon) <= 40 then
    update public.profiles set phone = telefon
     where id = familj and (phone is null or btrim(phone) = '');
  end if;

  delete from public.leads where id = l.id;

  -- Auditen: anmälan flyttades till familjen, och av vem. Aldrig meddelandet
  -- eller källan. En egen rad i stället för en trigger, så att den heter
  -- anmalan.intagen och inte "anmälan skapad".
  insert into public.audit_logg (aktor, aktor_typ, handling, tabell, objekt_id, efter)
  values (p_av,
          case when p_av is null then 'system' when intern.har_adminroll(p_av) then 'admin' else 'anvandare' end,
          'anmalan.intagen', 'leads', l.id::text,
          jsonb_build_object('kund_id', familj, 'status', l.status));

  return jsonb_build_object('redan', false, 'familj', familj, 'anmald_at', l.created_at,
                            'kalla', l.kalla, 'kampanj', l.kampanj, 'kod', l.kod,
                            'telefon', telefon is not null);
end $$;

revoke all on function intern.intag_lead(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.intag_lead(p_lead uuid, p_familj uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Som Ta in familjen: bara superadmin. Flytten skriver familjens telefon
  -- och tar bort en rad ur listan.
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum tar in en familj.';
  end if;
  return intern.intag_lead(p_lead, p_familj, auth.uid());
end $$;

revoke all on function public.intag_lead(uuid, uuid) from public, anon, nextrum_barn;
grant execute on function public.intag_lead(uuid, uuid) to authenticated;

comment on function public.intag_lead(uuid, uuid) is
  '2026-10-21. Flyttar en intresseanmälan till familjen: källan, koden och meddelandet till intagna_anmalningar, '
  'telefonen till profilen om den saknas, och anmälan ur leads. Bara superadmin.';


-- ---------- 3. tipstimmen, koderna och statistiken läser båda ----------
create or replace function intern.tipsade_familjer(p_kod text)
 returns table(kund_id uuid, anmald_at timestamp with time zone, forsta_pass date)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  -- anmalan_flyttas_till_familjen (2026-10-21): en intagen anmälan står i
  -- intagna_anmalningar med samma id, inte i leads.
  with anmalningar as (
    select l.id, l.kund_id, l.kod, l.created_at from public.leads l
     where l.kund_id is not null and l.kod is not null
    union all
    select i.id, i.parent_id, i.kod, i.anmald_at from public.intagna_anmalningar i
     where i.parent_id is not null and i.kod is not null
  ),
  forsta_koden as (
    -- Familjens första anmälan med en kod. En familj som fått koder av
    -- två andra ger en timme, inte två.
    select distinct on (a.kund_id) a.kund_id, a.kod, a.created_at
      from anmalningar a
     order by a.kund_id, a.created_at, a.id
  ),
  hallna as (
    select b.parent_id, b.wanted_date
      from public.bookings b
      join public.lesson_reports r on r.booking_id = b.id
     where b.status = 'completed' and r.narvaro is distinct from 'franvarande'
  )
  select f.kund_id, f.created_at,
         (select min(h.wanted_date) from hallna h where h.parent_id = f.kund_id)
    from forsta_koden f
    join public.tipskoder k on k.kod = f.kod
   where f.kod = p_kod
     and k.person_id is distinct from f.kund_id
     -- Ny när den anmälde sig: inget hållet pass före anmälan.
     and not exists (select 1 from hallna h
                      where h.parent_id = f.kund_id
                        and h.wanted_date < (f.created_at at time zone 'Europe/Stockholm')::date)
$function$;

-- Anmälningarna med en kod, i leads och flyttade.
create or replace function intern.anmalningar_med_kod(p_kod text)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select ((select count(*) from public.leads l where l.kod = p_kod)
        + (select count(*) from public.intagna_anmalningar i where i.kod = p_kod))::integer
$$;

revoke all on function intern.anmalningar_med_kod(text) from public, anon, authenticated;

do $$
declare
  f      record;
  def    text;
  traffar integer;
begin
  for f in
    select * from (values
      ('public.mina_tips()',          '(select count(*) from public.leads l where l.kod = k.kod)'),
      ('public.tipskoder_lage()',     '(select count(*)::integer from public.leads l where l.kod = k.kod)'),
      ('public.koder_lage(text)',     '(select count(*)::integer from public.leads l where l.kod = k.kod)')) v(namn, gammalt)
  loop
    def := pg_get_functiondef(f.namn::regprocedure);
    if position('intern.anmalningar_med_kod' in def) > 0 then
      continue;
    end if;
    traffar := (length(def) - length(replace(def, f.gammalt, ''))) / length(f.gammalt);
    if traffar <> 1 then
      raise exception '% räknar anmälningarna med koden % gånger, väntat en. Läs driften.', f.namn, traffar;
    end if;
    execute replace(def, f.gammalt, 'intern.anmalningar_med_kod(k.kod)');
  end loop;
end $$;

create or replace view public.analys_leads_per_kalla
with (security_invoker = true) as
with alla as (
  -- anmalan_flyttas_till_familjen (2026-10-21): en intagen anmälan står i
  -- intagna_anmalningar, som en anmälan som blivit kund.
  select l.created_at, l.kalla, l.medium, l.kontaktad_at, l.status, l.kund_id from public.leads l
  union all
  select i.anmald_at, i.kalla, i.medium, i.kontaktad_at, 'matched'::text, i.parent_id from public.intagna_anmalningar i
)
select date_trunc('month', l.created_at at time zone 'Europe/Stockholm')::date as manad,
       l.kalla,
       l.medium,
       count(*)                                                as anmalningar,
       count(*) filter (where l.kontaktad_at is not null)      as kontaktade,
       count(*) filter (where l.status = 'matched')            as matchade,
       count(*) filter (where l.status = 'declined')           as avbojda,
       count(*) filter (where l.kund_id is not null)           as blev_kund,
       count(*)                                                as underlag_rader
from alla l
where not intern.utanfor_statistiken(l.kund_id)
group by 1, 2, 3;

create or replace view public.analys_konvertering
with (security_invoker = true) as
with alla as (
  select l.created_at, l.kontaktad_at, l.status, l.kund_id from public.leads l
  union all
  select i.anmald_at, i.kontaktad_at, 'matched'::text, i.parent_id from public.intagna_anmalningar i
)
select date_trunc('month', l.created_at at time zone 'Europe/Stockholm')::date as manad,
       count(*)                                                            as anmalningar,
       count(*) filter (where l.kontaktad_at is not null)                  as kontaktade,
       count(*) filter (where l.kund_id is not null)                       as blev_kund,
       count(*) filter (where l.kund_id is not null
                          and exists (select 1 from public.students s
                                       where s.parent_id = l.kund_id))      as fick_elev,
       count(*) filter (where l.kund_id is not null
                          and exists (select 1 from public.students s
                                       where s.parent_id = l.kund_id
                                         and s.matched_tutor_id is not null)) as blev_matchad,
       count(*) filter (where l.kund_id is not null
                          and exists (select 1 from public.passunderlag p
                                       where p.parent_id = l.kund_id
                                         and p.har_rapport))                as fick_forsta_passet,
       count(*) filter (where l.kund_id is null and l.status = 'matched')  as ej_sparbara,
       count(*)                                                            as underlag_rader
from alla l
where not intern.utanfor_statistiken(l.kund_id)
group by 1;


-- ---------- 4. gallringen och raderingen ----------
create or replace function intern.leads_avidentifiera()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  n        integer;
  m        integer;
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

  -- anmalan_flyttas_till_familjen (2026-10-21): en anmälan som flyttats
  -- till familjen gallras på samma dag som den hade gallrats i leads.
  update public.intagna_anmalningar i
     set meddelande    = null,
         landningssida = nullif(split_part(i.landningssida, '?', 1), '')
   where (i.meddelande is not null or i.landningssida like '%?%')
     and greatest(i.anmald_at, coalesce(i.kontaktad_at, i.anmald_at)) + interval '6 months' <= now();
  get diagnostics m = row_count;

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

  return jsonb_build_object('avidentifierade', n, 'intagna', m, 'fastnade', fastnade);
end $function$;

do $$
declare
  def     text := pg_get_functiondef('public.radera_person(text, uuid)'::regprocedure);
  gammalt text := E'   where id = any (anm);\n\n  delete from public.uppgifter';
  traffar integer;
begin
  if position('intagna_anmalningar' in def) > 0 then
    return;
  end if;
  traffar := (length(def) - length(replace(def, gammalt, ''))) / length(gammalt);
  if traffar <> 1 then
    raise exception 'radera_person: avidentifieringen av anmälningarna hittades % gånger, väntat en. Läs driften.', traffar;
  end if;
  execute replace(def, gammalt,
    E'   where id = any (anm);\n\n'
    || E'  -- anmalan_flyttas_till_familjen (2026-10-21): anmälan som flyttats till\n'
    || E'  -- familjen gallras som en anmälan i leads.\n'
    || E'  update public.intagna_anmalningar\n'
    || E'     set meddelande = null, landningssida = nullif(split_part(landningssida, ''?'', 1), '''')\n'
    || E'   where p_typ = ''familj'' and parent_id = p_id;\n\n'
    || E'  delete from public.uppgifter');
end $$;


-- ---------- 5. det som redan är intaget ----------
do $$
declare
  l record;
  n integer := 0;
begin
  for l in
    select x.id, x.kund_id from public.leads x
     where x.kund_id is not null and x.status = 'matched'
       and exists (select 1 from public.profiles p where p.id = x.kund_id and p.role = 'parent' and p.raderad_at is null)
     order by x.created_at
  loop
    perform intern.intag_lead(l.id, l.kund_id, null);
    n := n + 1;
  end loop;
  raise notice 'anmalan_flyttas_till_familjen: % intagna anmälningar flyttade till familjen.', n;
end $$;


-- ---------- 6. Hira ----------
-- Familjen fanns innan anmälan kopplades (leads.kund_id är tom), så Ta in
-- familjen kopplade aldrig ihop dem. Anmälan hittas på förnamnet, familjen
-- på anmälans adress och annars på förnamnet. Ingenting görs om det inte
-- är exakt en av varje: hellre en NOTICE än fel familj.
do $$
declare
  anm     uuid[];
  fam     uuid[];
  adress  text;
begin
  anm := array(select l.id from public.leads l
                where l.kund_id is null and l.email <> 'gallrad'
                  and lower(split_part(btrim(l.parent_name), ' ', 1)) = 'hira');
  if cardinality(anm) = 0 then
    raise notice 'Hira: ingen anmälan utan familj med det förnamnet (redan flyttad, eller finns inte här).';
    return;
  end if;
  if cardinality(anm) > 1 then
    raise notice 'Hira: % anmälningar med förnamnet; ingenting gjort. Ta in med knappen i adminvyn.', cardinality(anm);
    return;
  end if;

  select intern.epost_nyckel(l.email) into adress from public.leads l where l.id = anm[1];
  fam := array(select p.id from public.profiles p
                where p.role = 'parent' and p.raderad_at is null
                  and intern.epost_nyckel(p.email) = adress);
  if cardinality(fam) = 0 then
    fam := array(select p.id from public.profiles p
                  where p.role = 'parent' and p.raderad_at is null
                    and lower(split_part(btrim(p.full_name), ' ', 1)) = 'hira');
  end if;
  if cardinality(fam) <> 1 then
    raise notice 'Hira: % familjer passar anmälan; ingenting gjort. Ta in med knappen i adminvyn.', cardinality(fam);
    return;
  end if;

  update public.leads set kund_id = fam[1], status = 'matched' where id = anm[1];
  perform intern.intag_lead(anm[1], fam[1], null);
  raise notice 'Hira: anmälan kopplad till familjen och flyttad.';
end $$;
