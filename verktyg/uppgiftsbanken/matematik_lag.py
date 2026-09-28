# -*- coding: utf-8 -*-
"""Matematik åk 1–3. Talen upp till 1000, plus och minus, de första tabellerna, att dela lika, klockan, pengar, längd och former, i korta vardagsnära frågor som en sjuåring kan läsa själv."""
from grund import bana, niva, val, skriv, ordna, tal


def _stigande(par):
    """Brickorna i ordning efter sitt värde, räknat här och inte för
    hand. Två brickor med samma värde hade gett två rätta ordningar,
    och spelaren godtar bara en."""
    varden = [v for _, v in par]
    assert len(set(varden)) == len(varden), 'två brickor har samma värde: %r' % (par,)
    return [t for t, _ in sorted(par, key=lambda p: p[1])]


def _tal_stigande(tallista):
    assert len(set(tallista)) == len(tallista), 'samma tal två gånger: %r' % (tallista,)
    return [tal(x) for x in sorted(tallista)]


_ENTAL = ['noll', 'ett', 'två', 'tre', 'fyra', 'fem', 'sex', 'sju', 'åtta', 'nio', 'tio', 'elva', 'tolv',
          'tretton', 'fjorton', 'femton', 'sexton', 'sjutton', 'arton', 'nitton']
_TIOTAL = ['', '', 'tjugo', 'trettio', 'fyrtio', 'femtio', 'sextio', 'sjuttio', 'åttio', 'nittio']


def _svar(n, enhet=None):
    """Talet med siffror och, upp till 100, med bokstäver. En sjuåring
    som skriver "tre" har svarat rätt, och rättningen jämför bara
    siffror som tal.

    Med enhet står talet i ord också med ordet efter: "åtta äpplen".
    "8 äpplen" godtar rättningen själv, för ett tal får ha en enhet
    efter sig, men ett tal i ord jämförs bara som text."""
    svar = [tal(n)]
    if n < 20:
        svar.append(_ENTAL[n])
    elif n < 100:
        svar.append(_TIOTAL[n // 10] + (_ENTAL[n % 10] if n % 10 else ''))
        if n % 10 == 1:
            svar.append(_TIOTAL[n // 10] + 'en')
    elif n == 100:
        svar += ['hundra', 'etthundra', 'ett hundra']
    if n == 1:
        svar.append('en')
    if n == 18:
        svar.append('aderton')
    if enhet:
        svar += [s + ' ' + enhet for s in svar[1:]]
    return svar


BANOR = [
    bana('Matematik', 'ak1', [
        niva('ma-ak1-tal-1', 'Talen 0–20', 'Taluppfattning', [
            val('Vilket tal kommer precis efter 12?',
                [11, 13, 14], 12 + 1,
                'När man räknar uppåt kommer 13 direkt efter 12.'),
            val('Vilket tal kommer precis före 10?',
                [9, 11, 8], 10 - 1,
                'Talet före är ett mindre. 10 − 1 = 9.'),
            skriv('Räkna vidare: 5, 6, 7, 8. Vilket tal kommer sedan?', _svar(8 + 1),
                  'Varje tal är ett mer än talet före. Efter 8 kommer 9.'),
            val('Vilket tal är störst?',
                [15, 19, 12, 17], max(15, 19, 12, 17),
                'Alla talen har ett tiotal. 19 har flest ental, 9 stycken, så 19 är störst.'),
            val('Vilket tal är minst?',
                [14, 4, 11, 20], min(14, 4, 11, 20),
                'Talet 4 har inget tiotal, bara 4 ental. De andra talen är 10 eller mer.'),
            skriv('Vilket tal står mitt emellan 6 och 8?', _svar((6 + 8) // 2),
                  'Räkna 6, 7, 8. Talet 7 står i mitten.'),
            ordna('Ordna talen från minst till störst.', _tal_stigande([16, 3, 11, 8]),
                  forklaring='Börja med det minsta talet, 3. Sedan kommer 8, 11 och sist 16.'),
            skriv('Talet 14 är 1 tiotal och några ental. Hur många ental?', _svar(14 - 10, 'ental'),
                  'Talet 14 är 10 + 4. Det är 1 tiotal och 4 ental.'),
        ], beskrivning='Att räkna, jämföra och hitta talet före och efter bland talen 0–20.'),

        niva('ma-ak1-addition-1', 'Tiokamrater', 'Addition och subtraktion', [
            val('Vilket tal är tiokamrat med 7?',
                [3, 4, 2], 10 - 7,
                '7 + 3 = 10. Därför är 7 och 3 tiokamrater.'),
            skriv('6 + ? = 10. Vilket tal fattas?', _svar(10 - 6),
                  'Räkna från 6 upp till 10: 7, 8, 9, 10. Det är 4 steg.'),
            val('Vilka två tal är tiokamrater?',
                ['5 och 5', '4 och 5', '6 och 3', '2 och 7'], '5 och 5',
                '5 + 5 = 10. De andra paren blir bara 9.'),
            skriv('I en skål ligger 10 äpplen. Du tar 2. Hur många äpplen ligger kvar?', _svar(10 - 2, 'äpplen'),
                  '2 och 8 är tiokamrater. Tar du 2 av 10 blir 8 kvar.'),
            val('Vad är 10 − 4?',
                [6, 4, 14, 5], 10 - 4,
                '4 och 6 är tiokamrater. Tar du bort 4 från 10 blir 6 kvar.'),
            skriv('Du har 3 kulor. Hur många kulor till behöver du för att ha 10?', _svar(10 - 3, 'kulor'),
                  '3 och 7 är tiokamrater, för 3 + 7 = 10.'),
            ordna('Ordna så att svaren går från minst till störst.',
                  _stigande([('10 − 8', 10 - 8), ('10 − 5', 10 - 5), ('10 − 3', 10 - 3)]),
                  forklaring='10 − 8 = 2, 10 − 5 = 5 och 10 − 3 = 7. Ju mer man tar bort, desto mindre blir kvar.'),
            val('Sara har 10 kronor. En glass kostar 9 kronor. Hur många kronor har hon kvar när hon köpt glassen?',
                [1, 9, 19, 2], 10 - 9,
                '9 och 1 är tiokamrater. 10 − 9 = 1.'),
        ], beskrivning='Talpar som tillsammans blir 10, och hur de hjälper när man räknar plus och minus.'),

        niva('ma-ak1-addition-2', 'Plus och minus till 20', 'Addition och subtraktion', [
            skriv('Vad är 8 + 5?', _svar(8 + 5),
                  'Ta 2 av femman och gör 8 till 10. Sedan 10 + 3 = 13.'),
            val('Vad är 15 − 4?',
                [11, 19, 10, 12], 15 - 4,
                'Ta bort 4 ental från 15. 5 − 4 = 1, så svaret är 11.'),
            skriv('Emil har 9 kulor. Han får 6 till. Hur många kulor har han nu?', _svar(9 + 6, 'kulor'),
                  'Han får fler, så det är plus. 9 + 1 = 10, och 5 till blir 15.'),
            val('Vad är 12 − 5?',
                [7, 8, 17, 6], 12 - 5,
                'Ta först bort 2, då blir det 10. Sedan 3 till: 10 − 3 = 7.'),
            val('7 + ? = 16. Vilket tal fattas?',
                [9, 8, 23, 10], 16 - 7,
                'Räkna från 7 till 10, det är 3. Sedan från 10 till 16, det är 6. 3 + 6 = 9.'),
            skriv('Det sitter 17 fåglar i ett träd. 8 flyger iväg. Hur många sitter kvar?', _svar(17 - 8, 'fåglar'),
                  'Det blir färre, så det är minus. Ta först bort 7: 17 − 7 = 10. Ta sedan bort 1 till: 10 − 1 = 9.'),
            ordna('Ordna så att svaren går från minst till störst.',
                  _stigande([('20 − 9', 20 - 9), ('6 + 7', 6 + 7), ('8 + 8', 8 + 8)]),
                  forklaring='20 − 9 = 11, 6 + 7 = 13 och 8 + 8 = 16.'),
            val('Vad är dubbelt så mycket som 8?',
                [16, 10, 4, 18], 2 * 8,
                'Dubbelt betyder två gånger så mycket. 8 + 8 = 16.'),
        ], beskrivning='Addition och subtraktion med svar upp till 20, också i små berättelser.'),

        niva('ma-ak1-geometri-1', 'Former och lägesord', 'Geometri', [
            val('Vilken form har tre hörn?',
                ['triangel', 'kvadrat', 'cirkel', 'rektangel'], 'triangel',
                'En triangel har tre raka sidor och tre hörn.'),
            skriv('Hur många hörn har en cirkel?',
                  ['0', 'noll', 'inga', 'inget', 'ingen', 'inga hörn', 'inget hörn', 'noll hörn'],
                  'En cirkel är helt rund. Den har inga raka sidor och inga hörn.'),
            skriv('Hur många hörn har en kvadrat?', _svar(4, 'hörn'),
                  'En kvadrat har fyra lika långa sidor och fyra hörn.'),
            skriv('Hur många sidor har en triangel?', _svar(3, 'sidor'),
                  'Tri betyder tre. En triangel har tre sidor och tre hörn.'),
            val('Vilken form har alltid fyra lika långa sidor?',
                ['kvadrat', 'rektangel', 'triangel'], 'kvadrat',
                'En kvadrat har fyra lika långa sidor. En rektangel har ofta två långa och två korta sidor.'),
            val('Bollen ligger under bordet. Var är bordet?',
                ['ovanför bollen', 'under bollen', 'bakom bollen'], 'ovanför bollen',
                'Om bollen är under bordet, så är bordet ovanför bollen.'),
            val('Ali, Bea och Cem står i en kö. Ali står först och Cem står sist. Vem står i mitten?',
                ['Bea', 'Ali', 'Cem'], 'Bea',
                'Ali är först och Cem är sist. Då står Bea i mitten, mellan dem.'),
            ordna('Ordna formerna från färst hörn till flest hörn.',
                  _stigande([('kvadrat', 4), ('cirkel', 0), ('triangel', 3)]),
                  forklaring='En cirkel har inga hörn, en triangel har tre och en kvadrat har fyra.'),
        ], beskrivning='Enkla former som triangel, kvadrat och cirkel, och ord som säger var något är.'),
    ]),

    bana('Matematik', 'ak2', [
        niva('ma-ak2-tal-1', 'Tiotal och ental', 'Taluppfattning', [
            val('Hur många tiotal finns i talet 47?',
                [4, 7, 47, 40], 47 // 10,
                'Talet 47 är 40 + 7. 40 är 4 tiotal.'),
            skriv('Talet 63 har 6 tiotal. Hur många ental har det?', _svar(63 % 10, 'ental'),
                  'Talet 63 är 60 + 3. 60 är 6 tiotal och 3 är 3 ental.'),
            val('Vilket tal är 5 tiotal och 2 ental?',
                [52, 25, 502, 7], 5 * 10 + 2,
                '5 tiotal är 50 och 2 ental är 2. 50 + 2 = 52.'),
            skriv('Vilket tal är 10 mer än 38?', _svar(38 + 10),
                  'Tio mer är ett tiotal till. Tiotalen går från 3 till 4, så det blir 48.'),
            val('Vilket tal är störst?',
                [71, 17, 69, 70], max(71, 17, 69, 70),
                'Titta först på tiotalen. 71 och 70 har 7 tiotal. 71 har ett ental mer.'),
            ordna('Ordna talen från minst till störst.', _tal_stigande([64, 29, 92, 46]),
                  forklaring='Titta på tiotalen först: 2, 4, 6 och 9 tiotal.'),
            skriv('Vilket tal kommer precis efter 59?', _svar(59 + 1),
                  'Efter 9 ental blir det ett nytt tiotal. 59 + 1 = 60.'),
            val('Räkna i tiotal: 30, 40, 50. Vilket tal kommer sedan?',
                [60, 51, 55, 70], 50 + 10,
                'Varje gång läggs ett tiotal till. 50 + 10 = 60.'),
        ], beskrivning='Tal upp till 100 delade i tiotal och ental.'),

        niva('ma-ak2-addition-1', 'Plus och minus till 100', 'Addition och subtraktion', [
            skriv('Vad är 30 + 40?', _svar(30 + 40),
                  '3 tiotal och 4 tiotal blir 7 tiotal, alltså 70.'),
            val('Vad är 45 + 23?',
                [68, 58, 78, 22], 45 + 23,
                '40 + 20 = 60 och 5 + 3 = 8. 60 + 8 = 68.'),
            skriv('Vad är 86 − 34?', _svar(86 - 34),
                  '80 − 30 = 50 och 6 − 4 = 2. 50 + 2 = 52.'),
            val('Vad är 38 + 7?',
                [45, 35, 44, 46], 38 + 7,
                '38 + 2 = 40. Sedan 5 till: 40 + 5 = 45.'),
            val('Vad är 52 − 8?',
                [44, 46, 56, 34], 52 - 8,
                '52 − 2 = 50. Sedan 6 till: 50 − 6 = 44.'),
            skriv('Ella har 50 kronor. Hon köper en bok för 35 kronor. Hur många kronor har hon kvar?',
                  _svar(50 - 35, 'kronor'),
                  'Räkna upp från 35: 5 till 40 och 10 till 50. 5 + 10 = 15.'),
            ordna('Ordna så att svaren går från minst till störst.',
                  _stigande([('60 − 20', 60 - 20), ('25 + 25', 25 + 25), ('20 + 15', 20 + 15)]),
                  forklaring='20 + 15 = 35, 60 − 20 = 40 och 25 + 25 = 50.'),
            val('64 + ? = 100. Vilket tal fattas?',
                [36, 46, 34, 44], 100 - 64,
                'Från 64 till 70 är 6. Från 70 till 100 är 30. 6 + 30 = 36.'),
        ], beskrivning='Plus och minus med tiotal och ental, med svar upp till 100.'),

        niva('ma-ak2-tid-1', 'Hel och halv timme', 'Tid', [
            val('Klockan är 3:30. Hur säger man det?',
                ['halv fyra', 'halv tre', 'klockan tre', 'klockan fyra'], 'halv fyra',
                'Halv fyra betyder en halvtimme kvar tills klockan är fyra. Det är 3:30.'),
            val('Klockan är halv sju. Hur skriver man det med siffror?',
                ['6:30', '7:30', '6:00', '7:00'], '6:30',
                'Halv sju är en halvtimme innan klockan sju. Det är 6:30.'),
            skriv('Hur många minuter är en timme?', _svar(60, 'minuter'),
                  'En timme är 60 minuter.'),
            skriv('Hur många minuter är en halvtimme?', _svar(60 // 2, 'minuter'),
                  'En halvtimme är hälften av en timme. Hälften av 60 är 30.'),
            val('Klockan är 8:00. Hur säger man det?',
                ['klockan åtta', 'halv åtta', 'halv nio'], 'klockan åtta',
                'När minuterna är 00 är det hel timme. 8:00 är klockan åtta.'),
            val('Klockan är halv tolv. Vad är klockan en halvtimme senare?',
                ['12:00', '11:00', '12:30'], '12:00',
                'Halv tolv är 11:30. En halvtimme till blir 12:00, alltså klockan tolv.'),
            skriv('Kalaset börjar klockan 2 och slutar klockan 5. Hur många timmar håller det på?',
                  _svar(5 - 2, 'timmar'),
                  'Räkna timmarna: från 2 till 3, från 3 till 4 och från 4 till 5. Det är 3 timmar.'),
            ordna('Ordna tiderna från tidigast till senast.',
                  ['halv två', 'klockan två', 'halv tre', 'klockan tre'],
                  forklaring='Halv två är 1:30. Sedan kommer 2:00, halv tre är 2:30 och sist 3:00.'),
        ], beskrivning='Klockan vid hel och halv timme, i ord och med siffror.'),

        niva('ma-ak2-matning-1', 'Kronor och längd', 'Mätning', [
            skriv('Du har två femmor och en enkrona. Hur många kronor har du?', _svar(5 + 5 + 1, 'kronor'),
                  'En femma är 5 kronor och en enkrona är 1 krona. 5 + 5 + 1 = 11.'),
            val('En banan kostar 7 kronor. Du betalar med en tia. Hur många kronor får du tillbaka?',
                [3, 7, 17, 4], 10 - 7,
                'En tia är 10 kronor. 10 − 7 = 3.'),
            val('Vilket är längst?',
                ['1 m', '90 cm', '50 cm', '99 cm'], '1 m',
                '1 meter är 100 centimeter. Det är mer än 99 centimeter.'),
            skriv('Hur många centimeter är 1 meter?', _svar(100, 'centimeter'),
                  'En meter är 100 centimeter.'),
            val('Vilken sak är ungefär 2 meter hög?',
                ['en dörr', 'en kopp', 'en sko', 'en tandborste'], 'en dörr',
                'En vuxen kan gå rakt in genom en dörr, så den är ungefär 2 meter hög. De andra sakerna är mycket mindre.'),
            skriv('Ett band är 50 cm långt. Ett annat band är 30 cm långt. Hur många centimeter är de tillsammans?',
                  _svar(50 + 30, 'centimeter'),
                  'Lägg ihop längderna: 50 + 30 = 80.'),
            val('Vad är mest pengar?',
                ['två tior', 'en tia och en femma', 'sju enkronor'], 'två tior',
                'Två tior är 10 + 10 = 20 kronor. En tia och en femma är 15 kronor, och sju enkronor är 7.'),
            ordna('Ordna från kortast till längst.',
                  _stigande([('1 m', 100), ('30 cm', 30), ('2 m', 200), ('70 cm', 70)]),
                  forklaring='1 m är 100 cm och 2 m är 200 cm. Därför kommer 30 cm och 70 cm först.'),
        ], beskrivning='Att räkna med kronor och att jämföra längder i centimeter och meter.'),
    ]),

    bana('Matematik', 'ak3', [
        niva('ma-ak3-tal-1', 'Tal till 1000', 'Taluppfattning', [
            val('Hur många hundratal finns i talet 572?',
                [5, 7, 2, 500], 572 // 100,
                'Talet 572 är 500 + 70 + 2. 500 är 5 hundratal.'),
            val('Vilket tal är 3 hundratal, 0 tiotal och 8 ental?',
                [308, 38, 380, 3008], 3 * 100 + 0 * 10 + 8,
                '3 hundratal är 300. Inga tiotal och 8 ental ger 308. Nollan håller platsen för tiotalen.'),
            skriv('Vilket tal är 100 mer än 460?', _svar(460 + 100),
                  'Hundra mer är ett hundratal till. Hundratalen går från 4 till 5, så det blir 560.'),
            skriv('Vilket tal kommer precis efter 399?', _svar(399 + 1),
                  'Efter 399 är både entalen och tiotalen fulla. Då blir det ett nytt hundratal: 400.'),
            val('Vilket tal är störst?',
                [709, 790, 97, 779], max(709, 790, 97, 779),
                '97 har inga hundratal. De andra har 7 hundratal, och då jämför man tiotalen. 790 har flest, 9 tiotal.'),
            ordna('Ordna talen från minst till störst.', _tal_stigande([481, 814, 189, 418]),
                  forklaring='Titta först på hundratalen. 418 och 481 har båda 4 hundratal, men 418 har färre tiotal.'),
            skriv('Skriv talet sexhundratjugo med siffror.', tal(600 + 20),
                  'Sexhundra är 600 och tjugo är 20. 600 + 20 = 620.'),
            val('Vilket tal är 10 mindre än 305?',
                [295, 205, 300, 315], 305 - 10,
                'Ta först bort 5, då blir det 300. Sedan 5 till: 300 − 5 = 295.'),
        ], beskrivning='Tal upp till 1000 med hundratal, tiotal och ental.'),

        niva('ma-ak3-multiplikation-1', '2:an, 5:an och 10:an', 'Multiplikation', [
            skriv('Vad är 5 · 3?', _svar(5 * 3),
                  '5 · 3 är tre femmor: 5 + 5 + 5 = 15.'),
            val('Vad är 2 · 8?',
                [16, 10, 28, 18], 2 * 8,
                '2 · 8 är dubbelt så mycket som 8. 8 + 8 = 16.'),
            skriv('Vad är 10 · 7?', _svar(10 * 7),
                  '10 · 7 är sju tiotal, alltså 70.'),
            val('Det finns 4 påsar med 5 äpplen i varje. Hur många äpplen är det?',
                [20, 9, 15, 25], 4 * 5,
                '4 påsar med 5 i varje är 4 · 5. 5 + 5 + 5 + 5 = 20.'),
            val('Vilket tal finns INTE i 5:ans tabell?',
                [12, 15, 20, 35], 12,
                'Talen i 5:ans tabell slutar alltid på 0 eller 5. 12 slutar på 2.'),
            ordna('Ordna så att svaren går från minst till störst.',
                  _stigande([('10 · 3', 10 * 3), ('2 · 3', 2 * 3), ('2 · 9', 2 * 9), ('5 · 2', 5 * 2)]),
                  forklaring='2 · 3 = 6, 5 · 2 = 10, 2 · 9 = 18 och 10 · 3 = 30.'),
            skriv('En hand har 5 fingrar. Hur många fingrar har 6 händer?', _svar(6 * 5, 'fingrar'),
                  'Det är sex femmor: 6 · 5 = 30.'),
            val('Vilken uppgift har samma svar som 5 · 4?',
                ['4 · 5', '5 + 4', '5 · 5', '4 + 4'], '4 · 5',
                'Man kan byta plats på talen när man multiplicerar. 5 · 4 och 4 · 5 blir båda 20.'),
        ], beskrivning='Multiplikation som upprepad addition, med 2:ans, 5:ans och 10:ans tabell.'),

        niva('ma-ak3-division-1', 'Dela lika', 'Division', [
            skriv('12 kulor delas lika mellan 3 barn. Hur många kulor får varje barn?', _svar(12 // 3, 'kulor'),
                  'Dela ut en kula i taget till de 3 barnen. Varje barn får 4, för 3 · 4 = 12.'),
            val('Vad är 10 / 2?',
                [5, 8, 12, 20], 10 // 2,
                'Delar man 10 i två lika delar blir varje del 5, för 5 + 5 = 10.'),
            val('20 äpplen läggs i påsar med 5 äpplen i varje. Hur många påsar blir det?',
                [4, 5, 15, 25], 20 // 5,
                'Räkna femmor tills du når 20: 5, 10, 15, 20. Det är 4 påsar.'),
            skriv('Vad är 18 / 2?', _svar(18 // 2),
                  'Hälften av 18 är 9, för 9 + 9 = 18.'),
            val('Tre kompisar delar 15 kronor lika. Hur många kronor får var och en?',
                [5, 3, 12, 18], 15 // 3,
                '15 / 3 = 5, för 3 · 5 = 15.'),
            skriv('Vad är hälften av 30?', _svar(30 // 2),
                  'Hälften är att dela i två lika delar. 15 + 15 = 30.'),
            ordna('Ordna så att svaren går från minst till störst.',
                  _stigande([('40 / 5', 40 // 5), ('8 / 2', 8 // 2), ('50 / 5', 50 // 5), ('30 / 5', 30 // 5)]),
                  forklaring='8 / 2 = 4, 30 / 5 = 6, 40 / 5 = 8 och 50 / 5 = 10.'),
            val('Vad är 35 / 5? Tänk på 5:ans tabell.',
                [7, 6, 30, 8], 35 // 5,
                '5 · 7 = 35. Därför ryms 5 sju gånger i 35, och 35 / 5 = 7.'),
        ], beskrivning='Division som att dela lika och att se hur många grupper det blir.'),

        niva('ma-ak3-tid-1', 'Kvart över och kvart i', 'Tid', [
            val('Klockan är 3:15. Hur säger man det?',
                ['kvart över tre', 'kvart i tre', 'kvart över fyra', 'kvart i fyra'], 'kvart över tre',
                'En kvart är 15 minuter. 3:15 är 15 minuter efter tre, alltså kvart över tre.'),
            val('Klockan är kvart i sju. Hur skriver man det med siffror?',
                ['6:45', '7:45', '7:15', '6:15'], '6:45',
                'Kvart i sju är 15 minuter innan klockan sju. Det är 6:45.'),
            skriv('Hur många minuter är en kvart?', _svar(60 // 4, 'minuter'),
                  'En kvart är en fjärdedel av en timme. 60 minuter delat i fyra lika delar är 15.'),
            skriv('Hur många minuter är tre kvart?', _svar(3 * 15, 'minuter'),
                  'En kvart är 15 minuter. 15 + 15 + 15 = 45.'),
            val('Klockan är 9:10. Hur säger man det?',
                ['tio över nio', 'tio i nio', 'tio över tio', 'tio i tio'], 'tio över nio',
                '9:10 är 10 minuter efter klockan nio, alltså tio över nio.'),
            val('Klockan är 2:50. Hur säger man det?',
                ['tio i tre', 'tio över två', 'tio i två', 'tio över tre'], 'tio i tre',
                'Det är 10 minuter kvar tills klockan är tre. Därför säger man tio i tre.'),
            skriv('Ett tåg åker 10:15 och kommer fram 10:45. Hur många minuter tar resan?', _svar(45 - 15, 'minuter'),
                  'Räkna minuterna: 45 − 15 = 30. Det är en halvtimme.'),
            ordna('Ordna tiderna från tidigast till senast.',
                  ['klockan fyra', 'kvart över fyra', 'halv fem', 'kvart i fem'],
                  forklaring='Klockan fyra är 4:00, kvart över fyra är 4:15, halv fem är 4:30 och kvart i fem är 4:45.'),
        ], beskrivning='Klockan vid kvart över, kvart i och några minuter före och efter hel timme.'),
    ]),
]
