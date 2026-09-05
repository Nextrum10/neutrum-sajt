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
     ETT PASS I DETALJ
     Öppnas från schemat. Visar det man behöver veta, och tar EMOT
     knapparnas markup i stället för att bygga egna: vyerna har redan
     delegerade hanterare för bekräfta, flytta och avboka, och en
     andra uppsättning hade förr eller senare hamnat ur synk med den
     första.

     Därför stängs rutan efter att klicket hunnit bubbla vidare. Tas
     noden bort direkt når händelsen aldrig document, och knappen gör
     ingenting.
     ============================================================ */
  function passRuta(opts) {
    var o = opts || {};
    var ruta = document.createElement('div');
    ruta.className = 'nx-fraga';

    var fakta = (o.rader || [])
      .filter(function (r) { return r && r[1]; })
      .map(function (r) {
        return '<div class="pass-fakta-rad"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>';
      }).join('');

    ruta.innerHTML =
      '<div class="nx-fraga-box nx-passbox" role="dialog" aria-modal="true" aria-labelledby="pass-t">'
      + '<h3 id="pass-t">' + esc(o.titel || 'Passet') + '</h3>'
      + (o.under ? '<p>' + esc(o.under) + '</p>' : '')
      + (fakta ? '<div class="pass-fakta">' + fakta + '</div>' : '')
      + (o.anteckning
          ? '<div class="pass-block"><h6>Anteckning</h6><p>' + esc(o.anteckning) + '</p></div>' : '')
      + (o.rapport
          ? '<div class="pass-block"><h6>Efter passet</h6><p>' + esc(o.rapport) + '</p></div>' : '')
      + (o.laxor && o.laxor.length
          ? '<div class="pass-block"><h6>Läxor omkring passet</h6>'
            + o.laxor.map(function (h) {
                return '<div class="pass-lank">' + esc(h.title)
                  + (h.due_date ? '<span>Till ' + esc(deadlineText(h.due_date)) + '</span>' : '')
                  + '</div>';
              }).join('') + '</div>'
          : '')
      + '<div class="nx-fraga-knappar">'
      + '<button type="button" class="btn btn-ghost" data-pass-stang>Stäng</button>'
      + (o.atgarder || '')
      + '</div></div>';

    var sistaFokus = document.activeElement;
    function stäng() {
      if (!document.body.contains(ruta)) return;
      ruta.remove();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', tangent);
      if (sistaFokus && sistaFokus.focus) sistaFokus.focus();
    }
    function tangent(e) { if (e.key === 'Escape') stäng(); }

    ruta.addEventListener('click', function (e) {
      if (e.target === ruta) return stäng();
      if (!e.target.closest('button')) return;
      /* Låt klicket nå document först — det är där de riktiga
         hanterarna sitter. */
      setTimeout(stäng, 0);
    });
    document.addEventListener('keydown', tangent);

    document.body.appendChild(ruta);
    document.body.style.overflow = 'hidden';
    void ruta.offsetWidth;
    ruta.classList.add('open');
    var f = ruta.querySelector('[data-pass-stang]');
    if (f) f.focus();
    return { stäng: stäng };
  }

  /* ============================================================
     SCHEMAT
     Kalendern som redan fanns är en bokningsväljare: välj en dag,
     välj en tid. Det här är det andra man vill av en kalender —
     att se vad som redan ligger där.

     Tre lägen, samma data. Månad för att få överblick, vecka för att
     planera, dag för att se vad som faktiskt händer idag. Lägena är
     inte tre komponenter utan tre sätt att rita samma lista, så en
     bokning kan aldrig visas olika beroende på vilket läge man står i.

     opts: { host, bokningar, lage, namn(b), onOppna(b) }
     ============================================================ */
  var SCHEMA_LAGE = {
    requested: 'onskad', confirmed: 'bekraftad',
    completed: 'genomford', cancelled: 'avbokad'
  };

  function schema(opts) {
    var o = opts || {};
    var host = o.host;
    if (!host) return null;

    var läge = ['manad', 'vecka', 'dag'].indexOf(o.lage) !== -1 ? o.lage : 'manad';
    var visad = new Date(); visad.setHours(12, 0, 0, 0);
    var bokningar = o.bokningar || [];

    function namnFör(b) { return typeof o.namn === 'function' ? (o.namn(b) || '') : ''; }

    /* En avbokad rad ska synas i historiken men inte skräpa i
       överblicken — den som tittar på månaden vill veta vad som
       gäller, inte vad som ställdes in. */
    function förDag(iso, medAvbokade) {
      return bokningar
        .filter(function (b) {
          if (String(b.wanted_date) !== iso) return false;
          return medAvbokade || b.status !== 'cancelled';
        })
        .sort(function (a, c) { return String(a.wanted_time || '').localeCompare(String(c.wanted_time || '')); });
    }

    function måndagFör(d) {
      var m = new Date(d);
      m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
      m.setHours(12, 0, 0, 0);
      return m;
    }

    function titel() {
      if (läge === 'manad') return NX.MANADER[visad.getMonth()] + ' ' + visad.getFullYear();
      if (läge === 'dag') return NX.DAGAR[(visad.getDay() + 6) % 7] + ' ' + datumText(isoFor(visad));
      var m = måndagFör(visad), s = new Date(m); s.setDate(s.getDate() + 6);
      return datumText(isoFor(m)) + ' – ' + datumText(isoFor(s));
    }

    function flytta(steg) {
      if (läge === 'manad') visad.setMonth(visad.getMonth() + steg);
      else if (läge === 'vecka') visad.setDate(visad.getDate() + steg * 7);
      else visad.setDate(visad.getDate() + steg);
      rita();
    }

    function chip(b) {
      return '<button type="button" class="sch-pass ' + (SCHEMA_LAGE[b.status] || '')
        + '" data-pass="' + esc(b.id) + '">'
        + '<i></i><b>' + esc(b.wanted_time || '') + '</b>'
        + '<span>' + esc(b.subject || 'Pass') + '</span></button>';
    }

    function ritaManad() {
      var år = visad.getFullYear(), mån = visad.getMonth();
      var första = new Date(år, mån, 1);
      var offset = (första.getDay() + 6) % 7;
      var dagar = new Date(år, mån + 1, 0).getDate();
      var idag = isoFor(new Date());

      var ut = NX.DAGAR.map(function (d) { return '<div class="dow">' + d + '</div>'; }).join('');
      for (var i = 0; i < offset; i++) ut += '<div class="sch-dag tom"></div>';

      for (var d = 1; d <= dagar; d++) {
        var iso = isoFor(new Date(år, mån, d));
        var pass = förDag(iso);
        ut += '<div class="sch-dag' + (iso === idag ? ' idag' : '') + '" data-dag="' + iso + '">'
          + '<span class="sch-datum">' + d + '</span>'
          + pass.slice(0, 2).map(chip).join('')
          + (pass.length > 2
              ? '<button type="button" class="sch-fler" data-dag-oppna="' + iso + '">+'
                + (pass.length - 2) + ' till</button>'
              : '')
          + '</div>';
      }
      return '<div class="sch-manad">' + ut + '</div>';
    }

    function ritaVecka() {
      var m = måndagFör(visad);
      var idag = isoFor(new Date());
      var ut = '';
      for (var i = 0; i < 7; i++) {
        var d = new Date(m); d.setDate(d.getDate() + i);
        var iso = isoFor(d);
        var pass = förDag(iso);
        ut += '<div class="sch-rad' + (iso === idag ? ' idag' : '') + '">'
          + '<div class="sch-rad-dag"><b>' + NX.DAGAR[i] + '</b><span>' + d.getDate() + '</span></div>'
          + '<div class="sch-rad-pass">'
          + (pass.length ? pass.map(chip).join('') : '<span class="sch-tom">—</span>')
          + '</div></div>';
      }
      return '<div class="sch-vecka">' + ut + '</div>';
    }

    function ritaDag() {
      var iso = isoFor(visad);
      var pass = förDag(iso, true);
      if (!pass.length) {
        return '<div class="empty"><b>Inga pass den här dagen</b>'
          + '<br><span>Bläddra vidare, eller byt till månad för att se var de ligger.</span></div>';
      }
      return '<div class="sch-lista">' + pass.map(function (b) {
        return NXKontaktRad(b);
      }).join('') + '</div>';
    }

    /* Dagvyn visar hela raden, inte ett chip: det är den vyn man har
       framme när passet faktiskt ska hållas. */
    function NXKontaktRad(b) {
      return '<button type="button" class="sch-full ' + (SCHEMA_LAGE[b.status] || '')
        + '" data-pass="' + esc(b.id) + '">'
        + '<span class="sch-full-tid">' + esc(b.wanted_time || '—') + '</span>'
        + '<span class="sch-full-vad"><b>' + esc(b.subject || 'Pass') + '</b>'
        + '<span>' + esc([b.format, (b.duration_min || 60) + ' min', namnFör(b)]
            .filter(Boolean).join(' · ')) + '</span></span>'
        + '</button>';
    }

    function rita() {
      var kropp = läge === 'manad' ? ritaManad() : läge === 'vecka' ? ritaVecka() : ritaDag();
      host.innerHTML =
          '<div class="sch-topp">'
        + '<div class="cal-head" style="margin-bottom:0">'
        + '<b class="sch-titel">' + esc(titel()) + '</b>'
        + '<div class="cal-nav">'
        + '<button type="button" data-sch="bak" aria-label="Bakåt"><svg viewBox="0 0 12 12"><path d="M7.5 2.5 4 6l3.5 3.5"/></svg></button>'
        + '<button type="button" data-sch="idag" class="sch-idag">Idag</button>'
        + '<button type="button" data-sch="fram" aria-label="Framåt"><svg viewBox="0 0 12 12"><path d="M4.5 2.5 8 6l-3.5 3.5"/></svg></button>'
        + '</div></div>'
        + '<div class="sch-val" role="group" aria-label="Visa som">'
        + ['manad', 'vecka', 'dag'].map(function (l) {
            return '<button type="button" data-sch-lage="' + l + '" aria-pressed="' + (l === läge) + '">'
              + { manad: 'Månad', vecka: 'Vecka', dag: 'Dag' }[l] + '</button>';
          }).join('')
        + '</div></div>' + kropp;
    }

    host.addEventListener('click', function (e) {
      var nav = e.target.closest('[data-sch]');
      if (nav) {
        if (nav.dataset.sch === 'idag') { visad = new Date(); visad.setHours(12, 0, 0, 0); rita(); }
        else flytta(nav.dataset.sch === 'fram' ? 1 : -1);
        return;
      }
      var byt = e.target.closest('[data-sch-lage]');
      if (byt) { läge = byt.dataset.schLage; rita(); return; }

      /* "+2 till" hoppar till dagvyn i stället för att fälla ut en
         ruta i rutan — dagvyn finns redan och visar allt. */
      var fler = e.target.closest('[data-dag-oppna]');
      if (fler) {
        visad = new Date(fler.dataset.dagOppna + 'T12:00:00');
        läge = 'dag'; rita(); return;
      }
      var pass = e.target.closest('[data-pass]');
      if (pass && typeof o.onOppna === 'function') {
        var b = bokningar.filter(function (x) { return String(x.id) === pass.dataset.pass; })[0];
        if (b) o.onOppna(b);
      }
    });

    rita();

    return {
      rita: rita,
      sättBokningar: function (nya) { bokningar = nya || []; rita(); },
      gåTill: function (iso, nyttLäge) {
        visad = new Date(iso + 'T12:00:00');
        if (nyttLäge) läge = nyttLäge;
        rita();
      }
    };
  }

  /* ============================================================
     SIDOMENYN
     Vyerna var en enda lång sida där allt låg framme samtidigt: man
     fick skrolla förbi läxor och rapporter för att komma åt sina
     tider. Nu är varje del en egen sektion och menyn är vägen dit.

     Sektionerna byter inte dokument — de ligger kvar och göms med
     hidden. Det är hela poängen: befintlig JS skriver till sina #id
     precis som förut, oavsett vilken sektion som är framme, så
     ingenting av datalogiken behöver röras.

     Adressen bär sektionen (#laxor), så ett "Visa alla" och en
     notisrad är vanliga ankarlänkar. Det ger också bakåtknappen
     rätt beteende gratis.
     ============================================================ */
  function sidomeny(opts) {
    var o = opts || {};
    var nav = o.nav;
    var rot = o.rot || document;
    if (!nav) return null;

    var länkar = NX.$$('a[data-sek]', nav);
    var sektioner = NX.$$('section[data-sek]', rot);
    var namn = sektioner.map(function (s) { return s.dataset.sek; });
    if (!namn.length) return null;
    var standard = namn.indexOf(o.standard) !== -1 ? o.standard : namn[0];
    var första = true;

    function giltig(n) { return namn.indexOf(n) !== -1 ? n : standard; }

    function visa(önskad) {
      var vald = giltig(önskad);
      sektioner.forEach(function (s) { s.hidden = s.dataset.sek !== vald; });
      länkar.forEach(function (a) {
        var här = a.dataset.sek === vald;
        a.classList.toggle('ar-har', här);
        if (här) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });

      /* Vid första ritningen står man redan högst upp. Att scrolla
         då skulle rycka undan sidan medan den laddar. */
      if (!första) {
        window.scrollTo({ top: 0, behavior: 'auto' });
        var rubrik = rot.querySelector('section[data-sek="' + vald + '"] h2, section[data-sek="' + vald + '"] h5');
        if (rubrik) {
          rubrik.setAttribute('tabindex', '-1');
          rubrik.focus({ preventScroll: true });
        }
      }
      första = false;

      if (typeof o.onByt === 'function') o.onByt(vald);
      return vald;
    }

    function frånHash() { return visa(String(location.hash || '').replace(/^#/, '')); }

    window.addEventListener('hashchange', frånHash);
    frånHash();

    return {
      öppna: function (n) {
        var vald = giltig(n);
        if (String(location.hash).replace(/^#/, '') === vald) visa(vald);
        else location.hash = '#' + vald;
      },
      /* Siffran vid en menypost. 0 tar bort den helt — en tom prick
         läser som "noll nya", inte som "inget att visa". */
      märke: function (sek, antal) {
        länkar.forEach(function (a) {
          if (a.dataset.sek !== sek) return;
          var m = a.querySelector('.vy-sido-mark');
          if (!antal) { if (m) m.remove(); return; }
          if (!m) {
            m = document.createElement('span');
            m.className = 'vy-sido-mark';
            a.appendChild(m);
          }
          m.textContent = antal > 99 ? '99+' : String(antal);
          m.setAttribute('aria-label', antal + ' nya');
        });
      }
    };
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
      if (!mål) return;

      /* Målet kan ligga i en sektion som inte är framme. Byt dit
         först — annars scrollar vi till något som är hidden och
         ingenting händer. */
      var sek = mål.closest('section[data-sek]');
      if (sek && sek.hidden) {
        location.hash = '#' + sek.dataset.sek;
      }

      /* Sektionsbytet nollställer scrollen, så markeringen måste
         vänta tills den bytt. */
      requestAnimationFrame(function () {
        mål.scrollIntoView({ behavior: 'smooth', block: 'center' });
        mål.classList.add('nx-blink');
        setTimeout(function () { mål.classList.remove('nx-blink'); }, 1600);
      });
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
    flyttaRuta: flyttaRuta, notiser: notiser, sidomeny: sidomeny, schema: schema, passRuta: passRuta,
    LAGE: LAGE, NIVA: NIVA,
    läxläge: läxläge, deadlineText: deadlineText,
    läxRad: läxRad, nivåMätare: nivåMätare,
    progressRad: progressRad, progressPerÄmne: progressPerÄmne,
    tomt: tomt, laddar: laddar,
    bekräfta: bekräfta, medan: medan, kolla: kolla
  };
})();
