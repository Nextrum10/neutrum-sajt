/* ============================================================
   NEXTRUM — PUNKTNÄTET BAKOM NÄSTA STEG (2026-10-29, på alla sidor 2026-10-30)
   Leo skickade en video (en sajt där ett nät av punkter lyser upp kring
   pekaren bakom "Want to train together?"): "kör nåt sånt här där i
   bakrunden". React Bits Dot Grid, i en vanlig 2d-duk: punkterna står
   knappt synliga i bläckets färg, så att ytan läses som sidans papper
   (Leo: "samma färg som resten av sidan i den nyansen"), och kring
   pekaren blir de större, får accentens färg och viker undan en aning,
   och glider tillbaka, bara när man själv rör sig (Leo: "man själv när
   man rör då ska punkterna röra sig inte automatisk").
   Stod först i nextrum-start-scen.js, bara på startsidan. 2026-10-30, Leo:
   "redo att ta nästa steg ska vara samma på alla landings sidor som den
   nya som är på main sidan", så nätet är en egen fil som varje sida med
   Nästa steg laddar, och den ritar ett nät i varje .nx-final-ljus.
   Formen står i cinema (NÄSTA STEG SOM SIDAN).

   Slingan går bara medan nätet syns och något rör sig; med reducerad
   rörelse ritas nätet en gång, utan ljus. Färgerna läses ur sektionens
   tokens och läses om när sidans läge byts. Utan skriptet står ytan som
   sidans papper, utan nät.
   ============================================================ */

(function () {
  'use strict';

  const rot = document.documentElement;
  const reducerad = () => rot.dataset.motion === 'still' || matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* En CSS-färg som tre tal mellan 0 och 1, genom en duk, så att alla
     former (hex, rgb, color-mix) blir samma. */
  function färg(v) {
    const c = document.createElement('canvas').getContext('2d');
    c.fillStyle = '#000';
    c.fillStyle = (v || '').trim() || '#000';
    const hex = c.fillStyle;
    if (hex[0] !== '#') return [0, 0, 0];
    return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  }

  function punktnät(sek) {
    const el = document.createElement('canvas');
    el.className = 'nx-punkter';
    el.setAttribute('aria-hidden', 'true');
    sek.insertBefore(el, sek.firstChild);
    const c = el.getContext('2d');
    if (!c) { el.remove(); return; }
    const AVST = 26, R = 160, stilla = reducerad();
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
    function rita() {
      ram0 = 0;
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
      const lever = inne || styrka > 0.01 || rör;
      if (!stilla && syns && !document.hidden && lever) ram0 = requestAnimationFrame(rita);
    }
    const gå = () => { if (!ram0 && syns && !document.hidden) ram0 = requestAnimationFrame(rita); };
    läs(); bygg(); requestAnimationFrame(rita);
    /* Bara när man själv rör sig (Leo: "man själv när man rör då ska
       punkterna röra sig inte automatisk"): musen, och på en telefon
       fingret, också medan sidan rullas under det. Släpps fingret eller
       lämnar musen tonar ljuset bort. */
    const mot = (x, y) => {
      const r = el.getBoundingClientRect();
      mål.x = x - r.left; mål.y = y - r.top;
      if (!inne) { spot.x = mål.x; spot.y = mål.y; }
      inne = true; gå();
    };
    const släpp = () => { inne = false; gå(); };
    if (!stilla) {
      sek.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') mot(e.clientX, e.clientY); });
      sek.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') släpp(); });
      const finger = e => { const f = e.touches && e.touches[0]; if (f) mot(f.clientX, f.clientY); };
      sek.addEventListener('touchstart', finger, { passive: true });
      sek.addEventListener('touchmove', finger, { passive: true });
      sek.addEventListener('touchend', släpp, { passive: true });
      sek.addEventListener('touchcancel', släpp, { passive: true });
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => { syns = es.some(e => e.isIntersecting); if (syns) gå(); }, { rootMargin: '10% 0px' }).observe(el);
    } else { syns = true; gå(); }
    document.addEventListener('visibilitychange', gå);
    if ('ResizeObserver' in window) new ResizeObserver(() => { bygg(); requestAnimationFrame(rita); }).observe(el);
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { läs(); requestAnimationFrame(rita); });
  }

  function allt() {
    document.querySelectorAll('.nx-final-ljus').forEach(sek => {
      if (sek.querySelector('canvas.nx-punkter')) return;
      try { punktnät(sek); } catch (e) { if (window.console) console.warn('nextrum-punktnat', e); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', allt);
  else allt();
})();
