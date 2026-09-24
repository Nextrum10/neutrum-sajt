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

    /* INGEN FILM PÅ TELEFONEN, och ingen för den som bett om mindre
       rörelse eller mindre data. Leo 2026-09-24: "det är fortfarande
       laggigt". En video som spelar i en loop överst på sidan, en
       bild som zoomar under den och två kort med suddig bakgrund
       ovanpå är tre saker grafikkretsen ritar om varje bildruta — hela
       tiden sidan är öppen, också när man bokar ett pass längre ned.
       På en dator märks det inte; på en mellanklasstelefon är det
       varje tryck som känns segt. Filen är dessutom en halv megabyte
       som ingen på mobildata bett om. */
    var sparsam = false;
    try {
      sparsam = window.matchMedia('(max-width: 700px)').matches
        || window.matchMedia('(prefers-reduced-motion: reduce)').matches
        || !!(navigator.connection && navigator.connection.saveData);
    } catch (e) { sparsam = true; }
    if (sparsam) o.video = null;

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

    /* Allt som rör sig står still när blocket inte syns: filmen
       pausas och bildens drift fryses. Ingen ser den när man
       scrollat ned till bokningen, och då ska den inte heller kosta
       något. Samma sak när fliken ligger i bakgrunden. */
    var synlig = true;
    function uppdateraRörelse() {
      var aktiv = synlig && !document.hidden;
      host.classList.toggle('vy-hero-vilar', !aktiv);
      if (!film) return;
      if (aktiv) { var p = film.play(); if (p && p.catch) p.catch(function () {}); }
      else film.pause();
    }
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (poster) {
        synlig = poster[0].isIntersecting;
        uppdateraRörelse();
      }).observe(host);
    }
    document.addEventListener('visibilitychange', uppdateraRörelse);

    if (film) {
      film.addEventListener('playing', function () {
        film.classList.add('spelar');
        /* Filmen ligger ovanpå bilden. Att låta bilden zooma bakom den
           är att rita något ingen ser, varje bildruta. */
        host.classList.add('vy-hero-film');
      });
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

     FEMTE OMGÅNGEN, efter Leos genomgång 2026-09-24: "På boka pass
     ska man bara ha en tom kalender framför sig. Man trycker på
     dagen, sen står det vilket ämne, tiden, antal barn. Sen föreslår
     man tiden till sin studiehjälpare."

     Det är alltså inte längre en bokning utan ett FÖRSLAG. Varje pass
     börjar som requested och blir ett pass först när studiehjälparen
     accepterat det, eller när familjen accepterat hjälparens
     motförslag. Studiehjälparens veckoschema finns inte kvar, så det
     finns inga "lediga dagar" att pricka — varje dag framåt går att
     trycka på.

     Två saker står kvar från de fyra tidigare omgångarna, med flit:

       · TIMMAR SOM REDAN ÄR BOKADE hos studiehjälparen går inte att
         välja. De är inte ett förslag utan en krock, och databasen
         hade svarat 23P01 ändå. Vyn tutor_busy_slots säger bara ATT
         timmen är tagen, aldrig av vem.
       · PRISET STÅR VID KNAPPEN. Det är inget val, men antalet barn
         ändrar det, och ingen ska föreslå ett pass utan att se vad
         det kostar.

     Borta: veckoschemats prickar, format och plats, rabattkoden och
     "önska en annan tid" — det sista för att allt nu ÄR ett önskemål.
     När betalningen sker står inte här: den vägen byggs om för sig.

     Tidigare omgångar, för den som undrar: tre rullgardiner och en
     månadskalender; fyra numrerade steg; en veckovy; en kalender med
     prickar och ett önskemålsfält under.

     opts:
       host   — elementet
       amnen  — [] ämnen att välja mellan
       amne   — förvalt ämne
       pris   — kr per timme, gäller bara innan katalogen laddats
       hos    — studiehjälparens namn
       tjanst — tjänstens kod, eller en funktion som ger den
       ladda  — async () => { upptagna, tidigare } | { spärr }
       boka   — async ({datum, tid, minuter, amne, barn})
                => 'felmeddelande' | { status }
     ============================================================ */

  /* Timmarna ett förslag kan ligga på, varje dag i veckan. Hela timmar,
     eftersom allt bokas och faktureras i hela timmar; 07–22 för att
     ett pass som börjar 21 ska sluta senast 22.

     Formen är tutor_availability:s med flit. Då kan NX.tiderFörDatum,
     med sin regel om minst en timme fram idag, användas som den är i
     stället för att skrivas en gång till här — och flyttaRuta i
     nextrum-studie.js använder samma lista, så att ett förslag och
     ett motförslag erbjuder samma timmar. */
  var HELA_DAGEN = [0, 1, 2, 3, 4, 5, 6].map(function (d) {
    return { weekday: d, start_time: '07:00', end_time: '22:00' };
  });

  function bokning(opts) {
    var o = opts || {};
    var host = o.host;
    if (!host) return null;

    var LANGDER = [[60, '1 timme'], [120, '2 timmar'], [180, '3 timmar']];
    /* Hur långt fram kalendern går. Längre än så är inte ett förslag,
       det är en gissning om terminen. */
    var MANADER_FRAM = 3;

    var st = {
      amne: o.amne || (o.amnen || [])[0] || 'Matematik',
      minuter: 60,
      /* Hur många barn passet gäller. Tillägget är EN summa oavsett
         om de är två eller tre — regeln och taket står i tjanster. */
      barn: 1,
      manad: null,
      dag: null,
      tid: null,
      besked: null,
      /* Id:t på förslaget som just skickades, för länken "Visa
         förslaget" i kvittot. */
      nyttId: null,
      /* Var man ses (Leo 2026-09-24: studiehjälparen ska se "var man
         ska ses"). Fas 15.1 tog bort frågan, och ett förslag hade då
         ingen plats alls — studiehjälparen fick fråga i chatten varje
         gång. Förval ur barnets format och förra passets adress. */
      format: null,
      plats: '',
      not: '',
      /* Ett fel står i st, inte bara i DOM:en — ladda() ritar om hela
         ytan direkt efteråt, och då försvann texten innan någon
         hunnit läsa den. */
      fel: null,
      data: { upptagna: new Set(), tidigare: [] },
      spärr: null
    };

    /* Förra passet bestämmer förvalen. En familj som alltid tar matte
       i två timmar ska inte välja det varje gång. */
    function ärvFrånTidigare() {
      var t = (st.data.tidigare || []).slice().sort(function (a, b) {
        return String(b.wanted_date || '').localeCompare(String(a.wanted_date || ''));
      });
      var f = t[0];
      if (!f) return false;
      if (f.subject && (o.amnen || []).indexOf(f.subject) !== -1) st.amne = f.subject;
      if (f.duration_min) st.minuter = f.duration_min;
      return true;
    }

    var FORMAT = [['Online', 'Online'], ['På plats', 'På plats']];
    /* På plats kräver en adress. Utan den vet studiehjälparen inte
       vart hen ska, och det är precis den fråga förslaget ska svara
       på. Online behöver ingen: länken skickas i chatten. */
    function platsOk() {
      return st.format === 'Online' || (st.format === 'På plats' && st.plats.trim().length >= 3);
    }

    function timmar() { return Math.max(1, Math.round(st.minuter / 60)); }
    function längdText() { var t = timmar(); return t === 1 ? '1 timme' : t + ' timmar'; }

    /* Vilken tjänst det gäller. o.tjanst får vara en funktion: vyn
       skapar ytan innan katalogen hunnit laddas, och ett värde som
       lästes då hade frusit fast på reservkatalogens val. */
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
    /* Timpriset ur katalogen — samma källa som faktureringen tar betalt
       efter. o.pris (kronor, ur konfigurationen) gäller bara innan
       katalogen finns. Allt räknas i ÖRE; kronorna härleds ur det. */
    function timprisOre() {
      var t = tjanstRad();
      if (t && t.pris_per_timme_ore) return Number(t.pris_per_timme_ore);
      return (o.pris || 379) * 100;
    }
    function bruttoOre() {
      var perTimme = timprisOre() + (st.barn > 1 ? extraOre() : 0);
      return Math.round(perTimme * st.minuter / 60);
    }

    /* ---------- vilka timmar som går ---------- */

    /* Ett pass på två timmar upptar två timmar. Att bara titta på
       starttimmen hade erbjudit 16:00 fast 17:00 var bokat. */
    function upptagen(datum, tid) {
      var h = tim(tid), t = timmar();
      for (var i = 0; i < t; i++) {
        if (st.data.upptagna.has(datum + '|' + tvasiffrig(h + i) + ':00')) return true;
      }
      return false;
    }

    function tider(datum) {
      return NX.tiderFörDatum(datum, HELA_DAGEN, [], st.minuter)
        .filter(function (t) { return !upptagen(datum, t); });
    }

    /* ---------- knapprader ---------- */

    function chips(id, poster, valt, etikett) {
      return '<div class="vy-val" id="' + id + '" role="group" aria-label="' + esc(etikett) + '">'
        + poster.map(function (p) {
          return '<button type="button" data-v="' + esc(String(p[0])) + '" aria-pressed="'
            + (String(p[0]) === String(valt) ? 'true' : 'false') + '">' + esc(p[1]) + '</button>';
        }).join('') + '</div>';
    }

    function rad(etikett, innehåll) {
      return '<div class="bk-valrad"><span class="bk-valrad-et">' + esc(etikett) + '</span>'
        + innehåll + '</div>';
    }

    function dagNamn(iso) {
      return DAGAR_LANGA[(new Date(iso + 'T12:00:00').getDay() + 6) % 7] + ' ' + datumText(iso);
    }

    /* Valen visas först när en dag är vald. Leo: "Man trycker på
       dagen, sen står det vilket ämne, tiden, antal barn." En tom
       kalender med fyra rader val under är inte en tom kalender. */
    function dagPanel() {
      /* Tom tills en dag är vald. Vad man ska göra står i stegen
         överst; samma mening två gånger är en mening för mycket. */
      if (!st.dag) return '';
      var dagens = tider(st.dag);
      var barnPoster = [];
      for (var i = 1; i <= barnTak(); i++) barnPoster.push([i, i === 1 ? '1 barn' : i + ' barn']);

      return '<p class="bk-kal-dagnamn">' + esc(dagNamn(st.dag)) + '</p>'
        + '<div class="bk-val">'
        + rad('Ämne', chips('bk-amnen', (o.amnen || []).map(function (a) { return [a, a]; }), st.amne, 'Ämne'))
        + rad('Längd', chips('bk-langder', LANGDER.map(function (l) { return [String(l[0]), l[1]]; }),
            String(st.minuter), 'Längd'))
        + rad('Tid', tidsrad({
            datum: st.dag,
            tider: dagens,
            vald: st.tid,
            tom: 'Inga tider kvar den dagen för ' + längdText() + '. Välj en annan dag eller en kortare längd.'
          }))
        + (barnTak() > 1 ? rad('Antal barn', chips('bk-barn', barnPoster, st.barn, 'Antal barn')) : '')
        + rad('Var ses ni?', chips('bk-format', FORMAT, st.format, 'Var ses ni?'))
        + (st.format === 'På plats'
          ? '<div class="bk-valrad bk-faltrad"><label class="bk-valrad-et" for="bk-plats">Adress</label>'
            + '<input class="inp" id="bk-plats" maxlength="160" autocomplete="street-address"'
            + ' placeholder="Gatuadress, eller t.ex. Stadsbiblioteket" value="' + esc(st.plats) + '"></div>'
          : '')
        + '<div class="bk-valrad bk-faltrad"><label class="bk-valrad-et" for="bk-not">Till studiehjälparen</label>'
        + '<input class="inp" id="bk-not" maxlength="300"'
        + ' placeholder="Valfritt — t.ex. provet på fredag, kapitel 4" value="' + esc(st.not) + '"></div>'
        + '</div>';
    }

    /* Tre steg överst, och en mening om vad som händer nu. Leo
       2026-09-24: "lägg till så man förstår vad man ska göra
       tydligare". Stegen följer valen: det man gjort är ibockat, det
       man står på är markerat. */
    function stegRad() {
      var ett = !!st.dag, två = ett && !!st.tid && platsOk();
      var nu = !ett ? 1 : !två ? 2 : 3;
      var vem = o.hos || 'er studiehjälpare';
      function steg(n, text, klar) {
        return '<li class="bk-steg' + (klar ? ' ar-klar' : '') + (nu === n ? ' ar-nu' : '') + '"'
          + (nu === n ? ' aria-current="step"' : '') + '><b aria-hidden="true">' + (klar ? '✓' : n) + '</b>'
          + esc(text) + '</li>';
      }
      var hjälp = nu === 1
        ? 'Tryck på en dag i kalendern. Varje dag framåt går att välja.'
        : nu === 2
          ? (!st.tid ? 'Välj ämne, hur länge och en tid. Timmar som redan är bokade hos ' + vem + ' syns inte.'
            : 'Skriv var ni ses — eller välj Online.')
          : 'Allt är valt. Tryck på Föreslå tiden, så svarar ' + vem + ' med ett ja eller en annan tid.';
      return '<ol class="bk-stegrad" aria-label="Så föreslår ni en tid">'
        + steg(1, 'Välj dag', ett) + steg(2, 'Ämne, tid och plats', två) + steg(3, 'Föreslå tiden', false)
        + '</ol><p class="bk-hjalp" aria-live="polite">' + esc(hjälp) + '</p>';
    }

    /* Kvittot efter att förslaget skickats. Står där dagens val stod,
       så att sidan inte krymper under fingret, och säger vad som
       händer härnäst. */
    function kvitto() {
      var vem = o.hos || 'er studiehjälpare';
      return '<div class="bk-kvitto" role="status">'
        + '<b>✓ Förslaget är skickat</b>'
        + '<p>' + esc(vem.charAt(0).toUpperCase() + vem.slice(1)) + ' accepterar tiden eller föreslår en annan. '
        + 'Ni får ett mejl när hen svarat, och passet står under Mina lektioner så länge.</p>'
        + '<div class="bk-kvitto-knappar">'
        + (st.nyttId ? '<a class="btn btn-primary btn-sm" href="#pass/' + esc(st.nyttId) + '">Visa förslaget</a>' : '')
        + '<button type="button" class="btn btn-ghost btn-sm" data-bk-igen>Föreslå en tid till</button>'
        + '</div></div>';
    }

    function sammanfattning() {
      if (!st.dag) return '';
      var vald = !!st.tid;
      var klar = vald && platsOk();
      var vem = o.hos || 'Er studiehjälpare';
      var d = new Date(st.dag + 'T12:00:00');
      var när = vald
        ? DAGAR_KORTA[(d.getDay() + 6) % 7] + ' ' + datumText(st.dag) + ' kl. ' + st.tid.slice(0, 5)
        : null;
      return '<div class="bk-sum' + (vald ? ' ar-vald' : '') + '">'
        + '<div class="bk-sum-vad">'
        + (vald
          ? '<b>' + esc(när) + '</b>'
            + '<span>' + esc([st.amne, längdText(), st.barn > 1 ? st.barn + ' barn' : null,
                st.format === 'På plats' ? (st.plats.trim() || 'Adress saknas') : st.format]
                .filter(Boolean).join(' · ')) + '</span>'
          : '<b>Välj en tid</b>'
            + '<span>' + esc(vem + ' accepterar tiden eller föreslår en annan.') + '</span>')
        + '</div>'
        + '<div class="bk-sum-pris"><b>' + esc(kr(bruttoOre() / 100)) + '</b>'
        + '<span>' + esc(längdText()) + '</span></div>'
        + '<button class="btn btn-primary" id="bk-boka" type="button"'
        + (klar ? '' : ' disabled') + '>Föreslå tiden</button>'
        + '</div>';
    }

    function rita() {
      if (!st.manad) st.manad = månadFör(idagISO());
      if (st.spärr) {
        host.innerHTML = '<div class="bk">' + st.spärr + '</div>';
        return;
      }
      var idag = idagISO();

      var kalender = manad({
        manad: st.manad,
        valt: st.dag,
        prefix: 'bk',
        minManad: månadFör(idag),
        maxManad: plusMånader(månadFör(idag), MANADER_FRAM - 1),
        /* Ingen prick. Utan schema finns inga dagar som är mer lediga
           än andra, och en prick på varje dag är ingen upplysning.
           Klickbar är varje dag med minst en timme kvar som inte är
           upptagen. */
        dag: function (iso) {
          return { klickbar: iso >= idag && tider(iso).length > 0, prick: false };
        }
      });

      host.innerHTML = '<div class="bk">'
        + '<div class="bk-guide">' + stegRad() + '</div>'
        + '<div class="bk-kal">'
        + '<div class="bk-kal-manad">' + kalender + '</div>'
        + '<div class="bk-kal-dag">' + (st.besked ? kvitto() : dagPanel()) + '</div>'
        + '</div>'
        + '<div class="bk-sumhus">' + (st.besked ? '' : sammanfattning()) + '</div>'
        /* .show, inte ett eget attribut: .ok-msg är display:none tills
           klassen sitter där, precis som NX.säg sätter den. */
        + '<p class="ok-msg' + (st.fel ? ' show is-err' : '') + '" id="bk-msg">'
        + (st.fel ? esc(st.fel) : '') + '</p>'
        + '</div>';
    }

    /* Allt utom månaden. Ett tryck på en tid, ett ämne eller en längd
       ritade förut om hela ytan — fyrtiotvå dagknappar, pilarna och
       rubriken — för att en knapp skulle bli mörk. Månaden ritas nu
       bara när månaden eller de upptagna timmarna ändras; den valda
       dagen markeras på knappen som redan finns. */
    function ritaDel() {
      var guide = host.querySelector('.bk-guide');
      var panel = host.querySelector('.bk-kal-dag');
      var sum = host.querySelector('.bk-sumhus');
      if (st.spärr || !guide || !panel || !sum) { rita(); return; }
      /* Ämnesraden är en rad man drar i sidled på en telefon. Ritas
         den om hamnar den på första ämnet igen, och den som dragit
         fram Engelska och tryckt på en tid såg raden rycka tillbaka. */
      var ämnen = host.querySelector('#bk-amnen');
      var sidled = ämnen ? ämnen.scrollLeft : 0;
      guide.innerHTML = stegRad();
      panel.innerHTML = st.besked ? kvitto() : dagPanel();
      sum.innerHTML = st.besked ? '' : sammanfattning();
      ämnen = host.querySelector('#bk-amnen');
      if (ämnen && sidled) ämnen.scrollLeft = sidled;
      var msg = host.querySelector('#bk-msg');
      if (msg) { msg.className = 'ok-msg' + (st.fel ? ' show is-err' : ''); msg.textContent = st.fel || ''; }
      Array.prototype.forEach.call(host.querySelectorAll('.mv-dag'), function (d) {
        d.setAttribute('aria-pressed', d.dataset.datum === st.dag ? 'true' : 'false');
      });
    }

    /* Vilka dagar som går att trycka på, på knapparna som redan finns.
       En annan längd ändrar det (en kväll med en timme kvar rymmer
       inte två), men att rita om hela månaden för det byter ut
       fyrtiotvå knappar under fingret. */
    function uppdateraDagar() {
      var idag = idagISO();
      Array.prototype.forEach.call(host.querySelectorAll('.mv-dag[data-datum]'), function (d) {
        var iso = d.dataset.datum;
        d.disabled = !(iso >= idag && tider(iso).length > 0);
      });
    }

    /* Allt som ritas om efter ett tryck ritas om med det man tryckte
       i kvar på samma ställe på skärmen. Leo 2026-09-24: "det hoppar
       på mobilen när man väljer längd och tid". Stegen ovanför växte
       med ett steg och en längre hjälprad när en tid valdes, och
       Safari — som saknar scroll anchoring — lät allt under glida
       nedåt 69 px. Stegen har nu samma höjd hela vägen, men ankaret
       står kvar: nästa sak som ändrar höjd ovanför ska inte kunna
       göra om samma fel. */
    function stilla(ankare, jobb) {
      NXStudie.håll(ankare || host.querySelector('.bk-kal-dag'), jobb);
    }

    /* Bara det som hänger på texten i ett fält: stegen, hjälpraden och
       kvittoraden. Panelen med fältet ritas INTE om — då hade fokus
       och tangentbordet försvunnit mitt i ett ord. */
    function ritaText() {
      var guide = host.querySelector('.bk-guide');
      var sum = host.querySelector('.bk-sumhus');
      if (guide) guide.innerHTML = stegRad();
      if (sum && !st.besked) sum.innerHTML = sammanfattning();
    }

    /* Ett element som hamnat under skärmkanten dras upp så att det
       syns — aldrig nedåt i sidan, aldrig uppåt förbi det man tittar
       på. Leo: "när man trycker på knappar skickas man uppåt". */
    function visaOmDoldt(el) {
      if (!el) return;
      var r = el.getBoundingClientRect();
      if (r.top > window.innerHeight - 140) {
        NXStudie.scrollaTill(window.scrollY + r.top - window.innerHeight * 0.62);
      }
    }

    /* ---------- val ---------- */

    function väljDag(iso) {
      st.besked = null; st.nyttId = null; st.fel = null;
      st.dag = iso;
      if (st.tid && tider(iso).indexOf(st.tid) === -1) st.tid = null;
      stilla(host.querySelector('.bk-kal'), ritaDel);
      /* På en telefon ligger dagens val under kalendern. Syns de inte
         alls efter trycket har ingenting hänt, till synes. */
      visaOmDoldt(host.querySelector('.bk-kal-dagnamn'));
    }

    function byteMånad(steg) {
      var idag = idagISO();
      var ny = plusMånader(st.manad, steg);
      if (ny < månadFör(idag)) return;
      if (ny > plusMånader(månadFör(idag), MANADER_FRAM - 1)) return;
      st.manad = ny;
      rita();
    }

    host.addEventListener('click', function (e) {
      var tid = e.target.closest('.mv-tid');
      if (tid && !tid.disabled) {
        st.besked = null; st.fel = null;
        st.tid = st.tid === tid.dataset.tid ? null : tid.dataset.tid;
        stilla(null, ritaDel);
        return;
      }

      if (e.target.closest('[data-bk-igen]')) {
        st.besked = null; st.nyttId = null;
        ritaDel();
        return;
      }

      var dag = e.target.closest('.mv-dag');
      if (dag && !dag.disabled) { väljDag(dag.dataset.datum); return; }

      if (e.target.closest('#bk-forr')) { byteMånad(-1); return; }
      if (e.target.closest('#bk-nasta')) { byteMånad(1); return; }

      var val = e.target.closest('.vy-val button[data-v]');
      if (val) {
        /* Ett eget val går före förra passets förval. */
        st.ärvt = true;
        var grupp = val.closest('.vy-val').id;
        if (grupp === 'bk-amnen') st.amne = val.dataset.v;
        else if (grupp === 'bk-barn') st.barn = Number(val.dataset.v) || 1;
        else if (grupp === 'bk-format') { st.format = val.dataset.v; st.formatValt = true; }
        else if (grupp === 'bk-langder') {
          st.minuter = Number(val.dataset.v);
          /* Längden ändrar vilka tider som ryms. En vald tid som inte
             längre får plats släpps, annars föreslår man två timmar i
             ett hål som bara rymmer en. */
          if (st.dag && st.tid && tider(st.dag).indexOf(st.tid) === -1) st.tid = null;
        }
        /* En annan längd ändrar vilka dagar som har tider kvar. Förut
           ritades hela ytan om för det; nu slås dagarna av och på där
           de står. */
        stilla(null, function () {
          ritaDel();
          if (grupp === 'bk-langder') uppdateraDagar();
        });
        return;
      }

      if (e.target.closest('#bk-boka')) skicka();
    });

    host.addEventListener('input', function (e) {
      if (e.target.id === 'bk-plats') { st.plats = e.target.value; ritaText(); }
      else if (e.target.id === 'bk-not') { st.not = e.target.value; }
    });

    /* Svaret från o.boka: en sträng är ett fel, ett objekt med status
       säger vad databasen gjorde av förslaget. */
    function tolka(svar) {
      if (typeof svar === 'string') return { fel: svar };
      return { status: svar && svar.status ? svar.status : null, id: svar && svar.id ? svar.id : null };
    }

    function skicka() {
      var knapp = $('#bk-boka', host);
      if (!st.dag || !st.tid || !platsOk()) return;
      st.besked = null; st.fel = null;
      NXStudie.medan(knapp, 'Skickar…', async function () {
        var r = tolka(await o.boka({
          datum: st.dag, tid: st.tid, minuter: st.minuter, amne: st.amne, barn: st.barn,
          format: st.format,
          plats: st.format === 'På plats' ? st.plats.trim() : null,
          not: st.not.trim() || null
        }));
        if (r.fel) {
          /* Laddas om så att en timme som hann tas försvinner ur valet.
             Felet ritas från st. */
          st.fel = r.fel;
          await ladda();
          return;
        }
        /* Kvittot direkt, när databasen sagt ja — inte efter att listan
           och de upptagna timmarna hämtats om. Förut väntade knappen på
           tre frågor i rad och stod på "Skickar…" i en sekund efter att
           förslaget redan låg i databasen. Omladdningen sker bakom. */
        st.besked = true;
        st.nyttId = r.id;
        st.dag = null; st.tid = null; st.barn = 1; st.not = '';
        ritaDel();
        var kv = host.querySelector('.bk-kvitto');
        if (kv) {
          var ruta = kv.getBoundingClientRect();
          if (ruta.top < 70 || ruta.bottom > window.innerHeight) NXStudie.visaÖverst(kv);
        }
        ladda();
      });
    }

    async function ladda() {
      var d = await o.ladda();
      st.data = {
        upptagna: d.upptagna || new Set(),
        tidigare: d.tidigare || []
      };
      st.spärr = d.spärr || null;
      /* Platsen ärvs tills man själv valt. Ett barn som byts ger ett
         nytt förval — men inte över ett val som redan gjorts. */
      if (d.forval && !st.formatValt) {
        st.format = d.forval.format || null;
        if (!st.plats) st.plats = d.forval.plats || '';
      }
      /* En gång, första gången det finns något att ärva. Att ärva om
         vid varje omladdning hade skrivit över ett val användaren
         precis gjort. */
      if (!st.ärvt && ärvFrånTidigare()) st.ärvt = true;
      /* En vald timme som hann bokas av någon annan släpps — annars
         stod den kvar i sammanfattningen med knappen tänd. */
      if (st.dag && !tider(st.dag).length) { st.dag = null; st.tid = null; }
      if (st.dag && st.tid && tider(st.dag).indexOf(st.tid) === -1) st.tid = null;
      rita();
    }

    rita();

    return {
      ladda: ladda,
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

  /* ============================================================
     STAPELGRAFEN (Fas 9.3)

     Låg i tre kopior: nextrum-admin-oversikt.js, nextrum-larare-vy.js
     och nextrum-studie-vy.js hade var sin sexMånader och var sin
     innerHTML med .graf-stapel. De hade redan börjat glida isär —
     adminvyn hade fått en not under grafen och ett format för
     kronor, de andra två inte.

     ALLTID SEX STAPLAR, ÄVEN TOMMA. En graf som byter bredd med
     datan går inte att jämföra med sig själv nästa månad, och det
     är hela poängen med att titta på den.

     format(v) gör om värdet till texten över stapeln. Utan den
     ritades ören som ören, och "75800" över en stapel säger
     ingenting.

     not är antingen en text som alltid står kvar, eller
     {nagot, inget} när den tomma grafen ska säga något annat än den
     fyllda. De tre vyerna hade olika texter för tomt läge, och en
     delad komponent som skriver över dem hade varit en försämring
     förklädd till städning. false eller utelämnad: ingen not.
     ============================================================ */

  /* n månader bakåt till och med innevarande, som [{nyckel, namn,
     antal}]. nyckel är 'ÅÅÅÅ-MM', samma form som wanted_date och
     period börjar med, så att den går att jämföra med slice(0, 7). */
  function sexMånader(n) {
    var ut = [];
    var antalMånader = typeof n === 'number' && n > 0 ? n : 6;
    var nu = new Date();
    for (var i = antalMånader - 1; i >= 0; i--) {
      var d = new Date(nu.getFullYear(), nu.getMonth() - i, 1);
      ut.push({
        nyckel: d.getFullYear() + '-' + tvasiffrig(d.getMonth() + 1),
        namn: NX.MANADER[d.getMonth()].slice(0, 3),
        antal: 0
      });
    }
    return ut;
  }

  function graf(host, månader, not, format) {
    if (!host) return;
    var högst = 1;
    var något = false;
    månader.forEach(function (m) {
      if (m.antal > högst) högst = m.antal;
      if (m.antal) något = true;
    });
    host.innerHTML = '<div class="graf">' + månader.map(function (m, i) {
      return '<div class="graf-stapel' + (i === månader.length - 1 ? ' nu' : '') + '">'
        + '<b>' + esc(format ? format(m.antal) : String(m.antal)) + '</b>'
        + '<i style="height:' + Math.round((m.antal / högst) * 100) + '%"></i>'
        + '<span>' + esc(m.namn) + '</span>'
        + '</div>';
    }).join('') + '</div>'
      + (!not ? ''
         : '<p class="graf-not">'
           + esc(typeof not === 'string' ? not : (något ? not.nagot : not.inget))
           + '</p>');
  }

  return {
    hälsning: hälsning,
    hälsningsrad: hälsningsrad,
    förnamn: förnamn,
    hero: hero,
    flikar: flikar,
    visaFör: visaFör,
    bokning: bokning,
    HELA_DAGEN: HELA_DAGEN,
    manad: manad,
    tidsrad: tidsrad,
    månadFör: månadFör,
    plusMånader: plusMånader,
    fallGrupp: fallGrupp,
    fallStall: fallStall,
    sexMånader: sexMånader,
    graf: graf,
    DAGAR_LANGA: DAGAR_LANGA,
    DAGAR_KORTA: DAGAR_KORTA
  };
})();
