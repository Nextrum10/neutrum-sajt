-- ============================================================
-- timbank_kortet_vann tas bort
--
-- Den ställde passet som väntande och gav tillbaka minuterna, och
-- stripe-webhook skrev sedan kortbetalningen i ett andra anrop. Sedan
-- timbanken_foljer_passet gör timbank_kort_vinner båda i samma
-- transaktion, och stripe-webhook version 11 anropar bara den. En
-- funktion ingen anropar är en funktion nästa person bygger vidare på.
--
-- Webhooken driftsattes före den här migrationen, med flit: en äldre
-- webhook som anropat en borttagen funktion hade svarat 500 på varje
-- kortbetalning som vann över timbanken.
-- ============================================================

drop function public.timbank_kortet_vann(uuid);
