# -*- coding: utf-8 -*-
"""Matematik åk 1–3. Talen upp till 1000 med siffror och ord, plus och minus, de första tabellerna, att dela lika, klockan, veckan och året, pengar, längd och former, i korta vardagsnära frågor som en sjuåring kan läsa själv."""
import re

from grund import bana, niva, val, skriv, ordna, sant, para, tal


def _stigande(par):
    """Brickorna i ordning efter sitt värde, räknat här och inte för
    hand. Två brickor med samma värde hade gett två rätta ordningar,
    och spelaren godtar bara en."""
    varden = [v for _, v in par]
    assert len(set(varden)) == len(varden), 'två brickor har samma värde: %r' % (par,)
    return [t for t, _ in sorted(par, key=lambda p: p[1])]


def _tal_stigande(tallista):
    assert len(set(tallista)) == len(tallista), 'samma tal två gånger: %r' % (tallista,)
    return [tal(x) for x in sorted(tallista)]


_ENTAL = ['noll', 'ett', 'två', 'tre', 'fyra', 'fem', 'sex', 'sju', 'åtta', 'nio', 'tio', 'elva', 'tolv',
          'tretton', 'fjorton', 'femton', 'sexton', 'sjutton', 'arton', 'nitton']
_TIOTAL = ['', '', 'tjugo', 'trettio', 'fyrtio', 'femtio', 'sextio', 'sjuttio', 'åttio', 'nittio']


def _svar(n, enhet=None):
    """Talet med siffror och, upp till 100, med bokstäver. En sjuåring
    som skriver "tre" har svarat rätt, och rättningen jämför bara
    siffror som tal.

    Med enhet står talet i ord också med ordet efter: "åtta äpplen".
    "8 äpplen" godtar rättningen själv, för ett tal får ha en enhet
    efter sig, men ett tal i ord jämförs bara som text."""
    svar = [tal(n)]
    if n < 20:
        svar.append(_ENTAL[n])
    elif n < 100:
        svar.append(_TIOTAL[n // 10] + (_ENTAL[n % 10] if n % 10 else ''))
        if n % 10 == 1:
            svar.append(_TIOTAL[n // 10] + 'en')
    elif n == 100:
        svar += ['hundra', 'etthundra', 'ett hundra']
    if n == 1:
        svar.append('en')
    if n == 18:
        svar.append('aderton')
    if enhet:
        svar += [s + ' ' + enhet for s in svar[1:]]
    return svar


def _ord(n):
    """Talet med bokstäver, 0–99: 14 → 'fjorton', 20 → 'tjugo', 31 → 'trettioett'."""
    if n < 20:
        return _ENTAL[n]
    return _TIOTAL[n // 10] + (_ENTAL[n % 10] if n % 10 else '')


# Orden tillbaka till talen, för att pröva en fråga som visar talet i ord.
_VARDE = {_ord(n): n for n in range(100)}


def _lista(delar):
    """['a', 'b', 'c'] → 'a, b och c'."""
    delar = list(delar)
    return delar[0] if len(delar) == 1 else ', '.join(delar[:-1]) + ' och ' + delar[-1]


def _entydiga(par, vanster, hoger=int):
    """Paren i en matchning, prövade: varje vänstersida är lika mycket som
    sin egen högersida och inte som någon annans. Hade två par gått att
    byta hade det funnits två rätta svar, och rättningen godtar bara det
    som står i paret."""
    for i, (v, _) in enumerate(par):
        for j, (_, h) in enumerate(par):
            assert (vanster(v) == hoger(h)) == (i == j), 'matchningen är inte entydig: %r' % (par,)
    return par


def _tiotal_ental(t):
    """'1 tiotal och 6 ental' → 16, '2 tiotal' → 20. Läser texten som
    barnet ser, i stället för att lita på att den skrevs rätt."""
    varde = {'tiotal': 10, 'ental': 1}
    return sum(int(antal) * varde[sort] for antal, sort in (d.split() for d in t.split(' och ')))


def _produkt(t):
    """'3 · 4' → 12."""
    a, b = t.split(' · ')
    return int(a) * int(b)


_VECKODAGAR = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag']
_MANADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti',
            'september', 'oktober', 'november', 'december']


def _dag(dag, steg):
    """Veckodagen steg dagar efter dag, eller före med minus. Efter söndag
    börjar veckan om: _dag('fredag', 3) → 'måndag'."""
    return _VECKODAGAR[(_VECKODAGAR.index(dag) + steg) % len(_VECKODAGAR)]



# ---------------------------------------------------------------------
# Den andra nivån i varje område som bara hade en (2026-09-29). Ett
# område med två nivåer får ett Mästarprov, och en väg med en nivå per
# område tar slut fort. Den andra nivån är något svårare än den första
# och står direkt efter den i banan.
# ---------------------------------------------------------------------

def _raknat(uttryck):
    """'50 − 17' → 33, '16 / 4' → 4, räknat exakt. Brickorna och
    alternativen räknas ur sin egen text, så att texten barnet ser och
    värdet som sorterar dem aldrig kan skilja sig."""
    from fractions import Fraction
    kod = re.sub(r'(\d+)', r'_B(\1)', uttryck.replace('·', '*').replace('−', '-'))
    return eval(kod, {'_B': Fraction})  # noqa: S307 — bara våra egna uttryck


def _enda(alternativ, prov):
    """Det enda alternativet som klarar provet. Klarar noll eller flera
    det är frågan fel skriven."""
    traffar = [a for a in alternativ if prov(a)]
    assert len(traffar) == 1, 'väntade ett rätt alternativ i %r, fick %r' % (alternativ, traffar)
    return traffar[0]


def _monster(delar, antal):
    """De första antal stegen i ett mönster som upprepas, och steget efter."""
    visat = [delar[i % len(delar)] for i in range(antal)]
    return visat, delar[antal % len(delar)]


def _avrunda(n, steg):
    """Avrundning till närmaste tiotal eller hundratal, fem uppåt som i skolan."""
    return (n + steg // 2) // steg * steg


def _klocka(minuter):
    """Minuter efter midnatt som klockslaget skrivs i åk 1–3: 490 → '8:10'."""
    h, m = divmod(minuter % (24 * 60), 60)
    return '%d:%02d' % (h, m)


# Åk 1, geometri.
_FARGER, _NASTA_FARG = _monster(['röd', 'blå'], 5)
_FORMER, _NASTA_FORM = _monster(['cirkel', 'cirkel', 'kvadrat'], 6)
assert _NASTA_FARG == 'blå' and _NASTA_FORM == 'cirkel'
# Bokstäverna: bara A är lika på båda sidor om ett lodrätt veck.
_SYMMETRISKA = {'A', 'H', 'M', 'O', 'T', 'U', 'V', 'W', 'X', 'Y'}

_AK1_GEOMETRI_2 = niva('ma-ak1-geometri-2', 'Mönster och former', 'Geometri', [
    skriv('Två trianglar ligger bredvid varandra. Hur många hörn har de tillsammans?', _svar(3 + 3, 'hörn'),
          'Varje triangel har tre hörn. 3 + 3 = 6.'),
    val('Mönstret är %s. Vilken färg kommer sedan?' % ', '.join(_FARGER),
        ['blå', 'röd', 'gul'], _NASTA_FARG,
        'Färgerna byter hela tiden: röd, blå, röd, blå. Efter röd kommer blå.'),
    val('Mönstret är %s. Vad kommer sedan?' % ', '.join(_FORMER),
        ['cirkel', 'kvadrat', 'triangel'], _NASTA_FORM,
        'Mönstret är cirkel, cirkel, kvadrat, och sedan börjar det om. Efter kvadraten kommer en cirkel.'),
    ordna('Fortsätt mönstret 2, 4, 6. Lägg de tre tal som kommer sedan, i ordning. En bricka blir över.',
          [tal(6 + 2 * k) for k in (1, 2, 3)], extra=['9'],
          forklaring='Talen ökar med 2 varje gång: 6 + 2 = 8, 8 + 2 = 10 och 10 + 2 = 12. 9 hör inte till mönstret.'),
    val('Vilken sak är rund som en cirkel?', ['en tallrik', 'en dörr', 'en bok'], 'en tallrik',
        'En tallrik är rund. En dörr och en bok har raka sidor och fyra hörn, som en rektangel.'),
    val('Kims snöre är 8 klossar långt. Elis snöre är 5 klossar långt. Hur många klossar längre är Kims snöre?',
        [3, 13, 5], 8 - 5,
        'Jämför snörena: 8 − 5 = 3. Kims snöre är 3 klossar längre.'),
    val('Vilken bokstav kan du vika på mitten, uppifrån och ned, så att båda halvorna blir lika?',
        ['A', 'F', 'G'], _enda(['A', 'F', 'G'], lambda b: b in _SYMMETRISKA),
        'Viker du A på mitten hamnar vänster sida precis på höger sida. F och G ser olika ut på de två sidorna.'),
    skriv('Tre kvadrater ligger en bit ifrån varandra. Hur många hörn har de tillsammans?', _svar(4 + 4 + 4, 'hörn'),
          'Varje kvadrat har fyra hörn. 4 + 4 + 4 = 12.'),
], beskrivning='Mönster med färger, former och tal, att jämföra längder och former i vardagen.')


# Åk 2, taluppfattning.
_JAMNA = [7, 12, 15, 9]
_NARA_50 = [47, 55, 41, 60]
assert sorted(abs(x - 50) for x in _NARA_50)[0] < sorted(abs(x - 50) for x in _NARA_50)[1]

_AK2_TAL_2 = niva('ma-ak2-tal-2', 'Jämna tal och talföljder', 'Taluppfattning', [
    val('Vilket tal är jämnt?', _JAMNA, _enda(_JAMNA, lambda x: x % 2 == 0),
        'Ett jämnt tal går att dela i två lika stora högar. Jämna tal slutar på 0, 2, 4, 6 eller 8, som 12.'),
    sant('Talet 35 är udda.', 35 % 2 == 1,
         '35 slutar på 5. Tal som slutar på 1, 3, 5, 7 eller 9 är udda.'),
    skriv('Räkna i femsteg: 15, 20, 25. Vilket tal kommer sedan?', _svar(25 + 5),
          'Talen ökar med 5 varje gång. 25 + 5 = 30.'),
    skriv('Räkna baklänges i tiosteg: 90, 80, 70. Vilket tal kommer sedan?', _svar(70 - 10),
          'Talen minskar med 10 varje gång. 70 − 10 = 60.'),
    val('Vilket tal ligger närmast 50?', _NARA_50, min(_NARA_50, key=lambda x: abs(x - 50)),
        '47 ligger 3 steg från 50. 55 ligger 5 steg bort, 41 ligger 9 steg bort och 60 ligger 10 steg bort.'),
    val('Vilket tiotal ligger 68 närmast?', [60, 70, 80], _avrunda(68, 10),
        'Från 68 är det 2 steg till 70 men 8 steg till 60. Därför ligger 68 närmast 70.'),
    ordna('Ordna talen från minst till störst.', _tal_stigande([73, 37, 70, 7]),
          forklaring='7 har inga tiotal. 37 har 3 tiotal, och 70 och 73 har 7 tiotal. 73 har fler ental än 70.'),
    skriv('Hur många tiotal är 90?', _svar(90 // 10, 'tiotal'),
          '90 är 10 + 10 + 10 + 10 + 10 + 10 + 10 + 10 + 10. Det är 9 tiotal.'),
], beskrivning='Jämna och udda tal, att räkna i steg framåt och bakåt, och vilket tal som ligger närmast.')


# Åk 2, addition och subtraktion.
_BUSS = 48 - 13 + 6
_AK2_ADDITION_2 = niva('ma-ak2-addition-2', 'Plus och minus i flera steg', 'Addition och subtraktion', [
    skriv('Vad är 27 + 15?', _svar(27 + 15),
          'Ta tiotalen först: 20 + 10 = 30. Sedan entalen: 7 + 5 = 12. 30 + 12 = 42.'),
    val('Vad är 63 − 27?', [36, 44, 34, 46], 63 - 27,
        'Ta först bort 20: 63 − 20 = 43. Ta sedan bort 7: 43 − 7 = 36. '
        '44 får den som tar 7 − 3 i stället för 3 − 7.'),
    skriv('Vad är 25 + 25 + 25?', _svar(25 + 25 + 25),
          '25 + 25 = 50, och 50 + 25 = 75.'),
    val('Vad är 100 − 45?', [55, 65, 45], 100 - 45,
        'Räkna upp från 45: 5 steg till 50 och sedan 50 steg till 100. 5 + 50 = 55.'),
    skriv('Sam har 34 kort. Han får 19 kort till. Hur många kort har han nu?', _svar(34 + 19, 'kort'),
          '34 + 20 = 54, men det var 19, alltså ett mindre: 54 − 1 = 53.'),
    val('? − 20 = 45. Vilket tal fattas?', [65, 25, 55], 45 + 20,
        'Talet minus 20 blir 45. Då är talet 20 mer än 45: 45 + 20 = 65.'),
    skriv('I en buss sitter 48 personer. 13 kliver av och 6 kliver på. Hur många sitter i bussen nu?',
          _svar(_BUSS, 'personer'),
          'Först kliver 13 av: 48 − 13 = 35. Sedan kliver 6 på: 35 + 6 = 41.'),
    ordna('Ordna så att svaren går från minst till störst.',
          _stigande([(u, _raknat(u)) for u in ('50 − 17', '29 + 9', '70 − 45', '16 + 15')]),
          forklaring='%s.' % _lista('%s = %s' % (u, _raknat(u)) for u in
                                   sorted(('50 − 17', '29 + 9', '70 − 45', '16 + 15'), key=_raknat))),
], beskrivning='Plus och minus över tiotalsgränsen och i flera steg, med svar upp till 100.')


# Åk 2, mätning.
_AK2_MATNING_2 = niva('ma-ak2-matning-2', 'Längd, vikt och volym', 'Mätning', [
    val('Vilken enhet passar bäst för att mäta hur mycket vatten det finns i en hink?',
        ['liter', 'meter', 'kilogram'], 'liter',
        'Liter mäter hur mycket något rymmer. Meter mäter längd och kilogram mäter vikt.'),
    val('Vilket väger ungefär 1 kilogram?', ['ett paket socker', 'en fjäder', 'en cykel'], 'ett paket socker',
        'Ett vanligt paket socker väger 1 kilogram. En fjäder väger nästan ingenting, och en cykel väger mycket mer.'),
    skriv('Hur många centimeter är 2 meter?', tal(2 * 100),
          '1 meter är 100 centimeter. 2 meter är 100 + 100 = 200 centimeter.'),
    skriv('En penna är 14 cm lång. Ett sudd är 5 cm långt. Hur många centimeter längre är pennan?',
          _svar(14 - 5, 'centimeter'),
          'Jämför längderna: 14 − 5 = 9.'),
    skriv('Hur många deciliter är 1 liter?', _svar(10, 'deciliter'),
          'En liter är 10 deciliter. En deciliter är alltså en tiondel av en liter.'),
    val('Vilket är mest?', ['1 liter', '3 deciliter', '9 deciliter'], '1 liter',
        '1 liter är 10 deciliter. Det är mer än både 3 och 9 deciliter.'),
    val('Mira har 20 kronor. Hon köper två glassar som kostar 8 kronor var. Hur många kronor har hon kvar?',
        [4, 12, 16], 20 - 2 * 8,
        'Två glassar kostar 8 + 8 = 16 kronor. 20 − 16 = 4.'),
    ordna('Ordna djuren från lättast till tyngst.',
          _stigande([('en katt', 4), ('en mus', 0.02), ('en elefant', 4000), ('en häst', 500)]),
          forklaring='En mus väger nästan ingenting, en katt några kilo, en häst flera hundra kilo och en elefant '
                     'flera tusen kilo.'),
], beskrivning='Att välja enhet och jämföra längd, vikt och volym, med meter, kilogram, liter och deciliter.')


# Åk 3, taluppfattning.
_AK3_TAL_2 = niva('ma-ak3-tal-2', 'Avrunda och jämföra', 'Taluppfattning', [
    val('Avrunda 347 till närmaste tiotal.', [350, 340, 300], _avrunda(347, 10),
        '347 ligger mellan 340 och 350. Entalssiffran är 7, alltså 5 eller mer, så man avrundar uppåt till 350.'),
    val('Avrunda 682 till närmaste hundratal.', [700, 600, 680], _avrunda(682, 100),
        '682 ligger mellan 600 och 700. Tiotalssiffran är 8, så 682 ligger närmare 700.'),
    skriv('Vilket tal är 1 mindre än 700?', tal(700 - 1),
          'Talet före 700 är 699. Räkna baklänges: 700, 699.'),
    skriv('Hur många tiotal behöver du för att få 250?', _svar(250 // 10, 'tiotal'),
          '100 är 10 tiotal, så 200 är 20 tiotal. 50 är 5 tiotal till. 20 + 5 = 25.'),
    val('Vilket tal är störst?', [909, 990, 899, 919], max(909, 990, 899, 919),
        'Jämför hundratalen först: tre av talen har 9 hundratal. Jämför sedan tiotalen: 990 har 9 tiotal.'),
    sant('504 är större än 450.', 504 > 450,
         '504 har 5 hundratal och 450 har bara 4. Då är 504 störst, hur många tiotal 450 än har.'),
    ordna('Ordna talen från minst till störst.', _tal_stigande([608, 680, 86, 806]),
          forklaring='86 har inga hundratal. 608 och 680 har 6 hundratal, och 680 har fler tiotal. 806 har 8 hundratal.'),
    skriv('Vilket tal är 5 hundratal, 12 tiotal och 3 ental?', tal(5 * 100 + 12 * 10 + 3),
          '5 hundratal är 500 och 12 tiotal är 120. 500 + 120 + 3 = 623.'),
], beskrivning='Avrunda till tiotal och hundratal och jämföra tal upp till 1000.')


# Åk 3, division.
_SAMMA_SOM_20_5 = ['12 / 3', '20 / 4', '15 / 5']
_AK3_DIVISION_2 = niva('ma-ak3-division-2', 'Division och multiplikation', 'Division', [
    val('Vilken multiplikation hjälper dig att räkna ut 24 / 4?', ['4 · 6 = 24', '4 + 20 = 24', '24 − 4 = 20'],
        _enda(['4 · 6 = 24', '4 + 20 = 24', '24 − 4 = 20'], lambda a: a.startswith('4 ·')),
        'Division är multiplikation baklänges. 4 · 6 = 24, så 24 / 4 = 6.'),
    skriv('Vad är 28 / 4?', _svar(28 // 4),
          '4 · 7 = 28. Därför är 28 / 4 = 7.'),
    skriv('Vad är 40 / 10?', _svar(40 // 10),
          '10 · 4 = 40. Därför är 40 / 10 = 4.'),
    val('18 / ? = 3. Vilket tal fattas?', [6, 15, 21, 5], 18 // 3,
        '18 delat med något ska bli 3. 3 · 6 = 18, så det saknade talet är 6.'),
    skriv('En kaka delas i 24 bitar. 6 barn delar lika. Hur många bitar får varje barn?', _svar(24 // 6, 'bitar'),
          '6 · 4 = 24. Varje barn får 4 bitar.'),
    val('Vilken division ger samma svar som 20 / 5?', _SAMMA_SOM_20_5,
        _enda(_SAMMA_SOM_20_5, lambda u: _raknat(u) == 20 // 5),
        '20 / 5 = 4 och 12 / 3 = 4. Men 20 / 4 = 5 och 15 / 5 = 3.'),
    skriv('Vad är en tredjedel av 21?', _svar(21 // 3),
          'En tredjedel betyder att man delar i tre lika delar. 21 / 3 = 7, för 3 · 7 = 21.'),
    ordna('Ordna så att svaren går från minst till störst.',
          _stigande([(u, _raknat(u)) for u in ('30 / 3', '16 / 4', '27 / 3', '14 / 2')]),
          forklaring='%s.' % _lista('%s = %s' % (u, _raknat(u)) for u in
                                   sorted(('30 / 3', '16 / 4', '27 / 3', '14 / 2'), key=_raknat))),
], beskrivning='Division som multiplikation baklänges, och att dela i tre och fyra lika delar.')


# Åk 3, tid.
_LEO_FRAMME = _klocka(7 * 60 + 50 + 20)
assert _LEO_FRAMME == '8:10'
_AK3_TID_2 = niva('ma-ak3-tid-2', 'Räkna med tid', 'Tid', [
    skriv('Hur många minuter är en halvtimme?', _svar(60 // 2, 'minuter'),
          'En timme är 60 minuter. Hälften av 60 är 30.'),
    val('Klockan är 8:45. Vad är klockan om en kvart?', ['9:00', '9:15', '8:30'], _klocka(8 * 60 + 45 + 15),
        'En kvart är 15 minuter. 8:45 plus 15 minuter blir precis 9:00.'),
    skriv('Lektionen börjar 10:00 och slutar 10:40. Hur många minuter är lektionen?', _svar(40, 'minuter'),
          'Från 10:00 till 10:40 är det 40 minuter.'),
    val('Klockan är halv fem på eftermiddagen. Hur skrivs det med 24-timmarsklocka?',
        ['16:30', '4:30', '17:30', '15:30'], _klocka(12 * 60 + 4 * 60 + 30),
        'På eftermiddagen lägger man till 12 timmar. Halv fem är 4:30, och 4 + 12 = 16. Det blir 16:30.'),
    skriv('Hur många minuter är två timmar?', tal(2 * 60),
          'En timme är 60 minuter. 60 + 60 = 120 minuter.'),
    val('Leo går hemifrån 7:50. Det tar 20 minuter att gå till skolan. När är han framme?',
        ['8:10', '7:70', '8:20', '8:00'], _LEO_FRAMME,
        'Efter 10 minuter är klockan 8:00. Det är 10 minuter kvar att gå, så han är framme 8:10.'),
    sant('En kvart är längre än 20 minuter.', 15 > 20,
         'En kvart är 15 minuter. Det är kortare än 20 minuter.'),
    ordna('Ordna tiderna från kortast till längst.',
          _stigande([('en kvart', 15), ('en halvtimme', 30), ('tio minuter', 10), ('en timme', 60)]),
          forklaring='Tio minuter är kortast. En kvart är 15 minuter, en halvtimme 30 minuter och en timme 60 minuter.'),
], beskrivning='Hur lång tid något tar, vad klockan blir efter en stund, och 24-timmarsklockan.')


BANOR = [
    bana('Matematik', 'ak1', [
        niva('ma-ak1-tal-1', 'Talen 0–20', 'Taluppfattning', [
            val('Vilket tal kommer precis efter 12?',
                [11, 13, 14], 12 + 1,
                'När man räknar uppåt kommer 13 direkt efter 12.'),
            val('Vilket tal kommer precis före 10?',
                [9, 11, 8], 10 - 1,
                'Talet före är ett mindre. 10 − 1 = 9.'),
            skriv('Räkna vidare: 5, 6, 7, 8. Vilket tal kommer sedan?', _svar(8 + 1),
                  'Varje tal är ett mer än talet före. Efter 8 kommer 9.'),
            val('Vilket tal är störst?',
                [15, 19, 12, 17], max(15, 19, 12, 17),
                'Alla talen har ett tiotal. 19 har flest ental, 9 stycken, så 19 är störst.'),
            val('Vilket tal är minst?',
                [14, 4, 11, 20], min(14, 4, 11, 20),
                'Talet 4 har inget tiotal, bara 4 ental. De andra talen är 10 eller mer.'),
            skriv('Vilket tal står mitt emellan 6 och 8?', _svar((6 + 8) // 2),
                  'Räkna 6, 7, 8. Talet 7 står i mitten.'),
            ordna('Ordna talen från minst till störst.', _tal_stigande([16, 3, 11, 8]),
                  forklaring='Börja med det minsta talet, 3. Sedan kommer 8, 11 och sist 16.'),
            skriv('Talet 14 är 1 tiotal och några ental. Hur många ental?', _svar(14 - 10, 'ental'),
                  'Talet 14 är 10 + 4. Det är 1 tiotal och 4 ental.'),
        ], beskrivning='Att räkna, jämföra och hitta talet före och efter bland talen 0–20.'),

        niva('ma-ak1-tal-2', 'Tal i ord och siffror', 'Taluppfattning', [
            para('Para ihop talet i ord med samma tal i siffror.',
                 _entydiga([(_ord(n), tal(n)) for n in (7, 12, 15, 20)], _VARDE.get),
                 'Sju är 7 och tolv är 12. Talen 13 till 19 slutar på ton, som femton, 15. '
                 'Tjugo är 2 tiotal, alltså 20.'),
            skriv('Skriv talet arton med siffror.', tal(_VARDE['arton']),
                  'Arton är 1 tiotal och 8 ental. 10 + 8 = 18.'),
            sant('Talet tretton skrivs 31.', tal(_VARDE['tretton']) == '31',
                 'Tretton är 1 tiotal och 3 ental, så det skrivs 13. Talet 31 heter trettioett.'),
            val('Hur skrivs talet 14 med ord?',
                [_ord(n) for n in (14, 40, 4, 44)], _ord(14),
                'Fjorton är 14, alltså 1 tiotal och 4 ental. Fyrtio är 40, alltså 4 tiotal.'),
            para('Para ihop tiotalen och entalen med rätt tal.',
                 _entydiga([(t, tal(_tiotal_ental(t))) for t in
                            ('1 tiotal och 2 ental', '2 tiotal', '1 tiotal och 6 ental', '6 ental')],
                           _tiotal_ental),
                 'Ett tiotal är 10. 2 tiotal är 10 + 10 = 20, men 1 tiotal och 2 ental är 10 + 2 = 12.'),
            ordna('Ordna orden efter hur stort talet är, minst först.',
                  _stigande([(_ord(n), n) for n in (9, 16, 4, 11)]),
                  forklaring=_lista('%s är %d' % (_ord(n), n) for n in sorted((9, 16, 4, 11))).capitalize() + '.'),
            val('Sju barn står i en kö. Emma står på femte plats. Hur många barn står före henne?',
                [4, 5, 7 - 5, 6], 5 - 1,
                'Barnen på plats ett, två, tre och fyra står före Emma. Det är 4 barn.'),
            sant('Nitton är ett mindre än tjugo.', _VARDE['nitton'] == _VARDE['tjugo'] - 1,
                 'Nitton är 19. Räknar man ett steg till kommer 20, tjugo.'),
        ], beskrivning='Att läsa och skriva talen upp till 20 med ord och siffror, tiotal och ental, '
                       'och ordningstal som femte.'),

        niva('ma-ak1-addition-1', 'Tiokamrater', 'Addition och subtraktion', [
            val('Vilket tal är tiokamrat med 7?',
                [3, 4, 2], 10 - 7,
                '7 + 3 = 10. Därför är 7 och 3 tiokamrater.'),
            skriv('6 + ? = 10. Vilket tal fattas?', _svar(10 - 6),
                  'Räkna från 6 upp till 10: 7, 8, 9, 10. Det är 4 steg.'),
            val('Vilka två tal är tiokamrater?',
                ['5 och 5', '4 och 5', '6 och 3', '2 och 7'], '5 och 5',
                '5 + 5 = 10. De andra paren blir bara 9.'),
            skriv('I en skål ligger 10 äpplen. Du tar 2. Hur många äpplen ligger kvar?', _svar(10 - 2, 'äpplen'),
                  '2 och 8 är tiokamrater. Tar du 2 av 10 blir 8 kvar.'),
            val('Vad är 10 − 4?',
                [6, 4, 14, 5], 10 - 4,
                '4 och 6 är tiokamrater. Tar du bort 4 från 10 blir 6 kvar.'),
            skriv('Du har 3 kulor. Hur många kulor till behöver du för att ha 10?', _svar(10 - 3, 'kulor'),
                  '3 och 7 är tiokamrater, för 3 + 7 = 10.'),
            ordna('Ordna så att svaren går från minst till störst.',
                  _stigande([('10 − 8', 10 - 8), ('10 − 5', 10 - 5), ('10 − 3', 10 - 3)]),
                  forklaring='10 − 8 = 2, 10 − 5 = 5 och 10 − 3 = 7. Ju mer man tar bort, desto mindre blir kvar.'),
            val('Sara har 10 kronor. En glass kostar 9 kronor. Hur många kronor har hon kvar när hon köpt glassen?',
                [1, 9, 19, 2], 10 - 9,
                '9 och 1 är tiokamrater. 10 − 9 = 1.'),
        ], beskrivning='Talpar som tillsammans blir 10, och hur de hjälper när man räknar plus och minus.'),

        niva('ma-ak1-addition-2', 'Plus och minus till 20', 'Addition och subtraktion', [
            skriv('Vad är 8 + 5?', _svar(8 + 5),
                  'Ta 2 av femman och gör 8 till 10. Sedan 10 + 3 = 13.'),
            val('Vad är 15 − 4?',
                [11, 19, 10, 12], 15 - 4,
                'Ta bort 4 ental från 15. 5 − 4 = 1, så svaret är 11.'),
            skriv('Emil har 9 kulor. Han får 6 till. Hur många kulor har han nu?', _svar(9 + 6, 'kulor'),
                  'Han får fler, så det är plus. 9 + 1 = 10, och 5 till blir 15.'),
            val('Vad är 12 − 5?',
                [7, 8, 17, 6], 12 - 5,
                'Ta först bort 2, då blir det 10. Sedan 3 till: 10 − 3 = 7.'),
            val('7 + ? = 16. Vilket tal fattas?',
                [9, 8, 23, 10], 16 - 7,
                'Räkna från 7 till 10, det är 3. Sedan från 10 till 16, det är 6. 3 + 6 = 9.'),
            skriv('Det sitter 17 fåglar i ett träd. 8 flyger iväg. Hur många sitter kvar?', _svar(17 - 8, 'fåglar'),
                  'Det blir färre, så det är minus. Ta först bort 7: 17 − 7 = 10. Ta sedan bort 1 till: 10 − 1 = 9.'),
            ordna('Ordna så att svaren går från minst till störst.',
                  _stigande([('20 − 9', 20 - 9), ('6 + 7', 6 + 7), ('8 + 8', 8 + 8)]),
                  forklaring='20 − 9 = 11, 6 + 7 = 13 och 8 + 8 = 16.'),
            val('Vad är dubbelt så mycket som 8?',
                [16, 10, 4, 18], 2 * 8,
                'Dubbelt betyder två gånger så mycket. 8 + 8 = 16.'),
        ], beskrivning='Addition och subtraktion med svar upp till 20, också i små berättelser.'),

        niva('ma-ak1-geometri-1', 'Former och lägesord', 'Geometri', [
            val('Vilken form har tre hörn?',
                ['triangel', 'kvadrat', 'cirkel', 'rektangel'], 'triangel',
                'En triangel har tre raka sidor och tre hörn.'),
            skriv('Hur många hörn har en cirkel?',
                  ['0', 'noll', 'inga', 'inget', 'ingen', 'inga hörn', 'inget hörn', 'noll hörn'],
                  'En cirkel är helt rund. Den har inga raka sidor och inga hörn.'),
            skriv('Hur många hörn har en kvadrat?', _svar(4, 'hörn'),
                  'En kvadrat har fyra lika långa sidor och fyra hörn.'),
            skriv('Hur många sidor har en triangel?', _svar(3, 'sidor'),
                  'Tri betyder tre. En triangel har tre sidor och tre hörn.'),
            val('Vilken form har alltid fyra lika långa sidor?',
                ['kvadrat', 'rektangel', 'triangel'], 'kvadrat',
                'En kvadrat har fyra lika långa sidor. En rektangel har ofta två långa och två korta sidor.'),
            val('Bollen ligger under bordet. Var är bordet?',
                ['ovanför bollen', 'under bollen', 'bakom bollen'], 'ovanför bollen',
                'Om bollen är under bordet, så är bordet ovanför bollen.'),
            val('Ali, Bea och Cem står i en kö. Ali står först och Cem står sist. Vem står i mitten?',
                ['Bea', 'Ali', 'Cem'], 'Bea',
                'Ali är först och Cem är sist. Då står Bea i mitten, mellan dem.'),
            ordna('Ordna formerna från färst hörn till flest hörn.',
                  _stigande([('kvadrat', 4), ('cirkel', 0), ('triangel', 3)]),
                  forklaring='En cirkel har inga hörn, en triangel har tre och en kvadrat har fyra.'),
        ], beskrivning='Enkla former som triangel, kvadrat och cirkel, och ord som säger var något är.'),

        _AK1_GEOMETRI_2,
    ]),

    bana('Matematik', 'ak2', [
        niva('ma-ak2-tal-1', 'Tiotal och ental', 'Taluppfattning', [
            val('Hur många tiotal finns i talet 47?',
                [4, 7, 47, 40], 47 // 10,
                'Talet 47 är 40 + 7. 40 är 4 tiotal.'),
            skriv('Talet 63 har 6 tiotal. Hur många ental har det?', _svar(63 % 10, 'ental'),
                  'Talet 63 är 60 + 3. 60 är 6 tiotal och 3 är 3 ental.'),
            val('Vilket tal är 5 tiotal och 2 ental?',
                [52, 25, 502, 7], 5 * 10 + 2,
                '5 tiotal är 50 och 2 ental är 2. 50 + 2 = 52.'),
            skriv('Vilket tal är 10 mer än 38?', _svar(38 + 10),
                  'Tio mer är ett tiotal till. Tiotalen går från 3 till 4, så det blir 48.'),
            val('Vilket tal är störst?',
                [71, 17, 69, 70], max(71, 17, 69, 70),
                'Titta först på tiotalen. 71 och 70 har 7 tiotal. 71 har ett ental mer.'),
            ordna('Ordna talen från minst till störst.', _tal_stigande([64, 29, 92, 46]),
                  forklaring='Titta på tiotalen först: 2, 4, 6 och 9 tiotal.'),
            skriv('Vilket tal kommer precis efter 59?', _svar(59 + 1),
                  'Efter 9 ental blir det ett nytt tiotal. 59 + 1 = 60.'),
            val('Räkna i tiotal: 30, 40, 50. Vilket tal kommer sedan?',
                [60, 51, 55, 70], 50 + 10,
                'Varje gång läggs ett tiotal till. 50 + 10 = 60.'),
        ], beskrivning='Tal upp till 100 delade i tiotal och ental.'),

        _AK2_TAL_2,

        niva('ma-ak2-addition-1', 'Plus och minus till 100', 'Addition och subtraktion', [
            skriv('Vad är 30 + 40?', _svar(30 + 40),
                  '3 tiotal och 4 tiotal blir 7 tiotal, alltså 70.'),
            val('Vad är 45 + 23?',
                [68, 58, 78, 22], 45 + 23,
                '40 + 20 = 60 och 5 + 3 = 8. 60 + 8 = 68.'),
            skriv('Vad är 86 − 34?', _svar(86 - 34),
                  '80 − 30 = 50 och 6 − 4 = 2. 50 + 2 = 52.'),
            val('Vad är 38 + 7?',
                [45, 35, 44, 46], 38 + 7,
                '38 + 2 = 40. Sedan 5 till: 40 + 5 = 45.'),
            val('Vad är 52 − 8?',
                [44, 46, 56, 34], 52 - 8,
                '52 − 2 = 50. Sedan 6 till: 50 − 6 = 44.'),
            skriv('Ella har 50 kronor. Hon köper en bok för 35 kronor. Hur många kronor har hon kvar?',
                  _svar(50 - 35, 'kronor'),
                  'Räkna upp från 35: 5 till 40 och 10 till 50. 5 + 10 = 15.'),
            ordna('Ordna så att svaren går från minst till störst.',
                  _stigande([('60 − 20', 60 - 20), ('25 + 25', 25 + 25), ('20 + 15', 20 + 15)]),
                  forklaring='20 + 15 = 35, 60 − 20 = 40 och 25 + 25 = 50.'),
            val('64 + ? = 100. Vilket tal fattas?',
                [36, 46, 34, 44], 100 - 64,
                'Från 64 till 70 är 6. Från 70 till 100 är 30. 6 + 30 = 36.'),
        ], beskrivning='Plus och minus med tiotal och ental, med svar upp till 100.'),

        _AK2_ADDITION_2,

        niva('ma-ak2-tid-1', 'Hel och halv timme', 'Tid', [
            val('Klockan är 3:30. Hur säger man det?',
                ['halv fyra', 'halv tre', 'klockan tre', 'klockan fyra'], 'halv fyra',
                'Halv fyra betyder en halvtimme kvar tills klockan är fyra. Det är 3:30.'),
            val('Klockan är halv sju. Hur skriver man det med siffror?',
                ['6:30', '7:30', '6:00', '7:00'], '6:30',
                'Halv sju är en halvtimme innan klockan sju. Det är 6:30.'),
            skriv('Hur många minuter är en timme?', _svar(60, 'minuter'),
                  'En timme är 60 minuter.'),
            skriv('Hur många minuter är en halvtimme?', _svar(60 // 2, 'minuter'),
                  'En halvtimme är hälften av en timme. Hälften av 60 är 30.'),
            val('Klockan är 8:00. Hur säger man det?',
                ['klockan åtta', 'halv åtta', 'halv nio'], 'klockan åtta',
                'När minuterna är 00 är det hel timme. 8:00 är klockan åtta.'),
            val('Klockan är halv tolv. Vad är klockan en halvtimme senare?',
                ['12:00', '11:00', '12:30'], '12:00',
                'Halv tolv är 11:30. En halvtimme till blir 12:00, alltså klockan tolv.'),
            skriv('Kalaset börjar klockan 2 och slutar klockan 5. Hur många timmar håller det på?',
                  _svar(5 - 2, 'timmar'),
                  'Räkna timmarna: från 2 till 3, från 3 till 4 och från 4 till 5. Det är 3 timmar.'),
            ordna('Ordna tiderna från tidigast till senast.',
                  ['halv två', 'klockan två', 'halv tre', 'klockan tre'],
                  forklaring='Halv två är 1:30. Sedan kommer 2:00, halv tre är 2:30 och sist 3:00.'),
        ], beskrivning='Klockan vid hel och halv timme, i ord och med siffror.'),

        niva('ma-ak2-tid-2', 'Dygn, veckor och år', 'Tid', [
            para('Para ihop varje ord med hur lång tid det är.',
                 [('en timme', '%d minuter' % 60), ('ett dygn', '%d timmar' % 24),
                  ('en vecka', '%d dagar' % len(_VECKODAGAR)), ('ett år', '%d månader' % len(_MANADER))],
                 'Ett dygn är en dag och en natt, 24 timmar. En vecka har %d dagar och ett år har %d månader.'
                 % (len(_VECKODAGAR), len(_MANADER))),
            sant('En vecka har 5 dagar.', len(_VECKODAGAR) == 5,
                 'En vecka har %d dagar: %s.' % (len(_VECKODAGAR), _lista(_VECKODAGAR))),
            skriv('Hur många dagar är två veckor?', _svar(2 * len(_VECKODAGAR), 'dagar'),
                  'En vecka har 7 dagar. Två veckor är 7 + 7 = %d dagar.' % (2 * len(_VECKODAGAR))),
            val('I dag är det måndag. Vilken dag var det i går?',
                ['söndag', 'tisdag', 'lördag'], _dag('måndag', -1),
                'I går är dagen före i dag. Dagen före måndag är %s.' % _dag('måndag', -1)),
            val('I dag är det fredag. Vilken dag är det om tre dagar?',
                ['lördag', 'söndag', 'måndag', 'tisdag'], _dag('fredag', 3),
                'Räkna tre dagar framåt från fredag: %s.' % _lista(_dag('fredag', i) for i in (1, 2, 3))),
            ordna('Året börjar i januari. Ordna månaderna i den ordning de kommer under året.',
                  _stigande([(m, _MANADER.index(m)) for m in ('juli', 'februari', 'oktober', 'april')]),
                  forklaring='Räkna från januari: %s.'
                  % _lista('%s är nummer %d' % (m, _MANADER.index(m) + 1)
                           for m in sorted(('juli', 'februari', 'oktober', 'april'), key=_MANADER.index))),
            sant('Två dygn är 48 timmar.', 2 * 24 == 48,
                 'Ett dygn är 24 timmar. Två dygn är 24 + 24 = %d timmar.' % (2 * 24)),
            skriv('Hur många månader är ett halvt år?', _svar(len(_MANADER) // 2, 'månader'),
                  'Ett år har 12 månader. Hälften av 12 är %d, för %d + %d = 12.'
                  % ((len(_MANADER) // 2,) * 3)),
        ], beskrivning='Hur långt ett dygn, en vecka och ett år är, och att räkna med veckodagar och månader.'),

        niva('ma-ak2-matning-1', 'Kronor och längd', 'Mätning', [
            skriv('Du har två femmor och en enkrona. Hur många kronor har du?', _svar(5 + 5 + 1, 'kronor'),
                  'En femma är 5 kronor och en enkrona är 1 krona. 5 + 5 + 1 = 11.'),
            val('En banan kostar 7 kronor. Du betalar med en tia. Hur många kronor får du tillbaka?',
                [3, 7, 17, 4], 10 - 7,
                'En tia är 10 kronor. 10 − 7 = 3.'),
            val('Vilket är längst?',
                ['1 m', '90 cm', '50 cm', '99 cm'], '1 m',
                '1 meter är 100 centimeter. Det är mer än 99 centimeter.'),
            skriv('Hur många centimeter är 1 meter?', _svar(100, 'centimeter'),
                  'En meter är 100 centimeter.'),
            val('Vilken sak är ungefär 2 meter hög?',
                ['en dörr', 'en kopp', 'en sko', 'en tandborste'], 'en dörr',
                'En vuxen kan gå rakt in genom en dörr, så den är ungefär 2 meter hög. De andra sakerna är mycket mindre.'),
            skriv('Ett band är 50 cm långt. Ett annat band är 30 cm långt. Hur många centimeter är de tillsammans?',
                  _svar(50 + 30, 'centimeter'),
                  'Lägg ihop längderna: 50 + 30 = 80.'),
            val('Vad är mest pengar?',
                ['två tior', 'en tia och en femma', 'sju enkronor'], 'två tior',
                'Två tior är 10 + 10 = 20 kronor. En tia och en femma är 15 kronor, och sju enkronor är 7.'),
            ordna('Ordna från kortast till längst.',
                  _stigande([('1 m', 100), ('30 cm', 30), ('2 m', 200), ('70 cm', 70)]),
                  forklaring='1 m är 100 cm och 2 m är 200 cm. Därför kommer 30 cm och 70 cm först.'),
        ], beskrivning='Att räkna med kronor och att jämföra längder i centimeter och meter.'),

        _AK2_MATNING_2,
    ]),

    bana('Matematik', 'ak3', [
        niva('ma-ak3-tal-1', 'Tal till 1000', 'Taluppfattning', [
            val('Hur många hundratal finns i talet 572?',
                [5, 7, 2, 500], 572 // 100,
                'Talet 572 är 500 + 70 + 2. 500 är 5 hundratal.'),
            val('Vilket tal är 3 hundratal, 0 tiotal och 8 ental?',
                [308, 38, 380, 3008], 3 * 100 + 0 * 10 + 8,
                '3 hundratal är 300. Inga tiotal och 8 ental ger 308. Nollan håller platsen för tiotalen.'),
            skriv('Vilket tal är 100 mer än 460?', _svar(460 + 100),
                  'Hundra mer är ett hundratal till. Hundratalen går från 4 till 5, så det blir 560.'),
            skriv('Vilket tal kommer precis efter 399?', _svar(399 + 1),
                  'Efter 399 är både entalen och tiotalen fulla. Då blir det ett nytt hundratal: 400.'),
            val('Vilket tal är störst?',
                [709, 790, 97, 779], max(709, 790, 97, 779),
                '97 har inga hundratal. De andra har 7 hundratal, och då jämför man tiotalen. 790 har flest, 9 tiotal.'),
            ordna('Ordna talen från minst till störst.', _tal_stigande([481, 814, 189, 418]),
                  forklaring='Titta först på hundratalen. 418 och 481 har båda 4 hundratal, men 418 har färre tiotal.'),
            skriv('Skriv talet sexhundratjugo med siffror.', tal(600 + 20),
                  'Sexhundra är 600 och tjugo är 20. 600 + 20 = 620.'),
            val('Vilket tal är 10 mindre än 305?',
                [295, 205, 300, 315], 305 - 10,
                'Ta först bort 5, då blir det 300. Sedan 5 till: 300 − 5 = 295.'),
        ], beskrivning='Tal upp till 1000 med hundratal, tiotal och ental.'),

        _AK3_TAL_2,

        niva('ma-ak3-multiplikation-1', '2:an, 5:an och 10:an', 'Multiplikation', [
            skriv('Vad är 5 · 3?', _svar(5 * 3),
                  '5 · 3 är tre femmor: 5 + 5 + 5 = 15.'),
            val('Vad är 2 · 8?',
                [16, 10, 28, 18], 2 * 8,
                '2 · 8 är dubbelt så mycket som 8. 8 + 8 = 16.'),
            skriv('Vad är 10 · 7?', _svar(10 * 7),
                  '10 · 7 är sju tiotal, alltså 70.'),
            val('Det finns 4 påsar med 5 äpplen i varje. Hur många äpplen är det?',
                [20, 9, 15, 25], 4 * 5,
                '4 påsar med 5 i varje är 4 · 5. 5 + 5 + 5 + 5 = 20.'),
            val('Vilket tal finns INTE i 5:ans tabell?',
                [12, 15, 20, 35], 12,
                'Talen i 5:ans tabell slutar alltid på 0 eller 5. 12 slutar på 2.'),
            ordna('Ordna så att svaren går från minst till störst.',
                  _stigande([('10 · 3', 10 * 3), ('2 · 3', 2 * 3), ('2 · 9', 2 * 9), ('5 · 2', 5 * 2)]),
                  forklaring='2 · 3 = 6, 5 · 2 = 10, 2 · 9 = 18 och 10 · 3 = 30.'),
            skriv('En hand har 5 fingrar. Hur många fingrar har 6 händer?', _svar(6 * 5, 'fingrar'),
                  'Det är sex femmor: 6 · 5 = 30.'),
            val('Vilken uppgift har samma svar som 5 · 4?',
                ['4 · 5', '5 + 4', '5 · 5', '4 + 4'], '4 · 5',
                'Man kan byta plats på talen när man multiplicerar. 5 · 4 och 4 · 5 blir båda 20.'),
        ], beskrivning='Multiplikation som upprepad addition, med 2:ans, 5:ans och 10:ans tabell.'),

        niva('ma-ak3-multiplikation-2', '3:an och 4:an', 'Multiplikation', [
            para('Para ihop uppgiften med svaret.',
                 _entydiga([('%d · %d' % p, tal(p[0] * p[1])) for p in ((3, 4), (4, 4), (3, 7), (4, 6))],
                           _produkt),
                 'Räkna ut varje: %s.' % _lista('%d · %d = %d' % (a, b, a * b)
                                                for a, b in ((3, 4), (4, 4), (3, 7), (4, 6)))),
            skriv('Vad är 4 · 7?', _svar(4 * 7),
                  '4 är dubbelt så mycket som 2. Räkna först 2 · 7 = %d och dubbla sedan: %d + %d = %d.'
                  % (2 * 7, 2 * 7, 2 * 7, 4 * 7)),
            val('Vad är 3 · 9?', [27, 24, 12, 30], 3 * 9,
                '3 · 10 = %d. 3 · 9 är en trea mindre: %d − 3 = %d.' % (3 * 10, 3 * 10, 3 * 9)),
            sant('Talet 14 finns i 3:ans tabell.', 14 % 3 == 0,
                 '3:ans tabell är %s och så vidare. 14 finns inte med, för 3 · 4 = 12 och 3 · 5 = 15.'
                 % ', '.join(str(3 * k) for k in range(1, 6))),
            val('En trehjuling har 3 hjul. Hur många hjul har 6 trehjulingar?', [18, 9, 12, 21], 6 * 3,
                'Det är sex treor: %s = %d. Alltså är 6 · 3 = %d.' % (' + '.join(['3'] * 6), 6 * 3, 6 * 3)),
            ordna('Ordna så att svaren går från minst till störst.',
                  _stigande([('%d · %d' % p, p[0] * p[1]) for p in ((3, 5), (4, 2), (4, 9), (3, 10))]),
                  forklaring='%s.' % _lista('%d · %d = %d' % (a, b, a * b)
                                            for a, b in sorted(((3, 5), (4, 2), (4, 9), (3, 10)),
                                                               key=lambda p: p[0] * p[1]))),
            skriv('4 · ? = 32. Vilket tal fattas?', _svar(32 // 4),
                  'Räkna i 4:ans tabell: %s. Det är %d steg, så 4 · %d = 32.'
                  % (', '.join(str(4 * k) for k in range(1, 32 // 4 + 1)), 32 // 4, 32 // 4)),
            sant('3 · 8 är lika mycket som 4 · 6.', 3 * 8 == 4 * 6,
                 '3 · 8 = %d och 4 · 6 = %d. Två olika uppgifter kan ha samma svar.' % (3 * 8, 4 * 6)),
        ], beskrivning='Multiplikation med 3:ans och 4:ans tabell, och knep som att 4:an är dubbla 2:an.'),

        niva('ma-ak3-division-1', 'Dela lika', 'Division', [
            skriv('12 kulor delas lika mellan 3 barn. Hur många kulor får varje barn?', _svar(12 // 3, 'kulor'),
                  'Dela ut en kula i taget till de 3 barnen. Varje barn får 4, för 3 · 4 = 12.'),
            val('Vad är 10 / 2?',
                [5, 8, 12, 20], 10 // 2,
                'Delar man 10 i två lika delar blir varje del 5, för 5 + 5 = 10.'),
            val('20 äpplen läggs i påsar med 5 äpplen i varje. Hur många påsar blir det?',
                [4, 5, 15, 25], 20 // 5,
                'Räkna femmor tills du når 20: 5, 10, 15, 20. Det är 4 påsar.'),
            skriv('Vad är 18 / 2?', _svar(18 // 2),
                  'Hälften av 18 är 9, för 9 + 9 = 18.'),
            val('Tre kompisar delar 15 kronor lika. Hur många kronor får var och en?',
                [5, 3, 12, 18], 15 // 3,
                '15 / 3 = 5, för 3 · 5 = 15.'),
            skriv('Vad är hälften av 30?', _svar(30 // 2),
                  'Hälften är att dela i två lika delar. 15 + 15 = 30.'),
            ordna('Ordna så att svaren går från minst till störst.',
                  _stigande([('40 / 5', 40 // 5), ('8 / 2', 8 // 2), ('50 / 5', 50 // 5), ('30 / 5', 30 // 5)]),
                  forklaring='8 / 2 = 4, 30 / 5 = 6, 40 / 5 = 8 och 50 / 5 = 10.'),
            val('Vad är 35 / 5? Tänk på 5:ans tabell.',
                [7, 6, 30, 8], 35 // 5,
                '5 · 7 = 35. Därför ryms 5 sju gånger i 35, och 35 / 5 = 7.'),
        ], beskrivning='Division som att dela lika och att se hur många grupper det blir.'),

        _AK3_DIVISION_2,

        niva('ma-ak3-tid-1', 'Kvart över och kvart i', 'Tid', [
            val('Klockan är 3:15. Hur säger man det?',
                ['kvart över tre', 'kvart i tre', 'kvart över fyra', 'kvart i fyra'], 'kvart över tre',
                'En kvart är 15 minuter. 3:15 är 15 minuter efter tre, alltså kvart över tre.'),
            val('Klockan är kvart i sju. Hur skriver man det med siffror?',
                ['6:45', '7:45', '7:15', '6:15'], '6:45',
                'Kvart i sju är 15 minuter innan klockan sju. Det är 6:45.'),
            skriv('Hur många minuter är en kvart?', _svar(60 // 4, 'minuter'),
                  'En kvart är en fjärdedel av en timme. 60 minuter delat i fyra lika delar är 15.'),
            skriv('Hur många minuter är tre kvart?', _svar(3 * 15, 'minuter'),
                  'En kvart är 15 minuter. 15 + 15 + 15 = 45.'),
            val('Klockan är 9:10. Hur säger man det?',
                ['tio över nio', 'tio i nio', 'tio över tio', 'tio i tio'], 'tio över nio',
                '9:10 är 10 minuter efter klockan nio, alltså tio över nio.'),
            val('Klockan är 2:50. Hur säger man det?',
                ['tio i tre', 'tio över två', 'tio i två', 'tio över tre'], 'tio i tre',
                'Det är 10 minuter kvar tills klockan är tre. Därför säger man tio i tre.'),
            skriv('Ett tåg åker 10:15 och kommer fram 10:45. Hur många minuter tar resan?', _svar(45 - 15, 'minuter'),
                  'Räkna minuterna: 45 − 15 = 30. Det är en halvtimme.'),
            ordna('Ordna tiderna från tidigast till senast.',
                  ['klockan fyra', 'kvart över fyra', 'halv fem', 'kvart i fem'],
                  forklaring='Klockan fyra är 4:00, kvart över fyra är 4:15, halv fem är 4:30 och kvart i fem är 4:45.'),
        ], beskrivning='Klockan vid kvart över, kvart i och några minuter före och efter hel timme.'),

        _AK3_TID_2,
    ]),
]
