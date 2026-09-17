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
     VECKOVYN

     Sju kolumner, en per dag, med lediga timmar som knappar. Den
     används på två ställen som ser lika ut för att de ÄR lika:
     familjen som bokar en tid, och studiehjälparen som föreslår en.
     Två kopior av samma rutnät hade glidit isär på en vecka.

     Det här är en HTML-byggare, inte en komponent med eget liv.
     Båda vyerna ritar om hela sin yta när något ändras, och två
     ritloopar som äger samma element är ett fel som syns först när
     någon klickar snabbt. Klicken fångas av vyn själv:
     .bk-slot[data-datum][data-tid], #bk-forr, #bk-nasta, #bk-hoppa.
     ============================================================ */

  function måndagen(iso) {
    var d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return NX.isoFor(d);
  }
  function plusDagar(iso, n) {
    var d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return NX.isoFor(d);
  }
  function idagISO() { return NX.isoFor(new Date()); }

  function veckoRubrik(vecka) {
    var slut = plusDagar(vecka, 6);
    var a = Number(vecka.slice(8, 10)), b = Number(slut.slice(8, 10));
    var mA = NX.MANADER[Number(vecka.slice(5, 7)) - 1] || '';
    var mB = NX.MANADER[Number(slut.slice(5, 7)) - 1] || '';
    return mA === mB ? a + '–' + b + ' ' + mA : a + ' ' + mA + ' – ' + b + ' ' + mB;
  }

  function veckoEtikett(vecka) {
    if (vecka === måndagen(idagISO())) return 'Den här veckan';
    if (vecka === plusDagar(måndagen(idagISO()), 7)) return 'Nästa vecka';
    return '';
  }

  /* o:
       vecka      — måndagens datum, ISO
       tider      — funktion(datum) => [{ tid, upptagen }]
       vald       — { datum, tid } eller null
       veckorFram — hur långt fram pilarna går
       hoppTill   — datum att erbjuda när veckan är tom, eller null
       tomText    — vad som står när veckan är tom och inget hopp finns
       upptagenText — vad en bokad timme heter i skärmläsaren */
  function veckovy(o) {
    var idag = idagISO();
    var vald = o.vald || {};
    var kolumner = '', lediga = 0;

    for (var i = 0; i < 7; i++) {
      var datum = plusDagar(o.vecka, i);
      var tider = o.tider(datum) || [];
      lediga += tider.filter(function (t) { return !t.upptagen; }).length;

      var knappar = tider.length
        ? tider.map(function (t) {
            var ärVald = vald.datum === datum && vald.tid === t.tid;
            return '<button type="button" class="bk-slot' + (t.upptagen ? ' ar-upptagen' : '') + '"'
              + (t.upptagen ? ' disabled title="' + esc(o.upptagenText || 'Redan bokad') + '"'
                + ' aria-label="' + esc(t.tid.slice(0, 5) + ', ' + (o.upptagenText || 'redan bokad')) + '"' : '')
              + ' data-datum="' + datum + '" data-tid="' + t.tid + '"'
              + ' aria-pressed="' + (ärVald ? 'true' : 'false') + '">'
              + esc(t.tid.slice(0, 5)) + '</button>';
          }).join('')
        : '<span class="bk-dag-tom" aria-hidden="true">–</span>';

      kolumner += '<div class="bk-dag' + (datum === idag ? ' ar-idag' : '')
        + (datum < idag ? ' ar-forbi' : '') + '">'
        + '<span class="bk-dag-namn">' + esc(DAGAR_KORTA[i].toLowerCase())
        + '<b>' + Number(datum.slice(8, 10)) + '</b></span>'
        + '<div class="bk-dag-tider">' + knappar + '</div>'
        + '</div>';
    }

    var tom = '';
    if (!lediga) {
      tom = '<p class="bk-tomvecka">Inga lediga timmar den här veckan.'
        + (o.hoppTill
          ? ' <button type="button" class="bk-lank" id="bk-hoppa" data-datum="' + o.hoppTill + '">'
            + 'Hoppa till ' + esc(datumText(o.hoppTill)) + '</button>'
          : (o.tomText ? ' ' + esc(o.tomText) : ''))
        + '</p>';
    }

    var första = o.vecka <= måndagen(idag);
    var sista = o.vecka >= plusDagar(måndagen(idag), (o.veckorFram || 8) * 7);

    return '<div class="bk-vecka">'
      + '<div class="bk-veckhuvud">'
      + '<button type="button" class="bk-pil" id="bk-forr"' + (första ? ' disabled' : '')
      + ' aria-label="Föregående vecka">'
      + '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M7.5 2.5 4 6l3.5 3.5"/></svg></button>'
      + '<span class="bk-veckhuvud-text"><b>' + esc(veckoRubrik(o.vecka)) + '</b>'
      + (veckoEtikett(o.vecka) ? '<span>' + esc(veckoEtikett(o.vecka)) + '</span>' : '') + '</span>'
      + '<button type="button" class="bk-pil" id="bk-nasta"' + (sista ? ' disabled' : '')
      + ' aria-label="Nästa vecka">'
      + '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5 8 6l-3.5 3.5"/></svg></button>'
      + '</div>'
      + '<div class="bk-dagar">' + kolumner + '</div>'
      + tom
      + '</div>';
  }

  /* ============================================================
     VECKOSCHEMAT

     Studiehjälparens egna tider. tutor_availability är VECKOVIS —
     en rad säger "tisdagar 17–21", inte "tisdagen den 22 september"
     — och det här rutnätet visar precis det som sparas.

     Förut redigerades samma sak i en månadskalender: man öppnade en
     dag, tryckte på en timme, och ändrade i tysthet varje tisdag
     hela terminen. Rutnätet tar bort gissningen.

     Timmarna utanför 07–22 ritas bara om någon lagt in dem. En tid
     man inte ser går inte att ta bort.

     Klicken fångas av vyn: .vs-ruta[data-dag][data-timme].
     ============================================================ */
  function veckoschema(o) {
    var från = 7, till = 22;
    (o.tillgang || []).forEach(function (r) {
      var s = Number(String(r.start_time).slice(0, 2));
      var e = Number(String(r.end_time).slice(0, 2));
      if (String(r.end_time).slice(3, 5) !== '00') e += 1;
      if (s < från) från = s;
      if (e > till) till = e;
    });

    var perDag = [];
    for (var d = 0; d < 7; d++) perDag.push(o.timmar(d));

    var huvud = '<div class="vs-rad vs-huvud"><span class="vs-tid" aria-hidden="true"></span>'
      + DAGAR_KORTA.map(function (namn) {
          return '<span class="vs-dag">' + esc(namn.toLowerCase()) + '</span>';
        }).join('')
      + '</div>';

    var rader = '';
    for (var h = från; h < till; h++) {
      var rutor = '';
      for (var i = 0; i < 7; i++) {
        var på = perDag[i].has(h);
        rutor += '<button type="button" class="vs-ruta" data-dag="' + i + '" data-timme="' + h + '"'
          + ' aria-pressed="' + (på ? 'true' : 'false') + '"'
          + ' aria-label="' + esc(DAGAR_LANGA[i] + ' klockan ' + tvasiffrig(h)) + '"></button>';
      }
      rader += '<div class="vs-rad"><span class="vs-tid">' + tvasiffrig(h) + '</span>' + rutor + '</div>';
    }

    return '<div class="vs">' + huvud + rader + '</div>';
  }

  /* ============================================================
     BOKNINGEN

     TREDJE OMGÅNGEN. Först låg här tre rullgardiner och en
     månadskalender. Sedan blev det fyra steg med ett öppet i taget,
     vilket gjorde varje val tydligt men bokningen svår att överblicka:
     man såg sex förslag och en utfällning, aldrig veckan.

     Nu är allt EN skärm:

       · ämne, längd och format som knappar överst
       · veckan under, en kolumn per dag, lediga timmar som knappar
       · en rad längst ned med vad du valt, vad det kostar och Boka

     Veckan ersätter både förslagslistan och månadskalendern. Man ser
     studiehjälparens vecka som den faktiskt är — tre kvällar och en
     lördag — i stället för trettio rutor där de flesta är tomma. Pilar
     bläddrar en vecka i taget, och är veckan tom finns en knapp rakt
     till nästa dag med en ledig timme.

     Bokade timmar står kvar, gråa och avstängda. "Redan bokad" och
     "jobbar inte då" är två olika besked, och den som ser skillnaden
     förstår varför tisdagen ser ut som den gör.

     opts:
       host     — elementet
       amnen    — [] ämnen att välja mellan
       amne     — förvalt ämne
       pris     — kr per timme
       hos      — studiehjälparens namn, för kvittoraden
       tjanst   — tjänstens kod, styr flerbarnstillägg och rabattkoder
       ladda    — async () => { tillgang, blockerade, upptagna, tidigare }
       boka     — async ({datum,tid,minuter,amne,format,plats,barn,kod,rabattOre})
                  => null | 'felmeddelande'
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
    /* Hur långt fram pilarna går. Längre än så är inte en bokning,
       det är en gissning om terminen. */
    var VECKOR_FRAM = 8;

    var st = {
      amne: o.amne || (o.amnen || [])[0] || 'Matematik',
      minuter: 60,
      format: 'På plats',
      /* Var ni ses. Frivillig: många vet redan, och den som inte vet
         ska inte hindras från att boka. Står den tom säger kvittot
         att platsen bestäms i chatten, i stället för att låtsas att
         frågan är avklarad. */
      plats: '',
      datum: null,
      tid: null,
      /* Hur många barn passet gäller. Tillägget är EN summa oavsett
         om de är två eller tre — regeln och taket står i tjanster,
         inte här, så priset går att ändra utan att röra koden. */
      barn: 1,
      /* Rabattkoden i tre delar: vad som står i fältet, vad servern
         svarade, och hur mycket det blev. Fältet ensamt räcker inte —
         en kod som skrivits men inte kontrollerats får inte se ut som
         en rabatt i kvittot. */
      kod: '',
      kodSvar: null,
      rabatt: 0,
      kodOppen: false,
      /* Beskedet efter en bokning. Det ligger utanför veckan, så att
         det överlever omritningen som följer på en lyckad bokning. */
      besked: null,
      vecka: null,
      /* Sant så fort användaren själv bläddrat. Då slutar
         omladdningen flytta tillbaka veckan under fingrarna. */
      veckaRörd: false,
      data: { tillgang: [], blockerade: [], upptagna: new Set(), tidigare: [] },
      spärr: null
    };

    /* Förra bokningen bestämmer förvalen. En familj som alltid
       bokar matte på plats ska inte välja matte på plats varje gång.
       tidigare[] kommer från o.ladda och är sorterad nyast först. */
    function ärvFrånTidigare() {
      var f = (st.data.tidigare || [])[0];
      if (!f) return;
      if (f.subject && (o.amnen || []).indexOf(f.subject) !== -1) st.amne = f.subject;
      if (f.duration_min) st.minuter = f.duration_min;
      if (f.format && FORMAT.indexOf(f.format) !== -1) st.format = f.format;
      if (f.location) st.plats = f.location;
    }

    function timmar() { return Math.max(1, Math.round(st.minuter / 60)); }

    /* Taket för antal barn kommer ur tjänstekatalogen. Saknas den —
       gammal sida, trasig hämtning — är svaret 1, och då ritas ingen
       väljare alls. */
    function barnTak() {
      var t = (typeof NXTjanster !== 'undefined' && NXTjanster.hitta)
        ? NXTjanster.hitta(o.tjanst || 'laxhjalp') : null;
      return t && t.extra_personer_max > 1 ? t.extra_personer_max : 1;
    }
    function extraOre() {
      var t = (typeof NXTjanster !== 'undefined' && NXTjanster.hitta)
        ? NXTjanster.hitta(o.tjanst || 'laxhjalp') : null;
      return (t && t.extra_personer_ore) || 0;
    }

    /* Bruttot i ÖRE, för det är vad servern räknar i. Kronorna i
       kvittot härleds ur den här siffran, aldrig tvärtom — två
       uträkningar av samma pris blir förr eller senare två priser. */
    function bruttoOre() {
      var tim2 = (o.pris || 379) * 100 + (st.barn > 1 ? extraOre() : 0);
      return Math.round(tim2 * st.minuter / 60);
    }
    function nettoOre() {
      return Math.max(0, bruttoOre() - (st.rabatt || 0));
    }
    function längdText() {
      var t = timmar();
      return t === 1 ? '1 timme' : t + ' timmar';
    }

    /* ---------- veckan ---------- */

    /* Ett pass på två timmar upptar två timmar. Att bara titta på
       starttimmen hade erbjudit 16:00 fast 17:00 var bokat. */
    function upptagen(datum, tid) {
      var h = tim(tid), t = timmar();
      for (var i = 0; i < t; i++) {
        if (st.data.upptagna.has(datum + '|' + tvasiffrig(h + i) + ':00')) return true;
      }
      return false;
    }

    function dagensTider(datum) {
      return NX.tiderFörDatum(datum, st.data.tillgang, st.data.blockerade, st.minuter)
        .map(function (t) { return { tid: t, upptagen: upptagen(datum, t) }; });
    }

    /* Nästa dag med en ledig timme. Används av knappen i en tom vecka,
       och för att välja vilken vecka man landar på. */
    function nästaLediga(från) {
      var f = NX.föreslåTider({
        tillgang: st.data.tillgang,
        blockerade: st.data.blockerade,
        upptagna: st.data.upptagna,
        tidigare: [],
        minuter: st.minuter,
        dagar: VECKOR_FRAM * 7,
        antal: 40
      });
      for (var i = 0; i < f.length; i++) if (!från || f[i].datum >= från) return f[i].datum;
      return null;
    }

    function sättStartvecka() {
      var första = nästaLediga(null);
      st.vecka = måndagen(första || idagISO());
    }

    function veckaHtml() {
      return veckovy({
        vecka: st.vecka,
        tider: dagensTider,
        vald: { datum: st.datum, tid: st.tid },
        veckorFram: VECKOR_FRAM,
        hoppTill: nästaLediga(plusDagar(st.vecka, 7)),
        tomText: 'Fråga i chatten när det passar er, så lägger studiehjälparen in fler tider.'
      });
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
       vilka koder som finns och ska inte veta det — kolla_rabattkod()
       svarar på en kod i taget och lämnar aldrig ut listan. */
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

    function rita() {
      /* Första ritningen sker innan tiderna hämtats. Veckan måste ändå
         ha ett värde — annars ritas ingen vecka alls och sidan står
         tom tills hämtningen är klar. */
      if (!st.vecka) st.vecka = måndagen(idagISO());
      if (st.spärr) {
        host.innerHTML = '<div class="bk">' + st.spärr + '</div>';
        return;
      }

      var vald = st.datum && st.tid;
      var påPlats = st.format === 'På plats';

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
          : '<b>Välj en tid</b><span>Tryck på en ledig timme i veckan ovanför.</span>')
        + '</div>'
        + '<div class="bk-sum-pris">' + pris
        + '<span>' + esc(längdText()) + ', betalas i efterskott</span></div>'
        + '<button class="btn btn-primary" id="bk-boka" type="button"'
        + (vald ? '' : ' disabled') + '>Boka passet</button>'
        + '</div>';

      host.innerHTML = '<div class="bk">'
        + val
        + veckaHtml()
        + (extra ? '<div class="bk-extra">' + extra + '</div>' : '')
        + sum
        + '<p class="ok-msg" id="bk-msg"></p>'
        /* .show, inte ett eget attribut: .ok-msg är display:none
           tills klassen sitter där, precis som NX.säg sätter den. */
        + '<p class="ok-msg' + (st.besked ? ' show' : '') + '" id="bk-besked">'
        + (st.besked ? esc(st.besked) : '') + '</p>'
        + '</div>';
    }

    /* ---------- val ---------- */

    function välj(datum, tid) {
      /* Ett nytt val betyder att man är på väg att boka igen. Att
         låta förra kvittot stå kvar under det hade läst som att
         det här passet redan var bokat. */
      st.besked = null;
      if (st.datum === datum && st.tid === tid) { st.datum = null; st.tid = null; }
      else { st.datum = datum; st.tid = tid; }
      rita();
    }

    function byteVecka(steg) {
      var ny = plusDagar(st.vecka, steg * 7);
      if (ny < måndagen(idagISO())) return;
      if (ny > plusDagar(måndagen(idagISO()), VECKOR_FRAM * 7)) return;
      st.vecka = ny;
      st.veckaRörd = true;
      rita();
    }

    /* Ingen omritning medan man skriver: rita() byter ut hela
       innerHTML, och fältet hade tappat både innehåll och fokus vid
       varje tangenttryck. Värdet läses ur st när ytan ritas om av
       något annat skäl. */
    host.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'bk-plats-falt') st.plats = e.target.value;
      /* Koden lagras i versaler. Servern jämför mot versaler, och att
         låta fältet visa något annat än det som skickas är ett fel som
         bara syns för den som skrev med gemener. */
      if (e.target && e.target.id === 'bk-kod-falt') {
        var nytt = e.target.value.toUpperCase();
        if (e.target.value !== nytt) e.target.value = nytt;
        st.kod = nytt;
      }
    });

    host.addEventListener('click', function (e) {
      var slot = e.target.closest('.bk-slot');
      if (slot && !slot.disabled) { välj(slot.dataset.datum, slot.dataset.tid); return; }

      if (e.target.closest('#bk-forr')) { byteVecka(-1); return; }
      if (e.target.closest('#bk-nasta')) { byteVecka(1); return; }

      var hopp = e.target.closest('#bk-hoppa');
      if (hopp) { st.vecka = måndagen(hopp.dataset.datum); st.veckaRörd = true; rita(); return; }

      var val = e.target.closest('.vy-val button[data-v]');
      if (val) {
        var grupp = val.closest('.vy-val').id;
        if (grupp === 'bk-amnen') { st.amne = val.dataset.v; rita(); }
        else if (grupp === 'bk-format') { st.format = val.dataset.v; rita(); }
        else if (grupp === 'bk-barn') {
          st.barn = Number(val.dataset.v) || 1;
          /* Bruttot ändras, alltså är rabatten uträknad på fel
             underlag. Den måste hämtas om — en procentrabatt på ett
             annat belopp är ett annat belopp. */
          if (st.rabatt > 0) { kollaKod(true); return; }
          rita();
        }
        else if (grupp === 'bk-langder') {
          st.minuter = Number(val.dataset.v);
          /* Längden ändrar vilka timmar som ryms. En vald tid som
             inte längre får plats måste släppas, annars bokar man
             två timmar i ett enda ledigt hål. */
          st.datum = null; st.tid = null;
          /* Och den ändrar bruttot, alltså rabatten. Se bk-barn. */
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

      if (e.target.closest('#bk-boka')) skicka();
    });

    /* Kontrollen går till funktionen kolla_rabattkod i databasen, som
       svarar på EN kod och aldrig lämnar ut listan. Rabatten den ger
       är också den servern räknar om vid inserten — klientens siffra
       är bara till för att visa något innan man trycker Boka.

       tyst = räkna om efter att bruttot ändrats, utan att blinka till
       med ett nytt meddelande om en kod användaren redan godkänt. */
    function kollaKod(tyst) {
      var kod = (st.kod || '').trim();
      if (!kod) { st.kodSvar = { giltig: false, orsak: 'Skriv en kod.' }; rita(); return; }
      if (typeof supa === 'undefined' || !supa) return;

      var knapp = $('#bk-kod-knapp', host);
      NXStudie.medan(knapp, tyst ? '' : 'Kollar…', async function () {
        var r = await supa.rpc('kolla_rabattkod', {
          p_kod: kod,
          p_tjanst: o.tjanst || 'laxhjalp',
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

    function skicka() {
      var knapp = $('#bk-boka', host), msg = $('#bk-msg', host);
      if (msg) NX.rensa(msg);
      if (!st.datum || !st.tid) return;
      st.besked = null;
      NXStudie.medan(knapp, 'Bokar…', async function () {
        var fel = await o.boka({
          datum: st.datum, tid: st.tid, minuter: st.minuter,
          amne: st.amne, format: st.format,
          plats: st.format === 'På plats' ? st.plats.trim() : '',
          barn: st.barn,
          /* Bara en kod som faktiskt gett rabatt skickas med. En kod
             som skrivits men inte godkänts ska inte följa med och
             räknas upp som använd. */
          kod: st.rabatt > 0 ? (st.kod || '').trim() : null,
          rabattOre: st.rabatt > 0 ? st.rabatt : null
        });
        if (fel) {
          var m = $('#bk-msg', host);
          if (m) NX.säg(m, fel, false);
          await ladda();
          return;
        }
        st.besked = 'Passet är önskat. Er studiehjälpare ser det direkt och bekräftar.';
        st.datum = null; st.tid = null;
        /* Koden är förbrukad på det här passet. Att låta den stå kvar
           i fältet hade sett ut som att nästa bokning också får den,
           och en kod med max antal användningar hade då lovat fel. */
        st.kod = ''; st.kodSvar = null; st.rabatt = 0; st.kodOppen = false; st.barn = 1;
        await ladda();
      });
    }

    async function ladda() {
      var d = await o.ladda();
      var första = !st.data.tidigare.length;
      st.data = {
        tillgang: d.tillgang || [],
        blockerade: d.blockerade || [],
        upptagna: d.upptagna || new Set(),
        tidigare: d.tidigare || []
      };
      st.spärr = d.spärr || null;
      /* Bara vid första laddningen. Att ärva om vid varje omladdning
         hade skrivit över ett val användaren precis gjort. */
      if (första) ärvFrånTidigare();
      /* Landa på en vecka som har något att erbjuda. En tom vecka som
         första intryck ser ut som att ingen tid finns alls. Har
         användaren själv bläddrat får veckan stå kvar. */
      if (!st.veckaRörd) sättStartvecka();
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
    veckovy: veckovy,
    veckoschema: veckoschema,
    måndagen: måndagen,
    plusDagar: plusDagar,
    fallGrupp: fallGrupp,
    fallStall: fallStall,
    DAGAR_LANGA: DAGAR_LANGA,
    DAGAR_KORTA: DAGAR_KORTA
  };
})();
