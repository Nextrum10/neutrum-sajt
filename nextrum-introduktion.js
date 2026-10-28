/* ============================================================
   NEXTRUM — rundturen i studievyn och studiehjälparvyn (2026-10-06,
   en rundtur i den riktiga vyn sedan 2026-10-27)

   Leo: "skapa också en introduktion med skärmdump och förklaringar som
   finns som en funktion i både anställdas och familjernas plattform ...
   sist så är det fortsätt vilket låter en komma in på plattformen och
   börja boka lektioner, detta ska ske efter att man bekräftat sitt nya
   lösenord."

   Samma dag som den fick skärmdumpar med rörelse (Leo 2026-10-27:
   "introduktionen du gjorde på studievyerna var kassa ... de skulle gå
   igenom en introduktion genom vyn i systemet snyggt ... live när man är
   inne i vyn första gången, och lite då och då ploppar de upp små rutor
   med två meningars beskrivningar, och att man går vidare genom att bara
   trycka var som helst på skärmen"). Nu är det vyn själv som visas:
   rundturen byter sektion med vyns egen meny, tonar ner allt utom det
   den pratar om (ett hål i en mörk hinna, som glider mellan stegen) och
   låter en liten ruta med två meningar ploppa upp bredvid. Ett tryck var
   som helst går vidare. Inga skärmdumpar längre, så inget att ta om när
   en del i vyn ändras: hålet mäts mot det som står där.

   Den visas av sig själv första gången (NXStudie.introduktion, när
   user_metadata.valkommen står på 'intro'), när vyn står färdig, och
   går att gå igen under Profil & inställningar (data-intro="<roll>").
   En studiehjälpare vars profil inte är godkänd har ingen vy att gå
   runt i; rundturen väntar då tills den är det.

   Första gången går den bara framåt (och bakåt med pilarna): sista
   trycket är vägen in, som Leo bad om. Gången igen går den att stänga.

   Texterna säger bara det vyn själv säger. Betalningen beskrivs inte
   här: villkoren står på de ställen kolla-betalningsvillkor.py räknar,
   och en mening till om hur man betalar vore ett ställe till att glömma.

   Skriptet sätter klasser och var hålet och rutan står, en gång per
   steg; CSS glider och ploppar (nextrum-vy.css, RUNDTUREN). Med rörelse
   bortvald står allt stilla.
   ============================================================ */
(function () {
  'use strict';

  var STEG = {
    foralder: [
      { sek: 'oversikt', rubrik: 'Översikt',
        text: 'Här börjar ni varje gång. Överst står det som väntar på er, och under det de kommande passen.' },
      { sek: 'boka', rubrik: 'Boka pass',
        text: 'Tryck på en dag och föreslå en tid. Er studiehjälpare accepterar den eller föreslår en annan.' },
      { sek: 'lektioner', rubrik: 'Mina lektioner',
        text: 'Era pass, studieplanen och rapporterna. Dagen är gul medan en tid väntar på svar, röd när passet '
          + 'ska betalas och grön när det är betalt.' },
      { sek: 'nexlax', rubrik: 'NexLäx',
        text: 'Övningarna mellan passen, där varje svar rättas direkt. Barnet kan göra dem här eller med en egen '
          + 'inloggning.' },
      { sek: 'meddelanden', rubrik: 'Meddelanden',
        text: 'Här skriver ni till er studiehjälpare. Skriv om något ska ändras eller om ni undrar något.' },
      { sek: 'betalning', rubrik: 'Betalning & planer',
        text: 'Det som är att betala, med Betala nu vid varje pass, och det som är betalt. Under det planerna och '
          + 'er timbank.' },
      { sek: 'profil', rubrik: 'Profil & inställningar',
        text: 'Ert konto, notiserna och barnen, där ni skapar barnets egen inloggning. Rundturen finns kvar under '
          + 'Konto & inloggning.' }
    ],
    studiehjalpare: [
      { sek: 'oversikt', rubrik: 'Översikt',
        text: 'Läget just nu: dina nästa pass och det som väntar på dig. Härifrån leder menyn vidare.' },
      { sek: 'lektioner', rubrik: 'Lektioner & elever',
        text: 'Dina pass och allt om eleven du valt. Här skriver du också studieplanen efter första passet.' },
      { sek: 'tider', rubrik: 'Föreslagna tider',
        text: 'Familjerna föreslår tider, och du accepterar, avslår eller föreslår en annan. Ett accepterat pass '
          + 'flyttar till Lektioner & elever.' },
      { sek: 'rapporter', rubrik: 'Skriv rapport',
        text: 'Pass som har varit men saknar rapport. Först med rapporten blir passet en arbetad timme.' },
      { sek: 'laxor', rubrik: 'Uppgifter & material',
        text: 'Ge eleven uppgifter mellan passen, med material ur biblioteket eller en nivå i NexLäx. Familjen ser '
          + 'dem direkt.' },
      { sek: 'meddelanden', rubrik: 'Meddelanden',
        text: 'Kontakten med familjen. Samma tråd som på Översikt.' },
      { sek: 'statistik', rubrik: 'Statistik & ersättning',
        text: 'Genomförda pass, timmar och vad de gav. Ett pass räknas när rapporten är skriven.' },
      { sek: 'profil', rubrik: 'Profil & inställningar',
        text: 'Det familjer ser om dig, dina dokument och vilka mejl du vill ha. Rundturen finns kvar under Min '
          + 'profil.' }
    ]
  };

  /* Sista rutan när något väntar på oss: familjen är inte matchad (vyn
     är öppen, men bokningen och köpen väntar, 2026-10-07). */
  var VÄNTAR = {
    foralder: 'Boka pass och Meddelanden öppnas när vi matchat er med en studiehjälpare, och vi hör av oss när det '
      + 'är klart.'
  };

  var VAD = { foralder: 'studievyn', studiehjalpare: 'studiehjälparvyn' };
  var NI = { foralder: { er: 'er', ni: 'ni' }, studiehjalpare: { er: 'dig', ni: 'du' } };

  var öppen = null;

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function lugnt() {
    try { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function synlig(el) { return !!(el && el.getClientRects().length); }

  function menylänk(sek) { return document.querySelector('#vy-sido a[data-sek="' + sek + '"]'); }
  function sektion(sek) { return document.querySelector('section.vy-sek[data-sek="' + sek + '"]'); }

  /* Byter sektion som om man tryckt i menyn: NXStudie.sidomeny lyssnar
     på trycket, och allt den gör vid ett byte (adressen, pillen,
     hämtningarna) blir gjort. */
  function gåTill(sek) {
    var a = menylänk(sek);
    if (a && !a.classList.contains('ar-har')) a.click();
  }

  function täckt() {
    return typeof NXStudie !== 'undefined' && NXStudie.täcktÖverst ? NXStudie.täcktÖverst() : 72;
  }
  function scrolla(y) {
    if (typeof NXStudie !== 'undefined' && NXStudie.scrollaTill) NXStudie.scrollaTill(y);
    else window.scrollTo(0, Math.max(0, y));
  }

  /* Det hålet ramar in: det första som syns i sektionen (rubriken, och
     i NexLäx kortet, för där är rubriken dold) och det som står under
     det, men aldrig längre ner än tak, så att rutan alltid får plats
     under. Mäts när sektionen glidit klart (vy-in). */
  function ram(sek, tak) {
    var s = sektion(sek);
    if (!synlig(s)) return null;
    var barn = Array.prototype.filter.call(s.children, function (el) {
      var r = el.getBoundingClientRect();
      return r.height > 8 && r.width > 8;
    });
    if (!barn.length) return null;
    var r = barn[0].getBoundingClientRect();
    var botten = barn[1] ? barn[1].getBoundingClientRect().bottom : r.bottom;
    var max = Math.max(r.top + 90, Math.min(tak, r.top + window.innerHeight * 0.46));
    return { top: r.top, left: r.left, right: r.right, bottom: Math.min(Math.max(r.bottom, botten), max) };
  }

  /* o.roll        'foralder' eller 'studiehjalpare'
     o.sparat      första gången (lösenordet valdes nyss)
     o.väntar      något väntar på oss (VÄNTAR)
     o.igen        öppnad från Profil: går att stänga, och slutar där
     Svarar när sista trycket är gjort (eller Stäng). */
  function visa(o) {
    o = o || {};
    var roll = STEG[o.roll] ? o.roll : 'foralder';
    if (öppen) return öppen;

    /* Bara delarna som finns i den här vyn: en sektion som är dold för
       inloggningen hoppas över. */
    var delar = STEG[roll].filter(function (d) { return synlig(menylänk(d.sek)) || synlig(sektion(d.sek)); });
    var alla = [{ typ: 'start' }].concat(delar.map(function (d) { return { typ: 'del', d: d }; }), [{ typ: 'slut' }]);
    var nav = document.getElementById('vy-sido');
    var startSek = (nav && nav.querySelector('a.ar-har')) ? nav.querySelector('a.ar-har').getAttribute('data-sek') : 'oversikt';
    var p = NI[roll];

    öppen = new Promise(function (klar) {
      var nu = -1;
      var vänta = 0;
      var sistaFokus = document.activeElement;

      var tur = document.createElement('div');
      tur.className = 'nx-intro nx-tur';
      if (lugnt()) tur.classList.add('nt-lugn');
      tur.innerHTML =
        '<div class="nt-hal" aria-hidden="true"></div>'
        + '<div class="nt-yta" aria-hidden="true"></div>'
        + '<div class="nt-ruta" role="dialog" aria-modal="true" aria-labelledby="nt-t" aria-describedby="nt-text" tabindex="-1">'
        + '<div class="nt-inne"></div></div>';
      var hål = tur.querySelector('.nt-hal');
      var ruta = tur.querySelector('.nt-ruta');
      var inne = tur.querySelector('.nt-inne');

      function prickar() {
        return '<span class="nt-prickar" aria-hidden="true">' + delar.map(function (d, i) {
          return '<i class="' + (i + 1 < nu ? 'sedd' : i + 1 === nu ? 'nu' : '') + '"></i>';
        }).join('') + '</span>';
      }

      function innehåll(s) {
        var sist = s.typ === 'slut';
        var stäng = o.igen && !sist ? '<button type="button" class="nt-stang" data-tur-stang>Stäng</button>' : '';
        if (s.typ === 'start') {
          return '<span class="nt-mark" aria-hidden="true"><img src="/apple-touch-icon.png" alt="" width="52" height="52"></span>'
            + (o.sparat ? '<p class="nt-klar">Välkommen till Nextrum!</p>' : '')
            + '<h3 id="nt-t">Vi visar ' + p.er + ' runt i ' + esc(VAD[roll]) + '</h3>'
            + '<p id="nt-text">' + delar.length + ' delar, en i taget, i den riktiga vyn. Tryck var som helst på '
            + 'skärmen för att gå vidare.</p>'
            + '<div class="nt-fot"><span class="nt-tips">Tryck för att börja</span>' + stäng + '</div>';
        }
        if (sist) {
          return '<h3 id="nt-t">Nu är ' + p.ni + ' igång</h3>'
            + '<p id="nt-text">Menyn leder till varje del, och Översikt säger vad som väntar. Nästa gång loggar '
            + p.ni + ' in under Logga in på nextrum.se.</p>'
            + (o.väntar && VÄNTAR[roll] ? '<p class="nt-vantar">' + esc(VÄNTAR[roll]) + '</p>' : '')
            + '<div class="nt-fot"><span class="nt-tips">Tryck för att ' + (o.igen ? 'stänga' : 'börja') + '</span></div>';
        }
        return '<span class="nt-et">' + nu + ' av ' + delar.length + '</span>'
          + '<h3 id="nt-t">' + esc(s.d.rubrik) + '</h3>'
          + '<p id="nt-text">' + esc(s.d.text) + '</p>'
          + '<div class="nt-fot">' + prickar() + stäng + '</div>';
      }

      /* Rutan ploppar upp under hålet, eller över det om det inte ryms,
         och står annars mitt på skärmen (första och sista). */
      function läggRuta(r) {
        var vb = window.innerWidth, vh = window.innerHeight, kant = 12;
        var b = Math.min(360, vb - kant * 2);
        ruta.style.width = b + 'px';
        if (!r) {
          ruta.style.left = Math.round((vb - b) / 2) + 'px';
          ruta.style.top = Math.round(Math.max(kant, (vh - ruta.offsetHeight) / 2)) + 'px';
          ruta.removeAttribute('data-sida');
          return;
        }
        var h = ruta.offsetHeight;
        var mitt = (r.left + r.right) / 2;
        var x = Math.max(kant, Math.min(vb - b - kant, mitt - b / 2));
        var y, sida;
        if (r.bottom + 14 + h <= vh - kant) { y = r.bottom + 14; sida = 'under'; }
        else if (r.top - 14 - h >= täckt()) { y = r.top - 14 - h; sida = 'over'; }
        else { y = vh - h - kant; sida = 'under'; }
        ruta.style.left = Math.round(x) + 'px';
        ruta.style.top = Math.round(y) + 'px';
        ruta.setAttribute('data-sida', sida);
        ruta.style.setProperty('--pil', Math.round(Math.max(18, Math.min(b - 18, mitt - x))) + 'px');
      }

      function läggHål(r) {
        if (!r) { tur.classList.remove('har-hal'); return; }
        var luft = 10;
        hål.style.left = Math.round(r.left - luft) + 'px';
        hål.style.top = Math.round(r.top - luft) + 'px';
        hål.style.width = Math.round(r.right - r.left + luft * 2) + 'px';
        hål.style.height = Math.round(r.bottom - r.top + luft * 2) + 'px';
        tur.classList.add('har-hal');
      }

      /* Innehållet ritas i den dolda rutan först, så att dess höjd är
         känd när hålet mäts: hålet slutar där rutan får plats under. */
      function förbered(s) {
        inne.innerHTML = innehåll(s);
        ruta.style.width = Math.min(360, window.innerWidth - 24) + 'px';
        return window.innerHeight - ruta.offsetHeight - 12 - 14 - 10;
      }

      function plopp(r) {
        läggRuta(r);
        ruta.classList.remove('nt-upp');
        void ruta.offsetWidth;
        ruta.classList.add('nt-upp');
        ruta.focus({ preventScroll: true });
      }

      function lyftMeny(sek) {
        if (!nav) return;
        nav.querySelectorAll('a.nt-pek').forEach(function (a) { a.classList.remove('nt-pek'); });
        nav.classList.toggle('nt-lyft', !!sek);
        var a = sek && menylänk(sek);
        if (a) {
          a.classList.add('nt-pek');
          /* På en telefon är menyn en rad man sveper i: posten rullas
             fram i raden, aldrig sidan. */
          if (nav.scrollWidth > nav.clientWidth) {
            nav.scrollTo({ left: a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2, behavior: lugnt() ? 'auto' : 'smooth' });
          }
        }
      }

      function rita() {
        var s = alla[nu];
        clearTimeout(vänta);
        ruta.classList.remove('nt-upp');
        if (s.typ !== 'del') {
          lyftMeny(null);
          läggHål(null);
          if (s.typ === 'slut') gåTill(o.igen ? startSek : 'oversikt');
          if (s.typ === 'slut' || s.typ === 'start') scrolla(0);
          vänta = setTimeout(function () { förbered(s); plopp(null); }, s.typ === 'start' ? 120 : 260);
          return;
        }
        var byter = !menylänk(s.d.sek) || !menylänk(s.d.sek).classList.contains('ar-har');
        gåTill(s.d.sek);
        lyftMeny(s.d.sek);
        /* Sektionen glider in (vy-in, .46 s): hålet mäts och sidan
           rullas när den står still, och rutan ploppar efter hålet. */
        vänta = setTimeout(function () {
          var tak = förbered(s);
          var r0 = ram(s.d.sek, Infinity);
          if (r0 && Math.abs(r0.top - täckt() - 18) > 4) scrolla(window.scrollY + r0.top - täckt() - 18);
          var r = ram(s.d.sek, tak);
          läggHål(r);
          vänta = setTimeout(function () { plopp(r); }, lugnt() ? 0 : 280);
        }, byter && !lugnt() ? 480 : 40);
      }

      function stäng() {
        clearTimeout(vänta);
        document.removeEventListener('keydown', tangent, true);
        window.removeEventListener('resize', omRita);
        lyftMeny(null);
        tur.classList.remove('open');
        setTimeout(function () { tur.remove(); }, lugnt() ? 0 : 220);
        öppen = null;
        if (o.igen) gåTill(startSek);
        if (sistaFokus && sistaFokus.focus && document.contains(sistaFokus)) sistaFokus.focus({ preventScroll: true });
        klar();
      }

      function till(i) {
        if (i >= alla.length) { stäng(); return; }
        var mål = Math.max(0, i);
        if (mål === nu) return;
        nu = mål;
        rita();
      }

      function omRita() {
        var s = alla[nu];
        if (!s) return;
        var r = s.typ === 'del' ? ram(s.d.sek, window.innerHeight - ruta.offsetHeight - 36) : null;
        läggHål(r);
        läggRuta(r);
      }

      function tangent(e) {
        if (e.key === 'Escape' && o.igen) { e.preventDefault(); e.stopPropagation(); stäng(); return; }
        if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
          if (e.target.closest && e.target.closest('[data-tur-stang]')) return;
          e.preventDefault(); e.stopPropagation(); till(nu + 1); return;
        }
        if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); till(nu - 1); return; }
        if (e.key === 'Tab') {
          /* Fokus stannar i rutan, som i de andra rutorna. */
          var k = ruta.querySelector('[data-tur-stang]');
          e.preventDefault();
          (document.activeElement === ruta && k ? k : ruta).focus({ preventScroll: true });
        }
      }

      /* Ett tryck var som helst går vidare (Leo), utom på Stäng. Hinnan
         tar trycket, så inget i vyn under trycks av misstag. */
      tur.addEventListener('click', function (e) {
        if (e.target.closest('[data-tur-stang]')) { stäng(); return; }
        till(nu + 1);
      });
      /* Sidan rullar inte under rundturen: hålet står där det mätts. */
      ['wheel', 'touchmove'].forEach(function (h) {
        tur.addEventListener(h, function (e) { e.preventDefault(); }, { passive: false });
      });
      document.addEventListener('keydown', tangent, true);
      window.addEventListener('resize', omRita);

      document.body.appendChild(tur);
      void tur.offsetWidth;
      tur.classList.add('open');
      till(0);
    });
    return öppen;
  }

  /* Går igen från knappen under Profil & inställningar. */
  document.addEventListener('click', function (e) {
    var k = e.target.closest('[data-intro]');
    if (!k) return;
    visa({ roll: k.getAttribute('data-intro'), igen: true });
  });

  window.NXIntro = { visa: visa, STEG: STEG };
})();
