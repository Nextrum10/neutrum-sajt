# -*- coding: utf-8 -*-
"""NO åk 4, åk 6, åk 7 och åk 9. Biologi, fysik och kemi blandat som i
Lgr22:s centrala innehåll: närmiljön, ljud och ljus, material och himlakropparna
i åk 4; kroppen, elen och magneterna, partikelmodellen och ekosystemen i åk 6;
cellerna, trycket och densiteten, syrorna och energin i åk 7; genetiken,
elektromagnetismen, den organiska kemin och radioaktiviteten i åk 9.

Frågorna är egna, skrivna ur vad kursplanen säger att ämnet innehåller, inte
ur någon lärobok eller något prov.

Räknefrågornas facit räknas ut här med Fraction, och de vanligaste
felräkningarna prövas med assert mot samma tal: ett fel som råkar ge rätt svar
lär barnet att räkna fel. Enheten står alltid i frågan, för rättningen läser
bara talet.
"""
from fractions import Fraction as F
from itertools import product

from grund import bana, niva, val, skriv, ordna, sant, para, tal

AMNE = 'NO / Fysik / Kemi / Biologi'


def t(x):
    """Ett exakt bråk som det skrivs: heltal när det går, annars decimaltal."""
    x = F(x)
    if x.denominator == 1:
        return tal(int(x))
    return tal(float(x))


SMA_SIFFROR = str.maketrans('0123456789', '₀₁₂₃₄₅₆₇₈₉')

# ---------------------------------------------------------------- åk 4

# Åskan: ljudet går ungefär 340 m på en sekund.
LJUD_MS, ASKA_S = 340, 3
ASKA_M = LJUD_MS * ASKA_S
assert ASKA_M not in (LJUD_MS + ASKA_S, LJUD_MS // ASKA_S, LJUD_MS)

# ---------------------------------------------------------------- åk 6

# Pulsen: slag på 15 sekunder gånger fyra.
PULS_SLAG, PULS_S = 18, 15
PULS_MIN = PULS_SLAG * 60 // PULS_S
assert PULS_MIN not in (PULS_SLAG * PULS_S, PULS_SLAG * 60, PULS_SLAG + PULS_S)

# En tiondel av energin går vidare till nästa led.
ANG_KJ = 20000
VAXTATARE_KJ = ANG_KJ // 10
ROVDJUR_KJ = VAXTATARE_KJ // 10
assert VAXTATARE_KJ not in (ANG_KJ * 10, ROVDJUR_KJ, ANG_KJ)
assert ROVDJUR_KJ not in (VAXTATARE_KJ, ANG_KJ // 20, ANG_KJ // 5)

# Vatten, H₂O: två väte och ett syre.
VATTEN_ATOMER = 2 + 1

# ---------------------------------------------------------------- åk 7

# Mikroskopet: förstoringarna gångras, de läggs inte ihop.
OKULAR, OBJEKTIV = 10, 40
FORSTORING = OKULAR * OBJEKTIV
assert FORSTORING != OKULAR + OBJEKTIV

# En cell som ser 3 mm stor ut vid 100 gångers förstoring.
CELL_BILD_MM, CELL_FORST = F(3), 100
CELL_UM = CELL_BILD_MM * 1000 / CELL_FORST
assert CELL_UM not in (CELL_BILD_MM * CELL_FORST, CELL_BILD_MM / CELL_FORST,
                       CELL_BILD_MM * 1000)

# Bakterier som delar sig var 20:e minut i två timmar.
DELNING_MIN, BAKT_MIN = 20, 120
DELNINGAR = BAKT_MIN // DELNING_MIN
BAKTERIER = 2 ** DELNINGAR
assert BAKTERIER not in (DELNINGAR, 2 * DELNINGAR, DELNINGAR + 1, 2 ** (DELNINGAR - 1))

# Densitet, ρ = m / V, i g/cm³.
D1_M, D1_V = F(54), F(20)
D1 = D1_M / D1_V
assert D1 not in (D1_V / D1_M, D1_M * D1_V, D1_M - D1_V)

D2_RHO, D2_V = F(8, 10), F(250)
D2_M = D2_RHO * D2_V
assert D2_M.denominator == 1 and D2_M not in (D2_V / D2_RHO, D2_RHO / D2_V, D2_V)

STEN_M, GLAS_FORE, GLAS_EFTER = F(300), F(50), F(170)
STEN_V = GLAS_EFTER - GLAS_FORE
STEN_RHO = STEN_M / STEN_V
assert STEN_RHO not in (STEN_M / GLAS_EFTER, STEN_M / GLAS_FORE, STEN_V / STEN_M)

JARN_RHO, JARN_M = F(79, 10), F(79)
JARN_V = JARN_M / JARN_RHO
assert JARN_V.denominator == 1 and JARN_V not in (JARN_M * JARN_RHO, JARN_RHO / JARN_M)

# Fyra klossar. Ordningen efter densitet får inte vara densamma som efter
# massan eller volymen, annars räcker det att titta på ett av talen.
KLOSSAR = [('A', F(40), F(50)), ('B', F(90), F(30)), ('C', F(24), F(16)), ('D', F(30), F(2))]
KLOSSAR_ORDNADE = sorted(KLOSSAR, key=lambda k: k[1] / k[2])
assert len({k[1] / k[2] for k in KLOSSAR}) == len(KLOSSAR)
assert [k[0] for k in KLOSSAR_ORDNADE] != [k[0] for k in sorted(KLOSSAR, key=lambda k: k[1])]
assert [k[0] for k in KLOSSAR_ORDNADE] != [k[0] for k in sorted(KLOSSAR, key=lambda k: -k[2])]


def kloss_bricka(k):
    return 'Kloss %s: %s g, %s cm³' % (k[0], t(k[1]), t(k[2]))


# Tryck, p = F / A, i pascal.
T1_F, T1_A = F(600), F(2, 10)
T1_P = T1_F / T1_A
assert T1_P not in (T1_F * T1_A, T1_A / T1_F, T1_F)

SKIDA_F, SKOR_A, SKIDOR_A = F(500), F(5, 100), F(25, 100)
SKOR_P, SKIDOR_P = SKIDA_F / SKOR_A, SKIDA_F / SKIDOR_A
SKID_GANGER = SKOR_P / SKIDOR_P
assert SKID_GANGER.denominator == 1 and SKID_GANGER != SKIDOR_A - SKOR_A

DJUP_KPA_PER_M, DJUP_M = 10, F(35, 10)
DJUP_KPA = DJUP_KPA_PER_M * DJUP_M
assert DJUP_KPA not in (DJUP_M, DJUP_KPA_PER_M + DJUP_M)

AKV_P, AKV_A = F(4000), F(1, 4)
AKV_F = AKV_P * AKV_A
assert AKV_F not in (AKV_P / AKV_A, AKV_A / AKV_P)

# pH: ett steg är tio gånger.
PH_SUR, PH_MINDRE_SUR = 3, 5
PH_GANGER = 10 ** (PH_MINDRE_SUR - PH_SUR)
assert PH_GANGER not in (PH_MINDRE_SUR - PH_SUR, 10 * (PH_MINDRE_SUR - PH_SUR))

# Verkningsgrad: nyttig energi delat med tillförd.
LAMPA_IN, LAMPA_LJUS = F(200), F(30)
LAMPA_VG = LAMPA_LJUS / LAMPA_IN * 100
assert LAMPA_VG not in (LAMPA_LJUS, LAMPA_IN - LAMPA_LJUS, (LAMPA_IN - LAMPA_LJUS) / LAMPA_IN * 100)

# Effekt och energi.
E1_J, E1_S = F(1200), F(4)
E1_W = E1_J / E1_S
assert E1_W not in (E1_J * E1_S, E1_S / E1_J)

KOK_W, KOK_S = F(2000), F(90)
KOK_KJ = KOK_W * KOK_S / 1000
assert KOK_KJ not in (KOK_W * KOK_S, KOK_W * F(3, 2), KOK_W * F(3, 2) / 1000)

LED_W, LED_H = F(10), F(6)
LED_WH = LED_W * LED_H

LAGE_M, LAGE_H, G = F(5), F(2), F(98, 10)
LAGE_J = LAGE_M * G * LAGE_H
assert LAGE_J.denominator == 1 and LAGE_J not in (LAGE_M * LAGE_H, LAGE_M * 10 * LAGE_H)

ELEMENT_KW, ELEMENT_H = F(1), F(5)
ELEMENT_KWH = ELEMENT_KW * ELEMENT_H

# ---------------------------------------------------------------- åk 9

# Korsningarna räknas genom att para varje gamet med varje.
def andel_recessiva(mor, far):
    avkomma = [a + b for a, b in product(mor, far)]
    return F(sum(1 for g in avkomma if g == 'aa'), len(avkomma)) * 100


AA_AA = andel_recessiva('Aa', 'Aa')
AA_aa = andel_recessiva('Aa', 'aa')
assert AA_AA == 25 and AA_aa == 50

BASPAR = {'A': 'T', 'T': 'A', 'C': 'G', 'G': 'C'}
DNA_STRANG = 'ATGC'
DNA_MOT = [BASPAR[b] for b in DNA_STRANG]
assert len(set(DNA_MOT)) == len(DNA_MOT)

# Transformatorn: spänningen följer varvtalen.
PRIM_VARV, SEK_VARV, PRIM_U = F(1000), F(50), F(230)
SEK_U = PRIM_U * SEK_VARV / PRIM_VARV
assert SEK_U not in (PRIM_U * PRIM_VARV / SEK_VARV, PRIM_U / SEK_VARV)

# P = U · I.
KOKARE_U, KOKARE_I = F(230), F(8)
KOKARE_P = KOKARE_U * KOKARE_I
assert KOKARE_P not in (KOKARE_U / KOKARE_I, KOKARE_U + KOKARE_I)

# Energi i kWh: effekten i kW gånger tiden i timmar.
KOK9_KW, KOK9_MIN = F(2), F(6)
KOK9_KWH = KOK9_KW * KOK9_MIN / 60
assert KOK9_KWH not in (KOK9_KW * KOK9_MIN, 2000 * KOK9_MIN, KOK9_KW / KOK9_MIN)

KRAFT_IN, KRAFT_EL = F(500), F(175)
KRAFT_VG = KRAFT_EL / KRAFT_IN * 100
assert KRAFT_VG not in (KRAFT_IN - KRAFT_EL, KRAFT_EL)

# Alkanerna, CₙH₂ₙ₊₂.
ALKANER = [('Metan', 1), ('Etan', 2), ('Propan', 3), ('Butan', 4)]


def alkan(n):
    return ('C' + (str(n).translate(SMA_SIFFROR) if n > 1 else '')
            + 'H' + str(2 * n + 2).translate(SMA_SIFFROR))


assert alkan(1) == 'CH₄' and alkan(3) == 'C₃H₈'
HEXAN_C = 6
HEXAN_H = 2 * HEXAN_C + 2
assert HEXAN_H not in (2 * HEXAN_C, HEXAN_C + 2)

# Kol-14: masstalet är protoner plus neutroner.
C14_MASSTAL, C14_P = 14, 6
C14_N = C14_MASSTAL - C14_P
assert C14_N not in (C14_MASSTAL, C14_MASSTAL + C14_P)

# Halveringstid.
HALV_AR, HALV_START, HALV_TID = F(5), F(800), F(15)
HALV_KVAR = HALV_START / 2 ** int(HALV_TID / HALV_AR)
assert HALV_KVAR not in (HALV_START / 2, HALV_START / 3, F(0), HALV_START - HALV_START / HALV_TID)

JOD_DAGAR = F(8)
JOD_FJARDEDEL = JOD_DAGAR * 2
assert JOD_FJARDEDEL not in (JOD_DAGAR * 4, JOD_DAGAR)

KOL14_HALV = 5700
KOL14_FJARDEDEL = KOL14_HALV * 2


BANOR = [
    # ================================================================ åk 4
    bana(AMNE, 'ak4', [
        niva('no-ak4-djur-1', 'Djurens grupper', 'Djur och växter i närmiljön', [
            val('Vad har alla fåglar?',
                ['Fjädrar', 'Förmågan att flyga', 'Fyra ben', 'Päls'], 'Fjädrar',
                'Alla fåglar har fjädrar, men alla kan inte flyga. Strutsen och pingvinen är '
                'fåglar som inte flyger.'),
            val('Hur många ben har en insekt?', [6, 8, 4, 10], 6,
                'Insekter har sex ben och en kropp i tre delar: huvud, mellankropp och bakkropp.'),
            sant('En spindel är en insekt.', False,
                 'Spindeln har åtta ben och en kropp i två delar. Därför är den ingen insekt, '
                 'den är ett spindeldjur.'),
            para('Para ihop djuret med gruppen det tillhör.',
                 [('Groda', 'Groddjur'), ('Abborre', 'Fisk'), ('Igelkott', 'Däggdjur'),
                  ('Huggorm', 'Kräldjur'), ('Talgoxe', 'Fågel')],
                 'Grodan lägger rom i vatten, abborren andas med gälar, igelkotten ger sina ungar '
                 'di, huggormen har fjäll och talgoxen har fjädrar.'),
            skriv('Djur som ger sina ungar di, alltså mjölk, kallas … Vilket ord fattas?',
                  ['däggdjur', 'däggdjuren', 'ett däggdjur', 'daggdjur'],
                  'Däggdjuren har fått sitt namn av att ungarna diar. Människan är också ett '
                  'däggdjur.'),
            ordna('Ordna grodans utveckling, från början till slut.',
                  ['Rom', 'Grodyngel', 'Grodyngel med ben', 'Liten groda'],
                  forklaring='Grodan lägger rom i vattnet. Ur äggen kläcks grodyngel som andas med '
                             'gälar. De får ben, tappar svansen och blir små grodor som kan gå på land.'),
            val('Hur andas en fisk?',
                ['Med gälar', 'Med lungor, som vi',
                 'Genom fjällen', 'Den behöver inget syre'],
                'Med gälar',
                'Vattnet strömmar genom gälarna, och där tas syret som finns löst i vattnet upp '
                'i blodet.'),
            para('Para ihop djuret med hur det klarar vintern.',
                 [('Ladusvala', 'Flyttar söderut'), ('Björn', 'Går i ide'),
                  ('Skogshare', 'Får vit vinterpäls'), ('Ekorre', 'Äter ur gömda förråd')],
                 'Svalan hittar inga insekter på vintern och flyttar. Björnen sover i sitt ide. '
                 'Skogsharens vita päls syns inte i snön, och ekorren har gömt nötter och kottar.'),
        ], beskrivning='Djurens grupper och hur djuren i Sverige lever och klarar vintern.'),

        niva('no-ak4-djur-2', 'Växternas liv', 'Djur och växter i närmiljön', [
            para('Para ihop växtens del med vad den gör.',
                 [('Rot', 'Tar upp vatten och håller fast växten'),
                  ('Stjälk', 'Håller upp växten och leder vattnet'),
                  ('Blad', 'Gör näring med hjälp av solljus'),
                  ('Blomma', 'Där bildas frön')],
                 'Rötterna suger upp vatten ur jorden, stjälken leder det upp till bladen, bladen '
                 'gör näring och i blomman bildas fröna till nya växter.'),
            val('Vad behöver ett frö för att börja gro?',
                ['Vatten och värme', 'Bara mörker', 'Salt och sand', 'Snö och kyla'],
                'Vatten och värme',
                'Fröet har egen näring med sig. När det får fukt och lagom värme vaknar det och '
                'börjar växa.'),
            val('Hur hjälper ett bi blommorna?',
                ['Det flyttar pollen mellan blommor', 'Det äter upp skadedjuren på bladen',
                 'Det vattnar blommorna när det är torrt', 'Det gör bladen gröna och starka'],
                'Det flyttar pollen mellan blommor',
                'När biet hämtar nektar fastnar pollen på det, och pollenet följer med till nästa '
                'blomma. Då kan blomman bilda frön.'),
            skriv('Vad heter det när pollen förs från en blomma till en annan? Ett ord.',
                  ['pollinering', 'pollineringen', 'pollination', 'pollinationen', 'polinering'],
                  'Det kallas pollinering. Bin, humlor, fjärilar och vinden kan pollinera.'),
            ordna('Ordna en solros liv, från början.',
                  ['Fröet gror', 'Plantan växer', 'Blomman slår ut', 'Nya frön bildas'],
                  forklaring='Fröet gror och blir en planta som växer. Blomman slår ut, blir '
                             'pollinerad, och då bildas nya frön.'),
            sant('En björk tappar sina löv på hösten.', True,
                 'Björken är ett lövträd. Genom att fälla löven sparar den vatten och klarar den '
                 'kalla vintern.'),
            val('Varför behöver en växt ljus?',
                ['För att kunna göra sin egen näring', 'För att jorden ska bli blöt',
                 'För att skrämma bort djur', 'Den behöver inte ljus'],
                'För att kunna göra sin egen näring',
                'Med energin i ljuset gör bladen socker av vatten och luft. Det är växtens mat.'),
            val('Hur kan maskrosens frön spridas långt bort?',
                ['Med vinden', 'Med rötterna', 'Genom att rulla uppför backar', 'Med snön'],
                'Med vinden',
                'Varje maskrosfrö har små hår som en fallskärm, och vinden kan bära det långt.'),
        ], beskrivning='Växtens delar, hur frön gror och sprids, och hur bina hjälper blommorna.'),

        niva('no-ak4-ljud-ljus-1', 'Ljud', 'Ljud och ljus', [
            val('Hur uppstår ljud?',
                ['Något vibrerar', 'Luften blir varm',
                 'Ljus träffar örat', 'Något blir blött'],
                'Något vibrerar',
                'Lägg handen på halsen när du pratar, så känner du hur det vibrerar. Vibrationerna '
                'sprids genom luften till örat.'),
            sant('I rymden hörs inget ljud, för där finns ingen luft som ljudet kan gå genom.', True,
                 'Ljud behöver något att gå genom, som luft, vatten eller trä. I rymden finns nästan '
                 'ingenting, så där blir det tyst.'),
            sant('Ljud kan gå genom vatten.', True,
                 'Ljud går bra genom vatten. Valar kan höra varandra långt bort i havet.'),
            skriv('Du ropar mot en bergvägg och hör ditt rop igen. Vad kallas det? Ett ord.',
                  ['eko', 'ekot', 'ett eko'],
                  'Ljudet studsar mot berget och kommer tillbaka. Det kallas eko.'),
            val('Du ser blixten innan du hör åskan. Varför?',
                ['Ljuset går mycket fortare än ljudet', 'Ljudet går fortare än ljuset',
                 'Ögonen är snabbare än öronen', 'Åskan kommer från ett annat moln'],
                'Ljuset går mycket fortare än ljudet',
                'Blixten och åskan kommer samtidigt, men ljuset når dig nästan direkt. Ljudet tar '
                'längre tid på sig.'),
            skriv('Ljudet går ungefär %d meter på en sekund. Hur många meter går det på %d sekunder? '
                  'Svara i meter.' % (LJUD_MS, ASKA_S),
                  tal(ASKA_M),
                  '%d · %d = %s meter. Räknar du sekunderna mellan blixt och åska och delar med tre '
                  'får du ungefär hur många kilometer bort åskan är.' % (LJUD_MS, ASKA_S, tal(ASKA_M))),
            val('En gitarrsträng är kort och hårt spänd. Vilken ton ger den?',
                ['En ljus ton', 'En mörk ton', 'Ingen ton alls'], 'En ljus ton',
                'En kort, hårt spänd sträng svänger fort, och snabba svängningar ger en ljus ton.'),
            val('Varför ska man ha hörselskydd där det är mycket starkt ljud?',
                ['Starkt ljud kan skada hörseln för alltid',
                 'Hörselskydd håller öronen varma när det blåser', 'Hörselskydd gör att man hör bättre',
                 'Starkt ljud är bara farligt för vuxna'],
                'Starkt ljud kan skada hörseln för alltid',
                'Inne i örat finns små hårceller som kan skadas av starkt ljud. De växer inte ut igen.'),
        ], beskrivning='Hur ljud uppstår och rör sig, eko, åska och höga och låga toner.'),

        niva('no-ak4-ljud-ljus-2', 'Ljus och skuggor', 'Ljud och ljus', [
            val('Vilket av de här är en ljuskälla, alltså något som sänder ut eget ljus?',
                ['Solen', 'Månen', 'En spegel', 'En reflex'], 'Solen',
                'Solen lyser själv. Månen, spegeln och reflexen syns bara för att de kastar '
                'tillbaka ljus från något annat.'),
            sant('Månen lyser med eget ljus.', False,
                 'Månen lyser inte själv. Det vi ser är solens ljus som studsar mot månen.'),
            val('Hur bildas en skugga?',
                ['Något stoppar ljuset', 'Ljuset böjer sig runt föremålet',
                 'Mörker strömmar ut ur föremålet', 'Solen blir svagare'],
                'Något stoppar ljuset',
                'Ljuset går inte igenom föremålet, så bakom det blir det en mörk fläck: skuggan.'),
            sant('Ljus går rakt fram tills det träffar något.', True,
                 'Ljuset går i raka linjer. Därför kan du inte se runt ett hörn.'),
            val('Varför syns en reflex i mörkret när en bil kommer?',
                ['Den kastar tillbaka billyktornas ljus', 'Den lyser med eget ljus i mörkret',
                 'Den har ett batteri som tänds av bilen', 'Den blir varm och glöder i mörker'],
                'Den kastar tillbaka billyktornas ljus',
                'Reflexen är gjord så att ljuset studsar tillbaka åt samma håll som det kom ifrån, '
                'alltså mot bilen.'),
            val('När på dagen är din skugga kortast en solig dag?',
                ['Mitt på dagen', 'Tidigt på morgonen', 'Sent på kvällen'],
                'Mitt på dagen',
                'När solen står högt lyser den mer uppifrån, och då blir skuggan kort. När solen '
                'står lågt blir skuggan lång.'),
            skriv('Vitt solljus kan delas upp i många färger, som när det bildas en … på himlen '
                  'efter ett regn. Vilket ord fattas?',
                  ['regnbåge', 'regnbågen', 'en regnbåge', 'regnbåga'],
                  'Regndropparna delar upp solljuset i alla färger. Då ser vi en regnbåge.'),
            val('Vad händer med ljuset när det träffar en spegel?',
                ['Det studsar tillbaka', 'Det försvinner', 'Det blir till ljud', 'Det går rakt igenom'],
                'Det studsar tillbaka',
                'Spegeln är slät och blank, och ljuset studsar tillbaka. Det kallas reflektion.'),
        ], beskrivning='Ljuskällor, skuggor, speglar, reflexer och regnbågens färger.'),

        niva('no-ak4-material-1', 'Materialens egenskaper', 'Material och ämnen', [
            val('Vilket av de här dras till en magnet?',
                ['En järnspik', 'En aluminiumburk', 'Ett suddgummi', 'En träbit'], 'En järnspik',
                'Magneter drar till sig järn. Aluminium, gummi och trä dras inte till en magnet.'),
            val('Vilket material leder elektricitet bra?',
                ['Koppar', 'Plast', 'Gummi', 'Trä'], 'Koppar',
                'Metaller som koppar leder ström bra. Därför är trådarna i sladdar av koppar.'),
            sant('Plasten runt en sladd skyddar oss, för plast leder inte elektricitet.', True,
                 'Plast är en isolator. Den stoppar strömmen, så att du inte får en stöt när du tar '
                 'i sladden.'),
            para('Para ihop materialet med något som ofta görs av det.',
                 [('Glas', 'Fönsterruta'), ('Ull', 'Vantar'), ('Gummi', 'Bildäck'), ('Stål', 'Spik')],
                 'Glas är genomskinligt, ull håller värmen, gummi är segt och greppar vägen, och '
                 'stål är hårt.'),
            val('Du ställer en metallsked och en träsked i en kopp varmt te. Vilken blir varm i '
                'handtaget först?',
                ['Metallskeden', 'Träskeden', 'Båda lika snabbt'], 'Metallskeden',
                'Metall leder värme bra, och trä leder värme dåligt. Därför har grytor ofta handtag '
                'av trä eller plast.'),
            val('Vilket av de här flyter i vatten?',
                ['En kork', 'En sten', 'En järnspik', 'En glaskula'], 'En kork',
                'Kork är mycket lätt för sin storlek, så den flyter. Sten, järn och glas sjunker.'),
            val('Vilket material tillverkas främst av sand?',
                ['Glas', 'Papper', 'Plast', 'Ull'], 'Glas',
                'Sand smälts vid mycket hög temperatur och blir glas när det svalnar.'),
            val('Vad görs nytt papper av?',
                ['Trä', 'Olja', 'Sand', 'Järn'], 'Trä',
                'Papper görs av fibrer från träd. Gammalt papper kan också återvinnas till nytt.'),
        ], beskrivning='Vad olika material klarar: magneter, el, värme, att flyta och vad saker görs av.'),

        niva('no-ak4-material-2', 'Ämnen som förändras', 'Material och ämnen', [
            val('Vad händer med is som ligger i ett varmt rum?',
                ['Den smälter', 'Den blir hårdare', 'Den blir större',
                 'Ingenting'],
                'Den smälter',
                'Värmen i rummet får isen att smälta. Det är samma ämne, vatten, fast i en annan form.'),
            sant('Smält choklad kan bli fast igen när den svalnar.', True,
                 'Chokladen har bara smält. Svalnar den stelnar den igen, som när smält is fryser.'),
            sant('Ett papper som har brunnit upp kan bli ett papper igen.', False,
                 'När papperet brinner blir det nya ämnen: aska, rök och gaser. Det går inte att '
                 'göra om till papper.'),
            para('Para ihop förändringen med vad den heter.',
                 [('Is blir vatten', 'Smälter'), ('Vatten blir is', 'Fryser'),
                  ('Vatten blir vattenånga', 'Avdunstar'), ('Ånga blir vattendroppar', 'Kondenserar')],
                 'Smälta och frysa är motsatser, och det är avdunsta och kondensera också.'),
            val('Vad behöver en eld för att brinna?',
                ['Något som brinner, syre och värme', 'Ved, vatten och mörker', 'Vatten, luft och sand',
                 'Värme, sand och koldioxid'],
                'Något som brinner, syre och värme',
                'Elden behöver alla tre. Tar du bort en av dem slocknar den.'),
            val('Varför slocknar en liten eld i en kastrull när du lägger på ett lock?',
                ['Locket stänger ute syret', 'Locket gör elden blöt', 'Locket gör elden varmare',
                 'Locket gör kastrullen tyngre'],
                'Locket stänger ute syret',
                'Utan syre kan elden inte brinna. Det är därför man kan kväva en eld med en '
                'brandfilt.'),
            skriv('En järnspik som ligger ute i regnet blir rödbrun. Vad heter det rödbruna? Ett ord.',
                  ['rost', 'rosten', 'järnrost', 'järnoxid'],
                  'Järnet reagerar med syre och vatten och blir rost, ett nytt ämne.'),
            ordna('Ordna vad som händer när snö till slut blir moln.',
                  ['Snön smälter', 'Vattnet avdunstar', 'Ångan kyls av högt upp', 'Moln bildas'],
                  forklaring='Snön smälter till vatten, vattnet avdunstar till ånga, och när ångan '
                             'kyls av högt upp bildas små droppar som blir moln.'),
        ], beskrivning='Smälta, frysa och avdunsta, att brinna och att rosta.'),

        niva('no-ak4-himlakroppar-1', 'Solen, jorden och månen', 'Himlakroppar', [
            val('Vad är solen?',
                ['En stjärna', 'En planet', 'En måne', 'Ett moln av eld'], 'En stjärna',
                'Solen är en stjärna, ett gigantiskt klot av het gas som lyser själv.'),
            val('Varför blir det natt?',
                ['Jorden snurrar runt sig själv', 'Solen slocknar på kvällen',
                 'Månen skymmer solen på kvällen', 'Solen åker runt jorden en gång per dygn'],
                'Jorden snurrar runt sig själv',
                'Jorden snurrar runt sig själv. Den sida som är vänd mot solen har dag, och den '
                'andra har natt.'),
            val('Ungefär hur lång tid tar det för jorden att gå ett varv runt solen?',
                ['Ett år', 'Ett dygn', 'En månad', 'En vecka'], 'Ett år',
                'Ett varv runt solen tar ungefär 365 dagar, och det är ett år.'),
            skriv('Hur många timmar är ett dygn? Svara med ett tal.', tal(24),
                  'Ett dygn är 24 timmar, en dag och en natt, ungefär den tid det tar för jorden att '
                  'snurra ett varv runt sig själv.'),
            sant('Månen går runt jorden.', True,
                 'Månen är jordens följeslagare och går ett varv runt jorden på ungefär en månad.'),
            val('Varför ser månen olika ut under en månad?',
                ['Vi ser olika mycket av den sida som solen lyser på',
                 'Jordens skugga täcker olika mycket av den', 'Månen växer och krymper',
                 'Moln täcker olika mycket av den'],
                'Vi ser olika mycket av den sida som solen lyser på',
                'Solen lyser alltid på halva månen. När månen går runt jorden ser vi olika mycket '
                'av den upplysta halvan.'),
            para('Para ihop ordet med vad det betyder.',
                 [('Dygn', 'Jorden snurrar ett varv runt sig själv'),
                  ('År', 'Jorden går ett varv runt solen'),
                  ('Månad', 'Ungefär ett varv för månen runt jorden')],
                 'Våra tider kommer från himlen: dygnet från jordens snurr, året från varvet runt '
                 'solen och månaden från månen.'),
            sant('Det är sommar i Sverige för att jorden är närmast solen då.', False,
                 'Jorden är faktiskt närmast solen i januari. Sommaren beror på att jordaxeln lutar: '
                 'på sommaren lutar vår del av jorden mot solen.'),
        ], beskrivning='Dag och natt, år och månad och varför månen ändrar form.'),

        niva('no-ak4-himlakroppar-2', 'Solsystemet', 'Himlakroppar', [
            skriv('Hur många planeter finns det i vårt solsystem? Svara med ett tal.', tal(8),
                  'Det finns åtta planeter: Merkurius, Venus, Jorden, Mars, Jupiter, Saturnus, '
                  'Uranus och Neptunus.'),
            ordna('Ordna planeterna, från den som är närmast solen.',
                  ['Merkurius', 'Venus', 'Jorden', 'Mars', 'Jupiter'],
                  forklaring='Merkurius är närmast solen, sedan kommer Venus, Jorden, Mars och '
                             'Jupiter. Längre ut finns Saturnus, Uranus och Neptunus.'),
            val('Vilken är den största planeten i solsystemet?',
                ['Jupiter', 'Saturnus', 'Jorden', 'Mars'], 'Jupiter',
                'Jupiter är så stor att mer än tusen jordklot skulle rymmas i den.'),
            val('Vilken planet kallas den röda planeten?',
                ['Mars', 'Venus', 'Jupiter', 'Merkurius'], 'Mars',
                'Marken på Mars innehåller mycket järn som har rostat, och det gör planeten röd.'),
            sant('Stjärnorna på natthimlen är solar, som vår sol, fast mycket längre bort.', True,
                 'Stjärnorna är solar. De ser små ut för att de är så långt borta.'),
            val('Vilken planet har stora ringar av is och sten som syns i ett teleskop?',
                ['Saturnus', 'Mars', 'Merkurius', 'Venus'], 'Saturnus',
                'Saturnus ringar består av mängder av bitar av is och sten som går runt planeten.'),
            skriv('Vad heter kraften som håller planeterna kvar i sina banor runt solen? Ett ord.',
                  ['gravitation', 'gravitationen', 'gravitationskraft', 'gravitationskraften',
                   'tyngdkraft', 'tyngdkraften', 'dragningskraft', 'dragningskraften'],
                  'Solen drar i planeterna med gravitationen, samma sorts kraft som får saker att '
                  'falla mot marken här.'),
            val('Vilken himlakropp är närmast jorden?',
                ['Månen', 'Solen', 'Mars', 'Venus'], 'Månen',
                'Månen är mycket närmare än både solen och de andra planeterna.'),
        ], beskrivning='Planeterna, stjärnorna och kraften som håller ihop solsystemet.'),
    ]),

    # ================================================================ åk 6
    bana(AMNE, 'ak6', [
        niva('no-ak6-kroppen-1', 'Blodet och andningen', 'Kroppens organ', [
            para('Para ihop blodets del med vad den gör.',
                 [('Röda blodkroppar', 'Bär syre'),
                  ('Vita blodkroppar', 'Försvarar mot bakterier och virus'),
                  ('Blodplättar', 'Hjälper blodet att levra sig'),
                  ('Blodplasma', 'Den flytande delen som bär näring')],
                 'De röda blodkropparna gör blodet rött och bär syret, de vita försvarar kroppen, '
                 'blodplättarna täpper till sår och plasman bär näring och avfall.'),
            val('Vilka blodkärl leder blodet från hjärtat ut i kroppen?',
                ['Artärer', 'Vener', 'Kapillärer', 'Luftrör'], 'Artärer',
                'Artärerna, pulsådrorna, leder blodet bort från hjärtat. Venerna leder det tillbaka.'),
            val('I vilka tunna blodkärl går syret över från blodet till cellerna?',
                ['Kapillärer', 'Artärer', 'Vener', 'Luftrör'], 'Kapillärer',
                'Kapillärerna är så tunna att syre och näring kan gå rakt igenom väggarna till '
                'cellerna.'),
            skriv('Du räknar din puls och får %d slag på %d sekunder. Hur många slag blir det på en '
                  'minut? Svara med ett tal.' % (PULS_SLAG, PULS_S),
                  tal(PULS_MIN),
                  'En minut är 60 sekunder, alltså %d gånger %d sekunder. %d · %d = %d slag i '
                  'minuten.' % (60 // PULS_S, PULS_S, PULS_SLAG, 60 // PULS_S, PULS_MIN)),
            ordna('Ordna luftens väg när du andas in.',
                  ['Näsan eller munnen', 'Luftstrupen', 'Luftrören', 'Lungblåsorna'],
                  forklaring='Luften går in genom näsan eller munnen, ner i luftstrupen, som delar '
                             'sig i luftrör, och ut till de små lungblåsorna, där syret går över '
                             'till blodet.'),
            val('Vilken muskel under lungorna hjälper dig att andas in?',
                ['Mellangärdet', 'Hjärtat', 'Magmusklerna', 'Bröstmuskeln'], 'Mellangärdet',
                'Mellangärdet drar ihop sig och sjunker nedåt. Då får lungorna mer plats och luft '
                'sugs in.'),
            val('Vilken gas andas du ut mer av än du andas in?',
                ['Koldioxid', 'Syre', 'Kväve', 'Väte'], 'Koldioxid',
                'Cellerna gör koldioxid när de frigör energi ur maten. Blodet för den till lungorna, '
                'och du andas ut den.'),
            sant('Hjärtat är en muskel.', True,
                 'Hjärtat är en muskel som drar ihop sig hela livet utan att du behöver tänka på det.'),
        ], beskrivning='Blodets delar, blodkärlen, pulsen och hur andningen går till.'),

        niva('no-ak6-kroppen-2', 'Nerverna och sinnena', 'Kroppens organ', [
            val('Vilka delar hör till det centrala nervsystemet?',
                ['Hjärnan och ryggmärgen', 'Ögonen och öronen', 'Hjärtat och lungorna',
                 'Musklerna och skelettet'],
                'Hjärnan och ryggmärgen',
                'Hjärnan och ryggmärgen är centrum. Därifrån går nerver ut i hela kroppen.'),
            val('Du rör vid en het spis och drar bort handen innan du hunnit tänka. Vad kallas det?',
                ['En reflex', 'En vana', 'En dröm', 'En instinkt att äta'], 'En reflex',
                'En reflex går via ryggmärgen och går snabbare än om hjärnan först skulle bestämma. '
                'Den skyddar kroppen.'),
            para('Para ihop ögats del med vad den gör.',
                 [('Pupillen', 'Släpper in ljuset'),
                  ('Linsen', 'Gör bilden skarp'),
                  ('Näthinnan', 'Fångar bilden och skickar signaler'),
                  ('Synnerven', 'Leder signalerna till hjärnan')],
                 'Ljuset går in genom pupillen, linsen gör bilden skarp på näthinnan, och '
                 'synnerven för signalerna till hjärnan, som tolkar vad du ser.'),
            sant('Pupillen blir mindre när det är starkt ljus.', True,
                 'När det är ljust drar pupillen ihop sig så att inte för mycket ljus kommer in. I '
                 'mörker blir den större.'),
            val('Vilken del av örat börjar vibrera när ljudet kommer in?',
                ['Trumhinnan', 'Ytterörat', 'Hörselnerven', 'Näsan'], 'Trumhinnan',
                'Ljudet får trumhinnan att vibrera. Vibrationerna förs vidare in i örat och blir '
                'signaler till hjärnan.'),
            skriv('Vilket organ känner tryck, värme, kyla och smärta över hela kroppen? Ett ord.',
                  ['huden', 'hud', 'skinnet', 'skinn'],
                  'Huden är kroppens största organ och är full av små känselkroppar.'),
            val('Vilka fem sinnen brukar man räkna?',
                ['Syn, hörsel, lukt, smak och känsel', 'Syn, hörsel, tanke, smak och känsel',
                 'Syn, lukt, smak, minne och känsel', 'Hörsel, lukt, smak, sömn och känsel'],
                'Syn, hörsel, lukt, smak och känsel',
                'Ögonen, öronen, näsan, tungan och huden tar in det som händer runt dig.'),
            ordna('Ordna vad som händer när du ser en boll komma och fångar den.',
                  ['Ögat ser bollen', 'Synnerven skickar signaler', 'Hjärnan bestämmer',
                   'Nerver skickar signaler till musklerna', 'Musklerna rör handen'],
                  forklaring='Sinnena tar in, hjärnan bestämmer och musklerna gör. Allt det går på '
                             'en bråkdel av en sekund.'),
        ], beskrivning='Hjärnan, nerverna, reflexer och hur ögat, örat och huden fungerar.'),

        niva('no-ak6-el-magnetism-1', 'Elektriska kretsar', 'Elektricitet och magnetism', [
            val('Vad behövs för att en lampa ska lysa?',
                ['En sluten krets',
                 'Bara en sladd till ena polen', 'Att lampan ligger nära batteriet', 'En magnet bredvid lampan'],
                'En sluten krets',
                'Strömmen måste kunna gå hela vägen runt, från ena polen genom lampan tillbaka till '
                'den andra.'),
            val('Vilket av de här är en isolator, alltså något som inte leder ström?',
                ['Plast', 'Koppar', 'Järn', 'Aluminium'], 'Plast',
                'Metaller leder ström. Plast, gummi och trä gör det inte, och kallas isolatorer.'),
            val('Två lampor sitter i serie. Den ena går sönder. Vad händer med den andra?',
                ['Den slocknar', 'Den lyser starkare', 'Den lyser som förut'], 'Den slocknar',
                'I en seriekoppling går strömmen genom båda lamporna efter varandra. Går den ena '
                'sönder bryts kretsen.'),
            val('Två lampor sitter parallellt. Den ena går sönder. Vad händer med den andra?',
                ['Den lyser som förut', 'Den slocknar', 'Den börjar blinka'], 'Den lyser som förut',
                'I en parallellkoppling har varje lampa en egen väg till batteriet. Den andra vägen '
                'är hel.'),
            sant('Lamporna och eluttagen i ett hus är parallellkopplade.', True,
                 'Därför kan du släcka en lampa utan att allt annat i huset slocknar.'),
            skriv('Vad heter det när strömmen tar en genväg direkt från pol till pol, förbi lampan, '
                  'så att sladden kan bli het? Ett ord.',
                  ['kortslutning', 'kortslutningen', 'kortslutningar', 'kortsluten'],
                  'Vid en kortslutning blir strömmen mycket stor. Sladdarna blir heta, och det kan '
                  'börja brinna.'),
            para('Para ihop delen i kretsen med vad den gör.',
                 [('Batteri', 'Ger energi till kretsen'),
                  ('Strömbrytare', 'Öppnar och sluter kretsen'),
                  ('Lampa', 'Gör om elenergi till ljus'),
                  ('Sladd', 'Leder strömmen')],
                 'Batteriet driver strömmen, sladden leder den, lampan använder den och '
                 'strömbrytaren bestämmer om kretsen är sluten.'),
            val('Varför får man aldrig sticka in något i ett eluttag?',
                ['Strömmen kan döda',
                 'Uttaget kan gå sönder', 'Uttaget kan bli smutsigt',
                 'Stöten känns men är ofarlig'],
                'Strömmen kan döda',
                'Uttaget har 230 volt, långt mer än ett batteri. Den strömmen kan stoppa hjärtat.'),
        ], beskrivning='Slutna kretsar, ledare och isolatorer, serie- och parallellkoppling.'),

        niva('no-ak6-el-magnetism-2', 'Magneter', 'Elektricitet och magnetism', [
            val('Vad händer när du för två nordpoler mot varandra?',
                ['De stöter bort varandra', 'De dras till varandra', 'Ingenting'],
                'De stöter bort varandra',
                'Lika poler stöter bort varandra, olika poler dras till varandra.'),
            sant('En nordpol och en sydpol dras till varandra.', True,
                 'Olika poler dras till varandra. Det är därför magneter klickar ihop.'),
            val('Vad händer om du delar en stavmagnet på mitten?',
                ['Du får två magneter med var sin nordpol och sydpol',
                 'Du får en bit som bara är nordpol och en som bara är sydpol',
                 'Magnetismen försvinner'],
                'Du får två magneter med var sin nordpol och sydpol',
                'En magnet har alltid två poler. Delar du den får varje bit en ny nordpol och '
                'sydpol.'),
            val('Åt vilket håll pekar nordänden på en kompassnål?',
                ['Ungefär mot norr', 'Mot solen', 'Rakt nedåt', 'Mot närmaste vägg'],
                'Ungefär mot norr',
                'Kompassnålen är en liten magnet som ställer in sig efter jordens magnetfält.'),
            val('Varför fungerar en kompass?',
                ['Jorden är som en stor magnet', 'Kompassen har ett batteri',
                 'Solen drar i nålens nordände', 'Nålen dras mot närmaste berg'],
                'Jorden är som en stor magnet',
                'Jorden har ett magnetfält runt sig, och kompassnålen vrider sig efter det.'),
            skriv('En magnet som bara är magnetisk när det går ström genom en spole kallas en … '
                  'Vilket ord fattas?',
                  ['elektromagnet', 'elektromagneten', 'elmagnet', 'elektromagneter'],
                  'Elektromagneten kan slås av och på. Den används till exempel i skrotkranar och '
                  'högtalare.'),
            sant('En magnet drar till sig alla metaller.', False,
                 'Bara några metaller, som järn, nickel och kobolt. Aluminium, koppar och guld dras '
                 'inte till en magnet.'),
            val('Hur kan du göra en elektromagnet starkare?',
                ['Linda fler varv tråd runt järnkärnan', 'Byta järnkärnan mot en träpinne',
                 'Ta bort batteriet', 'Linda färre varv tråd'],
                'Linda fler varv tråd runt järnkärnan',
                'Fler varv och mer ström ger ett starkare magnetfält, och järnkärnan förstärker det.'),
        ], beskrivning='Nordpol och sydpol, kompassen och elektromagneten.'),

        niva('no-ak6-materia-1', 'Partikelmodellen', 'Materiens byggnad', [
            sant('Allt omkring oss består av små partiklar som är för små för att synas.', True,
                 'Allt, också luften, vattnet och du själv, är byggt av små partiklar.'),
            para('Para ihop formen med hur partiklarna beter sig.',
                 [('Fast form', 'Sitter tätt på sina platser och vibrerar'),
                  ('Flytande form', 'Sitter tätt men kan glida förbi varandra'),
                  ('Gasform', 'Är långt ifrån varandra och rör sig fritt')],
                 'Därför behåller en sten sin form, vatten tar formen av glaset och en gas sprider '
                 'sig i hela rummet.'),
            val('Vad händer med partiklarna när ett ämne värms upp?',
                ['De rör sig snabbare', 'De blir större', 'De rör sig långsammare', 'De blir fler'],
                'De rör sig snabbare',
                'Värme är partiklarnas rörelse. Ju varmare, desto snabbare rör de sig.'),
            val('En uppblåst ballong läggs i frysen och krymper. Varför?',
                ['Partiklarna rör sig långsammare',
                 'Luften läcker ut genom gummit', 'Partiklarna krymper i kylan',
                 'Kylan drar ihop gummit hårt'],
                'Partiklarna rör sig långsammare',
                'Partiklarna blir inte mindre, men de rör sig långsammare och trycker inte lika '
                'hårt mot ballongen.'),
            skriv('Du öppnar en parfymflaska i ett hörn, och snart luktar det i hela rummet. '
                  'Partiklarna sprider sig av sig själva. Vad heter det? Ett ord.',
                  ['diffusion', 'diffusionen', 'difusion', 'diffussion'],
                  'Partiklarna rör sig hela tiden och sprider sig tills de är jämnt fördelade. Det '
                  'kallas diffusion.'),
            val('Vad kallas det när ett ämne går direkt från fast form till gas, som när snö '
                'försvinner en kall solig dag utan att smälta?',
                ['Sublimering', 'Avdunstning', 'Kondensation', 'Smältning'], 'Sublimering',
                'Snön hoppar över det flytande steget och blir vattenånga direkt. Det kallas '
                'sublimering.'),
            ordna('Ordna från där partiklarna rör sig minst till där de rör sig mest.',
                  ['Is', 'Vatten', 'Vattenånga'],
                  forklaring='I is vibrerar partiklarna på sina platser, i vatten glider de förbi '
                             'varandra och i ånga flyger de fritt.'),
            sant('Partiklarna i ett fast ämne står helt stilla.', False,
                 'De sitter på sina platser men vibrerar hela tiden. Ju varmare, desto mer.'),
        ], beskrivning='Hur partiklarna beter sig i fast form, flytande form och gasform.'),

        niva('no-ak6-materia-2', 'Grundämnen och kemiska reaktioner', 'Materiens byggnad', [
            val('Vad är ett grundämne?',
                ['Ett ämne som bara består av ett slags atomer', 'Ett ämne som finns i jorden',
                 'Ett ämne som är en blandning av flera ämnen', 'Ett ämne som alltid är en metall'],
                'Ett ämne som bara består av ett slags atomer',
                'Syre, järn och guld är grundämnen. Allt annat är byggt av grundämnen som sitter '
                'ihop eller är blandade.'),
            val('Var står alla grundämnen uppställda i en tabell?',
                ['I periodiska systemet', 'I ett kopplingsschema', 'I en näringsväv',
                 'I en tidslinje'],
                'I periodiska systemet',
                'Periodiska systemet ordnar grundämnena efter hur många protoner deras atomer har.'),
            para('Para ihop grundämnet med dess kemiska tecken.',
                 [('Syre', 'O'), ('Väte', 'H'), ('Kol', 'C'), ('Järn', 'Fe'), ('Guld', 'Au')],
                 'Tecknen kommer ofta från latin: Fe av ferrum för järn och Au av aurum för guld.'),
            skriv('En vattenmolekyl, H₂O, består av väteatomer och syreatomer. Hur många atomer '
                  'finns det i en vattenmolekyl?',
                  tal(VATTEN_ATOMER),
                  'Tvåan efter H betyder två väteatomer, och O står för en syreatom: 2 + 1 = %d.'
                  % VATTEN_ATOMER),
            val('Vad visar att en kemisk reaktion har skett?',
                ['Ett nytt ämne har bildats', 'Vattnet har frusit till is',
                 'Sockret har löst sig i vattnet', 'Glaset har gått sönder'],
                'Ett nytt ämne har bildats',
                'I en kemisk reaktion blir det nya ämnen. Att frysa, lösas upp eller gå sönder '
                'ändrar inte vilket ämne det är.'),
            sant('När ved brinner bildas nya ämnen, bland annat koldioxid och vatten.', True,
                 'Vedens atomer reagerar med syret i luften och bildar nya ämnen som går ut i luften.'),
            val('Vilket av de här är en kemisk reaktion?',
                ['En bulle bakas i ugnen', 'Smör smälter i stekpannan', 'Vatten fryser till is',
                 'Salt löser sig i vatten'],
                'En bulle bakas i ugnen',
                'När degen gräddas blir det nya ämnen, och bullen kan aldrig bli deg igen. De andra '
                'går att vända tillbaka.'),
            sant('Atomerna försvinner när ett ämne brinner upp.', False,
                 'Atomerna finns kvar, men de ordnas om till nya ämnen, som koldioxid och vatten.'),
        ], beskrivning='Grundämnen, kemiska tecken och hur man känner igen en kemisk reaktion.'),

        niva('no-ak6-ekosystem-1', 'Näringskedjor och energi', 'Ekosystem', [
            ordna('Ordna näringskedjan i sjön. Börja med producenten.',
                  ['Alger', 'Djurplankton', 'Abborre', 'Gädda'],
                  forklaring='Algerna gör näring med solljus, djurplankton äter algerna, abborren '
                             'äter planktonen och gäddan äter abborren.'),
            para('Para ihop ordet med vad det betyder.',
                 [('Producent', 'Gör sin egen näring med solens energi'),
                  ('Konsument', 'Äter andra organismer'),
                  ('Nedbrytare', 'Bryter ner döda växter och djur')],
                 'Växterna producerar, djuren konsumerar, och svampar och bakterier bryter ner.'),
            val('Varifrån kommer nästan all energi i ett ekosystem från början?',
                ['Från solen', 'Från jorden', 'Från vattnet', 'Från nedbrytarna'], 'Från solen',
                'Växterna fångar solens energi, och sedan går den vidare till djuren som äter dem.'),
            skriv('Växterna på en äng har fångat %s kJ energi. Anta att en tiondel av energin går '
                  'vidare till nästa led. Hur många kJ når växtätarna? Svara i kJ.' % tal(ANG_KJ),
                  tal(VAXTATARE_KJ),
                  'En tiondel av %s är %s / 10 = %s kJ.' % (tal(ANG_KJ), tal(ANG_KJ), tal(VAXTATARE_KJ))),
            skriv('Med samma regel, en tiondel per led: hur många kJ når rovdjuren som äter '
                  'växtätarna, när växterna fångade %s kJ? Svara i kJ.' % tal(ANG_KJ),
                  tal(ROVDJUR_KJ),
                  'Växtätarna fick %s kJ, och en tiondel av det är %s kJ. Det är bara en '
                  'hundradel av det växterna fångade.' % (tal(VAXTATARE_KJ), tal(ROVDJUR_KJ))),
            val('Varför finns det färre rovdjur än växtätare i ett ekosystem?',
                ['Det mesta av energin används upp på vägen',
                 'Rovdjur lever kortare än växtätare', 'Rovdjur får färre ungar av en slump',
                 'Rovdjuren svälter ihjäl varje vinter'],
                'Det mesta av energin används upp på vägen',
                'Djuren använder det mesta av energin för att leva och röra sig. Bara lite blir kvar '
                'till nästa led.'),
            val('Vad kallas flera näringskedjor som hänger ihop?',
                ['En näringsväv', 'En näringspyramid', 'Ett kretslopp', 'En population'],
                'En näringsväv',
                'De flesta djur äter mer än en sort och blir uppätna av flera. Kedjorna flätas ihop '
                'till en väv.'),
            sant('En räv kan vara med i flera olika näringskedjor.', True,
                 'Räven äter sorkar, fåglar, bär och mycket annat, så den finns i många kedjor.'),
        ], beskrivning='Producenter, konsumenter och nedbrytare, och hur energin minskar i kedjan.'),

        niva('no-ak6-ekosystem-2', 'Kretslopp och samspel', 'Ekosystem', [
            val('Vad gör nedbrytarna med ett dött löv?',
                ['Bryter ner det till näring som växter kan ta upp', 'Gör det grönt igen',
                 'Förvandlar det till sten', 'Ingenting, lövet ligger kvar för alltid'],
                'Bryter ner det till näring som växter kan ta upp',
                'Svampar, bakterier och maskar bryter ner lövet. Näringen hamnar i jorden och blir '
                'till nya växter.'),
            para('Para ihop ordet med förklaringen.',
                 [('Population', 'Alla individer av en art i ett område'),
                  ('Art', 'Individer som kan få ungar som också kan få ungar'),
                  ('Ekosystem', 'Det levande och det icke-levande i ett område')],
                 'Alla rådjur i en skog är en population, rådjur är en art, och skogen med jord, '
                 'vatten och alla organismer är ett ekosystem.'),
            val('Vad menas med biologisk mångfald?',
                ['Att det finns många olika arter och miljöer', 'Att det finns många individer av '
                 'en art', 'Att alla djur är stora', 'Att det växer mycket gräs'],
                'Att det finns många olika arter och miljöer',
                'Mångfald betyder variation. Ju fler arter och miljöer, desto bättre klarar naturen '
                'förändringar.'),
            val('Två arter äter samma sorts mat i en skog. Vad kallas det?',
                ['Konkurrens', 'Fotosyntes', 'Nedbrytning', 'Pollinering'], 'Konkurrens',
                'De tävlar om samma mat, och det kallas konkurrens.'),
            sant('Växter tar upp koldioxid, och både växter och djur släpper ut koldioxid när de '
                 'andas.', True,
                 'Växterna tar upp koldioxid i fotosyntesen, men deras celler andas också, precis '
                 'som djurens.'),
            val('Varför är bin viktiga för äppelträd?',
                ['De pollinerar blommorna', 'De äter skadedjur på bladen',
                 'De gödslar jorden runt trädet', 'De sprider fröna med vinden'],
                'De pollinerar blommorna',
                'Utan pollinering bildas inga frön och ingen frukt.'),
            skriv('Vad heter processen där växter gör socker och syre av koldioxid och vatten med '
                  'hjälp av solljus? Ett ord.',
                  ['fotosyntes', 'fotosyntesen', 'fotosyntesis'],
                  'Foto betyder ljus och syntes betyder att bygga ihop: växten bygger socker med '
                  'ljusets hjälp.'),
            ordna('Ordna kolets väg i kretsloppet.',
                  ['Trädet tar upp koldioxid', 'Kolet byggs in i bladen', 'Ett dött blad bryts ner',
                   'Koldioxid släpps ut i luften igen'],
                  forklaring='Kolet går runt: från luften in i växten, och när nedbrytarna bryter '
                             'ner bladet släpps det ut i luften igen.'),
        ], beskrivning='Nedbrytning, kretslopp, biologisk mångfald och hur arter påverkar varandra.'),
    ]),

    # ================================================================ åk 7
    bana(AMNE, 'ak7', [
        niva('no-ak7-celler-1', 'Mikroskopet och cellen', 'Celler och mikroorganismer', [
            skriv('Ett mikroskop har ett okular som förstorar %d gånger och ett objektiv som '
                  'förstorar %d gånger. Hur många gånger förstoras bilden totalt?'
                  % (OKULAR, OBJEKTIV),
                  tal(FORSTORING),
                  'Förstoringarna gångras: %d · %d = %d gånger. Objektivet förstorar först, och '
                  'okularet förstorar den bilden.' % (OKULAR, OBJEKTIV, FORSTORING)),
            val('Vad består alla levande organismer av?',
                ['En eller flera celler', 'Bara vävnader och organ', 'Vatten och salter', 'Små kristaller'],
                'En eller flera celler',
                'Cellen är livets minsta byggsten. En bakterie är en enda cell, du är miljarder.'),
            para('Para ihop celldelen med vad den gör.',
                 [('Cellkärnan', 'Innehåller arvsmassan och styr cellen'),
                  ('Cellmembranet', 'Bestämmer vad som går in och ut'),
                  ('Mitokondrien', 'Frigör energi ur socker'),
                  ('Kloroplasten', 'Gör fotosyntes'),
                  ('Cellväggen', 'Ger växtcellen stadga')],
                 'Kärnan styr, membranet vaktar, mitokondrierna ger energi, kloroplasterna fångar '
                 'solljus och cellväggen håller formen.'),
            sant('Djurceller har kloroplaster.', False,
                 'Bara växter och alger har kloroplaster. Djur gör ingen fotosyntes, de får sin '
                 'energi ur maten.'),
            val('Varför färgar man ofta ett prov innan man tittar på det i mikroskop?',
                ['Delarna i cellen syns tydligare', 'Cellerna lever längre i provet', 'Provet blir större i okularet',
                 'Bakterierna i provet dör'],
                'Delarna i cellen syns tydligare',
                'Många celldelar är nästan genomskinliga. Färgen fastnar olika mycket och gör '
                'delarna synliga.'),
            ordna('Ordna från minst till störst.',
                  ['Ett virus', 'En bakterie', 'En hudcell', 'Ett sandkorn'],
                  forklaring='Virus är mycket mindre än bakterier, bakterier är mindre än våra '
                             'celler, och ett sandkorn är så stort att du ser det utan mikroskop.'),
            val('Vilken av de här delarna finns i både växtceller och djurceller?',
                ['Cellmembran', 'Cellvägg', 'Kloroplaster', 'En stor vakuol med cellsaft'],
                'Cellmembran',
                'Alla celler har ett cellmembran. Cellvägg, kloroplaster och stor vakuol finns bara '
                'hos växtceller.'),
            skriv('En cell ser %s mm stor ut i ett mikroskop som förstorar %d gånger. Hur stor är '
                  'den i verkligheten? Svara i mikrometer (µm). 1 mm = 1 000 µm.'
                  % (t(CELL_BILD_MM), CELL_FORST),
                  t(CELL_UM),
                  '%s mm är %s µm. I verkligheten är cellen %d gånger mindre: %s / %d = %s µm.'
                  % (t(CELL_BILD_MM), tal(int(CELL_BILD_MM * 1000)), CELL_FORST,
                     tal(int(CELL_BILD_MM * 1000)), CELL_FORST, t(CELL_UM))),
        ], beskrivning='Mikroskopet, cellens delar och hur stora celler är.'),

        niva('no-ak7-celler-2', 'Bakterier, virus och svampar', 'Celler och mikroorganismer', [
            val('Vad skiljer en bakterie från en människocell?',
                ['Bakterien har ingen cellkärna', 'Bakterien har inget DNA',
                 'Bakterien saknar cellmembran', 'Bakterien består av många celler'],
                'Bakterien har ingen cellkärna',
                'Bakteriens DNA ligger fritt i cellen. Den har DNA och membran, men ingen kärna.'),
            sant('Ett virus är en cell.', False,
                 'Ett virus är ingen cell. Det kan bara föröka sig inne i en annan organisms celler.'),
            sant('Antibiotika hjälper mot en förkylning som orsakas av virus.', False,
                 'Antibiotika dödar bakterier men biter inte på virus. Därför hjälper det inte mot '
                 'förkylning.'),
            skriv('En bakterie delar sig var %d:e minut. Du börjar med en bakterie. Hur många finns '
                  'det efter %d timmar, om alla överlever?' % (DELNING_MIN, BAKT_MIN // 60),
                  tal(BAKTERIER),
                  '%d timmar är %d minuter, alltså %d delningar. Antalet fördubblas varje gång: '
                  '1 → 2 → 4 → 8 → 16 → 32 → %d.'
                  % (BAKT_MIN // 60, BAKT_MIN, DELNINGAR, BAKTERIER)),
            para('Para ihop mikroorganismen med vad den används till.',
                 [('Jäst', 'Får bröddeg att jäsa'),
                  ('Mjölksyrabakterier', 'Gör mjölk till yoghurt'),
                  ('Mögelsvampen Penicillium', 'Gav det första antibiotikumet')],
                 'Jästen är en svamp, mjölksyrabakterierna gör mjölken syrlig och tjock, och '
                 'penicillinet kommer från en mögelsvamp.'),
            val('Varför blir bröddeg större när den jäser?',
                ['Jästen bildar koldioxid',
                 'Degen suger upp luft ur rummet', 'Mjölet sväller av värmen',
                 'Jästen växer till stora klumpar'],
                'Jästen bildar koldioxid',
                'Jästen äter socker i degen och bildar koldioxid. Gasen fastnar i degen som små '
                'bubblor.'),
            val('Hur fungerar ett vaccin?',
                ['Kroppen får öva på att känna igen smittan',
                 'Det dödar alla bakterier i kroppen', 'Det är ett slags antibiotikum',
                 'Det bygger en vägg som virus inte kommer igenom'],
                'Kroppen får öva på att känna igen smittan',
                'Immunförsvaret lär sig känna igen smittan i förväg, och kan slå till snabbt om den '
                'kommer på riktigt.'),
            val('Varför håller mat längre i kylskåpet?',
                ['Bakterierna förökar sig långsammare', 'Kylan dödar alla bakterier',
                 'Maten torkar ut och blir för torr för dem', 'Lampan i kylskåpet dödar bakterier'],
                'Bakterierna förökar sig långsammare',
                'Kylan dödar inte bakterierna, men de delar sig mycket långsammare.'),
        ], beskrivning='Bakterier, virus och svampar, antibiotika, vaccin och mikroorganismer i maten.'),

        niva('no-ak7-tryck-densitet-1', 'Densitet', 'Tryck och densitet', [
            val('Hur räknar man ut densitet?',
                ['Massan delat med volymen', 'Volymen delat med massan', 'Massan gånger volymen',
                 'Massan plus volymen'],
                'Massan delat med volymen',
                'Densiteten säger hur mycket massa det finns i varje kubikcentimeter: ρ = m / V.'),
            skriv('En metallbit har massan %s g och volymen %s cm³. Vilken densitet har den? '
                  'Svara i g/cm³.' % (t(D1_M), t(D1_V)),
                  t(D1),
                  'ρ = m / V = %s / %s = %s g/cm³. Det är aluminiums densitet.'
                  % (t(D1_M), t(D1_V), t(D1))),
            skriv('En vätska har densiteten %s g/cm³. Hur många gram är %s cm³ av vätskan? '
                  'Svara i gram.' % (t(D2_RHO), t(D2_V)),
                  t(D2_M),
                  'm = ρ · V = %s · %s = %s g.' % (t(D2_RHO), t(D2_V), t(D2_M))),
            skriv('Du sänker ner en sten som väger %s g i ett mätglas med %s ml vatten. Vattnet '
                  'stiger till %s ml. Vilken densitet har stenen? Svara i g/cm³. 1 ml = 1 cm³.'
                  % (t(STEN_M), t(GLAS_FORE), t(GLAS_EFTER)),
                  t(STEN_RHO),
                  'Stenens volym är det vattnet steg: %s − %s = %s cm³. ρ = %s / %s = %s g/cm³.'
                  % (t(GLAS_EFTER), t(GLAS_FORE), t(STEN_V), t(STEN_M), t(STEN_V), t(STEN_RHO))),
            val('Vatten har densiteten 1,0 g/cm³. Ett föremål har densiteten 1,3 g/cm³. Vad händer '
                'när du lägger det i vatten?',
                ['Det sjunker', 'Det flyter', 'Det lägger sig precis vid ytan'], 'Det sjunker',
                'Ett föremål med högre densitet än vatten sjunker, och ett med lägre flyter.'),
            sant('Is har lägre densitet än flytande vatten.', True,
                 'Därför flyter isen, och sjöar fryser uppifrån och ner.'),
            ordna('På varje kloss står massan och volymen. Ordna klossarna från lägst till högst '
                  'densitet.',
                  [kloss_bricka(k) for k in KLOSSAR_ORDNADE],
                  forklaring='Dela massan med volymen: ' + ', '.join(
                      '%s: %s / %s = %s' % (k[0], t(k[1]), t(k[2]), t(k[1] / k[2]))
                      for k in KLOSSAR_ORDNADE) + ' g/cm³.'),
            skriv('Järn har densiteten %s g/cm³. Vilken volym har en järnbit som väger %s g? '
                  'Svara i cm³.' % (t(JARN_RHO), t(JARN_M)),
                  t(JARN_V),
                  'V = m / ρ = %s / %s = %s cm³.' % (t(JARN_M), t(JARN_RHO), t(JARN_V))),
        ], beskrivning='Att räkna med densitet, ρ = m / V, och varför saker flyter eller sjunker.'),

        niva('no-ak7-tryck-densitet-2', 'Tryck', 'Tryck och densitet', [
            val('Vilken formel ger trycket?',
                ['p = F / A', 'p = F · A', 'p = A / F', 'p = m · V'], 'p = F / A',
                'Trycket är kraften delad på arean den trycker på. Enheten är pascal, 1 Pa = 1 N/m².'),
            skriv('En låda med tyngden %s N står på golvet. Lådans botten har arean %s m². Hur '
                  'stort tryck blir det mot golvet? Svara i pascal (Pa).' % (t(T1_F), t(T1_A)),
                  t(T1_P),
                  'p = F / A = %s / %s = %s Pa.' % (t(T1_F), t(T1_A), t(T1_P))),
            skriv('Din tyngd är %s N. Dina skor har arean %s m² tillsammans och dina skidor %s m². '
                  'Hur många gånger större är trycket mot snön med skorna än med skidorna?'
                  % (t(SKIDA_F), t(SKOR_A), t(SKIDOR_A)),
                  t(SKID_GANGER),
                  'Med skor: %s / %s = %s Pa. Med skidor: %s / %s = %s Pa. %s / %s = %s gånger.'
                  % (t(SKIDA_F), t(SKOR_A), t(SKOR_P), t(SKIDA_F), t(SKIDOR_A), t(SKIDOR_P),
                     t(SKOR_P), t(SKIDOR_P), t(SKID_GANGER))),
            val('Varför sjunker man inte lika djupt i snön med snöskor?',
                ['Trycket blir mindre',
                 'Snöskorna gör en lättare', 'Snöskorna gör snön hårdare',
                 'Trycket blir större'],
                'Trycket blir mindre',
                'Tyngden är densamma, men den delas på en större area.'),
            sant('Trycket i vatten blir större ju djupare ner man kommer.', True,
                 'Ju djupare, desto mer vatten ovanför som trycker. Det känns i öronen när du dyker.'),
            skriv('Trycket i vatten ökar med ungefär %d kPa för varje meter du dyker ner. Hur många '
                  'kPa större är trycket på %s meters djup än vid ytan? Svara i kPa.'
                  % (DJUP_KPA_PER_M, t(DJUP_M)),
                  t(DJUP_KPA),
                  '%s · %d = %s kPa.' % (t(DJUP_M), DJUP_KPA_PER_M, t(DJUP_KPA))),
            val('Ungefär hur stort är lufttrycket vid havsytan?',
                ['100 kPa', '1 kPa', '10 Pa', '10 000 kPa'], '100 kPa',
                'Lufttrycket vid havsytan är omkring 100 kPa. Högre upp är det lägre, för där är '
                'det mindre luft ovanför.'),
            skriv('Ett akvarium står på en bänk. Trycket mot bänken är %s Pa och akvariets botten '
                  'har arean %s m². Hur stor är akvariets tyngd? Svara i newton (N).'
                  % (t(AKV_P), t(AKV_A)),
                  t(AKV_F),
                  'F = p · A = %s · %s = %s N.' % (t(AKV_P), t(AKV_A), t(AKV_F))),
        ], beskrivning='Att räkna med tryck, p = F / A, trycket i vatten och lufttrycket.'),

        niva('no-ak7-syror-baser-1', 'Syror och baser i vardagen', 'Syror och baser', [
            para('Para ihop syran med var den finns.',
                 [('Ättiksyra', 'Ättika'), ('Citronsyra', 'Citroner'),
                  ('Kolsyra', 'Läsk med bubblor'), ('Saltsyra', 'Magsaften')],
                 'Syror finns överallt omkring oss, i maten och i kroppen.'),
            val('Vilket av de här är basiskt?',
                ['Tvållösning', 'Citronsaft', 'Ättika', 'Apelsinjuice'], 'Tvållösning',
                'Tvål ger en basisk lösning. Citronsaft, ättika och apelsinjuice innehåller syror.'),
            val('Vilken regel gäller när du späder en stark syra med vatten?',
                ['Häll syran i vattnet', 'Häll vattnet i syran',
                 'Värm syran först', 'Blanda i en bas först'],
                'Häll syran i vattnet',
                'Det blir mycket varmt när syran späds. Häller du vatten i syran kan det koka och '
                'stänka. Minnesregel: först vatten, sen syra.'),
            sant('Starka baser kan fräta på huden precis som starka syror.', True,
                 'Både starka syror och starka baser är frätande. Propplösare är till exempel '
                 'starkt basiskt.'),
            val('Vad ska du alltid ha på dig när du arbetar med syror och baser i skolan?',
                ['Skyddsglasögon', 'Solglasögon', 'Vantar av ull', 'Mössa'], 'Skyddsglasögon',
                'Ögonen skadas lätt. Ett enda stänk kan ge en skada som inte går över.'),
            skriv('Vad kallas en lösning som varken är sur eller basisk, som rent vatten? Ett ord.',
                  ['neutral', 'neutrala', 'neutralt'],
                  'En neutral lösning har pH 7.'),
            val('Varför kalkar man en del sjöar i Sverige?',
                ['För att vattnet blivit för surt', 'För att göra vattnet surare',
                 'För att få isen att smälta fortare', 'För att vattnet ska bli klarare'],
                'För att vattnet blivit för surt',
                'Kalk är basiskt och neutraliserar syran, så att fiskar och andra djur kan leva där.'),
            val('Vilket ämne är starkt basiskt och används för att lösa upp stopp i avlopp?',
                ['Natriumhydroxid', 'Citronsyra', 'Natriumklorid', 'Ättiksyra'], 'Natriumhydroxid',
                'Natriumhydroxid, lut, löser upp fett och hår. Den är frätande och ska hanteras '
                'varsamt.'),
        ], beskrivning='Syror och baser i vardagen och hur man hanterar dem säkert.'),

        niva('no-ak7-syror-baser-2', 'pH och indikatorer', 'Syror och baser', [
            ordna('Ordna från surast till mest basisk.',
                  ['Ättika (pH 3)', 'Kaffe (pH 5)', 'Rent vatten (pH 7)', 'Tvållösning (pH 10)',
                   'Propplösare (pH 14)'],
                  forklaring='Ju lägre pH, desto surare. pH 7 är neutralt, och ju högre över 7, '
                             'desto mer basiskt.'),
            val('BTB är en indikator. Vilken färg får den i en sur lösning?',
                ['Gul', 'Blå', 'Grön', 'Röd'], 'Gul',
                'BTB är gul i en sur lösning, grön i en neutral och blå i en basisk.'),
            para('Para ihop pH-värdet med ordet.',
                 [('pH 1', 'Starkt sur'), ('pH 6', 'Svagt sur'), ('pH 7', 'Neutral'),
                  ('pH 13', 'Starkt basisk')],
                 'Långt under 7 är starkt surt, strax under 7 svagt surt, 7 neutralt och långt över '
                 '7 starkt basiskt.'),
            skriv('När pH sjunker ett steg blir lösningen tio gånger surare. Hur många gånger surare '
                  'är en lösning med pH %d än en med pH %d?' % (PH_SUR, PH_MINDRE_SUR),
                  tal(PH_GANGER),
                  'Det är %d steg, och varje steg är tio gånger: 10 · 10 = %d.'
                  % (PH_MINDRE_SUR - PH_SUR, PH_GANGER)),
            val('Vad händer med pH när du tillsätter en bas till en sur lösning?',
                ['pH stiger', 'pH sjunker', 'pH blir alltid exakt 7', 'Ingenting'], 'pH stiger',
                'Basen neutraliserar syran, så lösningen blir mindre sur och pH stiger.'),
            sant('En lösning med pH 9 är basisk.', True,
                 'Allt över 7 är basiskt.'),
            skriv('Vilka joner finns det mycket av i en basisk lösning? Skriv namnet.',
                  ['hydroxidjoner', 'hydroxidjon', 'hydroxidjonerna', 'hydroxid', 'OH-', 'OH⁻'],
                  'Baser ger hydroxidjoner, OH⁻. Syror ger vätejoner, H⁺.'),
            val('Rödkålssaft byter färg efter pH. Vad kallas ett sådant ämne?',
                ['En indikator', 'En katalysator', 'En isolator', 'En polymer'], 'En indikator',
                'En indikator visar med sin färg om en lösning är sur, neutral eller basisk.'),
        ], beskrivning='pH-skalan, indikatorer och hur mycket surare ett steg på skalan är.'),

        niva('no-ak7-energi-1', 'Energiformer och omvandlingar', 'Energiformer', [
            para('Para ihop energiformen med ett exempel.',
                 [('Lägesenergi', 'Ett äpple högt upp i ett träd'),
                  ('Rörelseenergi', 'En cyklist i full fart'),
                  ('Kemisk energi', 'Maten du äter'),
                  ('Strålningsenergi', 'Solljuset'),
                  ('Elektrisk energi', 'Strömmen i en sladd')],
                 'Energin finns i många former och kan gå över från den ena till den andra.'),
            sant('Energi kan förstöras så att den försvinner helt.', False,
                 'Energi kan inte förstöras och inte skapas, bara omvandlas. Det kallas '
                 'energiprincipen.'),
            val('Vilken energiomvandling sker i en ficklampa?',
                ['Kemisk energi blir el, ljus och värme',
                 'Ljus och värme blir kemisk energi', 'Värme blir elektrisk energi och ljus',
                 'Rörelseenergi blir kemisk energi'],
                'Kemisk energi blir el, ljus och värme',
                'Batteriet lagrar kemisk energi. Den blir el, och lampan gör om elen till ljus och '
                'lite värme.'),
            ordna('Ordna energins väg, från solen till när du cyklar.',
                  ['Solljus når ett vetefält', 'Vetet lagrar kemisk energi', 'Du äter en smörgås',
                   'Musklerna ger rörelseenergi'],
                  forklaring='Växten fångar solens energi som kemisk energi. Du får den genom maten, '
                             'och musklerna gör om den till rörelse.'),
            val('Varför blir en glödlampa varm när den lyser?',
                ['En del av elen blir värme',
                 'Ljuset är varmt i sig självt', 'Lampan tar värme från rummet',
                 'Glaset leder strömmen'],
                'En del av elen blir värme',
                'Ingen omvandling blir bara det man vill ha. Det som inte blir ljus blir värme.'),
            skriv('En lampa får %s J elektrisk energi och ger %s J ljus. Resten blir värme. Hur stor '
                  'är verkningsgraden? Svara i procent.' % (t(LAMPA_IN), t(LAMPA_LJUS)),
                  t(LAMPA_VG),
                  'Verkningsgraden är nyttig energi delat med tillförd: %s / %s = %s, alltså %s %%.'
                  % (t(LAMPA_LJUS), t(LAMPA_IN), t(LAMPA_LJUS / LAMPA_IN), t(LAMPA_VG))),
            val('Var kommer energin i olja och kol från från början?',
                ['Från solen', 'Från jordens kärna',
                 'Från vulkaner', 'Från månen'],
                'Från solen',
                'Växter och djur som dog för miljontals år sedan blev olja och kol. Energin i dem '
                'kom en gång från solljuset.'),
            sant('När en cykel bromsar blir rörelseenergin till värme i bromsarna.', True,
                 'Friktionen i bromsarna gör om rörelseenergin till värme. Känn på bromsen efter en '
                 'lång nedförsbacke.'),
        ], beskrivning='Energiformerna, energiprincipen, omvandlingar och verkningsgrad.'),

        niva('no-ak7-energi-2', 'Energi och effekt', 'Energiformer', [
            val('Vilken enhet mäts energi i?',
                ['joule (J)', 'watt (W)', 'newton (N)', 'pascal (Pa)'], 'joule (J)',
                'Energi mäts i joule. Effekt mäts i watt, kraft i newton och tryck i pascal.'),
            val('Vad betyder effekt?',
                ['Hur mycket energi som omvandlas varje sekund', 'Hur mycket energi något har totalt',
                 'Hur tungt något är', 'Hur fort något rör sig'],
                'Hur mycket energi som omvandlas varje sekund',
                'Effekt är energi per tid. 1 watt är 1 joule per sekund.'),
            skriv('En motor omvandlar %s J på %s sekunder. Vilken effekt har den? Svara i watt (W).'
                  % (t(E1_J), t(E1_S)),
                  t(E1_W),
                  'P = E / t = %s / %s = %s W.' % (t(E1_J), t(E1_S), t(E1_W))),
            skriv('En vattenkokare på %s W är på i %s sekunder. Hur mycket energi använder den? '
                  'Svara i kilojoule (kJ).' % (t(KOK_W), t(KOK_S)),
                  t(KOK_KJ),
                  'E = P · t = %s · %s = %s J, och det är %s kJ.'
                  % (t(KOK_W), t(KOK_S), t(KOK_W * KOK_S), t(KOK_KJ))),
            skriv('En lampa på %s W lyser i %s timmar. Hur mycket energi använder den? Svara i '
                  'wattimmar (Wh).' % (t(LED_W), t(LED_H)),
                  t(LED_WH),
                  'E = P · t = %s W · %s h = %s Wh.' % (t(LED_W), t(LED_H), t(LED_WH))),
            skriv('Du lyfter en låda på %s kg %s meter upp. Hur mycket lägesenergi får lådan? '
                  'Räkna med E = m · g · h och g = %s N/kg. Svara i joule (J).'
                  % (t(LAGE_M), t(LAGE_H), t(G)),
                  t(LAGE_J),
                  'E = %s · %s · %s = %s J.' % (t(LAGE_M), t(G), t(LAGE_H), t(LAGE_J))),
            skriv('Ett element på %s kW är på i %s timmar. Hur många kilowattimmar (kWh) använder '
                  'det?' % (t(ELEMENT_KW), t(ELEMENT_H)),
                  t(ELEMENT_KWH),
                  'E = P · t = %s kW · %s h = %s kWh.' % (t(ELEMENT_KW), t(ELEMENT_H), t(ELEMENT_KWH))),
            sant('En lampa på 10 W använder mindre energi på en timme än en lampa på 60 W.', True,
                 'Effekten säger hur mycket energi som går åt per sekund. Under samma tid använder '
                 'den med lägre effekt mindre energi.'),
        ], beskrivning='Joule och watt, och att räkna med energi, effekt och lägesenergi.'),
    ]),

    # ================================================================ åk 9
    bana(AMNE, 'ak9', [
        niva('no-ak9-genetik-1', 'Arv och DNA', 'Genetik och evolution', [
            val('Hur många kromosomer finns det i de flesta av en människas celler?',
                [46, 23, 48, 92], 46,
                'Kroppens celler har 23 par kromosomer, alltså 46. Ena halvan kommer från mamman, '
                'andra från pappan.'),
            skriv('Hur många kromosomer finns det i en människas könscell, till exempel en '
                  'spermie? Svara med ett tal.', tal(46 // 2),
                  'Könscellerna har bara en kromosom ur varje par, alltså 23. När ägg och spermie '
                  'möts blir det 46 igen.'),
            para('Para ihop ordet med förklaringen.',
                 [('DNA', 'Molekylen som bär arvsmassan'),
                  ('Gen', 'En bit DNA med instruktionen till ett protein'),
                  ('Kromosom', 'En lång tråd av hoprullat DNA'),
                  ('Mutation', 'En förändring i DNA')],
                 'DNA är ritningen, generna är instruktionerna i den, kromosomerna är hur DNA:t är '
                 'packat, och en mutation är ett ändrat tecken i ritningen.'),
            skriv('DNA:s baser parar alltid ihop sig på samma sätt: A med T och C med G. Vilken bas '
                  'sitter mittemot G? Skriv bokstaven.',
                  ['C', 'cytosin'],
                  'G parar alltid med C, och A alltid med T.'),
            ordna('En DNA-sträng har baserna %s. Bygg den motsatta strängen, i samma ordning.'
                  % ' '.join(DNA_STRANG),
                  DNA_MOT,
                  forklaring='A parar med T och C med G: ' + ', '.join(
                      '%s → %s' % (b, BASPAR[b]) for b in DNA_STRANG) + '.'),
            skriv('Hos ärtor är gul färg dominant (A) och grön recessiv (a). Två ärtplantor som båda '
                  'är Aa korsas. Hur många procent av avkomman väntas bli gröna? Svara i procent.',
                  t(AA_AA),
                  'Varje förälder ger A eller a. Möjligheterna är AA, Aa, aA och aa, och bara aa blir '
                  'grön: 1 av 4, alltså %s %%.' % t(AA_AA)),
            skriv('En ärtplanta som är Aa korsas med en som är aa. Hur många procent av avkomman '
                  'väntas bli gröna? Svara i procent.',
                  t(AA_aa),
                  'Den ena föräldern ger alltid a, den andra A eller a lika ofta. Hälften blir aa, '
                  'alltså %s %%.' % t(AA_aa)),
            sant('Starka muskler som du har tränat upp ärvs av dina barn.', False,
                 'Det du tränar upp ändrar inte DNA:t i dina könsceller. Bara det som står i generna '
                 'kan ärvas.'),
        ], beskrivning='DNA, gener och kromosomer, och att räkna på dominanta och recessiva anlag.'),

        niva('no-ak9-genetik-2', 'Evolution', 'Genetik och evolution', [
            val('Vad menas med naturligt urval?',
                ['De som passar miljön bäst får flest ungar',
                 'Människor väljer ut vilka djur som ska få ungar',
                 'Alla individer får lika många ungar',
                 'Djuren väljer själva vilka egenskaper de vill ha'],
                'De som passar miljön bäst får flest ungar',
                'Naturen väljer: den som klarar sig bäst för sina gener vidare, och egenskapen blir '
                'vanligare.'),
            sant('En giraff som sträcker på halsen hela livet får ungar med längre hals.', False,
                 'Det man gör under livet ärvs inte. Giraffer med gener för lång hals klarade sig '
                 'bättre och fick fler ungar.'),
            val('Varifrån kommer nya ärftliga egenskaper från början?',
                ['Från mutationer i DNA', 'Från träning', 'Från maten', 'Från att djuren vill det'],
                'Från mutationer i DNA',
                'Mutationer ger nya varianter av gener. Det naturliga urvalet avgör sedan vilka som '
                'blir vanliga.'),
            val('Vad är ett fossil?',
                ['Spår av liv från länge sedan, bevarade i berget',
                 'En sten som av en slump råkar se ut som ett djur', 'Ett djur som lever djupt nere i grottor',
                 'En mycket gammal levande växt'],
                'Spår av liv från länge sedan, bevarade i berget',
                'Fossil visar hur livet sett ut förr och hur arter har förändrats.'),
            skriv('Vad hette den brittiske forskaren som 1859 gav ut boken Om arternas uppkomst? '
                  'Efternamnet räcker.',
                  ['Darwin', 'Charles Darwin'],
                  'Charles Darwin beskrev hur arter förändras genom naturligt urval.'),
            val('Bakterier som tål antibiotika blir vanligare när antibiotika används mycket. Varför?',
                ['De tåliga överlever och förökar sig',
                 'Bakterierna lär sig att tåla medicinen', 'Medicinen gör bakterierna större',
                 'Människorna blir tåliga mot medicinen'],
                'De tåliga överlever och förökar sig',
                'Det är naturligt urval som händer snabbt. De andra bakterierna dör, och de tåliga '
                'tar över.'),
            ordna('Ordna stegen i det naturliga urvalet.',
                  ['Individerna i en art skiljer sig åt', 'Några egenskaper passar miljön bättre',
                   'De individerna får fler ungar', 'Egenskapen blir vanligare i arten'],
                  forklaring='Utan skillnader finns inget att välja mellan. Den som passar bäst får '
                             'flest ungar, och deras gener blir vanligare.'),
            sant('Människan och schimpansen har gemensamma förfäder.', True,
                 'Människan och schimpansen har utvecklats från samma förfäder. Vi härstammar inte '
                 'från schimpanser, vi är släkt.'),
        ], beskrivning='Naturligt urval, mutationer, fossil och hur arter förändras.'),

        niva('no-ak9-elektromagnetism-1', 'Elektromagnetism', 'Elektromagnetism och energiförsörjning', [
            sant('Det bildas ett magnetfält runt en ledning när det går ström i den.', True,
                 'Ström ger alltid ett magnetfält. Det är så en elektromagnet fungerar.'),
            val('Vad händer när du för in en magnet i en spole som är kopplad till en mätare?',
                ['Det induceras en spänning i spolen', 'Magneten förlorar sin magnetism',
                 'Spolen blir magnetisk för alltid', 'Ingenting'],
                'Det induceras en spänning i spolen',
                'När magnetfältet i spolen ändras bildas en spänning. Det kallas induktion.'),
            sant('En magnet som ligger helt stilla i en spole ger ström hela tiden.', False,
                 'Det krävs en förändring. Står magneten still ändras inte fältet, och ingen '
                 'spänning induceras.'),
            para('Para ihop maskinen med vad den gör.',
                 [('Generator', 'Gör rörelseenergi till elektrisk energi'),
                  ('Elmotor', 'Gör elektrisk energi till rörelseenergi'),
                  ('Transformator', 'Ändrar växelspänningens storlek')],
                 'Generatorn och motorn är samma idé åt olika håll. Transformatorn höjer eller '
                 'sänker spänningen.'),
            val('Hur kan en generator ge högre spänning?',
                ['Den snurras fortare', 'Den snurras långsammare', 'Magneten tas bort',
                 'Spolen får färre varv'],
                'Den snurras fortare',
                'Ju snabbare magnetfältet ändras, desto större spänning induceras.'),
            skriv('En transformator har %s varv på primärspolen och %s varv på sekundärspolen. Den '
                  'kopplas till %s V. Hur många volt blir det på sekundärsidan? Svara i volt.'
                  % (t(PRIM_VARV), t(SEK_VARV), t(PRIM_U)),
                  t(SEK_U),
                  'Spänningen följer varvtalen: %s · %s / %s = %s V.'
                  % (t(PRIM_U), t(SEK_VARV), t(PRIM_VARV), t(SEK_U))),
            val('Varför fungerar en transformator bara med växelström?',
                ['Bara ett fält som ändras inducerar spänning',
                 'Likström är för svag', 'Likström kan inte gå genom en spole av koppar',
                 'Växelström har alltid högre spänning'],
                'Bara ett fält som ändras inducerar spänning',
                'Växelströmmen byter riktning hela tiden, så fältet ändras. Likström ger ett fält '
                'som står still.'),
            skriv('En vattenkokare kopplas till %s V och strömmen är %s A. Vilken effekt har den? '
                  'Svara i watt (W).' % (t(KOKARE_U), t(KOKARE_I)),
                  t(KOKARE_P),
                  'P = U · I = %s · %s = %s W.' % (t(KOKARE_U), t(KOKARE_I), t(KOKARE_P))),
        ], beskrivning='Induktion, generatorn, elmotorn och transformatorn.'),

        niva('no-ak9-elektromagnetism-2', 'Energiförsörjning', 'Elektromagnetism och energiförsörjning', [
            val('Vilken av de här energikällorna är förnybar?',
                ['Vindkraft', 'Kol', 'Naturgas', 'Olja'], 'Vindkraft',
                'Vinden tar inte slut. Kol, olja och naturgas tog miljontals år att bildas.'),
            sant('Uran, som används i kärnkraftverk, är en förnybar energikälla.', False,
                 'Uran bryts ur berget och tar slut. Men kärnkraften släpper inte ut koldioxid när '
                 'den körs.'),
            ordna('Ordna energins väg i ett vattenkraftverk.',
                  ['Lägesenergi i vattnet i dammen', 'Rörelseenergi när vattnet forsar ner',
                   'Turbinen snurrar', 'Generatorn ger elektrisk energi'],
                  forklaring='Vattnet högt upp har lägesenergi. Den blir rörelseenergi, snurrar '
                             'turbinen, och generatorn gör om rörelsen till el.'),
            val('Varför ökar växthuseffekten när fossila bränslen eldas?',
                ['Lagrat kol släpps ut som koldioxid',
                 'De ger ifrån sig mycket ozon', 'De gör luften kallare och fuktigare', 'De innehåller radioaktiva ämnen'],
                'Lagrat kol släpps ut som koldioxid',
                'Koldioxiden håller kvar värme i atmosfären. Fossilt kol ökar mängden som finns i '
                'kretsloppet.'),
            skriv('En vattenkokare på %s kW är på i %s minuter. Hur många kWh använder den? '
                  'Svara i kWh.' % (t(KOK9_KW), t(KOK9_MIN)),
                  t(KOK9_KWH),
                  '%s minuter är %s timmar. E = P · t = %s · %s = %s kWh.'
                  % (t(KOK9_MIN), t(KOK9_MIN / 60), t(KOK9_KW), t(KOK9_MIN / 60), t(KOK9_KWH))),
            skriv('Ett kraftverk får %s MJ energi ur bränslet och ger %s MJ elektrisk energi. Hur '
                  'stor är verkningsgraden? Svara i procent.' % (t(KRAFT_IN), t(KRAFT_EL)),
                  t(KRAFT_VG),
                  '%s / %s = %s, alltså %s %%. Resten blir värme.'
                  % (t(KRAFT_EL), t(KRAFT_IN), t(KRAFT_EL / KRAFT_IN), t(KRAFT_VG))),
            val('Vilken energiomvandling sker i en solcell?',
                ['Strålningsenergi blir elektrisk energi', 'Värme blir kemisk energi',
                 'Elektrisk energi blir ljus', 'Lägesenergi blir elektrisk energi'],
                'Strålningsenergi blir elektrisk energi',
                'Solcellen gör om solljuset direkt till el, utan turbin och generator.'),
            val('Varför räcker det inte att bara bygga sol- och vindkraft?',
                ['De ger bara el när det är sol eller blåser',
                 'De släpper ut mycket koldioxid när de körs', 'Solen och vinden tar slut efter några år',
                 'De ger för hög spänning till elnätet'],
                'De ger bara el när det är sol eller blåser',
                'Elen måste finnas när den behövs. Därför behövs också kraft som går att styra, '
                'eller sätt att lagra energin.'),
        ], beskrivning='Förnybara och icke förnybara energikällor, kraftverk och verkningsgrad.'),

        niva('no-ak9-organisk-1', 'Kolväten', 'Organisk kemi', [
            val('Vad är ett kolväte?',
                ['Ett ämne som bara består av kol och väte', 'Kol som har lösts upp i vatten',
                 'Ett ämne som består av kol, väte och syre', 'En blandning av kolpulver och vatten'],
                'Ett ämne som bara består av kol och väte',
                'Namnet säger det: kol och väte. Bensin och naturgas är kolväten.'),
            skriv('Hur många bindningar bildar en kolatom? Svara med ett tal.', tal(4),
                  'Kol bildar fyra bindningar. Därför kan kolatomer bygga långa kedjor och ringar.'),
            skriv('Alkanerna har formeln CₙH₂ₙ₊₂. Hexan har %d kolatomer. Hur många väteatomer har '
                  'den?' % HEXAN_C,
                  tal(HEXAN_H),
                  '2 · %d + 2 = %d. Hexan är %s.' % (HEXAN_C, HEXAN_H, alkan(HEXAN_C))),
            para('Para ihop alkanen med dess formel.',
                 [(namn, alkan(n)) for namn, n in ALKANER],
                 'Met-, et-, prop- och but- betyder 1, 2, 3 och 4 kolatomer, och väteatomerna är '
                 'dubbelt så många plus två.'),
            val('Vad skiljer en alken från en alkan?',
                ['Alkenen har en dubbelbindning', 'Alkenen innehåller också syre',
                 'Alkenen har bara enkelbindningar', 'Alkenen har inget väte'],
                'Alkenen har en dubbelbindning',
                'Alkaner har bara enkelbindningar. Eten, C₂H₄, är den enklaste alkenen.'),
            val('Vilka ämnen bildas när ett kolväte brinner med gott om syre?',
                ['Koldioxid och vatten', 'Kol och väte', 'Syre och väte', 'Kolmonoxid och syre'],
                'Koldioxid och vatten',
                'Kolet blir koldioxid och vätet blir vatten när de reagerar med syret.'),
            ordna('Ordna alkanerna efter antal kolatomer, från minst.',
                  ['Metan', 'Etan', 'Propan', 'Butan', 'Pentan'],
                  forklaring='Metan 1, etan 2, propan 3, butan 4 och pentan 5 kolatomer.'),
            sant('Naturgas består mest av metan.', True,
                 'Naturgas är till största delen metan, CH₄, den enklaste alkanen.'),
        ], beskrivning='Kolväten, alkaner och alkener, formlerna och förbränning.'),

        niva('no-ak9-organisk-2', 'Alkoholer, syror och estrar', 'Organisk kemi', [
            val('Vilken grupp har alla alkoholer?',
                ['En OH-grupp', 'En COOH-grupp', 'En dubbelbindning', 'En NH₂-grupp'], 'En OH-grupp',
                'Alkoholer har en OH-grupp, en hydroxigrupp. Karboxylsyror har COOH.'),
            val('Vilken alkohol finns i öl och vin?',
                ['Etanol', 'Metanol', 'Glykol', 'Glycerol'], 'Etanol',
                'Etanol bildas när jäst jäser socker.'),
            sant('Metanol är giftigt att dricka, även i små mängder.', True,
                 'Metanol kan ge blindhet och död. Den liknar etanol men är mycket farligare.'),
            skriv('Vilken karboxylsyra finns i ättika? Ett ord.',
                  ['ättiksyra', 'ättiksyran', 'etansyra', 'etansyran'],
                  'Ättiksyra, eller etansyra, ger ättikan dess sura smak och lukt.'),
            val('Vad bildas när en alkohol reagerar med en karboxylsyra?',
                ['En ester och vatten', 'En alkan och syre', 'En bas och ett salt',
                 'Koldioxid och väte'],
                'En ester och vatten',
                'Alkoholen och syran sätts ihop till en ester, och en vattenmolekyl blir över.'),
            val('Vad är många estrar kända för?',
                ['De doftar och smakar frukt', 'De är starkt basiska och frätande', 'De leder ström mycket bra',
                 'De är radioaktiva'],
                'De doftar och smakar frukt',
                'Många fruktdofter och smakämnen i godis är estrar.'),
            para('Para ihop näringsämnet med vad det är byggt av.',
                 [('Stärkelse', 'Många glukosmolekyler'), ('Protein', 'Aminosyror'),
                  ('Fett', 'Glycerol och fettsyror')],
                 'Kroppen bryter ner maten till de här byggstenarna och bygger nytt av dem.'),
            val('Vad är en polymer, som plasten polyeten?',
                ['Många små molekyler i en lång kedja',
                 'En blandning av olika metaller', 'Ett grundämne som bara finns i olja', 'En stark syra som löser upp plast'],
                'Många små molekyler i en lång kedja',
                'Poly betyder många. Polyeten är tusentals etenmolekyler i en lång kedja.'),
        ], beskrivning='Alkoholer, karboxylsyror, estrar, näringsämnen och plaster.'),

        niva('no-ak9-radioaktivitet-1', 'Strålning och atomkärnan', 'Radioaktivitet', [
            para('Para ihop strålningen med vad den består av.',
                 [('Alfastrålning', 'Heliumkärnor: två protoner och två neutroner'),
                  ('Betastrålning', 'Elektroner'),
                  ('Gammastrålning', 'Elektromagnetisk strålning med mycket energi')],
                 'Alfa och beta är partiklar från kärnan. Gamma är strålning, som ljus fast med '
                 'mycket mer energi.'),
            para('Para ihop strålningen med vad som stoppar den.',
                 [('Alfa', 'Ett papper'), ('Beta', 'En tunn aluminiumplåt'),
                  ('Gamma', 'Tjockt bly eller betong')],
                 'Alfapartiklarna är stora och stoppas lätt. Gammastrålningen går längst och '
                 'dämpas först av tjocka, täta material.'),
            val('Vad är isotoper?',
                ['Atomer av samma grundämne med olika antal neutroner',
                 'Atomer av olika grundämnen med samma antal neutroner', 'Joner av samma grundämne med olika laddning',
                 'Molekyler av samma ämne'],
                'Atomer av samma grundämne med olika antal neutroner',
                'Antalet protoner avgör grundämnet. Isotoperna har samma antal protoner men olika '
                'många neutroner.'),
            skriv('Kol-14 har masstalet %d och %d protoner. Hur många neutroner har den?'
                  % (C14_MASSTAL, C14_P),
                  tal(C14_N),
                  'Masstalet är protoner plus neutroner: %d − %d = %d.'
                  % (C14_MASSTAL, C14_P, C14_N)),
            skriv('Ett radioaktivt ämne har halveringstiden %s år. Du har %s g. Hur många gram '
                  'finns kvar efter %s år? Svara i gram.' % (t(HALV_AR), t(HALV_START), t(HALV_TID)),
                  t(HALV_KVAR),
                  '%s år är %d halveringstider: %s → %s → %s → %s g.'
                  % (t(HALV_TID), int(HALV_TID / HALV_AR), t(HALV_START), t(HALV_START / 2),
                     t(HALV_START / 4), t(HALV_KVAR))),
            skriv('Ett ämne har halveringstiden %s dagar. Hur många dagar tar det tills bara en '
                  'fjärdedel finns kvar? Svara i dagar.' % t(JOD_DAGAR),
                  t(JOD_FJARDEDEL),
                  'En fjärdedel är hälften av hälften, alltså två halveringstider: 2 · %s = %s dagar.'
                  % (t(JOD_DAGAR), t(JOD_FJARDEDEL))),
            sant('Efter två halveringstider har allt radioaktivt ämne sönderfallit.', False,
                 'Efter två halveringstider är en fjärdedel kvar. Mängden halveras om och om igen.'),
            val('Vad händer i en atomkärna vid radioaktivt sönderfall?',
                ['Kärnan sänder ut strålning',
                 'Elektronerna försvinner', 'Atomen smälter av värmen', 'Kärnan blir större'],
                'Kärnan sänder ut strålning',
                'Kärnan är ostabil och sänder ut strålning. Då ändras kärnan, och ändras antalet protoner blir atomen ett annat grundämne.'),
        ], beskrivning='Alfa, beta och gamma, isotoper och att räkna med halveringstid.'),

        niva('no-ak9-radioaktivitet-2', 'Kärnkraft och strålning i samhället', 'Radioaktivitet', [
            val('Vad händer vid fission i ett kärnkraftverk?',
                ['Urankärnor klyvs', 'Lätta kärnor slås ihop',
                 'Uran brinner med syre', 'Vatten delas i väte och syre'],
                'Urankärnor klyvs',
                'Fission betyder klyvning. När urankärnan klyvs frigörs mycket energi som värme.'),
            val('Vad ger solen dess energi?',
                ['Vätekärnor slås ihop till helium', 'Urankärnor klyvs i solens inre',
                 'Kol och olja brinner med syre', 'Kemiska reaktioner med syre'],
                'Vätekärnor slås ihop till helium',
                'I solens inre är det så varmt och tätt att vätekärnor smälter ihop till helium.'),
            ordna('Ordna energins väg i ett kärnkraftverk.',
                  ['Urankärnor klyvs', 'Vatten värms till ånga', 'Ångan driver en turbin',
                   'Generatorn ger elektrisk energi'],
                  forklaring='Värmen från klyvningen kokar vatten, ångan snurrar turbinen och '
                             'generatorn gör el.'),
            sant('Vi får varje dag lite strålning från naturen, till exempel från marken och rymden.',
                 True,
                 'Det kallas bakgrundsstrålning. Den finns överallt och har alltid funnits.'),
            skriv('Vilken radioaktiv gas kan sippra in i hus från marken? Ett ord.',
                  ['radon', 'radonet', 'radongas', 'radongasen'],
                  'Radon kommer från marken och byggmaterial. Därför mäter man radon i bostäder.'),
            val('Vilken enhet används för stråldosen, alltså hur mycket skadlig strålning en människa tar upp?',
                ['sievert (Sv)', 'becquerel (Bq)', 'watt (W)', 'pascal (Pa)'], 'sievert (Sv)',
                'Sievert mäter stråldosen. Becquerel säger hur många sönderfall det sker per sekund.'),
            skriv('Kol-14 har halveringstiden ungefär %s år. I ett träföremål finns en fjärdedel av '
                  'den kol-14 som fanns när trädet levde. Ungefär hur många år gammalt är det? '
                  'Svara i år.' % tal(KOL14_HALV),
                  tal(KOL14_FJARDEDEL),
                  'En fjärdedel kvar är två halveringstider: 2 · %s = %s år.'
                  % (tal(KOL14_HALV), tal(KOL14_FJARDEDEL))),
            val('Varför är använt kärnbränsle ett problem?',
                ['Det är radioaktivt mycket länge',
                 'Det släpper ut mycket koldioxid', 'Det går inte att flytta någonstans', 'Det brinner upp av sig självt'],
                'Det är radioaktivt mycket länge',
                'Avfallet måste hållas borta från människor och natur i tusentals år.'),
        ], beskrivning='Fission och fusion, kärnkraft, radon, stråldoser och kol-14-metoden.'),
    ]),
]
