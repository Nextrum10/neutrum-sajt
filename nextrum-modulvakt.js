/* Delad mellan studievyn och studiehjälparvyn. Låg förut inbäddad,
   ordagrant likadan, i båda sidorna. Laddas efter de delade
   modulerna och före vyns egen kod. */
/* ============================================================
   MODULVAKT
   Om en av modulerna inte laddat dör hela skriptet på första
   raden som rör den — före all felhantering — och vyn står kvar
   på "Laddar din vy" utan ett ord om varför. Det här körs först
   och fångar just det fallet: en avbruten nedladdning, en gammal
   fil i cachen, ett nät som glappade.
   ============================================================ */
(function () {
  var saknas = [];
  if (typeof NX === 'undefined') saknas.push('nextrum-app.js');
  if (typeof NXKontakt === 'undefined') saknas.push('nextrum-kontakt.js');
  if (typeof NXStudie === 'undefined' || !NXStudie.bekräfta) saknas.push('nextrum-studie.js');
  /* Vyerna klarar sig utan klockan, men inte tyst: det är NXNotiser
     som markerar trådens chattnotis läst, och utan den går mejlet
     om meddelandet ut fast familjen redan läst det i appen. */
  if (typeof NXNotiser === 'undefined' || !NXNotiser.trådSedd) saknas.push('nextrum-notiser.js');
  if (typeof NXMedia === 'undefined' || !NXMedia.beskär) saknas.push('nextrum-media.js');
  if (typeof NXBetalning === 'undefined' || !NXBetalning.kronor) saknas.push('nextrum-betalning.js');
  if (!saknas.length) return;

  var visa = function (id) {
    ['view-loading', 'view-auth', 'view-fel'].forEach(function (v) {
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
