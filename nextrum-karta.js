/* ============================================================
   NEXTRUM — KARTAN ÖVER STOCKHOLM (2026-10-30)
   Leo, med en skärmdump av kartan över innerstan, Solna och Nacka: "en
   karta som ska vara cool ta inspo av react bits ... Den ska vara aktiv
   röra sig live och vara reaktiv", och om innehållet: "inga fejkade
   statistik utan de ska vara typ aktivt där just nu och en prick". Den
   står under "Rätt person kan göra stor skillnad" (Leo: "under rätt
   person kan göra stor skillnad").

   Kartan är ett nät av punkter (React Bits Dot Grid) där land är punkter
   och vatten är tomt. Vattnet är läst ur Leos skärmdump, en cell per sju
   pixlar (213 × 179, en bit per cell, land = 1), så sidan laddar ingen
   karta från en annan domän (CLAUDE.md, avsnitt 1, Trustpilot). Orterna
   och korten står i markupen (.ka-orter), med orten, delarna och ett
   bibliotek ur ortssidorna (bygg-omradessidor.py), så att kortet bara
   säger det ortssidan redan säger: inga antal, inga personer och inget
   som påstår att något händer just nu.

   Det som rör sig: en våg som går ut genom punkterna från orten i tur,
   ett ljus som vandrar från förra orten till nästa, punkter som tindrar
   och punkter som lyser upp kring pekaren. Korten byts av sig själva var
   fjärde sekund, och pekaren eller ett tryck på en prick tar över.
   Slingan går bara medan kartan syns och fliken är framme; med reducerad
   rörelse ritas nätet en gång och korten står still tills man väljer.
   Utan skriptet står orterna som en lista med länkar.
   Ingen text skrivs härifrån (CLAUDE.md, avsnitt 4): kortets ord står i
   <template class="ka-mall">.
   ============================================================ */

(function () {
  'use strict';

  const KOL = 213, RAD = 179;
  const MASK = '/////////////wfw//////8EwMP/HwAAAADg/////////////wD8/////wcA////DwAAAAD8/////////////w///////wDw////DwAAAID//////////////+P/////H4D/////AwAAAPD///////////////z/////D+D/////BAAAAP7/////////////H///////A/j///8/AAAAwP//////////////x/////8fgP////8PAAAA+P//////////////8/////8D/v////8DAAAA////////////////+P///0/A/////38AAADg//////////////9//v///wH4/////x8AfgD8//////////////+f////P4D//////x+AD57/////////////////////D/D//////wfw5/f////////////////z////Af7//////wH8//////////+////////x//9/gP//////P8D//////////////////3/4//8H8P//////D/j//////////////////x/+//8A/P//////B/7//////////////////4P//x8A/v//////gf////////////////n//8B/fACA////////4f//////////////D/z//+EHAAPw////////////////////////AP//PwAA8AD8//////////////////////8fwP//BAAAHwD+//////////////////////8HAP8fAAD4/4D///////////////////////8A8I8DAAD/P+D///////////////////////8B/3EAAMD/D/D//////////////////////3/gPz9gAOD/Afz/////////////////P/z//w+A4x8/APB4gP//////////////////B/7//wEA8P8PAAAG8P///////////////4F/AP///wAA/v8DAAAA+P///////////+H/P/AfgP//PwDw//8BAAAA////////////f/7/n/8//P//H8D///8AAADg//////////////////+f////D/j//z8AAAD4////////////////////////A/7//w8AAAD4////////////////////////gP//+QcAAAD///8//P////////////////8f8P8//z8AAPD///8D/v////////////////8H/v///w8AgP////+c//////////////////+B/////wcA8P////8f///////////////////w/////wMA/v////8D/v///////////////z/8////fwDg//////8B/P///////////////wf/////HwD4//////8A/v////////////////D/////BwD///////+B////////////////P/z/////AOD////////m//////v/////////j/////8/APz///////////////7////////v4P////8HwP//////////////v/////////8D+P/P/38AxP///////////////////////38A//+A/xxA+P///////////////////////x8A///45wME/////////////////////////wfg//8//2DA///////////////v/////////wP8/////wb4///////////////9////////f+D////+fwD8/////////////3//////////H/z/////DwD//////////////8//////////h///////A8D///////////////H/////////8P////9/APD/////////////P/7///////8H/P////8PAP7/////f/7/////j/////////8A//////8DgP//////z///////8f///////w/x/////38A4P/////5//////8//P///////+P//////w8A+P///z////////8P////////f/7//////wMA/v////f////////h/////////////////w+A///////////////4/////////////////wPw/////////////z//////////////////AQD8///////5/////5////////////////8PAAD//////z/+/////8f///////////////8DAMD///9/wO////////D///////////////8HAPD///8D/v//////f/z///////////////8BAPz////g////////H////////////////z8AAP///x/8////////g////////////////wcAwP///4P///////9/gP///////////////4EH8P////////////8PwP//////////////P/gA+P//f/////////8A4P//////////////hw8A/v///////////wcAwP//////////////eACA//////////+PfwAAAPz/////////////AwCA///////////5xwcAgP////////////8fHwAA/////////4c//gMA4P/////////////5DwAA/P///////+DB/wAA/P///////////7//BwCA////////H378/wHA////////////////AQDg////////x///fwD+B/////////////9/AAD8////////////D+D/gf////////////8PAAAfD/7/////////Af7/4P////////////8DAAACwOf///////8/4P//8f////////////8AAAAAGP7///////8D////+P///////////z8AAAAAx////////3/w/////P///////////wcAAADg/v///////w///////////////////wAAAAD8/////////+H/////+f//////////HwAAAID/////////f/z//////P//////////AwAAAPD/////////n/////8/////////////AQAAAP7/////////4f/////n//////////9/AAAAwP////////8f/P/////8/////x////8/AAAA+P///////3+A/////3///+f//wD///8PAAgA/////////wf4/////+///wAAA4D///8BgAHg////////fwD/////////PwAGAADg/38AOAD8////////D8D/////f///D/gD4Iz//w8AAID/////////A/D////////DAf7w/////wEADOD///////8/APj/////7x8wwP//////PwDgAfz///////8HAPz/D///MQwA8P//////AwB8QPD///////8AAP//AP8/BA4M/P////9/AAAJAPz//////x8A5P8PAA4A+cMD/v////8HAAAAAP7//////+PAx/8AAADgf/jB//////8AAAAgwP//////fz74wR8AAAD+/z/4/////x8AAAAc8P//////xw//AAAAAID/7wf//////wEAAPgP+P////9/+PMXAAAAAMA/AOD/////fwAAgP8H/v////+H//MAAAAAAPAHAPz/////PwAA8P8B///////7PwYA/AMAAPYADPzn//D/HwCA/3+A////////AwD+/wEAgAgAAAD8BwD/AwD8///g//////9/AOD/PwAAEAAAeIB/AAB/ANj//z/w////j/8PAPz/AP//PwAAD/APAAAAwP///w/8////8P8BAADD////DwAAAA4AAAAA/v///x/w//8P/j8AwIf/////DwAAAAAAAADg/////wP8///B/wgA/Pz/////BwAAAAAAAAD/////fwD//x/wB/KB3///////BwAAAAAAgP//////D4D//wEM4P/w+f//////HwAAAMAf+P////8/AOD/PwAA/38A////////HwAAAP+H//////8AAOD/BwD+/x/A////////PwB84D/4/////wcAAPh/APz//3/g////////f/D//8P/////DwAAAPwBgP///z/w////////h///A/7///8LgAcAAB8AwP3//z/8//////////9/4P///38A8BgBAAAgwP///Q/////////3//8P/v///w8AHyAAAADg//8D/sP//////3/+///4/////wHAAQAAAAD+/z+Af/D//////+///4H/////PwAAwAcAAAD8/wfwD/j///////z/B/j/////xwMA/AEAAPD//3//Af7/////n/8fwP///////P+fPwAAAP7///8/AP//////8f/h///////f///PAAAO4P////8DgP////8//p////////////8BAOCD/////38AwP////+D/////////////z8AwP/4/////w/4/////z/A//////////f/PwAA+P///////wM44P///wH4////////f/7/AQCA/////////wED8P//DwD/////////x/8/AAD8/////////wAA+P9/OPz//8f/////9/8DAMD/////////fwAA+P/Dn////4D//////g8EAPz//////////wAA/Af/x////8P///+f/wEAwP//////////PwAA8vj/8///fwD+//8DHAD4/////////////x8A+P///f//BwD4/38AAID//////////////z8A////////AAAA/g8AgP/////////////////w//9/DwQ+AADA/QEA////////////////////////AAAHAIAIIADw//////////////////////////8PAPGDBcD/////////////////////////////////APz///////////////////////////////8f8P/////////////////////////////////D/////////////////////////////////3/+////////////////////5///////////////////////////////////+P////////////////////////////////////////////////////////////////////////////////7/////////////////////////////////g/////////////////////////////////d/8P////////////////////////////////4P/v//////////////////////////////3/+A////////////////////////////////+Q/A//////////////////////////////8//wDw///////////////////////////////P/wP8///////////////////////////////x/4///////////////////////////////3/I/+f//////////////////////////////5////j///////////////////////////////f/P/7/////////////////////////////////n////////////////////////////////////////////////////////////////////////////////////////////////////////f////////////////////////////////+////////////////////////////////////n////////////////////H//////////////8////////////////////4/////////////////////////////////////////////////v/////////////////////////////////P///////////////////////////////////9///////////////////////////////////////////////////////////////////////////////////////////////////////////z///////////////////////////////////8P////////////////////////////////8//v/////////////////////////////////P//////////////9//v////////////////////////////////+P///9///////////////////////////////////////////////////////////7/////////////////////////////////3/+/////////////////////////////////5///////////////////////////////////+f///////////////////////////////////3//////////////////////////38=';

  const rot = document.documentElement;
  const reducerad = () => rot.dataset.motion === 'still' || matchMedia('(prefers-reduced-motion: reduce)').matches;

  let land = null;
  function mask() {
    if (land) return land;
    const s = atob(MASK);
    land = new Uint8Array(KOL * RAD);
    for (let k = 0; k < land.length; k++) land[k] = (s.charCodeAt(k >> 3) >> (k & 7)) & 1;
    return land;
  }
  /* Land i en punkt mellan 0 och 1 i kartans bredd och höjd. */
  const ärLand = (u, v) => {
    const i = Math.floor(u * KOL), j = Math.floor(v * RAD);
    return i >= 0 && j >= 0 && i < KOL && j < RAD && mask()[j * KOL + i] === 1;
  };

  function färg(v) {
    const c = document.createElement('canvas').getContext('2d');
    c.fillStyle = '#000';
    c.fillStyle = (v || '').trim() || '#000';
    const hex = c.fillStyle;
    if (hex[0] !== '#') return [0, 0, 0];
    return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  }
  const rgba = (f, a) => 'rgba(' + f.join(',') + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')';
  const blanda = (a, b, t) => a.map((x, k) => Math.round(x + (b[k] - x) * t));

  function karta(sek) {
    const yta = sek.querySelector('.ka-karta');
    const lista = sek.querySelector('.ka-orter');
    const mall = sek.querySelector('template.ka-mall');
    if (!yta || !lista || !mall) return;
    const el = document.createElement('canvas');
    el.className = 'ka-duk';
    el.setAttribute('aria-hidden', 'true');
    yta.insertBefore(el, yta.firstChild);
    const c = el.getContext('2d');
    if (!c) { el.remove(); return; }
    const stilla = reducerad();

    /* Orterna ur listan: en prick och ett kort var. */
    const orter = [...lista.querySelectorAll('li[data-ka-x]')].map(li => {
      const a = li.querySelector('a');
      return {
        x: parseFloat(li.dataset.kaX) / 100, y: parseFloat(li.dataset.kaY) / 100,
        namn: (li.querySelector('b') || {}).textContent || '',
        kort: li.dataset.kaKort || '',
        delar: (li.querySelector('.ka-delar') || {}).textContent || '',
        bibl: (li.querySelector('.ka-bibl') || {}).textContent || '',
        lank: a ? a.getAttribute('href') : '#',
        lanktext: (li.querySelector('.ka-lank') || {}).textContent || ''
      };
    });
    if (!orter.length) return;

    const prickar = document.createElement('div');
    prickar.className = 'ka-prickar';
    prickar.setAttribute('aria-hidden', 'true');
    orter.forEach((o, i) => {
      const p = document.createElement('button');
      p.type = 'button';
      p.className = 'ka-prick';
      p.tabIndex = -1;
      p.style.left = (o.x * 100) + '%';
      p.style.top = (o.y * 100) + '%';
      p.style.setProperty('--i', i);
      p.innerHTML = '<span class="ka-ring"></span><span class="ka-karna"></span><span class="ka-namn"></span>';
      p.querySelector('.ka-namn').textContent = o.kort || o.namn;
      o.prick = p;
      prickar.appendChild(p);
    });
    yta.appendChild(prickar);

    const kort = mall.content.firstElementChild.cloneNode(true);
    kort.setAttribute('aria-hidden', 'true');
    kort.querySelectorAll('a').forEach(a => { a.tabIndex = -1; });
    yta.appendChild(kort);
    sek.classList.add('igang');

    let w = 0, h = 0, dpr = 1, steg = 8, pkt = [], bas = null;
    let ink = [0, 0, 0], acc = [0, 0, 0], mossa = [0, 0, 0];
    let syns = false, ram0 = 0, aktiv = -1, förra = -1, bytt = 0, styrka = 0, inne = false, låst = false;
    const spot = { x: -999, y: -999 }, mål = { x: -999, y: -999 };
    let tindra = [];

    function läs() {
      const cs = getComputedStyle(sek);
      ink = färg(cs.getPropertyValue('--bl'));
      acc = färg(cs.getPropertyValue('--acc'));
      mossa = färg(cs.getPropertyValue('--mossa'));
    }
    function bygg() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = el.clientWidth; h = el.clientHeight;
      if (!w || !h) return;
      el.width = Math.round(w * dpr); el.height = Math.round(h * dpr);
      steg = Math.max(6, Math.min(11, w / 140));
      pkt = [];
      for (let y = steg / 2; y < h; y += steg) {
        for (let x = steg / 2; x < w; x += steg) {
          if (ärLand(x / w, y / h)) pkt.push({ x, y });
        }
      }
      /* Nätet i vila ritas en gång i en egen duk; varje bildruta lägger
         bara det som lyser ovanpå. */
      bas = document.createElement('canvas');
      bas.width = el.width; bas.height = el.height;
      const b = bas.getContext('2d');
      b.setTransform(dpr, 0, 0, dpr, 0, 0);
      b.fillStyle = rgba(ink, 0.3);
      const r = steg * 0.21;
      b.beginPath();
      for (const p of pkt) { b.moveTo(p.x + r, p.y); b.arc(p.x, p.y, r, 0, Math.PI * 2); }
      b.fill();
      tindra = [];
      for (let k = 0; k < Math.min(70, pkt.length); k++) tindra.push({ p: pkt[(Math.random() * pkt.length) | 0], f: Math.random() * 6.28, v: 0.6 + Math.random() * 0.9 });
    }

    /* Kortet bredvid pricken, på den sida där det får plats. */
    function visaKort(i) {
      const o = orter[i];
      kort.querySelector('.ka-k-namn').textContent = o.namn;
      kort.querySelector('.ka-k-delar').textContent = o.delar;
      const bi = kort.querySelector('.ka-k-bibl');
      bi.textContent = o.bibl; bi.hidden = !o.bibl;
      const a = kort.querySelector('.ka-k-lank');
      a.setAttribute('href', o.lank);
      const lt = a.querySelector('.ka-k-lanktext');
      if (lt) lt.textContent = o.lanktext;
      kort.classList.toggle('vanster', o.x > 0.58);
      kort.classList.toggle('under', o.y < 0.3);
      kort.style.left = (o.x * 100) + '%';
      kort.style.top = (o.y * 100) + '%';
      kort.classList.remove('in');
      void kort.offsetWidth;
      kort.classList.add('in');
    }
    function välj(i) {
      if (i === aktiv) return;
      förra = aktiv; aktiv = i; bytt = performance.now();
      orter.forEach((o, k) => o.prick.classList.toggle('pa', k === i));
      visaKort(i);
      gå();
    }
    function nästa() {
      let i = aktiv;
      /* Aldrig samma ort två gånger, och helst en bit bort, så att ljuset
         hinner gå en sträcka över kartan. */
      for (let f = 0; f < 8; f++) {
        i = (Math.random() * orter.length) | 0;
        if (i === aktiv) continue;
        if (aktiv < 0) break;
        const d = Math.hypot(orter[i].x - orter[aktiv].x, orter[i].y - orter[aktiv].y);
        if (d > 0.22) break;
      }
      välj(i);
    }

    function rita(nu) {
      ram0 = 0;
      if (!bas || !w) return;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, el.width, el.height);
      c.drawImage(bas, 0, 0);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const t = nu / 1000, r0 = steg * 0.21;

      if (!stilla) {
        /* Tindrande punkter. */
        for (const s of tindra) {
          const e = Math.max(0, Math.sin(t * s.v + s.f));
          if (e < 0.05) continue;
          c.fillStyle = rgba(blanda(ink, acc, 0.6), 0.2 + 0.55 * e * e);
          c.beginPath(); c.arc(s.p.x, s.p.y, r0 + steg * 0.14 * e, 0, Math.PI * 2); c.fill();
        }
      }

      const sedan = (nu - bytt) / 1000;
      if (aktiv >= 0 && !stilla) {
        const o = orter[aktiv], ox = o.x * w, oy = o.y * h;
        /* Vågen från orten: en ring som går ut genom punkterna. */
        const R = Math.max(w, h) * 0.42, rr = (sedan % 2.6) / 2.6 * R, band = steg * 3.2;
        const svag = 1 - rr / R;
        c.fillStyle = rgba(acc, 0.85);
        for (const p of pkt) {
          const d = Math.hypot(p.x - ox, p.y - oy);
          const e = 1 - Math.abs(d - rr) / band;
          if (e <= 0) continue;
          c.globalAlpha = Math.min(1, e * svag * 0.9);
          c.beginPath(); c.arc(p.x, p.y, r0 + steg * 0.16 * e, 0, Math.PI * 2); c.fill();
        }
        c.globalAlpha = 1;
        /* Ljuset från förra orten, längs en båge. */
        if (förra >= 0 && sedan < 1.6) {
          const f = orter[förra], ax = f.x * w, ay = f.y * h;
          const mx = (ax + ox) / 2, my = (ay + oy) / 2 - Math.hypot(ox - ax, oy - ay) * 0.28;
          const q = Math.min(1, sedan / 1.1), ut = Math.max(0, (sedan - 1.1) / 0.5);
          const punkt = s => [(1 - s) * (1 - s) * ax + 2 * (1 - s) * s * mx + s * s * ox, (1 - s) * (1 - s) * ay + 2 * (1 - s) * s * my + s * s * oy];
          const lätt = 1 - Math.pow(1 - q, 3);
          const N = 26;
          c.lineCap = 'round';
          for (let k = 0; k < N; k++) {
            const s0 = Math.max(0, lätt - 0.35 + 0.35 * k / N), s1 = Math.max(0, lätt - 0.35 + 0.35 * (k + 1) / N);
            if (s1 <= 0) continue;
            const [x0, y0] = punkt(s0), [x1, y1] = punkt(s1);
            c.strokeStyle = rgba(acc, (k / N) * 0.9 * (1 - ut));
            c.lineWidth = 1 + 2.2 * (k / N);
            c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
          }
          const [hx, hy] = punkt(lätt);
          const g = c.createRadialGradient(hx, hy, 0, hx, hy, steg * 2.4);
          g.addColorStop(0, rgba(acc, 0.9 * (1 - ut)));
          g.addColorStop(1, rgba(acc, 0));
          c.fillStyle = g;
          c.beginPath(); c.arc(hx, hy, steg * 2.4, 0, Math.PI * 2); c.fill();
        }
      }

      /* Pekaren: punkterna lyser upp kring den. */
      styrka += ((inne && !stilla ? 1 : 0) - styrka) * 0.1;
      spot.x += (mål.x - spot.x) * 0.25; spot.y += (mål.y - spot.y) * 0.25;
      if (styrka > 0.01) {
        const R = steg * 11;
        for (const p of pkt) {
          const dx = p.x - spot.x, dy = p.y - spot.y;
          if (Math.abs(dx) > R || Math.abs(dy) > R) continue;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d >= R) continue;
          let e = 1 - d / R; e = e * e * (3 - 2 * e) * styrka;
          c.fillStyle = rgba(blanda(ink, mossa, e), 0.3 + 0.65 * e);
          c.beginPath(); c.arc(p.x, p.y, r0 + steg * 0.2 * e, 0, Math.PI * 2); c.fill();
        }
      }

      if (!stilla && syns && !document.hidden) ram0 = requestAnimationFrame(rita);
    }
    const gå = () => { if (!ram0 && syns && !document.hidden) ram0 = requestAnimationFrame(rita); };

    /* Korten byts av sig själva medan kartan syns och ingen pekar på den. */
    let klocka = 0;
    function snurra() {
      clearTimeout(klocka);
      if (stilla) return;
      klocka = setTimeout(() => {
        if (syns && !document.hidden && !låst) nästa();
        snurra();
      }, 4200);
    }

    läs(); bygg();
    välj(0);
    requestAnimationFrame(rita);
    snurra();

    orter.forEach((o, i) => {
      o.prick.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') { låst = true; välj(i); } });
      o.prick.addEventListener('click', () => { låst = true; välj(i); snurra(); });
    });
    const mot = (x, y) => {
      const r = el.getBoundingClientRect();
      mål.x = x - r.left; mål.y = y - r.top;
      if (!inne) { spot.x = mål.x; spot.y = mål.y; }
      inne = true; gå();
      if (stilla) requestAnimationFrame(rita);
    };
    yta.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') mot(e.clientX, e.clientY); });
    yta.addEventListener('pointerleave', e => {
      if (e.pointerType === 'touch') return;
      inne = false; låst = false; gå();
    });
    /* Ett tryck utanför prickarna släpper kortet igen. */
    yta.addEventListener('click', e => { if (!e.target.closest('.ka-prick, .ka-kort')) låst = false; });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => {
        syns = es.some(e => e.isIntersecting);
        sek.classList.toggle('syns', syns);
        if (syns) gå();
      }, { rootMargin: '10% 0px' }).observe(yta);
    } else { syns = true; gå(); }
    document.addEventListener('visibilitychange', gå);
    if ('ResizeObserver' in window) new ResizeObserver(() => { bygg(); requestAnimationFrame(rita); }).observe(el);
    const omLäge = () => { läs(); bygg(); requestAnimationFrame(rita); };
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', omLäge);
  }

  function allt() {
    document.querySelectorAll('[data-karta]').forEach(sek => {
      if (sek.classList.contains('igang')) return;
      try { karta(sek); } catch (e) { if (window.console) console.warn('nextrum-karta', e); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', allt);
  else allt();
})();
