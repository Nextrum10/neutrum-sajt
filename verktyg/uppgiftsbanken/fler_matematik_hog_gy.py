# -*- coding: utf-8 -*-
"""Fler matematiknivåer för åk 7, åk 8, åk 9 och gymnasiets Matematik 1, 2 och 3/4
(2026-10-14). Nya områden som banorna saknade, i TILLAGG så att de läggs sist
i de banor som redan finns:

    åk 7   Bråk och decimaltal, Cirkelns omkrets och area
    åk 8   Samband och proportionalitet, Kvadratrötter
    åk 9   Formler och omskrivning, Sannolikhet i flera steg
    gy1    Statistik och lägesmått
    gy2    Andragradsfunktioner
    gy3    Komplexa tal

Allt är Nextrums egna uppgifter, skrivna med AI och inte lästa av någon som
undervisar i ämnet. Filen står för sig och lånar inga hjälpare ur de andra
matematikfilerna: ett facit här ska inte kunna ändras av en ändring där.

Varje facit räknas ut här (bråk med Fraction, komplexa tal med Pythons complex
på heltal, rötter och kvadratkomplettering prövade i flera punkter), och de
felaktiga alternativen prövas mot samma räkning: ett fel facit lär barnet att
det rätta svaret är fel, och ett "fel" alternativ som råkar vara rätt gör
samma sak.
"""
import math
from fractions import Fraction as F

from grund import bana, niva, val, skriv, ordna, sant, para, tal

PI = F(314, 100)  # π ≈ 3,14 i åk 7: frågorna säger det.


def t(x):
    """Talet som svar: decimalkomma och '-' för minus (rättningen gör om − till -)."""
    if isinstance(x, F):
        x = int(x) if x.denominator == 1 else float(x)
    return tal(x)


def m(x):
    """Talet i en text eller bland alternativen, med riktigt minustecken."""
    return t(x).replace('-', '−')


def bv(s):
    """Ett tal eller bråk ur sin text: '3/4', '0,75', '−2' → exakt värde."""
    s = s.replace('−', '-').replace(',', '.').replace(' ', '')
    if '/' in s:
        a, b = s.split('/')
        return F(a) / F(b)
    return F(s)


def brak(x, decimal=False):
    """Ett bråk som svar, med och utan mellanslag runt snedstrecket: bråk
    jämförs som text, så "1 / 8" är inte "1/8" för rättningen. Med decimal
    godtas också decimaltalet, när det går jämnt ut."""
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


def br(x):
    """Ett bråk som text i en fråga eller ett alternativ: 3/4, 2, −1/2."""
    x = F(x)
    s = str(x.numerator) if x.denominator == 1 else '%d/%d' % (x.numerator, x.denominator)
    return s.replace('-', '−')


def x_svar(v, var='x'):
    """Svaret på "Vad är x?": talet, och talet skrivet som x = 5 på fyra sätt.
    Ett negativt tal också med mellanslag efter minustecknet."""
    s = t(v)
    svar = [s, '%s = %s' % (var, s), '%s=%s' % (var, s), '%s= %s' % (var, s), '%s =%s' % (var, s)]
    if s.startswith('-'):
        svar += ['- ' + s[1:], '%s = - %s' % (var, s[1:])]
    return svar


def neg_svar(v):
    """Ett tal som svar. Ett negativt tal också som - 5, för rättningen läser
    bara -5 som ett tal."""
    s = t(v)
    return [s, '- ' + s[1:]] if s.startswith('-') else [s]


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


def medel(data):
    return F(sum(data), len(data))


def median(data):
    s = sorted(data)
    n = len(s)
    return F(s[n // 2]) if n % 2 else F(s[n // 2 - 1] + s[n // 2], 2)


def kvartiler(data):
    """Nedre och övre kvartilen som läroböckerna räknar dem: medianen delar värdena
    i två halvor (en udda mittpost tas ur), och kvartilerna är halvornas medianer.
    Frågorna har ett jämnt antal värden, så ingen mittpost behöver tas ur."""
    s = sorted(data)
    assert len(s) % 2 == 0, 'ett jämnt antal värden, så att metoderna inte skiljer sig'
    h = len(s) // 2
    return median(s[:h]), median(s[h:])


def kvadrat_ok(f, g, punkter=range(-6, 7)):
    """Två uttryck är samma uttryck: lika i tretton punkter."""
    return all(f(F(x)) == g(F(x)) for x in punkter)


def ktext(z):
    """Ett komplext tal med heltalsdelar som text, så som det skrivs: 7 − 3i, 2i, 3 − i, −4."""
    a, b = int(round(z.real)), int(round(z.imag))
    assert abs(z.real - a) < 1e-9 and abs(z.imag - b) < 1e-9, z
    if b == 0:
        return m(a)
    im = 'i' if abs(b) == 1 else '%di' % abs(b)
    if a == 0:
        return ('−' if b < 0 else '') + im
    return '%s %s %s' % (m(a), '+' if b > 0 else '−', im)


def cplx(text):
    """'7 − 3i', '2i', '−4', '3 − i' → complex. Alternativen prövas ur sin egen text."""
    s = text.replace('−', '-').replace(' ', '').replace('i', 'j')
    if s in ('j', '+j'):
        return 1j
    if s == '-j':
        return -1j
    s = s.replace('+j', '+1j').replace('-j', '-1j')
    return complex(s)


# ---------------------------------------------------------------- åk 7: bråk och decimaltal

assert bv('4/6') == F(2, 3) and bv('0,125') == F(1, 8) and bv('−1/2') == F(-1, 2)

MA_AK7_BRAK_1 = niva('ma-ak7-fler-brak-1', 'Förlänga, förkorta och jämföra bråk', 'Bråk och decimaltal', [
    val('Vilket bråk är lika stort som 2/3?', ['4/6', '3/4', '2/6', '4/9'],
        enda(['4/6', '3/4', '2/6', '4/9'], lambda a: bv(a) == F(2, 3)),
        'Förläng med 2: både täljaren och nämnaren multipliceras med 2, så 2/3 = 4/6. Ändrar man bara en av dem, '
        'som i 2/6 och 4/9, blir det ett annat tal.'),
    skriv('Förkorta 18/24 så långt det går. Svara som ett bråk.', brak(F(18, 24)),
          'Både 18 och 24 går att dela med 6. 18 : 6 = 3 och 24 : 6 = 4, så 18/24 = 3/4. '
          'Talen 3 och 4 har ingen gemensam delare, så det går inte att förkorta mer.'),
    val('Vilket av bråken är störst?', ['3/4', '5/8', '7/12', '2/3'],
        enda(['3/4', '5/8', '7/12', '2/3'], lambda a: bv(a) == max(bv(x) for x in ['3/4', '5/8', '7/12', '2/3'])),
        'Skriv alla med nämnaren 24: 3/4 = 18/24, 5/8 = 15/24, 7/12 = 14/24 och 2/3 = 16/24. '
        'Med samma nämnare vinner den största täljaren: 18/24, alltså 3/4.'),
    ordna_tal('Sätt bråken i ordning, med det minsta först.',
              [('3/8', F(3, 8)), ('1/2', F(1, 2)), ('2/3', F(2, 3)), ('5/6', F(5, 6))],
              'Skriv dem med nämnaren 24: 3/8 = 9/24, 1/2 = 12/24, 2/3 = 16/24 och 5/6 = 20/24.'),
    skriv('Skriv 3/8 som decimaltal.', t(F(3, 8)),
          '3/8 betyder 3 : 8 = 0,375. Man kan också förlänga till 375/1000, och det är 0,375.'),
    skriv('Skriv 0,6 som ett bråk i enklaste form.', brak(F('0.6')),
          '0,6 är sex tiondelar, 6/10. Dela täljare och nämnare med 2, så blir det 3/5.'),
    para('Para ihop bråket med samma tal som decimaltal.',
         [(br(x), t(x)) for x in (F(1, 2), F(1, 4), F(3, 4), F(1, 5), F(1, 8))],
         'Dela täljaren med nämnaren: 1 : 2 = 0,5, 1 : 4 = 0,25, 3 : 4 = 0,75, 1 : 5 = 0,2 och 1 : 8 = 0,125.'),
    sant('Bråken 3/4 och 6/8 är lika stora.', F(3, 4) == F(6, 8),
         '6/8 går att förkorta med 2 till 3/4. Bråken har samma värde.'),
    sant('Bråket 2/3 har samma värde som 3/4, eftersom man får 3/4 genom att lägga till 1 i både täljaren och nämnaren.',
         F(2, 3) == F(3, 4),
         'Värdet ändras inte om man multiplicerar eller dividerar täljare och nämnare med samma tal, men att lägga till '
         'ett tal gör det. 2/3 är ungefär 0,67 och 3/4 är 0,75.'),
    skriv('En pizza är delad i 8 lika stora bitar. Alma äter 3 bitar och Ravi äter 2 bitar. '
          'Hur stor del av pizzan är kvar? Svara som ett bråk.', brak(F(8 - 3 - 2, 8)),
          'Tillsammans åt de 3 + 2 = 5 bitar av 8. Kvar är 8 − 5 = 3 bitar, alltså 3/8 av pizzan.'),
], beskrivning='Förlänga, förkorta och jämföra bråk, och växla mellan bråk och decimaltal.')

assert F(1, 3) + F(1, 4) == F(7, 12) and F(2, 5) + F(1, 3) == F(11, 15)
assert F(3, 4) * 24 == 18 and F(3, 4) * F(2, 5) == F(3, 10) and F(3, 4) / F(3, 8) == 2
assert F('4.2') * F('0.3') == F('1.26') and F(3, 4) * F(1, 3) == F(1, 4)

MA_AK7_BRAK_2 = niva('ma-ak7-fler-brak-2', 'Räkna med bråk och decimaltal', 'Bråk och decimaltal', [
    skriv('Vad är 1/3 + 1/4? Svara som ett bråk.', brak(F(1, 3) + F(1, 4)),
          'Använd gemensam nämnare 12: 1/3 = 4/12 och 1/4 = 3/12. Summan är 4/12 + 3/12 = 7/12. '
          'Nämnarna adderas aldrig.'),
    val('Vad är 2/5 + 1/3?', ['11/15', '3/8', '2/15', '3/15'],
        enda(['11/15', '3/8', '2/15', '3/15'], lambda a: bv(a) == F(2, 5) + F(1, 3)),
        'Gemensam nämnare 15: 2/5 = 6/15 och 1/3 = 5/15, så summan är 11/15. 3/8 får den som adderar täljarna och '
        'nämnarna var för sig, och 3/15 den som adderar täljarna utan att förlänga.'),
    skriv('Vad är 3/4 av 24?', t(F(3, 4) * 24),
          'Dela 24 i 4 lika delar: 6 i varje. Tre delar är 3 · 6 = 18.'),
    skriv('Vad är 3/4 · 2/5? Svara som ett bråk i enklaste form.', brak(F(3, 4) * F(2, 5)),
          'Multiplicera täljare med täljare och nämnare med nämnare: 6/20. Förkorta med 2 så blir det 3/10.'),
    val('Vad är 3/4 delat med 3/8?', ['2', '1/2', '9/32', '3/2'],
        enda(['2', '1/2', '9/32', '3/2'], lambda a: bv(a) == F(3, 4) / F(3, 8)),
        'Att dela med ett bråk är att multiplicera med det omvända bråket: 3/4 · 8/3 = 24/12 = 2. '
        'Tänk också: 3/8 ryms två gånger i 3/4. 9/32 får den som multiplicerar bråken.'),
    skriv('Vad är 4,2 · 0,3?', t(F('4.2') * F('0.3')),
          'Räkna 42 · 3 = 126. Faktorerna har tillsammans två decimaler, så svaret får två decimaler: 1,26.'),
    ordna_tal('Sätt talen i ordning, med det minsta först.',
              [('1/4', F(1, 4)), ('0,3', F('0.3')), ('2/5', F(2, 5)), ('0,35', F('0.35'))],
              'Skriv alla som decimaltal: 1/4 = 0,25 och 2/5 = 0,40. Då syns det att 0,25 < 0,30 < 0,35 < 0,40.'),
    para('Para ihop uträkningen med rätt svar.',
         [('1/2 + 1/4', br(F(1, 2) + F(1, 4))), ('1/2 · 1/4', br(F(1, 2) * F(1, 4))),
          ('1/2 − 1/4', br(F(1, 2) - F(1, 4))), ('1/2 delat med 1/4', br(F(1, 2) / F(1, 4)))],
         'Gemensam nämnare ger 2/4 + 1/4 = 3/4 och 2/4 − 1/4 = 1/4. Multiplikation ger 1/8. '
         'Och 1/4 ryms två gånger i 1/2, så 1/2 delat med 1/4 är 2.'),
    skriv('Mira har 3/4 liter saft. Hon använder 1/3 av saften till en dryck. '
          'Hur många liter saft använder hon? Svara som ett bråk.', brak(F(3, 4) * F(1, 3)),
          '1/3 av 3/4 är 1/3 · 3/4 = 3/12 = 1/4 liter.'),
    sant('Att dela ett tal med 1/2 ger samma resultat som att multiplicera talet med 2.', F(6) / F(1, 2) == 6 * 2,
         'Det ryms två halva i varje hel. 6 : 1/2 = 12, och 6 · 2 = 12.'),
], beskrivning='Addera, multiplicera och dela bråk, och räkna med decimaltal.')

# ---------------------------------------------------------------- åk 7: cirkeln

assert PI * 10 == F('31.4') and 2 * PI * 20 == F('125.6') and PI * 70 == F('219.8')
assert 3 * PI * 8 == F('75.36') and F('62.8') / PI == 20

MA_AK7_CIRKEL_1 = niva('ma-ak7-fler-cirkel-1', 'Radie, diameter och omkrets', 'Cirkelns omkrets och area', [
    para('Para ihop begreppet med rätt förklaring.',
         [('Radie', 'Avståndet från cirkelns mitt till kanten'),
          ('Diameter', 'En sträcka genom mitten från kant till kant'),
          ('Omkrets', 'Längden av hela cirkelns rand'),
          ('π (pi)', 'Omkretsen delad med diametern'),
          ('Area', 'Ytan som cirkeln täcker')],
         'Radien är en halv diameter. Omkretsen är sträckan runt, arean är ytan innanför, och π är kvoten mellan '
         'omkretsen och diametern, ungefär 3,14.'),
    skriv('En cirkel har diametern 14 cm. Hur många centimeter är radien?', t(14 // 2),
          'Diametern är dubbelt så lång som radien, så radien är 14 : 2 = 7 cm.'),
    skriv('En cirkel har diametern 10 cm. Hur lång är omkretsen? Räkna med π ≈ 3,14 och svara i centimeter.',
          t(PI * 10), 'Omkretsen är π · diametern: 3,14 · 10 = 31,4 cm.'),
    skriv('En cirkel har radien 20 cm. Hur lång är omkretsen? Räkna med π ≈ 3,14 och svara i centimeter.',
          t(2 * PI * 20), 'Diametern är 2 · 20 = 40 cm. Omkretsen är 3,14 · 40 = 125,6 cm.'),
    val('Vilken formel ger omkretsen O av en cirkel med radien r?', ['O = 2πr', 'O = πr²', 'O = πr', 'O = 2πr²'],
        'O = 2πr',
        'Omkretsen är π gånger diametern, och diametern är 2r. Alltså O = π · 2r = 2πr. '
        'Formeln πr² ger cirkelns area.'),
    skriv('Ett cykelhjul har diametern 70 cm. Hur många centimeter rullar cykeln framåt när hjulet snurrar ett helt '
          'varv? Räkna med π ≈ 3,14.', t(PI * 70),
          'Ett varv är lika långt som hjulets omkrets: 3,14 · 70 = 219,8 cm.'),
    sant('Omkretsen av en cirkel är lite mer än tre gånger så lång som diametern.', PI > 3,
         'Omkretsen delad med diametern är π, som är ungefär 3,14. Det är lite mer än 3.'),
    val('En cirkels omkrets är 62,8 cm. Hur lång är diametern? Räkna med π ≈ 3,14.',
        ['20 cm', '10 cm', '31,4 cm', '%s cm' % t(F('62.8') * PI)], '20 cm',
        'Omkretsen är π · diametern, så diametern är omkretsen delad med π: 62,8 : 3,14 = 20 cm. '
        '10 cm är radien, och den som multiplicerar i stället för att dela får %s.' % t(F('62.8') * PI)),
    skriv('Karin går 3 varv runt en rund damm. Dammens diameter är 8 m. Hur många meter går hon? '
          'Räkna med π ≈ 3,14.', t(3 * PI * 8),
          'Ett varv är omkretsen 3,14 · 8 = 25,12 m. Tre varv är 3 · 25,12 = 75,36 m.'),
], beskrivning='Radie, diameter och omkrets, med π ≈ 3,14.')

assert PI * 10 * 10 == 314 and PI * 4 * 4 == F('50.24') and PI * 36 == F('113.04')
assert PI * 15 * 15 == F('706.5') and PI * 36 / 2 == F('56.52') and F('78.5') / PI == 25

MA_AK7_CIRKEL_2 = niva('ma-ak7-fler-cirkel-2', 'Cirkelns area', 'Cirkelns omkrets och area', [
    val('Vilken formel ger arean A av en cirkel med radien r?', ['A = πr²', 'A = 2πr', 'A = πd', 'A = 2πr²'], 'A = πr²',
        'Arean är π gånger radien i kvadrat: A = π · r · r. Formlerna 2πr och πd (d är diametern) ger omkretsen.'),
    skriv('En cirkel har radien 10 cm. Hur stor är arean? Räkna med π ≈ 3,14 och svara i kvadratcentimeter.',
          t(PI * 10 * 10), 'A = π · r² = 3,14 · 10 · 10 = 3,14 · 100 = 314 cm².'),
    skriv('En cirkel har diametern 12 cm. Hur stor är arean? Räkna med π ≈ 3,14 och svara i kvadratcentimeter.',
          t(PI * 6 * 6),
          'Radien är 12 : 2 = 6 cm. Arean är 3,14 · 6 · 6 = 3,14 · 36 = 113,04 cm². '
          'Den som använder 12 som radie får ett fel svar.'),
    val('Arean av en cirkel är 78,5 cm². Hur lång är radien? Räkna med π ≈ 3,14.',
        ['5 cm', '25 cm', '12,5 cm', '10 cm'], '5 cm',
        'A = 3,14 · r², så r² = 78,5 : 3,14 = 25. Radien är det tal som ger 25 när det multipliceras med sig '
        'självt: 5 cm. Talet 25 är r², inte r.'),
    sant('Om en cirkels radie fördubblas blir arean dubbelt så stor.', False,
         'Arean beror på r · r. Dubbel radie ger 2 · 2 = 4 gånger så stor area.'),
    skriv('En cirkels radie blir tre gånger så lång. Hur många gånger så stor blir arean?', t(3 * 3),
          'Arean beror på r · r, så tre gånger så lång radie ger 3 · 3 = 9 gånger så stor area.'),
    skriv('En rund pizza har diametern 30 cm. Hur stor area har pizzan? Räkna med π ≈ 3,14 och svara i '
          'kvadratcentimeter.', t(PI * 15 * 15),
          'Radien är 15 cm. Arean är 3,14 · 15 · 15 = 3,14 · 225 = 706,5 cm².'),
    val('En kvadrat har sidan 10 cm och en cirkel har radien 5 cm. Vilken figur har störst area?',
        ['Kvadraten', 'Cirkeln', 'De har lika stor area'], 'Kvadraten',
        'Kvadratens area är 10 · 10 = 100 cm². Cirkelns area är 3,14 · 5 · 5 = 78,5 cm². Cirkeln ryms inuti '
        'kvadraten och täcker mindre.'),
    skriv('En halvcirkel har radien 6 cm. Hur stor är arean? Räkna med π ≈ 3,14 och svara i kvadratcentimeter.',
          t(PI * 36 / 2),
          'Hela cirkeln har arean 3,14 · 6 · 6 = 113,04 cm². Halvcirkeln är hälften: 56,52 cm².'),
    para('Para ihop radien med cirkelns area. Räkna med π ≈ 3,14.',
         [('Radie 1 cm', '%s cm²' % t(PI * 1)), ('Radie 2 cm', '%s cm²' % t(PI * 4)),
          ('Radie 3 cm', '%s cm²' % t(PI * 9)), ('Radie 10 cm', '%s cm²' % t(PI * 100))],
         'Arean är 3,14 · r · r: 3,14 · 1 = 3,14, 3,14 · 4 = 12,56, 3,14 · 9 = 28,26 och 3,14 · 100 = 314.'),
], beskrivning='Cirkelns area, och hur den växer när radien växer.')

# ---------------------------------------------------------------- åk 8: samband och proportionalitet

assert F(138, 6) * 10 == 230 and F(7, 2) * 10 == 35 and F(90, 5) == 18 and F(300, 4) * 10 == 750

MA_AK8_SAMBAND_1 = niva('ma-ak8-fler-samband-1', 'Proportionella samband', 'Samband och proportionalitet', [
    val('Vilket av sambanden är proportionellt?',
        ['Priset för x kg godis när 1 kg kostar 18 kr', 'Taxipris för x km: 40 kr start och 15 kr per km',
         'Ljusets höjd efter x h: 20 cm minus 2 cm per timme', 'Åldern om x år för den som är 12 år i dag'],
        'Priset för x kg godis när 1 kg kostar 18 kr',
        'I ett proportionellt samband är y = k · x, utan startvärde: dubbelt så många kilo ger dubbelt så högt pris. '
        'Taxipriset har en startavgift, ljuset ett startvärde på 20 cm och åldern 12 år från början.'),
    skriv('6 liter bensin kostar 138 kr. Priset är proportionellt mot antalet liter. '
          'Hur många kronor kostar 10 liter?', t(F(138, 6) * 10),
          'En liter kostar 138 : 6 = 23 kr. Tio liter kostar 10 · 23 = 230 kr.'),
    skriv('I ett proportionellt samband är y = 7 när x = 2, y = 14 när x = 4 och y = 21 när x = 6. '
          'Vad är y när x = 10?', t(F(7, 2) * 10),
          'y är 3,5 gånger x, för 7 : 2 = 3,5 (och 14 : 4 och 21 : 6 ger också 3,5). Då är y = 3,5 · 10 = 35.'),
    val('Priset y kr är proportionellt mot vikten x kg, och 5 kg kostar 90 kr. Vad är proportionalitetskonstanten k i '
        'y = kx?', ['18', '450', '85', '0,056'], '18',
        'k = y : x = 90 : 5 = 18, alltså 18 kr per kilo. Den som delar åt fel håll får 5 : 90, ungefär 0,056.'),
    sant('Grafen för ett proportionellt samband är en rät linje som går genom origo.', True,
         'När x = 0 är y = k · 0 = 0, så linjen går genom punkten (0, 0), origo.'),
    sant('Sambandet y = 2x + 3 är proportionellt.', False,
         'När x = 0 är y = 3, inte 0. Det finns ett startvärde, så y är inte proportionellt mot x.'),
    para('Para ihop sambandet med proportionalitetskonstanten k.',
         [('y = 4x', '4'), ('y = x/2', '0,5'), ('y = 0,25x', '0,25'), ('y = 12x', '12')],
         'k är talet som x multipliceras med. y = x/2 är detsamma som y = 0,5x.'),
    skriv('Till 4 portioner pasta behövs 300 g pasta. Hur många gram pasta behövs till 10 portioner?',
          t(F(300, 4) * 10), 'En portion behöver 300 : 4 = 75 g. Tio portioner behöver 10 · 75 = 750 g.'),
    val('x = 1 ger y = 5, x = 2 ger y = 10 och x = 3 ger y = 15. Vilken formel passar?',
        ['y = 5x', 'y = x + 4', 'y = 5 + x', 'y = x/5'], 'y = 5x',
        'y är 5 gånger x i alla tre raderna. Formeln y = x + 4 stämmer bara för x = 1.'),
], beskrivning='Proportionella samband: konstanten k, tabeller och grafer genom origo.')

assert 12 * 7 + 50 == 134 and 20 + 6 * 15 == 110 and F(200, 8) == 25
assert 100 + 20 * 4 == 60 + 30 * 4 == 180

MA_AK8_SAMBAND_2 = niva('ma-ak8-fler-samband-2', 'Linjära samband med startvärde', 'Samband och proportionalitet', [
    val('En taxiresa kostar 50 kr i startavgift och 12 kr per kilometer. Vilken formel ger priset y kr för x km?',
        ['y = 12x + 50', 'y = 50x + 12', 'y = 62x', 'y = 12 + 50 + x'], 'y = 12x + 50',
        'Priset är 12 kr för varje kilometer, alltså 12 · x, plus startavgiften 50 kr: y = 12x + 50.'),
    skriv('Priset y kr för en taxiresa på x km ges av y = 12x + 50. Vad kostar en resa på 7 km?', t(12 * 7 + 50),
          'Sätt in x = 7: y = 12 · 7 + 50 = 84 + 50 = 134 kr.'),
    skriv('I en tabell är y = 8 när x = 0, y = 11 när x = 1 och y = 14 när x = 2. '
          'Hur mycket ökar y när x ökar med 1?', t(11 - 8),
          'Från 8 till 11 och från 11 till 14 ökar y med 3 varje gång. Det är förändringen per steg.'),
    val('x = 0 ger y = 5, x = 1 ger y = 9 och x = 2 ger y = 13. Vilken formel passar?',
        ['y = 4x + 5', 'y = 5x + 4', 'y = 9x', 'y = 4x + 9'], 'y = 4x + 5',
        'Värdet vid x = 0 är 5, startvärdet. Sedan ökar y med 4 för varje steg. Alltså y = 4x + 5.'),
    skriv('Ett badkar innehåller 20 liter vatten. Sedan rinner det i 15 liter per minut. '
          'Hur många liter finns i badkaret efter 6 minuter?', t(20 + 6 * 15),
          'På 6 minuter rinner det i 6 · 15 = 90 liter. Tillsammans med de 20 litrarna är det 110 liter.'),
    skriv('En tank innehåller 200 liter vatten och töms med 8 liter per minut. Efter hur många minuter är tanken tom?',
          t(F(200, 8)),
          'Vattenmängden är y = 200 − 8x. Tanken är tom när y = 0: 8x = 200, så x = 25 minuter.'),
    para('Para ihop beskrivningen med formeln.',
         [('Startvärde 5 och ökar med 2 per steg', 'y = 2x + 5'),
          ('Startvärde 2 och ökar med 5 per steg', 'y = 5x + 2'),
          ('Startvärde 20 och minskar med 3 per steg', 'y = 20 − 3x'),
          ('Inget startvärde och ökar med 4 per steg', 'y = 4x')],
         'Talet utan x är startvärdet, och talet framför x är förändringen per steg. Minskar värdet blir det minus.'),
    sant('I formeln y = 6x + 9 är 9 värdet på y när x = 0.', 6 * 0 + 9 == 9,
         'Sätt x = 0: y = 6 · 0 + 9 = 9. Startvärdet är alltid talet utan x.'),
    val('Abonnemang A kostar 100 kr + 20 kr per GB och abonnemang B kostar 60 kr + 30 kr per GB. '
        'Vid hur många GB kostar de lika mycket?', ['4 GB', '10 GB', '40 GB', '50 GB'], '4 GB',
        'Sätt kostnaderna lika: 100 + 20x = 60 + 30x. Det ger 40 = 10x, alltså x = 4. Båda kostar då 180 kr.'),
    sant('Sambandet y = 5x − 2 är proportionellt.', False,
         'När x = 0 är y = −2, inte 0. Ett proportionellt samband går alltid genom origo.'),
], beskrivning='Linjära samband med ett startvärde: tabeller, formler och jämförelser.')

# ---------------------------------------------------------------- åk 8: kvadratrötter

assert 7 ** 2 < 50 < 8 ** 2 and 9 + 16 == 25 and 6 + 8 != 10
assert [x for x in range(1, 100) if math.isqrt(x) ** 2 == x and x in (64, 72, 90, 50)] == [64]
assert 2 ** 2 < math.sqrt(20) < 5 < math.sqrt(30)

MA_AK8_ROTTER_1 = niva('ma-ak8-fler-rotter-1', 'Kvadrater och kvadratrötter', 'Kvadratrötter', [
    skriv('Vad är √81?', t(math.isqrt(81)),
          '√81 är det positiva tal som ger 81 när det multipliceras med sig självt. 9 · 9 = 81.'),
    skriv('Vad är 12²?', t(12 * 12), '12² betyder 12 · 12 = 144. Och omvänt är √144 = 12.'),
    val('Mellan vilka två heltal ligger √50?', ['7 och 8', '6 och 7', '5 och 6', '8 och 9'], '7 och 8',
        '7 · 7 = 49 och 8 · 8 = 64. Talet 50 ligger mellan 49 och 64, så √50 ligger mellan 7 och 8, '
        'strax över 7.'),
    para('Para ihop kvadratroten med dess värde.',
         [('√9', t(math.isqrt(9))), ('√64', t(math.isqrt(64))), ('√121', t(math.isqrt(121))),
          ('√169', t(math.isqrt(169)))],
         '3 · 3 = 9, 8 · 8 = 64, 11 · 11 = 121 och 13 · 13 = 169.'),
    sant('√36 + √64 = √100', math.isqrt(36) + math.isqrt(64) == math.isqrt(100),
         'Vänsterledet är 6 + 8 = 14, men √100 = 10. Man kan inte addera rötterna och få roten ur summan.'),
    sant('Både 5 och −5 har kvadraten 25.', 5 * 5 == 25 and (-5) * (-5) == 25,
         '5 · 5 = 25 och (−5) · (−5) = 25, eftersom minus gånger minus blir plus. '
         'Men √25 är bara den positiva roten, 5.'),
    skriv('En kvadrat har arean 169 cm². Hur många centimeter är en sida?', t(math.isqrt(169)),
          'Arean är sida · sida = 169. Sidan är √169 = 13 cm, eftersom 13 · 13 = 169.'),
    skriv('Vad är √(9 + 16)?', t(math.isqrt(9 + 16)),
          'Räkna först under rottecknet: 9 + 16 = 25. Sedan √25 = 5. Svaret är inte 3 + 4 = 7.'),
    val('Vilket av talen är ett kvadrattal?', ['72', '64', '90', '50'], '64',
        'Ett kvadrattal är ett heltal gånger sig självt. 8 · 8 = 64. De andra ligger mellan två kvadrattal: '
        '72 mellan 64 och 81, 90 mellan 81 och 100, och 50 mellan 49 och 64.'),
    ordna_tal('Sätt talen i ordning, med det minsta först.',
              [('2²', 4.0), ('√20', math.sqrt(20)), ('5', 5.0), ('√30', math.sqrt(30))],
              '2² = 4. √20 ligger mellan 4 och 5 (4² = 16 och 5² = 25). √30 ligger mellan 5 och 6, '
              'alltså över 5.'),
], beskrivning='Kvadrater och kvadratrötter: räkna, uppskatta och jämföra.')

assert math.isqrt(25 - 9) == 4 and 2 * 5 - 3 == 7 and round(math.sqrt(250), 1) == 15.8
assert math.isqrt(4) * math.isqrt(9) == 6 and 5 ** 3 == 125 and math.isqrt(144) * 4 == 48

MA_AK8_ROTTER_2 = niva('ma-ak8-fler-rotter-2', 'Rötter i beräkningar', 'Kvadratrötter', [
    skriv('Vad är √(5² − 3²)?', t(math.isqrt(5 ** 2 - 3 ** 2)),
          'Räkna under rottecknet först: 25 − 9 = 16. Sedan √16 = 4.'),
    skriv('Vad är 2 · √25 − √9?', t(2 * math.isqrt(25) - math.isqrt(9)),
          '√25 = 5 och √9 = 3. Alltså 2 · 5 − 3 = 10 − 3 = 7.'),
    skriv('En kvadratisk tomt har arean 250 m². Hur lång är en sida? Avrunda till en decimal och svara i meter.',
          t(round(math.sqrt(250), 1)),
          'Sidan är √250. Eftersom 15² = 225 och 16² = 256 är sidan drygt 15. Med räknare: √250 ≈ 15,8 m.'),
    val('Vad är √4 · √9?', ['6', '13', '5', '36'], '6',
        '√4 = 2 och √9 = 3, och 2 · 3 = 6. Det är samma sak som √(4 · 9) = √36 = 6.'),
    skriv('En kubformad låda har volymen 125 dm³. Hur många decimeter är en kant?', t(round(125 ** (1 / 3))),
          'Volymen är kant · kant · kant. 5 · 5 · 5 = 125, så kanten är 5 dm.'),
    sant('√(16 + 9) = 7', math.isqrt(16 + 9) == 7,
         'Under rottecknet är 16 + 9 = 25, och √25 = 5. Man kan inte ta roten ur varje term för sig: '
         '√16 + √9 = 7 är något annat.'),
    sant('√(16 · 9) = 12', math.isqrt(16 * 9) == 12,
         '16 · 9 = 144 och √144 = 12. Det stämmer med √16 · √9 = 4 · 3 = 12: rötter får man multiplicera var för sig.'),
    val('Vilket av uttrycken har störst värde?', ['2⁴', '√144', '3²', '√81 + 1'],
        enda(['2⁴', '√144', '3²', '√81 + 1'],
             lambda a: {'2⁴': 16, '√144': 12, '3²': 9, '√81 + 1': 10}[a] == 16),
        '2⁴ = 16, √144 = 12, 3² = 9 och √81 + 1 = 9 + 1 = 10. Störst är 2⁴.'),
    skriv('En kvadrat har arean 144 cm². Hur lång är dess omkrets? Svara i centimeter.', t(math.isqrt(144) * 4),
          'Sidan är √144 = 12 cm. Omkretsen är 4 · 12 = 48 cm.'),
    para('Para ihop uträkningen med värdet.',
         [('2 · √49', t(2 * math.isqrt(49))), ('√(100 − 36)', t(math.isqrt(100 - 36))),
          ('3 · √4 + 1', t(3 * math.isqrt(4) + 1)), ('√(7 + 9)', t(math.isqrt(7 + 9)))],
         '2 · 7 = 14, √64 = 8, 3 · 2 + 1 = 7 och √16 = 4. Räkna alltid ut det under rottecknet först.'),
], beskrivning='Rötter i beräkningar, uppskattningar och enkla sammanhang.')

# ---------------------------------------------------------------- åk 9: formler och omskrivning

assert 2 * (8 + 5) == 26 and F(150, 50) == 3 and 1.8 * 25 + 32 == 77 and F(11 + 7, 3) == 6 and 200 + 50 * 9 == 650


# Omskrivningarna prövas på tal som uppfyller den ursprungliga formeln.
for b_, h_ in ((6, 4), (3, 7), (5, 2)):          # A = b·h  →  b = A/h, och A = b·h/2  →  h = 2A/b
    assert F(b_ * h_, h_) == b_ and F(2 * F(b_ * h_, 2), b_) == h_
for k_, m_, x_ in ((2, 3, 5), (3, -4, 7), (F(1, 2), 1, 6)):   # y = kx + m  →  x = (y − m)/k
    y_ = k_ * x_ + m_
    assert F(y_ - m_) / k_ == x_
    assert (y_ - m_ - k_) != x_ and F(y_ + m_) / k_ != x_ and k_ * (y_ - m_) != x_
for r_, h_ in ((2, 3), (3, 5), (2, 7)):          # V = πr²h/3 (V i enheter av π)  →  h = 3V/(πr²)
    V_ = F(r_ * r_ * h_, 3)
    assert 3 * V_ / (r_ * r_) == h_ and V_ / (3 * r_ * r_) != h_ and 3 * V_ * r_ * r_ != h_
for a_, b_ in ((4, 6), (1, 9), (10, 2)):         # s = (a + b)/2  →  a = 2s − b
    assert 2 * F(a_ + b_, 2) - b_ == a_
for x_ in (3, -2, 6):                            # 2x + 3y = 12  →  y = (12 − 2x)/3
    y_ = F(12 - 2 * x_, 3)
    assert 2 * x_ + 3 * y_ == 12 and (4 - 2 * x_) != y_ and F(12 + 2 * x_, 3) != y_
for r_ in (3, 5, 7):                             # A = πr²  →  r = √(A/π), men inte √A/π
    A_ = math.pi * r_ * r_
    assert abs(math.sqrt(A_ / math.pi) - r_) < 1e-9 and abs(math.sqrt(A_) / math.pi - r_) > 1e-3
    assert abs(A_ / math.pi - r_) > 1e-3 and abs(A_ / (2 * math.pi) - r_) > 1e-3
assert F(10, 2) == 5 and F('31.4') / (2 * PI) == 5

MA_AK9_FORMLER_1 = niva('ma-ak9-fler-formler-1', 'Sätta in och lösa ut i formler', 'Formler och omskrivning', [
    skriv('Omkretsen O av en rektangel med basen b och höjden h ges av O = 2(b + h). '
          'Vad är O när b = 8 och h = 5?', t(2 * (8 + 5)),
          'Sätt in värdena: O = 2(8 + 5) = 2 · 13 = 26.'),
    skriv('Sträckan s, hastigheten v och tiden t hänger ihop så att s = v · t. '
          'Hur många timmar tar det att färdas 150 km med hastigheten 50 km/h?', t(F(150, 50)),
          'Lös ut t genom att dela båda led med v: t = s / v = 150 / 50 = 3 timmar.'),
    val('Lös ut b ur formeln A = b · h.', ['b = A/h', 'b = A · h', 'b = h/A', 'b = A − h'], 'b = A/h',
        'Dela båda led med h: A/h = b. Det som multipliceras med b tas bort genom att man delar med det.'),
    val('Lös ut x ur formeln y = kx + m.',
        ['x = (y − m)/k', 'x = y − m − k', 'x = (y + m)/k', 'x = k(y − m)'], 'x = (y − m)/k',
        'Subtrahera m från båda led: y − m = kx. Dela sedan båda led med k: x = (y − m)/k.'),
    skriv('Sambandet mellan temperaturen F i grader Fahrenheit och C i grader Celsius är F = 1,8C + 32. '
          'Vad är F när C = 25?', t(F(18, 10) * 25 + 32),
          'Sätt in C = 25: F = 1,8 · 25 + 32 = 45 + 32 = 77.'),
    skriv('I formeln y = 3x − 7 är y = 11. Vad är x?', x_svar(F(11 + 7, 3)),
          'Sätt in y = 11: 3x − 7 = 11. Addera 7: 3x = 18. Dela med 3: x = 6.'),
    para('Para ihop formeln med hur man löser ut b.',
         [('a = b + c', 'b = a − c'), ('a = b − c', 'b = a + c'), ('a = b · c', 'b = a / c'),
          ('a = b / c', 'b = a · c')],
         'Man gör det omvända av det som sker med b: plus blir minus, minus blir plus, gånger blir delat med '
         'och delat med blir gånger.'),
    sant('Ur formeln A = (b · h)/2 får man h = 2A/b.', True,
         'Multiplicera båda led med 2: 2A = b · h. Dela sedan med b: h = 2A/b.'),
    sant('Ur formeln s = v · t får man v = s · t.', False,
         'För att få v ensamt delar man båda led med t: v = s / t. Exempel: 150 km på 3 timmar ger v = 150 / 3 = '
         '50 km/h, inte 150 · 3.'),
    skriv('Priset p kr för en tjänst ges av p = 200 + 50m, där m är antalet månader. '
          'Efter hur många månader har man betalat 650 kr?', t(F(650 - 200, 50)),
          '200 + 50m = 650 ger 50m = 450, så m = 9 månader.'),
], beskrivning='Sätta in värden i formler och lösa ut en variabel i enkla formler.')

# ---- nivå 2
assert F(30 - 10, 4) == 5 and F(340 - 60, 35) == 8 and F(24 - 5 - 9) == 10 and F('31.4') / (2 * PI) == 5

MA_AK9_FORMLER_2 = niva('ma-ak9-fler-formler-2', 'Omskrivning i flera steg', 'Formler och omskrivning', [
    skriv('Formeln v = u + at ger sluthastigheten v. Vad är a när v = 30, u = 10 och t = 4?', t(F(30 - 10, 4)),
          'Lös ut a: at = v − u, så a = (v − u)/t = (30 − 10)/4 = 5.'),
    val('En kon har volymen V = (π · r² · h)/3. Lös ut h.',
        ['h = 3V/(πr²)', 'h = V/(3πr²)', 'h = 3V · πr²', 'h = V · πr²/3'], 'h = 3V/(πr²)',
        'Multiplicera båda led med 3: 3V = πr²h. Dela sedan båda led med πr²: h = 3V/(πr²).'),
    val('Lös ut r ur formeln A = πr², där r > 0.', ['r = √(A/π)', 'r = A/π', 'r = √A/π', 'r = A/(2π)'], 'r = √(A/π)',
        'Dela båda led med π: r² = A/π. Ta sedan kvadratroten ur båda led: r = √(A/π). '
        'Rottecknet ska gälla hela bråket, inte bara A.'),
    skriv('En cirkels omkrets O ges av O = 2πr. Vad är r när O = 31,4? Räkna med π ≈ 3,14.',
          t(F('31.4') / (2 * PI)),
          'Lös ut r: r = O/(2π) = 31,4 / (2 · 3,14) = 31,4 / 6,28 = 5.'),
    skriv('Priset för att hyra en cykel är p = 60 + 35t kr, där t är antalet timmar. '
          'Hur många timmar får man hyra för 340 kr?', t(F(340 - 60, 35)),
          '60 + 35t = 340 ger 35t = 280, alltså t = 8 timmar.'),
    val('Lös ut y ur ekvationen 2x + 3y = 12.',
        ['y = (12 − 2x)/3', 'y = 4 − 2x', 'y = 12 − 2x − 3', 'y = (12 + 2x)/3'], 'y = (12 − 2x)/3',
        'Flytta över 2x: 3y = 12 − 2x. Dela hela högerledet med 3: y = (12 − 2x)/3. '
        'Man ska dela alla termer, inte bara 12.'),
    sant('Ur s = (a + b)/2 får man a = 2s − b.', True,
         'Multiplicera båda led med 2: 2s = a + b. Subtrahera b: a = 2s − b.'),
    sant('Ur y = x/k får man x = y/k.', False,
         'Multiplicera båda led med k: yk = x. Om k = 2 och x = 10 är y = 5, men y/k = 2,5 är inte x.'),
    skriv('Medelvärdet m av tre tal ges av m = (a + b + c)/3. Medelvärdet är 8, a = 5 och b = 9. Vad är c?',
          t(F(8 * 3 - 5 - 9)),
          'Multiplicera med 3: a + b + c = 24. Då är c = 24 − 5 − 9 = 10.'),
    ordna('Ordna stegen när du löser ut x ur y = 3x + 5.',
          ['Subtrahera 5 från båda led: y − 5 = 3x', 'Dela båda led med 3: (y − 5)/3 = x',
           'Skriv x först: x = (y − 5)/3'],
          forklaring='Först tas termen utan x bort, genom att man subtraherar 5. Sedan delar man med talet som '
                     'multipliceras med x.'),
], beskrivning='Lösa ut variabler i formler med flera steg, och använda formler i problem.')

# ---------------------------------------------------------------- åk 9: sannolikhet i flera steg

assert F(8, 10) ** 2 == F(64, 100) and F(1, 2) ** 3 == F(1, 8) and 6 * 6 == 36 and F(7, 10) ** 2 == F('0.49')
assert 1 - F(7, 10) * F(1, 2) == F('0.65')

MA_AK9_SANNOLIKHET_1 = niva('ma-ak9-fler-sannolikhet-1', 'Träddiagram och oberoende händelser',
                            'Sannolikhet i flera steg', [
    skriv('Sannolikheten att bussen kommer i tid är 0,8 varje dag, och dagarna påverkar inte varandra. '
          'Hur stor är sannolikheten att den kommer i tid två dagar i rad?', t(F(8, 10) ** 2),
          'Händelserna är oberoende, så sannolikheterna multipliceras: 0,8 · 0,8 = 0,64.'),
    skriv('Ett mynt singlas tre gånger. Hur stor är sannolikheten att få klave alla tre gångerna? '
          'Svara som ett bråk.', brak(F(1, 2) ** 3),
          'Varje kast ger klave med sannolikheten 1/2. Tre kast i rad: 1/2 · 1/2 · 1/2 = 1/8.'),
    val('Du kastar en tärning två gånger. Hur många olika utfall (kombinationer av de två kasten) finns det?',
        ['36', '12', '6', '2'], t(6 * 6),
        'Första kastet kan ge 6 olika tal, och för vart och ett av dem kan det andra kastet ge 6 olika tal. '
        '6 · 6 = 36 utfall, inte 6 + 6.'),
    skriv('I en påse finns 3 röda och 7 blå kulor. Du drar en kula, tittar och lägger tillbaka den, '
          'och drar sedan en kula till. Hur stor är sannolikheten att båda kulorna är blå?', t(F(7, 10) ** 2),
          'Kulan läggs tillbaka, så sannolikheten för blå är 7/10 båda gångerna: 0,7 · 0,7 = 0,49.'),
    skriv('Sannolikheten för regn är 0,3 på lördag och 0,5 på söndag, och dagarna påverkar inte varandra. '
          'Hur stor är sannolikheten för regn minst en av dagarna?', t(1 - (1 - F(3, 10)) * (1 - F(1, 2))),
          'Räkna på motsatsen. Inget regn alls har sannolikheten 0,7 · 0,5 = 0,35. '
          'Minst en dag med regn är då 1 − 0,35 = 0,65.'),
    val('Hur räknar man ut sannolikheten för en väg genom ett träddiagram?',
        ['Multiplicerar sannolikheterna längs vägen', 'Adderar sannolikheterna längs vägen',
         'Tar medelvärdet av sannolikheterna', 'Väljer den största sannolikheten på vägen'],
        'Multiplicerar sannolikheterna längs vägen',
        'En väg betyder att första OCH andra händelsen inträffar, och då multiplicerar man. '
        'Sannolikheterna för olika vägar som alla duger adderar man.'),
    sant('Om två händelser är oberoende är sannolikheten att båda inträffar summan av deras sannolikheter.', False,
         'Sannolikheten för båda är produkten. Med sannolikheterna 0,5 och 0,4 blir det 0,5 · 0,4 = 0,2, inte 0,9.'),
    sant('Summan av sannolikheterna för alla slutliga utfall i ett träddiagram är 1.', True,
         'Något av utfallen måste inträffa, och sannolikheten för något som säkert händer är 1.'),
    para('Para ihop händelsen med dess sannolikhet.',
         [('Två klave i två kast med ett mynt', br(F(1, 2) ** 2)),
          ('Tre klave i tre kast med ett mynt', br(F(1, 2) ** 3)),
          ('Fyra klave i fyra kast med ett mynt', br(F(1, 2) ** 4)),
          ('Två sexor i två kast med en tärning', br(F(1, 6) ** 2))],
         'Multiplicera sannolikheten för ett kast lika många gånger som kasten: för mynt 1/2 · 1/2 = 1/4, och så '
         'vidare. En sexa har sannolikheten 1/6, så två sexor är 1/6 · 1/6 = 1/36.'),
], beskrivning='Träddiagram och oberoende händelser: multiplicera längs vägen, och räkna på motsatsen.')

# ---- nivå 2
assert F(5, 8) * F(4, 7) == F(5, 14) and F(2, 6) * F(1, 5) == F(1, 15)
assert F(3, 8) * F(5, 7) + F(5, 8) * F(3, 7) == F(15, 28) and F(5, 12) * F(4, 11) == F(5, 33)
assert F(2, 5) * F(1, 4) == F(1, 10) and 2 * F(3, 5) * F(2, 4) == F(3, 5) and 1 - F(8, 10) * F(7, 9) == F(17, 45)

MA_AK9_SANNOLIKHET_2 = niva('ma-ak9-fler-sannolikhet-2', 'Dragning utan återläggning', 'Sannolikhet i flera steg', [
    skriv('I en skål ligger 5 gula och 3 gröna karameller. Du tar två utan att titta och utan att lägga tillbaka '
          'någon. Hur stor är sannolikheten att båda är gula? Svara som ett bråk i enklaste form.',
          brak(F(5, 8) * F(4, 7)),
          'Den första är gul med sannolikheten 5/8. Då är 4 gula av 7 karameller kvar, så den andra är gul med '
          'sannolikheten 4/7. Produkten är 5/8 · 4/7 = 20/56 = 5/14.'),
    val('En påse har 2 vita och 4 svarta kulor. Du drar två kulor utan återläggning. '
        'Hur stor är sannolikheten att båda är vita?', ['1/15', '1/9', '2/15', '1/3'],
        enda(['1/15', '1/9', '2/15', '1/3'], lambda a: bv(a) == F(2, 6) * F(1, 5)),
        'Första kulan är vit med sannolikheten 2/6. Då finns 1 vit av 5 kulor kvar: 1/5. Produkten är '
        '2/6 · 1/5 = 2/30 = 1/15. Den som lägger tillbaka kulan får 1/3 · 1/3 = 1/9.'),
    skriv('I en påse finns 3 röda och 5 blå kulor. Du drar två kulor utan återläggning. Hur stor är sannolikheten '
          'att få en kula av varje färg? Svara som ett bråk i enklaste form.',
          brak(F(15, 28)) + ['30/56', '30 / 56'],
          'Det finns två vägar. Röd sedan blå: 3/8 · 5/7 = 15/56. Blå sedan röd: 5/8 · 3/7 = 15/56. '
          'Lägg ihop: 30/56 = 15/28.'),
    sant('När man drar utan återläggning är den andra dragningen oberoende av den första.', False,
         'Efter den första dragningen finns en kula färre i påsen, så sannolikheterna i den andra dragningen beror på '
         'vad som drogs först.'),
    skriv('En klass har 5 tjejer och 7 killar. Två elever lottas till elevrådet. Hur stor är sannolikheten att '
          'båda är tjejer? Svara som ett bråk i enklaste form.', brak(F(5, 12) * F(4, 11)),
          'Den första är en tjej med sannolikheten 5/12. Då är 4 tjejer av 11 elever kvar: 4/11. '
          'Produkten är 20/132 = 5/33.'),
    skriv('Fem kort är numrerade 1, 2, 3, 4 och 5. Du drar två kort utan återläggning. Hur stor är sannolikheten '
          'att båda korten har jämna nummer? Svara som ett bråk eller ett decimaltal.',
          brak(F(2, 5) * F(1, 4), decimal=True),
          'Jämna nummer är 2 och 4. Första kortet är jämnt med sannolikheten 2/5, och då är 1 jämnt av 4 kort kvar: '
          '1/4. Produkten är 2/20 = 1/10.'),
    val('En burk innehåller 3 gröna och 2 gula karameller. Du tar två utan att lägga tillbaka. '
        'Hur stor är sannolikheten att de har olika färg?', ['3/5', '6/25', '3/10', '12/25'],
        enda(['3/5', '6/25', '3/10', '12/25'], lambda a: bv(a) == 2 * F(3, 5) * F(2, 4)),
        'Grön sedan gul: 3/5 · 2/4 = 3/10. Gul sedan grön: 2/5 · 3/4 = 3/10. Lägg ihop: 3/10 + 3/10 = 3/5. '
        'Den som bara räknar en av ordningarna får 3/10.'),
    ordna('Ordna stegen för att räkna ut sannolikheten för två röda kulor, när påsen har 3 röda och 2 blå kulor '
          'och man drar utan återläggning.',
          ['Första kulan är röd: 3/5', 'Andra kulan är röd (en röd är borta): 2/4',
           'Multiplicera: 3/5 · 2/4 = 6/20', 'Förkorta: 6/20 = 3/10'],
          forklaring='Först sannolikheten för den första dragningen, sedan för den andra när påsen har ändrats. '
                     'Sedan multiplicerar man och förkortar.'),
    sant('Sannolikheten att minst en av två dragna kulor är röd är 1 minus sannolikheten att ingen av dem är röd.', True,
         'Antingen är minst en röd, eller så är ingen röd. De två händelserna utesluter varandra och täcker '
         'tillsammans allt, så deras sannolikheter har summan 1.'),
    skriv('En påse har 2 röda och 8 blå kulor. Du drar två kulor utan återläggning. Hur stor är sannolikheten att '
          'minst en är röd? Svara som ett bråk i enklaste form.', brak(1 - F(8, 10) * F(7, 9)),
          'Räkna på motsatsen: ingen röd, alltså två blå, har sannolikheten 8/10 · 7/9 = 56/90 = 28/45. '
          'Minst en röd är 1 − 28/45 = 17/45.'),
], beskrivning='Sannolikhet när man drar utan återläggning: bråken ändras mellan dragningarna.')

# ---------------------------------------------------------------- gy1: statistik och lägesmått

SYSKON = {0: 5, 1: 9, 2: 7, 3: 3, 4: 1}
SYSKON_DATA = [v for v, n in SYSKON.items() for _ in range(n)]
TAB = ('I en klass svarade eleverna på hur många syskon de har: 0 syskon svarade 5 elever, 1 syskon 9 elever, '
       '2 syskon 7 elever, 3 syskon 3 elever och 4 syskon 1 elev.')
assert len(SYSKON_DATA) == 25 and medel(SYSKON_DATA) == F(36, 25) and median(SYSKON_DATA) == 1
assert max(SYSKON, key=SYSKON.get) == 1 and max(SYSKON_DATA) - min(SYSKON_DATA) == 4
assert sum(k * n for k, n in SYSKON.items()) == 36
MENGD6 = [2, 3, 3, 4, 8, 20]
assert medel(MENGD6) == F(20, 3) and median(MENGD6) == F(7, 2) and max(MENGD6) - min(MENGD6) == 18
assert sum(MENGD6) == 40

MA_GY1_STATISTIK_1 = niva('ma-gy1-fler-statistik-1', 'Frekvenstabeller och lägesmått', 'Statistik och lägesmått', [
    skriv(TAB + ' Hur många elever finns det i klassen?', t(len(SYSKON_DATA)),
          'Lägg ihop antalen: 5 + 9 + 7 + 3 + 1 = 25 elever.'),
    skriv(TAB + ' Vilket är typvärdet för antalet syskon?', t(max(SYSKON, key=SYSKON.get)),
          'Typvärdet är det värde som förekommer flest gånger. Flest elever, 9 stycken, har 1 syskon.'),
    skriv(TAB + ' Vad är medelvärdet av antalet syskon?', t(medel(SYSKON_DATA)),
          'Summan av alla syskon är 0 · 5 + 1 · 9 + 2 · 7 + 3 · 3 + 4 · 1 = 36. Dela med antalet elever: '
          '36 : 25 = 1,44.'),
    val(TAB + ' Vad är medianen för antalet syskon?', ['1', '2', '1,5', '1,44'], t(median(SYSKON_DATA)),
        'Med 25 elever är medianen värdet hos elev nr 13 när eleverna är ordnade. De första 5 har 0 syskon och '
        'nr 6 till 14 har 1 syskon, så elev nr 13 har 1 syskon. 2 är mitten av värdena 0 till 4, men det är inte '
        'medianen.'),
    skriv(TAB + ' Vad är variationsbredden för antalet syskon?', t(max(SYSKON_DATA) - min(SYSKON_DATA)),
          'Variationsbredden är största värdet minus minsta värdet: 4 − 0 = 4.'),
    skriv('Medelvärdet av fem tal är 8. Fyra av talen är 5, 7, 9 och 11. Vad är det femte talet?',
          t(5 * 8 - (5 + 7 + 9 + 11)),
          'De fem talens summa är 5 · 8 = 40. De fyra kända talen har summan 32. Det femte talet är 40 − 32 = 8.'),
    sant('Medianen kan vara ett tal som inte finns bland värdena i datamängden.', median([2, 4, 6, 10]) not in (2, 4, 6, 10),
         'Med ett jämnt antal värden är medianen medelvärdet av de två mittersta. För 2, 4, 6, 10 är medianen 5, '
         'som inte finns bland värdena.'),
    sant('Typvärdet är alltid det största värdet i datamängden.', False,
         'Typvärdet är det vanligaste värdet. I 2, 5, 5, 9 är typvärdet 5, men det största värdet är 9.'),
    para('Para ihop begreppet med rätt beskrivning.',
         [('Medelvärde', 'Summan av värdena delad med antalet värden'),
          ('Median', 'Det mittersta värdet när värdena är ordnade'),
          ('Typvärde', 'Det värde som förekommer flest gånger'),
          ('Variationsbredd', 'Största värdet minus minsta värdet')],
         'Medelvärdet och medianen visar var värdena ligger, typvärdet vilket som är vanligast, och '
         'variationsbredden hur långt det är mellan de yttersta värdena.'),
    ordna_tal('Datamängden är 2, 3, 3, 4, 8 och 20. Ordna de fyra måtten från minst till störst värde.',
              [('Typvärdet', F(3)), ('Medianen', median(MENGD6)), ('Medelvärdet', medel(MENGD6)),
               ('Variationsbredden', F(max(MENGD6) - min(MENGD6)))],
              'Typvärdet är 3. Medianen är (3 + 4)/2 = 3,5. Medelvärdet är 40/6, ungefär 6,7. '
              'Variationsbredden är 20 − 2 = 18.'),
], beskrivning='Frekvenstabeller, medelvärde, median, typvärde och variationsbredd.')

# ---- nivå 2
A8 = [14, 6, 20, 4, 15, 9, 7, 12]
B12 = [13, 5, 24, 8, 15, 3, 18, 10, 6, 16, 12, 9]
assert kvartiler(A8) == (F(13, 2), F(29, 2)) and median(A8) == F(21, 2)
assert kvartiler(B12) == (7, F(31, 2)) and median(B12) == 11
q1_, q3_ = kvartiler(A8)
assert q3_ - q1_ == 8
assert median([1, 2, 3]) == 2 and median([4, 20, 30]) == 20
assert F(2 + 20, 2) == 11 and median([1, 2, 3, 4, 20, 30]) == F(7, 2)

MA_GY1_STATISTIK_2 = niva('ma-gy1-fler-statistik-2', 'Kvartiler och lådagram', 'Statistik och lägesmått', [
    skriv('Åtta värden är 14, 6, 20, 4, 15, 9, 7 och 12. Vad är nedre kvartilen?', t(kvartiler(A8)[0]),
          'Ordna först: 4, 6, 7, 9, 12, 14, 15, 20. Nedre halvan är 4, 6, 7, 9, och nedre kvartilen är dess '
          'median: (6 + 7)/2 = 6,5.'),
    skriv('Åtta värden är 14, 6, 20, 4, 15, 9, 7 och 12. Vad är övre kvartilen?', t(kvartiler(A8)[1]),
          'Ordnat: 4, 6, 7, 9, 12, 14, 15, 20. Övre halvan är 12, 14, 15, 20, och dess median är '
          '(14 + 15)/2 = 14,5.'),
    skriv('Åtta värden är 14, 6, 20, 4, 15, 9, 7 och 12. Vad är kvartilavståndet?',
          t(kvartiler(A8)[1] - kvartiler(A8)[0]),
          'Kvartilavståndet är övre kvartilen minus nedre kvartilen: 14,5 − 6,5 = 8.'),
    val('Ett lådagram har minsta värdet 4, nedre kvartilen 6,5, medianen 10,5, övre kvartilen 14,5 och största '
        'värdet 20. Hur stor del av värdena ligger i själva lådan, mellan 6,5 och 14,5?',
        ['Hälften', 'En fjärdedel', 'Tre fjärdedelar', 'Alla'], 'Hälften',
        'Mellan nedre och övre kvartilen ligger de mittersta 50 % av värdena: en fjärdedel mellan nedre kvartilen '
        'och medianen och en fjärdedel mellan medianen och övre kvartilen.'),
    val('Vad visar lådan i ett lådagram?',
        ['De mittersta 50 % av värdena', 'Alla värden från minsta till största', 'De 25 % största värdena',
         'Medelvärdet och medianen'], 'De mittersta 50 % av värdena',
        'Lådan går från nedre till övre kvartilen och innehåller den mittersta hälften av värdena. '
        'Linjerna ut från lådan går till minsta och största värdet.'),
    skriv('Tolv värden är 13, 5, 24, 8, 15, 3, 18, 10, 6, 16, 12 och 9. Vad är medianen?', t(median(B12)),
          'Ordnat: 3, 5, 6, 8, 9, 10, 12, 13, 15, 16, 18, 24. De mittersta är det sjätte och sjunde värdet, 10 och '
          '12. Medianen är (10 + 12)/2 = 11.'),
    skriv('Tolv värden är 13, 5, 24, 8, 15, 3, 18, 10, 6, 16, 12 och 9. Vad är övre kvartilen?',
          t(kvartiler(B12)[1]),
          'Ordnat: 3, 5, 6, 8, 9, 10, 12, 13, 15, 16, 18, 24. Övre halvan är 12, 13, 15, 16, 18, 24, och dess '
          'median ligger mellan tredje och fjärde värdet: (15 + 16)/2 = 15,5.'),
    sant('Kvartilavståndet påverkas mindre av ett extremt värde än variationsbredden.', True,
         'Variationsbredden bygger på det största och minsta värdet, som kan vara extrema. Kvartilavståndet bygger '
         'på de mittersta 50 %, så ett enstaka extremvärde ändrar det inte.'),
    sant('Medianen ligger alltid exakt mitt emellan nedre och övre kvartilen.', False,
         'För 1, 2, 3, 4, 20, 30 är nedre kvartilen 2, medianen 3,5 och övre kvartilen 20. Mitt emellan '
         'kvartilerna ligger 11, inte 3,5.'),
    para('Para ihop begreppet med rätt förklaring.',
         [('Nedre kvartilen', 'Medianen i den nedre halvan av värdena'),
          ('Övre kvartilen', 'Medianen i den övre halvan av värdena'),
          ('Kvartilavstånd', 'Övre kvartilen minus nedre kvartilen'),
          ('Variationsbredd', 'Största värdet minus minsta värdet')],
         'Kvartilerna delar de ordnade värdena i fyra lika stora grupper. Kvartilavståndet mäter spridningen i '
         'mitten och variationsbredden spridningen mellan de yttersta värdena.'),
], beskrivning='Kvartiler, kvartilavstånd och vad ett lådagram visar.')

# ---- nivå 3
LONER = [28000, 29000, 30000, 31000, 120000]
assert median(LONER) == 30000 and medel(LONER) == 47600 and sum(LONER) == 238000
assert F(10 * 6 + 20 * 9, 30) == 8 and F(5 * 12 + 18, 6) == 13 and F(96, 92) < F(105, 100)
assert 18 - 12 == 6 and 20 - 8 == 12
KLASSER = [4, 11, 5]
assert sum(KLASSER) == 20 and KLASSER[0] < 10 and KLASSER[0] + KLASSER[1] >= 11

MA_GY1_STATISTIK_3 = niva('ma-gy1-fler-statistik-3', 'Jämföra och tolka data', 'Statistik och lägesmått', [
    val('Lönerna på en liten firma är 28 000, 29 000, 30 000, 31 000 och 120 000 kr i månaden. '
        'Vilket lägesmått ger bäst bild av en typisk lön?',
        ['Medianen', 'Medelvärdet', 'Största värdet', 'Variationsbredden'], 'Medianen',
        'Medianen är 30 000 kr, och det är en typisk lön. Medelvärdet är 47 600 kr och dras upp av den enda mycket '
        'höga lönen. Största värdet och variationsbredden är inga lägesmått.'),
    skriv('Lönerna på en liten firma är 28 000, 29 000, 30 000, 31 000 och 120 000 kr i månaden. '
          'Vad är medelvärdet av lönerna, i kronor?', [t(medel(LONER)), '47600'],
          'Summan är 238 000 kr. Delat med 5 blir det 47 600 kr.'),
    skriv('En grupp om 10 elever har medelvärdet 6 poäng på ett prov och en grupp om 20 elever har medelvärdet '
          '9 poäng. Vad är medelvärdet för alla 30 eleverna?', t(F(10 * 6 + 20 * 9, 30)),
          'Poängsumman är 10 · 6 + 20 · 9 = 60 + 180 = 240. Delat med 30 elever blir det 8. Medelvärdet av 6 och 9, '
          'alltså 7,5, blir fel, för grupperna är olika stora.'),
    val('Två klasser har samma median, 15 poäng. I klass X är kvartilerna 12 och 18, och i klass Y är kvartilerna '
        '8 och 20. Vilken klass har störst spridning bland de mittersta resultaten?',
        ['Klass Y', 'Klass X', 'Lika stor', 'Går inte att avgöra'], 'Klass Y',
        'Kvartilavståndet är 18 − 12 = 6 i klass X och 20 − 8 = 12 i klass Y. Större kvartilavstånd betyder större '
        'spridning bland de mittersta 50 % av resultaten.'),
    val('Ett histogram har klasserna 0–9, 10–19 och 20–29, med 4, 11 respektive 5 värden. '
        'Vilken klass innehåller medianen?', ['10–19', '0–9', '20–29', 'Går inte att avgöra'], '10–19',
        'Det finns 20 värden, så medianen ligger mellan det 10:e och det 11:e. Första klassen har värde nr 1 till 4 '
        'och andra klassen nr 5 till 15. Båda mittvärdena ligger alltså i klassen 10–19.'),
    sant('Ett urval är representativt om det liknar hela den grupp man vill undersöka.', True,
         'Då går det att dra slutsatser om hela gruppen. Ett urval som missar vissa grupper ger en skev bild.'),
    sant('Man vill veta vad invånarna i en stad tycker om bussarna och frågar bara människor som står på en '
         'busshållplats. Då är urvalet representativt för alla invånare.', False,
         'De som står på en busshållplats åker oftare buss än andra. Urvalet blir skevt. '
         'Ett bättre urval lottas ur alla invånare.'),
    val('Ett stapeldiagram har y-axeln startande på 90 i stället för 0, och staplarna visar 92 och 96. '
        'Vilken effekt ger det?',
        ['Skillnaden ser större ut än den är', 'Skillnaden ser mindre ut än den är', 'Staplarna blir lika höga',
         'Ingenting ändras'], 'Skillnaden ser större ut än den är',
        'Staplarna börjar på 90, så de visar bara 2 och 6 enheter. Den ena ser tre gånger så hög ut som den andra, '
        'fast 96 bara är ungefär 4 % mer än 92.'),
    skriv('Fem tal har medelvärdet 12. Ett sjätte tal, 18, läggs till. Vad är det nya medelvärdet?',
          t(F(5 * 12 + 18, 6)),
          'De fem talens summa är 5 · 12 = 60. Med 18 blir summan 78 på 6 tal, och 78 : 6 = 13.'),
    para('Para ihop situationen med det mått som passar bäst.',
         [('Vilken skostorlek en butik ska beställa flest av', 'Typvärdet'),
          ('En typisk lön när en chef tjänar mycket mer än alla andra', 'Medianen'),
          ('Hur mycket regn som faller per dag i snitt under en månad', 'Medelvärdet'),
          ('Skillnaden mellan dagens högsta och lägsta temperatur', 'Variationsbredden')],
         'Det vanligaste värdet ger typvärdet. Medianen påverkas inte av enstaka extrema värden. Ett snitt per dag är '
         'ett medelvärde, och skillnaden mellan högsta och lägsta värdet är variationsbredden.'),
], beskrivning='Jämföra datamängder, välja lämpligt mått och granska urval och diagram.')

# ---------------------------------------------------------------- gy2: andragradsfunktioner


def sym(a, b):
    """Symmetrilinjen x = −b/(2a) för y = ax² + bx + c."""
    return F(-b, 2 * a)


def pq(p, q):
    """De reella lösningarna till x² + px + q = 0, exakt. Frågorna har heltalslösningar."""
    p, q = F(p), F(q)
    d = (p / 2) ** 2 - q
    assert d >= 0
    a, b = math.isqrt(d.numerator), math.isqrt(d.denominator)
    assert a * a == d.numerator and b * b == d.denominator, (p, q)
    return {-p / 2 + F(a, b), -p / 2 - F(a, b)}


assert sym(1, -8) == 4 and sym(1, 6) == -3 and F(2 + 10, 2) == 6
assert 0 ** 2 - 4 * 0 - 5 == -5
f6 = lambda x: x * x - 6 * x + 10
assert sym(1, -6) == 3 and f6(1) == f6(5) == 5 and 3 + (3 - 1) == 5
assert sym(1, -10) == 5 and sym(1, 2) == -1 and F(3 + -9, 2) == -3 and sym(2, -12) == 3
assert pq(-4, 3) == {1, 3} and pq(4, 3) == {-1, -3}
assert [x for x in (F(1), F(3), F(-1), F(-3), F(4)) if x * x - 4 * x + 3 == 0] == [1, 3]

MA_GY2_PARABEL_1 = niva('ma-gy2-fler-parabel-1', 'Symmetri och nollställen', 'Andragradsfunktioner', [
    val('Vilket påstående stämmer för funktionen y = −2x² + 8x − 3?',
        ['Den har ett största värde', 'Den har ett minsta värde', 'Den har varken största eller minsta värde',
         'Den har två största värden'], 'Den har ett största värde',
        'Koefficienten framför x² är −2, alltså negativ. Parabeln öppnar sig nedåt och har en högsta punkt men '
        'inget minsta värde.'),
    skriv('Grafen till y = x² − 8x + 5 är en parabel. Vilket x-värde har symmetrilinjen?', x_svar(sym(1, -8)),
          'För y = x² + px + q ligger symmetrilinjen vid x = −p/2. Här är p = −8, så x = 4.'),
    skriv('Grafen till y = x² + 6x − 1 är en parabel. Vilket x-värde har symmetrilinjen?', x_svar(sym(1, 6)),
          'Symmetrilinjen ligger vid x = −p/2 = −6/2 = −3.'),
    skriv('En parabel har nollställena x = 2 och x = 10. Vilket x-värde har symmetrilinjen?', x_svar(F(2 + 10, 2)),
          'Symmetrilinjen går mitt emellan nollställena: (2 + 10)/2 = 6.'),
    skriv('Vad är f(0) för funktionen f(x) = x² − 4x − 5?', neg_svar(-5) + ['f(0) = -5', 'f(0) = - 5'],
          'Sätt in x = 0: f(0) = 0 − 0 − 5 = −5. Det är där parabeln skär y-axeln, och det är alltid termen utan x.'),
    skriv('Funktionen y = x² − 6x + 10 har samma y-värde för x = 1 som för ett annat x-värde a. Vad är a?',
          x_svar(F(5), 'a'),
          'Symmetrilinjen är x = 3. Punkterna x = 1 och x = a ligger lika långt från 3 på var sin sida, så a = 5. '
          'Kontroll: y(1) = 1 − 6 + 10 = 5 och y(5) = 25 − 30 + 10 = 5.'),
    sant('Alla parabler y = ax² + bx + c med a > 0 har ett minsta värde.', True,
         'Med a > 0 öppnar sig parabeln uppåt och har en lägsta punkt.'),
    sant('En parabel har alltid två nollställen.', False,
         'Den kan ha två, ett eller inga. Parabeln y = x² + 1 ligger helt ovanför x-axeln och har inga nollställen.'),
    para('Para ihop funktionen med x-värdet på symmetrilinjen.',
         [('y = x² − 10x + 3', 'x = %s' % m(sym(1, -10))), ('y = x² + 2x', 'x = %s' % m(sym(1, 2))),
          ('y = (x − 3)(x + 9)', 'x = %s' % m(F(3 - 9, 2))), ('y = 2x² − 12x + 1', 'x = %s' % m(sym(2, -12)))],
         'För y = ax² + bx + c är symmetrilinjen x = −b/(2a). När nollställena syns tar man deras medelvärde: '
         '(3 + (−9))/2 = −3.'),
    val('Vilka är nollställena till y = x² − 4x + 3?',
        ['x = 1 och x = 3', 'x = −1 och x = −3', 'x = 1 och x = −3', 'x = 4 och x = 3'], 'x = 1 och x = 3',
        'x² − 4x + 3 = 0 ger med pq-formeln x = 2 ± √(4 − 3) = 2 ± 1, alltså x = 1 eller x = 3. '
        'Kontroll: 3² − 4 · 3 + 3 = 0.'),
], beskrivning='Parabelns riktning, symmetrilinje, nollställen och skärning med y-axeln.')

# ---- nivå 2
assert (3 ** 2 - 6 * 3 + 13) == 4 and (-(4 ** 2) + 8 * 4 - 7) == 9
assert kvadrat_ok(lambda x: x * x + 10 * x + 7, lambda x: (x + 5) ** 2 - 18)
assert sym(-2, 12) == 3 and -2 * 9 + 12 * 3 - 5 == 13
KOMPL = [('(x − 4)² − 10', lambda x: (x - 4) ** 2 - 10), ('(x − 8)² − 58', lambda x: (x - 8) ** 2 - 58),
         ('(x − 4)² + 6', lambda x: (x - 4) ** 2 + 6), ('(x + 4)² − 10', lambda x: (x + 4) ** 2 - 10)]
KOMPL_SVAR = [a for a, f in KOMPL if kvadrat_ok(f, lambda x: x * x - 8 * x + 6)]
assert KOMPL_SVAR == ['(x − 4)² − 10']
# (x − 1)² + 3 och x² + 4 ligger över x-axeln: minsta värdet är positivt.
assert min((x - 1) ** 2 + 3 for x in range(-5, 8)) == 3 and min(x * x + 4 for x in range(-5, 6)) == 4
assert sym(1, 4) == -2 and (-2 + 2) ** 2 - 5 == -5

MA_GY2_PARABEL_2 = niva('ma-gy2-fler-parabel-2', 'Största och minsta värde', 'Andragradsfunktioner', [
    val('Vilken är minimipunkten för y = (x − 3)² + 2?', ['(3, 2)', '(−3, 2)', '(3, −2)', '(2, 3)'], '(3, 2)',
        'En kvadrat är aldrig negativ och är som minst 0, när x − 3 = 0, alltså x = 3. Då är y = 0 + 2 = 2. '
        'Minimipunkten är (3, 2).'),
    skriv('Vilket är det minsta värdet för y = x² − 6x + 13?', t(3 ** 2 - 6 * 3 + 13),
          'Symmetrilinjen är x = 3, och där ligger minimipunkten. y(3) = 9 − 18 + 13 = 4.'),
    skriv('Vilket är det största värdet för y = −x² + 8x − 7?', t(-(4 ** 2) + 8 * 4 - 7),
          'Parabeln öppnar sig nedåt. Symmetrilinjen är x = −8/(2 · (−1)) = 4. y(4) = −16 + 32 − 7 = 9.'),
    skriv('Skriv x² + 10x + 7 på formen (x + a)² + b. Vad är b?', neg_svar(-18) + ['b = -18', 'b = - 18'],
          '(x + 5)² = x² + 10x + 25. Det är 18 för mycket, så x² + 10x + 7 = (x + 5)² − 18. Alltså b = −18.'),
    val('Vilket uttryck är x² − 8x + 6 skrivet med kvadratkomplettering?', [a for a, _ in KOMPL], KOMPL_SVAR[0],
        '(x − 4)² = x² − 8x + 16. Det är 10 för mycket, så x² − 8x + 6 = (x − 4)² − 10.'),
    skriv('För vilket x-värde har y = −2x² + 12x − 5 sitt största värde?', x_svar(sym(-2, 12)),
          'Symmetrilinjen är x = −b/(2a) = −12/(2 · (−2)) = 3. Parabeln öppnar sig nedåt, så där ligger den högsta '
          'punkten.'),
    sant('Extrempunkten för y = (x + 2)² − 5 är (−2, −5).', True,
         'Termen (x + 2)² är som minst 0, när x = −2. Då är y = −5. Minimipunkten är (−2, −5).'),
    sant('Funktionen y = x² + 4 har två nollställen.', False,
         'x² är aldrig negativt, så x² + 4 är minst 4. Grafen når aldrig y = 0 och har inga nollställen.'),
    val('Hur många nollställen har y = (x − 1)² + 3?', ['Inga', 'Ett', 'Två', 'Tre'], 'Inga',
        'Det minsta värdet är 3, när x = 1. Grafen ligger hela tiden ovanför x-axeln och skär den aldrig.'),
    para('Para ihop funktionen med dess extrempunkt (högsta eller lägsta punkt).',
         [('y = (x − 1)² + 4', '(1, 4)'), ('y = (x + 5)² − 2', '(−5, −2)'), ('y = −(x − 2)² + 7', '(2, 7)'),
          ('y = x² − 9', '(0, −9)')],
         'I y = a(x − h)² + k ligger extrempunkten i (h, k). Tecknet på h byts: x + 5 betyder h = −5.'),
], beskrivning='Största och minsta värde, extrempunkten och kvadratkomplettering.')

# ---- nivå 3
h_ = lambda t_: -5 * t_ * t_ + 20 * t_ + 1
assert sym(-5, 20) == 2 and h_(2) == 21 and h_(4) == 1 and h_(4) > 0
assert pq(-4, 0) == {0, 4}  # −5t² + 20t = 0 ⇔ t² − 4t = 0
assert sym(-2, 40) == 10 and 40 - 2 * 10 == 20
assert max(x * (12 - x) for x in range(0, 13)) == 36 and sym(-1, 12) == 6
assert min(x * (x + 6) for x in range(-10, 5)) == -9 and sym(1, 6) == -3
vinst = lambda x: -2 * x * x + 80 * x - 300
assert sym(-2, 80) == 20 and vinst(20) == 500 and max(vinst(x) for x in range(0, 41)) == vinst(20)
assert min(x * x + 6 * x + 10 for x in range(-8, 3)) == 1
PAR_9 = [('y = −2(x − 1)(x − 7)', lambda x: -2 * (x - 1) * (x - 7)), ('y = 2(x − 1)(x − 7)', lambda x: 2 * (x - 1) * (x - 7)),
         ('y = −(x − 1)(x − 7)', lambda x: -(x - 1) * (x - 7)), ('y = −2(x + 1)(x + 7)', lambda x: -2 * (x + 1) * (x + 7))]
PAR_9_SVAR = [a for a, f in PAR_9
              if f(F(1)) == 0 and f(F(7)) == 0 and f(F(4)) == 18 and f(F(4)) == max(f(F(x, 2)) for x in range(-20, 41))]
assert PAR_9_SVAR == ['y = −2(x − 1)(x − 7)']

MA_GY2_PARABEL_3 = niva('ma-gy2-fler-parabel-3', 'Andragradsfunktioner i problem', 'Andragradsfunktioner', [
    skriv('Höjden h meter över marken för en boll är h = −5t² + 20t + 1, där t är tiden i sekunder efter kastet. '
          'Efter hur många sekunder är bollen som högst?', x_svar(sym(-5, 20), 't'),
          'Bollbanan är en parabel som öppnar sig nedåt. Högsta punkten ligger på symmetrilinjen '
          't = −20/(2 · (−5)) = 2 sekunder.'),
    skriv('Höjden h meter över marken för en sten som kastas upp från marken är h = −5t² + 20t, där t är tiden i '
          'sekunder. Efter hur många sekunder landar stenen?', x_svar(F(4), 't'),
          'Stenen är på marken när h = 0. −5t² + 20t = 0 ger −5t(t − 4) = 0, så t = 0 (kastet) eller t = 4. '
          'Stenen landar efter 4 sekunder.'),
    skriv('En hage med tre stängda sidor byggs mot en lång mur. Det finns 40 m stängsel. De två sidorna vinkelrätt '
          'mot muren är x meter långa var, och sidan längs muren är 40 − 2x meter. För vilket x blir arean störst?',
          x_svar(sym(-2, 40)),
          'Arean är A = x(40 − 2x) = −2x² + 40x. Den är störst på symmetrilinjen x = −40/(2 · (−2)) = 10 m. '
          'Sidan längs muren blir då 40 − 20 = 20 m.'),
    skriv('Summan av två tal är 12. Vilken är den största produkt de kan ha?', t(6 * 6),
          'Kallar man talen x och 12 − x blir produkten x(12 − x) = −x² + 12x. Den är störst vid x = 6, och då är '
          'produkten 6 · 6 = 36.'),
    skriv('Två tal skiljer sig med 6, så det ena är x och det andra x + 6. Vilket är det minsta värde som '
          'produkten kan få?', neg_svar(-9),
          'Produkten är x(x + 6) = x² + 6x. Det minsta värdet ligger på symmetrilinjen x = −3, där produkten är '
          '(−3) · 3 = −9.'),
    val('Ett företags vinst V kr när det säljer x enheter är V = −2x² + 80x − 300. '
        'Hur många enheter ger störst vinst?', ['20', '40', '80', '10'], t(sym(-2, 80)),
        'Vinsten beskrivs av en parabel som öppnar sig nedåt. Den är störst vid x = −80/(2 · (−2)) = 20 enheter. '
        'Då är vinsten −800 + 1 600 − 300 = 500 kr.'),
    sant('Höjden h = −5t² + 20t + 1 meter är positiv efter 4 sekunder, så bollen är då fortfarande över marken.',
         h_(4) > 0,
         'h(4) = −5 · 16 + 80 + 1 = 1. Höjden är 1 meter, så bollen är kvar i luften.'),
    sant('Funktionen y = x² + 6x + 10 har minsta värdet 10.', False,
         'Symmetrilinjen är x = −3 och y(−3) = 9 − 18 + 10 = 1. Det minsta värdet är 1. Talet 10 är värdet vid '
         'x = 0, där parabeln skär y-axeln.'),
    val('En parabel har nollställena x = 1 och x = 7 och största värdet 18. Vilken funktion kan det vara?',
        [a for a, _ in PAR_9], PAR_9_SVAR[0],
        'Nollställena ger faktorerna (x − 1)(x − 7). Det största värdet ligger mitt emellan, vid x = 4, där '
        '(4 − 1)(4 − 7) = −9. För att få 18 krävs en faktor a = −2 framför.'),
    ordna('Ordna stegen för att hitta bollens högsta höjd när h = −5t² + 20t + 1.',
          ['Symmetrilinjen: t = −20/(2 · (−5)) = 2', 'Sätt in t = 2: h(2) = −5 · 4 + 40 + 1',
           'Räkna ut: h(2) = 21', 'Svar: bollen når som mest 21 m'],
          forklaring='Först hittas t-värdet för den högsta punkten, sedan sätts det in i funktionen.'),
], beskrivning='Andragradsfunktioner i problem: kastbanor, areor, produkter och vinst.')

# ---------------------------------------------------------------- gy3: komplexa tal

assert [1, 1j, -1, -1j][50 % 4] == -1 and 1j ** 3 == -1j
assert (3 + 2j) + (4 - 5j) == 7 - 3j and (2 + 3j) * (1 - 4j) == 14 - 5j and (1 + 1j) ** 2 == 2j
K5 = ['7 − 3i', '7 + 3i', '−1 + 7i', '12 − 10i']
K6 = ['14 − 5i', '−10 − 5i', '2 − 12i', '14 + 5i']
K2 = ['−i', 'i', '−1', '1']
assert cplx('3 − i') == 3 - 1j and cplx('2i') == 2j and cplx('−i') == -1j and cplx('−4') == -4
assert ktext(7 - 3j) == '7 − 3i' and ktext(2j) == '2i' and ktext(3 - 1j) == '3 − i' and ktext(-1j) == '−i'

MA_GY3_KOMPLEXA_1 = niva('ma-gy3-fler-komplexa-1', 'Imaginära enheten och räkneregler', 'Komplexa tal', [
    skriv('Vad är i²?', neg_svar(-1), 'Den imaginära enheten i är definierad så att i² = −1.'),
    val('Vad är i³?', K2, enda(K2, lambda a: cplx(a) == 1j ** 3),
        'i³ = i² · i = (−1) · i = −i.'),
    skriv('Vad är i⁵⁰?', neg_svar([1, 1j, -1, -1j][50 % 4].real),
          'Potenserna av i upprepas i en period om fyra: i, −1, −i, 1. 50 delat med 4 ger resten 2, '
          'så i⁵⁰ = i² = −1.'),
    val('Vilka är realdelen och imaginärdelen av z = 3 − 5i?',
        ['Re z = 3 och Im z = −5', 'Re z = 3 och Im z = −5i', 'Re z = −5 och Im z = 3', 'Re z = 3 och Im z = 5'],
        'Re z = 3 och Im z = −5',
        'Realdelen är talet utan i: 3. Imaginärdelen är det reella talet framför i, med tecken: −5. '
        'Imaginärdelen innehåller inte själva i.'),
    val('Beräkna (3 + 2i) + (4 − 5i).', K5, enda(K5, lambda a: cplx(a) == (3 + 2j) + (4 - 5j)),
        'Addera realdelarna och imaginärdelarna var för sig: 3 + 4 = 7 och 2 − 5 = −3. Svaret är 7 − 3i.'),
    val('Beräkna (2 + 3i)(1 − 4i).', K6, enda(K6, lambda a: cplx(a) == (2 + 3j) * (1 - 4j)),
        'Multiplicera in: 2 − 8i + 3i − 12i². Eftersom i² = −1 är −12i² = +12. Realdelen är 2 + 12 = 14 och '
        'imaginärdelen −8 + 3 = −5. Svaret är 14 − 5i.'),
    skriv('Beräkna (1 + i)². Svara på formen a + bi.', ['2i', '2 i', '0 + 2i', '0+2i'],
          '(1 + i)² = 1 + 2i + i² = 1 + 2i − 1 = 2i.'),
    sant('Alla reella tal är också komplexa tal.', True,
         'Ett reellt tal a kan skrivas a + 0i, och det är ett komplext tal med imaginärdelen 0.'),
    sant('Det finns ett reellt tal x sådant att x² = −1.', False,
         'Kvadraten av ett reellt tal är aldrig negativ. Därför behövdes den imaginära enheten i, med i² = −1.'),
    para('Para ihop potensen av i med dess värde.',
         [('i¹', ktext(1j)), ('i²', ktext(1j ** 2)), ('i³', ktext(1j ** 3)), ('i⁴', ktext(1j ** 4))],
         'i² = −1, i³ = i² · i = −i och i⁴ = i² · i² = (−1) · (−1) = 1. Sedan upprepas serien.'),
], beskrivning='Den imaginära enheten i, real- och imaginärdel, addition och multiplikation.')

# ---- nivå 2
assert cplx('3 + 4i') == 3 + 4j
Q1K = ['4 + 7i', '−4 + 7i', '−4 − 7i', '7 − 4i']
Q3K = ['3 + 4i', '3 − 4i', '6 + 8i', '4 + 3i']
assert abs((7 + 1j) / (1 - 1j) - (3 + 4j)) < 1e-12 and (7 + 1j) * (1 + 1j) == 6 + 8j and (1 - 1j) * (1 + 1j) == 2
assert (3j) ** 2 == -9 and (-3j) ** 2 == -9
assert 8 * 8 + 15 * 15 == 17 * 17
assert (6 + 2j) * (3 - 1j) == 20 and [a for a in range(-9, 10) if ((a + 2j) * (3 - 1j)).imag == 0] == [6]
for z_ in (2 + 3j, 3 + 4j, 1 - 5j):
    assert z_ * z_.conjugate() == abs(z_) ** 2 or abs(z_ * z_.conjugate() - abs(z_) ** 2) < 1e-9
    assert (z_ * z_.conjugate()).imag == 0
for a_, b_, c_ in ((3, 4, 5), (12, 5, 13), (7, 24, 25), (20, 21, 29)):
    assert a_ * a_ + b_ * b_ == c_ * c_


def rot_ok(p, q, a, b):
    """x² + px + q = 0 har lösningarna a ± bi."""
    return all(abs(z * z + p * z + q) < 1e-9 for z in (complex(a, b), complex(a, -b)))


K5B = [('x = 2 ± 3i', (2, 3)), ('x = −2 ± 3i', (-2, 3)), ('x = 2 ± 9i', (2, 9)), ('x = 4 ± 3i', (4, 3))]
K5B_SVAR = [a for a, (aa, bb) in K5B if rot_ok(-4, 13, aa, bb)]
assert K5B_SVAR == ['x = 2 ± 3i']

MA_GY3_KOMPLEXA_2 = niva('ma-gy3-fler-komplexa-2', 'Konjugat, belopp och division', 'Komplexa tal', [
    val('Vad är konjugatet till z = 4 − 7i?', Q1K, enda(Q1K, lambda a: cplx(a) == (4 - 7j).conjugate()),
        'Konjugatet får man genom att byta tecken på imaginärdelen: 4 − 7i blir 4 + 7i. Realdelen är kvar.'),
    skriv('Vad är absolutbeloppet |−8 + 15i|?', t(math.isqrt(8 * 8 + 15 * 15)),
          'Absolutbeloppet är √(a² + b²) = √(64 + 225) = √289 = 17.'),
    val('Beräkna (7 + i)/(1 − i).', Q3K, enda(Q3K, lambda a: abs(cplx(a) - (7 + 1j) / (1 - 1j)) < 1e-9),
        'Förläng med nämnarens konjugat 1 + i. Täljaren: (7 + i)(1 + i) = 7 + 7i + i + i² = 6 + 8i. '
        'Nämnaren: (1 − i)(1 + i) = 1 − i² = 2. Dela: (6 + 8i)/2 = 3 + 4i.'),
    skriv('Lös ekvationen z² + 9 = 0. Vilken lösning har positiv imaginärdel? Svara på formen a + bi.',
          ['3i', '3 i', '0 + 3i', '0+3i'],
          'z² = −9 ger z = ±3i, eftersom (3i)² = 9 · i² = −9. Den lösning som har positiv imaginärdel är 3i.'),
    val('Lös ekvationen x² − 4x + 13 = 0.', [a for a, _ in K5B], K5B_SVAR[0],
        'Med pq-formeln: x = 2 ± √(4 − 13) = 2 ± √(−9) = 2 ± 3i. Komplexa lösningar till en ekvation med reella '
        'koefficienter kommer som ett konjugatpar.'),
    skriv('För vilket reellt tal a är produkten (a + 2i)(3 − i) ett reellt tal?', t(6),
          'Multiplicera: 3a − ai + 6i − 2i² = (3a + 2) + (6 − a)i. Imaginärdelen 6 − a ska vara 0, så a = 6. '
          'Produkten är då 20.'),
    sant('Konjugatet till ett reellt tal är talet självt.', True,
         'Ett reellt tal har imaginärdelen 0, och att byta tecken på 0 ändrar ingenting.'),
    sant('Absolutbeloppet av ett komplext tal kan vara negativt.', False,
         '|a + bi| = √(a² + b²) är en kvadratrot ur en summa av kvadrater, och den är aldrig negativ.'),
    sant('Ett komplext tal multiplicerat med sitt konjugat är alltid ett reellt tal.', True,
         '(a + bi)(a − bi) = a² − b²i² = a² + b². Det är ett reellt tal, och det är lika med |z|².'),
    para('Para ihop talet med dess absolutbelopp.',
         [('3 + 4i', '5'), ('12 − 5i', '13'), ('7 + 24i', '25'), ('20 + 21i', '29')],
         '|a + bi| = √(a² + b²): √(9 + 16) = 5, √(144 + 25) = 13, √(49 + 576) = 25 och √(400 + 441) = 29.'),
], beskrivning='Konjugat, absolutbelopp, division och andragradsekvationer med komplexa lösningar.')

# ---- nivå 3
import cmath


def polar(r, v):
    """r(cos v° + i sin v°) som komplext tal."""
    return r * complex(math.cos(math.radians(v)), math.sin(math.radians(v)))


def ptext(r, v):
    return '%d(cos %d° + i sin %d°)' % (r, v, v)


def lika_k(a, b):
    return abs(a - b) < 1e-9


assert lika_k(abs(1 + math.sqrt(3) * 1j), 2) and round(math.degrees(cmath.phase(-1 - 1j)) % 360) == 225
P3 = [(2, 90), (2, 0), (2, 180), (4, 90)]
P3_SVAR = [ptext(r, v) for r, v in P3 if lika_k(polar(r, v), 2j)]
assert P3_SVAR == [ptext(2, 90)]
P4 = [(6, 60), (5, 60), (6, 800), (5, 800)]
P4_SVAR = [ptext(r, v) for r, v in P4 if lika_k(polar(r, v), polar(2, 20) * polar(3, 40) / 1)]
assert P4_SVAR == [ptext(6, 60)] and lika_k(polar(2, 20) * polar(3, 40), polar(6, 60))
assert lika_k(polar(2, 15) ** 6, 64j)
z6 = [('z² = −4', lambda z: z * z + 4), ('z² = 4', lambda z: z * z - 4), ('z² = −2', lambda z: z * z + 2),
      ('z² + 2 = 0', lambda z: z * z + 2)]
Z6_SVAR = [a for a, f in z6 if all(lika_k(f(z), 0) for z in (2j, -2j))]
assert Z6_SVAR == ['z² = −4']
K7 = [('z = −1 ± 2i', (-1, 2)), ('z = 1 ± 2i', (1, 2)), ('z = −1 ± 4i', (-1, 4)), ('z = −2 ± 5i', (-2, 5))]
K7_SVAR = [a for a, (aa, bb) in K7 if rot_ok(2, 5, aa, bb)]
assert K7_SVAR == ['z = −1 ± 2i']
assert [round(math.degrees(cmath.phase(z)) % 360) for z in (1, 1j, -1, -1j)] == [0, 90, 180, 270]

MA_GY3_KOMPLEXA_3 = niva('ma-gy3-fler-komplexa-3', 'Polär form och de Moivres formel', 'Komplexa tal', [
    skriv('Vad är absolutbeloppet av z = 1 + √3 · i?', t(round(abs(1 + math.sqrt(3) * 1j))),
          '|z| = √(1² + (√3)²) = √(1 + 3) = √4 = 2.'),
    skriv('Vilket argument v, i grader med 0° ≤ v < 360°, har z = −1 − i?',
          t(round(math.degrees(cmath.phase(-1 - 1j)) % 360)),
          'Punkten (−1, −1) ligger i tredje kvadranten. Vinkeln mot den positiva reella axeln är 180° + 45° = 225°.'),
    val('Vilken är polär form av z = 2i?', [ptext(r, v) for r, v in P3], P3_SVAR[0],
        'Talet 2i ligger på den positiva imaginära axeln, 2 enheter från origo. Absolutbeloppet är 2 och '
        'argumentet 90°.'),
    val('z₁ = 2(cos 20° + i sin 20°) och z₂ = 3(cos 40° + i sin 40°). Vilken är z₁ · z₂ på polär form?',
        [ptext(r, v) for r, v in P4], P4_SVAR[0],
        'Vid multiplikation multipliceras absolutbeloppen, 2 · 3 = 6, och argumenten adderas, 20° + 40° = 60°.'),
    skriv('Låt z = 2(cos 15° + i sin 15°). Vad är z⁶ på formen a + bi?', ['64i', '64 i', '0 + 64i', '0+64i'],
          'Enligt de Moivres formel är z⁶ = 2⁶(cos 90° + i sin 90°) = 64(0 + i · 1) = 64i.'),
    val('Vilken ekvation har lösningarna z = 2i och z = −2i?', [a for a, _ in z6], Z6_SVAR[0],
        '(2i)² = 4i² = −4 och (−2i)² = −4. Alltså är båda lösningar till z² = −4.'),
    val('Lös ekvationen z² + 2z + 5 = 0.', [a for a, _ in K7], K7_SVAR[0],
        'Med pq-formeln: z = −1 ± √(1 − 5) = −1 ± √(−4) = −1 ± 2i.'),
    sant('Om z = r(cos v + i sin v) och r > 0 är absolutbeloppet |z| lika med r.', True,
         'Talet r är avståndet från origo till punkten i det komplexa talplanet, och det är absolutbeloppet.'),
    sant('När man multiplicerar två komplexa tal på polär form adderas deras absolutbelopp.', False,
         'Absolutbeloppen multipliceras och argumenten adderas. Med absolutbeloppen 2 och 3 blir produktens '
         'absolutbelopp 6, inte 5.'),
    para('Para ihop talet med dess argument v, där 0° ≤ v < 360°.',
         [('1', '0°'), ('i', '90°'), ('−1', '180°'), ('−i', '270°')],
         'Talen ligger på axlarna i det komplexa talplanet, ett kvarts varv från varandra.'),
], beskrivning='Absolutbelopp och argument, polär form, multiplikation och potenser av komplexa tal.')

# ---------------------------------------------------------------- tillägg

TILLAGG = [
    bana('Matematik', 'ak7', [MA_AK7_BRAK_1, MA_AK7_BRAK_2, MA_AK7_CIRKEL_1, MA_AK7_CIRKEL_2]),
    bana('Matematik', 'ak8', [MA_AK8_SAMBAND_1, MA_AK8_SAMBAND_2, MA_AK8_ROTTER_1, MA_AK8_ROTTER_2]),
    bana('Matematik', 'ak9', [MA_AK9_FORMLER_1, MA_AK9_FORMLER_2, MA_AK9_SANNOLIKHET_1, MA_AK9_SANNOLIKHET_2]),
    bana('Matematik', 'gy1', [MA_GY1_STATISTIK_1, MA_GY1_STATISTIK_2, MA_GY1_STATISTIK_3]),
    bana('Matematik', 'gy2', [MA_GY2_PARABEL_1, MA_GY2_PARABEL_2, MA_GY2_PARABEL_3]),
    bana('Matematik', 'gy3', [MA_GY3_KOMPLEXA_1, MA_GY3_KOMPLEXA_2, MA_GY3_KOMPLEXA_3]),
]
