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

  /* Dagen en tidsstämpel hör till, räknad i webbläsarens tid som
     klockslaget bredvid. Datumet i själva strängen är UTC: ett
     meddelande 00:30 svensk tid står där som 22:30 dagen före, och
     hamnade under "Igår" med klockslaget 00:30. Ett rent datum har
     ingen tid att räkna om och tas som det står. */
  function lokalDag(iso) {
    var s = String(iso == null ? '' : iso);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    var d = new Date(s);
    return isNaN(d.getTime()) ? '' : isoFor(d);
  }

  /* "Idag" och "Igår" i stället för datum — det är så man pratar om
     de två dagar man faktiskt bryr sig om i en tråd. */
  function dagText(iso) {
    var dag = lokalDag(iso);
    var idag = isoFor(new Date());
    var igår = new Date(); igår.setDate(igår.getDate() - 1);
    if (dag === idag) return 'Idag';
    if (dag === isoFor(igår)) return 'Igår';
    return datumText(dag);
  }

  /* ============================================================
     TRÅDEN
     opts: { host, skriv, jag, parentId, tutorId, motpart, tom, onNytt,
             synlig }
     Returnerar ett objekt med ladda(), byt() och stoppa().

     synlig() (valfri) säger om tråden syns. Utan den gäller att
     host inte ligger i något [hidden] och har en yta på skärmen.
     ============================================================ */
  function tråd(opts) {
    var host = opts.host;
    var skrivRuta = opts.skriv;               // <textarea>
    var skickaKnapp = opts.knapp;             // <button>
    var jag = opts.jag;
    var läge = { parentId: opts.parentId || null, tutorId: opts.tutorId || null, motpart: opts.motpart || '' };
    var timer = null;
    /* EN TRÅD ÅT GÅNGEN, OCH RÄTT TRÅD.
       Generationen räknas upp när tråden byts. En hämtning minns sin
       generation och vilken tråd den gällde, och ett svar som kommer
       efter ett byte kastas. Förut spärrade en enda flagga (hämtar)
       alla hämtningar medan en var på väg. Byttes familj mitt i en
       laddning sväljdes byt(): rubriken sa Kim, tråden visade Almas
       meddelanden, och Almas rader markerade Kims chattnotis som läst.
       Då hoppade kön över chattmejlet om Kim, fast ingen sett det. */
    var generation = 0;
    var hämtarGen = -1;       // generationen som har en hämtning på väg, -1 när ingen har det
    var hämtaIgen = false;    // samma tråd efterfrågades medan en hämtning var på väg
    var senasteId = null;
    var senasteLäge = null;   // signatur över det vyn redan fått veta
    var kanal = null;         // Realtime-prenumerationen på tråden
    var samlaTimer = null;
    var senasteRader = null;  // det som senast hämtades, för läst-markeringen

    function tomText() {
      var namn = läge.motpart ? esc(läge.motpart.split(' ')[0]) : 'varandra';
      return '<div class="empty">Inga meddelanden än.<br><br>'
        + 'Skriv första raden till ' + namn + ' här. Det som sägs här stannar mellan er och oss.</div>';
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

    /* ============================================================
       LÄST FÖRST NÄR TRÅDEN SYNS (program 2, Fas 2)

       Förut markerades meddelandena som lästa varje gång tråden
       laddades, och tråden laddas när sidan öppnas, också när man
       står på Översikt och aldrig öppnar Meddelanden. En flik i
       bakgrunden stämplade alltså read_at, och räknaren på Översikt
       blinkade till och försvann.

       Det spelar större roll nu. Kön för chattmejl hoppar över ett
       mejl när chattens notis redan är läst, så att den som läser i
       appen inte också får ett mejl. Att markera vid sidladdning hade
       tystat alla chattmejl till alla som har vyn öppen någonstans.

       Nu markeras meddelandena (read_at) och trådens notiser först
       när tråden faktiskt syns: sektionen Meddelanden är framme och
       fliken är synlig. Blir den det senare (man öppnar Meddelanden,
       eller kommer tillbaka till fliken) markeras de då.
       ============================================================ */
    function syns() {
      if (document.visibilityState !== 'visible') return false;
      if (typeof opts.synlig === 'function') return !!opts.synlig();
      return !!host && host.isConnected && !host.closest('[hidden]') && host.getClientRects().length > 0;
    }

    function räknaOlästa(rader) {
      return rader.filter(function (m) { return !m.read_at && m.sender_id !== jag; }).length;
    }

    /* p och t är tråden raderna hämtades ur, inte läge. Byts tråden
       medan markeringen är på väg ska notisen som stämplas vara den
       vars meddelanden faktiskt syntes. */
    async function markeraLästa(rader, p, t) {
      if (!rader || !p || !t || !syns()) return 0;
      var olästa = rader.filter(function (m) { return !m.read_at && m.sender_id !== jag; });
      if (olästa.length) {
        var nu = new Date().toISOString();
        var res = await supa.from('messages')
          .update({ read_at: nu })
          .in('id', olästa.map(function (m) { return m.id; }));
        if (res.error) console.warn('messages, läst:', res.error.message);
        /* Räknarna ska inte vänta på realtidshändelsen som
           uppdateringen ger. Den kan dröja, och utan socket kommer
           den inte alls. */
        else olästa.forEach(function (m) { m.read_at = nu; });
      }
      /* Trådens notiser. Kom det nya meddelanden är de lästa nu, och
         då markeras notisen i databasen även om notislistan ännu inte
         fått veta att den finns. */
      if (window.NXNotiser) await NXNotiser.trådSedd(p, t, olästa.length > 0);
      return olästa.length;
    }

    /* onNytt säger till vyn att räknare och listor ska ritas om, och
       den anropas bara när något FAKTISKT är nytt. Förut kördes den
       vid varje pollning: studiehjälparvyn svarade med upp till fyra
       nya frågor mot databasen var 20:e sekund, dygnet runt, för en
       tråd där ingen skrivit något sedan i tisdags. */
    function meddela(rader) {
      var nyaste = rader.length ? rader[rader.length - 1].id : null;
      var signatur = rader.length + '|' + nyaste + '|' + räknaOlästa(rader);
      if (signatur === senasteLäge) return;
      senasteLäge = signatur;
      if (typeof opts.onNytt === 'function') opts.onNytt(rader);
    }

    /* Tråden kan bli synlig utan att den laddas om: man byter till
       Meddelanden. Sidomenyn byter sektion i sin egen hashchange-
       lyssnare, så kontrollen väntar ett varv tills den är klar.
       senasteRader hör alltid till tråden som står i läge: byt()
       tömmer den, och ett svar från en äldre tråd sätter den aldrig. */
    function närDetSyns() {
      if (!senasteRader || hämtarGen === generation || !syns()) return;
      var rader = senasteRader, gen = generation;
      markeraLästa(rader, läge.parentId, läge.tutorId).then(function () {
        if (gen === generation && rader === senasteRader) meddela(rader);
      });
    }
    function närAdressenByts() { setTimeout(närDetSyns, 0); }

    async function ladda(tyst) {
      if (!supa || !läge.parentId || !läge.tutorId) {
        host.innerHTML = '<div class="empty">Ingen matchning än, så det finns ingen att skriva till.</div>';
        return;
      }
      /* En hämtning av samma tråd åt gången. Efterfrågas tråden igen
         medan den är på väg (ett meddelande i realtid, ett svar som
         just skickats) hämtas den en gång till när den första är klar.
         Förut tappades den andra, och svaret som skickats syntes först
         vid nästa händelse. */
      if (hämtarGen === generation) { hämtaIgen = true; return; }
      var gen = generation;
      hämtarGen = gen;
      hämtaIgen = false;
      try {
        await hämtaTråd(tyst, gen, läge.parentId, läge.tutorId);
      } finally {
        if (hämtarGen === gen) hämtarGen = -1;
      }
      if (hämtaIgen && gen === generation) return ladda(true);
    }

    async function hämtaTråd(tyst, gen, p, t) {
      if (!tyst) host.innerHTML = '<div class="loading">Hämtar</div>';

      var res;
      try {
        res = await supa.from('messages')
          .select('id, sender_id, body, read_at, created_at')
          .eq('parent_id', p)
          .eq('tutor_id', t)
          .order('created_at', { ascending: true });
      } catch (fel) {
        res = { error: fel };
      }

      /* Tråden byttes medan svaret var på väg. Raderna hör till en
         annan familj: de ritas inte och markerar ingenting. byt() har
         redan startat hämtningen av den nya tråden. */
      if (gen !== generation) return;

      if (res.error) {
        host.innerHTML = '<div class="empty">Kunde inte hämta meddelandena.<br><span class="xsmall">'
          + esc(felText(res.error)) + '</span></div>';
        return;
      }

      var rader = res.data || [];
      var nyaste = rader.length ? rader[rader.length - 1].id : null;
      senasteRader = rader;

      /* Rita bara om något faktiskt ändrats. Annars hoppar tråden
         till botten mitt i att någon läser bakåt. */
      if (!tyst || nyaste !== senasteId || räknaOlästa(rader)) rita(rader);
      senasteId = nyaste;

      await markeraLästa(rader, p, t);
      /* Byttes tråden under markeringen är det den nya trådens
         hämtning som talar om för vyn vad som gäller. */
      if (gen !== generation) return;
      meddela(rader);
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
         meddelandefält någon använt. */
      skrivRuta.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); skicka(); }
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

    /* Notislistan frågar vilken tråd som syns just nu, så att en
       chattnotis som kommer medan man läser markeras direkt. */
    function visarTråden(p, t) {
      /* Medan en ny tråd hämtas står "Hämtar" där tråden ska vara.
         Ingen har sett något än, så notisen får vänta på hämtningen,
         som själv markerar den när raderna syns. */
      return p === läge.parentId && t === läge.tutorId && !!senasteRader && syns();
    }

    function start() {
      stoppa();
      lyssna();
      timer = setInterval(function () {
        if (document.visibilityState === 'visible') ladda(true);
      }, RESERV_INTERVALL);
      document.addEventListener('visibilitychange', närFlikenSyns);
      window.addEventListener('hashchange', närAdressenByts);
      if (window.NXNotiser) NXNotiser.trådvisare(visarTråden);
    }

    function stoppa() {
      /* Ett svar som är på väg när vyn stängs (utloggning) ska inte
         ritas eller markera något efteråt. */
      generation++;
      hämtaIgen = false;
      if (timer) { clearInterval(timer); timer = null; }
      if (samlaTimer) { clearTimeout(samlaTimer); samlaTimer = null; }
      document.removeEventListener('visibilitychange', närFlikenSyns);
      window.removeEventListener('hashchange', närAdressenByts);
      if (window.NXNotiser) NXNotiser.trådvisare(null);
      slutaLyssna();
    }

    start();

    /* Första hämtningen. Utan den ritas tråden först när pollningen
       tickar, alltså upp till 20 sekunder efter att vyn öppnats — och
       under tiden står det "Hämtar" över en tråd som redan finns. */
    ladda();

    return {
      ladda: ladda,
      /* Vyn kan säga till när tråden kan ha blivit synlig på ett sätt
         som inte ändrar adressen. */
      synsNu: närDetSyns,
      byt: function (nytt) {
        läge.parentId = nytt.parentId != null ? nytt.parentId : läge.parentId;
        läge.tutorId = nytt.tutorId != null ? nytt.tutorId : läge.tutorId;
        if (nytt.motpart != null) läge.motpart = nytt.motpart;
        /* Ny generation: en hämtning av den förra tråden som fortfarande
           är på väg kastas när den kommer, och spärrar inte den nya. */
        generation++;
        hämtaIgen = false;
        senasteId = null;
        senasteLäge = null;
        senasteRader = null;
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

     opts: { under, vem, atgarder, klickbar }

     VALET klickbar (program 2, Fas 1, av som förval): raden leder in
     till passets detaljer. Förut gick ett pass bara att öppna från
     schemat, och i listan, där man faktiskt letar efter sitt pass,
     var raden död. Raden får data-pass="<id>" och en synlig knapp
     "Detaljer" (data-pass-oppna="<id>"). Knappen är vägen för
     tangentbord och skärmläsare; ett klick var som helst på raden är
     genvägen för musen och fingret. Lyssnaren kopplas med passKlick.
     ============================================================ */
  var LÄGEN = {
    requested: { text: 'Önskad', klass: 'onskad' },
    confirmed: { text: 'Bekräftad', klass: 'bekraftad' },
    completed: { text: 'Genomförd', klass: 'genomford' },
    cancelled: { text: 'Avbokad', klass: 'avbokad' }
  };

  function passRad(b, opts) {
    var o = opts || {};
    var l = LÄGEN[b.status] || { text: b.status, klass: '' };
    var d = String(b.wanted_date || '').split('-');
    var dag = d[2] || '', mån = d[1] ? (NX.MANADER[Number(d[1]) - 1] || '').slice(0, 3) : '';
    var klick = !!o.klickbar && b.id != null;

    /* Namnet på knappen börjar med ordet som syns, "Detaljer", och
       säger sedan vilket pass. Tio knappar som alla heter "Detaljer"
       går inte att skilja åt i en lista över knappar. */
    var detaljer = klick
      ? '<button type="button" class="btn btn-ghost pass-oppna" data-pass-oppna="' + esc(b.id) + '"'
        + ' aria-label="' + esc('Detaljer: ' + (b.subject || 'Pass')
          + (b.wanted_date ? ', ' + datumText(String(b.wanted_date)) : '')
          + (b.wanted_time ? ' kl. ' + String(b.wanted_time).slice(0, 5) : '')) + '">'
        + 'Detaljer</button>'
      : '';

    return '<div class="pass' + (klick ? ' ar-klickbar' : '') + '"'
      + (klick ? ' data-pass="' + esc(b.id) + '"' : '') + '>'
      + '<span class="pass-nar"><b>' + esc(dag) + '</b>' + esc(mån)
      + (b.wanted_time ? '<br>' + esc(b.wanted_time) : '') + '</span>'
      + '<span class="pass-vad"><b>' + esc(b.subject || 'Pass') + '</b>'
      + (o.under ? '<span>' + esc(o.under) + '</span>' : '')
      + (o.vem ? '<span class="pass-vem">' + esc(o.vem) + '</span>' : '')
      + '</span>'
      + '<span class="pass-atg"><span class="lage ' + l.klass + '">' + esc(l.text) + '</span>'
      + (o.atgarder || '') + detaljer + '</span>'
      + '</div>';
  }

  /* ============================================================
     KLICK PÅ EN PASSRAD
     passKlick(container, onOppna(id, e))

     En lyssnare på behållaren, inte en per rad: listorna ritas om
     med innerHTML vid varje laddning. Anropas den igen på samma
     behållare byts bara mottagaren, så att en omritning inte ger två
     lyssnare och två öppna rutor.

     Ett klick på en annan knapp, en länk eller ett fält på raden
     (Flytta, Avboka, Skriv rapport) är den knappens klick och
     öppnar ingenting. Den som markerar text på raden har inte
     klickat heller. Knappen "Detaljer" är en vanlig <button>, så
     Enter och mellanslag fungerar av sig själva.
     ============================================================ */
  var ANDRA_KONTROLLER = 'a, button, input, select, textarea, label, summary, [contenteditable="true"]';

  function passKlick(container, onOppna) {
    if (!container || typeof onOppna !== 'function') return;
    container.__passOppna = onOppna;
    if (container.__passKlick) return;
    container.__passKlick = true;

    container.addEventListener('click', function (e) {
      var mottagare = container.__passOppna;
      var knapp = e.target.closest('[data-pass-oppna]');
      if (knapp && container.contains(knapp)) {
        mottagare(knapp.dataset.passOppna, e);
        return;
      }
      if (e.target.closest(ANDRA_KONTROLLER)) return;
      var sel = window.getSelection && window.getSelection();
      if (sel && String(sel).length && !sel.isCollapsed) return;
      var rad = e.target.closest('.pass[data-pass]');
      if (rad && container.contains(rad)) mottagare(rad.dataset.pass, e);
    });
  }

  return { tråd: tråd, olästa: olästa, passRad: passRad, passKlick: passKlick, dagText: dagText, LÄGEN: LÄGEN };
})();
