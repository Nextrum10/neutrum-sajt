-- ============================================================
-- Timbanken följer passet, och kortet vinner i en enda skrivning
--
-- Tre svagheter i Fas 22.1, hittade när timbanken granskades samma dag.
--
-- 1. KORTET VANN I TVÅ STEG. timbank_kortet_vann ställde passet som
--    väntande och gav tillbaka minuterna, och stripe-webhook skrev
--    kortbetalningen i ett andra anrop. Föll det andra stod passet som
--    obetalt med pengarna dragna och minuterna tillbaka, tills Stripe
--    levererade igen. timbank_kort_vinner gör båda i samma transaktion,
--    och den gamla funktionen tas bort när webhooken som anropar den nya
--    är driftsatt (migrationen efter den här).
--
-- 2. ÖVERTIDEN RÄKNADES FRÅN DET BOKADE, OCKSÅ NÄR KORTET BETALAT MER.
--    Betalar familjen efter passet tar kortet den hållna tiden minus det
--    banken tog, och stripe_minuter säger hur mycket. Rättade admin sedan
--    tiden räknades övertiden om från det bokade, och banken tog minuter
--    för tid kortet redan betalat. Nu räknas den från det kortet betalade
--    när det är mer än det bokade.
--
-- 3. UTTAGEN FÖLJDE INTE PASSET. Ändrade admin längden, antalet barn
--    eller undantaget på ett pass stod uttagen kvar som de räknades när
--    rapporten skrevs eller passet betalades. Nu räknas övertiden om, och
--    ett pass betalt med timbanken drar det nya bokade, som klippkortet,
--    som räknar sina timmar ur passen. Bara admin och databasen kan ändra
--    de tre kolumnerna (skydda_bokningsfalt).
-- ============================================================

set local lock_timeout = '5s';

-- ---------- övertiden, räknad på ett ställe ----------
/* Förut låg räkningen i triggern på lesson_reports. Nu anropas den också
   när passet ändras, så den står för sig.

   Det familjen redan betalat för utan banken är det bokade, eller det
   kortet betalade om det var mer: ett kortpass som betalades efter
   passet betalade den hållna tiden minus det banken tog då. Klippkortet
   och ett helt pass ur banken betalar det bokade, och där är
   stripe_minuter tom.

   Uttaget räknas om från början under familjens lås: det gamla tas bort,
   och det saldot ger tillbaka räknas med. */
create or replace function intern.timbank_rakna_overtid(p_booking uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b      public.bookings;
  betalt int;
  over   int;
  saldo  int;
begin
  select * into b from public.bookings where id = p_booking;
  if not found or b.parent_id is null then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('timbank:' || b.parent_id::text, 0));
  delete from public.timbank_uttag where booking_id = p_booking and sort = 'overtid';

  if not b.fakturerbar or coalesce(b.antal_barn, 1) > 1 then
    return;
  end if;

  betalt := greatest(coalesce(b.duration_min, 60),
                     case when b.betalning_status in ('betald', 'tvist') and b.klippkort_id is null
                          then coalesce(b.stripe_minuter, 0) else 0 end);
  over := coalesce(intern.debiterade_min(p_booking), b.duration_min, 60) - betalt
        - coalesce((select t.minuter from public.pass_tillagg t
                     where t.booking_id = p_booking and t.status in ('betald', 'tvist')), 0);
  if over <= 0 then
    return;
  end if;

  saldo := coalesce(intern.timbank_saldo(b.parent_id), 0);
  if saldo > 0 then
    insert into public.timbank_uttag (parent_id, booking_id, sort, minuter)
    values (b.parent_id, p_booking, 'overtid', least(over, saldo));
  end if;
end $$;

revoke all on function intern.timbank_rakna_overtid(uuid) from public, anon, authenticated;

/* Triggern på lesson_reports. Flyttas rapporten till ett annat pass
   räknas båda om; förut stod uttaget kvar på det gamla. */
create or replace function intern.timbank_overtid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.start_tid is not distinct from old.start_tid
     and new.slut_tid is not distinct from old.slut_tid
     and new.booking_id is not distinct from old.booking_id then
    return null;
  end if;
  if tg_op <> 'INSERT' and old.booking_id is not null then
    perform intern.timbank_rakna_overtid(old.booking_id);
  end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.booking_id is distinct from old.booking_id) then
    if new.booking_id is not null then
      perform intern.timbank_rakna_overtid(new.booking_id);
    end if;
  end if;
  return null;
end $$;

revoke execute on function intern.timbank_overtid() from public, anon, authenticated;

-- ---------- passet ändras ----------
/* Admin ändrar längden, antalet barn eller undantaget.

   Ett helt pass ur banken drar det nya bokade. Då betalar banken den
   hållna tiden vad längden än står på: det bokade går ut, det som inte
   hölls kommer tillbaka (intern.timbank_in), och övertiden räknas från
   det bokade. Räcker banken inte till en längre längd blir saldot
   negativt tills nästa insättning, som klippkortets kan bli när ett
   pass görs längre i efterhand; vyerna visar noll. */
create or replace function intern.timbank_passet_andrades()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_id is null then
    return null;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('timbank:' || new.parent_id::text, 0));
  if new.duration_min is distinct from old.duration_min then
    update public.timbank_uttag
       set minuter = coalesce(new.duration_min, 60)
     where booking_id = new.id and sort = 'pass';
  end if;
  perform intern.timbank_rakna_overtid(new.id);
  return null;
end $$;

revoke execute on function intern.timbank_passet_andrades() from public, anon, authenticated;

create trigger bookings_timbank_foljer_passet
  after update of duration_min, antal_barn, fakturerbar on public.bookings
  for each row
  when (old.duration_min is distinct from new.duration_min
        or old.antal_barn is distinct from new.antal_barn
        or old.fakturerbar is distinct from new.fakturerbar)
  execute function intern.timbank_passet_andrades();

-- ---------- kortet vinner ----------
/* stripe-webhook, när en kortbetalning kommer in på ett pass som redan
   betalats med timbanken: en kassa som stod öppen. Pengarna är dragna,
   så kortet vinner. Kortbetalningen skrivs och minuterna går tillbaka i
   samma transaktion.

   p_kort är webhookens egen skrivning av betalningen, samma objekt som
   den skriver på ett obetalt pass. Kolumnerna står utskrivna här, en och
   en: ingenting annat i objektet når passet.

   Svarar false när passet inte var betalt med timbanken, och en andra
   leverans av samma betalning träffar inget: då finns
   stripe_payment_intent_id, och uttaget är borta. */
create or replace function public.timbank_kort_vinner(p_pass uuid, p_kort jsonb)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  k public.bookings := jsonb_populate_record(null::public.bookings, p_kort);
begin
  update public.bookings
     set betalning_status = 'betald',
         betald_at = coalesce(k.betald_at, now()),
         stripe_payment_intent_id = k.stripe_payment_intent_id,
         stripe_charge_id = k.stripe_charge_id,
         stripe_balanstransaktion_id = k.stripe_balanstransaktion_id,
         stripe_avgift_ore = k.stripe_avgift_ore,
         stripe_netto_ore = k.stripe_netto_ore,
         stripe_skarp = k.stripe_skarp,
         betalt_ore = k.betalt_ore,
         stripe_minuter = k.stripe_minuter,
         aterbetald_ore = 0
   where id = p_pass and betalning_status = 'betald' and klippkort_id is null
     and stripe_payment_intent_id is null and intern.timbank_betalt(p_pass);
  if not found then
    return false;
  end if;
  delete from public.timbank_uttag where booking_id = p_pass and sort = 'pass';
  return true;
end $$;

revoke all on function public.timbank_kort_vinner(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.timbank_kort_vinner(uuid, jsonb) to service_role;

-- ---------- vakten ----------
do $$
begin
  if has_function_privilege('authenticated', 'intern.timbank_rakna_overtid(uuid)', 'execute')
     or has_function_privilege('authenticated', 'intern.timbank_passet_andrades()', 'execute')
     or has_function_privilege('anon', 'intern.timbank_passet_andrades()', 'execute')
     or has_function_privilege('authenticated', 'public.timbank_kort_vinner(uuid, jsonb)', 'execute')
     or has_function_privilege('anon', 'public.timbank_kort_vinner(uuid, jsonb)', 'execute') then
    raise exception 'En timbanksfunktion går att anropa av fel roll.';
  end if;
  -- Triggern är en after-trigger och rör inte namnordningen från Fas 21.1.
  if (select max(tgname) from pg_trigger
       where tgrelid = 'public.bookings'::regclass and not tgisinternal
         and tgtype & 2 = 2) <> 'bookings_timmarna_tillbaka' then
    raise exception 'bookings_timmarna_tillbaka är inte längre den sista before-triggern.';
  end if;
end $$;
