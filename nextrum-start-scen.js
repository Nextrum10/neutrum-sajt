/* ============================================================
   NEXTRUM — STARTSIDANS SCENER (2026-10-29)
   Leo: "Just nu är mycket bara i kolumner och tråkiga", med
   reactbits.dev som förebild, och "Du får göra allt". React Bits är
   React; här finns inget ramverk och inget byggsteg, så det som togs
   därifrån är skrivet om för hand, i sidans egen stil:

     ljus       MagicBento: kanten och ytan på bentots rutor lyser där
                musen är, och ett mjukt sken följer musen över rutnätet.
                Bara med mus; på en telefon finns ingen mus att följa.
     scrollord  ScrollReveal: manifestets ord går från suddiga till
                skarpa i takt med scrollen, och rubriken rätar upp sig.
     tipp       Studievyns fönster tippar upp ur papperet medan man
                scrollar mot det, i stället för att resa sig en gång.
                Bara på dator (tier full): på en telefon är fönstret
                smalt och rörelsen bara skulle skaka.

   Undantaget från "skriptet sätter klasser, CSS rör sig", som på
   landningssidorna (nextrum-landning.js): GSAP skriver transform,
   opacitet och filter per bildruta på rubriken och fönstret, och ljuset
   skriver tre custom properties på den ruta det lyser på. Variablerna är
   registrerade utan arv (@property i nextrum-start.css avsnitt 19), så en
   musrörelse räknar bara om rutan själv, aldrig allt under den, vilket
   var det som hackade i studievyns gamla lutning.

   Utan det här skriptet, utan GSAP eller med reducerad rörelse står
   allt som nextrum-start.js lämnar det: orden tonar fram när rubriken
   syns och fönstret reser sig. Inget startläge här gömmer något.
   Ingen text skrivs härifrån (CLAUDE.md, avsnitt 4).
   ============================================================ */

(function () {
  'use strict';

  const rot = document.documentElement;
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const tier = () => rot.dataset.motion || 'full';
  const reducerad = () => tier() === 'still' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gsap = window.gsap, ST = window.ScrollTrigger;
  const medGsap = !!(gsap && ST) && !reducerad();

  function prova(namn, fn) {
    try { fn(); } catch (e) { if (window.console) console.warn('nextrum-start-scen: ' + namn, e); }
  }

  /* ---------- ljuset över bentot ----------
     MagicBentos två delar: kanten som lyser upp på rutorna närmast musen
     (--gx, --gy, --gn på rutan, läst av rutans bakgrund och ::before),
     och ett stort, mjukt sken som följer musen (.bn-sken, flyttat med
     translate, som grafikkortet sköter). En ruta längre bort än RÄCKVIDD
     från musen släcks. Positionerna läses en gång per bildruta, aldrig i
     scrollen: utan musrörelse händer ingenting. */
  const RÄCKVIDD = 280;
  function ljus() {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    $$('[data-ljus]').forEach(ram => {
      const rutor = $$('.bn-ruta, .hj-gar', ram);
      if (!rutor.length) return;
      const sken = document.createElement('span');
      sken.className = 'bn-sken';
      sken.setAttribute('aria-hidden', 'true');
      ram.prepend(sken);
      ram.classList.add('bn-ljus');

      let x = 0, y = 0, väntar = 0;
      function rita() {
        väntar = 0;
        const r = ram.getBoundingClientRect();
        sken.style.translate = (x - r.left) + 'px ' + (y - r.top) + 'px';
        rutor.forEach(k => {
          const b = k.getBoundingClientRect();
          const dx = Math.max(b.left - x, 0, x - b.right);
          const dy = Math.max(b.top - y, 0, y - b.bottom);
          const n = Math.max(0, 1 - Math.hypot(dx, dy) / RÄCKVIDD);
          const förra = k._gn || 0;
          if (n === 0 && förra === 0) return;
          k._gn = n;
          k.style.setProperty('--gx', (x - b.left).toFixed(0) + 'px');
          k.style.setProperty('--gy', (y - b.top).toFixed(0) + 'px');
          k.style.setProperty('--gn', n.toFixed(3));
        });
      }
      ram.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        x = e.clientX; y = e.clientY;
        if (!väntar) väntar = requestAnimationFrame(rita);
      }, { passive: true });
      ram.addEventListener('pointerenter', e => {
        if (e.pointerType === 'mouse') ram.classList.add('bn-ljus-pa');
      });
      ram.addEventListener('pointerleave', () => {
        ram.classList.remove('bn-ljus-pa');
        if (väntar) { cancelAnimationFrame(väntar); väntar = 0; }
        rutor.forEach(k => { k._gn = 0; k.style.setProperty('--gn', '0'); });
      });
    });
  }

  /* ---------- manifestets ord ----------
     nextrum-start.js har redan delat rubriken i ord (.nx-ord) för
     ordfyllnaden. Här tar scrollen över: .nx-scrub stänger av
     ordfyllnadens övergång (nextrum-start.css avsnitt 19), och GSAP:s
     värden står inline, så de väger mer än .nx-fylld. Suddet bara på
     dator: filter per ord och bildruta är det enda här som kostar. */
  function scrollord() {
    if (!medGsap) return;
    $$('[data-scrollord]').forEach(h => {
      const ord = $$('.nx-ord', h);
      if (!ord.length) return;
      const sudd = tier() === 'full';
      h.classList.add('nx-scrub');
      gsap.fromTo(h, { rotate: 3 }, {
        rotate: 0, ease: 'none', transformOrigin: '0% 50%',
        scrollTrigger: { trigger: h, start: 'top bottom', end: 'bottom 60%', scrub: true }
      });
      gsap.fromTo(ord,
        { opacity: 0.1, filter: sudd ? 'blur(10px)' : 'none' },
        {
          opacity: 1, filter: sudd ? 'blur(0px)' : 'none', ease: 'none', stagger: 0.06,
          scrollTrigger: { trigger: h, start: 'top 88%', end: 'bottom 52%', scrub: true }
        });
    });
  }

  /* ---------- studievyn tippar upp ----------
     .sd-scrub stänger av studievyns egen entré (avsnitt 8 och 19), och
     scrollen bär .sd-rum från liggande till rakt. Fönstrets lutning mot
     pekaren sitter på .sd-fonster, ett annat element, så de två slåss
     aldrig om transform. Rundturen räknar med offsetLeft, inte
     getBoundingClientRect, så pekaren hamnar rätt också medan fönstret
     lutar (nextrum-start.js, studievy). */
  function tipp() {
    if (!medGsap || tier() !== 'full') return;
    $$('.nx-sd[data-tipp]').forEach(sd => {
      const rum = sd.querySelector('.sd-rum');
      if (!rum) return;
      sd.classList.add('sd-scrub');
      gsap.fromTo(rum,
        { rotateX: 26, scale: 0.86, y: 70, opacity: 0.4 },
        {
          rotateX: 0, scale: 1, y: 0, opacity: 1, ease: 'none', transformOrigin: '50% 0%',
          scrollTrigger: { trigger: sd, start: 'top 98%', end: 'top 24%', scrub: 0.5 }
        });
    });
  }

  /* Just nu står dold tills erbjudandet hämtats, och studiehjälparna
     fylls i efter sidan: båda flyttar allt under sig. ScrollTrigger
     mäter bara vid start och vid resize, så en ändring av sidans höjd
     mäts om här, en gång när den lagt sig. */
  function mätOm() {
    if (!medGsap || !('ResizeObserver' in window)) return;
    let h = document.body.scrollHeight, väntar = 0;
    new ResizeObserver(() => {
      const nu = document.body.scrollHeight;
      if (nu === h) return;
      h = nu;
      clearTimeout(väntar);
      väntar = setTimeout(() => ST.refresh(), 160);
    }).observe(document.body);
  }

  if (medGsap) gsap.registerPlugin(ST);
  prova('ljus', ljus);
  prova('scrollord', scrollord);
  prova('tipp', tipp);
  prova('mätOm', mätOm);
})();
