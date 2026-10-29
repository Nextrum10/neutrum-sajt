/* ============================================================
   NEXTRUM — STARTSIDANS SCENER (2026-10-29)
   Leo: "Just nu är mycket bara i kolumner och tråkiga", med
   reactbits.dev som förebild, och samma kväll, efter två varv med
   rutor: "Jag sa ta inspiration av animationer osv på react bits, snygga
   rörliga bakgrunder, hur texter går osv". React Bits är React; här
   finns inget ramverk och inget byggsteg, så det som togs därifrån är
   skrivet om för hand, i sidans egen stil:

     bakgrunder Threads: trådar i WebGL i ett nedtonat band under Hur
                hjälper vis rad, i färgen från kortet i fokus. Dot Grid: ett
                nät av punkter bakom Nästa steg som lyser upp kring pekaren
                (efter Leos video). Ritas bara medan de syns och fliken är
                framme, och står still med reducerad rörelse.
     hjscen     Hur hjälper vi som en rad man sveper i själv, med pilar på
                dator: Leo om raden som scrollen drog, "Vi är ett läxhjälps
                företag ... inte et tech bolag. Så vi kör istället att man
                scrollar själv åt vänster". Ett korts rubrik stiger upp ur
                en springa när kortet kommer in (SplitText), och texten
                tonar fram ur sudd (BlurText).
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
   Fokus och inträde i raden sätts med klasser, och övergångarna är CSS.
   Inget här räknar om sidans layout.

   Utan det här skriptet, utan GSAP eller med reducerad rörelse står
   allt som nextrum-start.js lämnar det: korten i en rad att svepa i,
   orden som tonar fram när rubriken syns och fönstret som reser sig.
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

  /* ---------- duken (WebGL) ----------
     En triangel över hela duken, ett program och slingan; shadern och
     det som ändras per bild kommer utifrån. Det som håller
     det billigt: duken ritas i en bråkdel av sin storlek (skala) och
     skalas upp av webbläsaren, slingan går bara medan duken syns och
     fliken är framme, och med reducerad rörelse ritas en enda bild.
     Finns ingen WebGL står ytans egen bakgrund kvar (CSS). Färgerna läses
     ur CSS på elementet runt duken, så de följer sidans tokens och
     mörka läget. */
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}';

  function färg(v) {
    const c = document.createElement('canvas').getContext('2d');
    c.fillStyle = '#000';
    c.fillStyle = (v || '').trim() || '#000';
    const hex = c.fillStyle;
    if (hex[0] !== '#') return [0, 0, 0];
    return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  }

  function duk(el, FS, val) {
    if (el.dataset.gl === 'klar') return null;
    el.dataset.gl = 'klar';
    const gl = el.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, powerPreference: 'low-power' });
    if (!gl) return null;
    const skugga = (typ, källa) => {
      const sk = gl.createShader(typ);
      gl.shaderSource(sk, källa); gl.compileShader(sk);
      return gl.getShaderParameter(sk, gl.COMPILE_STATUS) ? sk : null;
    };
    const v = skugga(gl.VERTEX_SHADER, VS), f = skugga(gl.FRAGMENT_SHADER, FS);
    if (!v || !f) return null;
    const pr = gl.createProgram();
    gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = n => gl.getUniformLocation(pr, n);
    const uT = u('t'), uR = u('r');

    const färger = () => val.färger(gl, u, getComputedStyle(el.parentElement));
    färger();

    const skala = val.skala[tier() === 'full' ? 0 : 1];
    function storlek() {
      const w = Math.max(2, Math.round(el.clientWidth * skala));
      const h = Math.max(2, Math.round(el.clientHeight * skala));
      if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uR, w, h);
      if (val.storlek) val.storlek(gl, u, skala);
    }

    const stilla = reducerad();
    let syns = false, ram0 = 0, start = performance.now(), tidLagd = 0;
    function rita(nu) {
      ram0 = 0;
      storlek();
      const t = stilla ? val.stillaTid : (tidLagd + (nu - start)) / 1000 * val.fart;
      gl.uniform1f(uT, t);
      if (val.varje) val.varje(gl, u, t);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!stilla && syns && !document.hidden) ram0 = requestAnimationFrame(rita);
    }
    function gå() {
      if (ram0 || !syns || document.hidden) return;
      start = performance.now();
      ram0 = requestAnimationFrame(rita);
    }
    function stopp() {
      if (!ram0) return;
      cancelAnimationFrame(ram0); ram0 = 0;
      tidLagd += performance.now() - start;
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => {
        syns = es.some(e => e.isIntersecting);
        if (syns) gå(); else stopp();
      }, { rootMargin: '10% 0px' }).observe(el);
    } else { syns = true; gå(); }
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopp(); else gå(); });
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (stilla || !ram0) requestAnimationFrame(rita); }).observe(el);
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { färger(); if (stilla) rita(performance.now()); });
    el.addEventListener('webglcontextlost', e => { e.preventDefault(); stopp(); syns = false; });
    el.classList.add('gl-pa');
    if (stilla) requestAnimationFrame(rita);
    return { färger, rita: () => { if (stilla || !ram0) requestAnimationFrame(rita); } };
  }

  /* ---------- trådarna (Threads), under Hur hjälper vis rad ----------
     React Bits Threads i WebGL 1: trettio trådar som börjar samlade till
     vänster och böljar isär åt höger, varje med två perlinbrus. Två
     ändringar mot förlagan: trådens bredd räknas i duken pixlar mot
     höjden, inte mot den längsta sidan (annars blir trådarna tjocka på en
     telefon på högkant), och kanterna skrivs med smoothstep åt rätt håll
     (förlagan vänder argumenten, vilket GLSL inte lovar något om).
     De står i ett nedtonat band under korten, aldrig bakom texten (Leo:
     "texten syns dålig ... mer som ett mönster att veta vart man ska
     scrolla"), och böljar isär åt höger, dit raden fortsätter. Färgen är
     kortets i fokus (hjscen sätter TRÅD.mål), och den glider dit; pekaren
     och radens rullning rör trådarna lite, som pekaren gör i förlagan. */
  const TRÅDAR = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform float t;uniform vec2 r;uniform vec3 c;uniform vec2 mus;uniform float lw;uniform float amp;uniform float avst;',
    'const int N=30;',
    'float perlin(vec2 P){',
    ' vec2 Pi=floor(P);vec4 Pf=P.xyxy-vec4(Pi,Pi+1.0);vec4 Pt=vec4(Pi.xy,Pi.xy+1.0);',
    ' Pt=Pt-floor(Pt*(1.0/71.0))*71.0;Pt+=vec2(26.0,161.0).xyxy;Pt*=Pt;Pt=Pt.xzxz*Pt.yyww;',
    ' vec4 hx=fract(Pt*(1.0/951.135664))-0.49999;vec4 hy=fract(Pt*(1.0/642.949883))-0.49999;',
    ' vec4 g=inversesqrt(hx*hx+hy*hy)*(hx*Pf.xzxz+hy*Pf.yyww)*1.4142135623730950;',
    ' vec2 b=Pf.xy*Pf.xy*Pf.xy*(Pf.xy*(Pf.xy*6.0-15.0)+10.0);vec4 b2=vec4(b,vec2(1.0-b));',
    ' return dot(g,b2.zxzx*b2.wwyy);}',
    'float trad(vec2 st,float w,float p){',
    ' float sp=0.1+p*0.4;',
    ' float fa=smoothstep(sp,0.7,st.x)*0.5*amp*(1.0+(mus.y-0.5)*0.2);',
    ' float ts=t/10.0+(mus.x-0.5);',
    ' float bl=smoothstep(sp,sp+0.05,st.x)*p;',
    ' float xn=mix(perlin(vec2(ts,st.x+p)*2.5),perlin(vec2(ts,st.x+ts)*3.5)/1.5,st.x*0.3);',
    ' float y=0.5+(p-0.5)*avst+xn/2.0*fa;',
    ' float e=w/2.0+lw*1.43*bl/r.y;',
    ' float a=smoothstep(y-e,y,st.y)-smoothstep(y,y+e,st.y);',
    ' return clamp(a*(1.0-smoothstep(0.0,1.0,pow(p,0.3))),0.0,1.0);}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/r;float s=1.0;',
    ' for(int i=0;i<N;i++){float p=float(i)/float(N);s*=1.0-trad(uv,lw*(1.0-p)/r.y,p);}',
    ' float v=1.0-s;gl_FragColor=vec4(c*v,v);}'
  ].join('\n');

  /* Ett läge per duk: färgen den glider mot och den den har, pekaren, och
     radens framsteg. Radens läge (TRÅD) skriver hjscen. */
  const nyttLäge = () => ({ mål: null, nu: null, mus: [0.5, 0.5], musMål: [0.5, 0.5], prog: 0, rita: null });
  const TRÅD = nyttLäge();

  /* bredd: den tjockaste tråden i CSS-pixlar. yta: där pekaren räknas.
     skala, amp och avst som i duken och förlagan: ett lågt band behöver
     full upplösning och trådar som sprids över hela höjden. */
  function trådar(el, L, val) {
    const v = Object.assign({ bredd: 5.2, yta: el.parentElement, skala: [0.5, 0.62], amp: 1.3, avst: 0.3 }, val);
    L.mål = L.mål || färg(getComputedStyle(el.parentElement).getPropertyValue('--amne-ma'));
    L.nu = L.nu || L.mål.slice();
    const d = duk(el, TRÅDAR, {
      skala: v.skala, fart: 1, stillaTid: 18.0,
      färger: (gl, u) => {
        gl.uniform1f(u('amp'), v.amp);
        gl.uniform1f(u('avst'), v.avst);
        gl.uniform3fv(u('c'), L.nu);
        gl.uniform2fv(u('mus'), L.mus);
      },
      storlek: (gl, u, skala) => gl.uniform1f(u('lw'), v.bredd * skala),
      varje: (gl, u) => {
        for (let i = 0; i < 3; i++) L.nu[i] += (L.mål[i] - L.nu[i]) * 0.05;
        for (let i = 0; i < 2; i++) L.mus[i] += (L.musMål[i] - L.mus[i]) * 0.04;
        gl.uniform3fv(u('c'), L.nu);
        gl.uniform2f(u('mus'), L.mus[0] + (L.prog - 0.5) * 0.8, L.mus[1]);
      }
    });
    if (!d) return false;
    L.rita = d.rita;
    if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reducerad()) {
      const yta = v.yta;
      const in01 = x => Math.max(0, Math.min(1, x));
      yta.addEventListener('pointermove', e => {
        const r = yta.getBoundingClientRect();
        L.musMål = [in01((e.clientX - r.left) / r.width), in01(1 - (e.clientY - r.top) / r.height)];
      });
      yta.addEventListener('pointerleave', () => { L.musMål = [0.5, 0.5]; });
    }
    return true;
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

  /* Hur hjälper vi har sin duk i bandet under korten, och pekaren räknas
     över hela raden. Nästa steg får sitt punktnät. */
  function bakgrunder() {
    $$('canvas[data-tradar]').forEach(el => trådar(el, TRÅD, {
      bredd: 1.8, skala: [1, 1], amp: 1.1, avst: 0.85,
      yta: el.closest('[data-hjscen]') || el.parentElement
    }));
    $$('.nx-final-ljus').forEach(sek => { if (!sek.querySelector('canvas.nx-punkter')) punktnät(sek); });
  }

  /* ---------- Hur hjälper vi som en rad man sveper i ----------
     Raden är en vanlig rullbar rad (CSS); här kommer pilarna, fokus och
     inträdet. Pilarna rullar raden ett kort åt gången med scrollBy, aldrig
     sidan, och står släckta vid ändarna. Kortet närmast en punkt som går
     från första kortets mitt till sista kortets mitt medan raden rullas
     har .pa (så att det första är i fokus från början och det sista vid
     slutet), och trådarna tar dess färg. Ett kort som kommit in i raden
     har .inne, och dess rubrik stiger upp (.hjs-rorlig); ord delas en
     gång, i spans som texten står kvar i. Inträdet observerar raden,
     aldrig korten (CLAUDE.md, snäppande rader). */
  function delaRubrik(h) {
    let k = 0;
    const gå = n => Array.from(n.childNodes).forEach(c => {
      if (c.nodeType === 3) {
        if (!c.nodeValue.trim()) return;
        const frag = document.createDocumentFragment();
        c.nodeValue.split(/(\s+)/).forEach(d => {
          if (!d) return;
          if (!d.trim()) { frag.appendChild(document.createTextNode(d)); return; }
          const o = document.createElement('span');
          o.className = 'hjs-ord';
          const i = document.createElement('span');
          i.style.setProperty('--k', String(k++));
          i.textContent = d;
          o.appendChild(i);
          frag.appendChild(o);
        });
        c.replaceWith(frag);
      } else if (c.nodeType === 1 && c.tagName !== 'BR') gå(c);
    });
    gå(h);
  }

  function hjscen() {
    $$('[data-hjscen]').forEach(scen => {
      const spår = $('.hjs-spar', scen);
      const kort = $$('.hjs-kort', scen);
      if (!spår || kort.length < 2) return;
      const rörlig = !reducerad();
      if (rörlig) kort.forEach(k => { const h = $('h3', k); if (h) delaRubrik(h); });
      let färgen = [];
      const läsFärgen = () => { färgen = kort.map(k => färg(getComputedStyle(k).getPropertyValue('--f'))); };
      läsFärgen();
      const förra = $('[data-hjs-pil="-1"]', scen), nästa = $('[data-hjs-pil="1"]', scen);
      scen.classList.add('hjs-igang');
      if (rörlig) scen.classList.add('hjs-rorlig');

      let nu = -1, synlig = !rörlig, ram = 0;
      const läge = () => {
        ram = 0;
        const max = spår.scrollWidth - spår.clientWidth;
        const x0 = spår.scrollLeft, b = spår.clientWidth;
        const p = max > 1 ? Math.min(1, x0 / max) : 0;
        const först = kort[0], sist = kort[kort.length - 1];
        const a = först.offsetLeft + först.offsetWidth / 2;
        const ö = sist.offsetLeft + sist.offsetWidth / 2 - max;
        const punkt = a + (ö - a) * p;
        let bäst = 0, avst = Infinity;
        kort.forEach((k, i) => {
          const vä = k.offsetLeft - x0;
          if (synlig && vä < b) k.classList.add('inne');
          const d = Math.abs(vä + k.offsetWidth / 2 - punkt);
          if (d < avst) { avst = d; bäst = i; }
        });
        if (bäst !== nu) {
          nu = bäst;
          kort.forEach((k, i) => k.classList.toggle('pa', i === bäst));
          TRÅD.mål = färgen[bäst];
          if (TRÅD.rita) TRÅD.rita();
        }
        TRÅD.prog = p;
        if (förra) förra.disabled = x0 <= 2;
        if (nästa) nästa.disabled = x0 >= max - 2;
      };
      const snart = () => { if (!ram) ram = requestAnimationFrame(läge); };
      spår.addEventListener('scroll', snart, { passive: true });
      window.addEventListener('resize', snart, { passive: true });
      [förra, nästa].forEach(knapp => {
        if (!knapp) return;
        knapp.addEventListener('click', () => {
          const steg = kort[1].offsetLeft - kort[0].offsetLeft;
          spår.scrollBy({ left: Number(knapp.dataset.hjsPil) * steg, behavior: rörlig ? 'smooth' : 'auto' });
        });
      });
      if (!synlig && 'IntersectionObserver' in window) {
        const io = new IntersectionObserver(es => {
          if (!es.some(e => e.isIntersecting)) return;
          synlig = true; io.disconnect(); läge();
        }, { threshold: 0.25 });
        io.observe(spår);
      } else synlig = true;
      läge();
      matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
        läsFärgen();
        if (nu >= 0) TRÅD.mål = färgen[nu];
      });
    });
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
  prova('hjscen', hjscen);
  prova('bandfart', bandfart);
  prova('scrollord', scrollord);
  prova('tipp', tipp);
  prova('mätOm', mätOm);
})();
