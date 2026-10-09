/* ============================================================
   NEXTRUM — kontakten mellan familj och studiehjälpare
   Delas av foralder.html och larare.html. Båda sidorna visar samma
   tråd, från var sitt håll; skillnaden är bara vem som är "jag".

   Kräver: nextrum-app.js (NX) och den globala supa-klienten.
   Databasen: messages-tabellen i schema-v4.sql.
   ============================================================ */
window.NXKontakt = (function () {
  'use strict';

  var $ = NX.$, esc = NX.esc, felText = NX.felText, datumText = NX.datumText, isoFor = NX.isoFor;

  /* SEDAN FAS 4 KOMMER MEDDELANDEN I REALTID.

     Tråden prenumererar på ändringar i messages och hämtas om när
     något faktiskt händer. Förut lästes hela tråden var 20:e sekund,
     vilket betydde upp till en halv minuts fördröjning på ett svar
     och tre frågor i minuten från varje öppen flik, oavsett om något
     hänt eller inte.

     Pollningen finns kvar, men glesare, och bara som reserv. En
     websocket dör när telefonen låser sig, när nätet byts mellan wifi
     och 4G, och när en proxy tycker att anslutningen legat still för
     länge. Realtime återansluter själv, men det finns inget löfte om
     att ingen ändring hunnit passera under tiden — därför hämtar
     reserven ändå tråden en gång i minuten, och alltid direkt när
     fliken kommer fram igen. */
  var RESERV_INTERVALL = 60000;

  /* Flera ändringar i samma sekund (ett meddelande som skickas och
     direkt markeras som läst) ska ge EN omhämtning, inte tre. */
  var SAMLA_MS = 150;

  function klocka(iso) {
    var d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /* "Idag" och "Igår" i stället för datum — det är så man pratar om
     de två dagar man faktiskt bryr sig om i en tråd. */
  function dagText(iso) {
    var dag = String(iso).slice(0, 10);
    var idag = isoFor(new Date());
    var igår = new Date(); igår.setDate(igår.getDate() - 1);
    if (dag === idag) return 'Idag';
    if (dag === isoFor(igår)) return 'Igår';
    return datumText(dag);
  }

  /* ============================================================
     TRÅDEN
     opts: { host, skriv, jag, parentId, tutorId, motpart, tom, onNytt }
     Returnerar ett objekt med ladda(), byt() och stoppa().
     ============================================================ */
  function tråd(opts) {
    var host = opts.host;
    var skrivRuta = opts.skriv;               // <textarea>
    var skickaKnapp = opts.knapp;             // <button>
    var jag = opts.jag;
    var läge = { parentId: opts.parentId || null, tutorId: opts.tutorId || null, motpart: opts.motpart || '' };
    var timer = null;
    var hämtar = false;
    var senasteId = null;
    var senasteLäge = null;   // signatur över det vyn redan fått veta
    var kanal = null;         // Realtime-prenumerationen på tråden
    var samlaTimer = null;

    function tomText() {
      var namn = läge.motpart ? esc(läge.motpart.split(' ')[0]) : 'varandra';
      return '<div class="empty">Inga meddelanden än.<br><br>'
        + 'Skriv första raden till ' + namn + ' här — det som sägs här stannar mellan er och oss.</div>';
    }

    function rita(rader) {
      if (!rader.length) { host.innerHTML = tomText(); return; }

      var ut = '', förraDagen = '';
      rader.forEach(function (m) {
        var dag = dagText(m.created_at);
        if (dag !== förraDagen) { ut += '<div class="tr-dag">' + esc(dag) + '</div>'; förraDagen = dag; }
        var min = m.sender_id === jag;
        ut += '<div class="tr-rad ' + (min ? 'min' : 'deras') + '">'
            + '<div class="tr-bubbla">' + esc(m.body) + '</div>'
            + '<span class="tr-tid">' + esc(klocka(m.created_at))
            + (min && !m.read_at ? ' · <span class="oläst">oläst</span>' : '')
            + '</span></div>';
      });
      host.innerHTML = ut;

      /* Nya meddelanden hamnar längst ned, så tråden ska stå där när
         man kommer in — inte högst upp i det som skrevs i förrgår. */
      host.scrollTop = host.scrollHeight;
    }

    async function markeraLästa(rader) {
      var olästa = rader.filter(function (m) { return !m.read_at && m.sender_id !== jag; });
      if (!olästa.length) return;
      await supa.from('messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', olästa.map(function (m) { return m.id; }));
    }

    async function ladda(tyst) {
      if (!supa || !läge.parentId || !läge.tutorId) {
        host.innerHTML = '<div class="empty">Ingen matchning än, så det finns ingen att skriva till.</div>';
        return;
      }
      if (hämtar) return;
      hämtar = true;
      /* Vid byte av tråd: "Hämtar" i samma höjd som tråden hade. Den
         krympte annars till en rad medan den nya hämtades, och sidan
         under tråden — skrivrutan — hoppade upp och sedan ned igen. */
      if (!tyst) {
        host.style.minHeight = host.offsetHeight ? host.offsetHeight + 'px' : '';
        host.innerHTML = '<div class="loading">Hämtar</div>';
      }

      var res = await supa.from('messages')
        .select('id, sender_id, body, read_at, created_at')
        .eq('parent_id', läge.parentId)
        .eq('tutor_id', läge.tutorId)
        .order('created_at', { ascending: true });
      hämtar = false;
      host.style.minHeight = '';

      if (res.error) {
        host.innerHTML = '<div class="empty">Kunde inte hämta meddelandena.<br><span class="xsmall">'
          + esc(felText(res.error)) + '</span></div>';
        return;
      }

      var rader = res.data || [];
      var nyaste = rader.length ? rader[rader.length - 1].id : null;

      /* Rita bara om något faktiskt ändrats. Annars hoppar tråden
         till botten mitt i att någon läser bakåt. */
      var olästa = rader.filter(function (m) { return !m.read_at && m.sender_id !== jag; }).length;
      if (!tyst || nyaste !== senasteId || olästa) rita(rader);
      senasteId = nyaste;

      await markeraLästa(rader);

      /* onNytt säger till vyn att räknare och listor ska ritas om, och
         den anropas bara när något FAKTISKT är nytt. Förut kördes den
         vid varje pollning: studiehjälparvyn svarade med upp till fyra
         nya frågor mot databasen var 20:e sekund, dygnet runt, för en
         tråd där ingen skrivit något sedan i tisdags. */
      var signatur = rader.length + '|' + nyaste + '|' + olästa;
      if (signatur !== senasteLäge) {
        senasteLäge = signatur;
        if (typeof opts.onNytt === 'function') opts.onNytt(rader);
      }
    }

    /* Realtime kan ge flera händelser för samma sak i tät följd. Den
       här samlar ihop dem till en omhämtning. */
    function planeraOmläsning() {
      if (samlaTimer) clearTimeout(samlaTimer);
      samlaTimer = setTimeout(function () { samlaTimer = null; ladda(true); }, SAMLA_MS);
    }

    /* ============================================================
       PRENUMERATIONEN

       Filtret kan bara gälla EN kolumn, så det sätts på parent_id och
       tutor_id kontrolleras här. En studiehjälpare har flera familjer,
       och utan kontrollen hade en öppen tråd ritats om av ett
       meddelande i en annan familjs tråd.

       Att filtret inte är ett skydd är värt att säga rakt ut: RLS är
       skyddet. Realtime läser ändringarna med den inloggades egen
       token och skickar bara rader som policyn "deltagare läser
       tråden" släpper fram. Filtret här sparar arbete, det bevakar
       ingenting.
       ============================================================ */
    function lyssna() {
      slutaLyssna();
      if (!supa || !supa.channel || !läge.parentId || !läge.tutorId) return;

      kanal = supa
        .channel('trad-' + läge.parentId + '-' + läge.tutorId)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: 'parent_id=eq.' + läge.parentId
        }, function (p) {
          var rad = p.new || p.old || {};
          if (rad.tutor_id && rad.tutor_id !== läge.tutorId) return;
          planeraOmläsning();
        })
        .subscribe(function (status) {
          /* Vid varje lyckad anslutning hämtas tråden om. Det täcker
             det som hann hända medan socketen låg nere, till exempel
             under en tunnelresa. */
          if (status === 'SUBSCRIBED') ladda(true);
        });
    }

    function slutaLyssna() {
      if (!kanal) return;
      try { supa.removeChannel(kanal); } catch (e) { /* redan stängd */ }
      kanal = null;
    }

    async function skicka() {
      var text = String(skrivRuta.value || '').trim();
      if (!text) return;
      if (!läge.parentId || !läge.tutorId) return;

      skickaKnapp.setAttribute('aria-busy', 'true');
      var res = await supa.from('messages').insert({
        parent_id: läge.parentId,
        tutor_id: läge.tutorId,
        sender_id: jag,
        body: text
      });
      skickaKnapp.removeAttribute('aria-busy');

      if (res.error) {
        if (typeof opts.onFel === 'function') opts.onFel(felText(res.error));
        else alert('Meddelandet gick inte iväg: ' + felText(res.error));
        return;
      }
      skrivRuta.value = '';
      skrivRuta.style.height = '';
      await ladda(true);
    }

    if (skickaKnapp) skickaKnapp.addEventListener('click', skicka);
    if (skrivRuta) {
      /* Enter skickar, Skift+Enter ger ny rad — som i varje annat
         meddelandefält någon använt. Men inte med ett finger: en
         telefons tangentbord har ingen Skift att hålla in, så där var
         varje radbyte ett halvskrivet meddelande som gick iväg. Där är
         Enter en ny rad och Skicka knappen, som i telefonens egna
         meddelanden (2026-10-09). */
      skrivRuta.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
        if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
        e.preventDefault(); skicka();
      });
      skrivRuta.addEventListener('input', function () {
        skrivRuta.style.height = 'auto';
        skrivRuta.style.height = Math.min(skrivRuta.scrollHeight, 170) + 'px';
      });
    }

    /* Tillbaka i fliken efter en stund: hämta direkt i stället för att
       vänta ut reservintervallet. Funktionen har ett namn för att den
       ska gå att plocka bort igen — förut låg den kvar efter stoppa()
       och fortsatte hämta tråden i en vy som inte längre visades. */
    function närFlikenSyns() {
      if (document.visibilityState === 'visible') ladda(true);
    }

    function start() {
      stoppa();
      lyssna();
      timer = setInterval(function () {
        if (document.visibilityState === 'visible') ladda(true);
      }, RESERV_INTERVALL);
      document.addEventListener('visibilitychange', närFlikenSyns);
    }

    function stoppa() {
      if (timer) { clearInterval(timer); timer = null; }
      if (samlaTimer) { clearTimeout(samlaTimer); samlaTimer = null; }
      document.removeEventListener('visibilitychange', närFlikenSyns);
      slutaLyssna();
    }

    start();

    /* Första hämtningen. Utan den ritas tråden först när pollningen
       tickar, alltså upp till 20 sekunder efter att vyn öppnats — och
       under tiden står det "Hämtar" över en tråd som redan finns. */
    ladda();

    return {
      ladda: ladda,
      byt: function (nytt) {
        läge.parentId = nytt.parentId != null ? nytt.parentId : läge.parentId;
        läge.tutorId = nytt.tutorId != null ? nytt.tutorId : läge.tutorId;
        if (nytt.motpart != null) läge.motpart = nytt.motpart;
        senasteId = null;
        senasteLäge = null;
        /* Ny tråd, nytt filter. Utan det här hade prenumerationen
           stått kvar på den förra familjen. */
        lyssna();
        return ladda();
      },
      stoppa: stoppa
    };
  }

  /* ============================================================
     OLÄSTA — per tråd, för prickarna i familjelistan
     Vyn olasta_meddelanden lyder messages RLS, så den lämnar bara
     ut mina egna trådar.
     ============================================================ */
  async function olästa(jag) {
    if (!supa) return {};
    var res = await supa.from('olasta_meddelanden').select('parent_id, tutor_id, sender_id, antal');
    if (res.error) return {};
    var ut = {};
    (res.data || []).forEach(function (r) {
      if (r.sender_id === jag) return;           // mina egna oskickade räknas inte
      var nyckel = r.parent_id + '|' + r.tutor_id;
      ut[nyckel] = (ut[nyckel] || 0) + Number(r.antal || 0);
    });
    return ut;
  }

  /* ============================================================
     EN PASSRAD
     Samma markup i båda vyerna, olika knappar. atgarder() får
     bokningen och returnerar knapparnas HTML.
     ============================================================ */
  var LÄGEN = {
    requested: { text: 'Önskad', klass: 'onskad' },
    confirmed: { text: 'Bekräftad', klass: 'bekraftad' },
    completed: { text: 'Genomförd', klass: 'genomford' },
    cancelled: { text: 'Avbokad', klass: 'avbokad' }
  };

  /* Betalningens läge, som ett andra märke bredvid passets (Fas 14.2).
     Familjen betalar varje pass med kort, i förväg eller när de
     bekräftar rapporten efter passet (Fas 19.2), och båda sidor
     ska se samma ord för samma läge: "Ej betalt" hos familjen och
     "Betalt" hos studiehjälparen om samma pass hade varit en tvist
     innan någon ens sagt något.

     null betyder inget märke. En förfrågan betalas inte än, och ett
     pass Nextrum undantagit ska inte betalas alls. Ett avbokat pass
     får märket bara om pengar faktiskt rört sig — då är det precis
     vad familjen behöver se. */
  var BETALLÄGEN = {
    ingen: { text: 'Ej betalt', klass: 'pa' },
    vantar: { text: 'Betalning påbörjad', klass: 'pa' },
    misslyckad: { text: 'Betalningen nekades', klass: 'sen' },
    betald: { text: 'Betalt', klass: 'klar' },
    tvist: { text: 'Betalt, bestridd', klass: 'sen' },
    aterbetald: { text: 'Återbetalt', klass: 'ej' },
    /* Fas 14.6. Familjen betalar passet mot månadsfaktura. Om fakturan
       är betald står på fakturan, inte på passet, så märket säger bara
       hur det betalas. */
    faktura: { text: 'Faktura', klass: 'pa' }
  };

  function betalMärke(b) {
    if (!b || b.fakturerbar === false) return null;
    var läge = b.betalning_status || 'ingen';
    if (b.status === 'cancelled') {
      return (läge === 'betald' || läge === 'tvist' || läge === 'aterbetald') ? BETALLÄGEN[läge] : null;
    }
    if (b.status !== 'confirmed' && b.status !== 'completed') return null;
    /* Fas 19.5. Första timmen bjuds, och ett pass på en timme kostar då
       ingenting. "Ej betalt" hade varit fel ord. Föräldravyn märker
       passet (inget_att_betala), för bara den hämtar priset. */
    if (läge === 'ingen' && b.inget_att_betala) return { text: 'På köpet', klass: 'klar' };
    return BETALLÄGEN[läge] || null;
  }

  /* ============================================================
     RADENS DELAR (2026-09-28)
     Datumrutan säger veckodag, dag och månad. Tiden och platsen står i
     raden, med var sin ikon, i stället för i rutan: tiden stod där med
     sekunder ("16:00:00"), och platsen fick varje anropare foga in i sin
     egen rad med punkter emellan. Läget är ETT märke när det räcker: på
     ett bekräftat eller genomfört pass säger betalningen mer än att det
     är bekräftat, och två märken bredvid varandra var två saker att läsa
     för en.
     ============================================================ */
  var VECKODAG_KORT = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'];
  var IKON_TID = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v4.7l3 1.8"/></svg>';
  var IKON_ONLINE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6.5" width="12" height="11" rx="2.5"/><path d="m15.5 10.5 5-3v9l-5-3z"/></svg>';
  var IKON_VARNING = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5 21 19.5H3z"/><path d="M12 10v4.5M12 17h.01"/></svg>';
  var IKON_PLATS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5"/><path d="M6 10v9.5h12V10"/><path d="M10 19.5v-5h4v5"/></svg>';

  function tidsspann(tid, minuter) {
    if (!tid) return '';
    var d = String(tid).slice(0, 5).split(':');
    var start = Number(d[0]) * 60 + Number(d[1] || 0);
    var slut = start + (Number(minuter) || 60);
    function hhmm(m) { return (m / 60 < 10 ? '0' : '') + Math.floor(m / 60) + ':' + (m % 60 < 10 ? '0' : '') + (m % 60); }
    return hhmm(start) + '–' + hhmm(slut);
  }

  function passRad(b, opts) {
    var o = opts || {};
    var l = LÄGEN[b.status] || { text: b.status, klass: '' };
    var d = String(b.wanted_date || '').split('-');
    var dag = d[2] ? String(Number(d[2])) : '', mån = d[1] ? (NX.MANADER[Number(d[1]) - 1] || '').slice(0, 3) : '';
    var veckodag = b.wanted_date ? VECKODAG_KORT[new Date(String(b.wanted_date) + 'T12:00:00').getDay()] : '';

    /* o.href: raden leder till passets egen sida. Rubriken blir en
       länk (tangentbord och skärmläsare), och hela raden går att
       trycka på — det sköter NXStudie. Pilen säger att det finns mer
       bakom raden än det som står på den. o.med är vem passet gäller,
       efter ämnet: "Matematik med Alva". */
    var namn = esc(b.subject || 'Pass') + (o.med ? '<em> ' + esc(o.med) + '</em>' : '');
    var titel = o.href
      ? '<a class="pass-titel" href="' + esc(o.href) + '">' + namn + '</a>'
      : '<b class="pass-titel">' + namn + '</b>';

    /* Tiden och platsen, om inte anroparen säger annat (o.tid, o.plats
       = false). En adress på plats står som den skrevs: var man ska
       vara är halva beskedet. */
    var meta = [];
    if (o.tid !== false && b.wanted_time) meta.push('<span>' + IKON_TID + esc(tidsspann(b.wanted_time, b.duration_min)) + '</span>');
    if (o.plats !== false) {
      if (b.format === 'Online') meta.push('<span>' + IKON_ONLINE + 'Online</span>');
      else if (b.location || b.format) meta.push('<span>' + IKON_PLATS + esc(b.location || b.format) + '</span>');
    }
    if (o.under) meta.push('<span>' + esc(o.under) + '</span>');

    /* Ett märke, eller två. o.lage ersätter passets eget (null tar bort
       det). Har passet ett betalmärke och är bekräftat eller genomfört
       står bara betalmärket. */
    var egetLäge = o.lage !== undefined ? o.lage
      : (o.märke && (b.status === 'confirmed' || b.status === 'completed')) ? null : l;
    var märken = (egetLäge ? '<span class="lage ' + esc(egetLäge.klass || '') + '">' + esc(egetLäge.text) + '</span>' : '')
      + (o.märke ? '<span class="lage ' + esc(o.märke.klass || '') + '">' + esc(o.märke.text) + '</span>' : '');

    return '<div class="pass' + (o.href ? ' pass-klickbar' : '') + '"'
      + (o.href ? ' data-href="' + esc(o.href) + '"' : '') + '>'
      + '<span class="pass-nar' + (o.nu ? ' ar-nu' : '') + '"><small>' + esc(veckodag) + '</small><b>' + esc(dag) + '</b><small>' + esc(mån) + '</small></span>'
      + '<span class="pass-vad">' + titel
      + (meta.length ? '<span class="pass-meta">' + meta.join('') + '</span>' : '')
      + (o.not ? '<span class="pass-not">”' + esc(o.not) + '”</span>' : '')
      /* o.varning: något man ska veta innan man svarar, som att tiden
         krockar med ett annat pass. Lerans ton, med en ikon: färgen
         ensam säger inget till den som inte ser den. */
      + (o.varning ? '<span class="pass-varning">' + IKON_VARNING + esc(o.varning) + '</span>' : '')
      + (o.vem ? '<span class="pass-vem">' + esc(o.vem) + '</span>' : '')
      + '</span>'
      + '<span class="pass-atg">' + märken + (o.atgarder || '') + '</span>'
      + (o.href ? '<span class="pass-pil" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M4.5 2.5 8 6l-3.5 3.5"/></svg></span>' : '')
      + '</div>';
  }

  /* Familjens anteckning, kapad: raden ska gå att skumma. Hela står på
     passets sida. */
  function kortNot(text) {
    var t = String(text || '');
    return t.length > 80 ? t.slice(0, 80).replace(/\s+\S*$/, '') + '…' : t;
  }

  return {
    tråd: tråd, olästa: olästa, passRad: passRad, dagText: dagText, LÄGEN: LÄGEN,
    betalMärke: betalMärke, kortNot: kortNot
  };
})();
