# -*- coding: utf-8 -*-
"""Matematik på gymnasiet ur materialbanken (2026-10-03): övningsbladen i
verktyg/bladen/gymnasiet.py och np_gymnasiet.py, omskrivna till NexLäx-nivåer.

Matematik 1 och 2 finns redan (matematik_hog.py och matematik_gy.py), så de
nivåerna står i TILLAGG och läggs sist i sina banor. Matematik 3 och 4 (gy3)
är en ny bana i BANOR: derivata, integraler, trigonometriska ekvationer och
provträning.

Filen står för sig och lånar inga hjälpare ur de andra matematikfilerna: ett
facit här ska inte kunna ändras av en ändring där. Varje facit räknas ut här,
och de fel alternativen prövas mot samma räkning. Ett uttryck som svar (en
derivata, en primitiv funktion) är ett val, och alternativen skrivs ur ett
polynom i kod, så att texten och räkningen inte kan skilja sig åt.
"""
import math
from fractions import Fraction as F
from itertools import product

from grund import bana, niva, val, skriv, sant, tal, lika

BLAD = 'Bygger på övningsbladet «%s» i materialbanken.'


def t(x):
    """Talet som svar: decimalkomma och '-' för minus."""
    if isinstance(x, F):
        x = int(x) if x.denominator == 1 else float(x)
    return tal(x)


def m(x):
    """Talet i en text, med riktigt minustecken."""
    return t(x).replace('-', '−')


def d1(x):
    """Avrundat till en decimal."""
    return round(float(x) + 1e-12, 1)


def svar(v, var=None):
    """Godtagna svar på en fråga med ett tal som svar. Ett negativt tal också
    med mellanslag efter minustecknet, för rättningen läser bara -3 som tal.
    Med var: också x = 5 skrivet på fyra sätt."""
    s = t(v)
    ut = [s]
    if s.startswith('-'):
        ut.append('- ' + s[1:])
    if var:
        for v_ in list(ut):
            ut += ['%s = %s' % (var, v_), '%s=%s' % (var, v_), '%s= %s' % (var, v_), '%s =%s' % (var, v_)]
    for u in ut:
        assert lika(ut[0], u) or u.startswith(('- ', var or '\0')), u
    return ut


def enda(alternativ, prov):
    traffar = [a for a in alternativ if prov(a)]
    assert len(traffar) == 1, 'väntade ett rätt alternativ i %r, fick %r' % (alternativ, traffar)
    return traffar[0]


# ---------------------------------------------------------------- polynom

SUP = str.maketrans('0123456789-', '⁰¹²³⁴⁵⁶⁷⁸⁹⁻')


def P(*termer):
    """Ett polynom som {exponent: koefficient}: P((4, 3), (-2, 1), (7, 0)) är 4x³ − 2x + 7."""
    p = {}
    for c, e in termer:
        p[F(e)] = p.get(F(e), 0) + F(c)
    return {e: c for e, c in p.items() if c != 0}


def D(p):
    return {e - 1: c * e for e, c in p.items() if e != 0}


def utan_konstant(p):
    return {e: c for e, c in p.items() if e != 0}


def varde(p, x):
    return sum(c * F(x) ** int(e) for e, c in p.items())


def pt(p):
    """Polynomet som text: 12x² − 2, x⁵/5, 2x³ − 2x² + 3x."""
    if not p:
        return '0'
    delar = []
    for e in sorted(p, reverse=True):
        c = p[e]
        neg = c < 0
        c = abs(c)
        assert e.denominator == 1
        e = int(e)
        bas = '' if e == 0 else ('x' if e == 1 else 'x' + str(e).translate(SUP))
        if e == 0:
            term = br(c)
        elif c.denominator == 1:
            term = ('' if c == 1 else str(c.numerator)) + bas
        else:
            term = ('' if c.numerator == 1 else str(c.numerator)) + bas + '/' + str(c.denominator)
        delar.append((neg, term))
    s = ('−' if delar[0][0] else '') + delar[0][1]
    for neg, term in delar[1:]:
        s += (' − ' if neg else ' + ') + term
    return s


def br(x):
    x = F(x)
    return str(x.numerator) if x.denominator == 1 else '%d/%d' % (x.numerator, x.denominator)


assert pt(P((4, 3), (-2, 1), (7, 0))) == '4x³ − 2x + 7'
assert pt(P((F(1, 5), 5))) == 'x⁵/5'
assert pt(P((-1, 2), (6, 1))) == '−x² + 6x'


def val_derivata(fraga, f, alternativ, forklaring, namn='f′(x) = '):
    """Alternativen är polynom; rätt är det som är derivatan av f."""
    texter = [namn + pt(a) for a in alternativ]
    assert len(set(texter)) == len(texter), texter
    ratt = enda(list(range(len(alternativ))), lambda i: alternativ[i] == D(f))
    return val(fraga, texter, texter[ratt], forklaring)


def val_primitiv(fraga, f, alternativ, forklaring, plus_c=True, namn=''):
    """Rätt är det alternativ vars derivata är f."""
    texter = [namn + pt(a) + (' + C' if plus_c else '') for a in alternativ]
    assert len(set(texter)) == len(texter), texter
    ratt = enda(list(range(len(alternativ))), lambda i: D(alternativ[i]) == f)
    return val(fraga, texter, texter[ratt], forklaring)


def val_lika(fraga, alternativ, mal, forklaring, punkter=(-3, -2, -1, 1, 2, 4, 5)):
    """Alternativen är (text, funktion). Rätt är den enda som har samma
    värden som mal i alla punkterna. Fraction ger exakt jämförelse."""
    texter = [a for a, _ in alternativ]

    def samma(f):
        for x in punkter:
            a, b = f(F(x)), mal(F(x))
            if abs(complex(a) - complex(b)) > 1e-9:
                return False
        return True
    ratt = enda(alternativ, lambda a: samma(a[1]))
    return val(fraga, texter, ratt[0], forklaring)


def mangd(text):
    """'x = 2 eller x = −4' → {2, −4}; grader och ± går också."""
    ut = set()
    for d in text.split(' eller '):
        v = d.split('= ')[1].replace('°', '').replace('−', '-').replace(',', '.')
        if v.startswith('±'):
            ut |= {F(v[1:]), -F(v[1:])}
        else:
            ut.add(F(v))
    return ut


def val_losningar(fraga, alternativ, losningar, forklaring):
    return val(fraga, alternativ, enda(alternativ, lambda a: mangd(a) == set(losningar)), forklaring)


def pq(p, q):
    p, q = F(p), F(q)
    d = (p / 2) ** 2 - q
    if d < 0:
        return set()
    r = F(math.isqrt(d.numerator), math.isqrt(d.denominator))
    assert r * r == d, (p, q)
    losn = {-p / 2 + r, -p / 2 - r}
    assert all(x * x + p * x + q == 0 for x in losn)
    return losn


def lg(x):
    return math.log10(x)


def grader(v):
    return math.radians(v)


# ================================================================ Matematik 1 (gy1)

# Ekvationer och potenser
assert (21 + 7) / 4 == 7
assert 3 * (5 + 2) == 2 * 5 + 11
assert F(20, 5) + 3 == 7
assert 5 * (-5) + 4 == 2 * (-5) - 11
GRUNDPOT = ['4,2 · 10⁻⁴', '4,2 · 10⁻³', '4,2 · 10⁻⁵', '4,2 · 10⁴']
GRUNDPOT_V = {GRUNDPOT[0]: F(42, 10) / 10 ** 4, GRUNDPOT[1]: F(42, 10) / 10 ** 3,
              GRUNDPOT[2]: F(42, 10) / 10 ** 5, GRUNDPOT[3]: F(42, 10) * 10 ** 4}
MOBIL = 6000 * F(85, 100) ** 2
assert MOBIL == 4335
FAKTOR_2 = [('0,85²', F(85, 100) ** 2), ('0,15²', F(15, 100) ** 2), ('1 − 2 · 0,15', 1 - 2 * F(15, 100)),
            ('0,85 · 2', F(85, 100) * 2)]

# Linjära modeller: A = 120 + 20x, B = 300, C = 200 + 10x.
def abo_a(x): return 120 + 20 * x
def abo_b(x): return 300
def abo_c(x): return 200 + 10 * x
LIKA_AB = F(300 - 120, 20)
assert abo_a(LIKA_AB) == abo_b(LIKA_AB) == 300
BILLIGAST_15 = min((abo_a(15), 'A'), (abo_b(15), 'B'), (abo_c(15), 'C'))[1]
assert BILLIGAST_15 == 'B'
assert all((abo_c(x) < abo_a(x)) == (x > 8) for x in range(0, 30))
K_LINJE = F(19 - 7, 6 - 2)
M_LINJE = 7 - K_LINJE * 2
assert (K_LINJE, M_LINJE) == (3, 1) and K_LINJE * 6 + M_LINJE == 19
SKARNING = ['(9, 300)', '(300, 9)', '(6, 300)', '(9, 180)']

# Volym, skala och likformighet
CYL = round(math.pi * 3 ** 2 * 10)
KON = round(math.pi * 4 ** 2 * 9 / 3)
KLOT = round(4 * math.pi * 6 ** 3 / 3)
assert (CYL, KON, KLOT) == (283, 151, 905)
AKVARIUM = F(60 * 30 * 40, 1000)
BURK = d1(1000 / (math.pi * 5 ** 2))
CYL_LITER = d1(math.pi * 5 ** 2 * 20 / 1000)
assert AKVARIUM == 72 and BURK == 12.7 and CYL_LITER == 1.6
KARTA_1 = F(8 * 50000, 100 * 1000)
KARTA_2 = F(6 * 25000, 100 * 1000)
KARTA_3 = F(3 * 1000 * 100, 50000)
assert (KARTA_1, KARTA_2, KARTA_3) == (4, F(3, 2), 6)
TRIANGEL = 20 * F(15, 6) ** 2
assert TRIANGEL == 125
CYL_LIKF = F(1, 2) * F(12, 4) ** 3
assert CYL_LIKF == F(27, 2)
RITNING_MM = F(2, 5) * 10
assert RITNING_MM == 4

# NP-träning, Matematik 1
FORENKLA_1 = [('x + 7', lambda x: x + 7), ('x − 1', lambda x: x - 1), ('x + 1', lambda x: x + 1),
              ('3x − 1', lambda x: 3 * x - 1)]
AREA_1 = [('3x² + 6x', lambda x: 3 * x * x + 6 * x), ('3x² + 2', lambda x: 3 * x * x + 2),
          ('4x + 2', lambda x: 4 * x + 2), ('3x² + 6', lambda x: 3 * x * x + 6)]
JAMNA = ['24, 26 och 28', '25, 26 och 27', '22, 26 och 30', '26, 28 och 30']


def tre_jamna(text):
    a, b, c = (int(s) for s in text.replace(' och ', ', ').split(', '))
    return a + b + c == 78 and a % 2 == 0 and b == a + 2 and c == b + 2


PRIS = F(80, 100) * F(120, 100)
assert PRIS == F(96, 100)
TILLBAKA = (1 - 1 / F(125, 100)) * 100
assert TILLBAKA == 20
BIL_NP = 285000 * 0.86 ** 5
assert round(BIL_NP, -3) == 134000
RATBLOCK = F(1200, 10 * 8)
assert RATBLOCK == 15
OKNING_PROC = round((24 - 18) / 18 * 100)
assert OKNING_PROC == 33
KAKOR = next(n for n in range(1, 1000) if 15 * n - 4 * n - 450 > 0)
assert KAKOR == 41
FORDUBBLA = d1(lg(2) / lg(1.05))
HELA_AR = next(n for n in range(1, 100) if 1.05 ** n >= 2)
assert FORDUBBLA == 14.2 and HELA_AR == 15
LOPARE = [(5, F(12, 10)), (10, F(24, 10)), (20, F(48, 10)), (30, F(72, 10))]
assert len({s / t_ for t_, s in LOPARE}) == 1 and LOPARE[0][1] / LOPARE[0][0] == F(24, 100)
GYM = next(n for n in range(1, 100) if 300 + 250 * n < 400 * n)
assert GYM == 3 and 300 + 250 * 2 == 400 * 2
LINJE_03 = [('y = −x + 3', lambda x: -x + 3), ('y = x + 3', lambda x: x + 3), ('y = −3x + 3', lambda x: -3 * x + 3),
            ('y = 3x − 3', lambda x: 3 * x - 3)]
assert [a for a, f in LINJE_03 if f(0) == 3 and f(3) == 0] == ['y = −x + 3']
SAMBAND = [('Exponentiellt, y = 5 · 2ˣ', lambda x: 5 * 2 ** x), ('Linjärt, y = 5x + 5', lambda x: 5 * x + 5),
           ('Linjärt, y = 10x + 5', lambda x: 10 * x + 5), ('Linjärt, y = 5x + 10', lambda x: 5 * x + 10)]
assert [a for a, f in SAMBAND if [f(x) for x in range(4)] == [5, 10, 20, 40]] == ['Exponentiellt, y = 5 · 2ˣ']
A_LINJE = F(3 * 2 - 4 - 2, 2)
assert A_LINJE == 0
TARNING_10 = F(sum(1 for a, b in product(range(1, 7), repeat=2) if a + b >= 10), 36)
assert TARNING_10 == F(1, 6)
TARN_ALT = ['1/6', '1/12', '1/4', '5/36']
TJEJER = F(12, 22) * F(11, 21)
TJEJ_ALT = ['2/7', '36/121', '6/11', '1/2']
KON_NP = d1(math.pi * 3 ** 2 * 4 / 3)
assert KON_NP == 37.7

# ================================================================ Matematik 2 (gy2)

ANDRA_1 = ['x = 7 eller x = −7', 'x = 7', 'x = 24,5', 'x = 49 eller x = −49']
ANDRA_2 = ['x = 2 eller x = 4', 'x = −2 eller x = −4', 'x = 1 eller x = 8', 'x = 3 eller x = 1']
ANDRA_3 = ['x = 3 eller x = −5', 'x = −3 eller x = 5', 'x = 1 eller x = −15', 'x = 5 eller x = 3']
ANDRA_4 = ['x = 5 eller x = −1', 'x = −5 eller x = 1', 'x = 10 eller x = −2', 'x = 4 eller x = 1']
ANDRA_5 = ['x = 0 eller x = 4', 'x = 4', 'x = 0 eller x = −4', 'x = 2 eller x = −2']
assert pq(-6, 8) == {2, 4} and pq(2, -15) == {3, -5} and pq(-4, -5) == {5, -1} and pq(4, 5) == set()
RECT = max(pq(2, -24))
assert RECT == 4 and RECT * (RECT + 2) == 24
RECT_EKV = ['x² + 2x − 24 = 0', 'x² + 2x + 24 = 0', '2x + 2 = 24', 'x² − 2x − 24 = 0']
EXP_3X = round(lg(20) / lg(3), 2)
BAKT_6 = 500 * 2 ** 6
BAKT_T = round(lg(200) / lg(2), 2)
assert (EXP_3X, BAKT_6, BAKT_T) == (2.73, 32000, 7.64)
HALV = ['1/8', '1/3', '1/6', '1/16']
assert F(1, 2) ** (15 // 5) == F(1, 8)
BIL_2 = round(200000 * 0.88 ** 4, -2)
assert BIL_2 == 119900

# Trigonometri
TR_X = d1(10 * math.sin(grader(35)))
TR_V = d1(math.degrees(math.atan(6 / 8)))
TR_STEGE = d1(4.0 * math.sin(grader(70)))
TR_TORN = d1(50 * math.tan(grader(32)))
assert (TR_X, TR_V, TR_STEGE, TR_TORN) == (5.7, 36.9, 3.8, 31.2)
TR_B = d1(8 * math.sin(grader(65)) / math.sin(grader(40)))
TR_A = d1(math.sqrt(7 ** 2 + 9 ** 2 - 2 * 7 * 9 * math.cos(grader(50))))
TR_T = d1(7 * 9 * math.sin(grader(50)) / 2)
assert (TR_B, TR_A, TR_T) == (11.3, 7.0, 24.1)
TR_A2 = math.sqrt(5 ** 2 + 8 ** 2 - 2 * 5 * 8 * math.cos(grader(60)))
assert abs(TR_A2 - 7) < 1e-9
TR_SIN_B = 5 * math.sin(grader(90)) / math.sin(grader(30))
assert abs(TR_SIN_B - 10) < 1e-9

# Sannolikhet och kombinatorik
TVA_RODA = F(3, 5) * F(2, 4)
EN_AV_VARJE = F(3, 5) * F(2, 4) + F(2, 5) * F(3, 4)
MED_ATER = F(3, 5) ** 2
SUMMA_7 = F(sum(1 for a, b in product(range(1, 7), repeat=2) if a + b == 7), 36)
MINST_SEXA = 1 - F(5, 6) ** 3
TVA_GULA = F(6, 10) * F(5, 9)
assert (TVA_RODA, EN_AV_VARJE, MED_ATER, SUMMA_7, MINST_SEXA, TVA_GULA) == (
    F(3, 10), F(3, 5), F(9, 25), F(1, 6), F(91, 216), F(1, 3))
KODER = 10 ** 4
KODER_OLIKA = 10 * 9 * 8 * 7
KO = math.factorial(5)
VALJ_2 = math.comb(6, 2)
VALJ_3 = math.comb(5, 3)
MIDDAG = 3 * 4 * 2
assert (KODER, KODER_OLIKA, KO, VALJ_2, VALJ_3, MIDDAG) == (10000, 5040, 120, 15, 10, 24)


def bråkval(fraga, alternativ, ratt, forklaring):
    """Bråk som alternativ: rätt är det enda som är lika med ratt."""
    return val(fraga, alternativ, enda(alternativ, lambda a: F(a) == ratt), forklaring)


# NP-träning, Matematik 2
UTV_5 = [('x² + 10x + 25', lambda x: x * x + 10 * x + 25), ('x² + 25', lambda x: x * x + 25),
         ('x² + 5x + 25', lambda x: x * x + 5 * x + 25), ('x² + 10x + 10', lambda x: x * x + 10 * x + 10)]
FAKT_6 = [('x(x − 6)', lambda x: x * (x - 6)), ('(x − 3)²', lambda x: (x - 3) ** 2),
          ('x(x + 6)', lambda x: x * (x + 6)), ('(x − 6)²', lambda x: (x - 6) ** 2)]
SYS_1 = ['x = 2, y = 3', 'x = 3, y = 2', 'x = 2, y = −3', 'x = 4, y = 1']


def xy(text):
    return tuple(F(d.split('= ')[1].replace('−', '-')) for d in text.split(', '))


assert [a for a in SYS_1 if (lambda x, y: y == 2 * x - 1 and y == -x + 5)(*xy(a))] == ['x = 2, y = 3']
SYS_2 = ['x = 3, y = 2', 'x = 2, y = 3', 'x = 4, y = 3', 'x = 6, y = 0']
assert [a for a in SYS_2 if (lambda x, y: 2 * x + 3 * y == 12 and x - y == 1)(*xy(a))] == ['x = 3, y = 2']
K_ALT = ['k < 4', 'k > 4', 'k = 4', 'k < −4']
assert all(((F(4, 2) ** 2 - k) > 0) == (k < 4) for k in range(-10, 11))
MINPUNKT = ['(2, −1)', '(−2, 15)', '(2, 3)', '(1, 0)']


def f_min(x):
    return x * x - 4 * x + 3


assert [a for a in MINPUNKT
        if (lambda p: F(p[0]) == 2 and F(p[1]) == f_min(F(p[0])))(a.strip('()').replace('−', '-').split(', '))] == ['(2, −1)']
BOLL_MAX = d1(1.5 + 12 ** 2 / (4 * 4.9))
BOLL_NOLL = d1((12 + math.sqrt(12 ** 2 + 4 * 4.9 * 1.5)) / 9.8)
assert (BOLL_MAX, BOLL_NOLL) == (8.8, 2.6)
SPAR = round(lg(2.4) / lg(1.07), 2)
assert SPAR == 12.94
POANG = [12, 15, 9, 18, 14, 11, 16, 13, 10, 17]
POANG_MV = F(sum(POANG), len(POANG))
POANG_S = d1(math.sqrt(sum((x - POANG_MV) ** 2 for x in POANG) / (len(POANG) - 1)))
assert POANG_MV == F(27, 2) and POANG_S == 3.0
HAGE = [('15 m ut från väggen och 30 m längs väggen', 15, 30), ('20 m ut från väggen och 20 m längs väggen', 20, 20),
        ('10 m ut från väggen och 40 m längs väggen', 10, 40), ('12 m ut från väggen och 36 m längs väggen', 12, 36)]
HAGE_MAX = max(x * (60 - 2 * x) for x in range(0, 31))
assert HAGE_MAX == 450
assert [h[0] for h in HAGE if 2 * h[1] + h[2] == 60 and h[1] * h[2] == HAGE_MAX] == [HAGE[0][0]]
ANDRA_6 = ['x = 2 eller x = 3', 'x = −2 eller x = −3', 'x = 1 eller x = 6', 'x = −1 eller x = 6']
ANDRA_7 = ['x = 3 eller x = −3', 'x = 9 eller x = −9', 'x = 3', 'x = 4,5 eller x = −4,5']
ANDRA_8 = ['x = 6 och x = −4', 'x = −6 och x = 4', 'x = 12 och x = −2', 'x = 8 och x = −3']
assert pq(-5, 6) == {2, 3} and pq(0, -9) == {3, -3} and pq(-2, -24) == {6, -4}
FUNK_NOLL = [('f(x) = 2x² − 8x − 10', lambda x: 2 * x * x - 8 * x - 10), ('f(x) = x² − 4x − 5', lambda x: x * x - 4 * x - 5),
             ('f(x) = −2x² + 8x + 10', lambda x: -2 * x * x + 8 * x + 10), ('f(x) = 2x² + 8x − 10', lambda x: 2 * x * x + 8 * x - 10)]
assert [a for a, f in FUNK_NOLL if f(-1) == 0 and f(5) == 0 and f(0) == -10] == ['f(x) = 2x² − 8x − 10']
SKILLNAD = [('12x', lambda x: 12 * x), ('0', lambda x: 0 * x), ('18', lambda x: 18 + 0 * x), ('6x', lambda x: 6 * x)]
C_EN = next(c for c in range(-20, 21) if F(-6, 2) ** 2 - c == 0)
assert C_EN == 9
F_MIN_2 = min(x * x - 4 * x + 5 for x in [F(n, 10) for n in range(-100, 101)])
assert F_MIN_2 == 1 and pq(-4, 5) == set()
LG_500 = round(lg(500), 3)
STD_5 = [4, 7, 7, 8, 9]
STD_5_MV = F(sum(STD_5), 5)
STD_5_S = d1(math.sqrt(sum((x - STD_5_MV) ** 2 for x in STD_5) / 4))
assert LG_500 == 2.699 and STD_5_MV == 7 and STD_5_S == 1.9
TIOFALD = d1(8 * lg(10) / lg(2))
assert TIOFALD == 26.6
ANDRA_9 = ['x = 3 eller x = −1', 'x = −3 eller x = 1', 'x = 3 eller x = 1', 'x = 2 eller x = −1']
assert pq(-2, -3) == {3, -1}
UTV_2X = [('4x² − 4x + 1', lambda x: (2 * x - 1) ** 2), ('4x² + 1', lambda x: 4 * x * x + 1),
          ('4x² − 2x + 1', lambda x: 4 * x * x - 2 * x + 1), ('2x² − 4x + 1', lambda x: 2 * x * x - 4 * x + 1)]
LG8 = [('3 · lg 2', 3 * lg(2)), ('lg 2 + 3', lg(2) + 3), ('lg 2 / 3', lg(2) / 3), ('4 · lg 2', 4 * lg(2))]
assert [a for a, v in LG8 if abs(v - lg(8)) < 1e-12] == ['3 · lg 2']
KONJ = [('x² − 36', lambda x: x * x - 36), ('x² + 36', lambda x: x * x + 36), ('x² − 12x − 36', lambda x: x * x - 12 * x - 36),
        ('x² − 6', lambda x: x * x - 6)]
ANDRA_10 = ['x = 0 eller x = −3', 'x = 0 eller x = 3', 'x = −3', 'x = 3 eller x = −3']

# ================================================================ Matematik 3 och 4 (gy3)

F_X5 = P((1, 5))
F_POL = P((4, 3), (-2, 1), (7, 0))
F_POL2 = P((2, 6), (5, 2))
F_POL3 = P((5, 1), (-3, 3))
F_6X = P((6, -1))
F_7 = P((7, 0))
DER_2 = varde(D(P((1, 2), (3, 1))), 2)
DER_3 = varde(D(P((1, 3))), -1)
DER_4 = varde(D(P((2, 3), (-4, 1))), 3)
DER_5 = varde(D(P((1, 4))), -2)
H = P((20, 1), (-5, 2))
H_1 = varde(D(H), 1)
H_TOPP = F(20, 10)
assert (DER_2, DER_3, DER_4, DER_5, H_1, varde(H, 1), varde(D(H), H_TOPP)) == (7, 3, 50, -32, 10, 15, 0)
TANGENT_K = varde(D(P((1, 2))), 3)
assert TANGENT_K == 6
EXT_X = F(8, 2)
EXT_Y = varde(P((1, 2), (-8, 1), (3, 0)), EXT_X)
assert (EXT_X, EXT_Y) == (4, -13)
MAX_6X = varde(P((-1, 2), (6, 1)), 3)
assert MAX_6X == 9 and varde(D(P((-1, 2), (6, 1))), 3) == 0
EXT_12 = 2
assert varde(D(P((1, 3), (-12, 1))), EXT_12) == 0 and varde(D(D(P((1, 3), (-12, 1)))), EXT_12) > 0

INT_1 = P((1, 4))
INT_2 = P((6, 2), (-4, 1), (3, 0))
INT_3 = P((8, 3), (-2, 1))
INT_KONST = P((5, 0))
FP_F = P((2, 2), (-3, 1), (6, 0))
assert D(FP_F) == P((4, 1), (-3, 0)) and varde(FP_F, 1) == 5
PRIM_2X = varde(P((1, 2), (3, 0)), 2)
assert PRIM_2X == 7


def bestamd(f, a, b):
    """∫ f från a till b, exakt, med en primitiv funktion."""
    Fp = {e + 1: c / (e + 1) for e, c in f.items()}
    assert all(e != 0 for e in Fp)
    return varde(Fp, b) - varde(Fp, a)


I_1 = bestamd(P((3, 2)), 0, 2)
I_2 = bestamd(P((2, 1), (1, 0)), 1, 4)
I_3 = bestamd(P((1, -2)), 1, 2)
I_4 = bestamd(P((1, 2), (1, 0)), 0, 3)
I_5 = bestamd(P((1, 1), (-1, 2)), 0, 1)
I_6 = bestamd(P((4, 3)), 1, 2)
I_7 = bestamd(P((1, 2), (-4, 0)), -2, 2)
assert (I_1, I_2, I_3, I_4, I_5, I_6) == (8, 18, F(1, 2), 12, F(1, 6), 15) and I_7 < 0
AREA_ALT = ['1/6', '1/2', '1/3', '5/6']


def rad(gr):
    """Grader som bråk av π."""
    return F(gr, 180)


def pi_text(k):
    """k som bråk av π: 1/3 → 'π/3', 5/4 → '5π/4'."""
    k = F(k)
    n = '' if k.numerator == 1 else str(k.numerator)
    return n + 'π' + ('' if k.denominator == 1 else '/' + str(k.denominator))


def pi_tal(text):
    t_ = text.replace('π', '')
    if '/' in t_:
        a, b = t_.split('/')
        return F(int(a or 1), int(b))
    return F(int(t_ or 1))


assert pi_text(rad(60)) == 'π/3' and pi_text(rad(225)) == '5π/4' and pi_tal('5π/4') == F(5, 4)
RAD_60 = ['π/3', 'π/6', '2π/3', '3π']
RAD_225 = ['5π/4', '3π/4', '5π/3', '9π/4']
SIN_PI6 = [('1/2', 0.5), ('√3/2', math.sqrt(3) / 2), ('√2/2', math.sqrt(2) / 2), ('1', 1.0)]
assert [a for a, v in SIN_PI6 if abs(v - math.sin(math.pi / 6)) < 1e-12] == ['1/2']


def losningar_grader(f, a, lo=0, hi=360):
    """Heltalsgrader i [lo, hi] där f(x) = a."""
    return {F(x) for x in range(lo, hi + 1) if abs(f(grader(x)) - a) < 1e-9}


EKV_SIN = ['x = 30° eller x = 150°', 'x = 30° eller x = 210°', 'x = 30° eller x = 330°', 'x = 60° eller x = 120°']
EKV_COS = ['x = 120° eller x = 240°', 'x = 60° eller x = 300°', 'x = 120° eller x = 300°', 'x = 150° eller x = 210°']
EKV_TAN = ['x = 45° eller x = 225°', 'x = 45° eller x = 135°', 'x = 45° eller x = 315°', 'x = 135° eller x = 315°']
assert losningar_grader(math.sin, 0.5) == {30, 150}
assert losningar_grader(math.cos, -0.5) == {120, 240}
assert losningar_grader(math.tan, 1, 0, 359) == {45, 225}
EKV_RAD = ['x = π/6 eller x = 5π/6', 'x = π/3 eller x = 2π/3', 'x = π/6 eller x = 7π/6', 'x = π/6 eller x = 11π/6']


def rad_mangd(text):
    return {pi_tal(d.split('= ')[1]) for d in text.split(' eller ')}


def ratt_rad(alternativ, f, a, gr_losn):
    return enda(alternativ, lambda t_: rad_mangd(t_) == {rad(g) for g in gr_losn}
                and all(abs(f(float(k) * math.pi) - a) < 1e-9 for k in rad_mangd(t_)))


SIN03_A = d1(math.degrees(math.asin(0.3)))
SIN03_B = d1(180 - math.degrees(math.asin(0.3)))
COS08 = d1(math.degrees(math.acos(0.8)))
assert (SIN03_A, SIN03_B, COS08) == (17.5, 162.5, 36.9)
COS_ALLM = ['x ≈ ±36,9° + n · 360°', 'x ≈ 36,9° + n · 180°', 'x ≈ ±53,1° + n · 360°', 'x ≈ 90° ± 36,9° + n · 360°']
SIN_720 = len(losningar_grader(math.sin, 0.5, 0, 719))
assert SIN_720 == 4
PERIOD = F(360, 2)

F_3C = P((3, 4), (-2, 2), (1, 1))
DER_3C = varde(D(P((1, 3), (-5, 1))), 2)
assert DER_3C == 7
G_3C = P((6, 2), (4, 0))
KVOT = [('x + 3', lambda x: x + 3), ('x − 3', lambda x: x - 3), ('x² − 3', lambda x: x * x - 3), ('x + 9', lambda x: x + 9)]
assert [a for a, f in KVOT if all(f(F(x)) == (F(x) ** 2 - 9) / (F(x) - 3) for x in (-2, 0, 1, 5, 7))] == ['x + 3']
F_EXT = P((1, 3), (-3, 2))
assert varde(D(F_EXT), 0) == 0 and varde(D(F_EXT), 2) == 0
assert varde(D(D(F_EXT)), 0) < 0 < varde(D(D(F_EXT)), 2) and varde(F_EXT, 2) == -4
EXT_3C = ['Maximipunkt (0, 0) och minimipunkt (2, −4)', 'Minimipunkt (0, 0) och maximipunkt (2, −4)',
          'Maximipunkt (0, 0) och minimipunkt (3, 0)', 'Maximipunkt (−2, −20) och minimipunkt (0, 0)']
INT_3C = bestamd(P((3, 2), (2, 1)), 0, 2)
assert INT_3C == 12
BC = d1(math.sqrt(8 ** 2 + 6 ** 2 - 2 * 8 * 6 * math.cos(grader(60))))
assert BC == 7.2
LADA = max((x * (30 - 2 * x) ** 2, x) for x in [F(n, 100) for n in range(1, 1500)])
assert LADA == (2000, 5)
V_LADA = P((4, 3), (-120, 2), (900, 1))
assert all(varde(V_LADA, x) == x * (30 - 2 * x) ** 2 for x in range(0, 16))
assert varde(D(V_LADA), 5) == 0 and varde(D(D(V_LADA)), 5) == -120

KOMPLEX_1 = [('4 − 3i', 4 - 3j), ('4 + 7i', 4 + 7j), ('2 − 3i', 2 - 3j), ('4 − 7i', 4 - 7j)]
KOMPLEX_2 = [('7 + i', 7 + 1j), ('5 + i', 5 + 1j), ('6 − i', 6 - 1j), ('7 − i', 7 - 1j)]
assert [a for a, v in KOMPLEX_1 if v == (3 + 2j) + (1 - 5j)] == ['4 − 3i']
assert [a for a, v in KOMPLEX_2 if v == (2 + 1j) * (3 - 1j)] == ['7 + i']
Z_ALT = [('z = ±2i', {2j, -2j}), ('z = ±2', {2, -2}), ('z = ±4i', {4j, -4j}), ('z = −4', {-4})]
assert [a for a, s in Z_ALT if all(abs(z * z + 4) < 1e-12 for z in s) and len(s) == 2] == ['z = ±2i']


def numderiv(f, x, h=1e-6):
    return (f(x + h) - f(x - h)) / (2 * h)


def val_numderiv(fraga, f, alternativ, forklaring):
    """Alternativen är (text, funktion); rätt är derivatan av f, prövad numeriskt."""
    pkt = (-1.3, -0.4, 0.2, 0.9, 1.7)
    ratt = enda(alternativ, lambda a: all(abs(a[1](x) - numderiv(f, x)) < 1e-5 for x in pkt))
    return val(fraga, [a for a, _ in alternativ], ratt[0], forklaring)


SIN3X = [('f′(x) = 3 cos 3x', lambda x: 3 * math.cos(3 * x)), ('f′(x) = cos 3x', lambda x: math.cos(3 * x)),
         ('f′(x) = −3 cos 3x', lambda x: -3 * math.cos(3 * x)), ('f′(x) = 3 sin 3x', lambda x: 3 * math.sin(3 * x))]
XE2X = [('f′(x) = e²ˣ(1 + 2x)', lambda x: math.exp(2 * x) * (1 + 2 * x)), ('f′(x) = 2e²ˣ', lambda x: 2 * math.exp(2 * x)),
        ('f′(x) = 2x · e²ˣ', lambda x: 2 * x * math.exp(2 * x)), ('f′(x) = e²ˣ(x + 2)', lambda x: math.exp(2 * x) * (x + 2))]
EMX = [('f′(x) = −e⁻ˣ', lambda x: -math.exp(-x)), ('f′(x) = e⁻ˣ', lambda x: math.exp(-x)),
       ('f′(x) = −x · e⁻ˣ', lambda x: -x * math.exp(-x)), ('f′(x) = x · e⁻ˣ', lambda x: x * math.exp(-x))]
SQRTX = [('f′(x) = 1/(2√x)', lambda x: 1 / (2 * math.sqrt(x))), ('f′(x) = 2√x', lambda x: 2 * math.sqrt(x)),
         ('f′(x) = √x/2', lambda x: math.sqrt(x) / 2), ('f′(x) = 1/√x', lambda x: 1 / math.sqrt(x))]
assert [a for a, g in SQRTX if all(abs(g(x) - numderiv(math.sqrt, x)) < 1e-5 for x in (0.5, 1.5, 4.0))] == ['f′(x) = 1/(2√x)']
COS05 = ['x = π/3 eller x = 5π/3', 'x = π/3 eller x = 2π/3', 'x = π/6 eller x = 11π/6', 'x = π/3 eller x = 4π/3']
XEMX_MAX = max((x * math.exp(-x), x) for x in [n / 1000 for n in range(0, 5000)])
assert abs(XEMX_MAX[1] - 1) < 1e-9 and abs(XEMX_MAX[0] - 1 / math.e) < 1e-12
XEMX = ['1/e, då x = 1', 'e, då x = 1', '1, då x = 0', '2/e², då x = 2']
XEMX_V = {XEMX[0]: (1 / math.e, 1), XEMX[1]: (math.e, 1), XEMX[2]: (1.0, 0), XEMX[3]: (2 / math.e ** 2, 2)}
assert [a for a, (v, x) in XEMX_V.items() if abs(v - XEMX_MAX[0]) < 1e-12 and x * math.exp(-x) == v] == [XEMX[0]]
E2X_0 = 5 * 2 * math.exp(0)
LN10 = round(math.log(10), 2)
assert E2X_0 == 10 and LN10 == 2.30


# ================================================================ nivåerna

GY1 = bana('Matematik', 'gy1', [
    niva('ma-gy1-blad-ekvationer-1', 'Ekvationer, potenser och värdeminskning', 'Ekvationer och modeller', [
        skriv('Lös ekvationen 4x − 7 = 21.', svar(7, 'x'),
              'Lägg till 7 på båda sidor: 4x = 28. Dela med 4: x = 7.'),
        skriv('Lös ekvationen 3(x + 2) = 2x + 11.', svar(5, 'x'),
              'Multiplicera in: 3x + 6 = 2x + 11. Ta bort 2x och 6 på båda sidor: x = 5.'),
        skriv('Lös ekvationen x/5 + 3 = 7.', svar(20, 'x'),
              'Dra bort 3: x/5 = 4. Multiplicera med 5: x = 20.'),
        skriv('Lös ekvationen 5x + 4 = 2x − 11.', svar(-5, 'x'),
              'Samla x på ena sidan: 3x = −15, och då är x = −5. Pröva: 5 · (−5) + 4 = −21 = 2 · (−5) − 11.'),
        val('Förenkla 2³ · 2⁴.', ['2⁷', '2¹²', '4⁷', '4¹²'], '2⁷',
            'Samma bas: exponenterna adderas, 3 + 4 = 7. Basen 2 ändras inte.'),
        val_lika('Förenkla (5x)².', [('25x²', lambda x: 25 * x * x), ('5x²', lambda x: 5 * x * x),
                                     ('10x²', lambda x: 10 * x * x), ('25x', lambda x: 25 * x)],
                 lambda x: (5 * x) ** 2,
                 'Båda faktorerna i parentesen ska upphöjas: 5² · x² = 25x².'),
        val('Skriv 0,00042 i grundpotensform.', GRUNDPOT,
            enda(GRUNDPOT, lambda a: GRUNDPOT_V[a] == F(42, 100000)),
            'Flytta decimaltecknet fyra steg åt höger för att få 4,2. Talet är litet, så exponenten blir −4.'),
        skriv('En mobil kostar 6 000 kr och minskar i värde med 15 % per år. Vad är den värd efter 2 år, i kronor?',
              t(MOBIL),
              'Förändringsfaktorn är 0,85 varje år: 6 000 · 0,85² = 4 335 kr. Det andra årets minskning räknas på det lägre värdet.'),
        val('Ett värde minskar med 15 % per år i två år. Med vilken faktor ska det ursprungliga värdet multipliceras?',
            [a for a, _ in FAKTOR_2], enda([a for a, _ in FAKTOR_2],
                                           lambda a: dict(FAKTOR_2)[a] == F(85, 100) * F(85, 100)),
            'Varje år blir 85 % kvar, och två år i rad blir 0,85 · 0,85 = 0,85². Att dra 30 % en gång blir för mycket.'),
    ], beskrivning='Linjära ekvationer, potenslagar, grundpotensform och procentuell minskning. '
                   + BLAD % 'Ekvationer och potenser'),

    niva('ma-gy1-blad-linjara-1', 'Jämför tre abonnemang', 'Ekvationer och modeller', [
        val('Abonnemang A kostar 120 kr i månaden plus 20 kr per GB. Vilken formel ger kostnaden y kr för x GB?',
            ['y = 20x + 120', 'y = 120x + 20', 'y = 140x', 'y = 20x − 120'], 'y = 20x + 120',
            'Kostnaden per GB är k = 20 och den fasta avgiften är m = 120, så y = 20x + 120.'),
        skriv('Abonnemang A kostar 120 kr i månaden plus 20 kr per GB. Abonnemang B kostar 300 kr i månaden '
              'oavsett antal GB. Vid hur många GB kostar de lika mycket?', t(LIKA_AB),
              '20x + 120 = 300 ger 20x = 180, alltså x = 9 GB.'),
        val('A kostar 120 kr plus 20 kr per GB, B kostar 300 kr med obegränsat antal GB och C kostar 200 kr '
            'plus 10 kr per GB. Vilket abonnemang är billigast vid 15 GB?', ['A', 'B', 'C'], BILLIGAST_15,
            'A: 20 · 15 + 120 = 420 kr. B: 300 kr. C: 10 · 15 + 200 = 350 kr. B är billigast.'),
        val('Kostnaden för ett mobilabonnemang är y = 20x + 120 kr, där x är antal GB. Vad betyder talet 120?',
            ['Den fasta månadsavgiften, alltså kostnaden vid 0 GB',
             'Kostnaden för varje extra GB under månaden',
             'Det antal GB som ingår i månadsavgiften'],
            'Den fasta månadsavgiften, alltså kostnaden vid 0 GB',
            'm = 120 är y-värdet när x = 0, startvärdet. Kostnaden per GB är k = 20.'),
        val('A kostar 120 kr i månaden plus 20 kr per GB och C kostar 200 kr i månaden plus 10 kr per GB. '
            'För vilka antal GB, x, är C billigare än A?', ['x > 8', 'x < 8', 'x > 32', 'x < 32'], 'x > 8',
            '10x + 200 < 20x + 120 ger 80 < 10x, alltså x > 8. Vid många GB vinner det lägre priset per GB.'),
        skriv('Linjen y = kx + m går genom punkterna (2, 7) och (6, 19). Bestäm k.', svar(K_LINJE, 'k'),
              'k = (19 − 7)/(6 − 2) = 12/4 = 3: ändringen i y delat med ändringen i x.'),
        skriv('Linjen y = 3x + m går genom punkten (2, 7). Bestäm m.', svar(M_LINJE, 'm'),
              'Sätt in punkten: 7 = 3 · 2 + m, alltså m = 1.'),
        val('Linjerna y = 20x + 120 och y = 300 ritas i samma koordinatsystem. I vilken punkt skär de varandra?',
            SKARNING, enda(SKARNING, lambda a: (lambda x, y: 20 * x + 120 == y == 300)(
                *(int(v) for v in a.strip('()').split(', ')))),
            'Där är y-värdena lika: 20x + 120 = 300 ger x = 9, och y = 300. Punkten är (9, 300).'),
        sant('Ett abonnemang som kostar 300 kr i månaden oavsett antal GB blir en vågrät linje om antal GB står '
             'på x-axeln och kostnaden på y-axeln.', True,
             'Kostnaden är densamma för alla x, så lutningen k är 0 och linjen är vågrät: y = 300.'),
    ], beskrivning='Linjära modeller y = kx + m, skärningspunkter och olikheter med tre abonnemang. '
                   + BLAD % 'Linjära modeller – jämför tre avtal'),

    niva('ma-gy1-blad-volym-1', 'Volym av cylinder, kon och klot', 'Volym, skala och likformighet', [
        skriv('Beräkna volymen av en cylinder med radien 3 cm och höjden 10 cm. Svara i cm³ med ett heltal.', t(CYL),
              'V = π · r² · h = π · 9 · 10 ≈ 282,7, alltså 283 cm³.'),
        skriv('Beräkna volymen av en kon med radien 4 cm och höjden 9 cm. Svara i cm³ med ett heltal.', t(KON),
              'En kon är en tredjedel av cylindern: π · 16 · 9 / 3 = 48π ≈ 150,8, alltså 151 cm³.'),
        skriv('Beräkna volymen av ett klot med radien 6 cm. Svara i cm³ med ett heltal.', t(KLOT),
              'V = 4 · π · r³ / 3 = 4 · π · 216 / 3 = 288π ≈ 904,8, alltså 905 cm³.'),
        skriv('Ett akvarium är 60 cm långt, 30 cm brett och 40 cm högt. Hur många liter vatten rymmer det?',
              t(AKVARIUM),
              '60 · 30 · 40 = 72 000 cm³. 1 000 cm³ är 1 dm³ = 1 liter, så det blir 72 liter.'),
        skriv('En burk är en cylinder som rymmer 1,0 liter och har diametern 10 cm. Hur hög är burken i cm? '
              'Svara med en decimal.', t(BURK),
              '1 liter = 1 000 cm³ och radien är 5 cm: h = 1 000 / (π · 25) ≈ 12,7 cm.'),
        skriv('En cylinder har radien 5 cm och höjden 20 cm. Hur många liter rymmer den? Svara med en decimal.',
              t(CYL_LITER),
              'π · 25 · 20 ≈ 1 570,8 cm³, och 1 000 cm³ är en liter: ungefär 1,6 liter.'),
        val('Hur många liter är 1 dm³?', ['1 liter', '10 liter', '0,1 liter', '1 000 liter'], '1 liter',
            'En liter är precis en kubikdecimeter, en kub med sidan 10 cm.'),
        val('Vilken formel ger volymen av en kon med radien r och höjden h?',
            ['π · r² · h / 3', 'π · r² · h', '4 · π · r³ / 3', 'π · r · h / 3'], 'π · r² · h / 3',
            'En kon rymmer en tredjedel av en cylinder med samma bottenyta och höjd.'),
    ], beskrivning='Volym av cylinder, kon, klot och rätblock, och liter. '
                   + BLAD % 'Volym, skala och likformighet'),

    niva('ma-gy1-blad-volym-2', 'Skala, area- och volymskala', 'Volym, skala och likformighet', [
        skriv('På en karta i skala 1 : 50 000 är avståndet mellan två orter 8 cm. Hur långt är det i verkligheten, i km?',
              t(KARTA_1),
              '8 · 50 000 = 400 000 cm = 4 000 m = 4 km.'),
        skriv('På en karta i skala 1 : 25 000 är en väg 6 cm. Hur lång är vägen i verkligheten, i km?', t(KARTA_2),
              '6 · 25 000 = 150 000 cm = 1 500 m = 1,5 km.'),
        skriv('Ett avstånd på 3 km ska ritas på en karta i skala 1 : 50 000. Hur många cm blir det på kartan?',
              t(KARTA_3),
              '3 km = 300 000 cm, och 300 000 / 50 000 = 6 cm.'),
        skriv('Två likformiga trianglar har motsvarande sidor som är 6 cm och 15 cm. Den mindre har arean 20 cm². '
              'Hur stor är den större triangelns area, i cm²?', t(TRIANGEL),
              'Längdskalan är 15/6 = 2,5 och areaskalan 2,5² = 6,25: 20 · 6,25 = 125 cm².'),
        val('Två likformiga figurer har längdskalan 3. Vad är areaskalan?', ['9', '3', '6', '27'], t(3 ** 2),
            'Arean växer i två riktningar: 3 · 3 = 9. Volymskalan hade varit 3³ = 27.'),
        skriv('Två likformiga cylindrar har höjderna 4 cm och 12 cm. Den mindre rymmer 0,5 liter. '
              'Hur många liter rymmer den större?', t(CYL_LIKF),
              'Längdskalan är 3 och volymskalan 3³ = 27: 0,5 · 27 = 13,5 liter.'),
        sant('Om alla sidor i en kub blir dubbelt så långa blir volymen fyra gånger så stor.', False,
             'Volymskalan är längdskalan i kubik: 2³ = 8. Volymen blir åtta gånger så stor.'),
        skriv('En ritning är i skala 5 : 1. En detalj är 2 cm på ritningen. Hur lång är den i verkligheten, i mm?',
              t(RITNING_MM),
              'Skala 5 : 1 är en förstoring: verkligheten är 2/5 cm = 0,4 cm = 4 mm.'),
    ], beskrivning='Kartskala, förstoring och area- och volymskala för likformiga figurer. '
                   + BLAD % 'Volym, skala och likformighet'),

    niva('ma-gy1-blad-np-utan-1', 'NP-träning utan räknare', 'NP-träning', [
        skriv('Beräkna 2,4 · 0,5 utan räknare.', t(F(24, 10) * F(1, 2)),
              'Att multiplicera med 0,5 är att ta hälften: 2,4 / 2 = 1,2.'),
        val('Skriv 0,035 i procentform.', ['3,5 %', '35 %', '0,35 %', '0,035 %'], '3,5 %',
            'Procent betyder hundradelar: 0,035 · 100 = 3,5 %.'),
        val_lika('Förenkla (2x + 3) − (x − 4).', FORENKLA_1, lambda x: (2 * x + 3) - (x - 4),
                 'Minustecknet framför parentesen byter tecken på båda termerna: 2x + 3 − x + 4 = x + 7.'),
        skriv('Lös ekvationen 3(x − 2) = 12.', svar(6, 'x'),
              'Dela med 3: x − 2 = 4, alltså x = 6.'),
        skriv('Beräkna 10⁻² · 10⁵.', [t(10 ** 3), '10³', '10^3'],
              'Samma bas: exponenterna adderas, −2 + 5 = 3, och 10³ = 1 000.'),
        skriv('Bestäm f(−2) om f(x) = 3x² − 1.', svar(3 * (-2) ** 2 - 1),
              '(−2)² = 4, så f(−2) = 3 · 4 − 1 = 11. Kvadraten tar bort minustecknet.'),
        skriv('Linjen y = kx + 4 går genom punkten (2, 10). Bestäm k.', svar(F(10 - 4, 2), 'k'),
              'Sätt in punkten: 10 = 2k + 4, alltså 2k = 6 och k = 3.'),
        val_lika('En rektangel har sidorna x + 2 och 3x. Vilket förenklat uttryck är arean?', AREA_1,
                 lambda x: 3 * x * (x + 2),
                 'Arean är 3x(x + 2). Multiplicera in 3x i båda termerna: 3x² + 6x.'),
        val('Summan av tre jämna tal som följer på varandra är 78. Vilka är talen?', JAMNA, enda(JAMNA, tre_jamna),
            'Mittentalet är 78 / 3 = 26, och jämna tal i följd skiljer sig med 2: 24, 26 och 28.'),
        val('Ett pris sänks med 20 % och höjs sedan med 20 %. Hur blir det nya priset jämfört med det första?',
            ['4 % lägre', 'Lika stort', '4 % högre', '40 % lägre'], '4 % lägre',
            '0,80 · 1,20 = 0,96. Höjningen räknas på det lägre priset: 100 kr blir 80 kr och sedan 96 kr.'),
        skriv('Ett tal ökas med 25 %. Med hur många procent måste det nya talet minskas för att man ska komma tillbaka '
              'till det ursprungliga talet?', t(TILLBAKA),
              '100 blir 125. Att gå tillbaka är att minska med 25 av 125, och 25/125 = 20 %.'),
    ], beskrivning='Blandade uppgifter i stil med provets del utan digitala verktyg. '
                   + BLAD % 'NP-träning: matematik 1 utan räknare'),

    niva('ma-gy1-blad-np-med-1', 'NP-träning med räknare', 'NP-träning', [
        skriv('En bil kostar 285 000 kr och minskar i värde med 14 % per år. Vad är den värd efter 5 år? '
              'Avrunda till tusental kronor.', t(int(round(BIL_NP, -3))),
              '285 000 · 0,86⁵ ≈ 134 072 kr. Att dra 14 % av 285 000 fem gånger blir fel, för varje år räknas på det nya värdet.'),
        skriv('Ett rätblock har volymen 1,2 dm³ och bottenytan 10 cm × 8 cm. Hur högt är det i cm?', t(RATBLOCK),
              '1,2 dm³ = 1 200 cm³, och höjden är volymen delat med bottenytan: 1 200 / 80 = 15 cm.'),
        skriv('Andelen elever som cyklar till en skola ökade från 18 % till 24 %. Hur många procentenheter ökade andelen?',
              t(24 - 18),
              'Procentenheter är skillnaden mellan procenttalen: 24 − 18 = 6.'),
        skriv('Andelen elever som cyklar till en skola ökade från 18 % till 24 %. Med hur många procent ökade andelen? '
              'Avrunda till heltal.', t(OKNING_PROC),
              'Ökningen 6 räknas i förhållande till det gamla värdet: 6/18 ≈ 0,33, alltså ungefär 33 %.'),
        val('En löpare springer 1,2 km på 5 min, 2,4 km på 10 min, 4,8 km på 20 min och 7,2 km på 30 min. '
            'Vilken är proportionalitetskonstanten?', ['0,24 km/min', '4,2 km/min', '1,2 km/min', '2,4 km/min'],
            '0,24 km/min',
            'Sträckan delat med tiden är 0,24 för alla par. Löparen springer 240 m varje minut.'),
        sant('Om sträcka och tid är proportionella går grafen för sambandet genom origo.', True,
             'Proportionella betyder y = kx utan m: vid tiden 0 är sträckan 0.'),
        skriv('En klass har fasta kostnader på 450 kr. Varje kaka kostar 4 kr att baka och säljs för 15 kr. '
              'Hur många kakor måste de minst sälja för att gå med vinst?', t(KAKOR),
              'Varje kaka ger 11 kr. 450 / 11 ≈ 40,9, så 40 kakor räcker inte (−10 kr) men 41 gör det (+1 kr).'),
        skriv('Lös ekvationen 1,05ˣ = 2. Svara med en decimal.', svar(FORDUBBLA, 'x'),
              'x = lg 2 / lg 1,05 ≈ 14,2. Pröva: 1,05¹⁴ ≈ 1,98 och 1,05¹⁵ ≈ 2,08.'),
        val('Pengar på ett sparkonto växer med 5 % per år, och räntan läggs på en gång om året. Efter hur många '
            'hela år har beloppet för första gången fördubblats?', ['15 år', '14 år', '20 år', '10 år'],
            '%d år' % HELA_AR,
            '1,05ˣ = 2 ger x ≈ 14,2. Efter 14 år är det bara 1,98 gånger så mycket, så det dröjer till år 15.'),
    ], beskrivning='Procent, volym, proportionalitet och modeller i stil med provets del med räknare. '
                   + BLAD % 'NP-träning: matematik 1 med räknare'),

    niva('ma-gy1-blad-np-funktioner-1', 'NP-träning: funktioner', 'NP-träning', [
        skriv('Linjen y = kx + m går genom punkterna (0, 3) och (4, 11). Bestäm k.', svar(F(11 - 3, 4), 'k'),
              'k = (11 − 3)/(4 − 0) = 8/4 = 2.'),
        skriv('Linjen y = 2x + m går genom punkten (0, 3). Bestäm m.', svar(3, 'm'),
              'm är y-värdet där x = 0, alltså där linjen skär y-axeln: m = 3.'),
        skriv('Beräkna f(3) om f(x) = 2x² − 3.', svar(2 * 9 - 3),
              '3² = 9, så f(3) = 2 · 9 − 3 = 15.'),
        val('En rät linje går genom punkterna (0, 3) och (3, 0). Vilken är linjens ekvation?',
            [a for a, _ in LINJE_03], 'y = −x + 3',
            'Linjen skär y-axeln i 3, och k = (0 − 3)/(3 − 0) = −1. Alltså y = −x + 3.'),
        skriv('Ett gym kostar 300 kr i startavgift och 250 kr i månaden. Ett annat kostar 400 kr i månaden utan '
              'startavgift. Hur många månader måste man minst vara medlem för att det första gymmet ska bli billigast totalt?',
              t(GYM),
              'Efter 2 månader kostar båda 800 kr. Efter 3 månader kostar det första 1 050 kr och det andra 1 200 kr.'),
        val('När x är 0, 1, 2 och 3 är y 5, 10, 20 och 40. Vilket samband är det?', [a for a, _ in SAMBAND],
            'Exponentiellt, y = 5 · 2ˣ',
            'y fördubblas för varje steg i x, så förändringsfaktorn är 2 och startvärdet 5. Ökningen är inte konstant, så det är inte linjärt.'),
        skriv('Linjerna y = ax + 2 och y = 3x − 4 skär varandra där x = 2. Bestäm a.', svar(A_LINJE, 'a'),
              'Skärningspunkten: y = 3 · 2 − 4 = 2. Då ger 2 = 2a + 2 att a = 0.'),
        val('Vad betyder det att en rät linje har lutningen k = 0?',
            ['Linjen är vågrät och y har samma värde för alla x',
             'Linjen är lodrät och x har samma värde för alla y',
             'Linjen går genom origo och lutar uppåt åt höger'],
            'Linjen är vågrät och y har samma värde för alla x',
            'k är hur mycket y ändras när x ökar med 1. k = 0 betyder att y inte ändras alls.'),
        val('Vilken av funktionerna är exponentiell?', ['y = 3 · 1,2ˣ', 'y = 1,2x + 3', 'y = 3x²', 'y = 3 / x'],
            'y = 3 · 1,2ˣ',
            'I en exponentialfunktion står x i exponenten: y = C · aˣ, här med startvärdet 3 och faktorn 1,2.'),
    ], beskrivning='Räta linjer, funktionsvärden och linjära eller exponentiella samband. '
                   + BLAD % 'NP-träning: matematik 1, funktioner'),

    niva('ma-gy1-blad-np-geometri-1', 'NP-träning: geometri och sannolikhet', 'NP-träning', [
        skriv('I en rätvinklig triangel är hypotenusan 10 cm och en vinkel 30°. Hur lång är kateten mitt emot '
              '30°-vinkeln, i cm?', t(round(10 * math.sin(grader(30)), 9)),
              'sin 30° = motstående / hypotenusan, så kateten är 10 · 0,5 = 5 cm.'),
        skriv('v är en spetsig vinkel och tan v = 1. Hur stor är v i grader?', t(round(math.degrees(math.atan(1)), 9)),
              'tan v = 1 betyder att kateterna är lika långa. Det händer när v = 45°.'),
        skriv('En kon har radien 3 cm och höjden 4 cm. Beräkna volymen i cm³ med en decimal.', t(KON_NP),
              'V = π · 3² · 4 / 3 = 12π ≈ 37,7 cm³.'),
        skriv('Två likformiga cylindrar har höjderna 5 cm och 10 cm. Hur många gånger så stor volym har den större?',
              t((10 // 5) ** 3),
              'Längdskalan är 2, och volymskalan är 2³ = 8.'),
        bråkval('Du kastar två tärningar. Hur stor är sannolikheten att summan blir 10 eller mer?', TARN_ALT, TARNING_10,
                'Sex av 36 utfall: 4+6, 5+5, 6+4, 5+6, 6+5 och 6+6. 6/36 = 1/6.'),
        bråkval('En klass har 12 tjejer och 10 killar. Två elever lottas till elevrådet. Hur stor är sannolikheten '
                'att båda är tjejer?', TJEJ_ALT, TJEJER,
                '12/22 · 11/21 = 2/7. Den som lottats först kan inte lottas igen, så andra gången är det 11 tjejer av 21.'),
        val('Varför är arean av en kvadrat med diagonalen d lika med d²/2?',
            ['Pythagoras sats ger s² + s² = d², så arean s² är d²/2',
             'Diagonalen är dubbelt så lång som sidan, så arean s² är d²/2',
             'Arean är diagonalen gånger halva sidan, och sidan är d/2'],
            'Pythagoras sats ger s² + s² = d², så arean s² är d²/2',
            'Diagonalen är hypotenusa i en rätvinklig triangel med kateterna s och s. 2s² = d² ger s² = d²/2.'),
        sant('Om alla längder i en figur blir dubbelt så stora blir arean dubbelt så stor.', False,
             'Areaskalan är längdskalan i kvadrat: 2² = 4. Arean blir fyra gånger så stor.'),
    ], beskrivning='Trigonometri, volym, likformighet och sannolikhet i flera steg. '
                   + BLAD % 'NP-träning: geometri och sannolikhet'),

    niva('ma-gy1-blad-genomgang-1', 'Genomgång: matematik 1', 'Genomgång inför provet', [
        skriv('Vilken förändringsfaktor hör till en minskning med 7 %?', t(F(93, 100)),
              'Efter en minskning med 7 % finns 93 % kvar, och 93 % är 0,93.'),
        val('Skriv 0,00052 i grundpotensform.', ['5,2 · 10⁻⁴', '5,2 · 10⁻³', '5,2 · 10⁻⁵', '52 · 10⁴'], '5,2 · 10⁻⁴',
            'Decimaltecknet flyttas fyra steg åt höger till 5,2, och då är exponenten −4.'),
        skriv('Förenkla 3⁴ · 3² / 3⁵.', [t(3 ** (4 + 2 - 5)), '3¹', '3^1'],
              'Exponenterna adderas vid multiplikation och subtraheras vid division: 4 + 2 − 5 = 1.'),
        val('Andelen ökar från 20 % till 25 %. Hur beskrivs ökningen i texten?',
            ['5 procentenheter, men 25 procent', '25 procentenheter, men 5 procent', '5 procent, och lika många procentenheter'],
            '5 procentenheter, men 25 procent',
            'Skillnaden 25 − 20 = 5 är procentenheter. I förhållande till 20 är ökningen 5/20 = 25 %.'),
        skriv('Vad är a⁰ enligt potenslagarna, om a inte är 0?', t(1),
              'aᵐ / aᵐ = aᵐ⁻ᵐ = a⁰, och ett tal delat med sig självt är 1.'),
        val('Vad är a i exponentialfunktionen y = C · aˣ?', ['Förändringsfaktorn', 'Startvärdet', 'Lutningen'],
            'Förändringsfaktorn',
            'a är det man multiplicerar med för varje steg i x. C är startvärdet.'),
        val('Vilken kvot är cos v i en rätvinklig triangel?',
            ['närliggande / hypotenusan', 'motstående / hypotenusan', 'motstående / närliggande'],
            'närliggande / hypotenusan',
            'Cosinus tar kateten som ligger intill vinkeln, sinus den mitt emot och tangens kateterna mot varandra.'),
        skriv('Sannolikheten att en händelse inträffar är 0,15. Vad är sannolikheten att den inte inträffar?',
              t(1 - F(15, 100)),
              'Antingen inträffar den eller inte, och tillsammans är det 1: 1 − 0,15 = 0,85.'),
        skriv('Två oberoende händelser har sannolikheterna 0,5 och 0,4. Vad är sannolikheten att båda inträffar?',
              t(F(1, 2) * F(4, 10)),
              'För oberoende händelser multipliceras sannolikheterna: 0,5 · 0,4 = 0,2.'),
    ], beskrivning='Faktabladet inför provet: procent, potenser, funktioner, trigonometri och sannolikhet. '
                   + BLAD % 'Genomgång: matematik 1',
       text='Procent och förändringsfaktor\n\n'
            'En ökning med 12 % ger förändringsfaktorn 1,12 och en minskning med 12 % ger 0,88. Nytt värde = gammalt '
            'värde · förändringsfaktor. Från 20 % till 25 % är en ökning med 5 procentenheter, men med 25 procent.\n\n'
            'Potenser\n\n'
            'aᵐ · aⁿ = aᵐ⁺ⁿ, aᵐ / aⁿ = aᵐ⁻ⁿ, (aᵐ)ⁿ = aᵐⁿ, a⁰ = 1 och a⁻ⁿ = 1/aⁿ. Grundpotensform: 45 000 = 4,5 · 10⁴.\n\n'
            'Funktioner\n\n'
            'Linjär funktion: y = kx + m, där k är lutningen och m skärningen med y-axeln. Exponentialfunktion: '
            'y = C · aˣ, där C är startvärdet och a förändringsfaktorn.\n\n'
            'Trigonometri och sannolikhet\n\n'
            'I en rätvinklig triangel är sin v = motstående / hypotenusan, cos v = närliggande / hypotenusan och '
            'tan v = motstående / närliggande. För oberoende händelser multipliceras sannolikheterna, och '
            'sannolikheten att något inte inträffar är 1 minus sannolikheten att det inträffar.'),
])


GY2 = bana('Matematik', 'gy2', [
    niva('ma-gy2-blad-andragrad-1', 'pq-formeln och nollproduktmetoden', 'Andragradsekvationer och tillväxt', [
        val_losningar('Lös ekvationen x² = 49.', ANDRA_1, {7, -7},
                      'Både 7 · 7 och (−7) · (−7) är 49, så det finns två lösningar.'),
        val_losningar('Lös ekvationen x² − 6x + 8 = 0 med pq-formeln.', ANDRA_2, pq(-6, 8),
                      'p = −6 och q = 8: x = 3 ± √(9 − 8) = 3 ± 1.'),
        val_losningar('Lös ekvationen x² + 2x − 15 = 0.', ANDRA_3, pq(2, -15),
                      'x = −1 ± √(1 + 15) = −1 ± 4, alltså 3 eller −5.'),
        val_losningar('Lös ekvationen 2x² − 8x − 10 = 0.', ANDRA_4, pq(-4, -5),
                      'Dela först med 2: x² − 4x − 5 = 0. Då är x = 2 ± √(4 + 5) = 2 ± 3.'),
        val_losningar('Lös ekvationen x(x − 4) = 0.', ANDRA_5, {0, 4},
                      'En produkt är noll när någon faktor är noll: x = 0 eller x − 4 = 0.'),
        val('Hur många reella lösningar har ekvationen x² + 4x + 5 = 0?', ['Ingen', 'En', 'Två'],
            {0: 'Ingen', 1: 'En', 2: 'Två'}[len(pq(4, 5))],
            '(p/2)² − q = 4 − 5 = −1. Det är negativt under rottecknet, så det finns ingen reell lösning.'),
        val('Varför saknar ekvationen x² + 4x + 5 = 0 reella lösningar?',
            ['(p/2)² − q = 4 − 5 är negativt, och roten ur ett negativt tal är inget reellt tal',
             'p/2 = 2 är positivt, och då blir båda lösningarna ur formeln mindre än noll',
             'q = 5 är positivt, och en ekvation med positivt q saknar alltid reella lösningar'],
            '(p/2)² − q = 4 − 5 är negativt, och roten ur ett negativt tal är inget reellt tal',
            'Det är uttrycket under rottecknet som avgör. Ett positivt q räcker inte: x² − 6x + 8 = 0 har två lösningar.'),
        val('En rektangel med sidorna x cm och x + 2 cm har arean 24 cm². Vilken ekvation stämmer?', RECT_EKV,
            RECT_EKV[0],
            'Arean är x(x + 2) = 24. Multiplicera in och flytta över 24: x² + 2x − 24 = 0.'),
        skriv('En rektangel har arean 24 cm², och den ena sidan är 2 cm längre än den andra. Hur lång är den kortare '
              'sidan i cm?', t(RECT),
              'x² + 2x − 24 = 0 ger x = −1 ± 5, alltså 4 eller −6. En längd kan inte vara negativ: 4 cm (och 6 cm).'),
    ], beskrivning='Andragradsekvationer med pq-formeln, nollproduktmetoden och en tillämpning. '
                   + BLAD % 'Andragradsekvationer'),

    niva('ma-gy2-blad-exponential-1', 'Exponentialfunktioner och lg', 'Andragradsekvationer och tillväxt', [
        skriv('Beräkna 2⁵.', t(2 ** 5), '2 · 2 · 2 · 2 · 2 = 32.'),
        skriv('Beräkna 5⁻² i decimalform.', t(F(1, 25)),
              'En negativ exponent betyder ett genom: 5⁻² = 1/5² = 1/25 = 0,04.'),
        skriv('Beräkna lg 0,01 utan räknare.', svar(-2),
              '0,01 = 10⁻², så lg 0,01 = −2.'),
        skriv('Lös ekvationen 2ˣ = 64 utan räknare.', svar(6, 'x'),
              '2 · 2 · 2 · 2 · 2 · 2 = 64, alltså 2⁶ = 64 och x = 6.'),
        skriv('Lös ekvationen 3ˣ = 20. Svara med två decimaler.', svar(EXP_3X, 'x'),
              'Ta lg på båda sidor: x · lg 3 = lg 20, så x = lg 20 / lg 3 ≈ 2,73.'),
        val('En bakteriekultur har 500 bakterier och antalet fördubblas varje timme. Vilken funktion ger antalet y '
            'efter x timmar?', ['y = 500 · 2ˣ', 'y = 2 · 500ˣ', 'y = 500 + 2x', 'y = 500 · x²'], 'y = 500 · 2ˣ',
            'Startvärdet är 500 och förändringsfaktorn 2 för varje timme, så y = C · aˣ = 500 · 2ˣ.'),
        skriv('En bakteriekultur har 500 bakterier och antalet fördubblas varje timme. Hur många bakterier finns det '
              'efter 6 timmar?', t(BAKT_6),
              '500 · 2⁶ = 500 · 64 = 32 000.'),
        skriv('En bakteriekultur har 500 bakterier och antalet fördubblas varje timme. Efter hur många timmar finns '
              'det 100 000 bakterier? Svara med två decimaler.', t(BAKT_T),
              '500 · 2ˣ = 100 000 ger 2ˣ = 200, och x = lg 200 / lg 2 ≈ 7,64 timmar.'),
        bråkval('Ett ämne halveras var 5:e år. Hur stor andel finns kvar efter 15 år?', HALV, F(1, 8),
                '15 år är tre halveringar: 1/2 · 1/2 · 1/2 = 1/8.'),
        skriv('En bil värd 200 000 kr minskar i värde med 12 % per år. Vad är den värd efter 4 år? '
              'Avrunda till hundratal kronor.', t(int(BIL_2)),
              '200 000 · 0,88⁴ ≈ 119 939 kr, alltså ungefär 119 900 kr.'),
    ], beskrivning='Potenser, tiologaritmer och exponentiell tillväxt och minskning. '
                   + BLAD % 'Exponentialfunktioner och logaritmer'),

    niva('ma-gy2-blad-trigonometri-1', 'Rätvinkliga trianglar', 'Trigonometri', [
        skriv('I en rätvinklig triangel är hypotenusan 10 cm och en av de spetsiga vinklarna 35°. Hur lång är kateten '
              'mitt emot 35°-vinkeln? Svara i cm med en decimal.', t(TR_X),
              'sin 35° = x / 10, så x = 10 · sin 35° ≈ 5,7 cm.'),
        skriv('I en rätvinklig triangel är den närliggande kateten 8 cm och den motstående kateten 6 cm. Hur stor är '
              'vinkeln v i grader? Svara med en decimal.', t(TR_V),
              'tan v = 6/8 = 0,75, och v = arctan 0,75 ≈ 36,9°.'),
        skriv('En stege är 4,0 m lång och bildar vinkeln 70° med marken. Hur högt upp på väggen når den? '
              'Svara i meter med en decimal.', t(TR_STEGE),
              'Höjden är kateten mitt emot vinkeln och stegen är hypotenusan: 4,0 · sin 70° ≈ 3,8 m.'),
        skriv('Från en punkt 50 m från ett torn är höjdvinkeln till tornets topp 32°. Hur högt är tornet? '
              'Svara i meter med en decimal.', t(TR_TORN),
              'tan 32° = h / 50, så h = 50 · tan 32° ≈ 31,2 m.'),
        val('Vad är sin 30°?', [a for a, _ in SIN_PI6], '1/2',
            'I en liksidig triangel som delas mitt itu är den korta kateten halva hypotenusan: sin 30° = 1/2.'),
        sant('cos 60° och sin 30° har samma värde.', abs(math.cos(grader(60)) - math.sin(grader(30))) < 1e-12,
             'Båda är 0,5. Den katet som ligger mitt emot 30° ligger intill 60°.'),
        val('Vilken kvot är tan v i en rätvinklig triangel?',
            ['motstående / närliggande', 'närliggande / motstående', 'motstående / hypotenusan', 'närliggande / hypotenusan'],
            'motstående / närliggande',
            'Tangens jämför de två kateterna: den mitt emot vinkeln delat med den intill.'),
        val('En stege lutar mot en vägg. Du vet stegens längd och vinkeln v mot marken. Hur räknar du ut hur högt '
            'upp den når?', ['höjden = längden · sin v', 'höjden = längden · cos v', 'höjden = längden · tan v'],
            'höjden = längden · sin v',
            'Stegen är hypotenusan och höjden är kateten mitt emot v. Motstående / hypotenusan är sinus.'),
    ], beskrivning='Sinus, cosinus och tangens i rätvinkliga trianglar. '
                   + BLAD % 'Trigonometri – räta och allmänna trianglar'),

    niva('ma-gy2-blad-trigonometri-2', 'Sinussatsen, cosinussatsen och arean', 'Trigonometri', [
        skriv('I en triangel är vinkeln A = 40°, vinkeln B = 65° och sidan a = 8 cm. Beräkna sidan b i cm med en decimal.',
              t(TR_B),
              'Sinussatsen: b / sin 65° = 8 / sin 40°, så b = 8 · sin 65° / sin 40° ≈ 11,3 cm.'),
        skriv('I en triangel är b = 7 cm, c = 9 cm och vinkeln A = 50° mellan dem. Beräkna sidan a i cm med en decimal.',
              t(TR_A),
              'Cosinussatsen: a² = 49 + 81 − 2 · 7 · 9 · cos 50° ≈ 49,0, så a ≈ 7,0 cm.'),
        skriv('En triangel har sidorna 7 cm och 9 cm och vinkeln 50° mellan dem. Beräkna arean i cm² med en decimal.',
              t(TR_T),
              'T = 7 · 9 · sin 50° / 2 ≈ 24,1 cm².'),
        skriv('I en triangel är b = 5 cm, c = 8 cm och vinkeln A = 60° mellan dem. Hur lång är sidan a i cm?',
              t(round(TR_A2, 9)),
              'a² = 25 + 64 − 2 · 5 · 8 · cos 60° = 89 − 40 = 49, eftersom cos 60° = 0,5. a = 7 cm.'),
        skriv('I en triangel är vinkeln A = 30°, vinkeln B = 90° och sidan a = 5 cm. Hur lång är sidan b i cm?',
              t(round(TR_SIN_B, 9)),
              'Sinussatsen: b = 5 · sin 90° / sin 30° = 5 · 1 / 0,5 = 10 cm.'),
        val('När använder du cosinussatsen för att räkna ut en sida i en triangel?',
            ['När du känner två sidor och vinkeln mellan dem',
             'När du känner två vinklar och sidan mitt emot den ena',
             'När du känner en sida och vinkeln mitt emot den'],
            'När du känner två sidor och vinkeln mellan dem',
            'a² = b² + c² − 2bc · cos A kräver b, c och vinkeln A mellan dem. Med två vinklar och en sida passar sinussatsen.'),
        val('Vilken formel ger arean av en triangel med sidorna b och c och vinkeln A mellan dem?',
            ['T = b · c · sin A / 2', 'T = b · c · cos A / 2', 'T = b · c / 2', 'T = b · c · tan A / 2'],
            'T = b · c · sin A / 2',
            'Höjden mot sidan b är c · sin A, och arean är basen gånger höjden delat med 2.'),
        sant('Sinussatsen a / sin A = b / sin B gäller i alla trianglar, inte bara i rätvinkliga.', True,
             'Sinussatsen gäller för alla trianglar. Det är därför den behövs när triangeln inte är rätvinklig.'),
    ], beskrivning='Sinussatsen, cosinussatsen och areasatsen i trianglar som inte är rätvinkliga. '
                   + BLAD % 'Trigonometri – räta och allmänna trianglar'),

    niva('ma-gy2-blad-sannolikhet-1', 'Dragningar med och utan återläggning', 'Sannolikhet och kombinatorik', [
        bråkval('En påse har 3 röda och 2 blå kulor. Du drar två kulor utan återläggning. Vad är sannolikheten '
                'för två röda?', ['3/10', '9/25', '3/5', '1/5'], TVA_RODA,
                'Första röd: 3/5. Då är 2 röda kvar av 4: 2/4. Längs grenen multipliceras: 3/5 · 2/4 = 3/10.'),
        bråkval('En påse har 3 röda och 2 blå kulor. Du drar två kulor utan återläggning. Vad är sannolikheten '
                'att få en kula av varje färg?', ['3/5', '6/25', '12/25', '3/10'], EN_AV_VARJE,
                'Två grenar: röd sedan blå 3/5 · 2/4, och blå sedan röd 2/5 · 3/4. Summan är 12/20 = 3/5.'),
        bråkval('En påse har 3 röda och 2 blå kulor. Du drar en kula, lägger tillbaka den och drar igen. '
                'Vad är sannolikheten för två röda?', ['9/25', '3/10', '6/25', '3/5'], MED_ATER,
                'Med återläggning är det 3/5 båda gångerna: 3/5 · 3/5 = 9/25.'),
        bråkval('Två tärningar kastas. Vad är sannolikheten att summan blir 7?', ['1/6', '7/36', '1/12', '5/36'], SUMMA_7,
                'Sex av 36 utfall ger 7: 1+6, 2+5, 3+4, 4+3, 5+2 och 6+1. 6/36 = 1/6.'),
        bråkval('Du kastar en tärning tre gånger. Vad är sannolikheten att få minst en sexa?',
                ['91/216', '1/2', '1/216', '125/216'], MINST_SEXA,
                'Räkna med komplementet: ingen sexa alls är (5/6)³ = 125/216, så minst en är 1 − 125/216 = 91/216.'),
        bråkval('En påse har 4 gröna och 6 gula kulor. Du drar två kulor utan återläggning. Vad är sannolikheten '
                'att båda är gula?', ['1/3', '9/25', '3/5', '2/15'], TVA_GULA,
                '6/10 · 5/9 = 30/90 = 1/3. Efter den första gula är 5 gula kvar av 9.'),
        sant('I ett träddiagram multiplicerar man sannolikheterna längs en gren och adderar sannolikheterna för olika grenar.',
             True,
             'Längs en gren ska båda sakerna hända (gånger). Olika grenar är olika sätt att nå målet (plus).'),
        val('Varför ändras sannolikheten vid den andra dragningen när man drar utan återläggning?',
            ['Det finns en kula mindre i påsen, och färgen som drogs har en kula mindre',
             'Påsen skakas om mellan dragningarna, och då slumpas sannolikheterna om',
             'En färg som redan har dragits blir alltid mer sannolik nästa gång'],
            'Det finns en kula mindre i påsen, och färgen som drogs har en kula mindre',
            'Både nämnaren (alla kulor) och täljaren (kulorna av den färgen) kan ändras av den första dragningen.'),
    ], beskrivning='Träddiagram, dragningar med och utan återläggning och komplementhändelse. '
                   + BLAD % 'Sannolikhet och kombinatorik'),

    niva('ma-gy2-blad-kombinatorik-1', 'Räkna antal sätt', 'Sannolikhet och kombinatorik', [
        skriv('Hur många olika fyrsiffriga koder kan man bilda med siffrorna 0–9 om siffrorna får upprepas?', t(KODER),
              'Tio val för varje siffra: 10 · 10 · 10 · 10 = 10⁴ = 10 000.'),
        skriv('Hur många olika fyrsiffriga koder kan man bilda med siffrorna 0–9 om ingen siffra får upprepas?',
              t(KODER_OLIKA),
              'En siffra mindre att välja på för varje plats: 10 · 9 · 8 · 7 = 5 040.'),
        skriv('På hur många sätt kan 5 personer ställa sig i en kö?', t(KO),
              '5 kan stå först, sedan 4 kvar, och så vidare: 5! = 5 · 4 · 3 · 2 · 1 = 120.'),
        skriv('Ett lag på 6 personer ska välja 2 till ett uppdrag. På hur många sätt kan det göras?', t(VALJ_2),
              '6 · 5 = 30 sätt med ordning, men varje par räknas två gånger: 30 / 2 = 15.'),
        skriv('På hur många sätt kan man välja 3 av 5 personer, utan hänsyn till ordningen?', t(VALJ_3),
              '5! / (3! · 2!) = 120 / 12 = 10.'),
        skriv('Vad är 4! ?', t(math.factorial(4)), '4! = 4 · 3 · 2 · 1 = 24.'),
        skriv('En restaurang har 3 förrätter, 4 varmrätter och 2 efterrätter. På hur många sätt kan man välja en '
              'trerättersmiddag med en rätt av varje sort?', t(MIDDAG),
              'Multiplikationsprincipen: 3 · 4 · 2 = 24.'),
        val('Varför delar man med 2 när man räknar hur många sätt man kan välja 2 av 6 personer?',
            ['Paret Anna och Bo är samma val som Bo och Anna, så varje par räknas två gånger',
             'Man väljer bara en tredjedel av gruppen, och därför ska antalet sätt halveras',
             'Två av personerna är redan valda från början och ska räknas bort ur antalet'],
            'Paret Anna och Bo är samma val som Bo och Anna, så varje par räknas två gånger',
            '6 · 5 räknar ordnade par. När ordningen inte spelar roll är 2! = 2 ordningar samma val.'),
    ], beskrivning='Multiplikationsprincipen, fakultet och att välja k av n. '
                   + BLAD % 'Sannolikhet och kombinatorik'),

    niva('ma-gy2-blad-np-utan-1', 'NP-träning utan räknare', 'NP-träning', [
        val_losningar('Lös ekvationen x² − 9 = 0.', ['x = 3 eller x = −3', 'x = 3', 'x = 9 eller x = −9', 'x = 4,5'],
                      pq(0, -9), 'x² = 9, och både 3 och −3 i kvadrat blir 9.'),
        val_lika('Utveckla (x + 5)².', UTV_5, lambda x: (x + 5) ** 2,
                 'Första kvadreringsregeln: x² + 2 · 5 · x + 5² = x² + 10x + 25. Mittentermen glöms lätt.'),
        val_lika('Faktorisera x² − 6x.', FAKT_6, lambda x: x * x - 6 * x,
                 'Båda termerna har faktorn x: x² − 6x = x(x − 6).'),
        skriv('Beräkna lg 1000 + lg 0,1.', svar(3 + (-1)),
              'lg 1000 = 3 eftersom 10³ = 1000, och lg 0,1 = −1. Summan är 2.'),
        val_losningar('Lös ekvationen x² + 2x − 8 = 0.',
                      ['x = 2 eller x = −4', 'x = −2 eller x = 4', 'x = 1 eller x = −8', 'x = 4 eller x = 2'],
                      pq(2, -8), 'x = −1 ± √(1 + 8) = −1 ± 3.'),
        val('Lös ekvationssystemet y = 2x − 1 och y = −x + 5.', SYS_1, 'x = 2, y = 3',
            'Sätt uttrycken lika: 2x − 1 = −x + 5 ger 3x = 6, x = 2 och y = 3.'),
        val('För vilka värden på k har ekvationen x² + 4x + k = 0 två reella lösningar?', K_ALT, 'k < 4',
            'pq ger x = −2 ± √(4 − k). Två lösningar kräver 4 − k > 0, alltså k < 4. k = 4 ger en dubbelrot.'),
        val('Vilken är minimipunkten för f(x) = x² − 4x + 3?', MINPUNKT, '(2, −1)',
            'Symmetrilinjen är x = 2, mitt emellan nollställena 1 och 3, och f(2) = 4 − 8 + 3 = −1.'),
        val('Varför är (n + 1)² − (n − 1)² delbart med 4 för alla heltal n?',
            ['Uttrycket blir 4n när man utvecklar, och 4n är delbart med 4',
             'Det stämmer för n = 1, 2 och 3, och därför stämmer det för alla n',
             'Båda kvadraterna är delbara med 4, och då är skillnaden också det'],
            'Uttrycket blir 4n när man utvecklar, och 4n är delbart med 4',
            '(n² + 2n + 1) − (n² − 2n + 1) = 4n. Några prövade tal är inget bevis, och (n + 1)² är inte alltid delbart med 4.'),
    ], beskrivning='Algebra, andragradsekvationer och ekvationssystem i stil med provets del utan räknare. '
                   + BLAD % 'NP-träning: matematik 2 utan räknare'),

    niva('ma-gy2-blad-np-med-1', 'NP-träning med räknare', 'NP-träning', [
        skriv('Höjden y meter för en kastad boll efter x sekunder är y = −4,9x² + 12x + 1,5. Hur högt kommer bollen '
              'som högst? Svara i meter med en decimal.', t(BOLL_MAX),
              'Högsta punkten ligger på symmetrilinjen x = 12 / 9,8 ≈ 1,22 s, och där är y ≈ 8,8 m.'),
        skriv('Höjden y meter för en kastad boll efter x sekunder är y = −4,9x² + 12x + 1,5. Efter hur många sekunder '
              'slår bollen i marken? Svara med en decimal.', t(BOLL_NOLL),
              'y = 0 ger x ≈ 2,57 och x ≈ −0,12. Den negativa tiden förkastas, så svaret är 2,6 s.'),
        val('Ekvationen −4,9x² + 12x + 1,5 = 0 för en kastad boll ger x ≈ 2,57 och x ≈ −0,12, där x är tiden i sekunder. '
            'Varför förkastas x ≈ −0,12?',
            ['Tiden räknas från kastet, och en negativ tid ligger före kastet',
             'En andragradsekvation har bara en rätt lösning, och det är den största',
             'Bollen kan inte vara på höjden noll innan den har nått sin högsta punkt'],
            'Tiden räknas från kastet, och en negativ tid ligger före kastet',
            'Modellen gäller bara från x = 0, när bollen kastas. Den negativa lösningen är matematiskt rätt men saknar mening här.'),
        skriv('Lös ekvationen 500 · 1,07ˣ = 1 200. Svara med två decimaler.', svar(SPAR, 'x'),
              'Dela med 500: 1,07ˣ = 2,4. x = lg 2,4 / lg 1,07 ≈ 12,94.'),
        skriv('Tio elever fick poängen 12, 15, 9, 18, 14, 11, 16, 13, 10 och 17. Beräkna medelvärdet.', t(POANG_MV),
              'Summan är 135 och antalet 10: 135 / 10 = 13,5.'),
        skriv('Tio elever fick poängen 12, 15, 9, 18, 14, 11, 16, 13, 10 och 17. Beräkna standardavvikelsen, räknad '
              'som för ett stickprov, med en decimal.', t(POANG_S),
              'Kvadratsumman av avvikelserna från 13,5 är 82,5. 82,5 / 9 ≈ 9,17, och roten ur det är ungefär 3,0.'),
        val('Glassförsäljning och antalet drunkningsolyckor ökar båda på sommaren. Vilken slutsats stämmer?',
            ['Det finns en korrelation, men värmen är en tredje variabel som påverkar båda',
             'Glassen orsakar olyckorna, eftersom båda ökar under samma månader varje år',
             'Det finns ingen korrelation, eftersom glass och bad inte hänger ihop alls'],
            'Det finns en korrelation, men värmen är en tredje variabel som påverkar båda',
            'Att två saker samvarierar (korrelation) betyder inte att den ena orsakar den andra (kausalitet).'),
        val('En rektangulär hage längs en vägg stängslas in på tre sidor med 60 m stängsel. Vilka mått ger störst area?',
            [h[0] for h in HAGE], HAGE[0][0],
            'A(x) = x(60 − 2x) har sitt maximum mitt emellan nollställena 0 och 30, vid x = 15. Då är sidan längs väggen 30 m.'),
        skriv('En rektangulär hage längs en vägg stängslas in på tre sidor med 60 m stängsel. Hur stor är den största '
              'möjliga arean, i m²?', t(HAGE_MAX),
              '15 m ut från väggen och 30 m längs väggen ger 15 · 30 = 450 m².'),
    ], beskrivning='Andragradsmodeller, exponentialekvationer, statistik och optimering i stil med provets del med räknare. '
                   + BLAD % 'NP-träning: matematik 2 med räknare'),

    niva('ma-gy2-blad-np-andragrad-1', 'NP-träning: andragradsfunktioner', 'NP-träning', [
        val_losningar('Lös ekvationen x² − 5x + 6 = 0.', ANDRA_6, pq(-5, 6),
                      'x = 2,5 ± √(6,25 − 6) = 2,5 ± 0,5.'),
        val_losningar('Lös ekvationen 2x² = 18.', ANDRA_7, pq(0, -9),
                      'Dela med 2: x² = 9, så x = 3 eller x = −3.'),
        val('Bestäm nollställena till f(x) = x² − 2x − 24.', ANDRA_8,
            enda(ANDRA_8, lambda a: mangd(a.replace(' och ', ' eller ')) == pq(-2, -24)),
            'x = 1 ± √(1 + 24) = 1 ± 5, alltså 6 och −4.'),
        skriv('Ange symmetrilinjen för y = (x − 1)(x − 7). Svara med x-värdet.', svar(F(1 + 7, 2), 'x'),
              'Symmetrilinjen går mitt emellan nollställena 1 och 7: (1 + 7)/2 = 4.'),
        val_lika('En andragradsfunktion har nollställena x = −1 och x = 5 och går genom punkten (0, −10). '
                 'Vilken är funktionen?', FUNK_NOLL, lambda x: 2 * (x + 1) * (x - 5),
                 'Ansatsen f(x) = a(x + 1)(x − 5) ger f(0) = −5a = −10, så a = 2. Utan a går kurvan inte genom (0, −10).'),
        val_lika('Utveckla och förenkla (x + 3)² − (x − 3)².', SKILLNAD, lambda x: (x + 3) ** 2 - (x - 3) ** 2,
                 '(x² + 6x + 9) − (x² − 6x + 9) = 12x. Parentesen runt det andra uttrycket byter tecken på alla termer.'),
        skriv('För vilket värde på c har ekvationen x² − 6x + c = 0 exakt en lösning?', svar(C_EN, 'c'),
              'pq ger x = 3 ± √(9 − c). En enda lösning när roten är 0, alltså c = 9: x² − 6x + 9 = (x − 3)².'),
        skriv('Vilket är det minsta värde som f(x) = x² − 4x + 5 kan anta?', t(F_MIN_2),
              'f(x) = (x − 2)² + 1. Kvadraten är minst 0, så minsta värdet är 1, när x = 2.'),
        sant('Funktionen f(x) = x² − 4x + 5 saknar reella nollställen.', not pq(-4, 5),
             'pq ger x = 2 ± √(4 − 5) = 2 ± √(−1). Negativt under rottecknet: inga reella nollställen.'),
    ], beskrivning='Nollställen, symmetrilinje, minsta värde och att bestämma en andragradsfunktion. '
                   + BLAD % 'NP-träning: andragradsfunktioner'),

    niva('ma-gy2-blad-np-blandat-1', 'NP-träning: blandat', 'NP-träning', [
        skriv('Beräkna lg 10 000 − lg 100.', svar(4 - 2),
              'lg 10 000 = 4 och lg 100 = 2, så skillnaden är 2.'),
        skriv('Lös ekvationen 10ˣ = 500. Svara med tre decimaler.', svar(LG_500, 'x'),
              'x = lg 500 ≈ 2,699, för lg är just det tal 10 ska upphöjas till.'),
        val('Lös ekvationssystemet 2x + 3y = 12 och x − y = 1.', SYS_2, 'x = 3, y = 2',
            'x = y + 1 insatt: 2(y + 1) + 3y = 12 ger 5y = 10, y = 2 och x = 3.'),
        skriv('Värdena 4, 7, 7, 8 och 9 mättes. Beräkna medelvärdet.', t(STD_5_MV),
              'Summan är 35 och antalet 5: 35 / 5 = 7.'),
        skriv('Värdena 4, 7, 7, 8 och 9 mättes. Beräkna standardavvikelsen, räknad som för ett stickprov, med en decimal.',
              t(STD_5_S),
              'Avvikelserna från 7 är −3, 0, 0, 1 och 2, kvadratsumman 14. √(14/4) ≈ 1,9.'),
        skriv('En bakteriekultur fördubblas var åttonde timme. Hur många timmar tar det innan den har blivit tio gånger '
              'så stor? Svara med en decimal.', t(TIOFALD),
              '2ˣ = 10 ger x = lg 10 / lg 2 ≈ 3,32 fördubblingar, och 8 · 3,32 ≈ 26,6 timmar.'),
        val('I ett spridningsdiagram ligger punkterna nära en rät linje med negativ lutning. Vad säger det?',
            ['När den ena variabeln ökar minskar den andra, nästan linjärt',
             'När den ena variabeln ökar ökar också den andra, nästan linjärt',
             'Att den ena variabeln är orsaken till att den andra minskar'],
            'När den ena variabeln ökar minskar den andra, nästan linjärt',
            'Negativ lutning är ett starkt negativt samband. Det säger inget om vad som orsakar vad.'),
        val('Varför gäller lg(a · b) = lg a + lg b?',
            ['Med a = 10ᵐ och b = 10ⁿ blir a · b = 10ᵐ⁺ⁿ, och då är lg(a · b) = m + n',
             'Med a = 10ᵐ och b = 10ⁿ blir a · b = 10ᵐⁿ, och då är lg(a · b) = m · n',
             'Prövning med a = 10 och b = 100 stämmer, och ett exempel räcker som bevis'],
            'Med a = 10ᵐ och b = 10ⁿ blir a · b = 10ᵐ⁺ⁿ, och då är lg(a · b) = m + n',
            'Potenslagen 10ᵐ · 10ⁿ = 10ᵐ⁺ⁿ är kärnan. m = lg a och n = lg b, så lg(a · b) = lg a + lg b.'),
        sant('En stark korrelation mellan två variabler visar att den ena orsakar den andra.', False,
             'Korrelation är samvariation. En tredje variabel kan styra båda, som värmen styr glass och bad.'),
    ], beskrivning='Logaritmer, ekvationssystem, statistik och samband i stil med provet. '
                   + BLAD % 'NP-träning: matematik 2, blandat'),

    niva('ma-gy2-blad-genomgang-1', 'Genomgång: matematik 2', 'Genomgång inför provet', [
        val_losningar('Lös x² − 2x − 3 = 0 med pq-formeln.', ANDRA_9, pq(-2, -3),
                      'p = −2 och q = −3: x = 1 ± √(1 + 3) = 1 ± 2, alltså 3 eller −1.'),
        val_lika('Utveckla (2x − 1)².', UTV_2X, lambda x: (2 * x - 1) ** 2,
                 'Andra kvadreringsregeln: (2x)² − 2 · 2x · 1 + 1² = 4x² − 4x + 1.'),
        val('Skriv lg 8 med hjälp av lg 2.', [a for a, _ in LG8], '3 · lg 2',
            '8 = 2³, och lg aⁿ = n · lg a ger lg 8 = 3 · lg 2.'),
        val('Vad har grafen till y = ax² + bx + c om a < 0?', ['En maximipunkt', 'En minimipunkt', 'Ingen symmetrilinje'],
            'En maximipunkt',
            'Med a < 0 öppnar sig parabeln nedåt, så den har en högsta punkt.'),
        skriv('Vad är symmetrilinjen för y = x² + 8x + 3? Svara med x-värdet.', svar(F(-8, 2), 'x'),
              'För y = x² + px + q är symmetrilinjen x = −p/2 = −8/2 = −4.'),
        val_lika('Utveckla (x + 6)(x − 6).', KONJ, lambda x: (x + 6) * (x - 6),
                 'Konjugatregeln: (a + b)(a − b) = a² − b², här x² − 36.'),
        skriv('Ungefär hur många procent av värdena i en normalfördelning ligger inom två standardavvikelser från '
              'medelvärdet?', t(95),
              'Tumregeln: ungefär 68 % inom en standardavvikelse och ungefär 95 % inom två.'),
        val_losningar('Lös ekvationen x(x + 3) = 0.', ANDRA_10, {0, -3},
                      'Nollproduktmetoden: x = 0 eller x + 3 = 0, alltså x = −3.'),
        skriv('Beräkna lg 50 + lg 2 utan räknare.', svar(round(lg(50) + lg(2), 9)),
              'lg a + lg b = lg(a · b) = lg 100 = 2.'),
    ], beskrivning='Faktabladet inför provet: andragradsekvationer, kvadreringsreglerna, parabler, lg och statistik. '
                   + BLAD % 'Genomgång: matematik 2',
       text='Andragradsekvationer\n\n'
            'Ekvationen x² + px + q = 0 löses med pq-formeln: x = −p/2 ± √((p/2)² − q). Är uttrycket under '
            'rottecknet negativt saknas reella lösningar. Går vänsterledet att faktorisera kan du använda '
            'nollproduktmetoden: x(x − 4) = 0 ger x = 0 eller x = 4.\n\n'
            'Kvadreringsreglerna\n\n'
            '(a + b)² = a² + 2ab + b², (a − b)² = a² − 2ab + b² och konjugatregeln (a + b)(a − b) = a² − b².\n\n'
            'Andragradsfunktioner\n\n'
            'Grafen till y = ax² + bx + c är en parabel. Om a > 0 har den en minimipunkt och om a < 0 en '
            'maximipunkt. För y = x² + px + q är symmetrilinjen x = −p/2.\n\n'
            'Logaritmer och statistik\n\n'
            'lg x är det tal som 10 ska upphöjas till för att bli x. lg(ab) = lg a + lg b, lg(a/b) = lg a − lg b och '
            'lg aⁿ = n · lg a. Standardavvikelsen mäter hur mycket värdena sprider sig kring medelvärdet. I en '
            'normalfördelning ligger ungefär 68 % av värdena inom en standardavvikelse från medelvärdet och ungefär '
            '95 % inom två.'),
])


GY3 = bana('Matematik', 'gy3', [
    niva('ma-gy3-derivata-1', 'Deriveringsregeln', 'Derivata', [
        val_derivata('Derivera f(x) = x⁵.', F_X5, [P((5, 4)), P((1, 4)), P((5, 5)), P((4, 5))],
                     'Regeln: xⁿ blir n · xⁿ⁻¹. Exponenten 5 flyttas fram och minskas med 1: 5x⁴.'),
        val_derivata('Derivera f(x) = 4x³ − 2x + 7.', F_POL,
                     [P((12, 2), (-2, 0)), P((12, 2), (-2, 0), (7, 0)), P((12, 3), (-2, 1)), P((4, 2), (-2, 0))],
                     'Derivera term för term: 4 · 3x² = 12x², −2x blir −2 och konstanten 7 blir 0.'),
        val_derivata('Derivera f(x) = 2x⁶ + 5x².', F_POL2, [P((12, 5), (10, 1)), P((12, 6), (10, 2)), P((2, 5), (5, 1)),
                                                             P((12, 5), (5, 1))],
                     '2 · 6x⁵ = 12x⁵ och 5 · 2x = 10x.'),
        val_derivata('Derivera f(x) = 5x − 3x³.', F_POL3, [P((5, 0), (-9, 2)), P((5, 0), (-3, 2)), P((5, 1), (-9, 2)),
                                                           P((-9, 2))],
                     '5x blir 5 och −3x³ blir −3 · 3x² = −9x².'),
        val('Derivera f(x) = 6/x.', ['f′(x) = −6/x²', 'f′(x) = 6/x²', 'f′(x) = −6x²', 'f′(x) = 6'],
            enda(['f′(x) = −6/x²', 'f′(x) = 6/x²', 'f′(x) = −6x²', 'f′(x) = 6'],
                 lambda a: {'f′(x) = −6/x²': P((-6, -2)), 'f′(x) = 6/x²': P((6, -2)),
                            'f′(x) = −6x²': P((-6, 2)), 'f′(x) = 6': P((6, 0))}[a] == D(F_6X)),
            'Skriv om: 6/x = 6x⁻¹. Derivatan är 6 · (−1)x⁻² = −6x⁻² = −6/x².'),
        val_derivata('Derivera f(x) = 7.', F_7, [P(), P((7, 0)), P((7, 1)), P((1, 0))],
                     'En konstant ändras aldrig, så lutningen är 0 överallt.'),
        sant('f(x) = x² + 100 och g(x) = x² har samma derivata.', D(P((1, 2), (100, 0))) == D(P((1, 2))),
             'Konstanten 100 försvinner när man deriverar. Båda har derivatan 2x: kurvorna är samma, bara förskjutna uppåt.'),
        val('Derivera f(x) = √x, för x > 0. Tips: √x = x^(1/2).', [a for a, _ in SQRTX], 'f′(x) = 1/(2√x)',
            'x^(1/2) blir (1/2) · x^(−1/2), och x^(−1/2) är 1/√x. Alltså 1/(2√x).'),
    ], beskrivning='Deriveringsregeln för xⁿ, term för term, och för negativa och halva exponenter. '
                   + BLAD % 'Derivata – grunderna'),

    niva('ma-gy3-derivata-2', 'Derivatans värde och tangenten', 'Derivata', [
        skriv('Beräkna f′(2) om f(x) = x² + 3x.', svar(DER_2),
              'f′(x) = 2x + 3, så f′(2) = 4 + 3 = 7.'),
        skriv('Bestäm lutningen på tangenten till y = x³ i punkten där x = −1.', svar(DER_3),
              'y′ = 3x², och 3 · (−1)² = 3. Kvadraten gör lutningen positiv.'),
        skriv('Beräkna f′(3) om f(x) = 2x³ − 4x.', svar(DER_4),
              'f′(x) = 6x² − 4, så f′(3) = 6 · 9 − 4 = 50.'),
        skriv('Beräkna f′(−2) om f(x) = x⁴.', svar(DER_5),
              'f′(x) = 4x³, och 4 · (−2)³ = 4 · (−8) = −32.'),
        skriv('En boll har höjden h(t) = 20t − 5t² meter efter t sekunder. Beräkna h′(1).', svar(H_1),
              'h′(t) = 20 − 10t, så h′(1) = 10. Enheten är meter per sekund.'),
        val('En boll har höjden h(t) = 20t − 5t² meter efter t sekunder, och h′(1) = 10. Vad betyder det?',
            ['Efter 1 sekund stiger bollen med hastigheten 10 m/s',
             'Efter 1 sekund är bollen 10 meter över marken',
             'Under den första sekunden steg bollen 10 meter'],
            'Efter 1 sekund stiger bollen med hastigheten 10 m/s',
            'Derivatan är förändringstakten just då. Höjden efter 1 s är h(1) = 15 m, inte 10.'),
        skriv('En boll har höjden h(t) = 20t − 5t² meter efter t sekunder. Efter hur många sekunder är den som högst?',
              t(H_TOPP),
              'Högst är den när den slutar stiga: h′(t) = 20 − 10t = 0 ger t = 2.'),
        val('Vad anger f′(a)?',
            ['Lutningen på tangenten till kurvan y = f(x) där x = a',
             'Funktionens värde, alltså y-koordinaten, där x = a',
             'Arean under kurvan y = f(x) från x = 0 till x = a'],
            'Lutningen på tangenten till kurvan y = f(x) där x = a',
            'Derivatan i en punkt är hur snabbt f ändras där, och det är tangentens lutning.'),
        skriv('Tangenten till y = x² i punkten (3, 9) har ekvationen y = kx + m. Bestäm k.', svar(TANGENT_K, 'k'),
              'Tangentens lutning är derivatan: y′ = 2x, och 2 · 3 = 6.'),
    ], beskrivning='Derivatans värde i en punkt, tangentens lutning och derivatan som hastighet. '
                   + BLAD % 'Derivata – grunderna'),

    niva('ma-gy3-derivata-3', 'Extrempunkter', 'Derivata', [
        skriv('För vilket x har f(x) = x² − 8x + 3 en extrempunkt?', svar(EXT_X, 'x'),
              'f′(x) = 2x − 8 = 0 ger x = 4.'),
        val('f(x) = x² − 8x + 3 har en extrempunkt där x = 4. Vilken sort är den?',
            ['Minimipunkt', 'Maximipunkt', 'Terrasspunkt'], 'Minimipunkt',
            'f′ byter tecken från − till + vid x = 4, och parabeln öppnar sig uppåt.'),
        skriv('Vilket är det minsta värdet av f(x) = x² − 8x + 3?', svar(EXT_Y),
              'Minimum där x = 4: f(4) = 16 − 32 + 3 = −13.'),
        skriv('Vilket är det största värdet av f(x) = −x² + 6x?', svar(MAX_6X),
              'f′(x) = −2x + 6 = 0 ger x = 3, och f(3) = −9 + 18 = 9.'),
        val('Vad gäller i en extrempunkt till en funktion som är deriverbar överallt?',
            ['f′(x) = 0', 'f(x) = 0', 'f′(x) > 0', 'f″(x) = 0'], 'f′(x) = 0',
            'I en högsta eller lägsta punkt är tangenten vågrät, alltså är lutningen 0.'),
        val('f′(x) byter tecken från + till − när x passerar a. Vad har f där?',
            ['En maximipunkt', 'En minimipunkt', 'En terrasspunkt'], 'En maximipunkt',
            'Först stiger f och sedan sjunker den: x = a är toppen.'),
        skriv('f(x) = x³ − 12x. För vilket positivt x har funktionen en extrempunkt?', svar(EXT_12, 'x'),
              'f′(x) = 3x² − 12 = 0 ger x² = 4, alltså x = 2 eller x = −2. Den positiva är 2.'),
        val('f(x) = x³ − 12x har en extrempunkt där x = 2. Vilken sort är den?',
            ['Minimipunkt', 'Maximipunkt', 'Terrasspunkt'], 'Minimipunkt',
            'f″(x) = 6x och f″(2) = 12 > 0: kurvan böjer uppåt, så det är ett minimum.'),
        sant('Funktionen f(x) = x³ har en terrasspunkt där x = 0.', True,
             'f′(x) = 3x² är 0 där x = 0 men byter inte tecken: f stiger både före och efter.'),
    ], beskrivning='Extrempunkter med derivatan, teckenbyte och andraderivata. '
                   + BLAD % 'Derivata – grunderna'),

    niva('ma-gy3-integraler-1', 'Primitiva funktioner', 'Integraler', [
        val_primitiv('Bestäm ∫ x⁴ dx.', INT_1, [P((F(1, 5), 5)), P((4, 3)), P((1, 5)), P((5, 5))],
                     'Höj exponenten med 1 och dela med den nya: x⁵/5. Derivera x⁵/5 så får du x⁴ tillbaka.'),
        val_primitiv('Bestäm ∫ (6x² − 4x + 3) dx.', INT_2,
                     [P((2, 3), (-2, 2), (3, 1)), P((12, 1), (-4, 0)), P((6, 3), (-4, 2), (3, 1)), P((2, 3), (-4, 2), (3, 1))],
                     'Term för term: 6x³/3 = 2x³, −4x²/2 = −2x² och 3 blir 3x.'),
        val_primitiv('Vilken är en primitiv funktion till f(x) = 8x³ − 2x?', INT_3,
                     [P((2, 4), (-1, 2)), P((24, 2), (-2, 0)), P((8, 4), (-2, 2)), P((2, 4), (-2, 2))],
                     '8x⁴/4 = 2x⁴ och −2x²/2 = −x². Pröva: derivatan av 2x⁴ − x² är 8x³ − 2x.',
                     plus_c=False, namn='F(x) = '),
        val_primitiv('Bestäm ∫ 5 dx.', INT_KONST, [P((5, 1)), P((5, 0)), P((F(5, 2), 2)), P()],
                     'Vilken funktion har derivatan 5? 5x, för dess lutning är 5 överallt.'),
        val('Bestäm f(x) om f′(x) = 4x − 3 och f(1) = 5.',
            ['f(x) = ' + pt(FP_F), 'f(x) = ' + pt(P((2, 2), (-3, 1))), 'f(x) = ' + pt(P((2, 2), (-3, 1), (5, 0))),
             'f(x) = ' + pt(P((4, 2), (-3, 1), (4, 0)))],
            'f(x) = ' + pt(FP_F),
            'f(x) = 2x² − 3x + C, och f(1) = 2 − 3 + C = 5 ger C = 6.'),
        sant('Både F(x) = x³ och G(x) = x³ + 5 är primitiva funktioner till f(x) = 3x².',
             D(P((1, 3))) == D(P((1, 3), (5, 0))) == P((3, 2)),
             'Båda har derivatan 3x², eftersom konstanten 5 försvinner. Därför skriver man + C.'),
        val('Varför skriver man + C efter en primitiv funktion?',
            ['En konstant blir 0 vid derivering, så alla F(x) + C har samma derivata',
             'C är arean under kurvan, och den måste alltid räknas med i svaret',
             'C visar att den primitiva funktionen bara gäller för positiva x'],
            'En konstant blir 0 vid derivering, så alla F(x) + C har samma derivata',
            'Det finns oändligt många primitiva funktioner, och de skiljer sig bara med en konstant.'),
        skriv('F(x) är en primitiv funktion till f(x) = 2x och F(0) = 3. Vad är F(2)?', svar(PRIM_2X),
              'F(x) = x² + C, och F(0) = 3 ger C = 3. F(2) = 4 + 3 = 7.'),
    ], beskrivning='Primitiva funktioner, konstanten C och att bestämma C ur ett villkor. '
                   + BLAD % 'Integraler – primitiva funktioner och area'),

    niva('ma-gy3-integraler-2', 'Bestämda integraler och area', 'Integraler', [
        skriv('Beräkna ∫ 3x² dx från x = 0 till x = 2.', svar(I_1),
              'En primitiv funktion är x³: 2³ − 0³ = 8.'),
        skriv('Beräkna ∫ (2x + 1) dx från x = 1 till x = 4.', svar(I_2),
              '[x² + x] från 1 till 4: (16 + 4) − (1 + 1) = 20 − 2 = 18.'),
        skriv('Beräkna ∫ 1/x² dx från x = 1 till x = 2.', svar(I_3) + ['1/2'],
              '1/x² = x⁻², med primitiv funktion −1/x: (−1/2) − (−1) = 1/2.'),
        skriv('Beräkna arean mellan kurvan y = x² + 1, x-axeln och linjerna x = 0 och x = 3. Svara i areaenheter.',
              svar(I_4),
              '[x³/3 + x] från 0 till 3 = 9 + 3 = 12. Kurvan ligger över x-axeln, så integralen är arean.'),
        bråkval('Beräkna arean mellan kurvorna y = x och y = x² mellan deras skärningspunkter.', AREA_ALT, I_5,
                'De skär varandra där x = 0 och x = 1, och där emellan ligger y = x överst: ∫ (x − x²) dx = 1/2 − 1/3 = 1/6.'),
        skriv('Beräkna ∫ 4x³ dx från x = 1 till x = 2.', svar(I_6),
              'En primitiv funktion är x⁴: 16 − 1 = 15.'),
        val('Vad betyder ∫ f(x) dx från a till b om f(x) ≥ 0 mellan a och b?',
            ['Arean mellan kurvan och x-axeln från x = a till x = b',
             'Lutningen på kurvans tangent i punkten där x = b',
             'Skillnaden mellan funktionens värden, f(b) − f(a)'],
            'Arean mellan kurvan och x-axeln från x = a till x = b',
            'Integralen är F(b) − F(a) med en primitiv funktion F, inte f(b) − f(a). När f ≥ 0 är den arean under kurvan.'),
        sant('∫ (x² − 4) dx från x = −2 till x = 2 är negativ.', I_7 < 0,
             'Mellan −2 och 2 är x² − 4 ≤ 0, så kurvan ligger under x-axeln. Integralen blir −32/3.'),
    ], beskrivning='Bestämda integraler, area under en kurva och area mellan två kurvor. '
                   + BLAD % 'Integraler – primitiva funktioner och area'),

    niva('ma-gy3-trigonometri-1', 'Radianer och enhetscirkeln', 'Trigonometriska ekvationer', [
        val('Skriv 60° i radianer.', RAD_60, enda(RAD_60, lambda a: pi_tal(a) == rad(60)),
            '180° = π, så 60° = 60/180 · π = π/3.'),
        val('Skriv 225° i radianer.', RAD_225, enda(RAD_225, lambda a: pi_tal(a) == rad(225)),
            '225/180 = 5/4, alltså 5π/4.'),
        skriv('Skriv π/6 radianer i grader.', t(F(180, 6)),
              'π motsvarar 180°, och 180° / 6 = 30°.'),
        skriv('Skriv 3π/2 radianer i grader.', t(F(3 * 180, 2)),
              '3 · 180° / 2 = 270°.'),
        val('Punkten för vinkeln v på enhetscirkeln är (a, b). Vilken koordinat är sin v?',
            ['y-koordinaten b', 'x-koordinaten a', 'Summan a + b'], 'y-koordinaten b',
            'På enhetscirkeln är punkten (cos v, sin v): sinus är höjden, alltså y-koordinaten.'),
        skriv('Vad är cos 180°?', svar(round(math.cos(math.pi))),
              'Vid 180° är punkten på enhetscirkeln (−1, 0), och cos är x-koordinaten.'),
        val('Vilket exakt värde har sin(π/6)?', [a for a, _ in SIN_PI6], '1/2',
            'π/6 är 30°, och sin 30° = 1/2.'),
        skriv('Vilken period har y = 3 sin 2x, i grader?', t(PERIOD),
              'sin 2x går ett varv när 2x har gått 360°, alltså när x har gått 180°.'),
        skriv('Vilken amplitud har y = 3 sin 2x?', t(3),
              'Amplituden är faktorn framför sin: kurvan går mellan −3 och 3.'),
    ], beskrivning='Radianer, enhetscirkeln, exakta värden, amplitud och period. '
                   + BLAD % 'Radianer och trigonometriska ekvationer'),

    niva('ma-gy3-trigonometri-2', 'Trigonometriska ekvationer', 'Trigonometriska ekvationer', [
        val_losningar('Lös sin x = 0,5 för 0° ≤ x ≤ 360°.', EKV_SIN, losningar_grader(math.sin, 0.5),
                      'arcsin 0,5 = 30°, och den andra lösningen är 180° − 30° = 150°, för sinus är y-koordinaten.'),
        val_losningar('Lös cos x = −0,5 för 0° ≤ x ≤ 360°.', EKV_COS, losningar_grader(math.cos, -0.5),
                      'arccos(−0,5) = 120°. Cosinus är symmetrisk kring x-axeln, så också 360° − 120° = 240°.'),
        val_losningar('Lös tan x = 1 för 0° ≤ x < 360°.', EKV_TAN, losningar_grader(math.tan, 1, 0, 359),
                      'arctan 1 = 45°, och tangens upprepar sig var 180°: 45° + 180° = 225°.'),
        val('Lös 2 sin x − 1 = 0 för 0 ≤ x ≤ 2π. Svara exakt i radianer.', EKV_RAD,
            ratt_rad(EKV_RAD, math.sin, 0.5, losningar_grader(math.sin, 0.5)),
            'sin x = 1/2 ger x = π/6 och x = π − π/6 = 5π/6.'),
        skriv('Lös sin x = 0,3 för 0° ≤ x ≤ 90°. Svara i grader med en decimal.', t(SIN03_A),
              'x = arcsin 0,3 ≈ 17,5°.'),
        skriv('Lös sin x = 0,3 för 90° ≤ x ≤ 180°. Svara i grader med en decimal.', t(SIN03_B),
              'Den andra lösningen är 180° − 17,46° ≈ 162,5°, för sin v = sin(180° − v).'),
        val('Lös cos x = 0,8 allmänt.', COS_ALLM, 'x ≈ ±36,9° + n · 360°',
            'arccos 0,8 ≈ 36,9°. Cosinus har samma värde för v och −v, och perioden är 360°.'),
        skriv('Hur många lösningar har sin x = 0,5 för 0° ≤ x < 720°?', t(SIN_720),
              'Två lösningar per varv (30° och 150°), och 720° är två varv: 4 lösningar.'),
        sant('Ekvationen tan x = a har lösningarna x = arctan a + n · 180°.', True,
             'Tangens har perioden 180°, så en lösning per halvt varv räcker för att beskriva alla.'),
    ], beskrivning='Trigonometriska ekvationer i grader och radianer, i ett intervall och allmänt. '
                   + BLAD % 'Radianer och trigonometriska ekvationer'),

    niva('ma-gy3-provtraning-1', 'Provträning: matematik 3c', 'Provträning', [
        val_derivata('Derivera f(x) = 3x⁴ − 2x² + x.', F_3C,
                     [P((12, 3), (-4, 1), (1, 0)), P((12, 3), (-4, 1)), P((12, 4), (-4, 2), (1, 1)), P((3, 3), (-2, 1), (1, 0))],
                     'Term för term: 12x³, −4x och x blir 1.'),
        skriv('Beräkna f′(2) om f(x) = x³ − 5x.', svar(DER_3C),
              'f′(x) = 3x² − 5, så f′(2) = 12 − 5 = 7.'),
        val_primitiv('Bestäm en primitiv funktion till g(x) = 6x² + 4.', G_3C,
                     [P((2, 3), (4, 1)), P((12, 1)), P((6, 3), (4, 1)), P((2, 3), (4, 0))],
                     '6x³/3 = 2x³ och 4 blir 4x. Pröva genom att derivera.', plus_c=False, namn='G(x) = '),
        val_lika('Förenkla (x² − 9) / (x − 3), där x ≠ 3.', KVOT, lambda x: x + 3,
                 'Konjugatregeln: x² − 9 = (x + 3)(x − 3). Faktorn x − 3 förkortas bort.', punkter=(-2, 0, 1, 5, 7)),
        val('Bestäm extrempunkterna till f(x) = x³ − 3x² och vilken sort de är.', EXT_3C, EXT_3C[0],
            'f′(x) = 3x(x − 2) = 0 ger x = 0 och x = 2. f″(0) = −6 < 0 ger max, f″(2) = 6 > 0 ger min, och f(2) = −4.'),
        skriv('Beräkna ∫ (3x² + 2x) dx från x = 0 till x = 2.', svar(INT_3C),
              '[x³ + x²] från 0 till 2 = 8 + 4 = 12.'),
        skriv('I triangeln ABC är AB = 8 cm, AC = 6 cm och vinkeln A = 60°. Beräkna BC i cm med en decimal.', t(BC),
              'Cosinussatsen: BC² = 64 + 36 − 2 · 8 · 6 · 0,5 = 52, och √52 ≈ 7,2.'),
        skriv('Av en kvadratisk skiva med sidan 30 cm görs en låda utan lock genom att lika stora kvadrater skärs bort '
              'i hörnen. Hur lång ska sidan i hörnkvadraterna vara, i cm, för att volymen ska bli så stor som möjligt?',
              t(LADA[1]),
              'V(x) = x(30 − 2x)², och V′(x) = 12(x − 5)(x − 15) = 0 ger x = 5 inom 0 < x < 15. V″(5) < 0, ett maximum.'),
        skriv('Av en kvadratisk skiva med sidan 30 cm görs en låda utan lock genom att lika stora kvadrater skärs bort '
              'i hörnen. Hur stor är den största möjliga volymen, i cm³?', t(LADA[0]),
              'Med hörnkvadrater på 5 cm blir lådan 5 cm hög och 20 cm i kvadrat: 5 · 20² = 2 000 cm³.'),
    ], beskrivning='Derivata, primitiva funktioner, rationella uttryck, integraler och optimering i provstil. '
                   + BLAD % 'Provträning: matematik 3c'),

    niva('ma-gy3-provtraning-2', 'Provträning: matematik 4', 'Provträning', [
        val('Beräkna (3 + 2i) + (1 − 5i).', [a for a, _ in KOMPLEX_1], '4 − 3i',
            'Addera realdelarna för sig och imaginärdelarna för sig: 3 + 1 = 4 och 2 − 5 = −3.'),
        val('Beräkna (2 + i)(3 − i).', [a for a, _ in KOMPLEX_2], '7 + i',
            '6 − 2i + 3i − i² = 6 + i + 1 = 7 + i, eftersom i² = −1.'),
        val_numderiv('Derivera f(x) = sin 3x.', lambda x: math.sin(3 * x), SIN3X,
                     'Kedjeregeln: derivatan av sin blir cos, och den inre derivatan 3 kommer fram: 3 cos 3x.'),
        val('Lös ekvationen z² + 4 = 0.', [a for a, _ in Z_ALT], 'z = ±2i',
            'z² = −4, och (2i)² = 4i² = −4. Också (−2i)² = −4.'),
        val_numderiv('Derivera f(x) = x · e²ˣ.', lambda x: x * math.exp(2 * x), XE2X,
                     'Produktregeln: 1 · e²ˣ + x · 2e²ˣ = e²ˣ(1 + 2x). Kedjeregeln ger faktorn 2 i 2e²ˣ.'),
        val('Lös ekvationen cos x = 0,5 för 0 ≤ x ≤ 2π. Svara exakt.', COS05,
            ratt_rad(COS05, math.cos, 0.5, losningar_grader(math.cos, 0.5)),
            'arccos 0,5 = π/3, och cosinus har samma värde för 2π − π/3 = 5π/3.'),
        val('Varför är sin²x + cos²x = 1 för alla x?',
            ['Punkten (cos x, sin x) ligger på enhetscirkeln, så Pythagoras sats ger summan 1²',
             'Sinus och cosinus är alltid lika stora, så båda kvadraterna är precis en halv',
             'Det stämmer för x = 0° och x = 90°, och därför stämmer det för alla vinklar'],
            'Punkten (cos x, sin x) ligger på enhetscirkeln, så Pythagoras sats ger summan 1²',
            'Avståndet till origo är 1, och kvadraterna tar bort tecknen, så det gäller i alla kvadranter.'),
        val('Bestäm det största värdet av f(x) = x · e⁻ˣ.', XEMX, XEMX[0],
            'f′(x) = (1 − x)e⁻ˣ = 0 ger x = 1, och f′ byter tecken från + till −. f(1) = 1/e ≈ 0,37.'),
        skriv('Beräkna i², där i är den imaginära enheten.', svar(-1),
              'i definieras så att i² = −1.'),
    ], beskrivning='Komplexa tal, kedje- och produktregeln, trigonometriska ekvationer och ett bevis i provstil. '
                   + BLAD % 'Provträning: matematik 4'),

    niva('ma-gy3-provtraning-3', 'Provträning: optimering och e', 'Provträning', [
        skriv('f(x) = x³ − 3x². Beräkna f″(2).', svar(varde(D(D(F_EXT)), 2)),
              'f′(x) = 3x² − 6x och f″(x) = 6x − 6, så f″(2) = 6.'),
        val('f(x) = x³ − 3x² har f′(0) = 0 och f″(0) = −6. Vad har funktionen där x = 0?',
            ['En maximipunkt', 'En minimipunkt', 'En terrasspunkt'], 'En maximipunkt',
            'f″ < 0 betyder att kurvan böjer nedåt, så den vågräta tangenten sitter på en topp.'),
        val('En låda utan lock görs av en kvadratisk skiva med sidan 30 cm genom att kvadrater med sidan x cm skärs bort '
            'i hörnen. Vilken definitionsmängd har volymen V(x) = x(30 − 2x)²?',
            ['0 < x < 15', '0 < x < 30', '0 < x < 5', 'x > 0'], '0 < x < 15',
            'x måste vara positivt, och 30 − 2x måste vara positivt: x < 15. Två hörn tar 2x av sidan.'),
        val_derivata('V(x) = 4x³ − 120x² + 900x. Vad är V′(x)?', V_LADA,
                     [P((12, 2), (-240, 1), (900, 0)), P((12, 2), (-120, 1), (900, 0)), P((4, 2), (-240, 1), (900, 0)),
                      P((12, 3), (-240, 2))],
                     'Term för term: 4 · 3x² = 12x², −120 · 2x = −240x och 900x blir 900.', namn='V′(x) = '),
        skriv('För vilket x har f(x) = x · e⁻ˣ sitt största värde?', svar(round(XEMX_MAX[1]), 'x'),
              'f′(x) = (1 − x)e⁻ˣ, och e⁻ˣ är aldrig 0. Därför är f′(x) = 0 bara när x = 1.'),
        val_numderiv('Derivera f(x) = e⁻ˣ.', lambda x: math.exp(-x), EMX,
                     'Kedjeregeln: den inre funktionen −x har derivatan −1, så f′(x) = −e⁻ˣ.'),
        skriv('f(x) = 5e²ˣ. Beräkna f′(0).', svar(round(E2X_0)),
              'f′(x) = 10e²ˣ, och e⁰ = 1, så f′(0) = 10.'),
        skriv('Lös ekvationen eˣ = 10. Svara med två decimaler.', svar(LN10, 'x'),
              'x = ln 10 ≈ 2,30, för ln är det tal e ska upphöjas till.'),
        val('Om f(x) = g(x) · h(x), vad är f′(x) enligt produktregeln?',
            ['g′(x) · h(x) + g(x) · h′(x)', 'g′(x) · h′(x)', 'g′(x) · h(x) − g(x) · h′(x)'],
            'g′(x) · h(x) + g(x) · h′(x)',
            'Varje faktor deriveras i tur och ordning medan den andra står kvar, och termerna adderas.'),
    ], beskrivning='Andraderivata, definitionsmängd, optimering och derivator med e. '
                   + 'Bygger på övningsbladen «Provträning: matematik 3c» och «Provträning: matematik 4» i materialbanken.'),
])


TILLAGG = [GY1, GY2]
BANOR = [GY3]
