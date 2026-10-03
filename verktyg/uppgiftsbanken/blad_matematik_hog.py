# -*- coding: utf-8 -*-
"""Matematikbladen för åk 7 till 9 i materialbanken som NexLäx-nivåer (2026-10-03).

Varje nivå bygger på ett övningsblad i verktyg/bladen/hogstadiet.py eller
verktyg/bladen/np_ak9.py och dess facit. Nivåerna står i TILLAGG och läggs
sist i banorna i matematik_hog.py, med egna områden: i åk 8 går en elev, och
ingen ny nivå får hamna mitt i hennes väg.

Bladens öppna uppgifter ("förklara", "motivera", "visa att") är här val- eller
sant-frågor om samma kunskap. Bladens figurer finns inte i NexLäx, så talen
står i frågan. Varje facit räknas ut här och varje "fel" alternativ prövas mot
samma räkning, med enda().
"""
from fractions import Fraction as F
from math import pi, sqrt

from grund import bana, niva, val, skriv, para, sant, tal


def t(x):
    """Talet som svar: decimalkomma och '-' för minus."""
    if isinstance(x, F):
        x = int(x) if x.denominator == 1 else float(x)
    return tal(x)


def m(x):
    """Talet i en text eller bland alternativen, med riktigt minustecken."""
    return t(x).replace('-', '−')


def br(x):
    x = F(x)
    return str(x.numerator) if x.denominator == 1 else '%d/%d' % (x.numerator, x.denominator)


def x_svar(v, var='x'):
    """Talet, och talet skrivet som x = 5 på fyra sätt."""
    s = t(v)
    svar = [s, '%s = %s' % (var, s), '%s=%s' % (var, s), '%s= %s' % (var, s), '%s =%s' % (var, s)]
    if s.startswith('-'):
        svar += ['- ' + s[1:], '%s = - %s' % (var, s[1:])]
    return svar


def uttr(*former):
    """Ett uttryck som svar, med och utan mellanslag kring + och −."""
    ut = []
    for f in former:
        for g in (f, f.replace(' ', '')):
            if g not in ut:
                ut.append(g)
    return ut


def p_svar(p, *bråk):
    """En sannolikhet som bråk, decimaltal och procent, när de går jämnt ut.
    bråk är oförkortade former som också är rätt, t.ex. '3/12'."""
    p = F(p)
    svar = [br(p)] + list(bråk)
    if (p * 1000).denominator == 1:
        svar.append(t(p))
        svar.append(t(p * 100) + ' %')
    return svar


def enda(alternativ, prov):
    traffar = [a for a in alternativ if prov(a)]
    assert len(traffar) == 1, 'väntade ett rätt alternativ i %r, fick %r' % (alternativ, traffar)
    return traffar[0]


def system(a1, b1, c1, a2, b2, c2):
    det = F(a1 * b2 - a2 * b1)
    assert det != 0
    x, y = (c1 * b2 - c2 * b1) / det, (a1 * c2 - a2 * c1) / det
    assert a1 * x + b1 * y == c1 and a2 * x + b2 * y == c2
    return x, y


def xy(text):
    """'x = 7, y = 3' → (7, 3)."""
    return tuple(F(d.split('= ')[1].replace('−', '-')) for d in text.split(', '))


def punkt(text):
    """'(2, 3)' → (2, 3)."""
    a, b = text.strip('()').split(', ')
    return F(a.replace('−', '-')), F(b.replace('−', '-'))


def lost(a, b, c, d):
    """Lösningen till a·x + b = c·x + d, prövad."""
    x = F(d - b, a - c)
    assert a * x + b == c * x + d
    return x


def lutning(p, q):
    return F(q[1] - p[1], q[0] - p[0])


def medel(data):
    return F(sum(data), len(data))


def median(data):
    s, n = sorted(data), len(data)
    return F(s[n // 2]) if n % 2 else F(s[n // 2 - 1] + s[n // 2], 2)


def typ(data):
    flest = max(data.count(v) for v in data)
    vanligast = {v for v in data if data.count(v) == flest}
    assert len(vanligast) == 1
    return vanligast.pop()


def ratvinklig(a, b, c):
    a, b, c = sorted((a, b, c))
    return a * a + b * b == c * c


def kr(x):
    """Kronor avrundade till hela kronor."""
    return int(round(x))


# ---------------------------------------------------------------- åk 7: procent

ROD = (500, ('20 % rabatt', 500 * F(80, 100)), ('90 kr rabatt', 500 - 90), ('Betala 85 % av priset', 500 * F(85, 100)))
ROD_BAST = min(ROD[1:], key=lambda p: p[1])
assert ROD_BAST[0] == '20 % rabatt' and len({p[1] for p in ROD[1:]}) == 3

AK7_PROCENT_1 = niva('ma-ak7-blad-procent-1', 'Procentform och decimalform', 'Procent i vardagen', [
    skriv('Skriv 40 % i decimalform.', t(F(40, 100)),
          'Procent betyder hundradelar: 40 % = 40/100 = 0,40, som också skrivs 0,4.'),
    skriv('Skriv decimaltalet 0,07 i procentform.', t(F(7, 100) * 100) + ' %',
          '0,07 är 7 hundradelar, och hundradelar är procent: 7 %.'),
    skriv('Hur mycket är 10 % av 350 kr?', t(350 * F(10, 100)),
          '10 % är en tiondel. 350 / 10 = 35 kr.'),
    skriv('Hur mycket är 25 % av 80?', t(80 * F(25, 100)),
          '25 % är en fjärdedel. 80 / 4 = 20.'),
    val('Vilket decimaltal är 5 %?', ['0,5', '0,05', '5,0', '0,005'], t(F(5, 100)),
        '5 % är 5 hundradelar, alltså 0,05. 0,5 är 50 %.'),
    para('Para ihop procenten med samma andel skriven som bråk.',
         [('50 %', '1/2'), ('25 %', '1/4'), ('75 %', '3/4'), ('10 %', '1/10'), ('20 %', '1/5')],
         'Skriv procenten som hundradelar och förkorta: 20 % = 20/100 = 1/5.'),
    skriv('Hur mycket är 30 % av 600 kr?', t(600 * F(30, 100)),
          '10 % av 600 är 60, så 30 % är 3 · 60 = 180 kr.'),
    sant('1,5 % är samma andel som decimaltalet 0,15.', F(15, 1000) == F(15, 100),
         '1,5 % = 1,5/100 = 0,015. 0,15 är 15 %: procent är hundradelar, så kommat flyttas två steg.'),
    val('Vilken uträkning ger 15 % av 240?', ['240 · 0,15', '240 · 1,5', '240 / 15', '240 · 15'], '240 · 0,15',
        'Procent av ett tal: multiplicera talet med procenten i decimalform. 15 % = 0,15.'),
], beskrivning='Procent som decimaltal och bråk, och procent av ett tal. '
               'Bygger på övningsbladet «Procent i vardagen» i materialbanken.')

AK7_PROCENT_2 = niva('ma-ak7-blad-procent-2', 'Rabatt, höjning och andel', 'Procent i vardagen', [
    skriv('En tröja kostar 400 kr. Priset sänks med 30 %. Vad kostar tröjan nu?', t(400 * F(70, 100)),
          'Efter 30 % rabatt är 70 % kvar: 400 · 0,70 = 280 kr. Eller 400 − 120 = 280 kr.'),
    skriv('I en klass på 25 elever har 15 elever en cykel. Hur många procent har en cykel?',
          t(F(15, 25) * 100) + ' %',
          'Andelen är 15/25 = 0,60, och 0,60 = 60 %.'),
    skriv('Ett pris höjs från 200 kr till 250 kr. Hur många procent är höjningen?',
          t(F(250 - 200, 200) * 100) + ' %',
          'Höjningen är 50 kr. Jämför med det gamla priset: 50/200 = 0,25 = 25 %.'),
    val('En jacka kostar 800 kr och säljs med 25 % rabatt. Vad kostar jackan?',
        ['600 kr', '200 kr', '775 kr', '640 kr'], '%s kr' % t(800 * F(75, 100)),
        '25 % av 800 är 200 kr i rabatt, så jackan kostar 800 − 200 = 600 kr.'),
    skriv('Ett pris sänks från 500 kr till 400 kr. Hur många procent är sänkningen?',
          t(F(500 - 400, 500) * 100) + ' %',
          'Sänkningen är 100 kr av det gamla priset 500 kr: 100/500 = 0,20 = 20 %.'),
    sant('Ett pris på 200 kr som först höjs med 10 % och sedan sänks med 10 % blir 200 kr igen.',
         200 * F(110, 100) * F(90, 100) == 200,
         '200 kr höjs till 220 kr. 10 % av 220 är 22 kr, så priset blir 198 kr. '
         'Sänkningen räknas på det nya, högre priset.'),
    skriv('12 av 48 elever sjunger i kören. Hur många procent av eleverna sjunger i kören?',
          t(F(12, 48) * 100) + ' %',
          '12/48 = 1/4 = 0,25 = 25 %.'),
    val('Ett par byxor kostar 500 kr. Vilket erbjudande ger lägst pris?', [p[0] for p in ROD[1:]], ROD_BAST[0],
        '20 % rabatt ger 400 kr, 90 kr rabatt ger 410 kr och 85 % av priset är 425 kr.'),
    skriv('En cykel kostar 2 000 kr. Priset höjs med 15 %. Vad kostar cykeln nu?', t(2000 * F(115, 100)),
          '15 % av 2 000 är 300 kr. 2 000 + 300 = 2 300 kr.'),
], beskrivning='Rabatt och prishöjning i kronor och procent, och hur stor andel något är. '
               'Bygger på övningsbladet «Procent i vardagen» i materialbanken.')


# ---------------------------------------------------------------- åk 7: uttryck och ekvationer

# Varje alternativ som (x-koefficient, konstant), räknat för hand ur texten och prövat i två punkter.
UTTR_ALT = {'3x + 1 + 2x + 2': lambda x: 3 * x + 1 + 2 * x + 2, '3x + 2x + 3x': lambda x: 3 * x + 2 * x + 3 * x,
            '5 + 3x': lambda x: 5 + 3 * x, '8x': lambda x: 8 * x}
UTTR_RATT = enda(list(UTTR_ALT), lambda a: all(UTTR_ALT[a](x) == 5 * x + 3 for x in (1, 2)))

AK7_UTTRYCK_1 = niva('ma-ak7-blad-uttryck-1', 'Värdet av ett uttryck och förenkling', 'Uttryck och ekvationer', [
    skriv('Beräkna värdet av 3x + 4 när x = 5.', t(3 * 5 + 4),
          'Byt x mot 5: 3 · 5 + 4 = 15 + 4 = 19.'),
    skriv('Beräkna värdet av 2a − b när a = 6 och b = 3.', t(2 * 6 - 3),
          '2 · 6 − 3 = 12 − 3 = 9.'),
    skriv('Förenkla 4x + 3x.', uttr('7x'),
          'Likadana termer läggs ihop: 4 x och 3 x är 7 x.'),
    skriv('Förenkla 5a + 2 + 3a − 1.', uttr('8a + 1', '1 + 8a'),
          'a-termerna: 5a + 3a = 8a. Talen: 2 − 1 = 1. Svaret är 8a + 1.'),
    skriv('Förenkla 3(x + 4).', uttr('3x + 12', '12 + 3x'),
          'Multiplicera in 3 i båda termerna: 3 · x + 3 · 4 = 3x + 12.'),
    val('Vilket uttryck är samma som 2(x − 5)?', ['2x − 10', '2x − 5', 'x − 10', '2x + 10'], '2x − 10',
        'Båda termerna i parentesen multipliceras med 2: 2 · x − 2 · 5 = 2x − 10.'),
    sant('6y − y kan förenklas till 6.', False,
         '6y − y betyder 6 y minus 1 y, och det är 5y. y försvinner inte.'),
    skriv('Beräkna värdet av 4x − 7 när x = 3.', t(4 * 3 - 7),
          '4 · 3 − 7 = 12 − 7 = 5.'),
    val('Vilket uttryck kan förenklas till 5x + 3?', list(UTTR_ALT), UTTR_RATT,
        '3x + 2x = 5x och 1 + 2 = 3. De andra blir 8x, 3x + 5 och 8x.'),
], beskrivning='Sätt in tal i uttryck, lägg ihop likadana termer och multiplicera in i en parentes. '
               'Bygger på övningsbladet «Uttryck och ekvationer» i materialbanken.')

MAJA = lost(2, 3, 0, 25)  # x + (x + 3) = 25
assert MAJA == 11

AK7_UTTRYCK_2 = niva('ma-ak7-blad-uttryck-2', 'Lösa och ställa upp ekvationer', 'Uttryck och ekvationer', [
    skriv('Lös ekvationen 5x − 3 = 22.', x_svar(lost(5, -3, 0, 22)),
          'Lägg till 3 på båda sidor: 5x = 25. Dela med 5: x = 5. Kontroll: 5 · 5 − 3 = 22.'),
    skriv('Lös ekvationen 4x + 7 = 2x + 15.', x_svar(lost(4, 7, 2, 15)),
          'Dra bort 2x på båda sidor: 2x + 7 = 15. Dra bort 7: 2x = 8, så x = 4.'),
    val('Ett paket kostar p kr. Vilket uttryck visar vad 4 paket kostar tillsammans med en fraktavgift på 30 kr?',
        ['4p + 30', '4(p + 30)', 'p + 4 + 30', '30p + 4'], '4p + 30',
        'Fyra paket kostar 4 · p = 4p, och frakten 30 kr betalas en gång: 4p + 30.'),
    val('Maja är x år och hennes bror är 3 år äldre. Tillsammans är de 25 år. Vilken ekvation stämmer?',
        ['x + (x + 3) = 25', 'x + 3 = 25', '3x = 25', 'x + 3x = 25'], 'x + (x + 3) = 25',
        'Brodern är x + 3 år. Majas ålder plus broderns ålder ska bli 25.'),
    skriv('Maja är x år och hennes bror är 3 år äldre. Tillsammans är de 25 år. Hur gammal är Maja?', t(MAJA),
          'x + (x + 3) = 25 ger 2x + 3 = 25, så 2x = 22 och x = 11. Brodern är 14, och 11 + 14 = 25.'),
    skriv('Lös ekvationen 3x + 8 = 29.', x_svar(lost(3, 8, 0, 29)),
          'Dra bort 8 på båda sidor: 3x = 21. Dela med 3: x = 7.'),
    sant('x = 4 är en lösning till ekvationen 2x + 5 = 13.', 2 * 4 + 5 == 13,
         'Sätt in x = 4: 2 · 4 + 5 = 8 + 5 = 13. Båda sidor blir lika, så x = 4 är en lösning.'),
    skriv('Lös ekvationen 6x − 4 = 2x + 16.', x_svar(lost(6, -4, 2, 16)),
          'Dra bort 2x: 4x − 4 = 16. Lägg till 4: 4x = 20. Dela med 4: x = 5.'),
    skriv('Summan av ett tal och dubbla talet är 36. Vilket är talet?', t(lost(3, 0, 0, 36)),
          'Kalla talet x. x + 2x = 36 ger 3x = 36, så x = 12. Kontroll: 12 + 24 = 36.'),
], beskrivning='Lös ekvationer i flera steg, också med x på båda sidor, och ställ upp en ekvation ur en text. '
               'Bygger på övningsbladet «Uttryck och ekvationer» i materialbanken.')


# ---------------------------------------------------------------- åk 7: vinklar och trianglar

AK7_VINKLAR_1 = niva('ma-ak7-blad-vinklar-1', 'Vinkelsumma och sidovinklar', 'Vinklar och trianglar', [
    skriv('Två av vinklarna i en triangel är 48° och 67°. Hur stor är den tredje vinkeln? Svara i grader.',
          t(180 - 48 - 67),
          'Vinkelsumman i en triangel är 180°. 180 − 48 − 67 = 65.'),
    skriv('I en likbent triangel är toppvinkeln 40°. Hur stor är var och en av basvinklarna? Svara i grader.',
          t(F(180 - 40, 2)),
          'Basvinklarna är lika stora och delar på 180 − 40 = 140°. 140 / 2 = 70.'),
    skriv('En vinkel är 115°. Hur stor är dess sidovinkel? Svara i grader.', t(180 - 115),
          'Sidovinklar bildar tillsammans en rät linje, 180°. 180 − 115 = 65.'),
    skriv('Hur stor är varje vinkel i en liksidig triangel? Svara i grader.', t(F(180, 3)),
          'I en liksidig triangel är alla tre vinklarna lika stora: 180 / 3 = 60.'),
    skriv('En rätvinklig triangel har en vinkel på 35°. Hur stor är den tredje vinkeln? Svara i grader.',
          t(180 - 90 - 35),
          'Den räta vinkeln är 90°. 180 − 90 − 35 = 55.'),
    skriv('Tre av vinklarna i en fyrhörning är 90°, 100° och 80°. Hur stor är den fjärde vinkeln? Svara i grader.',
          t(360 - 90 - 100 - 80),
          'Vinkelsumman i en fyrhörning är 360°. 360 − 90 − 100 − 80 = 90.'),
    sant('En triangel kan ha två trubbiga vinklar.', False,
         'Två trubbiga vinklar är tillsammans mer än 180°, och då finns ingen plats kvar för den tredje.'),
    val('Vad kallas en triangel med vinklarna 90°, 45° och 45°?',
        ['rätvinklig och likbent', 'liksidig', 'trubbvinklig och likbent', 'rätvinklig och liksidig'],
        'rätvinklig och likbent',
        'Den har en rät vinkel, och två lika stora vinklar ger två lika långa sidor. '
        'En liksidig triangel har tre vinklar på 60°.'),
], beskrivning='Räkna ut okända vinklar med vinkelsumman i trianglar och fyrhörningar, och med sidovinklar. '
               'Bygger på övningsbladet «Vinklar och trianglar» i materialbanken.')

AK7_VINKLAR_2 = niva('ma-ak7-blad-vinklar-2', 'Triangelns area och fler vinklar', 'Vinklar och trianglar', [
    skriv('Beräkna arean av en triangel med basen 10 cm och höjden 6 cm. Svara i cm².', t(F(10 * 6, 2)),
          'Triangelns area är bas · höjd / 2 = 10 · 6 / 2 = 30 cm².'),
    skriv('Beräkna arean av en triangel med basen 8 cm och höjden 5 cm. Svara i cm².', t(F(8 * 5, 2)),
          '8 · 5 / 2 = 40 / 2 = 20 cm². Triangeln är hälften av en rektangel med samma bas och höjd.'),
    skriv('I en likbent triangel är varje basvinkel 50°. Hur stor är toppvinkeln? Svara i grader.',
          t(180 - 2 * 50),
          'De två basvinklarna är 50° var, alltså 100°. 180 − 100 = 80.'),
    skriv('Två sidovinklar är tillsammans 180°. Den ena är tre gånger så stor som den andra. '
          'Hur stor är den minsta vinkeln? Svara i grader.', t(F(180, 4)),
          'Vinklarna är x och 3x, och x + 3x = 180 ger 4x = 180, så x = 45.'),
    skriv('Tre av vinklarna i en fyrhörning är 70°, 110° och 95°. Hur stor är den fjärde vinkeln? Svara i grader.',
          t(360 - 70 - 110 - 95),
          '360 − 70 − 110 − 95 = 85.'),
    sant('Basvinklarna i en likbent triangel är alltid lika stora.', True,
         'Två lika långa sidor ger två lika stora vinklar mot den tredje sidan, basen.'),
    skriv('En triangel har arean 24 cm² och basen 8 cm. Hur hög är triangeln? Svara i cm.', t(F(2 * 24, 8)),
          'bas · höjd / 2 = 24 ger 8 · höjd = 48, så höjden är 6 cm.'),
    para('Para ihop vinkeln med dess storlek.',
         [('Spetsig vinkel', 'mindre än 90°'), ('Rät vinkel', 'exakt 90°'),
          ('Trubbig vinkel', 'mellan 90° och 180°'), ('Rak vinkel', 'exakt 180°')],
         'En rät vinkel är ett hörn som i ett papper. En rak vinkel är en rät linje.'),
    skriv('I en triangel är två vinklar lika stora och den tredje är 100°. Hur stor är var och en av de två '
          'lika vinklarna? Svara i grader.', t(F(180 - 100, 2)),
          '180 − 100 = 80°, som delas lika på två vinklar: 40° var.'),
], beskrivning='Triangelns area, likbenta trianglar och vinkelns namn efter storlek. '
               'Bygger på övningsbladet «Vinklar och trianglar» i materialbanken.')


# ---------------------------------------------------------------- åk 8: Pythagoras sats

assert sqrt(6 ** 2 + 8 ** 2) == 10 and sqrt(13 ** 2 - 5 ** 2) == 12 and sqrt(12 ** 2 + 5 ** 2) == 13
STEGE = round(sqrt(5.0 ** 2 - 1.4 ** 2), 1)
assert abs(STEGE - 4.8) < 1e-9
TRI_ALT = ['6, 8 och 10 cm', '4, 5 och 6 cm', '5, 7 och 9 cm', '2, 3 och 4 cm']
TRI_RATT = enda(TRI_ALT, lambda a: ratvinklig(*[int(s) for s in a.replace(' cm', '').replace(' och', ',').split(', ')]))

AK8_PYTH_1 = niva('ma-ak8-blad-pythagoras-1', 'Hypotenusa och katet', 'Pythagoras sats', [
    skriv('En rätvinklig triangel har kateterna 6 cm och 8 cm. Hur lång är hypotenusan? Svara i cm.',
          t(sqrt(6 ** 2 + 8 ** 2)),
          'c² = 6² + 8² = 36 + 64 = 100, och √100 = 10.'),
    skriv('En rätvinklig triangel har hypotenusan 13 cm och en katet som är 5 cm. Hur lång är den andra kateten? '
          'Svara i cm.', t(sqrt(13 ** 2 - 5 ** 2)),
          'b² = 13² − 5² = 169 − 25 = 144, och √144 = 12. Söker du en katet drar du bort.'),
    skriv('En rektangel är 12 cm lång och 5 cm bred. Hur lång är diagonalen? Svara i cm.',
          t(sqrt(12 ** 2 + 5 ** 2)),
          'Diagonalen är hypotenusa i en rätvinklig triangel med kateterna 12 och 5: √(144 + 25) = √169 = 13.'),
    val('Vilken sida är hypotenusan i en rätvinklig triangel?',
        ['Den längsta sidan, mitt emot den räta vinkeln', 'Den kortaste sidan, intill den räta vinkeln',
         'Den sida som ligger mitt emot den minsta vinkeln'],
        'Den längsta sidan, mitt emot den räta vinkeln',
        'Hypotenusan ligger mitt emot den räta vinkeln och är alltid längst. De två andra sidorna är kateter.'),
    skriv('En rätvinklig triangel har kateterna 9 cm och 12 cm. Hur lång är hypotenusan? Svara i cm.',
          t(sqrt(9 ** 2 + 12 ** 2)),
          'c² = 81 + 144 = 225, och √225 = 15.'),
    skriv('En rätvinklig triangel har hypotenusan 10 cm och en katet som är 6 cm. Hur lång är den andra kateten? '
          'Svara i cm.', t(sqrt(10 ** 2 - 6 ** 2)),
          'b² = 100 − 36 = 64, och √64 = 8.'),
    sant('En rätvinklig triangel med kateterna 3 cm och 4 cm har hypotenusan 7 cm.', sqrt(3 ** 2 + 4 ** 2) == 7,
         'Sidorna läggs inte ihop. c² = 9 + 16 = 25, så hypotenusan är √25 = 5 cm.'),
    skriv('En rätvinklig triangel har kateterna 2 cm och 3 cm. Hur lång är hypotenusan? Svara i cm med en decimal.',
          t(round(sqrt(2 ** 2 + 3 ** 2), 1)),
          'c² = 4 + 9 = 13, och √13 ≈ 3,6.'),
], beskrivning='Räkna ut hypotenusan och en katet med Pythagoras sats. '
               'Bygger på övningsbladet «Pythagoras sats» i materialbanken.')

AK8_PYTH_2 = niva('ma-ak8-blad-pythagoras-2', 'Stegar, avstånd och räta vinklar', 'Pythagoras sats', [
    skriv('En stege är 5,0 m lång. Foten står 1,4 m från en vägg. Hur högt upp på väggen når stegen? '
          'Svara i meter med en decimal.', t(STEGE),
          'Stegen är hypotenusan. h² = 5,0² − 1,4² = 25 − 1,96 = 23,04, och √23,04 = 4,8.'),
    sant('En triangel med sidorna 7 cm, 24 cm och 25 cm är rätvinklig.', ratvinklig(7, 24, 25),
         '7² + 24² = 49 + 576 = 625 = 25². Stämmer Pythagoras sats är triangeln rätvinklig.'),
    sant('En triangel med sidorna 5 cm, 6 cm och 8 cm är rätvinklig.', ratvinklig(5, 6, 8),
         '5² + 6² = 25 + 36 = 61, men 8² = 64. Summan blir inte lika, så triangeln är inte rätvinklig.'),
    skriv('Hur långt är det mellan punkterna (1, 2) och (5, 5) i ett koordinatsystem? Svara i längdenheter.',
          t(sqrt((5 - 1) ** 2 + (5 - 2) ** 2)),
          'Skillnaderna är 4 i x-led och 3 i y-led. De är kateter: √(16 + 9) = √25 = 5.'),
    skriv('En stege är 6,5 m lång och når 6,0 m upp på en vägg. Hur långt från väggen står foten? '
          'Svara i meter med en decimal.', t(round(sqrt(6.5 ** 2 - 6.0 ** 2), 1)),
          'Avståndet är en katet: 6,5² − 6,0² = 42,25 − 36 = 6,25, och √6,25 = 2,5.'),
    val('Vilken triangel är rätvinklig?', TRI_ALT, TRI_RATT,
        '6² + 8² = 36 + 64 = 100 = 10². För de andra blir de två kortaste sidornas kvadrater inte '
        'lika med den längstas.'),
    skriv('En kvadrat har sidan 5 cm. Hur lång är diagonalen? Svara i cm med en decimal.',
          t(round(sqrt(5 ** 2 + 5 ** 2), 1)),
          'd² = 25 + 25 = 50, och √50 ≈ 7,1.'),
    skriv('Hur långt är det mellan punkterna (−2, −3) och (3, 9) i ett koordinatsystem? Svara i längdenheter.',
          t(sqrt((3 + 2) ** 2 + (9 + 3) ** 2)),
          'Skillnaderna är 5 i x-led och 12 i y-led: √(25 + 144) = √169 = 13.'),
], beskrivning='Pythagoras sats i vardagen och i koordinatsystemet, och att avgöra om en triangel är rätvinklig. '
               'Bygger på övningsbladet «Pythagoras sats» i materialbanken.')


# ---------------------------------------------------------------- åk 8: lägesmått och sannolikhet

LOPP = [14, 16, 15, 18, 22]
SERIE = [3, 5, 5, 6, 7, 9, 9, 9, 10]
assert medel(LOPP) == 17 and median(LOPP) == 16 and typ(SERIE) == 9 and median(SERIE) == 7
FJARDE = 4 * 8 - 5 - 9 - 10
KULOR = dict(roda=4, bla=3, grona=5)
ALLA = sum(KULOR.values())
TARNING = range(1, 7)

AK8_LAGE_1 = niva('ma-ak8-blad-lagesmatt-1', 'Medelvärde, median och typvärde', 'Lägesmått och sannolikhet', [
    skriv('Fem elever sprang 100 m på 14, 16, 15, 18 och 22 sekunder. Vad är medelvärdet? Svara i sekunder.',
          t(medel(LOPP)),
          'Summan är 85 sekunder, och 85 / 5 = 17.'),
    skriv('Fem elever sprang 100 m på 14, 16, 15, 18 och 22 sekunder. Vad är medianen? Svara i sekunder.',
          t(median(LOPP)),
          'Sätt tiderna i ordning: 14, 15, 16, 18, 22. Det mittersta värdet är 16.'),
    skriv('Fem elever sprang 100 m på 14, 16, 15, 18 och 22 sekunder. Vad är variationsbredden? Svara i sekunder.',
          t(max(LOPP) - min(LOPP)),
          'Variationsbredden är största minus minsta: 22 − 14 = 8.'),
    skriv('Vad är typvärdet i talen 3, 5, 5, 6, 7, 9, 9, 9, 10?', t(typ(SERIE)),
          'Typvärdet är det vanligaste värdet. 9 finns tre gånger, oftare än något annat tal.'),
    skriv('Vad är medianen i talen 3, 5, 5, 6, 7, 9, 9, 9, 10?', t(median(SERIE)),
          'Talen står redan i ordning. Av nio värden är det femte i mitten, och det är 7.'),
    skriv('Medelvärdet av fyra tal är 8. Tre av talen är 5, 9 och 10. Vilket är det fjärde talet?', t(FJARDE),
          'Fyra tal med medelvärdet 8 har summan 4 · 8 = 32. 32 − 5 − 9 − 10 = 8.'),
    val('Vad kallas det värde som förekommer flest gånger?', ['typvärde', 'median', 'medelvärde', 'variationsbredd'],
        'typvärde',
        'Typvärdet är det vanligaste värdet. Medianen är det mittersta och medelvärdet summan delat med antalet.'),
    skriv('Vad är medianen i talen 2, 4, 7 och 9?', t(median([2, 4, 7, 9])),
          'Med ett jämnt antal tal finns två i mitten, 4 och 7. Medianen är talet mitt emellan: (4 + 7) / 2 = 5,5.'),
    sant('Medelvärdet av 2, 4 och 12 är 6.', medel([2, 4, 12]) == 6,
         'Summan är 18 och det är tre tal: 18 / 3 = 6.'),
], beskrivning='Medelvärde, median, typvärde och variationsbredd. '
               'Bygger på övningsbladet «Lägesmått och sannolikhet» i materialbanken.')

P_BLA = F(KULOR['bla'], ALLA)
P_INTE_GRON = F(ALLA - KULOR['grona'], ALLA)
P_JAMNT = F(sum(1 for s in TARNING if s % 2 == 0), 6)
P_TVA_SEXOR = F(1, 6) * F(1, 6)
P_MINST_5 = F(sum(1 for s in TARNING if s >= 5), 6)
SANNOLIKHET_ALT = ['1,2', '0', '0,75', '1']
SANNOLIKHET_FEL = enda(SANNOLIKHET_ALT, lambda a: not (0 <= float(a.replace(',', '.')) <= 1))

AK8_LAGE_2 = niva('ma-ak8-blad-lagesmatt-2', 'Sannolikhet med kulor och tärningar', 'Lägesmått och sannolikhet', [
    skriv('I en påse finns 4 röda, 3 blå och 5 gröna kulor. Du drar en kula utan att titta. '
          'Hur stor är sannolikheten att den är blå?', p_svar(P_BLA, '3/12'),
          'Det finns 12 kulor och 3 av dem är blå: 3/12 = 1/4 = 0,25 = 25 %.'),
    val('I en påse finns 4 röda, 3 blå och 5 gröna kulor. Du drar en kula utan att titta. '
        'Hur stor är sannolikheten att den inte är grön?', [br(P_INTE_GRON), '5/12', '7/5', '1/2'], br(P_INTE_GRON),
        'De kulor som inte är gröna är 4 röda och 3 blå, alltså 7 av 12.'),
    skriv('Du kastar en vanlig tärning. Hur stor är sannolikheten att få ett jämnt tal?', p_svar(P_JAMNT, '3/6'),
          'Tre av sex sidor är jämna: 2, 4 och 6. 3/6 = 1/2.'),
    val('Du kastar en tärning två gånger. Hur stor är sannolikheten att få sexa båda gångerna?',
        [br(P_TVA_SEXOR), '1/12', '2/6', '1/6'], br(P_TVA_SEXOR),
        'Sannolikheten för en sexa är 1/6 varje gång. Båda gångerna: 1/6 · 1/6 = 1/36.'),
    sant('Sannolikheten för något som säkert händer är 1.', True,
         'Sannolikheter går från 0, omöjligt, till 1, säkert. 1 är samma sak som 100 %.'),
    skriv('I en påse finns 2 röda och 8 svarta kulor. Du drar en kula utan att titta. '
          'Hur stor är sannolikheten att den är röd? Svara i procent.', t(F(2, 10) * 100) + ' %',
          '2 av 10 kulor är röda: 2/10 = 0,2 = 20 %.'),
    val('Vilket av talen kan inte vara en sannolikhet?', SANNOLIKHET_ALT, SANNOLIKHET_FEL,
        'En sannolikhet ligger alltid mellan 0 och 1. 1,2 är större än 1, mer än säkert, och det går inte.'),
    val('Du kastar en vanlig tärning. Hur stor är sannolikheten att få minst 5?',
        [br(P_MINST_5), '1/6', '1/2', '5/6'], br(P_MINST_5),
        'Minst 5 är 5 eller 6, två av sex sidor: 2/6 = 1/3.'),
    skriv('Ett lyckohjul har 8 lika stora fält, och 3 av dem är gula. Hur stor är sannolikheten att hjulet '
          'stannar på gult? Svara i procent.', t(F(3, 8) * 100) + ' %',
          '3/8 = 0,375 = 37,5 %.'),
], beskrivning='Sannolikhet som bråk, decimaltal och procent, för ett och två försök. '
               'Bygger på övningsbladet «Lägesmått och sannolikhet» i materialbanken.')


# ---------------------------------------------------------------- åk 9: räta linjen och ekvationssystem

LINJE_PUNKT_ALT = ['(1, 2)', '(1, 4)', '(2, 5)', '(3, 3)']
LINJE_PUNKT = enda(LINJE_PUNKT_ALT, lambda a: punkt(a)[1] == -punkt(a)[0] + 3)
K_01_27 = lutning((0, 1), (2, 7))
TAXI_KM = F(225 - 45, 12)
assert K_01_27 == 3 and TAXI_KM == 15
LINJE_ALT = ['y = 3x + 1', 'y = x + 3', 'y = 3x + 7', 'y = 6x + 1']
LINJE_RATT = enda(LINJE_ALT, lambda a: all(
    F(p[1]) == F(a.split('= ')[1].split('x')[0] or 1) * p[0] + F(a.split('+ ')[1]) for p in ((0, 1), (2, 7))))

AK9_LINJE = niva('ma-ak9-blad-linjer-1', 'Linjen y = kx + m', 'Räta linjen och ekvationssystem', [
    val('Vad är k och m i y = 3x + 2?', ['k = 3 och m = 2', 'k = 2 och m = 3', 'k = 3 och m = −2', 'k = 5 och m = 0'],
        'k = 3 och m = 2',
        'I y = kx + m står k framför x och m ensamt. Här är k = 3 och m = 2.'),
    skriv('Beräkna y när x = 4 i y = 2x − 5.', x_svar(2 * 4 - 5, 'y'),
          'y = 2 · 4 − 5 = 8 − 5 = 3.'),
    skriv('En linje går genom punkterna (0, 1) och (2, 7). Bestäm lutningen k.', x_svar(K_01_27, 'k'),
          'k = skillnaden i y / skillnaden i x = (7 − 1) / (2 − 0) = 6 / 2 = 3.'),
    val('Vilken ekvation har linjen som går genom punkterna (0, 1) och (2, 7)?', LINJE_ALT, LINJE_RATT,
        'Lutningen är (7 − 1) / 2 = 3, och linjen skär y-axeln i (0, 1), så m = 1.'),
    val('En taxi kostar 45 kr i startavgift och 12 kr per kilometer. Vilken formel ger priset y kr för x km?',
        ['y = 12x + 45', 'y = 45x + 12', 'y = 57x', 'y = 12(x + 45)'], 'y = 12x + 45',
        'Startavgiften 45 kr betalas en gång, och 12 kr läggs till för varje km: y = 12x + 45.'),
    skriv('En taxi kostar 45 kr i startavgift och 12 kr per kilometer. Hur många kilometer kan man åka för 225 kr?',
          t(TAXI_KM),
          '12x + 45 = 225 ger 12x = 180, så x = 15 km.'),
    val('Vilken punkt ligger på linjen y = −x + 3?', LINJE_PUNKT_ALT, LINJE_PUNKT,
        'Sätt in x = 1: y = −1 + 3 = 2. Punkten (1, 2) stämmer, de andra gör det inte.'),
    sant('Linjen y = −x + 3 skär y-axeln i punkten (0, 3).', True,
         'm = 3 är y-värdet där x = 0, alltså där linjen skär y-axeln.'),
    sant('Linjen y = −2x + 1 lutar uppåt när man går åt höger.', False,
         'k = −2 är negativt: y minskar med 2 för varje steg åt höger, så linjen lutar nedåt.'),
], beskrivning='Lutning och m-värde, linjen genom två punkter och en taxiformel. '
               'Bygger på övningsbladet «Linjära funktioner: y = kx + m» i materialbanken.')

SYS_A = system(1, 1, 10, 1, -1, 4)
SYS_B = system(-2, 1, 0, 1, 1, 12)      # y = 2x och x + y = 12
SYS_C = system(2, 1, 11, 1, 1, 7)
SYS_D = system(3, 2, 16, 1, -2, 0)
BIO = system(2, 3, 480, 1, 2, 280)
SKARN = system(-1, 1, 1, 1, 1, 5)        # y = x + 1 och y = −x + 5
assert SYS_A == (7, 3) and SYS_B == (4, 8) and SYS_C == (4, 3) and SYS_D == (4, 2)
assert BIO == (120, 80) and SKARN == (2, 3)
SYS_A_ALT = ['x = 7, y = 3', 'x = 3, y = 7', 'x = 6, y = 4', 'x = 8, y = 2']
SYS_C_ALT = ['x = 4, y = 3', 'x = 3, y = 4', 'x = 5, y = 1', 'x = 2, y = 5']
SKARN_ALT = ['(2, 3)', '(3, 2)', '(1, 2)', '(4, 1)']

AK9_SYSTEM = niva('ma-ak9-blad-ekvationssystem-1', 'Ekvationssystem', 'Räta linjen och ekvationssystem', [
    val('Lös ekvationssystemet x + y = 10 och x − y = 4.', SYS_A_ALT,
        enda(SYS_A_ALT, lambda a: xy(a) == SYS_A),
        'Addera ekvationerna: 2x = 14, så x = 7. Då är y = 10 − 7 = 3.'),
    skriv('Lös ekvationssystemet y = 2x och x + y = 12. Vad är y?', x_svar(SYS_B[1], 'y'),
          'Sätt in y = 2x: x + 2x = 12 ger x = 4, och y = 2 · 4 = 8.'),
    val('Lös ekvationssystemet 2x + y = 11 och x + y = 7.', SYS_C_ALT,
        enda(SYS_C_ALT, lambda a: xy(a) == SYS_C),
        'Subtrahera den andra ekvationen från den första: x = 4. Då är y = 7 − 4 = 3.'),
    skriv('Lös ekvationssystemet 3x + 2y = 16 och x − 2y = 0. Vad är x?', x_svar(SYS_D[0]),
          'Addera ekvationerna så att y försvinner: 4x = 16, så x = 4 (och y = 2).'),
    skriv('På en bio kostar 2 vuxenbiljetter och 3 barnbiljetter 480 kr. 1 vuxenbiljett och 2 barnbiljetter '
          'kostar 280 kr. Vad kostar en vuxenbiljett? Svara i kronor.', t(BIO[0]),
          '2v + 3b = 480 och v + 2b = 280. Dubbla den andra: 2v + 4b = 560. Dra bort den första: b = 80. '
          'Då är v = 280 − 160 = 120.'),
    skriv('På en bio kostar 2 vuxenbiljetter och 3 barnbiljetter 480 kr. 1 vuxenbiljett och 2 barnbiljetter '
          'kostar 280 kr. Vad kostar en barnbiljett? Svara i kronor.', t(BIO[1]),
          'Dubbla den andra ekvationen: 2v + 4b = 560. Dra bort 2v + 3b = 480, så blir b = 80 kr.'),
    val('I vilken punkt skär linjerna y = x + 1 och y = −x + 5 varandra?', SKARN_ALT,
        enda(SKARN_ALT, lambda a: punkt(a)[1] == punkt(a)[0] + 1 and punkt(a)[1] == -punkt(a)[0] + 5),
        'x + 1 = −x + 5 ger 2x = 4, så x = 2 och y = 3. Punkten ligger på båda linjerna.'),
    val('Hur många lösningar har ekvationssystemet y = 2x + 3 och y = 2x − 1?',
        ['Ingen lösning', 'Exakt en lösning', 'Två lösningar', 'Oändligt många lösningar'], 'Ingen lösning',
        'Linjerna har samma lutning, k = 2, men olika m. De är parallella och skär aldrig varandra.'),
    sant('Ekvationssystemet y = x + 2 och 2y = 2x + 4 har oändligt många lösningar.', True,
         'Dela 2y = 2x + 4 med 2: y = x + 2. Det är samma linje, och alla dess punkter är lösningar.'),
], beskrivning='Lös ekvationssystem med additions- och substitutionsmetoden, ur en text och grafiskt. '
               'Bygger på övningsbladet «Ekvationssystem» i materialbanken.')


# ---------------------------------------------------------------- åk 9: förändringsfaktor

AK9_FAKTOR_1 = niva('ma-ak9-blad-forandringsfaktor-1', 'Förändringsfaktorn', 'Förändringsfaktor och ränta', [
    skriv('Vilken förändringsfaktor hör till en ökning med 30 %?', t(1 + F(30, 100)),
          'Det nya är 100 % + 30 % = 130 % av det gamla, och 130 % = 1,30.'),
    skriv('Vilken förändringsfaktor hör till en minskning med 40 %?', t(1 - F(40, 100)),
          'Efter en minskning med 40 % är 60 % kvar, och 60 % = 0,60.'),
    skriv('En tröja kostar 600 kr. Priset höjs med 15 %. Vad kostar tröjan sedan? Svara i kronor.',
          t(600 * F(115, 100)),
          'Förändringsfaktorn är 1,15: 600 · 1,15 = 690 kr.'),
    skriv('En cykel kostade 3 000 kr och är nu värd 2 400 kr. Hur många procent har värdet minskat?',
          t((1 - F(2400, 3000)) * 100) + ' %',
          '2 400 / 3 000 = 0,80. Faktorn 0,80 betyder att 80 % är kvar, alltså en minskning med 20 %.'),
    skriv('Ett pris ökade från 250 kr till 300 kr. Vilken är förändringsfaktorn?', t(F(300, 250)),
          'Förändringsfaktorn är nytt / gammalt = 300 / 250 = 1,2.'),
    skriv('Ett pris ökade från 250 kr till 300 kr. Hur många procent är ökningen?',
          t((F(300, 250) - 1) * 100) + ' %',
          'Faktorn är 300 / 250 = 1,2, och 1,2 betyder 20 % mer än förut.'),
    para('Para ihop förändringen med sin förändringsfaktor.',
         [('Ökning med 5 %', '1,05'), ('Minskning med 5 %', '0,95'), ('Ökning med 50 %', '1,5'),
          ('Minskning med 50 %', '0,5'), ('Ökning med 100 %', '2')],
         'En ökning lägger till procenten på 1, en minskning drar bort den: 1 − 0,05 = 0,95.'),
    sant('Förändringsfaktorn 0,75 betyder en minskning med 75 %.', False,
         '0,75 betyder att 75 % är kvar. Minskningen är 25 %.'),
], beskrivning='Förändringsfaktor vid ökning och minskning, och procentuell förändring. '
               'Bygger på övningsbladet «Förändringsfaktor och ränta på ränta» i materialbanken.')

LISA = 5000 * F(104, 100) ** 3
STAD = 80000 * F(102, 100) ** 2
SANK = (1 - F(80, 100) * F(90, 100)) * 100
BIL = 200000 * F(90, 100) ** 2
UPP_NER = (1 - F(120, 100) * F(80, 100)) * 100
KONTO = 10000 * F(102, 100) ** 3
assert kr(LISA) == 5624 and STAD == 83232 and SANK == 28 and BIL == 162000 and UPP_NER == 4 and kr(KONTO) == 10612
SANK_ALT = ['28 %', '30 %', '72 %', '2 %']

AK9_FAKTOR_2 = niva('ma-ak9-blad-forandringsfaktor-2', 'Ränta på ränta och upprepad förändring',
                    'Förändringsfaktor och ränta', [
    skriv('Lisa sätter in 5 000 kr på ett konto med 4 % ränta per år. Hur mycket finns på kontot efter 3 år? '
          'Avrunda till hela kronor.', [t(kr(LISA)), tal(float(LISA), 2)],
          '5 000 · 1,04³ = 5 624,32, alltså 5 624 kr. Räntan räknas varje år på det som redan finns.'),
    skriv('Befolkningen i en stad är 80 000 och ökar med 2 % per år. Hur många bor där om 2 år?', t(STAD),
          '80 000 · 1,02² = 80 000 · 1,0404 = 83 232.'),
    val('En vara sänks först med 20 % och sedan med 10 %. Hur stor är den sammanlagda minskningen?', SANK_ALT,
        enda(SANK_ALT, lambda a: F(a.split(' ')[0]) == SANK),
        '0,80 · 0,90 = 0,72, så 72 % är kvar och minskningen är 28 %. Den andra sänkningen räknas på det lägre priset.'),
    val('10 000 kr växer med 3 % per år. Vilket uttryck ger värdet efter 5 år?',
        ['10 000 · 1,03⁵', '10 000 · 1,15', '10 000 · 0,03⁵', '10 000 · 1,3⁵'], '10 000 · 1,03⁵',
        'Varje år multipliceras värdet med 1,03, fem gånger: 1,03⁵. 1,15 hade varit 15 % en gång.'),
    skriv('En bil är värd 200 000 kr och minskar i värde med 10 % per år. Vad är den värd efter 2 år? '
          'Svara i kronor.', t(BIL),
          '200 000 · 0,90² = 200 000 · 0,81 = 162 000 kr.'),
    sant('Ett pris som höjs med 10 % två gånger i rad har sammanlagt höjts med 21 %.',
         F(110, 100) ** 2 == F(121, 100),
         '1,10 · 1,10 = 1,21, alltså 21 %. Den andra höjningen räknas på det redan höjda priset.'),
    skriv('Ett pris höjs först med 20 % och sänks sedan med 20 %. Hur många procent lägre än från början '
          'blir priset?', t(UPP_NER) + ' %',
          '1,20 · 0,80 = 0,96. Priset är 96 % av det första, alltså 4 % lägre.'),
    skriv('Du sätter in 10 000 kr på ett konto med 2 % ränta per år. Hur mycket finns på kontot efter 3 år? '
          'Avrunda till hela kronor.', [t(kr(KONTO)), tal(float(KONTO), 2)],
          '10 000 · 1,02³ = 10 612,08, alltså 10 612 kr.'),
    val('Ett värde multipliceras med 1,08 varje år. Hur många procent ökar det per år?',
        ['8 %', '108 %', '0,08 %', '80 %'], '8 %',
        '1,08 är 108 % av förra årets värde, alltså 8 % mer.'),
], beskrivning='Upprepad förändring med förändringsfaktor upphöjd till antalet gånger, och ränta på ränta. '
               'Bygger på övningsbladet «Förändringsfaktor och ränta på ränta» i materialbanken.')


# ---------------------------------------------------------------- åk 9: NP-träning

OLIKHET = [x for x in range(0, 11) if 2 * x - 3 > 7]
OLIKHET_ALT = ['6, 7, 8, 9 och 10', '5, 6, 7, 8, 9 och 10', '0, 1, 2, 3, 4 och 5', 'bara 10']
OLIKHET_RATT = enda(OLIKHET_ALT, lambda a: a == ', '.join(str(x) for x in OLIKHET[:-1]) + ' och %d' % OLIKHET[-1])
assert 0.07 * 10 ** 3 > 7 * 10 ** -1

AK9_NP_UTAN = niva('ma-ak9-blad-np-utan-miniraknare-1', 'Utan miniräknare', 'NP-träning', [
    skriv('Beräkna −7 + 12 utan miniräknare.', t(-7 + 12),
          'Börja på −7 och gå 12 steg uppåt: först 7 steg till 0, sedan 5 till.'),
    skriv('Beräkna 3,2 · 100 utan miniräknare.', t(F(32, 10) * 100),
          'Gånger 100 flyttar decimalkommat två steg åt höger: 3,2 blir 320.'),
    skriv('Beräkna 2/3 + 1/6. Svara med ett bråk i enklaste form.', br(F(2, 3) + F(1, 6)),
          'Gör nämnarna lika: 2/3 = 4/6. 4/6 + 1/6 = 5/6.'),
    skriv('Beräkna 4² − 3 · 2 utan miniräknare.', t(4 ** 2 - 3 * 2),
          'Potensen och multiplikationen först: 16 − 6 = 10.'),
    skriv('Hur mycket är 20 % av 450?', t(450 * F(20, 100)),
          '10 % av 450 är 45, så 20 % är 90.'),
    skriv('Lös ekvationen 5x + 4 = 29.', x_svar(lost(5, 4, 0, 29)),
          'Dra bort 4: 5x = 25. Dela med 5: x = 5.'),
    val('Vilken uppskattning av 39,8 · 5,1 är rimligast?',
        ['Ungefär 200, eftersom 40 · 5 = 200', 'Ungefär 2 000, eftersom 40 · 50 = 2 000',
         'Ungefär 150, eftersom 30 · 5 = 150'], 'Ungefär 200, eftersom 40 · 5 = 200',
        'Avrunda till närmaste lätta tal: 39,8 ≈ 40 och 5,1 ≈ 5. Exakt blir det 202,98.'),
    skriv('Förenkla 3(2a − 1) − 2a.', uttr('4a - 3', '-3 + 4a'),
          'Multiplicera in: 6a − 3 − 2a. Lägg ihop a-termerna: 4a − 3.'),
    val('Vilket tal är störst, 0,07 · 10³ eller 7 · 10⁻¹?', ['0,07 · 10³', '7 · 10⁻¹', 'De är lika stora'],
        '0,07 · 10³',
        '0,07 · 1 000 = 70, medan 7 · 10⁻¹ = 7 / 10 = 0,7.'),
    skriv('En rät linje går genom punkterna (0, −2) och (3, 4). Vilken lutning har linjen?',
          x_svar(lutning((0, -2), (3, 4)), 'k'),
          'k = (4 − (−2)) / (3 − 0) = 6 / 3 = 2.'),
    val('För vilka heltal x från 0 till 10 är 2x − 3 större än 7?', OLIKHET_ALT, OLIKHET_RATT,
        '2x − 3 > 7 ger 2x > 10, så x > 5. x = 5 ger exakt 7, och det är inte större än 7.'),
    val('Vilket resonemang visar att summan av tre heltal som följer på varandra alltid är delbar med 3?',
        ['n + (n + 1) + (n + 2) = 3n + 3 = 3(n + 1), som alltid är tre gånger ett heltal',
         '4 + 5 + 6 = 15 och 15 är delbart med 3, så det gäller alla tal som följer på varandra',
         'n + (n + 1) + (n + 2) = 3n + 2, och 3n är delbart med 3 även när man lägger till 2'],
        'n + (n + 1) + (n + 2) = 3n + 3 = 3(n + 1), som alltid är tre gånger ett heltal',
        'Ett exempel visar inte att något gäller alltid. Med n gäller resonemanget varje heltal, '
        'och summan blir 3n + 3, inte 3n + 2.'),
], beskrivning='Nextrums egna uppgifter i provstil, utan miniräknare: räkning, algebra, lutning och ett bevis. '
               'Bygger på övningsbladet «NP-träning: matematik utan miniräknare» i materialbanken.')

ABONNEMANG = 299 * F(108, 100)
SEGEL = round(sqrt(3.0 ** 2 + 4.5 ** 2), 1)
KOMMUN = 24000 * 1.015 ** 10
assert kr(ABONNEMANG) == 323 and abs(SEGEL - 5.4) < 1e-9 and round(KOMMUN, -2) == 27900
assert 110 * 6 != 600

AK9_NP_MED = niva('ma-ak9-blad-np-med-miniraknare-1', 'Med miniräknare', 'NP-träning', [
    skriv('Ett mobilabonnemang kostar 299 kr i månaden och höjs med 8 %. Vad kostar det efter höjningen? '
          'Avrunda till hela kronor.', [t(kr(ABONNEMANG)), tal(float(ABONNEMANG), 2)],
          '299 · 1,08 = 322,92, alltså ungefär 323 kr.'),
    val('1 biobiljett kostar 110 kr, 2 kostar 220 kr, 4 kostar 440 kr och 6 kostar 600 kr. '
        'Är priset proportionellt mot antalet biljetter?',
        ['Nej, för med proportionellt pris hade 6 biljetter kostat 660 kr',
         'Ja, för priset blir högre när man köper fler biljetter',
         'Ja, för 2 biljetter kostar precis dubbelt så mycket som 1'],
        'Nej, för med proportionellt pris hade 6 biljetter kostat 660 kr',
        'Proportionellt betyder samma pris per biljett hela vägen. 600 / 6 = 100 kr, men de andra kostar 110 kr styck.'),
    skriv('Ett rätvinkligt segel har kateterna 3,0 m och 4,5 m. Hur lång är den längsta sidan? '
          'Svara i meter med en decimal.', t(SEGEL),
          'c² = 3,0² + 4,5² = 9 + 20,25 = 29,25, och √29,25 ≈ 5,4.'),
    skriv('Sannolikheten för regn är 0,3 på lördag och 0,4 på söndag, och dagarna påverkar inte varandra. '
          'Hur stor är sannolikheten att det regnar båda dagarna?', p_svar(F(3, 10) * F(4, 10)),
          'Båda dagarna: multiplicera. 0,3 · 0,4 = 0,12 = 12 %.'),
    skriv('Sannolikheten för regn är 0,3 på lördag och 0,4 på söndag, och dagarna påverkar inte varandra. '
          'Hur stor är sannolikheten att det inte regnar någon av dagarna?', p_svar(F(7, 10) * F(6, 10)),
          'Uppehåll är 0,7 på lördag och 0,6 på söndag. 0,7 · 0,6 = 0,42 = 42 %.'),
    skriv('En kommun har 24 000 invånare och ökar med 1,5 % per år. Hur många invånare har den efter 10 år? '
          'Avrunda till hela hundratal.', t(int(round(KOMMUN, -2))),
          '24 000 · 1,015¹⁰ ≈ 27 853, alltså ungefär 27 900. Ökningen räknas varje år på det nya antalet.'),
    sant('En ökning med 1,5 % per år i 10 år ger sammanlagt en ökning med exakt 15 %.', False,
         '1,015¹⁰ ≈ 1,16, alltså ungefär 16 %. Varje års ökning räknas på ett större tal än förra årets.'),
    skriv('Elin och Max cyklar mot varandra från två orter som ligger 27 km isär. Elin cyklar 15 km/h och Max '
          '12 km/h. De startar samtidigt. Efter hur många timmar möts de?', t(F(27, 15 + 12)),
          'De närmar sig varandra med 15 + 12 = 27 km/h. 27 km / 27 km/h = 1 timme.'),
], beskrivning='Nextrums egna uppgifter i provstil, med miniräknare: procent, proportionalitet, Pythagoras sats, '
               'sannolikhet och problemlösning. '
               'Bygger på övningsbladet «NP-träning: matematik med miniräknare» i materialbanken.')

LINJE_AB_ALT = ['y = 2x + 1', 'y = 4x + 1', 'y = 2x + 5', 'y = x + 2']
LINJE_AB = enda(LINJE_AB_ALT, lambda a: all(
    F(p[1]) == F(a.split('= ')[1].split('x')[0] or 1) * p[0] + F(a.split('+ ')[1]) for p in ((0, 1), (2, 5))))
SKARN_LIKA = lost(2, 5, 4, -7)
assert SKARN_LIKA == 6 and 2 * 6 + 5 == 17

AK9_NP_ALGEBRA = niva('ma-ak9-blad-np-algebra-1', 'Algebra och funktioner', 'NP-träning', [
    skriv('Förenkla 5x − 2(x − 3).', uttr('3x + 6', '6 + 3x'),
          'Minus framför parentesen byter tecken: 5x − 2x + 6 = 3x + 6.'),
    skriv('Lös ekvationen 7 − 2x = 1.', x_svar(lost(-2, 7, 0, 1)),
          'Dra bort 7: −2x = −6. Dela med −2: x = 3.'),
    skriv('Beräkna y när x = −2 i y = 3x + 4.', x_svar(3 * -2 + 4, 'y'),
          '3 · (−2) + 4 = −6 + 4 = −2.'),
    val('Ett abonnemang kostar 200 kr i startavgift och 50 kr per månad. Vilket uttryck ger kostnaden i kronor '
        'efter m månader?', ['200 + 50m', '50 + 200m', '250m', '200 − 50m'], '200 + 50m',
        'Startavgiften betalas en gång och 50 kr varje månad: 200 + 50m.'),
    val('En rät linje går genom punkterna (0, 1) och (2, 5). Vilken är linjens ekvation?', LINJE_AB_ALT, LINJE_AB,
        'm = 1 eftersom linjen går genom (0, 1). y ökar med 4 när x ökar med 2, så k = 4 / 2 = 2.'),
    skriv('Lös ekvationen 3(x + 2) = 5x − 4.', x_svar(lost(3, 6, 5, -4)),
          '3x + 6 = 5x − 4 ger 10 = 2x, så x = 5. Kontroll: 3 · 7 = 21 och 25 − 4 = 21.'),
    skriv('Faktorisera 6x + 9.', uttr('3(2x + 3)', '3(3 + 2x)', '3 · (2x + 3)'),
          'Både 6x och 9 är delbara med 3: 6x + 9 = 3 · 2x + 3 · 3 = 3(2x + 3).'),
    skriv('För vilket x är 2x + 5 och 4x − 7 lika stora?', x_svar(SKARN_LIKA),
          '2x + 5 = 4x − 7 ger 12 = 2x, så x = 6. Båda blir då 17.'),
    val('2x + 5 och 4x − 7 är lika stora när x = 6. Vad betyder det för linjerna y = 2x + 5 och y = 4x − 7?',
        ['Linjerna skär varandra i punkten (6, 17)', 'Linjerna är parallella och möts aldrig',
         'Linjerna skär y-axeln i samma punkt (0, 6)'], 'Linjerna skär varandra i punkten (6, 17)',
        'När x = 6 har båda linjerna y = 17, alltså en gemensam punkt. Parallella linjer har samma k, och de här har k = 2 och k = 4.'),
], beskrivning='Nextrums egna uppgifter i provstil: förenkla, faktorisera, lösa ekvationer och tolka räta linjer. '
               'Bygger på övningsbladet «NP-träning: algebra och funktioner» i materialbanken.')

LIKF_ALT = ['9 cm och 12 cm', '13 cm och 14 cm', '6 cm och 8 cm', '12 cm och 13 cm']
LIKF = enda(LIKF_ALT, lambda a: [F(s) for s in a.replace(' cm', '').split(' och ')] == [3 * F(15, 5), 4 * F(15, 5)])
VINKEL_ALT = ['30°, 60° och 90°', '20°, 40° och 60°', '45°, 45° och 90°', '60°, 60° och 60°']
VINKEL = enda(VINKEL_ALT, lambda a: [int(s) for s in a.replace('°', '').replace(' och', ',').split(', ')]
              == [180 * k // 6 for k in (1, 2, 3)])
assert round(pi * 10) == 31 and round(pi * 16) == 50 and round(4 * pi * 27 / 3) == 113
NP_STEGE = round(sqrt(4.0 ** 2 - 1.2 ** 2), 1)
assert abs(NP_STEGE - 3.8) < 1e-9

AK9_NP_GEOMETRI = niva('ma-ak9-blad-np-geometri-1', 'Geometri', 'NP-träning', [
    skriv('En rätvinklig triangel har kateterna 6 cm och 8 cm. Beräkna triangelns area. Svara i cm².',
          t(F(6 * 8, 2)),
          'Kateterna står vinkelräta mot varandra och är bas och höjd: 6 · 8 / 2 = 24 cm².'),
    skriv('En cirkel har diametern 10 cm. Beräkna omkretsen. Avrunda till hela cm.', t(round(pi * 10)),
          'Omkretsen är π · d = π · 10 ≈ 31,4, alltså 31 cm.'),
    skriv('Beräkna arean av en cirkel med radien 4 cm. Avrunda till hela cm².', t(round(pi * 4 ** 2)),
          'Arean är π · r² = π · 16 ≈ 50,3, alltså 50 cm².'),
    skriv('Ett klot har radien 3 cm. Beräkna volymen. Avrunda till hela cm³.', t(round(4 * pi * 3 ** 3 / 3)),
          'Volymen är 4 · π · r³ / 3 = 4 · π · 27 / 3 = 36π ≈ 113,1, alltså 113 cm³.'),
    skriv('En stege som är 4,0 m lång står 1,2 m från en vägg. Hur högt upp når den? Svara i meter med en decimal.',
          t(NP_STEGE),
          'h² = 4,0² − 1,2² = 16 − 1,44 = 14,56, och √14,56 ≈ 3,8.'),
    val('Två trianglar är likformiga. Den mindre har sidorna 3, 4 och 5 cm. Den längsta sidan i den större är 15 cm. '
        'Hur långa är de andra sidorna i den större?', LIKF_ALT, LIKF,
        'Skalan är 15 / 5 = 3. Alla sidor blir tre gånger så långa: 3 · 3 = 9 och 3 · 4 = 12. Att lägga till 10 cm är fel.'),
    val('Vinklarna i en triangel förhåller sig som 1 : 2 : 3. Hur stora är vinklarna?', VINKEL_ALT, VINKEL,
        '1 + 2 + 3 = 6 delar på 180°, så en del är 30°. Vinklarna är 30°, 60° och 90°.'),
    skriv('En kubs begränsningsarea i cm² har samma mätetal som dess volym i cm³. Hur lång är kubens sida i cm?',
          t(6),
          'Med sidan s är arean 6s² och volymen s³. 6s² = s³ ger s = 6. Kontroll: 6 · 36 = 216 = 6³.'),
    sant('Om radien i en cirkel fördubblas blir arean fyra gånger så stor.', (2 ** 2) == 4,
         'Arean är π · r². Med radien 2r blir den π · 4r², alltså fyra gånger så stor.'),
], beskrivning='Nextrums egna uppgifter i provstil: area, omkrets, cirkel, klot, Pythagoras sats, likformighet och vinklar. '
               'Bygger på övningsbladet «NP-träning: geometri» i materialbanken.')

TRANING = [4, 6, 4, 2, 8, 4]
assert typ(TRANING) == 4 and round(float(medel(TRANING)), 1) == 4.7 and median(TRANING) == 4
P_5_6 = F(2, 6)

AK9_NP_STATISTIK = niva('ma-ak9-blad-np-statistik-1', 'Statistik och sannolikhet', 'NP-träning', [
    skriv('Sex elever tränade 4, 6, 4, 2, 8 och 4 timmar under en vecka. Vad är typvärdet? Svara i timmar.',
          t(typ(TRANING)),
          'Typvärdet är det vanligaste värdet: 4 timmar förekommer tre gånger.'),
    skriv('Sex elever tränade 4, 6, 4, 2, 8 och 4 timmar under en vecka. Beräkna medelvärdet. '
          'Svara i timmar med en decimal.', t(round(float(medel(TRANING)), 1)),
          'Summan är 28 timmar, och 28 / 6 ≈ 4,67, alltså 4,7.'),
    skriv('Sex elever tränade 4, 6, 4, 2, 8 och 4 timmar under en vecka. Vad är medianen? Svara i timmar.',
          t(median(TRANING)),
          'I ordning: 2, 4, 4, 4, 6, 8. De två mittersta är 4 och 4, så medianen är 4.'),
    skriv('I en klass med 25 elever har 60 % ett husdjur. Hur många elever har inget husdjur?',
          t(25 * F(40, 100)),
          '40 % har inget husdjur, och 40 % av 25 är 10.'),
    val('Du kastar en vanlig tärning en gång. Hur stor är sannolikheten att få en femma eller en sexa?',
        [br(P_5_6), '1/6', '2/3', '1/2'], br(P_5_6),
        'Två gynnsamma utfall av sex möjliga: 2/6 = 1/3.'),
    skriv('Två mynt kastas. Hur stor är sannolikheten att få en krona och en klave?', p_svar(F(2, 4), '2/4'),
          'Fyra lika troliga utfall: krona-krona, krona-klave, klave-krona och klave-klave. Två av dem ger en av varje.'),
    skriv('Sannolikheten att Ella vinner en match är 0,6. Hon spelar två matcher som inte påverkar varandra. '
          'Hur stor är sannolikheten att hon vinner båda?', p_svar(F(6, 10) ** 2),
          'Båda matcherna: 0,6 · 0,6 = 0,36 = 36 %.'),
    val('En tidning skriver: ”Hälften av alla som köper glass väljer choklad.” Undersökningen gjordes bland 12 '
        'kunder i en chokladbutik. Vad är problemet med slutsatsen?',
        ['Urvalet är skevt och för litet: 12 kunder i en chokladbutik säger inget om alla',
         'Det finns inget problem, eftersom hälften av 12 kunder är 6 och det är en tydlig siffra',
         'Problemet är bara att man också borde ha frågat om vilken glasstrut kunderna valde'],
        'Urvalet är skevt och för litet: 12 kunder i en chokladbutik säger inget om alla',
        'Kunder i en chokladbutik gillar troligen choklad mer än andra, och 12 personer är för få för att säga något om alla.'),
], beskrivning='Nextrums egna uppgifter i provstil: typvärde, medelvärde, median, procent, sannolikhet och att '
               'granska en undersökning. Bygger på övningsbladet «NP-träning: statistik och sannolikhet» i materialbanken.')


# ---------------------------------------------------------------- åk 9: genomgångarna, med lästext

TEXT_EKV = '\n\n'.join([
    'Ekvationer',
    'En ekvation är en likhet där ett tal är okänt. Gör samma sak på båda sidor tills x står ensamt. Exempel: 4x + 3 = 19. '
    'Dra bort 3 från båda sidor: 4x = 16. Dela med 4: x = 4. Kontroll: 4 · 4 + 3 = 19.',
    'Står x på båda sidor samlar du x-termerna på ena sidan först: 5x − 2 = 3x + 6 ger 2x = 8, så x = 4.',
    'Räta linjens ekvation',
    'En rät linje kan skrivas y = kx + m. k är lutningen, alltså hur mycket y ändras när x ökar med 1, och m är där linjen '
    'skär y-axeln. Lutningen mellan två punkter är skillnaden i y delat med skillnaden i x.',
    'Exempel: genom (1, 3) och (3, 7) är k = (7 − 3) / (3 − 1) = 2. Sätt in punkten (1, 3): 3 = 2 · 1 + m, så m = 1 och y = 2x + 1.',
    'Proportionalitet',
    'Två storheter är proportionella om den ena alltid är samma tal gånger den andra: y = kx. Grafen är en rät linje genom origo.',
])
assert lost(6, -5, 2, 7) == 3 and lutning((0, 4), (2, 0)) == -2 and lutning((1, 3), (3, 7)) == 2

AK9_GENOMGANG_EKV = niva('ma-ak9-blad-genomgang-ekvationer-1', 'Genomgång: ekvationer och funktioner',
                         'Läsa: genomgångar inför NP', [
    skriv('Lös ekvationen 6x − 5 = 2x + 7.', x_svar(lost(6, -5, 2, 7)),
          'Samla x-termerna som i texten: 4x − 5 = 7. Lägg till 5: 4x = 12, så x = 3.'),
    skriv('Bestäm lutningen k för linjen genom (0, 4) och (2, 0).', x_svar(lutning((0, 4), (2, 0)), 'k'),
          'Skillnaden i y delat med skillnaden i x: (0 − 4) / (2 − 0) = −4 / 2 = −2.'),
    val('Är sambandet y = 3x + 2 proportionellt?',
        ['Nej, för när x = 0 är y = 2, så linjen går inte genom origo',
         'Ja, för y ökar alltid med 3 när x ökar med 1, hela vägen',
         'Ja, för grafen till y = 3x + 2 är en rät linje utan krök'],
        'Nej, för när x = 0 är y = 2, så linjen går inte genom origo',
        'Enligt texten är ett proportionellt samband y = kx, och dess graf går genom origo. Här är m = 2.'),
    val('Vad ska du göra först när x står på båda sidor av likhetstecknet, enligt texten?',
        ['Samla x-termerna på ena sidan', 'Dela båda sidorna med x', 'Pröva olika tal tills det stämmer'],
        'Samla x-termerna på ena sidan',
        'Texten visar det med 5x − 2 = 3x + 6: dra bort 3x, så blir det 2x − 2 = 6 och sedan 2x = 8.'),
    skriv('I textens exempel går linjen genom (1, 3) och (3, 7). Vilket värde har m?', x_svar(F(3) - 2 * 1, 'm'),
          'Med k = 2 ger punkten (1, 3) att 3 = 2 · 1 + m, så m = 1.'),
    sant('Enligt texten är m det tal där linjen skär x-axeln.', False,
         'm är där linjen skär y-axeln, alltså y-värdet när x = 0.'),
    val('Hur ser grafen till ett proportionellt samband ut enligt texten?',
        ['En rät linje genom origo', 'En rät linje som skär y-axeln ovanför origo', 'En böjd kurva genom origo'],
        'En rät linje genom origo',
        'y = kx ger y = 0 när x = 0, så linjen går genom origo, och den är rät.'),
    skriv('Lös ekvationen 4x + 3 = 19.', x_svar(lost(4, 3, 0, 19)),
          'Dra bort 3 från båda sidor: 4x = 16. Dela med 4: x = 4.'),
], text=TEXT_EKV,
    beskrivning='Läs genomgången om ekvationer, räta linjens ekvation och proportionalitet, och svara på frågor om den. '
                'Bygger på övningsbladet «Genomgång: ekvationer och funktioner» i materialbanken.')

TEXT_GEO = '\n\n'.join([
    'Area och omkrets',
    'Rektangel och parallellogram: bas · höjd. Triangel: bas · höjd / 2. Cirkel: π · r², där r är radien och π ≈ 3,14. '
    'Cirkelns omkrets är π · d, där d är diametern.',
    'Volym',
    'Prisma och cylinder: basytans area · höjden. Pyramid och kon: basytans area · höjden / 3. Klot: 4 · π · r³ / 3. '
    '1 dm³ = 1 liter.',
    'Pythagoras sats',
    'I en rätvinklig triangel är a² + b² = c², där c är hypotenusan mitt emot den räta vinkeln. Med kateterna 5 och 12 blir '
    'c² = 25 + 144 = 169, så c = 13.',
    'Likformighet och skala',
    'Likformiga figurer har samma form: vinklarna är lika stora och sidorna har samma förhållande. Skala 1 : 200 betyder att '
    '1 cm på ritningen är 200 cm i verkligheten.',
])
assert round(pi * 2 ** 2 * 5, 1) == 62.8 and round(3.14 * 2 ** 2 * 5, 1) == 62.8
assert round(pi * 25, 1) == 78.5 and round(3.14 * 25, 1) == 78.5

AK9_GENOMGANG_GEO = niva('ma-ak9-blad-genomgang-geometri-1', 'Genomgång: geometrins formler',
                         'Läsa: genomgångar inför NP', [
    skriv('Beräkna volymen av en cylinder med radien 2 cm och höjden 5 cm. Svara i cm³ med en decimal.',
          t(round(pi * 2 ** 2 * 5, 1)),
          'Basytan är π · 2² ≈ 12,57 cm², och volymen är basytan · höjden: 12,57 · 5 ≈ 62,8 cm³.'),
    skriv('En rätvinklig triangel har kateterna 6 och 8. Hur lång är hypotenusan?', t(sqrt(6 ** 2 + 8 ** 2)),
          '6² + 8² = 36 + 64 = 100, och √100 = 10.'),
    skriv('Ett hus är 12 m långt. Hur långt är det på en ritning i skala 1 : 200? Svara i cm.', t(F(1200, 200)),
          '12 m = 1 200 cm, och 1 200 / 200 = 6 cm.'),
    val('Hur räknar man ut volymen av en kon enligt texten?',
        ['basytans area · höjden / 3', 'basytans area · höjden', 'basytans area · höjden / 2'],
        'basytans area · höjden / 3',
        'Texten säger att pyramid och kon har basytans area · höjden / 3. Utan /3 är det prisma och cylinder.'),
    skriv('Hur många liter är 1 dm³ enligt texten?', t(1),
          'Texten säger att 1 dm³ = 1 liter.'),
    sant('Enligt texten har likformiga figurer lika stora vinklar men kan ha olika storlek.', True,
         'Likformiga figurer har samma form: lika stora vinklar och sidor i samma förhållande, men de kan vara olika stora.'),
    skriv('Beräkna arean av en cirkel med radien 5 cm. Svara i cm² med en decimal.', t(round(pi * 25, 1)),
          'π · r² = 3,14 · 25 ≈ 78,5 cm².'),
    skriv('En sträcka är 3 cm lång på en ritning i skala 1 : 200. Hur lång är den i verkligheten? Svara i meter.',
          t(F(3 * 200, 100)),
          '1 cm på ritningen är 200 cm i verkligheten. 3 · 200 = 600 cm = 6 m.'),
], text=TEXT_GEO,
    beskrivning='Läs genomgången med geometrins formler för area, volym, Pythagoras sats och skala, och använd dem. '
                'Bygger på övningsbladet «Genomgång: geometrins formler» i materialbanken.')


TILLAGG = [
    bana('Matematik', 'ak7', [
        AK7_PROCENT_1, AK7_PROCENT_2,
        AK7_UTTRYCK_1, AK7_UTTRYCK_2,
        AK7_VINKLAR_1, AK7_VINKLAR_2,
    ]),
    bana('Matematik', 'ak8', [
        AK8_PYTH_1, AK8_PYTH_2,
        AK8_LAGE_1, AK8_LAGE_2,
    ]),
    bana('Matematik', 'ak9', [
        AK9_LINJE, AK9_SYSTEM,
        AK9_FAKTOR_1, AK9_FAKTOR_2,
        AK9_NP_UTAN, AK9_NP_MED, AK9_NP_ALGEBRA, AK9_NP_GEOMETRI, AK9_NP_STATISTIK,
        AK9_GENOMGANG_EKV, AK9_GENOMGANG_GEO,
    ]),
]
