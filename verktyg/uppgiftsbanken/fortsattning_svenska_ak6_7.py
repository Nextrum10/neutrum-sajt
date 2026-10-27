# -*- coding: utf-8 -*-
"""Fler nivåer i svenska för åk 6 och åk 7 (2026-10-27): tre nya områden i
varje bana, med två nivåer vardera.

Leo 2026-10-27: "Nexläx där ska vi lägga in flera uppgifter, i matte svenska
och engelska årkurs 6 och uppåt."

- åk 6: ”Böjning av ord” (substantivens former; adjektivens jämförelse och
  böjning), ”Skiljetecken och stor bokstav” (punkt, frågetecken och
  utropstecken; kolon och stor bokstav) och ”Språk i Norden” (grannspråken;
  en berättelse med lästext om falska vänner på danska).
- åk 7: ”Satsdelar” (subjekt och predikat; objekt och adverbial), ”Ordens
  nyanser” (starka och svaga ord; värdeladdade ord) och ”Källkritik”
  (granska en källa; två texter om samma sak med lästext).

Områdena är sådant som banorna saknade, ur Lgr22:s centrala innehåll i
svenska (åk 6 ur 4–6, åk 7 ur 7–9): språkets struktur med ordklasser och
skiljetecken, satsdelar, ords nyanser och värdeladdning, grannspråken i
Norden och källkritik.

Allt står i TILLAGG och läggs sist i banorna (svenska.py, svenska_mer.py).
De två områdena med lästext har en vanlig nivå och en nivå med text, så att
inget område bara består av lästexter.

Skrivet från grunden. Lästexterna och alla personer, platser och exempel är
påhittade för banken; inget är taget ur ett nationellt prov, en lärobok
eller en annan källa. Texten är skriven med AI och inte läst av någon som
undervisar i ämnet.

Samma regler som i svenska.py och fler_svenska_hog.py:

- Rättningen struntar i stora och små bokstäver och i punkt sist, så stor
  bokstav frågas som ”Vilket ord ska ha stor bokstav?”, som sant eller
  falskt eller som en räkning, aldrig som två alternativ som bara skiljer
  sig i versaler.
- En ordna-fråga har bara en rimlig ordning.
- Det lärare inte är ense om frågas inte: komma i gränsfall, i dag eller
  idag, stor bokstav efter kolon, släktord som mormor som namn.

Förenklat, med flit:
- Predikatet frågas bara i satser med ett enda verb, och inga partikelverb
  (”tycker om”), för läromedlen räknar verbkedjor och partiklar olika.
  Adverbialen frågas efter vad de säger (när, var, hur, varför), utan
  undergrupper som läromedlen namnger olika.
- Adjektiv på -isk jämförs med mer och mest. Andra långa adjektiv, som
  intressant, går att jämföra på båda sätten och frågas inte.
- De falska vännerna är danska och norska ord vars betydelse ordböckerna är
  ense om: danska frokost (lunch), rolig (lugn), by (stad), is (glass),
  ferie (semester), grine (skratta) och kjole (klänning), och norska rar
  (konstig). Att danskan är svårare att höra än att läsa frågas som en
  orsak (uttalet), inte som en regel.
- Värdeladdningen frågas bara där ordböckerna är ense om att det ena ordet
  är mer negativt än det andra (snål, envis, feg, mager, dumdristig).
"""
from grund import bana, niva, val, skriv, ordna, sant, para, tal

SV = 'Svenska'

# --- Lästexterna, ett stycke per element -----------------------------

# åk 6, berättelse om ett besök i Köpenhamn.
FROKOST = '\n\n'.join([
    'Frokost i Köpenhamn',
    'I somras åkte Saga tåg från Malmö över Öresundsbron till Köpenhamn. Där bor hennes kusin Mads, '
    'som är lika gammal som hon. Mads pappa är Sagas morbror, och hans mamma Lene är dansk. Hemma '
    'pratar familjen danska.',
    'Saga hade bestämt sig för att prata svenska och lyssna noga. Skyltarna på stationen förstod hon '
    'nästan utan problem, för orden såg ut ungefär som på svenska. Det var svårare när folk pratade. '
    'Det lät som om danskarna svalde halva orden.',
    'Vid tolv ropade Lene från köket:',
    '– Frokost!',
    '– Men vi har ju redan ätit frukost, sa Saga.',
    'Mads skrattade. Han förklarade att frokost betyder lunch på danska. Frukost heter morgenmad.',
    'Efter maten frågade Mads:',
    '– Skal vi cykle ind til byen?',
    'Saga undrade vilken by han menade, när de redan bodde mitt i en stor stad. Det visade sig att '
    'byen betyder staden. De cyklade till hamnen, och där frågade Mads om de skulle köpa en is. Saga '
    'tänkte på isbitar, men han kom tillbaka med två glassar.',
    'På vägen hem frågade han:',
    '– Var det ikke sjovt?',
    'Saga förstod att sjovt måste betyda roligt, för han log hela tiden.',
    '– Jo, det var jätteroligt, sa hon.',
    'Mads såg förvånad ut. På danska betyder rolig lugn, och han hade inte tyckt att dagen var '
    'särskilt lugn.',
    'På kvällen satte de upp en lapp på kylskåpet. Överst skrev de ”Falska vänner”, och under skrev '
    'de orden som ser likadana ut på svenska och danska men betyder olika saker. Lene sa att listan '
    'nog skulle bli lång innan sommaren var slut.',
])

# åk 7, två texter om samma sak: en artikel och ett inlägg på nätet.
BADHUSET = '\n\n'.join([
    'Två texter om det nya badhuset',
    'TEXT 1. En artikel i Lokaltidningen, 12 mars',
    'Nytt badhus klart nästa höst',
    'Kommunfullmäktige beslutade i går att bygga ett nytt badhus vid idrottsplatsen. Det gamla '
    'badhuset är över 50 år gammalt. Det stängdes i vintras, sedan taket hade börjat läcka.',
    'Enligt kommunens beräkning kostar bygget 140 miljoner kronor. Badhuset ska ha en '
    '25-metersbassäng, en bassäng för simskolan och en avdelning för små barn. Det beräknas vara '
    'klart i september nästa år.',
    '– Alla barn ska kunna lära sig simma här i kommunen, säger Anna Berg, ordförande i kultur- och '
    'fritidsnämnden.',
    'Alla partier röstade inte för förslaget. Jonas Ek, som sitter i kommunfullmäktige, tycker att '
    'det blir för dyrt.',
    '– Vi hade hellre renoverat det gamla huset. Det hade kostat ungefär hälften, säger han.',
    'TEXT 2. Ett inlägg i en grupp på nätet, 14 mars',
    'Badhuset blir en katastrof!!!',
    'Har ni hört? Det nya badhuset kommer att kosta minst 300 miljoner, och det blir aldrig klart. '
    'Min granne känner någon som jobbar på kommunen, och hen säger att ingen vet var pengarna ska '
    'komma ifrån. Dessutom blir det ingen vanlig bassäng, bara rutschkanor. Dela om du också tycker '
    'att det är galet!',
    'Skrivet av: Badhusvännen',
])

for _t in (FROKOST, BADHUSET):
    assert 600 <= len(_t) <= 3000, len(_t)


TILLAGG = [
    # ================================================================
    # ÅRSKURS 6
    # ================================================================
    bana(SV, 'ak6', [
        niva('sv-ak6-bojning-av-ord-1', 'Substantivens former', 'Böjning av ord', [
            val('Vilken form är ordet ”bilarna”?',
                ['plural, bestämd form', 'plural, obestämd form', 'singular, bestämd form'],
                'plural, bestämd form',
                'Bilarna är fler än en bil, alltså plural. Ändelsen -na visar att vi vet vilka bilar det '
                'gäller, och det är bestämd form.'),
            skriv('Skriv ordet ”hus” i bestämd form plural: ett hus, huset, flera hus, alla …',
                  ['husen', 'alla husen'],
                  'Ett hus, huset, hus, husen. Ett-ordet hus får ingen ändelse i obestämd plural, men -en i '
                  'bestämd plural.'),
            val('Vilket ord är ett ett-ord?', ['äpple', 'gurka', 'tomat'], 'äpple',
                'Man säger ett äpple, men en gurka och en tomat. Sätt en eller ett framför ordet och lyssna '
                'på vad som låter rätt.'),
            sant('Ordet ”huset” står i bestämd form singular.', True,
                 'Huset är ett enda hus som vi vet vilket det är. Ett-ord får ändelsen -et eller -t i bestämd '
                 'form singular: huset, bordet, äpplet.'),
            skriv('Skriv ordet ”flicka” i obestämd form plural: en flicka, två …', ['flickor', 'två flickor'],
                  'Många en-ord som slutar på -a byter a mot -or i plural: flicka, flickor, och gata, gator.'),
            para('Para ihop ordet i singular med dess plural.',
                 [('en mus', 'möss'), ('en fot', 'fötter'), ('en bok', 'böcker'), ('ett öga', 'ögon')],
                 'Några vanliga ord byter vokal eller får en egen form i plural. De lär man sig ett och ett: '
                 'mus, möss och bok, böcker.'),
            val('I vilken mening står ordet ”katt” i bestämd form singular?',
                ['Katten sov hela dagen.', 'En katt sov hela dagen.', 'Katterna sov hela dagen.'],
                'Katten sov hela dagen.',
                'Katten är en enda katt som vi vet vilken det är. En katt är obestämd form, och katterna är '
                'plural.'),
            ordna('Ordna formerna av ”stol” så här: obestämd singular, bestämd singular, obestämd plural, '
                  'bestämd plural.',
                  ['stol', 'stolen', 'stolar', 'stolarna'],
                  forklaring='En stol, stolen, flera stolar, alla stolarna. Bestämd form har en ändelse som '
                             'visar att vi vet vilken eller vilka det gäller.'),
            val('Vilket ord har samma form i singular och plural, som ”ett barn” och ”två barn”?',
                ['lamm', 'hund', 'flaska'], 'lamm',
                'Ett lamm, två lamm. Hund blir hundar och flaska blir flaskor. Många ett-ord som slutar på '
                'en konsonant har ingen ändelse i obestämd plural.'),
            skriv('Hur många substantiv i plural finns det i meningen? ”Barnen åt äpplen och bullar i '
                  'parken.” Svara med en siffra.',
                  [tal(3), 'tre'],
                  'Barnen, äpplen och bullar är plural. Parken är bara en park, alltså singular.'),
        ], beskrivning='Tränar substantivens former: singular och plural, obestämd och bestämd form, och '
                       'skillnaden mellan en-ord och ett-ord.'),

        niva('sv-ak6-bojning-av-ord-2', 'Adjektiv som jämför och böjs', 'Böjning av ord', [
            val('Vilken form är ”snabbare” i meningen ”Lisa är snabbare än Ali.”?',
                ['komparativ', 'superlativ', 'positiv'], 'komparativ',
                'Komparativ jämför två: snabbare än. Positiv är grundformen, snabb, och superlativ är den '
                'högsta graden, snabbast.'),
            para('Para ihop adjektivet med dess komparativ.',
                 [('bra', 'bättre'), ('dålig', 'sämre'), ('gammal', 'äldre'), ('liten', 'mindre'),
                  ('ung', 'yngre')],
                 'De här adjektiven är oregelbundna. De får inte bara -are, utan byter form eller vokal: '
                 'bra, bättre, bäst och ung, yngre, yngst.'),
            skriv('Skriv superlativ av adjektivet ”bra”: bra, bättre, …', ['bäst', 'bästa'],
                  'Bra, bättre, bäst. Ordet byter form helt, så det går inte att säga braast.'),
            val('Vilket ord passar? ”Vi bor i ett … hus vid sjön.”', ['rött', 'röd', 'röda'], 'rött',
                'Hus är ett ett-ord, och då får adjektivet -t: en röd stuga men ett rött hus. Röd slutar på '
                'd, och d plus t blir tt.'),
            val('Vilket ord passar? ”Den … katten gömde sig under sängen.”',
                ['lilla', 'liten', 'litet', 'små'], 'lilla',
                'Liten böjs oregelbundet: en liten katt, ett litet hus, den lilla katten och två små katter. '
                'Efter den används lilla.'),
            sant('Adjektivet ”stor” har formerna stor, större och störst.', True,
                 'Stor jämförs med -re och -st, och vokalen o blir ö: stor, större, störst.'),
            ordna('Bygg meningen med superlativ. En bricka hör inte dit.',
                  ['Det', 'var', 'den', 'längsta', 'filmen', 'jag', 'har', 'sett.'], extra=['längre'],
                  forklaring='Superlativ används när något är mest av alla: den längsta filmen. Längre är '
                             'komparativ och jämför bara två saker.'),
            val('Vilket adjektiv jämförs med mer och mest i stället för med ändelser?',
                ['fantastisk', 'snäll', 'kall'], 'fantastisk',
                'Adjektiv som slutar på -isk jämförs med mer och mest: fantastisk, mer fantastisk, mest '
                'fantastisk. Snäll blir snällare och kall blir kallare.'),
            skriv('Skriv adjektivet ”glad” i rätt form: ”Barnen var … när solen kom fram.”', 'glada',
                  'Barnen är fler än en, och då får adjektivet -a: ett glatt barn, glada barn.'),
            sant('I ”ett stort äpple” har adjektivet fått ändelsen -t för att äpple är ett ett-ord.', True,
                 'Adjektivet böjs efter substantivet: en stor bulle, men ett stort äpple. Ett-ordet i '
                 'obestämd form ger adjektivet ändelsen -t.'),
        ], beskrivning='Tränar att jämföra adjektiv i positiv, komparativ och superlativ, också de '
                       'oregelbundna, och att välja rätt form av adjektivet till substantivet.'),

        niva('sv-ak6-skiljetecken-och-stor-bokstav-1', 'Punkt, frågetecken och utropstecken',
             'Skiljetecken och stor bokstav', [
                 val('Vilket tecken ska stå sist i meningen ”Vad heter din hund”?',
                     ['frågetecken', 'punkt', 'utropstecken'], 'frågetecken',
                     'Meningen är en direkt fråga till någon, och den börjar med frågeordet vad. En direkt '
                     'fråga slutar med frågetecken.'),
                 sant('När en mening slutar med punkt börjar nästa mening med stor bokstav.', True,
                      'Punkten visar att meningen är slut, och den stora bokstaven visar var nästa börjar.'),
                 val('Vilken mening är rätt skriven?',
                     ['Han frågade vad klockan var.', 'Han frågade vad klockan var?',
                      'Han frågade. Vad klockan var.'],
                     'Han frågade vad klockan var.',
                     'Meningen berättar att någon frågade. Det är en indirekt fråga, och den slutar med punkt. '
                     '”Vad klockan var” kan inte stå ensamt som en mening.'),
                 val('Vilket tecken passar bäst sist i varningen ”Se upp för bilen”?',
                     ['utropstecken', 'frågetecken', 'kolon'], 'utropstecken',
                     'En varning som ropas med kraft får utropstecken. Det är ingen fråga, och kolon avslutar '
                     'aldrig en mening.'),
                 skriv('Hur många meningar finns det i texten? ”Det regnade. Vi stannade inne. Spelade ni '
                       'kort? Ja, hela kvällen!” Svara med en siffra.',
                       [tal(4), 'fyra'],
                       'Varje mening börjar med stor bokstav och slutar med punkt, frågetecken eller '
                       'utropstecken. Det finns fyra sådana.'),
                 ordna('Bygg frågan. En bricka hör inte dit.', ['Har', 'du', 'sett', 'min', 'mössa?'],
                       extra=['mössa.'],
                       forklaring='Meningen frågar något, och verbet har står först. Då ska den sluta med '
                                  'frågetecken, inte med punkt.'),
                 para('Para ihop meningen med tecknet den ska sluta med.',
                      [('Var bor du', 'frågetecken'), ('Jag bor i Kiruna', 'punkt'),
                       ('Aj, vad det gör ont', 'utropstecken')],
                      'Var bor du frågar något. Jag bor i Kiruna berättar något. Aj, vad det gör ont är ett '
                      'utrop.'),
                 val('Vilket ord ska ha stor bokstav? ”sedan åkte vi till stugan.”',
                     ['sedan', 'vi', 'stugan'], 'sedan',
                     'Första ordet i en mening har alltid stor bokstav: Sedan. Stugan är inget namn, så det '
                     'skrivs med liten bokstav.'),
                 skriv('Texten ska delas i två meningar. Efter vilket ord ska punkten stå? ”Vi gick hem det '
                       'var sent”',
                       ['hem', 'efter hem'],
                       '”Vi gick hem.” är en hel mening, och ”Det var sent.” är en till. Punkten står efter '
                       'hem, och ordet det får stor bokstav.'),
             ], beskrivning='Tränar när en mening slutar med punkt, frågetecken eller utropstecken, indirekta '
                            'frågor och stor bokstav i början av en mening.'),

        niva('sv-ak6-skiljetecken-och-stor-bokstav-2', 'Kolon och stor bokstav',
             'Skiljetecken och stor bokstav', [
                 val('Vilken mening har kolon på rätt plats?',
                     ['Packa det här: tandborste, pyjamas och en bok.',
                      'Packa: det här tandborste, pyjamas och en bok.',
                      'Packa det här tandborste: pyjamas och en bok.'],
                     'Packa det här: tandborste, pyjamas och en bok.',
                     'Kolonet står precis före uppräkningen. Det säger till läsaren att nu kommer det som '
                     '”det här” är.'),
                 sant('Efter ett kolon måste det alltid komma en uppräkning.', False,
                      'Ett kolon kan också stå före en förklaring, som i ”Nu vet jag varför hon var sen: bussen '
                      'hade gått.”'),
                 val('Varför står det kolon i meningen ”Hon hade bara ett mål: att vinna.”?',
                     ['Det som följer förklarar målet', 'Det som följer är en fråga',
                      'Meningen tar slut efter mål'],
                     'Det som följer förklarar målet',
                     'Kolonet visar att det som kommer sedan förklarar det som stod före. Vilket mål? Att '
                     'vinna.'),
                 val('Vilket ord ska ha stor bokstav? ”Vi åkte till malmö en tisdag i maj.”',
                     ['malmö', 'tisdag', 'maj'], 'malmö',
                     'Malmö är namnet på en stad och skrivs med stor bokstav. Veckodagar och månader skrivs '
                     'med liten bokstav på svenska.'),
                 sant('Mitt i en mening skrivs veckodagar, som måndag och fredag, med stor bokstav på svenska.',
                      False,
                      'På svenska skrivs veckodagar och månader med liten bokstav. På engelska har de stor '
                      'bokstav, och det är lätt att blanda ihop.'),
                 val('Vilket ord ska ha stor bokstav? ”Min kompis från finland pratar både finska och '
                     'svenska.”',
                     ['finland', 'finska', 'svenska'], 'finland',
                     'Finland är namnet på ett land och skrivs med stor bokstav. Språk, som finska och '
                     'svenska, skrivs med liten bokstav.'),
                 sant('Mitt i en mening skrivs ordet ”norrman” med liten bokstav.', True,
                      'Ord för folk från ett land skrivs med liten bokstav på svenska: norrman, dansk och '
                      'svensk. Landet, Norge, har stor bokstav.'),
                 skriv('Hur många ord i meningen ska ha stor bokstav? ”på midsommarafton åkte elsa och jonas '
                       'till öland.” Svara med en siffra.',
                       [tal(4), 'fyra'],
                       'På börjar meningen. Elsa och Jonas är namn på personer, och Öland är namnet på en ö. '
                       'Midsommarafton är en högtid och skrivs med liten bokstav.'),
                 para('Para ihop ordet med hur det skrivs mitt i en mening.',
                      [('Stockholm', 'stor bokstav, för det är namnet på en plats'),
                       ('januari', 'liten bokstav, för det är en månad'),
                       ('julafton', 'liten bokstav, för det är en högtid'),
                       ('danska', 'liten bokstav, för det är ett språk')],
                      'Namn på personer och platser har stor bokstav. Månader, högtider och språk har liten '
                      'bokstav på svenska.'),
                 ordna('Bygg meningen med kolonet före uppräkningen. En bricka hör inte dit.',
                       ['Vi', 'behöver', 'tre', 'saker:', 'mjöl,', 'ägg', 'och', 'mjölk.'], extra=['saker'],
                       forklaring='Kolonet står efter saker, precis före uppräkningen. Mellan de två första '
                                  'sakerna står ett komma, och före den sista står och.'),
             ], beskrivning='Tränar kolon före en uppräkning eller en förklaring, och när namn, dagar, '
                            'månader, högtider, språk och ord för folk skrivs med stor eller liten bokstav.'),

        niva('sv-ak6-sprak-i-norden-1', 'Grannspråken', 'Språk i Norden', [
            val('Vilket språk är inte släkt med svenskan?', ['finska', 'norska', 'danska', 'isländska'],
                'finska',
                'Svenska, norska, danska och isländska har vuxit fram ur samma gamla språk, fornnordiskan. '
                'Finskan hör till en helt annan språkfamilj.'),
            sant('Finland har två nationalspråk: finska och svenska.', True,
                 'I Finland är både finska och svenska nationalspråk, och i många kommuner står skyltarna på '
                 'båda språken.'),
            val('Vilka bokstäver har danska och norska där svenskan har ä och ö?',
                ['æ och ø', 'ü och ß', 'é och è'], 'æ och ø',
                'Danska och norska skriver æ och ø. Alla tre språken har å. Ü och ß finns i tyskan.'),
            skriv('Norska har två skriftspråk. Det ena heter nynorsk. Vad heter det andra? Skriv ordet.',
                  ['bokmål', 'bokmålet'],
                  'Norska skrivs på bokmål eller nynorsk. Bokmål är det som flest norrmän skriver.'),
            val('På norska betyder ordet ”rar” konstig. En svensk säger till en norsk tjej att hennes hund är '
                'rar. Vad kan tjejen tro?',
                ['Att hunden kallas konstig', 'Att svensken vill köpa hunden', 'Att svensken är rädd för hunden'],
                'Att hunden kallas konstig',
                'På svenska betyder rar söt eller gullig, men på norska betyder det konstig. Ord som ser '
                'likadana ut men betyder olika saker kallas falska vänner.'),
            para('Para ihop ordet på danska med vad det betyder på svenska.',
                 [('rolig', 'lugn'), ('ferie', 'semester'), ('grine', 'skratta'), ('kjole', 'klänning')],
                 'Rolig och grine ser svenska ut men betyder något annat: på svenska betyder rolig kul, och '
                 'grina betyder i vardagligt tal gråta. Ferie och kjole får man lära sig som nya ord.'),
            sant('Samiska är nära släkt med norska.', False,
                 'Samiska hör till samma språkfamilj som finska, inte till de nordiska språken. Samiska talas '
                 'i Sverige, Norge, Finland och Ryssland.'),
            val('Varför har en svensk ofta lättare att läsa danska än att förstå danska som talas?',
                ['Uttalet skiljer sig mer än stavningen', 'Danska texter skrivs på svenska',
                 'Danska har inga ord som liknar svenska'],
                'Uttalet skiljer sig mer än stavningen',
                'Många danska ord stavas nästan som på svenska, men uttalas helt annorlunda. Därför känner du '
                'igen orden lättare på papper än i tal.'),
            val('Vilket av språken är ett av Sveriges nationella minoritetsspråk?',
                ['meänkieli', 'isländska', 'danska'], 'meänkieli',
                'Sverige har fem nationella minoritetsspråk: finska, meänkieli, samiska, romani chib och '
                'jiddisch. Meänkieli talas mest i Tornedalen.'),
        ], beskrivning='Tränar vilka språk som talas i Norden, vilka som är släkt med svenskan, och några '
                       'likheter och skillnader mellan svenska, norska och danska.'),

        niva('sv-ak6-sprak-i-norden-2', 'Frokost i Köpenhamn', 'Språk i Norden', [
            skriv('Vad heter frukost på danska, enligt texten? Skriv ordet.', ['morgenmad', 'morgenmaden'],
                  'Mads förklarar att frokost betyder lunch på danska. Frukost heter morgenmad.'),
            val('Varför blev Saga förvånad när Lene ropade ”Frokost!” vid tolv?',
                ['Hon trodde att det betydde frukost', 'Hon tyckte inte om dansk mat',
                 'Hon hade glömt att äta frukost'],
                'Hon trodde att det betydde frukost',
                'Saga svarar att de redan har ätit frukost. Hon tror att frokost är samma sak som frukost, '
                'men på danska betyder det lunch.'),
            sant('Enligt texten var det lättare för Saga att förstå danska skyltar än danskar som pratade.',
                 True,
                 'Hon förstod skyltarna nästan utan problem, men det var svårare när folk pratade.'),
            val('Vad betyder ”byen” i meningen ”Skal vi cykle ind til byen?”',
                ['staden', 'byn ute på landet', 'stranden'], 'staden',
                'Texten säger att byen betyder staden. På svenska är en by en liten ort på landet. Därför blev '
                'Saga förvirrad.'),
            val('Vad fick Saga när Mads köpte en is vid hamnen?', ['glass', 'isbitar', 'läsk'], 'glass',
                'Saga tänkte på isbitar, men Mads kom tillbaka med två glassar. På danska betyder is också '
                'glass.'),
            val('Varför såg Mads förvånad ut när Saga sa att det hade varit jätteroligt?',
                ['Han trodde att hon menade lugn', 'Han trodde att hon var arg på honom',
                 'Han hade inte hört vad hon sa'],
                'Han trodde att hon menade lugn',
                'På danska betyder rolig lugn. Mads trodde alltså att Saga tyckte att dagen hade varit '
                'jättelugn, fast den inte alls hade varit det.'),
            skriv('Vilket danskt ord använder Mads när han menar roligt? Skriv ordet ur texten.',
                  ['sjovt', 'sjov'],
                  'Mads frågar ”Var det ikke sjovt?”, och Saga förstår att sjovt betyder roligt, för han ler '
                  'hela tiden.'),
            val('Vad menas med ”falska vänner” i texten?',
                ['Lika ord med olika betydelse', 'Kompisar som ljuger för en', 'Ord som bara finns på danska'],
                'Lika ord med olika betydelse',
                'Texten säger att det är ord som ser likadana ut på svenska och danska men betyder olika '
                'saker, som frokost och rolig.'),
            ordna('Ordna händelserna i den ordning de kommer i texten.',
                  ['Saga åker tåg till Köpenhamn.', 'Lene ropar att det är frokost.',
                   'Mads köper glass vid hamnen.', 'De sätter upp en lapp på kylskåpet.'],
                  forklaring='Saga kommer till Köpenhamn, och vid tolv ropar Lene. Efter maten cyklar de till '
                             'hamnen, och på kvällen sätter de upp lappen.'),
            val('Varför satte Saga och Mads troligen upp lappen på kylskåpet?',
                ['Så att de minns orden som lurar', 'Så att Lene vet vad hon ska handla',
                 'Så att Saga kan öva på stavning'],
                'Så att de minns orden som lurar',
                'På lappen skriver de de falska vännerna, orden som ställde till det under dagen. Lene tror '
                'att listan blir lång.'),
        ], beskrivning='En berättelse om en svensk flicka som hälsar på sin kusin i Köpenhamn, med frågor om '
                       'danska ord som betyder något annat på svenska och om vad personerna menar.',
            text=FROKOST),
    ]),

    # ================================================================
    # ÅRSKURS 7
    # ================================================================
    bana(SV, 'ak7', [
        niva('sv-ak7-satsdelar-1', 'Subjekt och predikat', 'Satsdelar', [
            val('Vilket ord är predikat i meningen ”Moa simmar varje morgon.”?',
                ['simmar', 'Moa', 'morgon'], 'simmar',
                'Predikatet är verbet, det som händer eller görs. Det Moa gör är att simma.'),
            skriv('Skriv subjektet i meningen: ”I parken lekte barnen hela eftermiddagen.”', 'barnen',
                  'Fråga vem som lekte: barnen. Meningen börjar med i parken, och då står subjektet efter '
                  'predikatet.'),
            val('Hur hittar du subjektet i en sats?',
                ['Fråga vem eller vad som gör något', 'Leta efter satsens sista ord',
                 'Leta efter ett ord som slutar på -ar'],
                'Fråga vem eller vad som gör något',
                'Hitta verbet och fråga vem eller vad som gör det, eller är det. Svaret är subjektet. Det kan '
                'stå var som helst i satsen.'),
            sant('I meningen ”Nu kommer bussen.” är ”bussen” subjekt.', True,
                 'Vad kommer? Bussen. Meningen börjar med nu, så subjektet står efter verbet kommer.'),
            para('Para ihop meningen med dess predikat.',
                 [('Kalle läser.', 'läser'), ('Hela natten regnade det.', 'regnade'),
                  ('Snart slutar filmen.', 'slutar'), ('Mormor stickar en halsduk.', 'stickar')],
                 'Predikatet är verbet i satsen. Det står på andra plats i ett påstående, vad som än står '
                 'först.'),
            skriv('Skriv predikatet i meningen: ”Efter matchen åt laget pizza.”', 'åt',
                  'Åt är verbet, det som laget gjorde. Efter matchen säger när, och pizza är det som åts.'),
            val('Vad är subjekt i frågan ”Var bor din moster?”',
                ['din moster', 'bor', 'var'], 'din moster',
                'Vem bor? Din moster. Ett subjekt kan vara flera ord. Bor är predikatet, och var är frågeordet.'),
            ordna('Bygg meningen så att subjektet står först.',
                  ['Elsa', 'spelar', 'fotboll', 'på', 'lördagar.'],
                  forklaring='Elsa är subjektet och står först. Sedan kommer predikatet spelar, vad hon '
                             'spelar och sist när.'),
            sant('I frågan ”Sover katten?” står subjektet före predikatet.', False,
                 'Predikatet sover står först, och subjektet katten kommer efter. I en ja- eller nejfråga står '
                 'verbet först.'),
            val('Vilken av raderna saknar predikat?',
                ['En kall dag i november.', 'Det var kallt i november.', 'Vi frös i november.'],
                'En kall dag i november.',
                'Raden har inget verb, och då finns inget predikat. Det är ingen hel sats. I de andra raderna '
                'är var och frös verb.'),
        ], beskrivning='Tränar att hitta predikatet, satsens verb, och subjektet, den eller det som gör '
                       'något eller är något, också när subjektet står efter predikatet.'),

        niva('sv-ak7-satsdelar-2', 'Objekt och adverbial', 'Satsdelar', [
            val('Vilket ord är objekt i meningen ”Grannen klippte gräset.”?',
                ['gräset', 'Grannen', 'klippte'], 'gräset',
                'Fråga vad grannen klippte: gräset. Objektet är det som något görs med. Grannen är subjekt '
                'och klippte är predikat.'),
            skriv('Skriv objektet i meningen: ”Varje kväll läser pappa en saga.”', ['en saga', 'saga'],
                  'Vad läser pappa? En saga. Varje kväll säger när och är ett adverbial.'),
            val('Vad säger adverbialet ”i köket” i meningen ”Vi åt middag i köket.”?',
                ['var något händer', 'när något händer', 'hur något händer'], 'var något händer',
                'I köket svarar på frågan var. Adverbial kan säga var, när, hur eller varför något händer.'),
            para('Para ihop adverbialet med frågan det svarar på.',
                 [('på fredag', 'när?'), ('under bron', 'var?'), ('försiktigt', 'hur?'),
                  ('för att vinna', 'varför?')],
                 'Adverbialen ger mer information om det som händer: när det händer, var, på vilket sätt och '
                 'varför.'),
            sant('I meningen ”Hunden jagade katten.” är ”katten” objekt.', True,
                 'Vad jagade hunden? Katten. Hunden är subjekt, den som jagar, och katten är objekt, den som '
                 'blir jagad.'),
            sant('En sats måste ha ett objekt.', False,
                 'Satsen ”Hon sover.” har subjekt och predikat men inget objekt, och den är ändå hel. Ett '
                 'predikat måste finnas, ett objekt behövs inte.'),
            para('Para ihop delarna av meningen ”Efter skolan drack Omar te i köket.” med rätt satsdel.',
                 [('Efter skolan', 'adverbial som säger när'), ('drack', 'predikat'), ('Omar', 'subjekt'),
                  ('te', 'objekt'), ('i köket', 'adverbial som säger var')],
                 'Drack är verbet. Vem drack? Omar. Vad drack Omar? Te. Efter skolan och i köket säger när och '
                 'var.'),
            val('Vilken satsdel är ”snabbt” i meningen ”Hon cyklade snabbt hem.”?',
                ['adverbial', 'objekt', 'subjekt'], 'adverbial',
                'Snabbt säger hur hon cyklade, och då är det ett adverbial. Hem är också ett adverbial, som '
                'säger vart.'),
            ordna('Bygg meningen så att adverbialet som säger när står först.',
                  ['På', 'söndag', 'åker', 'vi', 'till', 'Göteborg.'],
                  forklaring='På söndag står först. Sedan kommer predikatet åker på andra plats, och '
                             'subjektet vi efter det.'),
            skriv('Hur många adverbial finns det i meningen? ”På lördag spelar vi match i Uppsala.” Svara '
                  'med en siffra.',
                  [tal(2), 'två'],
                  'På lördag säger när och i Uppsala säger var. Vi är subjekt, spelar är predikat och match är '
                  'objekt.'),
        ], beskrivning='Tränar att hitta objektet, det som något görs med, och adverbial som säger när, var, '
                       'hur och varför, och att dela upp en hel mening i satsdelar.'),

        niva('sv-ak7-ordens-nyanser-1', 'Starka och svaga ord', 'Ordens nyanser', [
            ordna('Ordna orden från svagast till starkast.', ['fnissa', 'skratta', 'gapskratta'],
                  forklaring='Den som fnissar skrattar lite och tyst. Den som gapskrattar skrattar högt och '
                             'med hela munnen.'),
            val('Vilket ord beskriver att någon går långsamt, utan brådska?',
                ['släntrar', 'rusar', 'marscherar'], 'släntrar',
                'Den som släntrar går långsamt och slött. Den som rusar har bråttom, och den som marscherar '
                'går med bestämda steg i takt.'),
            val('Vilket ord visar starkast ilska?', ['rasande', 'irriterad', 'sur'], 'rasande',
                'Rasande betyder väldigt arg. Irriterad och sur är svagare: så känner man sig när något bara '
                'stör en.'),
            sant('Två synonymer kan betyda ungefär samma sak men ändå ge olika känsla.', True,
                 'Synonymer betyder nästan samma sak, men de är sällan helt lika. Gå och lunka beskriver båda '
                 'att röra sig till fots, men de ger olika bild.'),
            val('Vilket ord passar bäst? ”Tjuven … in i huset utan att någon hörde honom.”',
                ['smög', 'stampade', 'sprang'], 'smög',
                'Att smyga är att gå tyst för att ingen ska märka en. Det passar med att ingen hörde honom.'),
            para('Para ihop verbet med vad det betyder.',
                 [('viska', 'tala nästan utan röst'), ('mumla', 'tala lågt och otydligt'),
                  ('skrika', 'ropa mycket högt'), ('svamla', 'prata länge utan sammanhang')],
                 'Alla fyra handlar om att använda rösten, men de säger olika saker om hur. Ett precist verb '
                 'ger läsaren en tydligare bild.'),
            skriv('Vilket ord i meningen är förstärkt med en förled? ”Det satt en pytteliten mus i köket.” '
                  'Skriv ordet.',
                  'pytteliten',
                  'Förleden pytte- gör liten starkare: pytteliten betyder mycket liten.'),
            val('Vilket ord betyder mycket trött?', ['utmattad', 'sömnig', 'pigg'], 'utmattad',
                'Den som är utmattad är helt slut och orkar inget. Sömnig betyder att man vill sova, och '
                'pigg är motsatsen till trött.'),
            val('Vilken mening säger tydligast hur soppan smakade?',
                ['Soppan var salt och stark.', 'Soppan var faktiskt riktigt bra.', 'Soppan var helt okej, tyckte jag.'],
                'Soppan var salt och stark.',
                'Salt och stark beskriver smaken. Bra och okej säger bara vad någon tyckte, inte hur den '
                'smakade.'),
            sant('Den som stirrar tittar länge utan att titta bort.', True,
                 'Stirra betyder att titta stelt och länge på något. Det är starkare än att titta.'),
        ], beskrivning='Tränar synonymer som säger samma sak med olika styrka och på olika sätt, och att '
                       'välja det ord som passar bäst i en mening.'),

        niva('sv-ak7-ordens-nyanser-2', 'Värdeladdade ord', 'Ordens nyanser', [
            val('Vilket ord ger en negativ bild av någon som inte gärna gör av med pengar?',
                ['snål', 'sparsam', 'ekonomisk'], 'snål',
                'Alla tre beskriver någon som är rädd om pengar. Sparsam och ekonomisk låter bra, men snål '
                'låter som något dåligt.'),
            para('Para ihop ordet med ett mer negativt ord som betyder nästan samma sak.',
                 [('modig', 'dumdristig'), ('bestämd', 'envis'), ('försiktig', 'feg'), ('smal', 'mager')],
                 'Orden i varje par beskriver nästan samma sak. Det negativa ordet visar att den som skriver '
                 'tycker att det har gått för långt.'),
            sant('Ordet ”trångsynt” ger en positiv bild av en person.', False,
                 'Den som är trångsynt vägrar se saker från fler håll. Ordet är negativt. Det positiva '
                 'motsatsordet är vidsynt.'),
            val('En tidning vill skriva neutralt. Vilket ord passar bäst? ”Hundra personer … till mötet om den '
                'nya vägen.”',
                ['kom', 'vällde in', 'stormade in'], 'kom',
                'Kom säger bara vad som hände. Vällde in och stormade in får det att låta som en hotfull '
                'folkmassa, och då tar texten ställning.'),
            val('Vilken mening försöker få läsaren att tycka illa om förslaget?',
                ['Kommunen vill slösa pengar på en skatepark.', 'Kommunen planerar att bygga en ny skatepark.',
                 'Kommunen har föreslagit en ny skatepark.'],
                'Kommunen vill slösa pengar på en skatepark.',
                'Att slösa betyder att använda pengar på fel sätt. Ordet visar att skribenten tycker att '
                'förslaget är dåligt.'),
            skriv('Vilket ord i meningen är värdeladdat? ”Rektorn kom med ett löjligt förslag om nya regler.”',
                  ['löjligt', 'löjlig'],
                  'Löjligt visar vad skribenten tycker om förslaget. Utan ordet säger meningen bara att '
                  'rektorn kom med ett förslag.'),
            val('Vad är en eufemism?',
                ['Ett mildare ord för något obehagligt', 'Ett ord som betyder motsatsen',
                 'Ett ord som lånats från engelskan'],
                'Ett mildare ord för något obehagligt',
                'En eufemism är ett snällare sätt att säga något som kan kännas hårt, som mindre bemedlad i '
                'stället för fattig.'),
            val('Vilket uttryck är ett mildare sätt att säga att någon har dött?',
                ['gått bort', 'gått ut', 'gått vilse'], 'gått bort',
                'Gått bort är en eufemism för dött. Det låter mjukare, och därför används det ofta när man '
                'pratar om någon som har dött.'),
            sant('Ett värdeladdat ord visar vad den som använder det tycker om det hen skriver eller pratar om.', True,
                 'Ett värdeladdat ord säger inte bara vad något är, utan också om det är bra eller dåligt.'),
            ordna('Bygg den mening som är neutral. Två brickor hör inte dit.',
                  ['Laget', 'förlorade', 'finalen', 'på', 'söndagen.'], extra=['krossades', 'pinsamt'],
                  forklaring='Förlorade säger bara vad som hände. Krossades och pinsamt är värdeladdade och '
                             'visar vad skribenten tycker.'),
        ], beskrivning='Tränar ord som säger nästan samma sak men ger en positiv, neutral eller negativ bild, '
                       'och hur ordvalet kan påverka läsaren.'),

        niva('sv-ak7-kallkritik-1', 'Granska en källa', 'Källkritik', [
            val('Vad menas med avsändaren av en text?',
                ['Den som står bakom texten', 'Den som läser och delar texten', 'Platsen där texten står'],
                'Den som står bakom texten',
                'Avsändaren är den som har skrivit eller gett ut texten, till exempel en tidning, ett företag '
                'eller en person.'),
            sant('Ett företag som skriver om sin egen produkt kan ha som syfte att du ska köpa den.', True,
                 'Företaget tjänar pengar på att du köper. Det betyder inte att allt är fel, men du bör '
                 'kontrollera uppgifterna i en annan källa.'),
            para('Para ihop frågan med vad den hjälper dig att ta reda på.',
                 [('Vem?', 'vem som står bakom texten'), ('När?', 'om uppgifterna är aktuella'),
                  ('Varför?', 'vilket syfte texten har'), ('Hur vet hen det?', 'var uppgifterna kommer ifrån')],
                 'De fyra frågorna hjälper dig att granska en källa innan du litar på den.'),
            val('Du vill veta vilken tid vinnaren av ett lopp fick. Vilken källa är säkrast?',
                ['Arrangörens resultatlista', 'Ett anonymt inlägg i en chatt', 'En kommentar under ett klipp'],
                'Arrangörens resultatlista',
                'Arrangören har själv mätt tiderna. I chatten och i kommentarerna vet du inte vem som skrev '
                'eller hur hen vet det.'),
            val('Vad är en förstahandskälla?',
                ['Någon som själv var med', 'Den första träffen i en sökning', 'Den källa som har flest läsare'],
                'Någon som själv var med',
                'En förstahandskälla har själv sett, upplevt eller tagit fram uppgiften. Den som bara har hört '
                'det från någon annan är en andrahandskälla.'),
            sant('Om samma uppgift står på två webbplatser är den alltid sann.', False,
                 'Den ena webbplatsen kan ha kopierat den andra. Då är det fortfarande bara en källa, och '
                 'uppgiften kan vara fel.'),
            val('Vilken mening är en åsikt och inte ett faktapåstående?',
                ['Det är den bästa filmen i år.', 'Filmen hade premiär i början av mars.', 'Filmen är ungefär två timmar lång.'],
                'Det är den bästa filmen i år.',
                'Vad som är bäst är något man tycker. Premiären och längden går att kontrollera, och det är '
                'faktapåståenden.'),
            skriv('Vad kallas det att granska och värdera var uppgifter kommer ifrån? Skriv ordet.',
                  ['källkritik', 'källkritiken', 'källgranskning'],
                  'Källkritik betyder att du frågar dig vem som står bakom en uppgift, varför och hur hen '
                  'vet det, innan du litar på den.'),
            val('Varför är det viktigt att se när en text är skriven?',
                ['Uppgifterna kan vara gamla', 'Gamla texter är alltid felaktiga', 'Nya texter är alltid sanna'],
                'Uppgifterna kan vara gamla',
                'Ett pris, ett rekord eller en regel kan ha ändrats sedan texten skrevs. En gammal text är '
                'inte fel för det, men den kan vara inaktuell.'),
            ordna('Bygg frågan som hjälper dig att ta reda på syftet med en text.',
                  ['Varför', 'har', 'någon', 'skrivit', 'texten?'],
                  forklaring='Syftet är varför texten finns: för att informera, övertyga, sälja eller '
                             'underhålla.'),
        ], beskrivning='Tränar att fråga vem som står bakom en text, varför och när den är skriven, och om '
                       'uppgifterna kommer från någon som själv vet.'),

        niva('sv-ak7-kallkritik-2', 'Två texter om det nya badhuset', 'Källkritik', [
            val('Vem är avsändaren av text 1?', ['Lokaltidningen', 'Kommunfullmäktige', 'Badhusvännen'],
                'Lokaltidningen',
                'Text 1 är en artikel i Lokaltidningen. Kommunfullmäktiges beslut och två politiker återges, men '
                'det är tidningen som har skrivit artikeln.'),
            skriv('Hur mycket kostar bygget enligt kommunens beräkning i text 1? Svara i miljoner kronor.',
                  [tal(140), '140 000 000'],
                  'Det står i andra stycket: enligt kommunens beräkning kostar bygget 140 miljoner kronor.'),
            para('Para ihop källan med vad den säger om kostnaden.',
                 [('kommunens beräkning', '140 miljoner kronor för bygget'),
                  ('inlägget på nätet', 'minst 300 miljoner'),
                  ('Jonas Ek', 'en renovering för ungefär hälften')],
                 'Kommunen har räknat på bygget, och Jonas Ek jämför med en renovering. Inlägget säger inte var '
                 'siffran 300 miljoner kommer ifrån.'),
            val('Varför är uppgiften om 300 miljoner i text 2 svår att lita på?',
                ['Den bygger på rykten', 'Den står i en tidning', 'Den kommer från en politiker'],
                'Den bygger på rykten',
                'Inlägget säger inte var siffran kommer ifrån. ”Har ni hört?” visar att det är något skribenten '
                'har hört, och det enda hen hänvisar till är någon som grannen känner. Ingen av dem nämns, och '
                'inget underlag visas.'),
            sant('Text 1 låter både en som är för badhuset och en som är emot komma till tals.', True,
                 'Anna Berg tycker att badhuset behövs, och Jonas Ek tycker att det blir för dyrt. Tidningen '
                 'återger båda.'),
            val('Vad påstår text 2 om bassängerna som text 1 säger emot?',
                ['Att det inte blir någon vanlig bassäng', 'Att det blir en särskild bassäng för simskolan',
                 'Att den stora bassängen blir 25 meter lång'],
                'Att det inte blir någon vanlig bassäng',
                'Text 2 påstår att det bara blir rutschkanor. Text 1 säger att badhuset ska ha en '
                '25-metersbassäng och en bassäng för simskolan.'),
            val('Vad är troligen syftet med text 2?',
                ['Att väcka ilska och få fler att dela', 'Att informera sakligt om hur bygget går',
                 'Att sälja biljetter till det nya badhuset'],
                'Att väcka ilska och få fler att dela',
                'Rubriken har tre utropstecken, och inlägget slutar med att be läsaren dela. Det vill väcka '
                'känslor mer än informera.'),
            val('Vilken mening ur text 1 är en åsikt och inte ett faktapåstående?',
                ['”Vi hade hellre renoverat det gamla huset.”', '”Det gamla badhuset är över 50 år gammalt.”',
                 '”Det stängdes i vintras, sedan taket hade börjat läcka.”'],
                '”Vi hade hellre renoverat det gamla huset.”',
                'Jonas Ek säger vad han hade föredragit, och det är en åsikt. Husets ålder och när det stängdes '
                'går att kontrollera.'),
            val('Varför är det svårt att veta vem som skrev text 2?',
                ['Hen skriver under ett påhittat namn', 'Inlägget har ingen rubrik över texten',
                 'Inlägget skrevs sent på en söndagskväll'],
                'Hen skriver under ett påhittat namn',
                'Badhusvännen är inget riktigt namn. Då går det inte att veta vem skribenten är eller hur hen '
                'kan veta det hen påstår.'),
            val('Du vill ta reda på vad badhuset verkligen ska kosta. Vad är bäst att göra?',
                ['Läsa kommunens eget beslut', 'Fråga i samma grupp på nätet',
                 'Lita på inlägget som har flest delningar'],
                'Läsa kommunens eget beslut',
                'Kommunen har fattat beslutet och räknat på kostnaden. Det är en förstahandskälla. Att ett '
                'inlägg delas mycket gör det inte mer sant.'),
        ], beskrivning='En artikel och ett inlägg på nätet om samma badhus, med frågor om avsändare, syfte, '
                       'fakta och åsikter, och om var texterna säger emot varandra.',
            text=BADHUSET),
    ]),
]
