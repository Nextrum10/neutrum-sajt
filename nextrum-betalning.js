/* ============================================================
   NEXTRUM — betalningar och utbetalningar
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

  var esc = NX.esc;

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
     Ett underlag gäller en månad, och den månaden är det enda datum som
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
     en utbetalning ser ut som en läxa. Inget nytt formspråk för något
     som redan har ett. (Fakturans lägen stod här till 2026-10-21.) */
  /* Sett av studiehjälparen, på lönespecifikationen. Ett utkast är ett
     underlag som Nextrum inte gått igenom än, och det är vad det heter
     för den som väntar på pengarna. Adminvyn har egna ord (UTB_LAGE). */
  var UTBETALNING = {
    utkast:     { text: 'Granskas',   klass: 'ej' },
    godkand:    { text: 'Godkänd',    klass: 'pa' },
    utbetald:   { text: 'Utbetald',   klass: 'klar' },
    misslyckad: { text: 'Gick inte igenom', klass: 'sen' }
  };

  /* ---------- vad ett pass kostar ----------
     Familjens pris för ett pass i ören, för så många minuter som ska
     betalas: max(avrundat m/60 × (timpris + tillägg för fler barn)
     − rabatt, 0). Samma regel som familjebelopp() i _delad/pris.ts,
     som kortet räknas med, och som ej_betalt i
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
              som står på en senare lönespecifikation
     o.bonus  värvningsbonusen samma månad (2026-10-13; bonusen för tips till 2026-10-21): en rad var under
              passen, och summan med dem. Den står inte på underlaget,
              men den betalas med samma lön. */
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
    var bonus = o.bonus || [];
    var bonusÖre = bonus.reduce(function (n, b) { return n + Number(b.belopp_ore || 0); }, 0);
    bonus.forEach(function (b) {
      kropp += '<tr class="lonespec-bonus"><td>Värvningsbonus</td><td class="lonespec-tal">–</td>'
        + '<td class="lonespec-tal">' + esc(kronor(b.belopp_ore)) + '</td></tr>';
    });
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
      + '<td class="lonespec-tal">' + esc(kronor(Number(p.belopp_ore || 0) + bonusÖre)) + '</td></tr></tfoot></table>'
      + '<p class="lonespec-not">Timpenningen' + (bonusÖre ? ' och värvningsbonusen är' : ' är') + ' inklusive semesterersättning.'
      + (bonusÖre ? ' Summan har ' + esc(kronor(bonusÖre)) + ' i värvningsbonus med.' : '') + '</p>'
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

  /* ---------- det som ännu inte står på ett underlag ----------
     Den viktigaste siffran för båda parter: vad har vuxit fram den
     här månaden? Den är en uppskattning tills underlaget är skapat,
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

  /* ---------- gratistimmarna (2026-10-13) ----------
     Timmar admin satt in i familjens timbank: en rad i klippkort med
     erbjudandet 'gratis', utan betalning, som gäller i 60 dagar och
     används före köpta timmar (migrationen gratistimmar). Koden står här
     en gång, för adminvyn och studievyn. */
  var GRATIS = 'gratis';
  function gratistimmar(k) {
    return !!k && k.erbjudande === GRATIS;
  }

  /* ---------- syskontillägget (syskontillagg_som_skuld, 2026-10-21) ----------
     Tillägget för fler barn, som en skuld efter passet. Samma regel som
     databasen (intern.tillaggets_belopp) och _delad/tillagg.ts: pris för
     fler barn och timme × minuter / 60, avrundat till hela ören, lika
     mycket med ett som med två syskon (syskontillagget_fast, Leo: "Tre barn
     kostar 468 i timmen"). Bara visning: databasen räknar och fryser
     beloppet när passet bokas. */
  function tillaggetsBelopp(extra, prisOre, minuter) {
    var n = Number(extra) || 0, p = Number(prisOre) || 0, m = Number(minuter) || 0;
    return n > 0 && p > 0 && m > 0 ? Math.round(p * m / 60) : 0;
  }
  /* "Tillägg för syskon: 69 kr × 2 h = 138 kr", som rutan i bokningen
     visar det. Antalet syskon står inte i raden: det ändrar inte beloppet. */
  function tillaggRad(extra, prisOre, minuter) {
    return 'Tillägg för syskon: ' + kronor(prisOre) + ' × ' + timmar(minuter) + ' = '
      + kronor(tillaggetsBelopp(extra, prisOre, minuter));
  }
  /* Postens läge i ord och märkets färg (adminvyns tre: mossa klart,
     ockra väntar, lera ert drag). */
  var TILLAGG_LAGE = {
    bokad: ['Bokat', ''],
    upplupen: ['Upplupet', 'ar-ny'],
    i_betalning: ['Betalning pågår', 'ar-vantar'],
    betald: ['Betalt', 'ar-klar'],
    frigjord: ['Frigjort', ''],
    avskriven: ['Avskrivet', ''],
    aterbetald: ['Återbetalt', '']
  };

  /* ---------- sen avbokning (sen_avbokning, 2026-10-22) ----------
     Leo: "minst 12h innan måste det avbokas, avbokas det inom 12h av att
     lektionen ska hållas betalas 50% av belopp, eller spenderas hälften av
     planerade timmar för lektionen". Speglar betalning_installning, som är
     låst på 12 timmar och 50 procent, och intern.sen_avbokningens_minuter.
     Databasen avgör och räknar avgiften (stampla_avbokningen); vyerna
     räknar bara i förväg vad avbokningsrutan ska säga. */
  var SEN_AVBOKNING = { timmar: 12, procent: 50 };

  /* Passets start som tidpunkt i millisekunder. Dagen och klockslaget är
     Stockholms, var familjen än sitter. null utan dag. */
  function passetsStart(datum, tid) {
    var d = String(datum || '');
    if (!/^\d{4}-\d{2}-\d{2}/.test(d)) return null;
    var hm = String(tid || '00:00').slice(0, 5).split(':');
    var vagg = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10), +hm[0] || 0, +hm[1] || 0);
    var f = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Stockholm', hourCycle: 'h23', year: 'numeric',
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(vagg)).forEach(function (p) { f[p.type] = p.value; });
    var somStockholm = Date.UTC(+f.year, +f.month - 1, +f.day, +f.hour, +f.minute);
    return vagg - (somStockholm - vagg);
  }

  /* Sant när ett bokat pass börjar om mindre än gränsen: en avbokning nu
     är sen, och familjen flyttar det inte. Också efter start. */
  function senAvbokningNu(b, nu) {
    if (!b || b.status !== 'confirmed') return false;
    var start = passetsStart(b.wanted_date, b.wanted_time);
    return start !== null && start - (nu || Date.now()) < SEN_AVBOKNING.timmar * 3600 * 1000;
  }

  /* Den tid ett sent avbokat pass räknas som hållet i, i hela kvartar:
     60 ger 30, 120 ger 60, 180 ger 90. */
  function senMinuter(langd) {
    return Math.max(15, Math.round(Number(langd || 60) * SEN_AVBOKNING.procent / 100 / 15) * 15);
  }

  return {
    kronor: kronor, timmar: timmar, periodText: periodText,
    UTBETALNING: UTBETALNING, lonemanad: lonemanad, lonespec: lonespec, manadEfter: manadEfter,
    pagaende: pagaende, passpris: passpris, gratistimmar: gratistimmar,
    tillaggetsBelopp: tillaggetsBelopp, tillaggRad: tillaggRad, TILLAGG_LAGE: TILLAGG_LAGE,
    SEN_AVBOKNING: SEN_AVBOKNING, passetsStart: passetsStart, senAvbokningNu: senAvbokningNu, senMinuter: senMinuter
  };
})();
