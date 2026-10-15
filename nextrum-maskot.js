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
    inget: 'I could not find an answer to that here. The quickest way is to ask us directly, and we reply to the email address you give.',
    relaterat: 'Related', las: 'Read more in the FAQ',
    snabb: ['How does the matching work?', 'What does it cost?', 'How do I become a tutor?']
  } : {
    knapp: 'Hjälp', rubrik: 'Vad behöver du hjälp med?',
    ingress: 'Ställ en fråga, eller välj en nedan. Jag svarar med det som står på sidan.',
    falt: 'Skriv din fråga…', skicka: 'Fråga', stang: 'Stäng',
    inget: 'Jag hittar inget svar på det här. Snabbaste vägen är att fråga oss direkt, så svarar vi till e-postadressen du anger.',
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
    '<svg class="mk-mark" viewBox="0 0 223.5 169.5" fill="currentColor" aria-hidden="true">' +
    '<path d="M17.7 169.3c-8.2-1.1-14.8-6.7-17-14.5c-0.5-1.9-0.6-2.4-0.6-18.8c-0.1-18.3 0-21.2 1.1-24.6c0.7-2.4 2.4-5.8 3.8-8c1.4-2 8.8-9.2 19-18.6c3.2-3 9.6-9.1 24.1-23.1c11.8-11.3 13.2-12.5 18.3-14.5c8.6-3.3 19.1-3 26.8 0.9c3.5 1.7 8.5 5.9 18.7 15.5c2.3 2.2 6.2 5.8 8.6 7.9c2.4 2.1 6.2 5.5 8.4 7.5c5 4.5 6.4 5.6 9.7 7.4c1.5 0.8 2.7 1.5 2.8 1.6c0.2 0.4 0.6 0.3 0.4-0.1c0-0.2 0.1-0.7 0.3-1l0.4-0.7l1.2 0.9c2.3 1.7 13.6 7.7 23.9 12.9c7.4 3.6 9.9 4.7 13.7 6c2.6 0.8 2.9 1.7 0.6 1.7c-1 0-1 0.1-0.5 0.4c1 0.7 0.6 2.2-1.1 3.6c-0.5 0.5-4.1 3.9-7.9 7.5c-3.9 3.7-9.9 9.4-13.3 12.7c-8.1 7.7-10.6 9.4-17.1 11.5c-5.3 1.6-13.9 1.5-19.5-0.4c-6.4-2.1-8-3.2-17.4-12c-2.8-2.5-6.4-5.9-8.1-7.4c-1.7-1.5-4.6-4.2-6.5-6c-5.6-5.4-7.2-6.4-10.4-6.3c-2.1 0-3.8 0.7-5.3 2.2c-1.2 1.3-6.4 7.8-8.5 10.8c-1.8 2.4-8.4 11.2-12.8 16.8c-1.8 2.4-4.2 5.4-5.2 6.9c-9.5 12.9-11.6 15.4-13.6 16.9c-4.5 3.3-11.4 5.1-17 4.4z"/>' +
    '<path fill="#F88740" d="M177.1 106.5c-6.6-2.4-34-16.7-35-18.2c-0.6-0.8-0.3-1.3 2-3.4c2.7-2.5 3-3 3.6-7.3c0.5-3.1 0.5-4.8 0.5-15.2c0.1-15.5 0.1-16.2 2.6-21c1.2-2.4 1.9-3.4 3.2-4.6c1.7-1.7 12.4-11.9 15.9-15c1.1-1.1 4.8-4.7 8.3-8.1c7.2-6.9 9-8.4 11.7-10.2c6-3.8 15.3-4.6 21.3-1.8c4.7 2.3 9.3 7.2 11.1 11.8c1.1 2.9 1.3 6.3 1.1 29.3c-0.2 21.9-0.2 22.1-1.7 25.5c-1.8 3.8-3.5 6-8.6 10.8c-2.6 2.5-7.6 7.3-11.1 10.8c-13.9 13.6-16.9 16.5-18 17.1c-1.6 1.1-2.9 1-6.9-0.5z"/></svg>';

  const rot = document.createElement('div');
  rot.className = 'mk';
  rot.innerHTML =
    '<button class="mk-knapp" type="button" aria-expanded="false" aria-controls="mk-panel">' +
      /* Ingen maskotbild. Filen har aldrig funnits, och onerror-
         varianten kostade två 404-anrop per sidvisning för en bild
         som ändå togs bort direkt. Märket ritas i SVG och behöver
         inget nätverk. */
      '<span class="mk-bild">' + MÄRKE + '</span>' +
      '<span class="mk-knapp-text">' + esc(T.knapp) + '</span>' +
    '</button>' +
    '<div class="mk-panel" id="mk-panel" role="dialog" aria-modal="false" ' +
         'aria-label="' + esc(T.rubrik) + '" hidden>' +
      '<div class="mk-topp">' +
        '<span class="mk-avatar">' + MÄRKE + '</span>' +
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
