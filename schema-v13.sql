-- ============================================================
-- NEXTRUM — schema v13
--
-- Körs efter schema-v12.sql. INTE applicerad än — kör i
-- Supabase → SQL Editor.
--
-- Adminsidan (admin.html) behöver kunna ÄNDRA, inte bara läsa.
--
-- Reglerna som finns idag är byggda för de två inloggade vyerna:
-- familjen och studiehjälparen ser sitt, admin får läsa allt. Det
-- räckte så länge ni satt i Table Editor. Ska ledningen jobba i en
-- egen vy måste några av läsrättigheterna bli skrivrättigheter —
-- och exakt de, inte fler.
--
-- Ingenting här ger någon ny person åtkomst. Allt hänger på
-- public.is_admin(), som redan finns sedan schema.sql och läser
-- profiles.is_admin. Den flaggan sätts fortfarande bara i Table
-- Editor (triggern i schema-v3.sql vägrar ändra den från
-- webbläsaren, även för en admin). Det är med flit: den som kan
-- göra sig själv till admin i sin egen vy är inte begränsad av
-- något.
-- ============================================================


-- ============================================================
-- 1. Intresseanmälningar: admin får ändra status
--
-- leads.status finns redan (new / contacted / matched / declined)
-- men ingen har någonsin fått skriva den — tabellen har bara en
-- INSERT-policy för anonyma och en SELECT-policy för admin. En
-- statuskolumn som ingen kan ändra är en kommentar, inte ett fält.
--
-- Ingen DELETE. En intresseanmälan är ett inkommet meddelande från
-- en familj; "declined" säger vad som hände, en borttagen rad säger
-- ingenting. Behöver ni radera på riktigt (GDPR-begäran) gör ni det
-- i Table Editor, där det är ett medvetet beslut.
-- ============================================================

drop policy if exists "admin uppdaterar intresseanmälningar" on public.leads;
create policy "admin uppdaterar intresseanmälningar" on public.leads
  for update using (public.is_admin()) with check (public.is_admin());


-- ============================================================
-- 2. Ansökningar: samma sak
--
-- applications.status (new / contacted / approved / rejected) styr
-- vilka som syns i "att gå igenom" i admin. Att godkänna en
-- studiehjälpare är fortfarande två steg — status här OCH
-- tutor_profiles.status = 'approved' — eftersom ansökan och det
-- skapade kontot är två olika saker. Ansökan kan komma in innan
-- personen registrerat sig.
-- ============================================================

drop policy if exists "admin uppdaterar ansökningar" on public.applications;
create policy "admin uppdaterar ansökningar" on public.applications
  for update using (public.is_admin()) with check (public.is_admin());


-- ============================================================
-- 3. Kontaktmeddelanden: markera som hanterat
--
-- Inkorgen på faq.html hamnar i contact_messages. Utan ett sätt att
-- kryssa av ett meddelande måste den som svarar hålla i huvudet
-- vilka som är gjorda, och två personer svarar på samma.
--
-- Kolumnen är en tidsstämpel, inte en boolean: "hanterad" svarar
-- på om, "hanterad_at" svarar också på när, och det andra svaret
-- är gratis.
-- ============================================================

alter table public.contact_messages
  add column if not exists hanterad_at timestamptz,
  add column if not exists hanterad_av uuid references public.profiles(id);

comment on column public.contact_messages.hanterad_at is
  'Sätts när någon i ledningen markerat meddelandet som besvarat. Null = ligger kvar i inkorgen.';

drop policy if exists "admin markerar meddelanden hanterade" on public.contact_messages;
create policy "admin markerar meddelanden hanterade" on public.contact_messages
  for update using (public.is_admin()) with check (public.is_admin());


-- ============================================================
-- 4. Anteckningar på en familj eller studiehjälpare
--
-- "Ringde 3/9, mamman vill helst tisdagar." Sådant bor idag i
-- någons huvud eller i en mejltråd. Det hör hemma bredvid raden
-- det handlar om, så att nästa person i ledningen ser det.
--
-- Egen tabell och inte en kolumn på profiles: en kolumn hade
-- kunnat läsas av den matchade motparten, eftersom RLS är
-- radbaserad och inte kolumnbaserad. Samma fälla som student_notes
-- i schema-v5 och skolan i studiehjalpare_publika i v12. Här är
-- hela tabellen stängd för alla utom admin, och då finns ingen väg
-- runt.
-- ============================================================

create table if not exists public.admin_noteringar (
  id          uuid primary key default gen_random_uuid(),
  om_profil   uuid not null references public.profiles(id) on delete cascade,
  text        text not null check (char_length(btrim(text)) between 1 and 4000),
  skriven_av  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now()
);

create index if not exists admin_noteringar_om_idx
  on public.admin_noteringar (om_profil, created_at desc);

comment on table public.admin_noteringar is
  'Ledningens interna anteckningar om en familj eller studiehjälpare. Läses ALDRIG av den det gäller — hela tabellen är stängd utom för admin.';

alter table public.admin_noteringar enable row level security;

drop policy if exists "bara admin hanterar noteringar" on public.admin_noteringar;
create policy "bara admin hanterar noteringar" on public.admin_noteringar
  for all using (public.is_admin()) with check (public.is_admin());


-- ============================================================
-- 5. Integrationer: var kopplingen står, inte vad den heter
--
-- Google Workspace och Fortnox behöver båda en klienthemlighet och
-- ett refresh-token. Ingetdera får ligga här: tabellen läses från
-- webbläsaren, och en hemlighet i webbläsaren är ingen hemlighet.
--
-- Det som ligger här är STATUS. Vem kopplade, när, mot vilket
-- konto, när gick synken senast och vad sa den. Själva nycklarna
-- bor som secrets på edge-funktionen, dit ingen webbläsare når.
--
-- Alltså: den här tabellen kan inte koppla någonting. Den kan bara
-- berätta om något är kopplat. Det är hela poängen — ett fält som
-- säger "kopplad" ska aldrig kunna sättas av den som vill att det
-- ska se kopplat ut.
-- ============================================================

create table if not exists public.integrationer (
  tjanst        text primary key check (tjanst in ('google_workspace', 'fortnox')),
  kopplad       boolean not null default false,
  konto         text,
  kopplad_av    uuid references public.profiles(id),
  kopplad_at    timestamptz,
  senaste_synk  timestamptz,
  senaste_fel   text,
  uppdaterad    timestamptz not null default now()
);

comment on table public.integrationer is
  'Statusrad per extern tjänst. Innehåller AVSIKTLIGT inga nycklar, tokens eller hemligheter — de bor som secrets på edge-funktionen. Skrivs bara av service_role.';

alter table public.integrationer enable row level security;

-- Admin läser. Ingen INSERT- eller UPDATE-policy alls: raderna
-- skrivs av edge-funktionen med service_role, som går förbi RLS.
-- Kan ingen skriva från webbläsaren kan ingen ljuga om statusen.
drop policy if exists "admin läser integrationer" on public.integrationer;
create policy "admin läser integrationer" on public.integrationer
  for select using (public.is_admin());

insert into public.integrationer (tjanst) values ('google_workspace'), ('fortnox')
  on conflict (tjanst) do nothing;


-- ============================================================
-- 6. Fakturor och utbetalningar: admin ändrar status, inte belopp
--
-- Admin har redan "for all" på invoices och payouts sedan
-- schema-v8. Det räcker för adminsidan att markera en faktura som
-- betald.
--
-- MEN: beloppen sätts av edge-funktionen fakturering, och att
-- kunna skriva belopp_ore från en webbläsare är att kunna skriva
-- FEL belopp från en webbläsare. Den här triggern låser de fält
-- som är räknade, och lämnar de som är beslutade.
--
-- Det som får ändras: status, betald_at, skickad_at, forfaller.
-- Det som inte får: belopp_ore, period, parent_id, tutor_id.
-- ============================================================

create or replace function public.las_fakturabelopp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- serverjobb (auth.uid() är null) räknar om fritt
  if auth.uid() is null then
    return new;
  end if;
  new.belopp_ore := old.belopp_ore;
  new.period     := old.period;
  new.parent_id  := old.parent_id;
  return new;
end;
$$;

drop trigger if exists las_fakturabelopp on public.invoices;
create trigger las_fakturabelopp
  before update on public.invoices
  for each row execute function public.las_fakturabelopp();


create or replace function public.las_utbetalningsbelopp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  new.belopp_ore := old.belopp_ore;
  new.minuter    := old.minuter;
  new.period     := old.period;
  new.tutor_id   := old.tutor_id;
  return new;
end;
$$;

drop trigger if exists las_utbetalningsbelopp on public.payouts;
create trigger las_utbetalningsbelopp
  before update on public.payouts
  for each row execute function public.las_utbetalningsbelopp();


-- ============================================================
-- 7. En vy för adminöversikten
--
-- Adminsidan vill veta hur många nya intresseanmälningar, hur
-- många ansökningar som väntar, hur många fakturor som är
-- obetalda. Det är sex separata count-frågor från webbläsaren,
-- och de går inte att göra i en round trip via PostgREST.
--
-- security_invoker = true: vyn körs som DEN SOM FRÅGAR, alltså
-- passerar varje underliggande tabells RLS. En icke-admin som
-- hittar adressen får nollor tillbaka, inte data. Motsatsen till
-- studiehjalpare_publika i v11, och av rätt skäl: där var poängen
-- att publicera något, här att inte göra det.
-- ============================================================

create or replace view public.admin_lage
with (security_invoker = true) as
select
  (select count(*) from public.leads where status = 'new')                            as nya_leads,
  (select count(*) from public.applications where status = 'new')                     as nya_ansokningar,
  (select count(*) from public.tutor_profiles where status = 'pending')               as vantande_studiehjalpare,
  (select count(*) from public.profiles
     where role = 'parent' and match_status = 'pending')                              as omatchade_familjer,
  (select count(*) from public.contact_messages where hanterad_at is null)            as ohanterade_meddelanden,
  (select count(*) from public.bookings
     where status in ('requested', 'confirmed') and wanted_date >= current_date)      as kommande_pass,
  (select count(*) from public.bookings
     where status = 'requested')                                                      as obesvarade_pass,
  (select count(*) from public.invoices where status in ('skickad', 'forfallen'))     as obetalda_fakturor,
  (select coalesce(sum(belopp_ore), 0) from public.invoices
     where status in ('skickad', 'forfallen'))                                        as obetalt_ore,
  (select count(*) from public.payouts where status in ('utkast', 'godkand'))         as vantande_utbetalningar,
  (select coalesce(sum(belopp_ore), 0) from public.payouts
     where status in ('utkast', 'godkand'))                                           as att_betala_ut_ore;

comment on view public.admin_lage is
  'Nyckeltalen på adminöversikten, en fråga i stället för elva. security_invoker: den som inte får läsa tabellerna får nollor.';

revoke all on public.admin_lage from public;
grant select on public.admin_lage to authenticated;


-- ============================================================
-- 8. Att göra dig själv till admin
--
-- Registrera ett konto på sidan först. Sedan, i SQL Editor:
--
--   update public.profiles set is_admin = true where email = 'din@adress.se';
--
-- Det går INTE från admin.html, och ska inte göra det. Triggern i
-- schema-v3.sql vägrar ändra is_admin från en inloggad session,
-- oavsett vem som frågar.
-- ============================================================
