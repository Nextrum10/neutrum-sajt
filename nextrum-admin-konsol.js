/* ============================================================
   NEXTRUM — driftkonsolen på Översikt

   Ersätter fotoheron som låg överst i adminvyn och sa hej. Namn och
   roll står redan i toppradens konto, så det blocket bar ingen
   information som inte fanns någon annanstans.

   TVÅ DELAR, OCH DE KOSTAR OLIKA MYCKET:

   1. LÄGET läses ur S.lage, alltså vyn admin_lage, som redan är
      hämtad av ritaÖversikt(), och arbetskön ur S.problem och
      S.attGora. Den kostar ingenting, är alltid färsk, och ritas vid
      varje sidladdning: ringen och talet i NEX-bandet, och listan Att
      göra under det.

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

  /* En post ur S.problem eller S.attGora blir en rad: antalet, vad det
     är, en mening om varför det väntar och vägen dit. Texten byggs med
     samma ental/rubrik-par som notisklockan och menyns siffror, så att
     de säger ordagrant samma sak. */
  function rad(p) {
    return '<a class="kon-rad" href="' + esc(p.till) + '">'
      + '<span class="kon-rad-antal">' + esc(String(p.antal)) + '</span>'
      + '<span class="kon-rad-text"><b>' + esc(p.antal === 1 ? p.ental : p.rubrik) + '</b>'
      + '<span>' + esc(p.under) + '</span></span>'
      + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M12 5l7 7-7 7"/></svg></a>';
  }

  /* En grupp har en rubrik i ord, och gruppen med det som gått fel en egen
     ton. Formen och ordet bär skillnaden, inte bara färgen: --fel och
     --ockra ligger nära varandra för den som inte ser rött. */
  function grupp(rubrik, poster, klass) {
    if (!poster.length) return '';
    return '<div class="kon-grupp' + (klass ? ' ' + klass : '') + '">'
      + '<p class="kon-grupp-rubrik">' + esc(rubrik) + '</p>'
      + poster.map(rad).join('') + '</div>';
  }

  function ritaKonsol() {
    const värd = $('#kon-lage');
    const disk = $('#kon-disk');
    if (!värd || !disk) return;

    /* KONSOLEN RÄKNAR INGENTING SJÄLV.

       byggAttGöra() och byggProblem() i nextrum-admin-oversikt.js är
       husets definition av "väntar på oss" respektive "har gått fel".
       Listan här ÄR de två, och ritas bara här: förut stod de också som
       två egna block under konsolen, med samma rader en gång till. En egen räkning hade blivit ett tal som säger något annat än
       notisklockan och menyn — precis det fel hjältebildens kort en
       gång gjorde, och som står dokumenterat i nextrum-admin.js.

       Summan i ringen är de två listorna ihop, och eftersom båda syns
       uppdelade strax under går talet att stämma av med ögat. */
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

    const antal = $('#kon-antal');
    if (antal) antal.textContent = summa ? summa + ' st' : '';

    if (!problem.length && !kö.length) {
      värd.innerHTML = '<div class="adm-lugnt">'
        + '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/></svg>'
        + '<span><b>Ingenting väntar just nu</b>'
        + '<span>Inga pass utan rapport och inga obesvarade anmälningar.</span></span>'
        + '</div>';
    } else {
      /* Problemen först: det som gått fel är inte samma sak som det
         som väntar, och en lista som blandar dem säger ingenting. */
      värd.innerHTML = grupp('Har gått fel', problem, 'ar-problem')
        + grupp('Väntar på dig', kö, '');
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
       arbetsposter, och hör inte hemma i kön. Kommande pass stod här
       också, bredvid samma tal bland nyckeltalen strax under. */
    const pengar = $('#kon-pengar');
    if (pengar) {
      pengar.innerHTML =
        '<span><b>' + esc(kronor(l.obetalt_ore || 0)) + '</b> utestående</span>'
        + '<span><b>' + esc(kronor(l.att_betala_ut_ore || 0)) + '</b> att betala ut</span>';
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
        '<button class="kon-exempel-knapp" type="button">' + esc(f) + '</button>').join('');
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

  /* ------------------------------------------------------------
     NEX MÅNADSRAPPORT (2026-10-21)

     Nex skriver den själv den 1:a varje månad (nex-manadsrapport). Den
     ligger som en körning i agent_korningar: agenten drift, frågan
     "Månadsrapport för oktober 2026". Rutan visar den valda månadens
     senaste, och väljaren har de månader som finns plus de tre senaste,
     så att en saknad rapport går att skriva.

     Texten ritas ur två former, ## rubrik och - punkt, och allt annat
     blir stycken. Varje rad går genom esc(): modellen har skrivit den.
     ------------------------------------------------------------ */
  const PREFIX = 'Månadsrapport för ';
  const MÅNADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli',
    'augusti', 'september', 'oktober', 'november', 'december'];
  const månadsnamn = iso => MÅNADER[Number(iso.slice(5, 7)) - 1] + ' ' + iso.slice(0, 4);
  const R = { rapporter: [], vald: null, hämtad: false };

  function rapportHtml(text) {
    let ut = '', lista = false;
    String(text || '').split('\n').forEach(rad => {
      const r = rad.trim();
      if (/^[-•·]\s+/.test(r)) {
        if (!lista) { ut += '<ul>'; lista = true; }
        ut += '<li>' + esc(r.replace(/^[-•·]\s+/, '')) + '</li>';
        return;
      }
      if (lista) { ut += '</ul>'; lista = false; }
      if (!r) return;
      if (/^#{1,6}\s+/.test(r)) ut += '<h6>' + esc(r.replace(/^#{1,6}\s+/, '')) + '</h6>';
      else ut += '<p>' + esc(r) + '</p>';
    });
    return ut + (lista ? '</ul>' : '');
  }

  /* De tre senaste månaderna, den innevarande först (ett läge hittills),
     i Stockholm. Väljaren börjar aldrig före september 2026. */
  function senasteMånader() {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Stockholm' }));
    const ut = [];
    for (let i = 0; i < 4; i++) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const iso = m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0') + '-01';
      if (iso >= '2026-09-01') ut.push(iso);
    }
    return ut;
  }

  function isoFörNamn(namn) {
    const [m, a] = String(namn).split(' ');
    const i = MÅNADER.indexOf(m);
    return i === -1 ? null : a + '-' + String(i + 1).padStart(2, '0') + '-01';
  }

  async function hämtaRapporter() {
    const { data, error } = await supa.from('agent_korningar')
      .select('id, fraga, svar, skapad, status')
      .eq('agent', 'drift').eq('status', 'klar').like('fraga', PREFIX + '%')
      .order('skapad', { ascending: false }).limit(24);
    if (error) throw error;
    R.rapporter = (data || []).map(r => Object.assign(r, { manad: isoFörNamn(r.fraga.slice(PREFIX.length)) }))
      .filter(r => r.manad && r.svar);
  }

  function ritaRapporten() {
    const värd = $('#nex-rapport-text');
    const väljare = $('#nex-rapport-valj');
    if (!värd || !väljare) return;

    const månader = Array.from(new Set(senasteMånader().concat(R.rapporter.map(r => r.manad))))
      .sort().reverse();
    if (!R.vald) {
      /* Förvalet är den senaste skrivna, annars förra månaden. */
      R.vald = (R.rapporter[0] && R.rapporter[0].manad) || månader[1] || månader[0];
    }
    väljare.innerHTML = månader.map(m => '<option value="' + m + '"' + (m === R.vald ? ' selected' : '') + '>'
      + esc(månadsnamn(m)) + (R.rapporter.some(r => r.manad === m) ? '' : ' (ingen än)') + '</option>').join('');

    const r = R.rapporter.find(x => x.manad === R.vald);
    $('#nex-rapport-manad').textContent = månadsnamn(R.vald);
    $('#nex-rapport-skriv').textContent = r ? 'Skriv om' : 'Skriv nu';
    if (!r) {
      värd.innerHTML = '<p class="xsmall" style="color:var(--bl-2)">Ingen rapport för ' + esc(månadsnamn(R.vald))
        + ' än. Nex skriver förra månadens själv den 1:a; tryck Skriv nu för att få den nu.</p>';
      return;
    }
    värd.innerHTML = rapportHtml(r.svar)
      + '<p class="kon-rapport-nar">Skriven ' + esc(new Date(r.skapad).toLocaleString('sv-SE',
        { timeZone: 'Europe/Stockholm', dateStyle: 'medium', timeStyle: 'short' })) + '</p>';
  }

  async function ritaManadsrapport() {
    const värd = $('#nex-rapport-text');
    if (!värd) return;
    try {
      await hämtaRapporter();
      ritaRapporten();
    } catch (fel) {
      värd.innerHTML = '<p class="xsmall" style="color:var(--acc-lugn)">Rapporten kunde inte hämtas: '
        + esc(NX.felText ? NX.felText(fel) : String(fel)) + '</p>';
    }
  }

  function kopplaRapporten() {
    const väljare = $('#nex-rapport-valj');
    const knapp = $('#nex-rapport-skriv');
    if (!väljare || !knapp) return;
    väljare.addEventListener('change', () => { R.vald = väljare.value; ritaRapporten(); });

    knapp.addEventListener('click', async () => {
      const msg = $('#nex-rapport-msg');
      if (msg) NX.rensa(msg);
      const omskrivning = R.rapporter.some(r => r.manad === R.vald);
      const kör = async () => {
        const { data, error } = await supa.functions.invoke('nex-manadsrapport',
          { body: { manad: R.vald, igen: omskrivning } });
        let svar = data;
        if (error && error.context && typeof error.context.json === 'function') {
          try { svar = await error.context.json(); } catch (e) { /* behåll felet */ }
        }
        if (svar && svar.error) throw new Error(svar.error);
        if (!svar) throw error || new Error('Tomt svar');
        await hämtaRapporter();
      };
      try {
        if (typeof NXStudie !== 'undefined' && NXStudie.medan) await NXStudie.medan(knapp, 'Nex skriver…', kör);
        else await kör();
        /* Efter medan(): den sätter tillbaka knappens gamla text när den
           släpper, och Skriv nu ska då ha blivit Skriv om. */
        ritaRapporten();
      } catch (fel) {
        if (msg) NX.säg(msg, 'Nex kunde inte skriva rapporten: ' + (fel && fel.message || fel), false);
      }
    });
  }

  /* Hämtas en gång, när Översikt ritas första gången. Konsolen ritas om
     ofta, och rapporten ändras högst en gång i månaden. */
  function ritaKonsolOchRapport() {
    ritaKonsol.apply(null, arguments);
    if (!R.hämtad) { R.hämtad = true; ritaManadsrapport(); }
  }

  koppla();
  kopplaRapporten();
  NXAdmin.rita.ritaKonsol = ritaKonsolOchRapport;
})();
