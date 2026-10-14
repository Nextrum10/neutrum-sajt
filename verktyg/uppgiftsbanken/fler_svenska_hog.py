# -*- coding: utf-8 -*-
"""Fler nivåer i svenska för åk 6, 7, 8 och 9 (2026-10-14): fyra nya nivåer
i varje bana, i två nya områden om två nivåer vardera.

- åk 6: ”Bildspråk” (liknelser; metaforer och personifikation) och ”Läsa
  fakta och instruktioner” (en faktatext och en instruktion med lästext).
- åk 7: ”Berättande text” (berättare, miljö och personer; konflikt och
  berättelsens delar) och ”Läsa debatt” (en insändare och ett svar med
  lästext).
- åk 8: ”Reklam och påverkan” (reklamens knep; läs reklam kritiskt) och
  ”Läsa novell” (två noveller med lästext).
- åk 9: ”Språk och variation” (talspråk och skriftspråk; dialekt,
  sociolekt och minoritetsspråk) och ”Läsa och tolka” (en krönika och en
  novell med lästext).

Allt står i TILLAGG och läggs sist i banor som redan finns (svenska.py,
svenska_mer.py). Områdena med lästext har bara nivåer med text och får
därför inget Mästarprov, för frågor ur en lästext dras aldrig dit.

Skrivet från grunden mot Lgr22:s centrala innehåll. Lästexterna och alla
personer, platser och exempel är påhittade för banken; inget är taget ur
ett nationellt prov, en lärobok eller en annan källa. Texten är skriven med
AI och inte läst av någon som undervisar i ämnet.

Samma regler som i svenska.py och svenska_mer.py:

- Rättningen struntar i stora och små bokstäver och i punkt sist, så stor
  bokstav och skiljetecken frågas som val eller ordna, aldrig som skriv.
- En ordna-fråga har bara en rimlig ordning.
- Det lärare inte är ense om frågas inte: komma i gränsfall, i dag eller
  idag, dom, och ord som heter olika i olika läromedel.
- Läsförståelsens frågor går att besvara ur texten ensam. Alla andra frågor
  förstås utan att man har sett en annan fråga.

Förenklat, med flit:
- Berättelsens delar är inledning, problem, höjdpunkt och avslutning, de
  fyra som läromedlen är ense om. Upptrappning, vändpunkt och upplösning
  frågas inte, för de används olika.
- Ungdomsspråk frågas som en sociolekt, och dialekt som språkvariation som
  hör ihop med en region. Minoritetsspråken är de fem som lagen räknar:
  samiska, finska, meänkieli, romani chib och jiddisch.
- Reklamens märkning frågas bara som huvudregeln: reklam ska tydligt
  märkas. Inga paragrafer eller gränsfall mellan gåva och betalning.
"""
from grund import bana, niva, val, skriv, ordna, sant, para, tal

SV = 'Svenska'

# --- Lästexterna, ett stycke per element -----------------------------

# åk 6, faktatext.
MYROR = '\n\n'.join([
    'Myror i skogen',
    'Myror är små insekter som lever i stora samhällen. I skogen kan du hitta stackar som är byggda '
    'av barr och kvistar. En stack kan vara över en meter hög, och inuti finns gångar och kammare '
    'där tusentals myror bor.',
    'Varje samhälle har minst en drottning. Hon lägger äggen och gör inget annat. Arbetarna gör allt '
    'annat: de hämtar mat, bygger stacken och tar hand om äggen och larverna. Myrorna förstår varandra '
    'genom doftämnen och genom att röra vid varandra med sina långa antenner.',
    'Myror äter mycket olika saker, till exempel små insekter, döda djur och söt saft från bladlöss. '
    'När de hotas kan många myror spruta en sur vätska som kallas myrsyra. Den svider i munnen på en '
    'fiende.',
    'Myrorna gör nytta i skogen. De äter skadeinsekter, de luckrar upp jorden, och de bär med sig '
    'frön som växter kan gro ur. På vintern är det för kallt för arbete. Då ligger myrorna stilla '
    'djupt nere i stacken tills det blir varmt igen.',
])

# åk 6, instruktion.
KRASSE = '\n\n'.join([
    'Så odlar du krasse i fönstret',
    'Krasse växer snabbt, och du kan odla den inomhus hela året. Efter ungefär en vecka har du '
    'något som går att äta på smörgåsen.',
    'Du behöver: en tallrik, vitt hushållspapper, vatten och en påse krassefrön.',
    'Så här gör du:\n'
    '1. Lägg två lager hushållspapper på tallriken.\n'
    '2. Häll på vatten så att pappret blir fuktigt men inte simmar.\n'
    '3. Strö ut fröna jämnt över pappret. Tryck inte ner dem.\n'
    '4. Ställ tallriken i ett ljust fönster, men inte i stark sol.\n'
    '5. Häll på lite vatten varje dag, så att pappret hålls fuktigt.\n'
    '6. När plantorna är fem centimeter höga kan du klippa dem med en sax.',
    'Tips: Krasse smakar lite starkt, ungefär som rädisa. Den passar bra på smörgåsar, i sallader '
    'och på ägg.',
])

# åk 7, insändare.
PAPPERSKORGAR = '\n\n'.join([
    'Fler papperskorgar i skolparken',
    'Varje dag äter över hundra elever sin lunch i parken bredvid skolan. Där finns bara två '
    'papperskorgar, och de är fulla redan före lunch. Resten av skräpet hamnar på gräset.',
    'Det här är ett problem av två skäl. För det första blåser skräpet iväg till dammen, och där kan '
    'fåglar fastna i plast. För det andra är det inte trevligt att sitta bland tomma förpackningar, '
    'särskilt inte för den som vill läsa eller vila på rasten.',
    'Jag tycker att skolan borde sätta upp minst sex papperskorgar i parken. De behöver inte vara '
    'dyra, och elevrådet kan gärna måla dem. Då blir det lättare att göra rätt, och parken blir en '
    'plats där alla vill vara.',
    'Så, kära rektor: köp in fler papperskorgar före nästa termin!',
    'Linnea Åkesson, årskurs 7',
])

# åk 7, ett svar på insändaren (replik).
REPLIKEN = '\n\n'.join([
    'Svar till Linnea: problemet är inte korgarna',
    'I förra veckans tidning föreslog Linnea Åkesson att skolan ska sätta upp minst sex nya '
    'papperskorgar i parken. Jag förstår hennes problem, men jag håller inte med om lösningen.',
    'För det första ligger mycket av skräpet redan bredvid de korgar som finns. Det är de som slänger '
    'skräpet på marken som är problemet, inte antalet korgar. Fler korgar hjälper inte om vi inte '
    'bryr oss om att använda dem.',
    'För det andra måste varje korg tömmas, och vaktmästaren har redan mycket att göra. Linnea har '
    'rätt i att korgarna inte behöver vara dyra, men det blir ändå mer arbete för någon.',
    'Jag föreslår därför att klasserna turas om att plocka skräp i parken en gång i veckan. Hjälper '
    'inte det kan vi prata om fler papperskorgar efter jul.',
    'Elias Nordin, årskurs 8',
])

# åk 8, novell i tredje person.
JACKAN = '\n\n'.join([
    'Jackan',
    'Rasmus hade fått jackan av sin kusin Teo. Den var gul och för stor i ärmarna, och på ryggen '
    'satt ett märke från en klubb som ingen i Rasmus klass hade hört talas om.',
    '– Den är jättefin, sa mamma. Och den håller dig varm hela vintern.',
    'På väg till skolan gick Rasmus bakom en häck och knöt ihop ärmarna, så att ingen skulle se hur '
    'långa de var.',
    'I omklädningsrummet satt Elis och Vera. Vera tittade upp.',
    '– Är den där din? Den är ju grym.',
    'Rasmus visste inte om hon skojade. Han mumlade något och hängde jackan längst bak på kroken.',
    'Efter skolan kom en snöstorm. Rasmus tog på sig jackan och gick mot dörren. Där stod Elis i bara '
    'tröjan och skakade av kyla. Han hade glömt sin jacka hemma.',
    'Rasmus tvekade. Sedan drog han av sig jackan och räckte fram den.',
    '– Ta den. Den är för stor på mig ändå.',
    'Elis tog på sig den. Ärmarna räckte ner över hans händer.',
    '– Den är faktiskt rätt bra, sa han.',
])

# åk 8, novell med jag-berättare.
RESVASKAN = '\n\n'.join([
    'Resväskan',
    'Mamma sa att jag bara fick ta med det som ryms i en väska, så jag valde den gamla blå som '
    'pappa haft på sina resor. Locket var täckt av klistermärken: Lissabon, Oslo, Tallinn och en '
    'gul sol som någon hade ritat själv.',
    'Jag packade tröjor, en kudde och fotoalbumet. Kompisarnas gamla brev fick plats längst ner. '
    'Det sista jag lade i var min fotbollströja, men väskan gick inte att stänga med den i, så jag '
    'tog ut den och lade den på sängen igen.',
    'Rummet såg konstigt ut. Utan mina saker på hyllorna var väggarna nästan vita, som om ingen '
    'hade bott där.',
    'Flyttbilen åkte först. Vi körde efter i mammas bil, och jag satt med väskan i knät och '
    'räknade klistermärkena med fingret.',
    '– Det finns plats kvar, sa mamma och mötte min blick i backspegeln. Där borta, vid handtaget.',
    'Jag tittade dit. Det var en tom fläck, precis så stor som ett klistermärke.',
    '– Vi får köpa ett nytt när vi har sett stan, sa jag.',
])

# åk 9, krönika.
KRONIKAN = '\n\n'.join([
    'Vad ska du bli?',
    'Det är frågan jag har fått flest gånger i höst. Av mormor, av grannen, av en tant på bussen '
    'som aldrig har sett mig förut. Jag går i nian, och alla verkar tro att jag har ett svar '
    'klart, som en färdig smörgås.',
    'Jag har inget svar. Jag vet vilket gymnasium jag har valt, men inte vad jag ska göra sedan. '
    'Det känns som om alla andra redan har ritat sin karta, medan min fortfarande är ett vitt '
    'papper med en fläck kaffe.',
    'Häromdagen träffade jag en kollega till pappa. Han är ingenjör nu, men började som kock, och '
    'mellan de två jobben hann han sälja skor och arbeta på en färja. Inget av det var ett '
    'misstag, sa han. Det var vägen dit.',
    'Jag tror att vi lägger för stor vikt vid frågan. En väg är sällan rak, och ingen kan veta vad '
    'som väntar bakom nästa kurva. Så nästa gång någon frågar vad jag ska bli tänker jag svara: '
    '”Äldre.” Det är åtminstone sant.',
    'Alma Sundin, årskurs 9',
])

# åk 9, novell.
RUMMET = '\n\n'.join([
    'Rummet bredvid',
    'I åtta år hade jag hört Idas gitarr genom väggen varje kväll. Först var det bara samma tre '
    'ackord, om och om igen, så att jag ibland tryckte kudden mot öronen och önskade att hon skulle '
    'sluta. Sedan blev det låtar. Jag lärde mig texterna utan att vilja.',
    'I augusti flyttade hon till Umeå för att läsa musik. Mamma grät i hallen, pappa bar kartonger, '
    'och jag stod med armarna i kors och sa att det inte var någon stor sak.',
    'Första kvällen låg jag vaken. Det var så tyst att jag kunde höra kylskåpet ute i köket. Jag '
    'lyssnade efter ett ackord, ett enda, men väggen sa ingenting.',
    'Efter en vecka gick jag in i hennes rum. Gitarren stod kvar i hörnet, den enkla. Den dyra hade '
    'hon tagit med sig. Jag satte mig på sängen och lät tummen glida över strängarna. Det blev ett '
    'skevt, mjukt ljud.',
    'Då hörde jag att jag nynnade på en av hennes låtar.',
])

# Uppdraget: lästexter på 600–1200 tecken.
for _t in (MYROR, KRASSE, PAPPERSKORGAR, REPLIKEN, JACKAN, RESVASKAN, KRONIKAN, RUMMET):
    assert 600 <= len(_t) <= 1200, len(_t)


TILLAGG = [
    # ================================================================
    # ÅRSKURS 6
    # ================================================================
    bana(SV, 'ak6', [
        niva('sv-ak6-fler-bildsprak-1', 'Liknelser', 'Bildspråk', [
            val('Vilken mening innehåller en liknelse?',
                ['Hunden var snabb som en pil.', 'Hunden sprang över gräsmattan.',
                 'Hunden var snabb och glad.'],
                'Hunden var snabb som en pil.',
                'En liknelse jämför två saker med ordet som. Hunden jämförs med en pil, som är mycket snabb.'),
            sant('I en liknelse jämförs två olika saker med varandra, ofta med hjälp av ordet som.', True,
                 'Så fungerar en liknelse. En snabb hund kan till exempel jämföras med en pil, som är snabb.'),
            skriv('Vilket ord fattas i liknelsen? ”Hon var lätt … en fjäder.”', ['som', 'liksom'],
                  'Liknelser jämför med ordet som: lätt som en fjäder. Hon är inte en fjäder, men lika lätt.'),
            val('Vad jämförs snön med i liknelsen ”Snön låg som ett täcke över marken”?',
                ['ett täcke', 'marken', 'kylan', 'en vinterdag'], 'ett täcke',
                'Det som kommer efter ordet som är det man jämför med: ett täcke. Snön är inget riktigt '
                'täcke, men den täcker marken på samma sätt.'),
            para('Para ihop liknelsen med vad den säger om personen eller saken.',
                 [('stark som en björn', 'mycket stark'), ('tyst som en mus', 'mycket tyst'),
                  ('envis som en åsna', 'mycket envis'), ('mjuk som sammet', 'mycket mjuk')],
                 'Det som kommer efter som är en bild av egenskapen: björnen är stark, musen tyst, åsnan '
                 'envis och sammet mjukt.'),
            sant('När man säger att en kompis är ”stark som en björn” menar man att kompisen verkligen är en björn.',
                 False,
                 'En liknelse jämför bara. Kompisen är inte en björn, men är lika stark som en.'),
            val('Vilken mening innehåller INGEN liknelse?',
                ['Isen var hal som såpa.', 'Katten sov i soffan hela dagen.', 'Han var glad som en lärka.'],
                'Katten sov i soffan hela dagen.',
                'I den meningen jämförs ingenting med något annat. De andra jämför med såpa och en lärka '
                'med hjälp av ordet som.'),
            skriv('Vad jämförs molnen med i meningen ”Molnen var mjuka som bomull”? Skriv ordet.',
                  ['bomull', 'bomullen'],
                  'Efter ordet som står bomull. Molnen ser mjuka och lätta ut, och det är det meningen vill säga.'),
            ordna('Bygg liknelsen.', ['Hon', 'var', 'vit', 'som', 'snö.'],
                  forklaring='Jämförelsen kommer efter ordet som: vit som snö.'),
        ], beskrivning='Tränar att känna igen liknelser, vad de jämför och vad de vill säga.'),

        niva('sv-ak6-fler-bildsprak-2', 'Metaforer och personifikation', 'Bildspråk', [
            para('Para ihop meningen med sorten av bildspråk.',
                 [('Vinden viskade i träden.', 'personifikation'), ('Hon är en ängel.', 'metafor'),
                  ('Han var stark som en björn.', 'liknelse'), ('Jag har sagt det tusen gånger!', 'överdrift')],
                 'Vinden kan inte viska på riktigt, så det är en personifikation. Hon är en ängel säger att '
                 'hon är något annat, och det är en metafor. Som visar en liknelse, och tusen gånger är en '
                 'överdrift.'),
            val('Vilken mening innehåller en metafor?',
                ['Klassrummet var en bikupa av röster.', 'Klassrummet var fullt av röster.',
                 'Klassrummet ligger på andra våningen.'],
                'Klassrummet var en bikupa av röster.',
                'En metafor säger att något är något annat. Klassrummet är inget bisamhälle, men det surrar av '
                'röster som en bikupa.'),
            sant('Meningen ”Natten är en svart kappa” är en liknelse.', False,
                 'Ordet som saknas, så det är en metafor. Natten sägs vara en kappa i stället för att jämföras '
                 'med en.'),
            skriv('Vad kallas bildspråket i ”Solen log mot oss över havet”? Skriv ordet.',
                  ['personifikation', 'personifikationen', 'personifiering', 'personifieringen'],
                  'Solen kan inte le. När en sak får mänskliga egenskaper kallas det personifikation.'),
            skriv('Vilket ord i meningen ”Skuggorna dansade på väggen” visar att det är en personifikation? '
                  'Skriv ordet.', 'dansade',
                  'Att dansa är något människor gör. Skuggor kan inte dansa på riktigt, men här får de en '
                  'mänsklig egenskap.'),
            val('Vad betyder metaforen ”Hon har ett hjärta av guld”?',
                ['Hon är väldigt snäll och generös', 'Hon bär ett halsband av äkta guld',
                 'Hon har ärvt väldigt mycket pengar'],
                'Hon är väldigt snäll och generös',
                'Guld är värdefullt. Ett hjärta av guld betyder en person som är god och omtänksam.'),
            sant('I meningen ”Jag är så hungrig att jag kan äta en häst” har skribenten använt en överdrift.',
                 True,
                 'Ingen kan äta en hel häst. Det är en överdrift som visar hur hungrig personen är.'),
            val('Författaren skriver: ”Orden var knivar i hennes bröst.” Vad vill författaren säga?',
                ['Orden sårade henne mycket', 'Någon hade kastat knivar på henne',
                 'Hon var rädd för vassa föremål'],
                'Orden sårade henne mycket',
                'Knivar gör ont, och orden sägs vara knivar. Det är en metafor för att orden sårade henne '
                'djupt. Det finns inga riktiga knivar.'),
            ordna('Bygg metaforen.', ['Livet', 'är', 'en', 'resa.'],
                  forklaring='Livet sägs vara en resa. Det är en metafor eftersom ordet som saknas.'),
        ], beskrivning='Tränar metaforer, personifikation och överdrifter, och skillnaden mot liknelser.'),

        niva('sv-ak6-fler-fakta-1', 'Fladdermöss i Sverige', 'Läsa fakta och instruktioner', [
            skriv('Fladdermusens vingar är gjorda av tunn …. Skriv ordet ur texten.', 'hud',
                  'Det står att vingarna är gjorda av tunn hud som är spänd mellan långa fingrar.'),
            sant('Alla fladdermöss i Sverige äter insekter.', True,
                 'Det står i första stycket: i Sverige lever nästan tjugo olika arter, och alla äter insekter.'),
            skriv('Vad kallas det när en fladdermus hittar sin mat med hjälp av ljud som studsar tillbaka? '
                  'Skriv ordet ur texten.', ['ekolokalisering', 'ekolokaliseringen'],
                  'Fladdermusen skickar ut ljud, och ekot visar var insekten finns. Det kallas ekolokalisering.'),
            val('Varför går fladdermössen i ide på vintern?',
                ['Det finns nästan inga insekter att äta', 'Det blir för mörkt för att hitta ut',
                 'Deras vingar fryser och går sönder'],
                'Det finns nästan inga insekter att äta',
                'Insekterna är fladdermössens mat. Utan mat på vintern sparar de energi genom att sova.'),
            sant('Enligt texten söker fladdermössen upp ett varmt ställe att sova på under vintern.', False,
                 'Texten säger att de söker upp ett kallt men frostfritt ställe, till exempel en grotta eller '
                 'en källare.'),
            val('Vad kan man förstå av att alla arter i Sverige är skyddade av lag?',
                ['Att fladdermössen har det svårt och behöver skydd',
                 'Att fladdermössen är farliga och måste hållas borta',
                 'Att det finns fler fladdermöss i Sverige än någonsin'],
                'Att fladdermössen har det svårt och behöver skydd',
                'Texten säger att många fladdermöss har det svårt när de gamla träden och byggnaderna '
                'försvinner. Därför skyddar lagen alla arter.'),
            val('Vad betyder ordet ”frostfritt” i texten?',
                ['Utan minusgrader', 'Täckt av is', 'Helt utan ljus'], 'Utan minusgrader',
                'Frost är kyla under noll grader. Ett frostfritt ställe är ett ställe där det inte fryser.'),
            ordna('Ordna det som händer när en fladdermus jagar.',
                  ['Fladdermusen skickar ut ett ljud.', 'Ljudet träffar en insekt.',
                   'Ljudet studsar tillbaka som ett eko.', 'Fladdermusen hör var insekten finns.'],
                  forklaring='Först kommer ljudet, sedan träffen och ekot. Av ekot hör fladdermusen var '
                             'insekten finns.'),
            skriv('Vad äter fladdermössen i Sverige? Skriv ordet ur texten.', ['insekter', 'insekt', 'myggor'],
                  'Det står att alla arter äter insekter, och att en liten fladdermus kan fånga hundratals myggor.'),
        ], beskrivning='En faktatext om fladdermöss, med frågor om vad som står, vad ett ord betyder och '
                       'vad man kan förstå av texten.',
            text=FLADDERMOSS),

        niva('sv-ak6-fler-fakta-2', 'Så odlar du krasse', 'Läsa fakta och instruktioner', [
            ordna('Ordna stegen i den ordning du ska göra dem.',
                  ['Lägg hushållspapper på tallriken.', 'Häll på vatten så att pappret blir fuktigt.',
                   'Strö ut fröna över pappret.', 'Ställ tallriken i ett ljust fönster.'],
                  forklaring='Underlaget kommer först, sedan vattnet och fröna, och till sist tallriken i '
                             'fönstret. Det är den ordning som stegen står i.'),
            skriv('Hur många lager hushållspapper ska du lägga på tallriken? Svara med en siffra.',
                  [tal(2), 'två'], 'I steg 1 står det att du ska lägga två lager hushållspapper på tallriken.'),
            sant('Du ska trycka ner fröna i pappret.', False,
                 'I steg 3 står det att du inte ska trycka ner fröna. Du ska bara strö ut dem.'),
            val('Hur ofta ska du hälla på lite vatten när fröna ligger på pappret?',
                ['Varje dag', 'Varannan dag', 'En gång i veckan'], 'Varje dag',
                'Steg 5 säger att du ska hälla på lite vatten varje dag, så att pappret hålls fuktigt.'),
            skriv('Hur högt ska plantorna vara innan du klipper dem? Svara med antal centimeter.',
                  [tal(5), 'fem'], 'Steg 6 säger att du kan klippa dem när de är fem centimeter höga.'),
            val('Hur mycket vatten ska du hälla på första gången?',
                ['Så att pappret blir fuktigt, men inte simmar', 'Så att hela tallriken fylls med vatten',
                 'Bara en enda liten droppe över pappret'],
                'Så att pappret blir fuktigt, men inte simmar',
                'Steg 2 säger att pappret ska bli fuktigt men inte simma.'),
            val('Mia sår krassefrön en måndag. När kan hon ungefär börja äta krassen?',
                ['Ungefär en vecka senare', 'Redan samma kväll', 'Efter ungefär en månad'],
                'Ungefär en vecka senare',
                'Första stycket säger att det går att äta krassen efter ungefär en vecka.'),
            skriv('Vilken grönsak liknar krassens smak, enligt texten? Skriv ordet.',
                  ['rädisa', 'rädisan', 'rädisor'],
                  'Texten säger att krasse smakar lite starkt, ungefär som rädisa.'),
            para('Para ihop sakerna med vad de används till.',
                 [('hushållspapper', 'det som fröna ligger på'), ('vatten', 'det som håller pappret fuktigt'),
                  ('sax', 'det man klipper plantorna med'), ('ljust fönster', 'platsen där tallriken står')],
                 'Allt står i stegen: pappret är underlaget, vattnet ger fukt, saxen klipper plantorna och '
                 'fönstret ger ljus.'),
        ], beskrivning='En instruktion för att odla krasse, med frågor om stegens ordning och om det som '
                       'står i texten.',
            text=KRASSE),
    ]),

    # ================================================================
    # ÅRSKURS 7
    # ================================================================
    bana(SV, 'ak7', [
        niva('sv-ak7-fler-beratta-1', 'Berättare, miljö och personer', 'Berättande text', [
            para('Para ihop textutdraget med berättaren.',
                 [('”Jag stod kvar på bryggan och väntade.”', 'jag-berättare'),
                  ('”Alva stod kvar på bryggan och väntade.”', 'tredjepersonsberättare')],
                 'En jag-berättare är med i handlingen och säger jag. En tredjepersonsberättare står utanför '
                 'och använder namn eller han och hon.'),
            sant('En författare kan hitta på en jag-berättare som är en helt annan person än författaren själv.',
                 True,
                 'Jaget i en berättelse är en roll som författaren skapar. Det behöver inte vara författaren.'),
            skriv('Skriv ordet: Platsen och tiden där en berättelse utspelar sig kallas berättelsens …',
                  ['miljö', 'miljön'],
                  'Miljön är var och när något händer: en strand en sommardag eller en rymdstation i framtiden.'),
            val('Vilken mening beskriver miljön?',
                ['En kall novemberkväll lyste gatlyktorna svagt.', 'Hon blev så rädd att hon började springa.',
                 'Han hette Elias och var tolv år gammal.'],
                'En kall novemberkväll lyste gatlyktorna svagt.',
                'Miljön är var och när något sker. Här får vi veta årstid, tid på dygnet och hur platsen ser ut. '
                'De andra meningarna handlar om vad en person känner och vem han är.'),
            sant('I en berättelse med jag-berättare får läsaren aldrig veta vad berättaren tänker.', False,
                 'Tvärtom: en jag-berättare kan berätta om sina egna tankar och känslor, och därför kommer '
                 'läsaren nära berättaren.'),
            val('Berättaren skriver: ”Tim slog igen dörren så att glaset i fönstret skakade.” Vad får läsaren '
                'veta om Tim utan att det sägs rakt ut?',
                ['Att Tim är arg', 'Att Tim är glad', 'Att Tim är trött'], 'Att Tim är arg',
                'Att slå igen en dörr hårt visar ilska. Författaren visar känslan genom vad Tim gör, i stället '
                'för att skriva att han är arg.'),
            para('Para ihop begreppet med vad det betyder.',
                 [('berättare', 'rösten som berättar historien'),
                  ('stämning', 'den känsla texten skapar hos läsaren'),
                  ('replik', 'det en person säger i ett samtal'),
                  ('huvudperson', 'den som berättelsen mest handlar om')],
                 'Begreppen hjälper dig att prata om en text: vem som berättar, vilken känsla texten ger, '
                 'vad personerna säger och vem berättelsen följer.'),
            val('Varför väljer en författare ibland en jag-berättare?',
                ['Läsaren kommer nära en persons tankar', 'Berättelsen behöver då ingen handling',
                 'Texten blir då helt och hållet sann'],
                'Läsaren kommer nära en persons tankar',
                'Jaget kan berätta hur det känns inifrån, och det gör att läsaren kommer nära. En jag-text '
                'behöver lika mycket handling som andra berättelser, och den är inte mer sann.'),
        ], beskrivning='Tränar jag-berättare och tredjepersonsberättare, miljö, stämning och att visa känslor '
                       'genom vad personer gör.'),

        niva('sv-ak7-fler-beratta-2', 'Konflikt och berättelsens delar', 'Berättande text', [
            ordna('Ordna delarna i en berättelse i den ordning de oftast kommer.',
                  ['Inledning', 'Problem', 'Höjdpunkt', 'Avslutning'],
                  forklaring='Berättelsen börjar med en inledning där man får veta vilka som är med. Sedan '
                             'kommer ett problem, och spänningen stiger till höjdpunkten. Sist kommer avslutningen.'),
            val('Vad är en konflikt i en berättelse?',
                ['Ett problem som huvudpersonen måste hantera', 'En scen där två personer pratar med varandra',
                 'Berättelsens allra första mening i texten'],
                'Ett problem som huvudpersonen måste hantera',
                'En konflikt är en motsättning eller ett problem som driver berättelsen framåt. Utan något '
                'som händer eller går fel finns det inget att läsa vidare om.'),
            val('Vilket exempel är en inre konflikt?',
                ['Elin vill erkänna att hon tagit pennan, men skäms.', 'Elin och Sam bråkar om vems penna det är.',
                 'Elin hittar en penna på golvet i hallen.'],
                'Elin vill erkänna att hon tagit pennan, men skäms.',
                'En inre konflikt finns inne i huvudpersonen: Elin vill en sak men något håller henne tillbaka. '
                'Bråket med Sam är en yttre konflikt, och att hitta en penna är ingen konflikt alls.'),
            sant('En yttre konflikt är en konflikt mellan huvudpersonen och något utanför henne, till exempel '
                 'en annan person.', True,
                 'En yttre konflikt finns mellan huvudpersonen och en person, en grupp eller en händelse utanför '
                 'henne. Motsatsen är en inre konflikt.'),
            val('Texten lyder: ”Det var tidigt på morgonen i en liten fiskeby. Ines, som var tolv år, vaknade '
                'av att havet bullrade utanför fönstret.” Vilken del av en berättelse är det troligast att '
                'texten kommer från?',
                ['inledningen', 'höjdpunkten', 'avslutningen'], 'inledningen',
                'Texten presenterar en person och en plats. Det görs oftast i inledningen, innan något '
                'har gått fel.'),
            sant('Höjdpunkten är den första delen i en berättelse.', False,
                 'Höjdpunkten kommer när spänningen är som störst, långt efter inledningen.'),
            skriv('Skriv ordet: En konflikt inne i huvudpersonen själv kallas en … konflikt.', 'inre',
                  'Det är en inre konflikt när huvudpersonen kämpar med sina egna tankar och känslor.'),
            para('Para ihop berättelsens del med vad som händer där.',
                 [('Inledning', 'Personerna och miljön presenteras'),
                  ('Problem', 'Något går fel eller någon vill något'),
                  ('Höjdpunkt', 'Spänningen är som störst'),
                  ('Avslutning', 'Berättelsen knyts ihop')],
                 'Delarna bygger upp berättelsen: först presenteras allt, sedan kommer problemet, spänningen '
                 'stiger och till sist knyts historien ihop.'),
            skriv('Skriv ordet: En konflikt mellan huvudpersonen och en annan person kallas en … konflikt.',
                  'yttre',
                  'En konflikt mellan två personer finns utanför huvudpersonen. Det är en yttre konflikt.'),
        ], beskrivning='Tränar konflikt, inre och yttre konflikt och de fyra delarna i en berättelse.'),

        niva('sv-ak7-fler-debatt-1', 'Fler cykelställ vid skolan', 'Läsa debatt', [
            val('Vad är skribentens tes?',
                ['Skolan borde bygga ett nytt cykelställ', 'Alla elever ska cykla till skolan',
                 'Rektorn ska köpa nya cyklar'],
                'Skolan borde bygga ett nytt cykelställ',
                'Tesen är skribentens huvudåsikt. Den står i tredje stycket: skolan borde bygga ett nytt '
                'cykelställ med plats för minst hundrafemtio cyklar.'),
            skriv('Hur många cyklar får plats i det nuvarande cykelstället? Svara med ett tal.',
                  [tal(60), 'sextio'],
                  'Det står i första stycket att det finns plats för sextio cyklar.'),
            sant('Enligt texten cyklar fler än hundra elever till skolan när det är fint väder.', True,
                 'Det står att över hundra elever cyklar hit när det är fint väder.'),
            val('Vilket är det första skälet som skribenten ger för att trängseln är ett problem?',
                ['Cyklarna kan falla omkull och gå sönder', 'Det är dyrt att köpa en ny cykel',
                 'Eleverna kommer för sent till lektionen'],
                'Cyklarna kan falla omkull och gå sönder',
                'Andra stycket säger: för det första blir cyklarna lätt nedtrampade eller faller omkull, och '
                'då kan de gå sönder.'),
            val('Varför nämner skribenten kryckor och rullstol?',
                ['Trängseln kan vara extra svår för vissa elever', 'Skolan behöver köpa fler rullstolar nu',
                 'En elev har skadats av en cykel vid entrén'],
                'Trängseln kan vara extra svår för vissa elever',
                'Skribenten använder dem som exempel på dem som har svårast att ta sig fram när entrén är full '
                'av cyklar. Det är det andra skälet till att trängseln är ett problem.'),
            sant('Skribenten menar att ett nytt cykelställ måste bli mycket dyrt.', False,
                 'Texten säger tvärtom: det behöver inte bli dyrt.'),
            ordna('Ordna delarna i insändaren i den ordning de kommer.',
                  ['Skribenten beskriver problemet.', 'Skribenten ger två skäl.',
                   'Skribenten föreslår en lösning.', 'Skribenten uppmanar rektorn.'],
                  forklaring='Först beskrivs problemet, sedan kommer skälen, därefter förslaget och sist en '
                             'uppmaning till rektorn.'),
            skriv('Vem vänder sig skribenten till i den sista meningen? Skriv ordet.',
                  ['rektor', 'rektorn', 'kära rektor'],
                  'Den sista meningen börjar ”Så, kära rektor”. Skribenten ber rektorn sätta upp fler cykelställ.'),
            para('Para ihop ordet ur texten med vad det betyder.',
                 [('entrén', 'ingången till en byggnad'), ('skjutsad', 'körd i bil av någon annan'),
                  ('kryckor', 'stöd man går med efter en skada'), ('hälsan', 'hur bra man mår i kroppen')],
                 'Orden står i texten: entrén är ingången till skolan, och bli skjutsad betyder att någon kör '
                 'en med bil.'),
        ], beskrivning='En insändare om ett för litet cykelställ, med frågor om tes, skäl och uppbyggnad.',
            text=CYKELSTALL),

        niva('sv-ak7-fler-debatt-2', 'Svar till Linnea', 'Läsa debatt', [
            skriv('Elias texten är ett svar på någon annans insändare. Vad kallas ett sådant svar i en debatt? '
                  'Skriv ordet.', ['replik', 'repliken', 'en replik', 'svar'],
                  'Ett svar på någon annans inlägg i en debatt kallas replik. Elias bemöter Linneas förslag.'),
            val('Vad är Elias tes?',
                ['Skolan bör först visa var cykelställen finns', 'Skolan ska ta bort det gamla cykelstället',
                 'Skolan ska bygga ett nytt cykelställ direkt'],
                'Skolan bör först visa var cykelställen finns',
                'Elias håller inte med om att man ska bygga nytt. Han föreslår en skylt först, så att fler hittar '
                'de platser som redan finns.'),
            skriv('Hur många cyklar får plats i det gamla cykelstället bakom gymnastiksalen? Svara med ett tal.',
                  [tal(40), 'fyrtio'],
                  'Det står i andra stycket att det finns plats för fyrtio cyklar.'),
            sant('Elias tycker inte att Linnea har något problem alls.', False,
                 'Han skriver att han förstår hennes problem. Det är lösningen han inte håller med om.'),
            val('Varför används det gamla cykelstället knappt, enligt Elias?',
                ['Många vet inte att det finns', 'Det har varit trasigt i flera år', 'Det är för litet för moderna cyklar'],
                'Många vet inte att det finns',
                'Han skriver att många inte vet om det eftersom stället inte syns från entrén.'),
            val('Vad vill Elias troligen att skolan gör först?',
                ['Att fler får veta var det gamla stället finns', 'Att skolan genast köper ett nytt ställ',
                 'Att eleverna slutar cykla till skolan'],
                'Att fler får veta var det gamla stället finns',
                'Hans förslag är en tydlig skylt och att elevrådet visar vägen. Han vill alltså först få fler '
                'att hitta det som redan finns.'),
            sant('Elias utesluter inte att skolan kan bygga ett nytt cykelställ senare.', True,
                 'Sista stycket säger: räcker inte det kan vi prata om ett nytt cykelställ i vår.'),
            ordna('Ordna delarna i svaret i den ordning de kommer.',
                  ['Elias hänvisar till Linneas förslag.', 'Elias ger sitt första skäl.',
                   'Elias ger sitt andra skäl.', 'Elias kommer med ett eget förslag.'],
                  forklaring='Svaret börjar med Linneas förslag. Sedan kommer två skäl mot det, och sist Elias '
                             'eget förslag.'),
            para('Para ihop ordet ur texten med vad det betyder.',
                 [('knappt', 'nästan inte alls'), ('kostnad', 'pengar som något kostar'),
                  ('lösningen', 'sättet att lösa ett problem'), ('tydlig', 'lätt att se och förstå')],
                 'Orden står i texten: ett cykelställ används knappt alls, ett nytt ställe blir en kostnad, och '
                 'skylten ska vara tydlig.'),
        ], beskrivning='Ett svar på en insändare, med frågor om replik, skäl och hur skribenten bemöter '
                       'ett förslag.',
            text=REPLIKEN),
    ]),

    # ================================================================
    # ÅRSKURS 8
    # ================================================================
    bana(SV, 'ak8', [
        niva('sv-ak8-fler-reklam-1', 'Reklamens knep', 'Reklam och påverkan', [
            para('Para ihop reklamens knep med ett exempel.',
                 [('överdrift', '”Världens godaste glass!”'),
                  ('tidspress', '”Köp i dag, erbjudandet slutar klockan 18!”'),
                  ('känd förebild', '”Löparstjärnan Nora Vik tränar i dem varje dag.”'),
                  ('känslor', '”Ge dem du älskar en riktig stund tillsammans.”')],
                 'Överdriften påstår för mycket, tidspressen får oss att skynda, en känd person ska vara en '
                 'förebild, och känslorna ska få oss att vilja ha varan.'),
            skriv('Vad kallas de människor som en reklam vill nå? Skriv ordet.',
                  ['målgrupp', 'målgruppen', 'målgrupper'],
                  'Målgruppen är de människor som reklamen riktar sig till, till exempel ungdomar eller föräldrar.'),
            val('En reklamfilm för en ny skateboard visar tonåringar som åker i en skatepark till snabb musik. '
                'Vilken är troligen målgruppen?',
                ['Ungdomar', 'Pensionärer', 'Småbarnsföräldrar', 'Cykelbutiker'], 'Ungdomar',
                'Reklamen visar tonåringar och snabb musik, och det är ungdomar den vill nå.'),
            sant('En slogan är en kort fras som ska vara lätt att komma ihåg.', True,
                 'Slogans är korta och ofta med rim eller upprepning, så att de fastnar.'),
            sant('När en reklam säger ”Världens godaste glass!” är det ett faktum som går att bevisa.', False,
                 'Vad som är godast är en åsikt, och ”världens” är en överdrift. Det går inte att kontrollera.'),
            skriv('Vad kallas det när reklamen påstår att något är bättre än det kan vara, som ”världens bästa”? '
                  'Skriv ordet.', ['överdrift', 'överdriften', 'överdrifter', 'hyperbol'],
                  'En överdrift låter bättre än verkligheten. Den är ett vanligt knep i reklam.'),
            val('Vilket påstående i en reklam går att kontrollera?',
                ['Varje burk innehåller 330 milliliter.', 'Det allra godaste du någonsin kan dricka!',
                 'Alla i hela världen älskar den här läsken!'],
                'Varje burk innehåller 330 milliliter.',
                'En volym går att mäta. Vad som är godast och vad alla tycker är åsikter eller överdrifter.'),
            val('Varför visar reklam ofta glada människor?',
                ['För att koppla varan till goda känslor', 'För att visa hur varan tillverkas',
                 'För att berätta exakt vad varan kostar'],
                'För att koppla varan till goda känslor',
                'Reklam vill att vi ska känna något positivt för varan. Glada människor kan få oss att '
                'förknippa den med glädje.'),
            skriv('Vad kallas den som har gjort och betalat en reklam? Skriv ordet.',
                  ['avsändare', 'avsändaren', 'annonsör', 'annonsören'],
                  'Avsändaren är den som står bakom reklamen, ofta ett företag.'),
        ], beskrivning='Tränar reklamens knep: målgrupp, slogan, överdrift, tidspress, känslor och skillnaden '
                       'mellan fakta och åsikt.'),

        niva('sv-ak8-fler-reklam-2', 'Läs reklam kritiskt', 'Reklam och påverkan', [
            para('Para ihop frågan man kan ställa till en reklam med det den handlar om.',
                 [('Vem har betalat för reklamen?', 'avsändaren'), ('Vem försöker den nå?', 'målgruppen'),
                  ('Vad vill den att jag ska göra?', 'syftet'), ('Vad berättar den inte om?', 'det som utelämnas')],
                 'Fyra bra frågor att ställa: vem som står bakom, vem den riktar sig till, vad den vill och '
                 'vad den lämnar osagt.'),
            sant('Reklam ska vara tydligt märkt så att man förstår att det är reklam.', True,
                 'Det är huvudregeln. Ett inlägg som är betalt av ett företag ska tydligt visa att det är reklam.'),
            val('En butik skriver ”Upp till 70 % rabatt!”. Vad betyder det?',
                ['Att 70 % är högsta rabatten, andra varor kan ha mindre',
                 'Att alla varor i butiken har 70 % rabatt just nu',
                 'Att varje vara kostar exakt 70 kronor just nu'],
                'Att 70 % är högsta rabatten, andra varor kan ha mindre',
                'Upp till betyder att 70 % är det mesta. Många varor kan ha en mindre rabatt, och några kanske '
                'ingen alls.'),
            skriv('Reklamen säger ”Testvinnare!” men inte vem som gjort testet. Vilket frågeord ska stå i '
                  'luckan i frågan ”… har gjort testet, och vad jämfördes?”', ['vem', 'vilka'],
                  'Utan att veta vem som testat går det inte att bedöma om ”testvinnare” är värt något. Företaget '
                  'kan ha gjort testet själv.'),
            sant('Om en känd person använder en produkt är det ett bevis för att produkten är bra.', False,
                 'En känd person kan ha fått betalt, och ett namn är inget bevis. Kvaliteten går att kontrollera '
                 'på andra sätt.'),
            para('Para ihop påståendet i en reklam med vad det är för slags påstående.',
                 [('Burken innehåller 400 gram.', 'Går att väga och kontrollera'),
                  ('Smakar helt fantastiskt!', 'En åsikt om smak'),
                  ('Billigast i stan!', 'Går att kontrollera med prisjämförelse'),
                  ('Alla älskar den!', 'Överdrift som inte går att bevisa')],
                 'Vikt kan man väga och priser kan man jämföra. Smak är en åsikt, och alla älskar den går inte '
                 'att bevisa.'),
            val('En reklam säger ”Bara i dag!”. Hur kan ett sådant erbjudande påverka oss?',
                ['Vi får mindre tid att jämföra och tänka efter', 'Vi blir säkrare på att varan är bra',
                 'Vi får bättre kvalitet på varan i dag'],
                'Vi får mindre tid att jämföra och tänka efter',
                'Tidspress får oss att skynda. Då hinner vi inte jämföra priser eller fundera på om vi '
                'verkligen behöver varan.'),
            skriv('Reklam som inte tydligt säger att den är reklam, fast ett företag har betalat för den, kallas '
                  'ofta … reklam. Skriv ordet.', ['dold', 'smyg', 'dold reklam', 'smygreklam'],
                  'Det kallas dold reklam eller smygreklam. Den som läser kan tro att det bara är en åsikt.'),
            val('En känd person visar en ny energidryck och skriver ”Min nya favorit!”, utan att nämna att det '
                'är reklam. Vad är klokast att tänka?',
                ['Det kan vara betalt även om det inte står där', 'Det är säkert bara personens egen åsikt',
                 'Drycken är bra om personen säger det'],
                'Det kan vara betalt även om det inte står där',
                'Reklam ska märkas, men gör den inte det bör man vara försiktig. Fråga vem som tjänar på att '
                'inlägget finns.'),
        ], beskrivning='Tränar att granska reklam: avsändare, målgrupp, syfte, fakta och åsikt, och dold reklam.'),

        niva('sv-ak8-fler-novell-1', 'Jackan', 'Läsa novell', [
            skriv('Jackan var gul och för … i ärmarna. Skriv ordet ur texten.', ['stor', 'för stor'],
                  'Det står i början: den var gul och för stor i ärmarna.'),
            val('Varför knöt Rasmus ihop ärmarna?',
                ['Han ville dölja att jackan var för stor', 'Det blåste så att ärmarna fladdrade',
                 'Mamma hade bett honom göra det'],
                'Han ville dölja att jackan var för stor',
                'Det står att han gjorde det så att ingen skulle se hur långa ärmarna var. Han skämdes lite '
                'över jackan.'),
            sant('Rasmus hade köpt jackan själv.', False,
                 'Han hade fått den av sin kusin Teo.'),
            skriv('Vem hade Rasmus fått jackan av? Skriv namnet.',
                  ['Teo', 'kusinen Teo', 'sin kusin Teo', 'kusin Teo', 'hans kusin Teo'],
                  'Det står i första meningen: Rasmus hade fått jackan av sin kusin Teo.'),
            val('Vad visar det att Rasmus ger sin jacka till Elis?',
                ['Han vill hjälpa Elis, fast han är osäker själv', 'Han har själv glömt att det är snöstorm ute',
                 'Han vill att Elis ska skämmas över tröjan'],
                'Han vill hjälpa Elis, fast han är osäker själv',
                'Rasmus skämdes för jackan men tvekar bara en stund. Elis fryser, och Rasmus väljer att hjälpa '
                'honom trots att han själv är osäker.'),
            val('Hur tar Rasmus emot Veras kommentar om jackan?',
                ['Han blir osäker på om hon skojar', 'Han blir mycket glad och stolt', 'Han blir arg och svarar högt'],
                'Han blir osäker på om hon skojar',
                'Det står att Rasmus inte visste om hon skojade. Han mumlar något och hänger undan jackan.'),
            val('Vilken uppgift har snöstormen i berättelsen?',
                ['Den gör att Rasmus måste välja något', 'Den visar att vintern i år är lång',
                 'Den gör att skolan stänger tidigare'],
                'Den gör att Rasmus måste välja något',
                'Snöstormen och Elis kyla skapar läget där Rasmus kan välja mellan att behålla jackan och '
                'att ge bort den.'),
            skriv('Vem säger att jackan är grym? Skriv namnet.', 'Vera',
                  'Vera säger i omklädningsrummet: ”Den är ju grym.”'),
            ordna('Ordna händelserna i den ordning de kommer i novellen.',
                  ['Rasmus knyter ihop ärmarna.', 'Vera säger att jackan är grym.', 'Snöstormen kommer.',
                   'Rasmus ger jackan till Elis.'],
                  forklaring='Först knyter Rasmus ärmarna på väg till skolan. Veras kommentar kommer i '
                             'omklädningsrummet, snöstormen efter skolan och sist ger han bort jackan.'),
        ], beskrivning='En novell om en jacka som är för stor, med frågor om vad som står, vad personerna '
                       'känner och vad slutet visar.',
            text=JACKAN),

        niva('sv-ak8-fler-novell-2', 'Resväskan', 'Läsa novell', [
            skriv('Vem hade haft väskan på sina resor? Skriv ordet.',
                  ['pappa', 'pappan', 'min pappa', 'berättarens pappa'],
                  'Det står att berättaren valde den gamla blå väskan som pappa haft på sina resor.'),
            sant('Berättaren packar ner fotbollströjan i väskan och tar med den.', False,
                 'Väskan gick inte att stänga med tröjan i, så berättaren tog ut den och lade den på sängen igen.'),
            val('Vad vill berättaren visa med jämförelsen ”som om ingen hade bott där”?',
                ['Att rummet känns tomt utan alla saker', 'Att ingen någonsin har städat rummet',
                 'Att rummet har blivit alldeles för kallt'],
                'Att rummet känns tomt utan alla saker',
                'När hyllorna är tomma ser rummet nästan ut som om ingen har bott där. Jämförelsen visar hur '
                'tomt det känns.'),
            val('Vad kan den tomma fläcken vid handtaget vara en symbol för?',
                ['Att det finns plats för något nytt', 'Att väskan har gått sönder', 'Att något viktigt har glömts hemma'],
                'Att det finns plats för något nytt',
                'Fläcken väntar på ett nytt klistermärke, precis som berättaren kommer att få nya minnen på det '
                'nya stället. Berättaren svarar också att de ska köpa ett nytt.'),
            val('Hur känner sig berättaren troligen inför flytten?',
                ['Både ledsen och en aning hoppfull', 'Helt likgiltig och glad att flytta',
                 'Mycket arg på mamma och pappa'],
                'Både ledsen och en aning hoppfull',
                'Fotoalbumet och kompisarnas brev följer med, och berättaren bär väskan själv. Men berättaren '
                'säger också att de ska köpa ett nytt klistermärke, och det är hoppfullt.'),
            skriv('Hur många städer står på klistermärkena enligt texten? Svara med en siffra.',
                  [tal(3), 'tre'],
                  'Det står Lissabon, Oslo och Tallinn. Den gula solen är ingen stad.'),
            ordna('Ordna händelserna i den ordning de kommer i novellen.',
                  ['Berättaren packar väskan.', 'Berättaren tar ut fotbollströjan.', 'Flyttbilen åker först.',
                   'Mamma säger att det finns plats kvar.'],
                  forklaring='Berättaren packar först och tar sedan ut tröjan. Därefter åker flyttbilen, och '
                             'i bilen säger mamma att det finns plats kvar på väskan.'),
            sant('Berättaren packar både fotoalbumet och kompisarnas gamla brev.', True,
                 'Det står att berättaren packade tröjor, en kudde och fotoalbumet, och att kompisarnas gamla '
                 'brev fick plats längst ner.'),
            skriv('Vad räknade berättaren med fingret under bilresan? Skriv ordet.',
                  ['klistermärkena', 'klistermärken', 'klistermärke'],
                  'Berättaren satt med väskan i knät och räknade klistermärkena med fingret.'),
        ], beskrivning='En novell med jag-berättare om en flytt, med frågor om vad som står, om symboler och '
                       'om vad berättaren känner.',
            text=RESVASKAN),
    ]),

    # ================================================================
    # ÅRSKURS 9
    # ================================================================
    bana(SV, 'ak9', [
        niva('sv-ak9-fler-variation-1', 'Talspråk och skriftspråk', 'Språk och variation', [
            para('Para ihop begreppet med vad det betyder.',
                 [('talspråk', 'språket vi använder när vi pratar'),
                  ('skriftspråk', 'språket vi använder när vi skriver'),
                  ('utfyllnadsord', 'ord som liksom och typ som fyller ut talet'),
                  ('stilnivå', 'hur formellt eller vardagligt språket är')],
                 'Talspråk och skriftspråk skiljer sig åt. I tal använder vi ofta utfyllnadsord, och stilnivån '
                 'visar hur formellt vi uttrycker oss.'),
            val('Vilken mening är skriven i talspråk?',
                ['Jag hann liksom inte, det blev typ för mycket.', 'Jag hann tyvärr inte, eftersom det blev för mycket.',
                 'Jag hann inte på grund av en stor arbetsbörda.'],
                'Jag hann liksom inte, det blev typ för mycket.',
                'Liksom och typ är utfyllnadsord som hör till talet. De andra meningarna är mer formella.'),
            sant('Man kan ändra och förbättra en skriven text innan någon läser den, men inte ett ord som redan '
                 'har sagts högt.', True,
                 'Det är en av skillnaderna. Skriftspråket går att planera och rätta, men det sagda ordet är redan '
                 'hörda.'),
            skriv('Vilket ord i meningen ”Det var liksom jättekul” är ett utfyllnadsord? Skriv ordet.', 'liksom',
                  'Liksom fyller ut meningen utan att tillföra någon betydelse. Sådana ord hör till talspråket.'),
            sant('Talspråk är ett sämre språk än skriftspråk.', False,
                 'Ingen av dem är bättre. De passar för olika situationer: samtal med kompisar kräver inte samma '
                 'språk som en ansökan.'),
            val('Varför passar skriftspråk bäst i en ansökan om sommarjobb?',
                ['Mottagaren väntar sig ett tydligt språk', 'Skriftspråk är alltid roligare att läsa',
                 'Alla ansökningar måste vara långa'],
                'Mottagaren väntar sig ett tydligt språk',
                'En ansökan läses av någon som inte känner dig. Då är ett tydligt, genomtänkt språk viktigt.'),
            para('Para ihop det talspråkliga ordet med ordet som passar i en formell text.',
                 [('nåt', 'något'), ('sen', 'sedan'), ('typ', 'ungefär'), ('kolla', 'undersöka')],
                 'I formell text väljer man ordet som skriftspråket använder, och man undviker förkortade '
                 'talspråksformer.'),
            skriv('Chattar och sms är skrivna, men språket påminner ofta om det vi säger i samtal. Chattspråk '
                  'ligger därför närmare … än vanligt skriftspråk. Skriv ordet.',
                  ['talspråk', 'talspråket'],
                  'Chattar liknar samtal: korta meningar, utfyllnadsord och vardagliga ord. Därför ligger '
                  'chattspråk närmare talspråket.'),
        ], beskrivning='Tränar skillnaden mellan talspråk och skriftspråk, utfyllnadsord och stilnivå.'),

        niva('sv-ak9-fler-variation-2', 'Dialekt, ungdomsspråk och minoritetsspråk', 'Språk och variation', [
            para('Para ihop begreppet med vad det betyder.',
                 [('dialekt', 'språkvariant som hör ihop med en region'),
                  ('sociolekt', 'språkvariant som hör ihop med en grupp, som en åldersgrupp'),
                  ('idiolekt', 'en enskild persons eget sätt att tala och skriva'),
                  ('standardsvenska', 'den form av svenska som de flesta förstår överallt')],
                 'Dialekten hör till en plats, sociolekten till en grupp och idiolekten till en enda person. '
                 'Standardsvenskan är den gemensamma formen.'),
            skriv('Skånska, göteborgska och norrländska är exempel på vad? Skriv ordet.',
                  ['dialekter', 'dialekt', 'dialekterna', 'språkvarianter'],
                  'Det är dialekter. En dialekt är en språkvariant som hör ihop med en region.'),
            val('Ungdomsspråk, alltså ord och uttryck som är typiska för unga, är ett exempel på:',
                ['en sociolekt', 'en dialekt', 'en idiolekt', 'ett nationellt minoritetsspråk'],
                'en sociolekt',
                'En sociolekt hör ihop med en social grupp, här en åldersgrupp. Den hänger inte ihop med var man '
                'bor, och den är heller inte en enskild persons språk.'),
            sant('Alla som bor på samma ort talar precis likadant.', False,
                 'Varje människa har sitt eget sätt att tala och skriva, en idiolekt, även om man delar dialekt.'),
            sant('Samiska, finska och meänkieli är några av Sveriges nationella minoritetsspråk.', True,
                 'De nationella minoritetsspråken är samiska, finska, meänkieli, romani chib och jiddisch.'),
            skriv('Hur många nationella minoritetsspråk har Sverige? Svara med en siffra.',
                  [tal(5), 'fem'],
                  'Det är fem: samiska, finska, meänkieli, romani chib och jiddisch.'),
            val('Vad kan ungdomsspråk bland annat användas till?',
                ['Att visa att man hör till en grupp', 'Att göra språket mer formellt',
                 'Att göra alla ord längre'],
                'Att visa att man hör till en grupp',
                'Orden och uttrycken fungerar som ett gemensamt kännetecken. Den som använder dem visar att hen '
                'hör ihop med de andra.'),
            val('I vilken del av Sverige talas meänkieli?',
                ['Tornedalen', 'Skåne', 'Gotland', 'Bohuslän'], 'Tornedalen',
                'Meänkieli talas i Tornedalen längst i norr, vid gränsen mot Finland.'),
        ], beskrivning='Tränar dialekt, sociolekt, idiolekt och standardsvenska, ungdomsspråk och Sveriges '
                       'nationella minoritetsspråk.'),

        niva('sv-ak9-fler-tolka-1', 'Vad ska du bli?', 'Läsa och tolka', [
            val('Vad är krönikans huvudbudskap?',
                ['Att det är okej att inte veta än vad man blir', 'Att man måste välja ett yrke redan i nian',
                 'Att kockar och ingenjörer har bäst framtid'],
                'Att det är okej att inte veta än vad man blir',
                'Skribenten har inget svar på frågan och menar att det är i sin ordning, för en väg är sällan rak.'),
            val('Varför svarar skribenten ”Äldre” i slutet?',
                ['Ett skämt som också visar att frågan är svår', 'Ett sätt att slippa prata med någon alls',
                 'Ett besked om att skolan ska hoppas över'],
                'Ett skämt som också visar att frågan är svår',
                'Svaret är sant men inte det någon väntar sig. Humorn visar att ingen kan veta svaret ännu.'),
            para('Para ihop bilden i texten med vad den står för.',
                 [('en karta', 'en plan för framtiden'), ('ett vitt papper', 'att inget är bestämt ännu'),
                  ('en väg med kurvor', 'ett liv som inte går rakt fram'),
                  ('en färdig smörgås', 'något som är klart och redo')],
                 'Bilderna är metaforer och liknelser. Kartan är planen, det vita pappret saknar plan, vägen har '
                 'kurvor, och ett färdigt svar är som en färdig smörgås.'),
            sant('Skribenten vet redan exakt vilket yrke som väntar efter gymnasiet.', False,
                 'Skribenten skriver att hon eller han inget svar har på vad hen ska göra sedan.'),
            skriv('Vilket yrke hade pappas kollega först? Skriv ordet.', ['kock', 'kocken', 'en kock'],
                  'Det står att kollegan är ingenjör nu men började som kock.'),
            val('Varför berättar skribenten om pappas kollega?',
                ['Som exempel på att en väg sällan går rakt fram', 'För att ge tips om hur man blir kock',
                 'För att visa att man ska byta jobb ofta'],
                'Som exempel på att en väg sällan går rakt fram',
                'Kollegan har haft flera jobb och säger att inget var ett misstag. Det är ett exempel på en krokig '
                'väg som ändå leder någonstans.'),
            sant('Krönikan är skriven i första person.', True,
                 'Skribenten skriver jag och berättar om egna erfarenheter. Det är typiskt för en krönika.'),
            ordna('Ordna delarna i krönikan i den ordning de kommer.',
                  ['Många frågar vad skribenten ska bli.', 'Skribenten har inget svar.',
                   'Skribenten berättar om pappas kollega.', 'Skribenten bestämmer sig för ett skämtsamt svar.'],
                  forklaring='Texten börjar med frågan, fortsätter med att skribenten saknar svar, ger ett '
                             'exempel med kollegan och slutar med ett skämt.'),
            skriv('I texten sägs att kartan ”fortfarande är ett vitt papper”. Vad kallas bildspråk där något '
                  'sägs vara något annat? Skriv ordet.', ['metafor', 'metaforer', 'metaforen'],
                  'Kartan sägs vara ett vitt papper utan ordet som. Det är en metafor.'),
        ], beskrivning='En krönika om frågan vad man ska bli, med frågor om budskap, bildspråk och hur '
                       'texten är byggd.',
            text=KRONIKAN),

        niva('sv-ak9-fler-tolka-2', 'Rummet bredvid', 'Läsa och tolka', [
            val('Hur förändras berättaren i novellen?',
                ['Från att vilja slippa ljudet till att sakna det', 'Från att tycka om gitarr till att avsky den',
                 'Från att vara glad till att bli rasande'],
                'Från att vilja slippa ljudet till att sakna det',
                'Först tryckte berättaren kudden mot öronen. Sedan lyssnar berättaren efter ett ackord. Det som '
                'störde har blivit något att sakna.'),
            sant('Berättaren visade tydligt att flytten gjorde ont.', False,
                 'Berättaren stod med armarna i kors och sa att det inte var någon stor sak. Känslorna kommer '
                 'fram först senare.'),
            val('Vad betyder det att berättaren står ”med armarna i kors” och säger att det inte är någon '
                'stor sak?',
                ['Berättaren försöker dölja sina känslor', 'Berättaren är arg på musiken', 'Berättaren fryser i hallen'],
                'Berättaren försöker dölja sina känslor',
                'Det som berättaren säger stämmer inte med natten efter, då det är så tyst att det gör ont. '
                'Armarna i kors är ett sätt att skydda sig.'),
            skriv('Vart flyttade Ida? Skriv staden.', ['Umeå', 'till Umeå'],
                  'Det står att hon flyttade till Umeå för att läsa musik.'),
            skriv('Vad kunde berättaren höra första natten, när det var så tyst? Skriv ordet.',
                  ['kylskåpet', 'kylskåpet i köket', 'ett kylskåp', 'kylskåp'],
                  'Det var så tyst att berättaren kunde höra kylskåpet ute i köket.'),
            val('Vad antyder slutet, när berättaren nynnar på en av Idas låtar?',
                ['Att något av Ida lever kvar i berättaren', 'Att berättaren tänker sluta lyssna på musik',
                 'Att Ida kommer hem redan nästa vecka'],
                'Att något av Ida lever kvar i berättaren',
                'Berättaren lärde sig låtarna utan att vilja. Nu nynnar berättaren på en av dem, och då är '
                'Ida nära trots avståndet.'),
            ordna('Ordna händelserna i den ordning de kommer i novellen.',
                  ['Ida flyttar till Umeå.', 'Berättaren ligger vaken i tystnaden.',
                   'Berättaren går in i Idas rum.', 'Berättaren nynnar på en av hennes låtar.'],
                  forklaring='Efter flytten kommer den första tysta kvällen. Först en vecka senare går '
                             'berättaren in i rummet, och sist kommer nynnandet.'),
            sant('Berättaren lärde sig Idas låttexter fast det inte var meningen.', True,
                 'Det står: jag lärde mig texterna utan att vilja.'),
            skriv('Hur många år hade berättaren hört gitarren genom väggen? Svara med en siffra.',
                  [tal(8), 'åtta'],
                  'Första meningen säger att berättaren hade hört Idas gitarr genom väggen i åtta år.'),
        ], beskrivning='En novell med jag-berättare om en syster som flyttat, med frågor om förändring, '
                       'tystnad som symbol och vad slutet antyder.',
            text=RUMMET),
    ]),
]
