# -*- coding: utf-8 -*-
"""Fortsättningen i engelska för åk 6 och 7 (2026-10-27). Leo: "Nexläx där
ska vi lägga in flera uppgifter, i matte svenska och engelska årkurs 6 och
uppåt." Sex nya nivåer i varje bana, i tre nya områden om två nivåer:

  åk 6  Datum och klockan (räkneord, ordningstal, datum, past och to)
        Ägande och genitiv (my, their, its, Tom's, the girls')
        Handla och hitta vägen (fraser i affären och på stan, och en lästext)
  åk 7  Present perfect (have seen, ever, yet, since, gone och been)
        Some, any, much och many (räknebart och oräknebart)
        Brittisk och amerikansk engelska (ord, stavning, och en lästext)

Banan saknade de här delarna av det centrala innehållet i Lgr22 (4–6:
vardagliga situationer, artighetsfraser, instruktioner och beskrivningar,
grammatiska strukturer; 7–9: grammatiska strukturer och engelskans olika
varianter). De två första områdena i varje bana har två vanliga nivåer, som
dras till områdets Mästarprov. Det tredje har en vanlig nivå och en med
lästext, och får därför inget Mästarprov.

Samma regler som i fler_engelska_hog.py: instruktionerna är på svenska och
exempelmeningarna på engelska (brittisk stavning utom där frågan gäller
amerikansk engelska), förklaringarna på svenska. Varje fråga går att förstå
ensam, utom frågorna till en lästext. En skriv-fråga har ett enda rimligt
svar eller alla rimliga varianter, en ordna-fråga bara en rätt ordning.
Lästexterna är påhittade och skrivna för banken.

Skriven med AI och inte läst av en lärare."""
from grund import bana, niva, val, skriv, ordna, sant, para, tal

# ---- Åk 6: lästexten ----

MAYAS_MEJL = '\n\n'.join([
    'Hi Lukas,',
    'I am so happy that you can come to my party on Saturday! It starts at three o’clock. Here is '
    'the way from the station to my house.',
    'When you come out of the station, turn left and go straight on along King Street. Walk past '
    'the post office and the big park. At the traffic lights, turn right into Mill Road. My house is '
    'the third one on the left. It has a blue door and a small apple tree in the garden. If you see '
    'the swimming pool, you have gone too far!',
    'Could you do something for me on the way? There is a small shop on the corner of King Street '
    'and Mill Road, opposite the bus stop. Please buy two bottles of apple juice. They cost 20 '
    'kronor each. My mum has already bought the cake, so you don’t have to bring any food.',
    'The walk takes about ten minutes. If you get lost, ring me. My number is on the invitation.',
    'See you on Saturday!',
    'Maya',
])

# ---- Åk 7: lästexten ----

ELSAS_MEJL = '\n\n'.join([
    'Hi Olivia,',
    'We have lived in Boston for three weeks now, and I still feel like a tourist. Everybody speaks '
    'English, of course, but it isn’t always the English we learnt in London!',
    'On my first day at school, a girl in my class told me that she liked my pants. I went as red '
    'as a tomato, because in London pants are something you wear under your trousers! Here, the word '
    'pants just means trousers.',
    'Our new home is an apartment, not a flat, and we live on the third floor. In London, that '
    'would be the second floor, because here the ground floor is called the first floor. The first '
    'time I took the elevator, I got out on the wrong floor.',
    'There are other differences too. People stand in line instead of queuing, and my little '
    'brother Sam now says “cookie” instead of “biscuit”. At school we have math, not maths, and '
    'when my class sang the alphabet, everybody said “zee” at the end. I said “zed”, and the whole '
    'class laughed – in a nice way.',
    'The funniest thing was the date on my first test. I wrote 4/10, and my teacher thought I meant '
    'the tenth of April. Here they write the month first!',
    'Mum says we will soon speak like real Americans. I hope not – I want to keep a little bit of '
    'London.',
    'Write soon and tell me everything!',
    'Elsa',
])

TILLAGG = [
    bana('Engelska', 'ak6', [
        niva('en-ak6-datum-klockan-1', 'First, second, third', 'Datum och klockan', [
            val("Vilket tal är 'thirteen'?", ['13', '30', '3'], '13',
                'Ändelsen -teen används för talen 13 till 19, så thirteen är 13. Tiotalen från 20 och '
                'uppåt slutar i stället på -ty: thirty är 30.'),
            val('Hur skrivs talet 40 med bokstäver på engelska?', ['forty', 'fourty', 'fourteen'], 'forty',
                'Four stavas med u, men fyrtio stavas utan: forty. Fourteen är 14.'),
            skriv('Skriv ordet som betyder första: It was my ___ day at the new school.', ['first', '1st'],
                  'Första heter first. Ordningstalen för 1, 2 och 3 är oregelbundna: first, second och '
                  'third.'),
            val('Hur stavas ordningstalet tolfte på engelska?', ['twelfth', 'twelveth', 'twelvth'], 'twelfth',
                'Twelve tappar ve och får f före -th: twelfth. Samma sak händer med five, som blir fifth.'),
            para('Para ihop talet med ordningstalet.',
                 [('1', 'first'), ('2', 'second'), ('3', 'third'), ('5', 'fifth')],
                 'De tre första ordningstalen är oregelbundna: first, second och third. Sedan får talen '
                 '-th, som fourth, och five blir fifth.'),
            sant('Månader och veckodagar skrivs med stor bokstav på engelska, till exempel Monday och May.',
                 True,
                 'På svenska skriver vi måndag och maj med liten bokstav, men på engelska börjar namnen på '
                 'dagar och månader alltid med stor bokstav.'),
            val('Hur säger man datumet 21/6 på engelska?',
                ['the twenty-first of June', 'the twenty-one of June', 'the twentieth-first of June'],
                'the twenty-first of June',
                'I ett datum används ordningstal. Bara den sista delen av talet blir ordningstal: '
                'twenty-one blir twenty-first.'),
            skriv('Skriv ordningstalet för 3 med bokstäver: My birthday is on the ___ of March.',
                  ['third', '3rd'],
                  'Tre heter three, men den tredje heter third. Ordningstalet för 3 är oregelbundet, precis '
                  'som first och second.'),
            # Utan on (granskningen 2026-10-27): med on bland brickorna gick också
            # "My birthday is the fifth of May." att bygga, och den är rätt men nekades.
            ordna('Bygg meningen: Min födelsedag är den femte maj.',
                  ['My', 'birthday', 'is', 'the', 'fifth', 'of', 'May.'], extra=['five'],
                  forklaring='Ett datum säger man med ordningstal: the fifth of May, inte the five of May.'),
            val("Vad betyder 'the second Monday in May'?",
                ['den andra måndagen i maj', 'två måndagar i maj', 'måndagen den andra maj'],
                'den andra måndagen i maj',
                'Second är ordningstalet andra. The second Monday in May är alltså den andra måndagen i '
                'maj. Den andra maj hade hetat the second of May.'),
        ], beskrivning='Räkneord och ordningstal: thirteen och thirty, first och twelfth, och hur man '
                       'säger ett datum på engelska.'),

        niva('en-ak6-datum-klockan-2', 'Quarter past, twenty to', 'Datum och klockan', [
            val("Vad är klockan när den är 'quarter past seven'?", ['7.15', '6.45', '7.45'], '7.15',
                'Quarter är en kvart och past betyder över. Quarter past seven är en kvart över sju, 7.15.'),
            val("Vad är klockan när den är 'twenty to nine'?", ['8.40', '9.20', '8.20'], '8.40',
                'To betyder i, alltså före hela timmen. Twenty to nine är tjugo i nio, 8.40.'),
            skriv("Klockan är 10.30. Skriv ordet som saknas: It's half ___ ten.", 'past',
                  'Engelskan räknar från timmen som har varit: half past ten är en halvtimme efter tio. På '
                  'svenska säger vi halv elva om samma tid.'),
            sant("'Half past six' är samma tid som halv sju på svenska.", True,
                 'Half past six är en halvtimme efter sex, 6.30, och det är halv sju på svenska. Engelskan '
                 'räknar från sex och svenskan mot sju, men tiden är densamma.'),
            val("Vilken tid är '3 p.m.'?", ['15.00', '3.00 på natten', '13.00'], '15.00',
                'P.m. används om tiden efter klockan tolv mitt på dagen. 3 p.m. är tre på eftermiddagen, '
                '15.00. Tre på natten hade varit 3 a.m.'),
            val('Klockan är 8.55. Vilken mening säger rätt tid?',
                ["It's five to nine.", "It's five past nine.", "It's five to eight."], "It's five to nine.",
                '8.55 är fem minuter före nio. Före hela timmen säger man to: five to nine.'),
            skriv("Skriv ordet som saknas: The film starts ___ seven o'clock. (Filmen börjar klockan sju.)",
                  'at',
                  "Före ett klockslag står at: at seven o'clock, at half past three."),
            para('Para ihop klockslaget med tiden.',
                 [('quarter to four', '3.45'), ('quarter past four', '4.15'), ('half past four', '4.30'),
                  ('ten to four', '3.50')],
                 'Past betyder över och to betyder i. Quarter to four är en kvart i fyra, 3.45, och ten to '
                 'four är tio i fyra, 3.50.'),
            ordna('Bygg frågan: Vad är klockan?', ['What', 'time', 'is', 'it?'], extra=['clock'],
                  forklaring='På engelska frågar man efter tiden, time: What time is it? Clock är själva '
                             'klockan, så What clock is it? blir fel.'),
            val('Vilken mening är rätt?',
                ['We have a test on Friday.', 'We have a test in Friday.', 'We have a test at Friday.'],
                'We have a test on Friday.',
                'Före veckodagar och datum står on: on Friday, on 5 May. At används före klockslag och in '
                'före månader och år.'),
        ], beskrivning='Klockan på engelska: past och to, quarter och half, a.m. och p.m., och små ord '
                       'som at och on före tider och dagar.'),

        niva('en-ak6-agande-1', 'My, her, their', 'Ägande och genitiv', [
            val('Välj rätt ord: Emma loves ___ dog. (Emma älskar sin hund.)', ['her', 'his', 'she'], 'her',
                'Engelskan har inget ord för sin. Hunden är Emmas, och Emma är en flicka, så det blir her. '
                'His används när ägaren är en pojke, och she är inget ägandeord.'),
            val('Välj rätt ord: Tom and Ali are cleaning ___ room. (Tom och Ali städar sitt rum.)',
                ['their', 'there', 'they'], 'their',
                'Ägarna är två, they, och då heter det their. There betyder där och låter likadant, men '
                'det säger inget om vems rummet är.'),
            skriv('Skriv rätt ord: We love ___ new teacher. (Vi älskar vår nya lärare.)', 'our',
                  'Vår och vårt heter our på engelska. Our används när ägarna är we.'),
            val('Välj rätt ord: The bird is building ___ nest. (Fågeln bygger sitt bo.)',
                ['its', "it's", 'it'], 'its',
                "Its utan apostrof betyder dess eller sin och används om djur och saker. It's med apostrof "
                'är en kortform av it is.'),
            sant("På engelska finns inget eget ord för sin. 'Anna tar sin väska' blir 'Anna takes her bag'.",
                 True,
                 'I stället för sin väljer man ord efter vem som äger saken: his för en pojke, her för en '
                 'flicka, its för ett djur eller en sak och their för flera.'),
            val("Hur säger man 'Erik tvättar sin cykel' på engelska?",
                ['Erik washes his bike.', 'Erik washes her bike.', 'Erik washes its bike.'],
                'Erik washes his bike.',
                'Erik är en pojke, så sin blir his. Her bike hade betytt hennes cykel, alltså någon annans.'),
            para('Para ihop det svenska ordet med det engelska.',
                 [('min', 'my'), ('din', 'your'), ('hans', 'his'), ('vår', 'our'), ('deras', 'their')],
                 'My är min, your är din och his är hans. Our är vår och their är deras.'),
            skriv('Skriv rätt ord: Sara, are these ___ shoes? (dina)', 'your',
                  'Det är den man pratar med som äger skorna, och då heter det your. Your betyder både din, '
                  'ditt och dina.'),
            ordna('Bygg meningen: Mina föräldrar älskar sin trädgård.',
                  ['My', 'parents', 'love', 'their', 'garden.'], extra=['his'],
                  forklaring='Ägarna är föräldrarna, alltså flera personer. Då blir sin their.'),
            val('Välj rätt ord: ___ name is Max. He is my cousin.', ['His', 'He', "He's"], 'His',
                "Det handlar om vems namnet är, och då behövs ägandeordet his. He's betyder he is, och "
                'he name går inte.'),
        ], beskrivning='Ord som säger vems något är: my, your, his, her, its, our och their, och hur '
                       'engelskan säger sin.'),

        niva('en-ak6-agande-2', "Tom's bike, the girls' room", 'Ägande och genitiv', [
            val("Hur säger man 'Toms cykel' på engelska?", ["Tom's bike", 'Toms bike', 'Tom bike'],
                "Tom's bike",
                "På engelska får ägaren apostrof och s: Tom's bike. På svenska skriver vi Toms utan "
                'apostrof, men på engelska behövs den.'),
            val("Två flickor delar ett rum. Hur skriver man 'flickornas rum'?",
                ["the girls' room", "the girl's room", 'the girls room'], "the girls' room",
                "Girls är plural och slutar redan på s. Då sätter man bara en apostrof efter s:et: the "
                "girls' room. The girl's room är en enda flickas rum."),
            sant("'The boy's toys' handlar om leksaker som flera pojkar äger.", False,
                 "Apostrofen står före s, så det är en enda pojke: the boy's toys är pojkens leksaker. "
                 "Flera pojkars leksaker skrivs the boys' toys."),
            skriv('Skriv med apostrof och s: the car that belongs to my dad = my ___ car', ["dad's"],
                  "Bilen är pappans, så dad får apostrof och s: my dad's car, min pappas bil."),
            val("Hur skriver man 'barnens rum' på engelska?",
                ["the children's room", "the childrens' room", 'the childrens room'],
                "the children's room",
                "Children är plural men slutar inte på s. Då får ordet apostrof och s, precis som i "
                "singular: the children's room."),
            val('Vilken mening är rätt?', ["It's Anna's book.", "Its Anna's book.", "It's Annas book."],
                "It's Anna's book.",
                "It's betyder it is och behöver apostrof. Anna's får också apostrof, för boken är Annas."),
            skriv("Svara med genitiv: Whose pen is this? – It's ___. (Saras)", ["Sara's", "Sara's pen"],
                  "Whose betyder vems, och svaret är ägaren med apostrof och s: Sara's. Man kan också säga "
                  "Sara's pen."),
            para('Para ihop det engelska med det svenska.',
                 [("my brother's room", 'min brors rum'), ("my brothers' room", 'mina bröders rum'),
                  ("my sister's dog", 'min systers hund'), ("my sisters' dog", 'mina systrars hund')],
                 "Står apostrofen före s finns det en ägare: my brother's. Står den efter s finns det "
                 "flera: my brothers'."),
            ordna('Bygg meningen: Det här är min mammas telefon.', ['This', 'is', 'my', "mum's", 'phone.'],
                  extra=['mums'],
                  forklaring="Telefonen är mammans, så mum får apostrof och s: my mum's phone."),
            val("Välj rätt ord: ___ jacket is this? – It's Omar's.", ['Whose', "Who's", 'Who'], 'Whose',
                "Whose betyder vems. Who's låter likadant men betyder who is, vem är."),
        ], beskrivning="Genitiv med apostrof: Tom's bike, the girls' room och the children's room, och "
                       "skillnaden mellan whose och who's."),

        niva('en-ak6-handla-vagen-1', 'Can I have ...? Turn left!', 'Handla och hitta vägen', [
            val('Du vill köpa en glass i en kiosk. Vad är artigast att säga?',
                ['Can I have an ice cream, please?', 'Give me an ice cream right now, okay?',
                 'I take one ice cream, thanks.'],
                'Can I have an ice cream, please?',
                'Can I have ..., please? är ett vanligt och artigt sätt att be om något. Give me låter som '
                'en order, och I take är översatt ord för ord från svenskan.'),
            val("Expediten ger dig varan och säger 'Here you are.' Vad betyder det?",
                ['Varsågod', 'Här är du', 'Vem är du?'], 'Varsågod',
                'Here you are säger man när man räcker över något. Det betyder varsågod, inte här är du.'),
            skriv("Skriv ordet som saknas: How ___ is this T-shirt? – It's 150 kronor.",
                  ['much', 'expensive'],
                  'Om priset frågar man How much is it? eller How much does it cost? Pengar räknar man inte '
                  'styck för styck, och då heter det much. How expensive is it? går också.'),
            sant("'Turn right' betyder sväng till höger.", True,
                 'Right betyder höger och left betyder vänster. Turn right är alltså sväng till höger.'),
            val("Vad betyder 'Go straight on'?", ['Gå rakt fram', 'Gå tillbaka igen', 'Stanna här'],
                'Gå rakt fram',
                'Straight betyder rak, och go straight on betyder fortsätt rakt fram. Amerikaner säger '
                'oftare go straight ahead.'),
            val("Vad betyder 'The bank is opposite the library'?",
                ['Banken ligger mitt emot biblioteket', 'Banken ligger bredvid biblioteket',
                 'Banken ligger precis bakom biblioteket'],
                'Banken ligger mitt emot biblioteket',
                'Opposite betyder mitt emot, på andra sidan gatan. Bredvid heter next to och bakom heter '
                'behind.'),
            para('Para ihop uttrycket med det svenska.',
                 [('next to', 'bredvid'), ('between', 'mellan'), ('on the corner', 'på hörnet'),
                  ('turn left', 'sväng till vänster')],
                 'Next to är bredvid och between är mellan. On the corner är på hörnet, och turn left är '
                 'sväng till vänster.'),
            ordna('Bygg frågan: Ursäkta, var ligger stationen?',
                  ['Excuse', 'me,', 'where', 'is', 'the', 'station?'], extra=['are'],
                  forklaring='Excuse me är ett artigt sätt att börja när man vill fråga någon något. Efter '
                             'where kommer is, för det är en station.'),
            skriv("Expediten frågar 'Can I help you?' men du vill bara titta. Skriv ordet som saknas: "
                  "No thanks, I'm just ___.",
                  ['looking', 'looking around', 'browsing'],
                  "I'm just looking betyder jag tittar bara. Det är det vanliga svaret när man inte behöver "
                  'hjälp.'),
            val('Vilket svar passar? Is there a supermarket near here?',
                ['Yes, there is one on Park Street.', 'Yes, I do like it on Park Street.',
                 'No, I am not near Park Street.'],
                'Yes, there is one on Park Street.',
                "Frågan börjar med Is there, finns det. Då svarar man Yes, there is eller No, there isn't, "
                'och berättar gärna var.'),
        ], beskrivning='Fraser i affären och på stan: be om något artigt, fråga vad det kostar och förstå '
                       'en vägbeskrivning med left, right och opposite.'),

        niva('en-ak6-handla-vagen-2', "The way to Maya's house", 'Handla och hitta vägen', [
            val('Vad ska Lukas göra först när han kommer ut från stationen?',
                ['Svänga till vänster', 'Svänga till höger', 'Gå över gatan', 'Ta bussen'],
                'Svänga till vänster',
                'Det står When you come out of the station, turn left. Left betyder vänster.'),
            sant('Lukas ska gå förbi postkontoret och den stora parken.', True,
                 'Det står Walk past the post office and the big park. Walk past betyder gå förbi.'),
            val('Vilket hus på Mill Road är Mayas?',
                ['Det tredje på vänster sida', 'Det tredje på höger sida', 'Det första på vänster sida',
                 'Huset mitt emot simhallen'],
                'Det tredje på vänster sida',
                'Det står My house is the third one on the left. Third är tredje och on the left är på '
                'vänster sida.'),
            skriv('Vilken färg har dörren till Mayas hus? Skriv färgen på engelska.', 'blue',
                  'Det står It has a blue door. Blue är blå.'),
            val('Hur vet Lukas att han har gått för långt?',
                ['Han ser simhallen', 'Han ser parken', 'Han ser trafikljusen', 'Han ser postkontoret'],
                'Han ser simhallen',
                'Det står If you see the swimming pool, you have gone too far! Swimming pool är simhall.'),
            val('Var ligger affären?',
                ['På hörnet mitt emot busshållplatsen', 'Bredvid stationen på King Street',
                 'Mitt emot simhallen på Mill Road', 'Inne i den stora parken'],
                'På hörnet mitt emot busshållplatsen',
                'Det står There is a small shop on the corner of King Street and Mill Road, opposite the '
                'bus stop. Opposite betyder mitt emot.'),
            skriv('Hur mycket kostar det som Lukas ska köpa i affären, sammanlagt? Skriv antalet kronor.',
                  tal(2 * 20),
                  'Han ska köpa två flaskor äppeljuice, two bottles, och de kostar 20 kronor styck, 20 kronor '
                  'each. 2 · 20 = 40 kronor.'),
            sant('Lukas ska ta med sig en tårta till festen.', False,
                 "Det står My mum has already bought the cake, so you don't have to bring any food. Mayas "
                 'mamma har redan köpt tårtan.'),
            para('Para ihop ordet från texten med det svenska.',
                 [('traffic lights', 'trafikljus'), ('post office', 'postkontor'), ('bottle', 'flaska'),
                  ('invitation', 'inbjudan')],
                 'Traffic lights är trafikljus, post office är postkontor, bottle är flaska och invitation '
                 'är inbjudan.'),
            ordna('Sätt stegen i den ordning Lukas ska gå dem.',
                  ['Svänga vänster vid stationen', 'Gå förbi postkontoret', 'Svänga höger vid trafikljusen',
                   'Gå till det tredje huset'],
                  forklaring='Först svänger Lukas vänster utanför stationen och går längs King Street, förbi '
                             'postkontoret. Vid trafikljusen svänger han höger in på Mill Road, och där är '
                             'Mayas hus det tredje på vänster sida.'),
        ], beskrivning='Ett mejl med en vägbeskrivning och ett ärende i affären, med frågor om vägen, '
                       'priset och orden i texten.',
            text=MAYAS_MEJL),
    ]),

    bana('Engelska', 'ak7', [
        niva('en-ak7-perfekt-1', 'I have seen, she has been', 'Present perfect', [
            val('Välj rätt ord: I ___ never been to London.', ['have', 'has', 'am'], 'have',
                'Present perfect bildas med have eller has. Efter I, you, we och they står have. Has '
                'används efter he, she och it, och efter ett namn eller en sak i singular: Emma has.'),
            val('Välj rätt ord: She ___ eaten all the cake.', ['has', 'have', 'is'], 'has',
                'Efter he, she och it heter det has: she has eaten. Is används inte för att bilda present '
                'perfect.'),
            skriv('Fyll i rätt form av see: We have ___ that film three times.', 'seen',
                  'See är oregelbundet: see, saw, seen. Efter have står den tredje formen, seen.'),
            val('Välj rätt form: Have you ever ___ a horse?', ['ridden', 'rode', 'riding'], 'ridden',
                'Efter have står verbets tredje form. Ride är oregelbundet: ride, rode, ridden.'),
            sant('Present perfect bildas med have eller has och verbets tredje form, till exempel I have '
                 'played.', True,
                 'Have eller has plus tredje formen är present perfect. För regelbundna verb är tredje '
                 'formen samma som dåtid: played.'),
            para('Para ihop verbet med dess tredje form.',
                 [('go', 'gone'), ('write', 'written'), ('be', 'been'), ('take', 'taken'), ('buy', 'bought')],
                 'De här verben är oregelbundna och måste läras in: go, gone; write, written; be, been; '
                 'take, taken; buy, bought.'),
            skriv("Skriv kortformen av 'has not': He ___ called me yet.", ["hasn't", 'has not'],
                  "Has not blir hasn't. Apostrofen står där o:et i not har tagits bort."),
            val("Vad betyder 'Have you ever been to Spain?'",
                ['Har du någonsin varit i Spanien?', 'Var du i Spanien förra året?',
                 'Ska du åka till Spanien någon gång?'],
                'Har du någonsin varit i Spanien?',
                'Ever betyder någonsin, och have been betyder har varit. Frågan gäller hela livet fram till '
                'nu, inte en bestämd tid.'),
            ordna('Bygg meningen: Jag har aldrig sett snö.', ['I', 'have', 'never', 'seen', 'snow.'],
                  extra=['saw'],
                  forklaring='Never står mellan have och verbet: I have never seen. Efter have står den '
                             'tredje formen seen, inte saw.'),
            skriv('Fyll i rätt form av write: My grandma has ___ a book.', 'written',
                  'Write är oregelbundet: write, wrote, written. Efter has står den tredje formen, och den '
                  'stavas med två t.'),
        ], beskrivning='Present perfect: have eller has och verbets tredje form, ever och never, och de '
                       'vanligaste oregelbundna formerna.'),

        niva('en-ak7-perfekt-2', 'Saw eller have seen?', 'Present perfect', [
            val('Välj rätt form: I ___ the film yesterday.', ['saw', 'have seen', 'has seen'], 'saw',
                'Yesterday säger exakt när det hände, och då används past simple: I saw. Present perfect '
                'används inte med en bestämd tid i det förflutna.'),
            val("Välj rätt ord: Dad isn't here. He has ___ to the shop.", ['gone', 'been', 'went'], 'gone',
                'Has gone betyder att han har gått dit och är kvar där. Has been betyder att han har varit '
                'där och kommit tillbaka, och det passar inte när han inte är hemma.'),
            sant("'I have lived here since 2020' betyder att jag fortfarande bor här.", True,
                 'Present perfect med since säger att något började förr och fortsätter nu. Jag bor alltså '
                 'kvar här.'),
            val("Välj rätt ord: I haven't finished my homework ___.", ['yet', 'already', 'ago'], 'yet',
                'Yet betyder än eller ännu och står sist i nekande meningar och frågor. Already betyder '
                'redan, och ago används med past simple.'),
            val('Vilken mening är rätt?',
                ['I went to Paris last summer.', 'I have gone to Paris last summer.',
                 'I have been to Paris last summer.'],
                'I went to Paris last summer.',
                'Last summer säger när det hände, och då används past simple. Med en bestämd tid i det '
                'förflutna fungerar inte present perfect.'),
            skriv("Skriv 'lose' i present perfect: Oh no! I ___ my keys.", ['have lost', "'ve lost"],
                  'Present perfect är have plus tredje formen. Lose är oregelbundet: lose, lost, lost. Det '
                  'passar här, för nycklarna är borta nu.'),
            val('Välj rätt ord: The train has ___ left. We are too late!', ['just', 'yet', 'ago'], 'just',
                'Just betyder nyss eller precis och står mellan has och verbet. Yet står sist i meningen, '
                'och ago används med past simple.'),
            para('Para ihop ordet med det svenska.',
                 [('just', 'nyss'), ('already', 'redan'), ('yet', 'än, ännu'), ('ever', 'någonsin'),
                  ('never', 'aldrig')],
                 'Orden används ofta med present perfect. Just, already och never står före verbet, yet '
                 'sist i frågor och nekande meningar, och ever oftast i frågor.'),
            ordna('Bygg frågan: Har du redan ätit lunch?', ['Have', 'you', 'already', 'eaten', 'lunch?'],
                  extra=['ate'],
                  forklaring='I en fråga kommer have först. Already står före verbet, och efter have står '
                             'den tredje formen, eaten.'),
            skriv('Skriv since eller for: My cousin has lived in Malmö ___ 2018.', 'since',
                  'Since används med en tidpunkt, när något började: since 2018. For används med en '
                  'tidslängd, som for five years.'),
        ], beskrivning='När det heter present perfect och när det heter past simple: yesterday och last '
                       'summer, just, yet och since, gone och been.'),

        niva('en-ak7-mangd-1', 'Some or any?', 'Some, any, much och many', [
            val('Välj rätt ord: There are ___ apples in the fridge.', ['some', 'any', 'a'], 'some',
                'I en vanlig jakande mening används some, några. Any används i frågor och nekande meningar, '
                'och a passar inte före ett ord i plural.'),
            val("Välj rätt ord: We don't have ___ milk left.", ['any', 'some', 'many'], 'any',
                "Meningen är nekande, don't, och då används any. Many används bara med sådant som går att "
                'räkna, och mjölk går inte att räkna.'),
            val('Välj rätt ord: Are there ___ shops near your house?', ['any', 'much', 'a'], 'any',
                'I frågor används oftast any: Are there any shops? Much används inte med ord i plural, och '
                'a går inte före shops.'),
            sant('Det är rätt att säga some när man bjuder på något: Would you like some cake?', True,
                 'När man bjuder eller ber om något används some, fast det är en fråga: Would you like some '
                 'tea? Can I have some water?'),
            skriv("Skriv some eller any: The tree is empty. I can't see ___ birds in it.", 'any',
                  "Can't gör meningen nekande, och då blir det any."),
            skriv('Skriv some eller any: She bought ___ new books yesterday.', 'some',
                  'Meningen är jakande, hon köpte faktiskt böcker. Då används some.'),
            val("Vad betyder 'I haven't got any money'?",
                ['Jag har inga pengar', 'Jag har lite pengar', 'Jag har några pengar'], 'Jag har inga pengar',
                "Not any betyder inga. I haven't got any money är alltså jag har inga pengar."),
            para('Para ihop ordet med det svenska.',
                 [('somebody', 'någon'), ('nobody', 'ingen'), ('something', 'något'), ('nothing', 'ingenting'),
                  ('somewhere', 'någonstans')],
                 'Orden med some betyder någon, något och någonstans. Orden med no betyder ingen och '
                 'ingenting.'),
            ordna('Bygg frågan: Har du några syskon?',
                  ['Do', 'you', 'have', 'any', 'brothers', 'or', 'sisters?'], extra=['some'],
                  forklaring='Det är en fråga, och då passar any. Syskon säger man ofta brothers or sisters '
                             'på engelska.'),
            val('Vilken mening är rätt?', ["There isn't any bread.", "There isn't some bread.",
                                           'There is any bread.'],
                "There isn't any bread.",
                "Isn't gör meningen nekande, och då används any. En jakande mening hade varit There is some "
                'bread.'),
        ], beskrivning='Some och any: när man säger some och när man säger any, och orden somebody, '
                       'nothing och somewhere.'),

        niva('en-ak7-mangd-2', 'Much, many, a few, a little', 'Some, any, much och many', [
            val('Välj rätt ord: How ___ people came to the party?', ['many', 'much', 'lot'], 'many',
                'People går att räkna, en, två, tre personer. Då heter det many. Much används med sådant '
                'som inte går att räkna.'),
            val("Välj rätt ord: I don't have ___ time today.", ['much', 'many', 'a few'], 'much',
                'Time i betydelsen tid går inte att räkna, så det heter much. Many och a few används med '
                'sådant som går att räkna.'),
            sant('På engelska säger man some information, inte some informations.', True,
                 'Information går inte att räkna på engelska och har ingen plural. Man säger some '
                 'information eller a piece of information.'),
            val('Vilken mening är rätt?',
                ['Can you give me some advice?', 'Can you give me an advice?', 'Can you give me some advices?'],
                'Can you give me some advice?',
                'Advice, råd, går inte att räkna på engelska. Därför heter det some advice, aldrig an '
                'advice eller advices. Ett råd kan heta a piece of advice.'),
            skriv("Skriv much eller many: There aren't ___ cars in the street today.", 'many',
                  'Cars går att räkna, och då heter det many.'),
            val('Välj rätt ord: Add ___ salt to the soup. (lite)', ['a little', 'a few', 'many'], 'a little',
                'Salt går inte att räkna, så lite heter a little. A few används med sådant som går att '
                'räkna, som a few eggs.'),
            val('Välj rätt ord: I have ___ friends in London. (några få)', ['a few', 'a little', 'much'],
                'a few',
                'Friends går att räkna, så några få heter a few. A little och much används med sådant som '
                'inte går att räkna.'),
            para('Para ihop det engelska med det svenska.',
                 [('a few apples', 'några få äpplen'), ('a little water', 'lite vatten'),
                  ('a lot of books', 'massor av böcker'), ('not much money', 'inte mycket pengar')],
                 'A few står med det som går att räkna och a little med det som inte går. A lot of passar '
                 'med båda, och much används med sådant som inte går att räkna.'),
            skriv('Skriv much eller many: How ___ homework do you have tonight?', 'much',
                  'Homework går inte att räkna på engelska, fast vi säger läxor på svenska. Därför heter det '
                  'how much homework.'),
            ordna('Bygg meningen: Vi har inte mycket mjölk.', ['We', "don't", 'have', 'much', 'milk.'],
                  extra=['many'],
                  forklaring='Mjölk går inte att räkna, så mycket heter much. Many används med sådant som går '
                             'att räkna.'),
        ], beskrivning='Much och many, a few och a little, och ord som går att räkna på svenska men inte '
                       'på engelska, som advice och homework.'),

        niva('en-ak7-brittiskt-amerikanskt-1', 'Flat or apartment?', 'Brittisk och amerikansk engelska', [
            val('Vad heter lägenhet på amerikansk engelska?', ['apartment', 'flat', 'house'], 'apartment',
                'Amerikaner säger apartment och britter oftast flat. House är ett hus, inte en lägenhet.'),
            val("En amerikan säger 'elevator'. Vilket ord använder en britt?", ['lift', 'lorry', 'tube'],
                'lift',
                'Hiss heter lift i Storbritannien och elevator i USA. Lorry är en lastbil, och the tube är '
                'tunnelbanan i London.'),
            para('Para ihop det brittiska ordet med det amerikanska.',
                 [('autumn', 'fall'), ('biscuit', 'cookie'), ('holiday', 'vacation'), ('rubbish', 'trash'),
                  ('mobile phone', 'cell phone')],
                 'Det brittiska ordet står först: höst heter autumn eller fall, kaka biscuit eller cookie, '
                 'semester holiday eller vacation, sopor rubbish eller trash och mobil mobile phone eller '
                 'cell phone.'),
            val('Vilket ord är stavat på amerikanskt sätt?', ['color', 'centre', 'favourite'], 'color',
                'I amerikansk stavning faller u:et i -our oftast bort: color. Centre och favourite är brittisk '
                'stavning; i USA skrivs de center och favorite.'),
            sant("'Crisps' på brittisk engelska heter 'chips' på amerikansk engelska.", True,
                 'Chipsen i påsen heter crisps i Storbritannien och chips i USA. I Storbritannien betyder '
                 'chips i stället pommes frites.'),
            skriv("Skriv den brittiska stavningen av det amerikanska ordet 'center'.", 'centre',
                  'Flera ord som slutar på -er i USA slutar på -re i Storbritannien: center blir centre och '
                  'theater blir theatre.'),
            val('Vad kallar de flesta i USA den sport som vi kallar fotboll?', ['soccer', 'football', 'baseball'],
                'soccer',
                'I USA betyder football oftast amerikansk fotboll, en annan sport. Därför säger de flesta '
                'amerikaner soccer om fotboll.'),
            val("En amerikan säger 'candy'. Vad säger en britt?", ['sweets', 'crisps', 'biscuits'], 'sweets',
                'Godis heter candy i USA och sweets i Storbritannien. Crisps är chips och biscuits är kex '
                'eller kakor.'),
            ordna('Bygg meningen på amerikansk engelska: Vi åker tunnelbana till skolan.',
                  ['We', 'take', 'the', 'subway', 'to', 'school.'], extra=['underground'],
                  forklaring='Tunnelbanan heter the subway i New York och många andra amerikanska städer. '
                             'The underground är det brittiska ordet.'),
            skriv("Amerikaner säger 'sidewalk'. Skriv det brittiska ordet för trottoar.", 'pavement',
                  'Trottoaren heter pavement i Storbritannien och sidewalk i USA.'),
        ], beskrivning='Ord och stavning som skiljer brittisk och amerikansk engelska åt: flat och '
                       'apartment, lift och elevator, colour och color.'),

        niva('en-ak7-brittiskt-amerikanskt-2', 'An email from Boston', 'Brittisk och amerikansk engelska', [
            val('Hur länge har Elsa bott i Boston när hon skriver?',
                ['I tre veckor', 'I tre månader', 'I ett år', 'I tre dagar'], 'I tre veckor',
                'Det står We have lived in Boston for three weeks now. Three weeks är tre veckor.'),
            val('Varför blev Elsa röd som en tomat första skoldagen?',
                ['I London betyder pants underbyxor', 'Hon kom för sent till första lektionen',
                 'Läraren skrattade åt hennes uttal', 'Hon gick av hissen på fel våning'],
                'I London betyder pants underbyxor',
                'En flicka sa att hon gillade Elsas pants. I USA betyder pants byxor, men i London är pants '
                'något man har under byxorna, alltså underbyxor.'),
            sant('Elsas familj bor i ett eget hus.', False,
                 'Det står Our new home is an apartment, not a flat. Familjen bor alltså i en lägenhet.'),
            val('Vad skulle Elsas våning heta i London?',
                ['the second floor', 'the third floor', 'the first floor', 'the fourth floor'],
                'the second floor',
                'Det står In London, that would be the second floor. I USA kallas bottenvåningen the first '
                'floor, så varje våning får ett nummer mer än i Storbritannien.'),
            skriv('Vilket ord använder amerikanerna i stället för queue, enligt texten? Skriv ordet på '
                  'engelska.', ['line', 'in line', 'stand in line'],
                  'Det står People stand in line instead of queuing. Att köa heter stand in line i USA och '
                  'queue i Storbritannien.'),
            para('Para ihop Elsas brittiska ord med det amerikanska ordet i texten.',
                 [('flat', 'apartment'), ('biscuit', 'cookie'), ('maths', 'math'), ('zed', 'zee')],
                 'Elsa skriver om flat och apartment, biscuit och cookie, maths och math, och om bokstaven z, '
                 'som heter zed i London och zee i USA.'),
            val('Vad trodde läraren att 4/10 betydde?',
                ['Den tionde april', 'Den fjärde oktober', 'Den fjärde april', 'Den tionde oktober'],
                'Den tionde april',
                'Det står my teacher thought I meant the tenth of April. I USA skriver man månaden först, så '
                '4/10 läses som månad 4, april, och dag 10.'),
            sant('Elsa skrev datumet med dagen först, som man gör i Storbritannien.', True,
                 'Läraren trodde att Elsa menade den tionde april, och Elsa förklarar: Here they write the '
                 'month first! Elsa skrev alltså dagen först, den fjärde oktober, som man gör i London.'),
            val("Hur reagerade klassen när Elsa sa 'zed'?",
                ['De skrattade, men snällt', 'De blev arga på henne', 'De sa ingenting alls',
                 'Läraren bad henne sluta'],
                'De skrattade, men snällt',
                'Det står the whole class laughed – in a nice way. In a nice way betyder på ett snällt sätt.'),
            val('Vad hoppas Elsa i slutet av mejlet?',
                ['Att hon får behålla lite av London', 'Att hon snart låter som en amerikan',
                 'Att familjen flyttar hem igen i höst', 'Att Olivia kommer och hälsar på'],
                'Att hon får behålla lite av London',
                'Mamma säger att de snart ska prata som riktiga amerikaner, men Elsa skriver I hope not – I '
                'want to keep a little bit of London.'),
        ], beskrivning='Ett mejl från en flicka som har flyttat från London till Boston, med frågor om '
                       'orden, våningarna och datumet som skiljer länderna åt.',
            text=ELSAS_MEJL),
    ]),
]
