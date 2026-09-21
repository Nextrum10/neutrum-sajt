-- ============================================================
-- NEXTRUM — program 2, Fas 1.7: utbetalningsmetod
--
-- Studiehjälparen ska kunna lämna bankkonto eller Swishnummer. Ingen
-- utbetalning görs; det här är insamling och kontroll.
--
-- BAKOM FLAGGAN utbetalningsmetod, som är av. Att samla in
-- kontonummer innan integritetspolicyn säger varför, med vilken
-- grund och hur länge, är ett juridiskt beslut som inte är fattat.
-- Flaggan stoppar INSAMLINGEN i databasen, inte bara knappen: den
-- som anropar spara_utbetalningsmetod direkt får samma nej. Att läsa
-- och ta bort det man redan lämnat går alltid.
--
-- LAGRINGEN följer kund_skatteuppgifter (Fas 5.3), som redan är
-- granskad: egen tabell, RLS på och inga policyer alls, åtkomst bara
-- genom SECURITY DEFINER-funktioner, uppgiften krypterad med pgcrypto
-- och en nyckel i Vault. Skillnaden är grinden: där är det bara
-- admin, här också ägaren — det är ju hens eget konto.
--
-- VARFÖR INTE I tutor_profiles: policyn "familj läser matchad
-- studiehjälpare" ger familjen hela raden. Ett kontonummer där hade
-- varit läsbart för varje familj studiehjälparen har.
--
-- DET SOM LIGGER I KLARTEXT är banknamnet, de fyra sista siffrorna
-- och om kontrollsiffran gick att pröva. Det räcker för att visa
-- "Swedbank, slutar på 4821" utan att dekryptera. Hela numret
-- dekrypteras bara i las_utbetalningsmetod_klartext, bara för admin,
-- och varje sådan läsning hamnar i auditloggen.
--
-- KONTROLLEN bygger på Bankgirots "Bankernas kontonummer"
-- (2024-02-22) med ändringarna i Bankinfrastruktur i Sveriges tabell
-- (uppdaterad 2026-08-06): nya serier, Avanzas delning, och serier
-- som upphört (DNB 9260–9269, Riksgälden, Swedbank 9300–9349).
-- Tabellen ligger i intern.clearingnummer. En ny bank är en ny rad.
--
-- Där dokumenten är entydiga (typ 1, typ 2 kommentar 1 och 2) NEKAS
-- ett nummer vars kontrollsiffra inte stämmer. Där de inte är det —
-- typ 2 kommentar 3 kontrolleras "som regel", och variant 4 saknar
-- utskrivna vikter — sparas numret men märks som okontrollerat, så
-- att ett riktigt konto aldrig stoppas av en gissning. Ett
-- clearingnummer som inte finns i tabellen nekas.
-- ============================================================

-- ---------- tabellen över clearingnummer ----------

create table if not exists intern.clearingnummer (
  fran    int not null,
  till    int not null,
  bank    text not null,
  typ     smallint not null check (typ in (1, 2)),
  variant smallint not null check (variant in (1, 2, 3, 4)),
  check (fran <= till)
);

comment on table intern.clearingnummer is
  'Clearingserier. Källa: Bankgirot, Bankernas kontonummer (2024-02-22), med ändringar ur '
  'Bankinfrastruktur i Sveriges tabell (2026-08-06). typ/variant som i dokumenten. Serierna överlappar inte.';

revoke all on intern.clearingnummer from public, anon, authenticated;

truncate intern.clearingnummer;
insert into intern.clearingnummer (fran, till, bank, typ, variant) values
  (1100, 1199, 'Nordea', 1, 1),
  (1200, 1399, 'Danske Bank', 1, 1),
  (1400, 2099, 'Nordea', 1, 1),
  (2110, 2119, 'Juni Technology', 1, 2),
  (2120, 2129, 'Steven', 1, 1),
  (2130, 2139, 'Zimpler', 1, 1),
  (2140, 2149, 'Trustly', 1, 2),
  (2150, 2159, 'Revolut', 2, 4),
  (2160, 2169, 'Trade Republic', 2, 4),
  (2170, 2179, 'PPRO', 1, 1),
  (2180, 2189, 'Stripe', 1, 1),
  (2300, 2399, 'Ålandsbanken', 1, 2),
  (2400, 2499, 'Danske Bank', 1, 1),
  (3000, 3299, 'Nordea', 1, 1),
  (3300, 3300, 'Nordea personkonto', 2, 1),
  (3301, 3399, 'Nordea', 1, 1),
  (3400, 3409, 'Länsförsäkringar Bank', 1, 1),
  (3410, 3781, 'Nordea', 1, 1),
  (3782, 3782, 'Nordea personkonto', 2, 1),
  (3783, 3999, 'Nordea', 1, 1),
  (4000, 4999, 'Nordea', 1, 2),
  (5000, 5999, 'SEB', 1, 1),
  (6000, 6999, 'Handelsbanken', 2, 2),
  (7000, 7999, 'Swedbank', 1, 1),
  (8000, 8999, 'Swedbank', 2, 3),
  (9020, 9029, 'Länsförsäkringar Bank', 1, 2),
  (9040, 9049, 'Citibank', 1, 2),
  (9060, 9069, 'Länsförsäkringar Bank', 1, 1),
  (9070, 9079, 'Multitude Bank', 1, 1),
  (9100, 9109, 'Nordnet Bank', 1, 2),
  (9120, 9124, 'SEB', 1, 1),
  (9130, 9149, 'SEB', 1, 1),
  (9150, 9169, 'Skandiabanken', 1, 2),
  (9170, 9179, 'Ikano Bank', 1, 1),
  (9180, 9189, 'Danske Bank', 2, 1),
  (9190, 9199, 'DNB Bank', 1, 2),
  (9230, 9239, 'Marginalen Bank', 1, 1),
  (9250, 9259, 'SBAB', 1, 1),
  (9270, 9279, 'ICA Banken', 1, 1),
  (9280, 9289, 'Resurs Bank', 1, 1),
  (9390, 9399, 'Landshypotek', 1, 2),
  (9400, 9449, 'Forex Bank', 1, 1),
  (9460, 9469, 'Santander Consumer Bank', 1, 1),
  (9470, 9479, 'BNP Paribas', 1, 2),
  (9500, 9549, 'Nordea (Plusgirot)', 2, 3),
  (9550, 9564, 'Avanza Bank', 1, 2),
  (9565, 9569, 'Avanza Bank', 2, 4),
  (9570, 9579, 'Sparbanken Syd', 2, 1),
  (9580, 9589, 'Aion Bank', 1, 1),
  (9590, 9599, 'EP Bank', 1, 2),
  (9600, 9609, 'Banking Circle', 2, 4),
  (9630, 9639, 'Lån & Spar Bank', 1, 1),
  (9640, 9649, 'NOBA Bank', 1, 2),
  (9650, 9659, 'MedMera Bank', 1, 2),
  (9660, 9669, 'Svea Bank', 1, 2),
  (9670, 9679, 'JAK Medlemsbank', 1, 2),
  (9680, 9689, 'Enity Bank Group', 1, 1),
  (9700, 9709, 'Ekobanken', 1, 2),
  (9710, 9719, 'Lunar Bank', 1, 2),
  (9750, 9759, 'Northmill Bank', 1, 2),
  (9780, 9789, 'Klarna Bank', 1, 2),
  (9960, 9969, 'Nordea (Plusgirot)', 2, 3);

-- ---------- kontrollsiffrorna (Bankgirot avsnitt 1.1 och 1.2) ----------

-- 10-modul: vikterna 1, 2, 1, 2 … bakifrån, tvåsiffriga produkter
-- minus 9, summan delbar med 10.
create or replace function intern.mod10_ok(p text)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select p ~ '^[0-9]+$' and (
    select sum(case when d * w > 9 then d * w - 9 else d * w end) % 10 = 0
      from (select substr(reverse(p), i, 1)::int as d, case when i % 2 = 1 then 1 else 2 end as w
              from generate_series(1, length(p)) as i) x)
$$;

-- 11-modul: vikterna 1, 2 … 10 bakifrån och om från 1 vid den elfte
-- siffran, summan delbar med 11.
create or replace function intern.mod11_ok(p text)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select p ~ '^[0-9]+$' and (
    select sum(substr(reverse(p), i, 1)::int * (((i - 1) % 10) + 1)) % 11 = 0
      from generate_series(1, length(p)) as i)
$$;

revoke execute on function intern.mod10_ok(text) from public, anon, authenticated;
revoke execute on function intern.mod11_ok(text) from public, anon, authenticated;

-- ---------- prövningen ----------

create or replace function intern.prova_bankkonto(p_clearing text, p_konto text,
  out clearing text, out konto text, out bank text,
  out giltigt boolean, out kontrollerad boolean, out fel text)
language plpgsql stable security definer set search_path = intern, pg_catalog as $$
declare
  c     text := regexp_replace(coalesce(p_clearing, ''), '[^0-9]', '', 'g');
  k     text := regexp_replace(coalesce(p_konto, ''), '[^0-9]', '', 'g');
  serie record;
  langd int;
begin
  giltigt := false;
  kontrollerad := false;

  if c = '' then fel := 'Fyll i clearingnumret.'; return; end if;
  if k = '' then fel := 'Fyll i kontonumret.'; return; end if;

  -- Swedbanks femsiffriga clearingnummer (8xxx-x). Femte siffran hör
  -- till clearingnumret och kontrolleras inte; serien avgörs av de
  -- fyra första.
  if length(c) = 5 and left(c, 1) = '8' then
    null;
  elsif length(c) <> 4 then
    fel := 'Clearingnumret ska vara fyra siffror (fem för vissa Swedbankkonton som börjar på 8).';
    return;
  end if;

  select * into serie from intern.clearingnummer
   where left(c, 4)::int between fran and till limit 1;
  if not found then
    fel := 'Vi känner inte igen clearingnumret. Kontrollera det mot din bank, eller välj Swish.';
    return;
  end if;
  bank := serie.bank;
  clearing := c;

  -- Inledande nollor i kontonumret bär ingen information; ta bort dem
  -- och fyll sedan ut till bankens längd.
  k := ltrim(k, '0');
  langd := case when serie.typ = 1 then 7 when serie.variant = 2 then 9 else 10 end;
  if k = '' or length(k) > langd then
    fel := 'Kontonumret hos ' || serie.bank || ' ska ha högst ' || langd || ' siffror, utan clearingnumret.';
    return;
  end if;
  k := lpad(k, langd, '0');
  konto := k;

  if serie.typ = 1 and serie.variant = 1 then
    kontrollerad := true;
    giltigt := intern.mod11_ok(substr(c, 2, 3) || k);
  elsif serie.typ = 1 and serie.variant = 2 then
    kontrollerad := true;
    giltigt := intern.mod11_ok(left(c, 4) || k);
  elsif serie.typ = 2 and serie.variant = 1 then
    kontrollerad := true;
    giltigt := intern.mod10_ok(k);
  elsif serie.typ = 2 and serie.variant = 2 then
    kontrollerad := true;
    giltigt := intern.mod11_ok(k);
  elsif serie.typ = 2 and serie.variant = 3 then
    -- "Som regel" 10-modul. Stämmer den är numret kontrollerat; stämmer
    -- den inte kan det ändå vara ett av undantagen, som dokumentet
    -- inte räknar upp. Då sparas det okontrollerat.
    kontrollerad := intern.mod10_ok(k);
    giltigt := true;
  else
    -- Variant 4: 11-modul enligt Bankinfrastruktur, men vikterna står
    -- inte utskrivna. Sparas okontrollerat.
    kontrollerad := false;
    giltigt := true;
  end if;

  if not giltigt then
    fel := 'Kontonumret stämmer inte med clearingnumret. Kontrollera siffrorna.';
    konto := null;
  end if;
end $$;

revoke execute on function intern.prova_bankkonto(text, text) from public, anon, authenticated;

-- Ett Swishnummer för en privatperson är ett svenskt mobilnummer.
create or replace function intern.swishnummer(p text)
returns text language sql immutable set search_path = pg_catalog as $$
  select case
    when n ~ '^07[0-9]{8}$' then n
    when n ~ '^467[0-9]{8}$' then '0' || substr(n, 3)
    when n ~ '^00467[0-9]{8}$' then '0' || substr(n, 5)
    else null end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as n) x
$$;

revoke execute on function intern.swishnummer(text) from public, anon, authenticated;

-- ---------- lagringen ----------

create table if not exists public.utbetalningsmetod (
  tutor_id      uuid primary key references public.profiles(id) on delete cascade,
  metod         text not null check (metod in ('bank', 'swish')),
  uppgift       bytea not null,
  bank          text,
  slutar_pa     text not null check (slutar_pa ~ '^[0-9]{4}$'),
  kontrollerad  boolean not null default false,
  uppdaterad    timestamptz not null default now(),
  uppdaterad_av uuid references public.profiles(id) on delete set null
);

comment on table public.utbetalningsmetod is
  'Studiehjälparens bankkonto eller Swishnummer. Nås BARA genom spara_/las_/radera_utbetalningsmetod; '
  'inga policyer, med flit. uppgift är krypterad (pgcrypto, nyckeln utbetalning_konto i Vault). '
  'Insamlingen stoppas av flaggan utbetalningsmetod.';

alter table public.utbetalningsmetod enable row level security;
revoke all on public.utbetalningsmetod from anon, authenticated;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'utbetalning_konto') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'utbetalning_konto',
      'Nyckel för studiehjälparnas bankkonton och Swishnummer (public.utbetalningsmetod). Byts inte utan att raderna krypteras om.');
  end if;
end $$;

-- ---------- funktionerna ----------

create or replace function public.bankkonto_kontroll(p_clearing text, p_konto text)
returns table (bank text, giltigt boolean, kontrollerad boolean, fel text)
language sql stable security definer set search_path = public as $$
  select p.bank, p.giltigt, p.kontrollerad, p.fel from intern.prova_bankkonto(p_clearing, p_konto) p
$$;

create or replace function public.spara_utbetalningsmetod(
  p_metod text, p_clearing text default null, p_konto text default null,
  p_swish text default null, p_tutor uuid default null)
returns table (metod text, bank text, slutar_pa text, kontrollerad boolean)
language plpgsql security definer set search_path = public as $$
declare
  vem    uuid := coalesce(p_tutor, auth.uid());
  nyckel text;
  prov   record;
  nummer text;
  klar   jsonb;
  vbank  text;
  vkoll  boolean;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Logga in för att lämna uppgifterna.';
  end if;
  if vem <> auth.uid() and not public.is_admin() then
    raise exception using errcode = '42501', message = 'Du kan bara lämna dina egna uppgifter.';
  end if;
  if not public.flagga_pa('utbetalningsmetod') then
    raise exception using errcode = '42501', message = 'Det går inte att lämna utbetalningsuppgifter än.';
  end if;
  if not exists (select 1 from public.tutor_profiles t where t.id = vem) then
    raise exception using errcode = '42501', message = 'Bara studiehjälpare kan lämna utbetalningsuppgifter.';
  end if;

  if p_metod = 'bank' then
    select * into prov from intern.prova_bankkonto(p_clearing, p_konto);
    if not prov.giltigt then
      raise exception using errcode = '22023', message = prov.fel;
    end if;
    klar := jsonb_build_object('clearing', prov.clearing, 'konto', prov.konto);
    nummer := prov.konto;
    vbank := prov.bank;
    vkoll := prov.kontrollerad;
  elsif p_metod = 'swish' then
    nummer := intern.swishnummer(p_swish);
    if nummer is null then
      raise exception using errcode = '22023',
        message = 'Swishnumret ska vara ett svenskt mobilnummer, till exempel 070 123 45 67.';
    end if;
    klar := jsonb_build_object('swish', nummer);
    vbank := 'Swish';
    vkoll := true;
  else
    raise exception using errcode = '22023', message = 'Välj bankkonto eller Swish.';
  end if;

  select decrypted_secret into nyckel from vault.decrypted_secrets where name = 'utbetalning_konto';
  if nyckel is null then
    raise exception using errcode = '55000', message = 'Krypteringsnyckeln saknas i Vault.';
  end if;

  insert into public.utbetalningsmetod as u
    (tutor_id, metod, uppgift, bank, slutar_pa, kontrollerad, uppdaterad, uppdaterad_av)
  values (vem, p_metod, extensions.pgp_sym_encrypt(klar::text, nyckel, 'cipher-algo=aes256'),
          vbank,
          right(nummer, 4),
          vkoll,
          now(), auth.uid())
  on conflict (tutor_id) do update
    set metod = excluded.metod, uppgift = excluded.uppgift, bank = excluded.bank,
        slutar_pa = excluded.slutar_pa, kontrollerad = excluded.kontrollerad,
        uppdaterad = excluded.uppdaterad, uppdaterad_av = excluded.uppdaterad_av;

  insert into public.audit_logg (aktor, aktor_typ, handling, tabell, objekt_id)
  values (auth.uid(), case when public.is_admin() then 'admin' else 'anvandare' end,
          'utbetalningsmetod.sparad', 'utbetalningsmetod', vem::text);

  return query select u.metod, u.bank, u.slutar_pa, u.kontrollerad
                 from public.utbetalningsmetod u where u.tutor_id = vem;
end $$;

create or replace function public.las_utbetalningsmetod(p_tutor uuid default null)
returns table (metod text, bank text, slutar_pa text, kontrollerad boolean, uppdaterad timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  vem uuid := coalesce(p_tutor, auth.uid());
begin
  if auth.uid() is null or (vem <> auth.uid() and not public.is_admin()) then
    raise exception using errcode = '42501', message = 'Du kan bara se dina egna uppgifter.';
  end if;
  return query select u.metod, u.bank, u.slutar_pa, u.kontrollerad, u.uppdaterad
                 from public.utbetalningsmetod u where u.tutor_id = vem;
end $$;

create or replace function public.radera_utbetalningsmetod(p_tutor uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  vem uuid := coalesce(p_tutor, auth.uid());
begin
  if auth.uid() is null or (vem <> auth.uid() and not public.is_admin()) then
    raise exception using errcode = '42501', message = 'Du kan bara ta bort dina egna uppgifter.';
  end if;
  delete from public.utbetalningsmetod where tutor_id = vem;
  if found then
    insert into public.audit_logg (aktor, aktor_typ, handling, tabell, objekt_id)
    values (auth.uid(), case when public.is_admin() then 'admin' else 'anvandare' end,
            'utbetalningsmetod.raderad', 'utbetalningsmetod', vem::text);
  end if;
end $$;

create or replace function public.las_utbetalningsmetod_klartext(p_tutor uuid)
returns table (metod text, bank text, clearing text, konto text, swish text, uppdaterad timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  nyckel text;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Bara Nextrum kan se hela uppgifterna.';
  end if;
  insert into public.audit_logg (aktor, aktor_typ, handling, tabell, objekt_id)
  values (auth.uid(), 'admin', 'utbetalningsmetod.lasta', 'utbetalningsmetod', p_tutor::text);
  select decrypted_secret into nyckel from vault.decrypted_secrets where name = 'utbetalning_konto';
  return query
    select u.metod, u.bank, d.j ->> 'clearing', d.j ->> 'konto', d.j ->> 'swish', u.uppdaterad
      from public.utbetalningsmetod u
      cross join lateral (select extensions.pgp_sym_decrypt(u.uppgift, nyckel)::jsonb as j) d
     where u.tutor_id = p_tutor;
end $$;

revoke execute on function public.bankkonto_kontroll(text, text) from public, anon;
revoke execute on function public.spara_utbetalningsmetod(text, text, text, text, uuid) from public, anon;
revoke execute on function public.las_utbetalningsmetod(uuid) from public, anon;
revoke execute on function public.radera_utbetalningsmetod(uuid) from public, anon;
revoke execute on function public.las_utbetalningsmetod_klartext(uuid) from public, anon;
grant execute on function public.bankkonto_kontroll(text, text) to authenticated;
grant execute on function public.spara_utbetalningsmetod(text, text, text, text, uuid) to authenticated;
grant execute on function public.las_utbetalningsmetod(uuid) to authenticated;
grant execute on function public.radera_utbetalningsmetod(uuid) to authenticated;
grant execute on function public.las_utbetalningsmetod_klartext(uuid) to authenticated;
