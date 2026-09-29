# -*- coding: utf-8 -*-
"""SO åk 4, 6, 7 och 9: historia, geografi, samhällskunskap och
religionskunskap ur Lgr22:s centrala innehåll för årskursen.

Bara fasta fakta: historiska årtal, grundlagarna, riksdagens 349 platser,
kartans regler. Inget som ändras med en regering eller ett budgetår
(vem som styr, momssatser, befolkningssiffror i dag), för en fråga som
blir fel av sig själv lär barnet något som inte stämmer.

Ordningsfrågorna om tid räknas ur årtalen: händelserna står med sitt år,
sorteras här, och två händelser samma år hade gett två rätta ordningar,
så det prövas. Räknefrågornas facit räknas också här, med assert mot de
vanligaste felräkningarna.

Lästexterna är skrivna för banken. De är påhittade berättelser i en
verklig miljö, och frågorna gäller bara det som står i texten.
"""
from fractions import Fraction as F

from grund import bana, niva, val, skriv, ordna, sant, para, tal


def tidslinje(fraga, handelser, med_ar=True, forklaring=None):
    """En ordna-fråga ur (år, händelse). Ordningen räknas ur åren, så att
    en händelse som flyttas i listan inte kan göra facit fel."""
    ar = [a for a, _ in handelser]
    assert len(set(ar)) == len(ar), 'två händelser samma år ger två rätta ordningar'
    ordnade = sorted(handelser)
    brickor = [('%d: %s' % (a, h)) if med_ar else h for a, h in ordnade]
    return ordna(fraga, brickor, forklaring=forklaring)


def majoritet(antal):
    """Minsta antal röster som är mer än hälften."""
    return antal // 2 + 1


# Sveriges landskap per landsdel. Antalet i frågan räknas ur listan.
LANDSKAP = {
    'Götaland': ['Skåne', 'Blekinge', 'Halland', 'Småland', 'Öland', 'Gotland',
                 'Östergötland', 'Västergötland', 'Bohuslän', 'Dalsland'],
    'Svealand': ['Uppland', 'Södermanland', 'Västmanland', 'Närke', 'Värmland', 'Dalarna'],
    'Norrland': ['Gästrikland', 'Hälsingland', 'Härjedalen', 'Jämtland', 'Medelpad',
                 'Ångermanland', 'Västerbotten', 'Norrbotten', 'Lappland'],
}
ANTAL_LANDSKAP = sum(len(v) for v in LANDSKAP.values())
assert ANTAL_LANDSKAP == 25

# Kartans skala: 1 cm på kartan är SKALA cm i verkligheten.
SKALA = 100000
KARTA_CM = 5
KARTA_KM = F(KARTA_CM * SKALA, 100 * 1000)
assert KARTA_KM == 5 and KARTA_KM not in (50, 500, F(1, 2))

# Klassrådet i åk 4.
KLASS = 27
assert majoritet(KLASS) == 14 and majoritet(KLASS) != KLASS // 2

# Riksdagen.
RIKSDAG = 349
assert majoritet(RIKSDAG) == 175

# Årskillnader.
KALMAR, BLODBAD = 1397, 1520
STORMAKT_FRAN, STORMAKT_TILL = 1611, 1718
ROSTRATT_MAN, ROSTRATT_KVINNOR = 1909, 1921

# Befolkning, åk 7.
BEF_INV, BEF_KM2 = 12000, 250
BEF_TATHET = F(BEF_INV, BEF_KM2)
assert BEF_TATHET == 48 and BEF_TATHET not in (F(BEF_KM2, BEF_INV), BEF_INV - BEF_KM2)
FODDA, DODA = 420, 310
STAD_FORE, STAD_EFTER = 40000, 50000
STAD_PROCENT = F(STAD_EFTER - STAD_FORE, STAD_FORE) * 100
# Den vanliga felräkningen är att dela med det nya talet (20 %).
assert STAD_PROCENT == 25 and F(STAD_EFTER - STAD_FORE, STAD_EFTER) * 100 != STAD_PROCENT

# Privatekonomi, åk 9.
VARA_PRIS, VARA_OKNING = 200, 5
VARA_NY = VARA_PRIS * F(100 + VARA_OKNING, 100)
assert VARA_NY == 210
SPAR, SPAR_RANTA = 10000, 3
RANTA_1 = SPAR * F(SPAR_RANTA, 100)
KONTO_2 = SPAR * F(100 + SPAR_RANTA, 100) ** 2
# Ränta på ränta: utan den hade det blivit 10 600.
assert RANTA_1 == 300 and KONTO_2 == 10609 and KONTO_2 != SPAR + 2 * RANTA_1
LON, MAT, MOBIL = 2400, 950, 600
SPARAR = LON - MAT - MOBIL
assert SPARAR == 850
LAN, LAN_RANTA = 5000, 20
LAN_KOSTNAD = LAN * F(LAN_RANTA, 100)
assert LAN_KOSTNAD == 1000


def t(x):
    x = F(x)
    assert x.denominator == 1
    return tal(int(x))


RUNSTENEN = (
    'Ella och hennes morfar går längs ån en söndag i oktober. Vid en gammal bro står en grå sten, '
    'nästan lika hög som morfar. Ytan är full av slingor, och inne i slingorna finns små streck.\n'
    '– Det är runor, säger morfar. Stenen restes för ungefär tusen år sedan.\n'
    'På skylten bredvid står vad runorna betyder: ”Tora lät resa denna sten efter Sven, sin man. '
    'Han dog i öster.”\n'
    '– Varför skrev de på stenar? frågar Ella.\n'
    '– Det fanns inget papper här då, säger morfar. En sten står kvar i tusen år. Den visade alla '
    'som gick förbi att Sven hade levt, och att Tora hade råd att betala en runristare.\n'
    'Ella tittar på slingan. Den är formad som en orm, och i mitten finns ett kors.\n'
    '– Då var de kristna? frågar hon.\n'
    '– Tora var nog det, säger morfar. Korset visar det. Men många i trakten trodde fortfarande '
    'på de gamla gudarna.\n'
    'Ella tar ett foto av stenen. Hemma ska hon försöka skriva sitt eget namn med runor.'
)

VISBY = (
    'Nils är tolv år och har just börjat som dräng hos köpmannen Hinrik i Visby. Hinrik kommer '
    'från Lübeck och talar tyska med de andra köpmännen i hamnen. Nils förstår inte mycket än, '
    'men han lär sig ett nytt ord varje dag.\n'
    'På morgonen bär Nils säckar med salt från ett skepp upp till Hinriks stenhus. Saltet ska '
    'säljas till bönderna, som behöver det för att maten ska hålla över vintern. I källaren '
    'ligger redan buntar med pälsar från Novgorod och tunnor med tjära.\n'
    '– Allt som kommer över havet går genom Visby, säger Hinrik stolt.\n'
    'Runt staden står en hög mur av sten. Bönderna från landsbygden får bara komma in genom '
    'portarna, och många av dem tycker att köpmännen i staden har blivit för rika.\n'
    'På kvällen får Nils äta i köket. Maten är bättre än hemma på gården, men han saknar sin mor. '
    'Han har lovat att skicka hem en silverpenning när han fått sin första lön.'
)

PLANBOKEN = (
    'Det är fredag eftermiddag och Moa och Liam går hem från skolan. Vid busshållplatsen ligger '
    'en brun plånbok i snön. Liam plockar upp den. I den finns ett busskort, ett foto av en hund '
    'och sexhundra kronor.\n'
    '– Vi delar, säger Liam och skrattar. Ingen ser.\n'
    'Moa skakar på huvudet.\n'
    '– Tänk om det var du som hade tappat den, säger hon. Då skulle du vilja få tillbaka den.\n'
    '– Men pengarna gör mer nytta hos oss än hos någon som har så mycket att hen tappar '
    'sexhundra kronor, säger Liam.\n'
    '– Det vet du inte, säger Moa. Det kan vara någons matpengar för hela veckan.\n'
    'Liam tittar på fotot av hunden. Han tänker på hur det skulle kännas om någon behöll hans '
    'egna pengar.\n'
    '– Okej, säger han till slut. Vi lämnar den till polisen. Då vet vi att vi har gjort rätt, '
    'vad som än händer sedan.\n'
    '– Och om ägaren ger oss hittelön, säger Moa, så delar vi den.'
)

BREVET = (
    'Kära mor och far!\n'
    'Nu har jag varit i Amerika i nästan ett år, och äntligen skriver jag som jag lovade. Resan '
    'tog lång tid. Från Göteborg for vi till England, och därifrån tog vi den stora ångbåten över '
    'Atlanten. Det var trångt under däck, och många var sjösjuka i flera dagar. Lilla Anna i '
    'familjen bredvid oss blev så sjuk att vi var rädda för henne, men hon klarade sig.\n'
    'Nu arbetar jag på en gård i Minnesota hos en familj från Värmland. Här talar nästan alla '
    'svenska, och i kyrkan på söndagarna känns det nästan som hemma. Jorden är svart och bördig, '
    'inte stenig som hemma.\n'
    'Lönen är bättre än jag någonsin fått i Sverige. Jag skickar med tjugo dollar i brevet. '
    'Använd dem till att betala skulden till handlaren, så att ni slipper oroa er i vinter.\n'
    'Men jag saknar er. Här finns inga berg och ingen sjö som vår. När jag har sparat nog vill jag '
    'köpa egen jord, och då vill jag att Erik och Hilma kommer efter mig.\n'
    'Er son Johan'
)


BANOR = [
    # ------------------------------------------------------------------ åk 4
    bana('SO / Historia / Samhällskunskap', 'ak4', [
        niva('so-ak4-kartan-1', 'Landsdelar och landskap', 'Sveriges landskap och kartan', [
            val('Vilka är Sveriges tre landsdelar?',
                ['Götaland, Svealand och Norrland', 'Skåne, Småland och Lappland',
                 'Norrland, Mälardalen och Västkusten', 'Götaland, Gotland och Norrland'],
                'Götaland, Svealand och Norrland',
                'Sverige delas i tre landsdelar: Götaland i söder, Svealand i mitten och Norrland i norr. '
                'Skåne och Lappland är landskap, inte landsdelar.'),
            skriv('Hur många landskap har Sverige? Svara med ett tal.', t(ANTAL_LANDSKAP),
                  'Sverige har %d landskap: %d i Götaland, %d i Svealand och %d i Norrland.'
                  % (ANTAL_LANDSKAP, len(LANDSKAP['Götaland']), len(LANDSKAP['Svealand']),
                     len(LANDSKAP['Norrland']))),
            val('I vilken landsdel ligger Skåne?', ['Götaland', 'Svealand', 'Norrland'], 'Götaland',
                'Skåne är Sveriges sydligaste landskap och ligger i Götaland.'),
            val('I vilken landsdel ligger Dalarna?', ['Svealand', 'Götaland', 'Norrland'], 'Svealand',
                'Dalarna ligger i Svealand, tillsammans med bland annat Uppland och Värmland.'),
            para('Para ihop namnet med det det är känt för.',
                 [('Gotland', 'Sveriges största ö'), ('Vänern', 'Sveriges största sjö'),
                  ('Kebnekaise', 'Sveriges högsta berg'), ('Stockholm', 'Sveriges huvudstad')],
                 'Gotland är den största ön, Vänern den största sjön och Kebnekaise i Lappland det högsta '
                 'berget. Stockholm är huvudstad.'),
            sant('Lappland är Sveriges största landskap.', True,
                 'Lappland är störst till ytan. Det tar upp en stor del av norra Sverige.'),
            sant('Sverige har gräns på land mot Norge och Finland.', True,
                 'Norge ligger i väster och Finland i nordost. Till Danmark går en bro över Öresund, '
                 'men där är det hav emellan.'),
            val('Vilket hav ligger öster om Sverige?',
                ['Östersjön', 'Nordsjön', 'Atlanten', 'Medelhavet'], 'Östersjön',
                'Östersjön ligger mellan Sverige och Finland, Baltikum, Polen och Tyskland.'),
            ordna('Ordna landsdelarna från söder till norr.', ['Götaland', 'Svealand', 'Norrland'],
                  forklaring='Götaland ligger längst söderut, sedan kommer Svealand och längst norrut Norrland.'),
        ], beskrivning='Sveriges landsdelar och landskap, och några rekord på kartan.'),

        niva('so-ak4-kartan-2', 'Kartan och väderstrecken', 'Sveriges landskap och kartan', [
            val('Åt vilket håll är norr på de flesta kartor?',
                ['Uppåt', 'Nedåt', 'Åt vänster', 'Åt höger'], 'Uppåt',
                'De flesta kartor ritas med norr uppåt. Då är söder nedåt, öster till höger och väster till vänster.'),
            val('Vilket väderstreck är motsatsen till norr?', ['Söder', 'Öster', 'Väster'], 'Söder',
                'Norr och söder står mittemot varandra, precis som öster och väster.'),
            val('Du står med ansiktet mot norr. Åt vilket håll ligger öster?',
                ['Till höger', 'Till vänster', 'Bakom dig', 'Framför dig'], 'Till höger',
                'Tänk på kartan: med norr uppåt ligger öster till höger.'),
            val('Vilket väderstreck ligger mellan norr och öster?',
                ['Nordost', 'Nordväst', 'Sydost', 'Sydväst'], 'Nordost',
                'Mellan norr och öster ligger nordost. Namnet sätts ihop av de två väderstrecken.'),
            val('Vad visar teckenförklaringen på en karta?',
                ['Vad kartans färger och tecken betyder', 'Hur långt det är mellan två städer',
                 'Vilket år kartan ritades', 'Åt vilket håll vinden blåser'],
                'Vad kartans färger och tecken betyder',
                'Teckenförklaringen säger till exempel att en blå linje är en å och en svart prick en stad.'),
            val('Vad visar skalan på en karta?',
                ['Hur mycket verkligheten är förminskad', 'Hur högt ett berg är',
                 'Var norr ligger', 'Hur många som bor på platsen'],
                'Hur mycket verkligheten är förminskad',
                'Med skalan kan man räkna ut hur långt det är i verkligheten.'),
            skriv('En karta har skalan 1:100 000. Då är 1 cm på kartan 1 km i verkligheten. '
                  'Hur många km är %d cm på kartan?' % KARTA_CM, t(KARTA_KM),
                  '1 cm är 1 km, så %d cm är %s km.' % (KARTA_CM, t(KARTA_KM))),
            sant('Solen går upp ungefär i öster och ner ungefär i väster.', True,
                 'Jorden snurrar mot öster, och därför ser vi solen stiga i öster och gå ner i väster.'),
            ordna('Ordna väderstrecken medsols, som klockans visare, med början i norr.',
                  ['Norr', 'Öster', 'Söder', 'Väster'],
                  forklaring='Med norr uppåt går klockans visare från norr till öster, sedan söder och väster.'),
        ], beskrivning='Väderstreck, skala och teckenförklaring.'),

        niva('so-ak4-vikingatiden-1', 'Vikingarnas liv', 'Vikingatiden', [
            val('Ungefär när var vikingatiden?',
                ['År 800–1050', 'År 500–700', 'År 1200–1500', 'År 1600–1700'], 'År 800–1050',
                'Vikingatiden brukar räknas från omkring år 800 till omkring 1050. Sedan kom medeltiden.'),
            val('Vad kallas vikingarnas skrivtecken?', ['Runor', 'Hieroglyfer', 'Kilskrift', 'Noter'],
                'Runor',
                'Vikingarna skrev med runor. De ristades i sten, trä och ben.'),
            val('Vad är en runsten?',
                ['En sten med inristade runor, ofta till minne av någon',
                 'En sten som vikingarna använde som pengar',
                 'En sten som markerade gränsen mellan två länder',
                 'En sten som man slipade vapen på'],
                'En sten med inristade runor, ofta till minne av någon',
                'Många runstenar restes efter en död släkting och berättar vem som lät resa stenen.'),
            para('Para ihop gruppen med vem de var.',
                 [('Jarl', 'rik och mäktig hövding'), ('Karl', 'fri bonde'),
                  ('Träl', 'ofri, ägdes av någon annan')],
                 'Samhället hade jarlar överst, fria bönder som kallades karlar, och trälar som inte var fria.'),
            val('Vad var tinget?',
                ['En samling där fria män löste tvister och fattade beslut',
                 'Vikingarnas största skepp', 'Ett tempel för asagudarna', 'En marknad för trälar'],
                'En samling där fria män löste tvister och fattade beslut',
                'På tinget samlades de fria männen för att döma i tvister och bestämma om sådant som gällde alla.'),
            sant('Alla vikingar var sjörövare som bara plundrade.', False,
                 'De flesta var bönder. Många var också handelsmän och hantverkare. Bara en del gav sig ut och plundrade.'),
            val('Vad hette handelsstaden på Björkö i Mälaren?', ['Birka', 'Visby', 'Uppsala', 'Kalmar'],
                'Birka',
                'Birka var en viktig handelsplats under vikingatiden. Där bytte man varor från många länder.'),
            val('Vad kallade vikingarna staden Konstantinopel, dit många reste österut?',
                ['Miklagård', 'Midgård', 'Asgård', 'Utgård'], 'Miklagård',
                'Miklagård betyder ungefär den stora staden. Midgård, Asgård och Utgård är världar i asatron.'),
            val('Varför var skeppen så viktiga för vikingarna?',
                ['De reste, handlade och krigade över hav och längs floder',
                 'De bodde i skeppen året runt', 'De byggde skepp bara för att offra dem',
                 'Det fanns inga vägar alls i Norden'],
                'De reste, handlade och krigade över hav och längs floder',
                'Med skeppen kunde vikingarna ta sig långt: västerut över havet och österut längs floderna.'),
        ], beskrivning='Hur vikingarna levde, skrev och reste.'),

        niva('so-ak4-vikingatiden-2', 'Asagudar och kristendomen', 'Vikingatiden', [
            para('Para ihop guden med det den var känd för.',
                 [('Tor', 'åskans gud med hammaren Mjölner'), ('Oden', 'den högste guden, hade bara ett öga'),
                  ('Frej', 'gud för växtlighet och goda skördar'), ('Freja', 'gudinna för kärlek')],
                 'Tor slog med sin hammare, Oden gav ett öga för visdom, Frej gav goda skördar och Freja '
                 'var kärlekens gudinna.'),
            val('Vad hette gudarnas värld i asatron?', ['Asgård', 'Midgård', 'Miklagård', 'Birka'],
                'Asgård', 'Asarna bodde i Asgård. Människorna bodde i Midgård.'),
            val('Vad hette människornas värld i asatron?', ['Midgård', 'Asgård', 'Valhall', 'Utgård'],
                'Midgård', 'Midgård betyder ungefär gården i mitten. Där bodde människorna.'),
            val('Vart kom den som dog i strid, enligt asatron?', ['Till Valhall', 'Till Birka',
                                                                  'Till Midgård', 'Till Uppsala'],
                'Till Valhall', 'Valhall var Odens hall. Dit kom krigare som dött i strid.'),
            val('Vad hette munken som kom till Birka omkring år 830 för att sprida kristendomen?',
                ['Ansgar', 'Birger', 'Olof', 'Erik'], 'Ansgar',
                'Ansgar var en munk som skickades från det frankiska riket. Han var en av de första som predikade '
                'kristendomen i Sverige.'),
            sant('Kristendomen ersatte asatron i Sverige på en enda dag.', False,
                 'Det tog flera hundra år. Under lång tid fanns både kristna och de som trodde på asagudarna.'),
            val('Vilken tid kom efter vikingatiden i Sverige?',
                ['Medeltiden', 'Stenåldern', 'Bronsåldern', 'Stormaktstiden'], 'Medeltiden',
                'Efter vikingatiden, omkring år 1050, börjar medeltiden.'),
            ordna('Ordna tiderna från äldst till yngst.',
                  ['Stenåldern', 'Bronsåldern', 'Vikingatiden', 'Medeltiden'],
                  forklaring='Först använde människor redskap av sten, sedan brons och därefter järn. '
                             'Vikingatiden är slutet av järnåldern, och sedan kom medeltiden.'),
        ], beskrivning='Asatrons gudar och världar, och hur kristendomen kom.'),

        niva('so-ak4-vikingatiden-3', 'Runstenen vid ån', 'Vikingatiden', [
            val('Vem lät resa stenen?', ['Tora', 'Sven', 'Ella', 'Morfar'], 'Tora',
                'Runorna säger: ”Tora lät resa denna sten efter Sven, sin man.”'),
            val('Vem var Sven?', ['Toras man', 'Toras son', 'Runristaren', 'Ellas morfar'], 'Toras man',
                'Stenen restes ”efter Sven, sin man”, alltså Toras man.'),
            val('Var dog Sven, enligt stenen?', ['I öster', 'I väster', 'Hemma vid ån', 'Till sjöss'],
                'I öster', 'Det står sist på stenen: ”Han dog i öster.”'),
            val('Varför skrev man på stenar, enligt morfar?',
                ['Det fanns inget papper, och en sten står kvar länge', 'Stenar var billigast',
                 'Det var förbjudet att skriva på trä', 'Man ville att stenen skulle skydda bron'],
                'Det fanns inget papper, och en sten står kvar länge',
                'Morfar säger att det inte fanns något papper och att en sten står kvar i tusen år.'),
            val('Vad visar stenen mer än att Sven hade levt, enligt morfar?',
                ['Att Tora hade råd att betala en runristare', 'Att Sven var kung',
                 'Att bron var gammal', 'Att Tora kunde skriva själv'],
                'Att Tora hade råd att betala en runristare',
                'Morfar säger att stenen visade att Tora hade råd att betala en runristare. Det kostade pengar.'),
            val('Vad får morfar att tro att Tora var kristen?', ['Korset i mitten', 'Ormen i slingan',
                                                                 'Att stenen står vid en bro',
                                                                 'Att Sven dog i öster'],
                'Korset i mitten', 'Morfar säger: ”Korset visar det.”'),
            sant('Enligt morfar var alla i trakten kristna när stenen restes.', False,
                 'Morfar säger att många i trakten fortfarande trodde på de gamla gudarna.'),
            val('Vad ska Ella göra hemma?', ['Skriva sitt namn med runor', 'Rita en karta över ån',
                                              'Läsa om Sven', 'Resa en egen sten'],
                'Skriva sitt namn med runor', 'Sista meningen säger att hon ska försöka skriva sitt eget namn med runor.'),
        ], beskrivning='En berättelse om en runsten. Läs texten och svara på frågorna.',
            text=RUNSTENEN),

        niva('so-ak4-religioner-1', 'Kristendomen', 'Religioner i Sverige', [
            val('Vad heter kristendomens heliga bok?', ['Bibeln', 'Koranen', 'Toran', 'Vedaskrifterna'],
                'Bibeln', 'Bibeln är kristendomens heliga skrift. Koranen hör till islam och Toran till judendomen.'),
            para('Para ihop högtiden med vad kristna minns då.',
                 [('Jul', 'Jesus föds'), ('Påsk', 'Jesus dör och uppstår'),
                  ('Kristi himmelsfärd', 'Jesus far upp till himlen'),
                  ('Pingst', 'den heliga anden kommer till lärjungarna')],
                 'Kyrkoåret följer Jesu liv: födelsen på julen, döden och uppståndelsen på påsken, '
                 'himmelsfärden och sedan pingsten.'),
            val('I vilken stad föddes Jesus, enligt Bibeln?', ['Betlehem', 'Jerusalem', 'Nasaret', 'Rom'],
                'Betlehem', 'Jesus föddes i Betlehem men växte upp i Nasaret, enligt Bibeln.'),
            val('Vad kallas byggnaden där kristna har gudstjänst?', ['Kyrka', 'Moské', 'Synagoga', 'Tempel'],
                'Kyrka', 'Kristna samlas i en kyrka. Muslimer har moskéer och judar synagogor.'),
            sant('Bibeln består av två delar: Gamla testamentet och Nya testamentet.', True,
                 'Gamla testamentet är skrivet före Jesus. Nya testamentet berättar om Jesus och de första kristna.'),
            val('Vilken dag i veckan har de flesta kyrkor i Sverige gudstjänst?',
                ['Söndag', 'Fredag', 'Lördag', 'Onsdag'], 'Söndag',
                'Kristna firar gudstjänst på söndagen, för att Jesus enligt Bibeln uppstod på en söndag.'),
            skriv('Vad heter den bön som börjar ”Fader vår, som är i himmelen”?',
                  ['Fader vår', 'Fadervår', 'Herrens bön', 'Fader vår-bönen'],
                  'Bönen kallas Fader vår, eller Herrens bön, för att Jesus enligt Bibeln lärde lärjungarna den.'),
            val('Vad kallas de tolv som följde Jesus?', ['Lärjungarna', 'Profeterna', 'Kungarna', 'Munkarna'],
                'Lärjungarna', 'Jesus samlade tolv lärjungar som följde honom och lärde sig av honom.'),
        ], beskrivning='Kristendomens bok, högtider och byggnader.'),

        niva('so-ak4-religioner-2', 'Judendom och islam', 'Religioner i Sverige', [
            val('Vad heter judendomens viktigaste heliga skrift?', ['Toran', 'Koranen', 'Bibeln', 'Psalmboken'],
                'Toran', 'Toran är de fem Moseböckerna. Den läses i synagogan från en handskriven rulle.'),
            val('Vad heter islams heliga bok?', ['Koranen', 'Toran', 'Bibeln', 'Talmud'], 'Koranen',
                'Koranen är islams heliga bok. Den är skriven på arabiska.'),
            para('Para ihop religionen med dess byggnad för gudstjänst.',
                 [('Kristendom', 'Kyrka'), ('Judendom', 'Synagoga'), ('Islam', 'Moské')],
                 'Kristna samlas i kyrkan, judar i synagogan och muslimer i moskén.'),
            val('Vad heter judendomens vilodag?', ['Sabbat', 'Ramadan', 'Pesach', 'Advent'], 'Sabbat',
                'Sabbaten börjar på fredag kväll och slutar på lördag kväll. Då vilar man från arbete.'),
            val('Vilken profet tog emot Koranen, enligt islam?', ['Muhammed', 'Mose', 'Abraham', 'Jesus'],
                'Muhammed', 'Enligt islam fick Muhammed Koranens ord från Gud genom ängeln Gabriel.'),
            val('Vad kallas fastemånaden i islam?', ['Ramadan', 'Sabbat', 'Chanukka', 'Pingst'], 'Ramadan',
                'Under ramadan äter och dricker många muslimer inte från gryning till solnedgång.'),
            sant('Judendom, kristendom och islam ser alla Abraham som en viktig stamfar.', True,
                 'Därför kallas de ibland de abrahamitiska religionerna.'),
            val('Vilken judisk högtid minns uttåget ur Egypten?',
                ['Pesach', 'Chanukka', 'Jom kippur', 'Sabbat'], 'Pesach',
                'På pesach minns judar hur Mose ledde folket ut ur slaveriet i Egypten.'),
        ], beskrivning='Judendomens och islams böcker, byggnader och högtider.'),

        niva('so-ak4-demokrati-1', 'Vad är demokrati?', 'Demokrati i vardagen', [
            val('Vad betyder ordet demokrati?', ['Folkstyre', 'Kungastyre', 'Kyrkostyre', 'Krigsstyre'],
                'Folkstyre', 'Demokrati kommer från grekiskan och betyder folkstyre: folket bestämmer.'),
            skriv('Klassen har %d elever och alla röstar. Hur många röster behövs minst för att få '
                  'mer än hälften?' % KLASS, t(majoritet(KLASS)),
                  'Hälften av %d är %s. Mer än hälften är %d röster.' % (KLASS, tal(KLASS / 2), majoritet(KLASS))),
            val('14 elever röstar för en utflykt till skogen och 11 för ett museum. Vad blir det om '
                'majoriteten bestämmer?', ['Skogen', 'Museet', 'Ingenting', 'Båda'], 'Skogen',
                'Majoriteten är de som är flest. 14 är fler än 11, så det blir skogen.'),
            val('Vad kallas det när det förslag som får flest röster gäller?',
                ['Majoritetsbeslut', 'Diktatur', 'Monarki', 'Lottning'], 'Majoritetsbeslut',
                'Ett majoritetsbeslut betyder att det som flest röstar för blir beslutet.'),
            val('Vad gör man på ett klassråd?',
                ['Eleverna diskuterar och bestämmer om saker i klassen',
                 'Lärarna sätter betyg', 'Rektorn delar ut straff', 'Föräldrarna väljer ny rektor'],
                'Eleverna diskuterar och bestämmer om saker i klassen',
                'På klassrådet får eleverna säga vad de tycker och vara med och bestämma. Det är demokrati i skolan.'),
            val('Hur gammal måste man vara för att få rösta i riksdagsvalet i Sverige?',
                ['18 år', '15 år', '16 år', '21 år'], '18 år',
                'Man får rösta i riksdagsvalet om man har fyllt 18 år senast på valdagen och är svensk medborgare.'),
            sant('I ett demokratiskt val är rösten hemlig, så ingen kan se vad du röstar på.', True,
                 'Valhemligheten gör att ingen kan tvinga dig eller straffa dig för hur du röstar.'),
            sant('I en diktatur kan folket välja bort ledaren i fria val.', False,
                 'I en diktatur finns inga fria val. Ledaren sitter kvar oavsett vad folket tycker.'),
            sant('I en demokrati får man tycka något annat än de som bestämmer och säga det.', True,
                 'Det kallas yttrandefrihet och är en av demokratins grunder.'),
        ], beskrivning='Demokrati, omröstningar och majoritet.'),

        niva('so-ak4-demokrati-2', 'Rättigheter och samhället', 'Demokrati i vardagen', [
            val('Vad heter FN:s överenskommelse om barns rättigheter?',
                ['Barnkonventionen', 'Grundlagen', 'Skollagen', 'Allemansrätten'], 'Barnkonventionen',
                'Barnkonventionen säger vilka rättigheter alla barn har, till exempel rätt att gå i skolan.'),
            val('Upp till vilken ålder räknas man som barn enligt barnkonventionen?',
                ['Tills man fyller 18', 'Tills man fyller 12', 'Tills man fyller 15', 'Tills man fyller 21'],
                'Tills man fyller 18', 'Alla under 18 år räknas som barn i barnkonventionen.'),
            sant('Barnkonventionen är lag i Sverige.', True,
                 'Sedan år 2020 är barnkonventionen svensk lag.'),
            para('Para ihop vem som sköter vad.',
                 [('Kommunen', 'skolan och fritidshemmet'), ('Regionen', 'sjukhusen'),
                  ('Riksdagen', 'Sveriges lagar')],
                 'Kommunen sköter det som finns nära dig, som skolan. Regionen sköter sjukvården, '
                 'och riksdagen bestämmer lagarna för hela landet.'),
            val('Vilket folk är Sveriges urfolk?', ['Samerna', 'Vikingarna', 'Tornedalingarna', 'Romerna'],
                'Samerna', 'Samerna bodde i norra Skandinavien långt innan gränserna drogs. Därför är de ett urfolk.'),
            val('Hur många nationella minoriteter har Sverige?', ['5', '3', '7', '10'], '5',
                'De fem är judar, romer, samer, sverigefinnar och tornedalingar.'),
            sant('Skatten vi betalar används bland annat till skolor, vägar och sjukvård.', True,
                 'Skatten är pengar som alla bidrar med, så att sådant alla behöver kan finnas.'),
            val('Vad är skillnaden mellan en regel och en lag?',
                ['En lag gäller i hela landet och bestäms av riksdagen',
                 'En regel gäller alltid och en lag bara ibland',
                 'En lag bestäms av rektorn och en regel av riksdagen',
                 'Det är ingen skillnad'],
                'En lag gäller i hela landet och bestäms av riksdagen',
                'En regel kan gälla i en skola eller ett lag. En lag bestäms av riksdagen och gäller alla i landet.'),
        ], beskrivning='Barns rättigheter, vem som sköter vad och Sveriges minoriteter.'),
    ]),

    # ------------------------------------------------------------------ åk 6
    bana('SO / Historia / Samhällskunskap', 'ak6', [
        niva('so-ak6-medeltiden-1', 'Livet på medeltiden', 'Medeltiden', [
            val('Ungefär när var medeltiden i Sverige?',
                ['1050–1520', '800–1050', '1520–1611', '1611–1718'], '1050–1520',
                'Medeltiden börjar när vikingatiden slutar, omkring 1050, och brukar räknas till omkring 1520.'),
            para('Para ihop ståndet med vad det gjorde.',
                 [('Adeln', 'slapp skatt mot att ställa upp i krig'),
                  ('Prästerna', 'skötte kyrkan och gudstjänsterna'),
                  ('Borgarna', 'handlade och hantverkade i städerna'),
                  ('Bönderna', 'odlade jorden')],
                 'Samhället var delat i fyra stånd. Var och en hade sina uppgifter och rättigheter.'),
            val('Vilket stånd var störst?', ['Bönderna', 'Adeln', 'Prästerna', 'Borgarna'], 'Bönderna',
                'Nästan alla bodde på landet och odlade jorden. Städerna var små.'),
            val('Vad var Hansan?',
                ['Ett förbund av tyska handelsstäder', 'En svensk kung', 'Ett kloster i Vadstena',
                 'En pest som spreds med råttor'],
                'Ett förbund av tyska handelsstäder',
                'Hansan var ett förbund av handelsstäder, med Lübeck som den viktigaste. Den styrde mycket av '
                'handeln på Östersjön.'),
            val('Vilken stad på Gotland var viktig för handeln på medeltiden?',
                ['Visby', 'Kalmar', 'Birka', 'Lund'], 'Visby',
                'Visby var en rik handelsstad. Ringmuren runt staden står kvar än i dag.'),
            val('Vad var digerdöden?',
                ['En pest som dödade en stor del av befolkningen', 'Ett krig mot Danmark',
                 'En hungersnöd efter en kall vinter', 'Ett uppror mot kungen'],
                'En pest som dödade en stor del av befolkningen',
                'Digerdöden var pest. Den spreds över Europa, och på många ställen dog en tredjedel av invånarna '
                'eller fler.'),
            sant('Digerdöden nådde Sverige omkring år 1350.', True,
                 'Pesten kom till Norden 1349 och till Sverige omkring 1350.'),
            val('Vad heter den svenska kvinnan som grundade en klosterorden i Vadstena och blev helgon?',
                ['Birgitta', 'Margareta', 'Kristina', 'Ingrid'], 'Birgitta',
                'Heliga Birgitta levde på 1300-talet. Hennes kloster i Vadstena blev känt i hela Europa.'),
        ], beskrivning='Stånden, handeln och pesten.'),

        niva('so-ak6-medeltiden-2', 'Kungar och unionen', 'Medeltiden', [
            tidslinje('Ordna händelserna i tidsordning, från äldst till yngst.',
                      [(1252, 'Stockholm nämns första gången'), (1350, 'Digerdöden når Sverige'),
                       (1397, 'Kalmarunionen bildas'), (1520, 'Stockholms blodbad'),
                       (1523, 'Gustav Vasa väljs till kung')],
                      forklaring='Titta på årtalen: det lägsta är äldst. Stockholm nämns 1252, pesten kommer 1350, '
                                 'unionen bildas 1397, blodbadet sker 1520 och Gustav Vasa väljs 1523.'),
            val('Vem brukar räknas som Stockholms grundare?',
                ['Birger jarl', 'Gustav Vasa', 'Magnus Ladulås', 'Kristian II'], 'Birger jarl',
                'Stockholm nämns första gången 1252, i ett brev från Birger jarl.'),
            val('Vilken drottning samlade de nordiska länderna i Kalmarunionen?',
                ['Margareta', 'Birgitta', 'Kristina', 'Ulrika Eleonora'], 'Margareta',
                'Drottning Margareta styrde Danmark, Norge och Sverige, och 1397 bildades unionen i Kalmar.'),
            val('Vilka riken ingick i Kalmarunionen?',
                ['Danmark, Norge och Sverige', 'Sverige, Finland och Ryssland',
                 'Danmark, Tyskland och Sverige', 'Norge, Polen och Sverige'],
                'Danmark, Norge och Sverige',
                'Kalmarunionen var en union mellan Danmark, Norge och Sverige. Finland var då en del av Sverige.'),
            val('Vilken kung lät avrätta många svenska adelsmän och präster vid Stockholms blodbad 1520?',
                ['Kristian II', 'Gustav Vasa', 'Birger jarl', 'Magnus Ladulås'], 'Kristian II',
                'Den danske kungen Kristian II lät avrätta sina motståndare. I Sverige kallades han Kristian tyrann.'),
            skriv('Vilket år valdes Gustav Vasa till kung?', t(1523),
                  'Gustav Vasa valdes till kung den 6 juni 1523. Därför är 6 juni Sveriges nationaldag.'),
            skriv('Hur många år gick det från Kalmarunionen (%d) till Stockholms blodbad (%d)?'
                  % (KALMAR, BLODBAD), t(BLODBAD - KALMAR),
                  '%d − %d = %d år.' % (BLODBAD, KALMAR, BLODBAD - KALMAR)),
            sant('Efter att Gustav Vasa blev kung lämnade Sverige Kalmarunionen.', True,
                 'Med Gustav Vasa som kung styrde Sverige sig självt igen, och unionen var slut för Sveriges del.'),
        ], beskrivning='Stockholm, Kalmarunionen och Gustav Vasa, i tidsordning.'),

        niva('so-ak6-medeltiden-3', 'Nils i Visby', 'Medeltiden', [
            val('Varifrån kommer köpmannen Hinrik?', ['Lübeck', 'Novgorod', 'Stockholm', 'Gotlands landsbygd'],
                'Lübeck', 'Det står i början: Hinrik kommer från Lübeck och talar tyska.'),
            val('Varför behöver bönderna salt, enligt texten?',
                ['För att maten ska hålla över vintern', 'För att salta vägarna',
                 'För att betala skatt', 'För att göra tjära'],
                'För att maten ska hålla över vintern',
                'Texten säger att bönderna behöver saltet för att maten ska hålla över vintern.'),
            val('Vad låg redan i Hinriks källare?',
                ['Pälsar och tjära', 'Salt och silver', 'Vin och kryddor', 'Säd och fisk'], 'Pälsar och tjära',
                'I källaren ligger buntar med pälsar från Novgorod och tunnor med tjära.'),
            val('Vad menar Hinrik med att ”allt som kommer över havet går genom Visby”?',
                ['Visby är en viktig handelsstad', 'Visby ligger mitt i havet',
                 'Alla skepp måste betala skatt till honom', 'Havet är farligt'],
                'Visby är en viktig handelsstad',
                'Han är stolt över att varor från många håll handlas i Visby.'),
            val('Varför är många bönder missnöjda?',
                ['De tycker att köpmännen har blivit för rika', 'De får inte köpa salt',
                 'Muren har rasat', 'Nils har tagit deras jobb'],
                'De tycker att köpmännen har blivit för rika',
                'Texten säger att många bönder tycker att köpmännen i staden har blivit för rika.'),
            sant('Nils förstår redan allt köpmännen säger på tyska.', False,
                 'Nils förstår inte mycket än, men lär sig ett nytt ord varje dag.'),
            val('Vad har Nils lovat sin mor?',
                ['Att skicka hem en silverpenning', 'Att komma hem till jul', 'Att lära sig läsa',
                 'Att bli köpman'],
                'Att skicka hem en silverpenning',
                'Han har lovat att skicka hem en silverpenning när han fått sin första lön.'),
        ], beskrivning='En påhittad berättelse från handelsstaden Visby på medeltiden.',
            text=VISBY),

        niva('so-ak6-riksdagen-1', 'Riksdagen', 'Riksdag och regering', [
            skriv('Hur många ledamöter sitter i riksdagen?', t(RIKSDAG),
                  'Riksdagen har %d ledamöter. Ett udda antal gör att en omröstning mellan två '
                  'förslag inte kan sluta lika om alla röstar.' % RIKSDAG),
            skriv('Hur många ledamöter är mer än hälften av riksdagens %d?' % RIKSDAG, t(majoritet(RIKSDAG)),
                  'Hälften av %d är %s. Mer än hälften är %d.' % (RIKSDAG, tal(RIKSDAG / 2), majoritet(RIKSDAG))),
            val('Hur ofta är det val till riksdagen?',
                ['Vart fjärde år', 'Varje år', 'Vartannat år', 'Vart sjätte år'], 'Vart fjärde år',
                'Riksdagsval hålls vart fjärde år, samma dag som valen till kommuner och regioner.'),
            val('Vad gör riksdagen?',
                ['Stiftar lagar och bestämmer om statens budget', 'Dömer i rättegångar',
                 'Leder polisen', 'Sköter skolorna i varje kommun'],
                'Stiftar lagar och bestämmer om statens budget',
                'Riksdagen är den lagstiftande makten. Den bestämmer också hur statens pengar ska användas.'),
            val('Ett parti måste få minst en viss andel av rösterna i hela landet för att komma in i '
                'riksdagen. Hur stor är den?', ['4 procent', '1 procent', '10 procent', '25 procent'], '4 procent',
                'Spärren är 4 procent. Den finns för att inte väldigt många små partier ska göra det svårt att fatta beslut.'),
            para('Para ihop ordet med vad det betyder.',
                 [('Ledamot', 'person som sitter i riksdagen'), ('Talman', 'leder riksdagens möten'),
                  ('Utskott', 'grupp som förbereder beslut i ett ämne'), ('Votering', 'omröstning i riksdagen')],
                 'Ledamöterna förbereder frågorna i utskotten, talmannen leder mötena, och vid en votering röstar de.'),
            sant('Kungen bestämmer vilka lagar som ska gälla i Sverige.', False,
                 'Det gör riksdagen. Kungen är statschef men har ingen politisk makt.'),
            sant('Den som är svensk medborgare och har fyllt 18 år senast på valdagen får rösta i riksdagsvalet.', True,
                 'Det är rösträttsåldern i Sverige. Man behöver inte ha fyllt 18 före valåret, bara senast på valdagen.'),
        ], beskrivning='Riksdagen, valen och ledamöterna.'),

        niva('so-ak6-riksdagen-2', 'Regeringen och makten', 'Riksdag och regering', [
            val('Vem leder regeringen?', ['Statsministern', 'Talmannen', 'Kungen', 'Riksdagen'],
                'Statsministern', 'Statsministern väljer sina ministrar och leder regeringens arbete.'),
            val('Vem föreslår vem som ska bli statsminister?',
                ['Talmannen', 'Kungen', 'Den som fick flest personröster', 'Högsta domstolen'], 'Talmannen',
                'Efter ett val föreslår talmannen en statsminister, och sedan röstar riksdagen om förslaget.'),
            para('Para ihop makten med vem som har den.',
                 [('Lagstiftande makt', 'Riksdagen'), ('Verkställande makt', 'Regeringen'),
                  ('Dömande makt', 'Domstolarna')],
                 'Makten är delad: riksdagen stiftar lagarna, regeringen styr och ser till att besluten '
                 'genomförs, och domstolarna dömer.'),
            para('Para ihop vem som sköter vad.',
                 [('Kommunen', 'skolan och äldreomsorgen'), ('Regionen', 'sjukvården'),
                  ('Staten', 'polisen och försvaret')],
                 'Sverige styrs på tre nivåer: kommunen nära dig, regionen i ett större område och staten för hela landet.'),
            val('Vad heter grundlagen som säger hur Sverige ska styras?',
                ['Regeringsformen', 'Successionsordningen', 'Tryckfrihetsförordningen', 'Brottsbalken'],
                'Regeringsformen',
                'Regeringsformen börjar med att all offentlig makt i Sverige utgår från folket.'),
            skriv('Hur många grundlagar har Sverige?', t(4),
                  'De fyra är regeringsformen, successionsordningen, tryckfrihetsförordningen och '
                  'yttrandefrihetsgrundlagen.'),
            sant('Kungen är Sveriges statschef men har ingen politisk makt.', True,
                 'Kungen representerar Sverige, men alla politiska beslut fattas av riksdagen och regeringen.'),
            sant('Regeringen kan ensam ändra en grundlag.', False,
                 'En grundlag ändras av riksdagen med två likadana beslut, och det ska vara ett riksdagsval emellan.'),
            val('Vad kallas ett förslag från regeringen till riksdagen?',
                ['Proposition', 'Motion', 'Votering', 'Utskott'], 'Proposition',
                'Regeringen lämnar propositioner. En motion är ett förslag från en ledamot i riksdagen.'),
        ], beskrivning='Regeringen, maktdelningen, grundlagarna och de tre nivåerna.'),

        niva('so-ak6-varlden-1', 'Världsdelarna', 'Världsdelar och klimat', [
            val('Vilken världsdel är störst till ytan?', ['Asien', 'Afrika', 'Europa', 'Nordamerika'], 'Asien',
                'Asien är störst. Där bor också flest människor.'),
            para('Para ihop landet med världsdelen det ligger i.',
                 [('Kenya', 'Afrika'), ('Brasilien', 'Sydamerika'), ('Japan', 'Asien'),
                  ('Kanada', 'Nordamerika'), ('Australien', 'Oceanien')],
                 'Kenya ligger i östra Afrika, Brasilien i Sydamerika, Japan i Asien, Kanada i Nordamerika och '
                 'Australien i Oceanien.'),
            para('Para ihop landet med dess huvudstad.',
                 [('Frankrike', 'Paris'), ('Egypten', 'Kairo'), ('Kanada', 'Ottawa'),
                  ('Australien', 'Canberra'), ('Brasilien', 'Brasília')],
                 'Se upp: Kanadas huvudstad är Ottawa, inte Toronto, och Australiens är Canberra, inte Sydney.'),
            val('Vilket är världens största hav?', ['Stilla havet', 'Atlanten', 'Indiska oceanen', 'Östersjön'],
                'Stilla havet', 'Stilla havet är större än alla världens landytor tillsammans.'),
            val('Vilket hav ligger mellan Europa och Nordamerika?',
                ['Atlanten', 'Stilla havet', 'Indiska oceanen', 'Medelhavet'], 'Atlanten',
                'Atlanten ligger mellan Europa och Afrika i öster och Amerika i väster.'),
            val('Vilken världsdel ligger runt sydpolen?', ['Antarktis', 'Arktis', 'Oceanien', 'Sydamerika'],
                'Antarktis', 'Antarktis är en kontinent täckt av is. Arktis vid nordpolen är mest hav med is.'),
            val('Vilket är världens högsta berg?', ['Mount Everest', 'Kebnekaise', 'Mont Blanc', 'Kilimanjaro'],
                'Mount Everest', 'Mount Everest ligger i Himalaya, på gränsen mellan Nepal och Kina.'),
            sant('Ekvatorn delar jorden i ett norra och ett södra halvklot.', True,
                 'Ekvatorn är en tänkt linje runt jorden, lika långt från nordpolen som från sydpolen.'),
            sant('Hela Afrika ligger söder om ekvatorn.', False,
                 'Ekvatorn går genom mitten av Afrika. Egypten och Marocko ligger till exempel norr om den.'),
        ], beskrivning='Världsdelar, hav, länder och huvudstäder.'),

        niva('so-ak6-varlden-2', 'Klimat och klimatzoner', 'Världsdelar och klimat', [
            val('Var på jorden är det varmt året runt?', ['Nära ekvatorn', 'Nära polerna',
                                                           'Högt upp i bergen', 'I Norden'],
                'Nära ekvatorn', 'Vid ekvatorn står solen högt på himlen hela året.'),
            ordna('Ordna klimatzonerna från ekvatorn mot polen.',
                  ['Tropiska zonen', 'Subtropiska zonen', 'Tempererade zonen', 'Polara zonen'],
                  forklaring='Ju längre från ekvatorn, desto lägre står solen och desto kallare blir det.'),
            val('Vad är skillnaden mellan väder och klimat?',
                ['Väder är hur det är just nu, klimat hur det brukar vara under många år',
                 'Klimat är hur det är just nu, väder hur det brukar vara under många år',
                 'Väder gäller bara regn och klimat bara temperatur', 'Det är ingen skillnad'],
                'Väder är hur det är just nu, klimat hur det brukar vara under många år',
                'Ett regnigt dygn är väder. Att det brukar vara kalla vintrar är klimat.'),
            val('Vad heter havsströmmen som gör klimatet i Norden mildare?',
                ['Golfströmmen', 'Humboldtströmmen', 'Monsunen', 'Passaden'], 'Golfströmmen',
                'Golfströmmen för varmt vatten från Mexikanska golfen upp mot Europa.'),
            val('Vad kallas vindarna som ger mycket regn under en del av året i bland annat Indien?',
                ['Monsun', 'Golfström', 'Tornado', 'Föhn'], 'Monsun',
                'Monsunen byter riktning med årstiden. När den blåser från havet kommer regnperioden.'),
            val('Vad kännetecknar en öken?', ['Det regnar mycket lite', 'Det är alltid varmt',
                                               'Det finns bara sand', 'Det bor inga människor där'],
                'Det regnar mycket lite',
                'En öken är ett område med mycket lite nederbörd. Det finns också kalla öknar, som på Antarktis.'),
            val('Varför är det kallare vid polerna än vid ekvatorn?',
                ['Solens strålar träffar marken snett och sprids över en större yta',
                 'Polerna ligger längre från solen', 'Det finns mer hav vid polerna',
                 'Solen lyser aldrig vid polerna'],
                'Solens strålar träffar marken snett och sprids över en större yta',
                'Avståndet till solen är nästan detsamma. Det är vinkeln som gör skillnaden: snett ljus värmer mindre.'),
            sant('När det är sommar i Sverige är det vinter i Australien.', True,
                 'Australien ligger på södra halvklotet. Där är årstiderna omvända.'),
            sant('Tropisk regnskog växer nära ekvatorn.', True,
                 'Där är det varmt och regnar mycket hela året, och det är vad regnskogen behöver.'),
        ], beskrivning='Klimatzoner, väder och klimat, och varför det är varmt och kallt.'),

        niva('so-ak6-religionerna-1', 'Judendom, kristendom och islam', 'Världsreligionerna', [
            para('Para ihop religionen med dess heliga skrift.',
                 [('Judendom', 'Toran'), ('Kristendom', 'Bibeln'), ('Islam', 'Koranen')],
                 'Toran är judendomens viktigaste skrift, Bibeln kristendomens och Koranen islams.'),
            sant('Judendom, kristendom och islam tror alla på en enda Gud.', True,
                 'Alla tre är monoteistiska religioner: de tror på en Gud.'),
            val('Vad kallas islams fem viktigaste plikter?',
                ['De fem pelarna', 'De tio budorden', 'De fem mosebökerna', 'Den åttafaldiga vägen'],
                'De fem pelarna', 'De fem pelarna är trosbekännelsen, bönen, allmosan, fastan och vallfärden.'),
            val('Vilken av dessa hör INTE till islams fem pelare?',
                ['Att döpa sina barn', 'Bönen', 'Fastan under ramadan', 'Vallfärden till Mecka'],
                'Att döpa sina barn', 'Dop hör till kristendomen. De andra tre är pelare i islam.'),
            val('Vilken stad är helig för både judar, kristna och muslimer?',
                ['Jerusalem', 'Mecka', 'Rom', 'Betlehem'], 'Jerusalem',
                'I Jerusalem finns Västra muren, Gravkyrkan och al-Aqsamoskén, heliga platser för alla tre.'),
            val('Vad kallas den kristna läran om att Gud är Fadern, Sonen och den heliga Anden?',
                ['Treenigheten', 'Reformationen', 'Nattvarden', 'Trosbekännelsen'], 'Treenigheten',
                'Treenigheten betyder att Gud är en, men visar sig på tre sätt.'),
            val('Vilka är kristendomens tre största inriktningar?',
                ['Katolska, ortodoxa och protestantiska', 'Sunni, shia och sufi',
                 'Katolska, lutherska och protestantiska', 'Ortodoxa, reformerta och liberala'],
                'Katolska, ortodoxa och protestantiska',
                'Lutherska kyrkor är protestantiska, så det tredje alternativet räknar samma inriktning två gånger. '
                'Sunni och shia hör till islam.'),
            skriv('Martin Luthers teser ledde till reformationen. Vilket år kom teserna?', t(1517),
                  '1517 skrev Luther 95 teser mot kyrkans handel med avlat. Det blev början till reformationen.'),
            val('Vilken judisk högtid firas med att man tänder ljus under åtta dagar?',
                ['Chanukka', 'Pesach', 'Jom kippur', 'Sabbat'], 'Chanukka',
                'Chanukka minns när templet i Jerusalem återinvigdes, och ett nytt ljus tänds varje kväll.'),
        ], beskrivning='De tre abrahamitiska religionerna.'),

        niva('so-ak6-religionerna-2', 'Hinduism och buddhism', 'Världsreligionerna', [
            val('I vilket land bor flest hinduer?', ['Indien', 'Kina', 'Japan', 'Egypten'], 'Indien',
                'Hinduismen växte fram i Indien, och där bor de allra flesta hinduer.'),
            val('Vad kallas tron att själen föds på nytt i en ny kropp?',
                ['Reinkarnation', 'Meditation', 'Treenighet', 'Nirvana'], 'Reinkarnation',
                'Reinkarnation, eller själavandring, är en tanke i hinduismen. Buddhismen talar också om återfödelse, '
                'men utan en själ som flyttar från kropp till kropp.'),
            val('Vad betyder karma?',
                ['Att det man gör får följder, i detta liv eller nästa', 'En bön som läses varje morgon',
                 'Ett heligt djur', 'Ett tempel vid floden'],
                'Att det man gör får följder, i detta liv eller nästa',
                'Goda handlingar ger god karma och dåliga ger dålig. Karman påverkar hur man föds nästa gång.'),
            val('Vilken flod är helig för hinduer?', ['Ganges', 'Nilen', 'Amazonas', 'Jordan'], 'Ganges',
                'Många hinduer badar i Ganges för att rena sig.'),
            val('Vad hette Buddha innan han blev Buddha?',
                ['Siddharta Gautama', 'Krishna', 'Brahma', 'Muhammed'], 'Siddharta Gautama',
                'Siddharta Gautama var en prins som lämnade sitt palats för att förstå varför människor lider.'),
            val('Vad betyder ordet Buddha?', ['Den upplyste', 'Den helige', 'Kungen', 'Läraren från berget'],
                'Den upplyste', 'Siddharta kallades Buddha när han hade nått upplysningen under ett träd.'),
            val('Vad kallas målet i buddhismen, att bli fri från lidandet och återfödelserna?',
                ['Nirvana', 'Karma', 'Reinkarnation', 'Mantra'], 'Nirvana',
                'Den som når nirvana föds inte längre på nytt.'),
            para('Para ihop begreppet med vad det är.',
                 [('De fyra ädla sanningarna', 'buddhismens lära om lidandet'),
                  ('Den åttafaldiga vägen', 'buddhismens väg bort från lidandet'),
                  ('Vedaskrifterna', 'hinduismens äldsta heliga texter')],
                 'De fyra sanningarna förklarar lidandet, och den åttafaldiga vägen visar hur man blir fri från det.'),
            sant('Kon är ett heligt djur för många hinduer.', True,
                 'Därför äter många hinduer inte nötkött.'),
        ], beskrivning='Hinduismens och buddhismens tro och begrepp.'),
    ]),

    # ------------------------------------------------------------------ åk 7
    bana('SO / Historia / Samhällskunskap', 'ak7', [
        niva('so-ak7-stormaktstiden-1', 'Krigen och kungarna', 'Stormaktstiden', [
            val('Vilka år brukar räknas som Sveriges stormaktstid?',
                ['1611–1718', '1523–1611', '1718–1772', '1809–1866'], '1611–1718',
                'Stormaktstiden börjar när Gustav II Adolf blir kung 1611 och slutar när Karl XII dör 1718.'),
            tidslinje('Ordna händelserna i tidsordning, från äldst till yngst.',
                      [(1611, 'Gustav II Adolf blir kung'), (1628, 'Regalskeppet Vasa sjunker'),
                       (1632, 'Gustav II Adolf stupar vid Lützen'), (1648, 'Westfaliska freden'),
                       (1658, 'Freden i Roskilde'), (1709, 'Slaget vid Poltava')],
                      forklaring='Titta på årtalen. Vasa sjönk 1628, fyra år innan kungen stupade vid Lützen.'),
            tidslinje('Ordna kungarna och drottningen i den ordning de styrde.',
                      [(1611, 'Gustav II Adolf'), (1632, 'Kristina'), (1654, 'Karl X Gustav'),
                       (1660, 'Karl XI'), (1697, 'Karl XII')], med_ar=False,
                      forklaring='Kristina var dotter till Gustav II Adolf. Efter henne kom hennes kusin Karl X '
                                 'Gustav, sedan hans son Karl XI och sonsonen Karl XII.'),
            val('I vilket stort krig i Europa deltog Sverige 1630–1648?',
                ['Trettioåriga kriget', 'Stora nordiska kriget', 'Hundraårskriget', 'Första världskriget'],
                'Trettioåriga kriget', 'Trettioåriga kriget pågick 1618–1648 och slutade med westfaliska freden.'),
            val('Vilka landskap fick Sverige från Danmark-Norge vid freden i Roskilde 1658?',
                ['Skåne, Blekinge, Halland och Bohuslän', 'Gotland, Jämtland och Härjedalen',
                 'Finland och Estland', 'Skåne, Småland och Öland'],
                'Skåne, Blekinge, Halland och Bohuslän',
                'Gotland, Jämtland och Härjedalen blev svenska redan 1645. Småland och Öland var redan svenska.'),
            val('Vilken kung ledde hären över de frusna Bälten 1658?',
                ['Karl X Gustav', 'Gustav II Adolf', 'Karl XII', 'Gustav Vasa'], 'Karl X Gustav',
                'Karl X Gustav tågade över isen till Danmark, och Danmark tvingades till freden i Roskilde.'),
            val('Vem var rikskansler och styrde landet medan drottning Kristina var barn?',
                ['Axel Oxenstierna', 'Karl XI', 'Birger jarl', 'Carl von Linné'], 'Axel Oxenstierna',
                'Kristina var inte ens sex år när pappan dog. Oxenstierna ledde förmyndarregeringen tills hon blev myndig.'),
            sant('Efter nederlaget vid Poltava och stora nordiska kriget förlorade Sverige stora områden.', True,
                 'Vid freden 1721 förlorade Sverige bland annat Baltikum, och stormaktstiden var slut.'),
            skriv('Hur många år varade stormaktstiden, om man räknar från %d till %d?'
                  % (STORMAKT_FRAN, STORMAKT_TILL), t(STORMAKT_TILL - STORMAKT_FRAN),
                  '%d − %d = %d år.' % (STORMAKT_TILL, STORMAKT_FRAN, STORMAKT_TILL - STORMAKT_FRAN)),
        ], beskrivning='Stormaktstidens krig och kungar i tidsordning.'),

        niva('so-ak7-stormaktstiden-2', 'Livet i stormakten', 'Stormaktstiden', [
            para('Para ihop begreppet med vad det betyder.',
                 [('Envälde', 'kungen styr ensam'), ('Reduktion', 'kronan tar tillbaka jord från adeln'),
                  ('Indelningsverket', 'bönderna håller soldater'),
                  ('Karolin', 'soldat under Karl XI och Karl XII')],
                 'Karl XI införde enväldet, genomförde reduktionen och byggde ut indelningsverket.'),
            val('Hur fick kungen pengar och soldater till krigen?',
                ['Skatter och utskrivning av soldater', 'Lån från Hansans städer',
                 'Genom att sälja Finland till Ryssland', 'Bara värvade soldater från andra länder'],
                'Skatter och utskrivning av soldater',
                'Krigen betalades med skatter, och bönderna fick lämna söner till armén. Värvade soldater från '
                'andra länder fanns också, men de räckte inte.'),
            val('Varför genomförde Karl XI reduktionen?',
                ['Staten behövde jordens inkomster', 'Adeln ville själv ge bort sin jord',
                 'Bönderna krävde att få köpa jorden', 'Kyrkan ville ha tillbaka sina gårdar'],
                'Staten behövde jordens inkomster',
                'Under krigen hade kronan gett eller sålt mycket jord till adeln. Reduktionen tog tillbaka en stor del.'),
            val('Vilken metall från gruvan i Falun gav Sverige stora inkomster?',
                ['Koppar', 'Guld', 'Aluminium', 'Tenn'], 'Koppar',
                'Kopparn från Falu gruva såldes ut i Europa och hjälpte till att betala krigen.'),
            val('Vad dödade flest soldater under 1600-talets krig?',
                ['Sjukdomar', 'Kanoner', 'Svärd', 'Drunkning'], 'Sjukdomar',
                'Trångt, smutsigt och dålig mat gjorde att sjukdomar som tyfus och dysenteri dödade fler än striderna.'),
            sant('Under stormaktstiden var de flesta i Sverige bönder.', True,
                 'Nästan alla bodde på landet. Stormakten byggde på böndernas skatter och söner.'),
            sant('Finland var en del av det svenska riket under stormaktstiden.', True,
                 'Finland hörde till Sverige ända till 1809.'),
            val('Varför var Östersjön viktig för stormakten?',
                ['Tullar och handel gav stora inkomster',
                 'Det var det enda havet Sverige fiskade i',
                 'Alla svenska städer låg vid Östersjön', 'Östersjön frös aldrig på vintern'],
                'Tullar och handel gav stora inkomster',
                'Sverige ville kontrollera hamnarna runt Östersjön för att få tullpengar och styra handeln.'),
        ], beskrivning='Hur stormakten styrdes och betalades, och hur folket levde.'),

        niva('so-ak7-befolkning-1', 'Befolkningen', 'Befolkning och resurser', [
            para('Para ihop begreppet med vad det betyder.',
                 [('Urbanisering', 'fler flyttar från landsbygden till städer'),
                  ('Migration', 'människor flyttar mellan länder eller platser'),
                  ('Befolkningstäthet', 'antal invånare per kvadratkilometer'),
                  ('Födelsetal', 'antal födda per 1 000 invånare och år')],
                 'Befolkningsgeografin använder de här orden för att beskriva var och hur människor bor.'),
            skriv('Ett område är %d km² och har %s invånare. Hur många invånare bor det per km²?'
                  % (BEF_KM2, tal(BEF_INV)), t(BEF_TATHET),
                  'Befolkningstäthet är invånare delat med ytan: %s / %d = %s.'
                  % (tal(BEF_INV), BEF_KM2, t(BEF_TATHET))),
            skriv('Under ett år föds %d barn och %d personer dör i en kommun. Ingen flyttar. Hur mycket '
                  'ökar befolkningen?' % (FODDA, DODA), t(FODDA - DODA),
                  'Födda minus döda: %d − %d = %d. Det kallas födelseöverskott.' % (FODDA, DODA, FODDA - DODA)),
            skriv('En stad växer från %s till %s invånare. Med hur många procent ökade den?'
                  % (tal(STAD_FORE), tal(STAD_EFTER)), t(STAD_PROCENT),
                  'Ökningen är %s. Jämför med det man hade FÖRE: %s / %s = 0,25, alltså %s procent.'
                  % (tal(STAD_EFTER - STAD_FORE), tal(STAD_EFTER - STAD_FORE), tal(STAD_FORE), t(STAD_PROCENT))),
            val('Vilken av dessa är en pushfaktor, något som får människor att lämna en plats?',
                ['Krig', 'Lediga jobb', 'Bra skolor', 'Släktingar som redan bor där'], 'Krig',
                'Pushfaktorer trycker bort från en plats. Pullfaktorer, som jobb och släkt, drar till en plats.'),
            val('Vilken av dessa är en pullfaktor, något som lockar människor till en plats?',
                ['Lediga jobb', 'Torka', 'Förföljelse', 'Arbetslöshet'], 'Lediga jobb',
                'Torka, förföljelse och arbetslöshet får människor att lämna en plats. Jobb lockar dit.'),
            val('Vad visar en befolkningspyramid?',
                ['Hur många som finns i varje åldersgrupp, uppdelat på kvinnor och män',
                 'Hur många som bor i varje stad och varje kommun i hela landet',
                 'Hur befolkningen har flyttat under ett år', 'Hur rika människorna i landet är'],
                'Hur många som finns i varje åldersgrupp, uppdelat på kvinnor och män',
                'De yngsta står längst ner och de äldsta högst upp. Formen visar om befolkningen är ung eller gammal.'),
            sant('De flesta i Sverige bor i städer och tätorter.', True,
                 'Långt över hälften av svenskarna bor i tätorter. För 150 år sedan bodde de flesta på landet.'),
        ], beskrivning='Befolkningens begrepp och räkning med befolkningstal.'),

        niva('so-ak7-befolkning-2', 'Naturresurser och hållbarhet', 'Befolkning och resurser', [
            val('Vilken energikälla är INTE förnybar?', ['Olja', 'Vind', 'Sol', 'Vattenkraft'], 'Olja',
                'Olja bildades under miljontals år och tar slut när den används. Vind, sol och vatten förnyas hela tiden.'),
            val('Vilken av dessa är förnybar?', ['Vindkraft', 'Kol', 'Naturgas', 'Kärnbränsle'], 'Vindkraft',
                'Vinden fortsätter att blåsa hur mycket vi än använder den. Kol, naturgas och olja tar slut.'),
            para('Para ihop hållbarhetens tre delar med vad de handlar om.',
                 [('Ekologisk hållbarhet', 'naturen och klimatet ska klara sig'),
                  ('Social hållbarhet', 'människor ska ha goda och rättvisa liv'),
                  ('Ekonomisk hållbarhet', 'ekonomin ska fungera utan att förstöra resurserna')],
                 'Hållbar utveckling brukar delas i tre delar som hänger ihop.'),
            val('Vilka är några av Sveriges viktigaste naturresurser?',
                ['Skog, järnmalm och vattenkraft', 'Olja, naturgas och diamantgruvor', 'Kaffe, bomull och ris',
                 'Naturgas, kol och koppar'],
                'Skog, järnmalm och vattenkraft',
                'Sverige har mycket skog, järnmalm i norr och älvar som ger vattenkraft.'),
            val('Vad menas med en ändlig resurs?',
                ['En resurs som tar slut om vi använder upp den', 'En resurs som bara finns i ett enda land i världen',
                 'En resurs som är gratis', 'En resurs som växer tillbaka på ett år'],
                'En resurs som tar slut om vi använder upp den',
                'Olja, kol och metaller i berggrunden är ändliga. Det bildas inga nya i vår livstid.'),
            sant('Fossila bränslen har bildats av växter och djur som levde för miljontals år sedan.', True,
                 'Därför kallas de fossila. De består av rester av liv som pressats ihop under lång tid.'),
            sant('Grundvatten kan aldrig förorenas.', False,
                 'Gifter och gödsel kan sippra ner genom marken och förorena grundvattnet.'),
            val('Vad betyder det att skogsbruk är hållbart?',
                ['Man planterar nytt och tar inte ut mer än det som växer till',
                 'Man hugger all skog på en gång och säljer virket', 'Man hugger aldrig ett enda träd',
                 'Man bara hugger träd som redan har ramlat'],
                'Man planterar nytt och tar inte ut mer än det som växer till',
                'Då finns det lika mycket skog kvar till nästa generation.'),
            val('Vilken gas bildas när man eldar kol, olja och naturgas och förstärker växthuseffekten?',
                ['Koldioxid', 'Syre', 'Kväve', 'Ädelgasen argon'], 'Koldioxid',
                'Kolet i bränslet binds till syre och blir koldioxid, som håller kvar värme i atmosfären.'),
        ], beskrivning='Förnybart och ändligt, och vad hållbar utveckling betyder.'),

        niva('so-ak7-ratten-1', 'Från brott till dom', 'Rättssamhället', [
            ordna('Ordna stegen från brott till dom.',
                  ['Brottet anmäls', 'Polisen utreder', 'Åklagaren väcker åtal', 'Rättegång i tingsrätten',
                   'Domstolen meddelar dom'],
                  forklaring='Polisen utreder vad som hänt, åklagaren avgör om det räcker för åtal, och sedan '
                             'prövar domstolen målet.'),
            para('Para ihop personen med vad hen gör i en rättegång.',
                 [('Åklagare', 'för talan mot den åtalade'), ('Försvarare', 'hjälper den åtalade'),
                  ('Domare', 'leder rättegången och dömer'),
                  ('Nämndeman', 'vanlig medborgare som dömer tillsammans med domaren')],
                 'Åklagaren och försvararen är två sidor. Domaren och nämndemännen dömer.'),
            ordna('Ordna de allmänna domstolarna från den första till den högsta.',
                  ['Tingsrätt', 'Hovrätt', 'Högsta domstolen'],
                  forklaring='Ett mål börjar i tingsrätten. Domen kan överklagas till hovrätten och ibland till '
                             'Högsta domstolen.'),
            val('Vad betyder det att överklaga en dom?',
                ['Att be en högre domstol pröva målet igen', 'Att klaga hos polisen på hur utredningen gick',
                 'Att vägra betala böter', 'Att byta advokat'],
                'Att be en högre domstol pröva målet igen',
                'Den som inte är nöjd med domen kan be hovrätten titta på målet igen.'),
            val('Vad kallas straffet när man måste betala pengar för ett lindrigare brott?',
                ['Böter', 'Fängelse', 'Skadestånd', 'Skatt'], 'Böter',
                'Böter är ett straff som betalas till staten. Skadestånd betalas till den som skadats och är inget straff.'),
            sant('Den som är misstänkt för ett brott räknas som oskyldig tills en domstol har dömt hen.', True,
                 'Det kallas oskuldspresumtion och är en del av rättssäkerheten.'),
            sant('Polisen bestämmer vilket straff den som begått ett brott ska få.', False,
                 'Det är domstolen som dömer. Polisen utreder, och åklagaren väcker åtal.'),
            val('Vad menas med rättssäkerhet?',
                ['Att alla är lika inför lagen och får en rättvis prövning',
                 'Att polisen alltid får bestämma vem som är skyldig', 'Att straffen är mycket hårda',
                 'Att det finns kameror överallt'],
                'Att alla är lika inför lagen och får en rättvis prövning',
                'I ett rättssäkert land ska man kunna lita på att lagen gäller alla och att domstolarna är opartiska.'),
        ], beskrivning='Rättskedjan, domstolarna och rättssäkerheten.'),

        niva('so-ak7-ratten-2', 'Lagar och brott', 'Rättssamhället', [
            val('Vem stiftar lagarna i Sverige?', ['Riksdagen', 'Polisen', 'Domstolarna', 'Kungen'], 'Riksdagen',
                'Riksdagen stiftar lagarna. Domstolarna dömer efter dem och polisen ser till att de följs.'),
            val('Vad heter lagen där de flesta brott och straff står?',
                ['Brottsbalken', 'Regeringsformen', 'Skollagen', 'Barnkonventionen'], 'Brottsbalken',
                'I brottsbalken står vad som är brott, till exempel stöld och misshandel, och vilka straff som gäller.'),
            para('Para ihop brottet med vad det är.',
                 [('Stöld', 'att ta något som tillhör någon annan'),
                  ('Misshandel', 'att skada någon eller orsaka smärta'),
                  ('Skadegörelse', 'att förstöra någon annans sak'),
                  ('Olaga hot', 'att hota någon så att hen blir allvarligt rädd')],
                 'Alla fyra är brott enligt brottsbalken.'),
            val('Vad är skillnaden mellan ett brottmål och ett tvistemål?',
                ['Ett brottmål gäller ett brott, ett tvistemål en tvist mellan två parter',
                 'Ett tvistemål gäller ett brott, ett brottmål en tvist mellan två parter',
                 'Brottmål prövas bara av polisen', 'Det är ingen skillnad'],
                'Ett brottmål gäller ett brott, ett tvistemål en tvist mellan två parter',
                'I ett tvistemål kan två personer till exempel vara oense om pengar. Ingen har begått något brott.'),
            val('Vad betyder det att någon blir friad?',
                ['Domstolen fann inte bevisat att hen begått brottet', 'Hen har avtjänat hela sitt straff i fängelse',
                 'Hen har betalat sina böter', 'Hen har erkänt brottet'],
                'Domstolen fann inte bevisat att hen begått brottet',
                'För att dömas måste det vara ställt utom rimligt tvivel att man begått brottet.'),
            sant('Samma lagar gäller för poliser och politiker som för alla andra.', True,
                 'Likhet inför lagen betyder att ingen står över lagen för att hen har makt.'),
            sant('Offentlighetsprincipen ger alla rätt att läsa allmänna handlingar hos myndigheterna, '
                 'om de inte är sekretessbelagda.', True,
                 'Offentlighetsprincipen gör att medborgare och journalister kan granska hur myndigheterna arbetar.'),
            val('Varför har samhället lagar?',
                ['För att skydda människor och skapa ordning',
                 'För att polisen ska ha något att göra', 'För att staten ska kunna tjäna pengar på böter',
                 'För att kungen ska kunna bestämma'],
                'För att skydda människor och skapa ordning',
                'Lagarna gör att vi kan lösa konflikter utan våld och vet vad som gäller.'),
        ], beskrivning='Lagar, brott och olika sorters mål.'),

        niva('so-ak7-etik-1', 'Etiska modeller', 'Etik', [
            para('Para ihop den etiska modellen med vad som avgör om en handling är rätt.',
                 [('Konsekvensetik', 'följderna av handlingen'), ('Pliktetik', 'regler och plikter'),
                  ('Dygdetik', 'vad en god människa skulle göra'), ('Sinnelagsetik', 'avsikten bakom handlingen')],
                 'Modellerna ställer olika frågor: Vad händer sedan? Vilken regel gäller? Vad skulle en god '
                 'människa göra? Vad ville jag?'),
            val('Vad kallas regeln ”Behandla andra så som du själv vill bli behandlad”?',
                ['Den gyllene regeln', 'Den tionde regeln', 'Allemansrätten', 'Kategoriska imperativet'],
                'Den gyllene regeln', 'Den gyllene regeln finns i olika former i många religioner och kulturer.'),
            val('Vilken filosof förknippas främst med pliktetiken?',
                ['Immanuel Kant', 'Aristoteles', 'Jeremy Bentham', 'Sokrates'], 'Immanuel Kant',
                'Kant menade att vissa handlingar är fel, som att ljuga, oavsett vad som händer sedan.'),
            val('Vilken filosof förknippas främst med dygdetiken?',
                ['Aristoteles', 'Immanuel Kant', 'Jeremy Bentham', 'Martin Luther'], 'Aristoteles',
                'Aristoteles menade att man ska träna upp goda egenskaper, som mod och rättvisa.'),
            val('Utilitarismen är en sorts konsekvensetik. Vad är rätt enligt den?',
                ['Det som ger mest lycka för flest', 'Att alltid följa lagen',
                 'Att alltid säga sanningen', 'Det som gör mig själv lyckligast'],
                'Det som ger mest lycka för flest',
                'Utilitarismen räknar ihop hur handlingen påverkar alla, och väljer det som ger mest lycka totalt.'),
            val('Vad är ett etiskt dilemma?',
                ['Ett val där alla alternativ har något dåligt med sig', 'En lag som många tycker är orättvis och vill ändra',
                 'Ett problem som har ett enda rätt svar', 'En fråga om vad något kostar'],
                'Ett val där alla alternativ har något dåligt med sig',
                'I ett dilemma finns inget val som är bra i alla avseenden. Man får väga för- och nackdelar.'),
            val('Vad är skillnaden mellan moral och etik?',
                ['Moral är hur vi handlar, etik är när vi tänker och resonerar om vad som är rätt',
                 'Etik är hur vi handlar, moral är när vi tänker och resonerar om vad som är rätt',
                 'Moral gäller bara religiösa', 'Det är ingen skillnad alls'],
                'Moral är hur vi handlar, etik är när vi tänker och resonerar om vad som är rätt',
                'Moral syns i handlingarna. Etik är att fundera över och motivera varför något är rätt eller fel.'),
            sant('Enligt konsekvensetiken kan en lögn vara rätt om den leder till bättre följder än sanningen.',
                 True, 'Konsekvensetiken ser bara till följderna, inte till om handlingen i sig är en lögn.'),
            sant('Enligt Kants pliktetik är det rätt att bryta ett löfte om man tjänar på det.', False,
                 'Pliktetiken säger att man ska hålla sina löften även när det kostar.'),
        ], beskrivning='Konsekvensetik, pliktetik, dygdetik och sinnelagsetik.'),

        niva('so-ak7-etik-2', 'Att resonera etiskt', 'Etik', [
            val('Sara säger till en kompis att hennes teckning är fin, fast hon inte tycker det. Hon tänker '
                'att det gör minst skada. Vilken modell resonerar hon efter?',
                ['Konsekvensetik', 'Pliktetik', 'Dygdetik', 'Sinnelagsetik'], 'Konsekvensetik',
                'Sara väljer utifrån vad som händer sedan, alltså följderna.'),
            val('Ali säger sanningen fast det blir obekvämt, för han menar att man aldrig får ljuga. '
                'Vilken modell resonerar han efter?',
                ['Pliktetik', 'Konsekvensetik', 'Dygdetik', 'Sinnelagsetik'], 'Pliktetik',
                'Ali följer en regel, att inte ljuga, oavsett följderna.'),
            val('Nora frågar sig: vad skulle en modig och ärlig människa göra här? Vilken modell resonerar '
                'hon efter?', ['Dygdetik', 'Pliktetik', 'Konsekvensetik', 'Sinnelagsetik'], 'Dygdetik',
                'Dygdetiken utgår från goda egenskaper, som mod och ärlighet.'),
            val('Emil försökte hjälpa till men det gick dåligt. Han menar att han ändå gjorde rätt, för han '
                'ville väl. Vilken modell resonerar han efter?',
                ['Sinnelagsetik', 'Konsekvensetik', 'Pliktetik', 'Dygdetik'], 'Sinnelagsetik',
                'För sinnelagsetiken är avsikten det viktiga, inte hur det gick.'),
            val('Vad menas med att alla människor har samma människovärde?',
                ['Alla är lika mycket värda, oavsett vilka de är', 'Alla tjänar lika mycket pengar när de blir vuxna',
                 'Alla tycker likadant', 'Alla har samma jobb'],
                'Alla är lika mycket värda, oavsett vilka de är',
                'Människovärdet går inte att förtjäna eller förlora. Det är en grund för de mänskliga rättigheterna.'),
            val('Vad är ett argument?', ['Ett skäl som stöder en åsikt', 'Ett gräl mellan två personer',
                                          'En åsikt utan skäl', 'En fråga utan svar'],
                'Ett skäl som stöder en åsikt',
                'När man resonerar om etik ska man kunna säga varför man tycker något. Skälet är argumentet.'),
            sant('Två personer som använder samma etiska modell kan ändå komma fram till olika svar.', True,
                 'De kan till exempel tro olika om vilka följder en handling får.'),
            val('En utilitarist ska välja mellan att hjälpa en person eller fem personer lika mycket. Vad väljer '
                'utilitaristen?', ['De fem', 'Den ena', 'Ingen av dem', 'Den som ber först'], 'De fem',
                'Utilitarismen vill ha mest lycka totalt, och fem personer som får hjälp ger mer än en.'),
        ], beskrivning='Känn igen modellerna i vardagen och resonera med argument.'),

        niva('so-ak7-etik-3', 'Plånboken i snön', 'Etik', [
            val('Vad fanns i plånboken?',
                ['Ett busskort, ett foto av en hund och sexhundra kronor', 'Ett körkort, ett bankkort och tvåhundra kronor i sedlar',
                 'Ett foto av en katt och ett bankkort', 'Bara pengar'],
                'Ett busskort, ett foto av en hund och sexhundra kronor',
                'Det står i första stycket.'),
            val('Moa säger: ”Tänk om det var du som hade tappat den.” Vilken regel använder hon?',
                ['Den gyllene regeln', 'Allemansrätten', 'Majoritetsprincipen', 'Offentlighetsprincipen'],
                'Den gyllene regeln',
                'Hon ber Liam behandla ägaren så som han själv skulle vilja bli behandlad.'),
            val('Liam säger att pengarna gör mer nytta hos dem. Vilken modell liknar det mest?',
                ['Konsekvensetik', 'Pliktetik', 'Dygdetik', 'Sinnelagsetik'], 'Konsekvensetik',
                'Han ser till följderna: var pengarna gör mest nytta.'),
            val('Vad svarar Moa på Liams argument om nyttan?',
                ['Att de inte vet vem ägaren är och hur mycket pengarna betyder',
                 'Att det är olagligt att ens plocka upp en borttappad plånbok', 'Att hon inte vill ha pengarna',
                 'Att polisen ser dem'],
                'Att de inte vet vem ägaren är och hur mycket pengarna betyder',
                'Moa säger att det kan vara någons matpengar för hela veckan. Liams följder bygger på en gissning.'),
            val('Liam säger: ”Då vet vi att vi har gjort rätt, vad som än händer sedan.” Vilken modell liknar det mest?',
                ['Pliktetik', 'Konsekvensetik', 'Utilitarism', 'Ingen modell'], 'Pliktetik',
                'Han menar att handlingen är rätt i sig, oavsett följderna. Så resonerar pliktetiken.'),
            val('Vad får Liam att ändra sig?',
                ['Han tänker på hur det skulle kännas om någon behöll hans egna pengar',
                 'Moa hotar att berätta allt för deras klasslärare på måndag', 'En polis kommer förbi', 'Han hittar ägarens adress'],
                'Han tänker på hur det skulle kännas om någon behöll hans egna pengar',
                'Det står att han tittar på fotot och tänker på hur det skulle kännas.'),
            sant('Moa vill först behålla pengarna.', False,
                 'Det är Liam som vill dela pengarna. Moa skakar på huvudet.'),
        ], beskrivning='En berättelse om ett val. Läs och koppla till de etiska modellerna.',
            text=PLANBOKEN),
    ]),

    # ------------------------------------------------------------------ åk 9
    bana('SO / Historia / Samhällskunskap', 'ak9', [
        niva('so-ak9-industri-1', 'Den industriella revolutionen', 'Industrialiseringen', [
            val('I vilket land började den industriella revolutionen?',
                ['Storbritannien', 'Sverige', 'USA', 'Nederländerna'], 'Storbritannien',
                'Storbritannien hade kol, järn, kapital och kolonier som köpte varor, och där började det.'),
            val('Ungefär när började den industriella revolutionen?',
                ['I slutet av 1700-talet', 'I början av 1500-talet', 'I mitten av 1600-talet',
                 'I början av 1900-talet'], 'I slutet av 1700-talet',
                'Den tog fart i Storbritannien under 1700-talets andra hälft och spreds under 1800-talet.'),
            val('Vem förbättrade ångmaskinen så att den blev mycket effektivare?',
                ['James Watt', 'Thomas Edison', 'Alfred Nobel', 'Isaac Newton'], 'James Watt',
                'James Watt förbättrade ångmaskinen på 1760- och 1770-talen. Den kunde sedan driva fabriker och tåg.'),
            val('Vilken industri var först med att använda maskiner i stor skala?',
                ['Textilindustrin', 'Bilindustrin', 'Elektronikindustrin', 'Flygindustrin'], 'Textilindustrin',
                'Spinnmaskiner och vävstolar gjorde tyg mycket snabbare än för hand.'),
            para('Para ihop ordet med vad det betyder.',
                 [('Urbanisering', 'människor flyttar till städerna'),
                  ('Arbetarklass', 'de som säljer sin arbetskraft i fabrikerna'),
                  ('Kapitalist', 'den som äger fabriker och maskiner'),
                  ('Fackförening', 'arbetare som går samman för bättre villkor')],
                 'Industrialiseringen skapade nya samhällsgrupper och nya sätt att organisera sig.'),
            sant('Barnarbete var vanligt i fabrikerna under den tidiga industrialiseringen.', True,
                 'Barn kunde arbeta tolv timmar om dagen. Efter hand kom lagar som förbjöd det.'),
            val('Vilken ideologi ville att arbetarna gemensamt skulle äga fabrikerna och maskinerna?',
                ['Socialism', 'Liberalism', 'Konservatism', 'Nationalism'], 'Socialism',
                'Socialismen ville att produktionsmedlen skulle ägas gemensamt, så att vinsten kom alla till del.'),
            val('Vilken ideologi betonade individens frihet och fri handel?',
                ['Liberalism', 'Socialism', 'Konservatism', 'Kommunism'], 'Liberalism',
                'Den tidiga liberalismen ville att staten skulle lägga sig i så lite som möjligt och att handeln skulle vara fri.'),
            val('Vilken ideologi ville bevara traditioner och ändra samhället försiktigt?',
                ['Konservatism', 'Liberalism', 'Socialism', 'Anarkism'], 'Konservatism',
                'Konservatismen menade att det som vuxit fram under lång tid har ett värde och inte ska rivas i onödan.'),
        ], beskrivning='Hur industrialiseringen började och vilka idéer den väckte.'),

        niva('so-ak9-industri-2', 'Sverige blir modernt', 'Industrialiseringen', [
            tidslinje('Ordna händelserna i tidsordning, från äldst till yngst.',
                      [(1842, 'Folkskolan införs'), (1867, 'Alfred Nobel får patent på dynamiten'),
                       (1889, 'Socialdemokraterna bildas'),
                       (1909, 'Män får allmän rösträtt till riksdagens andra kammare'),
                       (1921, 'Kvinnor röstar för första gången i ett riksdagsval')],
                      forklaring='Titta på årtalen. Skolan kom först, sedan dynamiten och partiet, och rösträtten sist.'),
            skriv('Män fick allmän rösträtt %d, och kvinnor röstade första gången i ett riksdagsval %d. Hur många '
                  'år senare var det?' % (ROSTRATT_MAN, ROSTRATT_KVINNOR), t(ROSTRATT_KVINNOR - ROSTRATT_MAN),
                  '%d − %d = %d år.' % (ROSTRATT_KVINNOR, ROSTRATT_MAN, ROSTRATT_KVINNOR - ROSTRATT_MAN)),
            val('Ungefär hur många svenskar emigrerade till Nordamerika mellan 1850 och 1930?',
                ['Över en miljon', 'Omkring tio tusen', 'Omkring hundra tusen', 'Över tio miljoner'],
                'Över en miljon', 'Mer än en miljon svenskar reste. Det var en stor del av befolkningen, som då var några få miljoner.'),
            val('Varför emigrerade många svenskar?',
                ['Fattigdom, missväxt och brist på jord', 'Sverige var i krig med Ryssland under hela perioden',
                 'Det var förbjudet att bo på landet', 'Staten betalade dem för att flytta'],
                'Fattigdom, missväxt och brist på jord',
                'Befolkningen växte snabbt, och det fanns inte jord och arbete åt alla. Amerika lockade med jord och jobb.'),
            val('Vad kallas rörelserna som växte fram, som väckelserörelsen, nykterhetsrörelsen och arbetarrörelsen?',
                ['Folkrörelser', 'Fackförbund', 'Stånd', 'Gillen'], 'Folkrörelser',
                'Folkrörelserna samlade många människor och blev en skola i demokrati: möten, omröstningar och protokoll.'),
            sant('I Sverige fick kvinnor rösta i riksdagsval före männen.', False,
                 'Män fick allmän rösträtt 1909, och kvinnor röstade första gången 1921.'),
            val('Vad var viktigt för att Sverige kunde industrialiseras?',
                ['Skog, järnmalm och vattenkraft', 'Olja och naturgas från Nordsjön', 'Kolonier i Afrika',
                 'Bomullsodlingar'],
                'Skog, järnmalm och vattenkraft',
                'Sågverk, järnbruk och gruvor byggde på Sveriges egna råvaror, och forsarna gav kraft.'),
            val('Vad gjorde järnvägen för industrin?',
                ['Den gjorde det billigare och snabbare att frakta varor och råvaror',
                 'Den ersatte alla fabriker', 'Den gjorde att folk på landet slutade flytta till städerna',
                 'Den användes bara av kungen'],
                'Den gjorde det billigare och snabbare att frakta varor och råvaror',
                'Med järnvägen kom timmer, malm och varor snabbt fram, och nya orter växte upp vid stationerna.'),
        ], beskrivning='Utvandringen, folkrörelserna och rösträtten.'),

        niva('so-ak9-industri-3', 'Brev från Minnesota', 'Industrialiseringen', [
            val('Vilken väg tog Johan till Amerika?',
                ['Från Göteborg till England och sedan över Atlanten', 'Från Stockholm rakt över till New York med segelfartyg',
                 'Från Göteborg till Norge och sedan med tåg', 'Från Malmö via Tyskland'],
                'Från Göteborg till England och sedan över Atlanten',
                'Han skriver att de for från Göteborg till England och därifrån tog ångbåten över Atlanten.'),
            val('Var arbetar Johan nu?', ['På en gård i Minnesota', 'I en stor fabrik i Chicago tillsammans med andra svenskar',
                                          'I en gruva i Värmland', 'På ett skepp'],
                'På en gård i Minnesota', 'Han arbetar på en gård i Minnesota hos en familj från Värmland.'),
            val('Hur beskriver Johan jorden i Minnesota?',
                ['Svart och bördig, inte stenig som hemma', 'Stenig och torr, som jorden hemma i Värmland', 'Täckt av skog',
                 'Dyr och svår att få tag på'],
                'Svart och bördig, inte stenig som hemma',
                'Han jämför med jorden hemma, som var stenig.'),
            val('Vad ska familjen använda pengarna till?',
                ['Att betala skulden till handlaren', 'Att köpa en biljett så att Erik kan resa efter',
                 'Att bygga ett nytt hus', 'Att köpa en ko'],
                'Att betala skulden till handlaren',
                'Johan skriver att de ska betala skulden så att de slipper oroa sig i vinter.'),
            val('Vilka vill Johan ska komma efter honom?', ['Erik och Hilma', 'Mor och far', 'Anna och hennes familj',
                                                              'Familjen från Värmland'],
                'Erik och Hilma', 'När han köpt egen jord vill han att Erik och Hilma kommer efter.'),
            sant('Johan ångrar att han reste och vill komma hem.', False,
                 'Han saknar familjen, men han vill stanna, köpa jord och få syskonen att komma efter.'),
            val('Vad visar brevet om varför många emigrerade?',
                ['De hoppades på egen jord och bättre lön', 'De ville resa runt och se världen under några år',
                 'De var tvungna att göra värnplikt där', 'De ville lära sig engelska'],
                'De hoppades på egen jord och bättre lön',
                'Johan skriver om lönen, som är bättre än i Sverige, och om att köpa egen jord.'),
            val('Vad var jobbigt med resan över Atlanten, enligt brevet?',
                ['Många blev sjösjuka och det var trångt', 'Johan förlorade alla sina pengar',
                 'Skeppet höll på att sjunka i en storm mitt på havet', 'De fick inget att äta'],
                'Många blev sjösjuka och det var trångt',
                'Han skriver att det var trångt under däck och att många var sjösjuka i flera dagar.'),
        ], beskrivning='Ett påhittat brev från en svensk utvandrare. Läs och svara.',
            text=BREVET),

        niva('so-ak9-varldskrigen-1', 'Första världskriget', 'Världskrigen', [
            val('Vilka år pågick första världskriget?', ['1914–1918', '1939–1945', '1904–1908', '1918–1922'],
                '1914–1918', 'Kriget började sommaren 1914 och tog slut i november 1918.'),
            val('Vilken händelse utlöste kriget?',
                ['Skotten i Sarajevo mot Österrike-Ungerns tronföljare', 'Tysklands anfall på Polen',
                 'Rysslands anfall på Österrike-Ungerns huvudstad Wien', 'Japans anfall på Pearl Harbor'],
                'Skotten i Sarajevo mot Österrike-Ungerns tronföljare',
                'Tronföljaren Franz Ferdinand sköts i juni 1914. Genom allianserna drogs sedan stormakterna in.'),
            para('Para ihop ordet med vad det betyder.',
                 [('Centralmakterna', 'Tyskland och Österrike-Ungern med allierade'),
                  ('Ententen', 'Storbritannien, Frankrike och Ryssland'),
                  ('Skyttegrav', 'grävd försvarslinje vid fronten'),
                  ('Versaillesfreden', 'fredsavtalet med Tyskland 1919')],
                 'Kriget stod mellan två block, och vid västfronten grävde soldaterna ner sig i skyttegravar.'),
            val('Vad kallas ett krig där fronten knappt rör sig på lång tid?',
                ['Ställningskrig', 'Blixtkrig', 'Inbördeskrig', 'Kallt krig'], 'Ställningskrig',
                'Vid västfronten låg arméerna i skyttegravar i flera år och vann bara några hundra meter i taget.'),
            val('Vilket land gick in i kriget 1917 på ententens sida?', ['USA', 'Sverige', 'Japan', 'Spanien'],
                'USA', 'USA gick med 1917, bland annat efter att tyska ubåtar sänkt fartyg med amerikaner ombord.'),
            val('Vilket land lämnade kriget efter en revolution?', ['Ryssland', 'Frankrike', 'Italien', 'USA'],
                'Ryssland', 'Efter revolutionen 1917 slöt Ryssland fred med Tyskland 1918.'),
            sant('Sverige deltog inte i första världskriget.', True,
                 'Sverige var neutralt, men kriget märktes ändå genom brist på mat och varor.'),
            val('Vad krävde Versaillesfreden av Tyskland?',
                ['Att betala krigsskadestånd och lämna ifrån sig områden', 'Att Tyskland skulle bli en del av Frankrike för alltid',
                 'Att få en kung från Storbritannien', 'Ingenting alls'],
                'Att betala krigsskadestånd och lämna ifrån sig områden',
                'Tyskland fick också ta på sig skulden för kriget. Många tyskar kände sig förödmjukade.'),
            val('Vilken organisation bildades efter kriget för att bevara freden?',
                ['Nationernas förbund', 'Förenta nationerna', 'Nato', 'Europeiska kol- och stålgemenskapen'], 'Nationernas förbund',
                'Nationernas förbund bildades 1920. FN kom först efter andra världskriget.'),
        ], beskrivning='Orsakerna, fronten och freden.'),

        niva('so-ak9-varldskrigen-2', 'Andra världskriget', 'Världskrigen', [
            tidslinje('Ordna händelserna i tidsordning, från äldst till yngst.',
                      [(1933, 'Hitler blir Tysklands rikskansler'), (1939, 'Tyskland anfaller Polen'),
                       (1941, 'Japan anfaller Pearl Harbor'), (1944, 'De allierade landstiger i Normandie'),
                       (1945, 'Tyskland kapitulerar')],
                      forklaring='Hitler kom till makten sex år före kriget. Pearl Harbor drog in USA, och '
                                 'landstigningen i Normandie öppnade en ny front i väster.'),
            val('Vilka år pågick andra världskriget?', ['1939–1945', '1914–1918', '1933–1939', '1941–1949'],
                '1939–1945', 'Kriget började med anfallet på Polen i september 1939 och slutade 1945.'),
            val('Vad kallas nazisternas mord på omkring sex miljoner judar?',
                ['Förintelsen', 'Reformationen', 'Blixtkriget', 'Ockupationen'], 'Förintelsen',
                'Förintelsen var ett planerat folkmord. Även romer och andra grupper mördades.'),
            val('Vilken ideologi stod Hitlers parti för?', ['Nazism', 'Liberalism', 'Kommunism', 'Socialdemokrati'],
                'Nazism', 'Nazismen byggde på rasism, antisemitism och en ledare med all makt.'),
            val('Över vilka två japanska städer fälldes atombomber 1945?',
                ['Hiroshima och Nagasaki', 'Tokyo och Osaka', 'Kyoto och Kobe', 'Hiroshima och Yokohama'],
                'Hiroshima och Nagasaki',
                'Bomberna fälldes i augusti 1945, och kort därefter kapitulerade Japan.'),
            sant('Norge och Danmark ockuperades av Tyskland 1940.', True,
                 'Tyskland anföll båda länderna den 9 april 1940.'),
            val('Vilka var de tre ledande allierade stormakterna?',
                ['USA, Storbritannien och Sovjetunionen', 'Tyskland, Italien och Japan',
                 'Japan, Storbritannien och Sovjetunionen', 'USA, Japan och Kina'],
                'USA, Storbritannien och Sovjetunionen',
                'Tyskland, Italien och Japan var axelmakterna, som de allierade kämpade mot.'),
            val('Vilken organisation bildades 1945 för att bevara freden?',
                ['Förenta nationerna', 'Nationernas förbund', 'Hansan', 'Warszawapakten'], 'Förenta nationerna',
                'FN bildades 1945 och ersatte Nationernas förbund, som inte hade lyckats hindra kriget.'),
            sant('Sverige var med i kriget på Tysklands sida.', False,
                 'Sverige var neutralt, men gav efter för tyska krav, till exempel att tyska soldater fick resa genom Sverige.'),
        ], beskrivning='Andra världskriget, Förintelsen och FN.'),

        niva('so-ak9-ekonomi-1', 'Samhällsekonomin', 'Ekonomi och privatekonomi', [
            para('Para ihop ordet med vad det betyder.',
                 [('Inflation', 'priserna stiger och pengarna blir mindre värda'),
                  ('BNP', 'värdet av allt ett land producerar under ett år'),
                  ('Ränta', 'priset för att låna pengar'), ('Export', 'varor som säljs till andra länder')],
                 'Orden används när man talar om hur ett lands ekonomi mår.'),
            val('Efterfrågan på en vara ökar, men det finns inte fler exemplar att sälja. Vad händer oftast med priset?',
                ['Priset stiger', 'Priset sjunker', 'Priset blir noll', 'Varan försvinner'], 'Priset stiger',
                'När fler vill köpa samma mängd kan säljaren ta mer betalt. Det är utbud och efterfrågan.'),
            skriv('En vara kostar %d kr. Priset stiger med %d procent. Vad kostar varan nu? Svara i kronor.'
                  % (VARA_PRIS, VARA_OKNING), t(VARA_NY),
                  '%d procent av %d kr är %s kr, och %d + %s = %s kr.'
                  % (VARA_OKNING, VARA_PRIS, t(VARA_NY - VARA_PRIS), VARA_PRIS, t(VARA_NY - VARA_PRIS), t(VARA_NY))),
            val('Vad är Riksbankens viktigaste uppgift?',
                ['Att hålla priserna stabila', 'Att bestämma skatterna', 'Att stifta lagar om banker',
                 'Att bestämma lönerna'], 'Att hålla priserna stabila',
                'Riksbanken ska se till att inflationen är låg och stabil, så att pengarna behåller sitt värde.'),
            val('Vilket verktyg använder Riksbanken främst för att påverka inflationen?',
                ['Styrräntan', 'Momsen', 'Tullarna', 'Barnbidraget'], 'Styrräntan',
                'Höjer Riksbanken räntan blir det dyrare att låna, folk köper mindre och priserna stiger långsammare.'),
            val('Vad kallas en period då ekonomin krymper och arbetslösheten ofta ökar?',
                ['Lågkonjunktur', 'Högkonjunktur', 'Inflation', 'Export'], 'Lågkonjunktur',
                'Ekonomin går i vågor: i en högkonjunktur växer den, i en lågkonjunktur krymper den.'),
            sant('Skatterna är den största inkomsten för staten, regionerna och kommunerna.', True,
                 'Skatterna betalar till exempel skolor, sjukvård och vägar.'),
            val('I det ekonomiska kretsloppet, vad får hushållen av företagen i utbyte mot sitt arbete?',
                ['Lön', 'Skatt', 'Ränta', 'Bidrag'], 'Lön',
                'Hushållen arbetar i företagen och får lön. Lönen använder de sedan för att köpa företagens varor.'),
        ], beskrivning='Utbud och efterfrågan, inflation och Riksbanken.'),

        niva('so-ak9-ekonomi-2', 'Privatekonomi', 'Ekonomi och privatekonomi', [
            skriv('Du sätter in %s kr på ett konto med %d procents ränta per år. Hur mycket ränta får du '
                  'efter ett år? Svara i kronor.' % (tal(SPAR), SPAR_RANTA), t(RANTA_1),
                  '%d procent av %s kr är %s kr.' % (SPAR_RANTA, tal(SPAR), t(RANTA_1))),
            skriv('Du sätter in %s kr på ett konto med %d procents ränta per år, och räntan får stå kvar. Hur mycket '
                  'finns det på kontot efter två år? Svara i kronor.' % (tal(SPAR), SPAR_RANTA), t(KONTO_2),
                  'Efter ett år finns %s kr. Andra året får du ränta också på räntan: %s · 1,03 = %s kr. '
                  'Det kallas ränta på ränta.' % (t(SPAR + RANTA_1), t(SPAR + RANTA_1), t(KONTO_2))),
            skriv('Lina får %s kr i månaden. Hon lägger %d kr på mat och %d kr på mobil och kläder, och '
                  'sparar resten. Hur mycket sparar hon? Svara i kronor.' % (tal(LON), MAT, MOBIL), t(SPARAR),
                  '%s − %d − %d = %d kr.' % (tal(LON), MAT, MOBIL, SPARAR)),
            skriv('Ett lån på %s kr har %d procents ränta per år. Hur mycket ränta blir det på ett år, om '
                  'inget betalas tillbaka? Svara i kronor.' % (tal(LAN), LAN_RANTA), t(LAN_KOSTNAD),
                  '%d procent av %s kr är %s kr. Hög ränta gör lånet dyrt.' % (LAN_RANTA, tal(LAN), t(LAN_KOSTNAD))),
            val('Vad är en budget?', ['En plan över inkomster och utgifter', 'Ett lån från banken',
                                       'Ett sparkonto med extra hög ränta för unga', 'Skatten man betalar'],
                'En plan över inkomster och utgifter',
                'Med en budget ser man i förväg om pengarna räcker och hur mycket som kan sparas.'),
            para('Para ihop ordet med vad det betyder.',
                 [('Bruttolön', 'lön före skatt'), ('Nettolön', 'lön efter skatt'),
                  ('Amortering', 'att betala tillbaka på ett lån'),
                  ('Kontantinsats', 'egna pengar när man köper bostad')],
                 'Nettolönen är det som faktiskt kommer in på kontot, efter att skatten dragits.'),
            sant('Ett lån med hög ränta kan till slut kosta mer än det man lånade.', True,
                 'Räntan läggs på år efter år. Betalar man inte av kan räntan bli större än lånet.'),
            val('Varför kan det bli dyrt att köpa på kredit och betala lite i taget?',
                ['Man betalar ränta och avgifter utöver priset', 'Varan blir dyrare eftersom den räknas som begagnad',
                 'Man måste betala allt på en gång ändå', 'Butiken tar bort garantin'],
                'Man betalar ränta och avgifter utöver priset',
                'Den som betalar lite i taget lånar egentligen pengar, och lånet kostar ränta.'),
            val('Vad heter myndigheten som tar in skatten?',
                ['Skatteverket', 'Riksbanken', 'Försäkringskassan', 'Konsumentverket'], 'Skatteverket',
                'Skatteverket tar in skatten. Riksbanken är Sveriges centralbank och tar inte in skatt.'),
        ], beskrivning='Ränta, budget och lån, med räkning.'),

        niva('so-ak9-rattigheter-1', 'FN och de mänskliga rättigheterna', 'Mänskliga rättigheter', [
            skriv('Vilket år antog FN den allmänna förklaringen om de mänskliga rättigheterna?', t(1948),
                  'Förklaringen antogs 1948, efter andra världskriget och Förintelsen.'),
            skriv('Hur många artiklar har den allmänna förklaringen om de mänskliga rättigheterna?', t(30),
                  'Förklaringen har 30 artiklar. Den första säger att alla människor är födda fria och lika i värde.'),
            val('Vad betyder det att de mänskliga rättigheterna är universella?',
                ['De gäller för alla människor överallt', 'De gäller bara i de länder som är medlemmar i FN',
                 'De gäller bara vuxna', 'De bestäms av varje land själv'],
                'De gäller för alla människor överallt',
                'Universell betyder allmängiltig. Rättigheterna hör till varje människa, oavsett land.'),
            para('Para ihop friheten med vad den betyder.',
                 [('Yttrandefrihet', 'rätten att säga vad man tycker'),
                  ('Religionsfrihet', 'rätten att ha eller inte ha en religion'),
                  ('Mötesfrihet', 'rätten att samlas till möten'),
                  ('Föreningsfrihet', 'rätten att gå med i eller bilda föreningar')],
                 'Friheterna gör det möjligt att delta i en demokrati.'),
            val('Vilket år antog FN barnkonventionen?', ['1989', '1948', '2020', '1921'], '1989',
                'Barnkonventionen antogs 1989. 1948 kom förklaringen om de mänskliga rättigheterna, och 2020 '
                'blev barnkonventionen lag i Sverige.'),
            sant('Barnkonventionen blev svensk lag år 2020.', True,
                 'Sedan den 1 januari 2020 är barnkonventionen lag i Sverige.'),
            val('Vem har ansvaret för att de mänskliga rättigheterna följs i ett land?',
                ['Landets stat, alltså regering och myndigheter', 'FN:s generalsekreterare',
                 'Varje medborgare för sig', 'Frivilligorganisationer som Amnesty och Röda korset'],
                'Landets stat, alltså regering och myndigheter',
                'Staterna har skrivit under och ansvarar. Organisationer som Amnesty granskar och larmar.'),
            sant('Dödsstraff är avskaffat i Sverige.', True,
                 'Sverige avskaffade dödsstraffet i fredstid 1921 och helt 1973.'),
        ], beskrivning='FN:s förklaring, barnkonventionen och friheterna.'),

        niva('so-ak9-rattigheter-2', 'Diskriminering och demokrati', 'Mänskliga rättigheter', [
            skriv('Hur många diskrimineringsgrunder finns i den svenska diskrimineringslagen?', t(7),
                  'De sju är kön, könsöverskridande identitet eller uttryck, etnisk tillhörighet, religion eller '
                  'annan trosuppfattning, funktionsnedsättning, sexuell läggning och ålder.'),
            val('Vilken av dessa är INTE en diskrimineringsgrund i diskrimineringslagen?',
                ['Favoritlag i fotboll', 'Ålder', 'Funktionsnedsättning', 'Religion'],
                'Favoritlag i fotboll',
                'Ålder, funktionsnedsättning och religion eller annan trosuppfattning står i lagen.'),
            val('Vad heter myndigheten som arbetar mot diskriminering?',
                ['Diskrimineringsombudsmannen', 'Skatteverket', 'Riksbanken', 'Konsumentverket'],
                'Diskrimineringsombudsmannen',
                'Diskrimineringsombudsmannen, DO, tar emot anmälningar och ser till att lagen följs.'),
            val('Vad är diskriminering enligt lagen?',
                ['Att missgynnas på grund av en diskrimineringsgrund',
                 'Att två personer har olika åsikter om något', 'Att få ett lägre betyg än man hade hoppats',
                 'Att inte bli bjuden på en klasskompis kalas'],
                'Att missgynnas på grund av en diskrimineringsgrund',
                'Att behandlas sämre är diskriminering i lagens mening när det har samband med en av de sju grunderna.'),
            sant('Hot och kränkningar på nätet kan vara brott.', True,
                 'Samma lagar gäller på nätet. Olaga hot och förtal är brott var de än sker.'),
            val('Vilken europeisk konvention om rättigheter gäller som lag i Sverige?',
                ['Europakonventionen', 'Kalmarunionen', 'Westfaliska freden', 'Versaillesfreden'],
                'Europakonventionen',
                'Europakonventionen om de mänskliga rättigheterna är svensk lag sedan 1995.'),
            val('Varför är fri press viktig i en demokrati?',
                ['Den granskar makthavarna och ger medborgarna information',
                 'Den bestämmer vilka partier som får ställa upp i valet till riksdagen', 'Den skriver lagarna',
                 'Den räknar rösterna i valet'],
                'Den granskar makthavarna och ger medborgarna information',
                'Utan fri press är det svårt för medborgarna att veta vad makthavarna gör, och att rösta på goda grunder.'),
            sant('Tryckfrihetsförordningen är en av Sveriges grundlagar.', True,
                 'Den skyddar rätten att trycka och sprida skrifter, och innehåller offentlighetsprincipen.'),
        ], beskrivning='Diskrimineringslagen, Europakonventionen och den fria pressen.'),
    ]),
]
