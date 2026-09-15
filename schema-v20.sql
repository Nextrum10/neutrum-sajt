-- ============================================================
-- NEXTRUM — schema v20
-- RABATTKODER, OCH FLERA BARN PÅ SAMMA PASS
--
-- Körs efter schema-v19.sql. Idempotent.
--
-- Två saker i en migration, för att de landar på samma ställe: i
-- vad en bokning faktiskt kostar. Att införa dem var för sig hade
-- betytt att räkningen i `fakturering` byggdes om två gånger.
--
--
-- DEN REGEL SOM STYR RABATTKODERNA
--
-- KODEN GÅR INTE ATT LISTA UT, OCH RABATTEN FRYSER VID BOKNINGEN.
--
-- Tabellen är stängd för alla utom admin. Ingen policy släpper in
-- en inloggad familj — hade den gjort det kunde vem som helst
-- hämta hela listan med giltiga koder ur webbläsaren och använda
-- den kod som var mest värd.
--
-- I stället finns EN funktion, kolla_rabattkod(), som svarar på
-- exakt en fråga: "gäller den här koden för det här passet, och
-- vad blir rabatten?" Den lämnar aldrig ut något om koder man inte
-- frågat efter, och den kan inte användas för att räkna upp dem.
--
-- Och: rabatten räknas fram EN gång, vid bokningen, och skrivs på
-- raden som ett belopp i öre. Läser faktureringen koden i stället
-- och räknar om, ändras gamla passens pris den dag någon justerar
-- koden. En faktura får aldrig ändra sig i efterhand.
--
--
-- FLERA BARN
--
-- Priset för extra barn har hittills bara funnits i texten på
-- prissidan. Ingen kolumn, och `fakturering` räknade inte med det:
-- ett pass med tre syskon fakturerades som ett pass. Sajten lovade
-- alltså något systemet inte gjorde.
--
-- Nu ligger tillägget i `tjanster` som två fält — beloppet och hur
-- många barn det täcker — så att regeln går att ändra utan en
-- migration. För läxhjälp: 69 kr, som täcker upp till tre barn.
-- Alltså 379 kr för ett barn och 448 kr för två ELLER tre.
-- ============================================================


-- ============================================================
-- 1. TILLÄGGET FÖR FLERA BARN
-- ============================================================

alter table public.tjanster
  add column if not exists extra_personer_ore bigint,
  add column if not exists extra_personer_max integer not null default 1;

comment on column public.tjanster.extra_personer_ore is
  'Engångstillägg per timme när passet gäller fler än ett barn. NULL = tjänsten tar inte flera barn.';
comment on column public.tjanster.extra_personer_max is
  'Hur många barn ett pass får gälla totalt. 1 = bara ett. Tillägget är samma oavsett om de är två eller tre — det är EN summa, inte en per barn.';

update public.tjanster
set extra_personer_ore = coalesce(extra_personer_ore, 6900),
    extra_personer_max = 3
where kod = 'laxhjalp';

alter table public.bookings
  add column if not exists antal_barn integer not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_antal_barn_check') then
    alter table public.bookings
      add constraint bookings_antal_barn_check check (antal_barn between 1 and 10);
  end if;
end $$;

comment on column public.bookings.antal_barn is
  'Hur många barn passet gäller. Alla rader före v20 är 1. Taket per tjänst står i tjanster.extra_personer_max; check-villkoret här är bara ett yttre skydd mot orimliga tal.';


-- ============================================================
-- 2. KODERNA
-- ============================================================

create table if not exists public.rabattkoder (
  kod                 text primary key,
  beskrivning         text,
  typ                 text not null default 'procent',
  varde               integer not null,
  tjanst              text references public.tjanster(kod),
  giltig_fran         date,
  giltig_till         date,
  max_anvandningar    integer,
  antal_anvandningar  integer not null default 0,
  aktiv               boolean not null default true,
  skapad              timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rabattkoder_typ_check') then
    alter table public.rabattkoder
      add constraint rabattkoder_typ_check check (typ in ('procent', 'belopp'));
  end if;
  -- Procent över 100 är inte en rabatt, det är en utbetalning.
  if not exists (select 1 from pg_constraint where conname = 'rabattkoder_varde_check') then
    alter table public.rabattkoder
      add constraint rabattkoder_varde_check
      check (varde > 0 and (typ <> 'procent' or varde <= 100));
  end if;
  -- Koden lagras i versaler. Familjen skriver "sommar10", vi jämför
  -- mot SOMMAR10, och då måste det bara finnas ett sätt att lagra den.
  if not exists (select 1 from pg_constraint where conname = 'rabattkoder_kod_check') then
    alter table public.rabattkoder
      add constraint rabattkoder_kod_check
      check (kod = upper(kod) and kod ~ '^[A-Z0-9-]{3,24}$');
  end if;
end $$;

comment on table public.rabattkoder is
  'Rabattkoder. STÄNGD för alla utom admin — en inloggad familj som kan läsa tabellen kan läsa alla koder. Kontroll sker via kolla_rabattkod().';
comment on column public.rabattkoder.varde is
  'Procent (1-100) när typ = procent, annars öre.';
comment on column public.rabattkoder.tjanst is
  'NULL = gäller alla tjänster. Annars bara den tjänsten.';

alter table public.rabattkoder enable row level security;

drop policy if exists "bara admin hanterar rabattkoder" on public.rabattkoder;
create policy "bara admin hanterar rabattkoder" on public.rabattkoder
  for all using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Bältet till hängslena ovan: inga grants alls till anon. En
-- utloggad besökare har ingen anledning att röra tabellen.
revoke all on public.rabattkoder from anon;


-- ============================================================
-- 3. KONTROLLEN
--
-- Svarar på en fråga om EN kod. Lämnar aldrig ut något om andra.
-- `orsak` finns för att den som skrivit fel ska få veta vad som är
-- fel — "koden gäller inte läxhjälp" är hjälpsamt, "ogiltig kod"
-- är det inte.
-- ============================================================

create or replace function public.kolla_rabattkod(
  p_kod text,
  p_tjanst text default null,
  p_belopp_ore bigint default 0
)
returns table (giltig boolean, orsak text, rabatt_ore bigint, beskrivning text)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  r public.rabattkoder%rowtype;
  ren text := upper(trim(coalesce(p_kod, '')));
  rab bigint;
begin
  -- Utloggad ska inte kunna prova koder. Bokning kräver inloggning
  -- ändå, så det här stänger bara en dörr ingen behöver.
  if auth.uid() is null then
    return query select false, 'Logga in först.'::text, 0::bigint, null::text;
    return;
  end if;

  if ren = '' then
    return query select false, 'Skriv en kod.'::text, 0::bigint, null::text;
    return;
  end if;

  select * into r from public.rabattkoder where kod = ren;

  if not found or not r.aktiv then
    return query select false, 'Koden finns inte, eller gäller inte längre.'::text, 0::bigint, null::text;
    return;
  end if;

  if r.giltig_fran is not null and current_date < r.giltig_fran then
    return query select false, ('Koden gäller från ' || to_char(r.giltig_fran, 'YYYY-MM-DD') || '.')::text, 0::bigint, null::text;
    return;
  end if;

  if r.giltig_till is not null and current_date > r.giltig_till then
    return query select false, 'Koden har gått ut.'::text, 0::bigint, null::text;
    return;
  end if;

  if r.max_anvandningar is not null and r.antal_anvandningar >= r.max_anvandningar then
    return query select false, 'Koden är slut.'::text, 0::bigint, null::text;
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

  -- En rabatt får aldrig göra passet negativt. Gratis, ja; skuld
  -- till familjen, nej.
  rab := least(greatest(rab, 0), greatest(coalesce(p_belopp_ore, 0), 0));

  return query select true, null::text, rab, r.beskrivning;
end $function$;

revoke execute on function public.kolla_rabattkod(text, text, bigint) from anon;
grant execute on function public.kolla_rabattkod(text, text, bigint) to authenticated;


-- ============================================================
-- 4. KODEN PÅ BOKNINGEN
--
-- rabatt_ore är FRUSEN. Den räknas fram vid bokningen och rörs
-- aldrig igen, oavsett vad som händer med koden sedan.
-- ============================================================

alter table public.bookings
  add column if not exists rabattkod text references public.rabattkoder(kod),
  add column if not exists rabatt_ore bigint;

create index if not exists bookings_rabattkod_idx
  on public.bookings (rabattkod) where rabattkod is not null;

comment on column public.bookings.rabatt_ore is
  'Rabatten i öre, framräknad vid bokningen. Läses av fakturering. Räknas ALDRIG om — en faktura får inte ändra sig för att någon justerat koden efteråt.';


-- ============================================================
-- 5. RÄKNAREN
--
-- Triggern, inte klienten, räknar upp användningarna. En klient som
-- glömmer det gör "max 50 användningar" till ett löfte utan täckning,
-- och en klient som gör det två gånger bränner koden i förtid.
-- ============================================================

create or replace function public.rakna_rabattkod()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.rabattkod is not null then
    update public.rabattkoder
    set antal_anvandningar = antal_anvandningar + 1
    where kod = new.rabattkod;
  end if;
  return null;
end $function$;

drop trigger if exists bookings_rakna_rabattkod on public.bookings;
create trigger bookings_rakna_rabattkod
  after insert on public.bookings
  for each row execute function public.rakna_rabattkod();


-- ============================================================
-- 6. SKYDDA rabatt_ore MOT KLIENTEN
--
-- Beloppet sätts av klienten vid inserten, vilket är oundvikligt —
-- men det ska inte gå att ÄNDRA efteråt, och inte gå att sätta
-- högre än vad koden faktiskt ger. Utan det här kan en manipulerad
-- webbläsare boka med rabatt_ore satt till hela beloppet.
-- ============================================================

create or replace function public.skydda_rabatt()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  facit bigint;
  brutto bigint;
  t_rad public.tjanster%rowtype;
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;

  -- Ändring: rabatten ligger fast.
  if tg_op = 'UPDATE' then
    new.rabattkod := old.rabattkod;
    new.rabatt_ore := old.rabatt_ore;
    return new;
  end if;

  if new.rabattkod is null then
    new.rabatt_ore := null;
    return new;
  end if;

  select * into t_rad from public.tjanster where kod = new.tjanst;
  brutto := round(
      (coalesce(t_rad.pris_per_timme_ore, 0)
        + case when coalesce(new.antal_barn, 1) > 1
               then coalesce(t_rad.extra_personer_ore, 0) else 0 end)
      * coalesce(new.duration_min, 60) / 60.0);

  select k.rabatt_ore into facit
  from public.kolla_rabattkod(new.rabattkod, new.tjanst, brutto) k
  where k.giltig;

  if facit is null then
    -- Ogiltig kod bokar utan rabatt i stället för att kasta bort
    -- bokningen. Passet är det viktiga.
    new.rabattkod := null;
    new.rabatt_ore := null;
  else
    new.rabatt_ore := least(coalesce(new.rabatt_ore, facit), facit);
  end if;

  return new;
end $function$;

drop trigger if exists bookings_skydda_rabatt on public.bookings;
create trigger bookings_skydda_rabatt
  before insert or update on public.bookings
  for each row execute function public.skydda_rabatt();


-- ============================================================
-- EFTERÅT
--
--   select kod, typ, varde, aktiv, antal_anvandningar
--   from public.rabattkoder;
--   -- tom, tills någon skapar en i adminvyn
--
--   select kod, extra_personer_ore, extra_personer_max
--   from public.tjanster where kod = 'laxhjalp';
--   -- 6900 och 3
--
--
-- KVAR: edge-funktionen fakturering måste läsa antal_barn och
-- rabatt_ore, annars är båda de här kolumnerna bokföring utan
-- verkan. Den ändringen ligger i samma leverans som den här filen.
-- ============================================================
