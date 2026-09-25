-- ============================================================
-- Fas 16.1c: ett avbokat klippkortspass larmar inte som betalt
--
-- avvikelser_rader() tar upp "Betalt men avbokat" för ett avbokat pass
-- som står 'betald' och där betalt_ore är null — tanken är en
-- kortbetalning vars belopp inte hunnit skrivas. Ett pass betalt med
-- timmar står just så: 'betald', betalt_ore null. Avbokade admin ett
-- sådant pass hade adminvyn bett om en återbetalning med kort av
-- pengar som aldrig dragits för passet, fast timmarna redan gått
-- tillbaka på klippkortet.
--
-- En egen trigger, inte en gren i skydda_bokningsfalt eller en ändring
-- i avvikelser_rader: båda hör till #44 och ersattes i driften medan
-- den här grenen byggdes (se filhuvudet i fas16_1).
--
-- Bara admin och systemet: en familj kan inte avboka ett betalt pass
-- (skydda_bokningsfalt nekar, med sitt eget besked), och triggern ska
-- inte ändra raden innan det beskedet hunnit ges — den hade då fått
-- ett annat, missvisande fel.
--
-- klippkort_id står kvar: det är historiken. Timmarna räknas bara ur
-- pass som inte är avbokade, så de är redan tillbaka.
-- ============================================================

create function public.klippkortspass_avbokat()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    return new;
  end if;
  if new.status = 'cancelled' and old.status is distinct from 'cancelled'
     and new.klippkort_id is not null and new.betalning_status = 'betald'
     and new.stripe_payment_intent_id is null then
    new.betalning_status := 'ingen';
    new.betald_at := null;
  end if;
  return new;
end $$;

create trigger bookings_klippkortspass_avbokat
  before update of status on public.bookings
  for each row execute function public.klippkortspass_avbokat();
