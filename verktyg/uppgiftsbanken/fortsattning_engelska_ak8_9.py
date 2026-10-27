# -*- coding: utf-8 -*-
"""Fortsättningen i engelska åk 8 och 9 (2026-10-27). Leo: "Nexläx där ska vi
lägga in flera uppgifter, i matte svenska och engelska årkurs 6 och uppåt."

Tre nya områden i varje bana, två nivåer var, sist i banan (TILLAGG):

  åk 8  Gerund och infinitiv (enjoy swimming, want to swim, stop doing och
        stop to do), Frågetaggar (isn't it, don't you, aren't I, shall we) och
        Formella och informella mejl (den andra nivån har en lästext: två mejl
        om samma klassresa)
  åk 9  Ordbildning (prefix och suffix), Modala verb i perfekt (should have,
        must have, might have, can't have) och Engelska i världen (brittisk och
        amerikansk engelska, och en faktatext om engelskan i världen som lästext)

Ingen av banorna hade de här områdena: åk 9 har redan passiv form, if-satser,
frasverb, formellt och informellt ordförråd och sambandsord, och åk 8 relativa
bisatser, och de står inte här igen. En lästext står i ett område tillsammans
med en vanlig nivå, så att området får ett Mästarprov ur den vanliga.

Frågorna är på engelska, beskrivningarna och förklaringarna på svenska, och en
ordna-fråga utgår från en svensk mening. Brittisk stavning, och där brittisk och
amerikansk engelska skiljer sig säger frågan vilken den menar. En skriv-fråga
godtar alla rimliga varianter (kortform och lång form, svansen med och utan
frågetecken), och ett fel alternativ går inte att försvara som rätt. Lästexterna
är påhittade och skrivna för banken; varje fråga går att besvara ur texten ensam.

Skriven med AI och inte läst av en lärare."""
from grund import bana, niva, val, skriv, ordna, sant, para, tal

# ---- Åk 8: lästexten ----

TVA_MEJL = '\n\n'.join([
    'EMAIL 1, to the youth hostel',
    'Subject: Group booking, 18–20 May',
    'Dear Sir or Madam,',
    'I am writing on behalf of Class 8B at Ekbacka School in Sweden. Our class is planning a trip '
    'to Port Alder in May, and we would like to stay at your youth hostel from 18 to 20 May.',
    'We are 24 pupils and two teachers. Could you please tell me whether you have enough beds for '
    'our group, and how much it would cost per night? We would also like to know if breakfast is '
    'included in the price.',
    'Two of the pupils are allergic to nuts. I would be grateful if you could tell me whether your '
    'kitchen can make meals without nuts.',
    'Thank you in advance for your help. I look forward to hearing from you.',
    'Yours faithfully,',
    'Ella Nordin, Class 8B, Ekbacka School',
    'EMAIL 2, to Ella’s friend Sam',
    'Subject: Guess what?!',
    'Hi Sam,',
    'Guess what? We’re coming to Port Alder in May! The whole class, can you believe it? I’ve just '
    'emailed the youth hostel by the harbour to ask if they’ve got room for us. Fingers crossed!',
    'We’ll be there from the 18th to the 20th. Are you free on the 19th? It’d be so cool to finally '
    'meet you in real life. Maybe you could show me that café you’re always going on about, the one '
    'with the giant pancakes?',
    'Oh, and I had to write the hostel email in my best formal English. Took me ages! Mr Holm, our '
    'teacher, said it was perfect, so I’m feeling pretty proud.',
    'Write back soon! Ella',
    'PS Don’t tell anyone, but I’m a bit nervous about speaking English for three whole days.',
])

# ---- Åk 9: lästexten ----

ENGELSKAN_I_VARLDEN = '\n\n'.join([
    'When people in Sweden think of English, many of them think of Britain or the United States. '
    'But English belongs to far more people than that. It is the first language of most people in '
    'Ireland, Australia and New Zealand, and of many people in Canada. In other countries, for '
    'example India, Nigeria and the Philippines, it is an official language that is used in '
    'schools, courts and government, even though most people there grew up speaking another '
    'language at home. In fact, more people speak English as a second or foreign language than as '
    'their first language.',
    'How did English spread so far? One reason is history. From the 1600s onwards, Britain built a '
    'large empire, and English travelled with its ships, traders and colonial governments to many '
    'parts of the world. Later, in the 1900s, the United States became one of the most powerful '
    'countries in the world. American films, music and businesses, and later the internet, carried '
    'English even further.',
    'Today English is often used as a lingua franca: a shared language between people who have '
    'different first languages. When a pilot from Brazil talks to air traffic control in Germany, '
    'they normally use English. When a girl from Japan and a boy from Sweden meet at a summer camp, '
    'English is often the language they choose, even though it is not the first language of '
    'either of them.',
    'As English spread, it also changed. Every place where it is spoken has made it its own. In '
    'informal Australian English, the afternoon is often called the “arvo”, and in India and '
    'Nigeria there are words and expressions that a visitor from London might not understand at '
    'first. These varieties are not “wrong”. They are simply different, in the same way as Swedish '
    'sounds different in Skåne and in Norrland.',
    'English has also borrowed words from all over the world. “Shampoo” comes from Hindi, “robot” '
    'from Czech, “tsunami” from Japanese and “ombudsman” from Swedish. So when you learn English, '
    'you also learn a little of many other languages.',
    'Is there one correct English? Many language experts would say no. A pupil who learns English '
    'in Stockholm will hear many different accents in life, from Dublin to Delhi. What matters most '
    'is not sounding British or American, but understanding others and being understood.',
])

TILLAGG = [
    bana('Engelska', 'ak8', [
        niva('en-ak8-gerund-1', 'Enjoy swimming, want to swim', 'Gerund och infinitiv', [
            val('Choose the right form: I really enjoy ___ in the lake in summer.',
                ['swimming', 'to swim', 'swim', 'to swimming'], 'swimming',
                'Efter enjoy står nästa verb med -ing: enjoy swimming. Det går inte att säga enjoy to '
                'swim. Lägg också märke till stavningen: swim får dubbelt m, swimming.'),
            val('Choose the right form: We have decided ___ a dog.',
                ['to get', 'getting', 'get'], 'to get',
                'Efter decide står to och verbets grundform: decide to get. Likadant efter want, hope, '
                'plan och promise.'),
            val('Choose the right form: Have you finished ___ your room yet?',
                ['cleaning', 'to clean', 'clean'], 'cleaning',
                'Finish hör till verben som vill ha -ing efter sig, som enjoy, mind och avoid: finish '
                'cleaning.'),
            skriv("Write the right form of 'play': My little sister is good at ___ chess.", 'playing',
                  'At är en preposition, och efter en preposition står verbet alltid med -ing: good at '
                  'playing. På svenska säger man bra på att spela, men på engelska blir det inget to.'),
            skriv("Write 'help' in the right form, with or without 'to': Ali has promised ___ me with "
                  'my homework.', 'to help',
                  'Efter promise står to och grundformen: promised to help. Verb med to handlar ofta om '
                  'något man vill eller tänker göra sedan, som want, hope och promise.'),
            sant("'I want going home now' is correct English.", False,
                 'Efter want står to och grundformen: I want to go home now. Want hör inte till verben '
                 'som tar -ing.'),
            sant("In 'Thank you for helping me', 'helping' has -ing because it comes after the "
                 "preposition 'for'.", True,
                 'For är en preposition, och efter en preposition står verbet med -ing. Därför heter det '
                 'thank you for helping me.'),
            ordna('Build the sentence: Hon är rädd för att flyga.',
                  ['She', 'is', 'afraid', 'of', 'flying.'], extra=['fly'],
                  forklaring='Afraid of följs av ett verb med -ing, eftersom of är en preposition: '
                             'afraid of flying.'),
            para('Match the verb with its -ing form.',
                 [('swim', 'swimming'), ('make', 'making'), ('lie', 'lying'), ('study', 'studying'),
                  ('run', 'running')],
                 'Ett kort verb som slutar på en enda vokal och en konsonant dubblar konsonanten: '
                 'swimming, running. Ett stumt e försvinner: making. Ie blir y: lying. Ett y står kvar: studying.'),
            val('Which sentence is correct?',
                ['I am interested in learning Spanish.', 'I am interested in learn Spanish.',
                 'I am interested of learning Spanish.'],
                'I am interested in learning Spanish.',
                'Interested följs av in, och efter prepositionen in står verbet med -ing: interested in '
                'learning.'),
        ], beskrivning='När ett verb kommer efter ett annat: efter vissa verb står -ing (enjoy, '
                       'finish), efter andra to (want, decide), och efter en preposition står alltid '
                       '-ing.'),

        niva('en-ak8-gerund-2', 'Stop talking or stop to talk?', 'Gerund och infinitiv', [
            val('Choose the right form: When the teacher came in, the pupils stopped ___ and the room '
                'went quiet.', ['talking', 'to talk', 'talk'], 'talking',
                'Stop + -ing betyder att sluta göra något: eleverna slutade prata, och det blev tyst. '
                'Stopped to talk hade betytt att de stannade för att prata.'),
            val('Choose the right form: On his way home, Sam stopped ___ a friend, and they chatted for '
                'ten minutes.', ['to talk to', 'talking to', 'talk to'], 'to talk to',
                'Stop + to betyder att stanna för att göra något: Sam stannade för att prata med en '
                'kompis. Stopped talking to hade betytt att han slutade prata med kompisen, men de '
                'pratade ju i tio minuter.'),
            sant("'I remember locking the door' means that I locked the door, and now I remember "
                 'doing it.', True,
                 'Remember + -ing handlar om något man redan har gjort och minns. Remember to lock '
                 'betyder i stället att komma ihåg att göra något, innan man gör det.'),
            val('Choose the right form: Please remember ___ the lights when you leave.',
                ['to turn off', 'turning off', 'turn off'], 'to turn off',
                'Lamporna ska släckas sedan, när du går. Att komma ihåg att göra något heter '
                'remember to: remember to turn off.'),
            skriv("Write 'buy' in the right form, with or without 'to': I forgot ___ milk, so there is "
                  'none for breakfast.', 'to buy',
                  'Mjölken köptes aldrig, därför finns det ingen. Att glömma att göra något heter '
                  'forget to: I forgot to buy milk.'),
            val('Choose the right word: ___ is good for your heart.',
                ['Running', 'Run', 'Runs'], 'Running',
                'När ett verb är subjekt först i meningen får det oftast -ing: running is good for '
                'you. På svenska säger man att springa eller löpning.'),
            skriv("Write 'break' in the right form, with or without 'to': I'm sorry, I didn't mean ___ "
                  'your glass.', 'to break',
                  'Mean to betyder att göra något med flit: I didn’t mean to break it, jag menade inte '
                  'att ha sönder det. Mean + -ing betyder något annat: att något innebär något.'),
            para('Match the English sentence with the Swedish one.',
                 [('I stopped to eat.', 'Jag stannade för att äta.'),
                  ('I stopped eating.', 'Jag slutade äta.'),
                  ('I forgot to call her.', 'Jag glömde att ringa henne.'),
                  ("I'll never forget meeting her.", 'Jag glömmer aldrig när jag träffade henne.')],
                 'Med to handlar det om något man ska göra eller gör efteråt: stopped to eat, forgot to '
                 'call. Med -ing handlar det om något man redan håller på med eller har gjort: stopped '
                 'eating, forget meeting.'),
            ordna('Build the question: Har du provat att starta om datorn?',
                  ['Have', 'you', 'tried', 'restarting', 'the', 'computer?'], extra=['restart'],
                  forklaring='Try + -ing betyder att prova något för att se om det hjälper: have you '
                             'tried restarting? Grundformen restart kan inte stå direkt efter tried.'),
            sant("'He tried to lift the box, but it was too heavy' means that he could not lift it.",
                 True,
                 'Try to betyder att försöka göra något, och det är inte säkert att det går. Lådan var '
                 'för tung, så han klarade det inte.'),
        ], beskrivning='Verb som kan följas av både -ing och to, ibland med olika betydelse (stop, '
                       'remember, forget, try, mean), och -ing som subjekt först i meningen.'),

        niva('en-ak8-fragetaggar-1', "It's cold, isn't it?", 'Frågetaggar', [
            val("Choose the right question tag: It's cold today, ___?",
                ["isn't it", "wasn't it", "doesn't it"], "isn't it",
                'Meningen har is (it’s = it is) och är jakande. Då blir svansen nekande med samma verb i '
                'samma tid: isn’t it? Wasn’t är dåtid, och doesn’t passar inte, för meningen har inget does.'),
            val('Choose the right question tag: You like pizza, ___?',
                ["don't you", "aren't you", "doesn't you"], "don't you",
                'Like har inget hjälpverb, så svansen får do. Efter you blir det don’t, inte doesn’t: '
                'You like pizza, don’t you?'),
            val('Choose the right question tag: Anna can swim, ___?',
                ["can't she", "can't Anna", "doesn't she"], "can't she",
                'Svansen tar hjälpverbet ur meningen, can, och ett pronomen i stället för namnet: Anna '
                'blir she. Därför can’t she?'),
            skriv("Write the question tag: They aren't at home, ___?", ['are they', 'are they?'],
                  'Meningen är nekande (aren’t), så svansen blir jakande: are they? En nekande mening '
                  'får en jakande svans.'),
            skriv('Write the question tag: Your brother plays the guitar, ___?',
                  ["doesn't he", "doesn't he?", 'does he not', 'does he not?'],
                  'Plays har inget hjälpverb, så svansen får does, eftersom det är he. Meningen är '
                  'jakande, så svansen blir nekande: doesn’t he?'),
            sant("In 'You are tired, aren't you?', the tag is negative because the sentence is "
                 'positive.', True,
                 'Jakande mening, nekande svans, och tvärtom. Svansen frågar om den andra håller med.'),
            sant("'She doesn't eat meat, doesn't she?' is correct English.", False,
                 'Meningen är redan nekande (doesn’t), så svansen ska vara jakande: She doesn’t eat '
                 'meat, does she?'),
            val('Choose the right question tag: We will see you on Friday, ___?',
                ["won't we", "won't you", "don't we"], "won't we",
                'Will är hjälpverbet, och den nekande formen av will är won’t. Svansen har meningens '
                'subjekt, we, inte you. Därför won’t we?'),
            ordna('Build the question: Du är Saras bror, eller hur?',
                  ['You', 'are', "Sara's", 'brother,', "aren't", 'you?'], extra=["isn't"],
                  forklaring='Eller hur blir en frågesvans. Meningen har are och är jakande, så svansen '
                             'blir aren’t you?'),
            para('Match the sentence with its question tag.',
                 [('It was a great film,', "wasn't it?"), ('You live near here,', "don't you?"),
                  ('He has finished,', "hasn't he?"), ("They can't come,", 'can they?')],
                 'Svansen tar hjälpverbet ur meningen: was, has och can. Live har inget hjälpverb och '
                 'får do. En nekande mening får en jakande svans: can’t blir can.'),
        ], beskrivning='Frågesvansar, som eller hur på svenska: svansen tar hjälpverbet ur meningen, '
                       'och en jakande mening får en nekande svans.'),

        niva('en-ak8-fragetaggar-2', "I'm late, aren't I?", 'Frågetaggar', [
            val("Choose the right question tag: I'm late again, ___?",
                ["aren't I", "isn't I", "don't I"], "aren't I",
                'Efter I am blir svansen aren’t I. Det ser konstigt ut, men det är så man säger. Isn’t '
                'hör till he, she och it.'),
            val("Choose the right question tag: Let's take a break, ___?",
                ['shall we', "don't we", "aren't we"], 'shall we',
                'Let’s betyder let us, och man föreslår något. Svansen efter let’s är shall we?'),
            val('Choose the right question tag: You went to the party, ___?',
                ["didn't you", "don't you", "weren't you"], "didn't you",
                'Went är dåtid utan hjälpverb. Då får svansen did, och den nekande formen didn’t: '
                'didn’t you?'),
            skriv('Write the question tag: There is some milk left, ___?',
                  ["isn't there", "isn't there?", 'is there not', 'is there not?'],
                  'Med there is står there kvar i svansen: there is blir isn’t there? Det blir aldrig '
                  'isn’t it.'),
            val('Choose the right question tag: Nobody called while I was out, ___?',
                ['did they', "didn't they", 'did nobody'], 'did they',
                'Nobody gör meningen nekande, fast verbet called är jakande. Då blir svansen jakande, '
                'och nobody blir they: did they?'),
            sant("'She never eats breakfast, does she?' is correct English.", True,
                 'Never gör meningen nekande, så svansen blir jakande: does she? Samma sak med nobody, '
                 'nothing och hardly.'),
            skriv("Write the question tag: That isn't your bag, ___?", ['is it', 'is it?'],
                  'That och this blir it i svansen. Meningen är nekande, så svansen blir jakande: is it?'),
            val('Choose the right question tag: Close the window, ___?',
                ['will you', "don't you", "aren't you"], 'will you',
                'Efter en uppmaning används will you, can you eller would you. Don’t you och aren’t you '
                'passar inte, för uppmaningen har inget do eller are.'),
            para('Match the sentence with its question tag.',
                 [('Everyone is here,', "aren't they?"), ('You have been to Paris,', "haven't you?"),
                  ("Tom didn't win,", 'did he?'), ("Let's go,", 'shall we?')],
                 'Everyone blir they i svansen, och verbet blir are. Have och did står kvar som '
                 'hjälpverb, och let’s får shall we.'),
            ordna('Build the question: Ingen vet svaret, eller hur?',
                  ['Nobody', 'knows', 'the', 'answer,', 'do', 'they?'], extra=["don't"],
                  forklaring='Nobody är nekande, så svansen blir jakande: do they? Knows har inget '
                             'hjälpverb, och därför do.'),
        ], beskrivning='De knepiga svansarna: aren’t I, let’s … shall we, uppmaningar, there is, ord '
                       'som nobody och never, och svansen efter ett verb i dåtid.'),

        niva('en-ak8-mejl-1', 'Dear Ms Berg or Hi Sam?', 'Formella och informella mejl', [
            val('You are writing to a hotel, and you do not know who will read your email. How do you '
                'start?', ['Dear Sir or Madam,', 'Hi there!', 'Hiya, whoever reads this!'], 'Dear Sir or Madam,',
                'När du inte vet vem som läser börjar du ett formellt mejl med Dear Sir or Madam. Hi '
                'there och Hiya skriver man till kompisar.'),
            val('Which sentence fits best at the start of a formal email?',
                ['I am writing to ask about your summer courses.',
                 "Hey, just wondering what's going on with your summer courses!",
                 'So, about those courses, what are they like?'],
                'I am writing to ask about your summer courses.',
                'I am writing to … är ett vanligt sätt att börja ett formellt mejl: det säger direkt '
                'varför du skriver. De andra är vardagliga, som när man pratar med en kompis.'),
            sant("In a formal email, 'I am' and 'do not' are more formal than 'I'm' and 'don't'.", True,
                 'Kortformer som I’m och don’t hör till talspråk och mejl till kompisar. I ett formellt '
                 'mejl skriver man oftast ut orden: I am, do not.'),
            val('Which ending fits best in an email to your best friend?',
                ['Take care, Mia', 'Yours faithfully, Mia Berg', 'Yours sincerely, Mia Berg'],
                'Take care, Mia',
                'Take care är en vänlig avslutning till någon man känner. Yours faithfully och Yours '
                'sincerely hör till formella brev och mejl.'),
            para('Match the informal phrase with a more formal one.',
                 [('Thanks a lot!', 'Thank you very much.'), ('Can you …?', 'Could you please …?'),
                  ('I want to know …', 'I would like to know …'),
                  ('Write back soon!', 'I look forward to hearing from you.'),
                  ('Sorry about …', 'I apologise for …')],
                 'Could you please och I would like är artigare än can you och I want. I look forward '
                 'to hearing from you och I apologise for passar i formella mejl.'),
            skriv("Write 'hear' in the right form: I look forward to ___ from you.", 'hearing',
                  'I uttrycket look forward to är to en preposition, och därför får verbet -ing: to '
                  'hearing. Det är en vanlig sista mening i formella mejl.'),
            val('Your class wants to visit a museum. Which subject line is best for your email to the '
                'museum?', ['Class visit on 12 May', 'Hello from a pupil in Sweden :)', 'Question'],
                'Class visit on 12 May',
                'En bra ämnesrad säger kort vad mejlet handlar om. Question säger för lite, och en '
                'smiley passar inte i ett formellt mejl.'),
            val('Which sentence is the most polite way to ask for information?',
                ['Could you please tell me the opening hours?', 'Tell me the opening hours.',
                 'I want you to tell me the opening hours of the museum.'],
                'Could you please tell me the opening hours?',
                'Could you please … är en artig fråga. Tell me … och I want you to … låter som order, '
                'även om orden är rätt.'),
            ordna('Build the formal sentence: Jag skulle vara tacksam om ni kunde svara snart.',
                  ['I', 'would', 'be', 'grateful', 'if', 'you', 'could', 'reply', 'soon.'],
                  forklaring='I would be grateful if you could … är ett artigt sätt att be om något i ett '
                             'formellt mejl. Would och could gör meningen mjukare än will och can.'),
            sant("'Kind regards' is a closing that you can use in an email to a teacher.", True,
                 'Kind regards och Best wishes passar i mejl till lärare och andra vuxna. De är vänliga '
                 'men inte för vardagliga.'),
        ], beskrivning='Hur du börjar, skriver och avslutar ett mejl, till en kompis och till någon '
                       'du inte känner, som en skola, ett hotell eller ett museum.'),

        niva('en-ak8-mejl-2', 'Two emails about a school trip', 'Formella och informella mejl', [
            val('Why did Ella write the first email?',
                ['To ask about beds for her class', 'To complain about a room at the hostel',
                 'To book a table at a café', 'To invite Sam to Sweden'],
                'To ask about beds for her class',
                'Ella skriver Could you please tell me whether you have enough beds for our group. Hon '
                'vill veta om det finns plats för klassen.'),
            skriv("How many people are in Ella's group, pupils and teachers together? Write the number.",
                  [tal(24 + 2), 'twenty-six', 'twenty six', 'tjugosex'],
                  'Det står We are 24 pupils and two teachers. 24 + 2 = 26.'),
            sant('Ella has already booked beds at the hostel.', False,
                 'Hon frågar om det finns sängar, whether you have enough beds, och skriver till Sam att '
                 'hon frågat if they’ve got room for us. Inget är bokat än.'),
            val('Which phrase comes from the formal email?',
                ['I would be grateful if you could', 'Fingers crossed!', 'Guess what?',
                 'Maybe you could show me that café'],
                'I would be grateful if you could',
                'I would be grateful if you could är ett artigt, formellt sätt att be om något. De andra '
                'tre står i mejlet till Sam.'),
            val("Why does Ella end the first email with 'Yours faithfully'?",
                ['She does not know the name of the reader', 'She knows the reader very well',
                 'She is writing to a friend who lives near the hostel', 'She wants to sound funny'],
                'She does not know the name of the reader',
                'Ella började med Dear Sir or Madam, eftersom hon inte vet vem som läser. I brittisk '
                'engelska avslutar man då med Yours faithfully. Vet man namnet skriver man Yours '
                'sincerely.'),
            skriv("Find a word in the email to Sam that means 'great' or 'fantastic'. It starts with c.",
                  'cool',
                  'Ella skriver It’d be so cool to finally meet you. Cool är ett vardagligt ord för '
                  'toppen eller häftigt.'),
            val("What does Ella mean by 'Fingers crossed!'?",
                ['She hopes it will work out', 'She has hurt her fingers', 'She is angry with the hostel',
                 'She is sure that there are beds'],
                'She hopes it will work out',
                'Fingers crossed betyder att man hoppas att något ska gå bra, som att hålla tummarna på '
                'svenska.'),
            para('Match the informal phrase from the email to Sam with what it means.',
                 [('Guess what?', 'I have some news for you.'), ('Took me ages!', 'It took a very long time.'),
                  ("you're always going on about", 'you talk about it a lot'),
                  ('Write back soon!', 'Please answer quickly.')],
                 'Alla fyra är vardagliga uttryck som man skriver till en kompis. I ett formellt mejl '
                 'hade Ella skrivit I look forward to hearing from you i stället för Write back soon.'),
            val("In which email does Ella use short forms like 'We're' and 'I've'?",
                ['Only in the email to Sam', 'Only in the email to the hostel', 'In both emails'],
                'Only in the email to Sam',
                'I mejlet till vandrarhemmet skriver Ella ut allt: I am writing, we would like. '
                'Kortformer som we’re och I’ve finns bara i mejlet till Sam.'),
            ordna('Put the parts of the formal email in the right order.',
                  ['Dear Sir or Madam,', 'I am writing on behalf of Class 8B',
                   'We are 24 pupils and two teachers.', 'I look forward to hearing from you.',
                   'Yours faithfully,'],
                  forklaring='Ett formellt mejl börjar med en hälsning och en mening om varför man '
                             'skriver. Sedan kommer detaljerna, och sist en artig mening och Yours '
                             'faithfully.'),
        ], beskrivning='Två mejl som Ella skriver om samma klassresa, ett formellt till ett '
                       'vandrarhem och ett vardagligt till en kompis, med frågor om vad som står och '
                       'hur hon skriver.',
            text=TVA_MEJL),
    ]),

    bana('Engelska', 'ak9', [
        niva('en-ak9-ordbildning-1', 'Unhappy, impossible, rewrite', 'Ordbildning', [
            val("What is the opposite of 'possible'?", ['impossible', 'inpossible', 'dispossible'],
                'impossible',
                'Före p, b och m blir in- oftast im-: impossible, impolite, immature. Det är lättare '
                'att säga.'),
            val("What is the opposite of 'agree'?", ['disagree', 'unagree', 'misagree'], 'disagree',
                'Dis- ger motsatsen till en del verb: agree – disagree, like – dislike, obey – disobey.'),
            skriv("Write the opposite of 'happy' by adding a prefix: The boy looked ___ when his team "
                  'lost.', 'unhappy',
                  'Un- är den vanligaste förstavelsen för motsats: happy – unhappy, kind – unkind, fair '
                  '– unfair.'),
            skriv("Write the opposite of 'legal' by adding a prefix: It is ___ to drive a car without a "
                  'licence.', 'illegal',
                  'Före l blir in- till il-: legal – illegal. Ordet får två l.'),
            val("What does 're-' mean in 'rewrite' and 'rebuild'?", ['again', 'not', 'wrongly'], 'again',
                'Re- betyder igen: rewrite är att skriva om, rebuild att bygga upp igen och recycle att '
                'återvinna.'),
            sant("'Misunderstand' means to understand something wrongly.", True,
                 'Mis- betyder fel: misunderstand är att missförstå, och mispronounce är att uttala fel.'),
            sant("'Unlock' means to lock something again.", False,
                 'Un- framför ett verb betyder ofta att göra det motsatta: unlock är att låsa upp och '
                 'unpack att packa upp. Att låsa igen vore relock.'),
            para('Match the word with its opposite.',
                 [('honest', 'dishonest'), ('tidy', 'untidy'), ('correct', 'incorrect'),
                  ('patient', 'impatient'), ('responsible', 'irresponsible')],
                 'Förstavelsen får man oftast lära sig med ordet, men det finns mönster: im- före p '
                 '(impatient) och ir- före r (irresponsible).'),
            ordna('Build the sentence: Det är omöjligt att läsa hans handstil.',
                  ['It', 'is', 'impossible', 'to', 'read', 'his', 'handwriting.'], extra=['possible'],
                  forklaring='Omöjlig heter impossible: im- gör possible, möjlig, till sin motsats.'),
            val("Which prefix makes the opposite of 'appear'? The magician made the coin ___appear.",
                ['dis-', 'un-', 'im-'], 'dis-',
                'Disappear betyder försvinna, motsatsen till appear, visa sig. Dis- ger motsatsen till '
                'en del verb.'),
        ], beskrivning='Förstavelser (prefix) som ändrar vad ett ord betyder: un-, in-, im-, il-, ir- '
                       'och dis- ger motsatsen, re- betyder igen och mis- fel.'),

        niva('en-ak9-ordbildning-2', 'Kindness, careless, decision', 'Ordbildning', [
            val('Which of these words is a noun?', ['happiness', 'happily', 'happy', 'unhappily'], 'happiness',
                '-ness gör ett adjektiv till ett substantiv: dark – darkness, ill – illness. Happily och '
                'unhappily är adverb, och happy är ett adjektiv.'),
            skriv("Write the noun that comes from 'improve': There has been a big ___ in your English this year.",
                  'improvement',
                  '-ment gör många verb till substantiv: improve – improvement, agree – agreement, '
                  'enjoy – enjoyment.'),
            skriv("Write the noun that comes from 'decide': It was a difficult ___ to make.", 'decision',
                  'Decide blir decision. Stavningen ändras: d blir s före -ion, som i explode – '
                  'explosion.'),
            val("What does 'careless' mean?", ['slarvig', 'försiktig', 'omtänksam'], 'slarvig',
                '-less betyder utan: careless är utan omsorg, alltså slarvig. Careful, full av omsorg, '
                'betyder försiktig.'),
            sant("'Useless' means the same as 'useful'.", False,
                 '-ful betyder full av och -less betyder utan. Useful är användbar och useless '
                 'oanvändbar, alltså motsatser.'),
            val('Choose the right word: She sang ___ at the concert.',
                ['beautifully', 'beautiful', 'beauty', 'more beautiful'], 'beautifully',
                'Ordet säger hur hon sjöng, och då behövs ett adverb: beautiful + -ly blir beautifully.'),
            val("What kind of word is 'friendly' in 'She is very friendly'?",
                ['an adjective', 'an adverb', 'a preposition'], 'an adjective',
                'De flesta ord på -ly är adverb, men friendly är ett adjektiv: friend + -ly. Det '
                'beskriver hur hon är, som kind eller nice.'),
            para('Match the verb with the noun that is made from it.',
                 [('explain', 'explanation'), ('choose', 'choice'), ('succeed', 'success'),
                  ('invent', 'invention'), ('arrive', 'arrival')],
                 'Verb blir substantiv på olika sätt: med -tion (invention), -ation (explanation) och '
                 '-al (arrival), och ibland ändras ordet mer (choice, success).'),
            skriv("Write the adjective that comes from 'danger': Swimming in the river can be ___.", 'dangerous',
                  '-ous gör ett substantiv till ett adjektiv: danger – dangerous, fame – famous.'),
            ordna('Build the sentence: Tack för din vänlighet.',
                  ['Thank', 'you', 'for', 'your', 'kindness.'], extra=['kindly'],
                  forklaring='Efter your behövs ett substantiv, och kind + -ness blir kindness, '
                             'vänlighet. Kindly passar inte där.'),
        ], beskrivning='Ändelser (suffix) som gör ett ord till en annan ordklass: -ness, -ment och '
                       '-tion ger substantiv, -ful, -less och -ous adjektiv och -ly adverb.'),

        niva('en-ak9-modal-perfekt-1', 'You should have told me', 'Modala verb i perfekt', [
            val('Choose the right form: I failed the test. I ___ more.',
                ['should have studied', 'should studied', 'should have study', 'should have studying'],
                'should have studied',
                'Formen byggs med should + have + particip: should have studied. Det betyder borde ha '
                'pluggat, alltså något man ångrar.'),
            val("What does 'You should have called me' mean?",
                ['Du borde ha ringt mig', 'Du ska ringa mig i morgon', 'Du ringde mig'],
                'Du borde ha ringt mig',
                'Should have + particip handlar om dåtid: något som hade varit bra, men som inte blev '
                'gjort. Du ringde inte, men du borde ha gjort det.'),
            skriv("Write the past participle of 'go': We could have ___ to the beach, but we stayed at "
                  'home.', 'gone',
                  'Efter could have står particip: go – went – gone. Could have gone betyder kunde ha '
                  'åkt, men det blev inte av.'),
            sant("'She should of known' is correct written English.", False,
                 'Should’ve låter som should of när man pratar, men det skrivs should have eller '
                 'should’ve. Of är aldrig ett verb.'),
            val('Choose the right word: It was a great party, and you missed it. You ___ have come!',
                ['should', 'must', 'can'], 'should',
                'Det hade varit bra om du kommit, men du kom inte. Då blir det should have come, du '
                'borde ha kommit.'),
            skriv("Write the short form of 'should have', with an apostrophe: You ___ seen his face!",
                  "should've",
                  'Should have blir should’ve i talspråk och vardaglig text, som I’ve för I have. Skriv '
                  'aldrig should of.'),
            val('Which sentence says that something was possible, but it did not happen?',
                ['We could have won the match.', 'We won the match.', 'We can win the match next week.'],
                'We could have won the match.',
                'Could have + particip betyder att något var möjligt men inte hände: vi kunde ha vunnit, '
                'men vi gjorde det inte.'),
            para('Match the English sentence with the Swedish one.',
                 [('I should have left earlier.', 'Jag borde ha gått tidigare.'),
                  ('I could have left earlier.', 'Jag kunde ha gått tidigare.'),
                  ("I shouldn't have left.", 'Jag borde inte ha gått.'),
                  ('I would have left.', 'Jag skulle ha gått.')],
                 'Should have är borde ha, could have kunde ha och would have skulle ha. Med not efter '
                 'should blir det borde inte ha.'),
            ordna('Build the sentence: Du borde inte ha ätit så mycket godis.',
                  ['You', "shouldn't", 'have', 'eaten', 'so', 'many', 'sweets.'], extra=['ate'],
                  forklaring='Borde inte ha heter shouldn’t have, och efter have står particip: eat – '
                             'ate – eaten. Sweets är godis på brittisk engelska, och det är plural, så '
                             'det blir many.'),
            val("I'm so tired today. I ___ to bed so late last night.",
                ["shouldn't have gone", "shouldn't go", "haven't should go", "shouldn't have went"],
                "shouldn't have gone",
                'Du gick och lade dig sent i går och ångrar det nu. Ånger över något i dåtid uttrycks '
                'med shouldn’t have + particip: shouldn’t have gone. Went är preteritum och kan inte stå '
                'efter have.'),
        ], beskrivning='Should have, could have och would have plus particip: att tala om sådant som '
                       'borde ha hänt eller kunde ha hänt men inte gjorde det, och hur formen byggs.'),

        niva('en-ak9-modal-perfekt-2', 'She must have forgotten', 'Modala verb i perfekt', [
            val("Mia's jacket and bag are gone. She ___ gone home.",
                ['must have', "can't have", "needn't have"], 'must have',
                'Jackan och väskan är borta, så du är nästan säker på att hon har gått hem. Då säger '
                'man must have gone.'),
            val('Tom was in Gothenburg all day and all evening yesterday. He ___ been at the party in '
                'Stockholm last night.', ["can't have", 'must have', 'might have'], "can't have",
                'Tom var i Göteborg hela dagen och kvällen, så det är omöjligt att han var på festen i '
                'Stockholm. Då säger man can’t have been.'),
            val("I don't know why Sara is late. She ___ missed the bus, or maybe she overslept.",
                ['might have', 'must have', "can't have"], 'might have',
                'Du vet inte varför hon är sen, och det finns flera möjligheter. Då passar might have: '
                'hon kan ha missat bussen.'),
            sant("'He must have been tired' means that the speaker is almost sure that he was tired.",
                 True,
                 'Must have + particip är en slutsats: den som säger det är nästan säker. Han måste ha '
                 'varit trött.'),
            sant("'They might have left' means that the speaker is sure that they have left.", False,
                 'Might have betyder att något är möjligt, inte säkert: de kan ha gått. Är man säker '
                 'säger man they have left.'),
            skriv("Write the past participle of 'leave': My keys are not here. I must have ___ them at "
                  'school.', 'left',
                  'Efter must have står particip: leave – left – left. Must have left betyder måste ha '
                  'lämnat kvar.'),
            val('The streets are wet and there are puddles everywhere, but now the sun is shining. '
                'What is the best conclusion?',
                ['It must have rained.', "It can't have rained.", 'It must be raining now.'],
                'It must have rained.',
                'Vattenpölar på gatan visar nästan säkert att det har regnat, men nu skiner solen. '
                'Därför must have rained, inte must be raining.'),
            para('Match the sentence with what it means.',
                 [('She must have won.', 'Jag är nästan säker på att hon har vunnit.'),
                  ('She might have won.', 'Hon kanske har vunnit.'),
                  ("She can't have won.", 'Det är omöjligt att hon har vunnit.'),
                  ('She should have won.', 'Hon borde ha vunnit.')],
                 'Must have är nästan säkert, might have är kanske, can’t have är omöjligt och should '
                 'have är borde ha.'),
            ordna('Build the sentence: Han kan inte ha sett oss.',
                  ['He', "can't", 'have', 'seen', 'us.'], extra=['saw'],
                  forklaring='Kan inte ha heter can’t have, och efter have står particip: see – saw – '
                             'seen.'),
            skriv("Write one word that fits: I can't find my phone. I ___ have dropped it on the bus, "
                  "but I'm not sure.", ['might', 'may', 'could'],
                  'Du är inte säker, så det är en möjlighet: might, may eller could have dropped. Must '
                  'hade betytt att du är nästan säker.'),
        ], beskrivning='Att gissa vad som har hänt: must have när du är nästan säker, might have '
                       'eller may have när det är möjligt, och can’t have när det inte kan stämma.'),

        niva('en-ak9-varlden-1', 'Lift or elevator?', 'Engelska i världen', [
            val("The machine that takes people up and down in a building is a 'lift' in British "
                'English. What is it called in American English?',
                ['an elevator', 'an escalator', 'a ladder'], 'an elevator',
                'Hissen heter lift i Storbritannien och elevator i USA. En escalator är en rulltrappa, '
                'och den heter likadant i båda länderna.'),
            para('Match the British word with the American word.',
                 [('flat', 'apartment'), ('autumn', 'fall'), ('rubbish', 'garbage'),
                  ('holiday', 'vacation'), ('mobile phone', 'cell phone')],
                 'Samma sak kan ha olika namn på olika sidor av Atlanten. Båda sorternas ord är rätt, '
                 'och de flesta förstår båda.'),
            sant("In British English, 'travelled' is spelt with two l's.", True,
                 'I brittisk engelska dubbleras l: travelled, cancelled. I amerikansk engelska skriver '
                 'man oftast traveled och canceled.'),
            val('Which of these words is spelt the American way?',
                ['neighbor', 'centre', 'travelled', 'colour'], 'neighbor',
                'I amerikansk engelska skrivs -our ofta -or: neighbour blir neighbor. Centre, travelled '
                'och colour är brittisk stavning.'),
            val("In Britain, 'football' usually means the game that Americans call …",
                ['soccer', 'baseball', 'rugby'], 'soccer',
                'I USA betyder football amerikansk fotboll, ett annat spel. Den fotboll vi spelar i '
                'Sverige kallas därför soccer där.'),
            skriv("In Britain you buy a bag of 'crisps'. What do Americans call them? Write one word.",
                  ['chips', 'potato chips'],
                  'Chips heter crisps i Storbritannien och chips i USA. Men se upp: chips i '
                  'Storbritannien är pommes frites, som heter fries i USA.'),
            val('An American writes the date 4/7/2026. Which day does she most likely mean?',
                ['7 April 2026', '4 July 2026'], '7 April 2026',
                'I USA skriver man oftast månaden först: 4/7 är April 7, den 7 april. I Storbritannien '
                'kommer dagen först, och där är 4/7 den 4 juli.'),
            sant("What the British call 'trousers', Americans call 'pants'.", True,
                 'Byxor heter trousers i Storbritannien och pants i USA. I Storbritannien betyder pants '
                 'underbyxor, så det kan bli ett roligt missförstånd.'),
            ordna('Build the sentence in American English: Vi tog tunnelbanan till vår lägenhet.',
                  ['We', 'took', 'the', 'subway', 'to', 'our', 'apartment.'],
                  extra=['underground', 'flat.'],
                  forklaring='Tunnelbanan heter subway i New York och flera andra städer i USA, och en '
                             'lägenhet heter apartment. I Storbritannien heter lägenheten flat, och i '
                             'London tar man the underground eller the Tube.'),
            skriv("Write the British spelling of the American word 'favorite'.", 'favourite',
                  'Brittisk engelska har ofta -our där amerikansk har -or: favourite – favorite, colour '
                  '– color.'),
        ], beskrivning='Brittisk och amerikansk engelska: olika ord för samma sak, olika stavning och '
                       'olika sätt att skriva datum.'),

        niva('en-ak9-varlden-2', 'One language, many Englishes', 'Engelska i världen', [
            val('Which country does the text give as an example of a place where English is an '
                'official language, although most people there grew up with another language?',
                ['Nigeria', 'Ireland', 'Sweden', 'Japan'], 'Nigeria',
                'Det står for example India, Nigeria and the Philippines, it is an official language … '
                'even though most people there grew up speaking another language at home. På Irland '
                'är engelska förstaspråket för de flesta.'),
            sant('According to the text, more people speak English as their first language than as a '
                 'second or foreign language.', False,
                 'Det står tvärtom: more people speak English as a second or foreign language than as '
                 'their first language.'),
            val('What does the text give as one reason why English spread around the world?',
                ['Britain built a large empire', 'English has more words than other languages',
                 'English is the easiest language to learn', 'Swedish pupils learn it at school'],
                'Britain built a large empire',
                'Det står From the 1600s onwards, Britain built a large empire, and English travelled '
                'with its ships. Texten säger inget om att engelska skulle vara lättare eller ha fler '
                'ord.'),
            skriv("Find the expression in the text that means 'a shared language between people who "
                  "have different first languages'.", ['lingua franca', 'a lingua franca'],
                  'Det står English is often used as a lingua franca: a shared language between people '
                  'who have different first languages.'),
            val('Why do the pilot from Brazil and the air traffic controller in Germany use English?',
                ['They need a shared language', 'English is the main language of Brazil',
                 'English is the main language of Germany', 'They both grew up speaking English'],
                'They need a shared language',
                'Piloten och flygledaren kommer från olika länder och har olika förstaspråk. Engelska '
                'är det språk som de båda kan.'),
            skriv('What is the afternoon often called in informal Australian English, according to the '
                  'text? Write the word.', ['arvo', 'the arvo'],
                  'Det står the afternoon is often called the “arvo”. Det är ett vardagligt ord, och det '
                  'visar att engelska låter olika på olika platser.'),
            para('Match the English word with the language it comes from, according to the text.',
                 [('shampoo', 'Hindi'), ('robot', 'Czech'), ('tsunami', 'Japanese'),
                  ('ombudsman', 'Swedish')],
                 'Engelska har lånat ord från hela världen. Ombudsman kommer från svenska, och ordet '
                 'används också på engelska.'),
            val('Why does the writer compare English with Swedish in Skåne and in Norrland?',
                ['To show that different ways of speaking are not wrong',
                 'To show that Swedish is harder to learn than English',
                 'To show that people in Skåne and Norrland often speak English with each other',
                 'To show that English is spoken in Sweden'],
                'To show that different ways of speaking are not wrong',
                'Svenska låter olika i Skåne och i Norrland, men inget av sätten är fel. På samma sätt '
                'är australisk och indisk engelska inte fel, bara annorlunda.'),
            val('What is the main message of the text?',
                ['English belongs to many people and comes in many forms',
                 'British English is the only correct kind of English in the world',
                 'English will soon replace all other languages',
                 'English stopped changing a long time ago'],
                'English belongs to many people and comes in many forms',
                'Texten visar att engelska talas på många platser och i många varianter, och slutar med '
                'att det inte finns en enda rätt engelska. De andra alternativen säger texten emot.'),
            ordna('Put the events in the order the text describes them.',
                  ['Britain built a large empire', 'The United States became very powerful',
                   'The internet carried English further'],
                  forklaring='Imperiet byggdes från 1600-talet. USA blev en stormakt på 1900-talet, och '
                             'sedan kom internet.'),
        ], beskrivning='En faktatext om hur engelskan spreds över världen och lever i många '
                       'varianter, med frågor om vad som står och vad skribenten vill säga.',
            text=ENGELSKAN_I_VARLDEN),
    ]),
]
