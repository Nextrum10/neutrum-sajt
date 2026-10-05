/* ============================================================
   NEXTRUM — adminvyn, Rekrytering: ansökningar, intervju, utbildning, in i poolen

   En del av nextrum-admin.js, utflyttad i Fas 6 utan att någon
   funktion skrivits om. Kärnan (nextrum-admin-karna.js) laddas
   först och delar tillståndet S och hjälparna; varje område
   registrerar de funktioner andra områden anropar i
   NXAdmin.rita. Skalet (nextrum-admin.js) laddas sist och
   startar vyn. Ordningen står i admin.html.
   ============================================================ */
(function () {
  'use strict';

  const { $, $$, esc, säg, rensa, felText, datumText, isoFor } = NX;
  const { bekräfta, medan, tomt, laddar } = NXStudie;
  const kronor = NXBetalning.kronor;
  const M = NXMedia;

  const { ANS_LAGE, S, fråga, hämtaAllt, hämtaMatchunderlag, kontaktaRuta,
          kortDatum, läge, matchar, namnlista, närText, ritaPanelen, tomtText, visaRuta,
          ärNyNu, ärRaderad } = NXAdmin;
  /* Funktioner som bor i andra områden. Anropen går via
     NXAdmin.rita, som fylls när alla filer laddats. */
  const kandidater = (...a) => NXAdmin.rita.kandidater(...a);
  const ritaMatchning = (...a) => NXAdmin.rita.ritaMatchning(...a);
  const ritaStudiehjalpare = (...a) => NXAdmin.rita.ritaStudiehjalpare(...a);
  const ritaÖversikt = (...a) => NXAdmin.rita.ritaÖversikt(...a);
  const standardJobbtjanst = (...a) => NXAdmin.rita.standardJobbtjanst(...a);

  /* ============================================================
     ANSÖKNINGAR
     ============================================================ */

  /* Namnen, med läget. Uppgifterna, CV:t och rekryteringens steg står
     i panelen: Ansökan och Rekryteringen (nextrum-admin-detalj.js).
     Söket går fortfarande mot allt de skrev. */
  function ritaAnsokningar() {
    const sök = $('#ans-sok').value.trim();
    const st = $('#ans-status').value;
    const rader = S.ansokningar
      .filter(a => !st || a.status === st)
      .filter(a => matchar(a, ['name', 'email', 'school', 'subjects', 'why'], sök));

    $('#ans-antal').textContent = rader.length + ' av ' + S.ansokningar.length;
    $('#ans-tabell').innerHTML = namnlista(rader, {
      typ: 'ansokan', id: a => a.id,
      namn: a => a.name || a.email,
      läge: a => läge(ANS_LAGE, a.status),
      /* Den som kom in sedan du tittade senast (2026-10-05, ärNyNu). */
      nytt: a => ärNyNu('ansokningar', a),
      under: a => (ärNyNu('ansokningar', a) ? 'Ny sedan du tittade senast · ' + närText(a.created_at) : ''),
      tomt: tomtText(sök || st, 'Ingen ansökan matchar filtret', 'Inga ansökningar än')
    });

    ritaStegflikar();
    ritaPanelen();
  }

  /* ============================================================
     INTERVJU OCH UTBILDNING (Fas 6)

     Rekryteringens två steg som egna flikar: vem som väntar på en
     intervju, och vem som är i utbildningen men inte utbildad. Namnen,
     och under dem hur länge de väntat, för det är vad flikarna svarar
     på. Stegen bockas av i panelen, som öppnas på fliken Rekryteringen.
     Avböjda och godkända ligger bara under Alla.
     ============================================================ */
  function ritaStegflikar() {
    const aktiva = S.ansokningar.filter(a => a.status !== 'rejected' && a.status !== 'approved');
    /* Den som redan har ett utbildningsmöte hör hit, också utan att
       mötet innan är avbockat (2026-09-29): provet går att öppna före
       steg 2, och fliken var då tom medan provet pågick. */
    const iUtbildning = a => !a.utbildad_at && (a.intervju_at || a.utbildningsmote_at || a.prov_sista_dag);
    const tillIntervju = aktiva.filter(a => !a.intervju_at && !iUtbildning(a))
      .sort((a, b) => String(a.kontaktad_at || a.created_at).localeCompare(String(b.kontaktad_at || b.created_at)));
    const sedan = a => String(a.intervju_at || a.utbildningsmote_at || a.prov_sista_dag || '');
    const tillUtbildning = aktiva.filter(iUtbildning).sort((a, b) => sedan(a).localeCompare(sedan(b)));

    const intervju = $('#ans-intervju');
    if (intervju) {
      $('#ans-intervju-antal').textContent = tillIntervju.length ? tillIntervju.length + ' st' : '';
      intervju.innerHTML = namnlista(tillIntervju, {
        typ: 'ansokan', id: a => a.id, flik: 'rekrytering',
        namn: a => a.name || a.email,
        under: a => a.kontaktad_at ? 'Kontaktad ' + kortDatum(a.kontaktad_at) : 'Inte kontaktad än',
        tomt: 'Ingen väntar på en intervju'
      });
    }

    const utbildning = $('#ans-utbildning');
    if (utbildning) {
      $('#ans-utbildning-antal').textContent = tillUtbildning.length ? tillUtbildning.length + ' st' : '';
      utbildning.innerHTML = namnlista(tillUtbildning, {
        typ: 'ansokan', id: a => a.id, flik: 'rekrytering',
        namn: a => a.name || a.email,
        under: a => (a.intervju_at ? 'Intervjuad ' + kortDatum(a.intervju_at) : 'Utbildningsmöte '
          + kortDatum(a.utbildningsmote_at || a.prov_sista_dag)) + ' · ' + provKort(a),
        tomt: 'Ingen väntar på utbildning'
      });
    }
  }

  /* ============================================================
     CV:T

     Den som söker kan bifoga ett CV. NX.kopplaAnsökan i
     nextrum-app.js laddar upp det till den privata hinken "cv" och
     skriver sökvägen som raden "CV: cv/<sökväg>" i ansökans why. Den
     som söker har inget konto och ingen rad att peka på när filen
     laddas upp, så raden är den enda kopplingen mellan filen och
     ansökan. Ändras formatet där ska CV_RAD ändras här i samma
     ändring: annars försvinner knappen utan att något blir rött.

     Hinken hade ingen läsregel alls. CV:t kom fram, men bara
     service_role nådde det, och här stod sökvägen som text. Sedan
     migrationen admin_laser_ansokans_cv läser admin och ingen annan.

     Gick uppladdningen inte igenom står det som en egen rad i why.
     Det visas i stället för knappen, för den som sökt tror att CV:t
     kom fram, och då frågar ingen efter det.
     ============================================================ */
  const CV_RAD = /^CV: cv\/(\d+-[0-9a-z]*-[\w.\-]+)$/m;
  const CV_FEL = /^CV: bifogad fil .* kunde inte laddas upp.*$/m;

  function cvVäg(a) {
    const m = CV_RAD.exec(String(a.why || ''));
    return m ? m[1] : null;
  }

  /* Filens eget namn, utan tiden och slumpen som gör sökvägen unik. */
  function cvNamn(väg) { return väg.replace(/^\d+-[0-9a-z]*-/, ''); }

  /* En PDF visas i webbläsaren. Word gör det inte och laddas ned, och
     knappen säger vilket av dem som händer. Tom sträng när ansökan
     inte har något CV. */
  function cvKnapp(a) {
    const väg = cvVäg(a);
    if (väg) {
      return '<button type="button" class="btn btn-ghost btn-sm" data-ans-cv="' + esc(a.id)
        + '" title="' + esc(cvNamn(väg)) + '">'
        + (/\.pdf$/i.test(väg) ? 'Öppna CV' : 'Ladda ned CV') + '</button>';
    }
    return CV_FEL.test(String(a.why || ''))
      ? '<span class="adm-und">CV:t kom inte fram. Be om det via mejl.</span>'
      : '';
  }

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-ans-cv]');
    if (!knapp) return;
    const a = S.ansokningar.find(x => x.id === knapp.dataset.ansCv);
    const väg = a && cvVäg(a);
    if (!väg) return;

    if (/\.pdf$/i.test(väg)) {
      /* Fliken öppnas i samma tryck, innan länken finns. Ett fönster
         som öppnas efter en väntan på nätet räknas inte längre som
         användarens i Safari och stoppas tyst: knappen hade sett ut
         att inte göra någonting. */
      const flik = window.open('', '_blank');
      if (!flik) {
        alert('Webbläsaren stoppade fliken. Tillåt popupfönster för nextrum.se och tryck igen.');
        return;
      }
      flik.opener = null;
      await medan(knapp, 'Öppnar…', async () => {
        /* Fem minuter. Länken i adressfältet öppnar filen för vem som
           helst så länge den gäller, och det är ett CV, ofta en
           sextonårings. */
        const url = await M.signera('cv', väg, 300);
        if (!url) {
          flik.close();
          alert('CV:t gick inte att öppna. Filen kan ha tagits bort ur lagringen.');
          return;
        }
        flik.location.replace(url);
      });
      return;
    }

    /* Word hämtas hit och sparas med sitt eget namn. I en ny flik hade
       filen laddats ned och lämnat en tom flik efter sig. PDF:en kan
       inte gå samma väg: en blob-adress ärver adminvyns CSP, och
       object-src 'none' stoppar webbläsarens PDF-visare. */
    await medan(knapp, 'Hämtar…', async () => {
      const { data, error } = await supa.storage.from('cv').download(väg);
      if (error) { alert('CV:t gick inte att hämta: ' + felText(error)); return; }
      const url = URL.createObjectURL(data);
      const länk = document.createElement('a');
      länk.href = url;
      länk.download = cvNamn(väg);
      document.body.appendChild(länk);
      länk.click();
      länk.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    });
  });

  /* Mallarna. Skrivna för att kunna skickas som de är, men de är
     utkast: rutan är redigerbar just för att ingen familj ska få ett
     mejl som låter som ett formulär. */
  function mallIntervju(a) {
    return 'Hej ' + (String(a.name || '').split(' ')[0] || '') + ',\n\n'
      + 'Tack för din ansökan till Nextrum. Vi har läst den och skulle gärna '
      + 'prata med dig en kvart om hur du tänker kring att hjälpa andra att plugga.\n\n'
      + 'Passar någon av de här tiderna?\n'
      + '  · \n  · \n  · \n\n'
      + 'Det är ett samtal, inget prov. Vi vill veta hur du förklarar saker och '
      + 'vilka ämnen du känner dig trygg i.\n\n'
      + 'Hälsningar,\nNextrum';
  }

  /* Mötestiden har ingen mall längre. Sedan Fas 16.1 mejlar
     databasen tid och länk själv när mötet sparas, och ett utkast i
     samma stund hade blivit samma besked två gånger. */

  function mallUtbildning(a) {
    return 'Hej ' + (String(a.name || '').split(' ')[0] || '') + ',\n\n'
      + 'Innan ditt första pass vill vi att du går igenom vår introduktion. Den tar en '
      + 'stund och går igenom hur ett pass läggs upp och hur rapporten efteråt fungerar.\n\n'
      + 'Här är den:\n' + String(CFG.UTBILDNING_URL || '').trim() + '\n\n'
      + 'Rapporten är viktigare än den låter: ett pass räknas som genomfört först när '
      + 'rapporten finns, och det är den som gör att familjen faktureras och att du får '
      + 'betalt. Hör av dig om något är oklart.\n\n'
      + 'Hälsningar,\nNextrum';
  }

  /* ---- kontakta en sökande för intervju ---- */
  document.addEventListener('click', e => {
    const knapp = e.target.closest('[data-ans-kontakt]');
    if (!knapp) return;
    const a = S.ansokningar.find(x => x.id === knapp.dataset.ansKontakt);
    if (!a) return;

    kontaktaRuta({
      titel: 'Kalla ' + (a.name || a.email || '') + ' till intervju',
      namn: a.name, till: a.email,
      amne: 'Din ansökan till Nextrum',
      text: mallIntervju(a),
      efterat: async () => {
        const nu = new Date().toISOString();
        await supa.from('applications')
          .update({ kontaktad_at: nu, status: a.status === 'new' ? 'contacted' : a.status })
          .eq('id', a.id);
        a.kontaktad_at = nu;
        if (a.status === 'new') a.status = 'contacted';
        ritaOm();
      }
    });
  });

  /* ---- stegen i rekryteringen ---- */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-ans-steg]');
    if (!knapp) return;
    const [steg, id] = knapp.dataset.ansSteg.split(':');
    const a = S.ansokningar.find(x => x.id === id);
    if (!a) return;

    const kolumn = { intervju: 'intervju_at', utbmote: 'utbildningsmote_at' }[steg] || 'utbildad_at';
    const nu = a[kolumn] ? null : new Date().toISOString();

    /* Fas 22.1: utbildningen är provet. Att markera någon som utbildad
       utan godkänt prov går, men det ska vara ett val och inte ett
       felklick: mejlet om kontot går direkt. */
    if (kolumn === 'utbildad_at' && nu && !a.prov_godkant_at) {
      const ändå = await bekräfta({
        titel: 'Provet är inte godkänt',
        text: (a.name || 'Den sökande') + ' har inte klarat utbildningsprovet'
          + (a.prov_sista_dag ? '' : ', och provet är inte öppnat') + '. Markerar du utbildad ändå '
          + 'mejlas hen direkt om att skapa sitt konto. Gör det bara om introduktionen är klar på '
          + 'annat sätt.',
        knapp: 'Markera utbildad ändå',
        avbryt: 'Avbryt'
      });
      if (!ändå) return;
    }
    /* Att markera mötet öppnar provet och mejlar länken direkt. Knappen
       står sedan 2026-09-29 också i översikten, ett tryck från att öppna
       panelen, och ett mejl till den sökande går inte att ta tillbaka.
       Samma fråga som när provet öppnas igen. */
    if (kolumn === 'utbildningsmote_at' && nu) {
      const sista = new Date();
      sista.setDate(sista.getDate() + 3);
      const ja = await bekräfta({
        titel: 'Öppna provet',
        text: 'Utbildningsmötet markeras som hållet, och provet öppnas till och med '
          + provDag(isoFor(sista)) + '. ' + (a.name || 'Den sökande') + ' får ett mejl med '
          + 'länken nu, en påminnelse i morgon och en sista dagen.',
        knapp: 'Öppna provet',
        avbryt: 'Avbryt'
      });
      if (!ja) return;
    }
    /* Att ångra mötet stänger provet. Har hen redan börjat är det
       värt en fråga. */
    if (kolumn === 'utbildningsmote_at' && !nu && !a.prov_godkant_at
        && (S.provForsok[a.id] || []).length) {
      const ändå = await bekräfta({
        titel: 'Stänga provet?',
        text: 'Ångrar du utbildningsmötet stängs provet, och länken slutar gälla tills mötet '
          + 'markeras igen. ' + (a.name || 'Den sökande') + ' har redan gjort provet '
          + S.provForsok[a.id].length + ' gånger.',
        knapp: 'Ångra och stäng provet',
        avbryt: 'Avbryt'
      });
      if (!ändå) return;
    }

    await medan(knapp, '…', async () => {
      /* Raden tillbaka: triggern sätter provets sista dag och nyckel när
         mötet markeras, och rutan ska visa dem utan en ny hämtning. */
      const { data, error } = await supa.from('applications')
        .update({ [kolumn]: nu }).eq('id', id).select('*').single();
      if (error) { alert('Kunde inte spara: ' + felText(error)); return; }
      Object.assign(a, data || { [kolumn]: nu });
      await hämtaBesked(id);
      ritaOm();
    });
  });

  /* ---- öppna provet i tre dagar till (Fas 22.1) ---- */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-ans-prov-igen]');
    if (!knapp) return;
    const a = S.ansokningar.find(x => x.id === knapp.dataset.ansProvIgen);
    if (!a) return;

    /* Dagen i dag, i adminens egen tid, plus tre. Samma räkning som när
       mötet markeras: i dag och tre dagar till. */
    const d = new Date();
    d.setDate(d.getDate() + 3);
    const sista = isoFor(d);

    const ja = await bekräfta({
      titel: 'Öppna provet igen',
      text: 'Provet öppnas till och med ' + provDag(sista) + ', med samma länk som förut. '
        + (a.name || 'Den sökande') + ' får ett mejl om det nu, en påminnelse i morgon och en '
        + 'sista dagen.',
      knapp: 'Öppna provet',
      avbryt: 'Avbryt'
    });
    if (!ja) return;

    await medan(knapp, '…', async () => {
      const { data, error } = await supa.from('applications')
        .update({ prov_sista_dag: sista }).eq('id', a.id).select('*').single();
      if (error) { alert('Kunde inte öppna provet: ' + felText(error)); return; }
      Object.assign(a, data || { prov_sista_dag: sista });
      await hämtaBesked(a.id);
      ritaOm();
    });
  });

  /* ============================================================
     UTBILDNINGSPROVET (Fas 22.1)

     Provet öppnas när "Utbildningsmötet är hållet" klickas, i tre
     dagar räknat i svensk tid, och databasen mejlar länken, en
     påminnelse dagen efter och en sista dagen. Klarar hen provet
     sätts Utbildad av sig själv och mejlet om kontot går. Här visas
     bara läget: öppet till när, hur många försök, bästa resultatet.
     ============================================================ */
  function idagIso() { return isoFor(new Date()); }

  function provDag(iso) {
    if (!iso) return '';
    const [y, m, d] = String(iso).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function provLäge(a) {
    const försök = S.provForsok[a.id] || [];
    const bäst = försök.reduce((b, f) => (!b || f.ratt / f.antal > b.ratt / b.antal ? f : b), null);
    let läge = 'ej_öppnat';
    if (a.prov_godkant_at) läge = 'godkänt';
    else if (a.prov_sista_dag && a.prov_sista_dag >= idagIso()) läge = 'öppet';
    else if (a.prov_sista_dag || a.utbildningsmote_at) läge = 'stängt';
    return { läge: läge, försök: försök, bäst: bäst };
  }

  /* En rad för tabellen. */
  function provKort(a) {
    const p = provLäge(a);
    const res = p.bäst ? ', bäst ' + p.bäst.ratt + '/' + p.bäst.antal : '';
    return {
      'godkänt': 'Godkänt ' + kortDatum(a.prov_godkant_at) + res,
      'öppet': 'Öppet t.o.m. ' + kortDatum(a.prov_sista_dag) + ' · ' + p.försök.length + ' försök' + res,
      'stängt': 'Stängt · ' + p.försök.length + ' försök' + res,
      'ej_öppnat': 'Inte öppnat'
    }[p.läge];
  }

  /* Knappen bredvid läget i panelens översikt (2026-09-29). Leo: "på
     rekrytering och utbildning i admin kan man inte lägga in
     utbildningsprovet". Knappen fanns, men bara i fliken Rekryteringen,
     under steg 3 och nedanför skärmkanten, och översikten sa "Inte
     öppnat" utan att säga hur. Samma data-attribut som stegens knappar,
     så att det är samma handling med samma frågor. Tom när det inte
     finns något att göra: provet är öppet eller klart, eller ansökan
     är avgjord. */
  function provKnapp(a) {
    if (a.utbildad_at || a.status === 'approved' || a.status === 'rejected') return '';
    const läge = provLäge(a).läge;
    const id = esc(a.id);
    if (läge === 'ej_öppnat') {
      return '<button type="button" class="btn btn-ghost btn-sm" data-ans-steg="utbmote:' + id + '">'
        + 'Öppna provet</button>';
    }
    if (läge === 'stängt') {
      return '<button type="button" class="btn btn-ghost btn-sm" data-ans-prov-igen="' + id + '">'
        + 'Öppna i tre dagar till</button>';
    }
    return '';
  }

  /* Faktarutan i rekryteringsrutan. */
  function provFakta(a) {
    const p = provLäge(a);
    if (p.läge === 'ej_öppnat') return '';
    const länk = a.prov_nyckel ? location.origin + '/utbildningsprov?t=' + a.prov_nyckel : '';
    const rader = [];
    rader.push('<b>Provet:</b> ' + esc({
      'godkänt': 'godkänt ' + kortDatum(a.prov_godkant_at),
      'öppet': 'öppet till och med ' + provDag(a.prov_sista_dag),
      'stängt': 'stängt' + (a.prov_sista_dag ? ' sedan ' + provDag(a.prov_sista_dag) : '')
    }[p.läge]));
    rader.push('<b>Försök:</b> ' + (p.försök.length
      ? esc(p.försök.length + ' st, bäst ' + p.bäst.ratt + ' av ' + p.bäst.antal
        + ', senast ' + kortDatum(p.försök[0].skapad))
      : 'inga än'));
    /* Länken står här för den som vill skicka den själv, till exempel
       när mejlet inte gick fram. Samma länk hela vägen. */
    if (länk && p.läge === 'öppet') rader.push('<b>Länk:</b> ' + esc(länk));
    return '<div class="ans-steg-fakta' + (p.läge === 'stängt' ? ' ar-fel' : '') + '">'
      + rader.join('<br>') + '</div>';
  }

  /* ============================================================
     BESKEDEN TILL DEN SOM SÖKER (Fas 16.1)

     Databasen mejlar den sökande själv vid varje steg framåt:
     kvittot när ansökan kommer in, tid och länk när mötet bokas, ett
     tack när mötet är hållet, en uppmaning att skapa konto när
     introduktionen är klar och en välkomst vid Godkänd. Varje mejl
     visar hela processen och var hen står. Ett nej mejlas aldrig av
     sig självt — det skriver en människa.

     Här visas utfallet, vid det steg som skickade mejlet. Ett mejl
     som inte gick fram ser annars likadant ut som ett som gick:
     ingenting händer i rutan, och den sökande väntar på ett besked
     som aldrig kommer.
     ============================================================ */
  const BESKED = {
    mottagen: 'Kvittot på ansökan',
    mote: 'Mötestiden',
    utbildning: 'Tack för mötet',
    prov: 'Länken till provet',
    prov_paminnelse: 'Påminnelsen dagen efter',
    prov_sista_dagen: 'Påminnelsen sista dagen',
    sista_steget: 'Skapa ditt konto',
    valkommen: 'Välkomstmejlet',
    /* 2026-10-05 */
    vardnadshavare: 'Mejlet till vårdnadshavaren',
    avbojd: 'Nejet'
  };

  /* När ett köat mejl går, i svensk tid: "i dag kl. 14:35", "i morgon
     kl. 09:00". Bara nejet har en tid (skicka_efter). */
  const STHLM = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric',
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  function sthlm(d) {
    const p = {};
    STHLM.formatToParts(d).forEach(x => { p[x.type] = x.value; });
    return { dag: p.year + '-' + p.month + '-' + p.day, tim: Number(p.hour), klocka: p.hour + ':' + p.minute };
  }
  function dagOrd(dag) {
    const idag = sthlm(new Date()).dag;
    const imorgon = sthlm(new Date(Date.now() + 24 * 3600 * 1000)).dag;
    return dag === idag ? 'i dag' : dag === imorgon ? 'i morgon' : kortDatum(dag);
  }
  function närDetGår(iso) {
    const t = sthlm(new Date(iso));
    return dagOrd(t.dag) + ' kl. ' + t.klocka;
  }

  /* Omförsöken ger upp efter tredje försöket eller efter ett dygn
     (intern.ansokan_besked_igen). Därefter är det en människas tur. */
  const DYGN = 24 * 3600 * 1000;

  function besked(a, steg) {
    const rad = (S.ansokanUtskick[a.id] || []).find(r => r.steg === steg);
    if (!rad) return '';
    /* Dygnet räknas från när mejlet fick gå, som omförsöken gör. */
    const start = rad.skicka_efter || rad.skapad;
    const väntar = rad.status === 'vantar' && rad.skicka_efter && new Date(rad.skicka_efter).getTime() > Date.now();
    const uppgett = !väntar && (rad.forsok >= 3 || Date.now() - new Date(start).getTime() > DYGN);
    const läge = {
      skickad: '✓ mejlat ' + kortDatum(rad.uppdaterad),
      vantar: väntar ? 'går ' + närDetGår(rad.skicka_efter) + '. Byt läget före dess så går det inte.'
        : uppgett ? 'har fastnat och skickas inte. Skriv själv.' : 'på väg',
      skickar: uppgett ? 'har fastnat och skickas inte. Skriv själv.' : 'på väg',
      fel: 'gick inte fram' + (rad.fel ? ' (' + rad.fel + ')' : '')
        + (uppgett ? '. Försöker inte igen — skriv själv.' : '. Försöker igen om en stund.'),
      bromsad: 'skickades inte' + (rad.fel ? ': ' + rad.fel : ''),
      hoppad: 'skickades inte, ' + (rad.fel || 'beskedet hann bli inaktuellt')
    }[rad.status] || rad.status;
    const fel = rad.status === 'fel' || (uppgett && rad.status !== 'skickad'
      && rad.status !== 'bromsad' && rad.status !== 'hoppad');
    return '<div class="ans-steg-fakta' + (fel ? ' ar-fel' : '') + '"><b>' + esc(BESKED[steg])
      + ':</b> ' + esc(läge) + '</div>';
  }

  /* Raden skrivs av triggern i samma transaktion som ändringen, så
     den finns redan när svaret kommit. Utan en ny hämtning hade rutan
     visat det gamla läget tills hela vyn hämtats om. */
  async function hämtaBesked(id) {
    /* Alla kolumner: skicka_efter finns först med migrationen
       ansokan_vardnadshavare_och_nej (se hämtaAllt i kärnan). */
    const { data, error } = await supa.from('ansokan_utskick')
      .select('*')
      .eq('ansokan_id', id).order('skapad', { ascending: false });
    if (!error) S.ansokanUtskick[id] = data || [];
  }

  /* ============================================================
     REKRYTERINGEN (Fas 13.1)

     Stegen fanns först som stämplar i listan, men bara som fyra
     prickar: de sa VAD som var gjort, aldrig vad som görs härnäst
     eller varför steget finns. Den som inte rekryterat förut fick
     gissa, och den som gissade hoppade över utbildningen — vilket
     är precis det steg som kostar mest längre fram, eftersom en
     studiehjälpare utan introduktion inte skriver rapporter och ett
     pass utan rapport aldrig blir genomfört.

     Listan är därför inte en meny. Den är ordningen, med skälet till
     varje steg skrivet bredvid knappen som utför det.

     Den stod i en egen ruta till 2026-09-28. Nu är den fliken
     Rekryteringen i personpanelen, bredvid uppgifterna om den som
     sökt: en person, ett ställe (Leo: "lägg bara namn och så att man
     kan trycka på namnen").

     Den bokar inte i någon kalender och skapar ingen länk. Kopplingen
     till Google (Fas 18.1) gör Meet-länkar till onlinepassen och
     inget annat: Leo valde bort rekryteringsmötet 2026-09-25. En knapp
     som ser ut att boka men bara skriver i vår egen databas är värre
     än en som säger vad den gör: den sparar tiden och länken här, och
     databasen mejlar dem till den sökande (Fas 16.1).
     ============================================================ */

  /* Stegknapparna nedan ritar om listan, och listan ritar om panelen
     (ritaPanelen). Utan det syns en stämpel man precis satt först när
     panelen stängts och öppnats igen. */
  function ritaOm() {
    ritaAnsokningar();
  }

  function mötesText(a) {
    if (!a.mote_tid) return null;
    const d = new Date(a.mote_tid);
    return d.toLocaleString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit' });
  }

  /* Ett steg i listan: nummer, namn, skälet, stämpeln och knapparna.
     Skälet står kvar när steget är gjort — den som kommer tillbaka
     om ett halvår ska slippa lista ut varför det gjordes. */
  function spårSteg(nr, namn, varför, tid, knappar, extra) {
    return '<div class="ans-steg' + (tid ? ' ar-gjord' : '') + '">'
      + '<div class="ans-steg-nr">' + nr + '</div>'
      + '<div class="ans-steg-kropp">'
      + '<h4>' + esc(namn)
      + (tid ? '<span class="ans-steg-tid">✓ ' + esc(kortDatum(tid)) + '</span>' : '')
      + '</h4>'
      + '<p>' + esc(varför) + '</p>'
      + '<div class="ans-steg-knappar">' + knappar + '</div>'
      + (extra || '')
      + '</div></div>';
  }

  /* Fliken Rekryteringen i panelen (dpAnsokan i nextrum-admin-detalj.js). */
  function spårLista(a) {
    const id = esc(a.id);
    const möte = mötesText(a);
    const utbLänk = String(CFG.UTBILDNING_URL || '').trim();

    return '<div class="ans-spar-lista">'

      + spårSteg(1, 'Kontakt',
          'Kvittot på ansökan har redan gått av sig självt. Här föreslår du tider för mötet: '
          + 'utkastet öppnas i ditt mejlprogram med din adress som avsändare, så att svaret '
          + 'kommer till dig.',
          a.kontaktad_at,
          '<button type="button" class="btn btn-ghost btn-sm" data-ans-kontakt="' + id + '">'
          + (a.kontaktad_at ? 'Skriv igen' : 'Skriv till hen') + '</button>',
          besked(a, 'mottagen') + besked(a, 'vardnadshavare'))

      + spårSteg(2, 'Digitalt möte',
          'En kvart över video. Det är ett samtal, inget prov — vi vill höra hur hen '
          + 'förklarar saker och vilka ämnen hen är trygg i. Tiden och länken mejlas till hen '
          + 'när du sparar dem, och igen om du ändrar dem. "Mötet är hållet" mejlar ett tack '
          + 'och säger att introduktionen är nästa steg.',
          a.intervju_at,
          '<button type="button" class="btn btn-ghost btn-sm" data-ans-mote="' + id + '">'
          + (a.mote_tid ? 'Ändra mötet' : 'Boka möte') + '</button>'
          + ' <button type="button" class="btn btn-ghost btn-sm" data-ans-steg="intervju:' + id + '">'
          + (a.intervju_at ? 'Ångra "mötet är hållet"' : 'Mötet är hållet') + '</button>',
          (möte
            ? '<div class="ans-steg-fakta"><b>Bokat:</b> ' + esc(möte)
              + (a.mote_lank ? '<br><b>Länk:</b> ' + esc(a.mote_lank) : '') + '</div>'
            : '')
          + besked(a, 'mote') + besked(a, 'utbildning'))

      + spårSteg(3, 'Utbildning',
          'Utbildningsmötet och provet. Det här steget är inte en artighet: en studiehjälpare '
          + 'som inte vet hur rapporten fungerar lämnar inga rapporter, och utan rapport blir '
          + 'passet aldrig genomfört — varken fakturerat eller utbetalt. "Utbildningsmötet är '
          + 'hållet" öppnar provet i tre dagar och mejlar länken, med en påminnelse dagen efter '
          + 'och en sista dagen. 80 procent rätt är godkänt, och då markeras hen som utbildad av '
          + 'sig själv och får mejlet om att skapa sitt konto.',
          a.utbildad_at,
          (utbLänk
            ? '<button type="button" class="btn btn-ghost btn-sm" data-ans-utb="' + id + '">'
              + 'Skicka utbildningen</button> '
            : '')
          + '<button type="button" class="btn btn-ghost btn-sm" data-ans-steg="utbmote:' + id + '">'
          + (a.utbildningsmote_at ? 'Ångra "utbildningsmötet är hållet"' : 'Utbildningsmötet är hållet')
          + '</button> '
          + (provLäge(a).läge === 'stängt'
            ? '<button type="button" class="btn btn-ghost btn-sm" data-ans-prov-igen="' + id + '">'
              + 'Öppna provet i tre dagar till</button> '
            : '')
          + '<button type="button" class="btn btn-ghost btn-sm" data-ans-steg="utbildad:' + id + '">'
          + (a.utbildad_at ? 'Ångra "utbildad"' : 'Markera utbildad') + '</button>',
          (utbLänk
            ? '<div class="ans-steg-fakta"><b>Länk:</b> ' + esc(utbLänk) + '</div>'
            /* Ingen länk satt. Knappen ritas inte alls — en knapp som
               mejlar en tom rad ser ut att fungera och gör det inte.
               Var den sätts står här, för den som läser det här är
               den som ska sätta den. */
            : '<div class="ans-steg-fakta">Ingen utbildningslänk är satt. '
              + 'Lägg den i <code>UTBILDNING_URL</code> i nextrum-config.js, '
              + 'så går den att skicka härifrån.</div>')
          + provFakta(a)
          + besked(a, 'prov') + besked(a, 'prov_paminnelse') + besked(a, 'prov_sista_dagen')
          + besked(a, 'sista_steget'))

      + spårSteg(4, 'In i poolen',
          'Profilen blir godkänd och dyker upp i matchningen, och hen får ett välkomstmejl. '
          + 'Den sökande måste ha ett konto på nextrum.se först — annars finns ingen profil '
          + 'att godkänna.',
          a.status === 'approved' ? (a.utbildad_at || a.created_at) : null,
          '<button type="button" class="btn btn-primary btn-sm" data-ans-pool="' + id + '">'
          + 'Ta in i poolen</button>',
          besked(a, 'valkommen'))

      + '</div>'
      /* Nejet står inte bland stegen ovan. Därför här, där den som ska
         säga nej läser. Sedan 2026-10-05 mejlas det, men inte genast. */
      + besked(a, 'avbojd')
      + '<p class="xsmall" style="color:var(--muted-2);margin-top:12px;line-height:1.6">'
      + ('vardnadshavare_godkand_at' in a
        ? 'Sätts läget till Avböjd mejlas ett nej, tidigast en halvtimme senare och aldrig mellan 20 och 9. '
          + 'Byter du läget innan dess går det inte iväg. Ett nej mejlas en gång.'
        : 'Ett nej mejlas inte härifrån än: migrationen ansokan_vardnadshavare_och_nej är inte körd. '
          + 'Sätts läget till Avböjd går ingenting ut, så det mejlet skriver du själv.')
      + (S.ansokanUtskickFel
        ? ' Mejlstatusen gick inte att läsa: ' + esc(S.ansokanUtskickFel) + '.'
        : '')
      + '</p>';
  }

  /* ---- boka det digitala mötet ---- */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-ans-mote]');
    if (!knapp) return;
    const a = S.ansokningar.find(x => x.id === knapp.dataset.ansMote);
    if (!a) return;

    /* Förvalen: datum och tid delade, för en datetime-local som är
       tom kräver att man klickar sig genom båda ändå, och en
       förvald tid som är "nu" ser ut som en riktig bokning. */
    const d = a.mote_tid ? new Date(a.mote_tid) : null;
    const hhmm = x => String(x.getHours()).padStart(2, '0') + ':'
      + String(x.getMinutes()).padStart(2, '0');

    const svar = await fråga({
      titel: 'Boka digitalt möte med ' + (a.name || 'den sökande'),
      text: 'Tiden och länken sparas på ansökan och mejlas till den sökande direkt. Ändrar du '
        + 'dem senare går ett nytt mejl med den nya tiden. Ingen kalender bokas härifrån, och '
        + 'länken skapar du själv i Google Meet.',
      innehåll: '<div class="ag-faltrad">'
        + '<div class="fgroup"><label for="mo-datum">Datum</label>'
        + '<input class="inp" id="mo-datum" type="date" value="'
        + (d ? esc(isoFor(d)) : '') + '"></div>'
        + '<div class="fgroup"><label for="mo-tid">Tid</label>'
        + '<input class="inp" id="mo-tid" type="time" value="'
        + (d ? esc(hhmm(d)) : '17:00') + '"></div>'
        + '</div>'
        + '<div class="fgroup" style="margin-top:12px"><label for="mo-lank">Möteslänk</label>'
        + '<input class="inp" id="mo-lank" placeholder="https://meet.google.com/…" value="'
        + esc(a.mote_lank || '') + '"></div>',
      knapp: 'Spara och mejla',
      läs: r => {
        const datum = $('#mo-datum', r).value;
        const tid = $('#mo-tid', r).value;
        if (!datum) return { fel: 'Välj ett datum.' };
        if (!tid) return { fel: 'Välj en tid.' };
        /* Ett möte som redan varit mejlas inte (triggern hoppar över
           det), och en bokning som tyst inte blir något mejl är värre
           än ett nej här. */
        if (new Date(datum + 'T' + tid).getTime() <= Date.now()) {
          return { fel: 'Tiden har redan varit. Är mötet hållet: klicka "Mötet är hållet" i stället.' };
        }
        const länk = möteslänk($('#mo-lank', r).value);
        if (länk === false) {
          return { fel: 'Länken ska vara en vanlig webbadress, till exempel https://meet.google.com/abc-defg-hij.' };
        }
        return { värde: { datum: datum, tid: tid, länk: länk } };
      }
    });
    if (!svar) return;

    /* new Date('2026-09-24T17:00') utan Z tolkas i webbläsarens egen
       tidszon, alltså i den tid admin faktiskt skrev. Med Z hade
       ett möte klockan 17 blivit 19 på sommaren. */
    const när = new Date(svar.datum + 'T' + svar.tid);
    const { error } = await supa.from('applications')
      .update({ mote_tid: när.toISOString(), mote_lank: svar.länk })
      .eq('id', a.id);
    if (error) { alert('Kunde inte spara mötet: ' + felText(error)); return; }
    a.mote_tid = när.toISOString();
    a.mote_lank = svar.länk;
    await hämtaBesked(a.id);
    ritaOm();
  });

  /* Möteslänken som den ska sparas: null om fältet är tomt, false om
     den inte går att använda.

     Mejlet gör bara en https-adress till en knapp (sakerLank() i
     _delad/notiser/ansokan.ts). "meet.google.com/abc" utan schema
     hade alltså gett ett mejl som säger att länken kommer senare,
     trots att admin skrev den. Därför får den sitt https:// här, och
     det mejlet ändå inte skulle visa nekas innan det sparas. */
  function möteslänk(värde) {
    let s = String(värde || '').trim();
    if (!s) return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s;
    let u;
    try { u = new URL(s); } catch (e) { return false; }
    if (u.protocol !== 'https:' || u.username || u.password
        || u.hostname.indexOf('.') < 0 || s.length > 500) return false;
    return u.href;
  }

  /* ---- skicka utbildningen ---- */
  document.addEventListener('click', e => {
    const knapp = e.target.closest('[data-ans-utb]');
    if (!knapp) return;
    const a = S.ansokningar.find(x => x.id === knapp.dataset.ansUtb);
    if (!a) return;

    kontaktaRuta({
      titel: 'Skicka utbildningen till ' + (a.name || a.email || ''),
      namn: a.name, till: a.email,
      amne: 'Introduktionen inför ditt första pass',
      text: mallUtbildning(a)
    });
  });

  /* ============================================================
     FRÅN ANSÖKAN TILL POOL

     Poolen är `tutor_profiles` med status 'approved' — det är exakt
     det urvalet vyn matchningsunderlag lämnar ut, och alltså det
     matchningen kan välja ur.

     En ansökan i `applications` är inte en profil. Den kunde förut
     bara byta etikett i en lista, och "Godkänd" på en ansökan gjorde
     ingenting åt vem som gick att matcha. Poolen var därför alltid
     tom utom för dem som råkat fylla i sin profil själva.

     TIMPENNINGEN ÄR OBLIGATORISK HÄR

     Utan hourly_rate hoppar edge-funktionen fakturering över
     studiehjälparen helt när ersättningar räknas ut. Hen håller pass
     och får ingen utbetalning, och det upptäcks först när någon
     frågar var pengarna blev av. Bättre att kräva talet i samma
     stund som personen släpps in.
     ============================================================ */
  function tutorVal(valt) {
    /* Bara konton som INTE redan är i poolen. Att erbjuda en redan
       godkänd studiehjälpare i listan är att be om att någons ämnen
       skrivs över av en ansökan från en annan person. */
    const kandidater = Object.values(S.personer)
      .filter(p => p.role === 'tutor' && !ärRaderad(p))
      .filter(p => (S.tutorProfiler[p.id] || {}).status !== 'approved')
      .sort((a, b) => String(a.full_name || a.email || '')
        .localeCompare(String(b.full_name || b.email || ''), 'sv'));

    if (!kandidater.length) {
      return '<p class="xsmall" style="color:var(--acc-text);margin:0">'
        + 'Inga konton att koppla till. Den sökande måste registrera sig som '
        + 'studiehjälpare på nextrum.se först — sedan dyker hen upp här.</p>';
    }

    return '<select class="inp" id="ap-konto">'
      + '<option value="">Välj konto…</option>'
      + kandidater.map(t => '<option value="' + esc(t.id) + '"'
          + (t.id === valt ? ' selected' : '') + '>'
          + esc(t.full_name || t.email || t.id) + (t.email ? ' · ' + esc(t.email) : '')
          + '</option>').join('')
      + '</select>';
  }

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-ans-pool]');
    if (!knapp) return;

    const ans = S.ansokningar.find(a => a.id === knapp.dataset.ansPool);
    if (!ans) return;

    /* Den som är under 18 behöver vårdnadshavarens godkännande för att
       börja jobba (2026-10-05). Saknas det i ansökan frågar vi, som för
       introduktionen: det kan finnas på annat sätt. */
    if (ärUnder18(ans) && harVhKolumner(ans) && !ans.vardnadshavare_godkand_at) {
      const ändå = await bekräfta({
        titel: 'Vårdnadshavarens godkännande saknas',
        text: (ans.name || 'Den sökande') + ' är ' + ans.age + ' år, och den som är under 18 behöver sin '
          + 'vårdnadshavares godkännande för att börja jobba. Lägg in det under Ansökan först, eller '
          + 'fortsätt om du har det på annat sätt.',
        knapp: 'Ta in ändå',
        avbryt: 'Avbryt'
      });
      if (!ändå) return;
    }

    /* Utbildningen är inte en artighet. En studiehjälpare som inte
       vet hur rapporten fungerar lämnar inga rapporter — och utan
       rapport blir passet aldrig genomfört, alltså aldrig fakturerat
       och aldrig utbetalt. Kedjan går isär i andra änden. */
    if (!ans.utbildad_at) {
      const ändå = await bekräfta({
        titel: 'Introduktionen är inte gjord',
        text: (ans.name || 'Den sökande') + ' är inte markerad som utbildad. En studiehjälpare '
          + 'som inte vet hur rapporten fungerar lämnar inga rapporter, och då blir passen '
          + 'aldrig genomförda — varken fakturerade eller utbetalda. Markera Utbildad under '
          + 'Rekryteringen först, eller fortsätt om introduktionen är gjord ändå.',
        knapp: 'Ta in ändå',
        avbryt: 'Avbryt'
      });
      if (!ändå) return;
    }

    const trolig = Object.values(S.personer).find(p =>
      p.role === 'tutor' && p.email && !ärRaderad(p)
      && String(p.email).toLowerCase() === String(ans.email || '').toLowerCase());

    const ruta = document.createElement('div');
    ruta.className = 'nx-fraga';
    ruta.innerHTML =
      '<div class="nx-fraga-box" role="dialog" aria-modal="true" aria-labelledby="ap-t">'
      + '<h3 id="ap-t">Ta in ' + esc(ans.name || 'den sökande') + ' i poolen</h3>'
      + '<p>Profilen blir godkänd och dyker upp i matchningen direkt, och hen får ett '
      + 'välkomstmejl. Uppgifterna nedan kommer från ansökan — ändra det som behöver ändras.</p>'
      + '<div class="fgroup"><label for="ap-konto">Konto</label>' + tutorVal(trolig && trolig.id) + '</div>'
      + '<div class="ag-faltrad" style="margin-top:12px">'
      + '<div class="fgroup"><label for="ap-amnen">Ämnen (kommaseparerat)</label>'
      + '<input class="inp" id="ap-amnen" value="' + esc(ans.subjects || '') + '"></div>'
      + '<div class="fgroup"><label for="ap-ort">Ort</label>'
      + '<input class="inp" id="ap-ort" value="Stockholm"></div>'
      + '<div class="fgroup"><label for="ap-timpenning">Timpenning, kronor</label>'
      + '<input class="inp" id="ap-timpenning" type="number" min="1" step="1" inputmode="numeric" placeholder="t.ex. 180"></div>'
      + '</div>'
      + '<p class="xsmall" style="color:var(--muted-2);margin-top:12px;line-height:1.6">'
      + 'Utan timpenning räknas ingen ersättning ut — passen hålls men utbetalningen uteblir.</p>'
      + '<p class="ok-msg" id="ap-msg"></p>'
      + '<div class="nx-fraga-knappar">'
      + '<button type="button" class="btn btn-ghost" data-ap-stang>Avbryt</button>'
      + '<button type="button" class="btn btn-primary" id="ap-godkann">Ta in i poolen</button>'
      + '</div></div>';

    visaRuta(ruta);
    const stäng = () => { ruta.remove(); document.body.style.overflow = ''; };
    ruta.addEventListener('click', ev => {
      if (ev.target === ruta || ev.target.closest('[data-ap-stang]')) stäng();
    });

    $('#ap-godkann', ruta).addEventListener('click', async () => {
      const msg = $('#ap-msg', ruta);
      rensa(msg);
      const konto = $('#ap-konto', ruta) ? $('#ap-konto', ruta).value : '';
      const timpenning = Number($('#ap-timpenning', ruta).value);
      if (!konto) { säg(msg, 'Välj vilket konto ansökan hör till.', false); return; }
      if (!timpenning || timpenning < 1) { säg(msg, 'Fyll i timpenningen.', false); return; }

      await medan($('#ap-godkann', ruta), 'Tar in…', async () => {
        /* Ämnena lagras som en array. Fritexten från ansökan delas på
           komma; tomma bitar bort, annars blir "matte, " till två ämnen
           varav ett heter ingenting. */
        const ämnen = String($('#ap-amnen', ruta).value || '')
          .split(',').map(x => x.trim()).filter(Boolean);

        const { error } = await supa.from('tutor_profiles').update({
          status: 'approved',
          subjects: ämnen.length ? ämnen : null,
          city: $('#ap-ort', ruta).value.trim() || null,
          school: ans.school || null,
          age: ans.age || null,
          availability: ans.availability || null,
          hourly_rate: timpenning,
          tjanster: (ans.tjanster && ans.tjanster.length) ? ans.tjanster : [standardJobbtjanst()]
        }).eq('id', konto);

        if (error) { säg(msg, 'Kunde inte ta in: ' + felText(error), false); return; }

        await supa.from('applications').update({ status: 'approved' }).eq('id', ans.id);
        ans.status = 'approved';

        stäng();
        await hämtaAllt();
        ritaAnsokningar();
        ritaStudiehjalpare();
        await hämtaMatchunderlag();
        ritaMatchning();
        await ritaÖversikt();
      });
    });
  });


  /* ============================================================
     UNDER 18: VÅRDNADSHAVARENS GODKÄNNANDE (2026-10-05)

     Leo: "fråga om den sökande är under 18, är den det så ber du den
     skriva in sina föräldrars mail och dokumenterar det, föräldrarna får
     automatiskt ett mail ... efter det så kan vi dokumentera det och
     lägga in kopia av mail till barnet." Formuläret frågar efter
     vårdnadshavarens e-post när åldern är under 18, och databasen mejlar
     vårdnadshavaren direkt (steget vardnadshavare). Svaret kommer till
     info@, och läggs in här: när, och en kopia av mejlet. Ingenting
     mejlas när det läggs in.

     Raderna visas bara när kolumnerna finns (migrationen
     ansokan_vardnadshavare_och_nej): en knapp som sparar till en kolumn
     som saknas hade sett ut att fungera.
     ============================================================ */
  const ärUnder18 = a => a.age != null && a.age > 0 && a.age < 18;
  const harVhKolumner = a => !!a && 'vardnadshavare_godkand_at' in a;

  /* Det senaste mejlet till vårdnadshavaren, kort: det står i Ansökan,
     bredvid adressen. Hela beskedet står under Rekryteringen. */
  function vhMejlat(a) {
    const rad = (S.ansokanUtskick[a.id] || []).find(r => r.steg === 'vardnadshavare');
    if (!rad) return '';
    return {
      skickad: 'mejlad ' + kortDatum(rad.uppdaterad),
      vantar: 'mejlet är på väg', skickar: 'mejlet är på väg',
      fel: 'mejlet gick inte fram',
      bromsad: 'mejlades inte' + (rad.fel ? ': ' + rad.fel : ''),
      hoppad: 'mejlades inte'
    }[rad.status] || '';
  }

  /* Raderna i ansökans faktaruta (dpAnsokan). Tom för en vuxen. */
  function vhFakta(a) {
    if (!harVhKolumner(a)) return [];
    if (!ärUnder18(a) && !a.vardnadshavare_epost && !a.vardnadshavare_godkand_at) return [];
    const mejlat = vhMejlat(a);
    const adress = a.vardnadshavare_epost
      ? '<a href="mailto:' + esc(a.vardnadshavare_epost) + '" data-mailtext="keep">'
        + esc(a.vardnadshavare_epost) + '</a>'
        + (mejlat ? esc(' · ' + mejlat) : '')
      : null;
    const godkänt = a.vardnadshavare_godkand_at
      ? esc('Inlagt ' + kortDatum(a.vardnadshavare_godkand_at) + '. Mejlet står under Vårdnadshavarens svar.')
      : esc(a.vardnadshavare_epost ? 'Väntar på svar till info@.' : 'Inget mejl har gått: adressen saknas.')
        + ' <button type="button" class="btn btn-ghost btn-sm" data-ans-vh-in="'
        + esc(a.id) + '">Lägg in godkännandet</button>';
    return [
      ['Vårdnadshavare', adress, 'saknas. Lägg till adressen under Redigera uppgifterna, så mejlas hen.'],
      ['Godkännande', godkänt]
    ];
  }

  /* Kopian av vårdnadshavarens svar, och vägen att ta bort den. Tom
     sträng när inget är inlagt. */
  function vhSvar(a) {
    if (!harVhKolumner(a) || !a.vardnadshavare_godkand_at) return '';
    return '<div class="dp-text">' + esc(a.vardnadshavare_svar || '(ingen kopia)') + '</div>'
      + '<div class="dp-atgard"><button type="button" class="btn btn-ghost btn-sm" data-ans-vh-bort="'
      + esc(a.id) + '">Ta bort godkännandet</button></div>';
  }

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-ans-vh-in]');
    if (!knapp) return;
    const a = S.ansokningar.find(x => x.id === knapp.dataset.ansVhIn);
    if (!a) return;
    const svar = await fråga({
      titel: 'Vårdnadshavarens godkännande',
      text: 'Klistra in mejlet där ' + (a.vardnadshavare_epost || 'vårdnadshavaren') + ' godkänner ansökan, '
        + 'med avsändare och datum. Det sparas i ansökan och tas bort med den. Ingenting mejlas.',
      innehåll: '<div class="fgroup"><label for="vh-svar">Mejlet från vårdnadshavaren</label>'
        + '<textarea class="inp" id="vh-svar" rows="9" maxlength="20000"></textarea></div>',
      knapp: 'Lägg in godkännandet',
      läs: r => {
        const text = $('#vh-svar', r).value.trim();
        if (text.length < 10) return { fel: 'Klistra in mejlet där vårdnadshavaren godkänner ansökan.' };
        return { värde: text };
      }
    });
    if (!svar) return;
    const { data, error } = await supa.from('applications')
      .update({ vardnadshavare_godkand_at: new Date().toISOString(), vardnadshavare_svar: svar })
      .eq('id', a.id).select('*').maybeSingle();
    if (error || !data) { alert('Kunde inte spara: ' + (error ? felText(error) : 'ingen rad ändrades')); return; }
    Object.assign(a, data);
    ritaOm();
  });

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-ans-vh-bort]');
    if (!knapp) return;
    const a = S.ansokningar.find(x => x.id === knapp.dataset.ansVhBort);
    if (!a) return;
    const ja = await bekräfta({
      titel: 'Ta bort godkännandet?',
      text: 'Tidpunkten och kopian av mejlet tas bort ur ansökan. Gör det bara om det lades in av misstag.',
      knapp: 'Ta bort',
      avbryt: 'Behåll'
    });
    if (!ja) return;
    await medan(knapp, '…', async () => {
      const { data, error } = await supa.from('applications')
        .update({ vardnadshavare_godkand_at: null, vardnadshavare_svar: null })
        .eq('id', a.id).select('*').maybeSingle();
      if (error || !data) { alert('Kunde inte ta bort: ' + (error ? felText(error) : 'ingen rad ändrades')); return; }
      Object.assign(a, data);
      ritaOm();
    });
  });

  /* ============================================================
     NEJET (2026-10-05)

     Leo: "klickar vi i avböjd i ansökningarna så skickas automatiskt ett
     mail till den sökande om att vi har valt att gå vidare med en annan."
     Rullgardinen frågar först och visar mejlet, ord för ord. Databasen
     köar det tidigast en halvtimme senare och aldrig mellan 20 och 9
     (intern.ansokan_nej_tid); byts läget före dess går inget.

     TEXTEN STÅR PÅ TVÅ STÄLLEN: här och i mallen (NEJ i
     supabase/functions/_delad/notiser/ansokan.ts). verktyg/kolla-mejltexter.py
     håller dem lika i CI, för en förhandsvisning som säger något annat än
     mejlet är värre än ingen.
     ============================================================ */
  const NEJ_MEJLET = {
    amne: 'Om din ansökan till Nextrum',
    rubrik: 'Tack för din ansökan',
    mening: 'Tack för att du ville jobba som studiehjälpare hos oss, och för tiden du lade på ansökan. '
      + 'Vi har valt att gå vidare med andra sökande den här gången.',
    avslutning: 'Du är välkommen att söka igen längre fram. Undrar du något om beskedet? '
      + 'Svara på det här mejlet.'
  };

  /* Förnamnet som mallen tar det (fornamn() i _delad/notiser/typer.ts). */
  function förnamn(namn) {
    const första = String(namn || '').trim().split(/\s+/)[0] || '';
    const ren = första.replace(/[^\p{L}-]/gu, '').slice(0, 30);
    return /\p{L}/u.test(ren) ? ren : null;
  }

  /* När nejet går om det sätts nu: samma regel som intern.ansokan_nej_tid. */
  function nejNär() {
    const t = sthlm(new Date(Date.now() + 30 * 60000));
    if (t.tim < 9) return dagOrd(t.dag) + ' kl. 09:00';
    if (t.tim >= 20) return 'i morgon kl. 09:00';
    return dagOrd(t.dag) + ' kl. ' + t.klocka;
  }

  /* Frågan innan läget blir Avböjd. Svarar true när det får sättas. */
  async function bekräftaNej(a) {
    /* Utan migrationen köar databasen inget nej, och rutan hade lovat
       ett mejl som aldrig går. */
    if (!harVhKolumner(a)) return true;
    const vem = a.name || 'Den sökande';
    const gått = (S.ansokanUtskick[a.id] || []).find(r => r.steg === 'avbojd' && r.status === 'skickad');
    if (gått) {
      return bekräfta({
        titel: 'Avböja ' + vem + '?',
        text: vem + ' fick ett nej ' + kortDatum(gått.uppdaterad) + '. Ett nej mejlas en gång, så inget nytt mejl går.',
        knapp: 'Avböj',
        avbryt: 'Avbryt'
      });
    }
    const namn = förnamn(a.name);
    return bekräfta({
      titel: 'Avböja och mejla ' + vem + '?',
      text: vem + ' får mejlet nedan ' + nejNär() + '. Byter du läget innan dess går det inte iväg.',
      forhandsvisning: 'Ämne: ' + NEJ_MEJLET.amne + '\n\n'
        + (namn ? 'Hej ' + namn + ',' : 'Hej,') + '\n\n'
        + NEJ_MEJLET.rubrik + '\n\n'
        + NEJ_MEJLET.mening + '\n\n'
        + NEJ_MEJLET.avslutning,
      knapp: 'Avböj och mejla',
      avbryt: 'Avbryt'
    });
  }

  /* Det de skrev under "Varför", utan CV-raden: den står som en knapp
     i panelen i stället för som en sökväg. */
  function ansökansText(a) {
    return String(a.why || '').replace(CV_RAD, '').replace(CV_FEL, '').trim();
  }

  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, {
    ansökansText, bekräftaNej, cvKnapp, hämtaBesked, provKort, provKnapp, ritaAnsokningar, spårLista,
    vhFakta, vhSvar
  });
})();
