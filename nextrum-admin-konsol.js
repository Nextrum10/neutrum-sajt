/* ============================================================
   NEXTRUM — driftkonsolen på Översikt

   Ersätter fotoheron som låg överst i adminvyn och sa hej. Namn och
   roll står redan i toppradens konto, så det blocket bar ingen
   information som inte fanns någon annanstans.

   LÄGET läses ur S.lage, alltså vyn admin_lage, som redan är
   hämtad av ritaÖversikt(), och arbetskön ur S.problem och
   S.attGora. Den kostar ingenting, är alltid färsk, och ritas vid
   varje sidladdning: ringen och talet i NEX-bandet, och listan Att
   göra under det.

   Samtalet med drift-agenten (Fråga NEX, med diktering) stod här till
   2026-10-21. Det togs bort med drift och förslagskön (Leo: AI-delen
   var "svår och ostrukturerad"): det agenten kunde säga stod redan i
   Att göra och under Matchning, och en tom ruta att fråga i är inget
   arbetssätt.
   ============================================================ */
(function () {
  'use strict';

  const { $, esc } = NX;
  const { S } = NXAdmin;
  const kronor = NXBetalning.kronor;

  function rad(p) {
    return '<a class="kon-rad" href="' + esc(p.till) + '">'
      + '<span class="kon-rad-antal">' + esc(String(p.antal)) + '</span>'
      + '<span class="kon-rad-text"><b>' + esc(p.antal === 1 ? p.ental : p.rubrik) + '</b>'
      + '<span>' + esc(p.under) + '</span></span>'
      + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M12 5l7 7-7 7"/></svg></a>';
  }

  /* En grupp har en rubrik i ord, och gruppen med det som gått fel en egen
     ton. Formen och ordet bär skillnaden, inte bara färgen: --fel och
     --ockra ligger nära varandra för den som inte ser rött. */
  function grupp(rubrik, poster, klass) {
    if (!poster.length) return '';
    return '<div class="kon-grupp' + (klass ? ' ' + klass : '') + '">'
      + '<p class="kon-grupp-rubrik">' + esc(rubrik) + '</p>'
      + poster.map(rad).join('') + '</div>';
  }

  function ritaKonsol() {
    const värd = $('#kon-lage');
    const disk = $('#kon-disk');
    if (!värd || !disk) return;

    /* KONSOLEN RÄKNAR INGENTING SJÄLV.

       byggAttGöra() och byggProblem() i nextrum-admin-oversikt.js är
       husets definition av "väntar på oss" respektive "har gått fel".
       Listan här ÄR de två, och ritas bara här: förut stod de också som
       två egna block under konsolen, med samma rader en gång till. En egen räkning hade blivit ett tal som säger något annat än
       notisklockan och menyn — precis det fel hjältebildens kort en
       gång gjorde, och som står dokumenterat i nextrum-admin.js.

       Summan i ringen är de två listorna ihop, och eftersom båda syns
       uppdelade strax under går talet att stämma av med ögat. */
    const problem = S.problem || [];
    const kö = S.attGora || [];
    const summa = problem.concat(kö).reduce((n, p) => n + p.antal, 0);

    const läge = problem.length ? 'problem' : (kö.length ? 'atgard' : 'lugnt');
    /* classList, inte className: en omritning medan NEX tänker hade
       annars slagit bort ar-tanker och stannat ringarna mitt i en
       körning. */
    ['lugnt', 'atgard', 'problem', 'okand'].forEach(k =>
      disk.classList.toggle('ar-' + k, k === läge));
    $('#kon-disk-tal').textContent = String(summa);
    $('#kon-disk-text').textContent =
      läge === 'problem' ? 'kräver åtgärd' : (läge === 'atgard' ? 'väntar på dig' : 'allt lugnt');

    const antal = $('#kon-antal');
    if (antal) antal.textContent = summa ? summa + ' st' : '';

    if (!problem.length && !kö.length) {
      värd.innerHTML = '<div class="adm-lugnt">'
        + '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/></svg>'
        + '<span><b>Ingenting väntar just nu</b>'
        + '<span>Inga pass utan rapport och inga obesvarade anmälningar.</span></span>'
        + '</div>';
    } else {
      /* Problemen först: det som gått fel är inte samma sak som det
         som väntar, och en lista som blandar dem säger ingenting. */
      värd.innerHTML = grupp('Har gått fel', problem, 'ar-problem')
        + grupp('Väntar på dig', kö, '');
    }

    const l = S.lage;
    if (!l) {
      /* admin_lage saknas — vyn finns inte, eller RLS släppte inte
         igenom den. Beloppsraden tas bort i stället för att visa
         nollor som ser ut som fakta. Listorna ovan räknas lokalt och
         fortsätter stämma. */
      const p = $('#kon-pengar');
      if (p) p.innerHTML = '';
      return;
    }

    /* Obetalt och att betala ut står för sig: de är belopp, inte
       arbetsposter, och hör inte hemma i kön. Kommande pass stod här
       också, bredvid samma tal bland nyckeltalen strax under. */
    const pengar = $('#kon-pengar');
    if (pengar) {
      pengar.innerHTML =
        '<span><b>' + esc(kronor(l.obetalt_ore || 0)) + '</b> utestående</span>'
        + '<span><b>' + esc(kronor(l.att_betala_ut_ore || 0)) + '</b> att betala ut</span>';
    }
  }

  NXAdmin.rita.ritaKonsol = ritaKonsol;
})();
