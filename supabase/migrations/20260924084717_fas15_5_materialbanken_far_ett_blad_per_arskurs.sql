-- ============================================================
-- NEXTRUM — Fas 15.5: materialbanken får ett blad per årskurs
--
-- Leo 2026-09-24: "lägga in material på Nextrums bank, offentliga
-- uppgifter och läxor för varje årskurs och ämne, helst skärmdumpar
-- på läxan med instruktioner, ämne och årskurs. Börja med en läxa
-- per årskurs för att se om det funkar."
--
-- Tolv blad, åk 1 till gymnasiet 3. De är VÅRA: skärmdumpar av
-- läromedel och förlagens övningsblad är upphovsrättsskyddade, och en
-- bank full av andras sidor är en bank vi inte får dela ut. Bladen
-- skrivs i verktyg/bygg-banken.py och ritas till bank/*.png, som
-- serveras från sajten. Raderna pekar dit med `lank` — se filhuvudet
-- i verktyget för varför inte hinken.
--
-- Id:t är ett uuid5 ur filnamnet, så att migrationen kan köras om
-- utan dubbletter och en rättelse av ett blad inte blir en ny rad.
--
-- ORDNINGEN: länkarna svarar 404 tills grenen med bank/ är
-- driftsatt på Vercel. Kör migrationen efter merge, inte före.
--
-- Beskrivningen är en sammanfattning, aldrig ett facit: vyn fyller
-- läxans text med den när studiehjälparen inte skrivit något eget.
--
-- Raderna genereras med:  python3 verktyg/bygg-banken.py --sql
-- ============================================================

insert into public.biblioteksmaterial (id, titel, beskrivning, amne, arskurs, lank) values
  ('04c75efe-ac84-5230-af12-e836aac24c1a', 'Tiokamrater', 'Tio uppgifter om talkamraterna till 10, med rutor att fylla i och en att rita i.', 'Matematik', 'ak1', 'https://nextrum.se/bank/ak1-matematik-tiokamrater.png'),
  ('fa6e3557-b12b-5608-9d25-e3b9cb5238ec', 'Stor bokstav och punkt', 'Skriv av meningar med stor bokstav och punkt, och skriv en egen.', 'Svenska', 'ak2', 'https://nextrum.se/bank/ak2-svenska-stor-bokstav-och-punkt.png'),
  ('dd6ff903-75b1-5153-bb75-674da73ade3c', 'Multiplikation med 2, 5 och 10', 'Tabellerna 2, 5 och 10, två saknade faktorer och två textuppgifter.', 'Matematik', 'ak3', 'https://nextrum.se/bank/ak3-matematik-multiplikation.png'),
  ('d7cfb70a-2f87-58c2-9d81-9b752d1b0d43', 'Days of the week and months', 'Veckodagar och månader på engelska, åtta korta uppgifter.', 'Engelska', 'ak4', 'https://nextrum.se/bank/ak4-engelska-veckodagar-och-manader.png'),
  ('4793f203-6b8c-5621-92d2-8dd44899dffb', 'Bråk – en del av en helhet', 'Bråk som del av en helhet: jämföra, förenkla, räkna ut en del av ett tal.', 'Matematik', 'ak5', 'https://nextrum.se/bank/ak5-matematik-brak.png'),
  ('bb808195-6103-595f-b5e7-2cd624cc6963', 'Igelkotten går i ide', 'Läsförståelse om hur igelkotten klarar vintern, fem frågor.', 'NO / Fysik / Kemi / Biologi', 'ak6', 'https://nextrum.se/bank/ak6-no-igelkotten-gar-i-ide.png'),
  ('feb96b09-c2fe-59f3-8b42-2f4df5e7a106', 'Procent i vardagen', 'Procentform och decimalform, procent av ett tal, rabatt och höjning.', 'Matematik', 'ak7', 'https://nextrum.se/bank/ak7-matematik-procent.png'),
  ('2b70b9df-aca8-5fc4-9950-021bfaac5bd8', 'Irregular verbs – past tense', 'Sex vanliga oregelbundna verb i dåtid, och tre egna meningar.', 'Engelska', 'ak8', 'https://nextrum.se/bank/ak8-engelska-oregelbundna-verb.png'),
  ('f8d9cf48-221a-52cf-909a-c418085f7945', 'Linjära funktioner: y = kx + m', 'Lutning och m-värde, linjen genom två punkter, en taxiformel och en graf.', 'Matematik', 'ak9', 'https://nextrum.se/bank/ak9-matematik-linjara-funktioner.png'),
  ('6190a82e-6014-54f1-be24-b979bfb0de65', 'Ekvationer och potenser', 'Förstagradsekvationer, potenslagar, grundpotensform och procentuell minskning.', 'Matematik', 'gy1', 'https://nextrum.se/bank/gy1-matematik-ekvationer-och-potenser.png'),
  ('d43adf75-2c29-5fee-a8d5-ca44b1acf553', 'Andragradsekvationer', 'pq-formeln, nollproduktmetoden, diskriminanten och en areauppgift.', 'Matematik', 'gy2', 'https://nextrum.se/bank/gy2-matematik-andragradsekvationer.png'),
  ('f9bb17d7-25c4-56a4-b16f-c45c58d755bc', 'Derivata – grunderna', 'Deriveringsregler, tangentens lutning, extrempunkt och en tillämpning.', 'Matematik', 'gy3', 'https://nextrum.se/bank/gy3-matematik-derivata.png')
on conflict (id) do nothing;
