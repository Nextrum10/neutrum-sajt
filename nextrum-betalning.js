/* ============================================================
   NEXTRUM — fakturor och utbetalningar
   Delas av foralder.html, larare.html och admin.html. Familjen ser vad
   de ska betala, studiehjälparen vad de ska få. Samma pass, två sidor
   av samma rad i bookings.

   Kräver nextrum-app.js (NX), och passpris() dessutom NXTjanster
   (nextrum-tjanster.js) med katalogen laddad. Ingen egen
   databaskoppling — varje vy äger sina frågor, det här är språket de
   talar.

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
  /* Sett av studiehjälparen, på lönespecifikationen. Ett utkast är ett
     underlag som Nextrum inte gått igenom än, och det är vad det heter
     för den som väntar på pengarna. Adminvyn har egna ord (UTB_LAGE). */
  var UTBETALNING = {
    utkast:     { text: 'Granskas',   klass: 'ej' },
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

  /* OCR-numrets kontrollsiffra (Fas 19.6), 10-modulen som Bankgirot
     använder. Samma regel som intern.ocr_giltigt() i databasen, som är
     den som faktiskt nekar: den här finns för att admin ska få beskedet
     i rutan, inte som rått databasfel. */
  function ocrGiltigt(s) {
    s = String(s || '');
    if (!/^[0-9]{2,25}$/.test(s)) return false;
    var summa = 0;
    for (var i = 1; i <= s.length; i++) {
      var d = Number(s.charAt(s.length - i));
      if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
      summa += d;
    }
    return summa % 10 === 0;
  }

  /* ---------- vad ett pass kostar ----------
     Familjens pris för ett pass i ören, för så många minuter som ska
     betalas: max(avrundat m/60 × (timpris + tillägg för fler barn)
     − rabatt, 0). Samma regel som familjebelopp() i _delad/pris.ts,
     som kortet och fakturan räknas med, och som ej_betalt i
     avvikelser_rader().

     Låg förut i studievyn (prisFör). Sedan 2026-09-28 räknar adminvyns
     Månadens ekonomi samma sak för det som inte är betalt än, och två
     kopior av en prisregel i webbläsaren hade glidit isär.

     Timpriset är passets frysta (Fas 19.5), ur passet eller ur dess
     rad i passunderlag (u); katalogen är bara reserven, för ett pass
     som bokades innan priset började frysas. Tillägget för fler barn
     följer samma källa som timpriset: ett fryst timpris med dagens
     syskontillägg hade varit ett pris som aldrig gällt. null när inget
     pris går att räkna, till exempel innan katalogen är laddad. */
  function passpris(b, u, minuter) {
    var källa = Number(b.timpris_ore) ? b : (u && Number(u.timpris_ore) ? u : null);
    var timme = källa ? Number(källa.timpris_ore) : 0;
    var extra = källa ? Number(källa.extra_ore) || 0 : 0;
    if (!timme) {
      var tj = NXTjanster.hitta(b.tjanst || NXTjanster.standard());
      if (!tj || !tj.pris_per_timme_ore) return null;
      timme = Number(tj.pris_per_timme_ore);
      extra = Number(tj.extra_personer_ore || 0);
    }
    var perTimme = timme + ((b.antal_barn || 1) > 1 ? extra : 0);
    var rabatt = Math.max(Number(b.rabatt_ore != null ? b.rabatt_ore : (u && u.rabatt_ore) || 0), 0);
    return Math.max(Math.round(perTimme * Number(minuter) / 60) - rabatt, 0);
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

  /* ---------- lönespecifikationen (2026-09-28) ----------
     Leo: "skriv lönespec för månaden efter att månaden är klar för
     studiehjälparen, under utbetalning för månaden. Så ska det vara för
     varje månad."

     Det är underlaget i payouts, ritat som det dokument det är: vad
     studiehjälparen får för en månad, pass för pass, och när det
     betalas. Förut stod underlaget som en rad med en lista under, och
     den som ville spara det hade inget att spara.

     Siffrorna räknas aldrig om här. Månadskörningen frös dem när den
     skrev underlaget, med timpenningen som gällde då, och en
     lönespecifikation som ändrar sig när timpenningen ändras
     specificerar ingenting. Summan är underlagets egen och inte
     radernas: skiljer de sig larmar utbetalning_summa_fel hos admin,
     och det som betalas är underlagets belopp.

     INGEN SKATT, med flit. Anställningsformen är inte avgjord
     (foretagsfakta.studiehjalpare_form är 'oklart'), och utan den finns
     ingen skattetabell att dra efter. Summan står före skatt, och det
     står så. Blir studiehjälparna anställda gör Fortnox Lön
     lönebeskedet med skatten (Fas 14.9); då ska texten här säga var det
     finns, inte räkna själv.

     rader    payout_lines i den ordning de ska stå, null när de inte
              gick att hämta
     o.namn   studiehjälparens namn, som det står i profilen
     o.noter  meningar under summan, till exempel om pass från månaden
              som står på en senare lönespecifikation */
  function dagText(d) {
    return d.getDate() + ' ' + MANADER[d.getMonth()] + ' ' + d.getFullYear();
  }

  function lonespec(p, rader, opts) {
    var o = opts || {};
    var d = String(p.period).split('-');
    var år = Number(d[0]), mån = Number(d[1]);
    var månad = MANADER[mån - 1] + ' ' + år;
    var sista = new Date(år, mån, 0).getDate();
    /* Den 25:e i månaden efter. Date räknar själv över årsskiftet:
       decembers lön blir den 25 januari året efter. */
    var lönedag = new Date(år, mån, 25);
    var utbetald = p.status === 'utbetald' && p.utbetald_at ? new Date(p.utbetald_at) : null;
    var l = UTBETALNING[p.status] || { text: p.status, klass: '' };

    /* En timpenning för alla passen står en gång, överst. Har
       tjänsterna olika ersättning står den på raden i stället. */
    var satser = [];
    (rader || []).forEach(function (r) {
      var s = Number(r.timpenning_ore);
      if (satser.indexOf(s) === -1) satser.push(s);
    });
    var enSats = satser.length === 1 ? satser[0] : null;

    var fakta = [
      o.namn ? ['Namn', o.namn] : null,
      ['Period', '1–' + sista + ' ' + månad],
      enSats !== null ? ['Timpenning', kronor(enSats)]
        : satser.length > 1 ? ['Timpenning', 'olika per pass, står på raden'] : null,
      utbetald ? ['Utbetald', dagText(utbetald)] : ['Utbetalning', dagText(lönedag)]
    ].filter(Boolean);

    var kropp = rader === null
      ? '<tr><td colspan="3">Passen gick inte att hämta. Ladda om sidan.</td></tr>'
      : rader.map(function (r) {
          return '<tr><td>' + esc(r.beskrivning) + '</td>'
            + '<td class="lonespec-tal">' + esc(timmar(r.minuter))
            + (enSats === null ? ' à ' + esc(kronor(r.timpenning_ore)) : '') + '</td>'
            + '<td class="lonespec-tal">' + esc(kronor(r.belopp_ore)) + '</td></tr>';
        }).join('');
    var antal = rader ? rader.length : 0;
    var epost = (NX.CFG && NX.CFG.EPOST) || 'info@nextrum.se';

    return '<article class="lonespec" data-titel="' + esc('Lönespecifikation ' + månad) + '">'
      + '<div class="lonespec-topp"><div>'
      + '<span class="lonespec-avs">Nextrum · Lönespecifikation</span>'
      + '<h6 class="lonespec-man">' + esc(månad.charAt(0).toUpperCase() + månad.slice(1)) + '</h6>'
      + '</div><span class="lage ' + l.klass + '">' + esc(l.text) + '</span></div>'
      + '<dl class="lonespec-fakta">' + fakta.map(function (f) {
          return '<div><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>';
        }).join('') + '</dl>'
      + '<table class="lonespec-rader" aria-label="' + esc('Passen, ' + månad) + '">'
      + '<thead><tr><th scope="col">Pass</th><th scope="col" class="lonespec-tal">Tid</th>'
      + '<th scope="col" class="lonespec-tal">Belopp</th></tr></thead>'
      + '<tbody>' + kropp + '</tbody>'
      + '<tfoot><tr><th scope="row">Summa före skatt'
      + (antal ? '<span>' + antal + ' pass</span>' : '') + '</th>'
      + '<td class="lonespec-tal">' + esc(timmar(p.minuter)) + '</td>'
      + '<td class="lonespec-tal">' + esc(kronor(p.belopp_ore)) + '</td></tr></tfoot></table>'
      + '<p class="lonespec-not">Timpenningen är inklusive semesterersättning.</p>'
      + (p.status === 'misslyckad' && p.fel ? '<p class="lonespec-not lonespec-fel">' + esc(p.fel) + '</p>' : '')
      + (o.noter || []).map(function (n) { return '<p class="lonespec-not">' + esc(n) + '</p>'; }).join('')
      + '<p class="lonespec-fraga">Frågor om lönen: <a href="mailto:' + esc(epost) + '">' + esc(epost) + '</a></p>'
      + '<div class="lonespec-atg"><button class="btn btn-ghost btn-sm" type="button" data-lonespec-skriv>'
      + 'Skriv ut eller spara som PDF</button></div>'
      + '</article>';
  }

  /* ---------- vilken månads lön ett pass hör till (2026-10-01) ----------
     Leo: "passen som är hållna i september ska spärras av för september".
     Samma regel som malmanad() i fakturering (_delad/pris.ts), så att
     Löner, Månadens ekonomi och studiehjälparens lönespec säger det
     körningen gör: passets egen månad, så länge studiehjälparens underlag
     för den är ett utkast eller inte skapat. Ett låst underlag (godkänt,
     utbetalt) skickar passet till den första senare månaden som tar emot
     det.

     Körningen går varje natt för förra månaden och skapar bara ett nytt
     underlag för den. En äldre månad som aldrig fick ett tar därför inte
     emot passet, och det går till förra månaden eller senare.

     datum  passets, 'ÅÅÅÅ-MM-DD'
     lagen  studiehjälparens underlag: 'ÅÅÅÅ-MM-01' → status */
  function manadEfter(m) {
    var d = String(m).split('-');
    var år = Number(d[0]), mån = Number(d[1]);
    return mån === 12 ? (år + 1) + '-01-01' : år + '-' + String(mån + 1).padStart(2, '0') + '-01';
  }

  function lonemanad(datum, lagen) {
    var nu = new Date();
    var förra = new Date(nu.getFullYear(), nu.getMonth() - 1, 1, 12);
    var förraIso = förra.getFullYear() + '-' + String(förra.getMonth() + 1).padStart(2, '0') + '-01';
    var m = String(datum).slice(0, 7) + '-01';
    /* En månad som pågår eller inte har börjat har inget underlag, så
       slingan stannar senast vid förra månaden plus de låsta efter den. */
    for (var i = 0; i < 600; i++) {
      var s = (lagen || {})[m];
      if (s === 'utkast' || (!s && m >= förraIso)) return m;
      m = manadEfter(m);
    }
    return m;
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
    fakturaRad: fakturaRad, lonemanad: lonemanad, lonespec: lonespec, manadEfter: manadEfter,
    ocrGiltigt: ocrGiltigt, pagaende: pagaende, passpris: passpris
  };
})();
