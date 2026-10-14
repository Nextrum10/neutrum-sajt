# -*- coding: utf-8 -*-
"""Fler matematiknivåer för åk 1–6 (2026-10-14), i nya områden som läggs sist i banorna.

Åk 1: Dubbelt och hälften. Åk 2: Lika grupper. Åk 3: Bråk, Tabeller och diagram.
Åk 4: Bråk i vardagen, Avrunda och överslag. Åk 5: Sannolikhet, Faktorer och primtal.
Åk 6: Skala och proportionalitet, Prioriteringsregler.

Alla uppgifter är egna och skrivna från grunden mot Lgr22:s centrala innehåll. Varje facit
räknas ut här, och varje "vilken av dessa" prövar att exakt ett alternativ stämmer.
Filen är skriven med AI och inte läst av en lärare.
"""
import re
from fractions import Fraction as F

from grund import bana, niva, val, skriv, ordna, sant, para, tal


# ---------------------------------------------------------------------
# Hjälparna. Facit räknas ut i stället för att skrivas för hand.
# ---------------------------------------------------------------------

_ENTAL = ['noll', 'ett', 'två', 'tre', 'fyra', 'fem', 'sex', 'sju', 'åtta', 'nio', 'tio', 'elva', 'tolv',
          'tretton', 'fjorton', 'femton', 'sexton', 'sjutton', 'arton', 'nitton']
_TIOTAL = ['', '', 'tjugo', 'trettio', 'fyrtio', 'femtio', 'sextio', 'sjuttio', 'åttio', 'nittio']


def svar(n, enhet=None):
    """Talet som siffror och, upp till 100, med bokstäver: en sjuåring som skriver
    "åtta" har svarat rätt. Med enhet står den efter talet i ord ("åtta äpplen");
    siffror med enhet godtar rättningen själv."""
    s = [tal(n)]
    if n < 20:
        s.append(_ENTAL[n])
    elif n < 100:
        s.append(_TIOTAL[n // 10] + (_ENTAL[n % 10] if n % 10 else ''))
        if n % 10 == 1:
            s.append(_TIOTAL[n // 10] + 'en')
    elif n == 100:
        s += ['hundra', 'etthundra', 'ett hundra']
    if n == 1:
        s.append('en')
    if n == 18:
        s.append('aderton')
    if enhet:
        s += [x + ' ' + enhet for x in s[1:]]
    return s


def brak(a, b):
    """Ett bråk som skriv-facit: 3/8 och 3 / 8."""
    return ['%d/%d' % (a, b), '%d / %d' % (a, b)]


def enda(alternativ, prov):
    """Det enda alternativet som klarar provet. Klarar noll eller flera är frågan fel skriven."""
    traffar = [a for a in alternativ if prov(a)]
    assert len(traffar) == 1, 'väntade ett rätt alternativ i %r, fick %r' % (alternativ, traffar)
    return traffar[0]


def unika(*xs):
    """Alternativen, prövade: inga två är samma."""
    assert len(set(map(str, xs))) == len(xs), 'två alternativ är lika: %r' % (xs,)
    return list(xs)


def lista(delar):
    """['a', 'b', 'c'] → 'a, b och c'."""
    delar = [str(d) for d in delar]
    return delar[0] if len(delar) == 1 else ', '.join(delar[:-1]) + ' och ' + delar[-1]


def ber(uttryck):
    """'3 + 4 · 5' → 23, räknat exakt med räknesätten i skolans ordning."""
    kod = re.sub(r'(\d+)', r'_F(\1)', uttryck.replace('·', '*').replace(':', '/').replace('−', '-'))
    return eval(kod, {'_F': F})  # noqa: S307 — bara våra egna uttryck


def heltal(x):
    x = F(x)
    assert x.denominator == 1, 'väntade ett heltal, fick %s' % x
    return int(x)


def ordna_efter(fraga, poster, forklaring, extra=None):
    """Brickor ordnade efter sitt värde, minst först. Två lika stora värden hade gett två rätta ordningar."""
    varden = [v for _, v in poster]
    assert len(set(varden)) == len(varden), 'två brickor har samma värde: %r' % (poster,)
    return ordna(fraga, [t for t, _ in sorted(poster, key=lambda p: p[1])], extra=extra, forklaring=forklaring)


def sorterat(poster):
    return sorted(poster, key=lambda p: p[1])


def parvis(par, vanster_varde, hoger_varde):
    """Paren i en matchning, prövade: varje vänstersida är lika mycket som sin egen högersida
    och inte som någon annans, annars finns det två rätta svar."""
    for i, (v, _) in enumerate(par):
        for j, (_, h) in enumerate(par):
            assert (vanster_varde(v) == hoger_varde(h)) == (i == j), 'matchningen är inte entydig: %r' % (par,)
    return par


def faktorer(n):
    return [d for d in range(1, n + 1) if n % d == 0]


def ar_primtal(n):
    return n > 1 and len(faktorer(n)) == 2


def avrunda(n, steg):
    """Närmaste tiotal, hundratal eller tusental, fem uppåt som i skolan."""
    return (n + steg // 2) // steg * steg


# =====================================================================
# Åk 1: Dubbelt och hälften
# =====================================================================

AK1_DUBBELT_1 = niva('ma-ak1-fler-dubbelt-1', 'Dubbelt så många', 'Dubbelt och hälften', [
    skriv('Vad är dubbelt så mycket som 3?', svar(2 * 3),
          'Dubbelt betyder lika mycket en gång till. 3 + 3 = %s.' % tal(3 + 3)),
    val('Vad är dubbelt så mycket som 7?', unika(7 + 7, 7 + 1, 7 + 2), 7 + 7,
        'Dubbelt är inte bara ett eller två till. Du lägger till lika många en gång: 7 + 7 = %s.' % tal(7 + 7)),
    sant('Dubbelt så mycket som 5 är 10.', 5 + 5 == 10,
         '5 + 5 = 10, så det stämmer.'),
    skriv('Alma har 4 kritor. Bo har dubbelt så många. Hur många kritor har Bo?', svar(2 * 4, 'kritor'),
          'Bo har dubbelt så många som Alma: 4 + 4 = %s kritor.' % tal(4 + 4)),
    sant('Dubbelt så mycket som 6 är 14.', 6 + 6 == 14,
         '6 + 6 = %s, inte 14. 14 är dubbelt så mycket som 7.' % tal(6 + 6)),
    ordna_efter('Ordna efter hur mycket det blir, minst först.',
                [('dubbelt 4', 8), ('dubbelt 2', 4), ('dubbelt 5', 10), ('dubbelt 3', 6)],
                'Dubbelt 2 är 2 + 2 = 4, dubbelt 3 är 6, dubbelt 4 är 8 och dubbelt 5 är 10.'),
    para('Para ihop talet med dubbelt så mycket.', [(n, 2 * n) for n in (2, 4, 6, 8, 9)],
         'Dubbelt är talet plus talet: ' + lista('%d + %d = %d' % (n, n, 2 * n) for n in (2, 4, 6, 8, 9)) + '.'),
    skriv('Vad är dubbelt så mycket som 9?', svar(2 * 9),
          'Lägg till 9 en gång till: 9 + 9 = %s.' % tal(9 + 9)),
    val('Vilken addition är samma sak som dubbelt så mycket som 6?',
        unika('6 + 6', '6 + 2', '6 + 1'), enda(['6 + 6', '6 + 2', '6 + 1'], lambda a: ber(a) == 2 * 6),
        'Dubbelt så mycket som 6 är 6 + 6. Då lägger du till lika många som du redan har.'),
], beskrivning='Dubbelt är lika många en gång till: 4 och 4 blir 8.')

AK1_DUBBELT_2 = niva('ma-ak1-fler-dubbelt-2', 'Hälften', 'Dubbelt och hälften', [
    skriv('Vad är hälften av 10?', svar(10 // 2),
          'Hälften är att dela i två lika delar. 5 + 5 = 10, så hälften av 10 är 5.'),
    val('Vad är hälften av 8?', unika(8 // 2, 8 * 2, 8 - 2), 8 // 2,
        '4 + 4 = 8, så hälften av 8 är 4. 16 är dubbelt så mycket som 8.'),
    skriv('Lisa har 12 bär. Hon ger bort hälften. Hur många bär ger hon bort?', svar(12 // 2, 'bär'),
          'Hälften av 12 är 6, för 6 + 6 = 12.'),
    sant('Hälften av 14 är 7.', 7 + 7 == 14,
         '7 + 7 = 14, så hälften av 14 är 7.'),
    sant('Man kan dela 9 kulor lika mellan två barn så att båda får hela kulor.', 9 % 2 == 0,
         'Får båda 4 kulor blir en kula över, och får båda 5 behövs 10 kulor. 9 är ett udda tal, '
         'och det går inte att dela lika i två hela delar.'),
    para('Para ihop talet med hälften av talet.', [(n, n // 2) for n in (4, 8, 12, 16, 20)],
         'Hälften av 4 är 2, av 8 är 4, av 12 är 6, av 16 är 8 och av 20 är 10.'),
    val('Vad är hälften av 18?', unika(18 // 2, 18 - 10, 18 * 2), 18 // 2,
        '9 + 9 = 18, så hälften av 18 är 9.'),
    ordna_efter('Ordna efter hur mycket det blir, minst först.',
                [('hälften av 6', 3), ('hälften av 20', 10), ('hälften av 12', 6), ('hälften av 2', 1)],
                'Hälften av 2 är 1, av 6 är 3, av 12 är 6 och av 20 är 10.'),
    skriv('En pizza har 8 bitar. Hälften av bitarna är uppätna. Hur många bitar är kvar?', svar(8 // 2, 'bitar'),
          'Hälften är uppätna, så hälften är kvar. Hälften av 8 är 4.'),
], beskrivning='Hälften är att dela i två lika delar: hälften av 10 är 5.')

_STORST_VARDE = {'dubbelt så mycket som 4': 2 * 4, 'hälften av 20': 20 // 2, 'dubbelt så mycket som 3': 2 * 3}
_STORST = list(_STORST_VARDE)

AK1_DUBBELT_3 = niva('ma-ak1-fler-dubbelt-3', 'Dubbelt eller hälften?', 'Dubbelt och hälften', [
    val('Siri har 6 klistermärken. Tor har dubbelt så många. Hur många klistermärken har Tor?',
        unika(6 // 2, 6 * 2, 6 + 1), 6 * 2,
        'Dubbelt så många är 6 + 6 = %s. Hälften hade varit 3.' % tal(6 + 6)),
    skriv('Maja har 10 äpplen. Ida har hälften så många. Hur många äpplen har Ida?', svar(10 // 2, 'äpplen'),
          'Hälften av 10 är 5, för 5 + 5 = 10.'),
    para('Para ihop orden med rätt tal.',
         [('dubbelt så mycket som 7', 14), ('hälften av 14', 7), ('dubbelt så mycket som 10', 20),
          ('hälften av 20', 10)],
         'Dubbelt så mycket som 7 är 7 + 7 = 14. Hälften av 14 är 7. Dubbelt så mycket som 10 är 20, '
         'och hälften av 20 är 10.'),
    sant('Hälften av 12 är lika mycket som dubbelt så mycket som 3.', 12 // 2 == 2 * 3,
         'Hälften av 12 är 6, och dubbelt så mycket som 3 är 3 + 3 = 6.'),
    sant('Dubbelt så mycket som 4 är mer än hälften av 20.', 2 * 4 > 20 // 2,
         'Dubbelt så mycket som 4 är 8. Hälften av 20 är 10. 8 är mindre än 10.'),
    val('Vilket av talen är störst?', unika(*_STORST), enda(_STORST, lambda a: _STORST_VARDE[a] == max(_STORST_VARDE.values())),
        'Dubbelt så mycket som 4 är 8, hälften av 20 är 10 och dubbelt så mycket som 3 är 6. '
        'Det största är 10.'),
    skriv('Vad är hälften av 18?', svar(18 // 2),
          '9 + 9 = 18, så hälften av 18 är 9.'),
    skriv('Ben har 4 bilar. Hans syster har dubbelt så många. Hur många bilar har de tillsammans?',
          svar(4 + 2 * 4, 'bilar'),
          'Systern har 4 + 4 = 8 bilar. Tillsammans har de 4 + 8 = %s bilar.' % tal(4 + 8)),
    val('Hälften av ett tal är 6. Vilket är talet?', unika(6 * 2, 6 // 2, 6 + 1), 6 * 2,
        'Talet är dubbelt så stort som hälften: 6 + 6 = %s. Kolla: hälften av 12 är 6.' % tal(12)),
    ordna_efter('Ordna efter hur mycket det blir, minst först.',
                [('hälften av 18', 9), ('dubbelt 4', 8), ('hälften av 10', 5), ('dubbelt 6', 12)],
                'Hälften av 10 är 5, dubbelt 4 är 8, hälften av 18 är 9 och dubbelt 6 är 12.'),
], beskrivning='Läs noga om det är dubbelt eller hälften, och räkna.')


# =====================================================================
# Åk 2: Lika grupper
# =====================================================================

AK2_GRUPPER_1 = niva('ma-ak2-fler-grupper-1', 'Lika stora grupper', 'Lika grupper', [
    skriv('Det är 3 påsar med 2 bullar i varje påse. Hur många bullar är det?', svar(3 * 2, 'bullar'),
          'Tre påsar med 2 bullar var: 2 + 2 + 2 = %s.' % tal(3 * 2)),
    val('Det är 4 askar med 3 pennor i varje ask. Vilken addition visar hur många pennor det är?',
        unika('3 + 3 + 3 + 3', '3 + 4', '4 + 4 + 4 + 4'),
        enda(['3 + 3 + 3 + 3', '3 + 4', '4 + 4 + 4 + 4'], lambda a: ber(a) == 4 * 3),
        'Varje ask har 3 pennor och det finns 4 askar. Då lägger du 3 fyra gånger: 3 + 3 + 3 + 3 = %s.' % tal(4 * 3)),
    skriv('Räkna: 4 + 4 + 4', svar(4 + 4 + 4),
          'Tre fyror: 4 + 4 = 8, och 8 + 4 = %s.' % tal(12)),
    sant('2 + 2 + 2 + 2 är 4 grupper med 2.', True,
         'Varje 2 är en grupp, och det finns fyra tvåor. 2 + 2 + 2 + 2 = %s.' % tal(8)),
    sant('3 + 3 + 3 är samma sak som 3 grupper med 2.', ber('3 + 3 + 3') == ber('2 + 2 + 2'),
         '3 + 3 + 3 är 3 grupper med 3, och det blir %s. 3 grupper med 2 är 2 + 2 + 2 = %s.'
         % (tal(3 + 3 + 3), tal(2 + 2 + 2))),
    val('Hur många hjul har 4 cyklar? Varje cykel har 2 hjul.', unika(4 * 2, 4 + 2, 5 * 2), 4 * 2,
        'Det är 4 grupper med 2 hjul: 2 + 2 + 2 + 2 = %s.' % tal(4 * 2)),
    ordna_efter('Ordna efter hur många det blir tillsammans, minst först.',
                [('2 grupper med 5', 2 * 5), ('3 grupper med 2', 3 * 2), ('4 grupper med 3', 4 * 3),
                 ('5 grupper med 1', 5 * 1)],
                '5 grupper med 1 är 5, 3 grupper med 2 är 6, 2 grupper med 5 är 10 och 4 grupper med 3 är 12.'),
    para('Para ihop additionen med hur mycket det blir.',
         parvis([('2 + 2 + 2', tal(6)), ('3 + 3 + 3 + 3', tal(12)), ('5 + 5 + 5 + 5', tal(20)),
                 ('10 + 10 + 10', tal(30))], ber, lambda h: F(h.replace(' ', ''))),
         '2 + 2 + 2 = 6, 3 + 3 + 3 + 3 = 12, 5 + 5 + 5 + 5 = 20 och 10 + 10 + 10 = 30.'),
    skriv('Hur många fingrar har 4 händer tillsammans? Varje hand har 5 fingrar.', svar(4 * 5, 'fingrar'),
          'Det är 4 grupper med 5: 5 + 5 + 5 + 5 = %s.' % tal(4 * 5)),
], beskrivning='Lika stora grupper och att lägga ihop dem: 3 påsar med 2 bullar i varje.')

AK2_GRUPPER_2 = niva('ma-ak2-fler-grupper-2', 'Gånger-tecknet', 'Lika grupper', [
    val('Vilken addition ger samma svar som 3 · 4?', unika('4 + 4 + 4', '3 + 4', '3 + 3 + 3'),
        enda(['4 + 4 + 4', '3 + 4', '3 + 3 + 3'], lambda a: ber(a) == ber('3 · 4')),
        '3 · 4 betyder 3 grupper med 4: 4 + 4 + 4 = %s. 3 + 4 blir bara %s och 3 + 3 + 3 blir %s.'
        % (tal(12), tal(7), tal(9))),
    skriv('Vad är 2 · 6?', svar(2 * 6),
          'Två sexor: 6 + 6 = %s.' % tal(2 * 6)),
    skriv('Vad är 5 · 5?', svar(5 * 5),
          'Fem grupper med 5: 5 + 5 + 5 + 5 + 5 = %s.' % tal(5 * 5)),
    val('Vad är 3 · 3?', unika(3 * 3, 3 + 3, 4 * 3), 3 * 3,
        'Tre grupper med 3: 3 + 3 + 3 = %s. 3 + 3 = 6 är bara två grupper.' % tal(3 * 3)),
    sant('4 · 5 är lika mycket som 5 + 5 + 5 + 5.', ber('4 · 5') == ber('5 + 5 + 5 + 5'),
         '4 · 5 är 4 grupper med 5, alltså 5 + 5 + 5 + 5 = %s.' % tal(20)),
    sant('2 · 9 är lika mycket som 9 + 2.', ber('2 · 9') == ber('9 + 2'),
         '2 · 9 är 9 + 9 = %s. 9 + 2 blir bara %s.' % (tal(18), tal(11))),
    skriv('Det går 4 barn i varje bil. Det finns 3 bilar. Hur många barn får plats?', svar(3 * 4, 'barn'),
          'Det är 3 grupper med 4 barn: 3 · 4 = %s.' % tal(3 * 4)),
    ordna_efter('Ordna räkningarna efter svaret, minst först.',
                [('2 · 3', 6), ('3 · 4', 12), ('2 · 8', 16), ('5 · 2', 10)],
                '2 · 3 = 6, 5 · 2 = 10, 3 · 4 = 12 och 2 · 8 = 16.'),
    para('Para ihop räkningen med svaret.',
         parvis([('2 · 4', tal(8)), ('3 · 5', tal(15)), ('4 · 4', tal(16)), ('3 · 6', tal(18))],
                ber, lambda h: F(h)),
         '2 · 4 = 8, 3 · 5 = 15, 4 · 4 = 16 och 3 · 6 = 18.'),
    val('Vilken räkning har svaret 20?', unika('4 · 5', '4 · 4', '5 · 5', '2 · 5'),
        enda(['4 · 5', '4 · 4', '5 · 5', '2 · 5'], lambda a: ber(a) == 20),
        '4 · 5 = 20. 4 · 4 är 16, 5 · 5 är 25 och 2 · 5 är bara 10.'),
], beskrivning='Gånger-tecknet visar lika stora grupper: 3 · 4 är 3 grupper med 4.')

AK2_GRUPPER_3 = niva('ma-ak2-fler-grupper-3', 'Gånger och dela lika', 'Lika grupper', [
    skriv('12 kulor delas lika i 3 påsar. Hur många kulor är det i varje påse?', svar(12 // 3, 'kulor'),
          'Tre påsar med 4 kulor var: 4 + 4 + 4 = 12.'),
    skriv('Mira lägger 2 äpplen på varje tallrik. Hon har 5 tallrikar. Hur många äpplen behöver hon?',
          svar(5 * 2, 'äpplen'),
          'Det är 5 grupper med 2: 2 + 2 + 2 + 2 + 2 = %s.' % tal(5 * 2)),
    val('10 godisbitar delas lika mellan 2 barn. Hur många bitar får varje barn?',
        unika(10 // 2, 10 - 2, 10 + 10), 10 // 2,
        'Båda barnen får 5 bitar, för 5 + 5 = 10.'),
    sant('Man kan dela 9 kulor lika i 3 påsar, så att det blir lika många kulor i varje påse.', 9 % 3 == 0,
         '3 + 3 + 3 = 9, så varje påse får 3 kulor.'),
    sant('Man kan dela 10 kulor lika i 3 påsar, så att det blir lika många kulor i varje påse.', 10 % 3 == 0,
         '3 + 3 + 3 = 9 och 4 + 4 + 4 = 12. 10 ligger mittemellan, så en kula skulle bli över.'),
    val('15 elever delas i grupper med 5 elever i varje grupp. Hur många grupper blir det?',
        unika(15 // 5, 15 - 5, 15 + 5), 15 // 5,
        '5 + 5 + 5 = 15, så det blir 3 grupper.'),
    skriv('Ett paket har 4 pennor. Hur många pennor är det i 5 paket?', svar(5 * 4, 'pennor'),
          'Det är 5 grupper med 4: 4 + 4 + 4 + 4 + 4 = %s.' % tal(5 * 4)),
    para('Para ihop gånger-räkningen med delningen som hör ihop.',
         [('2 · 5 = 10', '10 delat med 2 = 5'), ('3 · 4 = 12', '12 delat med 3 = 4'),
          ('5 · 3 = 15', '15 delat med 5 = 3'), ('4 · 4 = 16', '16 delat med 4 = 4')],
         'Gånger och delat hör ihop. Eftersom 3 · 4 = 12 blir 12 delat med 3 lika med 4, och så vidare.'),
    ordna_efter('Ordna efter hur många som blir i varje grupp, minst först.',
                [('Dela 10 på 5', 2), ('Dela 12 på 3', 4), ('Dela 18 på 3', 6), ('Dela 20 på 2', 10)],
                '10 delat på 5 är 2, 12 på 3 är 4, 18 på 3 är 6 och 20 på 2 är 10.'),
    skriv('Lo har 3 askar med 4 kritor i varje ask. Hon ger bort 2 kritor. Hur många kritor har hon kvar?',
          svar(3 * 4 - 2, 'kritor'),
          'Först: 3 · 4 = 12 kritor. Sedan ger hon bort 2: 12 − 2 = %s.' % tal(3 * 4 - 2)),
], beskrivning='Lika grupper i vardagen, och att dela lika som är motsatsen till gånger.')


# =====================================================================
# Åk 3: Bråk
# =====================================================================

_DELAR = [('en halv', 2), ('en tredjedel', 3), ('en fjärdedel', 4), ('en femtedel', 5), ('en tiondel', 10)]

AK3_BRAK_1 = niva('ma-ak3-fler-brak-1', 'En halv, en tredjedel och en fjärdedel', 'Bråk', [
    val('En kaka delas i 4 lika stora delar. Hur stor del av kakan är en av delarna?',
        unika('en fjärdedel', 'en tredjedel', 'en halv'), 'en fjärdedel',
        'Delas något i 4 lika stora delar är varje del en fjärdedel.'),
    para('Para ihop delningen med namnet på en del.',
         [('2 lika delar', 'en halv'), ('3 lika delar', 'en tredjedel'), ('4 lika delar', 'en fjärdedel'),
          ('5 lika delar', 'en femtedel'), ('10 lika delar', 'en tiondel')],
         'Delar man något i 2 lika delar blir varje del en halv, i 3 en tredjedel, i 4 en fjärdedel, '
         'i 5 en femtedel och i 10 en tiondel.'),
    skriv('Hur många fjärdedelar behövs för att bli en hel pizza?', tal(4),
          'En fjärdedel är en av fyra lika delar. Alla fyra delarna tillsammans är hela pizzan.'),
    sant('Två halvor är lika mycket som en hel.', True,
         'En halv är en av två lika delar. Båda delarna tillsammans är hela.'),
    sant('En tredjedel är större än en halv.', 1 / 3 > 1 / 2,
         'Delar du i 3 delar blir varje del mindre än när du delar i 2. Ju fler lika delar, desto mindre blir varje del.'),
    val('Vilket bråk betyder en tredjedel?', unika('1/3', '3/1', '1/4'), '1/3',
        'Talet under strecket säger i hur många lika delar helheten delas: 3. Talet över strecket säger hur många '
        'delar vi tar: 1. En tredjedel är 1/3.'),
    skriv('En chokladkaka har 8 rutor. Du äter en halv kaka. Hur många rutor äter du?', tal(8 // 2),
          'Hälften av 8 rutor är 4 rutor, för 4 + 4 = 8.'),
    ordna_efter('Ordna delarna från minst till störst.',
                [(namn, F(1, n)) for namn, n in _DELAR],
                'Ju fler lika delar något delas i, desto mindre blir varje del. En tiondel är minst, sedan '
                'kommer en femtedel, en fjärdedel och en tredjedel. En halv är störst.'),
    val('Vilken pizza är delad i fjärdedelar?',
        unika('En pizza delad i 4 lika stora bitar', 'En pizza delad i 4 olika stora bitar',
              'En pizza delad i 3 lika stora bitar'),
        'En pizza delad i 4 lika stora bitar',
        'Fjärdedelar är 4 delar som är exakt lika stora. Är bitarna olika stora, eller är de 3, '
        'är det inte fjärdedelar.'),
], beskrivning='Att dela en helhet i lika delar: hälften, en tredjedel och en fjärdedel.')

AK3_BRAK_2 = niva('ma-ak3-fler-brak-2', 'Bråk av ett antal', 'Bråk', [
    skriv('Vad är en fjärdedel av 20?', tal(20 // 4),
          'Dela 20 i 4 lika delar: 5 + 5 + 5 + 5 = 20. En del är 5.'),
    skriv('Vad är en tredjedel av 12?', tal(12 // 3),
          'Dela 12 i 3 lika delar: 4 + 4 + 4 = 12. En del är 4.'),
    skriv('Nora har 18 kort. En tredjedel av korten är blanka. Hur många kort är blanka?', tal(18 // 3),
          'Dela 18 i 3 lika delar: 6 + 6 + 6 = 18. En tredjedel är 6 kort.'),
    val('Vad är en halv av 30?', unika(30 // 2, 30 // 3, 30 * 2), 30 // 2,
        'Hälften av 30 är 15, för 15 + 15 = 30. En tredjedel hade varit 10.'),
    sant('En fjärdedel av 8 är 2.', 8 // 4 == 2,
         '2 + 2 + 2 + 2 = 8, så en fjärdedel av 8 är 2.'),
    sant('En halv av 6 är lika mycket som en tredjedel av 6.', 6 // 2 == 6 // 3,
         'En halv av 6 är 3, men en tredjedel av 6 är bara 2. Halvan är större.'),
    val('Av 12 barn åker en fjärdedel buss till skolan. Resten går. Hur många barn går?',
        unika(12 - 12 // 4, 12 // 4, 12 - 4), 12 - 12 // 4,
        'En fjärdedel av 12 är 3 barn som åker buss. Resten går: 12 − 3 = %s.' % tal(12 - 3)),
    para('Para ihop varje del med rätt antal.',
         [('en halv av 16', 16 // 2), ('en tredjedel av 18', 18 // 3), ('en fjärdedel av 20', 20 // 4),
          ('en fjärdedel av 12', 12 // 4)],
         'En halv av 16 är 8, en tredjedel av 18 är 6, en fjärdedel av 20 är 5 och en fjärdedel av 12 är 3.'),
    ordna_efter('Ordna uppgifterna efter svaret, minst först.',
                [('en halv av 20', 20 // 2), ('en fjärdedel av 20', 20 // 4), ('en tredjedel av 12', 12 // 3),
                 ('en halv av 12', 12 // 2)],
                'En tredjedel av 12 är 4, en fjärdedel av 20 är 5, en halv av 12 är 6 och en halv av 20 är 10.'),
    val('Du får ta en halv, en tredjedel eller en fjärdedel av 12 kakor. Vilken del ger flest kakor?',
        unika('en halv', 'en tredjedel', 'en fjärdedel'), 'en halv',
        '12 delat med 2 är 6, 12 delat med 3 är 4 och 12 delat med 4 är 3. En halv ger flest kakor.'),
], beskrivning='Hälften, en tredjedel och en fjärdedel av ett antal, och att jämföra delarna.')


# =====================================================================
# Åk 3: Tabeller och diagram
# =====================================================================

def _rader(par):
    """[('hund', 7), ('katt', 9)] → 'hund 7, katt 9'."""
    return ', '.join('%s %s' % (k, tal(v)) for k, v in par)


def _oc(par):
    """[('hund', 7), ('katt', 9), ('fisk', 5)] → 'hund 7, katt 9 och fisk 5'."""
    return lista('%s %s' % (k, tal(v)) for k, v in par)


_HUSDJUR = [('hund', 7), ('katt', 9), ('kanin', 3), ('fisk', 5)]
_GLASS = [('måndag', 12), ('tisdag', 8), ('onsdag', 15), ('torsdag', 10)]
_BILAR = [('röda', 6), ('blå', 9), ('gröna', 4)]
_LAG = [('Lag Ek', 3), ('Lag Björk', 5), ('Lag Tall', 2)]
_CYKEL = [('Sam', 12), ('Eva', 15), ('Ali', 9), ('Lin', 14)]
_SPEL = [('Ida', 14), ('Omar', 9), ('Lena', 11), ('Jon', 6)]
_BIBLIOTEK = [('måndag', 18), ('tisdag', 25), ('onsdag', 12), ('torsdag', 20)]
_FRUKT = [('äpplen', 6), ('päron', 9), ('bananer', 4), ('apelsiner', 7)]
_PLATS = ['första plats', 'andra plats', 'tredje plats', 'fjärde plats']
_SPEL_SORT = sorted(_SPEL, key=lambda p: -p[1])
_KORT = dict(_GLASS)
_MAX_GLASS = max(_GLASS, key=lambda p: p[1])[0]
_MIN_CYKEL = min(_CYKEL, key=lambda p: p[1])[0]
_MIN_FRUKT = min(_FRUKT, key=lambda p: p[1])[0]
_FRUKTDAGAR = dict(_FRUKT)

AK3_DIAGRAM_1 = niva('ma-ak3-fler-diagram-1', 'Läsa av en tabell', 'Tabeller och diagram', [
    skriv('En tabell visar hur många elever som har olika husdjur: %s. Hur många elever har katt?' % _oc(_HUSDJUR),
          tal(dict(_HUSDJUR)['katt']),
          'Titta på raden för katt: där står %s.' % tal(dict(_HUSDJUR)['katt'])),
    val('En tabell visar hur många glassar som såldes: %s. Vilken dag såldes flest glassar?' % _oc(_GLASS),
        unika(*[k for k, _ in _GLASS]), _MAX_GLASS,
        'Jämför talen i tabellen. Det högsta är %s, och det står vid %s.' % (tal(_KORT[_MAX_GLASS]), _MAX_GLASS)),
    skriv('En tabell visar hur många glassar som såldes: %s. Hur många glassar såldes på måndag och tisdag '
          'tillsammans?' % _oc(_GLASS),
          tal(_KORT['måndag'] + _KORT['tisdag']),
          'Lägg ihop de två dagarna: %s + %s = %s.' % (tal(_KORT['måndag']), tal(_KORT['tisdag']),
                                                     tal(_KORT['måndag'] + _KORT['tisdag']))),
    skriv('En tabell visar hur många glassar som såldes: %s. Hur många fler glassar såldes på onsdag än på '
          'torsdag?' % _oc(_GLASS),
          tal(_KORT['onsdag'] - _KORT['torsdag']),
          'Skillnaden är %s − %s = %s.' % (tal(_KORT['onsdag']), tal(_KORT['torsdag']),
                                           tal(_KORT['onsdag'] - _KORT['torsdag']))),
    sant('En tabell visar hur många mål lagen gjorde: %s. Lag Björk gjorde flest mål.' % _oc(_LAG),
         max(_LAG, key=lambda p: p[1])[0] == 'Lag Björk',
         'Björk gjorde 5 mål, och det är fler än Ek med 3 och Tall med 2.'),
    sant('En tabell visar hur många bilar som körde förbi: %s. Det körde förbi 20 bilar tillsammans.'
         % _oc(_BILAR),
         sum(v for _, v in _BILAR) == 20,
         'Lägg ihop alla: 6 + 9 + 4 = %s. Det är 19 bilar, inte 20.' % tal(sum(v for _, v in _BILAR))),
    val('Fyra barn cyklade olika långt: %s km. Vem cyklade kortast?'
        % lista('%s %s' % (k, tal(v)) for k, v in _CYKEL),
        unika(*[k for k, _ in _CYKEL]), _MIN_CYKEL,
        'Det minsta talet är %s km, och det är %s som cyklade.' % (tal(dict(_CYKEL)[_MIN_CYKEL]), _MIN_CYKEL)),
    para('En tabell visar poäng i ett spel: %s. Para ihop spelaren med sin placering.' % _oc(_SPEL),
         [(k, _PLATS[i]) for i, (k, _) in enumerate(_SPEL_SORT)],
         'Mest poäng ger första plats: %s.' % lista('%s fick %s poäng' % (k, tal(v)) for k, v in _SPEL_SORT)),
    ordna_efter('En tabell visar antal besökare på ett bibliotek: %s. Ordna dagarna efter antal besökare, '
                'minst först.' % _oc(_BIBLIOTEK),
                _BIBLIOTEK,
                'Räkna med talen: %s.' % lista('%s hade %s' % (k, tal(v)) for k, v in sorted(_BIBLIOTEK,
                                                                                         key=lambda p: p[1]))),
], beskrivning='Läsa av, jämföra och räkna med tal i en tabell.')

_FRUKT_TEXT = _oc(_FRUKT)
_VALD = [('äpple', 12), ('banan', 8), ('päron', 5)]
_STAPLAR = [('Hallon', 6), ('Jordgubbar', 9), ('Blåbär', 4), ('Körsbär', 7)]

AK3_DIAGRAM_2 = niva('ma-ak3-fler-diagram-2', 'Stapeldiagram', 'Tabeller och diagram', [
    skriv('I ett stapeldiagram betyder varje ruta 2 böcker. Stapeln för Bea är 4 rutor hög. '
          'Hur många böcker har Bea läst?', tal(4 * 2),
          'Varje ruta är 2 böcker och stapeln har 4 rutor: 4 · 2 = %s.' % tal(4 * 2)),
    skriv('I ett stapeldiagram betyder varje ruta 5 elever. Stapeln för klass 3A är 6 rutor hög. '
          'Hur många elever visar stapeln?', tal(6 * 5),
          'Varje ruta är 5 elever och stapeln har 6 rutor: 6 · 5 = %s.' % tal(6 * 5)),
    val('Ett stapeldiagram visar hur många frukter som såldes: %s. Vilken stapel är lägst?' % _FRUKT_TEXT,
        unika(*[k for k, _ in _FRUKT]), _MIN_FRUKT,
        'Den lägsta stapeln hör till det minsta talet. Det är %s med %s.' % (_MIN_FRUKT, tal(_FRUKTDAGAR[_MIN_FRUKT]))),
    skriv('Ett stapeldiagram visar hur många frukter som såldes: äpplen 6, päron 9 och bananer 4. '
          'Hur många fler päron än äpplen såldes?', tal(9 - 6),
          'Jämför staplarna: 9 − 6 = %s.' % tal(9 - 6)),
    sant('I ett stapeldiagram betyder varje ruta 10 sidor. En stapel som är 5 rutor hög visar 5 sidor.',
         5 * 10 == 5,
         'Varje ruta är 10 sidor, så 5 rutor är 5 · 10 = %s sidor. Titta alltid på vad en ruta betyder.' % tal(50)),
    sant('I ett stapeldiagram visar en stapel som är dubbelt så hög som en annan stapel dubbelt så mycket.', True,
         'Höjden visar hur mycket det är. Är en stapel dubbelt så hög är det dubbelt så mycket.'),
    val('I ett stapeldiagram betyder varje ruta 4 mål. Stapeln för lag A är 3 rutor hög och stapeln för lag B '
        'är 5 rutor hög. Hur många mål gjorde lag B?',
        unika(5 * 4, 5, 3 * 4, 3 + 5 + 1), 5 * 4,
        'Varje ruta är 4 mål och lag B har 5 rutor: 5 · 4 = %s. 5 är antalet rutor, inte antalet mål.' % tal(20)),
    skriv('Ett stapeldiagram visar hur många som valt frukt: %s. Hur många valde frukt tillsammans?'
          % _oc(_VALD), tal(sum(v for _, v in _VALD)),
          'Lägg ihop staplarna: 12 + 8 + 5 = %s.' % tal(sum(v for _, v in _VALD))),
    para('I ett stapeldiagram betyder varje ruta 5 kr. Para ihop stapelns höjd med beloppet.',
         [('%d rutor' % r, '%s kr' % tal(5 * r)) for r in (2, 3, 4, 6)],
         'Varje ruta är 5 kr: ' + lista('%d rutor är %s kr' % (r, tal(5 * r)) for r in (2, 3, 4, 6)) + '.'),
    ordna_efter('Fyra staplar är olika höga: %s rutor. Ordna staplarna från lägst till högst.'
                % ', '.join('%s %s' % (k, tal(v)) for k, v in _STAPLAR),
                _STAPLAR,
                'Jämför antalet rutor: %s.' % lista('%s %s' % (k, tal(v)) for k, v in sorted(_STAPLAR,
                                                                                         key=lambda p: p[1]))),
], beskrivning='Stapeldiagram: vad en ruta betyder, hur högt en stapel är och att jämföra staplar.')


# =====================================================================
# Åk 4: Bråk i vardagen
# =====================================================================

def del_av(a, b, n):
    """a/b av n, som heltal."""
    return heltal(F(a, b) * n)


AK4_BRAK_1 = niva('ma-ak4-fler-brak-1', 'Del av ett antal', 'Bråk i vardagen', [
    skriv('Vad är 3/4 av 32?', tal(del_av(3, 4, 32)),
          '1/4 av 32 är %s. Tre fjärdedelar är 3 · %s = %s.' % (tal(32 // 4), tal(32 // 4), tal(del_av(3, 4, 32)))),
    val('Vad är 2/3 av 18?', unika(del_av(2, 3, 18), del_av(1, 3, 18), del_av(1, 2, 18), 16), del_av(2, 3, 18),
        '1/3 av 18 är 6. Två tredjedelar är 2 · 6 = %s. Stannar du efter första steget får du bara 6.'
        % tal(del_av(2, 3, 18))),
    skriv('En klass har 24 elever. 1/6 av eleverna cyklar till skolan. Hur många elever cyklar?',
          tal(del_av(1, 6, 24)),
          'Dela 24 i 6 lika delar: 24 delat med 6 är %s. Så %s elever cyklar.' % (tal(24 // 6), tal(24 // 6))),
    skriv('Eva har 40 kr. Hon använder 3/10 av pengarna på bio. Hur många kronor använder hon?',
          tal(del_av(3, 10, 40)),
          '1/10 av 40 kr är %s kr. Tre tiondelar är 3 · %s = %s kr.'
          % (tal(40 // 10), tal(40 // 10), tal(del_av(3, 10, 40)))),
    sant('1/5 av 30 är 6.', del_av(1, 5, 30) == 6,
         '30 delat med 5 är 6. Fem sexor är 30, så det stämmer.'),
    sant('3/5 av 20 är 15.', del_av(3, 5, 20) == 15,
         '1/5 av 20 är 4, så 3/5 av 20 är 3 · 4 = %s. 15 är i stället 3/4 av 20.' % tal(del_av(3, 5, 20))),
    val('En burk har 30 kulor. 2/5 av dem är röda. Hur många kulor är inte röda?',
        unika(30 - del_av(2, 5, 30), del_av(2, 5, 30), del_av(1, 5, 30)), 30 - del_av(2, 5, 30),
        '1/5 av 30 är 6, så 2/5 är 12 röda kulor. De andra är 30 − 12 = %s. Svaret 12 är bara de röda.'
        % tal(30 - del_av(2, 5, 30))),
    para('Para ihop varje del av 36 med rätt antal.',
         [('1/2 av 36', del_av(1, 2, 36)), ('1/3 av 36', del_av(1, 3, 36)), ('1/4 av 36', del_av(1, 4, 36)),
          ('1/6 av 36', del_av(1, 6, 36)), ('1/9 av 36', del_av(1, 9, 36))],
         'Dela 36 med nämnaren: 36 delat med 2 är 18, med 3 är 12, med 4 är 9, med 6 är 6 och med 9 är 4.'),
    ordna_efter('Ordna uppgifterna efter svaret, minst först.',
                [('1/2 av 24', del_av(1, 2, 24)), ('1/3 av 24', del_av(1, 3, 24)), ('1/4 av 24', del_av(1, 4, 24)),
                 ('3/4 av 24', del_av(3, 4, 24))],
                '1/4 av 24 är 6, 1/3 är 8, 1/2 är 12 och 3/4 är 18.'),
    val('Vilken del av 60 är 15?', unika('1/2', '1/3', '1/4', '1/5'),
        enda(['1/2', '1/3', '1/4', '1/5'], lambda b: F(b) * 60 == 15),
        '60 delat med 4 är 15, så 15 är 1/4 av 60. 1/5 av 60 är bara 12.'),
], beskrivning='Bråk av ett antal: 3/4 av 20, 2/3 av 18 och en del som blir över.')

_MEST = ['1/2 av 10', '1/4 av 24', '1/3 av 12']


def _av(t):
    bruk, n = t.split(' av ')
    return F(bruk) * int(n)


AK4_BRAK_2 = niva('ma-ak4-fler-brak-2', 'Bråk i flera steg', 'Bråk i vardagen', [
    val('Ali har 20 kulor. 5 av kulorna är blå. Hur stor del av kulorna är blå?',
        unika('1/4', '1/5', '5/4', '4/5'), enda(['1/4', '1/5', '5/4', '4/5'], lambda b: F(b) * 20 == 5),
        '5 av 20 är samma sak som 1 av 4, eftersom 4 · 5 = 20. Därför är 1/4 av kulorna blå.'),
    skriv('1/4 av ett tal är 6. Vilket är talet?', tal(6 * 4),
          'Om en fjärdedel är 6 är hela talet 4 gånger så stort: 4 · 6 = %s.' % tal(6 * 4)),
    skriv('Ett snöre är 60 cm långt. Du klipper bort 1/3 av det. Hur många centimeter är snöret efteråt?',
          tal(60 - del_av(1, 3, 60)),
          '1/3 av 60 är 20 cm som klipps bort. Kvar är 60 − 20 = %s cm.' % tal(60 - del_av(1, 3, 60))),
    val('Vilket av dessa är mest?', unika(*_MEST), enda(_MEST, lambda a: _av(a) == max(_av(x) for x in _MEST)),
        '1/2 av 10 är 5, 1/4 av 24 är 6 och 1/3 av 12 är 4. Det största bråket ger inte alltid det största '
        'svaret: det beror också på talet man tar en del av.'),
    sant('1/2 av 8 och 1/4 av 16 är lika mycket.', del_av(1, 2, 8) == del_av(1, 4, 16),
         'Båda blir 4: 8 delat med 2 är 4 och 16 delat med 4 är 4.'),
    sant('1/2 av 20 är mer än 3/4 av 20.', del_av(1, 2, 20) > del_av(3, 4, 20),
         '1/2 av 20 är 10, men 3/4 av 20 är 15. Tre fjärdedelar är mer än en halv.'),
    skriv('En pizza har 12 bitar. Anna äter 1/4 av pizzan och Bo äter 1/3. Hur många bitar är kvar?',
          tal(12 - del_av(1, 4, 12) - del_av(1, 3, 12)),
          'Anna äter 3 bitar och Bo äter 4 bitar. Tillsammans är det 7. Kvar: 12 − 7 = %s.'
          % tal(12 - del_av(1, 4, 12) - del_av(1, 3, 12))),
    para('Para ihop beskrivningen med bråket.',
         [('En av två lika delar', '1/2'), ('Tre av fyra lika delar', '3/4'), ('Två av tre lika delar', '2/3'),
          ('En av fem lika delar', '1/5')],
         'Talet under strecket säger hur många lika delar helheten är delad i, och talet över strecket hur många '
         'av delarna vi har.'),
    ordna_efter('Ordna delarna av 12 kr, minst först.',
                [('1/2', del_av(1, 2, 12)), ('1/3', del_av(1, 3, 12)), ('1/4', del_av(1, 4, 12)),
                 ('2/3', del_av(2, 3, 12))],
                '1/4 av 12 är 3 kr, 1/3 är 4 kr, 1/2 är 6 kr och 2/3 är 8 kr.'),
    skriv('Hur många fjärdedelar är lika mycket som en halv?', tal(2),
          'En halv är 2/4, för om du delar en halv i två lika delar får du två fjärdedelar.'),
], beskrivning='Bråk i flera steg: hur stor del det är, vad som blir kvar och att jämföra delar.')


# =====================================================================
# Åk 4: Avrunda och överslag
# =====================================================================

_TIO_ALT = [23, 48, 75, 91, 104]

AK4_OVERSLAG_1 = niva('ma-ak4-fler-overslag-1', 'Avrunda tal', 'Avrunda och överslag', [
    skriv('Avrunda 74 till närmaste tiotal.', tal(avrunda(74, 10)),
          'Entalssiffran är 4. Den är mindre än 5, så vi avrundar nedåt till %s.' % tal(avrunda(74, 10))),
    val('Avrunda 365 till närmaste hundratal.', unika(avrunda(365, 100), 300, 360, 370), avrunda(365, 100),
        'Titta på tiotalssiffran: 6. Den är 5 eller mer, så vi avrundar uppåt till %s.' % tal(avrunda(365, 100))),
    skriv('Avrunda 6340 till närmaste tusental.', tal(avrunda(6340, 1000)),
          'Titta på hundratalssiffran: 3. Den är mindre än 5, så vi avrundar nedåt till %s.'
          % tal(avrunda(6340, 1000))),
    val('Vilket av talen blir 700 när du avrundar till närmaste hundratal?', [651, 649, 750, 599],
        enda([651, 649, 750, 599], lambda x: avrunda(x, 100) == 700),
        '651 har tiotalssiffran 5, så det avrundas uppåt till 700. 649 blir 600, 750 blir 800 och 599 blir 600.'),
    sant('Talet 35 avrundas till 40 när man avrundar till närmaste tiotal.', avrunda(35, 10) == 40,
         'Entalssiffran är 5, och 5 avrundas uppåt. Därför blir 35 till 40.'),
    sant('Talet 2449 avrundas till 2500 när man avrundar till närmaste hundratal.', avrunda(2449, 100) == 2500,
         'Titta bara på tiotalssiffran, som är 4. Den är mindre än 5, så svaret blir %s. '
         'Man avrundar aldrig i två steg.' % tal(avrunda(2449, 100))),
    skriv('Avrunda 8960 till närmaste hundratal.', tal(avrunda(8960, 100)),
          'Tiotalssiffran är 6, så 8900 går upp till %s.' % tal(avrunda(8960, 100))),
    para('Para ihop talet med dess avrundning till närmaste tiotal.',
         [(n, avrunda(n, 10)) for n in _TIO_ALT],
         lista('%s blir %s' % (tal(n), tal(avrunda(n, 10))) for n in _TIO_ALT) + '. Entalssiffran avgör.'),
    skriv('Ett tal avrundas till 300 när man avrundar till närmaste hundratal. Vilket är det minsta hela tal '
          'det kan vara?', tal(250),
          'Talen 250 till 349 avrundas till 300. 249 blir 200, så 250 är det minsta.'),
], beskrivning='Avrunda till närmaste tiotal, hundratal och tusental.')

def _overslag(u):
    """Överslaget: varje tal i räkningen avrundat till närmaste tiotal."""
    return ber(re.sub(r'\d+', lambda m: str(avrunda(int(m.group()), 10)), u))


AK4_OVERSLAG_2 = niva('ma-ak4-fler-overslag-2', 'Överslag och rimliga svar', 'Avrunda och överslag', [
    skriv('Gör ett överslag av 38 + 52. Avrunda varje tal till närmaste tiotal och addera. Vad får du?',
          tal(avrunda(38, 10) + avrunda(52, 10)),
          '38 blir 40 och 52 blir 50. 40 + 50 = %s.' % tal(avrunda(38, 10) + avrunda(52, 10))),
    skriv('Gör ett överslag av 6 · 49. Avrunda 49 till 50 först. Vad får du?', tal(6 * 50),
          'Räkna med 50 i stället för 49: 6 · 50 = %s. Det riktiga svaret är lite mindre, %s.'
          % (tal(6 * 50), tal(6 * 49))),
    val('Maja har 100 kr. Hon vill köpa saker som kostar 56 kr, 48 kr och 29 kr. Räcker pengarna?',
        unika('Nej, det blir ungefär 140 kr', 'Ja, det blir ungefär 100 kr', 'Ja, det blir ungefär 110 kr'),
        'Nej, det blir ungefär 140 kr',
        'Avrunda till tiotal: 60 + 50 + 30 = 140. Det är mycket mer än 100, så pengarna räcker inte. '
        'Det riktiga priset är %s kr.' % tal(56 + 48 + 29)),
    sant('Överslaget för 28 + 41 är ungefär 70.', avrunda(28, 10) + avrunda(41, 10) == 70,
         '28 blir 30 och 41 blir 40. 30 + 40 = 70.'),
    sant('Svaret 195 är rimligt för 49 + 52.', abs(195 - (avrunda(49, 10) + avrunda(52, 10))) < 20,
         'Överslaget är 50 + 50 = 100, och 195 är nästan dubbelt så mycket. Rätt svar är %s.' % tal(49 + 52)),
    val('Vilket svar är rimligt för 62 − 29? Gör först ett överslag.', unika(62 - 29, 47, 62 + 29), 62 - 29,
        'Överslaget är 60 − 30 = 30, och bara 33 ligger nära det. 47 får man om man räknar 9 − 2 i entalen '
        'i stället för att växla.'),
    skriv('Ett par byxor kostar 198 kr. Ungefär hur många kronor kostar 3 par? Avrunda priset till 200 kr.',
          tal(3 * 200),
          '3 · 200 = %s. Det riktiga priset är %s kr, alltså lite mindre.' % (tal(3 * 200), tal(3 * 198))),
    skriv('En skola har 287 elever. Varje buss tar 50 elever. Hur många bussar behövs?',
          tal(-(-287 // 50)),
          '287 är nästan 300, och 300 delat med 50 är 6. Fem bussar räcker bara till 250 elever, så det behövs %s.'
          % tal(-(-287 // 50))),
    para('Avrunda varje tal till närmaste tiotal. Para ihop räkningen med överslaget.',
         parvis([(u, tal(heltal(_overslag(u)))) for u in ('48 + 51', '103 − 49', '30 · 19', '298 + 102')],
                _overslag, lambda h: F(h)),
         '48 + 51 blir 50 + 50 = 100, 103 − 49 blir 100 − 50 = 50, 30 · 19 blir 30 · 20 = 600 och '
         '298 + 102 blir 300 + 100 = 400.'),
], beskrivning='Överslagsräkning: avrunda talen, räkna och bedöm om ett svar är rimligt.')


# =====================================================================
# Åk 5: Sannolikhet
# =====================================================================

AK5_SANNOLIKHET_1 = niva('ma-ak5-fler-sannolikhet-1', 'Chans i ord och bråk', 'Sannolikhet', [
    skriv('Du kastar en vanlig tärning med sidorna 1 till 6. Hur många av sidorna ger ett tal som är större än 4?',
          tal(len([x for x in range(1, 7) if x > 4])),
          'Talen större än 4 är 5 och 6. Det är 2 av de 6 sidorna.'),
    val('Du kastar en vanlig tärning med sidorna 1 till 6. Hur stor är sannolikheten att få en 4:a?',
        unika('1/6', '1/4', '4/6', '6/4'), '1/6',
        'Det finns 6 lika troliga sidor och bara 1 av dem är en 4:a. Sannolikheten är 1/6. '
        'Talet 4 på sidan har ingenting med nämnaren att göra.'),
    sant('Sannolikheten att få en 7:a med en vanlig tärning med sidorna 1 till 6 är noll.',
         7 not in range(1, 7),
         'Det finns ingen sida med 7, så det är omöjligt. Sannolikheten för något omöjligt är 0.'),
    sant('När du singlar en slant är det säkert att du får krona.', False,
         'Det finns två lika troliga utfall, krona och klave. Krona är inte säkert, sannolikheten är 1/2.'),
    val('En spelskiva är delad i 8 lika stora fält, och 3 av fälten är gröna. Hur stor är sannolikheten att '
        'snurran stannar på grönt?', unika('3/8', '3/5', '5/8', '8/3'), '3/8',
        '3 av de 8 fälten är gröna, och fälten är lika stora. Sannolikheten är 3/8. 3/5 jämför bara de gröna '
        'med de andra fälten.'),
    para('Para ihop händelsen med hur troligt det är.',
         [('Du slår en 7:a med en vanlig tärning.', 'omöjligt'),
          ('Du slår 1, 2, 3, 4, 5 eller 6 med en vanlig tärning.', 'säkert'),
          ('Du får krona när du singlar en slant.', 'lika troligt som klave'),
          ('Du slår ett tal större än 3 med en tärning.', 'lika troligt som ett tal mindre än 4')],
         'Det går inte att slå 7, så det är omöjligt. Alla sidor är med, så det är säkert. Krona och klave är lika '
         'troliga, och 4, 5, 6 är lika många sidor som 1, 2, 3.'),
    ordna_efter('Du drar en kula ur varje påse utan att titta. Ordna påsarna efter hur stor chansen är att dra '
                'en röd kula, minst chans först.',
                [('1 röd och 9 blå', F(1, 10)), ('5 röda och 5 blå', F(5, 10)), ('9 röda och 1 blå', F(9, 10)),
                 ('10 röda', F(10, 10))],
                'Chansen är antalet röda delat med alla kulor: 1/10, 5/10, 9/10 och 10/10. Med bara röda kulor '
                'är det säkert.'),
    skriv('I en burk ligger 4 gula, 6 röda och 2 gröna kulor. Hur många av kulorna är inte röda?',
          tal(4 + 2),
          'Det är 4 gula och 2 gröna: 4 + 2 = 6 kulor som inte är röda. Burken har 12 kulor.'),
    val('Lisa singlar en slant 3 gånger och får krona varje gång. Hur stor är chansen för krona vid nästa kast?',
        unika('Lika stor som för klave', 'Större än för klave', 'Mindre än för klave'),
        'Lika stor som för klave',
        'Myntet kommer inte ihåg tidigare kast. Varje kast har samma chans, 1/2 för krona och 1/2 för klave.'),
    val('En påse har 2 röda, 3 gröna och 5 blå kulor. Hur stor är sannolikheten att dra en grön kula?',
        unika('3/10', '3/7', '3/5', '1/3'), '3/10',
        'Det finns 2 + 3 + 5 = 10 kulor, och 3 av dem är gröna. Sannolikheten är 3/10. 3/7 jämför de gröna med '
        'de andra kulorna, inte med alla.'),
], beskrivning='Sannolikhet i ord och som bråk: omöjligt, säkert, och hur många av alla utfall som passar.')

_SKIVA_TAL = 10
AK5_SANNOLIKHET_2 = niva('ma-ak5-fler-sannolikhet-2', 'Jämföra chanser', 'Sannolikhet', [
    val('Påse A har 5 röda och 15 blå kulor. Påse B har 3 röda och 5 blå kulor. Du vill dra en röd kula. '
        'Vilken påse ger störst chans?', unika('Påse A', 'Påse B', 'Lika stor chans'),
        enda(['Påse A', 'Påse B', 'Lika stor chans'],
             lambda a: a == ('Påse B' if F(3, 8) > F(5, 20) else 'Påse A')),
        'I påse A är 5 av 20 röda, alltså 1/4. I påse B är 3 av 8 röda, och 3/8 är mer än 1/4. '
        'Att påse A har fler röda kulor betyder inte att chansen är större.'),
    skriv('En påse har 12 kulor och 3 av dem är gula. Du drar en kula, tittar och lägger tillbaka den, och gör '
          'det 48 gånger. Ungefär hur många gånger förväntar du dig en gul kula?', tal(48 * 3 // 12),
          'Sannolikheten för gul är 3/12 = 1/4. En fjärdedel av 48 är %s.' % tal(48 // 4)),
    val('Du kastar en vanlig tärning. Vilken händelse är mest sannolik?',
        unika('Att slå en 6:a', 'Att slå ett jämnt tal', 'Att slå ett tal större än 4', 'Att slå 1 eller 2'),
        enda(['Att slå en 6:a', 'Att slå ett jämnt tal', 'Att slå ett tal större än 4', 'Att slå 1 eller 2'],
             lambda a: a == 'Att slå ett jämnt tal'),
        'Antal sidor som passar: en 6:a 1, jämnt tal 3 (2, 4, 6), större än 4 är 2 (5, 6) och 1 eller 2 är 2. '
        'Jämnt tal har flest.'),
    sant('Chansen att slå ett jämnt tal är lika stor som chansen att slå ett udda tal med en vanlig tärning.',
         len([x for x in range(1, 7) if x % 2 == 0]) == len([x for x in range(1, 7) if x % 2 == 1]),
         'Jämna tal är 2, 4 och 6. Udda tal är 1, 3 och 5. Tre sidor var, så chansen är lika stor.'),
    sant('Om du kastar en tärning 6 gånger får du alltid varje tal exakt en gång.', False,
         'Varje kast är slumpmässigt. Ibland kommer samma tal flera gånger och ibland saknas något tal.'),
    skriv('En spelskiva har 12 lika stora fält. Hälften är röda, en fjärdedel är blå och resten är gröna. '
          'Hur många fält är gröna?', tal(12 - 12 // 2 - 12 // 4),
          'Röda är 6 fält och blå är 3 fält. Resten: 12 − 6 − 3 = %s fält är gröna.' % tal(12 - 6 - 3)),
    para('Du kastar en vanlig tärning. Para ihop händelsen med hur många av 6 sidor som passar.',
         parvis([('Slå en 5:a', '1 av 6'), ('Slå ett tal under 3', '2 av 6'), ('Slå ett jämnt tal', '3 av 6'),
                 ('Slå ett tal över 6', '0 av 6')],
                lambda v: {'Slå en 5:a': 1, 'Slå ett tal under 3': 2, 'Slå ett jämnt tal': 3,
                           'Slå ett tal över 6': 0}[v],
                lambda h: int(h.split()[0])),
         'En 5:a passar 1 sida. Tal under 3 är 1 och 2. Jämna tal är 2, 4 och 6. Ingen sida har ett tal över 6.'),
    ordna_efter('Du kastar en vanlig tärning. Ordna händelserna efter sannolikhet, minst sannolik först.',
                [('Slå en 6:a', F(1, 6)), ('Slå ett tal över 4', F(2, 6)), ('Slå ett jämnt tal', F(3, 6)),
                 ('Slå ett tal under 6', F(5, 6))],
                'Antal sidor som passar: en 6:a 1 av 6, över 4 är 2 av 6, jämnt tal är 3 av 6 och under 6 är '
                '5 av 6.'),
    val('En påse har 3 röda, 2 blå och 5 gula kulor. Hur kan du öka chansen att dra en röd kula?',
        unika('Lägga i 2 röda kulor till', 'Lägga i 2 blå kulor till', 'Ta bort 2 röda kulor'),
        'Lägga i 2 röda kulor till',
        'Med 2 röda till är det 5 röda av 12, vilket är större än 3 av 10. Blå kulor till gör att de röda blir en '
        'mindre del, och tar du bort röda blir det färre.'),
], beskrivning='Jämföra chanser, förväntade antal och händelser med tärning och påse.')


# =====================================================================
# Åk 5: Faktorer och primtal
# =====================================================================

AK5_FAKTORER_1 = niva('ma-ak5-fler-faktorer-1', 'Faktorer och multiplar', 'Faktorer och primtal', [
    skriv('En multipel av 6 är ett tal som finns i 6:ans tabell. Vilken är den femte multipeln av 6?', tal(5 * 6),
          'Multiplarna av 6 är 6, 12, 18, 24 och 30. Den femte är 5 · 6 = %s.' % tal(5 * 6)),
    val('Vilket av talen är en multipel av 9?', [27, 29, 39, 19], enda([27, 29, 39, 19], lambda x: x % 9 == 0),
        '27 finns i 9:ans tabell, för 3 · 9 = 27. De andra går inte att dela med 9 utan rest.'),
    val('Vilket av talen är en faktor till 24?', [5, 7, 8, 9], enda([5, 7, 8, 9], lambda x: 24 % x == 0),
        'En faktor delar talet utan rest. 24 delat med 8 är 3, så 8 är en faktor. 24 delat med 5, 7 eller 9 '
        'går inte jämnt ut.'),
    sant('6 är en faktor till 18.', 18 % 6 == 0,
         '18 delat med 6 är 3, så 6 · 3 = 18. Därför är 6 en faktor till 18.'),
    sant('Alla multiplar av 5 slutar på siffran 5.', all(str(5 * k).endswith('5') for k in range(1, 7)),
         '10, 20 och 30 är multiplar av 5 men slutar på 0. Multiplarna av 5 slutar på 5 eller 0.'),
    skriv('Hur många olika faktorer har talet 12?', tal(len(faktorer(12))),
          'Faktorerna till 12 är ' + lista(faktorer(12)) + '. Det är %s stycken.' % tal(len(faktorer(12)))),
    para('Para ihop talet med dess minsta faktor som är större än 1.',
         [(n, min(f for f in faktorer(n) if f > 1)) for n in (9, 10, 35, 49, 11)],
         '9 = 3 · 3, 10 = 2 · 5, 35 = 5 · 7 och 49 = 7 · 7. Talet 11 går bara att dela med 1 och 11.'),
    ordna_efter('Ordna talen efter hur många faktorer de har, minst först.',
                [('7', len(faktorer(7))), ('9', len(faktorer(9))), ('8', len(faktorer(8))),
                 ('12', len(faktorer(12)))],
                '7 har 2 faktorer (1 och 7), 9 har 3 (1, 3 och 9), 8 har 4 (1, 2, 4 och 8) och 12 har 6 '
                '(1, 2, 3, 4, 6 och 12).'),
    val('Vilket tal är en gemensam faktor till 12 och 18?', [4, 5, 6, 9],
        enda([4, 5, 6, 9], lambda x: 12 % x == 0 and 18 % x == 0),
        '12 delat med 6 är 2 och 18 delat med 6 är 3. 4 går in i 12 men inte i 18, och 9 går in i 18 men inte i 12.'),
    skriv('Vilket är det minsta talet som är en multipel av både 4 och 6?',
          tal(min(x for x in range(1, 100) if x % 4 == 0 and x % 6 == 0)),
          'Multiplar av 4: 4, 8, 12 ... Multiplar av 6: 6, 12 ... Första gemensamma är 12.'),
], beskrivning='Multiplar, faktorer och gemensamma faktorer.')

AK5_FAKTORER_2 = niva('ma-ak5-fler-faktorer-2', 'Primtal och delbarhet', 'Faktorer och primtal', [
    val('Vilket av talen är ett primtal?', [21, 23, 25, 27], enda([21, 23, 25, 27], ar_primtal),
        'Ett primtal går bara att dela med 1 och sig självt. 23 klarar det. 21 = 3 · 7, 25 = 5 · 5 och 27 = 3 · 9.'),
    sant('Talet 1 är ett primtal.', ar_primtal(1),
         'Ett primtal har exakt två faktorer, 1 och sig självt. Talet 1 har bara en faktor, så det är inget primtal.'),
    sant('Talet 2 är ett primtal.', ar_primtal(2),
         '2 har exakt två faktorer, 1 och 2. Det är det enda jämna primtalet.'),
    skriv('Hur många primtal finns det mellan 10 och 20?', tal(len([x for x in range(11, 20) if ar_primtal(x)])),
          'Primtalen är ' + lista([x for x in range(11, 20) if ar_primtal(x)]) + '. Det är %s stycken.'
          % tal(len([x for x in range(11, 20) if ar_primtal(x)]))),
    val('Vilket av talen går att dela med 3 utan rest?', [124, 135, 152, 220],
        enda([124, 135, 152, 220], lambda x: sum(int(c) for c in str(x)) % 3 == 0),
        'Ett tal går att dela med 3 om siffersumman gör det. 1 + 3 + 5 = 9, och 9 går att dela med 3.'),
    skriv('Vilket är det minsta talet över 30 som går att dela med både 2 och 5 utan rest?',
          tal(min(x for x in range(31, 100) if x % 2 == 0 and x % 5 == 0)),
          'Ett tal som går att dela med både 2 och 5 slutar på 0. Det första över 30 är 40.'),
    skriv('Vilket är det största primtalet som är mindre än 30?',
          tal(max(x for x in range(2, 30) if ar_primtal(x))),
          '29 går bara att dela med 1 och 29. De tre talen mellan 29 och 30 finns inte, och 28 är jämnt.'),
    ordna_efter('Ordna primtalen från minst till störst. En av brickorna är inget primtal.',
                [(str(x), x) for x in (7, 13, 19, 31)],
                '7, 13, 19 och 31 är primtal. 21 = 3 · 7, så det är inget primtal.',
                extra=['21']),
    skriv('30 = 2 · 3 · ?. Vilket primtal saknas?', tal(30 // (2 * 3)),
          '2 · 3 = 6 och 6 · 5 = 30. Talen 2, 3 och 5 är alla primtal.'),
    val('Vilket påstående om talet 15 är sant?',
        unika('15 är ett primtal, för det är ett udda tal', '15 har fyra faktorer: 1, 3, 5 och 15',
              '15 har tre faktorer: 1, 3 och 15'),
        '15 har fyra faktorer: 1, 3, 5 och 15',
        '15 delat med 1, 3, 5 och 15 går jämnt ut. Eftersom 15 har fler än två faktorer är det inget primtal, '
        'trots att det är udda.'),
], beskrivning='Primtal och delbarhet: vilka tal som bara går att dela med 1 och sig självt.')


# =====================================================================
# Åk 6: Skala och proportionalitet
# =====================================================================

def langd_m(cm):
    return F(cm, 100)


def mtext(x):
    """Meter som text med komma: 4 → '4 m', 0,4 → '0,4 m'."""
    return tal(float(x)) + ' m'


_SKALA_ALT = ['1 cm på kartan är 1000 cm i verkligheten', '1 cm på kartan är 1000 m i verkligheten',
              '1000 cm på kartan är 1 cm i verkligheten']
_STRACKOR = [('4 cm i skala 1:1000', F(4 * 1000, 100)), ('2 cm i skala 1:%s' % tal(10000), F(2 * 10000, 100)),
             ('6 cm i skala 1:100', F(6 * 100, 100)), ('3 cm i skala 1:5000', F(3 * 5000, 100))]
_MODELL_ALT = [F(4), F(40), F(4, 10), F(400)]

AK6_SKALA_1 = niva('ma-ak6-fler-skala-1', 'Skala på kartor och ritningar', 'Skala och proportionalitet', [
    val('Skalan på en karta är 1:1000. Vad betyder det?', unika(*_SKALA_ALT), _SKALA_ALT[0],
        'Skala 1:1000 betyder att 1 cm på kartan är 1000 cm i verkligheten. 1000 cm är 10 m.'),
    skriv('Skalan på en ritning är 1:100. En vägg är 5 cm lång på ritningen. Hur många centimeter lång är väggen '
          'i verkligheten?', tal(5 * 100),
          'Allt i verkligheten är 100 gånger så långt: 5 · 100 = %s cm. Det är 5 m.' % tal(5 * 100)),
    skriv('På en karta är 1 cm lika med 2 km i verkligheten. Två byar ligger 6 cm från varandra på kartan. '
          'Hur många kilometer är det mellan byarna?', tal(6 * 2),
          'Varje centimeter är 2 km: 6 · 2 = %s km.' % tal(6 * 2)),
    val('En modellbil är byggd i skala 1:10 och är 40 cm lång. Hur lång är den riktiga bilen?',
        unika(*[mtext(x) for x in _MODELL_ALT]),
        enda([mtext(x) for x in _MODELL_ALT], lambda a: a == mtext(langd_m(40 * 10))),
        'Den riktiga bilen är 10 gånger så lång: 40 · 10 = 400 cm, och 400 cm är 4 m.'),
    sant('Skala 1:2 betyder att ritningen är dubbelt så stor som verkligheten.', False,
         'I skala 1:2 är 1 cm på ritningen 2 cm i verkligheten. Ritningen är alltså hälften så stor som verkligheten.'),
    sant('I skala 1:100 blir 3 cm på ritningen 3 m i verkligheten.', 3 * 100 == 300,
         '3 · 100 = 300 cm, och 300 cm är 3 m.'),
    skriv('En tomt är 20 m lång i verkligheten. Du ritar den i skala 1:200. Hur många centimeter lång blir tomten '
          'på ritningen?', tal(20 * 100 // 200),
          '20 m är 2000 cm. På ritningen är det 200 gånger mindre: 2000 delat med 200 är %s cm.'
          % tal(20 * 100 // 200)),
    para('Skalan är 1:50. Para ihop längden på ritningen med längden i verkligheten.',
         parvis([('%d cm' % c, mtext(F(c * 50, 100))) for c in (2, 4, 10, 30)],
                lambda v: int(v.split()[0]) * 50, lambda h: int(F(h.split()[0].replace(',', '.')) * 100)),
         'Varje centimeter på ritningen är 50 cm i verkligheten. 2 cm blir 100 cm = 1 m, 4 cm blir 2 m, '
         '10 cm blir 5 m och 30 cm blir 15 m.'),
    ordna_efter('Ordna sträckorna efter hur långa de är i verkligheten, kortast först.',
                _STRACKOR,
                'Gånger skalan: 6 cm · 100 = 6 m, 4 cm · 1000 = 40 m, 3 cm · 5000 = 150 m och '
                '2 cm · 10 000 = 200 m.'),
    val('En ritning är gjord i skala 1:20. Ett rum är 6 m långt i verkligheten. Hur långt är rummet på ritningen?',
        unika('30 cm', '3 cm', '120 cm', '300 cm'),
        '30 cm',
        '6 m är 600 cm. På ritningen blir det 20 gånger mindre: 600 delat med 20 är 30 cm.'),
], beskrivning='Skala 1:100 och 1:1000: från ritningen till verkligheten och tillbaka.')

_PRIS_PAKET = ['3 kg för 45 kr', '5 kg för 70 kr', '2 kg för 32 kr']
_PRIS_VARDE = {'3 kg för 45 kr': F(45, 3), '5 kg för 70 kr': F(70, 5), '2 kg för 32 kr': F(32, 2)}
_LITER = [('2 liter för 30 kr', F(30, 2)), ('3 liter för 36 kr', F(36, 3)), ('5 liter för 70 kr', F(70, 5)),
          ('4 liter för 64 kr', F(64, 4))]

def _kilopris(u):
    """'2 kg kostar 30 kr: 5 kg' → vad 5 kg kostar."""
    a, b, c = (int(x) for x in re.match(r'(\d+) kg kostar (\d+) kr: (\d+) kg', u).groups())
    return F(b, a) * c


AK6_SKALA_2 = niva('ma-ak6-fler-skala-2', 'Proportionalitet i vardagen', 'Skala och proportionalitet', [
    skriv('3 bullar kostar 24 kr. Alla bullar kostar lika mycket. Hur många kronor kostar 5 bullar?',
          tal(24 * 5 // 3),
          'En bulle kostar 24 delat med 3 = 8 kr. 5 bullar kostar 5 · 8 = %s kr.' % tal(24 * 5 // 3)),
    skriv('Ett recept för 4 personer behöver 6 dl mjöl. Hur många deciliter mjöl behövs för 10 personer?',
          tal(heltal(F(6 * 10, 4))),
          'Per person behövs 6 delat med 4 = 1,5 dl. För 10 personer: 10 · 1,5 = %s dl.' % tal(heltal(F(6 * 10, 4)))),
    val('En bil kör 90 km på 1 timme i jämn fart. Hur många kilometer kör den på 2,5 timmar?',
        unika(225, 180, 270, 92.5), 225,
        'På 2 timmar blir det 180 km och på en halv timme 45 km till. 180 + 45 = %s km.' % tal(180 + 45)),
    val('Vilket köp har lägst pris per kilo?', unika(*_PRIS_PAKET),
        min(_PRIS_PAKET, key=lambda a: _PRIS_VARDE[a]),
        'Räkna pris per kilo: 45 delat med 3 är 15 kr, 70 delat med 5 är 14 kr och 32 delat med 2 är 16 kr. '
        'Lägst är 14 kr, och det har 5 kg för 70 kr.'),
    sant('Ska ett recept räcka till dubbelt så många personer, ska alla mängder i receptet dubblas.', True,
         'Alla mängder följer antalet personer. Dubbelt så många personer kräver dubbelt så mycket av allt.'),
    sant('Om 2 pennor kostar 10 kr, kostar 4 pennor 14 kr.', 10 * 4 // 2 == 14,
         '2 pennor kostar 10 kr, så 4 pennor, dubbelt så många, kostar 20 kr. Man lägger inte till 2 kr.'),
    skriv('Selma cyklar 12 km på 30 minuter i jämn fart. Hur många kilometer cyklar hon på 2 timmar?',
          tal(12 * 120 // 30),
          '2 timmar är 120 minuter, alltså 4 gånger 30 minuter. Hon cyklar 4 · 12 = %s km.' % tal(12 * 4)),
    para('Alla varor kostar lika mycket per kilo. Para ihop uppgiften med priset.',
         parvis([(u, '%s kr' % tal(heltal(_kilopris(u)))) for u in
                 ('2 kg kostar 30 kr: 5 kg', '4 kg kostar 36 kr: 3 kg', '5 kg kostar 40 kr: 2 kg',
                  '3 kg kostar 21 kr: 10 kg')],
                _kilopris, lambda h: F(int(h.split()[0]))),
         'Pris per kilo först: 15 kr, 9 kr, 8 kr och 7 kr. Sedan gånger antalet kilo: 75, 27, 16 och 70 kr.'),
    ordna_efter('Ordna efter pris per liter, billigast först.', _LITER,
                'Pris per liter: 36 delat med 3 är 12 kr, 70 delat med 5 är 14 kr, 30 delat med 2 är 15 kr '
                'och 64 delat med 4 är 16 kr.'),
    skriv('Maja springer 6 varv på 15 minuter i jämn takt. Hur många minuter tar 10 varv?',
          tal(heltal(F(15 * 10, 6))),
          'Ett varv tar 15 delat med 6 = 2,5 minuter. 10 varv tar 10 · 2,5 = %s minuter.' % tal(25)),
], beskrivning='Priser, recept och fart när allt växer lika mycket: dubbelt så mycket ger dubbelt så mycket.')


# =====================================================================
# Åk 6: Prioriteringsregler
# =====================================================================

AK6_PRIORITERING_1 = niva('ma-ak6-fler-prioritering-1', 'Gånger och delat före plus och minus',
                          'Prioriteringsregler', [
    skriv('Räkna: 3 + 4 · 5', tal(heltal(ber('3 + 4 · 5'))),
          'Gånger räknas före plus: 4 · 5 = 20. Sedan 3 + 20 = %s.' % tal(heltal(ber('3 + 4 · 5')))),
    val('Räkna: 20 − 6 : 2', unika(heltal(ber('20 − 6 : 2')), heltal(ber('(20 − 6) : 2')), 14),
        heltal(ber('20 − 6 : 2')),
        'Delat räknas före minus: 6 : 2 = 3. Sedan 20 − 3 = %s. Räknar du från vänster får du 7.'
        % tal(heltal(ber('20 − 6 : 2')))),
    skriv('Räkna: 8 · 3 − 4 · 2', tal(heltal(ber('8 · 3 − 4 · 2'))),
          'Räkna båda gångerna först: 8 · 3 = 24 och 4 · 2 = 8. Sedan 24 − 8 = %s.' % tal(heltal(ber('8 · 3 − 4 · 2')))),
    val('Räkna: 6 + 3 · 4', unika(heltal(ber('6 + 3 · 4')), heltal(ber('(6 + 3) · 4')), 6 + 3 + 4),
        heltal(ber('6 + 3 · 4')),
        '3 · 4 = 12 räknas först, sedan 6 + 12 = %s. Går du från vänster får du 36.' % tal(heltal(ber('6 + 3 · 4')))),
    sant('10 − 2 · 3 är lika med 4.', ber('10 − 2 · 3') == 4,
         '2 · 3 = 6 räknas först. Sedan 10 − 6 = 4.'),
    sant('2 + 3 · 4 är lika med 20.', ber('2 + 3 · 4') == 20,
         '3 · 4 = 12 räknas först, och 2 + 12 = %s. Svaret 20 får man om man räknar plus först.'
         % tal(heltal(ber('2 + 3 · 4')))),
    ordna_efter('Ordna uttrycken efter värde, minst först.',
                [(u, heltal(ber(u))) for u in ('12 − 2 · 3', '5 + 2 · 4', '3 · 4 + 2', '20 − 3 · 4')],
                '12 − 2 · 3 = 6, 20 − 3 · 4 = 8, 5 + 2 · 4 = 13 och 3 · 4 + 2 = 14.'),
    skriv('Ali köper 2 äpplen för 5 kr styck och en banan för 3 kr. Hur många kronor betalar han?',
          tal(heltal(ber('3 + 2 · 5'))),
          'Äpplena kostar 2 · 5 = 10 kr och bananen 3 kr. Tillsammans 3 + 10 = %s kr. Det är räkningen 3 + 2 · 5.'
          % tal(heltal(ber('3 + 2 · 5')))),
    val('Vilken räkning har svaret 14?', unika('2 + 3 · 4', '2 · 3 + 4', '2 + 3 + 4', '2 · 3 · 4'),
        enda(['2 + 3 · 4', '2 · 3 + 4', '2 + 3 + 4', '2 · 3 · 4'], lambda u: ber(u) == 14),
        '2 + 3 · 4 = 2 + 12 = 14. De andra blir 10, 9 och 24.'),
    para('Para ihop uttrycket med värdet.',
         parvis([(u, tal(heltal(ber(u)))) for u in ('4 + 2 · 6', '4 · 2 + 6', '20 − 4 · 3', '9 − 6 : 3')],
                ber, lambda h: F(h)),
         '4 + 2 · 6 = 16, 4 · 2 + 6 = 14, 20 − 4 · 3 = 8 och 9 − 6 : 3 = 7. Gånger och delat räknas först.'),
], beskrivning='Gånger och delat räknas före plus och minus.')

AK6_PRIORITERING_2 = niva('ma-ak6-fler-prioritering-2', 'Parenteser och flera räknesätt',
                          'Prioriteringsregler', [
    skriv('Räkna: (3 + 4) · 5', tal(heltal(ber('(3 + 4) · 5'))),
          'Parentesen räknas först: 3 + 4 = 7. Sedan 7 · 5 = %s.' % tal(heltal(ber('(3 + 4) · 5')))),
    val('Räkna: 24 : (2 + 4)', unika(heltal(ber('24 : (2 + 4)')), heltal(ber('24 : 2 + 4')), 24 + 4),
        heltal(ber('24 : (2 + 4)')),
        'Parentesen först: 2 + 4 = 6. Sedan 24 : 6 = %s. Utan parentes hade det blivit 24 : 2 + 4 = 16.'
        % tal(heltal(ber('24 : (2 + 4)')))),
    skriv('Räkna: 50 − (4 + 6) · 3', tal(heltal(ber('50 − (4 + 6) · 3'))),
          'Parentesen först: 4 + 6 = 10. Sedan gånger: 10 · 3 = 30. Sist 50 − 30 = %s.'
          % tal(heltal(ber('50 − (4 + 6) · 3')))),
    sant('(10 − 4) : 2 är lika med 8.', ber('(10 − 4) : 2') == 8,
         'Parentesen först: 10 − 4 = 6. Sedan 6 : 2 = %s. Utan parentes hade det blivit 10 − 4 : 2 = 8.'
         % tal(heltal(ber('(10 − 4) : 2')))),
    sant('6 · (5 − 2) är lika med 18.', ber('6 · (5 − 2)') == 18,
         'Parentesen först: 5 − 2 = 3. Sedan 6 · 3 = 18.'),
    val('Var ska parentesen stå för att 2 + 3 · 4 ska bli 20?',
        unika('(2 + 3) · 4', '2 + (3 · 4)', '(2 + 3 · 4)'),
        enda(['(2 + 3) · 4', '2 + (3 · 4)', '(2 + 3 · 4)'], lambda u: ber(u) == 20),
        'Med (2 + 3) · 4 räknas plus först: 5 · 4 = 20. De andra två parenteserna ändrar inte ordningen, '
        'så svaret blir 14.'),
    skriv('Räkna: 12 : 3 · 2', tal(heltal(ber('12 : 3 · 2'))),
          'Delat och gånger har samma rang, så du räknar från vänster: 12 : 3 = 4 och sedan 4 · 2 = %s.'
          % tal(heltal(ber('12 : 3 · 2')))),
    skriv('Tre vänner delar lika på en nota. De köper 4 pizzor för 90 kr styck. Hur många kronor betalar var och en?',
          tal(heltal(ber('(4 · 90) : 3'))),
          'Först pizzornas pris: 4 · 90 = 360 kr. Sedan delas det på 3: 360 : 3 = %s kr. Det är (4 · 90) : 3.'
          % tal(heltal(ber('(4 · 90) : 3')))),
    ordna_efter('Ordna uttrycken efter värde, minst först.',
                [(u, heltal(ber(u))) for u in ('(4 + 2) · 3', '4 + 2 · 3', '(4 + 2) : 3', '4 · (2 + 3)')],
                '(4 + 2) : 3 = 2, 4 + 2 · 3 = 10, (4 + 2) · 3 = 18 och 4 · (2 + 3) = 20.'),
    para('Para ihop uttrycket med värdet.',
         parvis([(u, tal(heltal(ber(u)))) for u in ('(8 − 2) · 3', '8 − 2 · 3', '8 + 2 : 2', '(8 + 2) : 2')],
                ber, lambda h: F(h)),
         '(8 − 2) · 3 = 18, 8 − 2 · 3 = 2, 8 + 2 : 2 = 9 och (8 + 2) : 2 = 5. Parenteser ändrar ordningen.'),
], beskrivning='Parenteser först, sedan gånger och delat, sist plus och minus.')


TILLAGG = [
    bana('Matematik', 'ak1', [AK1_DUBBELT_1, AK1_DUBBELT_2, AK1_DUBBELT_3]),
    bana('Matematik', 'ak2', [AK2_GRUPPER_1, AK2_GRUPPER_2, AK2_GRUPPER_3]),
    bana('Matematik', 'ak3', [AK3_BRAK_1, AK3_BRAK_2, AK3_DIAGRAM_1, AK3_DIAGRAM_2]),
    bana('Matematik', 'ak4', [AK4_BRAK_1, AK4_BRAK_2, AK4_OVERSLAG_1, AK4_OVERSLAG_2]),
    bana('Matematik', 'ak5', [AK5_SANNOLIKHET_1, AK5_SANNOLIKHET_2, AK5_FAKTORER_1, AK5_FAKTORER_2]),
    bana('Matematik', 'ak6', [AK6_SKALA_1, AK6_SKALA_2, AK6_PRIORITERING_1, AK6_PRIORITERING_2]),
]
