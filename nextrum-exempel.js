/* ============================================================
   NEXTRUM — exemplen på startsidan (2026-10-22)

   "Så ser ni att det funkar" (index.html och en/index.html, 1d): tre
   delar, rapporten, studieplanen och vyn som förälder. Utan det här
   skriptet står de under varandra, var och en med sin rubrik, och så
   läser också den som inte kör skript dem.

   Med skriptet blir de flikar efter WAI-ARIA:s mönster: tablist, tab
   och tabpanel, bara den valda fliken i tabbordningen, piltangenterna
   byter flik åt båda hållen och runt, Home och End går till första och
   sista, och fliken väljs när den får fokus (automatisk aktivering:
   panelerna står redan i sidan, och inget behöver hämtas). Panelens
   rubrik göms för ögat men står kvar för skärmläsaren.

   Skriptet skriver ingen text: allt man läser står i markupen, på
   båda språken. Listan får sitt namn av sektionens rubrik.
   ============================================================ */
const NXExempel = (function () {
  'use strict';

  function flikar(rot) {
    const lista = rot.querySelector('[data-ex-flikar]');
    const knappar = Array.from(rot.querySelectorAll('[data-ex-flik]'));
    const paneler = knappar.map(k => rot.querySelector('[data-ex-panel="' + k.dataset.exFlik + '"]'));
    if (!lista || !knappar.length || paneler.some(p => !p)) return null;

    const rubrik = rot.querySelector('h2[id]');
    lista.setAttribute('role', 'tablist');
    if (rubrik) lista.setAttribute('aria-labelledby', rubrik.id);
    knappar.forEach((k, i) => {
      const p = paneler[i];
      k.id = 'ex-flik-' + k.dataset.exFlik;
      k.setAttribute('role', 'tab');
      k.setAttribute('aria-controls', p.id);
      p.setAttribute('role', 'tabpanel');
      p.setAttribute('aria-labelledby', k.id);
      p.tabIndex = 0;
    });

    let vald = -1;
    function välj(i, fokus) {
      if (i === vald) { if (fokus) knappar[i].focus(); return; }
      vald = i;
      knappar.forEach((k, n) => {
        const på = n === i;
        k.setAttribute('aria-selected', på ? 'true' : 'false');
        k.tabIndex = på ? 0 : -1;
        paneler[n].hidden = !på;
      });
      if (fokus) knappar[i].focus();
    }

    knappar.forEach((k, i) => k.addEventListener('click', () => välj(i, false)));
    lista.addEventListener('keydown', e => {
      const nu = knappar.indexOf(document.activeElement);
      if (nu < 0) return;
      const n = knappar.length;
      const mål = e.key === 'ArrowRight' ? (nu + 1) % n
        : e.key === 'ArrowLeft' ? (nu - 1 + n) % n
        : e.key === 'Home' ? 0
        : e.key === 'End' ? n - 1
        : -1;
      if (mål < 0) return;
      e.preventDefault();
      välj(mål, true);
    });

    rot.classList.add('ar-flikar');
    lista.hidden = false;
    välj(0, false);
    return { välj };
  }

  const alla = Array.from(document.querySelectorAll('[data-exempel]')).map(flikar);
  return { flikar, alla };
})();
