/* ============================================================
   NEXTRUM — fakturor och utbetalningar
   Delas av foralder.html och larare.html. Familjen ser vad de ska
   betala, studiehjälparen vad de ska få. Samma pass, två sidor av
   samma rad i bookings.

   Kräver nextrum-app.js (NX). Ingen egen databaskoppling — varje vy
   äger sina frågor, det här är språket de talar.

   Tabellerna ligger i schema-v8.sql. Ingenting här skriver: belopp
   sätts av edge-funktionen, aldrig från webbläsaren.
   ============================================================ */
window.NXBetalning = (function () {
  'use strict';

  var esc = NX.esc, datumText = NX.datumText;

  /* ---------- pengar ----------
     Allt räknas i ören och blir kronor först här. Decimalerna visas
     bara när de finns: "379 kr" är lättare att läsa än "379,00 kr",
     men ett pass på 90 minuter blir 568,50 och då måste de synas. */
  function kronor(ore) {
    var n = Number(ore || 0) / 100;
    var heltal = Math.round(n * 100) % 100 === 0;
    return n.toLocaleString('sv-SE', {
      minimumFractionDigits: heltal ? 0 : 2,
      maximumFractionDigits: 2
    }) + ' kr';
  }

  /* Minuter till timmar i ord. 90 minuter är "1,5 h", inte "1.5". */
  function timmar(minuter) {
    var t = Number(minuter || 0) / 60;
    return t.toLocaleString('sv-SE', { maximumFractionDigits: 2 }) + ' h';
  }

  /* ---------- perioden ----------
     Fakturan gäller en månad, och den månaden är det enda datum som
     betyder något för den som läser. */
  var MANADER = NX.MANADER;
  function periodText(iso) {
    if (!iso) return '';
    var d = String(iso).split('-');
    var år = Number(d[0]), mån = Number(d[1]);
    var nu = new Date();
    return MANADER[mån - 1] + (år !== nu.getFullYear() ? ' ' + år : '');
  }

  /* ---------- lägena ----------
     Klasserna är .lage-familjen som redan finns i nextrum-vy.css, så
     en faktura ser ut som ett pass och en utbetalning som en läxa.
     Inget nytt formspråk för något som redan har ett. */
  var FAKTURA = {
    utkast:     { text: 'Utkast',    klass: 'ej' },
    skickad:    { text: 'Att betala', klass: 'pa' },
    betald:     { text: 'Betald',    klass: 'klar' },
    forfallen:  { text: 'Förfallen', klass: 'sen' },
    makulerad:  { text: 'Makulerad', klass: 'avbokad' }
  };
  var UTBETALNING = {
    utkast:     { text: 'Underlag',   klass: 'ej' },
    godkand:    { text: 'Godkänd',    klass: 'pa' },
    utbetald:   { text: 'Utbetald',   klass: 'klar' },
    misslyckad: { text: 'Gick inte igenom', klass: 'sen' }
  };

  /* En faktura är förfallen när datumet passerat och den inte är
     betald. Det räknas fram här i stället för att sparas, av samma
     skäl som en läxa blir försenad utan att någon skriver om raden:
     ett datum som passerar ska inte kräva en databaskörning. */
  function fakturaLage(f) {
    if (f.status === 'skickad' && f.forfaller && f.forfaller < NX.isoFor(new Date())) {
      return 'forfallen';
    }
    return f.status;
  }

  /* ---------- en faktura ----------
     atgarder() får fakturan och returnerar knapparnas HTML. */
  function fakturaRad(f, opts) {
    var o = opts || {};
    var l = FAKTURA[fakturaLage(f)] || { text: f.status, klass: '' };
    var sen = fakturaLage(f) === 'forfallen';

    return '<div class="bet">'
      + '<span class="bet-nar"><b>' + esc(periodText(f.period)) + '</b>'
      + (f.forfaller
          ? '<span class="' + (sen ? 'sen' : '') + '">Betalas ' + esc(datumText(f.forfaller)) + '</span>'
          : '')
      + '</span>'
      + '<span class="bet-vad"><b>' + esc(kronor(f.belopp_ore)) + '</b>'
      + (o.under ? '<span>' + esc(o.under) + '</span>' : '')
      + '</span>'
      + '<span class="bet-atg"><span class="lage ' + l.klass + '">' + esc(l.text) + '</span>'
      + (o.atgarder || '') + '</span>'
      + '</div>';
  }

  /* ---------- en utbetalning ---------- */
  function utbetalningRad(p, opts) {
    var o = opts || {};
    var l = UTBETALNING[p.status] || { text: p.status, klass: '' };

    return '<div class="bet">'
      + '<span class="bet-nar"><b>' + esc(periodText(p.period)) + '</b>'
      + '<span>' + esc(timmar(p.minuter)) + '</span></span>'
      + '<span class="bet-vad"><b>' + esc(kronor(p.belopp_ore)) + '</b>'
      + (o.under ? '<span>' + esc(o.under) + '</span>' : '')
      + (p.status === 'misslyckad' && p.fel
          ? '<span class="bet-fel">' + esc(p.fel) + '</span>' : '')
      + '</span>'
      + '<span class="bet-atg"><span class="lage ' + l.klass + '">' + esc(l.text) + '</span>'
      + (o.atgarder || '') + '</span>'
      + '</div>';
  }

  /* ---------- raderna i en faktura ---------- */
  function radLista(rader, fältnamn) {
    if (!rader || !rader.length) return '';
    return '<div class="bet-rader">' + rader.map(function (r) {
      return '<div class="bet-rad">'
        + '<span>' + esc(r.beskrivning) + '</span>'
        + '<span class="bet-rad-tid">' + esc(timmar(r.minuter)) + '</span>'
        + '<span class="bet-rad-belopp">' + esc(kronor(r.belopp_ore)) + '</span>'
        + '</div>';
    }).join('') + '</div>';
  }

  /* ---------- det som ännu inte fakturerats ----------
     Den viktigaste siffran för båda parter: vad har vuxit fram den
     här månaden? Den är en uppskattning tills fakturan är skapad,
     och det ska stå i texten — inte antydas. */
  function pagaende(opts) {
    var o = opts || {};
    var pass = Number(o.pass || 0);
    if (!pass) {
      return '<div class="empty"><b>' + esc(o.tomRubrik || 'Inget att räkna på än') + '</b>'
        + '<br><span>' + esc(o.tomText || '') + '</span></div>';
    }
    return '<div class="bet-pagaende">'
      + '<b>' + esc(kronor(o.belopp_ore)) + '</b>'
      + '<span>' + pass + ' genomförda pass · ' + esc(timmar(o.minuter)) + '</span>'
      + (o.not ? '<p class="bet-not">' + esc(o.not) + '</p>' : '')
      + '</div>';
  }

  return {
    kronor: kronor, timmar: timmar, periodText: periodText,
    FAKTURA: FAKTURA, UTBETALNING: UTBETALNING, fakturaLage: fakturaLage,
    fakturaRad: fakturaRad, utbetalningRad: utbetalningRad,
    radLista: radLista, pagaende: pagaende
  };
})();
