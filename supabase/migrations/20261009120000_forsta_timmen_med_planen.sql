-- ============================================================
-- Första timmen gratis med planen, högst en per familj, och tipstimmen
-- efter två timmar (2026-10-09, Leo)
--
-- Leo: "bara folk som köper planen ska få gratis första lektion, men
-- när vi skapar konto åt en kund ska de MAXIMALT få en timme gratis,
-- aldrig mer än en timme gratis. de kan spara genom timbanken men inte
-- få gratis av oss", "vi ska kunna välja om vanliga kunder som köper
-- timme för timme får gratis första lektion", och om tipsen: "högst en
-- gratis timme per familj totalt, utan tips ... man kan tjäna en gratis
-- timme genom att ta in en annan familj och detta funkar om den andra
-- familjen haft en lektion på två timmar med oss, oavsett om de
-- betalade för båda timmarna eller bara en".
--
--
-- REGLERNA
--
-- Första timmen, högst en per familj, på ett av två sätt:
--   · den första planen familjen betalar får en timme till, på köpet
--     (klippkort.timmar och timmar_pa_kopet ett steg upp, forsta_timmen
--     sant). Timmen används som planens andra timmar, så den betalar
--     ett pass som vilket annat; ett pass med startrabatt kan planen
--     inte betala (Fas 22.2), och därför ges timmen i planen och inte
--     som rabatt på ett pass.
--   · en familj som betalar pass för pass får den bara om vi valt det
--     för familjen (forsta_timmen_beviljad, satt av ge_forsta_timmen()
--     när vi tar in familjen eller i familjens panel). Då gäller Fas
--     19.5:s regel som förut: det pass som gör att familjen bokat två
--     timmar får en timme avdragen.
--   Har familjen fått den ena får den inte den andra
--   (intern.forsta_timmen_tagen). Ett avbokat pass med startrabatt
--   räknas inte, som förut; en plan som fått timmen räknas alltid, också
--   om den betalats tillbaka, för timmen kan ha använts.
--
-- Tipstimmen står utanför taket (Leo: "utan tips"), en per ny familj
-- som anmält sig med familjens kod, som förut. Den tjänas in när den
-- tipsade familjen haft två timmar läxhjälp, i hållna pass (genomförda,
-- med en rapport där eleven inte var frånvarande), i stället för vid
-- det första hållna passet; om den familjen fick en av timmarna gratis
-- spelar ingen roll. Passens bokade längd räknas, och dagen för det
-- pass som når två timmar är den dag timmen tjänades in (det flaggan
-- tipstimme jämförs med, som förut).
--
-- Timbanken är familjens egna köpta minuter och berörs inte.
--
--
-- ÅTERBETALNINGEN
--
-- klippkort_saldo räknar på timmar, och timmen på köpet följer med av
-- sig själv: slutar familjen efter ångerfristen räknas de använda
-- timmarna till ordinarie timpris (timmen på köpet också, för den är en
-- del av rabatten, som villkoren säger), och inom fristen till det
-- avtalade priset, alltså betalt delat med alla timmarna. Timmen betalas
-- aldrig ut som pengar.
--
--
-- VILLKOREN
--
-- Villkoren säger det här i Planer och klippkort och under Tips
-- (anvandarvillkor.html), så versionen blir 2026-10-09 och alla får
-- frågan igen vid nästa inloggning (kolla-villkor.py).
--
-- Adminens kodlista (tipskoder_lage) räknar samma sak: kolumnen
-- forsta_pass heter som förut, för en ny returtyp hade krävt en drop,
-- men räknar sedan 2026-10-09 de tipsade familjer som haft två timmar.
--
-- forsta_timmen_bjuds, tipstimmar_intjanade och tipskoder_lage skrivs om i sin helhet,
-- med en vakt som avbryter om funktionen i databasen inte är den som
-- lästes i driften 2026-10-09 (md5 nedan). Ingen drop och ingen delete
-- utanför en funktion. Går att köra två gånger. Körs efter merge.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Vakten
-- ------------------------------------------------------------
do $$
declare
  f text;
  t text;
begin
  select prosrc into f from pg_proc where oid = 'public.forsta_timmen_bjuds()'::regprocedure;
  if md5(f) is distinct from '1724975cebd0bcbcdaacda7bfe321d63'
     and position('forsta_timmen_beviljad' in f) = 0 then
    raise exception 'forsta_timmen_bjuds är inte den som lästes 2026-10-09 (md5 %). Läs driften och skriv om migrationen.', md5(f);
  end if;
  select prosrc into t from pg_proc where oid = 'intern.tipstimmar_intjanade(uuid)'::regprocedure;
  if md5(t) is distinct from '6eb46a8ddbe33465a7dc3cfc97000293'
     and position('tva_timmar_hallna' in t) = 0 then
    raise exception 'tipstimmar_intjanade är inte den som lästes 2026-10-09 (md5 %). Läs driften och skriv om migrationen.', md5(t);
  end if;
  select prosrc into t from pg_proc where oid = 'public.tipskoder_lage()'::regprocedure;
  if md5(t) is distinct from 'd5b8a41ca3ff938eb85ec65fa350c10d'
     and position('tva_timmar_hallna' in t) = 0 then
    raise exception 'tipskoder_lage är inte den som lästes 2026-10-09 (md5 %). Läs driften och skriv om migrationen.', md5(t);
  end if;
end $$;


-- ------------------------------------------------------------
-- 1. Valet för en familj som betalar pass för pass
-- ------------------------------------------------------------
create table if not exists public.forsta_timmen_beviljad (
  parent_id   uuid primary key references public.profiles (id) on delete cascade,
  beviljad_av uuid references public.profiles (id) on delete set null,
  beviljad_at timestamptz not null default now()
);

comment on table public.forsta_timmen_beviljad is
  '2026-10-09. Familjer som betalar pass för pass och som vi valt att ge första timmen (Fas 19.5:s regel: '
  'det pass som gör att familjen bokat två timmar). En familj som köper en plan får timmen i planen och står '
  'inte här. Skrivs bara av ge_forsta_timmen(); högst en gratis timme per familj (intern.forsta_timmen_tagen).';

alter table public.forsta_timmen_beviljad enable row level security;

revoke all on public.forsta_timmen_beviljad from anon;
revoke insert, update, delete, truncate, references, trigger on public.forsta_timmen_beviljad from authenticated;

do $$
begin
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'forsta_timmen_beviljad'
                    and policyname = 'familjen läser sitt val') then
    create policy "familjen läser sitt val" on public.forsta_timmen_beviljad
      for select to authenticated
      using (parent_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'forsta_timmen_beviljad'
                    and policyname = 'admin läser valen') then
    create policy "admin läser valen" on public.forsta_timmen_beviljad
      for select to authenticated
      using (public.is_admin() or public.har_nagon_behorighet(array['anvandare_las', 'anvandare_redigera']));
  end if;
end $$;


-- ------------------------------------------------------------
-- 2. Timmen i planen
-- ------------------------------------------------------------
alter table public.klippkort add column if not exists forsta_timmen boolean not null default false;

comment on column public.klippkort.forsta_timmen is
  '2026-10-09. Planen fick familjens första timme: en timme till, räknad i timmar och timmar_pa_kopet. Sätts '
  'bara av intern.planens_forsta_timme() när planen blir betald, en gång per familj.';


-- Har familjen fått sin första timme, på något av sätten? Ett pass med
-- tipstimmen räknas inte (den står utanför taket), och inte heller ett
-- avbokat pass med startrabatt.
create or replace function intern.forsta_timmen_tagen(p_familj uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.bookings b
                  where b.parent_id = p_familj and b.startrabatt and b.status <> 'cancelled'
                    and b.rabattkod is distinct from 'TIPS')
      or exists (select 1 from public.klippkort k
                  where k.parent_id = p_familj and k.forsta_timmen)
$$;

revoke all on function intern.forsta_timmen_tagen(uuid) from public, anon, authenticated;


-- När en plan blir betald: den första får en timme till. Samma lås som
-- forsta_timmen_bjuds, så att ett pass och ett köp i samma stund inte
-- båda ger timmen.
create or replace function intern.planens_forsta_timme()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.sort is distinct from 'plan' or new.forsta_timmen or new.parent_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('startrabatt:' || new.parent_id::text, 0));

  if intern.forsta_timmen_tagen(new.parent_id) then
    return new;
  end if;

  new.timmar := new.timmar + 1;
  new.timmar_pa_kopet := coalesce(new.timmar_pa_kopet, 0) + 1;
  new.forsta_timmen := true;
  return new;
end $$;

revoke all on function intern.planens_forsta_timme() from public, anon, authenticated;

create or replace trigger klippkort_forsta_timmen
  before update of status on public.klippkort
  for each row
  when (new.status = 'betald' and old.status is distinct from 'betald')
  execute function intern.planens_forsta_timme();


-- ------------------------------------------------------------
-- 3. Admin väljer, och läget för en familj
-- ------------------------------------------------------------
create or replace function public.forsta_timmen_lage(p_familj uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  vem uuid := coalesce(p_familj, auth.uid());
begin
  if vem is null or (vem is distinct from auth.uid() and not public.is_admin()
                     and not public.har_nagon_behorighet(array['anvandare_las', 'anvandare_redigera'])) then
    raise exception 'Bara familjen och admin ser det här.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'beviljad', exists (select 1 from public.forsta_timmen_beviljad v where v.parent_id = vem),
    'beviljad_at', (select v.beviljad_at from public.forsta_timmen_beviljad v where v.parent_id = vem),
    'tagen', intern.forsta_timmen_tagen(vem),
    'i_planen', exists (select 1 from public.klippkort k where k.parent_id = vem and k.forsta_timmen),
    'plan_id', (select k.id from public.klippkort k where k.parent_id = vem and k.forsta_timmen
                 order by k.betald_at limit 1),
    'pa_pass', exists (select 1 from public.bookings b
                        where b.parent_id = vem and b.startrabatt and b.status <> 'cancelled'
                          and b.rabattkod is distinct from 'TIPS'));
end $$;

revoke all on function public.forsta_timmen_lage(uuid) from public, anon;
grant execute on function public.forsta_timmen_lage(uuid) to authenticated;

comment on function public.forsta_timmen_lage(uuid) is
  '2026-10-09. Om familjen (förvalt den inloggade) är vald för första timmen pass för pass, och om den fått '
  'sin första timme, i planen eller på ett pass. Familjen själv och admin.';


create or replace function public.ge_forsta_timmen(p_familj uuid, p_ja boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Bara admin väljer vem som får första timmen.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p
                  where p.id = p_familj and p.role = 'parent' and p.raderad_at is null) then
    raise exception 'Familjen finns inte.' using errcode = 'P0002';
  end if;

  if p_ja then
    insert into public.forsta_timmen_beviljad (parent_id, beviljad_av)
    values (p_familj, auth.uid())
    on conflict (parent_id) do nothing;
  else
    -- En timme som redan getts på ett pass står kvar på passet: valet
    -- gäller bara pass som föreslås efter det.
    delete from public.forsta_timmen_beviljad where parent_id = p_familj;
  end if;

  return public.forsta_timmen_lage(p_familj);
end $$;

revoke all on function public.ge_forsta_timmen(uuid, boolean) from public, anon;
grant execute on function public.ge_forsta_timmen(uuid, boolean) to authenticated;

comment on function public.ge_forsta_timmen(uuid, boolean) is
  '2026-10-09. Admin väljer om en familj som betalar pass för pass får första timmen (Fas 19.5:s regel). '
  'Högst en gratis timme per familj gäller ändå: har familjen fått timmen i en plan ges den inte på ett pass.';


-- ------------------------------------------------------------
-- 4. Timmen på passet, bara för den vi valt
-- ------------------------------------------------------------
create or replace function public.forsta_timmen_bjuds()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  fore   bigint;
  timme  bigint;
  brutto bigint;
begin
  if new.startrabatt or new.parent_id is null or not new.fakturerbar
     or new.status = 'cancelled' or new.tjanst is distinct from 'laxhjalp' then
    return new;
  end if;

  -- Två förslag samtidigt från samma familj ska inte båda få timmen, och
  -- inte heller ett förslag och ett planköp (intern.planens_forsta_timme).
  perform pg_advisory_xact_lock(hashtextextended('startrabatt:' || new.parent_id::text, 0));

  timme := coalesce(new.timpris_ore, 0)
         + case when coalesce(new.antal_barn, 1) > 1 then coalesce(new.extra_ore, 0) else 0 end;
  if timme <= 0 then
    return new;
  end if;
  brutto := round(timme * coalesce(new.duration_min, 60) / 60.0);

  -- Första timmen (Fas 19.5, sedan 2026-10-09 bara för en familj vi valt):
  -- det pass som gör att familjen bokat två timmar, en gång, och aldrig
  -- om familjen redan fått timmen i en plan. Ett pass med tipstimmen är
  -- inte den.
  if exists (select 1 from public.forsta_timmen_beviljad v where v.parent_id = new.parent_id)
     and not intern.forsta_timmen_tagen(new.parent_id) then
    select coalesce(sum(coalesce(x.duration_min, 60)), 0) into fore
      from public.bookings x
     where x.parent_id = new.parent_id and x.status <> 'cancelled'
       and x.fakturerbar and x.tjanst = 'laxhjalp';

    if fore < 120 and fore + coalesce(new.duration_min, 60) >= 120 then
      new.startrabatt := true;
      new.rabatt_ore := least(coalesce(new.rabatt_ore, 0) + timme, brutto);
      return new;
    end if;
  end if;

  -- Tipstimmen (2026-09-30): en per ny familj som anmält sig med
  -- familjens kod och haft två timmar läxhjälp (sedan 2026-10-09), en per
  -- pass. Flaggan tipstimme läses i intern.tipstimmar_intjanade.
  if new.rabattkod is null
     and intern.tipstimmar_intjanade(new.parent_id) > intern.tipstimmar_anvanda(new.parent_id) then
    new.startrabatt := true;
    new.rabattkod := 'TIPS';
    new.rabatt_ore := least(coalesce(new.rabatt_ore, 0) + timme, brutto);
  end if;

  return new;
end $$;


-- ------------------------------------------------------------
-- 5. Tipstimmen tjänas in efter två timmar
-- ------------------------------------------------------------

-- Dagen då familjen haft två timmar läxhjälp i hållna pass, eller null.
-- Hållet är som i tipsade_familjer: genomfört, med en rapport där
-- eleven inte var frånvarande. Passets bokade längd räknas: ett pass på
-- två timmar räcker, liksom två på en.
create or replace function intern.tva_timmar_hallna(p_familj uuid)
returns date
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select min(h.dag)
    from (select b.wanted_date as dag,
                 sum(coalesce(b.duration_min, 60)) over (order by b.wanted_date, b.id) as summa
            from public.bookings b
           where b.parent_id = p_familj and b.status = 'completed'
             and exists (select 1 from public.lesson_reports r
                          where r.booking_id = b.id and r.narvaro is distinct from 'franvarande')) h
   where h.summa >= 120
$$;

revoke all on function intern.tva_timmar_hallna(uuid) from public, anon, authenticated;

create or replace function intern.tipstimmar_intjanade(p_familj uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select count(*)::integer
    from public.tipskoder k
    cross join lateral intern.tipsade_familjer(k.kod) t
    cross join lateral (select intern.tva_timmar_hallna(t.kund_id) as dag) h
    left join public.flaggor f on f.kod = 'tipstimme'
   where k.person_id = p_familj and k.sort = 'familj' and h.dag is not null
     -- Står erbjudandet av räknas det som tjänades in innan det stängdes.
     and (coalesce(f.aktiv, false)
          or h.dag < (f.uppdaterad at time zone 'Europe/Stockholm')::date)
$$;


-- Adminens kodlista: forsta_pass räknar de familjer som haft två
-- timmar, samma tal som timmen på köpet tjänas in på.
create or replace function public.tipskoder_lage()
returns table(kod text, sort text, person_id uuid, namn text, aktiv boolean, created_at timestamp with time zone,
              anmalda integer, kunder integer, forsta_pass integer, timmar_anvanda integer)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Bara admin.' using errcode = '42501';
  end if;

  return query
  select k.kod, k.sort, k.person_id, k.namn, k.aktiv, k.created_at,
         (select count(*)::integer from public.leads l where l.kod = k.kod),
         (select count(*)::integer from intern.tipsade_familjer(k.kod)),
         (select count(*)::integer from intern.tipsade_familjer(k.kod) t
           where intern.tva_timmar_hallna(t.kund_id) is not null),
         case when k.sort = 'familj' then intern.tipstimmar_anvanda(k.person_id) end
    from public.tipskoder k
   order by k.created_at desc, k.kod;
end $$;


-- ------------------------------------------------------------
-- 6. Villkorens version
-- ------------------------------------------------------------
create or replace function intern.villkor_version()
returns text
language sql
immutable
set search_path = pg_temp
as $$ select '2026-10-09'::text $$;
