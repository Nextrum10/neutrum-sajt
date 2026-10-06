/* ============================================================
   NEXTRUM — introduktionen i studievyn och studiehjälparvyn (2026-10-06)

   Leo: "skapa också en introduktion med skärmdump och förklaringar som
   finns som en funktion i både anställdas och familjernas plattform ...
   sist så är det fortsätt vilket låter en komma in på plattformen och
   börja boka lektioner, detta ska ske efter att man bekräftat sitt nya
   lösenord."

   En bild i taget ur vyn, med vad delen är till för, och Fortsätt sist.
   Den visas av sig själv första gången (NXStudie.introduktion, när
   user_metadata.valkommen står på 'intro': efter lösenordet för den som
   tagits in, och efter första inloggningen för den som registrerat
   sig), och går att öppna igen under Profil & inställningar
   (data-intro="<roll>").

   Bilderna är skärmdumpar av vyerna med påhittade familjer, tagna i en
   telefons bredd mot en falsk Supabase (verktyg/bygg-introbilder.js).
   Vägarna står i NEXTRUM_INTRO i nextrum-images.js, den enda filen där
   bildvägar står; har den inte laddat visas texten utan bild. Ändras en
   del i vyn som en bild visar: ta om bilderna, och läs texten här igen.

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
      { bild: 'oversikt', rubrik: 'Översikt',
        text: 'Här börjar ni. Överst står det som väntar på er, som en tid att svara på eller en rapport '
          + 'att bekräfta. Under det de kommande passen och hur det går.' },
      { bild: 'boka', rubrik: 'Boka pass',
        text: 'Tryck på en dag och föreslå en tid. Er studiehjälpare accepterar den eller föreslår en annan, '
          + 'och passet står sedan under Mina lektioner.' },
      { bild: 'lektioner', rubrik: 'Mina lektioner',
        text: 'Era pass, planen bakom dem och vad som hände på varje. Tryck på ett pass för att se tid, '
          + 'plats och allt om just det passet.' },
      { bild: 'bekrafta', rubrik: 'Bekräfta rapport',
        text: 'Efter varje pass skriver studiehjälparen en rapport. Läs vad ni gick igenom och bekräfta att ni '
          + 'tagit del av den. Är passet inte betalt än, bekräftar ni genom att välja hur ni betalar.' },
      { bild: 'nexlax', rubrik: 'NexLäx',
        text: 'Övningarna mellan passen, och uppgifterna från er studiehjälpare. Välj ämne och årskurs, och '
          + 'varje svar rättas direkt. Barnet kan göra dem här eller med en egen inloggning.' },
      { bild: 'meddelanden', rubrik: 'Meddelanden',
        text: 'Kontakten med er studiehjälpare. Skriv här om något ska ändras, eller om ni undrar något om '
          + 'passen.' },
      { bild: 'profil', rubrik: 'Profil & inställningar',
        text: 'Ert konto, barnen och notiserna. Under Barn skapar ni barnets egen inloggning och väljer vad '
          + 'barnet får se och göra. Introduktionen finns kvar under Konto & inloggning.' }
    ],
    studiehjalpare: [
      { bild: 'oversikt', rubrik: 'Översikt',
        text: 'Läget just nu: dina nästa pass och det som väntar på dig, som en tid att svara på eller en '
          + 'rapport att skriva. Menyn leder vidare till varje del.' },
      { bild: 'tider', rubrik: 'Föreslagna tider',
        text: 'Familjerna föreslår tider. Acceptera, avslå med några rader om varför, eller föreslå en annan '
          + 'tid. Ett accepterat pass flyttar till Lektioner & elever.' },
      { bild: 'lektioner', rubrik: 'Lektioner & elever',
        text: 'Dina pass, rapporten familjen läser, och allt om eleven du valt, som studieplanen du skriver '
          + 'efter första passet.' },
      { bild: 'rapporter', rubrik: 'Skriv rapport',
        text: 'Pass som har varit men saknar rapport. Rapporten är det familjen läser, och först med den blir '
          + 'passet en arbetad timme.' },
      { bild: 'laxor', rubrik: 'Uppgifter & material',
        text: 'Ge eleven uppgifter mellan passen, med material ur biblioteket eller en nivå i NexLäx. '
          + 'Familjen ser allt direkt.' },
      { bild: 'meddelanden', rubrik: 'Meddelanden',
        text: 'Kontakten med familjen. Samma tråd som på Översikt.' },
      { bild: 'statistik', rubrik: 'Statistik & ersättning',
        text: 'Genomförda pass, timmar och vad de gav. Ett pass räknas när rapporten är skriven.' },
      { bild: 'profil', rubrik: 'Profil & inställningar',
        text: 'Det familjer ser om dig, din inloggning, dokumenten och vilka mejl du vill ha. Introduktionen '
          + 'finns kvar här, under Min profil.' }
    ]
  };

  /* Sista raden när vyn inte är öppen än: familjen är inte matchad, eller
     studiehjälparens profil väntar på att godkännas. */
  var VÄNTAR = {
    foralder: 'Först matchar vi er med en studiehjälpare. Vi hör av oss när det är klart.',
    studiehjalpare: 'Din profil väntar på att vi godkänner den. Vi hör av oss när det är klart.'
  };

  var öppen = null;

  function bildFör(roll, nyckel) {
    var reg = window.NEXTRUM_INTRO && window.NEXTRUM_INTRO[roll];
    return (reg && reg[nyckel]) || null;
  }

  /* <picture> med webp först och jpg som reserv, som på de öppna sidorna. */
  function bildHtml(b) {
    var esc = NX.esc;
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

  /* o.roll        'foralder' eller 'studiehjalpare'
     o.sparat      lösenordet sparades nyss: första bilden säger det
     o.väntar      vyn är inte öppen än (VÄNTAR)
     o.igen        öppnad från Profil: går att stänga
     Svarar när Fortsätt (eller Stäng) trycks. */
  function visa(o) {
    o = o || {};
    var roll = STEG[o.roll] ? o.roll : 'foralder';
    var steg = STEG[roll];
    if (öppen) return öppen;

    öppen = new Promise(function (klar) {
      var esc = NX.esc;
      var nu = 0;
      var sistaFokus = document.activeElement;
      var ruta = document.createElement('div');
      ruta.className = 'nx-fraga nx-intro';
      ruta.innerHTML =
        '<div class="nx-fraga-box nx-intro-box" role="dialog" aria-modal="true" aria-labelledby="nx-intro-t"'
        + ' aria-describedby="nx-intro-text">'
        + '<div class="nx-intro-topp">'
        + '<span class="nx-intro-nr" aria-live="polite"></span>'
        + (o.igen ? '<button type="button" class="btn btn-ghost btn-sm" data-intro-stang>Stäng</button>' : '')
        + '</div>'
        + '<div class="nx-intro-mitt">'
        + '<figure class="nx-intro-bild"></figure>'
        + '<div class="nx-intro-kropp">'
        + '<p class="nx-intro-klar" hidden></p>'
        + '<h3 id="nx-intro-t"></h3>'
        + '<p id="nx-intro-text" class="nx-intro-text"></p>'
        + '<p class="nx-intro-vantar" hidden></p>'
        + '</div></div>'
        + '<div class="nx-intro-prickar" aria-hidden="true">'
        + steg.map(function () { return '<span></span>'; }).join('')
        + '</div>'
        + '<div class="nx-fraga-knappar nx-intro-knappar">'
        + '<button type="button" class="btn btn-ghost" data-intro-bak>Tillbaka</button>'
        + '<button type="button" class="btn btn-primary" data-intro-fram>Nästa</button>'
        + '</div></div>';

      var box = ruta.querySelector('.nx-intro-box');
      var bak = ruta.querySelector('[data-intro-bak]');
      var fram = ruta.querySelector('[data-intro-fram]');

      function rita() {
        var s = steg[nu], sist = nu === steg.length - 1;
        var b = bildFör(roll, s.bild);
        ruta.querySelector('.nx-intro-nr').textContent = (nu + 1) + ' av ' + steg.length;
        var fig = ruta.querySelector('.nx-intro-bild');
        fig.hidden = !b;
        fig.innerHTML = b ? bildHtml(b) : '';
        förladda(steg[nu + 1] && bildFör(roll, steg[nu + 1].bild));
        var klarRad = ruta.querySelector('.nx-intro-klar');
        klarRad.hidden = !(nu === 0 && o.sparat);
        klarRad.textContent = o.sparat ? 'Lösenordet är sparat. Välkommen till Nextrum! Så här fungerar det.' : '';
        ruta.querySelector('#nx-intro-t').textContent = s.rubrik;
        ruta.querySelector('#nx-intro-text').textContent = s.text;
        var väntar = ruta.querySelector('.nx-intro-vantar');
        väntar.hidden = !(sist && o.väntar);
        väntar.textContent = o.väntar ? VÄNTAR[roll] : '';
        ruta.querySelectorAll('.nx-intro-prickar span').forEach(function (p, i) {
          p.classList.toggle('ar-nu', i === nu);
          p.classList.toggle('ar-sedd', i < nu);
        });
        bak.disabled = nu === 0;
        fram.textContent = sist ? 'Fortsätt' : 'Nästa';
        /* Rutan börjar om överst för varje bild: på en telefon är den
           högre än skärmen, och nästa text ska läsas från början. */
        ruta.scrollTop = 0;
      }

      function stäng() {
        document.removeEventListener('keydown', tangent);
        ruta.remove();
        document.body.style.overflow = '';
        öppen = null;
        if (sistaFokus && sistaFokus.focus && document.contains(sistaFokus)) sistaFokus.focus();
        klar();
      }

      function gå(steg_) {
        var till = Math.max(0, Math.min(steg.length - 1, nu + steg_));
        if (till === nu) return;
        nu = till;
        rita();
        fram.focus();
      }

      function tangent(e) {
        if (e.key === 'Escape' && o.igen) { e.preventDefault(); stäng(); return; }
        if (e.key === 'ArrowRight' && !e.target.closest('input, textarea, select')) { e.preventDefault(); gå(1); return; }
        if (e.key === 'ArrowLeft' && !e.target.closest('input, textarea, select')) { e.preventDefault(); gå(-1); return; }
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
        if (e.target.closest('[data-intro-bak]')) { gå(-1); return; }
        if (e.target.closest('[data-intro-fram]')) {
          if (nu === steg.length - 1) stäng(); else gå(1);
        }
      });
      document.addEventListener('keydown', tangent);

      rita();
      document.body.appendChild(ruta);
      document.body.style.overflow = 'hidden';
      void ruta.offsetWidth;
      ruta.classList.add('open');
      fram.focus();
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
