/* ============================================================
   NEXTRUM — maskoten

   En hjälpruta som frågar vad besökaren behöver och svarar med
   Nextrums EGEN text ur FAQ:n, ordagrant, plus en knapp till rätt
   sida.

   Varför ingen språkmodell bakom den: en publik chatt som anropar
   en API-nyckel har sin adress i sidans javascript. Utan spärr kan
   vem som helst köra den i en slinga på Nextrums räkning, och en
   spärr som ligger i webbläsaren går att gå runt. Det som faktiskt
   efterfrågas här — svar om Nextrum och vägen till rätt formulär —
   är dessutom en känd, ändlig mängd som redan står skriven på
   faq.html. Den söks igenom lokalt.

   Följden är värd att säga rakt ut: maskoten kan inte hitta på ett
   pris, ett villkor eller ett löfte. Hittar den inget svar säger den
   det och lotsar till kontaktformuläret i stället för att gissa.

   Inga nätverksanrop. Ingen kostnad. Inget att missbruka.
   ============================================================ */

(function () {
  'use strict';

  const DATA = window.NEXTRUM_MASKOT;
  if (!DATA) return;

  const EN = /^en/i.test(document.documentElement.getAttribute('lang') || 'sv');
  const KOD = EN ? 'en' : 'sv';
  const KB = DATA[KOD];
  if (!KB) return;

  /* Undersidorna ligger i samma mapp som varandra, så relativa
     adresser fungerar likadant på svenska och engelska. */
  const T = EN ? {
    knapp: 'Help', rubrik: 'What do you need help with?',
    ingress: 'Ask a question, or pick one below. I answer with what is written on this site.',
    falt: 'Write your question…', skicka: 'Ask', stang: 'Close',
    inget: 'I could not find an answer to that here. The quickest way is to ask us directly — we reply to the email address you give.',
    relaterat: 'Related', las: 'Read more in the FAQ',
    snabb: ['How does the matching work?', 'What does it cost?', 'How do I become a tutor?']
  } : {
    knapp: 'Hjälp', rubrik: 'Vad behöver du hjälp med?',
    ingress: 'Ställ en fråga, eller välj en nedan. Jag svarar med det som står på sidan.',
    falt: 'Skriv din fråga…', skicka: 'Fråga', stang: 'Stäng',
    inget: 'Jag hittar inget svar på det här. Snabbaste vägen är att fråga oss direkt — vi svarar på mejlen du anger.',
    relaterat: 'Relaterat', las: 'Läs mer i FAQ',
    snabb: ['Hur fungerar matchningen?', 'Vad kostar det?', 'Hur blir jag studiehjälpare?']
  };

  const STOPP = new Set(KB.stopp);

  /* ---------- matchningen ----------
     Ord räknas, inte meningar. Ett ord i frågan väger tyngre än
     samma ord i svaret: den som skriver "kostar" letar efter frågan
     om pris, inte efter varje svar som råkar nämna ordet. */
  function ord(s) {
    return String(s).toLowerCase()
      .replace(/[^\wåäöéü\s-]/g, ' ')
      .split(/\s+/)
      .filter(o => o.length >= 3 && !STOPP.has(o));
  }

  /* Svenskan böjer: "kostar", "kostnad", "kostade". En jämförelse på
     hela ord missar alla utom en. Stammen räcker för att para ihop
     dem, och fyra tecken är kort nog att fånga böjningen men långt
     nog att inte para ihop "pris" med "prata". */
  function stam(o) { return o.length > 5 ? o.slice(0, o.length - 2) : o; }

  function träffar(fråga) {
    const o = ord(fråga).map(stam);
    if (!o.length) return { faq: [], vägar: [] };

    const faq = KB.faq.map(p => {
      const iF = ord(p.f).map(stam), iS = ord(p.s).map(stam);
      let poäng = 0;
      o.forEach(x => {
        if (iF.some(y => y.startsWith(x) || x.startsWith(y))) poäng += 3;
        else if (iS.some(y => y.startsWith(x) || x.startsWith(y))) poäng += 1;
      });
      return { p, poäng };
    }).filter(x => x.poäng >= 3).sort((a, b) => b.poäng - a.poäng);

    /* Vägarna matchas på hela uttryck, inte stammar. "bli
       studiehjälpare" ska träffa som fras. */
    const låg = String(fråga).toLowerCase();
    const vägar = KB.vagar.filter(v => v.o.some(x => låg.includes(x)));

    return { faq: faq.slice(0, 3).map(x => x.p), vägar: vägar.slice(0, 2) };
  }

  /* ---------- bygget ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const MÄRKE =
    '<svg viewBox="0 0 26 26" aria-hidden="true" class="mk-mark">' +
    '<rect width="26" height="26" rx="7"/><path d="M8 18.5V7.5L18 18.5V7.5"/></svg>';

  const rot = document.createElement('div');
  rot.className = 'mk';
  rot.innerHTML =
    '<button class="mk-knapp" type="button" aria-expanded="false" aria-controls="mk-panel">' +
      '<span class="mk-bild">' +
        /* Riktig maskotbild om den finns, annars märket. onerror gör
           att en saknad fil inte lämnar ett trasigt bildkryss. */
        '<img src="/bilder/maskot.png" alt="" width="44" height="44" loading="lazy" ' +
        'onerror="this.remove()">' + MÄRKE +
      '</span>' +
      '<span class="mk-knapp-text">' + esc(T.knapp) + '</span>' +
    '</button>' +
    '<div class="mk-panel" id="mk-panel" role="dialog" aria-modal="false" ' +
         'aria-label="' + esc(T.rubrik) + '" hidden>' +
      '<div class="mk-topp">' +
        '<span class="mk-avatar">' +
          '<img src="/bilder/maskot.png" alt="" width="34" height="34" loading="lazy" ' +
          'onerror="this.remove()">' + MÄRKE +
        '</span>' +
        '<div><b>' + esc(T.rubrik) + '</b><span>' + esc(T.ingress) + '</span></div>' +
        '<button class="mk-stang" type="button" aria-label="' + esc(T.stang) + '">' +
          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="mk-flode" role="log" aria-live="polite"></div>' +
      '<form class="mk-form">' +
        '<input class="mk-falt" type="text" autocomplete="off" ' +
               'placeholder="' + esc(T.falt) + '" aria-label="' + esc(T.falt) + '">' +
        '<button class="mk-skicka" type="submit">' + esc(T.skicka) + '</button>' +
      '</form>' +
    '</div>';
  document.body.appendChild(rot);

  const knapp  = rot.querySelector('.mk-knapp');
  const panel  = rot.querySelector('.mk-panel');
  const flöde  = rot.querySelector('.mk-flode');
  const form   = rot.querySelector('.mk-form');
  const fält   = rot.querySelector('.mk-falt');

  function bubbla(html, från) {
    const d = document.createElement('div');
    d.className = 'mk-bubbla mk-' + från;
    d.innerHTML = html;
    flöde.appendChild(d);
    flöde.scrollTop = flöde.scrollHeight;
  }

  function svara(fråga) {
    bubbla(esc(fråga), 'du');
    const { faq, vägar } = träffar(fråga);

    if (!faq.length && !vägar.length) {
      bubbla(esc(T.inget) +
        '<a class="mk-vag" href="faq.html#kontakt"><b>' +
        esc(EN ? 'Contact us' : 'Kontakta oss') + '</b></a>', 'mk');
      return;
    }

    let h = '';
    if (faq.length) {
      h += '<b>' + esc(faq[0].f) + '</b><p>' + esc(faq[0].s) + '</p>';
      if (faq.length > 1) {
        h += '<span class="mk-mer">' + esc(T.relaterat) + '</span><ul>' +
             faq.slice(1).map(p =>
               '<li><a href="faq.html" data-f="' + esc(p.f) + '">' + esc(p.f) + '</a></li>').join('') +
             '</ul>';
      }
    }
    vägar.forEach(v => {
      h += '<a class="mk-vag" href="' + esc(v.h) + '"><b>' + esc(v.t) + '</b>' +
           '<span>' + esc(v.b) + '</span></a>';
    });
    bubbla(h, 'mk');
  }

  /* Knappen är en växel, och det ska synas. Med samma ikon och
     samma text i båda lägena ser den öppna rutan ut som något man
     bara kan lämna via krysset — och hittar man inte det sitter man
     fast. */
  function lägeKnapp(öppen) {
    knapp.setAttribute('aria-expanded', String(öppen));
    knapp.classList.toggle('ar-oppen', öppen);
    const txt = knapp.querySelector('.mk-knapp-text');
    if (txt) txt.textContent = öppen ? T.stang : T.knapp;
    knapp.setAttribute('aria-label', öppen ? T.stang : T.knapp);
  }

  function öppna() {
    panel.hidden = false;
    lägeKnapp(true);
    if (!flöde.childElementCount) {
      bubbla('<b>' + esc(T.rubrik) + '</b><div class="mk-snabb">' +
        T.snabb.map(f => '<button type="button" data-snabb="' + esc(f) + '">' +
                          esc(f) + '</button>').join('') + '</div>', 'mk');
    }
    setTimeout(() => fält.focus(), 60);
  }
  function stäng(flyttaFokus) {
    panel.hidden = true;
    lägeKnapp(false);
    if (flyttaFokus !== false) knapp.focus();
  }

  knapp.addEventListener('click', () => (panel.hidden ? öppna() : stäng()));
  rot.querySelector('.mk-stang').addEventListener('click', stäng);

  form.addEventListener('submit', e => {
    e.preventDefault();
    const f = fält.value.trim();
    if (!f) return;
    fält.value = '';
    svara(f);
  });

  /* Snabbfrågorna och de relaterade länkarna svarar i rutan i
     stället för att lämna sidan. FAQ-länken finns kvar för den som
     hellre läser allt. */
  flöde.addEventListener('click', e => {
    const s = e.target.closest('[data-snabb], [data-f]');
    if (!s) return;
    e.preventDefault();
    svara(s.dataset.snabb || s.dataset.f);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !panel.hidden) stäng();
  });

  /* Att trycka utanför är det man förväntar sig av en ruta som den
     här, och på en telefon finns ingen Escape-tangent att ta till.
     Utan det här fanns exakt en väg ut: ett kryss på 28 pixlar. */
  document.addEventListener('pointerdown', e => {
    if (panel.hidden) return;
    if (rot.contains(e.target)) return;
    stäng(false);
  });
})();
