# -*- coding: utf-8 -*-
"""Engelska inför nationella provet (2026-10-06): nya NP-områden sist i banorna
åk 6, åk 9, gymnasiet 1 och gymnasiet 2. Två nivåer per område.

- Åk 6, «NP-träning: ord och grammatik»: vardagsord, klockan, prepositioner,
  presens och dåtid, och frågor och korta svar med do och does.
- Åk 9, «NP-träning: ord och grammatik»: tempus, oregelbundna verb, if-satser,
  adjektivets komparation och sambandsord.
- Gymnasiet 1, «NP-träning: skriva»: hur en argumenterande och en berättande
  text byggs upp, formell och informell stil, sambandsord och vanliga fel.
- Gymnasiet 2, «Läsa: NP-träning»: två egna lästexter, en debattartikel och en
  novell. Och «NP-träning: ord och stil»: akademiskt ordförråd, formell stil,
  sambandsord och idiom.

Bygger på Lgr22:s centrala innehåll i engelska för åk 4–6 och 7–9, ämnesplanen
i engelska för gymnasiet och provdelarna som NP-bladen i verktyg/bladen/
(np_ak6.py, np_ak9.py och np_gymnasiet.py) beskriver: läsa, skriva och språket i
det man skriver. NP-nivåerna som redan finns («NP-träning: skriva» och «Läsa:
NP-träning» i blad_engelska.py) får sällskap här, och ingen fråga upprepar en
fråga ur engelska.py, engelska_mer.py eller blad_engelska.py. Inget är kopierat
ur ett nationellt prov eller en lärobok. Lästexterna, gatan utanför Alder Street
School och syskonen på stranden, är påhittade och skrivna för banken.

Frågorna är på engelska, som på provet, och förklaringarna på svenska, som i
resten av banken, så att regeln går fram också när frågan inte gjorde det.

Förenklat:
- Skrivdelen bedöms av en lärare på provet. Här blir den frågor om textens
  byggnad, stil och språk som en maskin kan rätta.
- «Den vanliga ordningen» i en berättelse (personer och miljö, ett problem,
  höjdpunkten, lösningen) är en modell. Förklaringen säger att en berättelse
  kan bryta mot den med flit.
- Grunden är brittisk engelska, som i resten av banken. Där amerikansk engelska
  har en form som också är rätt (farther) godtas den.
- Tolkningsfrågorna om novellen har ett svar som texten stöder och fel
  alternativ som texten motsäger. En lärare kan godta fler tolkningar i ett
  eget, skrivet svar.
- Idiomen är valda för att de har en fast betydelse som inte ändras."""
from grund import bana, niva, val, skriv, ordna, sant, para, tal


def _text(*stycken):
    return '\n\n'.join(stycken)


# ---- Klockan i åk 6: a quarter to nine är en kvart före nio ----
KVART_I_TIMME = 9
KVART_I = '%d:%02d' % (KVART_I_TIMME - 1, 60 - 15)
# Den vanliga felläsningen är en kvart över (9:15).
assert KVART_I == '8:45' and KVART_I != '%d:15' % KVART_I_TIMME


# ---- Lästexterna i gymnasiet 2 ----

GATAN = _text(
    'Let the children have the street',
    'Every weekday at twenty past eight, the road outside Alder Street School turns into a car park. '
    'Engines run while parents say goodbye, vans squeeze past, and children dodge between bumpers '
    'with their schoolbags. I have taught at Alder Street for eleven years, and every autumn I count '
    'the near misses. It is time for the council to do something braver than painting another zebra '
    'crossing: it should close our street to traffic for half an hour at the start and the end of '
    'every school day.',
    'The idea is not as radical as it sounds. Last spring, the council allowed a six-week trial. The '
    'street was closed from 8.15 to 8.45 every morning, and for half an hour again in the afternoon. '
    'Residents could still drive in and out, and so could anyone with a disabled parking badge. The '
    'results were striking. The number of children who walked, cycled or scooted to school almost '
    'doubled, and parents told us that their children arrived calmer and more awake. Without the '
    "queue of idling cars, the air outside the classrooms was cleaner, according to the council's "
    'own measurements.',
    'Not everyone was pleased, and the objections deserve an answer. Some parents have to drive '
    'because they go straight on to work. For them, the trial meant parking two streets away and '
    'walking the last few minutes. That is an inconvenience, but it is a small price for a safer '
    'street. The shop owners on the corner feared that they would lose customers. In fact, their '
    'sales during the trial were almost unchanged, because the street was only closed for an hour '
    'a day.',
    'The real question is what kind of childhood we want. A child who walks to school learns to read '
    'traffic, to judge distances and to say hello to neighbours. A child who is driven to the gate '
    'learns to wait in the back seat. We often complain that young people spend too little time '
    'outdoors, and then we design our streets so that only cars feel at home in them.',
    'The council will decide in March whether to make the scheme permanent. I urge every parent, '
    'resident and shopkeeper to write to their councillor before then. We managed for six weeks. We '
    'can manage for good.',
    'The writer is a teacher at Alder Street School.')

# Försöket: stängt 8.15–8.45 på morgonen och en halvtimme till på
# eftermiddagen, alltså en timme om dagen. Facit räknas ur klockslagen, och
# texten prövas så att ingen ändrar den ena utan den andra.
MORGON_MINUTER = (8 * 60 + 45) - (8 * 60 + 15)
EFTERMIDDAG_MINUTER = 30
assert MORGON_MINUTER == 30 and 'from 8.15 to 8.45 every morning' in GATAN
assert 'for half an hour again in the afternoon' in GATAN
# Svaret till butiksägarna vilar på summan: en timme om dagen.
assert MORGON_MINUTER + EFTERMIDDAG_MINUTER == 60 and 'only closed for an hour a day' in GATAN
# Uttrycket som efterfrågas står i första stycket efter rubriken.
assert 'near misses' in GATAN.split('\n\n')[1]

LAGVATTEN = _text(
    'Low Tide',
    'On the last evening before my sister Erin left for university, she wanted to build a '
    'sandcastle. She was eighteen and I was eleven, and I told her she was too old for it. She '
    'handed me a spade anyway.',
    'We built it just below the line of dry seaweed, where the sand was dark and firm. Erin made the '
    'towers and I dug the moat. Every few minutes she looked out at the water, which was creeping up '
    'the beach like a cat that pretends not to be interested.',
    '"It\'s coming in," I said.',
    '"Then we need a wall," said Erin.',
    'So we built a wall. It was knee-high and curved, and we patted it smooth until our palms stung. '
    'The first wave stopped a metre short of it. The second licked at its foot and slid back. I '
    'cheered as if we had won something.',
    '"It won\'t hold," Erin said quietly. "It never does."',
    '"Then why did we build it?"',
    "She didn't answer. She was watching the lights of the ferry crossing the bay, the same ferry "
    'that would carry her away at seven the next morning.',
    "The third wave went over the wall as if it wasn't there. Water rushed into the moat, and the "
    'nearest tower slumped sideways like a tired old man. I dug faster, throwing wet sand into the '
    'gap, but the sea came back each time, patient and cold.',
    '"Leave it, Jamie," Erin said, and she sat down in the shallow water, jeans and all.',
    'For a moment I just stared at her. Then I sat down beside her. The sea was freezing. We watched '
    'the castle melt, tower by tower, until only a smooth bump was left, and we laughed so hard that '
    'a man walking his dog stopped to look at us.',
    'On the way home, Erin put her wet arm around my shoulders. "I\'ll call you on Sundays," she said.',
    '"You\'ll forget."',
    '"Then you\'ll call me."',
    'She did not forget. But the next summer, when the tide came in, I did not build a wall. I built '
    'my castle a little higher up the beach, and I let the sea have the rest.')

# Åldersskillnaden i frågan om berättaren räknas ur åldrarna i texten.
ALDER_ERIN, ALDER_JAMIE = 18, 11
TAL_ORD = {7: 'seven'}
assert 'She was eighteen and I was eleven' in LAGVATTEN
ARS_YNGRE = TAL_ORD[ALDER_ERIN - ALDER_JAMIE]
assert 'moat' in LAGVATTEN and 'She did not forget' in LAGVATTEN

# Händelserna i ordna-frågan, med det ställe i texten där var och en står.
# Ordningen prövas mot texten: flyttas ett stycke blir det ett fel här.
HANDELSER = [
    ('Erin hands Jamie a spade', 'handed me a spade'),
    ('They build a wall against the sea', 'So we built a wall'),
    ('A wave goes over the wall', 'The third wave went over the wall'),
    ('Erin and Jamie sit in the water', 'she sat down in the shallow water'),
    ('Erin puts her arm around Jamie', 'put her wet arm around my shoulders'),
]
_platser = [LAGVATTEN.index(stalle) for _, stalle in HANDELSER]
assert _platser == sorted(_platser)

assert len(GATAN) <= 2500 and len(LAGVATTEN) <= 2500


TILLAGG = [
    # ================================================================ Åk 6
    bana('Engelska', 'ak6', [
        niva('en-ak6-np-ord-och-grammatik-1', 'Words for every day', 'NP-träning: ord och grammatik', [
            val('Choose the right word: We can borrow books at the ___.', ['library', 'bookshop', 'bakery'],
                'library',
                'Library betyder bibliotek, och där lånar man böcker. I en bookshop köper man dem, och i en '
                'bakery köper man bröd.'),
            val('Choose the right word: This jacket costs only 99 kronor. It is very ___.',
                ['cheap', 'expensive', 'empty'], 'cheap',
                'Cheap betyder billig, och 99 kronor är lite för en jacka. Expensive betyder dyr och empty tom.'),
            val("What time is 'a quarter to nine'?", [KVART_I, '9:15', '9:45', '8:15'], KVART_I,
                'A quarter to nine är en kvart i nio, alltså %s. A quarter past nine är en kvart över nio, 9:15.'
                % KVART_I),
            skriv('Write in, on or at: My grandma lives ___ the fourth floor.', 'on',
                  'På en våning heter on: on the fourth floor, på fjärde våningen.'),
            sant("'He is on the bus' is correct English.", True,
                 'Man är on the bus, on the train och on the plane. I en bil är man däremot in the car.'),
            val('Choose the right word: There is a big map ___ the wall in our classroom.', ['on', 'at', 'in'],
                'on',
                'Det som hänger på en vägg är on the wall, precis som på svenska: på väggen.'),
            para('Match the school word with the Swedish word.',
                 [('timetable', 'schema'), ('break', 'rast'), ('subject', 'ämne'), ('homework', 'läxa')],
                 'Timetable är schemat, break är rasten, subject är ett ämne som engelska eller matte, och '
                 'homework är läxa.'),
            ordna('Build the sentence: Vi ses vid busshållplatsen klockan fyra.',
                  ['See', 'you', 'at', 'the', 'bus', 'stop', 'at', 'four.'], extra=['in'],
                  forklaring='En plats där man möts får at: at the bus stop. Före ett klockslag står också at: '
                             'at four.'),
            skriv('Write in, on or at: We often go skiing ___ winter.', 'in',
                  'Före årstider och månader står in: in winter, in July.'),
            val("Your friend says 'Thank you!' What can you answer?",
                ["You're welcome!", 'Excuse me, please!', 'Bless you!'], "You're welcome!",
                "You're welcome betyder varsågod när någon tackar. Excuse me säger man för att få någons "
                'uppmärksamhet, och bless you när någon nyser.'),
        ], beskrivning='Inför nationella provet: vardagsord, klockan och små ord som in, on och at, som du '
                       'behöver både när du läser och när du skriver.'),

        niva('en-ak6-np-ord-och-grammatik-2', 'Now and then', 'NP-träning: ord och grammatik', [
            val('Choose the right answer: Do you like horses? – Yes, I ___.', ['do', 'like', 'am'], 'do',
                "Ett kort svar på en fråga med do tar do igen: Yes, I do. Ett nej blir No, I don't."),
            val('Choose the right answer: Does Sara have a brother? – No, she ___.',
                ["doesn't", "don't", "doesn't has"], "doesn't",
                "Frågan börjar med does, och då svarar man med samma ord: No, she doesn't. Efter doesn't står aldrig has."),
            ordna('Build the question: När börjar filmen?', ['When', 'does', 'the', 'film', 'start?'],
                  extra=['starts?'],
                  forklaring='The film kan bytas mot it, så frågan får does. Efter does står verbet utan -s: '
                             'start.'),
            skriv('Write do or does: What ___ your parents do?', 'do',
                  'Your parents är flera, som they, och då blir det do. Det sista do är verbet göra.'),
            val("Choose the right form: Last summer we ___ to my uncle's farm.", ['drove', 'drive', 'drived'],
                'drove',
                'Last summer visar att det har hänt. Drive är oregelbundet: drive blir drove, aldrig drived.'),
            skriv("Write the past tense of 'make': Yesterday I ___ pancakes for my family.", 'made',
                  'Make är oregelbundet: make blir made.'),
            val('Choose the right form: My brother ___ his bike to school every day.', ['rides', 'ride', 'riding'],
                'rides',
                'Every day visar en vana, och vanor står i presens. My brother är en han, så verbet får -s: '
                'rides.'),
            sant("'Last night we watch a film' is correct English.", False,
                 'Last night visar att det redan har hänt. Då ska verbet stå i dåtid: Last night we watched a '
                 'film.'),
            para('Match each verb with the form it has in the past tense.',
                 [('give', 'gave'), ('sit', 'sat'), ('sleep', 'slept'), ('say', 'said')],
                 'De här verben är oregelbundna och får inte -ed: give – gave, sit – sat, sleep – slept och '
                 'say – said.'),
            val('Which of these questions is correct English?',
                ['What time do you get up?', 'What time you get up?', 'What time do you gets up?'],
                'What time do you get up?',
                'En fråga i presens behöver do: What time do you …? Efter do står verbet utan -s: get up.'),
        ], beskrivning='Inför nationella provet: presens och dåtid, vanliga oregelbundna verb, och frågor och '
                       'korta svar med do och does.'),
    ]),

    # ================================================================ Åk 9
    bana('Engelska', 'ak9', [
        niva('en-ak9-np-ord-och-grammatik-1', 'Tenses and tricky verbs', 'NP-träning: ord och grammatik', [
            val('Choose the right form: I ___ my homework when the lights went out, so I could not finish it.',
                ['was doing', 'did', 'have done'], 'was doing',
                'Läxan pågick när ljuset gick och blev aldrig klar. Det som pågick i det förflutna står i past '
                'continuous: was doing.'),
            val('Choose the right form: My grandad ___ smoke, but he stopped ten years ago.',
                ['used to', 'is used to', 'uses to'], 'used to',
                'Used to plus grundform är en vana förr som inte gäller längre. Be used to betyder vara van vid, '
                'och uses to finns inte.'),
            val('Choose the right word: How long ___ you known each other?', ['have', 'did', 'were'], 'have',
                'How long frågar hur länge något har pågått fram till nu: present perfect, have you known. '
                'Efter did hade det stått know.'),
            skriv("Write the past participle of 'fall': Oh no, my phone has ___ into the lake!", 'fallen',
                  'Efter has står perfekt particip: fall – fell – fallen.'),
            skriv("Write the past tense of 'throw': Yesterday he ___ the ball over the fence.", 'threw',
                  'Throw är oregelbundet: throw – threw – thrown.'),
            para('Match the verb with its past participle.',
                 [('hide', 'hidden'), ('wear', 'worn'), ('bite', 'bitten'), ('shake', 'shaken')],
                 'Perfekt particip är formen efter have och has: hidden, worn, bitten och shaken. De får man '
                 'lära sig utantill.'),
            sant("'Brang' is the past tense of 'bring'.", False,
                 'Bring – brought – brought, med samma slut som buy – bought. Brang är en vanlig gissning efter '
                 'sing – sang.'),
            ordna('Build the sentence: Hon har vuxit mycket i år.',
                  ['She', 'has', 'grown', 'a', 'lot', 'this', 'year.'], extra=['growed'],
                  forklaring='This year är inte slut, så det blir present perfect: has grown. Grow – grew – '
                             'grown.'),
            val('Which sentence about last night is correct?',
                ['The lake froze last night.', 'The lake freezed last night.', 'The lake has frozen last night.'],
                'The lake froze last night.',
                'Last night säger när det hände, så det blir past simple. Freeze är oregelbundet: freeze – '
                'froze – frozen.'),
            val('Choose the right form: I ___ to the dentist twice this year.', ['have been', 'was', 'have went'],
                'have been',
                'This year är inte slut än, så det blir present perfect: have been, har varit. Efter have står '
                'aldrig went.'),
        ], beskrivning='Inför nationella provet: att välja rätt tempus och böja oregelbundna verb, som när du '
                       'skriver en egen text.'),

        niva('en-ak9-np-ord-och-grammatik-2', 'Conditions and comparisons', 'NP-träning: ord och grammatik', [
            skriv("Write the right form of 'have': If we ___ a car, we could drive to the mountains.", 'had',
                  'Vi har ingen bil, så villkoret är tänkt. Efter if står då dåtid, had, och i den andra delen '
                  'could eller would.'),
            val('Which if-sentence is correct?',
                ['If it snows tomorrow, we will build a snowman.', 'If it will snow tomorrow, we build a snowman.',
                 'If it snowed tomorrow, we will build a snowman.'],
                'If it snows tomorrow, we will build a snowman.',
                'Något som kan hända i framtiden får presens efter if och will i den andra delen.'),
            val('Choose the right form: Today is ___ day of the year so far.',
                ['the hottest', 'the most hot', 'the hotter'], 'the hottest',
                'Dagen jämförs med alla årets dagar, så det blir superlativ med the. Hot dubblar t: hot – '
                'hotter – hottest.'),
            val('Choose the right form: My new phone is not as ___ as my old one.',
                ['expensive', 'more expensive', 'expensiver'], 'expensive',
                'Mellan as och as står adjektivet i grundform: not as expensive as, inte lika dyr som.'),
            skriv("Write the comparative of 'far': The station is ___ away than I thought.",
                  ['further', 'farther'],
                  'Far är oregelbundet: far – further – furthest eller far – farther – farthest. Om avstånd är '
                  'båda rätt.'),
            ordna('Build the sentence: Provet var lättare än jag trodde.',
                  ['The', 'test', 'was', 'easier', 'than', 'I', 'thought.'], extra=['more', 'then'],
                  forklaring='Easy får -ier, och då behövs inget more: easier. Än heter than. Then betyder '
                             'sedan eller då.'),
            val('Choose the right word: ___ she was very tired, she stayed up to watch the end of the film.',
                ['Although', 'Because', 'Therefore'], 'Although',
                'Den som är trött borde gå och lägga sig, men hon stannar uppe. Although, fast, visar det '
                'oväntade.'),
            sant("'Despite it was raining, we went out' is correct English.", False,
                 'Efter despite står ett substantiv eller en -ing-form: despite the rain. Före en hel sats står '
                 'although: although it was raining.'),
            para('Match the linking word with the Swedish word.',
                 [('instead', 'i stället'), ('otherwise', 'annars'), ('as a result', 'som en följd'),
                  ('while', 'medan')],
                 'Sambandsorden visar hur meningar hänger ihop: ett byte, en risk, en följd eller två saker '
                 'samtidigt.'),
            val('Choose the right word: We missed the last bus, ___ we had to walk home.',
                ['so', 'because', 'although'], 'so',
                'Att gå hem är en följd av att de missade bussen. So betyder så att och visar följden.'),
        ], beskrivning='Inför nationella provet: if-satser, jämförelser med -er, -est och as … as, och '
                       'sambandsord som binder ihop meningarna i en text.'),
    ]),

    # ================================================================ Gy 1
    bana('Engelska', 'gy1', [
        niva('en-gy1-np-skriva-1', 'Argue or tell a story', 'NP-träning: skriva', [
            val('Which sentence would make the best first sentence of an argumentative text about school '
                'lunches?',
                ['Have you ever thrown away a lunch you did not even taste?',
                 'In this text I am going to write about school lunches.',
                 'School lunches are a thing that many people have opinions on.'],
                'Have you ever thrown away a lunch you did not even taste?',
                'En fråga till läsaren väcker intresse direkt. In this text I am going to write about … säger '
                'bara vad som ska komma, och a thing är vagt.'),
            val('Which first sentence suits a narrative text best?',
                ['The door was already open when Sam got home.',
                 'There are many reasons why doors should be locked.',
                 'In my opinion, people should always lock their doors.'],
                'The door was already open when Sam got home.',
                'En berättelse börjar gärna mitt i en händelse som väcker frågor. De andra två inleder '
                'argumenterande texter.'),
            ordna('Put the parts of a story in the usual order.',
                  ['The characters and the setting are introduced', 'A problem appears',
                   'The problem reaches its peak', 'The problem is solved'],
                  forklaring='Först personer och miljö, sedan ett problem som ställs på sin spets och till sist '
                             'löses. Det är en modell: en berättelse kan bryta mot den med flit.'),
            val('Which sentence shows a feeling instead of just naming it?',
                ['Her hands were shaking as she opened the letter.',
                 'She was very, very nervous when she opened the letter.',
                 'She felt nervous because of the letter she got.'],
                'Her hands were shaking as she opened the letter.',
                "Skakande händer visar nervositeten, så att läsaren förstår den själv. Det kallas show, don't "
                'tell.'),
            skriv("Keep the story in the past tense. Write the right form of 'begin': We were halfway home "
                  'when it suddenly ___ to rain.', 'began',
                  'En berättelse i dåtid ska stanna i dåtid. Begin är oregelbundet: begin – began – begun.'),
            val('Which phrase moves a story forward in time?', ['Later that night,', 'On the other hand,', 'To sum up,'],
                'Later that night,',
                'Tidsord som later that night och the next morning för handlingen framåt. De andra två hör '
                'hemma i argumenterande texter.'),
            para('Match the type of text with a typical first line.',
                 [('a story', 'It was the coldest night of the year.'),
                  ('an argumentative text', 'Homework should be optional for all students.'),
                  ('a formal letter', 'Dear Sir or Madam,'),
                  ('a message to a friend', 'Hi! Guess what happened today?')],
                 'Början visar vilken sorts text det är: en händelse, en åsikt, en formell hälsning eller ett '
                 'vardagligt hej.'),
            val('Which sentence suits the end of an argumentative text about homework?',
                ['For these reasons, homework should be optional.',
                 'And then we all went home, tired but very happy after a long day.',
                 'Another reason is that homework takes time away from sports and friends.'],
                'For these reasons, homework should be optional.',
                'Avslutningen knyter ihop texten och upprepar åsikten. Den andra meningen slutar en berättelse, '
                'och den tredje inleder ett nytt skäl.'),
            sant("A good argumentative text never mentions the other side's arguments.", False,
                 'En bra argumenterande text tar ofta upp ett motargument och bemöter det. Då syns det att du '
                 'har tänkt på båda sidor.'),
            val('When should you start a new paragraph in a story?',
                ['When the time, the place or the speaker changes',
                 'After every third sentence, to make it look neat',
                 'Only when you have written half a page'],
                'When the time, the place or the speaker changes',
                'Ett nytt stycke visar att något nytt börjar: en ny tid, en ny plats eller en ny person som '
                'talar.'),
        ], beskrivning='Inför provets skrivdel: hur en argumenterande och en berättande text byggs upp, från '
                       'första meningen till slutet.'),

        niva('en-gy1-np-skriva-2', 'Style and slips', 'NP-träning: skriva', [
            val('Which sentence suits a formal text best?',
                ['Many students find it hard to concentrate after lunch.',
                 'Loads of students find it super hard to focus after lunch, honestly.',
                 "Students can't really focus after lunch, you know, it's a thing."],
                'Many students find it hard to concentrate after lunch.',
                'Formellt: inga kortformer och inget talspråk som loads of, super, honestly eller you know.'),
            para('Match the phrasal verb with a more formal verb.',
                 [('put off', 'postpone'), ('look into', 'investigate'), ('cut down on', 'reduce'),
                  ('set up', 'establish')],
                 'Frasverb är vanliga i tal. I en formell text passar ofta ett enda, mer precist verb bättre.'),
            val('Choose the right linking phrase: ___ the bad weather, the concert went ahead.',
                ['In spite of', 'Although', 'Even though'], 'In spite of',
                'Efter in spite of står ett substantiv: in spite of the bad weather. Although och even though '
                'behöver en hel sats: although the weather was bad.'),
            ordna('Build the sentence: Som en följd stängdes skolan i två dagar.',
                  ['As', 'a', 'result,', 'the', 'school', 'was', 'closed', 'for', 'two', 'days.'],
                  forklaring='As a result visar en följd och följs av kommatecken. I två dagar heter for two '
                             'days.'),
            val('Which request is correct English?',
                ['Can you explain the rule to me?', 'Can you explain me the rule?',
                 'Can you explain for me the rule?'],
                'Can you explain the rule to me?',
                'Explain tar saken först och personen efter to: explain something to someone. Explain me är ett '
                'vanligt fel.'),
            sant("'We discussed about the problem' is correct English.", False,
                 'Verbet discuss tar inget about: we discussed the problem. Substantivet gör det: a discussion '
                 'about the problem.'),
            val("Choose the right word: I'm reading a 500-page ___ about a family in London.",
                ['novel', 'short story', 'novelty'], 'novel',
                'Novel betyder roman. Det svenska ordet novell heter short story, och novelty betyder nyhet.'),
            sant('Nationalities and languages are written with a capital letter in English, for example Swedish '
                 'and English.', True,
                 'På svenska skriver vi svensk och engelska med liten bokstav, men på engelska är det alltid '
                 'stor: Swedish, English.'),
            skriv("'Alot' is a common mistake. Write it correctly.", 'a lot',
                  'A lot skrivs alltid som två ord. Alot finns inte.'),
            val('Choose the right word: The students left ___ bags in the classroom.',
                ['their', 'there', "they're"], 'their',
                "Their betyder deras. There betyder där, och they're är en kortform av they are."),
        ], beskrivning='Inför provets skrivdel: formell och informell stil, sambandsord och vanliga fel som drar '
                       'ner en annars bra text.'),
    ]),

    # ================================================================ Gy 2
    bana('Engelska', 'gy2', [
        niva('en-gy2-np-lasa-1', 'Let the children have the street', 'Läsa: NP-träning', [
            val('What does the writer want the council to do?',
                ['Close the street to traffic around school times',
                 'Paint another zebra crossing outside the school gate',
                 'Build a car park for parents right next to the school'],
                'Close the street to traffic around school times',
                'Det står it should close our street to traffic for half an hour at the start and the end of '
                'every school day.'),
            val('Why does the writer mention having taught at the school for eleven years?',
                ['To show that the writer knows the problem first-hand',
                 'To explain why the writer drives to work every day',
                 'To complain that teachers stay at the same school too long'],
                'To show that the writer knows the problem first-hand',
                'Den som har räknat tillbud utanför skolan varje höst i elva år vet vad den talar om. Det gör '
                'skribenten trovärdig.'),
            sant('During the trial, people who lived on the street could not drive in or out.', False,
                 'Det står Residents could still drive in and out. Residents är de som bor på gatan.'),
            skriv('For how many minutes was the street closed each morning during the trial? Write the number.',
                  [tal(MORGON_MINUTER), 'thirty', 'half an hour'],
                  'Det står from 8.15 to 8.45 every morning. Från kvart över åtta till kvart i nio är %d minuter.'
                  % MORGON_MINUTER),
            val('Which objection to the scheme does the writer mention?',
                ['Some parents need to drive straight on to work',
                 'Closing the street would cost too much money',
                 'Children would be late for their first lessons'],
                'Some parents need to drive straight on to work',
                'Det står Some parents have to drive because they go straight on to work.'),
            val("How does the writer answer the shop owners' worry?",
                ['Their sales hardly changed during the trial',
                 'They will get extra parking spaces outside their shops',
                 'They can open their shops an hour later'],
                'Their sales hardly changed during the trial',
                'Det står their sales during the trial were almost unchanged. Gatan var bara stängd en timme om '
                'dagen.'),
            val("What does the writer mean by 'a small price for a safer street'?",
                ['The trouble is worth it, since the street becomes safer',
                 'Parents must pay a small fee to park close to the school',
                 'Closing the street will not cost the council much money'],
                'The trouble is worth it, since the street becomes safer',
                'Price betyder här inte pengar utan besvär: att parkera en bit bort är värt det för en säkrare '
                'gata.'),
            val('The writer compares a child who walks to school with a child who is driven to the gate. What '
                'is the point of the comparison?',
                ['Walking teaches children things that the back seat cannot',
                 'Children who are driven are better at judging distances',
                 'Most children would rather be driven all the way to the gate'],
                'Walking teaches children things that the back seat cannot',
                'Barnet som går lär sig läsa trafiken och hälsa på grannarna. Barnet i baksätet lär sig bara att '
                'vänta.'),
            para('Match the part of the article with what it does.',
                 [('the opening paragraph', 'describes a problem and makes a demand'),
                  ('the paragraph about the trial', 'gives evidence that the idea works'),
                  ('the paragraph about objections', 'answers the other side'),
                  ('the paragraph about the decision in March', 'asks readers to act')],
                 'En debattartikel ställer ett krav, stöder det med belägg, bemöter invändningar och slutar med '
                 'en uppmaning.'),
            skriv("Find an expression in the opening paragraph that means 'accidents that almost happen'.",
                  ['near misses', 'near miss', 'the near misses', 'a near miss'],
                  'Det står every autumn I count the near misses. A near miss är en olycka som nästan händer.'),
        ], beskrivning='Inför provets läsdel: en debattartikel om en gata utanför en skola, med frågor om krav, '
                       'belägg, motargument och syfte.',
            text=GATAN),

        niva('en-gy2-np-lasa-2', 'Low Tide', 'Läsa: NP-träning', [
            val('Who tells the story?',
                ['Jamie, %s years younger than Erin' % ARS_YNGRE, 'Erin, on her last evening at home',
                 'A narrator outside the story who watches them'],
                'Jamie, %s years younger than Erin' % ARS_YNGRE,
                'Berättaren säger I och my sister, och Erin säger Leave it, Jamie. Erin är %d och Jamie %d.'
                % (ALDER_ERIN, ALDER_JAMIE)),
            val('Why does this evening matter so much?',
                ['Erin leaves for university the next day', "It is Jamie's eleventh birthday today",
                 'It is the last warm evening of the summer'],
                'Erin leaves for university the next day',
                'Det står On the last evening before my sister Erin left for university, och färjan tar henne '
                'at seven the next morning.'),
            val("The sea is 'creeping up the beach like a cat that pretends not to be interested'. What does "
                'the simile suggest?',
                ['It is coming closer slowly and quietly', 'It crashes loudly and wildly against the castle',
                 'It is warm and playful, like a pet'],
                'It is coming closer slowly and quietly',
                'En katt som låtsas vara ointresserad smyger sig närmare utan att märkas. Så kommer tidvattnet.'),
            sant('The sea does not get past the wall until the third wave.', True,
                 'Den första vågen stannar en meter före, den andra slickar på muren och drar sig tillbaka, och '
                 'den tredje går rakt över.'),
            val('What might the tide stand for in the story?',
                ['Time and change, which cannot be stopped', 'Danger, which the children must run from',
                 'The anger between Erin and Jamie'],
                'Time and change, which cannot be stopped',
                "Muren håller inte tillbaka havet, och ingen kan hindra att Erin flyttar. Erin säger själv It "
                "won't hold. It never does."),
            val('Why does Erin sit down in the water?',
                ['She accepts that the castle cannot be saved', 'She slips and falls on the wet sand',
                 'She wants to rebuild the wall from inside the moat'],
                'She accepts that the castle cannot be saved',
                'Hon säger Leave it, Jamie och sätter sig i det iskalla vattnet. Hon har slutat kämpa emot '
                'havet.'),
            ordna('Put the events in the order they happen in the story.', [h for h, _ in HANDELSER],
                  forklaring='Först spaden, sedan muren, den tredje vågen över muren, syskonen i vattnet och '
                             'till sist armen om axlarna på vägen hem.'),
            sant('Erin forgets to call Jamie after she has left.', False,
                 'Det står She did not forget.'),
            val('What does the last sentence suggest about Jamie?',
                ['Jamie has learnt to let go of what cannot be kept',
                 'Jamie no longer goes to the beach in the summer',
                 'Jamie builds a much stronger wall than the year before'],
                'Jamie has learnt to let go of what cannot be kept',
                'Jamie bygger ingen mur alls, och I let the sea have the rest visar att Jamie låter det gå som '
                'inte går att hålla kvar.'),
            skriv("Find a word in the story that means 'a ditch filled with water around a castle'.",
                  ['moat', 'the moat', 'a moat'],
                  'Det står I dug the moat och Water rushed into the moat. Moat betyder vallgrav.'),
        ], beskrivning='Inför provets läsdel: en kort novell om två syskon på en strand, med frågor om berättare, '
                       'bildspråk, symbolik och vad slutet antyder.',
            text=LAGVATTEN),

        niva('en-gy2-np-ord-och-stil-1', 'Academic words', 'NP-träning: ord och stil', [
            val("Which word means 'tillräcklig'?", ['sufficient', 'significant', 'efficient'], 'sufficient',
                'Sufficient betyder tillräcklig: sufficient evidence. Significant betyder betydande och '
                'efficient effektiv.'),
            val("Which word means 'oundviklig'?", ['inevitable', 'invaluable', 'invisible'], 'inevitable',
                'Inevitable betyder oundviklig. Invaluable betyder ovärderlig och invisible osynlig.'),
            para('Match the verb with its noun.',
                 [('analyse', 'analysis'), ('assume', 'assumption'), ('emphasise', 'emphasis'),
                  ('conclude', 'conclusion')],
                 'Akademiska texter har många substantiv. Ändelserna skiljer sig: analysis och emphasis får -sis, '
                 'assumption -ption och conclusion -sion.'),
            skriv("In academic English, what is the plural of 'phenomenon'?", 'phenomena',
                  'Phenomenon kommer från grekiskan och har pluralen phenomena: one phenomenon, many phenomena.'),
            sant("'Approximately' is more formal than 'about'.", True,
                 'Båda betyder ungefär, men approximately hör hemma i formella texter: approximately 300 people.'),
            val('Which sentence is the most formal?',
                ['The results indicate that the method is effective.',
                 'The results kind of show that the method works.',
                 'The results show the method works, which is great.'],
                'The results indicate that the method is effective.',
                'Indicate och effective är precisa och formella. Kind of och which is great hör till talspråk.'),
            val("Which verb could replace 'went up' in 'Prices went up last year'?", ['rose', 'raised', 'grew up'],
                'rose',
                'Rise – rose – risen betyder stiga och tar inget objekt: prices rose. Raise betyder höja något: '
                'they raised the prices.'),
            ordna('Build the formal sentence: Det här tyder på att unga sover mindre än förr.',
                  ['This', 'suggests', 'that', 'young', 'people', 'sleep', 'less', 'than', 'before.'],
                  forklaring='Suggest betyder här tyda på. Det är försiktigare än show, som påstår mer än man '
                             'kanske kan visa.'),
            skriv("Write the noun that comes from the adjective 'significant'.", 'significance',
                  'Adjektiv på -ant får ofta substantiv på -ance: significant – significance, important – '
                  'importance.'),
            val("Which word means 'följd', the result of an action?", ['consequence', 'consistency', 'convenience'],
                'consequence',
                'Consequence betyder följd. Consistency betyder jämnhet, att vara konsekvent, och convenience '
                'bekvämlighet.'),
        ], beskrivning='Inför provet: akademiska ord, ordbildning och en formell stil, som i en utredande eller '
                       'argumenterande text.'),

        niva('en-gy2-np-ord-och-stil-2', 'Links and idioms', 'NP-träning: ord och stil', [
            val('Choose the linking phrase: The first study found a clear effect. ___, the second study found '
                'none.',
                ['By contrast', 'Similarly', 'Furthermore'], 'By contrast',
                'By contrast visar en skillnad mellan två saker. Similarly visar likhet, och furthermore lägger '
                'till.'),
            val('Choose the linking word: The new method is cheaper than the old one. ___, it is faster, so there '
                'is no reason to keep the old one.',
                ['Moreover', 'Nevertheless', 'Whereas'], 'Moreover',
                'Snabbare är ännu ett skäl åt samma håll som billigare. Moreover, dessutom, lägger till. '
                'Nevertheless visar en motsats.'),
            sant("'On the contrary' means the same as 'in contrast'.", False,
                 'On the contrary betyder tvärtom: It was not boring. On the contrary, it was fascinating. In '
                 'contrast jämför två olika saker.'),
            val("Which word can replace 'therefore' in a formal text?", ['thus', 'though', 'while'], 'thus',
                'Thus betyder därför, alltså. Though betyder fast och while medan.'),
            ordna('Build the sentence: Med tanke på kostnaderna är planen orealistisk.',
                  ['Given', 'the', 'costs,', 'the', 'plan', 'is', 'unrealistic.'],
                  forklaring='Given betyder här med tanke på och står före ett substantiv: given the costs.'),
            val("What does 'a double-edged sword' mean?",
                ['Something that helps and harms at once', 'An argument that is impossible to answer',
                 'A plan that is far too dangerous to try'],
                'Something that helps and harms at once',
                'Ett tveeggat svärd skär åt båda hållen: det har både fördelar och nackdelar. Uttrycket finns '
                'på svenska också.'),
            skriv("Complete the idiom that means 'a small sign of a much bigger problem': the tip of the ___",
                  ['iceberg', 'the tip of the iceberg'],
                  'The tip of the iceberg är toppen av isberget: det mesta av problemet syns inte.'),
            para('Match the idiom with its meaning.',
                 [('food for thought', 'something worth thinking about'),
                  ('a drop in the ocean', 'far too little to make a difference'),
                  ('in the long run', 'over a long period of time'),
                  ("to play devil's advocate", 'to argue for a view you may not hold')],
                 'Idiomen är vanliga i debatter och artiklar. A drop in the ocean heter a drop in the bucket på '
                 'amerikansk engelska.'),
            sant("'To jump on the bandwagon' means to join something because it has become popular.", True,
                 'Bandwagon är vagnen med musikerna i ett festtåg. Den som hoppar på följer med i det som är '
                 'populärt.'),
            val('Which idiom fits? Everyone knew the budget was too small, but nobody wanted to talk about ___.',
                ['the elephant in the room', 'the light at the end of the tunnel', 'the icing on the cake'],
                'the elephant in the room',
                'The elephant in the room är ett uppenbart problem som ingen vill tala om. The icing on the cake '
                'är grädden på moset.'),
        ], beskrivning='Inför provet: sambandsord för kontrast, tillägg och följd, och idiom som ofta används i '
                       'debatter och artiklar.'),
    ]),
]
