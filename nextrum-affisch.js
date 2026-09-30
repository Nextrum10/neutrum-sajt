/* ============================================================
   NEXTRUM — affischen (2026-09-30)

   Ritar affisch.html: området, koden, QR-koden och rivlapparna.
   Ingen databas och ingen inloggning. Allt som hamnar på affischen
   kommer ur den här filen eller ur en kod som prövats mot samma form
   som tipskoder_kod_form i databasen; ingen text ur adressen skrivs
   ut som den är. Annars hade vem som helst kunnat skriva ut en affisch
   med vår logga och vad som helst på.

   QR-koden pekar på intresseanmälan, inte på områdessidan. Formuläret
   läser koden och utm-taggarna ur sin egen adress, så anmälan får
   både platsen (koden) och kanalen (affisch/qr) utan att webbläsaren
   sparar något på vägen. Via områdessidan hade det krävt att en sida
   mindes något åt nästa, och det kräver samtycke (CLAUDE.md avsnitt 6).
   ============================================================ */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };

  /* Områdessidorna som finns. Området är bara rubriken; QR-koden går
     till samma formulär. */
  var OMRADEN = [
    ['farsta', 'Farsta'],
    ['hammarby-sjostad', 'Hammarby sjöstad'],
    ['sodermalm', 'Södermalm'],
    ['bromma', 'Bromma'],
    ['solna', 'Solna'],
    ['nacka', 'Nacka']
  ];

  /* Samma dag som data-uppstart i intresseanmalan.html. Efter den står
     raden om vecka 43 inte med: en affisch skriven i november ska inte
     lova något som redan hänt. Flyttas starten, flytta den här också. */
  var UPPSTART = '2026-10-19';

  var FORM = /^[A-Z0-9][A-Z0-9-]{2,23}$/;
  var LAPPAR = 8;

  var param;
  try { param = new URLSearchParams(location.search); } catch (e) { param = new URLSearchParams(); }

  var kod = String(param.get('kod') || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
  if (!FORM.test(kod)) kod = '';

  var omrade = String(param.get('omrade') || '');
  if (!OMRADEN.some(function (o) { return o[0] === omrade; })) omrade = '';

  function platsNamn() {
    var o = OMRADEN.filter(function (x) { return x[0] === omrade; })[0];
    return o ? o[1] : 'Stockholm';
  }

  function adress() {
    var q = new URLSearchParams();
    if (kod) q.set('kod', kod);
    q.set('utm_source', 'affisch');
    q.set('utm_medium', 'qr');
    q.set('utm_campaign', kod ? kod.toLowerCase() : 'affisch');
    return 'https://nextrum.se/intresseanmalan?' + q.toString();
  }

  /* Felkorrigering M: tål en fläck eller ett veck på en affisch i en
     trappuppgång, och koden blir ändå inte större än att den går att
     skanna på en meters håll. Fyra moduler tyst zon runt om, som
     standarden kräver: utan den läser en del telefoner inte koden. */
  function ritaQr() {
    var host = $('#aff-qr');
    if (!host) return;
    if (typeof qrcode !== 'function') {
      host.textContent = 'QR-koden kunde inte ritas. Ladda om sidan.';
      return;
    }
    var q = qrcode(0, 'M');
    q.addData(adress());
    q.make();
    host.innerHTML = q.createSvgTag({ cellSize: 1, margin: 4, scalable: true });
    host.setAttribute('data-adress', adress());
  }

  function ritaLappar() {
    var host = $('#aff-lappar-rad');
    if (!host) return;
    var på = $('#aff-lappar') ? $('#aff-lappar').checked : true;
    host.hidden = !på;
    var html = '';
    for (var i = 0; i < LAPPAR; i++) {
      html += '<div class="aff-lapp"><span><b>Läxhjälp</b> nextrum.se/intresseanmalan'
        + (kod ? ' <i>kod ' + kod + '</i>' : '') + '</span></div>';
    }
    host.innerHTML = html;
  }

  function rita() {
    $('#aff-plats').textContent = platsNamn();
    $('#aff-kod-rubrik').textContent = kod || 'utan kod';
    $('#aff-varning').hidden = !!kod;
    $('#aff-kod').textContent = kod;
    $('#aff-kod-rad').hidden = !kod;
    var idag = new Date().toISOString().slice(0, 10);
    $('#aff-start').hidden = idag >= UPPSTART;
    document.title = 'Affisch ' + (kod || '') + ' — Nextrum';
    ritaQr();
    ritaLappar();
  }

  /* Adressen följer valen, så att en länk till affischen ger samma
     affisch. replaceState: ett val är inget steg bakåt. */
  function skrivAdress() {
    var q = new URLSearchParams();
    if (kod) q.set('kod', kod);
    if (omrade) q.set('omrade', omrade);
    var ny = location.pathname + (q.toString() ? '?' + q.toString() : '');
    if (window.history && history.replaceState) history.replaceState(null, '', ny);
  }

  var val = $('#aff-omrade');
  if (val) {
    OMRADEN.forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o[0];
      opt.textContent = o[1];
      val.appendChild(opt);
    });
    val.value = omrade;
    val.addEventListener('change', function () {
      omrade = val.value;
      skrivAdress();
      rita();
    });
  }
  var lappar = $('#aff-lappar');
  if (lappar) lappar.addEventListener('change', ritaLappar);
  var skriv = $('#aff-skriv');
  if (skriv) skriv.addEventListener('click', function () { window.print(); });

  rita();
})();
