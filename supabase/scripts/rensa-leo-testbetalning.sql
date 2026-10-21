-- ============================================================
-- NEXTRUM — testkontots testbetalningar ur liggaren och vyerna
-- (2026-10-21)
--
-- Leo: "Skript supabase/scripts/rensa-leo-testbetalning.sql med
-- dry_run=true som standard, som visar raderna som tas bort (betalning,
-- rader, bokningar, kod_anvandningar, tillagg_poster), bara testkonto +
-- Stripe testläge; riktiga betalningar raderas inte utan markeras
-- annullerad/dold och rapporteras."
--
-- LIGGAREN RADERAS ALDRIG. Det sa Leo om betalningsliggaren samma dag
-- ("raderas ALDRIG och ingår inte i något städjobb"), och triggrarna nekar
-- delete och truncate för alla. Detsamma gäller kodernas användning
-- (kod_anvandningar), betalningens rader (betalningsrader) och
-- tilläggsposterna (tillagg_poster): de är bokföring, eller hör till den.
-- Så det här skriptet raderar inte dem. Det gör så här, för kontot och
-- bara för det:
--
--   test        en betalning i Stripes testläge (betalningar.skarp = false)
--               märks 'test' i betalningar_dolda och döljs i Liggaren, som
--               aldrig räknade den. Raden står kvar, med sina rader och sin
--               kodanvändning, och skriptet listar dem.
--   riktig      en betalning med riktiga pengar (skarp sann, eller okänd)
--               märks 'annullerad' och RAPPORTERAS: den står kvar i Liggaren
--               och i summorna, för pengarna rörde sig. Var den ett prov
--               betalas den tillbaka i Stripe, som vilken betalning som helst.
--   pass        ett pass i testläge (stripe_skarp = false) som en
--               testbetalning gällde raderas, om det inte har en rapport, ett
--               löneunderlag, ett uttag ur timbanken eller en tilläggspost och
--               ingen riktig betalning gäller det. Annars står det som "pass
--               kvar": rensa-testkonto.sql tar passen med rapporter och
--               underlag i rätt ordning.
--   köp         ett köp i testläge (klippkort.stripe_skarp = false) som en
--               testbetalning gällde raderas, om inget pass drar timmar ur
--               det och inga timmar köpts till det. Annars "köp kvar".
--
-- Liggarens rad pekar då på ett pass eller köp som inte finns (on delete
-- set null), som efter rensa-testkonto.sql 2026-10-20.
--
-- SÅ HÄR, I SQL EDITOR (som postgres, utan inloggning):
--   1. Kör filen som den står. dry_run är sant: inget ändras, och svaret
--      är en rad per sak, och raden `hinder` om något stoppar.
--   2. Läs listan. Ändra sedan sista raden till dry_run => false och kör
--      igen. Allt sker i en transaktion: stoppar något rullas allt tillbaka.
--   Kräver migrationen betalningar_dolda (20261021213000).
--
-- HINDER (inget ändras):
--   - inget konto, eller fler än ett, med namnet, eller ett som inte är en familj
--   - migrationen betalningar_dolda är inte körd
--
-- Namnet är familjens: i driften heter familjen med testpassen "leo thriskos"
-- (Leos adminkonto), och Leo Trikke är studiehjälparen (rensa-testkonto.sql).
-- ============================================================

create or replace function pg_temp.rensa_leo_testbetalning(p_namn text, dry_run boolean default true)
returns table (sort text, id text, datum date, detalj text)
language plpgsql
as $$
declare
  konto      uuid;
  antal      integer;
  test       uuid[];
  riktiga    uuid[];
  pass       uuid[];
  pass_kvar  uuid[];
  kop        uuid[];
  kop_kvar   uuid[];
  har_rader  boolean := to_regclass('public.betalningsrader') is not null;
  har_poster boolean := to_regclass('public.tillagg_poster') is not null;
  har_dolda  boolean := to_regclass('public.betalningar_dolda') is not null;
  hinder     text[] := '{}';
begin
  -- ---------- kontot ----------
  select count(*) into antal from public.profiles p
   where lower(btrim(p.full_name)) = lower(btrim(p_namn));
  if antal <> 1 then
    raise exception 'rensa_leo_testbetalning: % konton heter "%". Det ska vara exakt ett; inget har ändrats.', antal, p_namn;
  end if;
  select p.id into konto from public.profiles p where lower(btrim(p.full_name)) = lower(btrim(p_namn));
  if (select p.role from public.profiles p where p.id = konto) is distinct from 'parent' then
    raise exception 'rensa_leo_testbetalning: "%" är inte en familj. Skriv familjens namn; inget har ändrats.', p_namn;
  end if;
  if not har_dolda then
    hinder := hinder || 'migrationen betalningar_dolda är inte körd: utan den går en betalning inte att märka'::text;
  end if;

  -- ---------- betalningarna ----------
  test    := array(select b.id from public.betalningar b where b.familj = konto and b.skarp is false);
  riktiga := array(select b.id from public.betalningar b where b.familj = konto and b.skarp is not false);

  -- Passen och köpen testbetalningarna gällde, i testläge, och som ingen
  -- riktig betalning gäller.
  pass := array(
    select distinct x.id from public.bookings x
      join public.betalningar b on b.booking_id = x.id and b.id = any (test)
     where x.parent_id = konto and x.stripe_skarp is false
       and not exists (select 1 from public.betalningar r where r.booking_id = x.id and r.id = any (riktiga)));
  pass_kvar := array(
    select x from unnest(pass) x
     where exists (select 1 from public.lesson_reports r where r.booking_id = x)
        or exists (select 1 from public.payout_lines l where l.booking_id = x)
        or exists (select 1 from public.timbank_uttag u where u.booking_id = x));
  if har_poster then
    execute 'select array(select x from unnest($1::uuid[]) x where x = any ($2) or exists
                          (select 1 from public.tillagg_poster t where t.booking_id = x))'
      into pass_kvar using pass, pass_kvar;
  end if;
  pass := array(select x from unnest(pass) x where not (x = any (pass_kvar)));

  kop := array(
    select distinct k.id from public.klippkort k
      join public.betalningar b on b.klippkort_id = k.id and b.id = any (test)
     where k.parent_id = konto and k.stripe_skarp is false
       and not exists (select 1 from public.betalningar r where r.klippkort_id = k.id and r.id = any (riktiga)));
  kop_kvar := array(
    select x from unnest(kop) x
     where exists (select 1 from public.bookings y
                    where (y.klippkort_id = x or y.forsta_klippkort_id = x) and not (y.id = any (pass)))
        or exists (select 1 from public.klippkort c where c.till_plan = x and not (c.id = any (kop))));
  kop := array(select x from unnest(kop) x where not (x = any (kop_kvar)));

  -- ---------- listan ----------
  return query select 'konto'::text, konto::text, null::date,
    format('%s testbetalningar döljs, %s riktiga märks annullerade, %s pass och %s köp raderas, %s pass och %s köp står kvar',
           cardinality(test), cardinality(riktiga), cardinality(pass), cardinality(kop),
           cardinality(pass_kvar), cardinality(kop_kvar));

  return query
    select 'betalning test'::text, b.id::text, (b.betald_at at time zone 'Europe/Stockholm')::date,
           format('%s, %s öre, %s, %s%s — döljs i Liggaren, raden står kvar', b.typ, b.belopp_ore, b.status,
                  b.stripe_payment_intent,
                  case when exists (select 1 from public.betalningar_dolda d where d.betalning_id = b.id)
                       then ', redan märkt' else '' end)
      from public.betalningar b where b.id = any (test) order by b.betald_at;

  return query
    select 'betalning riktig'::text, b.id::text, (b.betald_at at time zone 'Europe/Stockholm')::date,
           format('%s, %s öre (%s tillbaka), %s, %s — RIKTIGA PENGAR: märks annullerad och döljs, står kvar i summorna; '
                  'betala tillbaka i Stripe om den var ett prov', b.typ, b.belopp_ore, b.aterbetalt_ore, b.status,
                  b.stripe_payment_intent)
      from public.betalningar b where b.id = any (riktiga) order by b.betald_at;

  if har_rader then
    return query execute
      'select ''rad''::text, r.id::text, null::date,
              format(''betalning %s, %s, %s öre — står kvar med betalningen'', r.betalning_id, r.typ, r.belopp_ore)
         from public.betalningsrader r where r.betalning_id = any ($1) order by r.betalning_id, r.typ'
      using test || riktiga;
  end if;

  return query
    select 'kodanvändning'::text, a.id::text, (a.anvand_at at time zone 'Europe/Stockholm')::date,
           format('%s på betalning %s, %s öre rabatt — står kvar; räknas bara med Räkna testbetalningar', a.kod,
                  a.betalning_id, a.rabatt_ore)
      from public.kod_anvandningar a where a.betalning_id = any (test || riktiga);

  if har_poster then
    return query execute
      'select ''tilläggspost''::text, t.id::text, null::date,
              format(''pass %s, %s, %s öre — står kvar (raderas aldrig)'', t.booking_id, t.status, t.belopp_ore)
         from public.tillagg_poster t where t.familj = $1 order by t.skapad_at'
      using konto;
  end if;

  return query
    select 'pass'::text, x.id::text, x.wanted_date,
           format('%s %s min, %s, betalning %s — raderas%s', x.wanted_time, x.duration_min, x.status, x.betalning_status,
                  case when intern.manad_stangd(x.wanted_date) then ', I STÄNGD MÅNAD' else '' end)
      from public.bookings x where x.id = any (pass) order by x.wanted_date;

  return query
    select 'pass kvar'::text, x.id::text, x.wanted_date,
           'har en rapport, ett underlag, ett uttag ur timbanken eller en tilläggspost: rensa-testkonto.sql tar det'::text
      from public.bookings x where x.id = any (pass_kvar) order by x.wanted_date;

  return query
    select 'köp'::text, k.id::text, (k.betald_at at time zone 'Europe/Stockholm')::date,
           format('%s, %s timmar, %s, betalt %s öre — raderas', k.erbjudande, k.timmar, k.status, coalesce(k.betalt_ore, 0))
      from public.klippkort k where k.id = any (kop) order by k.created_at;

  return query
    select 'köp kvar'::text, k.id::text, (k.betald_at at time zone 'Europe/Stockholm')::date,
           'ett pass drar timmar ur köpet, eller timmar är köpta till det: rensa-testkonto.sql tar det'::text
      from public.klippkort k where k.id = any (kop_kvar) order by k.created_at;

  if cardinality(hinder) > 0 then
    return query select 'hinder'::text, null::text, null::date, h from unnest(hinder) h;
    if not dry_run then
      raise exception 'rensa_leo_testbetalning: %. Inget har ändrats.', array_to_string(hinder, '; ');
    end if;
  end if;

  if dry_run then
    return query select 'dry_run'::text, null::text, null::date,
      'Inget är ändrat. Kör igen med dry_run => false för att märka betalningarna och radera passen och köpen ovan.'::text;
    return;
  end if;

  -- ---------- märkningen ----------
  execute 'insert into public.betalningar_dolda (betalning_id, skal, kommentar)
           select x, ''test'', ''Testbetalning på testkontot (rensa-leo-testbetalning.sql).''
             from unnest($1::uuid[]) x
           on conflict (betalning_id) do nothing'
    using test;
  execute 'insert into public.betalningar_dolda (betalning_id, skal, kommentar)
           select x, ''annullerad'', ''Riktig betalning på testkontot: står kvar i summorna. Betala tillbaka i Stripe om den var ett prov.''
             from unnest($1::uuid[]) x
           on conflict (betalning_id) do nothing'
    using riktiga;

  -- ---------- passen och köpen ----------
  -- Passen före köpen: bookings.klippkort_id är RESTRICT. Kortreservationerna,
  -- tilläggen för övertid, Meet-rummen, förberedelserna och notiserna följer
  -- med (CASCADE), och liggarens booking_id blir null.
  delete from public.bookings x where x.id = any (pass);
  delete from public.klippkort k where k.id = any (kop) and k.till_plan is not null;
  delete from public.klippkort k where k.id = any (kop);

  return query select 'klart'::text, konto::text, null::date,
    format('märkt: %s test, %s annullerade; raderat: %s pass, %s köp',
           cardinality(test), cardinality(riktiga), cardinality(pass), cardinality(kop));
end $$;

select * from pg_temp.rensa_leo_testbetalning('leo thriskos', dry_run => true);
