# -*- coding: utf-8 -*-
"""Engelska åk 1 och 2: de första orden. Banorna för åk 3 och uppåt står i
engelska_mer.py, engelska.py och blad_engelska.py. De här ligger före dem och
är lättare än åk 3: mest enstaka ord och korta fraser, grammatik bara i
förbigående (stort I, ett s när det är flera), och ingen fråga som åk 3
redan har.

Innehållet bygger på Lgr22:s centrala innehåll i engelska för åk 1–3, som
utgår från ämnesområden som är välbekanta för eleverna och från vardagliga
situationer, personer och platser, med korta fraser som hälsningar och
artighetsfraser. Läroplanen räknar inte upp några ord, så urvalet är vårt
eget, vanliga ord som en sjuåring känner igen:
- åk 1: hälsningar och färger, talen upp till tio och djuren, familjen och
  kroppen.
- åk 2: talen upp till tjugo och veckodagarna, mat och kläder, skolan och
  korta meningar om sig själv (I am, I like, I have, This is).

Barnen är 7–8 år och läser med en vuxen. Frågorna är korta och på enkel
svenska. De flesta är para (engelska till vänster, svenska till höger), val
och sant; ordna har tre eller fyra brickor, och skriv används bara för korta
ord som stavas på ett sätt (cat, ten, hat). Där ett barn rimligen skriver en
annan form godtas den också (a cat och kitty; dad, daddy och father).

Talen hämtas ur listan TAL, veckodagarna ur DAGAR, och räknefrågornas facit
räknas här, så att ett ord och dess siffra inte kan glida isär.

Förenklat:
- Ett ord har ofta flera översättningar. Frågan använder den vanligaste
  (please är snälla, desk är skolbänk, board är tavla), och där två svar
  hade varit rätt står bara det ena bland alternativen (mamma är både mum
  och mom, och mom finns inte med).
- Brittisk engelska, som i resten av banken (mum, grey, jumper).
  Förklaringen nämner den amerikanska formen där den skiljer.
- En förklaring om ett ords ursprung står bara där det är säkert: Monday är
  månens dag, Sunday solens och Thursday Tors, precis som på svenska."""
from grund import bana, niva, val, skriv, ordna, sant, para, tal

# Talen på engelska och svenska, med talet som plats i listan.
TAL = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
       'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
       'nineteen', 'twenty']
SV = ['noll', 'ett', 'två', 'tre', 'fyra', 'fem', 'sex', 'sju', 'åtta', 'nio', 'tio',
      'elva', 'tolv', 'tretton', 'fjorton', 'femton', 'sexton', 'sjutton', 'arton', 'nitton', 'tjugo']
assert len(TAL) == len(SV) == 21
# Förklaringarna säger att talen från 13 till 19 slutar på -teen, och bara de.
assert [n for n, t in enumerate(TAL) if t.endswith('teen')] == list(range(13, 20))

# Veckan i svensk ordning, från måndag.
DAGAR = [('Monday', 'måndag'), ('Tuesday', 'tisdag'), ('Wednesday', 'onsdag'),
         ('Thursday', 'torsdag'), ('Friday', 'fredag'), ('Saturday', 'lördag'),
         ('Sunday', 'söndag')]
VECKAN = [e for e, _ in DAGAR]
assert TAL[len(DAGAR)] == 'seven'


def dagar(*namn):
    return [(e, s) for e, s in DAGAR if e in namn]


def efter(dag, steg=1):
    return VECKAN[(VECKAN.index(dag) + steg) % len(VECKAN)]


def lista(delar):
    """'a, b och c'."""
    return delar[0] if len(delar) == 1 else ', '.join(delar[:-1]) + ' och ' + delar[-1]


def mening(t):
    return t[0].upper() + t[1:] + '.'


def med_siffror(*talen):
    return [(TAL[n], tal(n)) for n in talen]


def pa_svenska(*talen):
    return [(TAL[n], SV[n]) for n in talen]


def vad_ar(par):
    """Förklaringen till en para-fråga om tal: 'One är 1, two är 2 och three är 3.'"""
    return mening(lista(['%s är %s' % (v, h) for v, h in par]))


def vilket_tal(n, fel, forklaring):
    assert n not in fel and len(set(fel)) == len(fel)
    return val("Vilket tal är '%s'?" % TAL[n], [tal(n)] + [tal(f) for f in fel], tal(n), forklaring)


def plus(a, b, fel):
    """Räknefråga med svaret som ett engelskt ord. fel är talen i de
    felaktiga alternativen."""
    summa = a + b
    assert summa < len(TAL) and summa not in fel and len(set(fel)) == len(fel)
    return val('Hur mycket är %s + %s?' % (TAL[a], TAL[b]), [TAL[summa]] + [TAL[f] for f in fel],
               TAL[summa], '%s plus %s är %s, och %s heter %s.'
               % (SV[a].capitalize(), SV[b], SV[summa], SV[summa], TAL[summa]))


def i_ordning(fraga, talen):
    assert list(talen) == sorted(talen) and len(set(talen)) == len(talen)
    ord_ = [TAL[n] for n in talen]
    return ordna(fraga, ord_, forklaring=mening('%s är %s' % (lista(ord_), lista([tal(n) for n in talen]))))


BANOR = [
    # ================================================================ Åk 1
    bana('Engelska', 'ak1', [
        niva('en-ak1-hej-farger-1', 'Hello!', 'Hej och färger', [
            para('Para ihop orden som betyder samma sak.',
                 [('hello', 'hej'), ('goodbye', 'hej då'), ('please', 'snälla'), ('no', 'nej')],
                 'Hello säger du när du kommer och goodbye när du går. Please är snälla och no är nej.'),
            val("Vad betyder 'hi'?", ['hej', 'hej då', 'tack'], 'hej',
                'Hi är ett kortare sätt att säga hello. Båda betyder hej.'),
            sant("'Thank you' betyder tack.", True,
                 'Thank you säger du när du får något eller när någon hjälper dig. Det betyder tack.'),
            para('Vad hör ihop? Para ihop.',
                 [('good morning', 'god morgon'), ('good night', 'god natt'), ('sorry', 'förlåt')],
                 'Good morning säger du på morgonen och good night när du ska sova. Sorry betyder förlåt.'),
            skriv("Skriv 'ja' på engelska.", ['yes', 'yeah'],
                  'Ja heter yes. Nej heter no.'),
            ordna('Bygg meningen: Jag är Sam.', ['I', 'am', 'Sam.'],
                  forklaring='Jag är heter I am. Ordet I skrivs alltid med stor bokstav.'),
            # Inte hi bland alternativen: det hade också varit rätt.
            val('Du träffar en kompis. Vad säger du?', ['Hello!', 'Goodbye!', 'Good night!'], 'Hello!',
                'När du träffar någon säger du hello. Goodbye säger du när du går, och good night när du ska sova.'),
            para('Para ihop orden på engelska och svenska.',
                 [('hi', 'hej'), ('bye', 'hej då'), ('thank you', 'tack'), ('yes', 'ja')],
                 'Hi är ett kort hello och bye ett kort goodbye. Thank you är tack och yes är ja.'),
        ], beskrivning='Att säga hej, hej då, tack och snälla på engelska.'),

        niva('en-ak1-hej-farger-2', 'Red, blue, green', 'Hej och färger', [
            para('Para ihop färgerna.',
                 [('red', 'röd'), ('yellow', 'gul'), ('white', 'vit'), ('purple', 'lila')],
                 'Red är röd och yellow är gul. White är vit och purple är lila.'),
            val("Vad betyder 'blue'?", ['blå', 'brun', 'grön'], 'blå',
                'Blue betyder blå, och orden låter nästan likadant. Brun heter brown och grön heter green.'),
            sant("'Pink' betyder lila.", False,
                 'Pink betyder rosa. Lila heter purple.'),
            # Inte samma fyra som åk 3 (black, white, green, pink).
            para('Vilken färg är vilken? Para ihop.',
                 [('black', 'svart'), ('pink', 'rosa'), ('grey', 'grå'), ('orange', 'orange')],
                 'Black är svart, pink är rosa och grey är grå. I USA stavas grå gray.'),
            skriv("Skriv 'brun' på engelska.", 'brown',
                  'Brun heter brown, och orden låter nästan likadant.'),
            ordna('Bygg meningen: Jag tycker om blått.', ['I', 'like', 'blue.'],
                  forklaring='Jag tycker om heter I like. Sedan kommer färgen: I like blue.'),
            val('Vilken färg har mjölk?', ['white', 'black', 'green'], 'white',
                'Mjölk är vit, och vit heter white.'),
            val('Du blandar blå och gul färg. Vilken färg får du?', ['green', 'orange', 'purple'], 'green',
                'Blått och gult blir grönt, och grön heter green. Orange får du av rött och gult.'),
        ], beskrivning='Färgerna på engelska, från red och blue till purple och grey.'),

        niva('en-ak1-tal-djur-1', 'One, two, three', 'Tal och djur', [
            para('Para ihop ordet med rätt siffra.', med_siffror(1, 2, 3, 4),
                 vad_ar(med_siffror(1, 2, 3, 4))),
            vilket_tal(5, (4, 9), '%s är %s, alltså %s. %s är %s och %s är %s.'
                       % (TAL[5].capitalize(), SV[5], tal(5), TAL[4].capitalize(), tal(4), TAL[9], tal(9))),
            sant("'Two' betyder två.", True,
                 'Two betyder två. Det stavas med w, men w:et hörs inte.'),
            para('Vilket ord hör till vilken siffra? Para ihop.', med_siffror(9, 6, 8, 7),
                 vad_ar(med_siffror(9, 6, 8, 7))),
            skriv('Hur skriver man 10 på engelska? Skriv ordet.', TAL[10],
                  'Tio heter %s. Det stavas %s.' % (TAL[10], lista(list(TAL[10])))),
            i_ordning('Räkna uppåt på engelska! Sätt talen i ordning.', (7, 8, 9, 10)),
            plus(2, 3, (4, 6)),
            para('Para ihop det engelska talet med det svenska.', pa_svenska(1, 3, 5, 10),
                 vad_ar(pa_svenska(1, 3, 5, 10))),
        ], beskrivning='Talen från ett till tio på engelska.'),

        niva('en-ak1-tal-djur-2', 'Cat and dog', 'Tal och djur', [
            para('Para ihop djuren.',
                 [('dog', 'hund'), ('cow', 'ko'), ('horse', 'häst'), ('duck', 'anka')],
                 'Dog är hund och cow är ko. Horse är häst och duck är anka.'),
            val("Vilket djur är 'fish'?", ['fisk', 'fågel', 'får'], 'fisk',
                'Fish betyder fisk. Fågel heter bird och får heter sheep.'),
            sant("'Mouse' betyder mus.", True,
                 'Mouse betyder mus, och orden låter nästan likadant.'),
            para('Vilket djur är vilket? Para ihop.',
                 [('bird', 'fågel'), ('sheep', 'får'), ('frog', 'groda'), ('lion', 'lejon')],
                 'Bird är fågel och sheep är får. Frog är groda och lion är lejon.'),
            # Kitty är ett smeknamn som kisse: inte fel, så det godtas.
            skriv("Skriv 'katt' på engelska.", ['cat', 'a cat', 'kitty'],
                  'Katt heter cat. Det låter som katt men stavas med c och ett t.'),
            ordna('Bygg meningen: Jag ser en fågel.', ['I', 'see', 'a', 'bird.'],
                  forklaring='Jag ser heter I see, och en fågel heter a bird.'),
            val("Vad heter 'gris' på engelska?", ['pig', 'cow', 'dog'], 'pig',
                'Gris heter pig. Cow är ko och dog är hund.'),
            para('Para ihop djurens namn.',
                 [('rabbit', 'kanin'), ('bear', 'björn'), ('monkey', 'apa'), ('elephant', 'elefant')],
                 'Rabbit är kanin och bear är björn. Monkey är apa och elephant är elefant.'),
        ], beskrivning='Djur på engelska: hund, katt, ko, fågel och fler.'),

        niva('en-ak1-familj-kropp-1', 'Mum and dad', 'Familjen och kroppen', [
            para('Para ihop orden om familjen.',
                 [('sister', 'syster'), ('brother', 'bror'), ('baby', 'bebis')],
                 'Sister är syster och brother är bror. Baby är bebis.'),
            val("Vem är 'grandma'?", ['mormor eller farmor', 'morfar eller farfar', 'moster eller faster'],
                'mormor eller farmor',
                'Grandma är mammas eller pappas mamma, alltså mormor eller farmor. Morfar och farfar heter grandpa.'),
            sant("'Grandpa' betyder morfar eller farfar.", True,
                 'Grandpa är mammas eller pappas pappa. Det är din morfar eller farfar.'),
            skriv("Skriv 'pappa' på engelska.", ['dad', 'daddy', 'father'],
                  'Pappa heter dad. Du kan också skriva daddy eller father.'),
            para('Vad betyder orden? Para ihop.',
                 [('boy', 'pojke'), ('girl', 'flicka'), ('friend', 'kompis'), ('family', 'familj')],
                 'Boy är pojke och girl är flicka. Friend är kompis och family är familj.'),
            ordna('Bygg meningen: Jag har en bror.', ['I', 'have', 'a', 'brother.'],
                  forklaring='Jag har heter I have, och en bror heter a brother.'),
            # Inte mom bland alternativen: mamma är både mum och mom.
            val("Vad heter 'mamma' på engelska?", ['mum', 'dad', 'man'], 'mum',
                'Mamma heter mum. I USA säger man mom.'),
            para('Vem är vem i familjen? Para ihop.',
                 [('mum', 'mamma'), ('dad', 'pappa'), ('grandma', 'mormor eller farmor'),
                  ('grandpa', 'morfar eller farfar')],
                 'Mum och dad är mamma och pappa. Grandma och grandpa är deras mammor och pappor.'),
        ], beskrivning='Familjen på engelska: mamma, pappa, syskon, mormor och morfar.'),

        niva('en-ak1-familj-kropp-2', 'Head and toes', 'Familjen och kroppen', [
            para('Para ihop kroppsdelarna.',
                 [('head', 'huvud'), ('mouth', 'mun'), ('eye', 'öga'), ('toe', 'tå')],
                 'Head är huvud och mouth är mun. Eye är öga och toe är tå.'),
            val("Vad betyder 'hair'?", ['hår', 'hand', 'huvud'], 'hår',
                'Hair betyder hår, och orden liknar varandra. Huvud heter head.'),
            sant("'Foot' betyder hand.", False,
                 'Foot betyder fot. Hand heter hand på engelska också.'),
            para('Vad heter delarna? Para ihop.',
                 [('nose', 'näsa'), ('neck', 'hals'), ('knee', 'knä'), ('arm', 'arm')],
                 'Nose är näsa och neck är hals. Knee är knä, och arm är arm på båda språken.'),
            skriv("Skriv 'öra' på engelska.", ['ear', 'an ear'],
                  'Öra heter ear. Två öron heter ears.'),
            ordna('Bygg meningen: Mitt hår är brunt.', ['My', 'hair', 'is', 'brown.'],
                  forklaring='Mitt hår heter my hair, och brunt heter brown. Är heter is.'),
            # Ben är också ett skelettben, men bland alternativen finns bara
            # kroppsdelar, och förklaringen säger vilket ben det är.
            val("Vad betyder 'leg'?", ['ben', 'arm', 'fot'], 'ben',
                'Leg betyder ben, alltså det du går med. Fot heter foot.'),
            para('Para ihop orden om kroppen.',
                 [('foot', 'fot'), ('tooth', 'tand'), ('finger', 'finger'), ('ear', 'öra')],
                 'Foot är fot och tooth är tand. Finger heter finger på båda språken, och ear är öra.'),
        ], beskrivning='Kroppens delar på engelska, från huvudet till tårna.'),
    ]),

    # ================================================================ Åk 2
    bana('Engelska', 'ak2', [
        niva('en-ak2-tal-dagar-1', 'Eleven to twenty', 'Tal och veckodagar', [
            para('Para ihop talet med siffrorna.', med_siffror(11, 12, 14, 20),
                 vad_ar(med_siffror(11, 12, 14, 20))),
            vilket_tal(16, (6, 60), '%s är %s: %s och -teen. Talen från 13 till 19 slutar på -teen.'
                       % (TAL[16].capitalize(), tal(16), TAL[6])),
            sant("'Twelve' betyder tjugo.", False,
                 'Twelve betyder %s. Tjugo heter %s.' % (SV[12], TAL[20])),
            para('Vilket tal är vilket? Para ihop.', med_siffror(15, 13, 18, 19),
                 vad_ar(med_siffror(15, 13, 18, 19)) + ' Alla slutar på -teen.'),
            skriv("Vilket tal är '%s'? Skriv det med siffror." % TAL[17], tal(17),
                  '%s är %s och -teen, alltså %s: %s.' % (TAL[17].capitalize(), TAL[7], SV[17], tal(17))),
            i_ordning('Sätt talen i ordning. Börja med det minsta talet.', (9, 10, 11, 12)),
            plus(10, 10, (12, 11)),
            para('Para ihop talen på engelska och svenska.', pa_svenska(12, 20, 13, 17),
                 vad_ar(pa_svenska(12, 20, 13, 17))),
        ], beskrivning='Talen upp till tjugo på engelska, och lite räkning.'),

        niva('en-ak2-tal-dagar-2', 'Monday to Sunday', 'Tal och veckodagar', [
            para('Para ihop veckodagarna.', dagar('Monday', 'Wednesday', 'Friday'),
                 'Monday är måndag, månens dag. Wednesday är onsdag och Friday är fredag.'),
            val("Vilken dag är 'Sunday'?", ['söndag', 'lördag', 'måndag'], 'söndag',
                'Sunday betyder solens dag, precis som söndag. Sun betyder sol.'),
            sant("'Thursday' betyder tisdag.", False,
                 'Thursday betyder torsdag, Tors dag. Tisdag heter Tuesday.'),
            para('Para ihop dagarna som är lätta att blanda ihop.',
                 dagar('Tuesday', 'Thursday', 'Saturday', 'Sunday'),
                 'Tuesday är tisdag och Thursday är torsdag. Saturday är lördag och Sunday är söndag.'),
            skriv("En vecka har sju dagar. Skriv 'sju' på engelska.", TAL[len(DAGAR)],
                  'Sju heter %s. Veckan har sju dagar, från Monday till Sunday.' % TAL[7]),
            ordna('Sätt dagarna i ordning. Börja med onsdag.', VECKAN[2:5],
                  forklaring='Efter onsdag kommer torsdag och sedan fredag: %s.' % lista(VECKAN[2:5])),
            val('Vilken dag kommer efter Monday?', [efter('Monday'), 'Thursday', 'Sunday'], efter('Monday'),
                'Efter måndag kommer tisdag, och tisdag heter Tuesday. Thursday är torsdag.'),
            val('Vilken dag kommer före Saturday?', [efter('Saturday', -1), 'Sunday', 'Thursday'],
                efter('Saturday', -1),
                'Före lördag kommer fredag, och fredag heter Friday. Sunday kommer efter Saturday.'),
        ], beskrivning='Veckans sju dagar på engelska, och i vilken ordning de kommer.'),

        niva('en-ak2-mat-klader-1', 'Apples and bananas', 'Mat och kläder', [
            para('Para ihop frukterna.',
                 [('apple', 'äpple'), ('banana', 'banan'), ('orange', 'apelsin'), ('lemon', 'citron')],
                 'Apple är äpple och banana är banan. Orange är apelsin och lemon är citron.'),
            val("Vad heter 'vatten' på engelska?", ['water', 'milk', 'juice'], 'water',
                'Vatten heter water. Milk är mjölk och juice är juice.'),
            sant("'Orange' betyder citron.", False,
                 'Orange betyder apelsin, och det är också namnet på färgen orange. Citron heter lemon.'),
            para('Para ihop maten.',
                 [('rice', 'ris'), ('soup', 'soppa'), ('meat', 'kött'), ('chicken', 'kyckling')],
                 'Rice är ris och soup är soppa. Meat är kött och chicken är kyckling.'),
            skriv("Skriv 'fisk' på engelska.", ['fish', 'a fish'],
                  'Fisk heter fish. Det låter nästan som fisk men slutar på sh.'),
            ordna('Bygg meningen: Jag äter en banan.', ['I', 'eat', 'a', 'banana.'],
                  forklaring='Jag äter heter I eat, och en banan heter a banana.'),
            val("Vad betyder 'grapes'?", ['vindruvor', 'jordgubbar', 'blåbär'], 'vindruvor',
                'Grapes betyder vindruvor. Jordgubbar heter strawberries och blåbär heter blueberries.'),
            val('Vad kan man dricka?', ['milk', 'bread', 'rice'], 'milk',
                'Milk är mjölk, och mjölk kan man dricka. Bread är bröd och rice är ris.'),
        ], beskrivning='Frukt, mat och dryck på engelska.'),

        niva('en-ak2-mat-klader-2', 'Hat and shoes', 'Mat och kläder', [
            para('Para ihop kläderna.',
                 [('shoes', 'skor'), ('socks', 'strumpor'), ('dress', 'klänning'), ('jacket', 'jacka')],
                 'Shoes är skor och socks är strumpor. Dress är klänning och jacket är jacka.'),
            val("Vad heter 'keps' på engelska?", ['cap', 'cat', 'cup'], 'cap',
                'Keps heter cap. Cat är katt och cup är kopp: det är bokstaven i mitten som skiljer.'),
            sant("'Skirt' betyder kjol.", True,
                 'Skirt betyder kjol. En klänning heter dress.'),
            para('Para ihop orden om kläder.',
                 [('boots', 'stövlar'), ('scarf', 'halsduk'), ('jumper', 'tröja'), ('gloves', 'handskar')],
                 'Boots är stövlar och scarf är halsduk. Jumper är tröja, som också kan heta sweater, '
                 'och gloves är handskar.'),
            skriv("Skriv 'hatt' på engelska.", ['hat', 'a hat'],
                  'Hatt heter hat, med bara ett t.'),
            ordna('Bygg meningen: Jag har röda skor.', ['I', 'have', 'red', 'shoes.'],
                  forklaring='Färgen står före saken, precis som på svenska: red shoes.'),
            val('Vad har du på händerna när det är kallt?', ['gloves', 'shorts', 'sandals'], 'gloves',
                'Gloves betyder handskar, och de håller händerna varma. Shorts och sandals har du på sommaren.'),
            sant("'Socks' betyder skor.", False,
                 'Socks betyder strumpor. Skor heter shoes.'),
        ], beskrivning='Kläder på engelska, och vad du har på dig när det är kallt.'),

        niva('en-ak2-skolan-jag-1', 'Pencil and ruler', 'Skolan och jag', [
            # Inte pen bredvid pencil: båda är penna på svenska.
            para('Para ihop sakerna i skolan.',
                 [('pencil', 'blyertspenna'), ('ruler', 'linjal'), ('glue', 'lim'), ('paper', 'papper')],
                 'Pencil är blyertspenna och ruler är linjal. Glue är lim och paper är papper.'),
            val("Vad betyder 'teacher'?", ['lärare', 'elev', 'rektor'], 'lärare',
                'Teacher betyder lärare. Teach betyder lära ut, och det gör en lärare.'),
            sant("'Bag' betyder väska.", True,
                 'Bag betyder väska, till exempel din skolväska.'),
            para('Para ihop orden från klassrummet.',
                 [('desk', 'skolbänk'), ('chair', 'stol'), ('crayons', 'kritor'), ('board', 'tavla')],
                 'Desk är skolbänk och chair är stol. Crayons är kritor och board är tavla.'),
            skriv("Skriv 'bok' på engelska.", ['book', 'a book'],
                  'Bok heter book. Det stavas med två o.'),
            ordna('Bygg meningen: Det här är min lärare.', ['This', 'is', 'my', 'teacher.'],
                  forklaring='Det här är heter this is, och min lärare heter my teacher.'),
            val("Vad betyder 'scissors'?", ['sax', 'lim', 'linjal'], 'sax',
                'Scissors betyder sax. Ordet slutar på s, fast det bara är en sax.'),
            para('Para ihop orden om skolan.',
                 [('school', 'skola'), ('classroom', 'klassrum'), ('book', 'bok'), ('teacher', 'lärare')],
                 'School är skola och classroom är klassrum. Book är bok och teacher är lärare.'),
        ], beskrivning='Saker i skolan och klassrummet på engelska.'),

        niva('en-ak2-skolan-jag-2', 'This is me!', 'Skolan och jag', [
            ordna('Bygg meningen: Jag tycker om hästar.', ['I', 'like', 'horses.'],
                  forklaring='I like betyder jag tycker om. Horses har ett s på slutet, för det är flera hästar.'),
            val("Vad betyder 'I am happy'?", ['Jag är glad.', 'Jag är trött.', 'Jag är arg.'], 'Jag är glad.',
                'Happy betyder glad, och I am betyder jag är. Trött heter tired och arg heter angry.'),
            sant("'I have a dog' betyder jag är en hund.", False,
                 'Have betyder har, så I have a dog betyder jag har en hund. Jag är heter I am.'),
            para('Para ihop meningarna.',
                 [('I like red.', 'Jag tycker om rött.'), ('I have a ball.', 'Jag har en boll.'),
                  ('This is my bag.', 'Det här är min väska.'), ('I am tired.', 'Jag är trött.')],
                 'I like är jag tycker om och I have är jag har. This is är det här är, och I am är jag är.'),
            skriv('Skriv ordet som fattas: This ___ my cat. (Det här är min katt.)', 'is',
                  'Det här är heter this is. Efter this kommer is.'),
            ordna('Bygg meningen: Jag är sju.', ['I', 'am', 'seven.'],
                  forklaring='Jag är heter I am. När du säger hur gammal du är räcker talet: I am seven.'),
            # Inte "Jag tycker om pizza." bland alternativen: det hade också
            # varit rätt.
            val("Vad betyder 'I like pizza'?", ['Jag gillar pizza.', 'Jag har en pizza.', 'Jag vill ha pizza.'],
                'Jag gillar pizza.',
                'Like betyder gillar eller tycker om. Jag har heter I have och jag vill ha heter I want.'),
            para('Hur känns det? Para ihop.',
                 [('happy', 'glad'), ('sad', 'ledsen'), ('hungry', 'hungrig'), ('angry', 'arg')],
                 'Happy är glad och sad är ledsen. Hungry är hungrig och angry är arg.'),
        ], beskrivning='Korta meningar om dig själv: I am, I like, I have och This is.'),
    ]),
]
