/* ============================================================
   NEXTRUM — STARTSIDANS SCENER (2026-10-29)
   Leo: "Just nu är mycket bara i kolumner och tråkiga", med
   reactbits.dev som förebild, och samma kväll, efter två varv med
   rutor: "Jag sa ta inspiration av animationer osv på react bits, snygga
   rörliga bakgrunder, hur texter går osv". React Bits är React; här
   finns inget ramverk och inget byggsteg, så det som togs därifrån är
   skrivet om för hand, i sidans egen stil:

     aurora     Aurora: ett norrsken i WebGL bakom Hur hjälper vi och
                Nästa steg, i sidans lera, orange och rosa. Ritas i låg
                upplösning (det är suddigt ändå), bara medan det syns och
                fliken är framme, och står still med reducerad rörelse.
     hjscen     Hur hjälper vi som en scen: den står still medan man
                scrollar, och sex lägen byts mitt på skärmen, rubriken
                först och sedan de fem budskapen. Rubrikens ord flyger upp
                ur en springa (SplitText), texten tonar fram ur sudd
                (BlurText). Inga rutor: Leo om bentot och högen, "De blir
                liksom 8 kolumner direkt".
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
   opacitet och filter per bildruta på rubriken, fönstret och bandet, och
   framstegslinjen i scenen får sin skala. Lägena i scenen byts med en
   klass, och övergångarna är CSS. Inget här räknar om sidans layout.

   Utan det här skriptet, utan GSAP eller med reducerad rörelse står
   allt som nextrum-start.js lämnar det: scenens text under varandra på
   den mörka ytan, orden som tonar fram när rubriken syns och fönstret
   som reser sig. Inget startläge här gömmer något.
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

  /* ---------- norrskenet (Aurora) ----------
     Samma fragmentshader som React Bits Aurora, i WebGL 1 utan bibliotek:
     ett simplexbrus som höjer och sänker en färgramp med tre stopp, så
     att ljuset böljar. Färgerna läses ur CSS (--aurora-1, -2, -3 på
     elementet runt), så de följer sidans tokens och mörka läget.

     Det som håller det billigt: duken ritas i en bråkdel av sin storlek
     (SKALA) och skalas upp av webbläsaren, slingan går bara medan duken
     syns och fliken är framme, och med reducerad rörelse ritas en enda
     bild. Finns ingen WebGL står ytans egen gradient kvar (CSS). */
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}';
  const FS = [
    'precision mediump float;',
    'uniform float t;uniform vec2 r;uniform vec3 c0;uniform vec3 c1;uniform vec3 c2;uniform float amp;',
    'vec3 permute(vec3 x){return mod(((x*34.0)+1.0)*x,289.0);}',
    'float snoise(vec2 v){',
    ' const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);',
    ' vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);',
    ' vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);',
    ' vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod(i,289.0);',
    ' vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));',
    ' vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);m=m*m;m=m*m;',
    ' vec3 x=2.0*fract(p*C.www)-1.0;vec3 h=abs(x)-0.5;vec3 ox=floor(x+0.5);vec3 a0=x-ox;',
    ' m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);',
    ' vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.0*dot(m,g);}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/r;',
    ' vec3 ramp=uv.x<0.5?mix(c0,c1,uv.x*2.0):mix(c1,c2,(uv.x-0.5)*2.0);',
    ' float h=snoise(vec2(uv.x*2.0+t*0.1,t*0.25))*0.5*amp;h=exp(h);h=(uv.y*2.0-h+0.2);',
    ' float i=0.6*h;float a=smoothstep(0.2-0.3,0.2+0.3,i);',
    ' gl_FragColor=vec4(i*ramp*a,a);}'
  ].join('\n');

  function färg(v) {
    const c = document.createElement('canvas').getContext('2d');
    c.fillStyle = '#000';
    c.fillStyle = v.trim() || '#000';
    const hex = c.fillStyle;
    if (hex[0] !== '#') return [0, 0, 0];
    return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  }

  function aurora(duk) {
    if (duk.dataset.aurora === 'klar') return;
    duk.dataset.aurora = 'klar';
    const gl = duk.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, powerPreference: 'low-power' });
    if (!gl) return;
    const skugga = (typ, källa) => {
      const s = gl.createShader(typ);
      gl.shaderSource(s, källa); gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const v = skugga(gl.VERTEX_SHADER, VS), f = skugga(gl.FRAGMENT_SHADER, FS);
    if (!v || !f) return;
    const pr = gl.createProgram();
    gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = n => gl.getUniformLocation(pr, n);
    const uT = u('t'), uR = u('r');

    const ram = duk.parentElement;
    function färger() {
      const cs = getComputedStyle(ram);
      gl.uniform3fv(u('c0'), färg(cs.getPropertyValue('--aurora-1')));
      gl.uniform3fv(u('c1'), färg(cs.getPropertyValue('--aurora-2')));
      gl.uniform3fv(u('c2'), färg(cs.getPropertyValue('--aurora-3')));
      gl.uniform1f(u('amp'), parseFloat(cs.getPropertyValue('--aurora-styrka')) || 1);
    }
    färger();

    const SKALA = tier() === 'full' ? 0.5 : 0.34;
    function storlek() {
      const w = Math.max(2, Math.round(duk.clientWidth * SKALA));
      const h = Math.max(2, Math.round(duk.clientHeight * SKALA));
      if (duk.width !== w || duk.height !== h) { duk.width = w; duk.height = h; }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uR, w, h);
    }

    const stilla = reducerad();
    let syns = false, ram0 = 0, start = performance.now(), tidLagd = 0;
    function rita(nu) {
      ram0 = 0;
      storlek();
      gl.uniform1f(uT, stilla ? 12.0 : (tidLagd + (nu - start)) / 1000 * 0.9);
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
      }, { rootMargin: '10% 0px' }).observe(duk);
    } else { syns = true; gå(); }
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopp(); else gå(); });
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (stilla || !ram0) requestAnimationFrame(rita); }).observe(duk);
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { färger(); if (stilla) rita(performance.now()); });
    duk.addEventListener('webglcontextlost', e => { e.preventDefault(); stopp(); syns = false; });
    duk.classList.add('aurora-pa');
    if (stilla) requestAnimationFrame(rita);
  }

  function norrsken() {
    $$('canvas[data-aurora]').forEach(aurora);
    /* Nästa steg hade tre CSS-fläckar (norrsken i nextrum-motion.js).
       Här byts de mot samma norrsken i WebGL, och fläckarna går. */
    $$('.nx-final-cinema').forEach(sek => {
      if (sek.querySelector('canvas.nx-aurora')) return;
      const duk = document.createElement('canvas');
      duk.className = 'nx-aurora';
      duk.setAttribute('aria-hidden', 'true');
      sek.insertBefore(duk, sek.firstChild);
      aurora(duk);
      if (duk.classList.contains('aurora-pa')) $$('.nx-norrsken', sek).forEach(n => n.remove());
    });
  }

  /* ---------- Hur hjälper vi som en scen ----------
     .hjs-pa gör scenen hög och ytan klistrad (CSS), och scrollen väljer
     läget: lika lång väg per läge. Det som syns har .pa, det som passerats
     .forbi; övergångarna är CSS. Rubrikernas ord delas en gång, i spans
     som texten står kvar i (skärmläsare och markering som förut). En länk
     som får fokus visar sitt läge, så att tangentbordet aldrig hamnar i
     något osynligt. */
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
    if (!medGsap) return;
    $$('[data-hjscen]').forEach(scen => {
      const lägen = $$('[data-hjs]', scen);
      const n = lägen.length;
      if (n < 2) return;
      lägen.forEach(l => { const h = $('h3', l); if (h) delaRubrik(h); });
      scen.style.setProperty('--hjs-n', String(n));
      scen.classList.add('hjs-pa');
      const fyll = $('.hjs-rad-fyll', scen);
      let nu = -1;
      const sätt = i => {
        if (i === nu) return;
        nu = i;
        lägen.forEach((l, k) => {
          l.classList.toggle('pa', k === i);
          l.classList.toggle('forbi', k < i);
        });
      };
      sätt(0);
      ST.create({
        trigger: scen, start: 'top top', end: 'bottom bottom',
        onUpdate: s => {
          sätt(Math.min(n - 1, Math.floor(s.progress * n)));
          if (fyll) fyll.style.transform = 'scaleX(' + s.progress.toFixed(3) + ')';
        }
      });
      scen.addEventListener('focusin', e => {
        const l = e.target.closest('[data-hjs]');
        if (l) sätt(lägen.indexOf(l));
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
  prova('norrsken', norrsken);
  prova('hjscen', hjscen);
  prova('bandfart', bandfart);
  prova('scrollord', scrollord);
  prova('tipp', tipp);
  prova('mätOm', mätOm);
})();
