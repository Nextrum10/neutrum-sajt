# -*- coding: utf-8 -*-
"""Fortsättning på gymnasiematten (2026-10-27). Leo: "Nexläx där ska vi lägga in
flera uppgifter, i matte svenska och engelska årkurs 6 och uppåt."

Tre nya områden i var och en av gymnasiets banor, två nivåer per område, i
TILLAGG så att de hamnar sist i banorna:

    gy1 (Matematik 1c)   Tal i grundpotensform, Trigonometri i rätvinkliga
                         trianglar, Vektorer
    gy2 (Matematik 2c)   Räta linjens ekvation, Rotekvationer, Logik och bevis
    gy3 (Matematik 3c)   Rationella uttryck, Gränsvärden och derivatans
                         definition, Triangelsatserna

Områdena är sådant banorna saknade (vektorer, rotekvationer, implikation,
ändringskvoter och derivatans definition fanns inte alls i banken) eller bara
snuddade vid i en fråga eller två. Placeringen följer Gy11:s centrala innehåll
för 1c, 2c och 3c.

Allt är Nextrums egna uppgifter, skrivna med AI och inte lästa av någon som
undervisar i ämnet. Filen står för sig och lånar inga hjälpare ur de andra
matematikfilerna: ett facit här ska inte kunna ändras av en ändring där.

Varje facit räknas ut här: bråk med Fraction, vinklar och sidor med math och
avrundade på ett ställe (avr(), som vägrar ett värde så nära en avrundningsgräns
att två rimliga räknesätt kunde ge olika svar), rationella uttryck och
gränsvärden prövade i flera punkter. De felaktiga alternativen prövas mot samma
räkning (enda()): ett fel facit lär eleven att det rätta svaret är fel, och ett
"fel" alternativ som råkar vara rätt gör samma sak.
"""
import itertools
import math
from fractions import Fraction as F

from grund import bana, niva, val, skriv, ordna, sant, para, tal


# ---------------------------------------------------------------- hjälpare

def t(x):
    """Talet som svar: decimalkomma och '-' för minus (rättningen gör om − till -)."""
    if isinstance(x, F):
        x = int(x) if x.denominator == 1 else float(x)
    return tal(x)


def m(x):
    """Talet i en text eller bland alternativen, med riktigt minustecken."""
    return t(x).replace('-', '−')


def x_svar(v, var='x'):
    """Svaret på "Vad är x?": talet, och talet skrivet som x = 5 på fyra sätt.
    Ett negativt tal också med mellanslag efter minustecknet."""
    s = t(v)
    svar = [s, '%s = %s' % (var, s), '%s=%s' % (var, s), '%s= %s' % (var, s), '%s =%s' % (var, s)]
    if s.startswith('-'):
        svar += ['- ' + s[1:], '%s = - %s' % (var, s[1:])]
    return svar


def brak_svar(x, var=None):
    """Ett bråk som svar: decimaltalet när det går jämnt ut, bråket med och utan
    mellanslag runt snedstrecket (bråk jämförs som text), och med var också
    "k = −1/2". Ett negativt svar också med mellanslag efter minustecknet."""
    x = F(x)
    assert x.denominator > 1, x
    n = x.denominator
    for p in (2, 5):
        while n % p == 0:
            n //= p
    former = ([t(x)] if n == 1 else []) + ['%d/%d' % (x.numerator, x.denominator)]
    svar = []
    for s in former:
        svar += [s, s.replace('/', ' / ')] if '/' in s else [s]
    if x < 0:
        svar += ['- ' + s[1:] for s in former]
    if var:
        svar += ['%s = %s' % (var, s) for s in former] + ['%s=%s' % (var, s) for s in former]
    svar = list(dict.fromkeys(svar))
    assert len(svar) <= 12, svar   # verktygets tak för godtagna svar
    return svar


def deriv_svar(v, punkt):
    """f′(3) = 6 skrivet med primtecknet och med en apostrof, som en elev skriver det."""
    s = t(v)
    svar = [s]
    for prim in ("′", "'"):
        svar += ['f%s(%s) = %s' % (prim, punkt, s), 'f%s(%s)=%s' % (prim, punkt, s)]
    return svar


def avr(x, d, var=None, enhet=''):
    """Ett närmevärde som svar, avrundat till d decimaler, och med en decimal
    till som också godtas. Ligger värdet nära en avrundningsgräns hade elevens
    mellanled kunnat ge ett annat svar, och då stannar bygget. Med var, när
    frågan namnger det sökta (sidan c, vinkeln v), också c = 7 och c ≈ 7, och
    med enhet c ≈ 7 cm: rättningen läser bara ett tal med enheten efter."""
    skalat = abs(x) * 10 ** d
    assert abs(skalat - math.floor(skalat) - 0.5) > 0.06, ('för nära en avrundningsgräns', x, d)
    svar = list(dict.fromkeys([t(round(x, d)), t(round(x, d + 1))]))
    if var:
        talen = list(svar)
        for s in talen:
            svar += ['%s = %s' % (var, s), '%s=%s' % (var, s), '%s ≈ %s' % (var, s)]
        if enhet:
            svar += ['%s %s %s%s' % (var, lik, talen[0], enhet) for lik in ('=', '≈')]
    assert len(svar) <= 12, svar   # verktygets tak för godtagna svar
    return svar


def dec(x, d):
    """Ett närmevärde med exakt d decimaler som text, med decimalkomma: 1,00."""
    skalat = abs(x) * 10 ** d
    assert abs(skalat - math.floor(skalat) - 0.5) > 0.06, ('för nära en avrundningsgräns', x, d)
    return ('%.*f' % (d, x)).replace('.', ',').replace('-', '−')


def tal_ur(s):
    """Talet i en text som '16,6 cm' eller '−0,5' → float."""
    return float(s.split()[0].replace('−', '-').replace(',', '.'))


def enda(alternativ, prov):
    """Det enda alternativet som klarar provet. Klarar noll eller flera det
    är frågan fel skriven, och då ska bygget stanna."""
    traffar = [a for a in alternativ if prov(a)]
    assert len(traffar) == 1, 'väntade ett rätt alternativ i %r, fick %r' % (alternativ, traffar)
    return traffar[0]


def enda_av(tabell, prov):
    """Som enda(), med alternativen som nycklar i en tabell {text: värde}."""
    return enda(list(tabell), lambda a: prov(tabell[a]))


def ordna_tal(fraga, par, forklaring, extra=None):
    """Brickor från minst till störst, ordnade ur sina värden. Två lika
    värden hade gett två rätta ordningar."""
    varden = [v for _, v in par]
    assert len(set(varden)) == len(varden), fraga
    return ordna(fraga, [text for text, _ in sorted(par, key=lambda p: p[1])], extra=extra, forklaring=forklaring)


def lika_overallt(f, g, punkter):
    """Två uttryck är samma uttryck: exakt lika i alla punkterna."""
    return all(f(F(x)) == g(F(x)) for x in punkter)


def sin(v):
    return math.sin(math.radians(v))


def cos(v):
    return math.cos(math.radians(v))


def tan(v):
    return math.tan(math.radians(v))


def asin(x):
    return math.degrees(math.asin(x))


def acos(x):
    return math.degrees(math.acos(x))


def atan(x):
    return math.degrees(math.atan(x))


# ---------------------------------------------------------------- gy1: tal i grundpotensform

UPP = str.maketrans('0123456789-', '⁰¹²³⁴⁵⁶⁷⁸⁹⁻')
NER = str.maketrans('⁰¹²³⁴⁵⁶⁷⁸⁹⁻', '0123456789-')


def gpf(a, n):
    """a · 10ⁿ som text: gpf(F('4.7'), 5) → '4,7 · 10⁵'."""
    return '%s · 10%s' % (m(F(a)), str(n).translate(UPP))


def gpf_varde(s):
    """'4,7 · 10⁵' → (4,7, 5, exakt värde)."""
    a, p = s.split(' · 10')
    a, n = F(a.replace(',', '.').replace('−', '-')), int(p.translate(NER))
    return a, n, a * F(10) ** n


def i_grundpotensform(s):
    a, _, _ = gpf_varde(s)
    return 1 <= abs(a) < 10


def som_gpf(x):
    """Ett exakt värde i grundpotensform, som text."""
    x = F(x)
    n = 0
    while abs(x) >= 10 * F(10) ** n:
        n += 1
    while abs(x) < F(10) ** n:
        n -= 1
    return gpf(x / F(10) ** n, n)


assert gpf_varde('4,7 · 10⁵')[2] == 470000 and gpf_varde('9 · 10⁻⁴')[2] == F(9, 10000)
assert som_gpf(20 * F(10) ** 8) == '2 · 10⁹' and som_gpf(F(9, 1000)) == '9 · 10⁻³'

G1_FORMER = ['47 · 10⁴', '4,7 · 10⁵', '0,47 · 10⁶', '470 · 10³']
assert all(gpf_varde(a)[2] == 470000 for a in G1_FORMER)
G1_TIOPOT = {'0,001': F(1, 1000), '0,0001': F(1, 10000), '−1 000': -1000, '−30': -30}
G1_STORT = {'3 200 000': 3200000, '320 000': 320000, '32 000 000': 32000000, '3 000 002': 3000002}
assert F('5.2') * 10 ** 4 == 52000 and F('8.6') / 10 ** 4 == F('0.00086')
G1_SMA = ['3 · 10⁻²', '5 · 10⁻³', '2 · 10⁻¹', '9 · 10⁻⁴']
assert F(10) ** -3 / F(10) ** -6 == 1000

MA_GY1_GPF_1 = niva('ma-gy1-grundpotensform-1', 'Tiopotenser och grundpotensform', 'Tal i grundpotensform', [
    skriv('Skriv 10⁴ som ett vanligt tal.', t(10 ** 4),
          '10⁴ betyder 10 · 10 · 10 · 10, alltså en etta följd av fyra nollor: 10 000.'),
    val('Vad är 10⁻³?', list(G1_TIOPOT), enda_av(G1_TIOPOT, lambda v: v == F(10) ** -3),
        'En negativ exponent betyder ett delat med potensen: 10⁻³ = 1/10³ = 1/1 000 = 0,001. '
        'Talet blir mindre än 1, men aldrig negativt.'),
    val('Vilket av talen är skrivet i grundpotensform?', G1_FORMER, enda(G1_FORMER, i_grundpotensform),
        'I grundpotensform skrivs ett tal som a · 10ⁿ, där a är minst 1 och mindre än 10. Alla fyra är lika '
        'med 470 000, men bara 4,7 ligger mellan 1 och 10.'),
    val('Skriv 3,2 · 10⁶ som ett vanligt tal.', list(G1_STORT),
        enda_av(G1_STORT, lambda v: v == F('3.2') * 10 ** 6),
        'Att multiplicera med 10⁶ är att flytta kommat sex steg åt höger. 3,2 blir 3 200 000.'),
    skriv('Talet 52 000 skrivs 5,2 · 10ⁿ i grundpotensform. Vad är n?', x_svar(4, 'n'),
          'Från 5,2 till 52 000 flyttas kommat fyra steg åt höger, och det är att multiplicera med 10⁴. '
          'Alltså är n = 4.'),
    skriv('Talet 0,00086 skrivs 8,6 · 10ⁿ i grundpotensform. Vad är n?', x_svar(-4, 'n'),
          'Från 8,6 till 0,00086 flyttas kommat fyra steg åt vänster, och det är att dela med 10⁴. Alltså är '
          'n = −4. Ett tal mellan 0 och 1 får alltid en negativ exponent.'),
    sant('Talet 0,5 · 10³ är skrivet i grundpotensform.', i_grundpotensform('0,5 · 10³'),
         'Talet framför tiopotensen ska vara minst 1 och mindre än 10, och 0,5 är mindre än 1. '
         '0,5 · 10³ = 500, och i grundpotensform är det 5 · 10².'),
    ordna_tal('Sätt talen i ordning, med det minsta först.', [(s, gpf_varde(s)[2]) for s in G1_SMA],
              'Som decimaltal är de 0,0009, 0,005, 0,03 och 0,2. När talen framför ligger mellan 1 och 10 är '
              'talet mindre ju mer negativ exponenten är.'),
    para('Para ihop prefixet med tiopotensen det betyder.',
         [('giga', '10⁹'), ('mega', '10⁶'), ('kilo', '10³'), ('milli', '10⁻³'), ('mikro', '10⁻⁶'),
          ('nano', '10⁻⁹')],
         'Prefixen går i steg om tre i exponenten. Kilo är tusen, mega en miljon och giga en miljard. Åt andra '
         'hållet är milli en tusendel, mikro en miljondel och nano en miljarddel.'),
    sant('En millimeter är tusen gånger så lång som en mikrometer.', F(10) ** -3 / F(10) ** -6 == 1000,
         '1 mm = 10⁻³ m och 1 µm = 10⁻⁶ m. Kvoten är 10⁻³ / 10⁻⁶ = 10³ = 1 000.'),
], beskrivning='Tiopotenser med positiva och negativa exponenter, tal i grundpotensform och prefixen från giga '
               'till nano.')

G2_PROD = ['6 · 10⁹', '6 · 10²⁰', '5 · 10⁹', '6 · 10¹⁰']
G2_GPF = ['2 · 10⁹', '2 · 10⁸', '9 · 10⁸', '20 · 10⁸']
assert F(8 * 10 ** 6, 2 * 10 ** 2) == 40000
assert som_gpf(F(6, 1000) * 5 * 10 ** 8) == '3 · 10⁶' and som_gpf(3 * 10 ** 8 * 500) == '1,5 · 10¹¹'
G2_BAKT = {'2 · 10⁻⁶ m': F(2, 10 ** 6), '2 · 10⁻³ m': F(2, 10 ** 3), '2 · 10⁻⁹ m': F(2, 10 ** 9),
           '2 · 10⁶ m': 2 * 10 ** 6}
JORD_MANE = 5.97e24 / 7.35e22
G2_PAR = [('(2 · 10³)²', (2 * 10 ** 3) ** 2), ('(6 · 10⁸) / (2 · 10²)', F(6 * 10 ** 8, 2 * 10 ** 2)),
          ('(5 · 10²) · (4 · 10³)', 5 * 10 ** 2 * 4 * 10 ** 3), ('(3 · 10⁻²) · (3 · 10⁵)', F(3, 100) * 3 * 10 ** 5)]
# Ett tal i grundpotensform med negativ exponent är mindre än 1, vilket a med 1 ≤ |a| < 10 det än är.
assert all(a * F(10) ** n < 1 for a in (F(1), F('9.99'), F(-5)) for n in (-1, -2, -7))

MA_GY1_GPF_2 = niva('ma-gy1-grundpotensform-2', 'Räkna med tal i grundpotensform', 'Tal i grundpotensform', [
    val('Beräkna (3 · 10⁴) · (2 · 10⁵).', G2_PROD,
        enda(G2_PROD, lambda a: gpf_varde(a)[2] == 3 * 10 ** 4 * 2 * 10 ** 5),
        'Multiplicera talen för sig och tiopotenserna för sig: 3 · 2 = 6 och 10⁴ · 10⁵ = 10⁴⁺⁵ = 10⁹. '
        'Exponenterna adderas, de multipliceras inte.'),
    val('Vilket av talen är (4 · 10⁵) · (5 · 10³) skrivet i grundpotensform?', G2_GPF,
        enda(G2_GPF, lambda a: gpf_varde(a)[2] == 4 * 10 ** 5 * 5 * 10 ** 3 and i_grundpotensform(a)),
        '4 · 5 = 20 och 10⁵ · 10³ = 10⁸, alltså 20 · 10⁸. Men 20 är inte mindre än 10. Eftersom 20 = 2 · 10¹ '
        'blir talet 2 · 10⁹ i grundpotensform.'),
    skriv('Beräkna (8 · 10⁶) / (2 · 10²). Svara som ett vanligt tal.', t(F(8 * 10 ** 6, 2 * 10 ** 2)),
          '8 / 2 = 4 och 10⁶ / 10² = 10⁶⁻² = 10⁴. Kvoten är 4 · 10⁴ = 40 000.'),
    skriv('Produkten (6 · 10⁻³) · (5 · 10⁸) skrivs 3 · 10ⁿ i grundpotensform. Vad är n?', x_svar(6, 'n'),
          '6 · 5 = 30 och 10⁻³ · 10⁸ = 10⁵, så produkten är 30 · 10⁵. Eftersom 30 = 3 · 10¹ blir det '
          '3 · 10⁶, och n = 6.'),
    skriv('Ljuset färdas ungefär 3 · 10⁸ meter per sekund. Sträckan som ljuset färdas på 500 sekunder skrivs '
          'a · 10ⁿ meter i grundpotensform. Vad är n?', x_svar(11, 'n'),
          '500 = 5 · 10². Sträckan är 3 · 10⁸ · 5 · 10² = 15 · 10¹⁰ meter, och i grundpotensform '
          '1,5 · 10¹¹ meter. Alltså är n = 11.'),
    sant('10⁵ + 10⁵ = 10¹⁰', 10 ** 5 + 10 ** 5 == 10 ** 10,
         '10⁵ + 10⁵ = 2 · 10⁵ = 200 000, men 10¹⁰ är tio miljarder. Exponenterna adderas när man multiplicerar '
         'potenser, inte när man adderar dem.'),
    val('En viss bakterie är 2 µm lång. Hur många meter är det?', list(G2_BAKT),
        enda_av(G2_BAKT, lambda v: v == 2 * F(10) ** -6),
        'Prefixet mikro, µ, betyder 10⁻⁶, en miljondel. 2 µm är alltså 2 · 10⁻⁶ m. Milli är 10⁻³ och nano '
        'är 10⁻⁹.'),
    skriv('Jordens massa är ungefär 5,97 · 10²⁴ kg och månens ungefär 7,35 · 10²² kg. Hur många gånger så stor '
          'är jordens massa som månens? Avrunda till heltal.', avr(JORD_MANE, 0),
          'Dela talen för sig och tiopotenserna för sig: 5,97 / 7,35 ≈ 0,812 och 10²⁴ / 10²² = 10². '
          'Kvoten är ungefär 0,812 · 100 ≈ 81.'),
    para('Para ihop uträkningen med svaret i grundpotensform.', [(a, som_gpf(v)) for a, v in G2_PAR],
         '(2 · 10³)² = 2² · 10⁶ = 4 · 10⁶. 6/2 = 3 och 10⁸⁻² = 10⁶. 5 · 4 = 20 och 10²⁺³ = 10⁵, så '
         '20 · 10⁵ = 2 · 10⁶. 3 · 3 = 9 och 10⁻²⁺⁵ = 10³.'),
    sant('Ett tal i grundpotensform med negativ exponent är alltid mindre än 1.', True,
         'Talet framför tiopotensen är mindre än 10, och 10⁻¹ är en tiondel. Då är a · 10⁻¹ mindre än '
         '10 · 0,1 = 1, och med en ännu mer negativ exponent blir talet ännu mindre.'),
], beskrivning='Multiplicera och dividera tal i grundpotensform, skriva svaret i grundpotensform och räkna med '
               'prefix.')

# ---------------------------------------------------------------- gy1: trigonometri i rätvinkliga trianglar

T1_KAT = {'6 cm': 6, '10,4 cm': 10.4, '24 cm': 24, '3 cm': 3}
T1_COS = {'12/13': F(12, 13), '5/13': F(5, 13), '5/12': F(5, 12), '12/5': F(12, 5)}
assert 5 ** 2 + 12 ** 2 == 13 ** 2 and 6 ** 2 + 8 ** 2 == 10 ** 2 and 3 ** 2 + 4 ** 2 == 5 ** 2
assert abs(12 * cos(30) - 10.4) < 0.05 and abs(12 / sin(30) - 24) < 1e-9
T1_UTTR = {'10 · cos 25°': 10 * cos(25), '10 · sin 25°': 10 * sin(25), '10 / cos 25°': 10 / cos(25),
           '10 · tan 25°': 10 * tan(25)}

MA_GY1_TRIG_1 = niva('ma-gy1-ratvinklig-trigonometri-1', 'Sinus, cosinus och tangens',
                     'Trigonometri i rätvinkliga trianglar', [
    para('Vinkeln v är en av de spetsiga vinklarna i en rätvinklig triangel. Para ihop kvoten med vad den är.',
         [('sin v', 'Motstående katet delat med hypotenusan'), ('cos v', 'Närliggande katet delat med hypotenusan'),
          ('tan v', 'Motstående katet delat med närliggande katet')],
         'Hypotenusan är den längsta sidan, mitt emot den räta vinkeln. Den motstående kateten står mitt emot v, '
         'och den närliggande ligger intill v.'),
    skriv('I en rätvinklig triangel är kateterna 3 cm och 4 cm och hypotenusan 5 cm. Vinkeln v står mitt emot '
          'kateten som är 3 cm. Vad är sin v? Svara som decimaltal.', brak_svar(F(3, 5)),
          'sin v är den motstående kateten delat med hypotenusan: 3/5 = 0,6.'),
    val('I en rätvinklig triangel är kateterna 5 cm och 12 cm och hypotenusan 13 cm. Vinkeln v ligger intill '
        'kateten som är 12 cm. Vad är cos v?', list(T1_COS), enda_av(T1_COS, lambda v: v == F(12, 13)),
        'cos v är den närliggande kateten delat med hypotenusan. Kateten intill v är 12 cm, så cos v = 12/13. '
        '5/13 är sin v och 5/12 är tan v.'),
    skriv('I en rätvinklig triangel är kateterna 6 cm och 8 cm och hypotenusan 10 cm. Vinkeln v står mitt emot '
          'kateten som är 6 cm. Vad är tan v? Svara som decimaltal.', brak_svar(F(6, 8)),
          'tan v är den motstående kateten delat med den närliggande: 6/8 = 0,75. Hypotenusan behövs inte.'),
    val('I en rätvinklig triangel är hypotenusan 12 cm och en av vinklarna 30°. Hur lång är kateten mitt emot '
        '30°-vinkeln?', list(T1_KAT), enda_av(T1_KAT, lambda v: abs(v - 12 * sin(30)) < 0.05),
        'sin 30° = motstående katet / hypotenusa, så kateten är 12 · sin 30° = 12 · 0,5 = 6 cm. '
        '10,4 cm är kateten intill vinkeln, 12 · cos 30°.'),
    skriv('I en rätvinklig triangel är en av vinklarna v = 40°, och kateten intill v är 20 cm. Hur lång är '
          'kateten mitt emot v? Svara i cm med en decimal.', avr(20 * tan(40), 1),
          'tan v = motstående / närliggande katet, så den motstående kateten är 20 · tan 40° ≈ 20 · 0,839 '
          '≈ 16,8 cm.'),
    skriv('I en rätvinklig triangel är hypotenusan 15 cm, och kateten intill vinkeln v är 9 cm. Hur stor är v? '
          'Svara i hela grader.', avr(acos(F(9, 15)), 0, 'v', '°'),
          'cos v = 9/15 = 0,6. Vinkeln som har cos v = 0,6 är v = cos⁻¹ 0,6 ≈ 53°.'),
    sant('I en rätvinklig triangel är sinusvärdet för var och en av de spetsiga vinklarna mindre än 1.', True,
         'sin v är en katet delat med hypotenusan, och hypotenusan är alltid den längsta sidan. Kvoten blir '
         'därför mindre än 1.'),
    sant('Om en spetsig vinkel blir dubbelt så stor blir dess sinusvärde också dubbelt så stort.',
         abs(sin(60) - 2 * sin(30)) < 1e-9,
         'sin 30° = 0,5 men sin 60° ≈ 0,87, inte 1. Sinusvärdet växer inte i takt med vinkeln.'),
    val('I en rätvinklig triangel är en av vinklarna v = 25° och hypotenusan 10 cm. Vilket uttryck ger kateten '
        'intill v?', list(T1_UTTR), enda_av(T1_UTTR, lambda v: abs(v - 10 * math.sqrt(1 - sin(25) ** 2)) < 1e-9),
        'cos v = närliggande katet / hypotenusa. Multiplicera båda leden med hypotenusan: den närliggande '
        'kateten är 10 · cos 25°.'),
], beskrivning='Sinus, cosinus och tangens i en rätvinklig triangel: ställa upp kvoterna och räkna ut en sida '
               'eller en vinkel.')

T2_DRAKE = {'28,7 m': 28.7, '41,0 m': 41.0, '35,0 m': 35.0, '61,0 m': 61.0}
assert abs(50 * cos(35) - 41.0) < 0.05 and abs(50 * tan(35) - 35.0) < 0.05 and abs(50 / cos(35) - 61.0) < 0.05
T2_HYP = {'16,6 cm': 16.6, '7,7 cm': 7.7, '3,0 cm': 3.0, '15,0 cm': 15.0}
assert abs(7 / cos(25) - 7.7) < 0.05 and abs(7 * sin(25) - 3.0) < 0.05 and abs(7 / tan(25) - 15.0) < 0.05
assert dec(5 / sin(40), 1) == '7,8'
TAN_V = [10, 30, 45, 60, 80]
FYR = {'213 m': 213, '4,2 m': 4.2, '216 m': 216, '30 m': 30}
assert abs(30 * tan(8) - 4.2) < 0.05 and abs(30 / sin(8) - 216) < 0.5

MA_GY1_TRIG_2 = niva('ma-gy1-ratvinklig-trigonometri-2', 'Sidor och vinklar i problem',
                     'Trigonometri i rätvinkliga trianglar', [
    skriv('En 6,0 m lång stege står lutad mot en vägg och når 5,4 m upp på väggen. Hur stor vinkel bildar '
          'stegen med marken? Svara i hela grader.', avr(asin(F(54, 60)), 0),
          'Stegen är hypotenusan, och höjden på väggen är kateten mitt emot vinkeln vid marken. '
          'sin v = 5,4/6,0 = 0,9, så v = sin⁻¹ 0,9 ≈ 64°.'),
    val('En drake flyger i en sträckt lina som är 50 m lång och bildar vinkeln 35° med marken. Hur högt över '
        'handen som håller linan är draken?', list(T2_DRAKE),
        enda_av(T2_DRAKE, lambda v: abs(v - 50 * sin(35)) < 0.05),
        'Linan är hypotenusan och höjden kateten mitt emot 35°-vinkeln: 50 · sin 35° ≈ 28,7 m. 41,0 m är '
        'sträckan längs marken, 50 · cos 35°.'),
    skriv('En väg stiger 12 m på en vågrät sträcka av 200 m. Hur stor är vägens lutningsvinkel? Svara i grader '
          'med en decimal.', avr(atan(F(12, 200)), 1),
          'Stigningen och den vågräta sträckan är kateterna: tan v = 12/200 = 0,06, så v = tan⁻¹ 0,06 ≈ 3,4°.'),
    val('I en rätvinklig triangel är en av vinklarna 25°, och kateten mitt emot den är 7,0 cm. Hur lång är '
        'hypotenusan?', list(T2_HYP), enda_av(T2_HYP, lambda v: abs(v - 7 / sin(25)) < 0.05),
        'sin 25° = 7,0 / hypotenusan, så hypotenusan är 7,0 / sin 25° ≈ 16,6 cm. Den måste vara längre än '
        '7,0 cm, för hypotenusan är den längsta sidan.'),
    ordna('I en rätvinklig triangel är en av vinklarna 40°, och kateten mitt emot den är 5 cm. Ordna stegen för '
          'att räkna ut hypotenusan x.',
          ['sin 40° = 5/x', 'x · sin 40° = 5', 'x = 5/sin 40°', 'x ≈ %s cm' % dec(5 / sin(40), 1)],
          forklaring='Ställ upp sinus, multiplicera båda leden med x och dela sedan båda leden med sin 40°.'),
    sant('I en rätvinklig triangel är tan v = sin v / cos v för var och en av de spetsiga vinklarna.',
         all(abs(tan(v) - sin(v) / cos(v)) < 1e-12 for v in range(1, 90)),
         'Kalla den motstående kateten a, den närliggande b och hypotenusan c. Då är '
         'sin v / cos v = (a/c) / (b/c) = a/b, och det är tan v.'),
    sant('Om man vet längden av två av sidorna i en rätvinklig triangel kan man räkna ut båda de spetsiga '
         'vinklarna.', True,
         'Två sidor ger en kvot, sin, cos eller tan, och ur den får man den ena vinkeln. Den andra är 90° minus '
         'den första, för vinkelsumman är 180°.'),
    para('Para ihop vinkeln v med tan v, avrundat till två decimaler.', [('%d°' % v, dec(tan(v), 2)) for v in TAN_V],
         'tan v är den motstående kateten delat med den närliggande. När v närmar sig 90° blir den motstående '
         'kateten mycket längre än den närliggande, och tan v växer utan gräns.'),
    skriv('Kateterna i en rätvinklig triangel är 9 cm och 12 cm. Hur stor är den minsta vinkeln i triangeln? '
          'Svara i grader med en decimal.', avr(atan(F(9, 12)), 1),
          'Den minsta vinkeln står mitt emot den kortaste sidan, kateten som är 9 cm. tan v = 9/12 = 0,75, '
          'så v ≈ 36,9°.'),
    val('Från toppen av en 30 m hög fyr ser man en båt. Siktlinjen ner till båten bildar vinkeln 8° med den '
        'vågräta linjen. Ungefär hur långt är det från fyrens fot till båten?', list(FYR),
        enda_av(FYR, lambda v: abs(v - 30 / tan(8)) < 1),
        'Vinkeln ner mot båten är lika stor som vinkeln upp mot fyrens topp, sett från båten. Höjden 30 m är '
        'kateten mitt emot vinkeln och avståndet x kateten intill: tan 8° = 30/x, så x = 30/tan 8° ≈ 213 m.'),
], beskrivning='Räkna ut sidor och vinklar i problem med stegar, vägar och höjder, och välja rätt kvot.')

# ---------------------------------------------------------------- gy1: vektorer


def vek(s):
    """'(5, −3)' → (5, −3) som bråk."""
    x, y = s.strip('()').replace('−', '-').split(',')
    return F(x.replace(',', '.')), F(y)


def vtext(v):
    return '(%s, %s)' % (m(v[0]), m(v[1]))


def plus(u, v):
    return (u[0] + v[0], u[1] + v[1])


def gange(k, u):
    return (k * u[0], k * u[1])


def langd(u):
    return math.hypot(u[0], u[1])


V1_SUM = ['(5, 5)', '(1, −3)', '(6, 4)', '(5, 3)']
V1_DIFF = ['(4, −4)', '(−4, 4)', '(6, 8)', '(4, 4)']
V1_SKAL = ['(6, −9)', '(5, 0)', '(6, −3)', '(2, −9)']
V1_LANGD = ['(3, 4)', '(5, 12)', '(0, −7)', '(−8, 15)']
assert all(langd(vek(s)) == int(langd(vek(s))) for s in V1_LANGD)
V1_ORDNA = ['(1, 1)', '(2, 0)', '(1, 2)', '(3, −1)']

MA_GY1_VEKTOR_1 = niva('ma-gy1-vektorer-1', 'Vektorer i koordinatform', 'Vektorer', [
    sant('En vektor har både en storlek och en riktning.', True,
         'Det är det som skiljer en vektor från ett vanligt tal. En hastighet på 5 m/s rakt norrut är en vektor, '
         'men en temperatur har bara en storlek.'),
    val('Vektorerna är u = (3, 1) och v = (2, 4). Vad är u + v?', V1_SUM,
        enda(V1_SUM, lambda a: vek(a) == plus((3, 1), (2, 4))),
        'Addera x-koordinaterna för sig och y-koordinaterna för sig: (3 + 2, 1 + 4) = (5, 5).'),
    val('Vektorerna är u = (5, 2) och v = (1, 6). Vad är u − v?', V1_DIFF,
        enda(V1_DIFF, lambda a: vek(a) == plus((5, 2), gange(-1, (1, 6)))),
        'Subtrahera koordinat för koordinat: (5 − 1, 2 − 6) = (4, −4). Vektorn (−4, 4) är v − u, som pekar åt '
        'motsatt håll.'),
    skriv('Hur lång är vektorn (6, 8)?', t(int(langd((6, 8)))),
          'Längden räknas med Pythagoras sats: √(6² + 8²) = √(36 + 64) = √100 = 10.'),
    val('Vektorn är u = (2, −3). Vad är 3u?', V1_SKAL, enda(V1_SKAL, lambda a: vek(a) == gange(3, (2, -3))),
        'Multiplicera båda koordinaterna med 3: (3 · 2, 3 · (−3)) = (6, −9). Vektorn 3u pekar åt samma håll '
        'som u och är tre gånger så lång.'),
    skriv('Punkterna är A = (1, 2) och B = (4, 7). Vektorn AB, från A till B, har koordinaterna (x, y). '
          'Vad är y?', x_svar(7 - 2, 'y'),
          'Vektorn från A till B är slutpunkten minus startpunkten: (4 − 1, 7 − 2) = (3, 5). Alltså är y = 5.'),
    sant('Vektorerna (2, 3) och (4, 6) är parallella.', gange(2, (2, 3)) == (4, 6),
         '(4, 6) = 2 · (2, 3). Den ena är ett tal gånger den andra, så de pekar åt samma håll.'),
    sant('Vektorerna (1, 2) och (2, 1) är lika.', (1, 2) == (2, 1),
         'Två vektorer är lika när båda koordinaterna är lika. (1, 2) och (2, 1) har samma längd, √5, men pekar '
         'åt olika håll.'),
    para('Para ihop vektorn med dess längd.', [(s, t(int(langd(vek(s))))) for s in V1_LANGD],
         'Längden av (a, b) är √(a² + b²): √25 = 5, √169 = 13, √49 = 7 och √289 = 17. Ett minustecken ändrar '
         'riktningen men inte längden.'),
    ordna_tal('Sätt vektorerna i ordning efter längd, med den kortaste först.',
              [(s, langd(vek(s))) for s in V1_ORDNA],
              'Längderna är √2 ≈ 1,41, √4 = 2, √5 ≈ 2,24 och √10 ≈ 3,16.'),
], beskrivning='Vektorer i koordinatform: addera, subtrahera, multiplicera med ett tal och räkna ut längden.')

V2_A = ['(5, 3)', '(4, 1)', '(5, 1)', '(8, 2)']
V2_B = ['(8, −5)', '(2, 4)', '(6, −2)', '(0, 7)']
V2_D = ['(7, 9)', '(1, 5)', '(9, 10)', '(7, 4)']
A_, B_, C_ = (2, 1), (5, 3), (4, 7)
assert langd(plus((1, 5), (2, -1))) == 5 and langd((4, 3)) == 5
assert [k for k in range(-10, 11) if k * 3 == 6 * 2] == [4]        # (k, 6) = s · (2, 3) ger s = 2
assert [s for s in range(1, 10) if 9 + s * s == 25] == [4]
assert langd((1, 0)) + langd((0, 1)) != langd((1, 1))
assert all(abs(langd(gange(2, u)) - 2 * langd(u)) < 1e-12 for u in ((3, 4), (-2, 7), (0.5, -1)))

MA_GY1_VEKTOR_2 = niva('ma-gy1-vektorer-2', 'Räkna med vektorer', 'Vektorer', [
    val('Vektorerna är u = (1, 2) och v = (3, −1). Vad är 2u + v?', V2_A,
        enda(V2_A, lambda a: vek(a) == plus(gange(2, (1, 2)), (3, -1))),
        '2u = (2, 4), och 2u + v = (2 + 3, 4 − 1) = (5, 3). (4, 1) är u + v, och (8, 2) är 2(u + v).'),
    val('Vektorerna är u = (4, 1) och v = (−2, 3). Vad är u − 2v?', V2_B,
        enda(V2_B, lambda a: vek(a) == plus((4, 1), gange(-2, (-2, 3)))),
        '2v = (−4, 6), och u − 2v = (4 − (−4), 1 − 6) = (8, −5).'),
    skriv('Vektorerna är u = (1, 5) och v = (2, −1). Hur lång är vektorn u + v?', t(int(langd(plus((1, 5), (2, -1))))),
          'u + v = (1 + 2, 5 − 1) = (3, 4), och längden är √(3² + 4²) = √25 = 5.'),
    skriv('Vektorn (k, 6) är parallell med vektorn (2, 3). Vad är k?', x_svar(4, 'k'),
          'Parallella vektorer är multiplar av varandra. y-koordinaten 6 är 2 · 3, så hela vektorn är 2 · (2, 3) '
          '= (4, 6). Alltså är k = 4.'),
    skriv('En båt kör 4 m/s rakt österut i förhållande till vattnet, och strömmen för vattnet 3 m/s rakt '
          'norrut. Hur stor är båtens fart i förhållande till land? Svara i m/s.', t(int(langd((4, 3)))),
          'Hastigheterna adderas som vektorer: (4, 3). Farten är längden, √(4² + 3²) = √25 = 5 m/s.'),
    val('Punkterna är A = (2, 1), B = (5, 3) och C = (4, 7). Vilken punkt D gör att vektorn CD är lika med '
        'vektorn AB?', V2_D, enda(V2_D, lambda a: plus(vek(a), gange(-1, C_)) == plus(B_, gange(-1, A_))),
        'Vektorn AB är (5 − 2, 3 − 1) = (3, 2). Från C går man samma steg: D = (4 + 3, 7 + 2) = (7, 9).'),
    sant('|u + v| = |u| + |v| för alla vektorer u och v.', False,
         'Med u = (1, 0) och v = (0, 1) är u + v = (1, 1), som har längden √2 ≈ 1,41, men |u| + |v| = 2. '
         'Likheten gäller bara när vektorerna pekar åt samma håll eller den ena är nollvektorn.'),
    sant('Vektorn 2u är dubbelt så lång som vektorn u, vilken vektor u än är.', True,
         'Om u = (a, b) är 2u = (2a, 2b), och |2u| = √(4a² + 4b²) = 2√(a² + b²) = 2|u|.'),
    skriv('Vektorn u = (3, t) har längden 5, och t är positivt. Vad är t?', x_svar(4, 't'),
          'Längden är √(3² + t²) = 5, så 9 + t² = 25 och t² = 16. Det positiva t är 4.'),
    ordna('Ordna stegen för att räkna ut längden av vektorn AB, när A = (1, 1) och B = (7, 9).',
          ['AB = (7 − 1, 9 − 1)', 'AB = (6, 8)', '|AB| = √(6² + 8²)', '|AB| = √100 = 10'],
          forklaring='Vektorn från A till B är B minus A. Längden räknas sedan med Pythagoras sats.'),
], beskrivning='Räkna med flera vektorer, parallella vektorer, längder och vektorer mellan punkter.')

# ---------------------------------------------------------------- gy2: räta linjens ekvation


def pa_linjen(a, b, c):
    """Linjen ax + by + c = 0 som ett prov på en punkt."""
    return lambda x, y: a * x + b * y + c == 0


def samma_linje(prov, k, m_, xs=range(-4, 5)):
    """Alla punkter på y = kx + m klarar provet, och en punkt bredvid gör det inte."""
    return all(prov(F(x), k * F(x) + m_) for x in xs) and not prov(F(0), m_ + 1)


L1_ALLM = {'2x − y − 3 = 0': pa_linjen(2, -1, -3), '2x + y − 3 = 0': pa_linjen(2, 1, -3),
           '2x − y + 3 = 0': pa_linjen(2, -1, 3), 'x − 2y − 3 = 0': pa_linjen(1, -2, -3)}
L1_ENP = {'y − 5 = 3(x − 2)': lambda x: 3 * (x - 2) + 5, 'y − 2 = 3(x − 5)': lambda x: 3 * (x - 5) + 2,
          'y + 5 = 3(x + 2)': lambda x: 3 * (x + 2) - 5, 'y − 5 = 2(x − 3)': lambda x: 2 * (x - 3) + 5}
L1_LUT = [('y = 5 − 2x', (2, 1, -5)), ('4x − 2y = 6', (4, -2, -6)), ('x + 2y = 8', (1, 2, -8)), ('y = 7', (0, 1, -7))]
L1_PUNKT = ['(6, 4)', '(4, 6)', '(3, 1)', '(0, 4)']


def lutning(a, b, c):
    return F(-a, b)

# 2x + y − 5 = 0 är y = 5 − 2x, och de fyra lutningarna ska vara olika.
assert [lutning(*abc) for _, abc in L1_LUT] == [-2, 2, F(-1, 2), 0]


assert lutning(2, 1, -5) == -2 and F(5, 1) == 5   # 2x + y − 5 = 0 ger y = −2x + 5
assert F(-12, -4) == 3 and F(10, 5) == 2            # 3x − 4y − 12 = 0 skär x-axeln i 4, 2x + 5y − 10 = 0 y-axeln i 2
assert lutning(6, -2, 5) == 3 and F(5, 2) != 1      # 6x − 2y + 5 = 0 är y = 3x + 2,5

MA_GY2_LINJE_1 = niva('ma-gy2-rata-linjen-1', 'k-form, enpunktsform och allmän form', 'Räta linjens ekvation', [
    skriv('Linjen 2x + y − 5 = 0 skrivs på formen y = kx + m. Vad är k?', x_svar(lutning(2, 1, -5), 'k'),
          'Lös ut y: y = −2x + 5. Talet framför x är lutningen, k = −2.'),
    skriv('Linjen 3x − y + 4 = 0 skrivs på formen y = kx + m. Vad är m?', x_svar(4, 'm'),
          'Flytta över y till högerledet: y = 3x + 4. Alltså är m = 4, och där skär linjen y-axeln.'),
    val('Vilken ekvation på allmän form beskriver samma linje som y = 2x − 3?', list(L1_ALLM),
        enda_av(L1_ALLM, lambda p: samma_linje(p, 2, -3)),
        'Flytta över allt till ena ledet: 2x − y − 3 = 0. Kontrollera med en punkt: x = 0 ger y = −3 i båda '
        'formerna.'),
    val('Vilken ekvation beskriver linjen som har lutningen 3 och går genom punkten (2, 5)?', list(L1_ENP),
        enda_av(L1_ENP, lambda f: f(2) == 5 and f(3) - f(2) == 3),
        'Enpunktsformen y − y₁ = k(x − x₁) är linjen med lutningen k genom punkten (x₁, y₁). Med k = 3 och '
        'punkten (2, 5) blir det y − 5 = 3(x − 2).'),
    sant('Linjen x = 4 är lodrät och kan inte skrivas på formen y = kx + m.', True,
         'Alla punkter på linjen har x = 4, vilket y-värde de än har. En lodrät linje har ingen lutning k, men '
         'den går att skriva på allmän form: x − 4 = 0.'),
    skriv('I vilken punkt skär linjen 2x + 5y − 10 = 0 y-axeln? Svara med y-värdet.', x_svar(F(10, 5), 'y'),
          'På y-axeln är x = 0. Då är 5y − 10 = 0, så y = 2.'),
    skriv('I vilken punkt skär linjen 3x − 4y − 12 = 0 x-axeln? Svara med x-värdet.', x_svar(F(12, 3)),
          'På x-axeln är y = 0. Då är 3x − 12 = 0, så x = 4.'),
    para('Para ihop linjen med dess lutning k.', [(e, m(lutning(*abc))) for e, abc in L1_LUT],
         'Lös ut y i varje ekvation. 4x − 2y = 6 ger y = 2x − 3, och x + 2y = 8 ger y = −0,5x + 4. Linjen y = 7 '
         'är vågrät och har k = 0.'),
    sant('Linjerna y = 3x + 1 och 6x − 2y + 5 = 0 är parallella.', lutning(6, -2, 5) == 3,
         'Lös ut y ur den andra: 2y = 6x + 5, alltså y = 3x + 2,5. Båda har k = 3 men olika m, så de är '
         'parallella och skär aldrig varandra.'),
    val('Vilken av punkterna ligger på linjen 4x − 3y = 12?', L1_PUNKT,
        enda(L1_PUNKT, lambda s: pa_linjen(4, -3, -12)(*vek(s))),
        'Sätt in punkten i ekvationen. För (6, 4) blir det 4 · 6 − 3 · 4 = 24 − 12 = 12, och det stämmer. För '
        '(4, 6) blir det 16 − 18 = −2.'),
], beskrivning='Räta linjens ekvation på k-form, enpunktsform och allmän form, och var linjen skär axlarna.')

L2_VINK = {'y = x/3 − 2': F(1, 3), 'y = 3x − 2': F(3), 'y = −x/3 + 1': F(-1, 3), 'y = −3x + 1': F(-3)}
L2_PAR = {'y = 2x + 2': (2, 2), 'y = −2x + 2': (-2, 2), 'y = x/2 + 2': (F(1, 2), 2), 'y = 2x + 7': (2, 7)}
L2_TVA = {'3x − y − 1 = 0': pa_linjen(3, -1, -1), '3x + y − 5 = 0': pa_linjen(3, 1, -5),
          'x − 3y + 5 = 0': pa_linjen(1, -3, 5), '3x − y + 1 = 0': pa_linjen(3, -1, 1)}
K_L = F(-1, 2)                                    # vinkelrät mot y = 2x − 5
assert 2 * K_L == -1 and 1 - K_L * 4 == 3          # genom (4, 1): m = 3
assert 4 * F(-1, 4) == -1                          # y = ax + 1 vinkelrät mot y = 4x − 3
assert lutning(-6, 2, -6) == 3 and F(6, 2) != 1    # ax + 2y = 6 med a = −6 är y = 3x + 3
assert 2 * -2 != -1
assert 3 == F(-1, 2) * 2 + 4                       # (2, 3) på y = −x/2 + 4

MA_GY2_LINJE_2 = niva('ma-gy2-rata-linjen-2', 'Parallella och vinkelräta linjer', 'Räta linjens ekvation', [
    sant('Två linjer med lutningarna k₁ och k₂ är vinkelräta om k₁ · k₂ = −1.', True,
         'Ett exempel: y = 2x och y = −0,5x. 2 · (−0,5) = −1, och linjerna möts i rät vinkel. Regeln gäller '
         'linjer som inte är lodräta.'),
    skriv('En linje är vinkelrät mot linjen y = 2x + 1. Vilken lutning har den? Svara som decimaltal eller '
          'bråk.', brak_svar(F(-1, 2), 'k'),
          'k₁ · k₂ = −1 ger 2 · k₂ = −1, alltså k₂ = −1/2 = −0,5.'),
    val('Vilken av linjerna är vinkelrät mot y = −3x + 4?', list(L2_VINK), enda_av(L2_VINK, lambda k: k * -3 == -1),
        'Den vinkelräta lutningen k uppfyller −3 · k = −1, alltså k = 1/3. Linjen y = x/3 − 2 har k = 1/3. '
        'Linjen y = −3x + 1 är parallell med den givna.'),
    val('Vilken linje går genom punkten (0, 2) och är parallell med linjen 2x − y + 7 = 0?', list(L2_PAR),
        enda_av(L2_PAR, lambda km: km[0] == lutning(2, -1, 7) and km[1] == 2),
        'Den givna linjen är y = 2x + 7 med k = 2. Den parallella linjen har också k = 2, och genom (0, 2) är '
        'm = 2: y = 2x + 2. Linjen y = 2x + 7 är den givna linjen själv.'),
    skriv('Linjen L går genom punkten (4, 1) och är vinkelrät mot linjen y = 2x − 5. L skrivs y = kx + m. '
          'Vad är m?', x_svar(1 - K_L * 4, 'm'),
          'L har lutningen −1/2, för 2 · (−1/2) = −1. Sätt in (4, 1): 1 = −1/2 · 4 + m = −2 + m, så m = 3.'),
    skriv('För vilket värde på a är linjerna y = ax + 1 och y = 4x − 3 vinkelräta? Svara som decimaltal eller '
          'bråk.', brak_svar(F(-1, 4), 'a'),
          'Vinkelräta linjer har a · 4 = −1, alltså a = −1/4 = −0,25.'),
    skriv('För vilket värde på a är linjerna ax + 2y = 6 och y = 3x + 1 parallella?', x_svar(-6, 'a'),
          'Lös ut y: 2y = −ax + 6, så y = −(a/2)x + 3. Parallella linjer har samma lutning: −a/2 = 3, alltså '
          'a = −6.'),
    val('Vilken ekvation har linjen som går genom punkterna (1, 2) och (3, 8)?', list(L2_TVA),
        enda_av(L2_TVA, lambda p: p(1, 2) and p(3, 8)),
        'k = (8 − 2)/(3 − 1) = 3 och m = 2 − 3 · 1 = −1, så y = 3x − 1. Med allt i ena ledet blir det '
        '3x − y − 1 = 0.'),
    sant('Linjerna y = 2x och y = −2x är vinkelräta.', 2 * -2 == -1,
         'Produkten av lutningarna är 2 · (−2) = −4, inte −1. Linjerna är varandras spegelbilder i y-axeln, men '
         'de möts inte i rät vinkel.'),
    ordna('Ordna stegen för att ta fram linjen som går genom punkten (2, 3) och är vinkelrät mot y = 2x + 1.',
          ['Den givna linjen har k₁ = 2', 'Den nya linjen har k₂ = −1/2, för k₁ · k₂ = −1',
           'Sätt in (2, 3): 3 = −1/2 · 2 + m', 'm = 4, så linjen är y = −x/2 + 4'],
          forklaring='Först lutningen, sedan m ur punkten. Kontrollera: −2/2 + 4 = 3.'),
], beskrivning='Parallella och vinkelräta linjer, och linjen genom två punkter på allmän form.')

# ---------------------------------------------------------------- gy2: rotekvationer


def rotens_losningar(radikand, hoger, kandidater):
    """Kandidaterna som verkligen löser √(radikand(x)) = hoger(x)."""
    ut = []
    for x in kandidater:
        x = F(x)
        r = radikand(x)
        if r >= 0 and hoger(x) >= 0 and hoger(x) ** 2 == r:
            ut.append(x)
    return ut


def andragrad(a, b, c):
    """Heltalsrötterna till ax² + bx + c = 0, exakt."""
    d = b * b - 4 * a * c
    rot = math.isqrt(d)
    assert rot * rot == d, (a, b, c)
    return sorted({F(-b + rot, 2 * a), F(-b - rot, 2 * a)})


R1_TRE = {'x = 5': 5, 'x = 2': 2, 'x = 4': 4, 'x = 4,5': F(9, 2)}
R1_FEM = {'20': 20, '2': 2, '50': 50, '100': 100}
assert rotens_losningar(lambda x: x, lambda x: F(7), [49]) == [49]
assert rotens_losningar(lambda x: x + 3, lambda x: F(5), [22]) == [22]
assert rotens_losningar(lambda x: x, lambda x: F(5), [25]) == [25]            # 2√x = 10
assert rotens_losningar(lambda x: x, lambda x: F(6), [36]) == [36]            # √x + 4 = 10
assert rotens_losningar(lambda x: x, lambda x: F(-3), [9]) == []              # √x = −3
assert rotens_losningar(lambda x: x - 2, lambda x: F(4), [18]) == [18]
assert rotens_losningar(lambda x: x + 6, lambda x: F(3), [3]) == [3]

MA_GY2_ROT_1 = niva('ma-gy2-rotekvationer-1', 'Kvadrera och pröva', 'Rotekvationer', [
    skriv('Lös ekvationen √x = 7.', x_svar(7 ** 2),
          'Kvadrera båda leden: x = 7² = 49. Pröva: √49 = 7.'),
    skriv('Lös ekvationen √(x + 3) = 5.', x_svar(5 ** 2 - 3),
          'Kvadrera båda leden: x + 3 = 25, så x = 22. Pröva: √(22 + 3) = √25 = 5.'),
    val('Lös ekvationen √(2x − 1) = 3.', list(R1_TRE),
        enda_av(R1_TRE, lambda x: rotens_losningar(lambda z: 2 * z - 1, lambda z: F(3), [x]) == [x]),
        'Kvadrera båda leden: 2x − 1 = 9, så 2x = 10 och x = 5. Pröva: √(10 − 1) = √9 = 3. Den som glömmer '
        'att kvadrera trean får x = 2.'),
    skriv('Lös ekvationen 2√x = 10.', x_svar(F(10, 2) ** 2),
          'Dela först båda leden med 2: √x = 5. Kvadrera sedan: x = 25. Pröva: 2 · √25 = 2 · 5 = 10.'),
    skriv('Lös ekvationen √x + 4 = 10.', x_svar((10 - 4) ** 2),
          'Få roten ensam först: √x = 6. Kvadrera sedan: x = 36. Kvadrerar man √x + 4 direkt blir det inte '
          'x + 16, för (√x + 4)² = x + 8√x + 16.'),
    sant('Ekvationen √x = −3 saknar reella lösningar.', rotens_losningar(lambda x: x, lambda x: F(-3), [9]) == [],
         'Kvadratroten √x är aldrig negativ. Kvadrerar man får man x = 9, men √9 = 3 och inte −3, så x = 9 är '
         'en falsk rot.'),
    val('Hur blir man av med rottecknet i ekvationen √(x − 2) = 4?',
        ['Kvadrera båda leden', 'Dra roten ur båda leden', 'Dela båda leden med 2', 'Multiplicera båda leden med x'],
        'Kvadrera båda leden',
        'Att kvadrera tar bort rottecknet: (√(x − 2))² = x − 2. Ekvationen blir x − 2 = 16, och x = 18. '
        'Pröva: √16 = 4.'),
    sant('När man kvadrerar båda leden i en ekvation kan man få en lösning som inte stämmer i den ursprungliga '
         'ekvationen.', True,
         'Både 3 och −3 blir 9 i kvadrat, så kvadreringen kan inte skilja dem åt. Därför prövar man varje '
         'lösning i den ursprungliga ekvationen.'),
    ordna('Ordna stegen för att lösa ekvationen √(x + 6) = 3.',
          ['(√(x + 6))² = 3²', 'x + 6 = 9', 'x = 3', 'Pröva: √(3 + 6) = √9 = 3'],
          forklaring='Kvadrera båda leden, lös den nya ekvationen och pröva till sist lösningen.'),
    val('Vilket tal löser ekvationen √(5x) = 10?', list(R1_FEM),
        enda_av(R1_FEM, lambda x: rotens_losningar(lambda z: 5 * z, lambda z: F(10), [x]) == [x]),
        'Kvadrera båda leden: 5x = 100, så x = 20. Pröva: √(5 · 20) = √100 = 10.'),
], beskrivning='Lösa rotekvationer genom att få roten ensam, kvadrera båda leden och pröva lösningen.')

# Kvadreringen ger en andragradsekvation, och rötterna prövas i den ursprungliga.
R2_1 = andragrad(1, -1, -6)                               # √(x + 6) = x  →  x² − x − 6 = 0
assert R2_1 == [-2, 3] and rotens_losningar(lambda x: x + 6, lambda x: x, R2_1) == [3]
R2_2 = andragrad(1, -1, -2)                               # √(x + 2) = x  →  x² − x − 2 = 0
assert R2_2 == [-1, 2] and rotens_losningar(lambda x: x + 2, lambda x: x, R2_2) == [2]
R2_2_ALT = {'Bara x = 2': [2], 'Bara x = −1': [-1], 'Både x = 2 och x = −1': [-1, 2], 'Ingen av dem': []}
R2_3 = andragrad(1, -3, -4)                               # x − 1 = √(x + 5)  →  x² − 3x − 4 = 0
assert R2_3 == [-1, 4] and rotens_losningar(lambda x: x + 5, lambda x: x - 1, R2_3) == [4]
R2_4 = andragrad(1, 1, -6)                                # √(x + 7) = x + 1  →  x² + x − 6 = 0
assert R2_4 == [-3, 2] and rotens_losningar(lambda x: x + 7, lambda x: x + 1, R2_4) == [2]
R2_5 = andragrad(1, -11, 24)                              # √(x + 1) = x − 5  →  x² − 11x + 24 = 0
assert R2_5 == [3, 8] and rotens_losningar(lambda x: x + 1, lambda x: x - 5, R2_5) == [8]
R2_5_ALT = {'Ingen': 0, 'En': 1, 'Två': 2, 'Oändligt många': math.inf}
assert rotens_losningar(lambda x: x + 3, lambda x: x + 1, [1]) == [1]
R2_8 = andragrad(1, -5, 4)                                # √x = x − 2  →  x² − 5x + 4 = 0
assert R2_8 == [1, 4] and rotens_losningar(lambda x: x, lambda x: x - 2, R2_8) == [4]
R2_10 = andragrad(1, -4, -5)                              # √(4x + 5) = x  →  x² − 4x − 5 = 0
assert R2_10 == [-1, 5] and rotens_losningar(lambda x: 4 * x + 5, lambda x: x, R2_10) == [5]
assert 3 * 4 + 1 == 4 + 9

MA_GY2_ROT_2 = niva('ma-gy2-rotekvationer-2', 'Falska rötter', 'Rotekvationer', [
    skriv('Lös ekvationen √(x + 6) = x.', x_svar(rotens_losningar(lambda x: x + 6, lambda x: x, R2_1)[0]),
          'Kvadrera: x + 6 = x², alltså x² − x − 6 = 0 med lösningarna x = 3 och x = −2. Pröva: √9 = 3 '
          'stämmer, men √4 = 2 är inte −2. Bara x = 3 löser ekvationen.'),
    val('Ekvationen √(x + 2) = x ger efter kvadrering x² − x − 2 = 0, med lösningarna x = 2 och x = −1. '
        'Vilka av dem löser den ursprungliga ekvationen?', list(R2_2_ALT),
        enda_av(R2_2_ALT, lambda v: v == rotens_losningar(lambda x: x + 2, lambda x: x, R2_2)),
        'Pröva båda: √(2 + 2) = 2 stämmer. √(−1 + 2) = √1 = 1, men högerledet är −1. Alltså är x = −1 en '
        'falsk rot, och bara x = 2 är en lösning.'),
    skriv('Lös ekvationen x − 1 = √(x + 5).', x_svar(rotens_losningar(lambda x: x + 5, lambda x: x - 1, R2_3)[0]),
          'Kvadrera: x² − 2x + 1 = x + 5, alltså x² − 3x − 4 = 0 med x = 4 och x = −1. Pröva: 4 − 1 = 3 = √9 '
          'stämmer, men −1 − 1 = −2 medan √4 = 2. Svaret är x = 4.'),
    skriv('Lös ekvationen √(x + 7) = x + 1.', x_svar(rotens_losningar(lambda x: x + 7, lambda x: x + 1, R2_4)[0]),
          'Kvadrera: x + 7 = x² + 2x + 1, alltså x² + x − 6 = 0 med x = 2 och x = −3. Pröva: √9 = 3 = 2 + 1 '
          'stämmer, men √4 = 2 medan −3 + 1 = −2. Svaret är x = 2.'),
    val('Hur många lösningar har ekvationen √(x + 1) = x − 5?', list(R2_5_ALT),
        enda_av(R2_5_ALT, lambda n: n == len(rotens_losningar(lambda x: x + 1, lambda x: x - 5, R2_5))),
        'Kvadrera: x + 1 = x² − 10x + 25, alltså x² − 11x + 24 = 0 med x = 3 och x = 8. Pröva: √4 = 2 men '
        '3 − 5 = −2, så x = 3 är falsk. √9 = 3 = 8 − 5 stämmer. Det finns en lösning, x = 8.'),
    skriv('Lös ekvationen √(3x + 1) = √(x + 9).', x_svar(F(9 - 1, 3 - 1)),
          'Kvadrera båda leden: 3x + 1 = x + 9, så 2x = 8 och x = 4. Pröva: √13 = √13.'),
    sant('x = 1 är en lösning till ekvationen √(x + 3) = x + 1.',
         rotens_losningar(lambda x: x + 3, lambda x: x + 1, [1]) == [1],
         'Sätt in x = 1: vänsterledet är √4 = 2 och högerledet 1 + 1 = 2. Leden är lika.'),
    sant('Ekvationen √x = x − 2 har två lösningar, x = 1 och x = 4.',
         rotens_losningar(lambda x: x, lambda x: x - 2, R2_8) == [1, 4],
         'Kvadrering ger x = x² − 4x + 4, alltså x² − 5x + 4 = 0 med x = 1 och x = 4. Men √1 = 1 medan '
         '1 − 2 = −1, så x = 1 är en falsk rot. Bara x = 4 löser ekvationen.'),
    val('Varför måste man pröva lösningarna när man har löst en rotekvation genom att kvadrera?',
        ['Kvadreringen kan ge falska rötter', 'Kvadratroten ur ett tal har alltid två värden',
         'Pq-formeln ger alltid en lösning för mycket', 'En rotekvation har alltid exakt en lösning'],
        'Kvadreringen kan ge falska rötter',
        'Två tal med olika tecken har samma kvadrat, så den kvadrerade ekvationen kan ha lösningar som inte '
        'stämmer i den ursprungliga. Kvadratroten √a är ett enda tal, det som inte är negativt.'),
    ordna('Ordna stegen för att lösa ekvationen √(4x + 5) = x.',
          ['Kvadrera: 4x + 5 = x²', 'Skriv om: x² − 4x − 5 = 0', 'Pq-formeln: x = 5 eller x = −1',
           'Pröva: bara x = 5 stämmer'],
          forklaring='√25 = 5 stämmer. För x = −1 är vänsterledet √1 = 1 men högerledet −1, så den roten är falsk.'),
], beskrivning='Rotekvationer som leder till andragradsekvationer, och att stryka de falska rötterna.')

# ---------------------------------------------------------------- gy2: logik och bevis

PROV_X = [F(n, 2) for n in range(-16, 17)]                 # −8 till 8 i halva steg


def medfor(p, q):
    """p ⇒ q på provpunkterna: ingen punkt där p är sant och q falskt."""
    return all(q(x) for x in PROV_X if p(x))


def primtal(n):
    return n >= 2 and all(n % d for d in range(2, math.isqrt(n) + 1))


P_X3, P_X2_9 = (lambda x: x == 3), (lambda x: x * x == 9)
LOG_PIL = {'⇒': medfor(P_X3, P_X2_9) and not medfor(P_X2_9, P_X3),
           '⇐': medfor(P_X2_9, P_X3) and not medfor(P_X3, P_X2_9),
           '⇔': medfor(P_X3, P_X2_9) and medfor(P_X2_9, P_X3)}
assert medfor(lambda x: 2 * x + 1 == 7, lambda x: x == 3) and medfor(lambda x: x == 3, lambda x: 2 * x + 1 == 7)
assert not medfor(lambda x: x * x == 16, lambda x: x == 4)
assert not medfor(lambda x: x > 2, lambda x: x > 5)
MOTEX_2N = min(n for n in range(1, 50) if not 2 ** n > n * n)
assert MOTEX_2N == 2
KEDJA = {'x = 2': lambda x: x == 2, 'x² = 4': lambda x: x * x == 4, 'x² ≤ 4': lambda x: x * x <= 4,
         'x ≤ 2': lambda x: x <= 2}
KEDJOR = [o for o in itertools.permutations(KEDJA)
          if all(medfor(KEDJA[a], KEDJA[b]) for a, b in zip(o, o[1:]))]
assert KEDJOR == [('x = 2', 'x² = 4', 'x² ≤ 4', 'x ≤ 2')], KEDJOR
JAMNA_PRIMTAL = [n for n in range(2, 1000) if primtal(n) and n % 2 == 0]
assert JAMNA_PRIMTAL == [2]
OMV = ['Om en fyrhörning är en rektangel, så är den en kvadrat',
       'Om en fyrhörning inte är en kvadrat, så är den inte en rektangel',
       'En fyrhörning är en kvadrat om och endast om den är en rektangel',
       'Om en fyrhörning inte är en rektangel, så är den inte en kvadrat']

MA_GY2_LOGIK_1 = niva('ma-gy2-logik-bevis-1', 'Implikation, ekvivalens och motexempel', 'Logik och bevis', [
    para('Para ihop pilen med vad den betyder.',
         [('p ⇒ q', 'Om p är sant, så är q sant'), ('p ⇐ q', 'Om q är sant, så är p sant'),
          ('p ⇔ q', 'p är sant om och endast om q är sant')],
         'Implikationspilen visar åt vilket håll slutsatsen gäller. Ekvivalenspilen ⇔ betyder att den gäller '
         'åt båda hållen.'),
    val('x är ett reellt tal. Vilken pil ska stå mellan påståendena i x = 3 … x² = 9?', list(LOG_PIL),
        enda_av(LOG_PIL, lambda v: v),
        'Om x = 3 så är x² = 9. Men x² = 9 gäller också för x = −3, så av x² = 9 följer inte x = 3. Pilen '
        'gäller bara åt höger: ⇒.'),
    sant('För reella tal x gäller 2x + 1 = 7 ⇔ x = 3.', True,
         'Åt höger: 2x + 1 = 7 ger 2x = 6 och x = 3. Åt vänster: x = 3 ger 2 · 3 + 1 = 7. Sambandet gäller '
         'åt båda hållen, så det är en ekvivalens.'),
    sant('För reella tal x gäller x² = 16 ⇔ x = 4.', medfor(lambda x: x * x == 16, lambda x: x == 4),
         'x = 4 ger x² = 16, men x² = 16 har också lösningen x = −4. Pilen gäller bara från x = 4 till '
         'x² = 16.'),
    skriv('Påståendet ”2ⁿ > n² för alla positiva heltal n” är falskt. Vilket är det minsta positiva heltal n '
          'som är ett motexempel?', x_svar(MOTEX_2N, 'n'),
          'För n = 1 är 2¹ = 2 större än 1² = 1. För n = 2 är både 2ⁿ och n² lika med 4, och 4 är inte större än '
          '4. Alltså är n = 2 det första motexemplet.'),
    sant('För reella tal x gäller x > 2 ⇒ x > 5.', medfor(lambda x: x > 2, lambda x: x > 5),
         'x = 3 är större än 2 men inte större än 5. Ett enda motexempel räcker för att visa att en implikation '
         'är falsk.'),
    val('Påståendet ”Om en fyrhörning är en kvadrat, så är den en rektangel” är sant. Vilket påstående är dess '
        'omvändning?', OMV, OMV[0],
        'Omvändningen till ”om p, så q” är ”om q, så p”: delarna byter plats. Här är omvändningen falsk, för '
        'en rektangel med olika långa sidor är ingen kvadrat.'),
    ordna('x är ett reellt tal. Ordna påståendena så att vart och ett medför (⇒) nästa.', list(KEDJOR[0]),
          forklaring='x = 2 ger x² = 4, som är ett fall av x² ≤ 4. Och x² ≤ 4 betyder att x ligger mellan −2 och '
                     '2, så x ≤ 2. Ingen av pilarna gäller baklänges.'),
    skriv('Påståendet ”Alla primtal är udda” är falskt. Vilket primtal är ett motexempel?', t(JAMNA_PRIMTAL[0]),
          '2 är ett primtal, för det är bara delbart med 1 och sig självt, och det är jämnt. Det är det enda '
          'jämna primtalet, för alla andra jämna tal är delbara med 2.'),
    sant('Ett enda motexempel räcker för att visa att ett påstående om alla tal är falskt.', True,
         'Påståendet säger att något gäller för varje tal. Ett enda tal där det inte gäller visar att '
         'påståendet är falskt.'),
], beskrivning='Implikation och ekvivalens mellan påståenden, omvändningar och motexempel.')

assert all((2 * a + 1) + (2 * b + 1) == 2 * (a + b + 1) for a in range(-5, 6) for b in range(-5, 6))
L2_TRE = {'3(n + 1)': lambda n: 3 * (n + 1), '3n + 1': lambda n: 3 * n + 1, 'n + 3': lambda n: n + 3,
          '3n + 2': lambda n: 3 * n + 2}
L2_TRE_SVAR = enda(list(L2_TRE), lambda a: all(L2_TRE[a](n) == n + (n + 1) + (n + 2) for n in range(-6, 7)))
# n² < 2ⁿ stämmer för n = 5 till 14 men inte för n = 3.
assert all(n * n < 2 ** n for n in range(5, 15)) and not 3 * 3 < 2 ** 3
assert all(((n + 1) ** 2 - n ** 2) % 2 == 1 for n in range(-20, 21))
MOTEX_41 = min(n for n in range(0, 100) if not primtal(n * n + n + 41))
assert MOTEX_41 == 40 and 40 * 40 + 40 + 41 == 41 * 41
assert all((2 * n + 1) ** 2 - 1 == 4 * n * (n + 1) for n in range(-10, 11))
assert all(n * (n + 1) % 2 == 0 for n in range(-20, 21))
EGENSKAP = {'Ett jämnt tal': lambda v: v % 2 == 0, 'Ett udda tal': lambda v: v % 2 == 1,
            'Delbart med 3': lambda v: v % 3 == 0, 'Ett kvadrattal': lambda v: v >= 0 and math.isqrt(v) ** 2 == v}
UTTRYCK = [('2n', lambda n: 2 * n, 'Ett jämnt tal'), ('2n + 1', lambda n: 2 * n + 1, 'Ett udda tal'),
           ('3n', lambda n: 3 * n, 'Delbart med 3'), ('n²', lambda n: n * n, 'Ett kvadrattal')]
for _, f_, e_ in UTTRYCK:
    # Uttrycket har alltid sin egenskap och ingen av de andra (för n från 0, så att kvadrattalen är definierade).
    alltid = [e for e, prov in EGENSKAP.items() if all(prov(f_(n)) for n in range(0, 30))]
    assert alltid == [e_], (e_, alltid)

MA_GY2_LOGIK_2 = niva('ma-gy2-logik-bevis-2', 'Bevis med jämna och udda tal', 'Logik och bevis', [
    val('n är ett heltal. Vilket av uttrycken är alltid ett udda tal?', ['2n + 1', '2n', 'n + 1', 'n²'], '2n + 1',
        '2n är ett jämnt tal, och ett jämnt tal plus 1 är udda. n + 1 och n² är udda bara för vissa n: för '
        'n = 1 är n + 1 = 2 jämnt, och för n = 2 är n² = 4 jämnt.'),
    ordna('Ordna stegen i beviset för att summan av två udda tal är jämn. Talen är 2m + 1 och 2n + 1, där m och '
          'n är heltal.',
          ['(2m + 1) + (2n + 1) = 2m + 2n + 2', '2m + 2n + 2 = 2(m + n + 1)',
           'm + n + 1 är ett heltal, så summan är jämn'],
          forklaring='Skriv summan, bryt ut 2 och konstatera att det som står inom parentes är ett heltal.'),
    val('Summan av tre heltal i rad, n, n + 1 och n + 2, är alltid delbar med 3. Vilken omskrivning av summan '
        'visar det?', list(L2_TRE), L2_TRE_SVAR,
        'n + (n + 1) + (n + 2) = 3n + 3 = 3(n + 1). Det är 3 gånger ett heltal, och därför delbart med 3.'),
    sant('Om ett påstående stämmer för tio olika tal är det bevisat att det stämmer för alla tal.', False,
         'Påståendet n² < 2ⁿ stämmer för n = 5, 6, 7, …, 14, alltså för tio olika tal, men inte för n = 3, där 9 '
         'är större än 8. Exempel kan visa att något är falskt men aldrig bevisa att det alltid gäller.'),
    val('I ett bevis för att vinkelsumman i en triangel är 180° drar man en linje genom ett av hörnen, parallell '
        'med den motstående sidan. Vilka vinklar använder beviset sedan?',
        ['Alternatvinklar', 'Randvinklar', 'Medelpunktsvinklar', 'Basvinklar'], 'Alternatvinklar',
        'Vid hörnet bildar linjen och triangelns sidor tre vinklar som tillsammans är 180°. De två yttre är '
        'alternatvinklar till triangelns andra två vinklar och lika stora som dem. Då är triangelns tre vinklar '
        'också 180° tillsammans.'),
    sant('(n + 1)² − n² är ett udda tal för alla heltal n.', True,
         '(n + 1)² − n² = n² + 2n + 1 − n² = 2n + 1, och 2n + 1 är alltid udda.'),
    skriv('Påståendet ”n² + n + 41 är ett primtal för alla heltal n ≥ 0” är falskt. Vilket är det minsta n som '
          'är ett motexempel?', x_svar(MOTEX_41, 'n'),
          'Uttrycket ger primtal för n = 0 till 39. För n = 40 är det 1 600 + 40 + 41 = 1 681 = 41 · 41, och '
          'det är inget primtal.'),
    skriv('Omskrivningen (2n + 1)² − 1 = 4n(n + a) visar att talet är delbart med 4. Vad är a?', x_svar(1, 'a'),
          'Utveckla: (2n + 1)² − 1 = 4n² + 4n + 1 − 1 = 4n² + 4n. Bryt ut 4n: 4n(n + 1). Alltså är a = 1.'),
    val('Varför är n(n + 1) ett jämnt tal för alla heltal n?',
        ['Av två heltal i rad är alltid ett jämnt', 'Både n och n + 1 är jämna för alla n',
         'En produkt av två heltal är alltid jämn', 'Talet n + 1 är jämnt för alla heltal n'],
        'Av två heltal i rad är alltid ett jämnt',
        'n och n + 1 är två heltal i rad, så ett av dem är jämnt. En produkt där en faktor är jämn är jämn. '
        '3 · 5 = 15 visar att en produkt av två heltal kan vara udda.'),
    para('n är ett heltal som inte är negativt. Para ihop uttrycket med det som uttrycket alltid är.',
         [(u, e) for u, _, e in UTTRYCK],
         '2n är 2 gånger ett heltal och därför jämnt, och 2n + 1 är ett jämnt tal plus 1. 3n ligger i 3:ans '
         'tabell, och n² är ett heltal i kvadrat. Inget av uttrycken har alltid någon av de andra egenskaperna.'),
], beskrivning='Skriva jämna och udda tal med n, följa enkla bevis och skilja ett bevis från exempel.')

# ---------------------------------------------------------------- gy3: rationella uttryck

PUNKTER = [F(n, 3) for n in range(-20, 21)]


def lika_uttr(f, g, utom=()):
    """Två rationella uttryck är lika i alla provpunkter där båda är definierade."""
    def varde(h, x):
        try:
            return h(x)
        except ZeroDivisionError:
            return None
    pts = [x for x in PUNKTER if x not in utom and varde(f, x) is not None and varde(g, x) is not None]
    assert len(pts) > 20
    return all(f(x) == g(x) for x in pts)


RU1_A = {'x − 5': lambda x: x - 5, 'x + 5': lambda x: x + 5, 'x − 25': lambda x: x - 25, '−5': lambda x: F(-5)}
RU1_B = {'x + 2': lambda x: x + 2, 'x + 6': lambda x: x + 6, '3x + 2': lambda x: 3 * x + 2, 'x + 3': lambda x: x + 3}
RU1_F = {'(x + 2)(x + 3)': lambda x: (x + 2) * (x + 3), '(x + 1)(x + 6)': lambda x: (x + 1) * (x + 6),
         '(x − 2)(x − 3)': lambda x: (x - 2) * (x - 3), '(x + 5)(x + 1)': lambda x: (x + 5) * (x + 1)}
RU1_G = {'x + 3': lambda x: x + 3, 'x + 2': lambda x: x + 2, 'x² + 3': lambda x: x * x + 3, '5x + 3': lambda x: 5 * x + 3}
assert not lika_uttr(lambda x: (x + 3) / x, lambda x: F(3))
assert F(2 * 49 + 4 * 7, 2 * 7) == 9
assert lika_uttr(lambda x: (x - 1) / (1 - x), lambda x: F(-1))
RU1_PAR = [('(x² − 1)/(x − 1)', lambda x: (x * x - 1) / (x - 1), 'x + 1', lambda x: x + 1),
           ('(x² − 2x + 1)/(x − 1)', lambda x: (x * x - 2 * x + 1) / (x - 1), 'x − 1', lambda x: x - 1),
           ('(x² + 3x)/x', lambda x: (x * x + 3 * x) / x, 'x + 3', lambda x: x + 3),
           ('(4x − 8)/4', lambda x: (4 * x - 8) / 4, 'x − 2', lambda x: x - 2)]
for _, f_, _, g_ in RU1_PAR:
    assert lika_uttr(f_, g_)
assert lika_uttr(lambda x: (x * x - 4) / (x * x + 2 * x), lambda x: (x - 2) / x)

MA_GY3_RAT_1 = niva('ma-gy3-rationella-uttryck-1', 'Faktorisera och förkorta', 'Rationella uttryck', [
    val('Förenkla (x² − 25)/(x + 5), där x ≠ −5.', list(RU1_A),
        enda_av(RU1_A, lambda g: lika_uttr(lambda x: (x * x - 25) / (x + 5), g)),
        'Konjugatregeln ger x² − 25 = (x + 5)(x − 5). Faktorn x + 5 finns i både täljaren och nämnaren och '
        'förkortas bort, och kvar är x − 5.'),
    val('Förkorta (3x + 6)/3.', list(RU1_B), enda_av(RU1_B, lambda g: lika_uttr(lambda x: (3 * x + 6) / 3, g)),
        'Bryt ut 3 i täljaren: 3x + 6 = 3(x + 2). Förkorta med 3, och kvar är x + 2. Båda termerna i täljaren '
        'ska delas med 3, inte bara den ena.'),
    sant('(x + 3)/x = 3 för alla x ≠ 0.', lika_uttr(lambda x: (x + 3) / x, lambda x: F(3)),
         'Man får förkorta med en faktor, men inte stryka en term. Med x = 1 blir vänsterledet 4/1 = 4, inte 3. '
         'En riktig omskrivning är (x + 3)/x = 1 + 3/x.'),
    skriv('För vilket värde på x är uttrycket (x + 1)/(x − 2) inte definierat?', x_svar(2),
          'Ett bråk är inte definierat när nämnaren är 0, och x − 2 = 0 när x = 2. Att täljaren blir 0 för '
          'x = −1 gör inget: då är uttrycket 0.'),
    val('Faktorisera x² + 5x + 6.', list(RU1_F), enda_av(RU1_F, lambda g: lika_uttr(lambda x: x * x + 5 * x + 6, g)),
        'Sök två tal med produkten 6 och summan 5: 2 och 3. Alltså är x² + 5x + 6 = (x + 2)(x + 3). '
        'Kontrollera: x² + 3x + 2x + 6.'),
    val('Förenkla (x² + 5x + 6)/(x + 2), där x ≠ −2.', list(RU1_G),
        enda_av(RU1_G, lambda g: lika_uttr(lambda x: (x * x + 5 * x + 6) / (x + 2), g)),
        'Täljaren är (x + 2)(x + 3). Faktorn x + 2 förkortas bort, och kvar är x + 3.'),
    skriv('Förenkla (2x² + 4x)/(2x), där x ≠ 0. Vad är uttryckets värde när x = 7?', t(F(2 * 49 + 4 * 7, 2 * 7)),
          'Bryt ut 2x i täljaren: 2x(x + 2). Förkorta med 2x, och kvar är x + 2. För x = 7 är det 9.'),
    sant('(x − 1)/(1 − x) = −1 för alla x ≠ 1.', True,
         '1 − x = −(x − 1). Täljaren och nämnaren är samma tal med olika tecken, och kvoten blir −1.'),
    para('Para ihop uttrycket med det förenklade uttrycket. Anta att nämnaren inte är 0.',
         [(a, b) for a, _, b, _ in RU1_PAR],
         'x² − 1 = (x + 1)(x − 1) och x² − 2x + 1 = (x − 1)². I de två andra bryts x och 4 ut: x(x + 3) och '
         '4(x − 2). Sedan förkortas den gemensamma faktorn.'),
    ordna('Ordna stegen för att förenkla (x² − 4)/(x² + 2x), där x ≠ 0 och x ≠ −2.',
          ['Faktorisera: (x + 2)(x − 2) / (x(x + 2))', 'Förkorta med faktorn x + 2', 'Svar: (x − 2)/x'],
          forklaring='Täljaren faktoriseras med konjugatregeln och nämnaren genom att x bryts ut. Sedan förkortas '
                     'den gemensamma faktorn x + 2.'),
], beskrivning='Faktorisera och förkorta rationella uttryck, och se var ett uttryck inte är definierat.')

RU2_B = {'(2x + 1)/(x(x + 1))': lambda x: (2 * x + 1) / (x * (x + 1)), '2/(2x + 1)': lambda x: 2 / (2 * x + 1),
         '1/(x(x + 1))': lambda x: 1 / (x * (x + 1)), '(x + 2)/(x(x + 1))': lambda x: (x + 2) / (x * (x + 1))}
RU2_C = {'(x + 3)/(x − 3)': lambda x: (x + 3) / (x - 3), '(x − 3)/(x + 3)': lambda x: (x - 3) / (x + 3),
         '1': lambda x: F(1), '−1': lambda x: F(-1)}
assert lika_uttr(lambda x: 1 / x + 2 / x, lambda x: 3 / x)
assert lika_uttr(lambda x: (x * x + 2 * x - 15) / (x - 3), lambda x: x + 5)
RU2_E = {'1/x': lambda x: 1 / x, 'x': lambda x: x, '1': lambda x: F(1), '(x − 2)/x': lambda x: (x - 2) / x}
RU2_F = {'x = 3 och x = −3': {3, -3}, 'x = −2': {-2}, 'x = 9': {9}, 'x = 0': {0}}
NOLL_9 = {x for x in range(-20, 21) if x * x - 9 == 0}
assert not lika_uttr(lambda x: F(1) + 2, lambda x: F(2), utom=()) or True
assert F(1 + 2, 1 + 3) != F(2, 3)                              # (a + b)/(a + c) med a = 1, b = 2, c = 3
assert F(2, 5 - 1) - F(1, 5 - 1) == F(1, 4)
RU2_I = {'−3': lambda x: F(-3), '3': lambda x: F(3), '2x + 1': lambda x: 2 * x + 1, '−2x − 3': lambda x: -2 * x - 3}
RU2_PAR = [('1/(x − 5)', lambda x: 1 / (x - 5)), ('x/(x + 2)', lambda x: x / (x + 2)), ('3/(2x)', lambda x: 3 / (2 * x)),
           ('(x − 1)/(2x − 1)', lambda x: (x - 1) / (2 * x - 1))]


def odefinierad(f):
    """Provpunkterna där uttrycket inte är definierat."""
    ut = []
    for x in [F(n, 2) for n in range(-40, 41)]:
        try:
            f(x)
        except ZeroDivisionError:
            ut.append(x)
    return ut


MA_GY3_RAT_2 = niva('ma-gy3-rationella-uttryck-2', 'Räkna med rationella uttryck', 'Rationella uttryck', [
    skriv('Förenkla 1/x + 2/x.', ['3/x', '3 / x'],
          'Bråken har samma nämnare, så täljarna adderas: (1 + 2)/x = 3/x. Nämnaren ändras inte.'),
    val('Skriv 1/x + 1/(x + 1) som ett enda bråk.', list(RU2_B),
        enda_av(RU2_B, lambda g: lika_uttr(lambda x: 1 / x + 1 / (x + 1), g)),
        'Gemensam nämnare är x(x + 1). Förläng: (x + 1)/(x(x + 1)) + x/(x(x + 1)) = (2x + 1)/(x(x + 1)).'),
    val('Förenkla (x² − 9)/(x² − 6x + 9), där x ≠ 3.', list(RU2_C),
        enda_av(RU2_C, lambda g: lika_uttr(lambda x: (x * x - 9) / (x * x - 6 * x + 9), g)),
        'Täljaren är (x + 3)(x − 3) enligt konjugatregeln, och nämnaren (x − 3)² enligt kvadreringsregeln. '
        'Förkorta med x − 3, och kvar är (x + 3)/(x − 3).'),
    skriv('Uttrycket (x² + 2x − 15)/(x − 3) kan förenklas till x + a när x ≠ 3. Vad är a?', x_svar(5, 'a'),
          'Sök två tal med produkten −15 och summan 2: 5 och −3. Täljaren är (x + 5)(x − 3), och när x − 3 '
          'förkortas bort är kvar x + 5. Alltså är a = 5.'),
    val('Förenkla (x/(x − 2)) · ((x − 2)/x²), där x ≠ 0 och x ≠ 2.', list(RU2_E),
        enda_av(RU2_E, lambda g: lika_uttr(lambda x: (x / (x - 2)) * ((x - 2) / (x * x)), g)),
        'Multiplicera täljare med täljare och nämnare med nämnare: x(x − 2)/((x − 2)x²). Förkorta med x − 2 '
        'och med x, och kvar är 1/x.'),
    val('Vilka värden får x inte ha i uttrycket (x + 2)/(x² − 9)?', list(RU2_F),
        enda_av(RU2_F, lambda s: s == NOLL_9),
        'Nämnaren får inte vara 0. x² − 9 = 0 när x² = 9, alltså när x = 3 eller x = −3. För x = −2 är '
        'täljaren 0, och då är uttrycket bara 0.'),
    sant('(a + b)/(a + c) = b/c för alla tal a, b och c där nämnarna inte är 0.', False,
         'Med a = 1, b = 2 och c = 3 är vänsterledet 3/4 men högerledet 2/3. Talet a är en term och ingen '
         'faktor, så det går inte att förkorta bort.'),
    skriv('Förenkla 2/(x − 1) − 1/(x − 1). Vad är uttryckets värde när x = 5? Svara som decimaltal eller bråk.',
          brak_svar(F(2, 5 - 1) - F(1, 5 - 1)),
          'Samma nämnare: (2 − 1)/(x − 1) = 1/(x − 1). För x = 5 blir det 1/4 = 0,25.'),
    val('Förenkla (x² − 1)/(x + 1) − (x² − 4)/(x − 2), där x ≠ −1 och x ≠ 2.', list(RU2_I),
        enda_av(RU2_I, lambda g: lika_uttr(lambda x: (x * x - 1) / (x + 1) - (x * x - 4) / (x - 2), g)),
        'Det första bråket är (x + 1)(x − 1)/(x + 1) = x − 1, och det andra (x + 2)(x − 2)/(x − 2) = x + 2. '
        'Skillnaden är (x − 1) − (x + 2) = −3.'),
    para('Para ihop uttrycket med det x-värde där uttrycket inte är definierat.',
         [(a, 'x = %s' % m(odefinierad(f)[0])) for a, f in RU2_PAR],
         'Uttrycket är inte definierat där nämnaren är 0: x − 5 = 0 ger x = 5, x + 2 = 0 ger x = −2, 2x = 0 ger '
         'x = 0, och 2x − 1 = 0 ger x = 0,5.'),
], beskrivning='Addera, subtrahera och multiplicera rationella uttryck, och förenkla i flera steg.')
assert all(len(odefinierad(f)) == 1 for _, f in RU2_PAR)

# ---------------------------------------------------------------- gy3: gränsvärden och derivatans definition


def gransvarde(f, a, steg=(1e-5, 1e-6, 1e-7)):
    """f(x) när x → a, prövat från båda hållen och kontrollerat att värdena står still.
    Stegen är små nog för att en funktion med måttlig lutning ska hålla sig inom
    toleransen, och stora nog för att flyttalens avrundning inte ska störa."""
    v = [f(a + s) for s in steg] + [f(a - s) for s in steg]
    assert max(v) - min(v) < 1e-3, v
    return sum(v) / len(v)


def mot_oandligheten(f):
    v = [f(x) for x in (1e6, 1e7, 1e8)]
    assert max(v) - min(v) < 1e-5, v
    return v[-1]


assert F(9 - 1, 3 - 1) == 4 and F(120 - 30, F(2) - F(1, 2)) == 60
assert abs(gransvarde(lambda x: (x * x - 9) / (x - 3), 3) - 6) < 1e-6
G1_H = {'5': 5, '0': 0, '6': 6, 'Gränsvärdet finns inte': None}
G1_H_V = gransvarde(lambda h: (h * h + 5 * h) / h, 0)
assert abs(mot_oandligheten(lambda x: 1 / x)) < 1e-6
assert abs(gransvarde(lambda x: (x * x - 1) / (x - 1), 1) - 2) < 1e-6
G1_STOR = {'Värdet närmar sig 2': 2, 'Värdet närmar sig 1': 1, 'Värdet närmar sig 0': 0,
           'Värdet växer utan gräns': math.inf}
G1_PAR = [('x² när x → 3', round(gransvarde(lambda x: x * x, 3))),
          ('(x² − 4)/(x − 2) när x → 2', round(gransvarde(lambda x: (x * x - 4) / (x - 2), 2))),
          ('5/x när x → ∞', round(mot_oandligheten(lambda x: 5 / x))),
          ('(x + 1)/x när x → ∞', round(mot_oandligheten(lambda x: (x + 1) / x)))]

MA_GY3_GRANS_1 = niva('ma-gy3-gransvarden-1', 'Ändringskvot och gränsvärde', 'Gränsvärden och derivatans definition', [
    skriv('Funktionen f(x) = x² har värdet 1 när x = 1 och värdet 9 när x = 3. Vad är ändringskvoten Δy/Δx mellan '
          'x = 1 och x = 3?', t(F(9 - 1, 3 - 1)),
          'Ändringskvoten är ändringen i y delat med ändringen i x: (9 − 1)/(3 − 1) = 8/2 = 4.'),
    skriv('En bil har kört 30 km efter 0,5 timmar och 120 km efter 2 timmar. Vad är medelhastigheten mellan de två '
          'tidpunkterna? Svara i km/h.', t(F(120 - 30, F(2) - F(1, 2))),
          'Medelhastigheten är en ändringskvot: (120 − 30)/(2 − 0,5) = 90/1,5 = 60 km/h.'),
    val('Vad anger ändringskvoten mellan två punkter på en kurva?',
        ['Lutningen på sekanten genom punkterna', 'Lutningen på tangenten i den första punkten',
         'Arean under kurvan mellan punkterna', 'Avståndet mellan de två punkterna'],
        'Lutningen på sekanten genom punkterna',
        'Sekanten är den räta linjen genom de två punkterna, och dess lutning är Δy/Δx. Tangentens lutning '
        'får man först när punkterna kommer hur nära varandra som helst.'),
    skriv('Beräkna gränsvärdet av 3x + 2 när x → 4.', t(round(gransvarde(lambda x: 3 * x + 2, 4))),
          'Uttrycket är definierat för x = 4, och värdena närmar sig 3 · 4 + 2 = 14 när x närmar sig 4.'),
    skriv('Beräkna gränsvärdet av (x² − 9)/(x − 3) när x → 3.', t(round(gransvarde(lambda x: (x * x - 9) / (x - 3), 3))),
          'Insättning ger 0/0, så förenkla först: (x + 3)(x − 3)/(x − 3) = x + 3 när x ≠ 3. När x → 3 går det '
          'mot 6.'),
    val('Vad är gränsvärdet av (h² + 5h)/h när h → 0?', list(G1_H),
        enda_av(G1_H, lambda v: v is not None and abs(v - G1_H_V) < 1e-6),
        'Att sätta in h = 0 ger 0/0. Förkorta först: (h² + 5h)/h = h + 5 när h ≠ 0. När h → 0 går det mot 5.'),
    sant('Gränsvärdet av 1/x när x → ∞ är 0.', True,
         'När x blir allt större blir 1/x allt mindre: 1/10 = 0,1 och 1/1 000 = 0,001. Värdet kommer hur nära 0 '
         'som helst, men blir aldrig 0.'),
    sant('Ett gränsvärde när x → a kan finnas fast funktionen inte är definierad för x = a.', True,
         '(x² − 1)/(x − 1) är inte definierad för x = 1, men för alla andra x är den lika med x + 1. När x → 1 '
         'går värdet mot 2.'),
    val('Vad händer med värdet av (2x + 1)/x när x blir mycket stort?', list(G1_STOR),
        enda_av(G1_STOR, lambda v: abs(v - mot_oandligheten(lambda x: (2 * x + 1) / x)) < 1e-6),
        '(2x + 1)/x = 2 + 1/x, och 1/x går mot 0 när x blir stort. Värdet närmar sig därför 2.'),
    para('Para ihop gränsvärdet med dess värde.', [(a, t(v)) for a, v in G1_PAR],
         'x² går mot 3² = 9. (x² − 4)/(x − 2) = x + 2 går mot 4. 5/x går mot 0, och (x + 1)/x = 1 + 1/x går '
         'mot 1.'),
], beskrivning='Ändringskvoter och sekanter, gränsvärden när x närmar sig ett tal och när x växer.')


def andringskvot(f, a, h):
    return (f(a + h) - f(a)) / h


KVAD = lambda x: x * x                                          # noqa: E731
for h_ in (F(1), F(1, 10), F(-1, 3), F(1, 1000)):
    assert andringskvot(KVAD, 3, h_) == 6 + h_ and andringskvot(KVAD, 2, h_) == 4 + h_
    assert andringskvot(lambda x: 5 * x - 2, F(7), h_) == 5
    assert andringskvot(lambda x: F(1) / x, 2, h_) == F(-1) / (2 * (2 + h_))
    assert andringskvot(lambda x: x * x + 3 * x, 2, h_) == 7 + h_
    assert all(andringskvot(KVAD, F(x), h_) == 2 * x + h_ for x in range(-3, 4))
    assert andringskvot(KVAD, 1, h_) == 2 + h_
D2_C = {'4 + h': lambda h: 4 + h, '4': lambda h: F(4), '4h + h²': lambda h: 4 * h + h * h, '2 + h': lambda h: 2 + h}
D2_F = {'2x': lambda x: 2 * x, '2x + h': None, 'x²': lambda x: x * x, '2': lambda x: F(2)}
assert andringskvot(lambda x: x * x + 2 * x, 1, F(1, 10)) == F(41, 10)
assert abs(gransvarde(lambda h: -1 / (2 * (2 + h)), 0) + 0.25) < 1e-6 and (2 * 2 + 3) == 7
assert (2 * 2 + 3 * 2) == 10 and all((2 + h) ** 2 + 3 * (2 + h) - 10 == 7 * h + h * h for h in range(-5, 6))
for x_ in (1.0, 2.5, -3.0):        # derivatan av x² är 2x, prövad numeriskt
    assert abs(gransvarde(lambda h: andringskvot(lambda z: z * z, x_, h), 0) - 2 * x_) < 1e-4

MA_GY3_GRANS_2 = niva('ma-gy3-gransvarden-2', 'Derivatans definition', 'Gränsvärden och derivatans definition', [
    val('Hur definieras derivatan f′(a)?',
        ['Som gränsvärdet av (f(a + h) − f(a))/h när h → 0', 'Som gränsvärdet av f(a + h) − f(a) när h → 0',
         'Som kvoten (f(a + h) − f(a))/h när h = 1', 'Som gränsvärdet av (f(a + h) + f(a))/h när h → 0'],
        'Som gränsvärdet av (f(a + h) − f(a))/h när h → 0',
        'Kvoten (f(a + h) − f(a))/h är sekantens lutning mellan x = a och x = a + h. När h → 0 går den mot '
        'tangentens lutning, och det är f′(a).'),
    skriv('För f(x) = x² är (f(3 + h) − f(3))/h = 6 + h när h ≠ 0. Vad är f′(3)?', deriv_svar(6, 3),
          'f′(3) är gränsvärdet av 6 + h när h → 0, alltså 6.'),
    val('Förenkla (f(2 + h) − f(2))/h för f(x) = x², där h ≠ 0.', list(D2_C),
        enda_av(D2_C, lambda g: all(andringskvot(KVAD, 2, F(h)) == g(F(h)) for h in (1, 2, -3, F(1, 7)))),
        '((2 + h)² − 4)/h = (4 + 4h + h² − 4)/h = (4h + h²)/h = 4 + h. Talet 4 är gränsvärdet när h → 0, inte '
        'kvoten själv.'),
    skriv('Beräkna ändringskvoten (f(1 + h) − f(1))/h för f(x) = x² + 2x när h = 0,1.',
          t(andringskvot(lambda x: x * x + 2 * x, 1, F(1, 10))),
          'f(1,1) = 1,21 + 2,2 = 3,41 och f(1) = 3. Kvoten är (3,41 − 3)/0,1 = 0,41/0,1 = 4,1. Den ligger nära '
          'f′(1) = 4.'),
    skriv('Funktionen är f(x) = 5x − 2. Vad är (f(x + h) − f(x))/h när h ≠ 0?', t(5),
          'f(x + h) − f(x) = 5(x + h) − 2 − (5x − 2) = 5h. Delat med h blir det 5, vilket h det än är. En rät '
          'linje har samma lutning överallt.'),
    val('För f(x) = x² är (f(x + h) − f(x))/h = 2x + h när h ≠ 0. Vad är f′(x)?', list(D2_F),
        enda(list(D2_F), lambda a: D2_F[a] is not None
             and all(abs(D2_F[a](F(x)) - gransvarde(lambda h: andringskvot(lambda z: z * z, x, h), 0)) < 1e-4
                     for x in (-2, 1, 3))),
        'Låt h gå mot 0 i 2x + h. Kvar blir 2x, så f′(x) = 2x. Uttrycket 2x + h är sekantens lutning, inte '
        'derivatan.'),
    sant('Derivatan f′(a) är gränsvärdet av sekanternas lutning när den andra punkten närmar sig punkten '
         '(a, f(a)).', True,
         'Sekanten går genom (a, f(a)) och (a + h, f(a + h)). När h → 0 vrids den mot tangenten, och lutningen '
         'går mot f′(a).'),
    sant('Ändringskvoten (f(a + h) − f(a))/h är lika med f′(a) vilket h man än väljer.',
         all(andringskvot(KVAD, 1, F(h)) == 2 for h in (1, 2, F(1, 10))),
         'För f(x) = x² och a = 1 är ändringskvoten 2 + h, och den är f′(1) = 2 bara i gränsen när h → 0. Det '
         'gäller för varje h bara när grafen är en rät linje.'),
    skriv('För f(x) = 1/x är (f(2 + h) − f(2))/h = −1/(2(2 + h)) när h ≠ 0 och h ≠ −2. Vad är f′(2)? Svara som '
          'decimaltal eller bråk.',
          # f′(2) = −1/4 godtas som f′(3) = 6 ovan, inom verktygets tak på tolv svar.
          brak_svar(F(-1, 4)) + ['f%s(2) = %s' % (p, s) for p in ("′", "'") for s in (t(F(-1, 4)), '-1/4')]
          + ["f'(2)=%s" % s for s in (t(F(-1, 4)), '-1/4')],
          'Låt h → 0: −1/(2 · 2) = −1/4 = −0,25. Det stämmer med att lutningen är negativ, för 1/x avtar när x '
          'växer.'),
    ordna('Ordna stegen när du bestämmer f′(2) för f(x) = x² + 3x med derivatans definition.',
          ['f(2 + h) − f(2) = (2 + h)² + 3(2 + h) − 10', 'f(2 + h) − f(2) = 7h + h²', 'Dela med h: 7 + h',
           'Låt h → 0: f′(2) = 7'],
          forklaring='f(2) = 4 + 6 = 10. Utveckla, förenkla, dela med h och låt sist h gå mot 0.'),
], beskrivning='Derivatans definition: ändringskvoten (f(a + h) − f(a))/h och gränsvärdet när h → 0.')

# ---------------------------------------------------------------- gy3: triangelsatserna


def cos_sida(b, c, A):
    return math.sqrt(b * b + c * c - 2 * b * c * cos(A))


def cos_vinkel(a, b, c):
    """Vinkeln mitt emot sidan a."""
    return acos((b * b + c * c - a * a) / (2 * b * c))


def area(a, b, C):
    return a * b * sin(C) / 2


T3_AREA = {'15 cm²': 15, '30 cm²': 30, '26 cm²': 26, '8 cm²': 8}
assert abs(6 * 10 * sin(30) - 30) < 1e-9 and abs(6 * 10 * cos(30) / 2 - 26) < 0.05
assert abs(cos_sida(3, 8, 60) - 7) < 1e-9 and abs(cos_vinkel(13, 7, 8) - 120) < 1e-9
assert abs(cos(90)) < 1e-15

MA_GY3_TRI_1 = niva('ma-gy3-triangelsatserna-1', 'Areasatsen och cosinussatsen', 'Triangelsatserna', [
    val('Vilken formel är areasatsen för en triangel där sidorna a och b har vinkeln C mellan sig?',
        ['T = (a · b · sin C)/2', 'T = a · b · sin C', 'T = (a · b · cos C)/2', 'T = (a + b) · sin C/2'],
        'T = (a · b · sin C)/2',
        'Höjden mot sidan a är b · sin C, och arean är bas gånger höjd delat med 2: T = (a · b · sin C)/2.'),
    val('En triangel har sidorna 6 cm och 10 cm, och vinkeln mellan dem är 30°. Hur stor är arean?', list(T3_AREA),
        enda_av(T3_AREA, lambda v: abs(v - area(6, 10, 30)) < 0.5),
        'Areasatsen: T = 6 · 10 · sin 30°/2 = 60 · 0,5/2 = 15 cm². Den som glömmer att dela med 2 får 30 cm².'),
    skriv('En triangel har sidorna 8 cm och 11 cm, och vinkeln mellan dem är 65°. Hur stor är arean? Svara i cm² '
          'med en decimal.', avr(area(8, 11, 65), 1),
          'Areasatsen: T = 8 · 11 · sin 65°/2 = 44 · sin 65° ≈ 44 · 0,906 ≈ 39,9 cm².'),
    val('Vilken formel är cosinussatsen?',
        ['c² = a² + b² − 2ab · cos C', 'c² = a² + b² + 2ab · cos C', 'c² = a² + b² − 2ab · sin C',
         'c = a + b − 2ab · cos C'],
        'c² = a² + b² − 2ab · cos C',
        'Cosinussatsen är Pythagoras sats med ett tillägg för vinkeln C mellan a och b: c² = a² + b² − 2ab · cos C. '
        'När C = 90° är cos C = 0, och tillägget försvinner.'),
    skriv('I triangeln ABC är sidan a = 3 cm, sidan b = 8 cm och vinkeln C = 60°. Hur lång är sidan c? Svara i cm.',
          avr(cos_sida(3, 8, 60), 0, 'c', ' cm'),
          'Cosinussatsen: c² = 9 + 64 − 2 · 3 · 8 · cos 60° = 73 − 48 · 0,5 = 49, så c = 7 cm.'),
    skriv('En triangel har sidorna 7 cm, 8 cm och 13 cm. Hur stor är vinkeln mitt emot sidan som är 13 cm? Svara i '
          'grader.', t(round(cos_vinkel(13, 7, 8))),
          'Cosinussatsen: 13² = 7² + 8² − 2 · 7 · 8 · cos v, alltså 169 = 113 − 112 cos v. Det ger cos v = −0,5 '
          'och v = 120°.'),
    skriv('I triangeln ABC är sidan b = 12 cm, sidan c = 9 cm och vinkeln A = 40°. Hur lång är sidan a? Svara i cm '
          'med en decimal.', avr(cos_sida(12, 9, 40), 1, 'a', ' cm'),
          'Cosinussatsen: a² = 144 + 81 − 2 · 12 · 9 · cos 40° ≈ 225 − 165,5 = 59,5, så a ≈ 7,7 cm.'),
    sant('Om vinkeln C är 90° blir cosinussatsen c² = a² + b² − 2ab · cos C samma sak som Pythagoras sats.', True,
         'cos 90° = 0, så den sista termen försvinner och kvar står c² = a² + b².'),
    sant('Areasatsen gäller bara i rätvinkliga trianglar.', False,
         'Areasatsen gäller i alla trianglar. Med C = 90° är sin C = 1, och då blir den den vanliga formeln '
         'a · b/2 för en rätvinklig triangel.'),
    para('Para ihop det du vet om en triangel med satsen du använder.',
         [('Två sidor och vinkeln mellan dem, och du söker den tredje sidan', 'Cosinussatsen'),
          ('Två vinklar och en sida, och du söker en annan sida', 'Sinussatsen'),
          ('Två sidor och vinkeln mellan dem, och du söker arean', 'Areasatsen')],
         'Cosinussatsen knyter ihop tre sidor och en vinkel. Sinussatsen kräver ett par med en sida och vinkeln '
         'mitt emot, och den tredje vinkeln får man ur vinkelsumman. Areasatsen ger arean.'),
], beskrivning='Areasatsen och cosinussatsen i godtyckliga trianglar: areor, sidor och vinklar.')

T4_C = {'8,2 cm': 8.2, '8,8 cm': 8.8, '12,3 cm': 12.3, '7,7 cm': 7.7}
SIDA_A = 10 * sin(50) / sin(70)
assert abs(10 * sin(50) / sin(60) - 8.8) < 0.05 and abs(10 * sin(70) / sin(50) - 12.3) < 0.05
assert abs(10 * sin(50) - 7.7) < 0.05
VINKEL_B = asin(7 * sin(80) / 10)
assert 7 < 10                                          # b < a ger B < A: bara den spetsiga vinkeln passar
assert 180 - VINKEL_B + 80 > 180


def antal_trianglar(a, b, A):
    """Hur många trianglar har sidorna a och b och vinkeln A mitt emot a?"""
    s = b * sin(A) / a
    if s > 1:
        return 0
    vinklar = {round(asin(s), 9), round(180 - asin(s), 9)}
    return sum(1 for B in vinklar if A + B < 180)


T4_TVA = {'Två': 2, 'En': 1, 'Ingen': 0, 'Oändligt många': math.inf}
assert antal_trianglar(6, 8, 40) == 2 and antal_trianglar(10, 7, 80) == 1
HERON = math.sqrt(9 * 4 * 3 * 2)
assert abs(area(5, 6, cos_vinkel(7, 5, 6)) - HERON) < 1e-9
B_SIDA = 8 * sin(50) / sin(70)
assert dec(B_SIDA, 2) == '6,52' and dec(area(8, B_SIDA, 60), 1) == '22,6'
T4_SORT = {'Trubbig': lambda v: v > 90, 'Rät': lambda v: abs(v - 90) < 1e-9, 'Spetsig': lambda v: v < 90}

MA_GY3_TRI_2 = niva('ma-gy3-triangelsatserna-2', 'Sinussatsen och problemlösning', 'Triangelsatserna', [
    val('Vilken formel är sinussatsen för triangeln ABC?',
        ['sin A/a = sin B/b', 'a · sin A = b · sin B', 'sin A/b = sin B/a', 'a/cos A = b/cos B'], 'sin A/a = sin B/b',
        'I sinussatsen står varje sida ihop med vinkeln mitt emot den: sin A/a = sin B/b = sin C/c. Den kan '
        'också skrivas a/sin A = b/sin B.'),
    skriv('I triangeln ABC är vinkeln A = 30°, vinkeln B = 45° och sidan a = 6 cm. Hur lång är sidan b? Svara i cm '
          'med en decimal.', avr(6 * sin(45) / sin(30), 1, 'b', ' cm'),
          'Sinussatsen: b/sin 45° = 6/sin 30°, så b = 6 · sin 45°/sin 30° ≈ 6 · 0,707/0,5 ≈ 8,5 cm.'),
    val('I triangeln ABC är vinkeln A = 50°, vinkeln B = 60° och sidan c = 10 cm. Hur lång är sidan a?', list(T4_C),
        enda_av(T4_C, lambda v: abs(v - SIDA_A) < 0.05),
        'Vinkeln C är 180° − 50° − 60° = 70°, och den står mitt emot c. Sinussatsen: a = 10 · sin 50°/sin 70° '
        '≈ 8,2 cm. Den som använder vinkeln B i stället för C får 8,8 cm.'),
    skriv('I triangeln ABC är sidan a = 10 cm, sidan b = 7 cm och vinkeln A = 80°. Hur stor är vinkeln B? Svara i '
          'grader med en decimal.', avr(VINKEL_B, 1, 'B', '°'),
          'Sinussatsen: sin B = 7 · sin 80°/10 ≈ 0,689, så B ≈ 43,6°. Den trubbiga vinkeln 180° − 43,6° passar '
          'inte, för tillsammans med A = 80° blir det mer än 180°.'),
    sant('När man räknar ut en vinkel med sinussatsen kan två olika trianglar passa med de givna måtten.', True,
         'sin v = sin(180° − v), så samma sinusvärde hör till en spetsig och en trubbig vinkel. Ibland går båda '
         'att använda i en triangel, och då finns två lösningar.'),
    val('I en triangel är sidan a = 6 cm, sidan b = 8 cm och vinkeln A = 40°. Hur många olika trianglar har de '
        'måtten?', list(T4_TVA), enda_av(T4_TVA, lambda n: n == antal_trianglar(6, 8, 40)),
        'Sinussatsen ger sin B = 8 · sin 40°/6 ≈ 0,857. Både B ≈ 59° och B ≈ 121° har det sinusvärdet, och '
        'båda fungerar med A = 40°, för vinkelsumman blir under 180°. Det finns alltså två trianglar.'),
    skriv('En tomt har formen av en triangel. Två av sidorna är 30 m och 45 m, och vinkeln mellan dem är 110°. Hur '
          'lång är den tredje sidan? Svara i hela meter.', avr(cos_sida(30, 45, 110), 0),
          'Cosinussatsen: c² = 900 + 2 025 − 2 · 30 · 45 · cos 110° ≈ 2 925 + 923 = 3 848, så c ≈ 62 m. '
          'cos 110° är negativ, så den tredje sidan blir längre än med en rät vinkel.'),
    skriv('En triangel har sidorna 5 cm, 6 cm och 7 cm. Hur stor är arean? Svara i cm² med en decimal.',
          avr(HERON, 1),
          'Cosinussatsen ger vinkeln C mitt emot 7 cm: cos C = (25 + 36 − 49)/60 = 0,2, så C ≈ 78,5°. '
          'Areasatsen: T = 5 · 6 · sin C/2 ≈ 15 · 0,980 ≈ 14,7 cm².'),
    ordna('I triangeln ABC är sidan a = 8 cm, vinkeln B = 50° och vinkeln C = 60°. Ordna stegen för att räkna ut '
          'arean.',
          ['A = 180° − 50° − 60° = 70°', 'Sinussatsen: b = 8 · sin 50°/sin 70°', 'b ≈ %s cm' % dec(B_SIDA, 2),
           'Areasatsen: T = 8 · b · sin 60°/2 ≈ %s cm²' % dec(area(8, B_SIDA, 60), 1)],
          forklaring='Först den tredje vinkeln, som står mitt emot a. Sedan sidan b med sinussatsen, och sist arean '
                     'med a, b och vinkeln C mellan dem.'),
    val('I en triangel är sidorna a = 5 cm, b = 7 cm och c = 10 cm. Vilken sorts vinkel är C, mitt emot den längsta '
        'sidan?', list(T4_SORT), enda_av(T4_SORT, lambda p: p(cos_vinkel(10, 5, 7))),
        'Cosinussatsen: cos C = (25 + 49 − 100)/(2 · 5 · 7) = −26/70. Ett negativt cosinusvärde betyder att '
        'vinkeln är större än 90°, alltså trubbig.'),
], beskrivning='Sinussatsen, fallet med två trianglar och problem där satserna används efter varandra.')

# ---------------------------------------------------------------- tillägg

TILLAGG = [
    bana('Matematik', 'gy1', [MA_GY1_GPF_1, MA_GY1_GPF_2, MA_GY1_TRIG_1, MA_GY1_TRIG_2,
                              MA_GY1_VEKTOR_1, MA_GY1_VEKTOR_2]),
    bana('Matematik', 'gy2', [MA_GY2_LINJE_1, MA_GY2_LINJE_2, MA_GY2_ROT_1, MA_GY2_ROT_2,
                              MA_GY2_LOGIK_1, MA_GY2_LOGIK_2]),
    bana('Matematik', 'gy3', [MA_GY3_RAT_1, MA_GY3_RAT_2, MA_GY3_GRANS_1, MA_GY3_GRANS_2,
                              MA_GY3_TRI_1, MA_GY3_TRI_2]),
]
