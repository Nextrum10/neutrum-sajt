/* ============================================================
   NEXTRUM — arbetsytan

   Delas av foralder.html, larare.html och admin.html. Laddas efter
   nextrum-studie.js och kräver NX (nextrum-app.js).

   Fyra saker bor här, alla flyttade UT ur sidorna för att de gjorde
   samma jobb på två ställen med två uppsättningar buggar:

     · hälsningen   — vem tittar, och vad är klockan
     · flikar       — två gamla sektioner i en, utan ny menypost
     · bokningen    — lediga tider som knappar i stället för sökning
     · veckorutnätet — studiehjälparens tider, ritade som en vecka

   Ingenting här pratar med databasen. Varje vy skickar in sin data
   och får tillbaka ett svar på vad någon tryckte på. Det är med
   flit: RLS-reglerna skiljer sig åt mellan vyerna, och en delad
   fil som skriver till tabeller skulle behöva känna till alla tre.
   ============================================================ */
window.NXArbete = (function () {
  'use strict';

  var $ = NX.$, esc = NX.esc, datumText = NX.datumText, kr = NX.kr;
  var DAGAR_LANGA = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
  var DAGAR_KORTA = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

  function tvasiffrig(n) { return String(n).padStart(2, '0'); }
  function tim(s) { return Number(String(s || '').slice(0, 2)); }

  /* ============================================================
     HÄLSNINGEN

     Gränserna är valda efter hur svenskar faktiskt säger det, inte
     efter en jämn tredjedelsindelning av dygnet. "Godmorgon" håller
     till tio, "godkväll" börjar när skoldagen är slut. Efter midnatt
     säger vi fortfarande god kväll — den som sitter i vyn 00:30 har
     inte börjat en ny dag, hen har inte lagt sig.
     ============================================================ */
  function hälsning(timme) {
    var h = typeof timme === 'number' ? timme : new Date().getHours();
    if (h >= 5 && h < 10) return 'Godmorgon';
    if (h >= 10 && h < 17) return 'Goddag';
    return 'Godkväll';
  }

  /* Förnamnet, inte hela. "Godkväll Alma Lindqvist Bergström" låter
     som ett brev från Kronofogden. */
  function förnamn(namn) {
    return String(namn || '').trim().split(/\s+/)[0] || '';
  }

  function hälsningsrad(namn) {
    var f = förnamn(namn);
    return f ? hälsning() + ', ' + f + '.' : hälsning() + '.';
  }

  /* ============================================================
     HERO-BLOCKET

     Bakgrunden är en video om filen finns, annars stillbilden. Det
     är inte ett fallback-fall som ska felsökas: <video> med
     poster visar postern tills den kan spela, och kan den aldrig
     spela stannar postern kvar. Alltså kan filmen läggas till
     senare utan att en enda rad markup ändras.

     opts:
       host      — elementet blocket ritas i
       namn      — vems namn som ska stå i hälsningen
       etikett   — liten rad ovanför rubriken ("Studievy")
       lede      — en mening under rubriken
       nasta     — { text, under, href } eller null
       chatt     — { href, text, under, olasta }
       video     — sökväg till mp4, valfritt
       bild      — poster/fallback, krävs
     ============================================================ */
  function hero(opts) {
    var o = opts || {};
    var host = o.host;
    if (!host) return null;

    function kort() {
      var ut = '';
      if (o.nasta) {
        ut += '<a href="' + esc(o.nasta.href || '#lektioner') + '">'
          + '<span class="vy-hero-prick" aria-hidden="true"></span>'
          + '<span><b>' + esc(o.nasta.text) + '</b>'
          + '<span>' + esc(o.nasta.under || '') + '</span></span></a>';
      }
      if (o.chatt) {
        ut += '<a href="' + esc(o.chatt.href || '#meddelanden') + '">'
          + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 12c0 3.9-3.8 7-8.5 7a9.8 9.8 0 0 1-2.6-.35L4.5 20l1.2-3.3A6.6 6.6 0 0 1 3.5 12c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7z"/></svg>'
          + '<span><b>' + esc(o.chatt.text || 'Meddelanden') + '</b>'
          + '<span>' + esc(o.chatt.under || '') + '</span></span></a>';
      }
      return ut;
    }

    var bild = o.bild || 'bilder/hero-nextrum-1280.jpg';
    var media = o.video
      ? '<video autoplay muted loop playsinline preload="auto" poster="' + esc(bild) + '"'
        + ' aria-hidden="true" tabindex="-1"><source src="' + esc(o.video) + '" type="video/mp4"></video>'
      : '<img src="' + esc(bild) + '" alt="" aria-hidden="true">';

    host.innerHTML =
      '<div class="vy-hero-media">' + media + '</div>'
      + '<span class="vy-hero-sloja" aria-hidden="true"></span>'
      + (o.marke
        ? '<span class="vy-hero-marke">' + (o.marke.ikon || '')
          + esc(o.marke.text) + '</span>'
        : '')
      + '<div class="vy-hero-inne">'
      + (o.etikett ? '<span class="vy-hero-et">' + esc(o.etikett) + '</span>' : '')
      + '<h1>' + esc(hälsningsrad(o.namn)) + '</h1>'
      + (o.lede ? '<p class="vy-hero-lede">' + esc(o.lede) + '</p>' : '')
      + '</div>'
      + '<div class="vy-hero-kort">' + kort() + '</div>';

    return {
      /* Nästa pass och olästa ändras medan vyn står öppen. Att rita
         om hela blocket då hade startat om videon från början. */
      uppdatera: function (nytt) {
        Object.assign(o, nytt || {});
        var rad = host.querySelector('.vy-hero-kort');
        if (rad) rad.innerHTML = kort();
        var h1 = host.querySelector('h1');
        if (h1) h1.textContent = hälsningsrad(o.namn);
      }
    };
  }

  /* ============================================================
     FLIKAR

     Sammanslagningen av två sektioner får inte kosta åtkomsten till
     den ena. Flikarna bor i sektionen, inte i menyn, så menyn blir
     kortare utan att något försvinner.

     Adressen bär den valda fliken som #sektion/flik. Utan det
     hamnar varje länk in i vyn på första fliken, och "visa alla
     material" landade på läxorna.
     ============================================================ */
  function flikar(host, opts) {
    var o = opts || {};
    if (!host) return null;
    var knappar = NX.$$('.vy-flik', host);
    var paneler = NX.$$('.vy-flik-panel', host);
    if (!knappar.length) return null;

    function visa(namn) {
      var finns = knappar.some(function (k) { return k.dataset.flik === namn; });
      var vald = finns ? namn : knappar[0].dataset.flik;
      knappar.forEach(function (k) {
        k.setAttribute('aria-selected', k.dataset.flik === vald ? 'true' : 'false');
        k.tabIndex = k.dataset.flik === vald ? 0 : -1;
      });
      paneler.forEach(function (p) { p.hidden = p.dataset.flik !== vald; });
      if (typeof o.onByt === 'function') o.onByt(vald);
      return vald;
    }

    /* Adressen ska säga vad man faktiskt tittar på, annars är en
       delad länk fel så fort någon bytt flik. replaceState och inte
       location.hash: ett flikbyte är inte ett steg bakåtknappen ska
       behöva ta, och en hash-ändring hade dessutom väckt
       sidomenyns egen lyssnare i onödan. */
    var sekNamn = host.dataset ? host.dataset.sek : null;
    function skrivAdress(vald) {
      if (!sekNamn || !window.history || !history.replaceState) return;
      var ny = '#' + sekNamn + '/' + vald;
      if (location.hash !== ny) history.replaceState(null, '', ny);
    }

    knappar.forEach(function (k) {
      k.addEventListener('click', function () { skrivAdress(visa(k.dataset.flik)); });
      /* Piltangenter mellan flikar är vad en flikrad lovar när den
         har role="tablist". Utan dem är löftet falskt. */
      k.addEventListener('keydown', function (e) {
        var i = knappar.indexOf(k);
        var steg = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!steg) return;
        e.preventDefault();
        var nästa = knappar[(i + steg + knappar.length) % knappar.length];
        nästa.focus();
        skrivAdress(visa(nästa.dataset.flik));
      });
    });

    visa(o.standard || knappar[0].dataset.flik);
    var api = { visa: visa };
    /* Hänget på elementet gör visaFör() nedan möjlig utan ett
       globalt register som måste städas. */
    host.__flikar = api;
    return api;
  }

  /* Ett element kan ligga i en flik som inte är framme. Notisraderna
     och "visa alla"-länkarna scrollar till id:n som numera bor i
     flikpaneler, och att scrolla till något som är hidden gör
     ingenting alls — utan det här blev de raderna tysta klick. */
  function visaFör(el) {
    var panel = el && el.closest ? el.closest('.vy-flik-panel') : null;
    if (!panel || !panel.hidden) return;
    var host = panel.parentElement;
    while (host && !host.__flikar) host = host.parentElement;
    if (host && host.__flikar) host.__flikar.visa(panel.dataset.flik);
  }

  /* ============================================================
     BOKNINGEN

     Vad som togs bort och varför:

     Förr fanns tre rullgardiner, en månadskalender och en knapp som
     låg avstängd tills alla fyra stämde. Det är fyra beslut innan
     man ens vet om tiden finns — och kalendern visade en månad där
     de flesta dagarna var tomma, för studiehjälparen jobbar tre
     kvällar i veckan.

     Nu räknas de lediga timmarna fram först (NX.föreslåTider gör
     redan exakt det åt studiehjälparvyn) och visas som knappar.
     Ett klick är hela bokningen om längden är den vanliga.
     Månadskalendern finns kvar bakom "Fler tider" för den som
     vill boka långt fram.

     opts:
       host     — elementet
       amnen    — [] ämnen att välja mellan
       amne     — förvalt ämne
       pris     — kr per timme
       ladda    — async () => { tillgang, blockerade, upptagna, tidigare }
       boka     — async ({datum,tid,minuter,amne,format}) => null | 'felmeddelande'
       spärrText— html som visas när något hindrar bokning helt
     ============================================================ */
  function bokning(opts) {
    var o = opts || {};
    var host = o.host;
    if (!host) return null;

    var st = {
      amne: o.amne || (o.amnen || [])[0] || 'Matematik',
      minuter: 60,
      format: 'Online',
      datum: null,
      tid: null,
      data: { tillgang: [], blockerade: [], upptagna: new Set(), tidigare: [] },
      kal: null,
      spärr: null
    };

    var LANGDER = [[60, '1 timme'], [120, '2 timmar'], [180, '3 timmar']];
    var FORMAT = ['Online', 'På plats'];

    host.innerHTML =
      '<div class="vy-boka-rot">'
      + '<div class="vy-boka-steg"><b>1</b>Vad ska ni göra</div>'
      + '<div class="vy-val" id="bk-amnen" role="group" aria-label="Ämne"></div>'
      + '<div class="vy-val" id="bk-langder" role="group" aria-label="Längd" style="margin-top:9px"></div>'
      + '<div class="vy-val" id="bk-format" role="group" aria-label="Format" style="margin-top:9px"></div>'

      + '<div class="vy-boka-steg" style="margin-top:24px"><b>2</b>När</div>'
      + '<div id="bk-tider"><div class="loading">Hämtar lediga tider</div></div>'

      + '<details class="vy-mer-tider" id="bk-fler">'
      + '<summary>Fler tider och andra veckor'
      + '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg></summary>'
      + '<div class="vy-mer-tider-kropp"><div id="bk-kalender"></div></div>'
      + '</details>'

      + '<div class="vy-kvitto">'
      + '<span class="vy-kvitto-vad" id="bk-kvitto">Välj en tid ovan.</span>'
      + '<span class="vy-kvitto-pris" id="bk-pris"></span>'
      + '</div>'
      + '<div class="vy-fot" style="border:none;padding-top:14px;margin-top:0">'
      + '<button class="btn btn-primary" id="bk-boka" type="button" disabled>Boka passet</button>'
      + '<span class="small" id="bk-hjalp" style="color:var(--bl-3)"></span>'
      + '</div>'
      + '<p class="ok-msg" id="bk-msg"></p>'
      + '</div>';

    function segment(host2, poster, valt, påVal) {
      host2.innerHTML = poster.map(function (p) {
        return '<button type="button" data-v="' + esc(String(p[0])) + '" aria-pressed="'
          + (String(p[0]) === String(valt) ? 'true' : 'false') + '">' + esc(p[1]) + '</button>';
      }).join('');
      host2.onclick = function (e) {
        var k = e.target.closest('button[data-v]');
        if (!k) return;
        NX.$$('button', host2).forEach(function (b) {
          b.setAttribute('aria-pressed', b === k ? 'true' : 'false');
        });
        påVal(k.dataset.v);
      };
    }

    function ritaVal() {
      segment($('#bk-amnen', host), (o.amnen || []).map(function (a) { return [a, a]; }),
        st.amne, function (v) { st.amne = v; ritaKvitto(); });
      segment($('#bk-langder', host), LANGDER.map(function (l) { return [String(l[0]), l[1]]; }),
        String(st.minuter), function (v) {
          st.minuter = Number(v);
          /* Längden ändrar vilka timmar som ryms. En vald tid som
             inte längre får plats måste släppas, annars bokar man
             två timmar i ett enda ledigt hål. */
          st.datum = null; st.tid = null;
          if (st.kal) { st.kal.sättMinuter(st.minuter); st.kal.nollställ(); }
          ritaTider(); ritaKvitto();
        });
      segment($('#bk-format', host), FORMAT.map(function (f) { return [f, f]; }),
        st.format, function (v) { st.format = v; ritaKvitto(); });
    }

    function ritaTider() {
      var rut = $('#bk-tider', host);
      if (st.spärr) { rut.innerHTML = st.spärr; return; }

      var förslag = NX.föreslåTider({
        tillgang: st.data.tillgang,
        blockerade: st.data.blockerade,
        upptagna: st.data.upptagna,
        tidigare: st.data.tidigare,
        minuter: st.minuter,
        dagar: 21,
        antal: 6
      });

      if (!förslag.length) {
        rut.innerHTML = NXStudie.tomt('Inga lediga tider de närmaste veckorna',
          'Er studiehjälpare har tider inlagda, men de är bokade eller för korta för '
          + (st.minuter / 60) + ' timmar. Prova en kortare längd, eller fråga hen i chatten.');
        return;
      }

      rut.innerHTML = '<div class="vy-tidrad">' + förslag.map(function (f) {
        var d = new Date(f.datum + 'T12:00:00');
        var dag = DAGAR_KORTA[(d.getDay() + 6) % 7];
        return '<button type="button" class="vy-tid' + (f.vanlig ? ' vy-tid-vanlig' : '') + '"'
          + ' data-datum="' + f.datum + '" data-tid="' + f.tid + '"'
          + ' aria-pressed="' + (st.datum === f.datum && st.tid === f.tid ? 'true' : 'false') + '">'
          + '<b>' + esc(dag + ' ' + f.tid.slice(0, 5)) + '</b>'
          + '<span>' + esc(datumText(f.datum)) + '</span></button>';
      }).join('') + '</div>';
    }

    function ritaKvitto() {
      var kvitto = $('#bk-kvitto', host), pris = $('#bk-pris', host), knapp = $('#bk-boka', host);
      var timmar = Math.max(1, Math.round(st.minuter / 60));

      if (st.spärr) { knapp.disabled = true; kvitto.textContent = ''; pris.textContent = ''; return; }
      if (!st.datum || !st.tid) {
        knapp.disabled = true;
        kvitto.textContent = 'Välj en tid ovan.';
        pris.textContent = '';
        return;
      }
      knapp.disabled = false;
      kvitto.innerHTML = '<b>' + esc(datumText(st.datum) + ' kl. ' + st.tid.slice(0, 5)) + '</b>'
        + '<em>' + esc(st.amne + ' · ' + (timmar === 1 ? '1 timme' : timmar + ' timmar')
          + ' · ' + st.format) + '</em>';
      pris.textContent = kr((o.pris || 379) * timmar);
    }

    function välj(datum, tid) {
      st.datum = datum; st.tid = tid;
      NX.$$('.vy-tid', host).forEach(function (b) {
        b.setAttribute('aria-pressed',
          b.dataset.datum === datum && b.dataset.tid === tid ? 'true' : 'false');
      });
      ritaKvitto();
    }

    host.addEventListener('click', function (e) {
      var k = e.target.closest('.vy-tid');
      if (!k) return;
      välj(k.dataset.datum, k.dataset.tid);
      if (st.kal) st.kal.välj(k.dataset.datum, k.dataset.tid);
    });

    /* Månadskalendern byggs först när någon fäller ut den. Att rita
       en kalender ingen bett om kostar en layout på varje sidladdning
       och de flesta bokar en av tiderna ovanför. */
    $('#bk-fler', host).addEventListener('toggle', function () {
      if (!$('#bk-fler', host).open || st.kal) return;
      st.kal = NX.byggKalender({
        host: $('#bk-kalender', host),
        upptagna: st.data.upptagna,
        tillgang: st.data.tillgang,
        blockerade: st.data.blockerade,
        minuter: st.minuter,
        onChange: function (s) {
          if (!s.valtDatum || !s.valdTid) return;
          välj(s.valtDatum, s.valdTid);
        }
      });
    });

    $('#bk-boka', host).addEventListener('click', function () {
      var knapp = $('#bk-boka', host), msg = $('#bk-msg', host);
      NX.rensa(msg);
      if (!st.datum || !st.tid) return;
      NXStudie.medan(knapp, 'Bokar…', async function () {
        var fel = await o.boka({
          datum: st.datum, tid: st.tid, minuter: st.minuter,
          amne: st.amne, format: st.format
        });
        if (fel) { NX.säg(msg, fel, false); await ladda(); return; }
        NX.säg(msg, 'Passet är önskat. Er studiehjälpare ser det direkt och bekräftar.', true);
        st.datum = null; st.tid = null;
        if (st.kal) st.kal.nollställ();
        await ladda();
      });
    });

    async function ladda() {
      var d = await o.ladda();
      st.data = {
        tillgang: d.tillgang || [],
        blockerade: d.blockerade || [],
        upptagna: d.upptagna || new Set(),
        tidigare: d.tidigare || []
      };
      st.spärr = d.spärr || null;
      if (st.kal) {
        st.kal.sättTider({ tillgang: st.data.tillgang, blockerade: st.data.blockerade });
        st.kal.sättUpptagna(st.data.upptagna);
      }
      $('#bk-fler', host).hidden = !!st.spärr;
      ritaTider();
      ritaKvitto();
    }

    ritaVal();
    ritaKvitto();

    return {
      ladda: ladda,
      sättAmnen: function (lista, förvalt) {
        if (lista && lista.length) o.amnen = lista;
        if (förvalt) st.amne = förvalt;
        else if ((o.amnen || []).indexOf(st.amne) === -1) st.amne = (o.amnen || [])[0] || st.amne;
        ritaVal(); ritaKvitto();
      }
    };
  }

  /* ============================================================
     VECKORUTNÄTET

     Studiehjälparens tider. Det gamla systemet var tre rullgardiner
     och en knapp per fönster: "vardagar 16–20" kostade fem
     omgångar, och resultatet gick bara att kontrollera i en lista
     under formuläret. Man såg aldrig sin vecka.

     Nu är veckan ritad. Klicka i en ruta, dra över flera. En
     sammanhängande rad rutor blir en rad i tutor_availability när
     man sparar — samma tabell, samma format, ingen migrering.

     opts:
       host      — elementet
       fran, till— timintervall som ritas (7–22 som standard)
       spara     — async (lagga, tabort) => null | 'felmeddelande'
                   där varje post är {weekday, start_time, end_time}
     ============================================================ */
  function veckorutnat(opts) {
    var o = opts || {};
    var host = o.host;
    if (!host) return null;
    var FRAN = o.fran || 7, TILL = o.till || 22;

    var valda = new Set();       // "dag|timme"
    var sparade = new Set();     // samma, som det ser ut i databasen
    var drar = null;             // 'pa' | 'av' medan man drar

    var SNABBVAL = [
      ['Vardagar 16–20', [0, 1, 2, 3, 4], 16, 20],
      ['Vardagar 18–21', [0, 1, 2, 3, 4], 18, 21],
      ['Helger 10–16', [5, 6], 10, 16]
    ];

    host.innerHTML =
      '<div class="vy-vecka-verktyg" id="vk-snabb"></div>'
      + '<div class="vy-vecka-skal"><div class="vy-vecka" id="vk-rut"></div></div>'
      + '<div class="vy-vecka-fot">'
      + '<span class="vy-vecka-sam" id="vk-sam"></span>'
      + '<span style="display:flex;gap:9px;flex-wrap:wrap">'
      + '<button class="btn btn-ghost btn-sm" type="button" id="vk-angra">Ångra</button>'
      + '<button class="btn btn-primary btn-sm" type="button" id="vk-spara" disabled>Spara tiderna</button>'
      + '</span></div>'
      + '<p class="ok-msg" id="vk-msg"></p>';

    $('#vk-snabb', host).innerHTML = SNABBVAL.map(function (s, i) {
      return '<button class="btn btn-ghost btn-sm" type="button" data-snabb="' + i + '">'
        + esc(s[0]) + '</button>';
    }).join('') + '<button class="btn btn-ghost btn-sm" type="button" data-snabb="rensa">Rensa allt</button>';

    function ritaRutor() {
      var ut = '<span class="vy-vecka-tim" aria-hidden="true"></span>';
      DAGAR_KORTA.forEach(function (d) {
        ut += '<span class="vy-vecka-dag">' + esc(d) + '</span>';
      });
      for (var h = FRAN; h < TILL; h++) {
        ut += '<span class="vy-vecka-tim">' + tvasiffrig(h) + '</span>';
        for (var d = 0; d < 7; d++) {
          var nyckel = d + '|' + h;
          ut += '<button type="button" class="vy-ruta" data-ruta="' + nyckel + '"'
            + ' aria-pressed="' + (valda.has(nyckel) ? 'true' : 'false') + '"'
            + ' aria-label="' + esc(DAGAR_LANGA[d] + ' ' + tvasiffrig(h) + ':00 till '
              + tvasiffrig(h + 1) + ':00') + '"></button>';
        }
      }
      $('#vk-rut', host).innerHTML = ut;
    }

    function måla(nyckel, på) {
      if (på) valda.add(nyckel); else valda.delete(nyckel);
      var el = host.querySelector('[data-ruta="' + nyckel + '"]');
      if (el) {
        el.setAttribute('aria-pressed', på ? 'true' : 'false');
        el.classList.remove('ar-pa-vag');
      }
      ritaFot();
    }

    /* Rutorna tillbaka till rader. En sammanhängande följd timmar
       på samma dag är ETT fönster — annars hade "16 till 20" blivit
       fyra rader i tabellen, och listan familjen ser hade sagt
       16–17, 17–18, 18–19, 19–20. */
    function tillRader(mängd) {
      var ut = [];
      for (var d = 0; d < 7; d++) {
        var timmar = [];
        for (var h = FRAN; h < TILL; h++) if (mängd.has(d + '|' + h)) timmar.push(h);
        var i = 0;
        while (i < timmar.length) {
          var start = timmar[i], slut = start + 1;
          while (i + 1 < timmar.length && timmar[i + 1] === slut) { slut++; i++; }
          ut.push({ weekday: d, start_time: tvasiffrig(start) + ':00:00', end_time: tvasiffrig(slut) + ':00:00' });
          i++;
        }
      }
      return ut;
    }

    function nyckelFör(r) { return r.weekday + '|' + r.start_time + '|' + r.end_time; }

    function ändrat() {
      if (valda.size !== sparade.size) return true;
      var olika = false;
      valda.forEach(function (v) { if (!sparade.has(v)) olika = true; });
      return olika;
    }

    function ritaFot() {
      var rader = tillRader(valda);
      var sam = $('#vk-sam', host);
      var spara = $('#vk-spara', host);
      spara.disabled = !ändrat();
      $('#vk-angra', host).disabled = !ändrat();

      if (!rader.length) {
        sam.innerHTML = '<b>Inga tider valda.</b> Ingen kan boka dig förrän du markerat när du kan.';
        return;
      }
      var timmar = valda.size;
      sam.innerHTML = '<b>' + timmar + (timmar === 1 ? ' timme' : ' timmar') + ' i veckan</b> · '
        + esc(rader.map(function (r) {
          return DAGAR_KORTA[r.weekday] + ' ' + r.start_time.slice(0, 5) + '–' + r.end_time.slice(0, 5);
        }).join(' · '));
    }

    /* --- dragning ---
       pointerdown bestämmer riktningen en gång: började man på en
       tom ruta målar hela dragningen på, började man på en fylld
       suddar den. Utan det växlar varje ruta man passerar och en
       dragning över en blandad yta blir dess negativ. */
    var rut = $('#vk-rut', host);

    rut.addEventListener('pointerdown', function (e) {
      var k = e.target.closest('[data-ruta]');
      if (!k) return;
      e.preventDefault();
      drar = valda.has(k.dataset.ruta) ? 'av' : 'pa';
      måla(k.dataset.ruta, drar === 'pa');
    });

    rut.addEventListener('pointerover', function (e) {
      if (!drar) return;
      var k = e.target.closest('[data-ruta]');
      if (!k) return;
      måla(k.dataset.ruta, drar === 'pa');
    });

    window.addEventListener('pointerup', function () { drar = null; });
    window.addEventListener('pointercancel', function () { drar = null; });

    /* Tangentbordet: mellanslag och enter når rutan som knapp av sig
       självt. Klicket får inte dubblera det pointerdown redan gjort,
       så det ignoreras när det kom från en pekare. */
    rut.addEventListener('click', function (e) {
      var k = e.target.closest('[data-ruta]');
      if (!k || e.detail !== 0) return;
      måla(k.dataset.ruta, !valda.has(k.dataset.ruta));
    });

    $('#vk-snabb', host).addEventListener('click', function (e) {
      var k = e.target.closest('[data-snabb]');
      if (!k) return;
      if (k.dataset.snabb === 'rensa') {
        valda.clear();
      } else {
        var s = SNABBVAL[Number(k.dataset.snabb)];
        s[1].forEach(function (d) {
          for (var h = s[2]; h < s[3]; h++) valda.add(d + '|' + h);
        });
      }
      ritaRutor(); ritaFot();
    });

    $('#vk-angra', host).addEventListener('click', function () {
      valda = new Set(sparade);
      ritaRutor(); ritaFot();
      NX.rensa($('#vk-msg', host));
    });

    $('#vk-spara', host).addEventListener('click', function () {
      var msg = $('#vk-msg', host);
      NX.rensa(msg);
      var nya = tillRader(valda), gamla = tillRader(sparade);
      var nyaN = {}, gamlaN = {};
      nya.forEach(function (r) { nyaN[nyckelFör(r)] = r; });
      gamla.forEach(function (r) { gamlaN[nyckelFör(r)] = r; });

      var lägga = nya.filter(function (r) { return !gamlaN[nyckelFör(r)]; });
      var taBort = gamla.filter(function (r) { return !nyaN[nyckelFör(r)]; });

      NXStudie.medan($('#vk-spara', host), 'Sparar…', async function () {
        var fel = await o.spara(lägga, taBort);
        if (fel) { NX.säg(msg, fel, false); return; }
        sparade = new Set(valda);
        ritaFot();
        NX.säg(msg, valda.size
          ? '✓ Sparat. Familjerna kan boka inom de här tiderna.'
          : '✓ Sparat. Inga tider inlagda — ingen kan boka dig just nu.', true);
      });
    });

    return {
      /* Rader från databasen in i rutnätet. En rad 16:00–20:00 blir
         fyra rutor; halvtimmar rundas till hela, för hela systemet
         bokar i hela timmar och en 16:30-ruta hade varit ett löfte
         bokningen inte kan hålla. */
      sätt: function (rader) {
        valda = new Set();
        (rader || []).forEach(function (r) {
          var start = tim(r.start_time), slut = tim(r.end_time);
          if (String(r.end_time).slice(3, 5) !== '00') slut += 1;
          for (var h = Math.max(start, FRAN); h < Math.min(slut, TILL); h++) {
            valda.add(r.weekday + '|' + h);
          }
        });
        sparade = new Set(valda);
        ritaRutor(); ritaFot();
      }
    };
  }

  return {
    hälsning: hälsning,
    hälsningsrad: hälsningsrad,
    förnamn: förnamn,
    hero: hero,
    flikar: flikar,
    visaFör: visaFör,
    bokning: bokning,
    veckorutnat: veckorutnat,
    DAGAR_LANGA: DAGAR_LANGA,
    DAGAR_KORTA: DAGAR_KORTA
  };
})();
