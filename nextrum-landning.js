/* ============================================================
   NEXTRUM — LANDNINGSSIDORNA (laxhjalp-*)
   2026-10-28, Leo: "göra den lite roligare ... främst alla landings
   sidor", med GSAP, och samma natt "mer reaktiv och kul att gå igenom".

   Två delar. Det man trycker på (flikarna, ljuset över korten) fungerar
   alltid, också med reducerad rörelse och utan GSAP. Det som rör sig
   (stegen, linjen, korten i tur, lästråden) kräver GSAP och att
   rörelsen inte är avslagen. Rubrikerna, .rv och parallaxen är
   nextrum-motion.js och rörs inte.

   Undantaget från "skriptet sätter klasser, CSS rör sig": GSAP skriver
   transform per bildruta på skenan, linjen, korten och lästråden.
   Stegen tänds fortfarande med en klass. Utan skriptet står allt
   färdigt som CSS ritar det: flikarnas innehåll som en lista.
   ============================================================ */

(function () {
  'use strict';

  const rot = document.documentElement;
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const rörelse = !!(window.gsap && window.ScrollTrigger) && rot.dataset.motion !== 'still' &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- flikarna ----------
     En behållare med data-lp-flikar och barn med data-lp-flik="Etikett"
     blir en flikrad med en markering som glider. Panelerna står i samma
     rutnätscell, så behållaren är lika hög som den högsta: inget under
     den hoppar när man byter (cinema, Fyra fällor 4). */
  let nr = 0;
  function flikar(el) {
    const paneler = $$(':scope > [data-lp-flik]', el);
    if (paneler.length < 2) return;
    const id = 'lp-f' + (++nr);
    const rad = document.createElement('div');
    rad.className = 'lp-flikrad';
    rad.setAttribute('role', 'tablist');
    if (el.dataset.lpFlikar) rad.setAttribute('aria-label', el.dataset.lpFlikar);
    const pil = document.createElement('span');
    pil.className = 'lp-flikpil';
    pil.setAttribute('aria-hidden', 'true');
    rad.appendChild(pil);

    const knappar = paneler.map((p, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lp-flik';
      b.id = `${id}-t${i}`;
      b.setAttribute('role', 'tab');
      b.textContent = p.dataset.lpFlik;
      p.id = p.id || `${id}-p${i}`;
      p.setAttribute('role', 'tabpanel');
      p.setAttribute('aria-labelledby', b.id);
      b.setAttribute('aria-controls', p.id);
      rad.appendChild(b);
      return b;
    });
    if (el.tagName === 'UL' || el.tagName === 'OL') el.setAttribute('role', 'presentation');
    el.parentNode.insertBefore(rad, el);
    el.classList.add('lp-flikar-pa');

    let vald = -1;
    function läggPil() {
      const b = knappar[vald];
      if (!b) return;
      pil.style.width = b.offsetWidth + 'px';
      pil.style.translate = b.offsetLeft + 'px 0';
    }
    function välj(i, fokus) {
      if (i === vald) return;
      const förra = paneler[vald];
      vald = i;
      knappar.forEach((b, j) => {
        b.setAttribute('aria-selected', String(j === i));
        b.tabIndex = j === i ? 0 : -1;
      });
      paneler.forEach((p, j) => { p.classList.toggle('lp-vald', j === i); p.inert = j !== i; });
      läggPil();
      // Raden rullas på raden själv, aldrig med scrollIntoView (cinema, fälla 3).
      const b = knappar[i];
      if (rad.scrollWidth > rad.clientWidth) {
        rad.scrollTo({ left: b.offsetLeft - (rad.clientWidth - b.offsetWidth) / 2, behavior: rörelse ? 'smooth' : 'auto' });
      }
      if (fokus) b.focus();
      if (rörelse && förra) {
        gsap.fromTo(paneler[i], { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', clearProps: 'opacity,transform' });
      }
    }
    knappar.forEach((b, i) => {
      b.addEventListener('click', () => välj(i));
      b.addEventListener('keydown', e => {
        const n = knappar.length;
        const mål = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
        if (mål === undefined) return;
        e.preventDefault();
        välj(mål, true);
      });
    });
    välj(0);
    rad.classList.add('lp-klar');
    if ('ResizeObserver' in window) new ResizeObserver(läggPil).observe(rad);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(läggPil);
  }
  $$('[data-lp-flikar]').forEach(flikar);

  /* ---------- ljuset över korten ----------
     Bara med mus. Läget skrivs på kortet som pekaren står på, där
     ::before läser det, och högst en gång per bildruta. */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let kort = null, x = 0, y = 0, väntar = false;
    document.addEventListener('pointermove', e => {
      const k = e.target.closest && e.target.closest('.nx-omr-kort');
      if (!k) return;
      kort = k; x = e.clientX; y = e.clientY;
      if (väntar) return;
      väntar = true;
      requestAnimationFrame(() => {
        väntar = false;
        const r = kort.getBoundingClientRect();
        kort.style.setProperty('--mx', (x - r.left) + 'px');
        kort.style.setProperty('--my', (y - r.top) + 'px');
      });
    }, { passive: true });
  }

  if (!rörelse) return;

  gsap.registerPlugin(ScrollTrigger);
  rot.classList.add('lp-rorelse');
  const lite = rot.dataset.motion === 'lite';

  /* Lästråden: hur långt man kommit på sidan, överst. */
  const tråd = document.createElement('div');
  tråd.className = 'lp-las';
  tråd.setAttribute('aria-hidden', 'true');
  // I main, så att den ärver ämnets färg (--lp-f).
  (document.querySelector('main') || document.body).appendChild(tråd);
  gsap.fromTo(tråd, { scaleX: 0 }, {
    scaleX: 1, ease: 'none',
    scrollTrigger: { trigger: document.documentElement, start: 'top top', end: 'bottom bottom', scrub: lite ? true : 0.3 }
  });

  /* Stegen: skenan fylls med scrollen, och ett steg tänds när det når
     samma höjd som fyllningens kant. */
  $$('[data-lp-steg]').forEach(el => {
    const fyll = el.querySelector('.lp-steg-fyll');
    if (fyll) {
      gsap.fromTo(fyll, { scaleY: 0 }, {
        scaleY: 1, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 72%', end: 'bottom 62%', scrub: lite ? true : 0.6 }
      });
    }
    $$('li', el).forEach(li => ScrollTrigger.create({
      trigger: li, start: 'top 68%',
      onEnter: () => li.classList.add('lp-tand'),
      onLeaveBack: () => li.classList.remove('lp-tand')
    }));
  });

  /* Linjen: dras ut en gång, och stationerna ploppar upp efter den. */
  const mm = gsap.matchMedia();
  mm.add({ bred: '(min-width: 861px)', smal: '(max-width: 860px)' }, ctx => {
    $$('[data-lp-linje]').forEach(el => {
      const spar = el.querySelector('.lp-linje-spar');
      const prickar = $$('i', el);
      const namn = $$('li > span', el);
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 80%', once: true } });
      tl.from(spar, ctx.conditions.bred
        ? { scaleX: 0, duration: 1.1, ease: 'power2.inOut' }
        : { scaleY: 0, duration: 1.1, ease: 'power2.inOut' })
        .from(prickar, { scale: 0, duration: 0.4, stagger: 0.06, ease: 'back.out(2.6)' }, 0.15)
        .from(namn, ctx.conditions.bred ? { opacity: 0, y: -6, duration: 0.4, stagger: 0.06 }
                                       : { opacity: 0, x: -8, duration: 0.4, stagger: 0.06 }, 0.25);
    });
  });

  /* Korten och flikarnas knappar kommer in i tur när de syns.
     Transformen tas bort efteråt, så att hovringen i cinema får sin
     egen tillbaka. */
  function iTur(sel, från) {
    const el = $$(sel);
    if (!el.length) return;
    gsap.set(el, Object.assign({ opacity: 0 }, från));
    ScrollTrigger.batch(el, {
      start: 'top 92%', once: true,
      onEnter: grupp => gsap.to(grupp, {
        opacity: 1, x: 0, y: 0, duration: 0.55, ease: 'power2.out',
        // Högst en halv sekund i tur, också när en hel rad kommer på en gång.
        stagger: Math.min(0.07, 0.5 / grupp.length),
        clearProps: 'opacity,transform'
      })
    });
  }
  iTur('.nx-omr-kort', { y: 18 });
  iTur('.lp-flik', { y: 10 });

  /* Typsnittet och bilderna flyttar sidan när de kommer: räkna om
     triggarnas lägen då, annars tänds stegen på fel höjd. */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
})();
