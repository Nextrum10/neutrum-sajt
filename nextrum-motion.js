/* ============================================================
   NEXTRUM — RÖRELSE

   Tre saker bor här:

     NXImg     bygger bildmarkup från bildregistret
               (nextrum-images.js). Ingen bildväg skrivs i HTML.

     NXMotion  en scroll-motor. Varje "scen" är ett element vars
               position i vyn räknas om till ett tal 0→1. Vad som
               händer med det talet bestämmer den som skapar scenen.

     NXStory   bildberättelsen. Tar en lista med bilder och var i
               scrollen var och en ska leva, och flyttar dem genom
               ett 3D-rum. Lägg till en bild = lägg till ett objekt
               i listan. Ingen animationskod behöver röras.

   Tre lägen, valda automatiskt:
     full   mus + stor skärm     → hela 3D-koreografin
     lite   pekskärm/liten skärm → samma berättelse, mindre rörelse
     still  prefers-reduced-motion → ingen scrollrörelse alls,
            allt ligger i sitt slutläge och sidan är fullt läsbar

   Prestanda: en enda rAF-loop för hela sidan, bara transform,
   opacity och filter rörs (aldrig layout), och scener som ligger
   utanför vyn räknas inte om alls.
   ============================================================ */

const NXMotion = (function () {
  'use strict';

  /* ---------- läge ---------- */
  const mReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mCoarse = window.matchMedia('(hover: none), (pointer: coarse)');
  const mNarrow = window.matchMedia('(max-width: 900px)');

  let tier = 'full';
  function räknaTier() {
    if (mReduce.matches) tier = 'still';
    else if (mCoarse.matches || mNarrow.matches) tier = 'lite';
    else tier = 'full';
    document.documentElement.dataset.motion = tier;
    return tier;
  }
  räknaTier();

  /* ---------- matte ---------- */
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* 0→1 mellan a och b, klippt i ändarna */
  function span(v, a, b) {
    if (b === a) return v < a ? 0 : 1;
    return clamp((v - a) / (b - a), 0, 1);
  }

  /* mjuk in- och utgång — det som skiljer "filmiskt" från "linjärt" */
  const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  /* Trapets: 0 före kf[0], upp till 1 vid kf[1], håller till kf[2],
     ner till 0 vid kf[3]. Används för opacitet. */
  function trapets(p, kf) {
    if (!kf) return 1;
    const [a, b, c, d] = kf;
    /* Strikt utanför intervallet — annars försvinner ett lager som
       ska ligga framme redan vid p=0 (a===b) eller ända till p=1
       (c===d), vilket är precis vad första och sista scenen gör. */
    if (p < a || p > d) return 0;
    if (p < b) return easeOut(span(p, a, b));
    if (p <= c) return 1;
    return 1 - easeInOut(span(p, c, d));
  }

  /* ---------- scenregister ---------- */
  const scener = [];
  let ticking = false;
  let vh = document.documentElement.clientHeight || window.innerHeight;

  /* En scen = ett element + en funktion som får progress.
       el       elementet vars position styr
       from     var progress ska vara 0. 'top' = elementets ovankant
                möter vyns underkant. 'enter'/'center'/'cover'
       run(p)   körs med p = 0→1 varje bildruta scenen syns
       once     scenen är klar när run() svarat något annat än false.
                Svarar run() false har inget hänt än, och scenen räknas
                om nästa gång. Se kommentaren i tick().
       pin      elementet är sticky inuti en hög behållare — då mäts
                behållaren istället, vilket ger hela scrollsträckan  */
  function scene(el, opts) {
    if (!el) return null;
    const s = {
      el,
      mät: opts.mät || el,
      run: opts.run,
      once: !!opts.once,
      läge: opts.läge || 'cover',
      offset: opts.offset || 0,
      synlig: false,
      klar: false,
      top: 0, h: 0,
      senaste: -1
    };
    scener.push(s);
    mätEn(s);

    /* Bara scener i (eller nära) vyn räknas om. */
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
          s.synlig = e.isIntersecting;
          if (s.synlig) begär();
        });
      }, { rootMargin: '25% 0px 25% 0px' });
      io.observe(s.mät);
      s.io = io;
    } else {
      s.synlig = true;
    }
    begär();
    return s;
  }

  function mätEn(s) {
    const r = s.mät.getBoundingClientRect();
    s.top = r.top + window.scrollY;
    s.h = r.height;
  }

  function progressFör(s) {
    const y = window.scrollY;
    if (s.läge === 'cover') {
      /* hela elementets resa genom vyn: 0 när ovankanten möter
         vyns underkant, 1 när underkanten lämnar överkanten */
      return span(y, s.top - vh, s.top + s.h);
    }
    if (s.läge === 'pin') {
      /* sticky-innehåll: 0 när behållaren fastnar, 1 när den släpper */
      return span(y, s.top, s.top + s.h - vh);
    }
    if (s.läge === 'enter') {
      /* 0 när ovankanten kommer in, 1 när elementet står stilla i vyn */
      return span(y, s.top - vh, s.top - vh * 0.35);
    }
    /* 'center' — 0 när elementet börjar synas, 1 när det passerat mitten */
    return span(y, s.top - vh, s.top + s.h - vh * 0.5);
  }

  function tick() {
    ticking = false;
    for (let i = 0; i < scener.length; i++) {
      const s = scener[i];
      if (!s.synlig || s.klar) continue;
      const p = progressFör(s);
      /* hoppa över omritning när inget rört sig nämnvärt */
      if (Math.abs(p - s.senaste) < 0.0004 && s.senaste >= 0) continue;
      s.senaste = p;
      /* En once-scen är klar först när run() säger det. Förut sattes
         klar efter FÖRSTA anropet, oavsett p. Det anropet kommer när
         observatören ser elementet inom sin marginal på 25 %, alltså
         innan det syns, med p = 0 — avslöjandet hände aldrig, och
         nödbromsen visade allt efter två sekunder. Inget på sajten
         steg alltså in när man scrollade fram till det (2026-09-25:
         33 av 33 block under vikningen på startsidan). */
      const svar = s.run(p, s);
      if (s.once && svar !== false) s.klar = true;
    }
  }

  function begär() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(tick);
  }

  function mätOm() {
    vh = document.documentElement.clientHeight || window.innerHeight;
    scener.forEach(s => { mätEn(s); s.senaste = -1; });
    begär();
  }

  /* Synkron omräkning, utan att vänta på nästa bildruta.
     Behövs när fliken varit dold: då står både requestAnimationFrame
     och IntersectionObserver stilla, så scenerna vet varken att de
     syns eller var scrollen står. Här härleds synligheten ur
     geometrin i stället, precis som observatören annars gör. */
  function kör() {
    vh = document.documentElement.clientHeight || window.innerHeight;
    const y = window.scrollY;
    for (let i = 0; i < scener.length; i++) {
      const s = scener[i];
      /* En klar once-scen räknas aldrig om — att mäta den är en
         tvingad layout för ingenting, fyra gånger i sekunden medan man
         scrollar, för varje avslöjat block på sidan. */
      if (s.klar) continue;
      const r = s.mät.getBoundingClientRect();
      /* Mät om medan vi ändå har rektangeln. Scenens top sattes när
         scenen skapades, och allt som ändrar höjden ovanför den efter
         det — rubriker som delas i rader, ett typsnitt som byts, en
         bild som får sin riktiga höjd — gör värdet fel. Är top för
         stort ligger progressen kvar på noll hela vägen: sektionen
         nålas fast som den ska men första steget lyser hela tiden.
         Det är billigt att rätta här, rektangeln är redan hämtad. */
      s.top = r.top + y;
      s.h = r.height;
      s.synlig = r.bottom > -vh * 0.25 && r.top < vh * 1.25;
    }
    tick();
  }

  /* Kommer man tillbaka till fliken kan mätvärdena vara gamla. */
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { mätOm(); kör(); }
  });

  /* Scenerna hittar själva om de syns, var 250:e millisekund.
     IntersectionObserver är annars enda källan till s.synlig, och
     står den still — dold flik, bakgrundsfönster, en webbläsare som
     strypt observatörer — körs scenen aldrig fastän man scrollar
     rakt igenom den. Då ser en pinnad sektion ut att ha hängt sig:
     den sitter fast som den ska men innehållet byts aldrig.
     Geometrikollen är samma villkor som observatören använder, och
     några getBoundingClientRect fyra gånger i sekunden märks inte. */
  let senasteSynk = 0;
  window.addEventListener('scroll', () => {
    begär();
    /* kör() härleder synligheten ur geometrin och ritar direkt,
       utan att gå via vare sig observatören eller nästa bildruta.
       Fyra gånger i sekunden räcker för att en scen alltid ska
       komma igång, även om rAF är strypt. */
    const nu = performance.now();
    if (nu - senasteSynk > 250) { senasteSynk = nu; kör(); }
  }, { passive: true });
  window.addEventListener('resize', () => {
    clearTimeout(mätOm._t);
    mätOm._t = setTimeout(() => { räknaTier(); mätOm(); }, 120);
  }, { passive: true });
  window.addEventListener('load', () => { mätOm(); kör(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { mätOm(); kör(); });

  return {
    scene, begär, mätOm, kör, clamp, lerp, span, easeInOut, easeOut, trapets,
    get tier() { return tier; },
    get reducerad() { return tier === 'still'; }
  };
})();


/* ============================================================
   NXImg — bildmarkup från registret
   ============================================================ */
const NXImg = (function () {
  'use strict';

  const REG = window.NEXTRUM_IMAGES || {};
  const BREDDER = window.NEXTRUM_IMAGE_WIDTHS || [640, 960, 1280, 1600, 1920];
  /* Absolut sökväg, inte relativ. Med 'bilder/' pekade den på
     /en/bilder/ från de engelska sidorna, och alla fem bilderna i
     "Så fungerar Nextrum" blev 404. En sökväg som byggs i JavaScript
     vet inte vilken mapp sidan ligger i — då måste den utgå från
     roten. */
  const MAPP = '/bilder/';

  function hämta(key) {
    const b = REG[key];
    if (!b) console.warn('NXImg: bilden "' + key + '" finns inte i nextrum-images.js');
    return b || null;
  }

  function srcset(b, andelse) {
    const ä = andelse || 'jpg';
    return BREDDER.map(w => MAPP + b.file + '-' + w + '.' + ä + ' ' + w + 'w').join(', ');
  }

  /* Bygger <picture>. opts:
       sizes     CSS-uttryck för hur bred bilden blir. Sätt alltid —
                 utan det laddar webbläsaren onödigt stort.
       eager     true för bilder ovanför vikningen (hero). Allt annat
                 lazy, så att sidan inte drar hem sex foton direkt.
       klass     extra klasser
       ratio     'auto' använder originalets proportioner

     VARFÖR <picture> OCH INTE BARA <img>

     Mätt i webbläsaren: startsidan på en telefon 390px bred med DPR 3
     hämtade 1,06 MB bilder, alltså mer än samma sida på en
     1440px-skärm. srcset och sizes var rätt satta — det var formatet.
     Samma foton som WebP väger 69 % mindre.

     <source> först, <img> kvar som den var. Webbläsaren tar den
     första källa den förstår, så en gammal Safari får jpg:en precis
     som förut. Att bara byta srcset till .webp hade varit enklare och
     hade lämnat de webbläsarna med en trasig bild i stället för en
     tung.

     ALLA ATTRIBUT UTOM type OCH srcset SITTER KVAR PÅ <img>. alt,
     width, height, loading och sizes läses därifrån oavsett vilken
     källa som vinner; flyttas de till <source> tappar bilden sitt
     alternativ­text och sidan hoppar när den laddar. */
  function img(key, opts) {
    const b = hämta(key);
    if (!b) return '';
    const o = opts || {};
    const eager = !!o.eager;
    const sizes = o.sizes || '100vw';
    return '<picture>'
      + '<source type="image/webp" srcset="' + srcset(b, 'webp') + '" sizes="' + sizes + '">'
      + '<img class="nx-img' + (o.klass ? ' ' + o.klass : '') + '"'
      + ' src="' + MAPP + b.file + '-1280.jpg"'
      + ' srcset="' + srcset(b) + '"'
      + ' sizes="' + sizes + '"'
      + ' width="' + b.w + '" height="' + b.h + '"'
      + ' alt="' + String(b.alt).replace(/"/g, '&quot;') + '"'
      + ' style="object-position:' + (o.focal || b.focal) + '"'
      + (eager ? ' fetchpriority="high" decoding="sync"' : ' loading="lazy" decoding="async"')
      + '>'
      + '</picture>';
  }

  /* Bild + ram (.nx-fig). Ramen bär tint-färgen som platshållare och är det
     som roteras/skalas — själva <img> lämnas ifred. */
  function platta(key, opts) {
    const b = hämta(key);
    if (!b) return '';
    const o = opts || {};
    /* klassen hör till ramen, inte till bilden — annars matchar
       t.ex. '.nx-story-lager' både <figure> och <img> */
    const inre = Object.assign({}, o);
    delete inre.klass;
    return '<figure class="nx-fig' + (o.klass ? ' ' + o.klass : '') + '"'
      + ' style="--tint:' + b.tint + '"'
      + (o.attrs || '') + '>'
      + img(key, inre)
      + '</figure>';
  }

  function info(key) { return hämta(key); }

  /* Samma ram (.nx-fig) som platta(), men med en tyst, loopande
     video istället för en bild. Videon får klasserna 'nx-img
     nx-laddad' direkt — postern (en vanlig bildruta ur klippet)
     syns ögonblickligen så det finns inget vitt-blink att tona
     bort, till skillnad från platta()/img() som väntar på 'load'. */
  function videoPlatta(opts) {
    const o = opts || {};
    const auto = !NXMotion.reducerad;
    return '<figure class="nx-fig' + (o.klass ? ' ' + o.klass : '') + '"'
      + ' style="--tint:' + (o.tint || '#8E8C84') + '"'
      + (o.attrs || '') + '>'
      + '<video class="nx-img nx-laddad"'
      + ' width="' + o.w + '" height="' + o.h + '"'
      + ' poster="' + o.poster + '"'
      + ' style="object-position:' + (o.focal || '50% 50%') + '"'
      + ' muted playsinline preload="auto"' + (auto ? ' autoplay loop' : '')
      + '><source src="' + o.src + '" type="video/mp4"></video>'
      + '</figure>';
  }

  return { img, platta, videoPlatta, info, srcset, MAPP };
})();


/* ============================================================
   NXStory — bildberättelsen

   Ett anrop bygger en pinnad scen där flera foton rör sig genom
   ett 3D-rum medan man scrollar. Se §31: lägg till en bild genom
   att lägga till ett objekt i listan.

     NXStory.bygg(host, {
       bilder: [
         { key:'hero', in:0.00, ut:0.46,
           från:{ z:0, skala:1, x:0, y:0, rotY:0, rotX:0, rotZ:0 },
           till:{ z:-240, skala:.84, x:-4, rotY:-13 },
           fade:[0, .02, .34, .46] },
         ...
       ],
       texter: [ { el, in:.., ut:.. } ]
     })

   från/till interpoleras över bildens egen in→ut-sträcka.
   fade är fyra hållpunkter för opaciteten: [börja, framme, börja
   tona ut, borta]. Utelämnas fade används in/ut rakt av.

   Enheter: z i px (translateZ), x/y i procent av bildens storlek,
   skala som faktor, rot* i grader, blur i px, radie i px.
   ============================================================ */
const NXStory = (function () {
  'use strict';

  const NOLL = { z: 0, skala: 1, x: 0, y: 0, rotY: 0, rotX: 0, rotZ: 0, blur: 0, radie: null };

  /* Hur mycket av 3D:n som används i varje läge. Mobilen får samma
     berättelse men lugnare — inte en hopkrympt skrivbordsversion. */
  const DÄMPNING = { full: 1, lite: 0.42, still: 0 };

  /* Två lägen räcker för en bild som bara kommer eller bara går.
     En bild mitt i berättelsen ska däremot komma fram, dominera och
     sedan dra sig tillbaka — den behöver ett läge till. Ange 'mitt'
     så tolkas resan som från → mitt → till, med brytpunkten
     'mittVid' (0–1 i scenens egen tid, förval 0.5). */
  function värde(k, b, t) {
    const start = (b.från && b.från[k] != null) ? b.från[k] : NOLL[k];
    const slut = (b.till && b.till[k] != null) ? b.till[k] : start;
    if (!b.mitt) return start + (slut - start) * t;

    const mitt = (b.mitt[k] != null) ? b.mitt[k] : start;
    const m = (b.mittVid != null) ? b.mittVid : 0.5;
    if (t <= m) return start + (mitt - start) * (m > 0 ? t / m : 1);
    return mitt + (slut - mitt) * (m < 1 ? (t - m) / (1 - m) : 1);
  }

  function bygg(host, config) {
    if (!host) return null;
    const bilder = config.bilder || [];
    const texter = config.texter || [];
    const dämp = () => DÄMPNING[NXMotion.tier] != null ? DÄMPNING[NXMotion.tier] : 1;

    /* --- måla upp bildlagren --- */
    const scen = document.createElement('div');
    scen.className = 'nx-story-scen';
    scen.innerHTML = bilder.map((b, i) =>
      b.video
        ? NXImg.videoPlatta(Object.assign({
            klass: 'nx-story-lager',
            attrs: ' data-lager="' + i + '"'
          }, b.video))
        : NXImg.platta(b.key, {
            klass: 'nx-story-lager',
            sizes: config.sizes || '(max-width: 900px) 92vw, 52vw',
            eager: i === 0 && !!config.eagerFörsta,
            attrs: ' data-lager="' + i + '"'
          })
    ).join('');
    host.appendChild(scen);

    const lager = Array.from(scen.querySelectorAll('.nx-story-lager'));

    /* Startläget skrivs direkt, innan första scrollen, så att inget
       står fel en bildruta. I 'still' är det också slutläget. */
    function måla(p) {
      const d = dämp();
      for (let i = 0; i < bilder.length; i++) {
        const b = bilder[i], el = lager[i];
        if (!el) continue;

        const t = NXMotion.easeInOut(NXMotion.span(p, b.in, b.ut));
        const o = NXMotion.trapets(p, b.fade || [b.in, b.in + 0.02, b.ut - 0.06, b.ut]);

        /* Helt genomskinliga lager tas ur renderingen. Det är den
           enskilt viktigaste raden för bildfrekvensen här. */
        if (o <= 0.001) {
          if (el.style.visibility !== 'hidden') {
            el.style.visibility = 'hidden';
            el.style.willChange = 'auto';
            const v = el.querySelector('video');
            if (v) v.pause();
          }
          continue;
        }
        if (el.style.visibility === 'hidden') {
          el.style.visibility = 'visible';
          el.style.willChange = 'transform, opacity';
          const v = el.querySelector('video');
          if (v) v.play().catch(() => {});
        }

        const z = värde('z', b, t) * d;
        const sk = 1 + (värde('skala', b, t) - 1) * d;
        const x = värde('x', b, t) * d;
        const y = värde('y', b, t) * d;
        const rY = värde('rotY', b, t) * d;
        const rX = värde('rotX', b, t) * d;
        const rZ = värde('rotZ', b, t) * d;
        const bl = värde('blur', b, t) * d;

        el.style.transform =
          'translate3d(' + x.toFixed(2) + '%,' + y.toFixed(2) + '%,' + z.toFixed(1) + 'px)'
          + ' rotateX(' + rX.toFixed(2) + 'deg)'
          + ' rotateY(' + rY.toFixed(2) + 'deg)'
          + ' rotateZ(' + rZ.toFixed(2) + 'deg)'
          + ' scale(' + sk.toFixed(4) + ')';
        el.style.opacity = o.toFixed(3);
        el.style.filter = bl > 0.05 ? 'blur(' + bl.toFixed(1) + 'px)' : '';
        /* längst fram = det lager som ligger närmast tittaren */
        el.style.zIndex = String(10 + Math.round(z / 10));
      }

      /* --- texterna: en i taget, korsande --- */
      for (let i = 0; i < texter.length; i++) {
        const t = texter[i];
        if (!t.el) continue;
        const o = NXMotion.trapets(p, t.fade || [t.in, t.in + 0.05, t.ut - 0.07, t.ut]);
        if (o <= 0.001) {
          if (t.el.style.visibility !== 'hidden') {
            t.el.style.visibility = 'hidden';
            t.el.setAttribute('aria-hidden', 'true');
          }
          continue;
        }
        if (t.el.style.visibility === 'hidden' || !t.el.style.visibility) {
          t.el.style.visibility = 'visible';
          t.el.removeAttribute('aria-hidden');
        }
        /* liten uppåtrörelse, aldrig mer än några pixlar */
        const lyft = (1 - o) * 14 * dämp();
        t.el.style.opacity = o.toFixed(3);
        t.el.style.transform = 'translate3d(0,' + lyft.toFixed(1) + 'px,0)';
      }
    }

    if (NXMotion.reducerad) {
      /* Ingen scrollrörelse: visa första bilden och första texten
         stilla, resten döljs. Sidan ska vara vacker utan rörelse. */
      lager.forEach((el, i) => {
        el.style.transform = 'none';
        el.style.opacity = i === 0 ? '1' : '0';
        el.style.visibility = i === 0 ? 'visible' : 'hidden';
      });
      texter.forEach((t, i) => {
        if (!t.el) return;
        t.el.style.opacity = i === 0 ? '1' : '0';
        t.el.style.visibility = i === 0 ? 'visible' : 'hidden';
        if (i !== 0) t.el.setAttribute('aria-hidden', 'true');
      });
      /* men berättelsens innehåll finns kvar för skärmläsare och
         den statiska listan under scenen tar över. */
      host.closest('[data-story]')?.setAttribute('data-story-still', 'true');
      return { måla };
    }

    måla(0);
    NXMotion.scene(scen, {
      mät: config.mät || host.closest('[data-story]') || host,
      läge: 'pin',
      run: måla
    });

    return { måla, lager };
  }

  return { bygg };
})();


/* ============================================================
   NXFin — det man inte märker att man märker

   Magnetiska knappar, parallax, textavslöjande, header.
   Allt stängs av i 'still', och allt som bygger på mus stängs av
   på pekskärm.
   ============================================================ */
const NXFin = (function () {
  'use strict';

  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* Ligger elementet redan inne i vyn? Används för att visa det
     som syns vid inladdning direkt, utan att vänta på scroll. */
  function iVyn(el) {
    const h = document.documentElement.clientHeight || window.innerHeight || 0;
    /* Går vyhöjden inte att läsa vet vi ingenting om var elementet
       står. Då visar vi det hellre än gömmer det. */
    if (!h) return true;
    const r = el.getBoundingClientRect();
    return r.top < h * 0.92 && r.bottom > 0;
  }

  /* ---------- rubriker som kommer in rad för rad ----------
     Delar på <br> och på ordmellanrum, aldrig på bokstäver — texten
     ska gå att läsa och markera som vanligt. */
  function radAvslöj(sel) {
    $$(sel).forEach(el => {
      if (el.dataset.split === 'klar') return;
      el.dataset.split = 'klar';

      /* Behåll originalet för skärmläsare, animera en kopia. */
      const rader = el.innerHTML.split(/<br\s*\/?>/i);
      /* Namnet byggs ur raderna med mellanslag: textContent tappar <br>,
         och "känns<br>som" lästes som "kännssom" (2026-10-07). */
      const tmp = document.createElement('div');
      el.setAttribute('aria-label', rader.map(r => { tmp.innerHTML = r; return tmp.textContent.trim(); })
        .filter(Boolean).join(' '));
      el.innerHTML = rader.map(r =>
        '<span class="nx-rad" aria-hidden="true"><span class="nx-rad-i">' + r.trim() + '</span></span>'
      ).join('');

      if (NXMotion.reducerad) { el.classList.add('nx-in'); return; }

      /* Står den redan i vyn ska den fram nu, inte vid nästa
         bildruta — annars blinkar sidtoppen tom vid inladdning. */
      if (iVyn(el)) { el.classList.add('nx-in'); return; }

      NXMotion.scene(el, {
        läge: 'enter', once: true,
        run: p => {
          if (p <= 0.02) return false;
          el.classList.add('nx-in');
        }
      });
    });
  }

  /* ---------- parallax ----------
     data-parallax="-8" = elementet rör sig 8% av sin egen höjd
     långsammare än sidan. Negativt = uppåt. */
  function parallax(sel) {
    if (NXMotion.reducerad) return;
    const dämp = NXMotion.tier === 'lite' ? 0.45 : 1;
    $$(sel).forEach(el => {
      const mängd = Number(el.dataset.parallax || -8) * dämp;
      NXMotion.scene(el, {
        läge: 'cover',
        run: p => {
          const d = (p - 0.5) * 2 * mängd;
          el.style.transform = 'translate3d(0,' + d.toFixed(2) + '%,0)';
        }
      });
    });
  }

  /* ---------- header ----------
     Genomskinlig över hero, sedan lite mindre och med lätt oskärpa.
     Döljs när man scrollar neråt, kommer tillbaka när man vänder. */
  function header() {
    const hdr = document.getElementById('hdr');
    if (!hdr) return;
    let förra = window.scrollY, rafId = 0;

    /* Ligger sidans första sektion på mörk botten måste logotyp och
       meny vändas till ljust — annars står de svart mot svart. Vi
       läser det ur markupen i stället för att skriva en egen header
       per sida, så att headern kan förbli identisk överallt. */
    const först = document.querySelector('main > section, main > *');
    if (först && (först.classList.contains('on-band') || först.classList.contains('nx-mork')
                  || först.classList.contains('nx-hero-film'))) {
      hdr.classList.add('pa-mork');
    }

    const uppdatera = () => {
      rafId = 0;
      const y = window.scrollY;
      hdr.classList.toggle('stuck', y > 10);
      hdr.classList.toggle('djup', y > 220);
      /* göm bara långt ner på sidan, och aldrig med öppen meny */
      const gömd = y > 640 && y > förra + 4 && !document.body.classList.contains('nx-låst');
      if (y < förra - 4 || y < 640) hdr.classList.remove('bort');
      else if (gömd) hdr.classList.add('bort');
      förra = y;
    };
    uppdatera();
    window.addEventListener('scroll', () => { if (!rafId) rafId = requestAnimationFrame(uppdatera); }, { passive: true });
  }

  /* ---------- sektioner som tonar in ----------
     Ersätter inte .rv i nextrum-app.js — den lever kvar. Det här
     är den lite mjukare varianten för de nya sektionerna. */
  function stiga(sel) {
    $$(sel).forEach(el => {
      if (NXMotion.reducerad || iVyn(el)) { el.classList.add('nx-in'); return; }
      NXMotion.scene(el, {
        läge: 'enter', once: true,
        run: p => {
          if (p <= 0.02) return false;
          el.classList.add('nx-in');
        }
      });
    });
  }

  /* Nödbroms.

     [data-stig] och radmasken börjar osynliga. Blir de av någon
     anledning aldrig avslöjade — strypt requestAnimationFrame,
     mätvärden som inte går att läsa, ett skript som fallerar efter
     oss — står halva sidan tom.

     Från två sekunder efter start tittar bromsen därför efter
     block som står I eller OVANFÖR vyn men ännu väntar, och visar
     dem. Block längre ner lämnas åt scrollen. Förut visades allt
     efter två sekunder oavsett var det stod, och det dolde att
     scrollavslöjandet aldrig fungerade — sidan såg frisk ut för att
     bromsen gjorde motorns jobb.

     Går vyhöjden inte att läsa vet vi ingenting, och då visas allt.

     Rörelse är en bonus. Texten är inte förhandlingsbar. */
  function nödbroms() {
    const kolla = () => {
      const väntar = $$('[data-stig]:not(.nx-in), [data-avslöj]:not(.nx-in), .nx-ov-h:not(.nx-in), .nx-ftr-ord:not(.nx-in), .nx-rita:not(.nx-ritad), .nx-et:not(.nx-et-in)');
      if (!väntar.length) return false;
      const h = document.documentElement.clientHeight || window.innerHeight || 0;
      väntar.forEach(el => {
        if (!h || el.getBoundingClientRect().top < h * 0.92) el.classList.add('nx-in', 'nx-ritad', 'nx-et-in');
      });
      return true;
    };
    setTimeout(function varv() {
      if (kolla()) setTimeout(varv, 700);
    }, 2000);
  }

  /* ============================================================
     Utan det här händer ingenting när man trycker på ett kort i en
     iPhone. Safari låter :active gälla på länkar och knappar, men
     inte på ett vanligt element — om det inte finns någon
     touch-lyssnare på sidan. Då, och bara då, slås beteendet på för
     allt. Lyssnaren är tom med flit; det är själva existensen som
     räknas. passive:true så att den inte kan bromsa scrollningen.
     ============================================================ */
  function tryckbart() {
    document.addEventListener('touchstart', function () {}, { passive: true });
  }

  /* ============================================================
     HERO-VIDEON

     Klippet väger 4,9 MB. Med preload="auto" i markupen hämtades det
     på varje besök, telefoner inräknat — 91 % av startsidans hela
     vikt för en bakgrund som ingen bett om. Filen har därför ingen
     src i HTML:en alls; den sätts här, och bara när den ska synas.

     Två lägen visar affischbilden i stället, som redan ligger i
     poster-attributet och alltså inte kostar något extra:
       - besökaren har valt bort rörelse i sitt system
       - webbläsaren säger att uppkopplingen är dyr eller långsam

     Smal skärm spelade förut inte alls (max-width:640px), och Leo
     2026-09-29: "heron rullar ej automatiskt på mobil vy". Telefonen
     får i stället en egen fil, data-video-mobil: 540 px hög och 255 kB
     mot 5 MB, som slöjan och brightness(.54) gör omöjlig att skilja
     från originalet. Det var datan som var skälet att avstå.

     Laddningen väntar dessutom på load, så att den aldrig konkurrerar
     med hjältens egen bild om bandbredden.
     ============================================================ */
  function heroVideo() {
    const v = document.querySelector('.nx-hero-video[data-video]');
    if (!v) return;

    const n = navigator.connection || {};
    const avstå =
      matchMedia('(prefers-reduced-motion:reduce)').matches ||
      n.saveData === true ||
      /(^|-)(2g|slow-2g)$/.test(n.effectiveType || '');
    if (avstå) return;

    function spela() {
      const p = v.play();
      if (p && p.catch) p.catch(nekad);
    }

    /* play() avvisas om webbläsaren nekar autouppspelning. Då står
       affischbilden kvar, vilket är rätt utfall tills vidare. iPhone i
       strömsparläge nekar också en tyst film, och där hjälper bara en
       gest: första trycket på sidan startar den. touchend och click
       räknas som gest, touchstart gör det inte. Lyssnarna sätts först
       när play() faktiskt nekats, så de flesta besökare får inga. */
    function nekad() {
      function igen() {
        document.removeEventListener('touchend', igen);
        document.removeEventListener('click', igen);
        if (v.paused) {
          const p = v.play();
          if (p && p.catch) p.catch(function () {});
        }
      }
      document.addEventListener('touchend', igen, { passive: true });
      document.addEventListener('click', igen);
    }

    function ladda() {
      if (v.querySelector('source')) return;
      const s = document.createElement('source');
      const smal = matchMedia('(max-width:640px)').matches;
      s.src = (smal && v.dataset.videoMobil) || v.dataset.video;
      s.type = 'video/mp4';
      v.appendChild(s);
      v.load();
      spela();
    }

    if (document.readyState === 'complete') ladda();
    else window.addEventListener('load', ladda, { once: true });
  }

  /* ============================================================
     EFFEKTER (2026-10-27)

     Fyra effekter i samma anda som React Bits (SplitText/BlurText,
     SpotlightCard, Aurora, ShinyText), skrivna om i vanlig JS och CSS:
     sajten har inget React och inget byggsteg. Ingen av dem rör HTML:en
     på sidorna eller på /en/. De hittar sina element på klasser som
     redan finns, och stilen ligger i nextrum-cinema.css (EFFEKTER).

     Reglerna som gäller dem alla:
       - bara transform, opacity och en gradient som följer muspekaren,
         aldrig layout och ingen animerad box-shadow
       - still (reducerad rörelse): ingenting delas, ingenting läggs in
       - lite (telefon, pekskärm): ingen musglans och ingen oskärpa
       - texten finns kvar för skärmläsare och går att markera
     ============================================================ */

  /* ---------- rubriker som kommer in ord för ord ----------
     Som radAvslöj, fast ord för ord med lite oskärpa. Bara h2 i main som
     inte redan har radavslöj, och aldrig en rubrik vars text sätts av
     data (priser och tal), för då delades texten innan den kommit. */
  const ORD_BORT = '[data-ordfyll],[data-avslöj],[data-erb],[data-stat],[data-erb-rabatterat],[data-erb-spara],[data-erb-mindre]';
  function ordRubriker(sel) {
    if (NXMotion.reducerad) return;
    $$(sel).forEach(el => {
      if (el.dataset.ov === 'klar' || el.matches(ORD_BORT) || el.querySelector(ORD_BORT)) return;
      if (el.closest('footer, form, [hidden], [aria-hidden="true"]') || el.querySelector('.nx-ord')) return;
      const namn = el.textContent.replace(/\s+/g, ' ').trim();
      if (!namn) return;
      el.dataset.ov = 'klar';

      /* Orden delas i textnoderna, så <em> och <br> står kvar. */
      let i = 0;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const noder = [];
      while (walker.nextNode()) noder.push(walker.currentNode);
      noder.forEach(n => {
        const delar = n.nodeValue.split(/(\s+)/);
        if (delar.every(d => !d.trim())) return;
        const frag = document.createDocumentFragment();
        delar.forEach(d => {
          if (!d) return;
          if (!d.trim()) { frag.appendChild(document.createTextNode(d)); return; }
          const s = document.createElement('span');
          s.className = 'nx-ov';
          s.style.setProperty('--i', Math.min(i++, 14));
          s.textContent = d;
          frag.appendChild(s);
        });
        n.parentNode.replaceChild(frag, n);
      });
      el.setAttribute('aria-label', namn);
      el.classList.add('nx-ov-h');
      Array.from(el.children).forEach(c => { if (!c.matches('br')) c.setAttribute('aria-hidden', 'true'); });
      /* Textnoder direkt i rubriken (utan <em>) har blivit spans och
         döljs för skärmläsare av namnet ovan, inte av aria-hidden. */

      if (iVyn(el)) { requestAnimationFrame(() => el.classList.add('nx-in')); return; }
      NXMotion.scene(el, {
        läge: 'enter', once: true,
        run: p => {
          if (p <= 0.04) return false;
          el.classList.add('nx-in');
        }
      });
    });
  }

  /* ---------- glans som följer muspekaren ----------
     Ett kort får en ljuspunkt under pekaren. Läggs in som ett eget
     barn (aldrig ::before eller ::after, som korten redan använder) och
     bara med mus på stor skärm. Färgen är kortets ämnesfärg (--f) när
     det har en. */
  function glans(sel) {
    if (NXMotion.tier !== 'full') return;
    if (!window.matchMedia('(hover: hover)').matches) return;
    $$(sel).forEach(kort => {
      if (kort.dataset.glans === 'klar') return;
      kort.dataset.glans = 'klar';
      if (getComputedStyle(kort).position === 'static') kort.style.position = 'relative';
      const g = document.createElement('span');
      g.className = 'nx-glans';
      g.setAttribute('aria-hidden', 'true');
      kort.insertBefore(g, kort.firstChild);
      let rad = 0, x = 0, y = 0;
      const sätt = () => {
        rad = 0;
        g.style.setProperty('--gx', x + 'px');
        g.style.setProperty('--gy', y + 'px');
      };
      kort.addEventListener('pointermove', e => {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        const r = kort.getBoundingClientRect();
        x = e.clientX - r.left;
        y = e.clientY - r.top;
        if (!rad) rad = requestAnimationFrame(sätt);
        kort.classList.add('nx-glans-pa');
      }, { passive: true });
      kort.addEventListener('pointerleave', () => kort.classList.remove('nx-glans-pa'));
    });
  }

  /* ---------- norrsken på de mörka avslutningarna ----------
     Tre mjuka färgfläckar som driver långsamt bakom texten. Bara
     transform, och bara medan sektionen syns (klassen pa). */
  function norrsken(sel) {
    if (NXMotion.reducerad) return;
    $$(sel).forEach(sek => {
      if (sek.querySelector('.nx-norrsken')) return;
      const n = document.createElement('div');
      n.className = 'nx-norrsken';
      n.setAttribute('aria-hidden', 'true');
      n.innerHTML = '<i></i><i></i><i></i>';
      sek.insertBefore(n, sek.firstChild);
      sek.classList.add('nx-har-norrsken');
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(es => es.forEach(e => n.classList.toggle('pa', e.isIntersecting)),
          { rootMargin: '10% 0px' }).observe(sek);
      } else {
        n.classList.add('pa');
      }
    });
  }

  /* ---------- det stora ordet i foten fylls på ----------
     Samma ord som förut, men en ljusare färg sveper över det en gång när
     foten kommer fram. */
  function fotOrd(sel) {
    if (NXMotion.reducerad) return;
    $$(sel).forEach(el => {
      if (iVyn(el)) { el.classList.add('nx-in'); return; }
      NXMotion.scene(el, {
        läge: 'enter', once: true,
        run: p => {
          if (p <= 0.05) return false;
          el.classList.add('nx-in');
        }
      });
    });
  }

  /* ---------- ikoner som ritar sig själva ----------
     Linjeikonerna på korten (Hur hjälper vi, Rätt match och Allt på ett
     ställe) ritas upp när de kommer i bild. Bara former utan fyllning
     (fill none) räknas, och ordningen mellan formerna ger en liten
     fördröjning (--j). Streckets längd mäts en gång. */
  function ritaIkoner(sel) {
    if (NXMotion.reducerad) return;
    $$(sel).forEach(svg => {
      if (svg.dataset.rita === 'klar') return;
      svg.dataset.rita = 'klar';
      let j = 0;
      $$('path,circle,line,polyline,rect,ellipse', svg).forEach(f => {
        if (!f.getTotalLength || getComputedStyle(f).fill !== 'none') return;
        let l = 0;
        try { l = Math.ceil(f.getTotalLength()); } catch (e) { return; }
        if (!l) return;
        f.style.setProperty('--l', l);
        f.style.setProperty('--j', j++);
      });
      if (!j) return;
      svg.classList.add('nx-rita');
      if (iVyn(svg)) { requestAnimationFrame(() => svg.classList.add('nx-ritad')); return; }
      NXMotion.scene(svg, {
        läge: 'enter', once: true,
        run: p => {
          if (p <= 0.1) return false;
          svg.classList.add('nx-ritad');
        }
      });
    });
  }

  /* ---------- strecket framför etiketterna ---------- */
  function etiketter(sel) {
    if (NXMotion.reducerad) return;
    $$(sel).forEach(el => {
      if (iVyn(el)) { requestAnimationFrame(() => el.classList.add('nx-et-in')); return; }
      NXMotion.scene(el, {
        läge: 'enter', once: true,
        run: p => {
          if (p <= 0.06) return false;
          el.classList.add('nx-et-in');
        }
      });
    });
  }

  /* ---------- ämnesbandet ----------
     Bandet följer scrollen (2026-10-27, Leo): det rör sig bara när sidan
     scrollas, åt vänster på väg nedåt.
     Markupen har en rad ämnen; resten är kopior (aria-hidden) som
     skriptet lägger till tills raden är bredare än två fönster. Bara
     transform, och loopen går bara medan bandet syns. */
  function amnesband(sel) {
    $$(sel).forEach(band => {
      const spar = band.querySelector('.nx-amnesband-spar');
      const rad = spar && spar.querySelector('.nx-amnesband-rad');
      if (!rad || NXMotion.reducerad) return;
      let bredd = 0;
      const fyll = () => {
        spar.querySelectorAll('.nx-amnesband-rad[aria-hidden]').forEach(k => k.remove());
        bredd = rad.getBoundingClientRect().width;
        if (!bredd) return;
        const antal = Math.min(8, Math.ceil((window.innerWidth * 2) / bredd) + 1);
        for (let i = 0; i < antal; i++) {
          const k = rad.cloneNode(true);
          k.setAttribute('aria-hidden', 'true');
          k.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
          spar.appendChild(k);
        }
      };
      fyll();
      /* Läget följer sidans scroll rakt av: nedåt flyttar bandet åt
         vänster, ingen egen drift. Ett varv är en radbredd. */
      let synlig = false, rad_ = 0;
      const faktor = NXMotion.tier === 'lite' ? 0.9 : 0.6;
      const steg = () => {
        rad_ = 0;
        if (!synlig || !bredd) return;
        const r = band.getBoundingClientRect();
        const bana = window.innerHeight - r.top;
        const x = -((bana * faktor) % bredd + bredd) % bredd;
        spar.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)';
      };
      const be = () => { if (synlig && !rad_) rad_ = requestAnimationFrame(steg); };
      window.addEventListener('scroll', be, { passive: true });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(es => es.forEach(e => {
          synlig = e.isIntersecting;
          be();
        }), { rootMargin: '10% 0px' }).observe(band);
      }
      let tid = 0;
      window.addEventListener('resize', () => { clearTimeout(tid); tid = setTimeout(fyll, 200); }, { passive: true });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(fyll);
    });
  }

  function allt() {
    header();
    tryckbart();
    heroVideo();
    radAvslöj('[data-avslöj]');
    stiga('[data-stig]');
    parallax('[data-parallax]');
    ordRubriker('main h2');
    glans('.hj-del, .nlx-del, .nx-price-card, .pr-erb-plan, .sid-kort, .jn-kort, .dr-kort, .sc-card');
    norrsken('.nx-final-cinema, .nx-page-hero.bli-svart');
    fotOrd('.nx-ftr-ord');
    ritaIkoner('.bu-fig svg, .hj-ikon svg');
    etiketter('.nx-et');
    amnesband('.nx-amnesband');
    nödbroms();
  }

  return { allt, header, heroVideo, radAvslöj, stiga, parallax, nödbroms, tryckbart,
           ordRubriker, glans, norrsken, fotOrd, ritaIkoner, etiketter, amnesband };
})();
