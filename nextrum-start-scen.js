/* ============================================================
   NEXTRUM — STARTSIDANS SCENER (2026-10-29)
   Leo: "Just nu är mycket bara i kolumner och tråkiga", med
   reactbits.dev som förebild, och samma kväll, efter två varv med
   rutor: "Jag sa ta inspiration av animationer osv på react bits, snygga
   rörliga bakgrunder, hur texter går osv". React Bits är React; här
   finns inget ramverk och inget byggsteg, så det som togs därifrån är
   skrivet om för hand, i sidans egen stil:

     bakgrunder Threads: trådar i WebGL i ett nedtonat band under Hur
                hjälper vis rad, i färgen från kortet i fokus. Ritas bara
                medan de syns och fliken är framme, och står still med
                reducerad rörelse. Dot Grid, nätet bakom Nästa steg, står
                sedan 2026-10-30 i nextrum-punktnat.js, för det finns på
                varje sida med Nästa steg.
     hjscen     Hur hjälper vi som en rad man sveper i själv, eller drar i
                med musen: Leo om raden som scrollen drog, "Vi är ett läxhjälps
                företag ... inte et tech bolag. Så vi kör istället att man
                scrollar själv åt vänster". Ett korts rubrik stiger upp ur
                en springa när kortet kommer in (SplitText), och texten
                tonar fram ur sudd (BlurText).
     scrollord  ScrollReveal: manifestets ord går från suddiga till
                skarpa i takt med scrollen, och rubriken rätar upp sig.
     tipp       Studievyns fönster tippar upp ur papperet medan man
                scrollar mot det, i stället för att resa sig en gång.
                Bara på dator (tier full).

   Undantaget från "skriptet sätter klasser, CSS rör sig", som på
   landningssidorna (nextrum-landning.js): GSAP skriver transform,
   opacitet och filter per bildruta på rubriken och fönstret.
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
     React Bits Threads i WebGL 1: tjugofyra trådar som börjar samlade till
     vänster och böljar isär åt höger, varje med två perlinbrus. Två
     ändringar mot förlagan: trådens bredd räknas i duken pixlar mot
     höjden, inte mot den längsta sidan (annars blir trådarna tjocka på en
     telefon på högkant), och kanterna skrivs med smoothstep åt rätt håll
     (förlagan vänder argumenten, vilket GLSL inte lovar något om).
     De står i ett nedtonat band under korten, aldrig bakom texten (Leo:
     "texten syns dålig ... mer som ett mönster att veta vart man ska
     scrolla"), och böljar isär åt höger, dit raden fortsätter. Färgen är
     kortets i fokus (hjscen sätter TRÅD.mål), och den glider dit. Leo: "den
     glitchar". Tre saker gjorde det: radens rullning flyttade trådarnas tid,
     så att de vred sig fort när man svepte; de slog i bandets kanter och
     klipptes; och i CSS-pixlar flimrade de på en retinaskärm. Nu går de i
     sin egen takt (ingen pekare, ingen rullning), tonas mot bandets över-
     och underkant och ritas i skärmens pixlar. */
  const TRÅDAR = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform float t;uniform vec2 r;uniform vec3 c;uniform vec2 mus;uniform float lw;uniform float amp;uniform float avst;',
    'const int N=24;',
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
    ' float v=(1.0-s)*smoothstep(0.0,0.24,uv.y)*(1.0-smoothstep(0.76,1.0,uv.y));',
    ' gl_FragColor=vec4(c*v,v);}'
  ].join('\n');

  /* Ett läge per duk: färgen den glider mot och den den har. Radens läge
     (TRÅD) skriver hjscen. */
  const nyttLäge = () => ({ mål: null, nu: null, mus: [0.5, 0.5], rita: null });
  const TRÅD = nyttLäge();

  /* bredd: den tjockaste tråden i CSS-pixlar. skala, amp och avst som i
     duken och förlagan. */
  function trådar(el, L, val) {
    const v = Object.assign({ bredd: 5.2, skala: [0.5, 0.62], amp: 1.3, avst: 0.3 }, val);
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
        gl.uniform3fv(u('c'), L.nu);
      }
    });
    if (!d) return false;
    L.rita = d.rita;
    return true;
  }

  /* Hur hjälper vi har sin duk i bandet under korten, och pekaren räknas
     över hela raden. Nästa stegs punktnät står i nextrum-punktnat.js,
     för det står på varje sida med Nästa steg. */
  function bakgrunder() {
    /* Bandet ritas i skärmens egna pixlar (högst 1,5 per CSS-pixel): i
       CSS-pixlar flimrade de tunna trådarna i kanterna på en retinaskärm. */
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    $$('canvas[data-tradar]').forEach(el => trådar(el, TRÅD, {
      bredd: 1.6, skala: [dpr, dpr], amp: 0.8, avst: 0.6
    }));
  }

  /* ---------- Hur hjälper vi som en rad man sveper i ----------
     Raden är en vanlig rullbar rad (CSS); här kommer draget med musen,
     fokus och inträdet. Draget rullar raden, aldrig sidan. Kortet närmast en punkt som går
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
      scen.classList.add('hjs-igang');
      if (rörlig) scen.classList.add('hjs-rorlig');

      let nu = -1, synlig = !rörlig, ram = 0;
      const läge = () => {
        ram = 0;
        /* Slutet är där sista kortet snäpper fast, inte radens yttersta
           kant: med scroll-snap stannar en telefon där, och då ska det
           sista kortet vara i fokus. */
        const först = kort[0], sist = kort[kort.length - 1];
        const x0 = spår.scrollLeft, b = spår.clientWidth;
        const max = Math.max(1, Math.min(spår.scrollWidth - b, sist.offsetLeft - (parseFloat(getComputedStyle(spår).paddingLeft) || 0)));
        const p = Math.min(1, x0 / max);
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
      };
      const snart = () => { if (!ram) ram = requestAnimationFrame(läge); };
      spår.addEventListener('scroll', snart, { passive: true });
      window.addEventListener('resize', snart, { passive: true });
      /* Pilarna gick (Leo: "Ta bort dessa pilar"), så med en mus dras
         raden i stället: snäppningen står av medan man drar och tar vid
         när man släpper, och ett drag öppnar aldrig länken man släppte på. */
      spår.addEventListener('pointerdown', e => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        const x0 = e.clientX, s0 = spår.scrollLeft;
        let drog = false;
        const flytta = ev => {
          const dx = ev.clientX - x0;
          if (!drog && Math.abs(dx) < 5) return;
          if (!drog) { drog = true; spår.classList.add('hjs-drar'); }
          spår.scrollLeft = s0 - dx;
        };
        const släpp = () => {
          removeEventListener('pointermove', flytta);
          removeEventListener('pointerup', släpp);
          if (!drog) return;
          spår.classList.remove('hjs-drar');
          const stopp = ev => { ev.preventDefault(); ev.stopPropagation(); };
          spår.addEventListener('click', stopp, true);
          setTimeout(() => spår.removeEventListener('click', stopp, true), 0);
        };
        addEventListener('pointermove', flytta);
        addEventListener('pointerup', släpp);
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
  prova('scrollord', scrollord);
  prova('tipp', tipp);
  prova('mätOm', mätOm);
})();
