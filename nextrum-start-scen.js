/* ============================================================
   NEXTRUM — STARTSIDANS SCENER (2026-10-29)
   Leo: "Just nu är mycket bara i kolumner och tråkiga", med
   reactbits.dev som förebild, och samma kväll, efter två varv med
   rutor: "Jag sa ta inspiration av animationer osv på react bits, snygga
   rörliga bakgrunder, hur texter går osv". React Bits är React; här
   finns inget ramverk och inget byggsteg, så det som togs därifrån är
   skrivet om för hand, i sidans egen stil:

     bakgrunder Dot Grid: ett nät av punkter bakom Nästa steg som lyser
                upp kring pekaren (efter Leos video), i en 2d-duk. Ritas
                bara medan det syns och något rör sig, och står still med
                reducerad rörelse. Trådarna (Threads, WebGL) i ett band
                under en rad man svepte i gick med raden samma kväll.
     bandfart   ScrollVelocity: ämnesbandet lutar åt det håll man
                scrollar, mer ju fortare, och rätar upp sig när man
                stannar.
     scrollord  ScrollReveal: manifestets ord går från suddiga till
                skarpa i takt med scrollen, och rubriken rätar upp sig.
     tipp       Studievyns fönster tippar upp ur papperet medan man
                scrollar mot det, i stället för att resa sig en gång.
                Bara på dator (tier full).

   Undantaget från "skriptet sätter klasser, CSS rör sig", som på
   landningssidorna (nextrum-landning.js): GSAP skriver transform,
   opacitet och filter per bildruta på rubriken, fönstret och bandet.
   Inget här räknar om sidans layout.

   Utan det här skriptet, utan GSAP eller med reducerad rörelse står
   allt som nextrum-start.js lämnar det: orden som tonar fram när
   rubriken syns och fönstret som reser sig.
   Inget startläge här gömmer något.
   Ingen text skrivs härifrån (CLAUDE.md, avsnitt 4).
   ============================================================ */

(function () {
  'use strict';

  const rot = document.documentElement;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const tier = () => rot.dataset.motion || 'full';
  const reducerad = () => tier() === 'still' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gsap = window.gsap, ST = window.ScrollTrigger;
  const medGsap = !!(gsap && ST) && !reducerad();

  function prova(namn, fn) {
    try { fn(); } catch (e) { if (window.console) console.warn('nextrum-start-scen: ' + namn, e); }
  }

  /* Färgerna läses ur CSS på elementet runt duken, så de följer sidans
     tokens och mörka läget. */
  function färg(v) {
    const c = document.createElement('canvas').getContext('2d');
    c.fillStyle = '#000';
    c.fillStyle = (v || '').trim() || '#000';
    const hex = c.fillStyle;
    if (hex[0] !== '#') return [0, 0, 0];
    return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  }

  /* ---------- punktnätet (Dot Grid), i Nästa steg ----------
     Leo skickade en video (en sajt där ett nät av punkter lyser upp kring
     pekaren bakom "Want to train together?"): "kör nåt sånt här där i
     bakrunden". React Bits Dot Grid, i en vanlig 2d-duk: punkterna står
     knappt synliga i bläckets färg, så att ytan läses som sidans papper
     (Leo: "samma färg som resten av sidan i den nyansen"), och kring pekaren blir de större, får
     accentens färg och viker undan en aning, och glider tillbaka. Utan mus
     (en telefon) vandrar ljuset långsamt av sig självt. Slingan går bara
     medan nätet syns och något rör sig; med reducerad rörelse ritas
     nätet en gång, utan ljus. Färgerna läses om när sidans läge byts. */
  function punktnät(sek) {
    const el = document.createElement('canvas');
    el.className = 'nx-punkter';
    el.setAttribute('aria-hidden', 'true');
    sek.insertBefore(el, sek.firstChild);
    const c = el.getContext('2d');
    if (!c) { el.remove(); return; }
    const AVST = 26, R = 160, stilla = reducerad();
    const mus = matchMedia('(hover: hover) and (pointer: fine)').matches;
    let w = 0, h = 0, pkt = [], bas = [0, 0, 0], ljus = [0, 0, 0];
    let syns = false, ram0 = 0, styrka = 0, inne = false;
    const spot = { x: -999, y: -999 }, mål = { x: -999, y: -999 };
    const rgb = (f, a) => 'rgba(' + f.map(x => Math.round(x * 255)).join(',') + ',' + a.toFixed(3) + ')';
    function läs() {
      const cs = getComputedStyle(sek);
      bas = färg(cs.getPropertyValue('--bl'));
      ljus = färg(cs.getPropertyValue('--acc'));
    }
    function bygg() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = el.clientWidth; h = el.clientHeight;
      el.width = Math.max(1, Math.round(w * dpr)); el.height = Math.max(1, Math.round(h * dpr));
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      pkt = [];
      const kol = Math.floor(w / AVST), rad = Math.floor(h / AVST);
      const x0 = (w - (kol - 1) * AVST) / 2, y0 = (h - (rad - 1) * AVST) / 2;
      for (let j = 0; j < rad; j++) for (let i = 0; i < kol; i++) pkt.push({ x: x0 + i * AVST, y: y0 + j * AVST, dx: 0, dy: 0 });
    }
    function rita(t) {
      ram0 = 0;
      if (!mus && !stilla) {
        mål.x = w * (0.5 + 0.36 * Math.sin(t * 0.00031));
        mål.y = h * (0.5 + 0.3 * Math.sin(t * 0.00047 + 1.3));
        inne = true;
      }
      styrka += ((inne && !stilla ? 1 : 0) - styrka) * 0.08;
      spot.x += (mål.x - spot.x) * 0.22;
      spot.y += (mål.y - spot.y) * 0.22;
      c.clearRect(0, 0, w, h);
      c.fillStyle = rgb(bas, 0.09);
      c.beginPath();
      const lysande = [];
      let rör = false;
      for (const p of pkt) {
        const ax = p.x - spot.x, ay = p.y - spot.y;
        const d = Math.sqrt(ax * ax + ay * ay);
        let e = d < R ? 1 - d / R : 0;
        e = e * e * (3 - 2 * e) * styrka;
        const tx = d > 0.1 ? ax / d * e * 9 : 0, ty = d > 0.1 ? ay / d * e * 9 : 0;
        p.dx += (tx - p.dx) * 0.14; p.dy += (ty - p.dy) * 0.14;
        if (Math.abs(p.dx - tx) > 0.05 || Math.abs(p.dy - ty) > 0.05) rör = true;
        if (e > 0.02) { lysande.push(p, e); continue; }
        c.moveTo(p.x + p.dx + 1.3, p.y + p.dy);
        c.arc(p.x + p.dx, p.y + p.dy, 1.3, 0, Math.PI * 2);
      }
      c.fill();
      for (let i = 0; i < lysande.length; i += 2) {
        const p = lysande[i], e = lysande[i + 1];
        c.fillStyle = 'rgba(' + [0, 1, 2].map(k => Math.round((bas[k] + (ljus[k] - bas[k]) * e) * 255)).join(',') + ',' + (0.09 + 0.85 * e).toFixed(3) + ')';
        c.beginPath();
        c.arc(p.x + p.dx, p.y + p.dy, 1.3 + 1.5 * e, 0, Math.PI * 2);
        c.fill();
      }
      const lever = !mus || inne || styrka > 0.01 || rör;
      if (!stilla && syns && !document.hidden && lever) ram0 = requestAnimationFrame(rita);
    }
    const gå = () => { if (!ram0 && syns && !document.hidden) ram0 = requestAnimationFrame(rita); };
    läs(); bygg(); requestAnimationFrame(rita);
    if (mus && !stilla) {
      sek.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        mål.x = e.clientX - r.left; mål.y = e.clientY - r.top;
        if (!inne) { spot.x = mål.x; spot.y = mål.y; }
        inne = true; gå();
      });
      sek.addEventListener('pointerleave', () => { inne = false; gå(); });
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => { syns = es.some(e => e.isIntersecting); if (syns) gå(); }, { rootMargin: '10% 0px' }).observe(el);
    } else { syns = true; gå(); }
    document.addEventListener('visibilitychange', gå);
    if ('ResizeObserver' in window) new ResizeObserver(() => { bygg(); requestAnimationFrame(rita); }).observe(el);
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { läs(); requestAnimationFrame(rita); });
  }

  function bakgrunder() {
    $$('.nx-final-ljus').forEach(sek => { if (!sek.querySelector('canvas.nx-punkter')) punktnät(sek); });
  }

  /* ---------- ämnesbandet lutar med farten ----------
     Bandet går av sig självt med CSS (nextrum-motion.js). Här lutar orden
     åt det håll man scrollar, mer ju fortare, och rätar upp sig
     när scrollen stannar. Bara skewX på raderna: spåret har CSS:ens
     transform, och sektionen klipper (overflow:clip), så en lutande rad
     breddar aldrig sidan. Hela sektionen lutad gjorde det, sju pixlar. */
  function bandfart() {
    if (!medGsap) return;
    $$('.nx-amnesband').forEach(band => {
      const rader = $$('.nx-amnesband-rad', band);
      if (!rader.length) return;
      const luta = gsap.quickTo(rader, 'skewX', { duration: 0.45, ease: 'power3.out' });
      ST.create({
        trigger: band, start: 'top bottom', end: 'bottom top',
        onUpdate: s => luta(Math.max(-9, Math.min(9, s.getVelocity() / -260)))
      });
      ST.addEventListener('scrollEnd', () => luta(0));
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
  prova('bakgrunder', bakgrunder);
  prova('bandfart', bandfart);
  prova('scrollord', scrollord);
  prova('tipp', tipp);
  prova('mätOm', mätOm);
})();
