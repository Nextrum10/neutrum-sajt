/* ============================================================
   NEXTRUM — Prova NexLäx (2026-10-31), sidan /prova-nexlax

   Gör frågorna i markupen till en nivå man spelar en fråga i taget.
   Facit står i markupen (data-ratt), och rättningen sker här: frågorna
   är våra egna exempel, aldrig bankens, som rättas i databasen. Sidan
   når inte databasen, sparar ingenting och räknar inga XP.

   Ingen text här: orden står i data-t-* på [data-pn] och svaret med
   förklaringen under Visa svaret. Utan skriptet står frågorna som en
   lista med svaren under, och det är också det en sökmotor läser.

   Talregeln är lösare än intern.niva_tal med flit: en skrivfråga här
   har ett heltal som svar, och "x = 9" eller "9 " räknas som 9.
   ============================================================ */
(function () {
  'use strict';

  const rot = document.querySelector('[data-pn]');
  if (!rot) return;

  const t = (n) => rot.getAttribute('data-t-' + n) || '';
  const banor = [...rot.querySelectorAll('[data-pn-bana]')];
  const valen = [...rot.querySelectorAll('[data-pn-valj]')];
  const spelare = rot.querySelector('[data-pn-spelare]');
  const kort = rot.querySelector('[data-pn-kort]');
  const steg = rot.querySelector('[data-pn-steg]');
  const prickar = rot.querySelector('[data-pn-prickar]');
  const resultat = rot.querySelector('[data-pn-resultat]');
  if (!banor.length || !spelare || !kort || !resultat) return;

  rot.classList.add('pn-igang');
  spelare.hidden = false;

  let fragor = [];
  let nr = 0;
  let poang = 0;
  let besvarad = false;

  function el(tagg, klass, text) {
    const e = document.createElement(tagg);
    if (klass) e.className = klass;
    if (text != null) e.textContent = text;
    return e;
  }

  function läsBana(bana) {
    return [...bana.querySelectorAll('.pn-fraga')].map((li) => ({
      typ: li.dataset.typ,
      ratt: li.dataset.ratt,
      fraga: li.querySelector('.pn-q'),
      alt: [...li.querySelectorAll('.pn-alt li')],
      altLang: li.querySelector('.pn-alt')?.getAttribute('lang') || null,
      svar: li.querySelector('.pn-svar p'),
    }));
  }

  function normTal(s) {
    const m = String(s).replace(/\s+/g, '').replace(',', '.').match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : NaN;
  }

  function ritaPrickar() {
    prickar.replaceChildren(...fragor.map((f, i) => {
      const p = el('li', 'pn-prick');
      if (f.resultat === true) p.classList.add('ratt');
      else if (f.resultat === false) p.classList.add('fel');
      if (i === nr) p.classList.add('nu');
      return p;
    }));
    steg.textContent = t('fraga') + ' ' + (nr + 1) + ' ' + t('av') + ' ' + fragor.length;
  }

  function visaFråga() {
    besvarad = false;
    const f = fragor[nr];
    const q = el('p', 'pn-kort-q');
    q.innerHTML = f.fraga.innerHTML;
    const delar = [q];

    if (f.typ === 'val') {
      const grupp = el('div', 'pn-kort-alt');
      if (f.altLang) grupp.lang = f.altLang;
      f.alt.forEach((li, i) => {
        const b = el('button', 'pn-alt-knapp', li.textContent);
        b.type = 'button';
        b.addEventListener('click', () => svara(String(i), b));
        grupp.append(b);
      });
      delar.push(grupp);
    } else {
      const form = el('form', 'pn-kort-skriv');
      const inp = el('input', 'inp');
      inp.inputMode = 'decimal';
      inp.autocomplete = 'off';
      inp.setAttribute('aria-label', t('skriv'));
      inp.placeholder = t('skriv');
      const knapp = el('button', 'btn btn-primary', t('kolla'));
      knapp.type = 'submit';
      form.append(inp, knapp);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!inp.value.trim() || besvarad) return;
        inp.readOnly = true;
        svara(inp.value, inp);
      });
      delar.push(form);
    }
    kort.replaceChildren(...delar);
    ritaPrickar();
    const första = kort.querySelector('button, input');
    if (första && nr > 0) första.focus({ preventScroll: true });
  }

  function svara(värde, källa) {
    if (besvarad) return;
    besvarad = true;
    const f = fragor[nr];
    const rätt = f.typ === 'val'
      ? värde === f.ratt
      : normTal(värde) === Number(f.ratt);
    f.resultat = rätt;
    if (rätt) poang += 1;

    if (f.typ === 'val') {
      kort.querySelectorAll('.pn-alt-knapp').forEach((b, i) => {
        b.disabled = true;
        if (String(i) === f.ratt) b.classList.add('ratt');
      });
      if (!rätt) källa.classList.add('fel');
    } else {
      källa.classList.add(rätt ? 'ratt' : 'fel');
      kort.querySelector('.pn-kort-skriv button').disabled = true;
    }

    const besked = el('div', 'pn-besked ' + (rätt ? 'ratt' : 'fel'));
    besked.append(el('b', null, rätt ? t('ratt') : t('fel')));
    const förklaring = el('p');
    förklaring.innerHTML = f.svar.innerHTML;
    if (!rätt) förklaring.prepend(t('facit') + ' ');
    besked.append(förklaring);

    const sist = nr === fragor.length - 1;
    const vidare = el('button', 'btn btn-primary pn-vidare', sist ? t('klar') : t('nasta'));
    vidare.type = 'button';
    vidare.addEventListener('click', () => {
      if (sist) visaResultat();
      else { nr += 1; visaFråga(); }
    });
    kort.append(besked, vidare);
    ritaPrickar();
    vidare.focus({ preventScroll: true });
  }

  function visaResultat() {
    spelare.hidden = true;
    resultat.querySelector('[data-pn-poang]').textContent = String(poang);
    resultat.querySelector('[data-pn-antal]').textContent = String(fragor.length);
    resultat.hidden = false;
    resultat.focus({ preventScroll: true });
    // Spelaren var högre än resultatet, så det kan hamna ovanför skärmen.
    const r = resultat.getBoundingClientRect();
    if (r.top < 80 || r.bottom > window.innerHeight) {
      resultat.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
  }

  function starta(amne) {
    const bana = banor.find((b) => b.dataset.pnBana === amne) || banor[0];
    banor.forEach((b) => b.classList.toggle('vald', b === bana));
    valen.forEach((v) => v.setAttribute('aria-pressed', String(v.dataset.pnValj === bana.dataset.pnBana)));
    rot.style.setProperty('--f', bana.style.getPropertyValue('--f'));
    fragor = läsBana(bana);
    nr = 0;
    poang = 0;
    resultat.hidden = true;
    spelare.hidden = false;
    visaFråga();
  }

  valen.forEach((v) => v.addEventListener('click', () => starta(v.dataset.pnValj)));

  const igen = resultat.querySelector('[data-pn-igen]');
  if (igen) {
    igen.addEventListener('click', () => {
      const nu = valen.findIndex((v) => v.getAttribute('aria-pressed') === 'true');
      const nästa = valen[(nu + 1) % valen.length];
      starta(nästa.dataset.pnValj);
      nästa.focus({ preventScroll: true });
    });
  }

  starta(valen[0]?.dataset.pnValj);
})();
