/* ============================================================
   NEXTRUM — notiscentralen och notisvalen (program 2, Fas 2)

   Delas av foralder.html och larare.html. Laddas efter
   nextrum-studie.js och före vyns egen fil.

   KLOCKAN har två delar:
     · Att göra: det vyn räknar fram ur det den redan hämtat
       (förslag att svara på, läxor idag, nytt material, pass utan
       rapport). Vyn skickar dem med attGöra(poster), som förut.
     · Notiser: raderna i tabellen notiser, som databasens triggrar
       skriver vid pass, meddelanden, rapporter och påminnelser. De
       minns om de är lästa, i databasen och inte i webbläsaren, så
       telefonen och datorn säger samma sak.

   Förut räknades allt i webbläsaren ur det som råkade vara hämtat,
   och ingenting mindes vad som var läst. En avbokning eller en flytt
   syntes inte alls, och knappen fanns inte på mobilen: den låg i
   #nav-actions, som döljs under 1040 px. Klockan ligger nu i
   sidhuvudet bredvid menyknappen och syns i alla bredder.

   Till skillnad från NXStudie har den här modulen en egen
   databaskoppling. Notiserna hör inte till en vy, och båda vyerna
   ska läsa, markera och prenumerera på exakt samma sätt.

   INGEN BRÖDTEXT. En notis bär typ, datum, tid, ämne och förnamn i
   data. Meningarna byggs här ur de fälten och ur ingenting annat:
   aldrig meddelandets text, rapportens anteckningar, en plats eller
   ett efternamn. Det som inte står i data kan inte läcka härifrån.

   ANTALET I FLIKENS TITEL ägs av den här modulen och ingen annan.
   Förut satte NXStudie.notiser titeln, och det hade blivit två
   räknare som skrev över varandra så fort notiserna kom till.
   ============================================================ */
window.NXNotiser = (function () {
  'use strict';

  var esc = NX.esc, datumText = NX.datumText, isoFor = NX.isoFor;

  /* Typerna i den ordning valen visas. Samma namn som notis_typer()
     i databasen; en typ som inte står här ritas som "Ny notis" hellre
     än inte alls. */
  var TYPER = [
    ['pass_nytt', 'Nya pass'],
    ['pass_bekraftat', 'Bekräftade pass'],
    ['pass_flyttat', 'Flyttade pass'],
    ['pass_avbokat', 'Avbokade pass'],
    ['pass_avbojt', 'Avböjda förslag'],
    ['meddelande', 'Meddelanden'],
    ['paminnelse', 'Påminnelser'],
    ['rapport', 'Rapporter']
  ];
  /* notis_mejlbara(): allt utom rapport. En ny rapport syns bara i
     appen, det bestämde Leo. SMS finns bara för påminnelser. */
  var MEJLBARA = ['pass_nytt', 'pass_bekraftat', 'pass_flyttat', 'pass_avbokat', 'pass_avbojt',
    'meddelande', 'paminnelse'];
  var SMSBARA = ['paminnelse'];

  /* Samma gräns som kontraktet: de 50 senaste. Äldre notiser gallras
     i databasen efter 180 dagar, och en lista längre än så läser
     ingen. */
  var MAX = 50;

  /* Realtid är vägen, det här är reserven. En websocket dör när
     telefonen låser sig och när nätet byts, och det finns inget löfte
     om att ingen ändring hann passera under tiden. Tre minuter är
     väl under de tio minuter ett chattmejl väntar, så en läst chatt
     hinner märkas som läst innan mejlet skulle ha gått. */
  var RESERV_MS = 180000;

  /* ---------- ikonerna ----------
     Samma ritstil som NXStudie.ikon: 16px ruta, linje 1,6, färgen
     ärvs från texten. aria-hidden, för ordet står alltid bredvid. */
  var IKONER = {
    pass_nytt: '<rect x="2.5" y="3.5" width="11" height="10" rx="1.6"/><path d="M2.5 6.5h11M5.5 2v2.5M10.5 2v2.5M8 8.4v3.2M6.4 10h3.2"/>',
    pass_bekraftat: '<path d="M3.5 8.5l3 3 6-7"/>',
    pass_flyttat: '<path d="M2.5 5.5h9M9.3 3.3l2.2 2.2-2.2 2.2M13.5 10.5h-9M6.7 8.3l-2.2 2.2 2.2 2.2"/>',
    pass_avbokat: '<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>',
    pass_avbojt: '<circle cx="8" cy="8" r="6"/><path d="M3.8 12.2l8.4-8.4"/>',
    meddelande: '<path d="M13.5 7.6c0 2.6-2.5 4.6-5.5 4.6-.6 0-1.2-.1-1.7-.2L3 13.2l.8-2.4a4.3 4.3 0 0 1-1.3-3.2C2.5 5 5 3 8 3s5.5 2 5.5 4.6z"/>',
    rapport: '<path d="M4 2.5h5.5l3 3v8H4z"/><path d="M9.5 2.5v3h3M6 8.5h4.5M6 11h3"/>',
    paminnelse: '<circle cx="8" cy="8" r="6"/><path d="M8 4.8V8l2.2 1.5"/>',
    notis: '<circle cx="8" cy="8" r="5.5"/>',
    attgora: '<path d="M3 8h9.5M9 4.5 12.5 8 9 11.5"/>',
    stang: '<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>'
  };

  function ikon(namn) {
    var p = IKONER[namn] || IKONER.notis;
    return '<svg class="nx-ikon" viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none"'
      + ' stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  }

  var KLOCKA = '<svg class="nx-klocka-ikon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none"'
    + ' stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M12 3.5a5.6 5.6 0 0 0-5.6 5.6v3.4c0 1-.4 2-1.1 2.8l-.8 1h15l-.8-1a4.3 4.3 0 0 1-1.1-2.8V9.1A5.6 5.6 0 0 0 12 3.5z"/>'
    + '<path d="M9.8 19.6a2.3 2.3 0 0 0 4.4 0"/></svg>';

  /* ---------- tillståndet ---------- */
  var S = {
    uid: null,
    opts: {},
    attGöra: [],
    synligaPoster: [],
    notiser: [],
    live: false,          // tabellen gick att läsa
    saknas: false,        // tabellen finns inte (migrationen är inte körd)
    fel: null,
    hämtar: false, igen: false,
    lokaltLäst: {},       // id → last_at medan markeringen är på väg
    trådPågår: {},
    kanal: null, reserv: null, auth: null,
    hus: null, knapp: null, panel: null, kropp: null, status: null, alla: null,
    öppen: false,
    trådvisare: null
  };

  /* ============================================================
     MENINGARNA
     En mening per typ, skriven ur data. Vem som gjorde ändringen står
     inte i data (det kan vara motparten, men också admin), så
     meningen säger vad som hände med passet och inte vem som gjorde
     det. "Tove har bekräftat" hade varit fel den dag admin bekräftar.
     ============================================================ */
  function tid5(t) { return String(t || '').slice(0, 5); }

  function närText(datum, tid) {
    var s = datum ? datumText(String(datum).slice(0, 10)) : '';
    if (tid) s += (s ? ' ' : '') + 'kl. ' + tid5(tid);
    return s;
  }

  /* Påminnelsen säger "i morgon" och "idag", räknat när man läser.
     En påminnelse som skrevs i går om ett pass i dag ska inte stå
     kvar och säga "i morgon". */
  function dagOrd(iso) {
    if (!iso) return '';
    var nu = new Date();
    var imorgon = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() + 1);
    var dag = String(iso).slice(0, 10);
    if (dag === isoFor(nu)) return 'idag';
    if (dag === isoFor(imorgon)) return 'i morgon';
    return datumText(dag);
  }

  /* Mottagaren är studiehjälparen i passet eller tråden. Läses ur
     raden och inte ur vyn: Leo är både admin och förälder. */
  function ärHjälpare(n) {
    return !!(n && n.trad_tutor && n.mottagare === n.trad_tutor);
  }

  function mening(n) {
    var d = (n && n.data) || {};
    var när = närText(d.datum, d.tid);
    var mellan = när ? ' ' + när : '';
    switch (n && n.typ) {
      case 'pass_nytt':
        if (d.status === 'requested') return (ärHjälpare(n) ? 'Ny önskad tid' : 'Ny föreslagen tid') + mellan;
        if (d.status === 'confirmed') return 'Nytt pass bokat' + mellan;
        return 'Nytt pass' + mellan;
      case 'pass_bekraftat':
        return 'Passet' + mellan + ' är bekräftat';
      case 'pass_flyttat':
        if (d.fran_datum && String(d.fran_datum) === String(d.datum) && d.fran_tid && d.tid
            && tid5(d.fran_tid) !== tid5(d.tid)) {
          return 'Passet ' + datumText(String(d.datum).slice(0, 10)) + ' flyttades från '
            + tid5(d.fran_tid) + ' till ' + tid5(d.tid);
        }
        if (d.fran_datum) return 'Passet ' + närText(d.fran_datum, d.fran_tid) + ' flyttades' + (när ? ' till ' + när : '');
        return 'Passet flyttades' + (när ? ' till ' + när : '');
      case 'pass_avbokat':
        return 'Passet' + mellan + ' är avbokat';
      case 'pass_avbojt':
        return 'Tiden' + mellan + ' avböjdes';
      case 'meddelande':
        var antal = Number(n.antal) || 1;
        return (antal > 1 ? antal + ' nya meddelanden' : 'Nytt meddelande') + (d.fran ? ' från ' + d.fran : '');
      case 'rapport':
        return d.elev ? 'Ny rapport om ' + d.elev : 'Ny rapport';
      case 'paminnelse':
        var dag = dagOrd(d.datum);
        if (!dag && !d.tid) return 'Påminnelse om ett pass';
        return 'Påminnelse: pass' + (dag ? ' ' + dag : '') + (d.tid ? ' kl. ' + tid5(d.tid) : '');
      default:
        return 'Ny notis';
    }
  }

  /* Raden under meningen. Studiehjälparens namn står bara hos
     familjen: hos studiehjälparen själv är det ens eget namn. */
  function detalj(n) {
    var d = (n && n.data) || {};
    var hj = ärHjälpare(n);
    if (n.typ === 'meddelande') return '';
    if (n.typ === 'rapport') {
      return [d.datum ? 'Från passet ' + datumText(String(d.datum).slice(0, 10)) : null,
        !hj && d.studiehjalpare ? 'med ' + d.studiehjalpare : null].filter(Boolean).join(' ');
    }
    return [d.amne, d.elev, !hj && d.studiehjalpare ? 'med ' + d.studiehjalpare : null]
      .filter(Boolean).join(' · ');
  }

  /* ============================================================
     DATAN
     ============================================================ */
  function tabellenSaknas(fel) {
    var kod = String((fel && fel.code) || ''), text = String((fel && fel.message) || '');
    return kod === 'PGRST205' || kod === '42P01' || /does not exist|schema cache/i.test(text);
  }

  function sortera() {
    S.notiser.sort(function (a, b) { return String(b.uppdaterad || '').localeCompare(String(a.uppdaterad || '')); });
    if (S.notiser.length > MAX) S.notiser.length = MAX;
  }

  /* En markering som är på väg ska inte ångras av en hämtning som
     startade innan den gått fram. */
  function medLokalt(rad) {
    if (rad && !rad.last_at && S.lokaltLäst[rad.id]) rad.last_at = S.lokaltLäst[rad.id];
    return rad;
  }

  async function hämta() {
    if (!supa || !S.uid) return;
    if (S.hämtar) { S.igen = true; return; }
    S.hämtar = true;
    var uid = S.uid;
    try {
      var res = await supa.from('notiser').select('*')
        .eq('mottagare', uid)
        .order('uppdaterad', { ascending: false })
        .limit(MAX);
      if (uid !== S.uid) return;
      if (res.error) {
        S.saknas = tabellenSaknas(res.error);
        S.fel = S.saknas ? null : res.error;
        if (!S.saknas) console.warn('notiser:', res.error.message);
      } else {
        S.live = true;
        S.saknas = false;
        S.fel = null;
        S.notiser = (res.data || []).map(medLokalt);
        sortera();
      }
    } catch (fel) {
      S.fel = fel;
      console.warn('notiser:', fel);
    } finally {
      S.hämtar = false;
    }
    rendera();
    läsTrådOmSynlig();
    if (S.igen) { S.igen = false; hämta(); }
  }

  /* En rad från realtid. Filtret på mottagare är inte skyddet (RLS
     är det), men en rad som ändå inte är ens egen ritas inte. */
  function taEmot(rad, händelse) {
    if (!rad || !rad.id || rad.mottagare !== S.uid) return;
    S.live = true;
    S.saknas = false;
    medLokalt(rad);
    var i = S.notiser.findIndex(function (n) { return n.id === rad.id; });
    if (i === -1) S.notiser.push(rad); else S.notiser[i] = rad;
    sortera();
    rendera();
    /* Vyn får veta när något nytt hänt, till exempel för att hämta
       passen igen så att ett klick på notisen hittar passet. En
       markering som läst är inget nytt. */
    if ((händelse === 'INSERT' || !rad.last_at) && typeof S.opts.onNy === 'function') {
      try { S.opts.onNy(rad, händelse); } catch (fel) { console.warn('onNy:', fel); }
    }
    läsTrådOmSynlig();
  }

  /* ============================================================
     PRENUMERATIONEN
     INSERT och UPDATE, aldrig DELETE: en DELETE-händelse filtreras
     inte av RLS och bär primärnyckeln, och gallringen ska inte sändas
     ut till någon. Filtret på mottagaren sparar arbete; RLS bevakar.
     ============================================================ */
  function lyssna() {
    slutaLyssna();
    if (!supa || !supa.channel || !S.uid) return;
    var filter = 'mottagare=eq.' + S.uid;
    S.kanal = supa.channel('notiser-' + S.uid)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notiser', filter: filter },
        function (p) { taEmot(p && p.new, 'INSERT'); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notiser', filter: filter },
        function (p) { taEmot(p && p.new, 'UPDATE'); })
      .subscribe(function (status) {
        /* Vid varje lyckad anslutning hämtas listan om. Det täcker det
           som hann hända medan socketen låg nere, och det som hann
           hända mellan första hämtningen och att kanalen öppnades.
           Pågår en hämtning görs en till efteråt (S.igen). */
        if (status === 'SUBSCRIBED') hämta();
      });
  }

  function slutaLyssna() {
    if (!S.kanal) return;
    try { supa.removeChannel(S.kanal); } catch (e) { /* redan stängd */ }
    S.kanal = null;
  }

  function närFlikenSyns() {
    if (document.visibilityState === 'visible' && S.uid) hämta();
  }

  /* Sidbyte: kanalen stängs. Kommer sidan tillbaka ur webbläsarens
     cache (bakåtknappen) öppnas den igen. */
  function vidPagehide() { slutaLyssna(); stoppaReserv(); }
  function vidPageshow(e) {
    if (e && e.persisted && S.uid) { lyssna(); startaReserv(); hämta(); }
  }

  function startaReserv() {
    stoppaReserv();
    S.reserv = setInterval(function () { if (document.visibilityState === 'visible') hämta(); }, RESERV_MS);
  }
  function stoppaReserv() {
    if (S.reserv) { clearInterval(S.reserv); S.reserv = null; }
  }

  /* ============================================================
     LÄST
     ============================================================ */
  function sättLokalt(ids, värde) {
    S.notiser.forEach(function (n) { if (ids.indexOf(n.id) !== -1) n.last_at = värde; });
  }

  async function markeraLäst(ids) {
    ids = (ids || []).filter(function (id) {
      return S.notiser.some(function (n) { return n.id === id && !n.last_at; });
    });
    if (!ids.length || !supa) return true;
    var nu = new Date().toISOString();
    ids.forEach(function (id) { S.lokaltLäst[id] = nu; });
    sättLokalt(ids, nu);
    rendera();
    var fråga = supa.from('notiser').update({ last_at: nu });
    var res = await (ids.length === 1 ? fråga.eq('id', ids[0]) : fråga.in('id', ids));
    ids.forEach(function (id) { delete S.lokaltLäst[id]; });
    if (res.error) {
      sättLokalt(ids, null);
      rendera();
      säg('Kunde inte markera som läst: ' + NX.felText(res.error));
      return false;
    }
    return true;
  }

  async function markeraAlla() {
    if (!supa || !S.uid) return;
    var ids = S.notiser.filter(function (n) { return !n.last_at; }).map(function (n) { return n.id; });
    if (!ids.length) return;
    var nu = new Date().toISOString();
    ids.forEach(function (id) { S.lokaltLäst[id] = nu; });
    sättLokalt(ids, nu);
    rendera();
    var res = await supa.from('notiser').update({ last_at: nu }).eq('mottagare', S.uid).is('last_at', null);
    ids.forEach(function (id) { delete S.lokaltLäst[id]; });
    if (res.error) {
      sättLokalt(ids, null);
      rendera();
      säg('Kunde inte markera notiserna som lästa: ' + NX.felText(res.error));
      return;
    }
    säg('Alla notiser är markerade som lästa.');
  }

  /* ============================================================
     CHATTEN: LÄST FÖRST NÄR TRÅDEN SYNS

     Kön hoppar över ett chattmejl om notisen redan är läst, så att
     den som läser i appen inte också får ett mejl. Att markera vid
     sidladdning hade tystat alla chattmejl för alla som har vyn öppen
     någonstans. Därför markeras chattens notis först när tråden
     faktiskt syns: NXKontakt säger när (trådSedd), och talar om vilken
     tråd som syns just nu (trådvisare), så att en notis som kommer
     medan man läser markeras direkt.

     tvinga: markera i databasen även när listan här inte vet om
     någon oläst notis. Används när nya meddelanden just lästs;
     notisen skrivs i samma transaktion som meddelandet, men kan
     komma hit en stund efter meddelandet.
     ============================================================ */
  async function trådSedd(parentId, tutorId, tvinga) {
    if (!supa || !S.uid || !parentId || !tutorId || S.saknas) return;
    var nyckel = parentId + '|' + tutorId;
    var lokala = S.notiser.filter(function (n) {
      return n.typ === 'meddelande' && !n.last_at && n.trad_parent === parentId && n.trad_tutor === tutorId;
    }).map(function (n) { return n.id; });
    if (!lokala.length && !tvinga) return;
    if (S.trådPågår[nyckel]) return;
    S.trådPågår[nyckel] = true;
    var nu = new Date().toISOString();
    lokala.forEach(function (id) { S.lokaltLäst[id] = nu; });
    sättLokalt(lokala, nu);
    if (lokala.length) rendera();
    try {
      var res = await supa.from('notiser').update({ last_at: nu })
        .eq('mottagare', S.uid).eq('typ', 'meddelande')
        .eq('trad_parent', parentId).eq('trad_tutor', tutorId)
        .is('last_at', null);
      if (res.error) {
        if (tabellenSaknas(res.error)) S.saknas = true;
        else console.warn('notiser, chatten som läst:', res.error.message);
        sättLokalt(lokala, null);
        if (lokala.length) rendera();
      }
    } finally {
      lokala.forEach(function (id) { delete S.lokaltLäst[id]; });
      delete S.trådPågår[nyckel];
    }
  }

  function läsTrådOmSynlig() {
    if (typeof S.trådvisare !== 'function') return;
    var trådar = {};
    S.notiser.forEach(function (n) {
      if (n.typ === 'meddelande' && !n.last_at && n.trad_parent && n.trad_tutor) {
        trådar[n.trad_parent + '|' + n.trad_tutor] = [n.trad_parent, n.trad_tutor];
      }
    });
    Object.keys(trådar).forEach(function (k) {
      var t = trådar[k];
      var syns = false;
      try { syns = !!S.trådvisare(t[0], t[1]); } catch (e) { syns = false; }
      if (syns) trådSedd(t[0], t[1], false);
    });
  }

  function trådvisare(fn) { S.trådvisare = typeof fn === 'function' ? fn : null; }

  /* ============================================================
     KLOCKAN OCH RUTAN

     En knapp och en ruta som byggs en gång. Förut ritades knappen om
     vid varje anrop, och varje gång fick document två nya lyssnare
     som aldrig togs bort. Nu finns lyssnarna på document bara medan
     rutan är öppen.

     Rutan är en icke-modal dialog: fokus flyttas in när den öppnas,
     Escape och stängknappen lämnar tillbaka det till klockan, och
     Tab ut ur rutan stänger den.
     ============================================================ */
  function byggKlockan() {
    if (S.hus && document.body.contains(S.hus)) return;
    var nav = document.querySelector('#hdr .nav');
    if (!nav) return;

    var hus = document.createElement('div');
    hus.className = 'nx-klocka-hus';
    hus.innerHTML =
      '<button type="button" class="nx-klocka" id="nx-klocka" aria-expanded="false"'
      + ' aria-controls="nx-notispanel" aria-haspopup="dialog">'
      + KLOCKA
      + '<span class="nx-klocka-antal" aria-hidden="true" hidden></span>'
      + '<span class="nx-dold" id="nx-klocka-text">Notiser</span>'
      + '</button>'
      + '<div class="nx-notispanel" id="nx-notispanel" role="dialog" aria-labelledby="nx-notispanel-rubrik"'
      + ' tabindex="-1" hidden>'
      + '<div class="nx-notispanel-topp">'
      + '<h2 id="nx-notispanel-rubrik">Notiser</h2>'
      + '<button type="button" class="nx-notispanel-alla" data-alla hidden>Markera alla som lästa</button>'
      + '<button type="button" class="nx-notispanel-stang" data-stang aria-label="Stäng notiserna">'
      + ikon('stang') + '</button>'
      + '</div>'
      + '<p class="nx-notispanel-status" role="status" aria-live="polite"></p>'
      + '<div class="nx-notispanel-kropp"></div>'
      + '</div>';

    /* Före kontomenyn: i full bredd står klockan där den alltid stått,
       och på mobilen, där kontomenyn är dold, hamnar den bredvid
       menyknappen. */
    var före = nav.querySelector('#nav-actions') || nav.querySelector('#burger');
    if (före) nav.insertBefore(hus, före); else nav.appendChild(hus);

    S.hus = hus;
    S.knapp = hus.querySelector('.nx-klocka');
    S.panel = hus.querySelector('.nx-notispanel');
    S.kropp = hus.querySelector('.nx-notispanel-kropp');
    S.status = hus.querySelector('.nx-notispanel-status');
    S.alla = hus.querySelector('[data-alla]');

    S.knapp.addEventListener('click', function (e) {
      e.stopPropagation();
      if (S.öppen) stäng(true); else öppna();
    });
    S.panel.addEventListener('click', panelKlick);
    hus.addEventListener('focusout', function (e) {
      if (S.öppen && e.relatedTarget && !hus.contains(e.relatedTarget)) stäng(false);
    });
  }

  function klickUtanför(e) {
    if (S.öppen && S.hus && !S.hus.contains(e.target)) stäng(false);
  }
  function tangent(e) {
    if (e.key === 'Escape' && S.öppen) { e.preventDefault(); stäng(true); }
  }

  /* På smal skärm ligger rutan över hela bredden, strax under
     sidhuvudet. Sidhuvudets höjd ändras när man scrollar, så den
     mäts när rutan öppnas. */
  function placera() {
    if (!S.panel) return;
    var smal = window.matchMedia && window.matchMedia('(max-width: 1040px)').matches;
    var hdr = document.getElementById('hdr');
    if (smal && hdr) {
      S.panel.style.setProperty('--nx-panel-topp', Math.round(hdr.getBoundingClientRect().bottom + 8) + 'px');
    } else {
      S.panel.style.removeProperty('--nx-panel-topp');
    }
  }

  function öppna() {
    if (!S.panel) return;
    S.öppen = true;
    placera();
    S.status.textContent = '';
    S.panel.hidden = false;
    S.knapp.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', klickUtanför);
    document.addEventListener('keydown', tangent);
    window.addEventListener('resize', placera);
    S.panel.focus({ preventScroll: true });
  }

  function stäng(tillbaka) {
    if (!S.öppen) return;
    S.öppen = false;
    S.panel.hidden = true;
    S.knapp.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', klickUtanför);
    document.removeEventListener('keydown', tangent);
    window.removeEventListener('resize', placera);
    if (tillbaka && S.knapp) S.knapp.focus();
  }

  function säg(text) {
    if (S.status) S.status.textContent = text || '';
  }

  /* Vilka poster i Att göra som ska synas. Vyns post om olästa
     meddelanden säger samma sak som chattens notis; finns en oläst
     notis för varje tråd posten gäller står den bara där, en gång. */
  function synligaAttGöra() {
    return S.attGöra.filter(function (p) {
      if (!p || !p.trådar || !p.trådar.length || !S.live) return true;
      return !p.trådar.every(function (k) {
        return S.notiser.some(function (n) {
          return n.typ === 'meddelande' && !n.last_at && (n.trad_parent + '|' + n.trad_tutor) === k;
        });
      });
    });
  }

  function räkna() {
    var poster = synligaAttGöra();
    var olästa = S.notiser.filter(function (n) { return !n.last_at; }).length;
    return { poster: poster, olästa: olästa, antal: poster.length + olästa };
  }

  function sättTitel(n) {
    var ren = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = n ? '(' + n + ') ' + ren : ren;
  }

  function radAttGöra(p, i) {
    return '<li><button type="button" class="nx-notisrad" data-attgora="' + i + '">'
      + '<span class="nx-notisrad-ikon">' + ikon('attgora') + '</span>'
      + '<span class="nx-notisrad-text"><b>' + esc(p.rubrik || '') + '</b>'
      + (p.text ? '<span>' + esc(p.text) + '</span>' : '') + '</span>'
      + '</button></li>';
  }

  function radNotis(n) {
    var oläst = !n.last_at;
    var d = detalj(n);
    return '<li><button type="button" class="nx-notisrad' + (oläst ? ' ar-olast' : '') + '" data-notis="' + esc(n.id) + '">'
      + '<span class="nx-notisrad-ikon">' + ikon(n.typ) + '</span>'
      + '<span class="nx-notisrad-text"><b>' + esc(mening(n)) + '</b>'
      + (d ? '<span>' + esc(d) + '</span>' : '') + '</span>'
      + '<span class="nx-notisrad-sida">'
      + (oläst ? '<span class="nx-olast"><span class="nx-olast-prick" aria-hidden="true"></span>Oläst</span>' : '')
      + (n.uppdaterad ? '<time datetime="' + esc(n.uppdaterad) + '">' + esc(NXStudie.kortTid(n.uppdaterad)) + '</time>' : '')
      + '</span></button></li>';
  }

  function rendera() {
    var r = räkna();
    sättTitel(r.antal);
    if (!S.hus) return;

    /* Knappen: siffran syns, orden läses. */
    var siffra = S.knapp.querySelector('.nx-klocka-antal');
    siffra.hidden = !r.antal;
    siffra.textContent = r.antal > 99 ? '99+' : String(r.antal);
    var delar = [];
    if (r.olästa) delar.push(r.olästa + (r.olästa > 1 ? ' olästa' : ' oläst'));
    if (r.poster.length) delar.push(r.poster.length + ' att göra');
    S.knapp.querySelector('#nx-klocka-text').textContent =
      'Notiser' + (delar.length ? ': ' + delar.join(', ') : ', inget nytt');
    S.knapp.classList.toggle('ar-ny', r.antal > 0);
    /* "Markera alla" försvinner när inget är oläst. Hade den fokus
       går fokus till rutan, inte till sidans början. */
    var allaHadeFokus = document.activeElement === S.alla;
    S.alla.hidden = !r.olästa;
    if (allaHadeFokus && S.alla.hidden && S.öppen) S.panel.focus({ preventScroll: true });

    /* Behåll fokus på samma rad när listan ritas om medan den är
       öppen. innerHTML hade annars kastat det till sidans början. */
    var aktiv = document.activeElement, nyckel = null;
    if (aktiv && S.kropp.contains(aktiv)) {
      nyckel = aktiv.dataset.notis ? '[data-notis="' + aktiv.dataset.notis + '"]'
        : aktiv.dataset.attgora ? '[data-attgora="' + aktiv.dataset.attgora + '"]' : null;
    }

    S.synligaPoster = r.poster;
    var html = '';
    if (r.poster.length) {
      html += '<section class="nx-notisdel" aria-labelledby="nx-attgora-rubrik">'
        + '<h3 id="nx-attgora-rubrik">Att göra</h3>'
        + '<ul class="nx-notislista">' + r.poster.map(radAttGöra).join('') + '</ul></section>';
    }
    /* Före migrationen finns tabellen inte. Då är klockan det den var
       förut, Att göra och inget annat, utan ett felmeddelande som
       ingen familj kan göra något åt. */
    if (!S.saknas) {
      html += '<section class="nx-notisdel" aria-labelledby="nx-notislogg-rubrik">'
        + '<h3 id="nx-notislogg-rubrik">Notiser</h3>';
      if (S.fel && !S.live) {
        html += '<p class="nx-notis-tom">Kunde inte hämta notiserna. ' + esc(NX.felText(S.fel)) + '</p>';
      } else if (!S.live) {
        html += '<p class="nx-notis-tom">Hämtar…</p>';
      } else if (!S.notiser.length) {
        html += '<p class="nx-notis-tom">Inga notiser än.</p>';
      } else {
        html += '<ul class="nx-notislista">' + S.notiser.map(radNotis).join('') + '</ul>';
      }
      html += '</section>';
    } else if (!r.poster.length) {
      html = '<p class="nx-notis-tom">Inget som väntar på dig just nu.</p>';
    }
    S.kropp.innerHTML = html;

    if (nyckel) {
      var igen = S.kropp.querySelector(nyckel);
      if (igen) igen.focus({ preventScroll: true });
      else if (S.öppen) S.panel.focus({ preventScroll: true });
    }
  }

  /* ============================================================
     KLICK I RUTAN
     ============================================================ */
  function panelKlick(e) {
    if (e.target.closest('[data-stang]')) { stäng(true); return; }
    if (e.target.closest('[data-alla]')) { markeraAlla(); return; }
    var a = e.target.closest('[data-attgora]');
    if (a) {
      var post = S.synligaPoster[Number(a.dataset.attgora)];
      stäng(false);
      if (post) gåTillMål(post.mål);
      return;
    }
    var rad = e.target.closest('[data-notis]');
    if (rad) öppnaNotis(rad.dataset.notis);
  }

  /* Samma adress igen ger ingen hashchange, och då hade inget hänt
     alls. Sidomenyn och flikarna lyssnar på händelsen, så den skickas
     för hand. */
  function gåTill(adress) {
    if (location.hash === adress) {
      var h;
      try { h = new HashChangeEvent('hashchange'); } catch (e) { h = new Event('hashchange'); }
      window.dispatchEvent(h);
    } else {
      location.hash = adress;
    }
  }

  /* Att göra pekar på ett element, som förut. Målet kan ligga i en
     sektion eller flik som inte är framme: byt dit först, annars
     scrollar vi till något som är hidden och ingenting händer. */
  function gåTillMål(mål) {
    if (!mål) return;
    var el = null;
    try { el = document.querySelector(mål); } catch (e) { el = null; }
    if (!el) return;
    var sek = el.closest('section[data-sek]');
    if (sek && sek.hidden) location.hash = '#' + sek.dataset.sek;
    if (window.NXArbete) NXArbete.visaFör(el);
    requestAnimationFrame(function () {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      /* Fokus följer med, annars står tangentbordet kvar i
         sidhuvudet medan ögat är nere i sidan. */
      if (!el.matches('a[href], button, input, select, textarea, [tabindex]')) el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
      el.classList.add('nx-blink');
      setTimeout(function () { el.classList.remove('nx-blink'); }, 1600);
    });
  }

  /* Ett klick markerar notisen som läst och går dit den handlar om.
     Vyn vet hur ett pass öppnas och vilken tråd som är vilken; utan
     svar från vyn blir det sektionens adress. */
  function öppnaNotis(id) {
    var n = S.notiser.find(function (x) { return String(x.id) === String(id); });
    if (!n) return;
    if (!n.last_at) markeraLäst([n.id]);
    var o = S.opts;
    var svar;
    try {
      if (n.typ === 'meddelande') {
        stäng(false);
        svar = typeof o.öppnaTråd === 'function' ? o.öppnaTråd(n.trad_parent, n.trad_tutor, n) : false;
        if (svar === false || svar == null) gåTill('#meddelanden');
        return;
      }
      if (n.typ === 'rapport') {
        stäng(false);
        svar = typeof o.öppnaRapport === 'function' ? o.öppnaRapport(n) : false;
        if (svar === false || svar == null) gåTill('#lektioner/rapporter');
        return;
      }
      /* Pass och påminnelser: passets detaljer om passet går att
         öppna. Fokus tillbaka till klockan först, så att passrutan
         lämnar det där när den stängs. */
      stäng(true);
      if (n.pass_id && typeof o.öppnaPass === 'function' && o.öppnaPass(n.pass_id, n) === true) return;
      gåTill('#lektioner/pass');
    } catch (fel) {
      console.warn('notisen kunde inte öppnas:', fel);
    }
  }

  /* ============================================================
     START OCH STOPP
     opts: { uid, öppnaPass(id) → true om passet öppnades,
             öppnaTråd(parentId, tutorId), öppnaRapport(notis),
             onNy(notis, händelse) }
     ============================================================ */
  function start(opts) {
    var o = opts || {};
    if (!supa || !o.uid) return;
    if (S.uid === o.uid) { S.opts = o; rendera(); return; }
    stoppa();
    S.uid = o.uid;
    S.opts = o;
    byggKlockan();
    rendera();
    hämta();
    lyssna();
    startaReserv();
    document.addEventListener('visibilitychange', närFlikenSyns);
    window.addEventListener('pagehide', vidPagehide);
    window.addEventListener('pageshow', vidPageshow);
    if (supa.auth && supa.auth.onAuthStateChange) {
      try {
        var r = supa.auth.onAuthStateChange(function (händelse) { if (händelse === 'SIGNED_OUT') stoppa(); });
        S.auth = r && r.data && r.data.subscription;
      } catch (e) { S.auth = null; }
    }
  }

  /* Utloggning. Kanalen och reserven stängs, och ingenting från
     kontot ligger kvar i minnet. */
  function stoppa() {
    stäng(false);
    slutaLyssna();
    stoppaReserv();
    document.removeEventListener('visibilitychange', närFlikenSyns);
    window.removeEventListener('pagehide', vidPagehide);
    window.removeEventListener('pageshow', vidPageshow);
    if (S.auth && S.auth.unsubscribe) { try { S.auth.unsubscribe(); } catch (e) { /* redan av */ } }
    S.auth = null;
    S.uid = null;
    S.notiser = [];
    S.attGöra = [];
    S.live = false;
    S.fel = null;
    S.lokaltLäst = {};
    if (S.hus) { S.hus.remove(); S.hus = null; }
    sättTitel(0);
  }

  function attGöra(poster) {
    S.attGöra = (poster || []).filter(Boolean);
    rendera();
  }

  /* ============================================================
     NOTISVALEN (Profil › Notiser)

     En tabell: typerna nedåt, mejl och SMS bortåt. Saknas en rad i
     notis_val gäller förvalet, mejl på och SMS av. Varje ändring
     sparas direkt, och ett fel från databasen sägs rakt ut och
     ändringen tas tillbaka i rutan: en brytare som står på fast
     databasen sa nej är värre än ingen brytare.

     SMS finns bara för påminnelser. Det kräver att flaggan
     notiser_sms är på och att ett svenskt mobilnummer står under
     Mitt konto. Samma regel för numret som intern.sms_nummer i
     databasen.

     opts: { uid, roll: 'parent' | 'tutor', telefon() → text,
             kontoAdress }
     ============================================================ */
  function smsNummer(text) {
    var n = String(text == null ? '' : text).replace(/[^0-9]/g, '');
    if (/^07[0-9]{8}$/.test(n)) return '+46' + n.slice(1);
    if (/^467[0-9]{8}$/.test(n)) return '+' + n;
    if (/^00467[0-9]{8}$/.test(n)) return '+' + n.slice(2);
    return null;
  }

  function timmarText(lista) {
    var t = Array.from(new Set((lista || []).map(Number).filter(function (x) { return x > 0; })))
      .sort(function (a, b) { return b - a; })
      .map(function (h) { return h === 1 ? '1 timme' : h + ' timmar'; });
    if (!t.length) return '';
    return t.length === 1 ? t[0] : t.slice(0, -1).join(', ') + ' och ' + t[t.length - 1];
  }

  function val(host, opts) {
    if (!host) return null;
    var o = opts || {};
    /* En studiehjälpare får aldrig en rapportnotis; en rad som sa
       "Bara i appen" hade lovat något som aldrig kommer. */
    var typer = TYPER.filter(function (t) { return !(o.roll === 'tutor' && t[0] === 'rapport'); });
    /* valen:  det brytarna visar, alltså det användaren senast valde,
               också medan sparningen är på väg.
       sparat: det databasen senast sa ja till. Dit går en brytare
               tillbaka när en sparning nekas.
       Förut fanns bara det sparade läget, och det ändrades först när
       svaret kom. Ritades tabellen om under tiden (ett sparat SMS-val,
       ett sparat nummer under Mitt konto) ritades det gamla läget:
       databasen hade mejl av medan brytaren stod på. */
    var V = { valen: {}, sparat: {}, fel: null, smsPa: false, mejlPa: null, timmar: null,
      laddat: false, laddar: false, sparar: {} };
    var namn = {};
    TYPER.forEach(function (t) { namn[t[0]] = t[1]; });

    function har(karta, k) { return Object.prototype.hasOwnProperty.call(karta, k); }

    function pa(typ, kanal) {
      var k = typ + '|' + kanal;
      return har(V.valen, k) ? V.valen[k] : kanal === 'mejl';
    }

    function sparatPa(typ, kanal) {
      var k = typ + '|' + kanal;
      return har(V.sparat, k) ? V.sparat[k] : kanal === 'mejl';
    }

    function telefon() {
      try { return typeof o.telefon === 'function' ? o.telefon() : ''; } catch (e) { return ''; }
    }

    async function ladda() {
      if (V.laddar) return;
      host.innerHTML = '<div class="loading">Hämtar</div>';
      if (!supa || !o.uid) { host.innerHTML = '<div class="empty">Notisvalen går inte att läsa just nu.</div>'; return; }
      V.laddar = true;
      var svar;
      try {
        svar = await Promise.all([
          supa.from('notis_val').select('typ, kanal, pa'),
          supa.from('flaggor').select('kod, aktiv').in('kod', ['notiser_sms', 'notiser_mejl']),
          supa.from('notis_installning').select('paminnelser_timmar').eq('id', 1).maybeSingle()
        ]);
      } catch (fel) {
        svar = [{ error: fel }, { error: fel }, { error: fel }];
      } finally {
        V.laddar = false;
      }
      var v = svar[0], f = svar[1], i = svar[2];
      V.valen = {};
      V.sparat = {};
      V.fel = v.error || null;
      (v.data || []).forEach(function (r) { V.valen[r.typ + '|' + r.kanal] = V.sparat[r.typ + '|' + r.kanal] = !!r.pa; });
      /* En flagga som saknas, eller inte går att läsa, är av. */
      if (f.error) console.warn('flaggor:', f.error.message);
      var flaggor = {};
      (f.data || []).forEach(function (r) { flaggor[r.kod] = !!r.aktiv; });
      V.smsPa = !f.error && flaggor.notiser_sms === true;
      V.mejlPa = f.error ? null : flaggor.notiser_mejl === true;
      if (i.error) console.warn('notis_installning:', i.error.message);
      V.timmar = (!i.error && i.data && Array.isArray(i.data.paminnelser_timmar)) ? i.data.paminnelser_timmar : null;
      V.laddat = true;
      rita();
    }

    /* Vyn anropar den här varje gång fliken öppnas. Gick förra
       hämtningen fel hämtas valen igen, annars står de kvar som de är.
       Förut hämtades de en gång per sidladdning, också när det
       misslyckades: ett tillfälligt fel, eller tabellen som inte fanns
       än, satt kvar tills sidan laddades om. */
    function försökIgen() {
      if (V.laddar) return;
      if (!V.laddat || V.fel) ladda();
    }

    function brytare(typ, kanal, låst, beskriven) {
      var på = pa(typ, kanal);
      var id = 'nv-' + typ + '-' + kanal;
      return '<label class="nx-brytare" for="' + id + '">'
        + '<input type="checkbox" role="switch" id="' + id + '" data-typ="' + esc(typ) + '" data-kanal="' + esc(kanal) + '"'
        + (på ? ' checked' : '') + (låst ? ' disabled' : '')
        /* Ritas brytaren om medan den sparas syns det fortfarande. */
        + (V.sparar[typ + '|' + kanal] ? ' aria-busy="true"' : '')
        + (beskriven ? ' aria-describedby="' + esc(beskriven) + '"' : '') + '>'
        + '<span class="nx-brytare-spar" aria-hidden="true"></span>'
        + '<span class="nx-brytare-text" aria-hidden="true">' + (på ? 'På' : 'Av') + '</span>'
        + '<span class="nx-dold">' + esc(namn[typ] + (kanal === 'mejl' ? ' som mejl' : ' som SMS')) + '</span>'
        + '</label>';
    }

    /* Vad SMS-cellen ska säga, i ordning: flaggan, numret, och sist
       vart SMS:et går. Returnerar { låst, text, länk }. */
    function smsLäge() {
      var på = pa('paminnelse', 'sms');
      /* Flaggan av: ingen kan slå PÅ SMS. Den som redan har SMS på (ett
         val från när flaggan var på) ska ändå kunna stänga av det.
         Förut stod brytaren ikryssad och låst, och SMS:en hade börjat
         gå den dag flaggan slogs på, vad användaren än ville. Samma
         regel som för numret nedan: bara att slå på är låst. */
      if (!V.smsPa) {
        return {
          låst: !på,
          text: på
            ? 'SMS är inte öppnat än. Du har valt SMS för påminnelser och kan stänga av det här.'
            : 'SMS är inte öppnat än.'
        };
      }
      var tel = telefon();
      var nummer = smsNummer(tel);
      if (!nummer) {
        return {
          /* Den som redan har SMS på ska kunna stänga av det, också
             utan nummer. Bara att slå PÅ kräver numret. */
          låst: !på,
          text: String(tel || '').trim()
            ? 'Numret under Mitt konto går inte att använda för SMS. Det behövs ett svenskt mobilnummer, till exempel 070 123 45 67.'
            : 'SMS kräver ett svenskt mobilnummer under Mitt konto. Där står inget nummer nu.',
          länk: true
        };
      }
      return { låst: false, text: på ? 'Påminnelserna går som SMS till ' + nummer + '.' : '' };
    }

    function rita() {
      if (!V.laddat) return;
      if (V.fel) {
        /* Före migrationen finns tabellen inte, och databasens svar är
           en engelsk mening om ett schema som ingen familj känner till.
           Klockan tiger om samma sak; här räcker det att säga att
           valen inte går att ändra än. Andra fel sägs som i resten av
           vyn, med en knapp för ett nytt försök. Fliken hämtar också
           igen när den öppnas nästa gång (försökIgen). */
        host.innerHTML = tabellenSaknas(V.fel)
          ? '<div class="empty">Notisvalen går inte att ändra än.</div>'
          : '<div class="empty">Notisvalen går inte att läsa just nu.<br><span class="xsmall">'
            + esc(NX.felText(V.fel)) + '</span><br><br>'
            + '<button type="button" class="btn btn-ghost btn-sm" data-nv-igen>Försök igen</button></div>';
        return;
      }
      var sms = smsLäge();
      var konto = o.kontoAdress || '#profil/konto';
      var html = '<p class="nx-val-intro">Allt syns under klockan här i vyn. Här väljer du vad som också ska komma som mejl'
        + (V.smsPa ? ' eller SMS' : '') + '.</p>';
      if (V.mejlPa === false) {
        html += '<p class="nx-val-not">' + ikon('paminnelse') + '<span>Mejl skickas inte ut än. Dina val sparas ändå.</span></p>';
      }
      html += '<table class="nx-val-tabell">'
        + '<caption class="nx-dold">Notiser som mejl och SMS</caption>'
        + '<thead><tr><th scope="col">Notis</th><th scope="col">Mejl</th><th scope="col">SMS</th></tr></thead><tbody>';
      typer.forEach(function (t) {
        var typ = t[0];
        var mejl = MEJLBARA.indexOf(typ) !== -1
          ? brytare(typ, 'mejl', false, null)
          : '<span class="nx-val-bara">Bara i appen</span>';
        var smsCell = SMSBARA.indexOf(typ) !== -1
          ? brytare(typ, 'sms', sms.låst, sms.text ? 'nv-sms-not' : null)
          : '<span class="nx-dold">Inget SMS</span>';
        html += '<tr><th scope="row">' + esc(t[1]) + '</th><td>' + mejl + '</td><td>' + smsCell + '</td></tr>';
        if (typ === 'paminnelse' && sms.text) {
          html += '<tr class="nx-val-notrad"><td colspan="3"><p id="nv-sms-not" tabindex="-1">' + esc(sms.text)
            + (sms.länk ? ' <a href="' + esc(konto) + '">Till Mitt konto</a>' : '') + '</p></td></tr>';
        }
      });
      html += '</tbody></table>';
      if (V.timmar) {
        var tt = timmarText(V.timmar);
        html += '<p class="nx-val-paminn">' + ikon('paminnelse') + '<span>'
          + esc(tt ? 'Vi påminner ' + tt + ' före passet.' : 'Påminnelser är avstängda just nu.') + '</span></p>';
      }
      html += '<p class="ok-msg" id="nv-msg" role="status" aria-live="polite"></p>';
      host.innerHTML = html;
    }

    function textFör(inp) {
      var t = inp.parentNode.querySelector('.nx-brytare-text');
      if (t) t.textContent = inp.checked ? 'På' : 'Av';
    }

    /* Brytaren letas upp på nytt varje gång. Tabellen kan ha ritats om
       medan en sparning var på väg, och då är elementet sparningen
       började med inte längre med på sidan. */
    function brytarenFör(typ, kanal) {
      return host.querySelector('#nv-' + typ + '-' + kanal);
    }

    /* Rita om och behåll fokus. Hade en brytare fokus får den tillbaka
       det; har den blivit låst (SMS av utan nummer) går fokus till
       texten som säger varför, i stället för till sidans början. */
    function ritaOm() {
      var aktiv = document.activeElement;
      var id = aktiv && aktiv.id && host.contains(aktiv) ? aktiv.id : null;
      rita();
      if (!id) return;
      var igen = document.getElementById(id);
      if (igen && !igen.disabled) { igen.focus(); return; }
      var not = host.querySelector('#nv-sms-not');
      if (not) not.focus();
    }

    /* Spara det senaste läget. Ändras brytaren igen medan den förra
       sparningen är på väg, sparas det nya läget när den är klar,
       så att två snabba tryck aldrig lämnar databasen och rutan
       oense. */
    async function spara(typ, kanal) {
      var nyckel = typ + '|' + kanal;
      if (V.sparar[nyckel]) { V.sparar[nyckel] = 'igen'; return; }

      var önskat = pa(typ, kanal);
      V.sparar[nyckel] = true;
      var inp = brytarenFör(typ, kanal);
      if (inp) inp.setAttribute('aria-busy', 'true');
      var res;
      try {
        res = await supa.from('notis_val')
          .upsert({ profil_id: o.uid, typ: typ, kanal: kanal, pa: önskat }, { onConflict: 'profil_id,typ,kanal' });
      } catch (fel) {
        res = { error: fel };
      }
      var igen = V.sparar[nyckel] === 'igen';
      delete V.sparar[nyckel];
      inp = brytarenFör(typ, kanal);
      if (inp) inp.removeAttribute('aria-busy');

      if (res.error) {
        /* Tillbaka till det databasen senast sa ja till, också om
           brytaren hunnit tryckas igen under tiden. En brytare som
           står på fast databasen sa nej är värre än ingen brytare. */
        V.valen[nyckel] = sparatPa(typ, kanal);
        if (kanal === 'sms') ritaOm();
        else if (inp) { inp.checked = V.valen[nyckel]; textFör(inp); }
        NX.säg(host.querySelector('#nv-msg'), 'Kunde inte spara: ' + NX.felText(res.error), false);
        return;
      }
      V.sparat[nyckel] = önskat;
      if (igen && pa(typ, kanal) !== önskat) { spara(typ, kanal); return; }
      /* SMS-raden beror på läget: stängs SMS av utan nummer, eller
         medan SMS inte är öppnat, ska brytaren låsas och texten
         ändras. Omritningen tar också med #nv-msg, så beskedet skrivs
         efteråt. */
      if (kanal === 'sms') ritaOm();
      NX.säg(host.querySelector('#nv-msg'),
        '✓ Sparat. ' + namn[typ] + (kanal === 'mejl' ? ' som mejl: ' : ' som SMS: ') + (önskat ? 'på.' : 'av.'), true);
    }

    host.addEventListener('change', function (e) {
      var inp = e.target.closest && e.target.closest('input[data-typ]');
      if (!inp) return;
      var typ = inp.dataset.typ, kanal = inp.dataset.kanal;
      if (kanal === 'sms' && inp.checked) {
        var fel = !V.smsPa ? 'SMS är inte öppnat än.'
          : !smsNummer(telefon()) ? 'Lägg in ett svenskt mobilnummer under Mitt konto först.' : null;
        if (fel) {
          inp.checked = pa(typ, kanal);
          textFör(inp);
          NX.säg(host.querySelector('#nv-msg'), fel, false);
          return;
        }
      }
      /* Valet gäller i rutan från första trycket, och en omritning
         medan det sparas ritar det som valts (se V ovan). */
      V.valen[typ + '|' + kanal] = inp.checked;
      textFör(inp);
      spara(typ, kanal);
    });

    host.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-nv-igen]')) ladda();
    });

    ladda();
    return { ladda: ladda, försökIgen: försökIgen, ritaOm: ritaOm };
  }

  return {
    start: start, stoppa: stoppa, attGöra: attGöra, hämta: hämta,
    trådSedd: trådSedd, trådvisare: trådvisare,
    val: val, smsNummer: smsNummer, mening: mening, detalj: detalj,
    TYPER: TYPER
  };
})();
