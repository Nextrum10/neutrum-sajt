# -*- coding: utf-8 -*-
"""Engelska åk 4, 6 och 8. Ordförråd först, sedan verb, substantiv, frågeord,
adjektiv och prepositioner i den takt Lgr22 bygger upp dem; instruktionerna
är på svenska för de yngsta och mer på engelska i åk 8, och förklaringarna
är på svenska så att regeln går fram också när frågan inte gjorde det.

Skriv-frågorna har ett enda rimligt svar: där ett ord har synonymer eller
vardagsformer (katt är också kitty, mamma är mum, mom och mother) är frågan
ett val eller en ordna-fråga i stället, och där brittisk och amerikansk
stavning skiljer sig godtas båda (grey, gray).
Verbformerna låses med "i presens", "i preteritum" eller en tidsangivelse,
för "He ___ to school by bus" går lika gärna att fylla med went.

Läsförståelsen i åk 6 och 8 har egna texter, skrivna för banken. Varje
fråga går att besvara ur texten ensam, och en slutsats frågas bara när
texten motsäger de felaktiga alternativen."""
from grund import bana, niva, val, skriv, ordna, sant, para

# Lästexterna, ett stycke per element. Spelaren får dem åtskilda av en
# tom rad, så brevets hälsning och underskrift är egna stycken.
BREVET = '\n\n'.join([
    'Hi Elin,',
    'Thank you for your letter! My name is Sam, and I am twelve years old. I live in a small '
    'town by the sea with my mum, my little brother Max and our old dog Biscuit.',
    "My school starts at nine o'clock, and I walk there with my best friend Ava. My favourite "
    "subject is science, because we do experiments. I don't like maths very much, but my maths "
    'teacher is really funny.',
    'After school I often take Biscuit to the beach. He is ten years old, so he walks slowly '
    'now, but he still loves the water. On Saturdays I play football, and on Sundays we visit '
    'my grandma. She makes the best apple pie in the world!',
    'What do you do in your free time? Do you have any pets? Please write back soon.',
    'Best wishes, Sam',
])

SISTA_BUSSEN = '\n\n'.join([
    'Maya missed the last bus by one minute. She stood at the empty stop and watched its red '
    'lights disappear around the corner. It was her own fault. Her mum had told her to leave '
    'the party at ten, and it was now twenty past.',
    'Her phone was almost dead. She sent a quick message to her mum: “Missed the bus. Walking '
    'home.” Then the screen went black.',
    'The walk would take forty minutes. Maya pulled up her hood and started along the main '
    'road, where the street lights were bright and a few cars still passed. The shortcut '
    'through the park would save fifteen minutes, but she had promised never to take it '
    'after dark.',
    "Halfway home, a car slowed down beside her. Maya's heart jumped. Then she saw the dented "
    "door and the sticker of a smiling sun on the back window. It was her mum's car.",
    '“Get in,” her mum said. Her voice was calm, but she was still wearing her slippers.',
    'For a while neither of them spoke. Maya waited for the lecture: about being responsible, '
    "about charging her phone, about ten o'clock meaning ten o'clock.",
    "Instead her mum said, “You didn't go through the park.”",
    '“How do you know?”',
    '“Because I drove through it first.”',
    'Maya looked down at the slippers and understood that her mum had not taken the time to '
    'change into shoes. She said sorry, and this time she really meant it.',
])

BANOR = [
    bana('Engelska', 'ak4', [
        niva('en-ak4-ordforrad-1', 'Färger, tal och djur', 'Ordförråd', [
            val("Vad heter 'katt' på engelska?", ['cat', 'dog', 'cow', 'rat'], 'cat',
                'Katt heter cat. Dog är hund, cow är ko och rat är råtta.'),
            val("Vilket tal är 'fifteen'?", ['5', '15', '50', '13'], '15',
                'Fifteen är femton. Tal som slutar på -teen ligger mellan 13 och 19, '
                'och tal som slutar på -ty är tiotal, som fifty (50).'),
            val("Vad heter 'gul' på engelska?", ['yellow', 'green', 'blue', 'orange'], 'yellow',
                'Gul heter yellow. Green är grön och blue är blå.'),
            val("Vad betyder 'horse'?", ['häst', 'hus', 'ko'], 'häst',
                'Horse betyder häst. Hus heter house, med u i stället för r, och ko heter cow.'),
            skriv('Skriv talet 12 med bokstäver på engelska.', 'twelve',
                  'Tolv heter twelve. Talen 11 och 12 har egna namn: eleven och twelve.'),
            skriv("Skriv 'grå' på engelska.", ['grey', 'gray'],
                  'Grå heter grey i brittisk engelska och gray i amerikansk engelska. Båda är rätt.'),
            ordna('Ordna talen från minst till störst.', ['three', 'eight', 'eleven', 'twenty'],
                  forklaring='Three är 3, eight är 8, eleven är 11 och twenty är 20.'),
            ordna('Bygg meningen: Jag har en svart katt.', ['I', 'have', 'a', 'black', 'cat.'],
                  forklaring='Färgen står före djuret, precis som på svenska: a black cat.'),
        ], beskrivning='Vanliga ord för färger, tal och djur.'),

        niva('en-ak4-ordforrad-2', 'Veckodagar och månader', 'Ordförråd', [
            val("Vad heter 'måndag' på engelska?", ['Monday', 'Sunday', 'Tuesday', 'Thursday'], 'Monday',
                'Måndag heter Monday. Sunday är söndag och Tuesday är tisdag.'),
            val("Vilken dag är 'Thursday'?", ['tisdag', 'torsdag', 'fredag'], 'torsdag',
                'Thursday är torsdag. Båda orden kommer från guden Tor. Tisdag heter Tuesday.'),
            skriv("Skriv 'onsdag' på engelska.", 'Wednesday',
                  'Onsdag heter Wednesday. Det uttalas ungefär "wensdej", men stavas med ett d före n: '
                  'Wed-nes-day.'),
            skriv('Vilken dag kommer efter Friday? Skriv den på engelska.', 'Saturday',
                  'Friday är fredag. Efter fredag kommer lördag, och lördag heter Saturday.'),
            val("Vad heter 'juli' på engelska?", ['June', 'July', 'January'], 'July',
                'Juli heter July och juni heter June. På engelska skrivs månaderna med stor bokstav.'),
            val('Vilken månad kommer före March?', ['February', 'April', 'May'], 'February',
                'March är mars. Före mars kommer februari, och februari heter February.'),
            ordna('Ordna veckodagarna i rätt ordning.', ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
                  forklaring='Måndag, tisdag, onsdag, torsdag heter Monday, Tuesday, Wednesday, Thursday.'),
            ordna('Bygg meningen: Min födelsedag är i augusti.', ['My', 'birthday', 'is', 'in', 'August.'],
                  forklaring='Före en månad står in: in August. Månaden skrivs med stor bokstav på engelska.'),
        ], beskrivning='Veckans dagar och årets månader på engelska.'),

        niva('en-ak4-ordforrad-3', 'Familj och kroppen', 'Ordförråd', [
            val("Vad heter 'bror' på engelska?", ['brother', 'mother', 'father', 'sister'], 'brother',
                'Bror heter brother. Mother är mamma, father är pappa och sister är syster.'),
            val("Vem är 'grandfather'?", ['farfar eller morfar', 'farbror eller morbror', 'kusin'],
                'farfar eller morfar',
                'Grandfather är pappas eller mammas pappa. Farbror och morbror heter uncle, '
                'och kusin heter cousin.'),
            val("Vad heter 'huvud' på engelska?", ['head', 'hand', 'hair', 'heart'], 'head',
                'Huvud heter head. Hand är hand, hair är hår och heart är hjärta.'),
            val("Vad betyder 'feet'?", ['fötter', 'fot', 'tår'], 'fötter',
                'Feet betyder fötter. En fot heter foot, och flera fötter heter feet, inte foots.'),
            skriv("Skriv 'syster' på engelska.", 'sister',
                  'Syster heter sister. Orden låter nästan likadant, men på engelska stavas det med i.'),
            skriv("Skriv 'näsa' på engelska.", 'nose',
                  'Näsa heter nose. E:et på slutet hörs inte, men det ska vara med.'),
            skriv("Skriv 'öga' på engelska.", 'eye',
                  'Öga heter eye. Två ögon heter eyes.'),
            ordna('Bygg meningen: Min mamma har långt hår.', ['My', 'mother', 'has', 'long', 'hair.'],
                  forklaring='Efter he, she och my mother säger man has, inte have. '
                             'Long står före hair, precis som långt står före hår.'),
        ], beskrivning='Ord för familjen och delar av kroppen.'),

        niva('en-ak4-ordforrad-4', 'Mat och dryck', 'Ordförråd', [
            para('Para ihop det engelska ordet med det svenska.',
                 [('bread', 'bröd'), ('cheese', 'ost'), ('milk', 'mjölk'),
                  ('carrot', 'morot'), ('strawberry', 'jordgubbe')],
                 'Bread är bröd, cheese är ost, milk är mjölk, carrot är morot och strawberry är jordgubbe.'),
            sant("'Potato' betyder tomat.", False,
                 'Potato betyder potatis. Tomat heter tomato. Orden liknar varandra och är lätta att blanda ihop.'),
            sant("'Ice cream' betyder glass.", True,
                 'Ice cream är glass. Ice betyder is och cream betyder grädde.'),
            val("Vad heter 'smör' på engelska?", ['butter', 'bread', 'bottle'], 'butter',
                'Smör heter butter. Bread är bröd och bottle är flaska.'),
            val("Vad betyder 'breakfast'?", ['frukost', 'lunch', 'middag', 'mellanmål'], 'frukost',
                'Breakfast är frukost, dagens första mål. Middag heter dinner på engelska.'),
            skriv("Skriv 'ägg' på engelska.", ['egg', 'eggs', 'an egg'],
                  'Ägg heter egg, och flera ägg heter eggs.'),
            val('Vilket ord är en frukt?', ['pear', 'pen', 'pig', 'park'], 'pear',
                'Pear betyder päron. Pen är penna, pig är gris och park är park.'),
            ordna('Bygg meningen: Jag äter en smörgås till frukost.',
                  ['I', 'eat', 'a', 'sandwich', 'for', 'breakfast.'],
                  forklaring='Till frukost heter for breakfast, och det står sist, precis som på svenska.'),
        ], beskrivning='Ord för mat och dryck, att para ihop och använda i en mening.'),

        niva('en-ak4-verb-1', 'I am, he is, they are', 'Verb', [
            val('Välj rätt ord: I ___ ten years old.', ['am', 'is', 'are'], 'am',
                'Till I hör am: I am. Is och are passar inte ihop med I.'),
            val('Välj rätt ord: She ___ my friend.', ['am', 'is', 'are'], 'is',
                'She betyder hon. Efter he, she och it kommer is.'),
            val('Välj rätt ord: They ___ in the garden.', ['am', 'is', 'are'], 'are',
                'They betyder de. Efter we, you och they kommer are.'),
            val('Välj rätt ord: My cat ___ black.', ['am', 'is', 'are'], 'is',
                'My cat är ett djur, som man kan byta mot it. Efter it kommer is.'),
            skriv('Skriv am, is eller are: We ___ friends.', 'are',
                  'We betyder vi, och det är flera personer. Efter we kommer are.'),
            ordna('Bygg meningen: Jag är elva år gammal.', ['I', 'am', 'eleven', 'years', 'old.'],
                  forklaring='På engelska säger man I am eleven years old, med am direkt efter I.'),
            ordna('Bygg meningen: De är mina vänner.', ['They', 'are', 'my', 'friends.'], extra=['is'],
                  forklaring='They betyder de. Efter they kommer are, inte is.'),
            ordna('Bygg frågan: Är du glad?', ['Are', 'you', 'happy?'],
                  forklaring='I en fråga kommer are först, före you: Are you happy?'),
        ], beskrivning='Verbet be i presens: am, is och are i enkla meningar.'),
    ]),

    bana('Engelska', 'ak6', [
        niva('en-ak6-substantiv-1', 'Child, children', 'Substantiv', [
            val("Vad är plural av 'child'?", ['childs', 'children', 'childrens'], 'children',
                'Child är oregelbundet och får -ren i plural: one child, two children.'),
            val("Vad är plural av 'mouse'?", ['mouses', 'mice', 'mices'], 'mice',
                'Mouse byter form i plural: one mouse, two mice.'),
            val("Vad är plural av 'knife'?", ['knifes', 'knives', 'knive'], 'knives',
                'Många ord som slutar på -f eller -fe får -ves i plural: knife – knives, wolf – wolves.'),
            val("Vad är plural av 'sheep'?", ['sheep', 'sheeps', 'sheepes'], 'sheep',
                'Sheep ser likadant ut i plural: one sheep, ten sheep. Så är det också med deer (hjort).'),
            skriv("Skriv plural av 'foot'.", 'feet',
                  'Foot blir feet. Vokalen ändras i stället för att ordet får -s.'),
            skriv("Skriv plural av 'tooth'.", 'teeth',
                  'Tooth blir teeth, på samma sätt som foot blir feet.'),
            skriv("Skriv plural av 'woman'.", 'women',
                  'Woman blir women, precis som man blir men.'),
            ordna('Bygg meningen: Tre män har stora fötter.', ['Three', 'men', 'have', 'big', 'feet.'],
                  extra=['has'],
                  forklaring='Men är plural av man, och när det är flera blir det have, inte has.'),
        ], beskrivning='Substantiv som inte får -s i plural.'),

        # Inte bus: buses är vanligast, men busses står också i ordböckerna.
        niva('en-ak6-substantiv-2', 'Foxes, babies, leaves', 'Substantiv', [
            para('Para ihop ordet med hur det får plural.',
                 [('fox', 'får -es'), ('baby', 'y blir -ies'), ('boy', 'får bara -s'),
                  ('wolf', 'f blir -ves')],
                 'Fox slutar på -x och får -es: foxes. Baby har en konsonant före y: babies. '
                 'Boy har en vokal före y och får bara -s: boys. Wolf blir wolves.'),
            sant("Plural av 'baby' är 'babys'.", False,
                 'Baby slutar på en konsonant och y. Då blir y till i, och ordet får -es: babies.'),
            sant("Plural av 'key' är 'keys'.", True,
                 'Före y står en vokal, e. Då behålls y och ordet får bara -s: keys.'),
            val("Vad är plural av 'dish'?", ['dishs', 'dishes', 'dishies'], 'dishes',
                'Slutar ordet på -sh, som dish, får det -es i plural. Annars blir det svårt att uttala: dishes.'),
            val("Vad är plural av 'story'?", ['storys', 'stories', 'storyes'], 'stories',
                'Story slutar på en konsonant och y. Då blir y till i, och ordet får -es: stories.'),
            skriv("Skriv plural av 'glass'.", 'glasses',
                  'Glass slutar på -s. Då får det -es i plural: glasses.'),
            skriv("Skriv plural av 'leaf'.", 'leaves',
                  'I leaf blir f till -ves i plural: leaves, som i wolf och wolves. Men inte i alla ord '
                  'på -f: roof blir roofs.'),
            ordna('Bygg meningen: Min syster har två ponnyer.',
                  ['My', 'sister', 'has', 'two', 'ponies.'], extra=['ponys.'],
                  forklaring='Pony slutar på en konsonant och y, så det blir ponies. '
                             'My sister kan bytas mot she, och då heter det has.'),
        ], beskrivning='Stavningen i plural: när ordet får -s, -es, -ies eller -ves.'),

        niva('en-ak6-verb-1', 'She plays, he goes', 'Verb', [
            val('Välj rätt form: She ___ football every Saturday.', ['play', 'plays', 'playing'], 'plays',
                'Efter he, she och it får verbet ett -s i presens: she plays.'),
            val('Välj rätt form: My friends ___ in Stockholm.', ['live', 'lives', 'living'], 'live',
                'My friends är flera, som they. Då får verbet inget -s: they live.'),
            val('Vilken mening är rätt?', ["He don't like fish.", "He doesn't like fish.", 'He not like fish.'],
                "He doesn't like fish.",
                "Med he, she och it blir nekandet doesn't. Verbet efter, like, får då inget -s."),
            val('Välj rätt ord: ___ your sister speak English?', ['Do', 'Does', 'Is'], 'Does',
                'Your sister kan bytas mot she. När det finns ett annat verb, här speak, '
                'börjar frågan med does: Does she speak …?'),
            skriv("Skriv 'go' i presens: He ___ to school by bus.", 'goes',
                  'Verb som slutar på -o får -es efter he, she och it: go blir goes, do blir does.'),
            skriv("Skriv 'watch' i presens: My dad ___ the news every evening.", 'watches',
                  'Verb som slutar på -ch, -sh, -s eller -x får -es: watch blir watches.'),
            skriv("Skriv 'have' i presens: She ___ a new bike.", ['has', 'has got'],
                  'Have är oregelbundet: I have, men he, she och it has. '
                  'I brittisk engelska säger man också she has got, och det är lika rätt.'),
            # Inte gitarr: "plays the guitar" och "plays guitar" är båda rätt,
            # och brickorna jämförs exakt. Tennis har ingen artikel alls.
            ordna('Bygg meningen: Min bror spelar tennis varje dag.',
                  ['My', 'brother', 'plays', 'tennis', 'every', 'day.'], extra=['play'],
                  forklaring='My brother kan bytas mot he, och då får verbet -s: plays. '
                             'Every day står sist.'),
        ], beskrivning='Presens med -s efter he, she och it, och frågor och nekanden med does.'),

        niva('en-ak6-verb-2', 'Played, walked, stopped', 'Verb', [
            val('Välj rätt form: Yesterday I ___ football.', ['play', 'played', 'plays'], 'played',
                'Yesterday betyder igår. Det som redan hänt skrivs i preteritum, '
                'och regelbundna verb får -ed: played.'),
            val("Hur stavas 'study' i preteritum?", ['studyed', 'studied', 'studid'], 'studied',
                'Slutar verbet på en konsonant och y byts y mot i före -ed: study blir studied.'),
            val("Hur stavas 'like' i preteritum?", ['likeed', 'liked', 'likked'], 'liked',
                'Slutar verbet redan på -e lägger man bara till -d: like blir liked.'),
            val('Vilken mening handlar om något som redan har hänt?',
                ['I watch TV every day.', 'I watched TV yesterday.', 'I am watching TV now.'],
                'I watched TV yesterday.',
                'Watched har -ed och står i preteritum, och yesterday betyder igår.'),
            skriv("Skriv 'walk' i preteritum: We ___ to the park last Sunday.", 'walked',
                  'Regelbundna verb får -ed i preteritum: walk blir walked.'),
            skriv("Skriv 'stop' i preteritum: The bus ___ outside our school.", 'stopped',
                  'Korta verb som slutar på en enda vokal och en konsonant dubblar konsonanten: '
                  'stop blir stopped. Rain har två vokaler före n och blir bara rained.'),
            skriv("Skriv 'enjoy' i preteritum: We ___ the film.", 'enjoyed',
                  'Står det en vokal före y behålls y: enjoy blir enjoyed. '
                  'Jämför study – studied, där det står en konsonant före y.'),
            ordna('Bygg meningen: Hon hjälpte sin mamma igår.',
                  ['She', 'helped', 'her', 'mother', 'yesterday.'], extra=['helps'],
                  forklaring='Helped är preteritum av help, eftersom det hände igår. '
                             'Her betyder hennes eller sin när det gäller en kvinna eller flicka.'),
        ], beskrivning='Preteritum med -ed och hur stavningen ändras före ändelsen.'),

        niva('en-ak6-fragor-1', 'What, where, who?', 'Frågeord', [
            val("Vilket frågeord betyder 'var'?", ['where', 'when', 'what', 'who'], 'where',
                'Where betyder var och when betyder när. De två blandas lätt ihop.'),
            val('Vilket frågeord passar? ___ is your birthday? – In May.', ['Where', 'When', 'Who'], 'When',
                'Svaret är en tid, i maj. Då frågar man med when, som betyder när.'),
            val('Vilket frågeord passar? ___ is your teacher? – Anna.', ['Who', 'What', 'Where'], 'Who',
                'Svaret är en person. Då frågar man med who, som betyder vem.'),
            val('Vilket frågeord passar? ___ do you live? – In Farsta.', ['Where', 'When', 'Why'], 'Where',
                'Svaret är en plats. Då frågar man med where, som betyder var.'),
            skriv("Skriv frågeordet som betyder 'varför'.", 'why',
                  'Varför heter why. Svaret börjar ofta med because, som betyder eftersom.'),
            skriv("Skriv frågeordet som fattas: ___ old are you? – I'm twelve.", 'how',
                  'How betyder hur, och how old betyder hur gammal.'),
            ordna('Bygg frågan: Vad heter du?', ['What', 'is', 'your', 'name?'],
                  forklaring='På engelska frågar man vad ditt namn är: What is your name?'),
            ordna('Bygg frågan: Var bor din kusin?', ['Where', 'does', 'your', 'cousin', 'live?'],
                  extra=['lives?'],
                  forklaring='Frågor i presens om en annan person byggs med does, '
                             'och då får verbet inget -s: Where does your cousin live?'),
        ], beskrivning='Frågeorden what, where, when, who, why och how, och hur en fråga byggs.'),

        niva('en-ak6-lasforstaelse-1', 'A letter from Sam', 'Läsförståelse', [
            skriv('Vad heter Sams hund? Skriv namnet.', 'Biscuit',
                  'Sam skriver att familjen har en gammal hund som heter Biscuit.'),
            sant('Sam går till skolan med sin lillebror.', False,
                 'Sam skriver I walk there with my best friend Ava. Det är Ava, bästa kompisen, '
                 'som Sam går med. Lillebror heter Max.'),
            sant('Biscuit är tio år gammal.', True,
                 'Det står He is ten years old. Ten betyder tio.'),
            val('Varför är science (NO) Sams favoritämne?',
                ['För att de gör experiment', 'För att läraren är rolig',
                 'För att Ava också tycker om det', 'För att det är lätt'],
                'För att de gör experiment',
                'Sam skriver because we do experiments. Det är matteläraren som är rolig, '
                'inte läraren i science.'),
            val('Vad gör Sam på lördagar?',
                ['Spelar fotboll', 'Hälsar på sin mormor eller farmor', 'Bakar äppelpaj',
                 'Gör experiment i skolan'],
                'Spelar fotboll',
                'Det står On Saturdays I play football. Det är på söndagar, on Sundays, som '
                'familjen hälsar på grandma.'),
            val('Varför går Biscuit långsamt nu?',
                ['Han är gammal', 'Han är rädd för vatten', 'Han har ont i en tass',
                 'Han är ny i familjen'],
                'Han är gammal',
                'Det står He is ten years old, so he walks slowly now. So betyder så, och visar '
                'att det är därför han går långsamt.'),
            val('Vad vill Sam veta om Elin?',
                ['Om hon har några husdjur', 'Hur gammal hon är', 'Vilken skola hon går i',
                 'Vad hennes mamma heter'],
                'Om hon har några husdjur',
                'Sam frågar Do you have any pets? Pets betyder husdjur. Sam frågar också vad Elin '
                'gör på fritiden.'),
            val('Varför skriver Sam brevet?',
                ['För att svara på Elins brev och berätta om sig själv',
                 'För att bjuda Elin på en fotbollsmatch',
                 'För att fråga om läxan',
                 'För att berätta om en resa'],
                'För att svara på Elins brev och berätta om sig själv',
                'Brevet börjar med Thank you for your letter! Sam svarar alltså på ett brev, och '
                'berättar om familjen, skolan och fritiden.'),
        ], beskrivning='Ett brev på enkel engelska från en brevvän, med frågor om vad som står och '
                       'varför Sam skriver.',
            text=BREVET),
    ]),

    bana('Engelska', 'ak8', [
        niva('en-ak8-verb-1', 'Go, went, gone', 'Verb', [
            val("What is the past tense of 'go'?", ['goed', 'went', 'gone'], 'went',
                'Go är oregelbundet: go – went – gone. Went är preteritum, '
                'och gone används efter have och has.'),
            val('Choose the right form: I have ___ my homework.', ['did', 'done', 'doed'], 'done',
                'Efter have står tredje formen, perfekt particip: do – did – done.'),
            val('Which verb is irregular?', ['walk', 'take', 'jump', 'open'], 'take',
                'Take är oregelbundet: take – took – taken. '
                'De andra får bara -ed: walked, jumped, opened.'),
            val('Which sentence is correct?', ['She has went home.', 'She has gone home.', 'She has go home.'],
                'She has gone home.',
                'Efter has och have står tredje formen: gone. Went står ensamt: she went home.'),
            skriv("Write the past tense of 'see': Yesterday I ___ a fox in the garden.", 'saw',
                  'See är oregelbundet: see – saw – seen.'),
            skriv("Write the past tense of 'buy': Last week she ___ new shoes.", 'bought',
                  'Buy – bought – bought. Samma mönster finns i think – thought och bring – brought.'),
            skriv("Write the past tense of 'write': He ___ a letter to his grandmother.", 'wrote',
                  'Write är oregelbundet: write – wrote – written.'),
            ordna('Build the sentence: Vi åt pizza efter matchen.',
                  ['We', 'ate', 'pizza', 'after', 'the', 'match.'], extra=['eated'],
                  forklaring='Eat är oregelbundet: eat – ate – eaten. Formen eated finns inte.'),
        ], beskrivning='Vanliga oregelbundna verb i preteritum och perfekt particip.'),

        niva('en-ak8-verb-2', 'Went eller have gone?', 'Verb', [
            val('Choose the right form: I ___ in Stockholm since 2020.', ['live', 'lived', 'have lived'],
                'have lived',
                'Since visar att något började vid en tidpunkt och pågår fortfarande. '
                'Då används present perfect: have lived.'),
            val('Choose the right form: We ___ to London last summer.', ['went', 'have gone', 'have been going'],
                'went',
                'Last summer är en tid som är över. Då används past simple: went.'),
            val('Which question is correct?',
                ['Have you ever eaten sushi?', 'Did you ever ate sushi?', 'Have you ever ate sushi?'],
                'Have you ever eaten sushi?',
                'Ever betyder någonsin, och frågan gäller hela livet fram till nu. Då används '
                'present perfect: have + eaten. Efter did står grundformen, aldrig ate.'),
            val('Which sentence is correct?',
                ['I have seen that film yesterday.', 'I saw that film yesterday.', 'I have saw that film yesterday.'],
                'I saw that film yesterday.',
                'Med yesterday används past simple. Present perfect går inte ihop med en '
                'tidpunkt som redan är över.'),
            skriv('Write has or have: My parents ___ never been to Italy.', 'have',
                  'My parents är flera, som they. Då blir det have, inte has.'),
            skriv("Write the past simple of 'be': I ___ at home yesterday.", 'was',
                  'Yesterday är en tid som är över, så det blir past simple. '
                  'Be blir was efter I, he, she och it.'),
            skriv("Write the right form of 'know': I have ___ her since we were six.", 'known',
                  'Efter have står tredje formen: know – knew – known.'),
            ordna('Build the question: Har du någonsin varit i Paris?',
                  ['Have', 'you', 'ever', 'been', 'to', 'Paris?'], extra=['was'],
                  forklaring='I frågan kommer have först och sedan you. Ever står före been, '
                             'och been to betyder varit i.'),
        ], beskrivning='När det heter past simple och när det heter present perfect.'),

        # Bara verb med en enda form i skolengelskan. Inte get (got eller
        # gotten), learn (learnt eller learned) eller prove (proved eller
        # proven): där är båda rätt.
        niva('en-ak8-verb-3', 'Begin, began, begun', 'Verb', [
            para('Match the verb with its past tense.',
                 [('fly', 'flew'), ('catch', 'caught'), ('choose', 'chose'), ('feel', 'felt'),
                  ('leave', 'left')],
                 'De här verben är oregelbundna och får inte -ed. Formerna får man lära sig utantill: '
                 'fly – flew, catch – caught, choose – chose, feel – felt och leave – left.'),
            para('Match the past tense with the past participle.',
                 [('began', 'begun'), ('broke', 'broken'), ('drove', 'driven'), ('spoke', 'spoken')],
                 'Preteritum står ensamt: she began. Perfekt particip står efter have och has: she has '
                 'begun. Begin – began – begun, break – broke – broken, drive – drove – driven, '
                 'speak – spoke – spoken.'),
            sant("'Teached' is the past tense of 'teach'.", False,
                 'Teach är oregelbundet: teach – taught – taught. Formen teached finns inte.'),
            sant("The past participle of 'swim' is 'swum'.", True,
                 'Swim – swam – swum. Swam står ensamt, och swum står efter have och has: I have swum.'),
            val('Choose the right form: She has ___ three glasses of water today.',
                ['drank', 'drunk', 'drinked'], 'drunk',
                'Efter has står perfekt particip: drink – drank – drunk. Drank står ensamt: she drank.'),
            skriv("Write the past tense of 'sell': Last year my uncle ___ his old car.", 'sold',
                  'Sell – sold – sold. Samma mönster finns i tell – told – told.'),
            skriv("Write the past participle of 'forget': I have ___ my password again.", 'forgotten',
                  'Forget – forgot – forgotten. Efter have står den tredje formen. Forgot är '
                  'preteritum: I forgot my password.'),
            ordna('Build the sentence: Vi har sjungit den här sången förut.',
                  ['We', 'have', 'sung', 'this', 'song', 'before.'], extra=['sang'],
                  forklaring='Efter have står perfekt particip: sing – sang – sung. Sang står ensamt: we sang.'),
        ], beskrivning='Fler oregelbundna verb, att para ihop och använda i preteritum och perfekt particip.'),

        niva('en-ak8-adjektiv-1', 'Bigger, better, best', 'Adjektiv', [
            val("What is the comparative of 'big'?", ['biger', 'bigger', 'more big'], 'bigger',
                'Korta adjektiv som slutar på en enda vokal och en konsonant dubblar konsonanten: '
                'big – bigger – biggest.'),
            val('Choose the right form: This book is ___ than the film.',
                ['more interesting', 'interestinger', 'most interesting'], 'more interesting',
                'Långa adjektiv jämförs med more och most. Det är två saker som jämförs, '
                'så det blir more: more interesting than.'),
            val('Choose the right form: Elin is the ___ runner in our class.', ['fast', 'faster', 'fastest'],
                'fastest',
                'När man jämför med alla i en grupp används superlativ, med the före: the fastest.'),
            val('Which sentence is correct?',
                ['Stockholm is bigger than Uppsala.', 'Stockholm is more bigger than Uppsala.',
                 'Stockholm is bigger that Uppsala.'],
                'Stockholm is bigger than Uppsala.',
                'Man jämför med than, och bigger har redan -er, så more ska inte stå framför.'),
            skriv("Write the superlative of 'good': This is the ___ pizza in town.", 'best',
                  'Good är oregelbundet: good – better – best.'),
            skriv("Write the comparative of 'bad': My cold is ___ today than yesterday.", 'worse',
                  'Bad är oregelbundet: bad – worse – worst.'),
            skriv("Write the comparative of 'many': There are ___ students in my class than in yours.", 'more',
                  'Many är oregelbundet: many – more – most.'),
            ordna('Build the sentence: Min syster är äldre än jag.',
                  ['My', 'sister', 'is', 'older', 'than', 'me.'], extra=['more'],
                  forklaring='Old är ett kort adjektiv och får -er: older. Efter older kommer than.'),
        ], beskrivning='Komparativ och superlativ med -er och -est, med more och most, och de oregelbundna.'),

        niva('en-ak8-prepositioner-1', 'In, on eller at?', 'Prepositioner', [
            val("Choose the right word: The film starts ___ seven o'clock.", ['in', 'on', 'at'], 'at',
                "Före ett klockslag står at: at seven o'clock."),
            val('Choose the right word: My birthday is ___ June.', ['in', 'on', 'at'], 'in',
                'Före månader, årstider och år står in: in June.'),
            val('Choose the right word: I was born ___ 2012.', ['in', 'on', 'at'], 'in',
                'Före ett årtal står in: in 2012.'),
            val('Choose the right word: They live ___ Stockholm.', ['in', 'on', 'at'], 'in',
                'Före städer och länder står in: in Stockholm.'),
            skriv('Write in, on or at: We have football practice ___ Tuesdays.', 'on',
                  'Före veckodagar står on: on Tuesdays.'),
            skriv('Write in, on or at: Your keys are ___ the table.', 'on',
                  'Något som ligger ovanpå en yta är on: on the table.'),
            ordna('Build the sentence: Vi spelar alltid fotboll på lördagar.',
                  ['We', 'always', 'play', 'football', 'on', 'Saturdays.'],
                  forklaring='Always står före verbet på engelska: we always play. '
                             'Före veckodagar står on.'),
            ordna('Build the question: Vad gör du på söndagar?',
                  ['What', 'do', 'you', 'do', 'on', 'Sundays?'],
                  forklaring='Frågor i presens byggs med do före you. '
                             'Det andra do är verbet göra, och före veckodagar står on.'),
        ], beskrivning='In, on och at för tid och plats, och ordföljden kring dem.'),

        niva('en-ak8-lasforstaelse-1', 'The last bus', 'Läsförståelse', [
            sant("Maya was supposed to leave the party at ten o'clock.", True,
                 'Det står att hennes mamma hade sagt åt henne att gå från festen klockan tio, '
                 'at ten.'),
            sant("Maya's phone died before she could send a message.", False,
                 'Hon hann skicka ett meddelande till sin mamma: Missed the bus. Walking home. '
                 'Först sedan blev skärmen svart.'),
            skriv('How many minutes would the shortcut through the park save? Write the number.',
                  ['15', 'fifteen', 'fifteen minutes', 'femton', 'femton minuter'],
                  'Det står att genvägen genom parken skulle spara fifteen minutes, femton minuter. '
                  'Forty minutes, fyrtio, var hela vägen hem.'),
            val('Why did Maya walk along the main road?',
                ['She had promised not to take the shortcut after dark',
                 'The main road was the shortest way home',
                 'Her mum had told her to wait by the road',
                 'The park was closed at night'],
                'She had promised not to take the shortcut after dark',
                'Det står att hon hade lovat att aldrig gå genvägen genom parken när det var mörkt. '
                'Vägen längs main road var längre.'),
            val("What does 'lecture' mean in this text?",
                ['A long talk about what she had done wrong', 'A lesson at a university',
                 'A story about the party', 'A phone call from her mum'],
                'A long talk about what she had done wrong',
                'Lecture kan betyda föreläsning, men här väntar Maya på att mamma ska prata länge '
                'om vad hon gjort fel: att vara ansvarsfull, ladda mobilen och komma i tid.'),
            val("Why did Maya's mum drive through the park first?",
                ['She was afraid that Maya had taken the shortcut',
                 'She thought the main road was closed',
                 'She was going to pick up a friend there',
                 'She had forgotten the way home'],
                'She was afraid that Maya had taken the shortcut',
                'Genvägen gick genom parken. Mamma letade där först, för hon var rädd att Maya hade '
                'gått den vägen i mörkret.'),
            val("Why was Maya's mum still wearing her slippers?",
                ['She had left home in a hurry to find Maya',
                 'She always drives in her slippers',
                 'Her shoes were at the party',
                 'She had just come home from work'],
                'She had left home in a hurry to find Maya',
                'Maya förstår att mamma inte tog sig tid att byta till skor. Hon var orolig och gav '
                'sig i väg direkt.'),
            val('How does Maya feel at the end of the story?',
                ['She is truly sorry', 'She is angry with her mum', 'She is bored', 'She is still scared'],
                'She is truly sorry',
                'Hon ser tofflorna och förstår hur orolig mamma har varit. Därför säger hon förlåt, '
                'och den här gången menar hon det verkligen.'),
        ], beskrivning='En berättelse på engelska om en kväll då Maya missar sista bussen, med frågor om '
                       'vad som står och vad man kan förstå mellan raderna.',
            text=SISTA_BUSSEN),
    ]),
]
