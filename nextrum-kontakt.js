/* ============================================================
   NEXTRUM — kontakten mellan familj och studiehjälpare
   Delas av foralder.html och larare.html. Båda sidorna visar samma
   tråd, från var sitt håll; skillnaden är bara vem som är "jag".

   Kräver: nextrum-app.js (NX) och den globala supa-klienten.
   passRad ritar brickan, statusen och bubblan med NXStudie
   (nextrum-studie.js), som laddas efter den här filen men alltid
   finns när en rad ritas. Adminvyn laddar inte den här filen.
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

     Passets läge med ton och ikon (Vyerna i ny form, 2026-09-28):
     statusen är en färgad prick och ett ord, och orden är neutrum —
     det är passet som är bekräftat, inte tiden. klass står kvar för
     den som läser den.
     ============================================================ */
  var LÄGEN = {
    requested: { text: 'Föreslaget', klass: 'onskad', ton: 'ockra' },
    confirmed: { text: 'Bekräftat', klass: 'bekraftad', ton: 'mossa' },
    completed: { text: 'Genomfört', klass: 'genomford', ton: 'neutral', ikon: 'bock' },
    cancelled: { text: 'Avbokat', klass: 'avbokad', ton: 'neutral', ikon: 'kryss' }
  };

  /* Betalningens läge, som ett andra märke bredvid passets (Fas 14.2).
     Familjen betalar varje pass med kort, i förväg eller när de
     bekräftar rapporten efter passet (Fas 19.2), och båda sidor
     ska se samma ord för samma läge: "Inte betalt" hos familjen och
     "Betalt" hos studiehjälparen om samma pass hade varit en tvist
     innan någon ens sagt något.

     null betyder inget märke. En förfrågan betalas inte än, och ett
     pass Nextrum undantagit ska inte betalas alls. Ett avbokat pass
     får märket bara om pengar faktiskt rört sig — då är det precis
     vad familjen behöver se.

     Märket står sedan 2026-09-28 som tonad text i radens högerspalt,
     inte som ett piller. Obetalt är lera: det kräver något av någon. */
  var BETALLÄGEN = {
    ingen: { text: 'Inte betalt', klass: 'pa', ton: 'lera' },
    vantar: { text: 'Betalning påbörjad', klass: 'pa', ton: 'ockra' },
    misslyckad: { text: 'Betalningen nekades', klass: 'sen', ton: 'lera' },
    betald: { text: 'Betalt', klass: 'klar', ton: 'mossa', ikon: 'bock' },
    tvist: { text: 'Betalt, bestridd', klass: 'sen', ton: 'lera' },
    aterbetald: { text: 'Återbetalt', klass: 'ej', ton: 'neutral' },
    /* Fas 14.6. Familjen betalar passet mot månadsfaktura. Om fakturan
       är betald står på fakturan, inte på passet, så märket säger bara
       hur det betalas. */
    faktura: { text: 'Faktura', klass: 'pa', ton: 'ockra' }
  };
  /* Ett märke utan ton (äldre anropare) får den ur klassen. */
  var KLASS_TON = { klar: 'mossa', pa: 'ockra', sen: 'lera', ej: 'neutral' };

  function betalMärke(b) {
    if (!b || b.fakturerbar === false) return null;
    var läge = b.betalning_status || 'ingen';
    if (b.status === 'cancelled') {
      return (läge === 'betald' || läge === 'tvist' || läge === 'aterbetald') ? BETALLÄGEN[läge] : null;
    }
    if (b.status !== 'confirmed' && b.status !== 'completed') return null;
    /* Fas 19.5. Första timmen bjuds, och ett pass på en timme kostar då
       ingenting. "Inte betalt" hade varit fel ord. Föräldravyn märker
       passet (inget_att_betala), för bara den hämtar priset. */
    if (läge === 'ingen' && b.inget_att_betala) return { text: 'På köpet', klass: 'klar', ton: 'mossa' };
    return BETALLÄGEN[läge] || null;
  }

  /* ============================================================
     RADEN I NY FORM (Vyerna i ny form, 2026-09-28)

     En tabellrad: datumbricka · titel och metarad · status · högerspalt
     (pengar, betalläge, en knapp) · pil när raden är en länk. Tiden
     flyttade ur brickan in i metaraden, först, som ett tidsspann
     räknat ur duration_min: "16:00–17:00 · På plats, Hammarby allé 12".
     Stilen står i nextrum-innehall.css (PASSRADEN). Brickan, statusen
     och bubblan ritas av NXStudie, som laddas efter den här filen men
     finns när en rad ritas.

     Raden är en container: är den smalare än 560 px står bricka och
     text överst, och status, högerspalt och knappar på en rad under —
     vilken panel den än står i. Inget i den byter höjd av ett tryck
     (fälla 4), och spalterna är minmax(0,1fr) (fälla 2).

     o: {
       href       passets sida. Titeln blir en länk (tangentbord och
                  skärmläsare), hela raden går att trycka på — det
                  sköter NXStudie — och pilen säger att det finns mer
       titel      rubriken, t.ex. "Matematik med Alva". Förval: ämnet
       under      metaraden efter tidsspannet
       tid        false: inget tidsspann först i metaraden
       vem        en rad vanlig text under metaraden
       citat      { text, vem }: en anteckning som pratbubbla under
       status     { text, ton, ikon } — ton mossa|ockra|lera|neutral,
                  ikon bock|kryss. Förval ur LÄGEN. false: ingen
                  statuskolumn alls
       märke      { text, ton|klass, ikon }: betalläget (betalMärke),
                  som tonad text i högerspalten
       sida       html i högerspalten i stället för märket, t.ex.
                  beloppet och "Inte betalt"
       atgarder   knapparnas html, sist i högerspalten
       markerad   raden är tonad: här behövs ett svar
       tidigare   brickan bara med kant. Förval: passets dag har varit,
                  eller passet är avbokat
       forslag    brickan med streckad kant: ett förslag som väntar på
                  motparten
       veckodag   false: brickan utan veckodag
     }
     ============================================================ */
  function passRad(b, opts) {
    var o = opts || {};
    var avbokad = b.status === 'cancelled';
    var tidigare = o.tidigare != null ? !!o.tidigare
      : avbokad || String(b.wanted_date || '') < isoFor(new Date());
    var status = o.status === false ? null
      : o.status || LÄGEN[b.status] || { text: b.status || '', ton: 'neutral' };

    var namn = o.titel || b.subject || 'Pass';
    var titel = o.href
      ? '<a class="nx-passrad-titel" href="' + esc(o.href) + '">' + esc(namn) + '</a>'
      : '<b class="nx-passrad-titel">' + esc(namn) + '</b>';
    var meta = [o.tid === false ? '' : NXStudie.tidsspann(b.wanted_time, b.duration_min), o.under]
      .filter(Boolean).join(' · ');

    var märke = '';
    if (o.märke && o.märke.text) {
      var mTon = o.märke.ton || KLASS_TON[o.märke.klass] || 'neutral';
      märke = '<span class="nx-passrad-marke ar-' + esc(mTon) + '">'
        + (o.märke.ikon && NXStudie.IKON[o.märke.ikon] ? NXStudie.IKON[o.märke.ikon] : '')
        + esc(o.märke.text) + '</span>';
    }
    var sida = (o.sida != null ? o.sida : märke)
      + (o.atgarder ? '<span class="nx-passrad-knappar">' + o.atgarder + '</span>' : '');
    var statusHtml = status ? NXStudie.status(status) : '';

    return '<div class="nx-passrad' + (o.href ? ' ar-klickbar' : '') + (o.markerad ? ' ar-markerad' : '')
      + (tidigare ? ' ar-tidigare' : '') + (avbokad ? ' ar-avbokad' : '') + (status ? '' : ' ar-utan-status') + '"'
      + (o.href ? ' data-href="' + esc(o.href) + '"' : '') + '>'
      + '<div class="nx-passrad-in">'
      + NXStudie.datum(b.wanted_date, { tidigare: tidigare, forslag: !!o.forslag, avbokad: avbokad, veckodag: o.veckodag })
      + '<div class="nx-passrad-text">' + titel
      + (meta ? '<span class="nx-passrad-meta">' + esc(meta) + '</span>' : '')
      + (o.vem ? '<span class="nx-passrad-vem">' + esc(o.vem) + '</span>' : '')
      + '</div>'
      + (o.citat && o.citat.text ? NXStudie.citat(o.citat.text, o.citat.vem, 'nx-passrad-citat') : '')
      + (statusHtml || sida
          ? '<div class="nx-passrad-fot">'
            + (statusHtml ? '<span class="nx-passrad-status">' + statusHtml + '</span>' : '')
            + (sida ? '<span class="nx-passrad-sida">' + sida + '</span>' : '')
            + '</div>'
          : '')
      + (o.href ? '<span class="nx-passrad-pil" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M4.5 2.5 8 6l-3.5 3.5"/></svg></span>' : '')
      + '</div></div>';
  }

  return {
    tråd: tråd, olästa: olästa, passRad: passRad, dagText: dagText, LÄGEN: LÄGEN,
    betalMärke: betalMärke
  };
})();
