# -*- coding: utf-8 -*-
"""Facit till bladen i gymnasiet.py: ett svar per uppgift, i bladets ordning. Läs om facit i bygg-banken.py."""

FACIT = {
    'gy1-matematik-ekvationer-och-potenser': [
        'x = 7 (4x = 28)',
        'x = 5 (3x + 6 = 2x + 11)',
        'x = 20 (x/5 = 4)',
        '2⁷ = 128',
        '25x²',
        '4,2 · 10⁻⁴',
        '4 335 kr (6 000 · 0,85² = 4 335)',
    ],

    'gy2-matematik-andragradsekvationer': [
        'x = 7 eller x = −7',
        'x₁ = 2, x₂ = 4 (x = 3 ± √(9 − 8))',
        'x₁ = 3, x₂ = −5 (x = −1 ± √(1 + 15))',
        'x₁ = 5, x₂ = −1 (x² − 4x − 5 = 0, x = 2 ± √(4 + 5))',
        'x₁ = 0, x₂ = 4 (en produkt är noll när någon faktor är noll)',
        'Nej. (p/2)² − q = 4 − 5 = −1 < 0, och roten ur ett negativt tal saknas bland de reella talen.',
        '4 cm och 6 cm. x(x + 2) = 24 ger x² + 2x − 24 = 0, x = −1 ± 5, alltså x = 4 (x = −6 är ingen längd).',
    ],

    'gy3-matematik-derivata': [
        "f′(x) = 5x⁴",
        "f′(x) = 12x² − 2",
        "f′(x) = 2x + 3, f′(2) = 7",
        "f′(x) = −6x⁻² = −6/x²",
        "3 (y′ = 3x², y′(−1) = 3 · (−1)² = 3)",
        "x = 4, ett minimum. f′(x) = 2x − 8 = 0 ger x = 4; f′ byter tecken från − till + (parabeln öppnar sig uppåt). f(4) = −13.",
        "h′(t) = 20 − 10t, h′(1) = 10 m/s: efter 1 s stiger bollen med hastigheten 10 m/s (höjden ökar 10 m per sekund just då).",
    ],

    'gy1-matematik-volym-skala-och-likformighet': [
        '283 cm³ (π · 3² · 10 ≈ 282,7)',
        '151 cm³ (π · 4² · 9 / 3 = 48π ≈ 150,8)',
        '905 cm³ (4 · π · 6³ / 3 = 288π ≈ 904,8)',
        '72 liter (60 · 30 · 40 = 72 000 cm³ = 72 dm³)',
        '4 km (8 · 50 000 = 400 000 cm)',
        '12,7 cm. 1,0 liter = 1 000 cm³, r = 5 cm: h = 1 000 / (π · 5²) ≈ 12,7',
        '125 cm². k = 15/6 = 2,5, areaskalan k² = 6,25: 20 · 6,25 = 125',
    ],

    'gy1-matematik-linjara-modeller': [
        'y = 20x + 120',
        '9 GB (20x + 120 = 300 ger 20x = 180)',
        'B. A: 20 · 15 + 120 = 420 kr, B: 300 kr, C: 10 · 15 + 200 = 350 kr',
        '20 är kostnaden per GB (k, förändringen), 120 är den fasta månadsavgiften (m, startvärdet).',
        'Över 8 GB. 10x + 200 < 20x + 120 ger 80 < 10x, alltså x > 8',
        'k = 3, m = 1 (k = (19 − 7)/(6 − 2) = 3; 7 = 3 · 2 + m)',
        'A: rät linje från (0, 120) till (12, 360). B: vågrät linje y = 300. Linjerna skär varandra i (9, 300).',
    ],

    'gy1-svenska-retorik': [
        'Skolan ska införa mobilfria raster.',
        '"Som ordförande i elevrådet har jag pratat med över hundra elever" (eller "Jag har gått i den här skolan i två år"): talaren visar att hen vet vad hen talar om.',
        '"Tänk dig en rast där du hör någons skratt i stället för en notis" (också "en gåva till oss alla", "Kära klasskamrater").',
        'Eget svar. Godta: att över hundra elever tillfrågats och de flesta saknar att umgås (siffror, undersökning), eller "Rasten finns för att vi ska vila hjärnan och träffa varandra" (ett logiskt skäl). Motiveringen ska säga att det är fakta eller ett resonemang, inte känslor.',
        'Mottagare: klasskamraterna, eleverna på skolan ("Kära klasskamrater"). Syfte: att övertyga dem om att skolan ska införa mobilfria raster och få deras stöd.',
        'Eget svar. Svagheter: vaga siffror ("de flesta", "många"), inga källor, inga motargument bemöts (t.ex. att mobilen behövs för kontakt hemåt), och ett förbud kallas "inte ett förbud". Mer övertygande: konkreta siffror eller forskning, bemöta motargument, ett tydligt förslag på hur det ska gå till.',
    ],

    'gy1-engelska-formal-email': [
        'Till exempel: "Dear Sir or Madam, I am writing to ask for information about the course. Could you please send it to me as soon as possible?" (fullständiga ord, ingen slang, artig fråga)',
        'Till exempel: "Thank you in advance for your help. Yours sincerely / Yours faithfully" (eller "Kind regards") följt av namnet.',
        'Yours sincerely',
        'Yours faithfully',
        'b) I would like to know the price.',
        'Eget svar. Ett bra mejl har formell hälsning (Dear Sir or Madam), skäl till att skriva (I am writing to ask about ...), alla tre frågorna (pris, startdatum, boende) med artiga fraser (Could you please ..., I would like to know ...), en avslutning (I look forward to hearing from you. Yours faithfully) och namn. Inga kortformer eller slang, ungefär 80 ord.',
    ],

    'gy1-no-kemi-mol-och-substansmangd': [
        '18,0 g/mol (2 · 1,0 + 16,0)',
        '2,0 mol (n = 36 / 18,0)',
        '29 g (M = 23,0 + 35,5 = 58,5 g/mol; m = 0,50 · 58,5 ≈ 29,3 g)',
        '100,1 g/mol (40,1 + 12,0 + 3 · 16,0)',
        '132 g ≈ 1,3 · 10² g (M = 44,0 g/mol; m = 3,0 · 44,0)',
        '0,25 mol/dm³ (c = 0,50 / 2,0)',
        '0,050 mol (n = 0,20 · 0,250)',
        '3,0 · 10²³ molekyler (0,50 · 6,02 · 10²³ = 3,01 · 10²³)',
        '4,0 mol H₂O och 2,0 mol O₂ (förhållandet H₂ : O₂ : H₂O = 2 : 1 : 2)',
    ],

    'gy2-matematik-exponentialfunktioner': [
        '2⁵ = 32 och 5⁻² = 1/25 = 0,04',
        'lg 100 = 2 och lg 0,01 = −2',
        'x = 6 (2⁶ = 64)',
        'x ≈ 2,73 (x = lg 20 / lg 3)',
        'y = 500 · 2ˣ',
        '32 000 (500 · 2⁶)',
        '7,64 timmar. 500 · 2ˣ = 100 000 ger 2ˣ = 200, x = lg 200 / lg 2 ≈ 7,64',
        '1/8 = 12,5 % (tre halveringar: 0,5³)',
        '119 900 kr (200 000 · 0,88⁴ ≈ 119 939)',
    ],

    'gy2-matematik-trigonometri': [
        '5,7 cm (x = 10 · sin 35°)',
        '36,9° (tan v = 6/8)',
        '3,8 m (4,0 · sin 70°)',
        '11,3 cm (b = 8 · sin 65° / sin 40°)',
        '7,0 cm (a² = 7² + 9² − 2 · 7 · 9 · cos 50° ≈ 49,0)',
        '24,1 cm² (T = 7 · 9 · sin 50° / 2)',
        'sin 30° = 0,5 och cos 60° = 0,5',
        '31,2 m (h = 50 · tan 32°)',
    ],

    'gy2-matematik-sannolikhet-och-kombinatorik': [
        '3/10 = 0,3. Trädet: röd 3/5 → röd 2/4 eller blå 2/4; blå 2/5 → röd 3/4 eller blå 1/4. P(två röda) = 3/5 · 2/4 = 6/20',
        '3/5 = 0,6 (P(röd, blå) + P(blå, röd) = 3/5 · 2/4 + 2/5 · 3/4 = 12/20)',
        '9/25 = 0,36 (3/5 · 3/5)',
        '1/6 (6 av 36 utfall: 1+6, 2+5, 3+4, 4+3, 5+2, 6+1)',
        '10 000 (10⁴)',
        '120 (5! = 5 · 4 · 3 · 2 · 1)',
        '15 (6! / (2! · 4!) = 6 · 5 / 2)',
        '91/216 ≈ 0,42 (1 − P(ingen sexa) = 1 − (5/6)³ = 1 − 125/216)',
    ],

    'gy2-svenska-kallkritik': [
        'Tendens: säljaren tjänar pengar på att man köper produkten och har ett intresse av att överdriva. (Påståendet bör också kontrolleras mot oberoende källor.)',
        'Samtidighet: bilden är inte från händelsen den sägs visa. Också äkthet: bilden är äkta men inte det den utges för. Inlägget kan dessutom ha en tendens (att väcka uppmärksamhet).',
        'Nej. Alla tre bygger på samma källa (nyhetsbyrån), så de är beroende av varandra och räknas som en källa.',
        'En primärkälla kommer direkt från händelsen, t.ex. ett ögonvittnes dagbok, ett foto eller ett protokoll från mötet. En sekundärkälla beskriver i efterhand, t.ex. en lärobok eller en artikel som bygger på andras uppgifter.',
        'Eget svar. Till exempel: jämföra med flera oberoende källor, ta reda på vem avsändaren är och dess syfte, leta upp originalkällan, kontrollera datum, göra en omvänd bildsökning, läsa faktagranskande sajter.',
        'Eget svar. En bra bedömning namnger källan och prövar den mot kriterierna: vem som står bakom (äkthet och tendens), om den bygger på andra källor (beroende) och hur aktuell den är (samtidighet), och drar en slutsats om hur mycket man kan lita på den.',
    ],

    'gy2-engelska-analysing-a-short-text': [
        'It is night, almost midnight. Mira is standing in a street under a flickering streetlamp, where the last bus has just left. It is snowing. (Texten: "almost midnight", "streetlamp", "the snow falling quietly")',
        'Third person. The narrator is not a character and calls her "Mira", "she" and "her", never "I".',
        'From sad and hopeless ("For a moment she wanted to cry") to calm and determined, even at peace ("took a deep breath, and began to walk", "the silence did not feel empty").',
        'Eget svar. The flickering streetlamp can stand for uncertainty, loneliness or her unsteady mood; the snow for calm, beauty and a fresh start, covering the street in white. Svaret ska stödjas av ord ur texten.',
        'Eget svar. She is alone but no longer lonely: the silence feels calm and like her own instead of empty and frightening. "For the first time all week" suggests she has had a hard week and now finds peace and independence.',
        'Eget svar. A good paragraph keeps Mira, the third person, the past tense and the quiet, hopeful mood, and uses images of the night and the snow. Ungefär 3–4 rader.',
    ],

    'gy2-fysik-rorelse-och-newtons-lagar': [
        '75 km/h och 21 m/s (150 / 2,0 = 75; 75 / 3,6 ≈ 20,8)',
        '25 m/s (90 / 3,6)',
        '2,0 m/s² (a = 8,0 / 4,0)',
        '16 m (s = a · t² / 2 = 2,0 · 4,0² / 2)',
        '18 N (F = 12 · 1,5)',
        '6,9 · 10² N, ca 690 N (F = 70 · 9,82 ≈ 687)',
        '29 m/s (v = 9,82 · 3,0 ≈ 29,5)',
        '44 m (s = 9,82 · 3,0² / 2 ≈ 44,2)',
        'Eget svar. Tröghetslagen: en kropp är i vila eller rör sig rakt fram med konstant fart om summan av krafterna på den är noll. Exempel: när bussen bromsar fortsätter passagerarna framåt; en puck glider länge på isen.',
    ],

    'gy3-matematik-integraler': [
        'x⁵/5 + C',
        '2x³ − 2x² + 3x + C',
        '8 ([x³] från 0 till 2 = 8 − 0)',
        '18 ([x² + x] från 1 till 4 = 20 − 2)',
        '1/2 ([−1/x] från 1 till 2 = −1/2 + 1)',
        '12 a.e. ([x³/3 + x] från 0 till 3 = 9 + 3)',
        '1/6 a.e. Skärning där x = x²: x = 0 och x = 1. Mellan dem är x ≥ x²: ∫ (x − x²) dx från 0 till 1 = 1/2 − 1/3 = 1/6',
        'f(x) = 2x² − 3x + 6 (f(x) = 2x² − 3x + C och f(1) = −1 + C = 5 ger C = 6)',
    ],

    'gy3-matematik-trigonometriska-ekvationer': [
        'π/3 och 5π/4',
        '30° och 270°',
        'x = 30° eller x = 150°',
        'x = 120° eller x = 240°',
        'x = 45° eller x = 225°',
        'x = π/6 eller x = 5π/6 (sin x = 1/2)',
        'x ≈ 17,5° eller x ≈ 162,5° (arcsin 0,3 ≈ 17,46°; 180° − 17,46°)',
        'x ≈ ±36,9° + n · 360° (arccos 0,8 ≈ 36,87°)',
        'Amplitud 3, period 180° (360° / 2)',
    ],

    'gy3-svenska-referat-och-sammanfattning': [
        'Till exempel: Sömnen är viktig för minnet, eftersom hjärnan befäster och sorterar minnen under natten, men många tonåringar sover för lite.',
        'Eget svar. Ett bra referat har en hänvisning till källan (I Nextrums exempeltext om sömn och minne ...), skrivs i presens med egna ord, saknar egna åsikter och tar med det viktigaste: minnen befästs under sömnen, hjärnan sorterar information, tonåringar behöver 8–10 timmar men sover ofta mindre, försök med senare skolstart har gett blandade resultat. Högst 60 ord.',
        'Citat: ord för ord inom citattecken. Parafras: samma innehåll eller idé med egna ord, ungefär lika utförligt. Sammanfattning: bara det viktigaste, kortare och med egna ord. Alla tre kräver källhänvisning.',
        'Till exempel: "Forskning om sömn visar ..." (vilken forskning?), att den som sover efter pluggandet minns mer, att tonåringar behöver 8–10 timmar, att många sover betydligt mindre, att skolor i flera länder prövat senare skolstart och att resultaten varit blandade.',
        'Eget svar. En bra forskningsfråga är avgränsad och går att undersöka, t.ex.: "Får elever som sover minst åtta timmar natten före ett prov bättre resultat än elever som sover mindre?"',
    ],

    'gy3-engelska-argumentative-essay': [
        'Eget svar. A clear, arguable claim in one sentence, e.g. "Although social media connects people, it does more harm than good because it damages young people\'s sleep and self-esteem."',
        'however: shows contrast\nfor example: gives an example\ntherefore: shows a result\nin addition: adds a point',
        'Eget svar. The sentence is circular: it gives no reason. Better, e.g.: "Social media can be harmful because constant comparison with others may lower young people\'s self-esteem."',
        'Eget svar. One sentence that states the point of the paragraph, e.g. "Young people can learn valuable skills online, such as languages, coding and video editing."',
        'Eget svar. The counterargument is a fair view of the other side, e.g. "Some argue that social media helps people keep in touch." The rebuttal answers it, e.g. "However, online contact often replaces meeting face to face."',
        'Eget svar. A good conclusion repeats the thesis in new words, sums up the main arguments, adds no new ones and ends with a final thought or recommendation; about five lines.',
    ],

    'gy3-so-ekonomi-bnp-inflation-och-riksbanken': [
        'Eget svar. BNP mäter det sammanlagda värdet av alla varor och tjänster som produceras i ett land under ett år; det används som mått på hur stor ekonomin är och om den växer.',
        '5 % (20 / 400 = 0,05)',
        'Köpkraften minskar (med ungefär 3 %): man kan köpa mindre för samma lön.',
        'Ungefär 1 % (3 % − 2 %; exakt 1,03 / 1,02 ≈ 1,0098)',
        'Inflationen sjunker. Kedjan: bankerna höjer sina räntor → det blir dyrare att låna och lönsammare att spara → hushåll och företag konsumerar och investerar mindre → efterfrågan minskar → priserna stiger långsammare. (Kronan kan också stärkas så att importen blir billigare.)',
        'Till exempel: arbetslösheten ökar, BNP växer långsamt eller minskar, konsumtionen och efterfrågan minskar, företagen investerar mindre, fler konkurser, inflationen sjunker.',
        'Inkomst: t.ex. moms, statlig inkomstskatt, arbetsgivaravgifter. Utgift: t.ex. försvaret, pensioner, sjukförsäkring, bistånd, polisen.',
        'Eget svar. Progressiv skatt: ju högre inkomst, desto större andel betalar man i skatt. För: omfördelar och minskar klyftorna, de som har mer bidrar mer. Mot: kan minska viljan att arbeta mer eller utbilda sig, och kan upplevas som orättvist.',
    ],

    'gy3-biologi-fran-dna-till-protein': [
        'ATGCCGTA (A–T och C–G)',
        'AUGCCGUA (T ger A, A ger U, C ger G, G ger C)',
        'Tre baser. Ett kodon kodar för en aminosyra (tre kodon är i stället stoppsignaler).',
        'I ribosomerna, ute i cytoplasman (fria eller på det endoplasmatiska nätverket).',
        '100 (300 / 3 = 100 kodon; räknar man med att ett av dem är ett stoppkodon blir det 99)',
        'Eget svar. En mutation är en förändring i DNA:s bassekvens, t.ex. att en bas byts ut, försvinner eller läggs till. Följder: en annan aminosyra och ett protein som fungerar sämre (t.ex. sicklecellanemi), ingen effekt alls, eller okontrollerad celldelning (cancer). I könsceller kan den ärvas.',
        'Transkription: en gen i DNA skrivs av till mRNA, i cellkärnan. Translation: ribosomerna läser mRNA kodon för kodon och fogar ihop aminosyror (som tRNA för dit) till ett protein, i cytoplasman.',
        'Eget svar. Olika gener är påslagna (uttrycks) i olika celler. Genregleringen gör att hudcellen och nervcellen tillverkar olika proteiner, och proteinerna avgör cellens form och funktion (celldifferentiering).',
    ],
}
