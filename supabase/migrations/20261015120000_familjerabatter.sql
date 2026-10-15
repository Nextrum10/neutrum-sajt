-- ============================================================
-- Familjerabatter: våra egna koder, som bara vi ser och sätter på en
-- familj (2026-10-15, Leo)
--
-- Leo: "vi i admin vill skapa egna rabattkoder som bara vi har tillgång
-- till. de ska skrivas in i familjernas konto som bara vi kan se och
-- röra, rabattkoden kan vara en samarbetspartner som använder den och vi
-- vill ge 10 kr billigare på alla timmar som köps tex. vi ska precis som
-- när vi ger ut gratis timmar i timbank kunna skriva in rabattkoder för
-- familjerna som ändrar deras pris tills vi tar bort rabatten. tex 10 kr
-- tills vidare. de ser bara att de har rabatt vid checkout men inte
-- annat. vi ser rabattkoden när vi klickar på deras namn och kan välja ta
-- bort eller ändra. sen skapar vi våra rabattkoder."
--
-- 1. KODERNA (familjerabatter): koden, vad den gäller (beskrivning, bara
--    för oss), kronor av per timme (ore_per_timme, 1–200 kr i hela
--    kronor) och aktiv. Bara admin läser och skriver (is_admin()), som
--    rabattkoder. En kod tas aldrig bort, den stängs av: en familj kan
--    bära den. Det är INTE en rabattkod: familjen skriver den aldrig och
--    ser den aldrig, den räknas inte, och rabattkod_prova känner den inte.
--
-- 2. FAMILJENS RABATT (familjens_rabatt): en rad per familj med koden,
--    när och vem av oss. Ta bort är kod = null, aldrig ett delete (kärnan
--    avsnitt 5). Ingen inloggad familj läser tabellen; familjen får bara
--    beloppet per timme, genom min_familjerabatt(), aldrig koden. Bara
--    satt_familjerabatt() skriver, med is_admin() först.
--
-- 3. KRONORNA DRAS AV PÅ VARJE TIMME FAMILJEN BETALAR MED PENGAR, när
--    priset sätts:
--    · Ett pass: frys_passets_pris drar dem från timpriset när passet
--      bokas och sparar hur mycket (bookings.familjerabatt_ore, per
--      timme). Allt som räknar ett pass räknar redan på timpris_ore
--      (kortet, reservationen, fakturan, månadskörningen, första timmen,
--      en rabattkod), så inget av det skrivs om. Tillägget för fler barn
--      rörs inte, och rabatten dras bara när den lämnar ett pris kvar.
--    · Ett köp ur katalogen (en plan, Fyll timbanken):
--      intern.klippkort_rabatt drar dem från varje betald timme (timmar
--      minus timmar på köpet) när köpet skapas, och sparar hur mycket per
--      timme (klippkort.familjerabatt_ore). timpris_ore står kvar som
--      katalogens, för planens rabatt räknas på det.
--    · Timmar till en plan: extra_timmar_erbjudande() drar dem från
--      planens timpris, och kassan sparar dem på köpet.
--    Priset fryses som förut: en rabatt som sätts, ändras eller tas bort
--    gäller pass som bokas och timmar som köps efter det. Gratistimmar,
--    första timmen och tipstimmen kostar redan ingenting och rörs inte.
--
-- 4. EN RABATTKOD GÄLLER OVANPÅ. Familjens rabatt är familjens pris, och
--    en kod räknas på det, som för vilken familj som helst: skydda_rabatt
--    läser timpriset efter rabatten, och kolla_rabattkod_kop och
--    klippkort_rabatt prövar koden mot priset efter den.
--
-- 5. ATT SLUTA. De använda timmarna räknas till familjens ordinarie
--    timpris, timpris_ore minus familjerabatt_ore
--    (klippkort_saldo.vid_uppsagning_ore), och minuterna i timbanken
--    likaså (intern.timbank_varde), så att de två fortfarande tar ut
--    varandra. Villkoren säger "ordinarie timpris", och för den här
--    familjen var det lägre: det blir aldrig mer än villkoren tillåter.
--
-- 6. AVIDENTIFIERAS FAMILJEN tas koden bort (profiles_familjerabatt_rensas);
--    raderas kontot helt går raden med (on delete cascade).
--
-- Villkoren får ingen ny version: de nämner ingen rabatt, och ett lägre
-- pris än prislistan ändrar dem inte. Rabattens egna villkor (beloppet,
-- att den gäller tills vidare och att vi kan ta bort den) ska stå där vi
-- ger den, i mejlet eller avtalet med partnern.
--
-- Vakterna prövar driftens text för det som skrivs om (md5 på prosrc, och
-- på vyns definition); bär det redan familjerabatt släpper vakten igenom,
-- så filen går att köra två gånger. Inget drop, inget delete. Körs efter
-- merge: vyerna tål att den saknas (ingen rabatt, och adminvyn säger att
-- migrationen inte är körd).
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 0. driften är som den lästes ----------
do $$
declare
  f   record;
  src text;
begin
  for f in
    select * from (values
      ('public.frys_passets_pris()',                 'de925b8fdd7b727e16e41117599d361c'),
      ('intern.klippkort_rabatt()',                  'b8e3a39ea1c03c7bc837f43dd9007de2'),
      ('public.kolla_rabattkod_kop(text,text)',      'ca6d544b14ff676f6342b7c9f71556ef'),
      ('public.extra_timmar_erbjudande(integer)',    '6ef22e49b2e4d8657c3046a9e2fefb69'),
      ('intern.timbank_varde(uuid,integer)',         '535097c39b30bd250722e6b204389f8d')) v(namn, summa)
  loop
    select p.prosrc into src from pg_proc p where p.oid = f.namn::regprocedure;
    if position('familjerabatt' in src) = 0 and md5(src) <> f.summa then
      raise exception '% har ändrats sedan familjerabatter skrevs (md5 %). Läs driften och skriv om migrationen.',
        f.namn, md5(src);
    end if;
  end loop;

  src := pg_get_viewdef('public.klippkort_saldo'::regclass, true);
  if position('familjerabatt' in src) = 0 and md5(src) <> 'a34041ef762316f238c6902224864a89' then
    raise exception 'klippkort_saldo har ändrats sedan familjerabatter skrevs (md5 %). Läs driften.', md5(src);
  end if;
end $$;


-- ---------- 1. koderna ----------
create table if not exists public.familjerabatter (
  kod           text primary key,
  beskrivning   text,
  ore_per_timme integer not null,
  aktiv         boolean not null default true,
  skapad        timestamptz not null default now()
);

do $$
begin
  -- Som rabattkoder: versaler, siffror och bindestreck, ett sätt att skriva den.
  if not exists (select 1 from pg_constraint where conrelid = 'public.familjerabatter'::regclass
                  and conname = 'familjerabatter_kod_check') then
    alter table public.familjerabatter
      add constraint familjerabatter_kod_check check (kod = upper(kod) and kod ~ '^[A-Z0-9-]{3,24}$');
  end if;
  -- 1–200 kr i timmen, i hela kronor. Taket fångar en nolla för mycket,
  -- och lämnar alltid ett pris kvar på en timme.
  if not exists (select 1 from pg_constraint where conrelid = 'public.familjerabatter'::regclass
                  and conname = 'familjerabatter_ore_check') then
    alter table public.familjerabatter
      add constraint familjerabatter_ore_check check (ore_per_timme between 100 and 20000 and ore_per_timme % 100 = 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.familjerabatter'::regclass
                  and conname = 'familjerabatter_beskrivning_check') then
    alter table public.familjerabatter
      add constraint familjerabatter_beskrivning_check check (beskrivning is null or char_length(beskrivning) <= 120);
  end if;
end $$;

comment on table public.familjerabatter is
  '2026-10-15 (familjerabatter). Våra egna koder: kronor av per timme för de familjer vi sätter koden på '
  '(familjens_rabatt, satt_familjerabatt()). Bara admin läser och skriver. Familjen ser aldrig koden, bara att '
  'priset är lägre i kassan. Ingen rabattkod: rabattkod_prova känner den inte. Tas aldrig bort, stängs av.';
comment on column public.familjerabatter.ore_per_timme is
  'Kronor av per betald timme, i öre (100–20000, hela kronor). Gäller pass som bokas och timmar som köps efter '
  'att den satts eller ändrats; priset på det som redan är bokat eller köpt står fast.';
comment on column public.familjerabatter.beskrivning is
  'Vad koden gäller, till exempel samarbetspartnern. Bara för oss.';

alter table public.familjerabatter enable row level security;
revoke all on public.familjerabatter from anon, nextrum_barn;
revoke delete, truncate, references, trigger on public.familjerabatter from authenticated;
grant select, insert, update on public.familjerabatter to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'familjerabatter'
                  and policyname = 'admin läser familjerabatterna') then
    create policy "admin läser familjerabatterna" on public.familjerabatter
      for select to authenticated using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'familjerabatter'
                  and policyname = 'admin skapar familjerabatter') then
    create policy "admin skapar familjerabatter" on public.familjerabatter
      for insert to authenticated with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'familjerabatter'
                  and policyname = 'admin ändrar familjerabatter') then
    create policy "admin ändrar familjerabatter" on public.familjerabatter
      for update to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- En kod byter aldrig namn: en familj kan bära den, och auditen loggar den
-- under namnet.
create or replace function intern.familjerabatt_kod_star_fast()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.kod := old.kod;
  return new;
end $$;

revoke all on function intern.familjerabatt_kod_star_fast() from public, anon, authenticated;

create or replace trigger familjerabatter_kod_star_fast
  before update on public.familjerabatter
  for each row when (old.kod is distinct from new.kod)
  execute function intern.familjerabatt_kod_star_fast();

-- Som rabattkoder: när en kod skapas, stängs av eller får ett nytt belopp,
-- och av vem. Koden är objektet; ingen familj står i raden.
create or replace trigger familjerabatter_audit
  after insert or update on public.familjerabatter
  for each row execute function public.logga_andring('familjerabatt', 'kod', 'aktiv', 'ore_per_timme');


-- ---------- 2. familjens rabatt ----------
create table if not exists public.familjens_rabatt (
  parent_id  uuid primary key references public.profiles(id) on delete cascade,
  kod        text references public.familjerabatter(kod),
  andrad_at  timestamptz not null default now(),
  andrad_av  uuid,
  har_rabatt boolean generated always as (kod is not null) stored
);

create index if not exists familjens_rabatt_kod on public.familjens_rabatt (kod) where kod is not null;

comment on table public.familjens_rabatt is
  '2026-10-15 (familjerabatter). Vilken av våra koder en familj har. En rad per familj; null i kod betyder att '
  'rabatten är borttagen. Bara admin läser; bara satt_familjerabatt() skriver. Familjen läser beloppet per timme '
  'genom min_familjerabatt(), aldrig koden.';
comment on column public.familjens_rabatt.andrad_av is
  'Vem av oss som satte, ändrade eller tog bort rabatten senast. Ingen inloggad familj läser den.';
comment on column public.familjens_rabatt.har_rabatt is
  'Räknas ur kod. Står i auditloggen i stället för koden, som kan säga vilken partner familjen kom genom.';

alter table public.familjens_rabatt enable row level security;
revoke all on public.familjens_rabatt from anon, nextrum_barn;
revoke insert, update, delete, truncate, references, trigger on public.familjens_rabatt from authenticated;
grant select on public.familjens_rabatt to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'familjens_rabatt'
                  and policyname = 'admin läser familjernas rabatter') then
    create policy "admin läser familjernas rabatter" on public.familjens_rabatt
      for select to authenticated using (public.is_admin());
  end if;
end $$;

-- När en familj fick, bytte eller blev av med sin rabatt, och av vem.
-- Aldrig koden: auditen står kvar så länge verksamheten finns.
create or replace trigger familjens_rabatt_audit
  after insert or update on public.familjens_rabatt
  for each row execute function intern.logga_andring_nyckel('familjerabatt_familj', 'parent_id', 'har_rabatt', 'andrad_at');


-- ---------- 3. kolumnerna på passen och köpen ----------
alter table public.bookings add column if not exists familjerabatt_ore integer;
alter table public.klippkort add column if not exists familjerabatt_ore integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.bookings'::regclass
                  and conname = 'bookings_familjerabatt_ore_check') then
    alter table public.bookings
      add constraint bookings_familjerabatt_ore_check check (familjerabatt_ore is null or familjerabatt_ore > 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.klippkort'::regclass
                  and conname = 'klippkort_familjerabatt_ore_check') then
    alter table public.klippkort
      add constraint klippkort_familjerabatt_ore_check check (familjerabatt_ore is null or familjerabatt_ore > 0);
  end if;
end $$;

comment on column public.bookings.familjerabatt_ore is
  'familjerabatter (2026-10-15): kronor av per timme, i öre, som familjens rabatt drog när passet bokades. '
  'timpris_ore är redan sänkt med dem; kolumnen säger hur mycket. Fryst som timpris_ore, och bara Nextrum ändrar den.';
comment on column public.klippkort.familjerabatt_ore is
  'familjerabatter (2026-10-15): kronor av per betald timme, i öre, som familjens rabatt drog när köpet skapades. '
  'timpris_ore är katalogens; begart_ore är priset efter rabatten. Slutar familjen räknas de använda timmarna '
  'till timpris_ore minus den (klippkort_saldo.vid_uppsagning_ore).';
comment on column public.bookings.timpris_ore is
  'Fas 19.5: tjänstens timpris i ören när passet bokades. Kortet, fakturan och månadskörningen räknar på det, inte '
  'på dagens pris. Sedan 2026-10-15 minus familjens rabatt (familjerabatt_ore), när passet bokades med en.';


-- ---------- 4. vad familjen har ----------
/* Familjens rabatt per timme i dag, i öre, eller 0. En avstängd kod ger
   ingen rabatt. Läses av triggrarna och funktionerna nedan, som ägaren. */
create or replace function intern.familjerabatt(p_familj uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select r.ore_per_timme
                     from public.familjens_rabatt f
                     join public.familjerabatter r on r.kod = f.kod
                    where f.parent_id = p_familj and r.aktiv), 0)
$$;

revoke all on function intern.familjerabatt(uuid) from public, anon, authenticated;

comment on function intern.familjerabatt(uuid) is
  '2026-10-15 (familjerabatter). Familjens rabatt per timme i öre i dag, eller 0. Bara för databasens egna funktioner.';

/* Familjen frågar själv: bara beloppet, aldrig koden eller varför. Vyn
   visar priset i kassan med det (Boka pass, Köp till timmar), och kassan
   frågar med familjens token. 0 för den som inte är en familj. */
create or replace function public.min_familjerabatt()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'parent')
              then intern.familjerabatt(auth.uid()) else 0 end
$$;

revoke all on function public.min_familjerabatt() from public, anon, nextrum_barn;
grant execute on function public.min_familjerabatt() to authenticated, service_role;

comment on function public.min_familjerabatt() is
  '2026-10-15 (familjerabatter). Den inloggade familjens rabatt per timme i öre, eller 0. Aldrig koden.';


-- ---------- 5. admin sätter, ändrar och tar bort ----------
/* p_kod null eller tom tar bort rabatten. En avstängd kod sätts inte på en
   ny familj; en familj som redan bär den behåller raden, utan rabatt, tills
   koden slås på igen eller byts. Ingen familj tar del av ett pris den redan
   bokat: det som är bokat och köpt står fast. */
create or replace function public.satt_familjerabatt(p_familj uuid, p_kod text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ren text := nullif(upper(btrim(coalesce(p_kod, ''))), '');
  r   public.familjerabatter;
begin
  if not public.is_admin() then
    raise exception 'Bara admin sätter en rabatt på en familj.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p
                  where p.id = p_familj and p.role = 'parent' and p.raderad_at is null) then
    raise exception 'Familjen finns inte.' using errcode = 'P0002';
  end if;
  if ren is not null then
    select * into r from public.familjerabatter where kod = ren;
    if not found then
      raise exception 'Det finns ingen familjerabatt som heter %.', ren using errcode = 'P0002';
    end if;
    if not r.aktiv then
      raise exception 'Familjerabatten % är avstängd. Slå på den först.', ren using errcode = '22023';
    end if;
  end if;

  insert into public.familjens_rabatt (parent_id, kod, andrad_at, andrad_av)
  values (p_familj, ren, now(), auth.uid())
  on conflict (parent_id) do update
    set kod = excluded.kod, andrad_at = excluded.andrad_at, andrad_av = excluded.andrad_av;

  return jsonb_build_object('ok', true, 'kod', ren, 'ore_per_timme', coalesce(r.ore_per_timme, 0));
end $$;

revoke all on function public.satt_familjerabatt(uuid, text) from public, anon, nextrum_barn;
grant execute on function public.satt_familjerabatt(uuid, text) to authenticated;

comment on function public.satt_familjerabatt(uuid, text) is
  '2026-10-15 (familjerabatter). Admin sätter en av våra koder på en familj, byter den, eller tar bort den med null. '
  'Gäller pass som bokas och timmar som köps efter det.';

-- Avidentifieras familjen tas koden bort. Ett konto som raderas helt tar
-- raden med sig (on delete cascade).
create or replace function intern.familjerabatt_rensas()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.familjens_rabatt
     set kod = null, andrad_at = now(), andrad_av = null
   where parent_id = new.id and kod is not null;
  return null;
end $$;

revoke all on function intern.familjerabatt_rensas() from public, anon, authenticated;

create or replace trigger profiles_familjerabatt_rensas
  after update of raderad_at on public.profiles
  for each row when (old.raderad_at is null and new.raderad_at is not null)
  execute function intern.familjerabatt_rensas();


-- ---------- 6. passet: priset fryses med rabatten ----------
create or replace function public.frys_passets_pris()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t      public.tjanster%rowtype;
  reserv bigint;
  fran_vy boolean := auth.uid() is not null and not public.is_admin();
  d      integer;
begin
  if tg_op = 'UPDATE' then
    if new.tjanst is not distinct from old.tjanst
       or new.timpris_ore is distinct from old.timpris_ore then
      return new;
    end if;
    new.timpris_ore := null;
    new.extra_ore := null;
  elsif fran_vy then
    new.timpris_ore := null;
    new.extra_ore := null;
    -- familjerabatter: rabatten är aldrig något familjen skickar.
    new.familjerabatt_ore := null;
  end if;

  if new.timpris_ore is not null and new.extra_ore is not null then
    return new;
  end if;

  -- Samma reservordning som stripe-checkout och pris.ts: passets tjänst,
  -- annars standardtjänsten, och prissattning om tjänsten saknar pris.
  select * into t from public.tjanster where kod = new.tjanst;
  if not found then
    select * into t from public.tjanster
     order by (aktiv and for_kund) desc, coalesce(ordning, 100), kod
     limit 1;
  end if;
  select p.pris_per_timme_ore into reserv from public.prissattning p limit 1;

  -- familjerabatter (2026-10-15): räknas priset här dras familjens rabatt
  -- från timpriset, när den lämnar ett pris kvar, och kolumnen säger hur
  -- mycket. Ett pris som admin eller systemet sätter står som det är.
  if new.timpris_ore is null then
    new.timpris_ore := coalesce(nullif(t.pris_per_timme_ore, 0), reserv);
    d := intern.familjerabatt(new.parent_id);
    if d > 0 and d < coalesce(new.timpris_ore, 0) then
      new.timpris_ore := new.timpris_ore - d;
      new.familjerabatt_ore := d;
    else
      new.familjerabatt_ore := null;
    end if;
  end if;
  new.extra_ore := coalesce(new.extra_ore, t.extra_personer_ore, 0);
  return new;
end $$;


-- ---------- 7. köpet: rabatten dras från varje betald timme ----------
create or replace function intern.klippkort_rabatt()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

  -- En kod räknas på priset efter familjens rabatt.
  perform 1 from public.rabattkoder where kod = new.rabattkod for update;
  select k.rabatt_ore into rab
    from intern.rabattkod_prova(new.rabattkod, intern.kopets_tjanst(), pris - fam, new.parent_id, true) k
   where k.giltig;

  if rab is null or rab <= 0 then
    new.rabattkod := null;
    new.rabatt_ore := null;
    new.begart_ore := pris - fam;
  else
    new.rabatt_ore := rab;
    new.begart_ore := pris - fam - rab;
  end if;
  return new;
end $$;

revoke all on function intern.klippkort_rabatt() from public, anon, authenticated;


-- ---------- 8. koden på ett köp: priset efter familjens rabatt ----------
create or replace function public.kolla_rabattkod_kop(p_kod text, p_erbjudande text)
returns table (giltig boolean, orsak text, rabatt_ore bigint, beskrivning text, pris_ore bigint, att_betala_ore bigint)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  jag    uuid := auth.uid();
  nyckel text;
  pris   bigint;
  betalda integer;
  per    integer;
  d      integer;
  svar   record;
begin
  if jag is null then
    return query select false, 'Logga in först.'::text, 0::bigint, null::text, null::bigint, null::bigint;
    return;
  end if;

  select e.pris_ore, e.timmar - e.timmar_pa_kopet, e.rabatterat_timpris_ore
    into pris, betalda, per
    from public.erbjudanden_pris e where e.kod = p_erbjudande;
  if pris is null or pris <= 0 then
    return query select false, 'Erbjudandet finns inte.'::text, 0::bigint, null::text, null::bigint, null::bigint;
    return;
  end if;

  -- familjerabatter (2026-10-15): priset familjen betalar utan kod, som
  -- intern.klippkort_rabatt räknar det när köpet skapas.
  d := intern.familjerabatt(jag);
  if d > 0 and d < per and betalda > 0 then
    pris := pris - betalda::bigint * d;
  end if;

  nyckel := intern.rabattkod_forsok_nyckel(jag);
  if intern.rabattkod_for_manga(nyckel) then
    return query select false, 'För många försök med koder. Vänta en timme och försök igen.'::text, 0::bigint,
                        null::text, pris, pris;
    return;
  end if;

  select * into svar from intern.rabattkod_prova(p_kod, intern.kopets_tjanst(), pris, jag, true);
  if not svar.giltig and svar.orsak like 'Koden finns inte%' then
    perform intern.rabattkod_forsok_notera(nyckel);
  end if;
  return query select svar.giltig, svar.orsak, svar.rabatt_ore, svar.beskrivning, pris,
                      case when svar.giltig then pris - svar.rabatt_ore else pris end;
end $$;


-- ---------- 9. timmar till en plan: planens timpris minus rabatten ----------
create or replace function public.extra_timmar_erbjudande(p_timmar integer)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  jag     uuid := auth.uid();
  idag    date := (now() at time zone 'Europe/Stockholm')::date;
  p       record;
  timpris integer;
  d       integer;
begin
  if jag is null then
    return jsonb_build_object('fel', 'Logga in först.');
  end if;
  if not exists (select 1 from public.profiles where id = jag and role = 'parent') then
    return jsonb_build_object('fel', 'Timmar köps av familjen.');
  end if;
  if p_timmar is null or p_timmar < 1 or p_timmar > 20 then
    return jsonb_build_object('fel', 'Välj mellan 1 och 20 timmar.');
  end if;

  select k.id, k.namn, k.giltigt_till, k.timpris_ore, coalesce(k.rabatt_procent, 0) as rabatt
    into p
    from public.klippkort k
   where k.parent_id = jag and k.sort = 'plan' and k.status = 'betald'
     and k.giltigt_till > idag
   order by k.giltigt_till desc, k.created_at desc
   limit 1;
  if not found then
    return jsonb_build_object('fel', 'Timmar köps till en plan som gäller minst en dag till. Köp en plan eller '
                                     || 'Fyll timbanken i stället.');
  end if;

  timpris := (floor(p.timpris_ore::numeric * (100 - p.rabatt) / 10000) * 100)::integer;
  -- familjerabatter (2026-10-15): familjens rabatt i dag dras från varje
  -- timme, när den lämnar ett pris kvar. Kassan sparar den på köpet.
  d := public.min_familjerabatt();
  if not (d > 0 and d < timpris) then
    d := 0;
  end if;
  return jsonb_build_object('ok', true,
                            'plan', p.id,
                            'plan_namn', p.namn,
                            'timmar', p_timmar,
                            'timpris_ore', p.timpris_ore,
                            'rabatt_procent', p.rabatt,
                            'rabatterat_timpris_ore', timpris,
                            'familjerabatt_ore', d,
                            'pris_ore', (timpris - d) * p_timmar,
                            'giltigt_till', p.giltigt_till);
end $$;

comment on function public.extra_timmar_erbjudande(integer) is
  'timmarna_delas (2026-10-14): priset för 1–20 timmar till den inloggade familjens plan, och planens sista dag. '
  'Läses av stripe-checkout, som skapar köpet (erbjudandet plan_extra, till_plan). Sedan 2026-10-15 (familjerabatter) '
  'minus familjens rabatt per timme (familjerabatt_ore), som kassan sparar på köpet.';


-- ---------- 10. att sluta: familjens ordinarie timpris ----------
/* Som Fas 22.1: det ordinarie timpriset på familjens senaste köp, per
   minut, uppåt till helt öre. familjerabatter (2026-10-15): minus
   familjens rabatt på köpet, samma pris som vid_uppsagning_ore räknar de
   använda timmarna till, så att de två fortfarande tar ut varandra. */
create or replace function intern.timbank_varde(p_foralder uuid, p_minuter int)
returns int
language sql
stable
set search_path = public
as $$
  select case when p_minuter > 0
              then ceil(p_minuter * (k.timpris_ore - coalesce(k.familjerabatt_ore, 0)) / 60.0)::int end
    from public.klippkort k
   where k.parent_id = p_foralder and k.status in ('betald', 'tvist', 'aterbetald')
   order by k.betald_at desc nulls last, k.created_at desc
   limit 1
$$;

/* Samma kolumner i samma ordning, och en till sist. vid_uppsagning_ore
   räknar de använda timmarna till familjens ordinarie timpris: katalogens
   minus familjens rabatt på köpet. */
create or replace view public.klippkort_saldo
with (security_invoker = true) as
 SELECT k.id,
    k.parent_id,
    k.erbjudande,
    k.namn,
    k.sort,
    k.timmar,
    COALESCE(a.anvanda, 0) AS anvanda,
    CASE WHEN k.aterkallad_at IS NOT NULL THEN 0
         ELSE GREATEST(k.timmar - COALESCE(a.anvanda, 0), 0) END AS kvar,
    k.giltigt_till,
    k.status,
    k.begart_ore,
    k.betalt_ore,
    k.aterbetald_ore,
    k.timpris_ore,
    k.betald_at,
    k.created_at,
    k.status = 'betald'::text AND k.aterkallad_at IS NULL
      AND (k.giltigt_till >= (now() AT TIME ZONE 'Europe/Stockholm'::text)::date
             AND (k.timmar - COALESCE(a.anvanda, 0)) > 0
           OR k.timmar_pa_kopet > COALESCE(a.anvanda, 0) AND k.betald_at IS NOT NULL
             AND (k.betald_at AT TIME ZONE 'Europe/Stockholm'::text)::date + 60
                 >= (now() AT TIME ZONE 'Europe/Stockholm'::text)::date) AS brukbar,
    GREATEST(COALESCE(k.betalt_ore, 0) - k.aterbetald_ore
             - COALESCE(a.anvanda, 0) * (k.timpris_ore - COALESCE(k.familjerabatt_ore, 0)), 0) AS vid_uppsagning_ore,
    (k.betald_at AT TIME ZONE 'Europe/Stockholm'::text)::date + 14 AS angerfrist_till,
    GREATEST(COALESCE(k.betalt_ore, 0) - k.aterbetald_ore - floor(COALESCE(a.anvanda, 0)::numeric * COALESCE(k.betalt_ore, 0)::numeric / k.timmar::numeric)::integer, 0) AS vid_anger_ore,
    CASE WHEN k.aterkallad_at IS NOT NULL THEN 0
         ELSE GREATEST(k.timmar_pa_kopet - COALESCE(a.anvanda, 0), 0) END AS gratis_kvar,
    CASE WHEN k.timmar_pa_kopet > 0 AND k.betald_at IS NOT NULL
         THEN (k.betald_at AT TIME ZONE 'Europe/Stockholm'::text)::date + 60 END AS gratis_till,
    k.aterkallad_at,
    k.till_plan,
    (floor(k.timpris_ore::numeric * (100 - COALESCE(k.rabatt_procent, 0))::numeric / 10000::numeric) * 100::numeric)::integer
      AS rabatterat_timpris_ore,
    k.familjerabatt_ore
   FROM klippkort k
     LEFT JOIN LATERAL ( SELECT sum(CASE WHEN b.forsta_klippkort_id = k.id
                                         THEN LEAST(b.forsta_klippkort_timmar::numeric, d.a)
                                         ELSE GREATEST(d.a - COALESCE(b.forsta_klippkort_timmar, 0)::numeric, 0::numeric)
                                    END)::integer AS anvanda
           FROM bookings b
             CROSS JOIN LATERAL ( SELECT GREATEST(GREATEST(1::numeric, ceil(LEAST(COALESCE(b.duration_min, 60), COALESCE(intern.debiterade_min(b.id), b.duration_min, 60))::numeric / 60.0))
                                                  - CASE WHEN b.startrabatt THEN 1 ELSE 0 END::numeric, 0::numeric) AS a) d
          WHERE (b.klippkort_id = k.id OR b.forsta_klippkort_id = k.id)
            AND b.klippkort_id IS NOT NULL
            AND b.status <> 'cancelled'::text) a ON true;

comment on column public.klippkort_saldo.familjerabatt_ore is
  'familjerabatter (2026-10-15): familjens rabatt per betald timme på köpet, i öre. rabatterat_timpris_ore är '
  'planens timpris före den.';
comment on column public.klippkort_saldo.vid_uppsagning_ore is
  'Vad som går tillbaka om familjen slutar i dag, efter ångerfristen: betalt minus de använda timmarna till '
  'ordinarie timpris, sedan 2026-10-15 minus familjens rabatt på köpet (familjerabatt_ore).';
