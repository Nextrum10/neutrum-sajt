/* ============================================================
   NEXTRUM — adminvyn, Ekonomi: fakturor, utbetalningar, avvikelser, månadskörning

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

  const { DAG, FAKT_LAGE, S, UTB_LAGE, elevNamn, fråga, funktionsFel,
          hämtaAllt, hämtaEkonomiunderlag, kortDatum, matchar, märkFlik,
          namnFör, pill, rad, skriv, tabell, väljare } = NXAdmin;
  /* Funktioner som bor i andra områden. Anropen går via
     NXAdmin.rita, som fylls när alla filer laddats. */
  const ritaÖversikt = (...a) => NXAdmin.rita.ritaÖversikt(...a);
  const skapaUppgift = (...a) => NXAdmin.rita.skapaUppgift(...a);

  /* ============================================================
     EKONOMI
     ============================================================ */

  /* ============================================================
     FAKTUROR (Fas 14.6)

     Familjen kan välja faktura på ett pass. Månadskörningen samlar
     varje familjs fakturapass på ett utkast här. Fakturan skapas och
     skickas sedan i WINT, som också bokför den och ser när den
     betalas. Härifrån skickas ingenting: det som sker här är att
     utkastet läggs in i Wint för hand, med underlaget nedan, och att
     Wints fakturanummer och förfallodag skrivs tillbaka. Betald
     markeras när Wint visar att pengarna kommit in.

     En API-koppling till Wint finns inte, med flit. Wint har inga
     webhooks och ingen testmiljö, och API-åtkomst kräver att Wint slår
     på den. Det manuella steget är en knapp i månaden per familj.

     Beloppen går inte att ändra härifrån. De räknades av fakturering
     ur passen, med samma pris som kortet tar, och las_fakturabelopp
     vägrar skriva om dem från en webbläsare.
     ============================================================ */
  const DAGAR = Number((NX.CFG && NX.CFG.BETALNINGSVILLKOR_DAGAR) || 10);

  /* Fakturapass som hölls men inte står på någon faktura än. De kommer
     med på nästa månadskörning. */
  const passPåFaktura = () => {
    const s = new Set();
    (S.fakturor || []).forEach(f => (f.invoice_lines || []).forEach(l => { if (l.booking_id) s.add(l.booking_id); }));
    return s;
  };

  function ritaFakturaFlagga() {
    const host = $('#fakt-flagga');
    if (!host) return;
    const f = S.fakturaFlagga;
    if (!f) {
      host.innerHTML = tomt('Strömbrytaren gick inte att läsa',
        S.kortsparrFel || 'Raden faktura saknas i flaggor. Kör migrationen för Fas 14.6.');
      return;
    }
    const spärrade = S.fakturaSparr ? S.fakturaSparr.size : 0;
    host.innerHTML = '<div class="adm-koppling-kort">'
      + '<h6>Faktura som betalsätt ' + (f.aktiv ? pill('På', 'ar-klar') : pill('Av', '')) + '</h6>'
      + '<p>' + esc(f.beskrivning || '') + '</p>'
      + (!f.aktiv && f.vantar_pa ? '<div class="adm-krav">Ska vara avgjort först: ' + esc(f.vantar_pa) + '</div>' : '')
      + '<p class="xsmall" style="color:var(--bl-3);margin-top:10px">'
      + (spärrade ? spärrade + (spärrade === 1 ? ' familj är avstängd' : ' familjer är avstängda')
          + ' från faktura (under Familjer, i familjens ekonomi). ' : '')
      + 'Ändrad ' + esc(kortDatum(f.uppdaterad)) + '</p>'
      + '<div style="margin-top:12px"><button class="btn ' + (f.aktiv ? 'btn-ghost' : 'btn-primary')
      + ' btn-sm" type="button" data-fakturaflagga="' + (f.aktiv ? '0' : '1') + '">'
      + (f.aktiv ? 'Stäng av' : 'Slå på') + '</button></div>'
      + '</div>';
  }

  function ritaFakturor() {
    ritaFakturaFlagga();
    const sök = $('#fakt-sok').value.trim();
    const st = $('#fakt-status').value;
    const rader = (S.fakturor || [])
      .filter(f => !st || NXBetalning.fakturaLage(f) === st)
      .map(f => ({ ...f, familj: namnFör(f.parent_id) }))
      .filter(f => matchar(f, ['familj', 'wint_fakturanummer'], sök));

    const på = passPåFaktura();
    const väntar = (S.bokningar || []).filter(b => b.betalning_status === 'faktura'
      && b.status === 'completed' && b.fakturerbar !== false && !på.has(b.id));
    const vänt = $('#fakt-vantar');
    if (vänt) {
      vänt.textContent = väntar.length
        ? väntar.length + (väntar.length === 1 ? ' genomfört fakturapass väntar' : ' genomförda fakturapass väntar')
          + ' på nästa månadskörning.'
        : '';
    }

    $('#fakt-antal').textContent = rader.length + ' av ' + (S.fakturor || []).length;
    $('#fakt-tabell').innerHTML = tabell([
      { namn: 'Period', rita: f => '<b>' + esc(NXBetalning.periodText(f.period)) + '</b>' },
      { namn: 'Familj', rita: f => esc(f.familj) },
      { namn: 'Pass', rita: f => '<span class="adm-tal">' + (f.invoice_lines || []).length + '</span>' },
      { namn: 'Belopp', rita: f => '<span class="adm-tal">' + esc(kronor(f.belopp_ore)) + '</span>' },
      { namn: 'I Wint', rita: f => f.wint_fakturanummer
        ? '<span class="adm-tal">' + esc(f.wint_fakturanummer) + '</span>'
        : '<span class="adm-und">inte inlagd</span>' },
      { namn: 'Förfaller', rita: f => '<span class="adm-tal">' + esc(kortDatum(f.forfaller)) + '</span>' },
      { namn: 'Läge', rita: f => { const l = FAKT_LAGE[NXBetalning.fakturaLage(f)] || [f.status, '']; return pill(l[0], l[1]); } },
      /* Nästa steg för just den här fakturan, och bara det. Rullgardinen
         som förut bytte läge fritt är borta: Skickad utan Wints nummer
         och förfallodag är en rad ingen kan följa upp i Wint. */
      { namn: '', höger: true, rita: f => {
        const k = [];
        k.push('<button class="btn btn-ghost btn-sm" type="button" data-fakt-underlag="' + f.id + '">Underlag</button>');
        if (f.status === 'utkast') {
          k.push('<button class="btn btn-primary btn-sm" type="button" data-fakt-wint="' + f.id + '">Lagd i Wint</button>');
          k.push('<button class="btn btn-ghost btn-sm" type="button" data-fakt-bort="' + f.id + '">Ta bort</button>');
        } else if (f.status === 'skickad' || f.status === 'forfallen') {
          k.push('<button class="btn btn-primary btn-sm" type="button" data-fakt-betald="' + f.id + '">Betald</button>');
          k.push('<button class="btn btn-ghost btn-sm" type="button" data-fakt-makulera="' + f.id + '">Makulera</button>');
        }
        return k.join(' ');
      } }
    ], rader, (S.fakturor || []).length ? 'Inga fakturor matchar' : 'Inga fakturor än');
  }

  /* Underlaget för Wint: det som ska stå på fakturan, i den ordning
     Wint frågar efter det. Kunden är familjens namn och e-post; Wint
     skickar fakturan som PDF till adressen. Raderna säger ämne och
     datum, aldrig barnets namn. */
  function fakturaUnderlag(f) {
    const p = S.personer[f.parent_id] || {};
    const rader = (f.invoice_lines || []).slice().sort((a, c) => String(a.beskrivning).localeCompare(String(c.beskrivning)));
    return [
      'Kund: ' + (p.full_name || '—') + ' (privatperson)',
      'E-post: ' + (p.email || '—'),
      'Period: ' + NXBetalning.periodText(f.period),
      'Betalningsvillkor: ' + DAGAR + ' dagar, ingen avgift',
      '',
      ...rader.map(r => r.beskrivning + '  ·  ' + NXBetalning.timmar(r.minuter) + ' à '
        + kronor(r.pris_per_timme_ore) + '/h  ·  ' + kronor(r.belopp_ore)),
      '',
      'Att betala: ' + kronor(f.belopp_ore)
    ].join('\n');
  }

  document.addEventListener('click', async e => {
    const flagga = e.target.closest('[data-fakturaflagga]');
    if (flagga) {
      const på = flagga.dataset.fakturaflagga === '1';
      const f = S.fakturaFlagga || {};
      const ja = await bekräfta(på ? {
        titel: 'Slå på faktura?',
        text: 'Från och med nu kan alla familjer välja "Betala med faktura i stället" under kortknappen. '
          + 'Deras pass kommer med på en faktura i början av nästa månad, att betala inom ' + DAGAR + ' dagar.',
        forhandsvisning: f.vantar_pa ? 'Det här ska vara avgjort först:\n\n' + f.vantar_pa : null,
        knapp: 'Slå på'
      } : {
        titel: 'Stäng av faktura?',
        text: 'Familjerna kan inte längre välja faktura. Pass som redan valts för faktura faktureras ändå.',
        knapp: 'Stäng av'
      });
      if (!ja) return;
      await medan(flagga, på ? 'Slår på…' : 'Stänger av…', async () => {
        const { error } = await supa.from('flaggor').update({ aktiv: på }).eq('kod', 'faktura');
        if (error) { alert('Kunde inte ändra strömbrytaren: ' + felText(error)); return; }
        const { data } = await supa.from('flaggor').select('*').eq('kod', 'faktura').maybeSingle();
        if (data) S.fakturaFlagga = data;
        ritaFakturaFlagga();
      });
      return;
    }

    const und = e.target.closest('[data-fakt-underlag]');
    if (und) {
      const f = (S.fakturor || []).find(x => x.id === und.dataset.faktUnderlag);
      if (!f) return;
      const text = fakturaUnderlag(f);
      const kopiera = await bekräfta({
        titel: 'Underlag för Wint',
        text: 'Skapa en kundfaktura i Wint med de här uppgifterna, och skicka den som e-post. '
          + 'Tryck sedan Lagd i Wint och skriv in fakturanumret.',
        forhandsvisning: text,
        knapp: 'Kopiera',
        avbryt: 'Stäng'
      });
      if (kopiera) {
        try { await navigator.clipboard.writeText(text); }
        catch (fel) { alert('Kopieringen gick inte. Markera texten och kopiera den för hand.'); }
      }
      return;
    }

    const wint = e.target.closest('[data-fakt-wint]');
    if (wint) {
      const f = (S.fakturor || []).find(x => x.id === wint.dataset.faktWint);
      if (!f) return;
      const förval = new Date(Date.now() + DAGAR * 86400000);
      const värde = await fråga({
        titel: 'Lagd i Wint',
        text: namnFör(f.parent_id) + ', ' + NXBetalning.periodText(f.period) + ', ' + kronor(f.belopp_ore)
          + '. Skriv fakturanumret och förfallodagen som de står på fakturan i Wint.',
        innehåll: '<div class="fgroup" style="margin-top:14px"><label for="fakt-nr">Fakturanummer i Wint</label>'
          + '<input class="inp" id="fakt-nr" inputmode="numeric" autocomplete="off" maxlength="30"></div>'
          + '<div class="fgroup" style="margin-top:12px"><label for="fakt-forfaller">Förfaller</label>'
          + '<input class="inp" id="fakt-forfaller" type="date" value="' + isoFor(förval) + '"></div>',
        knapp: 'Spara',
        läs: ruta => {
          const nr = $('#fakt-nr', ruta).value.trim();
          const dag = $('#fakt-forfaller', ruta).value;
          if (!/^[A-Za-z0-9-]{1,30}$/.test(nr)) return { fel: 'Fakturanumret är siffror, bokstäver och bindestreck, som i Wint.' };
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dag)) return { fel: 'Välj förfallodagen.' };
          return { värde: { nr, dag } };
        }
      });
      if (!värde) return;
      await medan(wint, 'Sparar…', async () => {
        if (await skriv('invoices', f.id, {
          status: 'skickad', skickad_at: new Date().toISOString(),
          wint_fakturanummer: värde.nr, forfaller: värde.dag
        })) {
          Object.assign(f, { status: 'skickad', wint_fakturanummer: värde.nr, forfaller: värde.dag });
          ritaFakturor(); await laddaOmEkonomi();
        }
      });
      return;
    }

    const betald = e.target.closest('[data-fakt-betald]');
    if (betald) {
      const f = (S.fakturor || []).find(x => x.id === betald.dataset.faktBetald);
      if (!f) return;
      const ja = await bekräfta({
        titel: 'Har pengarna kommit in?',
        text: 'Faktura ' + (f.wint_fakturanummer || '') + ' till ' + namnFör(f.parent_id) + ', ' + kronor(f.belopp_ore)
          + '. Markera bara betald när Wint visar att betalningen kommit in.',
        knapp: 'Ja, den är betald'
      });
      if (!ja) return;
      await medan(betald, 'Sparar…', async () => {
        const nu = new Date().toISOString();
        if (await skriv('invoices', f.id, { status: 'betald', betald_at: nu })) {
          Object.assign(f, { status: 'betald', betald_at: nu });
          ritaFakturor(); await laddaOmEkonomi();
        }
      });
      return;
    }

    const mak = e.target.closest('[data-fakt-makulera]');
    if (mak) {
      const f = (S.fakturor || []).find(x => x.id === mak.dataset.faktMakulera);
      if (!f) return;
      const ja = await bekräfta({
        titel: 'Makulera fakturan?',
        text: 'Gör det bara när fakturan är krediterad i Wint. Passen på den faktureras inte igen: '
          + 'de räknas som avskrivna. Ska de faktureras om, ta kontakt med familjen först.',
        knapp: 'Makulera'
      });
      if (!ja) return;
      await medan(mak, 'Sparar…', async () => {
        if (await skriv('invoices', f.id, { status: 'makulerad' })) {
          f.status = 'makulerad';
          ritaFakturor(); await laddaOmEkonomi();
        }
      });
      return;
    }

    const bort = e.target.closest('[data-fakt-bort]');
    if (bort) {
      const f = (S.fakturor || []).find(x => x.id === bort.dataset.faktBort);
      if (!f || f.status !== 'utkast') return;
      const ja = await bekräfta({
        titel: 'Ta bort utkastet?',
        text: 'Passen på det blir kvar som fakturapass och kommer med nästa gång månadskörningen körs '
          + 'för samma månad eller senare. Ingenting har skickats.',
        knapp: 'Ta bort'
      });
      if (!ja) return;
      await medan(bort, 'Tar bort…', async () => {
        /* .eq('status', 'utkast'): hann någon lägga in fakturan i Wint
           under tiden ska den inte försvinna härifrån. Raderna följer
           med (on delete cascade). */
        const { data, error } = await supa.from('invoices').delete()
          .eq('id', f.id).eq('status', 'utkast').select('id');
        if (error) { alert('Kunde inte ta bort: ' + felText(error)); return; }
        if (!data || !data.length) { alert('Utkastet hann ändras. Listan laddas om.'); }
        await hämtaAllt();
        ritaFakturor(); await laddaOmEkonomi();
      });
    }
  });

  function ritaUtbetalningar() {
    const sök = $('#utb-sok').value.trim();
    const st = $('#utb-status').value;
    const rader = S.utbetalningar
      .filter(u => !st || u.status === st)
      .map(u => ({ ...u, hjalpare: namnFör(u.tutor_id) }))
      .filter(u => matchar(u, ['hjalpare'], sök));

    $('#utb-antal').textContent = rader.length + ' av ' + S.utbetalningar.length;
    $('#utb-tabell').innerHTML = tabell([
      { namn: 'Period', rita: u => '<b>' + esc(NXBetalning.periodText(u.period)) + '</b>' },
      { namn: 'Studiehjälpare', rita: u => esc(u.hjalpare) },
      { namn: 'Timmar', rita: u => '<span class="adm-tal">' + esc(NXBetalning.timmar(u.minuter)) + '</span>' },
      { namn: 'Belopp', rita: u => '<span class="adm-tal">' + esc(kronor(u.belopp_ore)) + '</span>' },
      { namn: 'Utbetald', rita: u => '<span class="adm-tal">' + esc(kortDatum(u.utbetald_at)) + '</span>'
        + (u.fel ? '<span class="adm-und" style="color:var(--acc-text)">' + esc(u.fel) + '</span>' : '') },
      /* Underlaget, inte pengarna. Studiehjälparen får se vad hen
         kommer att få och hinner säga ifrån innan beloppet betalas
         ut — det är billigare än att rätta en utbetalning efteråt. */
      { namn: '', höger: true, rita: u => u.status === 'utbetald' ? ''
        : '<button class="btn btn-ghost btn-sm" data-skicka="utbetalning" data-id="'
          + u.id + '">Skicka underlag</button>' },
      { namn: 'Läge', höger: true, rita: u => väljare('utb', UTB_LAGE, u.status, 'data-utb="' + u.id + '"') }
    ], rader, 'Inga utbetalningar än');
  }

  /* ============================================================
     KORTBETALNINGAR (Fas 12, familjens enda betalväg sedan Fas 14.2)

     Familjen betalar varje pass med kort, före passet. Månadsfakturan
     till familjen finns inte längre; fakturorna under sin egen flik är
     de som skapades innan dess.

     Beloppet är FRYST vid betalningen och läses bara här. Ingen
     rullgardin ändrar ett läge i den här tabellen, till skillnad från
     utbetalningar: en betalnings läge sätts av Stripe genom webhooken,
     och att kunna skriva om det för hand hade gjort siffran till en
     åsikt.

     Ingen kolumn för studiehjälparens del, med flit. Hela beloppet
     går till Nextrum, och hjälparens ersättning hör hemma under
     Utbetalningar — den räknas den 25:e ur rapporterna, inte här.
     ============================================================ */
  const KORT_LAGE = {
    ingen: 'Ej betald', vantar: 'Väntar', betald: 'Betald', aterbetald: 'Återbetald',
    tvist: 'Tvist', misslyckad: 'Misslyckad', faktura: 'Faktura'
  };

  /* "Ej betalda" är en annan fråga än de andra lägena: inte vilka
     betalningar som påbörjats, utan vilka bekräftade och genomförda
     pass ingen har betalat. Samma tre lägen som avvikelsen ej_betalt
     och OBETALDA_LAGEN i _delad/pris.ts. Ett undantaget pass ska inte
     betalas och står därför inte här. */
  const OBETALDA_LAGEN = ['ingen', 'vantar', 'misslyckad'];
  const obetaltPass = b => (b.status === 'confirmed' || b.status === 'completed')
    && b.fakturerbar !== false
    && OBETALDA_LAGEN.indexOf(b.betalning_status || 'ingen') !== -1;

  function ritaKortbetalningar() {
    ritaKortsparr();
    ritaAvstamning();
    /* Asynkron för rapporternas skull. Ett fel får inte lämna rutan på
       "Hämtar" — då ser det ut som att den fortfarande arbetar. */
    ritaTvister().catch(fel => {
      const host = $('#tvist-lista');
      if (host) host.innerHTML = tomt('Tvisterna gick inte att visa', felText(fel));
    });
    const sök = $('#kort-sok').value.trim();
    const st = $('#kort-status').value;
    /* Ett fakturapass är ingen kortbetalning (Fas 14.6). Det står under
       Fakturor. */
    const alla = st === 'obetald'
      ? (S.bokningar || []).filter(obetaltPass)
      : (S.bokningar || []).filter(b => b.betalning_status && b.betalning_status !== 'ingen' && b.betalning_status !== 'faktura');
    const rader = alla
      .filter(b => !st || st === 'obetald' || b.betalning_status === st)
      .map(b => ({ ...b, familj: namnFör(b.parent_id), hjalpare: namnFör(b.tutor_id) }))
      .filter(b => matchar(b, ['familj', 'hjalpare'], sök));

    $('#kort-antal').textContent = rader.length + ' av ' + alla.length;
    $('#kort-tabell').innerHTML = tabell([
      { namn: 'Pass', rita: b => '<b>' + esc(kortDatum(b.wanted_date)) + '</b>'
        + '<span class="adm-und">' + esc(b.subject || 'Pass') + '</span>' },
      { namn: 'Familj', rita: b => esc(b.familj) },
      { namn: 'Studiehjälpare', rita: b => esc(b.hjalpare) },
      /* betalt_ore är ett kvitto och skrivs bara av webhooken. Innan
         den kommit står det begärda beloppet, märkt som det det är —
         annars hade en öppnad betalning sett ut som 0 kr betalt. */
      { namn: 'Betalt', rita: b => b.betalt_ore != null
        ? '<span class="adm-tal">' + esc(kronor(b.betalt_ore)) + '</span>'
        : b.begart_ore
          ? '<span class="adm-und">begärt ' + esc(kronor(b.begart_ore)) + '</span>'
          : '<span class="adm-und">—</span>' },
      { namn: 'Återbetalt', rita: b => Number(b.aterbetald_ore || 0) > 0
        ? '<span class="adm-tal">' + esc(kronor(b.aterbetald_ore)) + '</span>' : '' },
      /* Stripes avgift (Fas 14.7). Saknas den på en betald rad är den
         inte hämtad än: charge.updated kommer med den, eller knappen
         under Stripe-läget. En testbetalning märks, så att den aldrig
         läses som en intäkt. */
      { namn: 'Avgift', rita: b => (b.stripe_avgift_ore != null
          ? '<span class="adm-tal">' + esc(kronor(b.stripe_avgift_ore)) + '</span>'
          : b.betald_at ? '<span class="adm-und">inte hämtad</span>' : '')
        + (b.stripe_skarp === false ? ' ' + pill('Test', '') : '') },
      { namn: '', höger: true, rita: b => {
        const kvar = Number(b.betalt_ore || 0) - Number(b.aterbetald_ore || 0);
        const gar = (b.betalning_status === 'betald' || b.betalning_status === 'tvist') && kvar > 0;
        return gar ? '<button class="btn btn-ghost btn-sm" data-aterbetala="' + b.id + '">Återbetala</button>' : '';
      } },
      { namn: 'Läge', höger: true, rita: b =>
        '<span class="adm-tal">' + esc(KORT_LAGE[b.betalning_status] || b.betalning_status) + '</span>' }
    ], rader, st === 'obetald' ? 'Inga obetalda pass' : 'Inga kortbetalningar än');
  }

  /* ============================================================
     SPÄRREN (Fas 14.2)

     "Ingen betalning, inget pass." En rad i flaggor, samma sort som
     notismejlen. Databasen gör jobbet: skydda_bokningsfalt nekar
     rapporten på ett obetalt pass när flaggan är på. Kortet här visar
     läget och är stället den slås om, bredvid betalningarna den
     hänger på.

     Den står AV tills en provbetalning gått hela vägen. Påslagen utan
     en kortväg som fungerar hade den låst varje studiehjälpare ute
     från att rapportera. Att stänga av den är nödbromsen, och den
     frågar därför inte efter något.
     ============================================================ */
  const kortbetalda = () => (S.bokningar || [])
    .filter(b => b.betalning_status === 'betald' || b.betalning_status === 'tvist').length;

  function ritaKortsparr() {
    const host = $('#kort-sparr');
    if (!host) return;
    const f = S.kortsparr;
    if (!f) {
      host.innerHTML = tomt('Spärrens läge gick inte att läsa',
        S.kortsparrFel || 'Raden kortsparr saknas i flaggor. Kör migrationen för Fas 14.2.');
      return;
    }
    const n = kortbetalda();
    host.innerHTML = '<div class="adm-koppling-kort">'
      + '<h6>Ingen betalning, inget pass ' + (f.aktiv ? pill('På', 'ar-klar') : pill('Av', '')) + '</h6>'
      + '<p>' + esc(f.beskrivning || '') + '</p>'
      + (!f.aktiv && f.vantar_pa ? '<div class="adm-krav">Ska vara avgjort först: ' + esc(f.vantar_pa) + '</div>' : '')
      + '<p class="xsmall" style="color:var(--bl-3);margin-top:10px">'
      + (n ? n + (n === 1 ? ' pass är betalt' : ' pass är betalda') + ' med kort. '
           : 'Ingen kortbetalning har gått igenom än. ')
      + 'Ändrad ' + esc(kortDatum(f.uppdaterad)) + '</p>'
      + '<div style="margin-top:12px"><button class="btn ' + (f.aktiv ? 'btn-ghost' : 'btn-primary')
      + ' btn-sm" type="button" data-kortsparr="' + (f.aktiv ? '0' : '1') + '">'
      + (f.aktiv ? 'Stäng av' : 'Slå på') + '</button></div>'
      + '</div>';
  }

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-kortsparr]');
    if (!knapp) return;
    const på = knapp.dataset.kortsparr === '1';
    const f = S.kortsparr || {};
    if (på) {
      const ja = await bekräfta({
        titel: 'Slå på spärren?',
        text: 'Från och med nu går ett pass som familjen inte betalat inte att rapportera, '
          + 'och studiehjälparen ser i sin vy att passet inte ska hållas. Ett pass familjen valt '
          + 'att betala mot faktura räknas som betalt nog: fakturan kommer efter passet.'
          + (kortbetalda() ? ''
            : '\n\nIngen kortbetalning har gått igenom än. Slår du på nu kan ingen '
              + 'studiehjälpare rapportera ett enda pass förrän en familj har betalat.'),
        /* Som notisflaggorna: förutsättningarna som förhandsvisning,
           inte i brödtexten, så att de går att läsa en i taget. */
        forhandsvisning: f.vantar_pa ? 'Det här skulle vara avgjort först:\n\n' + f.vantar_pa : null,
        knapp: 'Slå på'
      });
      if (!ja) return;
    }
    await medan(knapp, på ? 'Slår på…' : 'Stänger av…', async () => {
      const { error } = await supa.from('flaggor').update({ aktiv: på }).eq('kod', 'kortsparr');
      if (error) { alert('Kunde inte ändra spärren: ' + felText(error)); return; }
      /* Läget läses tillbaka i stället för att antas. En uppdatering
         som RLS nekar ger inget fel, bara noll rader — och då ska
         kortet visa att ingenting hände. */
      const { data } = await supa.from('flaggor').select('*').eq('kod', 'kortsparr').maybeSingle();
      if (data) S.kortsparr = data;
      ritaKortsparr();
    });
  });

  /* ============================================================
     STRIPE-LÄGET (Fas 14.3)

     Punkt 10 och 11 på säljarens MVP-lista. Om nyckeln var satt, om
     webhooken lyssnade på rätt händelser och vilken version den stod
     på gick förut inte att veta utan att logga in hos Stripe och leta.
     stripe-lage frågar med servernyckeln och svarar med en lista;
     reglerna för vad som är grönt bor i granskaStripe() i
     _delad/stripe.ts, med egna prov.

     Körs bara på knapptryck. Två anrop mot Stripe vid varje omritning
     av Ekonomi hade varit två anrop för en fråga ingen ställt.
     ============================================================ */
  const PUNKT_MÄRKE = {
    true: ['Klart', 'ar-klar'], false: ['Åtgärda', 'ar-ny'], null: ['Bra att veta', 'ar-vantar']
  };

  function ritaStripeLage(d) {
    const host = $('#stripe-lage');
    if (!host) return;
    const punkter = d.punkter || [];
    const röda = punkter.filter(p => p.ok === false).length;
    const klockan = new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    host.innerHTML = '<p class="small" style="margin:0 0 10px">'
      + (röda ? '<b>' + röda + (röda === 1 ? ' sak' : ' saker') + ' att åtgärda.</b>' : 'Inget att åtgärda.')
      + ' Kontrollerat ' + esc(klockan) + '.</p>'
      + tabell([
        { namn: 'Vad', rita: p => '<b>' + esc(p.rubrik) + '</b>' },
        { namn: 'Läge', rita: p => { const m = PUNKT_MÄRKE[String(p.ok)] || PUNKT_MÄRKE.null; return pill(m[0], m[1]); } },
        { namn: 'Vad det betyder', rita: p => '<span class="adm-und" style="white-space:normal">' + esc(p.text) + '</span>' }
      ], punkter, 'Stripe svarade inte');
  }

  /* ============================================================
     AVGIFTERNA I EFTERHAND (Fas 14.7)

     Stripe skapar balanstransaktionen en stund efter betalningen, och
     de två första betalningarna fick ingen avgift. Webhooken tar nu
     emot charge.updated och skriver in den när den kommer. Den här
     knappen hämtar den för betalningar som kom in innan, eller där
     händelsen inte kom fram: stripe-avstamning frågar Stripe om varje
     charge och skriver avgiften, nettot och om betalningen var skarp.
     ============================================================ */
  const saknarAvstamning = () => (S.bokningar || [])
    .filter(b => b.stripe_charge_id && (b.stripe_avgift_ore == null || b.stripe_skarp == null));

  function ritaAvstamning() {
    const host = $('#stripe-avstamning');
    if (!host) return;
    const n = saknarAvstamning().length;
    host.innerHTML = n
      ? '<p class="xsmall" style="color:var(--bl-3);margin:12px 0 8px">' + n
        + (n === 1 ? ' betalning saknar' : ' betalningar saknar') + ' Stripes avgift eller läge (skarp eller test).</p>'
        + '<button class="btn btn-ghost btn-sm" type="button" data-avstamning>Hämta från Stripe</button>'
      : '';
  }

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-avstamning]');
    if (!knapp) return;
    await medan(knapp, 'Frågar Stripe…', async () => {
      const svar = await supa.functions.invoke('stripe-avstamning', { body: {} });
      if (svar.error) { alert(await funktionsFel(svar.error)); return; }
      const d = svar.data || {};
      const delar = [];
      if (d.avgifter) delar.push(d.avgifter + (d.avgifter === 1 ? ' avgift hämtad' : ' avgifter hämtade'));
      if (d.markta) delar.push(d.markta + ' märkta som skarpa eller test');
      if (d.vantar) delar.push(d.vantar + ' där Stripe inte har avgiften än');
      if (d.fler) delar.push('fler finns, tryck igen');
      (d.fel || []).forEach(f => delar.push('fel: ' + f));
      alert(delar.length ? delar.join('\n') : 'Inget att hämta.');
      await hämtaAllt();
      ritaKortbetalningar();
    });
  });

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-stripe-lage]');
    if (!knapp) return;
    await medan(knapp, 'Frågar Stripe…', async () => {
      const svar = await supa.functions.invoke('stripe-lage', { body: {} });
      if (svar.error) {
        $('#stripe-lage').innerHTML = tomt('Kontrollen gick inte att köra', await funktionsFel(svar.error));
        return;
      }
      ritaStripeLage(svar.data || {});
    });
  });

  /* ============================================================
     KORTTVISTER (Fas 14.3)

     Punkt 9. En familj som bestrider en betalning hos sin bank får
     pengarna tillbaka om vi inte svarar i tid. Webhooken sparar sista
     dagen, orsaken och utfallet i stripe_tvister och lägger en uppgift
     med dagen som förfallodag. Här står de, öppna först, med det vi
     själva vet om passet — det är det underlaget banken vill ha.

     Samma orsakstexter som TVIST_ORSAK i _delad/stripe.ts: uppgiftens
     beskrivning och den här tabellen ska säga samma sak.
     ============================================================ */
  const TVIST_ORSAK = {
    fraudulent: 'Kortinnehavaren säger att betalningen inte är hens',
    unrecognized: 'Kortinnehavaren känner inte igen betalningen',
    product_not_received: 'Kortinnehavaren säger att passet inte blev av',
    product_unacceptable: 'Kortinnehavaren är missnöjd med passet',
    duplicate: 'Kortinnehavaren säger att samma pass betalats två gånger',
    credit_not_processed: 'Kortinnehavaren säger att pengarna skulle ha kommit tillbaka',
    subscription_canceled: 'Kortinnehavaren säger att tjänsten var uppsagd',
    customer_initiated: 'Kortinnehavaren har bestridit betalningen',
    debit_not_authorized: 'Kortinnehavaren säger att dragningen inte var godkänd',
    general: 'Ingen särskild orsak angiven'
  };
  const TVIST_LAGE = {
    needs_response: ['Väntar på vårt svar', 'ar-ny'],
    warning_needs_response: ['Förfrågan, väntar på vårt svar', 'ar-ny'],
    under_review: ['Hos banken', 'ar-vantar'],
    warning_under_review: ['Förfrågan hos banken', 'ar-vantar'],
    won: ['Vunnen', 'ar-klar'],
    warning_closed: ['Stängd utan återkrav', 'ar-klar'],
    lost: ['Förlorad', '']
  };
  const väntarPåOss = x => !x.stangd && (x.lage === 'needs_response' || x.lage === 'warning_needs_response');
  const NÄRVARO = { narvarande: 'närvarande', sen: 'kom sent', franvarande: 'uteblev' };

  async function ritaTvister() {
    const host = $('#tvist-lista');
    if (!host) return;
    if (S.tvisterFel) { host.innerHTML = tomt('Tvisterna gick inte att läsa', S.tvisterFel); return; }
    const alla = S.tvister || [];
    const öppna = alla.filter(x => !x.stangd).length;
    $('#tvist-antal').textContent = öppna ? öppna + (öppna === 1 ? ' öppen' : ' öppna') : '';
    if (!alla.length) {
      host.innerHTML = tomt('Inga korttvister',
        'Bestrider en familj en betalning hos sin bank står det här, med sista dagen att svara.');
      return;
    }

    /* Rapporten är det starkaste underlaget för att passet hölls, och
       den står inte i S. Hämtas bara när det finns tvister. */
    const ids = alla.map(x => x.booking_id).filter(Boolean);
    const rapport = {};
    if (ids.length) {
      const { data } = await supa.from('lesson_reports').select('booking_id, created_at').in('booking_id', ids);
      (data || []).forEach(r => { rapport[r.booking_id] = r; });
    }

    const nyckel = x => (x.stangd ? '1' : '0') + (väntarPåOss(x) ? String(x.svara_senast || '9') : '9') + String(x.skapad || '');
    const rader = alla.slice().sort((a, b) => nyckel(a).localeCompare(nyckel(b)));
    const bok = id => (S.bokningar || []).find(b => b.id === id);

    host.innerHTML = tabell([
      { namn: 'Pass', rita: x => {
        const b = bok(x.booking_id);
        return b ? '<b>' + esc(kortDatum(b.wanted_date)) + '</b><span class="adm-und">'
            + esc(b.subject || 'Pass') + ' · ' + esc(namnFör(b.parent_id)) + '</span>'
          : '<span class="adm-und">Passet hittades inte</span>';
      } },
      { namn: 'Belopp', rita: x => '<span class="adm-tal">' + (x.belopp_ore != null ? esc(kronor(x.belopp_ore)) : '—') + '</span>' },
      { namn: 'Orsak', rita: x => '<span class="adm-und" style="white-space:normal">'
        + esc(x.orsak ? (TVIST_ORSAK[x.orsak] || 'Annan orsak (' + x.orsak + ')') : 'Ingen orsak angiven') + '</span>' },
      { namn: 'Svara senast', rita: x => {
        if (!väntarPåOss(x) || !x.svara_senast) return '<span class="adm-und">—</span>';
        /* Hela dagar mellan datumen, inte timmar genom 24: "sex dagar
           kvar" ska betyda sex kalenderdagar, också på eftermiddagen.
           Fristens datum är UTC-datumet, samma som i uppgiften, och
           aldrig senare än den verkliga fristen. */
        const kvar = Math.round((Date.parse(String(x.svara_senast).slice(0, 10))
          - Date.parse(isoFor(new Date()))) / 86400000);
        return '<b>' + esc(kortDatum(x.svara_senast)) + '</b><span class="adm-und">'
          + (kvar < 0 ? 'Fristen har gått ut' : kvar === 0 ? 'I dag' : kvar === 1 ? '1 dag kvar' : kvar + ' dagar kvar')
          + '</span>';
      } },
      { namn: 'Underlaget vi har', rita: x => {
        const b = bok(x.booking_id);
        if (!b) return '<span class="adm-und">—</span>';
        const r = rapport[b.id];
        const delar = [
          'Bokat ' + kortDatum(b.created_at),
          b.status === 'confirmed' || b.status === 'completed' ? 'bekräftat' : 'inte bekräftat',
          b.attendance ? 'eleven ' + (NÄRVARO[b.attendance] || b.attendance) : 'ingen närvaro',
          r ? 'rapport skriven ' + kortDatum(r.created_at) : 'ingen rapport',
          b.betald_at ? 'betalt ' + kortDatum(b.betald_at) : null
        ].filter(Boolean);
        return '<span class="adm-und" style="white-space:normal">' + esc(delar.join(', ')) + '</span>';
      } },
      { namn: '', höger: true, rita: x => '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href="https://dashboard.stripe.com/'
        + (x.skarp ? '' : 'test/') + 'disputes/' + encodeURIComponent(x.id) + '">Öppna i Stripe</a>' },
      { namn: 'Läge', höger: true, rita: x => { const l = TVIST_LAGE[x.lage] || [x.lage, '']; return pill(l[0], l[1]); } }
    ], rader, 'Inga korttvister');
  }

  /* Återbetalningen går genom edge-funktionen, aldrig direkt mot
     tabellen: bara servern har Stripe-nyckeln, och taket för hur
     mycket som får gå tillbaka räknas ur raden, inte ur det som
     skrivs i rutan. */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-aterbetala]');
    if (!knapp) return;
    const b = (S.bokningar || []).find(x => x.id === knapp.dataset.aterbetala);
    if (!b) return;

    const betalt = Number(b.betalt_ore || 0);
    const kvar = betalt - Number(b.aterbetald_ore || 0);
    const valt = await fråga({
      titel: 'Återbetala passet?',
      /* Texten sa förut att studiehjälparens del dras tillbaka från
         hens Stripe-konto. Det var sant när betalningen var en
         destination charge och slutade vara det när Connect togs bort
         (Fas 12.5). En dialog som beskriver en pengaväg som inte finns
         är värre än ingen dialog. */
      text: kortDatum(b.wanted_date) + ' · ' + namnFör(b.parent_id) + '. '
        + 'Familjen får pengarna tillbaka på kortet. Stripes avgift för betalningen kommer '
        + 'inte tillbaka. Studiehjälparens ersättning påverkas inte: den räknas ur rapporten, '
        + 'inte ur betalningen.',
      innehåll: '<div class="fgroup" style="margin:14px 0 0">'
        + '<label for="ater-belopp">Belopp i kronor</label>'
        + '<input class="inp" id="ater-belopp" type="number" min="1" step="1" inputmode="numeric" value="'
        + Math.floor(kvar / 100) + '">'
        + '<p class="xsmall" style="color:var(--bl-3);margin:8px 0 0">Högst '
        + esc(kronor(kvar)) + '. Lägre belopp ger en delåterbetalning.</p></div>'
        + '<div class="fgroup" style="margin:14px 0 0">'
        + '<label for="ater-anledning">Anledning, för vår egen skull</label>'
        + '<input class="inp" id="ater-anledning" placeholder="t.ex. studiehjälparen uteblev"></div>',
      knapp: 'Återbetala',
      läs: ruta => {
        const kr = Number((ruta.querySelector('#ater-belopp') || {}).value);
        if (!kr || kr < 1) return { fel: 'Fyll i ett belopp.' };
        if (kr * 100 > kvar) return { fel: 'Beloppet är högre än vad som är kvar att återbetala.' };
        return { värde: {
          belopp_ore: Math.round(kr * 100),
          anledning: ((ruta.querySelector('#ater-anledning') || {}).value || '').trim()
        } };
      }
    });
    if (!valt) return;

    await medan(knapp, 'Återbetalar…', async () => {
      const svar = await supa.functions.invoke('stripe-aterbetalning', {
        body: { pass: b.id, belopp_ore: valt.belopp_ore, anledning: valt.anledning }
      });
      if (svar.error) { alert(await funktionsFel(svar.error)); return; }
      /* Varningen betyder att pengarna ÄR tillbaka men att raden inte
         hann skrivas. Den får inte sväljas: tabellen visar då fel
         tills webhooken kommer ikapp. */
      if (svar.data && svar.data.varning) alert(svar.data.varning);
      await hämtaAllt();
      ritaKortbetalningar();
      await ritaÖversikt();
    });
  });

  /* ============================================================
     AVVIKELSER (Fas 2)

     Ett genomfört pass utan rapport kommer aldrig med i
     månadskörningen. Rapporten är det som visar att passet hölls,
     och det är den som motiverar raden på studiehjälparens underlag.
     Här tar någon ställning, ett pass i taget: koppla rätt rapport,
     eller undanta passet.
     ============================================================ */
  function utanRapport() {
    return (S.passunderlag || []).filter(p =>
      p.fakturerbar && !p.har_rapport && !p.fakturerad && !p.pa_underlag);
  }

  const dagnummer = iso => Math.round(Date.parse(String(iso || '').slice(0, 10)) / DAG) || 0;

  /* Rapporter som kan höra till passet: samma studiehjälpare, samma
     elev, inte kopplade till något annat. Närmast i tid först — en
     rapport skriven dagen efter är troligare än en från förra månaden. */
  function kandidater(p) {
    return (S.fristaendeRapporter || [])
      .filter(r => r.tutor_id === p.tutor_id && (!p.student_id || r.student_id === p.student_id))
      .sort((a, b) => Math.abs(dagnummer(a.lesson_date) - dagnummer(p.wanted_date))
        - Math.abs(dagnummer(b.lesson_date) - dagnummer(p.wanted_date)));
  }

  function ritaAvvikelser() {
    const host = $('#avv-utan-rapport');
    if (!host) return;

    if (S.passunderlagFel) {
      host.innerHTML = tomt('Passunderlaget gick inte att läsa', S.passunderlagFel);
      $('#avv-fristaende').innerHTML = '';
      $('#avv-undantagna').innerHTML = '';
      ritaÖvrigaAvvikelser();
      return;
    }

    const saknar = utanRapport();
    host.innerHTML = tabell([
      { namn: 'Pass', rita: p => '<b>' + esc(kortDatum(p.wanted_date)) + '</b>'
        + '<span class="adm-und">' + esc(p.subject || 'Pass') + '</span>' },
      { namn: 'Familj', rita: p => esc(namnFör(p.parent_id)) },
      { namn: 'Elev', rita: p => esc(elevNamn(p.student_id)) },
      { namn: 'Studiehjälpare', rita: p => esc(namnFör(p.tutor_id)) },
      { namn: 'Rapporter att välja', rita: p => {
        const n = kandidater(p).length;
        return n ? pill(n + ' fristående', 'ar-vantar')
          : '<span class="xsmall" style="color:var(--bl-3)">Ingen</span>';
      } },
      { namn: '', höger: true, rita: p =>
        (kandidater(p).length
          ? '<button class="btn btn-primary btn-sm" type="button" data-avv-koppla="' + p.id + '">Koppla rapport</button> '
          : '')
        + '<button class="btn btn-ghost btn-sm" type="button" data-avv-undanta="' + p.id + '">Undanta</button>' }
    ], saknar, 'Alla genomförda pass har en rapport');

    $('#avv-fristaende').innerHTML = tabell([
      { namn: 'Datum', rita: r => '<b>' + esc(kortDatum(r.lesson_date)) + '</b>' },
      { namn: 'Studiehjälpare', rita: r => esc(namnFör(r.tutor_id)) },
      { namn: 'Elev', rita: r => esc(elevNamn(r.student_id)) },
      { namn: 'Anteckning', rita: r => '<span class="xsmall">'
        + esc(String(r.raw_notes || '').slice(0, 90)) + '</span>' }
    ], S.fristaendeRapporter || [], 'Inga fristående rapporter');

    const undantagna = (S.passunderlag || []).filter(p => !p.fakturerbar);
    $('#avv-undantagna').innerHTML = tabell([
      { namn: 'Pass', rita: p => '<b>' + esc(kortDatum(p.wanted_date)) + '</b>'
        + '<span class="adm-und">' + esc(p.subject || 'Pass') + '</span>' },
      { namn: 'Familj', rita: p => esc(namnFör(p.parent_id)) },
      { namn: 'Studiehjälpare', rita: p => esc(namnFör(p.tutor_id)) },
      { namn: 'Anledning', rita: p => esc(p.fakturerbar_anledning || '—') },
      { namn: '', höger: true, rita: p =>
        '<button class="btn btn-ghost btn-sm" type="button" data-avv-ateruppta="' + p.id + '">Ångra</button>' }
    ], undantagna, 'Inga undantagna pass');

    const övriga = ritaÖvrigaAvvikelser();
    märkFlik('#flik-avv-mark', saknar.length + övriga);
  }

  /* ============================================================
     ÖVRIGA EKONOMISKA AVVIKELSER (Fas 6)

     Räknade i databasen av ekonomiska_avvikelser(), med samma regler
     som månadskörningen. Pass utan rapport och fristående rapporter
     har egna listor ovanför och visas inte igen här. Varje rad kan
     bli en uppgift; en rad som redan har en öppen uppgift säger det.
     ============================================================ */
  const AVV_TEXT = {
    ej_betalt: ['Inte betalt', 'Hölls och rapporterades, men familjen har inte betalat. Betala-knappen ligger kvar på passet i familjens vy.'],
    /* Fas 14.6. */
    faktura_saknas: ['Fakturapass utan faktura', 'Familjen valde faktura, månaden är slut och passet står inte på någon faktura. Kör månadskörningen.'],
    betald_och_fakturerad: ['Betalt två gånger', 'Betalt med kort och dessutom på en faktura. Kreditera raden i Wint.'],
    /* Fas 14.2c. Betalsidan kan ligga öppen medan passet avbokas, och
       betalas den efteråt drar Stripe pengarna ändå. Beloppet är det
       som inte gått tillbaka än. */
    betald_men_avbokad: ['Betalt men avbokat', 'Familjen har betalat ett pass som är avbokat. Villkoren lovar hela beloppet tillbaka: återbetala under Kortbetalningar.'],
    ej_utbetalt: ['Inte utbetalt', 'Klart för underlag, men månaden det hölls är slut.'],
    faktura_forfallen: ['Förfallen faktura', 'Skickad, obetald och efter förfallodagen.'],
    faktura_gammalt_utkast: ['Faktura inte inlagd i Wint', 'Utkastet skapades för mer än en vecka sedan. Lägg in det i Wint under Fakturor.'],
    utbetalning_vantar: ['Utbetalning som väntar', 'Utkast eller godkänd, för en månad före förra.'],
    utbetalning_misslyckad: ['Misslyckad utbetalning', 'Pengarna gick inte iväg.'],
    timpenning_saknas: ['Ingen ersättning att räkna med', 'Studiehjälparen saknar timpenning och tjänsten saknar ersättning.'],
    pass_utan_studiehjalpare: ['Pass utan studiehjälpare', 'Genomfört, men ingen att betala ut till.'],
    rut_utan_skatteuppgifter: ['RUT utan skatteuppgifter', 'Kunden saknar personnummer, så passet faktureras utan avdrag.'],
    rut_utan_tak: ['RUT-tak saknas', 'Inget tak för året under System → Inställningar, så ingen RUT dras.'],
    rut_over_tak: ['Över RUT-taket', 'Kunden har fått mer avdrag i år än taket.'],
    faktura_summa_fel: ['Fakturans summa stämmer inte', 'Beloppet skiljer sig från summan av raderna.'],
    utbetalning_summa_fel: ['Utbetalningens summa stämmer inte', 'Beloppet skiljer sig från summan av raderna.'],
    fakturerat_ogiltigt_pass: ['Fakturerat pass som inte gäller', 'Passet är inte längre genomfört eller fakturerbart.']
  };
  /* Tabellerna en uppgift får kopplas till (check-villkoret i uppgifter). */
  const UPPG_TABELLER = ['bookings', 'invoices', 'payouts', 'lesson_reports', 'profiles'];
  /* Uppgiftens nyckel: vilken avvikelse, på vad. Databasen tillåter en
     öppen uppgift per nyckel, så samma problem blir aldrig två — och
     två olika problem på samma pass blir två (Fas 6, nyckel). */
  const avvNyckel = a => 'avvikelse:' + a.typ + ':' + a.objekt_tabell + ':' + a.objekt_id;

  function ritaÖvrigaAvvikelser() {
    const host = $('#avv-ovriga');
    if (!host) return 0;
    if (S.avvikelserFel) {
      host.innerHTML = tomt('Kunde inte räkna avvikelserna', S.avvikelserFel);
      return 0;
    }
    const rader = (S.avvikelser || []).filter(a => a.typ !== 'pass_utan_rapport' && a.typ !== 'fristaende_rapport');
    $('#avv-ovriga-antal').textContent = rader.length ? rader.length + ' st' : '';
    const öppna = new Set((S.uppgifter || [])
      .filter(u => u.nyckel && (u.status === 'oppen' || u.status === 'pagar'))
      .map(u => u.nyckel));

    host.innerHTML = tabell([
      { namn: 'Vad', rita: a => '<b>' + esc((AVV_TEXT[a.typ] || [a.typ])[0]) + '</b>'
        + '<span class="adm-und">' + esc((AVV_TEXT[a.typ] || ['', ''])[1]) + '</span>' },
      { namn: 'Gäller', rita: a => esc([a.kund_id ? namnFör(a.kund_id) : null,
                                         a.studiehjalpare_id ? namnFör(a.studiehjalpare_id) : null]
        .filter(Boolean).join(' · ') || '—') },
      { namn: 'Datum', rita: a => '<span class="adm-tal">' + esc(a.datum ? kortDatum(a.datum) : '—') + '</span>' },
      { namn: 'Belopp', rita: a => a.belopp_ore == null ? '<span class="adm-und">—</span>'
        : '<span class="adm-tal">' + esc(kronor(a.belopp_ore)) + '</span>' },
      { namn: '', höger: true, rita: a => öppna.has(avvNyckel(a))
        ? pill('Uppgift finns', 'ar-vantar')
        : '<button class="btn btn-ghost btn-sm" type="button" data-avv-uppgift="'
          + esc(a.typ + '|' + a.objekt_tabell + '|' + a.objekt_id) + '">Gör till uppgift</button>' }
    ], rader, 'Inget annat som inte går ihop');
    return rader.length;
  }

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-avv-uppgift]');
    if (!knapp) return;
    const [typ, tabellNamn, id] = knapp.dataset.avvUppgift.split('|');
    const a = (S.avvikelser || []).find(x => x.typ === typ && x.objekt_tabell === tabellNamn && x.objekt_id === id);
    if (!a) return;
    const kopplad = UPPG_TABELLER.indexOf(tabellNamn) !== -1;
    const vem = [a.kund_id ? namnFör(a.kund_id) : null, a.studiehjalpare_id ? namnFör(a.studiehjalpare_id) : null]
      .filter(Boolean).join(' · ');
    await medan(knapp, 'Skapar…', async () => {
      const rad = await skapaUppgift({
        titel: ((AVV_TEXT[typ] || [typ])[0] + (vem ? ' — ' + vem : '') + (a.datum ? ', ' + kortDatum(a.datum) : '')).slice(0, 200),
        typ: 'problem',
        beskrivning: (AVV_TEXT[typ] || ['', ''])[1] || null,
        kopplad_tabell: kopplad ? tabellNamn : null,
        kopplad_id: kopplad ? id : null,
        nyckel: avvNyckel(a)
      });
      if (rad) ritaAvvikelser();
    });
  });

  async function laddaOmEkonomi() {
    await hämtaEkonomiunderlag();
    ritaAvvikelser();
    await ritaÖversikt();
  }

  document.addEventListener('click', async e => {
    const koppla = e.target.closest('[data-avv-koppla]');
    const undanta = e.target.closest('[data-avv-undanta]');
    const återta = e.target.closest('[data-avv-ateruppta]');
    if (!koppla && !undanta && !återta) return;

    const id = (koppla || undanta || återta).dataset.avvKoppla
      || (koppla || undanta || återta).dataset.avvUndanta
      || (koppla || undanta || återta).dataset.avvAteruppta;
    const p = (S.passunderlag || []).find(x => x.id === id);
    if (!p) return;
    const vad = kortDatum(p.wanted_date) + ' · ' + namnFör(p.parent_id) + ' · ' + namnFör(p.tutor_id);

    if (koppla) {
      const lista = kandidater(p);
      /* Sedan Fas 3.7 måste en rapport som hör till ett pass ha närvaro
         (rapport_med_pass_har_narvaro). En fristående rapport har
         ingen, så den sätts här — förvald efter passets egen närvaro
         när den finns. Utan valet nekade databasen varje koppling. */
      const passNärvaro = ((S.bokningar || []).find(b => b.id === p.id) || {}).attendance || 'narvarande';
      const NÄRVARO = [['narvarande', 'Närvarade'], ['sen', 'Kom sent'], ['franvarande', 'Uteblev']];
      const valt = await fråga({
        titel: 'Vilken rapport hör till passet?',
        text: vad + '. Rapporten kopplas till passet, och passet kommer med på nästa körning.',
        innehåll: '<div class="fgroup" style="margin:14px 0 0"><label for="avv-narvaro">Närvaro på passet</label>'
          + '<select class="sel" id="avv-narvaro">' + NÄRVARO.map(([v, t]) =>
            '<option value="' + v + '"' + (v === passNärvaro ? ' selected' : '') + '>' + esc(t) + '</option>').join('')
          + '</select></div>'
          + '<div style="margin:14px 0 4px">' + lista.map((r, i) =>
          '<label style="display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--line)">'
          + '<input type="radio" name="avv-rapport" value="' + r.id + '"' + (i === 0 ? ' checked' : '') + '>'
          + '<span><b>' + esc(kortDatum(r.lesson_date)) + '</b> · ' + esc(elevNamn(r.student_id))
          + '<br><span class="xsmall" style="color:var(--bl-3)">'
          + esc(String(r.raw_notes || '').slice(0, 140)) + '</span></span></label>').join('') + '</div>',
        knapp: 'Koppla',
        läs: ruta => {
          const v = ruta.querySelector('input[name="avv-rapport"]:checked');
          const n = ruta.querySelector('#avv-narvaro');
          return v ? { värde: { rapport: v.value, narvaro: n ? n.value : passNärvaro } } : { fel: 'Välj en rapport.' };
        }
      });
      if (!valt) return;
      await medan(koppla, 'Kopplar…', async () => {
        /* is('booking_id', null): hann någon annan koppla rapporten
           under tiden ska den inte flyttas härifrån. */
        const { data, error } = await supa.from('lesson_reports')
          .update({ booking_id: p.id, narvaro: valt.narvaro })
          .eq('id', valt.rapport).is('booking_id', null).select('id');
        if (error) { alert('Kunde inte koppla: ' + felText(error)); return; }
        if (!data || !data.length) alert('Rapporten hann kopplas till något annat. Listan laddas om.');
        /* Samma närvaro på passet. Rapportens trigger gör det bara när
           en rapport skapas, och det här passet är redan genomfört. */
        else await supa.from('bookings').update({ attendance: valt.narvaro }).eq('id', p.id);
        await laddaOmEkonomi();
      });
      return;
    }

    if (undanta) {
      const anledning = await fråga({
        titel: 'Undanta passet?',
        text: vad + '. Passet räknas inte: familjen ska inte betala det, och det kommer inte med '
          + 'på studiehjälparens underlag. Är det redan betalt återbetalar du det under Kortbetalningar.',
        innehåll: '<div class="fgroup" style="margin-top:14px"><label for="avv-anledning">Varför?</label>'
          + '<textarea class="inp" id="avv-anledning" rows="3" maxlength="300" '
          + 'placeholder="Till exempel: testpass, inte ett riktigt pass"></textarea></div>',
        knapp: 'Undanta',
        läs: ruta => {
          const t = $('#avv-anledning', ruta).value.trim();
          return t ? { värde: t } : { fel: 'Skriv varför — ett undantag utan anledning går inte att följa upp.' };
        }
      });
      if (!anledning) return;
      await medan(undanta, 'Sparar…', async () => {
        if (await skriv('bookings', p.id, { fakturerbar: false, fakturerbar_anledning: anledning })) {
          await laddaOmEkonomi();
        }
      });
      return;
    }

    const ja = await bekräfta({
      titel: 'Ta med passet igen?',
      text: vad + '. Passet kommer med på nästa körning, om det har en rapport.',
      knapp: 'Ta med'
    });
    if (!ja) return;
    await medan(återta, 'Sparar…', async () => {
      if (await skriv('bookings', p.id, { fakturerbar: true, fakturerbar_anledning: null })) {
        await laddaOmEkonomi();
      }
    });
  });

  /* ============================================================
     MÅNADSKÖRNINGEN (Fas 2; underlag, och fakturautkast sedan Fas 14.6)

     Två steg, som vid utskicket: först en torrkörning som visar vad
     som skulle skapas, sedan det skarpa anropet — och det går bara
     för samma månad som torrkörningen gällde. Det skarpa steget
     skapar UTKAST. Ingenting skickas och ingenting betalas härifrån.

     En familj som valt faktura får ett utkast per månad, som läggs in
     i Wint under Fakturor. Pass som hölls utan att familjen betalat
     med kort, och utan att de valt faktura, kommer tillbaka i svaret
     som `obetalda` och står här per familj, så att någon kan höra av
     sig. De faktureras inte av sig själva.
     ============================================================ */
  function fyllPerioder() {
    const val = $('#kor-period');
    if (!val || val.options.length) return;
    const nu = new Date();
    const alt = [];
    for (let i = 1; i <= 6; i++) {
      const d = new Date(nu.getFullYear(), nu.getMonth() - i, 1);
      const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      alt.push('<option value="' + iso + '">' + esc(NXBetalning.periodText(iso + '-01')) + '</option>');
    }
    const iår = nu.getFullYear() + '-' + String(nu.getMonth() + 1).padStart(2, '0');
    alt.push('<option value="' + iår + '">' + esc(NXBetalning.periodText(iår + '-01'))
      + ' (pågår)</option>');
    val.innerHTML = alt.join('');
    val.addEventListener('change', () => { $('#kor-skapa').disabled = true; S.korning = null; });
  }

  function ritaKörning(d, torr) {
    const summa = lista => (lista || []).reduce((n, x) => n + Number(x.belopp_ore || 0), 0);
    const rad = (vänster, höger, total) => '<div class="sum-line' + (total ? ' total' : '') + '">'
      + '<span>' + vänster + '</span><span class="adm-tal">' + höger + '</span></div>';
    const underlag = d.utbetalningar || [];
    const fakturor = d.fakturor || [];
    const obetalda = d.obetalda || [];

    let h = '<p class="small" style="margin:14px 0 8px"><b>'
      + esc((torr ? 'Torrkörning' : 'Skapat') + ' · ' + NXBetalning.periodText(d.period)) + '</b>'
      + ' <span class="xsmall" style="color:var(--bl-3)">pass till och med '
      + esc(kortDatum(d.pass_till_och_med)) + '</span></p>';

    h += underlag.map(u => rad(esc(namnFör(u.tutor_id)) + ' · ' + u.pass + ' pass',
      esc(kronor(u.belopp_ore)))).join('');
    h += rad('Studiehjälparna, ' + underlag.length + ' underlag', esc(kronor(summa(underlag))), true);

    if (fakturor.length) {
      h += fakturor.map(f => rad(esc(namnFör(f.parent_id)) + ' · ' + f.pass + ' pass',
        esc(kronor(f.belopp_ore)))).join('');
      h += rad('Fakturor att lägga in i Wint, ' + fakturor.length + ' st', esc(kronor(summa(fakturor))), true);
    }

    /* Per familj, för det är familjen man hör av sig till. Ingen
       faktura skapas av det här: det är en lista, inte ett krav. */
    if (obetalda.length) {
      const per = {};
      obetalda.forEach(o => { (per[o.parent_id] = per[o.parent_id] || []).push(o); });
      h += Object.keys(per).map(id => rad(esc(namnFör(id)) + ' · ' + per[id].length + ' pass',
        esc(kronor(summa(per[id]))))).join('');
      h += rad('Hölls utan betalning, ' + obetalda.length + ' pass', esc(kronor(summa(obetalda))), true);
    }

    const noter = [];
    if (obetalda.length) {
      noter.push('⚠️ ' + obetalda.length + (obetalda.length === 1 ? ' pass hölls' : ' pass hölls')
        + ' utan att familjen betalat. De faktureras inte av sig själva: Betala-knappen ligger '
        + 'kvar på passet i familjens vy. <a href="#ekonomi/avvikelser">Se avvikelser</a>.');
    }
    const utan = d.hoppade_over_utan_rapport || [];
    if (utan.length) {
      noter.push('⚠️ ' + utan.length + (utan.length === 1 ? ' pass saknar' : ' pass saknar')
        + ' rapport och kom inte med. <a href="#ekonomi/avvikelser">Se avvikelser</a>.');
    }
    (d.hoppade_over_utan_timpenning || []).forEach(id => noter.push('⚠️ ' + esc(namnFör(id))
      + ' har ingen timpenning, så hens pass väntar till nästa körning.'));
    if (d.undantagna_pass) noter.push(d.undantagna_pass + ' undantagna pass räknades inte.');
    if (d.skapade) {
      noter.push('Skapade: ' + d.skapade.utbetalningar + ' underlag'
        + (d.skapade.fakturor ? ' och ' + d.skapade.fakturor + (d.skapade.fakturor === 1 ? ' faktura' : ' fakturor') : '')
        + ', alla som utkast.' + (d.skapade.fakturor ? ' Lägg in fakturorna i Wint under <a href="#ekonomi/fakturor">Fakturor</a>.' : ''));
    }
    (d.problem || []).forEach(p => noter.push('⚠️ ' + esc(p)));
    if (!underlag.length && !fakturor.length && torr) noter.push('Inget underlag och ingen faktura att skapa för den här månaden.');

    return h + noter.map(n => '<p class="xsmall" style="margin:8px 0 0;line-height:1.6">' + n + '</p>').join('');
  }

  document.addEventListener('click', async e => {
    const torr = e.target.closest('#kor-torr');
    const skapa = e.target.closest('#kor-skapa');
    if (!torr && !skapa) return;

    const period = $('#kor-period').value;
    const host = $('#kor-resultat');

    if (torr) {
      $('#kor-skapa').disabled = true;
      S.korning = null;
      const res = await medan(torr, 'Räknar…', () =>
        supa.functions.invoke('fakturering', { body: { torrkorning: true, period } }));
      const fel = res.error || (res.data && res.data.error);
      if (fel) { host.innerHTML = tomt('Torrkörningen gick inte', await funktionsFel(fel)); return; }
      S.korning = { period, torr: res.data };
      host.innerHTML = ritaKörning(res.data, true);
      $('#kor-skapa').disabled = !(res.data.utbetalningar || []).length && !(res.data.fakturor || []).length;
      return;
    }

    if (!S.korning || S.korning.period !== period) { skapa.disabled = true; return; }
    const t = S.korning.torr;
    const summa = lista => (lista || []).reduce((n, x) => n + Number(x.belopp_ore || 0), 0);
    const fakt = t.fakturor || [];
    const ja = await bekräfta({
      titel: 'Skapa utkast för ' + NXBetalning.periodText(t.period) + '?',
      text: t.utbetalningar.length + ' underlag på ' + kronor(summa(t.utbetalningar))
        + (fakt.length ? ' och ' + fakt.length + (fakt.length === 1 ? ' faktura' : ' fakturor') + ' på ' + kronor(summa(fakt)) : '')
        + '. De skapas som utkast — ingenting skickas och ingenting betalas ut härifrån.',
      knapp: 'Skapa utkast'
    });
    if (!ja) return;

    const res = await medan(skapa, 'Skapar…', () =>
      supa.functions.invoke('fakturering', { body: { period } }));
    const fel = res.error || (res.data && res.data.error);
    skapa.disabled = true;
    S.korning = null;
    if (fel) { host.innerHTML = tomt('Körningen gick inte', await funktionsFel(fel)); return; }
    host.innerHTML = ritaKörning(res.data, false);

    await hämtaAllt();
    await hämtaEkonomiunderlag();
    ritaFakturor();
    ritaUtbetalningar();
    ritaKortbetalningar();
    ritaAvvikelser();
    await ritaÖversikt();
  });

  /* Priset redigeras inte längre här — det gör tjänstekatalogen
     nedan. Kvar är talet i månadskörningens sammanfattning, som
     visar vad fakturering FAKTISKT kommer att räkna med: värdet i
     prissattning, dit triggern speglar läxhjälpens pris. Läser man
     tjanster här i stället skulle rutan visa vad någon nyss skrev
     medan funktionen räknade på något annat. */
  function ritaPris() {
    const öre = S.pris ? S.pris.pris_per_timme_ore : (NX.CFG.PRIS_PER_TIMME || 379) * 100;
    const ruta = $('#kor-pris');
    if (ruta) ruta.textContent = kronor(öre);
  }


  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, {
    fyllPerioder, kandidater, laddaOmEkonomi, ritaAvvikelser, ritaFakturor,
    ritaKortbetalningar, ritaPris, ritaUtbetalningar, utanRapport
  });
})();
