-- ============================================================
-- NEXTRUM — Fas 8.7: ett tak per dygn
--
-- Planen räknar upp kostnad som en risk i Fas 8, och stegtaket i
-- motorn skyddar bara EN körning. Ingenting hindrar att samma fråga
-- ställs hundra gånger, av misstag eller av en knapp som fastnat.
--
-- Taket ligger i databasen, inte i TypeScript, av samma skäl som
-- resten av Fas 8: det ska hålla oavsett vilken väg någon kommer in.
-- Trigger BEFORE INSERT på agent_korningar — och eftersom
-- startaKorning numera kastar i stället för att svälja felet blir
-- svaret "det här kördes inte", inte en körning som sker ologgad.
--
-- Talet är ett DYGNSTAK PÅ TOKENS, inte på antal körningar: en dyr
-- körning och tio billiga ska räknas olika. Det står i en tabell och
-- inte i koden, så att det går att ändra utan att driftsätta något —
-- samma mönster som notis_konfig.
--
-- 400 000 tokens är ungefär ett par hundra kronor per dygn med
-- dagens prislista, och långt mer än någon hinner fråga för hand.
-- Är det fel tal ska det ändras i tabellen, inte här.
-- ============================================================

create table if not exists public.ai_konfig (
  id              smallint primary key default 1 check (id = 1),
  dygnstak_tokens integer not null default 400000 check (dygnstak_tokens >= 0),
  uppdaterad      timestamptz not null default now()
);

insert into public.ai_konfig (id) values (1) on conflict (id) do nothing;

alter table public.ai_konfig enable row level security;
revoke all on public.ai_konfig from anon, authenticated;
grant select on public.ai_konfig to authenticated;

drop policy if exists "admin laser ai-konfig" on public.ai_konfig;
create policy "admin laser ai-konfig" on public.ai_konfig
  for select using (public.is_admin());

comment on table public.ai_konfig is
  'Ett tak för vad AI:n får kosta per dygn, i tokens. Ändras i tabellen, inte i koden — taket ska gå att sänka utan en driftsättning.';

create or replace function public.ai_taket_racker()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  tak    integer;
  brukat bigint;
begin
  select dygnstak_tokens into tak from public.ai_konfig where id = 1;
  if tak is null or tak = 0 then
    return new;                      -- inget tak inlagt: ingen spärr
  end if;

  -- Dygnet räknas i svensk tid, som allt annat i systemet.
  select coalesce(sum(coalesce(in_tokens, 0) + coalesce(ut_tokens, 0)), 0)
    into brukat
    from public.agent_korningar
   where skapad >= date_trunc('day', now() at time zone 'Europe/Stockholm')
                   at time zone 'Europe/Stockholm';

  if brukat >= tak then
    raise exception using errcode = '53400',
      message = format('Dygnstaket för AI är nått: %s av %s tokens i dag. '
                       || 'Höj taket i ai_konfig om körningen behövs.', brukat, tak);
  end if;

  return new;
end $$;

revoke execute on function public.ai_taket_racker() from public, anon, authenticated;

drop trigger if exists agent_korningar_tak on public.agent_korningar;
create trigger agent_korningar_tak
  before insert on public.agent_korningar
  for each row execute function public.ai_taket_racker();
