# -*- coding: utf-8 -*-
"""NP-träning för gymnasiet: Nextrums egna uppgifter i samma stil som de nationella proven, och
genomgångar som förklarar det proven frågar efter. Aldrig provens egna uppgifter, och aldrig text
ur läroböcker: proven och böckerna är upphovsrättsskyddade (se verktyg/bladen/lankar.py och
minne/databasen.md). Format och regler: se verktyg/bygg-banken.py."""
from figurer import *  # noqa: F401,F403

BLAD = [
    # ---- NP-träning, gymnasiet (2026-10-02) ----
    # Egna uppgifter i samma stil som de nationella proven, aldrig provens egna. Med Gy25 finns prov i
    # matematik nivå 1 och 2, svenska nivå 1 och 3 och engelska nivå 1 och 2.
    dict(fil='gy1-np-matematik-niva-1-utan-digitala-verktyg', arskurs='gy1', amne='Matematik',
         titel='NP-träning: matematik 1 utan räknare', omrade='Nationella provet i matematik nivå 1', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Provet har delar utan digitala verktyg, där du skriver svaret eller redovisar kort, och delar med digitala verktyg. Formelbladet får användas på alla delar. Det här bladet är utan digitala verktyg.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('a) 2,4 · 0,5 = []    b) Skriv 0,035 i procentform: [[]] {E}', 0),
                    ('Förenkla (2x + 3) − (x − 4). [[]] {E}', 0),
                    ('Lös ekvationen 3(x − 2) = 12. x = [] {E}', 0),
                    ('Beräkna 10⁻² · 10⁵. [[]] {E}', 0),
                    ('Bestäm f(−2) om f(x) = 3x² − 1. [] {C}', 0),
                    ('Linjen y = kx + 4 går genom punkten (2, 10). Bestäm k. k = [] {C}', 0),
                    ('Skriv ett förenklat uttryck för arean av en rektangel med sidorna x + 2 och 3x. {C}', 1),
                    ('Summan av tre jämna tal som följer på varandra är 78. Vilka är talen? {C}', 1),
                    ('Ett pris sänks med 20 % och höjs sedan med 20 %. Blir det nya priset högre, lägre eller lika med det första? Motivera. {C}', 2),
                    ('Ett tal ökas med 25 %. Med hur många procent måste det nya talet minskas för att man ska komma tillbaka '
                     'till det ursprungliga? Motivera. {A}', 2)],
         beskrivning='Träning inför nationella provet i matematik nivå 1 utan digitala verktyg: räkning, algebra, funktioner och procent på nivåerna E, C och A.'),

    dict(fil='gy1-np-matematik-niva-1-med-digitala-verktyg', arskurs='gy1', amne='Matematik',
         titel='NP-träning: matematik 1 med räknare', omrade='Nationella provet i matematik nivå 1', tid='45 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Redovisa dina lösningar så att någon annan kan följa dem. Du får använda räknare.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('En bil kostar 285 000 kr och minskar i värde med 14 % per år. Vad är den värd efter 5 år? {E}', 1),
                    ('Ett rätblock har volymen 1,2 dm³ och bottenytan 10 cm × 8 cm. Hur högt är det? {E}', 1),
                    ('Andelen elever som cyklar till en skola ökade från 18 % till 24 %. Hur många procentenheter och hur många procent ökade andelen? {C}', 2),
                    ('Tabellen visar tid och sträcka för en löpare. Är sambandet proportionellt? Bestäm i så fall proportionalitetskonstanten och tolka den. {C}', 2,
                     tabell(['Tid (min)', '5', '10', '20', '30'], [['Sträcka (km)', '1,2', '2,4', '4,8', '7,2']], bredd_kol=90)),
                    ('En klass säljer kakor. De har fasta kostnader på 450 kr, varje kaka kostar 4 kr att baka och säljs för 15 kr. '
                     'Hur många kakor måste de sälja för att gå med vinst? {C}', 2),
                    ('Lös ekvationen 1,05ˣ = 2 grafiskt eller genom att pröva. Tolka svaret om 1,05 är förändringsfaktorn per år för pengar på ett sparkonto. {A}', 2)],
         beskrivning='Träning inför nationella provet i matematik nivå 1 med digitala verktyg: förändringsfaktor, volym, procentenheter, proportionalitet och modellering.'),

    dict(fil='gy1-np-svenska-niva-1-lasforstaelse', arskurs='gy1', amne='Svenska',
         titel='NP-träning: läsförståelse, svenska 1', omrade='Nationella provet i svenska nivå 1', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provets läsdel svarar du på frågor om innehåll, syfte och språk. Stöd svaren på texten.'],
         text=['# Varför lånar svenskan ord?',
               'Svenskan har alltid lånat ord från andra språk. Under medeltiden kom många ord från lågtyskan, eftersom tyska '
               'köpmän i Hansan handlade i svenska städer. Ord som fönster, handla och borgmästare är exempel på sådana lån. På '
               '1700-talet var franskan finkulturens språk, och då kom ord som paraply, byrå och fåtölj. Under 1900-talet och fram '
               'till i dag har engelskan varit den största källan.',
               'Ett lånord brukar anpassas efter svenskan. Det får svensk stavning och böjning, och efter en tid märker de flesta '
               'inte längre att ordet kommer utifrån. Mejl är ett exempel: det kommer från engelskans mail men stavas och böjs som '
               'ett svenskt ord, ett mejl och flera mejl.',
               'Alla är inte lika förtjusta i lånorden. Vissa menar att engelska ord tränger undan svenska, särskilt inom forskning '
               'och näringsliv. Andra ser lånen som ett tecken på att språket lever och förändras. Språkforskare brukar påpeka att '
               'svenskan har tagit emot lån i över tusen år och ändå fortfarande är svenska.'],
         uppgifter=[('Varför kom många lågtyska ord in i svenskan under medeltiden?', 1),
                    ('Vilket språk har gett flest lånord sedan 1900-talet? ___', 0),
                    ('Förklara med egna ord vad som händer med ett lånord när det anpassas till svenskan. Ge ett eget exempel.', 2),
                    ('Ringa in det som bäst beskriver textens syfte:\ninformera om hur svenskan lånar ord – argumentera mot engelska lånord – varna för att svenskan försvinner', 0),
                    ('Vilka två synsätt på engelska lånord beskrivs i texten?', 1),
                    ('Vad menar språkforskarna med att svenskan ”ändå fortfarande är svenska”?', 1)],
         beskrivning='Träning inför nationella provets läsdel i svenska nivå 1: en sakprosatext om lånord med frågor om innehåll, syfte och perspektiv.'),

    dict(fil='gy1-np-svenska-niva-1-skriva', arskurs='gy1', amne='Svenska',
         titel='NP-träning: argumentera, svenska 1', omrade='Nationella provet i svenska nivå 1', tid='50 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provets skrivdel skriver du utifrån ett texthäfte. Hänvisa till källorna så att läsaren förstår vem som säger vad, '
                      'till exempel ”I en ledare i ... skriver ...”.',
                      'En argumenterande text har en tydlig tes, underbyggda argument, ett bemött motargument och en avslutning.'],
         text=['Underlag: två påhittade källor för övningen.',
               'Källa 1, ur en ledare i en lokaltidning: ”Gratis kollektivtrafik för alla under 20 år skulle ge unga större frihet. '
               'Fler skulle kunna ta sig till jobb, träning och vänner utan att vara beroende av föräldrar med bil.”',
               'Källa 2, ur ett debattinlägg av en kommunpolitiker: ”Ingenting är gratis. Kostar bussen ingenting för unga måste '
               'någon annan betala, genom högre skatt eller sämre turtäthet.”'],
         uppgifter=[('Ämnet är: Ska kollektivtrafiken vara gratis för alla under 20 år? Skriv din tes.', 1),
                    ('Skriv ett argument för din tes som bygger på en av källorna. Hänvisa till källan.', 3),
                    ('Skriv ett motargument och bemöt det.', 3),
                    ('Skriv en avslutning som knyter ihop texten.', 2),
                    ('Skriv hela texten med rubrik på ett eget papper eller på datorn.', 0)],
         beskrivning='Träning inför nationella provets skrivdel i svenska nivå 1: argumenterande text utifrån två källor, med källhänvisning.'),

    dict(fil='gy1-np-engelska-niva-1-reading', arskurs='gy1', amne='Engelska',
         titel='NP-träning: reading, engelska nivå 1', omrade='Nationella provet i engelska nivå 1', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      "In the reading part you answer questions about main ideas, details and the writer's attitude. Use full sentences, except where you are asked for one word."],
         text=['# Science in your back garden',
               'Every winter, hundreds of thousands of people across the UK spend one hour looking out of their windows. They are '
               'not bored; they are doing science. The Big Garden Birdwatch, organised by the bird charity RSPB since 1979, asks '
               'the public to count the birds they see in their gardens or local parks and report the numbers online.',
               'Projects like this are called citizen science: ordinary people collect data that researchers could never gather on '
               'their own. Over the years, the counts have shown worrying trends. House sparrows and starlings, for example, are far '
               'less common than they were when the counts began.',
               'Critics point out that volunteers make mistakes. A beginner might confuse two similar species, and people who enjoy '
               'birds may be more likely to take part when their gardens are full of them. Scientists deal with this by collecting '
               'huge amounts of data and by checking unusual reports. Many participants say that once you start noticing the birds, '
               'you never really stop.'],
         uppgifter=[('What do the participants in the Big Garden Birdwatch do?', 1),
                    ('What trend has the birdwatch shown? Give an example.', 1),
                    ('Name two weaknesses of citizen science mentioned in the text, and how scientists deal with them.', 2),
                    ('Find a word in the text that means "people who work without being paid": ___', 0),
                    ("What is the writer's attitude towards citizen science? Support your answer with the text.", 2)],
         beskrivning='Träning inför nationella provets läsdel i engelska nivå 1: en artikel om medborgarforskning med frågor om huvudtanke, detaljer och attityd.'),

    dict(fil='gy1-np-engelska-niva-1-writing', arskurs='gy1', amne='Engelska',
         titel='NP-träning: writing, engelska nivå 1', omrade='Nationella provet i engelska nivå 1', tid='50 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'In the writing part you write a longer text. It is assessed on content, structure and language: how clearly, coherently and accurately you write.',
                      'Useful phrases: In my opinion ..., One reason is ..., On the other hand ..., To sum up ...'],
         uppgifter=[('Topic: "Should all young people do some kind of volunteer work?" Plan your text: your opinion, two or three reasons '
                     'with examples, another point of view and a conclusion.', 3),
                    ('Write your introduction here.', 4),
                    ('Write one body paragraph with a clear topic sentence.', 5),
                    ('Write the rest of the text on a separate sheet of paper or on a computer.', 0)],
         beskrivning='Träning inför nationella provets skrivdel i engelska nivå 1: planera och skriva en argumenterande text om volontärarbete.'),

    dict(fil='gy2-np-matematik-niva-2-utan-digitala-verktyg', arskurs='gy2', amne='Matematik',
         titel='NP-träning: matematik 2 utan räknare', omrade='Nationella provet i matematik nivå 2', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Provet har delar utan och med digitala verktyg, och formelbladet får användas på alla delar. Det här bladet är utan digitala verktyg.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('Lös ekvationen x² − 9 = 0. x = [[]] {E}', 0),
                    ('Utveckla (x + 5)². {E}', 1),
                    ('Faktorisera x² − 6x. [[]] {E}', 0),
                    ('Beräkna lg 1000 + lg 0,1. [] {E}', 0),
                    ('Lös ekvationen x² + 2x − 8 = 0. {E}', 1),
                    ('Lös ekvationssystemet y = 2x − 1 och y = −x + 5. {E}', 1),
                    ('För vilka värden på k har ekvationen x² + 4x + k = 0 två reella lösningar? {C}', 2),
                    ('Bestäm symmetrilinjen och minimipunkten för f(x) = x² − 4x + 3. {C}', 2),
                    ('Visa att (n + 1)² − (n − 1)² är delbart med 4 för alla heltal n. {A}', 2)],
         beskrivning='Träning inför nationella provet i matematik nivå 2 utan digitala verktyg: andragradsekvationer, kvadreringsregler, logaritmer, ekvationssystem och bevis.'),

    dict(fil='gy2-np-matematik-niva-2-med-digitala-verktyg', arskurs='gy2', amne='Matematik',
         titel='NP-träning: matematik 2 med räknare', omrade='Nationella provet i matematik nivå 2', tid='45 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Redovisa dina lösningar så att någon annan kan följa dem. Du får använda räknare.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('Höjden y meter för en kastad boll efter x sekunder är y = −4,9x² + 12x + 1,5. Hur högt kommer bollen som högst? {C}', 2),
                    ('Efter hur lång tid slår bollen i marken? {C}', 2),
                    ('Lös ekvationen 500 · 1,07ˣ = 1 200. Svara med två decimaler. {E}', 1),
                    ('Tio elever fick poängen 12, 15, 9, 18, 14, 11, 16, 13, 10 och 17 på ett test. Beräkna medelvärdet och '
                     'standardavvikelsen, räknad som för ett stickprov. {E}', 1),
                    ('Förklara skillnaden mellan korrelation och kausalitet med ett eget exempel. {C}', 2),
                    ('En rektangulär hage ska stängslas in längs tre sidor; den fjärde är en vägg. Det finns 60 m stängsel. '
                     'Vilka mått ger största möjliga area? {A}', 3)],
         beskrivning='Träning inför nationella provet i matematik nivå 2 med digitala verktyg: andragradsfunktioner, exponentialekvationer, statistik och optimering.'),

    dict(fil='gy2-np-engelska-niva-2-reading', arskurs='gy2', amne='Engelska',
         titel='NP-träning: reading, engelska nivå 2', omrade='Nationella provet i engelska nivå 2', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Show that you understand what the text says and how. Use full sentences, except for one-word answers.'],
         text=['# Tomorrow, I promise',
               'Almost everyone knows the feeling. An essay is due on Friday, and on Thursday evening you find yourself reorganising '
               'your bookshelf or suddenly deciding that your room needs a deep clean. '
               'You are not lazy: you are procrastinating.',
               'For a long time, procrastination was seen as a problem of time management. Many psychologists now describe it differently. Procrastination, they '
               'argue, is mainly about managing feelings. We put off tasks that make us feel bored, anxious or insecure, and reach '
               'for something that makes us feel better right now. The relief is real, but short-lived; the task, and the stress, are still waiting.',
               'This explains why buying a new planner rarely helps. More useful strategies target the feeling itself, for example '
               'breaking a task into tiny steps or starting with just five minutes.',
               'None of this means that every delay is harmful. Letting an idea rest can improve it. The problem begins when putting '
               'things off becomes a habit that costs us sleep, grades or peace of mind.'],
         uppgifter=[('How was procrastination explained in the past, and how do many psychologists explain it now?', 2),
                    ('Why, according to the writer, does buying a new planner rarely help?', 1),
                    ('What does the word "short-lived" mean? ___', 0),
                    ('How does the final paragraph change the perspective of the text?', 2),
                    ('Describe the tone of the first paragraph and give an example that supports your answer.', 1)],
         beskrivning='Träning inför nationella provets läsdel i engelska nivå 2: en essä om att skjuta upp saker, med frågor om innehåll, ton och struktur.'),

    dict(fil='gy2-np-engelska-niva-2-writing', arskurs='gy2', amne='Engelska',
         titel='NP-träning: writing, engelska nivå 2', omrade='Nationella provet i engelska nivå 2', tid='50 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'In the writing part you write a longer, well-structured text in which you discuss a topic from more than one angle.',
                      'Useful phrases: It could be argued that ..., A common objection is ..., Nevertheless ..., All things considered ...'],
         uppgifter=[('Topic: "A cashless society: progress or problem?" Plan a text where you discuss advantages and disadvantages '
                     'and give your own opinion.', 3),
                    ('Write your introduction here.', 4),
                    ('Write a paragraph that presents the strongest argument against your own opinion, and respond to it.', 5),
                    ('Write the rest of the text on a separate sheet of paper or on a computer.', 0)],
         beskrivning='Träning inför nationella provets skrivdel i engelska nivå 2: en diskuterande text om ett kontantlöst samhälle.'),

    dict(fil='gy3-np-svenska-niva-3-utredande-text', arskurs='gy3', amne='Svenska',
         titel='NP-träning: utredande text, svenska 3', omrade='Nationella provet i svenska kurs 3 och nivå 3', tid='60 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provet skriver du en utredande text utifrån ett texthäfte: du ställer en fråga, redogör för olika perspektiv '
                      'med korrekt källhänvisning och drar en egen slutsats.',
                      'Håll isär vad källorna säger och vad du själv tycker.'],
         text=['Underlag: två påhittade källor för övningen.',
               'Källa 1, ur en intervju med en svensklärare: ”Mina elever skriver mer än någon generation före dem: chattar, '
               'kommentarer, inlägg. De växlar hela tiden mellan olika sätt att skriva beroende på mottagare, och det är en färdighet i sig.”',
               'Källa 2, ur en krönika i en dagstidning: ”Korta meddelanden tränar inte förmågan att bygga upp ett långt resonemang. '
               'Jag oroar mig för att unga får allt svårare att skriva sammanhängande texter.”'],
         uppgifter=[('Formulera en frågeställning om hur sociala medier påverkar ungas skrivande.', 1),
                    ('Sammanfatta vad källa 1 säger, med egna ord och med hänvisning till källan.', 2),
                    ('Sammanfatta vad källa 2 säger på samma sätt.', 2),
                    ('Jämför källorna: på vilket sätt är de oense, och kan båda ha rätt?', 2),
                    ('Skriv en slutsats som svarar på din frågeställning.', 3),
                    ('Skriv hela texten med inledning, avhandling och avslutning på ett eget papper eller på datorn.', 0)],
         beskrivning='Träning inför nationella provets skrivdel i svenska nivå 3: utredande text utifrån två källor, med frågeställning, källhänvisning och slutsats.'),

    # ---- Omgång 2 (2026-10-02): fler NP-blad och genomgångar ----
    dict(fil='gy1-np-matematik-1-funktioner', arskurs='gy1', amne='Matematik',
         titel='NP-träning: matematik 1, funktioner', omrade='Nationella provet i matematik nivå 1', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Redovisa dina lösningar. Formelbladet får användas på alla delar av provet.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('Linjen y = kx + m går genom (0, 3) och (4, 11). Bestäm k och m. k = []   m = [] {E}', 0),
                    ('Beräkna f(3) om f(x) = 2x² − 3. [] {E}', 0),
                    ('Grafen visar en rät linje. Bestäm linjens ekvation. {C}', 1,
                     koordinatsystem(-1, 5, -3, 4, linje=((-1, 4), (5, -2)), punkter=[(0, 3, ''), (3, 0, '')], enhet=26)),
                    ('Ett gym kostar 300 kr i startavgift och 250 kr i månaden. Ett annat kostar 400 kr i månaden utan startavgift. '
                     'Efter hur många månader har det första blivit billigast? {C}', 1),
                    ('Är sambandet i tabellen linjärt, exponentiellt eller inget av dem? Motivera. {C}', 1,
                     tabell(['x', '0', '1', '2', '3'], [['y', '5', '10', '20', '40']], bredd_kol=80)),
                    ('Linjerna y = ax + 2 och y = 3x − 4 skär varandra där x = 2. Bestäm a och förklara vad svaret betyder för linjen. {A}', 2)],
         beskrivning='Träning inför nationella provet i matematik nivå 1: räta linjens ekvation, funktionsvärden, linjära och exponentiella modeller.'),

    dict(fil='gy1-np-matematik-1-geometri-och-sannolikhet', arskurs='gy1', amne='Matematik',
         titel='NP-träning: geometri och sannolikhet', omrade='Nationella provet i matematik nivå 1', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Redovisa dina lösningar. Du får använda räknare och formelblad.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('I en rätvinklig triangel är hypotenusan 10 cm och en vinkel 30°. Hur lång är kateten mitt emot vinkeln? [] cm {E}', 0),
                    ('Bestäm vinkeln v om tan v = 1. [] ° {E}', 0),
                    ('En kon har radien 3 cm och höjden 4 cm. Beräkna volymen. Svara med en decimal. [[]] cm³ {E}', 0),
                    ('Två likformiga cylindrar har höjderna 5 cm och 10 cm. Hur många gånger större volym har den större? [] {C}', 0),
                    ('Du kastar två tärningar. Hur stor är sannolikheten att summan blir 10 eller mer? [[]] {C}', 0),
                    ('En klass har 12 tjejer och 10 killar. Två elever lottas till elevrådet. Hur stor är sannolikheten att båda är tjejer? {C}', 1),
                    ('Visa att arean av en kvadrat med diagonalen d är d²/2. {A}', 2)],
         beskrivning='Träning inför nationella provet i matematik nivå 1: trigonometri, volym, likformighet och sannolikhet i flera steg.'),

    dict(fil='gy1-genomgang-matematik-1', arskurs='gy1', amne='Matematik',
         titel='Genomgång: matematik 1', omrade='Inför nationella provet i matematik nivå 1', tid='20 minuter',
         instruktion=['Ett faktablad med metoder och formler som ofta behövs i matematik nivå 1, med exempel.',
                      'Läs ett avsnitt i taget och pröva sedan uppgifterna längst ner.'],
         text=['# Procent och förändringsfaktor',
               'En ökning med 12 % ger förändringsfaktorn 1,12 och en minskning med 12 % ger 0,88. Nytt värde = gammalt värde · '
               'förändringsfaktor. Från 20 % till 25 % är en ökning med 5 procentenheter, men med 25 procent.',
               '# Potenser',
               'aᵐ · aⁿ = aᵐ⁺ⁿ, aᵐ / aⁿ = aᵐ⁻ⁿ, (aᵐ)ⁿ = aᵐⁿ, a⁰ = 1 och a⁻ⁿ = 1/aⁿ. Grundpotensform: 45 000 = 4,5 · 10⁴.',
               '# Funktioner',
               'Linjär funktion: y = kx + m, där k är lutningen och m skärningen med y-axeln. Exponentialfunktion: y = C · aˣ, där C är '
               'startvärdet och a förändringsfaktorn.',
               '# Trigonometri och sannolikhet',
               'I en rätvinklig triangel är sin v = motstående / hypotenusan, cos v = närliggande / hypotenusan och tan v = motstående / '
               'närliggande. För oberoende händelser multipliceras sannolikheterna, och sannolikheten att något inte inträffar är 1 minus '
               'sannolikheten att det inträffar.'],
         uppgifter=[('Vilken förändringsfaktor hör till en minskning med 7 %? [[]]', 0),
                    ('Skriv 0,00052 i grundpotensform. [[]]', 0),
                    ('Förenkla 3⁴ · 3² / 3⁵. []', 0)],
         beskrivning='Faktablad om förändringsfaktor, potenser, funktioner, trigonometri och sannolikhet, med tre uppgifter.'),

    dict(fil='gy1-np-svenska-1-skonlitteratur', arskurs='gy1', amne='Svenska',
         titel='NP-träning: skönlitteratur, svenska 1', omrade='Nationella provet i svenska nivå 1', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provets läsdel finns både sakprosa och skönlitteratur. Stöd svaren på texten.'],
         text=['# Färjan',
               'Det var sista turen för säsongen. Färjan gled ut från bryggan, och Ingrid stod vid relingen med jackan uppdragen till '
               'hakan. Ön krympte bakom dem: de röda stugorna, flaggstången, klippan där de hade badat varje morgon. Hon räknade '
               'somrarna i huvudet. Sjutton. Nästa sommar skulle hon bo i en annan stad.',
               'Pappa kom ut från kafeterian med två muggar choklad och ställde sig bredvid henne utan att säga något.',
               '– Du kan alltid komma tillbaka, sa han till slut.',
               'Ingrid nickade. Men den som kom tillbaka var aldrig samma person som den som åkte.',
               'När ön var ett grått streck vände hon sig om och tittade framåt, mot fastlandets tända lampor.'],
         uppgifter=[('Beskriv miljön och stämningen i början av texten. Ge exempel ur texten.', 2),
                    ('Vilket berättarperspektiv används, och hur påverkar det läsningen?', 2),
                    ('Vad menar Ingrid med att ”den som kom tillbaka var aldrig samma person”?', 2),
                    ('Vad kan ön och fastlandet symbolisera?', 2),
                    ('Vilket tema har texten? Motivera.', 2)],
         beskrivning='Träning inför nationella provets läsdel i svenska nivå 1: en kort berättelse med frågor om miljö, berättarperspektiv, symbolik och tema.'),

    dict(fil='gy1-np-svenska-1-referera', arskurs='gy1', amne='Svenska',
         titel='NP-träning: referera, svenska 1', omrade='Nationella provet i svenska nivå 1', tid='35 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provets skrivdel ska du kunna återge och hänvisa till källor. Här tränar du referat, citat och referatmarkörer.'],
         text=['Påhittad artikel för övningen: Kim Berg, ”Varför vi glömmer”, publicerad 2025 på en webbplats om hälsa.',
               'Vi glömmer för att hjärnan måste prioritera. Varje dag tar vi emot mer information än vi kan lagra, och det mesta '
               'sorteras bort redan efter några timmar. Det vi upprepar, eller som väcker starka känslor, har störst chans att stanna '
               'kvar. Glömska är alltså inte bara ett fel i systemet utan en del av hur minnet fungerar.'],
         uppgifter=[('Skriv ett referat av artikeln på två eller tre meningar. Börja med en referatmarkör, till exempel ”Enligt Kim Berg ...”.', 3),
                    ('Skriv ett direkt citat ur texten med korrekt hänvisning.', 1),
                    ('Vad är skillnaden mellan ett citat och ett referat?', 2),
                    ('Vilket av verben ”konstaterar” och ”påstår” visar att du tvivlar på det Berg skriver? Förklara.', 1),
                    ('Skriv en mening där du håller med Berg eller invänder, och där det tydligt framgår att det är din egen åsikt.', 2)],
         beskrivning='Träning inför nationella provets skrivdel i svenska nivå 1: referat, citat och referatmarkörer utifrån en påhittad artikel.'),

    dict(fil='gy1-genomgang-argumentation-och-kallor', arskurs='gy1', amne='Svenska',
         titel='Genomgång: argumentation och källor', omrade='Inför nationella provet i svenska nivå 1', tid='20 minuter',
         instruktion=['Ett faktablad om argumentationens delar, retorikens appeller och hur du refererar och hänvisar till källor.',
                      'Läs ett avsnitt i taget och pröva sedan uppgifterna längst ner.'],
         text=['# Argumentationens delar',
               'Tesen är det du vill övertyga om. Argumenten är skälen för tesen, och beläggen stöder argumenten, till exempel med fakta, '
               'statistik eller exempel. Ett motargument är ett skäl mot tesen, som du bemöter för att visa att tesen ändå håller.',
               '# Retorikens appeller',
               'Ethos bygger förtroende för den som talar eller skriver, pathos väcker känslor och logos övertygar med fakta och logik.',
               '# Referat och källhänvisning',
               'När du återger någon annans text gör du det med egna ord, i presens och utan egna värderingar. Referatmarkörer som '
               'menar, skriver och konstaterar visar att det är någon annans tankar. Ange källan i texten, här med en påhittad '
               'artikel: ”I artikeln ’Varför vi glömmer’ (2025) skriver Kim Berg att ...”.',
               '# Språket',
               'Dela in texten i stycken med en tanke vardera, variera meningsbyggnaden och använd bindeord som däremot, därför och '
               'dessutom för att visa hur resonemanget hänger ihop.'],
         uppgifter=[('Vilken del av argumentationen är detta: ”Enligt en undersökning läser hälften av eleverna mindre än förut.” ___', 0),
                    ('Skriv om till ett neutralt referat: ”Berg har helt rätt i att vi glömmer för att hjärnan måste prioritera.”', 1),
                    ('Vilken appell används: ”Tänk på barnen som inte har någon trygg plats att sova på i natt.” ___', 0)],
         beskrivning='Faktablad om tes, argument och belägg, ethos, pathos och logos, referat och källhänvisning, med tre uppgifter.'),

    dict(fil='gy1-np-engelska-1-short-story', arskurs='gy1', amne='Engelska',
         titel='NP-träning: short story, engelska 1', omrade='Nationella provet i engelska nivå 1', tid='35 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Answer in English. Use full sentences.'],
         text=['# The Interview',
               'Hannah had practised her answers in the mirror for a week. "Why do you want this job?" she had asked her reflection, and '
               'her reflection had answered with a confident smile. Now, sitting in the narrow corridor outside the manager\'s office, '
               'she could not remember a single word.',
               'The boy next to her was tapping his foot. He wore a suit that was clearly borrowed from someone taller. When their eyes '
               'met, he grinned. "First interview?" he whispered. She nodded. "Me too. My mum says to imagine they\'re wearing pyjamas."',
               'Hannah laughed so loudly that the receptionist looked up, and the knot in her stomach loosened. When her name was called, '
               'she stood up, smoothed her jacket and pictured the manager in striped pyjamas.',
               'She did not get the job. But three weeks later, at a bus stop, she recognised the boy in the borrowed suit. This time she said hello first.'],
         uppgifter=[('How does Hannah feel before the interview? Support your answer with the text.', 1),
                    ("Why does the boy's comment help her?", 1),
                    ('What does it mean that "the knot in her stomach loosened"? Explain in your own words.', 1),
                    ('What does the detail of the borrowed suit tell us about the boy?', 1),
                    ('What does the ending suggest? Explain.', 2),
                    ('What is the theme of the story?', 1)],
         beskrivning='Träning inför nationella provets läsdel i engelska nivå 1: en kort berättelse om en anställningsintervju, med frågor om personer, detaljer och tema.'),

    dict(fil='gy1-genomgang-writing-engelska-1', arskurs='gy1', amne='Engelska',
         titel='Genomgång: writing, engelska 1', omrade='Inför nationella provet i engelska nivå 1', tid='20 minuter',
         instruktion=['Ett faktablad om stilnivå, stycken, bindeord och vanliga fel i engelska texter.',
                      'Läs ett avsnitt i taget och pröva sedan uppgifterna längst ner.'],
         text=['# Formal and informal',
               "Informal texts use contractions (I'm, don't) and everyday words (get, a lot of, kids). Formal texts use full forms (I am, "
               "do not) and more formal words (receive, many or much, children). Choose the style that suits the reader.",
               '# Paragraphs',
               'Each paragraph develops one idea. The topic sentence tells the reader what the paragraph is about, and the following '
               'sentences explain it and give examples.',
               '# Linking words',
               'Addition: furthermore, moreover. Contrast: however, nevertheless, whereas. Cause and effect: because, therefore, as a '
               'result. Examples: for instance, such as.',
               '# Common mistakes',
               'Use the present perfect for something that started in the past and is still true: I have lived here for three years. '
               'Information has no plural. Days and months have capital letters in English: Monday, May.'],
         uppgifter=[("Make it formal: \"I'm gonna get back to you asap.\"", 1),
                    ('Correct the mistake: I live in Stockholm since 2020.', 1),
                    ('Choose the right word: The plan is cheap. ___, it takes a long time. (Therefore / However / For instance)', 0)],
         beskrivning='Faktablad om formell och informell stil, stycken, bindeord och vanliga fel på engelska, med tre uppgifter.'),

    dict(fil='gy2-np-matematik-2-andragradsfunktioner', arskurs='gy2', amne='Matematik',
         titel='NP-träning: andragradsfunktioner', omrade='Nationella provet i matematik nivå 2', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Redovisa dina lösningar. Formelbladet får användas på alla delar av provet.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('Lös ekvationen x² − 5x + 6 = 0. {E}', 1),
                    ('Lös ekvationen 2x² = 18. x = [[]] {E}', 0),
                    ('Bestäm nollställena till f(x) = x² + 2x − 15. {E}', 1),
                    ('Ange symmetrilinjen för y = (x − 1)(x − 7). [[]] {C}', 0),
                    ('En andragradsfunktion har nollställena x = −1 och x = 5 och går genom punkten (0, −10). Bestäm funktionen. {C}', 2),
                    ('Utveckla och förenkla (x + 3)² − (x − 3)². {C}', 1),
                    ('För vilket värde på c har ekvationen x² − 6x + c = 0 exakt en lösning? [] {C}', 0),
                    ('Visa att f(x) = x² − 4x + 5 saknar nollställen, och bestäm funktionens minsta värde. {A}', 2)],
         beskrivning='Träning inför nationella provet i matematik nivå 2: andragradsekvationer, nollställen, symmetrilinje, kvadreringsregler och att bestämma en funktion.'),

    dict(fil='gy2-np-matematik-2-blandat', arskurs='gy2', amne='Matematik',
         titel='NP-träning: matematik 2, blandat', omrade='Nationella provet i matematik nivå 2', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Redovisa dina lösningar. Du får använda räknare och formelblad.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('Beräkna lg 10 000 − lg 100. [] {E}', 0),
                    ('Lös ekvationen 10ˣ = 500. Svara med tre decimaler. [[]] {E}', 0),
                    ('Lös ekvationssystemet 2x + 3y = 12 och x − y = 1. {E}', 1),
                    ('Värdena 4, 7, 7, 8 och 9 mättes. Beräkna medelvärdet och standardavvikelsen, räknad som för ett stickprov. '
                     'Avrunda till en decimal. {E}', 1),
                    ('En bakteriekultur fördubblas var åttonde timme. Hur lång tid tar det innan den har blivit tio gånger så stor? '
                     'Svara med en decimal. {C}', 2),
                    ('I ett spridningsdiagram ligger punkterna nära en rät linje med negativ lutning. Vad säger det om sambandet? {C}', 1),
                    ('Visa med hjälp av potenslagarna att lg(a · b) = lg a + lg b. {A}', 2)],
         beskrivning='Träning inför nationella provet i matematik nivå 2: logaritmer, exponentialekvationer, ekvationssystem, standardavvikelse och korrelation.'),

    dict(fil='gy2-genomgang-matematik-2', arskurs='gy2', amne='Matematik',
         titel='Genomgång: matematik 2', omrade='Inför nationella provet i matematik nivå 2', tid='20 minuter',
         instruktion=['Ett faktablad med metoder och formler som ofta behövs i matematik nivå 2, med exempel.',
                      'Läs ett avsnitt i taget och pröva sedan uppgifterna längst ner.'],
         text=['# Andragradsekvationer',
               'Ekvationen x² + px + q = 0 löses med pq-formeln: x = −p/2 ± √((p/2)² − q). Är uttrycket under rottecknet negativt '
               'saknas reella lösningar. Går vänsterledet att faktorisera kan du använda nollproduktmetoden: x(x − 4) = 0 ger x = 0 eller x = 4.',
               '# Kvadreringsreglerna',
               '(a + b)² = a² + 2ab + b², (a − b)² = a² − 2ab + b² och konjugatregeln (a + b)(a − b) = a² − b².',
               '# Andragradsfunktioner',
               'Grafen till y = ax² + bx + c är en parabel. Om a > 0 har den en minimipunkt och om a < 0 en maximipunkt. För '
               'y = x² + px + q är symmetrilinjen x = −p/2.',
               '# Logaritmer och statistik',
               'lg x är det tal som 10 ska upphöjas till för att bli x. lg(ab) = lg a + lg b, lg(a/b) = lg a − lg b och lg aⁿ = n · lg a. '
               'Standardavvikelsen mäter hur mycket värdena sprider sig kring medelvärdet. I en normalfördelning ligger ungefär 68 % av '
               'värdena inom en standardavvikelse från medelvärdet och ungefär 95 % inom två.'],
         uppgifter=[('Lös x² − 2x − 3 = 0 med pq-formeln.', 1),
                    ('Utveckla (2x − 1)².', 1),
                    ('Skriv lg 8 med hjälp av lg 2. [[]]', 0)],
         beskrivning='Faktablad om pq-formeln, kvadreringsreglerna, andragradsfunktioner, logaritmer och standardavvikelse, med tre uppgifter.'),

    dict(fil='gy2-np-engelska-2-opinion-piece', arskurs='gy2', amne='Engelska',
         titel='NP-träning: opinion piece, engelska 2', omrade='Nationella provet i engelska nivå 2', tid='40 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'Show that you understand what the text says and how. Use full sentences, except for one-word answers.'],
         text=['# Why I stopped counting my steps',
               'For two years, my wrist told me how good a person I was. Ten thousand steps: well done. Six thousand: try harder '
               'tomorrow. I checked the number before breakfast, after lunch and, embarrassingly, in the middle of conversations.',
               'Fitness trackers are sold as tools for health, and for many people they work. Seeing your progress can be motivating, '
               'and a reminder to stand up from your desk is hardly a bad thing. But somewhere along the way, I stopped walking because '
               'I enjoyed it and started walking to satisfy a machine.',
               'The ten-thousand-step target, it turns out, is not a scientific law. It is usually traced back to a marketing campaign '
               'for a Japanese pedometer in the 1960s, and later research suggests that the health benefits begin well below that number.',
               'So last spring I took the tracker off. I still walk most days, but now I notice the trees rather than the total. I may be '
               'less "productive", but I am, I think, a little freer.'],
         uppgifter=[("What is the writer's main argument?", 1),
                    ('What does the writer reveal about the ten-thousand-step target, and why does it matter for the argument?', 2),
                    ('What does the word "embarrassingly" tell us about the tone of the first paragraph?', 1),
                    ('Why do you think the writer puts "productive" in quotation marks?', 1),
                    ('Do you agree with the writer? Give one argument of your own.', 1)],
         beskrivning='Träning inför nationella provets läsdel i engelska nivå 2: en åsiktstext om stegräknare, med frågor om argument, ton och ordval.'),

    dict(fil='gy2-genomgang-argumentation-engelska-2', arskurs='gy2', amne='Engelska',
         titel='Genomgång: argumentation, engelska 2', omrade='Inför nationella provet i engelska nivå 2', tid='20 minuter',
         instruktion=['Ett faktablad om tes, nyanser, motargument, sammanhang och formellt ordförråd på engelska.',
                      'Läs ett avsnitt i taget och pröva sedan uppgifterna längst ner.'],
         text=['# Thesis and topic sentences',
               'A thesis states your position in one clear sentence. Each body paragraph opens with a topic sentence that supports the '
               'thesis, followed by explanation and evidence.',
               '# Hedging',
               'Careful writers avoid overstating: may, might, could, arguably, it seems that, to some extent.',
               '# Counterarguments',
               'Acknowledge the other side and respond to it: Critics argue that ... However, ... / While it is true that ..., ...',
               '# Cohesion and vocabulary',
               'Link sentences with pronouns, synonyms and transitions so that the reader can follow your thinking. In formal texts, '
               'prefer precise words: obtain or receive rather than get, many rather than a lot of, demonstrate rather than show, and '
               'avoid contractions.'],
         uppgifter=[("Rewrite with hedging: \"Social media destroys young people's concentration.\"", 1),
                    ('Write a sentence that acknowledges a counterargument and responds to it.', 2),
                    ("Make it more formal: \"Lots of people think it's a bad idea.\"", 1)],
         beskrivning='Faktablad om tes och ämnesmeningar, hedging, motargument, sammanhang och formellt ordförråd på engelska, med tre uppgifter.'),

    dict(fil='gy3-np-svenska-3-jamfora-texter', arskurs='gy3', amne='Svenska',
         titel='NP-träning: jämföra texter, svenska 3', omrade='Nationella provet i svenska kurs 3 och nivå 3', tid='45 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som det nationella provet, inga riktiga provuppgifter.',
                      'På provet arbetar du med flera källor. Här jämför du två påhittade texter om samma fråga.'],
         text=['Text A, ur en påhittad debattartikel av en rektor: ”AI-verktyg kommer att förändra skolan i grunden. Den som lär sig '
               'använda dem klokt får en assistent som förklarar, ger exempel och svarar på frågor dygnet runt. Skolans uppgift är inte '
               'att förbjuda verktygen utan att lära eleverna att granska det de svarar.”',
               'Text B, ur ett påhittat blogginlägg av en gymnasieelev: ”Jag använder AI ibland, men jag märker att jag lär mig mindre '
               'när jag låter den göra jobbet. Det är som att titta på någon som tränar och tro att man själv blir starkare. Svaren låter '
               'säkra även när de är fel, och det är lätt att sluta tänka.”'],
         uppgifter=[('Vad är huvudtanken i text A och i text B?', 2),
                    ('På vilket sätt är skribenterna överens, och var skiljer de sig åt?', 2),
                    ('Vilken text tycker du är mest övertygande? Motivera med textens argument och avsändare.', 2),
                    ('Text B innehåller en liknelse. Vilken, och vad vill skribenten visa med den?', 2),
                    ('Skriv ett stycke som sammanför båda perspektiven, med en hänvisning till varje text. Fortsätt på eget papper vid behov.', 4)],
         beskrivning='Träning inför nationella provet i svenska nivå 3: jämföra två påhittade texter om AI i skolan och skriva ett stycke som sammanför dem.'),

    dict(fil='gy3-genomgang-utredande-text', arskurs='gy3', amne='Svenska',
         titel='Genomgång: utredande text, svenska 3', omrade='Inför nationella provet i svenska kurs 3 och nivå 3', tid='20 minuter',
         instruktion=['Ett faktablad om hur en utredande text byggs upp och hur du hanterar källor.',
                      'Läs ett avsnitt i taget och pröva sedan uppgifterna längst ner.'],
         text=['# Utredande text',
               'En utredande text undersöker en fråga från flera håll. Inledningen presenterar ämnet, syftet och frågeställningen. '
               'Avhandlingen redogör för olika perspektiv med stöd i källor, och avslutningen sammanfattar och drar en egen slutsats som '
               'svarar på frågeställningen.',
               '# Saklighet',
               'Håll isär referat och eget resonemang. Använd referatmarkörer och en neutral ton när du återger källor, och visa '
               'tydligt när du själv tolkar eller värderar.',
               '# Källhänvisning',
               'Hänvisa i löptexten, till exempel (Berg, 2025), och samla källorna i en källförteckning med upphovsperson, år, titel och '
               'var texten är publicerad. Direkta citat skrivs inom citattecken och ska vara ordagranna.',
               '# Språk och stil',
               'Skriv sakligt och varierat, använd ämnets fackord och förklara dem vid behov, och visa logiska samband med bindeord som '
               'följaktligen, däremot och med andra ord.'],
         uppgifter=[('Formulera en frågeställning för en utredande text om skärmtid.', 1),
                    ('Skriv om så att det blir sakligt: ”Det är helt sjukt hur mycket tid vi lägger på mobilen.”', 1),
                    ('Vad ska en källförteckning innehålla? Nämn tre uppgifter.', 1)],
         beskrivning='Faktablad om den utredande textens uppbyggnad, saklighet, källhänvisning och stil, med tre uppgifter.'),

    dict(fil='gy3-provtraning-matematik-3c', arskurs='gy3', amne='Matematik',
         titel='Provträning: matematik 3c', omrade='Matematik 3c', tid='45 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som proven i matematik på gymnasiet, för dig som läser Matematik 3c.',
                      'Redovisa dina lösningar. Du får använda räknare och formelblad.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('Derivera f(x) = 3x⁴ − 2x² + x. {E}', 1),
                    ('Beräkna f′(2) om f(x) = x³ − 5x. [] {E}', 0),
                    ('Bestäm en primitiv funktion till g(x) = 6x² + 4. {E}', 1),
                    ('Förenkla (x² − 9) / (x − 3). [[]] {E}', 0),
                    ('Bestäm extrempunkterna till f(x) = x³ − 3x² och avgör om de är maximi- eller minimipunkter. {C}', 2),
                    ('Beräkna ∫ (3x² + 2x) dx från x = 0 till x = 2. [] {E}', 0),
                    ('I triangeln ABC är AB = 8 cm, AC = 6 cm och vinkeln A = 60°. Beräkna BC. Svara med en decimal. {E}', 1),
                    ('Av en kvadratisk skiva med sidan 30 cm görs en låda utan lock genom att lika stora kvadrater skärs bort i hörnen. '
                     'Hur stora ska hörnkvadraterna vara för att volymen ska bli så stor som möjligt? {A}', 3)],
         beskrivning='Provträning i matematik 3c: derivator, primitiva funktioner, rationella uttryck, extrempunkter, integraler, cosinussatsen och optimering.'),

    dict(fil='gy3-provtraning-matematik-4', arskurs='gy3', amne='Matematik',
         titel='Provträning: matematik 4', omrade='Matematik 4', tid='45 minuter',
         instruktion=['Nextrums egna uppgifter i samma stil som proven i matematik på gymnasiet, för dig som läser Matematik 4.',
                      'Redovisa dina lösningar. Du får använda räknare och formelblad.',
                      'Märket efter uppgiften visar vilken nivå den tränar: E, C eller A.'],
         uppgifter=[('Beräkna (3 + 2i) + (1 − 5i). [[]] {E}', 0),
                    ('Beräkna (2 + i)(3 − i). [[]] {E}', 0),
                    ('Derivera f(x) = sin 3x. [[]] {E}', 0),
                    ('Lös ekvationen z² + 4 = 0. [[]] {E}', 0),
                    ('Derivera f(x) = x · e²ˣ. {C}', 1),
                    ('Lös ekvationen cos x = 0,5 för 0 ≤ x ≤ 2π. Svara exakt. {C}', 1),
                    ('Visa med enhetscirkeln att sin²x + cos²x = 1. {A}', 2),
                    ('Bestäm det största värdet av f(x) = x · e⁻ˣ. {A}', 2)],
         beskrivning='Provträning i matematik 4: komplexa tal, derivator av trigonometriska och sammansatta funktioner, trigonometriska ekvationer och extremvärden.'),
]
