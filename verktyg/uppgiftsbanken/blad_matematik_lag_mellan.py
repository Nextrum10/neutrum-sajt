# -*- coding: utf-8 -*-
"""Matematikbladen i materialbanken för åk 1–6 som NexLäx-nivåer (2026-10-03).

Varje nivå bygger på ett övningsblad i verktyg/bladen/ (lagstadiet.py,
mellanstadiet.py och np_ak6.py) och dess facit, omskrivet till frågor en
maskin kan rätta. Bladens figurer finns inte i NexLäx: talen står i frågan.
Klockslag frågas bara som val, för rättningen läser "19.20" som ett tal.

Nivåerna läggs sist i de banor som redan står i matematik_lag.py och
matematik_mellan.py (TILLAGG), i egna områden. Varje facit räknas ut här,
och varje "vilken av dessa" prövar att exakt ett alternativ stämmer.
"""
from fractions import Fraction as F

from grund import bana, niva, val, skriv, ordna, sant, para, tal


def t(x):
    """Talet som svar: decimalkomma och '-' för minus."""
    x = F(x) if not isinstance(x, (int, float)) else x
    if isinstance(x, F):
        x = int(x) if x.denominator == 1 else float(x)
    return tal(x)


def m(x):
    """Talet i en text eller bland alternativen, med riktigt minustecken."""
    return t(x).replace('-', '−')


def d(s):
    """Svensk text till ett exakt tal: '0,35' → 35/100, '−4' → -4, '3/4' → 3/4."""
    return F(s.replace(',', '.').replace('−', '-').replace(' %', '/100').replace('%', '/100')
             .replace(' ', ''))


def svar(x):
    """Ett tal som skriv-facit, också med mellanslag efter minustecknet."""
    s = t(x)
    return [s, '- ' + s[1:]] if s.startswith('-') else [s]


def x_svar(v, var='x'):
    s = t(v)
    return [s, '%s = %s' % (var, s), '%s=%s' % (var, s), '%s= %s' % (var, s), '%s =%s' % (var, s)]


def brak(a, b):
    """Ett bråk som skriv-facit: 3/8 och 3 / 8."""
    return ['%d/%d' % (a, b), '%d / %d' % (a, b)]


def enda(alternativ, prov):
    traffar = [a for a in alternativ if prov(a)]
    assert len(traffar) == 1, 'väntade ett rätt alternativ i %r, fick %r' % (alternativ, traffar)
    return traffar[0]


def ordna_tal(fraga, par, forklaring):
    """Brickor från minst till störst, ordnade ur sina värden."""
    varden = [v for _, v in par]
    assert len(set(varden)) == len(varden), fraga
    return ordna(fraga, [text for text, _ in sorted(par, key=lambda p: p[1])], forklaring=forklaring)


def tecken(a, b):
    return '<' if a < b else '>' if a > b else '='


def summa(text):
    """'5 kr + 2 kr + 1 kr' → 8."""
    return sum(int(s.replace('kr', '').strip()) for s in text.split('+'))


def blad(vad, titel):
    return '%s Bygger på övningsbladet «%s» i materialbanken.' % (vad, titel)


TECKEN = ['<', '>', '=']

# ===================================================================== åk 1

AK1_TIOKAMRATER = niva('ma-ak1-blad-tiokamrater-1', 'Tiokamrater', 'Räkna och jämföra tal', [
    skriv('Vilket tal fattas? 7 + ? = 10', t(10 - 7), '7 och 3 är tiokamrater: 7 + 3 = 10.'),
    skriv('Vilket tal fattas? 3 + ? = 10', t(10 - 3), '3 och 7 är tiokamrater: 3 + 7 = 10.'),
    skriv('Vilket tal fattas? ? + 5 = 10', t(10 - 5), 'Fem och fem blir tio. 5 är sin egen tiokamrat.'),
    skriv('Vilket tal fattas? 9 + ? = 10', t(10 - 9), '9 behöver bara ett steg till för att bli 10.'),
    skriv('Vilket tal fattas? ? + 4 = 10', t(10 - 4), '6 + 4 = 10. Räkna från 4 upp till 10: det är 6 steg.'),
    skriv('Vilket tal fattas? 10 = 8 + ?', t(10 - 8), 'Likhetstecknet betyder att båda sidor är lika mycket. 8 + 2 = 10.'),
    val('Vilka två tal är tiokamrater?', ['6 och 4', '6 och 3', '5 och 4'],
        enda(['6 och 4', '6 och 3', '5 och 4'], lambda a: sum(int(x) for x in a.split(' och ')) == 10),
        'Tiokamrater blir 10 tillsammans: 6 + 4 = 10, men 6 + 3 och 5 + 4 blir bara 9.'),
    sant('3 och 8 är tiokamrater.', 3 + 8 == 10, '3 + 8 = 11, ett för mycket. 3 och 7 är tiokamrater.'),
    skriv('Du ritar 10 prickar och ringar in 4 av dem. Hur många prickar är inte inringade?', t(10 - 4),
          '10 − 4 = 6. 4 och 6 är tiokamrater.'),
], beskrivning=blad('Talen som tillsammans blir 10.', 'Tiokamrater'))

AK1_PLUS_MINUS = niva('ma-ak1-blad-plus-minus-1', 'Plus och minus upp till 20', 'Räkna och jämföra tal', [
    skriv('Räkna: 8 + 5', t(8 + 5), '8 + 2 = 10, och 3 till blir 13.'),
    skriv('Räkna: 9 + 7', t(9 + 7), '9 + 1 = 10, och 6 till blir 16.'),
    skriv('Räkna: 6 + 6', t(6 + 6), 'Dubbelt så mycket som 6 är 12.'),
    skriv('Räkna: 12 + 4', t(12 + 4), 'Entalen: 2 + 4 = 6, och tiotalet är kvar. Det blir 16.'),
    skriv('Räkna: 15 − 3', t(15 - 3), 'Ta bort 3 från entalen: 5 − 3 = 2. Det blir 12.'),
    skriv('Räkna: 13 − 6', t(13 - 6), '13 − 3 = 10, och 3 till bort blir 7.'),
    skriv('Räkna: 17 − 9', t(17 - 9), '17 − 7 = 10, och 2 till bort blir 8.'),
    skriv('Räkna: 20 − 8', t(20 - 8), '20 − 10 = 10, men du tog bort 2 för mycket. 10 + 2 = 12.'),
    skriv('Mia har 9 äpplen. Hon får 4 till. Hur många äpplen har hon nu?', t(9 + 4),
          'Hon får fler, så det är plus: 9 + 4 = 13.'),
    skriv('Det sitter 14 fåglar i ett träd. 5 flyger iväg. Hur många fåglar är kvar?', t(14 - 5),
          'Det blir färre, så det är minus: 14 − 5 = 9.'),
], beskrivning=blad('Addition och subtraktion med tal upp till 20.', 'Plus och minus upp till 20'))

AK1_STORRE = niva('ma-ak1-blad-storre-mindre-1', 'Större än, mindre än och talföljder', 'Räkna och jämföra tal', [
    val('Vilket tecken ska stå där frågetecknet står? 12 ? 9', TECKEN, tecken(12, 9),
        '12 är större än 9. Den öppna sidan av tecknet vänder sig mot det större talet: 12 > 9.'),
    val('Vilket tecken ska stå där frågetecknet står? 5 ? 8', TECKEN, tecken(5, 8),
        '5 är mindre än 8. Den spetsiga sidan pekar mot det mindre talet: 5 < 8.'),
    val('Vilket tecken ska stå där frågetecknet står? 6 + 2 ? 8', TECKEN, tecken(6 + 2, 8),
        '6 + 2 = 8, så båda sidor är lika mycket.'),
    val('Vilket tecken ska stå där frågetecknet står? 10 ? 7 + 2', TECKEN, tecken(10, 7 + 2),
        '7 + 2 = 9, och 10 är större än 9.'),
    val('Vilka två tal kommer sedan? 2, 4, 6, 8, …', ['10 och 12', '9 och 10', '10 och 14'], '10 och 12',
        'Talen blir två mer varje gång: 8 + 2 = 10 och 10 + 2 = 12.'),
    val('Vilka två tal kommer sedan? 5, 10, 15, 20, …', ['25 och 30', '21 och 22', '30 och 40'], '25 och 30',
        'Talen blir fem mer varje gång: 20 + 5 = 25 och 25 + 5 = 30.'),
    val('Vilka två tal kommer sedan? 20, 18, 16, 14, …', ['12 och 10', '16 och 18', '13 och 12'], '12 och 10',
        'Talen blir två mindre varje gång: 14 − 2 = 12 och 12 − 2 = 10.'),
    skriv('Vilket tal fattas? 11, 12, ?, 14, 15', t(13), 'Talen ökar med ett: efter 12 kommer 13.'),
    skriv('Vilket tal kommer närmast före 30?', t(30 - 1), 'Talet före är ett mindre: 30 − 1 = 29.'),
    skriv('Vilket tal kommer närmast efter 49?', t(49 + 1), 'Efter 49 kommer ett nytt tiotal: 49 + 1 = 50.'),
], beskrivning=blad('Jämför tal med <, > och =, och fortsätt talföljder.', 'Större än, mindre än och talföljder'))

# ===================================================================== åk 2

TIOTAL_62 = ['6 tiotal och 2 ental', '2 tiotal och 6 ental', '62 tiotal och 0 ental']
PRICKAR_23 = ['2 tiotal och 3 ental', '3 tiotal och 2 ental', '23 tiotal och 0 ental']

AK2_TIOTAL = niva('ma-ak2-blad-tiotal-ental-1', 'Tiotal och ental', 'Tiotal, klockan och pengar', [
    val('Hur många tiotal och ental är det i talet 62?', TIOTAL_62,
        enda(TIOTAL_62, lambda a: 10 * int(a.split()[0]) + int(a.split()[3]) == 62),
        'Den första siffran är tiotalen och den andra entalen: 62 = 60 + 2.'),
    skriv('Hur många tiotal finns det i talet 85?', t(85 // 10), '85 = 80 + 5, och 80 är 8 tiotal.'),
    skriv('Vilket tal fattas? 34 = ? + 4', t(34 - 4), '34 är 3 tiotal och 4 ental, alltså 30 + 4.'),
    skriv('Räkna: 70 + 9', t(70 + 9), '7 tiotal och 9 ental skrivs 79.'),
    skriv('Vilket tal är 5 tiotal och 3 ental?', t(5 * 10 + 3), '5 tiotal är 50, och 50 + 3 = 53.'),
    skriv('Vilket tal är 10 mer än 36?', t(36 + 10), 'Tio mer ändrar bara tiotalen: 3 tiotal blir 4. Det blir 46.'),
    skriv('Vilket tal är 10 mindre än 52?', t(52 - 10), 'Tio mindre ändrar bara tiotalen: 5 tiotal blir 4. Det blir 42.'),
    skriv('Räkna: 40 + 30', t(40 + 30), '4 tiotal och 3 tiotal blir 7 tiotal, alltså 70.'),
    ordna_tal('Ordna talen, minst först.', [(s, int(s)) for s in ['48', '84', '38', '83']],
              'Titta först på tiotalen: 3 är minst och 8 störst. Är tiotalen lika, jämför entalen: 83 < 84.'),
    val('Du ritar 23 prickar och ringar in tio åt gången. Hur många tiotal och ental blir det?', PRICKAR_23,
        PRICKAR_23[0], 'Två ringar med tio prickar är 2 tiotal, och 3 prickar blir över: 23 = 20 + 3.'),
], beskrivning=blad('Dela upp tal till 100 i tiotal och ental.', 'Tiotal och ental'))

AK2_KLOCKAN = niva('ma-ak2-blad-klockan-1', 'Hel och halv timme', 'Tiotal, klockan och pengar', [
    val('Den långa visaren pekar på 12 och den korta på 4. Vad är klockan?', ['4.00', '12.04', '4.30'], '4.00',
        'När den långa visaren pekar på 12 är klockan hel. Den korta visar timmen: fyra.'),
    val('Den långa visaren pekar på 6 och den korta står mitt emellan 2 och 3. Vad är klockan?',
        ['2.30', '3.30', '6.30'], '2.30',
        'Den långa på 6 betyder halv. Den korta har gått halvvägs från 2 mot 3: halv tre, 2.30.'),
    val('Hur skriver man halv nio med siffror?', ['8.30', '9.30', '9.00'], '8.30',
        'Halv nio är en halvtimme innan klockan blir nio, alltså 8.30.'),
    val('Klockan är 11.30. Hur säger man det?', ['halv tolv', 'halv elva', 'elva'], 'halv tolv',
        '11.30 är halvvägs mellan elva och tolv. Vi säger halv till nästa timme: halv tolv.'),
    val('Du ska ställa klockan på sju. Var ska den långa visaren peka?', ['På 12', 'På 7', 'På 6'], 'På 12',
        'Vid en hel timme pekar den långa visaren på 12. Den korta pekar på 7.'),
    val('Du ska ställa klockan på halv fem. Var ska den långa visaren peka?', ['På 6', 'På 12', 'På 5'], 'På 6',
        'Vid halv pekar den långa visaren på 6, och den korta står mitt emellan 4 och 5.'),
    val('Klockan är 3.00. Vad är klockan om en timme?', ['4.00', '3.30', '2.00'], '4.00',
        'En timme senare har den korta visaren gått ett steg framåt, från 3 till 4.'),
    val('Klockan är 3.00. Vad var klockan för en timme sedan?', ['2.00', '4.00', '3.30'], '2.00',
        'En timme tidigare stod den korta visaren ett steg bakåt, på 2.'),
    sant('På en klocka med visare visar den korta visaren minuterna.', False,
         'Det är tvärtom: den korta visaren visar timmen och den långa minuterna.'),
], beskrivning=blad('Läs och ställ klockan på hel och halv timme.', 'Klockan – hel och halv timme'))

TIO_KR = ['5 kr + 2 kr + 2 kr + 1 kr', '5 kr + 2 kr + 2 kr', '2 kr + 2 kr + 2 kr + 2 kr']
TOLV_KR = ['10 kr + 2 kr', '5 kr + 5 kr + 1 kr', '10 kr + 1 kr']

AK2_PENGAR = niva('ma-ak2-blad-pengar-1', 'Mynt och sedlar', 'Tiotal, klockan och pengar', [
    skriv('Hur mycket är 5 kr + 2 kr + 1 kr?', t(5 + 2 + 1), '5 + 2 = 7 och 7 + 1 = 8. Det blir 8 kr.'),
    skriv('Hur mycket är 10 kr + 10 kr + 5 kr?', t(10 + 10 + 5), 'Två tiokronor är 20 kr, och 5 kr till blir 25 kr.'),
    skriv('Hur mycket är 20 kr + 5 kr + 5 kr?', t(20 + 5 + 5), 'Två femkronor är 10 kr, och 20 + 10 = 30 kr.'),
    skriv('Du har 3 tvåkronor och 1 femkrona. Hur många kronor har du?', t(3 * 2 + 5),
          'Tre tvåkronor är 2 + 2 + 2 = 6 kr, och 6 + 5 = 11 kr.'),
    skriv('En bulle kostar 7 kr. Du betalar med en tiokrona. Hur många kronor får du tillbaka?', t(10 - 7),
          'Du betalar mer än bullen kostar. Skillnaden är 10 − 7 = 3 kr.'),
    skriv('En glass kostar 15 kr. Du betalar med 20 kr. Hur många kronor får du tillbaka?', t(20 - 15),
          'Räkna från 15 upp till 20: det är 5 kr.'),
    skriv('En penna kostar 8 kr och ett suddgummi 6 kr. Hur många kronor kostar de tillsammans?', t(8 + 6),
          'Tillsammans betyder plus: 8 + 6 = 14 kr.'),
    skriv('Du har 50 kr och köper en bok för 30 kr. Hur många kronor har du kvar?', t(50 - 30),
          '5 tiotal minus 3 tiotal är 2 tiotal: 50 − 30 = 20 kr.'),
    val('Vilka mynt blir tillsammans exakt 10 kr?', TIO_KR, enda(TIO_KR, lambda a: summa(a) == 10),
        '5 + 2 + 2 + 1 = 10. De andra blir 9 kr och 8 kr.'),
    val('Vilka mynt blir tillsammans exakt 12 kr?', TOLV_KR, enda(TOLV_KR, lambda a: summa(a) == 12),
        '10 + 2 = 12. De andra blir bara 11 kr.'),
], beskrivning=blad('Räkna med svenska mynt och sedlar och räkna ut växel.', 'Pengar – mynt och sedlar'))

# ===================================================================== åk 3

HOR_IHOP_21 = ['3 · 7 = 21', '21 − 3 = 18', '7 + 3 = 10']
BERATTELSE_8 = ['8 bullar delas lika mellan 2 barn, och varje barn får 4 bullar.',
                '8 bullar och 2 bullar till läggs på ett fat, och det blir 10 bullar.',
                '2 barn har 4 bullar var, och de äter upp 2 av bullarna tillsammans.']

AK3_MULTIPLIKATION = niva('ma-ak3-blad-multiplikation-1', 'Gånger 2, 5 och 10', 'Gånger och delat', [
    skriv('Räkna: 4 · 2', t(4 * 2), '4 · 2 betyder 2 + 2 + 2 + 2 = 8.'),
    skriv('Räkna: 6 · 5', t(6 * 5), 'Räkna femsteg sex gånger: 5, 10, 15, 20, 25, 30.'),
    skriv('Räkna: 3 · 10', t(3 * 10), 'Tre tiotal är 30.'),
    skriv('Räkna: 7 · 2', t(7 * 2), 'Gånger 2 är dubbelt: dubbelt så mycket som 7 är 14.'),
    skriv('Räkna: 9 · 5', t(9 * 5), '10 · 5 = 50, och en femma mindre är 45.'),
    skriv('Räkna: 8 · 10', t(8 * 10), 'Gånger 10: 8 tiotal är 80.'),
    skriv('Vilket tal fattas? ? · 5 = 35', t(35 // 5), 'Räkna femsteg tills du kommer till 35: det är 7 steg. 7 · 5 = 35.'),
    skriv('Vilket tal fattas? ? · 2 = 18', t(18 // 2), 'Hälften av 18 är 9, för 9 · 2 = 18.'),
    skriv('Ett paket har 5 kakor. Hur många kakor finns det i 6 paket?', t(6 * 5),
          'Sex paket med 5 i varje: 6 · 5 = 30 kakor.'),
    skriv('Lisa har 4 tiokronor. Hur många kronor har hon?', t(4 * 10), 'Fyra tiokronor: 4 · 10 = 40 kr.'),
], beskrivning=blad('Multiplikationstabellerna för 2, 5 och 10.', 'Multiplikation med 2, 5 och 10'))

AK3_DIVISION = niva('ma-ak3-blad-division-1', 'Dela lika', 'Gånger och delat', [
    skriv('Räkna: 10 : 2', t(10 // 2), '5 · 2 = 10, så 10 delat i 2 lika delar är 5.'),
    skriv('Räkna: 15 : 5', t(15 // 5), '3 · 5 = 15, så 15 : 5 = 3.'),
    skriv('Räkna: 20 : 4', t(20 // 4), '5 · 4 = 20, så 20 : 4 = 5.'),
    skriv('Räkna: 18 : 3', t(18 // 3), '6 · 3 = 18, så 18 : 3 = 6.'),
    skriv('Räkna: 30 : 10', t(30 // 10), '30 är 3 tiotal, så 30 : 10 = 3.'),
    skriv('Räkna: 16 : 2', t(16 // 2), 'Hälften av 16 är 8, för 8 + 8 = 16.'),
    skriv('12 kex delas lika mellan 4 barn. Hur många kex får varje barn?', t(12 // 4),
          'Dela lika betyder division: 12 : 4 = 3, för 3 · 4 = 12.'),
    skriv('20 elever delas in i grupper med 5 elever i varje. Hur många grupper blir det?', t(20 // 5),
          'Hur många femmor ryms i 20? 20 : 5 = 4 grupper.'),
    val('Vilken multiplikation hör ihop med 21 : 3 = 7?', HOR_IHOP_21,
        enda(HOR_IHOP_21, lambda a: '·' in a),
        'Division är multiplikation baklänges: 21 : 3 = 7 eftersom 3 · 7 = 21.'),
    val('Vilken berättelse passar till 8 : 2 = 4?', BERATTELSE_8, BERATTELSE_8[0],
        '8 : 2 betyder att 8 saker delas lika i 2 delar. Varje del får 4.'),
], beskrivning=blad('Division som att dela lika, och hur den hör ihop med multiplikation.', 'Division – dela lika'))

VAXLA_14 = ['Du skriver 4 bland entalen och växlar 1 tiotal.',
            'Du skriver 14 bland entalen och växlar inget.',
            'Du skriver 1 bland entalen och växlar 4 tiotal.']

AK3_VAXLING = niva('ma-ak3-blad-vaxling-1', 'Plus och minus med växling', 'Växla och mäta', [
    skriv('Räkna: 46 + 38', t(46 + 38), 'Ental: 6 + 8 = 14, skriv 4 och växla 1 tiotal. Tiotal: 4 + 3 + 1 = 8. Det blir 84.'),
    skriv('Räkna: 127 + 85', t(127 + 85), 'Ental: 7 + 5 = 12, växla. Tiotal: 2 + 8 + 1 = 11, växla. Hundratal: 1 + 1 = 2. Det blir 212.'),
    skriv('Räkna: 264 + 359', t(264 + 359), 'Ental: 4 + 9 = 13, växla. Tiotal: 6 + 5 + 1 = 12, växla. Hundratal: 2 + 3 + 1 = 6. Det blir 623.'),
    skriv('Räkna: 73 − 28', t(73 - 28), '3 − 8 går inte: växla ett tiotal. 13 − 8 = 5 och 6 − 2 = 4. Det blir 45.'),
    skriv('Räkna: 152 − 67', t(152 - 67), 'Växla ett tiotal: 12 − 7 = 5. Växla ett hundratal: 14 − 6 = 8. Det blir 85.'),
    skriv('Räkna: 400 − 143', t(400 - 143), '400 är 3 hundratal, 9 tiotal och 10 ental. 10 − 3 = 7, 9 − 4 = 5 och 3 − 1 = 2. Det blir 257.'),
    skriv('Det finns 235 böcker i skolbiblioteket. Det kommer 118 nya. Hur många böcker finns det nu?', t(235 + 118),
          'Fler böcker betyder plus: 235 + 118 = 353.'),
    skriv('Farmor har 500 kr. Hon köper en jacka för 285 kr. Hur många kronor har hon kvar?', t(500 - 285),
          'Kvar betyder minus: 500 − 285 = 215. Kontroll: 285 + 215 = 500.'),
    val('Du räknar 46 + 38 med uppställning. Entalen blir 6 + 8 = 14. Vad gör du med 14?', VAXLA_14, VAXLA_14[0],
        'Bara en siffra får stå bland entalen. 14 är 1 tiotal och 4 ental, så tiotalet flyttas till tiotalen.'),
], beskrivning=blad('Addition och subtraktion med uppställning och växling, med tal upp till 1 000.',
                    'Addition och subtraktion med växling'))

PENNA = ['15 cm', '15 dm', '15 m']
DORR = ['2 cm', '2 dm', '2 m']

AK3_LANGD = niva('ma-ak3-blad-langd-1', 'Längd i cm, dm och m', 'Växla och mäta', [
    skriv('Hur många centimeter är 1 meter?', t(100), '1 m = 10 dm, och varje dm är 10 cm: 10 · 10 = 100 cm.'),
    skriv('Hur många centimeter är 3 decimeter?', t(3 * 10), '1 dm = 10 cm, så 3 dm = 30 cm.'),
    skriv('Hur många decimeter är 2 meter?', t(2 * 10), '1 m = 10 dm, så 2 m = 20 dm.'),
    skriv('Hur många decimeter är 50 centimeter?', t(50 // 10), '10 cm är 1 dm, och 50 cm är 5 sådana.'),
    skriv('Hur många millimeter är 1 centimeter?', t(10), '1 cm = 10 mm. Titta på linjalen: mellan två cm-streck finns tio små steg.'),
    val('Hur lång är en penna? Välj det mest rimliga.', PENNA, '15 cm',
        'En penna är ungefär lika lång som en hand. 15 dm är längre än en säng, och 15 m längre än ett hus.'),
    val('Hur hög är en dörr? Välj det mest rimliga.', DORR, '2 m',
        'En dörr är lite högre än en vuxen, ungefär 2 m. 2 dm är bara som en linjal.'),
    ordna_tal('Ordna längderna från kortast till längst.',
              [('1 m', 100), ('15 cm', 15), ('2 dm', 20), ('1 cm', 1)],
              'Gör om allt till cm: 1 m = 100 cm och 2 dm = 20 cm. Då blir ordningen 1, 15, 20 och 100.'),
    skriv('Sam är 128 cm lång och Eli är 135 cm lång. Hur många centimeter längre är Eli?', t(135 - 128),
          'Skillnaden är 135 − 128 = 7 cm. Räkna upp från 128: 2 steg till 130 och 5 till 135.'),
    skriv('Ett rep är 3 m långt. Du klipper av 85 cm. Hur många centimeter är repet nu?', t(300 - 85),
          'Gör om till samma enhet först: 3 m = 300 cm, och 300 − 85 = 215 cm.'),
], beskrivning=blad('Längdenheterna mm, cm, dm och m, rimliga längder och att räkna med längd.',
                    'Längd – cm, dm och m'))

# ===================================================================== åk 4

AK4_TABELLER = niva('ma-ak4-blad-tabeller-1', 'Tabellerna 3 till 9', 'Tabeller och tiondelar', [
    skriv('Räkna: 3 · 7', t(3 * 7), 'Räkna sjusteg tre gånger: 7, 14, 21.'),
    skriv('Räkna: 7 · 8', t(7 * 8), '7 · 8 = 56. Ett knep: 5, 6, 7, 8 som i 56 = 7 · 8.'),
    skriv('Räkna: 9 · 6', t(9 * 6), 'Knepet för 9:an: 10 · 6 = 60, minus 6 blir 54.'),
    skriv('Räkna: 8 · 9', t(8 * 9), '10 · 8 = 80, minus 8 blir 72.'),
    skriv('Vilket tal fattas? ? · 7 = 42', t(42 // 7), '6 · 7 = 42. Division är multiplikation baklänges: 42 : 7 = 6.'),
    skriv('Vilket tal fattas? 8 · ? = 72', t(72 // 8), '8 · 9 = 72, så det saknade talet är 9.'),
    skriv('Räkna: 54 : 6', t(54 // 6), 'Vilket tal gånger 6 blir 54? 9 · 6 = 54.'),
    skriv('Räkna: 63 : 7', t(63 // 7), '9 · 7 = 63, så 63 : 7 = 9.'),
    skriv('En ask innehåller 6 ägg. Hur många ägg är det i 7 askar?', t(7 * 6), 'Sju askar med 6 i varje: 7 · 6 = 42 ägg.'),
    skriv('48 elever delas in i lag med 6 elever i varje lag. Hur många lag blir det?', t(48 // 6),
          'Hur många sexor ryms i 48? 8 · 6 = 48, så det blir 8 lag.'),
], beskrivning=blad('Multiplikationstabellerna 3 till 9 och division som multiplikation baklänges.',
                    'Multiplikationstabellerna 3 till 9'))

NIO_TIONDELAR = ['9/10', '9/100', '1/9']

AK4_TIONDELAR = niva('ma-ak4-blad-tiondelar-1', 'Tiondelar och decimaltal', 'Tabeller och tiondelar', [
    skriv('Skriv 7/10 som decimaltal.', t(F(7, 10)), 'Sju tiondelar skrivs med 7 direkt efter kommat: 0,7.'),
    val('Vilket bråk är samma som 0,9?', NIO_TIONDELAR, enda(NIO_TIONDELAR, lambda a: d(a) == d('0,9')),
        'Siffran direkt efter kommat är tiondelar: 0,9 är nio tiondelar, 9/10.'),
    skriv('Vilket tal är störst, 0,6 eller 0,4?', t(max(d('0,6'), d('0,4'))), '6 tiondelar är mer än 4 tiondelar.'),
    skriv('En punkt på tallinjen ligger 3 tiondelar till höger om 0. Vilket decimaltal visar den?', t(F(3, 10)),
          'Tre tiondelar efter noll är 0,3.'),
    ordna_tal('Ordna talen, minst först.', [(s, d(s)) for s in ['0,5', '2,1', '1,9', '0,8']],
              'Jämför heltalen först: 0 är minst. Bland 0,5 och 0,8 är 5 tiondelar minst. 1,9 är mindre än 2,1.'),
    skriv('Räkna: 3,4 + 2,5', t(d('3,4') + d('2,5')), 'Heltal för sig och tiondelar för sig: 3 + 2 = 5 och 4 + 5 = 9 tiondelar. Det blir 5,9.'),
    skriv('Räkna: 1,5 + 0,7', t(d('1,5') + d('0,7')), '5 + 7 = 12 tiondelar, alltså 1 hel och 2 tiondelar. 1 + 1 + 0,2 = 2,2.'),
    skriv('Räkna: 4,0 − 1,6', t(d('4,0') - d('1,6')), '4,0 − 1 = 3,0, och 3,0 − 0,6 = 2,4.'),
    skriv('Ett paket mjöl väger 1,5 kg. Hur många kilo väger två paket?', t(2 * d('1,5')),
          '1,5 + 1,5: två halvor blir en hel, så det blir 3 kg.'),
    skriv('En stege är 2,4 m hög. Hur många decimeter är det?', t(d('2,4') * 10),
          'En decimeter är en tiondels meter. 2 m = 20 dm och 0,4 m = 4 dm, alltså 24 dm.'),
], beskrivning=blad('Tiondelar som decimaltal och bråk, att jämföra dem och att räkna med dem.',
                    'Tiondelar och decimaltal'))

# ===================================================================== åk 5

STORST_HALV = ['1/2', '1/4', 'De är lika stora']
VARFOR_HALV = ['Delar man samma helhet i 2 delar blir varje del större än om man delar den i 4 delar.',
               'Talet 4 är större än talet 2, och därför blir bråket 1/4 större än bråket 1/2.',
               'Båda bråken har täljaren 1, och därför är de alltid lika stora, hur man än delar.']
NAMNAREN = ['Hur många lika stora delar helheten är delad i.',
            'Hur många av de lika stora delarna vi menar.',
            'Hur stor helheten är innan den har delats.']

AK5_BRAK = niva('ma-ak5-blad-brak-1', 'En del av en helhet', 'Bråk, area och diagram', [
    val('En pizza är delad i 8 lika stora bitar. Du äter 3. Hur stor del av pizzan åt du?', ['3/8', '5/8', '8/3'], '3/8',
        'Nämnaren är antalet bitar, 8, och täljaren de du åt, 3.'),
    val('Vilket bråk är störst: 1/2 eller 1/4?', STORST_HALV, '1/2', '1/2 = 2/4, och 2/4 är mer än 1/4.'),
    val('Varför är 1/2 större än 1/4?', VARFOR_HALV, VARFOR_HALV[0],
        'Ju fler delar helheten delas i, desto mindre blir varje del. En halva är större än en fjärdedel.'),
    val('Vad visar nämnaren, talet under strecket, i ett bråk?', NAMNAREN, NAMNAREN[0],
        'Nämnaren namnger delarna: i 3/4 är helheten delad i fyra lika stora delar, fjärdedelar.'),
    skriv('Skriv 2/4 på det enklaste sättet, som ett bråk.', brak(1, 2), 'Dela täljare och nämnare med 2: 2/4 = 1/2.'),
    skriv('Hur mycket är 1/3 av 12?', t(12 // 3), 'En tredjedel får man genom att dela i 3 delar: 12 : 3 = 4.'),
    skriv('Hur mycket är 3/4 av 20?', t(20 // 4 * 3), 'En fjärdedel av 20 är 20 : 4 = 5. Tre fjärdedelar är 3 · 5 = 15.'),
    ordna_tal('Ordna bråken, minst först.', [(s, d(s)) for s in ['3/5', '1/5', '5/5', '2/5']],
              'Samma nämnare betyder lika stora delar. Då är bråket med minst täljare minst.'),
    skriv('En rektangel är delad i 6 lika stora delar. Hur många delar ska du färglägga för att 2/3 av rektangeln ska vara färgad?',
          t(F(2, 3) * 6), '2/3 = 4/6, för täljare och nämnare kan förlängas med 2. Färglägg 4 av de 6 delarna.'),
], beskrivning=blad('Bråk som en del av en helhet: täljare, nämnare, jämföra och räkna ut en del av ett tal.',
                    'Bråk – en del av en helhet'))

AREA_12 = ['3 cm och 4 cm', '3 cm och 9 cm', '2 cm och 10 cm']

AK5_AREA = niva('ma-ak5-blad-area-omkrets-1', 'Area och omkrets', 'Bråk, area och diagram', [
    skriv('En rektangel är 8 cm lång och 5 cm bred. Hur många centimeter är omkretsen?', t(2 * (8 + 5)),
          'Omkretsen är alla sidor tillsammans: 8 + 5 + 8 + 5 = 26 cm.'),
    skriv('En rektangel är 8 cm lång och 5 cm bred. Hur många kvadratcentimeter är arean?', t(8 * 5),
          'Arean är basen gånger höjden: 8 · 5 = 40 cm².'),
    skriv('Ett kvadratiskt bord har sidan 6 dm. Hur många decimeter är bordets omkrets?', t(4 * 6),
          'En kvadrat har fyra lika långa sidor: 4 · 6 = 24 dm.'),
    skriv('En kvadrat har arean 49 cm². Hur många centimeter är en sida?', t(7),
          'Vilket tal gånger sig självt blir 49? 7 · 7 = 49, så sidan är 7 cm.'),
    skriv('En rektangel har omkretsen 20 cm, och den ena sidan är 6 cm. Hur många centimeter är den andra sidan?',
          t((20 - 2 * 6) // 2), 'Två sidor är 6 cm: 20 − 6 − 6 = 8 cm är kvar till de två andra, och 8 : 2 = 4 cm.'),
    skriv('En rektangel har arean 36 cm², och den ena sidan är 9 cm. Hur många centimeter är den andra sidan?',
          t(36 // 9), 'Arean är sida gånger sida, så den andra sidan är 36 : 9 = 4 cm.'),
    skriv('Ett rum är 4 m brett och 5 m långt. Hur många kvadratmeter är golvet?', t(4 * 5),
          'Golvets area är 4 · 5 = 20 m².'),
    val('Vilken rektangel har arean 12 cm²?', AREA_12,
        enda(AREA_12, lambda a: int(a.split()[0]) * int(a.split()[3]) == 12),
        '3 · 4 = 12. De andra har arean 27 cm² och 20 cm².'),
    sant('En rektangel som är 2 cm och 6 cm har arean 12 cm².', 2 * 6 == 12,
         '2 · 6 = 12, så arean är 12 cm². Den täcker 12 rutor med sidan 1 cm.'),
], beskrivning=blad('Omkrets och area av rektanglar och kvadrater, också baklänges från arean.', 'Area och omkrets'))

HUSDJUR = 'I en klass har 7 elever hund, 10 katt, 3 kanin, 2 fågel och 8 inget husdjur. Varje elev har svarat en gång.'
VANLIGAST = ['Katt', 'Hund', 'Inget husdjur']
MEDEL_HUR = ['Lägg ihop alla värden och dela summan med hur många värden det är.',
             'Ordna alla värden i storleksordning och ta det värde som står i mitten.',
             'Leta upp det värde som förekommer flest gånger bland alla värdena.']
FRUKT = ['Äpple', 'Apelsin', 'Banan']


def medel(data):
    return F(sum(data), len(data))


def median(data):
    s = sorted(data)
    assert len(s) % 2 == 1
    return s[len(s) // 2]


AK5_DIAGRAM = niva('ma-ak5-blad-diagram-medel-1', 'Diagram och medelvärde', 'Bråk, area och diagram', [
    skriv(HUSDJUR + ' Hur många elever har hund eller kanin?', t(7 + 3), 'Eller betyder att båda räknas: 7 + 3 = 10.'),
    skriv(HUSDJUR + ' Hur många elever går i klassen?', t(7 + 10 + 3 + 2 + 8),
          'Alla har svarat en gång, så lägg ihop alla: 7 + 10 + 3 + 2 + 8 = 30.'),
    val(HUSDJUR + ' Vilket svar är vanligast?', VANLIGAST, 'Katt', '10 elever har katt, fler än för något annat svar.'),
    skriv('Fem elever fick 6, 8, 5, 9 och 7 poäng på ett prov. Vad är medelvärdet?', t(medel([6, 8, 5, 9, 7])),
          'Summan är 6 + 8 + 5 + 9 + 7 = 35, och 35 : 5 = 7.'),
    skriv('Vilket är typvärdet i 2, 3, 3, 4, 3, 6, 4?', t(3), 'Typvärdet är det som står flest gånger. 3 står tre gånger.'),
    skriv('Vilken är medianen i 4, 9, 2, 7, 5?', t(median([4, 9, 2, 7, 5])),
          'Ordna först: 2, 4, 5, 7, 9. Det mittersta talet är 5.'),
    val('Ett stapeldiagram visar en fruktkorg: äpple 5, banan 3, apelsin 4 och päron 2. Vilken stapel är högst?',
        FRUKT, 'Äpple', 'Den högsta stapeln hör till det största antalet, och 5 äpplen är flest.'),
    val('Hur räknar man ut medelvärdet?', MEDEL_HUR, MEDEL_HUR[0],
        'Medelvärdet fördelar summan jämnt. Det mittersta är medianen, och det vanligaste är typvärdet.'),
    sant('I talen 1, 2 och 10 är medianen större än medelvärdet.', median([1, 2, 10]) > medel([1, 2, 10]),
         'Medianen är 2. Medelvärdet är (1 + 2 + 10) : 3 = 13 : 3, drygt 4. Det stora talet 10 drar upp medelvärdet.'),
], beskrivning=blad('Läs av ett stapeldiagram och räkna ut medelvärde, typvärde och median.', 'Diagram och medelvärde'))

# ===================================================================== åk 6

STORST_NEG = ['−3', '−8']
PUNKT_23 = ['(−2, 3)', '(3, −2)', '(2, −3)']
PUNKT_C = ['4 steg till vänster och 1 steg ner från origo', '4 steg till höger och 1 steg ner från origo',
           '1 steg till vänster och 4 steg ner från origo']
PUNKT_F = ['På y-axeln', 'På x-axeln', 'I origo']

AK6_NEGATIVA = niva('ma-ak6-blad-negativa-tal-1', 'Negativa tal och koordinater', 'Negativa tal och ekvationer', [
    skriv('En punkt på tallinjen ligger 4 steg till vänster om 0. Vilket tal visar den?', svar(-4),
          'Till vänster om noll ligger de negativa talen. Fyra steg åt vänster är −4.'),
    val('Vilket tal är störst, −3 eller −8?', STORST_NEG, m(max(-3, -8)),
        '−3 ligger närmare noll och längre till höger på tallinjen än −8. Det som ligger längre till höger är större.'),
    ordna_tal('Ordna talen, minst först.', [(m(x), x) for x in [2, -5, 0, -1, 4]],
              'Längst till vänster på tallinjen står −5, sedan −1, noll och de positiva talen.'),
    skriv('Temperaturen är −4 °C och stiger 9 grader. Hur många grader är det då?', svar(-4 + 9),
          'Fyra grader upp till noll och fem grader till: −4 + 9 = 5.'),
    skriv('Temperaturen är 3 °C och sjunker 7 grader. Hur många grader är det då?', svar(3 - 7),
          'Tre grader ner till noll och fyra grader till: 3 − 7 = −4.'),
    skriv('Räkna: 5 − 8', svar(5 - 8), 'Fem steg ner till noll, och tre steg till under noll: −3.'),
    skriv('Räkna: −2 + 6', svar(-2 + 6), 'Två steg upp till noll, och fyra steg till: 4.'),
    val('Vilken punkt ligger 2 steg till vänster om origo och 3 steg upp?', PUNKT_23, '(−2, 3)',
        'Först x i sidled: vänster är negativt, −2. Sedan y i höjdled: upp är positivt, 3.'),
    val('Var ligger punkten (−4, −1)?', PUNKT_C, PUNKT_C[0],
        'x = −4 betyder fyra steg till vänster, och y = −1 betyder ett steg ner.'),
    val('Var ligger punkten (0, 4)?', PUNKT_F, 'På y-axeln',
        'x = 0 betyder inga steg i sidled, så punkten ligger på y-axeln, fyra steg upp.'),
], beskrivning=blad('Negativa tal på tallinjen och i temperaturer, och punkter i ett koordinatsystem.',
                    'Negativa tal och koordinatsystem'))

EKV_BOK = ['3x = 270', 'x + 3 = 270', 'x = 3 · 270']

AK6_EKVATIONER = niva('ma-ak6-blad-ekvationer-1', 'Enkla ekvationer', 'Negativa tal och ekvationer', [
    skriv('Lös ekvationen x + 7 = 15. Vad är x?', x_svar(15 - 7), 'Dra bort 7 på båda sidor: x = 15 − 7 = 8.'),
    skriv('Lös ekvationen x − 4 = 9. Vad är x?', x_svar(9 + 4), 'Lägg till 4 på båda sidor: x = 9 + 4 = 13.'),
    skriv('Lös ekvationen 3x = 21. Vad är x?', x_svar(21 // 3), '3x betyder 3 · x. Dela båda sidor med 3: x = 7.'),
    skriv('Lös ekvationen x : 4 = 6. Vad är x?', x_svar(6 * 4), 'Multiplicera båda sidor med 4: x = 24.'),
    skriv('Lös ekvationen 2x + 3 = 11. Vad är x?', x_svar((11 - 3) // 2),
          'Dra bort 3: 2x = 8. Dela med 2: x = 4.'),
    skriv('Lös ekvationen 5x − 5 = 20. Vad är x?', x_svar((20 + 5) // 5),
          'Lägg till 5: 5x = 25. Dela med 5: x = 5.'),
    skriv('Jag tänker på ett tal. Jag multiplicerar det med 4 och lägger till 3. Då blir det 31. Vilket tal tänkte jag på?',
          t((31 - 3) // 4), 'Räkna baklänges: 31 − 3 = 28 och 28 : 4 = 7. Kontroll: 4 · 7 + 3 = 31.'),
    val('En bok kostar x kr. Tre likadana böcker kostar 270 kr. Vilken ekvation stämmer?', EKV_BOK, '3x = 270',
        'Tre böcker kostar 3 gånger så mycket som en, alltså 3 · x = 270.'),
    skriv('Tre likadana böcker kostar tillsammans 270 kr. Hur många kronor kostar en bok?', t(270 // 3),
          'Lös 3x = 270 genom att dela med 3: x = 90.'),
    sant('x = 5 är lösningen till ekvationen 2x + 3 = 11.', 2 * 5 + 3 == 11,
         'Sätt in x = 5: 2 · 5 + 3 = 13, inte 11. Lösningen är x = 4, för 2 · 4 + 3 = 11.'),
], beskrivning=blad('Lös ekvationer i ett och två steg och kontrollera lösningen.', 'Enkla ekvationer'))

# ------------------------------------------------------------- NP-träning åk 6

FILM = ['19.20', '18.80', '19.00', '18.20']
STICKOR_REGEL = ['3 · n + 1', '3 · n', '4 · n', 'n + 3']
STICKOR = {1: 4, 2: 7, 3: 10, 10: 31}


def regel(text, n):
    """'3 · n − 1' räknat för ett n. Bara formen a · n ± b eller n + b."""
    s = text.replace(' ', '').replace('−', '-')
    a, _, rest = s.partition('n') if s.startswith('n') else s.partition('·n')
    a = 1 if s.startswith('n') else int(a)
    return a * n + (int(rest) if rest else 0)


RECT_24 = ['4 cm och 8 cm', '6 cm och 12 cm', '8 cm och 16 cm']

AK6_NP_UTAN = niva('ma-ak6-np-utan-miniraknare-1', 'Utan miniräknare', 'NP-träning', [
    skriv('Räkna utan miniräknare: 305 − 48', t(305 - 48), '305 − 50 = 255, men du tog bort 2 för mycket: 255 + 2 = 257.'),
    skriv('Räkna utan miniräknare: 0,6 + 0,25', t(d('0,6') + d('0,25')),
          'Skriv med lika många decimaler: 0,60 + 0,25 = 0,85.'),
    skriv('Skriv 3/4 i decimalform.', t(F(3, 4)), '3/4 = 75/100 = 0,75. Eller: 3 : 4 = 0,75.'),
    skriv('Hur många kronor är 10 % av 90 kr?', t(F(10, 100) * 90), '10 % är en tiondel: 90 : 10 = 9 kr.'),
    val('En film börjar 17.45 och är 1 timme och 35 minuter lång. När slutar den?', FILM, '19.20',
        '17.45 + 15 min = 18.00. Kvar är 1 h 20 min, och 18.00 + 1 h 20 min = 19.20. En timme har 60 minuter, inte 100.'),
    skriv('Vilket tal ska stå i rutan? 4 · □ + 3 = 31', t((31 - 3) // 4), '31 − 3 = 28 och 28 : 4 = 7.'),
    ordna_tal('Ordna talen, minst först.', [('0,5', d('0,5')), ('2/5', F(2, 5)), ('0,45', d('0,45'))],
              'Skriv alla med två decimaler: 2/5 = 0,40, 0,45 och 0,50.'),
    skriv('En figur av tändstickor är en rad rutor. Figur 1 har 4 stickor, figur 2 har 7 och figur 3 har 10. '
          'Varje ny ruta kräver 3 stickor till. Hur många stickor behövs till figur 10?',
          t(4 + 9 * 3), 'Från figur 1 till figur 10 kommer 9 nya rutor: 4 + 9 · 3 = 31.'),
    val('En rad tändsticksrutor: figur 1 har 4 stickor, figur 2 har 7 och figur 3 har 10. '
        'Vilken regel ger antalet stickor i figur nummer n?', STICKOR_REGEL,
        enda(STICKOR_REGEL, lambda a: all(regel(a, n) == v for n, v in STICKOR.items())),
        'En sticka att börja med och 3 för varje ruta: 3 · n + 1. Kontroll: figur 10 ger 31.'),
    val('En rektangel har omkretsen 24 cm. Den ena sidan är dubbelt så lång som den andra. Hur långa är sidorna?',
        RECT_24, enda(RECT_24, lambda a: 2 * (int(a.split()[0]) + int(a.split()[3])) == 24),
        'Kortsidan x och långsidan 2x: x + 2x + x + 2x = 6x = 24, så x = 4. Kontroll: 4 + 8 + 4 + 8 = 24.'),
], beskrivning=blad('Nextrums egna uppgifter i provets stil, utan miniräknare: räkning, decimaltal, tid, mönster och en ekvation.',
                    'NP-träning: matematik utan miniräknare'))

TROJA = ['I butiken med 20 % rabatt', 'I butiken med 45 kr rabatt', 'Det kostar lika mycket i båda']
pris_procent, pris_kr = 250 - F(20, 100) * 250, 250 - 45
assert pris_procent < pris_kr
LISA = ['Nej, arean blir fyra gånger så stor.', 'Ja, arean blir dubbelt så stor.', 'Nej, arean blir tre gånger så stor.']
assert (2 * 4) ** 2 == 4 * 4 ** 2

AK6_NP_PROBLEM = niva('ma-ak6-np-problemlosning-1', 'Problemlösning', 'NP-träning', [
    skriv('Klass 6B ska åka på utflykt. Bussen kostar 3 600 kr och 24 elever åker med. Hur många kronor blir det per elev?',
          t(3600 // 24), 'Dela kostnaden lika: 3 600 : 24 = 150 kr.'),
    skriv('Ali läste 3 böcker under sommaren, Bea 5, Cem 2 och Dina 6. Vad är medelvärdet?', t(medel([3, 5, 2, 6])),
          'Summan är 3 + 5 + 2 + 6 = 16, och 16 : 4 = 4 böcker.'),
    skriv('Fyra elever läste tillsammans 16 böcker. Hur många böcker måste en femte elev läsa för att medelvärdet för alla fem ska bli 5?',
          t(5 * 5 - 16), 'Medelvärdet 5 för fem elever kräver summan 5 · 5 = 25. 25 − 16 = 9.'),
    skriv('Saga och Theo delar på 120 kr så att Saga får 30 kr mer än Theo. Hur många kronor får Theo?',
          t((120 - 30) // 2), 'Ta bort Sagas extra 30 kr: 120 − 30 = 90, och dela lika: 45. Kontroll: 45 + 75 = 120.'),
    skriv('Saga och Theo delar på 120 kr så att Saga får 30 kr mer än Theo. Hur många kronor får Saga?',
          t((120 - 30) // 2 + 30), 'Theo får (120 − 30) : 2 = 45 kr, och Saga 30 kr mer: 75 kr.'),
    skriv('En tröja kostar 250 kr. Priset sänks med 20 %. Hur många kronor kostar tröjan då?', t(pris_procent),
          '20 % av 250 är 50 kr (10 % är 25 kr). 250 − 50 = 200 kr.'),
    val('En tröja kostar 250 kr. En butik sänker priset med 20 % och en annan med 45 kr. Var blir tröjan billigast?',
        TROJA, TROJA[0], '20 % av 250 kr är 50 kr, så priset blir 200 kr. I den andra butiken blir det 205 kr.'),
    skriv('En kvadrat har sidan 4 cm. Hur många kvadratcentimeter är arean?', t(4 * 4), 'Arean är sida gånger sida: 4 · 4 = 16 cm².'),
    val('Lisa säger: ”Gör man sidorna i en kvadrat dubbelt så långa blir arean dubbelt så stor.” Har hon rätt?',
        LISA, LISA[0], 'Sidan 2 cm ger 4 cm², sidan 4 cm ger 16 cm². Både längden och bredden dubblas, och 2 · 2 = 4.'),
], beskrivning=blad('Nextrums egna problemlösningsuppgifter i provets stil: dela lika, medelvärde, procent och area.',
                    'NP-träning: problemlösning i matematik'))

STORST_TAL = ['0,75', '0,8', '0,099', '3/5']
SUMMA_50 = ['22 och 28', '25 och 31', '19 och 25', '20 och 30']
KALLE = ['6 · 0,5 = 3', '6 · 2 = 12', '3 · 4 = 12']

AK6_NP_TAL = niva('ma-ak6-np-tal-och-rakning-1', 'Tal och räkning', 'NP-träning', [
    skriv('Vilket värde har siffran 7 i talet 4 702,5?', t(700), 'Siffran 7 står på hundratalens plats: sju hundratal, 700.'),
    skriv('Avrunda 3 486 till närmaste hundratal.', t(3500),
          'Titta på tiotalssiffran: 8 är 5 eller mer, så det blir 3 500.'),
    skriv('Räkna utan miniräknare: 1 000 − 367', t(1000 - 367), 'Kontrollera med plus: 367 + 633 = 1 000.'),
    val('Vilket tal är störst?', STORST_TAL, enda(STORST_TAL, lambda a: d(a) == max(d(x) for x in STORST_TAL)),
        'Skriv alla med samma antal decimaler: 0,750, 0,800, 0,099 och 3/5 = 0,600. Störst är 0,8.'),
    skriv('Det är −3 °C på morgonen och 5 °C på eftermiddagen. Hur många grader varmare är det på eftermiddagen?',
          t(5 - (-3)), '3 grader upp till noll och 5 grader till: 3 + 5 = 8 grader.'),
    skriv('Vilket tal ska stå i rutan? 3/4 = □/12', t(F(3, 4) * 12), 'Nämnaren har multiplicerats med 3, så täljaren också: 3 · 3 = 9.'),
    skriv('Räkna smart: 4 · 37 · 25', t(4 * 37 * 25), 'Byt ordning på faktorerna: 4 · 25 = 100, och 100 · 37 = 3 700.'),
    val('Ett tal är 6 större än ett annat tal. Summan av talen är 50. Vilka är talen?', SUMMA_50,
        enda(SUMMA_50, lambda a: (lambda p, q: q - p == 6 and p + q == 50)(*map(int, a.split(' och ')))),
        '50 − 6 = 44, och 44 : 2 = 22. Det andra talet är 22 + 6 = 28. Kontroll: 22 + 28 = 50.'),
    val('Kalle säger: ”Multiplicerar man två tal blir svaret alltid större än båda talen.” Vilket exempel visar att han har fel?',
        KALLE, enda(KALLE, lambda a: d(a.split(' = ')[1]) < max(d(f) for f in a.split(' = ')[0].split(' · '))),
        '6 · 0,5 = 3, och 3 är mindre än 6. Gånger ett tal mindre än 1 blir svaret mindre.'),
    skriv('Hur många olika tresiffriga tal kan du bilda med siffrorna 1, 2 och 3 om varje siffra används en gång?',
          t(3 * 2 * 1), '3 val för första siffran, 2 för den andra och 1 för den sista: 3 · 2 · 1 = 6.'),
], beskrivning=blad('Nextrums egna uppgifter i provets stil: positionssystemet, avrundning, bråk, negativa tal och att räkna smart.',
                    'NP-träning: tal och räkning'))

RECT_20_24 = ['4 cm och 6 cm', '2 cm och 8 cm', '5 cm och 5 cm', '3 cm och 8 cm']

AK6_NP_GEOMETRI = niva('ma-ak6-np-geometri-matning-1', 'Geometri och mätning', 'NP-träning', [
    skriv('En rektangel är 7 cm lång och 4 cm bred. Hur många centimeter är omkretsen?', t(2 * (7 + 4)),
          'Alla fyra sidorna: 7 + 4 + 7 + 4 = 22 cm.'),
    skriv('En rektangel är 7 cm lång och 4 cm bred. Hur många kvadratcentimeter är arean?', t(7 * 4),
          'Basen gånger höjden: 7 · 4 = 28 cm².'),
    para('Para ihop vinkeln med vad den kallas.', [('40°', 'spetsig'), ('90°', 'rät'), ('130°', 'trubbig')],
         'En rät vinkel är 90°. Mindre än 90° är spetsig, större är trubbig.'),
    skriv('Ett akvarium är 50 cm långt, 20 cm brett och 30 cm högt. Hur många liter rymmer det?', t(5 * 2 * 3),
          'Räkna i dm, för 1 dm³ = 1 liter: 5 · 2 · 3 = 30 dm³ = 30 liter.'),
    skriv('En karta har skalan 1 : 50 000. Hur många kilometer i verkligheten är 4 cm på kartan?',
          t(F(4 * 50000, 100000)), '4 · 50 000 = 200 000 cm = 2 000 m = 2 km.'),
    skriv('En karta har skalan 1 : 50 000. En väg är 6 cm på kartan. Hur många kilometer är vägen i verkligheten?',
          t(F(6 * 50000, 100000)), '6 · 50 000 = 300 000 cm. 100 000 cm är 1 km, så det blir 3 km.'),
    val('En rektangel har omkretsen 20 cm och arean 24 cm². Hur långa är sidorna?', RECT_20_24,
        enda(RECT_20_24, lambda a: (lambda p, q: 2 * (p + q) == 20 and p * q == 24)(int(a.split()[0]), int(a.split()[3]))),
        'Två sidor tillsammans ska bli 10 cm. Av 1 + 9, 2 + 8, 3 + 7, 4 + 6 och 5 + 5 ger bara 4 · 6 arean 24.'),
    skriv('Hur många kubikcentimeter är 1 kubikdecimeter?', t(10 * 10 * 10),
          '1 dm = 10 cm, och en kub har tre led: 10 · 10 · 10 = 1 000 cm³.'),
], beskrivning=blad('Nextrums egna uppgifter i provets stil: omkrets, area, vinklar, volym i liter och skala.',
                    'NP-träning: geometri och mätning'))

SKOLVAG = 'En måndag gick 9 elever i klass 6A till skolan, 7 cyklade, 5 åkte buss och 3 åkte bil. Alla svarade.'
TALFOLJD_REGEL = ['3 · n − 1', '3 · n + 2', 'n + 3', '2 · n + 1']
FOLJD = {1: 2, 2: 5, 3: 8, 4: 11, 10: 29}
MEDEL_MEDIAN = ['1, 2, 5, 10, 12', '2, 4, 5, 6, 8', '3, 5, 6, 7, 9', '1, 5, 5, 6, 8']


def fem_tal(a):
    return [int(x) for x in a.split(', ')]


AK6_NP_STATISTIK = niva('ma-ak6-np-statistik-monster-1', 'Statistik, chans och mönster', 'NP-träning', [
    skriv(SKOLVAG + ' Hur många elever går i klassen?', t(9 + 7 + 5 + 3), 'Lägg ihop alla grupper: 9 + 7 + 5 + 3 = 24.'),
    skriv(SKOLVAG + ' Hur många elever gick eller cyklade?', t(9 + 7), '9 gick och 7 cyklade: 9 + 7 = 16.'),
    skriv(SKOLVAG + ' Hur stor andel av eleverna åkte buss? Svara i bråkform.', brak(5, 24),
          '5 av de 24 eleverna åkte buss: 5/24.'),
    skriv('Fem barn är 132, 140, 128, 145 och 135 cm långa. Vad är medianen?', t(median([132, 140, 128, 145, 135])),
          'I ordning: 128, 132, 135, 140, 145. Det mittersta värdet är 135 cm.'),
    skriv('I en påse finns 3 röda och 5 blå kulor. Du tar en kula utan att titta. Hur stor är chansen att den är röd? Svara i bråkform.',
          brak(3, 3 + 5), 'Det finns 8 kulor och 3 av dem är röda: 3/8.'),
    skriv('Talföljden börjar 2, 5, 8, 11, … Vilket tal står på plats 10?', t(2 + 9 * 3),
          'Talen ökar med 3. Från plats 1 till plats 10 är det 9 steg: 2 + 9 · 3 = 29.'),
    val('Talföljden börjar 2, 5, 8, 11, … Vilken regel ger talet på plats n?', TALFOLJD_REGEL,
        enda(TALFOLJD_REGEL, lambda a: all(regel(a, n) == v for n, v in FOLJD.items())),
        'Talen ökar med 3, så regeln börjar med 3 · n. 3 · 1 = 3, och för att få 2 drar man bort 1.'),
    val('Vilka fem tal har medelvärdet 6 och medianen 5?', MEDEL_MEDIAN,
        enda(MEDEL_MEDIAN, lambda a: medel(fem_tal(a)) == 6 and median(fem_tal(a)) == 5),
        'Summan ska vara 5 · 6 = 30 och mittersta talet 5. Bara 1, 2, 5, 10, 12 klarar båda.'),
], beskrivning=blad('Nextrums egna uppgifter i provets stil: läsa data, andel, median, chans och talföljder.',
                    'NP-träning: statistik, chans och mönster'))

# ------------------------------------------------------------- Genomgångarna (lästext)

TEXT_BRAK = '\n\n'.join([
    'Bråk',
    'Ett bråk visar en del av en helhet. Nämnaren, talet under strecket, visar hur många lika stora delar helheten är '
    'delad i. Täljaren, talet över strecket, visar hur många av delarna vi menar. 3/4 är tre av fyra lika stora delar.',
    'Bråk kan förlängas och förkortas: multiplicera eller dividera täljare och nämnare med samma tal, så ändras inte '
    'värdet. 1/2 = 2/4 = 4/8.',
    'Decimaltal',
    'Första siffran efter decimaltecknet är tiondelar och den andra hundradelar. 0,25 är 25 hundradelar. Ett bråk blir '
    'ett decimaltal om man delar täljaren med nämnaren: 1/4 = 1 : 4 = 0,25.',
    'Procent',
    'Procent betyder hundradelar: 1 % = 1/100 = 0,01. 50 % är hälften, 25 % en fjärdedel och 10 % en tiondel.',
    'Exempel: 10 % av 80 kr är 80 : 10 = 8 kr. Då är 30 % av 80 kr tre gånger så mycket, 3 · 8 = 24 kr.',
])

TALJAREN = ['Hur många av de lika stora delarna vi menar.', 'Hur många lika stora delar helheten är delad i.',
            'Hur många hundradelar bråket är i procent.']

AK6_GENOMGANG_BRAK = niva('ma-ak6-genomgang-brak-procent-1', 'Bråk, decimaltal och procent', 'Läsa: genomgång inför NP', [
    val('Vad visar täljaren i ett bråk, enligt genomgången?', TALJAREN, TALJAREN[0],
        'Täljaren står över strecket och räknar delarna vi menar. Nämnaren säger hur många delar helheten har.'),
    sant('1/2, 2/4 och 4/8 är lika mycket.', d('1/2') == d('2/4') == d('4/8'),
         'Förläng 1/2 med 2 och med 4: täljare och nämnare multipliceras med samma tal, så värdet ändras inte.'),
    skriv('Skriv 3/5 som decimaltal.', t(F(3, 5)), 'Dela täljaren med nämnaren: 3 : 5 = 0,6.'),
    skriv('Hur många procent är 3/5?', t(F(3, 5) * 100), '3/5 = 0,6 = 60/100, och hundradelar är procent: 60 %.'),
    skriv('Förläng 2/3 så att nämnaren blir 12.', brak(8, 12), 'Nämnaren 3 · 4 = 12, så täljaren också: 2 · 4 = 8. Det blir 8/12.'),
    skriv('Hur många kronor är 20 % av 150 kr?', t(F(20, 100) * 150), '10 % är 150 : 10 = 15 kr, och 20 % är 2 · 15 = 30 kr.'),
    skriv('Hur många kronor är 30 % av 80 kr?', t(F(30, 100) * 80), '10 % av 80 kr är 8 kr, och 30 % är 3 · 8 = 24 kr.'),
    skriv('Hur många procent är hälften?', t(50), 'Hälften är 1/2 = 50/100 = 50 %.'),
    ordna_tal('Ordna talen, minst först.', [('0,3', d('0,3')), ('1/4', F(1, 4)), ('35 %', d('35 %'))],
              'Skriv alla som decimaltal: 1/4 = 0,25, 0,3 = 0,30 och 35 % = 0,35.'),
], beskrivning=blad('Läs faktabladet om bråk, decimaltal och procent och använd det i uppgifter.',
                    'Genomgång: bråk, decimaltal och procent'), text=TEXT_BRAK)

TEXT_GEOMETRI = '\n\n'.join([
    'Omkrets och area',
    'Omkretsen är sträckan runt en figur: lägg ihop alla sidor. Arean är ytan inuti. En rektangels area är basen gånger '
    'höjden, och en triangels area är basen gånger höjden delat med 2.',
    'Exempel: en rektangel som är 5 cm lång och 3 cm bred har omkretsen 5 + 3 + 5 + 3 = 16 cm och arean 5 · 3 = 15 cm².',
    'Volym',
    'Volym är hur mycket som får plats i något. Ett rätblock har volymen längd · bredd · höjd. 1 dm³ är lika mycket som '
    '1 liter, och 1 liter = 10 dl = 100 cl = 1 000 ml.',
    'Enheter och skala',
    'Längd: 1 m = 10 dm = 100 cm = 1 000 mm och 1 km = 1 000 m. Vikt: 1 kg = 1 000 g. Tid: 1 h = 60 min och 1 min = 60 s.',
    'Skala 1 : 100 betyder att 1 cm på ritningen är 100 cm, alltså 1 m, i verkligheten.',
])

TRIANGEL = ['Basen gånger höjden, delat med 2.', 'Basen gånger höjden, gånger 2.', 'Alla tre sidorna lagda ihop med varandra.']

AK6_GENOMGANG_GEOMETRI = niva('ma-ak6-genomgang-omkrets-volym-1', 'Omkrets, area, volym och enheter',
                              'Läsa: genomgång inför NP', [
    val('Hur räknar man ut en triangels area, enligt genomgången?', TRIANGEL, TRIANGEL[0],
        'En triangel är hälften av en rektangel med samma bas och höjd, därför delar man med 2.'),
    skriv('En triangel har basen 8 cm och höjden 5 cm. Hur många kvadratcentimeter är arean?', t(8 * 5 // 2),
          '8 · 5 = 40, och delat med 2 blir det 20 cm².'),
    skriv('En rektangel är 5 cm lång och 3 cm bred. Hur många centimeter är omkretsen?', t(2 * (5 + 3)),
          'Lägg ihop alla sidor: 5 + 3 + 5 + 3 = 16 cm.'),
    skriv('Hur många liter rymmer en låda som är 4 dm lång, 3 dm bred och 2 dm hög?', t(4 * 3 * 2),
          '4 · 3 · 2 = 24 dm³, och 1 dm³ är 1 liter.'),
    skriv('Hur många deciliter är 1 liter?', t(10), '1 liter = 10 dl.'),
    skriv('Hur många milliliter är 2 liter?', t(2 * 1000), '1 liter = 1 000 ml, så 2 liter = 2 000 ml.'),
    skriv('Hur många meter är 2,4 km?', t(d('2,4') * 1000), '1 km = 1 000 m, och 2,4 · 1 000 = 2 400 m.'),
    skriv('Hur många sekunder är 3 minuter?', t(3 * 60), '1 min = 60 s, och 3 · 60 = 180 s.'),
    skriv('På en ritning i skala 1 : 50 är ett bord 3 cm långt. Hur många centimeter är bordet i verkligheten?',
          t(3 * 50), 'Varje cm på ritningen är 50 cm i verkligheten: 3 · 50 = 150 cm.'),
], beskrivning=blad('Läs faktabladet om omkrets, area, volym, enheter och skala och använd det i uppgifter.',
                    'Genomgång: omkrets, area, volym och enheter'), text=TEXT_GEOMETRI)

TILLAGG = [
    bana('Matematik', 'ak1', [AK1_TIOKAMRATER, AK1_PLUS_MINUS, AK1_STORRE]),
    bana('Matematik', 'ak2', [AK2_TIOTAL, AK2_KLOCKAN, AK2_PENGAR]),
    bana('Matematik', 'ak3', [AK3_MULTIPLIKATION, AK3_DIVISION, AK3_VAXLING, AK3_LANGD]),
    bana('Matematik', 'ak4', [AK4_TABELLER, AK4_TIONDELAR]),
    bana('Matematik', 'ak5', [AK5_BRAK, AK5_AREA, AK5_DIAGRAM]),
    bana('Matematik', 'ak6', [AK6_NEGATIVA, AK6_EKVATIONER,
                              AK6_NP_UTAN, AK6_NP_PROBLEM, AK6_NP_TAL, AK6_NP_GEOMETRI, AK6_NP_STATISTIK,
                              AK6_GENOMGANG_BRAK, AK6_GENOMGANG_GEOMETRI]),
]
