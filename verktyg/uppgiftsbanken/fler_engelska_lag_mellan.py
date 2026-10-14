# -*- coding: utf-8 -*-
"""Fler engelskanivåer för åk 1 till 5 (2026-10-14), nya områden i banorna som
redan finns i engelska_lag.py, engelska_mer.py, engelska.py och
blad_engelska.py. Allt är skrivet med AI och inte läst av en lärare.

TILLAGG läggs sist i banorna. Områdena är nya, så de står efter de gamla:
- åk 1: Lek och mat (leksaker och fordon, former, mat), tre nivåer.
- åk 2: Plats och fritid (platser, kommandon, sport och hobbyer), tre nivåer.
- åk 3: Ett eller flera (plural med -s, a och an) och I affären (att
  be om något, att fråga vad det kostar).
- åk 4: Var finns det? (in, on, under, there is och there are) och Klockan
  och dagen (hela och halva timmar, kvart över och kvart i, och en lästext).
- åk 5: Adjektiv (motsatser, jämförelse och superlativ) och Igår och i
  helgen (preteritum med -ed, och en lästext).

Samma regler som i engelska_lag.py, engelska_mer.py och engelska.py:
- Instruktionerna är på svenska och exempelmeningarna på engelska, i brittisk
  stavning (colour, grey, pounds, a quarter to). Förklaringarna är på svenska.
- Åk 1 och 2 har mest para, val och sant. Ordna har tre till fem brickor och
  skriv används bara för korta ord med en enda stavning (ball, jump, school).
- En ordna-fråga har bara en rätt ordning. Ingen mening har två likadana
  brickor (the och the, is och is), för då finns det två rätta ordningar.
- Ett klockslag frågas som val eller para, aldrig som skriv: ett svar som
  7.30 rättas som ett tal.
- Lästexterna är påhittade, med påhittade personer, och varje fråga går att
  besvara ur texten ensam. Ett område med en nivå med lästext får inget
  Mästarprov, för provet visar ingen text.
"""
from grund import bana, niva, val, skriv, ordna, sant, para, tal

# Talen på engelska, med talet som plats i listan.
ORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
       'eleven', 'twelve']


def tid(timme, minut):
    """Ett klockslag som (engelska, siffror): tid(8, 30) → ('half past eight', '8.30'),
    tid(5, 45) → ('a quarter to six', '5.45'). Klockan på 12-timmarsvis."""
    assert 1 <= timme <= 12 and minut in (0, 15, 30, 45)
    siffror = '%d.%02d' % (timme, minut)
    if minut == 0:
        return ORD[timme] + " o'clock", siffror
    if minut == 15:
        return 'a quarter past ' + ORD[timme], siffror
    if minut == 30:
        return 'half past ' + ORD[timme], siffror
    return 'a quarter to ' + ORD[timme % 12 + 1], siffror


# ---- Åk 4: klockan och dagen ----------------------------------------------

# Allt som Sam gör står i texten med klockslag som tid() ger.
UPP = tid(8, 30)
FOTBOLL = tid(10, 0)
LUNCH = tid(12, 0)
AFFAREN = tid(4, 0)
NORAS_SOVTID = tid(8, 0)
SAMS_SOVTID = tid(9, 0)
FOTBOLLSTIMMAR = 2
# Fotbollen börjar klockan tio och pågår två timmar, så den slutar när lunchen börjar.
FOTBOLLEN_SLUT = tid(10 + FOTBOLLSTIMMAR, 0)
assert FOTBOLLEN_SLUT == LUNCH  # annars stämmer inte texten

SAMS_LORDAG = '\n\n'.join([
    'My name is Sam. On Saturdays I get up at %s. I have breakfast with my little sister, Nora. '
    'We eat bread with cheese and drink milk.' % UPP[0],
    "At %s I play football in the park with my friend Ali. We play for %s hours. Then we go "
    "home and have lunch at %s." % (FOTBOLL[0], ORD[FOTBOLLSTIMMAR], LUNCH[0]),
    'After lunch I read a book, and Nora draws pictures. At %s we go to the shop with Dad and '
    'buy fruit.' % AFFAREN[0],
    'In the evening we watch a film. Nora goes to bed at %s because she is only five. I go to '
    'bed at %s.' % (NORAS_SOVTID[0], SAMS_SOVTID[0]),
])

# ---- Åk 5: en helg med kusinen ---------------------------------------------

TARIQ = '\n\n'.join([
    'Last weekend my cousin Tariq stayed at our house. He arrived on Friday evening, and we '
    'talked until midnight about our summer.',
    'On Saturday morning we cooked pancakes for the whole family. I mixed the eggs and the flour, '
    'and Tariq cooked them. He dropped the first pancake on the floor, and our dog Bella ate it!',
    'In the afternoon we walked to the lake and played football on the beach. Later we watched a '
    'film and laughed a lot.',
    'On Sunday it rained, so we stayed inside and made a big castle out of boxes. When Tariq went '
    'home, I was a little sad. We promised to meet again in the holidays.',
])

TILLAGG = [
    # ================================================================ Åk 1
    bana('Engelska', 'ak1', [
        niva('en-ak1-fler-lek-1', 'Ball and doll', 'Lek och mat', [
            para('Para ihop leksakerna.',
                 [('ball', 'boll'), ('doll', 'docka'), ('car', 'bil'), ('kite', 'drake')],
                 'Ball är boll och doll är docka. Car är bil och kite är drake.'),
            val("Vad betyder 'teddy bear'?", ['nalle', 'docka', 'boll'], 'nalle',
                'Teddy bear är en nalle, en mjuk leksaksbjörn. Docka heter doll och boll heter ball.'),
            sant("'Bus' betyder bil.", False,
                 'Bus betyder buss, och orden låter nästan likadant. Bil heter car.'),
            para('Para ihop fordonen.',
                 [('bus', 'buss'), ('train', 'tåg'), ('boat', 'båt'), ('plane', 'flygplan')],
                 'Bus är buss och train är tåg. Boat är båt och plane är flygplan.'),
            skriv("Skriv 'boll' på engelska.", ['ball', 'a ball'],
                  'Boll heter ball, med två l på slutet.'),
            ordna('Bygg meningen: Jag har en bil.', ['I', 'have', 'a', 'car.'],
                  forklaring='Jag har heter I have, och en bil heter a car.'),
            val('Du ska sparka på något. Vilken leksak väljer du?', ['ball', 'doll', 'kite'], 'ball',
                'Du sparkar på en ball, alltså en boll. Doll är docka och kite är drake.'),
            sant("'Doll' betyder docka.", True,
                 'Doll betyder docka, en leksak som ser ut som en liten människa.'),
        ], beskrivning='Leksaker och fordon på engelska: ball, doll, car, bus och fler.'),

        niva('en-ak1-fler-lek-2', 'Circle and square', 'Lek och mat', [
            para('Para ihop formerna.',
                 [('circle', 'cirkel'), ('square', 'kvadrat'), ('triangle', 'triangel'),
                  ('star', 'stjärna')],
                 'Circle är cirkel och square är kvadrat. Triangle är triangel och star är stjärna.'),
            val("Vad betyder 'heart'?", ['hjärta', 'huvud', 'hand'], 'hjärta',
                'Heart betyder hjärta. Huvud heter head och hand heter hand.'),
            sant("'Triangle' betyder triangel.", True,
                 'Triangle betyder triangel, och orden liknar varandra.'),
            para('Vad kan du rita? Para ihop.',
                 [('sun', 'sol'), ('moon', 'måne'), ('rectangle', 'rektangel'), ('flower', 'blomma')],
                 'Sun är sol och moon är måne. Rectangle är rektangel och flower är blomma.'),
            skriv("Skriv 'hjärta' på engelska.", ['heart', 'a heart'],
                  'Hjärta heter heart. Det stavas h-e-a-r-t.'),
            ordna('Bygg meningen: Det här är en cirkel.', ['This', 'is', 'a', 'circle.'],
                  forklaring='Det här är heter this is, och en cirkel heter a circle.'),
            val('Välj rätt ord: A triangle has ___ corners. (En triangel har ... hörn.)',
                ['three', 'four', 'five'], 'three',
                'En triangel har tre hörn, och tre heter three. Four är fyra och five är fem.'),
            sant("'Square' betyder cirkel.", False,
                 'Square betyder kvadrat. Cirkel heter circle.'),
        ], beskrivning='Former på engelska: circle, square, triangle, star och heart.'),

        niva('en-ak1-fler-lek-3', 'Cake and milk', 'Lek och mat', [
            para('Vilken mat är vilken? Para ihop.',
                 [('egg', 'ägg'), ('cheese', 'ost'), ('ice cream', 'glass'), ('cake', 'kaka')],
                 'Egg är ägg och cheese är ost. Ice cream är glass och cake är kaka.'),
            val("Vad betyder 'milk'?", ['mjölk', 'vatten', 'ost'], 'mjölk',
                'Milk betyder mjölk. Vatten heter water och ost heter cheese.'),
            sant("'Bread' betyder bröd.", True,
                 'Bread betyder bröd. Man kan äta det med ost eller smör.'),
            para('Vad heter det på engelska? Para ihop.',
                 [('water', 'vatten'), ('apple', 'äpple'), ('banana', 'banan'),
                  ('sandwich', 'smörgås')],
                 'Water är vatten och apple är äpple. Banana är banan och sandwich är smörgås.'),
            skriv("Skriv ordet 'ägg' på engelska.", ['egg', 'an egg'],
                  'Ägg heter egg. Det stavas e-g-g.'),
            ordna('Bygg meningen: Jag tycker om glass.', ['I', 'like', 'ice', 'cream.'],
                  forklaring='Jag tycker om heter I like. Glass heter ice cream, och det är två ord.'),
            val("Vad betyder 'rice'?", ['ris', 'is', 'ros'], 'ris',
                'Rice betyder ris. Is heter ice och ros heter rose.'),
            sant("'Water' betyder mjölk.", False,
                 'Water betyder vatten. Mjölk heter milk.'),
        ], beskrivning='Mat och dryck på engelska: egg, cheese, cake, milk och water.'),
    ]),

    # ================================================================ Åk 2
    bana('Engelska', 'ak2', [
        niva('en-ak2-fler-plats-1', 'School, home, park', 'Plats och fritid', [
            para('Para ihop platserna.',
                 [('school', 'skola'), ('shop', 'affär'), ('beach', 'strand'),
                  ('library', 'bibliotek')],
                 'School är skola och shop är affär. Beach är strand och library är bibliotek.'),
            val("Vad betyder 'zoo'?", ['djurpark', 'torg', 'skog'], 'djurpark',
                'Zoo betyder djurpark, en plats där man ser många djur.'),
            sant("'Home' betyder hem.", True,
                 'Home betyder hem, platsen där du bor. House betyder hus.'),
            skriv("Skriv 'skola' på engelska.", 'school',
                  'Skola heter school. Ch i mitten låter som ett k.'),
            ordna('Bygg meningen: Jag är i parken.', ['I', 'am', 'in', 'the', 'park.'],
                  forklaring='Jag är heter I am, och i parken heter in the park.'),
            val('Välj rätt plats: I go to the ___ to buy milk. (Jag går till ... för att köpa mjölk.)',
                ['shop', 'zoo', 'beach'], 'shop',
                'Mjölk köper man i en shop, alltså en affär. Zoo är djurpark och beach är strand.'),
            para('Vad heter det? Para ihop.',
                 [('house', 'hus'), ('garden', 'trädgård'), ('street', 'gata'),
                  ('farm', 'bondgård')],
                 'House är hus och garden är trädgård. Street är gata och farm är bondgård.'),
            sant("'Beach' betyder skog.", False,
                 'Beach betyder strand. Skog heter forest.'),
        ], beskrivning='Platser på engelska: school, home, park, shop och beach.'),

        niva('en-ak2-fler-plats-2', 'Sit down, stand up', 'Plats och fritid', [
            para('Para ihop kommandona.',
                 [('stand up', 'ställ dig upp'), ('sit down', 'sätt dig'), ('open', 'öppna'),
                  ('close', 'stäng')],
                 'Stand up är ställ dig upp och sit down är sätt dig. Open är öppna och close är stäng.'),
            val("Vad betyder 'clap your hands'?",
                ["klappa i händerna", 'tvätta händerna', 'höja händerna'], 'klappa i händerna',
                'Clap betyder klappa. Clap your hands betyder klappa i händerna. Tvätta heter wash '
                'och höja heter raise.'),
            sant("'Listen' betyder titta.", False,
                 'Listen betyder lyssna. Titta heter look.'),
            skriv("Skriv 'hoppa' på engelska.", 'jump',
                  'Hoppa heter jump. Ordet slutar på mp.'),
            ordna('Bygg meningen: Öppna dörren.', ['Open', 'the', 'door.'],
                  forklaring='Öppna heter open, och dörren heter the door.'),
            val('Läraren säger "Look!" Vad ska du göra?', ['titta', 'lyssna', 'sitta'], 'titta',
                'Look betyder titta. Lyssna heter listen och sitta heter sit.'),
            para('Vad kan du göra? Para ihop.',
                 [('walk', 'gå'), ('run', 'springa'), ('dance', 'dansa'), ('sing', 'sjunga')],
                 'Walk är gå och run är springa. Dance är dansa och sing är sjunga.'),
            sant("'Wave' betyder vinka.", True,
                 'Wave betyder vinka, som när du säger hej då med handen.'),
        ], beskrivning='Små kommandon och verb: stand up, sit down, open, close och walk.'),

        niva('en-ak2-fler-plats-3', 'I like football', 'Plats och fritid', [
            para('Para ihop sporterna och aktiviteterna.',
                 [('football', 'fotboll'), ('dancing', 'dans'), ('basketball', 'basket'),
                  ('skating', 'skridskoåkning')],
                 'Football är fotboll och dancing är dans. Basketball är basket och skating är '
                 'skridskoåkning.'),
            val("Vad betyder 'I like drawing'?",
                ['Jag gillar att rita.', 'Jag gillar att dricka.', 'Jag gillar att dansa.'],
                'Jag gillar att rita.',
                'I like betyder jag gillar. Drawing kommer av draw, som betyder rita.'),
            sant("'Swimming' betyder simning.", True,
                 'Swimming kommer av swim, som betyder simma. Ordet har dubbel-m före -ing.'),
            skriv("Skriv 'fotboll' på engelska.", ['football', 'soccer'],
                  'Fotboll heter football: foot är fot och ball är boll. I USA säger man soccer.'),
            ordna('Bygg meningen: Jag tycker om att dansa.', ['I', 'like', 'dancing.'],
                  forklaring='Jag tycker om heter I like. Efter like kan verbet få -ing: dancing.'),
            val('Välj rätt ord: I ___ football on Saturdays. (Jag spelar fotboll på lördagar.)',
                ['play', 'swim', 'read'], 'play',
                'Man spelar fotboll: play football. Swim är simma och read är läsa.'),
            para('Vad betyder meningarna? Para ihop.',
                 [('I like reading.', 'Jag gillar att läsa.'),
                  ('I like singing.', 'Jag gillar att sjunga.'),
                  ('I like painting.', 'Jag gillar att måla.'),
                  ('I like cycling.', 'Jag gillar att cykla.')],
                 'Reading är läsa, singing är sjunga, painting är måla och cycling är cykla.'),
            sant("'I play swimming' är rätt engelska.", False,
                 'Man spelar fotboll och tennis (play), men man simmar: I swim eller I go swimming. '
                 'Play swimming säger man inte.'),
        ], beskrivning='Sport och hobbyer: I like football, I like reading.'),
    ]),

    # ================================================================ Åk 3
    bana('Engelska', 'ak3', [
        niva('en-ak3-fler-plural-1', 'Cat, cats', 'Ett eller flera', [
            skriv('Skriv ordet i plural (flera). One dog, two ___.', 'dogs',
                  'Är det flera hundar sätter man ett -s på slutet: dogs.'),
            val('Välj rätt ord: one cat, two ___', ['cats', 'cat', 'catts'], 'cats',
                'När det är flera sätter man ett -s på slutet: cats. Cat stavas med bara ett t på slutet.'),
            para('Para ihop orden med svenskan.',
                 [('cats', 'katter'), ('books', 'böcker'), ('pens', 'pennor'), ('bags', 'väskor')],
                 'Ett -s på slutet visar att det är flera: cats är katter, books är böcker, pens är '
                 'pennor och bags är väskor.'),
            skriv('Skriv ordet i plural (flera). One book, three ___.', 'books',
                  'Tre böcker är flera, så book får ett -s: books.'),
            sant("'Dogs' betyder en hund.", False,
                 'Dogs betyder flera hundar. En hund heter dog, utan -s.'),
            ordna('Bygg meningen: Jag har två katter.', ['I', 'have', 'two', 'cats.'],
                  forklaring='Efter two kommer cats med -s, för det är flera katter.'),
            val('Du har tre pennor. Vilken mening är rätt?',
                ['I have three pens.', 'I have three pen.', "I have three pen's."],
                'I have three pens.',
                'Efter ett tal större än ett sätter man -s: three pens. Plural skrivs utan apostrof.'),
            sant("Ordet 'books' har ett -s på slutet för att det är flera böcker.", True,
                 'En bok heter book. Är det flera böcker sätter man ett -s på slutet: books.'),
        ], beskrivning='En sak eller flera: ett -s på slutet när det är fler än en.'),

        niva('en-ak3-fler-plural-2', 'A pencil, an apple', 'Ett eller flera', [
            val('Välj rätt ord: I have ___ egg. (Jag har ett ägg.)', ['an', 'a'], 'an',
                'Egg börjar på e, en vokal (a, e, i, o, u). Före en vokal säger man an: an egg.'),
            val('Välj rätt ord: She has ___ dog. (Hon har en hund.)', ['a', 'an'], 'a',
                'Dog börjar på d, som inte är en vokal. Då säger man a: a dog.'),
            skriv('Skriv a eller an: ___ orange (en apelsin)', 'an',
                  'Orange börjar på o, en vokal. Före en vokal säger man an: an orange.'),
            skriv('Skriv a eller an: ___ banana (en banan)', 'a',
                  'Banana börjar på b, som inte är en vokal. Då säger man a: a banana.'),
            sant("'An umbrella' är rätt engelska.", True,
                 'Umbrella betyder paraply och börjar på u, en vokal. Då säger man an umbrella.'),
            para('Para ihop engelskan med svenskan.',
                 [('an apple', 'ett äpple'), ('a pencil', 'en penna'), ('an ice cream', 'en glass'),
                  ('a bag', 'en väska')],
                 'An apple och an ice cream börjar på vokalerna a och i. A pencil och a bag börjar '
                 'på p och b.'),
            ordna('Bygg meningen: Jag äter ett äpple.', ['I', 'eat', 'an', 'apple.'], extra=['a'],
                  forklaring='Apple börjar på a, en vokal, så det heter an apple.'),
            val('Välj meningen som är rätt engelska.',
                ['It is an old car.', 'It is a old car.', 'It are an old car.'], 'It is an old car.',
                'Old börjar på o, en vokal, så det heter an. Efter it kommer is.'),
            sant("'A elephant' är rätt engelska.", False,
                 'Elephant betyder elefant och börjar på e, en vokal. Då heter det an elephant.'),
        ], beskrivning='A före ord som börjar på en konsonant och an före ord som börjar på en vokal.'),

        niva('en-ak3-fler-affar-1', 'Can I have a banana?', 'I affären', [
            val("Vad betyder 'Can I have a banana, please?'",
                ['Kan jag få en banan?', 'Har du en banan?', 'Jag har en banan.'], 'Kan jag få en banan?',
                'Can I have betyder kan jag få, och please betyder snälla. Så frågar man snällt efter något.'),
            skriv("Skriv 'tack' på engelska.", ['thank you', 'thanks'],
                  'Tack heter thank you eller thanks. Thank you är två ord.'),
            sant("'Here you are' betyder varsågod.", True,
                 'Here you are betyder varsågod eller här har du. Det säger man när man ger något.'),
            val("Vad svarar man på 'Thank you'?",
                ["You're welcome.", "I'm sorry.", 'Good night.'], "You're welcome.",
                "You're welcome betyder varsågod eller ingen orsak. Sorry är förlåt och good night är "
                'god natt.'),
            skriv('Skriv ordet som fattas: Can I have an apple, ___? (Kan jag få ett äpple, snälla?)',
                  'please',
                  'Snälla heter please. Man säger det när man ber om något.'),
            ordna('Bygg frågan: Kan jag få en glass, snälla?',
                  ['Can', 'I', 'have', 'an', 'ice', 'cream,', 'please?'],
                  forklaring='Kan jag få heter Can I have, och glass heter ice cream. Please kommer sist.'),
            para('Para ihop frasen med svenskan.',
                 [('Sorry', 'Förlåt'), ('Here you are', 'Varsågod'), ('Anything else?', 'Något mer?'),
                  ('No, thanks', 'Nej tack')],
                 'Sorry är förlåt och here you are är varsågod. Anything else är något mer, och '
                 'no, thanks är nej tack.'),
            sant("'Please' betyder förlåt.", False,
                 'Please betyder snälla. Förlåt heter sorry.'),
        ], beskrivning='Att be om något i en affär och att säga tack.'),

        niva('en-ak3-fler-affar-2', 'How much is it?', 'I affären', [
            val("Vad betyder 'How much is it?'",
                ['Hur mycket kostar det?', 'Hur gammal är det?', 'Hur många finns det?'],
                'Hur mycket kostar det?',
                'How much frågar efter priset. How old frågar hur gammal något är.'),
            skriv('Glassen kostar three pounds. Hur många pund kostar den? Skriv med siffror.',
                  [tal(3), 'three'],
                  'Three är %s. Glassen kostar alltså %s pund.' % (tal(3), tal(3))),
            skriv('En penna kostar two pounds och en bok kostar five pounds. Hur många pund kostar '
                  'de tillsammans? Skriv med siffror.', tal(2 + 5),
                  'Two är %s och five är %s. %s + %s = %s, så de kostar %s pund tillsammans.'
                  % (tal(2), tal(5), tal(2), tal(5), tal(2 + 5), tal(2 + 5))),
            para('Para ihop talet med siffran.',
                 [('four', tal(4)), ('six', tal(6)), ('eight', tal(8)), ('nine', tal(9))],
                 'Four är %s, six är %s, eight är %s och nine är %s.' % (tal(4), tal(6), tal(8), tal(9))),
            sant("'Five pounds' betyder fem pund.", True,
                 'Pound är engelska pengar, ett pund. Flera heter pounds, med -s.'),
            ordna('Bygg meningen: Det kostar fem pund.', ['It', 'is', 'five', 'pounds.'],
                  forklaring='Det kostar kan heta it is. Fem pund heter five pounds, med -s på pounds.'),
            val('Vad svarar man på "How much is the pen?"',
                ['It is two pounds.', 'It is my pen.', 'It is on the desk.'], 'It is two pounds.',
                'How much frågar efter priset, så svaret är ett pris: two pounds.'),
            skriv('Skriv ordet som fattas: How ___ is it? (Hur mycket kostar det?)', 'much',
                  'Hur mycket kostar det heter How much is it?'),
            sant("'How much' och 'how old' betyder samma sak.", False,
                 'How much frågar efter pris eller hur mycket. How old frågar hur gammal någon är.'),
        ], beskrivning='Att fråga vad något kostar och svara med pris i pounds.'),
    ]),

    # ================================================================ Åk 4
    bana('Engelska', 'ak4', [
        niva('en-ak4-fler-var-1', 'In, on, under', 'Var finns det?', [
            val('Väskan står på stolen. The bag is ___ the chair.', ['on', 'in', 'under'], 'on',
                'På heter on. In betyder i och under betyder under.'),
            skriv('Skriv in, on eller under: The apple is ___ the box. (Äpplet ligger i lådan.)', 'in',
                  'I heter in. Äpplet ligger i lådan: in the box.'),
            para('Para ihop ordet med det svenska.',
                 [('on', 'på'), ('in', 'i'), ('under', 'under'), ('over', 'över')],
                 'On är på, in är i, under är under och over är över.'),
            skriv('Skriv in, on eller under: The ball is ___ the bed. (Bollen ligger under sängen.)',
                  'under',
                  'Under heter under på engelska också. The ball is under the bed.'),
            val('Hunden sover under bordet. Vilken mening är rätt?',
                ['The dog sleeps under the table.', 'The dog sleeps in the table.',
                 'The dog sleeps on the table.'],
                'The dog sleeps under the table.',
                'Under betyder under. In the table betyder i bordet och on the table betyder på bordet.'),
            ordna('Bygg meningen: Min katt sover under sängen.', ['My', 'cat', 'sleeps', 'under', 'the', 'bed.'],
                  forklaring='Sover heter sleeps efter my cat, och under sängen heter under the bed.'),
            sant("'On the table' betyder under bordet.", False,
                 'On betyder på. På bordet heter on the table, och under bordet heter under the table.'),
            sant("'The pen is in the bag' betyder att pennan ligger i väskan.", True,
                 'In betyder i, och bag betyder väska. The pen is in the bag: pennan är i väskan.'),
        ], beskrivning='Var något är: in, on och under.'),

        niva('en-ak4-fler-var-2', 'There is, there are', 'Var finns det?', [
            val('Välj rätt ord: There ___ a cat in the garden.', ['is', 'are', 'have'], 'is',
                'A cat är en enda katt. Då heter det there is. There are används när det är flera.'),
            val('Välj frågan som är rätt engelska.',
                ['Is there a table in the room?', 'Are there a table in the room?',
                 'Do there a table in the room?'],
                'Is there a table in the room?',
                'A table är ett bord, bara ett. Då börjar frågan med is there. Are there används om flera.'),
            skriv('Skriv is eller are: There ___ two dogs in the park.', 'are',
                  'Two dogs är flera hundar. Då heter det there are.'),
            skriv('Skriv is eller are: There ___ a ball under the bed.', 'is',
                  'A ball är en enda boll. Då heter det there is.'),
            ordna('Bygg meningen: Det finns en bok på bordet.',
                  ['There', 'is', 'a', 'book', 'on', 'the', 'table.'],
                  forklaring='Det finns en bok heter there is a book, och på bordet heter on the table.'),
            ordna('Bygg meningen: Det finns fyra stolar i rummet.',
                  ['There', 'are', 'four', 'chairs', 'in', 'the', 'room.'],
                  forklaring='Fyra stolar är flera, så det heter there are four chairs.'),
            sant("'There are' används när det är flera saker.", True,
                 'Är det flera saker, till exempel two cats eller five books, säger man there are.'),
            sant("'There are a bag on the chair' är rätt engelska.", False,
                 'A bag är bara en väska. Då heter det there is: There is a bag on the chair.'),
            para('Vad betyder meningarna? Para ihop.',
                 [('There is a bag.', 'Det finns en väska.'),
                  ('There are two bags.', 'Det finns två väskor.'),
                  ('There is a pen.', 'Det finns en penna.'),
                  ('There are three pens.', 'Det finns tre pennor.')],
                 'There is används om en sak och there are om flera. A bag är en väska och two bags '
                 'är två väskor.'),
        ], beskrivning='Det finns: there is om en sak och there are om flera.'),

        niva('en-ak4-fler-klockan-1', "O'clock, half past", 'Klockan och dagen', [
            val("Vad betyder 'half past eight'?", [tid(8, 30)[1], tid(7, 30)[1], tid(8, 15)[1]],
                tid(8, 30)[1],
                'Half past eight är 8.30, en halvtimme efter åtta. På svenska heter 8.30 halv nio, '
                'men halv åtta är 7.30 och heter half past seven.'),
            val("Vad betyder 'a quarter past three'?", [tid(3, 15)[1], tid(3, 45)[1], tid(2, 45)[1]],
                tid(3, 15)[1],
                'A quarter past three är kvart över tre: 3.15. Kvart i fyra, 3.45, heter a quarter to four.'),
            val("Vad betyder 'a quarter to six'?", [tid(5, 45)[1], tid(6, 15)[1], tid(6, 45)[1]],
                tid(5, 45)[1],
                'A quarter to six är kvart i sex: 5.45. Kvart över sex, 6.15, heter a quarter past six.'),
            para('Para ihop klockslagen.',
                 [('It is ' + tid(10, 0)[0] + '.', tid(10, 0)[1]),
                  ('It is ' + tid(10, 30)[0] + '.', tid(10, 30)[1]),
                  ('It is ' + tid(10, 15)[0] + '.', tid(10, 15)[1]),
                  ('It is ' + tid(9, 45)[0] + '.', tid(9, 45)[1])],
                 "O'clock är en hel timme, half past är en halvtimme efter och a quarter past är en "
                 'kvart efter. A quarter to ten är en kvart före tio, alltså 9.45.'),
            skriv('Skriv ordet som fattas: It is nine ___. (Klockan är nio.)', ["o'clock", 'oclock'],
                  "En hel timme heter o'clock: nine o'clock. Apostrofen står för orden of the."),
            skriv('Skriv ordet som fattas: It is half ___ four. (Klockan är 4.30.)', 'past',
                  'Half past four är 4.30: en halvtimme efter fyra.'),
            ordna('Bygg meningen: Klockan är halv tre.', ['It', 'is', 'half', 'past', 'two.'],
                  forklaring='Halv tre är 2.30, en halvtimme efter två. Det heter half past two, '
                             'inte half past three.'),
            sant("'Half past five' betyder 5.30.", True,
                 'Half past five är en halvtimme efter fem, alltså 5.30.'),
            sant("'A quarter to nine' betyder 9.15.", False,
                 'A quarter to nine är kvart i nio: 8.45. Kvart över nio, 9.15, heter a quarter past nine.'),
        ], beskrivning="Klockan på engelska: o'clock, half past, a quarter past och a quarter to."),

        niva('en-ak4-fler-klockan-2', "Sam's Saturday", 'Klockan och dagen', [
            val('När står Sam upp på lördagar?', [UPP[1], tid(8, 0)[1], tid(9, 0)[1], tid(8, 15)[1]],
                UPP[1],
                'Det står I get up at half past eight. Half past eight är 8.30.'),
            skriv('Vad heter Sams lillasyster? Skriv hennes namn.', 'Nora',
                  'Det står I have breakfast with my little sister, Nora. Little sister betyder lillasyster.'),
            skriv('Vad dricker Sam och Nora till frukost? Skriv ordet på engelska.', 'milk',
                  'Det står We eat bread with cheese and drink milk. Milk är mjölk.'),
            sant('Sam och Ali spelar fotboll i parken.', True,
                 'Det står I play football in the park with my friend Ali.'),
            para('Para ihop klockslaget med vad Sam gör.',
                 [(UPP[0], 'står upp'), (FOTBOLL[0], 'spelar fotboll'), (LUNCH[0], 'äter lunch'),
                  (AFFAREN[0], 'går till affären')],
                 "Half past eight är 8.30, ten o'clock är 10.00, twelve o'clock är 12.00 och "
                 "four o'clock är 4.00. Det är den ordning Sam gör sakerna i."),
            ordna('Sätt i ordning vad Sam gör, från morgon till kväll.',
                  ['breakfast', 'football', 'lunch', 'shop', 'film'],
                  forklaring='Sam äter frukost, spelar fotboll, äter lunch, går till affären och '
                             'tittar på film på kvällen.'),
            val('Hur dags slutar fotbollen?', [FOTBOLLEN_SLUT[1], FOTBOLL[1], tid(11, 0)[1], tid(2, 0)[1]],
                FOTBOLLEN_SLUT[1],
                'De börjar klockan tio (10.00) och spelar i två timmar (two hours). Tio plus två är tolv, '
                'så fotbollen slutar 12.00. Då äter de lunch.'),
            sant('Nora går och lägger sig klockan nio.', False,
                 "Det står Nora goes to bed at eight o'clock. Det är Sam som lägger sig klockan nio."),
            val('Varför lägger sig Nora tidigare än Sam?',
                ['Hon är yngre', 'Hon är sjuk', 'Hon är hungrig'], 'Hon är yngre',
                'Det står att Nora är Sams lillasyster (little sister) och bara fem år (only five). Hon är '
                'alltså yngre än Sam, och därför lägger hon sig tidigare.'),
        ], beskrivning='En lördag med klockslag på engelska, och frågor om vad som står.',
            text=SAMS_LORDAG),
    ]),

    # ================================================================ Åk 5
    bana('Engelska', 'ak5', [
        niva('en-ak5-fler-adjektiv-1', 'Big, small, fast, slow', 'Adjektiv', [
            val("Vilket ord är motsatsen till 'fast'?", ['slow', 'small', 'soft'], 'slow',
                'Fast betyder snabb och slow betyder långsam. Small är liten och soft är mjuk.'),
            val("Vad betyder 'difficult'?", ['svår', 'annorlunda', 'dyr'], 'svår',
                'Difficult betyder svår. Annorlunda heter different, och orden liknar varandra. '
                'Dyr heter expensive.'),
            skriv("Skriv motsatsen till 'big'.", ['small', 'little'],
                  'Motsatsen till big (stor) är small (liten). Little betyder också liten och är lika rätt.'),
            skriv("Skriv motsatsen till 'hot'.", ['cold', 'cool'],
                  'Hot betyder het eller varm, och motsatsen är cold, kall. Cool, sval, passar också.'),
            para('Para ihop orden med sina motsatser.',
                 [('easy', 'difficult'), ('heavy', 'light'), ('clean', 'dirty'), ('full', 'empty')],
                 'Easy (lätt att göra) är motsatsen till difficult (svår). Heavy (tung) är motsatsen '
                 'till light (lätt). Clean är ren och dirty är smutsig, full är full och empty är tom.'),
            ordna('Bygg meningen: Soppan är mycket het.', ['The', 'soup', 'is', 'very', 'hot.'],
                  forklaring='Mycket heter very, och det står före adjektivet: very hot.'),
            sant("'Heavy' betyder tung.", True,
                 'Heavy betyder tung. Motsatsen, lätt, heter light.'),
            sant("'Old' är motsatsen till 'tall'.", False,
                 'Old betyder gammal, och motsatsen är young eller new. Tall betyder lång, och '
                 'motsatsen är short.'),
            val('Välj rätt ord: An elephant is ___, but a mouse is small.', ['big', 'small', 'cold'], 'big',
                'Elefanten är stor, big, och musen är liten, small. Stor och liten är motsatser.'),
        ], beskrivning='Ord som beskriver, och deras motsatser: big och small, fast och slow.'),

        niva('en-ak5-fler-adjektiv-2', 'Bigger, the biggest', 'Adjektiv', [
            val('Välj rätt form: My dog is ___ than your dog.', ['bigger', 'biger', 'more big'], 'bigger',
                'Big är kort och slutar på en konsonant, så g:et dubblas före -er: bigger. '
                'Efter than kommer jämförelseformen.'),
            val('Välj rätt form: Today is the ___ day of the year.', ['hottest', 'hotest', 'hotter'],
                'hottest',
                'Dagen är den varmaste av alla, och då används en form på -est. '
                'Hot dubblar t:et: hottest.'),
            skriv('Ali är 140 cm lång och Max är 150 cm lång. Skriv ordet som fattas: '
                  'Max is ___ than Ali. (tall)', 'taller',
                  'Max är längre än Ali. Jämförelseformen av tall är taller: -er och than.'),
            skriv('Skriv ordet som fattas: Sara is the ___ girl in my class. (fast)', 'fastest',
                  'Sara är den snabbaste i klassen. Superlativen av fast är fastest: the fastest.'),
            para('Para ihop ordet med jämförelseformen.',
                 [('big', 'bigger'), ('easy', 'easier'), ('nice', 'nicer'), ('small', 'smaller')],
                 'Big dubblar g: bigger. Easy byter y mot i: easier. Nice har redan e och får bara -r: '
                 'nicer. Small får -er: smaller.'),
            val("Vad är jämförelseformen av 'good'?", ['better', 'gooder', 'more good'], 'better',
                'Good är oregelbundet: good, better, best.'),
            ordna('Bygg meningen: Min bror är äldre än Sara.',
                  ['My', 'brother', 'is', 'older', 'than', 'Sara.'],
                  forklaring='Äldre heter older, och än heter than: older than Sara.'),
            sant("Jämförelseformen av 'happy' är 'happyer'.", False,
                 'Happy slutar på konsonant och y. Då byts y mot i före -er: happier.'),
            val('Välj meningen som är rätt engelska.',
                ['This book is more interesting than that one.',
                 'This book is interestinger than that one.',
                 'This book is most interesting than that one.'],
                'This book is more interesting than that one.',
                'Långa ord som interesting får inte -er. I stället sätter man more före ordet: '
                'more interesting than.'),
        ], beskrivning='Bigger, the biggest: att jämföra med -er, -est och more.'),

        niva('en-ak5-fler-igar-1', 'Walked, played, cooked', 'Igår och i helgen', [
            val('Välj rätt form: Yesterday I ___ football with my friends.',
                ['played', 'play', 'plays'], 'played',
                'Yesterday betyder igår, så det är preteritum. Regelbundna verb får -ed: played.'),
            skriv("Skriv 'cook' i preteritum: Dad ___ pasta for dinner last night.", 'cooked',
                  'Last night betyder i går kväll. Cook är regelbundet och får -ed: cooked.'),
            skriv("Skriv 'listen' i preteritum: I ___ to music yesterday evening.", 'listened',
                  'Yesterday evening betyder i går kväll. Listen får -ed: listened.'),
            val("Hur stavas 'dance' i preteritum?", ['danced', 'danceed', 'daned'], 'danced',
                'Slutar verbet redan på -e lägger man bara till -d: dance blir danced.'),
            para('Vad heter verben när det har hänt? Para ihop.',
                 [('help', 'helped'), ('paint', 'painted'), ('call', 'called'), ('jump', 'jumped')],
                 'De här verben är regelbundna och får -ed: helped, painted, called och jumped.'),
            ordna('Bygg meningen: Vi tittade på en film igår.',
                  ['We', 'watched', 'a', 'film', 'yesterday.'], extra=['watch'],
                  forklaring='Igår visar att det är preteritum, så watch får -ed: watched. '
                             'Yesterday står sist.'),
            sant("'I walked to school yesterday' handlar om något som redan har hänt.", True,
                 'Walked har -ed och yesterday betyder igår. Det har redan hänt.'),
            sant("'She danced' och 'she dances' betyder samma sak.", False,
                 'Danced är preteritum: hon dansade. Dances är presens: hon dansar.'),
            val('Vilken mening visar att det redan har hänt?',
                ['We cleaned the kitchen.', 'We clean the kitchen.', 'We are cleaning the kitchen.'],
                'We cleaned the kitchen.',
                'Cleaned har -ed och står i preteritum. Clean är presens och are cleaning pågår just nu.'),
        ], beskrivning='Regelbundna verb i preteritum: de får -ed, som played och cooked.'),

        niva('en-ak5-fler-igar-2', 'A weekend with Tariq', 'Igår och i helgen', [
            val('När kom Tariq?',
                ['På fredagskvällen', 'På lördagsmorgonen', 'På söndagen', 'På torsdagen'],
                'På fredagskvällen',
                'Det står He arrived on Friday evening. Arrived betyder kom fram.'),
            skriv('Vad heter berättarens hund? Skriv namnet.', 'Bella',
                  'Det står our dog Bella ate it. Our dog betyder vår hund.'),
            val('Vem åt den första pannkakan?',
                ['Hunden Bella', 'Tariq', 'Berättaren', 'Hela familjen'], 'Hunden Bella',
                'Tariq dropped the first pancake on the floor, and our dog Bella ate it. Pannkakan '
                'ramlade på golvet, och det var hunden som åt den.'),
            sant('De spelade fotboll på stranden vid sjön.', True,
                 'Det står we walked to the lake and played football on the beach.'),
            sant('Det regnade på lördagen.', False,
                 'Det står On Sunday it rained. Det regnade alltså på söndagen.'),
            para('Para ihop tiden med vad de gjorde.',
                 [('Friday evening', 'pratade'), ('Saturday morning', 'lagade pannkakor'),
                  ('Saturday afternoon', 'spelade fotboll'), ('Sunday', 'byggde ett slott')],
                 'På fredagskvällen pratade de (talked), på lördagsmorgonen lagade de pannkakor (cooked pancakes), '
                 'på lördagseftermiddagen spelade de fotboll (played football) och på söndagen byggde '
                 'de ett slott (made a castle).'),
            skriv('Hur kände sig berättaren när Tariq åkte hem? Skriv ett ord på engelska.',
                  ['sad', 'a little sad', 'unhappy'],
                  'Det står When Tariq went home, I was a little sad. Sad betyder ledsen.'),
            val('Vad tyckte berättaren troligen om helgen?',
                ['Berättaren tyckte om helgen.', 'Berättaren tyckte inte om helgen.',
                 'Berättaren var rädd för hunden.', 'Berättaren var arg på Tariq.'],
                'Berättaren tyckte om helgen.',
                'De skrattade mycket, berättaren blev ledsen när Tariq åkte, och de lovade att träffas '
                'igen. Då är det rimligt att helgen var bra.'),
            skriv('Vad lagade de på lördagsmorgonen? Skriv ordet på engelska.', ['pancakes', 'pancake'],
                  'Det står we cooked pancakes for the whole family. Pancakes är pannkakor.'),
        ], beskrivning='En berättelse om en helg med en kusin, i preteritum, med frågor om vad som står.',
            text=TARIQ),
    ]),
]
