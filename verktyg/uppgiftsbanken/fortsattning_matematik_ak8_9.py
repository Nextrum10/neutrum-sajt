# -*- coding: utf-8 -*-
"""Fortsättning i matematik för åk 8 och åk 9 (2026-10-27). Leo: "Nexläx där ska vi
lägga in flera uppgifter, i matte svenska och engelska årkurs 6 och uppåt."

Tre nya områden per bana, med två nivåer var, i TILLAGG så att de läggs sist i
banorna och ingen elev får en ny nivå mitt i vägen:

    åk 8   Mönster och talföljder, Vinklar och månghörningar, Tabeller och diagram
    åk 9   Volym och begränsningsarea, Kombinatorik, Statistiska undersökningar

Områdena är sådant ur Lgr22:s centrala innehåll för 7–9 som banorna saknade:
mönster i talföljder uttryckta generellt (algebra), vinklar vid parallella
linjer och vinkelsumman i månghörningar (geometri), frekvenstabeller och
cirkeldiagram (statistik), volymen av kroppar, kombinatorik i konkreta
situationer, och hur statistiska undersökningar läggs upp och granskas.

Allt är Nextrums egna uppgifter, skrivna från grunden med AI och inte lästa av
någon som undervisar i ämnet. Filen står för sig och lånar inga hjälpare ur de
andra matematikfilerna: ett facit här ska inte kunna ändras av en ändring där.

Varje facit räknas ut här (bråk med Fraction, π som 3,14 där frågan säger det
och med math.pi för den som använder räknarens π-knapp), och de felaktiga
alternativen prövas mot samma räkning: ett fel facit lär barnet att det rätta
svaret är fel, och ett "fel" alternativ som råkar vara rätt gör samma sak.
"""
import itertools
import math
from fractions import Fraction as F

from grund import bana, niva, val, skriv, ordna, sant, para, tal

PI = F(314, 100)  # π ≈ 3,14: frågorna säger det.


def t(x):
    """Talet som svar: decimalkomma och '-' för minus (rättningen gör om − till -)."""
    if isinstance(x, F):
        x = int(x) if x.denominator == 1 else float(x)
    return tal(x)


def m(x):
    """Talet i en text eller bland alternativen, med riktigt minustecken."""
    return t(x).replace('-', '−')


def bv(s):
    """Ett tal eller bråk ur sin text: '3/4', '0,75', '−2', '10 000' → exakt värde."""
    s = s.replace('−', '-').replace(',', '.').replace(' ', '')
    if '/' in s:
        a, b = s.split('/')
        return F(a) / F(b)
    return F(s)


def brak(x, decimal=False):
    """Ett bråk som svar, med och utan mellanslag runt snedstrecket: bråk jämförs
    som text. Med decimal godtas också decimaltalet, när det går jämnt ut."""
    x = F(x)
    assert x.denominator > 1 and x > 0, x
    s = '%d/%d' % (x.numerator, x.denominator)
    svar = [s, s.replace('/', ' / ')]
    if decimal:
        n = x.denominator
        while n % 2 == 0:
            n //= 2
        while n % 5 == 0:
            n //= 5
        assert n == 1, x
        svar.append(t(x))
    return svar


def x_svar(v, var='x'):
    """Svaret på "Vad är x?": talet, och talet skrivet som x = 5 på fyra sätt."""
    s = t(v)
    return [s, '%s = %s' % (var, s), '%s=%s' % (var, s), '%s= %s' % (var, s), '%s =%s' % (var, s)]


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


def passar(f, punkter):
    """Formeln f stämmer med alla (n, y) i punkter."""
    return all(abs(f(n) - y) < 1e-9 for n, y in punkter)


def avrunda(x, decimaler=0):
    """Avrundning som i skolan, där 0,5 går uppåt (Pythons round avrundar till jämnt)."""
    x = F(x)
    q = F(10) ** decimaler
    return F(math.floor(x * q + F(1, 2))) / q


def pi_svar(k):
    """Svaren på en volym eller area som är k · π: med π ≈ 3,14 som frågan säger,
    exakt, med en decimal och avrundat till heltal, och samma avrundningar för den
    som använder räknarens π. Alla är rimliga svar på samma fråga."""
    v, vp = F(k) * PI, F(k * math.pi)
    svar = [t(v)]
    # Två decimaler också: räknarens π ger 282,74, och det är så de flesta skriver av den.
    for d in (2, 1, 0):
        for x in (v, vp):
            s = t(avrunda(x, d))
            if s not in svar:
                svar.append(s)
    assert len(svar) <= 12
    return svar


def foljd(tal_):
    return ', '.join(m(x) for x in tal_)


def okar_lika(tal_):
    return len({b - a for a, b in zip(tal_, tal_[1:])}) == 1


assert avrunda(F('904.5')) == 905 and avrunda(F('904.32')) == 904 and avrunda(F('2.25'), 1) == F('2.3')

# ================================================================ åk 8: mönster och talföljder

S1 = [4, 9, 14, 19]
S2 = [50, 44, 38, 32]
S4 = [2, 6, 18, 54]
S7 = [5, 9, 13, 17]
STICKOR1 = {1: 4, 2: 7, 3: 10}
OKAR = ['3, 6, 9, 12', '2, 4, 8, 16', '1, 4, 9, 16', '1, 2, 4, 7']
REGLER = [([3, 5, 7, 9], 'Lägg till 2', lambda x: x + 2), ([3, 6, 12, 24], 'Multiplicera med 2', lambda x: 2 * x),
          ([3, 6, 9, 12], 'Lägg till 3', lambda x: x + 3), ([24, 12, 6, 3], 'Dela med 2', lambda x: F(x, 2))]
for s_, _, f_ in REGLER:
    assert all(f_(a) == b for a, b in zip(s_, s_[1:]))
    # Varje talföljd passar bara sin egen regel, annars hade paren gått att byta.
    assert sum(all(g(a) == b for a, b in zip(s_, s_[1:])) for _, _, g in REGLER) == 1
INTE_MED = ['27', '35', '41', '43']
BYGG = [2, 5, 8, 11]
TIONDE = ['41', '45', '37', '40']
assert [5 + 4 * (n - 1) for n in (9, 10, 11)] == [37, 41, 45]   # det nionde, tionde och elfte talet
assert okar_lika(S1) and okar_lika(S2) and okar_lika(S7) and okar_lika(BYGG)
assert all(b == 3 * a for a, b in zip(S4, S4[1:]))
assert all(STICKOR1[n + 1] - STICKOR1[n] == 3 for n in (1, 2))
assert all(math.isqrt(x) ** 2 == x for x in (1, 4, 9, 16, 25))
assert all((x - 3) % 4 for x in (6, 9))   # de extra brickorna hör inte till talföljden 2, 5, 8 …

MA_AK8_MONSTER_1 = niva('ma-ak8-monster-1', 'Talföljder och nästa tal', 'Mönster och talföljder', [
    skriv('Vilket tal kommer härnäst i talföljden %s, …?' % foljd(S1), t(S1[-1] + (S1[1] - S1[0])),
          'Talen ökar med 5 varje gång: 9 − 4 = 5, 14 − 9 = 5 och 19 − 14 = 5. Nästa tal är 19 + 5 = 24.'),
    skriv('Vilket tal kommer härnäst i talföljden %s, …?' % foljd(S2), t(S2[-1] + (S2[1] - S2[0])),
          'Talen minskar med 6 varje gång: 50 − 6 = 44, 44 − 6 = 38 och 38 − 6 = 32. Nästa tal är 32 − 6 = 26.'),
    val('Vilken av talföljderna ökar med lika mycket varje gång?', OKAR,
        enda(OKAR, lambda a: okar_lika([int(x) for x in a.split(', ')])),
        '3, 6, 9, 12 ökar med 3 varje gång. I 2, 4, 8, 16 dubblas talen, 1, 4, 9, 16 är kvadrattal, och i '
        '1, 2, 4, 7 blir skillnaden 1 större varje gång.'),
    skriv('Vilket tal kommer härnäst i talföljden %s, …?' % foljd(S4), t(S4[-1] * 3),
          'Varje tal är 3 gånger talet före: 2 · 3 = 6, 6 · 3 = 18 och 18 · 3 = 54. Nästa tal är 54 · 3 = 162. '
          'Skillnaderna 4, 12 och 36 är inte lika, så det är ingen talföljd som ökar lika mycket varje gång.'),
    skriv('Ett mönster byggs av tändstickor. Figur 1 har 4 stickor, figur 2 har 7 stickor och figur 3 har 10 '
          'stickor, och varje ny figur har lika många stickor fler än figuren före. Hur många stickor har figur 5?',
          t(STICKOR1[1] + (5 - 1) * 3),
          'Varje figur har 3 stickor fler än figuren före. Figur 4 har 10 + 3 = 13 stickor och figur 5 har '
          '13 + 3 = 16 stickor.'),
    sant('Talen 1, 4, 9, 16 och 25 är kvadrattal.', True,
         'Ett kvadrattal är ett heltal gånger sig självt: 1 · 1 = 1, 2 · 2 = 4, 3 · 3 = 9, 4 · 4 = 16 och 5 · 5 = 25.'),
    val('Talföljden %s, … ökar med lika mycket varje gång. Vilket är det tionde talet i talföljden?' % foljd(S7),
        TIONDE, enda(TIONDE, lambda a: int(a) == S7[0] + 9 * (S7[1] - S7[0])),
        'Från det första till det tionde talet är det 9 steg, och varje steg är 4. Det tionde talet är '
        '5 + 9 · 4 = 5 + 36 = 41. Den som räknar 10 steg får 45, och 37 är det nionde talet.'),
    para('Para ihop talföljden med regeln för hur man kommer till nästa tal.',
         [(foljd(s_), r_) for s_, r_, _ in REGLER],
         'Titta på hur man kommer från ett tal till nästa. 3, 6, 9, 12 och 3, 6, 12, 24 börjar likadant, men i '
         'den andra dubblas talen. I 24, 12, 6, 3 halveras de.'),
    val('Talföljden 3, 7, 11, 15, … fortsätter på samma sätt. Vilket av talen finns INTE med i talföljden?',
        INTE_MED, enda(INTE_MED, lambda a: (int(a) - 3) % 4 != 0),
        'Talen i talföljden är 3 plus ett antal fyror. 27 − 3 = 24, 35 − 3 = 32 och 43 − 3 = 40 går att dela '
        'jämnt med 4, men 41 − 3 = 38 gör det inte. Talföljden går från 39 till 43.'),
    ordna('Bygg talföljden som börjar på 2, där varje tal är 3 mer än talet före. Använd fyra brickor i rätt '
          'ordning. Två brickor blir över.', [t(x) for x in BYGG], extra=['6', '9'],
          forklaring='2 + 3 = 5, 5 + 3 = 8 och 8 + 3 = 11. Talen 6 och 9 finns i 3:ans tabell, men inte i den här '
                     'talföljden, som börjar på 2.'),
], beskrivning='Hitta regeln i en talföljd eller ett mönster, fortsätt den och räkna ut ett tal längre fram.')

FORMLER1 = {'3n + 2': lambda n: 3 * n + 2, '5n + 3': lambda n: 5 * n + 3, 'n + 3': lambda n: n + 3,
            '3n + 5': lambda n: 3 * n + 5}
S_5_8 = [(1, 5), (2, 8), (3, 11), (4, 14)]
FORMLER4 = {'5n + 1': lambda n: 5 * n + 1, '6n': lambda n: 6 * n, 'n + 5': lambda n: n + 5,
            '5n + 6': lambda n: 5 * n + 6}
STICKOR2 = [(1, 6), (2, 11), (3, 16)]
FORMLER9 = {'34 − 4n': lambda n: 34 - 4 * n, '30 − 4n': lambda n: 30 - 4 * n, '4n + 26': lambda n: 4 * n + 26,
            '26 − 4n': lambda n: 26 - 4 * n}
S_30 = [(1, 30), (2, 26), (3, 22), (4, 18)]
PARA_FORMEL = [('2n + 1', lambda n: 2 * n + 1), ('3n − 1', lambda n: 3 * n - 1), ('n²', lambda n: n * n),
               ('5n', lambda n: 5 * n), ('4n − 3', lambda n: 4 * n - 3)]
TRIANGELTAL = [1, 3, 6, 10, 15]
assert [b - a for a, b in zip(TRIANGELTAL, TRIANGELTAL[1:])] == [2, 3, 4, 5]
assert (100 - 7) % 5 != 0 and 7 + 5 * 18 == 97 and 7 + 5 * 19 == 102
assert 4 * 20 - 1 == 79 and F(43 - 3, 2) == 20
assert passar(lambda n: 4 * n + 3, [(1, 7), (2, 11), (3, 15), (4, 19)])

MA_AK8_MONSTER_2 = niva('ma-ak8-monster-2', 'En formel för mönstret', 'Mönster och talföljder', [
    val('Talföljden 5, 8, 11, 14, … ökar med lika mycket varje gång. Vilken formel ger tal nummer n?',
        list(FORMLER1), enda(list(FORMLER1), lambda a: passar(FORMLER1[a], S_5_8)),
        'Talen ökar med 3, så formeln börjar med 3n. För n = 1 är 3n = 3, men talet är 5, så man lägger till 2: '
        '3n + 2. Kontroll: 3 · 4 + 2 = 14.'),
    skriv('Tal nummer n i en talföljd är 4n − 1. Vilket är tal nummer 20?', t(4 * 20 - 1),
          'Sätt in n = 20: 4 · 20 − 1 = 80 − 1 = 79.'),
    skriv('Figur nummer n i ett mönster består av 2n + 3 kvadrater. Vilket nummer har figuren som består av 43 '
          'kvadrater?', x_svar(F(43 - 3, 2), 'n') + ['figur 20', 'figur nummer 20', 'nummer 20', 'nr 20', 'figur nr 20'],
          'Lös ekvationen 2n + 3 = 43. Subtrahera 3: 2n = 40. Dela med 2: n = 20. Kontroll: 2 · 20 + 3 = 43.'),
    val('Ett mönster byggs av stickor. Figur 1 har 6 stickor, figur 2 har 11 stickor och figur 3 har 16 stickor, '
        'och ökningen är lika stor varje gång. Hur många stickor har figur n?',
        list(FORMLER4), enda(list(FORMLER4), lambda a: passar(FORMLER4[a], STICKOR2)),
        'Varje figur har 5 stickor fler, så formeln börjar med 5n. För n = 1 är 5n = 5, men figuren har 6 stickor, '
        'så formeln är 5n + 1. Kontroll: 5 · 3 + 1 = 16.'),
    sant('Talföljden 7, 12, 17, 22, … fortsätter på samma sätt, och talet 100 finns med i den.', (100 - 7) % 5 == 0,
         'Talen är 7 plus ett antal femmor, så de slutar alltid på 2 eller 7. 100 slutar på 0 och finns inte med: '
         'talföljden hoppar från 97 till 102.'),
    skriv('Talföljden %s, … fortsätter på samma sätt. Vilket tal kommer härnäst?' % foljd(TRIANGELTAL),
          t(TRIANGELTAL[-1] + 6),
          'Skillnaderna är 2, 3, 4 och 5, och de blir 1 större varje gång. Nästa skillnad är 6, så nästa tal är '
          '15 + 6 = 21.'),
    skriv('Figur 1 består av 1 liten kvadrat, figur 2 av 4 små kvadrater och figur 3 av 9 små kvadrater. Varje '
          'figur är en stor kvadrat med lika många små kvadrater på längden som figurens nummer. Hur många små '
          'kvadrater har figur 12?', t(12 * 12),
          'Figur n är n små kvadrater lång och n bred, alltså n · n = n² små kvadrater. Figur 12 har '
          '12 · 12 = 144.'),
    para('Para ihop formeln för tal nummer n med de tre första talen i talföljden.',
         [(f_, foljd([g(n) for n in (1, 2, 3)])) for f_, g in PARA_FORMEL],
         'Sätt in n = 1, 2 och 3 i formeln. Till exempel ger 3n − 1 talen 3 · 1 − 1 = 2, 3 · 2 − 1 = 5 och '
         '3 · 3 − 1 = 8, och 4n − 3 ger 1, 5 och 9.'),
    val('Talföljden 30, 26, 22, 18, … minskar med lika mycket varje gång. Vilken formel ger tal nummer n?',
        list(FORMLER9), enda(list(FORMLER9), lambda a: passar(FORMLER9[a], S_30)),
        'Talen minskar med 4, så formeln innehåller −4n. För n = 1 ska det bli 30, och 30 + 4 = 34, så formeln är '
        '34 − 4n. Kontroll: 34 − 4 · 4 = 18.'),
    ordna('Ordna stegen för att hitta en formel för tal nummer n i talföljden 7, 11, 15, 19, …',
          ['Talen ökar med 4 varje gång', 'Formeln börjar alltså med 4n',
           'För n = 1 är 4n = 4, men talet är 7', 'Lägg till 3: formeln är 4n + 3'],
          forklaring='Först tar man reda på hur mycket talen ökar, för det är talet framför n. Sedan jämför man '
                     'med det första talet för att se vad som ska läggas till. Kontroll: 4 · 4 + 3 = 19.'),
], beskrivning='Skriv en formel för tal nummer n i en talföljd eller ett mönster, använd formeln och räkna ut '
               'vilket nummer ett tal har.')

# ================================================================ åk 8: vinklar och månghörningar


def vinkelsumma(n):
    return (n - 2) * 180


SUMMAFORMLER = {'(n − 2) · 180°': lambda n: (n - 2) * 180, 'n · 180°': lambda n: n * 180,
                '(n − 1) · 180°': lambda n: (n - 1) * 180, 'n · 90°': lambda n: n * 90}
assert 2 * 70 + 40 == 180 and 2 * 30 + 10 == 70 and 180 - 130 == 50

MA_AK8_VINKLAR_1 = niva('ma-ak8-vinklar-1', 'Vinklar där linjer korsas', 'Vinklar och månghörningar', [
    val('Två räta linjer korsar varandra och bildar fyra vinklar. Vad kallas två vinklar som ligger mitt emot '
        'varandra?', ['Vertikalvinklar', 'Sidovinklar', 'Likbelägna vinklar', 'Raka vinklar'], 'Vertikalvinklar',
        'Vinklar som ligger mitt emot varandra i ett kryss kallas vertikalvinklar, och de är lika stora. Två '
        'vinklar som ligger bredvid varandra är sidovinklar.'),
    skriv('Två räta linjer korsar varandra. En av vinklarna är 50°. Hur stor är vinkeln mitt emot den? '
          'Svara i grader.', t(50),
          'Vinkeln mitt emot är en vertikalvinkel, och vertikalvinklar är lika stora. Den är också 50°.'),
    skriv('Två räta linjer korsar varandra. En av vinklarna är 130°. Hur stor är var och en av de två vinklarna '
          'bredvid den? Svara i grader.', t(180 - 130),
          'Vinklarna bredvid är sidovinklar till 130°-vinkeln, och sidovinklar är tillsammans 180°. '
          '180 − 130 = 50.'),
    sant('Vertikalvinklar är alltid lika stora.', True,
         'Två vertikalvinklar är båda sidovinklar till samma vinkel. Är den vinkeln v, är båda 180° − v.'),
    sant('Sidovinklar är alltid lika stora.', False,
         'Sidovinklar är tillsammans 180°, men de är lika stora bara när båda är 90°. Till exempel är 70° och 110° '
         'sidovinklar.'),
    skriv('Två parallella linjer skärs av en tredje linje. Vid den första parallella linjen bildas en vinkel på '
          '70°. Hur stor är den likbelägna vinkeln vid den andra parallella linjen? Svara i grader.', t(70),
          'Likbelägna vinklar ligger på samma sätt vid var sin av de parallella linjerna. När linjerna är '
          'parallella är likbelägna vinklar lika stora, så vinkeln är 70°.'),
    val('Två parallella linjer skärs av en tredje linje. Vilka två vinklar är alltid lika stora?',
        ['Två likbelägna vinklar', 'Två sidovinklar', 'En spetsig och en trubbig vinkel',
         'Två vinklar som tillsammans är 180°'], 'Två likbelägna vinklar',
        'Likbelägna vinklar vid parallella linjer är alltid lika stora. Sidovinklar, och andra vinklar som '
        'tillsammans är 180°, är lika stora bara om båda är 90°. En spetsig vinkel är mindre än 90° och en trubbig '
        'större, så de är aldrig lika.'),
    skriv('Två vinklar är sidovinklar. Den ena är 40° större än den andra. Hur stor är den minsta vinkeln? '
          'Svara i grader.', t(F(180 - 40, 2)),
          'Kalla den minsta vinkeln x. Då är x + (x + 40) = 180, så 2x = 140 och x = 70. Kontroll: '
          '70° + 110° = 180°.'),
    para('Para ihop ordet med vad det betyder.',
         [('Vertikalvinklar', 'Mitt emot varandra där två linjer korsas'),
          ('Sidovinklar', 'Bredvid varandra och tillsammans 180°'),
          ('Likbelägna vinklar', 'På samma ställe vid var sin av två parallella linjer'),
          ('Rak vinkel', 'En vinkel som är exakt 180°')],
         'Två sidovinklar bildar tillsammans en rak vinkel, alltså en rät linje. Vertikalvinklar och likbelägna '
         'vinklar vid parallella linjer är lika stora.'),
    skriv('Två räta linjer korsar varandra. En vinkel är (2x + 10)°, och vinkeln mitt emot den är 70°. Vad är x?',
          x_svar(F(70 - 10, 2)),
          'Vinklarna mitt emot varandra är vertikalvinklar och lika stora: 2x + 10 = 70. Då är 2x = 60 och x = 30.'),
], beskrivning='Vertikalvinklar, sidovinklar och likbelägna vinklar: räkna ut vinklar där två linjer korsas och där '
               'en linje skär två parallella linjer.')

REGELBUNDNA = [('Triangel', 3), ('Kvadrat', 4), ('Femhörning', 5), ('Sexhörning', 6)]
HORN = ['9 hörn', '7 hörn', '8 hörn', '10 hörn']
SUMMOR = [('Triangel', 3), ('Fyrhörning', 4), ('Femhörning', 5), ('Sexhörning', 6), ('Sjuhörning', 7)]
assert vinkelsumma(5) == 540 and F(vinkelsumma(6), 6) == 120 and vinkelsumma(5) - (100 + 110 + 120 + 95) == 115
assert F(1260, 180) + 2 == 9 and F(vinkelsumma(8), 8) == 135 and vinkelsumma(8) == 3 * vinkelsumma(4)
assert 180 - F(vinkelsumma(10), 10) == 36 == F(360, 10)

MA_AK8_VINKLAR_2 = niva('ma-ak8-vinklar-2', 'Vinkelsumman i en månghörning', 'Vinklar och månghörningar', [
    val('Vilken formel ger vinkelsumman i en månghörning med n hörn?', list(SUMMAFORMLER),
        enda(list(SUMMAFORMLER), lambda a: SUMMAFORMLER[a](3) == 180 and SUMMAFORMLER[a](4) == 360),
        'Diagonalerna från ett hörn delar en månghörning med n hörn i n − 2 trianglar, och varje triangel har '
        'vinkelsumman 180°. En triangel ger (3 − 2) · 180° = 180° och en fyrhörning (4 − 2) · 180° = 360°.'),
    skriv('Hur stor är vinkelsumman i en femhörning? Svara i grader.', t(vinkelsumma(5)),
          'En femhörning går att dela i 5 − 2 = 3 trianglar. 3 · 180° = 540°.'),
    skriv('En regelbunden sexhörning har sex lika långa sidor och sex lika stora vinklar. Hur stor är varje '
          'vinkel? Svara i grader.', t(F(vinkelsumma(6), 6)),
          'Vinkelsumman är (6 − 2) · 180° = 720°, och den delas lika på sex vinklar: 720° / 6 = 120°.'),
    skriv('Fyra av vinklarna i en femhörning är 100°, 110°, 120° och 95°. Hur stor är den femte vinkeln? '
          'Svara i grader.', t(vinkelsumma(5) - (100 + 110 + 120 + 95)),
          'Vinkelsumman i en femhörning är 540°. De fyra vinklarna är tillsammans 425°, så den femte är '
          '540° − 425° = 115°.'),
    val('Vinkelsumman i en månghörning är 1 260°. Hur många hörn har månghörningen?', HORN,
        enda(HORN, lambda a: vinkelsumma(int(a.split()[0])) == 1260),
        '(n − 2) · 180 = 1 260 ger n − 2 = 1 260 / 180 = 7, så n = 9. Det är en niohörning. 7 är antalet '
        'trianglar den går att dela i, inte antalet hörn.'),
    sant('Varje vinkel i en regelbunden åttahörning är 135°.', F(vinkelsumma(8), 8) == 135,
         'Vinkelsumman är (8 − 2) · 180° = 1 080°, och 1 080° / 8 = 135°.'),
    sant('Vinkelsumman i en åttahörning är dubbelt så stor som vinkelsumman i en fyrhörning.',
         vinkelsumma(8) == 2 * vinkelsumma(4),
         'En åttahörning har vinkelsumman (8 − 2) · 180° = 1 080° och en fyrhörning 360°. Det är tre gånger så '
         'mycket, för en åttahörning delas i 6 trianglar och en fyrhörning i 2.'),
    ordna_tal('Månghörningarna är regelbundna. Sätt dem i ordning efter hur stor varje vinkel är, med den minsta '
              'först.', [(namn, F(vinkelsumma(n), n)) for namn, n in REGELBUNDNA],
              'Vinklarna är 180° / 3 = 60°, 360° / 4 = 90°, 540° / 5 = 108° och 720° / 6 = 120°. Ju fler hörn en '
              'regelbunden månghörning har, desto större är varje vinkel.'),
    para('Para ihop månghörningen med dess vinkelsumma.', [(namn, '%s°' % t(vinkelsumma(n))) for namn, n in SUMMOR],
         'Vinkelsumman är (n − 2) · 180°, så den växer med 180° för varje hörn som läggs till: 180°, 360°, 540°, '
         '720° och 900°.'),
    skriv('En yttervinkel i en månghörning är sidovinkeln till en av månghörningens vinklar. Hur stor är varje '
          'yttervinkel i en regelbunden tiohörning? Svara i grader.', t(180 - F(vinkelsumma(10), 10)),
          'Varje vinkel i en regelbunden tiohörning är (10 − 2) · 180° / 10 = 144°. Yttervinkeln är sidovinkeln: '
          '180° − 144° = 36°. Det är samma som 360° / 10, för yttervinklarna är tillsammans ett helt varv.'),
], beskrivning='Vinkelsumman i trianglar, fyrhörningar och större månghörningar, och vinklarna i regelbundna '
               'månghörningar.')

# ================================================================ åk 8: tabeller och diagram

FRUKT = [('äpple', 10), ('banan', 8), ('päron', 5), ('apelsin', 2)]
FRUKT_ANTAL = sum(n for _, n in FRUKT)
FRUKT_TEXT = '%d elever fick välja sin favoritfrukt: 10 valde äpple, 8 banan, 5 päron och 2 apelsin.' % FRUKT_ANTAL
assert FRUKT_ANTAL == 25 and dict(FRUKT)['äpple'] == 10 and dict(FRUKT)['banan'] == 8
LANGDER = [147, 152, 155, 158, 159, 161, 167, 171, 174, 176]
INTERVALL = [(140, 149), (150, 159), (160, 169), (170, 179)]
LANGD_FREKV = [sum(1 for x in LANGDER if a <= x <= b) for a, b in INTERVALL]
assert sum(LANGD_FREKV) == len(LANGDER) == 10 and len(set(LANGD_FREKV)) == 4
BUSS = ['90°', '25°', '15°', '45°']
NEJ_ALT = ['30', '120', '26', '12']
RELFREKV = [('0,3', F(3, 10)), ('1/4', F(1, 4)), ('28 %', F(28, 100)), ('2/5', F(2, 5))]
KVART = ['1/4', '1/25', '2/5', '25/10']

MA_AK8_DIAGRAM_1 = niva('ma-ak8-diagram-1', 'Frekvens och relativ frekvens', 'Tabeller och diagram', [
    val('Vad visar frekvensen för ett svar i en frekvenstabell?',
        ['Hur många gånger svaret förekommer', 'Hur stor andel av alla svar det är', 'Det största värdet i tabellen',
         'Medelvärdet av alla svar'], 'Hur många gånger svaret förekommer',
        'Frekvensen är ett antal: hur många som gav just det svaret. Andelen av alla svar kallas relativ frekvens.'),
    skriv(FRUKT_TEXT + ' Hur stor är den relativa frekvensen för äpple? Svara i procent.',
          t(F(dict(FRUKT)['äpple'], FRUKT_ANTAL) * 100),
          'Relativ frekvens är frekvensen delad med antalet svar: 10 / 25 = 0,40, och det är 40 %.'),
    skriv(FRUKT_TEXT + ' Hur stor är den relativa frekvensen för banan? Svara som ett decimaltal.',
          t(F(dict(FRUKT)['banan'], FRUKT_ANTAL)),
          'Dela frekvensen med antalet svar: 8 / 25 = 0,32. Det är samma sak som 32 %.'),
    skriv('I en undersökning med 40 svar var den relativa frekvensen för svaret Ja 35 %. Hur många svarade Ja?',
          t(F(35, 100) * 40),
          'Antalet är andelen gånger antalet svar: 0,35 · 40 = 14.'),
    val('I en frekvenstabell har svaret Nej frekvensen 6 och den relativa frekvensen 20 %. Hur många svar finns '
        'det sammanlagt i tabellen?', NEJ_ALT, enda(NEJ_ALT, lambda a: F(6, int(a)) == F(20, 100)),
        '6 svar är 20 %, alltså en femtedel av alla svar. Då är alla svar 5 · 6 = 30. Kontroll: 6 / 30 = 0,2 = 20 %.'),
    sant('Om man räknar exakt, utan att avrunda, är summan av alla relativa frekvenser i en frekvenstabell 100 %.',
         True,
         'Varje svar räknas i exakt en rad, så alla rader tillsammans är hela gruppen, 100 %. Med avrundade procent '
         'kan summan bli 99 % eller 101 %.'),
    para('Tio elever mätte sin längd i centimeter: %s och %s. Para ihop längdintervallet med frekvensen, alltså '
         'antalet elever i intervallet.' % (', '.join(t(x) for x in LANGDER[:-1]), t(LANGDER[-1])),
         [('%d–%d cm' % ab, t(n)) for ab, n in zip(INTERVALL, LANGD_FREKV)],
         'Räkna talen i varje intervall: 147 är ensam under 150, 152, 155, 158 och 159 är fyra, 161 och 167 är två, '
         'och 171, 174 och 176 är tre. Tillsammans är det 10.'),
    val('Av 60 elever åker 15 buss till skolan. Hur stor blir bussens sektor i ett cirkeldiagram över alla 60 '
        'eleverna?', BUSS, enda(BUSS, lambda a: int(a[:-1]) == F(15, 60) * 360),
        '15 av 60 är en fjärdedel, 25 %. En fjärdedel av hela cirkeln är 360° / 4 = 90°. 25° får den som tar '
        'procenten som grader.'),
    val('Den relativa frekvensen för ett svar är 0,25. Vilket bråk är samma andel?', KVART,
        enda(KVART, lambda a: bv(a) == F(1, 4)),
        '0,25 är 25 hundradelar, alltså 25/100. Förkorta med 25, så blir det 1/4.'),
    ordna_tal('Fyra svar i en undersökning har de här relativa frekvenserna. Sätt dem i ordning, med den minsta '
              'först.', RELFREKV,
              'Skriv alla som decimaltal: 1/4 = 0,25, 28 % = 0,28, 0,3 = 0,30 och 2/5 = 0,40.'),
], beskrivning='Frekvens och relativ frekvens i tabeller, längder i intervall, och att räkna mellan andel och antal.')

MAL = {0: 3, 1: 4, 2: 2, 3: 1}
MAL_MEDEL = F(sum(k * n for k, n in MAL.items()), sum(MAL.values()))
assert MAL_MEDEL == F(11, 10)
HUSDJUR = {0: 6, 1: 9, 2: 4, 3: 1}
HUSDJUR_ALT = ['1 husdjur', '9 husdjur', '0 husdjur', '2 husdjur']
BADHUS = ['108°', '60°', '120°', '30°']
assert F(72, 360) * 30 == 6 and F(35, 100) * 360 == 126 and F(13 - 4, 4) == F(9, 4)
assert F(360, 50) == F('7.2') and F(360, 40) == 9

MA_AK8_DIAGRAM_2 = niva('ma-ak8-diagram-2', 'Cirkeldiagram och andra diagram', 'Tabeller och diagram', [
    para('Para ihop diagrammet med det som det passar bäst att visa.',
         [('Cirkeldiagram', 'Hur en helhet är fördelad på delar'),
          ('Linjediagram', 'Hur något förändras över tid'),
          ('Stapeldiagram', 'Antal i olika grupper bredvid varandra')],
         'Ett cirkeldiagram är en helhet delad i tårtbitar. Ett linjediagram binder ihop mätningar i tidsordning, så '
         'att förändringen syns. Staplar bredvid varandra gör det lätt att jämföra grupper.'),
    skriv('I ett cirkeldiagram över 30 elever är en sektor 72°. Hur många elever visar sektorn?',
          t(F(72, 360) * 30),
          '72° av 360° är 72 / 360 = 0,2, alltså en femtedel av cirkeln. En femtedel av 30 elever är 6 elever.'),
    sant('I ett cirkeldiagram är alla sektorers vinklar tillsammans 360°.', True,
         'Sektorerna fyller hela cirkeln, och ett helt varv är 360°.'),
    skriv('Ett svar fick 35 % av rösterna. Hur många grader blir svarets sektor i ett cirkeldiagram?',
          t(F(35, 100) * 360),
          'Sektorns vinkel är andelen gånger 360°: 0,35 · 360° = 126°.'),
    skriv('Ett lag gjorde 0 mål i 3 matcher, 1 mål i 4 matcher, 2 mål i 2 matcher och 3 mål i 1 match. Hur många '
          'mål gjorde laget i medeltal per match?', t(MAL_MEDEL),
          'Multiplicera varje antal mål med antalet matcher och lägg ihop: 0 · 3 + 1 · 4 + 2 · 2 + 3 · 1 = 11 mål. '
          'Matcherna är 3 + 4 + 2 + 1 = 10. Medelvärdet är 11 / 10 = 1,1 mål per match.'),
    val('En frekvenstabell visar hur många husdjur eleverna i en grupp har: 6 elever har 0 husdjur, 9 elever har 1 '
        'husdjur, 4 elever har 2 husdjur och 1 elev har 3 husdjur. Vad är typvärdet?', HUSDJUR_ALT,
        enda(HUSDJUR_ALT, lambda a: int(a.split()[0]) == max(HUSDJUR, key=HUSDJUR.get)),
        'Typvärdet är det värde som flest har. Flest elever, 9 stycken, har 1 husdjur, så typvärdet är 1 husdjur. '
        'Talet 9 är frekvensen, inte värdet.'),
    # Mätt vid samma klockslag varje dag: annars kunde måndag morgon till fredag kväll vara 5 dygn.
    skriv('Ett linjediagram visar en plantas höjd, mätt klockan 8 varje morgon. På måndagen var plantan 4 cm hög och '
          'på fredagen samma vecka 13 cm hög. Hur många centimeter växte den i genomsnitt per dygn från mätningen på '
          'måndagen till mätningen på fredagen?',
          [t(F(13 - 4, 4))] + brak(F(13 - 4, 4)),
          'Plantan växte 13 − 4 = 9 cm. Från måndag morgon till fredag morgon är det 4 dygn, inte 5: måndag–tisdag, '
          'tisdag–onsdag, onsdag–torsdag och torsdag–fredag. Den växte 9 / 4 = 2,25 cm per dygn.'),
    sant('I ett cirkeldiagram över 40 personer motsvarar varje person 8°.', F(360, 40) == 8,
         'Hela cirkeln är 360°, och 360° / 40 = 9°. Varje person motsvarar alltså 9°, inte 8°.'),
    val('En klass med 20 elever röstade om en utflykt: 10 ville till en djurpark, 6 till ett badhus och 4 till ett '
        'museum. Hur stor blir badhusets sektor i ett cirkeldiagram?', BADHUS,
        enda(BADHUS, lambda a: int(a[:-1]) == F(6, 20) * 360),
        '6 av 20 är 0,3, alltså 30 %. Sektorn är 0,3 · 360° = 108°. 30° får den som tar procenten som grader.'),
    ordna('Ordna stegen för att rita ett cirkeldiagram över svaren i en undersökning.',
          ['Räkna hur många som gav varje svar', 'Dela varje antal med antalet svar',
           'Multiplicera varje andel med 360°', 'Rita varje sektor med en gradskiva'],
          forklaring='Först behövs antalen, sedan andelarna av alla svar. Andelen gånger 360° ger sektorns vinkel, '
                     'och först då går det att rita.'),
], beskrivning='Cirkeldiagram, linjediagram och frekvenstabeller: läs av, räkna ut sektorer, medelvärde och typvärde, '
               'och välj rätt diagram.')

# ================================================================ åk 9: volym och begränsningsarea

FORMEL_PRISMA = {'V = B · h': lambda B, h: B * h, 'V = B · h / 3': lambda B, h: B * h / 3,
                 'V = B + h': lambda B, h: B + h, 'V = 2B · h': lambda B, h: 2 * B * h}
TUNNA = [36, F(12), 24, 360]   # π · r² · h, π · r · h, 2 · π · r · h och fel enhet, med r = 3 dm och h = 4 dm
TUNNA_ALT = ['%s liter' % t(k * PI) for k in TUNNA]
RATBLOCK_ALT = ['62 cm²', '30 cm²', '31 cm²', '10 cm²']
assert F(6 * 4, 2) * 10 == 120 and 80 * 50 * 60 == 240000 and 6 * 4 * 4 == 96
assert 2 * (5 * 3 + 5 * 2 + 3 * 2) == 62 and 5 * 3 * 2 == 30
# 1 dm³ = 1 liter, så allt räknas i liter.
LITER = {'1 dm³': F(1), '1 cm³': F(1, 1000), '1 m³': F(1000), '100 cm³': F(100, 1000)}
ENHET = {'1 liter': F(1), '1 milliliter': F(1, 1000), '1 000 liter': F(1000), '1 deciliter': F(1, 10)}
assert sorted(LITER.values()) == sorted(ENHET.values()) and len(set(LITER.values())) == 4

MA_AK9_VOLYM_1 = niva('ma-ak9-volym-1', 'Prisma och cylinder', 'Volym och begränsningsarea', [
    val('Vilken formel ger volymen V av ett prisma eller en cylinder, där B är basytans area och h är höjden?',
        list(FORMEL_PRISMA), enda(list(FORMEL_PRISMA), lambda a: FORMEL_PRISMA[a](F(12), F(10)) == 120),
        'Ett prisma och en cylinder har samma tvärsnitt hela vägen upp, så volymen är basytan gånger höjden. '
        'B · h / 3 gäller för en pyramid och en kon.'),
    skriv('Ett prisma har en triangel som basyta. Triangeln har basen 6 cm och höjden 4 cm, och prismat är 10 cm '
          'långt. Hur stor är prismats volym? Svara i cm³.', t(F(6 * 4, 2) * 10),
          'Basytan är triangelns area: 6 · 4 / 2 = 12 cm². Volymen är basytan gånger längden: 12 · 10 = 120 cm³.'),
    skriv('En cylinder har radien 3 cm och höjden 10 cm. Hur stor är volymen? Räkna med π ≈ 3,14 och svara i cm³.',
          pi_svar(3 * 3 * 10),
          'Basytan är en cirkel: π · r² = 3,14 · 3 · 3 = 28,26 cm². Volymen är basytan gånger höjden: '
          '28,26 · 10 = 282,6 cm³.'),
    skriv('En vattentank har formen av ett rätblock som är 80 cm långt, 50 cm brett och 60 cm högt. Hur många liter '
          'rymmer den?', t(F(80 * 50 * 60, 1000)),
          'Räkna i decimeter, för 1 dm³ är 1 liter: 8 dm · 5 dm · 6 dm = 240 dm³ = 240 liter. I centimeter blir det '
          '240 000 cm³, och 1 000 cm³ är 1 liter.'),
    skriv('En kub har sidan 4 cm. Hur stor är kubens begränsningsarea? Svara i cm².', t(6 * 4 * 4),
          'Begränsningsarean är arean av alla ytor runt kroppen. En kub har 6 kvadratiska sidoytor på '
          '4 · 4 = 16 cm² var, alltså 6 · 16 = 96 cm².'),
    val('Ett rätblock är 5 cm långt, 3 cm brett och 2 cm högt. Hur stor är dess begränsningsarea?', RATBLOCK_ALT,
        enda(RATBLOCK_ALT, lambda a: int(a.split()[0]) == 2 * (5 * 3 + 5 * 2 + 3 * 2)),
        'Rätblocket har tre par lika stora ytor: 5 · 3 = 15, 5 · 2 = 10 och 3 · 2 = 6 cm². Två av varje: '
        '2 · (15 + 10 + 6) = 62 cm². 30 är volymen i cm³, och 31 får den som bara räknar ytorna en gång.'),
    val('En cylinderformad tunna har radien 3 dm och höjden 4 dm. Hur många liter rymmer den? Räkna med π ≈ 3,14.',
        TUNNA_ALT, enda(TUNNA_ALT, lambda a: bv(a.split(' liter')[0]) == 3 * 3 * 4 * PI),
        'Volymen är π · r² · h = 3,14 · 9 · 4 = 113,04 dm³, och 1 dm³ är 1 liter. 75,36 är mantelytan 2 · π · r · h '
        'i dm², och 37,68 får den som glömmer att radien ska i kvadrat.'),
    sant('Om man fördubblar höjden på en cylinder och behåller radien blir volymen dubbelt så stor.', True,
         'Volymen är π · r² · h. Basytan är densamma, och dubbel höjd ger dubbelt så många lager av den.'),
    sant('Om man fördubblar radien på en cylinder och behåller höjden blir volymen dubbelt så stor.',
         (2 * 1) ** 2 == 2,
         'Radien står i kvadrat i π · r² · h. Dubbel radie ger 2² = 4 gånger så stor basyta och därför 4 gånger så '
         'stor volym.'),
    para('Para ihop volymen med samma mängd i liter, deciliter eller milliliter.',
         [(v_, enda(list(ENHET), lambda e, x=x_: ENHET[e] == x)) for v_, x_ in LITER.items()],
         'En liter är en kub med kanten 1 dm. En kub med kanten 1 cm är en tusendel av den, en milliliter, och '
         '100 cm³ är en tiondel, en deciliter. 1 m³ är 10 · 10 · 10 = 1 000 dm³.'),
], beskrivning='Volym och begränsningsarea för rätblock, prismor och cylindrar, och att byta mellan kubikenheter och '
               'liter.')

PYRAMID_ALT = ['6 cm', '2 cm', '20 cm', '0,5 cm']
KONFORMLER = [('Rätblock', 'l · b · h'), ('Cylinder', 'π · r² · h'), ('Kon', 'π · r² · h / 3'),
              ('Klot', '4 · π · r³ / 3')]
KROPPAR = [('En kub med sidan 4 cm', 4 ** 3), ('Ett klot med radien 2 cm', 4 * math.pi * 2 ** 3 / 3),
           ('En cylinder med radien 2 cm och höjden 5 cm', math.pi * 2 ** 2 * 5),
           ('En kon med radien 3 cm och höjden 6 cm', math.pi * 3 ** 2 * 6 / 3)]
KROPPAR_STORST = max(KROPPAR, key=lambda p: p[1])
assert KROPPAR_STORST[0] == 'En kub med sidan 4 cm' and sorted(p[1] for p in KROPPAR)[-2] < 63
BURK = [2 * 25 + 2 * 5 * 10, 25 * 10, 25 + 2 * 5 * 10, 2 * 5 * 10]   # två cirklar och mantel, volym, ett lock, mantel
BURK_ALT = ['%s cm²' % t(k * PI) for k in BURK]
assert F(6 * 6 * 5, 3) == 60 and F(3 * 60, 30) == 6 and F(4 * 6 ** 3, 3) == 288
assert 3 * 3 * 5 * PI / 3 == F('47.1') and (2 * 2 * 6 + F(2 * 2 * 3, 3)) * PI == F('87.92')

MA_AK9_VOLYM_2 = niva('ma-ak9-volym-2', 'Pyramid, kon och klot', 'Volym och begränsningsarea', [
    val('En kon och en cylinder har samma basyta och samma höjd. Hur stor är konens volym jämfört med cylinderns?',
        ['En tredjedel', 'Hälften', 'Lika stor', 'Dubbelt så stor'], 'En tredjedel',
        'Konens volym är π · r² · h / 3 och cylinderns π · r² · h. Det ryms tre koner i en cylinder med samma bas '
        'och höjd. Samma sak gäller en pyramid och ett prisma.'),
    skriv('En pyramid har en kvadratisk basyta med sidan 6 cm, och pyramidens höjd är 5 cm. Hur stor är volymen? '
          'Svara i cm³.', t(F(6 * 6 * 5, 3)),
          'Basytan är 6 · 6 = 36 cm². Volymen är basytan gånger höjden delat med 3: 36 · 5 / 3 = 60 cm³.'),
    skriv('En kon har radien 3 cm och höjden 5 cm. Hur stor är volymen? Räkna med π ≈ 3,14 och svara i cm³.',
          pi_svar(F(3 * 3 * 5, 3)),
          'V = π · r² · h / 3 = 3,14 · 9 · 5 / 3 = 3,14 · 15 = 47,1 cm³.'),
    skriv('Ett klot har diametern 12 cm. Hur stor är volymen? Räkna med π ≈ 3,14 och avrunda till hela cm³.',
          pi_svar(F(4 * 6 ** 3, 3)),
          'Radien är hälften av diametern, 6 cm. V = 4 · π · r³ / 3 = 4 · 3,14 · 216 / 3 = 904,32, alltså ungefär '
          '904 cm³. Med räknarens π blir det 905.'),
    val('En pyramid har basytan 30 cm² och volymen 60 cm³. Hur hög är pyramiden?', PYRAMID_ALT,
        enda(PYRAMID_ALT, lambda a: F(30) * bv(a.split()[0]) / 3 == 60),
        'V = B · h / 3 ger 60 = 30 · h / 3 = 10 · h, så h = 6 cm. 2 cm får den som glömmer att dela med 3.'),
    sant('Om radien i ett klot fördubblas blir volymen 8 gånger så stor.', 2 ** 3 == 8,
         'Radien står i kubik i 4 · π · r³ / 3. Dubbel radie ger 2³ = 2 · 2 · 2 = 8 gånger så stor volym.'),
    para('Para ihop kroppen med formeln för dess volym. Här är r radien, h höjden, l längden och b bredden.',
         KONFORMLER,
         'Rätblocket är längd gånger bredd gånger höjd, och cylindern är basytan π · r² gånger höjden. Konen är en '
         'tredjedel av cylindern. Ett klot har bara ett mått, radien, så dess volym har r³.'),
    skriv('En silo består av en cylinder med en kon ovanpå. Cylindern och konen har båda radien 2 m. Cylindern är '
          '6 m hög och konen 3 m hög. Hur stor är silons volym? Räkna med π ≈ 3,14 och svara i m³.',
          pi_svar(2 * 2 * 6 + F(2 * 2 * 3, 3)),
          'Cylindern: 3,14 · 4 · 6 = 75,36 m³. Konen: 3,14 · 4 · 3 / 3 = 12,56 m³. Tillsammans är det '
          '75,36 + 12,56 = 87,92 m³.'),
    val('Vilken av kropparna har störst volym?', [k for k, _ in KROPPAR], KROPPAR_STORST[0],
        'Kuben: 4 · 4 · 4 = 64 cm³. Cylindern: π · 4 · 5 ≈ 62,8 cm³. Konen: π · 9 · 6 / 3 ≈ 56,5 cm³. Klotet: '
        '4 · π · 8 / 3 ≈ 33,5 cm³.'),
    val('En cylinderformad burk har radien 5 cm och höjden 10 cm. Hur stor är burkens begränsningsarea, med botten '
        'och lock? Räkna med π ≈ 3,14.', BURK_ALT,
        enda(BURK_ALT, lambda a: bv(a.split(' cm²')[0]) == (2 * 25 + 2 * 5 * 10) * PI),
        'Botten och lock är två cirklar på 3,14 · 25 = 78,5 cm² var. Mantelytan är en rektangel med höjden 10 cm och '
        'längden 2 · 3,14 · 5 = 31,4 cm, alltså 314 cm². Sammanlagt 157 + 314 = 471 cm². 785 är volymen i cm³.'),
], beskrivning='Volymen av pyramider, koner och klot, kroppar byggda av flera delar och cylinderns '
               'begränsningsarea.')

# ================================================================ åk 9: kombinatorik


def antal_ordningar(n, k=None):
    return len(list(itertools.permutations(range(n), k)))


def antal_grupper(n, k):
    return len(list(itertools.combinations(range(n), k)))


KODER = ['10 000', '40', '5040', '9999']
TVASIFFRIGA = ['12', '16', '8', '6']
assert len({a * 10 + b for a, b in itertools.permutations([1, 2, 3, 4], 2)}) == 12
assert 3 * 5 * 2 == 30 and antal_ordningar(4) == 24 and antal_ordningar(8, 3) == 336 and 5 * 10 * 10 == 500
assert len(list(itertools.product(range(10), repeat=4))) == 10000 and antal_ordningar(10, 4) == 5040
assert antal_ordningar(5) == 120 != 5 + 4 + 3 + 2 + 1 and 4 * 6 == 24
SITUATIONER = [('Ordna 3 olika böcker i en rad', antal_ordningar(3)),
               ('Välja en av 3 tröjor och en av 5 byxor', 3 * 5),
               ('Singla ett mynt 3 gånger', 2 ** 3),
               ('Ordna 4 olika bokstäver i en rad', antal_ordningar(4))]
assert len({n for _, n in SITUATIONER}) == 4
ORDNA_ANTAL = [('Ordna 4 personer i en kö', antal_ordningar(4)), ('Singla ett mynt 5 gånger', 2 ** 5),
               ('Kasta en tärning 2 gånger', 6 * 6),
               ('Välja ordförande och sekreterare bland 7 personer', antal_ordningar(7, 2))]

MA_AK9_KOMBINATORIK_1 = niva('ma-ak9-kombinatorik-1', 'Multiplikationsprincipen och ordning', 'Kombinatorik', [
    skriv('En restaurang har 3 förrätter, 5 varmrätter och 2 efterrätter. Hur många olika middagar med en förrätt, '
          'en varmrätt och en efterrätt går att välja?', t(3 * 5 * 2),
          'Varje förrätt kan kombineras med 5 varmrätter, och varje sådan kombination med 2 efterrätter: '
          '3 · 5 · 2 = 30.'),
    skriv('På hur många olika sätt kan 4 personer ställa sig i en kö?', t(antal_ordningar(4)),
          'Den första platsen kan tas av 4 personer, den andra av de 3 som är kvar, sedan 2 och till sist 1: '
          '4 · 3 · 2 · 1 = 24.'),
    val('Ett cykellås har en kod med fyra siffror, och varje siffra kan vara 0–9. Hur många olika koder finns det?',
        KODER, enda(KODER, lambda a: bv(a) == 10 ** 4),
        'Varje siffra kan väljas på 10 sätt, och siffrorna får upprepas: 10 · 10 · 10 · 10 = 10 000. Koderna går '
        'från 0000 till 9999. 5040 får den som inte låter någon siffra upprepas.'),
    skriv('Åtta löpare springer ett lopp, och alla får olika tider. På hur många olika sätt kan guld, silver och '
          'brons fördelas?', t(antal_ordningar(8, 3)),
          'Guldet kan gå till 8 löpare, silvret till de 7 som är kvar och bronset till de 6 som är kvar sedan: '
          '8 · 7 · 6 = 336.'),
    val('Hur många olika tvåsiffriga tal kan bildas av siffrorna 1, 2, 3 och 4, om samma siffra inte får användas två '
        'gånger i ett tal?', TVASIFFRIGA, enda(TVASIFFRIGA, lambda a: int(a) == 4 * 3),
        'Tiotalssiffran kan väljas på 4 sätt och entalssiffran på de 3 som är kvar: 4 · 3 = 12. 16 får den som '
        'låter siffrorna upprepas, och 6 den som räknar 12 och 21 som samma tal.'),
    sant('Fem olika böcker kan ställas i en rad i en hylla på 5 + 4 + 3 + 2 + 1 = 15 olika sätt.',
         antal_ordningar(5) == 15,
         'Antalen ska multipliceras, inte adderas: den första platsen på 5 sätt, nästa på 4 och så vidare. '
         '5 · 4 · 3 · 2 · 1 = 120 sätt.'),
    para('Para ihop situationen med antalet möjligheter.', [(s_, t(n_)) for s_, n_ in SITUATIONER],
         '3 · 2 · 1 = 6, 3 · 5 = 15, 2 · 2 · 2 = 8 och 4 · 3 · 2 · 1 = 24. Varje val multipliceras med antalet val '
         'i nästa steg.'),
    skriv('En kod består av en av bokstäverna A, B, C, D och E, följd av två siffror som var och en kan vara 0–9. Hur '
          'många olika koder finns det?', t(5 * 10 * 10),
          'Bokstaven kan väljas på 5 sätt och varje siffra på 10 sätt: 5 · 10 · 10 = 500.'),
    ordna_tal('Sätt situationerna i ordning efter antalet möjligheter, med det minsta först.', ORDNA_ANTAL,
              '4 · 3 · 2 · 1 = 24, 2 · 2 · 2 · 2 · 2 = 32, 6 · 6 = 36 och 7 · 6 = 42. Ordföranden kan väljas på 7 '
              'sätt och sekreteraren sedan på 6.'),
    sant('Den som ska välja en av 4 förrätter och en av 6 varmrätter har 24 olika kombinationer att välja mellan.',
         4 * 6 == 24,
         'Varje förrätt kan kombineras med var och en av de 6 varmrätterna: 4 · 6 = 24. Den som adderar får 10, '
         'och det är för få.'),
], beskrivning='Räkna möjligheter med multiplikationsprincipen: kombinationer, koder och på hur många sätt saker '
               'kan ordnas.')

PAR5 = ['10', '20', '25', '5']
LAG3 = ['20', '120', '18', '216']
assert antal_grupper(6, 2) == 15 and antal_grupper(8, 2) == 28 and antal_grupper(7, 2) == 21
assert antal_ordningar(5, 2) == 2 * antal_grupper(5, 2) and antal_grupper(6, 3) == 20
assert antal_grupper(6, 2) - 6 == 9 == 6 * (6 - 3) // 2 and antal_grupper(6, 2) == antal_grupper(6, 4)
assert antal_grupper(5, 2) == 10

MA_AK9_KOMBINATORIK_2 = niva('ma-ak9-kombinatorik-2', 'När ordningen inte spelar någon roll', 'Kombinatorik', [
    skriv('Sex personer träffas, och alla skakar hand med alla andra en gång. Hur många handslag blir det?',
          t(antal_grupper(6, 2)),
          'Varje person skakar hand med 5 andra, och 6 · 5 = 30. Men då räknas varje handslag två gånger, en gång för '
          'var och en av de två som skakar hand. 30 / 2 = 15.'),
    val('Två av fem elever ska väljas till elevrådet, och de två platserna är likadana. Hur många olika par kan '
        'väljas?', PAR5, enda(PAR5, lambda a: int(a) == antal_grupper(5, 2)),
        '5 · 4 = 20 räknar varje par två gånger, till exempel både Alma och Noah och Noah och Alma. 20 / 2 = 10 par.'),
    skriv('I en serie med 8 lag möter varje lag alla andra lag exakt en gång. Hur många matcher spelas?',
          t(antal_grupper(8, 2)),
          'Varje lag spelar mot 7 andra: 8 · 7 = 56. Varje match har två lag och räknas då två gånger, så det blir '
          '56 / 2 = 28 matcher.'),
    sant('Att välja en ordförande och en kassör bland 5 personer ger dubbelt så många möjligheter som att välja 2 av '
         'de 5 till två likadana platser.', antal_ordningar(5, 2) == 2 * antal_grupper(5, 2),
         'Med olika roller är det 5 · 4 = 20 möjligheter. Med likadana platser är Alma och Noah samma val som Noah '
         'och Alma, så det blir 20 / 2 = 10.'),
    skriv('En pizzeria låter dig välja 2 olika pålägg av 7. Hur många olika kombinationer av två pålägg finns det?',
          t(antal_grupper(7, 2)),
          'Det första pålägget kan väljas på 7 sätt och det andra på 6: 7 · 6 = 42. Ordningen spelar ingen roll på en '
          'pizza, så varje kombination har räknats två gånger. 42 / 2 = 21.'),
    val('På hur många sätt kan man välja 3 elever av 6 till ett lag, om ordningen inte spelar någon roll?', LAG3,
        enda(LAG3, lambda a: int(a) == antal_grupper(6, 3)),
        'Med ordning blir det 6 · 5 · 4 = 120. Varje grupp om tre kan ordnas på 3 · 2 · 1 = 6 sätt, så antalet '
        'grupper är 120 / 6 = 20.'),
    skriv('Två av fem elever lottas till ett uppdrag. Bland de fem finns Alma och Noah. Hur stor är sannolikheten '
          'att just Alma och Noah blir lottade? Svara som ett bråk eller ett decimaltal.',
          # 2/20 är svaret för den som räknar med ordning: 2/5 att en av dem lottas först, 1/4 att den andra
          # lottas sedan. Bråk jämförs som text, så det oförkortade måste stå med.
          brak(F(1, antal_grupper(5, 2)), decimal=True) + ['%d/%d' % (2, antal_ordningar(5, 2)),
                                                          '%d / %d' % (2, antal_ordningar(5, 2))],
          'Det finns 5 · 4 / 2 = 10 par, och alla är lika troliga. Ett av dem är Alma och Noah, så sannolikheten är '
          '1/10. Med ordning blir det 2/5 · 1/4 = 2/20, och det är samma sak.'),
    skriv('En diagonal i en månghörning är en sträcka mellan två hörn som inte ligger bredvid varandra. Hur många '
          'diagonaler har en sexhörning?', t(antal_grupper(6, 2) - 6),
          'Mellan 6 hörn går det att dra 6 · 5 / 2 = 15 sträckor. 6 av dem är sexhörningens sidor, så '
          '15 − 6 = 9 är diagonaler.'),
    ordna('Ordna stegen för att räkna ut hur många handslag det blir när 5 personer skakar hand med alla andra en '
          'gång.', ['Varje person skakar hand med 4 andra', '5 · 4 = 20 räknar varje handslag två gånger',
                    'Dela med 2: 20 / 2 = 10 handslag'],
          forklaring='Först räknar man handslagen från varje persons håll. Då har varje handslag räknats två gånger, '
                     'en gång för var och en av de två, och därför delar man med 2.'),
    sant('Det finns lika många sätt att välja ut 2 elever av 6 som att välja ut 4 elever av 6.',
         antal_grupper(6, 2) == antal_grupper(6, 4),
         'Att välja de 2 som ska med är samma sak som att välja de 4 som inte ska med. Båda går på 15 sätt.'),
], beskrivning='Välja grupper när ordningen inte spelar någon roll: handslag, matcher och lag, och sannolikheter som '
               'räknas med kombinatorik.')

# ================================================================ åk 9: statistiska undersökningar

LEDANDE = ['Vad tycker du om skolmaten?', 'Visst är skolmaten för dålig?', 'Håller du med om att skolmaten är god?',
           'Tycker du också att skolmaten är för salt?']
URVAL = ['30 elever som lottas från hela skolans elevlista', 'De 30 eleverna i hens egen klass',
         'De 30 elever som först kommer till matsalen en dag', 'De 30 elever som sitter i skolans matråd']
assert F(12, 40) * 500 == 150 and F(200 - 150, 200) * 100 == 25 and F(9, 25) * 100 == 36
assert F(20, 100) * 12000 == 2400

MA_AK9_UNDERSOKNING_1 = niva('ma-ak9-undersokning-1', 'Population, urval och stickprov',
                             'Statistiska undersökningar', [
    val('En skola har 600 elever. 50 av dem väljs ut och får svara på en enkät. Vad kallas de 50 eleverna?',
        ['Ett stickprov', 'Populationen', 'Bortfallet', 'Ett typvärde'], 'Ett stickprov',
        'Populationen är alla 600 som man vill veta något om. De 50 som väljs ut och tillfrågas är ett stickprov ur '
        'populationen.'),
    para('Para ihop ordet med vad det betyder i en statistisk undersökning.',
         [('Population', 'Hela gruppen man vill veta något om'), ('Stickprov', 'De som väljs ut och tillfrågas'),
          ('Bortfall', 'De utvalda som inte svarar'), ('Enkät', 'Ett formulär med frågor som man svarar på')],
         'Man frågar ett stickprov för att få veta något om hela populationen. De i stickprovet som inte svarar är '
         'bortfallet.'),
    skriv('I ett slumpmässigt stickprov på 40 elever cyklar 12 till skolan. Skolan har 500 elever. Ungefär hur många '
          'av skolans elever kan man uppskatta cyklar till skolan?', t(F(12, 40) * 500),
          'I stickprovet cyklar 12 / 40 = 0,3, alltså 30 %. Om stickprovet liknar skolan cyklar ungefär '
          '0,3 · 500 = 150 elever.'),
    val('En elev vill ta reda på vad eleverna på hela skolan tycker om skolmaten. Vilket urval ger den mest '
        'rättvisande bilden?', URVAL, URVAL[0],
        'När eleverna lottas från hela skolan har alla samma chans att komma med, och då brukar stickprovet likna '
        'skolan. '
        'En klass, de som kommer först till matsalen eller matrådet kan tycka annorlunda än skolan i stort.'),
    val('Vilken av frågorna är inte ledande, alltså inte skriven så att den antyder ett svar?', LEDANDE, LEDANDE[0],
        'En ledande fråga lägger svaret i munnen på den som svarar, som "Visst är …" eller "Håller du med om att …". '
        'Frågan "Vad tycker du om skolmaten?" låter var och en svara fritt.'),
    skriv('200 personer fick en enkät, och 150 av dem svarade. Hur många procent var bortfallet?',
          t(F(200 - 150, 200) * 100),
          'Bortfallet är de som inte svarade: 200 − 150 = 50 personer. 50 av 200 är 50 / 200 = 0,25 = 25 %.'),
    skriv('I ett stickprov på 25 elever spelar 9 ett instrument. Hur många procent av stickprovet är det?',
          t(F(9, 25) * 100),
          '9 / 25 = 0,36, och det är 36 %. Förläng gärna med 4: 9/25 = 36/100.'),
    sant('Den som bara frågar sina egna kompisar har gjort ett slumpmässigt urval.', False,
         'I ett slumpmässigt urval har alla i populationen samma chans att komma med. Kompisarna väljs inte av '
         'slumpen, och de kan tycka mer lika en själv än andra gör.'),
    ordna('Ordna stegen i en statistisk undersökning.',
          ['Bestäm vad du vill ta reda på', 'Välj ut ett stickprov', 'Samla in svaren',
           'Sammanställ svaren i en tabell', 'Dra en slutsats'],
          forklaring='Först frågan, sedan vilka som ska svara. Svaren måste samlas in och sammanställas innan det går '
                     'att se vad de säger.'),
    skriv('I ett slumpmässigt stickprov på 80 invånare i en kommun har 20 % en hund. Kommunen har 12 000 invånare. '
          'Ungefär hur många invånare kan man uppskatta har en hund?', t(F(20, 100) * 12000),
          'Man räknar med att andelen i kommunen är ungefär densamma som i stickprovet: 20 % av 12 000 är '
          '0,2 · 12 000 = 2 400 invånare.'),
], beskrivning='Population, stickprov och bortfall: välj ett urval som ger en rättvis bild, och uppskatta en hel '
               'grupp ur ett stickprov.')

AXEL = ['2 gånger', '1,05 gånger', '10 gånger', '5 gånger']
KLASSER = ['Klass A har störst andel som spelar fotboll', 'Klass B har störst andel som spelar fotboll',
           'Klasserna har lika stor andel som spelar fotboll', 'Det går inte att jämföra klasserna']
assert F(12, 30) > F(15, 40) and F(100 - 90, 95 - 90) == 2
LONER = [30000] * 9 + [120000]
LON_MEDEL = F(sum(LONER), len(LONER))
LON_MEDIAN = F(sorted(LONER)[4] + sorted(LONER)[5], 2)
assert LON_MEDEL == 39000 and LON_MEDIAN == 30000
LAGESMATT = ['Medianen, 30 000 kr', 'Medelvärdet, 39 000 kr', 'Variationsbredden, 90 000 kr',
             'Den högsta lönen, 120 000 kr']
SKOLOR = [('18 av 40', F(18, 40)), ('30 av 60', F(30, 60)), ('21 av 50', F(21, 50)), ('33 av 75', F(33, 75))]
assert F(40, 100) * F(25, 100) == F(10, 100) and F(500 - 400, 400) == F(25, 100)

MA_AK9_UNDERSOKNING_2 = niva('ma-ak9-undersokning-2', 'Granska diagram och slutsatser', 'Statistiska undersökningar', [
    val('I ett stapeldiagram börjar den lodräta axeln på 90 i stället för på 0. En stapel visar 95 och en annan 100. '
        'Hur många gånger så hög ser den högre stapeln ut i diagrammet?', AXEL,
        enda(AXEL, lambda a: bv(a.split()[0]) == F(100 - 90, 95 - 90)),
        'Staplarna börjar vid 90, så de syns bara 5 och 10 enheter höga. Den högre ser dubbelt så hög ut, fast '
        'värdet bara är 100 / 95 ≈ 1,05 gånger så stort.'),
    val('Klass A har 30 elever, och 12 av dem spelar fotboll. Klass B har 40 elever, och 15 av dem spelar fotboll. '
        'Vilket stämmer?', KLASSER, KLASSER[0],
        'Jämför andelar, inte antal: 12 / 30 = 40 % och 15 / 40 = 37,5 %. Klass B har fler som spelar fotboll, men '
        'en mindre andel.'),
    sant('Om två saker ökar samtidigt betyder det alltid att den ena orsakar den andra.', False,
         'Båda kan bero på något tredje. Glassförsäljningen och antalet som badar ökar båda när det är varmt, men '
         'glassen får inte folk att bada.'),
    skriv('På ett företag tjänar 9 personer 30 000 kr i månaden och chefen tjänar 120 000 kr. Vad är medelvärdet av '
          'de tio lönerna? Svara i kronor.', t(LON_MEDEL),
          'Summan är 9 · 30 000 + 120 000 = 390 000 kr. Delat på 10 personer blir det 39 000 kr.'),
    val('På ett företag tjänar 9 personer 30 000 kr i månaden och chefen tjänar 120 000 kr. Vilket mått beskriver '
        'bäst vad en vanlig anställd tjänar?', LAGESMATT, LAGESMATT[0],
        'Chefens höga lön drar upp medelvärdet till 39 000 kr, mer än vad nio av tio tjänar. Medianen, 30 000 kr, '
        'påverkas inte av ett enda högt värde.'),
    skriv('I en undersökning svarade 40 % av de tillfrågade Ja. Av dem som svarade Ja var 25 % under 18 år. Hur många '
          'procent av alla tillfrågade var under 18 år och svarade Ja?', t(F(40, 100) * F(25, 100) * 100),
          'Det är 25 % av 40 %: 0,25 · 0,40 = 0,10, alltså 10 % av alla tillfrågade.'),
    sant('Om varje person i en enkät får kryssa i flera svar kan andelarna för alla svar tillsammans bli mer än '
         '100 %.', True,
         'Den som kryssar i två svar räknas två gånger. Då passar inte ett cirkeldiagram, för delarna blir mer än '
         'helheten.'),
    skriv('En tidning skriver att antalet elever som cyklar till skolan har ökat med 100 %. Förra året cyklade 15 '
          'elever. Hur många elever cyklar i år?', t(15 * 2),
          'En ökning med 100 % betyder att det har kommit till lika många som förut: 15 + 15 = 30. Antalet har '
          'fördubblats.'),
    skriv('Antalet besökare på ett bibliotek ökade från 400 till 500 på ett år. Med hur många procent ökade antalet?',
          t(F(500 - 400, 400) * 100),
          'Ökningen är 100 besökare, och den jämförs med det gamla värdet: 100 / 400 = 0,25 = 25 %. Att det kom 100 '
          'fler betyder inte att antalet ökade med 100 %.'),
    ordna_tal('Fyra skolor gjorde samma enkät. Brickorna visar hur många som svarade Ja av dem som svarade. Sätt dem '
              'i ordning efter andelen som svarade Ja, med den minsta andelen först.', SKOLOR,
              '21 / 50 = 42 %, 33 / 75 = 44 %, 18 / 40 = 45 % och 30 / 60 = 50 %. Skolan med flest Ja, 33, har inte '
              'störst andel.'),
], beskrivning='Granska statistik: diagram vars axel inte börjar på 0, andelar i grupper av olika storlek, medelvärde '
               'mot median, procent av procent och samband som inte är orsaker.')

# ---------------------------------------------------------------- tillägg

TILLAGG = [
    bana('Matematik', 'ak8', [MA_AK8_MONSTER_1, MA_AK8_MONSTER_2, MA_AK8_VINKLAR_1, MA_AK8_VINKLAR_2,
                              MA_AK8_DIAGRAM_1, MA_AK8_DIAGRAM_2]),
    bana('Matematik', 'ak9', [MA_AK9_VOLYM_1, MA_AK9_VOLYM_2, MA_AK9_KOMBINATORIK_1, MA_AK9_KOMBINATORIK_2,
                              MA_AK9_UNDERSOKNING_1, MA_AK9_UNDERSOKNING_2]),
]
