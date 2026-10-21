-- ============================================================
-- Insatta timmar: antalet, månaden, orsaken och en egen rad som
-- står fast (2026-10-21)
--
-- Beställningen (Leo, 2026-10-21): "Verifiera att admin kan lägga in
-- timmar manuellt med loggrad. Om det saknas, bygg det: timmar, månad,
-- obligatorisk orsak, egen oföränderlig loggrad."
--
-- Det fanns: ge_gratistimmar(familj, timmar) (2026-10-13), som sätter in
-- 1–40 gratistimmar i familjens timbank, och auditen, som säger att ett
-- kort skapades och av vem. Det saknades: varför, och vilken månad
-- timmarna avser. Nu:
--
--   1. timmar_insatta: en rad per insättning, med timmarna, månaden,
--      orsaken, kortet, vem och när. Bara ge_gratistimmar skriver den, och
--      ingen ändrar eller tar bort en rad (triggrar), inte heller admin
--      eller databasens ägare. Bara en främmande nyckel som blir null när
--      kontot eller kortet tas bort, och orsaken som töms när familjen
--      avidentifieras, går förbi: båda körs av databasen i en trigger.
--      En superadmin läser, som köpen.
--   2. ge_gratistimmar(familj, timmar, orsak, månad): kräver en orsak
--      (3–500 tecken) och en månad från september 2026 till och med nästa
--      månad (svensk tid; utan månad den innevarande), sätter in timmarna
--      som förut och skriver raden i samma transaktion.
--   3. Den gamla ge_gratistimmar(familj, timmar) kör ingen inloggad
--      längre: en insättning utan orsak går inte. Den står kvar (inget
--      drop) och körs av den nya.
--
-- Gratistimmarnas regler är som förut: 60 dagar från i dag, före köpta
-- timmar, inga sparade minuter, aldrig utbetalda. Månaden säger vad
-- timmarna avser (till exempel ett pass som ställdes in i september),
-- inte när de går ut. Att ta tillbaka timmar (ta_tillbaka_gratistimmar)
-- är som förut: kortet märks återkallat, och auditen säger vem.
--
-- Inget drop och inget delete. Filen går att köra två gånger.
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 1. raden ----------
create table if not exists public.timmar_insatta (
  id            bigint generated always as identity primary key,
  familj        uuid references public.profiles(id) on delete set null,
  klippkort_id  uuid references public.klippkort(id) on delete set null,
  timmar        integer not null check (timmar between 1 and 40),
  avser_manad   date not null
                check (avser_manad = date_trunc('month', avser_manad)::date and avser_manad >= date '2026-09-01'),
  orsak         text not null check (char_length(btrim(orsak)) between 3 and 500),
  insatt_av     uuid references public.profiles(id) on delete set null,
  insatt_at     timestamptz not null default now()
);

create index if not exists timmar_insatta_familj on public.timmar_insatta (familj, insatt_at desc);
create index if not exists timmar_insatta_kort on public.timmar_insatta (klippkort_id) where klippkort_id is not null;

comment on table public.timmar_insatta is
  '2026-10-21 (timmar_med_orsak). En rad per gång admin sätter in gratistimmar: antalet, månaden timmarna avser, '
  'orsaken, kortet, vem och när. Skrivs bara av ge_gratistimmar och står fast; orsaken töms när familjen '
  'avidentifieras. Bara en superadmin läser.';
comment on column public.timmar_insatta.avser_manad is
  'Månaden timmarna avser (första dagen), från september 2026. Inte när de går ut: det är 60 dagar från insättningen.';
comment on column public.timmar_insatta.orsak is
  'Varför timmarna sattes in, 3–500 tecken, obligatorisk. Töms när familjen avidentifieras (profiles_timmar_insatta_gallras).';

-- Ingen ändrar eller tar bort en rad. Det som går förbi körs av databasen
-- i en trigger (pg_trigger_depth() > 1): en främmande nyckel som blir null
-- när kontot eller kortet tas bort, och gallringen nedan.
create or replace function intern.timmar_insatta_star_fast()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
-- timmar_med_orsak (2026-10-21).
begin
  if tg_level = 'ROW' and pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  raise exception using errcode = '42501',
    message = 'En insättning av timmar står fast: den ändras aldrig och tas aldrig bort.';
end $function$;

revoke all on function intern.timmar_insatta_star_fast() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.timmar_insatta'::regclass
                  and tgname = 'timmar_insatta_star_fast') then
    create trigger timmar_insatta_star_fast
      before update or delete on public.timmar_insatta
      for each row execute function intern.timmar_insatta_star_fast();
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.timmar_insatta'::regclass
                  and tgname = 'timmar_insatta_toms_aldrig') then
    create trigger timmar_insatta_toms_aldrig
      before truncate on public.timmar_insatta
      for each statement execute function intern.timmar_insatta_star_fast();
  end if;
end $$;

-- Avidentifieras familjen (radera_person) töms orsaken: den är fritext och
-- kan nämna familjen eller barnet. Antalet, månaden och kortet står kvar,
-- för kortet står kvar.
create or replace function intern.timmar_insatta_gallras()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
-- timmar_med_orsak (2026-10-21).
begin
  update public.timmar_insatta
     set orsak = 'Gallrad när kontot avidentifierades.'
   where familj = new.id and orsak <> 'Gallrad när kontot avidentifierades.';
  return null;
end $function$;

revoke all on function intern.timmar_insatta_gallras() from public, anon, authenticated;

create or replace trigger profiles_timmar_insatta_gallras
  after update of raderad_at on public.profiles
  for each row when (old.raderad_at is null and new.raderad_at is not null)
  execute function intern.timmar_insatta_gallras();

alter table public.timmar_insatta enable row level security;
revoke all on public.timmar_insatta from anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nextrum_barn') then
    execute 'revoke all on public.timmar_insatta from nextrum_barn';
  end if;
  if exists (select 1 from pg_roles where rolname = 'nextrum_ai') then
    execute 'revoke all on public.timmar_insatta from nextrum_ai';
  end if;
end $$;
grant select on public.timmar_insatta to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'timmar_insatta'
                  and policyname = 'admin läser insatta timmar') then
    create policy "admin läser insatta timmar" on public.timmar_insatta for select to authenticated
      using ((select public.is_admin()));
  end if;
end $$;


-- ---------- 2. insättningen med orsak och månad ----------
create or replace function public.ge_gratistimmar(p_familj uuid, p_timmar integer, p_orsak text,
                                                  p_manad date default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
-- timmar_med_orsak (2026-10-21). Samma insättning som förut, med en orsak
-- och en månad, och raden i timmar_insatta i samma transaktion.
declare
  orsak  text := btrim(coalesce(p_orsak, ''));
  idag   date := (now() at time zone 'Europe/Stockholm')::date;
  denna  date := date_trunc('month', (now() at time zone 'Europe/Stockholm'))::date;
  manad  date;
  svar   jsonb;
begin
  if not public.is_admin() then
    raise exception 'Bara admin sätter in gratistimmar.' using errcode = '42501';
  end if;
  if char_length(orsak) < 3 or char_length(orsak) > 500 then
    raise exception 'Skriv varför timmarna sätts in, 3–500 tecken.' using errcode = '22023';
  end if;
  manad := date_trunc('month', coalesce(p_manad, idag))::date;
  if manad < date '2026-09-01' or manad > (denna + interval '1 month')::date then
    raise exception 'Månaden timmarna avser är från september 2026 till och med nästa månad.' using errcode = '22023';
  end if;

  svar := public.ge_gratistimmar(p_familj, p_timmar);

  insert into public.timmar_insatta (familj, klippkort_id, timmar, avser_manad, orsak, insatt_av)
  values (p_familj, (svar ->> 'id')::uuid, p_timmar, manad, orsak, auth.uid());

  return svar || jsonb_build_object('avser_manad', manad);
end $function$;

revoke all on function public.ge_gratistimmar(uuid, integer, text, date) from public, anon;
grant execute on function public.ge_gratistimmar(uuid, integer, text, date) to authenticated;

comment on function public.ge_gratistimmar(uuid, integer, text, date) is
  '2026-10-21 (timmar_med_orsak). Admin sätter in 1–40 gratistimmar i familjens timbank, med en orsak (3–500 tecken) '
  'och månaden de avser (september 2026 till nästa månad, utan månad den innevarande). Skriver en rad i '
  'timmar_insatta. Timmarna gäller i 60 dagar, före köpta timmar, som förut.';

-- ---------- 3. ingen insättning utan orsak ----------
-- Den gamla körs bara av den nya (security definer, som ägaren).
revoke execute on function public.ge_gratistimmar(uuid, integer) from authenticated;
comment on function public.ge_gratistimmar(uuid, integer) is
  '2026-10-13. Insättningen själv, utan orsak. Sedan 2026-10-21 (timmar_med_orsak) körs den bara av '
  'ge_gratistimmar(familj, timmar, orsak, månad), som skriver raden i timmar_insatta.';
