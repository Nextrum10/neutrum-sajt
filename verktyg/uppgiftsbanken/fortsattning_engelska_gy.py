# -*- coding: utf-8 -*-
"""Fortsättningen i engelska för gymnasiet (2026-10-27): Engelska 5, 6 och 7.

Leo 2026-10-27: "Nexläx där ska vi lägga in flera uppgifter, i matte svenska
och engelska årkurs 6 och uppåt." Allt står i TILLAGG och läggs sist i
banorna en-gy1, en-gy2 och en-gy3, efter fler_engelska_gy.py, i tre nya
områden per bana med två nivåer var. Skrivet från grunden mot ämnesplanen i
engelska, med brittisk stavning. Lästexterna och alla exempel (dusch-
studien, biblioteket vid floden, krönikan om skärmarna) är påhittade för
banken; inget är taget ur ett nationellt prov, en lärobok eller någon annan
källa. Skriven med AI och inte läst av en lärare.

- gy1: Relativsatser (kommatecken, whom, most of which), Artiklar och
  substantiv (society utan the, a före yrken, oräknebara ord som advice och
  research) och Källkritik (fakta och åsikt, och en sponsrad bloggtext att
  granska).
- gy2: Betoning och inversion (It was … who, What I need is, Never have I),
  Villkor och konjunktiv (blandade villkorssatser, Had I known, It is
  essential that she be) och Syfte och mottagare (syfte, publik och
  stilnivå, och två texter om samma bibliotek).
- gy3: Litterära begrepp (berättarteknik, tre sorters ironi, satir och
  allegori), Akademisk stil (referatverb, citat och referat,
  nominaliseringar och participfraser) och Granska argument
  (argumentationsfel, och en debattartikel med fel att hitta).

Förenklat, med flit:
- Ingen fråga skiljer brittisk från amerikansk engelska. Där varianterna
  går isär (konjunktiv efter suggest, that och which, at school, the guitar)
  är bara den form som går i båda ett alternativ, eller så frågas det inte.
- Gerundium och infinitiv, brittisk och amerikansk engelska och
  engelska i världen står i åk 7–9 (fortsattning_engelska_*.py) och frågas
  inte igen här.
- Referatverbens klang (claim tar avstånd, demonstrate säger att något är
  visat) frågas bara där handböckerna i akademiskt skrivande är eniga.
- Lästexterna på gy1 har frågor på svenska och de på gy2 och gy3 på
  engelska, som i fler_engelska_gy.py.
"""
from grund import bana, niva, val, skriv, ordna, sant, para, tal

EN = 'Engelska'


# --- Lästexterna, ett stycke per element -----------------------------

DUSCHEN = '\n\n'.join([
    'Cold showers: the secret to better grades?',
    'From a health and lifestyle blog. This post was written in partnership with a shower company.',
    'Want higher marks without studying more? The answer may be waiting in your bathroom. According to a new '
    'study, students who took a cold shower every morning for two weeks felt more alert and did better on a '
    'memory test.',
    'The study was carried out by a company that sells shower heads with a special cold setting. Twenty-four '
    'students took part, and all of them took cold showers. Before the two weeks, their average score on the '
    'memory test was 6.1 out of 10. Afterwards, it was 6.8.',
    '“I feel like a new person,” says Josh, 19, one of the participants. “I’ll never go back to hot water.”',
    'Not everyone is convinced. Dr Leena Varma, who researches sleep and memory at a university, points out '
    'that the students took the same test twice. “People usually do better the second time simply because '
    'they have seen the questions before,” she says. She adds that the study has not been published in a '
    'scientific journal, so other researchers have not been able to check it.',
    'Still, a cold shower can’t hurt! Readers of this blog get 20% off the company’s cold-setting shower head '
    'with the code COLD20.',
])
DELTAGARE = 24
FORE, EFTER = 6.1, 6.8

BIBLIOTEKET = '\n\n'.join([
    'Two texts about one library',
    'TEXT A: a notice on the library door',
    'Temporary closure of Riverside Library. Riverside Library will be closed from 1 March to 31 August for '
    'essential repairs to the roof and heating system. During this period, a mobile library will visit Market '
    'Square every Tuesday and Friday from 10 a.m. to 4 p.m. Books on loan may be returned to any library in '
    'the borough, and no late fees will be charged during the closure. Further information is available from '
    'the library service. We apologise for any inconvenience.',
    'TEXT B: a local blog',
    'Six months without our library? Seriously? So the council has finally admitted that the roof leaks. I '
    'could have told them that three winters ago, when I spent an afternoon reading next to a bucket. Don’t '
    'get me wrong: the repairs are needed, and I would rather have a dry library in September than a soggy '
    'one now. But a van in Market Square twice a week is not a library. Where will the pensioners who come in '
    'to read the newspapers go? Where will the children who do their homework there after school go, when '
    'the van leaves at four? If you care about this, come to the council meeting on 12 February and say so. '
    'And bring a bucket. They might get the message.',
])

SKARMARNA = '\n\n'.join([
    'Put the screens away',
    'Last month I watched a fifteen-year-old “read” a novel for an English assignment. She scrolled through '
    'it on her phone in twenty minutes, answering messages as she went, and then told me that it was boring. '
    'I was not surprised. We have handed our children devices designed to capture their attention, and then '
    'we act shocked when they cannot concentrate.',
    'The evidence is hard to ignore. A survey of 2,000 secondary-school pupils found that those who spent '
    'more than four hours a day on screens had lower grades than those who spent less than one hour. '
    'Screens, clearly, are making our children less intelligent.',
    'Defenders of phones in schools seem to think that children should be allowed to do whatever they like, '
    'whenever they like, even in the middle of a maths lesson. But nobody seriously believes that a '
    'thirteen-year-old should decide his own timetable.',
    'And where would it end? Today we allow phones in the classroom; tomorrow pupils will refuse to read '
    'anything longer than a caption, and in twenty years nobody will be able to follow a contract or a '
    'doctor’s instructions.',
    'To be fair, screens are not all bad. Digital textbooks are often cheaper, they can read a text aloud for '
    'pupils with dyslexia, and some research suggests that short, well-designed apps can help pupils learn '
    'new words. I do not want schools to throw their laptops out of the window.',
    'What I want is simple: phones locked away during lessons, and at least one full-length book a term read '
    'on paper. My grandparents read by candlelight and grew up to be thoughtful, patient people. Our children '
    'deserve the same chance.',
])

# Verktyget tar lästexter upp till 3000 tecken; de här ska gå att läsa på
# en telefon innan frågorna.
for _t in (DUSCHEN, BIBLIOTEKET, SKARMARNA):
    assert 800 <= len(_t) <= 2600, len(_t)


TILLAGG = [
    # ================================================================
    # GYMNASIET 1 (Engelska 5)
    # ================================================================
    bana(EN, 'gy1', [
        niva('en-gy1-relativsatser-1', 'Who, which and that', 'Relativsatser', [
            val('Välj rätt: My sister, ___ lives in Malmö, works as a nurse.',
                ['who', 'that', 'which'], 'who',
                'Satsen mellan kommatecknen ger extra information om en person. Där används who. That går inte '
                'efter kommatecken, och which används om saker och djur.'),
            val('Vilken mening antyder att jag har mer än en bror?',
                ['My brother who lives in Spain is a pilot.', 'My brother, who lives in Spain, is a pilot.',
                 'My only brother, who lives in Spain, is a pilot.'],
                'My brother who lives in Spain is a pilot.',
                'Utan kommatecken pekar satsen ut VILKEN bror det gäller, och då finns det fler att välja mellan. '
                'Med kommatecken är satsen bara en extra upplysning om den enda brodern.'),
            val('I vilken mening kan relativpronomenet strykas?',
                ['The book that I borrowed was boring.', 'The man that lives next door is a chef.',
                 'The bus that goes to the airport is late.'],
                'The book that I borrowed was boring.',
                'Pronomenet kan strykas när det är objekt i bisatsen: I borrowed the book, alltså The book I '
                'borrowed. I de andra är that subjekt (the man lives, the bus goes) och måste stå kvar.'),
            val('Välj rätt: She passed the driving test on her first try, ___ surprised everyone.',
                ['which', 'that', 'what'], 'which',
                'Which efter kommatecken kan syfta på hela satsen före: att hon klarade provet förvånade alla. '
                'That går inte efter kommatecken, och what kan inte syfta tillbaka på något.'),
            val('Vilken mening har kommatecknen på rätt ställen?',
                ['Our neighbours, who have lived here for years, are moving.',
                 'Our neighbours who have lived here, for years are moving.',
                 'Our neighbours, who have lived here for years are moving.'],
                'Our neighbours, who have lived here for years, are moving.',
                'En relativsats som ger extra information står mellan två kommatecken, ett före och ett efter. '
                'Det andra kommatecknet glöms lätt, men utan det vet läsaren inte var satsen slutar.'),
            skriv('Skriv relativordet som fattas: The village ___ I grew up has changed a lot.',
                  ['where', 'in which'],
                  'Where används om platser: byn där jag växte upp. Formellt kan man också skriva in which. Bara '
                  'which eller that går inte, för då saknas in: the village that I grew up in.'),
            para('Para ihop meningen med vad den betyder.',
                 [('The students, who had studied, passed.', 'Alla eleverna hade pluggat, och alla klarade sig.'),
                  ('The students who had studied passed.', 'Bara de elever som hade pluggat klarade sig.')],
                 'Kommatecknen ändrar betydelsen. Med kommatecken gäller satsen alla eleverna. Utan kommatecken '
                 'pekar den ut vilka elever det handlar om.'),
            sant('I meningen ‘The car which I bought last year is red’ går det att stryka ‘which’.', True,
                 'Which är objekt i bisatsen (I bought the car), och det finns inga kommatecken. Då kan '
                 'pronomenet strykas: The car I bought last year is red.'),
            sant('En relativsats mellan kommatecken, som bara ger extra information, kan börja med ‘that’.', False,
                 'Efter kommatecken används who om personer och which om saker. That fungerar bara i satser som '
                 'pekar ut vem eller vad det gäller, utan kommatecken.'),
            ordna('Bygg meningen utan who och that: Mannen som jag pratade med var trevlig.',
                  ['The', 'man', 'I', 'spoke', 'to', 'was', 'nice.'],
                  forklaring='Relativpronomenet kan strykas eftersom det är objekt, och prepositionen to hamnar sist '
                             'i bisatsen: the man I spoke to.'),
        ], beskrivning='Tränar relativsatser på gymnasienivå: när satsen ska stå mellan kommatecken, skillnaden '
                       'mellan who, which och that, när pronomenet kan strykas och which som syftar på en hel sats.'),

        niva('en-gy1-relativsatser-2', 'To whom, most of which', 'Relativsatser', [
            val('Välj rätt i en formell text: The official to ___ I spoke was very helpful.',
                ['whom', 'who', 'which'], 'whom',
                'Direkt efter en preposition används whom om personer i formell engelska: to whom. Which används '
                'om saker. I vardagligt tal flyttar man hellre prepositionen: the official I spoke to.'),
            val('Vilken mening är mest formell?',
                ['This is the question about which we spoke.', 'This is the question we spoke about.',
                 'This is the question that we talked about.'],
                'This is the question about which we spoke.',
                'Alla tre är korrekta. Preposition plus which, about which, hör till formellt skriftspråk. De '
                'andra två, med prepositionen sist, är vanligare i tal.'),
            val('Välj rätt: I have three cousins, ___ live in Canada.',
                ['two of whom', 'two of which', 'two of who'], 'two of whom',
                'Efter of används whom om personer: two of whom, alltså två av vilka. Which används om saker, och '
                'who kan inte stå efter en preposition.'),
            skriv('Skriv relativordet som fattas: She has written ten novels, most of ___ have been translated '
                  'into Swedish.',
                  'which',
                  'Romanerna är saker, så det blir most of which. Om personer hade det hetat most of whom.'),
            val('Välj rätt: It is a town ___ history goes back more than a thousand years.',
                ['whose', 'which', "who's"], 'whose',
                'Whose kan användas också om saker och platser: staden vars historia. Who’s betyder who is.'),
            val('Välj rätt: ___ surprised me most was the price.',
                ['What', 'Which', 'That'], 'What',
                'What betyder det som och står för en sak som inte har nämnts förut: det som förvånade mig mest. '
                'Which och that behöver ett ord före sig att syfta på.'),
            skriv('Skriv ordet som betyder det som: I could not believe ___ I saw.',
                  'what',
                  'What är ett relativord som innehåller sitt eget huvudord: what I saw betyder det som jag såg. '
                  'Which och that kräver ett substantiv före, som the thing that I saw.'),
            val('Vilken mening är rätt skriven?',
                ['Stockholm, which is the capital of Sweden, is built on islands.',
                 'Stockholm which is the capital of Sweden is built on islands.',
                 'Stockholm, that is the capital of Sweden, is built on islands.'],
                'Stockholm, which is the capital of Sweden, is built on islands.',
                'Det finns bara ett Stockholm, så satsen pekar inte ut vilket utan ger extra information. Då står '
                'den mellan kommatecken och börjar med which, aldrig that.'),
            sant('‘The reason why she left’ och ‘the reason that she left’ är båda korrekt engelska.', True,
                 'Efter reason går både why och that, och man kan också stryka ordet helt: the reason she left.'),
            ordna('Bygg den formella meningen: Det här är rummet där mötet ska hållas.',
                  ['This', 'is', 'the', 'room', 'in', 'which', 'the', 'meeting', 'will', 'be', 'held.'],
                  forklaring='I formell engelska står prepositionen före which: the room in which. I vardagligt tal '
                             'säger man hellre the room where the meeting will be held.'),
        ], beskrivning='Svårare relativsatser: preposition före whom och which, uttryck som two of whom och most of '
                       'which, whose om saker och what som betyder det som.'),

        niva('en-gy1-artiklar-och-substantiv-1', 'Society, life, a doctor', 'Artiklar och substantiv', [
            val('Välj rätt: ___ has changed a lot since our grandparents were young.',
                ['Society', 'The society', 'A society'], 'Society',
                'När man talar om samhället i allmänhet står society utan the. På svenska säger vi samhället, men '
                'på engelska blir det fel med artikel.'),
            val('Välj rätt: My aunt works as ___ at a company in Gothenburg.',
                ['an engineer', 'engineer', 'one engineer'], 'an engineer',
                'Före ett yrke behöver engelskan a eller an: She is a nurse, he works as an engineer. An står före '
                'ett vokalljud, som i engineer.'),
            val('Vilken mening är korrekt?',
                ['Life is short, so enjoy it.', 'The life is short, so enjoy it.', 'A life is short, so enjoy it.'],
                'Life is short, so enjoy it.',
                'Livet i allmänhet heter life utan artikel. The life används bara om ett visst liv, som the life '
                'of a sailor.'),
            val('Välj rätt. Meningen handlar om barn i allmänhet: ___ are often more patient than adults think.',
                ['Children', 'The children', 'A children'], 'Children',
                'När man talar om barn i allmänhet står pluralen utan the: Children need sleep. The children '
                'betyder vissa barn som man redan pratar om.'),
            val('Vilken mening betyder De flesta människor tycker om musik?',
                ['Most people like music.', 'The most people like music.', 'Most of people like music.'],
                'Most people like music.',
                'De flesta heter most people, utan the och utan of. Most of används före ett ord med the eller ett '
                'pronomen: most of the people in my class, most of them.'),
            skriv('Skriv ordet som fattas: Jag tränar tre gånger i veckan. → I train three times ___ week.',
                  ['a', 'per', 'every', 'each'],
                  'Engelskan använder a där svenskan har i eller per: three times a week, twice a day, 50 kilometres '
                  'an hour.'),
            sant('‘He is teacher’ är korrekt engelska för ‘Han är lärare’.', False,
                 'Yrken får a eller an på engelska: He is a teacher.'),
            sant('‘The Swedish nature is beautiful’ är den naturliga engelska meningen för ‘Den svenska naturen är '
                 'vacker’.', False,
                 'Nature i betydelsen naturen står utan the: Swedish nature, nature in Sweden. The nature of betyder '
                 'något annat, nämligen hur något är beskaffat.'),
            para('Para ihop meningen med vad den betyder.',
                 [('Dogs are loyal.', 'Hundar är trogna, i allmänhet.'),
                  ('The dogs are loyal.', 'Hundarna som vi talar om är trogna.')],
                 'Utan the gäller påståendet alla hundar. Med the gäller det vissa hundar som redan är kända i '
                 'samtalet.'),
            ordna('Bygg meningen: Kärlek är viktigare än pengar.',
                  ['Love', 'is', 'more', 'important', 'than', 'money.'],
                  forklaring='Abstrakta ord som love, money, music och history står utan the när man talar '
                             'allmänt om dem.'),
        ], beskrivning='Tränar artiklarna där engelska och svenska skiljer sig: inget the när man talar allmänt om '
                       'samhället, livet och naturen, a före yrken och most people utan the.'),

        niva('en-gy1-artiklar-och-substantiv-2', 'Advice, news, the police', 'Artiklar och substantiv', [
            val('Välj rätt: She gave me two useful ___ before the interview.',
                ['pieces of advice', 'advices', 'advice'], 'pieces of advice',
                'Advice går inte att räkna på engelska. Vill man räkna råd säger man a piece of advice, two pieces '
                'of advice.'),
            val('Välj rätt: The news ___ better than we had expected.',
                ['was', 'were', 'are'], 'was',
                'News ser ut som plural men är singular och oräknebart: The news was good. En nyhet heter a piece '
                'of news.'),
            val('Välj rätt: The police ___ looking for two witnesses.',
                ['are', 'is', 'has'], 'are',
                'Police är alltid plural på engelska: the police are. En polis heter a police officer.'),
            skriv('Skriv verbet be i rätt form, presens: Mathematics ___ my favourite subject.',
                  'is',
                  'Ämnen på -ics, som mathematics, physics och economics, är singular fast de slutar på s: Physics '
                  'is hard.'),
            val('Vilken mening är korrekt?',
                ['We bought some new furniture for the flat.', 'We bought some new furnitures for the flat.',
                 'We bought a new furniture for the flat.'],
                'We bought some new furniture for the flat.',
                'Furniture är oräknebart: some furniture, a piece of furniture. Samma sak gäller luggage och '
                'equipment.'),
            val('Välj rätt: People in this town ___ very friendly.',
                ['are', 'is', 'was'], 'are',
                'People är plural och betyder människor: People are friendly. En människa heter a person.'),
            skriv('Skriv det engelska ordet för forskning: Scientists have done a lot of ___ on sleep.',
                  'research',
                  'Research är oräknebart: a lot of research, some research. Vill man räkna säger man a study eller '
                  'two studies, aldrig two researches.'),
            val('Välj rätt: The study gives strong ___ that sleep helps memory.',
                ['evidence', 'evidences', 'an evidence'], 'evidence',
                'Evidence är oräknebart: some evidence, a piece of evidence. Progress och knowledge är också '
                'oräknebara och får inget -s.'),
            sant('‘The rich’ betyder de rika, och verbet efter står i plural: The rich are getting richer.', True,
                 'The plus adjektiv kan betyda en grupp människor: the rich, the poor, the young, the elderly. '
                 'Gruppen är plural.'),
            ordna('Bygg meningen: Hon har gjort stora framsteg i år.',
                  ['She', 'has', 'made', 'great', 'progress', 'this', 'year.'],
                  forklaring='Framsteg heter progress och är oräknebart, så det får inget -s. Man säger make '
                             'progress.'),
        ], beskrivning='Svårare substantiv: ord som inte går att räkna på engelska (advice, research, furniture, '
                       'evidence), news och mathematics som är singular, och police och people som är plural.'),

        niva('en-gy1-kallkritik-1', 'Fact, opinion, bias', 'Källkritik', [
            para('Para ihop det engelska begreppet med vad det betyder.',
                 [('fact', 'något som går att kontrollera'), ('opinion', 'vad någon tycker eller tror'),
                  ('bias', 'att en text drar åt ett håll och bara visar en sida'),
                  ('primary source', 'en källa från någon som själv var med eller gjorde studien'),
                  ('secondary source', 'en källa som återger vad andra har kommit fram till')],
                 'Begreppen hjälper dig att värdera en text: vad som går att kontrollera, vad som är tyckande, och '
                 'hur nära händelsen källan står.'),
            val('Vilken mening är ett påstående om fakta, inte en åsikt?',
                ['The bridge was opened in 1998.', 'The bridge is the finest in the country.',
                 'The bridge should never have been built.'],
                'The bridge was opened in 1998.',
                'Ett årtal går att kontrollera i en annan källa. Finest och should never have been built är '
                'värderingar som man kan hålla med om eller inte.'),
            val('Vilken mening uttrycker en åsikt?',
                ['Electric scooters are a dangerous and pointless idea.',
                 'Electric scooters were banned in the centre last year.',
                 'About 2,000 scooters are rented in the city every day.'],
                'Electric scooters are a dangerous and pointless idea.',
                'Dangerous and pointless är en värdering. Förbudet och antalet går att kontrollera.'),
            val('En artikel om hur nyttigt ett visst te är har skrivits av företaget som säljer teet. Vad är det '
                'största problemet med källan?',
                ['Företaget tjänar på att teet framstår som nyttigt', 'Artikeln är skriven på engelska och inte på '
                 'svenska', 'Artikeln handlar om hälsa och inte om vetenskap'],
                'Företaget tjänar på att teet framstår som nyttigt',
                'När avsändaren tjänar på ett visst svar finns det risk att texten bara visar det som talar för '
                'produkten. Leta efter en oberoende källa.'),
            val('Vilken fråga hjälper dig mest att bedöma om en webbsida är tillförlitlig?',
                ['Vem står bakom sidan?', 'Har sidan många bilder och en snygg design?',
                 'Står sidan högt upp i sökresultatet?'],
                'Vem står bakom sidan?',
                'Avsändaren avgör mycket: en myndighet, en forskare, ett företag och en anonym person har olika skäl '
                'att skriva. Design och plats i sökresultatet säger inget om vad som är sant.'),
            skriv('Skriv det engelska ordet för partisk: a ___ article that only shows one side.',
                  ['biased', 'biassed', 'one-sided', 'one sided', 'partisan'],
                  'Biased betyder partisk: texten drar åt ett håll. Substantivet är bias. One-sided och partisan '
                  'betyder nästan samma sak.'),
            sant('Den text som står först bland sökträffarna är alltid den mest tillförlitliga.', False,
                 'Ordningen i en sökmotor beror bland annat på hur populär en sida är och hur den är skriven, inte på '
                 'om den är sann. Annonser kan också stå överst.'),
            sant('Märkningen ‘sponsored’ eller ‘paid partnership’ betyder att någon har betalat för innehållet.',
                 True,
                 'Det är reklam, även när det ser ut som en vanlig artikel eller ett vanligt inlägg. Läs det som ett '
                 'säljande budskap.'),
            val('Vad betyder clickbait?',
                ['En lockande rubrik som lovar mer än texten håller', 'En länk som leder till en sida som inte '
                 'längre finns', 'En nyhet som bara har publicerats på papper'],
                'En lockande rubrik som lovar mer än texten håller',
                'Clickbait är byggt för att få dig att klicka, ofta med en överdrift eller en fråga som texten inte '
                'besvarar.'),
            ordna('Bygg meningen: Kontrollera alltid vem som skrev texten.',
                  ['Always', 'check', 'who', 'wrote', 'the', 'text.'],
                  forklaring='Uppmaningen börjar med always och verbet i grundform. Who wrote the text är en '
                             'bisats med vanlig ordföljd.'),
        ], beskrivning='Tränar källkritik på engelska: fakta och åsikter, partiskhet, förstahands- och '
                       'andrahandskällor, och reklam som ser ut som vanliga texter.'),

        niva('en-gy1-kallkritik-2', 'Cold showers and better grades?', 'Källkritik', [
            val('Vad påstår texten i början?',
                ['Att kalla duschar kan göra en bättre på minnestest', 'Att varma duschar är farliga för elever '
                 'som pluggar mycket', 'Att man borde plugga på morgonen i stället för kvällen'],
                'Att kalla duschar kan göra en bättre på minnestest',
                'Stycket efter rubriken och raden om bloggen säger att eleverna som duschade kallt kände sig '
                'piggare och klarade ett minnestest bättre.'),
            val('Vem genomförde studien?',
                ['Ett företag som säljer duschmunstycken', 'En forskargrupp vid ett universitet i Leeds',
                 'En skola som ville att eleverna skulle bli piggare'],
                'Ett företag som säljer duschmunstycken',
                'Det står The study was carried out by a company that sells shower heads. Företaget har alltså ett '
                'eget intresse av resultatet.'),
            skriv('Hur många elever deltog i studien? Skriv talet.',
                  [tal(DELTAGARE), 'twenty-four', 'twenty four', 'tjugofyra'],
                  'Det står Twenty-four students took part.'),
            skriv('Hur många poäng av 10 steg det genomsnittliga resultatet på minnestestet? Skriv talet.',
                  tal(round(EFTER - FORE, 1)),
                  'Resultatet gick från %s till %s, alltså %s poäng. Det är en liten skillnad, och den kan ha andra '
                  'förklaringar än duschen.' % (tal(FORE), tal(EFTER), tal(round(EFTER - FORE, 1)))),
            val('Vad saknades i studien, som hade gjort den mer pålitlig?',
                ['En grupp som duschade som vanligt att jämföra med', 'Fler frågor om vad eleverna tyckte om '
                 'duschen', 'Ett längre citat från en av eleverna som deltog'],
                'En grupp som duschade som vanligt att jämföra med',
                'Alla 24 duschade kallt. Utan en jämförelsegrupp går det inte att veta om förbättringen beror på '
                'duschen eller på något annat.'),
            val('Varför påpekar forskaren att eleverna gjorde samma test två gånger?',
                ['De kan ha blivit bättre för att de kände igen frågorna',
                 'Hon tycker att testet var alldeles för svårt för eleverna',
                 'Det är förbjudet att göra samma test två gånger'],
                'De kan ha blivit bättre för att de kände igen frågorna',
                'Hon säger att man ofta gör bättre ifrån sig andra gången bara för att man har sett frågorna förut. '
                'Då behöver duschen inte ha gjort någon skillnad alls.'),
            sant('Enligt texten har studien granskats av andra forskare i en vetenskaplig tidskrift.', False,
                 'Forskaren säger att studien inte har publicerats i en vetenskaplig tidskrift, så ingen annan har '
                 'kunnat granska den.'),
            val('Vad är textens främsta syfte?',
                ['Att få läsaren att köpa ett duschmunstycke', 'Att neutralt beskriva vad forskningen säger om sömn',
                 'Att varna läsaren för att duscha kallt på morgonen'],
                'Att få läsaren att köpa ett duschmunstycke',
                'Texten är skriven i samarbete med ett företag och slutar med en rabattkod. Forskarens invändningar '
                'finns med, men slutsatsen är att man ska prova.'),
            val('Vilken sorts belägg är det Josh säger?',
                ['En personlig upplevelse, ingen mätning', 'Ett resultat från en stor undersökning',
                 'En slutsats som forskare har granskat'],
                'En personlig upplevelse, ingen mätning',
                'Josh berättar hur han känner sig. Det kan vara sant för honom, men det visar inte att kalla duschar '
                'hjälper andra.'),
            para('Para ihop ordet ur texten med den svenska översättningen.',
                 [('participant', 'deltagare'), ('alert', 'pigg, vaken'), ('convinced', 'övertygad'),
                  ('journal', 'tidskrift')],
                 'Orden är vanliga när man läser om forskning: deltagarna, att bli piggare, att vara övertygad och '
                 'tidskriften där studier publiceras.'),
        ], beskrivning='En sponsrad bloggtext om en studie, med frågor om vem som står bakom, vad studien visar, vad '
                       'som saknas och vad texten vill.',
            text=DUSCHEN),
    ]),

    # ================================================================
    # GYMNASIET 2 (Engelska 6)
    # ================================================================
    bana(EN, 'gy2', [
        niva('en-gy2-betoning-och-inversion-1', 'It was Sara who', 'Betoning och inversion', [
            val('Välj rätt: It was my brother ___ broke the window, not me.',
                ['who', 'which', 'what'], 'who',
                'I en kluven mening, It was … who, lyfts en del fram: det var min bror, inte jag. Om en person '
                'används who eller that, aldrig which eller what.'),
            val('Vilken mening betonar att det var just på fredagen, inte någon annan dag, som de träffades?',
                ['It was on Friday that they met.', 'They met each other on Friday.', 'They did meet on Friday.'],
                'It was on Friday that they met.',
                'It was on Friday that lyfter fram tiden. They did meet betonar i stället att mötet faktiskt blev '
                'av.'),
            skriv('Meningen ska betona a long holiday. Skriv ordet som fattas: I need a long holiday. → What I need '
                  '___ a long holiday.',
                  'is',
                  'En mening som börjar med What I need … byggs med is före det som betonas: What I need is a long '
                  'holiday.'),
            val('"You didn\'t lock the door." – "But I ___ it! I remember doing it." Välj rätt.',
                ['did lock', 'did locked', 'do locked'], 'did lock',
                'Betonande did plus grundform säger emot: jag låste den visst. Efter did står verbet alltid i '
                'grundform, lock, aldrig locked.'),
            skriv('Skriv den betonande formen av do: She ___ look tired today. (Hon ser verkligen trött ut.)',
                  'does',
                  'I presens används do eller does för att betona. Med she blir det does, och verbet efter står i '
                  'grundform: She does look tired.'),
            para('Para ihop meningen med vad den lyfter fram.',
                 [('It was Tom who sent the letter.', 'vem som skickade brevet'),
                  ('It was a letter that Tom sent.', 'vad Tom skickade'),
                  ('It was in May that Tom sent the letter.', 'när brevet skickades'),
                  ('What Tom did was send a letter.', 'vad Tom gjorde')],
                 'Det som står efter It was, eller efter was i en mening som börjar med What, är det som betonas.'),
            sant('I meningen ‘What I need is sleep’ är det ordet sleep som betonas.', True,
                 'I en mening som börjar med What I need … kommer det nya och viktiga sist, efter is.'),
            val('Välj rätt: It was not until I got home ___ I noticed the hole in my bag.',
                ['that', 'than', 'so'], 'that',
                'It was not until … that betyder det var först när … som: det var först hemma som jag märkte hålet.'),
            ordna('Bygg meningen: Det var Anna som ringde, inte Lisa.',
                  ['It', 'was', 'Anna', 'who', 'called,', 'not', 'Lisa.'],
                  forklaring='It was plus det som betonas plus who: It was Anna who called. Who används eftersom Anna '
                             'är en person.'),
            sant('‘All I want is a quiet evening’ betyder att jag vill ha många saker, bland annat en lugn kväll.',
                 False,
                 'All I want is … betyder det enda jag vill ha är: bara en lugn kväll, inget mer.'),
        ], beskrivning='Tränar att betona en del av meningen: kluvna meningar som It was … who och What I need is …, '
                       'och betonande do och did.'),

        niva('en-gy2-betoning-och-inversion-2', 'Never have I seen', 'Betoning och inversion', [
            val('Välj rätt: Never ___ such a beautiful sunset.',
                ['have I seen', 'I have seen', 'I saw'], 'have I seen',
                'När never står först i meningen byter subjekt och hjälpverb plats: Never have I seen. Det ger en '
                'formell eller dramatisk stil.'),
            val('Välj rätt: Not only ___ late, but he also forgot the tickets.',
                ['was he', 'he was', 'did he be'], 'was he',
                'Efter not only först i meningen kommer verbet före subjektet: Not only was he late. Med be flyttas '
                'be självt, utan did.'),
            val('Välj rätt: Hardly had we sat down ___ the phone rang.',
                ['when', 'than', 'that'], 'when',
                'Hardly … when betyder knappt … förrän: vi hade knappt satt oss när telefonen ringde. Than hör ihop '
                'med no sooner.'),
            skriv('Skriv ordet som fattas: No sooner had the film started ___ the power went out.',
                  'than',
                  'No sooner … than är ett fast par: filmen hade knappt börjat förrän strömmen gick. Sooner är en '
                  'komparativ, och därför than.'),
            val('Välj rätt: Under no circumstances ___ the door to strangers.',
                ['should you open', 'you should open', 'open you should'], 'should you open',
                'Under no circumstances, under inga omständigheter, först i meningen ger omvänd ordföljd: '
                'hjälpverbet should före subjektet you.'),
            skriv('Gör om med inversion och skriv de tre orden som fattas: I had rarely seen him so angry. → Rarely '
                  '___ him so angry.',
                  'had I seen',
                  'Rarely först i meningen gör att hjälpverbet had kommer före subjektet I: Rarely had I seen him so '
                  'angry.'),
            ordna('Bygg meningen: Först då förstod jag vad hon menade.',
                  ['Only', 'then', 'did', 'I', 'understand', 'what', 'she', 'meant.'],
                  forklaring='Only then först i meningen ger inversion. I enkel dåtid behövs did: Only then did I '
                             'understand. Bisatsen what she meant har vanlig ordföljd.'),
            sant('‘Little did she know’ betyder att hon visste mycket om saken.', False,
                 'Little did she know betyder hon hade ingen aning. Little är här nekande och ger inversion med did.'),
            para('Para ihop uttrycket med vad det betyder.',
                 [('Seldom', 'sällan'), ('Not until', 'inte förrän'), ('Nowhere', 'ingenstans'),
                  ('On no account', 'inte under några villkor')],
                 'Alla fyra är nekande eller begränsande uttryck. När de står först i meningen blir ordföljden '
                 'omvänd: Seldom do we …, Nowhere is it …'),
            val('Vilken mening är korrekt?',
                ['Only after the meeting did I realise my mistake.', 'Only after the meeting I did realise my '
                 'mistake.', 'Only after the meeting realised I my mistake.'],
                'Only after the meeting did I realise my mistake.',
                'Efter only after … först i meningen kommer hjälpverbet före subjektet. I enkel dåtid är '
                'hjälpverbet did: did I realise.'),
        ], beskrivning='Tränar inversion: omvänd ordföljd efter nekande och begränsande uttryck som never, not only, '
                       'hardly, no sooner, only then och under no circumstances.'),

        niva('en-gy2-villkor-och-konjunktiv-1', 'If I had, I would be', 'Villkor och konjunktiv', [
            val('Välj rätt: If I had taken the job in London, I ___ there now.',
                ['would be living', 'would have lived', 'will live'], 'would be living',
                'Villkoret gäller det förflutna (had taken), men följden gäller nu (now). Då blir det would plus '
                'grundform: would be living, eller would live.'),
            val('Välj rätt: If she were more patient, she ___ that argument yesterday.',
                ["wouldn't have started", "wouldn't be starting", "won't have started"], "wouldn't have started",
                'Villkoret gäller hur hon är i allmänhet (were more patient), men följden gäller i går. Då blir det '
                'would have plus particip: wouldn’t have started.'),
            val('Vilken mening blandar det förflutna och nuet?',
                ['If I had studied medicine, I would be a doctor today.',
                 'If I study tonight, I will pass the test tomorrow.',
                 'If I had studied harder, I would have passed the test.'],
                'If I had studied medicine, I would be a doctor today.',
                'Att plugga medicin hör till det förflutna, men att vara läkare gäller i dag. Den andra meningen '
                'handlar om framtiden, och i den tredje hör båda delarna till det förflutna.'),
            skriv('Skriv verbet i rätt form: If you ___ (not/eat) all the cake yesterday, there would be some left '
                  'now.',
                  ["hadn't eaten", 'had not eaten'],
                  'Villkoret gäller i går, och det som sägs hände inte. Därför past perfect: hadn’t eaten. Följden '
                  'gäller nu: there would be some left.'),
            skriv('Skriv verbet i rätt form: If I spoke French, I ___ (understand) what the waiter said yesterday.',
                  ['would have understood', 'could have understood', "would've understood",
                   "could've understood"],
                  'Villkoret gäller nu, att jag inte kan franska. Följden gäller i går, så det blir would have plus '
                  'particip: would have understood.'),
            sant('‘If I had listened to you, I wouldn’t be in trouble now’ handlar om ett misstag i det förflutna som '
                 'påverkar nuet.', True,
                 'Jag lyssnade inte då (had listened), och därför har jag problem nu (wouldn’t be). Det är en blandad '
                 'villkorssats.'),
            para('Para ihop början med det slut som passar.',
                 [('If I had brought an umbrella,', "I wouldn't be soaking wet now."),
                  ("If I weren't afraid of heights,", 'I would have climbed the tower yesterday.'),
                  ('If I had more money,', 'I would buy a new bike.'),
                  ('If it rains tomorrow,', 'we will stay at home.')],
                 'Titta på tiden i varje del: paraplyet då och blöt nu, höjdskräck alltid och tornet i går, pengar nu '
                 'och cykeln nu, och regn i morgon med will.'),
            ordna('Bygg meningen: Om jag inte vore så blyg, skulle jag ha sagt något.',
                  ['If', 'I', "weren't", 'so', 'shy,', 'I', 'would', 'have', 'said', 'something.'],
                  forklaring='Villkoret gäller hur jag är (weren’t so shy), och följden gäller ett tillfälle som har '
                             'varit: would have said.'),
            val('Välj rätt: If he ___ the map properly, we wouldn\'t be lost now.',
                ['had read', 'has read', 'would read'], 'had read',
                'Att läsa kartan hör till det förflutna, och det blev inte gjort. Därför past perfect, had read, '
                'medan följden gäller nu.'),
            sant('I en blandad villkorssats måste båda delarna gälla samma tid.', False,
                 'Det är det som gör den blandad: villkoret kan gälla det förflutna och följden nuet, eller '
                 'tvärtom.'),
        ], beskrivning='Tränar blandade villkorssatser, där villkoret och följden hör till olika tider: If I had '
                       'taken the job, I would be in London now.'),

        niva('en-gy2-villkor-och-konjunktiv-2', 'Had I known, were it not', 'Villkor och konjunktiv', [
            val('Välj rätt: ___ I known about the problem, I would have helped you.',
                ['Had', 'Have', 'Did'], 'Had',
                'Had I known är en formell variant av If I had known. If faller bort, och had flyttas före '
                'subjektet.'),
            skriv('Skriv ordet som fattas, utan if: Om du skulle behöva hjälp, ring mig. → ___ you need any help, '
                  'call me.',
                  'Should',
                  'Should you need betyder om du skulle behöva. If you need går också, men utan if flyttas should '
                  'först. Det är formellt och vanligt i brev och instruktioner: Should you have any questions …'),
            skriv('Skriv ordet som fattas: If it were not for the bridge, the village would be cut off. → ___ it '
                  'not for the bridge, the village would be cut off.',
                  'Were',
                  'Were it not for betyder om det inte vore för. If faller bort, och were flyttas först.'),
            val('Välj rätt: The committee recommends that every student ___ a mentor.',
                ['be given', 'being given', 'to be given'], 'be given',
                'Efter recommend that, suggest that och insist that kan verbet stå i konjunktiv, alltså grundform: '
                'that every student be given. Det är formellt. Man kan också skriva should be given, och i brittisk '
                'engelska är is given vanligt. Being given och to be given går inte efter that.'),
            val('Välj rätt: It is essential that every passenger ___ a valid ticket.',
                ['have', 'having', 'to have'], 'have',
                'Efter It is essential that kan verbet stå i grundform även efter he, she eller every passenger. Det '
                'kallas konjunktiv och hör till formell engelska. I brittisk engelska säger man också has eller '
                'should have, men having och to have går inte efter that.'),
            val('Välj rätt: It\'s high time we ___ home. It\'s nearly midnight.',
                ['went', 'gone', 'going'], 'went',
                'Efter It’s time och It’s high time står verbet i dåtid fast det handlar om nu: It’s high time we '
                'went. Det betyder att vi borde ha gått redan.'),
            val('Välj rätt: I\'d rather you ___ my phone without asking.',
                ["didn't use", 'not using', 'to not use'], "didn't use",
                'I’d rather plus en annan person följs av dåtid: I’d rather you didn’t use it. Det betyder jag '
                'skulle föredra att du inte gjorde det.'),
            sant('‘Had I known’ betyder samma sak som ‘If I had known’.', True,
                 'Båda betyder om jag hade vetat. Had I known är mer formell och vanlig i skrift.'),
            sant('I meningen ‘The doctor insisted that he rest for a week’ är ‘rest’ ett skrivfel för ‘rests’.',
                 False,
                 'Rest är rätt: efter insist that kan verbet stå i grundform, konjunktiv, även efter he. Det är '
                 'formellt och vanligt i skrift.'),
            ordna('Bygg den formella meningen utan if: Hade vi gått tidigare, hade vi hunnit med tåget.',
                  ['Had', 'we', 'left', 'earlier,', 'we', 'would', 'have', 'caught', 'the', 'train.'],
                  forklaring='Had we left earlier är samma sak som If we had left earlier. Följden har would have '
                             'plus particip: would have caught.'),
        ], beskrivning='Tränar formella villkor med omvänd ordföljd (Had I known, Should you need, Were it not for) '
                       'och konjunktiv och dåtid efter It is essential that, It’s time och I’d rather.'),

        niva('en-gy2-syfte-och-mottagare-1', 'Inform, persuade, instruct', 'Syfte och mottagare', [
            para('Para ihop syftet med en text som har det syftet.',
                 [('to inform', 'a notice about new opening hours'),
                  ('to persuade', 'a letter asking readers to vote against a plan'),
                  ('to instruct', 'a guide to setting up a new phone'),
                  ('to entertain', 'a funny short story about a lost cat')],
                 'Syftet är vad texten vill åstadkomma hos läsaren: att veta något, tycka något, kunna göra något '
                 'eller ha roligt.'),
            val('En text börjar: "Remove the back cover. Insert two batteries. Press the red button for three '
                'seconds." Vilken sorts text är det troligen?',
                ['en instruktion', 'en recension', 'en debattartikel'], 'en instruktion',
                'Imperativ, korta steg i ordning och exakta detaljer är typiska för en instruktion. Läsaren ska kunna '
                'göra något.'),
            val('Vilken mening passar bäst i ett mejl till en rektor du inte känner?',
                ['I am writing to ask about later opening hours.', 'Hey! Any chance the library could stay open '
                 'later?', 'So, like, can the library maybe stay open a bit later?'],
                'I am writing to ask about later opening hours.',
                'Till en mottagare du inte känner, i en formell situation, passar en hel och artig mening. Hey, any '
                'chance och like hör till samtal med vänner.'),
            val('Vem är troligen mottagaren av en text som börjar "Hi guys! Today I\'m going to show you my top five '
                'study hacks"?',
                ['unga följare i sociala medier', 'en domstol som ska döma i ett mål',
                 'en myndighet som granskar skolor'],
                'unga följare i sociala medier',
                'Hi guys, du-tilltal och slangordet hacks visar att avsändaren vänder sig till unga i en informell '
                'kanal.'),
            val('Vilket ord beskriver bäst stilnivån i "We regret to inform you that the event has been cancelled"?',
                ['formal', 'informal', 'slang'], 'formal',
                'We regret to inform you, passiv form och hela ord utan förkortningar gör meningen formell.'),
            skriv('Skriv det engelska ordet för mottagare eller publik, den grupp som en text är skriven för. Det '
                  'börjar på a.',
                  ['audience', 'an audience', 'the audience', 'addressee', 'addressees'],
                  'Audience betyder publik eller mottagare. En skribent frågar sig: vem är min audience, och vad '
                  'behöver de veta?'),
            sant('En text kan ha mer än ett syfte, till exempel både att informera och att övertyga.', True,
                 'En reklamtext kan berätta vad en produkt kostar och samtidigt vilja få dig att köpa den. Fråga dig '
                 'vad som är huvudsyftet.'),
            sant('Rubriker, punktlistor och korta stycken är typiska för en novell.', False,
                 'Rubriker och punktlistor hör till informerande texter, som rapporter, broschyrer och '
                 'instruktioner, där läsaren ska hitta snabbt. En novell berättar i löpande text.'),
            val('En recension av en film har oftast som huvudsyfte att …',
                ['bedöma filmen och ge läsaren råd', 'återge hela handlingen till slutet',
                 'sälja biljetter åt biografen'],
                'bedöma filmen och ge läsaren råd',
                'En recension värderar: den säger vad skribenten tycker och varför, så att läsaren kan välja. Att '
                'avslöja slutet undviker man oftast.'),
            ordna('Bygg den formella meningen: Vi ber om ursäkt för eventuellt besvär.',
                  ['We', 'apologise', 'for', 'any', 'inconvenience.'],
                  forklaring='We apologise for any inconvenience är en fast formell fras i meddelanden från företag '
                             'och myndigheter. Till en vän skriver man hellre sorry!'),
        ], beskrivning='Tränar att se en texts syfte, mottagare och stilnivå: att informera, övertyga, instruera '
                       'eller underhålla, och hur språket anpassas efter läsaren.'),

        niva('en-gy2-syfte-och-mottagare-2', 'Two texts about one library', 'Syfte och mottagare', [
            val('What is the main purpose of Text A?',
                ['To tell readers about the closure and the options', 'To persuade readers to protest against the '
                 'closure', 'To entertain readers with a story about a bucket'],
                'To tell readers about the closure and the options',
                'Texten ger fakta: datum, orsak, biblioteksbussen och vad man gör med lånade böcker. Den tar inte '
                'ställning.'),
            val('What is the main purpose of Text B?',
                ['To criticise the plan and get readers to act', 'To explain how the roof will be repaired',
                 'To give the opening hours of the mobile library'],
                'To criticise the plan and get readers to act',
                'Skribenten ifrågasätter planen och slutar med en uppmaning: come to the council meeting on 12 '
                'February.'),
            val('Which feature makes Text A formal?',
                ['Passive verbs such as "will be closed"', 'Questions such as "Seriously?"',
                 'Everyday phrases such as "Don\'t get me wrong"'],
                'Passive verbs such as "will be closed"',
                'Passiv form flyttar fokus från vem som gör något till vad som händer, och den är typisk för formella '
                'meddelanden. De andra exemplen kommer från Text B.'),
            sant('The writer of Text B thinks that the repairs are unnecessary.', False,
                 'Det står the repairs are needed. Skribenten är kritisk mot det som ska finnas under tiden, bussen, '
                 'inte mot reparationen.'),
            val('Why does the writer of Text B mention reading "next to a bucket"?',
                ['To show that the roof has leaked for years', 'To explain where the library keeps its buckets',
                 'To suggest that readers bring something to sit on'],
                'To show that the roof has leaked for years',
                'Hinken stod där för att fånga vatten från taket. Skribenten visar med humor att läckan är gammal '
                'och att kommunen borde ha vetat om den.'),
            val('Which groups is the writer of Text B worried about?',
                ['Pensioners and schoolchildren', 'The council and the library staff',
                 'Drivers who park in Market Square'],
                'Pensioners and schoolchildren',
                'Skribenten frågar vart pensionärerna som läser tidningarna och barnen som gör läxor efter skolan '
                'ska ta vägen.'),
            skriv('On which two days of the week will the mobile library visit Market Square? Write both days.',
                  ['Tuesday and Friday', 'Tuesdays and Fridays', 'Friday and Tuesday', 'Fridays and Tuesdays',
                   'Tuesday, Friday', 'Tuesdays, Fridays', 'Tuesday & Friday', 'Tuesday Friday',
                   'every Tuesday and Friday', 'on Tuesdays and Fridays', 'tisdag och fredag',
                   'tisdagar och fredagar'],
                  'Det står every Tuesday and Friday from 10 a.m. to 4 p.m.'),
            val('What is the tone of "And bring a bucket. They might get the message."?',
                ['Humorous: a joke with a serious point', 'Neutral: a practical piece of advice',
                 'Hopeless: the writer has given up'],
                'Humorous: a joke with a serious point',
                'Skribenten skämtar, men med udd: en hink på mötet skulle påminna kommunen om läckan som den länge '
                'har struntat i. Skribenten har inte gett upp, för texten uppmanar läsarna att komma till mötet.'),
            para('Match the phrase from the texts with what it does.',
                 [('We apologise for any inconvenience.', 'a polite formula from an organisation'),
                  ('Seriously?', 'an informal reaction that shows irritation'),
                  ("Don't get me wrong:", 'a signal that a concession is coming'),
                  ('come to the council meeting', 'a call to action')],
                 'Fraserna visar skillnaden mellan texterna: en artig standardformulering i Text A, och ett '
                 'personligt och engagerat språk i Text B.'),
            val('What do the two texts agree on?',
                ['That the building needs repairs', 'That the van is a good replacement',
                 'That late fees should be higher'],
                'That the building needs repairs',
                'Text A talar om essential repairs, och Text B säger the repairs are needed. De är oense om vad som '
                'ska finnas under tiden.'),
        ], beskrivning='Två texter om samma bibliotek, ett formellt meddelande och ett blogginlägg, med frågor om '
                       'syfte, mottagare, stil och ton.',
            text=BIBLIOTEKET),
    ]),

    # ================================================================
    # GYMNASIET 3 (Engelska 7)
    # ================================================================
    bana(EN, 'gy3', [
        niva('en-gy3-litterara-begrepp-1', 'Foreshadowing and flashback', 'Litterära begrepp', [
            para('Match the term with its meaning.',
                 [('foreshadowing', 'hints about what will happen later'),
                  ('flashback', 'a scene from an earlier time'),
                  ('in medias res', 'starting in the middle of the action'),
                  ('unreliable narrator', 'a narrator whose account cannot be fully trusted'),
                  ('omniscient narrator', 'a narrator who knows what every character thinks')],
                 'Begreppen beskriver hur en berättelse är byggd och vem som berättar, inte vad den handlar om.'),
            val('A story begins: "The shot rang out before anyone had time to scream." Which technique does this '
                'opening use?',
                ['in medias res', 'stream of consciousness', 'flashback'], 'in medias res',
                'Berättelsen börjar mitt i handlingen, utan bakgrund. Det heter in medias res, latin för mitt i '
                'händelserna.'),
            val('Early in a novel, a character notices a small crack in the old dam. In the last chapter, the dam '
                'bursts. What is the crack an example of?',
                ['foreshadowing', 'a flashback', 'an anticlimax'], 'foreshadowing',
                'Sprickan är en tidig antydan om det som kommer att hända. Det kallas foreshadowing, förebådande.'),
            val('A narrator writes: "Tom was sure she was lying, while Ana wondered whether he had found the '
                'letter." What kind of narrator is this most likely to be?',
                ['omniscient', 'first-person', 'second-person'], 'omniscient',
                'Berättaren vet vad både Tom och Ana tänker. En berättare som ser in i flera personers tankar kallas '
                'allvetande, omniscient.'),
            skriv('Write the term for the main character of a story. It begins with p.',
                  ['protagonist', 'the protagonist', 'a protagonist'],
                  'Huvudpersonen kallas protagonist. Den eller det som står emot huvudpersonen kallas antagonist.'),
            val('Which passage is an example of stream of consciousness?',
                ['Coffee, cold again, the meeting at nine or was it ten, Mother always said ten',
                 'She drank her cold coffee and then went to the meeting, which started at nine.',
                 '"I will be late for the meeting again," she said, and put her cold cup down.'],
                'Coffee, cold again, the meeting at nine or was it ten, Mother always said ten',
                'Stream of consciousness, medvetandeström, återger tankarna som de kommer: hoppande och utan vanliga '
                'meningar. De andra två är vanlig berättande text och en replik.'),
            sant('An unreliable narrator always lies on purpose.', False,
                 'En opålitlig berättare kan ljuga, men kan också vara ett barn som inte förstår, någon som minns fel '
                 'eller någon som ser allt till sin egen fördel.'),
            sant('The antagonist is the character or force that works against the protagonist.', True,
                 'Antagonisten skapar konflikten. Det kan vara en person, men också naturen, samhället eller något '
                 'inom huvudpersonen själv.'),
            val('What is an epiphany in a story?',
                ['a sudden moment of insight for a character', 'the final chapter, where loose ends are tied up',
                 'a long description of where the story is set'],
                'a sudden moment of insight for a character',
                'En epifani är ett ögonblick då en person plötsligt förstår något viktigt om sig själv eller sitt '
                'liv. Ofta är det en vändpunkt.'),
            ordna('Put the parts of a classic plot structure in order.',
                  ['Exposition', 'Rising action', 'Climax', 'Falling action', 'Resolution'],
                  forklaring='En klassisk handling börjar med att personer och miljö presenteras, bygger upp en '
                             'konflikt till en höjdpunkt och trappas sedan ner till en upplösning.'),
        ], beskrivning='Tränar begrepp för hur en berättelse är byggd: förebådande, tillbakablick, in medias res, '
                       'allvetande och opålitlig berättare, medvetandeström och handlingens delar.'),

        niva('en-gy3-litterara-begrepp-2', 'Irony, satire, allegory', 'Litterära begrepp', [
            para('Match the kind of irony with its meaning.',
                 [('verbal irony', 'saying the opposite of what you mean'),
                  ('situational irony', 'the opposite of what you expect happens'),
                  ('dramatic irony', 'the audience knows something that a character does not')],
                 'Ironi bygger alltid på en skillnad: mellan det som sägs och det som menas, mellan det som väntas och '
                 'det som händer, eller mellan det publiken vet och det personen vet.'),
            val('In a play, the audience knows that the letter is a fake, but the hero believes every word of it. '
                'What is this?',
                ['dramatic irony', 'verbal irony', 'personification'], 'dramatic irony',
                'Publiken vet mer än hjälten. Det skapar spänning, för vi ser vart det är på väg innan han gör det.'),
            val('A new fire station burns down on its opening day. Which kind of irony is this?',
                ['situational irony', 'dramatic irony', 'verbal irony'], 'situational irony',
                'Det som händer är raka motsatsen till det man väntar sig: just brandstationen brinner. Ingen säger '
                'något ironiskt, och ingen publik vet mer än någon annan.'),
            val('What is satire?',
                ['humour used to criticise people or society', 'a sad poem written in memory of someone who has '
                 'died', 'a novel told through letters between the characters'],
                'humour used to criticise people or society',
                'Satir använder humor, ofta överdrift och ironi, för att kritisera människor, makthavare eller '
                'samhället. De andra är en elegi och en brevroman.'),
            val('A story is about farm animals who drive out the farmer, and the events stand for a political '
                'revolution. What kind of text is it?',
                ['an allegory', 'a sonnet', 'a biography'], 'an allegory',
                'I en allegori står hela berättelsen, med personer och händelser, för något annat, här en '
                'revolution. En sonett är en dikt och en biografi en levnadsteckning.'),
            val('In a novel, clocks appear again and again, and the whole book is about the fear of growing old. '
                'Which statement is correct?',
                ['The clocks are a motif, and ageing is the theme.', 'Ageing is a motif, and the clocks are the '
                 'theme.', 'The clocks are the theme, and so is ageing.'],
                'The clocks are a motif, and ageing is the theme.',
                'Ett motiv är något konkret som återkommer, som klockorna. Temat är den stora frågan boken handlar '
                'om, här rädslan för att bli gammal.'),
            skriv('Write the term for a work that copies the style of another work in order to make fun of it. It '
                  'begins with p.',
                  ['parody', 'a parody'],
                  'En parodi härmar en annan text, en film eller en genre och överdriver dess drag för att göra det '
                  'komiskt.'),
            sant('A symbol in a literary text can have more than one possible meaning.', True,
                 'Symboler är öppna. Därför ska en analys visa med citat varför en viss tolkning är rimlig, inte '
                 'påstå att den är den enda.'),
            val('Which sentence contains verbal irony?',
                ['"Lovely weather for a picnic," she said, wringing out her soaked coat.',
                 '"It is raining again," she said, and hung her soaking coat by the door.',
                 '"I love picnics in the sun," she said, as she packed the basket.'],
                '"Lovely weather for a picnic," she said, wringing out her soaked coat.',
                'Hon säger att vädret är härligt men vrider ur sin blöta kappa. Hon menar alltså motsatsen. I de '
                'andra meningarna menar hon det hon säger.'),
            ordna('Build the sentence: Berättelsen är en satir över makthavare som aldrig lyssnar.',
                  ['The', 'story', 'is', 'a', 'satire', 'on', 'leaders', 'who', 'never', 'listen.'],
                  forklaring='A satire on något kritiserar det. Bisatsen who never listen säger vilka makthavare det '
                             'gäller.'),
        ], beskrivning='Svårare litterära begrepp: tre sorters ironi, satir, allegori, parodi och skillnaden mellan '
                       'motiv och tema.'),

        niva('en-gy3-akademisk-stil-1', 'Claims, argues, concedes', 'Akademisk stil', [
            val('Which sentence suggests that the writer may doubt the claim?',
                ['The company claims that its product is safe.', 'The study demonstrates that the product is '
                 'safe.', 'The report shows that the product is safe.'],
                'The company claims that its product is safe.',
                'Claim betyder påstå och används ofta när skribenten vill visa att det är den andras uppfattning, '
                'inte något som är bevisat. Demonstrate och show säger att det är visat.'),
            val('Choose the verb: The authors ___ that their sample was small, but argue that the results are still '
                'useful.',
                ['admit', 'deny', 'refute'], 'admit',
                'Admit betyder medge: författarna erkänner en svaghet men menar att resultaten ändå håller. Deny '
                'betyder förneka och refute motbevisa, och båda krockar med but.'),
            para('Match the reporting verb with its meaning.',
                 [('argue', 'give reasons for a position'), ('suggest', 'put forward an idea cautiously'),
                  ('refute', 'prove that a claim is wrong'), ('concede', 'accept a point against your own view'),
                  ('observe', 'note something that has been seen or measured')],
                 'Referatverbet visar hur källan förhåller sig till sitt påstående, och hur du själv ser på det.'),
            val('What is a paraphrase?',
                ["the source's idea in your own words, with a reference",
                 "the source's exact words inside quotation marks",
                 'your own opinion about the source, without a reference'],
                "the source's idea in your own words, with a reference",
                'Ett referat, paraphrase, återger idén med egna ord och egen meningsbyggnad. Källan ska ändå anges, '
                'för idén är inte din.'),
            sant("If you put a source's idea into your own words, you no longer need to say where the idea comes "
                 'from.', False,
                 'Idén tillhör fortfarande källan. Utan hänvisning ser det ut som din egen tanke, och det räknas som '
                 'plagiat.'),
            sant('Copying a sentence from a source and changing only a few words, without quotation marks or a '
                 'reference, can count as plagiarism.', True,
                 'Att byta ut några ord gör inte texten till din. Antingen citerar du ordagrant med citattecken, '
                 'eller så skriver du om helt med egna ord, och i båda fallen anger du källan.'),
            val('What does "et al." mean in a reference such as "Lind et al. (2024)"?',
                ['and others: the work has several authors', 'and so on: the list continues',
                 'in the same place: the same source as before'],
                'and others: the work has several authors',
                'Et al. är latin för et alii, och andra. Det används när en text har flera författare och bara den '
                'första nämns.'),
            val('Which sentence introduces a quotation in an academic way?',
                ['As the report puts it, "the problem is not new".', 'The report says, like, "the problem is not '
                 'new".', 'Some people say that "the problem is not new".'],
                'As the report puts it, "the problem is not new".',
                'As the report puts it presenterar källan och citatet tydligt. Like hör till talspråk, och some '
                'people säger inte vem som har sagt det.'),
            skriv('Write the noun that means "a short passage copied word for word from a source". It begins with '
                  'q.',
                  ['quotation', 'quote', 'a quotation', 'a quote'],
                  'Ett citat heter quotation, och i vardagligt språk quote. Det står inom citattecken och följs av en '
                  'hänvisning.'),
            ordna('Build the sentence: Enligt rapporten påverkar sömn minnet.',
                  ['According', 'to', 'the', 'report,', 'sleep', 'affects', 'memory.'],
                  forklaring='According to the report presenterar källan. Affect är verbet påverka, medan effect '
                             'oftast är substantivet verkan.'),
        ], beskrivning='Tränar att återge källor i en akademisk text: referatverb och vad de antyder, referat och '
                       'citat, och att undvika plagiat.'),

        niva('en-gy3-akademisk-stil-2', 'The decision to act', 'Akademisk stil', [
            val('Which sentence is the most academic version of "Prices rose quickly, so people bought less"?',
                ['The rapid rise in prices led to a fall in consumption.',
                 'Prices went up really fast, so people bought less stuff.',
                 'Because prices rose so quickly, people bought less.'],
                'The rapid rise in prices led to a fall in consumption.',
                'Nominaliseringar som rise och fall gör verben till substantiv, och led to visar orsaken. Really '
                'fast och stuff är talspråk.'),
            skriv('Write the noun that fits: They decided to close the school. → The ___ to close the school was '
                  'criticised.',
                  'decision',
                  'Decide blir substantivet decision. Att göra verb till substantiv kallas nominalisering och är '
                  'vanligt i akademisk text.'),
            skriv("Write the noun that fits: The government failed to act, which caused anger. → The government's "
                  '___ to act caused anger.',
                  'failure',
                  'Fail blir failure. Nominaliseringen gör en hel sats, the government failed to act, till en del av '
                  'en ny mening.'),
            val('Which version is objective and avoids "I"?',
                ['It can be argued that the policy has failed.', 'I really think that the policy has totally '
                 'failed.', 'You can see that the policy has failed, right?'],
                'It can be argued that the policy has failed.',
                'It can be argued that är en opersonlig formulering. Really, totally och right hör till talspråk, '
                'och you vänder sig direkt till läsaren.'),
            val('Choose the correct ending: Having finished the experiment, ___',
                ['the students wrote their report.', 'the report was written by the students.',
                 'the results were very surprising.'],
                'the students wrote their report.',
                'En participfras först i meningen syftar på subjektet. Det var studenterna som hade avslutat '
                'experimentet, inte rapporten eller resultaten.'),
            val('What is wrong with "Walking into the room, the smell of coffee was strong"?',
                ['The smell seems to be the one walking into the room',
                 'The verb walking should be walked, since it is in the past',
                 'The sentence needs a comma after the word coffee'],
                'The smell seems to be the one walking into the room',
                'Participfrasen syftar på subjektet, the smell. Det blir som om lukten gick in i rummet. Skriv i '
                'stället: Walking into the room, I noticed the strong smell of coffee.'),
            skriv('Shorten the relative clause to a participle: The data which were collected in 2020 show a clear '
                  'trend. → The data ___ in 2020 show a clear trend.',
                  'collected',
                  'Which were collected kan kortas till participet collected. Meningen blir kortare utan att '
                  'betydelsen ändras.'),
            para('Match the verb with its noun.',
                 [('reduce', 'reduction'), ('approve', 'approval'), ('expand', 'expansion'), ('deny', 'denial'),
                  ('emerge', 'emergence')],
                 'Substantiven bildas med olika ändelser, som -tion, -al, -sion och -ence, och de måste läras in ord '
                 'för ord.'),
            sant('Nominalisation makes a text more compact, but too much of it can make the text hard to read.', True,
                 'Substantiv packar mycket information, men en mening med för många blir tung. Det gäller att hitta '
                 'en balans.'),
            ordna('Build the sentence with a participle: Resultat som erhölls i den här studien bekräftades.',
                  ['Results', 'obtained', 'in', 'this', 'study', 'were', 'confirmed.'],
                  forklaring='Obtained in this study är en förkortad bisats, which were obtained. Participet står '
                             'direkt efter ordet det syftar på.'),
        ], beskrivning='Tränar en kompakt och saklig stil: nominaliseringar (decide blir decision), opersonliga '
                       'formuleringar utan I och participfraser som syftar rätt.'),

        niva('en-gy3-granska-argument-1', 'Straw men and slippery slopes', 'Granska argument', [
            para('Match the fallacy with its description.',
                 [('ad hominem', 'attacking the person instead of the argument'),
                  ('straw man', "twisting the other side's view to make it easy to attack"),
                  ('false dilemma', 'pretending that there are only two options'),
                  ('slippery slope', 'claiming that one small step leads to a chain of disasters'),
                  ('hasty generalisation', 'drawing a big conclusion from too few cases')],
                 'Argumentationsfel är resonemang som kan låta övertygande men inte håller. Att kunna namnen hjälper '
                 'dig att peka på felet i en analys.'),
            val('"You cannot trust her views on traffic safety. She failed her driving test twice." Which fallacy is '
                'this?',
                ['ad hominem', 'false dilemma', 'slippery slope'], 'ad hominem',
                'Talaren angriper personen i stället för argumentet. Att hon kuggade uppkörningen två gånger säger '
                'inget om hennes argument om trafiksäkerhet.'),
            val('"Either we ban all cars from the city centre, or we accept that the air will slowly poison us." '
                'Which fallacy is this?',
                ['false dilemma', 'ad hominem', 'hasty generalisation'], 'false dilemma',
                'Talaren låtsas att det bara finns två möjligheter. Det finns många andra, till exempel färre bilar, '
                'miljözoner eller bättre kollektivtrafik.'),
            val('"If we let students use calculators, soon they will not be able to count, and in the end nobody '
                'will be able to run a business." Which fallacy is this?',
                ['slippery slope', 'straw man', 'appeal to tradition'], 'slippery slope',
                'Ett litet steg påstås leda till en kedja av allt värre följder, utan belägg för att kedjan faktiskt '
                'hänger ihop.'),
            val('A: "We should have fewer exams." B: "So you think students should never be tested on anything at '
                'all?" What does B do?',
                ["B attacks a distorted version of A's view", 'B gives clear evidence against what A proposes',
                 'B agrees with A but adds a condition'],
                "B attacks a distorted version of A's view",
                'A ville ha färre prov, inte inga prov alls. B förvränger förslaget så att det blir lätt att angripa. '
                'Det kallas straw man, halmgubbe.'),
            val('"Towns with more ice-cream shops have more drownings, so ice cream causes drowning." What is wrong '
                'with this reasoning?',
                ['A third factor, hot weather, may explain both', 'The towns must be the same size to be compared',
                 'Ice cream and swimming have nothing in common'],
                'A third factor, hot weather, may explain both',
                'Att två saker hänger ihop betyder inte att den ena orsakar den andra. Varmt väder ger både mer glass '
                'och fler som badar. Correlation is not causation.'),
            skriv('Complete the term for a claim that rests on one personal story instead of systematic evidence: '
                  'anecdotal ___',
                  'evidence',
                  'Anecdotal evidence är belägg som bygger på enstaka berättelser. En historia kan vara sann men säger '
                  'inget om vad som gäller för de flesta.'),
            val('"My grandfather smoked every day and lived to 95, so smoking cannot be that dangerous." Which '
                'fallacy is this?',
                ['hasty generalisation', 'straw man', 'appeal to popularity'], 'hasty generalisation',
                'Ett enda fall kan inte väga upp all forskning om rökning. Att dra en stor slutsats ur ett eller några '
                'få fall kallas förhastad generalisering.'),
            sant('An argument can contain a fallacy and still have a true conclusion.', True,
                 'Ett dåligt argument bevisar inte att slutsatsen är fel, bara att argumentet inte håller. Därför '
                 'granskar man resonemanget, inte bara slutsatsen.'),
            sant('Referring to an expert is always a fallacy.', False,
                 'Att hänvisa till en expert inom rätt område är ofta ett bra belägg. Det blir ett fel när experten '
                 'uttalar sig om något utanför sitt område, eller när en ensam röst ställs mot vad forskningen i stort '
                 'säger.'),
        ], beskrivning='Tränar att känna igen argumentationsfel: personangrepp, halmgubbe, falskt dilemma, sluttande '
                       'plan, förhastad generalisering och samband som tas för orsak.'),

        niva('en-gy3-granska-argument-2', 'Put the screens away', 'Granska argument', [
            val('What does the writer want schools to do?',
                ['Lock phones away and read one paper book a term', 'Remove every laptop and digital textbook from '
                 'schools', 'Let pupils decide for themselves when to use phones'],
                'Lock phones away and read one paper book a term',
                'Sista stycket säger det: phones locked away during lessons, and at least one full-length book a '
                'term read on paper.'),
            val('What is the main weakness of the reasoning in the second paragraph?',
                ['It takes a link as proof that screens cause poor grades',
                 'It is based on a survey with too many pupils to be useful',
                 'It relies on numbers rather than on personal experience'],
                'It takes a link as proof that screens cause poor grades',
                'Undersökningen visar bara att mycket skärmtid och lägre betyg hänger ihop. Clearly gör sambandet '
                'till en orsak, fast andra saker, som sömn eller hemförhållanden, kan förklara båda.'),
            skriv('Find the word in the second paragraph that turns a link into a certainty. Write the word.',
                  'clearly',
                  'Clearly låter som att slutsatsen är självklar, fast undersökningen bara visar ett samband. Ordet '
                  'döljer ett hopp i resonemanget.'),
            val('Which fallacy is used in the third paragraph, about the defenders of phones in schools?',
                ['straw man', 'ad hominem', 'appeal to tradition'], 'straw man',
                'Skribenten beskriver motståndarnas åsikt som mer extrem än den troligen är, att barn ska få göra '
                'vad de vill, för att den ska bli lätt att avfärda.'),
            val('Which fallacy is used in the fourth paragraph, which begins "And where would it end?"',
                ['slippery slope', 'false dilemma', 'hasty generalisation'], 'slippery slope',
                'Mobiler i klassrummet påstås leda till att ingen kan läsa ett kontrakt om tjugo år. Kedjan av '
                'följder bevisas aldrig.'),
            val('Why does the writer include the fifth paragraph, which begins "To be fair"?',
                ['To seem fair by admitting that screens have benefits',
                 'To change position and support screens in all lessons',
                 'To give more evidence that screens harm concentration'],
                'To seem fair by admitting that screens have benefits',
                'Ett medgivande, a concession, visar att skribenten har tänkt på motsidan. Det gör texten mer '
                'trovärdig, och sedan kommer kravet ändå.'),
            val('Why is the opening story about the fifteen-year-old weak as evidence?',
                ['It is a single case that may not be typical', 'It is told in the first person',
                 'It describes a novel that the writer had not read'],
                'It is a single case that may not be typical',
                'En enda händelse kan fånga läsarens intresse, men den visar inte hur de flesta unga läser. Det är '
                'anekdotiska belägg.'),
            sant('The writer wants schools to stop using laptops.', False,
                 'Det står I do not want schools to throw their laptops out of the window. Skribenten vill låsa in '
                 'mobilerna under lektionerna och att eleverna läser en bok på papper, inte ta bort datorerna.'),
            para('Match the part of the text with the technique it uses.',
                 [('the story about the fifteen-year-old', 'anecdote'),
                  ('the survey of 2,000 pupils', 'statistics'),
                  ('the point about pupils with dyslexia', 'concession'),
                  ('the remark about the grandparents', 'appeal to tradition')],
                 'Texten blandar olika grepp: en berättelse, siffror, ett medgivande och en vädjan till hur det var '
                 'förr.'),
            val('What would a critical reader most want to know about the survey in the second paragraph?',
                ['Whether other factors, such as sleep, were considered',
                 'Which pupils in the survey had the most expensive phones',
                 'Whether the survey was answered on paper or on a screen'],
                'Whether other factors, such as sleep, were considered',
                'För att veta om skärmarna verkligen orsakar lägre betyg måste man kontrollera andra förklaringar, '
                'som sömn, läxor och hemförhållanden.'),
        ], beskrivning='En debattartikel om skärmar i skolan, med frågor om tes, belägg, medgivande och de '
                       'argumentationsfel som skribenten gör.',
            text=SKARMARNA),
    ]),
]
