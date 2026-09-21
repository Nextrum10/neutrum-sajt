-- ============================================================
-- NEXTRUM — program 2, Fas 1.1: flaggor
--
-- Programmet säger: det som väntar på ett beslut om affär, juridik
-- eller pengar ska byggas bakom en flagga, inte gissas fram. Det
-- fanns ingen sådan. Det närmaste var integrationer, som med flit
-- saknar skrivpolicy, och nextrum-config.js, som bara går att ändra
-- med en ny driftsättning.
--
-- EN FLAGGA ÄR ETT BESLUT SOM INTE ÄR FATTAT. Därför bär varje rad
-- två texter: vad den slår på, och vad som måste vara avgjort innan
-- någon gör det (vantar_pa). Den som slår på en flagga ska se
-- varför den var av — inte bara att den var det.
--
-- AV ÄR FÖRVALET, och en flagga som inte finns räknas som av
-- (flagga_pa). En felstavad nyckel i koden öppnar alltså ingenting.
--
-- Bara admin slår om, och bara kolumnen aktiv: nyckel, texterna och
-- stämplarna ägs av migrationerna. Varje omslag hamnar i
-- auditloggen, eftersom "vem slog på insamlingen av kontonummer och
-- när" är precis den fråga som ställs i efterhand.
-- ============================================================

create table if not exists public.flaggor (
  kod           text primary key,
  aktiv         boolean not null default false,
  beskrivning   text not null,
  vantar_pa     text,
  uppdaterad    timestamptz not null default now(),
  uppdaterad_av uuid references public.profiles(id) on delete set null
);

alter table public.flaggor
  drop constraint if exists flaggor_kod_check;
alter table public.flaggor
  add constraint flaggor_kod_check check (kod ~ '^[a-z][a-z_]{1,39}$');

comment on table public.flaggor is
  'Funktioner som väntar på ett beslut. Av är förvalet; en flagga som saknas räknas som av. '
  'vantar_pa säger vad som måste vara avgjort innan den slås på. Bara admin slår om, och varje omslag loggas.';

alter table public.flaggor enable row level security;

-- Standardbehörigheterna i public ger anon och authenticated allt på
-- nya tabeller. Dra in dem först och ge sedan tillbaka exakt det
-- som behövs.
revoke all on public.flaggor from anon, authenticated;
grant select on public.flaggor to authenticated;
grant update (aktiv) on public.flaggor to authenticated;

drop policy if exists "inloggade läser flaggor" on public.flaggor;
create policy "inloggade läser flaggor" on public.flaggor
  for select to authenticated using (true);

drop policy if exists "admin slår om flaggor" on public.flaggor;
create policy "admin slår om flaggor" on public.flaggor
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.stampla_flaggan()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.kod           := old.kod;
  new.beskrivning   := old.beskrivning;
  new.vantar_pa     := old.vantar_pa;
  new.uppdaterad    := now();
  new.uppdaterad_av := auth.uid();
  return new;
end $$;

revoke execute on function public.stampla_flaggan() from public, anon, authenticated;

drop trigger if exists flaggor_stampla on public.flaggor;
create trigger flaggor_stampla before update on public.flaggor
  for each row execute function public.stampla_flaggan();

drop trigger if exists flaggor_audit on public.flaggor;
create trigger flaggor_audit after update of aktiv on public.flaggor
  for each row execute function public.logga_andring('flagga', 'kod', 'aktiv');

-- För databasens egna funktioner. SECURITY DEFINER så att den går att
-- anropa inifrån andra definer-funktioner oavsett vem som frågar;
-- ingen utanför databasen behöver den — klienten läser tabellen.
create or replace function public.flagga_pa(p_kod text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select f.aktiv from public.flaggor f where f.kod = p_kod), false)
$$;

revoke execute on function public.flagga_pa(text) from public, anon, authenticated;

insert into public.flaggor (kod, aktiv, beskrivning, vantar_pa) values
  ('utbetalningsmetod', false,
   'Studiehjälparen kan lämna bankkonto eller Swishnummer för utbetalning. Uppgifterna krypteras och syns bara för hen själv och för admin. Ingen utbetalning görs.',
   'Integritetspolicyn ska nämna bank- och Swishuppgifter: varför de sparas, laglig grund och hur länge. Revisorn ska ha svarat på om studiehjälparna är anställda eller uppdragstagare, också de som är under 18.')
on conflict (kod) do nothing;
