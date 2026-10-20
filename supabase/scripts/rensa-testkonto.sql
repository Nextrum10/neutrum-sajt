-- ============================================================
-- NEXTRUM — testkontots pass, rapporter, timmar, löneunderlag och
-- fakturor bort (2026-10-21)
--
-- Leo: "Testkontot Leo Trikke: skriv ett skript som först visar exakt
-- vad som kommer raderas (lektioner, rapporter, timmar, lönestatistik,
-- fakturor) och sedan raderar det, styrt av en parameter dry_run som är
-- true som standard. Kontot självt raderas inte."
--
-- Kontot är det som också är admin och har alla passen från provandet
-- (DEPLOY-BARNKONTON.md 12, punkt 10): de räknas inte i statistiken, men
-- står kvar som pass, betalningar, underlag och fakturor. radera_person()
-- tar inte ett adminkonto, och bookings.parent_id är ON DELETE CASCADE,
-- så dashboarden är fel ställe. Det här är den egna ändringen.
--
-- SÅ HÄR, I SQL EDITOR (som postgres, utan inloggning):
--   1. Kör filen som den står. dry_run är sant: inget ändras, och svaret
--      är en rad per sak som skulle raderas, och raden `hinder` om något
--      stoppar.
--   2. Läs listan. Ändra sedan sista raden till dry_run => false och kör
--      igen. Allt sker i en transaktion: stoppar något rullas allt tillbaka.
--
-- VAD SOM RADERAS, för kontot och bara för det:
--   pass        bookings med kontot som familj, och det som hänger på dem
--               (kortreservationer, tillägg för övertid, timbankens uttag,
--               Meet-rum, förberedelser och notiser följer med av sig själva)
--   rapporter   lesson_reports för passen och för familjens barn
--               (bekräftelserna följer med)
--   timmar      klippkort (planer, Fyll timbanken, gratistimmar, timmar till
--               planen) och timbank_uttag
--   underlag    payout_lines för passen; ett underlag som blir tomt tas
--               bort, och ett som har andra pass kvar räknas om
--   fakturor    invoices och invoice_lines, och fakturaspärren, om
--               tabellerna finns (fakturan_tas_bort droppar dem)
--
-- VAD SOM INTE RÖRS: kontot, adminrollen, barnen, deras NexLäx och
-- barnkonton, villkorsgodkännandena, notisvalen, det sparade kortet och
-- kunden hos Stripe (tas bort under Profil → Kortet, så att inget blir
-- kvar hos Stripe), betygsgarantin och auditloggen, som får en rad per
-- borttagen rad av sina egna triggrar. Inte heller betalningsliggaren
-- (betalningar, 2026-10-21) och godkännandena i kassan
-- (kopvillkor_godkannanden): liggaren raderas aldrig, så testbetalningarna
-- står kvar där, märkta som test (skarp = false), och deras koppling till
-- passet eller köpet blir tom när raden här tas bort (on delete set null).
-- Detsamma gäller kodernas användning (kod_anvandningar, koder_for_planer
-- 2026-10-21), som pekar på betalningen, och familjens partner, som står
-- kvar med kontot.
--
-- HINDER (inget raderas):
--   - inget konto, eller fler än ett, med namnet
--   - en skarp betalning (stripe_skarp) på ett pass, ett tillägg eller ett
--     köp: riktiga pengar är bokföring och raderas aldrig härifrån
--   - ett underlag med ett av passen som redan är utbetalt
--
-- Stängda månader: låset (intern.las_stangd_manad) släpper igenom en
-- session utan inloggning, som den släpper igenom webhooken och
-- månadskörningen. Listan säger vilka stängda månader som ändras, så att
-- bokslutet går att se över efteråt.
-- ============================================================

create or replace function pg_temp.rensa_testkonto(p_namn text, dry_run boolean default true)
returns table (sort text, id text, datum date, detalj text)
language plpgsql
as $$
declare
  konto     uuid;
  antal     integer;
  pass      uuid[];
  barn      uuid[];
  rapporter uuid[];
  kop       uuid[];
  underlag  uuid[];
  fakturor  uuid[] := '{}';
  har_fakt  boolean := to_regclass('public.invoices') is not null;
  har_sparr boolean := to_regclass('public.faktura_sparr') is not null;
  hinder    text[] := '{}';
begin
  -- ---------- kontot ----------
  select count(*) into antal from public.profiles p
   where lower(btrim(p.full_name)) = lower(btrim(p_namn));
  if antal <> 1 then
    raise exception 'rensa_testkonto: % konton heter "%". Det ska vara exakt ett; inget har ändrats.', antal, p_namn;
  end if;
  select p.id into konto from public.profiles p where lower(btrim(p.full_name)) = lower(btrim(p_namn));

  pass      := array(select b.id from public.bookings b where b.parent_id = konto);
  barn      := array(select s.id from public.students s where s.parent_id = konto);
  rapporter := array(select r.id from public.lesson_reports r
                      where r.booking_id = any (pass) or r.student_id = any (barn));
  kop       := array(select k.id from public.klippkort k where k.parent_id = konto);
  underlag  := array(select distinct l.payout_id from public.payout_lines l where l.booking_id = any (pass));
  if har_fakt then
    execute 'select coalesce(array_agg(i.id), ''{}'') from public.invoices i where i.parent_id = $1'
      into fakturor using konto;
  end if;

  -- ---------- hinder ----------
  if exists (select 1 from public.bookings b where b.id = any (pass) and b.stripe_skarp)
     or exists (select 1 from public.pass_tillagg t where t.booking_id = any (pass) and t.stripe_skarp)
     or exists (select 1 from public.klippkort k where k.id = any (kop) and k.stripe_skarp) then
    hinder := hinder || 'en skarp kortbetalning: riktiga pengar raderas inte härifrån'::text;
  end if;
  if exists (select 1 from public.payouts u where u.id = any (underlag) and u.status = 'utbetald') then
    hinder := hinder || 'ett av passen står på ett underlag som redan är utbetalt'::text;
  end if;

  -- ---------- listan ----------
  return query select 'konto'::text, konto::text, null::date,
    format('%s pass, %s rapporter, %s köp av timmar, %s underlag, %s fakturor',
           cardinality(pass), cardinality(rapporter), cardinality(kop), cardinality(underlag), cardinality(fakturor));

  return query
    select 'pass'::text, b.id::text, b.wanted_date,
           format('%s %s min, %s, betalning %s%s%s', b.wanted_time, b.duration_min, b.status,
                  b.betalning_status,
                  case when b.betalt_ore is not null then ', ' || b.betalt_ore || ' öre' else '' end,
                  case when intern.manad_stangd(b.wanted_date) then ', I STÄNGD MÅNAD' else '' end)
      from public.bookings b where b.id = any (pass) order by b.wanted_date, b.wanted_time;

  return query
    select 'rapport'::text, r.id::text, r.lesson_date,
           format('pass %s, närvaro %s', coalesce(r.booking_id::text, 'utan pass'), coalesce(r.narvaro, '-'))
      from public.lesson_reports r where r.id = any (rapporter) order by r.lesson_date;

  return query
    select 'tillagg'::text, t.id::text, null::date, format('pass %s, %s min, %s', t.booking_id, t.minuter, t.status)
      from public.pass_tillagg t where t.booking_id = any (pass);

  return query
    select 'kop'::text, k.id::text, (k.betald_at at time zone 'Europe/Stockholm')::date,
           format('%s, %s timmar, %s, betalt %s öre, gäller till %s%s', k.erbjudande, k.timmar, k.status,
                  coalesce(k.betalt_ore, 0), coalesce(k.giltigt_till::text, '-'),
                  case when k.stripe_skarp is false then ', test' else '' end)
      from public.klippkort k where k.id = any (kop) order by k.created_at;

  return query
    select 'timbank'::text, u.id::text, (u.created_at at time zone 'Europe/Stockholm')::date,
           format('%s, %s min%s', u.sort, u.minuter, coalesce(', ' || u.varde_ore || ' öre', ''))
      from public.timbank_uttag u where u.parent_id = konto;

  return query
    select 'underlagsrad'::text, l.id::text, u.period,
           format('underlag %s (%s), pass %s, %s min, %s öre', u.id, u.status, l.booking_id, l.minuter, l.belopp_ore)
      from public.payout_lines l join public.payouts u on u.id = l.payout_id
     where l.booking_id = any (pass);

  return query
    select case when not exists (select 1 from public.payout_lines l
                                  where l.payout_id = u.id and not (l.booking_id = any (pass)))
                then 'underlag tas bort' else 'underlag räknas om' end,
           u.id::text, u.period, format('%s, %s öre nu', u.status, u.belopp_ore)
      from public.payouts u where u.id = any (underlag);

  if har_fakt then
    return query execute
      'select ''faktura''::text, i.id::text, i.period,
              format(''%s, %s öre, %s rader'', i.status, i.belopp_ore,
                     (select count(*) from public.invoice_lines l where l.invoice_id = i.id))
         from public.invoices i where i.id = any ($1) order by i.period'
      using fakturor;
  end if;

  return query
    select distinct 'stängd månad'::text, null::text, date_trunc('month', b.wanted_date)::date,
           'passen här ändrar en stängd månad; se över bokslutet efteråt'::text
      from public.bookings b where b.id = any (pass) and intern.manad_stangd(b.wanted_date);

  if cardinality(hinder) > 0 then
    return query select 'hinder'::text, null::text, null::date, h from unnest(hinder) h;
    if not dry_run then
      raise exception 'rensa_testkonto: %. Inget har ändrats.', array_to_string(hinder, '; ');
    end if;
  end if;

  if dry_run then
    return query select 'dry_run'::text, null::text, null::date,
      'Inget är ändrat. Kör igen med dry_run => false för att radera listan ovan.'::text;
    return;
  end if;

  -- ---------- raderingen, i den ordning nycklarna kräver ----------
  -- Fakturorna först: invoice_lines pekar på passen (SET NULL), och en
  -- faktura utan rader ska inte bli kvar.
  if har_fakt then
    execute 'delete from public.invoices where id = any ($1)' using fakturor;
  end if;
  if har_sparr then
    execute 'delete from public.faktura_sparr where parent_id = $1' using konto;
  end if;

  -- Underlaget: passens rader bort, tomma underlag bort, resten räknas om
  -- ur raderna som står kvar (las_utbetalningsbelopp släpper igenom en
  -- session utan inloggning).
  delete from public.payout_lines l where l.booking_id = any (pass);
  delete from public.payouts u
   where u.id = any (underlag)
     and not exists (select 1 from public.payout_lines l where l.payout_id = u.id);
  update public.payouts u
     set belopp_ore = s.belopp, minuter = s.minuter
    from (select l.payout_id, sum(l.belopp_ore) as belopp, sum(l.minuter)::integer as minuter
            from public.payout_lines l where l.payout_id = any (underlag) group by l.payout_id) s
   where u.id = s.payout_id;

  -- Rapporterna före passen: rapportens trigger för timbanken läser passet.
  delete from public.lesson_reports r where r.id = any (rapporter);

  -- Timbankens uttag: parent_id är RESTRICT, och ett uttag för ett pass
  -- skulle annars följa med passet först vid commit (deferrable).
  delete from public.timbank_uttag u where u.parent_id = konto;

  -- Passen. Kortreservationerna, tilläggen, Meet-rummen, förberedelserna och
  -- notiserna följer med (CASCADE).
  delete from public.bookings b where b.id = any (pass);

  -- Köpen sist: bookings.klippkort_id är RESTRICT, och timmar till en plan
  -- pekar på planen (till_plan, RESTRICT).
  delete from public.klippkort k where k.id = any (kop) and k.till_plan is not null;
  delete from public.klippkort k where k.id = any (kop);

  return query select 'klart'::text, konto::text, null::date,
    format('raderat: %s pass, %s rapporter, %s köp, %s fakturor; underlagen räknade om',
           cardinality(pass), cardinality(rapporter), cardinality(kop), cardinality(fakturor));
end $$;

select * from pg_temp.rensa_testkonto('Leo Trikke', dry_run => true);
