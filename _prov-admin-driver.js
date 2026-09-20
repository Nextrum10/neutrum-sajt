/* ============================================================
   PROVBÄNKEN FÖR ADMINVYN — körningen

   Laddas SIST på provsidorna. Gör ingenting av sig själv; exponerar

     await window.__provKor()

   som går igenom hela adminvyn och svarar med ett JSON-bart objekt:

     snapshots  en post per sektion och flik, per flik i detaljpanelen
                (första familjen, första studiehjälparen, första eleven)
                och några extra lägen (vald elev i matchningen, globalt
                sök, adminsök, notispanelen, djuplänk till en flik, och
                när de finns: Inställningar med #rt-form, och Uppgifter
                efter att #uppg-form skickats med titeln "Prov").
                Varje post: typ, sek, flik, hash, var (topprad),
                text (innerText med hopslagna blanksteg), form (värdet i
                varje synligt fält) och laddar (antal kvarvarande
                "Hämtar"-rutor).
     globalt    titel, topprad, sidomenyns siffror, flikmärken, heron,
                sidhuvudet, notiserna
     errors     allt stubben fångat sedan sidan laddades: undantag,
                avvisade löften, console.error, resurser som inte laddade.
                Fälten kalla och stack pekar ut fil och rad — de skiljer
                sig mellan före och efter en uppdelning och ska inte
                jämföras, det ska text.
     warnings   console.warn och stubbens egna varningar
     anrop      varje databasfråga som kördes, i ordning
     meta       sidan, skripten, om vyn hann bli klar

   Resultatet sparas också som sträng i window.__provResultat, och
   window.__provBit(i, n) ger bit i av storlek n — för att läsa ut det
   i delar.

   Körs på en NYLADDAD sida. En andra körning på samma sida ger andra
   anrop (loggen fortsätter) och står med en varning i meta.

   Väntan sker med MessageChannel, inte setTimeout: i en dold
   förhandsruta stryps timers till en per sekund eller glesare, och då
   tar en genomgång minuter i stället för sekunder.
   ============================================================ */
(function () {
  'use strict';

  function tick() {
    return new Promise(function (klar) {
      var k = new MessageChannel();
      k.port1.onmessage = function () { k.port1.close(); klar(); };
      k.port2.postMessage(0);
    });
  }

  async function sov(ms) {
    var slut = performance.now() + ms;
    do { await tick(); } while (performance.now() < slut);
  }

  async function väntaPå(villkor, maxMs) {
    var slut = performance.now() + maxMs;
    for (;;) {
      var ok = false;
      try { ok = !!villkor(); } catch (e) { ok = false; }
      if (ok) return true;
      if (performance.now() >= slut) return false;
      await tick();
    }
  }

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function q(s, r) { return (r || document).querySelector(s); }
  function qa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function textAv(s) { var el = q(s); return el ? norm(el.innerText) : null; }

  function fältNamn(el) {
    if (el.id) return '#' + el.id;
    if (el.name) return el.tagName.toLowerCase() + '[name=' + el.name + ']';
    var d = Object.keys(el.dataset || {}).map(function (k) { return k + '=' + el.dataset[k]; }).join(',');
    return el.tagName.toLowerCase() + (d ? '[' + d + ']' : '');
  }

  function formFält(rot) {
    return qa('input, select, textarea', rot)
      .filter(function (el) { return !el.closest('[hidden]'); })
      .map(function (el) {
        var t = (el.type || '').toLowerCase();
        var v = (t === 'checkbox' || t === 'radio') ? (el.checked ? 'på' : 'av') : el.value;
        return fältNamn(el) + ': ' + v;
      });
  }

  /* "Hämtar"-rutor som fortfarande väntar. En ruta inne i en stängd
     <details> räknas inte: agentloggen lägger en sådan i varje rad och
     fyller den först när någon fäller ut raden. */
  function laddarKvar(rot) {
    return qa('.loading', rot).filter(function (el) {
      var d = el.closest('details');
      return !(d && !d.open);
    });
  }

  function ta(typ, sek, flik, rot, extra) {
    return Object.assign({
      typ: typ,
      sek: sek,
      flik: flik,
      hash: location.hash,
      var: textAv('#adm-var'),
      text: rot ? norm(rot.innerText) : '',
      form: rot ? formFält(rot) : [],
      laddar: rot ? laddarKvar(rot).length : 0
    }, extra || {});
  }

  function sidomenyMärken() {
    return qa('#vy-sido a[data-sek]').map(function (a) {
      var m = a.querySelector('.vy-sido-mark');
      return { sek: a.dataset.sek, marke: m ? m.textContent : null };
    });
  }

  function flikMärken() {
    return qa('.vy-flik-mark').map(function (m) {
      return { id: m.id, dold: !!m.hidden, text: m.textContent };
    });
  }

  function synligVy() {
    var v = ['view-loading', 'view-auth', 'view-nekad', 'view-app', 'view-fel']
      .filter(function (id) { var el = document.getElementById(id); return el && !el.hidden; });
    return v.join(',');
  }

  async function gåTill(sek) {
    location.hash = '#' + sek;
    var sektion = q('section[data-sek="' + sek + '"]');
    await väntaPå(function () { return sektion && !sektion.hidden; }, 3000);
    await sov(150);
    return sektion;
  }

  /* Ett element kan ligga i en flik som inte är framme. Klicka fram
     fliken, som en människa hade gjort. */
  async function visaFlikFör(el) {
    var panel = el && el.closest('.vy-flik-panel');
    if (!panel || !panel.hidden) return;
    var sek = panel.closest('section[data-sek]');
    var knapp = sek && q('.vy-flikar > .vy-flik[data-flik="' + panel.dataset.flik + '"]', sek);
    if (knapp) knapp.click();
    await väntaPå(function () { return !panel.hidden; }, 2000);
    await sov(150);
  }

  /* Skickar ett formulär som en människa: requestSubmit, så att
     appens egna submit-lyssnare körs. En lyssnare i bubbelfasen på
     window körs efter appens; har ingen av dem stoppat formuläret
     stoppar den det, så att sidan inte laddas om mitt i körningen —
     och det står i anm. */
  async function skicka(form, anm) {
    var sett = { submit: false, stoppadAvAppen: null };
    function vakt(e) {
      if (e.target !== form) return;
      sett.submit = true;
      sett.stoppadAvAppen = e.defaultPrevented;
      if (!e.defaultPrevented) e.preventDefault();
    }
    window.addEventListener('submit', vakt);
    try {
      if (typeof form.requestSubmit === 'function') form.requestSubmit();
      else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    } finally {
      window.removeEventListener('submit', vakt);
    }
    if (!sett.submit) anm.push('Ingen submit-händelse — webbläsarens validering stoppade formuläret.');
    else if (!sett.stoppadAvAppen) anm.push('Ingen lyssnare stoppade formuläret; provbänken hindrade omladdningen.');
    await väntaPå(function () { return !form.querySelector('[aria-busy]'); }, 3000);
    await sov(200);
    return sett.submit;
  }

  async function öppnaPanel(sek, typ, snapshots) {
    var sektion = await gåTill(sek);
    var knapp = sektion ? q('[data-dp^="' + typ + ':"]', sektion) : null;
    if (!knapp) {
      snapshots.push(ta('detalj', typ, null, null, { saknas: 'Ingen [data-dp^="' + typ + ':"] i #' + sek }));
      return;
    }
    var id = String(knapp.dataset.dp).split(':')[1];
    knapp.click();
    var panel = null;
    await väntaPå(function () {
      panel = q('aside.dp');
      return panel && !panel.hidden && !laddarKvar(panel).length
        && panel.querySelector('[data-dp-flik]');
    }, 5000);
    await sov(100);
    panel = q('aside.dp');
    if (!panel) {
      snapshots.push(ta('detalj', typ, null, null, { id: id, saknas: 'Panelen öppnades inte' }));
      return;
    }
    var flikar = qa('[data-dp-flik]', panel).map(function (b) { return b.dataset.dpFlik; });
    for (var i = 0; i < flikar.length; i++) {
      var f = flikar[i];
      var b = q('aside.dp [data-dp-flik="' + f + '"]');
      if (b) b.click();
      await väntaPå(function () {
        var p = q('aside.dp');
        var vald = p && p.querySelector('[data-dp-flik="' + f + '"]');
        return vald && vald.getAttribute('aria-selected') === 'true' && !laddarKvar(p).length;
      }, 3000);
      await sov(100);
      snapshots.push(ta('detalj', typ, f, q('aside.dp'), { id: id }));
    }
  }

  window.__provKor = async function () {
    window.__provKorningar = (window.__provKorningar || 0) + 1;
    var snapshots = [];
    var meta = {
      sida: location.pathname,
      skript: qa('script[src]').map(function (s) { return s.getAttribute('src'); }),
      nu: new Date().toISOString(),
      korning: window.__provKorningar,
      /* Bredden styr vad CSS visar och döljer, och därmed innerText.
         Kör före och efter i samma storlek. */
      viewport: window.innerWidth + 'x' + window.innerHeight,
      varningar: []
    };
    if (window.__provKorningar > 1) {
      meta.varningar.push('Körning nummer ' + window.__provKorningar + ' på samma sida — ladda om för en jämförbar körning.');
    }

    /* ---------- vänta in uppstarten ---------- */
    var uppe = await väntaPå(function () {
      var app = document.getElementById('view-app');
      if (!document.getElementById('view-fel').hidden) return true;
      return app && !app.hidden && q('#adm-tal .adm-kpi');
    }, 10000);
    meta.synligVy = synligVy();
    if (!uppe || meta.synligVy !== 'view-app') {
      meta.varningar.push('Adminvyn kom aldrig upp. Synlig vy: ' + meta.synligVy
        + (q('#fel-detalj') ? ' · ' + norm(q('#fel-detalj').textContent) : ''));
      meta.klar = false;
    } else {
      var lugn = await väntaPå(function () {
        if (document.readyState !== 'complete') return false;
        var k = window.__provKanal;
        if (k && k.prenumerationer > k.besked) return false;
        return !laddarKvar(q('#view-app')).length;
      }, 8000);
      /* Några varv till: realtidsbeskedet startar en räkning som själv
         är asynkron. */
      await sov(120);
      meta.klar = lugn;
      if (!lugn) {
        meta.varningar.push('Vyn blev inte helt klar inom tidsgränsen. Kvar: '
          + laddarKvar(q('#view-app')).map(function (el) {
            var s = el.closest('[id]');
            return s ? '#' + s.id : '?';
          }).join(', ')
          + ' · readyState=' + document.readyState
          + ' · kanal=' + JSON.stringify(window.__provKanal || null));
      }
    }

    var globalt = {
      titel: document.title,
      var: textAv('#adm-var'),
      sidomeny: sidomenyMärken(),
      flikmarken: flikMärken(),
      hero: textAv('#vy-hero'),
      sidhuvud: textAv('#nav-actions'),
      sidofot: textAv('#adm-sido-fot'),
      notisknapp: q('#adm-notis-knapp') ? q('#adm-notis-knapp').getAttribute('aria-label') : null,
      notiser: q('#adm-notiser') ? norm(q('#adm-notiser').textContent) : null
    };

    if (meta.klar !== false || meta.synligVy === 'view-app') {
      /* ---------- varje sektion, varje flik ---------- */
      var sektioner = qa('section[data-sek]');
      for (var i = 0; i < sektioner.length; i++) {
        var namn = sektioner[i].dataset.sek;
        var sek = await gåTill(namn);
        var flikar = qa('.vy-flikar > .vy-flik[data-flik]', sek);
        if (!flikar.length) {
          snapshots.push(ta('sektion', namn, null, sek));
          continue;
        }
        for (var j = 0; j < flikar.length; j++) {
          flikar[j].click();
          await sov(150);
          snapshots.push(ta('sektion', namn, flikar[j].dataset.flik, sek));
        }
      }

      /* ---------- detaljpanelen ---------- */
      await öppnaPanel('familjer', 'familj', snapshots);
      await öppnaPanel('studiehjalpare', 'studiehjalpare', snapshots);
      await öppnaPanel('elever', 'elev', snapshots);
      var stäng = q('aside.dp [data-dp-stang]');
      if (stäng) stäng.click();
      await sov(100);

      /* ---------- extra lägen ---------- */

      // Matchningen med den första eleven i kön vald.
      var mt = await gåTill('matchning');
      var förstaElev = q('[data-mt-elev]', mt);
      if (förstaElev) {
        förstaElev.click();
        await sov(150);
        snapshots.push(ta('extra', 'matchning', 'vald-elev', mt,
          { id: förstaElev.dataset.mtElev }));
      }

      // Djuplänk till en flik: följHash i nextrum-admin.js.
      location.hash = '#ekonomi/utbetalningar';
      var eko = q('section[data-sek="ekonomi"]');
      await väntaPå(function () { return !eko.hidden; }, 3000);
      await sov(150);
      snapshots.push(ta('extra', 'ekonomi', 'djuplank-utbetalningar', eko));

      // Globalt sök.
      var sök = q('#adm-sok');
      if (sök) {
        sök.value = 'berg';
        sök.dispatchEvent(new Event('input', { bubbles: true }));
        await sov(120);
        snapshots.push(ta('extra', 'topprad', 'sok-berg', q('#adm-sokresultat')));
        sök.value = '';
        sök.dispatchEvent(new Event('input', { bubbles: true }));
        await sov(60);
      }

      // Adminanvändare: sök efter någon att ge behörighet.
      var sys = await gåTill('system');
      var admFlik = q('.vy-flik[data-flik="adminanvandare"]', sys);
      var admSök = q('#adm-anv-sok');
      if (admFlik && admSök) {
        admFlik.click();
        await sov(100);
        admSök.value = 'ek';
        admSök.dispatchEvent(new Event('input', { bubbles: true }));
        await sov(120);
        snapshots.push(ta('extra', 'system', 'adminanvandare-sok-ek', sys));
        admSök.value = '';
        admSök.dispatchEvent(new Event('input', { bubbles: true }));
        await sov(60);
      }

      // Notispanelen öppen.
      var notisKnapp = q('#adm-notis-knapp');
      if (notisKnapp) {
        notisKnapp.click();
        await sov(120);
        snapshots.push(ta('extra', 'topprad', 'notiser-oppna', q('#adm-notiser')));
        notisKnapp.click();
        await sov(60);
      }

      // Inställningar i System, om RUT-takets formulär finns (Fas 6).
      var rtForm = q('#rt-form');
      if (rtForm) {
        var rtSek = rtForm.closest('section[data-sek]');
        await gåTill(rtSek ? rtSek.dataset.sek : 'system');
        await visaFlikFör(rtForm);
        snapshots.push(ta('extra', 'system', 'installningar', q('section[data-sek="system"]')));
      }

      // Ny uppgift (Fas 6): titeln "Prov", resten som formuläret står.
      // Sist av allt, eftersom det skriver och kan rita om annat.
      var uppgForm = q('#uppg-form');
      if (uppgForm) {
        var anm = [];
        var uSek = uppgForm.closest('section[data-sek]');
        await gåTill(uSek ? uSek.dataset.sek : 'uppgifter');
        await visaFlikFör(uppgForm);
        var titel = q('#uppg-titel');
        if (titel) {
          titel.value = 'Prov';
          titel.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          anm.push('#uppg-titel saknas');
        }
        await skicka(uppgForm, anm);
        snapshots.push(ta('extra', 'uppgifter', 'efter-ny-uppgift',
          q('section[data-sek="uppgifter"]'), { anm: anm }));
      }

      globalt.titelEfter = document.title;
      globalt.varEfter = textAv('#adm-var');
    }

    var res = {
      snapshots: snapshots,
      errors: (window.__provFel || []).slice(),
      warnings: (window.__provVarningar || []).slice(),
      anrop: (window.__provAnrop || []).slice(),
      globalt: globalt,
      meta: meta
    };
    window.__provResultat = JSON.stringify(res);
    return res;
  };

  window.__provBit = function (i, n) {
    var s = window.__provResultat || '';
    return s.slice(i * n, (i + 1) * n);
  };
})();
