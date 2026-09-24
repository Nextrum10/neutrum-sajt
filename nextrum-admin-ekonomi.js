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

  function ritaFakturor() {
    const sök = $('#fakt-sok').value.trim();
    const st = $('#fakt-status').value;
    const rader = S.fakturor
      .filter(f => !st || f.status === st)
      .map(f => ({ ...f, familj: namnFör(f.parent_id) }))
      .filter(f => matchar(f, ['familj'], sök));

    $('#fakt-antal').textContent = rader.length + ' av ' + S.fakturor.length;
    $('#fakt-tabell').innerHTML = tabell([
      { namn: 'Period', rita: f => '<b>' + esc(NXBetalning.periodText(f.period)) + '</b>' },
      { namn: 'Familj', rita: f => esc(f.familj) },
      { namn: 'Belopp', rita: f => '<span class="adm-tal">' + esc(kronor(f.belopp_ore)) + '</span>' },
      { namn: 'Förfaller', rita: f => '<span class="adm-tal">' + esc(kortDatum(f.forfaller)) + '</span>' },
      { namn: 'Skickad', rita: f => '<span class="adm-tal">' + esc(kortDatum(f.skickad_at)) + '</span>' },
      { namn: 'Betald', rita: f => '<span class="adm-tal">' + esc(kortDatum(f.betald_at)) + '</span>' },
      /* Knappen skickar ett riktigt mejl. Rullgardinen bredvid ändrar
         bara vad som står i tabellen — de gör olika saker med flit,
         och det ska synas att de gör det. */
      { namn: '', höger: true, rita: f => {
        if (f.status === 'makulerad' || f.status === 'betald') return '';
        const påminn = f.status === 'skickad' || f.status === 'forfallen';
        return '<button class="btn ' + (påminn ? 'btn-ghost' : 'btn-primary') + ' btn-sm"'
          + ' data-skicka="faktura" data-id="' + f.id + '"'
          + (påminn ? ' data-paminnelse="1"' : '') + '>'
          + (påminn ? 'Påminn' : 'Skicka') + '</button>';
      } },
      { namn: 'Läge', höger: true, rita: f => väljare('fakt', FAKT_LAGE, f.status, 'data-fakt="' + f.id + '"') }
    ], rader, 'Inga fakturor än');
  }

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
    tvist: 'Tvist', misslyckad: 'Misslyckad'
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
    const sök = $('#kort-sok').value.trim();
    const st = $('#kort-status').value;
    const alla = st === 'obetald'
      ? (S.bokningar || []).filter(obetaltPass)
      : (S.bokningar || []).filter(b => b.betalning_status && b.betalning_status !== 'ingen');
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
          + 'och studiehjälparen ser i sin vy att passet inte ska hållas.'
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
    /* Fas 14.2c. Betalsidan kan ligga öppen medan passet avbokas, och
       betalas den efteråt drar Stripe pengarna ändå. Beloppet är det
       som inte gått tillbaka än. */
    betald_men_avbokad: ['Betalt men avbokat', 'Familjen har betalat ett pass som är avbokat. Villkoren lovar hela beloppet tillbaka: återbetala under Kortbetalningar.'],
    ej_utbetalt: ['Inte utbetalt', 'Klart för underlag, men månaden det hölls är slut.'],
    faktura_forfallen: ['Förfallen faktura', 'Skickad, obetald och efter förfallodagen.'],
    faktura_gammalt_utkast: ['Utkast som inte skickats', 'Fakturan skapades för mer än en vecka sedan.'],
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
     MÅNADSKÖRNINGEN (Fas 2, bara underlag sedan Fas 14.2)

     Två steg, som vid utskicket: först en torrkörning som visar vad
     som skulle skapas, sedan det skarpa anropet — och det går bara
     för samma månad som torrkörningen gällde. Det skarpa steget
     skapar UTKAST. Ingenting skickas och ingenting betalas härifrån.

     Familjen får ingen faktura. Pass som hölls utan att familjen
     betalat kommer tillbaka i svaret som `obetalda`, och står här
     per familj, så att någon kan höra av sig.
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
    const obetalda = d.obetalda || [];

    let h = '<p class="small" style="margin:14px 0 8px"><b>'
      + esc((torr ? 'Torrkörning' : 'Skapat') + ' · ' + NXBetalning.periodText(d.period)) + '</b>'
      + ' <span class="xsmall" style="color:var(--bl-3)">pass till och med '
      + esc(kortDatum(d.pass_till_och_med)) + '</span></p>';

    h += underlag.map(u => rad(esc(namnFör(u.tutor_id)) + ' · ' + u.pass + ' pass',
      esc(kronor(u.belopp_ore)))).join('');
    h += rad('Studiehjälparna, ' + underlag.length + ' underlag', esc(kronor(summa(underlag))), true);

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
        + ' utan att familjen betalat. Familjen får ingen faktura för dem — Betala-knappen ligger '
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
    if (d.skapade) noter.push('Skapade: ' + d.skapade.utbetalningar + ' underlag, alla som utkast.');
    (d.problem || []).forEach(p => noter.push('⚠️ ' + esc(p)));
    if (!underlag.length && torr) noter.push('Inget underlag att skapa för den här månaden.');

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
      $('#kor-skapa').disabled = !(res.data.utbetalningar || []).length;
      return;
    }

    if (!S.korning || S.korning.period !== period) { skapa.disabled = true; return; }
    const t = S.korning.torr;
    const summa = lista => (lista || []).reduce((n, x) => n + Number(x.belopp_ore || 0), 0);
    const ja = await bekräfta({
      titel: 'Skapa utkast för ' + NXBetalning.periodText(t.period) + '?',
      text: t.utbetalningar.length + ' underlag på ' + kronor(summa(t.utbetalningar))
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
