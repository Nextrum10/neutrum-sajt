-- ============================================================
-- NEXTRUM — Fas 12.5: Connect ur betalvägen
--
-- MIGRATIONEN ÄNDRAR INGEN DATA OCH TAR INTE BORT NÅGON KOLUMN.
-- Den rättar kommentarer som blivit osanna, och det är inte kosmetik:
-- en kolumnkommentar som säger "ingen betalning får peka på ett konto
-- där den är false" beskriver en regel som inte finns längre, och den
-- som läser den om ett år tror att skyddet fortfarande gäller.
--
--
-- VAD SOM HÄNDE
--
-- Studiehjälparen får betalt den 25:e, som en löning, i en klump för
-- månadens rapporterade pass. Det är payouts och månadskörningens
-- jobb.
--
-- Fas 12.1 byggde i stället destination charges: hjälparens del pekades
-- ut vid varje kortbetalning och landade på hens anslutna Stripe-konto.
-- De två kan inte samexistera. Hade båda fått rulla hade
-- månadskörningen betalat samma timmar en gång till, och ingen hade
-- sett det förrän någon stämde av ett Stripe-saldo mot en lönelista.
--
-- Connect är därför ute ur betalvägen. Hela kundbeloppet går till
-- Nextrum, och hjälparen är inte part i kortbetalningen alls.
--
--
-- VARFÖR KOLUMNERNA STÅR KVAR
--
-- En rättelse är en ny migration, inte en omskriven historia, och att
-- droppa kolumner är destruktivt utan att lösa något: de är tomma,
-- kostar ingenting, och den dag anställningsfrågan besvaras med
-- "uppdragstagare med F-skatt" kan Connect bli aktuellt igen.
--
-- Skyddet står kvar oförändrat. skydda_tutorfalt() är en tillåt-lista,
-- så kolumnerna är frysta för en inloggad session vare sig de används
-- eller inte. Det är hela poängen med en tillåt-lista.
-- ============================================================

comment on column public.tutor_profiles.stripe_account_id is
  'OANVÄND sedan Fas 12.5. Connect är ute ur betalvägen: studiehjälparen får betalt den 25:e genom payouts, inte genom Stripe.';
comment on column public.tutor_profiles.stripe_onboarding is
  'OANVÄND sedan Fas 12.5. Edge-funktionen stripe-konto som skrev den finns inte längre i repot.';
comment on column public.tutor_profiles.stripe_kan_ta_emot is
  'OANVÄND sedan Fas 12.5. Ingen betalning pekar längre på ett anslutet konto, så det finns inget att spärra.';
comment on column public.tutor_profiles.stripe_utbetalning_aktiv is
  'OANVÄND sedan Fas 12.5.';
comment on column public.tutor_profiles.stripe_krav is
  'OANVÄND sedan Fas 12.5.';
comment on column public.tutor_profiles.stripe_kontrollerad_at is
  'OANVÄND sedan Fas 12.5.';
comment on column public.tutor_profiles.stripe_klar is
  'OANVÄND sedan Fas 12.5. Två vyer läser den fortfarande, men den sätts av ingenting och är alltid false.';

comment on column public.bookings.stripe_transfer_id is
  'OANVÄND sedan Fas 12.5. Hela beloppet stannar hos Nextrum, så Stripe skapar ingen överföring.';
comment on column public.bookings.ersattning_ore is
  'OANVÄND sedan Fas 12.5. Studiehjälparens ersättning räknas av fakturering ur rapporten, den 25:e. Två källor till samma siffra är en siffra ingen kan lita på.';
comment on column public.bookings.avgift_ore is
  'OANVÄND sedan Fas 12.5. Det finns ingen application fee: hela beloppet är Nextrums.';
comment on column public.bookings.betalt_ore is
  'Vad familjen faktiskt betalade med kort, fryst när Checkout-sessionen skapades. HELA beloppet går till Nextrum.';
