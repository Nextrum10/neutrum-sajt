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

    return '<div class="lax' + (h.status === 'klar' ? ' avklarad' : '') + '">'
      + '<div class="lax-topp">'
      + '<b>' + esc(h.title) + '</b>'
      + '<span class="lage ' + l.klass + '">' + esc(l.text) + '</span>'
      + '</div>'
      + '<div class="lax-meta">'
      + (h.subject ? '<span class="tag">' + esc(h.subject) + '</span>' : '')
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
      + (o.atgarder ? '<div class="lax-atg">' + o.atgarder + '</div>' : '')
      + '</div>';
  }

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
        + (upp ? '<p class="upp">↑ ' + upp + ' har gått upp senaste månaden</p>' : '')
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
    var hdr = document.querySelector('.hdr');
    var under = (hdr ? hdr.getBoundingClientRect().bottom : 72) + 12;
    scrollaTill(el.getBoundingClientRect().top + window.scrollY - under);
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

  /* ---------- knapp som håller på ----------
     Låser knappen, byter texten, och släpper igen när det är klart —
     även om det gick fel. Utan det andra argumentet står den kvar
     låst för alltid när något kastar. */
  async function medan(knapp, text, jobb) {
    if (!knapp) return jobb();
    var original = knapp.textContent;
    knapp.setAttribute('aria-busy', 'true');
    knapp.textContent = text;
    try {
      return await jobb();
    } finally {
      knapp.removeAttribute('aria-busy');
      knapp.textContent = original;
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
  function flyttaRuta(opts) {
    var o = opts || {};
    return new Promise(function (klar) {
      var idag = isoFor(new Date());
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
      /* Varje timme 07–22, samma lista som förslaget i bokningen
         (NXArbete.HELA_DAGEN). Studiehjälparens veckoschema finns inte
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
        stäng({ datum: valt.datum, tid: valt.tid });
      });

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
          ? '<div class="pass-block"><h6>Läxor omkring passet</h6>'
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
       kort:    [{ rubrik, rader: [[etikett, värde]] }],
       block:   [{ rubrik, html }]         anteckning, rapport, läxor
     }
     ============================================================ */
  function passSida(o) {
    var host = o && o.host;
    if (!host) return;

    var steg = (o.steg || []).map(function (s) {
      return '<li class="ps-steg' + (s.klar ? ' ar-klar' : '') + (s.nu ? ' ar-nu' : '') + '"'
        + (s.nu ? ' aria-current="step"' : '') + '>'
        + '<span class="ps-steg-prick" aria-hidden="true"></span>' + esc(s.namn) + '</li>';
    }).join('');

    var kort = (o.kort || []).map(function (k) {
      var rader = (k.rader || []).filter(function (r) { return r && r[1]; });
      if (!rader.length) return '';
      return '<div class="ps-kort"><h6>' + esc(k.rubrik) + '</h6>'
        + rader.map(function (r) {
            return '<div class="ps-rad"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>';
          }).join('')
        + '</div>';
    }).join('');

    var block = (o.block || []).filter(function (b) { return b && b.html; }).map(function (b) {
      return '<div class="ps-block"><h6>' + esc(b.rubrik) + '</h6>' + b.html + '</div>';
    }).join('');

    host.innerHTML =
      '<a class="ps-tillbaka" href="' + esc(o.tillbaka ? o.tillbaka.href : '#') + '">'
      + '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M7.5 2.5 4 6l3.5 3.5"/></svg>'
      + esc(o.tillbaka ? o.tillbaka.text : 'Tillbaka') + '</a>'
      + '<div class="ps-huvud">'
      + '<div>'
      + '<h2 class="ps-titel" tabindex="-1">' + esc(o.titel || 'Passet') + '</h2>'
      + '<p class="ps-nar">' + esc(o.nar || '')
      + (o.relativ ? ' <em>· ' + esc(o.relativ) + '</em>' : '') + '</p>'
      + '</div>'
      + (o.lage ? '<span class="lage ' + esc(o.lage.klass || '') + '">' + esc(o.lage.text) + '</span>' : '')
      + '</div>'
      + (steg ? '<ol class="ps-vag" aria-label="Var passet står">' + steg + '</ol>' : '')
      + (o.besked || o.atgarder
          ? '<div class="ps-gor' + (o.besked && o.besked.ton ? ' ar-' + esc(o.besked.ton) : '') + '">'
            + (o.besked ? '<p>' + esc(o.besked.text) + '</p>' : '')
            + (o.atgarder ? '<div class="ps-knappar">' + o.atgarder + '</div>' : '')
            + '</div>'
          : '')
      + (kort ? '<div class="ps-kortrad">' + kort + '</div>' : '')
      + block;
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

     Tre lägen, samma data. Månad för att få överblick, vecka för att
     planera, dag för att se vad som faktiskt händer idag. Lägena är
     inte tre komponenter utan tre sätt att rita samma lista, så en
     bokning kan aldrig visas olika beroende på vilket läge man står i.

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

    var läge = ['manad', 'vecka', 'dag'].indexOf(o.lage) !== -1 ? o.lage : 'manad';
    var visad = new Date(); visad.setHours(12, 0, 0, 0);
    var bokningar = o.bokningar || [];

    function namnFör(b) { return typeof o.namn === 'function' ? (o.namn(b) || '') : ''; }

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

      return '<button type="button" class="sch-pass ' + (SCHEMA_LAGE[b.status] || '')
        + (passerat ? ' ar-passerad' : '')
        + '" data-pass="' + esc(b.id) + '">'
        + '<i></i><b>' + esc(b.wanted_time || '') + '</b>'
        + '<span>' + esc(b.subject || 'Pass') + '</span></button>';
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
      return '<button type="button" class="sch-full ' + (SCHEMA_LAGE[b.status] || '')
        + '" data-pass="' + esc(b.id) + '">'
        + '<span class="sch-full-tid">' + esc(b.wanted_time || '—') + '</span>'
        + '<span class="sch-full-vad"><b>' + esc(b.subject || 'Pass') + '</b>'
        + '<span>' + esc([b.format, b.location, (b.duration_min || 60) + ' min', namnFör(b)]
            .filter(Boolean).join(' · ')) + '</span></span>'
        + '</button>';
    }

    function rita() {
      var kropp = läge === 'manad' ? ritaManad() : läge === 'vecka' ? ritaVecka() : ritaDag();
      host.innerHTML =
          '<div class="sch-topp">'
        + '<div class="cal-head" style="margin-bottom:0">'
        + '<b class="sch-titel">' + esc(titel()) + '</b>'
        + '<div class="cal-nav">'
        + '<button type="button" data-sch="bak" aria-label="Bakåt"><svg viewBox="0 0 12 12"><path d="M7.5 2.5 4 6l3.5 3.5"/></svg></button>'
        + '<button type="button" data-sch="idag" class="sch-idag">Idag</button>'
        + '<button type="button" data-sch="fram" aria-label="Framåt"><svg viewBox="0 0 12 12"><path d="M4.5 2.5 8 6l-3.5 3.5"/></svg></button>'
        + '</div></div>'
        + '<div class="sch-val" role="group" aria-label="Visa som">'
        + ['manad', 'vecka', 'dag'].map(function (l) {
            return '<button type="button" data-sch-lage="' + l + '" aria-pressed="' + (l === läge) + '">'
              + { manad: 'Månad', vecka: 'Vecka', dag: 'Dag' }[l] + '</button>';
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

    var länkar = NX.$$('a[data-sek]', nav);
    var sektioner = NX.$$('section[data-sek]', rot);
    var namn = sektioner.map(function (s) { return s.dataset.sek; });
    if (!namn.length) return null;
    var standard = namn.indexOf(o.standard) !== -1 ? o.standard : namn[0];
    var första = true;

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

      /* Ett sektionsbyte flyttar INTE sidan.

         Förut scrollades den nya sektionen fram vid varje byte. Med
         scroll-behavior:smooth i nextrum.css blev det en resa uppåt
         för varje klick i menyn, på varje "Visa alla" och på varje
         kort i hälsningen — och eftersom sidhöjden ändras i samma
         ögonblick som sektionen byts hann animeringen dessutom landa
         fel: i provbänken slutade ett klick på "Dina tider" 1253px
         ned i en sektion som just öppnats.

         Kvar står bara det som sidan inte kan lösa själv: blev den
         nya sektionen så mycket kortare att webbläsaren KLÄMDE ned
         scrollen, hamnar man annars i sektionens slut utan att ha
         sett dess början. Då — och bara då — läggs sidan vid
         sektionens början, utan animering. 'instant' och inte 'auto':
         'auto' läser scroll-behavior ur CSS, och den är smooth. */
      if (!första) {
        var sektion = rot.querySelector('section[data-sek="' + vald + '"]');
        if (sektion && window.scrollY < föreY) {
          var topp = sektion.getBoundingClientRect().top + window.scrollY;
          try { window.scrollTo({ top: topp, behavior: 'instant' }); }
          catch (e) { window.scrollTo(0, topp); }
        }
        var rubrik = rot.querySelector('section[data-sek="' + vald + '"] h2, section[data-sek="' + vald + '"] h5');
        if (rubrik) {
          rubrik.setAttribute('tabindex', '-1');
          rubrik.focus({ preventScroll: true });
        }
      }
      första = false;

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
     LÄXFILTRET

     Läxlistan var allt eleven någonsin fått, med de klara kvar i
     ordningen. Efter en termin låg veckans läxa mellan tjugo
     avklarade, och den enda vägen till "vad ska jag göra nu" var
     att läsa varje rad.

     Tre lägen, med antalet i knappen så att man ser vad man får
     innan man klickar. Klart ligger kvar och går att gå tillbaka
     till — det är bevis på vad som gjorts.
     ============================================================ */
  var LÄX_LÄGEN = [
    ['attgora', 'Att göra'],
    ['klart', 'Klart'],
    ['alla', 'Alla']
  ];

  function läxUrval(laxor, valt) {
    var lista = laxor || [];
    if (valt === 'attgora') return lista.filter(function (h) { return h.status !== 'klar'; });
    if (valt === 'klart') return lista.filter(function (h) { return h.status === 'klar'; });
    return lista;
  }

  function läxFilter(o) {
    var host = o.host;
    if (!host) return;
    var laxor = o.laxor || [];
    var valt = o.valt || 'attgora';

    /* Med tre läxor totalt är ett filter tre knappar som gör
       ingenting. Det ritas när det finns något att sålla i. */
    if (laxor.length < 4) { host.innerHTML = ''; host.hidden = true; return; }
    host.hidden = false;

    host.innerHTML = LÄX_LÄGEN.map(function (l) {
      var n = läxUrval(laxor, l[0]).length;
      return '<button type="button" class="chip" data-laxfilter="' + l[0] + '"'
        + ' aria-pressed="' + (l[0] === valt ? 'true' : 'false') + '">'
        + esc(l[1]) + ' <span>' + n + '</span></button>';
    }).join('');
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

    host.innerHTML = ut;

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
      + (S.profil && S.profil.is_admin
        ? '<a class="btn btn-ghost btn-sm" href="/admin">Admin</a>' : '')
      + '<button class="btn btn-ghost btn-sm" data-logout>Logga ut</button>';
    if (efter) efter();
    ma.innerHTML = '<button class="btn btn-ghost btn-block" data-logout>Logga ut</button>';
  }

  /* Inloggningsrutan i läge 'in' eller 'up'. t har titel, titelUpp,
     under och underUpp. */
  function inloggningsruta(läge, t) {
    var upp = läge === 'up';
    NX.$$('[data-auth]').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.dataset.auth === läge));
    });
    NX.$('#namn-grupp').hidden = !upp;
    NX.$('#a-name').required = upp;
    NX.$('#a-pass').autocomplete = upp ? 'new-password' : 'current-password';
    NX.$('#auth-title').textContent = upp ? t.titelUpp : t.titel;
    NX.$('#auth-sub').textContent = upp ? t.underUpp : t.under;
    NX.$('#auth-submit').textContent = upp ? 'Skapa konto' : 'Logga in';
    NX.rensa(NX.$('#auth-msg'));
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
    { typ: 'paminnelse',     namn: 'Påminnelse före pass', om: 'Innan ett bokat pass.' }
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

    function rita() {
      host.innerHTML = NOTISVAL.map(function (rad) {
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

  return {
    notisval: notisval,
    visaVy: visaVy, felvy: felvy, kortTid: kortTid, vyHuvud: vyHuvud,
    inloggningsruta: inloggningsruta, schemaI: schemaI,
    flyttaRuta: flyttaRuta, notiser: notiser, sidomeny: sidomeny, schema: schema, passRuta: passRuta,
    passLista: passLista, läxFilter: läxFilter, läxUrval: läxUrval,
    fordelning: fordelning,
    LAGE: LAGE, STEG: STEG, stegFör: stegFör, stegText: stegText, målFör: målFör,
    läxläge: läxläge, deadlineText: deadlineText,
    läxRad: läxRad, nivåMätare: nivåMätare, historikRad: historikRad, ämnesSammanfattning: ämnesSammanfattning,
    progressRad: progressRad, progressPerÄmne: progressPerÄmne,
    tomt: tomt, laddar: laddar, laddarFörsta: laddarFörsta, håll: håll, scrollaTill: scrollaTill, visaÖverst: visaÖverst,
    passSida: passSida, relativDag: relativDag, tidsspann: tidsspann, skälText: skälText,
    dagMedVeckodag: dagMedVeckodag, GICK: GICK,
    bekräfta: bekräfta, avbokaRuta: avbokaRuta, medan: medan, kolla: kolla
  };
})();
