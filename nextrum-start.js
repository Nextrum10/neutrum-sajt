/* ============================================================
   NEXTRUM — STARTSIDAN

   Rörelsen på startsidan, från manifestet och nedåt. Hero rörs
   inte (Leo 2026-09-25: "jag vill bevara heron").

     ordfyll        rubrikernas ord fylls i ett i taget vid scroll
     ark            manifestets blad glider upp över filmen
     hållpunkter    1–4: den man pekar på kommer fram
     studiehjälpare korten delas ut när man scrollar fram
     band           Trygg hjälp: det rullande bandet
     vägg           Så kan ett pass se ut: fotona öppnas som ridåer
     studievy       illustrationen av föräldravyn, som går att röra

   STARTAR AV SIG SJÄLV, och det är med flit. Startsidans eget skript
   anropar inget här: laddar filen inte — gammal cache, ett nätfel —
   finns inget anrop som kastar och tar resten av sidans skript med
   sig. Sidan står då i sitt slutläge, för inget startläge i
   nextrum-start.css gömmer något utan html.nx-sr, och den klassen
   sätts här.

   ORDNINGEN I SIDAN SPELAR ROLL. Filen laddas FÖRE sidans eget
   skript, så bandets kopior finns när NX.initDrag() letar upp
   korten. Då får kopiorna samma utfällning som originalen utan att
   den skrivs två gånger.

   INGEN TEXT SKRIVS HÄR. Allt man läser står i sidans markup, på
   båda språken. Generatorn översätter aldrig ett skript, och det
   som skrivs härifrån hade blivit svenskt på den engelska sidan
   utan att någon kontroll såg det (CLAUDE.md, avsnitt 4). Det som
   kopieras — en vald tid, ett valt ämne — läses ur knappen man
   tryckte på, som redan står på rätt språk.
   ============================================================ */
const NXStart = (function () {
  'use strict';

  if (typeof NXMotion === 'undefined') return {};

  const M = NXMotion;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const rörelse = M.tier !== 'still';
  const full = M.tier === 'full';
  const mus = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const vh = () => document.documentElement.clientHeight || window.innerHeight;

  /* Varje del för sig. En del som kastar ska inte ta de andra med
     sig — en trasig studievy är inget skäl att bandet står still. */
  function prova(namn, fn) {
    try { fn(); } catch (e) { console.warn('NXStart.' + namn + ':', e); }
  }

  /* ============================================================
     ORDFYLLNADEN
     Varje ord blir ett eget <span>, och opaciteten följer scrollen
     från vänster till höger. Texten ligger kvar i DOM:en som text —
     den går att markera och läses av skärmläsare som förut, till
     skillnad från radavslöjandet som animerar en kopia.
     ============================================================ */
  function delaOrd(el) {
    const gå = n => {
      Array.from(n.childNodes).forEach(c => {
        if (c.nodeType === 3) {
          if (!c.textContent.trim()) return;
          const frag = document.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach(d => {
            if (!d) return;
            if (/^\s+$/.test(d)) { frag.appendChild(document.createTextNode(d)); return; }
            const s = document.createElement('span');
            s.className = 'nx-ord';
            s.textContent = d;
            frag.appendChild(s);
          });
          c.replaceWith(frag);
        } else if (c.nodeType === 1 && c.tagName !== 'BR') {
          gå(c);
        }
      });
    };
    gå(el);
    return $$('.nx-ord', el);
  }

  function ordfyll() {
    $$('[data-ordfyll]').forEach(el => {
      const ord = delaOrd(el);
      if (!rörelse || !ord.length) return;
      const n = ord.length;
      M.scene(el, {
        läge: 'cover',
        run: (p, s) => {
          /* 0 när rubriken står längst ner, 1 när den nått en bit
             ovanför mitten — då ska sista ordet vara fyllt och läsbart
             innan man scrollat förbi. */
          const f = M.span(s.top - window.scrollY, vh() * 0.9, vh() * 0.36);
          for (let i = 0; i < n; i++) {
            const t = M.clamp(f * (n + 1.2) - i, 0, 1);
            ord[i].style.opacity = (0.14 + 0.86 * t).toFixed(3);
          }
        }
      });
    });
  }

  /* ============================================================
     ARKET
     Manifestets papper ligger som ett blad över filmens underkant,
     indraget och med rundade hörn. Det växer ut till full bredd när
     man scrollar. Bara två CSS-variabler på ett pseudoelement.
     ============================================================ */
  function ark() {
    const sek = $('.nx-manifest');
    if (!sek || !rörelse) return;
    const bredd = () => document.documentElement.clientWidth;
    M.scene(sek, {
      läge: 'cover',
      run: (p, s) => {
        const q = M.easeOut(M.span(s.top - window.scrollY, vh() * 0.95, vh() * 0.2));
        const sida = M.clamp(bredd() * 0.04, 12, 64);
        const r = M.clamp(bredd() * 0.04, 28, 56);
        sek.style.setProperty('--ark-sida', ((1 - q) * sida).toFixed(1) + 'px');
        sek.style.setProperty('--ark-r', ((1 - q) * r).toFixed(1) + 'px');
        sek.style.setProperty('--ark-grepp', M.clamp(1 - q * 1.6, 0, 1).toFixed(3));
      }
    });
  }

  /* ============================================================
     HÅLLPUNKTERNA
     Med mus sköter CSS allt (:has + :hover). På pekskärm finns ingen
     pekare, så där tänds punkten mitt i skärmen när listan står i en
     spalt, och den man trycker på annars. Två spalter och "mitt i
     skärmen" går inte ihop: två punkter på samma rad står lika nära.
     ============================================================ */
  function hållpunkter() {
    const ul = $('.nx-holdpunkter');
    if (!ul || mus) return;
    const li = $$(':scope > li', ul);
    const välj = el => {
      li.forEach(x => x.classList.toggle('pa', x === el));
      ul.classList.add('har-pa');
    };
    li.forEach(x => x.addEventListener('click', () => välj(x)));

    if (!rörelse) return;
    let enSpalt = false;
    const mät = () => {
      enSpalt = getComputedStyle(ul).gridTemplateColumns.split(' ').filter(Boolean).length === 1;
    };
    mät();
    window.addEventListener('resize', mät, { passive: true });
    M.scene(ul, {
      läge: 'cover',
      run: () => {
        if (!enSpalt) return;
        const mitt = vh() * 0.5;
        let bäst = null, avst = Infinity;
        li.forEach(x => {
          const r = x.getBoundingClientRect();
          const d = Math.abs(r.top + r.height / 2 - mitt);
          if (d < avst) { avst = d; bäst = x; }
        });
        if (bäst && !bäst.classList.contains('pa')) välj(bäst);
      }
    });
  }

  /* ============================================================
     STUDIEHJÄLPARNA
     Korten stiger upp, vrider sig rätt och landar, ett i taget per
     kolumn. Förloppet följer scrollen, så att det går baklänges om
     man scrollar tillbaka — korten läggs tillbaka i leken.

     Scenen mäter RADEN, inte korten. Ett kort som flyttas med
     transform har en getBoundingClientRect som flyttar sig med det,
     och en scen som mäter det den själv flyttar jagar sin egen svans.
     Kortens läge i raden läses ur offsetTop, som inte ser transform.

     Korten ritas när Supabase svarat, så en MutationObserver fångar
     dem. Startläget skrivs i observatörens callback, som körs före
     nästa bildruta: inget kort hinner synas på sin slutplats först.
     ============================================================ */
  function studiehjälpare() {
    const host = $('#showcase');
    if (!host || !rörelse) return;
    const dämp = full ? 1 : 0.55;
    const VRID = [-7, 3, 6, -4, 5, -3];
    let kol = 1;

    const kort = () => $$('.sc-card', host);
    function rita(k, t, i) {
      const e = M.easeOut(t);
      if (t >= 1) {
        k.style.transform = '';
        k.style.opacity = '';
        k.classList.add('nx-landad');
        return;
      }
      const vrid = VRID[i % VRID.length] * dämp * (1 - e);
      k.style.opacity = M.clamp(t * 1.7, 0, 1).toFixed(3);
      k.style.transform = 'translate3d(0,' + ((1 - e) * 120 * dämp).toFixed(1) + 'px,0)'
        + ' rotate(' + vrid.toFixed(2) + 'deg)'
        + ' scale(' + (0.86 + 0.14 * e).toFixed(4) + ')';
    }

    M.scene(host, {
      läge: 'cover',
      run: (p, s) => {
        const y = window.scrollY, h = vh();
        kort().forEach((k, i) => {
          const topp = s.top + k.offsetTop;
          const pk = M.span(y, topp - h * 0.98, topp - h * 0.32);
          const c = i % kol;
          rita(k, M.span(pk, c * 0.1, c * 0.1 + 0.8), i);
        });
      }
    });

    function nya() {
      kol = Math.max(1, getComputedStyle(host).gridTemplateColumns.split(' ').filter(Boolean).length);
      kort().forEach((k, i) => {
        if (k.dataset.delad) return;
        k.dataset.delad = '1';
        rita(k, 0, i);
      });
      /* Raden bytte höjd — allt under den står nu på ett annat ställe. */
      M.mätOm();
    }
    new MutationObserver(nya).observe(host, { childList: true });
    nya();
  }

  /* ============================================================
     BANDET
     Raden kopieras en gång till vänster och två gånger till höger,
     och glider sedan åt höger. När den gått en hel uppsättning
     hoppar den tillbaka lika långt — innehållet är periodiskt, så
     hoppet syns inte.

     Kopiorna är aria-hidden och ligger utanför tabbordningen, med
     egna id:n så att aria-controls fortfarande pekar rätt. En
     skärmläsare hör alltså sex kort, inte arton.

     Bandet stannar mjukt under pekaren, när ett kort är utfällt, när
     något i det har tangentbordsfokus, när man drar i det och när
     pausknappen är nedtryckt. Tangentbordsfokus hamnar alltid på ett
     ORIGINAL, och bandet glider då så att kortet står mitt i bild.
     ============================================================ */
  function band() {
    const rot = $('[data-band]');
    if (!rot || !rörelse) return;
    const ul = $('.nx-drag', rot);
    const knapp = $('[data-band-paus]');
    const orig = ul ? $$(':scope > li', ul) : [];
    if (orig.length < 2) return;

    let sats = 0;
    function klona() {
      const nr = sats++;
      const frag = document.createDocumentFragment();
      orig.forEach(li => {
        const k = li.cloneNode(true);
        k.setAttribute('aria-hidden', 'true');
        k.setAttribute('data-klon', '');
        $$('[id]', k).forEach(e => { e.id += '-k' + nr; });
        $$('[aria-controls]', k).forEach(e =>
          e.setAttribute('aria-controls', e.getAttribute('aria-controls') + '-k' + nr));
        $$('button, a, input, [tabindex]', k).forEach(e => e.setAttribute('tabindex', '-1'));
        frag.appendChild(k);
      });
      return frag;
    }

    rot.classList.add('pa');
    ul.insertBefore(klona(), ul.firstChild);
    ul.appendChild(klona());
    ul.appendChild(klona());
    if (knapp) knapp.hidden = false;

    const FART = full ? 30 : 22;           /* px per sekund, åt höger */
    let period = 0, x = 0, v = FART;
    let synlig = false, över = false, fokus = false, drar = false, pausad = false;
    let fokusX = 0, raf = 0, senast = 0;

    function mät() {
      const förra = period;
      period = orig[0].offsetLeft - ul.firstElementChild.offsetLeft;
      /* Bred skärm: se till att det finns innehåll hela vägen ut. */
      while (ul.scrollWidth < period * 2 + rot.clientWidth + 40) ul.appendChild(klona());
      if (förra) x = x * (period / förra);
      else x = -orig[0].offsetLeft + rot.clientWidth * 0.06;
      normalisera();
    }
    function normalisera() {
      if (!period) return;
      const golv = -(ul.scrollWidth - rot.clientWidth);
      while (x > 0) x -= period;
      while (x < golv) x += period;
    }
    const öppet = () => !!ul.querySelector('.dr-kort[aria-expanded="true"]');

    function steg(t) {
      raf = 0;
      const dt = senast ? Math.min(0.05, (t - senast) / 1000) : 0;
      senast = t;
      const stilla = över || drar || pausad || fokus || öppet();
      v += ((stilla ? 0 : FART) - v) * Math.min(1, dt * 4);
      if (fokus) x += (fokusX - x) * Math.min(1, dt * 7);
      else if (!drar) { x += v * dt; normalisera(); }
      ul.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
      if (synlig && !document.hidden) raf = requestAnimationFrame(steg);
    }
    function igång() {
      if (!raf && synlig && !document.hidden) { senast = 0; raf = requestAnimationFrame(steg); }
    }

    mät();
    ul.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
    window.addEventListener('resize', () => {
      clearTimeout(mät._t);
      mät._t = setTimeout(mät, 150);
    }, { passive: true });
    document.addEventListener('visibilitychange', igång);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(e => { synlig = e[0].isIntersecting; igång(); }).observe(rot);
    } else { synlig = true; igång(); }

    /* --- pekaren --- */
    rot.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') över = true; });
    rot.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') över = false; igång(); });

    /* --- tangentbordet --- */
    ul.addEventListener('focusin', e => {
      if (!e.target.matches(':focus-visible')) return;
      const li = e.target.closest('li');
      if (!li || li.hasAttribute('data-klon')) return;
      fokus = true;
      fokusX = rot.clientWidth / 2 - (li.offsetLeft + li.offsetWidth / 2);
      igång();
    });
    ul.addEventListener('focusout', e => {
      if (e.relatedTarget && ul.contains(e.relatedTarget)) return;
      fokus = false;
    });

    /* --- dra i det ---
       touch-action:pan-y i CSS: webbläsaren behåller den lodräta
       scrollen, och det vågräta kommer hit. Ett drag längre än sex
       pixlar är ett drag, inte ett tryck, och klicket som följer
       stoppas så att inget kort fälls ut av misstag. */
    let pid = null, startX = 0, startx = 0;
    rot.addEventListener('pointerdown', e => {
      if (!e.isPrimary || e.button !== 0) return;
      pid = e.pointerId; startX = e.clientX; startx = x;
    });
    rot.addEventListener('pointermove', e => {
      if (e.pointerId !== pid) return;
      const dx = e.clientX - startX;
      if (!drar && Math.abs(dx) > 6) {
        drar = true;
        rot.classList.add('drar');
        try { rot.setPointerCapture(pid); } catch (_) { /* redan släppt */ }
      }
      if (!drar) return;
      const före = startx + dx;
      x = före;
      normalisera();
      startx += x - före;
      ul.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
    });
    const släpp = e => {
      if (e.pointerId !== pid) return;
      pid = null;
      if (!drar) return;
      drar = false;
      rot.classList.remove('drar');
      const stopp = ev => { ev.stopPropagation(); ev.preventDefault(); };
      rot.addEventListener('click', stopp, { capture: true, once: true });
      setTimeout(() => rot.removeEventListener('click', stopp, { capture: true }), 0);
      igång();
    };
    rot.addEventListener('pointerup', släpp);
    rot.addEventListener('pointercancel', släpp);

    if (knapp) knapp.addEventListener('click', () => {
      pausad = !pausad;
      knapp.setAttribute('aria-pressed', String(pausad));
      igång();
    });
  }

  /* ============================================================
     BILDVÄGGEN
     Ridån går upp när fotot kommit en bit in i bild, en gång. Inte
     once:true i scenen: motorn markerar en once-scen som klar redan
     första gången den räknas, och det sker när den kommer inom
     marginalen — alltså innan den syns, med p = 0.
     ============================================================ */
  function vägg() {
    if (!rörelse) return;
    $$('.nx-vagg-grid figure').forEach(f => {
      let uppe = false;
      M.scene(f, {
        läge: 'enter',
        run: p => {
          if (uppe || p < 0.16) return;
          uppe = true;
          f.classList.add('nx-in');
          const klar = () => f.classList.add('nx-klar');
          const vid = e => {
            if (e.target !== f || e.propertyName !== 'clip-path') return;
            f.removeEventListener('transitionend', vid);
            klar();
          };
          f.addEventListener('transitionend', vid);
          setTimeout(klar, 1900);
        }
      });
    });
  }

  /* ============================================================
     STUDIEVYN

     En illustration man kan klicka i. Allt tillstånd bor i DOM:en
     som klasser, och allt klick går genom EN lyssnare på fönstret.
     Därför är "börja om" bara att byta .sd-app mot en ren kopia av
     markupen — inga lyssnare att koppla om, inget tillstånd att
     nollställa för hand.

     Rundturen är en pekare som klickar sig igenom vyn av sig själv.
     Den går bara när vyn syns, stannar för gott första gången någon
     själv klickar eller trycker på en tangent i den, och går att
     pausa med knappen under (WCAG 2.2.2).
     ============================================================ */
  function studievy() {
    const rot = $('[data-studievy]');
    if (!rot) return;
    const rum = $('.sd-rum', rot);
    const fönster = $('.sd-fonster', rot);
    const pekare = $('.sd-pekare', rot);
    const turKnapp = $('[data-sd-tur]');
    const mall = $('.sd-app', rot).cloneNode(true);
    let app = $('.sd-app', rot);

    const cfg = window.NEXTRUM_CONFIG || {};

    function förbered() {
      /* Priset kommer från konfigurationen, som överallt annars.
         Siffran i markupen är reserven. */
      if (cfg.PRIS_PER_TIMME) $$('[data-sd-pris]', rot).forEach(el => { el.textContent = String(cfg.PRIS_PER_TIMME); });
    }

    function räkna(sek) {
      $$('[data-sd-tal]', sek).forEach(el => {
        const mål = Number(el.dataset.sdTal) || 0;
        const text = el.firstChild;
        if (!text || text.nodeType !== 3) return;
        if (!rörelse) { text.nodeValue = String(mål); return; }
        const t0 = performance.now();
        const f = t => {
          const k = Math.min(1, (t - t0) / 950);
          text.nodeValue = String(Math.round(mål * M.easeOut(k)));
          if (k < 1) requestAnimationFrame(f);
        };
        text.nodeValue = '0';
        requestAnimationFrame(f);
      });
    }

    function visa(namn) {
      $$('.sd-sido [data-sd-visa]', app).forEach(b =>
        b.setAttribute('aria-current', String(b.dataset.sdVisa === namn)));
      $$('.sd-sek', app).forEach(s => s.classList.toggle('pa', s.dataset.sdSek === namn));
      const sek = $('.sd-sek.pa', app);
      if (sek) { sek.scrollTop = 0; räkna(sek); }
      if (namn === 'meddelanden') händelse('last');
      const b = $('.sd-sido [aria-current="true"]', app);
      if (b) iRaden(b);
    }

    /* Sidomenyn är en vågrät rad på telefon. Knappen man hamnar på
       ska synas — men bara raden rullas, aldrig sidan. */
    function iRaden(b) {
      const rad = b.parentElement;
      if (rad.scrollWidth <= rad.clientWidth) return;
      rad.scrollTo({ left: b.offsetLeft - rad.clientWidth / 2 + b.offsetWidth / 2, behavior: rörelse ? 'smooth' : 'auto' });
    }

    function händelse(nyckel) {
      $$('[data-sd-byt]', app).forEach(el => {
        if (el.dataset.sdByt.split(' ').indexOf(nyckel) !== -1) el.classList.add('bytt');
      });
      const n = $('.sd-flyt[data-sd-notis="' + nyckel + '"]', rot);
      if (n) notis(n);
    }

    function notis(el) {
      $$('.sd-flyt.syns', rot).forEach(x => { if (x !== el) x.classList.remove('syns'); });
      el.classList.remove('syns');
      void el.offsetWidth;
      el.classList.add('syns');
      clearTimeout(el._t);
      el._t = setTimeout(() => el.classList.remove('syns'), 3400);
    }

    /* En knapp som tänker en stund innan något händer. */
    function tänk(knapp, ms, sen) {
      knapp.classList.add('tanker');
      knapp.disabled = true;
      setTimeout(() => { knapp.classList.remove('tanker'); sen(); }, rörelse ? ms : 0);
    }

    function kopiera(nyckel, text) {
      $$('[data-sd-kopia="' + nyckel + '"]', app).forEach(el => { el.textContent = text; });
    }

    function väljDag(b) {
      $$('[data-sd-dag]', app).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      kopiera('dag', b.textContent.trim());
      const vald = g => $('[data-sd-val="' + g + '"][aria-pressed="true"]', app);
      kopiera('tid', vald('tid') ? vald('tid').textContent.trim() : '');
      kopiera('amne', vald('amne') ? vald('amne').textContent.trim() : '');
      const form = $('.sd-form', app);
      if (form) form.classList.add('bytt');
    }

    function väljChip(b) {
      const g = b.dataset.sdVal;
      $$('[data-sd-val="' + g + '"]', app).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      kopiera(g, b.textContent.trim());
    }

    function flik(b) {
      const namn = b.dataset.sdFlik;
      $$('[data-sd-flik]', app).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      $$('.sd-panel', app).forEach(p => p.classList.toggle('pa', p.dataset.sdPanel === namn));
    }

    function läxor() {
      const alla = $$('.sd-lax input', app);
      const klara = alla.filter(i => i.checked).length;
      const n = $('[data-sd-klara]', app);
      if (n) n.textContent = String(klara);
      const firande = $('.sd-lax-alla', app);
      if (firande) firande.classList.toggle('bytt', klara === alla.length);
    }

    function svara(b) {
      const nr = b.dataset.sdSvar;
      const egen = $('.sd-bubbla.sd-sen.egen', app);
      if (egen) egen.textContent = b.textContent.trim();
      händelse('svarat');
      const tråd = $('.sd-trad', app);
      const ner = () => { if (tråd) tråd.scrollTo({ top: tråd.scrollHeight, behavior: rörelse ? 'smooth' : 'auto' }); };
      ner();
      const skriver = $('.sd-skriver.svar', app);
      setTimeout(() => { if (skriver) skriver.classList.add('bytt'); ner(); }, rörelse ? 500 : 0);
      setTimeout(() => {
        if (skriver) skriver.classList.add('klar');
        händelse('svar' + nr);
        ner();
      }, rörelse ? 1800 : 0);
    }

    fönster.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || !app.contains(b) || b.disabled) return;
      const d = b.dataset;
      if (d.sdVisa) visa(d.sdVisa);
      else if (d.sdDag) väljDag(b);
      else if (d.sdVal) väljChip(b);
      else if (d.sdFlik) flik(b);
      else if (d.sdSvar) svara(b);
      else if ('sdForesla' in d) tänk(b, 750, () => händelse('foreslaget'));
      else if ('sdGodkann' in d) händelse('godkant');
      else if ('sdBetala' in d) tänk(b, 900, () => händelse('betalt'));
    });
    fönster.addEventListener('change', e => {
      if (e.target.matches('.sd-lax input')) läxor();
    });

    förbered();
    visa('oversikt');

    /* ---------- lutningen ----------
       Bara med mus på stor skärm. Fönstret vrider sig några grader
       mot pekaren, notiserna som svävar framför det rör sig mer, och
       en svag glans följer med över glaset. */
    if (full && mus) {
      let mx = 0, my = 0, tx = 0, ty = 0, g = 0, tg = 0, raf = 0;
      const steg = () => {
        mx += (tx - mx) * 0.09; my += (ty - my) * 0.09; g += (tg - g) * 0.1;
        rum.style.setProperty('--mx', mx.toFixed(4));
        rum.style.setProperty('--my', my.toFixed(4));
        fönster.style.setProperty('--glans', g.toFixed(3));
        raf = (Math.abs(tx - mx) + Math.abs(ty - my) + Math.abs(tg - g) > 0.002)
          ? requestAnimationFrame(steg) : 0;
      };
      rot.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        const r = rot.getBoundingClientRect();
        tx = M.clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5);
        ty = M.clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5);
        tg = 1;
        if (!raf) raf = requestAnimationFrame(steg);
      });
      rot.addEventListener('pointerleave', () => {
        tx = 0; ty = 0; tg = 0;
        if (!raf) raf = requestAnimationFrame(steg);
      });
    }

    /* ---------- resningen ----------
       Fönstret ligger bakåtlutat som ett blad på ett bord och reser
       sig medan man scrollar fram till det. */
    let hälsat = false;
    if (rörelse) {
      const d = full ? 1 : 0.5;
      M.scene(rot, {
        läge: 'enter',
        run: p => {
          const e = M.easeOut(p);
          rum.style.setProperty('--lyft-rx', ((1 - e) * 24 * d).toFixed(2) + 'deg');
          rum.style.setProperty('--lyft-y', ((1 - e) * 80 * d).toFixed(1) + 'px');
          rum.style.setProperty('--lyft-sk', (1 - (1 - e) * 0.08 * d).toFixed(4));
          if (p > 0.9 && !hälsat) {
            hälsat = true;
            const n = $('.sd-flyt[data-sd-notis="rapport"]', rot);
            if (n) setTimeout(() => notis(n), 500);
          }
        }
      });
    }

    /* ---------- rundturen ---------- */
    const TUR = [
      1800,
      '[data-sd-godkann]', 900,
      '.sd-sido [data-sd-visa="boka"]',
      '[data-sd-dag="15"]',
      '[data-sd-val="tid"]:nth-child(2)',
      '[data-sd-foresla]', 1700,
      '.sd-sido [data-sd-visa="lektioner"]', 1500,
      '.sd-sido [data-sd-visa="meddelanden"]', 3400,
      '[data-sd-svar="2"]', 2800,
      '.sd-sido [data-sd-visa="betalning"]',
      '[data-sd-betala]', 2000,
      '.sd-sido [data-sd-visa="utveckling"]', 2800,
      '.sd-sido [data-sd-visa="laxor"]',
      '.sd-lax input:not(:checked)', 1600,
      '.sd-sido [data-sd-visa="oversikt"]'
    ];
    let tur = null, turSynlig = false, rörd = false;

    function vänta(ms, tok) {
      return new Promise(klar => {
        let kvar = ms;
        const tick = () => {
          if (tok.stopp) return klar(false);
          if (turSynlig && !document.hidden) kvar -= 100;
          if (kvar <= 0) return klar(true);
          tok.t = setTimeout(tick, 100);
        };
        tick();
      });
    }

    /* Var ett element står i fönstrets egna koordinater. offsetLeft
       och offsetTop, inte getBoundingClientRect: fönstret lutar i 3D,
       och en rektangel efter perspektivet är inte en plats i det.
       Rullade behållare på vägen dras ifrån. */
    function läge(el) {
      let x = el.offsetWidth / 2, y = el.offsetHeight / 2, n = el;
      while (n && n !== fönster) {
        const p = n.offsetParent;
        x += n.offsetLeft; y += n.offsetTop;
        for (let a = n.parentElement; a && a !== p; a = a.parentElement) {
          x -= a.scrollLeft; y -= a.scrollTop;
        }
        if (p && p !== fönster) { x += p.clientLeft - p.scrollLeft; y += p.clientTop - p.scrollTop; }
        n = p;
      }
      return { x, y };
    }

    /* Ligger målet utanför sin rullande sektion rullas SEKTIONEN,
       aldrig sidan. Svarar sant om något rullades. */
    function fram(el) {
      if (el.closest('.sd-sido')) { iRaden(el); return true; }
      const sek = el.closest('.sd-sek');
      if (!sek) return false;
      let topp = 0;
      for (let n = el; n && n !== sek; n = n.offsetParent) topp += n.offsetTop;
      if (topp < sek.scrollTop || topp + el.offsetHeight > sek.scrollTop + sek.clientHeight) {
        sek.scrollTo({ top: Math.max(0, topp - sek.clientHeight / 3), behavior: rörelse ? 'smooth' : 'auto' });
        return true;
      }
      return false;
    }

    function nollställ() {
      const ny = mall.cloneNode(true);
      app.replaceWith(ny);
      app = ny;
      förbered();
      visa('oversikt');
    }

    async function körTur() {
      if (tur) return;
      const tok = tur = { stopp: false };
      if (turKnapp) turKnapp.classList.add('spelar');
      /* Pekaren börjar mitt i fönstret, inte i hörnet där den annars
         står innan första målet är satt. */
      pekare.style.setProperty('--px', (fönster.clientWidth * 0.55).toFixed(0) + 'px');
      pekare.style.setProperty('--py', (fönster.clientHeight * 0.6).toFixed(0) + 'px');
      pekare.classList.add('syns');
      while (!tok.stopp) {
        for (const s of TUR) {
          if (tok.stopp) break;
          if (typeof s === 'number') { await vänta(s, tok); continue; }
          const el = $(s, app);
          if (!el) continue;
          if (fram(el) && !(await vänta(500, tok))) break;
          const l = läge(el);
          pekare.style.setProperty('--px', l.x.toFixed(1) + 'px');
          pekare.style.setProperty('--py', l.y.toFixed(1) + 'px');
          if (!(await vänta(950, tok))) break;
          pekare.classList.remove('klick');
          void pekare.offsetWidth;
          pekare.classList.add('klick');
          el.click();
          if (!(await vänta(650, tok))) break;
        }
        if (tok.stopp || !(await vänta(4500, tok))) break;
        nollställ();
        if (!(await vänta(900, tok))) break;
      }
    }

    function stoppaTur() {
      if (tur) { tur.stopp = true; clearTimeout(tur.t); tur = null; }
      pekare.classList.remove('syns');
      if (turKnapp) turKnapp.classList.remove('spelar');
    }

    /* Den som själv tar i vyn har tagit över — också när rundturen
       inte går just då. Annars startar den när vyn kommer tillbaka i
       bild, och första steget är att nollställa det man själv gjort. */
    const tarÖver = e => {
      if (!e.isTrusted) return;
      rörd = true;
      if (tur) stoppaTur();
    };
    fönster.addEventListener('pointerdown', tarÖver);
    fönster.addEventListener('keydown', tarÖver);

    if (turKnapp) {
      turKnapp.hidden = false;
      turKnapp.addEventListener('click', () => {
        if (tur) { rörd = true; stoppaTur(); return; }
        nollställ();
        körTur();
      });
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(e => {
        turSynlig = e[0].isIntersecting;
        if (turSynlig && !tur && !rörd && rörelse) körTur();
      }, { threshold: 0.4 }).observe(fönster);
    }
  }

  function allt() {
    if (rörelse) document.documentElement.classList.add('nx-sr');
    prova('ordfyll', ordfyll);
    prova('ark', ark);
    prova('hållpunkter', hållpunkter);
    prova('studiehjälpare', studiehjälpare);
    prova('band', band);
    prova('vägg', vägg);
    prova('studievy', studievy);
  }

  allt();

  return { allt };
})();
