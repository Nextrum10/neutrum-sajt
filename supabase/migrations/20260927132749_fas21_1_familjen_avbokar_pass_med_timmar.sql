-- ============================================================
-- Fas 21.1 — familjen avbokar själv ett pass betalt med timmar
--
-- Leo 2026-09-27: "de ska kunna avboka passen med klippkortstimmarna".
--
-- skydda_bokningsfalt nekade avbokning av varje betalt pass (Fas 14.1),
-- för att pengarna då ligger hos Nextrum och någon måste bestämma vad
-- som ska tillbaka. Ett pass betalt med timmar har inga pengar på sig:
-- klippkort_saldo räknar "kvar" ur de pass som bär kortet och inte är
-- avbokade, så timmarna kommer tillbaka av sig själva i samma skrivning.
-- Spärren skyddade alltså ingenting där, och lade bara ett mejl till
-- oss mellan familjen och en avbokning.
--
-- Villkoret är smalt med flit: betald, klippkort_id satt, inget
-- betalt_ore och ingen betalning hos Stripe. Kom en kortbetalning in på
-- samma pass (en kassa som stod öppen när timmarna drogs) ligger det
-- pengar på det, och då gäller spärren som förut. Skälet krävs som för
-- alla avbokningar (Fas 15.2), och motparten får samma mejl. Samma
-- sak gäller studiehjälparen: avbokar hen, kommer timmarna tillbaka.
--
--
-- TRIGGERN FRÅN FAS 16.1c FLYTTAS
--
-- klippkortspass_avbokat() sätter ett avbokat timpass till 'ingen', så
-- att det inte larmar som betald_men_avbokad. Den gjorde det bara för
-- admin och systemet, eftersom en familj inte kunde avboka. Den hette
-- bookings_klippkortspass_avbokat och kördes därför FÖRE
-- bookings_skydda_bokningsfalt (triggrar på samma händelse körs i
-- namnordning). För en familj hade skydda_bokningsfalt då sett
-- betalning_status ändras i samma skrivning som statusen och nekat med
-- "På ett bokat pass kan bara status och tid ändras".
--
-- Nu heter triggern bookings_timmarna_tillbaka och körs efter
-- skydda_bokningsfalt och stampla_avbokningen, för alla. Spärren ser
-- alltså familjens egen skrivning, och nollningen kommer efteråt.
--
--
-- skydda_bokningsfalt ändras genom att EN rad byts, som i Fas 19.5: en
-- create or replace härifrån hade kunnat radera en gren någon annan
-- lagt till sedan.
-- ============================================================

do $$
declare
  fore   text := pg_get_functiondef('public.skydda_bokningsfalt'::regproc);
  gammal text := $g$      if old.betalning_status in ('betald', 'tvist') then$g$;
  ny     text := $n$      /* FAS 21.1. Ett pass betalt med timmar går att avboka: det finns
         inga pengar att betala tillbaka, och timmarna kommer tillbaka
         av sig själva (klippkort_saldo räknar bara pass som inte är
         avbokade). Kom det ändå kortpengar på passet gäller spärren. */
      if old.betalning_status in ('betald', 'tvist')
         and not (old.betalning_status = 'betald' and old.klippkort_id is not null
                  and coalesce(old.betalt_ore, 0) = 0 and old.stripe_payment_intent_id is null) then$n$;
begin
  if (length(fore) - length(replace(fore, gammal, ''))) / length(gammal) <> 1 then
    raise exception 'skydda_bokningsfalt: spärren för betalda pass hittades inte exakt en gång.';
  end if;
  execute replace(fore, gammal, ny);
end $$;

-- ---------- nollningen, för alla och efter spärren ----------
create or replace function public.klippkortspass_avbokat()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  /* Fas 21.1: gäller alla, inte bara admin. Triggern körs efter
     skydda_bokningsfalt, så det här är aldrig vad spärren prövar. */
  if new.status = 'cancelled' and old.status is distinct from 'cancelled'
     and new.klippkort_id is not null and new.betalning_status = 'betald'
     and coalesce(new.betalt_ore, 0) = 0
     and new.stripe_payment_intent_id is null then
    new.betalning_status := 'ingen';
    new.betald_at := null;
  end if;
  return new;
end $$;

revoke all on function public.klippkortspass_avbokat() from public, anon, authenticated;

drop trigger bookings_klippkortspass_avbokat on public.bookings;

create trigger bookings_timmarna_tillbaka
  before update of status on public.bookings
  for each row execute function public.klippkortspass_avbokat();

do $$
begin
  if position('FAS 21.1' in pg_get_functiondef('public.skydda_bokningsfalt'::regproc)) = 0 then
    raise exception 'skydda_bokningsfalt blev inte ändrad.';
  end if;
  -- Namnordningen ÄR konstruktionen: nollningen måste komma sist.
  if (select max(tgname) from pg_trigger
       where tgrelid = 'public.bookings'::regclass and not tgisinternal
         and tgtype & 2 = 2) <> 'bookings_timmarna_tillbaka' then
    raise exception 'bookings_timmarna_tillbaka är inte längre den sista before-triggern.';
  end if;
end $$;
