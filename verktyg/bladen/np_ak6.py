# -*- coding: utf-8 -*-
"""NP-träning för åk 6: Nextrums egna uppgifter i samma stil som de nationella proven, och
genomgångar som förklarar det proven frågar efter. Aldrig provens egna uppgifter, och aldrig text
ur läroböcker: proven och böckerna är upphovsrättsskyddade (se verktyg/bladen/lankar.py och
minne/databasen.md). Format och regler: se verktyg/bygg-banken.py."""
from figurer import *  # noqa: F401,F403

BLAD = [
    # ---- NP-träning, åk 6 (2026-10-02) ----
    # Egna uppgifter i samma stil som de nationella proven, aldrig provens egna. Upplägget kommer ur
    # provgruppernas beskrivningar: matematik med och utan miniräknare och nivåerna E, C och A,
    # svenska och engelska med läs- och skrivdelar.
    dict(fil='ak6-np-matematik-utan-miniraknare', arskurs='ak6', amne='Matematik',
         titel='NP-träning: matematik utan miniräknare', omrade='Nationella provet i matematik, åk 6', tid='35 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provet finns delar där du bara skriver svaret och delar där du visar hur du har tänkt. Här räknar du utan miniräknare.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('a) 305 − 48 = [[]]    b) 6 · 70 = [[]]    c) 0,6 + 0,25 = [[]] {E}', 0),
                    ('Skriv 3/4 i decimalform. [[]] {E}', 0), ('Hur mycket är 10 % av 90 kr? [] kr {E}', 0),
                    ('En film börjar 17.45 och är 1 timme och 35 minuter lång. När slutar den? [[]] {E}', 0),
                    ('Vilket tal ligger mitt emellan 1,4 och 1,8? [] {C}', 0),
                    ('Vilket tal ska stå i rutan? 4 · [] + 3 = 31 {C}', 0),
                    ('Skriv talen i storleksordning, minst först: 0,5; 2/5; 0,45 {C}', 1),
                    ('Figurerna är byggda av tändstickor. Hur många stickor behövs till figur 10? [] {C}', 0,
                     stickfigurer(1, 2, 3)),
                    ('Skriv en regel för hur många stickor som behövs till en figur med vilket nummer som helst. {A}', 2),
                    ('En rektangel har omkretsen 24 cm. Den ena sidan är dubbelt så lång som den andra. Hur långa är sidorna? {A}', 2)],
         beskrivning='Träning inför nationella provet i matematik åk 6, utan miniräknare: räkning, tal i olika former, mönster och problem på nivåerna E, C och A.'),

    dict(fil='ak6-np-matematik-problemlosning', arskurs='ak6', amne='Matematik',
         titel='NP-träning: problemlösning i matematik', omrade='Nationella provet i matematik, åk 6', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Visa hur du löser uppgifterna: skriv uträkningar, rita eller förklara med ord. Du får använda miniräknare.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('Klass 6B ska åka på utflykt. Bussen kostar 3 600 kr och 24 elever åker med. Hur mycket blir det per elev? {E}', 1),
                    ('Tabellen visar hur många böcker fyra elever läste under sommaren. Beräkna medelvärdet. {E}', 1,
                     tabell(['Elev', 'Ali', 'Bea', 'Cem', 'Dina'], [['Antal böcker', 3, 5, 2, 6]], bredd_kol=110)),
                    ('En femte elev läste också under sommaren. Hur många böcker måste hon ha läst för att medelvärdet för alla fem ska bli 5? {C}', 1),
                    ('Saga och Theo delar på 120 kr så att Saga får 30 kr mer än Theo. Hur mycket får var och en? {C}', 2),
                    ('En tröja kostar 250 kr. I en butik sänks priset med 20 %, och i en annan med 45 kr. I vilken butik blir tröjan billigast? Visa hur du vet. {C}', 2),
                    ('Lisa säger: ”Om man gör sidorna i en kvadrat dubbelt så långa blir arean dubbelt så stor.” Har hon rätt? Förklara med ett exempel. {A}', 2)],
         beskrivning='Träning inför nationella provet i matematik åk 6 med miniräknare: problemlösning, medelvärde, procent och resonemang på nivåerna E, C och A.'),

    dict(fil='ak6-np-svenska-lasa', arskurs='ak6', amne='Svenska',
         titel='NP-träning: läsa och förstå en faktatext', omrade='Nationella provet i svenska, åk 6', tid='35 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provet läser du både faktatexter och berättelser. Läs texten noga och gå tillbaka till den när du svarar.',
                      'Vissa svar står direkt i texten. Andra måste du komma fram till själv genom att tänka efter.'],
         text=['# Ladusvalan – en fågel som reser långt',
               'Ladusvalan är en liten fågel med blåsvart rygg, rödbrun strupe och en lång, kluven stjärt. Den lever av '
               'insekter som den fångar i flykten, ofta lågt över ängar och vatten. På sommaren bygger ladusvalan bo inne '
               'i ladugårdar och stall. Boet byggs av lera och strå och sitter ofta högt upp, nära taket.',
               'När hösten kommer blir det kallt i Sverige, och insekterna försvinner. Då har ladusvalan inget att äta. '
               'Därför flyttar den söderut, ända till södra Afrika. Resan kan vara nästan tusen mil lång, och svalorna '
               'vilar och äter på vägen. I april och maj kommer de tillbaka för att lägga ägg.',
               'På många håll i Sverige har det blivit färre ladusvalor. En orsak är att det finns färre gårdar med kor '
               'och hästar. Där djuren finns, finns också insekter, och öppna ladugårdar där svalorna kan bygga bo.'],
         uppgifter=[('Vad äter ladusvalan? ___', 0),
                    ('Var bygger ladusvalan sitt bo på sommaren? ___', 0),
                    ('Varför flyttar ladusvalan söderut på hösten?', 1),
                    ('Ringa in rätt svar. Ordet ”kluven” i texten betyder ungefär: lång – delad i två delar – färgglad', 0),
                    ('Varför tror du att det finns fler insekter där det finns kor och hästar?', 2),
                    ('Texten är en faktatext. Skriv två saker som visar det.', 2),
                    ('Om du fick fråga en fågelforskare en sak om ladusvalan, vad skulle du fråga?', 1)],
         beskrivning='Träning inför nationella provets läsdel i svenska åk 6: en faktatext om ladusvalan med frågor på olika nivåer.'),

    dict(fil='ak6-np-svenska-skriva', arskurs='ak6', amne='Svenska',
         titel='NP-träning: skriva en berättelse', omrade='Nationella provet i svenska, åk 6', tid='45 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provet skriver du två texter, en berättelse och en sakprosatext, till exempel en beskrivande eller argumenterande text. De bedöms efter innehåll, uppbyggnad, språk och skrivregler. Det här bladet tränar berättelsen.',
                      'En berättelse har en början, något som händer och driver handlingen framåt, och ett slut.'],
         uppgifter=[('Din berättelse ska börja med meningen: ”När jag öppnade dörren till vinden förstod jag att något hade hänt.” '
                     'Planera först: vem är med, var händer det och vad är problemet?', 3),
                    ('Hur slutar berättelsen? Skriv några stödord.', 1),
                    ('Skriv berättelsen. Fortsätt på ett eget papper om raderna inte räcker.', 8),
                    ('Läs igenom texten. Har du stycken, stor bokstav och punkt, och minst ett ställe med dialog? Rätta det du hittar.', 0)],
         beskrivning='Träning inför nationella provets skrivdel i svenska åk 6: planera, skriva och läsa igenom en berättelse.'),

    dict(fil='ak6-np-engelska-lasa', arskurs='ak6', amne='Engelska',
         titel='NP-träning: läsa på engelska', omrade='Nationella provet i engelska, åk 6', tid='30 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provet läser du olika slags texter och svarar på olika sätt: sant eller falskt, flera svarsalternativ och korta svar.',
                      'Svara på engelska om inte frågan säger något annat.'],
         text=['Hi Grandma!',
               'We have lived in Edinburgh for one week now. Our flat is on the third floor, and from my window I can see a '
               'castle on a hill. It rains almost every day, but nobody seems to care.',
               'On Monday I started at my new school. I was nervous, but my teacher, Mr Brown, asked a girl called Isla to show '
               'me around. She has a dog and plays the violin, just like me! At lunch we eat in a big hall, and on Wednesdays there is pizza.',
               'The hardest thing is the accent. Sometimes I have to ask people to say things again. Isla says I will understand '
               'everything by Christmas. I miss you and the summer house. Can you send me a photo of the cat?',
               'Love,\nNoah'],
         uppgifter=[('True or false? Write T or F in the box.\nNoah lives on the first floor. []\nIt rains a lot in Edinburgh. []\n'
                     'Isla plays the violin. []', 0),
                    ('What can Noah see from his window? ___', 0),
                    ('Why does Noah sometimes ask people to say things again?', 1),
                    ('Circle the right answer. How did Noah feel on his first day? happy – nervous – angry', 0),
                    ('Find a word in the text that means "a home on one floor of a building": ___', 0),
                    ('Do you think Noah will be happy in Edinburgh? Why or why not?', 1)],
         beskrivning='Träning inför nationella provets läsdel i engelska åk 6: ett brev med frågor av olika slag.'),

    dict(fil='ak6-np-engelska-skriva', arskurs='ak6', amne='Engelska',
         titel='NP-träning: skriva på engelska', omrade='Nationella provet i engelska, åk 6', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provet skriver du en text på engelska. Det viktiga är att läsaren förstår vad du menar, att texten hänger ihop och att du använder varierade ord.',
                      'Användbara fraser: My name is ... I live in ... In my free time I ... My favourite ... is ... What about you?'],
         uppgifter=[('Du har fått en brevvän i England. Skriv ett mejl där du berättar om dig själv, din familj, en fritidsaktivitet och din skola. '
                     'Avsluta med en fråga till brevvännen. Planera först: skriv stödord för varje del.', 3),
                    ('Skriv mejlet på engelska. Börja med Hi ... och avsluta med en hälsning. Fortsätt på ett eget papper om raderna inte räcker.', 11),
                    ('Läs igenom: har du använt and, but och because minst en gång var? Ringa in dem.', 0)],
         beskrivning='Träning inför nationella provets skrivdel i engelska åk 6: planera och skriva ett mejl till en brevvän.'),

    # ---- Omgång 2 (2026-10-02): fler NP-blad och genomgångar ----
    # Genomgångarna är det material som svarar på frågorna: egna faktablad med lösta exempel, aldrig
    # text ur läroböcker.
    dict(fil='ak6-np-matematik-tal-och-rakning', arskurs='ak6', amne='Matematik',
         titel='NP-träning: tal och räkning', omrade='Nationella provet i matematik, åk 6', tid='35 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Uppgifter om tal i olika former och om att räkna smart, utan miniräknare.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('Vilket värde har siffran 7 i talet 4 702,5? [[]] {E}', 0),
                    ('Avrunda 3 486 till närmaste hundratal. [[]] {E}', 0),
                    ('a) 1 000 − 367 = [[]]    b) 25 · 4 = [[]]    c) 3,5 · 10 = [] {E}', 0),
                    ('Skriv som decimaltal: 3/10 = [[]]    1/4 = [[]] {E}', 0),
                    ('Ringa in det största talet: 0,75; 0,8; 0,099; 3/5 {E}', 0),
                    ('Det är −3 °C på morgonen och 5 °C på eftermiddagen. Hur många grader varmare är det på eftermiddagen? [] {E}', 0),
                    ('Vilket tal ska stå i rutan? 3/4 = []/12 {C}', 0),
                    ('Räkna smart: 4 · 37 · 25 = [[]] Förklara hur du gjorde. {C}', 1),
                    ('Ett tal är 6 större än ett annat tal. Summan av talen är 50. Vilka är talen? {C}', 1),
                    ('Kalle säger: ”Om man multiplicerar två tal blir svaret alltid större än båda talen.” Har han rätt? Förklara med ett exempel. {A}', 2),
                    ('Hur många olika tresiffriga tal kan du bilda med siffrorna 1, 2 och 3 om varje siffra används en gång? Visa hur du vet. {C}', 2)],
         beskrivning='Träning inför nationella provet i matematik åk 6: positionssystemet, avrundning, bråk och decimaltal, negativa tal och smarta räknesätt.'),

    dict(fil='ak6-np-matematik-geometri-och-matning', arskurs='ak6', amne='Matematik',
         titel='NP-träning: geometri och mätning', omrade='Nationella provet i matematik, åk 6', tid='35 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Visa hur du räknar. Du får använda miniräknare.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('Hur lång är rektangelns omkrets? [] cm    Hur stor är arean? [] cm² {E}', 0,
                     rektangel('7 cm', '4 cm', b=210, h=120)),
                    ('Skriv under varje vinkel om den är spetsig, rät eller trubbig. {E}', 1,
                     flera(vinkel(40, langd=110, namn='A'), vinkel(90, langd=110, namn='B'), vinkel(130, langd=110, namn='C'))),
                    ('Ett akvarium är 50 cm långt, 20 cm brett och 30 cm högt. Hur många liter rymmer det? 1 liter = 1 dm³. {C}', 1),
                    ('En karta har skalan 1 : 50 000. Hur långt i verkligheten är 4 cm på kartan? [] km {C}', 0),
                    ('Rita en rektangel som har omkretsen 20 cm och arean 24 cm². Skriv sidornas längder. En ruta är 1 cm. {A}', 'ruta')],
         beskrivning='Träning inför nationella provet i matematik åk 6: omkrets och area, volym och liter, vinklar, skala och en rektangel att konstruera.'),

    dict(fil='ak6-np-matematik-statistik-och-monster', arskurs='ak6', amne='Matematik',
         titel='NP-träning: statistik, chans och mönster', omrade='Nationella provet i matematik, åk 6', tid='35 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Läs av diagrammet noga och visa hur du tänker. Du får använda miniräknare.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('Diagrammet visar hur eleverna i 6A tog sig till skolan en måndag. Alla svarade. Hur många cyklade? [] {E}', 0,
                     stapeldiagram([('Gick', 9), ('Cyklade', 7), ('Buss', 5), ('Bil', 3)], 10, 2, 'Antal elever', hojd=160, bredd=480)),
                    ('Hur många elever går i klassen? [] {E}', 0),
                    ('Hur stor andel av eleverna åkte buss? Svara i bråkform. [[]] {C}', 0),
                    ('Fem barn är 132, 140, 128, 145 och 135 cm långa. Vad är medianen? [[]] cm {E}', 0),
                    ('I en påse finns 3 röda och 5 blå kulor. Du tar en kula utan att titta. Hur stor är chansen att den är röd? Svara i bråkform. [[]] {E}', 0),
                    ('Talföljden börjar 2, 5, 8, 11, ... Vilket tal står på plats 10? [] {C}', 0),
                    ('Skriv en regel för talet på plats n i talföljden. {A}', 1),
                    ('Hitta på fem tal som har medelvärdet 6 och medianen 5. {A}', 2)],
         beskrivning='Träning inför nationella provet i matematik åk 6: läsa diagram, andel, median, chans och talföljder.'),

    dict(fil='ak6-genomgang-brak-decimaltal-och-procent', arskurs='ak6', amne='Matematik',
         titel='Genomgång: bråk, decimaltal och procent', omrade='Inför nationella provet i matematik, åk 6', tid='20 minuter',
         instruktion=['Ett faktablad med det du behöver kunna om bråk, decimaltal och procent, med lösta exempel.',
                      'Läs ett avsnitt i taget och pröva sedan uppgifterna längst ner.'],
         text=['# Bråk',
               'Ett bråk visar en del av en helhet. Nämnaren, talet under strecket, visar hur många lika stora delar helheten är '
               'delad i. Täljaren, talet över strecket, visar hur många av delarna vi menar. 3/4 är tre av fyra lika stora delar.',
               'Bråk kan förlängas och förkortas: multiplicera eller dividera täljare och nämnare med samma tal, så ändras inte '
               'värdet. 1/2 = 2/4 = 4/8.',
               '# Decimaltal',
               'Första siffran efter decimaltecknet är tiondelar och den andra hundradelar. 0,25 är 25 hundradelar. Ett bråk blir '
               'ett decimaltal om man delar täljaren med nämnaren: 1/4 = 1 : 4 = 0,25.',
               '# Procent',
               'Procent betyder hundradelar: 1 % = 1/100 = 0,01. 50 % är hälften, 25 % en fjärdedel och 10 % en tiondel.',
               'Exempel: 10 % av 80 kr är 80 : 10 = 8 kr. Då är 30 % av 80 kr tre gånger så mycket, 3 · 8 = 24 kr.'],
         uppgifter=[('Skriv 3/5 som decimaltal och i procent. [] och [[]]', 0),
                    ('Förläng 2/3 så att nämnaren blir 12. [[]]', 0),
                    ('Hur mycket är 20 % av 150 kr? [] kr', 0),
                    ('Ordna från minst till störst: 0,3; 1/4; 35 %', 1)],
         beskrivning='Faktablad med lösta exempel om bråk, decimaltal och procent, och fyra uppgifter att pröva själv.'),

    dict(fil='ak6-genomgang-omkrets-area-och-volym', arskurs='ak6', amne='Matematik',
         titel='Genomgång: omkrets, area, volym och enheter', omrade='Inför nationella provet i matematik, åk 6', tid='20 minuter',
         instruktion=['Ett faktablad med formler och enheter som du behöver i geometri, med lösta exempel.',
                      'Läs ett avsnitt i taget och pröva sedan uppgifterna längst ner.'],
         text=['# Omkrets och area',
               'Omkretsen är sträckan runt en figur: lägg ihop alla sidor. Arean är ytan inuti. En rektangels area är basen gånger '
               'höjden, och en triangels area är basen gånger höjden delat med 2.',
               'Exempel: en rektangel som är 5 cm lång och 3 cm bred har omkretsen 5 + 3 + 5 + 3 = 16 cm och arean 5 · 3 = 15 cm².',
               '# Volym',
               'Volym är hur mycket som får plats i något. Ett rätblock har volymen längd · bredd · höjd. 1 dm³ är lika mycket som '
               '1 liter, och 1 liter = 10 dl = 100 cl = 1 000 ml.',
               '# Enheter och skala',
               'Längd: 1 m = 10 dm = 100 cm = 1 000 mm och 1 km = 1 000 m. Vikt: 1 kg = 1 000 g. Tid: 1 h = 60 min och 1 min = 60 s.',
               'Skala 1 : 100 betyder att 1 cm på ritningen är 100 cm, alltså 1 m, i verkligheten.'],
         uppgifter=[('En triangel har basen 8 cm och höjden 5 cm. Hur stor är arean? [] cm²', 0),
                    ('Hur många liter rymmer en låda som är 4 dm lång, 3 dm bred och 2 dm hög? [] liter', 0),
                    ('Hur många meter är 2,4 km? [[]] m', 0),
                    ('På en ritning i skala 1 : 50 är ett bord 3 cm långt. Hur långt är bordet i verkligheten? [[]] cm', 0)],
         beskrivning='Faktablad med lösta exempel om omkrets, area, volym, enheter och skala, och fyra uppgifter att pröva själv.'),

    dict(fil='ak6-np-svenska-lasa-berattelse', arskurs='ak6', amne='Svenska',
         titel='NP-träning: läsa en berättelse', omrade='Nationella provet i svenska, åk 6', tid='35 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Läs berättelsen och tänk på vad personerna känner och varför.'],
         text=['# Den nya cykeln',
               'Sara hade sparat i ett helt år. Varje gång hon fick veckopeng lade hon hälften i en burk på hyllan, och när farmor '
               'rensade i köket sålde Sara de gamla kakformarna på loppis. I maj räckte pengarna till slut.',
               'Cykeln var blå med vita streck. Sara cyklade den långa vägen till skolan, förbi dammen och torget, bara för att alla '
               'skulle se den.',
               'När skoldagen var slut stod cykeln kvar, men framhjulet var punkterat. Någon hade stuckit hål i det. Sara kände hur '
               'halsen snördes ihop. Hon ville inte gråta, inte här.',
               '– Jag har lagningsgrejer hemma, sa en röst bakom henne. Det var Elias från parallellklassen, han som aldrig sa något '
               'på rasterna. – Vi kan leda den till mig, det tar tio minuter.',
               'De gick tysta en stund. Sedan började Elias berätta om sin morfars gamla moped, och innan de var framme skrattade Sara '
               'så mycket att hon glömde bort hålet i hjulet.'],
         uppgifter=[('Hur fick Sara ihop pengar till cykeln? Skriv två sätt.', 1),
                    ('Varför cyklade Sara den långa vägen till skolan?', 1),
                    ('Hur kändes det för Sara när hon såg det punkterade hjulet? Hur vet du det?', 1),
                    ('Vad är en ”parallellklass”? Ringa in: samma årskurs – en annan skola – en högre årskurs', 0),
                    ('Vad får vi veta om Elias? Vad tror du att han är för slags person?', 2),
                    ('Hur förändras Saras känslor från början till slutet av berättelsen?', 2)],
         beskrivning='Träning inför nationella provets läsdel i svenska åk 6: en berättelse med frågor om händelser, känslor och personer.'),

    dict(fil='ak6-np-svenska-skriva-faktatext', arskurs='ak6', amne='Svenska',
         titel='NP-träning: skriva en faktatext', omrade='Nationella provet i svenska, åk 6', tid='45 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provet skriver du två texter: en berättelse och en sakprosatext, som olika år har varit argumenterande, beskrivande, '
                      'förklarande eller instruerande. Det här bladet tränar en beskrivande faktatext, som ska ge läsaren kunskap, inte berätta en historia.',
                      'En faktatext har en rubrik, en inledning som säger vad texten handlar om, stycken som vart och ett handlar om en sak, och en avslutning.'],
         uppgifter=[('Välj ett djur, en plats eller en uppfinning som du vet mycket om. Skriv vad du har valt och vem som ska läsa texten.', 1),
                    ('Planera: skriv stödord för tre stycken, till exempel utseende, var det finns och något speciellt.', 2),
                    ('Skriv faktatexten med rubrik och stycken. Fortsätt på ett eget papper om raderna inte räcker.', 9),
                    ('Läs igenom: har du förklarat svåra ord, och står det bara fakta, inget påhittat?', 0)],
         beskrivning='Träning inför nationella provets skrivdel i svenska åk 6: välja ämne, planera och skriva en faktatext med stycken.'),

    dict(fil='ak6-genomgang-berattelse-och-faktatext', arskurs='ak6', amne='Svenska',
         titel='Genomgång: berättelse och faktatext', omrade='Inför nationella provet i svenska, åk 6', tid='20 minuter',
         instruktion=['Ett faktablad om hur en berättelse och en faktatext är uppbyggda, och om skrivreglerna.',
                      'Läs ett avsnitt i taget och pröva sedan uppgifterna längst ner.'],
         text=['# Berättande text',
               'En berättelse har en början där läsaren får veta vem den handlar om, var och när det händer. Sedan kommer ett '
               'problem eller en händelse som driver handlingen framåt, ofta mot en höjdpunkt där det är som mest spännande. I '
               'slutet löses problemet, eller så slutar berättelsen öppet.',
               'Gör texten levande med beskrivningar av miljö och känslor. Visa gärna hur någon känner i stället för att säga det: '
               '”Händerna skakade” i stället för ”hon var rädd”. Dialog skrivs med talstreck: – Kom nu! ropade Elias.',
               '# Faktatext',
               'En faktatext ger kunskap. Den har en rubrik som säger vad den handlar om och en inledning som väcker intresse. Varje '
               'stycke handlar om en sak, och den första meningen i stycket säger vilken. Texten är saklig: inga påhittade händelser, '
               'inga egna åsikter, och svåra ord förklaras.',
               '# Skrivregler',
               'En mening börjar med stor bokstav och slutar med punkt, frågetecken eller utropstecken. Byt stycke när du byter ämne '
               'eller tid. Bindeord som eftersom, därför och dessutom visar hur saker hänger ihop.'],
         uppgifter=[('Skriv om meningen så att den visar en känsla i stället för att säga den: ”Sara var arg.”', 1),
                    ('Stryk den mening som inte hör hemma i en faktatext: ”Igelkotten är ett däggdjur. Jag tycker att den är jättesöt. '
                     'Den äter bland annat insekter och maskar.”', 0),
                    ('Skriv en dialog med två repliker mellan två personer som letar efter en borttappad nyckel. Använd talstreck.', 2)],
         beskrivning='Faktablad om berättande text, faktatext och skrivregler, och tre uppgifter att pröva själv.'),

    dict(fil='ak6-np-engelska-lasa-korta-texter', arskurs='ak6', amne='Engelska',
         titel='NP-träning: korta texter på engelska', omrade='Nationella provet i engelska, åk 6', tid='30 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provet läser du också korta vardagstexter, som skyltar, meddelanden och annonser. Svara på engelska.'],
         text=['# A. At the swimming pool',
               'The pool is closed on Monday for cleaning. Swimming lessons move to Tuesday at the same time. Please remember to bring a padlock for your locker.',
               '# B. A text message from Liam',
               'Hi Ella! Can you come to my birthday party on Saturday? It starts at 3 pm. We are going bowling and then eating pizza at my house. Tell me if you can come!',
               '# C. For sale',
               'Red bike, 24 inches, good condition. New lights and a new basket. Only 600 kr. Ask Sam in class 6B.'],
         uppgifter=[('Which text should you read if you want to buy something? Write A, B or C. []', 0),
                    ('Why is the pool closed on Monday? ___', 0),
                    ('When are the swimming lessons that week? ___', 0),
                    ('What will Liam and his friends do at the party? Write two things.', 1),
                    ('Is Sam a child or an adult? How do you know?', 1),
                    ('True or false? Write T or F.\nThe bike is blue. []\nThe bike has a new basket. []\nThe party is on Saturday. []', 0),
                    ('Write a short answer to Liam. Say if you can come and ask him a question.', 2)],
         beskrivning='Träning inför nationella provets läsdel i engelska åk 6: tre korta vardagstexter med frågor av olika slag.'),

    dict(fil='ak6-genomgang-engelsk-grammatik', arskurs='ak6', amne='Engelska',
         titel='Genomgång: engelsk grammatik i åk 6', omrade='Inför nationella provet i engelska, åk 6', tid='20 minuter',
         instruktion=['Ett faktablad om verbformer och frågeord som ofta behövs på engelska, med exempel.',
                      'Läs ett avsnitt i taget och pröva sedan uppgifterna längst ner.'],
         text=['# Present simple',
               "Det man gör ofta eller alltid: I play, you play. Efter he, she, it och ett substantiv i singular får verbet -s: "
               "she plays, my sister plays. Frågor och nekande meningar bildas med do och does: Do you like pizza? She doesn't "
               "like fish.",
               '# Present continuous',
               'Det som pågår just nu: I am reading, she is playing, they are eating. Bildas med am, is eller are och verbet med -ing.',
               '# Past simple',
               'Det som hände vid en bestämd tid som är slut, till exempel yesterday eller last week: regelbundna verb får -ed, play – played och walk – walked. Vanliga oregelbundna verb: '
               'go – went, see – saw, eat – ate, have – had, come – came.',
               '# Frågeord',
               'What (vad), where (var), when (när), who (vem), why (varför), how (hur) och how many (hur många).'],
         uppgifter=[('Fyll i rätt form: My brother (play) ___ football every Saturday.', 0),
                    ('Fyll i rätt form: Look! The cat (sleep) ___ on my bed.', 0),
                    ('Fyll i rätt form: Yesterday we (go) ___ to the beach.', 0),
                    ('Fyll i rätt frågeord: ___ do you live? – In Malmö.', 0)],
         beskrivning='Faktablad om present simple, present continuous, past simple och frågeord på engelska, med fyra uppgifter.'),
]
