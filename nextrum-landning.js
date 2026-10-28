/* ============================================================
   NEXTRUM — RÖRELSEN PÅ LANDNINGSSIDORNA (laxhjalp-*)
   2026-10-28, Leo: "göra den lite roligare ... främst alla landings
   sidor", med GSAP. Bara de nya delarna rör sig här: stegen, linjen
   och korten. Rubrikerna, .rv och parallaxen är nextrum-motion.js och
   rörs inte.

   Undantaget från "skriptet sätter klasser, CSS rör sig": GSAP skriver
   transform per bildruta på skenan, linjen och korten. Stegen tänds
   fortfarande med en klass. Utan GSAP, eller med reducerad rörelse,
   står allt färdigt som CSS ritar det.
   ============================================================ */

(function () {
  'use strict';

  const rot = document.documentElement;
  if (!window.gsap || !window.ScrollTrigger) return;
  if (rot.dataset.motion === 'still' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  gsap.registerPlugin(ScrollTrigger);
  rot.classList.add('lp-rorelse');
  const lite = rot.dataset.motion === 'lite';
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

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

  /* Korten och listans rader kommer in i tur när de syns. Transformen
     tas bort efteråt, så att hovringen i cinema får sin egen tillbaka. */
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
  iTur('.nx-list > li', { x: -14 });

  /* Typsnittet och bilderna flyttar sidan när de kommer: räkna om
     triggarnas lägen då, annars tänds stegen på fel höjd. */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
})();
