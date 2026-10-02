# -*- coding: utf-8 -*-
"""NP-träning för åk 9: Nextrums egna uppgifter i samma stil som de nationella proven, och
genomgångar som förklarar det proven frågar efter. Aldrig provens egna uppgifter, och aldrig text
ur läroböcker: proven och böckerna är upphovsrättsskyddade (se verktyg/bladen/lankar.py och
minne/databasen.md). Format och regler: se verktyg/bygg-banken.py."""
from figurer import *  # noqa: F401,F403

BLAD = [
    # ---- NP-träning, åk 9 (2026-10-02) ----
    # Egna uppgifter i samma stil som de nationella proven, aldrig provens egna. I åk 9 finns prov i
    # matematik, svenska, engelska, ett NO-ämne och ett SO-ämne.
    dict(fil='ak9-np-matematik-utan-miniraknare', arskurs='ak9', amne='Matematik',
         titel='NP-träning: matematik utan miniräknare', omrade='Nationella provet i matematik, åk 9', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provet finns delar där du bara skriver svaret och delar där du redovisar hur du löst uppgiften. Här räknar du utan miniräknare.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('a) −7 + 12 = []    b) 3,2 · 100 = []    c) 2/3 + 1/6 = [] {E}', 0),
                    ('4² − 3 · 2 = [] {E}', 0), ('Hur mycket är 20 % av 450? [] {E}', 0),
                    ('Lös ekvationen 5x + 4 = 29. x = [] {E}', 0),
                    ('Uppskatta 39,8 · 5,1 med huvudräkning. Förklara hur du gjorde. {E}', 1),
                    ('Förenkla 3(2a − 1) − 2a. [[]] {C}', 0),
                    ('Vilket tal är störst, 0,07 · 10³ eller 7 · 10⁻¹? [[]] {C}', 0),
                    ('En rät linje går genom punkterna (0, −2) och (3, 4). Vilken lutning har linjen? [] {C}', 0),
                    ('För vilka heltal x från 0 till 10 är 2x − 3 större än 7? {C}', 1),
                    ('Visa att summan av tre heltal som följer på varandra alltid är delbar med 3. {A}', 2)],
         beskrivning='Träning inför nationella provet i matematik åk 9, utan miniräknare: räkning, algebra, funktioner och bevis på nivåerna E, C och A.'),

    dict(fil='ak9-np-matematik-med-miniraknare', arskurs='ak9', amne='Matematik',
         titel='NP-träning: matematik med miniräknare', omrade='Nationella provet i matematik, åk 9', tid='45 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Redovisa dina lösningar så att någon annan kan följa dem. Du får använda miniräknare.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('Ett mobilabonnemang kostar 299 kr i månaden och höjs med 8 %. Vad kostar det efter höjningen? {E}', 1),
                    ('Tabellen visar priset för olika antal biobiljetter. Är priset proportionellt mot antalet biljetter? Motivera. {C}', 1,
                     tabell(['Antal biljetter', '1', '2', '4', '6'], [['Pris (kr)', '110', '220', '440', '600']], bredd_kol=95)),
                    ('Ett rätvinkligt segel har kateterna 3,0 m och 4,5 m. Hur lång är den längsta sidan? {C}', 1),
                    ('Sannolikheten för regn är 0,3 på lördag och 0,4 på söndag, och dagarna påverkar inte varandra. '
                     'Hur stor är sannolikheten att det regnar båda dagarna? {C}', 1),
                    ('Hur stor är sannolikheten att det inte regnar någon av dagarna? {C}', 1),
                    ('En kommun har 24 000 invånare och ökar med 1,5 % per år. Hur många invånare har den efter 10 år om ökningen fortsätter? {A}', 1),
                    ('Elin och Max cyklar mot varandra från två orter som ligger 27 km isär. Elin cyklar 15 km/h och Max 12 km/h. '
                     'De startar samtidigt. Efter hur lång tid möts de? {A}', 2)],
         beskrivning='Träning inför nationella provet i matematik åk 9 med miniräknare: procent, proportionalitet, Pythagoras sats, sannolikhet och problemlösning.'),

    dict(fil='ak9-np-svenska-lasa', arskurs='ak9', amne='Svenska',
         titel='NP-träning: läsa en krönika', omrade='Nationella provet i svenska, åk 9', tid='35 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Provet har flera texter kring ett tema. Den här är en krönika, en personlig åsiktstext.'],
         text=['# Låt oss ha tråkigt',
               'Minns du senast du hade tråkigt på riktigt? Inte de tre minuterna i kön till kassan, utan en hel eftermiddag '
               'när ingenting hände. För många unga i dag är det en ovanlig känsla. Varje tom stund fylls med en skärm.',
               'Jag tror att vi förlorar något på det. När jag var tolv hade jag en sommar då alla mina vänner var bortresta. '
               'De första dagarna låg jag mest på golvet och stirrade i taket. Sedan började jag rita serier. I augusti hade jag fyllt tre block.',
               'Tristess är som en åker som får ligga i träda: det växer något där om man låter den vara. Den som alltid har '
               'något att titta på får sällan chansen att höra sina egna tankar.',
               'Jag vill inte förbjuda skärmar. Men jag önskar att fler vuxna vågade säga: ”Okej, du har tråkigt. Vad tänker du '
               'göra åt det?” Svaret kan bli en serie, en koja eller en ny vänskap.'],
         uppgifter=[('Vad vill skribenten övertyga läsaren om? Svara med en mening.', 1),
                    ('Vilket exempel från sitt eget liv berättar skribenten om, och vad vill hen visa med det?', 2),
                    ('Ringa in rätt svar. ”Tristess är som en åker som får ligga i träda” är: en retorisk fråga – en liknelse – ett citat', 0),
                    ('Skriv av en retorisk fråga ur texten.', 1),
                    ('Varför tror du att skribenten skriver ”Jag vill inte förbjuda skärmar”?', 1),
                    ('Håller du med skribenten? Motivera med ett eget argument.', 2)],
         beskrivning='Träning inför nationella provets läsdel i svenska åk 9: en krönika med frågor om tes, exempel, stilmedel och syfte.'),

    dict(fil='ak9-np-svenska-skriva', arskurs='ak9', amne='Svenska',
         titel='NP-träning: argumenterande text', omrade='Nationella provet i svenska, åk 9', tid='45 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provet skriver du utifrån ett tema och ibland ett underlag. Använder du underlaget ska du tala om varifrån '
                      'uppgifterna kommer, till exempel ”Enligt Amir ...”.',
                      'En argumenterande text har en tes, argument, ett motargument som du bemöter och en avslutning.'],
         text=['Underlag: två påhittade röster ur en skoltidning.',
               '”Jag är trött hela förmiddagen. Om skolan började nio i stället för åtta skulle jag hinna sova och orka lära mig mer.” Amir, 15 år',
               '”Börjar vi senare slutar vi också senare, och då krockar skolan med träningar och jobb. Det löser ingenting.” Selma, 14 år'],
         uppgifter=[('Ämnet är: Borde skoldagen börja senare? Skriv din tes.', 1),
                    ('Skriv två argument för din tes. Använd gärna underlaget och tala om vem som sagt vad.', 3),
                    ('Skriv ett motargument och hur du bemöter det.', 2),
                    ('Skriv en inledning som väcker läsarens intresse.', 3),
                    ('Skriv hela texten med rubrik, inledning, stycken och avslutning på ett eget papper eller på datorn.', 0)],
         beskrivning='Träning inför nationella provets skrivdel i svenska åk 9: argumenterande text med underlag och källhänvisning.'),

    dict(fil='ak9-np-engelska-lasa', arskurs='ak9', amne='Engelska',
         titel='NP-träning: läsa på engelska', omrade='Nationella provet i engelska, åk 9', tid='35 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provet svarar du på frågor om innehåll, detaljer och vad texten antyder. Answer the questions in English.'],
         text=['# The Library of Things',
               "When Maya Patel needed a drill to put up a shelf, she didn't buy one. She borrowed one from her local Library of "
               "Things, a small shop in her neighbourhood where people borrow objects instead of books.",
               '"A drill spends most of its life in a drawer," says Tom, one of the volunteers. "It makes more sense to share it." '
               'The library lends everything from tents and sewing machines to board games and party speakers. Members pay a '
               'small fee each time they borrow something.',
               'The idea has spread to many cities in Europe. Supporters say it saves money, reduces waste and helps neighbours '
               'get to know each other. However, not everyone is convinced. Some shop owners worry that they will sell less, and '
               'some members admit that it can be annoying when the thing you want has already been borrowed.'],
         uppgifter=[('What is a Library of Things?', 1),
                    ('Name two things you can borrow there. ___ and ___', 0),
                    ('Circle the right answer. Members ... pay nothing – pay a small fee each time – buy the things they borrow', 0),
                    ('What does Tom mean when he says that a drill "spends most of its life in a drawer"?', 1),
                    ('Give one argument for the idea and one against it, according to the text.', 2),
                    ('What does the word "convinced" mean in the text? ___', 0),
                    ('Would you use a Library of Things? Explain why or why not.', 1)],
         beskrivning='Träning inför nationella provets läsdel i engelska åk 9: en artikel om att låna saker i stället för att köpa.'),

    dict(fil='ak9-np-engelska-skriva', arskurs='ak9', amne='Engelska',
         titel='NP-träning: skriva på engelska', omrade='Nationella provet i engelska, åk 9', tid='45 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provet skriver du en sammanhängande text utifrån en uppgift, ofta med inspiration som citat, bilder eller förslag på vad du kan ta upp. Här får du välja mellan två ämnen.',
                      'Useful linking words: first of all, however, for example, because, on the other hand, in conclusion.'],
         uppgifter=[('Välj ett ämne och ringa in det.\nA) A place I would like to visit, and why.\n'
                     'B) Should students be allowed to use their phones during breaks?', 0),
                    ('Plan your text: write keywords for the introduction, two or three paragraphs and the ending.', 3),
                    ('Write your text here. Continue on a separate sheet of paper if you need more space.', 9)],
         beskrivning='Träning inför nationella provets skrivdel i engelska åk 9: välja ämne, planera och skriva en sammanhängande text.'),

    dict(fil='ak9-np-no-undersoka-och-forklara', arskurs='ak9', amne='NO / Fysik / Kemi / Biologi',
         titel='NP-träning: NO – undersöka och förklara', omrade='Nationella proven i biologi, fysik och kemi, åk 9', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provet använder du begrepp och modeller, granskar undersökningar och tar ställning i frågor om miljö och hälsa.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         text=('Elsa vill undersöka om vattnets temperatur påverkar hur snabbt socker löser sig. Hon fyller tre glas med lika '
               'mycket vatten: 10 °C, 30 °C och 60 °C varmt. I varje glas lägger hon en sockerbit och mäter tiden tills sockret '
               'har löst sig helt.'),
         uppgifter=[('Vilken fråga vill Elsa få svar på med sin undersökning? {E}', 1),
                    ('Vilken variabel ändrar Elsa med flit, och vilken mäter hon? {E}\nÄndrar: ___   Mäter: ___', 0),
                    ('Nämn två saker Elsa måste hålla lika i alla glasen för att jämförelsen ska bli rättvis. {C}', 1),
                    ('Elsas resultat står i tabellen. Vilken slutsats kan hon dra? {E}', 1,
                     tabell(['Vattnets temperatur', '10 °C', '30 °C', '60 °C'], [['Tid tills sockret löst sig', '240 s', '140 s', '60 s']], bredd_kol=110)),
                    ('Förklara med hjälp av partiklar varför sockret löser sig snabbare i varmt vatten. {C}', 2),
                    ('Hur kan Elsa göra undersökningen mer tillförlitlig? {A}', 1),
                    ('Varför är det bra för miljön att aluminiumburkar återvinns? Använd ordet energi i svaret. {C}', 2)],
         beskrivning='Träning inför nationella proven i NO åk 9: planera och värdera en undersökning, förklara med partikelmodellen och ta ställning i en miljöfråga.'),

    dict(fil='ak9-np-so-kallor-och-samband', arskurs='ak9', amne='SO / Historia / Samhällskunskap',
         titel='NP-träning: SO – källor och samband', omrade='Nationella proven i SO-ämnena, åk 9', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provet i SO-ämnena använder du begrepp, förklarar orsaker och konsekvenser och granskar källor.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         text=['Påhittad källa för övningen, en dagbokssida som en fjortonårig flicka i Stockholm skulle kunna ha skrivit våren 1945: '
               '”I dag på eftermiddagen ringde kyrkklockorna. Pappa kom hem tidigt från jobbet och sa att kriget i Europa är slut. '
               'På Kungsträdgården var det så mycket folk att vi inte kom fram. Mamma grät, fast hon var glad. Jag tänker på kusinerna '
               'i Norge. Nu kanske vi får träffa dem i sommar.”'],
         uppgifter=[('Om källan vore äkta, skulle den då vara en primärkälla eller en sekundärkälla? Motivera. {E}', 1),
                    ('Vad kan en historiker lära sig om våren 1945 av en sådan källa? {E}', 1),
                    ('Vad kan källan inte berätta? Tänk på vem som skrev den. {C}', 1),
                    ('Varför kan två personer som var med om samma händelse beskriva den olika? Ge ett exempel. {A}', 2),
                    ('Geografi: förklara en orsak till att allt fler människor i världen flyttar till städer, och en konsekvens det får. {C}', 2),
                    ('Samhällskunskap: vad innebär det att Sverige är en rättsstat? Ge ett exempel. {E}', 1),
                    ('Religionskunskap: ge ett exempel på hur en religion kan påverka människors vardag, till exempel mat, högtider eller klädsel. {E}', 1)],
         beskrivning='Träning inför nationella proven i SO åk 9: källkritik med en påhittad källa, orsaker och konsekvenser, rättsstaten och religion i vardagen.'),

    # ---- Omgång 2 (2026-10-02): fler NP-blad och genomgångar ----
    dict(fil='ak9-np-matematik-algebra-och-funktioner', arskurs='ak9', amne='Matematik',
         titel='NP-träning: algebra och funktioner', omrade='Nationella provet i matematik, åk 9', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Redovisa dina lösningar. Uppgift 1–3 och 7 löser du utan miniräknare.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('Förenkla 5x − 2(x − 3). [[]] {E}', 0),
                    ('Lös ekvationen 7 − 2x = 1. x = [] {E}', 0),
                    ('Beräkna y när x = −2 i y = 3x + 4. y = [] {E}', 0),
                    ('Ett abonnemang kostar 200 kr i startavgift och 50 kr per månad. Skriv ett uttryck för kostnaden efter m månader. {E}', 1),
                    ('Linjen går genom punkterna A och B. Bestäm linjens ekvation. {C}', 1,
                     koordinatsystem(-2, 5, -2, 6, punkter=[(0, 1, 'A'), (2, 5, 'B')], linje=((-1, -1), (2.5, 6)), enhet=30)),
                    ('Lös ekvationen 3(x + 2) = 5x − 4. {C}', 1),
                    ('Faktorisera 6x + 9. [[]] {C}', 0),
                    ('För vilket x är 2x + 5 och 4x − 7 lika stora? Förklara vad det betyder för linjerna y = 2x + 5 och y = 4x − 7. {C}', 2)],
         beskrivning='Träning inför nationella provet i matematik åk 9: förenkla, lösa ekvationer, tolka och bestämma räta linjens ekvation.'),

    dict(fil='ak9-np-matematik-geometri', arskurs='ak9', amne='Matematik',
         titel='NP-träning: geometri', omrade='Nationella provet i matematik, åk 9', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Redovisa dina lösningar. Du får använda miniräknare.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('Beräkna triangelns area. [] cm² {E}', 0,
                     triangel(6, 8, 10, sida_a='6 cm', sida_b='8 cm', rattvinkel='C', hojd=100)),
                    ('En cirkel har diametern 10 cm. Beräkna omkretsen. Avrunda till hela cm. [] cm {E}', 0),
                    ('Beräkna arean av en cirkel med radien 4 cm. Avrunda till hela cm². [] cm² {E}', 0),
                    ('Ett klot har radien 3 cm. Beräkna volymen. Svara med ett heltal. [[]] cm³ {C}', 0),
                    ('En stege som är 4,0 m lång står 1,2 m från en vägg. Hur högt upp når den? Svara med en decimal. {C}', 1),
                    ('Två trianglar är likformiga. Den mindre har sidorna 3, 4 och 5 cm. Den längsta sidan i den större är 15 cm. Hur långa är de andra sidorna? {C}', 1),
                    ('Vinklarna i en triangel förhåller sig som 1 : 2 : 3. Hur stora är vinklarna? {C}', 1),
                    ('En kubs begränsningsarea i cm² har samma mätetal som dess volym i cm³. Hur lång är kubens sida? {A}', 2)],
         beskrivning='Träning inför nationella provet i matematik åk 9: area och omkrets, cirkel, klot, Pythagoras sats, likformighet och vinklar.'),

    dict(fil='ak9-np-matematik-statistik-och-sannolikhet', arskurs='ak9', amne='Matematik',
         titel='NP-träning: statistik och sannolikhet', omrade='Nationella provet i matematik, åk 9', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Redovisa dina lösningar. Du får använda miniräknare.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('Diagrammet visar hur många timmar sex elever tränade under en vecka. Vad är typvärdet? [] {E}', 0,
                     stapeldiagram([('Ali', 4), ('Bea', 6), ('Cem', 4), ('Dan', 2), ('Eva', 8), ('Fia', 4)], 10, 2, 'Timmar', hojd=120, bredd=540)),
                    ('Beräkna medelvärdet för de sex eleverna. Avrunda till en decimal. [] h {E}', 0),
                    ('Vad är medianen? [] h {C}', 0),
                    ('I en klass med 25 elever har 60 % ett husdjur. Hur många elever har inget husdjur? [] {E}', 0),
                    ('Du kastar en vanlig tärning en gång. Hur stor är sannolikheten att få en femma eller en sexa? [] {E}', 0),
                    ('Två mynt kastas. Beräkna sannolikheten att få en krona och en klave. {C}', 2),
                    ('Sannolikheten att Ella vinner en match är 0,6. Hon spelar två matcher som inte påverkar varandra. Hur stor är sannolikheten att hon vinner båda? [] {C}', 0),
                    ('En tidning skriver: ”Hälften av alla som köper glass väljer choklad.” Undersökningen gjordes bland 12 kunder i en chokladbutik. '
                     'Vad är problemet med slutsatsen? {A}', 2)],
         beskrivning='Träning inför nationella provet i matematik åk 9: typvärde, medelvärde och median, procent, sannolikhet och att granska en undersökning.'),

    dict(fil='ak9-genomgang-ekvationer-och-funktioner', arskurs='ak9', amne='Matematik',
         titel='Genomgång: ekvationer och funktioner', omrade='Inför nationella provet i matematik, åk 9', tid='20 minuter',
         instruktion=['Ett faktablad om ekvationer, räta linjen och proportionalitet, med lösta exempel.',
                      'Läs ett avsnitt i taget och pröva sedan uppgifterna längst ner.'],
         text=['# Ekvationer',
               'En ekvation är en likhet där ett tal är okänt. Gör samma sak på båda sidor tills x står ensamt. Exempel: 4x + 3 = 19. '
               'Dra bort 3 från båda sidor: 4x = 16. Dela med 4: x = 4. Kontroll: 4 · 4 + 3 = 19.',
               'Står x på båda sidor samlar du x-termerna på ena sidan först: 5x − 2 = 3x + 6 ger 2x = 8, så x = 4.',
               '# Räta linjens ekvation',
               'En rät linje kan skrivas y = kx + m. k är lutningen, alltså hur mycket y ändras när x ökar med 1, och m är där linjen '
               'skär y-axeln. Lutningen mellan två punkter är skillnaden i y delat med skillnaden i x.',
               'Exempel: genom (1, 3) och (3, 7) är k = (7 − 3) / (3 − 1) = 2. Sätt in punkten (1, 3): 3 = 2 · 1 + m, så m = 1 och y = 2x + 1.',
               '# Proportionalitet',
               'Två storheter är proportionella om den ena alltid är samma tal gånger den andra: y = kx. Grafen är en rät linje genom origo.'],
         uppgifter=[('Lös ekvationen 6x − 5 = 2x + 7. x = []', 0),
                    ('Bestäm lutningen för linjen genom (0, 4) och (2, 0). k = []', 0),
                    ('Är sambandet y = 3x + 2 proportionellt? Motivera.', 1)],
         beskrivning='Faktablad med lösta exempel om ekvationer, räta linjens ekvation och proportionalitet, och tre uppgifter att pröva själv.'),

    dict(fil='ak9-genomgang-geometrins-formler', arskurs='ak9', amne='Matematik',
         titel='Genomgång: geometrins formler', omrade='Inför nationella provet i matematik, åk 9', tid='20 minuter',
         instruktion=['Ett faktablad med de formler i geometri som du behöver i åk 9, med exempel.',
                      'Läs ett avsnitt i taget och pröva sedan uppgifterna längst ner.'],
         text=['# Area och omkrets',
               'Rektangel och parallellogram: bas · höjd. Triangel: bas · höjd / 2. Cirkel: π · r², där r är radien och π ≈ 3,14. '
               'Cirkelns omkrets är π · d, där d är diametern.',
               '# Volym',
               'Prisma och cylinder: basytans area · höjden. Pyramid och kon: basytans area · höjden / 3. Klot: 4 · π · r³ / 3. '
               '1 dm³ = 1 liter.',
               '# Pythagoras sats',
               'I en rätvinklig triangel är a² + b² = c², där c är hypotenusan mitt emot den räta vinkeln. Med kateterna 5 och 12 blir '
               'c² = 25 + 144 = 169, så c = 13.',
               '# Likformighet och skala',
               'Likformiga figurer har samma form: vinklarna är lika stora och sidorna har samma förhållande. Skala 1 : 200 betyder att '
               '1 cm på ritningen är 200 cm i verkligheten.'],
         uppgifter=[('Beräkna volymen av en cylinder med radien 2 cm och höjden 5 cm. Svara med en decimal. [[]] cm³', 0),
                    ('En rätvinklig triangel har kateterna 6 och 8. Hur lång är hypotenusan? []', 0),
                    ('Ett hus är 12 m långt. Hur långt är det på en ritning i skala 1 : 200? [] cm', 0)],
         beskrivning='Faktablad med formler för area, omkrets och volym, Pythagoras sats, likformighet och skala, och tre uppgifter.'),

    dict(fil='ak9-np-svenska-lasa-novell', arskurs='ak9', amne='Svenska',
         titel='NP-träning: läsa en novell', omrade='Nationella provet i svenska, åk 9', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Läs novellen två gånger. Svara med egna ord och stöd dig på texten.'],
         text=['# Klockan',
               'Morfars klocka hade stått på samma hylla i hela Jonas liv. Den var tung och gammal och gick tio minuter före, men ingen '
               'fick ställa om den. ”Då hinner man alltid i tid”, brukade morfar säga.',
               'Efter begravningen var lägenheten full av kartonger. Mamma sorterade och slängde, och Jonas bar ner säckar till '
               'soprummet utan att säga något. När han kom upp igen stod klockan på köksbordet.',
               '– Vill du ha den? frågade mamma. – Den går inte längre. Den stannade samma vecka som morfar.',
               'Jonas vände på den. Han tänkte på alla gånger han kommit för tidigt till fotbollen, hur han suttit på läktaren och '
               'väntat medan de andra kom springande. Han hade alltid trott att det var morfars fel.',
               'Hemma ställde han klockan på sitt skrivbord och lät den vara som den var. Men på kvällen, när han ställde väckarklockan '
               'i mobilen, flyttade han den tio minuter tidigare.'],
         uppgifter=[('Vad var speciellt med morfars klocka, och vad sa morfar om det?', 1),
                    ('Varför tror du att Jonas inte säger något när han bär ner säckarna?', 1),
                    ('Vad förstår Jonas när han tänker på fotbollen?', 2),
                    ('Vad betyder slutet, när Jonas flyttar väckarklockan tio minuter? Tolka.', 2),
                    ('Vilket tema har novellen? Motivera med stöd i texten.', 2)],
         beskrivning='Träning inför nationella provets läsdel i svenska åk 9: en novell med frågor om handling, tolkning och tema.'),

    dict(fil='ak9-np-svenska-lasa-faktatext', arskurs='ak9', amne='Svenska',
         titel='NP-träning: läsa en faktatext med diagram', omrade='Nationella provet i svenska, åk 9', tid='35 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provet kan sakprosa innehålla diagram och tabeller. Läs både texten och diagrammet.'],
         text=['# Läser unga mindre i dag?',
               'Det sägs ofta att unga läser mindre än förr. Men vad räknas som läsning? Den som scrollar i sociala medier läser '
               'också, fast korta texter och i snabb takt. Man brukar skilja mellan att skumma, alltså att leta efter det viktigaste, '
               'och att fördjupa sig i en längre text.',
               'Båda sätten behövs. Att skumma är bra när man snabbt vill hitta information. Att läsa långa texter tränar förmågan att '
               'hålla kvar en tanke och se hur saker hänger ihop, och det är den läsningen som får ordförrådet att växa.',
               'En skola frågade sina elever i årskurs 9 hur ofta de läser en bok på fritiden. Diagrammet visar svaren.'],
         uppgifter=[('Vilka två sätt att läsa beskriver texten?', 1),
                    ('Varför är det enligt texten bra att läsa långa texter? Ge två skäl.', 1),
                    ('Hur många elever svarade på enkäten? []', 0,
                     stapeldiagram([('Dagligen', 6), ('Varje vecka', 14), ('Varje månad', 22), ('Sällan', 18)], 25, 5, 'Antal elever', hojd=120, bredd=520)),
                    ('Hur stor andel av eleverna läser en bok minst en gång i veckan? Svara i procent. [[]]', 0),
                    ('Kan man av enkäten dra slutsatsen att unga i Sverige läser mindre i dag än förr? Motivera.', 2)],
         beskrivning='Träning inför nationella provets läsdel i svenska åk 9: sakprosa med ett diagram, och frågor om innehåll och slutsatser.'),

    dict(fil='ak9-np-svenska-skriva-tema', arskurs='ak9', amne='Svenska',
         titel='NP-träning: skriva utifrån ett tema', omrade='Nationella provet i svenska, åk 9', tid='50 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Provet är byggt kring ett tema, och skrivuppgiften hänger ihop med det. Vilken sorts text du ska skriva varierar.',
                      'Temat här är ”Att växa upp”.'],
         uppgifter=[('Välj en uppgift och ringa in den.\nA) Krönika: Något jag har ändrat uppfattning om.\nB) Novell: En dag som förändrade allt.', 0),
                    ('Planera: vem skriver du för, vad är huvudtanken och hur ska texten börja och sluta?', 3),
                    ('Skriv texten. Fortsätt på ett eget papper om raderna inte räcker.', 9),
                    ('Läs igenom: passar språket till texttypen, har du stycken och en rubrik?', 0)],
         beskrivning='Träning inför nationella provets skrivdel i svenska åk 9: välja mellan krönika och novell kring ett tema, planera och skriva.'),

    dict(fil='ak9-genomgang-texttyper', arskurs='ak9', amne='Svenska',
         titel='Genomgång: argumenterande, utredande och berättande text', omrade='Inför nationella provet i svenska, åk 9', tid='20 minuter',
         instruktion=['Ett faktablad om tre texttyper som ofta förekommer, och om att hänvisa till källor.',
                      'Läs ett avsnitt i taget och pröva sedan uppgifterna längst ner.'],
         text=['# Argumenterande text',
               'Syftet är att övertyga. Texten har en tes, alltså din åsikt, och argument som stöder den. Ett starkt argument har ett '
               'belägg: ett exempel, en siffra eller en erfarenhet. Ta upp ett motargument och bemöt det, och avsluta med att '
               'upprepa tesen.',
               '# Utredande text',
               'Syftet är att undersöka en fråga från flera håll. Texten börjar med en frågeställning, redogör för olika perspektiv '
               'och slutar med en slutsats. Skilj på vad källorna säger och vad du själv drar för slutsats.',
               '# Berättande text',
               'Novellen är kort och handlar ofta om en enda händelse eller vändpunkt. Den har få personer, och mycket sägs mellan '
               'raderna. Bildspråk som liknelser och symboler ger texten djup.',
               '# Källhänvisning',
               'Tala om varifrån uppgifterna kommer: ”Enligt artikeln ’Läser unga mindre i dag?’ ...”. Ett direkt citat skrivs inom citattecken.'],
         uppgifter=[('Vilken texttyp passar bäst? Skriv A, U eller B.\nEn text om för- och nackdelar med sommarlov på åtta veckor. []\n'
                     'En text som ska få kommunen att bygga en skatepark. []\nEn text om en dag när allt gick fel. []', 0),
                    ('Skriv en tes om skoluniformer.', 1),
                    ('Skriv om meningen så att källan framgår: ”Unga läser mindre i dag.”', 1)],
         beskrivning='Faktablad om argumenterande, utredande och berättande text och om källhänvisning, med tre uppgifter.'),

    dict(fil='ak9-np-engelska-lasa-short-story', arskurs='ak9', amne='Engelska',
         titel='NP-träning: en kort berättelse på engelska', omrade='Nationella provet i engelska, åk 9', tid='35 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Läs berättelsen och svara på frågorna på engelska.'],
         text=['# The Last Match',
               'For three years, Leo had played every Saturday for the Riverside Rovers. He was not the best player on the team, but '
               'he never missed a training session, even in the rain. So when his family announced that they were moving to another '
               'city in June, the last match of the season suddenly felt like the most important game in the world.',
               'The score was 1–1 with five minutes left. The ball bounced towards Leo near the penalty area. He could have shot, but '
               'out of the corner of his eye he saw his best friend Amir, completely unmarked. Leo passed. Amir scored.',
               "After the final whistle, the team lifted Amir onto their shoulders. Leo stood a little to the side, smiling. Then the "
               "coach walked over and handed him the captain's armband. \"You played for the team,\" she said. \"That's what a captain does. Take this with you.\""],
         uppgifter=[('Why was the last match so important to Leo?', 1),
                    ('What kind of player was Leo? Give two examples from the text.', 1),
                    ('Why did Leo pass the ball instead of taking the shot himself?', 1),
                    ('Find a word that means "not watched by any player from the other team": ___', 0),
                    ('Why do you think the coach gave Leo the armband?', 1),
                    ('What is the message of the story? Explain in your own words.', 1)],
         beskrivning='Träning inför nationella provets läsdel i engelska åk 9: en kort berättelse om en fotbollsmatch, med frågor om personer och budskap.'),

    dict(fil='ak9-np-engelska-lasa-forum', arskurs='ak9', amne='Engelska',
         titel='NP-träning: åsikter i ett forum på engelska', omrade='Nationella provet i engelska, åk 9', tid='30 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Läs inläggen och svara på frågorna på engelska.'],
         text=['# Forum: Are zoos a good idea?',
               'Maya: Zoos help endangered animals. Some species have been saved from extinction thanks to breeding programmes in zoos. I think that is amazing.',
               'Ben: I visited a zoo last summer, and the lion just walked back and forth in a small area all day. Animals belong in the wild, not behind glass.',
               'Priya: You both have a point. Good zoos give animals a lot of space and teach visitors about nature. Bad zoos should be closed. The problem is not zoos, it is bad zoos.'],
         uppgifter=[('Who is most positive about zoos? ___', 0),
                    ('What argument against zoos does Ben use?', 1),
                    ('What does Priya mean by "The problem is not zoos, it is bad zoos"?', 1),
                    ('Write F for fact or O for opinion.\nSome species have been saved thanks to zoos. []\nI think that is amazing. []\nAnimals belong in the wild. []', 0),
                    ('Write your own post of three or four sentences where you answer one of them.', 3)],
         beskrivning='Träning inför nationella provets läsdel i engelska åk 9: tre forumsinlägg om djurparker, fakta och åsikter, och ett eget inlägg.'),

    dict(fil='ak9-genomgang-skriva-pa-engelska', arskurs='ak9', amne='Engelska',
         titel='Genomgång: skriva en bra text på engelska', omrade='Inför nationella provet i engelska, åk 9', tid='20 minuter',
         instruktion=['Ett faktablad om hur en engelsk text byggs upp och om vanliga fel, med exempel.',
                      'Läs ett avsnitt i taget och pröva sedan uppgifterna längst ner.'],
         text=['# Structure',
               'Start with an introduction that tells the reader what the text is about. Write one paragraph for each main idea, and '
               'begin each paragraph with a topic sentence. End with a conclusion that sums up your thoughts.',
               '# Linking words',
               'Adding: and, also, in addition. Contrast: but, however, on the other hand. Reason and result: because, so, therefore. '
               'Examples: for example, such as. Ending: in conclusion, to sum up.',
               '# Tenses',
               'Present simple for habits (I play), present continuous for now (I am playing), past simple for finished time (I played '
               'yesterday), present perfect for experience (I have played), and will or going to for the future.',
               '# Common mistakes',
               'Write I agree, not I am agree. People are, not people is. Information has no plural. At the same time, not in the same time.'],
         uppgifter=[('Rätta meningen: I am agree with you.', 1),
                    ('Rätta meningen: People is nice in my town.', 1),
                    ('Välj rätt bindeord: I like summer. ___, I hate the mosquitoes. (because / however / so)', 0),
                    ('Skriv en ämnesmening (topic sentence) på engelska till ett stycke om dina fritidsintressen.', 1)],
         beskrivning='Faktablad om struktur, bindeord, tempus och vanliga fel i engelska texter, och fyra uppgifter att pröva själv.'),

    # NO och SO: ett blad per ämne, eftersom eleven gör provet i ett NO-ämne och ett SO-ämne.
    dict(fil='ak9-np-biologi', arskurs='ak9', amne='NO / Fysik / Kemi / Biologi', chip='Biologi',
         titel='NP-träning: biologi', omrade='Nationella provet i biologi, åk 9', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provet använder du begrepp och modeller, granskar information och tar ställning i frågor om hälsa och miljö.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('Vad är fotosyntes? Skriv vad som går in och vad som bildas. {E}', 1),
                    ('Förklara skillnaden mellan en näringskedja och en näringsväv. {E}', 1),
                    ('I en sjö minskar antalet abborrar kraftigt. Gäddor äter abborre, och abborren äter bland annat djurplankton. '
                     'Vad kan hända med gäddorna och med djurplanktonet? Förklara. {C}', 2),
                    ('Vilket organ pumpar blodet, och vilket bildar urin? ___ och ___ {E}', 0),
                    ('Varför hjälper inte antibiotika mot en förkylning? {C}', 1),
                    ('Vad innebär det att bakterier blir resistenta mot antibiotika, och varför är det ett problem för samhället? {A}', 4),
                    ('Ge ett argument för och ett emot att köpa ekologiskt odlad mat. {C}', 2)],
         beskrivning='Träning inför nationella provet i biologi åk 9: fotosyntes, ekosystem, kroppen, antibiotika och att ta ställning.'),

    dict(fil='ak9-np-fysik', arskurs='ak9', amne='NO / Fysik / Kemi / Biologi', chip='Fysik',
         titel='NP-träning: fysik', omrade='Nationella provet i fysik, åk 9', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provet använder du begrepp och modeller, räknar med fysikens samband och tar ställning i frågor om energi och miljö.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('Vad är skillnaden mellan massa och tyngd? {E}', 1),
                    ('En tv har effekten 60 W och är på i 5 timmar. Hur mycket energi går åt? Svara i kWh. {C}', 1),
                    ('Ett element är anslutet till 230 V och strömmen är 4,0 A. Beräkna effekten. {C}', 1),
                    ('En cyklist cyklar 12 km på 30 minuter. Vad är medelhastigheten? [] km/h {E}', 0),
                    ('Förklara varför en isbit smälter i ett varmt rum. Använd ordet energi. {E}', 1),
                    ('Ge två exempel på förnybara energikällor och ett på en energikälla som inte är förnybar. {E}', 1),
                    ('Förklara med tröghetslagen varför bilbälte skyddar vid en krock. {C}', 2),
                    ('Resonera om för- och nackdelar med mer kärnkraft i Sverige utifrån minst två perspektiv, till exempel klimat, '
                     'säkerhet, avfall och kostnad, och ta ställning. {A}', 4)],
         beskrivning='Träning inför nationella provet i fysik åk 9: massa och tyngd, energi och effekt, hastighet, energikällor och tröghet.'),

    dict(fil='ak9-np-kemi', arskurs='ak9', amne='NO / Fysik / Kemi / Biologi', chip='Kemi',
         titel='NP-träning: kemi', omrade='Nationella provet i kemi, åk 9', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provet använder du begrepp och modeller, förklarar med partiklar och tar ställning i frågor om miljö och hälsa.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('Vad är skillnaden mellan ett grundämne och en kemisk förening? Ge ett exempel på varje. {E}', 2),
                    ('Vad händer med vattnets partiklar när vatten kokar? {E}', 1),
                    ('Ringa in de ämnen som är sura: citronsaft – såpa – ättika – bikarbonat i vatten – läsk {E}', 0),
                    ('Vad visar pH-skalan, och vilket pH har en neutral lösning? {E}', 1),
                    ('Skriv reaktionen i ord för när kol brinner: kol + ___ → ___ {E}', 0),
                    ('Varför rostar järn snabbare vid havet än inne i landet? {C}', 1),
                    ('Förbränning av fossila bränslen ökar halten koldioxid i luften. Förklara hur det påverkar klimatet. {C}', 2),
                    ('Förklara varför fotosyntes och förbränning kan beskrivas som varandras motsatser. {A}', 4)],
         beskrivning='Träning inför nationella provet i kemi åk 9: grundämnen och föreningar, partiklar, syror och baser, förbränning och klimat.'),

    dict(fil='ak9-genomgang-biologi', arskurs='ak9', amne='NO / Fysik / Kemi / Biologi', chip='Biologi',
         titel='Genomgång: biologi inför provet', omrade='Inför nationella provet i biologi, åk 9', tid='20 minuter',
         instruktion=['Ett faktablad med det viktigaste om celler, ekosystem, kroppen och arv.',
                      'Läs ett avsnitt i taget och pröva sedan uppgifterna längst ner.'],
         text=['# Cellen',
               'Alla levande organismer består av celler. Både växt- och djurceller har cellkärna med DNA, cellmembran, cytoplasma '
               'och mitokondrier. Växtceller har dessutom cellvägg, kloroplaster och en stor vakuol.',
               '# Fotosyntes och cellandning',
               'Fotosyntes: koldioxid + vatten → druvsocker + syre, med energi från solljus, i kloroplasterna. Cellandning: druvsocker '
               '+ syre → koldioxid + vatten, och energi frigörs, i mitokondrierna. Processerna är varandras motsats.',
               '# Ekosystem',
               'Producenter, som växter, bygger upp näring med hjälp av solljus. Konsumenter äter växter eller andra djur. Nedbrytare, '
               'som svampar och bakterier, bryter ner döda organismer så att näringsämnen går tillbaka till marken. Flera näringskedjor '
               'som hänger ihop bildar en näringsväv.',
               '# Kroppen och hälsan',
               'Hjärtat pumpar blodet, lungorna tar upp syre och avger koldioxid, och njurarna renar blodet och bildar urin. Antibiotika '
               'fungerar mot bakterier men inte mot virus. Ett vaccin tränar immunförsvaret att känna igen ett smittämne.',
               '# Arv',
               'Generna sitter i DNA och styr hur kroppen byggs upp. Vi får hälften av våra kromosomer från varje förälder.'],
         uppgifter=[('Var i cellen sker fotosyntesen, och var sker cellandningen?', 1),
                    ('Vad gör nedbrytarna i ett ekosystem?', 1),
                    ('Varför får man inte antibiotika när man har influensa?', 1)],
         beskrivning='Faktablad om celler, fotosyntes och cellandning, ekosystem, kroppen och arv, med tre uppgifter.'),

    dict(fil='ak9-genomgang-fysik', arskurs='ak9', amne='NO / Fysik / Kemi / Biologi', chip='Fysik',
         titel='Genomgång: fysik inför provet', omrade='Inför nationella provet i fysik, åk 9', tid='20 minuter',
         instruktion=['Ett faktablad med det viktigaste om krafter, energi, elektricitet, ljud och ljus.',
                      'Läs ett avsnitt i taget och pröva sedan uppgifterna längst ner.'],
         text=['# Krafter och rörelse',
               'Medelhastighet = sträcka / tid. Kraft mäts i newton (N). Tyngden är kraften från jordens gravitation: ett föremål med '
               'massan 1 kg har tyngden ungefär 9,8 N. Tröghetslagen säger att ett föremål fortsätter i samma rörelse, eller står '
               'still, om ingen kraft påverkar det eller om krafterna som påverkar det tar ut varandra.',
               '# Energi',
               'Energi kan varken skapas eller förstöras, bara omvandlas mellan olika former: rörelseenergi, lägesenergi, värme, '
               'kemisk energi, elektrisk energi och strålning. Förnybara energikällor som sol, vind och vatten tar inte slut, men '
               'fossila bränslen och uran gör det.',
               '# Elektricitet',
               'Spänningen U mäts i volt, strömmen I i ampere och resistansen R i ohm, och U = R · I. Effekten är P = U · I och mäts i '
               'watt. Energi = effekt · tid, och 1 kWh är den energi som går åt när 1 000 W används i en timme.',
               '# Ljud och ljus',
               'Ljud är vibrationer som sprids genom ett ämne, till exempel luft, och kan inte färdas i vakuum. Ljus kan färdas genom '
               'vakuum, med ungefär 300 000 km/s.'],
         uppgifter=[('Ett föremål har massan 5 kg. Hur stor är tyngden ungefär? [] N', 0),
                    ('En värmefläkt på 1 500 W används i två timmar. Hur många kWh går åt? [] kWh', 0),
                    ('Varför hörs inget ljud i rymden?', 1)],
         beskrivning='Faktablad om krafter och rörelse, energi, elektricitet, ljud och ljus, med tre uppgifter.'),

    dict(fil='ak9-genomgang-kemi', arskurs='ak9', amne='NO / Fysik / Kemi / Biologi', chip='Kemi',
         titel='Genomgång: kemi inför provet', omrade='Inför nationella provet i kemi, åk 9', tid='20 minuter',
         instruktion=['Ett faktablad med det viktigaste om atomer, ämnen, kemiska reaktioner och syror och baser.',
                      'Läs ett avsnitt i taget och pröva sedan uppgifterna längst ner.'],
         text=['# Atomer',
               'En atom har en kärna med protoner och neutroner, och elektroner runt kärnan. Antalet protoner, atomnumret, avgör vilket '
               'grundämne det är. I det periodiska systemet står grundämnena ordnade efter atomnummer.',
               '# Ämnen',
               'Ett grundämne består av en sorts atomer, till exempel järn (Fe) eller syre (O₂). En kemisk förening består av flera '
               'sorters atomer som sitter ihop, till exempel vatten (H₂O). I en blandning är ämnena inte kemiskt bundna och kan '
               'skiljas åt, till exempel genom filtrering eller destillation.',
               '# Kemiska reaktioner',
               'I en kemisk reaktion bildas nya ämnen, men atomerna försvinner inte: massan är densamma före och efter. Vid förbränning '
               'reagerar ett ämne med syre. När kol brinner bildas koldioxid.',
               '# Syror och baser',
               'pH-skalan brukar anges från 0 till 14. Under 7 är surt, 7 är neutralt och över 7 är basiskt. En syra och en bas kan neutralisera '
               'varandra, och då bildas vatten och ett salt.'],
         uppgifter=[('Är luft ett grundämne, en kemisk förening eller en blandning? ___', 0),
                    ('En lösning har pH 3. Är den sur, neutral eller basisk? ___', 0),
                    ('Ett stearinljus väger mindre efter att det har brunnit en stund. Har massan försvunnit? Förklara.', 2)],
         beskrivning='Faktablad om atomer, grundämnen och föreningar, kemiska reaktioner och pH, med tre uppgifter.'),

    dict(fil='ak9-np-geografi', arskurs='ak9', amne='SO / Historia / Samhällskunskap', chip='Geografi',
         titel='NP-träning: geografi', omrade='Nationella provet i geografi, åk 9', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provet använder du geografiska begrepp, förklarar samband mellan människa och natur och resonerar om hållbar utveckling.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('Förklara skillnaden mellan väder och klimat. {E}', 1),
                    ('Varför är det varmare vid ekvatorn än vid polerna? {C}', 1),
                    ('Ge två orsaker till att människor flyttar från landsbygden till städer. {E}', 1),
                    ('Vad visar en befolkningspyramid, och vad kan en bred bas säga om ett land? {C}', 2),
                    ('Förklara hur en varmare jord kan påverka människor som bor i ett lågt liggande kustland. {C}', 2),
                    ('Ge ett exempel på något en enskild person kan göra för en mer hållbar utveckling, och förklara varför det hjälper. {C}', 1),
                    ('Jämför flyg och tåg mellan Stockholm och Göteborg ur ett hållbarhetsperspektiv: ekologiskt, ekonomiskt och socialt. {A}', 4)],
         beskrivning='Träning inför nationella provet i geografi åk 9: väder och klimat, urbanisering, befolkning, klimatförändringar och hållbarhet.'),

    dict(fil='ak9-np-historia', arskurs='ak9', amne='SO / Historia / Samhällskunskap', chip='Historia',
         titel='NP-träning: historia', omrade='Nationella provet i historia, åk 9', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provet använder du historiska begrepp, förklarar orsaker och konsekvenser och granskar källor.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('Skriv 1–4 i rutorna så att händelserna kommer i tidsordning. {E}\n[] Andra världskriget börjar.\n'
                     '[] Berlinmuren faller.\n[] Första världskriget börjar.\n'
                     '[] Kvinnor röstar för första gången i ett svenskt riksdagsval.', 0),
                    ('Ge två orsaker till att första världskriget bröt ut. {C}', 2),
                    ('Vad var det kalla kriget? {E}', 1),
                    ('Varför bör en historiker vara försiktig med en källa som en regering skrev under ett krig? {C}', 1),
                    ('Förklara hur industrialiseringen förändrade människors liv i Sverige. Ge två exempel. {C}', 2),
                    ('Vilken händelse under 1900-talet tycker du har påverkat Europa mest? Motivera med minst två konsekvenser. {A}', 4)],
         beskrivning='Träning inför nationella provet i historia åk 9: kronologi, orsaker till första världskriget, kalla kriget, källkritik och industrialiseringen.'),

    dict(fil='ak9-np-religionskunskap', arskurs='ak9', amne='SO / Historia / Samhällskunskap', chip='Religionskunskap',
         titel='NP-träning: religionskunskap', omrade='Nationella provet i religionskunskap, åk 9', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provet använder du begrepp om religioner och livsåskådningar, jämför dem och resonerar om etiska frågor.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('Para ihop religion och helig skrift: kristendom, islam, judendom, hinduism – Koranen, Bibeln, Tanakh, Vedaskrifterna {E}', 1),
                    ('Ge två saker som judendom, kristendom och islam har gemensamt. {C}', 1),
                    ('Vad betyder karma inom hinduism och buddhism? {E}', 1),
                    ('Vad innebär det att Sverige har religionsfrihet? {E}', 1),
                    ('Ge ett exempel på hur en religion kan påverka människors vardag. {E}', 1),
                    ('Förklara skillnaden mellan konsekvensetik och pliktetik med ett exempel. {C}', 2),
                    ('Ska man alltid säga sanningen? Resonera utifrån två etiska modeller. {A}', 4)],
         beskrivning='Träning inför nationella provet i religionskunskap åk 9: heliga skrifter, likheter mellan religioner, karma, religionsfrihet och etik.'),

    dict(fil='ak9-np-samhallskunskap', arskurs='ak9', amne='SO / Historia / Samhällskunskap', chip='Samhällskunskap',
         titel='NP-träning: samhällskunskap', omrade='Nationella provet i samhällskunskap, åk 9', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provet använder du samhällsbegrepp, förklarar samband och resonerar om samhällsfrågor ur olika perspektiv.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('Vad gör riksdagen, regeringen och kommunen? Ge en uppgift för var och en. {E}', 2),
                    ('Vad innebär det att Sverige är en rättsstat? {E}', 1),
                    ('Vad är en marknadsekonomi? {E}', 1),
                    ('Vad händer vanligtvis med priset om efterfrågan på en vara ökar men utbudet är detsamma? Förklara varför. {C}', 1),
                    ('Ge två exempel på hur medier kan påverka vad människor tycker. {C}', 1),
                    ('Varför är fria val och yttrandefrihet viktiga i en demokrati? {C}', 2),
                    ('Borde rösträttsåldern sänkas till 16 år? Resonera om argument för och emot. {A}', 4)],
         beskrivning='Träning inför nationella provet i samhällskunskap åk 9: riksdag, regering och kommun, rättsstaten, ekonomi, medier och demokrati.'),

    dict(fil='ak9-genomgang-historia-1900-talet', arskurs='ak9', amne='SO / Historia / Samhällskunskap', chip='Historia',
         titel='Genomgång: 1900-talet i korthet', omrade='Inför nationella provet i historia, åk 9', tid='20 minuter',
         instruktion=['Ett faktablad med 1900-talets viktigaste händelser i tidsordning, och orsakerna till första världskriget.',
                      'Läs igenom tidslinjen och pröva sedan uppgifterna längst ner.'],
         text=['# Tidslinje',
               '1914–1918: första världskriget. 1917: ryska revolutionen. 1919: riksdagen beslutar om rösträtt för kvinnor, och 1921 '
               'röstar kvinnor för första gången i ett riksdagsval. 1929: börskraschen i New York och därefter den stora depressionen.',
               '1933: Hitler blir rikskansler i Tyskland. 1939–1945: andra världskriget och Förintelsen. 1945: FN bildas. Ungefär '
               '1947–1991: kalla kriget mellan USA och Sovjetunionen. 1961: Berlinmuren byggs, och 1989 faller den. 1991: '
               'Sovjetunionen upplöses. 1995: Sverige blir medlem i EU.',
               '# Varför började första världskriget?',
               'Bakom kriget låg kapprustning, militära allianser, kampen om kolonier och en stark nationalism. Den utlösande händelsen '
               'var mordet på den österrikiske tronföljaren Franz Ferdinand i Sarajevo den 28 juni 1914.',
               '# Kalla kriget',
               'USA och Sovjetunionen krigade aldrig direkt mot varandra, men tävlade om makt och inflytande genom kapprustning, '
               'rymdkapplöpning och krig i andra länder. Europa delades av en gräns som kallades järnridån.'],
         uppgifter=[('Vilket år fick kvinnor i Sverige rösta i ett riksdagsval för första gången? [[]]', 0),
                    ('Nämn två långsiktiga orsaker till första världskriget.', 1),
                    ('Varför kallas det kalla kriget för kallt?', 1)],
         beskrivning='Faktablad med en tidslinje över 1900-talet, orsakerna till första världskriget och kalla kriget, med tre uppgifter.'),

    dict(fil='ak9-genomgang-religioner-och-etik', arskurs='ak9', amne='SO / Historia / Samhällskunskap', chip='Religionskunskap',
         titel='Genomgång: världsreligionerna och etik', omrade='Inför nationella provet i religionskunskap, åk 9', tid='20 minuter',
         instruktion=['Ett faktablad om fem världsreligioner och tre etiska modeller.',
                      'Läs ett avsnitt i taget och pröva sedan uppgifterna längst ner.'],
         text=['# Judendom, kristendom och islam',
               'Judendomens heliga skrift är Tanakh, där Torah är den viktigaste delen. Man samlas i synagogan och firar sabbat från '
               'fredag kväll till lördag kväll. Kristendomens heliga skrift är Bibeln, med Gamla och Nya testamentet. De kristna tror '
               'att Jesus är Guds son, och påsken firar hans uppståndelse. Islams heliga skrift är Koranen, och profeten Muhammed har '
               'en central roll. Man samlas till gemensam bön i moskén, särskilt vid fredagsbönen. De fem pelarna är trosbekännelsen, bönen, allmosan, fastan under ramadan och vallfärden till Mecka.',
               '# Hinduism och buddhism',
               'Inom hinduismen finns många gudar, och många hinduer ser dem som uttryck för en och samma gudomliga kraft, Brahman. '
               'Viktiga skrifter är Vedaskrifterna och Bhagavad Gita. Buddhismen bygger på Buddhas lära om de fyra ädla sanningarna '
               'och den åttafaldiga vägen. Båda lär ut karma, att handlingar får följder, och återfödelse. Målet är att bli fri från '
               'kretsloppet av återfödelser: moksha i hinduismen och nirvana i buddhismen.',
               '# Etiska modeller',
               'Konsekvensetik: en handling är rätt om följderna blir goda. Pliktetik: vissa handlingar är rätt eller fel oavsett '
               'följderna. Dygdetik: gör det som en god människa skulle ha gjort.'],
         uppgifter=[('Vad heter islams heliga skrift, och var samlas man för gemensam bön?', 1),
                    ('Vilken etisk modell används här: ”Jag ljuger inte, för det är fel att ljuga.” ___', 0),
                    ('Ge en likhet och en skillnad mellan hinduism och buddhism.', 2)],
         beskrivning='Faktablad om judendom, kristendom, islam, hinduism och buddhism och om tre etiska modeller, med tre uppgifter.'),

    dict(fil='ak9-genomgang-demokrati-och-ekonomi', arskurs='ak9', amne='SO / Historia / Samhällskunskap', chip='Samhällskunskap',
         titel='Genomgång: demokrati, rättsstat och ekonomi', omrade='Inför nationella provet i samhällskunskap, åk 9', tid='20 minuter',
         instruktion=['Ett faktablad om hur Sverige styrs, om rättsstaten och om grunderna i ekonomi.',
                      'Läs ett avsnitt i taget och pröva sedan uppgifterna längst ner.'],
         text=['# Hur Sverige styrs',
               'Riksdagen har 349 ledamöter. Den stiftar lagar, bestämmer statens budget och skatter och granskar regeringen. '
               'Regeringen leds av statsministern och styr landet. Sveriges 290 kommuner ansvarar bland annat för skola och '
               'äldreomsorg, och de 21 regionerna för sjukvård och kollektivtrafik. Val hålls vart fjärde år.',
               '# Grundlagar och rättsstat',
               'Sverige har fyra grundlagar: regeringsformen, successionsordningen, tryckfrihetsförordningen och '
               'yttrandefrihetsgrundlagen. I en rättsstat gäller lagarna alla, och domstolarna, till exempel tingsrätt, hovrätt och Högsta '
               'domstolen, dömer oberoende av politikerna.',
               '# Ekonomi',
               'I en marknadsekonomi styrs priser av utbud och efterfrågan: om fler vill köpa en vara än det finns, stiger priset. '
               'Skatter betalar för gemensamma saker som skola, vård och vägar.'],
         uppgifter=[('Hur många ledamöter har riksdagen? [[]]', 0),
                    ('Vem ansvarar för sjukvården, kommunen eller regionen? ___', 0),
                    ('Varför är det viktigt att domstolarna är oberoende?', 2)],
         beskrivning='Faktablad om riksdag, regering, kommuner och regioner, grundlagarna, rättsstaten och marknadsekonomi, med tre uppgifter.'),

    dict(fil='ak9-genomgang-klimat-befolkning-och-hallbarhet', arskurs='ak9', amne='SO / Historia / Samhällskunskap', chip='Geografi',
         titel='Genomgång: klimat, befolkning och hållbarhet', omrade='Inför nationella provet i geografi, åk 9', tid='20 minuter',
         instruktion=['Ett faktablad om klimat, befolkning och hållbar utveckling.',
                      'Läs ett avsnitt i taget och pröva sedan uppgifterna längst ner.'],
         text=['# Väder och klimat',
               'Väder är hur det är just nu eller de närmaste dagarna. Klimat är det genomsnittliga vädret på en plats under lång tid, '
               'oftast 30 år. Vid ekvatorn träffar solstrålarna jorden mer rakt, och energin sprids på en mindre yta än vid polerna. '
               'Därför är det varmare där.',
               '# Växthuseffekten',
               'Gaser i atmosfären, som koldioxid och metan, släpper igenom solljuset men håller kvar en del av värmen. Utan dem hade '
               'jorden varit mycket kallare. När mer växthusgaser släpps ut förstärks effekten, och jorden blir varmare.',
               '# Befolkning',
               'En befolkningspyramid visar hur många män och kvinnor det finns i olika åldrar. En bred bas betyder att det föds många '
               'barn. Urbanisering är när allt fler bor i städer, till exempel för att det finns jobb och utbildning där.',
               '# Hållbar utveckling',
               'En hållbar utveckling tar hänsyn till miljön, ekonomin och människors levnadsvillkor, nu och för kommande generationer.'],
         uppgifter=[('Är ”det regnar i dag” ett påstående om väder eller klimat? ___', 0),
                    ('Varför hade jorden varit kallare utan växthusgaser?', 1),
                    ('Ge ett exempel på en drivkraft bakom urbaniseringen.', 1)],
         beskrivning='Faktablad om väder och klimat, växthuseffekten, befolkningspyramider, urbanisering och hållbar utveckling, med tre uppgifter.'),
]
