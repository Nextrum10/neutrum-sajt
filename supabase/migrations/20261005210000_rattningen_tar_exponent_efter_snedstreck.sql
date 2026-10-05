-- ============================================================
-- NEXTRUM — rättningen läser "0,25 mol/dm3" och "2 m/s2" som talet
--
-- intern.niva_tal godtog en exponent efter en längdenhet ("20 cm2") men
-- inte efter ett snedstreck: "0,25 mol/dm3" och "2,0 m/s2" rättades som
-- fel, medan "mol/dm³" och "m/s²" godtogs. Ett tangentbord utan ³ skriver
-- en trea, och nivåerna ur materialbanken (2026-10-03) frågar efter
-- koncentration och acceleration i NO gy1 och gy2.
--
-- Nu får nämnaren sluta på 2 eller 3, med eller utan ^. Bara efter ett
-- snedstreck: "3x2" är fortfarande inte talet 3. Samma regel står i
-- grund.talvarde() i verktyg/uppgiftsbanken/grund.py och ändras här
-- tillsammans med den.
--
-- Lappas med replace() på funktionens text, med en vakt som kräver
-- exakt den text som stod i driften 2026-10-05 och att mönstret hittas
-- två gånger (avsnitt 5: flera sessioner kör mot samma databas).
-- ============================================================

do $$
declare
  def text := pg_get_functiondef('intern.niva_tal'::regproc);
  fore text := '(?:/[a-zåäö²³°ω]{1,12})?';
  efter text := '(?:/[a-zåäö²³°ω]{1,12}(?:\^?[23])?)?';
  ny text;
begin
  if md5(def) <> '4648267eb23d4098027d989ff713c726' then
    raise exception 'intern.niva_tal är inte den väntade (md5 %), läs driften först', md5(def);
  end if;
  if (length(def) - length(replace(def, fore, ''))) / length(fore) <> 2 then
    raise exception 'mönstret för nämnaren hittades inte två gånger i intern.niva_tal';
  end if;
  ny := replace(def, fore, efter);
  execute ny;
end $$;
