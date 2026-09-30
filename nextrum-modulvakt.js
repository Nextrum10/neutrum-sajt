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
  var ärBarn = !!(document.body && document.body.classList.contains('vy-barn'));

  /* MODULERNA NÅS SOM IDENTIFIERARE, ALDRIG SOM window[...].
     Hälften av dem deklareras `const NXAgent = (function(){…})()` på
     toppnivå i ett vanligt skript. En sådan binding hamnar i skriptets
     eget scope, INTE på window — window.NXAgent är undefined fastän
     filen laddat perfekt. Ett första försök med window[namn] flaggade
     därför fem friska filer som saknade, och eftersom vyns egen kod
     kör efter vakten och ritar över felrutan syntes det inte ens.
     De som skriver window.NXStudie = … fungerar båda vägarna; de
     andra gör det inte, så det här är enda formen som håller. */
  /* skickaBarnHem kom med barnkontona: alla fyra vyerna anropar den
     när de startar. */
  var krav = [
    [typeof NX !== 'undefined' && typeof NX.esc === 'function' && typeof NX.skickaBarnHem === 'function',
      'nextrum-app.js']
  ];

  /* nextrum-studie.js: vakten över inloggningen och hämtaAlla kom
     2026-09-29, och alla tre vyerna anropar båda när de startar. En
     gammal fil ur cachen utan hämtaAlla hade gett ett TypeError mitt i
     hämtningen i stället för det här beskedet. passMedSvar kom sist
     (2026-09-30): familjens vy och studiehjälparvyn hämtar passen
     genom den. tipsa kom samma kväll, och båda vyerna anropar den när
     de startar. glömtLänkar kom med Glömt lösenordet, och de tre vyerna
     med inloggning anropar den så fort skriptet laddat. */
  var studieKlar = typeof NXStudie !== 'undefined' && !!NXStudie.vaktaInloggningen
    && typeof NXStudie.hämtaAlla === 'function' && typeof NXStudie.passMedSvar === 'function'
    && typeof NXStudie.tipsa === 'function' && typeof NXStudie.glömtLänkar === 'function';

  if (ärBarn) {
    /* Barnets vy (barn.html) laddar bara NX och NXStudie: inga
       betalningar, ingen kontakt, ingen bokning. adminroll kom samma
       dag som vyn och är ett tecken på att filen är ny nog. */
    krav.push([studieKlar && typeof NXStudie.adminroll === 'function', 'nextrum-studie.js']);
  } else if (ärAdmin) {
    krav.push(
      [typeof NXTjanster !== 'undefined', 'nextrum-tjanster.js'],
      [studieKlar, 'nextrum-studie.js'],
      [typeof NXArbete !== 'undefined', 'nextrum-arbetsyta.js'],
      [typeof NXMedia !== 'undefined' && !!NXMedia.beskär, 'nextrum-media.js'],
      [typeof NXBetalning !== 'undefined' && !!NXBetalning.passpris, 'nextrum-betalning.js'],
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
        ritaMånaden:       'nextrum-admin-manaden.js',
        ritaLöner:         'nextrum-admin-loner.js',
        ritaTjanster:      'nextrum-admin-tjanster.js',
        ritaAudit:         'nextrum-admin-system.js',
        ritaAdminhantering: 'nextrum-admin-behorighet.js',
        ritaAutomationer:  'nextrum-admin-automationer.js',
        ritaAI:            'nextrum-admin-ai.js',
        visaRadering:      'nextrum-admin-radera.js',
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
      [studieKlar, 'nextrum-studie.js'],
      [typeof NXMedia !== 'undefined' && !!NXMedia.beskär, 'nextrum-media.js'],
      [typeof NXBetalning !== 'undefined' && !!NXBetalning.passpris, 'nextrum-betalning.js'],
      /* NexLäx (Fas 23.2): vägen och spelaren. En gammal fil i cachen,
         från när sektionen hette Uppgifter, saknar vägen. */
      [typeof NXUppgifter !== 'undefined' && !!NXUppgifter.ritaVäg, 'nextrum-uppgifter.js']
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
    ['view-loading', 'view-auth', 'view-nekad', 'view-annan', 'view-stopp', 'view-app', 'view-fel'].forEach(function (v) {
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
