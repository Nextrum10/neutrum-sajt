/* ============================================================
   NEXTRUM — BILDREGISTER

   DET HÄR ÄR DEN ENDA FILEN DÄR BILDVÄGAR STÅR SKRIVNA.

   Vill du byta ut en bild? Gör så här:
     1. Lägg den nya bilden i bilder/ som <namn>.png (helst 2048px bred)
     2. Kör de fyra sips-raderna längst ned i den här filen för att
        skapa storlekarna 640/960/1280/1600/1920
     3. Byt "file" nedan till det nya namnet
     4. Uppdatera "alt", "focal" och "tint"

   Du behöver ALDRIG leta upp bildvägar ute i HTML-filerna.
   Markupen byggs av NXImg.picture() i nextrum-motion.js.

   Fälten:
     file    filnamn utan ändelse och utan bredd, i bilder/
     w / h   originalets proportioner — sätter aspect-ratio så att
             layouten aldrig hoppar medan bilden laddas
     alt     alt-text på svenska. Beskriv vad som händer, inte
             "bild på". Tom sträng = dekorativ (används inte här)
     focal   object-position. Varje bild har sin egen — ansikten och
             motiv får aldrig beskäras bort. Se §27 i briefen.
     tint    bildens medelfärg, används som platshållare medan den
             laddas så att ytan aldrig blinkar vitt
     credit  vad bilden föreställer, för vår egen skull
   ============================================================ */

window.NEXTRUM_IMAGES = {

  hero: {
    file: 'hero-nextrum',
    w: 2048, h: 1152,
    alt: 'En ung studiehjälpare och en elev sitter vid ett ljust träbord och räknar tillsammans. Båda ler och tittar ner i elevens block.',
    focal: '70% 46%',
    tint: '#A0978E',
    credit: 'Hero — en till en vid köksbordet'
  },

  entillEn: {
    file: '01-en-till-en',
    w: 2048, h: 1152,
    alt: 'En studiehjälpare pekar med pennan på en uppgift i elevens räknebok och förklarar medan eleven skriver.',
    focal: '68% 44%',
    tint: '#ACA193',
    credit: 'En till en — förklaringen'
  },

  anpassning: {
    file: '02-personlig-anpassning',
    w: 2048, h: 1152,
    alt: 'En studiehjälpare står lutad över ett bord där två elever arbetar med varsin uppgift i ett ljust klassrum.',
    focal: '50% 40%',
    tint: '#9E8F79',
    credit: 'Personlig anpassning — två elever, en plan var'
  },

  digitalt: {
    file: '03-digital-laxhjalp',
    w: 2048, h: 1152,
    alt: 'En elev sitter vid sitt skrivbord hemma med anteckningsblock och penna och följer ett studiepass på laptopen.',
    focal: '60% 44%',
    tint: '#948A78',
    credit: 'Digital läxhjälp — passet hemifrån'
  },

  sjalvfortroende: {
    file: '04-sjalvfortroende',
    w: 2048, h: 1152,
    alt: 'En elev ler över sitt skrivblock efter att ha löst en uppgift, medan studiehjälparen bredvid berättar något.',
    focal: '56% 36%',
    tint: '#897D6A',
    credit: 'Självförtroende — ögonblicket det lossnar'
  },

  laget: {
    file: '05-av-unga-for-unga',
    w: 2048, h: 1152,
    alt: 'Fem unga studiehjälpare står och pratar med varandra framför en bokhylla i ett bibliotek.',
    focal: '60% 42%',
    tint: '#8E8C84',
    credit: 'Av unga, för unga — studiehjälparna'
  },

  /* ---- Andra omgången, genererad 2026-09-02 ----
     Samma Soul 2.0-recept som de sex första: bar putsvägg beskriven
     fotografiskt (aldrig som "yta för text"), åldrar förankrade hårt,
     "no physical contact, hands on the table", och kameravinkeln
     beskriven i stället för "titta inte in i kameran".

     Tre av dem har ändå åldersglidning på handledaren — se "obs"
     nedan. De fungerar, men om varumärkeslöftet "av unga, för unga"
     ska hålla i en viss sektion, välj hellre en utan anmärkning. */

  forklaringen: {
    file: '06-forklaringen',
    w: 2048, h: 1152,
    alt: 'En ung studiehjälpare förklarar en uppgift för en elev vid ett ljust träbord, med handen öppen över räkneboken.',
    focal: '62% 44%',
    tint: '#9A8E79',
    credit: 'Förklaringen — en till en vid bordet. Bar vägg till vänster.'
  },

  genombrottet: {
    file: '07-genombrottet',
    w: 2048, h: 1152,
    alt: 'En elev ler för sig själv över sitt skrivblock efter att ha förstått något svårt, med studiehjälparen bredvid.',
    focal: '38% 40%',
    tint: '#898268',
    credit: 'Genombrottet — motiven till vänster, bar vägg till höger. Obs: handledaren ser äldre ut än 20.'
  },

  teamet: {
    file: '08-teamet',
    w: 2048, h: 1152,
    alt: 'Sex unga studiehjälpare står och pratar med varandra i ett ljust skandinaviskt arbetsrum.',
    focal: '46% 46%',
    tint: '#908670',
    credit: 'Teamet — gruppbild i arbetsrum, stor bar vägg i mitten.'
  },

  online: {
    file: '09-online-v2',
    w: 2048, h: 1152,
    alt: 'En studiehjälpare sitter vid ett skrivbord med laptop och anteckningsblock och håller ett studiepass på distans.',
    focal: '58% 42%',
    tint: '#7E725A',
    credit: 'Distanspasset. Obs: handledaren ser äldre ut än 20, och skärmen syns mer än tänkt. '
          + 'Förstaförsöket ligger kvar som 09-online.png men har lila gränssnitt med inbakad fejktext — använd inte det.'
  },

  forstaMotet: {
    file: '10-forsta-motet',
    w: 2048, h: 1152,
    alt: 'En elev och en studiehjälpare sitter mitt emot varandra vid ett bord och presenterar sig för första gången.',
    focal: '50% 42%',
    tint: '#948979',
    credit: 'Första mötet — symmetrisk komposition med stor tom mitt. Starkast i omgången.'
  },

  studiehjalparen: {
    file: '11-studiehjalparen',
    w: 2048, h: 1152,
    alt: 'En ung studiehjälpare sitter ensam vid ett skrivbord med laptop och anteckningsblock, koncentrerad på sidan.',
    focal: '46% 44%',
    tint: '#8B846E',
    credit: 'Studiehjälparen — enskilt porträtt, för rekryteringssektionen.'
  },

  paVag: {
    file: '12-pa-vag',
    w: 2048, h: 1152,
    alt: 'Tre elever med ryggsäckar går tillsammans längs en gata i eftermiddagssol och pratar med varandra.',
    focal: '34% 48%',
    tint: '#73746C',
    credit: 'På väg — gatubild i motljus, stor slät fasad till höger.'
  },

  kvallsplugg: {
    file: '13-kvallsplugg',
    w: 2048, h: 1152,
    alt: 'En elev arbetar med en uppgift i skenet från en skrivbordslampa medan studiehjälparen bredvid förklarar lugnt.',
    focal: '46% 44%',
    tint: '#453B28',
    credit: 'Kvällsplugg — mörk och varm, tonmässig ytterlighet mot resten av serien. '
          + 'Obs: handledaren ser klart äldre ut än 20.'
  }

};

/* Bredder som finns på disk för varje bild. Ändra bara om du
   genererar andra storlekar. */
window.NEXTRUM_IMAGE_WIDTHS = [640, 960, 1280, 1600, 1920];

/* ------------------------------------------------------------
   HÄLSNINGEN I DE INLOGGADE VYERNA, EN BILD PER VECKODAG (2026-10-06)

   Leo: "rullande heron ändras varje dag så de blir en ny bild, och de
   ska stå vilken dag på veckan de är". Studievyn, studiehjälparvyn och
   elevvyn (NXArbete.hero) tar dagens post; måndag först, som i en svensk
   vecka. En post pekar på en bild ovan, så att focal följer med.

   Filmen hör bara till måndagen: den är filmad i samma scen som
   hero-bilden, och spelade den varje dag hade den legat ovanpå dagens
   bild och gömt den. De andra dagarna driver stillbilden långsamt
   (.vy-hero-still), som den alltid gjort när filmen inte spelar.
   Bilderna är "för nu", sa Leo: byt en nyckel här, inget annat.
   ------------------------------------------------------------ */
window.NEXTRUM_HERO_VECKA = [
  { bild: 'hero', film: 'hero-studievy.mp4' },  // måndag
  { bild: 'entillEn' },                          // tisdag
  { bild: 'digitalt' },                          // onsdag
  { bild: 'sjalvfortroende' },                   // torsdag
  { bild: 'anpassning' },                        // fredag
  { bild: 'genombrottet' },                      // lördag
  { bild: 'online' }                             // söndag
];

/* ------------------------------------------------------------
   INTRODUKTIONEN I STUDIEVYN OCH STUDIEHJÄLPARVYN (2026-10-06)

   Skärmdumpar av vyerna i en telefons bredd, med påhittade familjer,
   som NXIntro (nextrum-introduktion.js) visar en i taget efter första
   inloggningen och under Profil & inställningar. Nyckeln är delen i
   vyn, och NXIntro.STEG bär texten till varje bild. Bilderna ritas av
   verktyg/bygg-introbilder.js (jpg och webp, 780 × 880, dubbel
   upplösning); ändras en del i vyn som en bild visar, kör det igen.
   ------------------------------------------------------------ */
window.NEXTRUM_INTRO = (function () {
  function introbild(roll, del, alt) {
    return { file: 'intro-' + roll + '-' + del, w: 780, h: 880, alt: alt };
  }
  return {
  foralder: {
    oversikt: introbild('foralder', 'oversikt', 'Översikt i studievyn på en telefon: under Att göra en ny tid som '
      + 'studiehjälparen föreslagit, med knapparna Acceptera ny tid och Avböj, och en rapport att bekräfta.'),
    boka: introbild('foralder', 'boka', 'Boka pass på en telefon: stegen Välj dag, Ämne, tid och plats och '
      + 'Föreslå tiden, och kalendern för oktober med dagens datum markerat.'),
    lektioner: introbild('foralder', 'lektioner', 'Mina lektioner på en telefon: flikarna Pass, Studieplan och '
      + 'Efter passen, och passen i matematik med dag, tid, plats och om de är betalda.'),
    bekrafta: introbild('foralder', 'bekrafta', 'Bekräfta rapport på en telefon: rapporten efter ett pass i '
      + 'matematik, med hur det gick, vad de gjorde och vad som behöver tränas.'),
    nexlax: introbild('foralder', 'nexlax', 'NexLäx på en telefon: dagar i rad, XP och märket, hur långt barnet '
      + 'kommit i matematik åk 6, och nästa steg på vägen.'),
    meddelanden: introbild('foralder', 'meddelanden', 'Meddelanden på en telefon: en tråd mellan föräldern och '
      + 'studiehjälparen om läxan och om att flytta ett pass.'),
    profil: introbild('foralder', 'profil', 'Barnens inloggning på en telefon: vad barnet får se och göra, med en '
      + 'knapp för på eller av för passen, studieplanen och rapporterna.')
  },
  studiehjalpare: {
    oversikt: introbild('studiehjalpare', 'oversikt', 'Översikt i studiehjälparvyn på en telefon: under Att göra '
      + 'två tider att svara på och en rapport att skriva.'),
    tider: introbild('studiehjalpare', 'tider', 'Föreslagna tider på en telefon: en tid som familjen föreslagit, med '
      + 'knapparna Acceptera, Avslå och Föreslå annan tid.'),
    lektioner: introbild('studiehjalpare', 'lektioner', 'Lektioner och elever på en telefon: flikarna för passen, '
      + 'eleverna och planen, och de kommande passen med dag, tid och plats.'),
    rapporter: introbild('studiehjalpare', 'rapporter', 'Skriv rapport på en telefon: ett pass i engelska som väntar '
      + 'på sin rapport, med knappen Skriv rapport.'),
    laxor: introbild('studiehjalpare', 'laxor', 'Uppgifter och material på en telefon: knapparna Ny uppgift och '
      + 'Hämta ur materialet, och elevens öppna uppgifter.'),
    meddelanden: introbild('studiehjalpare', 'meddelanden', 'Meddelanden på en telefon: en tråd per familj, med det '
      + 'senaste meddelandet i varje.'),
    statistik: introbild('studiehjalpare', 'statistik', 'Statistik och ersättning på en telefon: genomförda pass och '
      + 'undervisade timmar i siffror.'),
    profil: introbild('studiehjalpare', 'profil', 'Profil och inställningar på en telefon: din profil, det familjerna '
      + 'och Nextrum ser, med bild och namn.')
  }
  };
})();

/* ------------------------------------------------------------
   Så här skapar du storlekarna för en ny bild (kör i bilder/):

     for w in 640 960 1280 1600 1920; do
       sips -s format jpeg -s formatOptions 72 -Z $w NAMN.png \
            --out "NAMN-$w.jpg"
     done

   Och så här plockar du fram tint-färgen:

     sips -s format png -z 1 1 NAMN.png --out /tmp/px.png
   ------------------------------------------------------------ */
