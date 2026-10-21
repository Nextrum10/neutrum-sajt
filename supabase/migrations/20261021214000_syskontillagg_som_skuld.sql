-- ============================================================
-- Syskontillägget som skuld (2026-10-21)
--
-- Leo: "bokar en familj ett pass med fler än ett barn tillkommer ett
-- tillägg per extra barn. Tillägget blir en skuld på familjen när passet
-- är hållet. Familjen kan betala skulden när hen vill under Betalningar,
-- eller så läggs den som en egen rad i nästa betalning". Inget dras när
-- passet bokas, inget dras automatiskt, och inget kort sparas för det.
--
-- STRÖMBRYTAREN syskonskuld STÅR AV, och går inte att slå på förrän
-- villkoren är skrivna. Sajten, prissidan, FAQ:n och villkoren säger i
-- dag att tillägget är fast, 69 kr i timmen totalt för två eller tre barn,
-- och att det betalas med passet. Beställningen säger 69 kr per extra barn
-- och timme, som en skuld efter passet. Med strömbrytaren av bokas syskon
-- som förut (antal_barn och tillägget i passets pris), och inget här
-- ändrar ett pris. Leo skriver villkorstexten, byter
-- tillagg_installning.villkor_version från 'utkast' till sidans datum,
-- ändrar sidorna och slår på strömbrytaren, i den ordningen.
--
-- DET HÄR GÖR FILEN
--   1. tillagg_installning: gränserna ur beställningen (TILLAGG_*) på ett
--      ställe, i databasen som håller dem. Priset per extra barn och
--      taket för antalet barn är tjänstens (tjanster.extra_personer_ore
--      och extra_personer_max), samma källa som passets pris.
--   2. tillagg_godkannanden och godkann_tillaggsvillkor(): familjens ja
--      till villkoren, med version och databasens tid.
--   3. bookings.extra_barn: barnen utöver huvudbarnet. Ett pass med extra
--      barn har antal_barn = 1: passets pris och timmarna är ett barns,
--      passet drar en timme per timme ur timbanken, och tillägget är en
--      egen skuld. Barnen, längden och antalet står fast efter bokningen,
--      också för admin (bookings_syskon_star_fast).
--   4. bokning_barn: passets barn, huvudbarnet och de extra.
--   5. tillagg_poster: en rad per pass med extra barn, med beloppet fryst
--      när passet bokas. Lägena styrs av en trigger. Raderas aldrig.
--   6. tillagg_forsok: betalningsförsöken. En post ingår i högst ett
--      öppet försök: betalningsforsok_id har plats för ett, och försöken
--      skapas under familjens lås med radlås på posterna.
--   7. betalningsrader: en rad per del av en betalning i liggaren, så att
--      en betalning för en plan och tillägg bokförs var för sig. Raderas
--      aldrig.
--   8. Funktionerna: skulden, spärren, försöken, betalningen,
--      återbetalningen per rad, tvisten, admins knappar, påminnelsen och
--      kvittot.
--   9. Två jobb: ett försök som ingen betalat släpps efter 35 minuter, och
--      påminnelsen går en gång om dagen.
--  10. Granskningen 2026-10-21 (innan filen kördes någonstans): ett försök
--      som aldrig kan bli betalt släpps, admin släpper ett som fastnat med en
--      orsak, ett hållet pass som avbokas mitt i en betalning blir frigjort
--      när betalningen släpps, familjen flyttar inte ett bekräftat pass inom
--      gränsen för sen avbokning, godkännandet raderas med kontot, och
--      kodernas statistik och bokslutet räknar tilläggen rätt (avsnitt 16
--      och 17).
--
-- PASS FÖR PASS BUNTAS INTE. Betala nu för ett pass skrivs av webhooken
-- på tre vägar (passets rad, timmarna tillbaka och timbank_kort_vinner),
-- och passets betalt_ore är det kortare pass betalas tillbaka ur
-- (kortare_pass_att_aterbetala). En tilläggsrad i samma betalning hade
-- krävt att alla tre flyttas in i en databasfunktion och att återbetalningen
-- räknar bort tillägget, alltså att det befintliga flödet ändras. Tillägget
-- buntas därför med köp av timmar (plan, Fyll timbanken och timmar till
-- planen) och betalas annars med Betala tillägg nu.
--
-- Filen har ett enda drop: betalningar_typ_check byts mot en som också
-- tar 'syskon' (drop constraint if exists och add, som koder_for_planer).
-- Inget delete. Filen går att köra två gånger.
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 1. inställningarna ----------
create table if not exists public.tillagg_installning (
  id                              smallint primary key default 1 check (id = 1),
  -- TILLAGG_VILLKOR_VERSION. 'utkast' tills Leo skrivit texten; då går
  -- strömbrytaren inte att slå på och ingen kan godkänna.
  villkor_version                 text not null default 'utkast'
                                  check (villkor_version ~ '^(utkast|[0-9]{4}-[0-9]{2}-[0-9]{2})$'),
  -- TILLAGG_SEN_AVBOKNING_TIMMAR och TILLAGG_DEBITERA_VID_SEN_AVBOKNING.
  sen_avbokning_timmar            integer not null default 24 check (sen_avbokning_timmar between 0 and 168),
  debitera_vid_sen_avbokning      boolean not null default true,
  -- TILLAGG_OBLIGATORISK_I_NASTA_BETALNING.
  obligatorisk_i_nasta_betalning  boolean not null default true,
  -- TILLAGG_MAX_UPPLUPET_KR, i ören, och TILLAGG_SPARR_EFTER_DAGAR.
  max_upplupet_ore                integer not null default 100000 check (max_upplupet_ore > 0),
  sparr_efter_dagar               integer not null default 45 check (sparr_efter_dagar between 1 and 365),
  -- TILLAGG_PAMINNELSE_DAGAR.
  paminnelse_dagar                integer not null default 14 check (paminnelse_dagar between 1 and 365),
  uppdaterad                      timestamptz not null default now()
);

insert into public.tillagg_installning (id) values (1) on conflict (id) do nothing;

comment on table public.tillagg_installning is
  '2026-10-21 (syskontillagg_som_skuld). Syskontilläggets gränser, en rad. Namnen motsvarar beställningens '
  'TILLAGG_*: villkor_version (TILLAGG_VILLKOR_VERSION), sen_avbokning_timmar, debitera_vid_sen_avbokning, '
  'obligatorisk_i_nasta_betalning, max_upplupet_ore (TILLAGG_MAX_UPPLUPET_KR i ören), sparr_efter_dagar och '
  'paminnelse_dagar. Priset per extra barn och taket för antalet barn är tjänstens (tjanster). Ändras med SQL.';

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.tillagg_installning'::regclass
                  and tgname = 'tillagg_installning_audit') then
    create trigger tillagg_installning_audit
      after insert or update on public.tillagg_installning
      for each row execute function public.logga_andring('tillagg_installning',
        'villkor_version', 'sen_avbokning_timmar', 'debitera_vid_sen_avbokning',
        'obligatorisk_i_nasta_betalning', 'max_upplupet_ore', 'sparr_efter_dagar', 'paminnelse_dagar');
  end if;
end $$;

-- Strömbrytaren. Av, och vad den väntar på.
insert into public.flaggor (kod, aktiv, beskrivning, vantar_pa)
values ('syskonskuld', false,
  'Syskon på samma pass bokas med barnen, och tillägget per extra barn blir en skuld efter passet '
    || '(syskontillagg_som_skuld). Av: syskon bokas som förut, med tillägget i passets pris.',
  'Leos villkorstext för syskontillägget och versionen i tillagg_installning.villkor_version (går inte att slå '
    || 'på med utkast). Prissidan, områdessidorna, FAQ:n, villkoren och /en/ ska säga 69 kr per extra barn och '
    || 'timme som skuld efter passet, i samma ändring. Stripes endpoint ska ha checkout.session.expired.')
on conflict (kod) do nothing;

/* Strömbrytaren går inte att slå på medan villkoren är ett utkast, och
   versionen går inte tillbaka till utkast medan den är på. */
create or replace function intern.syskonskuld_kraver_villkor()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
begin
  if new.kod = 'syskonskuld' and new.aktiv
     and coalesce((select i.villkor_version from public.tillagg_installning i where i.id = 1), 'utkast') = 'utkast' then
    raise exception using errcode = '23514',
      message = 'Syskontillägget slås på först när villkorstexten är skriven och tillagg_installning.villkor_version '
        || 'har sidans datum.';
  end if;
  return new;
end $function$;

revoke all on function intern.syskonskuld_kraver_villkor() from public, anon, authenticated;

create or replace function intern.tillagg_installning_vakt()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
begin
  if new.villkor_version = 'utkast'
     and coalesce((select f.aktiv from public.flaggor f where f.kod = 'syskonskuld'), false) then
    raise exception using errcode = '23514',
      message = 'Villkoren kan inte bli ett utkast igen medan syskontillägget är påslaget.';
  end if;
  new.uppdaterad := now();
  return new;
end $function$;

revoke all on function intern.tillagg_installning_vakt() from public, anon, authenticated;

create or replace trigger flaggor_syskonskuld_villkor
  before insert or update on public.flaggor
  for each row execute function intern.syskonskuld_kraver_villkor();
create or replace trigger tillagg_installning_vakt
  before insert or update on public.tillagg_installning
  for each row execute function intern.tillagg_installning_vakt();

-- ---------- 2. familjens ja ----------
create table if not exists public.tillagg_godkannanden (
  -- Följer kontot, som villkor_godkannanden och kopvillkor_godkannanden: med
  -- restrict gick en familj som bara godkänt villkoren inte att radera.
  familj      uuid not null references public.profiles(id) on delete cascade,
  version     text not null check (version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  godkand_at  timestamptz not null default now(),
  primary key (familj, version)
);

comment on table public.tillagg_godkannanden is
  '2026-10-21 (syskontillagg_som_skuld). Familjens godkännande av villkoren för syskontillägget, en rad per '
  'version, med databasens tid. Skrivs bara av godkann_tillaggsvillkor(). Utan raden för den gällande versionen '
  'bokas inget pass med extra barn (bookings_syskon_prova).';

/* Familjen godkänner den version vyn visade. Är den inte den gällande
   (sidan var gammal) blir det ett nej, så att ingen godkänner en text
   den inte sett. */
create or replace function public.godkann_tillaggsvillkor(p_version text)
 returns timestamptz
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
declare
  jag  uuid := auth.uid();
  nu   text;
  tid  timestamptz;
begin
  if jag is null or not exists (select 1 from public.profiles p where p.id = jag and p.role = 'parent'
                                                                    and p.raderad_at is null) then
    raise exception using errcode = '42501', message = 'Villkoren för syskontillägget godkänns av familjen.';
  end if;
  select i.villkor_version into nu from public.tillagg_installning i where i.id = 1;
  if coalesce(nu, 'utkast') = 'utkast' then
    raise exception using errcode = '22023', message = 'Villkoren för syskontillägget är inte skrivna än.';
  end if;
  if p_version is distinct from nu then
    raise exception using errcode = '22023',
      message = 'Villkoren har ändrats sedan sidan laddades. Ladda om och läs dem igen.';
  end if;
  insert into public.tillagg_godkannanden (familj, version) values (jag, nu)
  on conflict (familj, version) do nothing;
  select g.godkand_at into tid from public.tillagg_godkannanden g where g.familj = jag and g.version = nu;
  return tid;
end $function$;

revoke all on function public.godkann_tillaggsvillkor(text) from public, anon;
grant execute on function public.godkann_tillaggsvillkor(text) to authenticated;

-- ---------- 3. barnen på passet ----------
alter table public.bookings add column if not exists extra_barn uuid[] not null default '{}';
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.bookings'::regclass
                  and conname = 'bookings_extra_barn_antal') then
    alter table public.bookings add constraint bookings_extra_barn_antal check (cardinality(extra_barn) <= 9);
  end if;
end $$;

comment on column public.bookings.extra_barn is
  '2026-10-21 (syskontillagg_som_skuld). Barnen utöver huvudbarnet (student_id) på ett pass med extra barn. '
  'Sätts när passet bokas och ändras aldrig (skydda_bokningsfalt). Passets antal_barn är då 1: priset och timmarna '
  'är ett barns, och tillägget är en egen skuld (tillagg_poster).';

create table if not exists public.bokning_barn (
  bokning_id    uuid not null references public.bookings(id) on delete cascade,
  barn_id       uuid not null references public.students(id) on delete cascade,
  ar_huvudbarn  boolean not null default false,
  primary key (bokning_id, barn_id)
);
create unique index if not exists bokning_barn_ett_huvudbarn on public.bokning_barn (bokning_id) where ar_huvudbarn;
create index if not exists bokning_barn_barn on public.bokning_barn (barn_id);

comment on table public.bokning_barn is
  '2026-10-21 (syskontillagg_som_skuld). Barnen på ett pass med extra barn: huvudbarnet och de extra. Skrivs bara '
  'av databasen när passet bokas. Ett pass utan extra barn har inga rader här: barnet är student_id.';

/* Barnen hör till passets familj, och taket håller. Databasen skriver
   raderna själv, men vakten står här också, så att ingen väg förbi
   triggern på bookings kan lägga ett annat barn på passet. */
create or replace function intern.bokning_barn_vakt()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
declare
  b     public.bookings%rowtype;
  takt  integer;
begin
  if tg_op = 'UPDATE' then
    raise exception using errcode = '42501', message = 'Passets barn ändras inte efter att passet bokats.';
  end if;
  select * into b from public.bookings x where x.id = new.bokning_id;
  if not exists (select 1 from public.students s where s.id = new.barn_id and s.parent_id = b.parent_id
                                                  and s.raderad_at is null) then
    raise exception using errcode = '42501', message = 'Barnet hör inte till passets familj.';
  end if;
  select coalesce(t.extra_personer_max, 1) into takt from public.tjanster t where t.kod = b.tjanst;
  if (select count(*) from public.bokning_barn x where x.bokning_id = new.bokning_id) + 1 > coalesce(takt, 1) then
    raise exception using errcode = '23514', message = format('Högst %s barn på ett pass.', coalesce(takt, 1));
  end if;
  return new;
end $function$;

revoke all on function intern.bokning_barn_vakt() from public, anon, authenticated;

create or replace trigger bokning_barn_vakt
  before insert or update on public.bokning_barn
  for each row execute function intern.bokning_barn_vakt();

-- ---------- 4. betalningsförsöken och posterna ----------
create table if not exists public.tillagg_forsok (
  id                     uuid primary key default gen_random_uuid(),
  familj                 uuid not null references public.profiles(id) on delete restrict,
  -- 'manuell' är Betala tillägg nu, 'kop' en rad i ett köp av timmar.
  slag                   text not null check (slag in ('manuell', 'kop')),
  klippkort_id           uuid references public.klippkort(id) on delete restrict,
  belopp_ore             integer not null check (belopp_ore > 0),
  antal_pass             integer not null check (antal_pass > 0),
  status                 text not null default 'oppen' check (status in ('oppen', 'betald', 'slappt')),
  stripe_session_id      text unique check (stripe_session_id is null or stripe_session_id ~ '^cs_[A-Za-z0-9_]+$'),
  stripe_payment_intent  text check (stripe_payment_intent is null or stripe_payment_intent ~ '^pi_[A-Za-z0-9_]+$'),
  betalning_id           uuid references public.betalningar(id) on delete restrict,
  slapp_orsak            text check (slapp_orsak is null
                                     or slapp_orsak in ('utgangen', 'avbruten', 'jobbet', 'ersatt', 'admin')),
  -- När admin släppte det (tillagg_forsok_slapp_admin): skälet och vem.
  slapp_kommentar        text check (slapp_kommentar is null or char_length(btrim(slapp_kommentar)) between 3 and 500),
  slappt_av              uuid,
  skapad_at              timestamptz not null default now(),
  upphor_at              timestamptz not null,
  -- Sessionen är klar men pengarna kommer senare (Klarna): jobbet släpper den inte.
  session_klar_at        timestamptz,
  avslutad_at            timestamptz,
  constraint tillagg_forsok_kop check ((slag = 'kop') = (klippkort_id is not null)),
  constraint tillagg_forsok_betald check ((status = 'betald') = (betalning_id is not null)),
  constraint tillagg_forsok_betald_pi check (status <> 'betald' or stripe_payment_intent is not null),
  constraint tillagg_forsok_slappt check (status <> 'slappt' or slapp_orsak is not null),
  constraint tillagg_forsok_admin check ((slapp_orsak = 'admin') = (slapp_kommentar is not null))
);
create index if not exists tillagg_forsok_oppna on public.tillagg_forsok (familj) where status = 'oppen';

comment on table public.tillagg_forsok is
  '2026-10-21 (syskontillagg_som_skuld). Ett försök att betala upplupet syskontillägg: Betala tillägg nu (manuell) '
  'eller en rad i ett köp av timmar (kop). Posterna låses till försöket (tillagg_poster.betalningsforsok_id) och '
  'släpps när sessionen går ut, avbryts eller när jobbet tillagg-forsok ser ett försök äldre än 35 minuter. '
  'Bara webhooken sätter betald. Raderas aldrig.';

create table if not exists public.tillagg_poster (
  id                   uuid primary key default gen_random_uuid(),
  bokning_id           uuid not null unique references public.bookings(id) on delete restrict,
  familj_id            uuid not null references public.profiles(id) on delete restrict,
  antal_extra_barn     smallint not null check (antal_extra_barn between 1 and 9),
  -- Det frysta priset per extra barn och timme (bookings.extra_ore) och passets längd.
  pris_ore_per_timme   integer not null check (pris_ore_per_timme > 0),
  minuter              integer not null check (minuter between 15 and 600),
  belopp_ore           integer not null check (belopp_ore > 0),
  pass_start           timestamptz not null,
  status               text not null default 'bokad'
                       check (status in ('bokad', 'upplupen', 'i_betalning', 'betald', 'frigjord', 'avskriven', 'aterbetald')),
  betalningsforsok_id  uuid references public.tillagg_forsok(id) on delete restrict,
  betalning_id         uuid references public.betalningar(id) on delete restrict,
  aterbetalt_ore       integer not null default 0,
  orsak                text,
  andrad_av            uuid,
  skapad_at            timestamptz not null default now(),
  upplupen_at          timestamptz,
  betald_at            timestamptz,
  frigjord_at          timestamptz,
  avskriven_at         timestamptz,
  aterbetald_at        timestamptz,
  constraint tillagg_poster_belopp
    check (belopp_ore = round(antal_extra_barn::numeric * pris_ore_per_timme * minuter / 60)),
  constraint tillagg_poster_forsok
    check ((status in ('i_betalning', 'betald', 'aterbetald')) = (betalningsforsok_id is not null)),
  constraint tillagg_poster_betalning
    check ((status in ('betald', 'aterbetald')) = (betalning_id is not null)),
  constraint tillagg_poster_aterbetalt
    check (aterbetalt_ore between 0 and belopp_ore
           and (status <> 'aterbetald' or aterbetalt_ore = belopp_ore)
           and (aterbetalt_ore = 0 or status in ('betald', 'aterbetald'))),
  constraint tillagg_poster_orsak
    check ((status not in ('frigjord', 'avskriven')) or (orsak is not null and char_length(orsak) between 3 and 500)),
  constraint tillagg_poster_orsak_langd check (orsak is null or char_length(orsak) <= 500),
  constraint tillagg_poster_upplupen
    check (status in ('bokad', 'frigjord') or upplupen_at is not null)
);
create index if not exists tillagg_poster_familj on public.tillagg_poster (familj_id, status);
create index if not exists tillagg_poster_forsok on public.tillagg_poster (betalningsforsok_id)
  where betalningsforsok_id is not null;

comment on table public.tillagg_poster is
  '2026-10-21 (syskontillagg_som_skuld). En rad per pass med extra barn. Beloppet = extra barn × pris per extra '
  'barn och timme × minuter / 60, fryst när passet bokas. Lägena: bokad, upplupen (skulden), i_betalning, betald, '
  'frigjord, avskriven och aterbetald, och bara övergångarna i intern.tillagg_poster_vakt. Skrivs bara av '
  'databasen. Raderas aldrig: underlag för en skuld eller en betalning.';

create table if not exists public.tillagg_forsok_poster (
  forsok_id   uuid not null references public.tillagg_forsok(id) on delete restrict,
  post_id     uuid not null references public.tillagg_poster(id) on delete restrict,
  belopp_ore  integer not null check (belopp_ore > 0),
  primary key (forsok_id, post_id)
);

comment on table public.tillagg_forsok_poster is
  '2026-10-21 (syskontillagg_som_skuld). Vilka poster ett betalningsförsök tog, också efter att det släppts. '
  'Står fast och raderas aldrig.';

-- ---------- 5. betalningens rader ----------
create table if not exists public.betalningsrader (
  id               uuid primary key default gen_random_uuid(),
  betalning_id     uuid not null references public.betalningar(id) on delete restrict,
  -- Samma typer som betalningar.typ: tillagg är övertid (pass_tillagg),
  -- syskon är syskontillägget.
  typ              text not null check (typ in ('plan', 'timbank', 'pass', 'tillagg', 'syskon')),
  belopp_ore       integer not null check (belopp_ore > 0),
  aterbetalt_ore   integer not null default 0,
  klippkort_id     uuid references public.klippkort(id) on delete set null,
  booking_id       uuid references public.bookings(id) on delete set null,
  tillagg_post_id  uuid references public.tillagg_poster(id) on delete restrict,
  kod              text,
  beskrivning      text check (beskrivning is null or char_length(beskrivning) <= 300),
  skapad_at        timestamptz not null default now(),
  constraint betalningsrader_aterbetalt check (aterbetalt_ore between 0 and belopp_ore),
  constraint betalningsrader_kalla check (
    (tillagg_post_id is null or typ = 'syskon')
    and (klippkort_id is null or typ in ('plan', 'timbank'))
    and (booking_id is null or typ in ('pass', 'tillagg'))
    and (typ <> 'syskon' or tillagg_post_id is not null or beskrivning is not null))
);
create index if not exists betalningsrader_betalning on public.betalningsrader (betalning_id);
-- En post betalas en gång, i hela liggaren.
create unique index if not exists betalningsrader_en_per_post on public.betalningsrader (tillagg_post_id)
  where tillagg_post_id is not null;

comment on table public.betalningsrader is
  '2026-10-21 (syskontillagg_som_skuld). En rad per del av en betalning i liggaren: planen, passet eller köpet, '
  'och varje syskontillägg (syskon) för sig, så att en betalning för en plan och tillägg bokförs per rad. En '
  'betalning utan egna rader får en rad med hela beloppet när transaktionen sluts (betalningar_rader). '
  'Raderas aldrig; bara återbetalt ändras, uppåt.';

alter table public.betalningar drop constraint if exists betalningar_typ_check;
alter table public.betalningar add constraint betalningar_typ_check
  check (typ = any (array['plan', 'timbank', 'pass', 'tillagg', 'syskon']));

-- ---------- 6. vakterna ----------
/* Posternas lägen. Bara övergångarna i beställningen, och tiderna sätts
   här, aldrig av den som skriver. Beloppet, passet och familjen står
   fast; passets tid följer bara med medan posten är bokad. */
create or replace function intern.tillagg_poster_vakt()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception using errcode = '42501',
      message = 'En tilläggspost raderas aldrig: den är underlag för en skuld eller en betalning.';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'bokad' or new.betalningsforsok_id is not null or new.betalning_id is not null
       or new.aterbetalt_ore <> 0 or new.upplupen_at is not null or new.betald_at is not null
       or new.frigjord_at is not null or new.avskriven_at is not null or new.aterbetald_at is not null then
      raise exception using errcode = '42501', message = 'En ny tilläggspost börjar som bokad, utan betalning.';
    end if;
    new.skapad_at := now();
    return new;
  end if;

  if (new.id, new.bokning_id, new.familj_id, new.antal_extra_barn, new.pris_ore_per_timme, new.minuter,
      new.belopp_ore, new.skapad_at)
     is distinct from
     (old.id, old.bokning_id, old.familj_id, old.antal_extra_barn, old.pris_ore_per_timme, old.minuter,
      old.belopp_ore, old.skapad_at) then
    raise exception using errcode = '42501', message = 'Tilläggets belopp, pass och familj står fast.';
  end if;
  if new.pass_start is distinct from old.pass_start and old.status <> 'bokad' then
    raise exception using errcode = '42501', message = 'Passets tid följer bara med medan tillägget är bokat.';
  end if;
  if new.aterbetalt_ore < old.aterbetalt_ore then
    raise exception using errcode = '42501', message = 'En återbetalning går inte att ta tillbaka.';
  end if;

  if new.status is distinct from old.status then
    if not ((old.status = 'bokad' and new.status in ('upplupen', 'frigjord'))
            or (old.status = 'upplupen' and new.status in ('i_betalning', 'avskriven', 'frigjord'))
            or (old.status = 'i_betalning' and new.status in ('betald', 'upplupen', 'frigjord'))
            or (old.status = 'betald' and new.status = 'aterbetald')) then
      raise exception using errcode = '23514',
        message = format('Tillägget kan inte gå från %s till %s.', old.status, new.status);
    end if;
    new.upplupen_at := case when new.status = 'upplupen' then coalesce(old.upplupen_at, now()) else old.upplupen_at end;
    new.betald_at := case when new.status = 'betald' then now() else old.betald_at end;
    new.frigjord_at := case when new.status = 'frigjord' then now() else old.frigjord_at end;
    new.avskriven_at := case when new.status = 'avskriven' then now() else old.avskriven_at end;
    new.aterbetald_at := case when new.status = 'aterbetald' then now() else old.aterbetald_at end;
    if new.status in ('upplupen', 'frigjord') then
      new.betalningsforsok_id := null;
    end if;
  elsif (new.upplupen_at, new.betald_at, new.frigjord_at, new.avskriven_at, new.aterbetald_at)
        is distinct from
        (old.upplupen_at, old.betald_at, old.frigjord_at, old.avskriven_at, old.aterbetald_at)
     or new.betalningsforsok_id is distinct from old.betalningsforsok_id
     or new.betalning_id is distinct from old.betalning_id then
    raise exception using errcode = '42501', message = 'Tilläggets tider och betalning följer bara lägena.';
  end if;
  return new;
end $function$;

revoke all on function intern.tillagg_poster_vakt() from public, anon, authenticated;

create or replace trigger tillagg_poster_vakt
  before insert or update or delete on public.tillagg_poster
  for each row execute function intern.tillagg_poster_vakt();
do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.tillagg_poster'::regclass
                  and tgname = 'tillagg_poster_toms_aldrig') then
    create trigger tillagg_poster_toms_aldrig
      before truncate on public.tillagg_poster
      for each statement execute function intern.tillagg_poster_vakt();
  end if;
  -- Läget och beloppen i auditloggen, aldrig orsaken (fritext).
  if not exists (select 1 from pg_trigger where tgrelid = 'public.tillagg_poster'::regclass
                  and tgname = 'tillagg_poster_audit') then
    create trigger tillagg_poster_audit
      after insert or update on public.tillagg_poster
      for each row execute function public.logga_andring('tillagg', 'status', 'belopp_ore', 'antal_extra_barn',
        'betalningsforsok_id', 'betalning_id', 'aterbetalt_ore', 'andrad_av');
  end if;
end $$;

/* Försökens lägen: öppet till betalt eller släppt, och ett släppt till
   betalt när pengarna ändå kom (Klarna, eller en webhook som kom efter
   jobbet). Sessionen och tiderna skrivs en gång. */
create or replace function intern.tillagg_forsok_vakt()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception using errcode = '42501', message = 'Ett betalningsförsök raderas aldrig.';
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'oppen' or new.betalning_id is not null or new.stripe_payment_intent is not null
       or new.avslutad_at is not null or new.slapp_orsak is not null then
      raise exception using errcode = '42501', message = 'Ett nytt betalningsförsök är öppet och obetalt.';
    end if;
    new.skapad_at := now();
    return new;
  end if;
  if (new.id, new.familj, new.slag, new.klippkort_id, new.belopp_ore, new.antal_pass, new.skapad_at, new.upphor_at)
     is distinct from
     (old.id, old.familj, old.slag, old.klippkort_id, old.belopp_ore, old.antal_pass, old.skapad_at, old.upphor_at) then
    raise exception using errcode = '42501', message = 'Ett betalningsförsöks belopp och poster står fast.';
  end if;
  if old.stripe_session_id is not null and new.stripe_session_id is distinct from old.stripe_session_id then
    raise exception using errcode = '42501', message = 'Försökets session skrivs en gång.';
  end if;
  if old.session_klar_at is not null and new.session_klar_at is distinct from old.session_klar_at then
    raise exception using errcode = '42501', message = 'Försökets session blev klar en gång.';
  end if;
  if new.status is distinct from old.status then
    if not ((old.status = 'oppen' and new.status in ('betald', 'slappt'))
            or (old.status = 'slappt' and new.status = 'betald')) then
      raise exception using errcode = '23514',
        message = format('Betalningsförsöket kan inte gå från %s till %s.', old.status, new.status);
    end if;
    new.avslutad_at := now();
  elsif (new.betalning_id, new.stripe_payment_intent, new.slapp_orsak, new.avslutad_at, new.slapp_kommentar, new.slappt_av)
        is distinct from
        (old.betalning_id, old.stripe_payment_intent, old.slapp_orsak, old.avslutad_at, old.slapp_kommentar, old.slappt_av) then
    raise exception using errcode = '42501', message = 'Försökets betalning följer bara läget.';
  end if;
  return new;
end $function$;

revoke all on function intern.tillagg_forsok_vakt() from public, anon, authenticated;

create or replace trigger tillagg_forsok_vakt
  before insert or update or delete on public.tillagg_forsok
  for each row execute function intern.tillagg_forsok_vakt();

/* Det som står fast helt: försökens poster. */
create or replace function intern.tillagg_star_fast()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
begin
  raise exception using errcode = '42501', message = 'Raden står fast: den ändras aldrig och tas aldrig bort.';
end $function$;

revoke all on function intern.tillagg_star_fast() from public, anon, authenticated;

/* Betalningens rader: bara återbetalt ändras, uppåt och aldrig över
   raden, och en källa kan bli null när den raderas (on delete set null). */
create or replace function intern.betalningsrader_vakt()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception using errcode = '42501',
      message = 'Betalningens rader raderas aldrig: de är bokföringsunderlag i sju år.';
  end if;
  if tg_op = 'INSERT' then
    if new.aterbetalt_ore <> 0 then
      raise exception using errcode = '42501', message = 'En ny betalningsrad har inget återbetalt.';
    end if;
    new.skapad_at := now();
    return new;
  end if;
  if (new.id, new.betalning_id, new.typ, new.belopp_ore, new.tillagg_post_id, new.kod, new.beskrivning, new.skapad_at)
     is distinct from
     (old.id, old.betalning_id, old.typ, old.belopp_ore, old.tillagg_post_id, old.kod, old.beskrivning, old.skapad_at)
     or (new.klippkort_id is distinct from old.klippkort_id and new.klippkort_id is not null)
     or (new.booking_id is distinct from old.booking_id and new.booking_id is not null) then
    raise exception using errcode = '42501',
      message = 'Det som bokförts på betalningens rader står fast. Bara återbetalt ändras.';
  end if;
  if new.aterbetalt_ore < old.aterbetalt_ore then
    raise exception using errcode = '42501', message = 'En återbetalning går inte att ta tillbaka.';
  end if;
  return new;
end $function$;

revoke all on function intern.betalningsrader_vakt() from public, anon, authenticated;

create or replace trigger betalningsrader_vakt
  before insert or update or delete on public.betalningsrader
  for each row execute function intern.betalningsrader_vakt();

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.betalningsrader'::regclass
                  and tgname = 'betalningsrader_toms_aldrig') then
    create trigger betalningsrader_toms_aldrig
      before truncate on public.betalningsrader
      for each statement execute function intern.betalningsrader_vakt();
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.tillagg_forsok'::regclass
                  and tgname = 'tillagg_forsok_toms_aldrig') then
    create trigger tillagg_forsok_toms_aldrig
      before truncate on public.tillagg_forsok
      for each statement execute function intern.tillagg_forsok_vakt();
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.tillagg_forsok_poster'::regclass
                  and tgname = 'tillagg_forsok_poster_star_fast') then
    create trigger tillagg_forsok_poster_star_fast
      before update or delete on public.tillagg_forsok_poster
      for each row execute function intern.tillagg_star_fast();
    create trigger tillagg_forsok_poster_toms_aldrig
      before truncate on public.tillagg_forsok_poster
      for each statement execute function intern.tillagg_star_fast();
  end if;
end $$;

/* En betalning som ingen gav egna rader får en rad med hela beloppet när
   transaktionen sluts: passets, köpets eller övertidens, som förut. Den
   som bokför en betalning i delar (köpet med tillägg, Betala tillägg nu)
   skriver raderna i samma transaktion, och då görs ingenting här.
   Därför en uppskjuten constraint trigger, inte en vanlig. */
create or replace function intern.betalningsrader_standard()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
begin
  if exists (select 1 from public.betalningsrader r where r.betalning_id = new.id) then
    return null;
  end if;
  insert into public.betalningsrader (betalning_id, typ, belopp_ore, klippkort_id, booking_id, kod, beskrivning)
  values (new.id, new.typ, new.belopp_ore,
          case when new.typ in ('plan', 'timbank') then new.klippkort_id end,
          case when new.typ in ('pass', 'tillagg') then new.booking_id end,
          new.kod,
          case when new.typ = 'syskon' then 'Betalningen kunde inte skrivas ner på tilläggen.' end);
  return null;
end $function$;

revoke all on function intern.betalningsrader_standard() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.betalningar'::regclass
                  and tgname = 'betalningar_rader') then
    create constraint trigger betalningar_rader
      after insert on public.betalningar
      deferrable initially deferred
      for each row execute function intern.betalningsrader_standard();
  end if;
end $$;

/* En betalning med en enda rad: raden följer liggarens återbetalning.
   En betalning med flera rader återbetalas per rad
   (betalningsrader_aterbetalda). */
create or replace function intern.betalningsrader_folj_aterbetalning()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
begin
  if new.aterbetalt_ore <= old.aterbetalt_ore then
    return null;
  end if;
  if (select count(*) from public.betalningsrader r where r.betalning_id = new.id) = 1 then
    update public.betalningsrader r
       set aterbetalt_ore = least(new.aterbetalt_ore, r.belopp_ore)
     where r.betalning_id = new.id and r.aterbetalt_ore < least(new.aterbetalt_ore, r.belopp_ore)
       and r.tillagg_post_id is null;
  end if;
  return null;
end $function$;

revoke all on function intern.betalningsrader_folj_aterbetalning() from public, anon, authenticated;

create or replace trigger betalningar_rader_aterbetalda
  after update of aterbetalt_ore on public.betalningar
  for each row execute function intern.betalningsrader_folj_aterbetalning();

-- Betalningarna som redan står i liggaren får sin rad.
insert into public.betalningsrader (betalning_id, typ, belopp_ore, klippkort_id, booking_id, kod, beskrivning)
select b.id, b.typ, b.belopp_ore,
       case when b.typ in ('plan', 'timbank') then b.klippkort_id end,
       case when b.typ in ('pass', 'tillagg') then b.booking_id end,
       b.kod,
       case when b.typ = 'syskon' then 'Betalningen kunde inte skrivas ner på tilläggen.' end
  from public.betalningar b
 where not exists (select 1 from public.betalningsrader r where r.betalning_id = b.id);
-- Det som redan betalats tillbaka på dem.
update public.betalningsrader r
   set aterbetalt_ore = least(b.aterbetalt_ore, r.belopp_ore)
  from public.betalningar b
 where b.id = r.betalning_id and b.aterbetalt_ore > r.aterbetalt_ore
   and (select count(*) from public.betalningsrader x where x.betalning_id = b.id) = 1;

-- ---------- 7. beloppet, tiden, spärren och skulden ----------
/* Samma regel som tillaggetsBelopp i _delad/tillagg.ts: round() avrundar
   en halv öre uppåt för positiva tal, som Math.round. De ändras
   tillsammans. */
create or replace function intern.tillaggets_belopp(p_extra integer, p_pris_ore integer, p_minuter integer)
 returns integer
 language sql
 immutable
 set search_path to ''
as $function$
  -- syskontillagg_som_skuld (2026-10-21).
  select round(p_extra::numeric * p_pris_ore * p_minuter / 60)::integer
$function$;

-- Passets start som en tidpunkt: dagen och klockslaget är Stockholms.
create or replace function intern.passets_start(p_dag date, p_tid text)
 returns timestamptz
 language sql
 stable
 set search_path to ''
as $function$
  -- syskontillagg_som_skuld (2026-10-21).
  select (p_dag + coalesce(nullif(p_tid, ''), '00:00')::time) at time zone 'Europe/Stockholm'
$function$;

/* Sen avbokning: inte MER än gränsen före start. Exakt vid gränsen är
   sent ("mer än 24 timmar före start" är i tid). */
create or replace function intern.tillagg_sen_avbokning(p_start timestamptz, p_nu timestamptz, p_timmar integer)
 returns boolean
 language sql
 immutable
 set search_path to ''
as $function$
  -- syskontillagg_som_skuld (2026-10-21).
  select p_start - p_nu <= make_interval(hours => p_timmar)
$function$;

/* Spärren för nya pass med extra barn. 'belopp' när det obetalda är ÖVER
   taket, 'alder' när den äldsta obetalda posten är ÄLDRE än gränsen i
   dagar, räknat i Stockholmsdatum, annars null. Obetalt är upplupen och i
   betalning: ett försök som står öppet är inte betalt än. */
create or replace function intern.tillagg_sparr(p_familj uuid, p_nu timestamptz default now())
 returns text
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  -- syskontillagg_som_skuld (2026-10-21).
  with i as (select * from public.tillagg_installning where id = 1),
       s as (select coalesce(sum(t.belopp_ore), 0) as summa, min(t.upplupen_at) as aldsta
               from public.tillagg_poster t
              where t.familj_id = p_familj and t.status in ('upplupen', 'i_betalning'))
  select case
           when s.summa > i.max_upplupet_ore then 'belopp'
           when s.aldsta is not null
                and (p_nu at time zone 'Europe/Stockholm')::date
                    - (s.aldsta at time zone 'Europe/Stockholm')::date > i.sparr_efter_dagar then 'alder'
         end
    from s, i
$function$;

revoke all on function intern.tillagg_sparr(uuid, timestamptz) from public, anon, authenticated;

/* Skulden: summan av familjens upplupna poster, antalet pass och den
   äldsta posten. Familjen ser sin egen, admin allas. */
create or replace function public.tillagg_skuld(p_familj uuid)
 returns table (belopp_ore bigint, antal_pass integer, aldsta_post uuid, aldsta_upplupen_at timestamptz)
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
begin
  if auth.uid() is not null and auth.uid() is distinct from p_familj and not public.is_admin() then
    raise exception using errcode = '42501', message = 'Familjen ser sin egen skuld.';
  end if;
  return query
    select coalesce(sum(t.belopp_ore), 0)::bigint,
           count(*)::integer,
           (select x.id from public.tillagg_poster x
             where x.familj_id = p_familj and x.status = 'upplupen'
             order by x.upplupen_at, x.id limit 1),
           min(t.upplupen_at)
      from public.tillagg_poster t
     where t.familj_id = p_familj and t.status = 'upplupen';
end $function$;

revoke all on function public.tillagg_skuld(uuid) from public, anon;
grant execute on function public.tillagg_skuld(uuid) to authenticated;

/* Allt familjens vy behöver om tillägget, i ett anrop: om det är på,
   villkorens version och familjens ja, gränserna, skulden, det som står
   i en betalning, spärren och posterna som inte är avslutade. */
create or replace function public.mitt_tillagg()
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
declare
  jag uuid := auth.uid();
  i   public.tillagg_installning%rowtype;
begin
  if jag is null then
    raise exception using errcode = '42501', message = 'Logga in först.';
  end if;
  select * into i from public.tillagg_installning where id = 1;
  return jsonb_build_object(
    'pa', coalesce((select f.aktiv from public.flaggor f where f.kod = 'syskonskuld'), false),
    'version', i.villkor_version,
    'godkand_at', (select g.godkand_at from public.tillagg_godkannanden g
                    where g.familj = jag and g.version = i.villkor_version),
    'sen_avbokning_timmar', i.sen_avbokning_timmar,
    'debitera_vid_sen_avbokning', i.debitera_vid_sen_avbokning,
    'obligatorisk', i.obligatorisk_i_nasta_betalning,
    'max_upplupet_ore', i.max_upplupet_ore,
    'sparr_efter_dagar', i.sparr_efter_dagar,
    'paminnelse_dagar', i.paminnelse_dagar,
    'sparr', intern.tillagg_sparr(jag),
    'upplupet_ore', (select coalesce(sum(t.belopp_ore), 0) from public.tillagg_poster t
                      where t.familj_id = jag and t.status = 'upplupen'),
    'upplupna', (select count(*) from public.tillagg_poster t where t.familj_id = jag and t.status = 'upplupen'),
    'i_betalning_ore', (select coalesce(sum(t.belopp_ore), 0) from public.tillagg_poster t
                         where t.familj_id = jag and t.status = 'i_betalning'),
    'i_betalning', (select count(*) from public.tillagg_poster t where t.familj_id = jag and t.status = 'i_betalning'),
    'poster', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', t.id, 'bokning', t.bokning_id, 'start', t.pass_start, 'extra', t.antal_extra_barn,
                  'minuter', t.minuter, 'belopp_ore', t.belopp_ore, 'status', t.status, 'upplupen_at', t.upplupen_at)
                  order by t.pass_start, t.id), '[]'::jsonb)
                 from public.tillagg_poster t
                where t.familj_id = jag and t.status in ('bokad', 'upplupen', 'i_betalning')));
end $function$;

revoke all on function public.mitt_tillagg() from public, anon;
grant execute on function public.mitt_tillagg() to authenticated;

/* Passens barn, med förnamn och årskurs: för familjen, passets
   studiehjälpare (som inte spärras av utbildningsprovet) och admin. Ett
   syskon behöver inte vara studiehjälparens egen elev, så studiehjälparen
   ser barnen här och inte i students. Ett pass utan extra barn svarar
   med huvudbarnet. */
create or replace function public.passens_barn(p_bokningar uuid[])
 returns table (bokning_id uuid, barn_id uuid, fornamn text, arskurs text, ar_huvudbarn boolean)
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  -- syskontillagg_som_skuld (2026-10-21).
  with b as (
    select x.id, x.student_id from public.bookings x
     where x.id = any (p_bokningar[1:500])
       and (public.is_admin() or public.har_behorighet('bokningar_las') or x.parent_id = auth.uid()
            or (x.tutor_id = auth.uid() and not intern.provet_sparrar(auth.uid())))
  )
  select bb.bokning_id, bb.barn_id, intern.fornamn(s.name), s.grade, bb.ar_huvudbarn
    from b
    join public.bokning_barn bb on bb.bokning_id = b.id
    left join public.students s on s.id = bb.barn_id and s.raderad_at is null
  union all
  select b.id, b.student_id, intern.fornamn(s.name), s.grade, true
    from b
    join public.students s on s.id = b.student_id and s.raderad_at is null
   where not exists (select 1 from public.bokning_barn bb where bb.bokning_id = b.id)
$function$;

revoke all on function public.passens_barn(uuid[]) from public, anon;
grant execute on function public.passens_barn(uuid[]) to authenticated;

-- ---------- 8. passet bokas, hålls eller avbokas ----------
/* Ett nytt pass med extra barn prövas här: strömbrytaren, barnen,
   taket, familjens ja till den gällande versionen och spärren. Före
   ett pass utan extra barn händer ingenting. Priset per extra barn är
   redan fryst (bookings_frys_priset står före i namnordning). */
create or replace function intern.bookings_syskon_prova()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
declare
  jag   uuid := auth.uid();
  takt  integer;
  vers  text;
  sp    text;
  inst  public.tillagg_installning%rowtype;
begin
  new.extra_barn := coalesce(new.extra_barn, '{}');
  if cardinality(new.extra_barn) = 0 then
    return new;
  end if;

  if not coalesce((select f.aktiv from public.flaggor f where f.kod = 'syskonskuld'), false) then
    raise exception using errcode = '42501',
      message = 'Syskon på samma pass bokas inte så än. Välj antalet barn som förut.';
  end if;
  if jag is not null and jag is not distinct from new.tutor_id and not public.is_admin() then
    raise exception using errcode = '42501', message = 'Barnen väljer familjen när den bokar.';
  end if;
  if new.student_id is null then
    raise exception using errcode = '23514', message = 'Välj vilket barn passet är för först.';
  end if;
  if new.antal_barn is distinct from 1 then
    raise exception using errcode = '23514',
      message = 'Ett pass med extra barn bokas med barnen, inte med antalet.';
  end if;
  if array_position(new.extra_barn, null) is not null
     or (select count(distinct x) from unnest(new.extra_barn) x) <> cardinality(new.extra_barn)
     or new.student_id = any (new.extra_barn) then
    raise exception using errcode = '23514', message = 'Samma barn står två gånger på passet.';
  end if;
  if exists (select 1 from unnest(new.extra_barn) x
              where not exists (select 1 from public.students s
                                 where s.id = x and s.parent_id = new.parent_id and s.raderad_at is null)) then
    raise exception using errcode = '42501', message = 'Ett av barnen hör inte till familjen.';
  end if;
  select coalesce(t.extra_personer_max, 1) into takt from public.tjanster t where t.kod = new.tjanst;
  if 1 + cardinality(new.extra_barn) > coalesce(takt, 1) then
    raise exception using errcode = '23514', message = format('Högst %s barn på ett pass.', coalesce(takt, 1));
  end if;
  if coalesce(new.extra_ore, 0) <= 0 then
    raise exception using errcode = '23514', message = 'Tjänsten har inget pris för extra barn.';
  end if;

  select * into inst from public.tillagg_installning where id = 1;
  vers := coalesce(inst.villkor_version, 'utkast');
  if not exists (select 1 from public.tillagg_godkannanden g where g.familj = new.parent_id and g.version = vers) then
    raise exception using errcode = '42501',
      message = 'Godkänn villkoren för syskontillägget först. De står i rutan när ni väljer fler barn.';
  end if;

  -- Spärren gäller familjen. Admin och databasens egna vägar stoppas inte.
  if jag is not null and not public.is_admin() then
    sp := intern.tillagg_sparr(new.parent_id);
    if sp = 'belopp' then
      raise exception using errcode = '42501',
        message = format('Extra barn går inte att boka just nu: det upplupna tillägget är över %s kr. Betala det '
          || 'under Betalning, så lyfts spärren. Passet går att boka för ett barn.', inst.max_upplupet_ore / 100);
    elsif sp = 'alder' then
      raise exception using errcode = '42501',
        message = format('Extra barn går inte att boka just nu: ett tillägg har varit obetalt i mer än %s dagar. '
          || 'Betala det under Betalning, så lyfts spärren. Passet går att boka för ett barn.', inst.sparr_efter_dagar);
    end if;
  end if;
  return new;
end $function$;

revoke all on function intern.bookings_syskon_prova() from public, anon, authenticated;

create or replace trigger bookings_syskon_prova
  before insert on public.bookings
  for each row execute function intern.bookings_syskon_prova();

/* Barnen, längden och antalet står fast på ett pass med syskon: tillägget
   räknades på dem när passet bokades (Leo: "Ett motförslag på tid får inte
   ändra passets längd, annars avvisas det"). Familjen och studiehjälparen
   stoppas redan av skydda_bokningsfalt, som bara släpper tiden och läget;
   här stoppas också admin och databasens egna vägar, för de går förbi den.
   Ska något annat gälla avbokas passet och ett nytt bokas. */
create or replace function intern.bookings_syskon_star_fast()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
declare
  i public.tillagg_installning%rowtype;
begin
  -- Granskningen 2026-10-21: att flytta ett bekräftat pass inom gränsen för
  -- sen avbokning och sedan dra tillbaka förfrågan hade frigjort tillägget.
  -- Familjen flyttar därför inte ett sådant pass; den avbokar det, och då
  -- gäller regeln för sen avbokning.
  if old.status = 'confirmed' and auth.uid() is not null and auth.uid() = old.parent_id
     and (new.wanted_date is distinct from old.wanted_date or new.wanted_time is distinct from old.wanted_time)
     and exists (select 1 from public.tillagg_poster t where t.bokning_id = old.id and t.status = 'bokad') then
    select * into i from public.tillagg_installning where id = 1;
    if coalesce(i.debitera_vid_sen_avbokning, true)
       and intern.tillagg_sen_avbokning(intern.passets_start(old.wanted_date, old.wanted_time), now(),
                                        coalesce(i.sen_avbokning_timmar, 24)) then
      raise exception using errcode = '23514',
        message = format('Passet börjar inom %s timmar och har tillägg för syskon. Det flyttas inte nu: '
                         || 'avboka det (det räknas som en sen avbokning) eller låt det stå.',
                         coalesce(i.sen_avbokning_timmar, 24));
    end if;
  end if;
  if coalesce(new.extra_barn, '{}') is distinct from coalesce(old.extra_barn, '{}') then
    raise exception using errcode = '42501',
      message = 'Barnen på ett bokat pass ändras inte. Avboka passet och boka ett nytt med rätt barn.';
  end if;
  if cardinality(coalesce(old.extra_barn, '{}')) > 0
     and (new.duration_min is distinct from old.duration_min or new.antal_barn is distinct from old.antal_barn) then
    raise exception using errcode = '42501',
      message = 'Längden på ett pass med syskon ändras inte: tillägget är räknat på den. Avboka passet och boka ett nytt.';
  end if;
  return new;
end $function$;

revoke all on function intern.bookings_syskon_star_fast() from public, anon, authenticated;

-- Före bookings_timmarna_tillbaka i namnordningen, som ska stå sist.
create or replace trigger bookings_syskon_star_fast
  before update on public.bookings
  for each row execute function intern.bookings_syskon_star_fast();

/* Efter att passet skrivits: barnen och posten, med beloppet fryst. Ett
   pass utan extra barn får ingenting. Studiehjälparen får sin vanliga
   notis om passet (bookings_notis). */
create or replace function intern.bookings_syskon_skapa()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
declare
  n integer := cardinality(coalesce(new.extra_barn, '{}'));
begin
  if n = 0 then
    return null;
  end if;
  insert into public.bokning_barn (bokning_id, barn_id, ar_huvudbarn) values (new.id, new.student_id, true);
  insert into public.bokning_barn (bokning_id, barn_id, ar_huvudbarn)
  select new.id, x, false from unnest(new.extra_barn) x;
  insert into public.tillagg_poster (bokning_id, familj_id, antal_extra_barn, pris_ore_per_timme, minuter,
                                     belopp_ore, pass_start)
  values (new.id, new.parent_id, n, new.extra_ore::integer, new.duration_min,
          intern.tillaggets_belopp(n, new.extra_ore::integer, new.duration_min),
          intern.passets_start(new.wanted_date, new.wanted_time));
  return null;
end $function$;

revoke all on function intern.bookings_syskon_skapa() from public, anon, authenticated;

create or replace trigger bookings_syskon_skapa
  after insert on public.bookings
  for each row execute function intern.bookings_syskon_skapa();

/* Posten följer passet. Hållet: upplupen, nu är det en skuld. Avslaget,
   studiehjälparens avbokning och Nextrums: frigjord. Familjens avbokning
   av ett bekräftat pass: frigjord mer än gränsen före start, annars
   upplupen (eller frigjord med strömbrytaren av). En förfrågan familjen
   drar tillbaka blev aldrig ett pass: frigjord. Ett pass som flyttas
   medan posten är bokad tar posten med sig. */
create or replace function intern.bookings_syskon_foljer()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
declare
  p      public.tillagg_poster%rowtype;
  i      public.tillagg_installning%rowtype;
  ny     text;
  varfor text;
begin
  select * into p from public.tillagg_poster t where t.bokning_id = new.id for update;
  if not found then
    return null;
  end if;

  if p.status = 'bokad'
     and (new.wanted_date is distinct from old.wanted_date or new.wanted_time is distinct from old.wanted_time) then
    update public.tillagg_poster t set pass_start = intern.passets_start(new.wanted_date, new.wanted_time)
     where t.id = p.id;
  end if;

  if new.status is not distinct from old.status then
    return null;
  end if;

  if new.status = 'completed' and p.status = 'bokad' then
    ny := 'upplupen';
  elsif new.status = 'cancelled' and p.status = 'bokad' then
    if new.avbokad_av is not null and new.avbokad_av = new.parent_id then
      if old.status = 'confirmed' then
        select * into i from public.tillagg_installning where id = 1;
        if intern.tillagg_sen_avbokning(intern.passets_start(old.wanted_date, old.wanted_time), now(),
                                        coalesce(i.sen_avbokning_timmar, 24)) then
          if coalesce(i.debitera_vid_sen_avbokning, true) then
            ny := 'upplupen';
            varfor := 'Sen avbokning: familjen avbokade inom gränsen före start.';
          else
            ny := 'frigjord';
            varfor := 'Sen avbokning, utan tillägg (debitera_vid_sen_avbokning är av).';
          end if;
        else
          ny := 'frigjord';
          varfor := 'Familjen avbokade i tid.';
        end if;
      else
        ny := 'frigjord';
        varfor := 'Familjen drog tillbaka förfrågan innan den bekräftades.';
      end if;
    elsif new.avbokad_av is not null and new.avbokad_av = new.tutor_id then
      ny := 'frigjord';
      varfor := case when old.status = 'requested' and old.created_by is distinct from new.tutor_id
                     then 'Studiehjälparen avböjde tiden.' else 'Studiehjälparen avbokade passet.' end;
    else
      ny := 'frigjord';
      varfor := 'Passet avbokades av Nextrum.';
    end if;
  elsif new.status = 'cancelled' and old.status = 'completed' and p.status = 'upplupen' then
    ny := 'frigjord';
    varfor := 'Passet avbokades efter att det markerats som genomfört.';
  elsif new.status = 'cancelled' and old.status = 'completed' and p.status in ('i_betalning', 'betald') then
    -- Granskningen 2026-10-21: posten står i en betalning eller är betald.
    -- Släpps betalningen blir posten frigjord (intern.tillagg_poster_tillbaka);
    -- betalas den, eller är den betald, betalas raden tillbaka för hand.
    perform public.skapa_uppgift(
      'Ett pass med syskontillägg avbokades efter att det hållits',
      'tillagg_avbokat:' || p.id,
      'problem',
      'Tillägget för passet ' || new.id || ' ' || case when p.status = 'betald' then 'är betalt'
        else 'betalas just nu' end || '. Betala tillbaka raden under Betalningar → Syskontillägg om familjen inte '
        || 'ska betala det.',
      'profiles', p.familj_id::text);
  end if;

  if ny is not null then
    update public.tillagg_poster t set status = ny, orsak = coalesce(varfor, t.orsak) where t.id = p.id;
  end if;
  return null;
end $function$;

revoke all on function intern.bookings_syskon_foljer() from public, anon, authenticated;

create or replace trigger bookings_syskon_foljer
  after update on public.bookings
  for each row execute function intern.bookings_syskon_foljer();

-- ---------- 9. betalningsförsöken ----------
/* Posterna i ett släppt försök tillbaka: upplupna igen, utom för ett pass
   som hållits och sedan avbokats medan betalningen pågick. Den posten hade
   blivit frigjord utan försöket, och blir det nu (granskningen 2026-10-21).
   avbokad_fran säger vad passet var när det avbokades (stampla_avbokningen):
   en sen avbokning av ett bekräftat pass är en skuld, ett hållet pass som
   avbokas är det inte. */
create or replace function intern.tillagg_poster_tillbaka(p_forsok uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
begin
  update public.tillagg_poster t
     set status = case when b.status = 'cancelled' and b.avbokad_fran = 'completed'
                       then 'frigjord' else 'upplupen' end,
         orsak = case when b.status = 'cancelled' and b.avbokad_fran = 'completed'
                      then 'Passet avbokades efter att det markerats som genomfört.' else t.orsak end
    from public.bookings b
   where t.betalningsforsok_id = p_forsok and t.status = 'i_betalning' and b.id = t.bokning_id;
end $function$;

revoke all on function intern.tillagg_poster_tillbaka(uuid) from public, anon, authenticated;

/* Släpp ett öppet försök: posterna tillbaka. Svarar sant om något
   släpptes nu. Anroparen håller familjens lås. */
create or replace function intern.tillagg_forsok_slapp_inre(p_forsok uuid, p_orsak text)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
begin
  update public.tillagg_forsok f set status = 'slappt', slapp_orsak = p_orsak
   where f.id = p_forsok and f.status = 'oppen';
  if not found then
    return false;
  end if;
  perform intern.tillagg_poster_tillbaka(p_forsok);
  return true;
end $function$;

revoke all on function intern.tillagg_forsok_slapp_inre(uuid, text) from public, anon, authenticated;

/* Admin släpper ett försök som fastnat (granskningen 2026-10-21): en
   betalning med Klarna som aldrig blev klar, eller ett svar från Stripe
   som aldrig kom. Skälet krävs och står på försöket, med vem. Kommer
   pengarna ändå senare bokförs de och blir en uppgift, som en dubbel
   betalning. */
create or replace function public.tillagg_forsok_slapp_admin(p_forsok uuid, p_orsak text)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
declare
  fam uuid;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara admin släpper en betalning för syskontillägget.';
  end if;
  if char_length(btrim(coalesce(p_orsak, ''))) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'Skriv varför betalningen släpps, minst tre tecken.';
  end if;
  select f.familj into fam from public.tillagg_forsok f where f.id = p_forsok;
  if fam is null then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('tillagg:' || fam::text, 0));
  update public.tillagg_forsok f
     set status = 'slappt', slapp_orsak = 'admin', slapp_kommentar = btrim(p_orsak), slappt_av = auth.uid()
   where f.id = p_forsok and f.status = 'oppen';
  if not found then
    return false;
  end if;
  perform intern.tillagg_poster_tillbaka(p_forsok);
  return true;
end $function$;

revoke all on function public.tillagg_forsok_slapp_admin(uuid, text) from public, anon;
grant execute on function public.tillagg_forsok_slapp_admin(uuid, text) to authenticated;

/* Kassan låser familjens upplupna poster till ett försök. Bara kassan
   (stripe-checkout med service_role, efter att familjens token prövats):
   ett försök utan session hade låst skulden i en halvtimme för ingenting.

   Under familjens lås, och posterna med radlås: två flikar, en manuell
   betalning och ett köp samtidigt väntar på varandra, och den andra ser
   posterna som i_betalning och tar dem inte. Ett öppet försök för samma
   sak återanvänds medan det har mer än två minuter kvar, så att två
   tryck blir samma session hos Stripe. Bara de poster som är upplupna nu
   följer med.

   Svaret: forsok (null när inget låstes), belopp_ore, antal_pass,
   aterbruk, upphor_at, session, och pagar när andra poster redan står i
   en betalning ("En betalning pågår redan"). */
create or replace function public.tillagg_forsok_skapa(p_familj uuid, p_slag text, p_klippkort uuid default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
declare
  f      public.tillagg_forsok%rowtype;
  ids    uuid[];
  summa  bigint;
  n      integer;
  ny     uuid;
  upphor timestamptz;
  ersatt_session text;
begin
  if auth.uid() is not null then
    raise exception using errcode = '42501', message = 'Bara kassan skapar ett betalningsförsök.';
  end if;
  if p_slag not in ('manuell', 'kop') then
    raise exception using errcode = '22023', message = 'Vilket slags betalning?';
  end if;
  if (p_slag = 'kop') <> (p_klippkort is not null) then
    raise exception using errcode = '22023', message = 'Ett köp har sitt köp, en manuell betalning inget.';
  end if;
  if p_slag = 'kop' and not exists (select 1 from public.klippkort k where k.id = p_klippkort
                                       and k.parent_id = p_familj and k.status in ('vantar', 'misslyckad')) then
    raise exception using errcode = '22023', message = 'Köpet hör inte till familjen eller väntar inte på betalning.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('tillagg:' || p_familj::text, 0));

  -- Ett öppet försök för samma sak återanvänds, eller släpps när det nästan gått ut.
  select * into f from public.tillagg_forsok x
   where x.familj = p_familj and x.status = 'oppen' and x.slag = p_slag
     and x.klippkort_id is not distinct from p_klippkort
   order by x.skapad_at desc
   limit 1
   for update;
  if found then
    if f.session_klar_at is null and f.upphor_at > now() + interval '2 minutes' then
      return jsonb_build_object('forsok', f.id, 'belopp_ore', f.belopp_ore, 'antal_pass', f.antal_pass,
        'aterbruk', true, 'upphor_at', f.upphor_at, 'session', f.stripe_session_id,
        'pagar', exists (select 1 from public.tillagg_poster t where t.familj_id = p_familj
                           and t.status = 'i_betalning' and t.betalningsforsok_id <> f.id));
    end if;
    if f.session_klar_at is null then
      perform intern.tillagg_forsok_slapp_inre(f.id, 'ersatt');
      -- Kassan låter den sessionen gå ut hos Stripe (granskningen
      -- 2026-10-21), så att den inte betalas efter att posterna låsts igen.
      ersatt_session := f.stripe_session_id;
    end if;
  end if;

  select array_agg(t.id order by t.upplupen_at, t.id), coalesce(sum(t.belopp_ore), 0), count(*)
    into ids, summa, n
    from (select x.id, x.belopp_ore, x.upplupen_at from public.tillagg_poster x
           where x.familj_id = p_familj and x.status = 'upplupen'
           for update) t;

  if n = 0 then
    return jsonb_build_object('forsok', null, 'belopp_ore', 0, 'antal_pass', 0, 'ersatt_session', ersatt_session,
      'pagar', exists (select 1 from public.tillagg_poster t where t.familj_id = p_familj and t.status = 'i_betalning'));
  end if;

  -- Stripes kassa går ut efter 30 minuter (och en halv, så att Stripe godtar tiden).
  upphor := now() + interval '30 minutes 30 seconds';
  insert into public.tillagg_forsok (familj, slag, klippkort_id, belopp_ore, antal_pass, upphor_at)
  values (p_familj, p_slag, p_klippkort, summa, n, upphor)
  returning id into ny;
  insert into public.tillagg_forsok_poster (forsok_id, post_id, belopp_ore)
  select ny, t.id, t.belopp_ore from public.tillagg_poster t where t.id = any (ids);
  update public.tillagg_poster t set status = 'i_betalning', betalningsforsok_id = ny where t.id = any (ids);

  return jsonb_build_object('forsok', ny, 'belopp_ore', summa, 'antal_pass', n, 'aterbruk', false,
    'upphor_at', upphor, 'session', null, 'ersatt_session', ersatt_session,
    'pagar', exists (select 1 from public.tillagg_poster t where t.familj_id = p_familj
                       and t.status = 'i_betalning' and t.betalningsforsok_id <> ny));
end $function$;

revoke all on function public.tillagg_forsok_skapa(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.tillagg_forsok_skapa(uuid, text, uuid) to service_role;

-- Kassans session på försöket. En gång.
create or replace function public.tillagg_forsok_session(p_forsok uuid, p_session text)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
begin
  if auth.uid() is not null then
    raise exception using errcode = '42501', message = 'Bara kassan skriver sessionen.';
  end if;
  update public.tillagg_forsok f set stripe_session_id = p_session
   where f.id = p_forsok and f.status = 'oppen' and f.stripe_session_id is null;
  return found or exists (select 1 from public.tillagg_forsok f where f.id = p_forsok
                                                                 and f.stripe_session_id = p_session);
end $function$;

revoke all on function public.tillagg_forsok_session(uuid, text) from public, anon, authenticated;
grant execute on function public.tillagg_forsok_session(uuid, text) to service_role;

/* Sessionen blev klar men pengarna kommer senare (Klarna): jobbet ska
   inte släppa försöket. Stripe säger sedan async_payment_succeeded eller
   async_payment_failed. */
create or replace function public.tillagg_forsok_vantar(p_forsok uuid, p_session text)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
begin
  if auth.uid() is not null then
    raise exception using errcode = '42501', message = 'Bara webhooken skriver det.';
  end if;
  -- Försöket ur metadatan, vilken session det än var (granskningen
  -- 2026-10-21): kassan kan ha öppnat en andra, som sida i stället för
  -- inbäddad, och då hade jobbet släppt posterna medan pengarna var på väg.
  update public.tillagg_forsok f
     set session_klar_at = now(), stripe_session_id = coalesce(f.stripe_session_id, nullif(p_session, ''))
   where f.id = p_forsok and f.status = 'oppen' and f.session_klar_at is null;
  return found;
end $function$;

revoke all on function public.tillagg_forsok_vantar(uuid, text) from public, anon, authenticated;
grant execute on function public.tillagg_forsok_vantar(uuid, text) to service_role;

-- Släpp ett försök: sessionen gick ut eller avbröts, eller kassan föll.
create or replace function public.tillagg_forsok_slapp(p_forsok uuid, p_orsak text)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
declare
  fam uuid;
begin
  if auth.uid() is not null then
    raise exception using errcode = '42501', message = 'Bara kassan och webhooken släpper ett försök.';
  end if;
  if p_orsak not in ('utgangen', 'avbruten', 'jobbet', 'ersatt') then
    raise exception using errcode = '22023', message = 'Varför släpps försöket?';
  end if;
  select f.familj into fam from public.tillagg_forsok f where f.id = p_forsok;
  if fam is null then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('tillagg:' || fam::text, 0));
  return intern.tillagg_forsok_slapp_inre(p_forsok, p_orsak);
end $function$;

revoke all on function public.tillagg_forsok_slapp(uuid, text) from public, anon, authenticated;
grant execute on function public.tillagg_forsok_slapp(uuid, text) to service_role;

/* Säkerheten om webhooken missats: ett öppet försök äldre än 35 minuter,
   vars session inte blivit klar, släpps. pg_cron tillagg-forsok var 15:e
   minut. */
create or replace function intern.tillagg_forsok_stada(p_nu timestamptz default now())
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
declare
  f record;
  n integer := 0;
begin
  for f in select x.id, x.familj from public.tillagg_forsok x
            where x.status = 'oppen' and x.session_klar_at is null
              and x.skapad_at < p_nu - interval '35 minutes'
            order by x.skapad_at
  loop
    perform pg_advisory_xact_lock(hashtextextended('tillagg:' || f.familj::text, 0));
    if intern.tillagg_forsok_slapp_inre(f.id, 'jobbet') then
      n := n + 1;
    end if;
  end loop;
  -- En betalning som väntat en vecka (Klarna, eller ett svar som aldrig
  -- kom) släpps inte av jobbet, som inte kan fråga Stripe: den blir en
  -- uppgift, och admin släpper den (granskningen 2026-10-21).
  for f in select x.id, x.familj from public.tillagg_forsok x
            where x.status = 'oppen' and x.session_klar_at is not null
              and x.session_klar_at < p_nu - interval '7 days'
  loop
    perform public.skapa_uppgift(
      'En betalning av syskontillägg har väntat i en vecka',
      'tillagg_vantar:' || f.id,
      'problem',
      'Betalningen (försöket ' || f.id || ') blev klar i kassan men pengarna har inte kommit. Kontrollera den i '
        || 'Stripe. Har den inte gått igenom: släpp den under Betalningar → Syskontillägg, så blir posterna upplupna '
        || 'igen. Kommer pengarna senare bokförs de och blir en uppgift.',
      'profiles', f.familj::text);
  end loop;
  return n;
end $function$;

revoke all on function intern.tillagg_forsok_stada(timestamptz) from public, anon, authenticated;

/* Kvittot: belopp, antal pass och en rad per pass med dagen, antalet barn
   och beloppet. Inga namn på barn. */
create or replace function intern.tillagg_kvitto(p_forsok uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
declare
  f    public.tillagg_forsok%rowtype;
  data jsonb;
begin
  select * into f from public.tillagg_forsok where id = p_forsok;
  if not found then
    return;
  end if;
  data := jsonb_build_object(
    'belopp', f.belopp_ore,
    'antal_pass', f.antal_pass,
    'rader', (select coalesce(jsonb_agg(jsonb_build_object(
                'datum', (t.pass_start at time zone 'Europe/Stockholm')::date,
                'barn', t.antal_extra_barn + 1,
                'belopp', t.belopp_ore) order by t.pass_start, t.id), '[]'::jsonb)
                from public.tillagg_forsok_poster fp join public.tillagg_poster t on t.id = fp.post_id
               where fp.forsok_id = f.id));
  insert into public.notiser (mottagare, typ, trad_parent, data)
  values (f.familj, 'tillagg_kvitto', f.familj, data);
  if public.notis_vill(f.familj, 'tillagg_kvitto', 'mejl') then
    perform intern.notis_koa(f.familj, 'mejl', 'tillagg_kvitto', null, f.familj, null, data, null,
      'tillagg_kvitto:mejl:' || f.id, now(), null);
  end if;
exception when others then
  -- Ett kvitto som inte gick att köa får aldrig rulla tillbaka betalningen.
  insert into public.notis_fel (kalla, fel) values ('tillagg_kvitto ' || p_forsok, left(sqlerrm, 500));
end $function$;

revoke all on function intern.tillagg_kvitto(uuid) from public, anon, authenticated;

/* Pengarna kom, för en betalning som bara är tillägg (Betala tillägg nu).
   I en transaktion: liggarens rad, en betalningsrad per post, posterna
   betalda och försöket stängt, och kvittot köat. Svarar 'betald',
   'redan' (samma betalning en gång till), 'dubbel' (posterna hann
   betalas på annat sätt: pengarna bokförs och en uppgift skapas),
   'fel_belopp' eller 'okant'. */
create or replace function public.tillagg_forsok_betald(
  p_forsok uuid, p_pi text, p_charge text, p_belopp integer, p_skarp boolean,
  p_avgift integer default null, p_netto integer default null)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
declare
  f    public.tillagg_forsok%rowtype;
  bet  uuid;
  fam  uuid;
begin
  if auth.uid() is not null then
    raise exception using errcode = '42501', message = 'Bara webhooken skriver en betalning.';
  end if;
  if p_pi is null or p_pi !~ '^pi_[A-Za-z0-9_]+$' then
    raise exception using errcode = '22023', message = 'Betalningen saknar PaymentIntent.';
  end if;
  select x.familj into fam from public.tillagg_forsok x where x.id = p_forsok;
  if fam is null then
    return 'okant';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('tillagg:' || fam::text, 0));
  select * into f from public.tillagg_forsok where id = p_forsok for update;
  if f.slag <> 'manuell' then
    return 'okant';
  end if;

  -- Samma betalning en gång till: allt är redan skrivet.
  if exists (select 1 from public.betalningar b where b.stripe_payment_intent = p_pi) then
    return 'redan';
  end if;

  if p_belopp is distinct from f.belopp_ore
     or f.status = 'betald'
     or (f.status = 'slappt'
         and exists (select 1 from public.tillagg_forsok_poster fp join public.tillagg_poster t on t.id = fp.post_id
                      where fp.forsok_id = f.id and t.status <> 'upplupen')) then
    -- Pengarna rörde sig: de bokförs, och en människa avgör resten.
    insert into public.betalningar (familj, typ, belopp_ore, status, stripe_payment_intent, stripe_charge,
                                    avgift_ore, netto_ore, skarp, utan_rad, betald_at)
    values (f.familj, 'syskon', greatest(coalesce(p_belopp, 0), 1), 'betald', p_pi, p_charge, p_avgift, p_netto,
            p_skarp, true, now())
    on conflict (stripe_payment_intent) do nothing;
    perform public.skapa_uppgift(
      case when p_belopp is distinct from f.belopp_ore then 'Ett tillägg betalades med fel belopp'
           else 'Ett tillägg betalades två gånger' end,
      'tillagg_dubbel:' || p_pi,
      'problem',
      'En betalning för syskontillägg kom in men kunde inte skrivas på posterna (försöket '
        || f.id || '). Pengarna står i liggaren. Stäm av med familjen och betala tillbaka det som inte ska behållas.',
      'profiles', f.familj::text);
    -- Posterna står inte kvar i ett försök som aldrig kan bli betalt
    -- (granskningen 2026-10-21).
    if f.status = 'oppen' then
      perform intern.tillagg_forsok_slapp_inre(f.id, 'avbruten');
    end if;
    return case when p_belopp is distinct from f.belopp_ore then 'fel_belopp' else 'dubbel' end;
  end if;

  -- Ett släppt försök vars poster fortfarande är upplupna tas tillbaka.
  if f.status = 'slappt' then
    update public.tillagg_poster t set status = 'i_betalning', betalningsforsok_id = f.id
      from public.tillagg_forsok_poster fp
     where fp.forsok_id = f.id and fp.post_id = t.id and t.status = 'upplupen';
  end if;

  insert into public.betalningar (familj, typ, belopp_ore, status, stripe_payment_intent, stripe_charge,
                                  avgift_ore, netto_ore, skarp, betald_at)
  values (f.familj, 'syskon', p_belopp, 'betald', p_pi, p_charge, p_avgift, p_netto, p_skarp, now())
  returning id into bet;
  insert into public.betalningsrader (betalning_id, typ, belopp_ore, tillagg_post_id)
  select bet, 'syskon', t.belopp_ore, t.id
    from public.tillagg_forsok_poster fp join public.tillagg_poster t on t.id = fp.post_id
   where fp.forsok_id = f.id
   order by t.pass_start, t.id;
  update public.tillagg_poster t set status = 'betald', betalning_id = bet
    from public.tillagg_forsok_poster fp
   where fp.forsok_id = f.id and fp.post_id = t.id;
  update public.tillagg_forsok x set status = 'betald', stripe_payment_intent = p_pi, betalning_id = bet
   where x.id = f.id;
  perform intern.tillagg_kvitto(f.id);
  return 'betald';
end $function$;

revoke all on function public.tillagg_forsok_betald(uuid, text, text, integer, boolean, integer, integer)
  from public, anon, authenticated;
grant execute on function public.tillagg_forsok_betald(uuid, text, text, integer, boolean, integer, integer)
  to service_role;

/* Pengarna kom för ett köp av timmar med tillägget som egen rad. I en
   transaktion: liggarens rad med hela beloppet, köpet betalt med sin del
   (klippkort_betald, som förut), en betalningsrad för köpet med koden och
   en per post, posterna betalda, försöket stängt och kvittot köat.
   Koden och familjens rabatt gäller bara köpets rad: tillägget är vad
   posterna frös. Svarar 'betald', 'redan', 'kop_redan' (köpet väntar
   inte: webhooken gör som förut), 'dubbel' (posterna hann betalas på
   annat sätt: köpet skrivs, tilläggets del står som en rad att betala
   tillbaka och en uppgift skapas), 'fel_belopp' eller 'okant'. */
create or replace function public.klippkort_betald_med_tillagg(
  p_id uuid, p_betalt integer, p_pi text, p_charge text, p_bt text, p_avgift integer, p_netto integer,
  p_skarp boolean, p_forsok uuid)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
declare
  k     public.klippkort%rowtype;
  f     public.tillagg_forsok%rowtype;
  huvud integer;
  bet   uuid;
  typ   text;
  tar   boolean;
begin
  if auth.uid() is not null then
    raise exception using errcode = '42501', message = 'Bara webhooken skriver en betalning.';
  end if;
  if p_pi is null or p_pi !~ '^pi_[A-Za-z0-9_]+$' then
    raise exception using errcode = '22023', message = 'Betalningen saknar PaymentIntent.';
  end if;
  select * into k from public.klippkort where id = p_id;
  if not found then
    return 'okant';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('tillagg:' || k.parent_id::text, 0));
  select * into k from public.klippkort where id = p_id for update;
  select * into f from public.tillagg_forsok where id = p_forsok for update;
  if not found or f.slag <> 'kop' or f.klippkort_id is distinct from p_id or f.familj <> k.parent_id then
    return 'okant';
  end if;
  if exists (select 1 from public.betalningar b where b.stripe_payment_intent = p_pi) then
    return 'redan';
  end if;
  -- Köpet väntade inte, eller beloppet går inte ihop: webhooken bokför
  -- pengarna och en människa avgör. Försöket släpps i samma transaktion, så
  -- att posterna inte står i en betalning som aldrig blir skriven
  -- (granskningen 2026-10-21).
  if k.status not in ('vantar', 'misslyckad') then
    perform intern.tillagg_forsok_slapp_inre(f.id, 'avbruten');
    return 'kop_redan';
  end if;
  huvud := coalesce(p_betalt, 0) - f.belopp_ore;
  if huvud <= 0 then
    perform intern.tillagg_forsok_slapp_inre(f.id, 'avbruten');
    return 'fel_belopp';
  end if;

  tar := f.status = 'oppen'
         or (f.status = 'slappt'
             and not exists (select 1 from public.tillagg_forsok_poster fp
                               join public.tillagg_poster t on t.id = fp.post_id
                              where fp.forsok_id = f.id and t.status <> 'upplupen'));
  if f.status = 'slappt' and tar then
    update public.tillagg_poster t set status = 'i_betalning', betalningsforsok_id = f.id
      from public.tillagg_forsok_poster fp
     where fp.forsok_id = f.id and fp.post_id = t.id and t.status = 'upplupen';
  end if;

  typ := case when k.sort = 'plan' or k.erbjudande = 'plan_extra' then 'plan' else 'timbank' end;
  -- Liggarens rad först, med hela beloppet: köpets egen bokföring hittar den och lämnar den.
  insert into public.betalningar (familj, typ, erbjudande, klippkort_id, belopp_ore, status, kod,
                                  stripe_payment_intent, stripe_charge, avgift_ore, netto_ore, skarp, betald_at)
  values (k.parent_id, typ, k.erbjudande, k.id, p_betalt, 'betald', k.rabattkod, p_pi, p_charge, p_avgift, p_netto,
          p_skarp, now())
  returning id into bet;

  if not public.klippkort_betald(p_id, huvud, p_pi, p_charge, p_bt, p_avgift, p_netto, p_skarp) then
    raise exception 'klippkort_betald skrev inget på köpet %', p_id;
  end if;

  insert into public.betalningsrader (betalning_id, typ, belopp_ore, klippkort_id, kod)
  values (bet, typ, huvud, k.id, k.rabattkod);

  if tar then
    insert into public.betalningsrader (betalning_id, typ, belopp_ore, tillagg_post_id)
    select bet, 'syskon', t.belopp_ore, t.id
      from public.tillagg_forsok_poster fp join public.tillagg_poster t on t.id = fp.post_id
     where fp.forsok_id = f.id
     order by t.pass_start, t.id;
    update public.tillagg_poster t set status = 'betald', betalning_id = bet
      from public.tillagg_forsok_poster fp
     where fp.forsok_id = f.id and fp.post_id = t.id;
    update public.tillagg_forsok x set status = 'betald', stripe_payment_intent = p_pi, betalning_id = bet
     where x.id = f.id;
    perform intern.tillagg_kvitto(f.id);
    return 'betald';
  end if;

  insert into public.betalningsrader (betalning_id, typ, belopp_ore, beskrivning)
  values (bet, 'syskon', f.belopp_ore, 'Tillägget hann betalas på annat sätt. Betala tillbaka raden.');
  perform public.skapa_uppgift(
    'Ett tillägg betalades två gånger',
    'tillagg_dubbel:' || p_pi,
    'problem',
    'Ett köp av timmar betalades med syskontillägget som egen rad, men posterna hann betalas på annat sätt '
      || '(försöket ' || f.id || '). Köpet är betalt. Betala tillbaka tilläggets rad under Betalningar → Liggaren.',
    'klippkort', k.id::text);
  return 'dubbel';
end $function$;

revoke all on function public.klippkort_betald_med_tillagg(uuid, integer, text, text, text, integer, integer, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.klippkort_betald_med_tillagg(uuid, integer, text, text, text, integer, integer, boolean, uuid)
  to service_role;

-- ---------- 10. återbetalning och tvist ----------
/* Återbetalningarna per rad, som webhooken fördelat dem ur Stripes lista
   (fordelaAterbetalningar i _delad/tillagg.ts): p_per_rad är
   {radens id: hela det återbetalda på raden}, och p_totalt hela det
   återbetalda på betalningen. Summor, inte tillägg: samma händelse två
   gånger ändrar ingenting. En rad får aldrig mer tillbaka än den
   betalade, och en post som fått allt tillbaka blir aterbetald. Svarar
   antalet rader som ändrades. */
create or replace function public.betalningsrader_aterbetalda(p_pi text, p_per_rad jsonb, p_totalt integer)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
declare
  b   public.betalningar%rowtype;
  r   record;
  n   integer := 0;
  m   integer;
begin
  if auth.uid() is not null then
    raise exception using errcode = '42501', message = 'Bara webhooken och återbetalningen skriver det.';
  end if;
  select * into b from public.betalningar where stripe_payment_intent = p_pi for update;
  if not found then
    return 0;
  end if;
  for r in select key, value from jsonb_each(coalesce(p_per_rad, '{}'::jsonb)) loop
    continue when r.key !~ '^[0-9a-f-]{36}$' or jsonb_typeof(r.value) <> 'number';
    update public.betalningsrader x
       set aterbetalt_ore = least(greatest((r.value #>> '{}')::numeric, 0), x.belopp_ore)::integer
     where x.id = r.key::uuid and x.betalning_id = b.id
       and least(greatest((r.value #>> '{}')::numeric, 0), x.belopp_ore)::integer > x.aterbetalt_ore;
    get diagnostics m = row_count;
    n := n + m;
  end loop;

  -- Posterna följer sin rad: hela tillbaka blir aterbetald, en del står kvar som betald.
  update public.tillagg_poster t
     set aterbetalt_ore = x.aterbetalt_ore,
         status = case when x.aterbetalt_ore >= t.belopp_ore then 'aterbetald' else t.status end
    from public.betalningsrader x
   where x.betalning_id = b.id and x.tillagg_post_id = t.id
     and t.status in ('betald', 'aterbetald') and x.aterbetalt_ore > t.aterbetalt_ore;

  update public.betalningar x
     set aterbetalt_ore = greatest(x.aterbetalt_ore, least(coalesce(p_totalt, 0), x.belopp_ore)),
         status = intern.betalning_lage(case when x.status = 'tvist' then 'tvist' else 'betald' end, x.belopp_ore,
                                        greatest(x.aterbetalt_ore, least(coalesce(p_totalt, 0), x.belopp_ore))),
         andrad_at = now()
   where x.id = b.id and x.aterbetalt_ore < least(coalesce(p_totalt, 0), x.belopp_ore);
  return n;
end $function$;

revoke all on function public.betalningsrader_aterbetalda(text, jsonb, integer) from public, anon, authenticated;
grant execute on function public.betalningsrader_aterbetalda(text, jsonb, integer) to service_role;

/* En tvist på en betalning som bara är tillägg (Betala tillägg nu):
   liggarens rad flaggas, och inget annat görs. Ett köp med tillägg
   flaggas genom köpet, som förut. p_utfall är 'oppen', 'vunnen' eller
   'forlorad' (tvistUtfall i webhooken). */
create or replace function public.betalning_tvist(p_charge text, p_utfall text)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
begin
  if auth.uid() is not null then
    raise exception using errcode = '42501', message = 'Bara webhooken skriver en tvist.';
  end if;
  update public.betalningar x
     set status = intern.betalning_lage(case when p_utfall = 'vunnen' then 'betald' else 'tvist' end,
                                        x.belopp_ore, x.aterbetalt_ore),
         andrad_at = now()
   where x.stripe_charge = p_charge and x.typ = 'syskon'
     -- En helt återbetald betalning har fått tillbaka pengarna en gång; tvisten
     -- syns i stripe_tvister (granskningen 2026-10-21, som passen).
     and x.aterbetalt_ore < x.belopp_ore
     and x.status is distinct from intern.betalning_lage(case when p_utfall = 'vunnen' then 'betald' else 'tvist' end,
                                                         x.belopp_ore, x.aterbetalt_ore);
  return found;
end $function$;

revoke all on function public.betalning_tvist(text, text) from public, anon, authenticated;
grant execute on function public.betalning_tvist(text, text) to service_role;

/* Admins Återbetala på en tilläggsrad: det som går att betala tillbaka.
   stripe-aterbetalning frågar med admins token och betalar tillbaka med
   radens id i Stripes metadata. */
create or replace function public.betalningsrad_att_aterbetala(p_rad uuid)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
declare
  x  public.betalningsrader%rowtype;
  b  public.betalningar%rowtype;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum betalar tillbaka.';
  end if;
  select * into x from public.betalningsrader where id = p_rad;
  if not found or x.typ <> 'syskon' then
    raise exception using errcode = '22023', message = 'Raden är inte ett syskontillägg.';
  end if;
  select * into b from public.betalningar where id = x.betalning_id;
  if b.status = 'tvist' then
    raise exception using errcode = '23514', message = 'Betalningen står i tvist och betalas inte tillbaka härifrån.';
  end if;
  return jsonb_build_object('rad', x.id, 'betalning', b.id, 'pi', b.stripe_payment_intent,
    'charge', b.stripe_charge, 'post', x.tillagg_post_id, 'familj', b.familj, 'skarp', b.skarp,
    'kvar_ore', x.belopp_ore - x.aterbetalt_ore);
end $function$;

revoke all on function public.betalningsrad_att_aterbetala(uuid) from public, anon;
grant execute on function public.betalningsrad_att_aterbetala(uuid) to authenticated;

-- ---------- 11. admins knappar ----------
/* Frigör: ett pass som inte hölls av studiehjälparens skuld, eller som
   inte ska kosta. Orsaken krävs och står på posten (inte i auditloggen,
   som bara tar lägen). */
create or replace function public.tillagg_frigor(p_post uuid, p_orsak text)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
declare
  p  public.tillagg_poster%rowtype;
  o  text := btrim(coalesce(p_orsak, ''));
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum frigör ett tillägg.';
  end if;
  if char_length(o) < 3 or char_length(o) > 500 then
    raise exception using errcode = '22023', message = 'Skriv varför tillägget frigörs (3–500 tecken).';
  end if;
  select * into p from public.tillagg_poster where id = p_post;
  if not found then
    raise exception using errcode = '22023', message = 'Tillägget finns inte.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('tillagg:' || p.familj_id::text, 0));
  select * into p from public.tillagg_poster where id = p_post for update;
  if p.status = 'i_betalning' then
    raise exception using errcode = '23514', message = 'Tillägget ingår i en betalning som pågår. Försök igen om en stund.';
  end if;
  if p.status not in ('bokad', 'upplupen') then
    raise exception using errcode = '23514', message = 'Bara ett bokat eller upplupet tillägg kan frigöras.';
  end if;
  update public.tillagg_poster t set status = 'frigjord', orsak = o, andrad_av = auth.uid() where t.id = p.id;
  return 'frigjord';
end $function$;

revoke all on function public.tillagg_frigor(uuid, text) from public, anon;
grant execute on function public.tillagg_frigor(uuid, text) to authenticated;

-- Avskriv: en skuld vi slutar driva in. Orsaken krävs, och läget loggas.
create or replace function public.tillagg_skriv_av(p_post uuid, p_orsak text)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
declare
  p  public.tillagg_poster%rowtype;
  o  text := btrim(coalesce(p_orsak, ''));
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum skriver av ett tillägg.';
  end if;
  if char_length(o) < 3 or char_length(o) > 500 then
    raise exception using errcode = '22023', message = 'Skriv varför tillägget skrivs av (3–500 tecken).';
  end if;
  select * into p from public.tillagg_poster where id = p_post;
  if not found then
    raise exception using errcode = '22023', message = 'Tillägget finns inte.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('tillagg:' || p.familj_id::text, 0));
  select * into p from public.tillagg_poster where id = p_post for update;
  if p.status = 'i_betalning' then
    raise exception using errcode = '23514', message = 'Tillägget ingår i en betalning som pågår. Försök igen om en stund.';
  end if;
  if p.status <> 'upplupen' then
    raise exception using errcode = '23514', message = 'Bara ett upplupet tillägg skrivs av.';
  end if;
  update public.tillagg_poster t set status = 'avskriven', orsak = o, andrad_av = auth.uid() where t.id = p.id;
  return 'avskriven';
end $function$;

revoke all on function public.tillagg_skriv_av(uuid, text) from public, anon;
grant execute on function public.tillagg_skriv_av(uuid, text) to authenticated;

/* En påminnelse till familjen om det upplupna: belopp, antal pass och
   en länk till Betalning, inga namn på barn. Jobbet skickar när den
   äldsta posten är ÄLDRE än paminnelse_dagar och den förra påminnelsen
   är minst så många dagar gammal; admins knapp skickar när som helst,
   en gång om dagen. Dagarna räknas i Stockholmsdatum. Svarar sant om en
   påminnelse lades nu. */
create or replace function intern.tillagg_paminnelse_koa_en(p_familj uuid, p_nu timestamptz, p_manuell boolean)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
declare
  i       public.tillagg_installning%rowtype;
  idag    date := (p_nu at time zone 'Europe/Stockholm')::date;
  summa   bigint;
  antal   integer;
  aldsta  timestamptz;
  senast  date;
  data    jsonb;
begin
  if exists (select 1 from public.profiles p where p.id = p_familj and p.raderad_at is not null) then
    return false;
  end if;
  select * into i from public.tillagg_installning where id = 1;
  select coalesce(sum(t.belopp_ore), 0), count(*), min(t.upplupen_at) into summa, antal, aldsta
    from public.tillagg_poster t where t.familj_id = p_familj and t.status = 'upplupen';
  if antal = 0 then
    return false;
  end if;
  if not p_manuell and idag - (aldsta at time zone 'Europe/Stockholm')::date <= i.paminnelse_dagar then
    return false;
  end if;
  select max((n.skapad at time zone 'Europe/Stockholm')::date) into senast
    from public.notiser n where n.mottagare = p_familj and n.typ = 'tillagg_paminnelse';
  if senast is not null and (senast >= idag or (not p_manuell and idag - senast < i.paminnelse_dagar)) then
    return false;
  end if;

  data := jsonb_build_object('belopp', summa, 'antal_pass', antal);
  insert into public.notiser (mottagare, typ, trad_parent, data, skapad)
  values (p_familj, 'tillagg_paminnelse', p_familj, data, p_nu);
  if public.notis_vill(p_familj, 'tillagg_paminnelse', 'mejl') then
    perform intern.notis_koa(p_familj, 'mejl', 'tillagg_paminnelse', null, p_familj, null, data, null,
      'tillagg_paminnelse:mejl:' || p_familj || ':' || idag, p_nu,
      ((idag + 1)::timestamp at time zone 'Europe/Stockholm'));
  end if;
  return true;
end $function$;

revoke all on function intern.tillagg_paminnelse_koa_en(uuid, timestamptz, boolean) from public, anon, authenticated;

-- pg_cron tillagg-paminnelse, en gång om dagen.
create or replace function intern.tillagg_paminnelser_koa(p_nu timestamptz default now())
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
declare
  f record;
  n integer := 0;
begin
  for f in select distinct t.familj_id from public.tillagg_poster t where t.status = 'upplupen' loop
    if intern.tillagg_paminnelse_koa_en(f.familj_id, p_nu, false) then
      n := n + 1;
    end if;
  end loop;
  return n;
end $function$;

revoke all on function intern.tillagg_paminnelser_koa(timestamptz) from public, anon, authenticated;

-- Admins Skicka påminnelse.
create or replace function public.tillagg_paminn(p_familj uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum skickar en påminnelse.';
  end if;
  return intern.tillagg_paminnelse_koa_en(p_familj, now(), true);
end $function$;

revoke all on function public.tillagg_paminn(uuid) from public, anon;
grant execute on function public.tillagg_paminn(uuid) to authenticated;

-- Admins översikt: det upplupna per familj, den äldsta posten och spärren.
create or replace function public.tillagg_oversikt()
 returns table (familj uuid, upplupet_ore bigint, upplupna integer, i_betalning_ore bigint,
                aldsta_upplupen_at timestamptz, sparr text, senaste_paminnelse timestamptz)
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (2026-10-21).
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum ser alla familjers tillägg.';
  end if;
  return query
    select t.familj_id,
           coalesce(sum(t.belopp_ore) filter (where t.status = 'upplupen'), 0)::bigint,
           (count(*) filter (where t.status = 'upplupen'))::integer,
           coalesce(sum(t.belopp_ore) filter (where t.status = 'i_betalning'), 0)::bigint,
           min(t.upplupen_at),
           intern.tillagg_sparr(t.familj_id),
           (select max(n.skapad) from public.notiser n
             where n.mottagare = t.familj_id and n.typ = 'tillagg_paminnelse')
      from public.tillagg_poster t
     where t.status in ('upplupen', 'i_betalning')
     group by t.familj_id
     order by 2 desc;
end $function$;

revoke all on function public.tillagg_oversikt() from public, anon;
grant execute on function public.tillagg_oversikt() to authenticated;

-- ---------- 12. notiserna ----------
-- Typerna i båda listorna, och i _delad/notiser/typer.ts i samma ändring.
do $lapp$
declare
  namn    text;
  fore    text;
  gammal  text := $g$'kort_nekat']$g$;
  ny      text := $n$'kort_nekat', 'tillagg_paminnelse', 'tillagg_kvitto']$n$;
  traffar integer;
begin
  foreach namn in array array['public.notis_typer()', 'public.notis_mejlbara()'] loop
    fore := pg_get_functiondef(namn::regprocedure);
    if position('tillagg_kvitto' in fore) > 0 then
      continue;
    end if;
    traffar := (length(fore) - length(replace(fore, gammal, ''))) / length(gammal);
    if traffar <> 1 then
      raise exception '%: listan slutar inte på kort_nekat (% träffar). Läs driften.', namn, traffar;
    end if;
    execute replace(fore, gammal, ny);
  end loop;
end $lapp$;

-- ---------- 13. radering ----------
/* En familj med tillägg raderas aldrig helt: posterna står kvar och
   nyckeln är restrict. Obetalt tillägg är ett hinder, som pengar som inte
   är uppgjorda: skriv av det eller låt familjen betala först. */
do $lapp$
declare
  fore    text;
  efter   text;
  traffar integer;
  a1 text := $a$hinder := hinder || intern.radering_rad('betalt_for_lange', n, m);$a$;
  b1 text := $b$hinder := hinder || intern.radering_rad('betalt_for_lange', n, m);

    -- syskontillagg_som_skuld (2026-10-21): obetalt syskontillägg skrivs av eller betalas först.
    select count(*), coalesce(sum(t.belopp_ore), 0) into n, m from public.tillagg_poster t
     where t.familj_id = p_id and t.status in ('upplupen', 'i_betalning');
    hinder := hinder || intern.radering_rad('tillagg_obetalt', n, m);$b$;
  a2 text := $a$or exists (select 1 from public.betalningar x where x.familj = p_id)$a$;
  b2 text := $b$or exists (select 1 from public.betalningar x where x.familj = p_id)
       -- syskontillagg_som_skuld (2026-10-21): posten raderas aldrig.
       or exists (select 1 from public.tillagg_poster t where t.familj_id = p_id)$b$;
  a3 text := $a$     where b.student_id = p_id and b.status = 'confirmed' and intern.passet_har_borjat(b);
    hinder := hinder || intern.radering_rad('ej_rapporterat', n);$a$;
  b3 text := $b$     where b.student_id = p_id and b.status = 'confirmed' and intern.passet_har_borjat(b);
    hinder := hinder || intern.radering_rad('ej_rapporterat', n);

    -- syskontillagg_som_skuld (granskningen 2026-10-21): barnet är med som
    -- syskon på ett kommande pass. Barnen på ett pass ändras inte, så passet
    -- avbokas först, och tillägget frigörs då.
    select count(*) into n from public.bookings b
     where p_id = any (b.extra_barn) and b.status in ('requested', 'confirmed') and not intern.passet_har_borjat(b);
    hinder := hinder || intern.radering_rad('syskon_kommande', n);$b$;
begin
  fore := pg_get_functiondef('intern.radering_underlag(text,uuid)'::regprocedure);
  if position('tillagg_obetalt' in fore) > 0 then
    return;
  end if;
  traffar := (length(fore) - length(replace(fore, a1, ''))) / length(a1);
  if traffar <> 1 then
    raise exception 'radering_underlag: % träffar på betalt_for_lange. Läs driften.', traffar;
  end if;
  traffar := (length(fore) - length(replace(fore, a2, ''))) / length(a2);
  if traffar <> 1 then
    raise exception 'radering_underlag: % träffar på betalningar. Läs driften.', traffar;
  end if;
  traffar := (length(fore) - length(replace(fore, a3, ''))) / length(a3);
  if traffar <> 1 then
    raise exception 'radering_underlag: % träffar på elevens ej_rapporterat. Läs driften.', traffar;
  end if;
  efter := replace(replace(replace(fore, a1, b1), a2, b2), a3, b3);
  execute efter;
end $lapp$;

do $lapp$
declare
  fore    text;
  traffar integer;
  a text := $a$or exists (select 1 from public.stripe_tvister t where t.booking_id = b.id)$a$;
  b text := $b$or exists (select 1 from public.stripe_tvister t where t.booking_id = b.id)
      -- syskontillagg_som_skuld (2026-10-21): ett pass med ett tillägg står kvar.
      or exists (select 1 from public.tillagg_poster t where t.bokning_id = b.id)$b$;
begin
  fore := pg_get_functiondef('intern.passet_bar_bokforing(public.bookings)'::regprocedure);
  if position('tillagg_poster' in fore) > 0 then
    return;
  end if;
  traffar := (length(fore) - length(replace(fore, a, ''))) / length(a);
  if traffar <> 1 then
    raise exception 'passet_bar_bokforing: % träffar på stripe_tvister. Läs driften.', traffar;
  end if;
  execute replace(fore, a, b);
end $lapp$;

-- ---------- 14. rättigheter ----------
alter table public.tillagg_installning enable row level security;
alter table public.tillagg_godkannanden enable row level security;
alter table public.bokning_barn enable row level security;
alter table public.tillagg_poster enable row level security;
alter table public.tillagg_forsok enable row level security;
alter table public.tillagg_forsok_poster enable row level security;
alter table public.betalningsrader enable row level security;

revoke all on public.tillagg_installning, public.tillagg_godkannanden, public.bokning_barn, public.tillagg_poster,
              public.tillagg_forsok, public.tillagg_forsok_poster, public.betalningsrader
  from anon, authenticated;
do $$
declare
  roll text;
begin
  foreach roll in array array['nextrum_barn', 'nextrum_ai'] loop
    if exists (select 1 from pg_roles where rolname = roll) then
      execute format('revoke all on public.tillagg_installning, public.tillagg_godkannanden, public.bokning_barn, '
        || 'public.tillagg_poster, public.tillagg_forsok, public.tillagg_forsok_poster, public.betalningsrader '
        || 'from %I', roll);
    end if;
  end loop;
end $$;
grant select on public.tillagg_installning, public.tillagg_godkannanden, public.bokning_barn, public.tillagg_poster,
                public.tillagg_forsok, public.tillagg_forsok_poster, public.betalningsrader
  to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tillagg_installning'
                  and policyname = 'inloggade läser tilläggets inställningar') then
    create policy "inloggade läser tilläggets inställningar" on public.tillagg_installning
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tillagg_godkannanden'
                  and policyname = 'familjen och admin läser godkännandena') then
    create policy "familjen och admin läser godkännandena" on public.tillagg_godkannanden
      for select to authenticated using (familj = (select auth.uid()) or (select public.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'bokning_barn'
                  and policyname = 'familjen och admin läser passens barn') then
    create policy "familjen och admin läser passens barn" on public.bokning_barn
      for select to authenticated using (
        (select public.is_admin()) or (select public.har_behorighet('bokningar_las'))
        or exists (select 1 from public.bookings b where b.id = bokning_id and b.parent_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tillagg_poster'
                  and policyname = 'familjen och admin läser tilläggen') then
    create policy "familjen och admin läser tilläggen" on public.tillagg_poster
      for select to authenticated using (familj_id = (select auth.uid()) or (select public.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tillagg_forsok'
                  and policyname = 'familjen och admin läser betalningsförsöken') then
    create policy "familjen och admin läser betalningsförsöken" on public.tillagg_forsok
      for select to authenticated using (familj = (select auth.uid()) or (select public.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tillagg_forsok_poster'
                  and policyname = 'admin läser försökens poster') then
    create policy "admin läser försökens poster" on public.tillagg_forsok_poster
      for select to authenticated using ((select public.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'betalningsrader'
                  and policyname = 'admin läser betalningens rader') then
    create policy "admin läser betalningens rader" on public.betalningsrader
      for select to authenticated using ((select public.is_admin()));
  end if;
end $$;

-- ---------- 15. jobben ----------
select cron.unschedule(jobid) from cron.job where jobname in ('tillagg-forsok', 'tillagg-paminnelse');
select cron.schedule('tillagg-forsok', '*/15 * * * *', $$select intern.tillagg_forsok_stada()$$);
-- 08.23 UTC är 09.23 eller 10.23 i Stockholm: mejlet kommer på förmiddagen.
select cron.schedule('tillagg-paminnelse', '23 8 * * *', $$select intern.tillagg_paminnelser_koa()$$);

-- ---------- 16. kodernas statistik räknar inte tillägget (granskningen 2026-10-21) ----------
/* En plan med tilläggen som egna rader är en betalning i liggaren, med
   planens kod och hela beloppet. kod_statistik, partner_statistik och
   kodens_anvandningar summerade betalningens belopp, så en partners volym
   blåstes upp med syskontillägget. Nu räknas betalningens rader utom
   tilläggens: köpet, det koden gällde. En betalning utan rader (bara före
   betalningar_rader har gått) räknas hel, som förut. */
create or replace function intern.betalningens_kopdel(p_betalning uuid, p_belopp integer, p_aterbetalt integer,
                                                     out belopp_ore integer, out aterbetalt_ore integer)
 language sql
 stable
 set search_path to ''
as $function$
-- syskontillagg_som_skuld (granskningen 2026-10-21).
  select case when count(*) = 0 then p_belopp
              else coalesce(sum(r.belopp_ore) filter (where r.typ <> 'syskon'), 0)::integer end,
         case when count(*) = 0 then p_aterbetalt
              else coalesce(sum(r.aterbetalt_ore) filter (where r.typ <> 'syskon'), 0)::integer end
    from public.betalningsrader r
   where r.betalning_id = p_betalning
$function$;

revoke all on function intern.betalningens_kopdel(uuid, integer, integer) from public, anon, authenticated;

do $lapp$
declare
  f       text;
  fore    text;
  traffar integer;
  a1 text := $a$join public.betalningar b on b.id = a.betalning_id$a$;
  b1 text := $b$join (select b0.id, b0.skarp, b0.erbjudande, b0.status, d.belopp_ore, d.aterbetalt_ore
            from public.betalningar b0
            cross join lateral intern.betalningens_kopdel(b0.id, b0.belopp_ore, b0.aterbetalt_ore) d) b
      on b.id = a.betalning_id -- syskontillagg_som_skuld (granskningen 2026-10-21): utan tilläggens rader$b$;
begin
  foreach f in array array['public.kod_statistik(boolean)', 'public.partner_statistik(boolean)',
                           'public.kodens_anvandningar(text)'] loop
    fore := pg_get_functiondef(f::regprocedure);
    if position('granskningen 2026-10-21' in fore) > 0 then
      continue;
    end if;
    traffar := (length(fore) - length(replace(fore, a1, ''))) / length(a1);
    if traffar <> 1 then
      raise exception '%: % träffar på betalningens join. Läs driften.', f, traffar;
    end if;
    execute replace(fore, a1, b1);
  end loop;
end $lapp$;

-- ---------- 17. bokslutet räknar syskontillägget (granskningen 2026-10-21) ----------
/* manad_lage räknade passens kort och övertiden, men inte tilläggen: en
   månad med Betala tillägg nu, eller ett köp med tillägget som egen rad,
   hade pengar in som bokslutet inte såg. Nu står de under syskon, på
   dagen de betalades i Stockholm, som Månadens ekonomi och Betalningar
   räknar dem. Testbetalningar räknas inte. */
do $lapp$
declare
  fore    text;
  traffar integer;
  a1 text := $a$    'test', ($a$;
  b1 text := $b$    'syskon', (
      -- syskontillagg_som_skuld (granskningen 2026-10-21)
      select jsonb_build_object(
        'antal', count(distinct r.betalning_id),
        'betalt_ore', coalesce(sum(r.belopp_ore), 0),
        'aterbetalt_ore', coalesce(sum(r.aterbetalt_ore), 0))
        from public.betalningsrader r
        join public.betalningar bt on bt.id = r.betalning_id
       where r.typ = 'syskon' and bt.skarp is not false
         and (bt.betald_at at time zone 'Europe/Stockholm')::date >= forsta
         and (bt.betald_at at time zone 'Europe/Stockholm')::date < sista),
    'test', ($b$;
begin
  fore := pg_get_functiondef('public.manad_lage(date)'::regprocedure);
  if position('granskningen 2026-10-21' in fore) > 0 then
    return;
  end if;
  traffar := (length(fore) - length(replace(fore, a1, ''))) / length(a1);
  if traffar <> 1 then
    raise exception 'manad_lage: % träffar på testbetalningarna. Läs driften.', traffar;
  end if;
  execute replace(fore, a1, b1);
end $lapp$;
