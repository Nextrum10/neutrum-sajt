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

  /* Hur ofta tråden hämtas om medan sidan står öppen. Ingen realtid:
     en pollning var 20:e sekund räcker för en konversation som mest
     handlar om "kan vi flytta till torsdag?", och den kräver varken
     Realtime-publikation i Supabase eller en öppen websocket som
     ändå dör när telefonen låser sig. */
  var INTERVALL = 20000;

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
      if (!tyst) host.innerHTML = '<div class="loading">Hämtar</div>';

      var res = await supa.from('messages')
        .select('id, sender_id, body, read_at, created_at')
        .eq('parent_id', läge.parentId)
        .eq('tutor_id', läge.tutorId)
        .order('created_at', { ascending: true });
      hämtar = false;

      if (res.error) {
        host.innerHTML = '<div class="empty">Kunde inte hämta meddelandena.<br><span class="xsmall">'
          + esc(felText(res.error)) + '</span></div>';
        return;
      }

      var rader = res.data || [];
      var nyaste = rader.length ? rader[rader.length - 1].id : null;

      /* Rita bara om något faktiskt ändrats. Annars hoppar tråden
         till botten var 20:e sekund mitt i att någon läser bakåt. */
      var olästaFinns = rader.some(function (m) { return !m.read_at && m.sender_id !== jag; });
      if (!tyst || nyaste !== senasteId || olästaFinns) rita(rader);
      senasteId = nyaste;

      await markeraLästa(rader);
      if (typeof opts.onNytt === 'function') opts.onNytt(rader);
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

    function start() {
      stoppa();
      timer = setInterval(function () {
        if (document.visibilityState === 'visible') ladda(true);
      }, INTERVALL);
    }
    function stoppa() { if (timer) { clearInterval(timer); timer = null; } }

    /* Tillbaka i fliken efter en stund: hämta direkt i stället för
       att vänta ut intervallet. */
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') ladda(true);
    });

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

  function passRad(b, opts) {
    var o = opts || {};
    var l = LÄGEN[b.status] || { text: b.status, klass: '' };
    var d = String(b.wanted_date || '').split('-');
    var dag = d[2] || '', mån = d[1] ? (NX.MANADER[Number(d[1]) - 1] || '').slice(0, 3) : '';

    return '<div class="pass">'
      + '<span class="pass-nar"><b>' + esc(dag) + '</b>' + esc(mån)
      + (b.wanted_time ? '<br>' + esc(b.wanted_time) : '') + '</span>'
      + '<span class="pass-vad"><b>' + esc(b.subject || 'Pass') + '</b>'
      + (o.under ? '<span>' + esc(o.under) + '</span>' : '')
      + (o.vem ? '<span class="pass-vem">' + esc(o.vem) + '</span>' : '')
      + '</span>'
      + '<span class="pass-atg"><span class="lage ' + l.klass + '">' + esc(l.text) + '</span>'
      + (o.atgarder || '') + '</span>'
      + '</div>';
  }

  return { tråd: tråd, olästa: olästa, passRad: passRad, LÄGEN: LÄGEN };
})();
