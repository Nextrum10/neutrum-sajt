-- ============================================================
-- Koderna gäller bara när familjen köper en plan, partnerkoder, och
-- varje användning står vid betalningen (2026-10-21, Fas 4.1)
--
-- Beställningen (Leo, 2026-10-21): "Bygg en flik Koder i admin med två
-- typer: partnerkod (spårar partnerföreningars volym) och rabattkod
-- (t.ex. Zayans). Båda gäller ENBART planköp, aldrig enskilda pass."
-- En tabell för koderna (kod, typ, partnerns namn, rabattens typ och
-- värde, som får vara noll, aktiv, giltig från och till, högst antal
-- användningar) och en för användningarna, kopplad till betalningen. En
-- kod per köp, ingen stapling. Koden prövas och rabatten räknas på
-- servern innan kassan skapas. Statistik per partner: antal familjer,
-- köpta timmar, genomförda timmar och belopp. Rader raderas inte, och
-- partnerkopplingen sparas på familjen första gången.
--
-- KODERNA ÄR rabattkoder, som finns sedan Fas 19.5 (beställningens namn
-- var beskrivningar, inte facit): kod (versaler), typ är rabattens typ
-- ('procent', eller 'belopp' i öre, kronor i vyn), varde är rabattens
-- värde, aktiv, giltig_fran, giltig_till, max_anvandningar och
-- max_per_familj (2026-10-13). Nytt här:
--
--   1. rabattkoder.sort ('rabatt' eller 'partner') och partner_namn, som
--      en partnerkod måste ha och en rabattkod inte får ha. varde får
--      vara noll: en partnerkod som bara räknar familjerna. Villkoret på
--      varde byts, och det är filens enda drop (drop constraint if
--      exists, sedan samma namn med >= 0), utanför ett do-block så att
--      verktygen ser den. En kods namn och sort ändras aldrig, och en kod
--      raderas aldrig (delete och truncate nekas med triggrar, och
--      authenticated har inte längre rätten): den stängs av.
--   2. BARA PLANER. intern.rabattkod_prova säger nej till varje pass, med
--      samma svar för alla koder, och kolla_rabattkod (passets ruta) får
--      därför alltid det svaret. bookings_kod_bara_pa_planer tar bort en
--      ny kod från ett pass för alla, också admin och databasen själv
--      (TIPS är tipstimmens markering och står kvar); ett pass som redan
--      bär en kod från förut behåller den, för priset är fryst på den.
--      På köpen gäller koden bara en plan i katalogen (erbjudanden.sort =
--      'plan'), aldrig Fyll timbanken, timmar till planen eller
--      gratistimmar (intern.kod_galler_kopet).
--   3. EN KOD PER KÖP: klippkort.rabattkod är en kolumn, och en kod
--      läggs aldrig ovanpå en annan. Familjens rabatt och den första
--      planens gratis timme är inga koder och står som Leo bestämde dem
--      2026-10-15 (de staplas med koden).
--   4. kod_anvandningar: en rad per betalt köp med en kod, kopplad till
--      raden i betalningsliggaren (betalning_id), skriven av databasen
--      när betalningen bokförs (betalningar_kod_anvands) och aldrig av en
--      klient. Raden står fast och raderas aldrig; bara kopplingen till
--      köpet blir tom om köpet tas bort (rensa-testkonto.sql).
--   5. familjens_partner: partnerkoden familjen använde första gången,
--      skriven samtidigt och aldrig ändrad. Familjens profil får inga nya
--      kolumner (skydda_profilfalt), så den står i en egen tabell.
--      Avidentifieras familjen tas raden bort (profiles_partner_rensas),
--      som familjens rabatt: den säger vilken förening familjen kom genom.
--   6. kod_pa_planen(): som kolla_rabattkod_kop, och svarar också
--      rabattens typ och värde, så att kassan kan räkna om rabatten och
--      se att den stämmer innan Stripe får beloppet (_delad/koder.ts).
--      kolla_rabattkod_kop svarar som förut, ur kod_pa_planen.
--   7. kod_statistik(), partner_statistik() och kodens_anvandningar(),
--      bara superadmin: familjer, köp, köpta timmar, genomförda timmar
--      (pass med rapport som timmarna i köpen betalade, samma uttryck som
--      intern.kortets_anvanda), betalt, återbetalt och rabatten.
--      Testbetalningar räknas inte, som i resten av adminvyn, utom när
--      admin ber om dem (p_med_test): Stripe står i testläge än.
--   8. Giltig från och till räknas i svensk tid, inte i UTC.
--
-- intern.har_timmar (timmarna i timbanken stängde koden på ett pass,
-- 2026-10-13) frågas inte längre av något: bara passen frågade. Den står
-- kvar, utan drop.
--
-- Vakterna prövar funktionernas kroppar mot driften som den byggs ur
-- migrationerna (md5 på prosrc), och en kropp som redan bär
-- koder_for_planer släpps igenom, så filen går att köra två gånger.
-- Inget delete. Kräver betalningsliggaren (20261021120000).
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 0. driften är som den lästes ----------
do $$
declare
  f   record;
  src text;
begin
  if to_regclass('public.betalningar') is null then
    raise exception 'Kör betalningsliggaren (20261021120000) först: kodernas användning står vid betalningen.';
  end if;
  for f in
    select * from (values
      ('intern.rabattkod_prova(text,text,bigint,uuid,boolean)', '2105daf4d3fae7eaee21f289862e2766'),
      ('public.kolla_rabattkod_kop(text,text)',                 '45e8894806f92a5d3e43d28d333c52a9'),
      ('intern.klippkort_rabatt()',                             '293c9457c8f024746af946670185e41c')) v(namn, summa)
  loop
    select p.prosrc into src from pg_proc p where p.oid = f.namn::regprocedure;
    if position('koder_for_planer' in src) = 0 and md5(src) <> f.summa then
      raise exception '% har ändrats sedan koder_for_planer skrevs (md5 %). Läs driften och skriv om migrationen.',
        f.namn, md5(src);
    end if;
  end loop;
end $$;


-- ---------- 1. koderna: sort, partnern och noll i rabatt ----------
alter table public.rabattkoder add column if not exists sort text not null default 'rabatt';
alter table public.rabattkoder add column if not exists partner_namn text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.rabattkoder'::regclass
                  and conname = 'rabattkoder_sort_check') then
    alter table public.rabattkoder
      add constraint rabattkoder_sort_check check (sort in ('rabatt', 'partner'));
  end if;
  -- En partnerkod har en partner, en rabattkod har ingen.
  if not exists (select 1 from pg_constraint where conrelid = 'public.rabattkoder'::regclass
                  and conname = 'rabattkoder_partner_check') then
    alter table public.rabattkoder
      add constraint rabattkoder_partner_check check (
        case when sort = 'partner'
             then partner_namn is not null and char_length(btrim(partner_namn)) between 2 and 80
             else partner_namn is null end);
  end if;
end $$;

-- Rabatten får vara noll: en partnerkod som bara räknar. Procent över 100
-- är som förut ingen rabatt.
alter table public.rabattkoder drop constraint if exists rabattkoder_varde_check;
alter table public.rabattkoder
  add constraint rabattkoder_varde_check check (varde >= 0 and (typ <> 'procent' or varde <= 100));

create index if not exists rabattkoder_partner on public.rabattkoder (partner_namn) where sort = 'partner';

comment on table public.rabattkoder is
  'Koderna (rabattkoder och, sedan 2026-10-21, partnerkoder). Gäller bara när familjen köper en plan, aldrig ett pass '
  '(koder_for_planer). Bara superadmin läser och skriver. Raderas aldrig, stängs av. TIPS är tipstimmens markering på '
  'ett pass, aldrig en kod någon skriver in.';
comment on column public.rabattkoder.sort is
  '2026-10-21. rabatt: en rabattkod (till exempel en kampanj). partner: en partnerförenings kod, som spårar hur många '
  'familjer som kommit genom föreningen och vad de köpt (partner_statistik). Ändras aldrig efter att koden skapats.';
comment on column public.rabattkoder.partner_namn is
  '2026-10-21. Partnerföreningens namn, bara för en partnerkod. Bara för oss: familjen ser det aldrig genom oss.';
comment on column public.rabattkoder.varde is
  'Rabattens värde: procent (0–100) eller belopp i öre. Noll är en kod utan rabatt, som bara räknas (2026-10-21).';

-- Auditen får sorten och familjens gräns. Partnerns namn står inte där: den är fritext.
create or replace trigger rabattkoder_audit
  after insert or delete or update on public.rabattkoder
  for each row execute function public.logga_andring('rabattkod', 'kod', 'aktiv', 'typ', 'varde', 'tjanst',
                                                     'giltig_fran', 'giltig_till', 'max_anvandningar',
                                                     'max_per_familj', 'sort');

-- En kod raderas aldrig, och dess namn och sort ändras aldrig: passen,
-- köpen och användningarna pekar på den, och statistiken räknar på den.
create or replace function intern.koden_star_fast()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
-- koder_for_planer (2026-10-21).
begin
  if tg_op = 'DELETE' or tg_op = 'TRUNCATE' then
    raise exception using errcode = '42501',
      message = 'En kod raderas aldrig. Stäng av den i stället.';
  end if;
  if new.kod is distinct from old.kod or new.sort is distinct from old.sort then
    raise exception using errcode = '42501',
      message = 'En kods namn och sort ändras aldrig. Skapa en ny kod i stället.';
  end if;
  return new;
end $function$;

revoke all on function intern.koden_star_fast() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.rabattkoder'::regclass
                  and tgname = 'rabattkoder_star_fast') then
    create trigger rabattkoder_star_fast
      before update or delete on public.rabattkoder
      for each row execute function intern.koden_star_fast();
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.rabattkoder'::regclass
                  and tgname = 'rabattkoder_toms_aldrig') then
    create trigger rabattkoder_toms_aldrig
      before truncate on public.rabattkoder
      for each statement execute function intern.koden_star_fast();
  end if;
end $$;

revoke delete, truncate on public.rabattkoder from authenticated;
revoke all on public.rabattkoder from anon;


-- ---------- 2. kodernas användning ----------
create table if not exists public.kod_anvandningar (
  id            uuid primary key default gen_random_uuid(),
  betalning_id  uuid not null unique references public.betalningar(id) on delete restrict,
  kod           text not null references public.rabattkoder(kod),
  familj        uuid not null references public.profiles(id) on delete restrict,
  klippkort_id  uuid references public.klippkort(id) on delete set null,
  rabatt_ore    bigint not null default 0 check (rabatt_ore >= 0),
  anvand_at     timestamptz not null,
  bokford_at    timestamptz not null default now()
);
create unique index if not exists kod_anvandningar_kopet on public.kod_anvandningar (klippkort_id)
  where klippkort_id is not null;
create index if not exists kod_anvandningar_kod on public.kod_anvandningar (kod, anvand_at desc);
create index if not exists kod_anvandningar_familj on public.kod_anvandningar (familj);

comment on table public.kod_anvandningar is
  '2026-10-21 (koder_for_planer). En rad per betalt köp av en plan med en kod: koden, familjen, köpet, rabatten och '
  'raden i betalningsliggaren. Skrivs bara av databasen när betalningen bokförs (intern.kod_anvands), aldrig av en '
  'klient. Står fast och raderas aldrig: den hör till betalningen, som är bokföringsunderlag. Bara superadmin läser.';
comment on column public.kod_anvandningar.rabatt_ore is
  'Rabatten koden gav på köpet, i öre. Noll för en kod utan rabatt.';
comment on column public.kod_anvandningar.klippkort_id is
  'Köpet. Blir null bara om köpet tas bort (testkontot); raden och betalningen står kvar.';

create or replace function intern.kod_anvandningar_star_fast()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
-- koder_for_planer (2026-10-21). Det enda som får ändras är att
-- kopplingen till köpet blir tom, när köpet tas bort.
begin
  if tg_op = 'DELETE' or tg_op = 'TRUNCATE' then
    raise exception using errcode = '42501',
      message = 'Kodernas användning raderas aldrig: den hör till betalningen.';
  end if;
  if (new.id, new.betalning_id, new.kod, new.familj, new.rabatt_ore, new.anvand_at, new.bokford_at)
     is distinct from
     (old.id, old.betalning_id, old.kod, old.familj, old.rabatt_ore, old.anvand_at, old.bokford_at)
     or (new.klippkort_id is distinct from old.klippkort_id and new.klippkort_id is not null) then
    raise exception using errcode = '42501',
      message = 'Det som står om en kods användning står fast.';
  end if;
  return new;
end $function$;

revoke all on function intern.kod_anvandningar_star_fast() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.kod_anvandningar'::regclass
                  and tgname = 'kod_anvandningar_star_fast') then
    create trigger kod_anvandningar_star_fast
      before update or delete on public.kod_anvandningar
      for each row execute function intern.kod_anvandningar_star_fast();
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.kod_anvandningar'::regclass
                  and tgname = 'kod_anvandningar_toms_aldrig') then
    create trigger kod_anvandningar_toms_aldrig
      before truncate on public.kod_anvandningar
      for each statement execute function intern.kod_anvandningar_star_fast();
  end if;
end $$;

alter table public.kod_anvandningar enable row level security;
revoke all on public.kod_anvandningar from anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nextrum_barn') then
    execute 'revoke all on public.kod_anvandningar from nextrum_barn';
  end if;
  if exists (select 1 from pg_roles where rolname = 'nextrum_ai') then
    execute 'revoke all on public.kod_anvandningar from nextrum_ai';
  end if;
end $$;
grant select on public.kod_anvandningar to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kod_anvandningar'
                  and policyname = 'admin läser kodernas användning') then
    create policy "admin läser kodernas användning" on public.kod_anvandningar for select to authenticated
      using ((select public.is_admin()));
  end if;
end $$;


-- ---------- 3. familjens partner ----------
create table if not exists public.familjens_partner (
  familj             uuid primary key references public.profiles(id) on delete cascade,
  kod                text not null references public.rabattkoder(kod),
  kod_anvandning_id  uuid not null references public.kod_anvandningar(id),
  kopplad_at         timestamptz not null default now()
);
create index if not exists familjens_partner_kod on public.familjens_partner (kod);

comment on table public.familjens_partner is
  '2026-10-21 (koder_for_planer). Partnerkoden familjen använde första gången den köpte en plan med en, för '
  'uppföljningen: partnern är kodens partner_namn. Skrivs bara av databasen samtidigt som användningen och ändras '
  'aldrig: den första gäller. Bara superadmin läser. Står så länge kontot finns, och tas bort när familjen '
  'avidentifieras (profiles_partner_rensas); användningen står kvar med betalningen.';

create or replace function intern.familjens_partner_star_fast()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
-- koder_for_planer (2026-10-21). Den första partnern gäller.
begin
  raise exception using errcode = '42501',
    message = 'Familjens partner sparas första gången och ändras aldrig.';
end $function$;

revoke all on function intern.familjens_partner_star_fast() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.familjens_partner'::regclass
                  and tgname = 'familjens_partner_star_fast') then
    create trigger familjens_partner_star_fast
      before update on public.familjens_partner
      for each row execute function intern.familjens_partner_star_fast();
  end if;
end $$;

/* Avidentifieras familjen (radera_person) tas kopplingen bort, som
   familjens rabatt (profiles_familjerabatt_rensas): den säger vilken
   förening familjen kom genom. Användningen står kvar med betalningen,
   som är bokföring. */
create or replace function intern.familjens_partner_rensas()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- koder_for_planer (2026-10-21).
begin
  delete from public.familjens_partner where familj = new.id;
  return null;
end $function$;

revoke all on function intern.familjens_partner_rensas() from public, anon, authenticated;

create or replace trigger profiles_partner_rensas
  after update of raderad_at on public.profiles
  for each row when (old.raderad_at is null and new.raderad_at is not null)
  execute function intern.familjens_partner_rensas();

alter table public.familjens_partner enable row level security;
revoke all on public.familjens_partner from anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nextrum_barn') then
    execute 'revoke all on public.familjens_partner from nextrum_barn';
  end if;
  if exists (select 1 from pg_roles where rolname = 'nextrum_ai') then
    execute 'revoke all on public.familjens_partner from nextrum_ai';
  end if;
end $$;
grant select on public.familjens_partner to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'familjens_partner'
                  and policyname = 'admin läser familjernas partner') then
    create policy "admin läser familjernas partner" on public.familjens_partner for select to authenticated
      using ((select public.is_admin()));
  end if;
end $$;


-- ---------- 4. användningen bokförs med betalningen ----------
/* Efter att betalningsliggaren fått en ny rad: har köpet en kod står den
   i kod_anvandningar, kopplad till raden, och är det familjens första
   partnerkod står den i familjens_partner. En betalning bokförs en gång
   (stripe_payment_intent är unik), och en rad som ändras senare
   (återbetald, tvist) är ingen ny användning. En betalning utan rad (två
   kassor) ska tillbaka och räknas inte. TIPS är ingen kod. */
create or replace function intern.kod_anvands()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- koder_for_planer (2026-10-21).
declare
  r   public.rabattkoder%rowtype;
  rab bigint;
  ny  uuid;
begin
  if new.kod is null or new.kod = 'TIPS' or new.klippkort_id is null or new.utan_rad then
    return null;
  end if;
  select * into r from public.rabattkoder k where k.kod = new.kod;
  if not found then
    return null;
  end if;
  select k.rabatt_ore into rab from public.klippkort k where k.id = new.klippkort_id;

  insert into public.kod_anvandningar (betalning_id, kod, familj, klippkort_id, rabatt_ore, anvand_at)
  values (new.id, r.kod, new.familj, new.klippkort_id, coalesce(rab, 0), new.betald_at)
  on conflict do nothing
  returning id into ny;

  if ny is not null and r.sort = 'partner' then
    insert into public.familjens_partner (familj, kod, kod_anvandning_id, kopplad_at)
    values (new.familj, r.kod, ny, new.betald_at)
    on conflict (familj) do nothing;
  end if;
  return null;
end $function$;

revoke all on function intern.kod_anvands() from public, anon, authenticated;

create or replace trigger betalningar_kod_anvands
  after insert on public.betalningar
  for each row when (new.kod is not null and new.klippkort_id is not null)
  execute function intern.kod_anvands();

-- Köp som redan är betalda med en kod (liggaren fylldes i med dem).
insert into public.kod_anvandningar (betalning_id, kod, familj, klippkort_id, rabatt_ore, anvand_at)
select b.id, b.kod, b.familj, b.klippkort_id, coalesce(k.rabatt_ore, 0), b.betald_at
  from public.betalningar b
  join public.rabattkoder r on r.kod = b.kod
  left join public.klippkort k on k.id = b.klippkort_id
 where b.klippkort_id is not null and b.kod <> 'TIPS' and not b.utan_rad
on conflict do nothing;

insert into public.familjens_partner (familj, kod, kod_anvandning_id, kopplad_at)
select distinct on (a.familj) a.familj, a.kod, a.id, a.anvand_at
  from public.kod_anvandningar a
  join public.rabattkoder r on r.kod = a.kod and r.sort = 'partner'
 order by a.familj, a.anvand_at, a.id
on conflict (familj) do nothing;


-- ---------- 5. bara en plan tar en kod ----------
create or replace function intern.kod_galler_kopet(p_erbjudande text)
 returns boolean
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  -- koder_for_planer (2026-10-21): en plan i katalogen, aldrig Fyll
  -- timbanken (klippkort), timmar till planen (plan_extra) eller gratistimmar.
  select exists (select 1 from public.erbjudanden e where e.kod = p_erbjudande and e.sort = 'plan')
$function$;

revoke all on function intern.kod_galler_kopet(text) from public, anon, authenticated;


-- ---------- 6. prövningen ----------
create or replace function intern.rabattkod_prova(p_kod text, p_tjanst text, p_belopp_ore bigint,
                                                  p_familj uuid, p_kop boolean)
returns table (giltig boolean, orsak text, rabatt_ore bigint, beskrivning text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
-- koder_for_planer (2026-10-21): bara köp (p_kop; vilka köp avgör
-- intern.kod_galler_kopet hos den som frågar), aldrig ett pass; dagarna
-- räknas i svensk tid; noll i rabatt gäller; ett köp blir aldrig gratis.
declare
  r    public.rabattkoder%rowtype;
  ren  text := upper(btrim(coalesce(p_kod, '')));
  rab  bigint;
  idag date := (now() at time zone 'Europe/Stockholm')::date;
begin
  if ren = '' then
    return query select false, 'Skriv en kod.'::text, 0::bigint, null::text;
    return;
  end if;

  -- Leo: "Båda gäller ENBART planköp, aldrig enskilda pass." Samma svar
  -- för varje kod, så att passets ruta inte säger vilka koder som finns.
  if not p_kop then
    return query select false, 'Rabattkoder gäller bara när ni köper en plan.'::text, 0::bigint, null::text;
    return;
  end if;

  select * into r from public.rabattkoder k where k.kod = ren;
  -- TIPS är markeringen på en tipstimme, aldrig en kod någon skriver in.
  if not found or not r.aktiv or ren = 'TIPS' then
    return query select false, 'Koden finns inte, eller gäller inte längre.'::text, 0::bigint, null::text;
    return;
  end if;

  if r.giltig_fran is not null and idag < r.giltig_fran then
    return query select false, ('Koden gäller från ' || to_char(r.giltig_fran, 'YYYY-MM-DD') || '.')::text, 0::bigint, null::text;
    return;
  end if;

  if r.giltig_till is not null and idag > r.giltig_till then
    return query select false, 'Koden har gått ut.'::text, 0::bigint, null::text;
    return;
  end if;

  if r.max_anvandningar is not null and intern.rabattkod_anvand(ren, null, true) >= r.max_anvandningar then
    return query select false, 'Koden är slut.'::text, 0::bigint, null::text;
    return;
  end if;

  -- Familjens egna väntande köp räknas inte: en kassa familjen lämnade
  -- ska inte stänga koden för dem i ett dygn.
  if r.max_per_familj is not null and p_familj is not null
     and intern.rabattkod_anvand(ren, p_familj, false) >= r.max_per_familj then
    return query select false,
      (case when r.max_per_familj = 1 then 'Ni har redan använt koden. Den gäller en gång per familj.'
            else 'Ni har redan använt koden ' || r.max_per_familj || ' gånger, så många som den gäller per familj.' end)::text,
      0::bigint, null::text;
    return;
  end if;

  if r.tjanst is not null and p_tjanst is not null and r.tjanst <> p_tjanst then
    return query select false, 'Koden gäller inte den här tjänsten.'::text, 0::bigint, null::text;
    return;
  end if;

  if r.typ = 'procent' then
    rab := floor(coalesce(p_belopp_ore, 0) * r.varde / 100.0);
  else
    rab := r.varde;
  end if;
  rab := least(greatest(rab, 0), greatest(coalesce(p_belopp_ore, 0), 0));

  -- Ett köp kan inte bli gratis: kortet kan inte dra noll kronor, och
  -- gratistimmar sätter vi in själva (ge_gratistimmar).
  if rab >= coalesce(p_belopp_ore, 0) then
    return query select false, 'Rabatten är lika stor som priset eller större, och ett köp kan inte bli gratis.'::text,
                        0::bigint, null::text;
    return;
  end if;

  return query select true, null::text, rab, r.beskrivning;
end $$;

revoke all on function intern.rabattkod_prova(text, text, bigint, uuid, boolean) from public, anon, authenticated;


-- ---------- 7. koden på planen, med rabattens typ och värde ----------
/* Vad en plan kostar med koden, för familjen som frågar: katalogens pris
   minus familjens rabatt, och koden på det, som intern.klippkort_rabatt
   räknar det när köpet skapas. Kassan frågar med familjens token och
   räknar om rabatten ur typen och värdet innan Stripe får beloppet. Samma
   tak som förut: tio försök med en kod som inte finns i timmen. Fyll
   timbanken och timmarna till planen får nej före koden prövas, och då
   räknas inget försök. */
create or replace function public.kod_pa_planen(p_kod text, p_erbjudande text)
returns table (giltig boolean, orsak text, rabatt_ore bigint, beskrivning text, pris_ore bigint, att_betala_ore bigint,
               rabatt_typ text, rabatt_varde integer)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
-- koder_for_planer (2026-10-21).
declare
  jag     uuid := auth.uid();
  nyckel  text;
  pris    bigint;
  betalda integer;
  per     integer;
  d       integer;
  svar    record;
  r       public.rabattkoder%rowtype;
begin
  if jag is null then
    return query select false, 'Logga in först.'::text, 0::bigint, null::text, null::bigint, null::bigint,
                        null::text, null::integer;
    return;
  end if;

  select e.pris_ore, e.timmar - e.timmar_pa_kopet, e.rabatterat_timpris_ore
    into pris, betalda, per
    from public.erbjudanden_pris e where e.kod = p_erbjudande;
  if pris is null or pris <= 0 then
    return query select false, 'Erbjudandet finns inte.'::text, 0::bigint, null::text, null::bigint, null::bigint,
                        null::text, null::integer;
    return;
  end if;

  -- Priset familjen betalar utan kod (familjerabatter, 2026-10-15).
  d := intern.familjerabatt(jag);
  if d > 0 and d < per and betalda > 0 then
    pris := pris - betalda::bigint * d;
  end if;

  if not intern.kod_galler_kopet(p_erbjudande) then
    return query select false, 'Rabattkoder gäller bara när ni köper en plan.'::text, 0::bigint, null::text, pris, pris,
                        null::text, null::integer;
    return;
  end if;

  nyckel := intern.rabattkod_forsok_nyckel(jag);
  if intern.rabattkod_for_manga(nyckel) then
    return query select false, 'För många försök med koder. Vänta en timme och försök igen.'::text, 0::bigint,
                        null::text, pris, pris, null::text, null::integer;
    return;
  end if;

  select * into svar from intern.rabattkod_prova(p_kod, intern.kopets_tjanst(), pris, jag, true);
  if not svar.giltig and svar.orsak like 'Koden finns inte%' then
    perform intern.rabattkod_forsok_notera(nyckel);
  end if;
  if svar.giltig then
    select * into r from public.rabattkoder k where k.kod = upper(btrim(p_kod));
  end if;
  return query select svar.giltig, svar.orsak, svar.rabatt_ore, svar.beskrivning, pris,
                      case when svar.giltig then pris - svar.rabatt_ore else pris end,
                      case when svar.giltig then r.typ end,
                      case when svar.giltig then r.varde end;
end $$;

revoke all on function public.kod_pa_planen(text, text) from public, anon, nextrum_barn;
grant execute on function public.kod_pa_planen(text, text) to authenticated, service_role;

comment on function public.kod_pa_planen(text, text) is
  '2026-10-21 (koder_for_planer). Priset på en plan med en kod för den inloggade familjen, och rabattens typ och värde '
  'när koden gäller. Bara planer: Fyll timbanken och timmarna till planen får nej. Tio försök med en kod som inte finns '
  'per timme.';

-- Vyn frågar som förut. Samma svar, ur kod_pa_planen.
create or replace function public.kolla_rabattkod_kop(p_kod text, p_erbjudande text)
returns table (giltig boolean, orsak text, rabatt_ore bigint, beskrivning text, pris_ore bigint, att_betala_ore bigint)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
-- koder_for_planer (2026-10-21): bara planer, ur kod_pa_planen.
begin
  return query select k.giltig, k.orsak, k.rabatt_ore, k.beskrivning, k.pris_ore, k.att_betala_ore
                 from public.kod_pa_planen(p_kod, p_erbjudande) k;
end $$;

revoke all on function public.kolla_rabattkod_kop(text, text) from public, anon, nextrum_barn;
grant execute on function public.kolla_rabattkod_kop(text, text) to authenticated, service_role;

comment on function public.kolla_rabattkod_kop(text, text) is
  '2026-10-13, bara planer sedan 2026-10-21 (koder_for_planer). Priset på en plan med en kod, för den inloggade '
  'familjen; samma svar som kod_pa_planen utan rabattens typ och värde.';


-- ---------- 8. köpet: koden bara på en plan, och noll gäller ----------
create or replace function intern.klippkort_rabatt()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
-- koder_for_planer (2026-10-21): en kod bara på en plan i katalogen, och
-- en kod utan rabatt står kvar på köpet (den räknas) med priset utan kod.
declare
  pris    bigint;
  betalda integer;
  per     integer;
  d       integer;
  fam     bigint := 0;
  rab     bigint;
begin
  -- Gratistimmar bär varken kod eller rabatt: de kostar ingenting.
  if new.erbjudande = 'gratis' then
    new.rabattkod := null;
    new.rabatt_ore := null;
    new.familjerabatt_ore := null;
    return new;
  end if;

  -- familjerabatter (2026-10-15): timmar till en plan räknas i
  -- extra_timmar_erbjudande(), med familjens rabatt, och kassan skriver
  -- priset och rabatten. Ingen kod på dem.
  if new.erbjudande = 'plan_extra' then
    new.rabattkod := null;
    new.rabatt_ore := null;
    return new;
  end if;

  -- Katalogens pris, samma som kassan läser.
  select e.pris_ore, e.timmar - e.timmar_pa_kopet, e.rabatterat_timpris_ore
    into pris, betalda, per
    from public.erbjudanden_pris e where e.kod = new.erbjudande;
  if pris is null then
    new.rabattkod := null;
    new.rabatt_ore := null;
    new.familjerabatt_ore := null;
    return new;
  end if;

  -- Familjens rabatt på varje betald timme, när den lämnar ett pris kvar.
  d := intern.familjerabatt(new.parent_id);
  if d > 0 and d < per and betalda > 0 then
    fam := betalda::bigint * d;
    new.familjerabatt_ore := d;
  else
    new.familjerabatt_ore := null;
  end if;

  if new.rabattkod is null then
    new.rabatt_ore := null;
    if fam > 0 then
      new.begart_ore := pris - fam;
    end if;
    return new;
  end if;
  new.rabattkod := upper(btrim(new.rabattkod));

  -- Bara en plan tar en kod. Kassan har redan sagt nej; här tas koden
  -- bort, och köpet får priset utan den.
  if not intern.kod_galler_kopet(new.erbjudande) then
    new.rabattkod := null;
    new.rabatt_ore := null;
    new.begart_ore := pris - fam;
    return new;
  end if;

  -- En kod räknas på priset efter familjens rabatt.
  perform 1 from public.rabattkoder where kod = new.rabattkod for update;
  select k.rabatt_ore into rab
    from intern.rabattkod_prova(new.rabattkod, intern.kopets_tjanst(), pris - fam, new.parent_id, true) k
   where k.giltig;

  if rab is null then
    new.rabattkod := null;
    new.rabatt_ore := null;
    new.begart_ore := pris - fam;
  elsif rab = 0 then
    -- En kod utan rabatt: den står på köpet och räknas, och priset är det utan kod.
    new.rabatt_ore := null;
    new.begart_ore := pris - fam;
  else
    new.rabatt_ore := rab;
    new.begart_ore := pris - fam - rab;
  end if;
  return new;
end $$;

revoke all on function intern.klippkort_rabatt() from public, anon, authenticated;


-- ---------- 9. ett pass tar ingen ny kod ----------
/* Före bookings_skydda_rabatt (namnordningen) och för alla, också admin
   och databasen själv. TIPS sätter forsta_timmen_bjuds efter den här och
   står kvar. Ett pass som redan bär en kod från förut behåller den när
   något annat ändras, för priset är fryst på den; en ändrad kod går
   tillbaka till den förra. */
create or replace function intern.passet_tar_ingen_kod()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- koder_for_planer (2026-10-21): "Båda gäller ENBART planköp, aldrig enskilda pass."
begin
  if tg_op = 'UPDATE' then
    if new.rabattkod is not distinct from old.rabattkod then
      return new;
    end if;
    new.rabattkod := old.rabattkod;
    new.rabatt_ore := old.rabatt_ore;
    return new;
  end if;
  new.rabattkod := null;
  new.rabatt_ore := null;
  return new;
end $function$;

revoke all on function intern.passet_tar_ingen_kod() from public, anon, authenticated;

create or replace trigger bookings_kod_bara_pa_planer
  before insert or update on public.bookings
  for each row when (new.rabattkod is not null and new.rabattkod <> 'TIPS')
  execute function intern.passet_tar_ingen_kod();


-- ---------- 10. statistiken ----------
/* Timmarna ett köp betalat i pass med rapport: samma uttryck som
   intern.kortets_anvanda, bara genomförda pass (passet är genomfört först
   när rapporten finns). */
create or replace function intern.kortets_genomforda(p_kort uuid)
 returns integer
 language sql
 stable
 set search_path to 'public'
as $function$
  -- koder_for_planer (2026-10-21).
  select coalesce(sum(case when x.forsta_klippkort_id = p_kort
                           then least(x.forsta_klippkort_timmar, d.a)
                           else greatest(d.a - coalesce(x.forsta_klippkort_timmar, 0), 0) end), 0)::int
    from public.bookings x
    cross join lateral (select intern.passets_korttimmar(x) as a) d
   where (x.klippkort_id = p_kort or x.forsta_klippkort_id = p_kort)
     and x.klippkort_id is not null
     and x.status <> 'cancelled'
     and exists (select 1 from public.lesson_reports r where r.booking_id = x.id)
$function$;

revoke all on function intern.kortets_genomforda(uuid) from public, anon, authenticated;

/* Per kod: familjer, köp, köpta timmar (alla timmar i köpen, också den
   första planens timme på köpet), genomförda timmar, betalt, återbetalt
   och rabatten. Bara koder som använts står med. Testbetalningar
   (betalningar.skarp = false) räknas inte, som i resten av adminvyn,
   utom med p_med_test: Stripe står i testläge, och då är allt test. */
create or replace function public.kod_statistik(p_med_test boolean default false)
returns table (kod text, familjer integer, kop integer, kopta_timmar integer, genomforda_timmar integer,
               betalt_ore bigint, aterbetalt_ore bigint, rabatt_ore bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
-- koder_for_planer (2026-10-21).
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara superadmin ser kodernas användning.';
  end if;
  return query
  select a.kod,
         count(distinct a.familj)::integer,
         count(*)::integer,
         coalesce(sum(k.timmar), 0)::integer,
         coalesce(sum(intern.kortets_genomforda(a.klippkort_id)), 0)::integer,
         coalesce(sum(b.belopp_ore), 0)::bigint,
         coalesce(sum(b.aterbetalt_ore), 0)::bigint,
         coalesce(sum(a.rabatt_ore), 0)::bigint
    from public.kod_anvandningar a
    join public.betalningar b on b.id = a.betalning_id
    left join public.klippkort k on k.id = a.klippkort_id
   where coalesce(p_med_test, false) or b.skarp is distinct from false
   group by a.kod;
end $$;

/* Per partner: alla partnerkoder, också de som inte använts, ihop under
   partnerns namn. En familj räknas en gång per partner. Testbetalningar
   som i kod_statistik. */
create or replace function public.partner_statistik(p_med_test boolean default false)
returns table (partner_namn text, koder integer, aktiva_koder integer, familjer integer, kop integer,
               kopta_timmar integer, genomforda_timmar integer, betalt_ore bigint, aterbetalt_ore bigint,
               rabatt_ore bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
-- koder_for_planer (2026-10-21).
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara superadmin ser partnernas statistik.';
  end if;
  return query
  with anv as (
    select a.id, a.kod, a.familj, a.klippkort_id, a.rabatt_ore as rab, b.belopp_ore as betalt, b.aterbetalt_ore as ater
      from public.kod_anvandningar a
      join public.betalningar b on b.id = a.betalning_id
     where coalesce(p_med_test, false) or b.skarp is distinct from false
  )
  select r.partner_namn,
         count(distinct r.kod)::integer,
         count(distinct r.kod) filter (where r.aktiv)::integer,
         count(distinct x.familj)::integer,
         count(x.id)::integer,
         coalesce(sum(k.timmar), 0)::integer,
         coalesce(sum(intern.kortets_genomforda(x.klippkort_id)), 0)::integer,
         coalesce(sum(x.betalt), 0)::bigint,
         coalesce(sum(x.ater), 0)::bigint,
         coalesce(sum(x.rab), 0)::bigint
    from public.rabattkoder r
    left join anv x on x.kod = r.kod
    left join public.klippkort k on k.id = x.klippkort_id
   where r.sort = 'partner'
   group by r.partner_namn;
end $$;

/* En kods användningar, den senaste först: när, familjen, planen, timmarna,
   de genomförda, betalt, återbetalt, rabatten och om det var en
   testbetalning. */
create or replace function public.kodens_anvandningar(p_kod text)
returns table (id uuid, anvand_at timestamptz, familj uuid, familj_namn text, erbjudande text, timmar integer,
               genomforda_timmar integer, betalt_ore integer, aterbetalt_ore integer, rabatt_ore bigint,
               status text, test boolean)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
-- koder_for_planer (2026-10-21).
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara superadmin ser kodernas användning.';
  end if;
  return query
  select a.id, a.anvand_at, a.familj, p.full_name, b.erbjudande, k.timmar,
         intern.kortets_genomforda(a.klippkort_id), b.belopp_ore, b.aterbetalt_ore, a.rabatt_ore, b.status,
         b.skarp is false
    from public.kod_anvandningar a
    join public.betalningar b on b.id = a.betalning_id
    left join public.klippkort k on k.id = a.klippkort_id
    left join public.profiles p on p.id = a.familj
   where a.kod = upper(btrim(coalesce(p_kod, '')))
   order by a.anvand_at desc, a.id;
end $$;

revoke all on function public.kod_statistik(boolean) from public, anon, nextrum_barn;
revoke all on function public.partner_statistik(boolean) from public, anon, nextrum_barn;
revoke all on function public.kodens_anvandningar(text) from public, anon, nextrum_barn;
grant execute on function public.kod_statistik(boolean) to authenticated;
grant execute on function public.partner_statistik(boolean) to authenticated;
grant execute on function public.kodens_anvandningar(text) to authenticated;

comment on function public.kod_statistik(boolean) is
  '2026-10-21 (koder_for_planer). Per använd kod: familjer, köp, köpta timmar, genomförda timmar, betalt, återbetalt '
  'och rabatten, utan testbetalningar (med dem: p_med_test). Bara superadmin.';
comment on function public.partner_statistik(boolean) is
  '2026-10-21 (koder_for_planer). Per partner (partnerkodernas partner_namn): koder, familjer, köp, köpta och '
  'genomförda timmar, betalt, återbetalt och rabatten, utan testbetalningar (med dem: p_med_test). Bara superadmin.';
comment on function public.kodens_anvandningar(text) is
  '2026-10-21 (koder_for_planer). En kods användningar, den senaste först. Bara superadmin.';
