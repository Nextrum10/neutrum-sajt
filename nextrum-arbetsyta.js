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
     BOKNINGEN

     FÖRSTA OMGÅNGEN tog bort tre rullgardiner och en månadskalender
     och ersatte dem med lediga timmar som knappar. Det gjorde
     bokningen möjlig på ett klick.

     DEN HÄR OMGÅNGEN tar bort resten av formulärkänslan. Allt låg
     framme samtidigt — ämnen, längder, format, tider, kvitto — och
     ytan såg ut som en blankett även om den bara krävde ett klick.

     Fyra steg, ett öppet i taget:

       1  Vad ska ni göra      ämne
       2  När passar det       längd + lediga tider
       3  Hur vill ni ha det   online eller på plats
       4  Bekräfta             sammanfattning, pris, knapp

     Längden bor i steg 2 och inte i ett eget. Den styr vilka timmar
     som får plats, alltså måste den stå före tiderna — och ett eget
     steg för ett val de flesta aldrig ändrar vore ett steg för
     mycket.

     DET BLEV INTE LÅNGSAMMARE

     Steg 1 och 3 svarar sig själva från familjens förra bokning.
     Har man bokat Matematik online tidigare står det redan ifyllt,
     ihopfällt, med "Ändra" bredvid. Man landar alltså på steg 2 och
     är klar efter ett klick på en tid och ett på Boka — samma
     antal som förut.

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

    var LANGDER = [[60, '1 timme'], [120, '2 timmar'], [180, '3 timmar']];
    /* På plats står först, och är förvalet. Läxhjälpen är tänkt att
       ske hemma hos familjen eller någonstans de kommer överens om —
       online finns kvar för den som behöver det, men ska inte vara
       det man råkar boka för att det låg först. */
    var FORMAT = ['På plats', 'Online'];

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
      /* Beskedet efter en bokning. Det låg förut i steg 4, som
         fälls ihop och töms i samma andetag som bokningen lyckas —
         alltså försvann kvittot i samma klick som gjorde det sant.
         Här ligger det utanför stegen och överlever omritningen. */
      besked: null,
      /* Vilka steg användaren själv har bekräftat. Steg 1 och 3
         räknas som besvarade från start eftersom de har ett
         vettigt förval — men de får en bock först när de faktiskt
         stämmer, inte för att de är ifyllda. */
      svarat: { 1: true, 3: true },
      oppet: 2,
      data: { tillgang: [], blockerade: [], upptagna: new Set(), tidigare: [] },
      kal: null,
      spärr: null
    };

    /* Förra bokningen bestämmer förvalen. En familj som alltid
       bokar matte online ska inte välja matte online varje gång.
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
    function längdText() {
      var t = timmar();
      return t === 1 ? '1 timme' : t + ' timmar';
    }

    var BOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg>';

    function steg(nr, rubrik, sammanfattning, kropp, läge) {
      var klar = läge === 'klar', öppen = läge === 'oppen', låst = läge === 'last';
      return '<div class="bk-steg ' + (öppen ? 'ar-oppen' : klar ? 'ar-klar' : låst ? 'ar-last' : '')
        + '" data-bk-steg="' + nr + '">'
        + '<' + (låst ? 'div' : 'button type="button"') + ' class="bk-huvud"'
        + (låst ? '' : ' data-bk-oppna="' + nr + '" aria-expanded="' + (öppen ? 'true' : 'false') + '"')
        + '>'
        + '<span class="bk-nr">' + (klar ? BOCK : nr) + '</span>'
        + '<span class="bk-etikett"><b>' + esc(rubrik) + '</b>'
        + (sammanfattning && !öppen ? '<span>' + sammanfattning + '</span>' : '') + '</span>'
        + '<span class="bk-andra">Ändra</span>'
        + '</' + (låst ? 'div' : 'button') + '>'
        + '<div class="bk-kropp"' + (öppen ? '' : ' hidden') + '>' + kropp + '</div>'
        + '</div>';
    }

    function chips(id, poster, valt, etikett) {
      return '<div class="vy-val" id="' + id + '" role="group" aria-label="' + esc(etikett) + '">'
        + poster.map(function (p) {
          return '<button type="button" data-v="' + esc(String(p[0])) + '" aria-pressed="'
            + (String(p[0]) === String(valt) ? 'true' : 'false') + '">' + esc(p[1]) + '</button>';
        }).join('') + '</div>';
    }

    function tiderHtml() {
      if (st.spärr) return st.spärr;

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
        return NXStudie.tomt('Inga lediga tider de närmaste veckorna',
          'Er studiehjälpare har tider inlagda, men de är bokade eller för korta för '
          + längdText().toLowerCase() + '. Prova en kortare längd, eller fråga hen i chatten.');
      }

      return '<div class="vy-tidrad">' + förslag.map(function (f) {
        var d = new Date(f.datum + 'T12:00:00');
        var dag = DAGAR_KORTA[(d.getDay() + 6) % 7];
        return '<button type="button" class="vy-tid' + (f.vanlig ? ' vy-tid-vanlig' : '') + '"'
          + ' data-datum="' + f.datum + '" data-tid="' + f.tid + '"'
          + ' aria-pressed="' + (st.datum === f.datum && st.tid === f.tid ? 'true' : 'false') + '">'
          + '<b>' + esc(dag + ' ' + f.tid.slice(0, 5)) + '</b>'
          + '<span>' + esc(datumText(f.datum)) + '</span></button>';
      }).join('') + '</div>';
    }

    function rita() {
      var valdTid = st.datum && st.tid;

      var s1 = steg(1, 'Vad ska ni göra',
        '<b>' + esc(st.amne) + '</b>',
        chips('bk-amnen', (o.amnen || []).map(function (a) { return [a, a]; }), st.amne, 'Ämne'),
        st.oppet === 1 ? 'oppen' : 'klar');

      var s2kropp =
        '<div class="bk-langd"><span>Hur länge</span>'
        + chips('bk-langder', LANGDER.map(function (l) { return [String(l[0]), l[1]]; }),
            String(st.minuter), 'Längd')
        + '</div>'
        + '<div id="bk-tider">' + tiderHtml() + '</div>'
        + (st.spärr ? '' :
          '<details class="vy-mer-tider" id="bk-fler">'
          + '<summary>Fler tider och andra veckor'
          + '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg></summary>'
          + '<div class="vy-mer-tider-kropp"><div id="bk-kalender"></div></div>'
          + '</details>');

      var s2 = steg(2, 'När passar det',
        valdTid
          ? '<b>' + esc(datumText(st.datum) + ' kl. ' + st.tid.slice(0, 5)) + '</b> · ' + esc(längdText())
          : '',
        s2kropp,
        st.oppet === 2 ? 'oppen' : valdTid ? 'klar' : '');

      var påPlats = st.format === 'På plats';
      var s3 = steg(3, 'Hur vill ni ha det',
        '<b>' + esc(st.format) + '</b>'
          + (påPlats && st.plats ? ' · ' + esc(st.plats) : ''),
        chips('bk-format', FORMAT.map(function (f) { return [f, f]; }), st.format, 'Format')
          + (påPlats
            ? '<div class="bk-plats">'
              + '<label for="bk-plats-falt">Var ses ni?</label>'
              + '<input class="inp" id="bk-plats-falt" maxlength="120"'
              + ' value="' + esc(st.plats) + '"'
              + ' placeholder="t.ex. Hemma hos oss, Storgatan 4">'
              + '<span class="xsmall">Frivilligt. Lämnar ni det tomt kommer ni överens i chatten.</span>'
              + '</div>'
            : ''),
        st.oppet === 3 ? 'oppen' : 'klar');

      /* Steg 4 är låst tills en tid är vald. Det syns ändå, så att
         man ser att det bara är ett steg kvar. */
      var s4kropp = valdTid
        ? '<div class="bk-kvitto-rad"><span>Ämne</span><span>' + esc(st.amne) + '</span></div>'
          + '<div class="bk-kvitto-rad"><span>När</span><span>'
          + esc(datumText(st.datum) + ' kl. ' + st.tid.slice(0, 5)) + '</span></div>'
          + '<div class="bk-kvitto-rad"><span>Längd</span><span>' + esc(längdText()) + '</span></div>'
          + '<div class="bk-kvitto-rad"><span>Format</span><span>' + esc(st.format) + '</span></div>'
          + (st.format === 'På plats'
              ? '<div class="bk-kvitto-rad"><span>Plats</span><span>'
                + (st.plats ? esc(st.plats) : 'Bestäms i chatten') + '</span></div>'
              : '')
          + (o.hos ? '<div class="bk-kvitto-rad"><span>Studiehjälpare</span><span>'
              + esc(o.hos) + '</span></div>' : '')
          + '<div class="bk-kvitto-rad ar-summa"><span>Att betala</span><span>'
          + esc(kr((o.pris || 379) * timmar())) + '</span></div>'
          + '<div class="vy-fot" style="border:none;padding-top:16px;margin-top:0">'
          + '<button class="btn btn-primary" id="bk-boka" type="button">Boka passet</button>'
          + '<span class="small" style="color:var(--bl-2)">Ni betalar i efterskott, '
          + 'först när passet är genomfört.</span>'
          + '</div>'
          + '<p class="ok-msg" id="bk-msg"></p>'
        : '';

      var s4 = steg(4, 'Bekräfta',
        valdTid ? '' : 'Välj en tid först',
        s4kropp,
        valdTid ? (st.oppet === 4 ? 'oppen' : 'oppen') : 'last');

      host.innerHTML = '<div class="vy-boka-rot">' + s1 + s2 + s3 + s4
        /* .show, inte ett eget attribut: .ok-msg är display:none
           tills klassen sitter där, precis som NX.säg sätter den. */
        + '<p class="ok-msg' + (st.besked ? ' show' : '') + '" id="bk-besked">'
        + (st.besked ? esc(st.besked) : '') + '</p>'
        + '</div>';
    }

    /* ---- val ---- */
    function öppna(nr) {
      st.oppet = st.oppet === nr ? null : nr;
      rita();
    }

    function välj(datum, tid) {
      /* Ett nytt val betyder att man är på väg att boka igen. Att
         låta förra kvittot stå kvar under det hade läst som att
         det här passet redan var bokat. */
      st.besked = null;
      st.datum = datum; st.tid = tid;
      /* Vald tid fäller ihop steg 2 och lämnar bekräftelsen öppen.
         Att stanna kvar i tidslistan efter ett val hade betytt att
         man scrollar ner för att hitta knappen. */
      st.oppet = 4;
      rita();
    }

    /* Ingen omritning medan man skriver: rita() byter ut hela
       innerHTML, och fältet hade tappat både innehåll och fokus vid
       varje tangenttryck. Värdet läses ur st när steget ritas om av
       något annat skäl. */
    host.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'bk-plats-falt') st.plats = e.target.value;
    });

    host.addEventListener('click', function (e) {
      var öpp = e.target.closest('[data-bk-oppna]');
      if (öpp) { öppna(Number(öpp.dataset.bkOppna)); return; }

      var tid = e.target.closest('.vy-tid');
      if (tid) {
        välj(tid.dataset.datum, tid.dataset.tid);
        if (st.kal) st.kal.välj(tid.dataset.datum, tid.dataset.tid);
        return;
      }

      var val = e.target.closest('.vy-val button[data-v]');
      if (val) {
        var grupp = val.closest('.vy-val').id;
        if (grupp === 'bk-amnen') { st.amne = val.dataset.v; st.oppet = st.datum ? 4 : 2; rita(); }
        else if (grupp === 'bk-format') {
          st.format = val.dataset.v;
          /* På plats öppnar ett fält under knapparna, så steget ska
             stå öppet efteråt — annars göms frågan i samma klick som
             ställer den, och den som byter tillbaka från Online ser
             aldrig fältet dyka upp. Online har inget mer att fråga
             om och fäller ihop. */
          st.oppet = st.format === 'På plats' ? 3 : (st.datum ? 4 : 2);
          rita();
        }
        else if (grupp === 'bk-langder') {
          st.minuter = Number(val.dataset.v);
          /* Längden ändrar vilka timmar som ryms. En vald tid som
             inte längre får plats måste släppas, annars bokar man
             två timmar i ett enda ledigt hål. */
          st.datum = null; st.tid = null;
          if (st.kal) { st.kal.sättMinuter(st.minuter); st.kal.nollställ(); }
          st.kal = null;
          st.oppet = 2;
          rita();
        }
        return;
      }

      var boka = e.target.closest('#bk-boka');
      if (boka) skicka();
    });

    /* Månadskalendern byggs först när någon fäller ut den. Att rita
       en kalender ingen bett om kostar en layout på varje omritning,
       och de flesta bokar en av tiderna ovanför. */
    host.addEventListener('toggle', function (e) {
      var d = e.target;
      if (!d || d.id !== 'bk-fler' || !d.open || st.kal) return;
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
    }, true);

    function skicka() {
      var knapp = $('#bk-boka', host), msg = $('#bk-msg', host);
      if (msg) NX.rensa(msg);
      if (!st.datum || !st.tid) return;
      st.besked = null;
      NXStudie.medan(knapp, 'Bokar…', async function () {
        var fel = await o.boka({
          datum: st.datum, tid: st.tid, minuter: st.minuter,
          amne: st.amne, format: st.format,
          plats: st.format === 'På plats' ? st.plats.trim() : ''
        });
        if (fel) {
          var m = $('#bk-msg', host);
          if (m) NX.säg(m, fel, false);
          await ladda();
          return;
        }
        st.besked = 'Passet är önskat. Er studiehjälpare ser det direkt och bekräftar.';
        st.datum = null; st.tid = null;
        st.kal = null;
        st.oppet = 2;
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
      if (st.kal) {
        st.kal.sättTider({ tillgang: st.data.tillgang, blockerade: st.data.blockerade });
        st.kal.sättUpptagna(st.data.upptagna);
      }
      if (st.spärr) st.oppet = 2;
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
    fallGrupp: fallGrupp,
    fallStall: fallStall,
    DAGAR_LANGA: DAGAR_LANGA,
    DAGAR_KORTA: DAGAR_KORTA
  };
})();
