-- ============================================================
-- NEXTRUM — fyra länkar till provgrupperna rättas, och en beskrivning (Fas 15.9)
--
-- Leo 2026-10-03: "Klicka igenom de 14 länkarna till provgrupperna."
-- Molnmiljön når fortfarande inte su.se, gu.se, uu.se eller umu.se, så
-- varje adress jämfördes med vad sökmotorerna har indexerat. Nio fanns
-- exakt så. Tre fanns inte och byts mot de sidor som finns: engelska
-- nivå 1 och nivå 2 (Göteborgs universitet) och Umeås tidigare prov i
-- matematik. PRIM-gruppens två rader pekar på sidan om proven i stället
-- för gruppens startsida, som inte gick att bekräfta.
--
-- ak9-svenska-noveller-och-analys stavar nu "originalnovell".
--
-- Id:t kommer ur länkens namn och bladets filnamn (verktyg/bygg-banken.py),
-- så raderna uppdateras och inga nya skapas. Raderna står ord för ord som
-- i verktyg/bladen/lankar.py och hogstadiet.py.
-- ============================================================

update public.biblioteksmaterial set lank = 'https://www.su.se/enheter/prim-gruppen/nationella-prov' where id = '9736a41f-e625-5917-9b85-bc232f9fc62e';  -- ak6-matematik-np-prim-gruppen
update public.biblioteksmaterial set lank = 'https://www.su.se/enheter/prim-gruppen/nationella-prov' where id = 'b65d73c5-ccce-5fb2-8881-5f8e67b1829b';  -- gy1-matematik-np-prim-gruppen
update public.biblioteksmaterial set lank = 'https://www.gu.se/nationella-prov-frammande-sprak/prov-och-bedomningsstod-i-engelska/engelska-pa-niva-1/nationellt-prov-i-engelska-pa-niva-1' where id = 'a3a024b9-55c2-5a8a-a3cc-a252ead8f48d';  -- gy1-engelska-np-niva-1
update public.biblioteksmaterial set lank = 'https://www.gu.se/nationella-prov-frammande-sprak/prov-och-bedomningsstod-i-engelska/engelska-pa-niva-2/nationellt-prov-i-engelska-pa-niva-2' where id = 'c5e4fcd4-cce1-51ca-bb38-d97ad94b835a';  -- gy2-engelska-np-niva-2
update public.biblioteksmaterial set lank = 'https://www.umu.se/en/department-of-applied-educational-science/national-test-and-test-bank/national-course-tests-in-mathematics/earlier-given-tests/' where id = 'efffb51c-d232-5ac9-96b1-552aa5f4eee6';  -- gy2-matematik-np-tidigare-givna-prov
update public.biblioteksmaterial set beskrivning = 'Läsa en kort originalnovell och analysera miljö, huvudperson, vändpunkt, berättarperspektiv, bildspråk och tema.' where id = '285a31aa-d7ec-58fc-b325-8dc3e9a3320d';  -- ak9-svenska-noveller-och-analys
