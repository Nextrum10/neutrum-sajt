# -*- coding: utf-8 -*-
"""Fler engelska nivåer för åk 6, 7, 8 och 9 (2026-10-14). Fyra nya nivåer i
varje bana, i två nya områden om två nivåer:

  åk 6  Jämförelser (taller, the best, as ... as) och Läsa och förstå
  åk 7  Modala hjälpverb (can, must, should, might) och Läsa och förstå
  åk 8  Relativa bisatser (who, which, where, whose) och Läsa och förstå
  åk 9  Indirekt anföring (said that, asked if, told to) och Läsa och förstå

Det första området i varje bana är grammatik, två vanliga nivåer som går att
dra till områdets Mästarprov. Det andra är läsförståelse, två nivåer med egen
lästext. Ett område där alla nivåer har lästext får inget Mästarprov, med flit.

Samma regler som i engelska.py och engelska_mer.py: instruktionerna är på
svenska och exempelmeningarna på engelska (brittisk stavning), förklaringarna
på svenska. En skriv-fråga har ett enda rimligt svar eller alla rimliga
varianter, en ordna-fråga bara en rätt ordning (inga lika brickor, inga extra
brickor som också passar). Lästexterna är påhittade och skrivna för banken;
varje fråga går att besvara ur texten ensam. I åk 8 och 9 ställs frågorna till
texten på engelska, som i de nivåer som redan finns.

Skriven med AI och inte läst av en lärare."""
from grund import bana, niva, val, skriv, ordna, sant, para

# ---- Åk 6: lästexterna ----

REGNDAG = '\n\n'.join([
    'Today was going to be a perfect day. My brother Ali and I wanted to go to the park and fly our '
    'new kite. But when I woke up, rain was falling on the window, and the sky was dark grey.',
    'First we felt sad. Then Dad had an idea. “Let’s make a kite out of paper,” he said. “You can '
    'fly it inside the flat.” In the kitchen drawer we found some paper, two thin sticks and a ball '
    'of string. Ali drew a big yellow sun on the kite, and I drew a green frog.',
    'It took us an hour to finish it. Then we ran along the hallway, and the kite flew over our '
    'heads. It hit the lamp twice, and Dad laughed so much that he dropped his tea.',
    'Maybe it will be sunny tomorrow. But I think today was better than the park.',
])

SKOLTRADGARDEN = '\n\n'.join([
    'Every Tuesday, Class 6B works in the school garden. This spring, their teacher, Mr Evans, '
    'gave each pupil a small pot and three bean seeds. “Put them in the soil, give them water, '
    'and wait,” he said.',
    'Hana put her pot on a shelf in the corner of the classroom and watered it every morning. '
    'After one week, nothing had happened. “Mine is dead,” she told her friend Oskar. His pot '
    'stood on the window ledge, and a small green plant was already growing in it.',
    '“Be patient,” said Oskar. “Mine gets more sun than yours. Try the window ledge.” Hana moved '
    'her pot there.',
    'Three days later, she saw it: a tiny green line, no bigger than a pencil point. Hana smiled '
    'for the rest of the day. At the end of May, the plants were as tall as the pupils’ knees, '
    'and the class ate the first beans with rice for lunch. Hana said that they were the best '
    'beans she had ever eaten.',
])

# ---- Åk 7: lästexterna ----

UTAN_TELEFON = '\n\n'.join([
    'Last week I tried something new: seven days without my phone. My little sister Lisa had said '
    'that I could not do it, and I wanted to prove her wrong.',
    'On Monday I felt strange. I kept putting my hand in my pocket, but there was nothing there. '
    'On the bus I had to look out of the window, and I saw a man walking a tiny dog that was '
    'wearing a red coat. I would never have noticed that before.',
    'On Wednesday my friend Erik and I met at the park. We played football instead of looking at '
    'videos, and we talked for two hours. On Friday I finished a book that I had started in the '
    'summer.',
    'Was it easy? No. I missed my music, and I got lost twice because I had no map. But I slept '
    'better, and I felt calmer. Now I have my phone again, but I will not use it in the evenings. '
    'Lisa says I will fail. We will see.',
])

BIKUPORNA = '\n\n'.join([
    'Thirteen-year-old Tara Ahmed has an unusual hobby: she keeps bees. Her hives stand on the '
    'flat roof of the building where she lives, and a neighbour who is a beekeeper taught her the '
    'basics.',
    '“People think bees are dangerous,” Tara says. “But they only sting when they are afraid. If '
    'you move slowly and stay calm, they leave you alone.” She wears a white suit and a hat with a '
    'net, and she uses smoke to keep the bees quiet while she works.',
    'Last summer her bees made forty kilos of honey. Tara gave some to the neighbours and sold the '
    'rest at a school market. With the money, she bought a second hive.',
    'Tara knows that bees are in trouble in many places. “They need flowers,” she says. So the '
    'people in her building have planted flowers on every balcony. “It looks nicer too,” says Tara.',
])

# ---- Åk 8: lästexterna ----

KUVERTET = '\n\n'.join([
    'Selma found the envelope between pages 112 and 113 of a second-hand book. She had bought the '
    'book at a market for twenty kronor, and she had only opened it to check that no pages were '
    'missing.',
    'Inside the envelope was a photograph of two girls on a beach, laughing, with wet hair. On the '
    'back, someone had written in pencil: Dear Anna, never forget the summer of 1998. Love, Karin.',
    'Selma looked at the photo for a long time. Somebody had kept this picture inside a book for '
    'more than twenty years, and then the book had ended up on a market table between a lamp and '
    'a box of old records.',
    'Inside the cover there was a name and an address: Anna Berg, 4 Rose Street. Selma did not know '
    'if Anna still lived there. But the next Saturday she took the bus to Rose Street, rang the '
    'bell and held up the envelope. The woman who opened the door looked at it for a moment. Then '
    'she started to cry, and she asked Selma to come in for a cup of tea.',
])

SENARE_START = '\n\n'.join([
    'At Linden School, lessons used to start at eight o’clock. This autumn, the head teacher, '
    'Ms Dahl, decided to try a later start, at nine. The trial will last one term.',
    'The idea came from research on teenagers and sleep. Many young people go to bed late but '
    'still have to get up early, and Ms Dahl noticed that a lot of pupils were yawning in the '
    'first lesson. “It is hard to learn when you are half asleep,” she says.',
    'After six weeks, the school asked pupils and teachers what they thought. Most pupils said '
    'that they felt more awake in the mornings, and teachers reported that fewer pupils arrived '
    'late. However, there were problems too. Some parents leave for work before nine, so their '
    'children are alone at home for an hour. Others pointed out that the school day now ends at '
    'four, which makes it harder to find time for football practice.',
    'Ms Dahl will listen carefully before she decides anything. “A good idea for most pupils can '
    'still be a bad idea for some,” she says.',
])

# ---- Åk 9: lästexterna ----

FORSTA_DAGEN = '\n\n'.join([
    'On my first day at the Blue Door Café, I dropped a tray with six cups of hot chocolate. The '
    'crash was so loud that every customer turned round, and I wanted the floor to open up and '
    'swallow me.',
    '“Don’t worry,” said Rosa, the manager, handing me a cloth. “Everybody does it once. I did it '
    'on my second day, and the customer was wearing a white jacket.”',
    'I had expected her to be angry. Instead she showed me how to carry a tray with the heaviest '
    'cups in the middle, and she told me to stop saying sorry to every customer. “You are not '
    'sorry for being here,” she said. “Just smile and carry on.”',
    'By the end of the week I could carry three plates in one hand. By the end of the month I had '
    'become friends with Mr Kowal, an old man who came every morning for a black coffee and always '
    'left a coin under his saucer “for the tray girl”.',
    'I still think about that first day. Not because I was embarrassed, but because of what Rosa '
    'said: that mistakes are only expensive if you hide them.',
])

BIJOBB = '\n\n'.join([
    'Should teenagers have part-time jobs?',
    'Mina, 15, works at a bakery every Saturday. “I earn my own money, and I have learnt to be on '
    'time,” she says. “At first I was tired on Mondays, but now I plan my weekends better. My boss '
    'says I am one of the most reliable people she has employed.”',
    'Jack, 15, does not have a job, and he does not want one. “School is already a full-time job,” '
    'he says. “I have football training three evenings a week and homework on top of that. If I had '
    'a job as well, I would have no time to rest. There will be plenty of time to work later.”',
    'Teachers see both sides. “A small job can teach responsibility,” says one, “but it should '
    'never get in the way of sleep or schoolwork. The key is balance.”',
    'In the end, there is probably no single answer that is right for everyone.',
])

TILLAGG = [
    bana('Engelska', 'ak6', [
        niva('en-ak6-fler-jamfora-1', 'Taller, bigger, happier', 'Jämförelser', [
            val('Välj rätt form: My brother is ___ than me.', ['taller', 'more tall', 'tallest'], 'taller',
                'Tall är ett kort adjektiv. När man jämför två personer får det -er och ordet than '
                'efter sig: taller than. More används bara framför långa adjektiv, och tallest används '
                'när man jämför med många.'),
            val("Hur stavas 'big' när man jämför två saker?", ['biger', 'bigger', 'bigr'], 'bigger',
                'Ett kort adjektiv som slutar på en kort vokal och en konsonant dubblar konsonanten före '
                '-er: big blir bigger.'),
            sant("'More fast' är rätt sätt att säga snabbare på engelska.", False,
                 'Fast är ett kort adjektiv och får -er: faster. More används framför långa adjektiv, '
                 'som more interesting.'),
            val("Hur stavas 'happy' när man jämför två saker?", ['happyer', 'happier', 'happyyer'],
                'happier',
                'Slutar adjektivet på en konsonant och y byts y mot i före -er: happy blir happier.'),
            skriv("Skriv komparativ av 'nice': This room is ___ than the kitchen.", 'nicer',
                  'Slutar adjektivet redan på -e lägger man bara till -r: nice blir nicer.'),
            ordna('Bygg meningen: Min katt är snabbare än din hund.',
                  ['My', 'cat', 'is', 'faster', 'than', 'your', 'dog.'], extra=['fastest'],
                  forklaring='Faster than betyder snabbare än. Fastest används när man jämför med '
                             'flera, så det passar inte här.'),
            sant("'The blue bag is heavier than the red bag' betyder att den blå väskan väger mer än "
                 'den röda.', True,
                 'Heavier är komparativ av heavy, tyngre, och than betyder än.'),
            para('Para ihop adjektivet med dess komparativ.',
                 [('hot', 'hotter'), ('funny', 'funnier'), ('late', 'later'), ('cold', 'colder')],
                 'Hot dubblerar t: hotter. Funny byter y mot i: funnier. Late slutar på e och får '
                 'bara -r: later. Cold får bara -er: colder.'),
            val('Vilken mening jämför Anna och Ben rätt?',
                ['Anna is younger than Ben.', 'Anna is more young than Ben.', 'Anna is youngest than Ben.'],
                'Anna is younger than Ben.',
                'Young är kort och får -er: younger. Före than står komparativen, aldrig superlativen '
                'youngest.'),
            skriv("Skriv komparativ av 'easy': A bike is ___ to ride than a unicycle.", 'easier',
                  'Easy slutar på en konsonant och y, så y byts mot i: easy blir easier.'),
        ], beskrivning='Komparativ med -er: hur adjektiv jämförs och hur stavningen ändras.'),

        niva('en-ak6-fler-jamfora-2', 'The best, the most, as big as', 'Jämförelser', [
            val('Välj rätt form: Lina is the ___ girl in our class.', ['tallest', 'taller', 'most tall'],
                'tallest',
                'När man jämför med många i en grupp används superlativ: the + -est. Taller används '
                'bara när man jämför två.'),
            val('Välj rätt form: This book is ___ than that one.',
                ['more interesting', 'interestinger', 'most interesting'], 'more interesting',
                'Interesting är ett långt adjektiv. Långa adjektiv får more framför sig när man jämför '
                'två saker, inte -er.'),
            sant("'More good' är rätt komparativ av 'good'.", False,
                 'Good är oregelbundet: good, better, best. Därför säger man better, aldrig more good.'),
            val('Välj rätt form: This is the ___ day of my life!',
                ['most exciting', 'excitingest', 'more exciting'], 'most exciting',
                'Exciting är långt och får most framför sig i superlativ: the most exciting day.'),
            skriv("Skriv superlativ av 'good': Mia is my ___ friend.", 'best',
                  'Good, better, best. Superlativen av good är best, och den passar när man jämför med '
                  'alla andra.'),
            skriv("Skriv rätt form av 'bad': The weather today is ___ than yesterday.", 'worse',
                  'Bad är oregelbundet: bad, worse, worst. Komparativen är worse.'),
            val('Välj rätt ord: My bag is as heavy ___ yours.', ['as', 'than', 'that'], 'as',
                'As heavy as betyder lika tung som. Man använder as ... as, inte than, när två saker '
                'är lika.'),
            sant("'Tom is not as tall as Sam' betyder att Tom är kortare än Sam.", True,
                 'Not as tall as betyder inte lika lång som. Alltså är Sam längre än Tom.'),
            ordna('Bygg meningen: Det här är den roligaste boken.',
                  ['This', 'is', 'the', 'funniest', 'book.'], extra=['most'],
                  forklaring='Funny slutar på en konsonant och y, så y byts mot i: funniest. Funny är '
                             'kort, så most behövs inte.'),
            para('Para ihop adjektivet med dess superlativ.',
                 [('big', 'biggest'), ('happy', 'happiest'), ('good', 'best'), ('bad', 'worst')],
                 'Big dubblerar g: biggest. Happy byter y mot i: happiest. Good och bad är oregelbundna: '
                 'best och worst.'),
        ], beskrivning='Superlativ, more och most framför långa adjektiv, och as ... as.'),

        niva('en-ak6-fler-lasa-1', 'A rainy Saturday', 'Läsa och förstå', [
            val('Varför gick berättaren och Ali inte till parken?',
                ['Det regnade', 'Draken var trasig', 'Pappa hade inte tid', 'Det var för kallt'],
                'Det regnade',
                'Det står rain was falling on the window. Regnet gjorde att de inte kunde flyga drake '
                'ute.'),
            skriv('Hur många tunna pinnar hittade de i kökslådan? Skriv talet.', ['2', 'two', 'två'],
                  'Det står two thin sticks. Two är två.'),
            sant('Ali ritade en grön groda på draken.', False,
                 'Ali ritade en stor gul sol, a big yellow sun. Det var berättaren som ritade '
                 'grodan, a green frog.'),
            val('Hur lång tid tog det att göra draken?',
                ['En timme', 'Tio minuter', 'En hel dag', 'Två timmar'], 'En timme',
                'Det står It took us an hour. An hour är en timme.'),
            skriv('Vilken färg hade grodan som berättaren ritade? Skriv färgen på engelska.', 'green',
                  'Det står I drew a green frog. Green är grön.'),
            val('Vad hände med pappa när draken träffade lampan?',
                ['Han tappade sitt te', 'Han ramlade', 'Han gick ut ur rummet', 'Han blev arg'],
                'Han tappade sitt te',
                'Det står Dad laughed so much that he dropped his tea. Han skrattade så mycket att '
                'teet åkte i golvet.'),
            para('Para ihop ordet från texten med det svenska.',
                 [('drawer', 'låda'), ('string', 'snöre'), ('hallway', 'hall'), ('thin', 'tunn')],
                 'Drawer är en låda, string är ett snöre, hallway är hallen i en lägenhet och thin '
                 'betyder tunn.'),
            sant('Familjen bor i en lägenhet.', True,
                 'Pappa säger You can fly it inside the flat. Flat är lägenhet på brittisk engelska.'),
            ordna('Sätt händelserna i den ordning de hände.',
                  ['De ville flyga drake i parken', 'Pappa fick en idé', 'De gjorde en drake av papper',
                   'Draken träffade lampan'],
                  forklaring='Först ville de till parken, sedan kom regnet och pappas idé. De gjorde '
                             'draken och flög den i hallen, och då träffade den lampan.'),
            val('Vad tycker berättaren om dagen i slutet?',
                ['Att den blev riktigt rolig', 'Att den blev tråkig', 'Att den blev sämre än igår',
                 'Att regnet förstörde allt'],
                'Att den blev riktigt rolig',
                'Berättaren skriver I think today was better than the park. Det betyder att regndagen '
                'blev bättre än en dag i parken.'),
        ], beskrivning='En berättelse om en regnig lördag, med frågor om vad som står och vad '
                       'berättaren tycker.',
            text=REGNDAG),

        niva('en-ak6-fler-lasa-2', 'The school garden', 'Läsa och förstå', [
            val('Vad fick eleverna av Mr Evans?',
                ['En kruka och tre bönfrön', 'Tre små plantor', 'En spade och vatten',
                 'Fyra frön och en bok'],
                'En kruka och tre bönfrön',
                'Det står a small pot and three bean seeds. Pot är kruka, seeds är frön och bean är böna.'),
            sant('Hana vattnade sin kruka varje morgon.', True,
                 'Det står watered it every morning. Every morning betyder varje morgon.'),
            skriv('Hur många dagar efter att Hana flyttat krukan såg hon den första gröna strimman? '
                  'Skriv talet.', ['3', 'three', 'tre'],
                  'Det står Three days later, she saw it. Three days later är tre dagar senare.'),
            val('Varför hade Oskars planta kommit längre än Hanas?',
                ['Hans kruka fick mer sol', 'Han hade fler frön', 'Han vattnade två gånger om dagen',
                 'Hans lärare hjälpte honom'],
                'Hans kruka fick mer sol',
                'Oskar säger Mine gets more sun than yours. Hans kruka stod på fönsterbrädan, och '
                'Hanas stod på en hylla i hörnet.'),
            val("Vad betyder 'patient' i 'Be patient'?", ['tålmodig', 'nyfiken', 'trött', 'rädd'],
                'tålmodig',
                'Be patient betyder var tålmodig. Det tar tid för ett frö att växa, så man får vänta.'),
            sant('Plantorna var högre än eleverna i slutet av maj.', False,
                 'Det står as tall as the pupils’ knees. De var alltså ungefär knähöga, inte högre än '
                 'eleverna.'),
            para('Para ihop personen med det som stämmer.',
                 [('Mr Evans', 'läraren som gav ut fröna'), ('Hana', 'flickan vars planta växte sent'),
                  ('Oskar', 'pojken som tipsade om solen')],
                 'Mr Evans är läraren som gav ut krukorna. Hana är flickan vars planta växte sent, och '
                 'Oskar är pojken som sa att man ska flytta krukan till fönsterbrädan.'),
            val('Hur kände sig Hana när plantan syntes?', ['Glad', 'Arg', 'Uttråkad', 'Rädd'], 'Glad',
                'Det står Hana smiled for the rest of the day. Den som ler hela dagen är glad.'),
            ordna('Sätt händelserna i den ordning de hände.',
                  ['Klassen fick frön av Mr Evans', 'Hana trodde att hennes planta var död',
                   'Hana flyttade sin kruka', 'Klassen åt bönorna till lunch'],
                  forklaring='Först fick klassen frön. Efter en vecka trodde Hana att hennes planta var död, '
                             'och hon flyttade krukan. Sist i maj åt klassen bönorna.'),
            skriv('Vad åt klassen bönorna med? Skriv ordet på engelska.', ['rice', 'with rice'],
                  'Det står ate the first beans with rice for lunch. Rice är ris.'),
        ], beskrivning='En berättelse om en skolträdgård och en planta som växte sent, med frågor om '
                       'vad som står och varför.',
            text=SKOLTRADGARDEN),
    ]),

    bana('Engelska', 'ak7', [
        niva('en-ak7-fler-modala-1', 'Can, could, must', 'Modala hjälpverb', [
            val('Välj rätt ord: Anna ___ speak three languages. (Hon kan tre språk.)',
                ['can', 'cans', 'can to'], 'can',
                'Can är ett hjälpverb och får aldrig -s eller to efter sig: she can speak.'),
            val("Välj rätt form: When I was five, I ___ ride a bike. (Jag kunde inte cykla.)",
                ["couldn't", "can't", "didn't can"], "couldn't",
                "Det handlar om när jag var fem, alltså dåtid. Could är dåtid av can. Can't är presens, "
                "och didn't can finns inte."),
            val('Vilken mening om gitarren är rätt?',
                ['He can plays the guitar.', 'He can play the guitar.', 'He cans play the guitar.'],
                'He can play the guitar.',
                'Efter can står verbet i grundform, utan -s, också efter he, she och it.'),
            skriv("Skriv can eller can't: A cat ___ read a book.", ["can't", 'cannot', 'can not'],
                  "En katt kan inte läsa. Can't är kortformen av cannot, som skrivs ihop."),
            val('Välj rätt ord: You ___ wear a helmet when you ride a bike here. It is the law.',
                ['must', 'may', 'could'], 'must',
                'Must betyder att man måste, och det passar när något är en lag. May betyder får '
                'och could betyder kunde eller skulle kunna.'),
            val("Vad betyder 'You mustn't run in the corridor'?",
                ['Du får inte springa i korridoren', 'Du behöver inte springa i korridoren',
                 'Du kan inte springa i korridoren', 'Du ska springa i korridoren'],
                'Du får inte springa i korridoren',
                "Mustn't betyder får inte, ett förbud. Behöver inte heter don't have to, och kan inte "
                "heter can't."),
            skriv("Skriv must eller mustn't: You ___ cross the road when the light is red.",
                  ["mustn't", 'must not'],
                  "Man får inte gå över på rött. Mustn't är kortformen av must not."),
            sant('Efter must står verbet i grundform: She must go home now.', True,
                 'Must får aldrig -s. Det heter she must go, inte she musts go.'),
            ordna('Bygg frågan: Kan du hjälpa mig?', ['Can', 'you', 'help', 'me?'], extra=['helps'],
                  forklaring='I en fråga kommer can först. Verbet help står i grundform, utan -s.'),
            para('Para ihop ordet med vad det betyder.',
                 [('can', 'kan'), ('must', 'måste'), ("mustn't", 'får inte'), ("can't", 'kan inte')],
                 "Can är kan och can't är kan inte. Must är måste, men mustn't betyder får inte, "
                 'inte behöver inte.'),
        ], beskrivning='Can, could och must: vad man kan, kunde och måste, och vad man inte får.'),

        niva('en-ak7-fler-modala-2', 'Should, might, have to', 'Modala hjälpverb', [
            val('Välj rätt ord: You have a bad cold. You ___ stay at home and rest.',
                ['should', "shouldn't", "can't"], 'should',
                "Should betyder borde och används för råd. Shouldn't betyder borde inte, och det är "
                'ingen bra idé när man är sjuk.'),
            val("Vad betyder 'It might rain tomorrow'?",
                ['Det kanske regnar i morgon', 'Det regnar säkert i morgon', 'Det regnade i går',
                 'Det får inte regna i morgon'],
                'Det kanske regnar i morgon',
                'Might visar att något är möjligt men osäkert. Det betyder kanske eller skulle kunna.'),
            sant('Efter should står verbet i grundform: She should go home.', True,
                 'Should är ett hjälpverb och får inget -s och ingen to efter sig.'),
            val('Välj rätt ord: We ___ get up early tomorrow. The bus leaves at six.',
                ['have to', "don't have to", "mustn't"], 'have to',
                'Bussen går klockan sex, så vi måste gå upp tidigt. Have to betyder måste. '
                "Don't have to betyder behöver inte."),
            skriv("Skriv rätt form av 'have to': My dad ___ work on Saturdays. (Han måste.)", 'has to',
                  'Efter he, she och it blir have to till has to: he has to.'),
            val("Vilken mening betyder 'Du behöver inte komma'?",
                ["You don't have to come.", "You mustn't come.", "You can't to come."],
                "You don't have to come.",
                "Don't have to betyder behöver inte. Mustn't betyder får inte, och det är ett förbud."),
            sant("'You mustn't park here' och 'You don't have to park here' betyder samma sak.", False,
                 "Mustn't betyder att man inte får, ett förbud. Don't have to betyder att man inte "
                 'behöver, men att man får om man vill.'),
            skriv("Skriv kortformen av 'should not'.", "shouldn't",
                  "Should not blir shouldn't. Apostrofen står där o:et i not har tagits bort."),
            ordna('Bygg meningen: Du borde inte äta så mycket godis.',
                  ['You', "shouldn't", 'eat', 'so', 'many', 'sweets.'], extra=['much'],
                  forklaring='Godis räknar man inte på svenska, men sweets går att räkna på engelska, och då heter det '
                             'many. Much används om sådant som inte går att räkna, som milk.'),
            para('Para ihop meningen med vad den uttrycker.',
                 [('You should sleep more.', 'ett råd'), ("You mustn't smoke here.", 'ett förbud'),
                  ("You don't have to pay.", 'inget tvång'), ('It might snow.', 'en möjlighet')],
                 "Should ger ett råd. Mustn't är ett förbud, och don't have to betyder att man inte "
                 'behöver. Might visar att något kanske händer.'),
        ], beskrivning='Should, might och have to: råd, möjlighet och det man måste eller inte behöver.'),

        niva('en-ak7-fler-lasa-1', 'My week without a phone', 'Läsa och förstå', [
            val('Varför ville berättaren klara en vecka utan telefon?',
                ['För att visa sin lillasyster att det går', 'För att vinna en tävling med vännerna',
                 'För att telefonen hade gått sönder', 'För att föräldrarna hade bestämt det'],
                'För att visa sin lillasyster att det går',
                'Det står Lisa had said that I could not do it, and I wanted to prove her wrong. '
                'Berättaren ville bevisa att Lisa hade fel.'),
            skriv('Hur många dagar varade försöket? Skriv talet.', ['7', 'seven', 'sju'],
                  'Det står seven days without my phone. Seven är sju.'),
            skriv('Vilken färg hade jackan som den lilla hunden hade på sig? Skriv färgen på engelska.', 'red',
                  'Det står a tiny dog that was wearing a red coat. Red är röd.'),
            sant('Berättaren och Erik tittade på videor i parken.', False,
                 'Det står We played football instead of looking at videos. De spelade fotboll i '
                 'stället för att titta på videor.'),
            val('Varför gick berättaren vilse två gånger?',
                ['Det fanns ingen karta', 'Bussen körde fel väg', 'Erik visade fel väg',
                 'Det var mörkt ute'],
                'Det fanns ingen karta',
                'Det står I got lost twice because I had no map. Utan telefon fanns ingen karta.'),
            para('Para ihop ordet från texten med det svenska.',
                 [('pocket', 'ficka'), ('strange', 'konstig'), ('prove', 'bevisa'),
                  ('instead of', 'i stället för')],
                 'Pocket är ficka, strange är konstig, prove är bevisa och instead of är i stället för.'),
            sant('Berättaren läste ut en bok under veckan.', True,
                 'Det står On Friday I finished a book that I had started in the summer.'),
            val("Vad betyder 'calmer' i texten?", ['lugnare', 'argare', 'piggare', 'räddare'], 'lugnare',
                'Calm betyder lugn, och calmer är lugnare. Berättaren sov bättre och kände sig lugnare.'),
            val('Hur tyckte berättaren att veckan blev?',
                ['Svår, men med flera fördelar', 'Lätt, men ganska tråkig', 'Så svår att allt blev fel',
                 'Fullständigt meningslös'],
                'Svår, men med flera fördelar',
                'Berättaren frågar Was it easy? och svarar No. Men det står också att berättaren sov '
                'bättre och kände sig lugnare, så veckan hade fördelar.'),
            ordna('Sätt händelserna i den ordning de hände.',
                  ['Berättaren kände sig konstig', 'Berättaren spelade fotboll med Erik',
                   'Berättaren läste ut en bok', 'Berättaren fick tillbaka telefonen'],
                  forklaring='Måndagen kändes konstig, på onsdagen spelade de fotboll och på fredagen '
                             'blev boken klar. Efter veckan fick berättaren tillbaka telefonen.'),
        ], beskrivning='Ett blogginlägg om en vecka utan telefon, med frågor om vad som hände och '
                       'vad det betyder.',
            text=UTAN_TELEFON),

        niva('en-ak7-fler-lasa-2', 'Bees on the roof', 'Läsa och förstå', [
            val('Var står Taras bikupor?',
                ['På taket på huset där hon bor', 'På en balkong högst upp i huset',
                 'I trädgården bakom skolan', 'Hos grannen som lärde henne'],
                'På taket på huset där hon bor',
                'Det står Her hives stand on the flat roof of the building where she lives. Roof är '
                'tak. Balkongerna har blommor, inte bikupor.'),
            sant('En granne lärde Tara grunderna.', True,
                 'Det står a neighbour who is a beekeeper taught her the basics. Neighbour är granne.'),
            val('Varför använder Tara rök?',
                ['För att bina ska vara lugna', 'För att få bina att flyga iväg',
                 'För att göra honungen mörkare', 'För att hålla kuporna varma'],
                'För att bina ska vara lugna',
                'Det står she uses smoke to keep the bees quiet while she works. Quiet betyder lugn '
                'och stilla.'),
            skriv('Hur många kilo honung gjorde bina förra sommaren? Skriv talet.',
                  ['40', 'forty', 'fyrtio'],
                  'Det står her bees made forty kilos of honey. Forty är fyrtio.'),
            skriv('Tara använde pengarna till att köpa en andra ___. Skriv ordet på engelska.',
                  ['hive', 'a hive', 'beehive', 'a beehive', 'bee hive'],
                  'Det står With the money, she bought a second hive. Hive är bikupa.'),
            sant('Tara tycker att bin alltid är farliga.', False,
                 'Tara säger att bin bara sticks när de är rädda: they only sting when they are afraid. '
                 'Är man lugn lämnar de en i fred.'),
            val("Vad menar Tara med 'they leave you alone'?",
                ['De låter en vara i fred', 'De följer efter en hem', 'De äter upp ens mat',
                 'De flyger bort för alltid'],
                'De låter en vara i fred',
                'Leave you alone betyder lämna en i fred. Om man rör sig långsamt och är lugn gör bina '
                'ingenting.'),
            val('Varför har invånarna planterat blommor på balkongerna?',
                ['Bin behöver blommor för att klara sig', 'Husägaren kräver att alla har blommor',
                 'Blommorna skyddar mot bistick', 'De vill sälja blommorna'],
                'Bin behöver blommor för att klara sig',
                'Tara säger They need flowers, och sedan har invånarna planterat blommor. Orden So the '
                'people in her building visar att det är en följd av det.'),
            para('Para ihop orden från texten med svenskan.',
                 [('hive', 'bikupa'), ('honey', 'honung'), ('balcony', 'balkong'),
                  ('neighbour', 'granne')],
                 'Hive är en bikupa, honey är honung, balcony är en balkong och neighbour är en granne. '
                 'Neighbour stavas så på brittisk engelska.'),
            ordna('Sätt händelserna i den ordning de hände.',
                  ['Tara lärde sig grunderna av en granne', 'Bina gjorde honung',
                   'Tara sålde honung på en skolmarknad', 'Tara köpte en andra bikupa'],
                  forklaring='Tara lärde sig först att sköta bin. Förra sommaren gjorde bina honung, '
                             'Tara sålde den och köpte för pengarna en andra bikupa.'),
        ], beskrivning='En artikel om en tonåring som har bin på taket, med frågor om vad som står '
                       'och varför.',
            text=BIKUPORNA),
    ]),

    bana('Engelska', 'ak8', [
        niva('en-ak8-fler-relativ-1', 'Who, which, where', 'Relativa bisatser', [
            val('Välj rätt ord: The woman ___ lives next door is a nurse.', ['who', 'which', 'where'],
                'who',
                'Who används om personer. Which används om saker, och where om platser.'),
            val('Välj rätt ord: The phone ___ I bought last week is already broken.',
                ['which', 'who', 'where'], 'which',
                'Phone är en sak, och om saker används which.'),
            val('Välj rätt ord: This is the town ___ I was born.', ['where', 'who', 'which'], 'where',
                'Town är en plats, och där används where: the town where I was born.'),
            sant("'The girl which sings in the choir is my sister' är en korrekt mening.", False,
                 'Girl är en person, så det ska vara who: the girl who sings in the choir.'),
            skriv('Skriv who, which eller where: That is the bike ___ I got for my birthday.',
                  ['which', 'that'],
                  'Bike är en sak, så which passar. I vardagligt språk går that också.'),
            skriv('Skriv who, which eller where: The park ___ we play football is near the school.', 'where',
                  'Park är en plats, så where passar: the park where we play.'),
            val('Vilken mening om pojken som vann loppet är rätt?',
                ['The boy who won the race is my cousin.', 'The boy which won the race is my cousin.',
                 'The boy where won the race is my cousin.'],
                'The boy who won the race is my cousin.',
                'Boy är en person, så who. Which är för saker och where är för platser.'),
            sant("Ordet 'who' passar i 'The teacher who helped me was kind'.", True,
                 'Teacher är en person, och om personer används who.'),
            ordna('Bygg meningen: Jag känner en tjej som talar tre språk.',
                  ['I', 'know', 'a', 'girl', 'who', 'speaks', 'three', 'languages.'], extra=['which'],
                  forklaring='Girl är en person, så who binder ihop meningen. Which är för saker. Efter '
                             'who får verbet -s: she speaks.'),
            para('Para ihop början på meningen med slutet.',
                 [('The woman who', 'lives next door is a doctor'),
                  ('The book which', 'I borrowed was very long'),
                  ('The restaurant where', 'we had dinner was lovely')],
                 'Who hör till personen, which till boken och where till platsen där man åt middag.'),
        ], beskrivning='Who, which och where: att binda ihop meningar om personer, saker och platser.'),

        niva('en-ak8-fler-relativ-2', 'Whose, that och långa meningar', 'Relativa bisatser', [
            val('Välj rätt ord: That is the boy ___ bike was stolen.', ['whose', 'who', 'which'], 'whose',
                'Whose betyder vars och visar vem något tillhör: the boy whose bike. Who och which '
                'visar inte vem som äger något.'),
            val("Vad betyder 'whose' i 'The girl whose dog barks all night is my neighbour'?",
                ['vars', 'vem', 'som', 'var'], 'vars',
                'Whose betyder vars: flickan vars hund skäller hela natten.'),
            val("Vilken mening binder ihop 'I met a man.' och 'He plays the violin.' rätt?",
                ['I met a man who plays the violin.', 'I met a man which plays the violin.',
                 'I met a man whose plays the violin.'],
                'I met a man who plays the violin.',
                'He i andra meningen är en person och subjektet, så who ersätter he. Whose måste följas '
                'av ett substantiv.'),
            val("Vilket ord kan stå i stället för 'that' i 'The cake that she baked was delicious'?",
                ['which', 'who', 'whose'], 'which',
                'Cake är en sak, och om saker går that att byta mot which. Who är för personer, och '
                'whose visar vem något tillhör.'),
            skriv('Skriv whose, who eller which: She is the artist ___ paintings are sold all over the '
                  'world.', 'whose',
                  'Det är konstnärens målningar, alltså något som tillhör henne. Då används whose.'),
            skriv('Skriv who, which eller where: This is the gym ___ my brother trains every day.', 'where',
                  'Gym är en plats, och där används where.'),
            sant("'The man I met was kind' är en korrekt mening, trots att ordet 'who' saknas.", True,
                 'När det som binder ihop är objekt i bisatsen (I met him) kan man utelämna who eller '
                 'that. The man (who) I met was kind.'),
            sant("'The woman lives next door is a nurse' är en korrekt mening där 'who' har tagits bort.",
                 False,
                 'Här är who subjekt i bisatsen (she lives next door), och då får det inte utelämnas: '
                 'The woman who lives next door.'),
            ordna('Bygg meningen: Det här är pojken vars cykel blev stulen.',
                  ['This', 'is', 'the', 'boy', 'whose', 'bike', 'was', 'stolen.'], extra=['who'],
                  forklaring='Vars heter whose, och efter whose kommer ett substantiv: whose bike. Who '
                             'skulle inte visa vem cykeln tillhör.'),
            para('Para ihop de två meningarna med den som binder ihop dem.',
                 [('I have a cousin. He speaks four languages.', 'I have a cousin who speaks four languages.'),
                  ('This is a shop. It sells old books.', 'This is a shop which sells old books.'),
                  ('Here is the school. I was a pupil there.', 'Here is the school where I was a pupil.')],
                 'Who ersätter en person, which en sak, och where en plats.'),
        ], beskrivning='Whose för vem något tillhör, och när man får och inte får utelämna who och that.'),

        niva('en-ak8-fler-lasa-1', 'Hidden in the book', 'Läsa och förstå', [
            val('Why did Selma open the book?',
                ['To check that all pages were there', 'To see if anyone had written a name in it',
                 'To find out how the story would end', 'To look for money that was hidden'],
                'To check that all pages were there',
                'Det står she had only opened it to check that no pages were missing. Selma ville bara '
                'se att inga sidor saknades.'),
            sant('Selma paid twenty kronor for the book.', True,
                 'Det står She had bought the book at a market for twenty kronor.'),
            val('What was in the envelope?',
                ['A photograph of two girls', 'A drawing of a beach', 'A ticket for a concert',
                 'A list of names'],
                'A photograph of two girls',
                'Det står Inside the envelope was a photograph of two girls on a beach.'),
            skriv('In which year was the summer that the note talks about? Write the year.', '1998',
                  'Det står never forget the summer of 1998.'),
            skriv('Who wrote the note on the back of the photo? Write the name.', 'Karin',
                  'Anteckningen börjar Dear Anna och slutar Love, Karin. Karin skrev den, och Anna fick '
                  'den.'),
            val('How did Selma find out where Anna lived?',
                ['It was written inside the cover', 'Karin gave her the address',
                 'A neighbour told her', 'It was printed on the photo'],
                'It was written inside the cover',
                'Det står Inside the cover there was a name and an address: Anna Berg, 4 Rose Street.'),
            para('Match the word from the text with the Swedish word.',
                 [('envelope', 'kuvert'), ('second-hand', 'begagnad'), ('cover', 'omslag'),
                  ('beach', 'strand')],
                 'Envelope är ett kuvert, second-hand betyder begagnad, alltså att någon har ägt den '
                 'förut, cover är omslaget på en bok och beach är en strand.'),
            val('Why did the woman at the door start to cry?',
                ['The photo reminded her of a happy time', 'She was angry that Selma had come',
                 'She had lost her own keys', 'She was afraid of strangers'],
                'The photo reminded her of a happy time',
                'Kvinnan grät inte av ilska eller rädsla, för hon bjöd in Selma på te. Bilden från '
                'sommaren 1998 väckte glada minnen.'),
            sant('The photograph had been in the book for less than ten years.', False,
                 'Det står for more than twenty years. More than twenty years är mer än tjugo år.'),
            ordna('Put the events in the order they happen.',
                  ['Selma bought a book at a market', 'Selma found an envelope in the book',
                   'Selma took the bus to Rose Street', 'A woman asked Selma to come in'],
                  forklaring='Först köpte Selma boken, sedan hittade hon kuvertet. Veckan efter åkte hon '
                             'bussen till Rose Street, och kvinnan där bjöd in henne.'),
        ], beskrivning='En berättelse om ett kuvert i en begagnad bok, med frågor om vad som står och '
                       'vad man kan förstå av det.',
            text=KUVERTET),

        niva('en-ak8-fler-lasa-2', 'A later start', 'Läsa och förstå', [
            skriv('How long will the trial last? Complete: one ___.', ['term', 'one term'],
                  'Det står The trial will last one term. Term är termin.'),
            val('Why did Ms Dahl want to try a later start?',
                ['Many pupils seemed sleepy in the first lesson', 'The school did not have enough teachers',
                 'Pupils wanted more time for football', 'The buses arrived too early'],
                'Many pupils seemed sleepy in the first lesson',
                'Det står Ms Dahl noticed that a lot of pupils were yawning in the first lesson. '
                'Yawning är att gäspa.'),
            sant('Ms Dahl has already decided to keep the later start.', False,
                 'Det står Ms Dahl will listen carefully before she decides anything. Hon har alltså '
                 'inte bestämt något än.'),
            skriv('After how many weeks did the school ask pupils and teachers what they thought? '
                  'Write the number.',
                  ['6', 'six', 'sex', 'six weeks'],
                  'Det står After six weeks, the school asked pupils and teachers what they thought. '
                  'Six är sex.'),
            skriv('Most pupils said that they felt more ___ in the mornings. Write the missing word.',
                  ['awake', 'more awake'],
                  'Det står Most pupils said that they felt more awake in the mornings. Awake betyder '
                  'vaken.'),
            val('What is one problem with the later start for some families?',
                ['Children are home alone for an hour', 'Parents must start work later',
                 'The school buses stop running', 'Lunch is served too early'],
                'Children are home alone for an hour',
                'Det står Some parents leave for work before nine, so their children are alone at home '
                'for an hour.'),
            sant('The school day now ends at four.', True,
                 'Det står the school day now ends at four. Det gör det svårare att hinna med '
                 'fotbollsträningen.'),
            val("What does 'pointed out' mean in 'Others pointed out that the school day now ends at four'?",
                ['mentioned as a fact', 'pointed with a finger', 'refused to accept', 'forgot about'],
                'mentioned as a fact',
                'Point out betyder att påpeka. Några sa att skoldagen nu slutar klockan fyra, och '
                'ingen pekade med fingret.'),
            val("What does Ms Dahl mean by 'A good idea for most pupils can still be a bad idea for some'?",
                ['A change good for many may be bad for a few',
                 'Most pupils will dislike the new start', 'A bad idea can become good with time',
                 'The few pupils are always right'],
                'A change good for many may be bad for a few',
                'Ms Dahl menar att en ändring som är bra för de flesta kan vara dålig för några, som '
                'barnen som blir ensamma hemma en timme.'),
            para('Match the word from the text with the Swedish word.',
                 [('head teacher', 'rektor'), ('research', 'forskning'), ('term', 'termin'),
                  ('trial', 'försök')],
                 'Head teacher är rektor, research är forskning, term är termin och trial är ett '
                 'försök som man provar under en tid.'),
        ], beskrivning='En nyhetsartikel om en skola som provar att börja lektionerna senare, med '
                       'frågor om vad som står och vad som menas.',
            text=SENARE_START),
    ]),

    bana('Engelska', 'ak9', [
        niva('en-ak9-fler-referat-1', 'Said that, told me', 'Indirekt anföring', [
            val("Mia said, 'I like my new school.' Vilken mening återger det rätt?",
                ['Mia said that she liked her new school.', 'Mia said that I liked my new school.',
                 'Mia said that she likes my new school.'],
                'Mia said that she liked her new school.',
                'När man återger vad någon sagt byts I mot she och my mot her, och verbet flyttas '
                'ett steg bakåt i tiden: like blir liked.'),
            val('Välj rätt ord: She ___ me that she was tired.', ['told', 'said', 'spoke'], 'told',
                'Efter told kommer personen man talade med: told me. Said används utan person, som i '
                'she said that.'),
            skriv("Skriv verbet i preteritum: Lisa said, 'I live in Malmö.' Lisa said that she ___ in "
                  'Malmö.', 'lived',
                  'Vad någon sagt återges i förfluten tid, så live blir lived.'),
            sant("'She told that she was ill' är en korrekt mening.", False,
                 'Efter told måste personen med: she told me that she was ill. Utan en person säger man '
                 'she said that she was ill.'),
            val('Välj rätt ord: He ___ that he would be late.', ['said', 'told', 'asked'], 'said',
                'Said kan stå utan person efter sig: he said that. Told behöver en person, '
                'som told me, och asked används för frågor.'),
            skriv("Skriv ordet som fattas: Sara said, 'I am leaving today.' Sara said that she was "
                  'leaving ___ day. (samma dag som hon sa det)', ['that', 'the same'],
                  'Today blir that day när man återger något i efterhand. Den dag hon sa det är inte '
                  'dagen då vi berättar det.'),
            ordna('Bygg meningen: Han sa att hon bodde i Göteborg.',
                  ['He', 'said', 'that', 'she', 'lived', 'in', 'Gothenburg.'], extra=['live'],
                  forklaring='Said that betyder sa att. Hon bodde heter she lived, i preteritum. '
                             'Gothenburg är Göteborg på engelska.'),
            skriv("Skriv verbet: Erik said, 'I can swim.' Erik said that he ___ swim.", 'could',
                  'Can blir could när man återger det som sagts i efterhand.'),
            sant("'I told him that I was late' betyder 'Jag sa till honom att jag var sen'.", True,
                 'Told him betyder sa till honom. Efter told kommer personen.'),
            para('Para ihop det som sades med hur det återges.',
                 [('I am hungry.', 'She said she was hungry.'),
                  ('I will help you.', 'She said she would help me.'),
                  ('I have finished.', 'She said she had finished.'),
                  ('I live here.', 'She said she lived there.')],
                 'Am blir was, will blir would och have blir had. Live blir lived, och här blir there. '
                 'Verbet flyttas alltså ett steg bakåt i tiden.'),
        ], beskrivning='Att återge vad någon sagt: said that, told me och tidsförskjutning.'),

        niva('en-ak9-fler-referat-2', 'Asked if, told to', 'Indirekt anföring', [
            val("Tom asked me, 'Do you like pizza?' Vilken mening återger frågan rätt?",
                ['Tom asked me if I liked pizza.', 'Tom asked me did I like pizza.',
                 'Tom asked me that I liked pizza.'],
                'Tom asked me if I liked pizza.',
                'En ja/nej-fråga som återges får if eller whether, och ordföljden blir som i ett '
                'påstående. Did och that hör inte hit.'),
            val("Läraren sa: 'Open your books.' Vilken mening återger det rätt?",
                ['The teacher told us to open our books.', 'The teacher told us open our books.',
                 'The teacher told us that open our books.'],
                'The teacher told us to open our books.',
                'En uppmaning återges med told + person + to + verb: told us to open.'),
            skriv("Skriv ordet som fattas: He asked me ___ I wanted tea or coffee. (Do you want tea or "
                  'coffee?)', ['if', 'whether'],
                  'En ja/nej-fråga som återges börjar med if eller whether. Båda är rätt.'),
            sant("'He asked if I was ready' slutar med punkt, inte med frågetecken.", True,
                 'Meningen är ett påstående om att han frågade, inte en fråga. Därför slutar den med '
                 'punkt.'),
            val("'Where do you live?' Vilken mening återger frågan rätt?",
                ['She asked where I lived.', 'She asked where did I live.', 'She asked where I do live.'],
                'She asked where I lived.',
                'I en återgiven fråga blir ordföljden som i ett påstående, utan do eller did, och '
                'verbet flyttas bakåt i tiden: lived.'),
            skriv("Skriv ordet som fattas: Mum told us not ___ be late. (Don't be late!)", 'to',
                  'En nekande uppmaning återges med not to + verb: told us not to be late.'),
            ordna('Bygg meningen: Han frågade om jag kunde hjälpa honom.',
                  ['He', 'asked', 'if', 'I', 'could', 'help', 'him.'], extra=['did'],
                  forklaring='Frågan återges med if, och can flyttas bakåt i tiden till could.'),
            sant('I en återgiven fråga står verbet före subjektet: She asked where was the bus stop.',
                 False,
                 'Ordföljden blir som i ett påstående: She asked where the bus stop was.'),
            skriv("Skriv verbet i preteritum: 'Where is the station?' She asked me where the station "
                  '___.', 'was',
                  'Is blir was när frågan återges i efterhand, och verbet står sist: where the station was.'),
            para('Para ihop det som sades med hur det återges.',
                 [('Close the door!', 'He told me to close the door.'),
                  ("Don't touch it!", 'He told me not to touch it.'),
                  ('Are you ready?', 'He asked if I was ready.'),
                  ('Where do you live?', 'He asked where I lived.')],
                 'Uppmaningar blir told + person + to, och nekande blir not to. Frågor blir asked, med '
                 'if för ja/nej-frågor och frågeordet kvar för de andra.'),
        ], beskrivning='Att återge frågor och uppmaningar: asked if, asked where och told me to.'),

        niva('en-ak9-fler-lasa-1', 'The first day at the café', 'Läsa och förstå', [
            val("What happened on the narrator's first day?",
                ['She dropped a tray with six cups', 'She was late for work',
                 "She forgot a customer's order", 'She spilled coffee on Rosa'],
                'She dropped a tray with six cups',
                'Det står I dropped a tray with six cups of hot chocolate.'),
            skriv("What is Rosa's job at the café? Write one word.", ['manager', 'the manager'],
                  'Det står Rosa, the manager. Manager är chef.'),
            sant('Rosa has never dropped a tray herself.', False,
                 'Rosa säger I did it on my second day. Hon har tappat en bricka själv, och en kund '
                 'hade vit jacka.'),
            val('Why does Rosa tell the narrator to stop saying sorry to every customer?',
                ['She wants the narrator to feel more confident', 'She thinks customers dislike polite people',
                 'She wants the work to go faster', 'She is tired of hearing it herself'],
                'She wants the narrator to feel more confident',
                'Rosa säger You are not sorry for being here. Just smile and carry on. Hon vill att '
                'berättaren ska känna sig trygg i stället för att be om ursäkt hela tiden.'),
            skriv('What does Mr Kowal drink every morning? Write the drink in English.',
                  ['coffee', 'black coffee', 'a black coffee'],
                  'Det står came every morning for a black coffee.'),
            val("What does 'I wanted the floor to open up and swallow me' show?",
                ['The narrator felt very embarrassed', 'The narrator was afraid of the floor',
                 'The narrator wanted to go home and sleep', 'The narrator was ill'],
                'The narrator felt very embarrassed',
                'Man vill försvinna ner i golvet när man skäms. Det är ett idiom för att vara mycket '
                'generad.'),
            para('Match the word with the Swedish word.',
                 [('tray', 'bricka'), ('saucer', 'tefat'), ('cloth', 'trasa'), ('customer', 'kund')],
                 'Tray är en bricka, saucer är ett tefat, cloth är en trasa och customer är en kund.'),
            sant('Mr Kowal always left a coin under his saucer.', True,
                 'Det står always left a coin under his saucer.'),
            val('What does the last sentence mean?',
                ['Hiding a mistake usually makes things worse', 'Mistakes cost cafés a lot of money',
                 'You should never make a mistake', 'Expensive cups break more easily'],
                'Hiding a mistake usually makes things worse',
                'Rosa menar att ett misstag bara blir dyrt om man gömmer det. Är man ärlig kan man lära '
                'sig av det, och ingen skada blir större.'),
            ordna('Put the events in the order they happen.',
                  ['She dropped a tray of hot chocolate', 'Rosa showed her how to carry a tray',
                   'She learned to carry three plates', 'She became friends with Mr Kowal'],
                  forklaring='På första dagen tappade hon brickan, och Rosa visade hur man bär den. Efter '
                             'en vecka bar hon tre tallrikar, och efter en månad var hon vän med '
                             'Mr Kowal.'),
        ], beskrivning='En berättelse om första dagen på ett jobb på ett café, med frågor om vad som '
                       'står och vad det betyder.',
            text=FORSTA_DAGEN),

        niva('en-ak9-fler-lasa-2', 'Teenagers and jobs', 'Läsa och förstå', [
            skriv('On which day of the week does Mina work? Write the day.', ['Saturday', 'Saturdays'],
                  'Det står Mina, 15, works at a bakery every Saturday.'),
            val('What has Mina learnt from her job, according to her?',
                ['To be on time', 'To bake bread', 'To save money for a trip', 'To speak to customers'],
                'To be on time',
                'Mina säger I have learnt to be on time. On time betyder i tid.'),
            sant('Mina was never tired after she started her job.', False,
                 'Hon säger At first I was tired on Mondays. Sedan blev det bättre när hon planerade '
                 'sina helger bättre.'),
            skriv('How many evenings a week does Jack have football training? Write the number.',
                  ['3', 'three', 'tre'],
                  'Det står football training three evenings a week.'),
            val("Why does Jack call school 'a full-time job'?",
                ['It fills as much of his week as a job', 'He earns money by going to school',
                 'His teachers give him real work tasks', 'School has no holidays during the year'],
                'It fills as much of his week as a job',
                'Full-time betyder heltid. Jack menar att skolan och läxorna tar lika mycket tid som ett '
                'riktigt jobb, så han hinner inte vila om han också har ett jobb.'),
            val("What is the teacher's opinion?",
                ['A job is fine if sleep and schoolwork do not suffer', 'Teenagers should never have a job',
                 'Teenagers should work as much as possible', 'Football is better for teenagers than jobs'],
                'A job is fine if sleep and schoolwork do not suffer',
                'Läraren säger att ett litet jobb kan lära ansvar, men att det inte får komma i vägen '
                'för sömn eller skolarbete: The key is balance.'),
            para('Match the word from the text with the Swedish word.',
                 [('reliable', 'pålitlig'), ('responsibility', 'ansvar'), ('balance', 'balans'),
                  ('employ', 'anställa')],
                 'Reliable är pålitlig, responsibility är ansvar, balance är balans och employ är anställa.'),
            sant('Jack thinks that he can work later in life.', True,
                 'Han säger There will be plenty of time to work later. Han har inget emot att jobba, '
                 'bara inte nu.'),
            para('Match the person with what the text says.',
                 [('Mina', 'has a job on Saturdays'), ('Jack', 'wants time to rest'),
                  ('The teacher', 'says that balance is the key')],
                 'Mina jobbar på ett bageri på lördagar. Jack vill ha tid att vila, och läraren säger '
                 'att nyckeln är balans.'),
            val('What is the main message of the text?',
                ['People can disagree about teenage jobs', 'Jobs are always bad for teenagers',
                 'Teenagers with jobs get better grades', 'Money is the only reason to work'],
                'People can disagree about teenage jobs',
                'Texten visar Minas, Jacks och lärarens åsikter, och slutar med att det inte finns ett '
                'enda svar som passar alla. Inget av de andra alternativen står i texten.'),
        ], beskrivning='En text där två tonåringar och en lärare säger sitt om att ha ett extrajobb, '
                       'med frågor om vad som står och vad det betyder.',
            text=BIJOBB),
    ]),
]
