# -*- coding: utf-8 -*-
"""Företagsekonomi gy1 och gy2 (2026-10-06): två banor i ett ämne som bara
finns i NexLäx (NX.NEXLAX_AMNEN).

gy1 är grunderna: företagsformer och affärsidé, marknadsföring, kostnader och
kalkyler, resultat- och balansräkningen och bokföringen med moms. gy2 är
fördjupningen: periodisering, avskrivningar och bokslut, nyckeltal, budget,
investering och finansiering, och organisation och ledarskap. Fem områden per
bana och två nivåer per område. I gy1 står Resultat och balans före
Bokföring, för debet och kredit bygger på vad tillgångar och skulder är.

Skrivet från grunden mot ämnesplanen i företagsekonomi för gymnasieskolan.
Inget är taget ur en lärobok eller ett prov, och företagen i frågorna är
påhittade och har inga namn.

Bara det som står fast. Momsen är bara den allmänna satsen, 25 procent. De
sänkta momssatserna, arbetsgivaravgiften, skattesatserna, aktiekapitalets
storlek och prisbasbeloppet ändras med ett budgetår och står inte här.

Varje belopp och procentsats räknas här, exakt med Fraction, och prövas med
assert mot de vanligaste felräkningarna. Svaren i skriv-frågorna är rena tal:
då visar spelaren sifferknapparna, och rättningen godtar ändå en enhet efter
talet ("140 000 kr", "40 %", "4 år"). Sifferknapparna saknar minustecken, så
en förlust eller ett underskott frågas som ett val.

FÖRENKLAT, och värt en lärares blick:
- Nyckeltalen räknas olika i olika läroböcker (justerat eget kapital,
  genomsnittligt kapital, resultat före eller efter skatt). Där svaret beror
  på definitionen står den i frågan, och soliditeten räknas utan obeskattade
  reserver.
- Pålägg är handelns pålägg på inköpspriset, inte påläggskalkylens pålägg på
  material och lön.
- Avskrivningarna är bara linjära. Med ett restvärde står formeln i frågan.
- Lägsta värdets princip: nettoförsäljningsvärdet skrivs som vad varorna kan
  säljas för när kostnaderna för att sälja dem är avdragna.
- Produktens livscykel har fyra faser; en del läroböcker har en mättnadsfas
  till, och det står i förklaringen.
- Kontoklasserna följer BAS i stora drag: 1 tillgångar, 2 eget kapital och
  skulder, 3 intäkter, 4–7 kostnader. Att ingående moms står i klass 2 i BAS
  frågas inte.
- Ett banklån är en långfristig skuld när hela lånet ska betalas om flera år;
  frågorna säger när det ska betalas.
- Momsen gäller ett momsregistrerat företag som får dra av all ingående moms.
- Aktieägarna riskerar "i regel" bara det de har satt in: den som har gått i
  borgen för bolagets lån kan få betala mer, och det står i förklaringen.
- Ledarstilarna är de tre klassiska (auktoritär, demokratisk, låt gå) och
  situationsanpassat ledarskap; Maslows trappa har fem steg med korta namn.
"""
from fractions import Fraction as F

from grund import bana, niva, val, skriv, ordna, sant, para, tal

AMNE = 'Företagsekonomi'


def heltal(x):
    """Ett exakt tal som ska gå jämnt ut, som text: heltal(F(250000, 5)) blir
    '50 000'. Ett facit med decimaler hade varit en felräkning i frågan."""
    x = F(x)
    assert x.denominator == 1, x
    return tal(int(x))


def procent(del_, helhet):
    """Andelen i hela procent. Ingen fråga ska kräva att eleven avrundar."""
    p = F(del_) * 100 / F(helhet)
    assert p.denominator == 1, p
    return int(p)


def linjar(inkop, restvarde, ar):
    """Linjär avskrivning per år: det som ska skrivas av, lika mycket varje år."""
    return F(inkop - restvarde, ar)


# ===========================================================================
# gy1: Kostnader och kalkyler

# Totala kostnader: de fasta plus den rörliga kostnaden gånger antalet.
LAMPA_FAST, LAMPA_RORLIG, LAMPA_ANTAL = 60000, 40, 2000
LAMPA_TOTAL = LAMPA_FAST + LAMPA_RORLIG * LAMPA_ANTAL
assert LAMPA_TOTAL == 140000
assert LAMPA_TOTAL not in (LAMPA_FAST + LAMPA_RORLIG, LAMPA_RORLIG * LAMPA_ANTAL)

# Självkostnaden per styck: alla kostnader delat med antalet. Felen är att ta
# bara den rörliga eller bara den fasta delen.
STOL_ANTAL, STOL_FAST, STOL_RORLIG = 500, 100000, 300
STOL_ALLA = STOL_FAST + STOL_RORLIG * STOL_ANTAL
STOL_SJALV = F(STOL_ALLA, STOL_ANTAL)
assert STOL_ALLA == 250000 and STOL_SJALV == 500
assert STOL_SJALV not in (STOL_RORLIG, F(STOL_FAST, STOL_ANTAL))

# Den fasta kostnaden per styck vid två volymer (förklaringen).
HYRA, FA_VAROR, MANGA_VAROR = 10000, 100, 1000
assert F(HYRA, FA_VAROR) == 100 and F(HYRA, MANGA_VAROR) == 10

# Pålägget räknas på inköpspriset och marginalen på försäljningspriset.
TROJA_IN, TROJA_UT = 200, 250
TROJA_PALAGG = procent(TROJA_UT - TROJA_IN, TROJA_IN)
assert TROJA_PALAGG == 25 and procent(TROJA_UT - TROJA_IN, TROJA_UT) == 20
MOSSA_IN, MOSSA_UT = 120, 200
MOSSA_MARGINAL = procent(MOSSA_UT - MOSSA_IN, MOSSA_UT)
assert MOSSA_MARGINAL == 40 and F(MOSSA_UT - MOSSA_IN, MOSSA_IN) * 100 != 40
# Förklaringens exempel: 25 % pålägg på 80 kr ger 100 kr och 20 % marginal.
EX_IN = 80
EX_UT = EX_IN * F(125, 100)
assert EX_UT == 100 and procent(EX_UT - EX_IN, EX_UT) == 20

# Täckningsbidraget.
TB_PRIS, TB_RORLIG = 150, 90
TB_STYCK = TB_PRIS - TB_RORLIG
assert TB_STYCK == 60
MOSSOR, MOSS_PRIS, MOSS_RORLIG = 800, 120, 70
MOSS_TB = MOSSOR * (MOSS_PRIS - MOSS_RORLIG)
assert MOSS_TB == 40000 and MOSS_TB != MOSSOR * MOSS_PRIS

# Nollpunkten: de fasta kostnaderna delat med täckningsbidraget per styck.
# Felet är att dela med priset.
NP_FAST, NP_PRIS, NP_RORLIG = 90000, 200, 125
NOLLPUNKT = F(NP_FAST, NP_PRIS - NP_RORLIG)
assert NOLLPUNKT == 1200 and F(NP_FAST, NP_PRIS) != NOLLPUNKT

# Vinsten vid en viss volym.
V_FAST, V_PRIS, V_RORLIG, V_ANTAL = 40000, 100, 60, 1500
V_TB = V_ANTAL * (V_PRIS - V_RORLIG)
V_VINST = V_TB - V_FAST
assert V_TB == 60000 and V_VINST == 20000

# En extra order till ett pris under självkostnaden men över den rörliga
# kostnaden, när de fasta kostnaderna redan är betalda.
ORDER_ANTAL, ORDER_PRIS, ORDER_RORLIG, ORDER_SJALV = 100, 80, 50, 95
ORDER_OKNING = ORDER_ANTAL * (ORDER_PRIS - ORDER_RORLIG)
ORDER_FEL_SJALV = ORDER_ANTAL * (ORDER_SJALV - ORDER_PRIS)    # räknat på självkostnaden
ORDER_FEL_INTAKT = ORDER_ANTAL * ORDER_PRIS                   # hela intäkten som vinst
assert (ORDER_OKNING, ORDER_FEL_SJALV, ORDER_FEL_INTAKT) == (3000, 1500, 8000)

# ===========================================================================
# gy1: Resultat och balans

RES_INTAKT, RES_KOSTNAD = 850000, 790000
RES_VINST = RES_INTAKT - RES_KOSTNAD
assert RES_VINST == 60000
FORL_INTAKT, FORL_KOSTNAD = 400000, 430000
FORLUST = FORL_KOSTNAD - FORL_INTAKT
assert FORLUST == 30000
BUTIK_SALT, BUTIK_VAROR, BUTIK_OVRIGT = 600000, 350000, 200000
BUTIK_KOSTNAD = BUTIK_VAROR + BUTIK_OVRIGT
BUTIK_VINST = BUTIK_SALT - BUTIK_KOSTNAD
assert BUTIK_VINST == 50000
BAK_VINST, BAK_INTAKT = 40000, 520000
BAK_KOSTNAD = BAK_INTAKT - BAK_VINST
assert BAK_KOSTNAD == 480000 and BAK_KOSTNAD != BAK_INTAKT + BAK_VINST

# Balansräkningen: tillgångar = eget kapital + skulder.
BAL_TILLG, BAL_SKULD = 900000, 650000
BAL_EK = BAL_TILLG - BAL_SKULD
assert BAL_EK == 250000
BAL2_EK, BAL2_SKULD = 300000, 500000
BAL2_TILLG = BAL2_EK + BAL2_SKULD
assert BAL2_TILLG == 800000
BAL_LAN = 100000

# ===========================================================================
# gy1: Bokföring och moms

KASSA_IB, KASSA_IN, KASSA_UT = 4000, 2500, 1200
KASSA_UB = KASSA_IB + KASSA_IN - KASSA_UT
assert KASSA_UB == 5300
BOK_LAN = 50000
BOK_MASKIN = 200000

MOMS = F(25, 100)
M1_UTAN = 800
M1_MOMS = M1_UTAN * MOMS
assert M1_MOMS == 200 and M1_UTAN + M1_MOMS == 1000
M2_UTAN = 1600
M2_MED = M2_UTAN * (1 + MOMS)
assert M2_MED == 2000
# Momsen i ett pris med moms. Den vanliga felräkningen är 25 % av hela priset.
M3_MED = 500
M3_UTAN = M3_MED / (1 + MOMS)
M3_MOMS = M3_MED - M3_UTAN
assert (M3_UTAN, M3_MOMS) == (400, 100) and M3_MOMS != M3_MED * MOMS
# Momsen är en femtedel, 20 %, av ett pris med 25 % moms.
assert MOMS / (1 + MOMS) == F(1, 5)
UTG_MOMS, ING_MOMS = 50000, 32000
MOMS_ATT_BETALA = UTG_MOMS - ING_MOMS
assert MOMS_ATT_BETALA == 18000
KONTANT = 1250
KONTANT_UTAN = KONTANT / (1 + MOMS)
KONTANT_MOMS = KONTANT - KONTANT_UTAN
assert (KONTANT_UTAN, KONTANT_MOMS) == (1000, 250)

# ===========================================================================
# gy2: Redovisning och bokslut

AV1_INKOP, AV1_AR = 240000, 6
AV1 = linjar(AV1_INKOP, 0, AV1_AR)
assert AV1 == 40000
AV2_INKOP, AV2_REST, AV2_AR = 300000, 50000, 5
AV2 = linjar(AV2_INKOP, AV2_REST, AV2_AR)
# Utan restvärdet hade det blivit 60 000.
assert AV2 == 50000 and linjar(AV2_INKOP, 0, AV2_AR) == 60000
AV3_INKOP, AV3_PER_AR, AV3_AR = 180000, 30000, 4
AV3_HITTILLS = AV3_PER_AR * AV3_AR
AV3_BOKFORT = AV3_INKOP - AV3_HITTILLS
assert (AV3_HITTILLS, AV3_BOKFORT) == (120000, 60000)

# Kostnaden för sålda varor: ingående lager plus inköp minus utgående lager.
LAGER_IB, LAGER_INKOP, LAGER_UB = 40000, 200000, 50000
SALDA = LAGER_IB + LAGER_INKOP - LAGER_UB
assert SALDA == 190000
assert SALDA not in (LAGER_INKOP, LAGER_INKOP + LAGER_UB - LAGER_IB, LAGER_IB + LAGER_INKOP + LAGER_UB)

# Lägsta värdets princip. Felen: anskaffningsvärdet, medelvärdet, skillnaden.
LV_ANSKAFF, LV_NETTO = 50000, 35000
LV_VARDE = min(LV_ANSKAFF, LV_NETTO)
LV_MEDEL = F(LV_ANSKAFF + LV_NETTO, 2)
assert (LV_VARDE, LV_MEDEL, LV_ANSKAFF - LV_NETTO) == (35000, 42500, 15000)

# Rörelseresultatet kommer före räntorna.
RR_OMS, RR_KOST, RR_RANTA = 2000000, 1750000, 30000
RR_ROR = RR_OMS - RR_KOST
assert RR_ROR == 250000 and RR_ROR - RR_RANTA != RR_ROR
RF_ROR, RF_RI, RF_RK = 300000, 5000, 45000
RF_RES = RF_ROR + RF_RI - RF_RK
assert RF_RES == 260000

# ===========================================================================
# gy2: Nyckeltal

SOL1_EK, SOL1_TOT = 400000, 1000000
SOL1 = procent(SOL1_EK, SOL1_TOT)
assert SOL1 == 40
# Totalt kapital är eget kapital plus skulder; felet är att dela med skulderna.
SOL2_EK, SOL2_SKULD = 300000, 900000
SOL2_TOT = SOL2_EK + SOL2_SKULD
SOL2 = procent(SOL2_EK, SOL2_TOT)
assert SOL2_TOT == 1200000 and SOL2 == 25 and F(SOL2_EK, SOL2_SKULD) * 100 != SOL2
BL_OT, BL_KS = 600000, 400000
BL = procent(BL_OT, BL_KS)
assert BL == 150
KL1_OT, KL1_LAGER, KL1_KS = 500000, 200000, 250000
KL1 = procent(KL1_OT - KL1_LAGER, KL1_KS)
# Med lagret kvar hade det blivit 200 %.
assert KL1 == 120 and procent(KL1_OT, KL1_KS) == 200
KL2_OT, KL2_LAGER, KL2_KS = 800000, 500000, 400000
KL2 = procent(KL2_OT - KL2_LAGER, KL2_KS)
assert KL2 == 75 and procent(KL2_OT, KL2_KS) == 200

# Tre företag efter soliditet (eget kapital, totalt kapital). Det som har mest
# eget kapital i kronor har lägst soliditet. Ordningen räknas här, och tre
# olika värden ger en enda rätt ordning.
SOL_FORETAG = {'A': (400000, 2000000), 'B': (150000, 300000), 'C': (270000, 900000)}
SOL_PROCENT = {f: procent(*v) for f, v in SOL_FORETAG.items()}
SOL_ORDNING = sorted(SOL_FORETAG, key=lambda f: SOL_PROCENT[f])
assert SOL_PROCENT == {'A': 20, 'B': 50, 'C': 30} and len(set(SOL_PROCENT.values())) == 3
assert SOL_ORDNING == ['A', 'C', 'B']
assert max(SOL_FORETAG, key=lambda f: SOL_FORETAG[f][0]) == 'A'

RM_OMS, RM_ROR = 5000000, 400000
RM = procent(RM_ROR, RM_OMS)
assert RM == 8
RT_RES, RT_EK = 60000, 400000
RT = procent(RT_RES, RT_EK)
assert RT == 15

# Tre företag efter rörelsemarginal (nettoomsättning, rörelseresultat). Störst
# rörelseresultat i kronor är inte störst marginal.
RM_FORETAG = {'A': (2000000, 100000), 'B': (500000, 50000), 'C': (1000000, 80000)}
RM_PROCENT = {f: procent(r, o) for f, (o, r) in RM_FORETAG.items()}
RM_STORST = max(RM_FORETAG, key=lambda f: RM_PROCENT[f])
assert RM_PROCENT == {'A': 5, 'B': 10, 'C': 8} and RM_STORST == 'B'
assert max(RM_FORETAG, key=lambda f: RM_FORETAG[f][1]) == 'A'

RT2_VINST, RT2_LITET, RT2_STORT = 100000, 500000, 2000000
assert procent(RT2_VINST, RT2_LITET) == 20 and procent(RT2_VINST, RT2_STORT) == 5

# ===========================================================================
# gy2: Budget

LB_IB, LB_IN, LB_UT = 50000, 180000, 210000
LB_UB = LB_IB + LB_IN - LB_UT
assert LB_UB == 20000
RB_INT, RB_VAROR, RB_LON, RB_AVSKR = 1200000, 700000, 300000, 50000
RB_KOST = RB_VAROR + RB_LON + RB_AVSKR
RB_RES = RB_INT - RB_KOST
assert RB_KOST == 1050000 and RB_RES == 150000
BU_BUDGET, BU_UTFALL = 800000, 740000
BU_AVVIKELSE = BU_BUDGET - BU_UTFALL
assert BU_AVVIKELSE == 60000
BR_BUDGET, BR_INT_MER, BR_KOST_MER = 120000, 50000, 70000
BR_UTFALL = BR_BUDGET + BR_INT_MER - BR_KOST_MER
assert BR_UTFALL == 100000

# Likviditetsbudget för maj och juni. Felen: tecknet åt fel håll, startsaldot
# glömt, och bara maj.
LJ_START, MAJ_IN, MAJ_UT, JUN_IN, JUN_UT = 40000, 100000, 130000, 90000, 120000
LJ_MAJ = LJ_START + MAJ_IN - MAJ_UT
LJ_JUNI = LJ_MAJ + JUN_IN - JUN_UT
LJ_UTAN_START = MAJ_IN - MAJ_UT + JUN_IN - JUN_UT
assert (LJ_MAJ, LJ_JUNI, LJ_UTAN_START) == (10000, -20000, -60000)
LJ_RATT = 'Det saknas %s kr' % heltal(-LJ_JUNI)
LJ_ALT = [LJ_RATT, 'Det finns %s kr kvar' % heltal(-LJ_JUNI),
          'Det finns %s kr kvar' % heltal(LJ_MAJ), 'Det saknas %s kr' % heltal(-LJ_UTAN_START)]
assert len(set(LJ_ALT)) == 4

# ===========================================================================
# gy2: Investering och finansiering

PB_G, PB_A = 300000, 75000
PAYBACK = F(PB_G, PB_A)
assert PAYBACK == 4

# Nuvärdet räknas tillbaka med räntan, ett år i taget. Felet är att dra av
# tio procent av beloppet.
NV_RANTA = F(10, 100)
NV1_BELOPP = 110000
NV1 = F(NV1_BELOPP) / (1 + NV_RANTA)
assert NV1 == 100000 and NV1_BELOPP * (1 - NV_RANTA) != NV1
NV2_BELOPP = 72600
NV2 = F(NV2_BELOPP) / (1 + NV_RANTA) ** 2
assert (1 + NV_RANTA) ** 2 == F(121, 100)
assert NV2 == 60000 and F(NV2_BELOPP) / (1 + NV_RANTA) != NV2 and NV2_BELOPP * (1 - 2 * NV_RANTA) != NV2

# Lån med rak amortering: räntan räknas på den skuld som är kvar.
LAN_BELOPP, LAN_AR, LAN_RANTA = 200000, 5, F(5, 100)
AMORTERING = F(LAN_BELOPP, LAN_AR)
RANTA_AR1 = LAN_BELOPP * LAN_RANTA
SKULD_AR2 = LAN_BELOPP - AMORTERING
RANTA_AR2 = SKULD_AR2 * LAN_RANTA
assert (AMORTERING, RANTA_AR1, SKULD_AR2, RANTA_AR2) == (40000, 10000, 160000, 8000)


# ===========================================================================

BANOR = [
    # ================================================================== gy1
    bana(AMNE, 'gy1', [
        # -------------------------------------------- Företag och företagsformer
        niva('fek-gy1-foretagsformer-1', 'Vem står för skulderna?', 'Företag och företagsformer', [
            val('Saras enskilda firma har skulder som firman inte kan betala. Vem ansvarar för skulderna?',
                ['Sara själv, med allt hon äger', 'Bara firman, inte Sara privat',
                 'Staten, som har registrerat firman', 'Banken som har lånat ut pengarna'],
                'Sara själv, med allt hon äger',
                'En enskild firma är ingen egen juridisk person: Sara och firman är samma person. Därför '
                'svarar hon för skulderna med sina privata pengar.'),
            val('Vad betyder det att delägarna i ett handelsbolag ansvarar solidariskt för bolagets skulder?',
                ['Var och en kan få betala hela skulden', 'Var och en betalar bara sin egen andel',
                 'Bara den som skrev på lånet betalar', 'Ingen av dem behöver betala något'],
                'Var och en kan få betala hela skulden',
                'Den som har pengar att få av bolaget kan kräva vilken delägare som helst på hela beloppet. '
                'Den som har betalat kan sedan kräva de andra på deras del.'),
            val('Ett aktiebolag går i konkurs. Vad riskerar aktieägarna att förlora?',
                ['Det de har satt in i bolaget', 'Allt de äger privat, även bostaden',
                 'Sin andel av bolagets alla skulder', 'Ingenting, staten tar över förlusten'],
                'Det de har satt in i bolaget',
                'Aktiebolaget svarar själv för sina skulder. Ägarna kan förlora det de har satt in, men i regel '
                'inte mer. Har någon gått i borgen för ett lån kan hen dock få betala det.'),
            sant('Ett aktiebolag är en egen juridisk person.', True,
                 'Bolaget kan själv äga saker, skriva avtal och ha skulder, skilt från ägarna. En enskild firma '
                 'är däremot ingen egen juridisk person.'),
            skriv('Hur många ägare kan en enskild firma ha? Svara med ett tal.', tal(1),
                  'En enskild firma, eller enskild näringsidkare, ägs alltid av en enda person. Vill flera driva '
                  'företag ihop kan de starta till exempel ett handelsbolag eller ett aktiebolag.'),
            para('Para ihop företagsformen med det som stämmer om den.',
                 [('Enskild firma', 'en ägare, som står för skulderna med allt hen äger'),
                  ('Handelsbolag', 'minst två delägare, som ansvarar solidariskt'),
                  ('Aktiebolag', 'aktieägarna riskerar bara det de har satt in'),
                  ('Ekonomisk förening', 'drivs för att gynna medlemmarnas ekonomi')],
                 'Den stora skillnaden är ansvaret för skulderna. I enskild firma och handelsbolag står ägarna '
                 'själva för dem, i aktiebolag och ekonomisk förening riskerar de det de har satt in.'),
            val('Vad är syftet med en ekonomisk förening?',
                ['Att gynna medlemmarnas ekonomi', 'Att ge vinst till staten och kommunen',
                 'Att samla in pengar till välgörenhet', 'Att låta en ägare bestämma över allt'],
                'Att gynna medlemmarnas ekonomi',
                'Medlemmarna deltar i verksamheten, till exempel som kunder eller leverantörer, och föreningen '
                'ska gynna dem. Huvudregeln är en medlem, en röst.'),
            val('Lina och Omar vill starta ett företag tillsammans och inte riskera mer än de pengar de satsar. '
                'Vilken företagsform passar dem?',
                ['Aktiebolag', 'Handelsbolag', 'Enskild firma'], 'Aktiebolag',
                'I ett aktiebolag riskerar ägarna det de har satt in. I ett handelsbolag ansvarar de för alla '
                'skulder, och en enskild firma kan bara ha en ägare.'),
            ordna('Ordna delarna av ett aktiebolag så att varje del väljer eller utser den som kommer efter.',
                  ['Bolagsstämman', 'Styrelsen', 'Verkställande direktören'],
                  forklaring='Aktieägarna väljer styrelsen på bolagsstämman, och styrelsen utser den verkställande '
                             'direktören, vd, som leder det dagliga arbetet.'),
        ], beskrivning='Enskild firma, handelsbolag, aktiebolag och ekonomisk förening: vem som äger företaget '
                       'och vem som står för skulderna.'),

        niva('fek-gy1-foretagsformer-2', 'Affärsidé och SWOT', 'Företag och företagsformer', [
            para('Para ihop delen av affärsidén med frågan den svarar på.',
                 [('Behov', 'Vilket problem eller önskemål ska vi lösa?'),
                  ('Målgrupp', 'Vilka kunder vänder vi oss till?'),
                  ('Erbjudande', 'Vad säljer vi för att lösa det?')],
                 'En affärsidé säger vilket behov företaget ska fylla, hos vilka kunder och med vad. Saknas en '
                 'del är det svårt att veta vart företaget är på väg.'),
            val('Vad är en affärsplan?',
                ['En skriftlig plan för hur affärsidén ska bli verklighet',
                 'En lista över alla kunder och vad de har köpt under året',
                 'Ett avtal med banken om hur ett lån ska betalas tillbaka',
                 'En sammanställning av alla kvitton från förra året'],
                'En skriftlig plan för hur affärsidén ska bli verklighet',
                'Affärsplanen beskriver affärsidén, marknaden, konkurrenterna, marknadsföringen och ekonomin. '
                'Den hjälper ägaren att tänka igenom allt och kan visas för en bank.'),
            skriv('Vad kallas analysen av ett företags styrkor, svagheter, möjligheter och hot? Svara med ett ord.',
                  ['SWOT-analys', 'SWOT', 'SWOT-analysen', 'SWOT analys', 'swotanalys', 'en SWOT-analys'],
                  'SWOT kommer från engelskans strengths, weaknesses, opportunities och threats. Analysen ger en '
                  'bild av läget innan företaget bestämmer vad det ska göra.'),
            val('I en SWOT-analys finns inre faktorer, som finns i själva företaget, och yttre, som kommer '
                'utifrån. Vilka två är inre faktorer?',
                ['Styrkor och svagheter', 'Möjligheter och hot', 'Styrkor och möjligheter', 'Svagheter och hot'],
                'Styrkor och svagheter',
                'Styrkor och svagheter finns i företaget, och dem kan det påverka själv. Möjligheter och hot '
                'kommer från marknaden och omvärlden.'),
            val('Ett kafé har kunnig och trevlig personal. Var hör det hemma i kaféets SWOT-analys?',
                ['Styrkor', 'Svagheter', 'Möjligheter', 'Hot'], 'Styrkor',
                'Personalen finns inne i företaget och är något kaféet är bra på. Något inre som är bra är en '
                'styrka.'),
            val('En stor kafékedja ska öppna ett kafé på samma gata som ett litet kafé. Var hör det hemma i det '
                'lilla kaféets SWOT-analys?',
                ['Hot', 'Svagheter', 'Möjligheter', 'Styrkor'], 'Hot',
                'Konkurrenten kommer utifrån och kan ta kunder från kaféet. Något utifrån som kan skada företaget '
                'är ett hot.'),
            sant('Att fler vill äta vegetariskt är en möjlighet för en restaurang som har många vegetariska rätter.',
                 True,
                 'Förändringen sker utanför restaurangen, på marknaden, och den kan ge fler kunder. Något utifrån '
                 'som kan gynna företaget är en möjlighet.'),
            sant('Gamla maskiner som ofta går sönder hör till hoten i ett företags SWOT-analys.', False,
                 'Maskinerna finns i företaget, så de hör till de inre faktorerna. Något inre som fungerar dåligt '
                 'är en svaghet, inte ett hot.'),
            val('Varför vill en bank ofta se en affärsplan innan den lånar ut pengar till ett nytt företag?',
                ['För att bedöma om lånet kan betalas tillbaka', 'För att banken ska få bestämma över produkterna',
                 'För att lagen kräver att banken äger en del av företaget',
                 'För att banken ska kunna sälja idén vidare till andra'],
                'För att bedöma om lånet kan betalas tillbaka',
                'Affärsplanen visar om idén verkar hålla: vilka kunderna är, vad det kostar och vad det kan ge. '
                'Banken vill veta att lånet kan betalas tillbaka.'),
        ], beskrivning='Affärsidén, affärsplanen och SWOT-analysen: vad företaget ska göra, för vem, och hur '
                       'läget ser ut.'),

        # ------------------------------------------------------- Marknadsföring
        niva('fek-gy1-marknadsforing-1', 'De fyra P:na', 'Marknadsföring', [
            para('Para ihop P:et i marknadsmixen med vad det handlar om.',
                 [('Produkt', 'varan själv, med kvalitet, design och förpackning'),
                  ('Pris', 'vad kunden betalar och vilka rabatter som finns'),
                  ('Plats', 'var och hur kunden kan köpa varan'),
                  ('Påverkan', 'reklam och annat som når ut till kunderna')],
                 'Marknadsmixen är de fyra verktyg som företaget själv styr över. Tillsammans ska de passa den '
                 'målgrupp som företaget har valt.'),
            val('Ett företag börjar sälja sina skor i en webbutik i stället för i vanliga butiker. Vilket P i '
                'marknadsmixen ändrar företaget?',
                ['Plats', 'Pris', 'Produkt', 'Påverkan'], 'Plats',
                'Plats handlar om var och hur kunden kan köpa varan, alltså försäljningskanalen. Skorna och '
                'priset kan vara precis som förut.'),
            val('Ett glassföretag tar fram en ny smak och en ny förpackning. Vilket P i marknadsmixen handlar det om?',
                ['Produkt', 'Plats', 'Påverkan', 'Pris'], 'Produkt',
                'Smaken och förpackningen är en del av själva varan. Det kunden får när hen köper hör till '
                'produkten.'),
            sant('Personlig försäljning, när en säljare möter kunden, hör till påverkan i marknadsmixen.', True,
                 'Påverkan är allt som ska få kunden att vilja köpa: reklam, PR, erbjudanden och personlig '
                 'försäljning.'),
            val('Vad kan vara ett skäl att sätta ett lågt pris när en ny vara lanseras?',
                ['Att snabbt vinna många kunder', 'Att visa att varan är exklusiv',
                 'Att få stor vinst på varje vara', 'Att minska efterfrågan på varan'],
                'Att snabbt vinna många kunder',
                'Ett lågt pris kan locka kunder från konkurrenterna och snabbt ge en stor del av marknaden. Ett '
                'högt pris signalerar i stället att varan är exklusiv.'),
            skriv('Vad kallas det när ett företag delar in marknaden i grupper av kunder med liknande behov? '
                  'Svara med ett ord.',
                  ['segmentering', 'marknadssegmentering', 'segmenteringen', 'segmentera', 'att segmentera'],
                  'Kunderna är olika. När marknaden delas in efter till exempel ålder, bostadsort eller livsstil '
                  'kan företaget välja vilka grupper det ska satsa på.'),
            para('Para ihop sättet att segmentera med ett exempel på en kundgrupp.',
                 [('Geografisk', 'kunder som bor i Norrland'),
                  ('Demografisk', 'kunder mellan 15 och 19 år'),
                  ('Psykografisk', 'kunder som värnar om miljön'),
                  ('Efter köpbeteende', 'kunder som handlar varje vecka')],
                 'Geografisk handlar om var kunderna bor och demografisk om ålder, kön och inkomst. Psykografisk '
                 'handlar om livsstil och värderingar, och köpbeteendet om hur de handlar.'),
            val('Vad är en målgrupp?',
                ['De kunder som företaget vill nå', 'De säljare som har ett säljmål',
                 'De företag som tävlar om kunderna', 'De ägare som har satsat mest pengar'],
                'De kunder som företaget vill nå',
                'Efter segmenteringen väljer företaget en eller flera grupper att satsa på. Det är målgruppen, '
                'och marknadsmixen anpassas efter den.'),
            sant('Reklamfilmer i sociala medier hör till plats i marknadsmixen.', False,
                 'Reklam hör till påverkan, allt som ska nå ut till kunderna. Plats handlar om var kunden kan '
                 'köpa varan.'),
        ], beskrivning='Marknadsmixen med produkt, pris, plats och påverkan, och hur ett företag delar in '
                       'marknaden och väljer målgrupp.'),

        niva('fek-gy1-marknadsforing-2', 'AIDA och livscykeln', 'Marknadsföring', [
            ordna('Ordna stegen i AIDA-modellen, från första till sista.',
                  ['Uppmärksamhet', 'Intresse', 'Önskan', 'Handling'],
                  forklaring='AIDA står för attention, interest, desire och action. Reklamen ska först märkas, '
                             'sedan väcka intresse och lust att äga, och till sist få kunden att köpa.'),
            val('En reklamfilm slutar med orden ”Beställ i dag, erbjudandet gäller bara till söndag!” Vilket steg i '
                'AIDA-modellen är det?',
                ['Handling', 'Uppmärksamhet', 'Intresse', 'Önskan'], 'Handling',
                'Sista steget är att få kunden att faktiskt köpa. En tydlig uppmaning och en tidsgräns ska få '
                'kunden att handla nu och inte vänta.'),
            sant('En affisch med starka färger som får folk att stanna arbetar främst med det första steget i '
                 'AIDA-modellen.', True,
                 'Första steget är uppmärksamhet. Reklam som ingen lägger märke till kan inte väcka intresse '
                 'eller leda till köp.'),
            ordna('Ordna faserna i produktens livscykel, från första till sista.',
                  ['Introduktion', 'Tillväxt', 'Mognad', 'Nedgång'],
                  forklaring='Varan lanseras, försäljningen växer, tillväxten avtar och till sist minskar '
                             'försäljningen. En del läroböcker har också en mättnadsfas före nedgången.'),
            para('Para ihop fasen i produktens livscykel med vad som händer då.',
                 [('Introduktion', 'varan är ny och få känner till den'),
                  ('Tillväxt', 'försäljningen ökar snabbt och konkurrenter dyker upp'),
                  ('Mognad', 'tillväxten avtar och konkurrensen hårdnar'),
                  ('Nedgång', 'försäljningen minskar när kunderna väljer annat')],
                 'I början kostar marknadsföringen mycket och försäljningen är liten. När varan blivit känd växer '
                 'den, tills marknaden är mättad och kunderna börjar välja annat.'),
            val('Vad menas med positionering?',
                ['Hur kunderna ska uppfatta varan jämfört med andra',
                 'Var i butiken varan ska stå, till exempel i ögonhöjd',
                 'Hur många butiker i landet som ska sälja varan',
                 'Vilken plats varan har på listan över bästsäljare'],
                'Hur kunderna ska uppfatta varan jämfört med andra',
                'Positionering handlar om bilden kunderna har i huvudet: billigast, lyxigast eller mest hållbar. '
                'Var varan står i butiken hör till plats i marknadsmixen.'),
            val('Ett klädmärke vill att kunderna ska tänka ”hållbart och slitstarkt” när de ser märket. Vad arbetar '
                'företaget med?',
                ['Positionering', 'Segmentering', 'Prissättning', 'Marknadsundersökning'], 'Positionering',
                'Att bygga en bild av märket i kundernas huvuden, som skiljer det från konkurrenterna, är '
                'positionering. Segmentering är att dela in kunderna i grupper.'),
            val('Försäljningen av en vara minskar år för år. Vad kan företaget göra för att förlänga varans livscykel?',
                ['Förnya varan med en ny smak eller design', 'Sluta med all reklam för varan med en gång',
                 'Höja priset kraftigt så att färre vill köpa den', 'Ta bort varan ur alla butiker samtidigt'],
                'Förnya varan med en ny smak eller design',
                'En förnyad vara kan väcka intresse igen och ge livscykeln en ny tillväxt. De andra gör att varan '
                'säljer ännu mindre eller försvinner.'),
            skriv('Vad heter modellen som beskriver hur reklam leder kunden från att lägga märke till en vara till '
                  'att köpa den? Svara med modellens förkortning.',
                  ['AIDA', 'AIDA-modellen', 'AIDA-modell', 'AIDA modellen', 'AIDA modell', 'aidamodellen'],
                  'AIDA kommer från engelskans attention, interest, desire och action. Modellen används för att '
                  'planera reklam som leder kunden hela vägen till köp.'),
        ], beskrivning='AIDA-modellen, produktens livscykel från lansering till nedgång, och positionering.'),

        # ----------------------------------------------- Kostnader och kalkyler
        niva('fek-gy1-kalkyler-1', 'Fast, rörligt och självkostnad', 'Kostnader och kalkyler', [
            val('Vilken av de här kostnaderna är rörlig för ett bageri?',
                ['Mjölet i bröden', 'Hyran för lokalen', 'Försäkringen för ugnarna', 'Bagarens månadslön'],
                'Mjölet i bröden',
                'Ju fler bröd som bakas, desto mer mjöl går åt. Hyran, försäkringen och månadslönen är desamma '
                'hur mycket bageriet än bakar.'),
            sant('En fast kostnad är på kort sikt lika stor, hur mycket företaget än tillverkar.', True,
                 'Det är just det som gör den fast, som hyran för lokalen. På längre sikt kan den ändras, till '
                 'exempel om företaget behöver en större lokal.'),
            skriv('Ett företag har fasta kostnader på %s kr per år och en rörlig kostnad på %s kr per tillverkad '
                  'lampa. Hur stora blir de totala kostnaderna ett år då företaget tillverkar %s lampor? Svara i '
                  'kronor.' % (tal(LAMPA_FAST), tal(LAMPA_RORLIG), tal(LAMPA_ANTAL)),
                  heltal(LAMPA_TOTAL),
                  'De rörliga kostnaderna är %s · %s = %s kr. Med de fasta blir det %s + %s = %s kr.'
                  % (tal(LAMPA_ANTAL), tal(LAMPA_RORLIG), tal(LAMPA_RORLIG * LAMPA_ANTAL), tal(LAMPA_FAST),
                     tal(LAMPA_RORLIG * LAMPA_ANTAL), tal(LAMPA_TOTAL))),
            skriv('Ett företag tillverkar %s stolar per år. De fasta kostnaderna är %s kr och den rörliga '
                  'kostnaden är %s kr per stol. Vad är självkostnaden per stol, alltså alla kostnader delat med '
                  'antalet stolar? Svara i kronor.' % (tal(STOL_ANTAL), tal(STOL_FAST), tal(STOL_RORLIG)),
                  heltal(STOL_SJALV),
                  'Alla kostnader är %s + %s · %s = %s kr. Delat på %s stolar blir det %s kr per stol.'
                  % (tal(STOL_FAST), tal(STOL_ANTAL), tal(STOL_RORLIG), tal(STOL_ALLA), tal(STOL_ANTAL),
                     heltal(STOL_SJALV))),
            val('Vad händer med den fasta kostnaden per styck när ett företag tillverkar fler varor?',
                ['Den blir mindre', 'Den blir större', 'Den är densamma'], 'Den blir mindre',
                'Den fasta kostnaden delas på fler varor. En hyra på %s kr blir %s kr per vara vid %s varor, men '
                'bara %s kr vid %s varor.'
                % (tal(HYRA), heltal(F(HYRA, FA_VAROR)), tal(FA_VAROR), heltal(F(HYRA, MANGA_VAROR)),
                   tal(MANGA_VAROR))),
            para('Para ihop begreppet med vad det är.',
                 [('Fast kostnad', 'samma belopp hur mycket som än tillverkas'),
                  ('Rörlig kostnad', 'växer med antalet tillverkade varor'),
                  ('Självkostnad per styck', 'alla kostnader delat med antalet varor'),
                  ('Pålägg', 'det som läggs på inköpspriset')],
                 'De fasta och de rörliga kostnaderna är tillsammans alla kostnader. Delas de på antalet får man '
                 'självkostnaden per styck.'),
            skriv('En butik köper in en tröja för %s kr och säljer den för %s kr, båda utan moms. Hur många procent '
                  'är pålägget, som räknas på inköpspriset?' % (tal(TROJA_IN), tal(TROJA_UT)),
                  tal(TROJA_PALAGG),
                  'Pålägget är %s − %s = %s kr. Räknat på inköpspriset blir det %s / %s = %s, alltså %s %%.'
                  % (tal(TROJA_UT), tal(TROJA_IN), tal(TROJA_UT - TROJA_IN), tal(TROJA_UT - TROJA_IN),
                     tal(TROJA_IN), tal(float(F(TROJA_UT - TROJA_IN, TROJA_IN))), tal(TROJA_PALAGG))),
            skriv('En butik köper in en mössa för %s kr och säljer den för %s kr, båda utan moms. Hur många procent '
                  'är marginalen, som räknas på försäljningspriset?' % (tal(MOSSA_IN), tal(MOSSA_UT)),
                  tal(MOSSA_MARGINAL),
                  'Skillnaden är %s − %s = %s kr. Räknat på försäljningspriset blir det %s / %s = %s, alltså %s %%.'
                  % (tal(MOSSA_UT), tal(MOSSA_IN), tal(MOSSA_UT - MOSSA_IN), tal(MOSSA_UT - MOSSA_IN),
                     tal(MOSSA_UT), tal(float(F(MOSSA_UT - MOSSA_IN, MOSSA_UT))), tal(MOSSA_MARGINAL))),
            val('Pålägg och marginal räknas på olika belopp. Vilket stämmer?',
                ['Pålägget räknas på inköpspriset och marginalen på försäljningspriset',
                 'Pålägget räknas på försäljningspriset och marginalen på inköpspriset',
                 'Båda räknas på inköpspriset', 'Båda räknas på försäljningspriset'],
                'Pålägget räknas på inköpspriset och marginalen på försäljningspriset',
                'Därför blir pålägget i procent större än marginalen när varan säljs med vinst. 25 %% pålägg på '
                '%s kr ger priset %s kr, och då är marginalen %s %%.'
                % (tal(EX_IN), heltal(EX_UT), tal(procent(EX_UT - EX_IN, EX_UT)))),
        ], beskrivning='Fasta och rörliga kostnader, självkostnaden per styck, och skillnaden mellan pålägg och '
                       'marginal.'),

        niva('fek-gy1-kalkyler-2', 'Täckningsbidrag och nollpunkt', 'Kostnader och kalkyler', [
            val('Vad är täckningsbidraget?',
                ['Intäkterna minus de rörliga kostnaderna', 'Intäkterna minus de fasta kostnaderna',
                 'Intäkterna minus samtliga kostnader', 'Intäkterna minus alla kostnader och skatter'],
                'Intäkterna minus de rörliga kostnaderna',
                'Täckningsbidraget är det som blir kvar att täcka de fasta kostnaderna med. Det som blir över när '
                'de är täckta är vinst.'),
            skriv('En vara säljs för %s kr styck och har en rörlig kostnad på %s kr styck. Hur stort är '
                  'täckningsbidraget per styck? Svara i kronor.' % (tal(TB_PRIS), tal(TB_RORLIG)),
                  tal(TB_STYCK),
                  'Täckningsbidraget per styck är priset minus den rörliga kostnaden per styck: %s − %s = %s kr.'
                  % (tal(TB_PRIS), tal(TB_RORLIG), tal(TB_STYCK))),
            skriv('Ett företag säljer %s mössor för %s kr styck. Den rörliga kostnaden är %s kr per mössa. Hur '
                  'stort blir det totala täckningsbidraget? Svara i kronor.'
                  % (tal(MOSSOR), tal(MOSS_PRIS), tal(MOSS_RORLIG)),
                  tal(MOSS_TB),
                  'Varje mössa ger %s − %s = %s kr i täckningsbidrag. %s mössor ger %s · %s = %s kr.'
                  % (tal(MOSS_PRIS), tal(MOSS_RORLIG), tal(MOSS_PRIS - MOSS_RORLIG), tal(MOSSOR), tal(MOSSOR),
                     tal(MOSS_PRIS - MOSS_RORLIG), tal(MOSS_TB))),
            ordna('Bygg slutet på meningen: Nollpunkten i antal sålda varor är …',
                  ['de fasta kostnaderna', 'delat med', 'täckningsbidraget per styck'],
                  extra=['de rörliga kostnaderna', 'gånger'],
                  forklaring='Varje såld vara bidrar med sitt täckningsbidrag. Nollpunkten är så många bidrag som '
                             'behövs för att betala alla fasta kostnader.'),
            skriv('Ett företag har fasta kostnader på %s kr. Varje vara säljs för %s kr och har en rörlig kostnad '
                  'på %s kr. Hur många varor måste företaget sälja för att nå nollpunkten?'
                  % (tal(NP_FAST), tal(NP_PRIS), tal(NP_RORLIG)),
                  heltal(NOLLPUNKT),
                  'Täckningsbidraget per vara är %s − %s = %s kr. %s / %s = %s varor behövs för att täcka de '
                  'fasta kostnaderna.' % (tal(NP_PRIS), tal(NP_RORLIG), tal(NP_PRIS - NP_RORLIG), tal(NP_FAST),
                                         tal(NP_PRIS - NP_RORLIG), heltal(NOLLPUNKT))),
            sant('Vid nollpunkten går företaget varken med vinst eller med förlust.', True,
                 'Vid nollpunkten täcker täckningsbidraget precis de fasta kostnaderna. Varje vara som säljs '
                 'efter det ger vinst.'),
            val('De fasta kostnaderna ökar, men priset och den rörliga kostnaden per styck är desamma. Vad händer '
                'med nollpunkten?',
                ['Den blir högre', 'Den blir lägre', 'Den är densamma'], 'Den blir högre',
                'Fler kronor ska täckas, men varje vara bidrar med lika mycket som förut. Då måste fler varor '
                'säljas innan det går ihop.'),
            skriv('Ett företag har fasta kostnader på %s kr. Varje vara säljs för %s kr och har en rörlig kostnad '
                  'på %s kr. Hur stor blir vinsten om företaget säljer %s varor? Svara i kronor.'
                  % (tal(V_FAST), tal(V_PRIS), tal(V_RORLIG), tal(V_ANTAL)),
                  tal(V_VINST),
                  'Täckningsbidraget blir %s · (%s − %s) = %s kr. När de fasta kostnaderna på %s kr är betalda blir '
                  '%s kr kvar i vinst.' % (tal(V_ANTAL), tal(V_PRIS), tal(V_RORLIG), tal(V_TB), tal(V_FAST),
                                           tal(V_VINST))),
            val('Ett företag har lediga maskiner. En kund vill köpa %s extra varor för %s kr styck. Den rörliga '
                'kostnaden är %s kr styck och självkostnaden %s kr styck. Hur påverkas vinsten om företaget säger '
                'ja och de fasta kostnaderna inte ändras?'
                % (tal(ORDER_ANTAL), tal(ORDER_PRIS), tal(ORDER_RORLIG), tal(ORDER_SJALV)),
                ['Den ökar med %s kr' % tal(ORDER_OKNING), 'Den minskar med %s kr' % tal(ORDER_FEL_SJALV),
                 'Den ökar med %s kr' % tal(ORDER_FEL_INTAKT), 'Den påverkas inte alls'],
                'Den ökar med %s kr' % tal(ORDER_OKNING),
                'De fasta kostnaderna betalas redan. Varje extra vara ger %s − %s = %s kr i täckningsbidrag, så '
                'vinsten ökar med %s kr, fast priset är under självkostnaden.'
                % (tal(ORDER_PRIS), tal(ORDER_RORLIG), tal(ORDER_PRIS - ORDER_RORLIG), tal(ORDER_OKNING))),
        ], beskrivning='Täckningsbidraget, nollpunkten och vinsten: hur många varor som måste säljas för att det '
                       'ska gå ihop.'),

        # -------------------------------------------------- Resultat och balans
        niva('fek-gy1-resultat-balans-1', 'Vinst eller förlust?', 'Resultat och balans', [
            skriv('Ett företag har intäkter på %s kr och kostnader på %s kr under ett år. Hur stort är resultatet? '
                  'Svara i kronor.' % (tal(RES_INTAKT), tal(RES_KOSTNAD)),
                  tal(RES_VINST),
                  'Resultatet är intäkterna minus kostnaderna: %s − %s = %s kr. Det är positivt, alltså en vinst.'
                  % (tal(RES_INTAKT), tal(RES_KOSTNAD), tal(RES_VINST))),
            val('Ett företag har intäkter på %s kr och kostnader på %s kr under ett år. Vilket är resultatet?'
                % (tal(FORL_INTAKT), tal(FORL_KOSTNAD)),
                ['En förlust på %s kr' % tal(FORLUST), 'En vinst på %s kr' % tal(FORLUST),
                 'En förlust på %s kr' % tal(FORL_KOSTNAD), 'En vinst på %s kr' % tal(FORL_INTAKT)],
                'En förlust på %s kr' % tal(FORLUST),
                'Intäkterna minus kostnaderna är %s − %s = −%s kr. Kostnaderna är större än intäkterna, och då '
                'är resultatet en förlust.' % (tal(FORL_INTAKT), tal(FORL_KOSTNAD), tal(FORLUST))),
            val('Vad visar resultaträkningen?',
                ['Intäkter och kostnader under en period', 'Tillgångar och skulder vid en viss dag',
                 'Inbetalningar och utbetalningar under en dag', 'Ägarnas privata ekonomi under ett år'],
                'Intäkter och kostnader under en period',
                'Resultaträkningen visar hur det gick under perioden, till exempel ett år: intäkterna minus '
                'kostnaderna ger vinst eller förlust.'),
            sant('Ett företag som säljer för mer pengar i år än förra året går alltid med vinst.', False,
                 'Resultatet beror på både intäkter och kostnader. Har kostnaderna vuxit mer än försäljningen kan '
                 'det bli förlust, fast företaget har sålt mer.'),
            val('Vilken av de här är en intäkt för en frisörsalong?',
                ['Pengarna för klippningarna', 'Lönen till frisörerna', 'Hyran för salongen varje månad',
                 'Inköpet av schampo och färg'],
                'Pengarna för klippningarna',
                'En intäkt är det företaget får för det det säljer, här klippningarna. Lönen, hyran och schampot '
                'är kostnader.'),
            para('Para ihop begreppet med vad det betyder.',
                 [('Intäkt', 'värdet av det företaget har sålt under perioden'),
                  ('Kostnad', 'värdet av det som har förbrukats under perioden'),
                  ('Vinst', 'intäkterna är större än kostnaderna'),
                  ('Förlust', 'kostnaderna är större än intäkterna')],
                 'Resultatet är intäkterna minus kostnaderna. Blir det positivt är det en vinst, och blir det '
                 'negativt en förlust.'),
            skriv('En butik säljer varor för %s kr under ett år. Varorna har kostat butiken %s kr, och övriga '
                  'kostnader är %s kr. Hur stor blir vinsten? Svara i kronor.'
                  % (tal(BUTIK_SALT), tal(BUTIK_VAROR), tal(BUTIK_OVRIGT)),
                  tal(BUTIK_VINST),
                  'Alla kostnader är %s + %s = %s kr. Vinsten blir %s − %s = %s kr.'
                  % (tal(BUTIK_VAROR), tal(BUTIK_OVRIGT), tal(BUTIK_KOSTNAD), tal(BUTIK_SALT), tal(BUTIK_KOSTNAD),
                     tal(BUTIK_VINST))),
            skriv('Ett företag gick med %s kr i vinst ett år då intäkterna var %s kr. Hur stora var kostnaderna? '
                  'Svara i kronor.' % (tal(BAK_VINST), tal(BAK_INTAKT)),
                  tal(BAK_KOSTNAD),
                  'Intäkterna minus kostnaderna är vinsten. Kostnaderna är alltså intäkterna minus vinsten: '
                  '%s − %s = %s kr.' % (tal(BAK_INTAKT), tal(BAK_VINST), tal(BAK_KOSTNAD))),
            sant('Pengar som ägaren sätter in i sitt företag är en intäkt för företaget.', False,
                 'Insättningen ökar det egna kapitalet, men den är ingen betalning för något som företaget har '
                 'sålt. Därför påverkar den inte resultatet.'),
        ], beskrivning='Resultaträkningen: intäkter, kostnader och om företaget går med vinst eller förlust.'),

        niva('fek-gy1-resultat-balans-2', 'Balansräkningen', 'Resultat och balans', [
            sant('I balansräkningen är tillgångarna alltid lika stora som eget kapital och skulder tillsammans.', True,
                 'Allt företaget äger är betalt antingen med ägarnas pengar eller med lånade pengar. Därför väger '
                 'de två sidorna alltid jämnt.'),
            skriv('Ett företag har tillgångar på %s kr och skulder på %s kr. Hur stort är det egna kapitalet? Svara '
                  'i kronor.' % (tal(BAL_TILLG), tal(BAL_SKULD)),
                  tal(BAL_EK),
                  'Tillgångar = eget kapital + skulder. Det egna kapitalet är alltså %s − %s = %s kr.'
                  % (tal(BAL_TILLG), tal(BAL_SKULD), tal(BAL_EK))),
            skriv('Ett företag har ett eget kapital på %s kr och skulder på %s kr. Hur stora är tillgångarna? Svara '
                  'i kronor.' % (tal(BAL2_EK), tal(BAL2_SKULD)),
                  tal(BAL2_TILLG),
                  'Tillgångarna är lika stora som eget kapital och skulder tillsammans: %s + %s = %s kr.'
                  % (tal(BAL2_EK), tal(BAL2_SKULD), tal(BAL2_TILLG))),
            val('Vad är en anläggningstillgång?',
                ['En tillgång som ska användas i flera år', 'En tillgång som ska säljas till kunderna snart',
                 'En skuld som ska betalas av inom ett år', 'En tillgång som ägaren har hemma privat'],
                'En tillgång som ska användas i flera år',
                'Anläggningstillgångar, som maskiner, bilar och byggnader, ska användas länge i verksamheten. '
                'Varor som ska säljas snart är omsättningstillgångar.'),
            para('Para ihop posten med var den står i balansräkningen.',
                 [('En maskin i fabriken', 'anläggningstillgång'),
                  ('Varulagret', 'omsättningstillgång'),
                  ('Ett banklån som ska betalas om tio år', 'långfristig skuld'),
                  ('En obetald faktura från en leverantör', 'kortfristig skuld'),
                  ('Pengar som ägarna har satt in', 'eget kapital')],
                 'Tillgångarna delas efter hur länge de stannar i företaget. Skulderna delas efter när de ska '
                 'betalas: inom ett år är kortfristigt, senare är långfristigt.'),
            val('Vilken av de här är en omsättningstillgång?',
                ['Pengarna på bankkontot', 'Lastbilen som kör ut varorna', 'Fastigheten där butiken finns',
                 'Banklånet som köpte lastbilen'],
                'Pengarna på bankkontot',
                'Pengar, kundfordringar och varulager är omsättningstillgångar: de används och byts ut snabbt i '
                'verksamheten. Lastbilen och fastigheten ska användas i många år.'),
            val('Ett företag tar ett banklån på %s kr och sätter in pengarna på bankkontot. Vad händer i '
                'balansräkningen?' % tal(BAL_LAN),
                ['Tillgångarna och skulderna ökar lika mycket', 'Tillgångarna och det egna kapitalet ökar lika mycket',
                 'Skulderna ökar och tillgångarna minskar', 'Ingenting, eftersom pengarna är lånade'],
                'Tillgångarna och skulderna ökar lika mycket',
                'Pengarna på banken ökar tillgångarna med %s kr, och lånet ökar skulderna lika mycket. Det egna '
                'kapitalet ändras inte.' % tal(BAL_LAN)),
            sant('Balansräkningen visar hur det gick för företaget under hela året.', False,
                 'Balansräkningen är en ögonblicksbild av en viss dag, till exempel den 31 december. Hur det gick '
                 'under året visar resultaträkningen.'),
            sant('En vinst som stannar kvar i företaget ökar det egna kapitalet.', True,
                 'Det egna kapitalet är ägarnas del av företaget. En vinst som varken delas ut eller tas ut läggs '
                 'till det, och då växer det.'),
        ], beskrivning='Balansräkningen: tillgångar, eget kapital och skulder, och varför de två sidorna alltid '
                       'är lika stora.'),

        # ------------------------------------------------------------ Bokföring
        niva('fek-gy1-bokforing-1', 'Debet och kredit', 'Bokföring', [
            skriv('Vad kallas underlaget, till exempel ett kvitto eller en faktura, som ska finnas för varje '
                  'affärshändelse? Svara med ett ord.',
                  ['verifikation', 'verifikationen', 'verifikationer', 'en verifikation', 'verifikat'],
                  'Utan verifikation, ingen bokföring. Verifikationen visar vad som hände, när det hände och hur '
                  'mycket det gällde, så att bokföringen går att kontrollera.'),
            sant('I dubbel bokföring bokförs varje affärshändelse på minst två konton.', True,
                 'Varje affärshändelse påverkar minst två saker. Köper företaget en vara kontant kommer varan in '
                 'och pengarna går ut, och båda bokförs.'),
            sant('Ett företag som går med vinst kan bokföra mer i debet än i kredit.', False,
                 'Debet och kredit ska alltid vara lika stora för varje affärshändelse, med vinst eller förlust. '
                 'Annars har något blivit fel i bokföringen.'),
            para('Para ihop kontoklassen med vad den innehåller.',
                 [('Kontoklass 1', 'tillgångar'), ('Kontoklass 2', 'eget kapital och skulder'),
                  ('Kontoklass 3', 'intäkter från försäljningen'), ('Kontoklass 4–7', 'kostnader')],
                 'I kontoplanen som de flesta svenska företag använder, BAS, visar första siffran i kontonumret '
                 'vad det är för konto. Konton som börjar på 8 gäller bland annat räntor.'),
            val('Ett företag tar ett banklån på %s kr, och pengarna sätts in på bankkontot. Hur bokförs det?'
                % tal(BOK_LAN),
                ['Bank i debet och banklån i kredit', 'Bank i kredit och banklån i debet',
                 'Bank och banklån båda i debet', 'Bank och banklån båda i kredit'],
                'Bank i debet och banklån i kredit',
                'Bankkontot är en tillgång som ökar, och tillgångar ökar i debet. Lånet är en skuld som ökar, och '
                'skulder ökar i kredit.'),
            val('Ett företag köper en maskin för %s kr och betalar från bankkontot. Hur bokförs köpet, om du '
                'bortser från momsen?' % tal(BOK_MASKIN),
                ['Maskiner i debet och bank i kredit', 'Bank i debet och maskiner i kredit',
                 'Maskiner och bank båda i debet', 'Maskiner och bank båda i kredit'],
                'Maskiner i debet och bank i kredit',
                'Maskinen är en tillgång som ökar, alltså debet. Bankkontot är en tillgång som minskar, och då '
                'blir det kredit.'),
            val('På vilken sida av kontot bokförs en kostnad?', ['I debet', 'I kredit'], 'I debet',
                'Kostnader bokförs i debet, på samma sida som tillgångar ökar. Intäkter, skulder och eget kapital '
                'ökar i kredit.'),
            sant('En försäljning bokförs som en intäkt i debet.', False,
                 'Intäkter bokförs i kredit. Pengarna som kommer in bokförs i debet på kassan eller banken, så att '
                 'debet och kredit blir lika stora.'),
            skriv('Kassan har %s kr när dagen börjar. Under dagen kommer %s kr in och %s kr går ut. Hur mycket '
                  'finns i kassan när dagen är slut? Svara i kronor.'
                  % (tal(KASSA_IB), tal(KASSA_IN), tal(KASSA_UT)),
                  tal(KASSA_UB),
                  'Det som kommer in bokförs i debet och det som går ut i kredit. Saldot blir %s + %s − %s = %s kr.'
                  % (tal(KASSA_IB), tal(KASSA_IN), tal(KASSA_UT), tal(KASSA_UB))),
        ], beskrivning='Verifikationer, dubbel bokföring, kontoklasserna och vilken sida av kontot som ökar.'),

        niva('fek-gy1-bokforing-2', 'Momsen', 'Bokföring', [
            skriv('En vara kostar %s kr utan moms. Hur mycket moms ska läggas på, när momsen är 25 procent? Svara '
                  'i kronor.' % tal(M1_UTAN),
                  heltal(M1_MOMS),
                  'Momsen räknas på priset utan moms: 25 %% av %s kr är 0,25 · %s = %s kr. Med moms kostar varan '
                  '%s kr.' % (tal(M1_UTAN), tal(M1_UTAN), heltal(M1_MOMS), heltal(M1_UTAN + M1_MOMS))),
            skriv('En vara kostar %s kr utan moms. Vad kostar den med 25 procent moms? Svara i kronor.'
                  % tal(M2_UTAN),
                  heltal(M2_MED),
                  'Priset med moms är 125 %% av priset utan moms: 1,25 · %s = %s kr.' % (tal(M2_UTAN), heltal(M2_MED))),
            skriv('En vara kostar %s kr med 25 procent moms inräknad. Hur mycket av priset är moms? Svara i kronor.'
                  % tal(M3_MED),
                  heltal(M3_MOMS),
                  'Priset utan moms är %s / 1,25 = %s kr, och momsen är %s − %s = %s kr. Att ta 25 %% av %s kr blir '
                  'fel, för momsen räknas på priset utan moms.'
                  % (tal(M3_MED), heltal(M3_UTAN), tal(M3_MED), heltal(M3_UTAN), heltal(M3_MOMS), tal(M3_MED))),
            val('Varför är momsen 20 procent av ett pris som har 25 procent moms inräknad?',
                ['För att 25 är en femtedel av 125', 'För att staten ger 5 procent rabatt',
                 'För att säljaren behåller 5 procent', 'För att momsen sänks när priset är högt'],
                'För att 25 är en femtedel av 125',
                'Priset utan moms är 100 %, och med moms 125 %. Momsen är 25 av de 125, och 25 / 125 = 0,2, '
                'alltså 20 % av priset med moms.'),
            para('Para ihop begreppet med vad det är.',
                 [('Utgående moms', 'moms som företaget tar ut av sina kunder'),
                  ('Ingående moms', 'moms som företaget betalar på sina inköp'),
                  ('Moms att betala', 'utgående moms minus ingående moms')],
                 'Företaget tar ut moms åt staten när det säljer och får dra av momsen på det det köper. '
                 'Skillnaden betalas till Skatteverket.'),
            skriv('Under en period har ett företag %s kr i utgående moms och %s kr i ingående moms. Hur mycket moms '
                  'ska företaget betala till Skatteverket? Svara i kronor.' % (tal(UTG_MOMS), tal(ING_MOMS)),
                  tal(MOMS_ATT_BETALA),
                  'Företaget betalar skillnaden mellan den moms det har tagit ut och den moms det har betalat: '
                  '%s − %s = %s kr.' % (tal(UTG_MOMS), tal(ING_MOMS), tal(MOMS_ATT_BETALA))),
            sant('Är den ingående momsen större än den utgående får företaget tillbaka skillnaden.', True,
                 'Det kan hända när företaget har köpt mycket men sålt lite under perioden. Då har det betalat mer '
                 'moms än det har tagit ut.'),
            sant('Momsen som ett företag tar ut av sina kunder är en intäkt för företaget.', False,
                 'Den utgående momsen tillhör staten, och företaget tar bara in den åt staten. Därför bokförs den '
                 'som en skuld och inte som en intäkt.'),
            val('Ett företag säljer varor kontant för %s kr med 25 procent moms inräknad. Hur bokförs försäljningen?'
                % tal(KONTANT),
                ['Kassa %s i debet, försäljning %s och utgående moms %s i kredit'
                 % (tal(KONTANT), heltal(KONTANT_UTAN), heltal(KONTANT_MOMS)),
                 'Kassa %s i kredit, försäljning %s och utgående moms %s i debet'
                 % (tal(KONTANT), heltal(KONTANT_UTAN), heltal(KONTANT_MOMS)),
                 'Kassa %s i debet och försäljning %s i kredit' % (heltal(KONTANT_UTAN), heltal(KONTANT_UTAN)),
                 'Kassa %s i debet och försäljning %s i kredit' % (tal(KONTANT), tal(KONTANT))],
                'Kassa %s i debet, försäljning %s och utgående moms %s i kredit'
                % (tal(KONTANT), heltal(KONTANT_UTAN), heltal(KONTANT_MOMS)),
                'Kassan ökar med hela beloppet, alltså debet. Av det är %s kr försäljning och %s kr moms som ska '
                'betalas till staten, båda i kredit.' % (heltal(KONTANT_UTAN), heltal(KONTANT_MOMS))),
        ], beskrivning='Moms med den allmänna skattesatsen 25 procent: utgående och ingående moms, vad som ska '
                       'betalas och hur en försäljning bokförs.'),
    ]),

    # ================================================================== gy2
    bana(AMNE, 'gy2', [
        # --------------------------------------------- Redovisning och bokslut
        niva('fek-gy2-bokslut-1', 'Rätt kostnad på rätt år', 'Redovisning och bokslut', [
            val('Vad betyder periodisering i redovisningen?',
                ['Att intäkter och kostnader förs till den period de hör till',
                 'Att varje betalning bokförs den dag pengarna kommer in eller går ut',
                 'Att året delas upp i fyra perioder med lika stora intäkter',
                 'Att skulderna betalas av i jämna delar varje period'],
                'Att intäkter och kostnader förs till den period de hör till',
                'Ett års resultat ska visa årets intäkter och kostnader, oavsett när pengarna betalas. Annars blir '
                'resultatet för högt ett år och för lågt ett annat.'),
            val('I december betalar ett företag hyran för januari nästa år. Vilket år är hyran en kostnad?',
                ['Nästa år, för hyran gäller januari', 'I år, för hyran betalades i december',
                 'Hälften i år och hälften nästa år', 'Det år då företaget flyttar ut'],
                'Nästa år, för hyran gäller januari',
                'Hyran gäller januari, så den är en kostnad nästa år. I bokslutet står den som en förutbetald '
                'kostnad, en tillgång, tills januari kommer.'),
            sant('Elräkningen för december kommer först i januari. Elen är ändå en kostnad för det år som slutade i '
                 'december.', True,
                 'Elen förbrukades i december. Därför bokförs den som en upplupen kostnad, en skuld, i bokslutet, '
                 'fast fakturan kommer senare.'),
            para('Para ihop begreppet med exemplet.',
                 [('Utgift', 'företaget köper en maskin på kredit'),
                  ('Utbetalning', 'företaget betalar fakturan för maskinen'),
                  ('Kostnad', 'maskinen slits och skrivs av under året')],
                 'Utgiften uppstår när maskinen köps, utbetalningen när pengarna lämnar företaget och kostnaden när '
                 'maskinen förbrukas, år för år.'),
            val('Vad är en avskrivning?',
                ['Att inköpet av en maskin fördelas som kostnad på flera år',
                 'Att en skuld stryks för att den aldrig kommer att betalas',
                 'Att en maskin säljs innan den har blivit helt utsliten',
                 'Att en kund får rabatt för att varan var skadad'],
                'Att inköpet av en maskin fördelas som kostnad på flera år',
                'En maskin gör nytta i många år. Därför delas inköpspriset upp i en kostnad per år, i stället för '
                'att allt blir en kostnad året den köps.'),
            skriv('En maskin köps för %s kr. Den ska användas i %s år och är sedan inte värd något. Hur stor blir '
                  'avskrivningen per år med linjär avskrivning? Svara i kronor.' % (tal(AV1_INKOP), tal(AV1_AR)),
                  heltal(AV1),
                  'Med linjär avskrivning blir det lika mycket varje år: %s / %s = %s kr per år.'
                  % (tal(AV1_INKOP), tal(AV1_AR), heltal(AV1))),
            skriv('En bil köps för %s kr. Den ska användas i %s år och kan sedan säljas för %s kr. Avskrivningen per '
                  'år är inköpspriset minus restvärdet, delat med antalet år. Hur stor blir avskrivningen per år? '
                  'Svara i kronor.' % (tal(AV2_INKOP), tal(AV2_AR), tal(AV2_REST)),
                  heltal(AV2),
                  'Det som ska skrivas av är %s − %s = %s kr. Fördelat på %s år blir det %s kr per år.'
                  % (tal(AV2_INKOP), tal(AV2_REST), tal(AV2_INKOP - AV2_REST), tal(AV2_AR), heltal(AV2))),
            skriv('En maskin köptes för %s kr och skrivs av med %s kr per år. Vad är maskinens bokförda värde efter '
                  '%s år? Svara i kronor.' % (tal(AV3_INKOP), tal(AV3_PER_AR), tal(AV3_AR)),
                  tal(AV3_BOKFORT),
                  'Efter %s år har maskinen skrivits av med %s · %s = %s kr. Det bokförda värdet är %s − %s = %s kr.'
                  % (tal(AV3_AR), tal(AV3_AR), tal(AV3_PER_AR), tal(AV3_HITTILLS), tal(AV3_INKOP),
                     tal(AV3_HITTILLS), tal(AV3_BOKFORT))),
            sant('En avskrivning gör att pengar går ut från företagets bankkonto.', False,
                 'Pengarna gick ut när maskinen köptes. Avskrivningen är en kostnad i bokföringen som fördelar '
                 'inköpet på åren, men ingen betalning.'),
        ], beskrivning='Periodisering, utgift och kostnad, och linjära avskrivningar på maskiner och bilar.'),

        niva('fek-gy2-bokslut-2', 'Lagret och bokslutet', 'Redovisning och bokslut', [
            skriv('En butik hade ett varulager värt %s kr när året började. Under året köpte den varor för %s kr, '
                  'och när året slutade var lagret värt %s kr. Hur stor var kostnaden för sålda varor? Svara i '
                  'kronor.' % (tal(LAGER_IB), tal(LAGER_INKOP), tal(LAGER_UB)),
                  tal(SALDA),
                  'Ingående lager plus inköp minus utgående lager: %s + %s − %s = %s kr. Varorna som ligger kvar i '
                  'lagret har inte sålts än.' % (tal(LAGER_IB), tal(LAGER_INKOP), tal(LAGER_UB), tal(SALDA))),
            val('Varulagret är större när året slutar än när det började. Hur stor är då kostnaden för sålda varor '
                'jämfört med årets inköp?',
                ['Mindre än inköpen', 'Större än inköpen', 'Lika stor som inköpen'], 'Mindre än inköpen',
                'En del av det som köptes in ligger kvar i lagret. Det är ingen kostnad i år, utan en tillgång som '
                'blir en kostnad när varorna säljs.'),
            val('Vad gör ett företag vid en inventering?',
                ['Räknar och värderar varorna i lagret', 'Räknar alla kunder som har handlat under året',
                 'Räknar ut hur mycket moms som ska betalas', 'Räknar hur många anställda som behövs'],
                'Räknar och värderar varorna i lagret',
                'Vid bokslutet måste företaget veta vad lagret är värt. Varorna räknas och värderas, så att lagret '
                'står rätt i balansräkningen och kostnaden blir rätt.'),
            val('Varor i lagret köptes in för %s kr. Vid bokslutet kan de bara säljas för %s kr, när kostnaderna '
                'för att sälja dem är avdragna. Till vilket värde ska varorna tas upp i balansräkningen?'
                % (tal(LV_ANSKAFF), tal(LV_NETTO)),
                ['%s kr' % tal(LV_VARDE), '%s kr' % tal(LV_ANSKAFF), '%s kr' % heltal(LV_MEDEL),
                 '%s kr' % tal(LV_ANSKAFF - LV_NETTO)],
                '%s kr' % tal(LV_VARDE),
                'Enligt lägsta värdets princip tas lagret upp till det lägsta av anskaffningsvärdet och '
                'nettoförsäljningsvärdet. Lagret ska inte visa ett värde som inte finns.'),
            ordna('Ordna raderna i resultaträkningen, uppifrån och ner.',
                  ['Nettoomsättning', 'Rörelseresultat', 'Resultat efter finansiella poster', 'Årets resultat'],
                  forklaring='Försäljningen minus rörelsens kostnader ger rörelseresultatet. Sedan kommer räntorna, '
                             'och sist dras bland annat skatten av.'),
            skriv('Ett företag har en nettoomsättning på %s kr. Rörelsens kostnader, avskrivningarna inräknade, är '
                  '%s kr, och räntekostnaderna är %s kr. Hur stort är rörelseresultatet? Svara i kronor.'
                  % (tal(RR_OMS), tal(RR_KOST), tal(RR_RANTA)),
                  tal(RR_ROR),
                  'Rörelseresultatet är nettoomsättningen minus rörelsens kostnader: %s − %s = %s kr. Räntorna '
                  'kommer först efter rörelseresultatet.' % (tal(RR_OMS), tal(RR_KOST), tal(RR_ROR))),
            skriv('Ett företag har ett rörelseresultat på %s kr, ränteintäkter på %s kr och räntekostnader på %s kr. '
                  'Hur stort är resultatet efter finansiella poster? Svara i kronor.'
                  % (tal(RF_ROR), tal(RF_RI), tal(RF_RK)),
                  tal(RF_RES),
                  'De finansiella posterna är räntorna: %s + %s − %s = %s kr.'
                  % (tal(RF_ROR), tal(RF_RI), tal(RF_RK), tal(RF_RES))),
            val('Var hamnar årets vinst i balansräkningen efter bokslutet, om den stannar kvar i företaget?',
                ['I det egna kapitalet', 'Bland tillgångarna', 'Bland de kortfristiga skulderna',
                 'Den syns inte i balansräkningen'],
                'I det egna kapitalet',
                'Årets resultat förs till det egna kapitalet. En vinst som stannar kvar gör att det egna '
                'kapitalet växer.'),
            sant('Avskrivningarna står bara i resultaträkningen och påverkar inte balansräkningen.', False,
                 'Avskrivningen är en kostnad i resultaträkningen, och samtidigt minskar maskinens bokförda värde i '
                 'balansräkningen med lika mycket.'),
        ], beskrivning='Varulagret och kostnaden för sålda varor, och resultaträkningen och balansräkningen efter '
                       'bokslutet.'),

        # ------------------------------------------------------------ Nyckeltal
        niva('fek-gy2-nyckeltal-1', 'Soliditet och likviditet', 'Nyckeltal', [
            val('Vad visar soliditeten?',
                ['Hur stor del av tillgångarna som är betalda med eget kapital',
                 'Hur stor del av försäljningen som blir vinst efter alla kostnader',
                 'Om företaget kan betala sina kortfristiga skulder i tid',
                 'Hur många år det tar innan en investering har betalat sig'],
                'Hur stor del av tillgångarna som är betalda med eget kapital',
                'Soliditeten är det egna kapitalet delat med det totala kapitalet. Med hög soliditet tål företaget '
                'förluster bättre, för skulderna är små i förhållande till tillgångarna.'),
            skriv('Soliditeten räknas som eget kapital delat med totalt kapital. Ett företag har ett eget kapital på '
                  '%s kr och ett totalt kapital på %s kr. Vad är soliditeten? Svara i procent.'
                  % (tal(SOL1_EK), tal(SOL1_TOT)),
                  tal(SOL1),
                  '%s / %s = %s, alltså %s %%. Fyra tiondelar av tillgångarna är betalda med ägarnas pengar.'
                  % (tal(SOL1_EK), tal(SOL1_TOT), tal(float(F(SOL1_EK, SOL1_TOT))), tal(SOL1))),
            skriv('Soliditeten räknas som eget kapital delat med totalt kapital, och det totala kapitalet är eget '
                  'kapital plus skulder. Ett företag har ett eget kapital på %s kr och skulder på %s kr. Vad är '
                  'soliditeten? Svara i procent.' % (tal(SOL2_EK), tal(SOL2_SKULD)),
                  tal(SOL2),
                  'Det totala kapitalet är %s + %s = %s kr. Soliditeten är %s / %s = %s, alltså %s %%.'
                  % (tal(SOL2_EK), tal(SOL2_SKULD), tal(SOL2_TOT), tal(SOL2_EK), tal(SOL2_TOT),
                     tal(float(F(SOL2_EK, SOL2_TOT))), tal(SOL2))),
            val('Ett företag med soliditeten 40 procent tar ett stort banklån och sätter in pengarna på bankkontot. '
                'Vad händer med soliditeten?',
                ['Den sjunker', 'Den stiger', 'Den är densamma'], 'Den sjunker',
                'Det egna kapitalet är detsamma, men det totala kapitalet växer med lånet. Då blir andelen eget '
                'kapital mindre.'),
            ordna('Soliditeten räknas som eget kapital delat med totalt kapital. Företag A har ett eget kapital på '
                  '%s kr och ett totalt kapital på %s kr. B har %s kr och %s kr, och C har %s kr och %s kr. Ordna '
                  'företagen från lägst till högst soliditet.'
                  % (tal(SOL_FORETAG['A'][0]), tal(SOL_FORETAG['A'][1]), tal(SOL_FORETAG['B'][0]),
                     tal(SOL_FORETAG['B'][1]), tal(SOL_FORETAG['C'][0]), tal(SOL_FORETAG['C'][1])),
                  ['Företag %s' % f for f in SOL_ORDNING],
                  forklaring='A har %s %%, C %s %% och B %s %%. A har mest eget kapital i kronor, men också mest '
                             'skulder, så andelen eget kapital är minst.'
                             % (SOL_PROCENT['A'], SOL_PROCENT['C'], SOL_PROCENT['B'])),
            skriv('Balanslikviditeten räknas som omsättningstillgångar delat med kortfristiga skulder. Ett företag '
                  'har omsättningstillgångar på %s kr och kortfristiga skulder på %s kr. Vad är balanslikviditeten? '
                  'Svara i procent.' % (tal(BL_OT), tal(BL_KS)),
                  tal(BL),
                  '%s / %s = %s, alltså %s %%. Omsättningstillgångarna är en och en halv gånger så stora som de '
                  'kortfristiga skulderna.' % (tal(BL_OT), tal(BL_KS), tal(float(F(BL_OT, BL_KS))), tal(BL))),
            skriv('Kassalikviditeten räknas som omsättningstillgångar minus varulager, delat med kortfristiga '
                  'skulder. Ett företag har omsättningstillgångar på %s kr, varav ett varulager på %s kr, och '
                  'kortfristiga skulder på %s kr. Vad är kassalikviditeten? Svara i procent.'
                  % (tal(KL1_OT), tal(KL1_LAGER), tal(KL1_KS)),
                  tal(KL1),
                  'Utan lagret är omsättningstillgångarna %s − %s = %s kr. %s / %s = %s, alltså %s %%.'
                  % (tal(KL1_OT), tal(KL1_LAGER), tal(KL1_OT - KL1_LAGER), tal(KL1_OT - KL1_LAGER), tal(KL1_KS),
                     tal(float(F(KL1_OT - KL1_LAGER, KL1_KS))), tal(KL1))),
            val('Varför räknas varulagret bort i kassalikviditeten?',
                ['Varorna måste säljas innan de blir pengar', 'Varulagret är en skuld och inte en tillgång',
                 'Varulagret räknas redan in i det egna kapitalet', 'Varorna är aldrig värda något när året är slut'],
                'Varorna måste säljas innan de blir pengar',
                'Kassalikviditeten visar om företaget kan betala sina kortfristiga skulder snabbt. Varor måste '
                'först säljas, och det kan ta tid.'),
            sant('En kassalikviditet under 100 procent betyder att omsättningstillgångarna utan varulagret är mindre '
                 'än de kortfristiga skulderna.', True,
                 'Under 100 % räcker de mest lättillgängliga tillgångarna inte till alla kortfristiga skulder. Ska '
                 'allt betalas på en gång kan företaget få svårt.'),
        ], beskrivning='Soliditet, balanslikviditet och kassalikviditet: hur stabilt ett företag är och om det kan '
                       'betala sina skulder.'),

        niva('fek-gy2-nyckeltal-2', 'Marginal och räntabilitet', 'Nyckeltal', [
            skriv('Rörelsemarginalen räknas som rörelseresultat delat med nettoomsättning. Ett företag har en '
                  'nettoomsättning på %s kr och ett rörelseresultat på %s kr. Vad är rörelsemarginalen? Svara i '
                  'procent.' % (tal(RM_OMS), tal(RM_ROR)),
                  tal(RM),
                  '%s / %s = %s, alltså %s %%. Av varje hundralapp som företaget säljer för blir %s kr kvar som '
                  'rörelseresultat.' % (tal(RM_ROR), tal(RM_OMS), tal(float(F(RM_ROR, RM_OMS))), tal(RM), tal(RM))),
            val('Ett företag har rörelsemarginalen 10 procent. Vad betyder det?',
                ['Av varje 100 kr i försäljning blir 10 kr rörelseresultat',
                 'Av varje 100 kr i försäljning går 10 kr till moms och skatt',
                 'Försäljningen har ökat med 10 procent sedan förra året',
                 'Det egna kapitalet är 10 procent av allt kapital'],
                'Av varje 100 kr i försäljning blir 10 kr rörelseresultat',
                'Rörelsemarginalen visar hur mycket som blir kvar av försäljningen när rörelsens kostnader är '
                'betalda, före räntor och skatt.'),
            val('Rörelsemarginalen räknas som rörelseresultat delat med nettoomsättning. Företag A har en '
                'nettoomsättning på %s kr och ett rörelseresultat på %s kr. B har %s kr och %s kr, och C har %s kr '
                'och %s kr. Vilket företag har störst rörelsemarginal?'
                % (tal(RM_FORETAG['A'][0]), tal(RM_FORETAG['A'][1]), tal(RM_FORETAG['B'][0]),
                   tal(RM_FORETAG['B'][1]), tal(RM_FORETAG['C'][0]), tal(RM_FORETAG['C'][1])),
                ['Företag %s' % f for f in 'BAC'], 'Företag %s' % RM_STORST,
                'A har %s %%, B %s %% och C %s %%. B har minst rörelseresultat i kronor men behåller mest av varje '
                'krona som det säljer för.' % (RM_PROCENT['A'], RM_PROCENT['B'], RM_PROCENT['C'])),
            skriv('Räntabiliteten på eget kapital räknas här som årets resultat delat med eget kapital. Ett företag '
                  'har ett resultat på %s kr och ett eget kapital på %s kr. Vad är räntabiliteten? Svara i procent.'
                  % (tal(RT_RES), tal(RT_EK)),
                  tal(RT),
                  '%s / %s = %s, alltså %s %%. Räntabiliteten kan räknas på flera sätt, och därför står det i '
                  'frågan hur den räknas här.' % (tal(RT_RES), tal(RT_EK), tal(float(F(RT_RES, RT_EK))), tal(RT))),
            val('Två företag går med samma vinst, %s kr. Det ena har ett eget kapital på %s kr och det andra på %s '
                'kr. Vilket har högst räntabilitet på eget kapital, räknad som vinsten delat med eget kapital?'
                % (tal(RT2_VINST), tal(RT2_LITET), tal(RT2_STORT)),
                ['Det med %s kr i eget kapital' % tal(RT2_LITET), 'Det med %s kr i eget kapital' % tal(RT2_STORT),
                 'De har lika hög räntabilitet'],
                'Det med %s kr i eget kapital' % tal(RT2_LITET),
                'Samma vinst på mindre kapital ger högre räntabilitet: %s / %s = %s %%, mot %s %% för det andra '
                'företaget.' % (tal(RT2_VINST), tal(RT2_LITET), procent(RT2_VINST, RT2_LITET),
                                procent(RT2_VINST, RT2_STORT))),
            para('Para ihop nyckeltalet med vad det främst mäter.',
                 [('Soliditet', 'den långsiktiga betalningsförmågan'),
                  ('Kassalikviditet', 'den kortsiktiga betalningsförmågan'),
                  ('Räntabilitet', 'lönsamheten')],
                 'Soliditeten visar hur väl företaget klarar sig på lång sikt, likviditeten om det kan betala sina '
                 'räkningar nu och räntabiliteten hur lönsamt det är.'),
            sant('Ett företag med hög soliditet kan ändå få svårt att betala räkningar som ska betalas nästa vecka.',
                 True,
                 'Soliditeten mäter den långsiktiga stabiliteten. Är pengarna bundna i maskiner och lager kan '
                 'kassan ändå ta slut, och det visar likviditeten.'),
            skriv('Kassalikviditeten räknas som omsättningstillgångar minus varulager, delat med kortfristiga '
                  'skulder. Ett företag har omsättningstillgångar på %s kr, varav ett varulager på %s kr, och '
                  'kortfristiga skulder på %s kr. Vad är kassalikviditeten? Svara i procent.'
                  % (tal(KL2_OT), tal(KL2_LAGER), tal(KL2_KS)),
                  tal(KL2),
                  '%s − %s = %s kr utan lagret, och %s / %s = %s, alltså %s %%. Utan att sälja varor räcker pengarna '
                  'inte till alla kortfristiga skulder.'
                  % (tal(KL2_OT), tal(KL2_LAGER), tal(KL2_OT - KL2_LAGER), tal(KL2_OT - KL2_LAGER), tal(KL2_KS),
                     tal(float(F(KL2_OT - KL2_LAGER, KL2_KS))), tal(KL2))),
            val('Ett företag har soliditeten 15 procent och ett annat 55 procent. Vilket påstående stämmer?',
                ['Det andra har en större andel eget kapital', 'Det första har mer pengar på bankkontot',
                 'Det andra går med större vinst i år', 'Det första har en större andel eget kapital'],
                'Det andra har en större andel eget kapital',
                'Soliditeten är andelen eget kapital av det totala kapitalet. Den säger inget om vinsten i år '
                'eller om pengarna på banken.'),
        ], beskrivning='Rörelsemarginal och räntabilitet, och vad nyckeltalen tillsammans säger om lönsamhet och '
                       'betalningsförmåga.'),

        # --------------------------------------------------------------- Budget
        niva('fek-gy2-budget-1', 'Tre budgetar', 'Budget', [
            para('Para ihop budgeten med vad den visar.',
                 [('Resultatbudget', 'om företaget väntas gå med vinst'),
                  ('Likviditetsbudget', 'om pengarna räcker till betalningarna'),
                  ('Budgeterad balansräkning', 'tillgångar och skulder när perioden slutar')],
                 'Resultatbudgeten handlar om intäkter och kostnader och likviditetsbudgeten om in- och '
                 'utbetalningar. Ett företag kan gå med vinst och ändå få slut på pengar.'),
            val('Ett företag säljer varor i december, och kunden betalar i januari. Var syns försäljningen?',
                ['I resultatbudgeten i december och i likviditetsbudgeten i januari',
                 'I resultatbudgeten i januari och i likviditetsbudgeten i december',
                 'I båda budgetarna i december', 'I båda budgetarna i januari'],
                'I resultatbudgeten i december och i likviditetsbudgeten i januari',
                'Intäkten hör till december, då varan såldes. Pengarna kommer in i januari, och det är då '
                'likviditetsbudgeten räknar med dem.'),
            sant('Avskrivningarna står med i likviditetsbudgeten.', False,
                 'En avskrivning är en kostnad i resultatbudgeten, men inga pengar går ut när den görs. Därför '
                 'står den inte i likviditetsbudgeten.'),
            val('Ett företag tar ett banklån på 200 000 kr. Hur påverkar det budgetarna?',
                ['En inbetalning i likviditetsbudgeten, men ingen intäkt i resultatbudgeten',
                 'En intäkt i resultatbudgeten, men ingen inbetalning i likviditetsbudgeten',
                 'En intäkt i resultatbudgeten och en inbetalning i likviditetsbudgeten',
                 'Lånet påverkar ingen av budgetarna'],
                'En inbetalning i likviditetsbudgeten, men ingen intäkt i resultatbudgeten',
                'Pengarna kommer in, men ett lån är ingen intäkt: det ska betalas tillbaka. Räntan på lånet blir '
                'sedan en kostnad.'),
            sant('Amorteringen på ett lån är en kostnad i resultatbudgeten.', False,
                 'Amorteringen är en avbetalning: pengar går ut, men skulden minskar lika mycket. Det är räntan som '
                 'är kostnaden för lånet.'),
            skriv('Ett företag har %s kr på banken den 1 mars. Under mars väntas inbetalningar på %s kr och '
                  'utbetalningar på %s kr. Hur mycket finns på banken den 31 mars enligt likviditetsbudgeten? Svara '
                  'i kronor.' % (tal(LB_IB), tal(LB_IN), tal(LB_UT)),
                  tal(LB_UB),
                  'Ingående saldo plus inbetalningar minus utbetalningar: %s + %s − %s = %s kr.'
                  % (tal(LB_IB), tal(LB_IN), tal(LB_UT), tal(LB_UB))),
            skriv('En resultatbudget har intäkter på %s kr, varukostnader på %s kr, lönekostnader på %s kr och '
                  'avskrivningar på %s kr. Vilket resultat är budgeterat? Svara i kronor.'
                  % (tal(RB_INT), tal(RB_VAROR), tal(RB_LON), tal(RB_AVSKR)),
                  tal(RB_RES),
                  'Alla kostnader är %s + %s + %s = %s kr. Resultatet blir %s − %s = %s kr.'
                  % (tal(RB_VAROR), tal(RB_LON), tal(RB_AVSKR), tal(RB_KOST), tal(RB_INT), tal(RB_KOST),
                     tal(RB_RES))),
            val('Varför görs försäljningsbudgeten ofta först?',
                ['Den styr hur mycket som ska köpas in och tillverkas',
                 'Den är den enda budget som lagen kräver av alla företag',
                 'Den är alltid lättast att förutse helt exakt',
                 'Den påverkar inte någon av de andra budgetarna'],
                'Den styr hur mycket som ska köpas in och tillverkas',
                'Hur mycket som säljs avgör inköpen, tillverkningen, personalen och betalningarna. Därför bygger '
                'de andra budgetarna på försäljningsbudgeten.'),
            val('Ett företag går med vinst i resultatbudgeten, men likviditetsbudgeten visar att pengarna tar slut '
                'i april. Vad kan vara orsaken?',
                ['Kunderna betalar långt efter att de har köpt', 'Företaget har höga avskrivningar på maskinerna',
                 'Företaget får ränta på sina pengar på banken', 'Företaget väntar längre med att betala leverantörerna'],
                'Kunderna betalar långt efter att de har köpt',
                'Försäljningen blir en intäkt direkt, men pengarna kommer först när kunderna betalar. Under tiden '
                'ska löner, hyra och leverantörer betalas.'),
        ], beskrivning='Resultatbudget, likviditetsbudget och budgeterad balansräkning: vad de visar och varför de '
                       'kan säga olika saker.'),

        niva('fek-gy2-budget-2', 'Följ upp budgeten', 'Budget', [
            val('Vad är budgetuppföljning?',
                ['Att jämföra utfallet med det som budgeterades', 'Att skriva en ny budget när något oväntat händer',
                 'Att skicka in budgeten till Skatteverket efter året', 'Att räkna ut hur mycket skatt som ska betalas'],
                'Att jämföra utfallet med det som budgeterades',
                'Utfallet är det som verkligen hände. När det jämförs med budgeten ser företaget var det gick '
                'bättre eller sämre än planerat och kan ändra i tid.'),
            skriv('Ett företag budgeterade försäljningen till %s kr, men utfallet blev %s kr. Hur många kronor lägre '
                  'än budgeten blev försäljningen?' % (tal(BU_BUDGET), tal(BU_UTFALL)),
                  tal(BU_AVVIKELSE),
                  'Avvikelsen är skillnaden mellan budgeten och utfallet: %s − %s = %s kr. Resultatet blir sämre än '
                  'planerat om inte kostnaderna också har blivit lägre.'
                  % (tal(BU_BUDGET), tal(BU_UTFALL), tal(BU_AVVIKELSE))),
            val('Kostnaden för material blev 30 000 kr lägre än budgeterat. Hur påverkar just den avvikelsen '
                'resultatet jämfört med budgeten?',
                ['Resultatet blir bättre än budgeterat', 'Resultatet blir sämre än budgeterat',
                 'Resultatet blir precis som budgeterat'],
                'Resultatet blir bättre än budgeterat',
                'Lägre kostnader ger ett bättre resultat. Men det är bra att ta reda på varför: kanske såldes '
                'färre varor, och då behövdes mindre material.'),
            skriv('Ett företag budgeterade ett resultat på %s kr. Intäkterna blev %s kr högre än budgeterat och '
                  'kostnaderna %s kr högre. Vilket resultat blev utfallet? Svara i kronor.'
                  % (tal(BR_BUDGET), tal(BR_INT_MER), tal(BR_KOST_MER)),
                  tal(BR_UTFALL),
                  'De högre intäkterna ger %s kr mer, men de högre kostnaderna tar %s kr. %s + %s − %s = %s kr.'
                  % (tal(BR_INT_MER), tal(BR_KOST_MER), tal(BR_BUDGET), tal(BR_INT_MER), tal(BR_KOST_MER),
                     tal(BR_UTFALL))),
            sant('Blir försäljningen högre än budgeterat blir resultatet alltid bättre än budgeterat.', False,
                 'Resultatet beror också på kostnaderna. Har de ökat mer än försäljningen kan resultatet bli sämre, '
                 'fast försäljningen gick bra.'),
            val('Ett kafé sålde fler bullar än budgeterat, och kostnaden för mjöl, smör och socker blev högre än '
                'budgeterat. Vad är den rimligaste förklaringen till kostnaden?',
                ['Fler bullar krävde mer råvaror', 'Hyran för lokalen höjdes mitt i året',
                 'Kaféet köpte en ny ugn under året', 'Personalen fick högre lön än planerat'],
                'Fler bullar krävde mer råvaror',
                'Råvarorna är en rörlig kostnad. Säljer kaféet fler bullar går det åt mer, så en högre kostnad för '
                'dem är väntad och behöver inte betyda slöseri.'),
            val('Ett företag har %s kr på banken den 1 maj. I maj väntas inbetalningar på %s kr och utbetalningar på '
                '%s kr. I juni väntas inbetalningar på %s kr och utbetalningar på %s kr. Hur ser det ut den 30 juni?'
                % (tal(LJ_START), tal(MAJ_IN), tal(MAJ_UT), tal(JUN_IN), tal(JUN_UT)),
                LJ_ALT, LJ_RATT,
                'I maj: %s + %s − %s = %s kr. I juni: %s + %s − %s = −%s kr. Företaget behöver %s kr till, till '
                'exempel genom en kredit.'
                % (tal(LJ_START), tal(MAJ_IN), tal(MAJ_UT), tal(LJ_MAJ), tal(LJ_MAJ), tal(JUN_IN), tal(JUN_UT),
                   tal(-LJ_JUNI), tal(-LJ_JUNI))),
            val('Likviditetsbudgeten visar att pengarna inte räcker i juni. Vilken åtgärd kan hjälpa?',
                ['Be kunderna betala snabbare', 'Köpa in mer varor till lagret', 'Betala leverantörerna tidigare',
                 'Amortera mer på banklånet'],
                'Be kunderna betala snabbare',
                'Kommer pengarna in tidigare räcker de längre. De andra åtgärderna gör att mer pengar går ut i '
                'förväg.'),
            ordna('Ordna stegen i budgetarbetet, från första till sista.',
                  ['Mål sätts för året', 'Budgeten görs upp', 'Utfallet jämförs med budgeten',
                   'Avvikelserna analyseras och åtgärdas'],
                  forklaring='Budgeten bygger på målen. Under året jämförs det som händer med budgeten, och stora '
                             'avvikelser leder till åtgärder och till en bättre budget nästa gång.'),
        ], beskrivning='Budgetuppföljning: jämför utfallet med budgeten, räkna ut avvikelserna och förstå vad de '
                       'beror på.'),

        # ------------------------------------------ Investering och finansiering
        niva('fek-gy2-investering-1', 'Lönar det sig?', 'Investering och finansiering', [
            val('Vad är en investering för ett företag?',
                ['Att satsa pengar nu för att tjäna mer senare', 'Att betala de löpande kostnaderna för hyra och el',
                 'Att dela ut vinsten till ägarna när året är slut', 'Att låna till lönerna när det är ont om pengar'],
                'Att satsa pengar nu för att tjäna mer senare',
                'En investering, till exempel en ny maskin, kostar pengar nu men ska ge högre intäkter eller lägre '
                'kostnader i flera år framåt.'),
            para('Para ihop begreppet med vad det är.',
                 [('Grundinvestering', 'det investeringen kostar när den görs'),
                  ('Inbetalningsöverskott', 'inbetalningar minus utbetalningar under ett år'),
                  ('Kalkylränta', 'den ränta som investeringen minst ska ge'),
                  ('Restvärde', 'vad maskinen kan säljas för när kalkyltiden är slut')],
                 'Det är byggstenarna i en investeringskalkyl. Grundinvesteringen betalas nu, och överskotten och '
                 'restvärdet kommer senare.'),
            skriv('En maskin kostar %s kr och väntas ge ett inbetalningsöverskott på %s kr per år. Hur många år är '
                  'återbetalningstiden?' % (tal(PB_G), tal(PB_A)),
                  heltal(PAYBACK),
                  'Återbetalningstiden, pay-back-tiden, är grundinvesteringen delat med det årliga överskottet: '
                  '%s / %s = %s år.' % (tal(PB_G), tal(PB_A), heltal(PAYBACK))),
            val('Vad är en svaghet med pay-back-metoden?',
                ['Den bryr sig inte om åren efter återbetalningstiden',
                 'Den är för svår att räkna ut för de flesta företag',
                 'Den kan bara användas när företaget köper en byggnad',
                 'Den räknar med att maskiner aldrig går sönder'],
                'Den bryr sig inte om åren efter återbetalningstiden',
                'Metoden mäter bara hur snabbt pengarna kommer tillbaka. Den tar inte hänsyn till räntan eller '
                'till överskott efter återbetalningstiden.'),
            val('Två maskiner kostar lika mycket. Maskin A betalar sig på 3 år och maskin B på 5 år. Vilken väljer '
                'man enligt pay-back-metoden?',
                ['Maskin A', 'Maskin B', 'Ingen av dem'], 'Maskin A',
                'Enligt pay-back-metoden är kortast återbetalningstid bäst. Pengarna kommer tillbaka snabbare, och '
                'då blir risken mindre.'),
            sant('En krona i dag är värd mer än en krona om ett år, om pengarna kan ge ränta under tiden.', True,
                 'Pengar i dag kan sättas in på banken eller investeras och växa. Det är grundtanken i '
                 'nuvärdesmetoden.'),
            skriv('Kalkylräntan är 10 procent. Vilket belopp i dag är lika mycket värt som %s kr om ett år? Svara i '
                  'kronor.' % tal(NV1_BELOPP),
                  heltal(NV1),
                  'Med 10 %% ränta växer %s kr till %s · 1,10 = %s kr på ett år. Nuvärdet är alltså %s / 1,10 = %s kr.'
                  % (heltal(NV1), heltal(NV1), tal(NV1_BELOPP), tal(NV1_BELOPP), heltal(NV1))),
            skriv('Kalkylräntan är 10 procent. Vad är nuvärdet av %s kr som kommer om två år? Svara i kronor.'
                  % tal(NV2_BELOPP),
                  heltal(NV2),
                  'Beloppet räknas tillbaka ett år i taget: %s / 1,10 / 1,10 = %s / 1,21 = %s kr.'
                  % (tal(NV2_BELOPP), tal(NV2_BELOPP), heltal(NV2))),
            val('I nuvärdesmetoden är kapitalvärdet nuvärdet av alla inbetalningsöverskott och restvärdet, minus '
                'grundinvesteringen. När är investeringen lönsam?',
                ['När kapitalvärdet är större än noll', 'När kapitalvärdet är mindre än noll',
                 'När kapitalvärdet är lika med kalkylräntan', 'När kapitalvärdet är lika med grundinvesteringen'],
                'När kapitalvärdet är större än noll',
                'Ett positivt kapitalvärde betyder att pengarna som kommer, räknade till dagens värde, är mer än '
                'investeringen kostar. Den ger mer än kalkylräntan.'),
        ], beskrivning='Investeringar: grundinvestering och inbetalningsöverskott, återbetalningstiden och tanken '
                       'bakom nuvärdesmetoden.'),

        niva('fek-gy2-investering-2', 'Pengar till företaget', 'Investering och finansiering', [
            para('Para ihop sättet att skaffa pengar med vad det innebär.',
                 [('Nyemission', 'aktiebolaget säljer nya aktier'),
                  ('Banklån', 'en skuld som betalas tillbaka med ränta'),
                  ('Självfinansiering', 'vinst som stannar kvar i företaget'),
                  ('Leasing', 'företaget hyr en maskin i stället för att köpa den')],
                 'Nyemission och självfinansiering ger eget kapital. Ett banklån är främmande kapital, och med '
                 'leasing behöver företaget inte köpa alls.'),
            val('Vad är främmande kapital?',
                ['Skulder som ska betalas tillbaka', 'Pengar som ägarna har satt in i företaget',
                 'Pengar som har kommit från utländska ägare', 'Vinst som har stannat kvar i företaget'],
                'Skulder som ska betalas tillbaka',
                'Främmande kapital är skulder, till exempel banklån och leverantörsskulder. Eget kapital är '
                'ägarnas: det de har satt in och vinster som har stannat kvar.'),
            skriv('Ett företag lånar %s kr och ska amortera lika mycket varje år i %s år. Hur stor blir amorteringen '
                  'per år? Svara i kronor.' % (tal(LAN_BELOPP), tal(LAN_AR)),
                  heltal(AMORTERING),
                  'Med rak amortering delas lånet lika på åren: %s / %s = %s kr per år. Räntan betalas utöver '
                  'amorteringen.' % (tal(LAN_BELOPP), tal(LAN_AR), heltal(AMORTERING))),
            skriv('Ett företag lånar %s kr till 5 procents ränta per år. Hur mycket ränta betalar företaget det första '
                  'året? Svara i kronor.' % tal(LAN_BELOPP),
                  heltal(RANTA_AR1),
                  '5 %% av %s kr är 0,05 · %s = %s kr. Räntan är priset för att låna pengarna.'
                  % (tal(LAN_BELOPP), tal(LAN_BELOPP), heltal(RANTA_AR1))),
            skriv('Ett lån på %s kr amorteras med %s kr per år, och räntan är 5 procent på den skuld som är kvar. '
                  'Det första året betalas %s kr i ränta. Hur mycket ränta betalas det andra året? Svara i kronor.'
                  % (tal(LAN_BELOPP), heltal(AMORTERING), heltal(RANTA_AR1)),
                  heltal(RANTA_AR2),
                  'Efter första årets amortering är skulden %s − %s = %s kr, och 5 %% av det är %s kr. Räntan '
                  'minskar när skulden minskar.'
                  % (tal(LAN_BELOPP), heltal(AMORTERING), heltal(SKULD_AR2), heltal(RANTA_AR2))),
            val('Vad är skillnaden mellan ränta och amortering?',
                ['Räntan är priset för att låna, och amorteringen minskar skulden',
                 'Räntan minskar skulden, och amorteringen är priset för att låna',
                 'Räntan betalas bara första året, och amorteringen alla år',
                 'Det är två ord för samma sak'],
                'Räntan är priset för att låna, och amorteringen minskar skulden',
                'Räntan är en kostnad för lånet. Amorteringen minskar skulden och är ingen kostnad, men pengarna '
                'går ändå ut från företaget.'),
            sant('Vid leasing äger leasingbolaget maskinen, och företaget betalar en avgift för att använda den.', True,
                 'Företaget slipper binda mycket pengar på en gång. I gengäld blir det totalt ofta dyrare än att '
                 'köpa.'),
            val('Vilken är en fördel med att leasa en maskin i stället för att köpa den kontant?',
                ['Företaget behöver inte betala hela priset på en gång',
                 'Företaget blir ägare till maskinen från första dagen',
                 'Det blir alltid billigare totalt än att köpa maskinen',
                 'Maskinen behöver aldrig lämnas tillbaka'],
                'Företaget behöver inte betala hela priset på en gång',
                'Pengarna kan användas till annat, och avgiften betalas i takt med att maskinen används. Att leasa '
                'blir inte alltid billigare.'),
            val('Vilket av de här ökar företagets egna kapital?',
                ['Att ägarna sätter in mer pengar', 'Att företaget tar ett nytt banklån',
                 'Att företaget köper varor på kredit', 'Att företaget leasar en ny bil'],
                'Att ägarna sätter in mer pengar',
                'En insättning från ägarna är eget kapital. Lånet och krediten är skulder, och leasingen är en '
                'hyra.'),
        ], beskrivning='Finansiering: eget och främmande kapital, banklån med ränta och amortering, och leasing.'),

        # ------------------------------------------- Organisation och ledarskap
        niva('fek-gy2-organisation-1', 'Vem bestämmer över vem?', 'Organisation och ledarskap', [
            para('Para ihop organisationsformen med det som kännetecknar den.',
                 [('Linjeorganisation', 'varje anställd har en chef, och order går uppifrån och ner'),
                  ('Linje-stab', 'experter ger råd till ledningen men leder ingen i linjen'),
                  ('Matrisorganisation', 'en anställd kan ha två chefer, till exempel en projektchef'),
                  ('Platt organisation', 'få nivåer mellan ledningen och de anställda')],
                 'Formerna skiljer sig i hur besluten går och vem man svarar inför. Många företag blandar dem.'),
            val('Vad är staben i en linje-stab-organisation?',
                ['Experter som ger råd men inte leder någon i linjen',
                 'Chefer som bestämmer över alla anställda i företaget',
                 'Anställda som arbetar i flera olika projekt samtidigt',
                 'Ägare som har satt in pengar i företaget'],
                'Experter som ger råd men inte leder någon i linjen',
                'Staben kan till exempel vara en jurist eller en ekonomiavdelning som stöttar ledningen. Den ger '
                'råd, men besluten fattas i linjen.'),
            val('Vad är en risk med en matrisorganisation?',
                ['Att två chefer ger olika besked till samma person',
                 'Att ingen anställd någonsin får arbeta i ett projekt',
                 'Att företaget får för få nivåer av chefer',
                 'Att ledningen inte kan anställa några specialister'],
                'Att två chefer ger olika besked till samma person',
                'I en matris har man ofta både en avdelningschef och en projektchef. Säger de olika saker kan det '
                'bli oklart vad som gäller först.'),
            sant('I en platt organisation finns det många nivåer av chefer mellan ledningen och de anställda.', False,
                 'Platt betyder få nivåer. Besluten går snabbare, och de anställda får ofta mer eget ansvar.'),
            val('Vilken är en fördel med en linjeorganisation?',
                ['Det är tydligt vem som bestämmer över vem', 'Alla anställda har två chefer att fråga om råd',
                 'Besluten går snabbt genom alla nivåerna', 'Ingen behöver ta ansvar för några beslut'],
                'Det är tydligt vem som bestämmer över vem',
                'I en linjeorganisation har alla en chef, och ansvaret är tydligt. Nackdelen är att besluten kan '
                'ta lång tid när de ska gå genom många nivåer.'),
            val('Ett företag har en chef och tio medarbetare som själva planerar sitt arbete. Vilken organisation '
                'liknar det mest?',
                ['Platt organisation', 'Matrisorganisation', 'Linje-stab-organisation',
                 'Hög organisation med många nivåer'],
                'Platt organisation',
                'Det finns bara två nivåer, chefen och medarbetarna, och medarbetarna har stort eget ansvar. Det '
                'är typiskt för en platt organisation.'),
            val('Vad menas med den informella organisationen?',
                ['Kontakterna och vänskapen som inte syns i schemat',
                 'Chefer och avdelningar så som ledningen har ritat upp dem',
                 'Hur företaget är registrerat hos Bolagsverket och Skatteverket',
                 'De anställda som arbetar på deltid eller per timme'],
                'Kontakterna och vänskapen som inte syns i schemat',
                'Den formella organisationen är den som ledningen har ritat upp. Den informella är hur det '
                'faktiskt fungerar: vem man frågar, vem som lyssnas på och vilka som håller ihop.'),
            sant('I en linje-stab-organisation får staben ge order direkt till de anställda i linjen.', False,
                 'Staben ger råd och stöd, men order går genom linjens chefer. Annars hade de anställda fått order '
                 'från två håll.'),
            skriv('Vad kallas bilden som visar ett företags avdelningar och vem som är chef över vem? Svara med ett '
                  'ord.',
                  ['organisationsschema', 'organisationsschemat', 'organisationsscheman', 'organigram',
                   'organigrammet'],
                  'Organisationsschemat visar den formella organisationen: avdelningarna, cheferna och vem som '
                  'svarar inför vem.'),
        ], beskrivning='Linjeorganisation, linje-stab, matrisorganisation och platt organisation: hur ett företag '
                       'delar upp arbetet och ansvaret.'),

        niva('fek-gy2-organisation-2', 'Ledarskap och motivation', 'Organisation och ledarskap', [
            para('Para ihop ledarstilen med hur ledaren gör.',
                 [('Auktoritär', 'bestämmer själv och talar om vad som ska göras'),
                  ('Demokratisk', 'låter gruppen vara med och fatta besluten'),
                  ('Låt gå', 'lägger sig inte i och låter gruppen sköta sig själv')],
                 'Ingen stil är bäst i alla lägen. I en kris kan det behövas en tydlig ledare, och en erfaren grupp '
                 'kan klara sig med lite styrning.'),
            val('Vad innebär situationsanpassat ledarskap?',
                ['Att ledaren anpassar stilen efter medarbetarna',
                 'Att ledaren alltid använder samma stil i alla situationer',
                 'Att ledaren bara leder när det uppstår en kris i företaget',
                 'Att medarbetarna väljer en ny ledare för varje situation'],
                'Att ledaren anpassar stilen efter medarbetarna',
                'En ny medarbetare behöver ofta tydliga instruktioner, medan en erfaren kan få mer eget ansvar. '
                'Ledaren väljer stil efter person och läge.'),
            val('En brand har brutit ut, och alla måste snabbt lämna lokalen. Vilken ledarstil passar bäst just då?',
                ['Auktoritär', 'Demokratisk', 'Låt gå'], 'Auktoritär',
                'I en nödsituation finns ingen tid för diskussion. Då behövs någon som snabbt och tydligt säger vad '
                'alla ska göra.'),
            ordna('Ordna stegen i Maslows behovstrappa, nerifrån och upp.',
                  ['Fysiologiska behov', 'Trygghet', 'Gemenskap', 'Uppskattning', 'Självförverkligande'],
                  forklaring='Enligt Maslow måste de lägre behoven vara uppfyllda innan de högre börjar styra. Den '
                             'som är hungrig tänker först på mat, inte på att utvecklas.'),
            val('Vilket steg i Maslows behovstrappa handlar om att ha en fast anställning och en säker arbetsplats?',
                ['Trygghet', 'Gemenskap', 'Uppskattning', 'Självförverkligande'], 'Trygghet',
                'Trygghetsbehovet kommer direkt efter de fysiologiska behoven. Det handlar om att känna sig säker, '
                'till exempel att få behålla jobbet och lönen.'),
            val('En anställd har bra lön och en trygg anställning men vill utvecklas och använda hela sin förmåga. '
                'Vilket behov i Maslows trappa handlar det om?',
                ['Självförverkligande', 'Trygghetsbehov', 'Fysiologiska behov', 'Behov av uppskattning'],
                'Självförverkligande',
                'Självförverkligande, att få växa och bli den man kan bli, står högst upp i trappan. Lönen och '
                'tryggheten finns redan.'),
            sant('Enligt Herzberg är lönen en hygienfaktor.', True,
                 'En för låg lön gör de anställda missnöjda, men enligt Herzberg ger en högre lön inte i sig lust '
                 'till arbetet. Det gör motivationsfaktorerna.'),
            val('Vilken av de här är en motivationsfaktor enligt Herzberg?',
                ['Erkännande för ett bra arbete', 'En högre lön än på andra jobb', 'En trevlig och säker arbetsmiljö',
                 'Tydliga regler på arbetsplatsen'],
                'Erkännande för ett bra arbete',
                'Motivationsfaktorerna finns i själva arbetet: prestation, erkännande, ansvar och möjlighet att '
                'utvecklas. Lön, arbetsmiljö och regler är hygienfaktorer.'),
            sant('Enligt Herzberg gör bra hygienfaktorer i sig de anställda motiverade.', False,
                 'Bra hygienfaktorer gör bara att ingen är missnöjd. Motivationen kommer från själva arbetet: '
                 'erkännande, ansvar och utveckling.'),
        ], beskrivning='Ledarstilar, situationsanpassat ledarskap, Maslows behovstrappa och Herzbergs hygien- och '
                       'motivationsfaktorer.'),
    ]),
]
