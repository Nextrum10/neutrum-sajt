-- ============================================================
-- Kortet reserveras vid bokningen (2026-10-13, Leo)
--
-- Leo: "när man klickar på boka pass eller godkänn förslaget från
-- barnet ska man kunna betala nu, eller på faktura. då reserveras pengar
-- från stripe och när passet har hållits och läxhjälparen har skrivit
-- rapport så dras pengarna om man betalar med kort". På två frågor samma
-- kväll: kortet sparas hos Stripe och beloppet reserveras två dagar före
-- passet, och valet är frivilligt: väljer familjen inget betalar de efter
-- passet, som förut. Designen står i minne/betalning.md (Kortet
-- reserveras vid bokningen); det här är databasens del.
--
-- Stripe släpper en reservation som inte dragits: för en reservation vi
-- gör utan familjen (merchant-initiated) efter 4 dygn och 18 timmar för
-- Visa och 7 dagar för de andra. Därför sparas kortet vid bokningen och
-- beloppet reserveras två dagar före passet. Gränsen läses ur Stripe
-- (capture_before) och skrivs i reserverat_till.
--
-- 1. STRÖMBRYTAREN kortreservation, AV. Av: inget kort går att välja och
--    ingen ny reservation görs; det som redan är reserverat dras eller
--    släpps ändå, för pengarna hålls på familjens kort.
-- 2. TRE TABELLER, och inga nya kolumner på bookings, så
--    skydda_bokningsfalt rörs inte:
--    · stripe_kunder: familjens kund hos Stripe. Bara tjänstekontot.
--    · sparade_kort: ett kort per familj. Familjen läser märke, sista
--      fyra siffror och giltighetstid genom mitt_kort().
--    · kortreservationer: en rad per pass där familjen valt kort.
-- 3. FAMILJEN väljer kort med valj_kort(pass, true) och bort med false.
--    Faktura väljs som förut, med skrivningen på passet.
-- 4. EDGE-FUNKTIONERNA skriver med tjänstekontot: kort_sparat(),
--    kort_borttaget() och kortreservation_skriv(). Webhooken sätter
--    betalningen på passet, som förut; ingen funktion här rör pengarna.
-- 5. JOBBET kortreservation (var tionde minut) väcker stripe-reservation
--    när kortreservation_att_gora() har något: reservera, dra, debitera
--    (dra utan reservation) eller släppa.
-- 6. NOTISEN kort_nekat när ett kort nekas (mallen i notis-ko, som
--    driftsätts före den här).
-- 7. RADERINGEN väntar på kortet: ett sparat kort och en reservation är
--    hinder, så att inget blir kvar hos Stripe.
--
-- Inget drop, inget delete utanför en funktion och ingen funktion med
-- två. Filen går att köra två gånger.
-- ============================================================

set local lock_timeout = '5s';


-- ---------- 1. strömbrytaren ----------
insert into public.flaggor (kod, aktiv, beskrivning, vantar_pa) values
  ('kortreservation', false,
   'Familjen kan välja kort när den föreslår ett pass: kortet sparas hos Stripe, beloppet reserveras två dagar före passet och dras när rapporten är skriven.',
   'Prov i Stripes testläge (DEPLOY-BETALNING.md), villkoren och policyn på båda språken. Stängs den av görs inga nya val och reservationer; det som redan är reserverat dras eller släpps ändå.')
on conflict (kod) do nothing;


-- ---------- 2. vart funktionen bor ----------
alter table public.notis_konfig add column if not exists kortreservation_url text;

comment on column public.notis_konfig.kortreservation_url is
  'Adressen till edge-funktionen stripe-reservation. intern.kortreservation_vack() väcker den med pg_net och '
  'hemligheten i x-nextrum-notis. Null betyder att inget reserveras, dras eller släpps av jobbet.';

-- Härledd ur arbetarens adress, som admin_paminnelse_url: samma projekt,
-- och ingen projektreferens hårdkodad här.
update public.notis_konfig
   set kortreservation_url = regexp_replace(arbetare_url, '/notis-ko/?$', '/stripe-reservation')
 where id = 1 and kortreservation_url is null and arbetare_url ~ '/notis-ko/?$';


-- ---------- 3. tabellerna ----------
create table if not exists public.stripe_kunder (
  parent_id   uuid primary key references public.profiles (id) on delete cascade,
  stripe_kund text not null unique check (stripe_kund ~ '^cus_[A-Za-z0-9]+$'),
  skapad      timestamptz not null default now()
);

comment on table public.stripe_kunder is
  'Familjens kund hos Stripe, en per familj (kortet_reserveras, 2026-10-13). Kunden skapas utan namn och e-post, '
  'med familjens id i metadata. Bara tjänstekontot (stripe-checkout) läser och skriver.';

alter table public.stripe_kunder enable row level security;
revoke all on public.stripe_kunder from anon, authenticated, nextrum_barn;


create table if not exists public.sparade_kort (
  parent_id    uuid primary key references public.profiles (id) on delete cascade,
  stripe_metod text not null unique check (stripe_metod ~ '^pm_[A-Za-z0-9]+$'),
  marke        text check (marke ~ '^[a-z_]{1,24}$'),
  sista4       text check (sista4 ~ '^[0-9]{4}$'),
  utgar_manad  smallint check (utgar_manad between 1 and 12),
  utgar_ar     smallint check (utgar_ar between 2000 and 2100),
  sparat       timestamptz not null default now()
);

comment on table public.sparade_kort is
  'Familjens sparade kort, ett per familj (kortet_reserveras, 2026-10-13). Kortet finns hos Stripe; här står '
  'Stripes id och det familjen ser: märke, sista fyra siffror och giltighetstid. Skrivs bara av webhooken och '
  'stripe-checkout (kort_sparat, kort_borttaget). Familjen läser genom mitt_kort().';

alter table public.sparade_kort enable row level security;
revoke all on public.sparade_kort from anon, nextrum_barn;
revoke insert, update, delete, truncate, references, trigger on public.sparade_kort from authenticated;
grant select on public.sparade_kort to authenticated;


create table if not exists public.kortreservationer (
  booking_id         uuid primary key references public.bookings (id) on delete cascade,
  parent_id          uuid not null references public.profiles (id) on delete cascade,
  lage               text not null default 'vald'
                     check (lage in ('vald', 'reserverad', 'dragen', 'slapps', 'slappt', 'utgangen', 'misslyckad')),
  stripe_reservation text unique check (stripe_reservation ~ '^pi_[A-Za-z0-9]+$'),
  reserverat_ore     bigint check (reserverat_ore > 0),
  reserverat_till    timestamptz,
  reserverat_for     timestamptz,
  dragen_ore         bigint check (dragen_ore > 0),
  fel                text check (fel ~ '^[a-z0-9_]{1,60}$'),
  forsok             smallint not null default 0 check (forsok between 0 and 50),
  vald               timestamptz not null default now(),
  andrad             timestamptz not null default now(),
  constraint kortreservationer_reserverad
    check (lage not in ('reserverad', 'slapps') or (stripe_reservation is not null and reserverat_ore is not null))
);

comment on table public.kortreservationer is
  'Pass där familjen valt kort (kortet_reserveras, 2026-10-13). vald: inget reserverat än. reserverad: beloppet '
  'hålls på kortet till reserverat_till. dragen: pengarna dragna, webhooken skriver betalningen på passet. slapps: '
  'ska släppas. slappt, utgangen (Stripe släppte den) och misslyckad (fel är Stripes kod) är slutlägen tills '
  'familjen väljer kort igen. Familjen skriver bara genom valj_kort(), edge-funktionerna genom kortreservation_skriv().';
comment on column public.kortreservationer.reserverat_till is
  'Stripes gräns för dragningen (capture_before på chargen). Efter den släpper Stripe reservationen.';
comment on column public.kortreservationer.reserverat_for is
  'Passets start när reservationen gjordes. Flyttas passet så att reservationen inte räcker till efter det, '
  'släpps den och görs om två dagar före den nya tiden; en reservation som bara är kort släpps inte för det.';
comment on column public.kortreservationer.forsok is
  'Nekade försök i rad. Ett nytt kort eller Försök igen nollställer.';

create index if not exists kortreservationer_parent_idx on public.kortreservationer (parent_id);
create index if not exists kortreservationer_att_gora_idx on public.kortreservationer (lage)
  where lage in ('vald', 'reserverad', 'slapps', 'utgangen');

alter table public.kortreservationer enable row level security;
revoke all on public.kortreservationer from anon, nextrum_barn;
revoke insert, update, delete, truncate, references, trigger on public.kortreservationer from authenticated;
grant select on public.kortreservationer to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'sparade_kort'
                    and policyname = 'admin läser sparade kort') then
    create policy "admin läser sparade kort" on public.sparade_kort
      for select to authenticated
      using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'kortreservationer'
                    and policyname = 'familjen och admin läser reservationerna') then
    create policy "familjen och admin läser reservationerna" on public.kortreservationer
      for select to authenticated
      using (parent_id = (select auth.uid()) or public.is_admin());
  end if;
end $$;

-- Auditloggen: att ett kort sparats eller tagits bort, och reservationens
-- väg. Inga siffror från kortet. logga_andring tar objektets id ur en
-- kolumn som heter id, och de här tabellerna har familjen och passet som
-- nyckel: samma loggning, med nyckeln som andra argument.
create or replace function intern.logga_andring_nyckel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  bas      text   := tg_argv[0];
  nyckel   text   := tg_argv[1];
  kolumner text[] := tg_argv[2:];
  fore     jsonb;
  efter    jsonb;
  uid      uuid   := auth.uid();
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select jsonb_object_agg(k, v) into fore
      from jsonb_each(to_jsonb(old)) as e(k, v) where k = any (kolumner);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    select jsonb_object_agg(k, v) into efter
      from jsonb_each(to_jsonb(new)) as e(k, v) where k = any (kolumner);
  end if;
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, fore -> k), jsonb_object_agg(k, efter -> k)
      into fore, efter
      from jsonb_object_keys(coalesce(efter, '{}'::jsonb)) as k
     where (fore -> k) is distinct from (efter -> k);
    if efter is null then
      return null;
    end if;
  end if;

  insert into public.audit_logg (aktor, aktor_typ, handling, tabell, objekt_id, fore, efter)
  values (uid,
          case when uid is null then 'system' when intern.har_adminroll(uid) then 'admin' else 'anvandare' end,
          bas || '.' || case tg_op when 'INSERT' then 'skapad' when 'DELETE' then 'borttagen' else 'andrad' end,
          tg_table_name,
          coalesce(to_jsonb(new) ->> nyckel, to_jsonb(old) ->> nyckel, '?'),
          fore, efter);
  return null;
end $$;

revoke all on function intern.logga_andring_nyckel() from public, anon, authenticated;

create or replace trigger sparade_kort_audit
  after insert or update or delete on public.sparade_kort
  for each row execute function intern.logga_andring_nyckel('betalkort', 'parent_id', 'marke', 'sparat');

create or replace trigger kortreservationer_audit
  after insert or update or delete on public.kortreservationer
  for each row execute function intern.logga_andring_nyckel(
    'kortreservation', 'booking_id', 'parent_id', 'lage', 'stripe_reservation', 'reserverat_ore',
    'reserverat_till', 'reserverat_for', 'dragen_ore', 'fel');


-- ---------- 4. hjälparna ----------
create or replace function intern.kortreservation_pa()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select f.aktiv from public.flaggor f where f.kod = 'kortreservation'), false)
$$;

revoke all on function intern.kortreservation_pa() from public, anon, authenticated;

-- Passets start i Stockholmstid, som intern.passet_har_borjat.
create or replace function intern.passets_start(b public.bookings)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (b.wanted_date + coalesce(b.wanted_time, '00:00')::time) at time zone 'Europe/Stockholm'
$$;

revoke all on function intern.passets_start(public.bookings) from public, anon, authenticated;

-- Kostar passet något? Samma räkning som ej_betalt i avvikelser_rader
-- (Fas 19.5): en rabatt som täcker hela priset, till exempel första
-- timmen bjuden, lämnar inget att betala.
create or replace function intern.passet_kostar(b public.bookings)
returns boolean
language sql
stable
set search_path = ''
as $$
  select b.timpris_ore is null
      or coalesce(b.rabatt_ore, 0) < round((b.timpris_ore
            + case when coalesce(b.antal_barn, 1) > 1 then coalesce(b.extra_ore, 0) else 0 end)
            * coalesce(b.duration_min, 60) / 60.0)
$$;

revoke all on function intern.passet_kostar(public.bookings) from public, anon, authenticated;

-- Ska passet betalas med kortet? Inte avbokat, inte betalt eller på väg
-- att betalas på annat sätt (timmar, kassan, faktura), och det kostar
-- något. 'vantar' är en öppen kassa: familjen betalar själv.
create or replace function intern.kortet_betalar(b public.bookings)
returns boolean
language sql
stable
set search_path = ''
as $$
  select b.status in ('requested', 'confirmed', 'completed')
     and b.betalning_status in ('ingen', 'misslyckad')
     and b.fakturerbar
     and b.klippkort_id is null
     and intern.passet_kostar(b)
$$;

revoke all on function intern.kortet_betalar(public.bookings) from public, anon, authenticated;


-- ---------- 5. familjen ----------
create or replace function public.mitt_kort()
returns table (marke text, sista4 text, utgar_manad smallint, utgar_ar smallint, sparat timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select k.marke, k.sista4, k.utgar_manad, k.utgar_ar, k.sparat
    from public.sparade_kort k
   where k.parent_id = (select auth.uid())
$$;

revoke all on function public.mitt_kort() from public, anon, nextrum_barn;
grant execute on function public.mitt_kort() to authenticated;

comment on function public.mitt_kort() is
  'Familjens sparade kort: märke, sista fyra siffror, giltighetstid (kortet_reserveras, 2026-10-13). Inga id från Stripe.';


/* Familjen väljer kort på ett pass, eller väljer bort det. Kort väljs före
   passet; efter passet betalar familjen som förut. En faktura som valts
   byts mot kortet i samma tryck, med samma skrivning som vyn gör, så att
   skydda_bokningsfalt prövar den. Svarar med läget efteråt, eller 'inget'. */
create or replace function public.valj_kort(p_bokning uuid, p_kort boolean)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  jag  uuid := auth.uid();
  b    public.bookings;
  r    public.kortreservationer;
  fanns boolean;
begin
  if jag is null then
    raise exception using errcode = '42501', message = 'Logga in först.';
  end if;

  select * into b from public.bookings where id = p_bokning for update;
  if not found or b.parent_id is distinct from jag then
    raise exception using errcode = '42501', message = 'Passet finns inte.';
  end if;

  select * into r from public.kortreservationer where booking_id = p_bokning for update;
  fanns := found;

  -- ---------- bort ----------
  if not coalesce(p_kort, false) then
    if not fanns then
      return 'inget';
    elsif r.lage = 'dragen' then
      raise exception using errcode = '42501', message = 'Passet är redan betalt med kortet.';
    elsif r.lage in ('reserverad', 'slapps') then
      -- Pengarna hålls på kortet: jobbet släpper dem inom några minuter.
      update public.kortreservationer set lage = 'slapps', andrad = now() where booking_id = p_bokning;
      return 'slapps';
    end if;
    perform intern.kortval_glom(p_bokning);
    return 'inget';
  end if;

  -- ---------- kort ----------
  if not intern.kortreservation_pa() then
    raise exception using errcode = '42501',
      message = 'Kort går inte att välja just nu. Betala efter passet, eller välj faktura.';
  end if;
  if b.status not in ('requested', 'confirmed') then
    raise exception using errcode = '42501',
      message = 'Kortet väljs innan passet hålls. Efter passet betalar ni som förut.';
  end if;
  if fanns and r.lage = 'dragen' then
    raise exception using errcode = '42501', message = 'Passet är redan betalt med kortet.';
  end if;

  if b.betalning_status = 'faktura' then
    update public.bookings set betalning_status = 'ingen' where id = p_bokning;
    select * into b from public.bookings where id = p_bokning;
  end if;
  if not intern.kortet_betalar(b) then
    raise exception using errcode = '42501',
      message = 'Passet betalas redan på annat sätt, eller kostar inget.';
  end if;

  if not fanns then
    insert into public.kortreservationer (booking_id, parent_id) values (p_bokning, jag);
    return 'vald';
  elsif r.lage = 'slapps' then
    -- Valt bort och tillbaka innan jobbet hunnit släppa: reservationen står kvar.
    update public.kortreservationer set lage = 'reserverad', andrad = now() where booking_id = p_bokning;
    return 'reserverad';
  elsif r.lage in ('slappt', 'utgangen', 'misslyckad') then
    -- Försök igen.
    update public.kortreservationer
       set lage = 'vald', stripe_reservation = null, reserverat_ore = null, reserverat_till = null,
           reserverat_for = null, fel = null, forsok = 0, andrad = now()
     where booking_id = p_bokning;
    return 'vald';
  end if;
  return r.lage;
end $$;

revoke all on function public.valj_kort(uuid, boolean) from public, anon, nextrum_barn;
grant execute on function public.valj_kort(uuid, boolean) to authenticated;

comment on function public.valj_kort(uuid, boolean) is
  'Familjen väljer kort på ett pass före passet, eller väljer bort det (kortet_reserveras, 2026-10-13). '
  'En reservation som står släpps av jobbet.';

-- Ett val utan reservation glöms. En egen funktion, så att ingen
-- funktion här har två delete (verktyget i driften frågar annars).
create or replace function intern.kortval_glom(p_bokning uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.kortreservationer
   where booking_id = p_bokning and lage in ('vald', 'slappt', 'utgangen', 'misslyckad')
$$;

revoke all on function intern.kortval_glom(uuid) from public, anon, authenticated;


-- ---------- 6. edge-funktionerna ----------
/* Webhooken har sparat ett kort (Checkout i läget setup). Ett nytt kort
   ersätter det gamla, och pass där kortet nekats får ett nytt försök.
   Svarar med det gamla kortets id, som anroparen kopplar bort hos Stripe. */
create or replace function public.kort_sparat(
  p_parent uuid, p_metod text, p_marke text, p_sista4 text, p_manad integer, p_ar integer)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  forra text;
begin
  select k.stripe_metod into forra from public.sparade_kort k where k.parent_id = p_parent for update;

  insert into public.sparade_kort (parent_id, stripe_metod, marke, sista4, utgar_manad, utgar_ar, sparat)
  values (p_parent, p_metod, lower(p_marke), p_sista4, p_manad, p_ar, now())
  on conflict (parent_id) do update
     set stripe_metod = excluded.stripe_metod, marke = excluded.marke, sista4 = excluded.sista4,
         utgar_manad = excluded.utgar_manad, utgar_ar = excluded.utgar_ar, sparat = excluded.sparat
   where public.sparade_kort.stripe_metod is distinct from excluded.stripe_metod;

  if forra is distinct from p_metod then
    update public.kortreservationer r
       set lage = 'vald', stripe_reservation = null, reserverat_ore = null, reserverat_till = null,
           reserverat_for = null, fel = null, forsok = 0, andrad = now()
      from public.bookings b
     where b.id = r.booking_id and r.parent_id = p_parent and r.lage = 'misslyckad'
       and intern.kortet_betalar(b);
  end if;

  return case when forra is distinct from p_metod then forra end;
end $$;

revoke all on function public.kort_sparat(uuid, text, text, text, integer, integer) from public, anon, authenticated, nextrum_barn;
grant execute on function public.kort_sparat(uuid, text, text, text, integer, integer) to service_role;


/* Familjen, eller admin, tar bort kortet. Utan kort finns inget att
   reservera: reservationerna släpps och valen glöms, och familjen betalar
   kommande pass efter passet. Svarar med kortets id, som anroparen
   kopplar bort hos Stripe. */
create or replace function public.kort_borttaget(p_parent uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  metod text;
  x     uuid;
begin
  delete from public.sparade_kort where parent_id = p_parent returning stripe_metod into metod;

  update public.kortreservationer set lage = 'slapps', andrad = now()
   where parent_id = p_parent and lage = 'reserverad';

  for x in
    select r.booking_id from public.kortreservationer r
     where r.parent_id = p_parent and r.lage in ('vald', 'misslyckad', 'utgangen')
  loop
    perform intern.kortval_glom(x);
  end loop;

  return metod;
end $$;

revoke all on function public.kort_borttaget(uuid) from public, anon, authenticated, nextrum_barn;
grant execute on function public.kort_borttaget(uuid) to service_role;


/* Vad jobbet ska göra nu. Edge-funktionen räknar beloppen ur passet
   (_delad/pris.ts) och skriver tillbaka med kortreservation_skriv().
     reservera  ett bekräftat pass som börjar inom 48 timmar, med kort valt
                och ett sparat kort (bara med strömbrytaren på)
     dra        passet är genomfört och reservationen gäller
     debitera   passet är genomfört utan en reservation som gäller: en
                betalning med det sparade kortet (bara med strömbrytaren på)
     slapp      reservationen ska bort: familjen valde bort kortet, passet
                betalas inte längre med kortet, eller passet flyttades så
                att reservationen inte räcker till efter passet */
create or replace function public.kortreservation_att_gora(p_grans integer default 50)
returns table (
  booking_id uuid, parent_id uuid, atgard text, lage text, stripe_reservation text,
  reserverat_ore bigint, stripe_kund text, stripe_metod text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with pa as (select intern.kortreservation_pa() as pa),
  rad as (
    select r.*, b as pass,
           k.stripe_metod as metod,
           s.stripe_kund as kund,
           -- Marginal: en dragning som börjar i sista stund hinner inte.
           r.reserverat_till is not null and r.reserverat_till > now() + interval '15 minutes' as galler
      from public.kortreservationer r
      join public.bookings b on b.id = r.booking_id
      left join public.sparade_kort k on k.parent_id = r.parent_id
      left join public.stripe_kunder s on s.parent_id = r.parent_id
     where r.lage in ('vald', 'reserverad', 'slapps', 'utgangen')
  ),
  val as (
    select x.booking_id, x.parent_id,
           case
             when x.lage = 'slapps' then 'slapp'
             when x.lage = 'reserverad' and not intern.kortet_betalar(x.pass) then 'slapp'
             when x.lage = 'reserverad' and (x.pass).status in ('requested', 'confirmed')
                  and x.reserverat_for is distinct from intern.passets_start(x.pass)
                  and x.reserverat_till < intern.passets_start(x.pass) + interval '1 day' then 'slapp'
             when x.lage = 'reserverad' and (x.pass).status = 'completed' and x.galler then 'dra'
             when x.lage in ('vald', 'utgangen', 'reserverad') and (x.pass).status = 'completed'
                  and intern.kortet_betalar(x.pass) and x.metod is not null and x.kund is not null
                  and (x.lage <> 'reserverad' or not x.galler)
                  and (select pa from pa) then 'debitera'
             when x.lage = 'vald' and (x.pass).status = 'confirmed' and intern.kortet_betalar(x.pass)
                  and intern.passets_start(x.pass) <= now() + interval '48 hours'
                  and x.metod is not null and x.kund is not null
                  and (select pa from pa) then 'reservera'
           end as atgard,
           x.lage, x.stripe_reservation, x.reserverat_ore, x.kund, x.metod, x.andrad
      from rad x
  )
  select v.booking_id, v.parent_id, v.atgard, v.lage, v.stripe_reservation, v.reserverat_ore, v.kund, v.metod
    from val v
   where v.atgard is not null
   order by case v.atgard when 'slapp' then 1 when 'dra' then 2 when 'debitera' then 3 else 4 end, v.andrad
   limit greatest(coalesce(p_grans, 50), 1)
$$;

revoke all on function public.kortreservation_att_gora(integer) from public, anon, authenticated, nextrum_barn;
grant execute on function public.kortreservation_att_gora(integer) to service_role;


/* Edge-funktionen och webhooken skriver vad Stripe svarade. Varje skrivning
   går att göra två gånger. Svarar med läget efteråt. 'saknas' (raden är
   borta: familjen valde bort kortet medan Stripe svarade) och 'avvisad'
   (raden har redan en annan reservation) betyder att anroparen släpper
   reservationen den just gjort. */
create or replace function public.kortreservation_skriv(
  p_bokning uuid, p_lage text, p_pi text default null, p_belopp bigint default null,
  p_till timestamptz default null, p_fel text default null)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.kortreservationer;
  b public.bookings;
begin
  if p_lage not in ('reserverad', 'dragen', 'slappt', 'utgangen', 'misslyckad') then
    raise exception 'kortreservation_skriv: okänt läge %', p_lage;
  end if;

  select * into r from public.kortreservationer where booking_id = p_bokning for update;
  if not found then
    return 'saknas';
  end if;
  select * into b from public.bookings where id = p_bokning;

  if p_lage = 'reserverad' then
    if p_pi is null or p_belopp is null then
      raise exception 'kortreservation_skriv: en reservation har ett PaymentIntent och ett belopp.';
    end if;
    -- Samma reservation en gång till (webhooken efter funktionen): inget nytt.
    if r.stripe_reservation = p_pi and r.lage in ('reserverad', 'slapps', 'dragen') then
      return r.lage;
    end if;
    -- Bara ett val utan reservation tar emot en. Annars är den nya
    -- reservationen över, och anroparen släpper den: raden pekar redan på
    -- en annan, som jobbet släpper eller drar.
    if r.lage not in ('vald', 'utgangen') then
      return 'avvisad';
    end if;
    update public.kortreservationer
       set lage = 'reserverad', stripe_reservation = p_pi, reserverat_ore = p_belopp, reserverat_till = p_till,
           reserverat_for = intern.passets_start(b), fel = null, forsok = 0, andrad = now()
     where booking_id = p_bokning;
    return 'reserverad';

  elsif p_lage = 'dragen' then
    if r.lage = 'dragen' then
      return r.lage;
    end if;
    update public.kortreservationer
       set lage = 'dragen', dragen_ore = nullif(p_belopp, 0),
           stripe_reservation = coalesce(p_pi, stripe_reservation),
           fel = null, andrad = now()
     where booking_id = p_bokning;
    return 'dragen';

  elsif p_lage = 'slappt' then
    if r.lage not in ('reserverad', 'slapps') then
      return r.lage;
    end if;
    -- Släppt för att passet flyttades, men passet ska fortfarande betalas
    -- med kortet: det reserveras igen två dagar före den nya tiden.
    if r.lage = 'reserverad' and b.status in ('requested', 'confirmed') and intern.kortet_betalar(b) then
      update public.kortreservationer
         set lage = 'vald', stripe_reservation = null, reserverat_ore = null, reserverat_till = null,
             reserverat_for = null, andrad = now()
       where booking_id = p_bokning;
      return 'vald';
    end if;
    update public.kortreservationer set lage = 'slappt', andrad = now() where booking_id = p_bokning;
    return 'slappt';

  elsif p_lage = 'utgangen' then
    if r.lage <> 'reserverad' or (p_pi is not null and r.stripe_reservation is distinct from p_pi) then
      return r.lage;
    end if;
    update public.kortreservationer set lage = 'utgangen', andrad = now() where booking_id = p_bokning;
    return 'utgangen';
  end if;

  -- misslyckad: en reservation eller en betalning utan reservation nekades.
  -- En reservation som står skrivs aldrig om till nekad: pengarna hålls
  -- fortfarande, och den dras eller släpps (en dragning som inte går blir
  -- utgangen).
  if r.lage not in ('vald', 'utgangen', 'misslyckad') then
    return r.lage;
  end if;
  update public.kortreservationer
     set lage = 'misslyckad', fel = coalesce(lower(nullif(btrim(p_fel), '')), 'nekat'),
         forsok = least(forsok + 1, 50), andrad = now()
   where booking_id = p_bokning;
  return 'misslyckad';
end $$;

revoke all on function public.kortreservation_skriv(uuid, text, text, bigint, timestamptz, text)
  from public, anon, authenticated, nextrum_barn;
grant execute on function public.kortreservation_skriv(uuid, text, text, bigint, timestamptz, text) to service_role;


-- ---------- 7. jobbet ----------
-- Ett val på ett pass som inte längre ska betalas med kortet glöms:
-- avbokat, betalt med timmar eller kassan, eller faktura vald. En egen
-- funktion med ett delete.
create or replace function intern.kortval_stada()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.kortreservationer r
   using public.bookings b
   where b.id = r.booking_id and r.lage = 'vald' and not intern.kortet_betalar(b)
$$;

revoke all on function intern.kortval_stada() from public, anon, authenticated;

create or replace function intern.kortreservation_vack()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  k public.notis_konfig%rowtype;
begin
  perform intern.kortval_stada();
  if not exists (select 1 from public.kortreservation_att_gora(1)) then
    return;
  end if;
  select * into k from public.notis_konfig where id = 1;
  -- Utan adress eller hemlighet görs ingenting, och raderna står kvar.
  if k.kortreservation_url is null or k.hemlighet is null then
    return;
  end if;
  perform intern.natanrop(
    mal := 'stripe-reservation',
    url := k.kortreservation_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-nextrum-notis', k.hemlighet),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
end $$;

revoke all on function intern.kortreservation_vack() from public, anon, authenticated;

select cron.schedule('kortreservation', '*/10 * * * *', $$select intern.kortreservation_vack()$$);


-- ---------- 8. notisen när kortet nekas ----------
-- Typen i båda listorna, och i _delad/notiser/typer.ts i samma ändring.
do $lapp$
declare
  namn   text;
  fore   text;
  gammal text := $g$'barnforslag']$g$;
  ny     text := $n$'barnforslag', 'kort_nekat']$n$;
  traffar integer;
begin
  foreach namn in array array['public.notis_typer()', 'public.notis_mejlbara()'] loop
    fore := pg_get_functiondef(namn::regprocedure);
    if position('kort_nekat' in fore) > 0 then
      continue;
    end if;
    traffar := (length(fore) - length(replace(fore, gammal, ''))) / length(gammal);
    if traffar <> 1 then
      raise exception '%: listan slutar inte på barnforslag (% träffar). Läs driften.', namn, traffar;
    end if;
    execute replace(fore, gammal, ny);
  end loop;
end $lapp$;

/* Ett kort som nekas: familjen får veta det, med passet, på samma sätt
   som notis_vid_pass bygger sin data. Inget belopp och ingen kod från
   Stripe, bara om banken vill att familjen bekräftar betalningen
   (kortet: 'bekrafta') eller om kortet nekades ('nekat'). Ett fel här
   får aldrig rulla tillbaka läget: det hamnar i notis_fel, som
   notis_vid_pass gör. */
create or replace function intern.kortreservation_notis()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  b     public.bookings;
  elev  text;
  hjalp text;
begin
  select * into b from public.bookings where id = new.booking_id;
  if not found then
    return null;
  end if;
  select intern.fornamn(x.name) into elev from public.students x where x.id = b.student_id;
  select intern.fornamn(x.full_name) into hjalp from public.profiles x where x.id = b.tutor_id;
  perform intern.notis_skapa(new.parent_id, 'kort_nekat', b.id, b.student_id, b.parent_id, b.tutor_id,
    jsonb_strip_nulls(jsonb_build_object(
      'datum', b.wanted_date, 'tid', b.wanted_time, 'langd_min', b.duration_min,
      'amne', intern.fornamn(b.subject), 'studiehjalpare', hjalp, 'elev', elev, 'status', b.status,
      'kortet', case when new.fel in ('authentication_required', 'card_authentication_required')
                     then 'bekrafta' else 'nekat' end)));
  return null;
exception when others then
  insert into public.notis_fel (kalla, fel)
  values ('kortreservation_notis ' || coalesce(new.booking_id::text, ''), left(sqlerrm, 500));
  return null;
end $$;

revoke all on function intern.kortreservation_notis() from public, anon, authenticated;

create or replace trigger kortreservationer_nekat
  after update of lage on public.kortreservationer
  for each row
  when (new.lage = 'misslyckad' and old.lage is distinct from 'misslyckad')
  execute function intern.kortreservation_notis();


-- ---------- 9. raderingen väntar på kortet ----------
do $lapp$
declare
  fore   text := pg_get_functiondef('intern.radering_underlag(text, uuid)'::regprocedure);
  ankare text := $a$    hinder := hinder || intern.radering_rad('kassa_oppen', n);
$a$;
  tillagg text := $n$
    -- kortet_reserveras: ett sparat kort och en reservation tas bort
    -- först, så att inget blir kvar hos Stripe.
    select count(*) into n from public.sparade_kort k where k.parent_id = p_id;
    hinder := hinder || intern.radering_rad('kort_sparat', n);
    select count(*), coalesce(sum(r.reserverat_ore), 0) into n, m from public.kortreservationer r
     where r.parent_id = p_id and r.lage in ('reserverad', 'slapps');
    hinder := hinder || intern.radering_rad('kort_reserverat', n, m);
$n$;
  traffar integer;
begin
  if position('kort_sparat' in fore) > 0 then
    raise notice 'radering_underlag väntar redan på kortet.';
    return;
  end if;
  traffar := (length(fore) - length(replace(fore, ankare, ''))) / length(ankare);
  if traffar <> 1 then
    raise exception 'radering_underlag: ankaret står % gånger, inte en. Läs driften.', traffar;
  end if;
  execute replace(fore, ankare, ankare || tillagg);
end $lapp$;
