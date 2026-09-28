-- ============================================================
-- Fas 22.3: timmar som blir lediga betalar familjens nästa pass
--
-- Leo 2026-09-27, efter Fas 22.2: "se till att den funkar som den ska".
-- Fas 22.2 lät timmarna betala ett pass i två ögonblick: när passet
-- bekräftas och när ett köp blir betalt. Timmar som blev lediga efter
-- det betalade ingenting:
--   - ett pass betalt med timmar avbokas, och timmarna kommer tillbaka
--   - kortet vinner över ett pass timmarna betalat (stripe-webhook)
--   - timbanken fylls på tills den räcker till ett helt pass
--   - flaggan erbjudanden slås på när passen redan är bekräftade
-- Ett bekräftat pass som timmarna räckte till stod då obetalt, med en
-- knapp, tills rapporten gjorde det genomfört. Den som betalade det med
-- kort under tiden betalade pengar med timmar kvar, och en plans timmar
-- går ut efter en månad.
--
-- 1. intern.timmar_betala() är valet från Fas 22.2, flyttat ur triggern
--    så att två vägar använder samma: klippkortet som går ut först och
--    räcker, annars timbanken när minuterna räcker till det bokade.
--    Triggern bookings_timmar_betalar gör precis som förut.
--
-- 2. intern.timmar_betalar_obetalda() går igenom de bekräftade,
--    obetalda passen från och med i dag, i datumordning, och låter
--    valet betala dem. pg_cron kör den var femte minut
--    ('timmar-betalar'), som postgres: auth.uid() är null, och
--    skydda_bokningsfalt och skydda_klippkortet släpper igenom
--    betalningen som för webhooken. En trigger på avbokningen hade inte
--    kunnat göra det: den körs i familjens eller studiehjälparens
--    session, och spärrarna nekar då en betalning på ett annat pass.
--
--    Jobbet väntar aldrig på ett lås. Ett pass någon annan skriver i
--    just nu hoppas över (skip locked), och är familjens kort eller
--    timbank låsta av en bekräftelse (nowait) väntar passet till nästa
--    körning. Jobbet låser pass efter pass i en och samma transaktion,
--    och hade det väntat hade det kunnat låsa fast mot en bekräftelse
--    som låser passet först och korten sedan.
--
-- 3. Blir något fel betalas passet inte, admin får en uppgift för det
--    passet, och nästa pass prövas. Knappen Betala med timmar står kvar
--    och gör samma sak direkt.
-- ============================================================

set local lock_timeout = '5s';

-- ---------- 1. valet, ur triggern ----------
/* Samma val som Fas 22.2 gjorde i triggern, på en rad som skickas in
   och lämnas tillbaka betald eller orörd. Timbankens uttag skrivs här;
   passets kolumner skriver den som anropar, triggern genom NEW och
   jobbet med en update.

   vanta = false låser utan att vänta: ett låst kort eller en låst bank
   ger lock_not_available, och passet får vänta till nästa körning. */
create or replace function intern.timmar_betala(rad public.bookings, vanta boolean default true)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  idag  date := (now() at time zone 'Europe/Stockholm')::date;
  behov int;
  kort  uuid;
  saldo int;
begin
  if rad.klippkort_id is not null
     or rad.betalning_status not in ('ingen', 'vantar', 'misslyckad')
     or rad.parent_id is null
     or not rad.fakturerbar
     or coalesce(rad.antal_barn, 1) > 1
     or rad.startrabatt
     or not coalesce((select f.aktiv from public.flaggor f where f.kod = 'erbjudanden'), false)
     or intern.timbank_betalt(rad.id) then
    return rad;
  end if;

  behov := greatest(1, ceil(least(coalesce(rad.duration_min, 60),
                                  coalesce(intern.debiterade_min(rad.id), rad.duration_min, 60)) / 60.0))::int;

  if vanta then
    perform 1 from public.klippkort where parent_id = rad.parent_id and status = 'betald' for update;
  else
    perform 1 from public.klippkort where parent_id = rad.parent_id and status = 'betald' for update nowait;
  end if;

  select k.id into kort
    from public.klippkort k
   where k.parent_id = rad.parent_id
     and k.status = 'betald'
     and k.giltigt_till >= rad.wanted_date
     and k.giltigt_till >= idag
     and k.timmar - coalesce((
           select sum(greatest(1, ceil(least(coalesce(x.duration_min, 60),
                                             coalesce(intern.debiterade_min(x.id), x.duration_min, 60)) / 60.0)))::int
             from public.bookings x
            where x.klippkort_id = k.id and x.status <> 'cancelled' and x.id <> rad.id), 0) >= behov
   order by k.giltigt_till, k.created_at
   limit 1;

  if found then
    rad.klippkort_id := kort;
    rad.betalning_status := 'betald';
    rad.betald_at := now();
    return rad;
  end if;

  /* Timbanken betalar det bokade, som timbank_dra. Blev passet kortare
     går resten tillbaka in (intern.timbank_in), och drog det över tar
     banken övertiden när rapporten skrivs. */
  if vanta then
    perform pg_advisory_xact_lock(hashtextextended('timbank:' || rad.parent_id::text, 0));
  elsif not pg_try_advisory_xact_lock(hashtextextended('timbank:' || rad.parent_id::text, 0)) then
    raise exception using errcode = 'lock_not_available', message = 'Timbanken skrivs i just nu.';
  end if;
  saldo := coalesce(intern.timbank_saldo(rad.parent_id), 0);
  if saldo >= coalesce(rad.duration_min, 60) then
    insert into public.timbank_uttag (parent_id, booking_id, sort, minuter)
    values (rad.parent_id, rad.id, 'pass', coalesce(rad.duration_min, 60))
    on conflict (booking_id, sort) where booking_id is not null
    do update set minuter = excluded.minuter, created_at = now();
    rad.betalning_status := 'betald';
    rad.betald_at := now();
  end if;
  return rad;
end $$;

revoke execute on function intern.timmar_betala(public.bookings, boolean) from public, anon, authenticated;

comment on function intern.timmar_betala(public.bookings, boolean) is
  'Fas 22.3: vad som betalar passet, om något. Klippkortet som går ut först och räcker, annars timbanken. Skriver timbankens uttag; passets kolumner skriver anroparen.';

/* Triggern från Fas 22.2, med valet utflyttat. Samma villkor och samma
   ordning bland triggrarna: efter skydda_*, före
   bookings_timmarna_tillbaka. */
create or replace function intern.timmar_betalar_passet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rad public.bookings;
begin
  rad := intern.timmar_betala(new, true);
  return rad;
end $$;

revoke execute on function intern.timmar_betalar_passet() from public, anon, authenticated;

-- ---------- 2. timmar som blivit lediga ----------
create or replace function intern.timmar_betalar_obetalda(p_foralder uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  idag    date := (now() at time zone 'Europe/Stockholm')::date;
  pass_id uuid;
  rad     public.bookings;
  n       int := 0;
begin
  if not coalesce((select f.aktiv from public.flaggor f where f.kod = 'erbjudanden'), false) then
    return 0;
  end if;

  /* Förurvalet frågar bara om familjen har ett kort som går att använda
     eller en bank som räcker. Om timmarna räcker till just det här
     passet avgör valet. */
  for pass_id in
    select b.id
      from public.bookings b
     where (p_foralder is null or b.parent_id = p_foralder)
       and b.status = 'confirmed'
       and b.klippkort_id is null
       and b.betalning_status in ('ingen', 'vantar', 'misslyckad')
       and b.parent_id is not null
       and b.fakturerbar
       and coalesce(b.antal_barn, 1) <= 1
       and not b.startrabatt
       and b.wanted_date >= idag
       and not intern.timbank_betalt(b.id)
       and (exists (select 1 from public.klippkort_saldo k
                     where k.parent_id = b.parent_id and k.brukbar and k.giltigt_till >= b.wanted_date)
            or coalesce(intern.timbank_saldo(b.parent_id), 0) >= coalesce(b.duration_min, 60))
     order by b.wanted_date, b.wanted_time nulls last, b.created_at, b.id
  loop
    begin
      select * into rad
        from public.bookings
       where id = pass_id
         and status = 'confirmed'
         and klippkort_id is null
         and betalning_status in ('ingen', 'vantar', 'misslyckad')
         for update skip locked;
      if found then
        rad := intern.timmar_betala(rad, false);
        if rad.betalning_status = 'betald' then
          update public.bookings
             set klippkort_id = rad.klippkort_id,
                 betalning_status = 'betald',
                 betald_at = rad.betald_at
           where id = pass_id;
          n := n + 1;
        end if;
      end if;
    exception
      when lock_not_available then
        null;  -- någon betalar eller bekräftar just nu; nästa körning
      when others then
        perform public.skapa_uppgift(
          'Köpta timmar betalade inte ett bekräftat pass',
          'timmar_betalar_pass:' || pass_id,
          'kontroll',
          'Timmarna räcker till passet, men de kunde inte betala det: ' || left(sqlerrm, 300)
            || ' Familjen kan betala det med Betala med timmar, och jobbet prövar igen om fem minuter.',
          'bookings', pass_id::text);
    end;
  end loop;
  return n;
end $$;

revoke execute on function intern.timmar_betalar_obetalda(uuid) from public, anon, authenticated;

comment on function intern.timmar_betalar_obetalda(uuid) is
  'Fas 22.3: timmar som blivit lediga (en avbokning, kortet som vann, timbanken som fyllts på, flaggan som slogs på) betalar de bekräftade, obetalda passen från och med i dag, i datumordning. pg_cron timmar-betalar var femte minut. Väntar aldrig på ett lås.';

select cron.schedule('timmar-betalar', '*/5 * * * *', $$select intern.timmar_betalar_obetalda()$$);
