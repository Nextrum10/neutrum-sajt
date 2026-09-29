# -*- coding: utf-8 -*-
"""Programmering åk 6 och åk 9. I Lgr22 står programmeringen i matematik och
teknik: i åk 4–6 algoritmer som skapas och testas i visuell programmering
(sekvens, upprepning och villkor), i åk 7–9 algoritmer i textbaserad
programmering med variabler, villkor, loopar och funktioner, och i båda
att hitta och rätta fel. Åk 6 beskriver blockprogram i text, åk 9 visar
korta Python-program.

FACIT RÄKNAS UT GENOM ATT KÖRA PROGRAMMET. En robot på ett rutnät i åk 6
körs i robot() nedan, och programmet i frågan skrivs ut ur samma lista som
körs. Python-koden i åk 9 körs med exec i en egen tom dict och utskriften
fångas: ett "vad skrivs ut" som räknats i huvudet kan vara fel, och ett
barn som svarar rätt får då höra att det är fel. De felaktiga alternativen
prövas mot samma körning (assert), och ett "rätta felet" prövas genom att
köra varje förslag: bara ett av dem får lösa uppgiften.

INDRAGEN ÖVERLEVER SOM HÅRDA MELLANSLAG. Spelaren visar frågan med
white-space: pre-line, som behåller radbrytningarna men slår ihop vanliga
mellanslag i början av en rad: ett indrag med vanliga mellanslag hade
försvunnit, och i Python är indraget en del av programmet. visa() byter
därför indragets mellanslag mot U+00A0, som pre-line låter stå.
grund._text() tar bara bort blanktecken i början och slutet av hela
frågan, och frågan börjar alltid med en mening, så indragen står kvar.
En bricka i en ordna-fråga strippas däremot (också U+00A0), så inga
brickor med indrag: ordna-frågorna har bara rader utan indrag.
"""
import contextlib
import io
import textwrap
from itertools import permutations

from grund import bana, niva, val, skriv, ordna, sant, para, tal, lika

NBSP = '\u00a0'


# ---------------------------------------------------------------------------
# Python-koden i åk 9: visas, körs och rättas ur samma text.

def visa(kod):
    """Koden som den står i frågan: indraget som hårda mellanslag."""
    ut = []
    for rad in textwrap.dedent(kod).strip('\n').split('\n'):
        indrag = len(rad) - len(rad.lstrip(' '))
        ut.append(NBSP * indrag + rad.lstrip(' '))
    return '\n'.join(ut)


def kor(kod):
    """Kör koden i en egen tom dict och ger tillbaka det den skrev ut."""
    fangad = io.StringIO()
    with contextlib.redirect_stdout(fangad):
        exec(textwrap.dedent(kod), {})  # noqa: S102 — koden står i den här filen
    return fangad.getvalue()


def rader(kod):
    return kor(kod).rstrip('\n').split('\n')


def utskrift(kod):
    """Utskriften när den är en enda rad."""
    r = rader(kod)
    assert len(r) == 1, 'Koden skriver fler än en rad: %r' % r
    return r[0]


def felet(kod):
    """Namnet på felet koden ger, eller None om den går igenom."""
    try:
        compile(textwrap.dedent(kod), '<fraga>', 'exec')
        kor(kod)
    except Exception as e:  # noqa: BLE001 — vilket fel som helst är svaret
        return type(e).__name__
    return None


def fraga_kod(fraga, kod):
    return fraga + '\n\n' + visa(kod)


def vad_skrivs(kod, forklaring, fraga='Vad skrivs ut?', fler=()):
    """En skriv-fråga vars facit är utskriften."""
    ratt = utskrift(kod)
    return skriv(fraga_kod(fraga, kod), [ratt] + list(fler), forklaring)


def vilket_skrivs(kod, fel, forklaring, fraga=None):
    """En val-fråga vars rätta alternativ är utskriften, raderna med komma
    emellan (ett alternativ är en rad på skärmen). Frågan säger det när
    utskriften har flera rader. Ett fel alternativ som råkar vara utskriften
    stoppas här."""
    r = rader(kod)
    ratt = ', '.join(r)
    if fraga is None:
        fraga = 'Vad skrivs ut? Raderna står med komma emellan.' if len(r) > 1 else 'Vad skrivs ut?'
    assert all(', ' not in rad for rad in r), 'En rad med komma går inte att skilja från två rader'
    assert ratt not in fel, 'Ett fel alternativ är rätt: %r' % ratt
    return val(fraga_kod(fraga, kod), [ratt] + list(fel), ratt, forklaring)


# ---------------------------------------------------------------------------
# Roboten i åk 6: ett blockprogram som en lista, körd och utskriven.

HALL = ['uppåt', 'åt höger', 'nedåt', 'åt vänster']  # medurs
STEG = [(0, 1), (1, 0), (0, -1), (-1, 0)]
HOGER, VANSTER = ('höger',), ('vänster',)


def ga(n):
    return ('gå', n)


def upprepa(n, *kropp):
    return ('upprepa', n, list(kropp))


def robot(program, start='uppåt'):
    """(x, y, hållet den tittar, steg sammanlagt). x är rutor åt höger om
    start, y rutor uppåt."""
    t = dict(x=0, y=0, h=HALL.index(start), steg=0)

    def kor_(p):
        for ins in p:
            if ins[0] == 'gå':
                dx, dy = STEG[t['h']]
                t['x'] += dx * ins[1]
                t['y'] += dy * ins[1]
                t['steg'] += ins[1]
            elif ins == HOGER:
                t['h'] = (t['h'] + 1) % 4
            elif ins == VANSTER:
                t['h'] = (t['h'] - 1) % 4
            else:
                for _ in range(ins[1]):
                    kor_(ins[2])
    kor_(program)
    return t['x'], t['y'], HALL[t['h']], t['steg']


def instruktion(ins):
    if ins[0] == 'gå':
        return 'gå %d steg' % ins[1]
    return 'sväng ' + ins[0]


def robottext(program, indrag=0):
    ut = []
    for ins in program:
        if ins[0] == 'upprepa':
            ut.append(NBSP * indrag + 'upprepa %d gånger:' % ins[1])
            ut.append(robottext(ins[2], indrag + 4))
        else:
            ut.append(NBSP * indrag + instruktion(ins))
    return '\n'.join(ut)


def robotfraga(fraga, program, start='uppåt'):
    return 'Roboten står på en ruta och tittar %s. Programmet:\n\n%s\n\n%s' % (
        start, robottext(program), fraga)


def enda_ordningen(brickor, mal, start='uppåt'):
    """Prövar att bara brickornas rätta ordning når målrutan: annars hade
    ett annat rätt svar nekats."""
    traffar = {p for p in permutations(brickor) if robot(list(p), start)[:2] == mal}
    assert traffar == {tuple(brickor)}, 'Fler ordningar når %r: %r' % (mal, traffar)
    return [instruktion(b) for b in brickor]


def ordningar_som_fungerar(rader_, prov, fore=''):
    """Varje ordning av raderna som går igenom och klarar provet. fore körs
    först, som programmets början."""
    ok = set()
    for p in permutations(rader_):
        miljo = {}
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                exec(fore + '\n' + '\n'.join(p), miljo)  # noqa: S102
        except Exception:  # noqa: BLE001 — en ordning som ger fel fungerar inte
            continue
        if prov(miljo):
            ok.add(p)
    return ok


# ---------------------------------------------------------------------------
# Åk 6. Robotprogrammen, räknade.

R_SUMMA = [ga(2), HOGER, ga(3)]
assert robot(R_SUMMA)[3] == 5

R_VAND = [HOGER, HOGER]
assert robot(R_VAND)[2] == 'nedåt'

R_VANSTER = [VANSTER, ga(2)]
R_RUNT = [ga(1), HOGER, ga(1), HOGER, ga(1), HOGER, ga(1)]
assert robot(R_RUNT)[:2] == (0, 0)
R_TIO = [ga(4), VANSTER, ga(2), VANSTER, ga(4)]
R_POS = [ga(3), VANSTER, ga(2)]
POS = robot(R_POS, 'åt höger')
assert POS[:2] == (3, 2)
# Ett eget program för frågan om höjden: med samma program som frågan om
# sidledes hade förklaringen till den ena gett svaret på den andra.
R_POS2 = [ga(4), VANSTER, ga(3)]
POS2 = robot(R_POS2, 'åt höger')
assert POS2[:2] == (4, 3)

# Ordna: från start (tittar uppåt) till rutan 2 upp och 1 åt höger.
O_MAL1 = (1, 2)
O_BRICKOR1 = enda_ordningen([ga(2), HOGER, ga(1)], O_MAL1)
O_MAL2 = (-2, 1)
O_BRICKOR2 = enda_ordningen([ga(1), VANSTER, ga(2)], O_MAL2)


def efter_sving(start, sving):
    return 'Tittar %s, svänger %s' % (start, sving[0]), 'Tittar ' + robot([sving], start)[2]


SVANGAR = [efter_sving('uppåt', HOGER), efter_sving('uppåt', VANSTER),
           efter_sving('åt höger', HOGER), efter_sving('åt vänster', HOGER)]

# Upprepning
KLAPP_GANGER, KLAPP_PER = 3, 2
KLAPP = KLAPP_GANGER * KLAPP_PER
NASTLAD_YTTRE, NASTLAD_INRE = 2, 4
NASTLAD = NASTLAD_YTTRE * NASTLAD_INRE
assert KLAPP != KLAPP_GANGER + KLAPP_PER and NASTLAD != NASTLAD_YTTRE + NASTLAD_INRE

FEM_STEG = [ga(1)] * 5
FEM_ALT = {'upprepa 5 gånger: gå 1 steg': [upprepa(5, ga(1))],
           'upprepa 4 gånger: gå 1 steg': [upprepa(4, ga(1))],
           'upprepa 5 gånger: gå 5 steg': [upprepa(5, ga(5))],
           'upprepa 6 gånger: gå 1 steg': [upprepa(6, ga(1))]}
assert [k for k, p in FEM_ALT.items() if robot(p) == robot(FEM_STEG)] == ['upprepa 5 gånger: gå 1 steg']

R_KVADRAT = [upprepa(4, ga(2), HOGER)]
assert robot(R_KVADRAT) == (0, 0, 'uppåt', 8)
SEXHORNING_VINKEL = 60
SEXHORNING = 360 // SEXHORNING_VINKEL

HEJ_YTTRE, HEJ_INRE = 3, 2
HEJ = HEJ_YTTRE * HEJ_INRE
HEJ_ALLA = HEJ + HEJ_YTTRE
# Frågan om alla ord har egna tal: med samma program hade förklaringen till
# den ena frågan gett svaret på den andra, och Mästarprovet blandar dem.
HEJ2_YTTRE, HEJ2_INRE = 2, 4
HEJ2 = HEJ2_YTTRE * HEJ2_INRE
HEJ2_ALLA = HEJ2 + HEJ2_YTTRE
assert HEJ2_ALLA == 10
R_TVA_VANSTER = [upprepa(2, ga(3), VANSTER)]
assert robot(R_TVA_VANSTER)[2:] == ('nedåt', 6)


def sag_ordning():
    """säg A, upprepa 2 gånger: säg B, säg C, säg D."""
    ut = ['A']
    for _ in range(2):
        ut += ['B', 'C']
    return ', '.join(ut + ['D'])


SAG = sag_ordning()
POANG_GANGER, POANG_ANDRING = 5, 2
POANG = POANG_GANGER * POANG_ANDRING


# Villkor, som Python-funktioner för att räkna facit.
def kladsel(temp):
    return 'Mössa!' if temp < 0 else 'Keps!'


def kladsel3(temp):
    if temp < 0:
        return 'Mössa'
    if temp < 15:
        return 'Jacka'
    return 'T-shirt'


JAMN_POANG = sum(2 if t % 2 == 0 else 1 for t in range(1, 5))
assert JAMN_POANG == 6
DELBARA = [t for t in range(1, 21) if t % 3 == 0 and t % 2 == 0]
MELLAN_ALT = [3, 5, 7, 9]
MELLAN = [t for t in MELLAN_ALT if 3 < t < 7]
assert len(MELLAN) == 1


def a_b_c(x):
    if x > 10:
        return 'A'
    if x > 5:
        return 'B'
    return 'C'


assert a_b_c(12) == 'A'
SPELET_SLUTAR = (7 >= 10) or (0 == 0)

# Felsökning, åk 6
R_TRE = [upprepa(3, ga(4), HOGER)]
assert robot(R_TRE)[:2] != (0, 0) and robot([upprepa(4, ga(4), HOGER)])[:2] == (0, 0)

R_TILLBAKA = [ga(3), HOGER, ga(3)]
TILLBAKA_FORSLAG = {
    'Byt sväng höger mot två sväng höger i rad': [ga(3), HOGER, HOGER, ga(3)],
    'Byt det sista gå 3 steg mot gå 6 steg': [ga(3), HOGER, ga(6)],
    'Ta bort sväng höger': [ga(3), ga(3)],
    'Lägg till sväng vänster allra sist': [ga(3), HOGER, ga(3), VANSTER],
}
assert [k for k, p in TILLBAKA_FORSLAG.items() if robot(p)[:2] == (0, 0)] == \
    ['Byt sväng höger mot två sväng höger i rad']

R_STJARNA = [ga(2), VANSTER, ga(2)]
STJARNA = (2, 2)
STJARNA_FORSLAG = {
    'sväng vänster ska vara sväng höger': [ga(2), HOGER, ga(2)],
    'Det första gå 2 steg ska vara gå 3 steg': [ga(3), VANSTER, ga(2)],
    'Det sista gå 2 steg ska tas bort': [ga(2), VANSTER],
    'sväng vänster ska tas bort': [ga(2), ga(2)],
}
assert [k for k, p in STJARNA_FORSLAG.items() if robot(p)[:2] == STJARNA] == \
    ['sväng vänster ska vara sväng höger']
assert robot(R_STJARNA)[:2] == (-2, 2)


def spara_poang():
    poang = 0
    poang += 3
    poang += 3
    poang = 1
    poang += 2
    return poang


def dubblingar():
    tal_ = 1
    for _ in range(4):
        tal_ = tal_ * 2
    return tal_


def raknar(fore, ganger, sag_forst):
    """tal = fore; upprepa: säg tal / ändra tal med 1, i någon ordning."""
    sagt, t = [], fore
    for _ in range(ganger):
        if sag_forst:
            sagt.append(t)
            t += 1
        else:
            t += 1
            sagt.append(t)
    return sagt


RAKNA_MAL = [1, 2, 3, 4, 5]
assert raknar(0, 5, True) == [0, 1, 2, 3, 4]
RAKNA_FORSLAG = {
    'Byt plats på säg tal och ändra tal med 1': raknar(0, 5, False),
    'Låt loopen upprepa 6 gånger': raknar(0, 6, True),
    'Sätt tal till 5 från början': raknar(5, 5, True),
    'Ta bort ändra tal med 1': [0] * 5,
}
assert [k for k, s in RAKNA_FORSLAG.items() if s == RAKNA_MAL] == ['Byt plats på säg tal och ändra tal med 1']

STORA_SMA = sum(10 if t > 4 else 1 for t in range(1, 7))
assert STORA_SMA == 24
KOPIA = 5  # sätt x till 5; sätt y till x; sätt x till 8; säg y
R_TRE_VANSTER = [upprepa(3, ga(1), VANSTER)]
assert robot(R_TRE_VANSTER)[2] == 'åt höger'


# ---------------------------------------------------------------------------
# Åk 9. Koden i frågorna.

K_PLUS = '''
x = 5
x = x + 3
print(x)
'''
K_KOPIA = '''
a = 4
b = a
a = 10
print(b)
'''
K_TEXTPLUS = 'print("3" + "4")'
K_REST = 'print(17 % 5)'
K_HELTALSDIV = 'print(17 // 5)'
assert utskrift(K_REST) == '2' and utskrift(K_HELTALSDIV) == '3'
DATATYP = {'str (text)': 'str', 'int (heltal)': 'int', 'float (decimaltal)': 'float',
           'bool (sant eller falskt)': 'bool'}
assert type("12").__name__ == 'str' and type(3.5).__name__ == 'float'
PARA_TYPER = [('True', 'bool'), ('42', 'int'), ('4.2', 'float'), ('"42"', 'str')]
assert all(type(eval(v)).__name__ == t for v, t in PARA_TYPER)  # noqa: S307
assert felet('2poang = 5') == 'SyntaxError'

BYT_RADER = ['temp = a', 'a = b', 'b = temp']
BYT_OK = ordningar_som_fungerar(BYT_RADER, lambda m: (m['a'], m['b']) == (2, 1), fore='a = 1\nb = 2')
assert BYT_OK == {tuple(BYT_RADER)}

K_INT = 'print(int("5") + 2)'
K_GANGER = 'print("5" * 3)'
K_ALDER = 'print("Ålder: " + 14)'
assert felet(K_ALDER) == 'TypeError'
K_LEN = 'print(len("programmering"))'
K_NAMN = '''
namn = "Sara"
print("Hej " + namn + "!")
'''
K_DELAT = 'print(10 / 4)'
K_OKA = '''
x = 3
x += 2
x *= 4
print(x)
'''
K_BOOL = 'print(5 > 3 and 2 > 4)'

K_RANGE4 = '''
for i in range(4):
    print(i)
'''
K_SUMMA = '''
summa = 0
for i in range(1, 5):
    summa = summa + i
print(summa)
'''
K_ELIF = '''
x = 7
if x > 10:
    print("stor")
elif x > 5:
    print("mellan")
else:
    print("liten")
'''
K_STEG3 = '''
for i in range(2, 10, 3):
    print(i)
'''
K_WHILE = '''
n = 1
while n < 50:
    n = n * 2
print(n)
'''
TIO_RADER = ['tal = 5', 'tal = tal * 2', 'print(tal)']
TIO_OK = {p for p in permutations(TIO_RADER) if not felet('\n'.join(p)) and kor('\n'.join(p)) == '10\n'}
assert TIO_OK == {tuple(TIO_RADER)}
K_NASTLAD = '''
for i in range(3):
    for j in range(4):
        print("Hej")
'''
assert len(rader('for i in range(5):\n    print(i)')) == 5

K_TRE = '''
for tal in range(1, 11):
    if tal % 3 == 0:
        print(tal)
'''
K_BANAN = '''
antal = 0
for bokstav in "banan":
    if bokstav == "a":
        antal = antal + 1
print(antal)
'''
K_BREAK = '''
i = 0
while True:
    i = i + 1
    if i == 4:
        break
print(i)
'''
K_OCH = '''
x = 15
if x > 10 and x < 20:
    print("A")
else:
    print("B")
'''
K_STORST = '''
poang = [4, 9, 2, 7]
storst = poang[0]
for p in poang:
    if p > storst:
        storst = p
print(storst)
'''
K_NED = '''
for i in range(10, 0, -2):
    print(i)
'''
K_INTE = 'print(not (3 > 5))'
K_OANDLIG = '''
x = 0
while x < 10:
    print(x)
'''

K_DUBBLA = '''
def dubbla(x):
    return x * 2

print(dubbla(7))
'''
K_HALSA = '''
def halsa(namn):
    return "Hej " + namn

print(halsa("Ali"))
'''
K_AREA = '''
def area(b, h):
    return b * h

print(area(3, 5) + area(2, 2))
'''
K_DEF_UTAN_ANROP = '''
def hej():
    print("Hej!")
'''
assert kor(K_DEF_UTAN_ANROP) == ''
K_NONE = '''
def f(x):
    print(x + 1)

y = f(3)
print(y)
'''
K_MAX = '''
def storst(a, b):
    if a > b:
        return a
    return b

print(storst(4, 9))
'''
K_SUMMA_LISTA = '''
def summa(lista):
    s = 0
    for t in lista:
        s = s + t
    return s

print(summa([3, 5, 8]))
'''
K_POTENS = '''
def potens(x, n=2):
    return x ** n

print(potens(3) + potens(2, 3))
'''
K_SCOPE = '''
x = 10

def andra():
    x = 5

andra()
print(x)
'''
K_JAMN = '''
def ar_jamn(n):
    return n % 2 == 0

print(ar_jamn(7))
'''
K_PRIS = '''
def pris(antal):
    if antal >= 10:
        return antal * 8
    return antal * 10

print(pris(9))
print(pris(10))
'''
K_ANROPAR = '''
def dubbla(x):
    return x * 2

def fyrdubbla(x):
    return dubbla(dubbla(x))

print(fyrdubbla(5))
'''
assert utskrift(K_ANROPAR) == '20'

K_PARENTES = 'print("Hej"'
assert felet(K_PARENTES) == 'SyntaxError'
K_SUMMA10 = '''
summa = 0
for i in range(1, 10):
    summa = summa + i
print(summa)
'''
K_SUMMA10_RATT = K_SUMMA10.replace('range(1, 10)', 'range(1, 11)')
assert utskrift(K_SUMMA10) == '45' and utskrift(K_SUMMA10_RATT) == str(sum(range(1, 11)))
K_SUMMA2_7 = K_SUMMA10.replace('range(1, 10)', 'range(2, 8)')
assert utskrift(K_SUMMA2_7) == str(sum(range(2, 8))) == '27'
K_NAMEERROR = '''
print(poang)
poang = 10
'''
assert felet(K_NAMEERROR) == 'NameError'
K_INDRAG = '''
for i in range(3):
print(i)
'''
assert felet(K_INDRAG) == 'IndentationError'
K_MEDEL = '''
medel = 8 + 6 / 2
print(medel)
'''
MEDEL_FORSLAG = {'medel = (8 + 6) / 2': '7.0', 'medel = 8 + (6 / 2)': None,
                 'medel = 8 + 6 // 2': None, 'medel = (8 + 6) * 2': None}
for forslag, _ in MEDEL_FORSLAG.items():
    MEDEL_FORSLAG[forslag] = utskrift(forslag + '\nprint(medel)')
assert [k for k, v in MEDEL_FORSLAG.items() if float(v) == 7] == ['medel = (8 + 6) / 2']
assert float(utskrift(K_MEDEL)) == 11
K_INDEX = '''
frukter = ["äpple", "päron", "banan"]
print(frukter[3])
'''
assert felet(K_INDEX) == 'IndexError'

K_BYT = '''
a = 3
b = 4
a, b = b, a + b
print(a, b)
'''
K_FORST_SIST = '''
text = "NexLäx"
print(text[0] + text[-1])
'''
K_MINUS = '''
i = 10
while i > 0:
    i = i - 3
print(i)
'''
K_APPEND = '''
lista = [1, 2, 3]
lista.append(4)
print(len(lista))
'''
K_ORDLANGD = '''
for ord in ["sol", "is", "hav"]:
    print(len(ord))
'''
K_TVA_IF = '''
x = 5
if x > 3:
    x = x - 4
if x > 3:
    x = x * 10
print(x)
'''
K_BAKLANGES = '''
s = ""
for c in "abc":
    s = c + s
print(s)
'''
K_CONTINUE = '''
n = 0
for i in range(5):
    if i % 2 == 0:
        continue
    n = n + i
print(n)
'''

# Svar som är tal ska rättas som tal, men aldrig så att ett vanligt fel går
# igenom: "3 1" hade lästs som 31, så resten och heltalsdivisionen frågas
# var för sig, och två tal på en rad frågas som val.
assert not lika(utskrift(K_TEXTPLUS), '7') and lika(utskrift(K_DELAT), '2,5')
assert not lika(utskrift(K_GANGER), '15')


BANOR = [
    bana('Programmering', 'ak6', [
        niva('prog-ak6-algoritmer-1', 'Steg för steg', 'Algoritmer', [
            val('Vad är en algoritm?',
                ['En instruktion i steg som löser en uppgift', 'Ett fel som gör att programmet stannar',
                 'En dator som kan räkna mycket snabbt', 'Ett språk som bara datorer förstår'],
                'En instruktion i steg som löser en uppgift',
                'En algoritm är en noggrann beskrivning i steg. Ett recept och en vägbeskrivning är '
                'också algoritmer.'),
            sant('En algoritm kan vara skriven på vanlig svenska, till exempel som ett recept.', True,
                 'En algoritm behöver inte vara ett datorprogram. Det viktiga är att stegen är tydliga '
                 'och står i rätt ordning.'),
            ordna('Ordna stegen så att algoritmen för att borsta tänderna blir rätt.',
                  ['Ta tandborsten', 'Sätt tandkräm på borsten', 'Borsta tänderna', 'Skölj borsten'],
                  forklaring='Tandkrämen måste på innan du borstar, och borsten sköljs när du är klar. '
                             'Byter du plats på två steg blir det fel.'),
            ordna('Ordna stegen i algoritmen för att göra en ostsmörgås.',
                  ['Ta fram en brödskiva', 'Bred på smör', 'Lägg på osten', 'Ät smörgåsen'],
                  forklaring='Varje steg bygger på det före: utan bröd går det inte att breda smör, '
                             'och smörgåsen äts när den är färdig.'),
            val('Varför måste stegen i ett program stå i rätt ordning?',
                ['Datorn gör stegen i den ordning de står', 'Datorn väljer själv den bästa ordningen',
                 'Datorn gör alla stegen på en gång', 'Datorn gör bara det första steget'],
                'Datorn gör stegen i den ordning de står',
                'En dator tänker inte själv. Den följer instruktionerna uppifrån och ned, en i taget. '
                'Det kallas sekvens.'),
            skriv(robotfraga('Hur många steg går roboten sammanlagt?', R_SUMMA), tal(robot(R_SUMMA)[3]),
                  'Roboten går 2 steg och sedan 3 steg. Svängen är inget steg, den vrider bara roboten: '
                  '2 + 3 = %d.' % robot(R_SUMMA)[3]),
            val(robotfraga('Åt vilket håll tittar roboten när programmet är slut?', R_VAND),
                ['Nedåt', 'Uppåt', 'Åt höger', 'Åt vänster'], robot(R_VAND)[2].capitalize(),
                'Två svängar åt höger är ett halvt varv. Roboten har vänt sig om och tittar nedåt.'),
            sant('En dator förstår vad du menar även om instruktionen är otydlig.', False,
                 'Datorn gör exakt det som står, inte det du menade. Därför måste en instruktion vara '
                 'helt tydlig.'),
        ], beskrivning='Vad en algoritm är, och varför ordningen spelar roll.'),

        niva('prog-ak6-algoritmer-2', 'Roboten på rutnätet', 'Algoritmer', [
            val(robotfraga('Åt vilket håll tittar roboten när programmet är slut?', R_VANSTER),
                ['Åt vänster', 'Åt höger', 'Uppåt', 'Nedåt'], robot(R_VANSTER)[2].capitalize(),
                'Roboten svänger vänster först och går sedan. Att gå ändrar inte vilket håll den tittar åt.'),
            sant(robotfraga('Roboten står på startrutan igen när programmet är slut.', R_RUNT), True,
                 'Roboten går ett steg fyra gånger och svänger höger mellan stegen. Den går runt en '
                 'kvadrat och kommer tillbaka till startrutan.'),
            skriv(robotfraga('Hur många steg går roboten sammanlagt?', R_TIO), tal(robot(R_TIO)[3]),
                  'Räkna bara gå-instruktionerna: 4 + 2 + 4 = %d. Svängarna är inga steg.' % robot(R_TIO)[3]),
            skriv(robotfraga('Hur många rutor åt höger om startrutan står roboten?', R_POS, 'åt höger'),
                  tal(POS[0]),
                  'Roboten går 3 steg åt höger. Sedan svänger den vänster, så att den tittar uppåt, och '
                  'går 2 steg uppåt. Åt höger kom den alltså bara de första %d stegen.' % POS[0]),
            skriv(robotfraga('Hur många rutor ovanför startrutan står roboten?', R_POS2, 'åt höger'),
                  tal(POS2[1]),
                  'De första 4 stegen går åt höger. Efter svängen vänster tittar roboten uppåt och går '
                  '%d steg upp.' % POS2[1]),
            ordna('Roboten står på start och tittar uppåt. Den ska till rutan som ligger 2 rutor upp '
                  'och 1 ruta åt höger. Ordna programmet.', O_BRICKOR1,
                  forklaring='Först 2 steg uppåt, sedan sväng höger så att roboten tittar åt höger, och '
                             'sist 1 steg dit. Svänger den för tidigt hamnar den för långt åt höger.'),
            ordna('Roboten står på start och tittar uppåt. Den ska till rutan som ligger 1 ruta upp '
                  'och 2 rutor åt vänster. Ordna programmet.', O_BRICKOR2,
                  forklaring='Ett steg uppåt, sedan sväng vänster så att roboten tittar åt vänster, och '
                             'sist 2 steg åt vänster.'),
            val('Vilken instruktion är tydligast för en robot?',
                ['Gå 3 steg framåt', 'Gå en bit framåt', 'Gå tills det känns rätt', 'Gå ungefär rakt fram'],
                'Gå 3 steg framåt',
                'En robot kan inte gissa vad "en bit" eller "ungefär" betyder. Ett exakt antal steg går '
                'bara att göra på ett sätt.'),
            para('Para ihop. Vart tittar roboten efter svängen?', SVANGAR,
                 'En sväng höger vrider roboten ett kvarts varv medsols, som klockans visare. En sväng '
                 'vänster vrider den åt andra hållet.'),
        ], beskrivning='Styr en robot med gå och sväng, och räkna ut var den hamnar.'),

        niva('prog-ak6-upprepning-1', 'Loopar', 'Upprepning', [
            val('Vad gör en loop i ett program?',
                ['Upprepar några instruktioner flera gånger', 'Väljer mellan två olika vägar',
                 'Stänger av programmet när det är klart', 'Sparar ett värde till senare'],
                'Upprepar några instruktioner flera gånger',
                'En loop, eller upprepning, kör samma instruktioner om och om igen, så att du slipper '
                'skriva dem många gånger.'),
            skriv('Programmet:\n\nupprepa %d gånger:\n%sklappa\n%sklappa\n%shoppa\n\n'
                  'Hur många gånger klappar figuren?' % (KLAPP_GANGER, NBSP * 4, NBSP * 4, NBSP * 4),
                  tal(KLAPP),
                  'Varje varv klappar figuren %d gånger, och loopen går %d varv: %d · %d = %d.'
                  % (KLAPP_PER, KLAPP_GANGER, KLAPP_PER, KLAPP_GANGER, KLAPP)),
            skriv('Programmet:\n\nupprepa %d gånger:\n%supprepa %d gånger:\n%sklappa\n\n'
                  'Hur många gånger klappar figuren?' % (NASTLAD_YTTRE, NBSP * 4, NASTLAD_INRE, NBSP * 8),
                  tal(NASTLAD),
                  'Den inre loopen klappar %d gånger, och den yttre kör den inre %d gånger: '
                  '%d · %d = %d.' % (NASTLAD_INRE, NASTLAD_YTTRE, NASTLAD_YTTRE, NASTLAD_INRE, NASTLAD)),
            val('Programmet är:\n\n%s\n\nVilken loop gör samma sak?' % robottext(FEM_STEG),
                list(FEM_ALT), 'upprepa 5 gånger: gå 1 steg',
                'Programmet går 1 steg fem gånger. En loop som upprepar "gå 1 steg" 5 gånger gör '
                'exakt samma sak, med en rad i stället för fem.'),
            skriv(robotfraga('Hur många steg går roboten sammanlagt?', R_KVADRAT), tal(robot(R_KVADRAT)[3]),
                  'Varje varv går roboten 2 steg, och loopen går 4 varv: 4 · 2 = %d.' % robot(R_KVADRAT)[3]),
            val('En figur ritar ett streck där den går. Vilken form ritar programmet?\n\n'
                'upprepa 4 gånger:\n%sgå 5 steg\n%ssväng höger 90 grader' % (NBSP * 4, NBSP * 4),
                ['En kvadrat', 'En triangel', 'En rak linje', 'En sexhörning'], 'En kvadrat',
                'Fyra lika långa sidor och fyra räta hörn på 90 grader blir en kvadrat. 4 · 90 = 360 '
                'grader, ett helt varv.'),
            skriv('En figur ska rita en sexhörning med lika långa sidor. Programmet är:\n\n'
                  'upprepa ? gånger:\n%sgå 3 steg\n%ssväng höger %d grader\n\n'
                  'Hur många gånger ska loopen upprepas?' % (NBSP * 4, NBSP * 4, SEXHORNING_VINKEL),
                  tal(SEXHORNING),
                  'En sexhörning har 6 sidor. Figuren svänger %d grader efter varje sida, och '
                  '6 · %d = 360 grader, ett helt varv tillbaka till start.' % (SEXHORNING_VINKEL, SEXHORNING_VINKEL)),
            sant('En loop som upprepar en instruktion 10 gånger gör samma sak som när instruktionen '
                 'står 10 gånger i rad.', True,
                 'Det är just det en loop är till för. Programmet blir kortare, och vill du ändra '
                 'antalet ändrar du bara ett tal.'),
        ], beskrivning='Upprepa instruktioner med en loop, och räkna hur många gånger något händer.'),

        niva('prog-ak6-upprepning-2', 'Loopar i loopar', 'Upprepning', [
            skriv('Programmet:\n\nupprepa %d gånger:\n%supprepa %d gånger:\n%ssäg "hej"\n%ssäg "då"\n\n'
                  'Hur många gånger säger figuren "hej"?'
                  % (HEJ_YTTRE, NBSP * 4, HEJ_INRE, NBSP * 8, NBSP * 4),
                  tal(HEJ),
                  'Den inre loopen säger "hej" %d gånger varje varv, och den yttre loopen går %d varv: '
                  '%d · %d = %d.' % (HEJ_INRE, HEJ_YTTRE, HEJ_YTTRE, HEJ_INRE, HEJ)),
            skriv('Programmet:\n\nupprepa %d gånger:\n%supprepa %d gånger:\n%ssäg "hej"\n%ssäg "då"\n\n'
                  'Hur många ord säger figuren sammanlagt?'
                  % (HEJ2_YTTRE, NBSP * 4, HEJ2_INRE, NBSP * 8, NBSP * 4),
                  tal(HEJ2_ALLA),
                  '"hej" sägs %d · %d = %d gånger. "då" står i den yttre loopen men inte i den inre, så det '
                  'sägs en gång per varv, %d gånger. %d + %d = %d.'
                  % (HEJ2_YTTRE, HEJ2_INRE, HEJ2, HEJ2_YTTRE, HEJ2, HEJ2_YTTRE, HEJ2_ALLA)),
            val(robotfraga('Åt vilket håll tittar roboten när programmet är slut?', R_TVA_VANSTER),
                ['Nedåt', 'Uppåt', 'Åt vänster', 'Åt höger'], robot(R_TVA_VANSTER)[2].capitalize(),
                'Loopen går två varv, och varje varv svänger roboten vänster en gång. Två svängar åt '
                'samma håll är ett halvt varv, så den tittar nedåt.'),
            val('Programmet:\n\nsäg "A"\nupprepa 2 gånger:\n%ssäg "B"\n%ssäg "C"\nsäg "D"\n\n'
                'I vilken ordning säger figuren bokstäverna?' % (NBSP * 4, NBSP * 4),
                [SAG, 'A, B, B, C, C, D', 'A, B, C, D, B, C', 'A, B, C, D'], SAG,
                'Loopen gör B och sedan C, och sedan börjar den om: B, C igen. D står efter loopen och '
                'kommer sist.'),
            skriv('Programmet:\n\nsätt poäng till 0\nupprepa %d gånger:\n%sändra poäng med %d\n\n'
                  'Vad är poäng när programmet är slut?' % (POANG_GANGER, NBSP * 4, POANG_ANDRING),
                  tal(POANG),
                  'Poängen börjar på 0 och ökar med %d varje varv. Efter %d varv är den %d · %d = %d.'
                  % (POANG_ANDRING, POANG_GANGER, POANG_GANGER, POANG_ANDRING, POANG)),
            val('Vad kallas en loop som aldrig slutar av sig själv, som "upprepa för alltid"?',
                ['En oändlig loop', 'En nästlad loop', 'Ett villkor', 'En variabel'], 'En oändlig loop',
                'Den kallas oändlig för att den aldrig tar slut. I ett spel kan det vara bra, men om '
                'det var ett misstag fastnar programmet.'),
            val('Varför är en loop bättre än att skriva samma instruktion 100 gånger?',
                ['Programmet blir kortare och lättare att ändra', 'Datorn startar snabbare med en loop',
                 'Ett program med en loop kan aldrig få fel', 'Det går inte att skriva 100 rader'],
                'Programmet blir kortare och lättare att ändra',
                'Med en loop står instruktionen en gång. Vill du ändra något ändrar du på ett ställe, '
                'i stället för på hundra.'),
            sant('I en loop inuti en annan loop körs de inre instruktionerna lika många gånger som den '
                 'yttre loopen upprepas.', False,
                 'De körs fler gånger än så: den inre loopen går alla sina varv för varje varv i den yttre. '
                 'Upprepa 3 gånger med upprepa 2 gånger inuti blir 3 · 2 = 6 gånger.'),
        ], beskrivning='Loopar inuti loopar, och i vilken ordning saker händer.'),

        niva('prog-ak6-villkor-1', 'Om och annars', 'Villkor', [
            val('Vad gör ett villkor, som "om … annars", i ett program?',
                ['Väljer vad programmet gör beroende på om något är sant',
                 'Upprepar några instruktioner flera gånger', 'Sparar ett tal så att det går att använda',
                 'Stänger av programmet när det är klart'],
                'Väljer vad programmet gör beroende på om något är sant',
                'Ett villkor är en fråga som är sann eller falsk. Svaret bestämmer vilken väg programmet tar.'),
            val('Programmet:\n\nom temperaturen är under 0:\n%ssäg "Mössa!"\nannars:\n%ssäg "Keps!"\n\n'
                'Det är 5 grader. Vad säger programmet?' % (NBSP * 4, NBSP * 4),
                ['Keps!', 'Mössa!', 'Båda', 'Ingenting'], kladsel(5),
                '5 grader är inte under 0, så villkoret är falskt och programmet går till annars.'),
            val('Programmet:\n\nom temperaturen är under 0:\n%ssäg "Mössa!"\nannars:\n%ssäg "Keps!"\n\n'
                'Det är precis 0 grader. Vad säger programmet?' % (NBSP * 4, NBSP * 4),
                ['Keps!', 'Mössa!', 'Båda', 'Ingenting'], kladsel(0),
                '0 är inte under 0, det är lika med 0. Villkoret är falskt, så det blir annars.'),
            sant('Programmet:\n\nom poängen är större än 10:\n%ssäg "Bra!"\n\n'
                 'Poängen är 10. Programmet säger "Bra!".' % (NBSP * 4), 10 > 10,
                 '10 är inte större än 10. Villkoret är falskt, och det finns inget annars, så programmet '
                 'säger ingenting.'),
            skriv('Programmet:\n\nsätt poäng till 0\nför varje tal från 1 till 4:\n'
                  '%som talet är jämnt:\n%sändra poäng med 2\n%sannars:\n%sändra poäng med 1\n\n'
                  'Vad är poäng när programmet är slut?' % (NBSP * 4, NBSP * 8, NBSP * 4, NBSP * 8),
                  tal(JAMN_POANG),
                  '1 är udda (+1), 2 är jämnt (+2), 3 är udda (+1) och 4 är jämnt (+2): '
                  '1 + 2 + 1 + 2 = %d.' % JAMN_POANG),
            val('En robot ska bara svänga när det står en vägg framför den. Vad behöver programmet?',
                ['Ett villkor', 'En loop', 'Fler steg', 'En paus'], 'Ett villkor',
                'Roboten ska göra olika saker beroende på om det finns en vägg eller inte. Det är ett '
                'villkor: om vägg framför, sväng.'),
            para('Programmet:\n\nom temperaturen är under 0: säg "Mössa"\nannars om den är under 15: '
                 'säg "Jacka"\nannars: säg "T-shirt"\n\nPara ihop temperaturen med vad programmet säger.',
                 [('%d grader' % t, kladsel3(t)) for t in (-3, 8, 20)],
                 'Programmet prövar villkoren uppifrån. Det första som är sant bestämmer, och resten '
                 'hoppas över.'),
            sant('I ett om-annars-block körs alltid exakt en av de två delarna.', True,
                 'Är villkoret sant körs om-delen, annars körs annars-delen. Aldrig båda och aldrig ingen.'),
        ], beskrivning='Låt programmet välja väg med om och annars.'),

        niva('prog-ak6-villkor-2', 'Och, eller och inte', 'Villkor', [
            val('Programmet:\n\nom det regnar och det är kallt:\n%ssäg "Stövlar och mössa"\nannars:\n'
                '%ssäg "Skor"\n\nDet regnar men är varmt. Vad säger programmet?' % (NBSP * 4, NBSP * 4),
                ['Skor', 'Stövlar och mössa', 'Båda', 'Ingenting'],
                'Stövlar och mössa' if (True and False) else 'Skor',
                'Med "och" måste båda delarna vara sanna. Det är inte kallt, så villkoret är falskt.'),
            val('Programmet:\n\nom det regnar eller det är kallt:\n%ssäg "Jacka"\nannars:\n'
                '%ssäg "Ingen jacka"\n\nDet regnar inte, men det är kallt. Vad säger programmet?'
                % (NBSP * 4, NBSP * 4),
                ['Jacka', 'Ingen jacka', 'Båda', 'Ingenting'], 'Jacka' if (False or True) else 'Ingen jacka',
                'Med "eller" räcker det att en av delarna är sann. Det är kallt, så villkoret är sant.'),
            sant('Villkoret "talet är större än 5 och mindre än 10" är sant när talet är 10.', 5 < 10 < 10,
                 '10 är inte mindre än 10. När en del av ett och-villkor är falsk är hela villkoret falskt.'),
            skriv('Hur många av talen 1 till 20 gör villkoret "talet går att dela med 3 och talet går att '
                  'dela med 2" sant?', tal(len(DELBARA)),
                  'Talet ska gå att dela med både 3 och 2, alltså med 6: %s. Det blir %d tal.'
                  % (', '.join(str(d) for d in DELBARA), len(DELBARA))),
            val('För vilket tal är villkoret "talet är större än 3 och mindre än 7" sant?',
                MELLAN_ALT, MELLAN[0],
                '3 och 7 räknas inte, för villkoret säger större än och mindre än. Av talen är det '
                'bara %d som ligger mellan.' % MELLAN[0]),
            val('Programmet:\n\nom inte dörren är öppen:\n%ssäg "Knacka"\n\nDörren är öppen. Vad säger '
                'programmet?' % (NBSP * 4),
                ['Ingenting', 'Knacka', 'Öppen', 'Knacka två gånger'], 'Ingenting',
                '"inte" vänder på svaret. Dörren är öppen, så "inte öppen" är falskt, och instruktionen '
                'inuti körs inte.'),
            sant('Spelet har villkoret "om poängen är minst 10 eller livet är 0: avsluta spelet". '
                 'Poängen är 7 och livet är 0. Spelet avslutas.', SPELET_SLUTAR,
                 'Poängen är inte minst 10, men livet är 0. Med "eller" räcker det att en del är sann.'),
            val('Programmet:\n\nom talet är större än 10:\n%ssäg "A"\nannars om talet är större än 5:\n'
                '%ssäg "B"\nannars:\n%ssäg "C"\n\nTalet är 12. Vad säger programmet?'
                % (NBSP * 4, NBSP * 4, NBSP * 4),
                ['A', 'B', 'A och B', 'C'], a_b_c(12),
                '12 är större än 10, så programmet säger A. Då hoppas resten över, fast 12 också är '
                'större än 5.'),
        ], beskrivning='Villkor med och, eller och inte.'),

        niva('prog-ak6-felsokning-1', 'Hitta buggen', 'Felsökning', [
            val('Vad kallas ett fel i ett program?',
                ['En bugg', 'En loop', 'En algoritm', 'En variabel'], 'En bugg',
                'Ett fel i ett program kallas bugg, och att leta efter och rätta fel kallas felsökning.'),
            val('Lisa vill att roboten ska rita en kvadrat. Programmet:\n\n%s\n\nVad är felet?'
                % robottext(R_TRE),
                ['Loopen upprepas 3 gånger i stället för 4', 'Roboten svänger åt fel håll',
                 'Stegen är för långa för en kvadrat', 'Programmet saknar en loop'],
                'Loopen upprepas 3 gånger i stället för 4',
                'En kvadrat har 4 sidor. Med 3 varv ritar roboten bara tre av dem.'),
            val('Roboten ska gå 3 steg fram och sedan tillbaka till start. Programmet:\n\n%s\n\n'
                'Vilken ändring gör att roboten kommer tillbaka till start?' % robottext(R_TILLBAKA),
                list(TILLBAKA_FORSLAG), 'Byt sväng höger mot två sväng höger i rad',
                'För att gå tillbaka måste roboten vända sig om helt, ett halvt varv. Det är två svängar '
                'åt samma håll. Med en sväng går den åt sidan.'),
            sant('Ett program som inte visar något felmeddelande gör alltid det man ville.', False,
                 'Ett program kan köra utan felmeddelande och ändå göra fel sak, till exempel gå åt fel '
                 'håll. Därför måste man testa vad det faktiskt gör.'),
            val('Programmet ska säga "Hej" tre gånger, men säger det bara en gång:\n\n'
                'upprepa 3 gånger:\n%svänta 1 sekund\nsäg "Hej"\n\nVad är felet?' % (NBSP * 4),
                ['säg "Hej" står utanför loopen', 'Loopen upprepas för få gånger',
                 'vänta 1 sekund ska tas bort', 'säg "Hej" ska stå före loopen'],
                'säg "Hej" står utanför loopen',
                'Bara det som står indraget under upprepa ligger i loopen. säg "Hej" står efter loopen '
                'och körs därför en gång.'),
            ordna('Ordna stegen när du felsöker ett program.',
                  ['Testa programmet', 'Se var det blir fel', 'Ändra en sak', 'Testa igen'],
                  forklaring='Först måste du se felet. Ändra sedan en sak i taget och testa igen, så vet '
                             'du vilken ändring som hjälpte.'),
            val('Roboten tittar uppåt och ska till stjärnan, 2 rutor upp och 2 rutor åt höger. '
                'Programmet:\n\n%s\n\nVad är felet?' % robottext(R_STJARNA),
                list(STJARNA_FORSLAG), 'sväng vänster ska vara sväng höger',
                'Roboten går rätt upp, men svänger vänster och hamnar 2 rutor åt vänster. Med en '
                'sväng höger går den åt rätt håll.'),
            val('Ett långt program fungerar inte. Vad är bäst att göra först?',
                ['Testa en liten del i taget', 'Skriva om hela programmet från början',
                 'Lägga till fler instruktioner', 'Köra det många gånger utan att ändra'],
                'Testa en liten del i taget',
                'Testar du en del i taget ser du var felet finns. Att skriva om allt kan ge nya fel.'),
        ], beskrivning='Hitta och rätta fel i blockprogram.'),

        niva('prog-ak6-felsokning-2', 'Följ programmet', 'Felsökning', [
            skriv('Programmet:\n\nsätt poäng till 0\nändra poäng med 3\nändra poäng med 3\n'
                  'sätt poäng till 1\nändra poäng med 2\n\nVad är poäng när programmet är slut?',
                  tal(spara_poang()),
                  '"sätt" byter ut värdet, "ändra" lägger till. Efter två ändringar är poängen 6, men '
                  'sedan sätts den till 1, och 1 + 2 = %d.' % spara_poang()),
            skriv('Programmet:\n\nsätt tal till 1\nupprepa 4 gånger:\n%ssätt tal till tal · 2\n\n'
                  'Vad är tal när programmet är slut?' % (NBSP * 4),
                  tal(dubblingar()),
                  'Talet dubblas fyra gånger: 1, 2, 4, 8, %d.' % dubblingar()),
            val('Programmet ska säga 1, 2, 3, 4, 5, men säger 0, 1, 2, 3, 4:\n\nsätt tal till 0\n'
                'upprepa 5 gånger:\n%ssäg tal\n%sändra tal med 1\n\nVilken ändring rättar felet?'
                % (NBSP * 4, NBSP * 4),
                list(RAKNA_FORSLAG), 'Byt plats på säg tal och ändra tal med 1',
                'Programmet säger talet innan det ökar. Ökar det först säger det 1 första gången och 5 '
                'sista.'),
            sant('Om man ändrar fem saker på en gång och programmet börjar fungera, vet man säkert vilken '
                 'ändring som löste felet.', False,
                 'Det kan vara vilken som helst av de fem, eller flera tillsammans. Ändra en sak i taget.'),
            skriv('Programmet:\n\nsätt poäng till 0\nför varje tal från 1 till 6:\n%som talet är större '
                  'än 4:\n%sändra poäng med 10\n%sannars:\n%sändra poäng med 1\n\n'
                  'Vad är poäng när programmet är slut?' % (NBSP * 4, NBSP * 8, NBSP * 4, NBSP * 8),
                  tal(STORA_SMA),
                  'Talen 1, 2, 3 och 4 ger 1 poäng var, 4 poäng. 5 och 6 är större än 4 och ger 10 var, '
                  '20 poäng. 4 + 20 = %d.' % STORA_SMA),
            skriv('Programmet:\n\nsätt x till 5\nsätt y till x\nsätt x till 8\nsäg y\n\n'
                  'Vilket tal säger programmet?', tal(KOPIA),
                  'y får det värde x har just då, 5. Att x ändras till 8 efteråt ändrar inte y.'),
            val(robotfraga('Åt vilket håll tittar roboten när programmet är slut?', R_TRE_VANSTER),
                ['Åt höger', 'Åt vänster', 'Uppåt', 'Nedåt'], robot(R_TRE_VANSTER)[2].capitalize(),
                'Tre svängar åt vänster är tre kvarts varv. Det är samma sak som en sväng åt höger.'),
            val('Vad betyder det att testa ett program?',
                ['Köra det och se om det gör det man ville', 'Skriva programmet en gång till',
                 'Läsa programmet högt för någon', 'Göra programmet så kort som möjligt'],
                'Köra det och se om det gör det man ville',
                'Att testa är att köra programmet och jämföra vad det gör med vad det skulle göra. '
                'Så hittar man buggarna.'),
        ], beskrivning='Följ ett program steg för steg och se vad det gör.'),
    ]),

    bana('Programmering', 'ak9', [
        niva('prog-ak9-variabler-1', 'Variabler och värden', 'Variabler', [
            vad_skrivs(K_PLUS,
                       'x är 5. Raden x = x + 3 räknar ut 5 + 3 och sparar svaret i x igen.'),
            vad_skrivs(K_KOPIA,
                       'b får värdet a har just då, 4. När a sedan blir 10 ändras inte b.'),
            val('Vilken datatyp har värdet "12", med citattecknen?',
                list(DATATYP), [k for k, v in DATATYP.items() if v == type("12").__name__][0],
                'Citattecknen gör det till text, en sträng. Det ser ut som ett tal, men Python räknar '
                'inte med det.'),
            val('Vilken datatyp har värdet 3.5?',
                list(DATATYP), [k for k, v in DATATYP.items() if v == type(3.5).__name__][0],
                'Ett tal med decimaler är ett flyttal, float. I Python skrivs decimalerna med punkt.'),
            vad_skrivs(K_TEXTPLUS,
                       'Båda är text, för de står inom citattecken. + på text sätter ihop texterna, '
                       'det räknar inte. "3" och "4" blir "34".'),
            vad_skrivs(K_REST,
                       '% ger resten vid division. 17 delat med 5 är 3 med resten 2.'),
            vad_skrivs(K_HELTALSDIV,
                       '// delar och stryker decimalerna. 17 / 5 är 3,4, och // ger 3.'),
            sant('Variabelnamnet 2poang går att använda i Python.', felet('2poang = 5') is None,
                 'Ett variabelnamn får inte börja med en siffra. poang2 går bra, 2poang ger ett syntaxfel.'),
            para('Para ihop värdet med dess datatyp i Python.', PARA_TYPER,
                 'True och False är bool. Ett tal utan decimaler är int, med decimaler float, och allt '
                 'inom citattecken är text, str.'),
            ordna('Byt värdena i a och b, så att a blir 2 och b blir 1. Från början är a = 1 och b = 2. '
                  'Ordna raderna.', BYT_RADER,
                  forklaring='Värdet i a måste sparas i temp först. Annars skrivs det över när a = b '
                             'körs, och det går inte att få tillbaka.'),
        ], beskrivning='Variabler, tilldelning och datatyperna int, float, str och bool.'),

        niva('prog-ak9-variabler-2', 'Text och tal', 'Variabler', [
            vad_skrivs(K_INT,
                       'int("5") gör om texten "5" till talet 5. Sedan går det att räkna: 5 + 2 = 7.'),
            vad_skrivs(K_GANGER,
                       'Text gånger ett tal upprepar texten. "5" * 3 blir "555", inte 15.'),
            val(fraga_kod('Vad händer när koden körs?', K_ALDER),
                ['Ett fel: text och tal går inte att sätta ihop med +', 'Ålder: 14', 'Ålder: + 14',
                 'Ålder:14'],
                'Ett fel: text och tal går inte att sätta ihop med +',
                'Python ger ett TypeError. Skriv str(14) eller "14", så blir båda text och går att '
                'sätta ihop.'),
            vad_skrivs(K_LEN,
                       'len() räknar tecknen i texten. "programmering" har %s bokstäver.'
                       % utskrift(K_LEN)),
            vad_skrivs(K_NAMN,
                       'Tre texter sätts ihop till en: "Hej " + "Sara" + "!". Mellanslaget står i '
                       '"Hej ".', fler=['Hej Sara']),
            vad_skrivs(K_DELAT,
                       '/ ger alltid ett decimaltal i Python, också när talen är heltal. 10 / 4 = 2,5, '
                       'och Python skriver 2.5.', fler=['2,5']),
            vilket_skrivs(K_OKA, ['11', '14', '24'],
                          'x += 2 betyder x = x + 2, och x *= 4 betyder x = x * 4. 3 + 2 = 5, och '
                          '5 · 4 = %s.' % utskrift(K_OKA)),
            vilket_skrivs(K_BOOL, ['True', '5', 'Ett fel'],
                          'and kräver att båda delarna är sanna. 5 > 3 är sant, men 2 > 4 är falskt, '
                          'så hela uttrycket är False.'),
            sant('input() ger alltid en text (str), även när man skriver in en siffra.', True,
                 'Allt som skrivs in blir text. Ska du räkna med det måste du göra om det, till exempel '
                 'med int().'),
        ], beskrivning='Räkna med tal, sätt ihop text och gör om mellan dem.'),

        niva('prog-ak9-villkor-och-loopar-1', 'if och for', 'Villkor och loopar', [
            vilket_skrivs(K_RANGE4, ['1, 2, 3, 4', '0, 1, 2, 3, 4', '1, 2, 3'],
                          'range(4) börjar på 0 och slutar före 4. Loopen går fyra varv: 0, 1, 2, 3.'),
            vad_skrivs(K_SUMMA,
                       'range(1, 5) ger 1, 2, 3 och 4, inte 5. Summan blir 1 + 2 + 3 + 4 = %s.'
                       % utskrift(K_SUMMA)),
            vilket_skrivs(K_ELIF, ['stor', 'liten', 'mellan, liten'],
                          '7 är inte större än 10, men större än 5, så elif-delen körs. Efter den '
                          'hoppas else över.'),
            vilket_skrivs(K_STEG3, ['2, 5, 8, 11', '2, 3, 4, 5, 6, 7, 8, 9', '3, 6, 9'],
                          'range(2, 10, 3) börjar på 2 och tar steg om 3: 2, 5, 8. Nästa, 11, är inte '
                          'mindre än 10.'),
            vad_skrivs(K_WHILE,
                       'n dubblas så länge n är mindre än 50: 1, 2, 4, 8, 16, 32, 64. När n är 64 är '
                       'villkoret falskt, och loopen slutar.'),
            ordna('Ordna raderna så att programmet skriver ut 10.', TIO_RADER,
                  forklaring='tal måste få ett värde innan det går att räkna med, och print ska stå sist, '
                             'när tal redan har dubblats.'),
            sant('Loopen for i in range(5): kör sina rader 5 gånger.',
                 len(rader('for i in range(5):\n    print(i)')) == 5,
                 'range(5) ger talen 0, 1, 2, 3 och 4. Det är fem tal, alltså fem varv.'),
            skriv(fraga_kod('Hur många gånger skrivs Hej ut?', K_NASTLAD), tal(len(rader(K_NASTLAD))),
                  'Den inre loopen går 4 varv för vart och ett av den yttre loopens 3 varv: 3 · 4 = %d.'
                  % len(rader(K_NASTLAD))),
        ], beskrivning='if, elif, else och for-loopar med range.'),

        niva('prog-ak9-villkor-och-loopar-2', 'while, listor och villkor', 'Villkor och loopar', [
            vilket_skrivs(K_TRE, ['3, 6, 9, 10', '1, 2, 3', '0, 3, 6, 9'],
                          'tal % 3 == 0 är sant när talet går att dela med 3 utan rest. Bland 1 till 10 '
                          'är det 3, 6 och 9.'),
            vad_skrivs(K_BANAN,
                       'Loopen går igenom bokstäverna b, a, n, a, n och räknar varje a. Det finns %s.'
                       % utskrift(K_BANAN)),
            vad_skrivs(K_BREAK,
                       'while True går för alltid, tills break. i ökar till 1, 2, 3 och 4, och när i är '
                       '4 bryter break loopen.'),
            vilket_skrivs(K_OCH, ['B', 'A, B', 'Ingenting'],
                          '15 är större än 10 och mindre än 20. Båda delarna är sanna, så if-delen körs.'),
            vad_skrivs(K_STORST,
                       'storst börjar på det första talet, 4. Varje gång ett tal är större byts det: '
                       'först 9, och 2 och 7 är mindre än 9.'),
            vilket_skrivs(K_NED, ['10, 8, 6, 4, 2, 0', '8, 6, 4, 2', '10, 9, 8, 7, 6, 5, 4, 3, 2, 1'],
                          'range(10, 0, -2) räknar nedåt med steg om 2 och slutar före 0.'),
            vilket_skrivs(K_INTE, ['False', 'Ett fel', '3'],
                          '3 > 5 är falskt, och not vänder på det. not False är True.'),
            sant(fraga_kod('Den här loopen tar aldrig slut.', K_OANDLIG), True,
                 'x är 0 och ändras aldrig i loopen, så x < 10 är alltid sant. Det behövs en rad som '
                 'x = x + 1 i loopen.'),
        ], beskrivning='while-loopar, break, listor och villkor med and och not.'),

        niva('prog-ak9-funktioner-1', 'Egna funktioner', 'Funktioner', [
            vad_skrivs(K_DUBBLA,
                       'dubbla(7) kör funktionen med x = 7, och return skickar tillbaka 7 * 2 = 14.'),
            vad_skrivs(K_HALSA,
                       'namn får värdet "Ali", och funktionen ger tillbaka "Hej " + "Ali".'),
            val('Vad är en parameter i en funktion?',
                ['Ett värde som funktionen tar emot när den anropas', 'Det som funktionen ger tillbaka',
                 'Namnet på själva funktionen', 'En loop som står inuti funktionen'],
                'Ett värde som funktionen tar emot när den anropas',
                'I def dubbla(x) är x parametern. När du skriver dubbla(7) får x värdet 7.'),
            vad_skrivs(K_AREA,
                       'area(3, 5) ger 15 och area(2, 2) ger 4. 15 + 4 = %s.' % utskrift(K_AREA)),
            sant(fraga_kod('Koden skriver ut Hej!', K_DEF_UTAN_ANROP), kor(K_DEF_UTAN_ANROP) != '',
                 'def skapar bara funktionen. Den körs först när någon anropar den, med hej().'),
            para('Para ihop ordet i Python med vad det gör.',
                 [('def', 'Skapar en funktion'), ('return', 'Skickar tillbaka ett värde ur en funktion'),
                  ('print', 'Skriver ut något på skärmen'), ('range', 'Ger en följd av heltal')],
                 'def och return hör till funktioner. print visar något, och range ger talen som en '
                 'for-loop går igenom.'),
            vilket_skrivs(K_NONE, ['4, 4', '4', '3, None'],
                          'f skriver ut 4 men har ingen return. En funktion utan return ger None, så y '
                          'blir None.'),
            vad_skrivs(K_MAX,
                       '4 > 9 är falskt, så den första return körs inte. Funktionen fortsätter och '
                       'ger tillbaka b, 9.'),
        ], beskrivning='def, parametrar och return.'),

        niva('prog-ak9-funktioner-2', 'Funktioner som arbetar', 'Funktioner', [
            vad_skrivs(K_SUMMA_LISTA,
                       'Funktionen lägger ihop talen i listan ett i taget: 3 + 5 + 8 = %s.'
                       % utskrift(K_SUMMA_LISTA)),
            vad_skrivs(K_POTENS,
                       'potens(3) använder n = 2, eftersom inget annat anges: 3² = 9. potens(2, 3) är '
                       '2³ = 8. 9 + 8 = %s.' % utskrift(K_POTENS)),
            vilket_skrivs(K_SCOPE, ['5', 'Ett fel', 'None'],
                          'x = 5 inuti funktionen skapar en ny x som bara finns i funktionen. x utanför '
                          'är fortfarande 10.'),
            vilket_skrivs(K_JAMN, ['True', '1', '7'],
                          '7 % 2 är 1, inte 0, så n % 2 == 0 är falskt. Funktionen ger tillbaka False.'),
            vilket_skrivs(K_PRIS, ['90, 100', '72, 80', '80, 80'],
                          '9 är mindre än 10, så det blir 9 · 10 = 90. 10 är minst 10, så det blir '
                          '10 · 8 = 80.'),
            vad_skrivs(K_ANROPAR,
                       'fyrdubbla anropar dubbla två gånger: dubbla(5) är 10, och dubbla(10) är 20.'),
            val('Varför använder man funktioner?',
                ['För att kunna använda samma kod flera gånger', 'För att programmet ska bli långsammare',
                 'För att variabler inte ska behövas', 'För att loopar inte fungerar utan dem'],
                'För att kunna använda samma kod flera gånger',
                'En funktion skrivs en gång och anropas där den behövs. Blir något fel rättar du det på '
                'ett ställe.'),
            sant('En funktion kan anropa en annan funktion.', True,
                 'Det är vanligt. fyrdubbla anropar dubbla, och print är också en funktion som '
                 'anropas i många andra.'),
        ], beskrivning='Funktioner med listor, förval och egna variabler.'),

        niva('prog-ak9-felsokning-1', 'Hitta buggen', 'Felsökning', [
            val(fraga_kod('Vad är fel i koden?', K_PARENTES),
                ['Ett syntaxfel: en parentes saknas', 'Hej måste stå utan citattecken',
                 'print skrivs med stor bokstav', 'Inget, den skriver ut Hej'],
                'Ett syntaxfel: en parentes saknas',
                'Varje parentes som öppnas måste stängas. Utan ) kan Python inte läsa raden och ger '
                'ett SyntaxError.'),
            val(fraga_kod('Koden ska räkna ut 1 + 2 + … + 10, men skriver ut %s. Vad är felet?'
                          % utskrift(K_SUMMA10), K_SUMMA10),
                ['range(1, 10) tar inte med 10', 'summa ska börja på 1',
                 'print ska stå inuti loopen', 'summa = summa + i räknar fel'],
                'range(1, 10) tar inte med 10',
                'range slutar före det sista talet. Med range(1, 11) kommer 10 med, och summan blir %s.'
                % utskrift(K_SUMMA10_RATT)),
            # Inte samma kod som frågan före: den säger själv att utskriften är 45,
            # och i Mästarprovet kan de två stå efter varandra.
            vad_skrivs(K_SUMMA2_7,
                       'range(2, 8) ger 2 till 7, inte 8. 2 + 3 + 4 + 5 + 6 + 7 = %s.' % utskrift(K_SUMMA2_7),
                       fraga='Vad skrivs ut?'),
            val(fraga_kod('Koden ger ett NameError. Varför?', K_NAMEERROR),
                ['poang har inte fått något värde än', 'poang är ett förbjudet namn',
                 'print kan inte skriva ut tal', 'Talet 10 är för stort'],
                'poang har inte fått något värde än',
                'Python kör raderna uppifrån. När print körs finns poang inte än. Byt plats på raderna.'),
            val(fraga_kod('Vad är fel i koden?', K_INDRAG),
                ['print(i) saknar indrag', 'range(3) ska vara range(1, 3)', 'Kolon ska inte stå efter for',
                 'i är ett förbjudet namn'],
                'print(i) saknar indrag',
                'Det som ska ingå i loopen måste stå indraget under for. Annars ger Python ett '
                'IndentationError.'),
            sant('I Python jämför = två värden, och == ger en variabel ett värde.', False,
                 'Det är tvärtom: x = 5 ger x värdet 5, och x == 5 frågar om x är 5.'),
            val(fraga_kod('Koden ska räkna ut medelvärdet av 8 och 6, men skriver ut %s. Vilken rad '
                          'räknar rätt?' % utskrift(K_MEDEL), K_MEDEL),
                list(MEDEL_FORSLAG), 'medel = (8 + 6) / 2',
                'Division räknas före addition. Utan parentes blir det 8 + 3 = 11. Med (8 + 6) / 2 '
                'delas summan, 14 / 2 = 7.'),
            val(fraga_kod('Koden ger ett IndexError. Varför?', K_INDEX),
                ['Listan har ingen plats 3, den sista är frukter[2]', 'Listan är tom',
                 'Frukterna måste stå utan citattecken', 'frukter[3] ger "banan"'],
                'Listan har ingen plats 3, den sista är frukter[2]',
                'Platserna i en lista räknas från 0. Tre frukter har platserna 0, 1 och 2.'),
        ], beskrivning='Syntaxfel, felmeddelanden och fel som inte syns förrän man testar.'),

        niva('prog-ak9-felsokning-2', 'Följ koden', 'Felsökning', [
            vilket_skrivs(K_BYT, ['4 8', '4 3', '3 7'],
                          'Högersidan räknas ut först, med de gamla värdena: b är 4 och a + b är 7. '
                          'Sedan får a och b dem samtidigt.'),
            vad_skrivs(K_FORST_SIST,
                       'text[0] är första tecknet, N, och text[-1] är det sista, x. Tillsammans blir '
                       'det Nx.'),
            vad_skrivs(K_MINUS,
                       'i minskar med 3: 10, 7, 4, 1, %s. Först när i inte längre är större än 0 slutar '
                       'loopen.' % utskrift(K_MINUS)),
            vad_skrivs(K_APPEND,
                       'append lägger till 4 sist i listan. Nu har den fyra tal, och len räknar dem.'),
            vilket_skrivs(K_ORDLANGD, ['3', 'sol, is, hav', '3, 3, 3'],
                          'Loopen går igenom orden ett i taget och skriver ut hur många bokstäver varje '
                          'ord har.'),
            vad_skrivs(K_TVA_IF,
                       'Det är två separata if. Den första gör x till 1. När den andra prövas är x 1, '
                       'och 1 > 3 är falskt.'),
            vad_skrivs(K_BAKLANGES,
                       'Varje bokstav läggs FÖRE det som redan står i s: a, sedan ba, sedan cba.'),
            vad_skrivs(K_CONTINUE,
                       'continue hoppar till nästa varv när i är jämnt. Bara 1 och 3 läggs till: '
                       '1 + 3 = %s.' % utskrift(K_CONTINUE)),
        ], beskrivning='Räkna ut vad ett program skriver ut, rad för rad.'),
    ]),
]
