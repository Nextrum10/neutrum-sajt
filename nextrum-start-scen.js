/* ============================================================
   NEXTRUM — STARTSIDANS SCENER (2026-10-29)
   Leo: "Just nu är mycket bara i kolumner och tråkiga", med
   reactbits.dev som förebild, och samma kväll, efter två varv med
   rutor: "Jag sa ta inspiration av animationer osv på react bits, snygga
   rörliga bakgrunder, hur texter går osv". React Bits är React; här
   finns inget ramverk och inget byggsteg, så det som togs därifrån är
   skrivet om för hand, i sidans egen stil:

     trådar     Threads: trådar i WebGL som böljar bakom Hur hjälper vi,
                på ytans vita, i färgen från budskapet i fokus. Ritas i
                låg upplösning, bara medan de syns och fliken är framme,
                och står still med reducerad rörelse.
     norrsken   Aurora: ett norrsken i WebGL i Nästa steg, i sidans lera
                och orange, på samma villkor.
     hjscen     Hur hjälper vi som en rad som glider: ytan står still
                medan man scrollar, och rubriken och de fem budskapen går
                åt vänster i EN rad. Ett korts rubrik stiger upp ur en
                springa när kortet kommer in (SplitText), texten tonar
                fram ur sudd (BlurText). Leo om den mörka scenen före:
                "Jag gillar inte att bakrunden är svart och orange", och
                korten ska gå "sidleds snyggt med en vit rörlig bakrund".
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
   opacitet och filter per bildruta på rubriken, fönstret, bandet och
   scenens rad, och framstegslinjen får sin skala. Fokus och inträde i
   scenen sätts med klasser, och övergångarna är CSS. Inget här räknar
   om sidans layout utom scenens höjd, en gång per omräkning.

   Utan det här skriptet, utan GSAP eller med reducerad rörelse står
   allt som nextrum-start.js lämnar det: scenens kort i en rad att svepa
   i, orden som tonar fram när rubriken syns och fönstret som reser sig.
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
     Norrskenet och trådarna delar allt utom sin fragmentshader: en
     triangel över hela duken, ett program, och slingan. Det som håller
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

  /* ---------- norrskenet (Aurora), i Nästa steg ----------
     Samma fragmentshader som React Bits Aurora, i WebGL 1: ett
     simplexbrus som höjer och sänker en färgramp med tre stopp, så att
     ljuset böljar. Färgerna ur --aurora-1, -2 och -3. */
  const AURORA = [
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

  function norrsken() {
    /* Nästa steg hade tre CSS-fläckar (norrsken i nextrum-motion.js).
       Här byts de mot norrskenet i WebGL, och fläckarna går. */
    $$('.nx-final-cinema').forEach(sek => {
      if (sek.querySelector('canvas.nx-aurora')) return;
      const el = document.createElement('canvas');
      el.className = 'nx-aurora';
      el.setAttribute('aria-hidden', 'true');
      sek.insertBefore(el, sek.firstChild);
      const ok = duk(el, AURORA, {
        skala: [0.5, 0.34], fart: 0.9, stillaTid: 12.0,
        färger: (gl, u, cs) => {
          gl.uniform3fv(u('c0'), färg(cs.getPropertyValue('--aurora-1')));
          gl.uniform3fv(u('c1'), färg(cs.getPropertyValue('--aurora-2')));
          gl.uniform3fv(u('c2'), färg(cs.getPropertyValue('--aurora-3')));
          gl.uniform1f(u('amp'), parseFloat(cs.getPropertyValue('--aurora-styrka')) || 1);
        }
      });
      if (ok) $$('.nx-norrsken', sek).forEach(n => n.remove());
      else el.remove();
    });
  }

  /* ---------- trådarna (Threads), bakom Hur hjälper vi ----------
     React Bits Threads i WebGL 1: trettio trådar som börjar samlade till
     vänster och böljar isär åt höger, varje med två perlinbrus. Två
     ändringar mot förlagan: trådens bredd räknas i duken pixlar mot
     höjden, inte mot den längsta sidan (annars blir trådarna tjocka på en
     telefon på högkant), och kanterna skrivs med smoothstep åt rätt håll
     (förlagan vänder argumenten, vilket GLSL inte lovar något om).
     Färgen är budskapets i fokus (scenen sätter TRÅD.mål), och den glider
     dit; pekaren och scrollen rör trådarna lite, som pekaren gör i
     förlagan. */
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

  const TRÅD = { mål: null, nu: null, mus: [0.5, 0.5], musMål: [0.5, 0.5], prog: 0 };

  function trådar() {
    $$('canvas[data-tradar]').forEach(el => {
      const bas = () => färg(getComputedStyle(el.parentElement).getPropertyValue('--amne-ma'));
      TRÅD.mål = TRÅD.mål || bas();
      TRÅD.nu = TRÅD.nu || TRÅD.mål.slice();
      const d = duk(el, TRÅDAR, {
        skala: [0.5, 0.62], fart: 1, stillaTid: 18.0,
        färger: (gl, u) => {
          gl.uniform1f(u('amp'), 1.3);
          gl.uniform1f(u('avst'), 0.3);
          gl.uniform3fv(u('c'), TRÅD.nu);
          gl.uniform2fv(u('mus'), TRÅD.mus);
        },
        /* Den tjockaste tråden är ungefär fem CSS-pixlar, i dukens pixlar. */
        storlek: (gl, u, skala) => gl.uniform1f(u('lw'), 5.2 * skala),
        varje: (gl, u) => {
          for (let i = 0; i < 3; i++) TRÅD.nu[i] += (TRÅD.mål[i] - TRÅD.nu[i]) * 0.05;
          for (let i = 0; i < 2; i++) TRÅD.mus[i] += (TRÅD.musMål[i] - TRÅD.mus[i]) * 0.04;
          gl.uniform3fv(u('c'), TRÅD.nu);
          gl.uniform2f(u('mus'), TRÅD.mus[0] + (TRÅD.prog - 0.5) * 0.5, TRÅD.mus[1]);
        }
      });
      if (!d) return;
      TRÅD.rita = d.rita;
      if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reducerad()) {
        const yta = el.parentElement;
        yta.addEventListener('pointermove', e => {
          const b = yta.getBoundingClientRect();
          TRÅD.musMål = [(e.clientX - b.left) / b.width, 1 - (e.clientY - b.top) / b.height];
        });
        yta.addEventListener('pointerleave', () => { TRÅD.musMål = [0.5, 0.5]; });
      }
    });
  }

  /* ---------- Hur hjälper vi som en rad som glider ----------
     .hjs-pa gör scenen lika hög som raden har väg att gå plus en skärm,
     och ytan klistrad (CSS); scrollen flyttar raden åt vänster, ett till
     ett. Vägen mäts före varje omräkning (refreshInit), så att höjden och
     ScrollTrigger alltid är överens. Kortet närmast en punkt som går från
     en tredjedel till fyra femtedelar av bredden har .pa (så att det första
     är i fokus från början och det sista vid slutet), och trådarna tar dess
     färg. Ett kort som kommit in har .inne, och dess rubrik stiger upp;
     ord delas en gång, i spans som texten står kvar i. En länk som får
     fokus rullar sidan dit kortet syns. */
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
      const spår = $('.hjs-spar', scen), rad = $('.hjs-rad', scen);
      const kort = $$('.hjs-kort', scen);
      if (!spår || !rad || kort.length < 2) return;
      kort.forEach(k => { const h = $('h3', k); if (h) delaRubrik(h); });
      const färgen = kort.map(k => färg(getComputedStyle(k).getPropertyValue('--f')));
      const fyll = $('.hjs-matare-fyll', scen);
      scen.classList.add('hjs-pa');

      const väg = () => {
        const m = parseFloat(getComputedStyle(spår).paddingLeft) || 0;
        return Math.max(0, rad.offsetWidth - (spår.clientWidth - 2 * m));
      };
      const mät = () => scen.style.setProperty('--hjs-x', väg() + 'px');
      mät();
      ST.addEventListener('refreshInit', mät);

      let nu = -1;
      const läge = p => {
        const x = -p * väg(), b = spår.clientWidth;
        const punkt = b * (0.33 + p * 0.47);
        let bäst = 0, avst = Infinity;
        kort.forEach((k, i) => {
          const vä = k.offsetLeft + x;
          if (vä < b * 1.02) k.classList.add('inne');
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
        if (fyll) fyll.style.transform = 'scaleX(' + p.toFixed(3) + ')';
      };

      gsap.to(rad, {
        x: () => -väg(), ease: 'none',
        scrollTrigger: {
          trigger: scen, start: 'top top', end: 'bottom bottom',
          scrub: 0.4, invalidateOnRefresh: true,
          onUpdate: s => läge(s.progress),
          onRefresh: s => läge(s.progress)
        }
      });
      läge(0);

      scen.addEventListener('focusin', e => {
        const k = e.target.closest('.hjs-kort');
        if (!k) return;
        const v = väg();
        if (!v) return;
        const p = Math.min(1, Math.max(0, (k.offsetLeft - spår.clientWidth * 0.3) / v));
        const topp = scen.getBoundingClientRect().top + scrollY;
        scrollTo(0, topp + p * (scen.offsetHeight - innerHeight));
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
  prova('trådar', trådar);
  prova('hjscen', hjscen);
  prova('bandfart', bandfart);
  prova('scrollord', scrollord);
  prova('tipp', tipp);
  prova('mätOm', mätOm);
})();
