/* Delad mellan studievyn, studiehjälparvyn och adminvyn. Låg förut
   inbäddad, ordagrant likadan, i båda de två första. Laddas efter de
   delade modulerna och före vyns egen kod. */
/* ============================================================
   MODULVAKT
   Om en av modulerna inte laddat dör hela skriptet på första
   raden som rör den — före all felhantering — och vyn står kvar
   på "Laddar din vy" utan ett ord om varför. Det här körs först
   och fångar just det fallet: en avbruten nedladdning, en gammal
   fil i cachen, ett nät som glappade.

   ADMINVYN SAKNADE VAKTEN HELT fram till nu, fastän den har 26
   skript mot de andras 17 — alltså flest tillfällen att en fil
   inte kommer fram, och den enda vyn där tystnaden var total.

   Varje rad nedan prövar en FUNKTION, inte bara att globalen finns.
   Skälet är cachen: en gammal fil laddar, definierar sin global och
   ser frisk ut, men saknar det som tillkommit sedan dess. Den
   varianten ser man bara genom att fråga efter något som ska finnas.
   ============================================================ */
(function () {
  var ärAdmin = !!(document.body && document.body.classList.contains('vy-admin'));

  /* MODULERNA NÅS SOM IDENTIFIERARE, ALDRIG SOM window[...].
     Hälften av dem deklareras `const NXAgent = (function(){…})()` på
     toppnivå i ett vanligt skript. En sådan binding hamnar i skriptets
     eget scope, INTE på window — window.NXAgent är undefined fastän
     filen laddat perfekt. Ett första försök med window[namn] flaggade
     därför fem friska filer som saknade, och eftersom vyns egen kod
     kör efter vakten och ritar över felrutan syntes det inte ens.
     De som skriver window.NXStudie = … fungerar båda vägarna; de
     andra gör det inte, så det här är enda formen som håller. */
  var krav = [
    [typeof NX !== 'undefined' && typeof NX.esc === 'function', 'nextrum-app.js']
  ];

  if (ärAdmin) {
    krav.push(
      [typeof NXTjanster !== 'undefined', 'nextrum-tjanster.js'],
      [typeof NXStudie !== 'undefined' && !!NXStudie.bekräfta, 'nextrum-studie.js'],
      [typeof NXArbete !== 'undefined', 'nextrum-arbetsyta.js'],
      [typeof NXMedia !== 'undefined' && !!NXMedia.beskär, 'nextrum-media.js'],
      [typeof NXBetalning !== 'undefined' && !!NXBetalning.kronor, 'nextrum-betalning.js'],
      [typeof NXAgent !== 'undefined', 'nextrum-agent.js'],
      [typeof NXAdminAgenter !== 'undefined', 'nextrum-admin-agenter.js'],
      [typeof NXAdmin !== 'undefined' && !!NXAdmin.rita, 'nextrum-admin-karna.js']
    );

    /* Områdesfilerna definierar ingen egen global: var och en skriver
       in sina funktioner i NXAdmin.rita på sista raden. Att fråga
       efter en funktion per fil är därför det enda sättet att se att
       filen faktiskt kördes hela vägen ned. Namnen är hämtade ur
       respektive Object.assign(NXAdmin.rita, …) — lägger du till en
       områdesfil hör den hemma här också, annars faller den tyst. */
    if (typeof NXAdmin !== 'undefined' && NXAdmin.rita) {
      var omr = {
        ritaDetalj:        'nextrum-admin-detalj.js',
        ritaÖversikt:      'nextrum-admin-oversikt.js',
        ritaLeads:         'nextrum-admin-kunder.js',
        ritaAnsokningar:   'nextrum-admin-rekrytering.js',
        ritaBibliotek:     'nextrum-admin-bibliotek.js',
        ritaChattar:       'nextrum-admin-kommunikation.js',
        ritaBokningar:     'nextrum-admin-drift.js',
        ritaAvvikelser:    'nextrum-admin-ekonomi.js',
        ritaTjanster:      'nextrum-admin-tjanster.js',
        ritaAudit:         'nextrum-admin-system.js',
        ritaAutomationer:  'nextrum-admin-automationer.js',
        ritaAI:            'nextrum-admin-ai.js',
        ritaKonsol:        'nextrum-admin-konsol.js'
      };
      for (var namn in omr) {
        if (Object.prototype.hasOwnProperty.call(omr, namn)) {
          krav.push([typeof NXAdmin.rita[namn] === 'function', omr[namn]]);
        }
      }
    }
  } else {
    krav.push(
      [typeof NXKontakt !== 'undefined', 'nextrum-kontakt.js'],
      [typeof NXStudie !== 'undefined' && !!NXStudie.bekräfta, 'nextrum-studie.js'],
      [typeof NXMedia !== 'undefined' && !!NXMedia.beskär, 'nextrum-media.js'],
      [typeof NXBetalning !== 'undefined' && !!NXBetalning.kronor, 'nextrum-betalning.js']
    );
  }

  var saknas = [];
  for (var i = 0; i < krav.length; i++) {
    if (!krav[i][0]) saknas.push(krav[i][1]);
  }
  if (!saknas.length) return;

  /* Flaggan sätts FÖRE felrutan visas, och den sitter på <html> och
     inte på en global: vyns egen visa() kör efter vakten och skulle
     annars rita över felet med inloggningsrutan. Då stod en trasig
     adminvy och bad om lösenord, och den som skrev in det fick inget
     att hända. Både NXAdmin.visa och NXStudie.visaVy läser flaggan
     och vägrar lämna view-fel.

     En dataset-flagga och inte window.NXModulfel, eftersom halva
     kodbasens moduler deklareras med const på toppnivå och därför
     inte syns på window alls — se kommentaren högre upp. */
  document.documentElement.dataset.modulfel = '1';

  var visa = function (id) {
    ['view-loading', 'view-auth', 'view-nekad', 'view-app', 'view-fel'].forEach(function (v) {
      var el = document.getElementById(v);
      if (el) el.hidden = (v !== id);
    });
  };
  visa('view-fel');
  var t = document.getElementById('fel-text');
  var d = document.getElementById('fel-detalj');
  if (t) t.textContent = 'Sidan laddades inte färdigt. Ladda om med Cmd+Shift+R (eller Ctrl+Shift+R) så hämtas den på nytt.';
  if (d) d.textContent = 'Kunde inte läsa: ' + saknas.join(', ');
  var k = document.getElementById('fel-igen');
  if (k) k.addEventListener('click', function () { location.reload(true); });
})();
