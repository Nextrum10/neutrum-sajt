# -*- coding: utf-8 -*-
"""Faktabladen till de nya områdena i matematik åk 8 och åk 9 (2026-10-27), ett per
område i verktyg/uppgiftsbanken/fortsattning_matematik_ak8_9.py och skrivet efter
vad nivåerna där faktiskt övar.

Exemplen är räknade här nedanför och är inga frågor ur banken: de har andra tal,
och inget av dem ger svaret på en fråga i nivåerna.
"""
from fractions import Fraction as F

from fakta import blad

# Exemplen, räknade.
assert [4 * n + 2 for n in (1, 2, 3, 4)] == [6, 10, 14, 18] and F(50 - 2, 4) == 12
assert [2 * n + 5 for n in (1, 2, 3)] == [7, 9, 11] and [n * n for n in (5, 6, 7, 8)] == [25, 36, 49, 64]
assert [b - a for a, b in zip([25, 36, 49, 64], [36, 49, 64])] == [11, 13, 15] and 6 * 5 * 4 * 3 * 2 * 1 == 720
assert F((12 - 2) * 180, 12) == 150 and 180 - 115 == 65
assert F(6, 40) * 360 == 54 and F(0 * 1 + 1 * 4 + 2 * 3 + 3 * 2, 1 + 4 + 3 + 2) == F(16, 10)
assert F(314, 100) * 16 * 5 == F('251.2') and F(314, 100) * 16 * 6 / 3 == F('100.48')
assert 9 * 8 == 72 and F(10 * 9, 2) == 45
assert F(15, 50) * 700 == 210

FAKTABLAD = [
    blad('Matematik', 'ak8', 'Mönster och talföljder',
         mal=['Hitta regeln i en talföljd och räkna ut nästa tal.',
              'Räkna ut ett tal långt fram i en talföljd utan att skriva ut alla tal före.',
              'Skriva en formel för tal nummer n och använda den.',
              'Räkna ut vilket nummer ett visst tal har i en talföljd.'],
         fakta=['I en talföljd som ökar lika mycket varje gång är skillnaden mellan två tal intill varandra alltid '
                'densamma.',
                'Från tal nummer 1 till tal nummer n är det n − 1 steg. Tal nummer n = första talet + (n − 1) · '
                'skillnaden.',
                'En formel som 2n + 5 ger talen när du sätter in n = 1, 2, 3 och så vidare: 7, 9, 11 …',
                'Talet framför n är skillnaden mellan talen. Talet som läggs till får du genom att jämföra med det '
                'första talet.',
                'Alla talföljder ökar inte lika mycket: i 5, 10, 20, 40 dubblas talen, och kvadrattalen 25, 36, 49, 64 '
                'ökar med 11, 13 och 15.'],
         exempel=[('Talföljden 6, 10, 14, 18, … ökar lika mycket varje gång. Vilken formel ger tal nummer n?',
                   'Talen ökar med 4, så formeln börjar med 4n. För n = 1 är 4n = 4, men talet är 6, så lägg till 2: '
                   '4n + 2. Kontroll: 4 · 4 + 2 = 18.'),
                  ('Vilket nummer har talet 50 i samma talföljd, med formeln 4n + 2?',
                   '4n + 2 = 50 ger 4n = 48, så n = 12. Talet 50 är tal nummer 12.')],
         ord=[('talföljd', 'tal i en bestämd ordning som följer en regel'),
              ('skillnad', 'hur mycket ett tal är större eller mindre än talet före'),
              ('kvadrattal', 'ett heltal gånger sig självt: 1, 4, 9, 16 …')],
         tips='Pröva formeln på flera tal som du redan vet, till exempel tal nummer 1, 2 och 3. Stämmer den inte för '
              'alla, är formeln fel.'),

    blad('Matematik', 'ak8', 'Vinklar och månghörningar',
         mal=['Känna igen vertikalvinklar, sidovinklar och likbelägna vinklar.',
              'Räkna ut okända vinklar där två linjer korsas och där en linje skär två parallella linjer.',
              'Räkna ut vinkelsumman i en månghörning med formeln (n − 2) · 180°.',
              'Räkna ut varje vinkel i en regelbunden månghörning.'],
         fakta=['Sidovinklar ligger bredvid varandra på en rät linje och är tillsammans 180°.',
                'Vertikalvinklar ligger mitt emot varandra där två linjer korsas och är alltid lika stora.',
                'När en linje skär två parallella linjer är likbelägna vinklar lika stora.',
                'Vinkelsumman i en månghörning med n hörn är (n − 2) · 180°, för den går att dela i n − 2 trianglar.',
                'I en regelbunden månghörning är alla vinklar lika stora: dela vinkelsumman med antalet hörn.'],
         exempel=[('Hur stor är varje vinkel i en regelbunden tolvhörning?',
                   'Vinkelsumman är (12 − 2) · 180° = 1 800°. Varje vinkel är 1 800° / 12 = 150°.'),
                  ('Två linjer korsar varandra, och en av vinklarna är 115°. Hur stora är de andra tre?',
                   'Vertikalvinkeln mitt emot är också 115°. De två sidovinklarna är 180° − 115° = 65° var.')],
         ord=[('vertikalvinklar', 'två vinklar mitt emot varandra där två linjer korsas'),
              ('sidovinklar', 'två vinklar bredvid varandra som tillsammans är 180°'),
              ('likbelägna vinklar', 'vinklar som ligger på samma sätt vid var sin av två parallella linjer'),
              ('regelbunden månghörning', 'en månghörning där alla sidor är lika långa och alla vinklar lika stora')],
         tips='Rita en figur, även om frågan inte har någon, och markera vinklar som är lika stora med samma tecken.'),

    blad('Matematik', 'ak8', 'Tabeller och diagram',
         mal=['Räkna ut relativ frekvens som bråk, decimaltal och procent.',
              'Räkna ut ett antal ur en relativ frekvens.',
              'Räkna ut vinkeln för en sektor i ett cirkeldiagram, och antalet ur en vinkel.',
              'Räkna ut medelvärde och typvärde ur en frekvenstabell.'],
         fakta=['Frekvensen är hur många gånger ett värde eller ett svar förekommer.',
                'Relativ frekvens = frekvensen / antalet svar. Den kan skrivas som bråk, decimaltal eller procent.',
                'Ett cirkeldiagram är 360°. Sektorns vinkel = andelen · 360°.',
                'Medelvärde ur en frekvenstabell: multiplicera varje värde med sin frekvens, lägg ihop och dela med '
                'antalet värden.',
                'Linjediagram passar för förändring över tid, stapeldiagram för att jämföra grupper och '
                'cirkeldiagram för delar av en helhet.'],
         exempel=[('Av 40 elever har 6 en katt. Hur stor blir den sektorn i ett cirkeldiagram?',
                   'Andelen är 6 / 40 = 0,15. Vinkeln är 0,15 · 360° = 54°.'),
                  ('1 elev har läst 0 böcker, 4 elever 1 bok, 3 elever 2 böcker och 2 elever 3 böcker. Vad är '
                   'medelvärdet?',
                   'Böckerna är 0 · 1 + 1 · 4 + 2 · 3 + 3 · 2 = 16, och eleverna är 1 + 4 + 3 + 2 = 10. Medelvärdet är '
                   '16 / 10 = 1,6 böcker.')],
         ord=[('frekvens', 'antalet gånger ett värde förekommer'),
              ('relativ frekvens', 'frekvensen som en andel av alla svar'),
              ('sektor', 'en tårtbit av ett cirkeldiagram'),
              ('typvärde', 'det värde som har störst frekvens')],
         tips='Kontrollera att alla relativa frekvenser tillsammans blir 100 % och att alla sektorer tillsammans blir '
              '360°.'),

    blad('Matematik', 'ak9', 'Volym och begränsningsarea',
         mal=['Räkna ut volymen av rätblock, prismor och cylindrar.',
              'Räkna ut volymen av pyramider, koner och klot.',
              'Räkna ut begränsningsarean av kuber, rätblock och cylindrar.',
              'Byta mellan kubikenheter och liter.'],
         fakta=['Prisma och cylinder: V = B · h, där B är basytans area och h höjden. Cylinderns basyta är π · r².',
                'Pyramid och kon: V = B · h / 3, en tredjedel av ett prisma eller en cylinder med samma bas och höjd.',
                'Klot: V = 4 · π · r³ / 3.',
                'Begränsningsarean är arean av alla ytor runt kroppen. En cylinders mantelyta är 2 · π · r · h.',
                '1 dm³ = 1 liter, 1 cm³ = 1 milliliter och 1 m³ = 1 000 liter.'],
         exempel=[('En cylinder har radien 4 cm och höjden 5 cm. Hur stor är volymen? Räkna med π ≈ 3,14.',
                   'V = π · r² · h = 3,14 · 16 · 5 = 251,2 cm³.'),
                  ('En kon har radien 4 cm och höjden 6 cm. Hur stor är volymen? Räkna med π ≈ 3,14.',
                   'V = π · r² · h / 3 = 3,14 · 16 · 6 / 3 = 100,48 cm³. Konen rymmer en tredjedel av en cylinder '
                   'med samma bas och höjd.')],
         ord=[('basyta', 'bottenytan; i ett prisma och en cylinder är varje tvärsnitt lika stort som den'),
              ('mantelyta', 'den böjda sidoytan på en cylinder eller en kon'),
              ('begränsningsarea', 'arean av alla ytor runt en kropp'),
              ('klot', 'en kropp som en boll, där varje punkt på ytan ligger lika långt från mitten')],
         tips='Räkna med samma längdenhet överallt, och byt till liter sist: 1 000 cm³ är 1 liter.'),

    blad('Matematik', 'ak9', 'Kombinatorik',
         mal=['Räkna ut antalet kombinationer med multiplikationsprincipen.',
              'Räkna ut på hur många sätt saker kan ordnas i en rad.',
              'Räkna ut antalet grupper när ordningen inte spelar någon roll.',
              'Använda kombinatorik för att räkna ut en sannolikhet.'],
         fakta=['Multiplikationsprincipen: kan något väljas på a sätt och något annat på b sätt, finns det a · b '
                'kombinationer.',
                'n olika saker kan ordnas i en rad på n · (n − 1) · … · 2 · 1 sätt. Sex saker: '
                '6 · 5 · 4 · 3 · 2 · 1 = 720 sätt.',
                'Väljer du 2 av n och ordningen inte spelar någon roll blir det n · (n − 1) / 2, för annars räknas '
                'varje par två gånger.',
                'Spelar ordningen roll, som med guld och silver, finns det fler möjligheter än när den inte gör det.'],
         exempel=[('På hur många sätt kan en vinnare och en tvåa väljas bland 9 deltagare?',
                   'Vinnaren kan väljas på 9 sätt och tvåan sedan på 8: 9 · 8 = 72 sätt.'),
                  ('Hur många matcher spelas när 10 lag möter varandra en gång var?',
                   'Varje lag spelar mot 9 andra: 10 · 9 = 90. Då räknas varje match två gånger, så det blir '
                   '90 / 2 = 45 matcher.')],
         ord=[('kombinatorik', 'att räkna ut hur många möjligheter det finns'),
              ('multiplikationsprincipen', 'antalet val i varje steg multipliceras med varandra')],
         tips='Fråga dig först om ordningen spelar roll. Gör den inte det, dela med antalet sätt som samma grupp kan '
              'ordnas på.'),

    blad('Matematik', 'ak9', 'Statistiska undersökningar',
         mal=['Skilja på population, stickprov och bortfall.',
              'Välja ett urval som ger en rättvis bild av hela gruppen.',
              'Uppskatta hur många i en hel grupp som har en egenskap, utifrån ett stickprov.',
              'Granska diagram och slutsatser: axlar som inte börjar på 0, andelar och samband.'],
         fakta=['Populationen är hela gruppen du vill veta något om. Stickprovet är de du faktiskt frågar.',
                'I ett slumpmässigt urval har alla i populationen samma chans att komma med, och då brukar stickprovet '
                'likna populationen.',
                'Uppskatta med andelen: har 30 % i stickprovet en egenskap, räkna med att ungefär 30 % av '
                'populationen har den.',
                'Jämför grupper av olika storlek med andelar, inte med antal.',
                'Att två saker ökar samtidigt betyder inte att den ena orsakar den andra.'],
         exempel=[('I ett slumpmässigt stickprov på 50 elever spelar 15 i ett lag. Skolan har 700 elever. Ungefär hur '
                   'många spelar i ett lag?',
                   'Andelen i stickprovet är 15 / 50 = 0,3. Uppskattningen är 0,3 · 700 = 210 elever.')],
         ord=[('population', 'hela gruppen som undersökningen gäller'),
              ('stickprov', 'de som väljs ut och tillfrågas'),
              ('bortfall', 'de utvalda som inte svarar'),
              ('ledande fråga', 'en fråga som är skriven så att den antyder vilket svar som väntas')],
         tips='Titta alltid på var den lodräta axeln börjar. Börjar den inte på 0 ser skillnaderna mellan staplarna '
              'större ut än de är.'),
]
