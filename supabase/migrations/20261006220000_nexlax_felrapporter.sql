-- ============================================================
-- NEXTRUM — fel i en fråga i NexLäx (2026-10-06)
--
-- Leo: "gör knapp rapportera fel, vi ska se det i admin då". Den som
-- spelar en nivå (familjen, barnet, studiehjälparen) säger efter svaret
-- att något är fel i frågan, med ett av fyra skäl. Admin ser
-- rapporterna per fråga under Material och markerar dem som hanterade
-- när frågan är rättad i banken (verktyg/uppgiftsbanken och en ny
-- migration: en fråga ändras aldrig i databasen för hand).
--
-- Rapporten bär ingen person: frågan, skälet, vilken sorts konto och
-- när. Ingen fritext, så ett barn kan inte skriva in något om sig själv,
-- och ingen kolumn pekar på ett konto. Därför ingen gallring och ingen
-- ändring i integritetspolicyn (DATASKYDD.md säger det).
--
-- Tabellen har RLS på och inga policyer: bara funktionerna når den.
-- Taket (20 öppna rapporter per fråga och 500 per dygn) gör att en knapp
-- som trycks i en loop inte fyller tabellen. Det som slår i taket tas
-- emot och läggs inte till: svaret är "tack" i båda fallen.
-- ============================================================

create table if not exists public.niva_felrapporter (
  id          uuid primary key default gen_random_uuid(),
  fraga_id    uuid not null references public.niva_fragor (id),
  sort        text not null constraint niva_felrapporter_sort_check
                check (sort in ('facit', 'otydlig', 'sprak', 'annat')),
  konto       text not null constraint niva_felrapporter_konto_check
                check (konto in ('familj', 'barn', 'studiehjalpare', 'admin')),
  skapad_at   timestamptz not null default now(),
  hanterad_at timestamptz
);
create index if not exists niva_felrapporter_oppna
  on public.niva_felrapporter (fraga_id) where hanterad_at is null;
alter table public.niva_felrapporter enable row level security;
revoke all on table public.niva_felrapporter from anon, authenticated;
comment on table public.niva_felrapporter is
  'Fel i en fråga i NexLäx, rapporterat i spelaren (rapportera_fragefel). Ingen person: frågan, '
  'skälet, sortens konto och tiden. Bara funktionerna når tabellen; admin läser genom '
  'nexlax_felrapporter() och stänger med nexlax_felrapport_hanterad().';

-- Rapportera. Familjen, barnet (nextrum_barn) och studiehjälparen.
create or replace function public.rapportera_fragefel(p_fraga uuid, p_sort text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_konto text;
begin
  if auth.uid() is null then
    raise exception 'Logga in för att rapportera' using errcode = '42501';
  end if;
  if p_sort is null or p_sort not in ('facit', 'otydlig', 'sprak', 'annat') then
    raise exception 'Okänt skäl' using errcode = '22023';
  end if;
  if not exists (select 1 from public.niva_fragor f join public.nivaer n on n.id = f.niva_id
                  where f.id = p_fraga and n.aktiv) then
    raise exception 'Frågan finns inte' using errcode = 'P0002';
  end if;

  -- mitt_barn() är en hel rad, och is not null på en rad kräver att
  -- varje kolumn har ett värde: pröva id:t.
  if (intern.mitt_barn()).id is not null then
    v_konto := 'barn';
  elsif public.is_admin() then
    v_konto := 'admin';
  elsif exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'tutor') then
    v_konto := 'studiehjalpare';
  else
    v_konto := 'familj';
  end if;

  if (select count(*) from public.niva_felrapporter r where r.fraga_id = p_fraga and r.hanterad_at is null) >= 20
     or (select count(*) from public.niva_felrapporter r where r.skapad_at > now() - interval '1 day') >= 500 then
    return true;
  end if;

  insert into public.niva_felrapporter (fraga_id, sort, konto) values (p_fraga, p_sort, v_konto);
  return true;
end $$;
revoke execute on function public.rapportera_fragefel(uuid, text) from public, anon;
grant execute on function public.rapportera_fragefel(uuid, text) to authenticated, nextrum_barn;

-- Admin: de öppna rapporterna, en rad per fråga, med frågan och facit.
create or replace function public.nexlax_felrapporter()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Bara för admin' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(x order by x ->> 'senast' desc)
      from (
        select jsonb_build_object(
          'fraga_id', f.id, 'fraga', f.fraga, 'typ', f.typ, 'alternativ', f.alternativ, 'ratt', f.ratt,
          'niva', n.titel, 'nyckel', n.nyckel, 'amne', n.amne, 'arskurs', n.arskurs, 'omrade', n.omrade,
          'antal', count(*),
          'facit', count(*) filter (where r.sort = 'facit'),
          'otydlig', count(*) filter (where r.sort = 'otydlig'),
          'sprak', count(*) filter (where r.sort = 'sprak'),
          'annat', count(*) filter (where r.sort = 'annat'),
          'forst', min(r.skapad_at), 'senast', max(r.skapad_at)) x
          from public.niva_felrapporter r
          join public.niva_fragor f on f.id = r.fraga_id
          join public.nivaer n on n.id = f.niva_id
         where r.hanterad_at is null
         group by f.id, n.id
      ) s), '[]'::jsonb);
end $$;
revoke execute on function public.nexlax_felrapporter() from public, anon;
grant execute on function public.nexlax_felrapporter() to authenticated;

-- Admin: frågan är rättad i banken (eller felet var inget fel).
create or replace function public.nexlax_felrapport_hanterad(p_fraga uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v integer;
begin
  if not public.is_admin() then
    raise exception 'Bara för admin' using errcode = '42501';
  end if;
  update public.niva_felrapporter set hanterad_at = now()
   where fraga_id = p_fraga and hanterad_at is null;
  get diagnostics v = row_count;
  return v;
end $$;
revoke execute on function public.nexlax_felrapport_hanterad(uuid) from public, anon;
grant execute on function public.nexlax_felrapport_hanterad(uuid) to authenticated;
