# -*- coding: utf-8 -*-
"""SO åk 1, åk 2 och åk 3 och NO åk 3: lågstadiets SO och NO ur Lgr22:s
centrala innehåll för årskurs 1–3 (2026-10-06).

SO åk 1: att leva tillsammans (familj, släkt, vänskap och att turas om) och
att leva i närområdet (platser och yrken, att gå och cykla säkert i
trafiken). SO åk 2: regler och varför de finns, klassrådet och att rösta,
barnens rättigheter i barnkonventionen, högtider i kristendom, judendom och
islam, och att leva förr (tidslinjen över ett liv, skolan och hemmet på
1800-talet). SO åk 3: pengar och arbete, kartan och väderstrecken,
jordgloben, världsdelarna och haven, och berättelser och symboler i
kristendom, judendom och islam. NO åk 3: djur och växter under året och
deras livscykler, kroppen och de fem sinnena, mat, sömn och rörelse, is,
vatten och ånga, material och sortering, ljus, skugga och magneter, och
jorden, månen och solen.

Frågorna är egna, skrivna för ett barn som läser med en vuxen: korta
meningar, mest val, sant och para, och skriv() bara när svaret är ett tal.
Religionernas berättelser står som berättelser ("enligt Bibeln", "enligt
islam"), och högtiderna beskrivs som de som firar dem gör, utan att
värdera.

Förenklat med flit: solen går upp "ungefär i öster", vatten kokar vid
"ungefär 100 grader", och man "brukar säga" att vi har fem sinnen.
Trafikfrågorna säger bara det som gäller alla som går och cyklar (inga
åldersgränser, för de kan ändras), och en gående ska enligt lagen "om
möjligt" gå till vänster på vägkanten; frågan säger vänster. Förr står som
"på 1800-talet" och inte som "för 150 år sedan", så att en fråga inte blir
fel med åren. Inga priser på riktiga varor, inga mynt och sedlar och inga
regler för källsortering som kommunerna kan ändra.

Räknefrågornas facit räknas ut här, och de vanligaste felräkningarna prövas
med assert mot samma tal.
"""
from grund import bana, niva, val, skriv, ordna, sant, para, tal

SO = 'SO / Historia / Samhällskunskap'
NO = 'NO / Fysik / Kemi / Biologi'

_ENTAL = ['noll', 'ett', 'två', 'tre', 'fyra', 'fem', 'sex', 'sju', 'åtta', 'nio', 'tio', 'elva',
          'tolv', 'tretton', 'fjorton', 'femton', 'sexton', 'sjutton', 'arton', 'nitton']
_TIOTAL = ['', '', 'tjugo', 'trettio', 'fyrtio', 'femtio', 'sextio', 'sjuttio', 'åttio', 'nittio']


def i_ord(n):
    """Ett heltal 0–999 med bokstäver, så som ett barn skriver det."""
    assert 0 <= n < 1000
    if n < 20:
        return _ENTAL[n]
    if n < 100:
        tiotal, ental = divmod(n, 10)
        return _TIOTAL[tiotal] + (_ENTAL[ental] if ental else '')
    hundratal, rest = divmod(n, 100)
    return (_ENTAL[hundratal] if hundratal > 1 else 'ett') + 'hundra' + (i_ord(rest) if rest else '')


assert [i_ord(n) for n in (0, 18, 24, 50, 300)] == ['noll', 'arton', 'tjugofyra', 'femtio', 'trehundra']


def svar(n, *fler):
    """Godtagna svar när svaret är ett tal: siffrorna först, för de visas
    som facit, sedan talet med bokstäver och andra stavningar."""
    return list(dict.fromkeys([tal(n), i_ord(n)] + list(fler)))


def billigast_forst(varor):
    """Brickor "namn, pris kr" i prisordning, räknad här. Två varor med
    samma pris hade gett två rätta ordningar."""
    priser = [p for _, p in varor]
    assert len(set(priser)) == len(priser), 'två varor har samma pris'
    return ['%s, %s kr' % (namn, tal(pris)) for namn, pris in sorted(varor, key=lambda v: v[1])]


# ---------------------------------------------------------------- SO åk 1

# Syskonen.
BRODER, SYSTRAR = 2, 1
SYSKON = BRODER + SYSTRAR
assert SYSKON == 3 and SYSTRAR == 1  # frågan skriver "en syster"

# Trafikljuset för bilar.
TRAFIKLJUS = ('rött', 'gult', 'grönt')

# ---------------------------------------------------------------- SO åk 2

# Omröstningen på klassrådet. Lika många röster hade inte gett någon majoritet.
ROSTER = (('Fotboll', 14), ('Brännboll', 9))
VINNARE, VINNAR_ROSTER = max(ROSTER, key=lambda r: r[1])
FORLORAR_ROSTER = min(r[1] for r in ROSTER)
assert VINNARE == 'Fotboll' and VINNAR_ROSTER != FORLORAR_ROSTER

ADVENTSSONDAGAR = ('första', 'andra', 'tredje', 'fjärde')
BARN_UNDER = 18

# Tidslinjen.
FODD, FYLLER_AR = 2019, 2029
ALDER = FYLLER_AR - FODD
assert ALDER == 10

# ---------------------------------------------------------------- SO åk 3

GLASS, BETALAR = 15, 20
VAXEL = BETALAR - GLASS
assert VAXEL == 5 and VAXEL != BETALAR + GLASS

APPLE_PRIS, APPLEN = 4, 3
APPLEN_KOSTAR = APPLE_PRIS * APPLEN
# Felräkningarna: priset plus antalet (7), och ett äpple för mycket (16).
APPLEN_FEL = (APPLE_PRIS + APPLEN, APPLE_PRIS * (APPLEN + 1))
assert APPLEN_KOSTAR == 12 and APPLEN_KOSTAR not in APPLEN_FEL and len(set(APPLEN_FEL)) == 2

BOLLEN = (60, 45)
BOLLEN_BILLIGAST, BOLLEN_DYRAST = min(BOLLEN), max(BOLLEN)
assert BOLLEN_BILLIGAST != BOLLEN_DYRAST

VAROR = (('Suddgummi', 8), ('Bok', 95), ('Fotboll', 150), ('Cykel', 2000))

SPAR_VECKA, VECKOR = 10, 5
SPARAT = SPAR_VECKA * VECKOR
assert SPARAT == 50 and SPAR_VECKA + VECKOR != SPARAT

# Kartan: 1 cm på kartan är KARTA_M_PER_CM meter i verkligheten.
KARTA_M_PER_CM, KARTA_CM = 100, 3
KARTA_M = KARTA_M_PER_CM * KARTA_CM
assert KARTA_M == 300 and KARTA_M != KARTA_M_PER_CM + KARTA_CM

# ---------------------------------------------------------------- NO åk 3

SINNEN = ('syn', 'hörsel', 'lukt', 'smak', 'känsel')
FRYSPUNKT, KOKPUNKT, KROPPSTEMP = 0, 100, 37
DYGN_TIMMAR = 24
TANDBORSTNING = ('morgon', 'kväll')


BANOR = [
    # ================================================================ SO åk 1
    bana(SO, 'ak1', [
        niva('so-ak1-familj-1', 'Familj och släkt', 'Familj och vänner', [
            sant('Alla familjer ser likadana ut.', False,
                 'Familjer ser olika ut. Det kan finnas en eller två vuxna, många syskon eller inga syskon alls.'),
            para('Para ihop släktordet med vem det är.',
                 [('Mormor', 'Mammas mamma'), ('Farfar', 'Pappas pappa'),
                  ('Moster', 'Mammas syster'), ('Farbror', 'Pappas bror')],
                 'Mor betyder mamma och far betyder pappa. Ordet säger vems släkting det är.'),
            val('Vad kallas pappas mamma?', ['Farmor', 'Mormor', 'Faster'], 'Farmor',
                'Far betyder pappa och mor betyder mamma. Pappas mamma blir far-mor.'),
            skriv('Lisa har %s bröder och en syster. Hur många syskon har Lisa?' % i_ord(BRODER),
                  svar(SYSKON),
                  'Bröder och systrar är syskon. %d bröder och %d syster är %d syskon.'
                  % (BRODER, SYSTRAR, SYSKON)),
            val('Din moster har en dotter. Vad är dottern för dig?',
                ['Din kusin', 'Din syster', 'Din faster'], 'Din kusin',
                'Barn till mammas eller pappas syskon är dina kusiner.'),
            sant('Det finns familjer där barnen har två mammor eller två pappor.', True,
                 'Familjer ser olika ut. Det viktiga är att barnen har vuxna som tar hand om dem.'),
            val('Vad är en bonusförälder?',
                ['En förälders nya partner', 'En förälders mamma eller pappa', 'En förälders bror eller syster'],
                'En förälders nya partner',
                'Om mamma eller pappa får en ny partner kan barnen kalla den vuxna bonusmamma eller bonuspappa.'),
            ordna('Ordna från yngst till äldst.', ['Barnet', 'Barnets mamma', 'Barnets mormor'],
                  forklaring='Mormor är mammas mamma, så hon är äldre än mamma. Barnet är yngst av de tre.'),
        ], beskrivning='Att familjer ser olika ut och vad släktingarna kallas.'),

        niva('so-ak1-familj-2', 'En bra kompis', 'Familj och vänner', [
            val('Två barn vill gunga, men det finns bara en gunga. Hur kan de lösa det?',
                ['De turas om', 'Den som är störst får gunga', 'Ingen av dem får gunga'], 'De turas om',
                'När de turas om får båda gunga, en i taget. Det blir rättvist för båda.'),
            val('Du ser att någon står ensam på rasten. Vad är snällt att göra?',
                ['Fråga om hen vill vara med', 'Gå därifrån och leka själv', 'Vänta tills hen frågar dig'],
                'Fråga om hen vill vara med',
                'Det är tråkigt att vara ensam. Om du frågar kan hen få vara med och leka.'),
            sant('Kompisar kan tycka olika och ändå vara vänner.', True,
                 'Det är okej att tycka olika. Bra kompisar lyssnar på varandra.'),
            para('Para ihop det som har hänt med vad du kan säga.',
                 [('Du har råkat knuffa någon', 'Förlåt!'), ('Någon har hjälpt dig', 'Tack!'),
                  ('Du vill vara med och leka', 'Får jag vara med?')],
                 'Förlåt säger du när du har gjort fel, och tack när någon har gjort något snällt för dig.'),
            val('Du och din kompis har blivit osams. Vad kan ni göra för att bli sams?',
                ['Prata om det och lyssna', 'Aldrig prata med varandra igen', 'Säga elaka saker om varandra'],
                'Prata om det och lyssna',
                'Alla kompisar blir osams ibland. Om ni pratar och lyssnar på varandra kan ni bli sams igen.'),
            sant('Man kan bara ha en kompis i taget.', False,
                 'Du kan ha många kompisar på en gång. Det blir ofta roligare när fler får vara med.'),
            val('Vad gör en bra kompis när du är ledsen?',
                ['Frågar hur du mår', 'Går och leker med andra', 'Skrattar och går därifrån'], 'Frågar hur du mår',
                'En bra kompis bryr sig om dig. Att fråga hur du mår visar att hen vill hjälpa.'),
            val('Någon har tagit din penna utan att fråga. Vad är bäst att göra?',
                ['Be att få den tillbaka', 'Ta en av hens pennor i stället', 'Gömma hens väska på rasten'],
                'Be att få den tillbaka',
                'Säg lugnt att du vill ha tillbaka pennan. Hjälper inte det kan du be en vuxen om hjälp.'),
        ], beskrivning='Vänskap: att turas om, att låta alla vara med och att bli sams igen.'),

        niva('so-ak1-platser-1', 'Platser nära dig', 'Platser och yrken', [
            para('Para ihop platsen med vad man gör där.',
                 [('Biblioteket', 'Lånar böcker'), ('Simhallen', 'Simmar'), ('Mataffären', 'Handlar mat'),
                  ('Skolan', 'Lär sig saker')],
                 'Varje plats är till för något. På biblioteket lånar man böcker och i mataffären handlar man mat.'),
            sant('Man måste betala för att låna böcker på biblioteket.', False,
                 'Det är gratis att låna böcker på biblioteket. Biblioteket betalas med skattepengar, som vi alla '
                 'är med och betalar.'),
            val('Vart går man om man är sjuk och behöver träffa en läkare?',
                ['Till vårdcentralen', 'Till brandstationen', 'Till biblioteket'], 'Till vårdcentralen',
                'På vårdcentralen arbetar läkare och sjuksköterskor. De hjälper den som är sjuk.'),
            val('Var står brandbilarna när de inte är ute?',
                ['På brandstationen', 'På polisstationen', 'På sjukhuset'], 'På brandstationen',
                'Brandbilarna står på brandstationen. Där väntar brandmännen tills det kommer ett larm.'),
            skriv('Vilket telefonnummer ringer du om det har hänt en olycka och någon behöver hjälp snabbt?',
                  '112',
                  'Numret 112 är larmnumret. Där får du hjälp att få hit ambulans, polis eller brandkår.'),
            val('Var väntar man på bussen?',
                ['Vid busshållplatsen', 'Vid övergångsstället', 'Vid brandstationen'], 'Vid busshållplatsen',
                'Bussen stannar vid busshållplatsen. Där står en skylt som visar vilka bussar som stannar.'),
            val('Var kan man titta på gamla saker från förr?',
                ['På ett museum', 'På ett apotek', 'På en bensinmack'], 'På ett museum',
                'På ett museum visas saker från förr, så att alla kan se dem och lära sig.'),
            val('Var hämtar man medicin som läkaren har skrivit ut?',
                ['På apoteket', 'På biblioteket', 'På vårdcentralen'], 'På apoteket',
                'Läkaren bestämmer vilken medicin du behöver. Medicinen hämtar man sedan på apoteket.'),
        ], beskrivning='Vad olika platser i närområdet är till för, och numret man ringer när det är bråttom.'),

        niva('so-ak1-platser-2', 'Vem jobbar med vad?', 'Platser och yrken', [
            para('Para ihop yrket med vad personen gör.',
                 [('Brandman', 'Släcker bränder'), ('Bagare', 'Bakar bröd'),
                  ('Tandläkare', 'Tar hand om tänderna'), ('Bibliotekarie', 'Hjälper dig att hitta böcker')],
                 'Alla yrken behövs. Tillsammans ser de till att vi får mat, hjälp och böcker.'),
            val('Vad kallas den som kör en buss?', ['Bussförare', 'Lokförare', 'Flygkapten'], 'Bussförare',
                'En bussförare kör buss. En lokförare kör tåg och en flygkapten flyger flygplan.'),
            val('Vem hjälper djur som är sjuka?', ['Veterinären', 'Läkaren', 'Sjuksköterskan'], 'Veterinären',
                'En veterinär är en läkare för djur. Läkaren och sjuksköterskan på vårdcentralen hjälper människor.'),
            sant('Både kvinnor och män kan arbeta som brandmän.', True,
                 'Alla yrken passar både kvinnor och män. Det som spelar roll är vad man kan och vill.'),
            val('Vem odlar på åkrarna och har kor på en gård?', ['Bonden', 'Snickaren', 'Bagaren'], 'Bonden',
                'En bonde odlar mat och tar hand om djur på sin gård.'),
            val('Vad gör en snickare?',
                ['Bygger saker av trä', 'Lagar trasiga bilar', 'Klipper håret på folk'], 'Bygger saker av trä',
                'En snickare arbetar med trä. Hen kan bygga hus, bord och hyllor.'),
            val('Vem hjälper dig att lära dig läsa och räkna i skolan?',
                ['Läraren', 'Skolkocken', 'Vaktmästaren'], 'Läraren',
                'Läraren undervisar i skolan. Kocken lagar maten och vaktmästaren tar hand om huset.'),
            ordna('Ordna hur ett bröd blir till, från början.',
                  ['Bonden odlar vete', 'Kvarnen mal vetet till mjöl', 'Bagaren bakar bröd',
                   'Affären säljer brödet'],
                  forklaring='Många yrken hjälps åt. Bonden odlar vetet, kvarnen gör mjöl, bagaren bakar och '
                             'affären säljer brödet.'),
        ], beskrivning='Yrken i närområdet och hur de hjälps åt.'),

        niva('so-ak1-trafik-1', 'Gå säkert', 'Säker i trafiken', [
            para('Para ihop vägens del med vem den är till för.',
                 [('Trottoaren', 'Den som går'), ('Cykelbanan', 'Den som cyklar'), ('Körbanan', 'Bilar och bussar')],
                 'Trottoaren är till för den som går och cykelbanan för cyklar. Bilar och bussar kör i körbanan.'),
            val('Det finns ingen trottoar, så du går vid kanten av vägen. Vilken sida ska du gå på?',
                ['Vänster sida', 'Höger sida', 'Mitt på vägen'], 'Vänster sida',
                'Går du på vänster sida möter du bilarna. Då ser du dem komma, och de ser dig.'),
            sant('Bilarna stannar alltid vid ett övergångsställe.', False,
                 'Bilarna ska stanna för dig, men alla gör inte det. Vänta tills bilen har stannat innan du går ut.'),
            val('Vad ska du göra innan du går över en gata?',
                ['Stanna, titta och lyssna', 'Spring över så fort du kan', 'Titta åt höger och gå direkt'],
                'Stanna, titta och lyssna',
                'Stanna vid kanten, titta åt båda hållen och lyssna efter bilar. Gå när det är fritt.'),
            sant('När gubben lyser grönt ska du ändå titta efter bilar innan du går.', True,
                 'En bil kan svänga in mot övergångsstället eller köra mot rött. Därför tittar du alltid först.'),
            val('Var är det bra att leka?', ['I parken', 'På gatan', 'Bland parkerade bilar'], 'I parken',
                'På gatan och bland bilarna kan förarna inte se dig i tid. Lek där inga bilar kör.'),
            sant('Det är säkrast att gå ut på gatan mellan två parkerade bilar.', False,
                 'Mellan parkerade bilar ser bilisterna dig inte förrän du är ute på gatan. Gå över där det är fri sikt.'),
            skriv('Hur många olika färger har ett vanligt trafikljus för bilar? Svara med ett tal.',
                  svar(len(TRAFIKLJUS)),
                  'Trafikljuset har rött, gult och grönt. Rött betyder stopp och grönt att bilarna får köra.'),
        ], beskrivning='Att gå säkert: trottoaren, vägkanten, övergångsstället och gubbarna.'),

        niva('so-ak1-trafik-2', 'Cykel, bil och mörker', 'Säker i trafiken', [
            val('Varför ska du ha hjälm när du cyklar?',
                ['Den skyddar huvudet om du ramlar', 'Den gör att du cyklar mycket fortare',
                 'Den gör att bilarna hör att du kommer'],
                'Den skyddar huvudet om du ramlar',
                'Om du ramlar kan huvudet slå i marken. Hjälmen tar emot smällen och skyddar hjärnan.'),
            sant('En cykel ska alltid ha broms och ringklocka.', True,
                 'Det står i lagen. Bromsen behövs för att kunna stanna, och ringklockan för att varna andra.'),
            val('Vilken färg har lyset längst bak på en cykel?', ['Rött', 'Vitt', 'Grönt'], 'Rött',
                'Lyset bak är rött och lyset fram är vitt eller gult. Då ser andra åt vilket håll du cyklar.'),
            val('Varför ska du ha reflex när det är mörkt ute?',
                ['Så att bilisterna ser dig', 'Så att du ser vägen bättre', 'Så att du håller dig varm'],
                'Så att bilisterna ser dig',
                'Reflexen lyser upp när bilens lampor träffar den. Då ser bilisten dig mycket tidigare.'),
            sant('En reflex lyser av sig själv i mörkret.', False,
                 'En reflex har inget eget ljus. Den kastar tillbaka ljuset från bilens lampor.'),
            val('Vad ska du alltid göra när du åker bil?',
                ['Ha bältet på dig', 'Sitta i en vuxens knä', 'Ha fönstret öppet'], 'Ha bältet på dig',
                'Bältet håller kvar dig på platsen om bilen bromsar hårt. Barn behöver också en bilbarnstol '
                'eller en bälteskudde.'),
            sant('I Sverige kör bilarna på höger sida av vägen.', True,
                 'Sverige har högertrafik. Därför kommer bilarna i körfältet närmast dig från vänster när du ska gå över.'),
            para('Para ihop trafiksignalen med vad den betyder.',
                 [('Röd gubbe', 'Den som går väntar'), ('Grön gubbe', 'Den som går får gå'),
                  ('Rött ljus', 'Bilarna stannar'), ('Grönt ljus', 'Bilarna får köra')],
                 'Gubbarna är till för dig som går, och de runda ljusen för bilarna. Rött betyder vänta.'),
        ], beskrivning='Hjälm, cykelns broms och lyse, reflex, bilbälte och trafiksignalerna.'),
    ]),

    # ================================================================ SO åk 2
    bana(SO, 'ak2', [
        niva('so-ak2-regler-1', 'Regler och att rösta', 'Regler och rättigheter', [
            val('Varför finns det regler i klassrummet?',
                ['Så att alla kan må bra och lära sig', 'Så att de vuxna alltid får som de vill',
                 'Så att ingen behöver prata med någon'],
                'Så att alla kan må bra och lära sig',
                'Regler hjälper oss att vara schyssta mot varandra. Då blir det lugnt och tryggt för alla.'),
            para('Para ihop platsen med en regel som ofta gäller där.',
                 [('Biblioteket', 'Prata tyst'), ('Simhallen', 'Gå, spring inte'),
                  ('Matsalen', 'Tvätta händerna före maten')],
                 'Olika platser har olika regler. Reglerna gör att alla kan vara där och känna sig trygga.'),
            val('Varför räcker man upp handen i klassrummet?',
                ['Så att man pratar en i taget', 'Så att man får gå ut på rast först',
                 'Så att läraren vet vem som är trött'],
                'Så att man pratar en i taget',
                'Om alla pratar samtidigt hör ingen något. När man räcker upp handen får alla sin tur.'),
            sant('Regler finns bara i skolan.', False,
                 'Regler finns överallt: hemma, i trafiken, i idrottslaget och i spel. De hjälper oss att '
                 'fungera tillsammans.'),
            val('Vad är ett klassråd?',
                ['Ett möte där klassen tar beslut', 'Ett prov som hela klassen skriver',
                 'En lektion där läraren läser högt'],
                'Ett möte där klassen tar beslut',
                'På klassrådet får alla elever säga vad de tycker. Sedan bestämmer klassen tillsammans, ofta '
                'genom att rösta.'),
            val('Klassen röstar om rastleken. %d vill spela fotboll och %d vill spela brännboll. Vad blir det '
                'om majoriteten bestämmer?' % (dict(ROSTER)['Fotboll'], dict(ROSTER)['Brännboll']),
                ['Fotboll', 'Brännboll', 'Båda två'], VINNARE,
                'Majoriteten är de som är flest. %d är fler än %d, så det blir %s.'
                % (VINNAR_ROSTER, FORLORAR_ROSTER, VINNARE.lower())),
            sant('När klassen röstar har varje elev en röst.', True,
                 'Alla röster är lika mycket värda. Därför blir det rättvist när man räknar rösterna.'),
            val('Vad kallas det när alla får vara med och bestämma, till exempel genom att rösta?',
                ['Demokrati', 'Diktatur', 'Kungavälde'], 'Demokrati',
                'Demokrati betyder folkstyre. Alla får säga vad de tycker och vara med och bestämma.'),
        ], beskrivning='Varför regler finns, klassrådet och hur en omröstning går till.'),

        niva('so-ak2-regler-2', 'Barnens rättigheter', 'Regler och rättigheter', [
            val('Vad heter överenskommelsen som säger vilka rättigheter alla barn har?',
                ['Barnkonventionen', 'Trafikförordningen', 'Allemansrätten'], 'Barnkonventionen',
                'Barnkonventionen säger vilka rättigheter alla barn i världen har. Sedan år 2020 är den lag i Sverige.'),
            skriv('I barnkonventionen räknas alla som är under ett visst antal år som barn. Hur många år? '
                  'Svara med ett tal.', svar(BARN_UNDER, 'aderton'),
                  'Alla som är under %d år räknas som barn. Barnkonventionen gäller alltså dig.' % BARN_UNDER),
            sant('Barnkonventionen gäller alla barn, var de än bor och vilket språk de än talar.', True,
                 'Alla barn har samma rättigheter. Ingen får behandlas sämre på grund av sitt kön, sin religion '
                 'eller var hen kommer ifrån.'),
            val('Vilka kom överens om barnkonventionen?',
                ['Länderna i FN', 'Lärarna i Sverige', 'Barnen i en skola'], 'Länderna i FN',
                'FN är ett samarbete mellan nästan alla länder i världen. Där kom länderna överens om '
                'barnkonventionen år 1989.'),
            sant('Barn har rätt att leka och vila.', True,
                 'I barnkonventionen står det att barn har rätt till lek, vila och fritid.'),
            para('Para ihop rättigheten med ett exempel.',
                 [('Rätt till utbildning', 'Gå i skolan'), ('Rätt till vård', 'Få hjälp av en läkare'),
                  ('Rätt till lek och vila', 'Ha fritid och sova'), ('Rätt att säga sin mening', 'Bli lyssnad på')],
                 'Rättigheterna gäller sådant som alla barn behöver för att må bra och växa upp.'),
            sant('I Sverige får vuxna slå ett barn om barnet har gjort något dumt.', False,
                 'Det är förbjudet att slå barn i Sverige. Händer det dig kan du berätta det för en vuxen som du '
                 'litar på.'),
            val('Vem kan du prata med om någon behandlar dig illa?',
                ['En vuxen du litar på', 'Ingen, det är bäst att vara tyst', 'Bara den som var elak'],
                'En vuxen du litar på',
                'Du har rätt att vara trygg. En lärare, en förälder eller en annan vuxen du litar på kan hjälpa dig.'),
        ], beskrivning='Barnkonventionen: vilka rättigheter alla barn har och vem man kan be om hjälp.'),

        niva('so-ak2-hogtider-1', 'Jul och påsk', 'Högtider', [
            val('Vad firar kristna på julen?',
                ['Att Jesus föddes', 'Att Jesus uppstod', 'Att våren har kommit'], 'Att Jesus föddes',
                'Julen är Jesus födelsefest. På påsken minns kristna i stället att Jesus dog och uppstod.'),
            val('I vilken stad föddes Jesus, enligt Bibeln?', ['Betlehem', 'Jerusalem', 'Rom'], 'Betlehem',
                'Enligt Bibeln föddes Jesus i Betlehem och lades i en krubba.'),
            val('Vilket datum är julafton?', ['24 december', '25 december', '31 december'], '24 december',
                'I Sverige firar de flesta julafton den 24 december. Dagen efter är juldagen.'),
            skriv('Advent är söndagarna före jul. Hur många adventssöndagar finns det? Svara med ett tal.',
                  svar(len(ADVENTSSONDAGAR)),
                  'Det finns fyra adventssöndagar. Varje söndag tänds ett ljus till i adventsljusstaken.'),
            val('Vad minns kristna på påsken?',
                ['Att Jesus dog och uppstod', 'Att Jesus föddes i Betlehem', 'Att Jesus döptes i en flod'],
                'Att Jesus dog och uppstod',
                'På långfredagen minns kristna att Jesus dog på korset. På påskdagen firar de att han uppstod.'),
            sant('Påsken är på samma datum varje år.', False,
                 'Påsken flyttar sig. Den kommer i mars eller april, på olika datum olika år.'),
            ordna('Ordna påskens dagar i rätt ordning.', ['Skärtorsdagen', 'Långfredagen', 'Påskafton', 'Påskdagen'],
                  forklaring='Skärtorsdagen är en torsdag. Sedan kommer långfredagen, påskafton på lördagen och '
                             'påskdagen på söndagen.'),
            para('Para ihop det du ser med högtiden.',
                 [('Krubban och stjärnan', 'Julen'), ('Korset och den tomma graven', 'Påsken'),
                  ('Ljusstake med fyra ljus', 'Advent')],
                 'Krubban hör till berättelsen om när Jesus föddes. Den tomma graven hör till påsken, när Jesus uppstod.'),
        ], beskrivning='De kristna högtiderna jul, advent och påsk och berättelserna bakom dem.'),

        niva('so-ak2-hogtider-2', 'Sabbat, pesach och ramadan', 'Högtider', [
            val('Vad heter judendomens vilodag?', ['Sabbat', 'Ramadan', 'Advent'], 'Sabbat',
                'Sabbaten är judendomens vilodag. Då vilar man från arbete och äter en festmåltid tillsammans.'),
            sant('Sabbaten börjar på fredag kväll och slutar på lördag kväll.', True,
                 'I judendomen börjar ett nytt dygn när solen går ner. Därför börjar sabbaten redan på fredag kväll.'),
            val('Vad minns judar på pesach?',
                ['Uttåget ur Egypten', 'Att Jesus föddes', 'Att fastan är slut'], 'Uttåget ur Egypten',
                'Enligt berättelsen ledde Mose folket ut ur slaveriet i Egypten. Det minns judar på pesach.'),
            val('Varför äter judar matsa, bröd utan jäst, på pesach?',
                ['Folket hade bråttom ut ur Egypten', 'Bröd med jäst var förbjudet i Egypten',
                 'Matsa var det enda bröd som fanns förr'],
                'Folket hade bråttom ut ur Egypten',
                'Enligt berättelsen fick folket så bråttom att brödet inte hann jäsa. Matsan påminner om det.'),
            val('Vad heter islams fastemånad?', ['Ramadan', 'Pesach', 'Id al-fitr'], 'Ramadan',
                'Ramadan är en månad då många muslimer fastar. Det är en tid för bön och för att tänka på andra.'),
            sant('Under ramadan äter och dricker många muslimer inte när det är ljust ute.', True,
                 'De fastar från gryningen tills solen går ner. Då äter de en måltid tillsammans.'),
            val('Vad heter högtiden när ramadan är slut?', ['Id al-fitr', 'Pesach', 'Långfredagen'], 'Id al-fitr',
                'På id al-fitr firar man att fastan är slut. Man klär sig fint, äter god mat och träffar släkt '
                'och vänner.'),
            para('Para ihop högtiden med religionen.',
                 [('Påsk', 'Kristendom'), ('Pesach', 'Judendom'), ('Id al-fitr', 'Islam')],
                 'Påsken firas av kristna, pesach av judar och id al-fitr av muslimer.'),
        ], beskrivning='Judendomens sabbat och pesach och islams ramadan och id al-fitr.'),

        niva('so-ak2-forr-1', 'Livet på en tidslinje', 'Förr och nu', [
            ordna('Ordna livets delar, från början.', ['Bebis', 'Barn', 'Tonåring', 'Vuxen', 'Gammal'],
                  forklaring='Alla börjar som bebisar. Sedan blir man barn, tonåring och vuxen, och till sist gammal.'),
            val('Vad är en tidslinje?',
                ['En linje som visar när saker hände', 'En linje som visar vägen till skolan',
                 'En linje som visar hur lång du är'],
                'En linje som visar när saker hände',
                'På en tidslinje står det som har hänt i ordning. Det som hände först står oftast längst till vänster.'),
            skriv('Theo föddes år %d. Hur många år fyller han år %d?' % (FODD, FYLLER_AR), svar(ALDER),
                  'Räkna från %d till %d. Det är %d år.' % (FODD, FYLLER_AR, ALDER)),
            sant('Framtiden är det som inte har hänt än.', True,
                 'Det som har hänt är dåtid, det som händer nu är nutid och det som ska hända är framtid.'),
            para('Para ihop ordet med vilken dag det är.',
                 [('I förrgår', 'Två dagar före i dag'), ('I går', 'Dagen före i dag'),
                  ('I morgon', 'Dagen efter i dag'), ('I övermorgon', 'Två dagar efter i dag')],
                 'I går och i förrgår har redan hänt. I morgon och i övermorgon har inte hänt än.'),
            val('Hur många år är ett århundrade?', [10, 100, 1000], 100,
                'Ett århundrade är hundra år. Det hörs på ordet: år-hundra-de.'),
            val('Vem av de här är äldst?', ['Mammas mamma', 'Mamma', 'Mammas dotter'], 'Mammas mamma',
                'Mammas mamma är mormor. Hon föddes före mamma, och mamma föddes före sin dotter.'),
            val('Vilket händer först i ett liv?',
                ['Man lär sig gå', 'Man börjar i skolan', 'Man går i pension'], 'Man lär sig gå',
                'De flesta lär sig gå innan de fyller två år. Skolan börjar senare, och pension får man som gammal.'),
        ], beskrivning='Tidsord, tidslinjen över ett liv och att räkna år.'),

        niva('so-ak2-forr-2', 'Skolan och hemmet förr', 'Förr och nu', [
            val('Vad skrev barnen ofta på i skolan på 1800-talet?',
                ['En griffeltavla', 'En surfplatta', 'Ett datorprogram'], 'En griffeltavla',
                'En griffeltavla var en liten tavla av sten. Man skrev på den med en griffel och kunde sudda '
                'och skriva igen.'),
            val('Vad lyste man upp hemmet med på 1800-talet?',
                ['Ljus och oljelampor', 'Taklampor med glödlampor', 'Ficklampor med batterier'],
                'Ljus och oljelampor',
                'De flesta hem hade ingen el. Man tände ljus och lampor som brann med olja eller fotogen.'),
            sant('På 1800-talet fick många barn arbeta hemma på gården.', True,
                 'Barnen passade djuren, bar ved och hämtade vatten. Alla behövdes för att familjen skulle klara sig.'),
            val('Var hämtade de flesta familjer på landet sitt vatten på 1800-talet?',
                ['I en brunn', 'Ur kranen i köket', 'Ur en flaska från affären'], 'I en brunn',
                'Husen hade inga vattenledningar. Man bar hem vattnet i hinkar från brunnen.'),
            sant('På 1800-talet kunde barnen titta på tv på kvällarna.', False,
                 'Tv fanns inte då. Tv-sändningar kom till Sverige först på 1950-talet.'),
            para('Para ihop saken från förr med det vi har i dag.',
                 [('Griffeltavla', 'Skrivbok'), ('Oljelampa', 'Taklampa'), ('Brunn', 'Vattenkran'),
                  ('Utedass', 'Toalett')],
                 'Förr skrev man på griffeltavla, lyste med olja, hämtade vatten i brunnen och gick på utedass.'),
            val('Vilka leksaker hade många barn på 1800-talet?',
                ['Dockor av tyg', 'Bilar av plast', 'Spel på en surfplatta'], 'Dockor av tyg',
                'Plast och skärmar fanns inte. Leksakerna gjordes ofta hemma av trä, tyg eller halm.'),
            sant('På 1800-talet gick barnen i skolan i lika många år som i dag.', False,
                 'Förr gick många barn bara några år i skolan. De behövdes också hemma för att hjälpa till.'),
        ], beskrivning='Hur barn levde på 1800-talet: skolan, ljuset, vattnet och leksakerna.'),
    ]),

    # ================================================================ SO åk 3
    bana(SO, 'ak3', [
        niva('so-ak3-pengar-1', 'Vad kostar det?', 'Pengar och arbete', [
            val('Vad heter pengarna i Sverige?', ['Kronor', 'Euro', 'Dollar'], 'Kronor',
                'I Sverige betalar man med kronor. I många andra länder i Europa betalar man med euro.'),
            skriv('En glass kostar %d kronor. Du betalar med %d kronor. Hur många kronor får du tillbaka?'
                  % (GLASS, BETALAR), svar(VAXEL),
                  '%d − %d = %d. Du får %d kronor tillbaka.' % (BETALAR, GLASS, VAXEL, VAXEL)),
            val('Ett äpple kostar %d kronor. Vad kostar %d äpplen?' % (APPLE_PRIS, APPLEN),
                ['%d kronor' % x for x in (APPLEN_FEL[0], APPLEN_KOSTAR, APPLEN_FEL[1])],
                '%d kronor' % APPLEN_KOSTAR,
                '%s. Tre äpplen kostar %d kronor.'
                % (' + '.join([str(APPLE_PRIS)] * APPLEN) + ' = %d' % APPLEN_KOSTAR, APPLEN_KOSTAR)),
            val('Vilket av de här behöver alla människor?', ['Mat', 'En spelkonsol', 'Godis'], 'Mat',
                'Mat behöver alla för att leva. En spelkonsol och godis är saker man kan önska sig.'),
            val('En boll kostar %d kronor i en affär och %d kronor i en annan. Var är den billigast?'
                % (BOLLEN[0], BOLLEN[1]),
                ['Där den kostar %d kronor' % BOLLEN_BILLIGAST, 'Där den kostar %d kronor' % BOLLEN_DYRAST,
                 'Lika billig i båda'],
                'Där den kostar %d kronor' % BOLLEN_BILLIGAST,
                '%d kronor är mindre än %d kronor. Det lönar sig att jämföra priser.'
                % (BOLLEN_BILLIGAST, BOLLEN_DYRAST)),
            sant('Om du betalar med kort använder du också pengar.', True,
                 'Kortet hör ihop med ett konto på banken. Det är riktiga pengar, fast du inte ser dem.'),
            para('Para ihop ordet med vad det betyder.',
                 [('Pris', 'Vad något kostar'), ('Kvitto', 'Visar vad du har köpt och betalat'),
                  ('Växel', 'Pengar du får tillbaka'), ('Plånbok', 'Där du kan ha dina pengar')],
                 'Priset står på varan. Betalar du för mycket får du växel tillbaka, och kvittot visar vad du köpte.'),
            ordna('Ordna sakerna från billigast till dyrast.', billigast_forst(VAROR),
                  forklaring='Jämför talen. %s kronor är minst och %s kronor är mest.'
                             % (tal(min(p for _, p in VAROR)), tal(max(p for _, p in VAROR)))),
        ], beskrivning='Att betala, få tillbaka, jämföra priser och skilja på behov och önskningar.'),

        niva('so-ak3-pengar-2', 'Att arbeta och spara', 'Pengar och arbete', [
            val('Varför arbetar de flesta vuxna?',
                ['För att få lön', 'För att de måste gå hemifrån', 'För att skolan ska ha lov'], 'För att få lön',
                'Med lönen betalar man mat, hyra och kläder. Många arbetar också för att jobbet är roligt eller viktigt.'),
            sant('Allt arbete ger lön.', False,
                 'Den som hjälper till hemma eller i en förening gör ofta ett arbete utan lön. Det är också viktigt.'),
            val('Varför sparar man pengar?',
                ['För att kunna köpa något senare', 'För att pengarna ska ta slut fortare',
                 'För att få handla mer i dag'],
                'För att kunna köpa något senare',
                'När man sparar lägger man undan pengar. Då kan man köpa något dyrare längre fram.'),
            skriv('Maja sparar %d kronor varje vecka. Hur många kronor har hon sparat efter %d veckor?'
                  % (SPAR_VECKA, VECKOR), svar(SPARAT),
                  '%d veckor gånger %d kronor är %d kronor.' % (VECKOR, SPAR_VECKA, SPARAT)),
            val('Var kan man spara pengar på ett säkert sätt?',
                ['På ett bankkonto', 'I fickan på jackan', 'I bänken i skolan'], 'På ett bankkonto',
                'På ett bankkonto kan pengarna inte tappas bort, som de kan i en ficka.'),
            val('Vem betalar för att du kan gå i skolan?',
                ['Alla som betalar skatt', 'Varje familj betalar själv', 'Lärarna betalar för eleverna'],
                'Alla som betalar skatt',
                'Skolan är gratis för eleverna. Den betalas med skatt, pengar som vi betalar tillsammans.'),
            sant('Om du lånar pengar behöver du betala tillbaka dem.', True,
                 'Den som lånar ut pengar vill ha tillbaka dem. Ofta får man betala lite extra, och det kallas ränta.'),
            para('Para ihop ordet med vad det betyder.',
                 [('Lön', 'Pengar man får för sitt arbete'), ('Skatt', 'Pengar till sådant som alla behöver'),
                  ('Bank', 'Där man kan ha pengar på ett konto'), ('Spargris', 'En burk att spara mynt i')],
                 'Lönen tjänar man, skatten betalar man tillsammans, och sparpengar kan ligga på banken eller i '
                 'en spargris.'),
        ], beskrivning='Lön, skatt och att spara och låna.'),

        niva('so-ak3-kartan-1', 'Kartan och dess tecken', 'Kartan och väderstrecken', [
            val('Vad visar en karta?',
                ['En plats sedd ovanifrån', 'Ett hus sett från gatan', 'En stad sedd från ett tåg'],
                'En plats sedd ovanifrån',
                'En karta är som en bild tagen rakt uppifrån, fast mindre och ritad med tecken.'),
            para('Para ihop ordet med vad det betyder.',
                 [('Karta', 'En plats ritad uppifrån'), ('Karttecken', 'En liten bild som betyder något'),
                  ('Teckenförklaring', 'Säger vad tecknen betyder'), ('Skala', 'Hur mycket kartan är förminskad')],
                 'Karttecknen gör att mycket får plats på kartan. Teckenförklaringen berättar vad de betyder.'),
            val('Vad visar blå färg oftast på en karta?', ['Vatten', 'Skog', 'Bilvägar'], 'Vatten',
                'Sjöar, hav och åar brukar vara blå på kartan. Då ser man direkt var vattnet är.'),
            sant('En karta är mindre än det område den visar.', True,
                 'Kartan är förminskad. Annars skulle en karta över staden vara lika stor som hela staden.'),
            val('Du ska hitta till en lekplats där du aldrig har varit. Vad har du mest nytta av?',
                ['En karta', 'En klocka', 'En termometer'], 'En karta',
                'På kartan ser du var du är och var lekplatsen ligger. Då kan du hitta vägen dit.'),
            sant('På en karta ser husen ut som när man står framför dem.', False,
                 'På kartan ser man husen uppifrån. De ritas ofta som små rutor eller fyrkanter.'),
            val('Vilken karta visar din skolgård tydligast?',
                ['En karta över skolgården', 'En karta över Sverige', 'En karta över hela världen'],
                'En karta över skolgården',
                'Ju mindre område en karta visar, desto mer får plats. På en Sverigekarta syns inte din skolgård.'),
            skriv('På en karta är 1 cm lika långt som %d meter i verkligheten. Hur många meter är %d cm på '
                  'kartan?' % (KARTA_M_PER_CM, KARTA_CM), svar(KARTA_M),
                  '1 cm är %d meter, så %d cm är %d gånger %d meter. Det är %d meter.'
                  % (KARTA_M_PER_CM, KARTA_CM, KARTA_CM, KARTA_M_PER_CM, KARTA_M)),
        ], beskrivning='Vad en karta är, karttecken, teckenförklaring och skala.'),

        niva('so-ak3-kartan-2', 'Väderstrecken', 'Kartan och väderstrecken', [
            ordna('Börja i norr och gå medsols, som klockans visare. Ordna väderstrecken.',
                  ['Norr', 'Öster', 'Söder', 'Väster'],
                  forklaring='Med norr uppåt ligger öster till höger, söder nedåt och väster till vänster. '
                             'Medsols blir det norr, öster, söder och väster.'),
            para('På en karta med norr uppåt: para ihop hållet med väderstrecket.',
                 [('Uppåt', 'Norr'), ('Nedåt', 'Söder'), ('Till höger', 'Öster'), ('Till vänster', 'Väster')],
                 'De flesta kartor har norr uppåt. Då är söder nedåt, öster till höger och väster till vänster.'),
            val('Vad visar nålen i en kompass?', ['Var norr är', 'Var skolan är', 'Hur mycket klockan är'],
                'Var norr är', 'Kompassnålen är en liten magnet. Den vrider sig så att ena änden pekar mot norr.'),
            val('Åt vilket håll går solen upp, ungefär?', ['Öster', 'Väster', 'Norr'], 'Öster',
                'Solen går upp ungefär i öster och ner ungefär i väster. Det beror på att jorden snurrar.'),
            sant('När solen står som högst på dagen står den i söder, sett från Sverige.', True,
                 'Sverige ligger norr om ekvatorn. Därför står solen åt söder när den är som högst.'),
            val('Du tittar mot norr. Vilket väderstreck har du bakom dig?', ['Söder', 'Öster', 'Väster'], 'Söder',
                'Söder är mitt emot norr. Tittar du mot norr ligger söder bakom ryggen.'),
            val('Vilket väderstreck ligger mitt emellan söder och väster?', ['Sydväst', 'Sydost', 'Nordväst'],
                'Sydväst', 'Namnet sätts ihop av de två väderstrecken: syd och väst blir sydväst.'),
            sant('Malmö ligger norr om Stockholm.', False,
                 'Malmö ligger längst ner i Sverige, i Skåne. Det är söder om Stockholm.'),
        ], beskrivning='Väderstrecken på kartan och i verkligheten, kompassen och solen.'),

        niva('so-ak3-varlden-1', 'Jordgloben', 'Jorden och världsdelarna', [
            val('Vilken form har jorden?', ['Rund som ett klot', 'Platt som ett papper', 'Fyrkantig som en låda'],
                'Rund som ett klot', 'Jorden är ett stort klot. Därför är en jordglob den bästa modellen av jorden.'),
            para('Para ihop ordet med vad det betyder.',
                 [('Jordglob', 'En rund modell av jorden'), ('Ekvatorn', 'En tänkt linje runt jordens mitt'),
                  ('Nordpolen', 'Jordens nordligaste punkt'), ('Världskarta', 'Hela jorden ritad platt')],
                 'Jordgloben är rund som jorden. På en världskarta är jorden ritad platt, så att den får plats på '
                 'ett papper.'),
            sant('Det finns mer hav än land på jorden.', True,
                 'Det mesta av jordens yta är hav. Därför ser jorden blå ut från rymden.'),
            val('Var på jorden är det kallast?', ['Vid polerna', 'Vid ekvatorn', 'Mitt i Europa'], 'Vid polerna',
                'Vid nordpolen och sydpolen når solens strålar fram snett och svagt. Där är det kallt året runt.'),
            sant('När det är sommar i Sverige är det vinter i Australien.', True,
                 'Australien ligger på södra halvan av jorden. Där kommer årstiderna tvärtom mot hos oss.'),
            val('På vilken halva av jorden ligger Sverige?',
                ['Den norra halvan', 'Den södra halvan', 'Precis på ekvatorn'], 'Den norra halvan',
                'Sverige ligger långt norr om ekvatorn, närmare nordpolen än ekvatorn.'),
            sant('En platt karta kan visa hela jorden helt rätt, utan att något blir fel.', False,
                 'Jorden är rund. När den ritas platt blir vissa länder för stora eller får fel form.'),
            val('Vad kallas det när solen syns mitt i natten på sommaren, långt norrut i Sverige?',
                ['Midnattssol', 'Norrsken', 'Solförmörkelse'], 'Midnattssol',
                'Långt norrut går solen inte ner på några veckor runt midsommar. Därför kallas det midnattssol.'),
        ], beskrivning='Jordgloben och världskartan, ekvatorn och polerna, och årstiderna i Sverige och söderut.'),

        niva('so-ak3-varlden-2', 'Världsdelar och hav', 'Jorden och världsdelarna', [
            val('I vilken världsdel ligger Sverige?', ['Europa', 'Asien', 'Afrika'], 'Europa',
                'Sverige ligger i norra Europa, tillsammans med till exempel Norge, Finland och Danmark.'),
            val('Vilken är den största världsdelen?', ['Asien', 'Europa', 'Afrika', 'Antarktis'], 'Asien',
                'Asien är störst, både till ytan och till hur många som bor där. Där ligger till exempel Kina och Indien.'),
            para('Para ihop platsen med världsdelen den ligger i.',
                 [('Sahara', 'Afrika'), ('Amazonas regnskog', 'Sydamerika'), ('Mount Everest', 'Asien'),
                  ('Kanada', 'Nordamerika')],
                 'Sahara är en öken i Afrika och Amazonas en regnskog i Sydamerika. Mount Everest i Asien är '
                 'världens högsta berg.'),
            val('Vilken världsdel är nästan helt täckt av is?', ['Antarktis', 'Afrika', 'Nordamerika'], 'Antarktis',
                'Antarktis ligger runt sydpolen och är täckt av tjock is. Det är den kallaste världsdelen.'),
            val('Vilket är världens största hav?', ['Stilla havet', 'Atlanten', 'Indiska oceanen'], 'Stilla havet',
                'Stilla havet är störst. Det är större än allt land på jorden tillsammans.'),
            sant('Atlanten ligger mellan Europa och Nordamerika.', True,
                 'Atlanten ligger mellan Europa och Afrika på ena sidan och Amerika på den andra.'),
            sant('Afrika är ett land.', False,
                 'Afrika är en världsdel med många länder, till exempel Egypten, Kenya och Nigeria.'),
            val('Vilken världsdel ligger söder om Europa, på andra sidan Medelhavet?',
                ['Afrika', 'Asien', 'Sydamerika'], 'Afrika',
                'Medelhavet ligger mellan Europa och Afrika. Afrika ligger alltså söder om Europa.'),
        ], beskrivning='Världsdelarna och de stora haven, och var Sverige ligger.'),

        niva('so-ak3-religioner-1', 'Berättelser i Bibeln', 'Religioner och berättelser', [
            val('Hur många dagar skapade Gud världen på, enligt skapelseberättelsen i Bibeln?', [6, 7, 10], 6,
                'Enligt berättelsen skapade Gud världen på sex dagar och vilade på den sjunde dagen.'),
            sant('I berättelsen om Noa är regnbågen ett tecken på ett löfte från Gud.', True,
                 'Efter floden lovar Gud att aldrig mer dränka jorden. Regnbågen är tecknet på löftet.'),
            para('Para ihop personen med berättelsen.',
                 [('Noa', 'Arken och floden'), ('David', 'Jätten Goliat'), ('Jona', 'Den stora fisken'),
                  ('Maria', 'Jesus mamma')],
                 'Enligt Bibeln byggde Noa en ark, David besegrade Goliat och Jona slukades av en stor fisk. '
                 'Maria var Jesus mamma.'),
            val('Vad vill berättelsen om den barmhärtige samariern lära oss?',
                ['Att hjälpa den som behöver det', 'Att man ska vara rädd för främlingar',
                 'Att man alltid ska vinna över andra'],
                'Att hjälpa den som behöver det',
                'En man stannar och hjälper en skadad främling som andra har gått förbi. Berättelsen handlar om '
                'att hjälpa alla.'),
            ordna('Ordna det som händer i påskens berättelse.',
                  ['Jesus rider in i Jerusalem', 'Jesus äter en sista måltid', 'Jesus dör på korset', 'Graven är tom'],
                  forklaring='Jesus rider in i Jerusalem på palmsöndagen och äter med lärjungarna på skärtorsdagen. '
                             'Han dör på långfredagen, och på påskdagen är graven tom.'),
            val('Vad följde de vise männen för att hitta Jesus, enligt Bibeln?',
                ['En stjärna', 'En flod', 'En gammal karta'], 'En stjärna',
                'Enligt berättelsen såg de en ny stjärna på himlen. De följde den och kom med gåvor till Jesus.'),
            val('Vilken del av Bibeln berättar om Jesus?', ['Nya testamentet', 'Gamla testamentet', 'Koranen'],
                'Nya testamentet',
                'Nya testamentet handlar om Jesus och de första kristna. Gamla testamentet skrevs före Jesus tid.'),
            sant('I Bibeln berättar Jesus ofta korta berättelser som ska lära ut något. De kallas liknelser.', True,
                 'En liknelse är en kort berättelse med ett budskap, som den om den barmhärtige samariern.'),
        ], beskrivning='Berättelser ur Bibeln: skapelsen, Noa, David, Jesus födelse och påsken.'),

        niva('so-ak3-religioner-2', 'Judendom och islam', 'Religioner och berättelser', [
            val('Vem ledde folket ut ur Egypten, enligt berättelsen?', ['Mose', 'Noa', 'David'], 'Mose',
                'Enligt berättelsen ledde Mose folket ut ur slaveriet i Egypten. Det minns judar på pesach.'),
            val('Vad fick Mose på berget Sinai, enligt berättelsen?',
                ['De tio budorden', 'En stor båt', 'En gyllene krona'], 'De tio budorden',
                'Budorden är regler från Gud, till exempel att man inte ska stjäla. De är viktiga i både '
                'judendom och kristendom.'),
            sant('Abraham är en viktig person i judendom, kristendom och islam.', True,
                 'Alla tre religionerna berättar om Abraham. I islam kallas han Ibrahim.'),
            ordna('Ordna det som hände i Muhammeds liv, enligt islams berättelser.',
                  ['Muhammed föds i Mecka', 'Muhammed får Koranens första ord', 'Muhammed flyttar till Medina'],
                  forklaring='Enligt berättelserna föddes Muhammed i Mecka. Som vuxen fick han Koranens första '
                             'ord, och senare flyttade han till Medina.'),
            val('Vilken är islams heligaste stad?', ['Mecka', 'Rom', 'Jerusalem'], 'Mecka',
                'Mecka ligger i Saudiarabien. När muslimer ber vänder de sig mot Mecka, och dit vallfärdar många.'),
            para('Para ihop den heliga boken med religionen.',
                 [('Bibeln', 'Kristendom'), ('Toran', 'Judendom'), ('Koranen', 'Islam')],
                 'Bibeln är kristendomens heliga bok, Toran judendomens och Koranen islams.'),
            sant('Koranen är skriven på arabiska.', True,
                 'Koranen är skriven på arabiska. Många muslimer lär sig läsa den på arabiska, även om de talar '
                 'ett annat språk hemma.'),
            val('Vilken symbol hör ihop med judendomen?', ['Davidsstjärnan', 'Korset', 'Halvmånen med stjärna'],
                'Davidsstjärnan', 'Davidsstjärnan är en stjärna med sex uddar. Den är en vanlig symbol för judendomen.'),
        ], beskrivning='Berättelser om Mose, Abraham och Muhammed, de heliga böckerna och en symbol.'),
    ]),

    # ================================================================ NO åk 3
    bana(NO, 'ak3', [
        niva('no-ak3-djur-vaxter-1', 'Djuren på vintern', 'Djur och växter', [
            val('Varför flyger svalorna söderut på hösten?',
                ['Insekterna de äter försvinner', 'De vill slippa regnet i Sverige',
                 'De måste lägga ägg där det är varmt'],
                'Insekterna de äter försvinner',
                'Svalan fångar flygande insekter. På vintern finns inga sådana här, så den flyger till Afrika.'),
            val('Vad kallas en fågel som stannar i Sverige hela vintern?', ['Stannfågel', 'Flyttfågel', 'Sjöfågel'],
                'Stannfågel',
                'Stannfåglar, som talgoxen och skatan, stannar här hela året. Flyttfåglarna flyger söderut på hösten.'),
            para('Para ihop djuret med hur det klarar vintern.',
                 [('Igelkott', 'Sover i ide'), ('Trana', 'Flyttar söderut'), ('Skogshare', 'Får vit päls'),
                  ('Ekorre', 'Äter ur gömda förråd')],
                 'Igelkotten sover, tranan flyger till varmare länder, harens vita päls syns inte i snön och '
                 'ekorren har gömt mat.'),
            sant('Ekorren går i ide på vintern.', False,
                 'Ekorren är vaken hela vintern. Den sover mycket i sitt bo och äter nötter och kottar som den har gömt.'),
            val('Varför äter igelkotten mycket på hösten?',
                ['Den samlar fett inför idet', 'Den ska vandra söderut', 'Den ska få tjockare taggar'],
                'Den samlar fett inför idet',
                'I idet äter igelkotten ingenting. Den lever på fettet som den har samlat på sig under hösten.'),
            sant('Granen och tallen behåller sina barr på vintern.', True,
                 'Granen och tallen är gröna hela året. Barren tål kyla bättre än lövträdens tunna blad.'),
            val('Vilken av de här fåglarna är en flyttfågel?', ['Göken', 'Talgoxen', 'Skatan'], 'Göken',
                'Göken kommer till Sverige på våren och flyger till Afrika på hösten. Talgoxen och skatan stannar här.'),
            val('Hur klarar sig grodan på vintern?',
                ['Den ligger stilla i dvala', 'Den flyger till varmare länder', 'Den byter till tjock päls'],
                'Den ligger stilla i dvala',
                'Grodan blir lika kall som omgivningen. Den ligger stilla i dvala, i bottenslammet i en damm '
                'eller under löv på land.'),
        ], beskrivning='Hur djur och träd klarar vintern: flyttfåglar, stannfåglar, ide och dvala.'),

        niva('no-ak3-djur-vaxter-2', 'Från ägg till fjäril', 'Djur och växter', [
            ordna('Ordna fjärilens liv, från början.', ['Ägg', 'Larv', 'Puppa', 'Fjäril'],
                  forklaring='Ur ägget kommer en larv som äter och växer. Larven blir en puppa, och ur puppan '
                             'kryper fjärilen ut.'),
            val('Vad gör en fjärilslarv nästan hela tiden?', ['Äter blad', 'Sover i ett ide', 'Bygger ett bo'],
                'Äter blad', 'Larven äter och växer snabbt. Sedan blir den en puppa och förvandlas till en fjäril.'),
            val('Hur andas grodynglet när det simmar i vattnet?', ['Med gälar', 'Med lungor', 'Genom svansen'],
                'Med gälar', 'Grodynglet andas med gälar, som en fisk. När det har blivit en groda andas den med lungor.'),
            sant('Ett grodyngel ser ut som en liten groda från början.', False,
                 'Grodynglet har svans men inga ben. Det ser mer ut som en liten fisk än som en groda.'),
            para('Para ihop djuret eller växten med dess livscykel.',
                 [('Groda', 'Rom, grodyngel, groda'), ('Höna', 'Ägg, kyckling, höna'),
                  ('Maskros', 'Frö, planta, blomma'), ('Människa', 'Bebis, barn, vuxen')],
                 'En livscykel är hur ett liv börjar och fortsätter. Alla djur och växter har en, och de ser olika ut.'),
            val('Vad behöver en växt för att kunna göra sin egen mat?', ['Ljus', 'Mörker', 'Snö'], 'Ljus',
                'Med hjälp av ljuset gör bladen socker av vatten och luft. Sockret är växtens mat.'),
            sant('Växter kan göra sin egen mat, men djur måste äta växter eller andra djur.', True,
                 'Växterna gör mat med hjälp av solljuset. Djuren kan inte det, så de äter växter eller andra djur.'),
            val('Vilket djur hjälper blommorna att få frön när det flyger mellan dem?',
                ['Humlan', 'Daggmasken', 'Sniglen'], 'Humlan',
                'Humlan hämtar nektar. Då fastnar pollen på den och följer med till nästa blomma, så att det '
                'kan bli frön.'),
        ], beskrivning='Livscykler hos fjäril och groda, och vad växter behöver.'),

        niva('no-ak3-kroppen-1', 'De fem sinnena', 'Kroppen och sinnena', [
            para('Para ihop sinnet med kroppsdelen.',
                 [('Syn', 'Ögonen'), ('Hörsel', 'Öronen'), ('Lukt', 'Näsan'), ('Smak', 'Tungan'), ('Känsel', 'Huden')],
                 'Varje sinne har sin kroppsdel. Huden finns över hela kroppen, så känseln har du överallt.'),
            skriv('Hur många sinnen brukar man säga att vi har? Svara med ett tal.', svar(len(SINNEN)),
                  'Man brukar räkna fem sinnen: %s.' % ', '.join(SINNEN[:-1]) + ' och ' + SINNEN[-1]
                  if False else 'Man brukar räkna fem sinnen: syn, hörsel, lukt, smak och känsel.'),
            val('Med vilket sinne känner du att vattnet i badet är varmt?', ['Känseln', 'Hörseln', 'Synen'],
                'Känseln', 'Huden känner om något är varmt eller kallt. Det är känseln.'),
            sant('Maten kan smaka mindre när du är förkyld och täppt i näsan.', True,
                 'Lukten och smaken hjälps åt. När näsan är täppt känner du mindre av maten.'),
            val('Vilken smak har en citron?', ['Sur', 'Söt', 'Salt'], 'Sur',
                'Citronen är sur. Tungan kan känna sött, salt, surt och beskt.'),
            val('Vad händer med pupillen när du går ut i starkt solljus?',
                ['Den blir mindre', 'Den blir större', 'Den byter färg'], 'Den blir mindre',
                'Pupillen är hålet där ljuset kommer in i ögat. I starkt ljus blir den mindre, så att inte för '
                'mycket ljus kommer in.'),
            sant('Den som är blind kan läsa punktskrift med fingrarna.', True,
                 'Punktskrift är små upphöjda prickar. Man känner dem med fingertopparna och läser med känseln.'),
            val('Vart skickar sinnena sina signaler?', ['Till hjärnan', 'Till magen', 'Till hjärtat'], 'Till hjärnan',
                'Ögonen, öronen och de andra sinnena skickar signaler längs nerverna till hjärnan. Hjärnan förstår '
                'vad du ser och hör.'),
        ], beskrivning='De fem sinnena, var de sitter och hur de hjälps åt.'),

        niva('no-ak3-kroppen-2', 'Mat, sömn och rörelse', 'Kroppen och sinnena', [
            val('Ungefär hur länge behöver ett barn i din ålder sova varje natt?',
                ['Ungefär 10 timmar', 'Ungefär 4 timmar', 'Ungefär 20 timmar'], 'Ungefär 10 timmar',
                'Barn i skolåldern behöver sova ungefär 9 till 11 timmar. När du sover vilar kroppen och hjärnan.'),
            sant('När du springer slår hjärtat fortare.', True,
                 'Musklerna behöver mer syre när du springer. Hjärtat pumpar fortare så att blodet hinner föra dit syret.'),
            val('Varför behöver kroppen mat?',
                ['För att få energi och växa', 'För att magen inte ska vara tom', 'För att tänderna ska få jobba'],
                'För att få energi och växa',
                'Maten ger kroppen energi att röra sig och tänka, och byggstenar så att du kan växa.'),
            sant('Socker kan ge hål i tänderna.', True,
                 'Bakterierna i munnen äter socker och gör syra. Syran kan göra hål i tänderna.'),
            skriv('Hur många gånger om dagen ska du borsta tänderna? Svara med ett tal.', svar(len(TANDBORSTNING)),
                  'Borsta tänderna två gånger om dagen, morgon och kväll, med tandkräm med fluor. Då skyddas '
                  'tänderna mot hål.'),
            val('Vad är bäst att dricka när du är törstig?', ['Vatten', 'Läsk', 'Energidryck'], 'Vatten',
                'Vatten släcker törsten utan socker. Det är bra för både kroppen och tänderna.'),
            para('Para ihop vanan med vad den gör för dig.',
                 [('Sova', 'Kroppen och hjärnan vilar'), ('Röra på sig', 'Musklerna blir starkare'),
                  ('Tvätta händerna', 'Bakterier sköljs bort'), ('Äta frukost', 'Du får energi till förmiddagen')],
                 'Sömn, rörelse, mat och rena händer hjälper kroppen att må bra.'),
            sant('Barn mår bra av att röra på sig minst en timme varje dag.', True,
                 'Det räcker att leka, cykla eller springa. Kroppen blir starkare och man sover ofta bättre.'),
        ], beskrivning='Vad kroppen behöver: sömn, mat, vatten, rörelse och rena tänder.'),

        niva('no-ak3-vatten-material-1', 'Is, vatten och ånga', 'Vatten och material', [
            para('Para ihop vattnets form med vad den kallas.',
                 [('Fast', 'Is'), ('Flytande', 'Vatten'), ('Gas', 'Vattenånga')],
                 'Vatten kan vara fast som is, flytande som i kranen och en gas som vattenånga. Det är samma '
                 'ämne hela tiden.'),
            skriv('Vid hur många grader fryser vatten till is? Svara med ett tal.', svar(FRYSPUNKT),
                  'Vatten fryser till is vid %s grader. Är det kallare än så ute fryser pölarna.' % tal(FRYSPUNKT)),
            val('Vid ungefär hur många grader kokar vatten?',
                ['%d grader' % g for g in (KOKPUNKT, KROPPSTEMP, 2 * KOKPUNKT)], '%d grader' % KOKPUNKT,
                'Vatten kokar vid ungefär %d grader. %d grader är ungefär så varm som din kropp är.'
                % (KOKPUNKT, KROPPSTEMP)),
            sant('Is flyter på vatten.', True,
                 'Is är lättare än lika mycket vatten. Därför flyter isbitarna i glaset, och isen lägger sig '
                 'överst på sjön.'),
            val('En vattenpöl torkar upp i solen. Vart tar vattnet vägen?',
                ['Det blir vattenånga i luften', 'Det försvinner helt och hållet', 'Det sjunker ner till jordens mitt'],
                'Det blir vattenånga i luften',
                'Solen värmer vattnet så att det avdunstar. Det blir vattenånga, som du inte kan se.'),
            val('Vad kallas det när vatten blir vattenånga utan att koka?', ['Avdunstning', 'Frysning', 'Kondensering'],
                'Avdunstning', 'När vatten avdunstar blir det vattenånga. Det sker hela tiden, men fortare när det är varmt.'),
            ordna('Ordna vattnets kretslopp, med början i havet.',
                  ['Vattnet i havet avdunstar', 'Ångan kyls av högt upp', 'Det bildas moln', 'Det regnar'],
                  forklaring='Solen värmer havet så att vattnet avdunstar. Högt upp kyls ångan av och blir droppar '
                             'som bildar moln. Sedan regnar det.'),
            sant('Imman på en kall spegel efter duschen är vattenånga som har blivit vattendroppar.', True,
                 'Ångan från duschen kyls av mot den kalla spegeln och blir små droppar. Det kallas kondensation.'),
        ], beskrivning='Vattnets tre former, att frysa, koka och avdunsta, och vattnets kretslopp.'),

        niva('no-ak3-vatten-material-2', 'Material och sortering', 'Vatten och material', [
            para('Para ihop materialet med vad det görs av.',
                 [('Glas', 'Sand'), ('Papper', 'Trä'), ('Plast', 'Oftast olja'), ('Ull', 'Fårets päls')],
                 'Glas görs av sand, papper av trä och ull av fårets päls. Den mesta plasten görs av olja.'),
            val('Vilket material är genomskinligt?', ['Glas', 'Trä', 'Järn'], 'Glas',
                'Ljuset går igenom glaset. Därför är fönster av glas, så att vi kan se ut.'),
            val('Varför har en stekpanna ofta ett handtag av trä eller plast?',
                ['De leder värme dåligt', 'De är tyngre än metall', 'De går lättare att diska'],
                'De leder värme dåligt',
                'Metall leder värme bra och blir het. Trä och plast leder värme dåligt, så handtaget går att hålla i.'),
            sant('En järnspik flyter i vatten.', False,
                 'Järn är tyngre än lika mycket vatten, så spiken sjunker. De flesta träbitar flyter däremot.'),
            val('Var ska du lämna ett gammalt batteri?',
                ['Där batterier samlas in', 'I soppåsen hemma', 'Bland plasten i återvinningen'],
                'Där batterier samlas in',
                'Batterier innehåller ämnen som är farliga för naturen. Därför ska de lämnas där batterier samlas in.'),
            sant('Matrester kan bli till biogas.', True,
                 'Matavfall som sorteras ut kan rötas till biogas. Biogasen kan till exempel bussar köra på.'),
            val('Varför ska man sortera sina sopor?',
                ['För att återvinna materialet', 'För att soporna ska lukta mindre', 'För att sopbilen ska slippa köra'],
                'För att återvinna materialet',
                'Sorterat papper, glas, metall och plast kan bli nya saker. Då behöver vi ta mindre från naturen.'),
            sant('En aluminiumburk kan återvinnas och bli en ny burk.', True,
                 'Metallen smälts ner och blir nya burkar. Det går åt mycket mindre energi än att göra helt ny metall.'),
        ], beskrivning='Vad trä, metall, plast och glas klarar, och varför och hur vi sorterar avfall.'),

        niva('no-ak3-ljus-rymden-1', 'Ljus, skugga och magneter', 'Ljus, magneter och rymden', [
            val('Vilket av de här är en ljuskälla?', ['Ett tänt ljus', 'Månen', 'En blank spegel'], 'Ett tänt ljus',
                'Ett tänt ljus sänder ut eget ljus. Månen och spegeln syns bara för att ljus studsar på dem.'),
            val('Solen lyser från vänster på ett träd. Var hamnar trädets skugga?',
                ['Till höger om trädet', 'Till vänster om trädet', 'Ovanpå trädet'], 'Till höger om trädet',
                'Trädet stoppar ljuset. Skuggan hamnar alltid på andra sidan, bort från solen.'),
            sant('Din skugga är som längst mitt på dagen.', False,
                 'Mitt på dagen står solen högt, och då blir skuggan kort. På morgonen och kvällen står solen lågt '
                 'och skuggan blir lång.'),
            val('Vilket av de här dras till en magnet?', ['Ett gem av järn', 'En aluminiumburk', 'Ett suddgummi'],
                'Ett gem av järn', 'Magneter drar till sig järn. Aluminium och gummi dras inte till en magnet.'),
            sant('En magnet drar till sig alla sorters metall.', False,
                 'Magneten drar till sig järn, men inte till exempel aluminium, koppar eller guld.'),
            val('Två magneter hålls med nordpolerna mot varandra. Vad händer?',
                ['De stöter bort varandra', 'De drar till sig varandra', 'Ingenting händer alls'],
                'De stöter bort varandra',
                'Lika poler stöter bort varandra, och olika poler drar till sig varandra.'),
            sant('En magnet kan dra till sig ett gem genom ett tunt papper.', True,
                 'Magnetkraften går igenom papper. Därför kan en magnet hålla fast en lapp på kylskåpet.'),
            para('Para ihop ordet med vad det betyder.',
                 [('Ljuskälla', 'Sänder ut eget ljus'), ('Skugga', 'Där ljuset inte når fram'),
                  ('Genomskinlig', 'Släpper igenom ljus'), ('Magnet', 'Drar till sig järn')],
                 'Ljuskällan lyser, skuggan blir där ljuset stoppas, och en magnet drar till sig järn.'),
        ], beskrivning='Ljuskällor och skuggor, och vad magneter drar till sig.'),

        niva('no-ak3-ljus-rymden-2', 'Jorden, månen och solen', 'Ljus, magneter och rymden', [
            val('Varför blir det natt?',
                ['Vår sida av jorden vänds bort från solen', 'Solen slocknar och tänds igen på morgonen',
                 'Månen ställer sig framför solen varje kväll'],
                'Vår sida av jorden vänds bort från solen',
                'Jorden snurrar ett varv på ett dygn. Den sida som är vänd mot solen har dag, och den andra sidan '
                'har natt.'),
            skriv('Jorden snurrar ett varv runt sig själv på ett dygn. Hur många timmar är ett dygn? '
                  'Svara med ett tal.', svar(DYGN_TIMMAR),
                  'Ett dygn är %d timmar. Det är både dagen och natten.' % DYGN_TIMMAR),
            val('Varför kan vi se månen på natten?',
                ['Solens ljus studsar på månen', 'Månen lyser med eget ljus', 'Lampor på jorden lyser på den'],
                'Solens ljus studsar på månen',
                'Månen lyser inte själv. Solen lyser på den, och ljuset studsar vidare till oss.'),
            ordna('Ordna månens faser, med början vid nymåne.',
                  ['Nymåne', 'Växande halvmåne', 'Fullmåne', 'Avtagande halvmåne'],
                  forklaring='Efter nymånen växer den ljusa delen tills det blir fullmåne. Sedan avtar den, tills '
                             'det blir nymåne igen.'),
            sant('Solen är en stjärna.', True,
                 'Solen är en stjärna, ett stort klot av het gas. Den ser större ut än andra stjärnor för att den '
                 'är mycket närmare.'),
            para('Para ihop tiden med vad som händer.',
                 [('Ett dygn', 'Jorden snurrar ett varv'), ('En månad', 'Månen går runt jorden'),
                  ('Ett år', 'Jorden går runt solen')],
                 'Våra tider kommer från himlen: dygnet från jordens snurr, månaden från månen och året från '
                 'varvet runt solen.'),
            sant('Solen är mycket större än jorden.', True,
                 'Solen är så stor att mer än hundra jordklot skulle få plats på en rad tvärs över den.'),
            val('Vilken himlakropp går runt jorden?', ['Månen', 'Solen', 'Mars'], 'Månen',
                'Månen går runt jorden. Jorden går i sin tur runt solen, och det gör Mars också.'),
        ], beskrivning='Dag och natt, månens faser och hur jorden, månen och solen rör sig.'),
    ]),
]
