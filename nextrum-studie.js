/* ============================================================
   NEXTRUM — studiearbetet
   Delas av foralder.html och larare.html. Här ligger det som båda
   vyerna behöver se likadant: läxornas lägen, kunskapsnivåerna,
   bekräftelserutan och de små tillstånden (laddar, klart, fel).

   Kräver nextrum-app.js (NX). Ingen egen databaskoppling — varje vy
   äger sina frågor, det här är bara språket de talar.
   ============================================================ */
window.NXStudie = (function () {
  'use strict';

  var esc = NX.esc, datumText = NX.datumText, isoFor = NX.isoFor;

  /* Trycket i vyerna (KÄNSLAN i nextrum-arbetsyta.css) är :active, och
     iPhones Safari tänder :active pålitligt först när sidan har en
     touch-lyssnare. De publika sidorna får den av NXMotion.tryckbart(),
     vyerna laddar inte NXMotion. Tom med flit, och passiv så att den
     aldrig kan bromsa scrollen. */
  document.addEventListener('touchstart', function () {}, { passive: true });

  /* ---------- läxans lägen ----------
     'forsenad' finns inte i databasen, den räknas fram ur deadline.
     Se kommentaren i schema-v5.sql om varför. */
  var LAGE = {
    ej_paborjad: { text: 'Ej påbörjad', klass: 'ej' },
    pagaende:    { text: 'Pågående',    klass: 'pa' },
    klar:        { text: 'Klar',        klass: 'klar' },
    forsenad:    { text: 'Försenad',    klass: 'sen' }
  };

  function läxläge(h) {
    if (h.status === 'klar') return 'klar';
    if (h.due_date && h.due_date < isoFor(new Date())) return 'forsenad';
    return h.status;
  }

  /* Deadline i ord. "Imorgon" säger mer än ett datum när det är
     imorgon det gäller. */
  function deadlineText(iso) {
    if (!iso) return '';
    var idag = isoFor(new Date());
    var imorgon = new Date(); imorgon.setDate(imorgon.getDate() + 1);
    if (iso === idag) return 'Idag';
    if (iso === isoFor(imorgon)) return 'Imorgon';
    if (iso < idag) {
      var dagar = Math.round((new Date(idag) - new Date(iso)) / 86400000);
      return dagar === 1 ? 'Igår' : datumText(iso);
    }
    return datumText(iso);
  }

  /* ---------- kunskapsnivåerna ----------
     FEM STEG sedan 2026-09-24. Tre sa för lite: "Bra" rymde allt från
     "klarar det med stöd" till "kan förklara det för någon annan", och
     en elev som rörde sig inom det steget såg ut att stå still.

     Stegen beskriver vad eleven KAN, inte hur hen ligger till mot ett
     betyg. Studiehjälparen sätter inga betyg, och en skala som liknar
     F–A hade lästs som att hen gjorde det.

     Kolumnen level (tre värden) står kvar och hålls i synk av en
     trigger i databasen, så att rader från före bytet och kod som inte
     hunnit uppdateras fortsätter fungera. stegFör() läser steg när det
     finns och översätter level när det inte gör det. */
  var STEG = [
    null,
    { text: 'Nytt',          vad: 'Har inte arbetat med det än, eller grunderna saknas' },
    { text: 'Behöver träna', vad: 'Klarar det med mycket stöd' },
    { text: 'På god väg',    vad: 'Klarar det med visst stöd' },
    { text: 'Säker',         vad: 'Klarar det på egen hand' },
    { text: 'Behärskar',     vad: 'Kan förklara det och använda det i nya sammanhang' }
  ];
  var FRAN_LEVEL = { behover_trana: 2, pa_god_vag: 3, bra: 4 };

  function stegFör(p) {
    var s = p ? Number(p.steg) : NaN;
    if (s >= 1 && s <= 5) return s;
    return (p && FRAN_LEVEL[p.level]) || 1;
  }
  function stegText(s) { return (STEG[s] || STEG[1]).text; }
  function målFör(p) {
    var m = p ? Number(p.mal_steg) : NaN;
    return m >= 1 && m <= 5 ? m : null;
  }

  /* Fem segment som fylls, och målet som en ring på sitt segment. En
     siffra hade blivit ett betyg; det här är en riktning. */
  function nivåMätare(steg, mal) {
    var s = Math.max(1, Math.min(5, Number(steg) || 1));
    var m = Number(mal) >= 1 && Number(mal) <= 5 ? Number(mal) : null;
    var etikett = stegText(s) + (m && m > s ? ', mål: ' + stegText(m) : '');
    var ut = '<span class="niva" role="img" aria-label="' + esc(etikett) + '">';
    for (var i = 1; i <= 5; i++) {
      ut += '<i class="' + (i <= s ? 'fylld' : '') + (m && m > s && i === m ? ' mal' : '') + '"></i>';
    }
    return ut + '</span>';
  }

  /* ---------- en läxrad ----------
     atgarder() får läxan och returnerar knapparnas HTML, så att
     familjen och studiehjälparen kan ha olika. */
  function läxRad(h, opts) {
    var o = opts || {};
    var l = LAGE[läxläge(h)];
    var sen = läxläge(h) === 'forsenad';
    var klar = h.status === 'klar';

    /* En klar läxa är en rad man trycker upp (2026-09-27). Utfälld
       var den ett helt kort, nedtonat och överstruket, och fem sådana
       under det man ska göra var en vägg att skrolla förbi. Hopfälld
       står rubriken, ämnet och när den blev klar; resten, med
       materialet, finns ett tryck bort. */
    var topp = klar
      ? '<summary class="lax-summ">'
        + '<span class="lax-summ-text"><b>' + esc(h.title) + '</b>'
        + '<span class="lax-summ-meta">' + esc([h.subject, h.completed_at
            ? 'Klar ' + deadlineText(isoFor(new Date(h.completed_at))).toLowerCase() : 'Klar'
          ].filter(Boolean).join(' · ')) + '</span></span>'
        + '<svg class="lax-pil" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" '
        + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 8l4.5 4.5L14.5 8"/></svg>'
        + '</summary><div class="lax-kropp">'
      : '<div class="lax-topp">'
        + '<b>' + esc(h.title) + '</b>'
        + '<span class="lage ' + l.klass + '">' + esc(l.text) + '</span>'
        + '</div>';

    return (klar
        ? '<details class="lax avklarad" data-lax-id="' + esc(h.id) + '"'
          + (LÄX_UTFÄLLDA[h.id] ? ' open' : '') + '>'
        : '<div class="lax">')
      + topp
      + '<div class="lax-meta">'
      + (h.subject && !klar ? '<span class="tag">' + esc(h.subject) + '</span>' : '')
      + (h.due_date
          ? '<span class="lax-datum' + (sen ? ' sen' : '') + '">Till ' + esc(deadlineText(h.due_date)) + '</span>'
          : '')
      + '</div>'
      + (h.instructions ? '<p class="lax-text">' + esc(h.instructions) + '</p>' : '')
      /* Materialet läxan bygger på (Fas 13.2). Raden ritas bara när
         anroparen skickat med titeln: läxan bär ett bibliotek_id, och
         vad det id:t heter vet bara den som hämtat raden. Står det
         bara ett uuid här är raden sämre än ingen rad. */
      + (o.material
          ? '<div class="lax-material">'
            + '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" '
            + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
            + '<path d="M3.5 4.5h5a1.7 1.7 0 0 1 1.7 1.7V16a1.7 1.7 0 0 0-1.7-1.7h-5z"/>'
            + '<path d="M16.5 4.5h-5A1.7 1.7 0 0 0 9.8 6.2V16a1.7 1.7 0 0 1 1.7-1.7h5z"/></svg>'
            + '<span>' + esc(o.material) + '</span>'
            + (o.materialKnapp || '')
            + '</div>'
          : '')
      /* Fas 23.1: nivån en digital uppgift går ut på, och resultatet.
         Ritas av vyn med NXUppgifter, som vet vad försöken säger. */
      + (o.digital || '')
      + (o.atgarder ? '<div class="lax-atg">' + o.atgarder + '</div>' : '')
      + (klar ? '</div></details>' : '</div>');
  }
  /* Vilka klara läxor som står utfällda. Listan ritas om efter varje
     tryck på Klar eller Ångra, och en läxa man läste i hade annars
     fällts ihop under fingret. */
  var LÄX_UTFÄLLDA = {};

  /* ---------- ett kunskapsområde ----------
     o.historik(p) får lägga till en rad under nivån — utvecklingen
     över tid — utan att raden behöver veta var historiken kommer ifrån. */
  function progressRad(p, opts) {
    var o = opts || {};
    var s = stegFör(p), m = målFör(p);
    var mål = !m ? '' : m > s ? ' · mål: ' + stegText(m).toLowerCase() : ' · målet nått';
    /* Knapparna får vara en funktion av raden. Förr lades de på i
       efterhand efter position, och då räckte det att databasen och
       sidan sorterade ämnena olika för att Ta bort skulle träffa fel
       område. */
    var atg = typeof o.atgarder === 'function' ? o.atgarder(p) : o.atgarder;
    return '<div class="prg">'
      + '<div class="prg-topp"><b>' + esc(p.area) + '</b>' + nivåMätare(s, m) + '</div>'
      + '<span class="prg-niva">' + esc(stegText(s) + mål) + '</span>'
      + (typeof o.historik === 'function' ? o.historik(p) : '')
      + (p.comment ? '<p class="prg-kommentar">' + esc(p.comment) + '</p>' : '')
      + (atg ? '<div class="prg-atg">' + atg + '</div>' : '')
      + '</div>';
  }

  /* ---------- utvecklingen över tid ----------
     punkter: [{ steg, bedomd_at }] i tidsordning, ur progress_historik.
     En stapel per bedömning, högst de åtta senaste — fler ryms inte
     på en rad, och det är riktningen som ska synas, inte varje steg.
     Texten under säger hur långt det gått och när det senast bedömdes,
     så att en stapelrad utan förklaring aldrig står ensam. */
  function historikRad(punkter) {
    var pk = (punkter || []).filter(function (x) { return Number(x.steg) >= 1; });
    if (!pk.length) return '';
    var visade = pk.slice(-8);
    var först = pk[0], sist = pk[pk.length - 1];
    var skillnad = Number(sist.steg) - Number(först.steg);
    var etikett = 'Utveckling: ' + visade.map(function (x) { return stegText(Number(x.steg)); }).join(' → ');
    var staplar = visade.map(function (x, i) {
      return '<i style="height:' + (Number(x.steg) * 20) + '%"'
        + (i === visade.length - 1 ? ' class="sist"' : '') + '></i>';
    }).join('');
    var dagar = Math.max(0, Math.round((Date.now() - Date.parse(sist.bedomd_at)) / 86400000));
    var senast = dagar === 0 ? 'idag' : dagar === 1 ? 'igår' : 'för ' + dagar + ' dagar sedan';
    var rörelse = pk.length < 2 ? 'Första bedömningen'
      : skillnad > 0 ? '↑ ' + skillnad + ' steg sedan ' + datumText(String(först.bedomd_at).slice(0, 10))
      : skillnad < 0 ? '↓ ' + (-skillnad) + ' steg sedan ' + datumText(String(först.bedomd_at).slice(0, 10))
      : 'Samma nivå sedan ' + datumText(String(först.bedomd_at).slice(0, 10));
    return '<div class="prg-hist">'
      + '<span class="prg-hist-staplar" role="img" aria-label="' + esc(etikett) + '">' + staplar + '</span>'
      + '<span class="prg-hist-text">' + esc(rörelse + ' · bedömd ' + senast) + '</span>'
      + '</div>';
  }

  /* Svensk ordning: Å, Ä och Ö sist, som i ett register. Standard-
     sorteringen lägger dem efter Z men i fel inbördes ordning. */
  function svOrdning(a, b) { return String(a).localeCompare(String(b), 'sv'); }

  /* Ett kort per ämne: snittsteget, antalet områden, och hur många som
     gått upp de senaste trettio dagarna. historik = { progress_id:
     [punkter i tidsordning] }. "Gått upp" jämför nivån nu med den
     senaste bedömningen FÖRE gränsen — eller, för ett område som är
     nyare än så, med den första. Ett område utan historik räknas inte:
     att det finns är inte samma sak som att det gått framåt. */
  function ämnesSammanfattning(rader, historik) {
    if (!rader || !rader.length) return '';
    var ämnen = {};
    rader.forEach(function (p) { (ämnen[p.subject] = ämnen[p.subject] || []).push(p); });
    var gräns = Date.now() - 30 * 86400000;
    return '<div class="prg-sum">' + Object.keys(ämnen).sort(svOrdning).map(function (ämne) {
      var r = ämnen[ämne];
      var snitt = r.reduce(function (a, p) { return a + stegFör(p); }, 0) / r.length;
      var upp = r.filter(function (p) {
        var h = (historik && historik[p.id]) || [];
        if (!h.length) return false;
        var före = h.filter(function (x) { return Date.parse(x.bedomd_at) < gräns; });
        var bas = före.length ? före[före.length - 1] : (h.length > 1 ? h[0] : null);
        return !!bas && stegFör(p) > Number(bas.steg);
      }).length;
      return '<div class="prg-sum-kort">'
        + '<h6>' + esc(ämne) + '</h6>'
        + '<b>' + esc(snitt.toFixed(1).replace('.', ',')) + '</b>'
        + '<span class="xsmall" style="color:var(--bl-2)"> av 5</span>'
        + nivåMätare(Math.round(snitt))
        + '<p>' + r.length + (r.length === 1 ? ' område' : ' områden') + '</p>'
        + (upp ? '<p class="upp">↑ ' + upp + ' har gått upp på 30 dagar</p>' : '')
        + '</div>';
    }).join('') + '</div>';
  }

  /* Kunskapsområdena grupperade per ämne — annars blir det en lista
     där matte och engelska ligger huller om buller. */
  function progressPerÄmne(rader, opts) {
    if (!rader.length) return '';
    var ämnen = {};
    rader.forEach(function (p) { (ämnen[p.subject] = ämnen[p.subject] || []).push(p); });
    return Object.keys(ämnen).sort(svOrdning).map(function (ämne) {
      return '<div class="prg-grupp">'
        + '<h6>' + esc(ämne) + '</h6>'
        + ämnen[ämne].map(function (p) { return progressRad(p, opts); }).join('')
        + '</div>';
    }).join('');
  }

  /* ---------- tomma lägen ----------
     Ett tomt läge ska säga vad som händer härnäst, inte bara att
     det är tomt. */
  function tomt(rubrik, text) {
    return '<div class="empty"><b>' + esc(rubrik) + '</b>'
      + (text ? '<br><span>' + esc(text) + '</span>' : '') + '</div>';
  }

  function laddar(text) {
    return '<div class="loading">' + esc(text || 'Hämtar') + '</div>';
  }

  /* ---------- omladdning utan hopp ----------
     Leo 2026-09-24: "när man trycker på knappar skickas man uppåt".

     Mätt i provbänken med 250 ms fördröjning per fråga och utan
     scroll anchoring (som Safari, som saknar den): "Klar" på en läxa
     kastade sidan 1 060–1 818 px uppåt. Listan byttes mot "Hämtar"
     medan den hämtades om, sidan krympte med listans höjd, och
     webbläsaren klämde scrollen. När listan kom tillbaka stod man
     någon helt annanstans. Chrome döljer det mesta med sin scroll
     anchoring; iPhone gör det inte.

     laddarFörsta() skriver "Hämtar" bara när det INTE finns något
     att visa. Finns en lista redan står den kvar, nedtonad, tills
     den nya är ritad — då byter den på en gång och höjden rör sig
     bara med det som faktiskt ändrats. */
  function laddarFörsta(host, text) {
    if (!host) return;
    var barn = host.children;
    var tom = !barn.length
      || (barn.length === 1 && barn[0].classList.contains('loading'));
    if (tom) { host.innerHTML = laddar(text); return; }
    host.setAttribute('aria-busy', 'true');
    /* Släpps av sig självt när listan skrivs om, oavsett vilken väg
       hämtningen tog — ett fel, en tom lista eller en ny. Att kräva
       att varje väg tog bort den hade glömts i den första nya. */
    if (window.MutationObserver) {
      var vakt = new MutationObserver(function () {
        host.removeAttribute('aria-busy');
        vakt.disconnect();
      });
      vakt.observe(host, { childList: true });
    }
  }

  /* Scrollar utan animering. nextrum.css sätter scroll-behavior:
     smooth på html, och 'instant' i scrollTo förstås inte av alla
     Safari-versioner — de läser då CSS:en och glider. Att stänga av
     egenskapen under anropet fungerar överallt. */
  function scrollaTill(y) {
    var html = document.documentElement;
    var förr = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    window.scrollTo(0, Math.max(0, y));
    html.style.scrollBehavior = förr;
  }

  /* Lägger ett element strax under sidhuvudet. Huvudet ligger fixed
     och är olika högt på telefon och dator, så höjden mäts i stället
     för att gissas — en gissning lade tillbaka-länken under det. */
  function visaÖverst(el) {
    if (!el) return;
    scrollaTill(platsUtanInglidning(el) + window.scrollY - täcktÖverst() - 12);
  }

  /* Var elementets ruta ligger, utan inglidningen. En sektion som visas
     tonar in med translate:0 12px till 0 (vy-in i nextrum-arbetsyta.css),
     och den mäts i samma ögonblick som den släpps: en mätning då är 12 px
     för låg. När inglidningen sedan var klar stod rubriken 12 px närmare
     raden än den var lagd, tätt intill den i stället för med luft
     (2026-09-29, mätt i adminvyn; samma i de två andra). */
  function platsUtanInglidning(el) {
    var topp = el.getBoundingClientRect().top;
    var t = window.getComputedStyle(el).translate;
    if (t && t !== 'none') topp -= parseFloat(t.split(' ')[1]) || 0;
    return topp;
  }

  /* Hur mycket av skärmens överkant som är täckt: sidhuvudet, och på en
     telefon sektionsraden, som står fast under det sedan 2026-09-28
     (TUMMEN i nextrum-arbetsyta.css). Utan raden hade en ny sektion
     lagts med rubriken bakom den. Den lodräta menyn på en dator står
     bredvid innehållet, inte över det, och räknas inte.

     Adminvyns topprad (.adm-topp) står fast högst upp när man är inne,
     och då är sajtens sidhuvud gömt (dess nederkant blir 0). Den räknas
     där den STÅR när den klistrat (top + höjd), inte där den ligger just
     nu. Utan den landade rubriken bakom raden vid varje byte från ett
     scrollat läge (2026-09-28). Under den står sektionsraden på en
     telefon, som i de två andra vyerna, och räknas som där. */
  function täcktÖverst() {
    var hdr = document.querySelector('.hdr');
    var nederkant = hdr ? hdr.getBoundingClientRect().bottom : 72;
    var topp = document.querySelector('.adm-topp');
    if (topp && topp.offsetHeight) {
      var ts = window.getComputedStyle(topp);
      if (ts.position === 'sticky') {
        nederkant = Math.max(nederkant, (parseFloat(ts.top) || 0) + topp.offsetHeight);
      }
    }
    var sido = document.querySelector('.vy .vy-sido');
    if (sido) {
      var cs = window.getComputedStyle(sido);
      if (cs.position === 'sticky' && cs.flexDirection !== 'column') {
        nederkant = Math.max(nederkant, sido.getBoundingClientRect().bottom);
      }
    }
    return nederkant;
  }

  /* Håller ett element kvar på samma plats på skärmen medan något
     ovanför eller runt det ändrar höjd. Det är vad Chrome gör av sig
     själv (scroll anchoring) och vad Safari inte gör alls — därför
     för hand, på de ställen där en knapp gör sidan kortare: ett
     formulär som stängs, "Visa färre", en lista som ritas om.

     jobb får vara synkront eller returnera ett löfte. */
  function håll(ankare, jobb) {
    var före = ankare && ankare.isConnected ? ankare.getBoundingClientRect().top : null;
    function rätta() {
      if (före === null || !ankare.isConnected) return;
      var skillnad = ankare.getBoundingClientRect().top - före;
      if (Math.abs(skillnad) > 1) scrollaTill(window.scrollY + skillnad);
    }
    var svar = jobb ? jobb() : null;
    if (svar && typeof svar.then === 'function') {
      return svar.then(function (v) { rätta(); return v; });
    }
    rätta();
    return svar;
  }

  /* håll() för en lista som ett filter eller ett sök kan göra mycket
     kortare. håll() kan inte scrolla förbi sidans slut: blir sidan
     kortare än det som står ovanför skärmens underkant klämmer
     webbläsaren scrollen, och det man tryckte på flyttar sig uppåt.
     Mätt 2026-09-29 i adminvyns Betalningar och Månadens ekonomi, med
     scroll anchoring avstängd som i Safari: 146 till 588 px. Listan
     behåller därför höjden tills tomrummet ligger under skärmkanten,
     som Bekräftade i familjens vy (rbBytMånad).

     Ankaret ska stå kvar när listan ritas om: chipraden, inte chippet,
     som ritas om med den. jobb ska vara synkront, för höjden mäts när
     det är klart. släppLista() tar bort reserven när listan ritas om av
     något annat, till exempel en ny månad. */
  var reserver = [];
  function släppLista(lista) {
    reserver = reserver.filter(function (r) {
      if (r.lista !== lista) return true;
      lista.style.minHeight = '';
      return false;
    });
  }
  function hållLista(lista, ankare, jobb) {
    if (!lista) return håll(ankare, jobb);
    /* Mäts med en reserv som redan står kvar, och släpps först inne i
       håll(): släppt före mätningen hade sidan krympt och klämt
       scrollen innan håll() ens sett var ankaret stod. */
    var förut = lista.offsetHeight;
    var underSkärmen = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
    return håll(ankare, function () {
      släppLista(lista);
      var svar = jobb ? jobb() : null;
      var reserv = Math.max(0, förut - lista.offsetHeight - underSkärmen);
      if (reserv) {
        lista.style.minHeight = (lista.offsetHeight + reserv) + 'px';
        reserver.push({ lista: lista, reserv: reserv });
      }
      return svar;
    });
  }
  window.addEventListener('scroll', function () {
    if (!reserver.length) return;
    reserver = reserver.filter(function (r) {
      if (r.lista.isConnected && r.lista.getBoundingClientRect().bottom - r.reserv < window.innerHeight) return true;
      r.lista.style.minHeight = '';
      return false;
    });
  }, { passive: true });

  /* ---------- alla rader, inte de tusen första (2026-09-29) ----------
     Leo: "de raderna ska inte försvinna efter 1000st". PostgREST lämnar
     ut högst tusen rader per svar (max-rows), och svaret säger inte att
     det finns fler: det ser helt ut. Adminvyn hämtade passen,
     anmälningarna och resten med en fråga var, nyast först, så den dag
     det fanns fler än tusen hade de äldsta försvunnit ur Lektioner,
     Ekonomi och Löner utan att något blev rött. Studiehjälparvyn hämtar
     sina pass äldst först, och där hade det varit de NYA som försvann:
     passen att svara på och rapportera.

     Sida efter sida tills databasens eget antal är nått (count på första
     sidan). Antalet avgör, inte en kort sida: sänks max-rows under
     sidans storlek är varje sida kort, och en hjälpare som slutade vid
     första korta sidan hade kapat igen, lika tyst. Nästa sida börjar
     efter så många rader som faktiskt kom.

     Sorteringen slutar alltid på nyckeln (id, om inget annat anges):
     sidorna är egna frågor, och två pass samma dag kan annars byta plats
     mellan dem, så att ett kommer med två gånger och ett annat inte alls.
     Skrivs en rad mellan två sidor kan den sista på en sida komma igen
     först på nästa; den tas bort på nyckeln, så nyckeln ska finnas bland
     kolumnerna. Tas en rad bort mellan två sidor kan en annan hoppas
     över till nästa hämtning. Det är priset för sidor, och det rättar
     sig självt.

     bygg(q) lägger till filter och sortering. Svaret har samma form som
     supabase-js ({ data, error }), och ett fel på en senare sida ger
     felet, aldrig halva listan: en kapad lista är det här ska hindra.
     Frågor med en avsiktlig gräns (de senaste 400 meddelandena, de
     senaste 20 rapporterna) går inte hit: där är gränsen poängen.

     supa skickas in, som till notisval: resten av filen rör ingen
     databas. */
  var SIDA = 1000;

  async function hämtaAlla(supa, tabell, kolumner, bygg, nyckel) {
    nyckel = nyckel || 'id';
    var rader = [];
    var från = 0, totalt = Infinity, sidor = 0;
    while (från < totalt) {
      var q = supa.from(tabell).select(kolumner, från === 0 ? { count: 'exact' } : undefined);
      if (bygg) q = bygg(q);
      var svar = await q.order(nyckel).range(från, från + SIDA - 1);
      if (svar.error) return { data: null, error: svar.error };
      var del = svar.data || [];
      if (från === 0 && typeof svar.count === 'number') totalt = svar.count;
      if (!del.length) break;
      Array.prototype.push.apply(rader, del);
      från += del.length;
      sidor++;
    }
    if (sidor < 2) return { data: rader, error: null };
    var sedda = new Set();
    return {
      data: rader.filter(function (r) {
        var k = r[nyckel];
        if (k == null) return true;
        if (sedda.has(k)) return false;
        sedda.add(k);
        return true;
      }),
      error: null
    };
  }

  /* Passen med svaret på förslaget (avbokningar_och_svar, 2026-09-30).
     Vyerna driftsätts när grenen mergas, migrationen körs efteråt för
     hand, och en fråga efter en kolumn som inte finns ger 42703 för HELA
     listan: "Kunde inte hämta passen" i båda vyerna. Saknas kolumnerna
     hämtas passen utan dem, och S.svarSaknas säger till vyn att svaret
     inte går att skriva än. */
  var SVARSKOLUMNER = ', avbokad_fran, motforslag_at, svar_meddelande';
  async function passMedSvar(supa, S, kolumner, bygg) {
    var svar = await hämtaAlla(supa, 'bookings', kolumner + SVARSKOLUMNER, bygg);
    var kod = svar.error && svar.error.code;
    if (kod === '42703' || kod === 'PGRST204') {
      S.svarSaknas = true;
      return hämtaAlla(supa, 'bookings', kolumner, bygg);
    }
    S.svarSaknas = false;
    return svar;
  }

  /* ---------- månadsväljaren (Fas 20.2) ----------
     Leo 2026-09-27: "man ska inte kunna se rapporter från juli idag i
     september ... gör det snyggt så man kan välja den månaden man vill
     kolla för." Den innevarande månaden är förvald, och den man väljer
     är den som visas. Två former: stegaren (o.stegare) i studievyn och
     studiehjälparvyn, och fältet med en ruta för år och månad i
     adminvyn (sedan 2026-10-06; förut en rad med en knapp per månad).

     Månaden skickas som 'ÅÅÅÅ-MM-01'. månadsGräns() ger första dagen i
     månaden och första dagen i nästa, att fråga med gte och lt.

     o.antal     hur många månader bakåt, med den innevarande (12)
     o.alla      true: alla månader från FÖRSTA_MÅNAD, i stället för antal
     o.årFramåt  till och med december så många år efter det
                 innevarande (1 = hela nästa år), i stället för till
                 och med den innevarande månaden
     o.framåt    så många månader till efter det (0)
     o.vald      förvald månad, 'ÅÅÅÅ-MM-01' (den innevarande)
     o.märke     fn(månad) → '' | text: ett litet märke på månaden,
                 t.ex. "Stängd" i adminvyn
     o.vidVal    fn(månad): anropas när en annan månad väljs */
  function månadIso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
  }
  function månadsGräns(iso) {
    var d = new Date(String(iso).slice(0, 7) + '-01T12:00:00');
    var nästa = new Date(d.getFullYear(), d.getMonth() + 1, 1, 12);
    return { från: månadIso(d), till: månadIso(nästa) };
  }
  function månadsNamn(iso, medÅr) {
    var d = new Date(String(iso).slice(0, 7) + '-01T12:00:00');
    var namn = NX.MANADER[d.getMonth()];
    return medÅr === false ? namn : namn + ' ' + d.getFullYear();
  }
  /* Stegaren (2026-09-28, o.stegare): ‹ September 2026 › i stället för
     tolv knappar i en rad man drar i sidled. I studiehjälparvyn låg
     raden i en flik som var dold när den ritades, så den innevarande
     månaden hamnade utanför kanten till höger, och på en telefon syntes
     tre månader av tolv. Samma svar utåt (vald, sätt, märk) som
     adminvyns fält, så att anroparen inte märker skillnaden. */
  function månadsstegare(host, o, lista, vald, denna) {
    host.classList.add('nx-manad-stegare');
    host.setAttribute('role', 'group');
    if (!host.getAttribute('aria-label')) host.setAttribute('aria-label', 'Välj månad');
    function rita(fokus) {
      var n = lista.indexOf(vald);
      host.innerHTML =
        '<button type="button" class="nx-steg-pil" data-steg="-1" aria-label="Förra månaden"' + (n <= 0 ? ' disabled' : '') + '>' + IKON.tillbaka + '</button>'
        + '<span class="nx-steg-namn" aria-live="polite"><b>' + esc(månadsNamn(vald)) + '</b>'
        + '<small class="nx-manad-marke" hidden></small></span>'
        + '<button type="button" class="nx-steg-pil" data-steg="1" aria-label="Nästa månad"' + (n >= lista.length - 1 ? ' disabled' : '') + '>' + IKON.pil + '</button>'
        /* Tillbaka till i dag: från juli är september fyra tryck bort.
           Knappen står alltid och tar sin plats, osynlig på den
           innevarande: annars dök den upp efter första trycket och sköt
           ner allt under raden på en telefon. */
        + '<button type="button" class="nx-steg-nu" data-manad="' + denna + '"'
        + (vald === denna ? ' tabindex="-1" aria-hidden="true" data-dold' : '') + '>Den här månaden</button>';
      märk();
      if (fokus) {
        var k = host.querySelector('[data-steg="' + fokus + '"]:not([disabled])') || host.querySelector('.nx-steg-pil:not([disabled])');
        if (k) k.focus();
      }
    }
    function märk() {
      if (!o.märke) return;
      var i = host.querySelector('.nx-manad-marke');
      var text = o.märke(vald) || '';
      i.textContent = text;
      i.hidden = !text;
    }
    function sätt(m, tyst, fokus) {
      if (lista.indexOf(m) === -1 || m === vald) return;
      vald = m;
      rita(fokus);
      if (!tyst && o.vidVal) o.vidVal(vald);
    }
    host.addEventListener('click', function (e) {
      var pil = e.target.closest('[data-steg]');
      if (pil) { sätt(lista[lista.indexOf(vald) + Number(pil.dataset.steg)], false, pil.dataset.steg); return; }
      var nu = e.target.closest('[data-manad]');
      if (nu) sätt(nu.dataset.manad);
    });
    rita();
    return {
      vald: function () { return vald; },
      sätt: function (m) { sätt(m, true); },
      märk: märk
    };
  }

  /* Ingen väljare börjar före september 2026 (Leo 2026-09-29: "ta bort
     allt som inte är från september 2026 och framåt"). Det är månaden
     de första passen hölls, och varje månad före den var tom i varje
     vy. Kontrollerat i driften samma dag: inget pass, underlag, faktura
     eller köp ligger före den, så gränsen döljer ingenting. En väljare
     kan fortfarande få månader framåt (o.framåt, o.årFramåt). */
  var FÖRSTA_MÅNAD = '2026-09-01';

  function månadsval(host, o) {
    o = o || {};
    if (!host) return null;
    var nu = new Date();
    var denna = månadIso(nu);
    var vald = o.vald || denna;
    /* alla (2026-09-29): adminvyns väljare har varje månad sedan
       starten. Med tolv hade september 2026 fallit ur Betalningar,
       Månadens ekonomi och Löner i september 2027, och en månad som ska
       gå att visa i sju år hade inte gått att välja.
       årFramåt (2026-10-06): till och med december så många år fram.
       Leo: "man måste kunna se flera månader framåt och år". */
    var start = o.alla ? FÖRSTA_MÅNAD
      : månadIso(new Date(nu.getFullYear(), nu.getMonth() - (o.antal || 12) + 1, 1, 12));
    if (start < FÖRSTA_MÅNAD) start = FÖRSTA_MÅNAD;
    var bas = o.årFramåt != null ? new Date(nu.getFullYear() + o.årFramåt, 11, 1, 12) : nu;
    var slut = månadIso(new Date(bas.getFullYear(), bas.getMonth() + (o.framåt || 0), 1, 12));
    var lista = [];
    for (var d = new Date(start + 'T12:00:00'); månadIso(d) <= slut; d = new Date(d.getFullYear(), d.getMonth() + 1, 1, 12)) {
      lista.push(månadIso(d));
    }
    if (!lista.length) lista.push(denna);
    if (lista.indexOf(vald) === -1) vald = lista.indexOf(denna) !== -1 ? denna : lista[lista.length - 1];
    if (o.stegare) return månadsstegare(host, o, lista, vald, denna);
    return månadsfält(host, o, lista, vald, denna);
  }

  /* Fältet (2026-10-06). Adminvyns väljare var en rad med en knapp per
     månad sedan september 2026, som man drog i sidled, och den växte
     med en knapp i månaden. Leo: "en kolumn där man ser år och månad
     just nu, och om man trycker på den kan man ändra månad och år", och
     att man ska kunna se flera månader framåt och år. Nu står den valda
     månaden i ett fält med pilar till månaden före och efter, och
     fältet öppnar en ruta med året och dess tolv månader. En månad
     utanför väljaren står grå i rutan: augusti 2026 finns, men inget
     ligger där.

     Märket (Stängd, Utbetald, 2 saknas) står under namnet i fältet och
     på varje månad i rutan. Fältet har fast bredd: pilen till höger hade
     annars flyttat sig under fingret när namnet byter längd (CLAUDE.md
     avsnitt 3, fälla 4). Rutan ligger ovanpå sidan, så inget under
     fältet flyttar sig när den öppnas, och den byggs om bara när året
     byts; märkena skrivs i de knappar som står.

     Samma svar utåt som stegaren (vald, sätt, märk), och finns(m) för
     länkarna till en annan månad. */
  var månadsfältNr = 0;

  function månadsfält(host, o, lista, vald, denna) {
    var nr = ++månadsfältNr;
    var årAv = function (m) { return Number(String(m).slice(0, 4)); };
    var förstaÅr = årAv(lista[0]);
    var sistaÅr = årAv(lista[lista.length - 1]);
    var visatÅr = årAv(vald);
    var märkeFör = function (m) { return o.märke && lista.indexOf(m) !== -1 ? (o.märke(m) || '') : ''; };

    host.classList.add('nx-manadsval');
    host.setAttribute('role', 'group');
    if (!host.getAttribute('aria-label')) host.setAttribute('aria-label', 'Välj månad');
    host.innerHTML =
      '<button type="button" class="nx-steg-pil" data-steg="-1" aria-label="Förra månaden">' + IKON.tillbaka + '</button>'
      + '<button type="button" class="nx-manad-falt" aria-haspopup="dialog" aria-expanded="false"'
      + ' aria-controls="nx-manad-ruta-' + nr + '">' + IKON.dag
      + '<span class="nx-manad-namn"><b></b><small class="nx-manad-marke" hidden></small></span>'
      + IKON.ner + '</button>'
      + '<button type="button" class="nx-steg-pil" data-steg="1" aria-label="Nästa månad">' + IKON.pil + '</button>'
      + '<div class="nx-manad-ruta" id="nx-manad-ruta-' + nr + '" role="dialog" aria-label="Välj månad och år" hidden>'
      + '<div class="nx-manad-arrad">'
      + '<button type="button" class="nx-steg-pil" data-ar="-1" aria-label="Förra året">' + IKON.tillbaka + '</button>'
      + '<b class="nx-manad-aret" aria-live="polite"></b>'
      + '<button type="button" class="nx-steg-pil" data-ar="1" aria-label="Nästa år">' + IKON.pil + '</button>'
      + '</div>'
      + '<div class="nx-manad-grid"></div>'
      + (lista.indexOf(denna) !== -1
        ? '<button type="button" class="nx-manad-nu" data-manad="' + denna + '">Den här månaden</button>' : '')
      + '</div>';
    var fält = host.querySelector('.nx-manad-falt');
    var ruta = host.querySelector('.nx-manad-ruta');
    var grid = ruta.querySelector('.nx-manad-grid');

    function ritaFält() {
      var text = märkeFör(vald);
      fält.querySelector('b').textContent = månadsNamn(vald);
      var i = fält.querySelector('.nx-manad-marke');
      i.textContent = text;
      i.hidden = !text;
      fält.setAttribute('aria-label', månadsNamn(vald) + (text ? ', ' + text : '') + '. Välj en annan månad');
      var n = lista.indexOf(vald);
      host.querySelector('[data-steg="-1"]').disabled = n <= 0;
      host.querySelector('[data-steg="1"]').disabled = n >= lista.length - 1;
    }
    /* Årets tolv knappar. Byggs när rutan öppnas och när året byts. */
    function ritaÅret() {
      ruta.querySelector('.nx-manad-aret').textContent = visatÅr;
      ruta.querySelector('[data-ar="-1"]').disabled = visatÅr <= förstaÅr;
      ruta.querySelector('[data-ar="1"]').disabled = visatÅr >= sistaÅr;
      var h = '';
      for (var i = 0; i < 12; i++) {
        var m = visatÅr + '-' + String(i + 1).padStart(2, '0') + '-01';
        h += '<button type="button" data-manad="' + m + '"' + (m === denna ? ' data-denna' : '') + '>'
          + '<span>' + esc(NX.MANADER[i]) + '</span><i class="nx-manad-marke" hidden></i></button>';
      }
      grid.innerHTML = h;
      märkRutan();
    }
    function märkRutan() {
      Array.prototype.forEach.call(grid.querySelectorAll('[data-manad]'), function (b) {
        var m = b.dataset.manad;
        var text = märkeFör(m);
        var i = b.querySelector('.nx-manad-marke');
        i.textContent = text;
        i.hidden = !text;
        b.disabled = lista.indexOf(m) === -1;
        b.setAttribute('aria-pressed', m === vald ? 'true' : 'false');
        b.setAttribute('aria-label', månadsNamn(m) + (text ? ', ' + text : '') + (b.disabled ? ', finns inte' : ''));
      });
    }

    function öppen() { return !ruta.hidden; }
    function utanför(e) { if (!host.contains(e.target)) stäng(false); }
    function öppna() {
      visatÅr = årAv(vald);
      ritaÅret();
      ruta.hidden = false;
      fält.setAttribute('aria-expanded', 'true');
      document.addEventListener('pointerdown', utanför, true);
      /* Står fältet långt ned på skärmen syns rutan inte. Sidan flyttas
         precis så mycket att den gör det, utan animering (avsnitt 3,
         fälla 3: ingen mjuk scrollning i vyerna). */
      var r = ruta.getBoundingClientRect();
      if (r.bottom > window.innerHeight - 8) window.scrollBy(0, Math.min(r.bottom - window.innerHeight + 16, r.top - 72));
      var k = grid.querySelector('[aria-pressed="true"]') || grid.querySelector('button:not(:disabled)');
      if (k) k.focus({ preventScroll: true });
    }
    function stäng(fokus) {
      if (!öppen()) return;
      ruta.hidden = true;
      fält.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', utanför, true);
      if (fokus) fält.focus({ preventScroll: true });
    }
    function sätt(m, tyst) {
      if (lista.indexOf(m) === -1 || m === vald) return;
      vald = m;
      ritaFält();
      if (öppen()) märkRutan();
      if (!tyst && o.vidVal) o.vidVal(vald);
    }

    host.addEventListener('click', function (e) {
      if (e.target.closest('.nx-manad-falt')) { if (öppen()) stäng(true); else öppna(); return; }
      var steg = e.target.closest('[data-steg]');
      if (steg) { stäng(false); sätt(lista[lista.indexOf(vald) + Number(steg.dataset.steg)]); return; }
      var år = e.target.closest('[data-ar]');
      if (år) {
        visatÅr = Math.min(sistaÅr, Math.max(förstaÅr, visatÅr + Number(år.dataset.ar)));
        ritaÅret();
        /* Vid första eller sista året blir pilen grå och tappar fokus. */
        if (år.disabled) {
          var andra = ruta.querySelector('[data-ar]:not(:disabled)');
          if (andra) andra.focus();
        }
        return;
      }
      var b = e.target.closest('[data-manad]');
      if (b && !b.disabled) { stäng(true); sätt(b.dataset.manad); }
    });
    host.addEventListener('keydown', function (e) {
      if (!öppen()) return;
      if (e.key === 'Escape') { e.preventDefault(); stäng(true); return; }
      /* Pilarna flyttar i rutnätet, tre månader per rad. */
      var b = e.target.closest('.nx-manad-grid [data-manad]');
      var steg = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[e.key];
      if (!b || !steg) return;
      var knappar = Array.prototype.slice.call(grid.querySelectorAll('[data-manad]'));
      var mål = knappar[knappar.indexOf(b) + steg];
      e.preventDefault();
      if (mål && !mål.disabled) mål.focus();
    });
    /* Tabbar man ut ur rutan stängs den. */
    host.addEventListener('focusout', function (e) {
      if (öppen() && e.relatedTarget && !host.contains(e.relatedTarget)) stäng(false);
    });

    ritaFält();
    return {
      vald: function () { return vald; },
      sätt: function (m) { sätt(m, true); },
      märk: function () { ritaFält(); if (öppen()) märkRutan(); },
      finns: function (m) { return lista.indexOf(m) !== -1; }
    };
  }

  /* ---------- bekräftelse ----------
     Egen ruta i stället för confirm(): den går att skriva på svenska,
     den ser ut som resten av sajten, och den kan säga vad som faktiskt
     försvinner. Returnerar ett löfte som blir true eller false. */
  function bekräfta(opts) {
    var o = opts || {};
    return new Promise(function (klar) {
      var ruta = document.createElement('div');
      ruta.className = 'nx-fraga';
      ruta.innerHTML =
        '<div class="nx-fraga-box" role="alertdialog" aria-modal="true" aria-labelledby="fraga-t">'
        + '<h3 id="fraga-t">' + esc(o.titel || 'Är du säker?') + '</h3>'
        + (o.text ? '<p>' + esc(o.text) + '</p>' : '')
        /* Förhandsvisning: text som ska läsas exakt som den står,
           med sina radbrytningar. Ett <p> hade klämt ihop ett helt
           fakturamejl till en enda mening. Fortfarande escapad —
           innehållet kommer från servern, inte från oss. */
        + (o.forhandsvisning
          ? '<pre class="nx-fraga-prov">' + esc(o.forhandsvisning) + '</pre>' : '')
        + '<div class="nx-fraga-knappar">'
        + '<button type="button" class="btn btn-ghost" data-svar="nej">' + esc(o.avbryt || 'Avbryt') + '</button>'
        + '<button type="button" class="btn btn-primary" data-svar="ja">' + esc(o.knapp || 'Ta bort') + '</button>'
        + '</div></div>';

      var sistaFokus = document.activeElement;
      function stäng(svar) {
        ruta.remove();
        document.body.style.overflow = '';
        document.removeEventListener('keydown', tangent);
        if (sistaFokus && sistaFokus.focus) sistaFokus.focus();
        klar(svar);
      }
      function tangent(e) {
        if (e.key === 'Escape') stäng(false);
        if (e.key === 'Tab') {
          var kan = ruta.querySelectorAll('button');
          var f = kan[0], s = kan[kan.length - 1];
          if (e.shiftKey && document.activeElement === f) { e.preventDefault(); s.focus(); }
          else if (!e.shiftKey && document.activeElement === s) { e.preventDefault(); f.focus(); }
        }
      }

      ruta.addEventListener('click', function (e) {
        if (e.target === ruta) return stäng(false);
        var k = e.target.closest('[data-svar]');
        if (k) stäng(k.dataset.svar === 'ja');
      });
      document.addEventListener('keydown', tangent);

      document.body.appendChild(ruta);
      document.body.style.overflow = 'hidden';
      void ruta.offsetWidth;
      ruta.classList.add('open');
      ruta.querySelector('[data-svar="nej"]').focus();
    });
  }

  /* ---------- avbokning med skäl (2026-09-24) ----------
     Ett avbokat pass säger varför, och skälet följer med i mejlet
     till den som inte avbokade. Skälet är en FAST KOD, aldrig
     fritext: det står i auditloggen, som inte går att rätta, och i
     ett mejl där bara det renData() släpper igenom får stå. En ruta
     att skriva i hade blivit en väg att skriva ett barns hälsa i en
     inkorg.

     Att avböja en tid motparten föreslagit är något annat och frågar
     inte efter skäl: det passet fanns aldrig. Databasen gör samma
     skillnad (skydda_bokningsfalt).

     Koderna speglar bookings_avbokningsskal_check. De två sista är
     Nextrums egna och visas bara i adminvyn; databasen nekar dem från
     en familj eller en studiehjälpare. */
  var AVBOKNINGSSKÄL = [
    ['sjukdom', 'Sjukdom'],
    ['forhinder', 'Förhinder'],
    ['ombokat', 'Behöver en annan tid'],
    ['annat', 'Annat']
  ];
  var AVBOKNINGSSKÄL_ADMIN = [
    ['ingen_hjalpare', 'Ingen studiehjälpare'],
    ['familjen_avslutar', 'Familjen avslutar']
  ];

  /* Koden i ord, för passets sida. Samma ord som i rutan där skälet
     valdes, så att den som avbokade känner igen sitt eget val. */
  function skälText(kod) {
    var hit = AVBOKNINGSSKÄL.concat(AVBOKNINGSSKÄL_ADMIN).filter(function (v) { return v[0] === kod; })[0];
    return hit ? hit[1] : null;
  }

  /* Returnerar ett löfte som blir skälets kod, eller null om man
     ångrade sig. */
  function avbokaRuta(opts) {
    var o = opts || {};
    var val = o.admin ? AVBOKNINGSSKÄL.concat(AVBOKNINGSSKÄL_ADMIN) : AVBOKNINGSSKÄL;
    return new Promise(function (klar) {
      var valt = null;
      var ruta = document.createElement('div');
      ruta.className = 'nx-fraga';
      ruta.innerHTML =
        '<div class="nx-fraga-box" role="dialog" aria-modal="true" aria-labelledby="avb-t">'
        + '<h3 id="avb-t">' + esc(o.titel || 'Avboka passet?') + '</h3>'
        + (o.text ? '<p>' + esc(o.text) + '</p>' : '')
        + '<fieldset class="nx-skal"><legend>Varför avbokas passet?</legend>'
        + '<div class="chips">'
        + val.map(function (v) {
            return '<button type="button" class="chip" aria-pressed="false" data-skal="' + v[0] + '">'
              + esc(v[1]) + '</button>';
          }).join('')
        + '</div></fieldset>'
        + (o.not ? '<p class="nx-skal-not">' + esc(o.not) + '</p>' : '')
        + '<p class="ok-msg" id="avb-msg" role="alert"></p>'
        + '<div class="nx-fraga-knappar">'
        + '<button type="button" class="btn btn-ghost" data-avb="nej">' + esc(o.avbryt || 'Behåll passet') + '</button>'
        + '<button type="button" class="btn btn-primary" data-avb="ja">' + esc(o.knapp || 'Avboka') + '</button>'
        + '</div></div>';

      var sistaFokus = document.activeElement;
      function stäng(svar) {
        ruta.remove();
        document.body.style.overflow = '';
        document.removeEventListener('keydown', tangent);
        if (sistaFokus && sistaFokus.focus) sistaFokus.focus();
        klar(svar);
      }
      function tangent(e) {
        if (e.key === 'Escape') stäng(null);
        if (e.key === 'Tab') {
          var kan = ruta.querySelectorAll('button');
          var f = kan[0], s = kan[kan.length - 1];
          if (e.shiftKey && document.activeElement === f) { e.preventDefault(); s.focus(); }
          else if (!e.shiftKey && document.activeElement === s) { e.preventDefault(); f.focus(); }
        }
      }

      ruta.addEventListener('click', function (e) {
        if (e.target === ruta) return stäng(null);
        var skäl = e.target.closest('[data-skal]');
        if (skäl) {
          valt = skäl.dataset.skal;
          ruta.querySelectorAll('[data-skal]').forEach(function (k) {
            k.setAttribute('aria-pressed', String(k === skäl));
          });
          NX.rensa(ruta.querySelector('#avb-msg'));
          return;
        }
        var k = e.target.closest('[data-avb]');
        if (!k) return;
        if (k.dataset.avb === 'nej') return stäng(null);
        /* Knappen är inte avstängd innan ett skäl valts. En avstängd
           knapp säger inte varför den inte går att trycka på. */
        if (!valt) {
          NX.säg(ruta.querySelector('#avb-msg'), 'Välj ett skäl först.', false);
          ruta.querySelector('[data-skal]').focus();
          return;
        }
        stäng(valt);
      });
      document.addEventListener('keydown', tangent);

      document.body.appendChild(ruta);
      document.body.style.overflow = 'hidden';
      void ruta.offsetWidth;
      ruta.classList.add('open');
      ruta.querySelector('[data-skal]').focus();
    });
  }

  /* ---------- svaret på en föreslagen tid (2026-09-30) ----------
     Studiehjälparen som avslår en tid familjen föreslagit skriver
     varför, och kan skriva några rader med ett motförslag. Fritext, till
     skillnad från avbokningens skäl ovan: "den tiden har jag träning" är
     inget av fyra fasta skäl, och familjen har bett om en tid. Därför
     står texten bara i vyn. Inget mejl, ingen notis och ingen rad i
     auditloggen bär den, och databasen tömmer den efter 30 dagar
     (intern.svar_gallra). Databasen kräver den vid ett avslag och håller
     taket (skydda_bokningsfalt); rutan säger samma sak innan.

     maxlength räknar UTF-16, Postgres räknar tecken: en emoji är två
     här och en där, så taket här är aldrig högre än databasens. */
  var SVAR_MAX = 500;

  function svarFält(id, värde, etikett, valfritt) {
    var v = String(värde || '');
    return '<div class="nx-svar-falt">'
      + '<label for="' + id + '">' + esc(etikett) + (valfritt ? ' <em>valfritt</em>' : '') + '</label>'
      + '<textarea class="inp" id="' + id + '" rows="4" maxlength="' + SVAR_MAX + '" data-svar-text'
      + ' aria-describedby="' + id + '-antal">' + esc(v) + '</textarea>'
      + '<span class="nx-svar-antal" id="' + id + '-antal" data-svar-antal>' + v.length + '/' + SVAR_MAX + '</span>'
      + '</div>';
  }

  // Räknaren följer texten. En lyssnare på rutan, så att den överlever att rutan ritas om.
  function räknaSvar(ruta, efter) {
    ruta.addEventListener('input', function (e) {
      if (!e.target.matches('[data-svar-text]')) return;
      var antal = e.target.parentNode.querySelector('[data-svar-antal]');
      if (antal) antal.textContent = e.target.value.length + '/' + SVAR_MAX;
      if (efter) efter(e.target.value);
    });
  }

  function rensaSvar(text) { return String(text || '').replace(/^\s+|\s+$/g, ''); }

  /* Returnerar texten, eller null om man ångrade sig. */
  function svarRuta(opts) {
    var o = opts || {};
    return new Promise(function (klar) {
      var ruta = document.createElement('div');
      ruta.className = 'nx-fraga';
      ruta.innerHTML =
        '<div class="nx-fraga-box" role="dialog" aria-modal="true" aria-labelledby="svar-t">'
        + '<h3 id="svar-t">' + esc(o.titel || 'Avslå tiden?') + '</h3>'
        + (o.text ? '<p>' + esc(o.text) + '</p>' : '')
        + svarFält('svar-text', o.varde, o.etikett || 'Varför passar tiden inte?', false)
        + (o.not ? '<p class="nx-skal-not">' + esc(o.not) + '</p>' : '')
        + '<p class="ok-msg" id="svar-msg" role="alert"></p>'
        + '<div class="nx-fraga-knappar">'
        + '<button type="button" class="btn btn-ghost" data-svr="nej">' + esc(o.avbryt || 'Tillbaka') + '</button>'
        + '<button type="button" class="btn btn-primary" data-svr="ja">' + esc(o.knapp || 'Avslå') + '</button>'
        + '</div></div>';

      var fält = ruta.querySelector('textarea');
      var sistaFokus = document.activeElement;
      function stäng(svar) {
        ruta.remove();
        document.body.style.overflow = '';
        document.removeEventListener('keydown', tangent);
        if (sistaFokus && sistaFokus.focus) sistaFokus.focus();
        klar(svar);
      }
      function tangent(e) {
        if (e.key === 'Escape') stäng(null);
        if (e.key === 'Tab') {
          var kan = ruta.querySelectorAll('textarea, button');
          var f = kan[0], s = kan[kan.length - 1];
          if (e.shiftKey && document.activeElement === f) { e.preventDefault(); s.focus(); }
          else if (!e.shiftKey && document.activeElement === s) { e.preventDefault(); f.focus(); }
        }
      }

      räknaSvar(ruta, function () { NX.rensa(ruta.querySelector('#svar-msg')); });
      ruta.addEventListener('click', function (e) {
        if (e.target === ruta) return stäng(null);
        var k = e.target.closest('[data-svr]');
        if (!k) return;
        if (k.dataset.svr === 'nej') return stäng(null);
        /* Knappen är inte avstängd medan rutan är tom, av samma skäl som
           avbokningens: en avstängd knapp säger inte varför. */
        var text = rensaSvar(fält.value);
        if (!text) {
          NX.säg(ruta.querySelector('#svar-msg'), 'Skriv några rader till familjen först.', false);
          fält.focus();
          return;
        }
        if (text.length > SVAR_MAX) {
          NX.säg(ruta.querySelector('#svar-msg'), 'Högst ' + SVAR_MAX + ' tecken.', false);
          fält.focus();
          return;
        }
        stäng(text);
      });
      document.addEventListener('keydown', tangent);

      document.body.appendChild(ruta);
      document.body.style.overflow = 'hidden';
      void ruta.offsetWidth;
      ruta.classList.add('open');
      fält.focus();
    });
  }

  /* ---------- knapp som håller på ----------
     Låser knappen, byter texten, och släpper igen när det är klart —
     även om det gick fel. Utan det andra argumentet står den kvar
     låst för alltid när något kastar. */
  async function medan(knapp, text, jobb) {
    if (!knapp) return jobb();
    /* Ett betalval (.vy-valk, 2026-09-28) har en rubrik och en rad
       under. Med textContent på hela knappen försvann ikonen och raden,
       och tillbaka kom en enda sammanslagen textrad. Rubriken bär
       data-medan och är det enda som byter text. */
    var mål = knapp.querySelector('[data-medan]') || knapp;
    var original = mål.textContent;
    /* aria-busy stoppar musen (.btn[aria-busy] i nextrum.css), inte
       Enter på en knapp som har fokus: två tryck blev två skrivningar,
       och den andra ett fel om ett svar som redan gått fram
       (2026-09-30). En knapp stängs av; en länk har ingen disabled. */
    var avstängd = knapp.tagName === 'BUTTON' ? knapp.disabled : null;
    knapp.setAttribute('aria-busy', 'true');
    if (avstängd !== null) knapp.disabled = true;
    mål.textContent = text;
    try {
      return await jobb();
    } finally {
      knapp.removeAttribute('aria-busy');
      if (avstängd !== null) knapp.disabled = avstängd;
      mål.textContent = original;
    }
  }

  /* ---------- validering ----------
     Meddelandena står på svenska och pekar på fältet, aldrig på
     databasen. "Error 422" säger ingenting till en förälder. */
  function kolla(regler) {
    for (var i = 0; i < regler.length; i++) {
      var r = regler[i];
      if (r.fel) {
        if (r.falt && r.falt.focus) r.falt.focus();
        return r.text;
      }
    }
    return null;
  }

  /* ============================================================
     FLYTTA ETT PASS

     Samma kalender som bokningen: dagar med lediga tider har en
     prick, man trycker på en dag och sedan på en tid. Passets egen
     tid räknas som ledig, så att man kan byta dag och behålla
     klockan. Bara lediga tider ritas.

     Förut var det ett datumfält och en rullgardin, sedan en veckovy.
     Leo ville ha en vanlig kalender, och det är den här.
     ============================================================ */
  /* opts.meddelande ({ etikett, varde }): en valfri rad till motparten,
     bara där databasen tar emot den, alltså när studiehjälparen svarar
     på familjens förslag med en annan tid (2026-09-30). Rutan ritas om
     vid varje tryck, så texten hålls i en variabel och inte i fältet. */
  function flyttaRuta(opts) {
    var o = opts || {};
    return new Promise(function (klar) {
      var idag = isoFor(new Date());
      var meddelande = o.meddelande ? String(o.meddelande.varde || '') : null;
      var månad = NXArbete.månadFör(o.datum && o.datum >= idag ? o.datum : idag);
      var dag = o.datum && o.datum >= idag ? o.datum : null;
      var valt = null;

      var ruta = document.createElement('div');
      ruta.className = 'nx-fraga';
      document.body.appendChild(ruta);

      /* Lediga tider en dag, med passets egna timmar räknade som
         lediga — annars gick det inte att bara byta dag, eller att
         skjuta ett tvåtimmarspass en timme. Alla timmar passet täcker
         är dess egna, inte bara den första. */
      var timmar = Math.max(1, Math.ceil((Number(o.minuter) || 60) / 60));
      var egna = new Set();
      var start = Number(String(o.tid || '').slice(0, 2));
      if (o.datum && o.tid && !isNaN(start)) {
        for (var j = 0; j < timmar; j++) egna.add(o.datum + '|' + String(start + j).padStart(2, '0') + ':00');
      }
      /* Varje timme från 11 på vardagar och 9 på helger till 22, samma
         lista som förslaget i bokningen (NXArbete.HELA_DAGEN).
         Studiehjälparens veckoschema finns inte
         kvar, och ett motförslag som bara fick ligga inom ett schema
         som inte längre går att ändra hade varit ett motförslag som
         inte går att ge. */
      function lediga(datum) {
        var upptagna = o.upptagna || new Set();
        return NX.tiderFörDatum(datum, NXArbete.HELA_DAGEN, [], o.minuter)
          .filter(function (t) {
            var h0 = Number(String(t).slice(0, 2));
            for (var i = 0; i < timmar; i++) {
              var nyckel = datum + '|' + String(h0 + i).padStart(2, '0') + ':00';
              if (egna.has(nyckel)) continue;
              if (upptagna.has(nyckel)) return false;
            }
            return true;
          });
      }

      function rita() {
        var ärNy = valt && !(valt.datum === o.datum && valt.tid === o.tid);
        ruta.innerHTML =
          '<div class="nx-fraga-box nx-fraga-bred" role="dialog" aria-modal="true" aria-labelledby="flytt-t">'
          + '<h3 id="flytt-t">' + esc(o.titel || 'Flytta passet') + '</h3>'
          + '<p>' + (o.fraga ? esc(o.fraga) + ' ' : 'Passet ligger nu ')
          + '<b>' + esc(datumText(o.datum)) + ' kl. ' + esc(String(o.tid || '').slice(0, 5)) + '</b>. '
          + 'Välj en ny dag och tid — motparten får bekräfta den.</p>'
          + '<div class="bk-kal nx-flytt-kal">'
          + '<div class="bk-kal-manad">'
          + NXArbete.manad({
              manad: månad,
              valt: dag,
              prefix: 'fl',
              minManad: NXArbete.månadFör(idag),
              maxManad: NXArbete.plusMånader(NXArbete.månadFör(idag), 2),
              /* Ingen prick: utan schema är ingen dag mer ledig än
                 en annan. */
              dag: function (iso) {
                return { klickbar: iso >= idag && lediga(iso).length > 0, prick: false };
              }
            })
          + '</div>'
          + '<div class="bk-kal-dag">'
          + NXArbete.tidsrad({
              datum: dag,
              tider: dag ? lediga(dag) : [],
              vald: valt && valt.datum === dag ? valt.tid : (dag === o.datum ? o.tid : null),
              välj: 'Välj en dag i kalendern.',
              tom: 'Inga tider kvar den dagen.'
            })
          + '</div>'
          + '</div>'
          + (meddelande !== null ? svarFält('fl-svar', meddelande, o.meddelande.etikett || 'Några rader till familjen', true) : '')
          + '<p class="ok-msg" id="fl-msg"></p>'
          + '<div class="nx-fraga-knappar">'
          + '<button type="button" class="btn btn-ghost" data-flytt="nej">Avbryt</button>'
          + '<button type="button" class="btn btn-primary" data-flytt="ja"'
          + (ärNy ? '' : ' disabled') + '>' + esc(o.knapp || 'Flytta passet') + '</button>'
          + '</div></div>';
      }

      function stäng(svar) {
        ruta.remove();
        document.body.style.overflow = '';
        document.removeEventListener('keydown', tangent);
        klar(svar);
      }
      function tangent(e) { if (e.key === 'Escape' && document.body.contains(ruta)) stäng(null); }

      ruta.addEventListener('click', function (e) {
        if (e.target === ruta) return stäng(null);

        var tid = e.target.closest('.mv-tid');
        if (tid && !tid.disabled) {
          valt = { datum: tid.dataset.datum, tid: tid.dataset.tid };
          rita();
          return;
        }
        var d = e.target.closest('.mv-dag');
        if (d && !d.disabled) {
          dag = d.dataset.datum;
          if (valt && valt.datum !== dag) valt = null;
          rita();
          return;
        }
        if (e.target.closest('#fl-forr') || e.target.closest('#fl-nasta')) {
          var ny = NXArbete.plusMånader(månad, e.target.closest('#fl-forr') ? -1 : 1);
          if (ny < NXArbete.månadFör(idag)) return;
          månad = ny;
          rita();
          return;
        }

        var k = e.target.closest('[data-flytt]');
        if (!k) return;
        if (k.dataset.flytt === 'nej') return stäng(null);
        if (!valt) return;
        if (valt.datum === o.datum && valt.tid === o.tid) {
          NX.säg(ruta.querySelector('#fl-msg'), '⚠️ Det är samma tid som passet redan har.', false);
          return;
        }
        var svar = { datum: valt.datum, tid: valt.tid };
        if (meddelande !== null) svar.meddelande = rensaSvar(meddelande).slice(0, SVAR_MAX) || null;
        stäng(svar);
      });

      räknaSvar(ruta, function (v) { meddelande = v; });
      document.addEventListener('keydown', tangent);

      rita();
      document.body.style.overflow = 'hidden';
      void ruta.offsetWidth;
      ruta.classList.add('open');
    });
  }

  /* ============================================================
     ETT PASS I DETALJ
     Öppnas från schemat. Visar det man behöver veta, och tar EMOT
     knapparnas markup i stället för att bygga egna: vyerna har redan
     delegerade hanterare för bekräfta, flytta och avboka, och en
     andra uppsättning hade förr eller senare hamnat ur synk med den
     första.

     Därför stängs rutan efter att klicket hunnit bubbla vidare. Tas
     noden bort direkt når händelsen aldrig document, och knappen gör
     ingenting.
     ============================================================ */
  function passRuta(opts) {
    var o = opts || {};
    var ruta = document.createElement('div');
    ruta.className = 'nx-fraga';

    var fakta = (o.rader || [])
      .filter(function (r) { return r && r[1]; })
      .map(function (r) {
        return '<div class="pass-fakta-rad"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>';
      }).join('');

    ruta.innerHTML =
      '<div class="nx-fraga-box nx-passbox" role="dialog" aria-modal="true" aria-labelledby="pass-t">'
      + '<h3 id="pass-t">' + esc(o.titel || 'Passet') + '</h3>'
      + (o.under ? '<p>' + esc(o.under) + '</p>' : '')
      + (fakta ? '<div class="pass-fakta">' + fakta + '</div>' : '')
      + (o.anteckning
          ? '<div class="pass-block"><h6>Anteckning</h6><p>' + esc(o.anteckning) + '</p></div>' : '')
      + (o.rapport
          ? '<div class="pass-block"><h6>Efter passet</h6><p>' + esc(o.rapport) + '</p></div>' : '')
      + (o.laxor && o.laxor.length
          ? '<div class="pass-block"><h6>Uppgifter omkring passet</h6>'
            + o.laxor.map(function (h) {
                return '<div class="pass-lank">' + esc(h.title)
                  + (h.due_date ? '<span>Till ' + esc(deadlineText(h.due_date)) + '</span>' : '')
                  + '</div>';
              }).join('') + '</div>'
          : '')
      + '<div class="nx-fraga-knappar">'
      + '<button type="button" class="btn btn-ghost" data-pass-stang>Stäng</button>'
      + (o.atgarder || '')
      + '</div></div>';

    var sistaFokus = document.activeElement;
    function stäng() {
      if (!document.body.contains(ruta)) return;
      /* En knapp här kan ha öppnat nästa ruta — avboka-frågan, flytta
         eller rapporten. Då äger den fokus och scrollspärren, och den
         släpper dem själv när den stängs. */
      var annan = Array.prototype.some.call(
        document.querySelectorAll('.nx-fraga.open'),
        function (x) { return x !== ruta; });
      ruta.remove();
      document.removeEventListener('keydown', tangent);
      if (annan) return;
      document.body.style.overflow = '';
      if (sistaFokus && sistaFokus.focus) sistaFokus.focus();
    }
    function tangent(e) { if (e.key === 'Escape') stäng(); }

    ruta.addEventListener('click', function (e) {
      if (e.target === ruta) return stäng();
      if (!e.target.closest('button')) return;
      /* Låt klicket nå document först — det är där de riktiga
         hanterarna sitter. */
      setTimeout(stäng, 0);
    });
    document.addEventListener('keydown', tangent);

    document.body.appendChild(ruta);
    document.body.style.overflow = 'hidden';
    void ruta.offsetWidth;
    ruta.classList.add('open');
    var f = ruta.querySelector('[data-pass-stang]');
    if (f) f.focus();
    return { stäng: stäng };
  }

  /* ============================================================
     PASSETS EGEN SIDA

     Leo 2026-09-24: "på mina lektioner tycker jag det ska byggas en
     individuell sida, lite mer avancerad, där man kan hantera
     inbokade lektioner, trycka på dem och se information om dem.
     Samt avboka och föreslå en ny tid där." Och för studiehjälparen:
     "trycka in på lektionen för att se mer information om tid, ämne,
     var man ska ses, dag, eleven man har."

     Rutan ovan (passRuta) var en sammanfattning ovanpå listan. Det
     här är en SIDA: en egen sektion med egen adress (#pass/<id>), så
     att bakåtknappen tar en tillbaka till listan och en länk i ett
     mejl kan peka rakt på passet.

     Ren ritning. Vyerna äger datan och vet vad som får göras; här
     bestäms bara hur det ser ut, så att en familj och en
     studiehjälpare som tittar på samma pass ser samma sida med olika
     knappar — inte två sidor som glidit isär.

     Knapparna bär samma data-attribut som i listorna (data-flytta,
     data-avboka, data-betala …). De delegerade hanterarna som redan
     finns tar hand om dem. En andra uppsättning logik för samma
     skrivning hade varit en andra uppsättning som kan bli fel.

     o: {
       host, tillbaka: { href, text },
       titel, nar, relativ, lage: { text, klass },
       steg:    [{ namn, klar, nu }],      vägen passet går
       besked:  { text, ton },             vad som väntar, på vem
       atgarder: html,                     knapparna
       alternativ: html,                   ett andra val under knapparna,
                                           t.ex. faktura i stället för kort
       kort:    [{ rubrik, rader: [[etikett, värde]] }],
                                           värde är text, eller { href, text }
                                           för möteslänken (Fas 18.1)
       block:   [{ rubrik, html, forst }]  anteckning, rapport, läxor. forst:
                                           under beskedet i stället för sist
     }

     Sedan 2026-09-28 (innehållet i vyerna, Leo: "det behöver se bra ut
     på mobil och enkelt att använda") också:
       datum:   'YYYY-MM-DD'               datumrutan bredvid rubriken
       val:     html                       betalvalen som stora knappar
                                           (NXStudie.betalval), i beskedets
                                           ruta under texten
       belopp:  { etikett, text }          "Att betala 379 kr" i samma ruta
       fakta:   [{ ikon, etikett, varde, under }]
                                           i stället för kort: ett kort med
                                           När, Var, Vem och Pris, en ikon
                                           var. varde som i kort
       fot:     html                       det som inte är ett drag just nu
                                           (föreslå ny tid, skriv, avboka),
                                           stilla, sist på sidan
     Ett drag överst och resten nedanför: på en telefon stod förut fem
     knappar i full bredd under beskedet, och Avboka var lika stor som
     Betala.
     ============================================================ */

  /* Ett värde i ett kort är text. Möteslänken är det enda som är en
     länk, och den blir det bara om adressen är https: mötesRad nedan
     har redan prövat att den leder till meet.google.com, och det här
     är andra gången. Allt annat escapas, som förut. */
  function radVärde(v) {
    if (v && typeof v === 'object') {
      if (!/^https:\/\//.test(String(v.href || ''))) return esc(v.text || '');
      return '<a class="ps-lank" href="' + esc(v.href) + '" target="_blank" rel="noopener noreferrer">'
        + esc(v.text || v.href) + '</a>';
    }
    return esc(v);
  }

  function passSida(o) {
    var host = o && o.host;
    if (!host) return;

    /* Ett gjort steg får en bock: strecket ensamt sa inte om det var
       gjort eller pågick, bara i färgen. */
    var steg = (o.steg || []).map(function (s) {
      return '<li class="ps-steg' + (s.klar ? ' ar-klar' : '') + (s.nu ? ' ar-nu' : '') + '"'
        + (s.nu ? ' aria-current="step"' : '') + '>'
        + '<span class="ps-steg-prick" aria-hidden="true"></span>'
        + (s.klar ? IKON.bock : '') + esc(s.namn) + '</li>';
    }).join('');

    var kort = (o.kort || []).map(function (k) {
      var rader = (k.rader || []).filter(function (r) { return r && r[1]; });
      if (!rader.length) return '';
      return '<div class="ps-kort"><h6>' + esc(k.rubrik) + '</h6>'
        + rader.map(function (r) {
            return '<div class="ps-rad"><span>' + esc(r[0]) + '</span><b>' + radVärde(r[1]) + '</b></div>';
          }).join('')
        + '</div>';
    }).join('');

    var fakta = (o.fakta || []).filter(function (f) { return f && f.varde; }).map(function (f) {
      return '<div class="ps-fakta-rad">'
        + '<span class="ps-fakta-ik">' + (IKON[f.ikon] || IKON.info) + '</span>'
        + '<span class="ps-fakta-text"><span class="ps-fakta-et">' + esc(f.etikett) + '</span>'
        + '<span class="ps-fakta-v">' + radVärde(f.varde) + '</span>'
        + (f.under ? '<small>' + radVärde(f.under) + '</small>' : '')
        + '</span></div>';
    }).join('');

    /* Ett block med forst står direkt under beskedet, före fakta: på
       ett genomfört pass är det rapporten, som beskedet ber en läsa. */
    function blockHtml(först) {
      return (o.block || []).filter(function (b) { return b && b.html && !!b.forst === först; }).map(function (b) {
        return '<div class="ps-block"><h6>' + esc(b.rubrik) + '</h6>' + b.html + '</div>';
      }).join('');
    }
    var blockFörst = blockHtml(true), block = blockHtml(false);

    /* Datumrutan, samma som i listorna men större. */
    var dagRuta = '';
    if (o.datum) {
      var d = new Date(String(o.datum) + 'T12:00:00');
      if (!isNaN(d)) {
        dagRuta = '<span class="ps-dag" aria-hidden="true"><small>' + esc(VECKODAGAR[d.getDay()].slice(0, 3)) + '</small>'
          + '<b>' + d.getDate() + '</b><small>' + esc((NX.MANADER[d.getMonth()] || '').slice(0, 3)) + '</small></span>';
      }
    }

    host.innerHTML =
      '<a class="ps-tillbaka" href="' + esc(o.tillbaka ? o.tillbaka.href : '#') + '">'
      + '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M7.5 2.5 4 6l3.5 3.5"/></svg>'
      + esc(o.tillbaka ? o.tillbaka.text : 'Tillbaka') + '</a>'
      + '<div class="ps-huvud' + (dagRuta ? ' har-dag' : '') + '">'
      + dagRuta
      + '<div class="ps-huvud-text">'
      + '<h2 class="ps-titel" tabindex="-1">' + esc(o.titel || 'Passet') + '</h2>'
      + '<p class="ps-nar">' + esc(o.nar || '')
      + (o.relativ ? ' <em>· ' + esc(o.relativ) + '</em>' : '') + '</p>'
      + '</div>'
      + (o.lage ? '<span class="lage ' + esc(o.lage.klass || '') + '">' + esc(o.lage.text) + '</span>' : '')
      + '</div>'
      + (steg ? '<ol class="ps-vag" aria-label="Var passet står">' + steg + '</ol>' : '')
      + (o.besked || o.atgarder || o.val
          ? '<div class="ps-gor' + (o.besked && o.besked.ton ? ' ar-' + esc(o.besked.ton) : '') + '">'
            + (o.belopp
                ? '<div class="ps-gor-topp">' + (o.besked ? '<p>' + esc(o.besked.text) + '</p>' : '<span></span>')
                  + '<span class="ps-belopp"><small>' + esc(o.belopp.etikett) + '</small><b>' + esc(o.belopp.text) + '</b></span></div>'
                : (o.besked ? '<p>' + esc(o.besked.text) + '</p>' : ''))
            + (o.val ? '<div class="vy-betalval">' + o.val + '</div>' : '')
            + (o.atgarder ? '<div class="ps-knappar">' + o.atgarder + '</div>' : '')
            /* Under knapparna, inte bland dem (Fas 14.6). En knapp i
               .ps-knappar blir full bredd på en telefon, och "Betala med
               faktura i stället" är ett andra val, inte ett andra steg. */
            + (o.alternativ ? '<div class="ps-alt">' + o.alternativ + '</div>' : '')
            + '</div>'
          : '')
      + blockFörst
      + (fakta ? '<div class="ps-block"><h6>Om passet</h6><div class="vy-kort ps-fakta">' + fakta + '</div></div>'
          : kort ? '<div class="ps-kortrad">' + kort + '</div>' : '')
      + block
      + (o.fot ? '<div class="ps-fot">' + o.fot + '</div>' : '');
  }

  /* ============================================================
     MÖTESLÄNKEN (Fas 18.1)

     Varje bekräftat onlinepass får en egen Google Meet-länk, och den
     står på passets sida hos både familjen och studiehjälparen. Förut
     stod där "Länken kommer i meddelanden" och "Skicka länken i
     meddelanden", och en länk i en chatt ska letas fram fem minuter
     innan passet. Här bestäms när länken behövs, hur den hämtas och
     hur raden ser ut, så att de två vyerna aldrig säger olika saker om
     samma pass.

     Två steg. Först pass_moten, med den inloggades egen token: finns
     länken är det en vanlig läsning. Annars edge-funktionen
     google-meet, som skapar den — och som svarar att Google inte är
     kopplat tills någon kopplat det under System → Integrationer. Då
     står vyns gamla text kvar.

     supa skickas in, som till notisval. Resten av filen rör ingen
     databas.

     En hittad länk sparas medan sidan är öppen: den ändras inte. Ett
     svar UTAN länk sparas en minut. Utan den minuten hade varje
     omritning frågat funktionen igen, och klar() ritar om; ett fel
     hade blivit en slinga av anrop. Efter minuten frågar nästa besök
     på passet igen, så att en koppling som gjorts medan fliken stått
     öppen syns utan att någon laddar om.

     En länk blir bara en länk om den är https://meet.google.com/…
     Databasen och funktionen prövar samma form. Tre gånger är med
     flit: det här är dörren in till ett barns pass.
     ============================================================ */
  var MEET = /^https:\/\/meet\.google\.com\/[a-z]+-[a-z]+-[a-z]+$/;
  var MÖTE_UTAN_MS = 60000;
  var möten = {};

  /* Ett bekräftat onlinepass som inte har varit. Idag räknas med: ett
     pass klockan fyra behöver länken klockan fyra. */
  function behöverMöte(b) {
    return !!b && b.status === 'confirmed' && b.format === 'Online'
      && String(b.wanted_date || '') >= isoFor(new Date());
  }

  function mötetFör(id) {
    var m = möten[id];
    if (m && m.läge === 'utan' && Date.now() > m.till) { delete möten[id]; return null; }
    return m || null;
  }

  /* Hämtar länken om passet behöver en och svaret inte redan finns.
     klar() anropas när ett nytt svar kommit, så att vyn kan rita om;
     finns svaret redan händer ingenting. Kastar aldrig: går något fel
     står vyns egen text kvar, och varför står i adminvyn. */
  function hämtaMöte(supa, b, klar) {
    if (!supa || !behöverMöte(b) || mötetFör(b.id)) return;
    var m = { läge: 'hämtar', lank: null, till: 0 };
    möten[b.id] = m;

    supa.from('pass_moten').select('lank').eq('booking_id', b.id).maybeSingle()
      .then(function (r) {
        if (r && r.data && MEET.test(r.data.lank || '')) return r.data.lank;
        return supa.functions.invoke('google-meet', { body: { pass: b.id } }).then(function (s) {
          return s && !s.error && s.data && MEET.test(s.data.lank || '') ? s.data.lank : null;
        });
      })
      .catch(function () { return null; })
      .then(function (lank) {
        if (lank) { m.läge = 'klar'; m.lank = lank; }
        else { m.läge = 'utan'; m.till = Date.now() + MÖTE_UTAN_MS; }
        if (typeof klar === 'function') klar();
      });
  }

  /* Raden i kortet om var man ses: [etikett, värde], eller null när
     passet inte har eller behöver någon länk. reserv är vyns egen
     text för när länken inte finns — familjen och studiehjälparen gör
     olika saker då. Ett avbokat, genomfört eller passerat pass får
     ingen rad: där hade en länk bara varit något att trycka fel på. */
  function mötesRad(b, reserv) {
    if (!b || b.format !== 'Online') return null;
    if (b.status === 'requested' && String(b.wanted_date || '') >= isoFor(new Date())) {
      return ['Möte', 'Länken kommer när passet är bekräftat'];
    }
    if (!behöverMöte(b)) return null;
    var m = mötetFör(b.id);
    if (m && m.läge === 'klar') return ['Möte', { href: m.lank, text: m.lank.replace(/^https:\/\//, '') }];
    if (m && m.läge === 'utan') return ['Möte', reserv];
    return ['Möte', 'Hämtar länken…'];
  }

  /* "idag", "imorgon", "om 3 dagar", "för 2 veckor sedan". Räknat i
     kalenderdagar, inte timmar: ett pass imorgon klockan åtta är
     imorgon även klockan 23 kvällen före. */
  function relativDag(iso) {
    if (!iso) return '';
    var idag = new Date(isoFor(new Date()) + 'T12:00:00');
    var dag = new Date(String(iso) + 'T12:00:00');
    var n = Math.round((dag - idag) / 86400000);
    if (n === 0) return 'idag';
    if (n === 1) return 'imorgon';
    if (n === -1) return 'igår';
    if (n > 1 && n < 14) return 'om ' + n + ' dagar';
    if (n >= 14) return 'om ' + Math.round(n / 7) + ' veckor';
    if (n > -14) return 'för ' + (-n) + ' dagar sedan';
    return 'för ' + Math.round(-n / 7) + ' veckor sedan';
  }

  /* "onsdag 1 oktober". Veckodagen först: en förälder planerar i
     veckor, och "1 oktober" säger inte om det krockar med fotbollen. */
  var VECKODAGAR = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
  function dagMedVeckodag(iso) {
    if (!iso) return '';
    return VECKODAGAR[new Date(String(iso) + 'T12:00:00').getDay()] + ' ' + datumText(iso);
  }

  /* Rapportens omdöme, samma ord som i formuläret studiehjälparen
     fyller i (GICK i nextrum-larare-vy.js). */
  var GICK = { mycket_bra: 'Mycket bra', bra: 'Bra', folja_upp: 'Behöver följas upp' };

  /* ============================================================
     IKONERNA I INNEHÅLLET (2026-09-28)
     Samma streckikoner som sidomenyn, 24-rutan och strecket från CSS.
     aria-hidden på alla: texten bredvid säger samma sak.
     ============================================================ */
  function ikon(d) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>'; }
  var IKON = {
    dag: ikon('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3.5v3M16 3.5v3"/>'),
    tid: ikon('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v4.7l3 1.8"/>'),
    online: ikon('<rect x="3.5" y="6.5" width="12" height="11" rx="2.5"/><path d="m15.5 10.5 5-3v9l-5-3z"/>'),
    plats: ikon('<path d="M4 11.5 12 5l8 6.5"/><path d="M6 10v9.5h12V10"/><path d="M10 19.5v-5h4v5"/>'),
    mal: ikon('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8"/>'),
    nasta: ikon('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    bock: ikon('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
    dubbelbock: ikon('<path d="m3.5 12.5 4 4L15 9"/><path d="m10.5 16.5 1 0L20.5 7.5"/>'),
    flagga: ikon('<path d="M6 20.5V4"/><path d="M6 4.5h11l-2.5 4 2.5 4H6"/>'),
    kort: ikon('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10.5h18M6.5 14.5h3"/>'),
    faktura: ikon('<path d="M7 3.5h10A1.5 1.5 0 0 1 18.5 5v14.5l-3-2-3 2-3-2-3 2V5A1.5 1.5 0 0 1 7 3.5z"/><path d="M9 8.5h6M9 12h6"/>'),
    timmar: ikon('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3.5 13.5V3.5h10l7.1 7.1a2 2 0 0 1 0 2.8z"/><circle cx="8" cy="8" r="1.4"/>'),
    bank: ikon('<path d="M4 9.5 12 4l8 5.5"/><path d="M5.5 10v7M10 10v7M14 10v7M18.5 10v7M4 19.5h16"/>'),
    rapport: ikon('<path d="M14 3.5H6.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V9z"/><path d="M14 3.5V9h5.5M8.5 14.5l2.5 2.5 4.5-4.5"/>'),
    skriv: ikon('<path d="M14 3.5H6.5v17h11V7z"/><path d="M14 3.5V7h3.5"/><path d="M9 12.5h6M9 16h4"/>'),
    forslag: ikon('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3.5v3M16 3.5v3"/><path d="M10.2 13.6a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.3M12 18.6h.01"/>'),
    lax: ikon('<path d="M4.5 6.5 6 8l2.5-2.5M4.5 12.5 6 14l2.5-2.5M4.5 18.5 6 20l2.5-2.5M11.5 7h8M11.5 13h8M11.5 19h8"/>'),
    meddelande: ikon('<path d="M20.5 12c0 3.9-3.8 7-8.5 7a9.8 9.8 0 0 1-2.6-.35L4.5 20l1.2-3.3A6.6 6.6 0 0 1 3.5 12c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7z"/>'),
    vem: ikon('<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19c0-3 2.5-5.4 5.5-5.4s5.5 2.4 5.5 5.4"/><circle cx="16.5" cy="8" r="2.6"/><path d="M15.5 13.7c2.8-.2 5 1.8 5 4.8"/>'),
    trend: ikon('<path d="M3.5 16.5 9 11l3.5 3.5L20 7"/><path d="M15.5 7H20v4.5"/>'),
    pil: ikon('<path d="m9 6 6 6-6 6"/>'),
    tillbaka: ikon('<path d="m15 6-6 6 6 6"/>'),
    ner: ikon('<path d="m6 9 6 6 6-6"/>'),
    lås: ikon('<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
    info: ikon('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>')
  };
  var GICK_IKON = { mycket_bra: 'dubbelbock', bra: 'bock', folja_upp: 'flagga' };

  var stor = function (s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };
  var hm = function (t) { return String(t || '').slice(0, 5); };
  function minuterAv(t) {
    var d = hm(t).split(':');
    return Number(d[0]) * 60 + Number(d[1] || 0);
  }
  function längdText(min) {
    var m = Math.max(0, Math.round(Number(min) || 0));
    var h = Math.floor(m / 60), rest = m % 60;
    if (!h) return rest + ' min';
    if (!rest) return h === 1 ? '1 timme' : h + ' timmar';
    return h + ' h ' + rest + ' min';
  }

  /* ============================================================
     RAPPORTEN SOM ETT BREV (2026-09-28)

     Samma kort överallt där en rapport läses: under Bekräfta rapport,
     under Efter passen och på passets sida. Förut låg rapporten i en
     ruta i en ruta i en panel, och omdömet var en fetstilad rad bland
     de andra. Nu står vem som skrev, när och hur det gick överst, sedan
     texten och de två sakerna att ta med sig: Öva mer på och Nästa gång.

     Den hållna tiden (Fas 20.1) blir en tidslinje, men bara när den
     skiljer sig från det bokade eller har ett skäl. Annars står tiden i
     raden överst, som när passet hölls. Skälet är studiehjälparens egen
     text, i en pratbubbla med vem som skrev den, så att den inte läses
     som Nextrums besked.

     o: { titel, vem: { namn, bild }, meta: [text | { ikon, text }],
          gick, text, trana, nasta, tid, attr, fot }
       tid: { start, slut, bokat, deb, bank, skal, skalAv } i minuter och
            'HH:MM[:SS]', eller null
       attr: färdig attributtext på kortet (data-rb-rapport)
       fot: färdig HTML i kortets fot, eller inget
     All text escapas här; bara attr och fot är färdig HTML.
     ============================================================ */
  function rapportKort(o) {
    var meta = (o.meta || []).filter(Boolean).map(function (m) {
      return typeof m === 'string' ? '<span>' + esc(m) + '</span>'
        : '<span>' + (IKON[m.ikon] || '') + esc(m.text) + '</span>';
    }).join('');
    var gick = o.gick && GICK[o.gick]
      ? '<span class="rb-omdome ar-' + esc(o.gick) + '">' + IKON[GICK_IKON[o.gick]] + esc(GICK[o.gick]) + '</span>'
      : '';
    var duo = [
      o.trana ? '<div><span class="rb-duo-ik">' + IKON.mal + '</span><div><small>Öva mer på</small><b>' + esc(o.trana) + '</b></div></div>' : '',
      o.nasta ? '<div><span class="rb-duo-ik">' + IKON.nasta + '</span><div><small>Nästa gång</small><b>' + esc(o.nasta) + '</b></div></div>' : ''
    ].join('');
    var avatar = avatarFör(o.vem);

    return '<article class="vy-kort rb-brev"' + (o.attr ? ' ' + o.attr : '') + '>'
      + '<div class="vy-kort-kropp">'
      + '<div class="rb-huvud">' + avatar
      + '<div class="rb-vem"><p class="rb-titel">' + esc(o.titel || 'Pass') + '</p>'
      + (meta ? '<p class="rb-meta">' + meta + '</p>' : '') + '</div>'
      + gick + '</div>'
      + (o.text ? '<p class="rb-text">' + esc(o.text) + '</p>' : '<p class="rb-text ar-tom">Rapporten är tom.</p>')
      + (duo ? '<div class="rb-duo">' + duo + '</div>' : '')
      + tidslinje(o.tid, avatarFör(o.vem, true))
      + '</div>'
      + (o.fot ? '<div class="vy-kort-fot rb-fot">' + o.fot + '</div>' : '')
      + '</article>';
  }

  /* En rad som leder någonstans (2026-09-28): ikon, rubrik, vad det
     gäller och vart den leder. Att göra på Översikt i båda vyerna.
     Texten i länken göms på en telefon, pilen står kvar.
     o: { href, ikon, ton ('ockra'|'mossa'|'tyst'), titel, meta: [text], lank } */
  function radLank(o) {
    return '<a class="vy-rad" href="' + esc(o.href) + '">'
      + '<span class="vy-rad-ik' + (o.ton ? ' ar-' + esc(o.ton) : '') + '">' + (IKON[o.ikon] || IKON.info) + '</span>'
      + '<span class="vy-rad-mitt"><span class="vy-rad-titel">' + esc(o.titel) + '</span>'
      + '<span class="vy-rad-meta">' + (o.meta || []).filter(Boolean).map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('') + '</span></span>'
      + '<span class="vy-rad-hoger"><span class="vy-lank"><span class="vy-lank-text">' + esc(o.lank || '') + '</span>' + IKON.pil + '</span></span></a>';
  }

  /* NXMedia laddas efter den här filen; när ett kort ritas finns den. */
  function avatarFör(vem, liten) {
    if (!vem || !window.NXMedia || !window.NXMedia.avatar) return '';
    return window.NXMedia.avatar(vem.namn, vem.bild, liten ? { liten: true } : undefined);
  }

  function tidslinje(t, avatar) {
    if (!t || !t.start || !t.slut) return '';
    var start = minuterAv(t.start), slut = minuterAv(t.slut);
    var hållet = Math.max(slut - start, 0);
    var bokat = Number(t.bokat) || 0, deb = Number(t.deb) || 0, bank = Number(t.bank) || 0;
    var avviker = !!(bokat && deb && deb !== bokat);
    if (!avviker && !t.skal) return '';

    var skillnad = bokat ? hållet - bokat : 0;
    var rubrik = skillnad > 0 ? 'Passet blev ' + längdText(skillnad).replace(/^1 timme$/, 'en timme') + ' längre'
      : skillnad < 0 ? 'Passet blev ' + längdText(-skillnad).replace(/^1 timme$/, 'en timme') + ' kortare'
      : 'Passet hölls ' + hm(t.start) + '–' + hm(t.slut);
    var under = [bokat ? 'Bokat ' + längdText(bokat) : null,
      deb ? 'debiteras ' + längdText(deb) + (deb !== hållet ? ', per påbörjad kvart' : '') : null,
      bank ? längdText(bank) + ' ur timbanken' : null].filter(Boolean).join(' · ');

    /* Stapeln: det bokade i mossa, övertiden i lera. Ett kortare pass
       fyller det hållna och lämnar resten av det bokade tomt. */
    var total = Math.max(hållet, bokat, 1);
    var mossa = Math.min(hållet, bokat || hållet) / total * 100;
    var lera = bokat && hållet > bokat ? (hållet - bokat) / total * 100 : 0;
    var hhmm = function (m) { return (m / 60 < 10 ? '0' : '') + Math.floor(m / 60) + ':' + (m % 60 < 10 ? '0' : '') + (m % 60); };
    var kortare = Math.min(hållet, bokat || hållet), längre = Math.max(hållet, bokat);
    var mitt = kortare / total * 100;
    var skala = '<span>' + esc(hm(t.start)) + '</span>'
      + (bokat && kortare !== längre && mitt > 18 && mitt < 82
        ? '<span class="ar-mitt" style="left:' + mitt.toFixed(1) + '%">' + esc(hhmm(start + kortare)) + '</span>' : '')
      + '<span>' + esc(hhmm(start + längre)) + '</span>';

    return '<div class="rb-tid">'
      + '<div class="rb-tid-topp"><b>' + esc(rubrik) + '</b>' + (under ? '<span>' + esc(under) + '</span>' : '') + '</div>'
      + '<div class="rb-tid-bar" aria-hidden="true"><i class="rb-tid-bokat" style="width:' + mossa.toFixed(1) + '%"></i>'
      + (lera ? '<i class="rb-tid-extra" style="width:' + lera.toFixed(1) + '%"></i>' : '') + '</div>'
      + '<div class="rb-tid-skala" aria-hidden="true">' + skala + '</div>'
      + (t.skal ? '<div class="rb-tid-skal">' + (avatar || '') + '<p><small>' + esc((t.skalAv || 'Studiehjälparen') + ' skrev varför')
        + '</small>' + esc(t.skal) + '</p></div>' : '')
      + '</div>';
  }

  /* Ett betalval: en stor knapp med vad som händer på raden under.
     attr är knappens data-attribut, samma som de gamla knapparnas, så
     att samma hanterare tar dem. Rubriken bär data-medan (medan()). */
  function betalval(o) {
    return '<button type="button" class="vy-valk' + (o.först ? ' ar-forst' : '') + '" ' + o.attr + '>'
      + '<span class="vy-valk-ik">' + (IKON[o.ikon] || '') + '</span>'
      + '<span><b data-medan>' + esc(o.titel) + '</b>' + (o.under ? '<span>' + esc(o.under) + '</span>' : '') + '</span>'
      + '</button>';
  }

  /* "16:00–17:00". Längden står i minuter i databasen; ett pass utan
     längd finns inte sedan Fas 9.7, men en gammal rad ska inte bli
     "16:00–NaN". */
  function tidsspann(tid, minuter) {
    if (!tid) return '';
    var d = String(tid).slice(0, 5).split(':');
    var start = Number(d[0]) * 60 + Number(d[1] || 0);
    var slut = start + (Number(minuter) || 60);
    function hhmm(m) { return (m / 60 < 10 ? '0' : '') + Math.floor(m / 60) + ':' + (m % 60 < 10 ? '0' : '') + (m % 60); }
    return hhmm(start) + '–' + hhmm(slut);
  }

  /* En passrad som går att trycka på öppnar passets sida. Hela raden,
     inte bara rubriken — på en telefon är raden det man träffar.
     Knappar och länkar i raden gör sitt eget och öppnar inget. */
  document.addEventListener('click', function (e) {
    var rad = e.target.closest('.pass-klickbar[data-href]');
    if (!rad || e.target.closest('button, a, input, select, textarea, label')) return;
    location.hash = rad.dataset.href;
  });

  /* ============================================================
     SCHEMAT
     Kalendern som redan fanns är en bokningsväljare: välj en dag,
     välj en tid. Det här är det andra man vill av en kalender —
     att se vad som redan ligger där.

     Fyra lägen, samma data. Kommande för att se vad som ligger
     närmast, månad för att få överblick, vecka för att planera, dag
     för att se vad som faktiskt händer idag. Lägena är inte fyra
     komponenter utan fyra sätt att rita samma lista, så en bokning
     kan aldrig visas olika beroende på vilket läge man står i.

     KOMMANDE är förval sedan 2026-09-24. Leo: "på schema ska
     kommande pass stå, och namn på eleven under, t.ex. 15:00 Svenska,
     under Alma och under det plats". Månaden var förvalet, och på en
     telefon är en månadsruta 45 px bred: där fick bara klockslaget
     plats, aldrig vem eller var. Adminvyn och studievyn väljer
     fortfarande månad: hos familjen står schemat direkt under
     passlistan, och där hade Kommande bara upprepat raderna ovanför.

     opts: { host, bokningar, lage, namn(b), onOppna(b) }
     ============================================================ */
  var SCHEMA_LAGE = {
    requested: 'onskad', confirmed: 'bekraftad',
    completed: 'genomford', cancelled: 'avbokad'
  };

  function schema(opts) {
    var o = opts || {};
    var host = o.host;
    if (!host) return null;

    var LÄGEN = ['kommande', 'manad', 'vecka', 'dag'];
    var läge = LÄGEN.indexOf(o.lage) !== -1 ? o.lage : 'kommande';
    /* Hur många kommande pass som syns innan "Visa fler". */
    var KOMMANDE_FÖRST = 6;
    var kommandeAntal = KOMMANDE_FÖRST;
    var visad = new Date(); visad.setHours(12, 0, 0, 0);
    var bokningar = o.bokningar || [];

    function namnFör(b) { return typeof o.namn === 'function' ? (o.namn(b) || '') : ''; }

    /* Klockslaget utan sekunder. Postgres lämnar time som "16:00:00",
       och månadsrutan skrev ut det rakt av. */
    function klocka(b) { return String(b.wanted_time || '').slice(0, 5); }

    /* Var man ses, i ord. På plats utan adress säger det rakt ut — en
       tom rad hade sett ut som att platsen inte spelade någon roll. */
    function plats(b) {
      if (b.location) return b.location;
      if (b.format === 'Online') return 'Online';
      if (b.format === 'På plats') return 'På plats, adressen saknas';
      return 'Plats inte angiven';
    }

    /* En avbokad rad ska synas i historiken men inte skräpa i
       överblicken — den som tittar på månaden vill veta vad som
       gäller, inte vad som ställdes in. */
    function förDag(iso, medAvbokade) {
      return bokningar
        .filter(function (b) {
          if (String(b.wanted_date) !== iso) return false;
          return medAvbokade || b.status !== 'cancelled';
        })
        .sort(function (a, c) { return String(a.wanted_time || '').localeCompare(String(c.wanted_time || '')); });
    }

    function måndagFör(d) {
      var m = new Date(d);
      m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
      m.setHours(12, 0, 0, 0);
      return m;
    }

    function titel() {
      if (läge === 'kommande') return 'Kommande pass';
      if (läge === 'manad') return NX.MANADER[visad.getMonth()] + ' ' + visad.getFullYear();
      if (läge === 'dag') return NX.DAGAR[(visad.getDay() + 6) % 7] + ' ' + datumText(isoFor(visad));
      var m = måndagFör(visad), s = new Date(m); s.setDate(s.getDate() + 6);
      return datumText(isoFor(m)) + ' – ' + datumText(isoFor(s));
    }

    function flytta(steg) {
      if (läge === 'manad') visad.setMonth(visad.getMonth() + steg);
      else if (läge === 'vecka') visad.setDate(visad.getDate() + steg * 7);
      else visad.setDate(visad.getDate() + steg);
      rita();
    }

    function chip(b) {
      /* Ett genomfört pass på ett datum som passerat stryks. Månaden
         ska gå att läsa som "det här är gjort, det här är kvar" utan
         att man öppnar en ruta i taget — och ett avklarat pass som
         ser likadant ut som ett kommande är precis det som gör en
         kalender svårläst.

         Datumet måste vara med i villkoret. Ett pass kan rapporteras
         som genomfört samma dag det hålls, och att stryka dagens pass
         på förmiddagen hade sagt att det redan varit. */
      var passerat = b.status === 'completed'
        && String(b.wanted_date || '') < isoFor(new Date());

      /* Namnet står med men syns bara i veckan (CSS). I en månadsruta
         får det inte plats, i en veckorad gör det det. */
      var namn = namnFör(b);
      return '<button type="button" class="sch-pass ' + (SCHEMA_LAGE[b.status] || '')
        + (passerat ? ' ar-passerad' : '')
        + '" data-pass="' + esc(b.id) + '">'
        + '<i></i><b>' + esc(klocka(b)) + '</b>'
        + '<span>' + esc(b.subject || 'Pass') + '</span>'
        + (namn ? '<em>' + esc(namn) + '</em>' : '') + '</button>';
    }

    /* Ett kommande pass: klockslag och ämne, sedan vem, sedan var —
       i den ordningen, på var sin rad. Så läser man ett schema: när
       och vad, med vem, och vart man ska. */
    function kommandeRad(b) {
      var namn = namnFör(b);
      var förslag = b.status === 'requested';
      return '<button type="button" class="sch-kom ' + (SCHEMA_LAGE[b.status] || '') + '" data-pass="' + esc(b.id) + '">'
        + '<i aria-hidden="true"></i>'
        + '<span class="sch-kom-vad"><b>' + esc(tidsspann(b.wanted_time, b.duration_min)) + '</b> '
        + esc(b.subject || 'Pass') + '</span>'
        + (namn ? '<span class="sch-kom-namn">' + esc(namn) + '</span>' : '')
        + '<span class="sch-kom-plats">' + esc(plats(b)) + '</span>'
        + (förslag ? '<span class="sch-kom-lage">Förslag, inte bekräftat än</span>' : '')
        + '<svg class="sch-kom-pil" viewBox="0 0 14 14" aria-hidden="true"><path d="M5 3l4 4-4 4"/></svg>'
        + '</button>';
    }

    function ritaKommande() {
      var idag = isoFor(new Date());
      var imorgon = new Date(); imorgon.setDate(imorgon.getDate() + 1);
      var imorgonIso = isoFor(imorgon);
      var alla = bokningar
        .filter(function (b) {
          return String(b.wanted_date || '') >= idag && b.status !== 'cancelled' && b.status !== 'completed';
        })
        .sort(function (a, c) {
          return (String(a.wanted_date) + klocka(a)).localeCompare(String(c.wanted_date) + klocka(c));
        });
      if (!alla.length) {
        return '<div class="empty"><b>Inga kommande pass</b>'
          + '<br><span>Bokade pass och förslag som väntar på svar hamnar här.</span></div>';
      }
      var visade = alla.slice(0, kommandeAntal);
      var ut = '', förraDag = null;
      visade.forEach(function (b) {
        var dag = String(b.wanted_date);
        if (dag !== förraDag) {
          if (förraDag !== null) ut += '</div>';
          var namn = dagMedVeckodag(dag);
          var rubrik = dag === idag ? 'Idag · ' + namn : dag === imorgonIso ? 'Imorgon · ' + namn
            : namn.charAt(0).toUpperCase() + namn.slice(1);
          ut += '<h6 class="sch-kom-dag' + (dag === idag ? ' idag' : '') + '">' + esc(rubrik) + '</h6>'
            + '<div class="sch-kom-lista">';
          förraDag = dag;
        }
        ut += kommandeRad(b);
      });
      ut += '</div>';
      var kvar = alla.length - visade.length;
      if (kvar > 0) {
        ut += '<button type="button" class="btn btn-ghost btn-sm sch-kom-fler" data-sch-fler>'
          + 'Visa ' + Math.min(kvar, 10) + ' till' + (kvar > 10 ? ' av ' + kvar : '') + '</button>';
      }
      return '<div class="sch-kommande">' + ut + '</div>';
    }

    function ritaManad() {
      var år = visad.getFullYear(), mån = visad.getMonth();
      var första = new Date(år, mån, 1);
      var offset = (första.getDay() + 6) % 7;
      var dagar = new Date(år, mån + 1, 0).getDate();
      var idag = isoFor(new Date());

      var ut = NX.DAGAR.map(function (d) { return '<div class="dow">' + d + '</div>'; }).join('');
      for (var i = 0; i < offset; i++) ut += '<div class="sch-dag tom"></div>';

      for (var d = 1; d <= dagar; d++) {
        var iso = isoFor(new Date(år, mån, d));
        var pass = förDag(iso);
        /* data-sch-dag, inte data-dag: bokningskalendern i NX använder
           data-dag på sina dagrutor, och sedan schemat hamnade i samma
           sektion är en delad attributnamn en fälla som väntar. */
        ut += '<div class="sch-dag' + (iso === idag ? ' idag' : '') + '" data-sch-dag="' + iso + '">'
          + '<span class="sch-datum">' + d + '</span>'
          + pass.slice(0, 2).map(chip).join('')
          + (pass.length > 2
              ? '<button type="button" class="sch-fler" data-dag-oppna="' + iso + '">+'
                + (pass.length - 2) + ' till</button>'
              : '')
          + '</div>';
      }
      return '<div class="sch-manad">' + ut + '</div>';
    }

    function ritaVecka() {
      var m = måndagFör(visad);
      var idag = isoFor(new Date());
      var ut = '';
      for (var i = 0; i < 7; i++) {
        var d = new Date(m); d.setDate(d.getDate() + i);
        var iso = isoFor(d);
        var pass = förDag(iso);
        ut += '<div class="sch-rad' + (iso === idag ? ' idag' : '') + '">'
          + '<div class="sch-rad-dag"><b>' + NX.DAGAR[i] + '</b><span>' + d.getDate() + '</span></div>'
          + '<div class="sch-rad-pass">'
          + (pass.length ? pass.map(chip).join('') : '<span class="sch-tom">—</span>')
          + '</div></div>';
      }
      return '<div class="sch-vecka">' + ut + '</div>';
    }

    function ritaDag() {
      var iso = isoFor(visad);
      var pass = förDag(iso, true);
      if (!pass.length) {
        return '<div class="empty"><b>Inga pass den här dagen</b>'
          + '<br><span>Bläddra vidare, eller byt till månad för att se var de ligger.</span></div>';
      }
      return '<div class="sch-lista">' + pass.map(function (b) {
        return NXKontaktRad(b);
      }).join('') + '</div>';
    }

    /* Dagvyn visar hela raden, inte ett chip: det är den vyn man har
       framme när passet faktiskt ska hållas. */
    function NXKontaktRad(b) {
      var namn = namnFör(b);
      return '<button type="button" class="sch-full ' + (SCHEMA_LAGE[b.status] || '')
        + '" data-pass="' + esc(b.id) + '">'
        + '<span class="sch-full-tid">' + esc(klocka(b) || '—') + '</span>'
        + '<span class="sch-full-vad"><b>' + esc(b.subject || 'Pass') + '</b>'
        + (namn ? '<span>' + esc(namn) + '</span>' : '')
        + '<span>' + esc(plats(b) + ' · ' + (b.duration_min || 60) + ' min') + '</span></span>'
        + '</button>';
    }

    function rita() {
      var kropp = läge === 'kommande' ? ritaKommande() : läge === 'manad' ? ritaManad()
        : läge === 'vecka' ? ritaVecka() : ritaDag();
      /* Pilarna bläddrar i en period. Kommande är ingen period, det är
         det som ligger närmast — där finns inget att bläddra i. */
      var nav = läge === 'kommande' ? '' : '<div class="cal-nav">'
        + '<button type="button" data-sch="bak" aria-label="Bakåt"><svg viewBox="0 0 12 12"><path d="M7.5 2.5 4 6l3.5 3.5"/></svg></button>'
        + '<button type="button" data-sch="idag" class="sch-idag">Idag</button>'
        + '<button type="button" data-sch="fram" aria-label="Framåt"><svg viewBox="0 0 12 12"><path d="M4.5 2.5 8 6l-3.5 3.5"/></svg></button>'
        + '</div>';
      host.innerHTML =
          '<div class="sch-topp">'
        + '<div class="cal-head" style="margin-bottom:0">'
        + '<b class="sch-titel">' + esc(titel()) + '</b>'
        + nav + '</div>'
        + '<div class="sch-val" role="group" aria-label="Visa som">'
        + LÄGEN.map(function (l) {
            return '<button type="button" data-sch-lage="' + l + '" aria-pressed="' + (l === läge) + '">'
              + { kommande: 'Kommande', manad: 'Månad', vecka: 'Vecka', dag: 'Dag' }[l] + '</button>';
          }).join('')
        + '</div></div>' + kropp;
    }

    host.addEventListener('click', function (e) {
      var nav = e.target.closest('[data-sch]');
      if (nav) {
        if (nav.dataset.sch === 'idag') { visad = new Date(); visad.setHours(12, 0, 0, 0); rita(); }
        else flytta(nav.dataset.sch === 'fram' ? 1 : -1);
        return;
      }
      var byt = e.target.closest('[data-sch-lage]');
      if (byt) { läge = byt.dataset.schLage; rita(); return; }

      /* Fler rader läggs till under de som redan står, så att sidan
         bara växer nedåt och det man tittade på står kvar. */
      if (e.target.closest('[data-sch-fler]')) {
        kommandeAntal += 10;
        rita();
        return;
      }

      /* "+2 till" hoppar till dagvyn i stället för att fälla ut en
         ruta i rutan — dagvyn finns redan och visar allt. */
      var fler = e.target.closest('[data-dag-oppna]');
      if (fler) {
        visad = new Date(fler.dataset.dagOppna + 'T12:00:00');
        läge = 'dag'; rita(); return;
      }
      var pass = e.target.closest('[data-pass]');
      if (pass && typeof o.onOppna === 'function') {
        var b = bokningar.filter(function (x) { return String(x.id) === pass.dataset.pass; })[0];
        if (b) o.onOppna(b);
      }
    });

    rita();

    return {
      rita: rita,
      sättBokningar: function (nya) { bokningar = nya || []; rita(); },
      gåTill: function (iso, nyttLäge) {
        visad = new Date(iso + 'T12:00:00');
        if (nyttLäge) läge = nyttLäge;
        rita();
      }
    };
  }

  /* ============================================================
     SIDOMENYN
     Vyerna var en enda lång sida där allt låg framme samtidigt: man
     fick skrolla förbi läxor och rapporter för att komma åt sina
     tider. Nu är varje del en egen sektion och menyn är vägen dit.

     Sektionerna byter inte dokument — de ligger kvar och göms med
     hidden. Det är hela poängen: befintlig JS skriver till sina #id
     precis som förut, oavsett vilken sektion som är framme, så
     ingenting av datalogiken behöver röras.

     Adressen bär sektionen (#laxor), så ett "Visa alla" och en
     notisrad är vanliga ankarlänkar. Det ger också bakåtknappen
     rätt beteende gratis.
     ============================================================ */
  function sidomeny(opts) {
    var o = opts || {};
    var nav = o.nav;
    var rot = o.rot || document;
    if (!nav) return null;

    /* o.tillåten(namn) säger vilka sektioner som finns för den här
       inloggningen (adminvyn med behörigheter, barnkonton_och_admin).
       De andra står kvar i sidan, dolda, så att ingen ritning letar
       förgäves efter sina element, men de går inte att nå, inte heller
       med en adress. Datan i dem är ändå tom: det är RLS som bestämmer. */
    var tillåten = typeof o.tillåten === 'function' ? o.tillåten : function () { return true; };
    var länkar = NX.$$('a[data-sek]', nav);
    var sektioner = NX.$$('section[data-sek]', rot).filter(function (s) {
      if (tillåten(s.dataset.sek)) return true;
      s.hidden = true;
      return false;
    });
    länkar.forEach(function (a) { if (!tillåten(a.dataset.sek)) a.hidden = true; });
    var namn = sektioner.map(function (s) { return s.dataset.sek; });
    if (!namn.length) return null;
    var standard = namn.indexOf(o.standard) !== -1 ? o.standard : namn[0];
    var första = true;
    var aktiv = null;

    function giltig(n) { return namn.indexOf(n) !== -1 ? n : standard; }

    function visa(önskad) {
      var vald = giltig(önskad);
      /* Läses FÖRE bytet. Att gömma en sektion ändrar sidhöjden, och
         då klämmer webbläsaren scrollen på egen hand — den enda
         förflyttning vi vill veta om nedan. */
      var föreY = window.scrollY;

      sektioner.forEach(function (s) { s.hidden = s.dataset.sek !== vald; });
      länkar.forEach(function (a) {
        var här = a.dataset.sek === vald;
        a.classList.toggle('ar-har', här);
        if (här) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
      /* På en telefon är menyn en rad man drar i sidled. Kom man till
         sektionen från en länk i innehållet kan dess post stå utanför
         kanten; då dras raden, inte sidan (inte scrollIntoView, som
         kan rulla hela sidan: fälla 3 i CLAUDE.md, startsidan). */
      var vald_a = nav.querySelector('a.ar-har');
      if (vald_a && window.getComputedStyle(nav).flexDirection === 'column') {
        /* Adminvyns meny på en dator är en kolumn med egen rullning
           (nextrum-arbetsyta.css): den är högre än en bärbar. Nås en
           post från en länk i innehållet, eller från en adress, kan den
           stå utanför. Då dras menyn, aldrig sidan. */
        if (nav.scrollHeight > nav.clientHeight + 1) {
          var nedre = nav.clientHeight;
          var dy = vald_a.getBoundingClientRect().top - nav.getBoundingClientRect().top;
          if (dy < 0 || dy + vald_a.offsetHeight > nedre) {
            nav.scrollTop += dy - (nedre - vald_a.offsetHeight) / 2;
          }
        }
      } else if (vald_a && nav.scrollWidth > nav.clientWidth + 1) {
        var d = vald_a.getBoundingClientRect().left - nav.getBoundingClientRect().left;
        if (d < 0 || d + vald_a.offsetWidth > nav.clientWidth) {
          nav.scrollLeft += d - (nav.clientWidth - vald_a.offsetWidth) / 2;
        }
      }

      /* Ett sektionsbyte flyttar INTE sidan.

         Förut scrollades den nya sektionen fram vid varje byte. Med
         scroll-behavior:smooth i nextrum.css blev det en resa uppåt
         för varje klick i menyn, på varje "Visa alla" och på varje
         kort i hälsningen — och eftersom sidhöjden ändras i samma
         ögonblick som sektionen byts hann animeringen dessutom landa
         fel: i provbänken slutade ett klick på "Dina tider" 1253px
         ned i en sektion som just öppnats.

         Kvar står bara det som sidan inte kan lösa själv: skulle man
         annars hamna INNE i den nya sektionen, utan att se dess
         början, läggs sidan vid början, direkt och utan animering.
         Förut gällde det bara när webbläsaren klämt ned scrollen för
         att sektionen blev kortare. Var den nya lika lång eller
         längre stod man kvar på samma höjd: på en telefon ledde
         "Till rapporten" långt ned i Betalning till mitten av Bekräfta
         rapport, med rubriken 1 000 px ovanför skärmen (2026-09-28).
         Syns början redan, som när man står överst, flyttas ingenting.
         Bara vid ett byte av sektion: en flik i samma sektion
         (#lektioner/plan) ska inte skicka en uppåt. */
      if (!första && vald !== aktiv) {
        var sektion = rot.querySelector('section[data-sek="' + vald + '"]');
        if (sektion && (window.scrollY < föreY || platsUtanInglidning(sektion) < täcktÖverst() + 12)) visaÖverst(sektion);
      }
      if (!första) {
        var rubrik = rot.querySelector('section[data-sek="' + vald + '"] h2, section[data-sek="' + vald + '"] h5');
        if (rubrik) {
          rubrik.setAttribute('tabindex', '-1');
          rubrik.focus({ preventScroll: true });
        }
      }
      första = false;
      aktiv = vald;

      if (typeof o.onByt === 'function') o.onByt(vald);
      return vald;
    }

    /* Adressen kan bära en flik efter sektionen: #lektioner/plan.
       Sidomenyn bryr sig bara om delen före snedstrecket — fliken
       sköts av NXArbete.flikar. Utan splitten läste menyn hela
       strängen som ett sektionsnamn, hittade den inte, och föll
       tillbaka på Översikt: varje länk till en flik landade fel. */
    function frånHash() {
      return visa(String(location.hash || '').replace(/^#/, '').split('/')[0]);
    }

    /* ---------- hopfällning ----------
       Adminvyn har haft den här sedan den byggdes, och skälet är
       detsamma i arbetsytorna: på en liten bärbar är 250px meny en
       fjärdedel av det man arbetar i.

       Ritas bara för den som ber om den med o.fall. Adminvyn har
       en egen knapp i sin topprad och ska inte få två.

       Etiketterna får ett eget span så att de går att gömma utan
       att gömma länken. Skärmläsaren läser dem ändå — de är dolda
       visuellt, inte borttagna, och title ger musen samma ord. */
    if (o.fall) {
      var layout = nav.closest('.vy-layout');

      länkar.forEach(function (a) {
        if (a.querySelector('.adm-etikett')) return;
        var text = '';
        Array.prototype.slice.call(a.childNodes).forEach(function (n) {
          if (n.nodeType === 3) { text += n.textContent; n.remove(); }
        });
        text = text.trim();
        if (!text) return;
        var sp = document.createElement('span');
        sp.className = 'adm-etikett';
        sp.textContent = text;
        a.appendChild(sp);
        a.title = text;
      });

      if (layout) {
        var FALL_NYCKEL = 'nx-meny-hopfalld-' + o.fall;
        var knappFall = document.createElement('button');
        knappFall.type = 'button';
        knappFall.className = 'vy-sido-fall';
        knappFall.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true">'
          + '<path d="M2 4h12M2 8h12M2 12h12"/></svg>';
        nav.insertBefore(knappFall, nav.firstChild);

        var sättFall = function (hopfälld) {
          layout.classList.toggle('ar-hopfalld', hopfälld);
          knappFall.setAttribute('aria-expanded', hopfälld ? 'false' : 'true');
          knappFall.setAttribute('aria-label', hopfälld ? 'Fäll ut menyn' : 'Fäll ihop menyn');
          try { localStorage.setItem(FALL_NYCKEL, hopfälld ? '1' : '0'); } catch (e) {}
        };

        var sparat = '0';
        try { sparat = localStorage.getItem(FALL_NYCKEL) || '0'; } catch (e) {}
        sättFall(sparat === '1');
        knappFall.addEventListener('click', function () {
          sättFall(!layout.classList.contains('ar-hopfalld'));
        });
      }
    }

    /* Sidhuvudets höjd, för sektionsraden som står fast under det på
       en telefon. Satt på raden och inte på :root: en variabel på
       roten ärvs av hela sidan och räknar om stilen för allt när den
       ändras (CLAUDE.md, startsidan efter hero). Adminvyn läser den
       inte: där är sidhuvudet gömt, och raden står under adminvyns
       topprad, som har en fast höjd (--adm-topp-h). */
    var hdrEl = document.querySelector('.hdr');
    if (hdrEl && window.ResizeObserver) {
      new ResizeObserver(function () {
        nav.style.setProperty('--vy-hdr-h', hdrEl.offsetHeight + 'px');
      }).observe(hdrEl);
    }

    window.addEventListener('hashchange', frånHash);
    frånHash();

    return {
      öppna: function (n) {
        var vald = giltig(n);
        if (String(location.hash).replace(/^#/, '').split('/')[0] === vald) visa(vald);
        else location.hash = '#' + vald;
      },
      /* Siffran vid en menypost. 0 tar bort den helt — en tom prick
         läser som "noll nya", inte som "inget att visa". */
      märke: function (sek, antal) {
        länkar.forEach(function (a) {
          if (a.dataset.sek !== sek) return;
          var m = a.querySelector('.vy-sido-mark');
          if (!antal) { if (m) m.remove(); return; }
          if (!m) {
            m = document.createElement('span');
            m.className = 'vy-sido-mark';
            a.appendChild(m);
          }
          m.textContent = antal > 99 ? '99+' : String(antal);
          m.setAttribute('aria-label', antal + ' nya');
        });
      }
    };
  }

  /* ============================================================
     NOTISER
     En knapp i sidhuvudet med det som faktiskt kräver något av
     användaren. Inte en logg över allt som hänt — en lista över
     det som väntar.
     ============================================================ */
  function notiser(host, poster) {
    if (!host) return;
    var öppen = false;

    if (!poster.length) { host.innerHTML = ''; sättTitel(0); return; }

    host.innerHTML =
      '<button type="button" class="nx-notis" aria-expanded="false" aria-label="'
      + poster.length + ' saker som väntar">'
      + '<span class="nx-notis-prick"></span>' + poster.length
      + '</button>'
      + '<div class="nx-notis-lista" hidden>'
      + poster.map(function (p) {
          return '<button type="button" class="nx-notis-rad" data-mal="' + esc(p.mål || '') + '">'
            + '<b>' + esc(p.rubrik) + '</b><span>' + esc(p.text) + '</span></button>';
        }).join('')
      + '</div>';

    var knapp = host.querySelector('.nx-notis');
    var lista = host.querySelector('.nx-notis-lista');

    function stäng() { öppen = false; lista.hidden = true; knapp.setAttribute('aria-expanded', 'false'); }

    knapp.addEventListener('click', function (e) {
      e.stopPropagation();
      öppen = !öppen;
      lista.hidden = !öppen;
      knapp.setAttribute('aria-expanded', String(öppen));
    });

    lista.addEventListener('click', function (e) {
      var rad = e.target.closest('[data-mal]');
      if (!rad) return;
      stäng();
      var mål = document.querySelector(rad.dataset.mal);
      if (!mål) return;

      /* Målet kan ligga i en sektion som inte är framme. Byt dit
         först — annars scrollar vi till något som är hidden och
         ingenting händer. */
      var sek = mål.closest('section[data-sek]');
      if (sek && sek.hidden) {
        location.hash = '#' + sek.dataset.sek;
      }
      /* Och i en flik som inte är framme. Efter sammanslagningen av
         sektionerna ligger #rapport-form och #lax-lista i flikpaneler,
         och en gömd panel är lika ogenomtränglig som en gömd sektion. */
      if (window.NXArbete) NXArbete.visaFör(mål);

      /* Sektionsbytet nollställer scrollen, så markeringen måste
         vänta tills den bytt. */
      requestAnimationFrame(function () {
        mål.scrollIntoView({ behavior: 'smooth', block: 'center' });
        mål.classList.add('nx-blink');
        setTimeout(function () { mål.classList.remove('nx-blink'); }, 1600);
      });
    });

    document.addEventListener('click', function (e) {
      if (öppen && !host.contains(e.target)) stäng();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && öppen) stäng(); });

    sättTitel(poster.length);
  }

  /* ============================================================
     FÖRDELNINGEN

     En liggande stapel med hela sanningen i sig, och en förklaring
     under. Används till två frågor som båda är "hur går det" fast
     på olika tidsskalor: hur passen gick, och var kunskapsområdena
     ligger nu.

     Andelar och inte antal, eftersom frågan är hur det fördelar sig
     och inte hur mycket som hunnits med — men antalet står i
     förklaringen, för en andel av tre pass är inte en trend.

     opts: { host, lagen: [[nyckel, text, klass]], rader, av(r), tom }
     ============================================================ */
  function fordelning(o) {
    var host = o.host;
    if (!host) return;

    var rader = o.rader || [];
    var av = typeof o.av === 'function' ? o.av : function (r) { return r; };

    var räknat = o.lagen.map(function (l) {
      return { nyckel: l[0], text: l[1], klass: l[2] || '', antal: 0 };
    });
    var totalt = 0;
    rader.forEach(function (r) {
      var v = av(r);
      var träff = räknat.filter(function (x) { return x.nyckel === v; })[0];
      if (!träff) return;              // null och okända värden räknas inte
      träff.antal++;
      totalt++;
    });

    if (!totalt) {
      host.innerHTML = '<p class="fd-tom">' + esc(o.tom || 'Inget att visa än.') + '</p>';
      return;
    }

    /* Ett segment som avrundas till noll procent syns inte alls,
       och då ljuger stapeln om att läget inte finns. Minsta bredd
       är därför en dryg procent så länge antalet är minst ett. */
    host.innerHTML = '<div class="fd">'
      + '<div class="fd-stapel" role="img" aria-label="'
      + esc(räknat.filter(function (x) { return x.antal; })
              .map(function (x) { return x.antal + ' ' + x.text.toLowerCase(); }).join(', ')) + '">'
      + räknat.filter(function (x) { return x.antal; }).map(function (x) {
          return '<i class="' + esc(x.klass) + '" style="flex:'
            + Math.max(x.antal / totalt, 0.012) + '"></i>';
        }).join('')
      + '</div>'
      + '<div class="fd-lista">'
      + räknat.map(function (x) {
          return '<span class="fd-post' + (x.antal ? '' : ' ar-tom') + '">'
            + '<i class="' + esc(x.klass) + '"></i>'
            + esc(x.text) + '<b>' + x.antal + '</b></span>';
        }).join('')
      + '</div></div>';
  }

  /* ============================================================
     LÄXLISTAN

     Läxlistan var allt eleven någonsin fått, med de klara kvar i
     ordningen. Efter en termin låg veckans läxa mellan tjugo
     avklarade. Då kom ett filter (Att göra, Klart, Alla) som stod
     på Att göra — men ritades först vid fyra läxor. Med färre
     försvann en läxa man bockat av, och det fanns ingen knapp att
     komma tillbaka till den med. Leo 2026-09-27: "läxor som är
     klara försvinner".

     Nu är det samma form som passlistan: det som ska göras ÄR
     listan, och Klara läxor står under den, de senast avklarade
     först, tre rader djupt och resten bakom en knapp. Ingenting
     göms bakom ett läge man måste veta om.

     opts: { host, laxor, rad(h), tomtAttGora }
     ============================================================ */
  var LÄX_SYNLIGA = 3;

  function läxLista(opts) {
    var o = opts || {};
    var host = o.host;
    if (!host) return;

    var alla = o.laxor || [];
    var öppna = alla.filter(function (h) { return h.status !== 'klar'; });
    /* När den blev klar, inte när den skulle vara klar: det man
       letar efter är det man gjorde nyss. */
    var klara = alla.filter(function (h) { return h.status === 'klar'; })
      .sort(function (a, c) {
        return String(c.completed_at || c.due_date || '').localeCompare(String(a.completed_at || a.due_date || ''));
      });

    var ut = öppna.length
      ? '<div class="pl-grupp">' + öppna.map(o.rad).join('') + '</div>'
      : '<div class="pl-inget">' + esc(o.tomtAttGora || 'Inget att göra just nu.') + '</div>';

    var utfällt = !!PL_UTFÄLLD[host.id];

    if (klara.length) {
      var visade = klara.slice(0, LÄX_SYNLIGA);
      var resten = klara.slice(LÄX_SYNLIGA);

      ut += '<div class="pl-grupp pl-tidigare lx-klara">'
        + '<div class="pl-rubrik">Klara uppgifter <em>' + klara.length + ' st</em></div>'
        + visade.map(o.rad).join('')
        + (resten.length
            ? '<div class="pl-resten"' + (utfällt ? '' : ' hidden') + '>' + resten.map(o.rad).join('') + '</div>'
              + '<button type="button" class="pl-mer" data-pl-mer aria-expanded="' + (utfällt ? 'true' : 'false') + '">'
              + (utfällt ? 'Visa färre' : 'Visa alla ' + klara.length) + '</button>'
            : '')
        + '</div>';
    }

    host.innerHTML = ut;

    /* toggle bubblar inte, därför capture. En gång per värd: listan
       ritas om, värden står kvar. */
    if (!host.dataset.laxToggle) {
      host.dataset.laxToggle = '1';
      host.addEventListener('toggle', function (e) {
        var d = e.target;
        if (d && d.dataset && d.dataset.laxId) LÄX_UTFÄLLDA[d.dataset.laxId] = d.open;
      }, true);
    }

    var knapp = host.querySelector('[data-pl-mer]');
    if (knapp) {
      knapp.addEventListener('click', function () {
        var lådan = host.querySelector('.pl-resten');
        var öppet = !lådan.hidden;
        function växla() {
          lådan.hidden = öppet;
          knapp.setAttribute('aria-expanded', öppet ? 'false' : 'true');
          knapp.textContent = öppet ? 'Visa alla ' + klara.length : 'Visa färre';
        }
        if (öppet) håll(knapp, växla); else växla();
        PL_UTFÄLLD[host.id] = !öppet;
      });
    }
  }

  /* ============================================================
     PASSLISTAN

     Listan var varje bokning som någonsin gjorts, sorterad i
     datumordning uppåt. Efter ett halvår låg nästa pass under
     femtio hållna, och man fick skrolla förbi allt som redan hänt
     för att komma åt det som inte hade hänt.

     Nu är kommande pass listan. Det som varit ligger under den,
     tre rader djupt, med resten bakom en knapp. Ingenting
     försvinner — historiken är kvitto på vad som fakturerats och
     får inte gå att tappa bort, bara att lägga undan.

     opts: { host, bokningar, rad(b), tomtKommande, tomtAllt }
     ============================================================ */
  var PASS_SYNLIGA = 3;

  function passLista(opts) {
    var o = opts || {};
    var host = o.host;
    if (!host) return;

    var alla = o.bokningar || [];
    var idag = isoFor(new Date());

    /* Avbokat är aldrig kommande, hur långt fram det än ligger.
       Ett pass som inte blir av är historik i samma stund. */
    function ärKommande(b) {
      return (b.status === 'requested' || b.status === 'confirmed')
        && String(b.wanted_date || '') >= idag;
    }

    function nyckel(b) { return String(b.wanted_date || '') + String(b.wanted_time || ''); }

    var kommande = alla.filter(ärKommande)
      .sort(function (a, c) { return nyckel(a).localeCompare(nyckel(c)); });
    var tidigare = alla.filter(function (b) { return !ärKommande(b); })
      .sort(function (a, c) { return nyckel(c).localeCompare(nyckel(a)); });

    /* AVBOKADE PASS (2026-09-30). Leo: avbokade pass ska inte ligga
       kvar och ta plats, men antalet ska gå att se över tid. Med
       o.avbokade står de i en egen hopfälld grupp sist, och bara de från
       de senaste 30 dagarna. Raderna tas INTE bort ur databasen: ett
       avbokat pass kan bära en återbetalning, en tvist eller timmar, och
       det är bokföring (migrationen avbokningar_och_svar).

       Antalet räknar bara bekräftade pass som avbokats (avbokad_fran),
       inte förslag som avslagits eller dragits tillbaka, och det räknar
       alla, också de äldre än listan. o.avbokade.vem(b) säger vem som
       avbokade, sett från den som tittar: 'jag', 'motpart' eller
       'nextrum'. */
    var avb = o.avbokade;
    var avbokade = [];
    if (avb) {
      avbokade = tidigare.filter(function (b) { return b.status === 'cancelled'; });
      tidigare = tidigare.filter(function (b) { return b.status !== 'cancelled'; });
    }

    if (!alla.length) {
      host.innerHTML = o.tomtAllt || tomt('Inga pass än', '');
      return;
    }

    var ut = '';

    ut += kommande.length
      ? '<div class="pl-grupp">' + kommande.map(o.rad).join('') + '</div>'
      : '<div class="pl-inget">' + esc(o.tomtKommande || 'Inga kommande pass just nu.') + '</div>';

    /* Utfällt förblir utfällt när listan ritas om. Förut föll den
       ihop efter varje avbokning och varje svar — listan krympte med
       tjugo rader under fingret, och man stod någon annanstans. */
    var utfällt = !!PL_UTFÄLLD[host.id];

    if (tidigare.length) {
      var visade = tidigare.slice(0, PASS_SYNLIGA);
      var resten = tidigare.slice(PASS_SYNLIGA);

      ut += '<div class="pl-grupp pl-tidigare">'
        + '<div class="pl-rubrik">Tidigare pass <em>' + tidigare.length + ' st</em></div>'
        + visade.map(o.rad).join('')
        + (resten.length
            ? '<div class="pl-resten"' + (utfällt ? '' : ' hidden') + '>' + resten.map(o.rad).join('') + '</div>'
              + '<button type="button" class="pl-mer" data-pl-mer aria-expanded="' + (utfällt ? 'true' : 'false') + '">'
              + (utfällt ? 'Visa färre' : 'Visa alla ' + tidigare.length) + '</button>'
            : '')
        + '</div>';
    }

    if (avb) ut += avbokadeGrupp(host, avbokade, avb, o.rad);

    host.innerHTML = ut;

    var avbKnapp = host.querySelector('[data-pl-avbokade]');
    if (avbKnapp) {
      avbKnapp.addEventListener('click', function () {
        var inne = host.querySelector('.pl-avb-inne');
        var öppet = !inne.hidden;
        function växla() {
          inne.hidden = öppet;
          avbKnapp.setAttribute('aria-expanded', öppet ? 'false' : 'true');
        }
        // Samma skäl som Visa färre nedan: gruppen står sist på sidan.
        if (öppet) håll(avbKnapp, växla); else växla();
        PL_UTFÄLLD[host.id + ':avbokade'] = !öppet;
      });
    }

    var knapp = host.querySelector('[data-pl-mer]');
    if (knapp) {
      knapp.addEventListener('click', function () {
        var lådan = host.querySelector('.pl-resten');
        var öppet = !lådan.hidden;
        function växla() {
          lådan.hidden = öppet;
          knapp.setAttribute('aria-expanded', öppet ? 'false' : 'true');
          knapp.textContent = öppet ? 'Visa alla ' + tidigare.length : 'Visa färre';
        }
        /* "Visa färre" längst ned i en lång lista tog bort allt
           ovanför knappen, och man hamnade 600 px högre upp än man
           tryckt. Knappen står kvar under fingret i stället. "Visa
           alla" får flytta den nedåt: de nya raderna ska synas där de
           gamla slutade, inte ovanför skärmen. */
        if (öppet) håll(knapp, växla); else växla();
        PL_UTFÄLLD[host.id] = !öppet;
      });
    }
  }
  var PL_UTFÄLLD = {};

  var AVBOKADE_DAGAR = 30;

  function avbokadeGrupp(host, avbokade, avb, rad) {
    var gräns = Date.now() - AVBOKADE_DAGAR * 864e5;
    // Avbokningens dag, och passets för rader avbokade före Fas 9.4.
    function när(b) {
      var t = b.avbokad_at ? Date.parse(b.avbokad_at) : Date.parse(String(b.wanted_date || '') + 'T12:00:00');
      return isNaN(t) ? 0 : t;
    }
    var nyliga = avbokade.filter(function (b) { return när(b) >= gräns; })
      .sort(function (a, c) { return när(c) - när(a); });

    var tal = { jag: 0, motpart: 0, nextrum: 0 };
    avbokade.forEach(function (b) {
      if (b.avbokad_fran !== 'confirmed') return;
      var v = avb.vem(b);
      tal[v] = (tal[v] || 0) + 1;
    });
    var talText = 'Avbokade av ' + avb.jag + ': ' + tal.jag + '. '
      + 'Avbokade av ' + avb.motpart + ': ' + tal.motpart + '.'
      + (tal.nextrum ? ' Avbokade av Nextrum: ' + tal.nextrum + '.' : '');

    var öppen = !!PL_UTFÄLLD[host.id + ':avbokade'];
    var id = host.id + '-avbokade';
    return '<div class="pl-grupp pl-avbokade">'
      + '<button type="button" class="pl-avb-knapp" data-pl-avbokade aria-expanded="' + (öppen ? 'true' : 'false') + '"'
      + ' aria-controls="' + esc(id) + '">'
      + '<span>Avbokade pass</span>'
      + (nyliga.length ? '<em>' + nyliga.length + ' st</em>' : '')
      + '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5l3-3"/></svg>'
      + '</button>'
      + '<div class="pl-avb-inne" id="' + esc(id) + '"' + (öppen ? '' : ' hidden') + '>'
      + '<p class="pl-avb-tal">' + esc(talText) + '</p>'
      + (nyliga.length
          ? nyliga.map(rad).join('')
          : '<div class="pl-inget">' + (avbokade.length ? 'Inga avbokade pass de senaste 30 dagarna.' : 'Inga avbokade pass.') + '</div>')
      + '<p class="pl-avb-not">Avbokade pass står här i 30 dagar. Antalet räknar alla, också äldre.</p>'
      + '</div></div>';
  }

  /* Antalet syns i fliken också — man har sällan vyn framme. */
  function sättTitel(n) {
    var ren = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = n ? '(' + n + ') ' + ren : ren;
  }

  /* ============================================================
     VYSKALET (Fas 3)
     Det studievyn och studiehjälparvyn gjorde likadant, i var sin
     ordagrann kopia. Skillnaderna — vilka vyer sidan har, vilken roll
     som står i menyn, vad inloggningen säger — skickas in. Vyerna
     behåller korta funktioner med de gamla namnen, så att inget
     anropsställe behövde ändras.
     ============================================================ */

  /* Visa en av sidans huvudvyer och dölj resten. */
  /* Samma spärr som i NXAdmin.visa: har modulvakten sagt att en fil
     inte kom fram ska felrutan stå kvar, inte ersättas av
     inloggningsrutan. */
  function visaVy(vyer, id) {
    if (document.documentElement.dataset.modulfel && id !== 'view-fel') return;
    vyer.forEach(function (v) {
      var el = document.getElementById(v);
      if (el) el.hidden = (v !== id);
    });
  }

  /* Felvyn. visa är vyns egen visa(), så att rätt uppsättning vyer
     döljs. */
  function felvy(visa, fel, sammanhang) {
    console.error('Nextrum:', sammanhang || '', fel);
    visa('view-fel');
    var text = NX.$('#fel-text'), detalj = NX.$('#fel-detalj');
    if (text) {
      text.textContent = sammanhang
        ? 'Något gick fel när ' + sammanhang + '. Försök igen — går det inte, hör av dig så tittar vi på det.'
        : 'Något gick fel. Försök igen — går det inte, hör av dig så tittar vi på det.';
    }
    if (detalj) detalj.textContent = (fel && (fel.message || fel.error_description || fel.msg)) || String(fel || '');
  }

  /* Klockslag om det var idag, "Igår", annars datumet. */
  function kortTid(iso) {
    var d = new Date(iso), dag = String(iso).slice(0, 10);
    if (dag === isoFor(new Date())) {
      return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    var igår = new Date(); igår.setDate(igår.getDate() - 1);
    return dag === isoFor(igår) ? 'Igår' : datumText(dag);
  }

  /* Namnet, rollen och utloggningen uppe i menyn. efter() körs när
     notishuset finns i DOM:en — vyn ritar sina notiser där. */
  function vyHuvud(S, roll, efter) {
    var na = NX.$('#nav-actions'), ma = NX.$('#m-actions');
    if (!S.user) { na.innerHTML = ''; ma.innerHTML = ''; return; }
    var namn = (S.profil && S.profil.full_name) || S.user.email;
    na.innerHTML = '<span class="nx-notis-hus" id="notis-hus"></span>'
      + '<span class="who-chip">' + NXMedia.avatar(namn, S.minAvatar, { liten: true })
      + '<b>' + esc(namn) + '</b><span class="roll">' + esc(roll) + '</span></span>'
      /* Den som är både förälder eller studiehjälpare och admin landar i
         sin vanliga vy, med vägen till adminvyn här. is_admin är full
         admin; en admin med vissa behörigheter känns igen på S.adminroll
         (adminroll() nedan). */
      + (S.profil && (S.profil.is_admin || S.adminroll)
        ? '<a class="btn btn-ghost btn-sm" href="/admin">Adminvy</a>' : '')
      + '<button class="btn btn-ghost btn-sm" data-logout>Logga ut</button>';
    if (efter) efter();
    ma.innerHTML = '<button class="btn btn-ghost btn-block" data-logout>Logga ut</button>';
  }

  /* Är den inloggade admin med vissa behörigheter (barnkonton_och_admin)?
     is_admin på profilen är full admin; en begränsad roll står bara i
     admin_roller, och mina_behorigheter() svarar om den inloggade själv.
     Saknas funktionen (migrationen inte körd) är svaret nej och ingenting
     ritas om. rita() ritar om sidhuvudet med länken Adminvy. */
  async function adminroll(supa, S, rita) {
    if (!supa || !S || (S.profil && S.profil.is_admin)) return;
    try {
      var svar = await supa.rpc('mina_behorigheter');
      if (!svar.error && svar.data && svar.data.admin) {
        S.adminroll = true;
        if (rita) rita();
      }
    } catch (e) { /* ingen länk, inget annat */ }
  }

  /* Inloggningsrutan i läge 'in', 'up' eller 'glomt'. t har titel,
     titelUpp, under och underUpp. Adminvyn har inga flikar och inget
     namnfält, och byter bara mellan 'in' och 'glomt'. */
  /* EN INLOGGNING (2026-10-07). Leo: "ta bort att man skapa konto på vår
     sida, vi gör det genom inbjudan", och "föräldrar och elev ska vara en
     knapp när man loggar in, spelar egentligen ingen roll vart man klickar
     i inlogg, är man studiehjälpare loggas man in dit". Rutan är densamma
     i studievyn och studiehjälparvyn: e-post eller användarnamn och
     lösenord (loggaIn), och kontot avgör vyn. Ett barn hamnar på /barn,
     och vyerna skickar en vuxen vidare efter rollen. Konton skapar bara
     vi (bjud-in) och föräldern (barnets inloggning, barn-konto).

     Lägena är 'in', 'glomt' (Glömt lösenordet?) och 'lankfel': samma
     formulär som Glömt lösenordet, efter en länk i ett mejl som inte gick
     att använda. Den som tagits in har inget lösenord att ha glömt, och
     sidan hette förut Glömt lösenordet också för hen (Leo, 2026-10-07:
     "kommer jag som familj som fått inbjudan till glömt lösenord sida"). */
  function inloggningsruta(läge, t) {
    var länkfel = läge === 'lankfel', glömt = läge === 'glomt' || länkfel;
    var lösen = NX.$('#a-pass');
    lösen.autocomplete = 'current-password';
    lösen.required = !glömt;
    lösen.closest('.fgroup').hidden = glömt;
    NX.$$('[data-glomt]').forEach(function (el) { el.hidden = läge !== 'in'; });
    NX.$$('[data-glomt-tillbaka]').forEach(function (el) { el.hidden = !glömt; });
    /* Inloggningen tar e-post eller användarnamn (loggaIn); etiketten
       säger det där barn kan logga in (t.etikett: studievyn och
       studiehjälparvyn), men inte i adminvyn. En länk skickas alltid
       till en e-postadress. Ett användarnamn är ingen adress: utan typen
       email får telefonen ett vanligt tangentbord, utan versal först. */
    var namn = läge === 'in' && !!t.etikett;
    var etikett = NX.$('label[for="a-email"]');
    if (etikett) etikett.textContent = namn ? t.etikett : 'E-post';
    var fält = NX.$('#a-email');
    if (fält) {
      fält.type = namn ? 'text' : 'email';
      fält.autocomplete = namn ? 'username' : 'email';
      fält.setAttribute('autocapitalize', 'none');
      fält.spellcheck = false;
    }
    NX.$('#auth-title').textContent = länkfel ? 'Länken fungerar inte längre' : glömt ? 'Glömt lösenordet?' : t.titel;
    NX.$('#auth-sub').textContent = länkfel ? LÄNKFEL_UNDER : glömt ? GLÖMT_UNDER : t.under;
    NX.$('#auth-submit').textContent = länkfel ? 'Skicka en ny länk' : glömt ? 'Skicka länken' : 'Logga in';
    NX.rensa(NX.$('#auth-msg'));
  }

  /* ============================================================
     E-POST ELLER ANVÄNDARNAMN, I VARJE INLOGGNING (2026-10-01)

     Leo: "man kan logga in med användarnamn eller epost ... barns
     konton ska bara vara användarnamn och lösenord som styrs av
     föräldern". Det första riktiga barnkontot gick inte att logga in
     med: Logga in på sajten leder till studievyn, där fältet hette
     E-post, och /barn nås bara om man skriver adressen. Nu gäller en
     regel i alla fyra inloggningarna, och den läser bara formen på det
     som skrivs:
     - med @ är det en vuxens e-postadress, som Auth får som förut;
     - utan @ är det ett barns användarnamn, och barnet hamnar på /barn;
     - barnkontots tekniska adress, <namn>@barn.nextrum.se, nekas utan
       att Auth tillfrågas. Supabase Auth tar ett lösenord bara ihop med
       en e-postadress eller ett telefonnummer, så adressen finns i Auth,
       byggd ur användarnamnet. Den tar aldrig emot mejl, och ingen ska
       behöva skriva den: ett barn loggar in med användarnamnet, och
       föräldern styr det och lösenordet.

     Användarnamnets regel är ANVANDARNAMN i _delad/barnkonto.ts och
     villkoret i databasen (kolla-behorigheter.py jämför dem): a–z,
     siffror, punkt, bindestreck och understreck, 3–20 tecken.

     BARNETS EGEN E-POST (barnets_epost). Ett barn vars förälder lagt
     till en adress, och som bekräftat den, kan logga in med den. Auth
     känner bara barnkontots tekniska adress, så när en adress med @ får
     "fel lösenord" av Auth frågas edge-funktionen barn-inloggning, som
     slår upp barnet och loggar in med den tekniska adressen. Svaret är
     barnets session. Hör adressen inte till ett barn blir beskedet
     detsamma som förut, den vuxnas, så sidan svarar inte på vilka
     adresser som är barnens.
     ============================================================ */
  var BARNNAMN = /^[a-z0-9._-]{3,20}$/;
  var BARNDOMÄN = '@barn.nextrum.se';

  /* Adressen i Auth för ett användarnamn, annars null. */
  function barnAdress(text) {
    var t = String(text == null ? '' : text).trim().toLowerCase();
    return BARNNAMN.test(t) ? t + BARNDOMÄN : null;
  }

  function ärBarnadress(text) {
    var t = String(text == null ? '' : text).trim().toLowerCase();
    return t.slice(-BARNDOMÄN.length) === BARNDOMÄN;
  }

  async function försökLogga(supa, epost, lösen) {
    try {
      var svar = await supa.auth.signInWithPassword({ email: epost, password: lösen });
      return { error: svar.error || null, user: (svar.data && svar.data.user) || null };
    } catch (e) { return { error: e, user: null }; }
  }

  /* Ett användarnamn får samma besked när det inte finns, när lösenordet
     är fel och när inloggningen är pausad: sidan svarar inte på vilka
     användarnamn som finns. Två undantag, och inget av dem säger något
     om kontot: taket gäller per uppkoppling, och ett nät som inte svarar
     har inte hunnit fråga någon. */
  var BARN_FEL = 'Fel användarnamn eller lösenord';
  function barnfel(fel) {
    var text = String((fel && fel.message) || fel || '');
    if (fel && fel.status === 429) return 'För många försök. Vänta en stund och försök igen.';
    if (!(fel && fel.status) && /fetch|network|load failed/i.test(text)) {
      return 'Det gick inte att nå Nextrum. Kolla att du är uppkopplad och försök igen.';
    }
    return BARN_FEL;
  }

  /* Auths "fel e-post eller lösenord", och inget annat: en obekräftad
     adress, ett tak eller ett nät som inte svarar är inte ett barns. */
  function felInloggning(fel) {
    return !!fel && fel.status === 400
      && (fel.code === 'invalid_credentials' || /invalid login credentials/i.test(String(fel.message || '')));
  }

  /* Barnets egen e-post (barnets_epost). Svarar { user } när det gick,
     { sparrad: true } när databasen spärrat försöken en stund, annars {}.
     Sessionen läggs på plats här, och en session som inte är ett barns
     loggas ut igen: funktionen ska bara kunna ge ett barns. */
  async function barnMedEpost(supa, epost, lösen) {
    var svar;
    try {
      svar = await supa.functions.invoke('barn-inloggning', { body: { epost: epost, losenord: lösen } });
    } catch (_) { return {}; }
    if (svar.error) {
      var status = svar.error.context && svar.error.context.status;
      return { sparrad: status === 429 };
    }
    var d = svar.data || {};
    if (typeof d.access_token !== 'string' || typeof d.refresh_token !== 'string') return {};
    var s;
    try {
      s = await supa.auth.setSession({ access_token: d.access_token, refresh_token: d.refresh_token });
    } catch (_) { return {}; }
    var user = s && s.data && s.data.user;
    if ((s && s.error) || !user) return {};
    if (!NX.ärBarn(user)) {
      await supa.auth.signOut({ scope: 'local' });
      return {};
    }
    return { user: user };
  }

  /* Loggar in med det som skrevs i fältet, efter regeln ovan. Svarar
     { user, barn } när det gick och { fel, barn } när det inte gick;
     barn säger att det var ett barnkonto, så att vyn skickar barnet
     till /barn och tömmer lösenordet efter ett fel. */
  async function loggaIn(supa, text, lösen) {
    var t = String(text == null ? '' : text).trim();
    if (t.indexOf('@') < 0) {
      var adress = barnAdress(t);
      /* Ett namn som inte kan finnas får samma besked som ett som inte
         finns, och ingen fråga går iväg. */
      if (!adress) return { fel: BARN_FEL, barn: true };
      var b = await försökLogga(supa, adress, lösen);
      if (b.error) return { fel: barnfel(b.error), barn: true };
      /* Domänen går inte att registrera utan att vara ett barnkonto
         (databasen), men vyn litar inte på det heller. */
      if (!NX.ärBarn(b.user)) {
        await supa.auth.signOut({ scope: 'local' });
        return { fel: BARN_FEL, barn: true };
      }
      return { user: b.user, barn: true };
    }
    if (ärBarnadress(t)) return { fel: NX.t('felLosen'), barn: false };
    var v = await försökLogga(supa, t, lösen);
    if (v.error) {
      if (felInloggning(v.error)) {
        var bm = await barnMedEpost(supa, t, lösen);
        if (bm.user) return { user: bm.user, barn: true };
        if (bm.sparrad) return { fel: 'För många försök. Vänta en stund och försök igen.', barn: false };
      }
      return { fel: NX.felText(v.error), barn: false };
    }
    return { user: v.user, barn: NX.ärBarn(v.user) };
  }

  /* Inloggningen i studievyn, studiehjälparvyn och adminvyn: knappen,
     beskedet och vart man hamnar. Ett barn går till /barn, och en vuxen
     laddar om vyn, som dirigerar efter rollen som förut. */
  async function loggaInHär(supa, text, lösen) {
    var msg = NX.$('#auth-msg'), lösenfält = NX.$('#a-pass');
    await medan(NX.$('#auth-submit'), 'Loggar in…', async function () {
      var svar = await loggaIn(supa, text, lösen);
      if (svar.fel) {
        NX.säg(msg, svar.fel, false);
        if (svar.barn) { lösenfält.value = ''; lösenfält.focus(); }
        return;
      }
      if (svar.barn) location.replace('/barn');
      else {
        /* En gammal länk till Elev-läget (#elev) laddas om utan det. Vyn
           skickar sedan vidare efter rollen, om kontot hör hemma i en
           annan vy. */
        if (location.hash === '#elev') history.replaceState(history.state, '', location.pathname + location.search);
        location.reload();
      }
    });
  }

  /* ============================================================
     GLÖMT LÖSENORDET (2026-09-30)

     Leo: "reset password står på engelska". Mallen gick att översätta,
     men ingen vy kunde be om mejlet: den som glömt sitt lösenord hade
     ingen väg tillbaka utom att mejla oss. Nu ber inloggningen i
     studievyn, studiehjälparvyn och adminvyn Supabase om en länk,
     och länken öppnar samma vy med en ruta för ett nytt lösenord.

     SAMMA BESKED OAVSETT KONTO. Supabase svarar likadant för en adress
     som inte finns, och rutan gör det också: ett formulär som säger
     "det finns inget konto med den adressen" svarar på vem som är kund
     hos oss, för vem som helst som frågar. Samma sak när samma adress
     bett om en länk nyss: då har ett mejl redan gått.

     Ett barnkonto får inget mejl alls (barnkonto_mejlsparr), så en
     barnadress får ett besked om att föräldern byter lösenordet.
     ============================================================ */
  var GLÖMT_UNDER = 'Skriv e-postadressen du loggar in med, så skickar vi en länk där du väljer ett nytt lösenord.';
  /* Varje länk i kontomejlen går att använda en gång och gäller en timme
     (Email OTP Expiration). Den som fått flera mejl, till exempel en
     inbjudan och sedan Skicka inbjudan igen, har dem i samma tråd, och
     bara den senaste länken fungerar: det var så familjelänken såg ut att
     inte fungera 2026-10-07. Därför säger rutan det först. */
  var LÄNKFEL_UNDER = 'Varje länk i våra mejl går att använda en gång och gäller i en timme. Har du fått flera '
    + 'mejl från oss fungerar bara länken i det senaste. Skriv din e-postadress, så skickar vi en ny länk där du '
    + 'väljer lösenord.';

  function ossAdress() { return (NX.CFG && NX.CFG.EPOST) || 'info@nextrum.se'; }

  /* Länkarna Glömt lösenordet? och Tillbaka till inloggningen. sätt()
     byter vyns läge och ritar om rutan. Fokus flyttas med, för knappen
     man tryckte på döljs. Inget byte medan inloggningen eller länken
     skickas: svaret hade hamnat i fel läge, och medan() hade satt
     tillbaka fel text på knappen. */
  /* Elev var ett eget läge i rutan (2026-10-06) och nåddes med #elev.
     Sedan 2026-10-07 är inloggningen en och densamma för förälder och
     elev, och #elev i en gammal länk eller ett bokmärke tas bort här.
     Svarar läget rutan ska börja i. sätt tas emot som förut, så att
     vyerna och modulvakten inte behöver ändras om läget kommer tillbaka. */
  function elevLänk(sätt) {
    if (location.hash === '#elev') history.replaceState(history.state, '', location.pathname + location.search);
    return 'in';
  }

  function glömtLänkar(sätt) {
    document.addEventListener('click', function (e) {
      var till = e.target.closest('[data-glomt] button') ? 'glomt'
        : e.target.closest('[data-glomt-tillbaka] button') ? 'in' : null;
      if (!till || NX.$('#auth-submit').hasAttribute('aria-busy')) return;
      sätt(till);
      var epost = NX.$('#a-email');
      (till === 'in' && epost.value ? NX.$('#a-pass') : epost).focus();
    });
  }

  /* Vyn öppnades från en länk i ett mejl men ingen är inloggad: länken
     har gått ut, använts, eller gick inte att logga in med
     (NX.länkfel, NX.återställning, NX.inbjudan). Rutan går rakt till
     läget 'lankfel', som skickar en ny länk. Svarar true om den gjorde
     det. En token som supabase-js inte kunde använda står kvar i
     adressen, och tas bort här. */
  function länkenGickInte(sätt) {
    if (!NX.länkfel && !NX.återställning && !NX.inbjudan) return false;
    if (/access_token=/.test(location.hash)) history.replaceState(history.state, '', location.pathname + location.search);
    sätt('lankfel');
    return true;
  }

  /* Skickar länken. Anropas från vyns inloggningsformulär i läget
     'glomt'. Länken leder tillbaka till samma vy: adresserna står i
     Supabase under Authentication, URL Configuration (Redirect URLs),
     och en adress som inte står där leder till startsidan, som skickar
     den vidare till studievyn (nextrum-app.js). */
  async function glömtSkicka(supa) {
    var msg = NX.$('#auth-msg'), fält = NX.$('#a-email');
    var epost = fält.value.trim();
    NX.rensa(msg);
    if (!epost) { NX.säg(msg, 'Skriv e-postadressen du loggar in med.', false); fält.focus(); return; }
    /* Ett användarnamn, eller barnkontots tekniska adress: ett barn har
       ingen e-post att få en länk till. */
    if (barnAdress(epost) || ärBarnadress(epost)) {
      NX.säg(msg, 'Ett barns lösenord byts av föräldern, i studievyn under Profil. '
        + 'Har du ett eget konto: skriv e-postadressen du loggar in med.', false);
      return;
    }
    if (!NX.epostOk(epost)) {
      NX.säg(msg, 'Kontrollera e-postadressen. Den ser inte ut som en adress.', false);
      fält.focus();
      return;
    }
    await medan(NX.$('#auth-submit'), 'Skickar…', async function () {
      var svar;
      try {
        svar = await supa.auth.resetPasswordForEmail(epost, { redirectTo: location.origin + location.pathname });
      } catch (e) { svar = { error: e }; }
      var fel = svar && svar.error, m = String((fel && (fel.message || fel)) || '');
      /* "For security purposes, you can only request this after N
         seconds": adressen fick en länk för mindre än en minut sedan. */
      if (!fel || /only request this after|for security purposes/i.test(m)) {
        NX.säg(msg, 'Om adressen hör till ett konto hos oss har vi skickat en länk dit. Öppna den och välj ditt lösenord. '
          + 'Hittar du inget mejl inom några minuter, titta i skräpposten eller mejla oss på ' + ossAdress() + '.', true);
        return;
      }
      console.warn('Glömt lösenordet:', m);
      if (/rate limit|too many/i.test(m)) {
        NX.säg(msg, 'Vi kan inte skicka fler mejl just nu. Vänta en stund och försök igen, eller mejla oss på ' + ossAdress() + '.', false);
      } else if (/Failed to fetch|NetworkError|Load failed/i.test(m)) {
        NX.säg(msg, NX.t('felNatverk'), false);
      } else {
        NX.säg(msg, 'Mejlet gick inte att skicka. Försök igen om en stund, eller mejla oss på ' + ossAdress() + '.', false);
      }
    });
  }

  /* Felet när ett nytt lösenord inte sparades, på svenska. */
  function lösenordsfel(fel) {
    var kod = String((fel && fel.code) || ''), m = String((fel && (fel.message || fel)) || '');
    if (kod === 'same_password' || /different from the old/i.test(m)) {
      return 'Det nya lösenordet måste vara ett annat än det gamla.';
    }
    var minst = /at least (\d+) characters/i.exec(m);
    if (minst) return 'Lösenordet måste ha minst ' + minst[1] + ' tecken.';
    if (kod === 'weak_password') return 'Lösenordet är för lätt att gissa. Välj ett längre, gärna med siffror och andra tecken.';
    if (kod === 'session_not_found' || /session missing|session_not_found/i.test(m)) {
      return 'Inloggningen från länken har gått ut. Be om en ny länk med Glömt lösenordet? vid inloggningen.';
    }
    return NX.felText(fel);
  }

  /* Rutan för ett lösenord, när vyn öppnats från länken i
     återställningsmejlet (NX.återställning) eller i en inbjudan från
     bjud-in (NX.inbjudan, o.inbjuden). Länken har loggat in personen,
     som inte har något lösenord hen minns, eller inget alls. o.minsta
     är den kortaste längden (adminvyn 8, annars 6 som i profilen),
     o.epost adressen som lösenordshanteraren sparar lösenordet under.
     Svarar true när lösenordet är sparat.

     INBJUDAN (2026-10-01). Adminvyn har frågat efter ett lösenord sedan
     barnkonton_och_admin, men studievyn och studiehjälparvyn gjorde det
     aldrig: en familj som bjudits in ur en intresseanmälan blev inloggad
     av länken en gång och hade sedan inget lösenord att logga in med.

     Ett tryck utanför stänger inte rutan, till skillnad från de andra:
     länken går bara att använda en gång, och ett snett tryck på
     telefonen hade krävt ett nytt mejl. Inte nu stänger; lösenordet går
     att byta i profilen eller med Glömt lösenordet senare.

     FÖRSTA INLOGGNINGEN (2026-10-06, o.tvingad). Den som tagits in har
     inget lösenord alls, och Leo: "När de loggar in för första gången
     står det skapa nytt lösenord och bekräfta lösenordet." Då finns
     inget Inte nu och Escape gör ingenting: vyn öppnas först när
     lösenordet är sparat. Logga ut står kvar, så att den som ändå måste
     gå inte är fast. Rutan stängs direkt när lösenordet sparats, för
     introduktionen tar vid och säger att det gick. o.data följer med i
     samma anrop till user_metadata (välkomsten, lösenordFörst). */
  function nyttLösenord(supa, o) {
    var minsta = (o && o.minsta) || 6, inbjuden = !!(o && o.inbjuden), tvingad = !!(o && o.tvingad);
    return new Promise(function (klar) {
      var ruta = document.createElement('div');
      ruta.className = 'nx-fraga';
      ruta.innerHTML =
        '<div class="nx-fraga-box" role="dialog" aria-modal="true" aria-labelledby="nylos-t">'
        + '<h3 id="nylos-t">' + (inbjuden ? 'Skapa ditt lösenord' : 'Välj ett nytt lösenord') + '</h3>'
        + '<p>' + (inbjuden
          ? 'Välkommen till Nextrum! Du loggade in med länken i mejlet. Skapa ett lösenord med minst ' + minsta
            + ' tecken och bekräfta det, så loggar du in med din e-postadress och lösenordet nästa gång.'
          : 'Du är inloggad med länken i mejlet. Välj ett nytt lösenord med minst ' + minsta
            + ' tecken, så loggar du in med det nästa gång.') + '</p>'
        + '<form data-nylos novalidate>'
        + '<input type="email" autocomplete="username" value="' + esc((o && o.epost) || '') + '" hidden readonly>'
        + '<div class="fgroup"><label for="nylos-1">Nytt lösenord</label>'
        + '<input class="inp" id="nylos-1" type="password" autocomplete="new-password" minlength="' + minsta + '"></div>'
        + '<div class="fgroup"><label for="nylos-2">' + (inbjuden ? 'Bekräfta lösenordet' : 'Upprepa lösenordet') + '</label>'
        + '<input class="inp" id="nylos-2" type="password" autocomplete="new-password"></div>'
        + '<p class="ok-msg" id="nylos-msg" role="alert"></p>'
        + '<div class="nx-fraga-knappar">'
        + (tvingad
          ? '<button type="button" class="btn btn-ghost" data-nylos-ut>Logga ut</button>'
          : '<button type="button" class="btn btn-ghost" data-nylos-nej>Inte nu</button>')
        + '<button type="submit" class="btn btn-primary">Spara lösenordet</button>'
        + '</div></form></div>';

      var sparat = false;
      var sistaFokus = document.activeElement;
      function stäng() {
        ruta.remove();
        document.body.style.overflow = '';
        document.removeEventListener('keydown', tangent);
        if (sistaFokus && sistaFokus.focus) sistaFokus.focus();
        klar(sparat);
      }
      function tangent(e) {
        if (e.key === 'Escape' && !tvingad) stäng();
        if (e.key === 'Tab') {
          var kan = ruta.querySelectorAll('.inp, button');
          var f = kan[0], s = kan[kan.length - 1];
          if (e.shiftKey && document.activeElement === f) { e.preventDefault(); s.focus(); }
          else if (!e.shiftKey && document.activeElement === s) { e.preventDefault(); f.focus(); }
        }
      }

      var form = ruta.querySelector('form'), msg = ruta.querySelector('#nylos-msg');
      var ett = ruta.querySelector('#nylos-1'), två = ruta.querySelector('#nylos-2');
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        NX.rensa(msg);
        if (ett.value.length < minsta) {
          NX.säg(msg, 'Lösenordet måste ha minst ' + minsta + ' tecken.', false);
          ett.focus();
          return;
        }
        if (ett.value !== två.value) { NX.säg(msg, 'Lösenorden är inte lika.', false); två.focus(); return; }
        await medan(form.querySelector('[type="submit"]'), 'Sparar…', async function () {
          var svar;
          var ändra = { password: ett.value };
          if (o && o.data) ändra.data = o.data;
          try { svar = await supa.auth.updateUser(ändra); } catch (err) { svar = { error: err }; }
          if (svar && svar.error) { NX.säg(msg, lösenordsfel(svar.error), false); return; }
          sparat = true;
          if (tvingad) { stäng(); return; }
          ruta.querySelector('.nx-fraga-box').innerHTML =
            '<h3 id="nylos-t">' + (inbjuden ? 'Lösenordet är sparat' : 'Lösenordet är bytt') + '</h3>'
            + '<p>Nästa gång loggar du in med din e-postadress och '
            + (inbjuden ? 'lösenordet du valde' : 'det nya lösenordet') + '.</p>'
            + '<div class="nx-fraga-knappar"><button type="button" class="btn btn-primary" data-nylos-klar>Fortsätt</button></div>';
          ruta.querySelector('[data-nylos-klar]').focus();
        });
      });
      ruta.addEventListener('click', function (e) {
        if (e.target.closest('[data-nylos-nej], [data-nylos-klar]')) stäng();
        if (e.target.closest('[data-nylos-ut]')) loggaUt(supa);
      });
      document.addEventListener('keydown', tangent);

      document.body.appendChild(ruta);
      document.body.style.overflow = 'hidden';
      void ruta.offsetWidth;
      ruta.classList.add('open');
      ett.focus();
    });
  }

  /* ============================================================
     FÖRSTA INLOGGNINGEN (2026-10-06)

     Leo: "när vi tar in anställda eller familjen till plattformen
     används deras mail ... sedan får de länk i mailet ... När de loggar
     in för första gången står det skapa nytt lösenord och bekräfta
     lösenordet", och sedan introduktionen, och sist Fortsätt in.

     Kontot skapas av bjud-in (adminvyn: Ta in i poolen, Ta in familjen)
     utan lösenord, och med user_metadata.valkommen = 'losenord'. Länken
     i mejlet loggar in personen. Det ett gemensamt startlösenord hade
     skyddat finns därför inte: ingen annan än den som har inkorgen kan
     logga in på kontot. Varför det inte blev 12345678 står i
     supabase/functions/_delad/inbjudan.ts.

     Välkomsten står i user_metadata och följer kontot, inte webbläsaren:
     den som stänger fliken mitt i får rutan igen nästa gång, på vilken
     enhet som helst, tills lösenordet är sparat ('losenord') och
     introduktionen genomgången ('intro'). Den som registrerat sig själv
     får 'intro' vid registreringen. user_metadata skriver personen
     själv, så det här säger bara vad vyn visar först; det skyddar
     ingenting och ska aldrig göra det.

     lösenordFörst anropas när sessionen är känd och före rollen, som
     rutan för återställningen alltid gjort; introduktion anropas när
     vyn vet att personen hör hemma i den (en förälder i studievyn, en
     studiehjälpare i studiehjälparvyn), och innan vyn visas.
     ============================================================ */
  function välkomstläge(user) {
    var v = user && user.user_metadata && user.user_metadata.valkommen;
    return v === 'losenord' || v === 'intro' ? v : null;
  }

  /* Svarar true när ett lösenord sparades nyss. */
  async function lösenordFörst(supa, user) {
    if (NX.inbjudan || välkomstläge(user) === 'losenord') {
      var sparat = await nyttLösenord(supa, { inbjuden: true, tvingad: true, epost: user.email,
                                              data: { valkommen: 'intro' } });
      if (sparat) user.user_metadata = Object.assign({}, user.user_metadata, { valkommen: 'intro' });
      return sparat;
    }
    if (NX.återställning) return nyttLösenord(supa, { epost: user.email });
    return false;
  }

  /* roll är 'foralder' eller 'studiehjalpare'. o.sparat och o.väntar
     går till NXIntro. Välkomsten tas bort när Fortsätt tryckts; går det
     inte visas introduktionen en gång till nästa gång, vilket är bättre
     än att vyn väntar på det. */
  async function introduktion(supa, user, roll, o) {
    if (välkomstläge(user) !== 'intro' || typeof NXIntro === 'undefined') return;
    await NXIntro.visa({ roll: roll, sparat: !!(o && o.sparat), väntar: !!(o && o.väntar) });
    user.user_metadata = Object.assign({}, user.user_metadata, { valkommen: null });
    supa.auth.updateUser({ data: { valkommen: null } }).then(function () {}, function () {});
  }

  /* ============================================================
     ANVÄNDARVILLKOREN (2026-10-07)

     Leo: "Fixa den gamla luckan". Ingen godkände användarvillkoren när
     kontot skapades. Den som registrerar sig gör det nu med kryssrutan
     i Skapa konto, och alla andra här: den vi tagit in (efter
     lösenordet, före introduktionen), den som registrerade sig före
     2026-10-07, och alla igen när villkoren ändras.

     Databasen säger om rutan ska visas (mitt_villkorslage), skriver
     godkännandet med sin egen tid (godkann_villkor) och kräver det: ett
     pass föreslås och bekräftas, och timmar köps, bara av den som
     godkänt den gällande versionen. Rutan går därför inte att stänga.
     Logga ut står kvar, så att den som vill läsa i lugn och ro inte är
     fast, och länkarna öppnas i en ny flik, så att rutan står kvar.

     Svarar databasen inte, eller saknas funktionen (en databas före
     migrationen), visas ingen ruta: vyn ska gå att använda, och spärren
     i databasen säger själv till om ett pass kräver ett godkännande.
     roll är 'foralder' eller 'studiehjalpare'.
     ============================================================ */
  async function villkorFörst(supa, user, roll) {
    if (!supa || !user) return;
    var läge;
    try {
      var svar = await supa.rpc('mitt_villkorslage');
      if (svar.error || !svar.data) return;
      läge = svar.data;
    } catch (e) { return; }
    if (!läge.version || läge.godkant_at) return;
    await villkorsruta(supa, läge, roll);
  }

  function villkorsruta(supa, läge, roll) {
    return new Promise(function (klar) {
      var ändrade = !!läge.tidigare;
      var ruta = document.createElement('div');
      ruta.className = 'nx-fraga';
      ruta.innerHTML =
        '<div class="nx-fraga-box" role="dialog" aria-modal="true" aria-labelledby="villkor-t" aria-describedby="villkor-d">'
        + '<h3 id="villkor-t">' + (ändrade ? 'Användarvillkoren har ändrats' : 'Godkänn användarvillkoren') + '</h3>'
        + '<p id="villkor-d">' + (ändrade
          ? 'Vi har ändrat användarvillkoren, senast ' + esc(datumText(läge.version))
            + '. Läs dem och godkänn dem, så går du vidare.'
          : roll === 'studiehjalpare'
            ? 'Innan du börjar: läs användarvillkoren och godkänn dem. Där står vad som gäller för dig som '
              + 'studiehjälpare, och vad familjerna kan räkna med.'
            : 'Innan du börjar: läs användarvillkoren och godkänn dem. Där står hur bokning, betalning och '
              + 'avbokning går till, vad ångerrätten innebär och vad som gäller om ni vill sluta.') + '</p>'
        + '<p class="nx-villkor-lankar"><a href="/anvandarvillkor" target="_blank" rel="noopener">Läs användarvillkoren</a>'
        + '<a href="/integritetspolicy" target="_blank" rel="noopener">Så hanterar vi dina uppgifter</a></p>'
        + '<form data-villkor novalidate>'
        + '<label class="nx-ja"><input type="checkbox" id="villkor-ja">'
        + '<span>Jag har läst och godkänner användarvillkoren.</span></label>'
        + '<p class="ok-msg" id="villkor-msg" role="alert"></p>'
        + '<div class="nx-fraga-knappar">'
        + '<button type="button" class="btn btn-ghost" data-villkor-ut>Logga ut</button>'
        + '<button type="submit" class="btn btn-primary">Godkänn och fortsätt</button>'
        + '</div></form></div>';

      var sistaFokus = document.activeElement;
      function stäng() {
        ruta.remove();
        document.body.style.overflow = '';
        document.removeEventListener('keydown', tangent);
        if (sistaFokus && sistaFokus.focus) sistaFokus.focus();
        klar(true);
      }
      /* Escape stänger inte: utan ett godkännande går det inte att boka. */
      function tangent(e) {
        if (e.key !== 'Tab') return;
        var kan = ruta.querySelectorAll('a[href], input, button');
        var f = kan[0], s = kan[kan.length - 1];
        if (e.shiftKey && document.activeElement === f) { e.preventDefault(); s.focus(); }
        else if (!e.shiftKey && document.activeElement === s) { e.preventDefault(); f.focus(); }
      }

      var form = ruta.querySelector('form'), msg = ruta.querySelector('#villkor-msg');
      var ja = ruta.querySelector('#villkor-ja');
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        NX.rensa(msg);
        if (!ja.checked) { NX.säg(msg, 'Kryssa i rutan för att godkänna villkoren.', false); ja.focus(); return; }
        await medan(form.querySelector('[type="submit"]'), 'Sparar…', async function () {
          var svar;
          try { svar = await supa.rpc('godkann_villkor', { p_version: läge.version }); } catch (err) { svar = { error: err }; }
          if (svar && svar.error) { NX.säg(msg, NX.felText(svar.error), false); return; }
          stäng();
        });
      });
      ruta.addEventListener('click', function (e) {
        if (e.target.closest('[data-villkor-ut]')) loggaUt(supa);
      });
      document.addEventListener('keydown', tangent);

      document.body.appendChild(ruta);
      document.body.style.overflow = 'hidden';
      void ruta.offsetWidth;
      ruta.classList.add('open');
      ja.focus();
    });
  }

  /* ============================================================
     INLOGGNINGEN SOM FÖRSVINNER (2026-09-29)

     Leo: "kontroller i admins inställning i automationer går inte att
     köra". Kontrollerna var hela. Adminvyn var utloggad och visste det
     inte.

     supabase-js förnyar inloggningen i bakgrunden. Nekar Auth, för att
     sessionen är borttagen, tar den bort sessionen ur webbläsaren och
     säger SIGNED_OUT, och varje fråga därefter går med den publika
     nyckeln, som anon. Ingen vy lyssnade. Adminvyn stod kvar med
     gårdagens listor, räknarna i sidhuvudet blev noll utan fel (RLS ger
     anon noll rader), och första knappen som skrev något svarade
     "permission denied for function kor_kontrollerna": ett besked som
     såg ut som ett fel i funktionen och betydde att man var utloggad.

     Sessionen dog för att en utloggning på telefonen loggade ut datorn
     också. Det är loggaUt() nedan.
     ============================================================ */

  /* Satt medan vyn själv loggar ut, så att vakten inte hinner visa
     "du har blivit utloggad" för den som just tryckt på knappen. */
  var loggarUt = false;

  /* Logga ut här, inte överallt. signOut() tar som förval bort ALLA
     personens sessioner, på alla enheter: den som loggade ut på
     telefonen loggade ut adminvyn på datorn, och det märktes först när
     datorn skulle förnya inloggningen nästa morgon. Ska någon loggas ut
     överallt görs det i databasen (CLAUDE.md, avsnitt 6).

     supa skickas in, som till notisval och vakten nedan. */
  async function loggaUt(supa) {
    loggarUt = true;
    if (supa) await supa.auth.signOut({ scope: 'local' });
    location.reload();
  }

  /* o.supa är klienten, o.user den som vyn visar, och o.utloggad()
     byter till vyns inloggningsruta. Anropas när vyn vet vem som är
     inloggad, i alla lägen: också en låst eller väntande vy frågar
     databasen. */
  function vaktaInloggningen(o) {
    var supa = o && o.supa;
    if (!supa || !supa.auth || !supa.auth.onAuthStateChange || !o.user) return;
    var borta = false;
    supa.auth.onAuthStateChange(function (händelse, session) {
      if (loggarUt) return;
      var vem = session && session.user ? session.user.id : null;
      /* supabase-js håller sitt lås medan lyssnarna körs, och en fråga
         härifrån hade väntat på det för alltid. Allt görs efteråt. */
      if (borta) {
        /* Inloggad igen, i rutan eller i en annan flik: börja om som
           den som är inloggad nu. Adressen står kvar, så vyn öppnar där
           man var. */
        if (vem) setTimeout(function () { location.reload(); }, 0);
        return;
      }
      if (vem === o.user.id) return;
      if (vem) {
        /* Någon annan loggade in i samma webbläsare, i en annan flik.
           Sessionen är delad, så vyn hade fortsatt fråga och skriva med
           den personens token, med den förras listor på skärmen. */
        setTimeout(function () { location.reload(); }, 0);
        return;
      }
      borta = true;
      setTimeout(function () {
        var na = NX.$('#nav-actions'), ma = NX.$('#m-actions');
        if (na) na.innerHTML = '';
        if (ma) ma.innerHTML = '';
        o.utloggad();
        var epost = NX.$('#a-email');
        if (epost && !epost.value) epost.value = o.user.email || '';
        NX.säg(NX.$('#auth-msg'), 'Du har blivit utloggad, till exempel för att inloggningen gått ut '
          + 'eller för att du loggat ut i en annan flik. Logga in igen så kommer du tillbaka hit.');
        var lösen = NX.$('#a-pass');
        if (lösen) lösen.focus();
      }, 0);
    });
  }

  /* Veckoschemat i #schema. Byggs en gång och får sedan nya
     bokningar; namn(b) säger vad som står på ett pass i just den här
     vyn. */
  function schemaI(S, o) {
    var host = NX.$('#schema');
    if (!host) return;
    if (S.schema) { S.schema.sättBokningar(S.bokningar); return; }
    S.schema = schema({
      host: host,
      bokningar: S.bokningar,
      lage: o.lage,
      namn: o.namn,
      onOppna: o.onOppna
    });
  }

  /* ============================================================
     NOTISVALEN — vilka mejl man vill ha

     Raderna ligger i notis_val, en per person, typ och kanal. RLS
     släpper bara igenom ens egna ("användaren styr sina notisval"),
     så vyn behöver ingen egen kontroll: en annans rad går inte att
     läsa och inte att skriva.

     EN SAKNAD RAD BETYDER PÅ. notis_vill() i databasen faller tillbaka
     på `kanal = 'mejl'` — mejl på som förval, SMS av. Vyn måste visa
     samma sak, annars ser en orörd inställning avstängd ut medan
     mejlen fortsätter komma.

     BARA MEJL VISAS. notis_val har också kanalen 'sms', men SMS står i
     provläge (notis_drift.sms_lage) och skickar ingenting. En
     strömbrytare för något som ändå inte går ut vore ett löfte vi inte
     håller. Dyker SMS upp på riktigt är det här stället att utöka.

     rapport står i notis_typer men INTE i notis_mejlbara: den syns
     bara i vyn och mejlas aldrig. Den har därför ingen rad här — en
     avstängbar mejlnotis som aldrig var ett mejl är bara förvirrande.

     Texterna för påminnelser och chatt läses ur notis_installning i
     stället för att stå skrivna här. Admin kan ändra takten, och en
     hårdkodad "dagen före" hade blivit osann utan att någon märkte
     det.

     supa skickas in. Resten av filen rör ingen databas alls, och den
     regeln är värd att hålla — men två vyer med var sin kopia av
     samma fråga är precis det som glider isär.
     ============================================================ */
  var NOTISVAL = [
    { typ: 'pass_nytt',      namn: 'Nytt pass',            om: 'När ett pass bokas eller föreslås.' },
    { typ: 'pass_bekraftat', namn: 'Bekräftat pass',       om: 'När en föreslagen tid blir bekräftad.' },
    { typ: 'pass_flyttat',   namn: 'Flyttat pass',         om: 'När ett pass byter tid.' },
    { typ: 'pass_avbokat',   namn: 'Avbokat pass',         om: 'När ett bokat pass ställs in.' },
    { typ: 'pass_avbojt',    namn: 'Avböjd tid',           om: 'När en föreslagen tid inte passar.' },
    { typ: 'meddelande',     namn: 'Nya meddelanden',      om: 'När någon skriver till dig.' },
    { typ: 'paminnelse',     namn: 'Påminnelse före pass', om: 'Innan ett bokat pass.' },
    /* Fas 21.2. Bara familjen köper timmar, så bara föräldravyn visar
       raden: en strömbrytare för ett mejl man aldrig kan få är brus. */
    { typ: 'timmar_gar_ut',  namn: 'Köpta timmar går ut',  om: 'Tio dagar innan köpta timmar går ut, om det finns timmar kvar.', bara: 'parent' }
  ];

  function notisval(o) {
    var host = o.host;
    var supa = o.supa;
    var anvandare = o.anvandare;
    var msg = o.msg || null;

    var pa = {};         /* typ -> det som visas just nu */
    var inst = null;     /* notis_installning, för texterna */
    var upptagen = {};   /* typ -> true medan ett sparande pågår */

    function beskrivning(rad) {
      if (rad.typ === 'paminnelse' && inst && (inst.paminnelser_timmar || []).length) {
        return 'Skickas ' + inst.paminnelser_timmar.map(function (h) { return h + ' h'; })
          .join(' och ') + ' före passet.';
      }
      if (rad.typ === 'meddelande' && inst && inst.chatt_samla_minuter) {
        return 'Flera meddelanden samlas till ett mejl per '
          + inst.chatt_samla_minuter + ' minuter.';
      }
      return rad.om;
    }

    /* o.roll säger vilken vy som ritar. En rad med bara: visas bara där. */
    var rader = NOTISVAL.filter(function (rad) { return !rad.bara || rad.bara === o.roll; });

    function rita() {
      host.innerHTML = rader.map(function (rad) {
        var på = pa[rad.typ] !== false;
        return '<div class="nx-nval">'
          + '<div class="nx-nval-text"><b>' + esc(rad.namn) + '</b>'
          + '<span class="xsmall">' + esc(beskrivning(rad)) + '</span></div>'
          + '<button class="chip" type="button" data-notistyp="' + esc(rad.typ) + '"'
          + ' aria-pressed="' + (på ? 'true' : 'false') + '"'
          + (upptagen[rad.typ] ? ' disabled' : '')
          + '>' + (på ? 'Mejl på' : 'Mejl av') + '</button>'
          + '</div>';
      }).join('');
    }

    function laddar(text) {
      host.innerHTML = '<p class="xsmall">' + esc(text) + '</p>';
    }

    /* Ett klick per typ. Lyssnaren sitter på behållaren, inte på
       knapparna: rita() byter ut dem vid varje ändring, och en
       lyssnare per knapp hade försvunnit med dem. Inline-hanterare
       går inte — vyerna har script-src 'self'. */
    host.addEventListener('click', function (e) {
      var knapp = e.target.closest('[data-notistyp]');
      if (!knapp || knapp.disabled) return;
      var typ = knapp.dataset.notistyp;
      if (upptagen[typ]) return;

      var fore = pa[typ] !== false;
      var efter = !fore;

      /* Växlas direkt och rullas tillbaka om sparandet faller. En
         strömbrytare som står still tills servern svarat känns
         trasig; en som ljuger är värre, därför rullas den tillbaka. */
      pa[typ] = efter;
      upptagen[typ] = true;
      rita();
      if (msg) NX.rensa(msg);

      supa.from('notis_val')
        .upsert({ profil_id: anvandare, typ: typ, kanal: 'mejl', pa: efter },
                { onConflict: 'profil_id,typ,kanal' })
        .then(function (svar) {
          upptagen[typ] = false;
          if (svar.error) {
            pa[typ] = fore;
            rita();
            if (msg) NX.säg(msg, 'Kunde inte spara: ' + NX.felText(svar.error), false);
            return;
          }
          rita();
          if (msg) {
            NX.säg(msg, efter ? '✓ Du får mejl om det här igen.'
                              : '✓ Sparat. Du får inga fler mejl om det här.', true);
          }
        });
    });

    laddar('Hämtar dina val …');

    Promise.all([
      supa.from('notis_val').select('typ, pa').eq('profil_id', anvandare).eq('kanal', 'mejl'),
      supa.from('notis_installning').select('paminnelser_timmar, chatt_samla_minuter').eq('id', 1).maybeSingle()
    ]).then(function (svar) {
      var val = svar[0];
      if (val.error) {
        laddar('Dina val gick inte att hämta just nu.');
        return;
      }
      (val.data || []).forEach(function (r) { pa[r.typ] = r.pa !== false; });
      /* Inställningen är bara text. Faller den ritas raderna ändå,
         med de allmänna beskrivningarna. */
      inst = svar[1] && !svar[1].error ? svar[1].data : null;
      rita();
    });
  }

  /* ============================================================
     DOKUMENTEN — det Nextrum delat med en (2026-09-29)

     Leo: "man ska kunna spara dokument där och välja vilken person som
     ska ha tillgång till det genom sina inställningar. dvs
     anställningsavtal med lärare eller annat avtal med kund." Admin
     väljer personen under System → Dokument, och personen läser det
     här, under Profil & inställningar → Dokument, i båda vyerna.

     Listan kommer ur mina_handlingar(), som bara svarar om den
     inloggade och med en fast kolumnlista: tabellen handlingar har
     ingen policy för familjen eller studiehjälparen, för den bär vår
     egen anteckning. Filen öppnas genom NXMedia.öppnaFil, och hinken
     släpper bara in exakt den fil raden pekar ut.

     Bara läsa. Personen laddar inte upp och tar inte bort: det är vårt
     dokument, och hen har en kopia.

     Finns funktionen inte än (migrationen dokument_delas_med_personen
     är inte körd) står listan tom, inte som ett fel: det finns inget
     delat förrän den är det.

     ETT AVTAL SOM TEXT (2026-10-05). Leo: "jag ska kunna klistra in
     avtal som lagras hos mig och hos de". En rad utan fil är en text
     (avtal_som_text). Listan bär den inte; Läs hämtar den genom
     min_handling_text() och fäller ut den under raden, och Ladda ned
     ger en textfil som är personens egen kopia, utanför inloggningen.

     supa skickas in, som till notisval: resten av filen rör ingen
     databas, och två vyer med var sin kopia av samma fråga glider isär.
     ============================================================ */
  var DOKTYP = {
    avtal: 'Avtal', intyg: 'Intyg', forsakring: 'Försäkring',
    bolagshandling: 'Bolagshandling', policy: 'Policy', ovrigt: 'Övrigt'
  };
  var DOK_IKON = '<svg viewBox="0 0 24 24" aria-hidden="true">'
    + '<path d="M14 3.5H6.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V9z"/>'
    + '<path d="M14 3.5V9h5.5M8.5 13h7M8.5 16.5h5"/></svg>';

  function dokument(o) {
    var host = o.host;
    var supa = o.supa;
    var msg = o.msg || null;
    var rader = [];
    /* Texterna som hämtats, per id. Läs en gång till hämtar inte igen. */
    var texter = {};
    if (!host || !supa) return;

    /* Samma regel som NXMedia.öppnaFil: det webbläsaren visar öppnas,
       resten laddas ned. Knappen säger vilket av dem som händer. */
    function iFlik(d) {
      return /^(application\/pdf|image\/(jpeg|png|webp))$/.test(d.mimetyp || '');
    }
    function ärText(d) { return !d.fil; }
    /* Sökvägen är "<id>/<tidsstämpel>-<filnamn>". */
    function filnamn(d) {
      return String(d.fil || '').split('/').slice(1).join('/').replace(/^\d+-/, '');
    }

    function rita() {
      if (!rader.length) {
        host.innerHTML = '<p class="xsmall nx-dok-tom">Inga dokument än.</p>';
        return;
      }
      var idag = NX.isoFor(new Date());
      host.innerHTML = rader.map(function (d) {
        var under = [DOKTYP[d.typ] || 'Dokument',
                     ärText(d) ? 'Text' : NXMedia.filEtikett(d.mimetyp), NXMedia.filstorlek(d.storlek),
                     d.uppladdad ? 'tillagt ' + NX.datumText(String(d.uppladdad).slice(0, 10)) : null];
        if (d.giltig_till) {
          under.push((d.giltig_till < idag ? 'gällde till ' : 'gäller till ') + NX.datumText(d.giltig_till));
        }
        return '<div class="nx-dok">'
          + '<span class="vy-rad-ik ar-tyst">' + DOK_IKON + '</span>'
          + '<div class="nx-dok-text"><b>' + esc(d.titel) + '</b>'
          + '<span class="xsmall">' + esc(under.filter(Boolean).join(' · ')) + '</span></div>'
          + (ärText(d)
            ? '<button class="btn btn-ghost btn-sm" type="button" data-dok-las="' + esc(d.id) + '"'
              + ' aria-expanded="false" aria-controls="dok-las-' + esc(d.id) + '">Läs</button>'
              + '<div class="nx-dok-las" id="dok-las-' + esc(d.id) + '" hidden></div>'
            : '<button class="btn btn-ghost btn-sm" type="button" data-dok-oppna="' + esc(d.id) + '">'
              + (iFlik(d) ? 'Öppna' : 'Ladda ned') + '</button>')
          + '</div>';
      }).join('');
    }

    /* medan() anropar jobbet direkt, och öppnaFil öppnar fliken innan
       den väntar på något: allt sker i samma tryck, som Safari kräver.
       Lyssnaren sitter på behållaren, som för notisvalen: raderna ritas
       om, behållaren står kvar. */
    host.addEventListener('click', function (e) {
      var spara = e.target.closest('[data-dok-spara]');
      if (spara) {
        var t = rader.filter(function (x) { return x.id === spara.dataset.dokSpara; })[0];
        if (t && texter[t.id] != null) NXMedia.sparaText(texter[t.id], t.titel);
        return;
      }
      /* Texten fälls ut under raden, nedanför knappen: det som står
         ovanför det man trycker på byter inte höjd. */
      var läs = e.target.closest('[data-dok-las]');
      if (läs) {
        if (läs.getAttribute('aria-busy')) return;
        var dt = rader.filter(function (x) { return x.id === läs.dataset.dokLas; })[0];
        var ruta = dt && document.getElementById('dok-las-' + dt.id);
        if (!ruta) return;
        if (msg) NX.rensa(msg);
        if (!ruta.hidden) {
          ruta.hidden = true;
          läs.setAttribute('aria-expanded', 'false');
          läs.textContent = 'Läs';
          return;
        }
        var visa = function () {
          ruta.innerHTML = '<div class="nx-dok-avtal">' + esc(texter[dt.id]) + '</div>'
            + '<button class="btn btn-ghost btn-sm" type="button" data-dok-spara="' + esc(dt.id) + '">Ladda ned</button>';
          ruta.hidden = false;
          läs.setAttribute('aria-expanded', 'true');
          läs.textContent = 'Dölj';
        };
        if (texter[dt.id] != null) { visa(); return; }
        medan(läs, 'Hämtar…', function () {
          return supa.rpc('min_handling_text', { p_id: dt.id });
        }).then(function (svar) {
          /* Null är en text som inte längre är delad, eller borttagen
             sedan listan hämtades. */
          if (!svar || svar.error || typeof svar.data !== 'string') {
            var fel = 'Texten gick inte att hämta. Ladda om sidan, eller skriv till oss.';
            if (msg) NX.säg(msg, fel, false);
            else alert(fel);
            return;
          }
          texter[dt.id] = svar.data;
          visa();
        });
        return;
      }
      var knapp = e.target.closest('[data-dok-oppna]');
      if (!knapp || knapp.getAttribute('aria-busy')) return;
      var d = rader.filter(function (x) { return x.id === knapp.dataset.dokOppna; })[0];
      if (!d) return;
      if (msg) NX.rensa(msg);
      medan(knapp, iFlik(d) ? 'Öppnar…' : 'Hämtar…', function () {
        return NXMedia.öppnaFil('dokument', d.fil, { mimetyp: d.mimetyp, namn: filnamn(d) });
      }).then(function (fel) {
        if (!fel) return;
        if (msg) NX.säg(msg, fel, false);
        else alert(fel);
      });
    });

    host.innerHTML = '<div class="loading">Hämtar</div>';
    supa.rpc('mina_handlingar').then(function (svar) {
      if (svar.error) {
        if (svar.error.code === 'PGRST202' || svar.error.code === '42883') {
          rader = [];
          rita();
          return;
        }
        host.innerHTML = '<p class="xsmall nx-dok-tom">Dokumenten gick inte att hämta just nu. '
          + 'Ladda om sidan, eller skriv till oss.</p>';
        return;
      }
      rader = svar.data || [];
      rita();
    });
  }

  /* ============================================================
     TIPSA EN FAMILJ (2026-09-30)

     Familjens och studiehjälparens egen kod, med länken till
     intresseanmälan. mina_tips() skapar koden första gången och svarar
     med hur många som anmält sig med den och hur många av dem som blivit
     kunder, aldrig vilka. Familjen ser också timmarna på köpet: en per
     ny familj som haft sitt första pass, räknade i databasen
     (forsta_timmen_bjuds). Studiehjälparen får ingen ersättning för ett
     tips, med flit, och rutan säger det.

     Länken går direkt till intresseanmälan, där formuläret fyller i
     koden i ett fält familjen ser. Ingenting lagras i webbläsaren på
     vägen (CLAUDE.md avsnitt 6, Samtycket).

     Svarar med datan, så att bokningen kan visa timmen på köpet i
     förväg. Finns funktionen inte än (migrationen
     tipskoder_och_kampanjkoder är inte körd) står rutan tyst.
     ============================================================ */
  var TIPS_ADRESS = 'https://nextrum.se/intresseanmalan?kod=';

  function tipsa(o) {
    var host = o.host;
    var supa = o.supa;
    var familj = o.roll === 'parent';
    var data = null;
    if (!host || !supa) return Promise.resolve(null);
    /* Ett andra anrop hämtar om i samma ruta, med samma lyssnare. Efter
       ett förslag har timmen kanske dragits. */
    if (host.__tipsa) return host.__tipsa();

    function länk() { return TIPS_ADRESS + encodeURIComponent(data.kod); }
    function antal(n, en, fler) { return n === 1 ? en : n + ' ' + fler; }

    /* Texten följer med i dela-rutan och går att ändra där. Timmen står
       i den, för den som får tipset ska veta att den som tipsar får
       något för det. */
    function delaText() {
      return familj
        ? 'Läxhjälp i Stockholm genom Nextrum. Skriv vår kod ' + data.kod
          + ' i anmälan. Vi får en timme på köpet när ni haft ert första pass.'
        : 'Läxhjälp i Stockholm genom Nextrum, där jag är studiehjälpare. Skriv min kod '
          + data.kod + ' i anmälan.';
    }

    function rita() {
      if (!data) {
        host.innerHTML = '<p class="xsmall nx-dok-tom">Tipsa en familj finns inte här än.</p>';
        return;
      }
      var n = Number(data.anmalda || 0);
      var k = Number(data.kunder || 0);
      var kvar = Number(data.kvar || 0);
      var tal = [];
      if (n) tal.push(antal(n, 'En familj har anmält sig med koden', 'familjer har anmält sig med koden'));
      if (k) tal.push(antal(k, 'en har blivit kund', 'har blivit kunder'));

      var intro = familj
        ? 'Känner ni en familj som behöver hjälp med skolan? Dela er länk, eller be dem skriva koden i intresseanmälan.'
          + (data.timme_ges
            ? ' När en ny familj som anmält sig med er kod har haft sitt första pass får ni en timme läxhjälp på köpet.'
            : '')
        : 'Känner du en familj som behöver läxhjälp? Dela din länk, eller be dem skriva koden i intresseanmälan. '
          + 'Då ser vi att tipset kom från dig.';

      host.innerHTML = '<p class="nx-tips-intro">' + esc(intro) + '</p>'
        + (data.aktiv
          ? '<div class="nx-tips-kod"><span class="nx-tips-et">' + (familj ? 'Er kod' : 'Din kod') + '</span>'
            + '<b translate="no">' + esc(data.kod) + '</b></div>'
            + '<label class="nx-tips-et" for="tips-lank">Länken</label>'
            + '<input class="inp nx-tips-lank" id="tips-lank" readonly value="' + esc(länk()) + '">'
            + '<div class="nx-tips-knappar">'
            + (navigator.share ? '<button class="btn btn-primary btn-sm" type="button" data-tips-dela>Dela länken</button>' : '')
            + '<button class="btn ' + (navigator.share ? 'btn-ghost' : 'btn-primary') + ' btn-sm" type="button" data-tips-kopiera>Kopiera länken</button>'
            + '</div>'
          : '<p class="nx-tips-av">Koden är avstängd. Skriv till oss om du undrar varför.</p>')
        + (kvar && familj
          ? '<p class="nx-tips-timme"><b>' + esc(antal(kvar, 'En timme', 'timmar')) + ' på köpet.</b> '
            + 'Den dras på nästa läxhjälpspass ni föreslår, en timme per pass.</p>'
          : '')
        + (tal.length ? '<p class="nx-tips-tal">' + esc(tal.join(', ')) + '.</p>' : '')
        + '<p class="xsmall nx-tips-not">'
        + (familj
          ? 'Ni ser hur många som anmält sig med er kod, inte vilka. Timmen på köpet går inte att växla in mot pengar. '
          : 'Tipset ger ingen ersättning, varken pengar eller timmar. Du ser hur många som anmält sig med din kod, inte vilka. ')
        + '<a href="/anvandarvillkor#tips">Villkoren för tips</a></p>';
    }

    /* Kopiera faller tillbaka på att markera länken: utan https eller
       med en äldre Safari finns inget urklipp att skriva till. */
    function kopiera(knapp) {
      var fält = host.querySelector('#tips-lank');
      function klart(text) {
        knapp.textContent = text;
        setTimeout(function () { knapp.textContent = 'Kopiera länken'; }, 2200);
      }
      function markera() {
        if (fält) { fält.focus(); fält.select(); }
        klart('Markerad, kopiera den');
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(länk()).then(function () { klart('Kopierad'); }, markera);
      } else {
        markera();
      }
    }

    host.addEventListener('click', function (e) {
      if (!data) return;
      var dela = e.target.closest('[data-tips-dela]');
      if (dela && navigator.share) {
        /* Avbryter man delningen kastar den. Det är inget fel. */
        navigator.share({ title: 'Nextrum', text: delaText(), url: länk() }).catch(function () {});
        return;
      }
      var k = e.target.closest('[data-tips-kopiera]');
      if (k) kopiera(k);
    });

    var FEL = '<p class="xsmall nx-dok-tom">Koden gick inte att hämta just nu. Ladda om sidan, eller skriv till oss.</p>';
    /* "Hämtar" bara första gången: rutan byts inte mot en laddning när
       den redan har innehåll (avsnitt 3, fälla 1). */
    function hämta() {
      if (!data) host.innerHTML = '<div class="loading">Hämtar</div>';
      return supa.rpc('mina_tips').then(function (svar) {
        if (svar.error) {
          if (svar.error.code === 'PGRST202' || svar.error.code === '42883') { data = null; rita(); return null; }
          if (!data) host.innerHTML = FEL;
          return data;
        }
        data = svar.data || null;
        rita();
        return data;
      }, function () {
        if (!data) host.innerHTML = FEL;
        return data;
      });
    }
    host.__tipsa = hämta;
    return hämta();
  }

  /* ============================================================
     BARNETS TRÅD MED STUDIEHJÄLPAREN (2026-10-06)

     Leo: "Man ska kunna skriva till sin studiehjälpare på barn vyn", och
     sedan valet "egen tråd, föräldern läser". Tråden står i
     barn_meddelanden, inte i familjens messages: barnkontot har ingen
     profil att stå som avsändare, och familjens tråd är förälderns.
     Alla vägar in går genom databasens funktioner, och samma ritning
     används i tre vyer:

       · elevvyn skriver som barnet (barn_chatt, barn_chatt_skriv)
       · studiehjälparvyn skriver som studiehjälparen (barnchatt_trad,
         barnchatt_skriv)
       · studievyn läser, utan skrivruta: föräldern ser vad barnet och
         studiehjälparen skriver, men deltar inte i den tråden

     o.host     elementet tråden ritas i
     o.jag      'barn', 'studiehjalpare' eller null (bara läsning)
     o.namn     { barn, studiehjalpare }: förnamnen under bubblorna
     o.tom      texten när tråden är tom
     o.skriv, o.knapp, o.skicka(text) → Promise<{ fel }>: skrivrutan,
                bara där någon skriver
     Svarar { rita(rader) }. En rad är { id, fran, text, skapad, last }.
     All text ur databasen ritas med esc().
     ============================================================ */
  function barnTråd(o) {
    var host = o.host, senast = null;

    function dag(iso) {
      var d = String(iso || '').slice(0, 10);
      var igår = new Date(); igår.setDate(igår.getDate() - 1);
      var lokal = isoFor(new Date(iso));
      if (lokal === isoFor(new Date())) return 'Idag';
      if (lokal === isoFor(igår)) return 'Igår';
      return datumText(lokal || d);
    }
    function klocka(iso) {
      var d = new Date(iso);
      return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }

    function rita(rader) {
      rader = rader || [];
      var sign = rader.length + '|' + (rader.length ? rader[rader.length - 1].id + (rader[rader.length - 1].last || '') : '');
      if (sign === senast) return;
      senast = sign;
      if (!rader.length) {
        host.innerHTML = '<div class="empty">' + esc(o.tom || 'Inga meddelanden än.') + '</div>';
        return;
      }
      var ut = '', förra = '';
      rader.forEach(function (m) {
        var d = dag(m.skapad);
        if (d !== förra) { ut += '<div class="tr-dag">' + esc(d) + '</div>'; förra = d; }
        /* Den som läser utan att skriva (föräldern) har studiehjälparen
           till höger, som i föräldrarnas egen tråd. */
        var min = o.jag ? m.fran === o.jag : m.fran === 'studiehjalpare';
        var vem = (o.namn && o.namn[m.fran]) || (m.fran === 'barn' ? 'Eleven' : 'Studiehjälparen');
        ut += '<div class="tr-rad ' + (min ? 'min' : 'deras') + '">'
          + '<div class="tr-bubbla">' + esc(m.text) + '</div>'
          + '<span class="tr-tid">' + (o.jag && min ? '' : esc(vem) + ' · ') + esc(klocka(m.skapad))
          + (o.jag && min && !m.last ? ' · <span class="oläst">oläst</span>' : '')
          + '</span></div>';
      });
      host.innerHTML = ut;
      host.scrollTop = host.scrollHeight;
    }

    async function skicka() {
      var text = String(o.skriv.value || '').trim();
      if (!text || o.knapp.hasAttribute('aria-busy')) return;
      await medan(o.knapp, 'Skickar…', async function () {
        var svar = await o.skicka(text);
        if (svar && svar.fel) return;
        o.skriv.value = '';
        o.skriv.style.height = '';
      });
    }

    if (o.skriv && o.knapp && o.skicka) {
      o.knapp.addEventListener('click', skicka);
      /* Enter skickar och Skift+Enter ger en ny rad, som i familjens tråd. */
      o.skriv.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); skicka(); }
      });
      o.skriv.addEventListener('input', function () {
        o.skriv.style.height = 'auto';
        o.skriv.style.height = Math.min(o.skriv.scrollHeight, 170) + 'px';
      });
    }

    return { rita: rita };
  }

  return {
    notisval: notisval, dokument: dokument, tipsa: tipsa,
    visaVy: visaVy, felvy: felvy, kortTid: kortTid, vyHuvud: vyHuvud,
    inloggningsruta: inloggningsruta, loggaUt: loggaUt, vaktaInloggningen: vaktaInloggningen, schemaI: schemaI,
    glömtLänkar: glömtLänkar, elevLänk: elevLänk, länkenGickInte: länkenGickInte, glömtSkicka: glömtSkicka, nyttLösenord: nyttLösenord,
    välkomstläge: välkomstläge, lösenordFörst: lösenordFörst, introduktion: introduktion,
    villkorFörst: villkorFörst,
    loggaIn: loggaIn, loggaInHär: loggaInHär,
    adminroll: adminroll,
    flyttaRuta: flyttaRuta, notiser: notiser, sidomeny: sidomeny, schema: schema, passRuta: passRuta,
    passLista: passLista, läxLista: läxLista,
    fordelning: fordelning,
    LAGE: LAGE, STEG: STEG, stegFör: stegFör, stegText: stegText, målFör: målFör,
    läxläge: läxläge, deadlineText: deadlineText,
    läxRad: läxRad, nivåMätare: nivåMätare, historikRad: historikRad, ämnesSammanfattning: ämnesSammanfattning,
    progressRad: progressRad, progressPerÄmne: progressPerÄmne,
    tomt: tomt, laddar: laddar, laddarFörsta: laddarFörsta, håll: håll, hållLista: hållLista, släppLista: släppLista,
    scrollaTill: scrollaTill, visaÖverst: visaÖverst,
    hämtaAlla: hämtaAlla, passMedSvar: passMedSvar,
    månadsval: månadsval, FÖRSTA_MÅNAD: FÖRSTA_MÅNAD, månadsGräns: månadsGräns, månadsNamn: månadsNamn, månadIso: månadIso,
    passSida: passSida, relativDag: relativDag, tidsspann: tidsspann, skälText: skälText,
    hämtaMöte: hämtaMöte, mötesRad: mötesRad,
    dagMedVeckodag: dagMedVeckodag, GICK: GICK,
    rapportKort: rapportKort,
    radLank: radLank, betalval: betalval, IKON: IKON, barnTråd: barnTråd, längdText: längdText,
    bekräfta: bekräfta, avbokaRuta: avbokaRuta, svarRuta: svarRuta, SVAR_MAX: SVAR_MAX,
    medan: medan, kolla: kolla
  };
})();
