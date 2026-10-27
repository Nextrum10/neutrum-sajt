/* ============================================================
   NEXTRUM — introduktionen i studievyn och studiehjälparvyn (2026-10-06)

   Leo: "skapa också en introduktion med skärmdump och förklaringar som
   finns som en funktion i både anställdas och familjernas plattform ...
   sist så är det fortsätt vilket låter en komma in på plattformen och
   börja boka lektioner, detta ska ske efter att man bekräftat sitt nya
   lösenord."

   Den visas av sig själv första gången (NXStudie.introduktion, när
   user_metadata.valkommen står på 'intro': efter lösenordet för den som
   tagits in), och går att öppna igen under Profil & inställningar
   (data-intro="<roll>"). Profilens steg säger var man loggar in nästa
   gång (2026-10-07): inloggningen är en för alla, och kontot avgör vyn.

   RÖRELSEN (2026-10-27, Leo: "Introduktionen till studievyn ska vara
   coolare tänk dig en introduktion som använder motion graphic för att
   leda kunden genom studievyn"). Fyra sorters steg:
     valkommen  vyns delar som en karta: märket, och menyns delar med
                sina ikoner (ur vyns egen meny) som flyger in en i taget.
                Ett tryck på en del går till dess steg.
     del        skärmdumpen zoomar långsamt mot det viktigaste i delen,
                en ring pulserar runt det och ett tryck syns där (ring:
                x, y, bredd och höjd i procent av bilden).
     hem        sist, på en telefon som inte redan har vyn som app:
                telefonen ur NXHemskarm som visar hur vyn läggs på
                hemskärmen (Leo samma dag: en ruta om det, och samma
                guide under Profil).
   Överst ett band med ett streck per steg, som Instagrams berättelser.
   Steget glider in från det håll man går åt. Skriptet sätter klasser
   och data-attribut, CSS rör sig (nextrum-vy.css, INTRODUKTIONEN), och
   med rörelse bortvald står allt stilla.

   KNAPPARNA STÅR STILLA: rutan har samma höjd i varje steg (scenen tar
   resten och rullar inom sig om texten inte ryms), så Nästa flyttar sig
   aldrig under fingret.

   Bilderna är skärmdumpar av vyerna med påhittade familjer, tagna i en
   telefons bredd mot en falsk Supabase (verktyg/bygg-introbilder.js).
   Vägarna står i NEXTRUM_INTRO i nextrum-images.js, den enda filen där
   bildvägar står; har den inte laddat visas texten utan bild. Ändras en
   del i vyn som en bild visar: ta om bilderna, och läs texten och
   ringen här igen.

   Texterna säger bara det vyn själv säger. Betalningen beskrivs inte
   här: villkoren står på de ställen kolla-betalningsvillkor.py räknar,
   och en mening till om hur man betalar vore ett ställe till att glömma.

   Första gången går rutan bara framåt och bakåt: Fortsätt sist är vägen
   in, som Leo bad om. Öppnad igen går den att stänga när som helst.
   ============================================================ */
(function () {
  'use strict';

  var STEG = {
    foralder: [
      { bild: 'oversikt', sek: 'oversikt', rubrik: 'Översikt', ring: [5, 25, 90, 58],
        text: 'Här börjar ni. Överst står det som väntar på er, som en tid att svara på eller ett pass att '
          + 'betala. Under det de kommande passen och hur det går.' },
      { bild: 'boka', sek: 'boka', rubrik: 'Boka pass', ring: [10, 16, 83, 19],
        text: 'Tryck på en dag och föreslå en tid. Er studiehjälpare accepterar den eller föreslår en annan, '
          + 'och passet står sedan under Mina lektioner.' },
      { bild: 'lektioner', sek: 'lektioner', rubrik: 'Mina lektioner', ring: [8, 43, 86, 29],
        text: 'Era pass, planen bakom dem och vad som hände på varje. Dagen är gul medan en tid väntar på svar, '
          + 'röd när passet ska betalas och grön när det är betalt. Tryck på ett pass för allt om det.' },
      { bild: 'betalning', sek: 'betalning', rubrik: 'Betalning & planer', ring: [4, 16, 93, 29],
        text: 'Vad som är att betala och vad som är betalt, med knappen Betala nu vid varje pass. Under dem '
          + 'planerna och er timbank.' },
      { bild: 'nexlax', sek: 'nexlax', rubrik: 'NexLäx', ring: [8, 46, 85, 26],
        text: 'Övningarna mellan passen, och uppgifterna från er studiehjälpare. Välj ämne och årskurs, och '
          + 'varje svar rättas direkt. Barnet kan göra dem här eller med en egen inloggning.' },
      { bild: 'meddelanden', sek: 'meddelanden', rubrik: 'Meddelanden', ring: [10, 25, 85, 53],
        text: 'Kontakten med er studiehjälpare. Skriv här om något ska ändras, eller om ni undrar något om '
          + 'passen.' },
      { bild: 'profil', sek: 'profil', rubrik: 'Profil & inställningar', ring: [5, 30, 90, 26],
        text: 'Ert konto, barnen och notiserna. Under Barn skapar ni barnets egen inloggning och väljer vad '
          + 'barnet får se och göra. Nästa gång loggar ni in under Logga in på nextrum.se, och barnet på samma '
          + 'ställe med sitt användarnamn. Introduktionen finns kvar under Konto & inloggning.' }
    ],
    studiehjalpare: [
      { bild: 'oversikt', sek: 'oversikt', rubrik: 'Översikt', ring: [4, 40, 92, 40],
        text: 'Läget just nu: dina nästa pass och det som väntar på dig, som en tid att svara på eller en '
          + 'rapport att skriva. Menyn leder vidare till varje del.' },
      { bild: 'tider', sek: 'tider', rubrik: 'Föreslagna tider', ring: [9, 60, 85, 33],
        text: 'Familjerna föreslår tider. Acceptera, avslå med några rader om varför, eller föreslå en annan '
          + 'tid. Ett accepterat pass flyttar till Lektioner & elever.' },
      { bild: 'lektioner', sek: 'lektioner', rubrik: 'Lektioner & elever', ring: [9, 66, 85, 27],
        text: 'Dina pass, rapporten familjen läser, och allt om eleven du valt, som studieplanen du skriver '
          + 'efter första passet.' },
      { bild: 'rapporter', sek: 'rapporter', rubrik: 'Skriv rapport', ring: [9, 55, 85, 31],
        text: 'Pass som har varit men saknar rapport. Rapporten är det familjen läser, och först med den blir '
          + 'passet en arbetad timme.' },
      { bild: 'laxor', sek: 'laxor', rubrik: 'Uppgifter & material', ring: [9, 60, 55, 30],
        text: 'Ge eleven uppgifter mellan passen, med material ur biblioteket eller en nivå i NexLäx. '
          + 'Familjen ser allt direkt.' },
      { bild: 'meddelanden', sek: 'meddelanden', rubrik: 'Meddelanden', ring: [9, 39, 82, 43],
        text: 'Kontakten med familjen. Samma tråd som på Översikt.' },
      { bild: 'statistik', sek: 'statistik', rubrik: 'Statistik & ersättning', ring: [9, 66, 82, 25],
        text: 'Genomförda pass, timmar och vad de gav. Ett pass räknas när rapporten är skriven.' },
      { bild: 'profil', sek: 'profil', rubrik: 'Profil & inställningar', ring: [6, 37, 88, 50],
        text: 'Det familjer ser om dig, din inloggning, dokumenten och vilka mejl du vill ha. Nästa gång loggar '
          + 'du in under Logga in på nextrum.se. Introduktionen finns kvar här, under Min profil.' }
    ]
  };

  /* Sista raden när något väntar på oss: familjen är inte matchad (vyn är
     öppen, men bokningen och köpen väntar, 2026-10-07), eller
     studiehjälparens profil väntar på att godkännas. */
  var VÄNTAR = {
    foralder: 'Boka pass och Meddelanden öppnas när vi matchat er med en studiehjälpare, och vi hör av oss när det är klart. '
      + 'Barnen, NexLäx och profilen kan ni använda redan nu.',
    studiehjalpare: 'Din profil väntar på att vi godkänner den. Vi hör av oss när det är klart.'
  };

  var VAD = { foralder: 'studievyn', studiehjalpare: 'studiehjälparvyn' };

  var öppen = null;

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function lugnt() {
    try { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  function bildFör(roll, nyckel) {
    var reg = window.NEXTRUM_INTRO && window.NEXTRUM_INTRO[roll];
    return (reg && reg[nyckel]) || null;
  }

  /* <picture> med webp först och jpg som reserv, som på de öppna sidorna. */
  function bildHtml(b) {
    return '<picture><source type="image/webp" srcset="bilder/' + esc(b.file) + '.webp">'
      + '<img src="bilder/' + esc(b.file) + '.jpg" alt="' + esc(b.alt) + '" width="' + esc(b.w)
      + '" height="' + esc(b.h) + '" decoding="async"></picture>';
  }

  /* Laddar nästa bild i förväg, så att Nästa inte väntar på nätet. */
  function förladda(b) {
    if (!b) return;
    var i = new Image();
    i.decoding = 'async';
    i.src = 'bilder/' + b.file + (window.HTMLPictureElement ? '.webp' : '.jpg');
  }

  /* Ikonen för en del, ur vyns egen meny: samma tecken som eleven sedan
     letar efter. Saknas den står bara namnet. */
  function ikonFör(sek) {
    var a = document.querySelector('#vy-sido a[data-sek="' + sek + '"] svg, .vy-sido a[data-sek="' + sek + '"] svg');
    return a ? a.outerHTML : '';
  }

  /* Hemskärmens steg finns bara där det går att göra något: på en
     telefon, inte redan som app, och med NXHemskarm laddad. */
  function medHem() {
    if (typeof NXHemskarm === 'undefined' || !NXHemskarm.scen) return false;
    if (NXHemskarm.somApp && NXHemskarm.somApp()) return false;
    try { return !!(window.matchMedia && matchMedia('(pointer: coarse)').matches); } catch (e) { return false; }
  }
  function plattform() {
    var ua = String(navigator.userAgent || '');
    return /Android/.test(ua) ? 'android' : 'ios';
  }

  /* o.roll        'foralder' eller 'studiehjalpare'
     o.sparat      första gången (lösenordet valdes nyss): välkomststeget
                   hälsar välkommen.
     o.väntar      vyn är inte öppen än (VÄNTAR)
     o.igen        öppnad från Profil: går att stänga
     Svarar när Fortsätt (eller Stäng) trycks. */
  function visa(o) {
    o = o || {};
    var roll = STEG[o.roll] ? o.roll : 'foralder';
    if (öppen) return öppen;

    var delar = STEG[roll];
    var alla = [{ typ: 'valkommen' }].concat(delar.map(function (d) { return { typ: 'del', d: d }; }));
    if (medHem()) alla.push({ typ: 'hem' });

    öppen = new Promise(function (klar) {
      var nu = 0;
      var sistaFokus = document.activeElement;
      var ruta = document.createElement('div');
      ruta.className = 'nx-fraga nx-intro';
      ruta.innerHTML =
        '<div class="nx-fraga-box nx-intro-box" role="dialog" aria-modal="true" aria-labelledby="nx-intro-t"'
        + ' aria-describedby="nx-intro-text">'
        + '<div class="nx-intro-topp">'
        + '<div class="ni-band" aria-hidden="true">' + alla.map(function () { return '<i></i>'; }).join('') + '</div>'
        + '<div class="ni-topprad">'
        + '<span class="nx-intro-nr" aria-live="polite"></span>'
        + (o.igen ? '<button type="button" class="btn btn-ghost btn-sm" data-intro-stang>Stäng</button>' : '')
        + '</div></div>'
        + '<div class="nx-intro-scen"></div>'
        + '<div class="nx-fraga-knappar nx-intro-knappar">'
        + '<button type="button" class="btn btn-ghost" data-intro-bak>Tillbaka</button>'
        + '<button type="button" class="btn btn-primary" data-intro-fram>Nästa</button>'
        + '</div></div>';

      var box = ruta.querySelector('.nx-intro-box');
      var scen = ruta.querySelector('.nx-intro-scen');
      var bak = ruta.querySelector('[data-intro-bak]');
      var fram = ruta.querySelector('[data-intro-fram]');

      function välkommen() {
        var karta = delar.map(function (d, i) {
          return '<button type="button" class="ni-del" data-intro-ga="' + (i + 1) + '" style="--i:' + i + '">'
            + '<span class="ni-del-ik" aria-hidden="true">' + ikonFör(d.sek) + '</span>'
            + '<span>' + esc(d.rubrik) + '</span></button>';
        }).join('');
        return '<div class="ni-valkommen">'
          + '<span class="ni-mark" aria-hidden="true"><img src="/apple-touch-icon.png" alt="" width="60" height="60"></span>'
          + (o.sparat ? '<p class="nx-intro-klar">Välkommen till Nextrum!</p>' : '')
          + '<h3 id="nx-intro-t">Så fungerar ' + esc(VAD[roll]) + '</h3>'
          + '<p id="nx-intro-text" class="nx-intro-text">' + delar.length + ' delar, och menyn leder till var och en. '
          + 'Gå igenom dem med Nästa, eller tryck på en del.</p>'
          + '<div class="ni-karta">' + karta + '</div>'
          + '</div>';
      }

      function del(d, sist) {
        var b = bildFör(roll, d.bild);
        var r = d.ring || [10, 30, 80, 30];
        var mitt = (r[0] + r[2] / 2) + '% ' + (r[1] + r[3] / 2) + '%';
        return '<div class="nx-intro-mitt">'
          + (b
            ? '<figure class="nx-intro-bild"><div class="ni-zoom" style="transform-origin:' + mitt + '">'
              + bildHtml(b)
              + '<span class="ni-ring" aria-hidden="true" style="left:' + r[0] + '%;top:' + r[1] + '%;width:' + r[2] + '%;height:' + r[3] + '%"></span>'
              + '<span class="ni-tryck" aria-hidden="true" style="left:' + (r[0] + r[2] / 2) + '%;top:' + (r[1] + r[3] / 2) + '%"></span>'
              + '</div></figure>'
            : '')
          + '<div class="nx-intro-kropp">'
          + '<span class="ni-chip"><span class="ni-del-ik" aria-hidden="true">' + ikonFör(d.sek) + '</span>' + esc(d.rubrik) + '</span>'
          + '<h3 id="nx-intro-t">' + esc(d.rubrik) + '</h3>'
          + '<p id="nx-intro-text" class="nx-intro-text">' + esc(d.text) + '</p>'
          + (sist && o.väntar ? '<p class="nx-intro-vantar">' + esc(VÄNTAR[roll]) + '</p>' : '')
          + '</div></div>';
      }

      function hem(sist) {
        return '<div class="nx-intro-mitt ni-hem">'
          + '<figure class="nx-intro-bild ni-hem-fig">' + NXHemskarm.scen(plattform()) + '</figure>'
          + '<div class="nx-intro-kropp">'
          + '<span class="ni-chip">Tips</span>'
          + '<h3 id="nx-intro-t">Lägg ' + esc(VAD[roll]) + ' på hemskärmen</h3>'
          + '<p id="nx-intro-text" class="nx-intro-text">Då öppnar du den med ett tryck, som en app och utan adressfältet. '
          + 'Telefonen visar hur. Hela guiden, för iPhone och Android, finns under Profil &amp; inställningar.</p>'
          + (sist && o.väntar ? '<p class="nx-intro-vantar">' + esc(VÄNTAR[roll]) + '</p>' : '')
          + '</div></div>';
      }

      function rita(rikt) {
        var s = alla[nu], sist = nu === alla.length - 1;
        scen.innerHTML = s.typ === 'valkommen' ? välkommen() : s.typ === 'hem' ? hem(sist) : del(s.d, sist);
        scen.setAttribute('data-typ', s.typ);
        /* Klassen sätts om för varje steg, så att inträdet spelas igen. */
        scen.classList.remove('ni-in');
        scen.setAttribute('data-rikt', rikt || 'fram');
        void scen.offsetWidth;
        scen.classList.add('ni-in');
        scen.scrollTop = 0;
        if (s.typ === 'hem') NXHemskarm.spela(scen.querySelector('.ni-hem-fig'));
        var näst = alla[nu + 1];
        if (näst && näst.typ === 'del') förladda(bildFör(roll, näst.d.bild));
        ruta.querySelector('.nx-intro-nr').textContent = (nu + 1) + ' av ' + alla.length;
        ruta.querySelectorAll('.ni-band i').forEach(function (p, i) {
          p.classList.toggle('nu', i === nu);
          p.classList.toggle('sedd', i < nu);
        });
        bak.disabled = nu === 0;
        fram.textContent = sist ? 'Fortsätt' : 'Nästa';
      }

      function stäng() {
        document.removeEventListener('keydown', tangent);
        ruta.remove();
        document.body.style.overflow = '';
        öppen = null;
        if (sistaFokus && sistaFokus.focus && document.contains(sistaFokus)) sistaFokus.focus();
        klar();
      }

      function till(i) {
        var mål = Math.max(0, Math.min(alla.length - 1, i));
        if (mål === nu) return;
        var rikt = mål > nu ? 'fram' : 'bak';
        nu = mål;
        rita(rikt);
        fram.focus({ preventScroll: true });
      }

      function tangent(e) {
        if (e.key === 'Escape' && o.igen) { e.preventDefault(); stäng(); return; }
        if (e.key === 'ArrowRight' && !e.target.closest('input, textarea, select')) { e.preventDefault(); till(nu + 1); return; }
        if (e.key === 'ArrowLeft' && !e.target.closest('input, textarea, select')) { e.preventDefault(); till(nu - 1); return; }
        if (e.key === 'Tab') {
          var kan = Array.prototype.filter.call(box.querySelectorAll('button'), function (k) { return !k.disabled; });
          if (!kan.length) return;
          var f = kan[0], s = kan[kan.length - 1];
          if (e.shiftKey && document.activeElement === f) { e.preventDefault(); s.focus(); }
          else if (!e.shiftKey && document.activeElement === s) { e.preventDefault(); f.focus(); }
        }
      }

      ruta.addEventListener('click', function (e) {
        if (e.target.closest('[data-intro-stang]')) { stäng(); return; }
        if (e.target.closest('[data-intro-bak]')) { till(nu - 1); return; }
        var ga = e.target.closest('[data-intro-ga]');
        if (ga) { till(Number(ga.getAttribute('data-intro-ga'))); return; }
        if (e.target.closest('[data-intro-fram]')) {
          if (nu === alla.length - 1) stäng(); else till(nu + 1);
        }
      });
      document.addEventListener('keydown', tangent);

      if (lugnt()) ruta.classList.add('ni-lugn');
      rita('fram');
      document.body.appendChild(ruta);
      document.body.style.overflow = 'hidden';
      void ruta.offsetWidth;
      ruta.classList.add('open');
      fram.focus({ preventScroll: true });
    });
    return öppen;
  }

  /* Öppnas igen från knappen under Profil & inställningar. */
  document.addEventListener('click', function (e) {
    var k = e.target.closest('[data-intro]');
    if (!k) return;
    visa({ roll: k.getAttribute('data-intro'), igen: true });
  });

  window.NXIntro = { visa: visa, STEG: STEG };
})();
