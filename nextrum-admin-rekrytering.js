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

  const { S, fråga, funktionsFel, gmailAdress, hämtaAllt, hämtaMatchunderlag, kontaktaRuta,
          kortDatum, läge, matchar, märkFlik, namnlista, närText, ritaPanelen, tomtText, visaRuta,
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

  /* ============================================================
     VAR I REKRYTERINGEN (2026-10-13)

     Leo: "gör en knapp för att skicka vidare från alla ansökningar till
     intervju och sedan utbildningar så att man kan skicka runt anställd
     och hålla koll på de". Fliken Intervju tog förut varje ansökan som
     inte var avgjord, så Alla och Intervju var samma lista och ingen
     hade valt vem som gick vidare.

     Steget räknas ur det ansökan bär: valet att gå vidare är Intervju
     (nedan), "Mötet är hållet" eller ett hållet utbildningsmöte är Utbildning, och
     Utbildad väntar på poolen. Flikarna, listan och filtret läser samma
     funktion, så en person står på ett ställe.

     INTERVJU ÄR ETT VAL, INTE ETT LÄGE (2026-10-15). Leo: "de fyra
     stadierna ... är ny, kontaktad, godkänd eller avböjd. detta innebär
     att jag klickar själv i de vid klick av profil ... så i intervjudelen
     ska namn bara finnas där som jag har klickat i att de ska vidare till
     intervju." Intervju räknades förut ur läget Kontaktad, och sju av nio
     ansökningar i driften stod där för att Leo hört av sig till dem.
     Steget har nu en egen tidsstämpel (till_intervju_at, migrationen
     ansokan_till_intervju), som bara Skicka vidare till intervju och ett
     bokat möte sätter, och läget ändras bara när Leo trycker på det.
     Utan kolumnen räknas Intervju som förut, ur läget.
     ============================================================ */
  const harIntervjuKolumn = a => !!a && 'till_intervju_at' in a;

  function ansSteg(a) {
    if (a.status === 'rejected') return 'avbojd';
    if (a.status === 'approved') return 'godkand';
    if (a.utbildad_at) return 'utbildad';
    /* Den som redan har ett utbildningsmöte hör hit, också utan att
       mötet innan är avbockat (2026-09-29): utbildningsmötet går att
       bocka av före steg 2. */
    if (a.intervju_at || a.utbildningsmote_at) return 'utbildning';
    if (harIntervjuKolumn(a) ? a.till_intervju_at
      : (a.status === 'contacted' || a.kontaktad_at || a.mote_tid)) return 'intervju';
    return 'ny';
  }

  /* Den som inte skickats vidare står i listan med läget Leo satt, Ny
     eller Kontaktad, och filtret skiljer dem åt. */
  function listSteg(a) {
    const st = ansSteg(a);
    return st === 'ny' && a.status === 'contacted' ? 'kontaktad' : st;
  }

  const ANS_STEG = {
    ny: ['Ny', 'ar-ny'], kontaktad: ['Kontaktad', 'ar-vantar'], intervju: ['Intervju', 'ar-vantar'],
    utbildning: ['Utbildning', 'ar-vantar'], utbildad: ['Klar för poolen', 'ar-ny'], godkand: ['Godkänd', 'ar-klar'],
    avbojd: ['Avböjd', '']
  };
  const stegLäge = a => läge(ANS_STEG, listSteg(a));

  /* Namnen, med steget. Uppgifterna, CV:t och rekryteringens steg står
     i panelen: Ansökan och Rekryteringen (nextrum-admin-detalj.js).
     Söket går fortfarande mot allt de skrev. Filtret är steget, och
     Utbildning tar med den som är klar för poolen. */
  function ritaAnsokningar() {
    const sök = $('#ans-sok').value.trim();
    const st = $('#ans-status').value;
    const iSteg = a => !st || listSteg(a) === st || (st === 'utbildning' && ansSteg(a) === 'utbildad');
    const rader = S.ansokningar
      .filter(iSteg)
      .filter(a => matchar(a, ['name', 'email', 'school', 'subjects', 'why'], sök));

    $('#ans-antal').textContent = rader.length + ' av ' + S.ansokningar.length;
    $('#ans-tabell').innerHTML = namnlista(rader, {
      typ: 'ansokan', id: a => a.id,
      namn: a => a.name || a.email,
      läge: stegLäge,
      /* Den som kom in sedan du tittade senast (2026-10-05, ärNyNu). */
      nytt: a => ärNyNu('ansokningar', a),
      under: a => (ärNyNu('ansokningar', a) ? 'Ny sedan du tittade senast · ' + närText(a.created_at) : ''),
      knapp: a => ansSteg(a) === 'ny' ? vidareKnapp('intervju', a, 'Till intervju') : '',
      tomt: tomtText(sök || st, 'Ingen ansökan matchar filtret', 'Inga ansökningar än')
    });

    ritaStegflikar();
    ritaPanelen();
  }

  function vidareKnapp(steg, a, text, primär) {
    return '<button type="button" class="btn ' + (primär ? 'btn-primary' : 'btn-ghost') + ' btn-sm" data-ans-vidare="'
      + steg + ':' + esc(a.id) + '">' + esc(text) + '</button>';
  }

  /* Samma knapp i ansökans panel, under läget (2026-10-15). Leo: "där
     det passar ska det också finnas skicka vidare till intervju, det är
     då för nya ansökningar ... sen när de ligger i intervju så finns det
     att skicka vidare till utbildnings sektionen." Tom när hen redan är
     längre fram, eller avgjord. */
  function panelVidare(a) {
    const st = ansSteg(a);
    if (st === 'ny') return vidareKnapp('intervju', a, 'Skicka vidare till intervju', true);
    if (st === 'intervju') return vidareKnapp('utbildning', a, 'Skicka vidare till utbildning', true);
    return '';
  }

  /* ============================================================
     INTERVJU OCH UTBILDNING (Fas 6, knapparna 2026-10-13)

     Rekryteringens två steg som egna flikar: vem som gått vidare till en
     intervju, och vem som är i utbildningen eller klar med den men inte
     intagen. Namnen, och under dem var de står, för det är vad flikarna
     svarar på. Varje rad har sitt nästa steg som en knapp; resten bockas
     av i panelen, som öppnas på fliken Rekryteringen. Avböjda och
     godkända ligger bara under Alla.
     ============================================================ */
  function ritaStegflikar() {
    /* I den ordning de skickades hit (2026-10-15), förut när de kontaktades. */
    const hit = a => String(a.till_intervju_at || a.kontaktad_at || a.created_at);
    const tillIntervju = S.ansokningar.filter(a => ansSteg(a) === 'intervju')
      .sort((a, b) => hit(a).localeCompare(hit(b)));
    const sedan = a => String(a.intervju_at || a.utbildningsmote_at || '');
    const tillUtbildning = S.ansokningar.filter(a => ansSteg(a) === 'utbildning' || ansSteg(a) === 'utbildad')
      .sort((a, b) => sedan(a).localeCompare(sedan(b)));

    märkFlik('#flik-ans-intervju-mark', tillIntervju.length);
    märkFlik('#flik-ans-utbildning-mark', tillUtbildning.length);

    const intervju = $('#ans-intervju');
    if (intervju) {
      $('#ans-intervju-antal').textContent = tillIntervju.length ? tillIntervju.length + ' st' : '';
      intervju.innerHTML = namnlista(tillIntervju, {
        typ: 'ansokan', id: a => a.id, flik: 'rekrytering',
        namn: a => a.name || a.email,
        /* Läget Kontaktad räknas också: Leo sätter det själv, oftast utan
           att ha skrivit härifrån (2026-10-15). */
        under: a => a.mote_tid ? 'Möte ' + (mötesText(a) || '')
          : a.kontaktad_at ? 'Kontaktad ' + kortDatum(a.kontaktad_at)
            : a.status === 'contacted' ? 'Kontaktad' : 'Inte kontaktad än',
        knapp: a => vidareKnapp('utbildning', a, 'Till utbildning'),
        tomt: 'Ingen är på väg till en intervju. Skicka hit från Alla ansökningar.'
      });
    }

    const utbildning = $('#ans-utbildning');
    if (utbildning) {
      $('#ans-utbildning-antal').textContent = tillUtbildning.length ? tillUtbildning.length + ' st' : '';
      utbildning.innerHTML = namnlista(tillUtbildning, {
        typ: 'ansokan', id: a => a.id, flik: 'rekrytering',
        namn: a => a.name || a.email,
        under: a => a.utbildad_at
          ? 'Utbildad ' + kortDatum(a.utbildad_at) + ' · klar att tas in i poolen'
          : a.utbildningsmote_at
            ? 'Utbildningsmöte ' + kortDatum(a.utbildningsmote_at) + ' · inte markerad utbildad än'
            : 'Intervjuad ' + kortDatum(a.intervju_at) + ' · utbildningsmötet inte hållet än',
        /* Nästa steg: in i poolen när hen är utbildad, annars det steg i
           utbildningen som står kvar (utbKnapp). */
        knapp: a => a.utbildad_at
          ? '<button type="button" class="btn btn-ghost btn-sm" data-ans-pool="' + esc(a.id) + '">Ta in i poolen</button>'
          : utbKnapp(a),
        tomt: 'Ingen är i utbildningen. Skicka hit från Intervju.'
      });
    }
  }

  /* Utbildningens nästa steg på en rad i fliken (2026-10-21, när provet
     i ansökan togs bort och knappen för att öppna det gick med):
     utbildningsmötet först, sedan Markera utbildad, som mejlar sista
     steget och därför frågar först. Samma data-attribut som stegens
     knappar i Rekryteringen, så att det är samma handling med samma
     frågor. Tom när ansökan är avgjord. */
  function utbKnapp(a) {
    if (a.utbildad_at || a.status === 'approved' || a.status === 'rejected') return '';
    const id = esc(a.id);
    return a.utbildningsmote_at
      ? '<button type="button" class="btn btn-ghost btn-sm" data-ans-steg="utbildad:' + id + '">Markera utbildad</button>'
      : '<button type="button" class="btn btn-ghost btn-sm" data-ans-steg="utbmote:' + id + '">'
        + 'Utbildningsmötet är hållet</button>';
  }

  /* ---- skicka vidare: till intervju, till utbildning (2026-10-13) ----
     Till intervju sätter steget och mejlar ingenting, så den går utan
     fråga; tillbaka är Ångra i Rekryteringen. Läget rör den inte
     (2026-10-15): det sätter Leo själv. Utan kolumnen sätter den läget
     Kontaktad, som förut. Till utbildning är "Mötet är hållet" i
     Rekryteringen, och det mejlar ett tack som säger att introduktionen
     är nästa steg. Ett mejl går inte att ta tillbaka, och knappen står
     ett tryck från listan, så den frågar först. */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-ans-vidare]');
    if (!knapp) return;
    const [steg, id] = knapp.dataset.ansVidare.split(':');
    const a = S.ansokningar.find(x => x.id === id);
    if (!a) return;

    let ändring;
    if (steg === 'intervju') {
      if (ansSteg(a) !== 'ny') return;
      if (!(await bekräftaIntervju(a))) return;
      ändring = harIntervjuKolumn(a) ? { till_intervju_at: new Date().toISOString() } : { status: 'contacted' };
    } else if (steg === 'utbildning') {
      if (ansSteg(a) !== 'intervju') return;
      const ja = await bekräfta({
        titel: 'Skicka ' + (a.name || 'den sökande') + ' till utbildningen?',
        text: 'Intervjun markeras som hållen, och ' + (a.name || 'hen') + ' får ett mejl som tackar för '
          + 'mötet och säger att introduktionen är nästa steg. Utbildningsmötet och Markera utbildad bockar '
          + 'du sedan av under fliken Utbildning.',
        knapp: 'Skicka till utbildningen',
        avbryt: 'Avbryt'
      });
      if (!ja) return;
      ändring = { intervju_at: new Date().toISOString() };
    } else {
      return;
    }

    await medan(knapp, '…', async () => {
      const { data, error } = await supa.from('applications')
        .update(ändring).eq('id', a.id).select('*').maybeSingle();
      if (error || !data) { alert('Kunde inte spara: ' + (error ? felText(error) : 'ingen rad ändrades')); return; }
      Object.assign(a, data);
      if (steg === 'utbildning') await hämtaBesked(a.id);
      ritaOm();
    });
  });

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
  /* Mejlet går härifrån, från info@, genom ansokan-mejl (2026-10-20).
     Funktionen tar adressen ur ansökan, så bara id:t skickas. Svaret är
     felet som text, eller null när mejlet gått. */
  async function skickaTill(a, brev) {
    const { data, error } = await supa.functions.invoke('ansokan-mejl',
      { body: { ansokan: a.id, amne: brev.amne, text: brev.text, forsok: brev.forsok } });
    /* En funktion som inte är driftsatt svarar 404 med Supabases egen text
       på engelska: säg vad det betyder i stället. */
    if (error && error.context && error.context.status === 404) return 'ansokan-mejl är inte driftsatt än.';
    if (error) return await funktionsFel(error);
    return data && data.ok ? null : 'Okänt svar.';
  }

  /* Bokningssidan i Google Kalender (2026-10-20, INTERVJU_BOKNING_URL).
     Bara en https-adress, som möteslänken: mejlet går ut med vår
     avsändare, och en adress som inte är en länk hade stått som text. */
  function bokningssida() {
    const u = String(CFG.INTERVJU_BOKNING_URL || '').trim();
    return /^https:\/\/\S+$/.test(u) ? u : '';
  }

  function mallIntervju(a) {
    const sida = bokningssida();
    return 'Hej ' + (String(a.name || '').split(' ')[0] || '') + ',\n\n'
      + 'Tack för din ansökan till Nextrum. Vi har läst den och skulle gärna '
      + 'prata med dig en kvart om hur du tänker kring att hjälpa andra att plugga.\n\n'
      + (sida
        ? 'Välj en tid som passar dig här:\n' + sida + '\n\n'
          + 'Vi ses i Google Meet, och länken kommer i bekräftelsen när du bokat. Du behöver '
          + 'inget Google-konto. Passar ingen av tiderna kan du svara på det här mejlet, så '
          + 'hittar vi en annan.\n\n'
        : 'Passar någon av de här tiderna?\n'
          + '  · \n  · \n  · \n\n')
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
      + 'rapporten finns, och det är den som gör att familjen betalar och att du får '
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
      skicka: brev => skickaTill(a, brev),
      efterat: async () => {
        const nu = new Date().toISOString();
        const ändring = { kontaktad_at: nu, status: a.status === 'new' ? 'contacted' : a.status };
        /* Med bokningssidan är mejlet kallelsen till intervjun
           (2026-10-20): hen bokar själv, och inget Boka möte här skickar
           hen vidare, som ett bokat möte annars gör. Utan sidan är det
           bara en kontakt, som förut. */
        if (bokningssida() && harIntervjuKolumn(a) && ansSteg(a) === 'ny') ändring.till_intervju_at = nu;
        const { error } = await supa.from('applications').update(ändring).eq('id', a.id);
        if (error) { alert('Det sparades inte att du skrev till hen: ' + felText(error)); return; }
        Object.assign(a, ändring);
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

    const kolumn = { tillintervju: 'till_intervju_at', intervju: 'intervju_at', utbmote: 'utbildningsmote_at' }[steg]
      || 'utbildad_at';
    const nu = a[kolumn] ? null : new Date().toISOString();
    /* Till intervju och tillbaka (2026-10-15) går bara medan hen är ny
       eller i Intervju: längre fram är det de senare stegen som ångras. */
    if (kolumn === 'till_intervju_at'
        && (!harIntervjuKolumn(a) || ansSteg(a) !== (nu ? 'ny' : 'intervju'))) return;
    if (kolumn === 'till_intervju_at' && nu && !(await bekräftaIntervju(a))) return;

    /* Markera utbildad mejlar sista steget direkt: att vi skapar hens
       konto. Ett mejl går inte att ta tillbaka, och knappen står också
       i fliken Utbildning, ett tryck från listan, så den frågar först.
       Utbildningsmötet mejlar ingenting och går utan fråga: det öppnade
       provet i ansökan, som togs bort 2026-10-21. Provet görs nu i
       studiehjälparvyn, direkt efter lösenordet. Mejlet går en gång per
       ansökan (nyckeln i ansokan_utskick), så finns raden redan mejlas
       inget, och då frågar den inte heller. */
    const sistaStegetFinns = (S.ansokanUtskick[a.id] || []).some(r => r.steg === 'sista_steget');
    if (kolumn === 'utbildad_at' && nu && !sistaStegetFinns) {
      const ja = await bekräfta({
        titel: 'Markera ' + (a.name || 'den sökande') + ' som utbildad?',
        text: (a.name || 'Den sökande') + ' får mejlet om sista steget direkt: att vi skapar hens konto '
          + 'när profilen är godkänd. Provet om handledarhandboken gör hen i studiehjälparvyn, direkt '
          + 'efter att lösenordet är valt.',
        knapp: 'Markera utbildad',
        avbryt: 'Avbryt'
      });
      if (!ja) return;
    }

    await medan(knapp, '…', async () => {
      /* Raden tillbaka, så att rutan visar det databasen satte utan en
         ny hämtning. */
      const { data, error } = await supa.from('applications')
        .update({ [kolumn]: nu }).eq('id', id).select('*').single();
      if (error) { alert('Kunde inte spara: ' + felText(error)); return; }
      Object.assign(a, data || { [kolumn]: nu });
      await hämtaBesked(id);
      ritaOm();
    });
  });

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
    sista_steget: 'Sista steget',
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

     Sedan 2026-10-20 kan mejlet i steg 1 bära länken till en
     bokningssida i Google Kalender (INTERVJU_BOKNING_URL). Där bokar
     den sökande själv, och Google mejlar tiden och Meet-länken. Ingen
     koppling: vyn läser aldrig kalendern, så en bokning syns här först
     om någon sparar den med Boka möte.
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

  /* Steg 1: skicka vidare, eller ångra medan hen står under Intervju
     (2026-10-15). Ingen knapp utan kolumnen, eller när hen redan är
     längre fram: då är det de senare stegen som ångras. */
  function tillIntervjuKnapp(a) {
    if (!harIntervjuKolumn(a)) return '';
    const st = ansSteg(a);
    if (st !== 'ny' && st !== 'intervju') return '';
    return '<button type="button" class="btn btn-ghost btn-sm" data-ans-steg="tillintervju:' + esc(a.id) + '">'
      + (st === 'ny' ? 'Skicka vidare till intervju' : 'Ångra "till intervju"') + '</button> ';
  }

  /* Fliken Rekryteringen i panelen (dpAnsokan i nextrum-admin-detalj.js). */
  function spårLista(a) {
    const id = esc(a.id);
    const möte = mötesText(a);
    const utbLänk = String(CFG.UTBILDNING_URL || '').trim();
    const sida = bokningssida();
    const harKolumn = harIntervjuKolumn(a);

    return '<div class="ans-spar-lista">'

      /* Steg 1 är valet att gå vidare, med kontakten i (2026-10-15).
         Förut var det bara kontakten, och läget Kontaktad var intervjun. */
      + spårSteg(1, 'Till intervju',
          (harKolumn && harIntervjumejl(a)
            ? 'Du väljer vem som går vidare: hen hamnar under fliken Intervju och får mejlet "Du går vidare '
              + 'till intervju" med länken till bokningssidan, där hen bokar en tid själv, en gång per ansökan. '
              + 'Kommer steget med ett bokat möte, eller med kallelsen när du skriver till hen, mejlas bara den. '
              + 'Läget (Ny, Kontaktad) sätter du själv under Ansökan, och det flyttar ingen. '
            : harKolumn
            ? 'Du väljer vem som går vidare: hen hamnar under fliken Intervju, och ingenting mejlas. '
              + 'Läget (Ny, Kontaktad) sätter du själv under Ansökan, och det flyttar ingen. '
            : 'Läget Kontaktad flyttar hen till fliken Intervju tills migrationen '
              + 'ansokan_till_intervju är körd. ')
          + 'Kvittot på ansökan har redan gått av sig självt. '
          + (sida && harKolumn && harIntervjumejl(a)
            ? 'Vill du skriva något eget skriver du till hen i stället, också med länken. Mejlet går från '
              + 'info@nextrum.se, och svaret kommer dit. När du skickat det hamnar hen under Intervju.'
            : sida
            ? 'Skriv till hen med länken till bokningssidan, där hen väljer en tid själv. Mejlet går '
              + 'från info@nextrum.se, och svaret kommer dit. När du skickat det hamnar hen under Intervju.'
            : 'Skriv till hen för att föreslå tider för mötet. Mejlet går från info@nextrum.se, och '
              + 'svaret kommer dit.'),
          harKolumn ? a.till_intervju_at : a.kontaktad_at,
          tillIntervjuKnapp(a)
          + '<button type="button" class="btn btn-ghost btn-sm" data-ans-kontakt="' + id + '">'
          + (a.kontaktad_at ? 'Skriv igen' : 'Skriv till hen') + '</button>',
          (harKolumn && a.kontaktad_at
            ? '<div class="ans-steg-fakta"><b>Skrev till hen:</b> ' + esc(kortDatum(a.kontaktad_at)) + '</div>'
            : '')
          + (a.intervju_mejl_skickat_at
            ? '<div class="ans-steg-fakta"><b>Intervjumejlet:</b> köat ' + esc(kortDatum(a.intervju_mejl_skickat_at))
              + '</div>'
            : '')
          /* Var den sätts står här, som för utbildningslänken: den som
             läser det här är den som ska sätta den. */
          + (sida
            ? '<div class="ans-steg-fakta"><b>Bokningssida:</b> ' + esc(sida) + '</div>'
            : '<div class="ans-steg-fakta">Ingen bokningssida är satt, så mejlet föreslår tider. '
              + 'Lägg länken till bokningsschemat i Google Kalender i <code>INTERVJU_BOKNING_URL</code> '
              + 'i nextrum-config.js, så kommer den med i mejlet.</div>')
          + besked(a, 'mottagen') + besked(a, 'vardnadshavare'))

      + spårSteg(2, 'Digitalt möte',
          'En kvart över video. Det är ett samtal, inget prov — vi vill höra hur hen '
          + 'förklarar saker och vilka ämnen hen är trygg i. '
          + (sida
            ? 'Hen bokar på bokningssidan, och Google mejlar tiden och Meet-länken: mötet står i '
              + 'kalendern för info@nextrum.se, inte här. Boka möte behövs bara när ni bestämt tiden '
              + 'på annat sätt, för det du sparar här mejlas till hen också när hen redan bokat. '
            : 'Tiden och länken mejlas till hen när du sparar dem, och igen om du ändrar dem. Ett '
              + 'bokat möte skickar hen vidare till Intervju, om du inte redan gjort det. ')
          + '"Mötet är hållet" är Skicka vidare till utbildning: '
          + 'det mejlar ett tack och säger att introduktionen är nästa steg.',
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
          'Utbildningsmötet och introduktionen. Det här steget är inte en artighet: en studiehjälpare '
          + 'som inte vet hur rapporten fungerar lämnar inga rapporter, och utan rapport blir '
          + 'passet aldrig genomfört, varken betalt eller utbetalt. "Utbildningsmötet är hållet" '
          + 'bockar av mötet och mejlar ingenting. "Markera utbildad" mejlar sista steget: att vi '
          + 'skapar hens konto. Provet om handledarhandboken gör hen i studiehjälparvyn, direkt '
          + 'efter att lösenordet är valt (Ansökningar → Provet).',
          a.utbildad_at,
          (utbLänk
            ? '<button type="button" class="btn btn-ghost btn-sm" data-ans-utb="' + id + '">'
              + 'Skicka utbildningen</button> '
            : '')
          + '<button type="button" class="btn btn-ghost btn-sm" data-ans-steg="utbmote:' + id + '">'
          + (a.utbildningsmote_at ? 'Ångra "utbildningsmötet är hållet"' : 'Utbildningsmötet är hållet')
          + '</button> '
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
          + besked(a, 'sista_steget'))

      + spårSteg(4, 'In i poolen',
          'Profilen blir godkänd och dyker upp i matchningen, och hen får ett välkomstmejl. '
          + 'Har hen inget konto skapas det här, med adressen i ansökan, och hen får ett mejl '
          + 'med en länk där hen väljer sitt lösenord. Sedan gör hen provet om handledarhandboken, '
          + 'och tills hen klarat det ser hen inga elever (Ansökningar → Provet).',
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
        + 'länken skapar du själv i Google Meet.'
        + (bokningssida() ? ' Har hen bokat på bokningssidan har Google redan mejlat tiden och länken.' : ''),
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
    const ändring = { mote_tid: när.toISOString(), mote_lank: svar.länk };
    /* Mötet är intervjun: den som inte skickats vidare dit gör det nu
       (2026-10-15). Annars hade hen haft ett bokat möte och stått kvar
       under Alla ansökningar. */
    if (harIntervjuKolumn(a) && ansSteg(a) === 'ny') ändring.till_intervju_at = new Date().toISOString();
    const { error } = await supa.from('applications').update(ändring).eq('id', a.id);
    if (error) { alert('Kunde inte spara mötet: ' + felText(error)); return; }
    Object.assign(a, ändring);
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
      text: mallUtbildning(a),
      skicka: brev => skickaTill(a, brev)
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
  /* Kontot ansökan hör till. Har ingen adressen i ansökan står Skapa
     kontot först och är valt (2026-10-06): Leo, "när man ska ta in en
     anställd är det krångligt att skapa konto åt den". Kontot skapas av
     bjud-in när knappen trycks, och hen får länken där hen väljer
     lösenordet. Den som redan registrerat sig själv står i listan som
     förut. */
  const NYTT_KONTO = '__nytt';

  function adressensKonto(ans) {
    const epost = String(ans.email || '').trim().toLowerCase();
    return epost ? Object.values(S.personer).find(p =>
      !ärRaderad(p) && String(p.email || '').toLowerCase() === epost) || null : null;
  }

  function tutorVal(valt, ans) {
    /* Bara konton som INTE redan är i poolen. Att erbjuda en redan
       godkänd studiehjälpare i listan är att be om att någons ämnen
       skrivs över av en ansökan från en annan person. */
    const kandidater = Object.values(S.personer)
      .filter(p => p.role === 'tutor' && !ärRaderad(p))
      .filter(p => (S.tutorProfiler[p.id] || {}).status !== 'approved')
      .sort((a, b) => String(a.full_name || a.email || '')
        .localeCompare(String(b.full_name || b.email || ''), 'sv'));
    const epost = String(ans.email || '').trim();
    const upptagen = adressensKonto(ans);
    const kanSkapa = NX.epostOk(epost) && !upptagen;

    if (!kandidater.length && !kanSkapa) {
      return '<p class="xsmall" style="color:var(--acc-text);margin:0">'
        + (upptagen
          ? 'Adressen i ansökan har redan ett konto som inte går att ta in som studiehjälpare här. '
            + 'Öppna kontot under Familjer eller Studiehjälpare.'
          : 'Adressen i ansökan går inte att skicka till. Rätta den under Redigera uppgifterna, '
            + 'så skapas kontot här.') + '</p>';
    }

    return '<select class="inp" id="ap-konto">'
      + (kanSkapa
        ? '<option value="' + NYTT_KONTO + '"' + (valt ? '' : ' selected') + '>Skapa kontot med '
          + esc(epost.toLowerCase()) + '</option>'
        : '<option value="">Välj konto…</option>')
      + kandidater.map(t => '<option value="' + esc(t.id) + '"'
          + (t.id === valt ? ' selected' : '') + '>'
          + esc(t.full_name || t.email || t.id) + (t.email ? ' · ' + esc(t.email) : '')
          + '</option>').join('')
      + '</select>';
  }

  /* Raden under kontovalet säger vad som händer med det valda. */
  function kontoText(värde) {
    return värde === NYTT_KONTO
      ? 'Kontot skapas när du trycker, och hen får ett mejl från Nextrum med en länk där hen väljer sitt '
        + 'lösenord. Efter lösenordet går hen igenom introduktionen.'
      : 'Hen loggar in med kontot hen redan har.';
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
       rapport blir passet aldrig genomfört, alltså aldrig betalt och
       aldrig utbetalt. Kedjan går isär i andra änden. */
    if (!ans.utbildad_at) {
      const ändå = await bekräfta({
        titel: 'Introduktionen är inte gjord',
        text: (ans.name || 'Den sökande') + ' är inte markerad som utbildad. En studiehjälpare '
          + 'som inte vet hur rapporten fungerar lämnar inga rapporter, och då blir passen '
          + 'aldrig genomförda — varken betalda eller utbetalda. Markera Utbildad under '
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
      + '<div class="fgroup"><label for="ap-konto">Konto</label>' + tutorVal(trolig && trolig.id, ans)
      + '<p class="xsmall" id="ap-konto-text" style="color:var(--muted-2);margin-top:6px;line-height:1.6"></p></div>'
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

    const kontoFält = $('#ap-konto', ruta);
    const visaKontoText = () => {
      $('#ap-konto-text', ruta).textContent = kontoFält && kontoFält.value ? kontoText(kontoFält.value) : '';
      $('#ap-godkann', ruta).textContent = kontoFält && kontoFält.value === NYTT_KONTO
        ? 'Ta in och skicka inbjudan' : 'Ta in i poolen';
    };
    if (kontoFält) kontoFält.addEventListener('change', visaKontoText);
    visaKontoText();

    $('#ap-godkann', ruta).addEventListener('click', async () => {
      const msg = $('#ap-msg', ruta);
      rensa(msg);
      let konto = kontoFält ? kontoFält.value : '';
      const skapas = konto === NYTT_KONTO;
      const timpenning = Number($('#ap-timpenning', ruta).value);
      if (!konto) { säg(msg, 'Välj vilket konto ansökan hör till.', false); return; }
      if (!timpenning || timpenning < 1) { säg(msg, 'Fyll i timpenningen.', false); return; }

      await medan($('#ap-godkann', ruta), 'Tar in…', async () => {
        /* Kontot först, när det ska skapas. bjud-in skapar det med
           rollen tutor, och handle_new_user lägger profilen i väntläge;
           godkännandet nedan är samma som för ett konto som fanns. */
        if (skapas) {
          const res = await supa.functions.invoke('bjud-in', {
            body: { epost: ans.email, namn: ans.name || '', roll: 'tutor' }
          });
          const fel = res.error || (res.data && res.data.error);
          if (fel) { säg(msg, 'Kontot gick inte att skapa: ' + await funktionsFel(fel), false); return; }
          konto = res.data.id;
          await hämtaAllt();
        }

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

        if (error) {
          säg(msg, (skapas
            ? 'Kontot är skapat och inbjudan skickad, men profilen kunde inte godkännas: '
              + felText(error) + '. Stäng rutan och tryck Ta in i poolen igen.'
            : 'Kunde inte ta in: ' + felText(error)), false);
          return;
        }

        await supa.from('applications').update({ status: 'approved' }).eq('id', ans.id);
        ans.status = 'approved';

        /* Ett nytt konto får ett kvitto: två mejl går (länken från Auth
           och välkomstmejlet), och admin ska veta vilket hen väntar på. */
        if (skapas) {
          ruta.querySelector('.nx-fraga-box').innerHTML =
            '<h3>' + esc(ans.name || 'Hen') + ' är intagen</h3>'
            + '<p>Profilen är godkänd och syns i matchningen. Ett mejl med en länk har gått till <b>'
            + esc(String(ans.email || '').toLowerCase()) + '</b>: där väljer hen sitt lösenord och går sedan '
            + 'igenom introduktionen. Välkomstmejlet går som vanligt.</p>'
            + '<p class="xsmall" style="color:var(--muted-2)">Kommer inget fram: öppna hen under '
            + 'Studiehjälpare och tryck Skicka inbjudan igen.</p>'
            + '<div class="nx-fraga-knappar"><button type="button" class="btn btn-primary" data-ap-stang>Stäng</button></div>';
        } else {
          stäng();
        }
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
      ? gmailAdress(a.vardnadshavare_epost)
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

  /* ============================================================
     INTERVJUMEJLET (2026-10-21)

     Skicka vidare till intervju köar ett mejl till den som sökt, en gång
     per ansökan (intern.ansokan_intervjumejl, genom notiskön). Det går
     direkt, så frågan visar mejlet först, som nejet.

     TEXTEN ÄR LEOS OCH STÅR PÅ TVÅ STÄLLEN: här och i mallen (INTERVJU
     i supabase/functions/_delad/notiser/intervju.ts).
     verktyg/kolla-mejltexter.py håller dem lika. Länken till
     bokningssidan (2026-10-20, Leo) står med i mejlet och ska vara
     INTERVJU_BOKNING_URL, som kontrollen också prövar: mallen kan inte
     läsa configen, så frågan visar mallens adress, inte bokningssida().
     ============================================================ */
  const INTERVJU_MEJLET = {
    amne: 'Du går vidare till intervju',
    forsta: 'Tack för din ansökan till Nextrum. Vi har läst den och du går vidare till intervjufasen.',
    boka: 'Boka en tid för intervjun som passar dig här:',
    lank: 'https://calendar.app.google/rRiTTLP5ymKQunSv7',
    andra: 'Intervjun hålls i Google Meet, och länken till mötet kommer i bekräftelsen när du har bokat. '
      + 'Du behöver inget Google-konto. Passar ingen av tiderna får du gärna mejla oss på info@nextrum.se.',
    halsning: 'Hälsningar',
    signatur: 'Leo och Alex, Nextrum'
  };

  /* Utan migrationen intervjumejlet köar databasen inget, och frågan
     hade lovat ett mejl som aldrig går. */
  const harIntervjumejl = a => !!a && 'intervju_mejl_skickat_at' in a;

  /* Frågan innan steget sätts. Svarar true när det får sättas. */
  async function bekräftaIntervju(a) {
    if (!harIntervjumejl(a) || a.status === 'rejected') return true;
    const vem = a.name || 'Den sökande';
    if (a.intervju_mejl_skickat_at) {
      return bekräfta({
        titel: 'Skicka ' + vem + ' vidare till intervju?',
        text: vem + ' fick intervjumejlet ' + kortDatum(a.intervju_mejl_skickat_at)
          + '. Det mejlas en gång, så inget nytt mejl går.',
        knapp: 'Skicka vidare',
        avbryt: 'Avbryt'
      });
    }
    const namn = förnamn(a.name);
    return bekräfta({
      titel: 'Skicka ' + vem + ' vidare till intervju?',
      text: vem + ' får mejlet nedan inom några minuter. Det går en gång per ansökan, också om du ångrar steget.',
      forhandsvisning: 'Ämne: ' + INTERVJU_MEJLET.amne + '\n\n'
        + (namn ? 'Hej ' + namn + '!' : 'Hej!') + '\n\n'
        + INTERVJU_MEJLET.forsta + '\n\n'
        + INTERVJU_MEJLET.boka + '\n'
        + INTERVJU_MEJLET.lank + '\n\n'
        + INTERVJU_MEJLET.andra + '\n\n'
        + INTERVJU_MEJLET.halsning + '\n'
        + INTERVJU_MEJLET.signatur,
      knapp: 'Skicka vidare och mejla',
      avbryt: 'Avbryt'
    });
  }

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
    ansökansText, bekräftaNej, cvKnapp, hämtaBesked, panelVidare, ritaAnsokningar, spårLista, stegLäge,
    vhFakta, vhSvar
  });
})();
