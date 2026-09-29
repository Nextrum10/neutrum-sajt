# -*- coding: utf-8 -*-
"""Matematik åk 4–6. Tabellerna, division med rest, decimaltal, bråk, procent, geometri, tid, medelvärde, negativa tal, koordinatsystem och de första ekvationerna, efter Lgr22:s centrala innehåll för mellanstadiet, med varje facit uträknat i koden."""
import re
from decimal import Decimal, ROUND_HALF_UP
from fractions import Fraction

from grund import bana, niva, val, skriv, ordna, sant, para, tal


# ---------------------------------------------------------------------
# Hjälparna. Varje facit räknas ut här i stället för att skrivas för
# hand, och varje fråga som frågar "vilken av dessa" prövar att EXAKT
# ett alternativ stämmer: två rätta svar hade betytt att barnet får
# höra att ett rätt svar är fel.
# ---------------------------------------------------------------------

def ett(alternativ, prov):
    """Det enda alternativet som klarar provet. Klarar noll eller flera
    det är frågan fel skriven, och då ska bygget stanna."""
    traffar = [a for a in alternativ if prov(a)]
    if len(traffar) != 1:
        raise ValueError('Väntade exakt ett rätt alternativ i %r, fick %r' % (alternativ, traffar))
    return traffar[0]


def ordnat(poster, nyckel):
    """Sorterade poster, och ett stopp om två har samma värde: då finns
    det mer än en rätt ordning."""
    varden = [nyckel(p) for p in poster]
    if len(set(varden)) != len(varden):
        raise ValueError('Två brickor är lika stora, ordningen är inte entydig: %r' % (poster,))
    return sorted(poster, key=nyckel)


def parvis(par, varde):
    """Paren i en matchning, prövade: varje vänstersida ska vara lika
    mycket som sin egen högersida och inte som någon annans. Hade två
    par gått att byta hade det funnits två rätta svar, och rättningen
    godtar bara det som står i paret."""
    for i, (v, _) in enumerate(par):
        for j, (_, h) in enumerate(par):
            if (varde(v) == varde(h)) != (i == j):
                raise ValueError('Matchningen är inte entydig: %r' % (par,))
    return par


def F(s):
    """Svensk text till ett exakt tal: '0,35' → 35/100, '−4' → -4, '3/4' → 3/4."""
    return Fraction(s.replace(',', '.').replace('−', '-'))


def heltal(x):
    x = Fraction(x)
    if x.denominator != 1:
        raise ValueError('Väntade ett heltal, fick %s' % x)
    return int(x)


def dec(x):
    """Ett exakt tal som decimaltal med komma: Fraction(7, 100) → '0,07'."""
    return tal(float(Fraction(x)))


def minus(x):
    """Ett tal med riktigt minustecken, för text som barnet läser."""
    return tal(x).replace('-', '−')


_ORD = ['noll', 'ett', 'två', 'tre', 'fyra', 'fem', 'sex', 'sju', 'åtta', 'nio', 'tio']


def neg_svar(x, grader=False):
    """Godtagna svar för ett negativt tal: −2 (rättningen läser -2 och
    −2 som samma sak, och godtar '−2 grader' själv), − 2, 'minus 2' och
    'minus två'. Med grader också 'minus 2 grader', '2 minusgrader' och
    '2 grader kallt'. Allt med ord jämförs bara som text, så varje form
    måste stå här."""
    svar = [minus(x)]
    if x < 0:
        n = tal(-x)
        former = [n] + ([_ORD[-x]] if -x < len(_ORD) else [])
        svar.append('− ' + n)
        svar += ['minus ' + f for f in former]
        if grader:
            svar += ['minus %s grader' % f for f in former]
            svar += ['%s minusgrader' % f for f in former]
            svar += ['%s grader kallt' % f for f in former]
    return svar


def x_svar(x):
    """Svaret på en ekvation: 7 och 'x = 7', med eller utan mellanslag
    runt likhetstecknet. Ett svar med bokstäver jämförs som text, så
    'x =7' är inte samma svar som 'x = 7' för rättningen."""
    s = tal(x)
    return [s, 'x = ' + s, 'x=' + s, 'x =' + s, 'x= ' + s]


def brak_svar(taljare, namnare):
    """Ett bråk som svar: '4/10', med eller utan mellanslag runt
    bråkstrecket. Ett bråk jämförs som text, så '4 / 10' är inte samma
    svar som '4/10' för rättningen."""
    t, n = tal(taljare), tal(namnare)
    return [t + '/' + n, t + ' / ' + n, t + ' /' + n, t + '/ ' + n]


def avrunda(s, steg):
    """Avrundning som i skolan (5 uppåt), exakt: avrunda('3,47', '0.1') → '3,5'."""
    d = Decimal(s.replace(',', '.')).quantize(Decimal(steg), rounding=ROUND_HALF_UP)
    return str(d).replace('.', ',')


def klocka(minuter):
    """Minuter efter midnatt som klockslag: 585 → '9.45'."""
    h, m = divmod(minuter % (24 * 60), 60)
    return '%d.%02d' % (h, m)


def kl(text):
    """'9.45' → minuter efter midnatt."""
    h, m = text.split('.')
    return int(h) * 60 + int(m)


def tidslangd(minuter):
    """135 → '2 timmar och 15 minuter'."""
    h, m = divmod(minuter, 60)
    delar = []
    if h:
        delar.append('%d %s' % (h, 'timme' if h == 1 else 'timmar'))
    if m:
        delar.append('%d %s' % (m, 'minut' if m == 1 else 'minuter'))
    return ' och '.join(delar)


def kr(ore):
    return '%d,%02d kr' % divmod(ore, 100)


def lista(delar):
    """['a', 'b', 'c'] → 'a, b och c'."""
    delar = list(delar)
    return delar[0] if len(delar) == 1 else ', '.join(delar[:-1]) + ' och ' + delar[-1]


def andel(s):
    """Värdet av '30 %', '3/4' eller '0,2' som ett exakt tal."""
    if s.endswith('%'):
        return Fraction(int(s[:-1].strip()), 100)
    return F(s)


def procent_av(p, tal_):
    return heltal(Fraction(p, 100) * tal_)


# Enheterna i en fråga om mått, med hur många av grundenheten de är:
# centimeter för längd och deciliter för volym.
_ENHET = {'m': ('längd', 100), 'dm': ('längd', 10), 'cm': ('längd', 1),
          'l': ('volym', 10), 'dl': ('volym', 1)}


def matt(s):
    """Ett mått som text, exakt i grundenheten: '1,2 m' → ('längd', 120),
    '5 dl' → ('volym', 5). Storheten följer med, så att en längd aldrig
    kan räknas som lika med en volym."""
    t, enhet = s.rsplit(' ', 1)
    storhet, faktor = _ENHET[enhet]
    return storhet, F(t) * faktor


def cm(s):
    """En längd som text i hela centimeter: '0,4 m' → 40."""
    storhet, varde = matt(s)
    if storhet != 'längd':
        raise ValueError('%r är ingen längd' % s)
    return heltal(varde)


def vinkelsort(v):
    if v < 90:
        return 'Spetsig'
    if v == 90:
        return 'Rät'
    if v < 180:
        return 'Trubbig'
    return 'Rak'


# ---------------------------------------------------------------------
# Åk 4
# ---------------------------------------------------------------------

def _ak4_multiplikation():
    ut = [(6, 7), (8, 5), (9, 4), (7, 7)]
    ut = ordnat(ut, lambda p: p[0] * p[1])
    nian = ['27', '54', '64', '72']
    return niva('ma-ak4-multiplikation-1', 'Tabellerna 6–9', 'Multiplikation', [
        val('Vad är 7 · 8?', [54, 56, 58, 63], 7 * 8,
            'Sju åttor är 56. Ett knep att minnas: 5, 6, 7, 8 – alltså 56 = 7 · 8.'),
        skriv('Vad är 6 · 9?', tal(6 * 9),
              'Tänk 6 · 10 = 60 och ta bort en sexa: 60 − 6 = %s.' % tal(6 * 10 - 6)),
        val('Vad är 9 · 9?', [18, 72, 81, 91], 9 * 9,
            'Nio nior är 81. Tänk 9 · 10 = 90 och ta bort en nia: 90 − 9 = %s.' % tal(90 - 9)),
        skriv('Vad är 8 · 6?', tal(8 * 6),
              'Dubbla 4 · 6 = 24 så får du 8 · 6 = %s.' % tal(2 * 4 * 6)),
        val('Vilket tal saknas? 7 · ? = 42', [5, 6, 7, 8], heltal(Fraction(42, 7)),
            '7 · 6 = 42, så det saknade talet är 6. Du kan också räkna 42 / 7.'),
        skriv('En kartong har 8 ägg. Hur många ägg finns det i 7 kartonger?', tal(7 * 8),
              'Det är 7 grupper med 8 ägg i varje, alltså 7 · 8 = %s ägg.' % tal(7 * 8)),
        ordna('Ordna uttrycken efter hur stort svaret blir, minst först.',
              ['%d · %d' % p for p in ut],
              forklaring='Räkna ut varje: %s.' % lista('%d · %d = %d' % (a, b, a * b) for a, b in ut)),
        val('Vilket tal finns INTE i 9:ans tabell?', nian, ett(nian, lambda a: int(a) % 9 != 0),
            'I 9:ans tabell upp till 90 blir siffrorna tillsammans 9, som 2 + 7 och 5 + 4. '
            'Men 6 + 4 = 10, så 64 är inte med.'),
    ], beskrivning='Multiplikationstabellerna 6 till 9 och knep för att räkna ut ett svar man glömt.')


def _ak4_division():
    kvot, rest = divmod(17, 5)
    div = ['14 / 5', '13 / 4', '17 / 7', '20 / 6']

    def delar(t):
        a, b = (int(x) for x in t.split(' / '))
        return a, b

    div = ordnat(div, lambda t: delar(t)[0] % delar(t)[1])
    jamna = ['36 / 5', '42 / 8', '45 / 9', '50 / 7']
    kulor, over = divmod(29, 6)
    askar, pennor_over = divmod(50, 8)
    bilar = -(-30 // 4)
    return niva('ma-ak4-division-1', 'Division med rest', 'Division', [
        val('Dela 17 med 5. Vad blir svaret?', ['3 rest 2', '3 rest 3', '2 rest 7', '4 rest 3'],
            '%d rest %d' % (kvot, rest),
            '5 · 3 = 15 och 17 − 15 = 2. Resten måste vara mindre än 5.'),
        skriv('Vad blir resten när du delar 23 med 4?', tal(23 % 4),
              '4 · 5 = 20 och 23 − 20 = %s. Det är resten.' % tal(23 - 20)),
        skriv('6 barn delar lika på 29 kulor. Hur många kulor får varje barn?', tal(kulor),
              '6 · 4 = 24, men 6 · 5 = 30 är för mycket. Varje barn får %d kulor och %d blir över.'
              % (kulor, over)),
        val('Vilken rest är omöjlig när man delar med 4?', ['0', '1', '3', '4'],
            ett(['0', '1', '3', '4'], lambda a: int(a) >= 4),
            'Resten måste alltid vara mindre än talet man delar med. Blir 4 över räcker det till en fyra till.'),
        val('30 elever ska åka bil. I varje bil får 4 elever plats. Hur många bilar behövs?',
            [2, 7, 8], bilar,
            '30 / 4 = 7 rest 2. Sju bilar räcker till 28 elever, och de 2 som är kvar behöver en bil till.'),
        skriv('50 pennor läggs i askar med 8 pennor i varje. Hur många askar blir helt fulla?',
              tal(askar),
              '8 · 6 = 48, men 8 · 7 = 56 är för mycket. %d askar blir fulla och %d pennor blir över.'
              % (askar, pennor_over)),
        ordna('Ordna divisionerna efter hur stor resten blir, minst rest först.', div,
              forklaring='%s.' % lista('%s = %d rest %d' % ((t,) + divmod(*delar(t))) for t in div)),
        val('Vilken division går jämnt ut, utan rest?', jamna,
            ett(jamna, lambda t: delar(t)[0] % delar(t)[1] == 0),
            '9 · 5 = 45, så 45 / 9 = 5 och ingenting blir över.'),
    ], beskrivning='Division som inte går jämnt ut, och vad man gör med det som blir över.')


def _ak4_tiondelar():
    storst = ['0,8', '1,1', '0,9', '1,0']
    tallinje = ['2,1', '0,3', '1,2', '0,8', '1,7']
    tallinje = ordnat(tallinje, F)
    halvvags = ['2,5', '2,2', '2,05', '25']
    summa = ['0,10', '0,37', dec(F('0,3') + F('0,7'))]
    return niva('ma-ak4-decimaltal-1', 'Tiondelar', 'Decimaltal', [
        val('Hur skrivs sju tiondelar som decimaltal?', ['0,7', '7,0', '0,07', '70'], dec(Fraction(7, 10)),
            'Första siffran efter kommat visar tiondelar. Sju tiondelar skrivs 0,7.'),
        skriv('Hur många tiondelar är 1,3?', tal(heltal(F('1,3') * 10)),
              'En hel är 10 tiondelar. 10 + 3 = 13 tiondelar.'),
        val('Vilket tal är störst?', storst, max(storst, key=F),
            '1,1 är en hel och en tiondel till. De andra talen är högst en hel.'),
        skriv('Vad är 0,6 + 0,5?', dec(F('0,6') + F('0,5')),
              '6 tiondelar + 5 tiondelar = 11 tiondelar. Det är en hel och en tiondel: 1,1.'),
        val('Vilket tal ligger mitt emellan 2 och 3 på tallinjen?', halvvags,
            ett(halvvags, lambda a: F(a) == Fraction(2 + 3, 2)),
            'Mellan 2 och 3 finns tio tiondelar. Mitten är efter fem av dem: 2,5.'),
        skriv('Ett band är 1 meter långt. Du klipper av 0,4 meter. Hur många meter är kvar?',
              dec(1 - F('0,4')),
              '1 meter är 10 tiondelar. 10 − 4 = 6 tiondelar, alltså 0,6 meter.'),
        ordna('Ordna talen från minst till störst.', tallinje,
              forklaring='Titta först på talet före kommat. Är det lika, jämför tiondelarna efter kommat.'),
        val('Vad är 0,3 + 0,7?', summa, dec(F('0,3') + F('0,7')),
            '3 tiondelar + 7 tiondelar = 10 tiondelar. Tio tiondelar är en hel, alltså 1.'),
    ], beskrivning='Tiondelar som decimaltal, deras plats på tallinjen och enkel addition och subtraktion.')


def _ak4_tiondelar_vardag():
    meter = parvis([(m, '%s cm' % tal(cm(m))) for m in ['0,5 m', '0,8 m', '1,2 m', '2,3 m']], matt)
    langst = ['98 cm', '1,2 m', '115 cm', '1,1 m']
    rad = ordnat(['0,4 m', '35 cm', '1 m', '0,9 m', '95 cm'], cm)
    kanna = F('0,6') + F('0,8')
    return niva('ma-ak4-decimaltal-2', 'Tiondelar i vardagen', 'Decimaltal', [
        para('Para ihop varje längd i meter med samma längd i centimeter.', meter,
             'En meter är 100 cm, så en tiondels meter är 10 cm. 0,8 m är 8 · 10 = %s cm, '
             'och 2,3 m är 200 + 30 = %s cm.' % (tal(cm('0,8 m')), tal(cm('2,3 m')))),
        skriv('Hur många centimeter är 0,7 meter?', tal(cm('0,7 m')),
              'En tiondels meter är 10 cm. 7 tiondelar är 7 · 10 = %s cm.' % tal(cm('0,7 m'))),
        sant('1,5 meter är lika långt som 1 meter och 5 centimeter.', cm('1,5 m') == cm('1 m') + 5,
             'Femman står på tiondelarnas plats. 0,5 meter är 5 tiondels meter, alltså %s cm. '
             'Därför är 1,5 meter 1 meter och %s centimeter.' % (tal(cm('0,5 m')), tal(cm('0,5 m')))),
        sant('0,5 liter är lika mycket som 5 deciliter.', matt('0,5 l') == matt('5 dl'),
             'En liter är 10 deciliter, så en deciliter är en tiondels liter. '
             '0,5 liter är 5 tiondelar, alltså 5 dl.'),
        skriv('En flaska rymmer 1,5 liter. Hur många deciliter är det?', tal(heltal(matt('1,5 l')[1])),
              '1 liter är 10 dl och 0,5 liter är 5 dl. 10 + 5 = %s dl.' % tal(heltal(matt('1,5 l')[1]))),
        val('Vilken längd är längst?', langst, ett(langst, lambda s: cm(s) == max(cm(t) for t in langst)),
            'Gör om till centimeter: 1,2 m = %d cm och 1,1 m = %d cm. %d cm är längre än både 115 cm och 98 cm.'
            % (cm('1,2 m'), cm('1,1 m'), cm('1,2 m'))),
        ordna('Ordna längderna från kortast till längst.', rad,
              forklaring='Gör om allt till centimeter: %s cm. Då går de lätt att jämföra.'
              % lista(tal(cm(s)) for s in rad)),
        skriv('Du häller 0,6 liter vatten och 0,8 liter saft i en kanna. Hur många liter blir det?', dec(kanna),
              '6 tiondelar + 8 tiondelar = %d tiondelar. Tio tiondelar är en hel liter, så det blir %s liter.'
              % (heltal(kanna * 10), dec(kanna))),
    ], beskrivning='Tiondelar i meter och liter, och att byta mellan meter och centimeter och mellan liter och deciliter.')


def _ak4_omkrets_area():
    rekt = [(1, 9), (3, 7), (5, 5), (2, 8)]
    if len({2 * (a + b) for a, b in rekt}) != 1:
        raise ValueError('Rektanglarna ska ha samma omkrets')
    rekt = ordnat(rekt, lambda p: p[0] * p[1])
    return niva('ma-ak4-geometri-1', 'Omkrets och area', 'Geometri', [
        val('Vad är omkretsen av en rektangel?',
            ['Sträckan runt hela figuren', 'Hur stor yta figuren täcker', 'Den längsta sidan',
             'Längden gånger bredden'],
            'Sträckan runt hela figuren',
            'Omkretsen är sträckan runt om, som ett staket runt en trädgård. Ytan inuti kallas area.'),
        skriv('En rektangel är 6 cm lång och 4 cm bred. Hur många centimeter är omkretsen?',
              tal(2 * (6 + 4)),
              'Lägg ihop alla fyra sidor: 6 + 4 + 6 + 4 = %s cm.' % tal(2 * (6 + 4))),
        skriv('En rektangel är 7 cm lång och 3 cm bred. Hur många kvadratcentimeter är arean?',
              tal(7 * 3),
              'Arean är längden gånger bredden: 7 · 3 = %s cm².' % tal(7 * 3)),
        val('En kvadrat har sidan 5 cm. Hur stor är arean?', ['10 cm²', '20 cm²', '25 cm²'],
            '%d cm²' % (5 * 5),
            'Arean är sidan gånger sidan: 5 · 5 = 25 cm². 20 cm är omkretsen.'),
        val('En kvadrat har omkretsen 36 cm. Hur lång är en sida?', ['6 cm', '9 cm', '12 cm', '18 cm'],
            '%d cm' % heltal(Fraction(36, 4)),
            'En kvadrat har fyra lika långa sidor. 36 / 4 = 9 cm.'),
        skriv('En rektangel har arean 24 cm². Ena sidan är 8 cm. Hur många centimeter är den andra sidan?',
              tal(heltal(Fraction(24, 8))),
              'Längden gånger bredden ska bli 24. 8 · 3 = 24, så den andra sidan är 3 cm.'),
        ordna('Ordna rektanglarna efter hur stor arean är, minst först.',
              ['%d cm · %d cm' % p for p in rekt],
              forklaring='Areorna är %s cm². Alla fyra har omkretsen %d cm, men arean blir ändå olika.'
              % (lista(str(a * b) for a, b in rekt), 2 * (rekt[0][0] + rekt[0][1]))),
        val('Ett rum är 4 m långt och 3 m brett. Hur stor är golvets area?',
            ['7 m²', '12 m²', '14 m²', '24 m²'], '%d m²' % (4 * 3),
            'Golvets yta är en area: 4 · 3 = 12 m². 14 m är omkretsen.'),
    ], beskrivning='Omkrets och area av rektanglar och kvadrater.')


def _ak4_tid():
    film = kl('20.15') - kl('18.30')
    till_hel = kl('20.00') - kl('18.30')
    somn = kl('7.00') + 24 * 60 - kl('21.30')
    tider = [('en kvart', 15 * 60), ('90 sekunder', 90), ('2 minuter', 120),
             ('1 minut', 60), ('150 sekunder', 150)]
    tider = ordnat(tider, lambda p: p[1])
    return niva('ma-ak4-tid-1', 'Hur lång tid?', 'Tid', [
        val('Hur många minuter är en och en halv timme?', [80, 90, 130, 150], 60 + 30,
            'En timme är 60 minuter och en halv timme är 30. 60 + 30 = 90 minuter.'),
        skriv('Filmen börjar 18.30 och slutar 20.15. Hur många minuter är filmen?', tal(film),
              'Från 18.30 till 20.00 är det %d minuter, och sedan %d minuter till. %d + %d = %d minuter.'
              % (till_hel, film - till_hel, till_hel, film - till_hel, film)),
        val('Klockan är 9.45. Vad är klockan om 30 minuter?', ['9.75', '10.05', '10.15', '10.45'],
            klocka(kl('9.45') + 30),
            'Om 15 minuter är klockan 10.00, och 15 minuter till blir 10.15. En timme har 60 minuter, inte 100.'),
        skriv('Hur många sekunder är 3 minuter?', tal(3 * 60),
              'En minut är 60 sekunder. 3 · 60 = %s sekunder.' % tal(3 * 60)),
        val('Lisa somnar 21.30 och vaknar 7.00. Hur länge sover hon?',
            ['9 timmar', '9 timmar och 30 minuter', '10 timmar och 30 minuter', '14 timmar och 30 minuter'],
            tidslangd(somn),
            'Från 21.30 till midnatt är det 2 timmar och 30 minuter. Sedan 7 timmar till: %s.'
            % tidslangd(somn)),
        skriv('Hur många minuter är det från 10.35 till 11.00?', tal(kl('11.00') - kl('10.35')),
              'En timme har 60 minuter. 60 − 35 = %d minuter.' % (60 - 35)),
        ordna('Ordna tiderna från kortast till längst.', [t for t, _ in tider],
              forklaring='90 sekunder är en och en halv minut och 150 sekunder är två och en halv. '
                         'En kvart är 15 minuter.'),
        val('Ett lag tränar 45 minuter tre gånger i veckan. Hur länge tränar de sammanlagt?',
            ['1 timme och 35 minuter', '2 timmar', '2 timmar och 15 minuter', '2 timmar och 45 minuter'],
            tidslangd(3 * 45),
            '3 · 45 = %d minuter. 120 minuter är 2 timmar, och %d minuter blir kvar.'
            % (3 * 45, 3 * 45 - 120)),
    ], beskrivning='Klockslag, hur lång tid något tar och att växla mellan sekunder, minuter och timmar.')


# ---------------------------------------------------------------------
# Åk 5
# ---------------------------------------------------------------------

def _ak5_brak_1():
    stambrak = ordnat(['1/3', '1/10', '1/2', '1/5'], F)
    kvart = ['1/4', '1/15', '1/3', '15/100']
    return niva('ma-ak5-brak-1', 'Delar av en helhet', 'Bråk', [
        val('En chokladkaka har 12 rutor. Du äter 5. Hur stor del av kakan har du ätit?',
            ['5/12', '7/12', '12/5', '5/7'], '5/12',
            'Kakan har 12 lika stora rutor och 5 av dem är uppätna. Det är 5/12.'),
        skriv('Vad är 1/3 av 18?', tal(heltal(Fraction(1, 3) * 18)),
              'En tredjedel är en av tre lika delar. 18 / 3 = 6.'),
        val('Vad visar nämnaren, talet under strecket, i bråket 3/5?',
            ['Hur många lika delar helheten är delad i', 'Hur många delar man tar',
             'Hur många helheter det finns'],
            'Hur många lika delar helheten är delad i',
            'I 3/5 är helheten delad i 5 lika delar, och man tar 3 av dem. Talet över strecket heter täljare.'),
        skriv('Vad är 3/4 av 20?', tal(heltal(Fraction(3, 4) * 20)),
              'Först 1/4 av 20: 20 / 4 = 5. Tre fjärdedelar är 3 · 5 = 15.'),
        val('I en klass går 24 elever. 1/4 av dem cyklar till skolan. Hur många cyklar?',
            [4, 6, 8, 20], heltal(Fraction(1, 4) * 24),
            '1/4 betyder en av fyra lika delar. 24 / 4 = 6 elever.'),
        skriv('Hur många femtedelar behövs för att få en hel?', tal(heltal(1 / Fraction(1, 5))),
              'Delar du en hel i fem lika delar får du fem femtedelar: 5/5 = 1.'),
        ordna('Ordna bråken från minst till störst.', stambrak,
              forklaring='När täljaren är 1 gäller: ju större nämnare, desto mindre bit. '
                         'En tiondel är minst och en halv störst.'),
        val('Hur stor del av en timme är 15 minuter?', kvart,
            ett(kvart, lambda a: F(a) == Fraction(15, 60)),
            'En timme är 60 minuter. 60 / 15 = 4, så 15 minuter är en fjärdedel av timmen.'),
    ], beskrivning='Bråk som delar av en helhet och bråk av ett antal.')


def _ak5_brak_2():
    halv = ['3/6', '2/3', '1/4', '3/5']
    tre = ['3/8', '3/4', '3/5', '3/10']
    jfr = ['2/3', '3/4']
    storre = max(jfr, key=F)
    sjatte = ordnat(['5/6', '1/3', '2/3', '1/2'], F)
    fork = Fraction(6, 8)
    return niva('ma-ak5-brak-2', 'Jämför bråk', 'Bråk', [
        val('Vilket bråk är lika stort som 1/2?', halv, ett(halv, lambda a: F(a) == Fraction(1, 2)),
            '3 är hälften av 6, så 3/6 är samma sak som 1/2.'),
        skriv('Vilket tal saknas? 1/3 = ?/6', tal(heltal(Fraction(1, 3) * 6)),
              'Nämnaren har blivit dubbelt så stor, 3 · 2 = 6. Då ska täljaren också dubblas: 1 · 2 = 2.'),
        val('Vilket bråk är störst?', tre, max(tre, key=F),
            'Alla har täljaren 3. Fjärdedelar är större bitar än femtedelar, åttondelar och tiondelar.'),
        skriv('Vilket tal saknas? 3/4 = ?/12', tal(heltal(Fraction(3, 4) * 12)),
              '4 · 3 = 12, så täljaren ska också gånger 3: 3 · 3 = 9.'),
        val('Vilket är störst, 2/3 eller 3/4?', jfr + ['De är lika stora'], storre,
            'Gör om till tolftedelar: 2/3 = %d/12 och 3/4 = %d/12. %d/12 är störst.'
            % (heltal(F('2/3') * 12), heltal(F('3/4') * 12), heltal(F(storre) * 12))),
        val('Förkorta 6/8 så långt det går.', ['3/4', '3/8', '2/3', '1/2'],
            '%d/%d' % (fork.numerator, fork.denominator),
            'Både 6 och 8 går att dela med 2: 6 / 2 = 3 och 8 / 2 = 4. Alltså är 6/8 = 3/4.'),
        ordna('Ordna bråken från minst till störst.', sjatte,
              forklaring='Gör om till sjättedelar: %s. Störst är %s.'
              % (lista('%s = %d/6' % (b, heltal(F(b) * 6)) for b in sjatte[:-1]), sjatte[-1])),
        skriv('Vilket tal saknas? 2/5 = 6/?', tal(5 * heltal(Fraction(6, 2))),
              'Täljaren har blivit 3 gånger så stor, 2 · 3 = 6. Då ska nämnaren också gånger 3: 5 · 3 = 15.'),
    ], beskrivning='Att jämföra bråk och hitta bråk som är lika stora.')


def _ak5_brak_3():
    brak = parvis([(b, dec(F(b))) for b in ['1/2', '1/10', '3/10', '1/5']], F)
    fyra_femtedelar = ['0,4', '0,8', '4,5', '0,45']
    rad = ordnat(['0,7', '1/2', '1/5', '0,1', '9/10'], F)
    ella, leo = F('0,6'), F('3/5')
    vem = {'Ella': ella > leo, 'Leo': leo > ella, 'De har ätit lika mycket': ella == leo}
    if ella != leo:
        raise ValueError('Förklaringen säger att Ella och Leo har ätit lika mycket')
    return niva('ma-ak5-brak-3', 'Bråk och decimaltal', 'Bråk', [
        para('Para ihop bråket med decimaltalet som är lika stort.', brak,
             'Gör om till tiondelar: 1/2 = %d/10 = %s och 1/5 = %d/10 = %s. '
             '1/10 och 3/10 är redan tiondelar.'
             % (heltal(F('1/2') * 10), dec(F('1/2')), heltal(F('1/5') * 10), dec(F('1/5')))),
        skriv('Skriv 7/10 som decimaltal.', dec(F('7/10')),
              '7/10 är sju tiondelar. Tiondelarna står närmast efter kommat, så det blir %s.' % dec(F('7/10'))),
        sant('1/5 är lika mycket som 0,5.', F('1/5') == F('0,5'),
             '0,5 är fem tiondelar, alltså en halv. 1/5 är en av fem lika delar: 1/5 = %d/10 = %s.'
             % (heltal(F('1/5') * 10), dec(F('1/5')))),
        val('Vilket decimaltal är lika stort som 4/5?', fyra_femtedelar,
            ett(fyra_femtedelar, lambda a: F(a) == F('4/5')),
            'Förläng med 2: 4/5 = %d/10. Åtta tiondelar skrivs %s.' % (heltal(F('4/5') * 10), dec(F('4/5')))),
        skriv('Skriv 0,4 som ett bråk med nämnaren 10.', brak_svar(heltal(F('0,4') * 10), 10),
              '0,4 är fyra tiondelar, och fyra tiondelar skrivs %s.' % brak_svar(heltal(F('0,4') * 10), 10)[0]),
        sant('1/3 är mer än 0,3.', F('1/3') > F('0,3'),
             'En tiondel av 30 är %d, så 0,3 av 30 är %d. En tredjedel av 30 är %d. Alltså är 1/3 lite mer än 0,3.'
             % (heltal(F('1/10') * 30), heltal(F('0,3') * 30), heltal(F('1/3') * 30))),
        ordna('Ordna talen från minst till störst.', rad,
              forklaring='Gör om bråken till decimaltal: %s. Sedan jämför du tiondelarna.'
              % lista('%s = %s' % (t, dec(F(t))) for t in rad if '/' in t)),
        val('Ella har ätit 0,6 av en chokladkaka. Leo har ätit 3/5 av en likadan kaka. Vem har ätit mest?',
            list(vem), ett(list(vem), lambda v: vem[v]),
            '3/5 = %d/10, och sex tiondelar skrivs %s. De har alltså ätit lika mycket.'
            % (heltal(leo * 10), dec(leo))),
    ], beskrivning='Att skriva samma tal som bråk och som decimaltal, och att jämföra bråk med decimaltal.')


def _ak5_decimaltal():
    storst = ['0,5', '0,45', '0,39', '0,09']
    rad = ordnat(['0,53', '0,3', '0,08', '0,8', '0,35'], F)
    mellan = ['2,45', '2,54', '2,39', '2,6']
    return niva('ma-ak5-decimaltal-1', 'Hundradelar och avrundning', 'Decimaltal', [
        val('Vilket tal är störst?', storst, max(storst, key=F),
            '0,5 är samma som 0,50. 50 hundradelar är mer än 45 hundradelar.'),
        skriv('Hur skrivs 7 hundradelar som decimaltal?', dec(Fraction(7, 100)),
              'Andra siffran efter kommat visar hundradelar. Därför skrivs 7 hundradelar 0,07.'),
        val('Avrunda 3,47 till en decimal.', ['3,4', '3,5', '3,47', '4'], avrunda('3,47', '0.1'),
            'Titta på hundradelssiffran: 7. Den är 5 eller mer, så vi avrundar uppåt till 3,5.'),
        skriv('Avrunda 12,38 till ett heltal.', avrunda('12,38', '1'),
              'Titta på tiondelssiffran: 3. Den är mindre än 5, så vi avrundar nedåt till 12.'),
        val('En glass kostar 12,50 kr och en läsk 8,75 kr. Vad kostar de tillsammans?',
            ['20,25 kr', '21,15 kr', '21,25 kr', '22,25 kr'], kr(1250 + 875),
            '12 + 8 = 20 kronor och 50 + 75 = 125 öre, som är 1,25 kr. 20 + 1,25 = 21,25 kr.'),
        skriv('Vad är 1 − 0,35?', dec(1 - F('0,35')),
              '1 är 100 hundradelar. 100 − 35 = 65 hundradelar, alltså 0,65.'),
        ordna('Ordna talen från minst till störst.', rad,
              forklaring='Skriv alla med två decimaler: %s. Då är de lätta att jämföra.'
              % lista(('%.2f' % float(F(t))).replace('.', ',') for t in rad)),
        val('Vilket tal ligger mellan 2,4 och 2,5?', mellan,
            ett(mellan, lambda a: F('2,4') < F(a) < F('2,5')),
            '2,4 är samma som 2,40 och 2,5 är samma som 2,50. 2,45 ligger mellan dem.'),
    ], beskrivning='Decimaltal med hundradelar, att jämföra dem och att avrunda.')


def _ak5_medelvarde():
    kulor = [3, 5, 9, 11]
    temp = [12, 15, 14, 11]
    ella = [7, 9, 8]
    trio = ['2, 5 och 8', '5, 5 och 6', '3, 4 och 5', '1, 5 och 10']

    def medel(t):
        return heltal(Fraction(sum(t), len(t)))

    def talen(s):
        return [int(x) for x in s.replace(' och', ',').split(',')]

    return niva('ma-ak5-statistik-1', 'Medelvärde', 'Statistik', [
        val('Hur räknar man ut medelvärdet av några tal?',
            ['Lägg ihop talen och dela med hur många de är', 'Ta det största talet minus det minsta',
             'Ta talet som står i mitten', 'Ta talet som finns flest gånger'],
            'Lägg ihop talen och dela med hur många de är',
            'Medelvärdet är vad varje tal blir om man delar summan lika. Därför delar man summan med antalet tal.'),
        skriv('Vad är medelvärdet av 4, 6 och 8?', tal(medel([4, 6, 8])),
              '4 + 6 + 8 = 18. Det är 3 tal, så 18 / 3 = %d.' % medel([4, 6, 8])),
        skriv('Fyra barn har %s kulor. Vad är medelvärdet?' % lista(str(k) for k in kulor),
              tal(medel(kulor)),
              '%s = %d kulor. Delat på 4 barn blir det %d / 4 = %d.'
              % (' + '.join(str(k) for k in kulor), sum(kulor), sum(kulor), medel(kulor))),
        val('Ella fick 7, 9 och 8 poäng i tre omgångar. Vad är medelvärdet?', [7, 8, 9, 24],
            medel(ella),
            '7 + 9 + 8 = %d poäng. %d / 3 = %d.' % (sum(ella), sum(ella), medel(ella))),
        val('Medelvärdet av två tal är 10. Det ena talet är 6. Vilket är det andra?', [4, 10, 14, 16],
            2 * 10 - 6,
            'Två tal med medelvärdet 10 har summan 2 · 10 = 20. 20 − 6 = 14.'),
        skriv('Det var %s grader fyra dagar i rad. Hur många grader var medeltemperaturen?'
              % lista(str(t) for t in temp), tal(medel(temp)),
              '%s = %d. %d / 4 = %d grader.'
              % (' + '.join(str(t) for t in temp), sum(temp), sum(temp), medel(temp))),
        ordna('Ordna stegen när du räknar ut medelvärdet av 5, 7 och 9. En bricka blir över.',
              ['5 + 7 + 9 = %d' % (5 + 7 + 9), '%d / 3 = %d' % (5 + 7 + 9, medel([5, 7, 9])),
               'Medelvärdet är %d' % medel([5, 7, 9])],
              extra=['%d · 3 = %d' % (5 + 7 + 9, (5 + 7 + 9) * 3)],
              forklaring='Först lägger man ihop talen. Sedan delar man summan med antalet tal: 21 / 3 = 7.'),
        val('Tre tal har medelvärdet 5. Vilka kan talen vara?', trio,
            ett(trio, lambda s: Fraction(sum(talen(s)), 3) == 5),
            'Tre tal med medelvärdet 5 har summan 3 · 5 = 15. Bara 2 + 5 + 8 blir 15.'),
    ], beskrivning='Att räkna ut medelvärdet och förstå vad det säger om en grupp tal.')


def _ak5_negativa():
    minst = ['−2', '−7', '0', '3']
    temp = ordnat(['−3', '4', '−9', '0', '−5'], F)
    varmare = -4 + 6
    mitten = Fraction(-4 + 2, 2)
    pastaenden = [('−5 är mindre än −2', -5 < -2), ('−5 är större än −2', -5 > -2),
                  ('−5 och −2 är lika stora', -5 == -2)]
    return niva('ma-ak5-negativa-tal-1', 'Tal under noll', 'Negativa tal', [
        val('Vilket tal är minst?', minst, min(minst, key=F),
            'På tallinjen ligger −7 längst till vänster. Ju längre åt vänster, desto mindre är talet.'),
        skriv('Det är 3 grader varmt. Temperaturen sjunker 5 grader. Hur många grader är det nu?',
              neg_svar(3 - 5, grader=True),
              'Från 3 ner till 0 är 3 grader. Sedan 2 grader till under noll: %s grader.' % minus(3 - 5)),
        val('Det är −4 grader. Det blir 6 grader varmare. Hur varmt är det nu?',
            ['2 grader', '−2 grader', '10 grader', '−10 grader'], '%s grader' % minus(varmare),
            'Från −4 upp till 0 är 4 grader. 2 grader till gör att det blir 2 grader varmt.'),
        skriv('Hur många grader skiljer det mellan −3 grader och 5 grader?', tal(5 - (-3)),
              'Från −3 till 0 är 3 grader och från 0 till 5 är 5 grader. 3 + 5 = %d.' % (5 - (-3))),
        val('Vilket tal ligger mitt emellan −4 och 2 på tallinjen?', ['−3', '−2', '−1', '1'],
            minus(heltal(mitten)),
            'Från −4 till 2 är det 6 steg. Hälften är 3 steg: −4 + 3 = −1.'),
        skriv('Vad är 2 − 6?', neg_svar(2 - 6),
              'Gå 6 steg åt vänster från 2 på tallinjen: 1, 0, −1, −2, −3, −4.'),
        ordna('Ordna temperaturerna från kallast till varmast.', ['%s grader' % t for t in temp],
              forklaring='Ju längre under noll, desto kallare. %s grader är kallast och %s grader varmast.'
              % (temp[0], temp[-1])),
        val('Vilket stämmer?', [p for p, _ in pastaenden],
            ett([p for p, _ in pastaenden], lambda p: dict(pastaenden)[p]),
            '−5 ligger längre till vänster på tallinjen än −2. Det är också kallare när det är −5 grader.'),
    ], beskrivning='Negativa tal på tallinjen och i temperaturer.')


# ---------------------------------------------------------------------
# Åk 6
# ---------------------------------------------------------------------

def _ak6_procent_1():
    uttryck = [(10, 300), (50, 50), (10, 100), (25, 80)]
    uttryck = ordnat(uttryck, lambda p: procent_av(*p))
    return niva('ma-ak6-procent-1', 'Procent av ett tal', 'Procent', [
        val('Hur mycket är 1 %?', ['En hundradel', 'En tiondel', 'En tusendel', 'En hel'], 'En hundradel',
            'Procent betyder "av hundra". 1 % är alltså en hundradel av något.'),
        skriv('Vad är 50 % av 80?', tal(procent_av(50, 80)),
              '50 %% är hälften. Hälften av 80 är %d.' % procent_av(50, 80)),
        val('Vad är 25 % av 60?', [15, 25, 30, 35], procent_av(25, 60),
            '25 %% är en fjärdedel. 60 / 4 = %d.' % procent_av(25, 60)),
        skriv('Vad är 10 % av 350?', tal(procent_av(10, 350)),
              '10 %% är en tiondel. 350 / 10 = %d.' % procent_av(10, 350)),
        val('En tröja kostar 200 kr. Den säljs med 25 % rabatt. Hur mycket billigare blir den?',
            ['25 kr', '50 kr', '150 kr', '175 kr'], '%d kr' % procent_av(25, 200),
            '25 %% är en fjärdedel av priset. 200 / 4 = %d kr billigare.' % procent_av(25, 200)),
        skriv('I en klass går 20 elever. 10 % av dem är sjuka. Hur många elever är sjuka?',
              tal(procent_av(10, 20)),
              '10 %% är en tiondel. 20 / 10 = %d elever.' % procent_av(10, 20)),
        ordna('Ordna från minst till störst.', ['%d %% av %d' % p for p in uttryck],
              forklaring='%s.' % lista('%d %% av %d = %d' % (p, n, procent_av(p, n)) for p, n in uttryck)),
        val('Hur många procent är det hela?', ['1 %', '10 %', '50 %', '100 %'], '%d %%' % (1 * 100),
            'Det hela är 100 hundradelar. Därför är det hela 100 %.'),
    ], beskrivning='Vad procent betyder och hur man räknar ut 50 %, 25 % och 10 % av ett tal.')


def _ak6_procent_2():
    tjugo = ['1/5', '1/20', '1/2', '2/5']
    blandat = ordnat(['30 %', '3/4', '0,2', '1/4', '0,5'], andel)
    halva = ['1/2', '0,5', '50 %', '5 %']

    def som_procent(s):
        return s if s.endswith('%') else '%s = %d %%' % (s, heltal(andel(s) * 100))

    return niva('ma-ak6-procent-2', 'Bråk, decimaltal och procent', 'Procent', [
        val('Hur skrivs 1/4 i procent?', ['4 %', '14 %', '25 %', '40 %'], '%d %%' % heltal(F('1/4') * 100),
            '1/4 = 25/100, och 25 hundradelar är 25 %.'),
        skriv('Hur många procent är 0,3?', tal(heltal(F('0,3') * 100)),
              '0,3 är samma som 0,30, alltså 30 hundradelar. Det är 30 %.'),
        val('Vilket decimaltal är lika mycket som 75 %?', ['0,075', '0,75', '7,5', '75'],
            dec(Fraction(75, 100)),
            '75 % är 75 hundradelar, och det skrivs 0,75.'),
        skriv('Hur många procent är 1/2?', tal(heltal(F('1/2') * 100)),
              '1/2 = 50/100. Hälften är alltså 50 %.'),
        val('Vilket bråk är lika mycket som 20 %?', tjugo, ett(tjugo, lambda a: F(a) == Fraction(20, 100)),
            '20 % = 20/100. Dela både täljaren och nämnaren med 20 så får du 1/5.'),
        skriv('Hur många procent är 0,05?', tal(heltal(F('0,05') * 100)),
              '0,05 är 5 hundradelar, alltså 5 %. Inte 50 %, för då hade det stått 0,50.'),
        ordna('Ordna från minst till störst.', blandat,
              forklaring='Gör om allt till procent: %s.' % lista(som_procent(s) for s in blandat)),
        val('Vilket är INTE lika mycket som de andra?', halva,
            ett(halva, lambda a: andel(a) != Fraction(1, 2)),
            '1/2, 0,5 och 50 % är alla hälften. 5 % är bara fem hundradelar.'),
    ], beskrivning='Att skriva samma andel som bråk, decimaltal och procent.')


def _ak6_procent_3():
    def av(s):
        """'3 av 10' → 3/10."""
        del_, helhet = s.split(' av ')
        return Fraction(int(del_), int(helhet))

    def procent(s):
        return heltal(av(s) * 100)

    def liten(k):
        """'Klass B' → 'klass B', mitt i en mening."""
        return k[0].lower() + k[1:]

    andelar = parvis([(s, '%d %%' % procent(s)) for s in ['1 av 4', '7 av 10', '2 av 5', '1 av 100']],
                     lambda s: andel(s) if s.endswith('%') else av(s))
    rad = ordnat(['3 av 10', '1 av 2', '2 av 5', '9 av 20', '1 av 5'], av)
    # Flest som cyklar och störst andel ska vara olika klasser: det är
    # hela poängen med frågan.
    klasser = {'Klass A': '6 av 24', 'Klass B': '8 av 20', 'Klass C': '9 av 30'}
    storst = ett(list(klasser), lambda k: av(klasser[k]) == max(av(v) for v in klasser.values()))
    flest = ett(list(klasser), lambda k: int(klasser[k].split()[0]) == max(int(v.split()[0]) for v in klasser.values()))
    if storst == flest:
        raise ValueError('Klassen med flest cyklister ska inte vara den med störst andel')
    jacka = 400 - procent_av(25, 400)
    return niva('ma-ak6-procent-3', 'Hur många procent?', 'Procent', [
        para('Para ihop andelen med samma andel i procent.', andelar,
             'Gör om till hundradelar: %s. 1 av 100 är en hundradel, alltså 1 %%.'
             % lista('%s = %d/100' % (s, procent(s)) for s, _ in andelar if s != '1 av 100')),
        skriv('I en klass går 25 elever. 5 av dem spelar fotboll. Hur många procent spelar fotboll?',
              tal(procent('5 av 25')),
              '25 · %d = 100, så förläng med %d: 5/25 = %d/100. Det är %d %%.'
              % (100 // 25, 100 // 25, procent('5 av 25'), procent('5 av 25'))),
        sant('30 % av 200 kr är mer än 50 % av 100 kr.', procent_av(30, 200) > procent_av(50, 100),
             '30 %% av 200 kr är %d kr och 50 %% av 100 kr är %d kr. '
             '30 %% är mindre än 50 %%, men av ett större belopp blir det ändå mer.'
             % (procent_av(30, 200), procent_av(50, 100))),
        val('En jacka kostar 400 kr. Den säljs med 25 % rabatt. Vad kostar jackan nu?',
            ['100 kr', '300 kr', '375 kr', '425 kr'], '%d kr' % jacka,
            '25 %% är en fjärdedel. 400 / 4 = %d kr i rabatt, och 400 − %d = %d kr.'
            % (procent_av(25, 400), procent_av(25, 400), jacka)),
        skriv('Ett prov har 20 frågor. Sara har 17 rätt. Hur många procent rätt har hon?',
              tal(procent('17 av 20')),
              '20 · %d = 100, så förläng med %d: 17/20 = %d/100. Det är %d %%.'
              % (100 // 20, 100 // 20, procent('17 av 20'), procent('17 av 20'))),
        sant('25 % av en tårta är mer än en tredjedel av samma tårta.', Fraction(25, 100) > Fraction(1, 3),
             '25 % är en fjärdedel. Delar man tårtan i tre blir bitarna större än om man delar den i fyra, '
             'så en tredjedel är mer, ungefär 33 %.'),
        ordna('Ordna andelarna från minst till störst.', rad,
              forklaring='I procent: %s.' % lista('%s = %d %%' % (s, procent(s)) for s in rad)),
        val('I klass A cyklar %s elever till skolan, i klass B %s och i klass C %s. '
            'I vilken klass cyklar störst andel av eleverna?' % tuple(klasser.values()),
            list(klasser), storst,
            'I procent: %s. Flest cyklar i %s, men störst andel i %s.'
            % (lista('%s %d %%' % (liten(k), procent(v)) for k, v in klasser.items()),
               liten(flest), liten(storst))),
    ], beskrivning='Att räkna ut hur många procent en del är av det hela, vad något kostar efter rabatt '
                   'och att jämföra andelar.')


def _ak6_koordinater():
    punkter = [(3, 5), (5, 3), (3, 3), (5, 5)]
    pt = ['(%d, %d)' % p for p in punkter]
    axel = [(5, 0), (0, 5), (5, 5), (1, 5)]
    rad = ordnat([(6, 1), (2, 7), (0, 4), (9, 3), (4, 4)], lambda p: p[0])
    linje = [(2, 1), (2, 4), (2, 6)]
    if len({x for x, _ in linje}) != 1:
        raise ValueError('Punkterna ska ha samma x-koordinat')
    return niva('ma-ak6-koordinatsystem-1', 'Punkter i koordinatsystem', 'Koordinatsystem', [
        val('Vilken punkt har x-koordinaten 3 och y-koordinaten 5?', pt,
            ett(pt, lambda s: s == '(%d, %d)' % (3, 5)),
            'En punkt skrivs (x, y), med x-koordinaten först. Därför är det (3, 5).'),
        # Namnet frågas före frågan som använder det: stod "origo" i
        # frågan före hade svaret stått framför barnet.
        skriv('Vad kallas punkten (0, 0), där axlarna möts?', ['origo', 'nollpunkten'],
              'Punkten (0, 0) där x-axeln och y-axeln korsar varandra kallas origo.'),
        val('Hur kommer du från origo till punkten (4, 2)?',
            ['4 steg åt höger och 2 steg uppåt', '2 steg åt höger och 4 steg uppåt',
             '4 steg uppåt och 2 steg åt vänster', '4 steg åt vänster och 2 steg nedåt'],
            '4 steg åt höger och 2 steg uppåt',
            'x-koordinaten 4 säger hur långt åt höger, och y-koordinaten 2 hur långt uppåt.'),
        skriv('Du står i punkten (2, 3) och går 4 steg åt höger. Vilken x-koordinat har du nu?',
              tal(2 + 4),
              'Går du åt höger ändras bara x-koordinaten: 2 + 4 = %d. y-koordinaten är kvar på 3.' % (2 + 4)),
        val('Vilken punkt ligger på x-axeln?', ['(%d, %d)' % p for p in axel],
            '(%d, %d)' % ett(axel, lambda p: p[1] == 0),
            'På x-axeln är y-koordinaten 0. Därför ligger (5, 0) på x-axeln, men (0, 5) på y-axeln.'),
        skriv('Hur många steg är det mellan punkterna (1, 1) och (6, 1)?', tal(6 - 1),
              'Punkterna har samma y-koordinat, så de ligger på samma höjd. 6 − 1 = %d steg.' % (6 - 1)),
        ordna('Ordna punkterna från den som ligger längst till vänster till den som ligger längst till höger.',
              ['(%d, %d)' % p for p in rad],
              forklaring='Hur långt åt höger en punkt ligger visas av x-koordinaten, det första talet. '
                         'Ordna efter den: %s.' % lista(str(x) for x, _ in rad)),
        val('Punkterna (2, 1), (2, 4) och (2, 6) ligger på en rak linje. Hur går linjen?',
            ['Rakt upp och ner', 'Rakt åt sidan', 'Snett uppåt åt höger'], 'Rakt upp och ner',
            'Alla punkterna har x-koordinaten 2. Då ligger de rakt ovanför varandra, på en lodrät linje.'),
    ], beskrivning='Hur man läser och skriver punkter i ett koordinatsystem.')


def _ak6_vinklar():
    spetsiga = ['35°', '90°', '120°', '180°']
    return niva('ma-ak6-geometri-1', 'Vinklar och trianglar', 'Geometri', [
        val('Hur många grader är en rät vinkel?', ['45°', '90°', '180°', '360°'], '%d°' % 90,
            'En rät vinkel är som hörnet på ett papper. Den är 90°.'),
        val('En vinkel är 130°. Vad kallas den?', ['Spetsig', 'Rät', 'Trubbig'], vinkelsort(130),
            'En trubbig vinkel är större än 90° men mindre än 180°. 130° är det.'),
        skriv('Två vinklar i en triangel är 50° och 60°. Hur många grader är den tredje vinkeln?',
              tal(180 - 50 - 60),
              'Vinklarna i en triangel är tillsammans 180°. 180 − 50 − 60 = %d°.' % (180 - 50 - 60)),
        val('Vilken vinkel är spetsig?', spetsiga, ett(spetsiga, lambda v: vinkelsort(int(v[:-1])) == 'Spetsig'),
            'En spetsig vinkel är mindre än 90°. Bara 35° är det.'),
        skriv('Hur många grader är vinklarna i en triangel tillsammans?', tal(180),
              'Lägger man ihop de tre vinklarna i en triangel blir det alltid 180°, hur triangeln än ser ut.'),
        skriv('En triangel har en rät vinkel och en vinkel på 25°. Hur många grader är den tredje vinkeln?',
              tal(180 - 90 - 25),
              'En rät vinkel är 90°. 180 − 90 − 25 = %d°.' % (180 - 90 - 25)),
        ordna('Ordna vinklarna från minst till störst.',
              ['en spetsig vinkel', 'en rät vinkel', 'en trubbig vinkel'],
              forklaring='En spetsig vinkel är mindre än 90°, en rät är precis 90° och en trubbig är större än 90°.'),
        val('Kan en triangel ha två trubbiga vinklar?',
            ['Nej, då blir vinklarna mer än 180° tillsammans', 'Ja, om triangeln är stor',
             'Ja, om den tredje vinkeln är liten'],
            'Nej, då blir vinklarna mer än 180° tillsammans',
            'Två trubbiga vinklar är tillsammans mer än 180°. Då finns det ingen plats kvar för den tredje.'),
    ], beskrivning='Spetsiga, räta och trubbiga vinklar och vinkelsumman i en triangel.')


def _ak6_ekvationer():
    ekv = [('x + 4 = 10', lambda x: x + 4 == 10), ('x + 6 = 6', lambda x: x + 6 == 6),
           ('2x = 3', lambda x: 2 * x == 3), ('x − 6 = 12', lambda x: x - 6 == 12)]
    ratt_ekv = ett(ekv, lambda e: e[1](6))[0]
    tanka = ['5x = 45', 'x + 5 = 45', 'x / 5 = 45', '45x = 5']
    return niva('ma-ak6-ekvationer-1', 'Enkla ekvationer', 'Ekvationer', [
        val('Vad är x om x + 7 = 12?', [4, 5, 6, 19], 12 - 7,
            'Vilket tal plus 7 blir 12? 12 − 7 = 5, så x = 5.'),
        skriv('Lös ekvationen 3x = 21. Vad är x?', x_svar(heltal(Fraction(21, 3))),
              '3x betyder 3 · x. 3 · 7 = 21, så x = %d.' % heltal(Fraction(21, 3))),
        skriv('Lös ekvationen x − 8 = 15. Vad är x?', x_svar(15 + 8),
              'Tar man bort 8 från x blir det 15. Då är x = 15 + 8 = %d.' % (15 + 8)),
        val('Vad betyder 4x?', ['4 · x', '4 + x', 'x − 4', 'x / 4'], '4 · x',
            'När ett tal står direkt framför x betyder det gånger. 4x är 4 · x.'),
        val('Vilken ekvation har lösningen x = 6?', [e for e, _ in ekv], ratt_ekv,
            'Sätt in 6 i stället för x: 6 + 4 = 10 stämmer. I de andra blir det inte lika på båda sidor.'),
        skriv('Lös ekvationen x / 4 = 5. Vad är x?', x_svar(4 * 5),
              'Ett tal delat med 4 blir 5. Då är talet 4 · 5 = %d.' % (4 * 5)),
        ordna('Ordna stegen när du löser ekvationen x + 9 = 14. En bricka blir över.',
              ['x + 9 = 14', 'x = 14 − 9', 'x = %d' % (14 - 9)], extra=['x = 14 + 9'],
              forklaring='För att få x ensamt tar man bort 9 på båda sidor: x = 14 − 9 = %d.' % (14 - 9)),
        val('Lisa tänker på ett tal x. Hon tar det gånger 5 och får 45. Vilken ekvation passar?',
            tanka, '5x = 45',
            'Talet gånger 5 skrivs 5x, och det ska bli 45: 5x = 45. Då är x = %d.' % heltal(Fraction(45, 5))),
    ], beskrivning='Att hitta det okända talet x i enkla ekvationer.')


# ---------------------------------------------------------------------
# Den andra nivån i varje område som bara hade en (2026-09-29). Ett
# område med två nivåer får ett Mästarprov, och en väg med en nivå per
# område tar slut fort. Den andra nivån är något svårare än den första
# och står direkt efter den i banan.
# ---------------------------------------------------------------------

def varde(uttryck):
    """'1,2 + 1,2' → 12/5, '7 · 10 + 7 · 6' → 112, räknat exakt ur texten
    barnet ser. Då kan texten och värdet som sorterar eller prövar den
    aldrig skilja sig."""
    kod = re.sub(r'(\d+(?:,\d+)?)', lambda m: "_B('%s')" % m.group(1).replace(',', '.'),
                 uttryck.replace('·', '*').replace('−', '-'))
    return eval(kod, {'_B': Fraction})  # noqa: S307 — bara våra egna uttryck


def _ak4_multiplikation_2():
    samma = ['7 · 10 + 7 · 6', '7 · 10 + 6', '7 + 16']
    ut = ordnat(['4 · 50', '3 · 60', '9 · 30', '2 · 99'], varde)
    return niva('ma-ak4-multiplikation-2', 'Multiplicera större tal', 'Multiplikation', [
        skriv('Vad är 4 · 30?', tal(4 * 30),
              '4 · 3 = 12, och 30 är tio gånger så mycket som 3. Därför är 4 · 30 = 120.'),
        val('Vad är 6 · 70?', [420, 42, 4200, 76], 6 * 70,
            '6 · 7 = 42. 70 är tio gånger så mycket som 7, så svaret är 420.'),
        skriv('Vad är 3 · 24?', tal(3 * 24),
              'Dela upp 24 i 20 och 4: 3 · 20 = 60 och 3 · 4 = 12. 60 + 12 = %s.' % tal(3 * 24)),
        val('Vad är 5 · 18?', [90, 58, 80, 95], 5 * 18,
            '5 · 10 = 50 och 5 · 8 = 40. 50 + 40 = 90.'),
        skriv('En biobiljett kostar 85 kr. Hur många kronor kostar 4 biljetter?', tal(4 * 85),
              '4 · 80 = 320 och 4 · 5 = 20. 320 + 20 = %s kr.' % tal(4 * 85)),
        val('Vilket uttryck är samma sak som 7 · 16?', samma, ett(samma, lambda u: varde(u) == 7 * 16),
            '16 är 10 + 6, och båda delarna ska tas gånger 7: 7 · 10 + 7 · 6 = 70 + 42 = 112.'),
        sant('8 · 25 = 200', 8 * 25 == 200,
             '4 · 25 = 100, och 8 är dubbelt så mycket som 4. Då blir 8 · 25 = 200.'),
        ordna('Ordna efter hur stort svaret blir, minst först.', ut,
              forklaring='%s.' % lista('%s = %s' % (u, tal(heltal(varde(u)))) for u in ut)),
    ], beskrivning='Multiplikation med tiotal och tvåsiffriga tal, genom att dela upp talen.')


def _ak4_division_2():
    samma = ['40 / 2', '60 / 2', '30 / 3']
    ut = ordnat(['84 / 4', '90 / 5', '66 / 3', '75 / 5'], varde)
    return niva('ma-ak4-division-2', 'Dela större tal', 'Division', [
        skriv('Vad är 80 / 4?', tal(80 // 4),
              '8 / 4 = 2, och 80 är tio gånger så mycket som 8. Därför är 80 / 4 = 20.'),
        val('Vad är 96 / 3?', [32, 33, 30, 23], heltal(Fraction(96, 3)),
            'Dela upp 96 i 90 och 6: 90 / 3 = 30 och 6 / 3 = 2. 30 + 2 = 32.'),
        skriv('Vad är 450 / 5?', tal(450 // 5),
              '5 · 90 = 450. Därför är 450 / 5 = 90.'),
        val('Fyra kompisar delar lika på 100 kr. Hur mycket får var och en?',
            ['25 kr', '40 kr', '20 kr', '30 kr'], '%d kr' % heltal(Fraction(100, 4)),
            '4 · 25 = 100. Var och en får 25 kr.'),
        skriv('72 elever delas in i lag med 6 elever i varje. Hur många lag blir det?', tal(72 // 6),
              '6 · 12 = 72. Det blir 12 lag.'),
        val('Vilken division har samma svar som 60 / 3?', samma, ett(samma, lambda u: varde(u) == Fraction(60, 3)),
            '60 / 3 = 20 och 40 / 2 = 20. Men 60 / 2 = 30 och 30 / 3 = 10.'),
        skriv('Vad blir resten när du delar 100 med 7?', tal(100 % 7),
              '7 · 14 = 98, och 100 − 98 = %s. Det är resten, och den är mindre än 7.' % tal(100 - 98)),
        ordna('Ordna divisionerna efter svaret, minst först.', ut,
              forklaring='%s.' % lista('%s = %s' % (u, tal(heltal(varde(u)))) for u in ut)),
    ], beskrivning='Division av tvåsiffriga och tresiffriga tal, med tabellerna som hjälp.')


def _ak4_omkrets_area_2():
    lika_area = ['4 cm gånger 3 cm', '4 cm gånger 8 cm', '10 cm gånger 2 cm']

    def sidor(t):
        a, b = (int(x.split()[0]) for x in t.split(' gånger '))
        return a, b

    rektanglar = ordnat(['8 cm gånger 1 cm', '5 cm gånger 5 cm', '6 cm gånger 2 cm', '7 cm gånger 4 cm'],
                        lambda t: 2 * sum(sidor(t)))
    return niva('ma-ak4-geometri-2', 'Omkrets och area i fler steg', 'Geometri', [
        skriv('En kvadrat har sidan 7 cm. Hur många centimeter är omkretsen?', tal(4 * 7),
              'En kvadrat har fyra lika långa sidor. 7 + 7 + 7 + 7 = 4 · 7 = 28 cm.'),
        val('Vilken enhet används för area?', ['cm²', 'cm', 'kg'], 'cm²',
            'Area mäts i rutor. En kvadratcentimeter, cm², är en ruta som är 1 cm lång och 1 cm bred.'),
        skriv('En figur består av två rektanglar. Den ena är 4 cm gånger 3 cm och den andra är 2 cm gånger 5 cm. '
              'Hur många kvadratcentimeter är hela figurens area?', tal(4 * 3 + 2 * 5),
              'Räkna varje rektangel för sig: 4 · 3 = 12 och 2 · 5 = 10. Lägg ihop: 12 + 10 = 22 cm².'),
        val('En rektangel är 6 cm gånger 2 cm. Vilken rektangel har samma area?', lika_area,
            ett(lika_area, lambda t: sidor(t)[0] * sidor(t)[1] == 6 * 2),
            '6 · 2 = 12 cm² och 4 · 3 = 12 cm². De andra har arean 32 cm² och 20 cm².'),
        sant('Två rektanglar med samma area har alltid samma omkrets.', False,
             '6 cm gånger 2 cm och 4 cm gånger 3 cm har båda arean 12 cm². Men omkretsen är %d cm och %d cm.'
             % (2 * (6 + 2), 2 * (4 + 3))),
        skriv('En rektangel har omkretsen 20 cm. Den är 6 cm lång. Hur många centimeter bred är den?',
              tal(heltal(Fraction(20 - 2 * 6, 2))),
              'De två långa sidorna är 6 + 6 = 12 cm. Kvar till de två korta är 20 − 12 = 8 cm, och 8 / 2 = 4 cm.'),
        val('En trädgård är 10 m lång och 8 m bred. Hur många meter staket behövs runt hela trädgården?',
            ['36 m', '80 m', '18 m', '28 m'], '%d m' % (2 * (10 + 8)),
            'Staketet går runt alla fyra sidorna: 10 + 8 + 10 + 8 = 36 m. 80 är arean, inte omkretsen.'),
        ordna('Ordna rektanglarna efter omkretsen, minst först.', rektanglar,
              forklaring='%s.' % lista('%s har omkretsen %d cm' % (t, 2 * sum(sidor(t))) for t in rektanglar)),
    ], beskrivning='Omkrets och area för sammansatta figurer, och att samma area kan ha olika omkrets.')


def _ak4_tid_2():
    buss = klocka(kl('14.35') + 50)
    langder = [('100 minuter', Fraction(100)), ('2 timmar', Fraction(120)),
               ('1 timme och 30 minuter', Fraction(90)), ('5 000 sekunder', Fraction(5000, 60))]
    langder = ordnat(langder, lambda p: p[1])
    return niva('ma-ak4-tid-2', 'Tid i längre steg', 'Tid', [
        skriv('Hur många timmar är tre dygn?', tal(3 * 24),
              'Ett dygn är 24 timmar. 3 · 24 = 72 timmar.'),
        val('Bussen går 14.35 och resan tar 50 minuter. När är bussen framme?',
            ['15.25', '14.85', '15.35', '15.15'], buss,
            'Efter 25 minuter är klockan 15.00. Det är 25 minuter kvar av resan, så bussen är framme 15.25.'),
        skriv('Hur många minuter är det från 8.40 till 10.10?', tal(kl('10.10') - kl('8.40')),
              'Från 8.40 till 9.00 är det 20 minuter, till 10.00 en timme till, och sedan 10 minuter: '
              '20 + 60 + 10 = 90.'),
        val('Hur många dagar är tre veckor?', [21, 18, 30, 24], 3 * 7,
            'En vecka har 7 dagar. 3 · 7 = 21.'),
        skriv('Hur många sekunder är en kvart?', tal(15 * 60),
              'En kvart är 15 minuter och varje minut har 60 sekunder. 15 · 60 = 900.'),
        val('Ett lopp tar 2 minuter och 15 sekunder. Hur många sekunder är det?', [135, 215, 125, 150],
            2 * 60 + 15,
            '2 minuter är 120 sekunder. 120 + 15 = 135. 215 får den som tror att en minut är 100 sekunder.'),
        sant('Från 23.30 till 1.00 på natten är det en och en halv timme.',
             (24 * 60 + kl('1.00')) - kl('23.30') == 90,
             'Från 23.30 till midnatt är det 30 minuter, och sedan en timme till 1.00. 30 + 60 = 90 minuter.'),
        ordna('Ordna från kortast till längst.', [t for t, _ in langder],
              forklaring='Gör om allt till minuter: 5 000 sekunder är drygt 83 minuter, 1 timme och 30 minuter är 90, '
                         'sedan kommer 100 minuter, och 2 timmar är 120 minuter.'),
    ], beskrivning='Räkna med dygn, veckor, minuter och sekunder, och med tider som går över en hel timme.')


def _ak5_decimaltal_2():
    ut = ordnat(['0,3 · 10', '4,5 − 2', '1,2 + 1,2', '5 / 10'], varde)
    return niva('ma-ak5-decimaltal-2', 'Räkna med decimaltal', 'Decimaltal', [
        skriv('Vad är 3,4 + 2,75?', dec(F('3,4') + F('2,75')),
              'Skriv talen med lika många decimaler: 3,40 + 2,75. Hundradelar för sig och tiondelar för sig: 6,15.'),
        val('Vad är 5 − 1,25?', ['3,75', '4,25', '4,75', '3,25'], dec(5 - F('1,25')),
            '5 − 1 = 4, och 4 − 0,25 = 3,75.'),
        skriv('Vad är 0,6 · 4?', dec(F('0,6') * 4),
              '6 tiondelar fyra gånger är 24 tiondelar. Det är 2,4.'),
        val('Vad är 2,5 · 10?', ['25', '2,50', '250', '0,25'], dec(F('2,5') * 10),
            'När man tar gånger 10 blir varje siffra tio gånger så mycket, och kommat flyttas ett steg åt höger.'),
        skriv('Vad är 7,2 / 10?', dec(F('7,2') / 10),
              'När man delar med 10 flyttas kommat ett steg åt vänster: 7,2 blir 0,72.'),
        val('Ett paket tuggummi kostar 12,50 kr. Vad kostar tre paket?',
            ['37,50 kr', '36,50 kr', '15,50 kr', '37,15 kr'], kr(3 * 1250),
            '3 · 12 kr = 36 kr och 3 · 50 öre = 150 öre, alltså 1,50 kr. 36 + 1,50 = 37,50 kr.'),
        sant('0,5 · 0,5 = 0,25', F('0,5') * F('0,5') == F('0,25'),
             '0,5 är en halv. Hälften av en halv är en fjärdedel, och en fjärdedel är 0,25.'),
        ordna('Ordna svaren från minst till störst.', ut,
              forklaring='%s.' % lista('%s = %s' % (u, dec(varde(u))) for u in ut)),
    ], beskrivning='Addition, subtraktion, multiplikation och division med decimaltal.')


def _ak5_median_typvarde():
    typ = [4, 7, 4, 9, 4, 7]
    assert max(set(typ), key=typ.count) == 4 and typ.count(4) > typ.count(7)
    rostning = {'simning': 11, 'fotboll': 8, 'innebandy': 5}
    data = [1, 1, 3, 7, 13]
    matt = ordnat([('Typvärdet', Fraction(1)), ('Medianen', Fraction(sorted(data)[2])),
                   ('Medelvärdet', Fraction(sum(data), len(data)))], lambda p: p[1])
    return niva('ma-ak5-statistik-2', 'Median och typvärde', 'Statistik', [
        val('Vad är typvärdet för 4, 7, 4, 9, 4, 7?', [4, 7, 9], max(set(typ), key=typ.count),
            'Typvärdet är det tal som finns flest gånger. 4 finns tre gånger, 7 två gånger och 9 en gång.'),
        skriv('Vad är medianen för 3, 9, 5, 1, 7?', tal(sorted([3, 9, 5, 1, 7])[2]),
              'Ställ talen i ordning: 1, 3, 5, 7, 9. Medianen är talet i mitten, 5.'),
        val('Vad är medianen?', ['Talet i mitten när talen står i storleksordning',
                                 'Det tal som finns flest gånger', 'Summan av talen delad med antalet'],
            'Talet i mitten när talen står i storleksordning',
            'Medianen är mitten. Det tal som finns flest gånger är typvärdet, och summan delad med antalet är '
            'medelvärdet.'),
        skriv('Fem barn fick 3, 4, 2, 5 och 6 poäng i ett spel. Vad är medelvärdet?',
              tal(heltal(Fraction(3 + 4 + 2 + 5 + 6, 5))),
              'Lägg ihop: 3 + 4 + 2 + 5 + 6 = 20. Dela med antalet barn: 20 / 5 = 4.'),
        skriv('Vad är medianen för 2, 8, 4, 6?', tal(heltal(Fraction(4 + 6, 2))),
              'Ställ talen i ordning: 2, 4, 6, 8. Det finns två tal i mitten, 4 och 6. Medianen är mitt emellan: 5.'),
        val('I en klass röstar 8 elever på fotboll, 5 på innebandy och 11 på simning. Vilken sport är typvärdet?',
            ['simning', 'fotboll', 'innebandy'], max(rostning, key=rostning.get),
            'Typvärdet är det svar som flest har valt. Simning fick flest röster, 11.'),
        sant('Medelvärdet av 10, 10 och 40 är 10.', Fraction(10 + 10 + 40, 3) == 10,
             '10 + 10 + 40 = 60, och 60 / 3 = 20. Medelvärdet är 20. Typvärdet och medianen är däremot 10.'),
        ordna('Talen är 1, 1, 3, 7 och 13. Ordna lägesmåtten från minst till störst.', [n for n, _ in matt],
              forklaring='Typvärdet är 1, för det finns två gånger. Medianen är talet i mitten, 3. '
                         'Medelvärdet är (1 + 1 + 3 + 7 + 13) / 5 = 25 / 5 = 5.'),
    ], beskrivning='Median och typvärde, och hur de skiljer sig från medelvärdet.')


def _ak5_negativa_2():
    storre = ['−2', '−5', '−7', '−10']
    ut = ordnat(['2 − 7', '−4 + 1', '−6 + 9', '0 − 8'], varde)
    return niva('ma-ak5-negativa-tal-2', 'Räkna under noll', 'Negativa tal', [
        skriv('Det är −2 grader. Temperaturen sjunker 6 grader. Hur många grader är det nu?',
              neg_svar(-2 - 6, grader=True),
              'Sjunker betyder nedåt på termometern. Från −2 och 6 steg nedåt hamnar du på −8.'),
        val('Vad är −3 + 8?', [minus(5), minus(-5), minus(11), minus(-11)], minus(-3 + 8),
            'Börja på −3 och gå 8 steg uppåt. Efter 3 steg är du på noll, och 5 steg till ger 5.'),
        skriv('Vad är 4 − 9?', neg_svar(4 - 9),
              'Börja på 4 och gå 9 steg nedåt. Efter 4 steg är du på noll, och 5 steg till ger −5.'),
        val('Vilket tal är större än −4?', storre, ett(storre, lambda a: F(a) > -4),
            '−2 ligger närmare noll än −4, alltså längre upp på tallinjen. −5, −7 och −10 ligger längre ned.'),
        skriv('På morgonen var det −7 grader och på eftermiddagen 3 grader. Hur många grader varmare var det på '
              'eftermiddagen?', tal(3 - (-7)),
              'Från −7 upp till noll är 7 grader, och från noll till 3 är 3 grader till. 7 + 3 = 10.'),
        val('En hiss står på våning 2. Den åker 5 våningar ned. På vilken våning står den nu?',
            [minus(-3), minus(3), minus(-7), minus(7)], minus(2 - 5),
            'Två våningar ned kommer hissen till våning 0. Tre våningar till ned är våning −3, i källaren.'),
        sant('−10 är mindre än −1.', -10 < -1,
             '−10 ligger längre ned på tallinjen än −1. Ju längre från noll på minussidan, desto mindre tal.'),
        ordna('Ordna svaren från minst till störst.', ut,
              forklaring='%s.' % lista('%s = %s' % (u, minus(varde(u))) for u in ut)),
    ], beskrivning='Plus och minus med negativa tal, på termometern, i hissen och på tallinjen.')


def _ak6_koordinater_2():
    punkter = ordnat([(5, 1), (2, 6), (4, 3), (1, 8)], lambda p: p[1])
    fjarde = ['(2, 6)', '(6, 2)', '(4, 4)', '(2, 4)']
    mitt = ['(5, 5)', '(6, 5)', '(10, 5)', '(5, 10)']
    return niva('ma-ak6-koordinatsystem-2', 'Figurer i koordinatsystem', 'Koordinatsystem', [
        skriv('En rektangel har hörnen (1, 1), (5, 1), (5, 3) och (1, 3). Hur lång är den längsta sidan?',
              tal(5 - 1),
              'Från (1, 1) till (5, 1) ändras bara x, från 1 till 5. Det är 4 steg. Den andra sidan är 3 − 1 = 2 steg.'),
        skriv('En rektangel har hörnen (1, 1), (5, 1), (5, 3) och (1, 3). Hur många rutor stor är arean?',
              tal((5 - 1) * (3 - 1)),
              'Rektangeln är 4 rutor lång och 2 rutor hög. 4 · 2 = 8 rutor.'),
        val('En kvadrat har tre hörn i (2, 2), (6, 2) och (6, 6). Var är det fjärde hörnet?', fjarde,
            ett(fjarde, lambda p: p == '(%d, %d)' % (2, 6)),
            'Sidorna är 4 steg långa. Från (2, 2) går du 4 steg uppåt och kommer till (2, 6).'),
        val('Punkten (3, 4) flyttas 2 steg uppåt. Vilken punkt får du?',
            ['(3, 6)', '(5, 4)', '(3, 2)', '(1, 4)'], '(%d, %d)' % (3, 4 + 2),
            'Uppåt ändrar y-koordinaten, alltså det andra talet: 4 + 2 = 6. x är kvar på 3.'),
        skriv('Vilken y-koordinat har alla punkter på x-axeln?', ['0', 'noll'],
              'x-axeln går vågrätt genom origo. Där har man inte gått något uppåt eller nedåt, så y = 0.'),
        val('Vilken punkt ligger mitt emellan (2, 5) och (8, 5)?', mitt,
            ett(mitt, lambda p: p == '(%d, 5)' % ((2 + 8) // 2)),
            'Båda punkterna har y = 5. Mitt emellan x = 2 och x = 8 är x = 5, för 5 − 2 = 3 och 8 − 5 = 3.'),
        sant('Punkten (4, 7) och punkten (7, 4) är samma punkt.', False,
             'Det första talet är x och det andra y. (4, 7) ligger 4 steg åt höger och 7 upp, (7, 4) 7 åt höger och 4 upp.'),
        ordna('Ordna punkterna från den som ligger lägst till den som ligger högst.',
              ['(%d, %d)' % p for p in punkter],
              forklaring='Höjden är y-koordinaten, det andra talet: %s.' % lista(str(p[1]) for p in punkter)),
    ], beskrivning='Rektanglar och kvadrater i koordinatsystemet, att flytta punkter och hitta mittpunkter.')


def _ak6_vinklar_2():
    vinklar = [40, 90, 150, 180]
    return niva('ma-ak6-geometri-2', 'Fler vinklar', 'Geometri', [
        skriv('Hur många grader är vinklarna i en fyrhörning tillsammans?', tal(2 * 180),
              'En fyrhörning kan delas i två trianglar med en diagonal. 2 · 180° = 360°.'),
        skriv('Tre av vinklarna i en fyrhörning är 90°, 90° och 100°. Hur många grader är den fjärde?',
              tal(360 - 90 - 90 - 100),
              'Alla fyra är 360° tillsammans. 360 − 90 − 90 − 100 = 80.'),
        val('Hur många grader är ett helt varv?', ['360°', '180°', '90°', '100°'], '%d°' % 360,
            'Ett helt varv är 360°. Ett halvt varv är 180° och ett kvarts varv 90°.'),
        skriv('En triangel har tre lika stora vinklar. Hur många grader är varje vinkel?', tal(180 // 3),
              'Vinklarna i en triangel är 180° tillsammans. 180 / 3 = 60.'),
        val('Två vinklar ligger bredvid varandra på en rak linje. Den ena är 110°. Hur stor är den andra?',
            ['70°', '250°', '110°', '90°'], '%d°' % (180 - 110),
            'En rak linje är 180°. 180 − 110 = 70.'),
        sant('En rektangel har fyra räta vinklar.', True,
             'Alla hörn i en rektangel är 90°. 4 · 90° = 360°, som för alla fyrhörningar.'),
        val('En likbent triangel har toppvinkeln 40°. De två andra vinklarna är lika stora. Hur stor är var och en?',
            ['70°', '140°', '40°', '50°'], '%d°' % heltal(Fraction(180 - 40, 2)),
            '180 − 40 = 140 är kvar till de två vinklarna. De är lika stora: 140 / 2 = 70.'),
        para('Para ihop vinkeln med sitt namn.', parvis([('%d°' % v, vinkelsort(v)) for v in vinklar],
                                                       lambda t: vinkelsort(int(t[:-1])) if t.endswith('°') else t),
             'En spetsig vinkel är mindre än 90°, en rät är 90°, en trubbig ligger mellan 90° och 180°, '
             'och en rak vinkel är 180°, som en rak linje.'),
    ], beskrivning='Vinklar i fyrhörningar, på en rak linje och i likbenta och liksidiga trianglar.')


def _ak6_ekvationer_2():
    losning = ['2x + 1 = 9', '2x + 1 = 10', 'x + 4 = 12']
    pennor = ['3x + 10 = 40', '3 + x + 10 = 40', '3x = 40 + 10', 'x + 10 = 40']

    def los(ekv, x):
        """Stämmer ekvationen för det här x? '2x + 1' blir '2 · 4 + 1'."""
        vanster, hoger = ekv.split(' = ')
        return varde(re.sub(r'(\d)x', r'\1 · x', vanster).replace('x', str(x))) == varde(hoger)

    return niva('ma-ak6-ekvationer-2', 'Ekvationer i två steg', 'Ekvationer', [
        skriv('Lös ekvationen 2x + 3 = 11. Vad är x?', x_svar(heltal(Fraction(11 - 3, 2))),
              'Ta först bort 3 från båda sidor: 2x = 8. Dela sedan med 2: x = 4.'),
        val('Vad är x om 3x − 4 = 11?', [5, 7, 3, 21], heltal(Fraction(11 + 4, 3)),
            'Lägg till 4 på båda sidor: 3x = 15. Dela med 3: x = 5. Pröva: 3 · 5 − 4 = 11.'),
        skriv('Lös ekvationen x / 3 + 2 = 6. Vad är x?', x_svar((6 - 2) * 3),
              'Ta bort 2 från båda sidor: x / 3 = 4. Ta sedan gånger 3: x = 12.'),
        val('Vilken ekvation har lösningen x = 4?', losning, ett(losning, lambda e: los(e, 4)),
            'Sätt in 4 i stället för x: 2 · 4 + 1 = 9. Det stämmer bara i den första.'),
        skriv('Lös ekvationen 4x − 6 = 18. Vad är x?', x_svar(heltal(Fraction(18 + 6, 4))),
              'Lägg till 6 på båda sidor: 4x = 24. Dela med 4: x = 6.'),
        val('Ali köper 3 lika dyra pennor och en linjal för 10 kr. Han betalar 40 kr. En penna kostar x kr. '
            'Vilken ekvation passar?', pennor, ett(pennor, lambda e: los(e, (40 - 10) // 3)),
            'Tre pennor kostar 3x kronor, och linjalen 10 kronor till. Tillsammans är det 40 kr: 3x + 10 = 40.'),
        skriv('Lös ekvationen 3x + 10 = 40. Vad är x?', x_svar(heltal(Fraction(40 - 10, 3))),
              'Ta bort 10 från båda sidor: 3x = 30. Dela med 3: x = 10.'),
        ordna('Ordna stegen när du löser 2x + 5 = 17. En bricka blir över.',
              ['2x + 5 = 17', '2x = %d' % (17 - 5), 'x = %d' % heltal(Fraction(17 - 5, 2))],
              extra=['2x = %d' % (17 + 5)],
              forklaring='Ta först bort 5 från båda sidor, så att 2x = 12. Dela sedan med 2: x = 6. '
                         '2x = 22 får den som lägger till 5 i stället för att ta bort.'),
    ], beskrivning='Ekvationer som löses i två steg, och att skriva en ekvation ur en berättelse.')



BANOR = [
    bana('Matematik', 'ak4', [
        _ak4_multiplikation(),
        _ak4_multiplikation_2(),
        _ak4_division(),
        _ak4_division_2(),
        _ak4_tiondelar(),
        _ak4_tiondelar_vardag(),
        _ak4_omkrets_area(),
        _ak4_omkrets_area_2(),
        _ak4_tid(),
        _ak4_tid_2(),
    ]),
    bana('Matematik', 'ak5', [
        _ak5_brak_1(),
        _ak5_brak_2(),
        _ak5_brak_3(),
        _ak5_decimaltal(),
        _ak5_decimaltal_2(),
        _ak5_medelvarde(),
        _ak5_median_typvarde(),
        _ak5_negativa(),
        _ak5_negativa_2(),
    ]),
    bana('Matematik', 'ak6', [
        _ak6_procent_1(),
        _ak6_procent_2(),
        _ak6_procent_3(),
        _ak6_koordinater(),
        _ak6_koordinater_2(),
        _ak6_vinklar(),
        _ak6_vinklar_2(),
        _ak6_ekvationer(),
        _ak6_ekvationer_2(),
    ]),
]
