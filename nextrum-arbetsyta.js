/* ============================================================
   NEXTRUM — arbetsytan

   Delas av foralder.html, larare.html och admin.html. Laddas efter
   nextrum-studie.js och kräver NX (nextrum-app.js).

   Fyra saker bor här, alla flyttade UT ur sidorna för att de gjorde
   samma jobb på två ställen med två uppsättningar buggar:

     · hälsningen   — vem tittar, och vad är klockan
     · flikar       — två gamla sektioner i en, utan ny menypost
     · bokningen    — en kalender med lediga tider, och önska-en-annan-tid
     · månaden      — kalendern som bokningen, flytta-rutan och
                      studiehjälparens tider delar

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

    /* Bilden ligger ALLTID där, och videon ovanpå den — genomskinlig
       tills den faktiskt spelar. Två skäl:

       1. Filen behöver inte finnas. Saknas bilder/hero-studievy.mp4
          händer ingenting alls: videon blir aldrig synlig, bilden
          står kvar, och konsolen får ett 404 ingen användare ser.
          Filmen kan alltså läggas till senare utan att en rad
          markup ändras.

       2. En poster går inte att röra på. Med bilden som ett eget
          element kan den driva långsamt (se .vy-hero-still i
          arbetsyta.css) så att blocket lever även utan film — och
          rörelsen tas över av videon i samma sekund den spelar,
          i stället för att ligga kvar ovanpå den. */
    var bild = o.bild || 'bilder/hero-nextrum-1280.jpg';
    var media = '<img class="vy-hero-still" src="' + esc(bild) + '" alt="" aria-hidden="true">'
      + (o.video
        ? '<video autoplay muted loop playsinline preload="auto"'
          + ' aria-hidden="true" tabindex="-1"><source src="' + esc(o.video)
          + '" type="video/mp4"></video>'
        : '');

    /* Blocket går kant i kant med skärmen, men texten ska ändå stå
       i linje med sidomenyn under. Därför en inre yta med samma
       maxbredd och samma sidmarginal som resten av sidan: sektionen
       bär bilden, ytan bär innehållet. */
    host.innerHTML =
      '<div class="vy-hero-media">' + media + '</div>'
      + '<span class="vy-hero-sloja" aria-hidden="true"></span>'
      + '<div class="vy-hero-yta">'
      + (o.marke
        ? '<span class="vy-hero-marke">' + (o.marke.ikon || '')
          + esc(o.marke.text) + '</span>'
        : '')
      + '<div class="vy-hero-inne">'
      + (o.etikett ? '<span class="vy-hero-et">' + esc(o.etikett) + '</span>' : '')
      + '<h1>' + esc(hälsningsrad(o.namn)) + '</h1>'
      + (o.lede ? '<p class="vy-hero-lede">' + esc(o.lede) + '</p>' : '')
      + '</div>'
      + '<div class="vy-hero-kort">' + kort() + '</div>'
      + '</div>';

    /* "playing", inte "canplay": canplay lovar att den KAN spela.
       Tonar vi in där och filen sedan stannar står vi med en svart
       ruta över bilden. */
    var film = host.querySelector('video');
    if (film) {
      film.addEventListener('playing', function () { film.classList.add('spelar'); });
      /* autoplay-attributet räcker inte alltid. Ett element som
         skapats med innerHTML efter sidladdningen får inte alltid
         samma behandling som ett som stod i dokumentet, och vissa
         webbläsare kräver ett anrop även för en ljudlös film.
         Avvisas löftet händer ingenting: bilden står kvar, vilket är
         precis rätt beteende. */
      var försök = film.play();
      if (försök && försök.catch) försök.catch(function () {});
    }

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
     MÅNADEN — en vanlig kalender

     Leo underkände veckorutnätet och veckovyn 2026-09-18: "ha bara en
     kalender där man trycker in på dagar och tider på dagen". Det här
     är den kalendern, och den används på tre ställen:

       · familjens bokning   — dagar med lediga tider har en prick
       · flytta-rutan        — samma, med passets egen tid räknad som ledig
       · studiehjälparens tider — prick på veckodagar där tider finns

     Det är en HTML-byggare, inte en komponent med eget liv. Vyerna
     ritar om hela sin yta när något ändras, och två ritloopar som äger
     samma element är ett fel som syns först när någon klickar snabbt.
     Klicken fångas av vyn:

       .mv-dag[data-datum]              en dag
       #<prefix>-forr, #<prefix>-nasta   föregående / nästa månad
       .mv-tid[data-datum][data-tid]    en tid under kalendern
     ============================================================ */

  function idagISO() { return NX.isoFor(new Date()); }

  function plusDagar(iso, n) {
    var d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return NX.isoFor(d);
  }

  /* Första dagen i månaden, som ISO. Månader räknas alltid från den
     första, så att jämförelser mellan månader är strängjämförelser. */
  function månadFör(iso) { return String(iso).slice(0, 8) + '01'; }

  function plusMånader(första, n) {
    var d = new Date(första + 'T12:00:00');
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    return månadFör(NX.isoFor(d));
  }

  /* o:
       manad     — första dagen i månaden som visas, ISO
       valt      — vald dag, ISO, eller null
       dag       — funktion(iso) => { klickbar, prick }
       minManad  — tidigaste månad pilarna går till (första dagen)
       maxManad  — senaste
       prefix    — id-prefix för pilarna, om två kalendrar kan synas
                   samtidigt (en dialog över en vy)
       prickText — vad pricken betyder, för skärmläsare */
  function manad(o) {
    var första = o.manad;
    var d0 = new Date(första + 'T12:00:00');
    var år = d0.getFullYear(), mån = d0.getMonth();
    var tomma = (d0.getDay() + 6) % 7;
    var antal = new Date(år, mån + 1, 0).getDate();
    var idag = idagISO();
    var p = o.prefix || 'mv';

    var rutor = '';
    for (var i = 0; i < tomma; i++) rutor += '<span class="mv-tom" aria-hidden="true"></span>';
    for (var dag = 1; dag <= antal; dag++) {
      var iso = år + '-' + tvasiffrig(mån + 1) + '-' + tvasiffrig(dag);
      var info = o.dag(iso) || {};
      rutor += '<button type="button" class="mv-dag'
        + (iso === idag ? ' ar-idag' : '')
        + (info.prick ? ' ar-prick' : '')
        + (iso < idag ? ' ar-forbi' : '') + '"'
        + ' data-datum="' + iso + '"'
        + (info.klickbar ? '' : ' disabled')
        + ' aria-pressed="' + (o.valt === iso ? 'true' : 'false') + '"'
        + ' aria-label="' + esc(datumText(iso)
          + (info.prick ? ', ' + (o.prickText || 'har lediga tider') : '')) + '">'
        + dag + '</button>';
    }

    var kanFörra = !o.minManad || första > o.minManad;
    var kanNästa = !o.maxManad || första < o.maxManad;

    return '<div class="mv">'
      + '<div class="mv-huvud">'
      + '<button type="button" class="bk-pil" id="' + p + '-forr"' + (kanFörra ? '' : ' disabled')
      + ' aria-label="Föregående månad">'
      + '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M7.5 2.5 4 6l3.5 3.5"/></svg></button>'
      + '<b class="mv-titel">' + esc((NX.MANADER[mån] || '') + ' ' + år) + '</b>'
      + '<button type="button" class="bk-pil" id="' + p + '-nasta"' + (kanNästa ? '' : ' disabled')
      + ' aria-label="Nästa månad">'
      + '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5 8 6l-3.5 3.5"/></svg></button>'
      + '</div>'
      + '<div class="mv-vd" aria-hidden="true">'
      + DAGAR_KORTA.map(function (d) { return '<span>' + esc(d) + '</span>'; }).join('')
      + '</div>'
      + '<div class="mv-grid">' + rutor + '</div>'
      + '</div>';
  }

  /* Tiderna under kalendern, för den dag som är vald. Bara lediga tider
     ritas — Leo ville inte se timmar som redan är tagna. */
  function tidsrad(o) {
    if (!o.datum) {
      return '<p class="mv-inga">' + esc(o.välj || 'Välj en dag i kalendern.') + '</p>';
    }
    if (!o.tider.length) {
      return '<p class="mv-inga">' + esc(o.tom || 'Inga lediga tider den dagen.') + '</p>';
    }
    return '<div class="mv-tider" role="group" aria-label="' + esc('Tider ' + datumText(o.datum)) + '">'
      + o.tider.map(function (t) {
          return '<button type="button" class="bk-slot mv-tid" data-datum="' + o.datum + '"'
            + ' data-tid="' + t + '" aria-pressed="' + (o.vald === t ? 'true' : 'false') + '">'
            + esc(String(t).slice(0, 5)) + '</button>';
        }).join('')
      + '</div>';
  }

  /* ============================================================
     BOKNINGEN

     FJÄRDE OMGÅNGEN, efter Leos genomgång 2026-09-18. Två vägar:

       BOKA EN LEDIG TID — överst. En kalender där dagar med lediga
       tider har en prick; trycker man på en dag visas dagens lediga
       tider, och bara de. En bokning som ligger helt inom
       studiehjälparens tider bekräftas direkt av databasen
       (bekrafta_inom_schemat, Fas 4.4) — den är redan ett ja.

       ÖNSKA EN ANNAN TID — en egen sektion under. Vilken dag och tid
       som helst. Den blir en förfrågan som studiehjälparen bekräftar
       eller avböjer.

     Ämne, längd och format står överst och gäller båda vägarna.

     Tidigare omgångar, för den som undrar varför det ser ut så här:
     tre rullgardiner och en månadskalender; fyra numrerade steg;
     en veckovy. Alla gömde något — tiderna, veckan eller dagen.

     opts:
       host     — elementet
       amnen    — [] ämnen att välja mellan
       amne     — förvalt ämne
       pris     — kr per timme
       hos      — studiehjälparens namn, för kvittoraden
       tjanst   — tjänstens kod, styr flerbarnstillägg och rabattkoder
       ladda    — async () => { tillgang, upptagna, tidigare } | { spärr }
       boka     — async ({datum,tid,minuter,amne,format,plats,barn,kod,rabattOre,not,önskemål})
                  => 'felmeddelande' | { status } | null
     ============================================================ */
  function bokning(opts) {
    var o = opts || {};
    var host = o.host;
    if (!host) return null;

    var LANGDER = [[60, '1 timme'], [120, '2 timmar'], [180, '3 timmar']];
    /* På plats står först, och är förvalet. Läxhjälpen är tänkt att
       ske hemma hos familjen eller någonstans de kommer överens om —
       online finns kvar för den som behöver det, men ska inte vara
       det man råkar boka för att det låg först. */
    var FORMAT = ['På plats', 'Online'];
    /* Hur långt fram kalendern går. Längre än så är inte en bokning,
       det är en gissning om terminen. */
    var MANADER_FRAM = 3;
    /* Klockslagen man kan önska. Hela timmar, eftersom allt bokas och
       faktureras i hela timmar. */
    var ÖNSKA_FRÅN = 7, ÖNSKA_TILL = 21;

    var st = {
      amne: o.amne || (o.amnen || [])[0] || 'Matematik',
      minuter: 60,
      format: 'På plats',
      /* Var ni ses. Frivillig: många vet redan, och den som inte vet
         ska inte hindras från att boka. */
      plats: '',
      manad: null,
      dag: null,
      datum: null,
      tid: null,
      /* Hur många barn passet gäller. Tillägget är EN summa oavsett
         om de är två eller tre — regeln och taket står i tjanster. */
      barn: 1,
      /* Rabattkoden i tre delar: vad som står i fältet, vad servern
         svarade, och hur mycket det blev. En kod som skrivits men inte
         kontrollerats får inte se ut som en rabatt i kvittot. */
      kod: '',
      kodSvar: null,
      rabatt: 0,
      kodOppen: false,
      /* Önskemålet: vilken dag och tid som helst, utanför kalendern. */
      önska: { datum: '', tid: '', not: '' },
      besked: null,
      /* Ett fel vid bokningen står i st, inte bara i DOM:en — ladda()
         ritar om hela ytan direkt efteråt, och då försvann texten
         innan någon hunnit läsa den. */
      fel: null,
      önskaBesked: null,
      data: { tillgang: [], upptagna: new Set(), tidigare: [] },
      spärr: null
    };

    /* Förra bokningen bestämmer förvalen. En familj som alltid bokar
       matte på plats ska inte välja matte på plats varje gång. */
    function ärvFrånTidigare() {
      /* Den senaste, inte den första: listan kommer i datumordning. */
      var t = (st.data.tidigare || []).slice().sort(function (a, b) {
        return String(b.wanted_date || '').localeCompare(String(a.wanted_date || ''));
      });
      var f = t[0];
      if (!f) return false;
      if (f.subject && (o.amnen || []).indexOf(f.subject) !== -1) st.amne = f.subject;
      if (f.duration_min) st.minuter = f.duration_min;
      if (f.format && FORMAT.indexOf(f.format) !== -1) st.format = f.format;
      if (f.location) st.plats = f.location;
      return true;
    }

    function timmar() { return Math.max(1, Math.round(st.minuter / 60)); }

    /* Vilken tjänst bokningen gäller. o.tjanst får vara en funktion:
       vyn skapar bokningen innan katalogen hunnit laddas, och ett
       värde som lästes då hade frusit fast på reservkatalogens val.
       Utan o.tjanst frågas katalogen — aldrig en inskriven tjänst. */
    function tjanstKod() {
      var t = typeof o.tjanst === 'function' ? o.tjanst() : o.tjanst;
      if (t) return t;
      return (typeof NXTjanster !== 'undefined' && NXTjanster.standard) ? NXTjanster.standard() : null;
    }
    function tjanstRad() {
      var kod = tjanstKod();
      return (kod && typeof NXTjanster !== 'undefined' && NXTjanster.hitta) ? NXTjanster.hitta(kod) : null;
    }

    function barnTak() {
      var t = tjanstRad();
      return t && t.extra_personer_max > 1 ? t.extra_personer_max : 1;
    }
    function extraOre() {
      var t = tjanstRad();
      return (t && t.extra_personer_ore) || 0;
    }

    /* Bruttot i ÖRE, för det är vad servern räknar i. Kronorna i
       kvittot härleds ur den här siffran, aldrig tvärtom. */
    /* Timpriset ur katalogen — samma källa som databasen räknar
       rabatten på och som faktureringen tar betalt efter. o.pris
       (kronor, ur konfigurationen) gäller bara innan katalogen finns. */
    function timprisOre() {
      var t = tjanstRad();
      if (t && t.pris_per_timme_ore) return Number(t.pris_per_timme_ore);
      return (o.pris || 379) * 100;
    }
    function bruttoOre() {
      var tim2 = timprisOre() + (st.barn > 1 ? extraOre() : 0);
      return Math.round(tim2 * st.minuter / 60);
    }
    function nettoOre() { return Math.max(0, bruttoOre() - (st.rabatt || 0)); }
    function längdText() {
      var t = timmar();
      return t === 1 ? '1 timme' : t + ' timmar';
    }

    /* ---------- lediga tider ---------- */

    /* Ett pass på två timmar upptar två timmar. Att bara titta på
       starttimmen hade erbjudit 16:00 fast 17:00 var bokat. */
    function upptagen(datum, tid) {
      var h = tim(tid), t = timmar();
      for (var i = 0; i < t; i++) {
        if (st.data.upptagna.has(datum + '|' + tvasiffrig(h + i) + ':00')) return true;
      }
      return false;
    }

    /* Bara de lediga. Leo ville inte se timmar som redan är tagna — de
       är inte ett val, och en överstruken knapp är brus. */
    function ledigaTider(datum) {
      return NX.tiderFörDatum(datum, st.data.tillgang, [], st.minuter)
        .filter(function (t) { return !upptagen(datum, t); });
    }

    function förstaLedigaDag() {
      var idag = idagISO();
      for (var i = 0; i < MANADER_FRAM * 31; i++) {
        var d = plusDagar(idag, i);
        if (ledigaTider(d).length) return d;
      }
      return null;
    }

    /* ---------- knapprader ---------- */

    function chips(id, poster, valt, etikett) {
      return '<div class="vy-val" id="' + id + '" role="group" aria-label="' + esc(etikett) + '">'
        + poster.map(function (p) {
          return '<button type="button" data-v="' + esc(String(p[0])) + '" aria-pressed="'
            + (String(p[0]) === String(valt) ? 'true' : 'false') + '">' + esc(p[1]) + '</button>';
        }).join('') + '</div>';
    }

    function barnChips() {
      var poster = [];
      for (var i = 1; i <= barnTak(); i++) poster.push([i, i === 1 ? '1 barn' : i + ' barn']);
      return chips('bk-barn', poster, st.barn, 'Antal barn');
    }

    /* Koden kontrolleras på SERVERN, aldrig här. Klienten vet inte
       vilka koder som finns och ska inte veta det. */
    function rabattHtml() {
      if (!st.kodOppen && !st.rabatt) {
        return '<button type="button" class="bk-lank" id="bk-kod-oppna">Har ni en rabattkod?</button>';
      }
      var svar = st.kodSvar, status = '';
      if (svar && svar.giltig) {
        status = '<span class="bk-kod-ok">✓ ' + esc(svar.beskrivning || 'Rabatt tillagd') + '</span>';
      } else if (svar) {
        status = '<span class="bk-kod-fel">' + esc(svar.orsak || 'Koden gäller inte.') + '</span>';
      }
      return '<div class="bk-kod">'
        + '<label class="xsmall" for="bk-kod-falt">Rabattkod</label>'
        + '<div class="bk-kod-rad">'
        + '<input class="inp" id="bk-kod-falt" maxlength="24" autocomplete="off"'
        + ' spellcheck="false" placeholder="KOD" value="' + esc(st.kod) + '">'
        + '<button class="btn btn-ghost btn-sm" type="button" id="bk-kod-knapp">'
        + (st.rabatt > 0 ? 'Ta bort' : 'Använd') + '</button>'
        + '</div>' + status + '</div>';
    }

    function valdText() {
      var d = new Date(st.datum + 'T12:00:00');
      return DAGAR_KORTA[(d.getDay() + 6) % 7] + ' ' + datumText(st.datum)
        + ' kl. ' + st.tid.slice(0, 5);
    }

    function önskaHtml() {
      var idag = idagISO();
      var tider = '<option value="">Välj tid</option>';
      for (var h = ÖNSKA_FRÅN; h <= ÖNSKA_TILL; h++) {
        var t = tvasiffrig(h) + ':00';
        tider += '<option value="' + t + '"' + (st.önska.tid === t ? ' selected' : '') + '>' + t + '</option>';
      }
      return '<div class="bk-onska">'
        + '<h6>Önska en annan tid</h6>'
        + '<p>Passar ingen av tiderna ovanför? Önska vilken dag och tid som helst — er studiehjälpare '
        + 'bekräftar eller svarar att det inte går. Ämne, längd och plats tas från valen överst.</p>'
        + '<div class="bk-onska-rad">'
        + '<input class="inp" type="date" id="bk-o-datum" min="' + idag + '" value="' + esc(st.önska.datum) + '"'
        + ' aria-label="Dag">'
        + '<select class="sel" id="bk-o-tid" aria-label="Klockslag">' + tider + '</select>'
        + '</div>'
        + '<input class="inp" id="bk-o-not" maxlength="300" value="' + esc(st.önska.not) + '"'
        + ' placeholder="Meddelande till studiehjälparen (valfritt)">'
        + '<div class="bk-onska-fot">'
        + '<button class="btn btn-ghost" type="button" id="bk-o-skicka">Skicka önskemålet</button>'
        + '</div>'
        + '<p class="ok-msg' + (st.önskaBesked ? ' show' : '') + '" id="bk-o-msg">'
        + (st.önskaBesked ? esc(st.önskaBesked) : '') + '</p>'
        + '</div>';
    }

    function rita() {
      if (!st.manad) st.manad = månadFör(idagISO());
      if (st.spärr) {
        host.innerHTML = '<div class="bk">' + st.spärr + '</div>';
        return;
      }

      var vald = st.datum && st.tid;
      var påPlats = st.format === 'På plats';
      var idag = idagISO();

      var val = '<div class="bk-val">'
        + '<div class="bk-valrad"><span class="bk-valrad-et">Ämne</span>'
        + chips('bk-amnen', (o.amnen || []).map(function (a) { return [a, a]; }), st.amne, 'Ämne')
        + '</div>'
        + '<div class="bk-valrad bk-valrad-tva">'
        + '<span class="bk-valrad-et">Längd</span>'
        + chips('bk-langder', LANGDER.map(function (l) { return [String(l[0]), l[1]]; }),
            String(st.minuter), 'Längd')
        + '<span class="bk-valrad-et">Var</span>'
        + chips('bk-format', FORMAT.map(function (f) { return [f, f]; }), st.format, 'Format')
        + '</div>'
        + (påPlats
          ? '<div class="bk-plats">'
            + '<label class="xsmall" for="bk-plats-falt">Var ses ni? (valfritt)</label>'
            + '<input class="inp" id="bk-plats-falt" maxlength="120" value="' + esc(st.plats) + '"'
            + ' placeholder="t.ex. Hemma hos oss, Storgatan 4">'
            + '</div>'
          : '')
        + '</div>';

      var kalender = manad({
        manad: st.manad,
        valt: st.dag,
        prefix: 'bk',
        minManad: månadFör(idag),
        maxManad: plusMånader(månadFör(idag), MANADER_FRAM - 1),
        prickText: 'har lediga tider',
        dag: function (iso) {
          var fri = iso >= idag && ledigaTider(iso).length > 0;
          return { klickbar: fri, prick: fri };
        }
      });

      var dagens = tidsrad({
        datum: st.dag,
        tider: st.dag ? ledigaTider(st.dag) : [],
        vald: st.datum === st.dag ? st.tid : null,
        välj: 'Välj en dag med en prick — där har er studiehjälpare lediga tider.',
        tom: 'Inga lediga tider den dagen för ' + längdText().toLowerCase() + '.'
      });

      var extra = (barnTak() > 1 ? barnChips() : '') + rabattHtml();

      var pris = st.rabatt > 0
        ? '<b>' + esc(kr(nettoOre() / 100)) + '</b>'
          + '<span class="bk-pris-fore">' + esc(kr(bruttoOre() / 100)) + '</span>'
        : '<b>' + esc(kr(nettoOre() / 100)) + '</b>';

      var sum = '<div class="bk-sum' + (vald ? ' ar-vald' : '') + '">'
        + '<div class="bk-sum-vad">'
        + (vald
          ? '<b>' + esc(valdText()) + '</b>'
            + '<span>' + esc(st.amne + ' · ' + längdText() + ' · ' + st.format)
            + (o.hos ? ' · hos ' + esc(o.hos) : '') + '</span>'
          : '<b>Välj en dag och en tid</b><span>Tider inom er studiehjälpares schema bekräftas direkt.</span>')
        + '</div>'
        + '<div class="bk-sum-pris">' + pris
        + '<span>' + esc(längdText()) + ', betalas i efterskott</span></div>'
        + '<button class="btn btn-primary" id="bk-boka" type="button"'
        + (vald ? '' : ' disabled') + '>Boka passet</button>'
        + '</div>';

      if (st.utanTider && !(st.data.tillgang || []).length) {
        host.innerHTML = '<div class="bk">'
          + val
          + st.utanTider
          + (extra ? '<div class="bk-extra">' + extra + '</div>' : '')
          + önskaHtml()
          + '</div>';
        return;
      }

      host.innerHTML = '<div class="bk">'
        + val
        + '<div class="bk-kal">'
        + '<div class="bk-kal-manad">' + kalender + '</div>'
        + '<div class="bk-kal-dag">'
        + (st.dag ? '<p class="bk-kal-dagnamn">' + esc(DAGAR_LANGA[(new Date(st.dag + 'T12:00:00').getDay() + 6) % 7]
            + ' ' + datumText(st.dag)) + '</p>' : '')
        + dagens + '</div>'
        + '</div>'
        + (extra ? '<div class="bk-extra">' + extra + '</div>' : '')
        + sum
        + '<p class="ok-msg' + (st.fel ? ' show is-err' : '') + '" id="bk-msg">'
        + (st.fel ? esc(st.fel) : '') + '</p>'
        /* .show, inte ett eget attribut: .ok-msg är display:none
           tills klassen sitter där, precis som NX.säg sätter den. */
        + '<p class="ok-msg' + (st.besked ? ' show' : '') + '" id="bk-besked">'
        + (st.besked ? esc(st.besked) : '') + '</p>'
        + önskaHtml()
        + '</div>';
    }

    /* ---------- val ---------- */

    function väljDag(iso) {
      st.besked = null; st.fel = null;
      st.dag = st.dag === iso ? null : iso;
      if (st.datum !== st.dag) { st.datum = null; st.tid = null; }
      rita();
    }

    function väljTid(datum, tid) {
      st.besked = null; st.fel = null;
      if (st.datum === datum && st.tid === tid) { st.datum = null; st.tid = null; }
      else { st.datum = datum; st.tid = tid; }
      rita();
    }

    function byteMånad(steg) {
      var idag = idagISO();
      var ny = plusMånader(st.manad, steg);
      if (ny < månadFör(idag)) return;
      if (ny > plusMånader(månadFör(idag), MANADER_FRAM - 1)) return;
      st.manad = ny;
      rita();
    }

    /* Ingen omritning medan man skriver: rita() byter ut hela
       innerHTML, och fältet hade tappat både innehåll och fokus vid
       varje tangenttryck. Värdet läses ur st när ytan ritas om av
       något annat skäl. */
    host.addEventListener('input', function (e) {
      var t = e.target;
      if (!t) return;
      if (t.id === 'bk-plats-falt') st.plats = t.value;
      if (t.id === 'bk-o-not') st.önska.not = t.value;
      if (t.id === 'bk-o-datum') st.önska.datum = t.value;
      /* Koden lagras i versaler. Servern jämför mot versaler, och att
         låta fältet visa något annat än det som skickas är ett fel som
         bara syns för den som skrev med gemener. */
      if (t.id === 'bk-kod-falt') {
        var nytt = t.value.toUpperCase();
        if (t.value !== nytt) t.value = nytt;
        st.kod = nytt;
      }
    });
    host.addEventListener('change', function (e) {
      var t = e.target;
      if (!t) return;
      if (t.id === 'bk-o-tid') st.önska.tid = t.value;
      if (t.id === 'bk-o-datum') st.önska.datum = t.value;
    });

    host.addEventListener('click', function (e) {
      var tid = e.target.closest('.mv-tid');
      if (tid && !tid.disabled) { väljTid(tid.dataset.datum, tid.dataset.tid); return; }

      var dag = e.target.closest('.mv-dag');
      if (dag && !dag.disabled) { väljDag(dag.dataset.datum); return; }

      if (e.target.closest('#bk-forr')) { byteMånad(-1); return; }
      if (e.target.closest('#bk-nasta')) { byteMånad(1); return; }

      var val = e.target.closest('.vy-val button[data-v]');
      if (val) {
        /* Ett eget val går före förra bokningens förval. */
        st.ärvt = true;
        var grupp = val.closest('.vy-val').id;
        if (grupp === 'bk-amnen') { st.amne = val.dataset.v; rita(); }
        else if (grupp === 'bk-format') { st.format = val.dataset.v; rita(); }
        else if (grupp === 'bk-barn') {
          st.barn = Number(val.dataset.v) || 1;
          /* Bruttot ändras, alltså är rabatten uträknad på fel underlag. */
          if (st.rabatt > 0) { kollaKod(true); return; }
          rita();
        }
        else if (grupp === 'bk-langder') {
          st.minuter = Number(val.dataset.v);
          /* Längden ändrar vilka tider som ryms. En vald tid som inte
             längre får plats måste släppas, annars bokar man två
             timmar i ett enda ledigt hål. */
          st.datum = null; st.tid = null;
          if (st.rabatt > 0) { st.rabatt = 0; st.kodSvar = null; }
          rita();
        }
        return;
      }

      if (e.target.closest('#bk-kod-oppna')) { st.kodOppen = true; rita(); return; }

      var kodKnapp = e.target.closest('#bk-kod-knapp');
      if (kodKnapp) {
        if (st.rabatt > 0) { st.kod = ''; st.kodSvar = null; st.rabatt = 0; st.kodOppen = false; rita(); }
        else kollaKod();
        return;
      }

      if (e.target.closest('#bk-boka')) { skicka(); return; }
      if (e.target.closest('#bk-o-skicka')) { skickaÖnskemål(); return; }
    });

    /* Kontrollen går till funktionen kolla_rabattkod i databasen, som
       svarar på EN kod och aldrig lämnar ut listan. tyst = räkna om
       efter att bruttot ändrats, utan att blinka till med ett nytt
       meddelande om en kod användaren redan godkänt. */
    function kollaKod(tyst) {
      var kod = (st.kod || '').trim();
      if (!kod) { st.kodSvar = { giltig: false, orsak: 'Skriv en kod.' }; rita(); return; }
      if (typeof supa === 'undefined' || !supa) return;

      var knapp = $('#bk-kod-knapp', host);
      NXStudie.medan(knapp, tyst ? '' : 'Kollar…', async function () {
        var r = await supa.rpc('kolla_rabattkod', {
          p_kod: kod,
          /* null = koden prövas utan tjänstevillkor, precis som
             kolla_rabattkod gör när ingen tjänst anges. */
          p_tjanst: tjanstKod(),
          p_belopp_ore: bruttoOre()
        });
        var rad = (r.data || [])[0];
        if (r.error || !rad) {
          st.kodSvar = { giltig: false, orsak: 'Kunde inte kontrollera koden just nu.' };
          st.rabatt = 0;
        } else {
          st.kodSvar = rad;
          st.rabatt = rad.giltig ? Number(rad.rabatt_ore || 0) : 0;
        }
        rita();
      });
    }

    function grund() {
      return {
        minuter: st.minuter,
        amne: st.amne,
        format: st.format,
        plats: st.format === 'På plats' ? st.plats.trim() : '',
        barn: st.barn,
        /* Bara en kod som faktiskt gett rabatt skickas med. */
        kod: st.rabatt > 0 ? (st.kod || '').trim() : null,
        rabattOre: st.rabatt > 0 ? st.rabatt : null
      };
    }

    /* Svaret från o.boka: en sträng är ett fel, ett objekt med status
       säger vad databasen gjorde av bokningen. */
    function tolka(svar) {
      if (typeof svar === 'string') return { fel: svar };
      return { status: svar && svar.status ? svar.status : null };
    }

    function efterBokning() {
      /* Koden är förbrukad på det här passet. Att låta den stå kvar
         hade sett ut som att nästa bokning också får den. */
      st.kod = ''; st.kodSvar = null; st.rabatt = 0; st.kodOppen = false; st.barn = 1;
    }

    function skicka() {
      var knapp = $('#bk-boka', host), msg = $('#bk-msg', host);
      if (msg) NX.rensa(msg);
      if (!st.datum || !st.tid) return;
      st.besked = null; st.fel = null;
      NXStudie.medan(knapp, 'Bokar…', async function () {
        var v = grund();
        v.datum = st.datum; v.tid = st.tid;
        var r = tolka(await o.boka(v));
        if (r.fel) {
          /* Laddas om så att en tid som hann tas försvinner ur listan
             — och ur valet, se ladda(). Felet ritas från st. */
          st.fel = r.fel;
          await ladda();
          return;
        }
        st.besked = r.status === 'confirmed'
          ? '✓ Passet är bokat. Tiden låg inom er studiehjälpares schema, så den är redan bekräftad.'
          : 'Förfrågan är skickad. Er studiehjälpare ser den direkt och bekräftar.';
        st.datum = null; st.tid = null;
        efterBokning();
        await ladda();
      });
    }

    function skickaÖnskemål() {
      var knapp = $('#bk-o-skicka', host), msg = $('#bk-o-msg', host);
      if (msg) NX.rensa(msg);
      st.önskaBesked = null;
      var datum = st.önska.datum, tid = st.önska.tid;
      if (!datum || !tid) { if (msg) NX.säg(msg, 'Välj både dag och klockslag.', false); return; }
      if (datum < idagISO()) { if (msg) NX.säg(msg, 'Dagen har redan varit.', false); return; }
      /* Samma regel som kalendern (NX.tiderFörDatum): idag går bara
         tider minst en timme fram. Klockan 15.50 är "idag 09:00" ett
         misstag, inte ett önskemål. */
      if (datum === idagISO()) {
        var nu = new Date();
        if (Number(tid.slice(0, 2)) * 60 < nu.getHours() * 60 + nu.getMinutes() + 60) {
          if (msg) NX.säg(msg, 'Den tiden har redan varit, eller börjar om mindre än en timme. Välj en senare tid.', false);
          return;
        }
      }

      NXStudie.medan(knapp, 'Skickar…', async function () {
        var v = grund();
        v.datum = datum; v.tid = tid;
        v.not = (st.önska.not || '').trim() || null;
        v.önskemål = true;
        var r = tolka(await o.boka(v));
        if (r.fel) {
          var m = $('#bk-o-msg', host);
          if (m) NX.säg(m, r.fel, false);
          return;
        }
        /* Ett önskemål som råkar ligga helt inom schemat bekräftas av
           databasen precis som en vanlig bokning. Säg vilket det blev. */
        st.önskaBesked = r.status === 'confirmed'
          ? '✓ Tiden låg inom er studiehjälpares schema, så passet är redan bokat och bekräftat.'
          : '✓ Önskemålet är skickat. Er studiehjälpare bekräftar eller svarar i chatten.';
        st.önska = { datum: '', tid: '', not: '' };
        efterBokning();
        await ladda();
      });
    }

    async function ladda() {
      var d = await o.ladda();
      /* Första laddningen, inte "har inga tidigare pass" — en familj
         som aldrig bokat hade annars fått förvalen och månaden
         återställda varje gång något laddades om. */
      var första = !st.laddad;
      st.laddad = true;
      st.data = {
        tillgang: d.tillgang || [],
        upptagna: d.upptagna || new Set(),
        tidigare: d.tidigare || []
      };
      st.spärr = d.spärr || null;
      /* Inga tider alls hos studiehjälparen: ingen kalender att boka i,
         men önskemålet under fungerar ändå. Texten kommer från vyn. */
      st.utanTider = d.utanTider || null;
      /* En gång, första gången det finns något att ärva. Första
         laddningen räcker inte: på familjesidan kommer den innan
         passen hämtats. Att ärva om vid varje omladdning hade skrivit
         över ett val användaren precis gjort. */
      if (!st.ärvt && ärvFrånTidigare()) st.ärvt = true;
      /* Landa i en månad som har något att erbjuda. En tom månad som
         första intryck ser ut som att ingen tid finns alls. */
      if (första) {
        var f = förstaLedigaDag();
        st.manad = månadFör(f || idagISO());
      }
      /* En vald dag som inte längre har lediga tider släpps, och en
         vald tid som hann bokas av någon annan likaså — annars stod
         den kvar i sammanfattningen med Boka tänd. */
      if (st.dag && !ledigaTider(st.dag).length) { st.dag = null; st.datum = null; st.tid = null; }
      if (st.datum && st.tid && ledigaTider(st.datum).indexOf(st.tid) === -1) { st.datum = null; st.tid = null; }
      rita();
    }

    rita();

    return {
      ladda: ladda,
      sättAmnen: function (lista, förvalt) {
        if (lista && lista.length) o.amnen = lista;
        if (förvalt) st.amne = förvalt;
        else if ((o.amnen || []).indexOf(st.amne) === -1) st.amne = (o.amnen || [])[0] || st.amne;
        rita();
      },
      sättHos: function (namn) { o.hos = namn; rita(); }
    };
  }

  /* ============================================================
     FÄLLBARA DELAR

     Passen och rapporterna växer varje vecka och krymper aldrig.
     Efter en termin ligger trettio genomförda pass överst i vägen
     för de tre som faktiskt är kvar att göra något åt.

     En pil längst till höger i rubriken fäller ihop delen. Valet
     sparas per webbläsare — den som gömt de genomförda passen har
     gömt dem, inte gömt dem tills sidan laddas om.

     Markupen bär allt, så en lista som ritas om med innerHTML
     behåller sitt läge utan att sidan behöver koppla om något:

       <div class="vy-fall" data-fall="NYCKEL">
         <button data-fall-knapp aria-expanded="true">…</button>
         <div class="vy-fall-kropp"> … </div>
       </div>
     ============================================================ */
  var FALL_PIL = '<svg viewBox="0 0 12 12" aria-hidden="true">'
    + '<path d="M2.5 4.5 6 8l3.5-3.5"/></svg>';

  /* localStorage kastar i privat läge i vissa webbläsare. Ett gömt
     pass är inte värt en trasig vy, så allt här får misslyckas tyst
     och falla tillbaka på utfällt. */
  function fallDolt(nyckel) {
    try { return window.localStorage.getItem('nx.fall.' + nyckel) === 'dolt'; }
    catch (e) { return false; }
  }
  function fallSpara(nyckel, dolt) {
    try { window.localStorage.setItem('nx.fall.' + nyckel, dolt ? 'dolt' : 'oppet'); }
    catch (e) { /* strunt samma */ }
  }

  /* Pilen som sitter i en rubrik. Etiketten talar om vad den gömmer,
     för den som hör sidan i stället för att se den. */
  function fallKnapp(nyckel, namn) {
    var dolt = fallDolt(nyckel);
    return '<button type="button" class="vy-fall-pil" data-fall-knapp'
      + ' aria-expanded="' + (dolt ? 'false' : 'true') + '"'
      + ' aria-label="' + esc(namn || 'Dölj') + '">' + FALL_PIL + '</button>';
  }

  /* En grupp inne i en lista: egen rubrikrad med antal och pil.
     Returnerar html i stället för en nod — listorna ritas om med
     innerHTML vid varje laddning, och en nod hade ändå varit borta
     nästa gång. */
  function fallGrupp(o) {
    var nyckel = o.nyckel, dolt = fallDolt(nyckel);
    return '<div class="vy-fall" data-fall="' + esc(nyckel) + '">'
      + '<div class="vy-fall-rad">'
      + '<span class="vy-fall-et">' + esc(o.etikett)
      + (o.antal ? ' <em>' + esc(String(o.antal)) + '</em>' : '') + '</span>'
      + fallKnapp(nyckel, o.namn || ('Dölj ' + String(o.etikett).toLowerCase()))
      + '</div>'
      + '<div class="vy-fall-kropp"' + (dolt ? ' hidden' : '') + '>'
      + (o.kropp || '') + '</div>'
      + '</div>';
  }

  /* Rutor vars pil står i markupen läses av en gång när vyn öppnas,
     så ett sparat läge syns direkt och inte först vid första klicket. */
  function fallStall(rot) {
    var host = rot || document;
    Array.prototype.forEach.call(host.querySelectorAll('.vy-fall[data-fall]'), function (f) {
      var knapp = f.querySelector('[data-fall-knapp]');
      var kropp = f.querySelector('.vy-fall-kropp');
      if (!knapp || !kropp) return;
      var dolt = fallDolt(f.dataset.fall);
      knapp.setAttribute('aria-expanded', dolt ? 'false' : 'true');
      kropp.hidden = dolt;
    });
  }

  document.addEventListener('click', function (e) {
    var knapp = e.target.closest('[data-fall-knapp]');
    if (!knapp) return;
    var rot = knapp.closest('.vy-fall');
    var kropp = rot && rot.querySelector('.vy-fall-kropp');
    if (!rot || !kropp) return;
    var dolt = !kropp.hidden;
    kropp.hidden = dolt;
    knapp.setAttribute('aria-expanded', dolt ? 'false' : 'true');
    fallSpara(rot.dataset.fall, dolt);
  });

  return {
    hälsning: hälsning,
    hälsningsrad: hälsningsrad,
    förnamn: förnamn,
    hero: hero,
    flikar: flikar,
    visaFör: visaFör,
    bokning: bokning,
    manad: manad,
    tidsrad: tidsrad,
    månadFör: månadFör,
    plusMånader: plusMånader,
    fallGrupp: fallGrupp,
    fallStall: fallStall,
    DAGAR_LANGA: DAGAR_LANGA,
    DAGAR_KORTA: DAGAR_KORTA
  };
})();
