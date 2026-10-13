-- ============================================================
-- Koderna gäller sitt formulär, bonusen för tips är lön, och
-- tipstimmen ligger i timbanken (2026-10-13, Leo)
--
-- Leo: "i admin vyn ska du skapa en ny spalt, där ska koder synas,
-- allas personliga kod ska synas där ... blivande läxhjälpare ska bara
-- kunna använda befintliga läxhjälp[ares koder], när det sker och vi
-- tagit in de nya anställda ska den persons kod de använt få en extra
-- bonus på 300kr, betalas ut som lön. nya familjerna som använder
-- befintliga familjers koder i sin intresseanmälan, när och om de nya
-- familerna tas in i sysystemet och har haft två timmar i lektion,
-- oavsett om första var gratis eller inte, så ska familjen med koden
-- få antingen en gratis lektion eller voucher på x antal kronor, men
-- sätt voucher på en gratis timme som läggs in i timbamken. vi kan
-- komma att ändra det ... koder ska kunna skrivs in i
-- intresseanmälning och jobb ansökan och ansökning ska inte kunna
-- anvönda koder från familjer och familjer ska inte anvönda koder från
-- anställda." Och strax efter: "timmarna läggs in i timbanken för
-- familjerna och bonus redovisas som lön".
--
--
-- 1. KODEN GÄLLER SITT FORMULÄR
--
-- En familjs kod och en affischs kampanjkod gäller intresseanmälan, en
-- studiehjälpares kod gäller jobbansökan. Fel sorts kod blir null, som
-- en okänd kod: en anmälan eller ansökan fälls aldrig av en kod. Admin
-- som rättar en kod till fel sort får ett fel i stället.
--
-- Förut gällde studiehjälparens kod intresseanmälan och gav ingen
-- ersättning (2026-09-30). Ingen anmälan i driften bar en
-- studiehjälpares kod när det här skrevs (läst 2026-10-13); de som
-- skulle finnas står kvar och räknas som förut i tipskoder_lage.
--
--
-- 2. KODEN I JOBBANSÖKAN
--
-- applications.kod, prövad av intern.ansokan_tipskod(): bara en aktiv
-- kod som hör till en studiehjälpare som är godkänd i poolen. Läget
-- läses direkt i tutor_profiles: ar_godkand_studiehjalpare() svarar nej
-- för en anonym anropare. Ansökan gallras som förut, och koden går med
-- den.
--
--
-- 3. BONUSEN ÄR LÖN
--
-- 300 kr till studiehjälparen vars kod den nya studiehjälparen sökte
-- med, när vi tar in hen i poolen (tutor_profiles.status blir
-- 'approved', som Ta in i poolen och lägesväljaren på studiehjälparen
-- gör). En rad i tipsbonus, LAGRAD och inte räknad som tipstimmen: en
-- lön som är godkänd, inläst i Fortnox och betald får inte ändra sig
-- för att en ansökan gallrats eller ett konto raderats.
--
-- Ansökan hittas på adressen, som allt annat som kopplar en ansökan
-- till ett konto (gallringen, raderingen, panelens Konto): den första
-- ansökan med en studiehjälpares kod från samma adress, som inte är
-- avböjd. Tas personen in på ett konto med en annan adress ges ingen
-- bonus av sig själv.
--
-- Den nya studiehjälparen ska vara ny när hen sökte: aldrig godkänd i
-- poolen (auditloggen) och inget hållet pass innan ansökan. Annars
-- hade en tidigare studiehjälpare kunnat söka igen med en väns kod. En
-- bonus per ny studiehjälpare och per ansökan, och ingen för sin egen
-- kod.
--
-- Bonusen hör till lönen för månaden den tjänades in, som passen gör:
-- intagen i oktober betalas den 25 november. Den är inte ett pass och
-- har ingen tid, så den står inte i payouts och payout_lines (en rad
-- där kräver minuter, och underlaget skrivs bara av månadskörningen).
-- Den har ett eget läge med samma ord som underlaget, Utkast, Godkänd
-- och Utbetald, och Struken för en bonus som inte ska betalas. Löner i
-- adminvyn räknar den i Att betala ut och lägger den i lönefilen som en
-- egen lönetransaktion, antal 1, på en egen löneart
-- (foretagsfakta.lonart_tipsbonus). Vem och vad den gäller står fast;
-- admin ändrar bara läget (intern.tipsbonus_skydda).
--
-- Flaggan tipsbonus stänger av erbjudandet. En bonus tjänas in när
-- personen tas in, och det som tjänats in innan flaggan stängdes
-- betalas.
--
--
-- 4. TIPSTIMMEN LIGGER I TIMBANKEN
--
-- Regeln för när timmen tjänas in är densamma (2026-10-09): en per ny
-- familj som anmält sig med familjens kod och haft två timmar
-- läxhjälp i hållna pass, också om en av timmarna var gratis. Den
-- räknas ur raderna som förut, och den går inte ut.
--
-- Det som ändras är hur den används. Den drogs på nästa läxhjälpspass
-- familjen föreslog, före köpta timmar, och ett pass med timmen på
-- köpet kan köpta timmar inte betala (Fas 22.2). En familj med en plan
-- betalade därför resten av passet med kort medan planens timmar gick
-- ut. Nu används den som timbankens sista timme: först betalar köpta
-- timmar och sparade minuter passet, som förut, och betalar de inte
-- dras tipstimmen av på det. Den går inte ut, köpta timmar gör det.
--
-- forsta_timmen_bjuds behåller första timmen (Fas 19.5, 2026-10-09), som
-- fortfarande avgörs före timmarna, och tipstimmen flyttar till en egen
-- trigger, bookings_timmar_tips, som namnet lägger efter
-- bookings_timmar_betalar_forslaget och före bookings_timmarna_tillbaka,
-- som ska stå sist.
--
--
-- 5. ADMINENS KODLISTA
--
-- koder_lage(p_sort) är Koder i adminvyn: varje familjs eller godkänd
-- studiehjälpares kod, med hur många som använt den och vad den gett.
-- Leo: "allas personliga kod ska synas där". En kod skapades förut
-- först när personen öppnade Tipsa i sin vy; nu skapar listan de koder
-- som saknas, med samma form (intern.ny_tipskod).
--
--
-- 6. RADERINGEN
--
-- En studiehjälpare med en bonus som inte är utbetald eller struken
-- raderas inte (hindret tipsbonus), och en med en bonus alls
-- avidentifieras i stället för att tas bort, som med ett underlag:
-- raden är en del av lönen.
--
--
-- VILLKOREN säger det här under Tips, så versionen blir 2026-10-13 och
-- alla får frågan igen vid nästa inloggning (kolla-villkor.py).
--
-- forsta_timmen_bjuds, intern.leads_tipskod och mina_tips skrivs om i
-- sin helhet, med en vakt som avbryter om funktionen i databasen inte är
-- den som lästes i driften 2026-10-13 (md5 nedan).
-- intern.radering_underlag lappas med replace() och en vakt som räknar
-- träffarna. Ingen drop och ingen delete utanför en funktion. Går att
-- köra två gånger. Körs efter merge.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Vakten
-- ------------------------------------------------------------
do $$
declare
  f text;
begin
  select prosrc into f from pg_proc where oid = 'public.forsta_timmen_bjuds()'::regprocedure;
  if md5(f) is distinct from 'b253775f1af55e7770926a72b20884a9'
     and position('bookings_timmar_tips' in f) = 0 then
    raise exception 'forsta_timmen_bjuds är inte den som lästes 2026-10-13 (md5 %). Läs driften och skriv om migrationen.', md5(f);
  end if;
  select prosrc into f from pg_proc where oid = 'intern.leads_tipskod()'::regprocedure;
  if md5(f) is distinct from 'd415d0df643889c28e7e9e248f40fd0d'
     and position('jobbansökan' in f) = 0 then
    raise exception 'intern.leads_tipskod är inte den som lästes 2026-10-13 (md5 %). Läs driften och skriv om migrationen.', md5(f);
  end if;
  select prosrc into f from pg_proc where oid = 'public.mina_tips()'::regprocedure;
  if md5(f) is distinct from '46039ad23f7424f8890c6b126e7f76e1'
     and position('tipsbonus' in f) = 0 then
    raise exception 'mina_tips är inte den som lästes 2026-10-13 (md5 %). Läs driften och skriv om migrationen.', md5(f);
  end if;
end $$;


-- ------------------------------------------------------------
-- 1. Familjens och kampanjens kod gäller intresseanmälan
-- ------------------------------------------------------------
create or replace function intern.leads_tipskod()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  ren text;
begin
  if new.kod is null then
    return new;
  end if;

  -- Mellanslag och gemener är hur en kod ser ut när någon skrivit av
  -- den från en affisch. Samma kod, inte en annan.
  ren := upper(regexp_replace(new.kod, '[[:space:]]', '', 'g'));

  if tg_op = 'UPDATE' then
    -- Admin rättar en kod: formen prövas här, att den finns prövas av
    -- den främmande nyckeln, med ett fel admin ser. En kaskad från en
    -- kampanjkod som bytt stavning går igenom oförändrad.
    new.kod := case when ren ~ '^[A-Z0-9][A-Z0-9-]{2,23}$' then ren end;
    -- 2026-10-13: en studiehjälpares kod gäller jobbansökan.
    if new.kod is distinct from old.kod
       and exists (select 1 from public.tipskoder t where t.kod = new.kod and t.sort = 'studiehjalpare') then
      raise exception using errcode = '23514',
        message = 'Koden är en studiehjälpares. Den gäller jobbansökan, inte intresseanmälan.';
    end if;
    return new;
  end if;

  -- En familjs kod eller en kampanjkod. En studiehjälpares kod gäller
  -- jobbansökan (2026-10-13) och blir null, som en okänd kod.
  if ren !~ '^[A-Z0-9][A-Z0-9-]{2,23}$'
     or not exists (select 1 from public.tipskoder t
                     where t.kod = ren and t.aktiv and t.sort in ('familj', 'kampanj')) then
    new.kod := null;
  else
    new.kod := ren;
  end if;
  return new;
end $$;

revoke execute on function intern.leads_tipskod() from public, anon, authenticated;


-- ------------------------------------------------------------
-- 2. Koden i jobbansökan
-- ------------------------------------------------------------
alter table public.applications add column if not exists kod text;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.applications'::regclass and conname = 'applications_kod_fkey') then
    -- on delete set null: koden försvinner med sin person (profiles on
    -- delete cascade, och profiles_tipskod_raderas), och ansökan står kvar.
    alter table public.applications add constraint applications_kod_fkey
      foreign key (kod) references public.tipskoder (kod) on update cascade on delete set null;
  end if;
end $$;

create index if not exists applications_kod_idx on public.applications (kod) where kod is not null;

comment on column public.applications.kod is
  '2026-10-13. Koden den sökande skrev i jobbansökan: en godkänd studiehjälpares tipskod. Prövas av '
  'intern.ansokan_tipskod(): en okänd kod, eller en familjs eller kampanjs, blir null, och ansökan går in ändå. '
  'Gallras med ansökan.';

create or replace function intern.ansokan_tipskod()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ren text;
begin
  if new.kod is null then
    return new;
  end if;

  ren := upper(regexp_replace(new.kod, '[[:space:]]', '', 'g'));

  if tg_op = 'UPDATE' then
    new.kod := case when ren ~ '^[A-Z0-9][A-Z0-9-]{2,23}$' then ren end;
    if new.kod is distinct from old.kod and new.kod is not null
       and not exists (select 1 from public.tipskoder t where t.kod = new.kod and t.sort = 'studiehjalpare') then
      raise exception using errcode = '23514',
        message = 'Bara en studiehjälpares kod gäller jobbansökan.';
    end if;
    return new;
  end if;

  -- En studiehjälpare som är godkänd i poolen, med en kod som inte är
  -- avstängd. Läget läses här: ar_godkand_studiehjalpare() svarar nej
  -- för en anonym anropare.
  if ren !~ '^[A-Z0-9][A-Z0-9-]{2,23}$'
     or not exists (select 1 from public.tipskoder t
                      join public.tutor_profiles tp on tp.id = t.person_id
                     where t.kod = ren and t.aktiv and t.sort = 'studiehjalpare'
                       and tp.status = 'approved') then
    new.kod := null;
  else
    new.kod := ren;
  end if;
  return new;
end $$;

revoke all on function intern.ansokan_tipskod() from public, anon, authenticated;

-- Namnet gör att den kör efter applications_skydda (namnordning).
create or replace trigger applications_tipskod
  before insert or update of kod on public.applications
  for each row execute function intern.ansokan_tipskod();


-- ------------------------------------------------------------
-- 3. Bonusen
-- ------------------------------------------------------------

-- Beloppet, i ören. Ändras det ska villkoren (#tips) ändras samtidigt.
create or replace function intern.tipsbonus_ore()
returns integer
language sql
immutable
set search_path = pg_temp
as $$ select 30000 $$;

revoke all on function intern.tipsbonus_ore() from public, anon, authenticated;

create table if not exists public.tipsbonus (
  id                   uuid primary key default gen_random_uuid(),
  -- Den vars kod användes, och som får bonusen i lönen.
  studiehjalpare_id    uuid not null references public.profiles (id) on delete restrict,
  -- Den som togs in. Null när kontot tagits bort; bonusen står kvar.
  ny_studiehjalpare_id uuid references public.profiles (id) on delete set null,
  -- Ansökan med koden. Null när den gallrats; bonusen står kvar.
  ansokan_id           uuid references public.applications (id) on delete set null,
  belopp_ore           integer not null,
  -- Lönemånaden, som payouts.period: månaden den tjänades in.
  period               date not null,
  status               text not null default 'utkast',
  intjanad_at          timestamptz not null default now(),
  godkand_at           timestamptz,
  utbetald_at          timestamptz,
  created_at           timestamptz not null default now(),
  constraint tipsbonus_belopp check (belopp_ore > 0),
  constraint tipsbonus_period check (period = date_trunc('month', period)::date),
  constraint tipsbonus_status check (status in ('utkast', 'godkand', 'utbetald', 'struken')),
  constraint tipsbonus_inte_egen check (ny_studiehjalpare_id is distinct from studiehjalpare_id)
);

comment on table public.tipsbonus is
  '2026-10-13. Bonusen för tips: 300 kr i lön till studiehjälparen vars kod en ny studiehjälpare sökte med, '
  'när den nya tas in i poolen. Skrivs bara av intern.tipsbonus_vid_intag(); admin ändrar läget under Löner. '
  'Lönemånaden är period, och lönefilen tar den som en egen rad (foretagsfakta.lonart_tipsbonus).';

create unique index if not exists tipsbonus_en_per_ny on public.tipsbonus (ny_studiehjalpare_id)
  where ny_studiehjalpare_id is not null;
create unique index if not exists tipsbonus_en_per_ansokan on public.tipsbonus (ansokan_id)
  where ansokan_id is not null;
create index if not exists tipsbonus_studiehjalpare on public.tipsbonus (studiehjalpare_id, period);

alter table public.tipsbonus enable row level security;

-- Ingen skriver en rad härifrån: ingen insert- och ingen delete-policy,
-- som payouts. Admin uppdaterar läget, och triggern nedan låter inget
-- annat ändras.
revoke all on public.tipsbonus from anon;
revoke insert, delete, truncate, references, trigger on public.tipsbonus from authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tipsbonus'
                    and policyname = 'studiehjälparen läser sin bonus') then
    create policy "studiehjälparen läser sin bonus" on public.tipsbonus
      for select to authenticated using (studiehjalpare_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tipsbonus'
                    and policyname = 'admin läser bonusarna') then
    create policy "admin läser bonusarna" on public.tipsbonus
      for select to authenticated using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tipsbonus'
                    and policyname = 'admin ändrar läget') then
    create policy "admin ändrar läget" on public.tipsbonus
      for update to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- Admin ändrar bara läget, och stämplarna följer det. Nycklarna får bli
-- null (främmande nycklarnas on delete set null körs i den sessionen som
-- tar bort kontot eller ansökan), men aldrig peka om.
create or replace function intern.tipsbonus_skydda()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.id := old.id;
  new.studiehjalpare_id := old.studiehjalpare_id;
  if new.ny_studiehjalpare_id is not null then
    new.ny_studiehjalpare_id := old.ny_studiehjalpare_id;
  end if;
  if new.ansokan_id is not null then
    new.ansokan_id := old.ansokan_id;
  end if;
  new.belopp_ore := old.belopp_ore;
  new.period := old.period;
  new.intjanad_at := old.intjanad_at;
  new.created_at := old.created_at;

  if new.status is distinct from old.status then
    new.godkand_at := case when new.status in ('godkand', 'utbetald') then coalesce(old.godkand_at, now()) end;
    new.utbetald_at := case when new.status = 'utbetald' then coalesce(old.utbetald_at, now()) end;
  else
    new.godkand_at := old.godkand_at;
    new.utbetald_at := old.utbetald_at;
  end if;
  return new;
end $$;

revoke all on function intern.tipsbonus_skydda() from public, anon, authenticated;

create or replace trigger tipsbonus_skydda
  before update on public.tipsbonus
  for each row execute function intern.tipsbonus_skydda();

-- Bonusen styr pengar och hör till auditloggen. Inga namn, bara nycklar.
create or replace trigger tipsbonus_audit
  after insert or update or delete on public.tipsbonus
  for each row execute function public.logga_andring(
    'tipsbonus', 'id', 'studiehjalpare_id', 'ny_studiehjalpare_id', 'ansokan_id', 'status', 'belopp_ore', 'period');

-- Strömbrytaren. Står den av ges ingen bonus för den som tas in efter det.
insert into public.flaggor (kod, aktiv, beskrivning, vantar_pa) values
  ('tipsbonus', true,
   'En studiehjälpare får 300 kr i lön när vi tar in någon som sökt jobb med hens kod.',
   'Villkoren (#tips, båda språken) säger att bonusen ges. Stängs den av ska villkoren ändras i samma veva. Bonusar som tjänats in innan dess betalas ändå.')
on conflict (kod) do nothing;

-- När en studiehjälpare tas in i poolen: bonusen till den vars kod hen
-- sökte med.
create or replace function intern.tipsbonus_vid_intag()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  epost text;
  a     record;
begin
  if not coalesce((select f.aktiv from public.flaggor f where f.kod = 'tipsbonus'), false)
     or exists (select 1 from public.tipsbonus t where t.ny_studiehjalpare_id = new.id) then
    return null;
  end if;

  select p.email into epost from public.profiles p where p.id = new.id and p.raderad_at is null;
  if epost is null then
    return null;
  end if;

  -- Den första ansökan med en studiehjälpares kod, från samma adress.
  select x.id, x.created_at, k.person_id into a
    from public.applications x
    join public.tipskoder k on k.kod = x.kod and k.sort = 'studiehjalpare'
   where intern.epost_nyckel(x.email) = intern.epost_nyckel(epost)
     and x.status <> 'rejected'
     and k.person_id is distinct from new.id
   order by x.created_at, x.id
   limit 1;
  if not found then
    return null;
  end if;

  -- Ny när hen sökte: aldrig godkänd i poolen, och inget hållet pass.
  if exists (select 1 from public.audit_logg l
              where l.tabell = 'tutor_profiles' and l.objekt_id = new.id::text
                and l.efter ->> 'status' = 'approved' and l.tid < a.created_at)
     or exists (select 1 from public.bookings b
                 where b.tutor_id = new.id and b.status = 'completed'
                   and b.wanted_date < (a.created_at at time zone 'Europe/Stockholm')::date) then
    return null;
  end if;

  insert into public.tipsbonus (studiehjalpare_id, ny_studiehjalpare_id, ansokan_id, belopp_ore, period)
  values (a.person_id, new.id, a.id, intern.tipsbonus_ore(),
          date_trunc('month', now() at time zone 'Europe/Stockholm')::date)
  on conflict do nothing;
  return null;
end $$;

revoke all on function intern.tipsbonus_vid_intag() from public, anon, authenticated;

-- Efter tutor_profiles_audit (namnordning): auditraden för det här
-- godkännandet finns redan, med en tid efter ansökan.
create or replace trigger tutor_profiles_tipsbonus
  after update of status on public.tutor_profiles
  for each row
  when (new.status = 'approved' and old.status is distinct from 'approved')
  execute function intern.tipsbonus_vid_intag();


-- ------------------------------------------------------------
-- 4. Lönearten för bonusen
-- ------------------------------------------------------------
alter table public.foretagsfakta add column if not exists lonart_tipsbonus text;

comment on column public.foretagsfakta.lonart_tipsbonus is
  '2026-10-13. Lönearten i Fortnox Lön för bonusen för tips. Lönefilen skriver bonusen på den, antal 1, och '
  'inte som timmar på timlönens löneart.';

create or replace trigger foretagsfakta_audit
  after update on public.foretagsfakta
  for each row execute function public.logga_andring(
    'bolagsfakta', 'id', 'organisationsnummer', 'bolagsform', 'rakenskapsar_slut', 'momsregistrerad', 'momsperiod',
    'f_skatt', 'arbetsgivarregistrerad', 'studiehjalpare_form', 'bokforingssystem', 'lonart_timlon',
    'lonart_tipsbonus');


-- ------------------------------------------------------------
-- 5. Tipstimmen i timbanken
-- ------------------------------------------------------------

-- Första timmen, som förut. Tipstimmen står i bookings_timmar_tips.
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
  -- inte den. Tipstimmen dras sedan 2026-10-13 i bookings_timmar_tips,
  -- efter timmarna.
  if exists (select 1 from public.forsta_timmen_beviljad v where v.parent_id = new.parent_id)
     and not intern.forsta_timmen_tagen(new.parent_id) then
    select coalesce(sum(coalesce(x.duration_min, 60)), 0) into fore
      from public.bookings x
     where x.parent_id = new.parent_id and x.status <> 'cancelled'
       and x.fakturerbar and x.tjanst = 'laxhjalp';

    if fore < 120 and fore + coalesce(new.duration_min, 60) >= 120 then
      new.startrabatt := true;
      new.rabatt_ore := least(coalesce(new.rabatt_ore, 0) + timme, brutto);
    end if;
  end if;

  return new;
end $$;

-- Tipstimmen är timbankens sista timme: den dras av på ett läxhjälpspass
-- som köpta timmar och sparade minuter inte betalat, en timme per pass,
-- till passets eget timpris. Samma lås som första timmen.
create or replace function intern.tipstimmen_dras()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  timme  bigint;
  brutto bigint;
begin
  if new.startrabatt or new.parent_id is null or not new.fakturerbar
     or new.status = 'cancelled' or new.tjanst is distinct from 'laxhjalp'
     or new.rabattkod is not null
     -- Timmarna har redan betalat passet (bookings_timmar_betalar_forslaget).
     or new.klippkort_id is not null
     or coalesce(new.betalning_status, 'ingen') not in ('ingen', 'vantar', 'misslyckad') then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('startrabatt:' || new.parent_id::text, 0));

  timme := coalesce(new.timpris_ore, 0)
         + case when coalesce(new.antal_barn, 1) > 1 then coalesce(new.extra_ore, 0) else 0 end;
  if timme <= 0 then
    return new;
  end if;
  brutto := round(timme * coalesce(new.duration_min, 60) / 60.0);

  -- Flaggan tipstimme läses i intern.tipstimmar_intjanade.
  if intern.tipstimmar_intjanade(new.parent_id) > intern.tipstimmar_anvanda(new.parent_id) then
    new.startrabatt := true;
    new.rabattkod := 'TIPS';
    new.rabatt_ore := least(coalesce(new.rabatt_ore, 0) + timme, brutto);
  end if;
  return new;
end $$;

revoke all on function intern.tipstimmen_dras() from public, anon, authenticated;

-- Efter bookings_timmar_betalar_forslaget och före bookings_timmarna_tillbaka
-- (namnordning: "timmar_t" efter "timmar_b", "timmar_" före "timmarna").
create or replace trigger bookings_timmar_tips
  before insert on public.bookings
  for each row execute function intern.tipstimmen_dras();


-- ------------------------------------------------------------
-- 6. Koderna skapas på ett ställe
-- ------------------------------------------------------------

-- Personens kod, skapad om den saknas. Sex tecken ur 32, utan I, O, 0 och
-- 1: koden skrivs av från en skärm eller sägs i telefon. Inget namn i
-- koden: den delas öppet.
create or replace function intern.ny_tipskod(p_person uuid, p_sort text)
returns public.tipskoder
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  alfabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  k       public.tipskoder;
  ny      text;
  forsok  integer := 0;
begin
  select * into k from public.tipskoder where person_id = p_person;
  if found then
    return k;
  end if;
  loop
    ny := '';
    for i in 1..6 loop
      ny := ny || substr(alfabet, 1 + floor(random() * 32)::integer, 1);
    end loop;
    begin
      insert into public.tipskoder (kod, sort, person_id) values (ny, p_sort, p_person) returning * into k;
      return k;
    exception when unique_violation then
      -- Samma kod fanns, eller ett annat anrop hann skapa personens.
      select * into k from public.tipskoder where person_id = p_person;
      if found then
        return k;
      end if;
      forsok := forsok + 1;
      if forsok > 20 then
        raise;
      end if;
    end;
  end loop;
end $$;

revoke all on function intern.ny_tipskod(uuid, text) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 7. Den inloggades kod, och vad den gett
-- ------------------------------------------------------------

-- Svarar med antal, aldrig med vilka. Familjen ser timmarna i
-- timbanken; studiehjälparen hur många som sökt jobb med koden, hur
-- många vi tagit in och bonusen.
create or replace function public.mina_tips()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  jag     uuid := auth.uid();
  p       public.profiles;
  k       public.tipskoder;
  s       text;
  timmar  integer;
  anvanda integer;
begin
  if jag is null then
    raise exception 'Logga in först.' using errcode = '42501';
  end if;

  select * into p from public.profiles where id = jag;
  if not found or p.raderad_at is not null then
    raise exception 'Kontot finns inte.' using errcode = '42501';
  end if;

  if p.role = 'parent' then
    s := 'familj';
  elsif p.role = 'tutor' and public.ar_godkand_studiehjalpare(jag) then
    s := 'studiehjalpare';
  else
    raise exception 'Bara familjer och godkända studiehjälpare har en kod.' using errcode = '42501';
  end if;

  k := intern.ny_tipskod(jag, s);

  if k.sort = 'familj' then
    timmar := intern.tipstimmar_intjanade(jag);
    anvanda := intern.tipstimmar_anvanda(jag);
    return jsonb_build_object(
      'kod', k.kod,
      'sort', k.sort,
      'aktiv', k.aktiv,
      'anmalda', (select count(*) from public.leads l where l.kod = k.kod),
      'kunder', (select count(*) from intern.tipsade_familjer(k.kod)),
      'timmar', timmar,
      'anvanda', anvanda,
      'kvar', greatest(timmar - anvanda, 0),
      'timme_ges', coalesce((select f.aktiv from public.flaggor f where f.kod = 'tipstimme'), false)
    );
  end if;

  -- Studiehjälparen (2026-10-13): koden gäller jobbansökan, och bonusen
  -- är lön. Raderna i tipsbonus läser hen själv; här står summorna.
  return jsonb_build_object(
    'kod', k.kod,
    'sort', k.sort,
    'aktiv', k.aktiv,
    'ansokningar', (select count(*) from public.applications a where a.kod = k.kod),
    'intagna', (select count(*) from public.tipsbonus b where b.studiehjalpare_id = jag and b.status <> 'struken'),
    'bonus_ore', (select coalesce(sum(b.belopp_ore), 0) from public.tipsbonus b
                   where b.studiehjalpare_id = jag and b.status <> 'struken'),
    'bonus_utbetald_ore', (select coalesce(sum(b.belopp_ore), 0) from public.tipsbonus b
                            where b.studiehjalpare_id = jag and b.status = 'utbetald'),
    'bonus_ges', coalesce((select f.aktiv from public.flaggor f where f.kod = 'tipsbonus'), false),
    'bonus_belopp_ore', intern.tipsbonus_ore()
  );
end $$;

revoke execute on function public.mina_tips() from public, anon;
grant execute on function public.mina_tips() to authenticated;


-- ------------------------------------------------------------
-- 8. Adminens kodlista, Koder i adminvyn
-- ------------------------------------------------------------
create or replace function public.koder_lage(p_sort text)
returns table (person_id uuid, kod text, aktiv boolean, kod_skapad timestamptz,
               anvanda integer, kunder integer, belonade integer, timmar_anvanda integer,
               bonus_ore bigint, bonus_utbetald_ore bigint)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Bara admin.' using errcode = '42501';
  end if;
  if p_sort is null or p_sort not in ('familj', 'studiehjalpare') then
    raise exception 'Välj familjer eller studiehjälpare.' using errcode = '22023';
  end if;

  -- Allas kod: den som inte öppnat Tipsa i sin vy får sin kod nu, med
  -- samma form som mina_tips() hade gett den. Ett adminkonto har ofta
  -- rollen parent men är ingen familj, och får ingen kod härifrån.
  perform intern.ny_tipskod(p.id, p_sort)
     from public.profiles p
    where p.raderad_at is null
      and not intern.har_adminroll(p.id)
      and not exists (select 1 from public.tipskoder t where t.person_id = p.id)
      and case when p_sort = 'familj' then p.role = 'parent'
               else p.role = 'tutor'
                    and exists (select 1 from public.tutor_profiles tp where tp.id = p.id and tp.status = 'approved')
          end;

  -- Familjer: anvanda är anmälningarna med koden, kunder de nya familjer
  -- som blivit kunder, belonade de som haft två timmar (en timme var i
  -- timbanken). Studiehjälpare: anvanda är ansökningarna, kunder och
  -- belonade de vi tagit in, med bonusen som inte är struken.
  return query
  select k.person_id, k.kod, k.aktiv, k.created_at,
         case when k.sort = 'familj'
              then (select count(*)::integer from public.leads l where l.kod = k.kod)
              else (select count(*)::integer from public.applications a where a.kod = k.kod) end,
         case when k.sort = 'familj'
              then (select count(*)::integer from intern.tipsade_familjer(k.kod))
              else (select count(*)::integer from public.tipsbonus b
                     where b.studiehjalpare_id = k.person_id and b.status <> 'struken') end,
         case when k.sort = 'familj'
              then (select count(*)::integer from intern.tipsade_familjer(k.kod) t
                     where intern.tva_timmar_hallna(t.kund_id) is not null)
              else (select count(*)::integer from public.tipsbonus b
                     where b.studiehjalpare_id = k.person_id and b.status <> 'struken') end,
         case when k.sort = 'familj' then intern.tipstimmar_anvanda(k.person_id) end,
         case when k.sort = 'studiehjalpare'
              then (select coalesce(sum(b.belopp_ore), 0)::bigint from public.tipsbonus b
                     where b.studiehjalpare_id = k.person_id and b.status <> 'struken') end,
         case when k.sort = 'studiehjalpare'
              then (select coalesce(sum(b.belopp_ore), 0)::bigint from public.tipsbonus b
                     where b.studiehjalpare_id = k.person_id and b.status = 'utbetald') end
    from public.tipskoder k
   where k.sort = p_sort
   order by k.created_at, k.kod;
end $$;

revoke all on function public.koder_lage(text) from public, anon;
grant execute on function public.koder_lage(text) to authenticated;

comment on function public.koder_lage(text) is
  '2026-10-13. Koder i adminvyn: varje familjs eller godkänd studiehjälpares kod, med hur många som använt den '
  'och vad den gett. Skapar de koder som saknas. Bara admin.';


-- ------------------------------------------------------------
-- 9. Raderingen: en bonus är lön
-- ------------------------------------------------------------
do $$
declare
  def text;
  n   int;
  hinder_gammal constant text := E'    hinder := hinder || intern.radering_rad(''kommande_betalda'', n, m);\n';
  hinder_ny     constant text := E'    hinder := hinder || intern.radering_rad(''kommande_betalda'', n, m);\n'
    || E'\n    -- Bonusen för tips (2026-10-13) är lön som inte är betald än.\n'
    || E'    select count(*), coalesce(sum(t.belopp_ore), 0) into n, m from public.tipsbonus t\n'
    || E'     where t.studiehjalpare_id = p_id and t.status in (''utkast'', ''godkand'');\n'
    || E'    hinder := hinder || intern.radering_rad(''tipsbonus'', n, m);\n';
  satt_gammal constant text := E'       or exists (select 1 from public.payouts u where u.tutor_id = p_id)\n';
  satt_ny     constant text := E'       or exists (select 1 from public.payouts u where u.tutor_id = p_id)\n'
    || E'       or exists (select 1 from public.tipsbonus t where t.studiehjalpare_id = p_id)\n';
  -- Står kvar: annars säger rutan inget om varför kontot avidentifieras
  -- när bonusen är det enda bokföringen behöver.
  kvar_gammal constant text := E'        ''underlag'', (select count(*) from public.payouts u where u.tutor_id = p_id),\n';
  kvar_ny     constant text := E'        ''underlag'', (select count(*) from public.payouts u where u.tutor_id = p_id),\n'
    || E'        ''tipsbonus'', (select count(*) from public.tipsbonus t where t.studiehjalpare_id = p_id),\n';
begin
  def := pg_get_functiondef('intern.radering_underlag(text, uuid)'::regprocedure);
  if position('public.tipsbonus' in def) > 0 then
    raise notice 'radering_underlag är redan lappad.';
    return;
  end if;
  n := (length(def) - length(replace(def, hinder_gammal, ''))) / length(hinder_gammal);
  if n <> 1 then
    raise exception 'radering_underlag: kommande_betalda hittades % gånger, väntat en. Läs driften.', n;
  end if;
  n := (length(def) - length(replace(def, satt_gammal, ''))) / length(satt_gammal);
  if n <> 1 then
    raise exception 'radering_underlag: payouts-raden hittades % gånger, väntat en. Läs driften.', n;
  end if;
  n := (length(def) - length(replace(def, kvar_gammal, ''))) / length(kvar_gammal);
  if n <> 1 then
    raise exception 'radering_underlag: underlagsraden hittades % gånger, väntat en. Läs driften.', n;
  end if;
  execute replace(replace(replace(def, hinder_gammal, hinder_ny), satt_gammal, satt_ny), kvar_gammal, kvar_ny);
end $$;


-- ------------------------------------------------------------
-- 10. Villkorens version
-- ------------------------------------------------------------
create or replace function intern.villkor_version()
returns text
language sql
immutable
set search_path = pg_temp
as $$ select '2026-10-13'::text $$;
