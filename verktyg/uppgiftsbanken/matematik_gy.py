# -*- coding: utf-8 -*-
"""Matematik 2 på gymnasiet (2026-09-29). En bana i fem områden ur Gy11:s
centrala innehåll för Matematik 2: andragradsekvationer med pq-formeln och
faktorisering, linjära ekvationssystem, tiologaritmer och
exponentialekvationer, statistik med standardavvikelse och normalfördelning,
och de geometriska satserna om vinklar, randvinklar och likformighet.

Filen står för sig och lånar inga hjälpare ur matematik_hog.py: där ändras
hjälparna för åk 7–9, och ett facit här ska inte kunna ändras av det.

Varje facit räknas ut här, och de felaktiga alternativen prövas mot samma
räkning: ett fel facit lär eleven att det rätta svaret är fel, och ett "fel"
alternativ som råkar vara rätt gör samma sak.
"""
from fractions import Fraction as F
from math import isqrt, log10

from grund import bana, niva, val, skriv, ordna, sant, tal


def t(x):
    """Talet som svar: decimalkomma och '-' för minus (rättningen gör om − till -)."""
    if isinstance(x, F):
        x = int(x) if x.denominator == 1 else float(x)
    return tal(x)


def m(x):
    """Talet i en text eller bland alternativen, med riktigt minustecken."""
    return t(x).replace('-', '−')


def br(x):
    """Ett bråk som text, 2/3."""
    x = F(x)
    return str(x.numerator) if x.denominator == 1 else '%d/%d' % (x.numerator, x.denominator)


def x_svar(v, var='x'):
    """Svaret på "Vad är x?": talet, och talet skrivet som x = 5 på fyra sätt.
    Ett negativt tal också med mellanslag efter minustecknet: rättningen läser
    bara -3 som ett tal, allt annat jämförs som text."""
    s = t(v)
    svar = [s, '%s = %s' % (var, s), '%s=%s' % (var, s), '%s= %s' % (var, s), '%s =%s' % (var, s)]
    if s.startswith('-'):
        svar += ['- ' + s[1:], '%s = - %s' % (var, s[1:])]
    return svar


def enda(alternativ, prov):
    """Det enda alternativet som klarar provet. Klarar noll eller flera det
    är frågan fel skriven, och då ska bygget stanna."""
    traffar = [a for a in alternativ if prov(a)]
    assert len(traffar) == 1, 'väntade ett rätt alternativ i %r, fick %r' % (alternativ, traffar)
    return traffar[0]


def ordna_tal(fraga, par, forklaring, extra=None):
    """Brickor från minst till störst, ordnade ur sina värden. Två lika
    värden hade gett två rätta ordningar."""
    varden = [v for _, v in par]
    assert len(set(varden)) == len(varden), fraga
    return ordna(fraga, [text for text, _ in sorted(par, key=lambda p: p[1])], extra=extra, forklaring=forklaring)


def pq(p, q):
    """De reella lösningarna till x² + px + q = 0, exakt, med pq-formeln.
    Frågorna har rationella lösningar: går roten inte jämnt ut är frågan fel."""
    p, q = F(p), F(q)
    d = (p / 2) ** 2 - q
    if d < 0:
        return set()
    a, b = isqrt(d.numerator), isqrt(d.denominator)
    assert a * a == d.numerator and b * b == d.denominator, (p, q)
    r = F(a, b)
    losn = {-p / 2 + r, -p / 2 - r}
    assert all(x * x + p * x + q == 0 for x in losn)
    return losn


def som_mangd(text):
    """'x = 2 eller x = 4' → {2, 4}."""
    return {F(d.split('= ')[1].replace('−', '-').replace(',', '.')) for d in text.split(' eller ')}


def polynom(f):
    """Ett polynom av högst grad 2 som dess värden i sju punkter, för att
    jämföra två uttryck: lika i sju punkter är samma polynom."""
    return tuple(f(F(x)) for x in range(-3, 4))


def system(a1, b1, c1, a2, b2, c2):
    """Löser a1·x + b1·y = c1 och a2·x + b2·y = c2 med Cramers regel, och prövar svaret."""
    det = F(a1 * b2 - a2 * b1)
    assert det != 0
    x, y = (c1 * b2 - c2 * b1) / det, (a1 * c2 - a2 * c1) / det
    assert a1 * x + b1 * y == c1 and a2 * x + b2 * y == c2
    return x, y


def xy(text):
    """'x = 4, y = 2' → (4, 2)."""
    return tuple(F(d.split('= ')[1].replace('−', '-').replace(',', '.')) for d in text.split(', '))


def medel(data):
    return F(sum(data), len(data))


def varians(data):
    """Populationsvariansen. Frågorna jämför bara vilken mängd som sprider sig
    mest, och då ger n och n − 1 i nämnaren samma svar."""
    mv = medel(data)
    return sum((x - mv) ** 2 for x in data) / len(data)


# ---------------------------------------------------------------- andragradsekvationer

assert pq(-6, 8) == {2, 4} and pq(2, -15) == {3, -5} and pq(-4, -21) == {7, -3}
assert pq(4, 5) == set() and pq(-10, 25) == {5} and pq(-2, -8) == {4, -2}
PQ_1 = ['x = 2 eller x = 4', 'x = −2 eller x = −4', 'x = 2 eller x = −4', 'x = 1 eller x = 8']
FORMEL = ['x = −p/2 ± √((p/2)² − q)', 'x = p/2 ± √((p/2)² − q)', 'x = −p/2 ± √((p/2)² + q)', 'x = −p ± √(p² − q)']
LOSNINGAR_ANTAL = {0: 'Ingen', 1: 'En', 2: 'Två'}
# Faktorisera och utveckla: rätt alternativ är samma polynom, de fel är det inte.
FAKTOR_9 = [('(x + 3)(x − 3)', lambda x: (x + 3) * (x - 3)), ('(x − 3)²', lambda x: (x - 3) ** 2),
            ('(x + 9)(x − 1)', lambda x: (x + 9) * (x - 1)), ('(x − 9)(x + 1)', lambda x: (x - 9) * (x + 1))]
UTV_4 = [('x² + 8x + 16', lambda x: x * x + 8 * x + 16), ('x² + 16', lambda x: x * x + 16),
         ('x² + 4x + 16', lambda x: x * x + 4 * x + 16), ('x² + 8x + 8', lambda x: x * x + 8 * x + 8)]
UTV_3 = [('a² − 6a + 9', lambda a: a * a - 6 * a + 9), ('a² − 9', lambda a: a * a - 9),
         ('a² + 9', lambda a: a * a + 9), ('a² − 6a − 9', lambda a: a * a - 6 * a - 9)]
NOLLSTALLEN = [('(x − 1)(x − 5)', lambda x: (x - 1) * (x - 5)), ('(x + 1)(x + 5)', lambda x: (x + 1) * (x + 5)),
               ('x² + 6x + 5', lambda x: x * x + 6 * x + 5), ('x² − 5', lambda x: x * x - 5)]
# Rektangeln: x(x + 3) = 40, alltså x² + 3x − 40 = 0.
assert pq(3, -40) == {5, -8}
assert pq(-6, 5) == {1, 5}

# ---------------------------------------------------------------- ekvationssystem

SYSTEM_1 = ['x = 3, y = 6', 'x = 6, y = 3', 'x = 4,5, y = 4,5', 'x = 2, y = 7']
assert system(-2, 1, 0, 1, 1, 9) == (3, 6)
assert system(2, 1, 10, -1, 1, 1) == (3, 4)          # y = x + 1 och 2x + y = 10
assert system(-3, 1, -2, -1, 1, 4) == (3, 7)         # y = 3x − 2 och y = x + 4
assert system(1, 1, 10, 1, -1, 4) == (7, 3)
assert system(-1, 1, 2, 3, 1, 14) == (3, 5)          # y = x + 2 och 3x + y = 14
assert system(2, 1, 11, 1, -1, 1) == (4, 3)
SYSTEM_2 = ['x = 4, y = 2', 'x = 2, y = 4', 'x = 4, y = −2', 'x = 8, y = −4']
assert system(3, 2, 16, 3, -2, 8) == (4, 2)
assert system(2, 3, 12, 4, -3, 6) == (3, 2)
assert system(2, 1, 250, 1, 1, 150) == (100, 50)     # biljett och popcorn
assert system(1, 1, 30, 1, -1, 8) == (19, 11)
assert system(1, 1, 20, 5, 10, 140) == (12, 8)       # femkronor och tiokronor
assert system(1, 2, 7, 1, -2, -1) == (3, 2)

# ---------------------------------------------------------------- logaritmer

LG_500 = round(log10(500), 1)
assert LG_500 == 2.7
LG_ORDNA = [('lg 0,1', F(-1)), ('lg 1', F(0)), ('lg 50', log10(50)), ('lg 10', F(1))]
BEFOLKNING = next(n for n in range(1, 50) if 2000 * F(105, 100) ** n > 3000)
assert BEFOLKNING == 9 and 2000 * F(105, 100) ** 8 < 3000
FORDUBBLING = 2 ** (1 / 10)
FORDUBBLING_ALT = ['Ungefär 1,07', 'Ungefär 1,2', 'Ungefär 1,1', 'Ungefär 1,02']
assert enda(FORDUBBLING_ALT, lambda a: abs(float(a.split()[1].replace(',', '.')) ** 10 - 2) < 0.05) == 'Ungefär 1,07'
LOS_5X = ['x = lg 20 / lg 5', 'x = lg 20 − lg 5', 'x = 20 / 5', 'x = lg 4']
assert abs(5 ** (log10(20) / log10(5)) - 20) < 1e-9 and abs(5 ** log10(4) - 20) > 1

# ---------------------------------------------------------------- statistik

SPRIDNING = [('2, 10, 18', (2, 10, 18)), ('8, 10, 12', (8, 10, 12)), ('9, 10, 11', (9, 10, 11)), ('10, 10, 10', (10, 10, 10))]
assert max(SPRIDNING, key=lambda p: varians(p[1]))[0] == '2, 10, 18'
assert len({varians(v) for _, v in SPRIDNING}) == 4
# Normalfördelningen: andelarna i procent ur tumregeln 34 + 13,5 + 2,35 + 0,15 = 50 på varje sida.
NF = {1: F(34), 2: F(34) + F(135, 10), 3: F(34) + F(135, 10) + F(235, 100)}
assert 2 * NF[1] == 68 and 2 * NF[2] == 95 and 2 * NF[3] == F(997, 10)
LANGD_MV, LANGD_SD = 170, 8
LANGD_ALT = ['%d och %d cm' % (LANGD_MV - k * LANGD_SD, LANGD_MV + k * LANGD_SD) for k in (2, 1, 3)] + ['170 och 186 cm']
PROV_35_50 = NF[1] + NF[2]   # 35 är μ − σ och 50 är μ + 2σ, med μ = 40 och σ = 5
assert PROV_35_50 == F(815, 10)
NF_ORDNA = [('Över μ + 2σ', 50 - NF[2]), ('Mellan μ och μ + σ', NF[1]), ('Mellan μ − 2σ och μ + 2σ', 2 * NF[2]),
            ('Under μ', F(50))]

# ---------------------------------------------------------------- geometri

assert (5 - 2) * 180 == 540
assert F(4, 10) * 15 == 6                   # topptriangeln: AD/AB = DE/BC
assert F(4 * 6, 3) == 8                      # transversalsatsen: AD/DB = AE/EC
assert 6 * 3 ** 2 == 54 and F(2, 3) * 18 == 12
BISEKTRIS = F(6, 9)

GY2 = bana('Matematik', 'gy2', [
    niva('ma-gy2-andragrad-1', 'pq-formeln', 'Andragradsekvationer', [
        val('Vilken är pq-formeln för ekvationen x² + px + q = 0?', FORMEL, FORMEL[0],
            'Lösningarna ligger symmetriskt kring −p/2, och avståndet dit är roten ur (p/2)² − q. '
            'Formeln gäller bara när koefficienten framför x² är 1.'),
        val('Lös x² − 6x + 8 = 0.', PQ_1, enda(PQ_1, lambda a: som_mangd(a) == pq(-6, 8)),
            'p = −6 och q = 8: x = 3 ± √(9 − 8) = 3 ± 1. Alltså x = 2 eller x = 4. Pröva: 2² − 6 · 2 + 8 = 0.'),
        skriv('Lös x² + 2x − 15 = 0. Vad är den positiva lösningen?', x_svar(max(pq(2, -15))),
              'x = −1 ± √(1 + 15) = −1 ± 4. Lösningarna är 3 och −5, och den positiva är 3.'),
        skriv('Lös x² − 4x − 21 = 0. Vad är den negativa lösningen?', x_svar(min(pq(-4, -21))),
              'x = 2 ± √(4 + 21) = 2 ± 5. Lösningarna är 7 och −3, och den negativa är −3.'),
        val('Ekvationen 2x² − 8x + 6 = 0 ska lösas med pq-formeln. Vad måste man göra först?',
            ['Dela alla termer med 2', 'Dra bort 6 från båda sidor', 'Dela alla termer med 6',
             'Ta roten ur alla termer'], 'Dela alla termer med 2',
            'pq-formeln kräver att x² står ensamt, med koefficienten 1. Delat med 2 blir det x² − 4x + 3 = 0.'),
        sant('Ekvationen x² + 4x + 5 = 0 har inga reella lösningar.', pq(4, 5) == set(),
             'Under rottecknet står (4/2)² − 5 = 4 − 5 = −1. Roten ur ett negativt tal är inget reellt tal.'),
        val('Hur många reella lösningar har x² − 10x + 25 = 0?', ['Ingen', 'En', 'Två'], LOSNINGAR_ANTAL[len(pq(-10, 25))],
            'Under rottecknet står (−10/2)² − 25 = 25 − 25 = 0. Då blir ± 0 samma sak, och x = 5 är enda lösningen.'),
        ordna('Ordna stegen när du löser x² − 2x − 8 = 0 med pq-formeln.',
              ['p = −2 och q = −8', 'x = 1 ± √(1 + 8)', 'x = 1 ± 3', 'x = 4 eller x = −2'],
              forklaring='Läs av p och q med tecknen. −p/2 = 1 och (p/2)² − q = 1 + 8 = 9. √9 = 3 ger x = 1 + 3 '
                         'och x = 1 − 3.'),
    ], beskrivning='Lösa andragradsekvationer med pq-formeln och se hur många lösningar en ekvation har.'),

    niva('ma-gy2-andragrad-2', 'Faktorisera och tillämpa', 'Andragradsekvationer', [
        val('Faktorisera x² − 9.', [n for n, _ in FAKTOR_9],
            enda([n for n, _ in FAKTOR_9], lambda n: polynom(dict(FAKTOR_9)[n]) == polynom(lambda x: x * x - 9)),
            'Konjugatregeln baklänges: x² − 9 = x² − 3² = (x + 3)(x − 3).'),
        val('Utveckla (x + 4)².', [n for n, _ in UTV_4],
            enda([n for n, _ in UTV_4], lambda n: polynom(dict(UTV_4)[n]) == polynom(lambda x: (x + 4) ** 2)),
            'Första kvadreringsregeln: (a + b)² = a² + 2ab + b². Med a = x och b = 4 blir det x² + 8x + 16. '
            'Den dubbla produkten 8x glöms lätt bort.'),
        val('Utveckla (a − 3)².', [n for n, _ in UTV_3],
            enda([n for n, _ in UTV_3], lambda n: polynom(dict(UTV_3)[n]) == polynom(lambda a: (a - 3) ** 2)),
            'Andra kvadreringsregeln: (a − b)² = a² − 2ab + b². Sista termen blir +9, för (−3)² = 9.'),
        skriv('Lös 3x² − 12x = 0. Vad är lösningen som inte är 0?', x_svar(F(12, 3)),
              'Bryt ut 3x: 3x(x − 4) = 0. Antingen är 3x = 0, alltså x = 0, eller x − 4 = 0, alltså x = 4.'),
        val('Ett andragradspolynom har nollställena x = 1 och x = 5. Vilket kan det vara?', [n for n, _ in NOLLSTALLEN],
            enda([n for n, _ in NOLLSTALLEN],
                 lambda n: {x for x in range(-10, 11) if dict(NOLLSTALLEN)[n](x) == 0} == {1, 5}),
            'Ett nollställe x = a ger faktorn (x − a). Med x = 1 och x = 5 blir det (x − 1)(x − 5).'),
        skriv('En rektangel är 3 cm längre än den är bred, och arean är 40 cm². Hur många cm bred är den?',
              t(max(pq(3, -40))),
              'Bredden x ger x(x + 3) = 40, alltså x² + 3x − 40 = 0. pq-formeln ger x = 5 eller x = −8. '
              'En bredd kan inte vara negativ, så bredden är 5 cm.'),
        skriv('Grafen till y = x² − 6x + 5 är en parabel. Vilket x-värde har symmetrilinjen?',
              x_svar(sum(pq(-6, 5)) / 2),
              'Symmetrilinjen går mitt emellan nollställena. De är x = 1 och x = 5, och mitt emellan ligger x = 3. '
              'Det är också −p/2 i pq-formeln.'),
        sant('Konjugatregeln säger att (a + b)(a − b) = a² − b².',
             polynom(lambda a: (a + 2) * (a - 2)) == polynom(lambda a: a * a - 4),
             'Multiplicera in: a² − ab + ab − b². Mittermerna tar ut varandra, och kvar blir a² − b².'),
    ], beskrivning='Kvadreringsreglerna och konjugatregeln, att faktorisera, och andragradsekvationer ur problem.'),

    niva('ma-gy2-ekvationssystem-1', 'Substitutionsmetoden', 'Ekvationssystem', [
        val('Vad är lösningen till ekvationssystemet y = 2x och x + y = 9?', SYSTEM_1,
            enda(SYSTEM_1, lambda s: xy(s) == system(-2, 1, 0, 1, 1, 9)),
            'Sätt in y = 2x i den andra: x + 2x = 9, alltså 3x = 9 och x = 3. Då är y = 2 · 3 = 6.'),
        skriv('y = x + 1 och 2x + y = 10. Vad är x?', x_svar(system(2, 1, 10, -1, 1, 1)[0]),
              'Sätt in y = x + 1: 2x + x + 1 = 10, alltså 3x = 9 och x = 3.'),
        skriv('y = 3x − 2 och y = x + 4. Vad är y?', x_svar(system(-3, 1, -2, -1, 1, 4)[1], 'y'),
              'Båda är lika med y, så 3x − 2 = x + 4. Det ger 2x = 6 och x = 3. Sätt in: y = 3 + 4 = 7.'),
        val('Vad betyder det grafiskt att lösa ett ekvationssystem med två räta linjer?',
            ['Att hitta punkten där linjerna skär varandra', 'Att hitta där linjerna skär y-axeln',
             'Att räkna ut linjernas lutning', 'Att hitta där linjerna skär x-axeln'],
            'Att hitta punkten där linjerna skär varandra',
            'Lösningen är det x och y som stämmer i båda ekvationerna, alltså en punkt som ligger på båda linjerna.'),
        sant('Ett ekvationssystem med två parallella linjer som inte är samma linje saknar lösning.', True,
             'Parallella linjer har samma lutning och skär aldrig varandra. Då finns ingen punkt som ligger på båda.'),
        val('Hur många lösningar har ekvationssystemet y = 2x + 1 och y = 2x + 5?',
            ['Ingen', 'En', 'Två', 'Oändligt många'], 'Ingen',
            'Båda linjerna har k = 2 men olika m. De är parallella och skär aldrig varandra. '
            'Sätter man lika får man 1 = 5, vilket aldrig stämmer.'),
        skriv('x + y = 10 och x − y = 4. Vad är x?', x_svar(system(1, 1, 10, 1, -1, 4)[0]),
              'Lägg ihop ekvationerna: 2x = 14, så x = 7. Då är y = 3.'),
        ordna('Ordna stegen för att lösa y = x + 2 och 3x + y = 14.',
              ['3x + (x + 2) = 14', '4x + 2 = 14', 'x = %s' % t(system(-1, 1, 2, 3, 1, 14)[0]),
               'y = %s' % t(system(-1, 1, 2, 3, 1, 14)[1])],
              forklaring='Sätt in uttrycket för y i den andra ekvationen, lös ut x, och sätt sedan in x i y = x + 2.'),
    ], beskrivning='Lösa linjära ekvationssystem genom att sätta in den ena ekvationen i den andra, och tolka '
                   'lösningen grafiskt.'),

    niva('ma-gy2-ekvationssystem-2', 'Additionsmetoden och problem', 'Ekvationssystem', [
        skriv('2x + y = 11 och x − y = 1. Vad är x?', x_svar(system(2, 1, 11, 1, -1, 1)[0]),
              'Lägg ihop ekvationerna, så försvinner y: 3x = 12 och x = 4.'),
        val('Lös ekvationssystemet 3x + 2y = 16 och 3x − 2y = 8.', SYSTEM_2,
            enda(SYSTEM_2, lambda s: xy(s) == system(3, 2, 16, 3, -2, 8)),
            'Lägg ihop: 6x = 24, så x = 4. Sätt in: 12 + 2y = 16, så y = 2.'),
        skriv('2x + 3y = 12 och 4x − 3y = 6. Vad är x?', x_svar(system(2, 3, 12, 4, -3, 6)[0]),
              'Lägg ihop, så tar 3y och −3y ut varandra: 6x = 18 och x = 3.'),
        val('Två biobiljetter och en popcorn kostar 250 kr. En biobiljett och en popcorn kostar 150 kr. '
            'Vad kostar en biobiljett?', ['100 kr', '50 kr', '125 kr', '75 kr'],
            '%s kr' % t(system(2, 1, 250, 1, 1, 150)[0]),
            'Skillnaden mellan köpen är en biobiljett: 250 − 150 = 100 kr. Popcornen kostar då 50 kr.'),
        skriv('Summan av två tal är 30 och skillnaden är 8. Vilket är det största talet?',
              t(system(1, 1, 30, 1, -1, 8)[0]),
              'x + y = 30 och x − y = 8. Lägg ihop: 2x = 38, så x = 19. Det andra talet är 11.'),
        val('En kassa innehåller 20 mynt, bara femkronor och tiokronor, sammanlagt 140 kr. '
            'Hur många tiokronor finns det?', ['8', '12', '14', '10'], t(system(1, 1, 20, 5, 10, 140)[1]),
            'x femkronor och y tiokronor: x + y = 20 och 5x + 10y = 140. Multiplicera den första med 5 och dra '
            'bort: 5y = 40, så y = 8 tiokronor och 12 femkronor.'),
        sant('Ekvationssystemet x + y = 5 och 2x + 2y = 10 har oändligt många lösningar.', True,
             'Den andra ekvationen är den första gånger 2. Det är samma linje, och varje punkt på den är en lösning.'),
        ordna('Ordna stegen för att lösa x + 2y = 7 och x − 2y = −1 med additionsmetoden.',
              ['2x = 6', 'x = %s' % t(system(1, 2, 7, 1, -2, -1)[0]), '3 + 2y = 7',
               'y = %s' % t(system(1, 2, 7, 1, -2, -1)[1])],
              forklaring='Lägg ihop ekvationerna så att y försvinner: 2x = 6. Lös ut x, sätt in i den första och '
                         'lös ut y.'),
    ], beskrivning='Lösa ekvationssystem genom att lägga ihop ekvationerna, och ställa upp system ur problem.'),

    niva('ma-gy2-logaritmer-1', 'Tiologaritmer', 'Logaritmer och exponentialfunktioner', [
        skriv('Vad är lg 1000?', t(3),
              'lg 1000 är det tal som 10 ska upphöjas till för att bli 1000. 10³ = 1000, så lg 1000 = 3.'),
        skriv('Vad är lg 0,01?', x_svar(-2)[:1] + ['- 2'],
              '0,01 = 1/100 = 10⁻². Därför är lg 0,01 = −2.'),
        val('Vad betyder lg x = 4?', ['x = 10⁴', 'x = 4¹⁰', 'x = 10 · 4', 'x = 4/10'], 'x = 10⁴',
            'lg x = 4 betyder att 10 upphöjt till 4 är x. Alltså x = 10⁴ = 10 000.'),
        val('Lös ekvationen 10ˣ = 50.', ['x = lg 50', 'x = 5', 'x = 50/10', 'x = lg 5'], 'x = lg 50',
            'Tiologaritmen svarar just på frågan: vad ska 10 upphöjas till för att bli 50? x = lg 50 ≈ 1,7. '
            '10⁵ är 100 000, inte 50.'),
        sant('lg 1 = 0', 10 ** 0 == 1,
             '10⁰ = 1, så det tal 10 ska upphöjas till för att bli 1 är 0.'),
        val('Vilket värde har lg 500, avrundat till en decimal?', ['2,7', '50', '5', '27'], t(LG_500),
            '500 ligger mellan 100 = 10² och 1000 = 10³, så lg 500 ligger mellan 2 och 3. Räknaren ger 2,69897.'),
        skriv('Vad är lg 10 000 − lg 100?', t(4 - 2),
              'lg 10 000 = 4 och lg 100 = 2. 4 − 2 = 2. Det är samma som lg(10 000 / 100) = lg 100 = 2.'),
        ordna_tal('Ordna från minst till störst.', LG_ORDNA,
                  'lg 0,1 = −1, lg 1 = 0, lg 10 = 1 och lg 50 ≈ 1,7. Ju större talet är, desto större är dess logaritm.'),
    ], beskrivning='Vad en tiologaritm är, och att räkna ut och jämföra logaritmer.'),

    niva('ma-gy2-logaritmer-2', 'Exponentialekvationer och tillväxt', 'Logaritmer och exponentialfunktioner', [
        val('Lös ekvationen 2ˣ = 32.', ['x = 5', 'x = 16', 'x = 6', 'x = 30'],
            'x = %d' % next(x for x in range(20) if 2 ** x == 32),
            '2 · 2 · 2 · 2 · 2 = 32, alltså 2⁵ = 32 och x = 5. 16 får den som delar 32 med 2.'),
        val('Lös ekvationen 3 · 10ˣ = 300.', ['x = 2', 'x = 100', 'x = 3', 'x = 1'],
            'x = %d' % next(x for x in range(10) if 3 * 10 ** x == 300),
            'Dela med 3: 10ˣ = 100. 10² = 100, så x = 2.'),
        val('Lös ekvationen 5ˣ = 20. Vilket uttryck ger x?', LOS_5X,
            enda(LOS_5X, lambda a: a == 'x = lg 20 / lg 5' and abs(5 ** (log10(20) / log10(5)) - 20) < 1e-9),
            'Logaritmera båda sidor: lg 5ˣ = lg 20, och x · lg 5 = lg 20. Dela med lg 5: x = lg 20 / lg 5 ≈ 1,86.'),
        skriv('En stad har 2 000 invånare och växer med 5 % per år. Efter hur många hela år har den för första '
              'gången fler än 3 000 invånare?', t(BEFOLKNING),
              'Lös 1,05ˣ = 1,5: x = lg 1,5 / lg 1,05 ≈ 8,3. Efter 8 år är det 2 955 invånare och efter 9 år 3 103, '
              'så svaret är 9 år.'),
        val('Ett belopp fördubblas på 10 år med samma procentuella ökning varje år. Vilken förändringsfaktor '
            'per år är det?', FORDUBBLING_ALT, 'Ungefär %s' % tal(FORDUBBLING, 2),
            'a¹⁰ = 2 ger a = 2 upphöjt till 1/10 ≈ 1,07, alltså drygt 7 % per år. 1,1¹⁰ ≈ 2,6 blir för mycket.'),
        sant('Funktionen y = 5 · 0,8ˣ är avtagande.', F(8, 10) < 1,
             'Förändringsfaktorn 0,8 är mindre än 1, så y blir 20 % mindre för varje steg i x.'),
        skriv('Lös ekvationen 10ˣ = 0,001. Vad är x?', x_svar(-3),
              '0,001 = 1/1000 = 10⁻³, så x = −3. Det är samma sak som x = lg 0,001.'),
        ordna('Ordna stegen för att lösa 4 · 3ˣ = 36.',
              ['4 · 3ˣ = 36', '3ˣ = %d' % (36 // 4), 'x = %d' % next(x for x in range(10) if 3 ** x == 36 // 4)],
              forklaring='Dela först med 4 så att potensen står ensam: 3ˣ = 9. 3² = 9, så x = 2.'),
    ], beskrivning='Lösa exponentialekvationer med logaritmer och räkna på tillväxt och minskning.'),

    niva('ma-gy2-statistik-1', 'Spridning och standardavvikelse', 'Statistik och normalfördelning', [
        val('Vad mäter standardavvikelsen?',
            ['Hur mycket värdena sprider sig kring medelvärdet', 'Vilket värde som är vanligast',
             'Värdet i mitten', 'Skillnaden mellan största och minsta värdet'],
            'Hur mycket värdena sprider sig kring medelvärdet',
            'Standardavvikelsen är ett slags genomsnittligt avstånd till medelvärdet. Skillnaden mellan största och '
            'minsta värdet är variationsbredden.'),
        sant('Om alla värden i en datamängd är lika stora är standardavvikelsen 0.', varians([7, 7, 7, 7]) == 0,
             'Alla värden är lika med medelvärdet, så inget värde avviker från det.'),
        val('Vilken datamängd har störst standardavvikelse?', [n for n, _ in SPRIDNING],
            max(SPRIDNING, key=lambda p: varians(p[1]))[0],
            'Alla fyra har medelvärdet 10. I 2, 10, 18 ligger värdena längst från 10, 8 steg åt varje håll.'),
        skriv('Vad är medelvärdet av 3, 7, 8, 12 och 15?', t(medel([3, 7, 8, 12, 15])),
              '3 + 7 + 8 + 12 + 15 = 45, och 45 / 5 = 9.'),
        val('Två klasser har samma medelvärde på ett prov. Klass A har standardavvikelsen 4 poäng och klass B '
            '12 poäng. Vilken slutsats kan man dra?',
            ['Resultaten i klass B är mer utspridda', 'Klass B har bättre resultat', 'Klass A har fler elever',
             'Klass A har högre median'], 'Resultaten i klass B är mer utspridda',
            'Standardavvikelsen säger hur utspridda resultaten är, inte hur bra de är eller hur många som skrev.'),
        skriv('Varje värde i en datamängd ökas med 5. Medelvärdet var 20. Vad blir det nya medelvärdet?',
              t(medel([15, 20, 25]) + 5),
              'Alla värden flyttas 5 steg uppåt, och medelvärdet följer med: 20 + 5 = 25.'),
        sant('Om varje värde i en datamängd ökas med 5 ändras inte standardavvikelsen.',
             varians([1, 4, 10]) == varians([6, 9, 15]),
             'Alla värden och medelvärdet flyttas lika mycket, så avstånden till medelvärdet är desamma.'),
        skriv('En datamängd har tio värden. Ett av dem ändras från 30 till 50. Hur mycket ökar medelvärdet?',
              t(F(50 - 30, 10)),
              'Summan ökar med 20, och medelvärdet är summan delad med 10: 20 / 10 = 2.'),
    ], beskrivning='Vad standardavvikelse mäter, och hur lägesmått och spridning ändras när data ändras.'),

    niva('ma-gy2-statistik-2', 'Normalfördelning', 'Statistik och normalfördelning', [
        val('Ungefär hur stor andel av värdena i en normalfördelning ligger inom en standardavvikelse från '
            'medelvärdet?', ['68 %', '95 %', '50 %', '99,7 %'], '%s %%' % t(2 * NF[1]),
            'Tumregeln: ungefär 68 % inom en standardavvikelse, 95 % inom två och 99,7 % inom tre.'),
        val('Längden i en grupp är normalfördelad med medelvärdet 170 cm och standardavvikelsen 8 cm. '
            'Mellan vilka längder finns ungefär 95 % av gruppen?', LANGD_ALT,
            '%d och %d cm' % (LANGD_MV - 2 * LANGD_SD, LANGD_MV + 2 * LANGD_SD),
            '95 % ligger inom två standardavvikelser: 170 ± 2 · 8, alltså mellan 154 och 186 cm.'),
        skriv('Vikten hos äpplen är normalfördelad med medelvärdet 150 g och standardavvikelsen 20 g. '
              'Ungefär hur många procent av äpplena väger mer än 170 g?', [t(50 - NF[1]), '15,9', '15,87'],
              '170 g är en standardavvikelse över medelvärdet. Hälften väger mer än 150 g, och 34 % ligger '
              'mellan 150 och 170 g. 50 − 34 = 16 %.'),
        sant('En normalfördelning är symmetrisk kring medelvärdet.', True,
             'Kurvan ser likadan ut på båda sidor om medelvärdet, så hälften av värdena ligger under och hälften över.'),
        val('Resultaten på ett prov är normalfördelade med medelvärdet 40 och standardavvikelsen 5 poäng. '
            'Ungefär hur stor andel fick mellan 35 och 50 poäng?', ['81,5 %', '68 %', '95 %', '47,5 %'],
            '%s %%' % m(PROV_35_50),
            '35 är en standardavvikelse under och 50 två över. 34 % ligger mellan 35 och 40, och 34 + 13,5 = 47,5 % '
            'mellan 40 och 50. Tillsammans 81,5 %.'),
        val('Hur ser grafen till en normalfördelning ut?',
            ['Som en klocka, högst vid medelvärdet', 'Som en rät linje', 'Högst i ena kanten',
             'Som ett U, lägst vid medelvärdet'], 'Som en klocka, högst vid medelvärdet',
            'De flesta värden ligger nära medelvärdet, och ju längre bort, desto färre. Det ger en klockformad kurva.'),
        skriv('En normalfördelning har medelvärdet 60 och standardavvikelsen 4. Ungefär hur många procent av '
              'värdena är mindre än 52?', [t(50 - NF[2]), '2,3', '2,28'],
              '52 är två standardavvikelser under medelvärdet. 95 % ligger inom två, så 5 % ligger utanför, '
              'hälften på varje sida: 2,5 %.'),
        ordna_tal('Ordna delarna av en normalfördelning efter hur stor andel de innehåller, minst först. '
                  'μ är medelvärdet och σ standardavvikelsen.', NF_ORDNA,
                  'Över μ + 2σ finns 2,5 %, mellan μ och μ + σ 34 %, under μ 50 % och mellan μ − 2σ och μ + 2σ 95 %.'),
    ], beskrivning='Tumregeln för normalfördelningen: 68, 95 och 99,7 procent inom en, två och tre '
                   'standardavvikelser.'),

    niva('ma-gy2-geometri-1', 'Vinklar och randvinklar', 'Geometriska satser', [
        val('Vad säger randvinkelsatsen?',
            ['En randvinkel är hälften så stor som medelpunktsvinkeln på samma båge',
             'En randvinkel är dubbelt så stor som medelpunktsvinkeln på samma båge',
             'En randvinkel är lika stor som medelpunktsvinkeln på samma båge',
             'En randvinkel är alltid 90°'],
            'En randvinkel är hälften så stor som medelpunktsvinkeln på samma båge',
            'Medelpunktsvinkeln har spetsen i cirkelns medelpunkt, randvinkeln på cirkeln. '
            'Står de på samma båge är randvinkeln hälften så stor.'),
        skriv('En medelpunktsvinkel är 110°. Hur många grader är en randvinkel på samma båge?', t(F(110, 2)),
              'Randvinkeln är hälften av medelpunktsvinkeln: 110 / 2 = 55°.'),
        skriv('En randvinkel är 35°. Hur många grader är medelpunktsvinkeln på samma båge?', t(2 * 35),
              'Medelpunktsvinkeln är dubbelt så stor som randvinkeln: 2 · 35 = 70°.'),
        sant('En randvinkel som står på en diameter är alltid 90°.', F(180, 2) == 90,
             'En diameter motsvarar medelpunktsvinkeln 180°. Randvinkeln är hälften, 90°. Det kallas Thales sats.'),
        val('Två linjer skär varandra. En av vinklarna är 65°. Hur stor är vertikalvinkeln?',
            ['65°', '115°', '25°', '130°'], '%d°' % 65,
            'Vertikalvinklar står mitt emot varandra i ett kryss och är alltid lika stora. 115° är sidovinkeln.'),
        skriv('Två vinklar är sidovinklar, och den ena är 72°. Hur många grader är den andra?', t(180 - 72),
              'Sidovinklar bildar tillsammans en rak vinkel, 180°. 180 − 72 = 108°.'),
        val('Två randvinklar står på samma båge. Den ena är 40°. Hur stor är den andra?',
            ['40°', '80°', '20°', '140°'], '%d°' % 40,
            'Båda är hälften av samma medelpunktsvinkel, 80°, så de är lika stora: 40°.'),
        skriv('Hur många grader är vinkelsumman i en femhörning?', t((5 - 2) * 180),
              'En femhörning kan delas i tre trianglar från ett hörn. 3 · 180 = 540°.'),
    ], beskrivning='Randvinkelsatsen, vertikal- och sidovinklar och vinkelsumman i en månghörning.'),

    niva('ma-gy2-geometri-2', 'Kongruens och likformighet', 'Geometriska satser', [
        val('När är två trianglar likformiga?',
            ['När motsvarande vinklar är lika stora', 'När de har samma area', 'När de har en lika lång sida',
             'När de har samma omkrets'], 'När motsvarande vinklar är lika stora',
            'Likformiga trianglar har samma form: vinklarna är lika stora och sidorna har samma förhållande. '
            'Storleken kan skilja.'),
        sant('Kongruenta figurer har samma form och samma storlek.', True,
             'Kongruenta figurer kan läggas exakt på varandra, eventuellt efter att den ena vänts eller vridits.'),
        skriv('I triangeln ABC ligger D på AB och E på AC, och DE är parallell med BC. AD = 4, AB = 10 och BC = 15. '
              'Hur lång är DE?', t(F(4, 10) * 15),
              'Topptriangelsatsen: ADE och ABC är likformiga, så DE/BC = AD/AB = 4/10. DE = 0,4 · 15 = 6.'),
        skriv('I triangeln ABC ligger D på AB och E på AC, och DE är parallell med BC. AD = 3, DB = 6 och AE = 4. '
              'Hur lång är EC?', t(F(4 * 6, 3)),
              'Transversalsatsen: AD/DB = AE/EC, alltså 3/6 = 4/EC. EC = 8.'),
        val('Två likformiga trianglar har längdskalan 1 : 3. Den lilla har arean 6 cm². Vad är den storas area?',
            ['54 cm²', '18 cm²', '36 cm²', '162 cm²'], '%d cm²' % (6 * 3 ** 2),
            'Areaskalan är längdskalan i kvadrat, 3² = 9. 6 · 9 = 54 cm². 18 får den som tar 6 · 3.'),
        val('Vilket villkor räcker för att två trianglar ska vara kongruenta?',
            ['Alla tre sidorna är parvis lika långa', 'Alla tre vinklarna är parvis lika stora',
             'De har samma area', 'De har samma omkrets'], 'Alla tre sidorna är parvis lika långa',
            'Tre sidor bestämmer en triangel helt. Lika vinklar ger bara samma form, alltså likformighet.'),
        skriv('En stolpe som är 2 m hög kastar en 3 m lång skugga. Samtidigt kastar ett träd en 18 m lång skugga. '
              'Hur många meter högt är trädet?', t(F(2, 3) * 18),
              'Solen står lika högt för båda, så trianglarna är likformiga: höjd/skugga = 2/3. 2/3 · 18 = 12 m.'),
        val('I triangeln ABC delar bisektrisen till vinkel A sidan BC i delarna BD och DC. AB = 6 och AC = 9. '
            'Vad är BD/DC?', ['2/3', '3/2', '2/5', '1'], br(BISEKTRIS),
            'Bisektrissatsen: bisektrisen delar motstående sida i samma förhållande som de närliggande sidorna. '
            'BD/DC = AB/AC = 6/9 = 2/3.'),
    ], beskrivning='Likformighet och kongruens, topptriangelsatsen, transversalsatsen och bisektrissatsen.'),
])

BANOR = [GY2]
