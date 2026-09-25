/* ============================================================
   NEXTRUM — STARTSIDAN

   Rörelsen på startsidan, från manifestet och nedåt. Hero rörs
   inte (Leo 2026-09-25: "jag vill bevara heron").

     ordfyll        rubrikernas ord tonar fram ett i taget
     hållpunkter    1–4: den man pekar på kommer fram
     studiehjälpare korten stiger upp när raden syns
     band           Trygg hjälp: det rullande bandet
     vägg           Så kan ett pass se ut: fotona stiger fram
     studievy       illustrationen av föräldravyn, som går att röra

   SKRIPTET SÄTTER KLASSER, CSS RÖR SIG. Första versionen räknade om
   korten, orden och ett blad för varje bildruta medan man scrollade.
   Det hackade (Leo: "alla animationer måste se mer smooth ut och inte
   laggiga"): varje bildruta väntade på huvudtråden, och
   getBoundingClientRect i en scrollslinga tvingar fram layout. Nu
   säger en IntersectionObserver när något kommer in i bild, EN klass
   sätts, och resten är transitions i nextrum-start.css som
   webbläsaren kör på grafikkortet. Bandet är en Web Animation av
   samma skäl. Skriv inte tillbaka stil per bildruta.

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

  /* Varje del för sig. En del som kastar ska inte ta de andra med
     sig — en trasig studievy är inget skäl att bandet står still. */
  function prova(namn, fn) {
    try { fn(); } catch (e) { console.warn('NXStart.' + namn + ':', e); }
  }

  /* När elementet kommer in i bild: kör fn, en gång.

     Står det redan OVANFÖR vyn räknas det också — den som laddar om
     sidan halvvägs ner ska inte ha osynliga block ovanför sig. Utan
     IntersectionObserver körs fn direkt: rörelse är en bonus, texten
     är det inte. */
  function närSyns(el, fn, marginal) {
    if (!('IntersectionObserver' in window)) { fn(el); return; }
    const io = new IntersectionObserver(poster => {
      poster.forEach(p => {
        if (!p.isIntersecting && p.boundingClientRect.top >= 0) return;
        io.unobserve(p.target);
        fn(p.target);
      });
    }, { rootMargin: marginal || '0px 0px -14% 0px' });
    io.observe(el);
  }

  const kolumner = el =>
    Math.max(1, getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length);

  /* ============================================================
     ORDFYLLNADEN
     Varje ord blir ett eget <span> med sin plats i --n. När rubriken
     syns får den .nx-fylld, och orden tonar fram i tur och ordning
     genom transition-delay. Texten ligger kvar i DOM:en som text —
     den går att markera och läses av skärmläsare som förut.
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
      ord.forEach((o, i) => o.style.setProperty('--n', String(i)));
      närSyns(el, () => el.classList.add('nx-fylld'), '0px 0px -22% 0px');
    });
  }

  /* ============================================================
     HÅLLPUNKTERNA
     Med mus sköter CSS allt (:has + :hover). På pekskärm finns ingen
     pekare, så där tänds punkten mitt i skärmen när listan står i en
     spalt, och den man trycker på annars. Två spalter och "mitt i
     skärmen" går inte ihop: två punkter på samma rad står lika nära.

     "Mitt i skärmen" är en IntersectionObserver vars rot är ett smalt
     band över mitten — ingen mätning medan man scrollar.
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

    if (!rörelse || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(poster => {
      if (kolumner(ul) !== 1) return;
      poster.forEach(p => { if (p.isIntersecting) välj(p.target); });
    }, { rootMargin: '-46% 0px -46% 0px' });
    li.forEach(x => io.observe(x));
  }

  /* ============================================================
     STUDIEHJÄLPARNA
     Varje kort stiger upp när det kommer in i bild, med en fördröjning
     per kolumn (--n) så att en rad kommer från vänster till höger.

     Korten ritas när Supabase svarat, så en MutationObserver fångar
     dem. Callbacken körs före nästa bildruta, och startläget står i
     CSS, så inget kort hinner synas på sin slutplats först.
     ============================================================ */
  function studiehjälpare() {
    const host = $('#showcase');
    if (!host || !rörelse) return;
    function nya() {
      const kol = kolumner(host);
      $$('.sc-card', host).forEach((k, i) => {
        if (k.dataset.delad) return;
        k.dataset.delad = '1';
        k.style.setProperty('--n', String(i % kol));
        närSyns(k, () => k.classList.add('nx-in'), '0px 0px -8% 0px');
      });
    }
    new MutationObserver(nya).observe(host, { childList: true });
    nya();
  }

  /* ============================================================
     BANDET
     Raden kopieras en gång till vänster och två gånger till höger,
     och glider sedan åt höger. Efter en hel uppsättning börjar den
     om — innehållet är periodiskt, så omstarten syns inte.

     EN WEB ANIMATION, INTE requestAnimationFrame. Förflyttningen
     beskrivs en gång och körs sedan av webbläsaren på grafikkortet;
     huvudtråden kan vara upptagen utan att bandet rycker. Att stanna
     och gå igång är playbackRate, som tonas mot 0 och tillbaka.

     Kopiorna är aria-hidden och ligger utanför tabbordningen, med
     egna id:n så att aria-controls fortfarande pekar rätt. En
     skärmläsare hör alltså sex kort, inte arton.

     Bandet stannar under pekaren, när ett kort är utfällt och när man
     drar i det. Tangentbordsfokus hamnar alltid på ett ORIGINAL, och
     då tar ett handstyrt läge över: animationen släpps och raden
     glider så att kortet står mitt i bild. När fokus lämnar bandet
     fortsätter animationen från samma ställe.
     ============================================================ */
  function band() {
    const rot = $('[data-band]');
    if (!rot || !rörelse || typeof rot.animate !== 'function') return;
    const ul = $('.nx-drag', rot);
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

    /* px per sekund. Leo: "de får scrolla lite snabbare" — var 30. */
    const FART = full ? 48 : 38;
    let period = 0, bas = 0, anim = null;
    let fart = 1, rampa = 0;
    let synlig = false, över = false, drar = false, hand = false, handX = 0;

    function mät() {
      period = orig[0].offsetLeft - ul.firstElementChild.offsetLeft;
      /* Bred skärm: se till att det finns innehåll hela vägen ut. */
      while (ul.scrollWidth < period * 2 + rot.clientWidth + 40) ul.appendChild(klona());
      bas = -orig[0].offsetLeft + rot.clientWidth * 0.06;
    }
    const längd = () => period / FART * 1000;
    const pos = t => ({ transform: 'translate3d(' + t.toFixed(1) + 'px,0,0)' });

    /* Var raden står vid en viss tid i animationen, och tvärtom. */
    function xFör(tid) {
      const f = (((tid || 0) % längd()) + längd()) % längd() / längd();
      return bas - period + f * period;
    }
    function tidFör(x) {
      const f = (((x - (bas - period)) / period) % 1 + 1) % 1;
      return f * längd();
    }
    const nuX = () => (anim ? xFör(anim.currentTime) : handX);

    function starta(x) {
      if (anim) anim.cancel();
      ul.style.transition = '';
      ul.style.transform = '';
      anim = ul.animate([pos(bas - period), pos(bas)],
        { duration: längd(), iterations: Infinity, easing: 'linear' });
      anim.currentTime = tidFör(x);
      anim.playbackRate = fart;
      if (!synlig) anim.pause();
      hand = false;
    }
    function släppAnim() {
      handX = nuX();
      if (anim) { anim.cancel(); anim = null; }
      ul.style.transform = pos(handX).transform;
      hand = true;
    }

    const öppet = () => !!ul.querySelector('.dr-kort[aria-expanded="true"]');
    /* Tona farten mot målet. rAF bara under de få bildrutor det tar,
       och det enda som skrivs är playbackRate. */
    function tona() {
      if (rampa) return;
      const steg = () => {
        const mål = (över || drar || öppet()) ? 0 : 1;
        fart += (mål - fart) * 0.14;
        if (Math.abs(mål - fart) < 0.01) fart = mål;
        if (anim) {
          if (anim.updatePlaybackRate) anim.updatePlaybackRate(fart);
          else anim.playbackRate = fart;
        }
        rampa = fart === mål ? 0 : requestAnimationFrame(steg);
      };
      rampa = requestAnimationFrame(steg);
    }

    mät();
    starta(bas);

    window.addEventListener('resize', () => {
      clearTimeout(mät._t);
      mät._t = setTimeout(() => {
        const f = anim ? anim.currentTime / längd() : 0;
        mät();
        if (!hand) starta(bas - period + (f % 1) * period);
      }, 150);
    }, { passive: true });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(e => {
        synlig = e[0].isIntersecting;
        if (!anim) return;
        if (synlig) anim.play(); else anim.pause();
      }).observe(rot);
    } else { synlig = true; anim.play(); }

    /* --- pekaren --- */
    rot.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { över = true; tona(); } });
    rot.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { över = false; tona(); } });

    /* --- ett utfällt kort --- initDrag() fäller ut; vi läser läget efteråt. */
    ul.addEventListener('click', () => setTimeout(tona, 0));

    /* --- tangentbordet --- */
    ul.addEventListener('focusin', e => {
      if (!e.target.matches(':focus-visible')) return;
      const li = e.target.closest('li');
      if (!li || li.hasAttribute('data-klon')) return;
      if (!hand) {
        släppAnim();
        /* Läs stilen en gång, så att övergången nedan börjar där raden
           faktiskt står och inte där animationen började. */
        getComputedStyle(ul).transform;
      }
      const mål = rot.clientWidth / 2 - (li.offsetLeft + li.offsetWidth / 2);
      ul.style.transition = 'transform .6s cubic-bezier(.16,1,.3,1)';
      handX = mål;
      ul.style.transform = pos(mål).transform;
    });
    ul.addEventListener('focusout', e => {
      if (e.relatedTarget && ul.contains(e.relatedTarget)) return;
      if (hand && !drar) starta(handX);
    });

    /* --- dra i det ---
       touch-action:pan-y i CSS: webbläsaren behåller den lodräta
       scrollen, och det vågräta kommer hit. Ett drag längre än sex
       pixlar är ett drag, inte ett tryck, och klicket som följer
       stoppas så att inget kort fälls ut av misstag. */
    let pid = null, startX = 0, x0 = 0;
    rot.addEventListener('pointerdown', e => {
      if (!e.isPrimary || e.button !== 0) return;
      pid = e.pointerId; startX = e.clientX;
    });
    rot.addEventListener('pointermove', e => {
      if (e.pointerId !== pid) return;
      const dx = e.clientX - startX;
      if (!drar && Math.abs(dx) > 6) {
        drar = true;
        rot.classList.add('drar');
        try { rot.setPointerCapture(pid); } catch (_) { /* redan släppt */ }
        släppAnim();
        ul.style.transition = '';
        x0 = handX - dx;
      }
      if (!drar) return;
      let x = x0 + dx;
      /* Håll raden inom en period åt vardera hållet. Innehållet är
         periodiskt, så ett hopp på en hel period syns inte. */
      while (x > bas) { x -= period; x0 -= period; }
      while (x < bas - period) { x += period; x0 += period; }
      handX = x;
      ul.style.transform = pos(x).transform;
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
      fart = 0;
      starta(handX);
      tona();
    };
    rot.addEventListener('pointerup', släpp);
    rot.addEventListener('pointercancel', släpp);
  }

  /* ============================================================
     BILDVÄGGEN
     Varje foto stiger fram när det kommer en bit in i bild, en gång.
     ============================================================ */
  function vägg() {
    if (!rörelse) return;
    $$('.nx-vagg-grid figure').forEach(f =>
      närSyns(f, () => f.classList.add('nx-in'), '0px 0px -12% 0px'));
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
       mot pekaren.

       Transformen skrivs direkt på fönstret, med sitt eget
       perspektiv. Den skrevs förut som CSS-variabler på .sd-rum, och
       en variabel ärvs: varje musrörelse räknade om stilen för vart
       och ett av fönstrets hundratals element. En transform ärvs inte
       — den räknas om för ett element och flyttas på grafikkortet. */
    if (full && mus) {
      let mx = 0, my = 0, tx = 0, ty = 0, raf = 0;
      const steg = () => {
        mx += (tx - mx) * 0.1; my += (ty - my) * 0.1;
        const vila = Math.abs(tx - mx) + Math.abs(ty - my) < 0.001;
        if (vila) { mx = tx; my = ty; }
        fönster.style.transform = (mx || my)
          ? 'perspective(1800px) rotateX(' + (-my * 5).toFixed(3) + 'deg) rotateY(' + (mx * 7).toFixed(3) + 'deg)'
          : '';
        raf = vila ? 0 : requestAnimationFrame(steg);
      };
      rot.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        const r = rot.getBoundingClientRect();
        tx = M.clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5);
        ty = M.clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5);
        if (!raf) raf = requestAnimationFrame(steg);
      });
      rot.addEventListener('pointerleave', () => {
        tx = 0; ty = 0;
        if (!raf) raf = requestAnimationFrame(steg);
      });
    }

    /* ---------- resningen ----------
       Fönstret ligger bakåtlutat och reser sig när det kommer in i
       bild — en transition på .sd-rum, utlöst av en klass. */
    if (rörelse) {
      närSyns(rot, () => {
        rot.classList.add('nx-in');
        const n = $('.sd-flyt[data-sd-notis="rapport"]', rot);
        if (n) setTimeout(() => notis(n), 1300);
      }, '0px 0px -12% 0px');
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
    prova('hållpunkter', hållpunkter);
    prova('studiehjälpare', studiehjälpare);
    prova('band', band);
    prova('vägg', vägg);
    prova('studievy', studievy);
  }

  allt();

  return { allt };
})();
