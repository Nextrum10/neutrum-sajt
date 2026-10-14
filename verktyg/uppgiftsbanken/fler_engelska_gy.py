# -*- coding: utf-8 -*-
"""Fler nivåer i engelska för gymnasiet (Fas 23.5): Engelska 5, 6 och 7.

Allt står i TILLAGG och läggs sist i banorna en-gy1, en-gy2 och en-gy3
(engelska_mer.py, blad_engelska.py, np_engelska.py). Skrivet från grunden
mot ämnesplanen i engelska, med brittisk stavning. Lästexterna och alla
exempel (Amira Haddad och poolen i Eastfield, skribenten som flyttar till
Sydney) är påhittade för banken; inget är taget ur ett nationellt prov, en
lärobok eller någon annan källa. Skriven med AI och inte läst av en lärare.

- gy1: ”Modala verb och indirekt tal” (must, should, might, had to och
  reported speech) och en kort nyhetsartikel att läsa.
- gy2: ”Ord och nyanser” (kollokationer, och ord med nästan samma betydelse
  men olika klang) och en essä om varieteter av engelska.
- gy3: ”Retoriska grepp” (begreppen, och att känna igen dem i exempel) och
  en essä om engelskans historia.

Förenklat, med flit:
- Indirekt tal frågas bara så att tidsförskjutningen är det som prövas
  (frågan säger det, eller sammanhanget har ändrats): ”He said that he
  lives …” kan vara rätt om det fortfarande gäller, så sådana fall frågas
  inte.
- Kollokationer frågas bara där det finns ett enda naturligt ord i
  brittisk engelska. ”Take/make a decision” och ”have/take a break” godtas
  båda eller frågas inte.
- Språkhistorien om ”cow” och ”beef” står i texten som en förklaring
  historiker ”ofta” ger, inte som ett bevisat faktum.
- Lästexterna på gy2 och gy3 har frågor på engelska, som provets lästexter.
"""
from grund import bana, niva, val, skriv, ordna, sant, para, tal

EN = 'Engelska'


# --- Lästexterna, ett stycke per element -----------------------------

POOLEN = '\n\n'.join([
    'Pool to open late after teenagers’ campaign',
    'The town of Eastfield will keep its swimming pool open until ten o’clock on Friday evenings, after a '
    'group of teenagers collected more than 800 signatures. Until now the pool has closed at six, which many '
    'young people say is too early for anyone who has school or training during the day.',
    'The campaign was started by sixteen-year-old Amira Haddad. “Friday evening is when my friends and I want '
    'to be together,” she said. “We used to go to the shopping centre, but there is nothing to do there if you '
    'do not want to buy anything.”',
    'The council first said no, because late opening would cost about £12,000 a year. After meeting the '
    'teenagers, however, it agreed to try the idea for six months. A spokesperson said that the pool will only '
    'stay open late if enough people come. “If fewer than forty visitors turn up on an average Friday, we will '
    'have to think again,” she said.',
    'The first late opening will take place on 3 November.',
])

VARIETETER = '\n\n'.join([
    'Whose English?',
    'When I moved from Manchester to Sydney at fifteen, I thought I already spoke English. Within a week I had '
    'realised I was wrong. My classmates said ‘arvo’ for afternoon, ‘servo’ for petrol station and ‘no '
    'worries’ for almost everything. I understood the words one by one, but not the conversation.',
    'Linguists make a useful distinction. An accent is the way a person pronounces words; a dialect also '
    'includes vocabulary and grammar. We both had accents, then, but we also spoke different dialects. Neither '
    'was wrong, and neither was ‘better English’, although people often behave as if the version they grew up '
    'with is the real one.',
    'Language also changes with the situation. I do not speak to my grandmother as I speak in a job interview. '
    'Many professions have their own jargon, too: words that make sense to colleagues and sound like a foreign '
    'language to everybody else.',
    'After four years in Australia I sometimes catch myself saying ‘no worries’ in England, and my cousins '
    'laugh. I do not mind. A language is not only a place you come from. It is something you carry, and it can '
    'hold more than one home.',
])

ORDEN_HISTORIA = '\n\n'.join([
    'Where our words come from',
    'Every English sentence is a small museum. Take the words ‘cow’ and ‘beef’. They refer to the same '
    'animal, one in the field and one on the plate, yet they come from different languages. ‘Cow’ is an old '
    'Germanic word, used by the farmers who looked after the animals. ‘Beef’ came from French after the '
    'Norman conquest of 1066, when French-speaking lords ruled England and ate the meat. The same is true of '
    '‘sheep’ and ‘mutton’, and of ‘pig’ and ‘pork’. Historians often explain it this way, although the real '
    'story was probably more complicated.',
    'The Vikings left their mark too. Words such as ‘egg’, ‘sky’ and ‘window’ come from Old Norse, and so do '
    'the small words ‘they’, ‘them’ and ‘their’. It is unusual for a language to borrow such everyday words, '
    'and it suggests that the Vikings and the English lived side by side and mixed.',
    'Borrowing never stopped. ‘Pyjamas’ come from India, ‘ski’ from Norway and ‘tsunami’ from Japan. Some '
    'people fear that English is being damaged by new words. Linguists tend to see the opposite: a language '
    'that borrows is a language that is alive.',
])

# Uppdraget: lästext 600–1200 tecken.
for _t in (POOLEN, VARIETETER, ORDEN_HISTORIA):
    assert 600 <= len(_t) <= 1200, len(_t)
FORTY = 40      # ”fewer than forty” i POOLEN: minst 40
ANTAL_ARET = 1066


TILLAGG = [
    # ================================================================
    # GYMNASIET 1 (Engelska 5)
    # ================================================================
    bana(EN, 'gy1', [
        niva('en-gy1-fler-modals-1', 'Must, should, might', 'Modala verb och indirekt tal', [
            para('Para ihop den engelska meningen med rätt betydelse.',
                 [('You must go.', 'Du måste gå.'), ("You mustn't go.", 'Du får inte gå.'),
                  ("You don't have to go.", 'Du behöver inte gå.'), ('You should go.', 'Du borde gå.')],
                 "Must är ett krav. Mustn't är ett förbud, medan don't have to betyder att man slipper. Should är "
                 'ett råd.'),
            val('Välj rätt: You ___ wear a seat belt in the car. It is the law.',
                ['must', 'might', 'would'], 'must',
                'Lagen kräver det, så det är ett krav. Must uttrycker att något är nödvändigt. Might betyder kanske.'),
            val('Välj rätt: You ___ to see a doctor about that cough.',
                ['ought', 'should', 'must'], 'ought',
                'Ought är ett modalt verb som följs av to: You ought to see a doctor. Should och must följs av '
                'infinitiv utan to.'),
            skriv('Skriv modalverbet som fattas: The lights are on, so he ___ be at home. (Du är nästan säker.)',
                  'must',
                  'Must kan också uttrycka en stark slutsats: ljuset är på, så han måste vara hemma. Might skulle '
                  'betyda att du bara gissar.'),
            val('Välj rätt: The phone is ringing. It ___ be Anna, but I am not sure.',
                ['might', 'must', 'shall'], 'might',
                'Might uttrycker att något är möjligt men osäkert. Must hade betytt att du var nästan säker.'),
            val("Välj rätt: Yesterday I ___ get up at five o'clock.",
                ['had to', 'must', 'have to'], 'had to',
                'Must har ingen dåtidsform. När man talar om det förflutna används had to.'),
            val('Vilken mening är ett erbjudande, alltså ”Ska jag öppna fönstret?”',
                ['Shall I open the window?', 'Do I must open the window?', 'Am I open the window?'],
                'Shall I open the window?',
                'Shall I …? används för att erbjuda hjälp. De andra två är fel: efter must står ingen do, och am I '
                'öppnar inget.'),
            sant("‘I could swim when I was five’ är en korrekt mening om en förmåga i det förflutna.", True,
                 'Could är förmåga i dåtid: Jag kunde simma när jag var fem.'),
            sant("‘Mustn’t’ och ‘don’t have to’ betyder samma sak.", False,
                 "You mustn't park here är ett förbud. You don't have to park here betyder att du kan göra det, "
                 'men inte behöver.'),
            ordna('Bygg meningen: Du borde inte äta så mycket choklad.',
                  ['You', "shouldn't", 'eat', 'so', 'much', 'chocolate.'],
                  forklaring="Shouldn't är negativ form av should och följs av infinitiv utan to. Chocolate går "
                             'inte att räkna, så det heter so much.'),
        ], beskrivning='Tränar must, mustn’t och don’t have to, should och ought to, might och had to.'),

        niva('en-gy1-fler-modals-2', 'She said that …', 'Modala verb och indirekt tal', [
            val('Tom sa till mig: "I will help you." Vilken är den korrekta indirekta formen?',
                ['Tom told me that he would help me.', 'Tom told me that I would help him.',
                 'Tom told me that he will help you.'],
                'Tom told me that he would help me.',
                'I blir he, you blir me, och will blir would. Efter told står vem man talade till: told me.'),
            val('Välj rätt: She ___ me that the shop was closed.',
                ['told', 'said', 'spoke'], 'told',
                'Tell följs av den som får veta något: told me. Say tar inget sådant objekt: She said that the shop '
                'was closed.'),
            skriv('Gör om till indirekt tal och flytta verbet ett steg bakåt i tiden. "We live in Leeds," said '
                  'Ali. → Ali said that they ___ in Leeds. Skriv verbet (live) i rätt form.',
                  'lived',
                  'Vid indirekt tal flyttas verbet ett steg bakåt: present (live) blir preteritum (lived).'),
            val('Maria asked me: "Where do you live?" Vilken är den korrekta indirekta formen?',
                ['Maria asked me where I lived.', 'Maria asked me where did I live.',
                 'Maria asked me where do I live.'],
                'Maria asked me where I lived.',
                'I en återgiven fråga har satsen vanlig ordföljd, utan do eller did. Verbet flyttas bakåt: live '
                'blir lived.'),
            val('Välj rätt ord: He asked me ___ I liked jazz. (Frågan var "Do you like jazz?")',
                ['if', 'that', 'what'], 'if',
                'En ja/nej-fråga återges med if eller whether. That används i återgivna påståenden.'),
            para('Para ihop ordet med vad det ofta blir i indirekt tal.',
                 [('now', 'then'), ('here', 'there'), ('yesterday', 'the day before'), ('tomorrow', 'the next day')],
                 'När man återger något efteråt ändras ord för tid och plats, eftersom talsituationen inte längre är '
                 'densamma.'),
            ordna('Bygg meningen: Han sa att filmen var tråkig.',
                  ['He', 'said', 'that', 'the', 'film', 'was', 'boring.'],
                  forklaring='Verbet står i dåtid efter said that, och filmen var tråkig i det förflutna: the film '
                             'was boring.'),
            sant("‘She told that she was late’ är en korrekt mening.", False,
                 'Efter told måste det stå vem man talade till: She told me that she was late. Utan objekt används '
                 'said: She said that she was late.'),
            skriv('Skriv verbet som fattas: "Please close the door," he said. → He asked me to ___ the door.',
                  'close',
                  'En uppmaning återges med ask someone to och verbet i grundform: He asked me to close the door.'),
            val('"Don\'t be late," the teacher said to us. Vilken är den korrekta indirekta formen?',
                ['The teacher told us not to be late.', 'The teacher told us don’t be late.',
                 'The teacher said us not to be late.'],
                'The teacher told us not to be late.',
                'En uppmaning som förbjuder återges med tell someone not to och infinitiv. Efter said står inget '
                'objekt, så said us är fel.'),
        ], beskrivning='Tränar indirekt tal: said och told, återgivna frågor och uppmaningar, tidsförskjutning och '
                       'ord för tid och plats.'),

        niva('en-gy1-fler-nyhet-1', 'Pool to open late', 'Läsa en nyhet', [
            val('Vad är huvudbudskapet i artikeln?',
                ['Ungdomar fick kommunen att prova att ha poolen öppen sent',
                 'Kommunen har byggt en ny pool åt ungdomar i staden',
                 'Köpcentret ska stänga tidigare på fredagskvällarna'],
                'Ungdomar fick kommunen att prova att ha poolen öppen sent',
                'Rubriken och första stycket säger det: efter ungdomarnas kampanj öppnar poolen sent på fredagar.'),
            skriv('Hur många besökare behövs det minst på en vanlig fredag för att försöket ska få fortsätta? '
                  'Skriv talet.',
                  [tal(FORTY), 'forty', 'fyrtio'],
                  'Det står att om färre än forty besökare kommer en vanlig fredag får kommunen tänka om. Alltså '
                  'behövs minst %d.' % FORTY),
            val('Varför vill Amira och hennes vänner inte vara på köpcentret på fredagskvällar?',
                ['Det finns inget att göra där om man inte vill handla', 'Köpcentret stänger redan klockan sex',
                 'Det kostar för mycket pengar att ta sig dit'],
                'Det finns inget att göra där om man inte vill handla',
                'Amira säger att det inte finns något att göra på köpcentret om man inte vill köpa något. Klockan sex '
                'är det poolen som stänger.'),
            sant('Kommunen sa ja direkt när ungdomarna bad om längre öppettider.', False,
                 'Det står: The council first said no. Först efter ett möte med ungdomarna gick kommunen med på ett '
                 'försök.'),
            val('Varför sa kommunen först nej?',
                ['Sena öppettider skulle kosta pengar varje år', 'Inga ungdomar hade skrivit under något',
                 'Poolen skulle byggas om under hösten'],
                'Sena öppettider skulle kosta pengar varje år',
                'Det står att late opening would cost about £12,000 a year.'),
            val('Vad menar talespersonen med "we will have to think again"?',
                ['Att kommunen kan avsluta försöket om för få kommer',
                 'Att kommunen ska fråga ungdomarna en gång till',
                 'Att poolen ska byggas om till ett större bad'],
                'Att kommunen kan avsluta försöket om för få kommer',
                'Sammanhanget är villkoret: om färre än fyrtio besökare kommer får kommunen fundera på nytt, och '
                'då kan försöket tas bort.'),
            para('Para ihop det engelska ordet med den svenska översättningen.',
                 [('campaign', 'kampanj'), ('signature', 'underskrift'), ('spokesperson', 'talesperson'),
                  ('to cost', 'kosta')],
                 'Orden är vanliga i nyhetstexter: en kampanj samlar underskrifter, en talesperson uttalar sig och '
                 'en åtgärd kostar pengar.'),
            sant('Poolen ska enligt planen vara öppen till klockan tio på fredagskvällar under försöket.', True,
                 'Det står i första stycket: open until ten o’clock on Friday evenings.'),
            ordna('Ordna det som händer i artikeln, från först till sist.',
                  ['Kommunen säger först nej', 'Kommunen möter ungdomarna',
                   'Kommunen går med på ett försök i sex månader', 'Den första sena öppningen äger rum'],
                  forklaring='Kommunen säger nej, möter ungdomarna och går sedan med på ett försök. Den första sena '
                             'kvällen är den 3 november.'),
            val('Vad kan man dra för slutsats om framtiden för de sena öppettiderna?',
                ['Det beror på hur många som kommer under försöket',
                 'De är redan bestämda för alla år framöver',
                 'De är redan inställda på grund av kostnaderna'],
                'Det beror på hur många som kommer under försöket',
                'Försöket gäller sex månader, och poolen stannar bara öppen om tillräckligt många kommer.'),
        ], beskrivning='En kort nyhetsartikel om en kampanj, med frågor om huvudbudskap, detaljer, ord och '
                       'slutsatser.',
            text=POOLEN),
    ]),

    # ================================================================
    # GYMNASIET 2 (Engelska 6)
    # ================================================================
    bana(EN, 'gy2', [
        niva('en-gy2-fler-ord-1', 'Collocations', 'Ord och nyanser', [
            val('Välj rätt verb: She decided to ___ a risk and apply for the job.',
                ['take', 'make', 'do'], 'take',
                'Take a risk är den fasta kombinationen. Verb och substantiv hör ihop på ett sätt som man måste '
                'lära sig som helhet.'),
            val('Välj rätt ord: The forecast says there will be ___ rain tomorrow.',
                ['heavy', 'strong', 'tall'], 'heavy',
                'Regn är heavy, inte strong. Heavy rain, heavy traffic, strong wind och strong coffee är '
                'kollokationer.'),
            val('Välj rätt verb: Please ___ attention to the instructions.',
                ['pay', 'make', 'do'], 'pay',
                'Pay attention är den fasta kombinationen, som på svenska ”ge akt på”.'),
            val('Välj rätt verb: She worked all night to ___ the deadline.',
                ['meet', 'win', 'catch'], 'meet',
                'Meet a deadline betyder att hinna i tid. Det man möter kan också vara a goal eller a need.'),
            para('Para ihop verbet med det ord det hör ihop med.',
                 [('make', 'a mistake'), ('do', 'your homework'), ('take', 'a photo'), ('break', 'the law'),
                  ('catch', 'a cold')],
                 'Svenskan och engelskan väljer verb olika: på engelska gör man en miss (make a mistake), man tar '
                 'ett foto (take) och man fångar en förkylning (catch).'),
            skriv('Skriv ordet som fattas: She always tells the ___, even when it is hard.', 'truth',
                  'Tell the truth är en fast kombination. Man säger också tell a lie och tell a story.'),
            skriv('Skriv verbet som fattas: We cannot wait any longer. It is time to ___ a decision.',
                  ['make', 'take'],
                  'På brittisk engelska går både make a decision och take a decision bra.'),
            sant("‘Make homework’ är en naturlig kombination på engelska.", False,
                 'Man gör läxor på engelska: do homework. Make används för att skapa eller tillverka något.'),
            sant('Kollokationer är ord som ofta förekommer tillsammans, till exempel ‘heavy traffic’.', True,
                 'Kollokationer är kombinationer som låter naturliga för den som har engelska som modersmål. Man kan '
                 'inte alltid räkna ut dem från svenskan.'),
            ordna('Bygg meningen: Vi måste hålla tidsfristen.',
                  ['We', 'must', 'meet', 'the', 'deadline.'],
                  forklaring='På engelska möter man en tidsfrist: meet the deadline. Must följs av infinitiv utan '
                             'to.'),
        ], beskrivning='Tränar kollokationer: verb och substantiv som hör ihop på engelska, som make a mistake, do '
                       'homework och pay attention.'),

        niva('en-gy2-fler-ord-2', 'Shades of meaning', 'Ord och nyanser', [
            val('Vilket av orden har en negativ klang, alltså visar ogillande?',
                ['stubborn', 'determined', 'dedicated'], 'stubborn',
                'Stubborn betyder envis på ett irriterande sätt. Determined och dedicated är positiva: målmedveten och '
                'hängiven.'),
            val('Vilket ord är ett beröm om en person som är försiktig med pengar?',
                ['thrifty', 'stingy', 'greedy'], 'thrifty',
                'Thrifty är positivt: sparsam på ett klokt sätt. Stingy betyder snål, och greedy betyder girig.'),
            para('Para ihop verbet för att titta med dess betydelse.',
                 [('glance', 'titta hastigt'), ('stare', 'stirra, titta länge och fixerat'),
                  ('gaze', 'titta länge med beundran eller drömskt'), ('glare', 'titta ilsket')],
                 'Alla betyder titta, men de visar olika hur länge man tittar och vad man känner.'),
            val('Välj det starkaste ordet: After the marathon she was not just tired but ___.',
                ['exhausted', 'sleepy', 'drowsy'], 'exhausted',
                'Exhausted är en starkare form av tired: helt slut. Sleepy och drowsy betyder sömnig och är mildare.'),
            val('Vilken mening är ett beröm?',
                ['She has a childlike sense of wonder.', 'He is acting in a childish way.',
                 'That was a very childish joke.'],
                'She has a childlike sense of wonder.',
                'Childlike är positivt: nyfiken och förundrad som ett barn. Childish är negativt: barnslig på ett '
                'irriterande sätt.'),
            skriv('Skriv verbet: att gå långsamt och lugnt, utan brådska, för nöjes skull.',
                  ['stroll', 'amble', 'saunter'],
                  'Stroll betyder att promenera lugnt och avslappnat. Amble och saunter är nära synonymer.'),
            val('"Leave me alone!" he ___, and slammed the door.',
                ['snapped', 'whispered', 'chuckled'], 'snapped',
                'Snapped visar att han sa det argt och kort. Whispered är viska och chuckled är skratta tyst.'),
            sant('Ord med nästan samma betydelse kan ändå ge olika intryck, till exempel ‘cheap’ och '
                 '‘inexpensive’.', True,
                 'Cheap kan antyda dålig kvalitet, medan inexpensive bara säger att det är billigt. Det kallas '
                 'olika konnotationer.'),
            sant("‘Laugh’ och ‘giggle’ betyder alltid exakt samma sak.", False,
                 'Giggle är ett litet, ljust och ofta nervöst skratt. Laugh är det vanliga ordet för alla sorters '
                 'skratt.'),
            ordna('Bygg meningen: Hon kastade en hastig blick på klockan.',
                  ['She', 'glanced', 'at', 'the', 'clock.'],
                  forklaring='Glance at betyder att titta hastigt på något, som i en hastig blick.'),
        ], beskrivning='Tränar nyanser i betydelse: ord som nästan betyder samma sak men låter positivt, negativt, '
                       'starkt eller milt.'),

        niva('en-gy2-fler-varieteter-1', 'Whose English?', 'Engelskans varieteter', [
            val('Why did the writer find it hard to follow the conversations in Sydney?',
                ['The classmates used words and expressions the writer did not know',
                 'The classmates spoke much faster than people in Manchester',
                 'The writer had never learned English at school'],
                'The classmates used words and expressions the writer did not know',
                'Det står I understood the words one by one, but not the conversation. Orden som arvo och servo var '
                'nya.'),
            val('According to the text, what is the difference between an accent and a dialect?',
                ['An accent is about pronunciation; a dialect also covers vocabulary and grammar',
                 'An accent covers vocabulary and grammar; a dialect is only about pronunciation',
                 'An accent is spoken English, while a dialect is written English'],
                'An accent is about pronunciation; a dialect also covers vocabulary and grammar',
                'Texten säger att accent är hur man uttalar orden, och att en dialekt dessutom omfattar ordförråd och '
                'grammatik.'),
            sant('The writer claims that the English spoken in Manchester is better than the English spoken in '
                 'Sydney.', False,
                 'Det står att ingen av varieteterna var wrong, och att ingen heller var ‘better English’.'),
            val('Why does the writer mention the grandmother and the job interview?',
                ['To show that people also change how they speak depending on the situation',
                 'To show that older people speak better English than young people',
                 'To explain why job interviews are difficult for teenagers'],
                'To show that people also change how they speak depending on the situation',
                'Det står Language also changes with the situation. Man talar inte med mormor som på en '
                'anställningsintervju.'),
            val('What does the writer mean by saying that a language "can hold more than one home"?',
                ['A person can feel at home in more than one way of speaking',
                 'A language needs several houses to survive',
                 'Everybody should live in at least two countries'],
                'A person can feel at home in more than one way of speaking',
                'Skribenten har ett språk som rymmer både Manchester och Sydney. Språket är något man bär med sig, '
                'inte bara en plats.'),
            val('How does the writer react when the cousins laugh?',
                ['In a relaxed way: the writer does not mind', 'With embarrassment, and hides the Australian words',
                 'With anger, and refuses to visit England again'],
                'In a relaxed way: the writer does not mind',
                'Det står My cousins laugh. I do not mind. Tonen är lugn och lättsam.'),
            skriv('Which Australian expression does the writer still use in England? Write the two words.',
                  ['no worries'],
                  'Det står att skribenten ibland säger ‘no worries’ i England, och att kusinerna skrattar.'),
            sant('The text says that jargon can be hard to understand for people outside a profession.', True,
                 'Det står att jargong är ord som är begripliga för kollegor men låter som ett främmande språk för alla '
                 'andra.'),
            para('Match the expression with its meaning.',
                 [('arvo', 'afternoon'), ('servo', 'petrol station'),
                  ('no worries', 'a friendly phrase used for almost everything'),
                  ('jargon', 'special words used within a profession')],
                 'Arvo, servo och no worries är australiska uttryck i texten. Jargon är ett allmänt ord för yrkesspråk.'),
            ordna("Put the writer's experiences in the order they are told.",
                  ['Moves from Manchester to Sydney at fifteen', 'Notices that classmates use unfamiliar words',
                   'Spends four years in Australia', 'Says "no worries" in England and is laughed at'],
                  forklaring='Texten börjar med flytten och de första dagarna, och slutar fyra år senare med kusinerna '
                             'som skrattar.'),
        ], beskrivning='En essä om accent, dialekt och jargong, med frågor om vad som sägs, hur det sägs och vad '
                       'skribenten menar.',
            text=VARIETETER),
    ]),

    # ================================================================
    # GYMNASIET 3 (Engelska 7)
    # ================================================================
    bana(EN, 'gy3', [
        niva('en-gy3-fler-retorik-1', 'Rhetorical devices', 'Retoriska grepp', [
            para('Para ihop det retoriska greppet med dess förklaring.',
                 [('rhetorical question', 'en fråga som ställs för effekten, inte för att få svar'),
                  ('hyperbole', 'en medveten överdrift'), ('understatement', 'en medveten förminskning'),
                  ('repetition', 'samma ord eller fras upprepas för eftertryck'),
                  ('rule of three', 'tre led i rad för rytm och minnesvärdhet')],
                 'Retoriska grepp används för att påverka hur ett budskap tas emot, inte bara vad som sägs.'),
            para('Para ihop begreppet med vad det vädjar till.',
                 [('ethos', 'talarens trovärdighet'), ('pathos', 'publikens känslor'),
                  ('logos', 'förnuft, fakta och logik')],
                 'De tre klassiska bevismedlen: ethos är karaktär och trovärdighet, pathos känslor och logos förnuft.'),
            val('Vilket grepp används i "This is the worst day in the history of the world"?',
                ['hyperbole', 'understatement', 'irony'], 'hyperbole',
                'Det är en medveten överdrift. Understatement är raka motsatsen: att förminska något stort.'),
            val('Efter att stormen förstört halva byn kallar bonden det "a bit of bad weather". Vilket grepp är det?',
                ['understatement', 'hyperbole', 'alliteration'], 'understatement',
                'Bonden gör något mycket stort till något litet. Det kallas understatement och används ofta för '
                'torr humor.'),
            val('Vilken mening innehåller alliteration?',
                ['The wind whistled through the willows.', 'The wind was as cold as ice.',
                 'The wind was strong enough to move a car.'],
                'The wind whistled through the willows.',
                'Alliteration är samma begynnelseljud i närliggande ord: wind, whistled, willows.'),
            val('En läkare börjar ett tal med "I have treated young patients for twenty years". Vilken sorts '
                'vädjan är det?',
                ['ethos', 'pathos', 'logos'], 'ethos',
                'Läkaren visar sin erfarenhet för att bli trodd. Det bygger talarens trovärdighet.'),
            skriv('Skriv det engelska ordet: en fråga som ställs för effekten och inte för att få svar kallas en '
                  'rhetorical ___.',
                  ['question', 'questions'],
                  'En retorisk fråga får publiken att tänka efter, men talaren väntar sig inget svar.'),
            sant('En retorisk fråga är en fråga som talaren förväntar sig att publiken svarar på högt.', False,
                 'Svaret är oftast uppenbart, och frågan ställs för att väcka tanke eller känsla.'),
            sant('Upprepning kan göra ett budskap lättare att komma ihåg.', True,
                 'Det som upprepas fastnar. Därför återkommer samma ord eller fras ofta i tal.'),
            ordna('Bygg den retoriska frågan: Vem ska göra något om inte vi?',
                  ['Who', 'will', 'act', 'if', 'we', 'do', 'not?'],
                  forklaring='Who will act if we do not? är en retorisk fråga: svaret är att ingen annan kommer att '
                             'göra det.'),
        ], beskrivning='Tränar retoriska grepp: retorisk fråga, överdrift, förminskning, upprepning, '
                       'alliteration och ethos, pathos och logos.'),

        niva('en-gy3-fler-retorik-2', 'Spot the technique', 'Retoriska grepp', [
            val('I ett tal står: "We will not stay silent. We will not look away. We will not give up." Vilket grepp '
                'används främst?',
                ['Anaphora, där samma ord inleder flera meningar',
                 'Hyperbole, där talaren överdriver medvetet',
                 'Irony, där talaren menar motsatsen till det sagda'],
                'Anaphora, där samma ord inleder flera meningar',
                'Tre meningar börjar med We will not. Upprepningen i början ger rytm och eftertryck.'),
            val('Texten säger: "I just love waiting two hours in the rain. It is the highlight of my week." '
                'Vilket grepp används?',
                ['Irony: the speaker says the opposite of what is meant',
                 'Alliteration: the same sound begins several words',
                 'Rule of three: the speaker lists three items'],
                'Irony: the speaker says the opposite of what is meant',
                'Talaren tycker inte om att vänta i regnet. Hen säger motsatsen för att visa sitt missnöje.'),
            para('Vilken sorts vädjan är det? Para ihop meningen med begreppet.',
                 [('I have coached young athletes for thirty years.', 'ethos'),
                  ('Imagine a child waiting alone at the window.', 'pathos'),
                  ('Last year the number of accidents fell by a third.', 'logos')],
                 'Erfarenheten bygger trovärdighet (ethos), bilden av barnet väcker känslor (pathos) och siffran är '
                 'ett sakargument (logos).'),
            val('Varför använder en talare en fråga som "Can we really keep ignoring this?"',
                ['För att få publiken att tänka efter och känna att svaret är givet',
                 'För att publiken ska svara högt, en och en',
                 'För att slippa ta ställning i frågan'],
                'För att få publiken att tänka efter och känna att svaret är givet',
                'En retorisk fråga drar in publiken i resonemanget. Talaren väntar sig inget svar, för svaret '
                'framgår redan av frågan.'),
            val('Vilken mening bygger på kontrast i två balanserade delar (antites)?',
                ['It is easy to begin, but hard to finish.', 'The sun shone, and the sky was blue.',
                 'Who will help us now?'],
                'It is easy to begin, but hard to finish.',
                'Easy och hard ställs mot varandra i två lika uppbyggda delar. I de andra två finns ingen kontrast.'),
            val('Vilket tillägg skulle mest stärka logos i argumentet att egna bussfiler minskar förseningar?',
                ['En jämförelse av restider före och efter att bussfilerna öppnades',
                 'En gripande berättelse om en arg pendlare',
                 'Ett citat av en känd person som gillar bussar'],
                'En jämförelse av restider före och efter att bussfilerna öppnades',
                'Logos bygger på fakta och logik. Berättelsen vädjar till känslor (pathos) och den kända personen till '
                'trovärdighet (ethos), men siffror visar om bussfilerna verkligen minskar förseningarna.'),
            skriv('Kaptenen tittar på det sjunkande skeppet och säger: "We seem to have a small problem." Vilket '
                  'grepp förminskar här något stort? Skriv termen på engelska.',
                  ['understatement', 'an understatement'],
                  'Understatement betyder att man medvetet gör något stort till något litet, ofta för komisk eller '
                  'torr effekt.'),
            sant('Om en talare överdriver hela tiden kan det minska trovärdigheten.', True,
                 'Publiken slutar tro på talaren om allt är det största, värsta eller bästa någonsin.'),
            sant('Pathos betyder att talaren ljuger för att påverka publiken.', False,
                 'Pathos är en vädjan till känslor. Det kan vara ärligt eller oärligt, men det är inte samma sak som '
                 'att ljuga.'),
            ordna('Ordna delarna i ett kort tal från början till slut.',
                  ['Catch the audience’s attention', 'State your main point', 'Support it with reasons and evidence',
                   'End with a call to action'],
                  forklaring='Ett tal börjar med att fånga uppmärksamheten, säger sin poäng, stöder den med skäl och '
                             'belägg och slutar med en uppmaning.'),
        ], beskrivning='Tränar att känna igen retoriska grepp i exempel och att tänka på deras effekt.'),

        niva('en-gy3-fler-historia-1', 'Where our words come from', 'Engelskans historia', [
            val('How does the text explain that English has both "cow" and "beef"?',
                ['"Cow" comes from the farmers’ Germanic language and "beef" from the French-speaking lords',
                 '"Cow" is a British word and "beef" is an American word',
                 '"Cow" is a verb and "beef" is a noun'],
                '"Cow" comes from the farmers’ Germanic language and "beef" from the French-speaking lords',
                'Efter 1066 talade herrarna franska och åt köttet, medan bönderna med sitt germanska språk skötte '
                'djuren.'),
            sant('The text says that "they", "them" and "their" come from Old Norse.', True,
                 'Det står: so do the small words ‘they’, ‘them’ and ‘their’.'),
            val('What does the writer mean by calling an English sentence "a small museum"?',
                ['It contains words that come from many different periods and peoples',
                 'It is kept safely and must never be changed',
                 'It is short but very old-fashioned'],
                'It contains words that come from many different periods and peoples',
                'Liknelsen med ett museum visar att en vanlig mening rymmer ord med olika ursprung och ålder.'),
            val('What does the borrowing of everyday words like "they" suggest about the Vikings and the English?',
                ['That the two groups lived close together and mixed',
                 'That the Vikings ruled England for a thousand years',
                 'That the English avoided the Vikings’ language'],
                'That the two groups lived close together and mixed',
                'Det står att det är ovanligt att låna så vardagliga ord, och att det tyder på att vikingarna och '
                'engelsmännen levde sida vid sida och blandades.'),
            para('Match the word with the country it comes from, according to the text.',
                 [('ski', 'Norway'), ('pyjamas', 'India'), ('tsunami', 'Japan')],
                 'Lånord har kommit från hela världen. Texten nämner just de här tre som exempel.'),
            skriv('In which year did the Norman conquest take place, according to the text? Write the year.',
                  tal(ANTAL_ARET),
                  'Det står after the Norman conquest of %d.' % ANTAL_ARET),
            val("What is the writer's conclusion about borrowed words?",
                ['A language that borrows words is alive, not damaged',
                 'English would be better without foreign words',
                 'Borrowed words should be replaced by Germanic ones'],
                'A language that borrows words is alive, not damaged',
                'Sista meningen säger: a language that borrows is a language that is alive.'),
            val('How does the writer treat the explanation of "cow" and "beef"?',
                ['Carefully: it is "often explained" this way, but the real story was probably more complicated',
                 'As a proven fact that no historian has ever doubted',
                 'As a myth that has been shown to be false'],
                'Carefully: it is "often explained" this way, but the real story was probably more complicated',
                'Skribenten skriver historians often explain it this way, although the real story was probably more '
                'complicated. Det är en försiktig formulering.'),
            sant('According to the text, "pork" is a Germanic word that farmers used.', False,
                 'Det står att pork, liksom beef och mutton, kom från franskan. Det var bönderna som sa ‘pig’.'),
            ordna('Put the topics in the order they appear in the text.',
                  ['Cow and beef', 'Egg, sky and window', 'Pyjamas, ski and tsunami',
                   'The linguists’ view of new words'],
                  forklaring='Texten går från franskan och bönderna, via vikingarna, till nyare lånord och slutar med '
                             'språkforskarnas syn på nya ord.'),
        ], beskrivning='En essä om var engelska ord kommer ifrån, med frågor om förklaringar, bildspråk och '
                       'skribentens slutsats.',
            text=ORDEN_HISTORIA),
    ]),
]
