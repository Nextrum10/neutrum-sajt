-- ============================================================
-- Betalningar som döljs eller annulleras i liggaren, utan att röras
-- (2026-10-21)
--
-- Beställningen (Leo, 2026-10-21): ett skript som tar bort testkontots
-- testbetalningar, "bara testkonto + Stripe testläge; riktiga betalningar
-- raderas inte utan markeras annullerad/dold och rapporteras".
--
-- Liggaren (betalningar) raderas aldrig, och det som bokförts i den står
-- fast (betalningsliggaren, Leo samma dag: "raderas ALDRIG och ingår inte i
-- något städjobb"). Därför markeras en betalning i en egen tabell i stället:
--
--   betalningar_dolda: en rad per betalning, med skälet
--     'test'        en testbetalning (skarp = false) på testkontot: den
--                   döljs i Liggaren, som redan aldrig räknade den;
--     'annullerad'  en betalning som inte ska behandlas som en familjs köp
--                   (en riktig betalning på testkontot): den står kvar i
--                   Liggaren och i summorna, för pengarna rörde sig, med
--                   märket Annullerad, tills den betalats tillbaka i Stripe.
--   Bara databasens ägare skriver (supabase/scripts/rensa-leo-testbetalning.sql
--   i SQL Editor); ingen inloggad skriver, och ingen ändrar eller tar bort en
--   rad. En superadmin läser.
--
-- Liggarens rad, kodens användning och betalningens rader rörs inte.
-- Inget drop och inget delete. Filen går att köra två gånger.
-- ============================================================

set local lock_timeout = '5s';

create table if not exists public.betalningar_dolda (
  betalning_id  uuid primary key references public.betalningar(id) on delete restrict,
  skal          text not null check (skal in ('test', 'annullerad')),
  kommentar     text check (kommentar is null or char_length(kommentar) <= 500),
  markerad_at   timestamptz not null default now()
);

comment on table public.betalningar_dolda is
  '2026-10-21 (betalningar_dolda). En betalning i liggaren som döljs (test) eller märks annullerad, utan att liggarens '
  'rad rörs. Skrivs bara av databasens ägare (rensa-leo-testbetalning.sql), står fast, och läses av en superadmin. '
  'En annullerad betalning står kvar i summorna: pengarna rörde sig.';

create or replace function intern.betalningar_dolda_star_fast()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
-- betalningar_dolda (2026-10-21).
begin
  raise exception using errcode = '42501',
    message = 'En markering i liggaren står fast: den ändras aldrig och tas aldrig bort.';
end $function$;

revoke all on function intern.betalningar_dolda_star_fast() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.betalningar_dolda'::regclass
                  and tgname = 'betalningar_dolda_star_fast') then
    create trigger betalningar_dolda_star_fast
      before update or delete on public.betalningar_dolda
      for each row execute function intern.betalningar_dolda_star_fast();
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.betalningar_dolda'::regclass
                  and tgname = 'betalningar_dolda_toms_aldrig') then
    create trigger betalningar_dolda_toms_aldrig
      before truncate on public.betalningar_dolda
      for each statement execute function intern.betalningar_dolda_star_fast();
  end if;
end $$;

-- En testmarkering bara på en testbetalning: en betalning med riktiga
-- pengar döljs aldrig.
create or replace function intern.betalningar_dolda_test_ar_test()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
-- betalningar_dolda (2026-10-21).
begin
  if new.skal = 'test' and not exists (select 1 from public.betalningar b
                                        where b.id = new.betalning_id and b.skarp is false) then
    raise exception using errcode = '23514',
      message = 'Bara en testbetalning (skarp = false) döljs. En riktig betalning märks annullerad och står kvar.';
  end if;
  return new;
end $function$;

revoke all on function intern.betalningar_dolda_test_ar_test() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.betalningar_dolda'::regclass
                  and tgname = 'betalningar_dolda_test_ar_test') then
    create trigger betalningar_dolda_test_ar_test
      before insert on public.betalningar_dolda
      for each row execute function intern.betalningar_dolda_test_ar_test();
  end if;
end $$;

alter table public.betalningar_dolda enable row level security;
revoke all on public.betalningar_dolda from anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'nextrum_barn') then
    execute 'revoke all on public.betalningar_dolda from nextrum_barn';
  end if;
  if exists (select 1 from pg_roles where rolname = 'nextrum_ai') then
    execute 'revoke all on public.betalningar_dolda from nextrum_ai';
  end if;
  -- Inte heller tjänstekontot: bara databasens ägare märker (SQL Editor).
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke insert, update, delete, truncate on public.betalningar_dolda from service_role';
  end if;
end $$;
grant select on public.betalningar_dolda to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'betalningar_dolda'
                  and policyname = 'admin läser liggarens markeringar') then
    create policy "admin läser liggarens markeringar" on public.betalningar_dolda for select to authenticated
      using ((select public.is_admin()));
  end if;
end $$;
