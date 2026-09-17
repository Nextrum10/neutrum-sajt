-- ============================================================
-- NEXTRUM — Fas 1.6
-- FYRA TRIGGERFUNKTIONER UR API:ET, OCH BARA AKTIVA TJÄNSTER UTÅT
--
--
-- 1. TRIGGERFUNKTIONERNA
--
-- v14b, v14c och v16c återkallade EXECUTE på triggerfunktionerna,
-- men fyra som tillkommit senare stod kvar som anropbara för anon
-- och authenticated via /rest/v1/rpc/…:
--
--   rakna_rabattkod, skydda_elevradering, skydda_rabatt,
--   synka_laxhjalpspris
--
-- En trigger behöver inte EXECUTE när den körs — rättigheten
-- kontrolleras bara när triggern skapas. Samma mönster som v14.
--
-- Rörs INTE: kolla_rabattkod (bokningen anropar den som RPC) och
-- tjanstkoder_finns (används när ansökningsformuläret sparar).
--
--
-- 2. TJÄNSTEKATALOGEN (F-7)
--
-- "alla läser tjänster" var using (true) för public, så namn och
-- beskrivning på tjänster som inte är lanserade gick att läsa på
-- /rest/v1/tjanster. Masterplanen: en inaktiv tjänst syns inte
-- publikt. Anon och inloggade familjer och studiehjälpare ser nu
-- bara aktiva rader. NXTjanster filtrerar redan på aktiv, så inget
-- gränssnitt tappar något. Admin läser hela katalogen genom
-- "bara admin ändrar tjänster" (ALL), som är orörd.
--
-- Funktioner med SECURITY DEFINER som läser katalogen
-- (skydda_rabatt, kolla_rabattkod, tjanstkoder_finns,
-- skydda_bokningsfalt) påverkas inte av RLS.
-- ============================================================

revoke execute on function public.rakna_rabattkod()     from public, anon, authenticated;
revoke execute on function public.skydda_elevradering() from public, anon, authenticated;
revoke execute on function public.skydda_rabatt()       from public, anon, authenticated;
revoke execute on function public.synka_laxhjalpspris() from public, anon, authenticated;

drop policy if exists "alla läser tjänster" on public.tjanster;

drop policy if exists "alla läser aktiva tjänster" on public.tjanster;
create policy "alla läser aktiva tjänster"
  on public.tjanster
  for select
  to anon, authenticated
  using (aktiv);
