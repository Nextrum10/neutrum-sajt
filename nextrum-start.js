/* ============================================================
   NEXTRUM — STARTSIDAN

   Rörelsen på startsidan, från manifestet och nedåt. Hero rörs
   inte (Leo 2026-09-25: "jag vill bevara heron").

     ordfyll        rubrikernas ord tonar fram ett i taget
     nexlax         NexLäx under hero: telefonen visar sig själv, och stigen
                    bredvid följer med
     mörkaYtor      Bli studiehjälpare och Nästa steg glider upp
     garantiflöde   betygsgarantin: linjen fylls och stegen tänds när
                    man scrollar förbi, på startsidan och prissidan
     studiehjälpare raden man sveper i: korten kommer in när raden
                    syns, prickarna och pilarna följer svepet
     band           Trygg hjälp: det rullande bandet
     vägg           Så kan ett pass se ut: fotona stiger fram
     betalflöde     Så fungerar betalningen på prissidan: stegen och
                    pilarna tänds i tur
     studievy       illustrationen av föräldravyn, som klickar sig igenom
                    sig själv. Samma illustration står på För elever &
                    föräldrar.
     sidhuvud       lapparna på menysidornas foto fjädrar in
     stegFoton      Så fungerar Nextrum, på startsidan och menysidan:
                    den pinnade scenen på dator och den svepbara
                    raden på pekskärm (2026-10-07)

   MENYSIDORNA LADDAR OCKSÅ FILEN (2026-10-06): Vår idé, Så fungerar
   Nextrum, För elever & föräldrar, Bli studiehjälpare, Priser och
   FAQ, på båda språken. De använder startsidans delar som de är, och
   varje del letar upp sina egna element: en del som inte hittar
   något på en sida gör ingenting där.

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
     NEXLÄX UNDER HERO (2026-10-07)
     Telefonen visar sig själv: vägen, en fråga som rättas, nivån
     klar, och en nivå från studiehjälparen med dagens uppdrag. Stigen
     bredvid tänder sin del, och delarna före den har fyllt sin bit av
     linjen. Högst tre varv varje gång telefonen kommer in i bild; sedan
     står den på vägen, som i markupen.

     Väntan räknas bara medan telefonen syns och fliken är framme, som
     i studievyn, och det som rör sig av sig självt (omloppet,
     svävandet, ringarna) står still när den inte syns (.nlx-paus). Ett
     tryck på en del visar dess skärm, låter den stå en stund och går
     sedan vidare därifrån; varven räknas vidare, så ett tryck efter
     det tredje varvet spelar bara klart det varvet. Under rundturen
     visar en linje under delens blad hur länge skärmen står kvar. Utan
     rörelse (tier still) finns ingen rundtur, men trycket fungerar och
     visar skärmen i sitt slutläge.

     Det är en illustration: inget här rättar, räknar XP eller skriver
     text. Talen står i markupen, och skriptet sätter bara klasser.
     ============================================================ */
  function nexlax() {
    const rot = $('[data-nexlax]');
    if (!rot) return;
    const scen = $('[data-nlx-scen]', rot);
    const lista = $('[data-nlx-delar]', rot);
    const vyer = $$('[data-nlx-vy]', rot);
    const delar = $$('[data-nlx-del]', rot);
    const lappar = $$('[data-nlx-lapp]', rot);
    if (!scen || !vyer.length) return;

    const LÄGEN = ['valt', 'ratt', 'fylld'];
    let nu = 0;

    /* En skärm åt gången. Den som visas nollställs innan den kommer
       fram, inte när den går: då hinner ingen se den byta tillbaka.
       `tid` är hur länge skärmen står i rundturen, för linjen under
       delens blad (--nlx-tid sätts på bladet, där linjen läser den);
       utan tid ingen linje. */
    function sätt(i, tid) {
      const förra = nu;
      nu = i;
      vyer.forEach((v, n) => {
        if (n === i && !v.classList.contains('pa')) v.classList.remove(...LÄGEN);
        v.classList.toggle('ut', n === förra && n !== i);
        v.classList.toggle('pa', n === i);
      });
      delar.forEach((d, n) => {
        d.classList.toggle('pa', n === i);
        d.classList.toggle('forbi', n < i);
        d.classList.remove('nlx-tur');
        const knapp = $('.nlx-del-nod', d);
        if (knapp) { if (n === i) knapp.setAttribute('aria-current', 'true'); else knapp.removeAttribute('aria-current'); }
      });
      lappar.forEach((l, n) => l.classList.toggle('syns', n === i));
      const del = delar[i], blad = del && $('.nlx-del-text', del);
      if (!tid || !blad) return;
      blad.style.setProperty('--nlx-tid', tid + 'ms');
      /* En läsning, så att linjen börjar om också när samma del
         väljs igen: en gång per skärm, aldrig per bildruta. */
      void blad.offsetWidth;
      del.classList.add('nlx-tur');
    }
    const läge = (i, k) => vyer[i] && vyer[i].classList.add(k);

    /* Varje skärm: väntan i ms och det som händer på den. Summan är
       ett varv på ungefär sjutton sekunder. */
    const SKÄRMAR = [
      [3600],
      [1100, () => läge(1, 'valt'), 700, () => läge(1, 'ratt'), 2600],
      [4400],
      [900, () => läge(3, 'fylld'), 3800]
    ];
    const SLUT = [[], ['valt', 'ratt'], [], ['fylld']];
    const VARV = 3;

    if (lista) lista.classList.add('nlx-klick');

    if (!rörelse) {
      sätt(0);
      delar.forEach((d, n) => d.addEventListener('click', () => {
        sätt(n);
        SLUT[n].forEach(k => läge(n, k));
      }));
      return;
    }

    let synlig = false, tur = null, klar = false, varv = 0;
    /* Står rundturen still (utanför bild, dold flik) går ingen timer:
       väntan parkerar sig i tur.vidare, och paus() väcker den när
       telefonen syns igen. Förut tickade den tio gånger i sekunden resten
       av besöket (granskningen 2026-10-07). */
    const paus = () => {
      const stilla = !synlig || document.hidden;
      rot.classList.toggle('nlx-paus', stilla);
      if (!stilla && tur && tur.vidare) {
        const vidare = tur.vidare;
        tur.vidare = null;
        tur.t = setTimeout(vidare, 100);
      }
    };
    paus();

    function vänta(ms, tok) {
      return new Promise(svar => {
        let kvar = ms;
        const tick = () => {
          if (tok.stopp) return svar(false);
          if (!synlig || document.hidden) { tok.vidare = tick; return; }
          kvar -= 100;
          if (kvar <= 0) return svar(true);
          tok.t = setTimeout(tick, 100);
        };
        tick();
      });
    }
    function stoppa() {
      if (!tur) return;
      const vidare = tur.vidare;
      tur.stopp = true;
      tur.vidare = null;
      clearTimeout(tur.t);
      tur = null;
      if (vidare) vidare();   // en parkerad väntan svarar false och släpps
    }

    /* Från skärm `från`, med `extra` ms på den första (efter ett tryck).
       Ett varv räknas när rundturen kommer tillbaka till vägen. */
    async function kör(från, extra) {
      stoppa();
      const tok = tur = { stopp: false };
      let i = från;
      while (!tok.stopp) {
        const steg = SKÄRMAR[i], e = extra;
        extra = 0;
        sätt(i, steg.reduce((sum, s) => typeof s === 'number' ? sum + s : sum, e));
        for (const s of steg) {
          if (tok.stopp) break;
          if (typeof s !== 'number') { s(); continue; }
          if (!(await vänta(s, tok))) break;
        }
        if (tok.stopp) break;
        if (e && !(await vänta(e, tok))) break;
        i = (i + 1) % SKÄRMAR.length;
        if (i === 0 && ++varv >= VARV) { sätt(0); klar = true; break; }
      }
      if (tur === tok) tur = null;
    }

    delar.forEach((d, n) => d.addEventListener('click', () => {
      klar = false;
      kör(n, 6000);
    }));

    närSyns(scen, () => scen.classList.add('nlx-in'), '0px 0px -10% 0px');
    if (lista) närSyns(lista, () => lista.classList.add('nlx-in'), '0px 0px -8% 0px');
    document.addEventListener('visibilitychange', paus);

    /* Första gången reser sig telefonen i en och en halv sekund, så
       vägen får stå lika mycket längre. */
    let först = 1500;
    if (!('IntersectionObserver' in window)) { synlig = true; paus(); kör(0, först); return; }
    new IntersectionObserver(poster => {
      synlig = poster[poster.length - 1].isIntersecting;
      paus();
      /* Tre varv per gång den kommer in i bild. Har den gått klart
         börjar den om först när den varit utanför. */
      if (!synlig) { if (klar && !tur) { klar = false; varv = 0; } return; }
      if (!tur && !klar) { kör(nu, först); först = 0; }
    }, { threshold: 0.35 }).observe(scen);
  }

  /* HÅLLPUNKTERNA och stegen i ansökan har inget skript (2026-10-07).
     Här stod hållpunkter(), som på pekskärm tände kortet mitt i
     skärmen och lät de andra krympa och bli grå. Leo: "slide funktion
     som inte är clean". Korten står nu två och två på telefonen, och
     bara musen får en diskret hovring, i CSS. */

  /* ============================================================
     DE MÖRKA YTORNA
     Bli studiehjälpare och Nästa steg glider upp när de syns. En
     egen klass, .nx-framme, och inte .nx-in: cinemas radmask tänds av
     ".nx-in .nx-rad-i", och en .nx-in på ytan hade visat rubrikens
     rader innan deras egen tur.
     ============================================================ */
  function mörkaYtor() {
    if (!rörelse) return;
    $$('.nx-mork.nx-sek, .nx-mork.nx-final-cinema').forEach(el =>
      närSyns(el, () => el.classList.add('nx-framme'), '0px 0px -6% 0px'));
  }

  /* ============================================================
     STUDIEHJÄLPARNA — raden man sveper i (2026-10-07)
     Korten står i en snäppande rad i alla bredder (Leo: "bredvid
     varandra på mobil så att man swipar som ett inlägg"). Svepet och
     snäppet är webbläsarens egna, scroll-snap i nextrum-start.css;
     här sätts bara klasser.

     INTRÄDET observerar RADEN, inte varje kort. Ett kort utanför
     raden i sidled är osynligt för en IntersectionObserver och hade
     tonat upp först när man svept dit. När raden syns får alla nya
     kort .nx-in, och --n (plats bland de fyra första) gör att de
     kommer ett i taget.

     PRICKARNA OCH PILARNA. En observatör med raden som rot säger hur
     mycket av varje kort som syns, och bara när det korsar en gräns:
     ingen mätning medan man sveper. En prick tänds för varje kort som
     syns till mer än hälften, så plattan, som visar två kort, tänder
     två. Pilarna stängs i radens ändar, och hela navraden döljs när
     alla kort får plats (tre exempelkort på dator). Prickarna är inga
     knappar (som i ett inlägg), och pilarnas etiketter står i markupen.

     scrollBy på raden, aldrig scrollIntoView: det rullar sidan också
     (CLAUDE.md, startsidan efter hero, fälla 3).

     Korten ritas när Supabase svarat, så en MutationObserver fångar
     dem. Navigeringen fungerar också med rörelse bortvald; bara
     inträdet hoppas över.
     ============================================================ */
  function studiehjälpare() {
    const host = $('#showcase');
    if (!host) return;
    const nav = $('[data-sc-nav]');
    const prickar = nav && $('.sc-prickar', nav);
    const pilar = nav ? $$('[data-sc-steg]', nav) : [];
    const andel = new Map();
    let kort = [];
    let io = null;

    const syns = (k, gräns) => (andel.get(k) || 0) >= gräns;

    function läge() {
      if (!kort.length) return;
      const förstHel = syns(kort[0], 0.97);
      const sistHel = syns(kort[kort.length - 1], 0.97);
      nav.hidden = kort.length < 2 || (förstHel && sistHel);
      pilar.forEach(b => {
        b.disabled = Number(b.dataset.scSteg) < 0 ? förstHel : sistHel;
      });
      if (prickar) {
        Array.from(prickar.children).forEach((p, i) =>
          p.classList.toggle('pa', syns(kort[i], 0.55)));
      }
    }

    function nya() {
      const alla = $$('.sc-card', host);
      const nyKort = alla.filter(k => !k.dataset.delad);
      kort = alla;
      if (!alla.length) {
        /* Hämtar, ett fel eller ingen koppling: inget att svepa i. */
        if (io) io.disconnect();
        if (nav) nav.hidden = true;
        return;
      }
      if (!nyKort.length) return;
      nyKort.forEach(k => {
        k.dataset.delad = '1';
        k.style.setProperty('--n', String(Math.min(alla.indexOf(k), 3)));
      });
      /* En ny observatör per sats: dess första svar kommer efter nästa
         bildruta, så startläget hinner ritas innan .nx-in sätts. */
      if (rörelse) närSyns(host, () => nyKort.forEach(k => k.classList.add('nx-in')), '0px 0px -8% 0px');

      if (!nav || !('IntersectionObserver' in window)) return;
      if (prickar) prickar.replaceChildren(...alla.map(() => document.createElement('i')));
      if (io) io.disconnect();
      andel.clear();
      io = new IntersectionObserver(poster => {
        poster.forEach(p => andel.set(p.target, p.intersectionRatio));
        läge();
      }, { root: host, threshold: [0, 0.55, 0.97, 1] });
      alla.forEach(k => io.observe(k));
    }

    /* Ett tryck flyttar så många kort som syns hela, minst ett: med
       nio kort och tre i bild bläddrar man en sida i taget. */
    pilar.forEach(b => b.addEventListener('click', () => {
      if (kort.length < 2) return;
      const steg = kort[1].offsetLeft - kort[0].offsetLeft;
      const hela = Math.max(1, kort.filter(k => syns(k, 0.97)).length);
      host.scrollBy({
        left: Number(b.dataset.scSteg) * hela * steg,
        behavior: M.reducerad ? 'auto' : 'smooth'
      });
    }));

    /* Tabbar man till länken i ett kort som bara syns till en kant
       rullar Chromium inte raden (en del av kortet syns ju), och
       fokus hamnar utanför bild. Raden flyttas då själv till kortet. */
    host.addEventListener('focusin', e => {
      const k = e.target.closest('.sc-card');
      if (!k || !kort.length || syns(k, 0.97)) return;
      host.scrollTo({
        left: k.offsetLeft - kort[0].offsetLeft,
        behavior: M.reducerad ? 'auto' : 'smooth'
      });
    });

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

     Kopiorna är aria-hidden och har egna id:n. En skärmläsare hör
     alltså sex kort, inte arton.

     Bandet stannar under pekaren och när man drar i det. Korten gick
     förut att fälla ut, och bandet stannade då också när ett kort
     var utfällt och när ett kort hade tangentbordsfokus. Utfällningen
     är borttagen (2026-09-27): den klipptes av bandets höjd och
     syntes bara till hälften. Korten är inte knappar längre, så
     inget i bandet tar fokus.
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

    /* Tona farten mot målet. rAF bara under de få bildrutor det tar,
       och det enda som skrivs är playbackRate. */
    function tona() {
      if (rampa) return;
      const steg = () => {
        const mål = (över || drar) ? 0 : 1;
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

    /* --- dra i det ---
       touch-action:pan-y i CSS: webbläsaren behåller den lodräta
       scrollen, och det vågräta kommer hit. Ett drag längre än sex
       pixlar är ett drag, inte ett tryck. */
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
      fart = 0;
      starta(handX);
      tona();
    };
    rot.addEventListener('pointerup', släpp);
    rot.addEventListener('pointercancel', släpp);
  }

  /* ============================================================
     GARANTIFLÖDET (2026-10-07)
     Betygsgarantins fyra steg står som ett flöde på papperet (Leo:
     "se ut som att de följer ett flow när man scrollar"). Ett steg
     tänds när dess siffra har passerat en linje en bit under mitten
     av fönstret, och sträckan ovanför det fylls: skriptet sätter .pa
     (tänt) och .fylld (sträckan nedåt är fylld; på sista steget
     svansen, när alla är tända), och linjen, siffran och texten är
     övergångar i nextrum-start.css (avsnitt 15).
     Scrollar man tillbaka släcks stegen igen.

     Observatören säger till när en siffra korsar linjen, och först då
     läses de fyra siffrornas läge, en gång. Inget mäts medan man
     scrollar. Att läsa alla fyra och inte bara den som korsade gör
     att ett hopp förbi flera steg (länken till #betygsgaranti längre
     ner, End-tangenten) ger rätt läge direkt.

     .i-gang sätts när observatören är kopplad, och startläget hänger
     på den: utan skript, utan IntersectionObserver och med rörelse
     bortvald står flödet tänt. Första läget räknas innan klassen
     sätts, så att ett steg man redan scrollat förbi (omladdning mitt
     på sidan) aldrig syns släckt.

     Egna namn med flit, inte .nx-apply-flow: den är kvar i Bli
     studiehjälpare och sköts av mörkaYtor().
     ============================================================ */
  function garantiflöde() {
    if (!rörelse || !('IntersectionObserver' in window)) return;
    /* Andel av fönstrets höjd, uppifrån. 0,62 lät steg 04, själva
       löftet, stå släckt medan hela sektionen syntes på 1440×900. */
    const LINJE = 0.78;
    $$('[data-gar-flode]').forEach(ol => {
      const steg = $$(':scope > li', ol);
      if (!steg.length) return;
      const nr = steg.map(li => $('.nx-gar-nr', li) || li);
      const rita = gräns => {
        let n = 0;
        while (n < nr.length && nr[n].getBoundingClientRect().top < gräns) n++;
        steg.forEach((li, i) => {
          li.classList.toggle('pa', i < n);
          li.classList.toggle('fylld', i < n - 1 || n === steg.length);
        });
      };
      const io = new IntersectionObserver(poster => {
        const rot = poster[0] && poster[0].rootBounds;
        rita(rot ? rot.bottom : window.innerHeight * LINJE);
      }, { rootMargin: '0px 0px -' + Math.round((1 - LINJE) * 100) + '% 0px' });
      rita(window.innerHeight * LINJE);
      nr.forEach(el => io.observe(el));
      ol.classList.add('i-gang');
    });
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
     BETALFLÖDET PÅ PRISSIDAN (2026-10-07)
     Leo: "Så fungerar betalning gör de ej i kolumner utan pilar mellan
     varje steg modernt och snyggt." Två klasser, och CSS (nextrum-
     sidor.css) väljer vilken som gäller för bredden:
       .ar-igang på listan när den syns: på en dator tänds stegen och
                 pilarna i tur, med en fördröjning per steg.
       .ar-nadd  på varje steg som passerat strax under mitten av
                 skärmen: på en telefon, där stegen står under varandra,
                 tänds numret och skenan ner till nästa steg följer
                 scrollen, åt båda hållen.
     Utan rörelse sätts ingenting, och allt står tänt (inget nx-sr).
     ============================================================ */
  function betalflöde() {
    if (!rörelse) return;
    $$('[data-betalflode]').forEach(ol => {
      närSyns(ol, () => ol.classList.add('ar-igang'), '0px 0px -18% 0px');
      const steg = $$(':scope > li', ol);
      if (!('IntersectionObserver' in window)) {
        steg.forEach(li => li.classList.add('ar-nadd'));
        return;
      }
      const io = new IntersectionObserver(poster => {
        poster.forEach(p => p.target.classList.toggle('ar-nadd',
          p.isIntersecting || p.boundingClientRect.top < 0));
      }, { rootMargin: '0px 0px -42% 0px' });
      steg.forEach(li => io.observe(li));
    });
  }

  /* ============================================================
     STUDIEVYN

     En illustration som visar sig själv. Besökaren kan inte klicka i
     den (Leo 2026-09-25: "du ska inte kunna interagera med den"):
     fönstret är inert i markupen, och för skärmläsare är hela
     illustrationen en bild med en beskrivning.

     Rundturen är en pekare som klickar sig igenom vyn: godkänner en
     tid, föreslår ett pass, svarar i chatten, betalar, klarar en nivå
     i NexLäx. Den går bara när vyn syns, och börjar om efter en paus.
     Klicken är programmatiska — el.click() — och inert stoppar bara
     det en människa gör, så de når fram.

     Allt tillstånd bor i DOM:en som klasser, och allt klick går
     genom EN lyssnare på fönstret. Därför är "börja om" bara att
     byta .sd-app mot en ren kopia av markupen — inga lyssnare att
     koppla om, inget tillstånd att nollställa för hand.
     ============================================================ */
  function studievy() {
    const rot = $('[data-studievy]');
    if (!rot) return;
    const fönster = $('.sd-fonster', rot);
    const pekare = $('.sd-pekare', rot);
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

    function svara(b) {
      const nr = b.dataset.sdSvar;
      const egen = $('.sd-bubbla.sd-sen.egen', app);
      if (egen) egen.textContent = b.textContent.trim();
      händelse('svarat');
      const tråd = $('.sd-trad', app);
      const ner = () => { if (tråd) tråd.scrollTo({ top: tråd.scrollHeight, behavior: rörelse ? 'smooth' : 'auto' }); };
      ner();
      const skriver = $('.sd-skriver.svar', app);
      setTimeout(() => { if (skriver) skriver.classList.add('bytt'); ner(); }, rörelse ? 350 : 0);
      setTimeout(() => {
        if (skriver) skriver.classList.add('klar');
        händelse('svar' + nr);
        ner();
      }, rörelse ? 1200 : 0);
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
      else if ('sdForesla' in d) tänk(b, 500, () => händelse('foreslaget'));
      else if ('sdGodkann' in d) händelse('godkant');
      else if ('sdBetala' in d) tänk(b, 650, () => händelse('betalt'));
      else if ('sdNiva' in d) tänk(b, 800, () => händelse('niva'));
    });

    förbered();
    visa('oversikt');

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

    /* ---------- rundturen ----------
       Ett tal är en paus. Pausen efter ett klick är så lång som det
       klicket sätter igång: bubblorna i chatten, svaret, nivån i
       NexLäx. Kortas en paus under sin animation byter
       pekaren sektion mitt i den. Leo 2026-09-26 ville ha den lite
       snabbare; ett varv tog 47 sekunder och tar nu runt 33. */
    const TUR = [
      1200,
      '[data-sd-godkann]', 600,
      '.sd-sido [data-sd-visa="boka"]',
      '[data-sd-dag="15"]',
      '[data-sd-val="tid"]:nth-child(2)',
      '[data-sd-foresla]', 1100,
      '.sd-sido [data-sd-visa="lektioner"]', 1000,
      '.sd-sido [data-sd-visa="meddelanden"]', 2200,
      '[data-sd-svar="2"]', 2000,
      '.sd-sido [data-sd-visa="betalning"]',
      '[data-sd-betala]', 1400,
      '.sd-sido [data-sd-visa="nexlax"]', 1000,
      '[data-sd-niva]', 2200,
      '.sd-sido [data-sd-visa="oversikt"]'
    ];
    let tur = null, turSynlig = false;

    /* Utanför bild och i en dold flik går ingen timer: väntan parkerar
       sig i tur.vidare och väcks när fönstret syns igen (2026-10-07; förut
       tickade den tio gånger i sekunden resten av besöket). */
    function vänta(ms, tok) {
      return new Promise(klar => {
        let kvar = ms;
        const tick = () => {
          if (tok.stopp) return klar(false);
          if (!turSynlig || document.hidden) { tok.vidare = tick; return; }
          kvar -= 100;
          if (kvar <= 0) return klar(true);
          tok.t = setTimeout(tick, 100);
        };
        tick();
      });
    }
    function väck() {
      if (!tur || !tur.vidare || !turSynlig || document.hidden) return;
      const vidare = tur.vidare;
      tur.vidare = null;
      tur.t = setTimeout(vidare, 100);
    }
    document.addEventListener('visibilitychange', väck);

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
          if (fram(el) && !(await vänta(400, tok))) break;
          const l = läge(el);
          pekare.style.setProperty('--px', l.x.toFixed(1) + 'px');
          pekare.style.setProperty('--py', l.y.toFixed(1) + 'px');
          /* Pekarens transition i CSS är .6s, och vänta() räknar ner i
             steg om 100 ms med det första dragit direkt: 750 är 700 ms,
             så pekaren står still en stund innan den klickar. Ändras
             den ena ändras den andra. */
          if (!(await vänta(750, tok))) break;
          pekare.classList.remove('klick');
          void pekare.offsetWidth;
          pekare.classList.add('klick');
          el.click();
          if (!(await vänta(450, tok))) break;
        }
        if (tok.stopp || !(await vänta(3000, tok))) break;
        nollställ();
        if (!(await vänta(600, tok))) break;
      }
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(e => {
        turSynlig = e[0].isIntersecting;
        väck();
        if (turSynlig && !tur && rörelse) körTur();
      }, { threshold: 0.4 }).observe(fönster);
    }
  }

  /* ============================================================
     MENYSIDORNAS SIDHUVUD
     Lapparna på fotot fjädrar in när sidan laddat, som notiserna i
     studievyn. Sidhuvudet står i vyn från början, så det finns
     ingenting att vänta på — men startläget måste hinna ritas en
     gång, annars hoppar lapparna direkt till sitt slutläge. Därav
     två bildrutor.
     ============================================================ */
  function sidhuvud() {
    if (!rörelse) return;
    const hdr = $$('.nx-page-hero').filter(h => $('.sid-lappar', h));
    if (!hdr.length) return;
    requestAnimationFrame(() => requestAnimationFrame(() =>
      hdr.forEach(h => h.classList.add('sid-framme'))));
  }

  /* ============================================================
     STEGSCENEN — Så fungerar Nextrum (2026-10-07)
     Startsidan och menysidan Så fungerar Nextrum, på båda språken.
     Formen står i cinema (grunden) och i nextrum-start.css, avsnitt
     14. Här sätts klasser: .pa på steget, fotot och märket som
     gäller, .forbi på det som passerats, .tyst på de foton som ett
     hopp över flera steg passerar, aria-current på stapeln, och
     .igang på sektionen när allt är kopplat. Först då slår CSS:en om
     till den pinnade scenen eller den svepbara raden.

     Leo 2026-10-07: "Från intresseanmälan till första passet ska ha
     bättre animation mellan bilderna på datorvy och mobil ska även få
     den animation. Stegen ska visas bredvid bilderna. 01 osv ska vara
     större. Och svepningen ska fungera på mobilen."

     FOTONA. På menysidan står de i markupen. På startsidan byggs de
     här ur bildregistret, ett per steg (data-bild), och alt-texten
     läses ur stegets data-alt: registret har bara svenska, och en
     bild som byggs här hade annars fått en svensk beskrivning på den
     engelska sidan. Förut byggde startsidan fotona i ett eget skript
     med svensk alt och en egen kopia av scenen (2026-10-07).

     LÄGET LÄSES VID VARJE HÄNDELSE. M.tier byts när fönstret ändrar
     storlek (räknaTier i nextrum-motion.js), och CSS:en följer med
     direkt. Ett läge som lästes en gång vid laddningen hade lämnat
     skriptet i fel läge när en dator dras smalare än 900 px.

       full  den pinnade scenen. NXMotion.scene räknar ut steget ur
             scrollen; ett tryck på ett steg för scrollen dit.
       lite  den svepbara raden. En IntersectionObserver med raden som
             rot säger vilket kort som täcker mer än 60 % av den
             (intersectionRatio, inte isIntersecting: den är sann också
             när ett kort är på väg ut). Staplarna och ett tryck på ett
             kort rullar raden med scrollTo, aldrig scrollIntoView, som
             också rullar sidan.

     Med reducerad rörelse kopplas inget: scenen står i sin grund med
     alla steg öppna och det första fotot.
     ============================================================ */
  function stegFoton() {
    /* Fotot är 16:9 och visas i en ruta som är högre än bred, så det
       ritas mycket bredare än rutan: på telefonen nästan dubbelt så
       brett som skärmen, på dator ungefär lika brett som fönstret. */
    const STORLEK = '(max-width: 900px) 180vw, 100vw';
    const mjukt = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

    $$('[data-hur]').forEach(rot => {
      const bild = $('.nx-hur-bild', rot), lista = $('.nx-hur-steg', rot);
      const steg = lista ? $$(':scope > li', lista) : [];
      if (!bild || !steg.length) return;

      if (!$('.nx-fig', bild) && typeof NXImg !== 'undefined') {
        bild.innerHTML = steg.map(li =>
          (li.dataset.bild && NXImg.platta(li.dataset.bild, { sizes: STORLEK })) || '<figure class="nx-fig"></figure>'
        ).join('');
        $$(':scope > .nx-fig', bild).forEach((f, n) => {
          const img = $('img', f);
          if (img && steg[n].dataset.alt) img.alt = steg[n].dataset.alt;
        });
        if (typeof NX !== 'undefined' && NX.bildIntoning) NX.bildIntoning(bild);
      }
      const fig = $$(':scope > .nx-fig', bild);
      if (!fig.length) return;

      /* Märket på fotot: stegets nummer och namn, kopierat ur steget,
         som redan står på sidans språk. Det syns bara i den pinnade
         scenen och är aria-hidden: steget läses redan i listan. */
      fig.forEach((f, n) => {
        const li = steg[n];
        if (!li || $('.nx-hur-mark', f)) return;
        const tal = $('em', li), namn = $('h3', li);
        if (!tal || !namn) return;
        const m = document.createElement('span');
        m.className = 'nx-hur-mark';
        m.setAttribute('aria-hidden', 'true');
        const b = document.createElement('b'), s = document.createElement('span');
        b.textContent = tal.textContent.trim();
        s.textContent = namn.textContent.trim();
        m.append(b, s);
        f.appendChild(m);
      });

      const prickar = $$('.nx-hur-prickar button', rot);
      let nu = -1, nuFoto = -1;
      const sätt = i => {
        i = Math.max(0, Math.min(steg.length - 1, i));
        if (i === nu) return;
        nu = i;
        const k = Math.min(i, fig.length - 1), förra = nuFoto;
        nuFoto = k;
        steg.forEach((li, n) => { li.classList.toggle('pa', n === i); li.classList.toggle('forbi', n < i); });
        /* Hoppar man över steg (en stapel långt bort, en snabb scroll)
           byter fotona emellan läge utan att glida: .tyst. Annars far
           de genom ramen bredvid det nya och det blir ett bläddrande
           i stället för ett byte. Bara det gamla och det nya rör sig. */
        fig.forEach((f, n) => {
          f.classList.toggle('tyst', n !== k && n !== förra);
          f.classList.toggle('pa', n === k);
          f.classList.toggle('forbi', n < k);
        });
        prickar.forEach((b, n) => {
          if (n === i) b.setAttribute('aria-current', 'step');
          else b.removeAttribute('aria-current');
        });
      };
      sätt(Math.max(0, steg.findIndex(li => li.classList.contains('pa'))));
      if (!rörelse) return;

      /* Före scenen: NXMotion.scene mäter sektionen när den skapas,
         och höjden (230svh) kommer med klassen. */
      rot.classList.add('igang');

      const kortLäge = i => steg[i].offsetLeft - steg[0].offsetLeft;
      const gåTill = i => lista.scrollTo({ left: kortLäge(i), behavior: mjukt() });

      M.scene(rot, {
        läge: 'pin',
        run: p => {
          if (M.tier !== 'full') return;
          /* Lite marginal i början och slutet, så att första och
             sista steget hinner läsas innan det byter. */
          sätt(Math.floor(M.span(p, 0.04, 0.96) * steg.length));
        }
      });

      steg.forEach((li, i) => li.addEventListener('click', () => {
        if (M.tier === 'full') {
          /* Till mitten av stegets bit av sträckan, samma räkning som
             run() ovan baklänges. */
          const r = rot.getBoundingClientRect();
          const sträcka = r.height - document.documentElement.clientHeight;
          if (sträcka > 0) {
            window.scrollTo({ top: r.top + window.scrollY + (0.04 + (i + 0.5) / steg.length * 0.92) * sträcka, behavior: mjukt() });
          }
        } else if (M.tier === 'lite' && i !== nu) {
          gåTill(i);
        }
      }));
      prickar.forEach((b, i) => b.addEventListener('click', () => gåTill(i)));

      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(poster => {
          if (M.tier !== 'lite') return;
          poster.forEach(p => { if (p.intersectionRatio >= 0.6) sätt(steg.indexOf(p.target)); });
        }, { root: lista, threshold: [0.6] });
        steg.forEach(li => io.observe(li));
      }

      /* Byts läget till raden (en dator som dras smal) står den på
         första kortet medan steget kan vara ett annat. Rulla dit, så
         att kortet och fotot är samma. NXMotion byter läget efter
         120 ms, så det här väntar längre. */
      let förra = M.tier, väntar = 0;
      window.addEventListener('resize', () => {
        clearTimeout(väntar);
        väntar = setTimeout(() => {
          if (M.tier === förra) return;
          förra = M.tier;
          if (M.tier === 'lite' && nu > 0) lista.scrollTo({ left: kortLäge(nu), behavior: 'auto' });
        }, 260);
      }, { passive: true });
    });
  }

  function allt() {
    if (rörelse) document.documentElement.classList.add('nx-sr');
    prova('ordfyll', ordfyll);
    prova('nexlax', nexlax);
    prova('mörkaYtor', mörkaYtor);
    prova('garantiflöde', garantiflöde);
    prova('studiehjälpare', studiehjälpare);
    prova('band', band);
    prova('vägg', vägg);
    prova('betalflöde', betalflöde);
    prova('studievy', studievy);
    prova('sidhuvud', sidhuvud);
    prova('stegFoton', stegFoton);
  }

  allt();

  return { allt };
})();
