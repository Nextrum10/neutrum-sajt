-- Fas 5.3 — RUT: modellen bär skattereduktionen, läxhjälpen påverkas inte.
--
-- Läxhjälp är inte RUT-berättigad (avdraget för läxhjälp togs bort 2015,
-- se laxhjalp-stockholm.html) och får rut_ore = 0 på varje rad. Det här
-- är till för hushållsnära tjänster den dag de aktiveras (Fas 10).
--
-- INGA SKATTESIFFROR I KODEN. Samma regel som ekonomiagenten och
-- foretagsfakta följer: procentsatser och tak hämtas från Skatteverket,
-- de skrivs inte in som fasta tal. Taket per år ligger därför i
-- tabellen rut_tak, som admin fyller i med källa. Den lämnas TOM här.
-- Finns inget tak för året räknar faktureringen ingen RUT alls och
-- säger varför — hellre en faktura utan avdrag än ett avdrag på en
-- gissning.
--
-- PERSONNUMMER krypteras med pgcrypto (pgp_sym_encrypt). Nyckeln
-- skapas slumpmässigt i Vault och står aldrig i en fil. Tabellen har
-- RLS utan en enda policy och inga rättigheter för anon eller
-- inloggade — samma mönster som notis_konfig. Det enda sättet in och
-- ut är tre SECURITY DEFINER-funktioner som kräver admin.
--
-- Fakturabeloppen: las_fakturabelopp låser nu också rut_ore, på samma
-- sätt som belopp_ore (läst med pg_get_functiondef före ändringen).

-- ---------- beloppen ----------
alter table public.invoices      add column rut_ore bigint not null default 0;
alter table public.invoice_lines add column rut_ore bigint not null default 0;
alter table public.invoices      add constraint invoices_rut_ore_check      check (rut_ore >= 0);
alter table public.invoice_lines add constraint invoice_lines_rut_ore_check check (rut_ore >= 0);

comment on column public.invoices.rut_ore is
  'Skattereduktion (RUT) som dragits av på fakturan. belopp_ore är vad kunden betalar; arbetskostnaden är belopp_ore + rut_ore.';
comment on column public.invoice_lines.rut_ore is
  'Skattereduktion (RUT) på raden. 0 för tjänster som inte är RUT-berättigade.';

create or replace function public.las_fakturabelopp()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    return new;
  end if;
  new.belopp_ore := old.belopp_ore;
  new.rut_ore    := old.rut_ore;
  new.period     := old.period;
  new.parent_id  := old.parent_id;
  return new;
end;
$function$;

-- ---------- taket per år ----------
create table public.rut_tak (
  ar         integer primary key check (ar between 2020 and 2100),
  tak_ore    bigint  not null check (tak_ore > 0),
  kalla      text    not null check (char_length(btrim(kalla)) between 3 and 300),
  uppdaterad timestamptz not null default now()
);
comment on table public.rut_tak is
  'RUT-tak per köpare och år, i öre, med källa (Skatteverket). Fylls i av admin — aldrig av kod.';
alter table public.rut_tak enable row level security;
revoke all on public.rut_tak from anon;
create policy "bara admin hanterar rut-tak" on public.rut_tak
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- underlaget per köpare och år ----------
-- Räknas ur fakturorna, så att det inte kan glida isär från dem.
-- security_invoker: admin ser alla, en familj bara sina egna rader
-- (utan tak, som bara admin läser).
create view public.rut_underlag with (security_invoker = true) as
select i.parent_id                          as kund_id,
       extract(year from i.period)::int     as ar,
       sum(i.rut_ore)::bigint               as rut_ore,
       count(*)::int                        as fakturor,
       t.tak_ore,
       t.tak_ore - sum(i.rut_ore)::bigint   as kvar_ore
  from public.invoices i
  left join public.rut_tak t on t.ar = extract(year from i.period)::int
 where i.status <> 'makulerad'
   and i.rut_ore > 0
 group by i.parent_id, extract(year from i.period), t.tak_ore;
revoke all on public.rut_underlag from anon;

-- ---------- skatteuppgifterna ----------
create table public.kund_skatteuppgifter (
  kund_id              uuid primary key references public.profiles(id) on delete cascade,
  personnummer         bytea not null,     -- pgp_sym_encrypt, nyckeln i Vault
  fastighetsbeteckning text check (fastighetsbeteckning is null or char_length(fastighetsbeteckning) <= 120),
  brf_orgnr            text check (brf_orgnr is null or brf_orgnr ~ '^\d{6}-\d{4}$'),
  lagenhetsnummer      text check (lagenhetsnummer is null or char_length(lagenhetsnummer) <= 20),
  uppdaterad           timestamptz not null default now(),
  uppdaterad_av        uuid references public.profiles(id) on delete set null
);
comment on table public.kund_skatteuppgifter is
  'Köparens uppgifter för RUT. Personnumret är krypterat. Läses och skrivs bara via spara_/las_/radera_skatteuppgifter (admin).';
alter table public.kund_skatteuppgifter enable row level security;
revoke all on public.kund_skatteuppgifter from anon, authenticated;

-- Nyckeln: slumpad här, sparad i Vault, aldrig i en fil.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'rut_personnummer') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'rut_personnummer',
      'Nyckel för personnummer i kund_skatteuppgifter. Byts aldrig utan att allt krypteras om.');
  end if;
end $$;

-- Tolv siffror, rimligt datum (dag 61–91 = samordningsnummer) och rätt
-- kontrollsiffra (Luhn på de tio sista).
create or replace function public.personnummer_ok(p text)
returns boolean
language plpgsql
immutable
set search_path to 'public'
as $function$
declare
  d     text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
  tio   text;
  summa int := 0;
  v     int;
  man   int;
  dag   int;
begin
  if length(d) <> 12 then
    return false;
  end if;
  man := substr(d, 5, 2)::int;
  dag := substr(d, 7, 2)::int;
  if man < 1 or man > 12 or not (dag between 1 and 31 or dag between 61 and 91) then
    return false;
  end if;
  tio := substr(d, 3, 10);
  for i in 1..10 loop
    v := substr(tio, i, 1)::int * (case when i % 2 = 1 then 2 else 1 end);
    summa := summa + v / 10 + v % 10;
  end loop;
  return summa % 10 = 0;
end $function$;

create or replace function public.spara_skatteuppgifter(
  p_kund                 uuid,
  p_personnummer         text,
  p_fastighetsbeteckning text default null,
  p_brf_orgnr            text default null,
  p_lagenhetsnummer      text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  pnr    text := regexp_replace(coalesce(p_personnummer, ''), '[^0-9]', '', 'g');
  nyckel text;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501',
      message = 'Bara Nextrum kan spara skatteuppgifter.';
  end if;
  if not public.personnummer_ok(pnr) then
    raise exception using errcode = '22023',
      message = 'Personnumret ska vara tolv siffror, ÅÅÅÅMMDD-XXXX, med rätt kontrollsiffra.';
  end if;
  if not exists (select 1 from public.profiles where id = p_kund) then
    raise exception using errcode = '22023', message = 'Kunden finns inte.';
  end if;

  select decrypted_secret into nyckel from vault.decrypted_secrets where name = 'rut_personnummer';
  if nyckel is null then
    raise exception using errcode = '55000', message = 'Krypteringsnyckeln saknas i Vault.';
  end if;

  insert into public.kund_skatteuppgifter as k
    (kund_id, personnummer, fastighetsbeteckning, brf_orgnr, lagenhetsnummer, uppdaterad, uppdaterad_av)
  values
    (p_kund,
     extensions.pgp_sym_encrypt(pnr, nyckel, 'cipher-algo=aes256'),
     nullif(btrim(coalesce(p_fastighetsbeteckning, '')), ''),
     nullif(btrim(coalesce(p_brf_orgnr, '')), ''),
     nullif(btrim(coalesce(p_lagenhetsnummer, '')), ''),
     now(), auth.uid())
  on conflict (kund_id) do update
    set personnummer         = excluded.personnummer,
        fastighetsbeteckning = excluded.fastighetsbeteckning,
        brf_orgnr            = excluded.brf_orgnr,
        lagenhetsnummer      = excluded.lagenhetsnummer,
        uppdaterad           = excluded.uppdaterad,
        uppdaterad_av        = excluded.uppdaterad_av;
end $function$;

create or replace function public.las_skatteuppgifter(p_kund uuid)
returns table (kund_id uuid, personnummer text, fastighetsbeteckning text,
               brf_orgnr text, lagenhetsnummer text, uppdaterad timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  nyckel text;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501',
      message = 'Bara Nextrum kan läsa skatteuppgifter.';
  end if;
  select decrypted_secret into nyckel from vault.decrypted_secrets where name = 'rut_personnummer';
  return query
    select k.kund_id,
           substr(p.pnr, 1, 8) || '-' || substr(p.pnr, 9, 4),
           k.fastighetsbeteckning, k.brf_orgnr, k.lagenhetsnummer, k.uppdaterad
      from public.kund_skatteuppgifter k
      cross join lateral (select extensions.pgp_sym_decrypt(k.personnummer, nyckel) as pnr) p
     where k.kund_id = p_kund;
end $function$;

create or replace function public.radera_skatteuppgifter(p_kund uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501',
      message = 'Bara Nextrum kan ta bort skatteuppgifter.';
  end if;
  delete from public.kund_skatteuppgifter where kund_id = p_kund;
end $function$;

-- Admin anropar de tre via RPC (inloggad, is_admin() prövas inuti).
-- anon når ingen av dem; kontrollfunktionen är bara för insidan.
revoke execute on function public.spara_skatteuppgifter(uuid, text, text, text, text) from public, anon;
revoke execute on function public.las_skatteuppgifter(uuid)                           from public, anon;
revoke execute on function public.radera_skatteuppgifter(uuid)                        from public, anon;
grant  execute on function public.spara_skatteuppgifter(uuid, text, text, text, text) to authenticated;
grant  execute on function public.las_skatteuppgifter(uuid)                           to authenticated;
grant  execute on function public.radera_skatteuppgifter(uuid)                        to authenticated;
revoke execute on function public.personnummer_ok(text)       from public, anon, authenticated;
revoke execute on function public.las_fakturabelopp()         from public, anon, authenticated;
