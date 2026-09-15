-- ============================================================
-- NEXTRUM — schema v18
-- TJÄNSTEN BLIR ETT BEGREPP
--
-- Körs efter schema-v17.sql. Idempotent.
--
--
-- VARFÖR
--
-- Hela systemet antar idag att det finns exakt en tjänst. Ingen
-- rad någonstans säger "läxhjälp", för det har aldrig behövt
-- sägas — en bokning ÄR läxhjälp, ett pass ÄR läxhjälp, en
-- fakturarad ÄR läxhjälp.
--
-- Så fort barnvakt finns är det antagandet fel överallt samtidigt,
-- och på det tysta sättet: en barnvaktsbokning hamnar i
-- läxhjälpens passlista, matchas mot en studiehjälpare vald för
-- sina ämnen, och faktureras på läxhjälpens timpris. Ingenting
-- kraschar. Allt blir bara fel.
--
-- Därför kommer begreppet först, och tjänsterna sedan.
--
--
-- VAD SOM ÄR MEDVETET OBESTÄMT HÄR
--
-- Barnvakt och hushållsnära tjänster får INGET pris. Vi vet inte
-- vad de ska kosta, och ett påhittat tal i en pristabell är värre
-- än ett tomt fält: det ser ut som ett beslut. De ligger som
-- aktiv = false och syns därför inte för någon kund förrän någon
-- sätter ett pris och slår på dem.
--
--
-- TVÅ SORTERS TJÄNST
--
-- `for_kund` är vad en familj kan boka. `for_jobb` är vad en ung
-- person kan söka uppdrag inom. De överlappar men är inte samma
-- lista: försäljning är ett jobb vi förmedlar, inte något en
-- familj beställer.
--
--
-- OM prissattning
--
-- Edge-funktionen `fakturering` läser priset ur `prissattning`,
-- en singleton-tabell med ett enda timpris. Den funktionen rörs
-- INTE av den här migrationen — att bygga om faktureringen och
-- införa tjänstebegreppet i samma steg vore två risker i en.
--
-- I stället blir `tjanster` källan, och en trigger håller
-- `prissattning` synkad med läxhjälpens pris. Admin ändrar på ett
-- ställe, faktureringen fortsätter fungera oförändrad. Den dagen
-- `fakturering` läser per tjänst kan triggern och tabellen bort.
-- ============================================================


-- ============================================================
-- 1. KATALOGEN
-- ============================================================

create table if not exists public.tjanster (
  kod                text primary key,
  namn               text not null,
  kort               text,
  for_kund           boolean not null default true,
  for_jobb           boolean not null default true,
  pris_per_timme_ore bigint,
  aktiv              boolean not null default false,
  ordning            integer not null default 100,
  uppdaterad         timestamptz not null default now()
);

comment on table public.tjanster is
  'Katalogen över vad Nextrum erbjuder. for_kund = en familj kan boka den. for_jobb = en ung person kan söka uppdrag inom den. aktiv = den syns i gränssnitten; en tjänst utan pris ska aldrig vara aktiv.';
comment on column public.tjanster.pris_per_timme_ore is
  'Timpris i öre. NULL = inte bestämt än. Läxhjälpens värde speglas till prissattning av en trigger, eftersom edge-funktionen fakturering läser därifrån.';

insert into public.tjanster (kod, namn, kort, for_kund, for_jobb, aktiv, ordning) values
  ('laxhjalp',     'Läxhjälp',
   'En studiehjälpare som nyligen läst samma kurser. Hemma hos er eller online.',
   true,  true,  true,  10),
  ('barnvakt',     'Barnvakt',
   'Passning av barn, hemma hos er.',
   true,  true,  false, 20),
  ('hushallsnara', 'Hushållsnära tjänster',
   'Hjälp i hemmet.',
   true,  true,  false, 30),
  ('forsaljning',  'Försäljning',
   'Uppdrag åt oss och åt andra företag. Ett jobb, inte något en familj beställer.',
   false, true,  false, 40)
on conflict (kod) do nothing;

alter table public.tjanster enable row level security;

-- Katalogen är offentlig information. Den säger vad vi erbjuder och
-- vad det kostar — samma sak som står på prissidan.
drop policy if exists "alla läser tjänster" on public.tjanster;
create policy "alla läser tjänster" on public.tjanster
  for select using (true);

drop policy if exists "bara admin ändrar tjänster" on public.tjanster;
create policy "bara admin ändrar tjänster" on public.tjanster
  for all using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));


-- ============================================================
-- 2. LÄXHJÄLPENS PRIS HÄMTAS FRÅN DET SOM REDAN GÄLLER
--
-- Inte från ett tal skrivet här. Står det 37900 i prissattning ska
-- det stå 37900 i tjanster, och ändras det imorgon ska ingen
-- behöva komma ihåg den här filen.
-- ============================================================

update public.tjanster t
set pris_per_timme_ore = p.pris_per_timme_ore
from public.prissattning p
where t.kod = 'laxhjalp'
  and t.pris_per_timme_ore is distinct from p.pris_per_timme_ore;


-- ============================================================
-- 3. SYNKEN TILLBAKA TILL prissattning
--
-- Ett enkelriktat band: tjanster styr, prissattning följer. Aldrig
-- tvärtom — två tabeller som skriver till varandra är en loop som
-- någon får felsöka en kväll den inte hade tänkt.
-- ============================================================

create or replace function public.synka_laxhjalpspris()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.kod <> 'laxhjalp' or new.pris_per_timme_ore is null then
    return null;
  end if;

  update public.prissattning
  set pris_per_timme_ore = new.pris_per_timme_ore,
      uppdaterad = now()
  where pris_per_timme_ore is distinct from new.pris_per_timme_ore;

  return null;
end $function$;

drop trigger if exists tjanster_synka_pris on public.tjanster;
create trigger tjanster_synka_pris
  after insert or update of pris_per_timme_ore on public.tjanster
  for each row execute function public.synka_laxhjalpspris();

comment on function public.synka_laxhjalpspris() is
  'Speglar tjanster.laxhjalp.pris_per_timme_ore till prissattning, som edge-funktionen fakturering läser. Enkelriktat. Kan tas bort när fakturering läser per tjänst.';


-- ============================================================
-- 4. BOKNINGEN VET VILKEN TJÄNST DEN ÄR
--
-- Default 'laxhjalp' och not null: varje befintlig rad ÄR
-- läxhjälp, och en bokning utan tjänst ska inte kunna finnas ens
-- om någon glömmer fältet i en insert.
--
-- Främmande nyckel mot katalogen i stället för en check-lista, så
-- att en ny tjänst inte kräver en migration till.
-- ============================================================

alter table public.bookings
  add column if not exists tjanst text not null default 'laxhjalp';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_tjanst_fkey') then
    alter table public.bookings
      add constraint bookings_tjanst_fkey
      foreign key (tjanst) references public.tjanster(kod);
  end if;
end $$;

create index if not exists bookings_tjanst_idx on public.bookings (tjanst);

comment on column public.bookings.tjanst is
  'Vilken tjänst passet gäller. Alla rader före v18 är läxhjälp, för det var det enda som fanns.';


-- ============================================================
-- 5. INTRESSEANMÄLAN OCH ANSÖKAN
--
-- leads.tjanst: vad familjen frågar efter. Default läxhjälp av
-- samma skäl som ovan.
--
-- applications.tjanster och tutor_profiles.tjanster är LISTOR. En
-- 17-åring kan mycket väl både hjälpa till med matte och sitta
-- barnvakt, och att tvinga fram ett val vore att kasta bort halva
-- poängen med en gemensam pool.
-- ============================================================

alter table public.leads
  add column if not exists tjanst text not null default 'laxhjalp';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_tjanst_fkey') then
    alter table public.leads
      add constraint leads_tjanst_fkey
      foreign key (tjanst) references public.tjanster(kod);
  end if;
end $$;

alter table public.applications
  add column if not exists tjanster text[] not null default array['laxhjalp'];

alter table public.tutor_profiles
  add column if not exists tjanster text[] not null default array['laxhjalp'];

comment on column public.applications.tjanster is
  'Vilka tjänster den sökande vill ta uppdrag inom. Lista — en person kan ta flera.';
comment on column public.tutor_profiles.tjanster is
  'Vilka tjänster den godkända personen får ta uppdrag inom. Sätts av admin vid godkännande. Alla profiler före v18 har läxhjälp, för det var det enda som fanns.';

-- En lista ska bara få innehålla koder som finns. En främmande
-- nyckel går inte att sätta på ett arrayelement, så det blir en
-- check mot katalogen i stället.
create or replace function public.tjanstkoder_finns(koder text[])
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select koder is null
      or not exists (
        select 1 from unnest(koder) k
        where k not in (select kod from public.tjanster)
      );
$function$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'applications_tjanster_check') then
    alter table public.applications
      add constraint applications_tjanster_check
      check (public.tjanstkoder_finns(tjanster));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tutor_profiles_tjanster_check') then
    alter table public.tutor_profiles
      add constraint tutor_profiles_tjanster_check
      check (public.tjanstkoder_finns(tjanster));
  end if;
end $$;

-- Funktionen används bara inuti en check-constraint. Ingen ska
-- kunna anropa den som RPC.
revoke execute on function public.tjanstkoder_finns(text[]) from anon, authenticated;


-- ============================================================
-- 6. SKYDDA tjanster PÅ tutor_profiles
--
-- Vilka uppdrag någon får ta är ett beslut vi fattar, inte något
-- den sökande sätter själv. skydda_tutorfalt() vaktar redan
-- status och hourly_rate på precis det sättet; tjanster hör hemma
-- i samma lista.
-- ============================================================

-- Funktionen skrivs om i sin helhet, så raderna nedan måste vara
-- exakt de som stod där plus tjanster. En create or replace som
-- "bara" lägger till ett fält tar tyst bort de som glöms:
-- id, stripe_account_id och stripe_klar var med sedan tidigare, och
-- villkoret är is_admin() utan argument plus auth.uid() is null
-- (vägen in för service_role).
create or replace function public.skydda_tutorfalt()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  new.status            := old.status;
  new.id                := old.id;
  new.hourly_rate       := old.hourly_rate;
  new.stripe_account_id := old.stripe_account_id;
  new.stripe_klar       := old.stripe_klar;
  new.tjanster          := old.tjanster;
  return new;
end $function$;


-- ============================================================
-- EFTERÅT
--
--   select kod, namn, aktiv, for_kund, for_jobb, pris_per_timme_ore
--   from public.tjanster order by ordning;
--   -- laxhjalp ska ha ett pris och aktiv = true.
--   -- De andra tre: pris null, aktiv false.
--
--   select tjanst, count(*) from public.bookings group by 1;
--   -- allt ska vara laxhjalp
--
--
-- KVAR, OCH VÄRT ATT VETA
--
-- Priset för extra barn — 69 kr i timmen — finns bara i texten på
-- prissidan. Det finns ingen kolumn för det, och `fakturering`
-- räknar inte med det: en bokning faktureras på timpriset gånger
-- tiden, oavsett hur många barn som satt med. Det är en verklig
-- lucka mellan vad sajten lovar och vad systemet gör, men den är
-- äldre än den här migrationen och ska lagas i faktureringen, inte
-- här.
-- ============================================================
