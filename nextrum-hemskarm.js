/* ============================================================
   NEXTRUM — studievyn på hemskärmen (2026-10-27)

   Leo: "de ska även finnas en liten plop up sektion på sidan där de står
   lägg stuidevyn på din hemskärm som app, där ska de också användas
   motion grapich ... Denna sak slutar ploppa upp när kunden tryckt x på
   den, och försvinner helt och denna info finns istället på
   inställningar på studievyn samma navigation ska göras på
   studiehjälparvyn". Han skickade en skärminspelning av hur det går till
   i Safari på en iPhone: tre punkter, Dela, Lägg till på hemskärmen,
   Öppna som webbapp, Lägg till.

   NXHemskarm gör tre saker, i studievyn och studiehjälparvyn:
     ruta(roll)       den lilla rutan i hörnet på en telefon, efter en
                      stund, tills man tryckt på krysset. Krysset sparas i
                      webbläsaren (nx.hemskarm, lagring.html): installationen
                      hör till enheten, inte till kontot.
     profil(host)     samma guide under Profil & inställningar, alltid.
     scen(plattform)  telefonen som visar stegen. Ritad i HTML och CSS,
                      aldrig inspelningen: den visar Leos telefon, med hans
                      kontakter och bakgrund.

   Skriptet sätter klasser, CSS rör sig (CLAUDE.md avsnitt 3): scenen har
   ett steg i taget i data-steg, och telefonens lager, fingret och
   raden i listan följer med i CSS. Den går bara medan den syns och
   fliken är framme, och står still med rörelse bortvald: då går stegen
   att trycka fram i listan.

   Står vyn redan som app (display-mode: standalone) visas ingen ruta,
   och profilen säger det. Ingen text i markupen: allt står här, och
   vyerna har bara en tom värd.
   ============================================================ */
(function () {
  'use strict';

  var NYCKEL = 'nx.hemskarm';
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  function läs() { try { return localStorage.getItem(NYCKEL); } catch (e) { return null; } }
  function spara(v) { try { localStorage.setItem(NYCKEL, v); } catch (e) { /* ingen lagring: rutan kommer igen */ } }

  function somApp() {
    try {
      return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    } catch (e) { return false; }
  }
  function plattform() {
    var ua = String(navigator.userAgent || '');
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    return null;
  }
  function telefon() {
    try { return !!(window.matchMedia && matchMedia('(pointer: coarse)').matches) || !!plattform(); } catch (e) { return false; }
  }
  function lugnt() {
    try { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  /* ---------- stegen ----------
     Samma ord som telefonen själv använder, på svenska. iPhone efter iOS
     26 (Leos inspelning); en äldre iPhone har Dela direkt i verktygsraden,
     och första steget säger det. */
  var STEG = {
    ios: [
      { rubrik: 'Tryck på ··· i Safari', text: 'Knappen med tre punkter står längst ned. På en äldre iPhone trycker du direkt på Dela (fyrkanten med en pil uppåt).' },
      { rubrik: 'Tryck på Dela', text: 'Överst i menyn som öppnas.' },
      { rubrik: 'Välj Lägg till på hemskärmen', text: 'Längre ned i listan. Ser du den inte, tryck på Visa mer.' },
      { rubrik: 'Tryck Lägg till', text: 'Låt Öppna som webbapp stå på, så öppnas vyn utan adressfältet.' },
      { rubrik: 'Klart', text: 'Nextrum ligger på hemskärmen. Logga in en gång till i appen, sedan är du kvar.' }
    ],
    android: [
      { rubrik: 'Tryck på ⋮ i Chrome', text: 'De tre prickarna uppe till höger.' },
      { rubrik: 'Välj Lägg till på startskärmen', text: 'Ibland heter det Installera app.' },
      { rubrik: 'Tryck Lägg till', text: 'Eller Installera, i rutan som kommer upp.' },
      { rubrik: 'Klart', text: 'Nextrum ligger på startskärmen. Logga in en gång till i appen, sedan är du kvar.' }
    ]
  };
  /* Hur länge varje steg står, i millisekunder. Det sista står längst:
     det är beskedet. */
  var TID = { ios: [2300, 2100, 2600, 2400, 3200], android: [2300, 2600, 2400, 3200] };

  var IKON = {
    prickar: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/></svg>',
    lodrata: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5.5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="18.5" r="1.6"/></svg>',
    dela: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v11M8 7.5l4-4 4 4"/><path d="M7 11H5.5v9.5h13V11H17"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/></svg>',
    bok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5h12v15l-6-4-6 4z"/></svg>',
    kopiera: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="12" rx="2"/><path d="M5 15V5.5A1.5 1.5 0 0 1 6.5 4H15"/></svg>',
    sok: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></svg>',
    kryss: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
    telefon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></svg>'
  };

  /* Märket som ikon, som apple-touch-icon.png: papperet och N-märket. */
  function appIkon(klass) {
    return '<span class="hs-app ' + (klass || '') + '"><img src="/apple-touch-icon.png" alt="" width="60" height="60" decoding="async"></span>';
  }

  /* Sidan bakom menyerna: en studievy i miniatyr. */
  function sida(p) {
    return '<div class="hs-lager hs-sida">'
      + (p === 'android' ? '<div class="hs-chrome"><span class="hs-url">nextrum.se/foralder</span><span class="hs-knapp hs-k-meny">' + IKON.lodrata + '</span></div>' : '')
      + '<div class="hs-vy">'
      + '<div class="hs-vy-topp"><span class="hs-vy-logga"></span><span class="hs-vy-burger"></span></div>'
      + '<div class="hs-vy-hero"><i></i><b></b><b class="kort"></b></div>'
      + '<div class="hs-vy-kort"><i></i><span></span></div>'
      + '<div class="hs-vy-kort"><i class="gron"></i><span></span></div>'
      + '<div class="hs-vy-kort"><i class="gul"></i><span></span></div>'
      + '</div>'
      + (p === 'ios' ? '<div class="hs-safari"><span class="hs-knapp">‹</span><span class="hs-url">nextrum.se</span><span class="hs-knapp hs-k-meny">' + IKON.prickar + '</span></div>' : '')
      + '</div>';
  }

  function scen(p) {
    p = STEG[p] ? p : 'ios';
    var ios = p === 'ios';
    var lager = ios
      ? '<div class="hs-lager hs-meny"><div class="hs-meny-box">'
        + '<span class="hs-rad hs-k-dela">' + IKON.dela + 'Dela</span>'
        + '<span class="hs-rad">' + IKON.bok + 'Lägg till i Bokmärken</span>'
        + '<span class="hs-rad">' + IKON.sok + 'Sök på sidan</span></div></div>'
        + '<div class="hs-lager hs-dela"><div class="hs-ark">'
        + '<div class="hs-ark-topp">' + appIkon('liten') + '<span><b>Studievy</b><small>nextrum.se</small></span></div>'
        + '<div class="hs-ark-ikoner"><i></i><i></i><i></i><i></i></div>'
        + '<span class="hs-rad">' + IKON.kopiera + 'Kopiera</span>'
        + '<span class="hs-rad">' + IKON.bok + 'Lägg till bokmärke</span>'
        + '<span class="hs-rad hs-k-hem">' + IKON.plus + 'Lägg till på hemskärmen</span>'
        + '</div></div>'
        + '<div class="hs-lager hs-lagg"><div class="hs-lagg-box">'
        + '<div class="hs-lagg-topp"><span>' + IKON.kryss + '</span><b>Lägg till på hemskärmen</b><span class="hs-k-lagg">Lägg till</span></div>'
        + '<div class="hs-lagg-namn">' + appIkon('liten') + '<span><b>Studievy</b><small>nextrum.se/foralder</small></span></div>'
        + '<div class="hs-lagg-val"><span>Öppna som webbapp</span><i class="hs-reglage"></i></div>'
        + '</div></div>'
      : '<div class="hs-lager hs-meny hs-meny-a"><div class="hs-meny-box">'
        + '<span class="hs-rad">Ny flik</span>'
        + '<span class="hs-rad">Bokmärken</span>'
        + '<span class="hs-rad hs-k-hem">' + IKON.telefon + 'Lägg till på startskärmen</span>'
        + '<span class="hs-rad">Dela…</span></div></div>'
        + '<div class="hs-lager hs-lagg hs-lagg-a"><div class="hs-dialog">'
        + '<b>Lägg till på startskärmen</b>'
        + '<div class="hs-lagg-namn">' + appIkon('liten') + '<span><b>Studievy</b></span></div>'
        + '<div class="hs-dialog-knappar"><span>Avbryt</span><span class="hs-k-lagg">Lägg till</span></div>'
        + '</div></div>';
    var hem = '<div class="hs-lager hs-hem"><div class="hs-hem-grid">'
      + '<i></i><i></i><i></i><i></i><i></i><i></i><i></i>'
      + '<span class="hs-hem-ny">' + appIkon('stor') + '<small>Studievy</small></span>'
      + '</div></div>';
    return '<div class="hs-scen" data-p="' + p + '" data-steg="0" aria-hidden="true">'
      + '<div class="hs-telefon"><div class="hs-skarm">'
      + sida(p) + lager + hem
      + '<span class="hs-finger"></span>'
      + '</div></div></div>';
  }

  function stegLista(p) {
    return '<ol class="hs-steg">' + STEG[p].map(function (s, i) {
      return '<li data-hs-steg="' + i + '"><button type="button" class="hs-steg-knapp" data-hs-ga="' + i + '">'
        + '<span class="hs-steg-nr">' + (i + 1) + '</span><span><b>' + esc(s.rubrik) + '</b><small>' + esc(s.text) + '</small></span>'
        + '</button></li>';
    }).join('') + '</ol>';
  }

  /* ---------- spelaren ----------
     En scen går i en slinga medan den syns. Ett tryck i listan hoppar
     till det steget och står kvar där en stund. */
  var spelare = [];
  function spela(rot) {
    var scenEl = rot.querySelector('.hs-scen');
    if (!scenEl) return;
    /* En ny scen i samma värd (en annan flik) tar över: den gamla tystnar. */
    if (rot._hs) clearTimeout(rot._hs.timer);
    var p = scenEl.getAttribute('data-p');
    var tider = TID[p] || TID.ios;
    var s = { rot: rot, scen: scenEl, p: p, nu: 0, timer: null, synlig: false, håll: 0 };
    rot._hs = s;
    function sätt(i) {
      s.nu = i;
      scenEl.setAttribute('data-steg', String(i));
      rot.querySelectorAll('[data-hs-steg]').forEach(function (li) {
        li.classList.toggle('nu', Number(li.getAttribute('data-hs-steg')) === i);
      });
    }
    function nästa() {
      clearTimeout(s.timer);
      if (!s.synlig || document.hidden || lugnt() || !scenEl.isConnected || rot._hs !== s) return;
      var vänta = tider[s.nu] + s.håll;
      s.håll = 0;
      s.timer = setTimeout(function () { sätt((s.nu + 1) % tider.length); nästa(); }, vänta);
    }
    s.sätt = sätt;
    s.nästa = nästa;
    sätt(lugnt() ? tider.length - 1 : 0);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (poster) {
        s.synlig = poster.some(function (x) { return x.isIntersecting; });
        if (s.synlig) nästa(); else clearTimeout(s.timer);
      }).observe(scenEl);
    } else { s.synlig = true; nästa(); }
    if (!rot._hsLyssnar) {
      rot._hsLyssnar = true;
      rot.addEventListener('click', function (e) {
        var k = e.target.closest('[data-hs-ga]');
        var nu = rot._hs;
        if (!k || !nu) return;
        nu.sätt(Number(k.getAttribute('data-hs-ga')));
        nu.håll = 3000;
        nu.nästa();
      });
    }
    spelare.push(s);
  }
  document.addEventListener('visibilitychange', function () {
    spelare = spelare.filter(function (s) { return s.scen.isConnected && s.rot._hs === s; });
    spelare.forEach(function (s) { if (!document.hidden) s.nästa(); else clearTimeout(s.timer); });
  });

  /* Guiden: flikar för iPhone och Android, scenen och stegen. */
  function guide(förval) {
    var p = förval || plattform() || 'ios';
    return '<div class="hs-guide" data-hs-p="' + p + '">'
      + '<div class="hs-flikar" role="tablist" aria-label="Telefon">'
      + ['ios', 'android'].map(function (x) {
          return '<button type="button" role="tab" class="hs-flik" data-hs-flik="' + x + '" aria-selected="' + (x === p ? 'true' : 'false') + '">'
            + (x === 'ios' ? 'iPhone' : 'Android') + '</button>';
        }).join('')
      + '</div>'
      + '<div class="hs-guide-kropp">' + scen(p) + stegLista(p) + '</div>'
      + '</div>';
  }
  function bytFlik(rot, p) {
    var g = rot.querySelector('.hs-guide');
    if (!g || g.getAttribute('data-hs-p') === p) return;
    g.setAttribute('data-hs-p', p);
    g.querySelectorAll('[data-hs-flik]').forEach(function (k) {
      k.setAttribute('aria-selected', k.getAttribute('data-hs-flik') === p ? 'true' : 'false');
    });
    var kropp = g.querySelector('.hs-guide-kropp');
    kropp.innerHTML = scen(p) + stegLista(p);
    spela(g);
  }

  /* ---------- under Profil & inställningar ---------- */
  function profil(host, roll) {
    if (!host) return;
    var vad = roll === 'studiehjalpare' ? 'studiehjälparvyn' : 'studievyn';
    host.innerHTML = somApp()
      ? '<p class="hs-redan">' + IKON.telefon + '<span>Du har redan ' + esc(vad) + ' som app på den här telefonen.</span></p>'
      : '<p class="hs-ingress">Lägg ' + esc(vad) + ' på hemskärmen, så öppnar du den med ett tryck, som en app och utan adressfältet. '
        + 'Det är samma vy, och du loggar in en gång till i appen första gången.</p>' + guide();
    var g = host.querySelector('.hs-guide');
    if (g) spela(g);
    if (!host.dataset.hsLyssnar) {
      host.dataset.hsLyssnar = '1';
      host.addEventListener('click', function (e) {
        var f = e.target.closest('[data-hs-flik]');
        if (f) bytFlik(host, f.getAttribute('data-hs-flik'));
      });
    }
  }

  /* ---------- rutan i hörnet ----------
     På en telefon, inte som app, inte efter krysset, och inte medan en
     annan ruta står öppen (introduktionen, villkoren, notiserna): den
     väntar tills de är stängda. Visa hur öppnar hela guiden. */
  var visad = false;
  function annanRuta() {
    return !!document.querySelector('.nx-fraga, .nx-notisruta, .upg-spel.open, .nx-intro');
  }
  function ruta(roll) {
    if (visad || läs() === 'stangd' || somApp() || !telefon()) return;
    visad = true;
    var försök = 0;
    (function vänta() {
      if (annanRuta() || document.hidden) {
        if (++försök < 120) setTimeout(vänta, 2500);
        return;
      }
      visaRuta(roll);
    })();
  }

  function visaRuta(roll) {
    var p = plattform() || 'ios';
    var vad = roll === 'studiehjalpare' ? 'studiehjälparvyn' : 'studievyn';
    var r = document.createElement('aside');
    r.className = 'hs-ruta';
    r.setAttribute('aria-label', 'Lägg ' + vad + ' på hemskärmen');
    r.innerHTML = '<div class="hs-ruta-mini">' + scen(p) + '</div>'
      + '<div class="hs-ruta-text"><b>Lägg ' + esc(vad) + ' på hemskärmen</b>'
      + '<span>Öppna den med ett tryck, som en app.</span>'
      + '<button type="button" class="hs-ruta-visa" data-hs-visa>Visa hur</button></div>'
      + '<button type="button" class="hs-ruta-stang" data-hs-stang aria-label="Stäng, och visa inte igen">' + IKON.kryss + '</button>';
    document.body.appendChild(r);
    spela(r);
    void r.offsetWidth;
    r.classList.add('open');
    r.addEventListener('click', function (e) {
      if (e.target.closest('[data-hs-stang]')) {
        /* Krysset är för gott (Leo): guiden finns kvar under Profil. */
        spara('stangd');
        r.classList.remove('open');
        r.classList.add('stanger');
        setTimeout(function () { r.remove(); }, 400);
        return;
      }
      if (e.target.closest('[data-hs-visa]')) öppnaGuide(roll);
    });
  }

  /* Hela guiden i en ruta, som bekräftelserna i vyerna (.nx-fraga). */
  function öppnaGuide(roll) {
    var vad = roll === 'studiehjalpare' ? 'studiehjälparvyn' : 'studievyn';
    var fokus = document.activeElement;
    var ruta = document.createElement('div');
    ruta.className = 'nx-fraga hs-guide-ruta';
    ruta.innerHTML = '<div class="nx-fraga-box" role="dialog" aria-modal="true" aria-labelledby="hs-guide-t">'
      + '<h3 id="hs-guide-t">Lägg ' + esc(vad) + ' på hemskärmen</h3>'
      + '<p class="hs-ingress">Så öppnar du den med ett tryck, som en app. Guiden finns också under Profil &amp; inställningar.</p>'
      + guide()
      + '<div class="nx-fraga-knappar"><button type="button" class="btn btn-primary" data-hs-klar>Klar</button></div>'
      + '</div>';
    function stäng() {
      document.removeEventListener('keydown', tangent);
      ruta.remove();
      document.body.style.overflow = '';
      if (fokus && fokus.focus && document.contains(fokus)) fokus.focus({ preventScroll: true });
    }
    function tangent(e) { if (e.key === 'Escape') stäng(); }
    ruta.addEventListener('click', function (e) {
      if (e.target === ruta || e.target.closest('[data-hs-klar]')) { stäng(); return; }
      var f = e.target.closest('[data-hs-flik]');
      if (f) bytFlik(ruta, f.getAttribute('data-hs-flik'));
    });
    document.addEventListener('keydown', tangent);
    document.body.appendChild(ruta);
    document.body.style.overflow = 'hidden';
    spela(ruta.querySelector('.hs-guide'));
    void ruta.offsetWidth;
    ruta.classList.add('open');
    var k = ruta.querySelector('[data-hs-klar]');
    if (k) k.focus({ preventScroll: true });
  }

  window.NXHemskarm = { ruta: ruta, profil: profil, scen: scen, guide: guide, spela: spela, somApp: somApp, STEG: STEG };
})();
