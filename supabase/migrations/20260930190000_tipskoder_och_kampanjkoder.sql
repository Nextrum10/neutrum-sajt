-- ============================================================
-- NEXTRUM — tipskoder och kampanjkoder
--
-- Leo 2026-09-30, två saker ur samma analys:
--   · "Värvningslänk för familjer och studiehjälpare": en kod per
--     person, så att vi vet vem som tog in en familj, och en timme på
--     köpet till familjen som tipsade. Inga pengar till studiehjälparen:
--     de är ofta sexton, en belöning för att värva kunder är lön, och
--     anställningsformen är inte avgjord (CLAUDE.md avsnitt 11).
--   · Affischer med QR-kod på några ställen: en kod per affisch, så att
--     det går att se vilket ställe som ger anmälningar.
--
-- EN KOD, TVÅ SORTER. Samma fält i anmälan bär båda, för en familj
-- som skriver av en kod från en affisch och en som fått en länk av en
-- vän gör samma sak. tipskoder har en rad per kod: 'familj' och
-- 'studiehjalpare' hör till en person, 'kampanj' har ett namn i
-- stället ("Affisch Farsta bibliotek"). leads.kod pekar på raden.
--
-- KODEN SYNS I FORMULÄRET, DEN LAGRAS INTE I WEBBLÄSAREN. Länken och
-- QR-koden går direkt till intresseanmälan med ?kod=, och formuläret
-- fyller i ett fält som familjen ser och kan tömma. Ingen
-- sessionStorage, ingen kaka: källspårningen kräver samtycke
-- (CLAUDE.md avsnitt 6, Samtycket), och rutan är avstängd. Det familjen
-- själv skickar in i ett formulär är något annat än det webbläsaren
-- minns åt oss.
--
-- EN OKÄND KOD FÄLLER ALDRIG EN ANMÄLAN. intern.leads_tipskod() gör om
-- en kod som inte finns, eller inte är aktiv, till null innan
-- främmande nyckeln prövas. En familj som skrivit fel ska ändå komma
-- fram.
--
-- TIMMEN PÅ KÖPET är samma sak som prissidans första timme (Fas 19.5):
-- rabatt_ore på ett pass, till passets eget timpris, och startrabatt =
-- true. Allt som redan vet att ett sådant pass inte betalas med köpta
-- timmar eller timbanken (intern.timmar_betala, klippkort_dra,
-- timbank_dra, vyerna), att noll kronor inte är obetalt, och hur
-- priset visas, gäller då utan att skrivas om. Det som skiljer
-- tipstimmen är rabattkod = 'TIPS'. Den kolumnen skyddas redan av
-- skydda_rabatt: en vy kan inte sätta den vid insert (koden prövas mot
-- rabattkoder, och raden 'TIPS' kan aldrig vara aktiv, se villkoret
-- nedan) och inte ändra den efteråt.
--
-- Regeln, i forsta_timmen_bjuds():
--   · en timme per familj som anmält sig med familjens kod och sedan
--     haft sitt första pass (genomfört, med en rapport där eleven inte
--     var frånvarande). Ingen tid räknas förrän passet hållits: en
--     anmälan är inte en kund.
--   · familjen måste ha varit ny när den anmälde sig: inget hållet pass
--     före anmälan. Annars hade en befintlig familj kunnat skicka en
--     anmälan till för ett syskon med en väns kod.
--   · bara familjens FÖRSTA anmälan med en kod räknas, så två familjer
--     kan inte få en timme var för samma nya familj.
--   · timmen dras på nästa läxhjälpspass familjen föreslår, en timme
--     per pass. Avbokas passet kommer timmen tillbaka, som första
--     timmen gör. Prissidans första timme går först.
--   · den räknas ur raderna varje gång och sparas inte. En tabell med
--     tjänade timmar hade kunnat säga något annat än passen.
--   · flaggan tipstimme stänger av erbjudandet. Det som tjänats in
--     innan den stängdes ges ändå: villkoren lovade timmen, och ett
--     löfte som kan dras tillbaka i efterhand är inget löfte. Gränsen
--     är flaggans uppdaterad, som stampla_flaggan sätter och bara en
--     ändring av aktiv kan flytta. Koderna och räkningen av
--     anmälningar fortsätter.
--
-- forsta_timmen_bjuds skrivs om i sin helhet, med en vakt som avbryter
-- om funktionen i databasen inte är Fas 19.5:s (md5 läst i driften
-- 2026-09-30). Migrationen går att köra två gånger.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Koderna
-- ------------------------------------------------------------
create table if not exists public.tipskoder (
  kod        text primary key,
  sort       text not null,
  person_id  uuid unique references public.profiles(id) on delete cascade,
  namn       text,
  aktiv      boolean not null default true,
  created_at timestamptz not null default now(),
  -- Samma form som rabattkoderna: versaler, siffror och bindestreck.
  -- Inget å, ä eller ö: koden står på en affisch och ska gå att skriva
  -- av på vilket tangentbord som helst.
  constraint tipskoder_kod_form check (kod ~ '^[A-Z0-9][A-Z0-9-]{2,23}$'),
  constraint tipskoder_sort_check check (sort in ('familj', 'studiehjalpare', 'kampanj')),
  constraint tipskoder_namn_langd check (namn is null or char_length(namn) between 1 and 80),
  -- En personkod hör till en person och har inget namn: namnet står i
  -- profiles, och en kopia hade inte följt med när personen raderas.
  constraint tipskoder_person_eller_kampanj check (
    (sort = 'kampanj' and person_id is null and namn is not null)
    or (sort <> 'kampanj' and person_id is not null and namn is null))
);

comment on table public.tipskoder is
  'Koder i intresseanmälan: en per familj och godkänd studiehjälpare (skapas av mina_tips()) '
  'och en per kampanj, till exempel en affisch (skapas av admin). leads.kod pekar hit. '
  'Tas aldrig bort från en vy: en kod som inte ska användas stängs av med aktiv.';

alter table public.tipskoder enable row level security;

drop policy if exists "personen läser sin kod" on public.tipskoder;
create policy "personen läser sin kod" on public.tipskoder
  for select to authenticated using (person_id = auth.uid());

drop policy if exists "admin läser koderna" on public.tipskoder;
create policy "admin läser koderna" on public.tipskoder
  for select to authenticated using (public.is_admin());

-- Admin skapar bara kampanjkoder. En personkod skapas av mina_tips(),
-- åt personen själv, så att ingen kod hör till någon som inte vet om den.
drop policy if exists "admin skapar kampanjkoder" on public.tipskoder;
create policy "admin skapar kampanjkoder" on public.tipskoder
  for insert to authenticated with check (public.is_admin() and sort = 'kampanj');

drop policy if exists "admin ändrar koderna" on public.tipskoder;
create policy "admin ändrar koderna" on public.tipskoder
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.tipskoder from anon;

-- ------------------------------------------------------------
-- 2. Koden på anmälan
--
-- En främmande nyckel, så att en kod som försvinner med sin person
-- (profiles on delete cascade) tar med sig kopplingen och inte lämnar
-- ett namn på en person som inte finns. on update cascade för den dag
-- en kampanjkod byter stavning.
-- ------------------------------------------------------------
alter table public.leads add column if not exists kod text;

alter table public.leads drop constraint if exists leads_kod_fkey;
alter table public.leads add constraint leads_kod_fkey
  foreign key (kod) references public.tipskoder(kod) on update cascade on delete set null;

create index if not exists leads_kod_idx on public.leads (kod) where kod is not null;

comment on column public.leads.kod is
  'Koden familjen skickade med anmälan: en familjs eller studiehjälpares tipskod, eller en '
  'kampanjkod. Prövas av intern.leads_tipskod(): en okänd eller avstängd kod blir null, och '
  'anmälan går in ändå.';

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
    return new;
  end if;

  if ren !~ '^[A-Z0-9][A-Z0-9-]{2,23}$'
     or not exists (select 1 from public.tipskoder t where t.kod = ren and t.aktiv) then
    new.kod := null;
  else
    new.kod := ren;
  end if;
  return new;
end $$;

revoke execute on function intern.leads_tipskod() from public, anon, authenticated;

-- Namnet gör att den kör efter leads_skydda (namnordning).
drop trigger if exists leads_tipskod on public.leads;
create trigger leads_tipskod
  before insert or update of kod on public.leads
  for each row execute function intern.leads_tipskod();

-- ------------------------------------------------------------
-- 3. Vilka familjer en kod tagit in, och timmarna
-- ------------------------------------------------------------

-- Ett hållet pass: genomfört, med en rapport där eleven inte var
-- frånvarande. Samma som NexLäx-serien räknar (Fas 23.2).
create or replace function intern.tipsade_familjer(p_kod text)
returns table (kund_id uuid, anmald_at timestamptz, forsta_pass date)
language sql
stable
security definer
set search_path to 'public'
as $$
  with forsta_koden as (
    -- Familjens första anmälan med en kod. En familj som fått koder av
    -- två andra ger en timme, inte två.
    select distinct on (l.kund_id) l.kund_id, l.kod, l.created_at
      from public.leads l
     where l.kund_id is not null and l.kod is not null
     order by l.kund_id, l.created_at, l.id
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
$$;

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
    left join public.flaggor f on f.kod = 'tipstimme'
   where k.person_id = p_familj and k.sort = 'familj' and t.forsta_pass is not null
     -- Står erbjudandet av räknas det som tjänades in innan det stängdes.
     and (coalesce(f.aktiv, false)
          or t.forsta_pass < (f.uppdaterad at time zone 'Europe/Stockholm')::date)
$$;

-- Timmar som ligger på ett pass som inte är avbokat. Ett avbokat pass
-- lämnar tillbaka sin timme, som första timmen gör.
create or replace function intern.tipstimmar_anvanda(p_familj uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select count(*)::integer
    from public.bookings b
   where b.parent_id = p_familj and b.rabattkod = 'TIPS' and b.status <> 'cancelled'
$$;

revoke execute on function intern.tipsade_familjer(text) from public, anon, authenticated;
revoke execute on function intern.tipstimmar_intjanade(uuid) from public, anon, authenticated;
revoke execute on function intern.tipstimmar_anvanda(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 4. Strömbrytaren
-- ------------------------------------------------------------
insert into public.flaggor (kod, aktiv, beskrivning, vantar_pa) values
  ('tipstimme', true,
   'En familj får en timme på köpet för varje ny familj som anmält sig med familjens kod och haft sitt första pass.',
   'Villkoren (#tips, båda språken) säger att timmen ges. Stängs den av ska villkoren ändras i samma veva. Timmar som tjänats in innan dess ges ändå.')
on conflict (kod) do nothing;

-- 'TIPS' är markeringen på ett pass med tipstimmen. bookings.rabattkod
-- pekar på rabattkoder, så raden måste finnas, och den får aldrig bli
-- aktiv: då hade en familj kunnat skriva in den själv i ett förslag.
-- kolla_rabattkod() nekar en kod som inte är aktiv, och skydda_rabatt
-- nollar den. antal_anvandningar räknas upp av rakna_rabattkod för
-- varje pass som fått timmen, också avbokade.
insert into public.rabattkoder (kod, beskrivning, typ, varde, aktiv)
values ('TIPS', 'Markerar ett pass med en timme på köpet för ett tips (2026-09-30). '
          || 'Ges av forsta_timmen_bjuds, aldrig av en kod någon skriver in. Kan inte slås på.',
        'belopp', 1, false)
on conflict (kod) do nothing;

alter table public.rabattkoder drop constraint if exists rabattkoder_tips_aldrig_aktiv;
alter table public.rabattkoder add constraint rabattkoder_tips_aldrig_aktiv check (kod <> 'TIPS' or not aktiv);

-- ------------------------------------------------------------
-- 5. Timmen på köpet
-- ------------------------------------------------------------
do $$
declare
  v text;
begin
  select md5(prosrc) into v from pg_proc where oid = 'public.forsta_timmen_bjuds()'::regprocedure;
  if v is distinct from '637cc082cfdcace7e9fbd64ff84830c3'
     and position('tipstimmar_intjanade' in (select prosrc from pg_proc
                                              where oid = 'public.forsta_timmen_bjuds()'::regprocedure)) = 0 then
    raise exception 'forsta_timmen_bjuds är inte Fas 19.5:s (md5 %). Läs driften och skriv om migrationen.', v;
  end if;
end $$;

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

  -- Två förslag samtidigt från samma familj ska inte båda få timmen.
  perform pg_advisory_xact_lock(hashtextextended('startrabatt:' || new.parent_id::text, 0));

  timme := coalesce(new.timpris_ore, 0)
         + case when coalesce(new.antal_barn, 1) > 1 then coalesce(new.extra_ore, 0) else 0 end;
  if timme <= 0 then
    return new;
  end if;
  brutto := round(timme * coalesce(new.duration_min, 60) / 60.0);

  -- Prissidans första timme (Fas 19.5): det pass som gör att familjen
  -- bokat två timmar, en gång. Ett pass med tipstimmen är inte den.
  if not exists (select 1 from public.bookings x
                  where x.parent_id = new.parent_id and x.startrabatt and x.status <> 'cancelled'
                    and x.rabattkod is distinct from 'TIPS') then
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
  -- familjens kod och haft sitt första pass, en per pass. Flaggan
  -- tipstimme läses i intern.tipstimmar_intjanade.
  if new.rabattkod is null
     and intern.tipstimmar_intjanade(new.parent_id) > intern.tipstimmar_anvanda(new.parent_id) then
    new.startrabatt := true;
    new.rabattkod := 'TIPS';
    new.rabatt_ore := least(coalesce(new.rabatt_ore, 0) + timme, brutto);
  end if;

  return new;
end $$;

-- ------------------------------------------------------------
-- 6. Vyernas och adminens frågor
-- ------------------------------------------------------------

-- Den inloggades egen kod, och vad den gett. Skapar koden första
-- gången. Svarar med antal, aldrig med vilka: den som tipsat vet vem
-- hen tipsat, men ska inte få veta mer om dem av oss.
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
  alfabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  ny      text;
  forsok  integer := 0;
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

  select * into k from public.tipskoder where person_id = jag;
  if not found then
    loop
      -- Sex tecken ur 32, utan I, O, 0 och 1: koden skrivs av från en
      -- skärm eller sägs i telefon. Inget namn i koden: den delas öppet.
      ny := '';
      for i in 1..6 loop
        ny := ny || substr(alfabet, 1 + floor(random() * 32)::integer, 1);
      end loop;
      begin
        insert into public.tipskoder (kod, sort, person_id) values (ny, s, jag) returning * into k;
        exit;
      exception when unique_violation then
        -- Samma kod fanns, eller ett annat anrop hann skapa personens.
        select * into k from public.tipskoder where person_id = jag;
        exit when found;
        forsok := forsok + 1;
        if forsok > 20 then
          raise;
        end if;
      end;
    end loop;
  end if;

  if k.sort = 'familj' then
    timmar := intern.tipstimmar_intjanade(jag);
    anvanda := intern.tipstimmar_anvanda(jag);
  end if;

  return jsonb_build_object(
    'kod', k.kod,
    'sort', k.sort,
    'aktiv', k.aktiv,
    'anmalda', (select count(*) from public.leads l where l.kod = k.kod),
    'kunder', (select count(*) from intern.tipsade_familjer(k.kod)),
    'timmar', timmar,
    'anvanda', anvanda,
    'kvar', case when timmar is null then null else greatest(timmar - anvanda, 0) end,
    'timme_ges', coalesce((select f.aktiv from public.flaggor f where f.kod = 'tipstimme'), false)
  );
end $$;

revoke execute on function public.mina_tips() from public, anon;
grant execute on function public.mina_tips() to authenticated;

-- Adminens lista: varje kod med vad den gett, räknat med samma regler
-- som timmen. Personkoder utan anmälningar står med; vyn väljer.
create or replace function public.tipskoder_lage()
returns table (kod text, sort text, person_id uuid, namn text, aktiv boolean, created_at timestamptz,
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
         (select count(*)::integer from intern.tipsade_familjer(k.kod) t where t.forsta_pass is not null),
         case when k.sort = 'familj' then intern.tipstimmar_anvanda(k.person_id) end
    from public.tipskoder k
   order by k.created_at desc, k.kod;
end $$;

revoke execute on function public.tipskoder_lage() from public, anon;
grant execute on function public.tipskoder_lage() to authenticated;

-- ------------------------------------------------------------
-- 7. En raderad person har ingen kod
--
-- radera_person() tar bort inloggningen (och koden följer med genom
-- nycklarna) eller avidentifierar kontot. I det andra fallet står
-- profilen kvar, och koden hade pekat på "Raderad familj" i varje
-- anmälan den gett. En egen trigger, inte en lapp i radera_person:
-- den funktionen skrivs om av flera sessioner.
-- ------------------------------------------------------------
create or replace function intern.tipskod_raderas()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  delete from public.tipskoder where person_id = new.id;
  return null;
end $$;

revoke execute on function intern.tipskod_raderas() from public, anon, authenticated;

drop trigger if exists profiles_tipskod_raderas on public.profiles;
create trigger profiles_tipskod_raderas
  after update of raderad_at on public.profiles
  for each row
  when (old.raderad_at is null and new.raderad_at is not null)
  execute function intern.tipskod_raderas();
