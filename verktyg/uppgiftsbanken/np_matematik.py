# -*- coding: utf-8 -*-
"""NP-träning i matematik (2026-10-06): åk 3 i spåret «Inför nationella provet».
Åk 6, åk 9, gy1 och gy2 har sina NP-nivåer i blad_matematik_*.py.

Bygger på de NP-nivåer som redan finns (området NP-träning och genomgångarna i
blad_matematik_lag_mellan.py, blad_matematik_hog.py och blad_matematik_gy.py)
och på materialbankens NP-blad (verktyg/bladen/np_ak6.py, np_ak9.py och
np_gymnasiet.py), och skriver det som saknades: åk 3 hade ingen NP-del alls.
Inga frågor därifrån upprepas. Allt är Nextrums egna uppgifter, skrivna mot
Lgr22:s centrala innehåll och ämnesplanen i matematik, i provens stil men
aldrig provens egna: korta svar och uppgifter i flera steg.

Varje område har två nivåer. Den första är kortare uppgifter, ungefär det som
provet kallar E-nivå. Den andra är uppgifter i flera steg och resonemang, C-
och A-nivå. I åk 3 sätts inga betyg, så där nämns inga nivåer.

Områdena heter «NP-träning: …»: namnet lägger dem i NP-spåret (NP_OMRADE i
bygg-uppgifter.py), och det skiljer dem från det befintliga området
NP-träning, för ett område får inte stå på två ställen i en bana. Nivåerna står
i TILLAGG och läggs sist i sina banor.

Förenklat: provens figurer, tabeller och diagram finns inte i NexLäx, så de
beskrivs i ord i frågan. Öppna uppgifter («visa att», «motivera») är här val-
eller sant-frågor om samma kunskap. Klockslag frågas bara som val, för
rättningen läser «17.00» som ett tal. Priser, räntor och avgifter i uppgifterna
är påhittade räkneexempel, inga uppgifter om hur det är i dag.

Filen lånar inga hjälpare ur de andra matematikfilerna: ett facit här ska inte
kunna ändras av en ändring där. Varje facit räknas ut i kod, och de felaktiga
alternativen prövas mot samma räkning (enda), så att exakt ett är rätt.
"""
import math
from fractions import Fraction as F

from grund import bana, niva, val, skriv, ordna, sant, para, tal, lika

MA = 'Matematik'


# ---------------------------------------------------------------- hjälpare

def t(x):
    """Talet som svar: decimalkomma och '-' för minus. Ett bråk måste gå jämnt
    ut i decimalform, annars hade facit avrundats utan att det syns."""
    if isinstance(x, F):
        assert (x * 10 ** 6).denominator == 1, x
        x = int(x) if x.denominator == 1 else float(x)
    return tal(x)


def m(x):
    """Talet i en text eller bland alternativen, med riktigt minustecken."""
    return t(x).replace('-', '−')


def svar(v, var=None):
    """Godtagna svar på en fråga med ett tal som svar. Ett negativt tal också
    med mellanslag efter minustecknet, och med var också som x = 5."""
    s = t(v)
    ut = [s]
    if s.startswith('-'):
        ut.append('- ' + s[1:])
    if var:
        for u in list(ut):
            ut += ['%s = %s' % (var, u), '%s=%s' % (var, u)]
    for u in ut:
        assert lika(s, u) or u.startswith(('- ', var or '\0')), u
    return ut


def brak_svar(p, *oforkortade):
    """En andel som svar: förkortat bråk, de oförkortade bråk som också är
    rätt, och decimal- och procentform när de går jämnt ut."""
    p = F(p)
    ut = ['%d/%d' % (p.numerator, p.denominator)]
    for b in oforkortade:
        assert F(b) == p, b
        ut.append(b)
    if (p * 1000).denominator == 1:
        ut += [t(p), t(p * 100) + ' %']
    return ut


def enda(alternativ, prov):
    traffar = [a for a in alternativ if prov(a)]
    assert len(traffar) == 1, 'väntade ett rätt alternativ i %r, fick %r' % (alternativ, traffar)
    return traffar[0]


def ordna_tal(fraga, par, forklaring, extra=None):
    """Brickor från minst till störst, ordnade ur sina värden. Två lika värden
    hade gett två rätta ordningar, så det prövas."""
    varden = [v for _, v in par]
    assert len(set(varden)) == len(varden), fraga
    return ordna(fraga, [text for text, _ in sorted(par, key=lambda p: p[1])], extra=extra,
                 forklaring=forklaring)


def avrunda(x, steg=1):
    """x avrundat till närmaste steg (1, 100, 1/10 …). Ett värde nära hälften
    stoppas: där hade en elev som räknat med avrundade mellanled kunnat hamna
    på andra sidan och få fel för ett rätt tänkt svar."""
    steg = F(steg)
    q = F(x) / steg
    rest = q - math.floor(q)
    assert abs(rest - F(1, 2)) > F(1, 50), (x, steg)
    return math.floor(q + F(1, 2)) * steg


def rakna(uttryck):
    """'3 · 8', '45 : 5', '100 − 64' räknat exakt."""
    a, op, b = uttryck.split(' ')
    a, b = F(a), F(b)
    return {'·': a * b, ':': a / b, '+': a + b, '−': a - b}[op]


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


def lost(a, b, c, d):
    """Lösningen till a·x + b = c·x + d, prövad."""
    x = F(d - b, a - c)
    assert a * x + b == c * x + d
    return x


def lutning(p, q):
    return F(q[1] - p[1], q[0] - p[0])


def punkt(text):
    """'(2, −3)' → (2, −3)."""
    a, b = text.strip('()').split(', ')
    return F(a.replace('−', '-')), F(b.replace('−', '-'))


def xy(text):
    """'x = 3, y = 4' → (3, 4)."""
    return tuple(F(d.split('= ')[1].replace('−', '-')) for d in text.split(', '))


def mangd(text):
    """'x = 3 eller x = −7' → {3, −7}."""
    return {F(d.split('= ')[1].replace('−', '-').replace(',', '.')) for d in text.split(' eller ')}


def pq(p, q):
    """Lösningarna till x² + px + q = 0, prövade. Bara rationella rötter."""
    p, q = F(p), F(q)
    d = (p / 2) ** 2 - q
    if d < 0:
        return set()
    r = F(math.isqrt(d.numerator), math.isqrt(d.denominator))
    assert r * r == d, (p, q)
    losn = {-p / 2 + r, -p / 2 - r}
    assert all(x * x + p * x + q == 0 for x in losn)
    return losn


def los_val(fraga, alternativ, losningar, forklaring):
    """Ett val där alternativen är lösningsmängder: rätt är den enda som är
    exakt lösningarna."""
    return val(fraga, alternativ, enda(alternativ, lambda a: mangd(a) == set(losningar)), forklaring)


PUNKTER = (-3, -2, -1, 1, 2, 4, 5)


def val_uttryck(fraga, alternativ, mal, forklaring):
    """Alternativen är (text, funktion). Rätt är den enda som har samma värden
    som mal i alla punkterna: två uttryck som är lika överallt är samma svar."""
    ratt = enda(alternativ, lambda a: all(a[1](F(x)) == mal(F(x)) for x in PUNKTER))
    return val(fraga, [a for a, _ in alternativ], ratt[0], forklaring)


def klocka(minuter):
    """Minuter efter midnatt som klockslag: 1020 → '17.00'."""
    return '%d.%02d' % divmod(minuter, 60)


# ================================================================ åk 3

# Åk 3 har inga betyg. Provet prövar om eleven nått det som krävs i slutet av
# åk 3, och uppgifterna här håller sig till talen upp till 1 000, tabellerna och
# enkla bråk som halva och fjärdedel. Få skrivfrågor: lågstadiet trycker hellre.

def siffervarde(heltal, siffra):
    """Värdet av en siffra som står en gång i talet: 4 i 342 → 40."""
    s = str(heltal)
    assert s.count(str(siffra)) == 1
    return siffra * 10 ** (len(s) - 1 - s.index(str(siffra)))


VARDE_342 = ['4', '40', '400']
assert siffervarde(342, 4) == 40
UPPDELNING = [('536', '500 + 30 + 6'), ('563', '500 + 60 + 3'), ('356', '300 + 50 + 6'), ('365', '300 + 60 + 5')]
assert all(int(a) == sum(int(d) for d in b.split(' + ')) for a, b in UPPDELNING)

AK3_TAL_1 = niva('ma-ak3-np-tal-och-rakning-1', 'Siffrornas värde', 'NP-träning: tal och räkning', [
    val('Vilket värde har siffran 4 i talet 342?', VARDE_342, t(siffervarde(342, 4)),
        'Siffran 4 står på tiotalens plats. Fyra tiotal är 40.'),
    skriv('Skriv talet sjuhundrafem med siffror.', t(7 * 100 + 5),
          'Sju hundratal, inga tiotal och fem ental: 705. Nollan visar att det inte finns några tiotal.'),
    val('Räkna i huvudet: 300 + 450', ['750', '705', '850', '650'], t(300 + 450),
        '300 + 400 = 700, och 50 till blir 750.'),
    skriv('Räkna i huvudet: 1 000 − 400', t(1000 - 400),
          '1 000 är tio hundratal. Tar du bort fyra hundratal är sex hundratal kvar: 600.'),
    val('Vilket tal ligger mitt emellan 400 och 500 på tallinjen?', ['450', '405', '540', '455'], t((400 + 500) // 2),
        'Från 400 till 500 är det 100 steg. Halva vägen är 50 steg, och 400 + 50 = 450.'),
    ordna_tal('Ordna talen från minst till störst.', [(s, int(s)) for s in ['709', '97', '790', '179']],
              '97 har inga hundratal och är minst. Sedan kommer 179. 709 och 790 har båda 7 hundratal, '
              'men 709 har färre tiotal.'),
    sant('Talet 610 är lika mycket som 61 tiotal.', 61 * 10 == 610,
         '61 tiotal är 61 · 10 = 610. Sex hundratal är 60 tiotal, och ett tiotal till blir 61.'),
    skriv('Vilket tal är 10 mer än 395?', t(395 + 10),
          '395 + 5 = 400, och 5 till blir 405. Tiotalen räcker inte, så det blir ett nytt hundratal.'),
    para('Para ihop talet med hur det kan delas upp.', UPPDELNING,
         'Hundratalen först, sedan tiotalen och sist entalen: 536 = 500 + 30 + 6.'),
], beskrivning='Tränar talen upp till 1 000 inför nationella provet i åk 3: hundratal, tiotal och ental, '
               'tallinjen och huvudräkning med hela hundratal och tiotal.')

PIZZA = ['en fjärdedel', 'en halv', 'en tredjedel']
OPERATION_18 = ['18 : 3', '18 − 3', '18 · 3', '18 + 3']
PAR_RAKNA = ['3 · 8', '45 : 5', '10 · 6', '32 : 4']
assert all(rakna(u).denominator == 1 for u in PAR_RAKNA)
assert len({rakna(u) for u in PAR_RAKNA}) == len(PAR_RAKNA)
assert rakna('458 + 236') == 694 and rakna('503 − 247') == 256

AK3_TAL_2 = niva('ma-ak3-np-tal-och-rakning-2', 'Räkna och dela lika', 'NP-träning: tal och räkning', [
    val('Räkna: 458 + 236', ['694', '684', '794', '614'], t(rakna('458 + 236')),
        'Ental: 8 + 6 = 14, skriv 4 och växla ett tiotal. Tiotal: 5 + 3 + 1 = 9. Hundratal: 4 + 2 = 6. '
        'Det blir 694.'),
    skriv('Räkna: 503 − 247', t(rakna('503 − 247')),
          '503 är 4 hundratal, 9 tiotal och 13 ental. 13 − 7 = 6, 9 − 4 = 5 och 4 − 2 = 2. Det blir 256.'),
    val('Hur mycket är en fjärdedel av 20 kr?', ['5 kr', '4 kr', '10 kr', '80 kr'], '%s kr' % t(F(20, 4)),
        'En fjärdedel får du om du delar i 4 lika delar: 20 : 4 = 5 kr.'),
    val('En pizza delas i 4 lika stora bitar. Du äter 1 bit. Hur stor del av pizzan har du ätit?', PIZZA,
        'en fjärdedel',
        'När något delas i 4 lika stora delar heter delarna fjärdedelar. En bit av fyra är en fjärdedel.'),
    sant('Två fjärdedelar är lika mycket som en halv.', F(2, 4) == F(1, 2),
         'Dela en halv pizza mitt itu, så får du två fjärdedelar. Tillsammans är de lika mycket som halvan.'),
    skriv('Det står 4 bord i klassrummet och 6 stolar vid varje bord. Hur många stolar är det?', t(4 * 6),
          'Fyra bord med 6 stolar vid varje: 4 · 6 = 24 stolar. Du kan också räkna 6 + 6 + 6 + 6.'),
    val('18 äpplen delas lika i 3 skålar. Vilken uträkning ger antalet äpplen i varje skål?', OPERATION_18,
        enda(OPERATION_18, lambda u: rakna(u) * 3 == 18),
        'Dela lika är division: 18 : 3 = 6 äpplen i varje skål. Kontroll: 3 · 6 = 18.'),
    skriv('Vilket tal fattas? 250 + ? = 400', t(400 - 250),
          'Från 250 till 300 är det 50, och från 300 till 400 är det 100. 50 + 100 = 150.'),
    para('Para ihop uppgiften med svaret.', [(u, t(rakna(u))) for u in PAR_RAKNA],
         'Division är multiplikation baklänges: 45 : 5 = 9 eftersom 9 · 5 = 45.'),
], beskrivning='Tränar de fyra räknesätten inför nationella provet i åk 3: plus och minus med växling, '
               'gånger och delat, och enkla bråk som halva och fjärdedel.')

TIDER = [('en sekund', 1), ('en minut', 60), ('en timme', 60 * 60), ('ett dygn', 24 * 60 * 60),
         ('en vecka', 7 * 24 * 60 * 60)]

AK3_MATA_1 = niva('ma-ak3-np-mata-och-geometri-1', 'Klockan, längd och pengar', 'NP-träning: mäta och geometri', [
    val('Hur många minuter är det från kvart över två till halv tre?',
        ['15 minuter', '30 minuter', '45 minuter', '10 minuter'], '%d minuter' % (30 - 15),
        'Kvart över två är 2.15 och halv tre är 2.30. Från 15 till 30 minuter är det 15 minuter, en kvart.'),
    skriv('Ett tv-program börjar 17.30 och slutar 18.15. Hur många minuter är programmet?',
          t((18 * 60 + 15) - (17 * 60 + 30)),
          'Från 17.30 till 18.00 är det 30 minuter, och från 18.00 till 18.15 är det 15 minuter. 30 + 15 = 45.'),
    val('Hur högt är ett vanligt bord? Välj det mest rimliga.', ['7 dm', '7 cm', '7 m'], '7 dm',
        '7 dm är 70 cm. 7 cm är kortare än en penna, och 7 m är mycket högre än taket i ett rum.'),
    skriv('Ett hopprep är 2 m långt och ett annat är 150 cm långt. Hur många centimeter längre är det första?',
          t(2 * 100 - 150),
          'Gör om till samma enhet först: 2 m = 200 cm. 200 − 150 = 50 cm.'),
    val('Ett äpple kostar 6 kr. Hur mycket kostar 4 äpplen?', ['24 kr', '10 kr', '20 kr', '28 kr'], '%d kr' % (4 * 6),
        'Fyra äpplen för 6 kr styck: 4 · 6 = 24 kr.'),
    skriv('Du köper en bok för 37 kr och betalar med 50 kr. Hur många kronor får du tillbaka?', t(50 - 37),
          'Räkna upp från 37: 3 kr till 40 och 10 kr till 50. 3 + 10 = 13 kr.'),
    sant('En halvtimme är 50 minuter.', 60 // 2 == 50,
         'En timme är 60 minuter, och hälften av 60 är 30. En halvtimme är alltså 30 minuter.'),
    ordna_tal('Ordna från kortast till längst tid.', TIDER,
              'En minut är 60 sekunder, en timme är 60 minuter, ett dygn är 24 timmar och en vecka är 7 dygn.'),
], beskrivning='Tränar mätning inför nationella provet i åk 3: klockan och hur lång tid något tar, '
               'längd i meter och centimeter, och att räkna med pengar.')

HORN = [('triangel', 3), ('rektangel', 4), ('femhörning', 5), ('cirkel', 0)]
CIRKEL_LINJER = ['Hur många som helst', 'Precis en enda linje', 'Precis två linjer', 'Precis fyra linjer']
TVA_KVADRATER = ['en rektangel', 'en triangel', 'en större kvadrat', 'en femhörning']

AK3_MATA_2 = niva('ma-ak3-np-mata-och-geometri-2', 'Former och symmetri', 'NP-träning: mäta och geometri', [
    val('Vilken form har tre sidor och tre hörn?', ['triangel', 'rektangel', 'cirkel', 'kvadrat'], 'triangel',
        'Tri betyder tre: en triangel har tre sidor och tre hörn. Rektangeln och kvadraten har fyra hörn, '
        'och cirkeln har inga.'),
    para('Para ihop formen med hur många hörn den har.',
         [(f, '%d hörn' % n if n else 'inga hörn') for f, n in HORN],
         'Räkna hörnen där två sidor möts. En cirkel är rund hela vägen, så den har inga hörn.'),
    val('Vilken kropp har samma form som en fotboll?', ['klot', 'kub', 'cylinder', 'kon'], 'klot',
        'Ett klot är runt åt alla håll, som en boll. En kub ser ut som en tärning och en cylinder som en burk.'),
    skriv('En tärning har formen av en kub. Hur många sidor (ytor) har den?', t(6),
          'En tärning har sex sidor med prickarna 1 till 6, och varje sida är en kvadrat.'),
    sant('En kvadrat har fyra symmetrilinjer.', True,
         'Du kan vika en kvadrat på mitten på fyra sätt: lodrätt, vågrätt och längs de två diagonalerna. '
         'Varje gång täcker halvorna varandra precis.'),
    sant('En rektangel som inte är en kvadrat har en symmetrilinje längs diagonalen.', False,
         'Viker du längs diagonalen hamnar hörnen snett, och halvorna täcker inte varandra. Rektangeln har två '
         'symmetrilinjer: en på längden och en på bredden.'),
    val('Hur många symmetrilinjer har en cirkel?', CIRKEL_LINJER, 'Hur många som helst',
        'Varje linje genom cirkelns mittpunkt delar den i två halvor som täcker varandra. Sådana linjer kan du '
        'rita hur många som helst.'),
    skriv('Ett staket ska gå runt en hage som är en kvadrat. Varje sida är 5 m. Hur många meter staket behövs?',
          t(4 * 5),
          'En kvadrat har fyra lika långa sidor: 5 + 5 + 5 + 5 = 20 m.'),
    val('Du lägger två lika stora kvadrater bredvid varandra, kant mot kant. Vilken form får du?', TVA_KVADRATER,
        'en rektangel',
        'Den nya formen blir dubbelt så lång som den är bred. Den har fyra räta hörn men sidorna är inte lika '
        'långa, så det är en rektangel.'),
], beskrivning='Tränar geometri inför nationella provet i åk 3: former och kroppar, hörn och sidor, '
               'symmetrilinjer och sträckan runt en figur.')

RAKNESATT = [('Ali har 5 kulor och Bo har 3. Hur många har de tillsammans?', 'plus'),
             ('Ali har 5 kulor och Bo har 3. Hur många fler har Ali?', 'minus'),
             ('6 kulor delas lika mellan 3 barn. Hur många får var och en?', 'delat med'),
             ('Det finns 3 påsar med 5 kulor i varje. Hur många kulor är det?', 'gånger')]
ASKAR = ['3 · 6', '3 + 6', '6 − 3', '6 : 3']
BILAR = -(-22 // 4)
assert BILAR == 6 and 5 * 4 < 22 <= 6 * 4

AK3_PROBLEM_1 = niva('ma-ak3-np-problemlosning-1', 'Lös i flera steg', 'NP-träning: problemlösning', [
    skriv('Ella har 45 kr. Hon får 30 kr av mormor och köper sedan en bok för 50 kr. Hur många kronor har hon kvar?',
          t(45 + 30 - 50),
          'Först får hon pengar: 45 + 30 = 75 kr. Sedan köper hon boken: 75 − 50 = 25 kr.'),
    val('I en buss sitter 23 barn. Vid nästa hållplats kliver 8 barn av och 12 barn på. Hur många barn sitter '
        'i bussen nu?', ['27', '43', '35', '15'], t(23 - 8 + 12),
        'Ta ett steg i taget: 23 − 8 = 15 barn är kvar, och 15 + 12 = 27 när de nya har klivit på.'),
    val('Lina har 3 askar med 6 pennor i varje. Vilken uträkning ger hur många pennor hon har?', ASKAR,
        enda(ASKAR, lambda u: rakna(u) == 6 + 6 + 6),
        'Tre askar med lika många i varje är 6 + 6 + 6, och det skrivs 3 · 6 = 18.'),
    val('22 barn ska åka till badhuset. Varje bil har plats för 4 barn. Hur många bilar behövs?',
        ['6', '5', '7', '4'], t(BILAR),
        '5 bilar räcker till 5 · 4 = 20 barn. Då är 2 barn kvar, och de behöver en bil till. Det blir 6 bilar.'),
    sant('Om du vet att 8 + 7 = 15, så vet du också att 15 − 7 = 8.', 15 - 7 == 8,
         'Plus och minus hör ihop. Tar du bort 7 från 15 är du tillbaka på 8.'),
    skriv('Pelle är 9 år. Hans storasyster är dubbelt så gammal som han. Hur gammal blir storasystern om 3 år?',
          t(2 * 9 + 3),
          'Storasystern är 2 · 9 = 18 år nu. Om 3 år är hon 18 + 3 = 21 år.'),
    val('En penna kostar 8 kr och ett sudd kostar 5 kr. Ali köper 2 pennor och 1 sudd. Hur mycket kostar det?',
        ['21 kr', '13 kr', '26 kr', '18 kr'], '%d kr' % (2 * 8 + 5),
        'Två pennor kostar 2 · 8 = 16 kr. Med suddet blir det 16 + 5 = 21 kr.'),
    skriv('Alva plockar 12 svampar. Bo plockar 4 fler än Alva, och Cleo plockar 5 färre än Bo. '
          'Hur många svampar plockar Cleo?', t(12 + 4 - 5),
          'Bo plockar 12 + 4 = 16. Cleo plockar 5 färre än Bo: 16 − 5 = 11.'),
    para('Para ihop frågan med räknesättet som passar.', RAKNESATT,
         'Tillsammans är plus och hur många fler är minus. Dela lika är delat med, och lika många i varje grupp '
         'är gånger.'),
], beskrivning='Tränar problemlösning inför nationella provet i åk 3: textuppgifter i flera steg, att välja '
               'räknesätt och att tänka efter vad svaret betyder.')

MONSTER = ['cirkel', 'kvadrat', 'triangel']
FOLJDER = [('2, 4, 6, 8', 'ökar med 2', lambda a: a + 2), ('20, 17, 14, 11', 'minskar med 3', lambda a: a - 3),
           ('1, 2, 4, 8', 'blir dubbelt så stor', lambda a: 2 * a), ('5, 10, 15, 20', 'ökar med 5', lambda a: a + 5)]
for _foljd, _, _regel in FOLJDER:
    _tal = [int(s) for s in _foljd.split(', ')]
    assert all(_regel(a) == b for a, b in zip(_tal, _tal[1:])), _foljd
FORDUBBLA = [2 * 2 ** i for i in range(4)]
assert FORDUBBLA == [2, 4, 8, 16] and not {6, 10} & set(FORDUBBLA)

AK3_PROBLEM_2 = niva('ma-ak3-np-problemlosning-2', 'Mönster och talföljder', 'NP-träning: problemlösning', [
    val('Vilket tal kommer sedan? 3, 6, 9, 12, …', ['15', '13', '14', '18'], t(12 + 3),
        'Talen ökar med 3 varje gång: 12 + 3 = 15.'),
    skriv('Vilket tal fattas? 50, 45, 40, ?, 30', t(40 - 5),
          'Talen minskar med 5 varje gång: 40 − 5 = 35, och 35 − 5 = 30 stämmer.'),
    val('Talen i följden 7, 11, 15, 19, … ökar lika mycket varje gång. Hur mycket?', ['4', '7', '3', '8'],
        t(11 - 7), '11 − 7 = 4, 15 − 11 = 4 och 19 − 15 = 4. Talen ökar med 4.'),
    skriv('Figur 1 har 3 prickar, figur 2 har 5 prickar och figur 3 har 7 prickar. Varje ny figur får 2 prickar '
          'till. Hur många prickar har figur 5?', t(3 + (5 - 1) * 2),
          'Figur 4 har 7 + 2 = 9 prickar, och figur 5 har 9 + 2 = 11 prickar.'),
    sant('Talet 20 finns med i talföljden 1, 4, 7, 10, …', 20 in range(1, 100, 3),
         'Talen ökar med 3: 1, 4, 7, 10, 13, 16, 19, 22. Efter 19 kommer 22, så 20 hoppas över.'),
    ordna('Bygg talföljden som börjar med 2 och blir dubbelt så stor varje gång.', [str(x) for x in FORDUBBLA],
          extra=['6', '10'],
          forklaring='Dubbelt så stort är gånger 2: 2 · 2 = 4, 4 · 2 = 8 och 8 · 2 = 16. 6 och 10 hör inte dit.'),
    val('Ett mönster går cirkel, kvadrat, triangel, cirkel, kvadrat, triangel och så vidare. Vilken form står på '
        'plats 10?', MONSTER, MONSTER[(10 - 1) % len(MONSTER)],
        'Mönstret börjar om efter tre former. Plats 1, 4, 7 och 10 är cirklar.'),
    skriv('Vilket tal kommer sedan? 125, 150, 175, …', t(175 + 25),
          'Talen ökar med 25 varje gång: 175 + 25 = 200.'),
    para('Para ihop talföljden med hur den ändras.', [(f, r) for f, r, _ in FOLJDER],
         'Jämför två tal som står bredvid varandra. Ändras de lika mycket varje gång, eller blir de dubbelt så stora?'),
], beskrivning='Tränar mönster inför nationella provet i åk 3: talföljder som ökar eller minskar lika mycket, '
               'upprepade mönster och att räkna ut ett steg längre fram.')


TILLAGG = [
    bana(MA, 'ak3', [AK3_TAL_1, AK3_TAL_2, AK3_MATA_1, AK3_MATA_2, AK3_PROBLEM_1, AK3_PROBLEM_2]),
]
