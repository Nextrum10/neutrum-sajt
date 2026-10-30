/* ============================================================
   NEXTRUM — adminvyns små rörelser (2026-10-30, efter React Bits)

   Leo: "På admin vyn finns massor av olika saker som kan förbättras av
   components på react-bits". React Bits är React; här finns ingen React
   och ingen inline-JavaScript (/admin har script-src 'self'), så det
   som togs med är skrivet om för hand, och bara det som hjälper i ett
   arbetsverktyg. Bakgrunder i WebGL, muspekare och text som skakar
   står kvar där: de tar uppmärksamhet från det man ska göra.

   1. CountUp: Översiktens tal räknas upp när sektionen öppnas.
   2. SpotlightCard: ett tal man kan trycka på (data-urval) får ett ljus
      där musen står, så att det syns att det går att trycka på.
   3. AnimatedList: raderna i Att göra kommer in en i taget.
   (4. ShinyText på "Hämtar" och 5. Stepper i ansökan är bara CSS och
   markup: nextrum-admin-konsol.css och stegrad() i -rekrytering.js.)

   RÖRELSE BARA NÄR MAN BYTER SEKTION. Vyn ritar om listor och tal när
   data kommer in; hade varje omritning räknat upp talen igen hade
   Översikt blinkat hela tiden. Därför ett fönster: en dryg halv sekund
   efter sidladdningen, ett byte i menyn eller i adressen. Det som ritas
   utanför fönstret står still, utom första gången en sektion ritas.
   Reducerad rörelse: inget alls.

   Skriptet sätter klasser och text, CSS rör sig (CLAUDE.md, avsnitt 3).
   Det enda som sätts per bildruta är talets text i CountUp.
   ============================================================ */
(function () {
  'use strict';

  const stilla = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mus = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  let fönster = 0;
  const öppna = () => { fönster = performance.now() + 700; };
  öppna();
  window.addEventListener('hashchange', öppna);
  document.addEventListener('click', e => {
    if (e.target.closest && e.target.closest('#vy-sido a, #mobilmeny a, [data-mt-hoppa], .ag-rad[href]')) öppna();
  }, true);
  const iFönstret = () => !stilla && performance.now() < fönster;

  /* ---- 1. CountUp ----
     Talet står färdigt i markupen ("12", "3 450 kr", "87 %"), och det är
     den texten som står kvar när räkningen är klar: bara den första
     siffergruppen räknas, och resten av texten rörs inte. Ett tal som
     inte går att läsa (ett streck, ett datum) lämnas som det är. */
  const TAL = /^(\D*?)(\d{1,3}(?:[\s  ]\d{3})+|\d+)([.,]\d+)?(.*)$/;
  function räknaUpp(el) {
    if (el.dataset.raknat) return;
    el.dataset.raknat = '1';
    const slut = el.textContent;
    const m = TAL.exec(slut);
    if (!m || m[3]) return;   // decimaler räknas inte: de skulle hoppa i bredd
    const mål = Number(m[2].replace(/\D/g, ''));
    if (!(mål > 1) || mål > 1e9) return;
    const sep = (m[2].match(/[\s  ]/) || [''])[0];
    const grupp = n => sep ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep) : String(n);
    const tid = Math.min(1100, 500 + Math.log10(mål) * 160);
    const start = performance.now();
    // Samma utgång som React Bits CountUp (en fjäder som landar mjukt), som en kurva.
    const kurva = t => 1 - Math.pow(1 - t, 4);
    function steg(nu) {
      const t = Math.min(1, (nu - start) / tid);
      if (!el.isConnected) return;
      if (t >= 1) { el.textContent = slut; return; }
      el.textContent = m[1] + grupp(Math.round(mål * kurva(t))) + m[4];
      requestAnimationFrame(steg);
    }
    el.textContent = m[1] + '0' + m[4];
    requestAnimationFrame(steg);
  }

  /* ---- 3. AnimatedList ----
     En klass och raden i ordningen (--rad, läst på raden själv); CSS gör
     resten. Högst tolv rader får vänta, så att en lång lista inte tar
     sekunder på sig. */
  function listan(rader) {
    let i = 0;
    rader.forEach(r => {
      if (r.classList.contains('nx-in-rad')) return;
      r.style.setProperty('--rad', String(Math.min(i++, 12)));
      r.classList.add('nx-in-rad');
      r.addEventListener('animationend', () => {
        r.classList.remove('nx-in-rad');
        r.style.removeProperty('--rad');
      }, { once: true });
    });
  }

  /* Allt ritas med innerHTML av områdesfilerna, så det nya fångas när det
     kommer in i main, inte genom att varje fil anropar hit. */
  /* Första gången en sektion ritas rör den sig också utanför fönstret:
     datan kommer oftast först efter det, och annars hade Översikt aldrig
     räknat upp vid inloggningen. */
  const ritade = new Set();
  function nytt(rötter) {
    if (stilla) return;
    const tal = [], rader = [], nya = new Set();
    const öppet = iFönstret();
    rötter.forEach(n => {
      if (n.nodeType !== 1) return;
      const sek = n.closest('section[data-sek]');
      const nyckel = sek ? sek.dataset.sek : '';
      if (nyckel && !ritade.has(nyckel)) nya.add(nyckel);
      if (!nya.has(nyckel) && !öppet) return;
      if (n.matches('.adm-kpi > b')) tal.push(n);
      if (n.matches('.ag-rad')) rader.push(n);
      n.querySelectorAll('.adm-kpi > b').forEach(b => tal.push(b));
      n.querySelectorAll('.ag-rad').forEach(r => rader.push(r));
    });
    nya.forEach(k => ritade.add(k));
    tal.forEach(räknaUpp);
    if (rader.length) listan(rader);
  }

  function start() {
    const rot = document.getElementById('view-app') || document.body;
    new MutationObserver(lista => {
      const n = [];
      lista.forEach(m => m.addedNodes.forEach(x => n.push(x)));
      if (n.length) nytt(n);
    }).observe(rot, { childList: true, subtree: true });
  }

  /* ---- 2. SpotlightCard ----
     Ljuset är en radiell gradient i ::before som läser --sx och --sy, och
     de sätts på talet självt, där de läses. Bara med en mus: på en
     telefon finns inget att följa. */
  if (mus && !stilla) {
    document.addEventListener('pointermove', e => {
      const k = e.target.closest && e.target.closest('.vy-admin [data-urval]');
      if (!k) return;
      const r = k.getBoundingClientRect();
      k.style.setProperty('--sx', (e.clientX - r.left) + 'px');
      k.style.setProperty('--sy', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  NXAdmin.rita.räknaUpp = räknaUpp;
})();
