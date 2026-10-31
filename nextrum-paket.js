/* ============================================================
   Höstpaketet över startsidans Just nu (2026-10-31, Leo: "kunden
   behöver klicka på erbjudandet för att se det", "något höstigt och
   kanske halloweenaktigt").

   Omslaget står i markupen med hidden, så utan skriptet syns
   erbjudandet som förut. Skriptet visar det, gör kortet bakom inert
   (inget att tabba till under papperet) och öppnar det vid ett klick:
   skriptet sätter klasser, CSS rör sig. Inget sparas: paketet står
   inslaget igen vid nästa besök. Fladdermössen visas bara 20 oktober
   till 2 november, så att paketet är höstigt resten av hösten.
   ============================================================ */
(function () {
  'use strict';

  function start() {
    const lock = document.querySelector('[data-paket]');
    const kort = lock && lock.closest('.jn-kort');
    if (!kort) return;

    const nu = new Date();
    const m = nu.getMonth(), d = nu.getDate();
    if ((m === 9 && d >= 20) || (m === 10 && d <= 2)) lock.setAttribute('data-halloween', '');

    const bakom = Array.from(kort.children).filter(function (el) { return el !== lock; });
    bakom.forEach(function (el) { el.inert = true; });
    kort.classList.add('ar-paketerat');
    lock.hidden = false;

    lock.addEventListener('click', function () {
      if (lock.classList.contains('jp-oppnar')) return;
      const medTangent = document.activeElement === lock;
      lock.classList.add('jp-oppnar');
      kort.classList.add('ar-oppnas');
      bakom.forEach(function (el) { el.inert = false; });
      kort.classList.remove('ar-paketerat');
      const lugn = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(function () {
        lock.remove();
        kort.classList.remove('ar-oppnas');
        if (medTangent) {
          const h = kort.querySelector('h2');
          if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
        }
      }, lugn ? 260 : 1150);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
