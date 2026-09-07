/* ============================================================
   NEXTRUM — felrapportering

   Vyerna berättar redan för ANVÄNDAREN när något går sönder.
   Den här filen berättar det för OSS.

   Laddas före nextrum-app.js med flit: lyssnarna ska sitta på
   plats innan resten av koden hunnit köra, annars missas just de
   fel som inträffar under uppstarten — de intressantaste. Klienten
   finns inte än då, så rapporterna köas och skickas när den dyker
   upp.

   Tabellen och dess regler ligger i schema-v10.sql. Innan det är
   kört gör den här filen ingenting alls, tyst.
   ============================================================ */
(function () {
  'use strict';

  /* Ett tak per sidbesök. Ett fel inne i en renderingsloop kan
     annars skicka tusen rapporter på en sekund — och då är det vi
     som utför angreppet mot vår egen databas. */
  var TAK = 5;

  var skickade = 0;
  var ko = [];
  var sedda = {};
  var rapporterar = false;

  function kort(s, n) {
    s = String(s == null ? '' : s);
    return s.length > n ? s.slice(0, n) : s;
  }

  /* Ett fel som redan rapporterats en gång under besöket är inte
     nyare för att det inträffar igen. */
  function nytt(nyckel) {
    if (sedda[nyckel]) return false;
    sedda[nyckel] = true;
    return true;
  }

  /* nextrum-app.js deklarerar klienten med "const supa" på toppnivå.
     En const där hamnar i det globala lexikala scopet men blir INTE
     en egenskap på window — window.supa är undefined fastän supa
     finns. Därför typeof och inte window. */
  function klienten() {
    try { return (typeof supa !== 'undefined' && supa) ? supa : null; }
    catch (e) { return null; }
  }

  function skicka(post) {
    /* Ett fel INNE i felrapporteringen får aldrig utlösa en ny
       rapport. Utan den här flaggan blir en trasig rapportering en
       oändlig loop. */
    if (rapporterar) return;
    rapporterar = true;
    try {
      klienten().from('klientfel').insert(post).then(null, function () {});
    } catch (e) {
      /* Går rapporteringen inte igenom är det illa, men att kasta
         vidare härifrån vore värre: då tar vi ned sidan för ett fel
         vars enda syfte var att bli noterat. */
    }
    rapporterar = false;
  }

  function tom() {
    if (!ko.length) return;
    if (!klienten()) return;
    var post = ko.shift();
    while (post) { skicka(post); post = ko.shift(); }
  }

  function rapportera(meddelande, stack) {
    if (skickade >= TAK) return;
    meddelande = kort(meddelande, 500);
    if (!meddelande || !nytt(meddelande)) return;
    skickade++;

    ko.push({
      meddelande: meddelande,
      /* Bara sökväg och hash — aldrig sökparametrar. Där kan det
         ligga uppgifter som inte hör hemma i en felrapport. */
      sida: kort(location.pathname + location.hash, 300),
      stack: kort(stack || '', 2000) || null,
      webblasare: kort(navigator.userAgent, 300)
    });
    tom();
  }

  window.addEventListener('error', function (e) {
    /* Bilder och skript som inte laddar ger också 'error', men utan
       felobjekt. De hanteras redan där de hör hemma. */
    if (!e || !e.message) return;
    rapportera(e.message, e.error && e.error.stack);
  });

  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    if (!r) return;
    rapportera((r && r.message) || String(r), r && r.stack);
  });

  /* Klienten skapas i nextrum-app.js, alltså efter den här filen.
     Köade fel från uppstarten skickas när den finns. */
  window.addEventListener('load', function () { setTimeout(tom, 0); });

  window.NXFel = { rapportera: rapportera, kö: function () { return ko.length; } };
})();
