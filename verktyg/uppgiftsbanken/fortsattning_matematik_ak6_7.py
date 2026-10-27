# -*- coding: utf-8 -*-
"""Fortsättningen i matematik för åk 6 och åk 7 (2026-10-27). Leo: "Nexläx där ska vi
lägga in flera uppgifter, i matte svenska och engelska årkurs 6 och uppåt."

Tre nya områden per bana, med två nivåer var, i TILLAGG så att de läggs sist:

    åk 6   Mönster och talföljder, Kombinationer, Längd, massa och volym
    åk 7   Fyrhörningar och area, Statistik och diagram, Koordinatsystem och grafer

Innehållet följer Lgr22:s centrala innehåll: åk 6 ur årskurs 4–6 (algebra: mönster i
talföljder och geometriska mönster; sannolikhet och statistik: enkel kombinatorik;
geometri: mätningar av längd, massa och volym med vanliga måttenheter), åk 7 ur
årskurs 7–9 (geometri: area och enhetsbyten; statistik: tabeller, diagram, lägesmått
och spridningsmått; samband och förändring: koordinatsystem, värdetabeller och grafer).
Banorna hade dem inte, eller bara som någon enstaka fråga i NP-träningen.

Allt är Nextrums egna uppgifter, skrivna från grunden med AI och inte lästa av någon som
undervisar i ämnet. Filen står för sig och lånar inga hjälpare ur de andra
matematikfilerna: ett facit här ska inte kunna ändras av en ändring där.

Varje facit räknas ut här (bråk med Fraction, kombinationerna med itertools), och de
felaktiga alternativen prövas mot samma räkning med enda(): ett fel facit lär barnet att
det rätta svaret är fel, och ett "fel" alternativ som råkar vara rätt gör samma sak.
"""
import itertools
import re
from fractions import Fraction as F
from math import comb, factorial, perm

from grund import bana, niva, val, skriv, ordna, sant, para, tal


# ---------------------------------------------------------------- hjälparna


def t(x):
    """Talet som svar: decimalkomma och '-' för minus (rättningen gör om − till -)."""
    if isinstance(x, F):
        x = int(x) if x.denominator == 1 else float(x)
    return tal(x)


def m(x):
    """Talet i en text eller bland alternativen, med riktigt minustecken."""
    return t(x).replace('-', '−')


def heltal(x):
    x = F(x)
    assert x.denominator == 1, 'väntade ett heltal, fick %s' % x
    return int(x)


def bv(s):
    """Ett tal ur sin text: '2 500', '0,75', '−2' → exakt värde."""
    return F(s.replace('−', '-').replace(',', '.').replace(' ', ''))


def x_svar(v, var='x'):
    """Svaret på "Vad är y?": talet, och talet skrivet som y = 5. Ett negativt tal också
    med mellanslag efter minustecknet, för rättningen läser bara -5 som ett tal."""
    s = t(v)
    svar = [s, '%s = %s' % (var, s), '%s=%s' % (var, s)]
    if s.startswith('-'):
        svar += ['- ' + s[1:], '%s = - %s' % (var, s[1:])]
    return svar


def enda(alternativ, prov):
    """Det enda alternativet som klarar provet. Klarar noll eller flera det är frågan
    fel skriven, och då ska bygget stanna."""
    traffar = [a for a in alternativ if prov(a)]
    assert len(traffar) == 1, 'väntade ett rätt alternativ i %r, fick %r' % (alternativ, traffar)
    return traffar[0]


def unika(*xs):
    """Alternativen, prövade: inga två är samma."""
    assert len(set(map(str, xs))) == len(xs), 'två alternativ är lika: %r' % (xs,)
    return [x if isinstance(x, str) else t(x) for x in xs]


def ordna_tal(fraga, par, forklaring, extra=None):
    """Brickor från minst till störst, ordnade ur sina värden. Två lika värden hade gett
    två rätta ordningar."""
    varden = [v for _, v in par]
    assert len(set(varden)) == len(varden), fraga
    return ordna(fraga, [text for text, _ in sorted(par, key=lambda p: p[1])], extra=extra, forklaring=forklaring)


def parvis(par, vanster_varde, hoger_varde):
    """Paren i en matchning, prövade: varje vänstersida hör ihop med sin egen högersida
    och med ingen annans, annars finns det två rätta svar."""
    for i, (v, _) in enumerate(par):
        for j, (_, h) in enumerate(par):
            assert (vanster_varde(v) == hoger_varde(h)) == (i == j), 'matchningen är inte entydig: %r' % (par,)
    return par


def ber(uttryck):
    """'6 · 4' → 24, räknat exakt med räknesätten i skolans ordning."""
    kod = re.sub(r'(\d+)', r'F(\1)', uttryck.replace('·', '*').replace(':', '/').replace('−', '-'))
    return eval(kod, {'F': F})  # noqa: S307 (bara våra egna uttryck)


def passar(f, punkter):
    """Formeln f stämmer med alla (x, y) i punkter."""
    return all(f(x) == y for x, y in punkter)


def formel(text):
    """'y = 3x + 4', '2n + 2', 'y = 5 − x' → en funktion av x (eller n), för att pröva
    alternativen ur sin egen text."""
    h = text.split('=')[-1].replace('−', '-').replace(' ', '').replace('n', 'x')
    h = re.sub(r'(\d)x', r'\1*x', h)
    return lambda x: eval(h, {'x': F(x)})  # noqa: S307 (bara våra egna uttryck)


def punkt(text):
    """'(−3, 2)' → (−3, 2)."""
    x, y = text.strip('()').split(',')
    return bv(x), bv(y)


def lista(delar):
    """['a', 'b', 'c'] → 'a, b och c'."""
    delar = [str(d) for d in delar]
    return delar[0] if len(delar) == 1 else ', '.join(delar[:-1]) + ' och ' + delar[-1]


assert formel('y = 3x + 4')(2) == 10 and formel('2n + 2')(10) == 22 and formel('y = 5 − x')(8) == -3
assert formel('4n')(3) == 12 and formel('y = 10 − 2x')(-2) == 14 and punkt('(−3, 2)') == (-3, 2)


# Måttenheterna, i den minsta enheten i varje tabell. Ett mått som text, som '2 500 g'
# eller '0,4 l', räknas om med matt(), så att ett fel i en text syns i bygget.
LANGD_MM = {'mm': 1, 'cm': 10, 'dm': 100, 'm': 1000, 'km': 1000000}
MASSA_G = {'g': 1, 'hg': 100, 'kg': 1000, 'ton': 1000000}
VOLYM_ML = {'ml': 1, 'cl': 10, 'dl': 100, 'l': 1000, 'liter': 1000, 'cm³': 1, 'dm³': 1000}
AREA_MM2 = {'mm²': 1, 'cm²': 100, 'dm²': 10000, 'm²': 1000000}


def matt(text, tabell):
    tal_, enhet = text.rsplit(' ', 1)
    return bv(tal_) * tabell[enhet]


assert matt('2 500 g', MASSA_G) == matt('2,5 kg', MASSA_G) and matt('0,05 km', LANGD_MM) == 50000
assert matt('1 dm³', VOLYM_ML) == matt('1 l', VOLYM_ML) and matt('1 m²', AREA_MM2) == 100 * matt('1 dm²', AREA_MM2)


# =====================================================================
# Åk 6: Mönster och talföljder
# =====================================================================


def foljd(start, steg, plats):
    """Talet på en plats i en talföljd som ökar (eller minskar) lika mycket varje gång."""
    return start + steg * (plats - 1)


def borjan(start, steg, antal=4):
    return [foljd(start, steg, n) for n in range(1, antal + 1)]


def stammer(foljden, regel):
    """Regeln ger varje tal ur talet före."""
    return all(regel(a) == b for a, b in zip(foljden, foljden[1:]))


assert borjan(4, 5) == [4, 9, 14, 19] and borjan(50, -4) == [50, 46, 42, 38] and borjan(7, 4) == [7, 11, 15, 19]

REGLER_Q2 = {
    'Varje tal är dubbelt så stort som talet före': lambda x: 2 * x,
    'Varje tal är 3 större än talet före': lambda x: x + 3,
    'Varje tal är 6 större än talet före': lambda x: x + 6,
    'Varje tal är 3 gånger så stort som talet före': lambda x: 3 * x,
}
REGLER_PAR = {'Ökar med 3': lambda x: x + 3, 'Fördubblas': lambda x: 2 * x,
              'Minskar med 3': lambda x: x - 3, 'Tredubblas': lambda x: 3 * x}
FOLJDER_PAR = [([2, 5, 8, 11], 'Ökar med 3'), ([2, 4, 8, 16], 'Fördubblas'),
               ([20, 17, 14, 11], 'Minskar med 3'), ([2, 6, 18, 54], 'Tredubblas')]
for _i, (_f, _) in enumerate(FOLJDER_PAR):
    for _j, (_, _r) in enumerate(FOLJDER_PAR):
        assert stammer(_f, REGLER_PAR[_r]) == (_i == _j), 'matchningen är inte entydig'

KVADRATTAL = [n * n for n in range(1, 6)]
OKNINGAR = [b - a for a, b in zip(KVADRATTAL, KVADRATTAL[1:])]
NEDAT = borjan(40, -7, 5)
LUCKAN = [6, 13, None, 27, 34]
STEGVIS = [1, 2, 4, 7, 11]
assert [b - a for a, b in zip(STEGVIS, STEGVIS[1:])] == [1, 2, 3, 4]
assert all(5 * n % 5 == 0 for n in range(1, 1000))

MA_AK6_MONSTER_1 = niva('ma-ak6-monster-och-talfoljder-1', 'Talföljder och regler', 'Mönster och talföljder', [
    skriv('Talföljden börjar 4, 9, 14, 19, … Vilket tal kommer efter 19?', t(foljd(4, 5, 5)),
          'Talen ökar med 5 varje gång: 9 − 4 = 5 och 14 − 9 = 5. Nästa tal är 19 + 5 = %s.' % t(foljd(4, 5, 5))),
    val('Vilken regel passar talföljden 3, 6, 12, 24, …?', list(REGLER_Q2),
        enda(list(REGLER_Q2), lambda a: stammer([3, 6, 12, 24], REGLER_Q2[a])),
        'Pröva regeln på alla talen: 3 · 2 = 6, 6 · 2 = 12 och 12 · 2 = 24. Regeln ”3 större” stämmer bara i '
        'första steget, för 6 + 3 är 9 och inte 12.'),
    skriv('Talföljden börjar 50, 46, 42, 38, … Vilket är nästa tal?', t(foljd(50, -4, 5)),
          'Talen minskar med 4 varje gång. 38 − 4 = %s.' % t(foljd(50, -4, 5))),
    sant('I talföljden 1, 4, 9, 16, 25, … ökar talen med lika mycket varje gång.', len(set(OKNINGAR)) == 1,
         'Ökningarna är %s, så de blir 2 större för varje steg. Talen är kvadrattal: 1 · 1, 2 · 2, 3 · 3 och så '
         'vidare.' % lista(OKNINGAR)),
    skriv('Talföljden börjar 7, 11, 15, 19, … Vilket tal står på plats 10?', t(foljd(7, 4, 10)),
          'Från plats 1 till plats 10 är det 9 steg, och varje steg är 4. 7 + 9 · 4 = 7 + 36 = %s.'
          % t(foljd(7, 4, 10))),
    ordna('En talföljd börjar på 40 och minskar med 7 varje gång. Sätt talen i den ordning de kommer i talföljden. '
          'En bricka hör inte dit.', [t(x) for x in NEDAT], extra=['20'],
          forklaring='Dra bort 7 varje gång: %s. Talet 20 kommer aldrig, för 26 − 7 är 19.'
                     % lista(m(x) for x in NEDAT)),
    para('Para ihop talföljden med regeln.', [(', '.join(map(str, f)), r) for f, r in FOLJDER_PAR],
         'Titta på hur man kommer från ett tal till nästa: 2, 5, 8 ökar med 3 och 20, 17, 14 minskar med 3. '
         'I 2, 4, 8, 16 blir varje tal dubbelt så stort, och i 2, 6, 18, 54 tre gånger så stort.'),
    val('Vilket tal saknas i talföljden 6, 13, □, 27, 34?', unika(20, 19, 21, 18),
        enda(unika(20, 19, 21, 18), lambda a: stammer([6, 13, int(a), 27, 34], lambda x: x + 7)),
        'Talen ökar med 7: 13 − 6 = 7 och 34 − 27 = 7. Talet efter 13 är 13 + 7 = 20, och 20 + 7 = 27 stämmer.'),
    sant('Alla tal i talföljden 5, 10, 15, 20, … är delbara med 5.', True,
         'Talet på plats n är 5 · n. Ett tal som är 5 gånger ett heltal går alltid att dela med 5 utan rest.'),
    skriv('Talföljden börjar 1, 2, 4, 7, 11, … Skillnaden mellan två tal i rad blir 1 större för varje steg. '
          'Vilket är nästa tal?', t(STEGVIS[-1] + 5),
          'Skillnaderna är 1, 2, 3 och 4. Nästa skillnad är 5, så nästa tal är 11 + 5 = %s.' % t(STEGVIS[-1] + 5)),
], beskrivning='Fortsätta talföljder, hitta regeln och räkna ut vilket tal som står på en viss plats.')

assert passar(formel('2n + 2'), [(1, 4), (2, 6), (3, 8)])
FORMLER_BORD = ['2n + 2', '4n', 'n + 4', '2n + 4']
FORMLER_PAR = [([3, 5, 7], '2n + 1'), ([5, 8, 11], '3n + 2'), ([4, 8, 12], '4n'), ([6, 7, 8], 'n + 5')]
for _i, (_f, _) in enumerate(FORMLER_PAR):
    for _j, (_, _r) in enumerate(FORMLER_PAR):
        assert passar(formel(_r), list(zip([1, 2, 3], _f))) == (_i == _j), 'matchningen är inte entydig'
PLATS10 = [('3, 6, 9, …', foljd(3, 3, 10)), ('1, 5, 9, …', foljd(1, 4, 10)),
           ('50, 47, 44, …', foljd(50, -3, 10)), ('20, 22, 24, …', foljd(20, 2, 10))]
FIGUR_PRICKAR = enda(range(1, 50), lambda n: 4 * n + 3 == 43)

MA_AK6_MONSTER_2 = niva('ma-ak6-monster-och-talfoljder-2', 'Figurmönster och formler', 'Mönster och talföljder', [
    skriv('Bord ställs i en rad. Runt ett bord får 4 personer plats, runt två bord i rad 6 personer och runt tre '
          'bord i rad 8 personer. Hur många får plats runt 10 bord i rad?', t(formel('2n + 2')(10)),
          'Varje nytt bord ger 2 platser till, en på varje långsida, och de 2 platserna på kortändarna finns kvar. '
          '10 bord ger 2 · 10 + 2 = %s platser.' % t(formel('2n + 2')(10))),
    val('Bord ställs i en rad. Ett bord har 4 platser, två bord i rad har 6 platser och tre bord i rad har 8 platser. '
        'Vilken formel ger antalet platser runt n bord i rad?', FORMLER_BORD,
        enda(FORMLER_BORD, lambda a: passar(formel(a), [(1, 4), (2, 6), (3, 8)])),
        'Pröva formlerna: 2 · 1 + 2 = 4, 2 · 2 + 2 = 6 och 2 · 3 + 2 = 8. Formeln 4n stämmer för ett bord men ger 8 '
        'platser för två bord.'),
    skriv('Ett mönster byggs av plattor. Figur 1 har 3 plattor, figur 2 har 7 och figur 3 har 11. Varje ny figur får '
          '4 plattor till. Hur många plattor har figur 6?', t(foljd(3, 4, 6)),
          'Från figur 1 till figur 6 är det 5 steg med 4 plattor var: 3 + 5 · 4 = %s plattor.' % t(foljd(3, 4, 6))),
    val('Figur nummer n i ett mönster har 5n + 1 stickor. Hur många stickor har figur 8?', unika(41, 46, 45, 14),
        enda(unika(41, 46, 45, 14), lambda a: int(a) == formel('5n + 1')(8)),
        '5n betyder 5 · n. Sätt in n = 8: 5 · 8 + 1 = 40 + 1 = 41. Talet 14 får den som räknar 5 + 8 + 1.'),
    skriv('Figur nummer n i ett mönster har 4n + 3 prickar. Vilket nummer har den figur som har 43 prickar?',
          [t(FIGUR_PRICKAR), 'figur %d' % FIGUR_PRICKAR, 'nummer %d' % FIGUR_PRICKAR,
           'figur nummer %d' % FIGUR_PRICKAR, 'n = %d' % FIGUR_PRICKAR, 'n=%d' % FIGUR_PRICKAR],
          'Räkna baklänges: 4n + 3 = 43. Ta bort 3, så är 4n = 40, och dela med 4, så är n = %d. Pröva: '
          '4 · 10 + 3 = 43.' % FIGUR_PRICKAR),
    sant('Figur 1 i ett mönster har 4 rutor, och varje ny figur har 3 rutor fler än figuren före. Då har figur 10 '
         'precis 40 rutor.', foljd(4, 3, 10) == 40,
         'Från figur 1 till figur 10 är det 9 steg: 4 + 9 · 3 = %s rutor. 4 · 10 = 40 stämmer inte, för varje '
         'ny figur får 3 rutor till, inte 4.' % t(foljd(4, 3, 10))),
    para('Para ihop tabellen med formeln för figur nummer n.',
         [('Figur 1: %d, figur 2: %d, figur 3: %d' % tuple(f), r) for f, r in FORMLER_PAR],
         'Hur mycket det ökar mellan två figurer står framför n, och resten läggs till. 3, 5, 7 ökar med 2 och '
         'börjar på 2 · 1 + 1 = 3, så formeln är 2n + 1. 4, 8, 12 är 4 gånger figurens nummer.'),
    ordna_tal('Ordna talföljderna efter vilket tal som står på plats 10, minst först.', PLATS10,
              'Plats 10 ligger 9 steg efter plats 1: 50 − 9 · 3 = %s, 3 + 9 · 3 = %s, 1 + 9 · 4 = %s och '
              '20 + 9 · 2 = %s.' % tuple(t(v) for v in sorted(v for _, v in PLATS10))),
    val('Figur 1 är en ruta. Figur 2 är en kvadrat av 2 · 2 rutor och figur 3 en kvadrat av 3 · 3 rutor. '
        'Hur många rutor har figur 7?', unika(49, 14, 21, 64),
        enda(unika(49, 14, 21, 64), lambda a: int(a) == 7 * 7),
        'Figur 7 är en kvadrat av 7 · 7 = 49 rutor. 14 är 7 · 2, och 64 är 8 · 8, alltså figur 8.'),
    sant('Formlerna 3n + 1 och 4n ger samma tal när n = 1.', formel('3n + 1')(1) == formel('4n')(1),
         'Båda ger 4 när n = 1. Men när n = 2 ger 3n + 1 talet %s och 4n talet %s, så formlerna beskriver olika '
         'mönster.' % (t(formel('3n + 1')(2)), t(formel('4n')(2)))),
], beskrivning='Mönster av figurer: hitta regeln, skriv den som en formel med n och räkna baklänges till figurens '
               'nummer.')


# =====================================================================
# Åk 6: Kombinationer
# =====================================================================


def antal(*grupper):
    """Antalet sätt att välja en sak ur varje grupp, räknat genom att lista dem alla."""
    return len(list(itertools.product(*[range(g) for g in grupper])))


assert antal(4, 2) == 8 and antal(3, 3) == 9 and antal(2, 3, 2) == 12 and antal(6, 2) == 12
TROJOR_PAR = [(2, 3), (4, 3), (5, 2), (3, 3)]
KIOSKER = [('4 smaker och 2 strutar', antal(4, 2)), ('3 smaker och 3 strutar', antal(3, 3)),
           ('2 smaker och 5 strutar', antal(2, 5)), ('6 smaker och 2 strutar', antal(6, 2))]
assert all(antal(2 * a, b) == 2 * antal(a, b) for a in range(1, 12) for b in range(1, 12))

MA_AK6_KOMB_1 = niva('ma-ak6-kombinationer-1', 'En av varje sort', 'Kombinationer', [
    skriv('En glasskiosk har 4 smaker och 2 sorters strut. Hur många olika glassar med en smak i en strut kan man '
          'välja?', t(antal(4, 2)),
          'Varje smak kan tas i båda strutarna. Det blir 4 · 2 = %s olika glassar.' % t(antal(4, 2))),
    val('Till lunch kan man välja en av 3 varmrätter och en av 3 drycker. Hur många olika luncher med en varmrätt '
        'och en dryck finns det?', unika(9, 6, 3, 12), enda(unika(9, 6, 3, 12), lambda a: int(a) == antal(3, 3)),
        'Varje varmrätt kan tas med vilken som helst av de 3 dryckerna: 3 · 3 = 9. Talet 6 får den som lägger ihop '
        'i stället för att multiplicera.'),
    skriv('En meny har 2 förrätter, 3 huvudrätter och 2 efterrätter. Hur många olika middagar med en förrätt, en '
          'huvudrätt och en efterrätt kan man välja?', t(antal(2, 3, 2)),
          'Multiplicera antalen: 2 · 3 · 2 = %s. Varje förrätt kan tas med 3 huvudrätter, och varje sådant par med '
          '2 efterrätter.' % t(antal(2, 3, 2))),
    sant('Med 5 tröjor och 3 par byxor finns det 8 olika sätt att välja en tröja och ett par byxor.',
         antal(5, 3) == 8,
         'Varje tröja kan tas med 3 par byxor, så det blir 5 · 3 = %s sätt. 8 är 5 + 3.' % t(antal(5, 3))),
    val('Du slår en vanlig tärning och singlar slant samtidigt. Hur många olika utfall finns det?',
        unika(12, 8, 6, 36), enda(unika(12, 8, 6, 36), lambda a: int(a) == antal(6, 2)),
        'Tärningen har 6 utfall och slanten 2, krona eller klave. Varje tärningsutfall kan komma med båda sidorna '
        'på slanten: 6 · 2 = 12.'),
    val('Vilken uträkning ger antalet sätt att välja en av 6 jackor och en av 4 mössor?',
        unika('6 · 4', '6 + 4', '6 − 4', '6 · 6'),
        enda(['6 · 4', '6 + 4', '6 − 4', '6 · 6'], lambda a: ber(a) == antal(6, 4)),
        'Varje jacka kan tas med var och en av de 4 mössorna. Det blir 4 + 4 + 4 + 4 + 4 + 4, alltså 6 · 4 = 24.'),
    para('Para ihop valet med antalet sätt att välja en tröja och ett par byxor.',
         parvis([('%d tröjor och %d par byxor' % (a, b), t(antal(a, b))) for a, b in TROJOR_PAR],
                lambda v: antal(*map(int, re.findall(r'\d+', v))), int),
         'Multiplicera antalet tröjor med antalet byxor: 2 · 3 = 6, 4 · 3 = 12, 5 · 2 = 10 och 3 · 3 = 9.'),
    ordna_tal('Ordna glasskioskerna efter hur många olika glassar med en smak i en strut de kan göra, minst först.',
              KIOSKER, 'Smakerna gånger strutarna: 4 · 2 = 8, 3 · 3 = 9, 2 · 5 = 10 och 6 · 2 = 12.'),
    sant('Om antalet tröjor fördubblas och antalet byxor är detsamma, blir antalet sätt att välja en tröja och ett '
         'par byxor dubbelt så stort.', True,
         'Antalet sätt är tröjorna gånger byxorna. Med dubbelt så många tröjor kan varje par byxor tas med dubbelt '
         'så många tröjor, så det blir dubbelt så många sätt.'),
], beskrivning='Räkna hur många sätt det finns att välja en sak av varje sort: multiplicera antalen.')


def ko(n):
    """Antalet ordningar för n personer i en kö, räknat genom att lista dem."""
    return len(list(itertools.permutations(range(n))))


def lag(n, k=2):
    """Antalet sätt att välja k av n när ordningen inte spelar roll, räknat genom att lista dem."""
    return len(list(itertools.combinations(range(n), k)))


assert ko(3) == factorial(3) == 6 and ko(4) == 24 and lag(6) == comb(6, 2) == 15 and lag(5) == 10 and lag(4) == 6
TVASIFFRIGA_479 = sorted(int('%d%d' % p) for p in itertools.permutations([4, 7, 9], 2))
TVASIFFRIGA_358 = sorted(int('%d%d' % p) for p in itertools.product([3, 5, 8], repeat=2))
TVASIFFRIGA_123 = sorted('%d%d' % p for p in itertools.permutations([1, 2, 3], 2))
assert len(TVASIFFRIGA_479) == 6 and len(TVASIFFRIGA_358) == 9 and TVASIFFRIGA_123 == ['12', '13', '21', '23', '31', '32']
FRAGOR_PAR = [('Ordningar för 3 personer i en kö', ko(3)), ('Ordningar för 4 personer i en kö', ko(4)),
              ('Handslag mellan 5 personer, ett per par', lag(5)),
              ('Koder med två siffror som var och en är 0–9', antal(10, 10))]
assert len({v for _, v in FRAGOR_PAR}) == len(FRAGOR_PAR)
assert all(comb(n, 2) < perm(n, 2) for n in range(2, 50))

MA_AK6_KOMB_2 = niva('ma-ak6-kombinationer-2', 'Ordningar och par', 'Kombinationer', [
    val('Ada, Bo och Cy ska ställa sig i en kö. På hur många olika sätt kan de stå?', unika(6, 3, 9, 8),
        enda(unika(6, 3, 9, 8), lambda a: int(a) == ko(3)),
        'Första platsen kan tas av 3 personer, den andra av de 2 som är kvar och den sista av den som är kvar: '
        '3 · 2 · 1 = 6.'),
    skriv('På hur många olika sätt kan 4 personer ställa sig i en kö?', t(ko(4)),
          'Första platsen har 4 att välja på, den andra 3, den tredje 2 och den sista 1: 4 · 3 · 2 · 1 = %s.'
          % t(ko(4))),
    skriv('Hur många olika tvåsiffriga tal kan du bilda med siffrorna 4, 7 och 9, om varje siffra får användas högst '
          'en gång i talet?', t(len(TVASIFFRIGA_479)),
          'Tiotalssiffran kan väljas på 3 sätt och entalssiffran på de 2 sätt som är kvar: 3 · 2 = 6. Talen är %s.'
          % lista(TVASIFFRIGA_479)),
    val('Hur många olika tvåsiffriga tal kan du bilda med siffrorna 3, 5 och 8, om en siffra får användas flera '
        'gånger i talet?', unika(9, 6, 3, 8), enda(unika(9, 6, 3, 8), lambda a: int(a) == len(TVASIFFRIGA_358)),
        'Både tiotalssiffran och entalssiffran kan väljas på 3 sätt: 3 · 3 = 9. Då räknas också 33, 55 och 88.'),
    skriv('Sex lag ska spela en serie där varje lag möter vart och ett av de andra lagen en gång. Hur många matcher '
          'blir det?', t(lag(6)),
          'Varje lag spelar 5 matcher, och 6 · 5 = 30. Men då har varje match räknats två gånger, en gång för vart '
          'och ett av de två lagen. Det blir 30 : 2 = %s matcher.' % t(lag(6))),
    sant('Fem kompisar hälsar på varandra, och var och en tar alla de andra i hand en gång. Det blir 20 handslag.',
         lag(5) == 20,
         'Var och en tar 4 i hand, och 5 · 4 = 20. Men då har varje handslag räknats två gånger, en gång för var '
         'och en av de två som hälsar. Det blir 20 : 2 = %s handslag.' % t(lag(5))),
    val('En glassbar har 4 smaker. Du ska ta två olika smaker i samma bägare, och det spelar ingen roll vilken som '
        'läggs i först. Hur många olika bägare kan du välja?', unika(6, 12, 8, 16),
        enda(unika(6, 12, 8, 16), lambda a: int(a) == lag(4)),
        'Om ordningen räknas finns det 4 · 3 = 12 sätt. Men jordgubb och vanilj är samma bägare som vanilj och '
        'jordgubb, så varje bägare har räknats två gånger: 12 : 2 = 6.'),
    para('Para ihop frågan med svaret.', [(f, t(v)) for f, v in FRAGOR_PAR],
         'Tre i en kö: 3 · 2 · 1 = 6. Fyra i en kö: 4 · 3 · 2 · 1 = 24. Handslagen: 5 · 4 : 2 = 10. Koderna: '
         '10 · 10 = 100, från 00 till 99.'),
    ordna('Vilka tvåsiffriga tal går att bilda med siffrorna 1, 2 och 3, om varje siffra får användas högst en gång '
          'i talet? Ordna dem från minst till störst. Två brickor hör inte dit.', TVASIFFRIGA_123,
          extra=['11', '33'],
          forklaring='Gå igenom tiotalssiffrorna i tur och ordning: med 1 först 12 och 13, med 2 först 21 och 23, '
                     'med 3 först 31 och 32. I 11 och 33 används samma siffra två gånger.'),
    sant('Att välja två av tre kompisar till ett lag går på färre sätt än att välja vem av dem som blir etta och vem '
         'som blir tvåa i en tävling.', lag(3) < perm(3, 2),
         'Laget Ada och Bo är samma lag som Bo och Ada, men Ada etta och Bo tvåa är inte samma sak som Bo etta och '
         'Ada tvåa. Laget kan väljas på %s sätt och platserna på %s.' % (t(lag(3)), t(perm(3, 2)))),
], beskrivning='Räkna ordningar i en kö, tal som byggs av siffror och par där ordningen inte spelar roll.')


# =====================================================================
# Åk 6: Längd, massa och volym
# =====================================================================

LANGDER = ['0,8 m', '75 cm', '900 mm', '1,2 dm', '0,05 km']
MASSOR_PAR = [('1 kg', '1 000 g'), ('1 hg', '100 g'), ('1 ton', '1 000 kg'), ('500 g', '0,5 kg'), ('50 g', '0,5 hg')]
LANGST = ['3 km', '2 900 m', '35 000 cm', '310 000 mm']
assert matt('3,5 m', LANGD_MM) == 350 * LANGD_MM['cm'] and matt('2,4 km', LANGD_MM) == 2400 * LANGD_MM['m']

MA_AK6_MATT_1 = niva('ma-ak6-langd-massa-och-volym-1', 'Längd och massa', 'Längd, massa och volym', [
    skriv('Hur många centimeter är 3,5 meter?', t(matt('3,5 m', LANGD_MM) / LANGD_MM['cm']),
          '1 m = 100 cm. 3,5 · 100 = 350 cm.'),
    skriv('Hur många meter är 2,4 kilometer?', t(matt('2,4 km', LANGD_MM) / LANGD_MM['m']),
          '1 km = 1 000 m. 2,4 · 1 000 = 2 400 m.'),
    val('Hur många gram är 2,5 kg?', unika('2 500 g', '250 g', '25 g', '25 000 g'),
        enda(['2 500 g', '250 g', '25 g', '25 000 g'], lambda a: matt(a, MASSA_G) == matt('2,5 kg', MASSA_G)),
        '1 kg = 1 000 g, så 2,5 kg är 2,5 · 1 000 = 2 500 g.'),
    sant('3 ton är lika mycket som 300 kg.', matt('3 ton', MASSA_G) == matt('300 kg', MASSA_G),
         '1 ton = 1 000 kg, så 3 ton är 3 000 kg.'),
    ordna_tal('Ordna längderna från kortast till längst.', [(l, matt(l, LANGD_MM)) for l in LANGDER],
              'Skriv alla i millimeter: 1,2 dm = 120 mm, 75 cm = 750 mm, 0,8 m = 800 mm, 900 mm och '
              '0,05 km = 50 000 mm, som är 50 m.'),
    sant('1 meter är lika lång som 1 000 millimeter.', matt('1 m', LANGD_MM) == matt('1 000 mm', LANGD_MM),
         '1 m = 10 dm = 100 cm = 1 000 mm. Milli betyder tusendel.'),
    para('Para ihop massan med samma massa i en annan enhet.',
         parvis(MASSOR_PAR, lambda v: matt(v, MASSA_G), lambda h: matt(h, MASSA_G)),
         '1 kg = 10 hg = 1 000 g, och 1 ton = 1 000 kg. 500 g är ett halvt kilo, och 50 g är ett halvt hekto.'),
    val('Ungefär hur hög är en vanlig dörr i ett hus?', unika('2 m', '2 dm', '20 m', '2 cm'), '2 m',
        'En vuxen går genom en dörr utan att böja sig, och de flesta vuxna är kortare än 2 m. 2 dm är ungefär så '
        'långt som en penna, och 20 m är lika högt som ett hus med flera våningar.'),
    skriv('En påse mjöl väger 2 kg. Lisa använder 350 g till en kaka. Hur många gram mjöl är kvar?',
          t(matt('2 kg', MASSA_G) - 350), 'Gör om till samma enhet: 2 kg = 2 000 g. 2 000 − 350 = 1 650 g.'),
    val('Vilken längd är längst?', unika(*LANGST),
        enda(LANGST, lambda a: matt(a, LANGD_MM) == max(matt(x, LANGD_MM) for x in LANGST)),
        'Skriv alla i meter: 3 km = 3 000 m, 2 900 m, 35 000 cm = 350 m och 310 000 mm = 310 m.'),
], beskrivning='Byta mellan mm, cm, dm, m och km och mellan g, hg, kg och ton, och uppskatta rimliga längder.')

VOLYMER = ['3 dl', '25 cl', '0,4 l', '150 ml', '45 cl']
VOLYM_PAR = [('1 l', '10 dl'), ('1 dl', '100 ml'), ('1 cl', '10 ml'), ('1 cm³', '1 ml'), ('5 dl', '0,5 l')]
AKVARIUM = 40 * 20 * 25   # cm³
GLAS = matt('1,6 l', VOLYM_ML) / matt('2 dl', VOLYM_ML)
assert AKVARIUM == 20 * matt('1 l', VOLYM_ML) and GLAS == 8

MA_AK6_MATT_2 = niva('ma-ak6-langd-massa-och-volym-2', 'Volym och rymdmått', 'Längd, massa och volym', [
    skriv('Hur många deciliter är 2 liter?', t(matt('2 l', VOLYM_ML) / VOLYM_ML['dl']),
          '1 liter = 10 dl, så 2 liter är 2 · 10 = 20 dl.'),
    skriv('Hur många milliliter är 0,75 liter?', t(matt('0,75 l', VOLYM_ML)),
          '1 liter = 1 000 ml. 0,75 · 1 000 = 750 ml.'),
    val('Hur många centiliter är 1 liter?', unika('100 cl', '10 cl', '1 000 cl', '1 cl'),
        enda(['100 cl', '10 cl', '1 000 cl', '1 cl'], lambda a: matt(a, VOLYM_ML) == matt('1 l', VOLYM_ML)),
        'Centi betyder hundradel, så 1 cl är en hundradels liter. Då går det 100 cl på en liter.'),
    sant('1 kubikdecimeter, 1 dm³, rymmer lika mycket som 1 liter.', matt('1 dm³', VOLYM_ML) == matt('1 l', VOLYM_ML),
         'En kub med kanten 1 dm, alltså 10 cm, rymmer precis 1 liter. 10 · 10 · 10 = 1 000 cm³, och 1 liter är '
         '1 000 ml.'),
    skriv('En låda har formen av ett rätblock. Den är 5 cm lång, 4 cm bred och 3 cm hög. Hur många kubikcentimeter '
          'är lådans volym?', t(5 * 4 * 3),
          'Volymen är längden · bredden · höjden: 5 · 4 · 3 = 60 cm³. Det ryms 60 små kuber med kanten 1 cm i '
          'lådan.'),
    val('Ett akvarium har formen av ett rätblock. Det är 40 cm långt, 20 cm brett och 25 cm högt. Hur många liter '
        'rymmer det?', unika('20 liter', '200 liter', '2 liter', '2 000 liter'),
        enda(['20 liter', '200 liter', '2 liter', '2 000 liter'], lambda a: matt(a, VOLYM_ML) == AKVARIUM),
        'Volymen är 40 · 20 · 25 = 20 000 cm³. 1 liter är 1 000 cm³, så akvariet rymmer 20 000 : 1 000 = 20 '
        'liter.'),
    ordna_tal('Ordna volymerna från minst till störst.', [(v, matt(v, VOLYM_ML)) for v in VOLYMER],
              'Skriv alla i milliliter: 150 ml, 25 cl = 250 ml, 3 dl = 300 ml, 0,4 l = 400 ml och 45 cl = 450 ml.'),
    para('Para ihop volymen med samma volym i en annan enhet.',
         parvis(VOLYM_PAR, lambda v: matt(v, VOLYM_ML), lambda h: matt(h, VOLYM_ML)),
         '1 l = 10 dl = 100 cl = 1 000 ml. Alltså är 1 dl = 100 ml och 1 cl = 10 ml. 1 cm³ rymmer 1 ml, och 5 dl '
         'är en halv liter.'),
    skriv('En kub har kanten 3 cm. Hur många kubikcentimeter är kubens volym?', t(3 * 3 * 3),
          'Alla kanter i en kub är lika långa. Volymen är 3 · 3 · 3 = 27 cm³.'),
    val('Ett glas rymmer 2 dl. Hur många glas kan du fylla med 1,6 liter saft?', unika('8', '16', '80', '0,8'),
        enda(['8', '16', '80', '0,8'], lambda a: bv(a) == GLAS),
        'Gör om till samma enhet först: 1,6 liter = 16 dl. 16 : 2 = 8 glas. Den som delar 1,6 med 2 utan att byta '
        'enhet får 0,8.'),
], beskrivning='Byta mellan liter, dl, cl och ml, och räkna volymen av ett rätblock i cm³ och liter.')


# =====================================================================
# Åk 7: Fyrhörningar och area
# =====================================================================


def trapets(a, b, h):
    return F(a + b) * h / 2


AREA_PAR = [('Rektangel med sidorna 6 cm och 4 cm', 6 * 4),
            ('Triangel med basen 6 cm och höjden 4 cm', F(6 * 4, 2)),
            ('Parallellogram med basen 5 cm och höjden 4 cm', 5 * 4),
            ('Parallelltrapets med de parallella sidorna 3 och 5 cm, höjden 4 cm', trapets(3, 5, 4))]
assert len({v for _, v in AREA_PAR}) == len(AREA_PAR)
FIGURER = [('Parallellogram, b = 7 cm, h = 3 cm', 7 * 3), ('Triangel, b = 10 cm, h = 5 cm', F(10 * 5, 2)),
           ('Parallelltrapets, parallella sidor 4 och 8 cm, h = 3 cm', trapets(4, 8, 3)), ('Kvadrat med sidan 4 cm', 4 * 4)]
HOJD_TRAPETS = enda([F(x, 2) for x in range(1, 20)], lambda h: trapets(5, 9, h) == 21)
assert trapets(6, 10, 4) == 32 and HOJD_TRAPETS == 3 and trapets(5, 9, F(3, 2)) * 2 == 21

MA_AK7_AREA_1 = niva('ma-ak7-fyrhorningar-och-area-1', 'Parallellogram och parallelltrapets', 'Fyrhörningar och area', [
    val('Vilken formel ger arean av en parallellogram med basen b och höjden h?',
        ['A = b · h', 'A = b · h / 2', 'A = 2b + 2h', 'A = b + h'], 'A = b · h',
        'Skär av en triangel på ena sidan av parallellogrammen och flytta den till den andra. Då blir det en '
        'rektangel med samma bas och höjd, så A = b · h. Med / 2 blir det triangelns area.'),
    skriv('En parallellogram har basen 9 cm och höjden 4 cm. Hur många kvadratcentimeter är arean?', t(9 * 4),
          'A = b · h = 9 · 4 = 36 cm².'),
    val('En parallellogram har basen 8 cm och höjden 5 cm. Den sneda sidan är 6 cm. Hur stor är arean?',
        unika('40 cm²', '48 cm²', '30 cm²', '20 cm²'),
        enda(['40 cm²', '48 cm²', '30 cm²', '20 cm²'], lambda a: matt(a, AREA_MM2) == 8 * 5 * AREA_MM2['cm²']),
        'Arean är basen gånger höjden: 8 · 5 = 40 cm². Höjden mäts vinkelrätt mot basen, så den sneda sidan '
        'behövs inte. 48 får den som räknar med den sneda sidan, 8 · 6.'),
    skriv('En parallelltrapets har de parallella sidorna 6 cm och 10 cm och höjden 4 cm. Hur många '
          'kvadratcentimeter är arean?', t(trapets(6, 10, 4)),
          'A = (a + b) · h / 2 = (6 + 10) · 4 / 2 = 16 · 4 / 2 = 32 cm². Det är samma sak som medelvärdet av de '
          'parallella sidorna, 8 cm, gånger höjden.'),
    sant('En rektangel är en parallellogram.', True,
         'En parallellogram är en fyrhörning där båda paren av motstående sidor är parallella. Det gäller för '
         'varje rektangel, och för varje kvadrat också.'),
    sant('Två parallellogrammer med samma bas och samma höjd har alltid lika stor area.', True,
         'Arean är b · h. Hur sned parallellogrammen än är ändras inte arean, så länge basen och höjden är '
         'desamma.'),
    para('Para ihop figuren med dess area.', [(f, '%s cm²' % t(v)) for f, v in AREA_PAR],
         'Rektangeln: 6 · 4 = 24. Triangeln: 6 · 4 / 2 = 12. Parallellogrammen: 5 · 4 = 20. Parallelltrapetsen: '
         '(3 + 5) · 4 / 2 = 16.'),
    skriv('En parallellogram har arean 54 cm² och basen 9 cm. Hur många centimeter är höjden?', t(F(54, 9)),
          'A = b · h, så h = A : b = 54 : 9 = 6 cm.'),
    val('En parallelltrapets har de parallella sidorna 5 m och 9 m. Arean är 21 m². Hur hög är den?',
        unika('3 m', '6 m', '1,5 m', '2 m'),
        enda(['3 m', '6 m', '1,5 m', '2 m'], lambda a: matt(a, LANGD_MM) == HOJD_TRAPETS * LANGD_MM['m']),
        'A = (a + b) · h / 2, så 21 = 14 · h / 2 = 7 · h. Då är h = 21 : 7 = 3 m. 1,5 m får den som glömmer att '
        'dela med 2 i formeln.'),
    ordna_tal('Ordna figurerna efter area, minst först. b är basen och h höjden.', FIGURER,
              'Kvadraten: 4 · 4 = 16 cm². Parallelltrapetsen: (4 + 8) · 3 / 2 = 18 cm². Parallellogrammen: 7 · 3 = '
              '21 cm². Triangeln: 10 · 5 / 2 = 25 cm².'),
], beskrivning='Arean av parallellogram och parallelltrapets, och att räkna baklänges från arean till höjden.')

AREOR_PAR = [('1 m²', '100 dm²'), ('1 dm²', '100 cm²'), ('1 cm²', '100 mm²'), ('2,5 m²', '250 dm²'),
             ('0,5 dm²', '50 cm²')]
AREOR = ['0,2 m²', '1 500 cm²', '25 dm²', '30 000 mm²']
assert all((2 * l) * (2 * b) == 4 * (l * b) for l in range(1, 20) for b in range(1, 20))
assert 20 * 12 - 4 * 4 == 224 and 20 * 12 - (4 + 4) == 232
VAGG = F('5') * F('2.5') - F('1.5') * 1

MA_AK7_AREA_2 = niva('ma-ak7-fyrhorningar-och-area-2', 'Sammansatta figurer och areaenheter', 'Fyrhörningar och area', [
    sant('Om både längden och bredden i en rektangel fördubblas, blir arean fyra gånger så stor.', True,
         'Den nya arean är 2 · längden · 2 · bredden, alltså 4 · längden · bredden. Det ryms fyra av de gamla '
         'rektanglarna i den nya.'),
    val('Hur många kvadratdecimeter är 3 m²?', unika('300 dm²', '30 dm²', '3 000 dm²', '3 dm²'),
        enda(['300 dm²', '30 dm²', '3 000 dm²', '3 dm²'], lambda a: matt(a, AREA_MM2) == matt('3 m²', AREA_MM2)),
        '1 m = 10 dm, så 1 m² är 10 dm · 10 dm = 100 dm². 3 m² är 3 · 100 = 300 dm². 30 får den som räknar som '
        'med längder.'),
    skriv('Ett golv är 4 m långt och 3,5 m brett. Hur många kvadratmeter är golvets area?', t(4 * F('3.5')),
          'Arean är längden gånger bredden: 4 · 3,5 = 14 m².'),
    sant('1 m² är lika mycket som 100 cm².', matt('1 m²', AREA_MM2) == matt('100 cm²', AREA_MM2),
         '1 m = 100 cm, så 1 m² är 100 cm · 100 cm = 10 000 cm². En kvadratmeter rymmer 10 000 rutor som är 1 cm '
         'på varje sida.'),
    skriv('En figur består av en rektangel som är 8 cm lång och 3 cm bred, och en kvadrat med sidan 3 cm. Kvadraten '
          'står ovanpå rektangeln vid ena änden, så att figuren ser ut som ett L. Hur många kvadratcentimeter är hela '
          'figurens area?', t(8 * 3 + 3 * 3),
          'Dela upp figuren: rektangeln är 8 · 3 = 24 cm² och kvadraten 3 · 3 = 9 cm². Tillsammans 24 + 9 = 33 '
          'cm².'),
    val('En rektangulär tomt är 20 m lång och 12 m bred. Mitt på tomten finns en kvadratisk rabatt med sidan 4 m. '
        'Hur stor area har tomten utanför rabatten?', unika('224 m²', '240 m²', '256 m²', '232 m²'),
        enda(['224 m²', '240 m²', '256 m²', '232 m²'],
             lambda a: matt(a, AREA_MM2) == (20 * 12 - 4 * 4) * AREA_MM2['m²']),
        'Hela tomten är 20 · 12 = 240 m² och rabatten 4 · 4 = 16 m². Utanför rabatten: 240 − 16 = 224 m². 232 får '
        'den som drar bort 4 + 4 i stället för 4 · 4.'),
    skriv('En vägg är 5 m bred och 2,5 m hög. I väggen sitter ett fönster som är 1,5 m brett och 1 m högt. Hur många '
          'kvadratmeter av väggen ska målas, om fönstret inte ska målas?', t(VAGG),
          'Hela väggen är 5 · 2,5 = 12,5 m² och fönstret 1,5 · 1 = 1,5 m². Det som ska målas är 12,5 − 1,5 = %s m².'
          % t(VAGG)),
    para('Para ihop arean med samma area i en annan enhet.',
         parvis(AREOR_PAR, lambda v: matt(v, AREA_MM2), lambda h: matt(h, AREA_MM2)),
         'Varje steg i längd är 10 gånger, så varje steg i area är 10 · 10 = 100 gånger: 1 m² = 100 dm², 1 dm² = '
         '100 cm² och 1 cm² = 100 mm².'),
    val('En kvadrat har arean 1 m². Hur lång är sidan, i centimeter?', unika('100 cm', '10 cm', '1 000 cm', '10 000 cm'),
        enda(['100 cm', '10 cm', '1 000 cm', '10 000 cm'], lambda a: matt(a, LANGD_MM) ** 2 == matt('1 m²', AREA_MM2)),
        'Sidan i en kvadrat med arean 1 m² är 1 m, och 1 m = 100 cm. 10 000 är arean i cm², inte sidan.'),
    ordna_tal('Ordna areorna från minst till störst.', [(a, matt(a, AREA_MM2)) for a in AREOR],
              'Skriv alla i cm²: 30 000 mm² = 300 cm², 1 500 cm², 0,2 m² = 2 000 cm² och 25 dm² = 2 500 cm².'),
], beskrivning='Dela upp sammansatta figurer, dra bort det som inte ska räknas och byt mellan mm², cm², dm² och m².')


# =====================================================================
# Åk 7: Statistik och diagram
# =====================================================================


def varden(frekvenser):
    """Alla värden ur en frekvenstabell {värde: frekvens}, i storleksordning."""
    return sorted(v for v, f in frekvenser.items() for _ in range(f))


def medel(data):
    return F(sum(data), len(data))


def median(data):
    s = sorted(data)
    n = len(s)
    return F(s[n // 2]) if n % 2 else F(s[n // 2 - 1] + s[n // 2], 2)


def typvarde(data):
    flest = max(data.count(v) for v in data)
    typ = {v for v in data if data.count(v) == flest}
    assert len(typ) == 1, 'två typvärden'
    return typ.pop()


SYSKON = {0: 4, 1: 10, 2: 7, 3: 3}
SYSKON_TEXT = ('Eleverna i en klass svarade på hur många syskon de har: 4 elever har 0 syskon, 10 elever har 1 '
               'syskon, 7 elever har 2 syskon och 3 elever har 3 syskon.')
assert SYSKON_TEXT.count('elever har') == len(SYSKON)
REL_PAR = [('%d personer' % n, '%s %%' % t(F(n, 40) * 100)) for n in (2, 4, 10, 20, 30)]
KLASSER = [('Klass A: 6 av 20', F(6, 20)), ('Klass B: 5 av 25', F(5, 25)), ('Klass C: 12 av 30', F(12, 30)),
           ('Klass D: 7 av 28', F(7, 28))]

MA_AK7_STAT_1 = niva('ma-ak7-statistik-och-diagram-1', 'Frekvenstabeller och relativ frekvens', 'Statistik och diagram', [
    skriv(SYSKON_TEXT + ' Hur många elever svarade?', t(len(varden(SYSKON))),
          'Lägg ihop frekvenserna: 4 + 10 + 7 + 3 = %s elever.' % t(len(varden(SYSKON)))),
    val(SYSKON_TEXT + ' Vilket är typvärdet?', ['1 syskon', '10 syskon', '0 syskon', '3 syskon'],
        enda(['1 syskon', '10 syskon', '0 syskon', '3 syskon'], lambda a: int(a.split()[0]) == typvarde(varden(SYSKON))),
        'Typvärdet är det värde som flest har. Flest elever, 10 stycken, har 1 syskon, så typvärdet är 1 syskon. '
        'Talet 10 är frekvensen, alltså hur många som har värdet.'),
    sant('Om man lägger ihop alla relativa frekvenser i en frekvenstabell, utan att avrunda, blir summan 1, alltså '
         '100 %.', sum(F(f, len(varden(SYSKON))) for f in SYSKON.values()) == 1,
         'Varje relativ frekvens är frekvensen delad med antalet värden. Frekvenserna blir tillsammans antalet '
         'värden, så summan blir antalet delat med sig självt, alltså 1.'),
    skriv('I en klass på 25 elever har 5 elever glasögon. Hur stor är den relativa frekvensen för glasögon? Svara i '
          'procent.', t(F(5, 25) * 100),
          'Relativ frekvens är frekvensen delad med antalet: 5 : 25 = 0,2 = 20 %.'),
    para('40 personer svarade på en fråga. Para ihop frekvensen med den relativa frekvensen.', REL_PAR,
         'Dela med 40: 2 : 40 = 0,05 = 5 %, 4 : 40 = 10 %, 10 : 40 = 25 %, 20 : 40 = 50 % och 30 : 40 = 75 %.'),
    val('Vilket diagram passar bäst för att visa hur temperaturen ändras timme för timme under ett dygn?',
        ['Linjediagram', 'Cirkeldiagram'], 'Linjediagram',
        'I ett linjediagram binds punkterna ihop, så att man ser hur värdet stiger och sjunker över tiden. Ett '
        'cirkeldiagram visar hur en helhet delas upp, och temperaturerna är ingen helhet som delas.'),
    ordna_tal('Fyra klasser svarade på om de har husdjur. Ordna klasserna efter hur stor andel som har husdjur, minst '
              'först.', KLASSER,
              'Räkna ut andelen i varje klass: B 5 : 25 = 20 %, D 7 : 28 = 25 %, A 6 : 20 = 30 % och C 12 : 30 = '
              '40 %. Klass C har flest med husdjur, men det är andelen som jämförs.'),
    sant('Om två klasser har lika många elever med cykel, så har de alltid också samma relativa frekvens för cykel.',
         F(10, 20) == F(10, 25),
         'Den relativa frekvensen beror också på hur många elever klassen har. 10 av 20 är 50 %, men 10 av 25 är '
         '40 %.'),
    skriv(SYSKON_TEXT + ' Hur många elever har minst 2 syskon?', t(sum(f for v, f in SYSKON.items() if v >= 2)),
          'Minst 2 syskon betyder 2 eller fler: 7 + 3 = %s elever.' % t(sum(f for v, f in SYSKON.items() if v >= 2))),
    val('Den relativa frekvensen för ett svar är 0,15, och 60 personer svarade. Hur många gav det svaret?',
        unika(9, 15, 4, 6), enda(unika(9, 15, 4, 6), lambda a: int(a) == F('0.15') * 60),
        'Frekvensen är den relativa frekvensen gånger antalet: 0,15 · 60 = 9. 15 % av 60 är alltså 9.'),
], beskrivning='Läsa frekvenstabeller, räkna relativ frekvens i procent och välja ett diagram som passar.')

MAL = {0: 3, 1: 4, 2: 2, 3: 1}
MAL_TEXT = 'Ett lag gjorde 0 mål i 3 matcher, 1 mål i 4 matcher, 2 mål i 2 matcher och 3 mål i 1 match.'
MAL_VARDEN = varden(MAL)
assert medel(MAL_VARDEN) == F(11, 10) and median(MAL_VARDEN) == 1
TALEN = [2, 2, 4, 6, 16]
MATTEN = [('Typvärdet', typvarde(TALEN)), ('Medianen', median(TALEN)), ('Medelvärdet', medel(TALEN)),
          ('Variationsbredden', max(TALEN) - min(TALEN))]
assert all(median([a, b, c, d]) not in (a, b, c, d) for a, b, c, d in itertools.combinations(range(12), 4))

MA_AK7_STAT_2 = niva('ma-ak7-statistik-och-diagram-2', 'Lägesmått, spridning och cirkeldiagram', 'Statistik och diagram', [
    skriv(MAL_TEXT + ' Hur många mål gjorde laget i genomsnitt per match?', t(medel(MAL_VARDEN)),
          'Antalet mål är 0 · 3 + 1 · 4 + 2 · 2 + 3 · 1 = %s, och laget spelade 3 + 4 + 2 + 1 = %s matcher. '
          'Medelvärdet är 11 : 10 = %s mål per match.' % (t(sum(MAL_VARDEN)), t(len(MAL_VARDEN)), t(medel(MAL_VARDEN)))),
    val(MAL_TEXT + ' Vad är medianen?', unika('1 mål', '1,5 mål', '2 mål', '4 mål'),
        enda(['1 mål', '1,5 mål', '2 mål', '4 mål'], lambda a: bv(a.split()[0]) == median(MAL_VARDEN)),
        'Skriv målen i storleksordning, en gång per match: %s. Det är 10 värden, så medianen är medelvärdet av det '
        'femte och det sjätte, och båda är 1.' % ', '.join(map(str, MAL_VARDEN))),
    skriv('I en längdhoppstävling var det längsta hoppet 4,15 m och det kortaste 2,80 m. Vad är variationsbredden, i '
          'meter?', t(F('4.15') - F('2.80')),
          'Variationsbredden är det största värdet minus det minsta: 4,15 − 2,80 = %s m.' % t(F('4.15') - F('2.80'))),
    sant('Variationsbredden är skillnaden mellan det största och det minsta värdet.', True,
         'Variationsbredden är ett spridningsmått. Den visar hur långt det är mellan det minsta och det största '
         'värdet, men inte hur värdena ligger däremellan.'),
    skriv('30 elever svarade på vilken sport de tycker bäst om, och 12 av dem valde fotboll. Hur många grader blir '
          'fotbollens sektor i ett cirkeldiagram?', t(F(12, 30) * 360),
          'Andelen är 12 : 30 = 0,4. Hela cirkeln är 360°, så sektorn blir 0,4 · 360° = %s°.' % t(F(12, 30) * 360)),
    val('I ett cirkeldiagram är en sektor 45°. Hur stor andel av helheten visar den?',
        unika('12,5 %', '45 %', '25 %', '4,5 %'),
        enda(['12,5 %', '45 %', '25 %', '4,5 %'], lambda a: bv(a.split()[0]) == F(45, 360) * 100),
        'Hela cirkeln är 360°. 45 : 360 = 0,125, alltså 12,5 %. En sektor på 45° är en åttondel av cirkeln.'),
    para('Para ihop måttet med vad det är.',
         [('Medelvärde', 'Summan av värdena delad med antalet värden'),
          ('Median', 'Värdet i mitten när värdena står i storleksordning'),
          ('Typvärde', 'Det värde som finns flest gånger'),
          ('Variationsbredd', 'Det största värdet minus det minsta')],
         'Medelvärde, median och typvärde är lägesmått: de säger var värdena ligger. Variationsbredden är ett '
         'spridningsmått: den säger hur utspridda de är. Med ett jämnt antal värden är medianen medelvärdet av de '
         'två i mitten.'),
    ordna_tal('Talen är 2, 2, 4, 6 och 16. Ordna måtten från minst till störst.', MATTEN,
              'Typvärdet är %s och medianen %s. Medelvärdet är 30 : 5 = %s, och variationsbredden 16 − 2 = %s.'
              % tuple(t(v) for _, v in MATTEN)),
    val('I ett cirkeldiagram över 40 svar är sektorn för svaret ”cykel” 90°. Hur många svarade cykel?',
        unika(10, 90, 25, 4), enda(unika(10, 90, 25, 4), lambda a: int(a) == F(90, 360) * 40),
        '90° är en fjärdedel av 360°. En fjärdedel av 40 är 10.'),
    sant('Medianen av fyra olika tal är alltid ett av de fyra talen.', False,
         'Med fyra tal är medianen medelvärdet av de två mittersta. För 1, 2, 4 och 5 är medianen (2 + 4) : 2 = %s, '
         'och %s är inte ett av talen.' % (t(median([1, 2, 4, 5])), t(median([1, 2, 4, 5])))),
], beskrivning='Medelvärde och median ur en frekvenstabell, variationsbredd, och att räkna mellan andelar och grader '
               'i ett cirkeldiagram.')


# =====================================================================
# Åk 7: Koordinatsystem och grafer
# =====================================================================

KVADRANTER = ['Första kvadranten', 'Andra kvadranten', 'Tredje kvadranten', 'Fjärde kvadranten']


def kvadrant(p):
    """Kvadranten som text, räknad moturs från den övre högra. En punkt på en axel ligger i ingen."""
    x, y = p
    assert x != 0 and y != 0, p
    return KVADRANTER[(0 if y > 0 else 3) if x > 0 else (1 if y > 0 else 2)]


assert [kvadrant(p) for p in ((1, 1), (-1, 1), (-1, -1), (1, -1))] == KVADRANTER
TREDJE = ['(−2, −5)', '(2, −5)', '(−2, 5)', '(2, 5)']
SPEGEL = ['(3, −5)', '(−3, 5)', '(−3, −5)', '(5, 3)']
KVADRANT_PAR = [('(2, 7)', 'Första kvadranten'), ('(−1, 4)', 'Andra kvadranten'), ('(−6, −2)', 'Tredje kvadranten'),
                ('(5, −3)', 'Fjärde kvadranten')]
HOJDER = ['(4, −3)', '(−2, 1)', '(0, −6)', '(3, 0)', '(−5, 5)']

MA_AK7_KOORD_1 = niva('ma-ak7-koordinatsystem-och-grafer-1', 'Fyra kvadranter', 'Koordinatsystem och grafer', [
    val('I vilken kvadrant ligger punkten (−3, 2)?', KVADRANTER, kvadrant(punkt('(−3, 2)')),
        'x är negativ och y positiv: punkten ligger till vänster om y-axeln och ovanför x-axeln. Kvadranterna '
        'räknas moturs från den övre högra, så det är andra kvadranten.'),
    skriv('Punkten (4, −1) flyttas 6 steg åt vänster. Vilken x-koordinat får den?',
          x_svar(4 - 6) + ['(%s, -1)' % t(4 - 6), '(%s,-1)' % t(4 - 6)],
          '4 − 6 = −2. Att flytta åt vänster gör x-koordinaten mindre, och y-koordinaten ändras inte: den nya '
          'punkten är (−2, −1).'),
    val('Vilken punkt ligger i tredje kvadranten?', TREDJE,
        enda(TREDJE, lambda a: kvadrant(punkt(a)) == 'Tredje kvadranten'),
        'I tredje kvadranten, den nedre vänstra, är både x och y negativa. Det gäller bara (−2, −5).'),
    sant('Punkten (0, −4) ligger på y-axeln.', punkt('(0, −4)')[0] == 0,
         'Alla punkter på y-axeln har x-koordinaten 0. Punkten (0, −4) ligger 4 steg under origo.'),
    skriv('Hur många steg är det mellan punkterna (−3, 2) och (5, 2)?', t(5 - (-3)),
          'Punkterna har samma y-koordinat, så avståndet är skillnaden mellan x-koordinaterna: 5 − (−3) = 5 + 3 = '
          '8.'),
    val('Punkten (3, 5) speglas i x-axeln. Vilken punkt får du?', SPEGEL,
        enda(SPEGEL, lambda a: punkt(a) == (3, -5)),
        'När en punkt speglas i x-axeln byter y-koordinaten tecken, och x-koordinaten är kvar. (3, 5) blir (3, −5), '
        'lika långt under axeln som den var ovanför.'),
    para('Para ihop punkten med kvadranten den ligger i.',
         parvis(KVADRANT_PAR, lambda v: kvadrant(punkt(v)), lambda h: h),
         'Första kvadranten har x och y positiva, andra x negativ och y positiv, tredje båda negativa och fjärde '
         'x positiv och y negativ.'),
    ordna_tal('Ordna punkterna från den som ligger lägst till den som ligger högst.',
              [(p, punkt(p)[1]) for p in HOJDER],
              'Det är y-koordinaten som säger hur högt en punkt ligger: −6, −3, 0, 1 och 5.'),
    skriv('En rektangel har hörnen (−2, 1), (3, 1), (3, 4) och (−2, 4). Hur stor är rektangelns area, om varje ruta i '
          'koordinatsystemet är 1 areaenhet?', t((3 - (-2)) * (4 - 1)),
          'Sidan längs x-axeln är 3 − (−2) = 5 och sidan längs y-axeln 4 − 1 = 3. Arean är 5 · 3 = 15 areaenheter.'),
    sant('Alla punkter i fjärde kvadranten har en negativ y-koordinat.',
         all(kvadrant((x, y)) != 'Fjärde kvadranten' or y < 0 for x in range(-5, 6) for y in range(-5, 6) if x and y),
         'Fjärde kvadranten är den nedre högra. Där är x positiv och y negativ.'),
], beskrivning='Punkter med negativa koordinater: kvadranterna, avstånd längs en linje, att flytta och spegla '
               'punkter.')

PUNKTER_Q2 = ['(3, 7)', '(3, 6)', '(7, 3)', '(2, 4)']
FORMLER_TABELL = ['y = 2x + 3', 'y = 3x + 2', 'y = x + 3', 'y = 5x']
FORMLER_LINJE = ['y = 3x + 4', 'y = 4x + 3', 'y = 3x', 'y = x + 7']
X_VARDEN = [1, 4, -2, 3]
SKARNING = formel('y = 2x − 6')(0)

MA_AK7_KOORD_2 = niva('ma-ak7-koordinatsystem-och-grafer-2', 'Värdetabeller och grafer', 'Koordinatsystem och grafer', [
    skriv('Sambandet mellan x och y är y = 3x − 2. Vad är y när x = 4?', x_svar(formel('y = 3x − 2')(4), 'y'),
          'Sätt in x = 4: y = 3 · 4 − 2 = 12 − 2 = %s.' % t(formel('y = 3x − 2')(4))),
    val('Vilken punkt ligger på grafen till y = 2x + 1?', PUNKTER_Q2,
        enda(PUNKTER_Q2, lambda a: formel('y = 2x + 1')(punkt(a)[0]) == punkt(a)[1]),
        'Sätt in x-koordinaten och se om y blir rätt: 2 · 3 + 1 = 7, så (3, 7) ligger på grafen. För (7, 3) blir '
        'y = 2 · 7 + 1 = 15, inte 3.'),
    skriv('Sambandet mellan x och y är y = 5 − x. Vad är y när x = 8?', x_svar(formel('y = 5 − x')(8), 'y'),
          'y = 5 − 8 = %s. När x är större än 5 blir y negativ.' % m(formel('y = 5 − x')(8))),
    sant('Grafen till y = 4x går genom origo.', formel('y = 4x')(0) == 0,
         'När x = 0 är y = 4 · 0 = 0. Grafen går alltså genom punkten (0, 0), origo.'),
    val('Vilken formel passar värdetabellen? När x = 0 är y = 3, när x = 1 är y = 5 och när x = 2 är y = 7.',
        FORMLER_TABELL, enda(FORMLER_TABELL, lambda a: passar(formel(a), [(0, 3), (1, 5), (2, 7)])),
        'y ökar med 2 varje gång x ökar med 1, och när x = 0 är y = 3. Alltså y = 2x + 3. Formeln y = x + 3 '
        'stämmer bara när x = 0.'),
    skriv('I vilken punkt skär grafen till y = 2x − 6 y-axeln? Svara med y-koordinaten.',
          x_svar(SKARNING, 'y') + ['(0, %s)' % t(SKARNING), '(0,%s)' % t(SKARNING)],
          'Grafen skär y-axeln där x = 0. Då är y = 2 · 0 − 6 = −6, så punkten är (0, −6).'),
    para('Para ihop x-värdet med y-värdet för sambandet y = 3x + 1.',
         [('x = %s' % m(x), 'y = %s' % m(formel('y = 3x + 1')(x))) for x in (0, 1, 2, -1)],
         'Sätt in x i formeln: 3 · 0 + 1 = 1, 3 · 1 + 1 = 4, 3 · 2 + 1 = 7 och 3 · (−1) + 1 = −2.'),
    ordna_tal('Sambandet är y = 10 − 2x. Ordna x-värdena efter hur stort y blir, minst först.',
              [('x = %s' % m(x), formel('y = 10 − 2x')(x)) for x in X_VARDEN],
              'Räkna ut y: x = 4 ger 10 − 8 = 2, x = 3 ger 4, x = 1 ger 8 och x = −2 ger 10 + 4 = 14. Ju större x, '
              'desto mindre y.'),
    val('Ett samband har en rät linje som graf. Linjen går genom punkten (0, 4), och y ökar med 3 varje gång x ökar '
        'med 1. Vilken formel har sambandet?', FORMLER_LINJE,
        enda(FORMLER_LINJE, lambda a: passar(formel(a), [(0, 4), (1, 7), (2, 10)])),
        'Talet framför x är hur mycket y ökar per steg, 3, och talet som läggs till är y när x = 0, alltså 4: '
        'y = 3x + 4.'),
    sant('Punkten (−1, 2) ligger på grafen till y = 2x + 3.', formel('y = 2x + 3')(-1) == 2,
         'Sätt in x = −1: y = 2 · (−1) + 3 = −2 + 3 = %s. Punkten på grafen är (−1, %s), inte (−1, 2).'
         % (t(formel('y = 2x + 3')(-1)), t(formel('y = 2x + 3')(-1)))),
], beskrivning='Räkna ut y ur en formel, se om en punkt ligger på en graf och hitta formeln till en värdetabell.')


# ---------------------------------------------------------------- tillägg

TILLAGG = [
    bana('Matematik', 'ak6', [MA_AK6_MONSTER_1, MA_AK6_MONSTER_2, MA_AK6_KOMB_1, MA_AK6_KOMB_2,
                              MA_AK6_MATT_1, MA_AK6_MATT_2]),
    bana('Matematik', 'ak7', [MA_AK7_AREA_1, MA_AK7_AREA_2, MA_AK7_STAT_1, MA_AK7_STAT_2,
                              MA_AK7_KOORD_1, MA_AK7_KOORD_2]),
]
