/* ============================================================
   NEXTRUM — driftkonsolen på Översikt

   Ersätter fotoheron som låg överst i adminvyn och sa hej. Namn och
   roll står redan i sidomenyns fot och i sidhuvudet, så det blocket
   bar ingen information som inte fanns någon annanstans.

   TRE BAND, OCH DE KOSTAR OLIKA MYCKET:

   1. LÄGET läses ur S.lage, alltså vyn admin_lage, som redan är
      hämtad av ritaÖversikt(). Det är en databasvy som räknar på
      ALLA rader, inte bara de hämtningen råkade ta med. Den kostar
      ingenting, är alltid färsk, och ritas vid varje sidladdning.

   2. AGENTEN, alltså NEX som man talar med, körs BARA när någon
      frågar den något. Drift-agenten är
      ett betalt API-anrop med ett stegtak på fjorton steg. Att köra
      den automatiskt vid varje sidladdning hade varit precis den
      räkning som växer medan ingen tittar, vilket är hela skälet
      till att stegtaket finns (se _delad/agent.ts).

   Konsolen bygger alltså ingen egen agent och inget eget anrop: den
   matar NXAgent.stall(), som sköter laddning, vägran, källtvång och
   märkningen av påhittade adresser. En andra väg in till samma agent
   hade varit en andra uppsättning spärrar att hålla i synk.
   ============================================================ */
(function () {
  'use strict';

  const { $, esc } = NX;
  const { S } = NXAdmin;
  const kronor = NXBetalning.kronor;

  /* Frågor som faktiskt går att besvara med drift-agentens nio
     läsande verktyg. Exempel som agenten måste vägra lär bara ut att
     den inte fungerar. */
  const EXEMPEL = [
    'Vad bör jag göra först idag?',
    'Vilka elever har väntat längst på matchning?',
    'Finns det pass nästa vecka utan bekräftad studiehjälpare?',
    'Sammanfatta veckan i siffror.'
  ];

  function ikon(läge) {
    /* Form, inte bara färg. Under deuteranopi ligger grönt och rött
       på nästan samma ljushet, och då är cirkeln kontra romben det
       enda som skiljer en klar rad från en trasig. */
    if (läge === 'problem') return '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1l5 5-5 5-5-5z"/></svg>';
    if (läge === 'vantar') return '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
    return '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5"/></svg>';
  }

  /* En post ur S.problem eller S.attGora blir en rad. Texten byggs
     med samma ental/rubrik-par som blocken under använder, så att
     konsolen och de säger ordagrant samma sak. */
  function rad(p, ärProblem) {
    const text = p.antal === 1 ? p.ental : p.antal + ' ' + p.rubrik;
    return '<a class="kon-rad' + (ärProblem ? ' ar-problem' : '') + '" href="' + esc(p.till) + '">'
      + '<i aria-hidden="true">' + ikon(ärProblem ? 'problem' : 'vantar') + '</i>'
      + '<span>' + esc(text) + '</span>'
      + '<b aria-hidden="true">&#8250;</b></a>';
  }

  function ritaKonsol() {
    const värd = $('#kon-lage');
    const disk = $('#kon-disk');
    if (!värd || !disk) return;

    /* KONSOLEN RÄKNAR INGENTING SJÄLV.

       byggAttGöra() och byggProblem() i nextrum-admin-oversikt.js är
       redan husets definition av "väntar på en människa" respektive
       "har gått fel", och de blocken står direkt under konsolen. En
       egen lista här hade blivit ett tredje tal som säger något annat
       än de två — alltså precis det fel hjältebildens kort en gång
       gjorde, och som står dokumenterat i nextrum-admin.js.

       Summan i disken är de två listorna ihop, och eftersom båda
       syns uppdelade strax under går talet att stämma av med ögat. */
    const problem = S.problem || [];
    const kö = S.attGora || [];
    const summa = problem.concat(kö).reduce((n, p) => n + p.antal, 0);

    const läge = problem.length ? 'problem' : (kö.length ? 'atgard' : 'lugnt');
    /* classList, inte className: en omritning medan NEX tänker hade
       annars slagit bort ar-tanker och stannat ringarna mitt i en
       körning. */
    ['lugnt', 'atgard', 'problem', 'okand'].forEach(k =>
      disk.classList.toggle('ar-' + k, k === läge));
    $('#kon-disk-tal').textContent = String(summa);
    $('#kon-disk-text').textContent =
      läge === 'problem' ? 'kräver åtgärd' : (läge === 'atgard' ? 'väntar på dig' : 'allt lugnt');

    if (!problem.length && !kö.length) {
      värd.innerHTML = '<p class="kon-tom">Ingenting väntar på en människa just nu. '
        + 'Inga förfallna fakturor, inga pass utan rapport, inga obesvarade anmälningar.</p>';
    } else {
      /* Problemen först: det som gått fel är inte samma sak som det
         som väntar, och en lista som blandar dem säger ingenting. */
      värd.innerHTML = problem.map(p => rad(p, true)).join('')
        + kö.map(p => rad(p, false)).join('');
    }

    const l = S.lage;
    if (!l) {
      /* admin_lage saknas — vyn finns inte, eller RLS släppte inte
         igenom den. Beloppsraden tas bort i stället för att visa
         nollor som ser ut som fakta. Listorna ovan räknas lokalt och
         fortsätter stämma. */
      const p = $('#kon-pengar');
      if (p) p.innerHTML = '';
      return;
    }

    /* Obetalt och att betala ut står för sig: de är belopp, inte
       arbetsposter, och hör inte hemma i kön ovanför. */
    const pengar = $('#kon-pengar');
    if (pengar) {
      pengar.innerHTML =
        '<span><b>' + esc(kronor(l.obetalt_ore || 0)) + '</b> utestående</span>'
        + '<span><b>' + esc(kronor(l.att_betala_ut_ore || 0)) + '</b> att betala ut</span>'
        + '<span><b>' + esc(String(l.kommande_pass || 0)) + '</b> kommande pass</span>';
    }
  }

  /* ------------------------------------------------------------
     SAMTALET

     Samma koppling som agentfliken använder (nextrum-admin-agenter.js
     kopplaAgent), men mot ett enda fält och utan körningslogg — den
     som vill se historiken går till Agenter.
     ------------------------------------------------------------ */
  function koppla() {
    const ruta = $('#kon-fraga');
    const ut = $('#kon-ut');
    const knapp = $('#kon-skicka');
    const exempel = $('#kon-exempel');
    if (!ruta || !ut || !knapp) return;

    if (exempel) {
      exempel.innerHTML = EXEMPEL.map(f =>
        '<button class="btn btn-ghost btn-sm" type="button">' + esc(f) + '</button>').join('');
      exempel.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        ruta.value = b.textContent.trim();
        ruta.focus();
      });
    }

    /* NEX rör sig medan den tänker. Klassen sätts runt anropet och tas
       bort i finally: en kastad körning, ett timeout eller en vägran
       ska inte lämna ringarna snurrande i all evighet. */
    async function skicka() {
      if (!ruta.value.trim()) { ruta.focus(); return; }
      const nex = $('#kon-disk');
      if (nex) nex.classList.add('ar-tanker');
      try {
        await NXAgent.stall({ agent: 'drift', fraga: ruta.value, ut: ut, knapp: knapp });
      } finally {
        if (nex) nex.classList.remove('ar-tanker');
      }
    }

    knapp.addEventListener('click', skicka);
    kopplaMikrofon(ruta);

    /* Ctrl+Enter skickar, precis som i agentfliken. En textarea där
       Enter skickar går inte att skriva en flerradig fråga i. */
    ruta.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') skicka();
    });
  }


  /* ------------------------------------------------------------
     DIKTERING

     Webbläsarens egen taligenkänning, inget eget API och ingen egen
     nyckel. Tre saker är medvetna:

     1. KNAPPEN ÄR DOLD TILLS VI SETT ATT DET GÅR. Firefox har ingen
        SpeechRecognition alls, och Safari vägrar utan användargest på
        vissa versioner. En knapp som inte gör något är värre än ingen
        knapp, för då provar man den igen.
     2. LJUDET LÄMNAR HUSET. Chrome skickar det till Googles tjänst.
        Resten av kodbasen är byggd för att barns namn inte ska lämna
        oss — då måste det stå vid knappen, inte i en hjälptext.
     3. TALET SKICKAS INTE. Det skrivs i rutan och stannar där tills
        någon trycker Fråga. En feltolkning ska gå att rätta innan den
        kostar ett agentanrop.
     ------------------------------------------------------------ */
  function kopplaMikrofon(ruta) {
    const knapp = $('#kon-mik');
    const not = $('#kon-mik-not');
    const Igenkanning = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!knapp || !Igenkanning) return;

    knapp.hidden = false;
    if (not) not.hidden = false;

    let ig = null;
    let fore = '';

    function av() {
      knapp.setAttribute('aria-pressed', 'false');
      ig = null;
    }

    knapp.addEventListener('click', () => {
      if (ig) { ig.stop(); return; }

      ig = new Igenkanning();
      ig.lang = document.documentElement.lang === 'en' ? 'en-GB' : 'sv-SE';
      ig.interimResults = true;
      ig.continuous = false;

      /* Texten som redan stod i rutan sparas undan och läggs tillbaka
         framför varje uppdatering. Utan det raderar andra meningen den
         första, eftersom resultatlistan börjar om vid varje omgång. */
      fore = ruta.value ? ruta.value.replace(/\s*$/, '') + ' ' : '';

      ig.onresult = e => {
        let text = '';
        for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
        ruta.value = fore + text;
      };
      /* Både onerror och onend nollställer: en nekad mikrofon ger error
         utan end i vissa webbläsare, och en tyst timeout ger end utan
         error. Missas den ena sitter knappen kvar som "lyssnar" medan
         ingenting lyssnar. */
      ig.onerror = av;
      ig.onend = () => { av(); ruta.focus(); };

      try {
        ig.start();
        knapp.setAttribute('aria-pressed', 'true');
      } catch (fel) {
        av();
      }
    });
  }

  koppla();
  NXAdmin.rita.ritaKonsol = ritaKonsol;
})();
