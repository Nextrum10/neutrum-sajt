# -*- coding: utf-8 -*-
"""Matematik åk 7–9 och Matematik 1 på gymnasiet. En bana per årskurs ur
det centrala innehållet (Lgr22 och Gy11): negativa tal, procent och
förändringsfaktor, ekvationer, algebra, potenser, funktioner, geometri,
statistik och sannolikhet, alltså det som nästa årskurs bygger på. Åk 8
har flest nivåer, för att den första riktiga eleven går där: varje område
är en stig med introduktionen först och det svåraste sist.

Varje facit räknas ut här, och de felaktiga alternativen prövas mot samma
räkning (assert längre ner): ett fel facit lär barnet att det rätta svaret
är fel, och ett "fel" alternativ som råkar vara rätt gör samma sak.
"""
from fractions import Fraction as F
from itertools import product
from math import isqrt, pi, sqrt
from statistics import multimode

from grund import bana, niva, val, skriv, ordna, sant, para, tal

UPPH = str.maketrans('0123456789-', '⁰¹²³⁴⁵⁶⁷⁸⁹⁻')


def up(n):
    """Exponenten som upphöjda tecken: up(3) → '³', up(-2) → '⁻²'."""
    return str(n).translate(UPPH)


def t(x):
    """Talet som svar: decimalkomma och '-' för minus (rättningen gör om − till -)."""
    if isinstance(x, F):
        x = int(x) if x.denominator == 1 else float(x)
    return tal(x)


def m(x):
    """Talet i en text eller bland alternativen, med riktigt minustecken."""
    return t(x).replace('-', '−')


def br(x):
    """Ett bråk som text, 3/4. Heltal utan nämnare."""
    x = F(x)
    s = str(x.numerator) if x.denominator == 1 else '%d/%d' % (x.numerator, x.denominator)
    return s.replace('-', '−')


def x_svar(v, var='x'):
    """Svaret på "Vad är x?": talet, och talet skrivet som x = 5 på fyra sätt.
    Ett negativt tal också med mellanslag efter minustecknet, - 2 och x = - 2:
    rättningen läser bara -2 som ett tal, allt annat jämförs som text."""
    s = t(v)
    svar = [s, '%s = %s' % (var, s), '%s=%s' % (var, s), '%s= %s' % (var, s), '%s =%s' % (var, s)]
    if s.startswith('-'):
        svar += ['- ' + s[1:], '%s = - %s' % (var, s[1:])]
    return svar


def neg_svar(v):
    """Ett tal som svar. Ett negativt tal också som - 5 och (-5), så som det
    står i frågorna ((−6) · (−5)): bara -5 läses som ett tal."""
    s = t(v)
    return [s, '- ' + s[1:], '(%s)' % s] if s.startswith('-') else [s]


def monom(k, var):
    """Ett uttryck som 5y, med gångertecknet så som en elev skriver det.
    Uttryck jämförs som text, så "5*y", "5 * y" och "5* y" är tre svar."""
    s = t(k)
    return ([s + var, '%s %s' % (s, var)]
            + ['%s%s*%s%s' % (s, a, b, var) for a, b in (('', ''), (' ', ' '), ('', ' '), (' ', ''))]
            + ['%s%s%s%s%s' % (s, a, tecken, a, var) for tecken in '·×' for a in ('', ' ')])


def brak(x):
    """Ett bråk som svar, med och utan mellanslag runt snedstrecket: bråk
    jämförs som text, så "1 / 8" är inte "1/8" för rättningen."""
    x = F(x)
    assert x.denominator > 1 and x > 0, x
    s = '%d/%d' % (x.numerator, x.denominator)
    return [s, s.replace('/', ' / ')]


def tusental(x):
    """Ett heltal med mellanslag också i fyrsiffriga tal, 8 820, som i texterna runt omkring."""
    x = F(x)
    assert x.denominator == 1, x
    return '{:,}'.format(int(x)).replace(',', ' ').replace('-', '−')


def los(a, b, c, d):
    """Löser ax + b = cx + d och prövar svaret."""
    x = F(d - b) / F(a - c)
    assert a * x + b == c * x + d
    return x


def rot(x):
    """Exakt kvadratrot ur ett rationellt tal. Går den inte jämnt ut är frågan fel."""
    x = F(x)
    a, b = isqrt(x.numerator), isqrt(x.denominator)
    assert a * a == x.numerator and b * b == x.denominator, x
    return F(a, b)


def samma(f, g):
    """Två uttryck i en variabel är samma uttryck: prövat i elva punkter."""
    return all(f(F(x)) == g(F(x)) for x in range(-5, 6))


def ordna_tal(fraga, par, forklaring, extra=None):
    """Brickor som ska stå från minst till störst. Ordningen räknas här ur
    värdena, och två lika värden hade gett två rätta ordningar."""
    varden = [v for _, v in par]
    assert len(set(varden)) == len(varden), fraga
    brickor = [text for text, _ in sorted(par, key=lambda p: p[1])]
    return ordna(fraga, brickor, extra=extra, forklaring=forklaring)


def medel(data):
    return F(sum(data), len(data))


def median(data):
    s = sorted(data)
    n = len(s)
    return F(s[n // 2]) if n % 2 else F(s[n // 2 - 1] + s[n // 2], 2)


def typvarde(data):
    typ = multimode(data)
    assert len(typ) == 1, data
    return typ[0]


def samma2(f, g):
    """Som samma(), för uttryck i två variabler: prövat i ett rutnät."""
    return all(f(F(a), F(b)) == g(F(a), F(b)) for a in range(-3, 4) for b in range(-3, 4))


def svtal(x):
    """Ett tal i en text eller en bricka: heltal med mellanslag i tusental,
    också fyrsiffriga (1 000), och annars som m()."""
    x = F(x)
    return tusental(x) if x.denominator == 1 else m(x)


def procent(x):
    """En andel som procent i en text: procent(F(1, 8)) → '12,5 %'."""
    return '%s %%' % m(F(x) * 100)


def faktor(p):
    """Förändringsfaktorn när något ändras med p procent: faktor(-20) är 0,8."""
    return 1 + F(p, 100)


def andring(p):
    """En ändring i procent som text, med tecken: +10 % och −10 %."""
    return '%s%d %%' % ('+' if p > 0 else '−', abs(p))


def parentesekvation(a, c, d):
    """Ekvationen a(x + c) = d som text, och dess lösning."""
    return '%d(x %s %d) = %s' % (a, '+' if c > 0 else '−', abs(c), m(d)), los(a, a * c, 0, d)


def linje(k, mm, vanster='y'):
    """Linjen y = kx + m som text, så som den skrivs: y = −x + 5, y = 0,5x + 4, y = 3x, y = 4."""
    k, mm = F(k), F(mm)
    kx = '' if k == 0 else 'x' if k == 1 else '−x' if k == -1 else m(k) + 'x'
    if not kx:
        return '%s = %s' % (vanster, m(mm))
    if mm == 0:
        return '%s = %s' % (vanster, kx)
    return '%s = %s %s %s' % (vanster, kx, '+' if mm > 0 else '−', m(abs(mm)))


def modell(d, sort):
    """Ett belopp på 1 000 kr som ändras lika mycket varje år, med d kronor
    eller d procent: förändringen i ord och funktionen, ur samma tal."""
    text = '%s med %d %s per år' % ('Ökar' if d > 0 else 'Minskar', abs(d), sort)
    if sort == 'kr':
        return text, 'f(x) = 1 000 %s %dx' % ('+' if d > 0 else '−', abs(d))
    return text, 'f(x) = 1 000 · %sˣ' % t(faktor(d))


# ---------------------------------------------------------------- åk 7

# Kontroller som inte ryms i en rad nedanför.
assert [x for x in (F(3), F(12), F(7, 2)) if 4 * x + 1 == 13] == [3]
assert F(10, 100) * 30 == 3 and F(10, 100) * 50 == 5 and F(50, 100) * 20 == 10 and F(25, 100) * 100 == 25
# Tiopotenser och prefix: prefixen står som sina tiopotenser, och längderna
# i sista frågan räknas om till millimeter.
PREFIX = [('kilo', F(10) ** 3), ('hekto', F(10) ** 2), ('deci', F(10) ** -1), ('centi', F(10) ** -2),
          ('milli', F(10) ** -3)]
LANGDER = [('35 mm', F(35)), ('4 cm', 4 * F(10)), ('0,3 dm', F(3, 10) * 100), ('0,05 m', F(5, 100) * 1000)]
assert [v for _, v in LANGDER] == [35, 40, 30, 50]
assert 2 ** 3 == 8 and 3 ** 2 == 9 and 3 ** 4 == 81

AK7 = bana('Matematik', 'ak7', [
    niva('ma-ak7-negativa-1', 'Räkna med negativa tal', 'Negativa tal', [
        val('Vad är −3 + 7?', [m(-3 + 7), m(-3 - 7), m(3 - 7), m(3 + 7)], m(-3 + 7),
            'Börja på −3 på tallinjen och gå 7 steg åt höger. Du passerar noll och hamnar på 4.'),
        val('Vad är 2 − 9?', [m(2 - 9), m(9 - 2), m(-2 - 9), m(2 + 9)], m(2 - 9),
            'Börja på 2 och gå 9 steg åt vänster. Efter 2 steg är du på noll, och 7 steg till ger −7.'),
        skriv('På morgonen är det −6 °C. Till lunch har det blivit 9 grader varmare. '
              'Hur många grader är det vid lunch?', t(-6 + 9),
              'Varmare betyder uppåt på termometern: −6 + 9 = 3. Det är 3 grader vid lunch.'),
        val('Vad är 6 − (−2)?', [m(6 - (-2)), m(6 - 2), m(-6 - 2), m(-6 + 2)], m(6 - (-2)),
            'Att dra bort ett negativt tal är samma sak som att lägga till: 6 − (−2) = 6 + 2 = 8.'),
        val('Vad är −4 · 3?', [m(-4 * 3), m(4 * 3), m(-4 - 3), m(-4 + 3)], m(-4 * 3),
            'Minus gånger plus blir minus. 4 · 3 = 12, så −4 · 3 = −12.'),
        skriv('Vad är (−6) · (−5)?', t((-6) * (-5)),
              'Minus gånger minus blir plus. 6 · 5 = 30, så svaret är 30.'),
        skriv('Vad är −20 / 4?', neg_svar(F(-20, 4)),
              'Ett negativt tal delat med ett positivt blir negativt. 20 / 4 = 5, så svaret är −5.'),
        ordna_tal('Ordna talen från minst till störst.', [(m(v), v) for v in (3, -4, 6, -7, -1)],
                  'Ju längre till vänster på tallinjen, desto mindre tal. −7 är mindre än −4, '
                  'för det ligger längre bort från noll åt minushållet.'),
    ], beskrivning='Plus, minus, gånger och delat med negativa tal.'),

    niva('ma-ak7-prioritering-1', 'Räkna i rätt ordning', 'Prioriteringsregler', [
        val('Vad är 2 + 3 · 4?', [t(2 + 3 * 4), t((2 + 3) * 4), t(2 * 3 * 4), t(2 + 3 + 4)], t(2 + 3 * 4),
            'Multiplikation räknas före addition: 3 · 4 = 12, och sedan 2 + 12 = 14.'),
        val('Vad är (2 + 3) · 4?', [t((2 + 3) * 4), t(2 + 3 * 4), t(2 + 3 + 4)], t((2 + 3) * 4),
            'Parentesen räknas först: 2 + 3 = 5. Sedan 5 · 4 = 20.'),
        skriv('Vad är 20 − 12 / 4?', t(20 - F(12, 4)),
              'Division räknas före subtraktion: 12 / 4 = 3, och sedan 20 − 3 = 17.'),
        val('Vad är 10 − 4 − 3?', [t(10 - 4 - 3), t(10 - (4 - 3)), t(10 + 4 - 3)], t(10 - 4 - 3),
            'Plus och minus räknas från vänster till höger: 10 − 4 = 6, och sedan 6 − 3 = 3.'),
        val('Vad är 2 · 3²?', [t(2 * 3 ** 2), t((2 * 3) ** 2), t(2 * 3 * 2)], t(2 * 3 ** 2),
            'Potensen räknas före multiplikationen: 3² = 9, och 2 · 9 = 18.'),
        skriv('Vad är 18 / (4 + 2)?', t(F(18, 4 + 2)),
              'Parentesen först: 4 + 2 = 6. Sedan 18 / 6 = 3.'),
        skriv('Vad är 4 · 5 − 2 · 6?', t(4 * 5 - 2 * 6),
              'Båda multiplikationerna räknas före minus: 20 − 12 = 8.'),
        ordna('Räkna ut 7 + 2 · (8 − 3). Ordna stegen i den ordning du räknar dem. En bricka blir över.',
              ['8 − 3 = %d' % (8 - 3), '2 · %d = %d' % (8 - 3, 2 * (8 - 3)),
               '7 + %d = %d' % (2 * (8 - 3), 7 + 2 * (8 - 3))],
              extra=['7 + 2 = %d' % (7 + 2)],
              forklaring='Parentesen först, sedan multiplikationen och sist additionen. '
                         '7 + 2 får inte räknas först, för 2 hör ihop med multiplikationen.'),
    ], beskrivning='I vilken ordning parenteser, potenser och de fyra räknesätten räknas.'),

    niva('ma-ak7-procent-1', 'Procent av ett tal', 'Procent', [
        val('Hur mycket är 10 % av 350?',
            [t(F(10, 100) * 350), t(F(350, 100)), t(350 - 10), t(350 + 10)], t(F(10, 100) * 350),
            'Tio procent är en tiondel. 350 / 10 = 35.'),
        skriv('Hur mycket är 25 % av 80?', t(F(25, 100) * 80),
              '25 % är en fjärdedel. 80 / 4 = 20.'),
        val('Vilket decimaltal är samma sak som 7 %?', ['0,07', '0,7', '0,007'], t(F(7, 100)),
            'Procent betyder hundradelar. 7 % = 7/100 = 0,07.'),
        skriv('Hur mycket är 15 % av 200?', t(F(15, 100) * 200),
              '1 % av 200 är 2. Då är 15 % lika med 15 · 2 = 30.'),
        val('En tröja kostar 400 kr. Priset sänks med 30 %. Hur många kronor billigare blir tröjan?',
            ['%s kr' % t(F(30, 100) * 400), '%s kr' % t(400 - F(30, 100) * 400), '30 kr',
             '%s kr' % t(F(3, 100) * 400)],
            '%s kr' % t(F(30, 100) * 400),
            '30 % av 400 kr är 0,3 · 400 = 120 kr. Så mycket billigare blir den, och det nya priset '
            'är 400 − 120 = 280 kr.'),
        skriv('I en klass går 25 elever. 40 % av dem spelar ett instrument. Hur många elever är det?',
              t(F(40, 100) * 25),
              '40 % = 0,4, och 0,4 · 25 = 10.'),
        val('Hur mycket är 5 % av 60?', [t(F(5, 100) * 60), t(F(60, 5)), t(F(5, 1000) * 60)],
            t(F(5, 100) * 60),
            '10 % av 60 är 6. 5 % är hälften av det, alltså 3.'),
        ordna_tal('Ordna från minst till störst.',
                  [('%d %% av %d' % (p, n), F(p, 100) * n) for p, n in ((50, 20), (10, 30), (25, 100), (10, 50))],
                  'Räkna ut varje: 10 % av 30 = 3, 10 % av 50 = 5, 50 % av 20 = 10 och 25 % av 100 = 25.'),
    ], beskrivning='Räkna ut hur mycket en viss procent av ett tal är.'),

    niva('ma-ak7-ekvationer-1', 'Ekvationer i ett och två steg', 'Ekvationer', [
        val('Lös ekvationen x + 7 = 12. Vad är x?', [m(los(1, 7, 0, 12)), m(12 + 7), m(-12 + 7)],
            m(los(1, 7, 0, 12)),
            'Dra bort 7 från båda sidor: x = 12 − 7 = 5.'),
        skriv('Lös ekvationen x − 4 = 9. Vad är x?', x_svar(los(1, -4, 0, 9)),
              'Lägg till 4 på båda sidor: x = 9 + 4 = 13.'),
        val('Lös ekvationen 3x = 21. Vad är x?',
            [t(los(3, 0, 0, 21)), t(21 - 3), t(21 * 3), t(21 + 3)], t(los(3, 0, 0, 21)),
            '3x betyder 3 · x. Dela båda sidor med 3: x = 21 / 3 = 7.'),
        skriv('Lös ekvationen x/5 = 6. Vad är x?', x_svar(los(F(1, 5), 0, 0, 6)),
              'Multiplicera båda sidor med 5: x = 6 · 5 = 30.'),
        val('Lös ekvationen 2x + 3 = 11. Vad är x?',
            [t(los(2, 3, 0, 11)), t(F(11 + 3, 2)), t(11 - 3)], t(los(2, 3, 0, 11)),
            'Dra först bort 3 från båda sidor: 2x = 8. Dela sedan med 2: x = 4.'),
        skriv('Lös ekvationen 5x − 2 = 23. Vad är x?', x_svar(los(5, -2, 0, 23)),
              'Lägg till 2 på båda sidor: 5x = 25. Dela med 5: x = 5.'),
        val('Vilket x gör att 4x + 1 = 13 stämmer?', ['3', '12', '3,5'], t(los(4, 1, 0, 13)),
            'Pröva genom att sätta in: 4 · 3 + 1 = 12 + 1 = 13. Det stämmer.'),
        ordna('Ordna stegen för att lösa 3x + 5 = 26. En bricka blir över.',
              ['3x + 5 = 26', '3x = %d' % (26 - 5), 'x = %s' % t(los(3, 5, 0, 26))],
              extra=['3x = %d' % (26 + 5)],
              forklaring='Dra först bort 5 från båda sidor, så att 3x = 21. Dela sedan med 3: x = 7. '
                         '3x = 31 får man om man lägger till 5 i stället för att dra bort.'),
    ], beskrivning='Lösa enkla ekvationer genom att göra samma sak på båda sidor.'),

    niva('ma-ak7-potenser-1', 'Upphöjt till', 'Potenser', [
        val('Vad betyder 5³?', ['5 · 5 · 5', '5 · 3', '5 + 5 + 5', '3 · 3 · 3 · 3 · 3'], '5 · 5 · 5',
            'Exponenten 3 visar hur många femmor som multipliceras med varandra: 5 · 5 · 5.'),
        skriv('Vad är 2⁵?', t(2 ** 5),
              '2⁵ = 2 · 2 · 2 · 2 · 2 = 32.'),
        val('Vad är 4²?', [t(4 ** 2), t(4 * 2), t(4 + 2)], t(4 ** 2),
            '4² = 4 · 4 = 16. Det är inte 4 · 2.'),
        val('I potensen 7⁴, vilket tal är basen?', ['7', '4', t(7 * 4)], '7',
            'Basen är talet som multipliceras med sig själv. Exponenten 4 visar hur många sjuor '
            'det är: 7⁴ = 7 · 7 · 7 · 7.'),
        skriv('Vad är 10⁴?', t(10 ** 4),
              'Exponenten i en tiopotens visar hur många nollor det blir: 10⁴ = 10 000.'),
        val('Vad är 3² + 4²?', [t(3 ** 2 + 4 ** 2), t((3 + 4) ** 2), t(3 * 2 + 4 * 2)], t(3 ** 2 + 4 ** 2),
            'Räkna ut potenserna först: 9 + 16 = 25. (3 + 4)² = 49 är ett annat uttryck.'),
        skriv('Vad är (−3)²?', t((-3) ** 2),
              '(−3)² = (−3) · (−3). Minus gånger minus blir plus, så svaret är 9.'),
        ordna_tal('Ordna från minst till störst.',
                  [('%d%s' % (b, up(e)), b ** e) for b, e in ((5, 2), (2, 3), (2, 4), (3, 2))],
                  '2³ = 8, 3² = 9, 2⁴ = 16 och 5² = 25.'),
    ], beskrivning='Vad en potens betyder och hur man räknar ut den.'),

    niva('ma-ak7-potenser-2', 'Tiopotenser och prefix', 'Potenser', [
        para('Para ihop tiopotensen med talet.', [('10' + up(e), svtal(10 ** e)) for e in (2, 3, 5, 6)],
             'Exponenten i en tiopotens visar hur många nollor talet har. 10⁵ = 100 000 har fem nollor, '
             'och 10⁶ = 1 000 000 är en miljon.'),
        sant('2⁴ är lika mycket som 4².', 2 ** 4 == 4 ** 2,
             '2⁴ = 2 · 2 · 2 · 2 = 16 och 4² = 4 · 4 = 16. Det gäller inte alla tal: 2³ = 8 men 3² = 9.'),
        val('Vilket tal är 3 · 10⁴?', [svtal(3 * 10 ** 4), svtal(3 * 10 ** 3), svtal(3 * 10 ** 5), svtal(3 ** 4)],
            svtal(3 * 10 ** 4),
            '10⁴ = 10 000, och 3 · 10 000 = 30 000. 81 får den som räknar 3⁴ i stället.'),
        para('Para ihop prefixet med talet det står för. Prefixet står först i enheter som kilometer och milligram.',
             [(namn, svtal(v)) for namn, v in PREFIX],
             'Kilo är tusen, 1 000 = 10³, och hekto hundra, 100 = 10². Deci, centi och milli är en tiondel, '
             'en hundradel och en tusendel: en millimeter är 0,001 meter.'),
        skriv('Hur många meter är 4,5 km?', t(F(45, 10) * dict(PREFIX)['kilo']),
              'Kilo betyder tusen, så 1 km = 1 000 m. 4,5 · 1 000 = 4 500 m.'),
        sant('En millimeter är en hundradel av en meter.', dict(PREFIX)['milli'] == F(1, 100),
             'Milli betyder en tusendel, så 1 mm = 0,001 m. En hundradel av en meter är en centimeter.'),
        skriv('En påse lösgodis väger 3,5 hg. Hur många gram är det?', t(F(35, 10) * dict(PREFIX)['hekto']),
              'Hekto betyder hundra, så 1 hg = 100 g. 3,5 · 100 = 350 g.'),
        ordna_tal('Ordna längderna från kortast till längst.', LANGDER,
                  'Gör om allt till millimeter: 0,3 dm = 30 mm, 4 cm = 40 mm och 0,05 m = 50 mm. '
                  '35 mm hamnar mellan 30 och 40.'),
    ], beskrivning='Tiopotenser som 10⁶ och prefix som kilo, centi och milli, som gör stora och små tal '
                   'lättare att skriva.'),
])


# ---------------------------------------------------------------- åk 8
# Den första riktiga eleven går i åk 8. Varje område är en stig i NexLäx
# med minst två steg, introduktionen först, och områdena står i den ordning
# de bygger på varandra: att förenkla uttryck behövs för x på båda sidor,
# och förändringsfaktorn för flera förändringar i rad.

# Algebra: rätt svar är samma uttryck, och de felaktiga är det inte.
assert samma(lambda x: 3 * x + 5 * x, lambda x: 8 * x)
assert not any(samma(lambda x: 3 * x + 5 * x, g) for g in (lambda x: 15 * x, lambda x: 8 * x * x, lambda x: 8))
assert samma(lambda a: 4 * a + 3 + 2 * a + 5, lambda a: 6 * a + 8)
assert not any(samma(lambda a: 4 * a + 3 + 2 * a + 5, g) for g in (lambda a: 14 * a, lambda a: 6 * a + 15))
assert samma(lambda y: 7 * y - 2 * y, lambda y: 5 * y)
assert samma(lambda x: 3 * (x + 4), lambda x: 3 * x + 12)
assert not any(samma(lambda x: 3 * (x + 4), g) for g in (lambda x: 3 * x + 4, lambda x: x + 12, lambda x: 3 * x + 7))
assert samma(lambda x: 5 * x - (2 * x + 3), lambda x: 3 * x - 3)
assert not any(samma(lambda x: 5 * x - (2 * x + 3), g) for g in (lambda x: 3 * x + 3, lambda x: 7 * x + 3))
assert samma(lambda x: 2 * (x + 3) + 4 * x, lambda x: 2 * x + 6 + 4 * x)
assert samma(lambda x: 2 * x + 6 + 4 * x, lambda x: 6 * x + 6)
assert not samma(lambda x: 2 * (x + 3) + 4 * x, lambda x: 2 * x + 3 + 4 * x)

# Pythagoras: bara en av trianglarna är rätvinklig.
TRIANGLAR = [(9, 12, 15), (5, 6, 7), (4, 6, 8), (7, 8, 10)]
assert [s for s in TRIANGLAR if s[0] ** 2 + s[1] ** 2 == s[2] ** 2] == [(9, 12, 15)]

# Sannolikhet: två slantsinglingar, och påsen i sista frågan.
SLANT2 = list(product('KL', repeat=2))
KULOR = {'Grön': 8, 'Vit': 1, 'Gul': 5, 'Röd': 2}

# Algebrans ord: ekvationerna bland alternativen är samma ekvation, löst ett steg i taget.
assert los(3, 5, 0, 20) == los(3, 0, 0, 15) == 5
# Uttryck ur text: uttrycken i matchningen är olika uttryck, så bara en
# parning stämmer, och bara ett alternativ är samma uttryck som texten.
UTTRYCK_UR_TEXT = [('Dubbelt så stort som talet', '2n', lambda n: 2 * n),
                   ('Tre mer än talet', 'n + 3', lambda n: n + 3),
                   ('Tre mindre än talet', 'n − 3', lambda n: n - 3),
                   ('Hälften av talet', 'n/2', lambda n: n / 2),
                   ('Talet gånger sig självt', 'n²', lambda n: n * n)]
assert not any(samma(a[2], b[2]) for i, a in enumerate(UTTRYCK_UR_TEXT) for b in UTTRYCK_UR_TEXT[i + 1:])
assert not any(samma(lambda b: 2 * b + 45, g)
               for g in (lambda b: 2 * (b + 45), lambda b: b + 90, lambda b: 2 * b + 90))
assert samma(lambda x: x + 3 + x + 3, lambda x: 2 * x + 6)
assert not any(samma(lambda x: 2 * x + 6, g) for g in (lambda x: 3 * x, lambda x: x + 3, lambda x: 2 * x + 3))
assert not any(samma2(lambda h, k: 2 * h + 4 * k, g)
               for g in (lambda h, k: 4 * h + 2 * k, lambda h, k: 6 * (h + k), lambda h, k: h + k + 6))
assert 400 + 350 * 3 == 1450 and 3 * 25 + 40 == 115
# Ekvationer med parenteser: de felaktiga svaren är vanliga misstag, och inget av dem stämmer.
assert los(2, 8, 0, 18) == 5 and not any(2 * (x + 4) == 18 for x in (los(2, 4, 0, 18), F(18, 2)))
assert los(4, 4, 2, 14) == 5 and not any(4 * (x + 1) == 2 * (x + 7) for x in (los(4, 1, 2, 7), 10))
# 7 − (x − 3) = 4 är 10 − x = 4. Med fel tecken blir det 4 − x = 4 och x = 0.
assert los(-1, 10, 0, 4) == 6 and 7 - (6 - 3) == 4 and los(-1, 4, 0, 4) == 0
EKV_PARENTES = [parentesekvation(*e) for e in ((2, 1, 10), (3, -2, 9), (5, 2, 15), (3, 5, 6))]
assert [x for _, x in EKV_PARENTES] == [4, 5, 1, -3]
# Från text till ekvation: 3x + 4 = 25 har lösningen 7, och ingen av de andra ekvationerna har den.
assert los(3, 4, 0, 25) == 7 and all(los(*e) != 7 for e in ((3, 12, 0, 25), (3, 0, 0, 25 + 4), (4, 3, 0, 25)))
assert los(1, -5, 0, 20) == 25 and los(-1, 5, 0, 20) == -15
assert los(4, 60, 0, 500) == 110 and los(2, 3, 0, 29) == 13 and los(6, 0, 0, 30) == 5 and los(2, -9, 0, 31) == 20
# Procent, bråk och decimaltal.
BRAK_PROCENT = [F(1, 2), F(1, 4), F(3, 4), F(1, 5), F(1, 10)]
DECIMAL_PROCENT = [F(5, 100), F(5, 10), F(15, 100), F(15, 10)]
PROCENTFORMER = [('1/4', F(1, 4)), ('0,3', F(3, 10)), ('35 %', F(35, 100)), ('2/5', F(2, 5))]
assert F(12, 48) == F(1, 4) and F(25, 100) * 60 == 15
# Flera förändringar i rad: fyra kedjor med fyra olika faktorer.
KEDJOR = [(10, 10), (10, -10), (-10, -10), (20, -50)]
assert [faktor(a) * faktor(b) for a, b in KEDJOR] == [F(121, 100), F(99, 100), F(81, 100), F(6, 10)]
assert 500 * faktor(20) == 600 and faktor(20) * faktor(-30) == F(84, 100)
assert faktor(-20) * faktor(-25) == F(6, 10) and faktor(25) * faktor(-20) == 1
assert faktor(5) * faktor(-20) == F(84, 100) and 4000 * F(84, 100) == 3360
# Area och volym, med π ≈ 3,14 som frågorna säger. Med π på räknaren blir
# svaren 78,54 och 502,65, och samma alternativ är närmast.
PI = F(314, 100)
assert abs(float(PI * 5 ** 2) - pi * 5 ** 2) < 0.1 and abs(float(PI * 4 ** 2 * 10) - pi * 4 ** 2 * 10) < 0.5
FIGURER = [('Kvadrat, sidan 4 cm', F(4 * 4)), ('Triangel, bas 10 cm, höjd 3 cm', F(10 * 3, 2)),
           ('Cirkel, radien 2 cm', PI * 2 ** 2), ('Rektangel, sidorna 6 och 3 cm', F(6 * 3))]
# Cirkeln är minst också med π på räknaren.
assert pi * 2 ** 2 < min(v for namn, v in FIGURER if not namn.startswith('Cirkel'))
# Utfall och kombinationer.
TVA_TARNINGAR = list(product(range(1, 7), repeat=2))
SUMMOR = {s: F(sum(1 for a, b in TVA_TARNINGAR if a + b == s), len(TVA_TARNINGAR)) for s in range(2, 13)}
assert [SUMMOR[s] for s in (12, 10, 5, 7)] == [F(1, 36), F(3, 36), F(4, 36), F(6, 36)]
TARNINGEN = [(namn, F(sum(1 for s in range(1, 7) if villkor(s)), 6)) for namn, villkor in (
    ('En sexa', lambda s: s == 6), ('Inte en sexa', lambda s: s != 6), ('Ett udda tal', lambda s: s % 2 == 1),
    ('Ett tal större än 4', lambda s: s > 4), ('En sjua', lambda s: s == 7))]
assert [p for _, p in TARNINGEN] == [F(1, 6), F(5, 6), F(1, 2), F(1, 3), 0]

AK8 = bana('Matematik', 'ak8', [
    niva('ma-ak8-algebra-begrepp', 'Algebrans ord', 'Algebra', [
        para('Para ihop ordet med vad det betyder.',
             [('Variabel', 'En bokstav som kan stå för olika tal'),
              ('Koefficient', 'Talet som står framför en variabel'),
              ('Uttryck', 'Tal och variabler med räknetecken, utan likhetstecken'),
              ('Likhet', 'Två uttryck med ett likhetstecken emellan')],
             'I 5x + 2 är x en variabel och 5 dess koefficient. 5x + 2 är ett uttryck, och 5x + 2 = 12 är en '
             'likhet, för där står ett likhetstecken mellan två uttryck. En likhet med ett okänt tal kallas ekvation.'),
        para('Titta på uttrycket 4x + 9. Para ihop ordet med rätt del av uttrycket.',
             [('Variabeln', 'x'), ('Koefficienten', '4'), ('Konstanttermen', '9')],
             '4x betyder 4 · x. x är variabeln och 4 koefficienten framför den. 9 är en term utan variabel, '
             'och en sådan term kallas konstantterm.'),
        sant('Uttrycket 3x + 5 har tre termer.', False,
             'Termerna skiljs åt av plus- och minustecken. 3x + 5 har två termer, 3x och 5. 3x är en enda term, '
             'fast den består av både ett tal och en bokstav.'),
        val('Tre av alternativen är ekvationer. Vilket är ett uttryck?', ['3x + 5', '3x + 5 = 20', '3x = 15', 'x = 5'],
            '3x + 5',
            'Ett uttryck har inget likhetstecken. De andra tre har det, och de är samma ekvation löst ett steg i taget.'),
        sant('x och 1x betyder samma sak.', samma(lambda x: x, lambda x: 1 * x),
             'x är samma sak som 1 · x. Ettan skrivs inte ut, men koefficienten framför x är 1.'),
        val('Vilka två termer går att slå ihop till en term?', ['4x och 7x', '4x och 4y', '4x och 4', '4x och x²'],
            '4x och 7x',
            'Bara termer av samma sort går att slå ihop, alltså med samma variabel och samma exponent: '
            '4x + 7x = 11x. x² är x · x, en annan sort än x, 4y har en annan variabel, och 4x + 4 går inte '
            'att skriva kortare.'),
        skriv('Vad är värdet av 2x om x = 3?', t(2 * 3),
              '2x betyder 2 · x, och 2 · 3 = 6. Siffrorna ställs inte bredvid varandra, så 2x blir inte 23.'),
        ordna_tal('Sätt in x = 2 och ordna uttrycken från minst till störst värde.',
                  [('x + 2', 2 + 2), ('3x', 3 * 2), ('10 − x', 10 - 2), ('5x − 1', 5 * 2 - 1)],
                  'Med x = 2 blir x + 2 = 4, 3x = 6, 10 − x = 8 och 5x − 1 = 9.'),
    ], beskrivning='Orden i algebran: variabel, term, koefficient, konstantterm, uttryck och likhet.'),

    niva('ma-ak8-algebra-1', 'Förenkla uttryck', 'Algebra', [
        val('Förenkla 3x + 5x.', ['8x', '15x', '8x²', '8'], '8x',
            'Tre x plus fem x blir åtta x. Talen framför x läggs ihop, och x står kvar.'),
        val('Förenkla 4a + 3 + 2a + 5.', ['6a + 8', '14a', '6a + 15'], '6a + 8',
            'Slå ihop a-termerna för sig (4a + 2a = 6a) och talen för sig (3 + 5 = 8). '
            'En a-term och ett tal kan inte slås ihop.'),
        skriv('Förenkla 7y − 2y.', monom(7 - 2, 'y'),
              'Sju y minus två y blir fem y, alltså 5y.'),
        val('Multiplicera in: 3(x + 4).', ['3x + 12', '3x + 4', 'x + 12', '3x + 7'], '3x + 12',
            'Både x och 4 ska multipliceras med 3: 3 · x + 3 · 4 = 3x + 12.'),
        val('Förenkla 5x − (2x + 3).', ['3x − 3', '3x + 3', '7x + 3'], '3x − 3',
            'Minustecknet framför parentesen gäller allt inuti: 5x − 2x − 3 = 3x − 3.'),
        skriv('Vad är värdet av 2x + 7 om x = 4?', t(2 * 4 + 7),
              'Sätt in 4 i stället för x: 2 · 4 + 7 = 8 + 7 = 15.'),
        skriv('Vad är värdet av 3a − 5 om a = −2?', neg_svar(3 * (-2) - 5),
              'Sätt in −2 i stället för a: 3 · (−2) − 5 = −6 − 5 = −11.'),
        ordna('Förenkla 2(x + 3) + 4x steg för steg. Ordna raderna. En bricka blir över.',
              ['2(x + 3) + 4x', '2x + 6 + 4x', '6x + 6'], extra=['2x + 3 + 4x'],
              forklaring='Multiplicera först in 2 i parentesen: både x och 3 ska multipliceras med 2. '
                         'Slå sedan ihop x-termerna: 2x + 4x = 6x.'),
    ], beskrivning='Slå ihop termer, multiplicera in i parenteser och räkna ut värdet av ett uttryck.'),

    niva('ma-ak8-algebra-2', 'Uttryck ur text', 'Algebra', [
        para('Talet kallas n. Para ihop texten med uttrycket.', [(text, u) for text, u, _ in UTTRYCK_UR_TEXT],
             'Tre mindre än talet är n − 3, inte 3 − n: du börjar med talet och drar bort 3. '
             'Talet gånger sig självt är n · n, som skrivs n².'),
        sant('”Fem mer än x” skrivs 5x.', samma(lambda x: 5 * x, lambda x: x + 5),
             '5x betyder 5 · x, alltså fem gånger så mycket. Fem mer än x är x + 5.'),
        skriv('I varje påse finns p kulor. Skriv ett uttryck för hur många kulor det finns i 7 påsar.', monom(7, 'p'),
              'Sju påsar med p kulor i varje blir 7 · p kulor, och det skrivs 7p.'),
        val('En biobiljett kostar b kr och en påse popcorn 45 kr. Vilket uttryck visar vad två biljetter och '
            'en påse popcorn kostar tillsammans?',
            ['2b + 45', '2(b + 45)', 'b + 90', '2b + 90'], '2b + 45',
            'Två biljetter kostar 2 · b = 2b kr, och en påse popcorn 45 kr. Tillsammans blir det 2b + 45. '
            '2(b + 45) hade varit två biljetter och två påsar popcorn.'),
        val('En rektangel är x cm lång och 3 cm bred. Vilket uttryck ger omkretsen i cm?',
            ['2x + 6', '3x', 'x + 3', '2x + 3'], '2x + 6',
            'Omkretsen är alla fyra sidor: x + 3 + x + 3 = 2x + 6. 3x är rektangelns area.'),
        skriv('En elektriker tar 400 kr för att komma och sedan 350 kr per timme. Kostnaden i kronor för t timmar '
              'är 400 + 350t. Hur många kronor kostar det om hon arbetar i 3 timmar?', t(400 + 350 * 3),
              'Sätt in t = 3: 400 + 350 · 3 = 400 + 1 050 = 1 450 kr.'),
        val('På en gård finns h hönor och k kor. Vilket uttryck ger antalet ben?',
            ['2h + 4k', '4h + 2k', '6(h + k)', 'h + k + 6'], '2h + 4k',
            'En höna har 2 ben och en ko har 4. h hönor har 2h ben och k kor har 4k ben, tillsammans 2h + 4k.'),
        ordna('En penna kostar p kr och en sax 40 kr. Ställ upp ett uttryck för tre pennor och en sax och räkna ut '
              'priset när p = 25. Ordna stegen. En bricka blir över.',
              ['3p + 40', '3 · 25 + 40', '%d + 40' % (3 * 25), '%d' % (3 * 25 + 40)], extra=['%d%d + 40' % (3, 25)],
              forklaring='Tre pennor kostar 3p kr. Sätt sedan in 25 i stället för p: 3 · 25 = 75, och '
                         '75 + 40 = 115 kr. 325 + 40 får den som ställer 3 och 25 bredvid varandra, '
                         'men 3p betyder 3 · p.'),
    ], beskrivning='Ställa upp uttryck ur vardagliga beskrivningar och räkna ut vad de är värda.'),

    niva('ma-ak8-ekvationer-1', 'x på båda sidor', 'Ekvationer', [
        val('Lös 5x = 2x + 9. Vad är x?', [t(los(5, 0, 2, 9)), t(9), t(9 * 3)], t(los(5, 0, 2, 9)),
            'Dra bort 2x från båda sidor: 3x = 9. Dela med 3: x = 3.'),
        skriv('Lös 4x + 3 = x + 15. Vad är x?', x_svar(los(4, 3, 1, 15)),
              'Dra bort x från båda sidor: 3x + 3 = 15. Dra bort 3: 3x = 12, så x = 4.'),
        val('Du ska lösa 7x − 4 = 3x + 8. Vilket är ett bra första steg?',
            ['Dra bort 3x från båda sidor', 'Dra bort 3x bara från högra sidan',
             'Lägg till 4 bara på vänstra sidan', 'Dela vänstra sidan med 7'],
            'Dra bort 3x från båda sidor',
            'Det du gör på ena sidan måste du göra på den andra, annars stämmer inte likheten längre. '
            'Att dra bort 3x från båda sidor samlar x-termerna till vänster.'),
        skriv('Lös 7x − 4 = 3x + 8. Vad är x?', x_svar(los(7, -4, 3, 8)),
              'Dra bort 3x: 4x − 4 = 8. Lägg till 4: 4x = 12. Dela med 4: x = 3.'),
        val('Lös 2(x + 5) = 4x. Vad är x?',
            [m(los(2, 10, 4, 0)), m(los(2, 5, 4, 0)), m(10), m(-los(2, 10, 4, 0))], m(los(2, 10, 4, 0)),
            'Multiplicera in: 2x + 10 = 4x. Dra bort 2x: 10 = 2x, så x = 5.'),
        val('Lös 6 − x = x + 2. Vad är x?', [m(los(-1, 6, 1, 2)), m(6 - 2), m(-los(-1, 6, 1, 2))],
            m(los(-1, 6, 1, 2)),
            'Lägg till x på båda sidor: 6 = 2x + 2. Dra bort 2: 4 = 2x, så x = 2.'),
        skriv('Lös x + 9 = 4x + 15. Vad är x?', x_svar(los(1, 9, 4, 15)),
              'Dra bort x: 9 = 3x + 15. Dra bort 15: −6 = 3x, så x = −2.'),
        ordna('Ordna stegen för att lösa 5x + 1 = 2x + 13.',
              ['5x + 1 = 2x + 13', '%dx + 1 = 13' % (5 - 2), '%dx = %d' % (5 - 2, 13 - 1),
               'x = %s' % t(los(5, 1, 2, 13))],
              forklaring='Samla först x-termerna på ena sidan genom att dra bort 2x. '
                         'Dra sedan bort 1 och dela till sist med 3.'),
    ], beskrivning='Lösa ekvationer där x står på båda sidor om likhetstecknet.'),

    niva('ma-ak8-ekvationer-2', 'Ekvationer med parenteser', 'Ekvationer', [
        val('Lös 2(x + 4) = 18. Vad är x?', [t(los(2, 8, 0, 18)), t(los(2, 4, 0, 18)), t(F(18, 2))],
            t(los(2, 8, 0, 18)),
            'Multiplicera in: 2x + 8 = 18. Dra bort 8: 2x = 10, så x = 5. Du kan också dela båda sidor med 2 '
            'först: x + 4 = 9, och x = 5.'),
        skriv('Lös 5(x − 2) = 30. Vad är x?', x_svar(los(5, -10, 0, 30)),
              'Multiplicera in: 5x − 10 = 30. Lägg till 10: 5x = 40, så x = 8.'),
        para('Para ihop ekvationen med dess lösning.', [(e, 'x = %s' % m(x)) for e, x in EKV_PARENTES],
             'Dela båda sidor med talet framför parentesen, eller multiplicera in. 3(x + 5) = 6 ger x + 5 = 2, '
             'så x = −3.'),
        sant('Om 2(x + 3) = 14 så är x + 3 = 7.', los(2, 6, 0, 14) + 3 == 7,
             'Dela båda sidor med 2: 2(x + 3) / 2 = x + 3 och 14 / 2 = 7. Ibland går det fortare att dela först '
             'än att multiplicera in.'),
        val('Lös 4(x + 1) = 2(x + 7). Vad är x?', [t(los(4, 4, 2, 14)), t(los(4, 1, 2, 7)), t(10)],
            t(los(4, 4, 2, 14)),
            'Multiplicera in på båda sidor: 4x + 4 = 2x + 14. Dra bort 2x och 4: 2x = 10, så x = 5.'),
        skriv('Lös 7 − (x − 3) = 4. Vad är x?', x_svar(los(-1, 10, 0, 4)),
              'Minustecknet framför parentesen byter tecken på allt inuti: 7 − x + 3 = 4, alltså 10 − x = 4. '
              'Då är x = 6.'),
        skriv('Lös 3(2x − 1) = 4x + 11. Vad är x?', x_svar(los(6, -3, 4, 11)),
              'Multiplicera in: 6x − 3 = 4x + 11. Dra bort 4x: 2x − 3 = 11. Lägg till 3: 2x = 14, så x = 7.'),
        ordna('Ordna stegen för att lösa 5(x + 2) = 3x + 16. En bricka blir över.',
              ['5(x + 2) = 3x + 16', '5x + 10 = 3x + 16', '%dx + 10 = 16' % (5 - 3),
               '%dx = %d' % (5 - 3, 16 - 10), 'x = %s' % t(los(5, 10, 3, 16))],
              extra=['5x + 2 = 3x + 16'],
              forklaring='Multiplicera först in 5 i parentesen, både x och 2. Dra sedan bort 3x och 10, och dela '
                         'till sist med 2. 5x + 2 blir det om man glömmer att multiplicera 2 med 5.'),
    ], beskrivning='Lösa ekvationer med parenteser, genom att multiplicera in eller dela först.'),

    niva('ma-ak8-ekvationer-3', 'Från text till ekvation', 'Ekvationer', [
        para('Talet kallas x. Para ihop texten med ekvationen.',
             [('Talet plus 7 är 12', 'x + 7 = 12'), ('Dubbelt så mycket som talet är 12', '2x = 12'),
              ('Talet minus 7 är 12', 'x − 7 = 12'), ('Hälften av talet är 12', 'x/2 = 12')],
             'Översätt bit för bit: talet minus 7 blir x − 7, hälften av talet x/2, och ordet ”är” blir '
             'likhetstecknet. Se upp med ”7 mindre än talet”, som också är x − 7.'),
        sant('Om talet kallas x blir texten ”ett tal minskat med 5 är 20” ekvationen 5 − x = 20.',
             los(-1, 5, 0, 20) == los(1, -5, 0, 20),
             'Du börjar med talet och drar bort 5, alltså x − 5 = 20. 5 − x = 20 har ett helt annat svar.'),
        val('Jag tänker på ett tal. Om jag multiplicerar det med 3 och lägger till 4 får jag 25. '
            'Vilken ekvation passar?', ['3x + 4 = 25', '3(x + 4) = 25', '3x = 25 + 4', '3 + 4x = 25'], '3x + 4 = 25',
            'Först gånger 3, som blir 3x, och sedan plus 4: 3x + 4. ”Får jag 25” blir = 25. '
            '3(x + 4) hade betytt att man lägger till 4 först.'),
        skriv('Jag tänker på ett tal. Om jag dubblar det och sedan drar bort 9 får jag 31. Vilket tal tänker jag på?',
              t(los(2, -9, 0, 31)),
              'Ekvationen är 2x − 9 = 31. Lägg till 9: 2x = 40, så x = 20. Pröva: 2 · 20 − 9 = 31.'),
        skriv('Emma är 3 år äldre än sin bror Hugo. Tillsammans är de 29 år. Hur gammal är Hugo?',
              t(los(2, 3, 0, 29)),
              'Kalla Hugos ålder x. Då är Emma x + 3 år, och x + x + 3 = 29. Det ger 2x = 26, så Hugo är 13 år.'),
        val('Sofia köper 4 böcker som kostar lika mycket. Hon betalar med en 500-lapp och får 60 kr tillbaka. '
            'Hur mycket kostar en bok?',
            ['%s kr' % t(v) for v in (los(4, 60, 0, 500), F(500, 4), F(500 + 60, 4), 500 - 60)],
            '%s kr' % t(los(4, 60, 0, 500)),
            'Kalla priset för en bok x. Böckerna och växeln är tillsammans 500 kr: 4x + 60 = 500. '
            'Dra bort 60: 4x = 440, så en bok kostar 110 kr.'),
        skriv('En rektangel är dubbelt så lång som den är bred. Omkretsen är 30 cm. Hur många centimeter bred är den?',
              t(los(6, 0, 0, 30)),
              'Kalla bredden x. Då är längden 2x, och omkretsen x + 2x + x + 2x = 6x. 6x = 30 ger x = 5.'),
        ordna('Ett tal multipliceras med 4, och sedan dras 6 bort. Då blir det 30. Ordna stegen för att hitta '
              'talet. En bricka blir över.',
              ['4x − 6 = 30', '4x = %d' % (30 + 6), 'x = %s' % t(los(4, -6, 0, 30))], extra=['4(x − 6) = 30'],
              forklaring='Först gånger 4 och sedan minus 6 blir 4x − 6. 4(x − 6) hade betytt att 6 dras bort '
                         'först. Lägg till 6 på båda sidor och dela med 4: x = 9.'),
    ], beskrivning='Ställa upp en ekvation ur en text, lösa den och pröva svaret.'),

    niva('ma-ak8-procent-begrepp', 'Procent, bråk och decimaltal', 'Procent', [
        para('Para ihop bråket med samma andel i procent.', [(br(x), procent(x)) for x in BRAK_PROCENT],
             'Procent betyder hundradelar. 1/4 = 25/100 = 25 %, och 1/5 = 20/100 = 20 %.'),
        para('Para ihop decimaltalet med samma tal i procent.', [(m(x), procent(x)) for x in DECIMAL_PROCENT],
             'Multiplicera med 100, alltså flytta decimaltecknet två steg åt höger: 0,05 = 5 %, 0,5 = 50 % '
             'och 1,5 = 150 %.'),
        sant('0,3 är samma sak som 3 %.', F(3, 10) == F(3, 100),
             '0,3 = 30/100 = 30 %. 3 % är 0,03, tio gånger mindre.'),
        skriv('Skriv 3/5 i procent.', t(F(3, 5) * 100),
              '3/5 = 6/10 = 60/100, alltså 60 %.'),
        val('Hur många procent är 1/8?', [procent(F(1, 8)), '8 %', '%s %%' % m(F(1, 8)), procent(F(1, 80))],
            procent(F(1, 8)),
            '1/8 är hälften av 1/4. 1/4 = 25 %, så 1/8 = 12,5 %. Som decimaltal är 1/8 = 0,125, och 0,125 är '
            '12,5 hundradelar.'),
        skriv('Hur många procent är 12 av 48?', t(F(12, 48) * 100),
              'Dela delen med det hela: 12 / 48 = 0,25 = 25 %. Det är samma sak som 1/4.'),
        sant('25 % av 60 är lika mycket som 1/4 av 60.', F(25, 100) * 60 == F(1, 4) * 60,
             '25 % och 1/4 är samma andel, så båda blir 15.'),
        ordna_tal('Ordna från minst till störst.', PROCENTFORMER,
                  'Skriv alla som decimaltal: 1/4 = 0,25, 35 % = 0,35 och 2/5 = 0,4. 0,3 hamnar mellan 0,25 '
                  'och 0,35.'),
    ], beskrivning='Samma andel skriven som bråk, decimaltal och procent, och hur man byter mellan dem.'),

    niva('ma-ak8-procent-1', 'Förändringsfaktor', 'Procent', [
        val('Ett pris höjs med 20 %. Vilken är förändringsfaktorn?', ['1,2', '0,2', '0,8', '120'],
            t(1 + F(20, 100)),
            'Det nya priset är 100 % + 20 % = 120 % av det gamla, och 120 % = 1,2.'),
        val('Ett pris sänks med 15 %. Vilken är förändringsfaktorn?', ['0,85', '0,15', '1,15'],
            t(1 - F(15, 100)),
            'Kvar blir 100 % − 15 % = 85 % av priset, och 85 % = 0,85.'),
        skriv('En cykel kostar 3 000 kr. Priset höjs med 10 %. Hur många kronor kostar cykeln nu?',
              t(3000 * (1 + F(10, 100))),
              'Förändringsfaktorn är 1,1. 1,1 · 3 000 = 3 300 kr.'),
        skriv('En jacka kostar 800 kr och säljs med 25 % rabatt. Hur många kronor kostar den nu?',
              t(800 * (1 - F(25, 100))),
              'Förändringsfaktorn är 1 − 0,25 = 0,75, och 0,75 · 800 = 600 kr.'),
        val('Förändringsfaktorn är 1,06. Vad har hänt?',
            ['Ökat med 6 %', 'Ökat med 106 %', 'Minskat med 6 %', 'Ökat med 0,06 %'], 'Ökat med 6 %',
            '1,06 = 106 %. Det är 6 % mer än de 100 % man började med.'),
        val('En biljett kostade 50 kr och kostar nu 60 kr. Med hur många procent har priset ökat?',
            ['%s %%' % t(F(60 - 50, 50) * 100), '10 %',
             '%s %%' % t(round(float(F(60 - 50, 60) * 100))), '120 %'],
            '%s %%' % t(F(60 - 50, 50) * 100),
            'Priset har ökat med 10 kr. Jämför med det gamla priset: 10 / 50 = 0,2 = 20 %.'),
        skriv('En mobil kostade 4 000 kr och kostar nu 3 400 kr. Med hur många procent har priset sänkts?',
              t(F(4000 - 3400, 4000) * 100),
              'Sänkningen är 600 kr. Jämför med det gamla priset: 600 / 4 000 = 0,15 = 15 %.'),
        ordna_tal('Ordna förändringsfaktorerna från störst minskning till störst ökning.',
                  [('1,05', F(105, 100)), ('0,7', F(7, 10)), ('1,3', F(13, 10)), ('0,95', F(95, 100))],
                  '0,7 är en minskning med 30 % och 0,95 en minskning med 5 %. '
                  '1,05 är en ökning med 5 % och 1,3 en ökning med 30 %.'),
    ], beskrivning='Räkna med förändringsfaktor när något ökar eller minskar i procent.'),

    niva('ma-ak8-procent-2', 'Flera förändringar i rad', 'Procent', [
        sant('Ett pris höjs med 10 %, och sedan sänks det nya priset med 10 %. Då är det tillbaka på samma pris '
             'som från början.', faktor(10) * faktor(-10) == 1,
             'Sänkningen räknas på det nya, högre priset. 1,1 · 0,9 = 0,99, så priset blir 99 % av det gamla, '
             'alltså 1 % lägre.'),
        skriv('En tröja kostar 500 kr. Priset höjs med 20 %, och sedan sänks det nya priset med 20 %. '
              'Hur många kronor kostar tröjan nu?', t(500 * faktor(20) * faktor(-20)),
              'Efter höjningen kostar den 500 · 1,2 = 600 kr. 20 % av 600 kr är 120 kr, så nu kostar den '
              '600 − 120 = 480 kr. Snabbare: 500 · 1,2 · 0,8 = 480.'),
        val('Ett pris höjs med 20 %, och sedan höjs det nya priset med 20 %. Med hur många procent har priset '
            'höjts totalt?',
            [procent(faktor(20) ** 2 - 1), '40 %', '20 %', procent(faktor(20) ** 2)], procent(faktor(20) ** 2 - 1),
            '1,2 · 1,2 = 1,44. Det nya priset är 144 % av det gamla, alltså 44 % högre. Det blir mer än 40 %, '
            'för den andra höjningen räknas på det högre priset.'),
        para('Para ihop förändringarna med den totala förändringsfaktorn.',
             [('%s och sedan %s' % (andring(a), andring(b)), t(faktor(a) * faktor(b))) for a, b in KEDJOR],
             'Multiplicera faktorerna: 1,1 · 1,1 = 1,21, 1,1 · 0,9 = 0,99, 0,9 · 0,9 = 0,81 och 1,2 · 0,5 = 0,6.'),
        sant('Att höja ett pris med 20 % och sedan sänka det med 30 % ger samma slutpris som att först sänka med '
             '30 % och sedan höja med 20 %.', faktor(20) * faktor(-30) == faktor(-30) * faktor(20),
             'Faktorerna multipliceras, och i en multiplikation spelar ordningen ingen roll: '
             '1,2 · 0,7 = 0,7 · 1,2 = 0,84.'),
        skriv('Ett pris sänks med 20 %, och sedan sänks det nya priset med 25 %. Med hur många procent har priset '
              'sänkts totalt?', t((1 - faktor(-20) * faktor(-25)) * 100),
              '0,8 · 0,75 = 0,6. Priset är 60 % av det gamla, så det har sänkts med 40 %, inte med 45 %.'),
        val('Ett pris höjs med 25 %. Med hur många procent måste det nya priset sänkas för att bli det gamla igen?',
            [procent(1 - 1 / faktor(25)), '25 %', '75 %', '80 %'], procent(1 - 1 / faktor(25)),
            'Anta att priset var 100 kr. Efter höjningen är det 125 kr. Det ska ner 25 kr, och 25 av 125 är 20 %.'),
        ordna('En cykel kostar 4 000 kr. Priset höjs med 5 %, och sedan sänks det nya priset med 20 %. '
              'Ordna stegen för att räkna ut vad cykeln kostar nu. En bricka blir över.',
              ['Faktorerna är %s och %s' % (t(faktor(5)), t(faktor(-20))),
               '%s · %s · %s' % (tusental(4000), t(faktor(5)), t(faktor(-20))),
               '%s · %s' % (tusental(4000), t(faktor(5) * faktor(-20))),
               '%s kr' % tusental(4000 * faktor(5) * faktor(-20))],
              extra=['%s · %s' % (tusental(4000), t(faktor(5 - 20)))],
              forklaring='Faktorerna multipliceras: 1,05 · 0,8 = 0,84, och 4 000 · 0,84 = 3 360 kr. 0,85 får den '
                         'som lägger ihop procenten, 5 − 20 = −15, men sänkningen räknas på det nya priset.'),
    ], beskrivning='Räkna med flera procentuella förändringar efter varandra genom att multiplicera '
                   'förändringsfaktorerna.'),

    niva('ma-ak8-geometri-1', 'Pythagoras sats', 'Geometri', [
        val('Vad kallas den längsta sidan i en rätvinklig triangel?',
            ['Hypotenusa', 'Katet', 'Bas', 'Diagonal'], 'Hypotenusa',
            'Hypotenusan ligger mitt emot den räta vinkeln och är alltid längst. '
            'De två andra sidorna kallas kateter.'),
        val('I en rätvinklig triangel är c hypotenusan och a och b kateterna. Vilken formel är Pythagoras sats?',
            ['a² + b² = c²', 'a + b = c', 'a² + c² = b²', 'a · b = c²'], 'a² + b² = c²',
            'Kateternas kvadrater tillsammans är lika med hypotenusans kvadrat.'),
        skriv('Kateterna i en rätvinklig triangel är 3 cm och 4 cm. Hur många cm är hypotenusan?',
              t(rot(3 ** 2 + 4 ** 2)),
              '3² + 4² = 9 + 16 = 25, och √25 = 5.'),
        skriv('Kateterna i en rätvinklig triangel är 6 cm och 8 cm. Hur många cm är hypotenusan?',
              t(rot(6 ** 2 + 8 ** 2)),
              '6² + 8² = 36 + 64 = 100, och √100 = 10.'),
        val('I en rätvinklig triangel är hypotenusan 25 cm och ena kateten 7 cm. Hur lång är den andra kateten?',
            ['%s cm' % t(rot(25 ** 2 - 7 ** 2)), '%d cm' % (25 - 7),
             'cirka %d cm' % round(sqrt(25 ** 2 + 7 ** 2)), '%d cm' % (25 + 7)],
            '%s cm' % t(rot(25 ** 2 - 7 ** 2)),
            'Här söks en katet, så du drar bort: 25² − 7² = 625 − 49 = 576, och √576 = 24.'),
        val('Här är sidorna i fyra trianglar. Vilken av trianglarna är rätvinklig?',
            ['%d, %d och %d cm' % s for s in TRIANGLAR], '9, 12 och 15 cm',
            'Pröva a² + b² = c² med den längsta sidan som c: 9² + 12² = 81 + 144 = 225, och 15² = 225.'),
        skriv('En stege som är 2,5 m lång står lutad mot en lodrät vägg på plan mark. Stegens fot står '
              '0,7 m från väggen. Hur många meter upp på väggen når stegen?',
              t(rot(F(25, 10) ** 2 - F(7, 10) ** 2)),
              'Stegen är hypotenusan, så du drar bort: 2,5² − 0,7² = 6,25 − 0,49 = 5,76, och √5,76 = 2,4.'),
        ordna('Kateterna är 5 cm och 12 cm. Ordna stegen för att räkna ut hypotenusan c.',
              ['c² = 5² + 12²', 'c² = %d + %d' % (5 ** 2, 12 ** 2), 'c² = %d' % (5 ** 2 + 12 ** 2),
               'c = %s' % t(rot(5 ** 2 + 12 ** 2))],
              forklaring='Kvadrera kateterna, lägg ihop dem och dra till sist roten ur summan.'),
    ], beskrivning='Räkna ut en okänd sida i en rätvinklig triangel med Pythagoras sats.'),

    niva('ma-ak8-geometri-2', 'Area och volym', 'Geometri', [
        para('Para ihop med rätt formel.',
             [('Arean av en triangel', 'basen · höjden / 2'), ('Arean av en parallellogram', 'basen · höjden'),
              ('Arean av en cirkel', 'π · radien²'), ('Volymen av ett rätblock', 'längden · bredden · höjden'),
              ('Volymen av en cylinder', 'π · radien² · höjden')],
             'En triangel är hälften av en parallellogram med samma bas och höjd. Ett rätblock och en cylinder har '
             'volymen basytans area gånger höjden, och en cylinders basyta är en cirkel.'),
        skriv('En triangel har basen 8 cm och höjden 5 cm. Hur många cm² är arean?', t(F(8 * 5, 2)),
              'Arean av en triangel är basen gånger höjden delat med 2: 8 · 5 / 2 = 40 / 2 = 20 cm².'),
        val('En parallellogram har basen 7 cm och höjden 4 cm. Den sneda sidan är 5 cm. Hur stor är arean?',
            ['%s cm²' % t(v) for v in (7 * 4, 7 * 5, F(7 * 4, 2), 7 * 4 * 5)], '%s cm²' % t(7 * 4),
            'Arean är basen gånger höjden: 7 · 4 = 28 cm². Höjden står vinkelrätt mot basen, och den sneda '
            'sidan behövs inte.'),
        val('En cirkel har radien 5 cm. Hur stor är arean? Räkna med π ≈ 3,14.',
            ['%s cm²' % t(v) for v in (PI * 5 ** 2, 2 * PI * 5, PI * 5, PI * 10 ** 2)], '%s cm²' % t(PI * 5 ** 2),
            'π · r² = 3,14 · 5² = 3,14 · 25 = 78,5 cm². 31,4 är omkretsen i cm, och 314 får den som tar '
            'diametern 10 i kvadrat i stället för radien.'),
        sant('Om radien i en cirkel blir dubbelt så lång blir arean dubbelt så stor.',
             PI * (2 * 3) ** 2 == 2 * PI * 3 ** 2,
             'Radien står i kvadrat i π · r². Dubbelt så lång radie ger 2² = 4 gånger så stor area.'),
        skriv('Ett akvarium har formen av ett rätblock. Det är 50 cm långt, 30 cm brett och 40 cm högt. '
              'Hur många liter vatten rymmer det? 1 liter är 1 dm³.', t(F(50 * 30 * 40, 10 ** 3)),
              'Räkna i dm, för 1 dm³ är 1 liter: 5 · 3 · 4 = 60 dm³, alltså 60 liter. I cm blir det '
              '50 · 30 · 40 = 60 000 cm³, och 1 000 cm³ är 1 liter.'),
        val('En burk har formen av en cylinder. Radien är 4 cm och höjden 10 cm. Hur stor är volymen? '
            'Räkna med π ≈ 3,14.',
            ['%s cm³' % t(v) for v in (PI * 4 ** 2 * 10, PI * 4 * 10, 2 * PI * 4 * 10, 4 ** 2 * 10)],
            '%s cm³' % t(PI * 4 ** 2 * 10),
            'Basytan är en cirkel: 3,14 · 4² = 3,14 · 16 = 50,24 cm². Volymen är basytan gånger höjden: '
            '50,24 · 10 = 502,4 cm³.'),
        ordna_tal('Ordna figurerna efter area, från minst till störst.', FIGURER,
                  'Cirkeln har 3,14 · 2² ≈ 12,6 cm², triangeln 10 · 3 / 2 = 15 cm², kvadraten 4 · 4 = 16 cm² '
                  'och rektangeln 6 · 3 = 18 cm².'),
    ], beskrivning='Räkna ut arean av triangel, parallellogram och cirkel och volymen av rätblock och cylinder.'),

    niva('ma-ak8-sannolikhet-1', 'Hur troligt är det?', 'Sannolikhet', [
        val('Du slår en vanlig tärning. Hur stor är sannolikheten att få en sexa?',
            [br(F(1, 6)), '1/5', '6/1', '1/2'], br(F(1, 6)),
            'Tärningen har 6 sidor som är lika troliga, och en av dem är en sexa.'),
        val('Du slår en vanlig tärning. Hur stor är sannolikheten att få ett jämnt tal?',
            [br(F(sum(1 for s in range(1, 7) if s % 2 == 0), 6)), '1/3', '1/6', '2/3'],
            br(F(sum(1 for s in range(1, 7) if s % 2 == 0), 6)),
            'Tre av sex sidor är jämna: 2, 4 och 6. 3/6 = 1/2.'),
        skriv('I en påse finns 3 röda och 7 blå kulor. Du tar en kula utan att titta. '
              'Hur stor är sannolikheten att den är röd? Svara i procent.',
              t(F(3, 3 + 7) * 100),
              '3 av 10 kulor är röda. 3/10 = 0,3 = 30 %.'),
        val('Vilken sannolikhet har något som är omöjligt?', ['0', '1', '0,5', '100'], '0',
            'Sannolikheten 0 betyder att det aldrig händer, och 1 att det alltid händer. '
            'Alla sannolikheter ligger mellan 0 och 1.'),
        skriv('Sannolikheten att det regnar i morgon är 0,2. Hur stor är sannolikheten att det inte regnar? '
              'Svara med ett decimaltal.',
              [t(1 - F(2, 10))] + brak(1 - F(2, 10)),
              'Antingen regnar det eller inte, och tillsammans blir det 1. 1 − 0,2 = 0,8.'),
        val('Du singlar slant två gånger. Hur stor är sannolikheten att få krona båda gångerna?',
            [br(F(SLANT2.count(('K', 'K')), len(SLANT2))), '1/2', '1/3'],
            br(F(SLANT2.count(('K', 'K')), len(SLANT2))),
            'Det finns fyra lika troliga utfall: krona-krona, krona-klave, klave-krona och klave-klave. '
            'Ett av dem är krona båda gångerna.'),
        # Inget "ungefär" i frågan: det bjuder in "ca 10", som rättningen läser som text.
        skriv('Du slår en tärning 60 gånger. Hur många sexor kan du förvänta dig att få?', t(60 * F(1, 6)),
              'Sannolikheten för en sexa är 1/6, och 1/6 av 60 är 10. Det blir inte alltid exakt 10, '
              'men ungefär så många.'),
        ordna_tal('I en påse finns 8 gröna, 1 vit, 5 gula och 2 röda kulor. Du tar en kula utan att titta. '
                  'Ordna färgerna från minst till mest sannolik.',
                  list(KULOR.items()),
                  'Ju fler kulor av en färg, desto större chans. Av 16 kulor är 1 vit, 2 röda, 5 gula och 8 gröna.'),
    ], beskrivning='Räkna ut sannolikhet som bråk, decimaltal och procent.'),

    niva('ma-ak8-sannolikhet-2', 'Utfall och kombinationer', 'Sannolikhet', [
        para('Du slår en vanlig tärning. Para ihop händelsen med dess sannolikhet.',
             [(namn, br(p)) for namn, p in TARNINGEN],
             'Räkna sidorna: udda är 1, 3 och 5, alltså 3/6 = 1/2, och större än 4 är 5 och 6, alltså 2/6 = 1/3. '
             'Inte en sexa är allt utom sexan: 1 − 1/6 = 5/6. En sjua finns inte på tärningen, så den är omöjlig.'),
        skriv('Du har 3 tröjor och 4 par byxor. På hur många olika sätt kan du välja en tröja och ett par byxor?',
              t(len(list(product(range(3), range(4))))),
              'Till varje tröja finns 4 byxor att välja. 3 tröjor ger 3 · 4 = 12 olika kombinationer.'),
        val('Du slår en röd och en blå tärning. Hur många olika utfall finns det? Röd 2 och blå 5 är ett annat '
            'utfall än röd 5 och blå 2.', [t(len(TVA_TARNINGAR)), '12', '11', '6'], t(len(TVA_TARNINGAR)),
            'Den röda kan visa 6 olika, och för var och en av dem kan den blå visa 6 olika: 6 · 6 = 36. '
            'Summorna är bara 11 olika, från 2 till 12, men de är inte lika troliga.'),
        val('Du slår en röd och en blå tärning. Hur stor är sannolikheten att summan blir 7?',
            [br(SUMMOR[7]), '7/36', '1/11', '1/12'], br(SUMMOR[7]),
            'Sex av de 36 utfallen ger summan 7: 1 och 6, 2 och 5, 3 och 4, 4 och 3, 5 och 2, 6 och 1. '
            '6/36 = 1/6.'),
        sant('Med ett vanligt mynt har du fått krona fem gånger i rad. Då är chansen större att få klave nästa gång.',
             False,
             'Myntet minns inte vad som hänt förut. Varje gång är chansen 1/2 för krona och 1/2 för klave, '
             'hur många kronor det än blivit innan.'),
        skriv('Koden till ett cykellås har tre siffror, och varje siffra kan vara från 0 till 9. '
              'Hur många olika koder finns det?', t(10 ** 3),
              'Det finns 10 val för varje siffra: 10 · 10 · 10 = 1 000 koder, från 000 till 999.'),
        val('I en påse finns 2 röda och 3 blå kulor. Du drar en kula, lägger tillbaka den och drar en gång till. '
            'Hur stor är sannolikheten att båda kulorna är röda?',
            [br(F(2, 5) ** 2), br(F(2, 5)), br(2 * F(2, 5)), br(F(2, 5) * F(1, 4))], br(F(2, 5) ** 2),
            'Kulan läggs tillbaka, så chansen för röd är 2/5 båda gångerna. Två steg i rad multipliceras: '
            '2/5 · 2/5 = 4/25.'),
        ordna_tal('Du slår en röd och en blå tärning och lägger ihop det de visar. Ordna summorna från minst till '
                  'mest sannolik.', [('Summan %d' % s, SUMMOR[s]) for s in (12, 10, 5, 7)],
                  'Räkna utfallen: summan 12 går bara med 6 och 6, 10 går på 3 sätt, 5 på 4 sätt och 7 på 6 sätt. '
                  '7 är den vanligaste summan.'),
    ], beskrivning='Räkna utfall och kombinationer, sannolikhet i två steg och motsatta händelser.'),
])


# ---------------------------------------------------------------- åk 9

# Andragradsekvationerna: varje lösning i ett alternativ prövas, och en
# lösning som saknas i ett "fel" alternativ gör det fel.
assert {x for x in range(-30, 31) if x * x == 25} == {5, -5}
assert {x for x in range(-30, 31) if x * x - 16 == 0} == {4, -4}
assert {x for x in range(-30, 31) if (x - 3) * (x + 2) == 0} == {3, -2}
assert [x for x in (-5, 5, -1, 0) if (x + 5) * (x - 1) == 0] == [-5]
assert {x for x in range(-30, 31) if 2 * x * x - 8 == 42} == {5, -5}
# Grundpotensform: alla fyra är samma tal, bara ett står i grundpotensform.
assert F(32, 10) * 10 ** 5 == 32 * 10 ** 4 == F(32, 100) * 10 ** 6 == 320000
assert F(3, 1000) == 3 * F(1, 10 ** 3)
# Likformighet: bara den första rektangeln har samma form som 2 · 5, åt något håll.
REKTANGLAR = [(6, 15), (4, 7), (5, 8)]
assert [r for r in REKTANGLAR if F(r[0], 2) == F(r[1], 5) or F(r[0], 5) == F(r[1], 2)] == [(6, 15)]
# Statistik.
TYP = [3, 8, 5, 3, 10, 3, 6]
assert typvarde(TYP) == 3 and median(TYP) == 5
KOMPISAR = [20, 25, 30, 25, 400]
assert medel(KOMPISAR) == 100 and median(KOMPISAR) == 25 and typvarde(KOMPISAR) == 25
assert medel(KOMPISAR[:4]) == 25 and median(KOMPISAR[:4]) == 25 and typvarde(KOMPISAR[:4]) == 25
LAGESMATT = [2, 2, 3, 7, 11]
# Funktioner i vardagen: formlerna skrivs ur k och m, och bara en formel i
# varje fråga uppfyller villkoret.
TAXOR = [(25, 0), (10, 0), (10, 25), (25, 10)]
PROPFORMLER = [(linje(k, mm), k, mm) for k, mm in ((4, 0), (4, 1), (1, 4), (0, 4))]
assert [n for n, k, mm in PROPFORMLER if mm == 0 and k != 0] == ['y = 4x']
TABELL = [(1, 7), (2, 10), (3, 13), (4, 16)]
TABELLFORMLER = [(linje(k, mm), k, mm) for k, mm in ((3, 4), (4, 3), (1, 6), (7, 0))]
assert [n for n, k, mm in TABELLFORMLER if all(k * x + mm == y for x, y in TABELL)] == ['y = 3x + 4']
# De felaktiga stämmer för första raden, som förklaringen säger.
assert all(k * TABELL[0][0] + mm == TABELL[0][1] for _, k, mm in TABELLFORMLER)
assert los(-2, 20, 0, 0) == 10 and F(76, 4) * 10 == 190 and F(20, 2) != 2
VID_2 = [(5, -8), (-1, 5), (F(1, 2), 4), (3, 0)]
assert [k * 2 + mm for k, mm in VID_2] == [2, 3, 5, 6]

AK9 = bana('Matematik', 'ak9', [
    niva('ma-ak9-funktioner-1', 'Linjen y = kx + m', 'Funktioner', [
        val('Vad är k-värdet i y = 3x + 2?', ['3', '2', '5'], '3',
            'k är talet framför x. Det visar hur mycket y ökar när x ökar med 1.'),
        val('I vilken punkt skär linjen y = 2x − 5 y-axeln?', ['(0, −5)', '(0, 2)', '(−5, 0)', '(0, 5)'],
            '(0, −5)',
            'På y-axeln är x = 0. Då är y = 2 · 0 − 5 = −5, alltså m-värdet.'),
        skriv('y = 4x + 1. Vad är y när x = 3?', x_svar(4 * 3 + 1, 'y'),
              'Sätt in x = 3: y = 4 · 3 + 1 = 12 + 1 = 13.'),
        skriv('y = −2x + 6. Vad är y när x = 5?', x_svar(-2 * 5 + 6, 'y'),
              'Sätt in x = 5: y = −2 · 5 + 6 = −10 + 6 = −4.'),
        val('Vilken av linjerna lutar nedåt, från vänster till höger?',
            ['y = −3x + 4', 'y = 3x − 4', 'y = x + 10', 'y = 0,5x − 2'], 'y = −3x + 4',
            'En linje lutar nedåt när k är negativt. Här är k = −3. m-värdet påverkar inte lutningen.'),
        val('En linje skär y-axeln i (0, 1). För varje steg åt höger går den 2 steg uppåt. '
            'Vilken är linjens ekvation?',
            ['y = 2x + 1', 'y = x + 2', 'y = 2x', 'y = −2x + 1'], 'y = 2x + 1',
            'k = 2 eftersom linjen går 2 steg uppåt per steg åt höger. m = 1 eftersom den skär y-axeln i (0, 1).'),
        skriv('Ett gymkort kostar 200 kr i startavgift och sedan 50 kr per besök. Kostnaden är '
              'y = 50x + 200, där x är antalet besök. Hur många kronor kostar 6 besök?',
              t(50 * 6 + 200),
              'Sätt in x = 6: y = 50 · 6 + 200 = 300 + 200 = 500.'),
        ordna_tal('Ordna linjerna efter k-värdet, från minst till störst.',
                  [('y = 2x', 2), ('y = −4x + 1', -4), ('y = 5x − 2', 5), ('y = −x + 3', -1)],
                  'k-värdena är −4, −1, 2 och 5. Negativt k lutar nedåt och positivt uppåt.'),
    ], beskrivning='Läsa av k och m i y = kx + m och räkna ut värden i en linjär funktion.'),

    niva('ma-ak9-funktioner-2', 'Funktioner i vardagen', 'Funktioner', [
        para('Fyra ställen hyr ut kanoter. Para ihop priset med formeln, där x är antalet timmar och y priset '
             'i kronor.',
             [('%d kr per timme' % k + (' och %d kr i startavgift' % mm if mm else ''), linje(k, mm))
              for k, mm in TAXOR],
             'Priset per timme står framför x, för det betalas en gång för varje timme. Startavgiften betalas '
             'en gång och läggs till. Utan startavgift är m = 0.'),
        sant('Grafen till ett proportionellt samband är en rät linje som går genom origo.', True,
             'Ett proportionellt samband har formen y = kx. När x = 0 är y = k · 0 = 0, så linjen går '
             'genom origo, punkten (0, 0).'),
        val('Vilken av formlerna beskriver ett proportionellt samband?', [n for n, _, _ in PROPFORMLER],
            [n for n, k, mm in PROPFORMLER if mm == 0 and k != 0][0],
            'Ett proportionellt samband har formen y = kx, utan något tal som läggs till. Då blir y dubbelt så '
            'stort när x blir dubbelt så stort.'),
        val('I en tabell är ' + ', '.join('y = %d när x = %d' % (y, x) for x, y in TABELL[:-1])
            + ' och y = %d när x = %d. Vilken formel passar tabellen?' % (TABELL[-1][1], TABELL[-1][0]),
            [n for n, _, _ in TABELLFORMLER], 'y = 3x + 4',
            'y ökar med 3 varje gång x ökar med 1, så k = 3. När x = 1 är y = 3 + 4 = 7, så m = 4. '
            'De andra formlerna stämmer också när x = 1, men inte för resten av tabellen.'),
        val('Ett ljus är y cm långt efter x timmar, där y = 20 − 2x. Vad visar talet 2 i formeln?',
            ['Ljuset blir 2 cm kortare varje timme', 'Ljuset är 2 cm långt från början', 'Ljuset räcker i 2 timmar',
             'Ljuset blir 2 cm längre varje timme'], 'Ljuset blir 2 cm kortare varje timme',
            'För varje timme dras 2 cm till bort, så k = −2 är förändringen per timme. 20 är längden när '
            'ljuset tänds.'),
        skriv('Ett ljus är y cm långt efter x timmar, där y = 20 − 2x. Efter hur många timmar har ljuset brunnit ut?',
              t(los(-2, 20, 0, 0)),
              'Ljuset har brunnit ut när längden är 0: 20 − 2x = 0 ger 2x = 20, så x = 10.'),
        skriv('Priset för bensin är proportionellt mot antalet liter. 4 liter kostar 76 kr. Hur många kronor kostar '
              '10 liter?', t(F(76, 4) * 10),
              'Proportionellt betyder att literpriset är detsamma: 76 / 4 = 19 kr per liter. 10 liter kostar '
              '19 · 10 = 190 kr.'),
        ordna_tal('Sätt in x = 2 och ordna funktionerna efter y-värdet, från minst till störst.',
                  [(linje(k, mm), k * 2 + mm) for k, mm in VID_2],
                  'Med x = 2 blir 5 · 2 − 8 = 2, −2 + 5 = 3, 0,5 · 2 + 4 = 5 och 3 · 2 = 6.'),
    ], beskrivning='Känna igen proportionella samband och ställa upp och tolka linjära funktioner ur text och '
                   'tabeller.'),

    niva('ma-ak9-ekvationer-1', 'Andragradsekvationer', 'Ekvationer', [
        val('Lös ekvationen x² = 25.', ['x = 5 eller x = −5', 'x = 5', 'x = 12,5', 'x = −5'],
            'x = 5 eller x = −5',
            'Både 5 · 5 och (−5) · (−5) blir 25. Därför har ekvationen två lösningar.'),
        skriv('x² = 49 och x är positivt. Vad är x?', x_svar(rot(49)),
              '7 · 7 = 49. Lösningen −7 räknas inte här, eftersom x ska vara positivt.'),
        val('Lös ekvationen x² − 16 = 0.',
            ['x = 4 eller x = −4', 'x = 4', 'x = 8 eller x = −8', 'x = 16'], 'x = 4 eller x = −4',
            'Lägg till 16 på båda sidor: x² = 16. Både 4² och (−4)² är 16.'),
        skriv('Lös ekvationen 3x² = 75. Vad är den positiva lösningen?', x_svar(rot(F(75, 3))),
              'Dela båda sidor med 3: x² = 25. Den positiva lösningen är x = 5.'),
        val('Lös ekvationen (x − 3)(x + 2) = 0.',
            ['x = 3 eller x = −2', 'x = −3 eller x = 2', 'x = 3 eller x = 2', 'x = 6'],
            'x = 3 eller x = −2',
            'En produkt är noll när någon av faktorerna är noll. x − 3 = 0 ger x = 3, och x + 2 = 0 ger x = −2.'),
        val('Vilket av talen är en lösning till (x + 5)(x − 1) = 0?', ['−5', '5', '−1', '0'], '−5',
            'Om x = −5 blir första parentesen 0, och 0 gånger något är alltid 0.'),
        skriv('Lös ekvationen x² + 9 = 90. Vad är den positiva lösningen?', x_svar(rot(90 - 9)),
              'Dra bort 9 från båda sidor: x² = 81. 9 · 9 = 81, så den positiva lösningen är 9.'),
        ordna('Ordna stegen för att lösa 2x² − 8 = 42.',
              ['2x² − 8 = 42', '2x² = %d' % (42 + 8), 'x² = %d' % ((42 + 8) // 2),
               'x = %s eller x = %s' % (m(rot(F(42 + 8, 2))), m(-rot(F(42 + 8, 2))))],
              forklaring='Lägg till 8, dela med 2 och dra sist roten ur. Glöm inte den negativa lösningen.'),
    ], beskrivning='Lösa ekvationer som x² = a och (x − a)(x + b) = 0, som ofta har två lösningar.'),

    niva('ma-ak9-potenser-1', 'Grundpotensform', 'Potenser', [
        val('Hur skrivs 4 000 i grundpotensform?', ['4 · 10³', '4 · 10⁴', '40 · 10²', '4 · 10²'], '4 · 10³',
            '4 000 = 4 · 1 000 = 4 · 10³. Talet framför tiopotensen ska vara minst 1 och mindre än 10.'),
        val('Alla fyra är samma tal. Vilket är skrivet i grundpotensform?',
            ['3,2 · 10⁵', '32 · 10⁴', '0,32 · 10⁶', '320 000'], '3,2 · 10⁵',
            'I grundpotensform är talet framför tiopotensen minst 1 och mindre än 10. Det gäller bara 3,2.'),
        skriv('Skriv 5 · 10⁴ som ett vanligt tal.', t(5 * 10 ** 4),
              '10⁴ = 10 000, och 5 · 10 000 = 50 000.'),
        skriv('Skriv 2,7 · 10³ som ett vanligt tal.', t(F(27, 10) * 10 ** 3),
              '10³ = 1 000, och 2,7 · 1 000 = 2 700. Kommat flyttas tre steg åt höger.'),
        val('Hur skrivs 0,003 i grundpotensform?', ['3 · 10⁻³', '3 · 10³', '3 · 10⁻²', '0,3 · 10⁻²'],
            '3 · 10⁻³',
            '0,003 = 3/1 000 = 3 · 10⁻³. En negativ exponent betyder ett tal mindre än 1.'),
        val('Hur skrivs 8 miljarder i grundpotensform?', ['8 · 10⁹', '8 · 10⁶', '8 · 10¹²', '8 · 10⁸'],
            '8 · 10⁹',
            'En miljard är 1 000 000 000, en etta med nio nollor. Därför är 8 miljarder 8 · 10⁹.'),
        skriv('Skriv 6 · 10⁻² som ett decimaltal.', t(6 * F(1, 10 ** 2)),
              '10⁻² = 0,01, och 6 · 0,01 = 0,06.'),
        ordna_tal('Ordna talen från minst till störst.',
                  [('9 · 10²', 9 * 10 ** 2), ('2 · 10⁻²', 2 * F(1, 10 ** 2)), ('1,2 · 10³', F(12, 10) * 10 ** 3),
                   ('5 · 10⁻³', 5 * F(1, 10 ** 3))],
                  'Jämför först exponenterna: större exponent, större tal. 9 · 10² = 900 är mindre än '
                  '1,2 · 10³ = 1 200, och 5 · 10⁻³ = 0,005 är mindre än 2 · 10⁻² = 0,02.'),
    ], beskrivning='Skriva mycket stora och mycket små tal i grundpotensform och tillbaka.'),

    niva('ma-ak9-geometri-1', 'Likformighet och skala', 'Geometri', [
        val('En karta har skalan 1 : 10 000. Vad betyder det?',
            ['1 cm på kartan är 10 000 cm i verkligheten', '1 cm på kartan är 10 000 m i verkligheten',
             '10 000 cm på kartan är 1 cm i verkligheten'],
            '1 cm på kartan är 10 000 cm i verkligheten',
            'Skalan jämför samma enhet: 1 cm på kartan är 10 000 cm, alltså 100 m, i verkligheten.'),
        skriv('På en karta i skala 1 : 50 000 är en väg 4 cm lång. Hur många km är vägen i verkligheten?',
              t(F(4 * 50000, 100000)),
              '4 · 50 000 = 200 000 cm. 100 000 cm är 1 km, så vägen är 2 km.'),
        val('En modellbil är byggd i skala 1 : 20. Modellen är 22 cm lång. Hur lång är den riktiga bilen?',
            ['%s m' % t(F(22 * 20, 100)), '%s cm' % t(F(22, 20)), '%s m' % t(F(22 * 20, 10)),
             '%s m' % t(F(22 * 10, 100))],
            '%s m' % t(F(22 * 20, 100)),
            'Den riktiga bilen är 20 gånger längre: 22 · 20 = 440 cm, och 440 cm = 4,4 m.'),
        # "Så stor som", inte "större än": "5 gånger mindre" går inte att läsa entydigt.
        val('En teckning av en myra är gjord i skala 5 : 1. Vad betyder det?',
            ['Teckningen är 5 gånger så stor som myran', 'Myran är 5 gånger så stor som teckningen',
             'Myran är 5 cm lång'],
            'Teckningen är 5 gånger så stor som myran',
            'Första talet gäller bilden. 5 : 1 betyder att 5 cm på teckningen är 1 cm på den riktiga myran.'),
        skriv('Två trianglar är likformiga. Den lilla har sidorna 3, 4 och 5 cm. Den stora triangelns kortaste '
              'sida är 9 cm. Hur många cm är den stora triangelns längsta sida?',
              t(5 * F(9, 3)),
              'Den stora triangeln är 9 / 3 = 3 gånger så stor. Då är längsta sidan 5 · 3 = 15 cm.'),
        val('En rektangel är 2 cm bred och 5 cm lång. Vilken av rektanglarna är likformig med den?',
            ['%d cm bred och %d cm lång' % r for r in REKTANGLAR], '6 cm bred och 15 cm lång',
            'Likformiga figurer är förstorade lika mycket åt alla håll: 2 · 3 = 6 och 5 · 3 = 15. '
            'Att lägga till samma tal på båda sidorna ger inte samma form.'),
        skriv('På en ritning i skala 1 : 50 är ett rum 8 cm långt. Hur många meter är rummet i verkligheten?',
              t(F(8 * 50, 100)),
              '8 · 50 = 400 cm, och 400 cm är 4 m.'),
        ordna_tal('Ordna skalorna från den som förminskar mest till den som förstorar mest.',
                  [('1 : 10', F(1, 10)), ('20 : 1', F(20)), ('1 : 1 000', F(1, 1000)), ('1 : 1', F(1))],
                  '1 : 1 000 förminskar 1 000 gånger och 1 : 10 bara 10 gånger. '
                  '1 : 1 är verklig storlek, och 20 : 1 förstorar 20 gånger.'),
    ], beskrivning='Räkna med skala på kartor och ritningar och med sidor i likformiga figurer.'),

    niva('ma-ak9-statistik-1', 'Medelvärde, median, typvärde', 'Statistik', [
        val('Vad är typvärdet för %s?' % ', '.join(map(str, TYP)),
            [t(typvarde(TYP)), t(median(TYP)), t(max(TYP))], t(typvarde(TYP)),
            'Typvärdet är det värde som finns flest gånger. 3 finns tre gånger.'),
        skriv('Vad är medelvärdet av 4, 6, 8 och 10?', t(medel([4, 6, 8, 10])),
              'Lägg ihop alla: 4 + 6 + 8 + 10 = 28. Dela med antalet, 4: 28 / 4 = 7.'),
        val('Vad är medianen för 9, 2, 5, 11, 7?',
            [t(median([9, 2, 5, 11, 7])), '5', t(medel([9, 2, 5, 11, 7])), '11'], t(median([9, 2, 5, 11, 7])),
            'Sortera först: 2, 5, 7, 9, 11. Medianen är talet i mitten, 7.'),
        skriv('Vad är medianen för 3, 8, 10 och 1?', t(median([3, 8, 10, 1])),
              'Sortera: 1, 3, 8, 10. Med ett jämnt antal tal är medianen mitt emellan de två mittersta: '
              '(3 + 8) / 2 = 5,5.'),
        val('Fem kompisar har 20, 25, 30, 25 och 400 kr. Vilket lägesmått påverkas mest av det stora värdet 400?',
            ['Medelvärdet', 'Medianen', 'Typvärdet'], 'Medelvärdet',
            'Medelvärdet blir 100 kr, fast fyra av fem har högst 30 kr. Medianen och typvärdet är båda 25 kr, '
            'och ett enda stort värde flyttar dem inte.'),
        val('Medelvärdet av tre tal är 6. Två av talen är 4 och 5. Vilket är det tredje talet?',
            [t(3 * 6 - 4 - 5), '6', '7', '3'], t(3 * 6 - 4 - 5),
            'Tre tal med medelvärdet 6 har summan 3 · 6 = 18. 18 − 4 − 5 = 9.'),
        skriv('Ett lag gjorde 2, 0, 3, 1 och 4 mål i fem matcher. Hur många mål gjorde laget i medeltal per match?',
              t(medel([2, 0, 3, 1, 4])),
              'Lägg ihop målen: 2 + 0 + 3 + 1 + 4 = 10. Dela med antalet matcher: 10 / 5 = 2.'),
        ordna_tal('Talen är 2, 2, 3, 7 och 11. Ordna lägesmåtten från minst till störst.',
                  [('Medelvärdet', medel(LAGESMATT)), ('Typvärdet', F(typvarde(LAGESMATT))),
                   ('Medianen', median(LAGESMATT))],
                  'Typvärdet är 2, medianen 3 och medelvärdet (2 + 2 + 3 + 7 + 11) / 5 = 25 / 5 = 5.'),
    ], beskrivning='Räkna ut och jämföra lägesmåtten medelvärde, median och typvärde.'),
])


# ---------------------------------------------------------------- gy1

assert samma(lambda x: 3 * (2 * x - 1) - 2 * (x - 4), lambda x: 4 * x + 5)
assert not any(samma(lambda x: 3 * (2 * x - 1) - 2 * (x - 4), g)
               for g in (lambda x: 4 * x - 11, lambda x: 4 * x - 7, lambda x: 8 * x + 5))
assert samma(lambda x: x * (x + 4) - x * x, lambda x: 4 * x)
assert not any(samma(lambda x: x * (x + 4) - x * x, g)
               for g in (lambda x: 2 * x * x + 4 * x, lambda x: x + 4, lambda x: 4 * x - x * x))
# (x + 4)/2 = 3x − 3, rad för rad.
assert los(F(1, 2), 2, 3, -3) == los(1, 4, 6, -6) == los(0, 10, 5, 0) == 2
# Linjen genom (0, 4) och (2, 0): bara ett alternativ går genom båda punkterna.
LINJER = [('y = −2x + 4', -2, 4), ('y = 2x + 4', 2, 4), ('y = −0,5x + 4', F(-1, 2), 4), ('y = −2x + 2', -2, 2)]
assert [n for n, k, mm in LINJER if k * 0 + mm == 4 and k * 2 + mm == 0] == ['y = −2x + 4']
# Minst en sexa på tre slag, räknat på två sätt.
TRE_SLAG = list(product(range(1, 7), repeat=3))
assert F(sum(1 for s in TRE_SLAG if 6 in s), len(TRE_SLAG)) == 1 - F(5, 6) ** 3
assert len({1 - F(5, 6) ** 3, 3 * F(1, 6), F(1, 6) ** 3, 1 - F(1, 6) ** 3}) == 4
HANDELSER = [('En sexa på en tärning', F(1, 6)), ('Två sexor på två tärningar', F(1, 6) ** 2),
             ('Krona på ett slantsingel', F(1, 2)), ('Krona tre gånger i rad', F(1, 2) ** 3)]
# Funktioner och f(x): ekvationen 2x + 3 = 11 har svaret 4, och bara en
# punkt ligger på grafen till f(x) = 3x − 1.
BEGREPP = [('2x + 3', 'Uttryck'), ('2x + 3 = 11', 'Ekvation'), ('2x + 3 < 11', 'Olikhet'),
           ('f(x) = 2x + 3', 'Funktion')]
assert los(2, 3, 0, 11) == 4
PUNKTER = [(2, 5), (5, 2), (0, 1), (1, 3)]
assert [p for p in PUNKTER if 3 * p[0] - 1 == p[1]] == [(2, 5)] and 3 * 5 - 1 == 14
# Förändringen per år, i kronor eller procent: två linjära och två exponentiella.
MODELLER = [(50, 'kr'), (5, '%'), (-50, 'kr'), (-5, '%')]
# Tanken med 500 liter töms med 20 liter i minuten: tom efter 25 minuter, inte 10.
assert 500 * 2 ** 3 == 4000 and 500 - 20 * 10 == 300 and F(500, 20) == 25
assert los(3, 5, 0, 20) == 5 and 3 * 20 + 5 == 65

GY1 = bana('Matematik', 'gy1', [
    niva('ma-gy1-algebra-1', 'Uttryck och ekvationer', 'Algebra', [
        val('Förenkla 3(2x − 1) − 2(x − 4).', ['4x + 5', '4x − 11', '4x − 7', '8x + 5'], '4x + 5',
            'Multiplicera in: 6x − 3 − 2x + 8, eftersom −2 · (−4) = 8. Slå sedan ihop: 4x + 5.'),
        skriv('Lös 4(x − 2) = 2x + 6. Vad är x?', x_svar(los(4, -8, 2, 6)),
              'Multiplicera in: 4x − 8 = 2x + 6. Dra bort 2x och lägg till 8: 2x = 14, så x = 7.'),
        val('Lös x/3 + 2 = 5. Vad är x?',
            [t(los(F(1, 3), 2, 0, 5)), t(F(5 - 2, 3)), t((5 + 2) * 3), t(5 - 2)], t(los(F(1, 3), 2, 0, 5)),
            'Dra bort 2: x/3 = 3. Multiplicera med 3: x = 9.'),
        skriv('Lös 2x/5 = 6. Vad är x?', x_svar(los(F(2, 5), 0, 0, 6)),
              'Multiplicera båda sidor med 5: 2x = 30. Dela med 2: x = 15.'),
        val('Formeln v = s / t ger hastigheten v när man färdas sträckan s på tiden t. Lös ut s.',
            ['s = v · t', 's = v / t', 's = t / v', 's = v + t'], 's = v · t',
            'Multiplicera båda sidor med t: v · t = s.'),
        val('Förenkla x(x + 4) − x².', ['4x', '2x² + 4x', 'x + 4', '4x − x²'], '4x',
            'Multiplicera in: x² + 4x − x². x² och −x² tar ut varandra, och kvar blir 4x.'),
        skriv('Lös 5 − 3x = 2x − 20. Vad är x?', x_svar(los(-3, 5, 2, -20)),
              'Lägg till 3x och 20 på båda sidor: 25 = 5x, så x = 5.'),
        ordna('Ordna stegen för att lösa (x + 4)/2 = 3x − 3.',
              ['(x + 4)/2 = 3x − 3', 'x + 4 = 6x − 6', '10 = 5x', 'x = %s' % t(los(F(1, 2), 2, 3, -3))],
              forklaring='Multiplicera båda sidor med 2 så att bråket försvinner. '
                         'Samla sedan x på ena sidan och talen på den andra, och dela med 5.'),
    ], beskrivning='Förenkla uttryck, lösa ekvationer med parenteser och bråk och lösa ut en variabel ur en formel.'),

    niva('ma-gy1-procent-1', 'Upprepad förändring och ränta', 'Procent', [
        val('Ett pris höjs med 10 % och sänks sedan med 10 %. Hur stort är det nya priset jämfört med det gamla?',
            ['Det är 1 % lägre', 'Det är detsamma', 'Det är 1 % högre', 'Det är 10 % lägre'],
            'Det är %s %% lägre' % t((1 - F(11, 10) * F(9, 10)) * 100),
            'Förändringsfaktorerna multipliceras: 1,1 · 0,9 = 0,99. Det nya priset är 99 % av det gamla.'),
        skriv('Du sätter in 10 000 kr på ett konto med 3 % ränta per år. Räntan läggs till en gång per år, '
              'och du tar inte ut något. Hur många kronor finns på kontot efter 2 år?',
              t(10000 * F(103, 100) ** 2),
              '10 000 · 1,03² = 10 000 · 1,0609 = 10 609 kr. Andra året får du ränta också på förra årets ränta.'),
        val('2 000 kr växer med 4 % per år. Vilket uttryck ger beloppet efter 5 år?',
            ['2 000 · 1,04⁵', '2 000 · 1,04 · 5', '2 000 · 1,2', '2 000 · 0,04⁵'], '2 000 · 1,04⁵',
            'Varje år multipliceras beloppet med 1,04. Fem år i rad blir 1,04 · 1,04 · 1,04 · 1,04 · 1,04 = 1,04⁵.'),
        val('En bil tappar 15 % av sitt värde varje år. Vilken förändringsfaktor gäller för två år?',
            ['0,85²', '0,85 · 2', '0,7', '0,15²'], '0,85²',
            '0,85 per år, två år i rad: 0,85 · 0,85 = 0,85². Det är inte samma sak som att dra bort 30 %.'),
        skriv('En telefon kostar 5 000 kr. Priset sänks först med 20 % och sedan med 10 %. '
              'Hur många kronor kostar den nu?',
              t(5000 * F(80, 100) * F(90, 100)),
              'Förändringsfaktorerna är 0,8 och 0,9. 5 000 · 0,8 · 0,9 = 3 600 kr.'),
        val('Ett värde ökar med 50 % två år i rad. Hur mycket har det ökat totalt?',
            ['%s %%' % t((F(3, 2) ** 2 - 1) * 100), '100 %', '150 %', '225 %'],
            '%s %%' % t((F(3, 2) ** 2 - 1) * 100),
            '1,5 · 1,5 = 2,25. Det nya värdet är 225 % av det gamla, alltså en ökning med 125 %.'),
        skriv('Priset på en vara ökar från 250 kr till 300 kr. Vilken är förändringsfaktorn?',
              [t(F(300, 250))] + brak(F(300, 250)),
              'Förändringsfaktorn är det nya värdet delat med det gamla: 300 / 250 = 1,2.'),
        ordna('Ordna stegen för att räkna ut vad 8 000 kr blir efter 2 år med 5 % ränta per år.',
              ['Förändringsfaktorn är 1,05', '8 000 · 1,05²', '8 000 · %s' % t(F(105, 100) ** 2),
               '%s kr' % tusental(8000 * F(105, 100) ** 2)],
              forklaring='5 % ränta ger faktorn 1,05. Två år i rad blir 1,05² = 1,1025, '
                         'och 8 000 · 1,1025 = 8 820 kr.'),
    ], beskrivning='Räkna med förändringsfaktor när något ändras i procent flera gånger, som vid ränta.'),

    niva('ma-gy1-funktioner-1', 'Lutning ur två punkter', 'Funktioner', [
        val('Vilken formel ger lutningen k för en linje genom punkterna (x₁, y₁) och (x₂, y₂)?',
            ['k = (y₂ − y₁) / (x₂ − x₁)', 'k = (x₂ − x₁) / (y₂ − y₁)', 'k = (y₂ + y₁) / (x₂ + x₁)',
             'k = y₂ / x₂'],
            'k = (y₂ − y₁) / (x₂ − x₁)',
            'Lutningen är ändringen i y delat med ändringen i x, alltså Δy / Δx.'),
        skriv('En linje går genom (1, 3) och (4, 9). Vad är k?', x_svar(F(9 - 3, 4 - 1), 'k'),
              'k = (9 − 3) / (4 − 1) = 6 / 3 = 2.'),
        skriv('En linje går genom (−2, 5) och (2, −3). Vad är k?', x_svar(F(-3 - 5, 2 - (-2)), 'k'),
              'k = (−3 − 5) / (2 − (−2)) = −8 / 4 = −2. Linjen lutar nedåt.'),
        val('En linje har k = 3 och går genom punkten (2, 1). Vad är m?',
            [m(1 - 3 * 2), m(3 * 2 - 1), '1', '−1'], m(1 - 3 * 2),
            'Sätt in punkten i y = 3x + m: 1 = 3 · 2 + m, alltså 1 = 6 + m och m = −5.'),
        val('Vilken linje går genom (0, 4) och (2, 0)?', [n for n, _, _ in LINJER], 'y = −2x + 4',
            'k = (0 − 4) / (2 − 0) = −2, och linjen skär y-axeln i (0, 4), så m = 4.'),
        val('Två linjer är parallella. Den ena är y = 3x − 1. Vilken kan den andra vara?',
            ['y = 3x + 5', 'y = −3x − 1', 'y = 5x − 1'], 'y = 3x + 5',
            'Parallella linjer har samma lutning, alltså samma k-värde. Här är k = 3.'),
        skriv('En taxiresa kostar 145 kr för 3 km och 205 kr för 9 km. Priset ökar lika mycket för varje km. '
              'Hur många kronor kostar varje km?',
              t(F(205 - 145, 9 - 3)),
              'Lutningen är priset per km: (205 − 145) / (9 − 3) = 60 / 6 = 10 kr per km.'),
        ordna('Ta fram ekvationen för linjen genom (1, 5) och (3, 11). Ordna stegen.',
              ['k = (11 − 5) / (3 − 1) = %s' % t(F(11 - 5, 3 - 1)), '5 = %s · 1 + m' % t(F(11 - 5, 3 - 1)),
               'm = %s' % t(5 - F(11 - 5, 3 - 1)),
               'y = %sx + %s' % (t(F(11 - 5, 3 - 1)), t(5 - F(11 - 5, 3 - 1)))],
              forklaring='Räkna först ut k. Sätt sedan in en av punkterna för att få m, '
                         'och skriv till sist ekvationen.'),
    ], beskrivning='Räkna ut lutningen och ekvationen för en rät linje genom två punkter.'),

    niva('ma-gy1-funktioner-2', 'Funktioner och f(x)', 'Funktioner', [
        para('Para ihop med rätt begrepp.', BEGREPP,
             'Ett uttryck har inget likhetstecken. En ekvation, som 2x + 3 = 11, stämmer för vissa x, här x = 4, '
             'och en olikhet, som 2x + 3 < 11, för många x, här alla x under 4. En funktion ger ett värde f(x) '
             'för varje x.'),
        sant('f(3) betyder f gånger 3.', False,
             'f(3) är funktionens värde när x = 3. Om f(x) = 2x + 1 är f(3) = 2 · 3 + 1 = 7. Parentesen visar '
             'vilket x som sätts in, den betyder inte gånger.'),
        skriv('f(x) = 2x + 7. Vad är f(5)?', x_svar(2 * 5 + 7, 'f(5)'),
              'Sätt in 5 i stället för x: f(5) = 2 · 5 + 7 = 10 + 7 = 17.'),
        val('Vilken punkt ligger på grafen till f(x) = 3x − 1?', ['(%d, %s)' % (a, m(b)) for a, b in PUNKTER],
            '(%d, %s)' % [(a, m(b)) for a, b in PUNKTER if 3 * a - 1 == b][0],
            'En punkt (x, y) ligger på grafen när y = f(x). f(2) = 3 · 2 − 1 = 5, så (2, 5) ligger på grafen. '
            'f(5) = 14, inte 2.'),
        para('Ett belopp är 1 000 kr från början. Para ihop förändringen med funktionen, där x är antalet år.',
             [modell(d, sort) for d, sort in MODELLER],
             'Samma ändring i kronor varje år ger en linjär funktion. Samma ändring i procent ger en '
             'exponentialfunktion med förändringsfaktorn som bas: 1,05 när beloppet ökar med 5 % och 0,95 när '
             'det minskar med 5 %.'),
        sant('Om f(x) = 500 · 2ˣ så är f(3) = 4 000.', 500 * 2 ** 3 == 4000,
             'f(3) = 500 · 2³ = 500 · 8 = 4 000. Funktionen fördubblas för varje steg i x: 500, 1 000, 2 000 '
             'och 4 000.'),
        val('Vattnet i en tank är V(t) = 500 − 20t liter efter t minuter. Vad betyder V(10) = 300?',
            ['Efter 10 minuter finns det 300 liter i tanken', 'Efter 300 minuter finns det 10 liter i tanken',
             'Tanken töms med 10 liter per minut', 'Det tar 10 minuter att tömma tanken'],
            'Efter 10 minuter finns det 300 liter i tanken',
            'V(10) är mängden vatten när t = 10: 500 − 20 · 10 = 300. Talet i parentesen är tiden, och V(10) är '
            'hur mycket vatten som finns då.'),
        ordna('f(x) = 3x + 5. Lös ekvationen f(x) = 20. Ordna stegen. En bricka blir över.',
              ['3x + 5 = 20', '3x = %d' % (20 - 5), 'x = %s' % t(los(3, 5, 0, 20))],
              extra=['f(20) = %d' % (3 * 20 + 5)],
              forklaring='f(x) = 20 betyder att funktionens värde ska vara 20, alltså 3x + 5 = 20. Dra bort 5 och '
                         'dela med 3: x = 5. f(20) = 65 svarar på en annan fråga: vad f är när x = 20.'),
    ], beskrivning='Skillnaden mellan uttryck, ekvation, olikhet och funktion, vad f(x) betyder och linjära och '
                   'exponentiella modeller.'),

    niva('ma-gy1-potenser-1', 'Potenslagar och tillväxt', 'Potenser', [
        val('Förenkla 2³ · 2⁴.', ['2⁷', '2¹²', '4⁷', '4¹²'], '2' + up(3 + 4),
            'Vid multiplikation med samma bas adderas exponenterna: 3 + 4 = 7.'),
        val('Förenkla x⁸ / x².', ['x⁶', 'x⁴', 'x¹⁰', 'x¹⁶'], 'x' + up(8 - 2),
            'Vid division med samma bas subtraheras exponenterna: 8 − 2 = 6.'),
        skriv('Vad är 5⁰?', t(5 ** 0),
              'Varje tal utom 0 upphöjt till 0 är 1. Det följer av att 5³ / 5³ = 5³⁻³ = 5⁰, och ett tal delat med sig självt är 1.'),
        skriv('Vad är 2⁻³? Svara som bråk.', brak(F(1, 2 ** 3)) + [t(F(1, 2 ** 3))],
              'En negativ exponent betyder ett delat med potensen: 2⁻³ = 1 / 2³ = 1/8.'),
        val('En bakteriekultur har 500 bakterier och fördubblas varje timme. '
            'Vilken funktion ger antalet y efter x timmar?',
            ['y = 500 · 2ˣ', 'y = 500 + 2x', 'y = 2 · 500ˣ', 'y = 500 · x²'], 'y = 500 · 2ˣ',
            'Startvärdet är 500, och varje timme multipliceras antalet med 2. Efter x timmar har det gjorts x gånger.'),
        val('Funktionen y = 300 · 0,9ˣ beskriver något som ändras varje år. Vad händer?',
            ['Det minskar med 10 % per år', 'Det minskar med 90 % per år', 'Det ökar med 9 % per år',
             'Det minskar med 0,9 per år'],
            'Det minskar med 10 % per år',
            'Förändringsfaktorn 0,9 betyder att 90 % finns kvar varje år, alltså en minskning med 10 %.'),
        skriv('y = 200 · 1,5ˣ. Vad är y när x = 2?', x_svar(200 * F(3, 2) ** 2, 'y'),
              '1,5² = 1,5 · 1,5 = 2,25, och 200 · 2,25 = 450.'),
        ordna_tal('Ordna från minst till störst.',
                  [('%d%s' % (b, up(e)), F(b) ** e) for b, e in ((3, 2), (2, -2), (2, 3), (5, 0))],
                  '2⁻² = 1/4, 5⁰ = 1, 2³ = 8 och 3² = 9.'),
    ], beskrivning='Räkna med potenslagarna och tolka exponentialfunktioner som y = C · aˣ.'),

    niva('ma-gy1-sannolikhet-1', 'Sannolikhet i flera steg', 'Sannolikhet', [
        val('Du slår två tärningar. Hur stor är sannolikheten att båda visar en sexa?',
            [br(F(1, 6) ** 2), '1/12', br(F(1, 6) + F(1, 6)), br(F(1, 6))], br(F(1, 6) ** 2),
            'Tärningarna påverkar inte varandra, så sannolikheterna multipliceras: 1/6 · 1/6 = 1/36.'),
        skriv('Du singlar slant tre gånger. Hur stor är sannolikheten att få krona alla tre gångerna? '
              'Svara som bråk.',
              brak(F(1, 2) ** 3) + [t(F(1, 2) ** 3)],
              '1/2 · 1/2 · 1/2 = 1/8.'),
        val('I en påse finns 4 röda och 6 blå kulor. Du drar två kulor utan att lägga tillbaka den första. '
            'Hur stor är sannolikheten att båda är röda?',
            [br(F(4, 10) * F(3, 9)), br(F(4, 10) ** 2), br(F(4, 10))], br(F(4, 10) * F(3, 9)),
            'Först 4 röda av 10, sedan 3 röda av de 9 som är kvar: 4/10 · 3/9 = 12/90 = 2/15.'),
        # "Inte sen två dagar i rad" kan också läsas som att den aldrig är sen två
        # dagar i rad, 1 − 0,1 · 0,1 = 0,99. Varken–eller går bara att läsa på ett sätt.
        skriv('Sannolikheten att en buss är sen är 0,1. Dagarna påverkar inte varandra. '
              'Hur stor är sannolikheten att bussen varken är sen i dag eller i morgon? Svara med ett decimaltal.',
              [t((1 - F(1, 10)) ** 2)] + brak((1 - F(1, 10)) ** 2),
              'Sannolikheten att den inte är sen är 1 − 0,1 = 0,9 varje dag. Båda dagarna: 0,9 · 0,9 = 0,81.'),
        val('Du slår en tärning tre gånger. Vilket uttryck ger sannolikheten att få minst en sexa?',
            ['1 − (5/6)³', '3 · 1/6', '(1/6)³', '1 − (1/6)³'], '1 − (5/6)³',
            'Minst en sexa är motsatsen till ingen sexa alls. Ingen sexa på tre slag har sannolikheten (5/6)³, '
            'så svaret är 1 − (5/6)³.'),
        val('Sannolikheten att vinna ett spel är 0,3. Spelen påverkar inte varandra. '
            'Hur stor är sannolikheten att vinna två gånger i rad?',
            [t(F(3, 10) ** 2), t(F(3, 10) * 2), t(F(3, 10)), t(F(7, 10) ** 2)], t(F(3, 10) ** 2),
            'Två oberoende händelser: 0,3 · 0,3 = 0,09.'),
        skriv('En kortlek har 52 kort, och 13 av dem är hjärter. Du drar ett kort utan att titta. '
              'Hur stor är sannolikheten att det är ett hjärter? Svara som bråk.',
              brak(F(13, 52)) + ['%d/%d' % (13, 52), '%d / %d' % (13, 52), t(F(13, 52))],
              '13 av 52 kort är hjärter. 13/52 = 1/4.'),
        ordna_tal('Ordna händelserna från minst till mest sannolik.', HANDELSER,
                  'Sannolikheterna är 1/36 för två sexor, 1/8 för tre kronor, 1/6 för en sexa och 1/2 för en krona.'),
    ], beskrivning='Räkna sannolikhet i flera steg, med och utan återläggning, och med motsatt händelse.'),
])

BANOR = [AK7, AK8, AK9, GY1]
