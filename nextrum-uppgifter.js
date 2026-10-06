/* ============================================================
   NEXTRUM — NexLäx (Fas 23.1, 23.2)

   Leo 2026-09-28: läxorna ska vara roligare, "lite som duolingo, du
   klarar en nivå och går vidare". Leo 2026-09-29: Uppgifter och Min
   utveckling blir EN sektion i studievyn, NexLäx, där eleven direkt
   ser var hen är, vad hen klarat, vad som är nästa steg, hur långt hen
   kommit och vad som låses upp. Med XP, en serie i dagar, och
   studiehjälparen och passen inbyggda.

   Delas av foralder.html och larare.html. Här ligger vägen genom
   ämnet, hemmet i NexLäx, utvecklingen, spelaren, märkena, rättningen
   per område och genomgången av ett klart försök. Studievyn äger sina
   frågor mot databasen och händelserna; det här ritar och räknar.

   RÄTTNINGEN SKER I DATABASEN, och XP räknas där. Spelaren skickar
   varje svar till niva_svara() och visar vad den säger, också hur
   många XP svaret gav. Ingenting här räknar ut om ett svar är rätt
   eller hur mycket det är värt: frågorna kommer utan facit och utan
   typens vikt. Totalen och serien kommer ur nexlax_lage(). Se
   filhuvudena i fas23_1_uppgifterna_blir_digitala.sql och
   fas23_2_nexlax.sql.

   UPPLÅSNINGEN SKER HÄR, och bara här. Den är en spelregel och inget
   skydd: niva_starta() startar vilken nivå som helst åt familjens eget
   barn. En vanlig nivå är öppen när den är den första i banan, när
   den vanliga nivån före är klarad, när den redan är klarad eller
   påbörjad, eller när studiehjälparen gett den. Ett Mästarprov öppnas
   när varje vanlig nivå i området är klarad, och klaras det med minst
   två stjärnor är området BEMÄSTRAT (BEMÄSTRAD nedan). Mästarprovet
   stänger aldrig vägen: nästa område öppnas av områdets vanliga nivåer.

   MÄRKENA RÄKNAS UR RADERNA, de sparas inte. Ett märke som stod i en
   egen tabell hade kunnat säga något annat än försöken det bygger på.

   SERIEN RÄKNAS I DAGAR sedan Fas 23.2 (Leo: "🔥 7 dagar"), av
   databasen i svensk tid: en dag räknas när eleven gjort klart en
   nivå, gjort klart något från studiehjälparen eller haft ett pass
   med rapport. Den bryts först efter en hel dag utan något, ingenting
   påminner om den, och rekordet står kvar. Texterna här säger aldrig
   att något går förlorat.

   UPPDRAGEN, NP-SPÅRET, LJUDET OCH FIRANDENA (2026-10-06). Leo: "Ta
   inspiration från duolingo. Gör det mer interaktivt och roligare",
   med ljud och vibration vid rätt, fel, klar nivå och klart område,
   ett quest-system, en enklare väljare av ämne och årskurs och en
   sektion inför nationella provet i varje ämne som har ett.
     · Uppdragen räknas av databasen (nexlax_lage().uppdrag) och ritas
       här. De ger inga XP och påminns aldrig om, som serien.
     · NP-spåret (nivaer.spar = 'np') står i en egen sektion bredvid
       vägen. Sedan samma kväll är allt i NexLäx öppet, på vägen och i
       sektionen: eleven väljer själv vad den behöver öva på.
     · Rangen räknas här ur XP:n, som märkena: ett namn på hur långt
       eleven kommit, inget som ger eller tar något.
     · Ljudet och vibrationen står i nextrum-ljud.js (NXLjud). Här sägs
       bara vad som hände; finns inte filen är allt tyst, inget går
       sönder.
     · Firandena är klasser och CSS, aldrig stil per bildruta: talet
       som räknas upp är en räknare i CSS (@property), konfettin
       bitar med translate och rotate.
   ============================================================ */
window.NXUppgifter = (function () {
  'use strict';

  const esc = NX.esc;

  /* Frågan i text: första raden är frågan, och det som står på raderna
     efter den är kod eller en uppställning (programmeringen, sedan
     2026-09-29). Den ritas i ett block med lika breda tecken, där
     indragen står kvar: i rubrikens typsnitt och storlek gick
     Pythonkoden knappt att läsa på en telefon, och indragen är det
     som avgör vad koden gör. Ett <code> och inte ett <pre>, för blocket
     står inne i frågans rubrik eller stycke. */
  function frågaHtml(text) {
    const t = String(text || '');
    const i = t.indexOf('\n');
    if (i < 0) return esc(t);
    // Den tomma raden mellan frågan och koden hör till texten, inte till
    // blocket: den stod som en tom första rad i det.
    return esc(t.slice(0, i)) + '<code class="upg-kod">' + esc(t.slice(i + 1).replace(/^\n+/, '')) + '</code>';
  }

  /* ---------- ikonerna ----------
     De flesta är streck. De fyllda bär klassen ik-fyll, och CSS:en
     ritar efter den i stället för efter var ikonen råkar stå. */
  const IKON = {
    stjärna: '<svg class="ik-fyll" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.85 5.95 6.45.83-4.72 4.47 1.2 6.4L12 17.1l-5.78 3.15 1.2-6.4L2.7 9.38l6.45-.83z"/></svg>',
    lås: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>',
    bock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    kryss: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
    spela: '<svg class="ik-fyll" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5v13l10-6.5z"/></svg>',
    låga: '<svg class="ik-fyll" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.2c-3.9 0-6.6-2.6-6.6-6.2 0-3.2 2.1-5.3 3.7-7.1.4 1.9 1.4 3.1 2.6 3.7-.3-3.1 1.1-6 3.7-8.6.3 3.1 2.4 5 3.8 7.1a8 8 0 0 1 1.4 4.7c0 3.6-3 6.4-8.6 6.4z"/></svg>',
    blixt: '<svg class="ik-fyll" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.2 2.5 4.8 13.4h6.1l-1.1 8.1 8.4-10.9h-6.1z"/></svg>',
    krona: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.8 8.2l4.4 3.6L12 5.5l3.8 6.3 4.4-3.6-1.7 9.8H5.5z"/><path d="M5.5 20.3h13"/></svg>',
    flagga: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4M6 4.5h11l-2.2 4 2.2 4H6"/></svg>',
    pokal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0zM7.5 6H4.5a3 3 0 0 0 3 4.2M16.5 6h3a3 3 0 0 1-3 4.2M12 13.5V17M8.5 20.5h7M9.5 17h5v3.5h-5z"/></svg>',
    uppåt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17l5.5-5.5 3.5 3.5L20 8M15 8h5v5"/></svg>',
    klocka: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    böcker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 5.5h5v13h-5zM9.5 5.5h5v13h-5zM15 6.2l4.6-1.3 3 12.6-4.6 1.2z"/></svg>',
    bok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 5.5h6a2.5 2.5 0 0 1 2.5 2.5v11a2 2 0 0 0-2-2H3.5z"/><path d="M20.5 5.5h-6A2.5 2.5 0 0 0 12 8v11a2 2 0 0 1 2-2h6.5z"/></svg>',
    repetera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 0 1 12.8-5.3L19.5 9M19.5 4.5V9H15M19.5 12a7.5 7.5 0 0 1-12.8 5.3L4.5 15M4.5 19.5V15H9"/></svg>',
    pil: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
    person: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c0-3.6 3.4-5.8 7.5-5.8s7.5 2.2 7.5 5.8"/></svg>',
    öppetLås: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 6.8-1.2"/></svg>',
    /* 2026-10-06: uppdragen, NP-sektionen, rangen och ljudet. */
    kista: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.5h17v8.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M3.5 10.5V8a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4v2.5"/><path d="M10.5 10.5v3h3v-3"/></svg>',
    kistaÖppen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12.5h17v6.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M3.5 12.5 5.1 6a3 3 0 0 1 3.3-2.3l9.3 1.6a3 3 0 0 1 2.4 2.7l.4 4.5"/><path d="M10.5 12.5v3h3v-3"/><path d="M12 9.6V7.8M8.6 10.1l-.9-1.3M15.4 10.1l.9-1.3"/></svg>',
    kalender: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></svg>',
    prov: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h7.5L19 8v12.5H7z"/><path d="M14.5 3.5V8H19M9.8 12.8l1.6 1.6 3-3.2M9.8 17.5h6"/></svg>',
    medalj: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="14.5" r="6"/><path d="M8.6 9.6 6 3.5h4l2 4.2 2-4.2h4l-2.6 6.1"/><path d="m12 11.8.9 1.8 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z"/></svg>',
    ljudPå: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.5a8 8 0 0 1 0 11"/></svg>',
    ljudAv: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/></svg>',
    vibration: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="4" width="8" height="16" rx="2"/><path d="M4.5 9v6M2.5 10.5v3M19.5 9v6M21.5 10.5v3"/></svg>',
    länk: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4.5h5.5V10M19.5 4.5 11 13M17 13.5v5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 4 18.5v-10A1.5 1.5 0 0 1 5.5 7h5"/></svg>'
  };

  /* Gränserna för stjärnorna. Samma tal står i niva_svara(), som är
     den som räknar; här står de bara för att kunna förklaras. */
  const STJÄRNGRÄNS = [
    'under 60 procent rätt på första försöket: nivån räknas inte som klarad',
    'minst 60 procent rätt på första försöket',
    'minst 80 procent rätt på första försöket',
    'allt rätt på första försöket'
  ];
  /* Ett område är bemästrat när Mästarprovet klarats med minst så här
     många stjärnor, alltså minst 80 procent rätt direkt. En spelregel,
     som upplåsningen: databasen räknar stjärnorna, det här läser dem. */
  const BEMÄSTRAD = 2;
  /* Så många frågor Mästarprovet och repetitionen drar, högst. Samma tal
     som intern.nexlax_mastarfragor() och nexlax_repetitionsfragor(). */
  const MÄSTARPROV_MAX = 10;
  const REPETITION_MAX = 8;

  const TYPTEXT = {
    val: 'Välj rätt svar', skriv: 'Skriv svaret', ordna: 'Sätt i rätt ordning',
    para: 'Para ihop', sant: 'Sant eller falskt?'
  };
  const HEJA = ['Rätt!', 'Snyggt!', 'Precis!', 'Helt rätt!', 'Bra jobbat!', 'Klockrent!'];
  /* Rätt i rad (2026-10-06): vid de här svaren säger beskedet det. */
  const RAD_HEJA = { 3: 'Tre i rad!', 5: 'Fem i rad!', 10: 'Tio i rad!', 15: 'Femton i rad!', 20: 'Tjugo i rad!' };

  /* Knappen för ljudet i spelarens topp. Samma val som på Din väg. */
  function ljudKnapp() {
    if (typeof NXLjud === 'undefined' || !NXLjud) return '';
    const på = NXLjud.ljudPå();
    return '<button type="button" class="upg-spel-ljud" data-spel-ljud aria-pressed="' + (på ? 'true' : 'false') + '" aria-label="Ljud">'
      + (på ? IKON.ljudPå : IKON.ljudAv) + '</button>';
  }

  /* Konfettin när något klaras: bitar med translate och rotate, i
     sajtens färger. Talen per bit sätts på biten själv, där de läses
     (CLAUDE.md avsnitt 3: en custom property ärvs). */
  function konfettiHtml(antal) {
    let ut = '<div class="upg-konfetti" aria-hidden="true">';
    for (let i = 0; i < antal; i++) {
      ut += '<i class="t' + (i % 6) + '" style="--x:' + Math.round(Math.random() * 100) + '%;--d:'
        + (Math.random() * 0.5).toFixed(2) + 's;--dx:' + Math.round((Math.random() - 0.5) * 220) + 'px;--fall:'
        + (55 + Math.round(Math.random() * 45)) + 'vh;--r:' + Math.round(180 + Math.random() * 540) + 'deg"></i>';
    }
    return ut + '</div>';
  }

  /* Ett tal som räknas upp i CSS (@property --nl-n i
     nextrum-uppgifter.css), inte i ett skript som skriver varje
     bildruta. Skärmläsaren får talet i etiketten. */
  function räknare(n, före) {
    return '<span class="nl-raknare-ram" aria-label="' + esc((före || '') + tusen(n)) + '"><span aria-hidden="true">' + esc(före || '')
      + '</span><span class="nl-raknare" aria-hidden="true" style="--till:' + Math.max(0, Math.round(Number(n) || 0)) + '"></span></span>';
  }

  /* Ett val med alternativen Sant och Falskt, i den ordningen, är en
     sant-fråga (grund.sant() i verktyget). Den rättas som ett val. */
  function ärSant(f) {
    const a = f && f.alternativ;
    return !!(f && f.typ === 'val' && a && a.length === 2 && a[0] === 'Sant' && a[1] === 'Falskt');
  }
  function typText(f) { return ärSant(f) ? TYPTEXT.sant : (TYPTEXT[f.typ] || ''); }

  /* Tal som i en svensk text: 1 240, med ett hårt mellanslag. */
  function tusen(n) {
    return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  function xpText(n) { return tusen(n) + ' XP'; }
  function kortÄmne(a) { return String(a || '').split(' / ')[0]; }
  function banaNamn(amne, arskurs) { return kortÄmne(amne) + ' · ' + NX.årskursText(arskurs); }
  /* Ämnets färg (2026-09-29): koden sätts som data-nl-f, och
     nextrum-uppgifter.css gör den till --nl-f ur cinemas --amne-*.
     Samma koder som prefixen i uppgiftsbanken. Ett ämne utan kod får
     ingen egen färg och står i lera, som förut. */
  const ÄMNESKOD = { 'Matematik': 'ma', 'Svenska': 'sv', 'Engelska': 'en',
    'NO / Fysik / Kemi / Biologi': 'no', 'SO / Historia / Samhällskunskap': 'so',
    'Moderna språk': 'ms', 'Programmering': 'prog',
    /* Ämnena som bara finns i NexLäx (NX.NEXLAX_AMNEN, 2026-10-06).
       Språken har moderna språkens färg och skiljs åt av sin kod. */
    'Spanska': 'ms', 'Tyska': 'ms', 'Franska': 'ms',
    'Juridik': 'ju', 'Företagsekonomi': 'fek', 'Psykologi': 'psy', 'Filosofi': 'fil' };
  function ämnesKod(a) { return ÄMNESKOD[a] || ''; }
  /* Ämnena i den ordning de står överallt i NexLäx: skolans ämnen
     först, sedan de som bara finns här. Ett okänt ämne sist. */
  function ämnesOrdning() { return NX.AMNEN.concat(NX.NEXLAX_AMNEN || []); }
  function ämnesIndex(a) {
    const i = ämnesOrdning().indexOf(a);
    return i < 0 ? 999 : i;
  }
  /* Varje område i banan har en egen färg (Leo samma kväll: "gör också
     de olika områdena olika färger"), ur samma palett som ämnena. Det
     första området har ämnets färg, och resten går runt i en ordning
     där två grannar aldrig är lika varma eller lika kalla. Ett ämne
     utanför rundan (juridiken och de andra) har sin egen färg först. */
  const OMRÅDESFÄRGER = ['ma', 'so', 'no', 'ms', 'prog', 'sv', 'en'];
  function områdesFärg(amne, i) {
    const kod = ämnesKod(amne);
    const start = OMRÅDESFÄRGER.indexOf(kod);
    if (start < 0) return i === 0 && kod ? kod : OMRÅDESFÄRGER[(i - (kod ? 1 : 0)) % OMRÅDESFÄRGER.length];
    return OMRÅDESFÄRGER[(start + i) % OMRÅDESFÄRGER.length];
  }

  /* En ikon per ämne, i ämnesrutorna och i NP-sektionen. Språken har
     sin kod i stället för en ikon: en flagga är ett land, inte ett
     språk. */
  const ÄMNESIKON = {
    'Matematik': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h6M7.5 4v6M13.5 7h6M5 15l5 5M10 15l-5 5M13.5 15.5h6M13.5 19.5h6"/></svg>',
    'Svenska': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20 11.2 6.5h1.6L19 20M7.6 14.6h8.8"/><circle cx="12" cy="3.4" r="1.6"/></svg>',
    'Engelska': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 5.5h15v10h-8l-4.5 3.8v-3.8H4.5z"/><path d="M9 9.5h6M9 12.3h4"/></svg>',
    'NO / Fysik / Kemi / Biologi': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 3.5h5M10.3 3.5v5.4L5 18.4A1.6 1.6 0 0 0 6.4 20.8h11.2A1.6 1.6 0 0 0 19 18.4l-5.3-9.5V3.5"/><path d="M7.4 14.5h9.2"/></svg>',
    'SO / Historia / Samhällskunskap': '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5S14.4 18.1 12 20.5M12 3.5C9.6 5.9 8.4 8.7 8.4 12s1.2 6.1 3.6 8.5"/></svg>',
    'Programmering': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8.5 7.5-5 4.5 5 4.5M15.5 7.5l5 4.5-5 4.5M13.5 5l-3 14"/></svg>',
    'Juridik': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M7.5 20.5h9M5 7.5h14M12 4.5l-1 3h2z"/><path d="M5 7.5 2.5 13.5a2.5 2.5 0 0 0 5 0zM19 7.5l-2.5 6a2.5 2.5 0 0 0 5 0z"/></svg>',
    'Företagsekonomi': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20.5h16M6.5 20.5v-6M11 20.5v-9M15.5 20.5v-5M20 4.5l-6 6-3-3-5 5"/><path d="M16 4.5h4v4"/></svg>',
    'Psykologi': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 20.5V17a7 7 0 1 1 9.4-6.6c0 1 1.6 2.6 1.6 3.4 0 .6-1.6.6-1.6 1.6v1.4a2 2 0 0 1-2 2H14v1.7"/><path d="M10 9.5a2.4 2.4 0 0 1 4.6.9c0 1.5-2 1.7-2 3.1"/></svg>',
    'Filosofi': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 20.5h13M7 20.5V9M12 20.5V9M17 20.5V9M4.5 9h15L12 3.5z"/></svg>'
  };
  const SPRÅKKOD = { 'Spanska': 'ES', 'Tyska': 'DE', 'Franska': 'FR' };
  function ämnesIkon(a) {
    if (SPRÅKKOD[a]) return '<span class="nl-sprakkod" aria-hidden="true">' + SPRÅKKOD[a] + '</span>';
    return ÄMNESIKON[a] || IKON.böcker;
  }

  /* Rörelse bortvald i systemet: ingen konfetti alls (CSS:en stänger
     resten av rörelsen). */
  function lugnt() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* Ljudet och vibrationen (nextrum-ljud.js). Finns inte filen, som i
     en äldre sida ur cachen, är allt tyst och inget annat ändras. */
  function känn(namn, opts) {
    if (typeof NXLjud !== 'undefined' && NXLjud && NXLjud.känn) NXLjud.känn(namn, opts);
  }

  /* ============================================================
     DATAN
     ============================================================ */
  let katalogLöfte = null;
  const saknas = e => !!e && (e.code === '42703' || e.code === 'PGRST202' || e.code === '42883'
    || /does not exist|Could not find/i.test(e.message || ''));

  /* Alla aktiva nivåer, en gång per sidladdning. Katalogen är liten
     (några hundra rader i ett helt skolsystem) och läses av alla
     inloggade, och med den i minnet byter vägen ämne utan att vänta på
     nätet. Utan Fas 23.2 i databasen finns inte sort och lastext: då är
     alla nivåer vanliga, som i Fas 23.1. Svarar null om tabellen inte
     finns alls: då står uppgifterna kvar, utan vägen. Sida för sida
     (NXStudie.hämtaAlla, 2026-09-29): några hundra i dag, men tolv
     årskurser gånger alla ämnen når tusen, och svaret säger inte att
     resten saknas. */
  function laddaKatalog(supa) {
    if (!katalogLöfte) {
      const bas = 'id, nyckel, amne, arskurs, omrade, titel, beskrivning, ordning, antal_fragor, aktiv';
      const hämta = kol => NXStudie.hämtaAlla(supa, 'nivaer', kol,
        q => q.order('amne').order('arskurs').order('ordning'));
      /* spar kom 2026-10-06 (nexlax_uppdrag_och_np). Utan den står allt
         på vägen, som förut, och NP-sektionen syns inte. */
      katalogLöfte = hämta(bas + ', sort, lastext, spar').then(async svar => {
        if (svar.error && saknas(svar.error)) svar = await hämta(bas + ', sort, lastext');
        if (svar.error && saknas(svar.error)) {
          svar = await hämta(bas);
          if (svar.data) svar.data.forEach(n => { n.sort = 'vanlig'; n.lastext = null; });
        }
        if (svar.error) { katalogLöfte = null; console.warn('Nivåerna gick inte att läsa', svar.error); return null; }
        return (svar.data || []).map(n => { n.sort = n.sort || 'vanlig'; n.spar = n.spar || 'vag'; return n; });
      });
    }
    return katalogLöfte;
  }

  /* Alla försök, äldst först. Här stod .limit(2000), men PostgREST
     lämnar ut högst tusen rader per svar, så vid tusen försök hade de
     NYASTE fallit bort, och stjärnorna, XP:n och serien räknats på en
     gammal elev (NXStudie.hämtaAlla, 2026-09-29). */
  function laddaFörsök(supa, elevId) {
    return NXStudie.hämtaAlla(supa, 'niva_forsok',
      'id, niva_id, student_id, startad_at, klar_at, antal, ratt_direkt, stjarnor, godkand',
      q => q.eq('student_id', elevId).order('startad_at', { ascending: true }))
      .then(({ data, error }) => {
        if (error) { console.warn('Försöken gick inte att läsa', error); return null; }
        return data || [];
      });
  }

  /* De påbörjade försöken från det senaste dygnet, med hur många frågor
     som redan är rätt besvarade: "3 av 8 klara" på vägen. Samma försök
     som niva_starta() fortsätter i (det senaste per nivå). */
  async function laddaPågående(supa, elevId) {
    const sedan = new Date(Date.now() - 86400000).toISOString();
    const { data, error } = await supa.from('niva_forsok')
      .select('id, niva_id, fragor, startad_at')
      .eq('student_id', elevId).is('klar_at', null).gt('startad_at', sedan)
      .order('startad_at', { ascending: false }).limit(30);
    if (error || !data || !data.length) return {};
    const svar = await supa.from('niva_svar').select('forsok_id, fraga_id')
      .in('forsok_id', data.map(f => f.id)).eq('ratt', true);
    const rätt = {};
    (svar.data || []).forEach(s => { (rätt[s.forsok_id] = rätt[s.forsok_id] || new Set()).add(s.fraga_id); });
    const ut = {};
    data.forEach(f => {
      if (ut[f.niva_id]) return;
      ut[f.niva_id] = { forsok: f.id, startad_at: f.startad_at, totalt: (f.fragor || []).length,
                        klara: rätt[f.id] ? rätt[f.id].size : 0 };
    });
    return ut;
  }

  /* XP, serien och dagarna, räknade i databasen. null när funktionen
     inte finns än (Fas 23.2 är inte körd): då visas vägen utan XP. */
  function laddaLäge(supa, elevId) {
    return supa.rpc('nexlax_lage', { p_elev: elevId }).then(({ data, error }) => {
      if (error) { if (!saknas(error)) console.warn('NexLäx-läget gick inte att läsa', error); return null; }
      return data || null;
    });
  }

  function efterId(rader) {
    const m = {};
    (rader || []).forEach(r => { m[r.id] = r; });
    return m;
  }

  /* Varje nivå eleven rört: bästa stjärnorna, om den klarats, det
     första klara försöket (det är det som räknas som rättningen: då
     hade eleven inte sett svaren), det senaste klara och ett påbörjat
     försök från det senaste dygnet, som spelaren fortsätter i. */
  function perNivå(forsok) {
    const m = {};
    const dygn = Date.now() - 86400000;
    (forsok || []).forEach(f => {
      const x = m[f.niva_id] || (m[f.niva_id] = { klar: false, stjarnor: 0, klaraFörsök: 0, första: null, senast: null, pågår: null });
      if (f.klar_at) {
        x.klaraFörsök++;
        if (!x.första) x.första = f;
        x.senast = f;
        if (f.godkand) x.klar = true;
        x.stjarnor = Math.max(x.stjarnor, Number(f.stjarnor) || 0);
      } else if (Date.parse(f.startad_at) > dygn) {
        x.pågår = f;
      }
    });
    return m;
  }

  /* Vilka ämnen och årskurser som har en bana. */
  function banor(katalog) {
    const ämnen = {};
    (katalog || []).forEach(n => {
      if (!n.aktiv) return;
      (ämnen[n.amne] = ämnen[n.amne] || new Set()).add(n.arskurs);
    });
    const ordning = NX.ARSKURSER.map(a => a.kod);
    const ut = {};
    Object.keys(ämnen).forEach(a => {
      ut[a] = Array.from(ämnen[a]).sort((x, y) => ordning.indexOf(x) - ordning.indexOf(y));
    });
    return ut;
  }
  function ämnenIOrdning(finns) {
    return Object.keys(finns).sort((a, b) => (ämnesIndex(a) - ämnesIndex(b)) || a.localeCompare(b));
  }

  /* Den årskurs banan öppnar i: elevens egen om den har en bana,
     annars den närmaste under (det man redan borde kunna), annars den
     första som finns. */
  function förvaldÅrskurs(årskurser, elevensKod) {
    if (!årskurser || !årskurser.length) return '';
    if (elevensKod && årskurser.includes(elevensKod)) return elevensKod;
    const ordning = NX.ARSKURSER.map(a => a.kod);
    const min = ordning.indexOf(elevensKod);
    if (min >= 0) {
      const under = årskurser.filter(k => ordning.indexOf(k) < min);
      if (under.length) return under[under.length - 1];
    }
    return årskurser[0];
  }

  /* spar: 'vag' för vägen, 'np' för NP-sektionen, utelämnat för hela
     banan. En nivå utan spar (barnets katalog före 2026-10-06) står på
     vägen. */
  function ärNp(n) { return !!n && n.spar === 'np'; }
  function banansSteg(katalog, amne, arskurs, spar) {
    return (katalog || []).filter(n => n.aktiv && n.amne === amne && n.arskurs === arskurs
        && (!spar || (spar === 'np') === ärNp(n)))
      .sort((a, b) => a.ordning - b.ordning);
  }
  function harNp(katalog, amne, arskurs) {
    return (katalog || []).some(n => n.aktiv && ärNp(n) && n.amne === amne && n.arskurs === arskurs);
  }

  /* Hur många frågor en nivå har, och ungefär hur lång tid den tar. Ett
     Mästarprov har inga egna frågor: det drar högst tio ur områdets
     nivåer utan lästext. En repetition drar högst åtta. */
  function antalFrågor(n, katalog) {
    if (n.sort === 'mastare') {
      const i = banansSteg(katalog, n.amne, n.arskurs)
        .filter(m => m.sort === 'vanlig' && m.omrade === n.omrade && !m.lastext)
        .reduce((s, m) => s + (Number(m.antal_fragor) || 0), 0);
      return Math.min(MÄSTARPROV_MAX, i);
    }
    if (n.sort === 'repetition') return REPETITION_MAX;
    return Number(n.antal_fragor) || 0;
  }
  function minuter(n, katalog) {
    const frågor = antalFrågor(n, katalog);
    const läsa = n.lastext ? Math.max(1, Math.round(n.lastext.length / 900)) : 0;
    return Math.max(2, Math.round(frågor * 0.5) + läsa);
  }
  function omfattning(n, katalog) {
    const f = antalFrågor(n, katalog);
    if (!f) return '';
    return (n.sort === 'repetition' ? 'upp till ' : '') + f + (f === 1 ? ' uppgift' : ' uppgifter')
      + ' · ca ' + minuter(n, katalog) + ' min';
  }

  /* ============================================================
     VÄGEN
     Banan som områden och steg, i ordning, med läget för varje.

     o: { katalog, amne, arskurs, forsok, uppgifter, pågående, läge }
       pågående: { niva_id: { klara, totalt } } ur laddaPågående
       läge:     nexlax_lage() eller null
     ============================================================ */
  function vägen(o) {
    const alla = banansSteg(o.katalog, o.amne, o.arskurs, 'vag');
    const gjort = perNivå(o.forsok);
    const givna = {};
    (o.uppgifter || []).forEach(h => { if (h.niva_id && h.status !== 'klar') givna[h.niva_id] = h; });
    const xpPer = (o.läge && o.läge.nivaer) || {};

    const nod = n => {
      const l = gjort[n.id] || {};
      const p = o.pågående && o.pågående[n.id];
      return {
        niva: n, sort: n.sort || 'vanlig', klar: !!l.klar, stjarnor: l.stjarnor || 0,
        pågår: !!(l.pågår || p), framsteg: p || null, första: l.första || null, senast: l.senast || null,
        försök: l.klaraFörsök || 0, given: givna[n.id] || null, öppen: false, aktuell: false,
        xp: xpPer[n.id] ? Number(xpPer[n.id].xp) || 0 : null
      };
    };

    const områden = [];
    let repetition = null;
    alla.forEach(n => {
      if (n.sort === 'repetition') { repetition = nod(n); return; }
      let a = områden[områden.length - 1];
      if (!a || a.namn !== n.omrade) {
        a = { namn: n.omrade, nivåer: [], mästare: null };
        områden.push(a);
      }
      const x = nod(n);
      if (x.sort === 'mastare') a.mästare = x; else a.nivåer.push(x);
    });

    /* Allt är öppet (Leo 2026-10-06: "hela nexläx ska också vara upplåst
       så att man kan jobba med vad man vill och behöver"). Vägen har
       kvar sin ordning och sitt aktuella steg, som ett förslag. */
    områden.forEach(a => a.nivåer.forEach(x => { x.öppen = true; }));
    områden.forEach(a => {
      a.klara = a.nivåer.filter(x => x.klar).length;
      a.klart = a.nivåer.length > 0 && a.klara === a.nivåer.length;
      const m = a.mästare;
      if (m) m.öppen = true;
      a.bemästrat = !!(m && m.klar && m.stjarnor >= BEMÄSTRAD);
    });

    /* Det aktuella steget: den första öppna vanliga nivån som inte är
       klarad, annars det första öppna Mästarprovet. */
    let aktuell = null;
    områden.forEach(a => a.nivåer.forEach(x => { if (!aktuell && x.öppen && !x.klar) aktuell = x; }));
    if (!aktuell) områden.forEach(a => { const m = a.mästare; if (!aktuell && m && m.öppen && !m.klar) aktuell = m; });
    if (aktuell) aktuell.aktuell = true;

    /* Nästa område är det som kommer direkt efter det aktuella. Ett
       område längre fram kan redan vara öppet, för att studiehjälparen
       gett en nivå där; det gör inte området efter det till nästa. */
    const iAkt = aktuell ? områden.findIndex(a => a.nivåer.includes(aktuell) || a.mästare === aktuell) : -1;
    områden.forEach((a, i) => {
      if (a.klart) a.läge = 'klart';
      else if (i === iAkt || a.nivåer.some(x => x.klar || x.pågår)) a.läge = 'aktuellt';
      else if (a.nivåer.some(x => x.öppen)) a.läge = 'oppet';
      else if (i === iAkt + 1) a.läge = 'nasta';
      else a.läge = 'last';
    });

    /* Banans procent räknar de vanliga nivåerna, som området och
       XP:n gör: ett område är klart när dess nivåer är det, och
       Mästarprovet är kronan ovanpå. Räknades provet med stod ett
       område som Klart 3/4 och banan nådde aldrig 100 utan det. */
    const steg = [];
    områden.forEach(a => { a.nivåer.forEach(x => steg.push(x)); if (a.mästare) steg.push(a.mästare); });
    const vanliga = steg.filter(x => x.sort === 'vanlig');
    const klara = vanliga.filter(x => x.klar).length;
    return {
      amne: o.amne, arskurs: o.arskurs, områden, repetition, steg, aktuell,
      klara, totalt: vanliga.length,
      procent: vanliga.length ? Math.round(klara / vanliga.length * 100) : 0,
      helaKlar: vanliga.length > 0 && klara === vanliga.length,
      bemästrade: områden.filter(a => a.bemästrat).length
    };
  }

  /* Vad eleven ska göra nu. I ordning: ett påbörjat försök (i vilken
     bana som helst), det aktuella steget i banan, ett Mästarprov som
     inte är klarat, repetitionen när det finns missade frågor. */
  function påbörjatSteg(o) {
    const n = efterId(o.katalog);
    const påbörjade = Object.keys(o.pågående || {})
      .map(id => ({ id, p: o.pågående[id], niva: n[id] }))
      .filter(x => x.niva && x.niva.aktiv && x.p.klara < x.p.totalt)
      .sort((a, b) => String(b.p.startad_at).localeCompare(String(a.p.startad_at)));
    if (!påbörjade.length) return null;
    const x = påbörjade[0];
    return { sort: 'fortsatt', niva: x.niva, framsteg: x.p, rubrik: 'Fortsätt där du slutade', knapp: 'Fortsätt' };
  }

  function nästaSteg(o, väg) {
    const p = påbörjatSteg(o);
    if (p) return p;
    if (väg && väg.aktuell) {
      const a = väg.aktuell;
      const ingetGjort = !(o.forsok || []).some(f => f.klar_at);
      return {
        sort: a.sort === 'mastare' ? 'mastare' : 'nasta', niva: a.niva,
        rubrik: ingetGjort ? 'Börja din väg' : a.sort === 'mastare' ? 'Dags för Mästarprovet' : 'Nästa steg',
        knapp: a.sort === 'mastare' ? 'Gör provet' : ingetGjort ? 'Börja' : 'Starta'
      };
    }
    if (väg && väg.repetition && antalMissade(o.läge, väg.amne, väg.arskurs) > 0) {
      return { sort: 'repetition', niva: väg.repetition.niva, rubrik: 'Repetera det du missat', knapp: 'Repetera' };
    }
    return null;
  }

  /* ============================================================
     NP-SPÅRET (2026-10-06)
     Banans områden inför nationella provet, med samma noder som
     vägen. Allt är öppet, också Mästarprovet: inför ett prov väljer
     man det man behöver, inte nästa i ordningen.
     ============================================================ */
  function npSpår(o) {
    const alla = banansSteg(o.katalog, o.amne, o.arskurs, 'np');
    if (!alla.length) return null;
    const gjort = perNivå(o.forsok);
    const givna = {};
    (o.uppgifter || []).forEach(h => { if (h.niva_id && h.status !== 'klar') givna[h.niva_id] = h; });
    const xpPer = (o.läge && o.läge.nivaer) || {};
    const nod = n => {
      const l = gjort[n.id] || {};
      const p = o.pågående && o.pågående[n.id];
      return {
        niva: n, sort: n.sort || 'vanlig', klar: !!l.klar, stjarnor: l.stjarnor || 0,
        pågår: !!(l.pågår || p), framsteg: p || null, första: l.första || null, senast: l.senast || null,
        försök: l.klaraFörsök || 0, given: givna[n.id] || null, öppen: true, aktuell: false,
        xp: xpPer[n.id] ? Number(xpPer[n.id].xp) || 0 : null
      };
    };
    const områden = [];
    alla.forEach(n => {
      let a = områden[områden.length - 1];
      if (!a || a.namn !== n.omrade) { a = { namn: n.omrade, nivåer: [], mästare: null }; områden.push(a); }
      const x = nod(n);
      if (x.sort === 'mastare') a.mästare = x; else a.nivåer.push(x);
    });
    områden.forEach(a => {
      a.klara = a.nivåer.filter(x => x.klar).length;
      a.klart = a.nivåer.length > 0 && a.klara === a.nivåer.length;
      if (a.mästare) a.mästare.öppen = true;
      a.bemästrat = !!(a.mästare && a.mästare.klar && a.mästare.stjarnor >= BEMÄSTRAD);
    });
    const vanliga = [];
    områden.forEach(a => a.nivåer.forEach(x => vanliga.push(x)));
    const klara = vanliga.filter(x => x.klar).length;
    /* Det man borde göra härnäst: något påbörjat, annars den första
       nivån som inte är klar, annars ett öppet prov. */
    const nästa = vanliga.find(x => x.pågår && !x.klar) || vanliga.find(x => !x.klar)
      || områden.map(a => a.mästare).find(m => m && m.öppen && !m.klar) || null;
    if (nästa) nästa.aktuell = true;
    const steg = [];
    områden.forEach(a => { a.nivåer.forEach(x => steg.push(x)); if (a.mästare) steg.push(a.mästare); });
    return {
      amne: o.amne, arskurs: o.arskurs, områden, steg, klara, totalt: vanliga.length, nästa, aktuell: nästa,
      procent: vanliga.length ? Math.round(klara / vanliga.length * 100) : 0,
      helaKlar: vanliga.length > 0 && klara === vanliga.length
    };
  }

  function antalMissade(läge, amne, arskurs) {
    const r = ((läge && läge.missade) || []).find(x => x.amne === amne && x.arskurs === arskurs);
    return r ? Number(r.antal) || 0 : 0;
  }

  /* ============================================================
     MÄRKENA
     ============================================================ */
  function underlag(o) {
    const nivå = efterId(o.katalog);
    const gjort = perNivå(o.forsok);
    const d = { klaradeNivåer: 0, stjärnor: 0, treStjärnor: 0, helaOmråden: 0, bemästrade: 0, helaBanor: 0,
                förbättringar: 0, iTid: 0, ämnen: 0, xp: null, bästaSerie: null };
    const ämnen = new Set();
    Object.keys(gjort).forEach(id => {
      const l = gjort[id];
      const n = nivå[id];
      d.stjärnor += l.stjarnor;
      if (l.stjarnor === 3) d.treStjärnor++;
      if (l.klar) { d.klaradeNivåer++; if (n) ämnen.add(n.amne); }
      if (n && n.sort === 'mastare' && l.klar && l.stjarnor >= BEMÄSTRAD) d.bemästrade++;
    });
    d.ämnen = ämnen.size;
    /* Utan ett enda Mästarprov i katalogen (före Fas 23.2:s bank) finns
       inget att bemästra, och märkena för det ska inte stå som ouppnådda. */
    if (!(o.katalog || []).some(n => n.sort === 'mastare')) d.bemästrade = null;

    /* Bättre andra gången: ett klart försök med fler stjärnor än ett
       tidigare klart försök på samma nivå. */
    const bästHittills = {};
    const bättre = new Set();
    (o.forsok || []).filter(f => f.klar_at).sort((a, b) => Date.parse(a.klar_at) - Date.parse(b.klar_at)).forEach(f => {
      const s = Number(f.stjarnor) || 0;
      if (f.niva_id in bästHittills && s > bästHittills[f.niva_id]) bättre.add(f.niva_id);
      bästHittills[f.niva_id] = Math.max(bästHittills[f.niva_id] || 0, s);
    });
    d.förbättringar = bättre.size;

    const grupper = {}, banGrupper = {};
    (o.katalog || []).filter(n => n.aktiv && n.sort === 'vanlig').forEach(n => {
      const a = n.amne + '|' + n.arskurs + '|' + n.omrade, b = n.amne + '|' + n.arskurs;
      (grupper[a] = grupper[a] || []).push(n.id);
      /* En hel bana är vägen, som banans procent: NP-sektionen står
         bredvid. */
      if (!ärNp(n)) (banGrupper[b] = banGrupper[b] || []).push(n.id);
    });
    const allaKlara = ids => ids.every(id => gjort[id] && gjort[id].klar);
    d.helaOmråden = Object.values(grupper).filter(allaKlara).length;
    d.helaBanor = Object.values(banGrupper).filter(allaKlara).length;

    d.iTid = (o.uppgifter || []).filter(h => h.status === 'klar' && h.due_date && h.completed_at
      && NX.isoFor(new Date(h.completed_at)) <= h.due_date).length;

    if (o.läge) {
      d.xp = Number(o.läge.xp) || 0;
      d.bästaSerie = Number(o.läge.serie && o.läge.serie.basta) || 0;
    }
    /* Uppdragen (2026-10-06): räknade i databasen. Utan dem (en databas
       före nexlax_uppdrag_och_np) syns inte deras märken alls. */
    const u = o.läge && o.läge.uppdrag;
    d.uppdrag = u ? Number(u.totalt) || 0 : null;
    d.kistor = u ? Number(u.hela_dagar) || 0 : null;
    d.veckor = u ? Number(u.veckor) || 0 : null;
    d.månader = u ? Number(u.manader) || 0 : null;
    return d;
  }

  /* Märken som bygger på XP eller serien visas bara när databasen
     räknat dem (mät svarar null annars): ett märke som ser ouppnått ut
     för att funktionen inte är körd än är fel, inte ett läge. */
  const MÄRKEN = [
    { id: 'forsta', namn: 'Första nivån', text: 'Klara en nivå.', ikon: 'flagga', mål: 1, mät: d => d.klaradeNivåer },
    { id: 'xp-100', namn: '100 XP', text: 'Samla 100 XP.', ikon: 'blixt', mål: 100, mät: d => d.xp },
    { id: 'uppdrag-1', namn: 'Första uppdraget', text: 'Klara ett av dagens uppdrag.', ikon: 'medalj', mål: 1, mät: d => d.uppdrag },
    { id: 'serie-3', namn: 'Tre dagar i rad', text: 'Gör något i NexLäx tre dagar i rad.', ikon: 'låga', mål: 3, mät: d => d.bästaSerie },
    { id: 'allt-ratt', namn: 'Allt rätt direkt', text: 'Klara en nivå utan ett enda fel.', ikon: 'bock', mål: 1, mät: d => d.treStjärnor },
    { id: 'kista-1', namn: 'Dagens kista', text: 'Klara alla tre uppdragen samma dag.', ikon: 'kista', mål: 1, mät: d => d.kistor },
    { id: 'battre', namn: 'Bättre andra gången', text: 'Gör om en nivå och få fler stjärnor.', ikon: 'uppåt', mål: 1, mät: d => d.förbättringar },
    { id: 'omrade', namn: 'Ett helt område', text: 'Klara alla nivåer i ett område.', ikon: 'flagga', mål: 1, mät: d => d.helaOmråden },
    { id: 'serie-7', namn: 'En vecka i rad', text: 'Gör något i NexLäx sju dagar i rad.', ikon: 'låga', mål: 7, mät: d => d.bästaSerie },
    { id: 'i-tid', namn: 'I tid', text: 'Gör fem uppgifter från studiehjälparen i tid.', ikon: 'klocka', mål: 5, mät: d => d.iTid },
    { id: 'vecka-1', namn: 'Veckans uppdrag', text: 'Klara veckans uppdrag.', ikon: 'kalender', mål: 1, mät: d => d.veckor },
    { id: 'mastare', namn: 'Mästare', text: 'Bemästra ett område i Mästarprovet.', ikon: 'krona', mål: 1, mät: d => d.bemästrade },
    { id: 'xp-500', namn: '500 XP', text: 'Samla 500 XP.', ikon: 'blixt', mål: 500, mät: d => d.xp },
    { id: 'tva-amnen', namn: 'Två ämnen', text: 'Klara nivåer i två olika ämnen.', ikon: 'böcker', mål: 2, mät: d => d.ämnen },
    { id: 'allt-ratt-5', namn: 'Fem felfria', text: 'Klara fem nivåer utan ett enda fel.', ikon: 'bock', mål: 5, mät: d => d.treStjärnor },
    { id: 'uppdrag-25', namn: '25 uppdrag', text: 'Klara 25 uppdrag.', ikon: 'medalj', mål: 25, mät: d => d.uppdrag },
    { id: 'xp-1000', namn: '1 000 XP', text: 'Samla 1 000 XP.', ikon: 'blixt', mål: 1000, mät: d => d.xp },
    { id: 'kista-7', namn: 'Sju kistor', text: 'Öppna dagens kista sju gånger.', ikon: 'kista', mål: 7, mät: d => d.kistor },
    { id: 'serie-30', namn: 'En månad i rad', text: 'Gör något i NexLäx trettio dagar i rad.', ikon: 'låga', mål: 30, mät: d => d.bästaSerie },
    { id: 'manad-1', namn: 'Månadens utmaning', text: 'Klara månadens utmaning.', ikon: 'pokal', mål: 1, mät: d => d.månader },
    { id: 'bana', namn: 'En hel bana', text: 'Klara alla nivåer i en bana.', ikon: 'pokal', mål: 1, mät: d => d.helaBanor },
    { id: 'mastare-3', namn: 'Trefaldig mästare', text: 'Bemästra tre områden.', ikon: 'krona', mål: 3, mät: d => d.bemästrade },
    { id: 'uppdrag-100', namn: '100 uppdrag', text: 'Klara 100 uppdrag.', ikon: 'medalj', mål: 100, mät: d => d.uppdrag }
  ];

  /* ============================================================
     RANGEN (2026-10-06)
     Ett namn på hur långt eleven kommit, ur XP:n. Räknas här, som
     märkena, och ger och tar ingenting: XP:n är det som räknas, och den
     minskar aldrig, så rangen gör det inte heller.
     ============================================================ */
  const RANGER = [
    { xp: 0, namn: 'Nybörjare' }, { xp: 150, namn: 'Upptäckare' }, { xp: 400, namn: 'Utforskare' },
    { xp: 800, namn: 'Tänkare' }, { xp: 1500, namn: 'Kunskapsjägare' }, { xp: 2500, namn: 'Problemlösare' },
    { xp: 4000, namn: 'Expert' }, { xp: 6000, namn: 'Virtuos' }, { xp: 9000, namn: 'Stormästare' },
    { xp: 13000, namn: 'Legend' }
  ];
  function rang(xp) {
    const v = Math.max(0, Number(xp) || 0);
    let i = 0;
    while (i + 1 < RANGER.length && v >= RANGER[i + 1].xp) i++;
    const nästa = RANGER[i + 1] || null;
    return {
      nr: i + 1, av: RANGER.length, namn: RANGER[i].namn, från: RANGER[i].xp,
      nästa: nästa ? nästa.namn : null, till: nästa ? nästa.xp : null, kvar: nästa ? nästa.xp - v : 0,
      andel: nästa ? (v - RANGER[i].xp) / (nästa.xp - RANGER[i].xp) : 1
    };
  }

  function märken(d) {
    return MÄRKEN.map(m => {
      const v = m.mät(d);
      const har = v == null ? null : Math.min(m.mål, v || 0);
      return { id: m.id, namn: m.namn, text: m.text, ikon: m.ikon, mål: m.mål, har, klart: har != null && har >= m.mål };
    }).filter(m => m.har != null);
  }

  function stjärnRad(antal, max, klass) {
    let ut = '<span class="upg-stj' + (klass ? ' ' + klass : '') + '" role="img" aria-label="'
      + antal + ' av ' + (max || 3) + ' stjärnor">';
    for (let i = 1; i <= (max || 3); i++) ut += '<i class="' + (i <= antal ? 'tand' : '') + '">' + IKON.stjärna + '</i>';
    return ut + '</span>';
  }

  function märkesHtml(m, opts) {
    const o = opts || {};
    return '<div class="upg-marke' + (m.klart ? ' klart' : '') + (o.nytt ? ' nytt' : '') + '">'
      + '<span class="upg-marke-ikon">' + IKON[m.ikon] + '</span>'
      + '<b>' + esc(m.namn) + '</b>'
      + '<span class="upg-marke-text">' + esc(m.klart ? m.text.replace(/\.$/, '') + ' ✓' : m.text) + '</span>'
      + (!m.klart && m.mål > 1
          ? '<span class="upg-marke-mat" aria-label="' + tusen(m.har) + ' av ' + tusen(m.mål) + '"><i style="width:'
            + Math.round(m.har / m.mål * 100) + '%"></i></span><span class="upg-marke-tal">' + tusen(m.har) + ' / ' + tusen(m.mål) + '</span>'
          : '')
      + '</div>';
  }

  /* ============================================================
     SERIEN
     ============================================================ */
  function serieText(s) {
    if (!s) return '';
    if (s.idag) return 'Dagens mål är klart. Kom tillbaka i morgon så blir det ' + (s.nu + 1) + ' dagar.';
    if (s.nu) return 'Gör klart en nivå i dag så blir det ' + (s.nu + 1) + ' dagar i rad.';
    return s.basta ? 'Gör klart en nivå i dag så börjar en ny serie. Ditt rekord är ' + s.basta + (s.basta === 1 ? ' dag.' : ' dagar.')
      : 'Gör klart en nivå i dag så börjar din serie.';
  }
  function dagarText(n) { return n === 1 ? 'dag i rad' : 'dagar i rad'; }

  /* ============================================================
     HEMMET: DIN VÄG
     o: { host, katalog, forsok, uppgifter, pågående, läge, amne,
          arskurs, elevKod, elevNamn, öppen, hjälpare: { namn },
          rapporter, progress, nyss: { klar, oppen } }
     ============================================================ */
  const XLED = [0, 1, 2, 1, 0, -1, -2, -1];

  function ritaVäg(o) {
    const host = o.host;
    if (!host) return null;
    const finns = banor(o.katalog);
    const ämnen = ämnenIOrdning(finns);
    /* Ämnet och årskursen. En vald årskurs där ämnet saknas byter ämne,
       inte årskurs: den som trycker på Gy 2 vill se gymnasiet, och får
       det första ämnet som har en bana där. */
    let amne = finns[o.amne] ? o.amne : '';
    let arskurs = o.arskurs || '';
    if (arskurs && !(amne && finns[amne].includes(arskurs))) {
      const annat = ämnen.find(a => finns[a].includes(arskurs));
      if (annat) amne = annat; else arskurs = '';
    }
    if (!amne) amne = ämnen[0] || '';
    const årskurser = finns[amne] || [];
    if (!årskurser.includes(arskurs)) arskurs = förvaldÅrskurs(årskurser, o.elevKod);
    const bana = Object.assign({}, o, { amne, arskurs });
    const väg = amne ? vägen(bana) : null;
    const np = amne ? npSpår(bana) : null;
    /* En bana med bara NP-nivåer har ingen väg: där är sektionen allt. */
    const baraNp = !!np && !(väg && väg.totalt);
    const spar = np && (o.spar === 'np' || baraNp) ? 'np' : 'vag';
    const nästa = spar === 'np' ? npNästa(o, np) : nästaSteg(o, väg);

    host.innerHTML = toppHtml(o, väg, nästa, spar === 'np' ? np : null)
      + uppdragHtml(o.läge)
      + rekHtml(o)
      + passHtml(o, väg)
      + (ämnen.length ? väljareHtml(o, finns, ämnen, amne, arskurs) : '')
      + (np && !baraNp ? spårHtml(spar, np) : '')
      + (spar === 'np' ? npHtml(o, np) : väg ? vägHtml(o, väg) + repetitionHtml(o, väg) : tommaVägen(o))
      + inställningarHtml();

    host.dataset.amne = amne;
    host.dataset.arskurs = arskurs;
    host.dataset.spar = spar;
    host.dataset.nlF = ämnesKod(amne);
    return { väg, np, nästa, amne, arskurs, spar };
  }

  function tommaVägen(o) {
    return '<div class="nl-grupp"><h3>Din väg</h3></div>'
      + '<div class="vy-kort"><div class="vy-kort-kropp">'
      + NXStudie.tomt(o.katalog ? 'Inga nivåer än' : 'Vägen gick inte att hämta',
          o.katalog ? 'Banorna fylls på med nivåer i fler ämnen och årskurser.' : 'Ladda om sidan om en stund. Det din studiehjälpare gett står ovanför.')
      + '</div></div>';
  }

  /* Toppen: serien, XP, rangen, banan och det primära steget. En mörk
     yta i Nextrums bark, som resten av sajtens mörka partier: det är
     här spelet börjar. I NP-sektionen visar den sektionens procent och
     nästa nivå där. */
  function toppHtml(o, väg, nästa, np) {
    const l = o.läge;
    const s = l && l.serie;
    const r = l ? rang(l.xp) : null;
    const stat = l
      ? '<div class="nl-stat" role="list">'
        + '<span class="nl-stat-pill nl-serie' + (s && s.idag ? ' tand' : '') + '" role="listitem" aria-label="'
          + esc((s ? s.nu : 0) + ' ' + dagarText(s ? s.nu : 0)) + '">'
          + IKON.låga + '<b>' + (s ? s.nu : 0) + '</b><span>' + (s && s.nu === 1 ? 'dag' : 'dagar') + '</span></span>'
        + '<span class="nl-stat-pill nl-xp" role="listitem" aria-label="' + esc(xpText(l.xp)) + '">'
          + IKON.blixt + '<b>' + tusen(l.xp) + '</b><span>XP</span></span>'
        + '<span class="nl-stat-pill nl-rang" role="listitem" aria-label="' + esc('Rank ' + r.nr + ' av ' + r.av + ': ' + r.namn) + '">'
          + IKON.medalj + '<b>' + esc(r.namn) + '</b></span>'
        + '</div>'
      : '';

    const sektion = np || väg;
    const bana = sektion
      ? '<div class="nl-bana">'
        + '<div class="nl-bana-rad"><b>' + esc(banaNamn(sektion.amne, sektion.arskurs)) + (np ? '<em class="nl-bana-np">Inför NP</em>' : '') + '</b>'
        + '<strong>' + sektion.procent + '<i>%</i></strong></div>'
        + '<span class="nl-mat" role="progressbar" aria-label="' + (np ? 'Hur långt du kommit inför provet' : 'Hur långt du kommit i banan')
          + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + sektion.procent + '"><i style="width:' + sektion.procent + '%"></i></span>'
        + '<span class="nl-bana-not">' + sektion.klara + ' av ' + sektion.totalt + (np ? ' nivåer inför provet klara' : ' nivåer klara')
          + (sektion.områden.length ? ' · ' + sektion.områden.filter(a => a.klart).length + ' av ' + sektion.områden.length + ' områden' : '') + '</span>'
        + '</div>'
      : '';

    let cta = '';
    if (nästa) {
      const n = nästa.niva;
      const p = nästa.framsteg;
      cta = '<div class="nl-cta">'
        + '<span class="nl-cta-et">' + esc(nästa.rubrik) + '</span>'
        + '<b class="nl-cta-titel">' + esc(stegTitel(n)) + '</b>'
        + '<span class="nl-cta-fakta">' + esc([n.sort === 'repetition' ? banaNamn(n.amne, n.arskurs) : ärNp(n) ? npNamn(n.omrade) : n.omrade,
            p ? p.klara + ' av ' + p.totalt + ' klara' : omfattning(n, o.katalog)].filter(Boolean).join(' · ')) + '</span>'
        + (p ? prickar(p.klara, p.totalt, 'nl-cta-prickar') : '')
        + '<button type="button" class="nl-cta-knapp" data-nl-starta="' + esc(n.id) + '">'
          + IKON.spela + '<span>' + esc(nästa.knapp) + '</span></button>'
        + '</div>';
    } else if (np && np.totalt && np.klara === np.totalt) {
      cta = '<div class="nl-cta nl-cta-klar">'
        + '<span class="nl-cta-et">Inför provet</span>'
        + '<b class="nl-cta-titel">Allt inför provet i ' + esc(banaNamn(np.amne, np.arskurs)) + ' är klarat</b>'
        + '<span class="nl-cta-fakta">Gör om en nivå för fler stjärnor, eller öva på riktiga gamla prov hos provgruppen.</span>'
        + '</div>';
    } else if (!np && väg && väg.helaKlar) {
      cta = '<div class="nl-cta nl-cta-klar">'
        + '<span class="nl-cta-et">Banan är klar</span>'
        + '<b class="nl-cta-titel">Allt i ' + esc(banaNamn(väg.amne, väg.arskurs)) + ' är klarat</b>'
        + '<span class="nl-cta-fakta">Gör om en nivå för fler stjärnor, eller välj ett annat ämne nedanför.</span>'
        + '</div>';
    }

    const idag = l && Number(l.xp_idag) ? '<b class="nl-mal-xp">+' + esc(xpText(l.xp_idag)) + ' i dag.</b> ' : '';
    const mål = s ? '<p class="nl-mal' + (s.idag ? ' klart' : '') + '"><span class="nl-mal-ikon">'
      + (s.idag ? IKON.bock : IKON.låga) + '</span><span>' + idag + esc(serieText(s)) + '</span></p>' : '';

    return '<div class="nl-topp">' + stat + bana + cta + mål + '</div>';
  }

  /* Nästa steg i NP-sektionen: något påbörjat, annars sektionens nästa. */
  function npNästa(o, np) {
    const p = påbörjatSteg(o);
    if (p) return p;
    const x = np && np.nästa;
    if (!x) return null;
    return { sort: 'np', niva: x.niva, rubrik: x.sort === 'mastare' ? 'Provträning, blandat' : 'Träna inför provet',
             knapp: x.pågår ? 'Fortsätt' : x.klar ? 'Gör om' : 'Starta' };
  }

  /* ============================================================
     DAGENS UPPDRAG (2026-10-06)
     Tre om dagen, ett i veckan och månadens utmaning, ur
     nexlax_lage().uppdrag. Räknade i databasen: här ritas de bara.
     Ingen text säger att något går förlorat, för det gör det inte.
     ============================================================ */
  const UPPDRAGSIKON = { xp: 'blixt', nivaer: 'flagga', direkt: 'bock', rad: 'låga', tre: 'stjärna', amnen: 'böcker' };
  function uppdragsIkon(u) {
    const typ = u.grupp === 'kunna' ? String(u.id || '').split('-')[0] : u.grupp;
    return IKON[UPPDRAGSIKON[typ]] || IKON.medalj;
  }
  function månadsNamn(manad) {
    const m = Number(String(manad || '').slice(5, 7));
    return m >= 1 && m <= 12 ? NX.MANADER[m - 1] : 'månaden';
  }
  function kistaHtml(öppen, ny) {
    return '<span class="nl-kista' + (öppen ? ' oppen' : '') + (ny ? ' ny' : '') + '" role="img" aria-label="'
      + esc(öppen ? 'Dagens kista är öppnad' : 'Dagens kista: klara alla tre uppdragen så öppnas den') + '">'
      + (öppen ? IKON.kistaÖppen : IKON.kista) + '</span>';
  }
  function uppdragsRad(x, klass) {
    const mal = Math.max(1, Number(x.mal) || 1), har = Math.min(mal, Number(x.har) || 0);
    return '<li class="nl-upp' + (x.klart ? ' klart' : '') + (klass ? ' ' + klass : '') + '">'
      + '<span class="nl-upp-ik">' + (x.klart ? IKON.bock : uppdragsIkon(x)) + '</span>'
      + '<span class="nl-upp-text"><b>' + esc(x.text) + '</b>'
      + '<span class="nl-upp-mat" role="progressbar" aria-label="' + esc(x.text) + '" aria-valuemin="0" aria-valuemax="' + mal
        + '" aria-valuenow="' + har + '"><i style="width:' + Math.round(har / mal * 100) + '%"></i></span></span>'
      + '<span class="nl-upp-tal">' + (x.klart ? 'Klart' : tusen(har) + '/' + tusen(mal)) + '</span></li>';
  }
  function uppdragHtml(läge, opts) {
    const u = läge && läge.uppdrag;
    if (!u || !Array.isArray(u.idag) || !u.idag.length) return '';
    const o = opts || {};
    const klara = u.idag.filter(x => x.klart).length;
    const v = u.vecka, m = u.manad;
    const vecka = v ? uppdragsRad(Object.assign({}, v, { grupp: 'vecka' }), 'nl-upp-vecka') : '';
    const månad = m ? uppdragsRad({ id: 'manad', grupp: 'manad', klart: m.klart, mal: m.mal, har: m.har,
      text: 'Månadens utmaning: klara ' + m.mal + ' uppdrag i ' + månadsNamn(m.manad) }, 'nl-upp-manad') : '';
    return '<section class="nl-uppdrag" aria-labelledby="nl-uppdrag-t">'
      + '<div class="nl-uppdrag-huvud"><div class="nl-uppdrag-rubrik"><h3 id="nl-uppdrag-t">Dagens uppdrag</h3>'
      + '<span>' + esc(u.kista ? 'Alla tre klara. Nya uppdrag i morgon.' : klara + ' av ' + u.idag.length + ' klara · klara alla tre så öppnas kistan') + '</span></div>'
      + kistaHtml(!!u.kista, !!o.nyKista) + '</div>'
      + '<ol class="nl-uppdrag-lista">' + u.idag.map(x => uppdragsRad(x)).join('') + '</ol>'
      + (vecka || månad ? '<ol class="nl-uppdrag-lista nl-uppdrag-mer">' + vecka + månad + '</ol>' : '')
      + '</section>';
  }

  /* Det som blev klart mellan två lägen: dagens uppdrag, veckans och
     månadens, och kistan. Före saknas (första gången, eller en databas
     utan uppdragen): då firas ingenting, för det går inte att veta vad
     som är nytt. Samma dag krävs: efter midnatt är dagens uppdrag andra. */
  function nyaKlaraUppdrag(före, efter) {
    const f = före && före.uppdrag, e = efter && efter.uppdrag;
    const ut = { rader: [], kista: false };
    if (!f || !e || f.dag !== e.dag) return ut;
    const varKlart = new Set((f.idag || []).filter(x => x.klart).map(x => x.id));
    (e.idag || []).forEach(x => { if (x.klart && !varKlart.has(x.id)) ut.rader.push(x); });
    if (e.vecka && e.vecka.klart && !(f.vecka && f.vecka.klart)) ut.rader.push(Object.assign({ grupp: 'vecka' }, e.vecka));
    if (e.manad && e.manad.klart && !(f.manad && f.manad.klart)) {
      ut.rader.push({ id: 'manad', grupp: 'manad', klart: true, mal: e.manad.mal, har: e.manad.har,
        text: 'Månadens utmaning: ' + e.manad.mal + ' uppdrag i ' + månadsNamn(e.manad.manad) });
    }
    ut.kista = !!(e.kista && !f.kista);
    return ut;
  }

  /* ============================================================
     VÄLJAREN (2026-10-06)
     Leo: "gör så att man kan välja från olika ämnen och årskurser lite
     enklare och mer effektivt". Samma kväll vändes den: först alla
     ämnen som rutor med ikon och årskurser, och när ett ämne trycks
     kommer dess årskurser upp under rutorna (elevens egen märkt).
     Genvägarna till de senast övade banorna togs bort: de tog bara plats.
     ============================================================ */
  function kortÅrskurs(k) { return /^gy/.test(k) ? 'Gy ' + k.slice(2) : 'Åk ' + k.slice(2); }
  /* Ett ämnes årskurser i ord: "Åk 1–9 · Gy 1–3". */
  function årskursSpann(lista) {
    const spann = (pre, tal) => {
      if (!tal.length) return '';
      const delar = [];
      let start = tal[0], förra = tal[0];
      tal.slice(1).concat([null]).forEach(t => {
        if (t === förra + 1) { förra = t; return; }
        delar.push(start === förra ? String(start) : start + '–' + förra);
        start = förra = t;
      });
      return pre + ' ' + delar.join(', ');
    };
    const nr = re => lista.filter(k => re.test(k)).map(k => Number(k.slice(2))).sort((x, y) => x - y);
    return [spann('Åk', nr(/^ak/)), spann('Gy', nr(/^gy/))].filter(Boolean).join(' · ');
  }
  /* Leo, samma kväll igen: "Välj ämne och kurs är fortfarande konstig ta
     bort senaste de tar bara plats. Och när man trycker på ett ämne ska
     årskurserna komma upp". Först ämnena, vart och ett med sina
     årskurser; under dem årskurserna i det valda ämnet. Ett nytt ämne
     börjar i elevens årskurs om ämnet har den, annars i den förvalda. */
  function väljareHtml(o, finns, ämnen, amne, arskurs) {
    const rutor = '<div class="nl-amnen" role="group" aria-label="Ämne">' + ämnen.map(a => {
      const ak = a === amne ? arskurs : förvaldÅrskurs(finns[a], o.elevKod);
      let v = vägen(Object.assign({}, o, { amne: a, arskurs: ak }));
      if (!v.totalt) v = npSpår(Object.assign({}, o, { amne: a, arskurs: ak })) || v;
      const np = finns[a].some(k => harNp(o.katalog, a, k));
      const spann = årskursSpann(finns[a]);
      return '<button type="button" class="nl-amne" data-nl-f="' + ämnesKod(a) + '" data-nl-amne="' + esc(a) + '"'
        + ' aria-pressed="' + (a === amne ? 'true' : 'false') + '"'
        + ' aria-label="' + esc(kortÄmne(a) + ', ' + spann + (np ? ', med träning inför nationella provet' : '')) + '">'
        + '<span class="nl-amne-ik">' + ämnesIkon(a) + '</span>'
        + '<span class="nl-amne-text"><b>' + esc(kortÄmne(a)) + '</b>'
        + '<span class="nl-amne-mat" aria-hidden="true"><i style="width:' + v.procent + '%"></i></span>'
        + '<span class="nl-amne-not">' + esc(spann) + (np ? '<em>NP</em>' : '') + '</span></span>'
        + '</button>';
    }).join('') + '</div>';
    const ak = amne
      ? '<p class="nl-ak-rubrik">' + esc('Årskurs i ' + kortÄmne(amne)) + '</p>'
        + '<div class="nl-ak" role="group" aria-label="' + esc('Årskurs i ' + kortÄmne(amne)) + '">' + (finns[amne] || []).map(k =>
          '<button type="button" class="nl-ak-knapp' + (k === o.elevKod ? ' egen' : '') + '" data-nl-ak="' + k + '"'
          + ' aria-pressed="' + (k === arskurs ? 'true' : 'false') + '"'
          + ' aria-label="' + esc(NX.årskursText(k) + (k === o.elevKod ? ', din årskurs' : '')) + '">' + esc(kortÅrskurs(k)) + '</button>').join('')
        + '</div>'
      : '';
    return '<div class="nl-grupp"><h3>Välj ämne</h3></div>'
      + '<div class="nl-valj">' + rutor + ak + '</div>';
  }

  /* Vägen eller NP-sektionen, när banan har båda. */
  function spårHtml(spar, np) {
    return '<div class="nl-spar" role="group" aria-label="Del av banan">'
      + '<button type="button" class="nl-spar-knapp" data-nl-spar="vag" aria-pressed="' + (spar === 'vag' ? 'true' : 'false') + '">'
        + IKON.flagga + '<span>Din väg</span></button>'
      + '<button type="button" class="nl-spar-knapp nl-spar-np" data-nl-spar="np" aria-pressed="' + (spar === 'np' ? 'true' : 'false') + '"'
        + ' aria-label="' + esc('Inför nationella provet, ' + np.procent + ' procent klart') + '">'
        + IKON.prov + '<span class="nl-spar-lang">Inför nationella provet</span><span class="nl-spar-kort">Inför NP</span>'
        + '<em>' + np.procent + ' %</em></button>'
      + '</div>';
  }

  /* ============================================================
     INFÖR NATIONELLA PROVET (2026-10-06)
     Leo: "Ta gratis nationella prov gamla prov och svar och gör en
     inför nationella prov-sektion i varje ämne som har nationella
     prov." Proven är upphovsrättsskyddade och släpps för undervisning,
     inte för en betald tjänst (minne/nexlax.md, verktyg/bladen/
     lankar.py), så de kopieras inte hit. Sektionen har Nextrums egna
     uppgifter i provets stil, och länkar till provgruppernas egna sidor
     där de gamla proven finns gratis.
     NP_LÄNKAR speglar verktyg/bladen/lankar.py: bygg-uppgifter.py
     --kolla nekar en adress här som inte står där.
     ============================================================ */
  const NP_INFO = {
    'Matematik|ak3': 'Provet i åk 3 görs i flera delar under våren och prövar tal och räkning, mätning, geometri och problemlösning.',
    'Svenska|ak3': 'Provet i åk 3 prövar att läsa berättande texter och faktatexter, att skriva och att tala.',
    'Matematik|ak6': 'Provet har en muntlig del och skriftliga delar med och utan miniräknare. Det prövar tal, algebra, geometri, sannolikhet, statistik och problemlösning.',
    'Svenska|ak6': 'Provet prövar tre saker: att tala, att läsa och förstå texter och att skriva.',
    'Engelska|ak6': 'Provet prövar fyra förmågor: att tala, läsa, lyssna och skriva på engelska.',
    'Matematik|ak9': 'Provet har en muntlig del och skriftliga delar med och utan miniräknare: korta svar och uppgifter där du redovisar hur du löst dem, på nivåerna E, C och A.',
    'Svenska|ak9': 'Provet prövar att tala, läsa och skriva. Läsdelen har flera texter kring ett tema, och i skrivdelen skriver du en text utifrån ett tema.',
    'Engelska|ak9': 'Provet har tre delar: en muntlig, en där du läser och lyssnar, och en där du skriver.',
    'NO / Fysik / Kemi / Biologi|ak9': 'Provet i NO prövar ett av ämnena biologi, fysik och kemi: begreppen, att förklara samband och att planera och värdera undersökningar.',
    'SO / Historia / Samhällskunskap|ak9': 'Provet i SO prövar ett av ämnena geografi, historia, religionskunskap och samhällskunskap.',
    'Matematik|gy1': 'Provet på första nivån i matematik har korta svar och uppgifter med redovisning, med och utan digitala verktyg.',
    'Matematik|gy2': 'Provet på andra nivån i matematik har korta svar och uppgifter med redovisning, med och utan digitala verktyg.',
    'Svenska|gy1': 'Provet på första nivån i svenska har en muntlig och en skriftlig del. I den skriftliga skriver du en text utifrån ett häfte med texter och hänvisar till dem.',
    'Svenska|gy3': 'Provet på tredje nivån i svenska är skriftligt: du skriver en vetenskapligt inriktad text utifrån ett häfte med texter och hänvisar till källorna.',
    'Engelska|gy1': 'Provet på första nivån i engelska prövar att tala, att läsa och lyssna och att skriva.',
    'Engelska|gy2': 'Provet på andra nivån i engelska prövar att tala, att läsa och lyssna och att skriva.'
  };
  const NP_LÄNKAR = {
    'Matematik|ak6': [['Proven i matematik, PRIM-gruppen vid Stockholms universitet', 'https://www.su.se/enheter/prim-gruppen/nationella-prov']],
    'Engelska|ak6': [['Exempel på uppgifter i provet, Göteborgs universitet', 'https://www.gu.se/nationella-prov-frammande-sprak/prov-och-bedomningsstod-i-engelska/engelska-arskurs-1-6/exempel-pa-uppgiftstyper-for-engelska-for-arskurs-6']],
    'Matematik|ak9': [['Tidigare prov i matematik, PRIM-gruppen vid Stockholms universitet', 'https://www.su.se/enheter/prim-gruppen/nationella-prov/arskurs-9']],
    'Engelska|ak9': [['Provet i engelska, Göteborgs universitet', 'https://www.gu.se/nationella-prov-frammande-sprak/prov-och-bedomningsstod-i-engelska/engelska-arskurs-7-9/nationella-prov-i-engelska-for-arskurs-9']],
    'Svenska|ak9': [['Provets upplägg och bedömning, Uppsala universitet', 'https://www.uu.se/nationella-prov/svenska-och-svenska-som-andrasprak/grundskolan/ak9/upplagg']],
    'NO / Fysik / Kemi / Biologi|ak9': [['Förberedelsematerial inför proven i NO, Umeå universitet', 'https://arkiv.edusci.umu.se/npno9/webbmaterial/F%C3%B6rberedelsematerial%20f%C3%B6r%20nationella%20prov%20i%20NO%C3%A4mnen%20%C3%A5k%209.pdf']],
    'SO / Historia / Samhällskunskap|ak9': [['Provet i geografi, Uppsala universitet', 'https://www.uu.se/nationella-prov/geografi/'],
      ['Provet i religionskunskap, Göteborgs universitet', 'https://www.gu.se/didaktik-pedagogisk-profession/nationella-prov-i-religionskunskap']],
    'Matematik|gy1': [['Proven i matematik, PRIM-gruppen vid Stockholms universitet', 'https://www.su.se/enheter/prim-gruppen/nationella-prov']],
    'Svenska|gy1': [['Provet i svenska nivå 1, Uppsala universitet', 'https://www.uu.se/nationella-prov/svenska-och-svenska-som-andrasprak/gymnasiet/gy1']],
    'Engelska|gy1': [['Provet i engelska nivå 1, Göteborgs universitet', 'https://www.gu.se/nationella-prov-frammande-sprak/prov-och-bedomningsstod-i-engelska/engelska-pa-niva-1/nationellt-prov-i-engelska-pa-niva-1']],
    'Matematik|gy2': [['Tidigare givna prov i matematik, Umeå universitet', 'https://www.umu.se/en/department-of-applied-educational-science/national-test-and-test-bank/national-course-tests-in-mathematics/earlier-given-tests/']],
    'Engelska|gy2': [['Provet i engelska nivå 2, Göteborgs universitet', 'https://www.gu.se/nationella-prov-frammande-sprak/prov-och-bedomningsstod-i-engelska/engelska-pa-niva-2/nationellt-prov-i-engelska-pa-niva-2']],
    'Svenska|gy3': [['Provet i svenska nivå 3, Uppsala universitet', 'https://www.uu.se/nationella-prov/svenska-och-svenska-som-andrasprak/gymnasiet/gy3']]
  };
  const PROVÄMNE = { 'Matematik': 'matematik', 'Svenska': 'svenska', 'Engelska': 'engelska',
    'NO / Fysik / Kemi / Biologi': 'NO', 'SO / Historia / Samhällskunskap': 'SO' };
  /* Områdets namn utan NP-träning: i sektionen säger rubriken redan det. */
  function npNamn(omrade) {
    const s = String(omrade || '');
    if (/^NP-träning$/.test(s)) return 'Blandad träning';
    if (/^Läsa: NP-träning$/.test(s)) return 'Läsa';
    const x = s.replace(/^NP-träning:\s*/, '').replace(/\s*inför NP$/, '');
    return x.charAt(0).toUpperCase() + x.slice(1);
  }
  function npHtml(o, np) {
    const nyckel = np.amne + '|' + np.arskurs;
    const info = NP_INFO[nyckel];
    const länkar = NP_LÄNKAR[nyckel] || [];
    const ämne = PROVÄMNE[np.amne] || kortÄmne(np.amne).toLowerCase();
    const huvud = '<div class="nl-np-huvud">'
      + '<span class="nl-np-ik">' + IKON.prov + '</span>'
      + '<div class="nl-np-text">'
      + '<span class="nl-np-et">Inför nationella provet</span>'
      + '<h3>Nationella provet i ' + esc(ämne) + ', ' + esc(NX.årskursText(np.arskurs).replace(/^Åk/, 'åk')) + '</h3>'
      + (info ? '<p>' + esc(info) + (/^gy/.test(np.arskurs) ? ' På gymnasiet hör provet till nivån i ämnet: läser du nivån ett annat år gäller samma träning.' : '') + '</p>' : '')
      + '<p class="nl-np-egna">Uppgifterna här är Nextrums egna, i samma stil som provet. Alla är öppna: börja med det du behöver.</p>'
      + '</div></div>'
      /* Barnets vy har inga länkar ut (nexlax_for_barnet): där står var
         proven finns, och en vuxen öppnar dem. */
      + (länkar.length && o.barnvy
          ? '<div class="nl-np-lankar"><b>Öva på riktiga gamla prov</b>'
            + '<p>Provgrupperna publicerar gamla prov gratis när de inte längre är hemliga. Be din förälder eller studiehjälpare '
            + 'öppna dem: länkarna står i NexLäx i deras inloggning.</p></div>'
          : länkar.length
          ? '<div class="nl-np-lankar"><b>Öva på riktiga gamla prov</b>'
            + '<p>Provgrupperna publicerar gamla prov gratis när de inte längre är hemliga. Proven är skyddade av upphovsrätten, så vi länkar dit i stället för att kopiera hit dem.</p>'
            + länkar.map(([titel, lank]) => '<a class="nl-np-lank" href="' + esc(lank) + '" target="_blank" rel="noopener noreferrer">'
              + IKON.länk + '<span>' + esc(titel) + '</span></a>').join('')
            + '</div>'
          : '');
    const områden = np.områden.map((a, i) => {
      const steg = a.nivåer.concat(a.mästare ? [a.mästare] : []);
      return '<li class="nl-np-omr' + (a.klart ? ' klart' : '') + (a.bemästrat ? ' bem' : '') + '" data-nl-f="' + områdesFärg(np.amne, i) + '">'
        + '<div class="nl-np-omr-huvud"><b>' + esc(npNamn(a.namn)) + '</b>'
        + '<span class="nl-omr-lage">' + esc(a.bemästrat ? 'Bemästrat' : a.klart ? 'Klart' : a.klara + ' av ' + a.nivåer.length + ' klara') + '</span></div>'
        + '<div class="nl-np-nivaer">' + steg.map(x => npKort(x, o)).join('') + '</div>'
        + '</li>';
    }).join('');
    return '<div class="nl-np">' + huvud + '<ol class="nl-np-omraden">' + områden + '</ol></div>';
  }
  function npKort(x, o) {
    const n = x.niva;
    const mästare = x.sort === 'mastare';
    const läge = x.klar ? 'klar' : !x.öppen ? 'last' : x.aktuell ? 'aktuell' : 'oppen';
    const fakta = [n.lastext ? 'Läsförståelse' : '', omfattning(n, o.katalog)].filter(Boolean).join(' · ');
    const knapp = x.öppen
      ? '<button type="button" class="btn ' + (x.klar ? 'btn-ghost' : 'btn-primary') + ' btn-sm" data-nl-starta="' + esc(n.id) + '">'
        + (x.pågår ? 'Fortsätt' : x.klar ? 'Gör om' : mästare ? 'Gör provet' : 'Starta') + '</button>'
      : '<span class="nl-np-las">' + IKON.lås + 'Klara områdets nivåer först</span>';
    return '<article class="nl-np-niva ' + läge + (mästare ? ' mastare' : '') + '">'
      + '<span class="nl-np-niva-ik" aria-hidden="true">' + (mästare ? IKON.krona : x.klar ? IKON.bock : n.lastext ? IKON.bok : IKON.spela) + '</span>'
      + '<div class="nl-np-niva-text"><b>' + esc(mästare ? 'Provträning, blandat' : n.titel) + '</b>'
      + (fakta ? '<span>' + esc(fakta) + '</span>' : '')
      + (x.klar ? stjärnRad(x.stjarnor, 3, 'upg-stj-sm') : x.framsteg ? prickar(x.framsteg.klara, x.framsteg.totalt) : '')
      + '</div>'
      + '<div class="nl-np-niva-atg">' + knapp
      + (x.första ? '<button type="button" class="upg-lank" data-upg-genomgang="' + esc((x.senast || x.första).id) + '">Se rättningen</button>' : '')
      + '</div></article>';
  }

  /* Ljudet och vibrationen av och på, sist på Din väg. Valet sparas i
     webbläsaren (nextrum-ljud.js). Vibrationen visas bara där den finns. */
  function inställningarHtml() {
    if (typeof NXLjud === 'undefined' || !NXLjud) return '';
    const på = NXLjud.ljudPå(), vibb = NXLjud.vibrationPå();
    return '<div class="nl-inst" role="group" aria-label="Ljud och vibration i NexLäx">'
      + '<button type="button" class="nl-inst-knapp" data-nl-ljud aria-pressed="' + (på ? 'true' : 'false') + '">'
        + (på ? IKON.ljudPå : IKON.ljudAv) + '<span>Ljud</span></button>'
      + (NXLjud.kanVibrera()
          ? '<button type="button" class="nl-inst-knapp" data-nl-vibb aria-pressed="' + (vibb ? 'true' : 'false') + '">'
            + IKON.vibration + '<span>Vibration</span></button>'
          : '')
      + '</div>';
  }

  function stegTitel(n) {
    return n.sort === 'mastare' ? 'Mästarprov: ' + n.omrade : n.titel;
  }

  /* Prickarna i en påbörjad nivå: en per uppgift, fylld när den är rätt
     besvarad. Fler än tolv blir en mätare. */
  function prickar(klara, totalt, klass) {
    if (!totalt) return '';
    const etikett = klara + ' av ' + totalt + ' uppgifter klara';
    if (totalt > 12) {
      return '<span class="nl-prickmat ' + (klass || '') + '" role="img" aria-label="' + esc(etikett) + '"><i style="width:'
        + Math.round(klara / totalt * 100) + '%"></i></span>';
    }
    let ut = '<span class="nl-prickar ' + (klass || '') + '" role="img" aria-label="' + esc(etikett) + '">';
    for (let i = 0; i < totalt; i++) ut += '<i class="' + (i < klara ? 'klar' : '') + '"></i>';
    return ut + '</span>';
  }

  /* ---------- från studiehjälparen ----------
     Det studiehjälparen gett, öppet först: det mest försenade eller det
     med närmast deadline överst, som ett eget kort ("Rekommenderat av"),
     resten under. En digital uppgift startas härifrån och blir klar när
     nivån klaras; en vanlig bockar familjen av själv. */
  function rekOrdning(a, b) {
    const da = a.due_date || '9999', db = b.due_date || '9999';
    if (da !== db) return da.localeCompare(db);
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  }

  function rekHtml(o) {
    const alla = o.uppgifter || [];
    if (!alla.length) return '';
    const öppna = alla.filter(h => h.status !== 'klar').sort(rekOrdning);
    const klara = alla.filter(h => h.status === 'klar')
      .sort((a, b) => String(b.completed_at || '').localeCompare(String(a.completed_at || '')));
    const vem = o.hjälpare && o.hjälpare.namn ? String(o.hjälpare.namn).split(' ')[0] : null;

    let ut = '<div class="nl-grupp" id="nl-rek"><h3>Från din studiehjälpare</h3>'
      + (öppna.length ? '<span class="vy-antal ar-gor">' + öppna.length + '</span>' : '') + '</div>';
    if (öppna.length) {
      ut += öppna.map((h, i) => rekKort(h, o, i === 0 ? { först: true, vem } : {})).join('');
    } else {
      ut += '<div class="vy-kort"><div class="vy-kort-kropp nl-rek-tomt">'
        + '<span class="nl-rek-bock">' + IKON.bock + '</span>'
        + '<p><b>Allt från ' + esc(vem || 'studiehjälparen') + ' är gjort.</b> Det som kommer nästa gång står här.</p></div></div>';
    }
    if (klara.length) {
      ut += '<details class="nl-klara"><summary>Klara från studiehjälparen <em>' + klara.length + '</em>'
        + '<svg class="nl-klara-pil" viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 8l4.5 4.5L14.5 8"/></svg></summary>'
        + '<div class="nl-klara-lista">' + klara.slice(0, 20).map(h => rekKort(h, o, { klar: true })).join('') + '</div></details>';
    }
    return ut;
  }

  function rekKort(h, o, opts) {
    const x = opts || {};
    const n = h.niva_id ? ((o.katalog || []).find(k => k.id === h.niva_id) || h.nivaer) : null;
    const läge = NXStudie.läxläge(h);
    const sen = läge === 'forsenad';
    const p = n && o.pågående ? o.pågående[n.id] : null;
    let knappar = '';
    if (x.klar) {
      knappar = n ? '' : '<button type="button" class="btn btn-ghost btn-sm" data-lax="pagaende" data-id="' + esc(h.id) + '">Ångra</button>';
    } else if (h.niva_id) {
      knappar = n && n.aktiv !== false
        ? '<button type="button" class="btn btn-primary btn-sm nl-rek-spela" data-lax-starta="' + esc(h.id) + '">'
          + IKON.spela + (p ? 'Fortsätt' : 'Börja') + '</button>'
        : '<span class="nl-rek-not">Nivån finns inte längre. Fråga din studiehjälpare.</span>';
    } else if (h.status === 'ej_paborjad') {
      knappar = '<button type="button" class="btn btn-primary btn-sm" data-lax="klar" data-id="' + esc(h.id) + '">Klar</button>'
        + '<button type="button" class="btn btn-ghost btn-sm" data-lax="pagaende" data-id="' + esc(h.id) + '">Jag har börjat</button>';
    } else {
      knappar = '<button type="button" class="btn btn-primary btn-sm" data-lax="klar" data-id="' + esc(h.id) + '">Klar</button>'
        + '<button type="button" class="btn btn-ghost btn-sm" data-lax="ej_paborjad" data-id="' + esc(h.id) + '">Inte börjat än</button>';
    }
    const material = h.biblioteksmaterial
      ? '<div class="nl-rek-mat">' + IKON.bok + '<span>' + esc(h.biblioteksmaterial.titel) + '</span>'
        + '<button type="button" class="btn btn-ghost btn-sm" data-lax-mat="' + esc(h.bibliotek_id) + '">Öppna</button></div>'
      : '';
    const fakta = [
      n ? (n.sort === 'mastare' ? 'Mästarprov' : n.sort === 'repetition' ? 'Repetition' : 'Nivå i NexLäx') : (h.subject || 'Uppgift'),
      n ? omfattning(n, o.katalog) : '',
      h.due_date ? (x.klar ? '' : 'Till ' + NXStudie.deadlineText(h.due_date).replace(/^./, c => c.toLowerCase())) : ''
    ].filter(Boolean).join(' · ');

    return '<article class="nl-rek' + (x.först ? ' nl-rek-forst' : '') + (x.klar ? ' nl-rek-klar' : '') + (sen ? ' sen' : '') + '">'
      + (x.först
          ? '<div class="nl-rek-et"><span class="nl-rek-vem">' + IKON.person + '</span>'
            + '<span>Rekommenderat av ' + esc(x.vem || 'din studiehjälpare') + '</span>'
            + (sen ? '<span class="lage sen">Försenad</span>' : '') + '</div>'
          : '')
      + '<div class="nl-rek-kropp">'
      + '<span class="nl-rek-ik">' + (x.klar ? IKON.bock : n ? IKON.spela : IKON.flagga) + '</span>'
      + '<div class="nl-rek-text"><b>' + esc(h.title) + '</b>'
      + (h.instructions && !x.klar ? '<p>' + esc(h.instructions) + '</p>' : '')
      + (fakta ? '<span class="nl-rek-fakta' + (sen ? ' sen' : '') + '">' + esc(fakta) + '</span>' : '')
      + (p && !x.klar ? prickar(p.klara, p.totalt) : '')
      + (n ? uppgiftsResultat(h, o.forsok) : '')
      + '</div></div>'
      + material
      + (knappar ? '<div class="nl-rek-atg">' + knappar + '</div>' : '')
      + '</article>';
  }

  /* ---------- från passet ----------
     Lektionen och NexLäx hänger ihop: det senaste passets "öva mer på"
     och "nästa fokus", och ett område i banan som heter likadant blir
     en knapp dit. Bara de tre senaste veckorna: äldre än så är inte
     det som ska tränas nu. */
  function passHtml(o, väg) {
    const rapporter = (o.rapporter || []).filter(r => r.needs_practice || r.next_focus)
      .sort((a, b) => String(b.lesson_date).localeCompare(String(a.lesson_date)));
    const r = rapporter[0];
    if (!r || !r.lesson_date || Date.parse(r.lesson_date) < Date.now() - 21 * 86400000) return '';
    const text = ((r.needs_practice || '') + ' ' + (r.next_focus || '')).toLowerCase();
    const träff = väg ? väg.områden.find(a => a.namn && text.includes(a.namn.toLowerCase())) : null;
    const nod = träff ? (träff.nivåer.find(x => x.öppen && !x.klar) || träff.nivåer.find(x => x.öppen) || null) : null;
    return '<div class="nl-pass">'
      + '<span class="nl-pass-et">Från passet ' + esc(NX.datumText(String(r.lesson_date).slice(0, 10))) + '</span>'
      + (r.needs_practice ? '<p><em>Öva mer på</em> ' + esc(r.needs_practice) + '</p>' : '')
      + (r.next_focus ? '<p><em>Nästa fokus</em> ' + esc(r.next_focus) + '</p>' : '')
      + (nod ? '<button type="button" class="btn btn-ghost btn-sm" data-nl-starta="' + esc(nod.niva.id) + '">'
          + 'Träna ' + esc(träff.namn) + ' i NexLäx</button>' : '')
      + '</div>';
  }

  /* ---------- vägen ----------
     Områdena i ordning, med stegen i sicksack som i Duolingo. Ett
     område längre fram än nästa visar bara sitt namn och vad som låser
     upp det: vägen är lång nog ändå på en telefon. */
  function vägHtml(o, väg) {
    let x = 0;
    const områden = väg.områden.map((a, i) => {
      const förra = i > 0 ? väg.områden[i - 1] : null;
      const ikon = a.klart ? (a.bemästrat ? IKON.krona : IKON.bock) : a.läge === 'last' || a.läge === 'nasta' ? IKON.lås : String(i + 1);
      const lägesText = a.bemästrat ? 'Bemästrat' : a.klart ? 'Klart' : a.läge === 'aktuellt' ? 'Pågår'
        : a.läge === 'oppet' ? 'Öppet' : a.läge === 'nasta' ? 'Nästa område' : 'Låst';
      const visaSteg = a.läge !== 'last';
      const noder = visaSteg ? a.nivåer.concat(a.mästare ? [a.mästare] : []).map(n => nodHtml(n, o, väg, XLED[x++ % XLED.length])).join('') : '';
      return '<li class="nl-omr nl-omr-' + a.läge + (a.bemästrat ? ' nl-omr-bem' : '') + '" data-nl-f="' + områdesFärg(väg.amne, i) + '">'
        + '<div class="nl-omr-huvud">'
        + '<span class="nl-omr-ik" aria-hidden="true">' + ikon + '</span>'
        + '<span class="nl-omr-text"><span class="nl-omr-et">Område ' + (i + 1) + '</span><b>' + esc(a.namn) + '</b></span>'
        + '<span class="nl-omr-lage">' + esc(lägesText) + (a.bemästrat || !a.nivåer.length ? '' : '<em>' + a.klara + '/' + a.nivåer.length + '</em>') + '</span>'
        + '</div>'
        + (visaSteg
            ? '<ol class="upg-stig nl-stig">' + noder + '</ol>'
            : '<p class="nl-omr-las">' + IKON.lås + 'Öppnas när du klarat ' + esc(förra ? förra.namn : 'området före') + '.</p>')
        + '</li>';
    }).join('');
    /* Översikten över områdena (2026-09-29): var man står i banan, med
       läget och områdets färg som i områdets eget huvud. Den gick först
       att trycka på och hoppade till området, men Leo samma kväll: "de
       är jobbigt om man råkar trycka och hamnar längre ner på sidan".
       Raden dras i sidled med tummen, och ett tryck mitt i ett drag
       hoppade. Nu är den bara en rad att läsa. */
    const hopp = väg.områden.length > 1
      ? '<ol class="nl-hopp" aria-label="Områdena i banan">' + väg.områden.map((a, i) =>
          '<li class="nl-hopp-knapp nl-hopp-' + (a.bemästrat ? 'bem' : a.klart ? 'klart' : a.läge) + '" data-nl-f="' + områdesFärg(väg.amne, i) + '"'
          + (a.läge === 'aktuellt' ? ' aria-current="step"' : '') + '>'
          + '<span class="nl-hopp-ik" aria-hidden="true">' + (a.bemästrat ? IKON.krona : a.klart ? IKON.bock
              : a.läge === 'last' || a.läge === 'nasta' ? IKON.lås : String(i + 1)) + '</span>'
          + '<span class="nl-hopp-namn">' + esc(a.namn) + '</span></li>').join('') + '</ol>'
      : '';
    return '<div class="nl-grupp nl-vag-rubrik"><h3>Din väg</h3><span class="nl-vag-bana">' + esc(banaNamn(väg.amne, väg.arskurs)) + '</span></div>'
      + hopp
      + '<ol class="nl-vag" aria-label="' + esc('Din väg i ' + banaNamn(väg.amne, väg.arskurs)) + '">' + områden
      + (väg.helaKlar ? '<li class="nl-mal-flagga"><span>' + IKON.pokal + '</span><b>Banan är klar</b></li>' : '')
      + '</ol>';
  }

  function nodHtml(n, o, väg, led) {
    const läge = n.klar ? 'klar' : n.aktuell ? 'aktuell' : n.öppen ? 'oppen' : 'last';
    const ärÖppen = o.öppen === n.niva.id;
    const nyss = o.nyss || {};
    const mästare = n.sort === 'mastare';
    const ikon = mästare ? IKON.krona : n.klar ? IKON.bock : n.öppen ? IKON.spela : IKON.lås;
    return '<li class="upg-nod ' + läge + (mästare ? ' mastare' : '') + (n.niva.lastext ? ' las' : '') + (ärÖppen ? ' vald' : '')
      + (nyss.klar === n.niva.id ? ' nyss-klar' : '') + (nyss.oppen === n.niva.id ? ' nyss-oppen' : '') + '" style="--x:' + led + '">'
      + '<button type="button" class="upg-nod-knapp" data-nl-nod="' + esc(n.niva.id) + '" aria-expanded="' + (ärÖppen ? 'true' : 'false') + '"'
      + ' aria-label="' + esc(stegTitel(n.niva) + ', ' + (n.klar ? 'klar, ' + n.stjarnor + ' av 3 stjärnor' : n.aktuell ? 'nästa steg' : n.öppen ? 'öppen' : 'låst')) + '">'
      + ikon
      + (n.aktuell ? '<span class="upg-nod-bubbla" aria-hidden="true">' + (n.pågår ? 'Fortsätt' : mästare ? 'Provet' : 'Börja') + '</span>' : '')
      + '</button>'
      + '<span class="upg-nod-namn">' + esc(mästare ? 'Mästarprov' : n.niva.titel) + '</span>'
      + (n.klar ? stjärnRad(n.stjarnor, 3, 'upg-stj-sm')
          : n.framsteg ? prickar(n.framsteg.klara, n.framsteg.totalt, 'nl-nod-prickar')
          : n.given ? '<span class="upg-nod-given">Från studiehjälparen</span>' : '')
      + (ärÖppen ? nodKort(n, o, väg) : '')
      + '</li>';
  }

  function nodKort(n, o, väg) {
    const niva = n.niva;
    const mästare = n.sort === 'mastare';
    const i = väg.steg.indexOf(n);
    const förra = i > 0 ? väg.steg.slice(0, i).reverse().find(x => x.sort === 'vanlig') : null;
    let text = '', knapp = '';
    if (!n.öppen) {
      text = mästare ? 'Klara alla nivåer i ' + niva.omrade + ' först, så öppnas provet.'
        : 'Klara "' + (förra ? förra.niva.titel : 'nivån före') + '" först, så öppnas den här.';
    } else {
      text = n.klar
        ? 'Klarad med ' + n.stjarnor + (n.stjarnor === 1 ? ' stjärna' : ' stjärnor')
          + (mästare ? (n.stjarnor >= BEMÄSTRAD ? '. Området är bemästrat.' : '. Två stjärnor bemästrar området.') : '. Gör om den för fler, det bästa resultatet räknas.')
        : n.framsteg ? 'Du har börjat: ' + n.framsteg.klara + ' av ' + n.framsteg.totalt + ' uppgifter klara. Det du svarat är sparat.'
        : n.pågår ? 'Du har börjat. Det du svarat är sparat.'
        : n.given ? 'Din studiehjälpare har gett dig den här.'
        : mästare ? 'Blandade frågor ur hela området. Klarar du det med minst två stjärnor är området bemästrat.' : '';
      knapp = '<button type="button" class="btn btn-primary btn-sm" data-nl-starta="' + esc(niva.id) + '">'
        + (n.pågår ? 'Fortsätt' : n.klar ? 'Gör om' : mästare ? 'Gör provet' : 'Starta') + '</button>';
    }
    const fakta = [omfattning(niva, o.katalog), niva.lastext ? 'Läsförståelse' : '',
      n.xp ? 'Du har fått ' + xpText(n.xp) + ' här' : ''].filter(Boolean).join(' · ');
    return '<div class="upg-nod-kort">'
      + '<b>' + esc(stegTitel(niva)) + '</b>'
      + (niva.beskrivning ? '<p>' + esc(niva.beskrivning) + '</p>' : '')
      + (fakta ? '<span class="upg-nod-fakta">' + esc(fakta) + '</span>' : '')
      + (n.framsteg ? prickar(n.framsteg.klara, n.framsteg.totalt) : '')
      + (text ? '<p class="upg-nod-lage">' + esc(text) + '</p>' : '')
      + '<div class="upg-nod-atg">' + knapp
      + (n.första ? '<button type="button" class="upg-lank" data-upg-genomgang="' + esc((n.senast || n.första).id) + '">Se rättningen</button>' : '')
      + '</div></div>';
  }

  /* ---------- repetitionen ---------- */
  function repetitionHtml(o, väg) {
    const r = väg.repetition;
    if (!r) return '';
    const missade = antalMissade(o.läge, väg.amne, väg.arskurs);
    const någotKlart = väg.steg.some(x => x.klar);
    if (!missade && !någotKlart) return '';
    return '<div class="nl-rep">'
      + '<span class="nl-rep-ik">' + IKON.repetera + '</span>'
      + '<div class="nl-rep-text"><b>' + esc(missade ? 'Repetera det du missat' : 'Repetera blandat') + '</b>'
      + '<span>' + esc(missade
          ? missade + (missade === 1 ? ' uppgift' : ' uppgifter') + ' du svarat fel på förut. Sitter de nu ger de sina XP.'
          : 'Blandade uppgifter ur nivåerna du klarat, så att det sitter kvar.') + '</span></div>'
      + '<button type="button" class="btn btn-ghost btn-sm" data-nl-starta="' + esc(r.niva.id) + '">Repetera</button>'
      + '</div>';
  }

  /* ============================================================
     DIN UTVECKLING
     o: { host, katalog, forsok, uppgifter, läge, progress, historik,
          rapporter, bokningar, elevNamn, alla (visa alla rättade) }
     ============================================================ */
  function ritaUtveckling(o) {
    const host = o.host;
    if (!host) return;
    const l = o.läge;
    const d = underlag(o);
    const vem = o.elevNamn || 'eleven';
    const f = o.forsok || [];
    const klara = f.filter(x => x.klar_at).sort((a, b) => Date.parse(b.klar_at) - Date.parse(a.klar_at));

    /* ---------- talen ---------- */
    const u = l && l.uppgifter;
    const bästDag = ((l && l.dagar) || []).reduce((m, x) => (Number(x.xp) || 0) > (m ? Number(m.xp) : 0) ? x : m, null);
    /* Mästarproven finns först med Fas 23.2:s bank, och bara i områden
       med minst två nivåer. Texterna nämner dem inte innan de finns. */
    const harProv = (o.katalog || []).some(n => n.aktiv && n.sort === 'mastare');
    const ruta = (v, rubrik, förklaring, ikon) => '<div>'
      + (ikon ? '<span class="nl-tal-ik">' + IKON[ikon] + '</span>' : '')
      + '<b>' + v + '</b><span>' + esc(rubrik) + '</span><small>' + esc(förklaring) + '</small></div>';
    const tal = '<div class="nl-tal">'
      + (l ? ruta(tusen(l.xp), 'XP totalt', '+' + tusen(l.xp_vecka) + ' den här veckan.', 'blixt') : '')
      + (l ? ruta(String(l.serie.nu) + '<i> ' + (l.serie.nu === 1 ? 'dag' : 'dagar') + '</i>', 'Serien',
          l.serie.basta ? 'Rekordet är ' + l.serie.basta + (l.serie.basta === 1 ? ' dag.' : ' dagar.') : 'Den börjar med första klara nivån.', 'låga') : '')
      + ruta(String(d.klaradeNivåer), 'Nivåer klarade', d.klaradeNivåer
          ? (d.treStjärnor ? d.treStjärnor + ' med tre stjärnor.' : 'Tre stjärnor är allt rätt direkt.')
          : 'Den första väntar under Din väg.', 'flagga')
      + ruta(String(d.helaOmråden), 'Områden klara', d.bemästrade ? d.bemästrade + ' av dem bemästrade.'
          : harProv ? 'Mästarprovet bemästrar ett område.' : 'Klart när varje nivå i det är klarad.', 'krona')
      + (u ? ruta(tusen(u.klara), 'Uppgifter klarade', 'Olika uppgifter som ' + vem + ' svarat rätt på.', 'bock') : '')
      + (u && u.forsta ? ruta(Math.round(u.forsta_ratt / u.forsta * 100) + '<i> %</i>', 'Rätt direkt',
          tusen(u.forsta_ratt) + ' av ' + tusen(u.forsta) + ' första svar.', 'stjärna') : '')
      + (bästDag ? ruta(tusen(bästDag.xp) + '<i> XP</i>', 'Bästa dagen',
          NX.datumText(String(bästDag.dag).slice(0, 10)) + '. Av de tolv senaste veckorna.', 'uppåt') : '')
      + '</div>';

    /* ---------- ämnena ---------- */
    const finns = banor(o.katalog);
    const medAktivitet = new Set();
    f.forEach(x => { const n = (o.katalog || []).find(k => k.id === x.niva_id); if (n) medAktivitet.add(n.amne + '|' + n.arskurs); });
    ((l && l.banor) || []).forEach(b => medAktivitet.add(b.amne + '|' + b.arskurs));
    const banRader = Array.from(medAktivitet).map(k => k.split('|'))
      .filter(([a, ak]) => finns[a] && finns[a].includes(ak))
      .sort((a, b) => (NX.AMNEN.indexOf(a[0]) - NX.AMNEN.indexOf(b[0])) || a[1].localeCompare(b[1]))
      .map(([a, ak]) => {
        const v = vägen({ katalog: o.katalog, amne: a, arskurs: ak, forsok: o.forsok, uppgifter: o.uppgifter });
        const xp = ((l && l.banor) || []).find(b => b.amne === a && b.arskurs === ak);
        return '<div class="nl-amnesrad" data-nl-f="' + ämnesKod(a) + '">'
          + '<div class="nl-amnesrad-topp"><b>' + esc(banaNamn(a, ak)) + '</b>'
          + (xp ? '<span>' + esc(xpText(xp.xp)) + '</span>' : '') + '<strong>' + v.procent + ' %</strong></div>'
          + '<span class="nl-mat" aria-hidden="true"><i style="width:' + v.procent + '%"></i></span>'
          + '<small>' + v.klara + ' av ' + v.totalt + ' nivåer · ' + v.områden.filter(x => x.klart).length + ' av ' + v.områden.length + ' områden'
          + (v.områden.some(x => x.bemästrat) ? ' · ' + v.områden.filter(x => x.bemästrat).length + ' bemästrade' : '') + '</small>'
          + '</div>';
      }).join('');

    /* ---------- veckorna och dagarna ---------- */
    const dagar = veckorOchDagar(l);

    host.innerHTML =
      rangHtml(l)
      + rankerHtml(l)
      + block('I siffror', null, tal + (l
        /* Reglerna fälls ihop: de läses en gång, talen varje dag. */
        ? '<details class="nl-skala nl-regler"><summary>Så får du XP</summary><p>'
          + esc('XP ger den som klarar något nytt: ' + regelText(l) + ' En uppgift ger XP en gång, första gången den sitter direkt. '
            + 'Serien räknar dagar: en dag med en klar nivå, något klart från studiehjälparen eller ett pass räknas, och den bryts först när en hel dag gått utan något.')
          + '</p></details>'
        : ''))
      + uppdragUtvHtml(l)
      + höjdpunkterHtml(o, l)
      + block('Dina ämnen', 'Hur långt du kommit i varje bana du gjort något i, räknat i nivåer.' + (harProv ? ' Mästarproven är kronan ovanpå.' : ''),
          banRader || NXStudie.tomt('Inget ämne än', 'Gör en nivå under Din väg så syns banan här.'))
      + (l ? block('XP per vecka', 'De åtta senaste veckorna. Den sista är den här veckan.', dagar.veckor) : '')
      + (l ? block('De fyra senaste veckorna', 'En låga för varje dag med en klar nivå, något från studiehjälparen eller ett pass.', dagar.kalender) : '')
      + block('Område för område', 'Hur stor del som var rätt första gången, per område. Har studiehjälparen bedömt samma område står bedömningen bredvid.',
          områdesHtml(o.katalog, o.forsok, o.progress) || NXStudie.tomt('Inget område än', 'Områdena fylls i när en nivå är klar.'))
      /* Barnets egen vy (o.barnvy, 2026-10-01) visar maskinens rättning
         men inte studiehjälparens bedömning eller passen: rapporterna
         når barnet bara när föräldern slagit på dem, och de står då i
         barnets vy för sig. */
      + (o.barnvy ? '' : bedömningHtml(o) + passenHtml(o))
      + block('Rättade nivåer <em>' + (klara.length ? klara.length + ' st' : '') + '</em>',
          'Varje klar omgång, senaste först. Rättningen visar varje uppgift, vad som svarades och rätt svar.',
          klara.length
            ? '<div class="upg-forsok-lista">' + (o.alla ? klara : klara.slice(0, 6)).map(x => försöksRad(x, efterId(o.katalog)[x.niva_id])).join('') + '</div>'
              + (klara.length > 6 ? '<button type="button" class="pl-mer" data-nl-alla aria-expanded="' + (o.alla ? 'true' : 'false') + '">'
                  + (o.alla ? 'Visa färre' : 'Visa alla ' + klara.length) + '</button>' : '')
            : NXStudie.tomt('Inga rättade nivåer än', 'När ' + vem + ' gjort en nivå står rättningen här.'), true)
      + block('Märken', 'Stjärnorna räknar det bästa försöket på varje nivå: en för minst 60 procent rätt på första försöket, två för minst 80 och tre för allt rätt.',
          '<div class="upg-marken">' + märken(d).map(m => märkesHtml(m)).join('') + '</div>');
  }

  /* Rangen överst i Din utveckling: namnet, stegen och hur långt det
     är till nästa. */
  function rangHtml(l) {
    if (!l) return '';
    const r = rang(l.xp);
    const steg = RANGER.map((x, i) => '<i class="' + (i < r.nr ? 'klar' : '') + (i === r.nr - 1 ? ' nu' : '') + '"></i>').join('');
    return '<section class="nl-rangkort" aria-label="' + esc('Din rank: ' + r.namn + ', ' + r.nr + ' av ' + r.av) + '">'
      + '<span class="nl-rang-ik" aria-hidden="true">' + IKON.medalj + '<b>' + r.nr + '</b></span>'
      + '<div class="nl-rang-text"><span class="nl-rang-et">Din rank · ' + r.nr + ' av ' + r.av + '</span>'
      + '<b>' + esc(r.namn) + '</b>'
      + (r.nästa
          ? '<span class="nl-mat nl-rang-mat" role="progressbar" aria-label="' + esc('Till ' + r.nästa) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'
            + Math.round(r.andel * 100) + '"><i style="width:' + Math.round(r.andel * 100) + '%"></i></span>'
            + '<small>' + esc(tusen(r.kvar) + ' XP kvar till ' + r.nästa + '. Ranken följer XP:n och sjunker aldrig.') + '</small>'
          : '<small>Den högsta ranken. Varje ny XP räknas ändå.</small>')
      + '</div>'
      + '<span class="nl-rang-steg" aria-hidden="true">' + steg + '</span>'
      + '</section>';
  }

  /* Alla ranker (Leo 2026-10-06: "man ska kunna se olika ranker som
     finns"), med XP:n som krävs och var eleven står. */
  function rankerHtml(l) {
    if (!l) return '';
    const r = rang(l.xp);
    return block('Alla ranker', 'Ranken följer XP:n. Så här många XP totalt behövs för varje rank.',
      '<ol class="nl-ranker">' + RANGER.map((x, i) => {
        const läge = i < r.nr - 1 ? 'klar' : i === r.nr - 1 ? 'nu' : '';
        return '<li class="' + läge + '"' + (läge === 'nu' ? ' aria-current="true"' : '') + '>'
          + '<span class="nl-ranker-nr" aria-hidden="true">' + (läge === 'klar' ? IKON.bock : String(i + 1)) + '</span>'
          + '<b>' + esc(x.namn) + '</b><small>' + tusen(x.xp) + ' XP</small>'
          + (läge === 'nu' ? '<em>Din rank nu</em>' : '') + '</li>';
      }).join('') + '</ol>');
  }

  /* Uppdragen i Din utveckling: hur många som klarats, och veckans och
     månadens. Dagens tre står på Din väg. */
  function uppdragUtvHtml(l) {
    const u = l && l.uppdrag;
    if (!u) return '';
    const rader = (u.vecka ? uppdragsRad(Object.assign({ grupp: 'vecka' }, u.vecka), 'nl-upp-vecka') : '')
      + (u.manad ? uppdragsRad({ id: 'manad', grupp: 'manad', klart: u.manad.klart, mal: u.manad.mal, har: u.manad.har,
          text: 'Månadens utmaning: klara ' + u.manad.mal + ' uppdrag i ' + månadsNamn(u.manad.manad) }, 'nl-upp-manad') : '');
    return block('Uppdrag', 'Tre nya varje dag, ett i veckan och en utmaning i månaden. De ger inga XP: de visar att du övat.',
      '<div class="nl-tal nl-tal-sma">'
      + '<div><b>' + tusen(u.totalt) + '</b><span>Uppdrag klara</span></div>'
      + '<div><b>' + tusen(u.hela_dagar) + '</b><span>Kistor öppnade</span></div>'
      + '<div><b>' + tusen(u.veckor) + '</b><span>Veckans uppdrag klara</span></div>'
      + '<div><b>' + tusen(u.manader) + '</b><span>Månadens utmaning klar</span></div>'
      + '</div>'
      + (rader ? '<ol class="nl-uppdrag-lista">' + rader + '</ol>' : ''));
  }

  /* Höjdpunkterna: det senaste som klarats, som en tidslinje. Nivåer
     med minst en stjärna, Mästarprov och hela områden, ur försöken och
     nexlax_lage().omraden. */
  function dagText(iso) {
    /* En tidpunkt läses i elevens tid: klockan 00.30 svensk tid är
       fortfarande gårdagen i UTC. */
    const t = /T/.test(String(iso || '')) ? new Date(iso) : null;
    const d = t && !isNaN(t) ? NX.isoFor(t) : String(iso || '').slice(0, 10);
    if (!d) return '';
    const idag = NX.isoFor(new Date());
    const igår = NX.isoFor(new Date(Date.now() - 86400000));
    return d === idag ? 'I dag' : d === igår ? 'I går' : NX.datumText(d);
  }
  function höjdpunkterHtml(o, l) {
    const n = efterId(o.katalog);
    const h = [];
    (o.forsok || []).filter(f => f.klar_at && f.godkand).forEach(f => {
      const niva = n[f.niva_id];
      if (!niva) return;
      const stj = Number(f.stjarnor) || 0;
      h.push({ at: f.klar_at, amne: niva.amne, ikon: niva.sort === 'mastare' ? 'krona' : stj === 3 ? 'stjärna' : 'bock',
        text: (niva.sort === 'mastare' ? 'Mästarprovet i ' + (ärNp(niva) ? npNamn(niva.omrade) : niva.omrade)
               : niva.sort === 'repetition' ? 'Repetitionen' : niva.titel)
          + (stj === 3 ? ' med alla rätt direkt' : stj ? ' med ' + stj + (stj === 1 ? ' stjärna' : ' stjärnor') : '') });
    });
    ((l && l.omraden) || []).forEach(x => h.push({ at: x.klart, amne: x.amne, ikon: 'flagga', stort: true,
      text: 'Hela området ' + (/NP-träning|inför NP/.test(x.omrade) ? npNamn(x.omrade) : x.omrade) + ' klart' }));
    if (!h.length) return '';
    h.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return block('Höjdpunkter', 'Det senaste du klarat.',
      '<ol class="nl-hojd">' + h.slice(0, 6).map(x => '<li class="' + (x.stort ? 'stort' : '') + '" data-nl-f="' + ämnesKod(x.amne) + '">'
        + '<span class="nl-hojd-ik">' + IKON[x.ikon] + '</span>'
        + '<span class="nl-hojd-text"><b>' + esc(x.text) + '</b><span>' + esc([dagText(x.at), kortÄmne(x.amne)].filter(Boolean).join(' · ')) + '</span></span>'
        + '</li>').join('') + '</ol>');
  }

  function block(rubrik, förklaring, innehåll, rubrikHtml) {
    return '<section class="dbox nl-block"><h5>' + (rubrikHtml ? rubrik : esc(rubrik)) + '</h5>'
      + (förklaring ? '<p class="ut-forklaring">' + esc(förklaring) + '</p>' : '')
      + innehåll + '</section>';
  }

  function regelText(l) {
    const r = (l && l.regler) || { val: 10, svarare: 20, niva: 50, omrade: 100 };
    return r.val + ' för en uppgift du väljer svaret på, ' + r.svarare + ' för en du skriver, bygger eller parar ihop själv, '
      + r.niva + ' när en nivå klaras första gången och ' + r.omrade + ' för ett helt område.';
  }

  /* XP per vecka och de fyra senaste veckorna som en kalender, ur
     nexlax_lage().dagar. Dagen är svensk tid, räknad i databasen. */
  function veckorOchDagar(l) {
    const perDag = {};
    ((l && l.dagar) || []).forEach(x => { perDag[x.dag] = x; });
    const idag = l && l.idag ? new Date(l.idag + 'T12:00:00') : new Date();
    const måndag = new Date(idag);
    måndag.setDate(idag.getDate() - ((idag.getDay() + 6) % 7));
    const iso = d => NX.isoFor(d);

    const veckor = [];
    for (let v = 7; v >= 0; v--) {
      const start = new Date(måndag); start.setDate(måndag.getDate() - v * 7);
      let xp = 0;
      for (let i = 0; i < 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); xp += Number((perDag[iso(d)] || {}).xp) || 0; }
      veckor.push({ start, xp, nu: v === 0, nr: veckonummer(start) });
    }
    const högst = Math.max(50, ...veckor.map(v => v.xp));
    const vHtml = '<div class="upg-veckor nl-veckor">' + veckor.map(v =>
      '<div class="upg-vecka' + (v.nu ? ' nu' : '') + '" aria-label="' + esc('Vecka ' + v.nr + ': ' + xpText(v.xp)) + '">'
      + '<b>' + (v.xp ? tusen(v.xp) : '') + '</b><i style="height:' + Math.round(v.xp / högst * 100) + '%"></i>'
      + '<span>v.' + v.nr + '</span></div>').join('') + '</div>';

    const start = new Date(måndag); start.setDate(måndag.getDate() - 21);
    let kal = '<div class="nl-kal" role="table" aria-label="De fyra senaste veckorna">'
      + '<div class="nl-kal-rad nl-kal-huvud" role="row">' + ['Må', 'Ti', 'On', 'To', 'Fr', 'Lö', 'Sö'].map(x => '<span role="columnheader">' + x + '</span>').join('') + '</div>';
    for (let v = 0; v < 4; v++) {
      kal += '<div class="nl-kal-rad" role="row">';
      for (let i = 0; i < 7; i++) {
        const d = new Date(start); d.setDate(start.getDate() + v * 7 + i);
        const k = iso(d), x = perDag[k];
        const framtid = d > idag;
        const aktiv = x && (x.nivaer || x.uppgifter || x.pass);
        const idagen = k === iso(idag);
        const vad = aktiv ? [x.nivaer ? x.nivaer + (x.nivaer === 1 ? ' nivå' : ' nivåer') : '', x.uppgifter ? 'uppgift från studiehjälparen' : '',
          x.pass ? 'pass' : '', x.xp ? xpText(x.xp) : ''].filter(Boolean).join(', ') : framtid ? '' : 'inget';
        kal += '<span role="cell" class="nl-kal-dag' + (aktiv ? ' aktiv' : '') + (framtid ? ' framtid' : '') + (idagen ? ' idag' : '') + '"'
          + ' aria-label="' + esc(NX.datumText(k) + (vad ? ': ' + vad : '')) + '">'
          + (aktiv ? IKON.låga : '<i>' + d.getDate() + '</i>') + '</span>';
      }
      kal += '</div>';
    }
    kal += '</div>';
    return { veckor: vHtml, kalender: kal };
  }

  /* ISO-veckans nummer, som det står i en svensk almanacka. */
  function veckonummer(t) {
    const d = new Date(t);
    const tors = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7) + 3);
    const förstaTors = new Date(tors.getFullYear(), 0, 4);
    return 1 + Math.round(((tors - förstaTors) / 86400000 - 3 + ((förstaTors.getDay() + 6) % 7)) / 7);
  }

  /* Studiehjälparens bedömning, femstegsskalan (Fas 15.3). En människas
     omdöme: det står för sig, bredvid maskinens rättning men aldrig
     ihopräknat med den. */
  function bedömningHtml(o) {
    const p = o.progress || [];
    if (!p.length) {
      return block('Studiehjälparens bedömning', 'Efter några pass bedömer studiehjälparen vilka områden som sitter och vilka som behöver mer träning.',
        NXStudie.tomt('Inga bedömningar än', 'De fylls i efter de första passen.'));
    }
    const H = o.historik || {};
    const steg = x => NXStudie.stegFör(x);
    const säkra = p.filter(x => steg(x) >= 4).length;
    const gräns = Date.now() - 30 * 86400000;
    const upp = p.filter(x => {
      const h = H[x.id] || [];
      if (!h.length) return false;
      const före = h.filter(y => Date.parse(y.bedomd_at) < gräns);
      const bas = före.length ? före[före.length - 1] : (h.length > 1 ? h[0] : null);
      return !!bas && steg(x) > Number(bas.steg);
    }).length;
    const skala = '<details class="nl-skala"><summary>Så läser du skalan</summary><ol>'
      + [1, 2, 3, 4, 5].map(n => '<li' + (n >= 4 ? ' class="ar-saker"' : '') + '><b>' + n + '</b><span><strong>'
        + esc(NXStudie.STEG[n].text) + '</strong> ' + esc(NXStudie.STEG[n].vad) + '</span></li>').join('')
      + '</ol></details>';
    return block('Studiehjälparens bedömning',
      säkra + ' av ' + p.length + (p.length === 1 ? ' område sitter' : ' områden sitter') + ' säkert (steg 4 eller 5)'
        + (upp ? ', och ' + upp + ' har gått upp de senaste 30 dagarna.' : '.') + ' Bedömningen görs av studiehjälparen efter passen.',
      skala + NXStudie.ämnesSammanfattning(p, H)
        + '<div class="nl-bed-lista">' + NXStudie.progressPerÄmne(p, { historik: x => NXStudie.historikRad(H[x.id]) }) + '</div>');
  }

  /* Passen med studiehjälparen: hur många, hur mycket tid, närvaron och
     vad de senaste rapporterna sagt ska övas. Ur samma rader som Mina
     lektioner. */
  function passenHtml(o) {
    const rapporter = (o.rapporter || []).slice().sort((a, b) => String(b.lesson_date).localeCompare(String(a.lesson_date)));
    if (!rapporter.length) return '';
    const pass = id => (o.bokningar || []).find(b => b.id === id);
    const minuter = r => r.narvaro === 'franvarande' ? 0
      : Number(r.hallna_min) || Number(r.debiterade_min) || ((pass(r.booking_id) || {}).duration_min) || 60;
    const tid = rapporter.reduce((n, r) => n + minuter(r), 0);
    const medNärvaro = rapporter.filter(r => r.narvaro);
    const närvarande = medNärvaro.filter(r => r.narvaro !== 'franvarande').length;
    const timText = m => (m >= 60 ? (Math.round(m / 6) / 10).toString().replace('.', ',') + ' h' : m + ' min');
    const fokus = rapporter.filter(r => r.needs_practice || r.next_focus).slice(0, 3);
    return block('Med studiehjälparen',
      'Pass räknas när rapporten är skriven. Hela rapporterna står under Mina lektioner.',
      '<div class="nl-tal nl-tal-sma">'
      + '<div><b>' + rapporter.length + '</b><span>Pass med rapport</span></div>'
      + '<div><b>' + esc(timText(tid)) + '</b><span>Tid på passen</span></div>'
      + (medNärvaro.length ? '<div><b>' + närvarande + '<i> av ' + medNärvaro.length + '</i></b><span>Närvaro</span></div>' : '')
      + '</div>'
      + (fokus.length ? '<div class="upg-pass-tidslinje nl-fokus">' + fokus.map(r => '<div class="upg-pass-rad">'
          + '<time>' + esc(NX.datumText(String(r.lesson_date).slice(0, 10))) + '</time>'
          + '<b>' + esc(((pass(r.booking_id) || {}).subject) || r.amne || 'Pass') + '</b>'
          + (r.needs_practice ? '<p><em>Öva mer på:</em> ' + esc(r.needs_practice) + '</p>' : '')
          + (r.next_focus ? '<p><em>Nästa fokus:</em> ' + esc(r.next_focus) + '</p>' : '')
          + '</div>').join('') + '</div>' : ''));
  }

  /* ============================================================
     RÄTTNINGEN PER OMRÅDE
     Det FÖRSTA klara försöket på varje nivå räknas, inte det bästa:
     efter ett försök har eleven sett svaren, och ett andra försök
     mäter minnet av dem. Stjärnorna på vägen räknar det bästa, för där
     är det spelet. Här är det rättningen. Mästarprov och repetitioner
     står utanför: deras frågor kommer ur andra nivåer.
     ============================================================ */
  function perOmråde(katalog, forsok) {
    const nivå = efterId(katalog);
    const gjort = perNivå(forsok);
    const g = {};
    Object.keys(gjort).forEach(id => {
      const l = gjort[id], n = nivå[id];
      if (!n || !l.första || (n.sort && n.sort !== 'vanlig')) return;
      const k = n.amne + '|' + n.omrade;
      const x = g[k] || (g[k] = { amne: n.amne, omrade: n.omrade, ratt: 0, antal: 0, nivåer: 0, klara: 0, senast: null });
      x.ratt += Number(l.första.ratt_direkt) || 0;
      x.antal += Number(l.första.antal) || 0;
      x.nivåer++;
      if (l.klar) x.klara++;
      if (!x.senast || l.första.klar_at > x.senast) x.senast = l.första.klar_at;
    });
    return Object.values(g).sort((a, b) => String(b.senast).localeCompare(String(a.senast)));
  }

  /* Brickorna i en ordna-fråga som text. En mening (stor bokstav
     först, skiljetecken sist) sätts ihop med mellanslag; allt annat
     (tal, steg i en uträkning, ord i bokstavsordning) med pilar.
     Med mellanslag blev "8 / 2", "30 / 5" till "8 / 2 30 / 5", och
     ingen kunde se var en bricka slutade. */
  function brickText(brickor) {
    const b = (brickor || []).map(x => String(x));
    if (!b.length) return '';
    const mening = /^[A-ZÅÄÖ]/.test(b[0]) && /[.?!]$/.test(b[b.length - 1]);
    return mening ? b.join(' ').replace(/\s+([.,!?:;])/g, '$1') : b.join(' → ');
  }
  /* Paren i en matchning som text: "atom ↔ minsta delen". */
  function parText(par) {
    return (par || []).map(p => String(p[0]) + ' ↔ ' + String(p[1])).join(' · ');
  }

  /* ============================================================
     SPELAREN
     En nivå i helskärm, en uppgift i taget, med tummen. Frågorna kommer
     från niva_starta() utan facit; varje svar går till niva_svara(),
     som rättar det och säger hur många XP det gav. Fel svar kommer
     tillbaka sist, tills allt är rätt.

     o: { supa, niva, elev, katalog, forsok, uppgifter, pågående, läge,
          hämtaLäge() → Promise<läge|null>, onStäng({ ändrat, klar, oppen }) }
     ============================================================ */
  let öppenSpelare = null;

  function spela(o) {
    if (öppenSpelare) return;
    const supa = o.supa;
    const rot = document.createElement('div');
    rot.className = 'upg-spel';
    rot.setAttribute('role', 'dialog');
    rot.setAttribute('aria-modal', 'true');
    rot.innerHTML =
      '<div class="upg-spel-ram">'
      + '<div class="upg-spel-topp">'
      + '<button type="button" class="upg-spel-stang" data-spel-stang aria-label="Sluta">' + IKON.kryss + '</button>'
      + '<span class="upg-spel-mat" role="progressbar" aria-label="Rätt besvarade uppgifter" aria-valuemin="0"><i></i></span>'
      + '<span class="upg-spel-tal" aria-hidden="true"></span>'
      + '<button type="button" class="upg-spel-textknapp" data-spel-text hidden aria-label="Visa texten">' + IKON.bok + '</button>'
      + '<span class="upg-spel-xp" aria-live="polite" hidden></span>'
      + ljudKnapp()
      + '</div>'
      + '<div class="upg-spel-kropp"></div>'
      + '<div class="upg-spel-fot">'
      + '<div class="upg-besked" aria-live="polite"></div>'
      + '<div class="upg-spel-knappar"></div>'
      + '</div></div>';

    const kropp = rot.querySelector('.upg-spel-kropp');
    const besked = rot.querySelector('.upg-besked');
    const knappar = rot.querySelector('.upg-spel-knappar');
    const mätare = rot.querySelector('.upg-spel-mat');
    const talEl = rot.querySelector('.upg-spel-tal');
    const xpEl = rot.querySelector('.upg-spel-xp');
    const textKnapp = rot.querySelector('[data-spel-text]');

    let T = null;
    let ändrat = false;
    let stänger = false;
    /* Rätt i rad i den här spelaren, över nivåerna man går vidare till.
       Ett fel nollar. Bara för stunden: det sparas inte och räknas inte
       (uppdragens rad räknas av databasen ur svaren). */
    let iRad = 0;
    /* Ljuden i resultatet kommer i takt med stjärnorna. Stängs spelaren
       eller startas en ny omgång tystnar det som inte hunnit spelas. */
    let timrar = [];
    const senare = (ms, fn) => { timrar.push(setTimeout(() => { if (öppenSpelare === rot) fn(); }, ms)); };
    const tysta = () => { timrar.forEach(clearTimeout); timrar = []; };
    let senastKlar = null, senastÖppnad = null;
    let forsok = (o.forsok || []).slice();
    const märkenFöre = new Set(märken(underlag({ katalog: o.katalog, forsok, uppgifter: o.uppgifter, läge: o.läge }))
      .filter(m => m.klart).map(m => m.id));

    /* ---------- in och ut ---------- */
    const bakom = Array.from(document.body.children).filter(el => el !== rot && !el.inert);
    const fokusFöre = document.activeElement;
    document.body.appendChild(rot);
    bakom.forEach(el => { el.inert = true; });
    document.documentElement.classList.add('upg-spelar');
    void rot.offsetWidth;
    rot.classList.add('open');
    öppenSpelare = rot;

    /* Bakåtknappen på en telefon ska stänga nivån, inte lämna sidan.
       Ett eget steg i historiken, med samma adress: sidomenyn lyssnar
       på hashchange och märker ingenting. */
    let historik = false;
    try { history.pushState({ upgSpel: true }, '', location.href); historik = true; } catch (e) { /* inbäddad */ }
    window.addEventListener('popstate', påBakåt);

    function mittINivån() {
      return T && T.data && !T.resultat && T.svarade > 0;
    }

    async function påBakåt() {
      if (stänger) { städa(); return; }
      historik = false;
      if (T && T.textÖppen) { stängText(); try { history.pushState({ upgSpel: true }, '', location.href); historik = true; } catch (e) { /* inbäddad */ } return; }
      if (mittINivån() && !(await frågaOmSluta())) {
        try { history.pushState({ upgSpel: true }, '', location.href); historik = true; } catch (e) { /* inbäddad */ }
        return;
      }
      städa();
    }

    function frågaOmSluta() {
      return NXStudie.bekräfta({
        titel: 'Sluta nu?',
        text: 'Det du svarat är sparat. Börjar du nivån igen i dag fortsätter du där du slutade.',
        knapp: 'Sluta', avbryt: 'Fortsätt öva'
      });
    }

    async function stäng() {
      if (mittINivån() && !(await frågaOmSluta())) return;
      if (historik && history.state && history.state.upgSpel) {
        stänger = true;
        history.back();
        /* Kommer popstate inte (en inbäddad vy utan historik) städas
           det ändå. */
        setTimeout(() => { if (öppenSpelare === rot) städa(); }, 400);
      } else {
        städa();
      }
    }

    function städa() {
      if (öppenSpelare !== rot) return;
      tysta();
      öppenSpelare = null;
      window.removeEventListener('popstate', påBakåt);
      document.removeEventListener('keydown', tangent);
      bakom.forEach(el => { el.inert = false; });
      document.documentElement.classList.remove('upg-spelar');
      rot.remove();
      if (fokusFöre && fokusFöre.isConnected && fokusFöre.focus) fokusFöre.focus({ preventScroll: true });
      if (typeof o.onStäng === 'function') o.onStäng({ ändrat, klar: senastKlar, oppen: senastÖppnad });
    }

    /* Ett drag med en bricka följs av ett klick på samma bricka. Det
       klicket ska inte också flytta den. */
    let draSlut = 0;
    /* Safari och Chrome släpper fram ljud först efter ett tryck: det
       väcks här, så att det är igång när svaret kommer tillbaka. */
    rot.addEventListener('pointerdown', () => { if (typeof NXLjud !== 'undefined' && NXLjud) NXLjud.väck(); }, { passive: true });
    rot.addEventListener('click', e => {
      if (e.target.closest('[data-spel-stang]')) { stäng(); return; }
      if (e.target.closest('[data-spel-text]')) { T && T.textÖppen ? stängText() : visaText(); return; }
      if (e.target.closest('[data-text-stang]')) { stängText(); return; }
      const felÖppna = e.target.closest('[data-fel-oppna]');
      if (felÖppna) { visaFelval(felÖppna.closest('.upg-felrapport')); return; }
      const felSort = e.target.closest('[data-fel-sort]');
      if (felSort) { skickaFel(felSort); return; }
      if (Date.now() - draSlut < 350) return;
      const alt = e.target.closest('[data-alt]');
      if (alt && T && T.läge === 'svara') { väljAlt(Number(alt.dataset.alt)); return; }
      const bricka = e.target.closest('[data-bricka]');
      if (bricka && T && T.läge === 'svara') { flyttaBricka(Number(bricka.dataset.bricka)); return; }
      const par = e.target.closest('[data-par]');
      if (par && T && T.läge === 'svara') { väljPar(par.dataset.par, Number(par.dataset.i)); return; }
      const k = e.target.closest('[data-spel]');
      if (!k) return;
      const vad = k.dataset.spel;
      if (vad === 'kolla') kolla();
      else if (vad === 'vidare') vidare();
      else if (vad === 'last') börjaFrågorna();
      else if (vad === 'igen') starta(T.niva);
      else if (vad === 'nasta' && T.nästa) starta(T.nästa);
      else if (vad === 'klar') stäng();
      else if (vad === 'forsok-igen') kolla();
    });
    rot.addEventListener('input', e => {
      if (e.target.matches('.upg-skriv') && T) {
        T.svar = e.target.value;
        sättKnapp();
      }
    });
    function tangent(e) {
      if (!T || öppenSpelare !== rot || document.querySelector('.nx-fraga')) return;
      if (e.key === 'Escape') { e.preventDefault(); if (T.textÖppen) stängText(); else stäng(); return; }
      if (e.key === 'Enter') {
        /* Enter på ett alternativ eller en bricka väljer den, som en
           knapp ska. Annars skickade Enter in det förra valet. */
        if (e.target && e.target.closest && e.target.closest('.upg-alt, .upg-bricka, .upg-par-knapp, [data-spel-stang], [data-spel-text]')) return;
        const k = knappar.querySelector('.btn-primary:not(:disabled)');
        if (k) { e.preventDefault(); k.click(); }
        return;
      }
      if (T.läge === 'svara' && T.fråga && T.fråga.typ === 'val' && /^[1-5]$/.test(e.key)
          && !(e.target && e.target.matches && e.target.matches('input'))) {
        const i = Number(e.key) - 1;
        if (T.ordning && i < T.ordning.length) väljAlt(T.ordning[i]);
      }
    }
    document.addEventListener('keydown', tangent);

    /* ---------- lästexten ---------- */
    function textHtml(t) {
      return String(t || '').split(/\n\s*\n/).map(s => '<p>' + esc(s.trim()) + '</p>').join('');
    }
    function visaText() {
      if (!T || !T.lastext || T.textÖppen) return;
      T.textÖppen = true;
      const ark = document.createElement('div');
      ark.className = 'upg-textark';
      ark.setAttribute('role', 'dialog');
      ark.setAttribute('aria-label', 'Texten');
      ark.innerHTML = '<div class="upg-textark-box"><div class="upg-textark-topp"><b>Texten</b>'
        + '<button type="button" class="upg-spel-stang" data-text-stang aria-label="Stäng texten">' + IKON.kryss + '</button></div>'
        + '<div class="upg-textark-inne upg-lastext">' + textHtml(T.lastext) + '</div></div>';
      rot.appendChild(ark);
      void ark.offsetWidth;
      ark.classList.add('open');
      textKnapp.setAttribute('aria-pressed', 'true');
      const s = ark.querySelector('[data-text-stang]');
      if (s) s.focus({ preventScroll: true });
    }
    function stängText() {
      if (!T) return;
      T.textÖppen = false;
      const ark = rot.querySelector('.upg-textark');
      if (ark) ark.remove();
      textKnapp.setAttribute('aria-pressed', 'false');
      textKnapp.focus({ preventScroll: true });
    }

    /* ---------- en nivå ---------- */
    async function starta(niva) {
      tysta();
      const förraKonfetti = rot.querySelector('.upg-konfetti');
      if (förraKonfetti) förraKonfetti.remove();
      T = { niva, data: null, kö: [], klara: 0, total: 0, svarade: 0, fråga: null, svar: null, ordning: null,
            läge: 'hämtar', resultat: null, start: Date.now(), nästa: null, xp: 0, lastext: null, textÖppen: false };
      rot.setAttribute('aria-label', stegTitel(niva));
      besked.className = 'upg-besked';
      besked.innerHTML = '';
      knappar.innerHTML = '';
      kropp.innerHTML = '<div class="upg-spel-laddar"><b>' + esc(stegTitel(niva)) + '</b><span>Hämtar uppgifterna</span></div>';
      mätare.firstChild.style.width = '0%';
      talEl.textContent = '';
      xpEl.hidden = true;
      xpEl.textContent = '';
      textKnapp.hidden = true;
      const ark = rot.querySelector('.upg-textark');
      if (ark) ark.remove();

      const { data, error } = await supa.rpc('niva_starta', { p_niva: niva.id, p_elev: o.elev });
      if (öppenSpelare !== rot) return;
      if (error) {
        kropp.innerHTML = '<div class="upg-spel-fel"><b>' + esc(niva.sort === 'repetition' ? 'Repetitionen gick inte att starta' : 'Nivån gick inte att starta')
          + '</b><p>' + esc(NX.felText(error)) + '</p></div>';
        knappar.innerHTML = '<button type="button" class="btn btn-primary btn-block" data-spel="klar">Stäng</button>';
        return;
      }
      ändrat = true;
      T.data = data;
      T.lastext = (data.niva && data.niva.lastext) || niva.lastext || null;
      const klara = new Set(data.klara || []);
      T.total = (data.fragor || []).length;
      T.klara = klara.size;
      T.svarade = klara.size;
      T.kö = (data.fragor || []).filter(f => !klara.has(f.id));
      uppdateraMätare();
      if (!T.kö.length) {
        kropp.innerHTML = '<div class="upg-spel-fel"><b>Den här nivån är redan klar</b><p>Stäng och starta den igen för en ny omgång.</p></div>';
        knappar.innerHTML = '<button type="button" class="btn btn-primary btn-block" data-spel="klar">Stäng</button>';
        return;
      }
      if (T.lastext) {
        textKnapp.hidden = false;
        T.läge = 'läser';
        kropp.innerHTML = '<div class="upg-las">'
          + '<p class="upg-fraga-typ">Läs texten</p>'
          + '<h2 class="upg-fraga-text" tabindex="-1">' + esc(niva.titel) + '</h2>'
          + '<div class="upg-lastext">' + textHtml(T.lastext) + '</div>'
          + '<p class="upg-las-not">' + IKON.bok + 'Texten finns kvar under frågorna, bakom knappen med boken.</p></div>';
        knappar.innerHTML = '<button type="button" class="btn btn-primary btn-block" data-spel="last">'
          + (T.klara ? 'Fortsätt med frågorna' : 'Till frågorna') + '</button>';
        const h = kropp.querySelector('h2');
        if (h) h.focus({ preventScroll: true });
        kropp.scrollTop = 0;
        return;
      }
      nästaFråga();
    }

    function börjaFrågorna() {
      if (!T || T.läge !== 'läser') return;
      nästaFråga();
    }

    function uppdateraMätare() {
      const andel = T.total ? T.klara / T.total : 0;
      mätare.firstChild.style.width = Math.round(andel * 100) + '%';
      mätare.setAttribute('aria-valuemax', String(T.total));
      mätare.setAttribute('aria-valuenow', String(T.klara));
      talEl.textContent = T.total ? T.klara + '/' + T.total : '';
    }

    function nästaFråga() {
      T.fråga = T.kö.shift();
      T.svar = null;
      T.brickor = null;
      T.par = null;
      T.läge = 'svara';
      besked.className = 'upg-besked';
      besked.innerHTML = '';
      rot.classList.remove('ratt', 'fel');
      ritaFråga();
      sättKnapp();
    }

    function blandat(n) {
      const a = Array.from({ length: n }, (_, i) => i);
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    function ritaFråga() {
      const f = T.fråga;
      let svar = '';
      if (ärSant(f)) {
        /* Sant eller falskt: två stora knappar, alltid Sant till vänster. */
        T.ordning = [0, 1];
        svar = '<div class="upg-sant" role="group" aria-label="Sant eller falskt">'
          + '<button type="button" class="upg-alt upg-sant-ja" data-alt="0" aria-pressed="false">' + IKON.bock + '<span>Sant</span></button>'
          + '<button type="button" class="upg-alt upg-sant-nej" data-alt="1" aria-pressed="false">' + IKON.kryss + '<span>Falskt</span></button>'
          + '</div>';
      } else if (f.typ === 'val') {
        T.ordning = blandat((f.alternativ || []).length);
        svar = '<div class="upg-val" role="group" aria-label="Svarsalternativ">' + T.ordning.map((i, nr) =>
          '<button type="button" class="upg-alt" data-alt="' + i + '" aria-pressed="false">'
          + '<span class="upg-alt-nr" aria-hidden="true">' + (nr + 1) + '</span>'
          + '<span>' + esc(f.alternativ[i]) + '</span></button>').join('') + '</div>';
      } else if (f.typ === 'skriv') {
        svar = '<input class="upg-skriv inp" type="text" autocomplete="off" autocapitalize="off" autocorrect="off"'
          + ' spellcheck="false" enterkeyhint="done" maxlength="200" aria-label="Ditt svar" placeholder="Ditt svar"'
          + (f.numerisk ? ' inputmode="decimal"' : '') + '>';
      } else if (f.typ === 'para') {
        /* Matchning: vänstersidan i ordning, högersidan blandad av
           databasen. Ett par får ett nummer och en ton på båda sidor,
           så att det syns utan att färgen bär det ensam. */
        T.par = { v: (f.vanster || []).slice(), h: (f.hoger || []).slice(), till: {}, vald: null };
        svar = '<div class="upg-para" role="group" aria-label="Para ihop">'
          + '<div class="upg-para-kol" aria-label="Vänster">' + T.par.v.map((t, i) =>
            '<button type="button" class="upg-par-knapp" data-par="v" data-i="' + i + '" aria-pressed="false">'
            + '<span class="upg-par-nr" aria-hidden="true"></span><span class="upg-par-text">' + esc(t) + '</span></button>').join('') + '</div>'
          + '<div class="upg-para-kol" aria-label="Höger">' + T.par.h.map((t, i) =>
            '<button type="button" class="upg-par-knapp" data-par="h" data-i="' + i + '" aria-pressed="false">'
            + '<span class="upg-par-nr" aria-hidden="true"></span><span class="upg-par-text">' + esc(t) + '</span></button>').join('') + '</div>'
          + '</div><p class="upg-para-not">Tryck på en ruta till vänster och sedan på den som hör ihop med den till höger.</p>';
      } else {
        T.brickor = (f.brickor || []).map((text, i) => ({ i, text, lagd: false }));
        T.rad = [];
        svar = '<div class="upg-rad" aria-label="Ditt svar"></div>'
          + '<div class="upg-brickor" role="group" aria-label="Brickor">' + T.brickor.map(b =>
            '<button type="button" class="upg-bricka" data-bricka="' + b.i + '">' + esc(b.text) + '</button>').join('') + '</div>'
          + '<p class="upg-para-not">Tryck på brickorna i rätt ordning, eller dra dem dit.</p>';
      }
      kropp.innerHTML = '<div class="upg-fraga">'
        + '<p class="upg-fraga-typ">' + esc(typText(f)) + '</p>'
        + '<h2 class="upg-fraga-text" tabindex="-1">' + frågaHtml(f.fraga) + '</h2>'
        + svar + '</div>';
      kropp.scrollTop = 0;
      const rubrik = kropp.querySelector('.upg-fraga-text');
      const fält = kropp.querySelector('.upg-skriv');
      /* Tangentbordet fälls upp direkt för en skrivfråga på en dator,
         men inte på en telefon: där skjuter det frågan ur bild innan
         man hunnit läsa den. */
      if (fält && window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches) fält.focus();
      else if (rubrik) rubrik.focus({ preventScroll: true });
    }

    function väljAlt(i) {
      if (T.svar !== i) känn('val');
      T.svar = i;
      kropp.querySelectorAll('.upg-alt').forEach(b => b.setAttribute('aria-pressed', Number(b.dataset.alt) === i ? 'true' : 'false'));
      sättKnapp();
    }

    /* ---------- matchningen ---------- */
    /* Ett tryck på en parad ruta löser upp paret. Annars väljs rutan,
       och ett tryck på en ruta på andra sidan gör ett par av dem, åt
       vilket håll man än börjar. */
    function väljPar(sida, i) {
      const P = T.par;
      if (!P) return;
      känn('val');
      const vIPar = sida === 'v' ? (i in P.till ? i : null)
        : Object.keys(P.till).map(Number).find(k => P.till[k] === i);
      if (vIPar !== null && vIPar !== undefined) {
        delete P.till[vIPar];
        P.vald = null;
      } else if (!P.vald || P.vald.sida === sida) {
        P.vald = P.vald && P.vald.sida === sida && P.vald.i === i ? null : { sida, i };
      } else {
        P.till[sida === 'v' ? i : P.vald.i] = sida === 'h' ? i : P.vald.i;
        P.vald = null;
      }
      ritaPar();
      T.svar = Object.keys(P.till).length === P.v.length ? P.v.map((_, k) => P.h[P.till[k]]) : null;
      sättKnapp();
    }
    function ritaPar() {
      const P = T.par;
      const nummer = {};
      Object.keys(P.till).map(Number).sort((a, b) => a - b).forEach((v, n) => { nummer['v' + v] = n + 1; nummer['h' + P.till[v]] = n + 1; });
      kropp.querySelectorAll('.upg-par-knapp').forEach(b => {
        const nr = nummer[b.dataset.par + b.dataset.i];
        const vald = !!(P.vald && P.vald.sida === b.dataset.par && P.vald.i === Number(b.dataset.i));
        b.classList.toggle('parad', !!nr);
        b.classList.toggle('vald', vald);
        b.dataset.ton = nr ? String((nr - 1) % 6 + 1) : '';
        b.setAttribute('aria-pressed', vald || nr ? 'true' : 'false');
        b.querySelector('.upg-par-nr').textContent = nr ? String(nr) : '';
        b.setAttribute('aria-label', b.querySelector('.upg-par-text').textContent + (nr ? ', par ' + nr : vald ? ', vald' : ''));
      });
    }

    /* ---------- brickorna ----------
       En bricka flyttas mellan banken och raden med ett tryck, eller
       dras dit. I banken lämnar den en tom plats efter sig: brickorna
       under ska inte hoppa när man tar en, för det är nästa man ska
       trycka på. */
    function flyttaBricka(i, till) {
      const b = T.brickor[i];
      if (!b) return;
      känn('val');
      if (till === undefined) {
        b.lagd = !b.lagd;
        if (b.lagd) T.rad.push(i); else T.rad = T.rad.filter(x => x !== i);
      } else {
        T.rad = T.rad.filter(x => x !== i);
        if (till === null) { b.lagd = false; }
        else { b.lagd = true; T.rad.splice(Math.max(0, Math.min(till, T.rad.length)), 0, i); }
      }
      ritaBrickor();
    }
    function ritaBrickor() {
      const rad = kropp.querySelector('.upg-rad');
      if (!rad) return;
      rad.innerHTML = T.rad.map(x =>
        '<button type="button" class="upg-bricka" data-bricka="' + x + '">' + esc(T.brickor[x].text) + '</button>').join('');
      kropp.querySelectorAll('.upg-brickor .upg-bricka').forEach(k => {
        const lagd = T.brickor[Number(k.dataset.bricka)].lagd;
        k.classList.toggle('lagd', lagd);
        k.disabled = lagd;
        k.setAttribute('aria-hidden', lagd ? 'true' : 'false');
      });
      T.svar = T.rad.length ? T.rad.map(x => T.brickor[x].text) : null;
      sättKnapp();
    }

    /* Dra och släpp. Ett drag börjar först när fingret rört sig: ett
       tryck utan rörelse är ett klick, som förut. Spöket följer
       fingret med transform och ritas ovanpå allt; raden visar var
       brickan hamnar med ett streck. Ingen HTML5-drag: den finns inte
       på en telefon. */
    let drag = null;
    rot.addEventListener('pointerdown', e => {
      const b = e.target.closest('.upg-bricka');
      if (!b || !T || T.läge !== 'svara' || !T.brickor || b.disabled || e.button > 0) return;
      drag = { b, i: Number(b.dataset.bricka), x: e.clientX, y: e.clientY, id: e.pointerId, igång: false, spöke: null, streck: null, till: null };
    });
    rot.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.igång) {
        if (Math.hypot(dx, dy) < 8) return;
        drag.igång = true;
        const r = drag.b.getBoundingClientRect();
        drag.dx = drag.x - r.left; drag.dy = drag.y - r.top;
        drag.spöke = drag.b.cloneNode(true);
        drag.spöke.className = 'upg-bricka upg-spoke';
        drag.spöke.style.width = r.width + 'px';
        rot.appendChild(drag.spöke);
        drag.b.classList.add('drar');
        try { drag.b.setPointerCapture(e.pointerId); } catch (x) { /* äldre webbläsare */ }
      }
      e.preventDefault();
      drag.spöke.style.transform = 'translate(' + (e.clientX - drag.dx) + 'px,' + (e.clientY - drag.dy) + 'px)';
      dragMål(e.clientX, e.clientY);
    });
    function dragMål(x, y) {
      const rad = kropp.querySelector('.upg-rad');
      if (!rad) return;
      const r = rad.getBoundingClientRect();
      const iRaden = y >= r.top - 30 && y <= r.bottom + 30 && x >= r.left - 20 && x <= r.right + 20;
      if (!iRaden) { drag.till = null; if (drag.streck) { drag.streck.remove(); drag.streck = null; } return; }
      const brickor = Array.from(rad.querySelectorAll('.upg-bricka')).filter(k => Number(k.dataset.bricka) !== drag.i);
      let plats = brickor.length;
      for (let k = 0; k < brickor.length; k++) {
        const br = brickor[k].getBoundingClientRect();
        const sammaRad = y >= br.top - 6 && y <= br.bottom + 6;
        if ((sammaRad && x < br.left + br.width / 2) || y < br.top - 6) { plats = k; break; }
      }
      drag.till = plats;
      if (!drag.streck) { drag.streck = document.createElement('span'); drag.streck.className = 'upg-infoga'; drag.streck.setAttribute('aria-hidden', 'true'); }
      const före = brickor[plats];
      if (före) rad.insertBefore(drag.streck, före); else rad.appendChild(drag.streck);
    }
    function slutaDra(e, avbryt) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const d = drag;
      drag = null;
      if (!d.igång) return;
      draSlut = Date.now();
      if (d.spöke) d.spöke.remove();
      if (d.streck) d.streck.remove();
      d.b.classList.remove('drar');
      if (avbryt) return;
      if (d.till !== null) {
        /* Platsen räknades bland de ANDRA brickorna i raden, och det är
           bland dem flyttaBricka sätter in den. */
        flyttaBricka(d.i, d.till);
      } else if (d.b.closest('.upg-rad')) {
        flyttaBricka(d.i, null);
      }
    }
    rot.addEventListener('pointerup', e => slutaDra(e, false));
    rot.addEventListener('pointercancel', e => slutaDra(e, true));

    function harSvar() {
      if (!T.fråga) return false;
      if (T.fråga.typ === 'skriv') return !!(T.svar && String(T.svar).trim());
      return T.svar !== null && T.svar !== undefined;
    }

    function sättKnapp() {
      if (T.läge === 'svara') {
        knappar.innerHTML = '<button type="button" class="btn btn-primary btn-block upg-kolla" data-spel="kolla"'
          + (harSvar() ? '' : ' disabled') + '>Kontrollera</button>';
      }
    }

    async function kolla() {
      if (T.läge !== 'svara' && T.läge !== 'nätfel') return;
      if (!harSvar()) return;
      const f = T.fråga;
      const p_svar = f.typ === 'val' ? { val: T.svar }
        : f.typ === 'skriv' ? { text: String(T.svar).trim() }
        : f.typ === 'para' ? { par: T.svar }
        : { ordning: T.svar };
      T.läge = 'rättar';
      const knapp = knappar.querySelector('button');
      if (knapp) { knapp.setAttribute('aria-busy', 'true'); knapp.textContent = 'Rättar…'; }
      kropp.querySelectorAll('button, input').forEach(el => { el.disabled = true; });

      const { data, error } = await supa.rpc('niva_svara', { p_forsok: T.data.forsok, p_fraga: f.id, p_svar });
      if (öppenSpelare !== rot) return;
      if (error) {
        /* Svaret står kvar, och samma tryck skickar det igen. Går det
           fram två gånger ger databasen samma besked utan en ny rad. */
        T.läge = 'nätfel';
        besked.className = 'upg-besked natfel';
        besked.innerHTML = '<b>Svaret kom inte fram</b><p>' + esc(NX.felText(error)) + '</p>';
        knappar.innerHTML = '<button type="button" class="btn btn-primary btn-block" data-spel="forsok-igen">Försök igen</button>';
        return;
      }
      T.svarade++;
      visaBesked(f, data);
    }

    function facitText(f, facit) {
      if (f.typ === 'val') return f.alternativ[Number(facit)] || '';
      if (f.typ === 'ordna') return brickText(facit);
      if (f.typ === 'para') return parText(facit);
      return String(facit || '');
    }

    function visaBesked(f, svar) {
      T.läge = 'besked';
      const rätt = !!svar.ratt;
      const xp = Number(svar.xp) || 0;
      if (rätt) T.klara++;
      else T.kö.push(f);
      iRad = rätt ? iRad + 1 : 0;
      uppdateraMätare();
      rot.classList.toggle('ratt', rätt);
      rot.classList.toggle('fel', !rätt);
      rot.classList.toggle('het', iRad >= 3);
      känn(rätt ? 'ratt' : 'fel', { rad: iRad });
      /* Fel: frågan skakar en gång. Klassen tas bort efteråt, så att
         nästa fel skakar igen. */
      const kort = kropp.querySelector('.upg-fraga');
      if (kort && !rätt) {
        kort.classList.remove('skaka');
        void kort.offsetWidth;
        kort.classList.add('skaka');
      }

      /* Svaret som gavs står kvar i frågan, markerat. */
      if (f.typ === 'val') {
        kropp.querySelectorAll('.upg-alt').forEach(b => {
          const i = Number(b.dataset.alt);
          if (i === Number(svar.facit)) b.classList.add('ar-ratt');
          else if (i === T.svar) b.classList.add('ar-fel');
        });
      } else if (f.typ === 'skriv') {
        const fält = kropp.querySelector('.upg-skriv');
        if (fält) fält.classList.add(rätt ? 'ar-ratt' : 'ar-fel');
      } else if (f.typ === 'para') {
        const ska = {};
        (svar.facit || []).forEach(p => { ska[p[0]] = p[1]; });
        kropp.querySelectorAll('.upg-par-knapp[data-par="v"]').forEach(b => {
          const i = Number(b.dataset.i);
          const gav = T.par.h[T.par.till[i]];
          b.classList.add(gav === ska[T.par.v[i]] ? 'ar-ratt' : 'ar-fel');
        });
      } else {
        const rad = kropp.querySelector('.upg-rad');
        if (rad) rad.classList.add(rätt ? 'ar-ratt' : 'ar-fel');
      }

      if (xp) {
        T.xp += xp;
        xpEl.hidden = false;
        xpEl.innerHTML = IKON.blixt + '<span>+' + tusen(T.xp) + '</span>';
        xpEl.classList.remove('studs');
        void xpEl.offsetWidth;
        xpEl.classList.add('studs');
      }

      const heja = RAD_HEJA[iRad] || HEJA[Math.floor(Math.random() * HEJA.length)];
      besked.className = 'upg-besked ' + (rätt ? 'ratt' : 'fel');
      besked.innerHTML = '<div class="upg-besked-topp"><span class="upg-besked-ikon">' + (rätt ? IKON.bock : IKON.kryss)
        + (rätt ? '<span class="upg-gnistor" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>' : '') + '</span>'
        + '<b>' + esc(rätt ? heja : 'Inte riktigt') + '</b>'
        + (rätt && iRad >= 3 ? '<span class="upg-rad-chip" aria-label="' + iRad + ' rätt i rad">' + IKON.låga + iRad + ' i rad</span>' : '')
        + (xp ? '<span class="upg-besked-xp">+' + xp + ' XP</span>' : '') + '</div>'
        + (!rätt ? '<p class="upg-besked-facit">Rätt svar: <span>' + esc(facitText(f, svar.facit)) + '</span></p>' : '')
        + (svar.forklaring ? '<p class="upg-besked-varfor">' + esc(svar.forklaring) + '</p>' : '')
        + (!rätt ? '<p class="upg-besked-igen">Uppgiften kommer tillbaka i slutet.</p>' : '')
        + '<div class="upg-felrapport" data-fel-fraga="' + esc(f.id) + '">'
          + '<button type="button" class="upg-lank upg-fel-oppna" data-fel-oppna>Fel i frågan?</button></div>';

      if (svar.klar && svar.resultat) T.resultat = svar.resultat;
      knappar.innerHTML = '<button type="button" class="btn btn-primary btn-block" data-spel="vidare">'
        + (T.resultat ? 'Se resultatet' : 'Fortsätt') + '</button>';
      const k = knappar.querySelector('button');
      if (k) k.focus({ preventScroll: true });
    }

    /* Fel i frågan (2026-10-06): fyra skäl och ingen fritext, och
       rapporten bär ingen person (nexlax_felrapporter). Admin ser dem
       under Material. Utan migrationen säger svaret att det inte gick. */
    const FELSKÄL = [['facit', 'Facit är fel'], ['otydlig', 'Frågan är otydlig'],
      ['sprak', 'Stavfel eller språkfel'], ['annat', 'Något annat']];
    function visaFelval(ruta) {
      if (!ruta) return;
      ruta.innerHTML = '<p class="upg-fel-rubrik">Vad är fel i frågan?</p>'
        + '<div class="upg-fel-val" role="group" aria-label="Vad är fel i frågan?">'
        + FELSKÄL.map(([kod, text]) => '<button type="button" class="upg-fel-knapp" data-fel-sort="' + kod + '">'
          + esc(text) + '</button>').join('') + '</div>';
      const första = ruta.querySelector('button');
      if (första) första.focus({ preventScroll: true });
    }
    async function skickaFel(knapp) {
      const ruta = knapp.closest('.upg-felrapport');
      if (!ruta || ruta.dataset.skickar) return;
      ruta.dataset.skickar = '1';
      ruta.querySelectorAll('button').forEach(b => { b.disabled = true; });
      const { error } = await supa.rpc('rapportera_fragefel', { p_fraga: ruta.dataset.felFraga, p_sort: knapp.dataset.felSort });
      ruta.innerHTML = '<p class="upg-fel-tack" role="status">'
        + (error ? 'Det gick inte att skicka just nu. Försök igen senare.' : 'Tack! Vi tittar på frågan.') + '</p>';
    }

    function vidare() {
      if (T.läge !== 'besked') return;
      if (T.resultat) return slut();
      if (!T.kö.length) return slut();
      nästaFråga();
    }

    /* ---------- resultatet ---------- */
    async function slut() {
      T.läge = 'slut';
      rot.classList.remove('ratt', 'fel', 'het');
      besked.className = 'upg-besked';
      besked.innerHTML = '';
      const r = T.resultat || {};
      const stj = Number(r.stjarnor) || 0;
      const nya = Math.max(0, stj - (Number(r.forut) || 0));
      const sek = Math.round((Date.now() - T.start) / 1000);
      const tid = Math.floor(sek / 60) + ':' + String(sek % 60).padStart(2, '0');
      const mästare = T.niva.sort === 'mastare';

      /* Försöket läggs till lokalt, så att märkena och nästa steg räknas
         på det som just hände. Vyn hämtar om allt när spelaren stängs.
         Vägen före jämförs mot försöken i DEN HÄR spelaren, inte vyns:
         efter "Nästa" har vyn inte sett nivån före. En nivå i
         NP-sektionen jämförs mot sektionen, inte mot vägen. */
      const förut = forsok;
      forsok = forsok.concat([{ id: T.data.forsok, niva_id: T.niva.id, startad_at: new Date(T.start).toISOString(),
        klar_at: r.klar_at || new Date().toISOString(), antal: r.antal, ratt_direkt: r.ratt_direkt,
        stjarnor: stj, godkand: !!r.godkand }]);

      const npNivå = ärNp(efterId(o.katalog)[T.niva.id] || T.niva);
      const spåret = npNivå ? npSpår : vägen;
      const tomt = { områden: [], steg: [], helaKlar: false, aktuell: null };
      const bana = f => spåret({ katalog: o.katalog, amne: T.niva.amne, arskurs: T.niva.arskurs, forsok: f, uppgifter: o.uppgifter }) || tomt;
      const vägFöre = bana(förut);
      const väg = bana(forsok);
      const öppnaFöre = new Set(vägFöre.steg.filter(x => x.öppen).map(x => x.niva.id));
      const nyöppnad = npNivå ? väg.steg.find(x => x.sort === 'mastare' && x.öppen && !x.klar && !öppnaFöre.has(x.niva.id))
        : väg.steg.find(x => x.öppen && !x.klar && !öppnaFöre.has(x.niva.id) && x.niva.id !== T.niva.id);
      const omr = väg.områden.find(a => a.nivåer.some(x => x.niva.id === T.niva.id) || (a.mästare && a.mästare.niva.id === T.niva.id));
      const omrFöre = vägFöre.områden.find(a => omr && a.namn === omr.namn);
      const omrKlart = !!(omr && omr.klart && omrFöre && !omrFöre.klart);
      const bemästrat = !!(mästare && omr && omr.bemästrat && !(omrFöre && omrFöre.bemästrat));
      const banaKlar = !!(väg.helaKlar && !vägFöre.helaKlar);
      T.nästa = r.godkand ? (nyöppnad ? nyöppnad.niva : (väg.aktuell && väg.aktuell.niva.id !== T.niva.id ? väg.aktuell.niva : null)) : null;
      if (r.godkand) senastKlar = T.niva.id;
      if (nyöppnad) senastÖppnad = nyöppnad.niva.id;

      const xpRader = [
        Number(r.xp_fragor) ? ['Uppgifter', r.xp_fragor] : null,
        Number(r.xp_niva) ? [mästare ? 'Mästarprovet klarat' : T.niva.sort === 'repetition' ? 'Repetitionen klar' : 'Nivån klarad', r.xp_niva] : null,
        Number(r.xp_omrade) ? ['Området ' + (npNivå ? npNamn(T.niva.omrade) : T.niva.omrade) + ' klart', r.xp_omrade] : null
      ].filter(Boolean);
      const xpSumma = xpRader.reduce((s, x) => s + Number(x[1]), 0);
      const harXp = 'xp_fragor' in r;
      /* Märket i toppen räknade det som kom i den här spelaren. En
         omgång som fortsattes hade svar från förut, och nivåns XP kommer
         först nu: märket visar omgångens summa, samma som raden nedanför. */
      if (harXp && xpSumma) {
        xpEl.hidden = false;
        xpEl.innerHTML = IKON.blixt + '<span>+' + tusen(xpSumma) + '</span>';
        xpEl.classList.remove('studs');
        void xpEl.offsetWidth;
        xpEl.classList.add('studs');
      }

      /* Firandet växer med det som klarades: en nivå, ett område, en hel
         bana. Rubriken säger det största. */
      const firande = !r.godkand ? '' : banaKlar ? 'bana' : (omrKlart || bemästrat) ? 'omrade' : 'niva';
      const omrNamn = omr ? (npNivå ? npNamn(omr.namn) : omr.namn) : T.niva.omrade;
      const rubrik = !r.godkand ? 'Nästan!'
        : banaKlar ? (npNivå ? 'Allt inför provet är klart!' : 'Hela banan är klar!')
        : bemästrat ? 'Området är bemästrat!' : omrKlart ? 'Området är klart!'
        : stj === 3 ? 'Allt rätt direkt!' : mästare ? 'Provet klart!' : 'Nivån klar!';
      const fanfar = firande === 'bana'
        ? '<div class="upg-slut-firande bana" data-nl-f="' + ämnesKod(T.niva.amne) + '"><span class="upg-firande-ik">' + IKON.pokal + '</span>'
          + '<div><b>' + esc(npNivå ? 'Du har klarat allt inför provet i ' + banaNamn(T.niva.amne, T.niva.arskurs) : 'Du har klarat hela ' + banaNamn(T.niva.amne, T.niva.arskurs)) + '</b>'
          + '<span>Varje nivå klarad. Gör om dem för fler stjärnor.</span></div></div>'
        : (omrKlart || bemästrat)
          ? '<div class="upg-slut-firande omrade" data-nl-f="' + ämnesKod(T.niva.amne) + '"><span class="upg-firande-ik">' + (bemästrat ? IKON.krona : IKON.flagga) + '</span>'
            + '<div><b>' + esc((bemästrat ? 'Du bemästrar ' : 'Du har klarat ') + omrNamn) + '</b>'
            + '<span>' + esc(bemästrat ? 'Mästarprovet med minst två stjärnor.' : omr && omr.mästare ? 'Mästarprovet är öppet.' : 'Varje nivå i området är klarad.') + '</span></div></div>'
          : '';

      kropp.innerHTML = '<div class="upg-slut' + (r.godkand ? ' klarad' : '') + (firande ? ' fira-' + firande : '') + '">'
        + '<div class="upg-slut-stj">' + [1, 2, 3].map(i =>
            '<i class="' + (i <= stj ? 'tand' : '') + '" style="--i:' + i + '">' + IKON.stjärna + '</i>').join('') + '</div>'
        + '<h2 tabindex="-1">' + esc(rubrik) + '</h2>'
        + '<p class="upg-slut-rad"><b>' + (r.ratt_direkt || 0) + ' av ' + (r.antal || 0) + '</b> rätt på första försöket · ' + esc(tid) + '</p>'
        + fanfar
        + (harXp
            ? '<div class="upg-slut-xp">'
              + (xpRader.length
                  ? xpRader.map(x => '<div><span>' + esc(x[0]) + '</span><b>+' + tusen(x[1]) + ' XP</b></div>').join('')
                    + '<div class="summa"><span>Den här omgången</span><b>' + IKON.blixt + räknare(xpSumma, '+') + ' XP</b></div>'
                  : '<div class="summa"><span>Inga nya XP</span><b>Du kunde redan det här</b></div>')
              + '</div>'
            : '')
        + '<div class="upg-slut-serie" hidden></div>'
        + (r.godkand
            ? (nya ? '<p class="upg-slut-ny">+' + nya + (nya === 1 ? ' ny stjärna' : ' nya stjärnor') + '</p>'
                   : stj < 3 ? '<p class="upg-slut-not">Gör om nivån när du vill. Allt rätt direkt ger tre stjärnor.</p>' : '')
            : '<p class="upg-slut-not">Du behöver minst 60 procent rätt på första försöket för att klara nivån. Försök igen, nu har du sett svaren.</p>')
        + (nyöppnad && !omrKlart ? '<p class="upg-slut-upp">' + IKON.öppetLås + 'Nu är ' + esc(stegTitel(nyöppnad.niva)) + ' öppen.</p>' : '')
        + '<div class="upg-slut-uppdrag" hidden></div>'
        + '<div class="upg-slut-marken" hidden></div>'
        + '</div>';
      const h = kropp.querySelector('h2');
      if (h) h.focus({ preventScroll: true });
      mätare.firstChild.style.width = '100%';

      /* Ljudet och konfettin i takt med stjärnorna (--i · 0,22 s i
         CSS:en). Ett område och en bana får ett eget firande efteråt. */
      if (r.godkand) {
        känn('niva');
        for (let i = 1; i <= stj; i++) senare(160 + i * 220, () => känn('stjarna', { i }));
        if (firande !== 'niva') senare(1150, () => känn(firande));
        if (!lugnt()) {
          rot.insertAdjacentHTML('beforeend', konfettiHtml(firande === 'bana' ? 70 : firande === 'omrade' ? 48 : 28));
          senare(3200, () => { const k = rot.querySelector('.upg-konfetti'); if (k) k.remove(); });
        }
      } else {
        känn('tryck');
      }

      knappar.innerHTML = r.godkand
        ? (T.nästa ? '<button type="button" class="btn btn-primary btn-block" data-spel="nasta">Nästa: ' + esc(stegTitel(T.nästa)) + '</button>' : '')
          + '<button type="button" class="btn ' + (T.nästa ? 'btn-ghost' : 'btn-primary') + ' btn-block" data-spel="klar">Klar</button>'
        : '<button type="button" class="btn btn-primary btn-block" data-spel="igen">Försök igen</button>'
          + '<button type="button" class="btn btn-ghost btn-block" data-spel="klar">Klar för nu</button>';

      /* Serien, uppdragen och märkena efter omgången, ur databasen.
         Kommer de inte står resultatet ändå. */
      const lägeFöre = o.läge;
      let läge = null;
      if (typeof o.hämtaLäge === 'function') {
        try { läge = await o.hämtaLäge(); } catch (e) { läge = null; }
      }
      if (öppenSpelare !== rot || !T || T.läge !== 'slut') return;
      const serie = kropp.querySelector('.upg-slut-serie');
      if (läge && läge.serie && serie) {
        serie.hidden = false;
        serie.innerHTML = '<span class="upg-slut-laga' + (läge.serie.idag ? ' tand' : '') + '">' + IKON.låga + '</span>'
          + '<span><b>' + läge.serie.nu + ' ' + dagarText(läge.serie.nu) + '</b>'
          + '<small>' + esc(läge.serie.idag ? 'Dagens mål är klart · ' + xpText(läge.xp) + ' totalt' : xpText(läge.xp) + ' totalt') + '</small></span>';
      }

      /* Uppdragen som blev klara nu: de som är klara efter och inte var
         det före, enligt databasen. Ett uppdrag som klarades i en annan
         flik syns här också; det är också klart. */
      const nyaUppdrag = nyaKlaraUppdrag(lägeFöre, läge);
      const up = kropp.querySelector('.upg-slut-uppdrag');
      const fördröjning = r.godkand ? 1400 + (firande === 'niva' ? 0 : 900) : 300;
      if (up && (nyaUppdrag.rader.length || nyaUppdrag.kista)) {
        const start = (fördröjning / 1000).toFixed(2) + 's';
        up.hidden = false;
        up.innerHTML = '<p>' + (nyaUppdrag.rader.length === 1 ? 'Uppdrag klart' : nyaUppdrag.rader.length ? 'Uppdrag klara' : 'Dagens uppdrag') + '</p>'
          /* Fördröjningen sätts på raden och kistan själva, där den
             läses (CLAUDE.md avsnitt 3: en custom property ärvs). */
          + (nyaUppdrag.rader.length ? '<ol class="nl-uppdrag-lista">' + nyaUppdrag.rader.map((x, i) =>
              uppdragsRad(x, 'ny').replace('<li class="', '<li style="--i:' + i + ';--start:' + start + '" class="')).join('') + '</ol>' : '')
          + (nyaUppdrag.kista ? '<div class="upg-slut-kista" style="--start:' + start + '">' + kistaHtml(true, true) + '<b>Dagens kista är öppnad!</b>'
              + '<span>Alla tre uppdragen klara. Nya uppdrag i morgon.</span></div>' : '');
        nyaUppdrag.rader.forEach((x, i) => senare(fördröjning + 200 + i * 260, () => känn('uppdrag')));
        if (nyaUppdrag.kista) senare(fördröjning + 300 + nyaUppdrag.rader.length * 260, () => känn('kista'));
      }

      const nuKlara = märken(underlag({ katalog: o.katalog, forsok, uppgifter: o.uppgifter, läge: läge || o.läge }))
        .filter(m => m.klart && !märkenFöre.has(m.id));
      nuKlara.forEach(m => märkenFöre.add(m.id));
      const mk = kropp.querySelector('.upg-slut-marken');
      if (nuKlara.length && mk) {
        mk.hidden = false;
        mk.innerHTML = '<p>' + (nuKlara.length === 1 ? 'Nytt märke' : 'Nya märken') + '</p>'
          + nuKlara.map(m => märkesHtml(m, { nytt: true })).join('');
        senare(fördröjning + 900 + nyaUppdrag.rader.length * 260, () => känn('marke'));
      }
      if (läge) o.läge = läge;
    }

    starta(o.niva);
  }

  /* ============================================================
     GENOMGÅNGEN
     Ett klart försök fråga för fråga: vad som frågades, vad eleven
     svarade (alla svar, i ordning), rätt svar och förklaringen. Det är
     rättningen, och den ser likadan ut hos familjen och studiehjälparen.
     ============================================================ */
  function svarText(q, s) {
    const v = s && s.svar;
    if (!v) return '';
    if (q.typ === 'val') return (q.alternativ || [])[Number(v.val)] || '–';
    if (q.typ === 'skriv') return String(v.text || '');
    if (q.typ === 'para') {
      const vänster = (q.facit || []).map(p => p[0]);
      return (v.par || []).map((h, i) => (vänster[i] || '?') + ' ↔ ' + h).join(' · ');
    }
    return brickText(v.ordning);
  }
  function facitVisning(q) {
    if (q.typ === 'val') return (q.alternativ || [])[Number(q.facit)] || '';
    if (q.typ === 'ordna') return brickText(q.facit);
    if (q.typ === 'para') return parText(q.facit);
    return String(q.facit || '');
  }

  function genomgångHtml(g) {
    const f = g.forsok, n = g.niva;
    return '<div class="upg-genom-huvud">'
      + '<span class="upg-genom-etikett">' + esc([kortÄmne(n.amne), NX.årskursText(n.arskurs), n.omrade].join(' · ')) + '</span>'
      + '<h3 id="upg-genom-t">' + esc(n.titel) + '</h3>'
      + '<p>' + stjärnRad(f.stjarnor) + '<span><b>' + f.ratt_direkt + ' av ' + f.antal + '</b> rätt på första försöket · '
      + esc(NX.datumText(String(f.klar_at).slice(0, 10))) + '</span></p>'
      + '</div>'
      + '<ol class="upg-genom-lista">' + (g.fragor || []).map(q => {
          const svar = q.svar || [];
          const först = svar[0];
          const direkt = !!(först && först.ratt);
          return '<li class="' + (direkt ? 'direkt' : 'efter') + '">'
            + '<p class="upg-genom-fraga"><span class="upg-genom-tecken">' + (direkt ? IKON.bock : IKON.kryss) + '</span><span class="upg-genom-q">' + frågaHtml(q.fraga) + '</span></p>'
            + '<div class="upg-genom-svar">' + svar.map((s, i) =>
                '<span class="' + (s.ratt ? 'ratt' : 'fel') + '"><em>' + (i === 0 ? 'Svar' : 'Sedan') + '</em> ' + esc(svarText(q, s)) + '</span>').join('')
            + '</div>'
            + (!direkt ? '<p class="upg-genom-facit">Rätt svar: <b>' + esc(facitVisning(q)) + '</b></p>' : '')
            + (q.forklaring ? '<p class="upg-genom-varfor">' + esc(q.forklaring) + '</p>' : '')
            + '</li>';
        }).join('') + '</ol>';
  }

  function ruta(innehåll, etikett) {
    const r = document.createElement('div');
    r.className = 'upg-genom';
    r.innerHTML = '<div class="upg-genom-box" role="dialog" aria-modal="true" aria-labelledby="upg-genom-t">'
      + '<button type="button" class="upg-genom-stang" data-genom-stang aria-label="Stäng">' + IKON.kryss + '</button>'
      + '<div class="upg-genom-inne">' + innehåll + '</div></div>';
    const fokus = document.activeElement;
    function stäng() {
      r.remove();
      document.removeEventListener('keydown', tangent);
      document.documentElement.classList.remove('upg-genom-oppen');
      if (fokus && fokus.isConnected && fokus.focus) fokus.focus({ preventScroll: true });
    }
    function tangent(e) { if (e.key === 'Escape') stäng(); }
    r.addEventListener('click', e => {
      if (e.target === r || e.target.closest('[data-genom-stang]')) stäng();
    });
    document.addEventListener('keydown', tangent);
    document.body.appendChild(r);
    document.documentElement.classList.add('upg-genom-oppen');
    void r.offsetWidth;
    r.classList.add('open');
    const k = r.querySelector('[data-genom-stang]');
    if (k) k.focus({ preventScroll: true });
    r.setAttribute('aria-label', etikett || 'Genomgång');
    return { r, stäng, sätt: html => { r.querySelector('.upg-genom-inne').innerHTML = html; } };
  }

  async function genomgång(supa, forsokId) {
    const g = ruta('<div class="loading">Hämtar rättningen</div>', 'Rättningen');
    const { data, error } = await supa.rpc('niva_genomgang', { p_forsok: forsokId });
    if (error) { g.sätt('<div class="empty"><b>Rättningen gick inte att hämta</b><br><span>' + esc(NX.felText(error)) + '</span></div>'); return; }
    g.sätt(genomgångHtml(data));
  }

  /* Studiehjälparens förhandsvisning: frågorna och facit, innan nivån
     ges som uppgift. Läser niva_fragor direkt; bara godkända
     studiehjälpare och admin har en policy där. Ett Mästarprov och en
     repetition har inga egna frågor: de dras när eleven startar, och
     förhandsvisningen säger varifrån. */
  async function förhandsvisa(supa, niva) {
    const g = ruta('<div class="loading">Hämtar frågorna</div>', stegTitel(niva));
    const huvud = '<div class="upg-genom-huvud">'
      + '<span class="upg-genom-etikett">' + esc([kortÄmne(niva.amne), NX.årskursText(niva.arskurs), niva.omrade].join(' · ')) + '</span>'
      + '<h3 id="upg-genom-t">' + esc(stegTitel(niva)) + '</h3>'
      + (niva.beskrivning ? '<p>' + esc(niva.beskrivning) + '</p>' : '')
      + '</div>';
    if (niva.sort === 'mastare' || niva.sort === 'repetition') {
      const katalog = await laddaKatalog(supa) || [];
      const källor = banansSteg(katalog, niva.amne, niva.arskurs)
        .filter(n => n.sort === 'vanlig' && !n.lastext && (niva.sort === 'repetition' || n.omrade === niva.omrade));
      g.sätt(huvud + '<p class="upg-genom-varfor" style="margin-left:0">'
        + esc(niva.sort === 'mastare'
          ? 'Mästarprovet drar högst ' + MÄSTARPROV_MAX + ' uppgifter ur områdets nivåer, i ny ordning varje gång. Klarat med minst två stjärnor är området bemästrat. Uppgifterna dras ur:'
          : 'Repetitionen drar upp till ' + REPETITION_MAX + ' uppgifter eleven senast svarade fel på i banan, och fyller på ur nivåer eleven klarat. Uppgifterna dras ur:')
        + '</p><ol class="upg-genom-lista">' + källor.map(n => '<li class="forhand"><p class="upg-genom-fraga">'
          + esc(n.titel) + '</p><p class="upg-genom-alt">' + esc(n.omrade + ' · ' + (n.antal_fragor || 0) + ' uppgifter') + '</p></li>').join('') + '</ol>');
      return;
    }
    const { data, error } = await supa.from('niva_fragor')
      .select('id, ordning, typ, fraga, alternativ, ratt, forklaring')
      .eq('niva_id', niva.id).eq('aktiv', true).order('ordning');
    if (error) { g.sätt('<div class="empty"><b>Frågorna gick inte att hämta</b><br><span>' + esc(NX.felText(error)) + '</span></div>'); return; }
    const facit = q => q.typ === 'val' ? (q.alternativ || [])[Number(q.ratt)]
      : q.typ === 'skriv' ? (q.ratt || []).join(' eller ')
      : q.typ === 'para' ? parText(q.ratt)
      : brickText(q.ratt);
    g.sätt(huvud
      + (niva.lastext ? '<div class="upg-lastext upg-lastext-forhand">' + String(niva.lastext).split(/\n\s*\n/).map(s => '<p>' + esc(s.trim()) + '</p>').join('') + '</div>' : '')
      + '<ol class="upg-genom-lista">' + (data || []).map(q =>
        '<li class="forhand"><span class="upg-genom-typ">' + esc(typText(q)) + '</span>'
        + '<p class="upg-genom-fraga">' + frågaHtml(q.fraga) + '</p>'
        + (q.typ === 'val' && !ärSant(q) ? '<p class="upg-genom-alt">' + (q.alternativ || []).map(a => esc(a)).join(' · ') + '</p>' : '')
        + (q.typ === 'ordna' && q.alternativ ? '<p class="upg-genom-alt">Extra brickor: ' + q.alternativ.map(a => esc(a)).join(' · ') + '</p>' : '')
        + '<p class="upg-genom-facit">Rätt svar: <b>' + esc(facit(q)) + '</b></p>'
        + (q.forklaring ? '<p class="upg-genom-varfor">' + esc(q.forklaring) + '</p>' : '')
        + '</li>').join('') + '</ol>');
  }

  /* ============================================================
     RADERNA
     ============================================================ */

  /* Resultatet på en digital uppgift, för raden i uppgiftslistan. */
  function uppgiftsResultat(h, forsok) {
    const mina = (forsok || []).filter(f => f.niva_id === h.niva_id && f.klar_at
      && Date.parse(f.klar_at) >= Date.parse(h.created_at || 0));
    if (!mina.length) return '';
    const bäst = mina.reduce((a, f) => (Number(f.stjarnor) || 0) > (Number(a.stjarnor) || 0) ? f : a, mina[0]);
    const först = mina[0];
    return '<div class="upg-resultat">' + stjärnRad(Number(bäst.stjarnor) || 0, 3, 'upg-stj-sm')
      + '<span>' + esc(först.ratt_direkt + ' av ' + först.antal + ' rätt första gången'
        + (mina.length > 1 ? ', ' + mina.length + ' omgångar' : '')) + '</span>'
      + '<button type="button" class="upg-lank" data-upg-genomgang="' + esc(först.id) + '">Se rättningen</button>'
      + '</div>';
  }

  /* Nivån en digital uppgift går ut på, och hur det gått. Samma rad
     hos familjen och studiehjälparen; bara knapparna under skiljer. */
  function digitalRad(h, forsok) {
    const n = h.nivaer;
    if (!n) return '';
    return '<div class="upg-digital">'
      + '<span class="upg-digital-ikon">' + IKON.spela + '</span>'
      + '<span class="upg-digital-text"><b>' + esc(n.titel) + '</b><span>'
      + esc(['Nivå i NexLäx', n.omrade, n.antal_fragor ? n.antal_fragor + ' uppgifter' : ''].filter(Boolean).join(' · '))
      + '</span></span></div>'
      + uppgiftsResultat(h, forsok);
  }

  /* Ett klart försök som rad i listan Rättade nivåer. */
  function försöksRad(f, niva) {
    const n = niva || { titel: 'Nivå', amne: '', omrade: '' };
    return '<div class="upg-forsok-rad" data-nl-f="' + ämnesKod(n.amne) + '">'
      + '<div class="upg-forsok-text"><b>' + esc(stegTitel(n)) + '</b>'
      + '<span>' + (n.amne ? '<em class="nl-amnesmark">' + esc(kortÄmne(n.amne)) + '</em>' : '')
      + esc([n.sort === 'mastare' ? '' : n.omrade, NX.datumText(String(f.klar_at).slice(0, 10))].filter(Boolean).join(' · ')) + '</span></div>'
      + '<div class="upg-forsok-tal">' + stjärnRad(Number(f.stjarnor) || 0, 3, 'upg-stj-sm')
      + '<span>' + esc(f.ratt_direkt + ' av ' + f.antal) + '</span></div>'
      + '<button type="button" class="btn btn-ghost btn-sm" data-upg-genomgang="' + esc(f.id) + '">Se rättningen</button>'
      + '</div>';
  }

  /* Rättningen per område som staplar, med studiehjälparens bedömning
     bredvid när samma område finns där. progress: rader ur
     progress_items. */
  function områdesHtml(katalog, forsok, progress) {
    const rader = perOmråde(katalog, forsok);
    if (!rader.length) return '';
    const bedömd = {};
    (progress || []).forEach(p => { bedömd[(p.subject + '|' + p.area).toLowerCase()] = p; });
    return '<div class="upg-omraden">' + rader.map(r => {
      const andel = r.antal ? Math.round(r.ratt / r.antal * 100) : 0;
      const p = bedömd[(r.amne + '|' + r.omrade).toLowerCase()];
      const nivå = andel >= 80 ? 'hog' : andel >= 60 ? 'mellan' : 'lag';
      return '<div class="upg-omrade" data-nl-f="' + ämnesKod(r.amne) + '">'
        + '<div class="upg-omrade-topp"><b>' + esc(r.omrade) + '</b><span class="nl-amnesmark">' + esc(kortÄmne(r.amne)) + '</span>'
        + '<strong class="' + nivå + '">' + andel + ' %</strong></div>'
        + '<span class="upg-omrade-mat ' + nivå + '" aria-hidden="true"><i style="width:' + andel + '%"></i></span>'
        + '<p>' + esc(r.ratt + ' av ' + r.antal + ' rätt första gången, i ' + r.nivåer + (r.nivåer === 1 ? ' nivå' : ' nivåer')
          + (r.klara < r.nivåer ? ' (' + r.klara + ' klarade)' : '')
          + (p ? '. Studiehjälparens bedömning: ' + NXStudie.stegText(NXStudie.stegFör(p)).toLowerCase() : '') + '.') + '</p>'
        + '</div>';
    }).join('') + '</div>';
  }

  /* En rad om eleven i NexLäx, för studiehjälparen: XP, serien och hur
     många nivåer som är klara. Ur samma nexlax_lage() som familjen ser. */
  function sammanfattning(läge, forsok) {
    const klara = new Set((forsok || []).filter(f => f.godkand).map(f => f.niva_id)).size;
    if (!läge) return klara ? klara + (klara === 1 ? ' nivå klarad' : ' nivåer klarade') : '';
    return [xpText(läge.xp), läge.serie ? läge.serie.nu + ' ' + dagarText(läge.serie.nu) : '',
      klara + (klara === 1 ? ' nivå klarad' : ' nivåer klarade'),
      Number(läge.xp_vecka) ? '+' + xpText(läge.xp_vecka) + ' den här veckan' : ''].filter(Boolean).join(' · ');
  }

  /* ============================================================
     TRYCKEN (2026-10-06)
     Ett tick med ljud och vibration när man trycker på ett steg på
     vägen, ett ämne, en årskurs eller en startknapp, som i Duolingo.
     Och valen för ljudet och vibrationen, var de än står. Lyssnarna
     sitter här och inte i vyerna, så att familjens vy och barnets vy
     beter sig likadant.
     ============================================================ */
  document.addEventListener('click', e => {
    const mål = e.target && e.target.closest ? e.target : null;
    if (!mål) return;
    const ljudval = mål.closest('[data-nl-ljud], [data-spel-ljud]');
    const vibbval = mål.closest('[data-nl-vibb]');
    if ((ljudval || vibbval) && typeof NXLjud !== 'undefined' && NXLjud) {
      if (ljudval) {
        const på = !NXLjud.ljudPå();
        NXLjud.sättLjud(på);
        if (på) NXLjud.spela('val');
      } else {
        const på = !NXLjud.vibrationPå();
        NXLjud.sättVibration(på);
        if (på) NXLjud.vibrera('ratt');
      }
      visaVal();
      return;
    }
    if (mål.closest('.upg-nod-knapp, .nl-amne, .nl-ak-knapp, .nl-spar-knapp, .nl-cta-knapp, [data-nl-starta], [data-lax-starta]')) {
      känn('tryck');
    }
  });

  /* Knapparna för ljudet och vibrationen visar valet, överallt där de står. */
  function visaVal() {
    if (typeof NXLjud === 'undefined' || !NXLjud) return;
    const på = NXLjud.ljudPå();
    document.querySelectorAll('[data-nl-ljud], [data-spel-ljud]').forEach(b => {
      b.setAttribute('aria-pressed', på ? 'true' : 'false');
      const ik = b.querySelector('svg');
      if (ik) ik.outerHTML = på ? IKON.ljudPå : IKON.ljudAv;
    });
    document.querySelectorAll('[data-nl-vibb]').forEach(b => {
      b.setAttribute('aria-pressed', NXLjud.vibrationPå() ? 'true' : 'false');
    });
  }

  return {
    IKON, STJÄRNGRÄNS, BEMÄSTRAD, RANGER, rang, ärNp, harNp, npSpår, uppdragHtml, nyaKlaraUppdrag, ämnesIkon, ämnesOrdning,
    laddaKatalog, laddaFörsök, laddaPågående, laddaLäge, perNivå, banor, förvaldÅrskurs, efterId,
    vägen, nästaSteg, underlag, märken, perOmråde, stjärnRad, stegTitel, xpText, tusen, ärSant,
    ritaVäg, ritaUtveckling, spela, genomgång, förhandsvisa,
    uppgiftsResultat, digitalRad, försöksRad, områdesHtml, sammanfattning
  };
})();
