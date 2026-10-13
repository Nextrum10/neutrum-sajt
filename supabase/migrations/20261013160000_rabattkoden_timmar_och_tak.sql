-- ============================================================
-- Rabattkoden: inte med timmar i timbanken, också vid köp av timmar,
-- hur många gånger, och ett tak mot gissning (2026-10-13, Leo)
--
-- Leo: "rabattkod kan inte användas om man har timmar i timbanken.
-- rabattkoden kan användas för att köpa timmar i timbanken eller om man
-- har noll timmar kvar och vill köpa pass för pass", och strax efter:
-- "rabattkoder ska vi också bestämma hur många gånger de får användas".
--
-- 1. TIMMAR I TIMBANKEN STÄNGER KODEN PÅ ETT PASS. Har familjen timmar
--    som går att använda i dag (ett kort med timmar kvar, köpt eller
--    gratis: klippkort_saldo.brukbar) eller sparade minuter som räcker
--    till en hel timme, gäller ingen kod på ett pass. Timmarna betalar
--    pass bara med strömbrytaren erbjudanden på, så utan den räknas de
--    inte heller här. Utan timmar gäller koden som förut, på det
--    familjen betalar med pengar (rabattkoden_krockar_inte).
-- 2. KODEN GÄLLER KÖP AV TIMMAR, planer och Fyll timbanken, också när
--    familjen har timmar kvar. klippkort.rabattkod och rabatt_ore.
--    Kassan (stripe-checkout) skickar koden; triggern här räknar
--    rabatten ur katalogens pris (erbjudanden_pris) och sätter det som
--    ska dras (begart_ore). En kod som inte gäller tas bort och köpet får
--    katalogens pris; kassan prövar koden först och säger varför.
--    Gratistimmar från oss bär aldrig en kod. Ett köp kan inte bli gratis
--    av en kod (begart_ore är aldrig noll, och kortet kan inte dra noll):
--    då gäller koden inte på köpet.
-- 3. HUR MÅNGA GÅNGER. max_anvandningar (totalt, fanns) och
--    max_per_familj (ny). En användning är ett pass som inte är avbokat
--    och har kvar koden, eller ett betalt köp med koden. Ett köp som
--    väntar på betalning (yngre än ett dygn, kassans livslängd) håller
--    sin plats mot gränsen totalt, men räknas inte i antalet och inte
--    mot familjens egen gräns (en kassa familjen lämnade ska inte stänga
--    koden för dem).
--    antal_anvandningar räknas om när ett pass eller köp ändras, så ett
--    avbokat pass ger tillbaka sin användning; förut räknades varje
--    skapat pass, för alltid.
-- 4. TAKET (minne/sakerhet.md: "Skapas den första koden ... Lägg ett tak
--    då"). kolla_rabattkod och kolla_rabattkod_kop räknar familjens
--    försök med en kod som inte finns: tio på en timme, sedan svarar de
--    att familjen får vänta. Försöken sparas som en HMAC av kontot,
--    aldrig kontot, och gallras efter ett dygn, som barnets
--    inloggningsförsök (barnets_epost). Triggrarna på pass och köp
--    prövar koden genom intern.rabattkod_prova, utan tak.
--
-- skydda_rabatt, kolla_rabattkod och rakna_rabattkod skrivs om helt, och
-- vakten prövar först driftens text 2026-10-13 (md5 på prosrc); bär
-- funktionen redan rabattkoden_timmar_och_tak släpper vakten igenom, så
-- filen går att köra två gånger. Inget drop och inget delete utanför en
-- funktion, och ingen funktion med två.
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 0. driften är som den lästes ----------
do $$
declare
  f   record;
  src text;
begin
  -- kolla_rabattkod har två summor: driftens (utan kommentarerna) och den
  -- lokala byggd ur arkivet (schema-v20.sql, med dem). Koden är densamma.
  for f in
    select * from (values
      ('public.skydda_rabatt()',                    array['49c2932656b6f2c88d9be5e34ded9bee']),
      ('public.kolla_rabattkod(text,text,bigint)',  array['96c3320c3a23432ddd1d873d19cc9a4e',
                                                          '407154d70969f6d79e947ba5e5a635ff']),
      ('public.rakna_rabattkod()',                  array['5698d5972b7e03f6b4d57529658f3fdb'])) v(namn, summor)
  loop
    select p.prosrc into src from pg_proc p where p.oid = f.namn::regprocedure;
    if position('rabattkoden_timmar_och_tak' in src) = 0 and not (md5(src) = any (f.summor)) then
      raise exception '% har ändrats sedan rabattkoden_timmar_och_tak skrevs (md5 %). Läs driften och skriv om migrationen.',
        f.namn, md5(src);
    end if;
  end loop;
end $$;


-- ---------- 1. kolumnerna ----------
alter table public.rabattkoder add column if not exists max_per_familj integer;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rabattkoder_max_per_familj_check') then
    alter table public.rabattkoder
      add constraint rabattkoder_max_per_familj_check check (max_per_familj is null or max_per_familj > 0);
  end if;
end $$;
comment on column public.rabattkoder.max_per_familj is
  '2026-10-13. Hur många gånger en familj får använda koden, på pass och köp av timmar sammanlagt. Null: utan gräns.';

alter table public.klippkort add column if not exists rabattkod text references public.rabattkoder(kod);
alter table public.klippkort add column if not exists rabatt_ore bigint;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'klippkort_rabatt_ore_check') then
    alter table public.klippkort add constraint klippkort_rabatt_ore_check check (rabatt_ore is null or rabatt_ore > 0);
  end if;
end $$;
create index if not exists klippkort_rabattkod_idx on public.klippkort (rabattkod) where rabattkod is not null;
comment on column public.klippkort.rabattkod is
  '2026-10-13. Rabattkoden på köpet. Prövas och räknas av intern.klippkort_rabatt när köpet skapas.';
comment on column public.klippkort.rabatt_ore is
  '2026-10-13. Rabatten på köpet i öre. begart_ore är katalogens pris minus den.';


-- ---------- 2. försöken ----------
-- Bara HMAC:ar av kontot, aldrig kontot, och inget äldre än ett dygn.
create table if not exists intern.rabattkod_forsok (
  id     bigint generated always as identity primary key,
  nyckel text not null,
  tid    timestamptz not null default now()
);
create index if not exists rabattkod_forsok_nyckel on intern.rabattkod_forsok (nyckel, tid);
create index if not exists rabattkod_forsok_tid on intern.rabattkod_forsok (tid);
alter table intern.rabattkod_forsok enable row level security;
revoke all on intern.rabattkod_forsok from public, anon, authenticated;

create or replace function intern.rabattkod_forsok_nyckel(p_konto uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select encode(extensions.hmac(convert_to('rabattkod-forsok:v1:' || p_konto::text, 'UTF8'),
                                decode(k.barn_nyckel, 'base64'), 'sha256'), 'base64')
    from public.notis_konfig k
   where k.id = 1
$$;

/* Ett försök med en kod som inte fanns. Det enda delete:et gallrar
   försök äldre än ett dygn, för alla, så att tabellen aldrig växer. */
create or replace function intern.rabattkod_forsok_notera(p_nyckel text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from intern.rabattkod_forsok f where f.tid < now() - interval '1 day';
  insert into intern.rabattkod_forsok (nyckel) values (p_nyckel);
end $$;

create or replace function intern.rabattkod_for_manga(p_nyckel text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*) >= 10 from intern.rabattkod_forsok f
   where f.nyckel = p_nyckel and f.tid > now() - interval '1 hour'
$$;

revoke all on function intern.rabattkod_forsok_nyckel(uuid) from public, anon, authenticated;
revoke all on function intern.rabattkod_forsok_notera(text) from public, anon, authenticated;
revoke all on function intern.rabattkod_for_manga(text) from public, anon, authenticated;


-- ---------- 3. hjälparna ----------
/* Hur många gånger koden använts: pass som inte är avbokade och har
   kvar koden, och betalda köp (också ett i tvist: pengarna kom in).
   p_familj begränsar till en familj. med_vantande räknar också köp som
   väntar på betalning och är yngre än ett dygn: de håller sin plats när
   en ny användning prövas, men står inte i antalet. */
create or replace function intern.rabattkod_anvand(p_kod text, p_familj uuid default null,
                                                   med_vantande boolean default false)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (select count(*) from public.bookings b
           where b.rabattkod = p_kod and b.status <> 'cancelled'
             and (p_familj is null or b.parent_id = p_familj))::integer
       + (select count(*) from public.klippkort k
           where k.rabattkod = p_kod
             and (k.status in ('betald', 'tvist')
                  or (med_vantande and k.status = 'vantar' and k.created_at > now() - interval '1 day'))
             and (p_familj is null or k.parent_id = p_familj))::integer
$$;

/* Har familjen timmar i timbanken som går att använda i dag? Ett kort
   med timmar kvar (köpt eller gratis), eller sparade minuter som räcker
   till en hel timme. Timmarna betalar pass bara med strömbrytaren
   erbjudanden på (intern.timmar_betala), och utan den räknas de inte. */
create or replace function intern.har_timmar(p_familj uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select f.aktiv from public.flaggor f where f.kod = 'erbjudanden'), false)
     and (exists (select 1 from public.klippkort_saldo s where s.parent_id = p_familj and s.brukbar)
          or coalesce(intern.timbank_saldo(p_familj), 0) >= 60)
$$;

/* Tjänsten ett köp av timmar gäller: samma regel som erbjudanden_pris
   och standard_tjanst(), den första aktiva tjänsten kunder kan köpa. */
create or replace function intern.kopets_tjanst()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.kod from public.tjanster t where t.aktiv and t.for_kund order by t.ordning, t.kod limit 1
$$;

/* Prövar en kod, utan tak. p_kop: ett köp av timmar, där timmarna i
   timbanken inte stänger koden och ett köp inte får bli gratis.
   p_familj: familjen koden ska gälla, för gränsen per familj och
   timmarna. */
create or replace function intern.rabattkod_prova(p_kod text, p_tjanst text, p_belopp_ore bigint,
                                                  p_familj uuid, p_kop boolean)
returns table (giltig boolean, orsak text, rabatt_ore bigint, beskrivning text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  r   public.rabattkoder%rowtype;
  ren text := upper(btrim(coalesce(p_kod, '')));
  rab bigint;
begin
  if ren = '' then
    return query select false, 'Skriv en kod.'::text, 0::bigint, null::text;
    return;
  end if;

  select * into r from public.rabattkoder k where k.kod = ren;
  -- TIPS är markeringen på en tipstimme, aldrig en kod någon skriver in.
  if not found or not r.aktiv or ren = 'TIPS' then
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

  if not p_kop and p_familj is not null and intern.har_timmar(p_familj) then
    return query select false,
      'Koden gäller inte när ni har timmar i timbanken. Den går att använda när ni köper timmar, eller på ett pass när timbanken är tom.'::text,
      0::bigint, null::text;
    return;
  end if;

  if r.typ = 'procent' then
    rab := floor(coalesce(p_belopp_ore, 0) * r.varde / 100.0);
  else
    rab := r.varde;
  end if;
  -- En rabatt gör aldrig något negativt. Gratis, ja; skuld till familjen, nej.
  rab := least(greatest(rab, 0), greatest(coalesce(p_belopp_ore, 0), 0));

  -- Ett köp kan inte bli gratis: kortet kan inte dra noll kronor, och
  -- gratistimmar sätter vi in själva (ge_gratistimmar).
  if p_kop and rab >= coalesce(p_belopp_ore, 0) then
    return query select false, 'Koden gäller inte köp av timmar.'::text, 0::bigint, null::text;
    return;
  end if;

  return query select true, null::text, rab, r.beskrivning;
end $$;

revoke all on function intern.rabattkod_anvand(text, uuid, boolean) from public, anon, authenticated;
revoke all on function intern.har_timmar(uuid) from public, anon, authenticated;
revoke all on function intern.kopets_tjanst() from public, anon, authenticated;
revoke all on function intern.rabattkod_prova(text, text, bigint, uuid, boolean) from public, anon, authenticated;


-- ---------- 4. kolla_rabattkod: med taket och familjens timmar ----------
create or replace function public.kolla_rabattkod(
  p_kod text,
  p_tjanst text default null,
  p_belopp_ore bigint default 0
)
returns table (giltig boolean, orsak text, rabatt_ore bigint, beskrivning text)
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  -- rabattkoden_timmar_och_tak: taket, och familjens timmar.
  jag    uuid := auth.uid();
  nyckel text;
  svar   record;
begin
  -- Utloggad ska inte kunna pröva koder. Bokning kräver inloggning ändå.
  if jag is null then
    return query select false, 'Logga in först.'::text, 0::bigint, null::text;
    return;
  end if;

  nyckel := intern.rabattkod_forsok_nyckel(jag);
  if intern.rabattkod_for_manga(nyckel) then
    return query select false, 'För många försök med koder. Vänta en timme och försök igen.'::text, 0::bigint, null::text;
    return;
  end if;

  select * into svar from intern.rabattkod_prova(p_kod, p_tjanst, p_belopp_ore, jag, false);
  if not svar.giltig and svar.orsak like 'Koden finns inte%' then
    perform intern.rabattkod_forsok_notera(nyckel);
  end if;
  return query select svar.giltig, svar.orsak, svar.rabatt_ore, svar.beskrivning;
end $$;

revoke execute on function public.kolla_rabattkod(text, text, bigint) from public;
grant execute on function public.kolla_rabattkod(text, text, bigint) to anon, authenticated, service_role;


-- ---------- 5. kolla_rabattkod_kop: en kod på ett köp av timmar ----------
/* Vad ett erbjudande kostar med koden, för familjen som frågar. Kassan
   frågar med familjens token innan köpet skapas, och vyn för att visa
   priset. Samma tak som kolla_rabattkod. */
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
  svar   record;
begin
  if jag is null then
    return query select false, 'Logga in först.'::text, 0::bigint, null::text, null::bigint, null::bigint;
    return;
  end if;

  select e.pris_ore into pris from public.erbjudanden_pris e where e.kod = p_erbjudande;
  if pris is null or pris <= 0 then
    return query select false, 'Erbjudandet finns inte.'::text, 0::bigint, null::text, null::bigint, null::bigint;
    return;
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

revoke all on function public.kolla_rabattkod_kop(text, text) from public, anon, nextrum_barn;
grant execute on function public.kolla_rabattkod_kop(text, text) to authenticated, service_role;

comment on function public.kolla_rabattkod_kop(text, text) is
  '2026-10-13. Priset på ett erbjudande med en rabattkod, för den inloggade familjen. Tio försök med en kod som inte finns per timme.';


-- ---------- 6. skydda_rabatt: koden prövas för familjen, utan tak ----------
create or replace function public.skydda_rabatt()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  facit bigint;
  brutto bigint;
  t_rad public.tjanster%rowtype;
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.rabattkod := old.rabattkod;
    new.rabatt_ore := old.rabatt_ore;
    return new;
  end if;

  if new.rabattkod is null then
    new.rabatt_ore := null;
    return new;
  end if;

  -- Fas 19.5: bookings_frys_priset har redan satt passets pris.
  select * into t_rad from public.tjanster where kod = new.tjanst;
  brutto := round(
      (coalesce(new.timpris_ore, t_rad.pris_per_timme_ore, 0)
        + case when coalesce(new.antal_barn, 1) > 1
               then coalesce(new.extra_ore, t_rad.extra_personer_ore, 0) else 0 end)
      * coalesce(new.duration_min, 60) / 60.0);

  -- rabattkoden_timmar_och_tak: koden prövas för passets familj, utan
  -- tak (taket gäller den som provar koder i vyn), och med gränserna och
  -- timmarna i timbanken. Kodens rad låses, så att två pass inte tar den
  -- sista användningen samtidigt.
  perform 1 from public.rabattkoder where kod = upper(btrim(new.rabattkod)) for update;
  select k.rabatt_ore into facit
  from intern.rabattkod_prova(new.rabattkod, new.tjanst, brutto, new.parent_id, false) k
  where k.giltig;

  if facit is null then
    new.rabattkod := null;
    new.rabatt_ore := null;
  else
    new.rabattkod := upper(btrim(new.rabattkod));
    new.rabatt_ore := least(coalesce(new.rabatt_ore, facit), facit);
  end if;

  return new;
end $$;


-- ---------- 7. köpet: koden prövas och priset sätts i databasen ----------
create or replace function intern.klippkort_rabatt()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pris bigint;
  rab  bigint;
begin
  if new.rabattkod is null then
    new.rabatt_ore := null;
    return new;
  end if;
  new.rabattkod := upper(btrim(new.rabattkod));

  -- Katalogens pris, samma som kassan läser. Gratistimmar bär ingen kod.
  select e.pris_ore into pris from public.erbjudanden_pris e where e.kod = new.erbjudande;
  if pris is null or new.erbjudande = 'gratis' then
    new.rabattkod := null;
    new.rabatt_ore := null;
    return new;
  end if;

  perform 1 from public.rabattkoder where kod = new.rabattkod for update;
  select k.rabatt_ore into rab
    from intern.rabattkod_prova(new.rabattkod, intern.kopets_tjanst(), pris, new.parent_id, true) k
   where k.giltig;

  if rab is null or rab <= 0 then
    new.rabattkod := null;
    new.rabatt_ore := null;
    new.begart_ore := pris;
  else
    new.rabatt_ore := rab;
    new.begart_ore := pris - rab;
  end if;
  return new;
end $$;

revoke all on function intern.klippkort_rabatt() from public, anon, authenticated;

create or replace trigger klippkort_rabatt
  before insert on public.klippkort
  for each row execute function intern.klippkort_rabatt();

-- En kod på köpet ändras aldrig efteråt: priset är dragit på den.
create or replace function intern.klippkort_rabatt_star_fast()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.rabattkod := old.rabattkod;
  new.rabatt_ore := old.rabatt_ore;
  return new;
end $$;

revoke all on function intern.klippkort_rabatt_star_fast() from public, anon, authenticated;

create or replace trigger klippkort_rabatt_star_fast
  before update on public.klippkort
  for each row
  when (old.rabattkod is distinct from new.rabattkod or old.rabatt_ore is distinct from new.rabatt_ore)
  execute function intern.klippkort_rabatt_star_fast();


-- ---------- 8. antalet räknas om ----------
create or replace function public.rakna_rabattkod()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- rabattkoden_timmar_och_tak: antalet räknas om ur passen och köpen,
  -- så att ett avbokat pass ger tillbaka sin användning. Gäller både
  -- bookings och klippkort, som båda har rabattkod och status.
  if new.rabattkod is not null then
    update public.rabattkoder
       set antal_anvandningar = intern.rabattkod_anvand(new.rabattkod)
     where kod = new.rabattkod;
  end if;
  -- OLD finns bara i en UPDATE, så den läses bara där.
  if tg_op = 'UPDATE' then
    if old.rabattkod is not null and old.rabattkod is distinct from new.rabattkod then
      update public.rabattkoder
         set antal_anvandningar = intern.rabattkod_anvand(old.rabattkod)
       where kod = old.rabattkod;
    end if;
  end if;
  return null;
end $$;

/* bookings_rakna_rabattkod (efter INSERT) står kvar. Ändringarna: en
   vanlig UPDATE-trigger, inte UPDATE OF, för en kod som en BEFORE-trigger
   tar bort (timmarna som betalar) står inte i satsens kolumner. */
create or replace trigger bookings_rakna_rabattkod_andring
  after update on public.bookings
  for each row
  when (old.rabattkod is distinct from new.rabattkod
        or (new.rabattkod is not null and old.status is distinct from new.status))
  execute function public.rakna_rabattkod();

create or replace trigger klippkort_rakna_rabattkod
  after insert on public.klippkort
  for each row when (new.rabattkod is not null)
  execute function public.rakna_rabattkod();

create or replace trigger klippkort_rakna_rabattkod_andring
  after update on public.klippkort
  for each row
  when (old.rabattkod is distinct from new.rabattkod
        or (new.rabattkod is not null and old.status is distinct from new.status))
  execute function public.rakna_rabattkod();

-- Antalet en gång, med den nya räkningen. Också TIPS: triggern räknar om
-- den så vid nästa tipstimme, och ingen läser talet utom adminvyn.
update public.rabattkoder r
   set antal_anvandningar = intern.rabattkod_anvand(r.kod)
 where r.antal_anvandningar is distinct from intern.rabattkod_anvand(r.kod);
