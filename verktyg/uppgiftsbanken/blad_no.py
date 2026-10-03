# -*- coding: utf-8 -*-
"""NexLäx-nivåer ur NO-bladen i materialbanken (2026-10-03).

Varje nivå tränar det ett övningsblad i verktyg/bladen/ tränar, med bladets
uppgifter och facit (verktyg/bladen/facit_*.py) omskrivna till frågor som går
att rätta av en maskin. Bladen är Nextrums egna; NP-träningen är egna uppgifter
i provens stil, aldrig provens. Där ett blad var för litet för en ny bana har
nivåerna fyllts ut med egna frågor om samma innehåll.

Nya banor (BANOR): NO åk 1, åk 2, gy1 (kemi), gy2 (fysik) och gy3 (biologi).
Tillägg (TILLAGG): åk 6, åk 7, åk 8 och åk 9, sist i banorna i no.py och
no_mer.py, i områden som inte fanns där.

Varje räknefacit räknas ut här, med Fraction, och de felaktiga alternativen
prövas mot samma räkning. En fråga ska gå att förstå ensam: Mästarprovet och
repetitionen drar dem en och en, så talen står i frågan.
"""
import math
from fractions import Fraction as F

from grund import bana, niva, val, skriv, ordna, sant, para, tal, lika

AMNE = 'NO / Fysik / Kemi / Biologi'


def t(x):
    """Ett exakt tal som svar: heltal när det går, annars decimaltal med komma."""
    x = F(x)
    return tal(int(x)) if x.denominator == 1 else tal(float(x))


def svar(*xs):
    """Godtagna svar, i ordning och utan dubbletter. Tal blir text med t()."""
    ut = []
    for x in xs:
        s = x if isinstance(x, str) else t(x)
        if s not in ut:
            ut.append(s)
    return ut


def avrundat(x, *decimaler):
    """Det exakta talet och samma tal avrundat till de givna decimalerna."""
    x = F(x)
    # Avrundning uppåt vid jämn halva, som i skolan (Pythons round avrundar mot jämnt).
    return svar(x, *[t(F(math.floor(x * 10 ** d + F(1, 2)), 10 ** d)) for d in decimaler])


def enda(alternativ, prov):
    """Det enda alternativet som klarar provet. Annars är frågan fel skriven."""
    traffar = [a for a in alternativ if prov(a)]
    assert len(traffar) == 1, 'väntade ett rätt alternativ i %r, fick %r' % (alternativ, traffar)
    return traffar[0]


def prova(facit, *svaren):
    """Ett facit ska rätta de svar en elev rimligen skriver som rätt."""
    for s in svaren:
        assert any(lika(f, s) for f in facit), (facit, s)
    return facit


def blad(mening, titel):
    b = '%s Bygger på övningsbladet «%s» i materialbanken.' % (mening, titel)
    assert len(b) <= 400, b
    return b


# ---------------------------------------------------------------- räkningarna

# Molmassor ur bladet om mol (g/mol).
H, C, O, NA, CL, CA = F('1.0'), F('12.0'), F('16.0'), F('23.0'), F('35.5'), F('40.1')
M_VATTEN = 2 * H + O
M_NACL = NA + CL
M_CACO3 = CA + C + 3 * O
M_CO2 = C + 2 * O
M_O2 = 2 * O
M_NAOH = NA + O + H
M_GLUKOS = 6 * C + 12 * H + 6 * O
M_CH4 = C + 4 * H
assert (M_VATTEN, M_NACL, M_CACO3, M_CO2, M_NAOH, M_GLUKOS) == (18, F('58.5'), F('100.1'), 44, 40, 180)
AVOGADRO = F('6.02e23')

# Rörelsen i bladet om Newtons lagar.
G = F('9.82')

# Genetiken: basparning i DNA och avskrift till mRNA.
DNA_PAR = {'A': 'T', 'T': 'A', 'C': 'G', 'G': 'C'}
MRNA_AV = {'A': 'U', 'T': 'A', 'C': 'G', 'G': 'C'}


def komplement(s):
    return ''.join(DNA_PAR[b] for b in s)


def mrna(templat):
    return ''.join(MRNA_AV[b] for b in templat)


assert komplement('TACGGCAT') == 'ATGCCGTA' and mrna('TACGGCAT') == 'AUGCCGUA'


# ======================================================================
# Åk 1: Årstiderna
# ======================================================================
T_ARSTIDER = 'Årstiderna'

AK1 = bana(AMNE, 'ak1', [
    niva('no-ak1-blad-arstiderna-1', 'Fyra årstider', 'Årstiderna', [
        ordna('Sätt årstiderna i rätt ordning. Börja med våren.',
              ['våren', 'sommaren', 'hösten', 'vintern'],
              forklaring='Efter våren kommer sommaren, sedan hösten och sist vintern. Sedan börjar det om.'),
        val('När ändrar löven färg och faller av träden?',
            ['På hösten', 'På våren', 'På sommaren'], 'På hösten',
            'På hösten blir det kallare och mörkare. Träden fäller sina löv för att klara vintern.'),
        val('När ligger snön på marken?',
            ['På vintern', 'På sommaren', 'På hösten'], 'På vintern',
            'Vintern är den kallaste årstiden. Då faller det snö som ligger kvar.'),
        val('När kommer blommorna upp och fåglarna tillbaka?',
            ['På våren', 'På hösten', 'På vintern'], 'På våren',
            'På våren blir det varmare och ljusare. Då börjar det växa, och flyttfåglarna kommer hem.'),
        val('Vilken årstid är oftast varmast?',
            ['Sommaren', 'Vintern', 'Hösten'], 'Sommaren',
            'På sommaren står solen högt och lyser länge. Därför blir det varmt.'),
        skriv('Hur många årstider har ett år? Skriv ett tal.', svar(4, 'fyra'),
              'Året har fyra årstider: våren, sommaren, hösten och vintern.'),
        val('Vilken årstid kommer efter vintern?',
            ['Våren', 'Sommaren', 'Hösten'], 'Våren',
            'När vintern är slut börjar det bli varmare. Då är det vår.'),
        val('Vilken årstid kommer före hösten?',
            ['Sommaren', 'Vintern', 'Våren'], 'Sommaren',
            'Ordningen är vår, sommar, höst och vinter. Före hösten kommer alltså sommaren.'),
        sant('Årstiderna kommer i samma ordning varje år.', True,
             'Varje år kommer våren, sommaren, hösten och vintern i samma ordning.'),
    ], beskrivning=blad('Årstidernas namn och ordning, och vad som händer i naturen under året.', T_ARSTIDER)),

    niva('no-ak1-blad-arstiderna-2', 'Naturen under året', 'Årstiderna', [
        val('När är dagarna längst och ljusast?',
            ['På sommaren', 'På vintern', 'På hösten'], 'På sommaren',
            'På sommaren går solen upp tidigt och ner sent. Då är det ljust länge.'),
        val('När är det mörkt större delen av dygnet?',
            ['På vintern', 'På sommaren', 'På våren'], 'På vintern',
            'På vintern går solen upp sent och ner tidigt. Då är det mörkt länge.'),
        sant('Många fåglar flyger söderut på hösten.', True,
             'Flyttfåglarna flyger till varmare länder, där de hittar mat på vintern.'),
        val('Vad gör björnen på vintern?',
            ['Den sover i ett ide', 'Den flyger söderut', 'Den bygger ett bo i ett träd'], 'Den sover i ett ide',
            'Björnen hittar lite mat på vintern. Därför sover den i ett ide tills det blir vår.'),
        val('När brukar äpplena vara mogna att plocka?',
            ['På hösten', 'På vintern', 'På våren'], 'På hösten',
            'Äppelträdet blommar på våren. Äpplena växer hela sommaren och blir mogna på hösten.'),
        sant('Björkens löv är gröna på sommaren.', True,
             'På sommaren är löven gröna. På hösten blir de gula och faller av.'),
        val('Vad händer med vatten när det blir riktigt kallt?',
            ['Det fryser till is', 'Det blir varmt', 'Det blir till sand'], 'Det fryser till is',
            'När det är kallare än noll grader fryser vattnet till is.'),
        val('När får träden nya små löv?',
            ['På våren', 'På hösten', 'På vintern'], 'På våren',
            'På våren blir det varmare och ljusare. Då slår träden ut och får nya löv.'),
        sant('På vintern blommar det mycket i skogen.', False,
             'På vintern är det för kallt och mörkt. Blommorna kommer på våren och sommaren.'),
    ], beskrivning=blad('Hur naturen, ljuset och djuren ändras mellan årstiderna.', T_ARSTIDER)),

    niva('no-ak1-blad-vader-1', 'Vädret', 'Väder och kläder', [
        val('Vad kan falla från himlen när det är kallt ute?',
            ['Snö', 'Sand', 'Löv av glas'], 'Snö',
            'När det är kallt fryser vattnet i molnen till små snöflingor som faller ner.'),
        val('När kan det bli en regnbåge?',
            ['När solen lyser och det regnar', 'När det är mörkt på natten', 'När det snöar och är molnigt'],
            'När solen lyser och det regnar',
            'Solens ljus går genom regndropparna och delas upp i alla färger.'),
        val('Vad visar en termometer?',
            ['Hur varmt eller kallt det är', 'Hur mycket klockan är', 'Hur långt det är till skolan'],
            'Hur varmt eller kallt det är',
            'Termometern mäter temperaturen, alltså hur varmt eller kallt det är.'),
        sant('Is smälter när det blir varmt.', True,
             'När det blir varmare än noll grader smälter isen och blir vatten igen.'),
        val('Vad kallas det när det blåser väldigt hårt?',
            ['Storm', 'Dimma', 'Frost'], 'Storm',
            'En storm är en mycket stark vind. Dimma är moln nära marken och frost är is på marken.'),
        val('När kan man åka pulka?',
            ['När det ligger snö', 'När det är varmt och soligt', 'När det regnar på sommaren'],
            'När det ligger snö',
            'Pulkan glider på snö. Utan snö går det inte.'),
        sant('Moln består av små droppar vatten eller små bitar is.', True,
             'Moln är massor av pyttesmå vattendroppar eller iskristaller som svävar i luften.'),
        val('Var kommer regnet ifrån?',
            ['Från molnen', 'Från solen', 'Från månen'], 'Från molnen',
            'Dropparna i molnen slås ihop och blir tunga. Då faller de ner som regn.'),
        sant('Solen ger oss ljus och värme.', True,
             'Solen lyser och värmer jorden. Utan solen skulle det vara mörkt och kallt.'),
    ], beskrivning=blad('Vädret under året: snö, regn, vind och temperatur.', T_ARSTIDER)),

    niva('no-ak1-blad-vader-2', 'Kläder för vädret', 'Väder och kläder', [
        val('Vad har du på dig en kall vinterdag?',
            ['Mössa och vantar', 'Shorts och sandaler', 'Baddräkt'], 'Mössa och vantar',
            'När det är kallt behöver du varma kläder, till exempel mössa, vantar och vinterjacka.'),
        val('Vad passar bäst en varm sommardag?',
            ['Shorts och t-shirt', 'Vinterjacka och halsduk', 'Tjocka vantar'], 'Shorts och t-shirt',
            'När det är varmt behöver du tunna kläder så att du inte blir för varm.'),
        val('Vad är bra att ha på sig när det regnar?',
            ['Regnjacka och stövlar', 'Sandaler och linne', 'Solglasögon och keps'], 'Regnjacka och stövlar',
            'Regnjackan och stövlarna släpper inte in vatten. Då håller du dig torr.'),
        sant('Vantar håller händerna varma.', True,
             'Vantarna håller kvar värmen runt händerna när det är kallt.'),
        val('Vad skyddar huvudet mot stark sol?',
            ['En solhatt', 'Ett par vantar', 'Ett par stövlar'], 'En solhatt',
            'En hatt ger skugga, så att du inte bränner dig i solen.'),
        val('Vilken årstid behöver du oftast mössa och vantar?',
            ['Vintern', 'Sommaren', 'Ingen årstid'], 'Vintern',
            'Vintern är kallast. Då behövs mössa och vantar.'),
        val('När är det extra viktigt att ha en reflex på sig?',
            ['När det är mörkt ute', 'När solen skiner', 'När du är inne'], 'När det är mörkt ute',
            'I mörkret lyser reflexen när en bils lampor träffar den. Då ser bilisten dig.'),
        sant('Flera lager kläder håller dig varm när det är kallt.', True,
             'Mellan lagren finns luft som håller kvar värmen.'),
        val('Vilken årstid passar bäst för att bada i en sjö?',
            ['Sommaren', 'Vintern', 'Hösten'], 'Sommaren',
            'På sommaren har solen värmt vattnet. På vintern är sjön kall eller frusen.'),
    ], beskrivning=blad('Att välja kläder efter väder och årstid.', T_ARSTIDER)),
])


# ======================================================================
# Åk 2: Växtens delar
# ======================================================================
T_VAXT = 'Växtens delar'

AK2 = bana(AMNE, 'ak2', [
    niva('no-ak2-blad-vaxtens-delar-1', 'Delarna och vad de gör', 'Växtens delar', [
        val('Vilken del av växten tar upp vatten ur jorden?',
            ['Roten', 'Blomman', 'Bladet'], 'Roten',
            'Rötterna växer ner i jorden. Där tar de upp vatten åt hela växten.'),
        val('Vilken del av växten bär upp den?',
            ['Stjälken', 'Roten', 'Blomman'], 'Stjälken',
            'Stjälken är växtens stöd. Den håller upp bladen och blomman mot ljuset.'),
        val('Vilken del av växten gör frön?',
            ['Blomman', 'Stjälken', 'Roten'], 'Blomman',
            'I blomman bildas fröna. Ur dem kan det växa nya växter.'),
        val('Vilken del av växten fångar solens ljus?',
            ['Bladet', 'Roten', 'Fröet'], 'Bladet',
            'Bladen är platta och breda så att de kan fånga mycket ljus.'),
        para('Para ihop delen med vad den gör.',
             [('Roten', 'Tar upp vatten och håller fast växten'),
              ('Stjälken', 'Bär upp växten'),
              ('Bladet', 'Fångar solens ljus'),
              ('Blomman', 'Gör frön')],
             'Varje del har ett eget jobb. Tillsammans får de växten att leva och växa.'),
        sant('Roten håller fast växten i jorden.', True,
             'Rötterna sprider sig i jorden och håller fast växten, så att den inte blåser omkull.'),
        val('Var finns roten?',
            ['Under jorden', 'Högst upp på växten', 'Inne i blomman'], 'Under jorden',
            'Roten växer nere i jorden. Där finns vattnet som växten behöver.'),
        sant('Stjälken leder vatten från roten upp till bladen.', True,
             'Inne i stjälken finns smala rör som vattnet går upp genom.'),
        val('Vilken färg har de flesta blad på sommaren?',
            ['Gröna', 'Blå', 'Svarta'], 'Gröna',
            'Bladen är gröna av ett ämne som hjälper dem att fånga ljuset.'),
    ], beskrivning=blad('Växtens delar, rot, stjälk, blad och blomma, och vad var och en gör.', T_VAXT)),

    niva('no-ak2-blad-vaxtens-delar-2', 'Vad en växt behöver', 'Växtens delar', [
        val('Vad behöver en växt för att kunna växa?',
            ['Vatten, ljus och luft', 'Bara mörker och kyla', 'Bara sand och sten'], 'Vatten, ljus och luft',
            'En växt behöver vatten, ljus, luft, näring ur jorden och värme.'),
        sant('En växt kan växa hur länge som helst i ett helt mörkt skåp.', False,
             'Utan ljus kan bladen inte göra någon mat åt växten. Då dör den till slut.'),
        val('Vad händer med en blomma som aldrig får vatten?',
            ['Den vissnar och dör', 'Den växer fortare', 'Den blir större och grönare'], 'Den vissnar och dör',
            'En växt behöver vatten för att leva. Utan vatten vissnar den.'),
        val('Var tar växten upp näring ifrån?',
            ['Ur jorden', 'Ur blomman', 'Ur luften i ett skåp'], 'Ur jorden',
            'Rötterna tar upp vatten med näring ur jorden.'),
        sant('Växter behöver värme för att växa bra.', True,
             'När det är kallt växer det nästan inget. Därför växer det mest på våren och sommaren.'),
        val('När växer växterna mest i Sverige?',
            ['På våren och sommaren', 'På vintern', 'Mitt i natten på vintern'], 'På våren och sommaren',
            'På våren och sommaren är det ljust och varmt länge. Det behöver växterna.'),
        val('Vad gör bladen med solens ljus?',
            ['De gör mat åt växten', 'De gör vatten åt roten', 'De gör sten av jorden'], 'De gör mat åt växten',
            'Bladen använder ljuset, vatten och luft för att göra socker, som är växtens mat.'),
        sant('Växter ger oss syre att andas.', True,
             'När bladen gör mat åt växten släpper de ut syre. Det andas vi in.'),
        val('Varför vänder sig en krukväxt mot fönstret?',
            ['För att få mer ljus', 'För att få mer kyla', 'För att slippa vatten'], 'För att få mer ljus',
            'Ljuset kommer in genom fönstret. Växten växer mot ljuset för att få så mycket som möjligt.'),
    ], beskrivning=blad('Vad en växt behöver för att växa, och vad som händer utan vatten och ljus.', T_VAXT)),

    niva('no-ak2-blad-vaxter-och-vi-1', 'Från frö till växt', 'Växter och vi', [
        ordna('Ordna hur en ny växt blir till.',
              ['Ett frö läggs i jorden', 'Fröet gror', 'En liten planta växer', 'Växten blommar',
               'Blomman gör nya frön'],
              forklaring='Fröet gror och blir en planta. Plantan växer och blommar, och i blomman bildas nya frön.'),
        val('Vad behöver ett frö för att börja gro?',
            ['Vatten och värme', 'Is och mörker', 'Bara sten'], 'Vatten och värme',
            'Ett frö gror när det får vatten och det är tillräckligt varmt.'),
        sant('En ek växer ur ett ekollon.', True,
             'Ekollonet är ekens frö. Ur det kan en ny ek växa.'),
        val('Vad heter det när ett frö börjar växa?',
            ['Det gror', 'Det vissnar', 'Det smälter'], 'Det gror',
            'När fröet får vatten och värme spricker det och en liten grodd kommer ut. Det kallas att gro.'),
        val('Vilket djur flyger mellan blommor och hjälper dem att göra frön?',
            ['Biet', 'Igelkotten', 'Fisken'], 'Biet',
            'Biet tar med sig pollen från blomma till blomma. Då kan blommorna göra frön.'),
        sant('Alla frön är lika stora.', False,
             'Frön är olika stora. Ett kokosnötsfrö är jättestort och ett maskrosfrö är pyttelitet.'),
        val('Var sitter kärnorna i ett äpple?',
            ['I mitten av äpplet', 'På skalet', 'I äpplets skaft'], 'I mitten av äpplet',
            'Kärnorna är äppelträdets frön. De sitter i kärnhuset mitt i äpplet.'),
        val('Hur sprids maskrosens frön?',
            ['Med vinden', 'Med regnet uppåt', 'De sprids aldrig'], 'Med vinden',
            'Maskrosens frön har små fallskärmar som vinden tar med sig långt bort.'),
        sant('Ur ett frö kan det växa en ny växt.', True,
             'Inne i fröet finns en liten växt och mat åt den, tills den kan göra egen mat.'),
    ], beskrivning=blad('Hur en växt blir till: frö, groning, blomma och nya frön.', T_VAXT)),

    niva('no-ak2-blad-vaxter-och-vi-2', 'Det vi får av växter', 'Växter och vi', [
        val('Vilket av detta kommer från en växt?',
            ['Ett äpple', 'En sten', 'Ett glas'], 'Ett äpple',
            'Äpplet växer på ett äppelträd. Sten och glas kommer inte från växter.'),
        val('Vad görs papper av?',
            ['Trä', 'Sten', 'Plast'], 'Trä',
            'Papper görs av trä från träd, till exempel gran och tall.'),
        val('Vad görs mjölet i bröd av?',
            ['Vete', 'Mjölk', 'Sand'], 'Vete',
            'Vete är ett sädesslag. Kornen mals till mjöl som man bakar bröd av.'),
        sant('En morot är en rot som vi äter.', True,
             'Moroten är plantans rot. Den växer under jorden.'),
        val('Vilken del av potatisplantan äter vi?',
            ['Knölarna under jorden', 'Blommorna högst upp', 'Bladen på stjälken'], 'Knölarna under jorden',
            'Potatisen växer under jorden. Plantans blad och bär ska man inte äta.'),
        sant('Bomull, som vi gör kläder av, kommer från en växt.', True,
             'Bomull är fina trådar som växer runt fröna på bomullsplantan.'),
        val('Vilken gas ger träden oss som vi andas?',
            ['Syre', 'Rök', 'Ånga'], 'Syre',
            'Träd och andra växter släpper ut syre när de gör sin mat.'),
        val('Vilken del av salladen äter vi?',
            ['Bladen', 'Rötterna', 'Fröna'], 'Bladen',
            'Sallad är en växt där vi äter de stora gröna bladen.'),
        para('Para ihop växten med den del vi äter.',
             [('Morot', 'Roten'), ('Sallad', 'Bladen'), ('Äpple', 'Frukten'), ('Ärta', 'Fröet')],
             'Vi äter olika delar av olika växter: rötter, blad, frukter och frön.'),
    ], beskrivning=blad('Det vi människor får av växter: mat, papper, kläder och syre.', T_VAXT)),
])


# ======================================================================
# Åk 6: Krafter i vardagen och Igelkotten går i ide (tillägg)
# ======================================================================
T_KRAFTER = 'Krafter i vardagen'
T_IGELKOTT = 'Igelkotten går i ide'

# Ungefär 10 N per kilogram.
LADA_KG = 5
LADA_N = LADA_KG * 10

IGELKOTT_TEXT = (
    'Igelkotten är ett av de däggdjur i Sverige som går i ide. När hösten kommer äter den mycket för att '
    'bygga upp ett lager av fett. Sedan bygger den ett bo av löv och gräs, gärna under en buske eller i en '
    'komposthög. Där sover den ungefär från november till april.\n\n'
    'Under vintern sjunker kroppstemperaturen och hjärtat slår mycket långsammare än vanligt. Då går det åt '
    'lite energi. Om igelkotten väcks för tidigt gör den av med för mycket av sitt fett och kan få svårt att '
    'klara resten av vintern. Därför ska man inte flytta på lövhögar i trädgården på vintern.')

AK6 = bana(AMNE, 'ak6', [
    niva('no-ak6-blad-krafter-1', 'Gravitation och friktion', 'Krafter i vardagen', [
        val('Vilken kraft gör att ett äpple faller till marken?',
            ['Gravitationen', 'Friktionen', 'Magnetismen'], 'Gravitationen',
            'Gravitationen, tyngdkraften, drar alla saker mot jorden.'),
        val('Vilken kraft bromsar cykeln när du trycker på bromsen?',
            ['Friktionen', 'Gravitationen', 'Luftens lyftkraft'], 'Friktionen',
            'Bromsklossarna trycks mot hjulet. Friktionen mellan dem bromsar hjulet.'),
        val('Vad mäter vi krafter i?',
            ['Newton', 'Kilogram', 'Meter'], 'Newton',
            'Kraft mäts i newton, N. Kilogram är massa och meter är längd.'),
        sant('En kraft kan få ett föremål att ändra form.', True,
             'När du klämmer på en boll av lera ändrar den form. Det är en kraft som gör det.'),
        val('Varför är det lättare att gå på torr asfalt än på blank is?',
            ['Asfalten ger stor friktion, så skon får fäste, men isen ger liten friktion så foten glider',
             'Asfalten ger liten friktion, så skon glider lätt framåt, men isen ger stor friktion som bromsar',
             'Gravitationen är starkare på asfalten och trycker ner foten, men på isen är gravitationen svagare'],
            'Asfalten ger stor friktion, så skon får fäste, men isen ger liten friktion så foten glider',
            'Friktion mellan skon och marken ger fäste. Blank is är hal och ger liten friktion.'),
        val('I vilket exempel är friktionen till hjälp?',
            ['Däcken får fäste på vägen', 'Det är tungt att skjuta en låda', 'Cykelkedjan slits'],
            'Däcken får fäste på vägen',
            'Utan friktion skulle däcken snurra utan att bilen kom framåt, och bromsarna skulle inte fungera.'),
        val('I vilket exempel är friktionen besvärlig?',
            ['Det är tungt att skjuta en låda över golvet', 'Skorna får fäste på trappan',
             'Bromsarna stoppar cykeln'],
            'Det är tungt att skjuta en låda över golvet',
            'Friktionen mellan lådan och golvet motverkar rörelsen, så du måste ta i mer.'),
        val('Åt vilket håll drar gravitationen en sak som du släpper?',
            ['Nedåt, mot jorden', 'Uppåt, mot himlen', 'Åt sidan, med vinden'], 'Nedåt, mot jorden',
            'Gravitationen drar alla saker mot jordens mitt. Därför faller de nedåt.'),
        sant('Friktionen på en låda som skjuts över golvet verkar åt samma håll som lådan rör sig.', False,
             'Friktionen motverkar rörelsen. Den verkar åt motsatt håll mot hur lådan glider.'),
    ], beskrivning=blad('Gravitation, friktion och enheten newton, och när friktionen hjälper eller stör.', T_KRAFTER)),

    niva('no-ak6-blad-krafter-2', 'Krafter som verkar på saker', 'Krafter i vardagen', [
        val('Vad kan en kraft göra med en boll?',
            ['Få den att börja rulla, stanna eller byta riktning',
             'Bara få den att börja rulla, men aldrig att stanna',
             'Göra den lättare eller tyngre utan att röra den'],
            'Få den att börja rulla, stanna eller byta riktning',
            'En kraft kan få något att börja röra sig, stanna, ändra riktning eller ändra form.'),
        val('Vad mäter man en kraft med?',
            ['En kraftmätare', 'En termometer', 'Ett måttband'], 'En kraftmätare',
            'En kraftmätare har en fjäder som dras ut mer ju större kraften är.'),
        skriv('På jorden dras varje kilogram ned med ungefär 10 N. Ungefär hur många newton drar gravitationen '
              'i en väska på %d kg?' % LADA_KG,
              prova(svar(LADA_N), '50', '50 N'),
              '%d kg · 10 N per kg = %d N.' % (LADA_KG, LADA_N)),
        val('Vad är luftmotstånd?',
            ['En kraft från luften som bromsar det som rör sig genom den',
             'En kraft från luften som drar allt uppåt mot himlen',
             'En kraft från jorden som drar luften nedåt mot marken'],
            'En kraft från luften som bromsar det som rör sig genom den',
            'Luftmotståndet är en sorts friktion mot luften. Ju fortare något rör sig, desto större blir det.'),
        sant('En fallskärm bromsar med hjälp av luftmotstånd.', True,
             'Fallskärmen är stor, så mycket luft tar emot den. Då blir luftmotståndet stort och farten liten.'),
        val('Hur kan man minska friktionen i en cykelkedja?',
            ['Smörja den med olja', 'Strö sand på den', 'Låta den rosta'], 'Smörja den med olja',
            'Oljan gör ytorna hala, så att de glider lättare mot varandra.'),
        val('Varför strör man sand på isiga vägar?',
            ['För att öka friktionen så att man inte halkar', 'För att göra isen halare så att man glider',
             'För att gravitationen ska bli mindre på vägen'],
            'För att öka friktionen så att man inte halkar',
            'Sanden gör ytan ojämn, så skor och däck får bättre fäste.'),
        sant('Två magneter kan dra i varandra utan att röra vid varandra.', True,
             'Magnetkraften verkar på avstånd, precis som gravitationen.'),
        val('En låda står stilla på golvet. Varför faller den inte genom golvet?',
            ['Golvet trycker uppåt på lådan lika mycket som gravitationen drar nedåt',
             'Gravitationen slutar verka på lådan så fort den står stilla på golvet',
             'Friktionen mellan lådan och luften håller upp lådan ovanför golvet'],
            'Golvet trycker uppåt på lådan lika mycket som gravitationen drar nedåt',
            'Två lika stora krafter åt motsatt håll tar ut varandra. Då står lådan still.'),
    ], beskrivning=blad('Vad krafter gör, hur de mäts, luftmotstånd och krafter som tar ut varandra.', T_KRAFTER)),

    niva('no-ak6-blad-igelkotten-1', 'Igelkotten går i ide', 'Läsa: djur på vintern', [
        val('Vad betyder det att igelkotten går i ide?',
            ['Den sover hela vintern med kroppen på sparlåga',
             'Den flyttar söderut till ett varmare land på vintern',
             'Den äter mer på vintern än under resten av året'],
            'Den sover hela vintern med kroppen på sparlåga',
            'I ide sover djuret länge, temperaturen sjunker och hjärtat slår långsamt, så det går åt lite energi.'),
        val('Varför äter igelkotten så mycket på hösten?',
            ['För att bygga upp ett lager av fett', 'För att den ska orka bygga ett stort bo',
             'För att den inte tycker om maten på våren'],
            'För att bygga upp ett lager av fett',
            'Fettet är den energi igelkotten lever på medan den sover hela vintern.'),
        val('Vad bygger igelkotten sitt bo av?',
            ['Löv och gräs', 'Pinnar och lera', 'Mossa och sten'], 'Löv och gräs',
            'Texten säger att boet byggs av löv och gräs.'),
        val('Var bygger igelkotten gärna sitt bo?',
            ['Under en buske eller i en komposthög', 'Högt upp i ett träd', 'Nere i en sjö'],
            'Under en buske eller i en komposthög',
            'Under en buske eller i en komposthög är boet skyddat.'),
        val('Ungefär när sover igelkotten?',
            ['Från november till april', 'Från maj till augusti', 'Bara i december'], 'Från november till april',
            'Texten säger ungefär från november till april.'),
        sant('Under vintern slår igelkottens hjärta snabbare än vanligt.', False,
             'Hjärtat slår mycket långsammare än vanligt. Då går det åt mindre energi.'),
        val('Vad händer om igelkotten väcks för tidigt?',
            ['Den gör av med för mycket fett och kan få svårt att klara vintern',
             'Den blir piggare och kan leta mat i snön resten av vintern',
             'Den bygger genast ett nytt bo och somnar om utan problem'],
            'Den gör av med för mycket fett och kan få svårt att klara vintern',
            'Vaken behöver kroppen mer energi, och fettet måste räcka hela vintern.'),
        val('Varför ska man inte flytta på lövhögar i trädgården på vintern?',
            ['En igelkott kan sova där och väckas', 'Löven blir blöta och tunga att bära',
             'Löven behövs för att smälta snön'],
            'En igelkott kan sova där och väckas',
            'En väckt igelkott gör av med för mycket av sitt fett.'),
        sant('Igelkotten är ett däggdjur.', True,
             'Texten börjar med att igelkotten är ett av de däggdjur i Sverige som går i ide.'),
    ], beskrivning=blad('Läsförståelse om hur igelkotten klarar vintern genom att gå i ide.', T_IGELKOTT),
        text=IGELKOTT_TEXT),
])


# ======================================================================
# Åk 7: Cellen (tillägg)
# ======================================================================
T_CELLEN = 'Cellen, livets minsta enhet'

AK7 = bana(AMNE, 'ak7', [
    niva('no-ak7-blad-cellen-1', 'Cellens delar', 'Cellens delar och fotosyntes', [
        skriv('Fyll i ordet som fattas: Cellen är livets ___ enhet.', 'minsta',
              'Alla levande varelser är byggda av celler. Mindre än så kan inget vara och ändå leva.'),
        val('Vilken del av cellen innehåller arvsmassan, DNA?',
            ['Cellkärnan', 'Cellmembranet', 'Vakuolen', 'Cytoplasman'], 'Cellkärnan',
            'DNA ligger i cellkärnan, som styr cellen.'),
        val('Vilken del omger cellen och bestämmer vad som får komma in och ut?',
            ['Cellmembranet', 'Cellkärnan', 'Kloroplasten', 'Mitokondrien'], 'Cellmembranet',
            'Cellmembranet är ett tunt hölje som släpper igenom vissa ämnen men inte andra.'),
        para('Para ihop cellens del med vad den gör.',
             [('Cellkärnan', 'Innehåller DNA och styr cellen'),
              ('Cellmembranet', 'Släpper in och ut ämnen'),
              ('Mitokondrien', 'Frigör energi ur druvsocker'),
              ('Kloroplasten', 'Gör fotosyntes'),
              ('Cellväggen', 'Ger växtcellen en stel form')],
             'Varje del har sin uppgift. Kloroplaster och cellvägg finns bara i växtceller.'),
        val('Vilka delar finns bara i växtceller?',
            ['Cellvägg, kloroplaster och en stor vakuol', 'Cellkärna, cellmembran och cytoplasma',
             'Mitokondrier, cellmembran och cellkärna'],
            'Cellvägg, kloroplaster och en stor vakuol',
            'Cellkärna, cellmembran, cytoplasma och mitokondrier finns i båda sorterna.'),
        sant('Djurceller har mitokondrier.', True,
             'Både djurceller och växtceller har mitokondrier, som frigör energi.'),
        sant('Djurceller har en cellvägg.', False,
             'Djurceller har bara ett mjukt cellmembran. Cellväggen finns hos växtceller.'),
        val('Vad heter den geléaktiga massan som fyller cellen?',
            ['Cytoplasma', 'Klorofyll', 'Cellsaft', 'Membran'], 'Cytoplasma',
            'Cytoplasman fyller cellen, och i den ligger cellens andra delar.'),
        val('Varför kan en växtcell ha en fast form medan en djurcell är mjukare?',
            ['Växtcellen har en stel cellvägg och en vakuol som trycker utåt',
             'Växtcellen har fler mitokondrier som gör cellmembranet hårt',
             'Växtcellen har en större cellkärna som stöttar hela cellen'],
            'Växtcellen har en stel cellvägg och en vakuol som trycker utåt',
            'Cellväggen är stel och vakuolen fylld med vätska. Djurcellen har bara ett mjukt membran.'),
    ], beskrivning=blad('Cellens delar och deras uppgifter, och skillnaden mellan växtceller och djurceller.', T_CELLEN)),

    niva('no-ak7-blad-cellen-2', 'Fotosyntes och cellandning', 'Cellens delar och fotosyntes', [
        val('Vad sker i kloroplasterna?',
            ['Fotosyntes', 'Cellandning', 'Celldelning'], 'Fotosyntes',
            'I kloroplasterna gör växten druvsocker av koldioxid och vatten med hjälp av ljus.'),
        val('Vad är mitokondriernas uppgift?',
            ['Att frigöra energin i druvsocker med hjälp av syre',
             'Att fånga solljus och tillverka druvsocker av koldioxid',
             'Att bestämma vilka ämnen som får komma in i cellen'],
            'Att frigöra energin i druvsocker med hjälp av syre',
            'Det kallas cellandning. Mitokondrierna brukar kallas cellens kraftverk.'),
        val('Fotosyntesen: koldioxid + ___ + ljus → druvsocker + syre. Vad fattas?',
            ['Vatten', 'Syre', 'Kväve', 'Salt'], 'Vatten',
            'Växten tar upp vatten med rötterna och koldioxid ur luften.'),
        val('Fotosyntesen: koldioxid + vatten + ljus → druvsocker + ___. Vad fattas?',
            ['Syre', 'Koldioxid', 'Kväve', 'Vatten'], 'Syre',
            'Syret släpps ut i luften. Det är det syre vi andas.'),
        sant('Cellandning sker både i växtceller och i djurceller.', True,
             'Alla celler behöver energi, och båda sorterna har mitokondrier.'),
        val('Vilket ämne gör kloroplasterna gröna?',
            ['Klorofyll', 'Cytoplasma', 'Druvsocker'], 'Klorofyll',
            'Klorofyllet är grönt och fångar ljusets energi.'),
        val('Vad bildas vid cellandningen?',
            ['Koldioxid och vatten, och energi frigörs', 'Druvsocker och syre, och ljus tas upp',
             'Klorofyll och syre, och värme tas upp'],
            'Koldioxid och vatten, och energi frigörs',
            'Druvsocker + syre → koldioxid + vatten. Det är fotosyntesen baklänges.'),
        sant('Växter tar upp koldioxid ur luften när de gör fotosyntes.', True,
             'Koldioxiden är en av de två råvarorna i fotosyntesen.'),
        val('Var kommer energin i fotosyntesen ifrån?',
            ['Från solljuset', 'Från jorden', 'Från syret i luften'], 'Från solljuset',
            'Ljusets energi lagras i druvsockret. Den frigörs sedan vid cellandningen.'),
    ], beskrivning=blad('Fotosyntesen i kloroplasterna och cellandningen i mitokondrierna.', T_CELLEN)),
])


# ======================================================================
# Åk 8: Atomer och grundämnen (tillägg)
# ======================================================================
T_ATOMER = 'Atomer och grundämnen'

METAN_ATOMER = 1 + 4
GLUKOS_H = 12

AK8 = bana(AMNE, 'ak8', [
    niva('no-ak8-blad-atomer-1', 'Atomens delar', 'Atomens byggnad och formler', [
        para('Para ihop partikeln med dess laddning.',
             [('Proton', 'Positiv laddning'), ('Neutron', 'Ingen laddning'), ('Elektron', 'Negativ laddning')],
             'Protonerna är positiva, elektronerna negativa och neutronerna är oladdade.'),
        skriv('Kol har atomnummer 6. Hur många protoner har en kolatom?', svar(6),
              'Atomnumret är antalet protoner i kärnan.'),
        skriv('En neutral syreatom har 8 protoner. Hur många elektroner har den?', svar(8),
              'I en neutral atom är det lika många elektroner som protoner, så laddningarna tar ut varandra.'),
        skriv('Natrium har atomnummer 11. Hur många elektroner har en neutral natriumatom?', svar(11),
              'Atomnummer 11 betyder 11 protoner, och en neutral atom har lika många elektroner.'),
        val('Vad bestämmer vilket grundämne en atom är?',
            ['Antalet protoner', 'Antalet neutroner', 'Atomens storlek'], 'Antalet protoner',
            'Alla atomer med 6 protoner är kol, alla med 8 är syre.'),
        val('Var finns elektronerna i en atom?',
            ['Runt kärnan, i skal', 'Inne i kärnan', 'Mellan protonerna'], 'Runt kärnan, i skal',
            'Kärnan har protoner och neutroner. Elektronerna rör sig runt den.'),
        skriv('En heliumatom har 2 protoner, 2 neutroner och 2 elektroner. Hur många partiklar finns i kärnan?',
              svar(2 + 2),
              'Kärnan har protonerna och neutronerna: 2 + 2 = 4. Elektronerna är utanför kärnan.'),
        sant('En neutral atom har lika många elektroner som protoner.', True,
             'Plus och minus tar då ut varandra, så atomen saknar laddning.'),
        val('Vad är ett grundämnes atomnummer?',
            ['Antalet protoner i kärnan', 'Antalet neutroner i kärnan', 'Antalet atomer i en molekyl'],
            'Antalet protoner i kärnan',
            'Atomnumret är antalet protoner. Grundämnena står efter det i det periodiska systemet.'),
    ], beskrivning=blad('Atomens delar och laddningar, atomnummer och antalet elektroner i en neutral atom.', T_ATOMER)),

    niva('no-ak8-blad-atomer-2', 'Grundämnen, föreningar och formler', 'Atomens byggnad och formler', [
        para('Para ihop kemiska beteckningen med grundämnet.',
             [('H', 'Väte'), ('O', 'Syre'), ('C', 'Kol'), ('Na', 'Natrium'), ('Fe', 'Järn')],
             'Beteckningarna kommer ofta från latin: Na från natrium och Fe från ferrum, järn.'),
        val('Hur många atomer av varje sort finns i en vattenmolekyl, H₂O?',
            ['2 väteatomer och 1 syreatom', '1 väteatom och 2 syreatomer', '2 väteatomer och 2 syreatomer'],
            '2 väteatomer och 1 syreatom',
            'Den lilla tvåan gäller atomen före den, H. O står utan siffra, alltså en.'),
        skriv('Hur många atomer finns det sammanlagt i en molekyl koldioxid, CO₂?', svar(1 + 2),
              'En kolatom och två syreatomer: 1 + 2 = 3.'),
        skriv('Hur många atomer finns det sammanlagt i en molekyl metan, CH₄?', svar(METAN_ATOMER),
              'En kolatom och fyra väteatomer: 1 + 4 = 5.'),
        skriv('Druvsocker har formeln C₆H₁₂O₆. Hur många väteatomer finns i en molekyl?', svar(GLUKOS_H),
              'Siffran efter H är 12, alltså 12 väteatomer.'),
        val('Vilket av ämnena är ett grundämne?',
            ['Syre', 'Vatten', 'Salt', 'Koldioxid'], 'Syre',
            'Syre består av en sorts atomer. Vatten, salt och koldioxid har flera sorters atomer.'),
        val('Vilket av ämnena är en kemisk förening?',
            ['Vatten', 'Järn', 'Guld', 'Syre'], 'Vatten',
            'Vatten, H₂O, har två sorters atomer som sitter ihop: väte och syre.'),
        sant('Guld är ett grundämne.', True,
             'Guld, Au, består bara av guldatomer.'),
        val('Vad är skillnaden mellan ett grundämne och en kemisk förening?',
            ['Ett grundämne har en sorts atomer, en förening flera sorter som sitter ihop',
             'Ett grundämne har flera sorters atomer, en förening bara en sort som sitter ihop',
             'Ett grundämne är alltid en gas, en förening är alltid fast eller flytande'],
            'Ett grundämne har en sorts atomer, en förening flera sorter som sitter ihop',
            'Syre och järn är grundämnen. Vatten och koldioxid är kemiska föreningar.'),
    ], beskrivning=blad('Kemiska beteckningar och formler, grundämnen och kemiska föreningar.', T_ATOMER)),
])


# ======================================================================
# Åk 9: NP-träning och genomgångar (tillägg)
# ======================================================================
T_NP_BIO = 'NP-träning: biologi'
T_NP_FYS = 'NP-träning: fysik'
T_NP_KEM = 'NP-träning: kemi'
T_NP_NO = 'NP-träning: NO, undersöka och förklara'
T_GG_BIO = 'Genomgång: biologi inför provet'
T_GG_FYS = 'Genomgång: fysik inför provet'
T_GG_KEM = 'Genomgång: kemi inför provet'

# NP fysik: tv:n, elementet och cyklisten.
TV_W, TV_H = 60, 5
TV_KWH = F(TV_W * TV_H, 1000)
ELEMENT_U, ELEMENT_I = 230, F('4.0')
ELEMENT_P = ELEMENT_U * ELEMENT_I
CYKEL_KM, CYKEL_MIN = 12, 30
CYKEL_KMH = F(CYKEL_KM) / F(CYKEL_MIN, 60)
LAMPA_W, LAMPA_H = 11, 1000
LAMPA_KWH = F(LAMPA_W * LAMPA_H, 1000)
KOKARE_W, KOKARE_U = 2300, 230
KOKARE_A = F(KOKARE_W, KOKARE_U)
UGN_W, UGN_MIN = 2000, 30
UGN_KWH = F(UGN_W, 1000) * F(UGN_MIN, 60)
LOPARE_M, LOPARE_S = 100, F('12.5')
LOPARE_MS = LOPARE_M / LOPARE_S
assert (TV_KWH, ELEMENT_P, CYKEL_KMH, KOKARE_A, UGN_KWH, LOPARE_MS) == (F(3, 10), 920, 24, 10, 1, 8)

# Genomgången i fysik: g ≈ 9,8 N/kg, fläkten och Ohms lag.
G9 = F('9.8')
GG_KG = 5
GG_N = GG_KG * G9
FLAKT_W, FLAKT_H = 1500, 2
FLAKT_KWH = F(FLAKT_W * FLAKT_H, 1000)
OHM_R, OHM_I = 10, 2
OHM_U = OHM_R * OHM_I
assert (GG_N, FLAKT_KWH, OHM_U) == (49, 3, 20)

# Elsas undersökning: tid i sekunder vid 10, 30 och 60 °C.
ELSA = {10: 240, 30: 140, 60: 60}
ELSA_SKILLNAD = ELSA[10] - ELSA[60]

BIO_TEXT = '\n\n'.join([
    'Cellen',
    'Alla levande organismer består av celler. Både växt- och djurceller har cellkärna med DNA, cellmembran, '
    'cytoplasma och mitokondrier. Växtceller har dessutom cellvägg, kloroplaster och en stor vakuol.',
    'Fotosyntes och cellandning',
    'Fotosyntes: koldioxid + vatten → druvsocker + syre, med energi från solljus, i kloroplasterna. Cellandning: '
    'druvsocker + syre → koldioxid + vatten, och energi frigörs, i mitokondrierna. Processerna är varandras motsats.',
    'Ekosystem',
    'Producenter, som växter, bygger upp näring med hjälp av solljus. Konsumenter äter växter eller andra djur. '
    'Nedbrytare, som svampar och bakterier, bryter ner döda organismer så att näringsämnen går tillbaka till '
    'marken. Flera näringskedjor som hänger ihop bildar en näringsväv.',
    'Kroppen och hälsan',
    'Hjärtat pumpar blodet, lungorna tar upp syre och avger koldioxid, och njurarna renar blodet och bildar urin. '
    'Antibiotika fungerar mot bakterier men inte mot virus. Ett vaccin tränar immunförsvaret att känna igen ett '
    'smittämne.',
    'Arv',
    'Generna sitter i DNA och styr hur kroppen byggs upp. Vi får hälften av våra kromosomer från varje förälder.',
])

FYS_TEXT = '\n\n'.join([
    'Krafter och rörelse',
    'Medelhastighet = sträcka / tid. Kraft mäts i newton (N). Tyngden är kraften från jordens gravitation: ett '
    'föremål med massan 1 kg har tyngden ungefär 9,8 N. Tröghetslagen säger att ett föremål fortsätter i samma '
    'rörelse, eller står still, om ingen kraft påverkar det eller om krafterna som påverkar det tar ut varandra.',
    'Energi',
    'Energi kan varken skapas eller förstöras, bara omvandlas mellan olika former: rörelseenergi, lägesenergi, '
    'värme, kemisk energi, elektrisk energi och strålning. Förnybara energikällor som sol, vind och vatten tar inte '
    'slut, men fossila bränslen och uran gör det.',
    'Elektricitet',
    'Spänningen U mäts i volt, strömmen I i ampere och resistansen R i ohm, och U = R · I. Effekten är P = U · I och '
    'mäts i watt. Energi = effekt · tid, och 1 kWh är den energi som går åt när 1 000 W används i en timme.',
    'Ljud och ljus',
    'Ljud är vibrationer som sprids genom ett ämne, till exempel luft, och kan inte färdas i vakuum. Ljus kan '
    'färdas genom vakuum, med ungefär 300 000 km/s.',
])

KEM_TEXT = '\n\n'.join([
    'Atomer',
    'En atom har en kärna med protoner och neutroner, och elektroner runt kärnan. Antalet protoner, atomnumret, '
    'avgör vilket grundämne det är. I det periodiska systemet står grundämnena ordnade efter atomnummer.',
    'Ämnen',
    'Ett grundämne består av en sorts atomer, till exempel järn (Fe) eller syre (O₂). En kemisk förening består av '
    'flera sorters atomer som sitter ihop, till exempel vatten (H₂O). I en blandning är ämnena inte kemiskt bundna '
    'och kan skiljas åt, till exempel genom filtrering eller destillation.',
    'Kemiska reaktioner',
    'I en kemisk reaktion bildas nya ämnen, men atomerna försvinner inte: massan är densamma före och efter. Vid '
    'förbränning reagerar ett ämne med syre. När kol brinner bildas koldioxid.',
    'Syror och baser',
    'pH-skalan brukar anges från 0 till 14. Under 7 är surt, 7 är neutralt och över 7 är basiskt. En syra och en '
    'bas kan neutralisera varandra, och då bildas vatten och ett salt.',
])

ELSA_TEXT = (
    'Elsa vill undersöka om vattnets temperatur påverkar hur snabbt socker löser sig. Hon fyller tre glas med lika '
    'mycket vatten: 10 °C, 30 °C och 60 °C varmt. I varje glas lägger hon en sockerbit och mäter tiden tills '
    'sockret har löst sig helt.\n\n'
    'Elsas resultat: i vattnet som var 10 °C tog det %d sekunder, i vattnet som var 30 °C tog det %d sekunder och '
    'i vattnet som var 60 °C tog det %d sekunder tills sockret hade löst sig.' % (ELSA[10], ELSA[30], ELSA[60]))

AK9 = bana(AMNE, 'ak9', [
    # ---- Biologi
    niva('no-ak9-blad-np-biologi-1', 'Fotosyntes, ekosystem och kroppen', 'NP-träning: biologi', [
        val('Vilka ämnen går in i fotosyntesen?',
            ['Koldioxid och vatten', 'Druvsocker och syre', 'Syre och vatten', 'Koldioxid och syre'],
            'Koldioxid och vatten',
            'Växten tar koldioxid ur luften och vatten ur marken, och använder solljusets energi.'),
        val('Vilka ämnen bildas i fotosyntesen?',
            ['Druvsocker och syre', 'Koldioxid och vatten', 'Druvsocker och koldioxid', 'Syre och vatten'],
            'Druvsocker och syre',
            'Druvsockret är växtens näring och syret släpps ut i luften.'),
        val('Vad är skillnaden mellan en näringskedja och en näringsväv?',
            ['En kedja visar vem som äter vem i en rad, en väv är flera kedjor som hänger ihop',
             'En väv visar vem som äter vem i en rad, en kedja är flera vävar som hänger ihop',
             'En kedja visar bara växter och växtätare, en väv visar bara rovdjur och nedbrytare'],
            'En kedja visar vem som äter vem i en rad, en väv är flera kedjor som hänger ihop',
            'De flesta arter äter och äts av flera andra. Därför hänger kedjorna ihop till en väv.'),
        val('I en sjö äter gäddor abborre, och abborren äter djurplankton. Antalet abborrar minskar kraftigt. '
            'Vad händer troligen med gäddorna?',
            ['De får mindre mat och kan bli färre', 'De blir fler eftersom de slipper konkurrens',
             'Ingenting, för gäddor äter bara djurplankton'],
            'De får mindre mat och kan bli färre',
            'Abborren är gäddornas mat. Med färre abborrar får gäddorna svårare att hitta mat.'),
        val('I en sjö äter abborren djurplankton. Antalet abborrar minskar kraftigt. Vad händer troligen med '
            'djurplanktonet?',
            ['Det kan bli fler, eftersom färre abborrar äter det',
             'Det blir färre, eftersom abborrarna inte längre skyddar det',
             'Det dör ut, eftersom det behöver abborrar för att föröka sig'],
            'Det kan bli fler, eftersom färre abborrar äter det',
            'När ett rovdjur minskar blir bytet ofta fler. Då kan i sin tur växtplanktonet minska.'),
        val('Vilket organ pumpar runt blodet i kroppen?',
            ['Hjärtat', 'Njurarna', 'Lungorna', 'Levern'], 'Hjärtat',
            'Hjärtat är en muskel som pumpar blodet genom blodkärlen.'),
        val('Vilket organ renar blodet och bildar urin?',
            ['Njurarna', 'Hjärtat', 'Lungorna', 'Magsäcken'], 'Njurarna',
            'Njurarna filtrerar bort avfallsämnen ur blodet, och de lämnar kroppen med urinen.'),
        val('Varför hjälper inte antibiotika mot en förkylning?',
            ['Förkylning orsakas av virus, och antibiotika verkar bara mot bakterier',
             'Förkylning orsakas av bakterier, som alltid är resistenta mot antibiotika',
             'Antibiotika verkar bara i magen, och förkylningen sitter i näsan'],
            'Förkylning orsakas av virus, och antibiotika verkar bara mot bakterier',
            'Antibiotika slår mot delar som bakterier har men som virus saknar.'),
        val('Vilken av organismerna är en producent?',
            ['En gran', 'En räv', 'En svamp', 'En hare'], 'En gran',
            'Producenter bygger sin egen näring med solljus. Svampen är en nedbrytare och räven och haren konsumenter.'),
    ], beskrivning=blad('Fotosyntes, näringskedjor och näringsvävar, kroppens organ och antibiotika, i provets stil.', T_NP_BIO)),

    niva('no-ak9-blad-np-biologi-2', 'Resistens och att ta ställning', 'NP-träning: biologi', [
        val('Vad betyder det att bakterier har blivit resistenta mot antibiotika?',
            ['Antibiotikan dödar dem inte längre', 'De har förvandlats till virus',
             'De kan inte längre göra någon sjuk'],
            'Antibiotikan dödar dem inte längre',
            'Resistenta bakterier tål medicinen och kan fortsätta föröka sig.'),
        ordna('Ordna hur resistenta bakterier blir vanliga.',
              ['Några bakterier tål antibiotikan, av en slump',
               'Antibiotikan dödar de känsliga bakterierna',
               'De resistenta överlever och förökar sig',
               'Till slut är de flesta bakterierna resistenta'],
              forklaring='Mutationer gör att några bakterier tål medlet. Antibiotikan väljer ut dem, och de tar över.'),
        val('Varför är antibiotikaresistens ett problem för hela samhället?',
            ['Vanliga infektioner blir svåra att bota och operationer blir riskablare',
             'Resistenta bakterier smittar bara djur och gör maten dyrare för alla',
             'Resistens gör att vacciner slutar fungera mot alla sjukdomar som finns'],
            'Vanliga infektioner blir svåra att bota och operationer blir riskablare',
            'Utan verksam antibiotika kan en vanlig infektion bli farlig, och vården blir dyrare.'),
        sant('Att använda antibiotika i onödan ökar risken för resistenta bakterier.', True,
             'Varje gång antibiotika används får de bakterier som tål den en fördel.'),
        val('Vilket är ett argument för att köpa ekologiskt odlad mat?',
            ['Odlingen använder inga kemiskt syntetiska bekämpningsmedel, vilket kan gynna den biologiska mångfalden',
             'Odlingen ger alltid större skördar per yta, så det behövs mindre mark för samma mat',
             'Maten blir alltid billigare än annan mat, så fler familjer har råd att köpa den'],
            'Odlingen använder inga kemiskt syntetiska bekämpningsmedel, vilket kan gynna den biologiska mångfalden',
            'Ekologisk odling har oftast mindre skörd per yta och högre pris. Det är argument emot.'),
        val('Vilket är ett argument emot att köpa ekologiskt odlad mat?',
            ['Skörden per yta blir oftast mindre, så det behövs mer mark för samma mängd mat',
             'Odlingen använder mer kemiskt syntetiska bekämpningsmedel, som skadar bin och andra insekter',
             'Maten innehåller mer konstgödsel, som rinner ut i sjöar och hav och göder alger'],
            'Skörden per yta blir oftast mindre, så det behövs mer mark för samma mängd mat',
            'Ekologisk odling använder varken kemiskt syntetiska bekämpningsmedel eller konstgödsel.'),
        val('Vad gör ett vaccin?',
            ['Det tränar immunförsvaret att känna igen ett smittämne',
             'Det dödar bakterierna som redan finns i kroppen',
             'Det gör att kroppen aldrig mer kan bli sjuk av något'],
            'Det tränar immunförsvaret att känna igen ett smittämne',
            'Kroppen lär sig känna igen smittämnet och kan slå ut det snabbt nästa gång.'),
        sant('Ett vaccin innehåller antibiotika.', False,
             'Ett vaccin tränar immunförsvaret. Antibiotika är ett läkemedel mot bakterier.'),
    ], beskrivning=blad('Antibiotikaresistens, vaccin och att väga argument om ekologisk mat, i provets stil.', T_NP_BIO)),

    niva('no-ak9-blad-genomgang-biologi-1', 'Läs genomgången i biologi', 'NP-träning: biologi', [
        val('Vilka delar finns enligt texten bara i växtceller?',
            ['Cellvägg, kloroplaster och en stor vakuol', 'Cellkärna, cellmembran och cytoplasma',
             'Mitokondrier och cellkärna'],
            'Cellvägg, kloroplaster och en stor vakuol',
            'Texten räknar upp dem som det växtceller har dessutom.'),
        val('Var sker fotosyntesen?',
            ['I kloroplasterna', 'I mitokondrierna', 'I cellkärnan'], 'I kloroplasterna',
            'Fotosyntesen sker i kloroplasterna, med energi från solljus.'),
        val('Var sker cellandningen?',
            ['I mitokondrierna', 'I kloroplasterna', 'I cellväggen'], 'I mitokondrierna',
            'Cellandningen frigör energi i mitokondrierna.'),
        val('Vad gör nedbrytarna i ett ekosystem?',
            ['Bryter ner döda organismer så att näringsämnen går tillbaka till marken',
             'Bygger upp näring med hjälp av solljus och ger syre till de andra',
             'Äter levande växter och blir själva mat åt rovdjuren i näringskedjan'],
            'Bryter ner döda organismer så att näringsämnen går tillbaka till marken',
            'Svampar och bakterier är nedbrytare. Utan dem skulle näringen inte komma tillbaka.'),
        val('Vad kallas flera näringskedjor som hänger ihop?',
            ['En näringsväv', 'En näringspyramid', 'En cellandning'], 'En näringsväv',
            'Texten säger att flera näringskedjor som hänger ihop bildar en näringsväv.'),
        val('Vilket organ renar enligt texten blodet och bildar urin?',
            ['Njurarna', 'Lungorna', 'Hjärtat'], 'Njurarna',
            'Hjärtat pumpar och lungorna tar upp syre. Njurarna renar blodet.'),
        sant('Enligt texten fungerar antibiotika mot virus.', False,
             'Antibiotika fungerar mot bakterier men inte mot virus. Därför hjälper det inte mot influensa.'),
        val('Hur stor del av våra kromosomer får vi från varje förälder?',
            ['Hälften', 'Alla', 'En fjärdedel'], 'Hälften',
            'Hälften kommer från mamman och hälften från pappan.'),
        val('Hur beskriver texten fotosyntesen och cellandningen?',
            ['Som varandras motsats', 'Som samma process', 'Som processer bara hos djur'],
            'Som varandras motsats',
            'Det som bildas i den ena går åt i den andra.'),
    ], beskrivning=blad('Läsförståelse på faktabladet om celler, ekosystem, kroppen och arv.', T_GG_BIO),
        text=BIO_TEXT),

    # ---- Fysik
    niva('no-ak9-blad-np-fysik-1', 'Energi, effekt och hastighet', 'NP-träning: fysik', [
        skriv('En tv har effekten %d W och är på i %d timmar. Hur mycket energi går åt? Svara i kWh.' % (TV_W, TV_H),
              prova(svar(TV_KWH), '0,3', '0.3 kWh'),
              '%d W · %d h = %d Wh = %s kWh.' % (TV_W, TV_H, TV_W * TV_H, t(TV_KWH))),
        skriv('Ett element är anslutet till %d V och strömmen är %s A. Beräkna effekten i watt.'
              % (ELEMENT_U, '4,0'),
              svar(ELEMENT_P),
              'P = U · I = %d · 4,0 = %s W.' % (ELEMENT_U, t(ELEMENT_P))),
        skriv('En cyklist cyklar %d km på %d minuter. Vad är medelhastigheten i km/h?' % (CYKEL_KM, CYKEL_MIN),
              svar(CYKEL_KMH),
              '%d minuter är 0,5 h. %d km / 0,5 h = %s km/h.' % (CYKEL_MIN, CYKEL_KM, t(CYKEL_KMH))),
        skriv('En lampa på %d W lyser i %s timmar. Hur många kWh går åt?' % (LAMPA_W, tal(LAMPA_H)),
              svar(LAMPA_KWH),
              '%d W · %s h = %s Wh = %s kWh.' % (LAMPA_W, tal(LAMPA_H), tal(LAMPA_W * LAMPA_H), t(LAMPA_KWH))),
        val('Vad är skillnaden mellan massa och tyngd?',
            ['Massa mäts i kg och är lika överallt, tyngd är gravitationens kraft och mäts i N',
             'Tyngd mäts i kg och är lika överallt, massa är gravitationens kraft och mäts i N',
             'Massa och tyngd är samma sak, men massa används på jorden och tyngd i rymden'],
            'Massa mäts i kg och är lika överallt, tyngd är gravitationens kraft och mäts i N',
            'På månen har du samma massa men mindre tyngd, för månens gravitation är svagare.'),
        val('Varför smälter en isbit i ett varmt rum?',
            ['Energi går från den varmare luften till isen, så partiklarna rör sig mer och släpper taget',
             'Energi går från den kalla isen till luften, så partiklarna rör sig mindre och släpper taget',
             'Luften trycker på isen så att partiklarna pressas isär, utan att någon energi flyttas'],
            'Energi går från den varmare luften till isen, så partiklarna rör sig mer och släpper taget',
            'Värme går alltid från varmt till kallt. Med mer energi kan partiklarna inte hålla ihop i fast form.'),
        val('Vilket par består av två förnybara energikällor?',
            ['Sol och vind', 'Olja och vind', 'Uran och sol', 'Kol och naturgas'], 'Sol och vind',
            'Sol och vind tar inte slut. Olja, kol, naturgas och uran gör det.'),
        val('Vilken energikälla är inte förnybar?',
            ['Uran', 'Vattenkraft', 'Vindkraft', 'Biobränsle'], 'Uran',
            'Uran bryts i gruvor och tar slut. De andra förnyas av solen.'),
        val('Varför skyddar bilbältet vid en krock?',
            ['Kroppen fortsätter framåt av tröghet, och bältet ger kraften som bromsar den',
             'Bältet gör kroppen tyngre, så att den inte rör sig framåt när bilen stannar',
             'Bältet tar bort trögheten, så att kroppen stannar samtidigt som bilen utan kraft'],
            'Kroppen fortsätter framåt av tröghet, och bältet ger kraften som bromsar den',
            'Tröghetslagen: utan en kraft fortsätter kroppen med samma fart när bilen tvärstannar.'),
    ], beskrivning=blad('Energi och effekt, medelhastighet, massa och tyngd, energikällor och tröghet, i provets stil.', T_NP_FYS)),

    niva('no-ak9-blad-np-fysik-2', 'Kärnkraft, el och tröghet', 'NP-träning: fysik', [
        val('Vilket är ett argument för mer kärnkraft?',
            ['Den ger mycket låga koldioxidutsläpp och jämn el oavsett väder',
             'Den ger inget avfall alls och kostar mindre att bygga än vindkraft',
             'Den kan byggas på några veckor och kräver ingen säkerhetskontroll'],
            'Den ger mycket låga koldioxidutsläpp och jämn el oavsett väder',
            'Kärnkraften ger lite koldioxid och går dygnet runt. Avfallet och kostnaden talar emot.'),
        val('Vilket är ett argument emot mer kärnkraft?',
            ['Det radioaktiva avfallet måste förvaras säkert i omkring 100 000 år',
             'Kraftverken släpper ut mer koldioxid än kolkraftverk av samma storlek',
             'Elen går bara att använda när det blåser eller när solen skiner'],
            'Det radioaktiva avfallet måste förvaras säkert i omkring 100 000 år',
            'Använt kärnbränsle strålar länge. Risken för olyckor och höga kostnader är andra argument emot.'),
        sant('Ett kärnkraftverk kan ge el oavsett om det blåser eller är soligt.', True,
             'Kärnkraften är inte beroende av vädret, till skillnad från sol och vind.'),
        skriv('Hur många wattimmar, Wh, är 1 kWh?', svar(1000),
              'k betyder tusen: 1 kWh = 1 000 Wh.'),
        skriv('En vattenkokare har effekten %s W och är ansluten till %d V. Hur stor är strömmen i ampere?'
              % (tal(KOKARE_W), KOKARE_U),
              svar(KOKARE_A),
              'P = U · I, så I = P / U = %s / %d = %s A.' % (tal(KOKARE_W), KOKARE_U, t(KOKARE_A))),
        skriv('En ugn på %s W används i %d minuter. Hur många kWh går åt?' % (tal(UGN_W), UGN_MIN),
              svar(UGN_KWH),
              '%s W är 2 kW och %d minuter är 0,5 h. 2 kW · 0,5 h = %s kWh.' % (tal(UGN_W), UGN_MIN, t(UGN_KWH))),
        val('En astronaut åker från jorden till månen. Vad händer med hennes massa och tyngd?',
            ['Massan är densamma men tyngden blir mindre', 'Både massan och tyngden blir mindre',
             'Tyngden är densamma men massan blir mindre'],
            'Massan är densamma men tyngden blir mindre',
            'Massan är hur mycket materia hon består av. Tyngden beror på gravitationen, som är svagare på månen.'),
        skriv('En löpare springer %d m på 12,5 s. Vad är medelhastigheten i m/s?' % LOPARE_M,
              svar(LOPARE_MS),
              'Medelhastighet = sträcka / tid = %d / 12,5 = %s m/s.' % (LOPARE_M, t(LOPARE_MS))),
        sant('När en bil bromsar förstörs rörelseenergin.', False,
             'Energi kan inte förstöras. Rörelseenergin omvandlas till värme i bromsarna.'),
    ], beskrivning=blad('Kärnkraftens för- och nackdelar, ström, energi i kWh och massa och tyngd, i provets stil.', T_NP_FYS)),

    niva('no-ak9-blad-genomgang-fysik-1', 'Läs genomgången i fysik', 'NP-träning: fysik', [
        skriv('Ungefär hur stor är tyngden i newton av ett föremål med massan 1 kg, enligt texten?', '9,8',
              'Texten säger ungefär 9,8 N för 1 kg.'),
        skriv('Ett föremål har massan %d kg. Hur stor är tyngden ungefär i newton? Räkna med 9,8 N per kg.' % GG_KG,
              prova(svar(GG_N, 50), '49', '50 N'),
              '%d · 9,8 = %s N, ungefär 50 N.' % (GG_KG, t(GG_N))),
        skriv('En värmefläkt på %s W används i %d timmar. Hur många kWh går åt?' % (tal(FLAKT_W), FLAKT_H),
              svar(FLAKT_KWH),
              '%s W är 1,5 kW. 1,5 kW · %d h = %s kWh.' % (tal(FLAKT_W), FLAKT_H, t(FLAKT_KWH))),
        val('Varför hörs inget ljud i rymden?',
            ['Ljud är vibrationer som behöver ett ämne att spridas genom, och rymden är nästan vakuum',
             'Ljud är strålning som stoppas av solens ljus, och i rymden lyser solen hela tiden',
             'Ljud färdas för långsamt i rymden, så det hinner aldrig fram till någon som lyssnar'],
            'Ljud är vibrationer som behöver ett ämne att spridas genom, och rymden är nästan vakuum',
            'Ljus kan färdas i vakuum men ljud kan inte det.'),
        val('Vad säger tröghetslagen enligt texten?',
            ['Ett föremål fortsätter i samma rörelse om inga krafter påverkar det eller om de tar ut varandra',
             'Ett föremål stannar alltid till slut av sig självt, även om inga krafter alls påverkar det',
             'Ett föremål rör sig alltid snabbare och snabbare om krafterna som påverkar det tar ut varandra'],
            'Ett föremål fortsätter i samma rörelse om inga krafter påverkar det eller om de tar ut varandra',
            'Det är därför en puck glider länge på is och kroppen fortsätter framåt när bilen bromsar.'),
        sant('Enligt texten kan energi omvandlas men varken skapas eller förstöras.', True,
             'Energin byter bara form, till exempel från rörelseenergi till värme.'),
        skriv('Resistansen är %d ohm och strömmen %d A. Hur stor är spänningen i volt? Använd U = R · I.'
              % (OHM_R, OHM_I),
              svar(OHM_U),
              'U = R · I = %d · %d = %d V.' % (OHM_R, OHM_I, OHM_U)),
        val('Hur fort färdas ljus enligt texten?',
            ['Ungefär 300 000 km/s', 'Ungefär 300 km/s', 'Ungefär 340 m/s'], 'Ungefär 300 000 km/s',
            '340 m/s är ungefär ljudets fart i luft. Ljuset är nästan en miljon gånger snabbare.'),
        val('Vilka energikällor tar slut enligt texten?',
            ['Fossila bränslen och uran', 'Sol, vind och vatten', 'Bara solenergi'], 'Fossila bränslen och uran',
            'Sol, vind och vatten är förnybara. Fossila bränslen och uran är det inte.'),
    ], beskrivning=blad('Läsförståelse och räkning på faktabladet om krafter, energi, el, ljud och ljus.', T_GG_FYS),
        text=FYS_TEXT),

    # ---- Kemi
    niva('no-ak9-blad-np-kemi-1', 'Ämnen, partiklar och pH', 'NP-träning: kemi', [
        val('Vad är skillnaden mellan ett grundämne och en kemisk förening?',
            ['Ett grundämne har en sorts atomer, till exempel järn, och en förening flera sorter, till exempel vatten',
             'Ett grundämne har flera sorters atomer, till exempel vatten, och en förening en sort, till exempel järn',
             'Ett grundämne är alltid en metall, till exempel järn, och en förening alltid en gas, till exempel vatten'],
            'Ett grundämne har en sorts atomer, till exempel järn, och en förening flera sorter, till exempel vatten',
            'Vatten, H₂O, består av väte och syre som sitter ihop. Järn, Fe, består bara av järnatomer.'),
        val('Vad händer med vattnets partiklar när vatten kokar?',
            ['De får mer energi, rör sig snabbare och lämnar vätskan som vattenånga',
             'De delas upp i väte och syre, som stiger upp ur kastrullen som gaser',
             'De blir större av värmen och tar därför mer plats än i vätskan'],
            'De får mer energi, rör sig snabbare och lämnar vätskan som vattenånga',
            'Molekylerna är fortfarande H₂O. Bara avståndet och rörelsen ändras.'),
        val('Vilka av ämnena är sura?',
            ['Citronsaft, ättika och läsk', 'Såpa och bikarbonat i vatten', 'Citronsaft och såpa',
             'Ättika och bikarbonat i vatten'],
            'Citronsaft, ättika och läsk',
            'Citronsaft, ättika och läsk har pH under 7. Såpa och bikarbonat i vatten är basiska.'),
        val('Vad visar pH-skalan?',
            ['Hur sur eller basisk en lösning är', 'Hur varm en lösning är', 'Hur mycket en lösning väger'],
            'Hur sur eller basisk en lösning är',
            'Under 7 är surt, 7 är neutralt och över 7 är basiskt.'),
        skriv('Vilket pH har en neutral lösning?', svar(7),
              'pH 7 är neutralt, varken surt eller basiskt.'),
        val('Kol brinner: kol + syre → ___. Vad bildas?',
            ['Koldioxid', 'Vatten', 'Väte', 'Syre'], 'Koldioxid',
            'Vid förbränning reagerar ämnet med syre. Kol och syre blir koldioxid, CO₂.'),
        val('Varför rostar järn snabbare vid havet än inne i landet?',
            ['Luften innehåller salt och fukt, och saltet får järnet att reagera fortare med syre och vatten',
             'Luften innehåller mindre syre vid havet, och järnet reagerar då fortare med saltet i stället',
             'Solen lyser starkare vid havet, och ljuset gör att järnet smälter och rostar fortare'],
            'Luften innehåller salt och fukt, och saltet får järnet att reagera fortare med syre och vatten',
            'Rost bildas när järn reagerar med syre och vatten. Saltet påskyndar reaktionen.'),
        val('Hur påverkar förbränning av fossila bränslen klimatet?',
            ['Mer koldioxid förstärker växthuseffekten, så mer värme hålls kvar och temperaturen stiger',
             'Mer koldioxid tunnar ut ozonlagret, så mer solljus når jorden och temperaturen sjunker',
             'Mer koldioxid gör luften tyngre, så att molnen sjunker och det regnar mer över hela jorden'],
            'Mer koldioxid förstärker växthuseffekten, så mer värme hålls kvar och temperaturen stiger',
            'Kolet i fossila bränslen har legat lagrat i miljontals år. När det bränns hamnar det i luften.'),
        sant('Bikarbonat löst i vatten är basiskt.', True,
             'Bikarbonat i vatten har pH över 7.'),
    ], beskrivning=blad('Grundämnen och föreningar, partiklar, syror och baser, förbränning och klimat, i provets stil.', T_NP_KEM)),

    niva('no-ak9-blad-np-kemi-2', 'Förbränning och kolets kretslopp', 'NP-träning: kemi', [
        val('Varför kan fotosyntes och förbränning beskrivas som varandras motsatser?',
            ['Det som bildas i den ena går åt i den andra, och fotosyntesen lagrar energi som förbränningen frigör',
             'Båda processerna tar upp syre och släpper ut koldioxid, men den ena sker på dagen och den andra på natten',
             'Förbränningen lagrar solens energi i druvsocker, och fotosyntesen frigör den som värme och ljus igen'],
            'Det som bildas i den ena går åt i den andra, och fotosyntesen lagrar energi som förbränningen frigör',
            'Fotosyntes: koldioxid + vatten + energi → druvsocker + syre. Förbränning: tvärtom.'),
        val('Vilka tre saker behövs för att något ska brinna?',
            ['Bränsle, syre och värme', 'Vatten, syre och ljus', 'Bränsle, koldioxid och vatten'],
            'Bränsle, syre och värme',
            'Tar man bort en av dem slocknar elden. Därför kvävs en eld under en filt.'),
        val('Vad bildas när druvsocker förbränns i kroppen?',
            ['Koldioxid och vatten', 'Syre och druvsocker', 'Väte och kol'], 'Koldioxid och vatten',
            'Druvsocker + syre → koldioxid + vatten, och energi frigörs.'),
        sant('Koldioxid är en växthusgas.', True,
             'Koldioxid håller kvar en del av den värme som jorden strålar ut.'),
        val('Varför ökar fossila bränslen koldioxidhalten mer än ved från en skog som får växa upp igen?',
            ['Kolet i fossila bränslen har legat lagrat i miljontals år, men ny skog tar upp koldioxiden igen',
             'Fossila bränslen innehåller mer syre än ved, och syret blir till koldioxid när det brinner',
             'Ved brinner utan att bilda koldioxid, medan fossila bränslen alltid bildar dubbelt så mycket'],
            'Kolet i fossila bränslen har legat lagrat i miljontals år, men ny skog tar upp koldioxiden igen',
            'Ved ingår i kolets kretslopp i dag. Fossilt kol tillförs kretsloppet utifrån.'),
        val('Vad är rost?',
            ['Ett nytt ämne som bildas när järn reagerar med syre och vatten',
             'Smuts från luften som fastnar på järnet när det är fuktigt',
             'Järn som har smält av värmen och sedan stelnat på nytt'],
            'Ett nytt ämne som bildas när järn reagerar med syre och vatten',
            'Rost är en kemisk reaktion: järnet blir järnoxid, ett nytt ämne.'),
        val('En lösning har pH 9. Är den sur, neutral eller basisk?',
            ['Basisk', 'Sur', 'Neutral'], 'Basisk',
            'Över 7 är basiskt.'),
        val('Vad bildas när en syra och en bas neutraliserar varandra?',
            ['Vatten och ett salt', 'Syre och väte', 'Koldioxid och socker'], 'Vatten och ett salt',
            'Till exempel saltsyra och natriumhydroxid ger vatten och koksalt.'),
        sant('Vid en kemisk reaktion försvinner atomer.', False,
             'Atomerna byter bara partner. Massan är densamma före och efter.'),
    ], beskrivning=blad('Förbränning, fotosyntes som motsats, kolets kretslopp och neutralisation, i provets stil.', T_NP_KEM)),

    niva('no-ak9-blad-genomgang-kemi-1', 'Läs genomgången i kemi', 'NP-träning: kemi', [
        val('Vad avgör enligt texten vilket grundämne en atom är?',
            ['Antalet protoner', 'Antalet elektroner i yttersta skalet', 'Atomens massa'], 'Antalet protoner',
            'Antalet protoner kallas atomnumret.'),
        val('Är luft ett grundämne, en kemisk förening eller en blandning?',
            ['En blandning', 'Ett grundämne', 'En kemisk förening'], 'En blandning',
            'Luft är mest kväve och syre, som inte är kemiskt bundna till varandra.'),
        val('En lösning har pH 3. Är den sur, neutral eller basisk?',
            ['Sur', 'Neutral', 'Basisk'], 'Sur',
            'Under 7 är surt.'),
        val('Ett stearinljus väger mindre efter att det har brunnit en stund. Har massan försvunnit?',
            ['Nej, stearinet har blivit koldioxid och vattenånga som gått ut i luften',
             'Ja, en del av atomerna har förstörts av värmen när ljuset brann',
             'Ja, massan har blivit till ljus och värme och finns inte längre kvar'],
            'Nej, stearinet har blivit koldioxid och vattenånga som gått ut i luften',
            'Atomerna finns kvar. Vägde man alla ämnen före och efter vore massan densamma.'),
        val('Hur kan ämnena i en blandning skiljas åt enligt texten?',
            ['Genom filtrering eller destillation', 'Bara genom en kemisk reaktion', 'De går inte att skilja åt'],
            'Genom filtrering eller destillation',
            'I en blandning är ämnena inte kemiskt bundna, så de kan skiljas åt.'),
        val('Vad bildas när kol brinner?',
            ['Koldioxid', 'Syre', 'Vatten'], 'Koldioxid',
            'Vid förbränning reagerar ett ämne med syre. Kol blir koldioxid.'),
        sant('Enligt texten är vatten ett grundämne.', False,
             'Vatten, H₂O, är en kemisk förening av väte och syre.'),
        val('Vad bildas när en syra och en bas neutraliserar varandra?',
            ['Vatten och ett salt', 'Syre och koldioxid', 'Bara vatten'], 'Vatten och ett salt',
            'Texten säger att det bildas vatten och ett salt.'),
        val('I vilken ordning står grundämnena i det periodiska systemet?',
            ['Efter atomnummer', 'I bokstavsordning', 'Efter hur vanliga de är'], 'Efter atomnummer',
            'Grundämnena står ordnade efter antalet protoner.'),
    ], beskrivning=blad('Läsförståelse på faktabladet om atomer, ämnen, kemiska reaktioner och pH.', T_GG_KEM),
        text=KEM_TEXT),

    # ---- NO: undersöka och förklara
    niva('no-ak9-blad-np-undersoka-1', 'Elsas undersökning', 'NP-träning: undersöka och förklara', [
        val('Vilken fråga vill Elsa få svar på?',
            ['Påverkar vattnets temperatur hur snabbt socker löser sig?',
             'Hur mycket socker kan man lösa i ett glas vatten?',
             'Löser sig socker snabbare om man rör om i vattnet?'],
            'Påverkar vattnets temperatur hur snabbt socker löser sig?',
            'Det är temperaturen hon ändrar, och tiden hon mäter.'),
        val('Vilken variabel ändrar Elsa med flit?',
            ['Vattnets temperatur', 'Mängden vatten', 'Tiden tills sockret löst sig'], 'Vattnets temperatur',
            'Den variabel man ändrar med flit kallas oberoende variabel.'),
        val('Vad mäter Elsa?',
            ['Tiden tills sockret har löst sig helt', 'Vattnets temperatur efter försöket',
             'Hur mycket sockerbiten väger'],
            'Tiden tills sockret har löst sig helt',
            'Tiden är det som kan bero på temperaturen. Den kallas beroende variabel.'),
        val('Vad måste Elsa också hålla lika i alla glasen för att jämförelsen ska bli rättvis?',
            ['Sockerbitarnas storlek och sort', 'Vattnets temperatur', 'Hur lång tid hon väntar'],
            'Sockerbitarnas storlek och sort',
            'Bara temperaturen får skilja. Även glasen och om hon rör om ska vara lika.'),
        val('Vilken slutsats kan Elsa dra av sitt resultat?',
            ['Ju varmare vattnet är, desto snabbare löser sig sockret',
             'Ju kallare vattnet är, desto snabbare löser sig sockret',
             'Temperaturen påverkar inte hur snabbt sockret löser sig'],
            'Ju varmare vattnet är, desto snabbare löser sig sockret',
            'Det tog %d s vid 10 °C men bara %d s vid 60 °C.' % (ELSA[10], ELSA[60])),
        skriv('Hur många sekunder snabbare löste sig sockret i vattnet som var 60 °C än i vattnet som var 10 °C?',
              svar(ELSA_SKILLNAD),
              '%d − %d = %d sekunder.' % (ELSA[10], ELSA[60], ELSA_SKILLNAD)),
        val('Varför löser sig sockret snabbare i varmt vatten?',
            ['Vattenmolekylerna rör sig snabbare och drar oftare loss sockermolekyler från biten',
             'Sockermolekylerna blir mindre av värmen och ryms därför lättare mellan vattnet',
             'Varmt vatten innehåller fler vattenmolekyler än kallt vatten i samma glas'],
            'Vattenmolekylerna rör sig snabbare och drar oftare loss sockermolekyler från biten',
            'Högre temperatur betyder att partiklarna rör sig snabbare. Det är partikelmodellen.'),
        val('Hur kan Elsa göra undersökningen mer tillförlitlig?',
            ['Göra flera försök vid varje temperatur och räkna ut ett medelvärde',
             'Göra ett enda försök vid varje temperatur men titta mer noga',
             'Använda ett större glas vid 60 °C än vid 10 °C'],
            'Göra flera försök vid varje temperatur och räkna ut ett medelvärde',
            'Med ett försök per temperatur kan slumpen spela in. Flera försök gör resultatet säkrare.'),
        val('Varför är det bra för miljön att aluminiumburkar återvinns?',
            ['Att smälta om burkar kräver bara en liten del av energin som behövs för nytt aluminium ur malm',
             'Att smälta om burkar ger mer aluminium än det fanns från början, så det behövs ingen ny malm',
             'Att smälta om burkar gör aluminiumet giftfritt, så att det kan läggas på soptippen sedan'],
            'Att smälta om burkar kräver bara en liten del av energin som behövs för nytt aluminium ur malm',
            'Det går åt omkring 5 % av energin. Det ger mindre utsläpp och mindre gruvbrytning.'),
    ], beskrivning=blad('Läsförståelse om en undersökning: frågeställning, variabler, slutsats, partikelmodellen '
                        'och tillförlitlighet.', T_NP_NO),
        text=ELSA_TEXT),
])


# ======================================================================
# Gy1: Kemi, mol och substansmängd
# ======================================================================
T_MOL = 'Mol och substansmängd'

MOL_36 = F(36) / M_VATTEN
NACL_MASSA = F('0.50') * M_NACL
CO2_MASSA = 3 * M_CO2
NAOH_10G = F(10) / M_NAOH
assert (MOL_36, NACL_MASSA, CO2_MASSA, NAOH_10G) == (2, F('29.25'), 132, F(1, 4))

MOLEKYLER_05 = F('0.50') * AVOGADRO
H_ATOMER_2MOL_VATTEN = 2 * 2 * AVOGADRO
MOL_AV_1204 = F('1.204e24') / AVOGADRO
ATOMER_05_VATTEN = F('0.5') * 3
assert MOL_AV_1204 == 2 and ATOMER_05_VATTEN == F(3, 2)


def tiopotens(x):
    """Ett tal skrivet som a · 10^b med två värdesiffror och upphöjda siffror."""
    b = 0
    x = F(x)
    while x >= 10:
        x /= 10
        b += 1
    while x < 1:
        x *= 10
        b -= 1
    x = F(math.floor(x * 10 + F(1, 2)), 10)
    mant = ('%.1f' % float(x)).replace('.', ',')
    upp = str(b).translate(str.maketrans('-0123456789', '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'))
    return '%s · 10%s' % (mant, upp)


assert tiopotens(MOLEKYLER_05) == '3,0 · 10²³' and tiopotens(H_ATOMER_2MOL_VATTEN) == '2,4 · 10²⁴'

C_NAOH = F('0.50') / F('2.0')
N_250 = F('0.20') * F(250, 1000)
V_005 = F('0.050') / F('0.10')
NACL_N = F('5.85') / M_NACL
NACL_C = NACL_N / F('0.500')
NAOH_MASSA = F('0.10') * F('1.0') * M_NAOH
SPADD = F('1.0') * F(100) / F(500)
assert (C_NAOH, N_250, V_005, NACL_C, NAOH_MASSA, SPADD) == (F(1, 4), F(1, 20), F(1, 2), F(1, 5), 4, F(1, 5))

# 2 H₂ + O₂ → 2 H₂O, CH₄ + 2 O₂ → CO₂ + 2 H₂O, C + O₂ → CO₂, 2 Na + Cl₂ → 2 NaCl, Mg + 2 HCl → MgCl₂ + H₂.
H2O_AV_4H2 = F(4) * 2 / 2
O2_AV_4H2 = F(4) * 1 / 2
O2_AV_3CH4 = F(3) * 2
H2O_AV_05CH4 = F('0.50') * 2
VATTEN_MASSA = H2O_AV_4H2 * M_VATTEN
CO2_AV_24C = F(24) / C * M_CO2
NACL_AV_04NA = F('0.40') * 2 / 2
HCL_AV_01MG = F('0.10') * 2
assert (H2O_AV_4H2, O2_AV_4H2, O2_AV_3CH4, H2O_AV_05CH4, VATTEN_MASSA, CO2_AV_24C) == (4, 2, 6, 1, 72, 88)


def balanserad(formel):
    """Räknar atomerna på båda sidor i en enkel formel med H₂, O₂ och H₂O."""
    def atomer(sida):
        h = o = 0
        for del_ in sida.split(' + '):
            k, amne = del_.split(' ') if ' ' in del_ else ('1', del_)
            k = int(k)
            h += k * {'H₂': 2, 'O₂': 0, 'H₂O': 2}[amne]
            o += k * {'H₂': 0, 'O₂': 2, 'H₂O': 1}[amne]
        return h, o
    vanster, hoger = formel.split(' → ')
    return atomer(vanster) == atomer(hoger)


FORMLER = ['2 H₂ + O₂ → 2 H₂O', 'H₂ + O₂ → H₂O', '2 H₂ + 2 O₂ → 2 H₂O', 'H₂ + 2 O₂ → 2 H₂O']

GY1 = bana(AMNE, 'gy1', [
    niva('no-gy1-blad-mol-1', 'Molmassa och substansmängd', 'Kemi: mol och substansmängd', [
        skriv('Beräkna molmassan för vatten, H₂O, i g/mol. Molmassor: H 1,0 och O 16,0 g/mol.',
              prova(svar(M_VATTEN, '18,0'), '18', '18,0 g/mol'),
              '2 · 1,0 + 16,0 = 18,0 g/mol.'),
        skriv('Hur många mol är 36 g vatten? Vattnets molmassa är 18,0 g/mol.',
              prova(svar(MOL_36, '2,0'), '2', '2,0 mol'),
              'n = m / M = 36 / 18,0 = 2,0 mol.'),
        skriv('Beräkna molmassan för natriumklorid, NaCl, i g/mol. Molmassor: Na 23,0 och Cl 35,5 g/mol.',
              svar(M_NACL),
              '23,0 + 35,5 = 58,5 g/mol.'),
        skriv('Beräkna massan i gram av 0,50 mol natriumklorid, NaCl. Molmassan är 58,5 g/mol.',
              prova(avrundat(NACL_MASSA, 1, 0), '29,25', '29,3', '29 g'),
              'm = n · M = 0,50 · 58,5 = 29,25 g, ungefär 29 g.'),
        skriv('Beräkna molmassan för kalciumkarbonat, CaCO₃, i g/mol. Molmassor: Ca 40,1, C 12,0 och O 16,0 g/mol.',
              svar(M_CACO3),
              '40,1 + 12,0 + 3 · 16,0 = 100,1 g/mol.'),
        skriv('Hur många gram väger 3,0 mol koldioxid, CO₂? Molmassor: C 12,0 och O 16,0 g/mol.',
              prova(svar(CO2_MASSA, 130), '132', '130 g'),
              'M = 12,0 + 2 · 16,0 = 44,0 g/mol. m = 3,0 · 44,0 = 132 g, ungefär 1,3 · 10² g.'),
        skriv('Hur många mol är 10,0 g natriumhydroxid, NaOH? Molmassor: Na 23,0, O 16,0 och H 1,0 g/mol.',
              prova(svar(NAOH_10G, '0,250'), '0,25', '0,250 mol'),
              'M = 23,0 + 16,0 + 1,0 = 40,0 g/mol. n = 10,0 / 40,0 = 0,250 mol.'),
        val('Vilken enhet har molmassa?',
            ['g/mol', 'mol', 'g', 'mol/dm³'], 'g/mol',
            'Molmassan är massan av en mol av ämnet, alltså gram per mol.'),
        val('Vilket samband ger substansmängden n ur massan m och molmassan M?',
            ['Massan delad med molmassan', 'Massan gånger molmassan', 'Molmassan delad med massan'],
            'Massan delad med molmassan',
            'Ju större molmassa, desto färre mol i samma massa. Därför delar man med M.'),
    ], beskrivning=blad('Kemi 1: molmassa ur formeln och sambandet n = m / M, åt båda hållen.', T_MOL)),

    niva('no-gy1-blad-mol-2', 'Antal partiklar', 'Kemi: mol och substansmängd', [
        val('Hur många molekyler finns i 0,50 mol av ett ämne? Avogadros konstant är 6,02 · 10²³ per mol.',
            [tiopotens(MOLEKYLER_05), '6,0 · 10²³', '1,2 · 10²⁴', '3,0 · 10²²'], tiopotens(MOLEKYLER_05),
            '0,50 · 6,02 · 10²³ = 3,01 · 10²³, alltså ungefär 3,0 · 10²³ molekyler.'),
        val('Hur många väteatomer finns i 2,0 mol vatten, H₂O? Avogadros konstant är 6,02 · 10²³ per mol.',
            [tiopotens(H_ATOMER_2MOL_VATTEN), '1,2 · 10²⁴', '6,0 · 10²³', '3,6 · 10²⁴'],
            tiopotens(H_ATOMER_2MOL_VATTEN),
            'Varje molekyl har två väteatomer: 2,0 · 2 · 6,02 · 10²³ ≈ 2,4 · 10²⁴.'),
        skriv('Ett prov innehåller 1,204 · 10²⁴ molekyler. Hur många mol är det? Avogadros konstant är '
              '6,02 · 10²³ per mol.',
              prova(svar(MOL_AV_1204, '2,0'), '2', '2,00'),
              'n = N / N_A = 1,204 · 10²⁴ / 6,02 · 10²³ = 2,0 mol.'),
        skriv('Hur många mol syreatomer finns i 1 mol koldioxid, CO₂?', svar(2),
              'Varje molekyl har två syreatomer, så en mol molekyler har två mol syreatomer.'),
        skriv('Hur många mol atomer finns det sammanlagt i 0,5 mol vatten, H₂O?', svar(ATOMER_05_VATTEN),
              'Varje vattenmolekyl har tre atomer: 0,5 · 3 = 1,5 mol atomer.'),
        val('Vad anger Avogadros konstant?',
            ['Antalet partiklar i en mol', 'Massan av en mol', 'Volymen av en mol gas'],
            'Antalet partiklar i en mol',
            'En mol är 6,02 · 10²³ partiklar, oavsett vilket ämne det är.'),
        skriv('Beräkna molmassan för syrgas, O₂, i g/mol. Syre har molmassan 16,0 g/mol.',
              prova(svar(M_O2, '32,0'), '32', '32,0'),
              'Två syreatomer: 2 · 16,0 = 32,0 g/mol.'),
        skriv('Beräkna molmassan för druvsocker, C₆H₁₂O₆, i g/mol. Molmassor: C 12,0, H 1,0 och O 16,0 g/mol.',
              prova(svar(M_GLUKOS, '180,0'), '180'),
              '6 · 12,0 + 12 · 1,0 + 6 · 16,0 = 72 + 12 + 96 = 180 g/mol.'),
        sant('1 mol syrgas, O₂, väger mer än 1 mol vätgas, H₂.', True,
             'Lika många molekyler, men en O₂-molekyl väger 32 u och en H₂-molekyl bara 2 u.'),
    ], beskrivning=blad('Kemi 1: antal partiklar med Avogadros konstant, atomer i molekyler och molmassor.', T_MOL)),

    niva('no-gy1-blad-koncentration-1', 'Koncentration', 'Kemi: koncentration och reaktionsformler', [
        skriv('Du löser 0,50 mol natriumhydroxid i vatten till 2,0 dm³ lösning. Beräkna koncentrationen i mol/dm³.',
              prova(svar(C_NAOH), '0,25', '0,25 mol/dm³'),
              'c = n / V = 0,50 / 2,0 = 0,25 mol/dm³.'),
        skriv('Hur många mol finns i 250 cm³ lösning med koncentrationen 0,20 mol/dm³?',
              prova(svar(N_250, '0,050'), '0,05', '0,050 mol'),
              '250 cm³ = 0,250 dm³. n = c · V = 0,20 · 0,250 = 0,050 mol.'),
        val('Hur många dm³ är 250 cm³?',
            ['0,250', '2,5', '25', '0,025'], '0,250',
            '1 dm³ = 1 000 cm³, så 250 cm³ = 250 / 1 000 dm³ = 0,250 dm³.'),
        skriv('Hur många dm³ av en lösning med koncentrationen 0,10 mol/dm³ innehåller 0,050 mol?',
              prova(svar(V_005, '0,50'), '0,5', '0,50 dm³'),
              'V = n / c = 0,050 / 0,10 = 0,50 dm³.'),
        skriv('Du löser 5,85 g natriumklorid, NaCl (58,5 g/mol), till 0,500 dm³ lösning. Beräkna koncentrationen '
              'i mol/dm³.',
              prova(svar(NACL_C, '0,200'), '0,2', '0,200'),
              'n = 5,85 / 58,5 = 0,100 mol. c = 0,100 / 0,500 = 0,200 mol/dm³.'),
        skriv('Hur många gram natriumhydroxid, NaOH (40,0 g/mol), behövs till 1,0 dm³ lösning med koncentrationen '
              '0,10 mol/dm³?',
              prova(svar(NAOH_MASSA, '4,0'), '4', '4,0 g'),
              'n = 0,10 · 1,0 = 0,10 mol. m = 0,10 · 40,0 = 4,0 g.'),
        val('100 cm³ lösning med koncentrationen 1,0 mol/dm³ späds med vatten till 500 cm³. Vilken blir den nya '
            'koncentrationen?',
            ['0,20 mol/dm³', '5,0 mol/dm³', '0,50 mol/dm³', '1,0 mol/dm³'],
            enda(['0,20 mol/dm³', '5,0 mol/dm³', '0,50 mol/dm³', '1,0 mol/dm³'],
                 lambda a: F(a.split()[0].replace(',', '.')) == SPADD),
            'Substansmängden är 0,10 mol före och efter. c = 0,10 / 0,500 = 0,20 mol/dm³.'),
        sant('När en lösning späds med vatten ändras substansmängden löst ämne.', False,
             'Det lösta ämnet är kvar. Bara volymen ökar, så koncentrationen sjunker.'),
        val('Vad betyder koncentrationen 0,5 mol/dm³?',
            ['Det finns 0,5 mol löst ämne per kubikdecimeter lösning',
             'Det finns 0,5 gram löst ämne per kubikdecimeter lösning',
             'Det finns 0,5 kubikdecimeter vatten per mol löst ämne'],
            'Det finns 0,5 mol löst ämne per kubikdecimeter lösning',
            'c = n / V: substansmängd per volym lösning.'),
    ], beskrivning=blad('Kemi 1: koncentration med c = n / V, volymer i cm³ och dm³ och spädning.', T_MOL)),

    niva('no-gy1-blad-reaktionsformler-1', 'Reaktionsformler och mol', 'Kemi: koncentration och reaktionsformler', [
        skriv('Vätgas förbränns: 2 H₂ + O₂ → 2 H₂O. Hur många mol vatten bildas av 4,0 mol H₂?',
              prova(svar(H2O_AV_4H2, '4,0'), '4', '4,0 mol'),
              'H₂ och H₂O har samma koefficient, 2. Alltså bildas lika många mol vatten: 4,0 mol.'),
        skriv('Vätgas förbränns: 2 H₂ + O₂ → 2 H₂O. Hur många mol O₂ går åt när 4,0 mol H₂ reagerar?',
              prova(svar(O2_AV_4H2, '2,0'), '2', '2,0'),
              'Förhållandet H₂ : O₂ är 2 : 1, så det går åt hälften så mycket syre: 2,0 mol.'),
        skriv('Metan förbränns: CH₄ + 2 O₂ → CO₂ + 2 H₂O. Hur många mol O₂ går åt när 3,0 mol CH₄ reagerar?',
              prova(svar(O2_AV_3CH4, '6,0'), '6', '6,0 mol'),
              'Varje mol metan behöver 2 mol syre: 3,0 · 2 = 6,0 mol O₂.'),
        skriv('Metan förbränns: CH₄ + 2 O₂ → CO₂ + 2 H₂O. Hur många mol vatten bildas av 0,50 mol CH₄?',
              prova(svar(H2O_AV_05CH4, '1,0'), '1', '1,0'),
              'Varje mol metan ger 2 mol vatten: 0,50 · 2 = 1,0 mol H₂O.'),
        skriv('Vätgas förbränns: 2 H₂ + O₂ → 2 H₂O. Hur många gram vatten bildas av 4,0 mol H₂? Vattnets molmassa '
              'är 18,0 g/mol.',
              prova(svar(VATTEN_MASSA), '72', '72 g'),
              '4,0 mol H₂ ger 4,0 mol H₂O. m = 4,0 · 18,0 = 72 g.'),
        skriv('Kol brinner: C + O₂ → CO₂. Hur många gram koldioxid bildas av 24,0 g kol? Molmassor: C 12,0 och '
              'CO₂ 44,0 g/mol.',
              prova(svar(CO2_AV_24C), '88', '88,0 g'),
              'n(C) = 24,0 / 12,0 = 2,00 mol, som ger 2,00 mol CO₂. m = 2,00 · 44,0 = 88,0 g.'),
        val('Vilken reaktionsformel för vätgas som brinner är balanserad?',
            FORMLER, enda(FORMLER, balanserad),
            'Till vänster 4 H och 2 O, till höger 4 H och 2 O. Atomerna ska vara lika många på båda sidor.'),
        sant('Koefficienterna i en reaktionsformel anger förhållandet mellan substansmängderna.', True,
             'Koefficienterna gäller både antal molekyler och antal mol.'),
        skriv('Natrium reagerar med klor: 2 Na + Cl₂ → 2 NaCl. Hur många mol NaCl bildas av 0,40 mol Na?',
              prova(svar(NACL_AV_04NA, '0,40'), '0,4', '0,40'),
              'Na och NaCl har samma koefficient, så det bildas 0,40 mol NaCl.'),
        skriv('Magnesium reagerar med saltsyra: Mg + 2 HCl → MgCl₂ + H₂. Hur många mol HCl går åt till 0,10 mol Mg?',
              prova(svar(HCL_AV_01MG, '0,20'), '0,2', '0,20'),
              'Varje mol magnesium behöver 2 mol HCl: 0,10 · 2 = 0,20 mol.'),
    ], beskrivning=blad('Kemi 1: räkna med reaktionsformler, molförhållanden och massor av det som bildas.', T_MOL)),
])


# ======================================================================
# Gy2: Fysik, rörelse och Newtons lagar
# ======================================================================
T_NEWTON = 'Rörelse och Newtons lagar'

BIL_KM, BIL_H = 150, F('2.0')
BIL_KMH = BIL_KM / BIL_H
BIL_MS = BIL_KMH / F('3.6')
KMH_90 = F(90) / F('3.6')
MS_10_KMH = 10 * F('3.6')
LOPARE2_M, LOPARE2_S = 400, 50
TID_H = F(300) / 120
STRACKA_M = 15 * 20
assert (BIL_KMH, KMH_90, MS_10_KMH, TID_H, STRACKA_M) == (75, 25, 36, F(5, 2), 300)

FARTER = [('72 km/h', F(72) / F('3.6')), ('18 m/s', F(18)), ('1 km på en minut', F(1000, 60)),
          ('0,5 km på 30 s', F(500, 30))]
SNABBAST = max(FARTER, key=lambda p: p[1])
assert sorted(v for _, v in FARTER)[-1] > sorted(v for _, v in FARTER)[-2]

CYKEL_A = F('8.0') / F('4.0')
CYKEL_S = CYKEL_A * F('4.0') ** 2 / 2
BIL2_A = (F(30) - F(10)) / F('5.0')
V_SLUT = F('5.0') + F('2.0') * F('3.0')
S_SLUT = F('5.0') * F('3.0') + F('2.0') * F('3.0') ** 2 / 2
BROMS_A = (0 - F(20)) / F('4.0')
BROMS_S = 20 * F('4.0') + BROMS_A * F('4.0') ** 2 / 2
assert (CYKEL_A, CYKEL_S, BIL2_A, V_SLUT, S_SLUT, BROMS_A, BROMS_S) == (2, 16, 4, 11, 24, -5, 40)

LADA_F = 12 * F('1.5')
PERSON_TYNGD = 70 * G
A_30N = F(30) / F('6.0')
M_200N = F(200) / F('4.0')
BIL_A_NETTO = (F(3000) - F(600)) / 1200
assert (LADA_F, A_30N, M_200N, BIL_A_NETTO) == (18, 5, 50, 2)

FALL_V3 = G * 3
FALL_S3 = G * 9 / 2
FALL_V2 = G * 2
FALL_S1 = G * 1 / 2
TID_491 = F('49.1') / G
MANEN_G = F('1.62')
MANEN_TYNGD = 2 * MANEN_G
UPP_V0 = F('19.64')
UPP_T = UPP_V0 / G
assert (TID_491, UPP_T) == (5, 2)

GY2 = bana(AMNE, 'gy2', [
    niva('no-gy2-blad-rorelse-1', 'Hastighet och enheter', 'Fysik: hastighet och acceleration', [
        skriv('En bil kör 150 km på 2,0 h. Beräkna medelhastigheten i km/h.', svar(BIL_KMH),
              'v = s / t = 150 / 2,0 = 75 km/h.'),
        skriv('En bil har medelhastigheten 75 km/h. Vad är det i m/s? Svara med två värdesiffror.',
              prova(svar(*[t(F(math.floor(BIL_MS * 10 ** d + F(1, 2)), 10 ** d)) for d in (0, 1, 2)]), '21', '20,8', '20,83 m/s'),
              '1 m/s = 3,6 km/h, så 75 / 3,6 ≈ 20,8 m/s, alltså ungefär 21 m/s.'),
        skriv('Omvandla 90 km/h till m/s.', svar(KMH_90),
              'Dela med 3,6: 90 / 3,6 = 25 m/s.'),
        skriv('Omvandla 10 m/s till km/h.', svar(MS_10_KMH),
              'Gånga med 3,6: 10 · 3,6 = 36 km/h.'),
        skriv('En löpare springer %d m på %d s. Beräkna medelhastigheten i m/s.' % (LOPARE2_M, LOPARE2_S),
              svar(F(LOPARE2_M, LOPARE2_S)),
              'v = s / t = %d / %d = %s m/s.' % (LOPARE2_M, LOPARE2_S, t(F(LOPARE2_M, LOPARE2_S)))),
        skriv('Hur många timmar tar det att köra 300 km med medelhastigheten 120 km/h?', svar(TID_H),
              't = s / v = 300 / 120 = 2,5 h.'),
        skriv('En båt rör sig med den konstanta farten 15 m/s i 20 s. Hur lång sträcka i meter hinner den?',
              svar(STRACKA_M),
              's = v · t = 15 · 20 = 300 m.'),
        val('Vilken fart är störst?', [a for a, _ in FARTER], SNABBAST[0],
            'Gör om allt till m/s: 72 km/h = 20 m/s, 1 km på en minut ≈ 16,7 m/s och 0,5 km på 30 s ≈ 16,7 m/s.'),
        sant('Medelhastigheten är den totala sträckan delad med den totala tiden.', True,
             'v = s / t, där s och t gäller hela färden, med stoppen inräknade i tiden.'),
    ], beskrivning=blad('Fysik 1: medelhastighet, att räkna om mellan km/h och m/s och att lösa ut tid och sträcka.', T_NEWTON)),

    niva('no-gy2-blad-rorelse-2', 'Acceleration', 'Fysik: hastighet och acceleration', [
        skriv('En cyklist accelererar från stillastående till 8,0 m/s på 4,0 s. Beräkna accelerationen i m/s².',
              prova(svar(CYKEL_A, '2,0'), '2', '2,0 m/s²'),
              'a = Δv / t = 8,0 / 4,0 = 2,0 m/s².'),
        skriv('En cyklist startar från stillastående och accelererar med 2,0 m/s² i 4,0 s. Hur lång sträcka i meter '
              'hinner cyklisten?',
              svar(CYKEL_S),
              's = a · t² / 2 = 2,0 · 4,0² / 2 = 16 m.'),
        skriv('En bil ökar farten från 10 m/s till 30 m/s på 5,0 s. Beräkna accelerationen i m/s².',
              prova(svar(BIL2_A, '4,0'), '4', '4,0'),
              'a = (30 − 10) / 5,0 = 4,0 m/s².'),
        skriv('En vagn har farten 5,0 m/s och accelererar med 2,0 m/s² i 3,0 s. Vilken fart i m/s har den då?',
              prova(svar(V_SLUT, '11,0'), '11'),
              'v = v₀ + a · t = 5,0 + 2,0 · 3,0 = 11 m/s.'),
        skriv('En vagn har farten 5,0 m/s och accelererar med 2,0 m/s² i 3,0 s. Hur lång sträcka i meter rör den sig?',
              svar(S_SLUT),
              's = v₀ · t + a · t² / 2 = 5,0 · 3,0 + 2,0 · 9,0 / 2 = 15 + 9 = 24 m.'),
        skriv('En bil bromsar jämnt från 20 m/s till stillastående på 4,0 s. Hur stor är retardationen, alltså '
              'accelerationens belopp, i m/s²?',
              prova(svar(-BROMS_A, '5,0'), '5', '5,0 m/s²'),
              'a = (0 − 20) / 4,0 = −5,0 m/s². Beloppet är 5,0 m/s².'),
        skriv('En bil bromsar jämnt från 20 m/s till stillastående på 4,0 s. Hur lång är bromssträckan i meter?',
              svar(BROMS_S),
              's = v₀ · t + a · t² / 2 = 20 · 4,0 − 5,0 · 16 / 2 = 80 − 40 = 40 m.'),
        val('Vilken enhet har acceleration?',
            ['m/s²', 'm/s', 'N', 'km/h'], 'm/s²',
            'Acceleration är hur mycket farten (m/s) ändras per sekund: m/s per s, alltså m/s².'),
        sant('Ett föremål som rör sig rakt fram med konstant fart har accelerationen noll.', True,
             'Accelerationen är ändringen av hastigheten. Ändras varken fart eller riktning är den noll.'),
    ], beskrivning=blad('Fysik 1: acceleration, sluthastighet och sträcka vid likformigt accelererad rörelse och inbromsning.', T_NEWTON)),

    niva('no-gy2-blad-newton-1', 'Kraft och Newtons lagar', 'Fysik: Newtons lagar och fritt fall', [
        skriv('Vilken kraft i newton krävs för att ge en låda med massan 12 kg accelerationen 1,5 m/s²? '
              'Friktionen försummas.',
              svar(LADA_F),
              'F = m · a = 12 · 1,5 = 18 N.'),
        skriv('Beräkna tyngden i newton av en person med massan 70 kg. Använd g = 9,82 m/s².',
              prova(avrundat(PERSON_TYNGD, 1, 0) + [t(690)], '687', '690 N', '687,4'),
              'F = m · g = 70 · 9,82 ≈ 687 N, ungefär 6,9 · 10² N.'),
        skriv('En kraft på 30 N verkar på en vagn med massan 6,0 kg. Friktionen försummas. Beräkna accelerationen '
              'i m/s².',
              prova(svar(A_30N, '5,0'), '5', '5,0'),
              'a = F / m = 30 / 6,0 = 5,0 m/s².'),
        skriv('En kraft på 200 N ger en kropp accelerationen 4,0 m/s². Vilken massa i kg har kroppen?',
              svar(M_200N),
              'm = F / a = 200 / 4,0 = 50 kg.'),
        skriv('En bil med massan 1 200 kg har drivkraften 3 000 N framåt, och luftmotstånd och friktion är '
              'sammanlagt 600 N bakåt. Beräkna accelerationen i m/s².',
              prova(svar(BIL_A_NETTO, '2,0'), '2', '2,0'),
              'Den resulterande kraften är 3 000 − 600 = 2 400 N. a = 2 400 / 1 200 = 2,0 m/s².'),
        val('Vad säger Newtons första lag?',
            ['En kropp är i vila eller rör sig rakt fram med konstant fart om summan av krafterna är noll',
             'En kropp stannar alltid till slut av sig själv om ingen kraft fortsätter att skjuta på den',
             'En kropp får alltid en acceleration som är lika stor som den största kraften som verkar på den'],
            'En kropp är i vila eller rör sig rakt fram med konstant fart om summan av krafterna är noll',
            'Tröghetslagen: när bussen bromsar fortsätter passagerarna framåt.'),
        val('Du trycker på en vägg med kraften 50 N. Hur stor kraft påverkar väggen dig med?',
            ['50 N, motsatt riktad', '0 N, väggen står still', '100 N, åt samma håll'], '50 N, motsatt riktad',
            'Newtons tredje lag: kraft och motkraft är lika stora och motsatt riktade.'),
        sant('En bil kan röra sig med konstant hastighet fast summan av krafterna på den är noll.', True,
             'Newtons första lag: summan noll betyder ingen acceleration, inte att bilen står still.'),
        val('Vilken av enheterna är samma sak som 1 newton?',
            ['1 kg · m/s²', '1 kg · m/s', '1 kg / s²', '1 m/s²'], '1 kg · m/s²',
            'F = m · a ger enheten kg gånger m/s².'),
    ], beskrivning=blad('Fysik 1: Newtons andra lag F = m · a, tyngd, resulterande kraft och Newtons första och tredje lag.', T_NEWTON)),

    niva('no-gy2-blad-newton-2', 'Fritt fall', 'Fysik: Newtons lagar och fritt fall', [
        skriv('En sten släpps från en klippa och faller i 3,0 s. Luftmotståndet försummas och g = 9,82 m/s². Hur '
              'fort i m/s rör den sig då?',
              prova(avrundat(FALL_V3, 1, 0), '29', '29,5', '29,46'),
              'v = g · t = 9,82 · 3,0 ≈ 29,5 m/s, ungefär 29 m/s med två värdesiffror.'),
        skriv('En sten släpps och faller fritt i 3,0 s. Luftmotståndet försummas och g = 9,82 m/s². Hur många meter '
              'faller den?',
              prova(avrundat(FALL_S3, 1, 0), '44', '44,2', '44,19 m'),
              's = g · t² / 2 = 9,82 · 3,0² / 2 ≈ 44 m.'),
        skriv('En boll släpps och faller fritt i 2,0 s. Luftmotståndet försummas och g = 9,82 m/s². Vilken fart i '
              'm/s har den då?',
              prova(avrundat(FALL_V2, 1, 0), '19,6', '20', '19,64'),
              'v = g · t = 9,82 · 2,0 ≈ 19,6 m/s.'),
        skriv('En boll släpps och faller fritt i 1,0 s. Luftmotståndet försummas och g = 9,82 m/s². Hur många meter '
              'faller den?',
              prova(avrundat(FALL_S1, 1), '4,91', '4,9'),
              's = g · t² / 2 = 9,82 · 1,0² / 2 ≈ 4,9 m.'),
        skriv('Hur många sekunder tar det för en sten som släpps att nå farten 49,1 m/s i fritt fall? '
              'Luftmotståndet försummas och g = 9,82 m/s².',
              prova(svar(TID_491, '5,0'), '5', '5,0 s'),
              't = v / g = 49,1 / 9,82 = 5,0 s.'),
        sant('Utan luftmotstånd faller en hammare och en fjäder lika fort.', True,
             'Alla föremål får samma acceleration g i fritt fall. Det är luften som bromsar fjädern.'),
        val('Hur stor är accelerationen för ett föremål i fritt fall nära jordytan, utan luftmotstånd?',
            ['9,82 m/s² för alla föremål', 'Större ju tyngre föremålet är', 'Noll precis när det släpps'],
            '9,82 m/s² för alla föremål',
            'Tyngden är m · g och a = F / m = g. Massan tar ut sig.'),
        skriv('Månens tyngdacceleration är 1,62 m/s². Beräkna tyngden i newton av ett föremål med massan 2,0 kg '
              'på månen.',
              prova(avrundat(MANEN_TYNGD, 1), '3,24', '3,2'),
              'F = m · g = 2,0 · 1,62 ≈ 3,2 N.'),
        skriv('En boll kastas rakt uppåt med farten 19,64 m/s. Luftmotståndet försummas och g = 9,82 m/s². Hur '
              'många sekunder tar det tills den når sin högsta punkt?',
              prova(svar(UPP_T, '2,0'), '2', '2,0 s'),
              'Farten minskar med 9,82 m/s varje sekund: t = 19,64 / 9,82 = 2,0 s.'),
    ], beskrivning=blad('Fysik 1: fritt fall med v = g · t och s = g · t² / 2, och tyngd på jorden och månen.', T_NEWTON)),
])


# ======================================================================
# Gy3: Biologi, från DNA till protein
# ======================================================================
T_DNA = 'Från DNA till protein'

DNA_1 = 'TACGGCAT'
DNA_2 = 'GGATCC'
TEMPLAT_2 = 'TTAGCC'
A_PROCENT = 30
T_PROCENT = A_PROCENT
G_PROCENT = (100 - 2 * A_PROCENT) // 2
assert G_PROCENT == 20

GEN_BASER = 300
KODON = GEN_BASER // 3
AMINOSYROR = 150
MRNA_BASER = AMINOSYROR * 3
MOJLIGA_KODON = 4 ** 3

# AUG GCC UUU UAA: start (metionin), alanin, fenylalanin, stopp.
MRNA_3 = 'AUGGCCUUUUAA'
STOPP = {'UAA', 'UAG', 'UGA'}
kodonen = [MRNA_3[i:i + 3] for i in range(0, len(MRNA_3), 3)]
AMINOSYROR_I_3 = kodonen.index(next(k for k in kodonen if k in STOPP))
assert AMINOSYROR_I_3 == 3


def sekvens(*xs):
    """En bassekvens som svar: ihopskriven, och med mellanslag var tredje bas."""
    ut = []
    for s in xs:
        ut += [s, ' '.join(s[i:i + 3] for i in range(0, len(s), 3))]
    return svar(*ut)


GY3 = bana(AMNE, 'gy3', [
    niva('no-gy3-blad-dna-1', 'Basparning', 'Biologi: DNA och basparning', [
        skriv('Skriv den komplementära DNA-strängen till %s.' % DNA_1, sekvens(komplement(DNA_1)),
              'A binder till T och C binder till G: %s blir %s.' % (DNA_1, komplement(DNA_1))),
        skriv('Skriv den komplementära DNA-strängen till %s.' % DNA_2, sekvens(komplement(DNA_2)),
              'G blir C, A blir T, T blir A och C blir G: %s.' % komplement(DNA_2)),
        val('Vilken bas binder till adenin, A, i DNA?',
            ['Tymin, T', 'Guanin, G', 'Cytosin, C', 'Uracil, U'], 'Tymin, T',
            'I DNA binder A alltid till T. Uracil finns bara i RNA.'),
        val('Vilken bas binder till cytosin, C, i DNA?',
            ['Guanin, G', 'Adenin, A', 'Tymin, T', 'Uracil, U'], 'Guanin, G',
            'C och G bildar alltid par.'),
        sant('I RNA finns uracil, U, i stället för tymin, T.', True,
             'Därför blir A i DNA-mallen ett U i mRNA.'),
        skriv('I ett DNA-prov är %d %% av baserna adenin. Hur många procent är tymin?' % A_PROCENT,
              prova(svar(T_PROCENT), '30', '30 %'),
              'Varje A sitter ihop med ett T, så det finns lika mycket T som A: %d %%.' % T_PROCENT),
        skriv('I ett DNA-prov är %d %% av baserna adenin. Hur många procent är guanin?' % A_PROCENT,
              prova(svar(G_PROCENT), '20', '20 %'),
              'A och T är %d %% tillsammans. Resten, %d %%, delas lika på C och G: %d %%.'
              % (2 * A_PROCENT, 100 - 2 * A_PROCENT, G_PROCENT)),
        para('Para ihop bokstaven med basens namn.',
             [('A', 'Adenin'), ('T', 'Tymin'), ('C', 'Cytosin'), ('G', 'Guanin'), ('U', 'Uracil')],
             'A, T, C och G finns i DNA. I RNA ersätts T av U.'),
        val('Var i en människocell finns det mesta av DNA:t?',
            ['I cellkärnan', 'I ribosomerna', 'I cellmembranet'], 'I cellkärnan',
            'Kromosomerna ligger i cellkärnan. Lite DNA finns också i mitokondrierna.'),
        sant('De två strängarna i DNA hålls ihop av vätebindningar mellan baserna.', True,
             'Vätebindningarna är svaga, så strängarna kan skiljas åt när DNA ska kopieras eller läsas.'),
    ], beskrivning=blad('Biologi 1: DNA:s baser, basparningen A och T, C och G, och att räkna ut komplementära strängar.', T_DNA)),

    niva('no-gy3-blad-dna-2', 'Transkription', 'Biologi: DNA och basparning', [
        skriv('DNA-strängen %s är templatsträng. Vilken mRNA-sekvens bildas vid transkriptionen?' % DNA_1,
              sekvens(mrna(DNA_1)),
              'T ger A, A ger U, C ger G och G ger C: %s.' % mrna(DNA_1)),
        skriv('DNA-strängen %s är templatsträng. Vilken mRNA-sekvens bildas vid transkriptionen?' % TEMPLAT_2,
              sekvens(mrna(TEMPLAT_2)),
              'T ger A, A ger U, G ger C och C ger G: %s.' % mrna(TEMPLAT_2)),
        skriv('Hur många baser utgör ett kodon?', svar(3, 'tre'),
              'Ribosomen läser mRNA tre baser i taget. Varje sådan trippel är ett kodon.'),
        skriv('Hur många kodon ryms i en mRNA-sekvens med %d baser?' % GEN_BASER, svar(KODON),
              '%d / 3 = %d kodon.' % (GEN_BASER, KODON)),
        skriv('Hur många baser i mRNA behövs för att koda för ett protein med %d aminosyror, om man inte räknar '
              'stoppkodonet?' % AMINOSYROR,
              svar(MRNA_BASER),
              'Tre baser per aminosyra: %d · 3 = %d baser.' % (AMINOSYROR, MRNA_BASER)),
        val('Var i en människocell sker transkriptionen?',
            ['I cellkärnan', 'I ribosomerna i cytoplasman', 'I cellmembranet'], 'I cellkärnan',
            'DNA lämnar aldrig kärnan. Där skrivs genen av till mRNA.'),
        val('Var i cellen sker translationen?',
            ['I ribosomerna, ute i cytoplasman', 'Inne i cellkärnan', 'I mitokondriernas membran'],
            'I ribosomerna, ute i cytoplasman',
            'mRNA förs ut ur kärnan till ribosomerna, fria eller på det endoplasmatiska nätverket.'),
        ordna('Ordna stegen från gen till protein.',
              ['Genen skrivs av till mRNA', 'mRNA lämnar cellkärnan', 'Ribosomen läser kodonen',
               'Aminosyrorna fogas ihop till ett protein'],
              forklaring='Först transkription i kärnan, sedan translation i ribosomerna.'),
        val('Vad är skillnaden mellan transkription och translation?',
            ['Vid transkription skrivs en gen av till mRNA, vid translation byggs ett protein efter mRNA',
             'Vid translation skrivs en gen av till mRNA, vid transkription byggs ett protein efter mRNA',
             'Vid transkription kopieras hela DNA:t, vid translation delas cellen i två nya celler'],
            'Vid transkription skrivs en gen av till mRNA, vid translation byggs ett protein efter mRNA',
            'Transkription sker i cellkärnan, translation i ribosomerna.'),
    ], beskrivning=blad('Biologi 1: transkription till mRNA, kodon och var stegen sker i cellen.', T_DNA)),

    niva('no-gy3-blad-protein-1', 'Kodon och aminosyror', 'Biologi: proteinsyntes och mutationer', [
        val('Vilket kodon är startkodonet i mRNA?',
            ['AUG', 'UAA', 'UGG', 'GGC'], 'AUG',
            'AUG kodar för metionin och är där translationen börjar.'),
        sant('Varje kodon kodar för en aminosyra.', False,
             'Tre kodon, UAA, UAG och UGA, är stoppsignaler och kodar inte för någon aminosyra.'),
        skriv('mRNA-sekvensen %s läses från början. Hur många aminosyror får proteinet?' % MRNA_3,
              svar(AMINOSYROR_I_3),
              'Kodonen är %s. Det fjärde, UAA, är ett stoppkodon, så proteinet får %d aminosyror.'
              % (', '.join(kodonen), AMINOSYROR_I_3)),
        val('Vad gör tRNA vid translationen?',
            ['För aminosyror till ribosomen och parar med kodonen i mRNA',
             'Skriver av genen i DNA till en ny mRNA-molekyl i cellkärnan',
             'Klipper av det färdiga proteinet och för det ut ur cellen'],
            'För aminosyror till ribosomen och parar med kodonen i mRNA',
            'Varje tRNA har ett antikodon som passar ett kodon, och bär rätt aminosyra.'),
        skriv('Hur många olika kodon går att bilda av fyra baser, tre baser i taget?', svar(MOJLIGA_KODON),
              '4 · 4 · 4 = %d.' % MOJLIGA_KODON),
        val('Det finns 64 kodon men bara omkring 20 aminosyror. Vad följer av det?',
            ['Flera kodon kan koda för samma aminosyra',
             'Varje aminosyra har exakt tre olika kodon',
             'De flesta kodon används aldrig i någon cell'],
            'Flera kodon kan koda för samma aminosyra',
            '61 kodon delas på omkring 20 aminosyror. Därför ger många mutationer ingen ändring.'),
        skriv('Omkring hur många olika aminosyror bygger våra proteiner?', svar(20),
              'Våra proteiner byggs av omkring 20 olika aminosyror i olika ordning.'),
        sant('Den genetiska koden är i stort sett densamma hos alla organismer.', True,
             'Samma kodon ger samma aminosyra hos bakterier, växter och människor. Det tyder på ett gemensamt ursprung.'),
        para('Para ihop begreppet med vad det är.',
             [('Kodon', 'Tre baser i mRNA'), ('Antikodon', 'Tre baser på tRNA'),
              ('Ribosom', 'Läser mRNA och bygger proteinet'), ('Aminosyra', 'Byggsten i ett protein')],
             'Ribosomen läser kodonen, och tRNA med rätt antikodon kommer med aminosyran.'),
    ], beskrivning=blad('Biologi 1: den genetiska koden, start- och stoppkodon, tRNA och att räkna kodon.', T_DNA)),

    niva('no-gy3-blad-protein-2', 'Mutationer och genuttryck', 'Biologi: proteinsyntes och mutationer', [
        val('Vad är en mutation?',
            ['En förändring i DNA:s bassekvens', 'En förändring i cellmembranets form',
             'En förändring i hur mycket mat cellen får'],
            'En förändring i DNA:s bassekvens',
            'En bas kan bytas ut, försvinna eller läggas till.'),
        val('Ett kodon i mRNA ändras från UGG, som kodar för tryptofan, till UGA. Vad händer med proteinet?',
            ['Det blir kortare, eftersom UGA är ett stoppkodon',
             'Det blir längre, eftersom UGA är ett startkodon',
             'Det blir oförändrat, eftersom UGA också är tryptofan'],
            'Det blir kortare, eftersom UGA är ett stoppkodon',
            'Translationen stannar vid stoppkodonet, så resten av proteinet byggs aldrig.'),
        sant('En mutation i en hudcell kan ärvas av ens barn.', False,
             'Bara mutationer i könscellerna kan föras vidare till barnen.'),
        val('En extra bas läggs till tidigt i en gen. Varför blir följden ofta stor?',
            ['Läsramen förskjuts, så alla kodon efter ändringen blir andra',
             'Bara ett kodon ändras, men det ändrar alltid hela proteinets form',
             'Den extra basen gör att genen inte kan transkriberas alls längre'],
            'Läsramen förskjuts, så alla kodon efter ändringen blir andra',
            'Ribosomen läser tre baser i taget. En extra bas flyttar varje trippel efter den.'),
        val('Nästan alla celler i kroppen har samma DNA. Varför kan en hudcell och en nervcell se olika ut?',
            ['Olika gener är påslagna i olika celler, så de tillverkar olika proteiner',
             'Hudceller och nervceller har olika många kromosomer, så generna skiljer sig',
             'Hudceller har bara RNA och nervceller bara DNA, så de bygger olika proteiner'],
            'Olika gener är påslagna i olika celler, så de tillverkar olika proteiner',
            'Genregleringen avgör vilka proteiner cellen gör, och proteinerna avgör form och funktion.'),
        sant('Alla mutationer är skadliga.', False,
             'Många mutationer gör ingen skillnad, och några kan vara till fördel. Det är en grund för evolutionen.'),
        val('Sicklecellanemi beror på att en enda bas är utbytt i genen för hemoglobin. Vilken sorts mutation är det?',
            ['En punktmutation', 'En kromosomförlust', 'En celldelning'], 'En punktmutation',
            'En punktmutation ändrar en enda bas. Här ger den en annan aminosyra i hemoglobinet.'),
        val('Kodonet GGU ändras till GGC. Båda kodar för glycin. Vad händer med proteinet?',
            ['Ingenting, aminosyran blir densamma', 'Det blir kortare', 'Alla följande aminosyror byts'],
            'Ingenting, aminosyran blir densamma',
            'En sådan mutation kallas tyst: den genetiska koden har flera kodon för samma aminosyra.'),
        sant('UV-strålning kan orsaka mutationer.', True,
             'UV-strålning kan skada DNA i hudcellerna. Därför ökar mycket sol risken för hudcancer.'),
    ], beskrivning=blad('Biologi 1: mutationer och deras följder, läsramen och varför olika celler uttrycker olika gener.', T_DNA)),
])


BANOR = [AK1, AK2, GY1, GY2, GY3]
TILLAGG = [AK6, AK7, AK8, AK9]
