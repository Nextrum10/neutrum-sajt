/* ============================================================
   NEXTRUM — driftkonsolen på Översikt

   Ersätter fotoheron som låg överst i adminvyn och sa hej. Namn och
   roll står redan i toppradens konto, så det blocket bar ingen
   information som inte fanns någon annanstans.

   TVÅ DELAR, OCH DE KOSTAR OLIKA MYCKET:

   1. LÄGET läses ur S.lage, alltså vyn admin_lage, som redan är
      hämtad av ritaÖversikt(), och arbetskön ur S.problem och
      S.attGora. Den kostar ingenting, är alltid färsk, och ritas vid
      varje sidladdning: ringen och talet i NEX-bandet, listan Att
      göra under det, och sidan Att göra (#attgora) med en rad per sak.

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
  const M = NXMedia;

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

  const LUGNT = '<div class="adm-lugnt">'
    + '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/></svg>'
    + '<span><b>Ingenting väntar just nu</b>'
    + '<span>Inga pass utan rapport och inga obesvarade anmälningar.</span></span>'
    + '</div>';

  /* ------------------------------------------------------------
     ATT GÖRA, SAK FÖR SAK (2026-10-26)

     Leo: "när jag trycker på att göra grejen ska jag få upp en flik som
     visar allt att göra". Ringen, talet bredvid den och Att göra leder
     till sektionen #attgora: samma poster i samma ordning, men en rad
     per SAK (nextrum-admin-oversikt.js, SAK FÖR SAK). Den räknar inget
     själv heller. Raderna är ringens tal, och en rad som står för flera
     (samma fel tio gånger) säger hur många.

     En rad öppnar det den gäller: en person eller ett pass i panelen,
     och man står kvar i listan när den stängs; annars sektionen där det
     görs. Sidan ritas om med Översikt, så det som gjorts går ur listan.
     ------------------------------------------------------------ */
  const PIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M12 5l7 7-7 7"/></svg>';
  const IKON = {
    pass: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3.5v3M16 3.5v3"/>',
    rapport: '<path d="M6 3.5h8l4 4V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20z"/><path d="M9 12h6M9 16h4"/>',
    uppgift: '<rect x="4.5" y="4" width="15" height="17" rx="2"/><path d="m8.5 12.5 2.3 2.3 4.7-4.8"/>',
    kort: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10.5h18M6.5 14.5h3"/>',
    fel: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
    notis: '<path d="M3.5 7.5h17v11h-17z"/><path d="m3.5 8 8.5 6 8.5-6"/>'
  };
  const stor = t => t.charAt(0).toUpperCase() + t.slice(1);

  function sakRad(s, problem) {
    const meta = (s.meta || []).filter(m => m && m !== '—');
    const inne = (s.person
        ? M.avatar(s.titel, null, { liten: true })
        : '<span class="vy-rad-ik' + (problem ? ' ar-fel' : '') + '" aria-hidden="true"><svg viewBox="0 0 24 24">'
          + (IKON[s.ikon] || IKON.fel) + '</svg></span>')
      + '<span class="vy-rad-mitt"><span class="vy-rad-titel">' + esc(s.titel) + '</span>'
      + (meta.length ? '<span class="vy-rad-meta">' + meta.map(m => '<span>' + esc(m) + '</span>').join('') + '</span>' : '')
      + (s.not ? '<span class="vy-rad-not">' + esc(s.not) + '</span>' : '')
      + '</span>'
      + '<span class="vy-rad-hoger">' + (s.gör ? '<small>' + esc(s.gör) + '</small>' : '')
      + '<span class="vy-rad-pil">' + PIL + '</span></span>';
    // En rad som står för flera bär hur många, så att raderna går att räkna ihop med ringen.
    const flera = s.gånger > 1 ? ' data-ganger="' + esc(String(s.gånger)) + '"' : '';
    if (s.dp) return '<button type="button" class="vy-rad ag-rad"' + flera + ' data-dp="' + esc(s.dp) + '">' + inne + '</button>';
    return '<a class="vy-rad ag-rad"' + flera + ' href="' + esc(s.till) + '"'
      + (s.hoppa ? ' data-mt-hoppa="' + esc(s.hoppa) + '"' : '') + '>' + inne + '</a>';
  }

  function sakGrupp(p, problem) {
    const saker = p.saker || [];
    const visade = saker.reduce((n, s) => n + (s.gånger || 1), 0);
    const kvar = p.antal - visade;
    return '<div class="vy-grupp"><h3>' + esc(stor(p.antal === 1 ? p.ental : p.rubrik)) + '</h3>'
      + '<span class="vy-antal ' + (problem ? 'ar-fel' : 'ar-gor') + '">' + esc(String(p.antal)) + '</span>'
      + '<a class="vy-lank" href="' + esc(p.till) + '">' + esc(p.dit || 'Öppna') + PIL + '</a></div>'
      + '<div class="vy-kort"><div class="vy-lista">'
      + saker.map(s => sakRad(Object.assign({ till: p.till }, s), problem)).join('')
      /* Antalet är databasens och listan här har inte alla, som felen hos
         användarna (de 100 senaste): resten står där posten leder. */
      + (kvar > 0
        ? '<a class="vy-rad ag-rad ag-fler" data-ganger="' + kvar + '" href="' + esc(p.till) + '"><span class="vy-rad-mitt">'
          + '<span class="vy-rad-titel">' + esc(visade ? 'Och ' + kvar + ' till' : kvar + (kvar === 1 ? ' sak' : ' saker'))
          + '</span><span class="vy-rad-meta"><span>' + esc('Står under ' + (p.dit || 'sektionen')) + '</span></span>'
          + '</span><span class="vy-rad-hoger"><span class="vy-rad-pil">' + PIL + '</span></span></a>'
        : '')
      + '</div></div>';
  }

  function del(rubrik, poster, problem) {
    if (!poster.length) return '';
    return '<div class="ag-del' + (problem ? ' ar-problem' : '') + '">'
      + '<p class="ag-del-rubrik">' + esc(rubrik) + '</p>'
      + poster.map(p => sakGrupp(p, problem)).join('') + '</div>';
  }

  /* Det ritaKonsol senast räknade. Sidan har innehåll bara medan den står
     framme, och ritas när den kommer fram (sidomenyns innan, nextrum-admin.js):
     dold hade samma knapp stått två gånger i dokumentet, här och i sin
     sektion, och den som letar efter den första hittar den som inte syns
     (prova-intag.js klickade på den dolda). */
  let senast = null;

  function ritaSidan() {
    const värd = $('#ag-sidan');
    if (!värd || !senast) return;
    const sektion = värd.closest('section[data-sek]');
    if (sektion && sektion.hidden) { värd.textContent = ''; return; }
    const { problem, kö, summa } = senast;
    if (!summa) { värd.innerHTML = LUGNT; return; }
    värd.innerHTML = '<p class="ag-ingress">' + esc('Nex räknar ' + summa + (summa === 1 ? ' sak' : ' saker')
        + '. Här står de en och en: tryck på en rad för att öppna det den gäller.') + '</p>'
      + del('Har gått fel', problem, true)
      + del('Väntar på dig', kö, false);
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

       Summan i ringen är de två listorna ihop: varje rad med sitt antal.
       Det gick inte att stämma av med ögat, för ögat räknar rader (Leo
       2026-10-26: "nex visar 3 saker att göra, jag ser bara två"), så
       ringen leder till sidan Att göra, där varje sak har sin rad. */
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
      värd.innerHTML = LUGNT;
    } else {
      /* Problemen först: det som gått fel är inte samma sak som det
         som väntar, och en lista som blandar dem säger ingenting. */
      värd.innerHTML = grupp('Har gått fel', problem, 'ar-problem')
        + grupp('Väntar på dig', kö, '');
    }
    /* Sidan Att göra, sak för sak, och vägen dit under listan. Står
       ingenting finns inget att visa sak för sak. */
    const alla = $('#kon-alla');
    if (alla) alla.hidden = !summa;
    senast = { problem, kö, summa };
    ritaSidan();

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
  NXAdmin.rita.ritaAttGöraSidan = ritaSidan;
})();
