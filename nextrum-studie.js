/* ============================================================
   NEXTRUM — studiearbetet
   Delas av foralder.html och larare.html. Här ligger det som båda
   vyerna behöver se likadant: läxornas lägen, kunskapsnivåerna,
   bekräftelserutan och de små tillstånden (laddar, klart, fel).

   Kräver nextrum-app.js (NX). Ingen egen databaskoppling — varje vy
   äger sina frågor, det här är bara språket de talar.
   ============================================================ */
window.NXStudie = (function () {
  'use strict';

  var esc = NX.esc, datumText = NX.datumText, isoFor = NX.isoFor;

  /* ---------- läxans lägen ----------
     'forsenad' finns inte i databasen, den räknas fram ur deadline.
     Se kommentaren i schema-v5.sql om varför. */
  var LAGE = {
    ej_paborjad: { text: 'Ej påbörjad', klass: 'ej' },
    pagaende:    { text: 'Pågående',    klass: 'pa' },
    klar:        { text: 'Klar',        klass: 'klar' },
    forsenad:    { text: 'Försenad',    klass: 'sen' }
  };

  function läxläge(h) {
    if (h.status === 'klar') return 'klar';
    if (h.due_date && h.due_date < isoFor(new Date())) return 'forsenad';
    return h.status;
  }

  /* Deadline i ord. "Imorgon" säger mer än ett datum när det är
     imorgon det gäller. */
  function deadlineText(iso) {
    if (!iso) return '';
    var idag = isoFor(new Date());
    var imorgon = new Date(); imorgon.setDate(imorgon.getDate() + 1);
    if (iso === idag) return 'Idag';
    if (iso === isoFor(imorgon)) return 'Imorgon';
    if (iso < idag) {
      var dagar = Math.round((new Date(idag) - new Date(iso)) / 86400000);
      return dagar === 1 ? 'Igår' : datumText(iso);
    }
    return datumText(iso);
  }

  /* ---------- kunskapsnivåerna ---------- */
  var NIVA = {
    behover_trana: { text: 'Behöver träna', steg: 1 },
    pa_god_vag:    { text: 'På god väg',    steg: 2 },
    bra:           { text: 'Bra',           steg: 3 }
  };

  /* Tre segment i stället för en siffra: utvecklingen ska gå att
     läsa på en halv sekund, och kännas som rörelse framåt. */
  function nivåMätare(niva) {
    var n = NIVA[niva] || NIVA.behover_trana;
    var ut = '<span class="niva" role="img" aria-label="' + esc(n.text) + '">';
    for (var i = 1; i <= 3; i++) {
      ut += '<i class="' + (i <= n.steg ? 'fylld' : '') + '"></i>';
    }
    return ut + '</span>';
  }

  /* ---------- en läxrad ----------
     atgarder() får läxan och returnerar knapparnas HTML, så att
     familjen och studiehjälparen kan ha olika. */
  function läxRad(h, opts) {
    var o = opts || {};
    var l = LAGE[läxläge(h)];
    var sen = läxläge(h) === 'forsenad';

    return '<div class="lax' + (h.status === 'klar' ? ' avklarad' : '') + '">'
      + '<div class="lax-topp">'
      + '<b>' + esc(h.title) + '</b>'
      + '<span class="lage ' + l.klass + '">' + esc(l.text) + '</span>'
      + '</div>'
      + '<div class="lax-meta">'
      + (h.subject ? '<span class="tag">' + esc(h.subject) + '</span>' : '')
      + (h.due_date
          ? '<span class="lax-datum' + (sen ? ' sen' : '') + '">Till ' + esc(deadlineText(h.due_date)) + '</span>'
          : '')
      + '</div>'
      + (h.instructions ? '<p class="lax-text">' + esc(h.instructions) + '</p>' : '')
      + (o.atgarder ? '<div class="lax-atg">' + o.atgarder + '</div>' : '')
      + '</div>';
  }

  /* ---------- ett kunskapsområde ---------- */
  function progressRad(p, opts) {
    var o = opts || {};
    return '<div class="prg">'
      + '<div class="prg-topp"><b>' + esc(p.area) + '</b>' + nivåMätare(p.level) + '</div>'
      + '<span class="prg-niva">' + esc((NIVA[p.level] || {}).text || p.level) + '</span>'
      + (p.comment ? '<p class="prg-kommentar">' + esc(p.comment) + '</p>' : '')
      + (o.atgarder ? '<div class="prg-atg">' + o.atgarder + '</div>' : '')
      + '</div>';
  }

  /* Kunskapsområdena grupperade per ämne — annars blir det en lista
     där matte och engelska ligger huller om buller. */
  function progressPerÄmne(rader, opts) {
    if (!rader.length) return '';
    var ämnen = {};
    rader.forEach(function (p) { (ämnen[p.subject] = ämnen[p.subject] || []).push(p); });
    return Object.keys(ämnen).sort().map(function (ämne) {
      return '<div class="prg-grupp">'
        + '<h6>' + esc(ämne) + '</h6>'
        + ämnen[ämne].map(function (p) { return progressRad(p, opts); }).join('')
        + '</div>';
    }).join('');
  }

  /* ---------- tomma lägen ----------
     Ett tomt läge ska säga vad som händer härnäst, inte bara att
     det är tomt. */
  function tomt(rubrik, text) {
    return '<div class="empty"><b>' + esc(rubrik) + '</b>'
      + (text ? '<br><span>' + esc(text) + '</span>' : '') + '</div>';
  }

  function laddar(text) {
    return '<div class="loading">' + esc(text || 'Hämtar') + '</div>';
  }

  /* ---------- bekräftelse ----------
     Egen ruta i stället för confirm(): den går att skriva på svenska,
     den ser ut som resten av sajten, och den kan säga vad som faktiskt
     försvinner. Returnerar ett löfte som blir true eller false. */
  function bekräfta(opts) {
    var o = opts || {};
    return new Promise(function (klar) {
      var ruta = document.createElement('div');
      ruta.className = 'nx-fraga';
      ruta.innerHTML =
        '<div class="nx-fraga-box" role="alertdialog" aria-modal="true" aria-labelledby="fraga-t">'
        + '<h3 id="fraga-t">' + esc(o.titel || 'Är du säker?') + '</h3>'
        + (o.text ? '<p>' + esc(o.text) + '</p>' : '')
        + '<div class="nx-fraga-knappar">'
        + '<button type="button" class="btn btn-ghost" data-svar="nej">' + esc(o.avbryt || 'Avbryt') + '</button>'
        + '<button type="button" class="btn btn-primary" data-svar="ja">' + esc(o.knapp || 'Ta bort') + '</button>'
        + '</div></div>';

      var sistaFokus = document.activeElement;
      function stäng(svar) {
        ruta.remove();
        document.body.style.overflow = '';
        document.removeEventListener('keydown', tangent);
        if (sistaFokus && sistaFokus.focus) sistaFokus.focus();
        klar(svar);
      }
      function tangent(e) {
        if (e.key === 'Escape') stäng(false);
        if (e.key === 'Tab') {
          var kan = ruta.querySelectorAll('button');
          var f = kan[0], s = kan[kan.length - 1];
          if (e.shiftKey && document.activeElement === f) { e.preventDefault(); s.focus(); }
          else if (!e.shiftKey && document.activeElement === s) { e.preventDefault(); f.focus(); }
        }
      }

      ruta.addEventListener('click', function (e) {
        if (e.target === ruta) return stäng(false);
        var k = e.target.closest('[data-svar]');
        if (k) stäng(k.dataset.svar === 'ja');
      });
      document.addEventListener('keydown', tangent);

      document.body.appendChild(ruta);
      document.body.style.overflow = 'hidden';
      void ruta.offsetWidth;
      ruta.classList.add('open');
      ruta.querySelector('[data-svar="nej"]').focus();
    });
  }

  /* ---------- knapp som håller på ----------
     Låser knappen, byter texten, och släpper igen när det är klart —
     även om det gick fel. Utan det andra argumentet står den kvar
     låst för alltid när något kastar. */
  async function medan(knapp, text, jobb) {
    if (!knapp) return jobb();
    var original = knapp.textContent;
    knapp.setAttribute('aria-busy', 'true');
    knapp.textContent = text;
    try {
      return await jobb();
    } finally {
      knapp.removeAttribute('aria-busy');
      knapp.textContent = original;
    }
  }

  /* ---------- validering ----------
     Meddelandena står på svenska och pekar på fältet, aldrig på
     databasen. "Error 422" säger ingenting till en förälder. */
  function kolla(regler) {
    for (var i = 0; i < regler.length; i++) {
      var r = regler[i];
      if (r.fel) {
        if (r.falt && r.falt.focus) r.falt.focus();
        return r.text;
      }
    }
    return null;
  }

  /* ============================================================
     FLYTTA ETT PASS
     Samma ruta som bekräftelsen, men med ett datum och en tid i.
     Tiderna räknas fram ur studiehjälparens tillgänglighet, precis
     som i kalendern — man ska inte kunna flytta ett pass till en
     tid som inte gick att boka från början.
     ============================================================ */
  function flyttaRuta(opts) {
    var o = opts || {};
    return new Promise(function (klar) {
      var ruta = document.createElement('div');
      ruta.className = 'nx-fraga';
      ruta.innerHTML =
        '<div class="nx-fraga-box" role="dialog" aria-modal="true" aria-labelledby="flytt-t">'
        + '<h3 id="flytt-t">Flytta passet</h3>'
        + '<p>Passet ligger nu ' + esc(datumText(o.datum)) + ' kl. ' + esc(o.tid || '') + '. '
        + 'Motparten får bekräfta den nya tiden.</p>'
        + '<div class="vy-form-rad" style="margin-top:18px">'
        + '<div class="pay-field"><label for="fl-datum">Nytt datum</label>'
        + '<input class="inp" id="fl-datum" type="date" value="' + esc(o.datum) + '" min="' + isoFor(new Date()) + '"></div>'
        + '<div class="pay-field"><label for="fl-tid">Ny tid</label>'
        + '<select class="sel" id="fl-tid"></select></div>'
        + '</div>'
        + '<p class="ok-msg" id="fl-msg"></p>'
        + '<div class="nx-fraga-knappar">'
        + '<button type="button" class="btn btn-ghost" data-flytt="nej">Avbryt</button>'
        + '<button type="button" class="btn btn-primary" data-flytt="ja">Flytta passet</button>'
        + '</div></div>';

      var dat = ruta.querySelector('#fl-datum');
      var tid = ruta.querySelector('#fl-tid');
      var msg = ruta.querySelector('#fl-msg');

      function fyllTider() {
        var tider = NX.tiderFörDatum(dat.value, o.tillgang || [], o.blockerade || []);
        /* Passets egen tid ska gå att behålla när man bara byter dag,
           trots att den ligger i upptagna-listan. */
        var upptagna = o.upptagna || new Set();
        var val = tider.filter(function (t) {
          if (dat.value === o.datum && t === o.tid) return true;
          return !upptagna.has(dat.value + '|' + t);
        });

        if (!val.length) {
          tid.innerHTML = '<option value="">Inga lediga tider</option>';
          tid.disabled = true;
          NX.säg(msg, 'Inga lediga tider den dagen. Prova ett annat datum.', false);
        } else {
          tid.disabled = false;
          tid.innerHTML = val.map(function (t) {
            return '<option value="' + t + '"' + (t === o.tid ? ' selected' : '') + '>' + t + '</option>';
          }).join('');
          NX.rensa(msg);
        }
      }

      dat.addEventListener('change', fyllTider);

      function stäng(svar) {
        ruta.remove();
        document.body.style.overflow = '';
        klar(svar);
      }

      ruta.addEventListener('click', function (e) {
        if (e.target === ruta) return stäng(null);
        var k = e.target.closest('[data-flytt]');
        if (!k) return;
        if (k.dataset.flytt === 'nej') return stäng(null);
        if (!tid.value) { NX.säg(msg, '⚠️ Välj en tid som går att boka.', false); return; }
        if (dat.value === o.datum && tid.value === o.tid) {
          NX.säg(msg, '⚠️ Det är samma tid som passet redan har.', false); return;
        }
        stäng({ datum: dat.value, tid: tid.value });
      });

      document.addEventListener('keydown', function esc3(e) {
        if (e.key === 'Escape' && document.body.contains(ruta)) {
          document.removeEventListener('keydown', esc3);
          stäng(null);
        }
      });

      document.body.appendChild(ruta);
      document.body.style.overflow = 'hidden';
      void ruta.offsetWidth;
      ruta.classList.add('open');
      fyllTider();
      dat.focus();
    });
  }

  /* ============================================================
     NOTISER
     En knapp i sidhuvudet med det som faktiskt kräver något av
     användaren. Inte en logg över allt som hänt — en lista över
     det som väntar.
     ============================================================ */
  function notiser(host, poster) {
    if (!host) return;
    var öppen = false;

    if (!poster.length) { host.innerHTML = ''; sättTitel(0); return; }

    host.innerHTML =
      '<button type="button" class="nx-notis" aria-expanded="false" aria-label="'
      + poster.length + ' saker som väntar">'
      + '<span class="nx-notis-prick"></span>' + poster.length
      + '</button>'
      + '<div class="nx-notis-lista" hidden>'
      + poster.map(function (p) {
          return '<button type="button" class="nx-notis-rad" data-mal="' + esc(p.mål || '') + '">'
            + '<b>' + esc(p.rubrik) + '</b><span>' + esc(p.text) + '</span></button>';
        }).join('')
      + '</div>';

    var knapp = host.querySelector('.nx-notis');
    var lista = host.querySelector('.nx-notis-lista');

    function stäng() { öppen = false; lista.hidden = true; knapp.setAttribute('aria-expanded', 'false'); }

    knapp.addEventListener('click', function (e) {
      e.stopPropagation();
      öppen = !öppen;
      lista.hidden = !öppen;
      knapp.setAttribute('aria-expanded', String(öppen));
    });

    lista.addEventListener('click', function (e) {
      var rad = e.target.closest('[data-mal]');
      if (!rad) return;
      stäng();
      var mål = document.querySelector(rad.dataset.mal);
      if (mål) {
        mål.scrollIntoView({ behavior: 'smooth', block: 'center' });
        mål.classList.add('nx-blink');
        setTimeout(function () { mål.classList.remove('nx-blink'); }, 1600);
      }
    });

    document.addEventListener('click', function (e) {
      if (öppen && !host.contains(e.target)) stäng();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && öppen) stäng(); });

    sättTitel(poster.length);
  }

  /* Antalet syns i fliken också — man har sällan vyn framme. */
  function sättTitel(n) {
    var ren = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = n ? '(' + n + ') ' + ren : ren;
  }

  return {
    flyttaRuta: flyttaRuta, notiser: notiser,
    LAGE: LAGE, NIVA: NIVA,
    läxläge: läxläge, deadlineText: deadlineText,
    läxRad: läxRad, nivåMätare: nivåMätare,
    progressRad: progressRad, progressPerÄmne: progressPerÄmne,
    tomt: tomt, laddar: laddar,
    bekräfta: bekräfta, medan: medan, kolla: kolla
  };
})();
