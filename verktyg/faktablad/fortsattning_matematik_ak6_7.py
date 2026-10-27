# -*- coding: utf-8 -*-
"""Faktabladen till fortsättningen i matematik för åk 6 och åk 7 (2026-10-27), ett per
nytt område i verktyg/uppgiftsbanken/fortsattning_matematik_ak6_7.py:

    åk 6   Mönster och talföljder, Kombinationer, Längd, massa och volym
    åk 7   Fyrhörningar och area, Statistik och diagram, Koordinatsystem och grafer

Bladen säger det nivåerna övar, inget mer. Exemplen har andra tal än frågorna, och de
räknas här nedan innan de står på bladet: ett blad som räknar fel lär eleven fel före
första frågan. Skrivet med AI och inte läst av någon som undervisar i ämnet.
"""
from fractions import Fraction as F
from math import comb

from fakta import blad

# Exemplen, räknade.
assert 6 + 19 * 4 == 82 and [4 * n + 1 for n in (1, 2, 3)] == [5, 9, 13] and (32 - 2) / 3 == 10
assert 4 * 3 == 12 and comb(7, 2) == 7 * 6 // 2 == 21 and 5 * 4 * 3 * 2 * 1 == 120 and 3 * 4 == 12
assert F('0.35') * 1000 == 350 and 30 * 20 * 10 == 6 * 1000
assert F(7 + 11) * 5 / 2 == 45 and F('0.3') * 10000 == 3000
assert F(0 * 2 + 1 * 3 + 2 * 5, 2 + 3 + 5) == F('1.3') and F(15, 60) * 360 == 90
assert 3 * (-2) + 5 == -1 and [4 * x + 1 for x in (0, 1, 2)] == [1, 5, 9]

FAKTABLAD = [
    blad('Matematik', 'ak6', 'Mönster och talföljder',
         mal=['Fortsätta en talföljd och säga vilken regel den följer.',
              'Räkna ut vilket tal som står på en viss plats, utan att skriva alla tal före.',
              'Skriva en formel med n för ett mönster av figurer, och använda den åt båda hållen.'],
         fakta=['Ökar en talföljd lika mycket varje gång ser du steget om du drar ett tal från talet efter.',
                'Talet på plats n är första talet + (n − 1) · steget. Från plats 1 till plats 10 är det 9 steg.',
                'En formel som 3n + 2 betyder 3 · n + 2. Sätt in figurens nummer i stället för n.',
                'Talet framför n är hur mycket mönstret växer för varje ny figur. Talet som läggs till gör att '
                'figur 1 blir rätt.',
                'Vet du antalet men inte figuren, räkna baklänges: 3n + 2 = 32 ger 3n = 30, och n = 10.'],
         exempel=[('Talföljden börjar 6, 10, 14, 18, … Vilket tal står på plats 20?',
                   'Steget är 4, och från plats 1 till plats 20 är det 19 steg. 6 + 19 · 4 = 6 + 76 = 82.'),
                  ('Figur 1 har 5 stickor, figur 2 har 9 och figur 3 har 13. Vilken formel ger antalet i figur n?',
                   'Mönstret växer med 4 per figur, så formeln börjar med 4n. För figur 1 är 4 · 1 = 4, men det ska '
                   'vara 5, så lägg till 1: 4n + 1. Pröva figur 3: 4 · 3 + 1 = 13.')],
         ord=[('talföljd', 'tal i en bestämd ordning som följer en regel'),
              ('n', 'en bokstav som står för figurens eller platsens nummer'),
              ('formel', 'ett uttryck som ger svaret när du sätter in ett tal')],
         tips='Pröva formeln på figur 1, 2 och 3 innan du använder den. Stämmer den inte för alla tre är den fel.'),

    blad('Matematik', 'ak6', 'Kombinationer',
         mal=['Räkna hur många sätt det finns att välja en sak av varje sort.',
              'Räkna hur många ordningar några personer eller saker kan stå i.',
              'Skilja på när ordningen spelar roll och när den inte gör det.'],
         fakta=['En sak av varje sort: multiplicera antalen. 3 kepsar och 4 halsdukar ger 3 · 4 = 12 sätt.',
                'Personer i en kö: första platsen har alla att välja på, nästa en färre, och så vidare. Fem '
                'personer kan stå på 5 · 4 · 3 · 2 · 1 = 120 sätt.',
                'När du väljer två och ordningen inte spelar roll, som i ett lag eller ett handslag, har varje par '
                'räknats två gånger om du multiplicerar. Dela då med 2.',
                'Skriv upp möjligheterna i en ordning, till exempel efter första siffran, så missar du ingen och '
                'tar ingen två gånger.'],
         exempel=[('Hur många tvåsiffriga tal kan du bilda med siffrorna 2, 5, 6 och 9, om varje siffra får '
                   'användas högst en gång?',
                   'Tiotalssiffran kan väljas på 4 sätt och entalssiffran på de 3 som är kvar: 4 · 3 = 12.'),
                  ('Sju personer tar varandra i hand, en gång per par. Hur många handslag blir det?',
                   'Var och en tar 6 i hand: 7 · 6 = 42. Då har varje handslag räknats två gånger, så det blir '
                   '42 : 2 = 21.')],
         ord=[('kombination', 'ett sätt att välja saker'),
              ('utfall', 'ett av de sätt det kan sluta på, som en sexa när du slår en tärning')],
         tips='När du väljer två: är Ada och Bo samma sak som Bo och Ada? Är det samma sak, dela med 2.'),

    blad('Matematik', 'ak6', 'Längd, massa och volym',
         mal=['Byta mellan mm, cm, dm, m och km.',
              'Byta mellan g, hg, kg och ton.',
              'Byta mellan ml, cl, dl och liter, och räkna ut volymen av ett rätblock.',
              'Uppskatta om en längd är rimlig.'],
         fakta=['Längd: 1 km = 1 000 m, och 1 m = 10 dm = 100 cm = 1 000 mm.',
                'Massa: 1 ton = 1 000 kg, 1 kg = 10 hg = 1 000 g, och 1 hg = 100 g.',
                'Volym: 1 liter = 10 dl = 100 cl = 1 000 ml. 1 dm³ är 1 liter, och 1 cm³ är 1 ml.',
                'Volymen av ett rätblock är längden · bredden · höjden. Räknar du i cm blir svaret i cm³.',
                'Till en mindre enhet blir talet större, så du multiplicerar. Till en större enhet blir talet '
                'mindre, så du delar.'],
         exempel=[('Hur många gram är 0,35 kg?', '1 kg = 1 000 g, så 0,35 kg är 0,35 · 1 000 = 350 g.'),
                  ('En låda är 30 cm lång, 20 cm bred och 10 cm hög. Hur många liter rymmer den?',
                   'Volymen är 30 · 20 · 10 = 6 000 cm³. 1 liter är 1 000 cm³, så lådan rymmer 6 liter.')],
         ord=[('milli', 'en tusendel, som i millimeter och milliliter'),
              ('centi', 'en hundradel, som i centimeter och centiliter'),
              ('deci', 'en tiondel, som i decimeter och deciliter'),
              ('hekto', 'hundra: 1 hg är 100 g'),
              ('kilo', 'tusen, som i kilometer och kilogram')],
         tips='Gör om allt till samma enhet innan du jämför eller räknar.'),

    blad('Matematik', 'ak7', 'Fyrhörningar och area',
         mal=['Räkna ut arean av en parallellogram och en parallelltrapets.',
              'Räkna baklänges från arean till höjden.',
              'Dela upp en sammansatt figur och räkna ut dess area.',
              'Byta mellan mm², cm², dm² och m².'],
         fakta=['Parallellogram: A = b · h, där h är höjden vinkelrätt mot basen b, inte den sneda sidan.',
                'Parallelltrapets: A = (a + b) · h / 2, där a och b är de två parallella sidorna.',
                'Triangel: A = b · h / 2. Rektangel: A = längden · bredden.',
                'En sammansatt figur: dela upp den i delar du kan räkna, räkna varje del och lägg ihop. Ett hål '
                'dras bort.',
                'Areaenheter: 1 m² = 100 dm², 1 dm² = 100 cm² och 1 cm² = 100 mm². Varje steg är 10 · 10 = 100 '
                'gånger.'],
         exempel=[('En parallelltrapets har de parallella sidorna 7 cm och 11 cm och höjden 5 cm. Hur stor är '
                   'arean?', 'A = (7 + 11) · 5 / 2 = 18 · 5 / 2 = 45 cm².'),
                  ('Hur många cm² är 0,3 m²?', '1 m² = 100 · 100 = 10 000 cm², så 0,3 m² är 0,3 · 10 000 = '
                                               '3 000 cm².')],
         ord=[('bas', 'den sida som höjden mäts mot'),
              ('höjd', 'avståndet vinkelrätt från basen till den motsatta sidan'),
              ('parallell', 'två linjer som aldrig möts, med samma avstånd hela vägen'),
              ('parallellogram', 'en fyrhörning där båda paren av motstående sidor är parallella'),
              ('parallelltrapets', 'en fyrhörning där två av sidorna är parallella')],
         tips='Höjden står alltid i rät vinkel mot basen. Den sneda sidan är längre, och den används inte för '
              'arean.'),

    blad('Matematik', 'ak7', 'Statistik och diagram',
         mal=['Läsa en frekvenstabell och räkna ut hur många som svarat.',
              'Räkna ut relativ frekvens i procent.',
              'Räkna ut medelvärde, median och typvärde ur en tabell, och variationsbredden.',
              'Räkna mellan andelar och grader i ett cirkeldiagram.'],
         fakta=['Frekvens är hur många som har ett värde. Relativ frekvens är frekvensen delad med antalet, ofta '
                'skriven i procent.',
                'Medelvärdet ur en tabell: multiplicera varje värde med sin frekvens, lägg ihop och dela med '
                'antalet.',
                'Typvärdet är värdet som flest har, inte hur många de är. Medianen är värdet i mitten när alla '
                'värden står i storleksordning. Är de ett jämnt antal är medianen medelvärdet av de två i mitten.',
                'Variationsbredden är det största värdet minus det minsta. Den visar hur utspridda värdena är.',
                'Ett cirkeldiagram är 360°. En sektor är andelen · 360°, och andelen är sektorns grader delade '
                'med 360.'],
         exempel=[('2 elever har 0 husdjur, 3 elever har 1 husdjur och 5 elever har 2 husdjur. Vad är '
                   'medelvärdet?',
                   'Husdjuren är 0 · 2 + 1 · 3 + 2 · 5 = 13 och eleverna 2 + 3 + 5 = 10. Medelvärdet är 13 : 10 = '
                   '1,3 husdjur.'),
                  ('15 av 60 svarade ”buss”. Hur många grader blir bussens sektor i ett cirkeldiagram?',
                   'Andelen är 15 : 60 = 0,25. 0,25 · 360° = 90°.')],
         ord=[('frekvens', 'hur många gånger ett värde finns'),
              ('relativ frekvens', 'frekvensen som andel av alla, till exempel 20 %'),
              ('lägesmått', 'medelvärde, median och typvärde: var värdena ligger'),
              ('spridningsmått', 'till exempel variationsbredden: hur utspridda värdena är'),
              ('sektor', 'en tårtbit av ett cirkeldiagram')],
         tips='Blanda inte ihop värdet och frekvensen: i ”10 elever har 1 syskon” är värdet 1 och frekvensen 10.'),

    blad('Matematik', 'ak7', 'Koordinatsystem och grafer',
         mal=['Säga i vilken kvadrant en punkt ligger, också med negativa koordinater.',
              'Flytta och spegla punkter, och räkna avståndet längs en linje.',
              'Räkna ut y ur en formel och se om en punkt ligger på en graf.',
              'Hitta formeln till en värdetabell.'],
         fakta=['En punkt skrivs (x, y): först x, steg åt höger eller vänster, sedan y, steg uppåt eller nedåt.',
                'Kvadranterna räknas moturs från den övre högra: första (+, +), andra (−, +), tredje (−, −) och '
                'fjärde (+, −).',
                'Speglas en punkt i x-axeln byter y tecken. Speglas den i y-axeln byter x tecken.',
                'En punkt ligger på grafen till en formel om formeln ger punktens y när du sätter in punktens x.',
                'I y = 2x + 5 är talet framför x, 2, hur mycket y ökar när x ökar med 1. Talet som läggs till, 5, '
                'är y när x = 0, där grafen skär y-axeln.'],
         exempel=[('Ligger punkten (−2, −1) på grafen till y = 3x + 5?',
                   'Sätt in x = −2: y = 3 · (−2) + 5 = −6 + 5 = −1. Det är punktens y, så punkten ligger på '
                   'grafen.'),
                  ('När x = 0 är y = 1, när x = 1 är y = 5 och när x = 2 är y = 9. Vilken formel passar?',
                   'y ökar med 4 när x ökar med 1, och y är 1 när x = 0. Formeln är y = 4x + 1.')],
         ord=[('origo', 'punkten (0, 0), där axlarna möts'),
              ('kvadrant', 'en av de fyra delar som axlarna delar koordinatsystemet i'),
              ('värdetabell', 'en tabell med x-värden och de y-värden som formeln ger'),
              ('graf', 'alla punkter som stämmer med en formel, ritade i ett koordinatsystem')],
         tips='Säg x först och y sedan: (3, −2) är tre steg åt höger och två steg nedåt.'),
]
