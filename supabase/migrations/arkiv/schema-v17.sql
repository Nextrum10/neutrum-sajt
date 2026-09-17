-- ============================================================
-- NEXTRUM — schema v17
-- Den delade hemligheten mellan webhooken och lead-notis.
--
-- Låg förut som Edge Function-secret NOTIS_HEMLIGHET, satt till den
-- bokstavliga strängen "openssl rand -hex 32" — kommandot hade
-- klistrats in i stället för körts. Notiserna fungerade, eftersom
-- headern var satt till exakt samma sträng, men skyddet var noll.
--
-- I en tabell går den att rotera med en SQL-rad i stället för ett
-- dashboard-besök, och båda sidorna kan bytas i SAMMA transaktion.
-- Det spelar roll: byter man secreten och headern i två olika
-- fönster svarar funktionen 401 på varje anmälan som kommer in
-- emellan, och de mejlen kommer aldrig.
--
-- Additiv. Inga kolumner tas bort och inga vyer påverkas.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.notis_konfig (
  id          smallint primary key default 1,
  hemlighet   text not null,
  uppdaterad  timestamptz not null default now(),
  constraint notis_konfig_en_rad check (id = 1)
);

-- RLS på utan en enda policy: anon och authenticated får noll rader.
-- service_role går förbi RLS och är den enda som ser hemligheten.
-- Databaslintern flaggar det här som INFO ("RLS enabled, no policy").
-- Det är avsikten, precis som för fortnox_token.
alter table public.notis_konfig enable row level security;

revoke all on public.notis_konfig from anon, authenticated;

-- Skapas bara första gången. Körs filen om ligger hemligheten kvar
-- och webhooken fortsätter fungera.
insert into public.notis_konfig (id, hemlighet)
values (1, encode(gen_random_bytes(32), 'hex'))
on conflict (id) do nothing;


-- ------------------------------------------------------------
-- ROTERA HEMLIGHETEN
--
-- Kör hela blocket. Det byter tabellen och webhookens header i
-- samma transaktion, så de två kan aldrig glida isär. Värdet syns
-- aldrig på skärmen och behöver aldrig kopieras för hand.
--
-- En redan startad Edge Function-instans har den gamla hemligheten
-- cachad tills den återvinns. Fönstret är kort och en anmälan som
-- råkar hamna där ligger kvar i "leads" — men mejlet uteblir.
-- Rotera alltså hellre en söndagskväll än en måndagmorgon.
-- ------------------------------------------------------------
--
-- do $$
-- declare h text;
-- begin
--   update public.notis_konfig
--      set hemlighet = encode(gen_random_bytes(32), 'hex'),
--          uppdaterad = now()
--    where id = 1
--   returning hemlighet into strict h;
--
--   execute format(
--     'create or replace trigger "ny-intresseanmalan"
--        after insert on public.leads
--        for each row execute function supabase_functions.http_request(
--          %L, %L, %L, %L, %L)',
--     'https://ddkfiuvcppalutfulvbi.supabase.co/functions/v1/lead-notis',
--     'POST',
--     json_build_object('x-nextrum-notis', h)::text,
--     '{}',
--     '5000'
--   );
-- end $$;
