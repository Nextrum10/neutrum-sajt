/* ============================================================
   NEXTRUM — adminvyn, System: integrationer, fel, adminanvändare

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

  /* AVBOKNINGSSKAL användes av auditVärde() utan att hämtas härifrån.
     En auditrad med ett avbokningsskäl kastade då ReferenceError, och
     hela loggen slutade ritas på just den raden. */
  const { AVBOKNINGSSKAL, DP, FAKT_LAGE, S, SH_LAGE, UTB_LAGE, fråga, hämtaNotisläge, kortDatum, läge,
          märkFlik, namnFör, pill, punkt, rad, saknasFunktion, skriv, tabell, uppräkning } = NXAdmin;
  /* Flaggorna (program 2, Fas 1.1). Tomma tills ritaFlaggor() hämtat. */
  S.flaggor = [];
  S.flaggorFel = null;
  /* Funktioner som bor i andra områden. Anropen går via
     NXAdmin.rita, som fylls när alla filer laddats. */
  const ritaDetalj = (...a) => NXAdmin.rita.ritaDetalj(...a);
  const träffar = (...a) => NXAdmin.rita.träffar(...a);
  const laddaOmEkonomi = (...a) => NXAdmin.rita.laddaOmEkonomi(...a);
  const ritaÖversikt = (...a) => NXAdmin.rita.ritaÖversikt(...a);

  /* ============================================================
     SYSTEM
     ============================================================ */

  /* Integrationskorten. Det viktiga är vad de INTE gör: det finns
     ingen "koppla"-knapp här, för en OAuth-koppling kräver en
     klienthemlighet, och en hemlighet som webbläsaren kan läsa är
     ingen hemlighet. Kopplingen görs på servern; den här sidan
     rapporterar bara vad servern säger. */
  const TJANSTER = {
    google_workspace: {
      namn: 'Google Workspace',
      ikon: '<path d="M12 3.5 3.5 8 12 12.5 20.5 8z"/><path d="M3.5 12 12 16.5 20.5 12"/><path d="M3.5 16 12 20.5 20.5 16"/>',
      vad: 'Kalendern och mejlen. Bokade pass läggs som händelser i studiehjälparens '
        + 'och familjens kalender, och fakturautskicket går från en riktig adress i stället '
        + 'för en no-reply.',
      krav: 'Krävs: ett Google Cloud-projekt med Calendar API och Gmail API påslagna, '
        + 'ett tjänstekonto med domänvid delegering, och GOOGLE_KLIENT_ID + '
        + 'GOOGLE_KLIENT_HEMLIGHET som secrets på edge-funktionen. Se GOOGLE.md.'
    },
    fortnox: {
      namn: 'Fortnox',
      ikon: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M7.5 9h9M7.5 12.5h6M7.5 16h4"/>',
      vad: 'Bokföringen. Varje faktura som skapas av månadskörningen speglas som en '
        + 'kundfaktura i Fortnox, och utbetalningarna som leverantörsfakturor, så att '
        + 'ingen behöver knappa in samma siffra två gånger.',
      krav: 'Krävs: en integrationslicens i Fortnox, en godkänd app med scope invoice '
        + 'och supplierinvoice, och FORTNOX_KLIENT_ID + FORTNOX_KLIENT_HEMLIGHET + '
        + 'FORTNOX_REFRESH_TOKEN som secrets på edge-funktionen.'
    }
  };

  function ritaIntegrationer() {
    const rader = Object.keys(TJANSTER).map(nyckel => {
      const t = TJANSTER[nyckel];
      const rad = S.integrationer.find(i => i.tjanst === nyckel);
      const kopplad = rad && rad.kopplad;
      return '<div class="adm-koppling-kort">'
        + '<h6><svg viewBox="0 0 24 24" aria-hidden="true">' + t.ikon + '</svg>' + esc(t.namn)
        + (kopplad ? pill('Kopplad', 'ar-klar') : pill('Inte kopplad', '')) + '</h6>'
        + '<p>' + esc(t.vad) + '</p>'
        + (kopplad && rad.konto ? '<p class="xsmall" style="color:var(--bl-3)">Konto: '
          + esc(rad.konto) + '</p>' : '')
        + (kopplad && rad.senaste_synk ? '<p class="xsmall" style="color:var(--bl-3)">Senaste synk: '
          + esc(kortDatum(rad.senaste_synk)) + '</p>' : '')
        + (rad && rad.senaste_fel ? '<p class="xsmall" style="color:var(--acc-text)">Senaste fel: '
          + esc(rad.senaste_fel) + '</p>' : '')
        + '<div class="adm-krav">' + esc(t.krav) + '</div>'
        + '</div>';
    }).join('');

    $('#int-kort').innerHTML =
      '<div class="dbox" style="margin-bottom:clamp(16px,1.8vw,22px)">'
      + '<h5>Så kopplas en tjänst</h5>'
      + '<p class="xsmall" style="color:var(--muted-2);line-height:1.7">'
      + 'Ingen av dem kopplas härifrån, och det är med flit. Båda kräver en '
      + 'klienthemlighet, och en hemlighet som webbläsaren kan läsa är ingen '
      + 'hemlighet. Den ligger då hos varenda person som öppnar sidan. '
      + 'Nycklarna sätts som secrets på edge-funktionen, dit ingen webbläsare '
      + 'når, och den här sidan visar bara vad servern rapporterar tillbaka. '
      + 'Står det "inte kopplad" är den inte kopplad, oavsett vad någon skrivit i en tabell.'
      + '</p></div>'
      + '<div class="adm-koppling">' + rader + '</div>'
      + (S.saknasV13.indexOf('integrationer') !== -1
        ? '<div class="dbox" style="margin-top:clamp(16px,1.8vw,22px)">'
          + tomt('Tabellen integrationer saknas',
            'Kör schema-v13.sql i Supabase → SQL Editor. Tills dess står båda som inte kopplade, '
            + 'vilket råkar vara sant.') + '</div>'
        : '');
  }

  function ritaFel() {
    $('#fel-antal').textContent = S.klientfel.length ? S.klientfel.length + ' st' : '';
    märkFlik('#flik-fel-mark', S.klientfel.length + S.notisfel.length);
    $('#fel-tabell').innerHTML = tabell([
      { namn: 'När', rita: f => '<span class="adm-tal">' + esc(kortDatum(f.created_at)) + '</span>' },
      { namn: 'Sida', rita: f => esc(f.sida || '—') },
      { namn: 'Felet', rita: f => '<b>' + esc(f.meddelande) + '</b>'
        + (f.stack ? '<span class="adm-und" style="font-family:var(--f-mono);font-size:10px">'
          + esc(String(f.stack).slice(0, 160)) + '</span>' : '') },
      { namn: 'Vem', rita: f => esc(f.anvandare ? namnFör(f.anvandare) : 'Utloggad') },
      { namn: '', höger: true, rita: f => '<button class="btn btn-ghost btn-sm" data-felbort="'
        + f.id + '">Rensa</button>' }
    ], S.klientfel, 'Inga fel rapporterade');

    ritaNotisfel();
  }

  /* Anrop som inte gick fram. Statuskoden är hela beskedet: 401 är
     fel hemlighet mellan triggern och funktionen, 5xx är funktionen
     själv, och en tom kod med "tog slut" är ett anrop som aldrig kom
     fram. Innehållet i svaret visas inte — det kan bära uppgifter ur
     anmälan som felet gällde.

     Sedan program 2, Fas 2 är det här också det enda stället där en
     arbetare som svarar 401 syns: notis_minut() väcker notis-ko med
     pg_net, och pg_net säger aldrig till den som väckte. */
  function ritaNotisfel() {
    const rader = S.notisfel || [];
    $('#notis-antal').textContent = rader.length ? rader.length + ' st' : '';
    $('#notis-tabell').innerHTML = tabell([
      { namn: 'När', rita: n => '<span class="adm-tal">' + esc(kortDatum(n.tidpunkt)) + '</span>' },
      { namn: 'Svar', rita: n => n.status_kod
        ? pill(String(n.status_kod), n.status_kod >= 500 ? '' : 'ar-vantar')
        : pill(n.tog_slut ? 'Tidsgräns' : 'Inget svar', '') },
      { namn: 'Felet', rita: n => esc(n.fel || 'Funktionen svarade med en felkod.') }
    ], rader, 'Inga misslyckade anrop det senaste dygnet');
  }

  /* ============================================================
     ADMINANVÄNDARE

     is_admin är den enda flaggan som avgör vem som ser den här
     sidan. Att sätta den har krävt Table Editor, vilket betyder att
     den som skulle ge en kollega behörighet först behövde
     databasåtkomst — alltså mer än behörigheten själv ger.

     Triggern skydda_profilfalt släpper igenom en admin, så det går
     från appen. Två saker går inte, och ska inte gå:

       1. Ta bort sin EGEN behörighet. En ensam admin som klickar
          fel låser ut hela bolaget ur adminvyn, och vägen tillbaka
          är Table Editor — precis det vi försöker slippa.

       2. Ta bort den sista. Samma sak, en klick senare.

     Båda är spärrade i knapparna OCH kontrollerade igen precis
     innan skrivningen. Det första är för att det ska synas, det
     andra för att en dold knapp inte är ett skydd.
     ============================================================ */

  function adminer() {
    return Object.values(S.personer)
      .filter(p => p.is_admin)
      .sort((a, b) => String(a.full_name || a.email || '')
        .localeCompare(String(b.full_name || b.email || ''), 'sv'));
  }

  function ritaAdminanvandare() {
    const host = $('#adm-anv');
    if (!host) return;
    const lista = adminer();
    $('#adm-anv-antal').textContent = lista.length
      + (lista.length === 1 ? ' person' : ' personer');

    host.innerHTML = lista.map(p => {
      const jag = p.id === S.user.id;
      const ensam = lista.length === 1;
      return '<div class="dp-rad"><div>'
        + '<b>' + esc(p.full_name || p.email || '—') + (jag ? ' (du)' : '') + '</b>'
        + '<span>' + esc([p.email, p.role === 'tutor' ? 'studiehjälpare'
            : p.role === 'parent' ? 'förälder' : p.role].filter(Boolean).join(' · ')) + '</span>'
        + '</div><span class="dp-rad-hoger">'
        + (jag || ensam
          ? '<span class="xsmall" style="color:var(--bl-2)">'
            + (jag ? 'kan inte tas bort av dig' : 'sista adminen') + '</span>'
          : '<button class="btn btn-ghost btn-sm" data-admin-bort="' + esc(p.id) + '">Ta bort</button>')
        + '</span></div>';
    }).join('');
  }

  function ritaAdminTraffar() {
    const host = $('#adm-anv-traffar');
    const fält = $('#adm-anv-sok');
    if (!host || !fält) return;
    const sök = fält.value.trim().toLowerCase();
    if (sök.length < 2) { host.innerHTML = ''; return; }

    const träffar = Object.values(S.personer)
      .filter(p => !p.is_admin)
      .filter(p => [p.full_name, p.email].filter(Boolean).join(' ')
        .toLowerCase().indexOf(sök) !== -1)
      .slice(0, 8);

    host.innerHTML = träffar.length
      ? träffar.map(p => '<div class="dp-rad"><div>'
          + '<b>' + esc(p.full_name || p.email || '—') + '</b>'
          + '<span>' + esc(p.email || '') + '</span></div>'
          + '<span class="dp-rad-hoger">'
          + '<button class="btn btn-primary btn-sm" data-admin-ge="' + esc(p.id) + '">Gör till admin</button>'
          + '</span></div>').join('')
      : tomt('Ingen matchar', 'Personen måste ha ett konto på sidan först.');
  }

  const admSök = $('#adm-anv-sok');
  if (admSök) admSök.addEventListener('input', ritaAdminTraffar);

  async function sättAdmin(profilId, värde) {
    const p = S.personer[profilId];
    if (!p) return;

    /* Kontrollerad igen, inte bara i knappen. En dold knapp är
       inget skydd — den som öppnar konsolen ser samma DOM. */
    if (!värde) {
      if (profilId === S.user.id) {
        alert('Du kan inte ta bort din egen behörighet härifrån.');
        return;
      }
      if (adminer().length <= 1) {
        alert('Det här är den sista adminen. Ge någon annan behörighet först.');
        return;
      }
    }

    const namn = p.full_name || p.email || 'personen';
    const ja = await bekräfta(värde ? {
      titel: 'Ge ' + namn + ' adminbehörighet?',
      text: 'Hen kommer åt alla familjers och studiehjälpares uppgifter, alla meddelanden, '
        + 'alla fakturor och alla utbetalningar. Det går att ta bort igen.',
      knapp: 'Ge behörighet'
    } : {
      titel: 'Ta bort adminbehörigheten för ' + namn + '?',
      text: 'Hen blir utelåst ur adminvyn direkt. Kontot i övrigt påverkas inte.',
      knapp: 'Ta bort'
    });
    if (!ja) return;

    const gammalt = p.is_admin;
    p.is_admin = värde;
    if (!await skriv('profiles', profilId, { is_admin: värde })) {
      p.is_admin = gammalt;
      return;
    }
    ritaAdminanvandare();
    ritaAdminTraffar();
    /* Panelen kan stå öppen på samma person och visa gamla märken. */
    if (DP.typ && DP.id === profilId) ritaDetalj();
  }

  document.addEventListener('click', async e => {
    const ge = e.target.closest('[data-admin-ge]');
    if (ge) { await sättAdmin(ge.dataset.adminGe, true); return; }
    const bort = e.target.closest('[data-admin-bort]');
    if (bort) await sättAdmin(bort.dataset.adminBort, false);
  });

  /* ============================================================
     INSTÄLLNINGAR (Fas 6)

     RUT-taket per år: siffran kommer från Skatteverket och matas in
     här med källa. Ingen skattesiffra står i koden (Fas 5.3), och
     utan ett tak för året drar faktureringen ingen RUT alls. Övriga
     inställningar har redan en plats — rutan under pekar dit i
     stället för att bygga en andra väg till samma sak.
     ============================================================ */
  function ritaInstallningar() {
    const host = $('#rt-tabell');
    if (!host) return;
    const rader = (S.rutTak || []).slice().sort((a, b) => b.ar - a.ar);
    host.innerHTML = tabell([
      { namn: 'År', rita: r => '<b class="adm-tal">' + esc(String(r.ar)) + '</b>' },
      { namn: 'Tak per köpare', rita: r => '<span class="adm-tal">' + esc(kronor(r.tak_ore)) + '</span>' },
      { namn: 'Källa', rita: r => esc(r.kalla || '—') },
      { namn: 'Ändrat', rita: r => '<span class="adm-tal">' + esc(kortDatum(r.uppdaterad)) + '</span>' },
      { namn: '', höger: true, rita: r => '<button class="btn btn-ghost btn-sm" type="button" data-rt-bort="'
        + esc(String(r.ar)) + '">Ta bort</button>' }
    ], rader, 'Inget RUT-tak inlagt, så faktureringen drar ingen RUT');

    const pekare = $('#inst-pekare');
    if (pekare) {
      const PEKARE = [
        ['Bolagsfakta', 'Organisationsnummer, moms, F-skatt och hur studiehjälparna anlitas.', '#agenter/bolaget'],
        ['Tjänster och priser', 'Pris, ersättning, RUT-andel och villkor per tjänst.', '#katalog/tjanster'],
        ['Rabattkoder', 'Koder, värden och giltighet.', '#katalog/rabattkoder'],
        ['Integrationer', 'Google och Fortnox.', '#system/integrationer'],
        ['Adminanvändare', 'Vem som ser den här vyn.', '#system/adminanvandare'],
        ['Notisernas utskick', 'Vad som skickats, vad som väntar och vad som gick fel.', '#system/utskick'],
        ['Flaggor', 'Om mejlen och SMS:en går till riktiga mottagare.', '#system/flaggor']
      ];
      pekare.innerHTML = PEKARE.map(([namn, text, mål]) =>
        '<div class="dp-rad"><div><b>' + esc(namn) + '</b><span class="adm-und">' + esc(text) + '</span></div>'
        + '<a class="btn btn-ghost btn-sm" href="' + mål + '">Öppna</a></div>').join('');
    }
  }

  const rtForm = $('#rt-form');
  if (rtForm) rtForm.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#rt-msg');
    rensa(msg);
    const ar = Number($('#rt-ar').value);
    const kr = Number($('#rt-tak').value);
    const kalla = $('#rt-kalla').value.trim();
    if (!Number.isInteger(ar) || ar < 2020 || ar > 2100) { säg(msg, 'Skriv året med fyra siffror.', false); return; }
    if (!Number.isInteger(kr) || kr < 1) { säg(msg, 'Skriv taket i hela kronor.', false); return; }
    if (kalla.length < 3) { säg(msg, 'Skriv var siffran kommer ifrån.', false); $('#rt-kalla').focus(); return; }

    const finns = (S.rutTak || []).find(r => r.ar === ar);
    if (finns) {
      const ja = await bekräfta({
        titel: 'Byt RUT-taket för ' + ar + '?',
        text: 'I dag: ' + kronor(finns.tak_ore) + '. Nytt: ' + kronor(kr * 100)
          + '. Gäller fakturor som skapas från nästa körning.',
        knapp: 'Byt taket'
      });
      if (!ja) return;
    }
    const knapp = rtForm.querySelector('button[type="submit"]');
    await medan(knapp, 'Sparar…', async () => {
      const rad = { ar, tak_ore: kr * 100, kalla, uppdaterad: new Date().toISOString() };
      const { error } = await supa.from('rut_tak').upsert(rad);
      if (error) { säg(msg, 'Kunde inte spara: ' + felText(error), false); return; }
      S.rutTak = (S.rutTak || []).filter(r => r.ar !== ar).concat([rad]);
      rtForm.reset();
      ritaInstallningar();
      säg($('#rt-msg'), '✓ Taket för ' + ar + ' är sparat.', true);
      await laddaOmEkonomi();   // RUT utan tak försvinner ur avvikelserna
    });
  });

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-rt-bort]');
    if (!knapp) return;
    const ar = Number(knapp.dataset.rtBort);
    const ja = await bekräfta({
      titel: 'Ta bort RUT-taket för ' + ar + '?',
      text: 'Utan ett tak för året drar faktureringen ingen RUT alls för det året.',
      knapp: 'Ta bort'
    });
    if (!ja) return;
    const { error } = await supa.from('rut_tak').delete().eq('ar', ar);
    if (error) { alert('Kunde inte ta bort: ' + felText(error)); return; }
    S.rutTak = (S.rutTak || []).filter(r => r.ar !== ar);
    ritaInstallningar();
    await laddaOmEkonomi();
  });

  /* ============================================================
     AUDITLOGGEN (Fas 6)

     Vem som ändrade vad och när. Loggen bär bara id, status, belopp
     och datum — namnen slås upp här, ur det vyn redan har. En aktör
     utan id är systemet: faktureringen, en migration.
     ============================================================ */
  const AUDIT_OBJEKT = {
    matchning: 'Matchning', faktura: 'Faktura', utbetalning: 'Utbetalning', tjanst: 'Tjänst',
    rabattkod: 'Rabattkod', behorighet: 'Adminbehörighet', pass: 'Pass', rapport: 'Rapport',
    studiehjalpare: 'Studiehjälpare', skatteuppgifter: 'Personnummer', rut_tak: 'RUT-tak',
    anmalan: 'Intresseanmälan', ansokan: 'Ansökan', uppdrag: 'Uppdrag', uppgift: 'Uppgift',
    /* Fas 8 och 9.3. Passet loggas numera hela vägen, inte bara när
       det undantas från fakturering. */
    ai_forslag: 'AI-förslag', ai_konfig: 'AI-taket', kontaktmeddelande: 'Kontaktmeddelande',
    klientfel: 'Klientfel', bolagsfakta: 'Bolagsfakta',
    /* Program 2. flagga loggas sedan Fas 1.1 och de två notisraderna
       sedan Fas 2.1, men ingen av dem hade en etikett här: raden blev
       "notisdrift ändrad, sms_lage: prov → skicka", och sorten gick
       inte att välja i filtret. De två raderna är de två formulären i
       rutan Notiser under Inställningar. */
    flagga: 'Flagga', notisinstallning: 'Notisinställning', notisdrift: 'Utskicksinställning'
  };
  const AUDIT_HANDLING = {
    skapad: 'skapad', borttagen: 'borttagen', andrad: 'ändrad', status: 'ny status',
    aktiverad: 'aktiverad', avaktiverad: 'avaktiverad', sparade: 'sparat', lasta: 'läst', raderade: 'raderat'
  };
  const AUDIT_FALT = {
    status: 'läge', match_status: 'matchning', matched_tutor_id: 'studiehjälpare', parent_id: 'familj',
    tutor_id: 'studiehjälpare', belopp_ore: 'belopp', rut_ore: 'RUT', rut_ar: 'RUT-år',
    pris_per_timme_ore: 'pris', extra_personer_ore: 'tillägg', ersattning_per_timme_ore: 'ersättning',
    aktiv: 'aktiv', is_admin: 'admin', role: 'roll', fakturerbar: 'fakturerbart', booking_id: 'pass',
    narvaro: 'närvaro', hourly_rate: 'timpenning', visa_publikt: 'publik', betald_at: 'betald',
    skickad_at: 'skickad', utbetald_at: 'utbetald', forfaller: 'förfaller', period: 'period',
    rut_procent: 'RUT-andel', rut_berattigad: 'RUT',
    kund_id: 'kund', uppdrag_id: 'uppdrag', kontaktad_at: 'kontaktad', intervju_at: 'intervju',
    utbildad_at: 'utbildad', tjanst: 'tjänst', typ: 'typ', ansvarig: 'ansvarig',
    forfallodag: 'klar senast', nyckel: 'nyckel', kopplad_tabell: 'gäller', kopplad_id: 'rad',
    skapad_av: 'skapad av', skapad_av_typ: 'skapad av',
    /* Fas 9.3 och 9.4 */
    attendance: 'närvaro', wanted_date: 'datum', wanted_time: 'tid', student_id: 'elev',
    avbokad_at: 'avbokades', avbokad_av: 'avbokad av', avbokningsskal: 'skäl',
    matchad_at: 'matchades', lesson_date: 'passets datum', dygnstak_tokens: 'dygnstak',
    hanterad_at: 'hanterad', hanterad_av: 'hanterad av', sida: 'sida',
    korning_id: 'körning', beslutad_av: 'beslutad av',
    organisationsnummer: 'orgnr', bolagsform: 'bolagsform', rakenskapsar_slut: 'räkenskapsår',
    momsregistrerad: 'momsregistrerad', momsperiod: 'momsperiod', f_skatt: 'F-skatt',
    arbetsgivarregistrerad: 'arbetsgivarregistrerad',
    studiehjalpare_form: 'studiehjälparnas form', bokforingssystem: 'bokföringssystem',
    /* Program 2, Fas 2.1. Sandlådeadressen loggas med flit inte. */
    paminnelser_timmar: 'påminnelser', chatt_samla_minuter: 'mejl om meddelanden väntar',
    pass_samla_minuter: 'mejl om pass väntar', sms_lage: 'SMS-läge', sms_tak_per_dygn: 'SMS per dygn'
  };


  const MATCH_LAGE = { pending: 'väntar', matched: 'matchad', paused: 'pausad' };
  const STATUS_KARTA = { invoices: FAKT_LAGE, payouts: UTB_LAGE, tutor_profiles: SH_LAGE };

  function auditVärde(nyckel, v, tabellNamn) {
    if (v === null || v === undefined) return '—';
    if (nyckel === 'status' && STATUS_KARTA[tabellNamn] && STATUS_KARTA[tabellNamn][v]) {
      return String(STATUS_KARTA[tabellNamn][v][0]).toLowerCase();
    }
    if (nyckel === 'match_status' && MATCH_LAGE[v]) return MATCH_LAGE[v];
    if (nyckel === 'avbokningsskal' && AVBOKNINGSSKAL[v]) {
      return String(AVBOKNINGSSKAL[v][0]).toLowerCase();
    }
    if (typeof v === 'boolean') return v ? 'ja' : 'nej';
    if (/_ore$/.test(nyckel) && typeof v === 'number') return kronor(v);
    /* En lista timmar som JSON, "[24,1]", är en siffra för mycket
       att tolka. Samma ord som rutan Notiser säger. */
    if (nyckel === 'paminnelser_timmar' && Array.isArray(v)) {
      return v.length ? uppräkning(v.map(String)) + (v[v.length - 1] === 1 ? ' timme före' : ' timmar före')
        : 'inga';
    }
    if (/_minuter$/.test(nyckel) && typeof v === 'number') return v + ' min';
    if (typeof v === 'string' && S.personer && S.personer[v]) return namnFör(v);
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return kortDatum(v);
    if (typeof v === 'object') return JSON.stringify(v).slice(0, 60);
    return String(v).slice(0, 60);
  }

  function auditÄndring(r) {
    const fore = r.fore || {}, efter = r.efter || {};
    const nycklar = Object.keys(Object.assign({}, fore, efter)).filter(k => k !== 'id' && k !== 'kod');
    if (!nycklar.length) return '<span class="adm-und">—</span>';
    return nycklar.slice(0, 5).map(k => '<span class="adm-und">' + esc(AUDIT_FALT[k] || k) + ': '
      + (k in fore && r.fore ? esc(auditVärde(k, fore[k], r.tabell)) + ' → ' : '')
      + esc(auditVärde(k, efter[k], r.tabell)) + '</span>').join('');
  }

  /* ------------------------------------------------------------
     SÖKNINGEN (Fas 9.8)

     Filtret satt förut här, över de 300 senaste raderna. Det
     fungerade medan loggen var tom och slutade fungera TYST: när
     rad 301 fanns visade "Fakturor" bara de fakturahändelser som
     råkade rymmas bland de 300 senaste, och antalet under rubriken
     blev antalet träffar bland dem. En logg som svarar fel på "hur
     många gånger hände det" är sämre än ingen logg.

     Nu filtrerar och räknar audit_sok() i databasen. totalt kommer
     ur count(*) over () på den filtrerade mängden, alltså före
     limit — det är hela skillnaden.
     ------------------------------------------------------------ */
  const AUDIT_SIDA = 50;
  let auditTotalt = 0;

  function auditVal() {
    const v = id => { const el = $('#' + id); return el ? el.value : ''; };
    return {
      p_objekt_typ: v('audit-filter') || null,
      p_aktor: v('audit-vem') || null,
      p_fran: v('audit-fran') || null,
      p_till: v('audit-till') || null,
      p_bara_ai: !!($('#audit-ai') || {}).checked
    };
  }

  /* Vem-listan byggs ur de aktörer som FAKTISKT står i loggen, inte
     ur alla admins: ett filter på en person som aldrig gjort något
     ger bara en tom tabell att fundera över. Och inte bara ur admins
     heller — en familj som avbokar ett pass skriver också en rad.

     Listan växer allteftersom sidor hämtas, men töms aldrig: valet i
     rullgardinen får inte försvinna under den som just valde det. */
  function fyllAuditVem() {
    const väljare = $('#audit-vem');
    if (!väljare) return;
    const fanns = {};
    Array.prototype.forEach.call(väljare.options, o => { if (o.value) fanns[o.value] = true; });
    const nya = {};
    (S.auditAktorer || []).concat(S.audit || [])
      .forEach(r => { if (r.aktor && !fanns[r.aktor]) nya[r.aktor] = true; });
    Object.keys(nya).sort((a, b) => namnFör(a).localeCompare(namnFör(b), 'sv'))
      .forEach(id => {
        const o = document.createElement('option');
        o.value = id;
        o.textContent = namnFör(id);
        väljare.appendChild(o);
      });
  }

  async function hämtaAudit(offset) {
    const { data, error } = await supa.rpc('audit_sok',
      Object.assign(auditVal(), { p_limit: AUDIT_SIDA, p_offset: offset || 0 }));
    if (error) return { fel: felText(error), rader: [] };
    const rader = data || [];
    /* totalt står på varje rad. Tom mängd betyder noll träffar, och
       det är ett svar — inte ett saknat svar. */
    auditTotalt = rader.length ? Number(rader[0].totalt) : 0;
    return { fel: null, rader: rader };
  }

  function ritaAudit(rader, fel, lägTill) {
    const host = $('#audit-tabell');
    if (!host) return;

    if (fel) {
      host.innerHTML = '<p class="fel">Loggen svarade inte: ' + esc(fel) + '</p>';
      $('#audit-antal').textContent = '';
      $('#audit-mer').hidden = true;
      return;
    }

    S.audit = lägTill ? (S.audit || []).concat(rader) : (rader || []);
    fyllAuditVem();

    const v = auditVal();
    const filtrerat = !!(v.p_objekt_typ || v.p_aktor || v.p_fran || v.p_till || v.p_bara_ai);

    $('#audit-antal').textContent = auditTotalt
      ? (S.audit.length < auditTotalt
          ? 'visar ' + S.audit.length + ' av ' + auditTotalt
          : auditTotalt + ' st')
      : '';

    host.innerHTML = tabell([
      { namn: 'När', rita: r => '<span class="adm-tal">' + esc(kortDatum(r.tid)) + '</span>'
        + '<span class="adm-und">' + esc(new Date(r.tid).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })) + '</span>' },
      /* AI-märket sitter på VEM, inte i en egen kolumn: frågan man
         ställer är "gjorde en människa det här". Att raden kommer ur
         ett AI-förslag betyder att en admin godkände det — därför
         både namnet och märket, aldrig märket i stället för namnet. */
      { namn: 'Vem', rita: r => (r.aktor ? esc(namnFör(r.aktor)) : pill('System', 'ar-vantar'))
        + (r.fran_ai ? ' ' + pill('AI-förslag', 'ar-ny') : '') },
      { namn: 'Vad', rita: r => {
        const [obj, gjord] = String(r.handling).split('.');
        return '<b>' + esc(AUDIT_OBJEKT[obj] || obj) + '</b> ' + esc(AUDIT_HANDLING[gjord] || gjord || '');
      } },
      /* Ett uuid kapas till åtta tecken, för det är ändå oläsbart. Men
         objekt_id är en KOD för tjänster och rabattkoder, och då gjorde
         avkortningen 'hushallsnara' till 'hushalln' — alltså obegripligt
         av misstag. Bara det som ser ut som ett uuid kapas. */
      { namn: 'Gäller', rita: r => {
        if (S.personer && S.personer[r.objekt_id]) return esc(namnFör(r.objekt_id));
        const id = String(r.objekt_id == null ? '' : r.objekt_id);
        return esc(/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id) ? id.slice(0, 8) : id);
      } },
      { namn: 'Ändring', rita: auditÄndring }
    ], S.audit, filtrerat ? 'Ingen händelse matchar filtret' : 'Inget loggat än');

    const mer = $('#audit-mer');
    if (mer) mer.hidden = S.audit.length >= auditTotalt;
  }

  async function sökAudit() {
    const host = $('#audit-tabell');
    if (host) host.innerHTML = '<div class="loading">Hämtar</div>';
    const svar = await hämtaAudit(0);
    ritaAudit(svar.rader, svar.fel, false);
  }

  ['audit-filter', 'audit-vem', 'audit-fran', 'audit-till', 'audit-ai'].forEach(id => {
    const el = $('#' + id);
    if (el) el.addEventListener('change', sökAudit);
  });

  const auditMer = $('#audit-mer-knapp');
  if (auditMer) auditMer.addEventListener('click', async () => {
    const svar = await hämtaAudit((S.audit || []).length);
    ritaAudit(svar.rader, svar.fel, true);
  });

  /* Loggen hämtas om när fliken öppnas: det som hänt sedan sidan
     laddades — av någon annan admin, eller nyss här — ska synas. */
  const auditFlik = $('#flik-audit');
  if (auditFlik) auditFlik.addEventListener('click', sökAudit);


  /* ============================================================
     DOKUMENT (Fas 9.10)

     Handlingar OM verksamheten: avtal, intyg, försäkringar,
     bolagspapper. Hinken är privat och policyerna släpper bara in
     admin.

     TVÅ SAKER SOM INTE ÄR GODTYCKLIGA:

     1. RADEN SKAPAS FÖRST, FILEN SEDAN. Hinkpolicyn kräver att
        handlingen finns — sökvägen ÄR radens id. Går uppladdningen
        fel tas raden bort igen, så att listan aldrig visar en
        handling utan fil.

     2. VID BORTTAGNING: FILEN FÖRST, RADEN SEDAN, OCH SVARET LÄSES.
        Sökvägen finns bara i raden. Försvinner raden först blir
        filen omöjlig att hitta och omöjlig att städa — exakt det
        fel 9.2 rättade i materiallistan.
     ============================================================ */
  const DOK_TYP = {
    avtal: 'Avtal', intyg: 'Intyg', forsakring: 'Försäkring',
    bolagshandling: 'Bolagshandling', policy: 'Policy', ovrigt: 'Övrigt'
  };

  function dokFilnamn(h) {
    if (!h.fil) return null;
    /* Sökvägen är "<id>/<tidsstämpel>-<filnamn>". Visa bara det sista. */
    return String(h.fil).split('/').slice(1).join('/').replace(/^\d+-/, '');
  }

  function ritaDokument() {
    const host = $('#dok-tabell');
    if (!host) return;
    const filter = ($('#dok-filter') || {}).value || '';
    const alla = S.handlingar || [];
    const rader = alla.filter(h => !filter || h.typ === filter);
    const idag = isoFor(new Date());

    $('#dok-antal').textContent = rader.length + ' av ' + alla.length;
    host.innerHTML = tabell([
      { namn: 'Sort', rita: h => '<b>' + esc(DOK_TYP[h.typ] || h.typ) + '</b>' },
      { namn: 'Vad', rita: h => esc(h.titel)
        + (dokFilnamn(h) ? '<span class="adm-und">' + esc(dokFilnamn(h)) + '</span>' : '') },
      { namn: 'Gäller', rita: h => h.kopplad_tabell
        ? esc(S.personer && S.personer[h.kopplad_id]
              ? namnFör(h.kopplad_id) : String(h.kopplad_id).slice(0, 8))
        : '<span style="color:var(--bl-3)">—</span>' },
      { namn: 'Giltig till', rita: h => h.giltig_till
        ? '<span class="adm-tal">' + esc(kortDatum(h.giltig_till)) + '</span>'
          + (h.giltig_till < idag ? ' ' + pill('Gått ut', 'ar-ny') : '')
        : '<span style="color:var(--bl-3)">—</span>' },
      { namn: 'Uppladdad', rita: h => '<span class="adm-tal">' + esc(kortDatum(h.uppladdad)) + '</span>'
        + '<span class="adm-und">' + esc(h.uppladdad_av ? namnFör(h.uppladdad_av) : 'okänt') + '</span>' },
      { namn: '', höger: true, rita: h =>
        (h.fil ? '<button class="btn btn-ghost btn-sm" data-dok-oppna="' + h.id + '">Öppna</button> ' : '')
        + '<button class="btn btn-ghost btn-sm" data-dok-bort="' + h.id + '">Ta bort</button>' }
    ], rader, filter ? 'Ingen handling av den sorten' : 'Inga handlingar än');
  }

  async function hämtaHandlingar() {
    const { data, error } = await supa.from('handlingar').select('*')
      .order('uppladdad', { ascending: false });
    S.handlingarFel = error ? felText(error) : null;
    S.handlingar = data || [];
    ritaDokument();
  }

  const dokFilter = $('#dok-filter');
  if (dokFilter) dokFilter.addEventListener('change', ritaDokument);

  const dokFlik = $('#flik-dokument');
  if (dokFlik) dokFlik.addEventListener('click', hämtaHandlingar);

  const dokSpara = $('#dok-spara');
  if (dokSpara) dokSpara.addEventListener('click', async () => {
    const msg = $('#dok-msg');
    const titel = $('#dok-titel').value.trim();
    const fil = ($('#dok-fil').files || [])[0];
    if (!titel) { säg(msg, 'Skriv vad handlingen är.', false); return; }
    if (!fil) { säg(msg, 'Välj en fil.', false); return; }
    const filfel = M.granskaFil(fil);
    if (filfel) { säg(msg, filfel, false); return; }

    await medan(dokSpara, 'Laddar upp…', async () => {
      /* Raden först: hinkpolicyn kräver att handlingen finns,
         eftersom sökvägen är radens id. */
      const ny = await supa.from('handlingar').insert({
        typ: $('#dok-typ').value,
        titel: titel,
        giltig_till: $('#dok-till').value || null,
        mimetyp: fil.type || null,
        storlek: fil.size,
        uppladdad_av: S.user.id
      }).select('id').single();
      if (ny.error) { säg(msg, 'Kunde inte spara: ' + felText(ny.error), false); return; }

      const rent = fil.name.replace(/[^\w.\-]+/g, '_').slice(-80);
      const sökväg = ny.data.id + '/' + Date.now() + '-' + rent;
      const upp = await supa.storage.from('dokument').upload(sökväg, fil, {
        contentType: fil.type, upsert: false
      });
      if (upp.error) {
        /* Raden bort igen. En handling utan fil är en rad som lovar
           något den inte har. */
        await supa.from('handlingar').delete().eq('id', ny.data.id);
        säg(msg, 'Filen gick inte upp: ' + upp.error.message + ' Ingenting sparades.', false);
        return;
      }

      const klar = await supa.from('handlingar').update({ fil: sökväg }).eq('id', ny.data.id);
      if (klar.error) {
        await supa.storage.from('dokument').remove([sökväg]);
        await supa.from('handlingar').delete().eq('id', ny.data.id);
        säg(msg, 'Kunde inte koppla filen: ' + felText(klar.error) + ' Ingenting sparades.', false);
        return;
      }

      $('#dok-titel').value = '';
      $('#dok-till').value = '';
      $('#dok-fil').value = '';
      säg(msg, 'Handlingen är sparad.', true);
      await hämtaHandlingar();
    });
  });

  document.addEventListener('click', async e => {
    const öppna = e.target.closest('[data-dok-oppna]');
    if (öppna) {
      const h = (S.handlingar || []).find(x => x.id === öppna.dataset.dokOppna);
      if (!h || !h.fil) return;
      await medan(öppna, 'Öppnar…', async () => {
        const url = await M.signera('dokument', h.fil, 3600);
        if (!url) { alert('Filen gick inte att öppna. Den kan ha tagits bort ur lagringen.'); return; }
        window.open(url, '_blank', 'noopener');
      });
      return;
    }

    const bort = e.target.closest('[data-dok-bort]');
    if (bort) {
      const h = (S.handlingar || []).find(x => x.id === bort.dataset.dokBort);
      if (!h) return;
      const ja = await bekräfta({
        titel: 'Ta bort handlingen?',
        text: h.titel + '. Både raden och filen försvinner, och det går inte att ångra.',
        knapp: 'Ta bort'
      });
      if (!ja) return;
      await medan(bort, 'Tar bort…', async () => {
        /* Filen först, och svaret LÄSES. Sökvägen finns bara i
           raden: försvinner raden först blir filen omöjlig att
           hitta och omöjlig att städa. */
        if (h.fil) {
          const { error: filfel } = await supa.storage.from('dokument').remove([h.fil]);
          if (filfel) {
            alert('Filen kunde inte tas bort ur lagringen: ' + felText(filfel)
              + '\n\nRaden står kvar, annars hade filen blivit omöjlig att hitta.');
            return;
          }
          M.glömSignerad('dokument', h.fil);
        }
        const { error } = await supa.from('handlingar').delete().eq('id', h.id);
        if (error) { alert('Kunde inte ta bort: ' + felText(error)); return; }
        await hämtaHandlingar();
      });
    }
  });

  /* ============================================================
     FLAGGOR (program 2, Fas 1.1)

     Det som väntar på ett beslut om affär, juridik eller pengar är
     byggt bakom en rad i `flaggor`, av som förval. Den som slår på en
     ska se VARFÖR den var av, inte bara att den var det: vantar_pa
     visas därför ordagrant i bekräftelsen, med sina radbrytningar.

     Bara kolumnen aktiv skrivs. Nyckeln och texterna ägs av
     migrationerna, och databasen svarar 42501 på allt annat. Vem som
     slog om och när stämplas av databasen, och varje omslag hamnar i
     auditloggen.

     Av behöver ingen bekräftelse. Det är nödbromsen, och en broms
     som frågar "är du säker?" är en sämre broms.
     ============================================================ */
  async function hämtaFlaggor() {
    const { data, error } = await supa.from('flaggor')
      .select('kod, aktiv, beskrivning, vantar_pa, uppdaterad, uppdaterad_av').order('kod');
    S.flaggorFel = error ? felText(error) : null;
    S.flaggor = data || [];
  }

  function ritaFlaggorLista() {
    const host = $('#flaggor-lista');
    if (!host) return;
    const lista = S.flaggor || [];
    const antal = $('#flaggor-antal');
    if (antal) {
      const på = lista.filter(f => f.aktiv).length;
      antal.textContent = lista.length ? på + ' av ' + lista.length + ' på' : '';
    }
    if (S.flaggorFel) { host.innerHTML = tomt('Kunde inte hämta flaggorna', S.flaggorFel); return; }
    if (!lista.length) {
      host.innerHTML = tomt('Inga flaggor', 'Allt som väntar på ett beslut läggs in här av en migration.');
      return;
    }
    host.innerHTML = lista.map(f => '<div class="dp-rad" style="align-items:start">'
      + '<div><b>' + esc(f.kod) + '</b>'
      + '<span>' + esc(f.beskrivning || '') + '</span>'
      + '<span>Väntar på: ' + esc(f.vantar_pa || 'inget angivet') + '</span>'
      + '<span>Ändrad ' + esc(kortDatum(f.uppdaterad))
      + (f.uppdaterad_av ? ' av ' + esc(namnFör(f.uppdaterad_av)) : '') + '</span></div>'
      + '<span class="dp-rad-hoger" style="display:flex;gap:10px;align-items:center">'
      + (f.aktiv ? pill('På', 'ar-klar') : pill('Av', ''))
      + '<button class="btn btn-ghost btn-sm" type="button" style="min-height:44px"'
      + ' data-flagga="' + esc(f.kod) + '" data-flagga-till="' + (f.aktiv ? 'av' : 'pa') + '">'
      + (f.aktiv ? 'Slå av' : 'Slå på') + '</button></span>'
      + '</div>').join('');
  }

  /* Hämtas när vyn startar och varje gång fliken öppnas: en annan
     admin kan ha slagit om sedan sidan laddades. Ett fel här ska
     synas i fliken, inte stoppa resten av vyn. */
  async function ritaFlaggor() {
    try {
      await hämtaFlaggor();
    } catch (e) {
      S.flaggorFel = felText(e);
      S.flaggor = [];
    }
    ritaFlaggorLista();
  }

  const flaggFlik = $('#flik-flaggor');
  if (flaggFlik) flaggFlik.addEventListener('click', ritaFlaggor);

  /* Vad som händer i praktiken när notisflaggorna slås på (program 2,
     Fas 2). vantar_pa säger vad flaggan väntar på; det här säger vart
     utskicken går efteråt, för det är inte samma sak som förut: med
     notiser_mejl av går mejlen till sandlådan, och notiser_sms skickar
     ingenting så länge SMS-läget är prov. */
  const FLAGG_TILLÄGG = {
    notiser_mejl: () => 'Med flaggan på går mejlen till familjernas och studiehjälparnas egna '
      + 'adresser, inte längre till sandlådan.',
    notiser_sms: () => {
      const d = S.notis && S.notis.drift;
      return 'Även med flaggan på går inga riktiga SMS förrän SMS-läget under Inställningar, '
        + 'rutan Notiser, är skicka.'
        + (d ? ' Just nu är det ' + (d.sms_lage === 'skicka' ? 'skicka.' : 'prov.') : '');
    }
  };

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-flagga]');
    if (!knapp) return;
    const kod = knapp.dataset.flagga;
    const f = (S.flaggor || []).find(x => x.kod === kod);
    if (!f) return;
    const nytt = knapp.dataset.flaggaTill === 'pa';
    const msg = $('#flaggor-msg');
    rensa(msg);

    if (nytt) {
      const tillägg = FLAGG_TILLÄGG[kod] ? FLAGG_TILLÄGG[kod]() + ' ' : '';
      const ja = await bekräfta({
        titel: 'Slå på ' + kod + '?',
        text: tillägg + (f.vantar_pa
          ? 'Flaggan väntar på ett beslut. Så här står det:'
          : 'Flaggan har ingen text om vad den väntar på.'),
        forhandsvisning: f.vantar_pa || undefined,
        knapp: 'Slå på'
      });
      if (!ja) return;
    }

    await medan(knapp, nytt ? 'Slår på…' : 'Slår av…', async () => {
      const { data, error } = await supa.from('flaggor').update({ aktiv: nytt })
        .eq('kod', kod).select('kod, aktiv, beskrivning, vantar_pa, uppdaterad, uppdaterad_av');
      if (error) { säg(msg, 'Kunde inte ändra ' + kod + ': ' + felText(error), false); return; }
      if (!(data || []).length) { säg(msg, 'Ingenting ändrades: flaggan ' + kod + ' hittades inte.', false); return; }
      Object.assign(f, data[0]);
      ritaFlaggorLista();
      säg(msg, kod + ' är ' + (f.aktiv ? 'på.' : 'av.'), true);
      const ny = document.querySelector('[data-flagga="' + kod + '"]');
      if (ny) ny.focus();
    });
  });

  /* ============================================================
     NOTISERNA (program 2, Fas 2)

     Två platser. Rutan Notiser under Inställningar, där det som
     styr utskicken ändras, och fliken Utskick, där det syns vad som
     faktiskt hände. Datan hämtas av hämtaNotisläge() i kärnan.

     INGA MEJLADRESSER I LISTAN. Mottagaren visas med namn ur
     S.personer, aldrig med adress, inte ens när namnet saknas:
     namnFör() faller tillbaka på e-posten och används därför inte
     här. Felen från leverantörerna maskas innan de ritas, för ett
     studsande mejl svarar ofta med adressen i texten. Sandlådan står
     i formuläret, för den är adminens egen.

     BARA DET SOM ÄNDRATS SKRIVS. Auditloggen tar varje kolumn som
     står i en update, också den som fick samma värde igen, och en
     logg full av "ändrat från 3 till 3" döljer det som faktiskt
     ändrades.
     ============================================================ */
  const NOTIS_TYP = {
    pass_nytt: 'Nytt pass', pass_bekraftat: 'Pass bekräftat', pass_flyttat: 'Pass flyttat',
    pass_avbokat: 'Pass avbokat', pass_avbojt: 'Pass avböjt', meddelande: 'Nytt meddelande',
    rapport: 'Ny rapport', paminnelse: 'Påminnelse'
  };
  /* Färgen är genvägen, ordet är beskedet (se pill() i kärnan). */
  const UTSKICK_LAGE = {
    vantar: ['Väntar', 'ar-vantar'], skickar: ['Skickas', 'ar-vantar'], skickad: ['Skickad', 'ar-klar'],
    hoppad: ['Hoppad', ''], loggad: ['Loggad', ''], fel: ['Fel', 'ar-ny']
  };
  /* Rollen ett provmejl skrivs för (notis_provmejl(p_roll), Fas 2.3d).
     Nycklarna är de två databasen tar emot, i den ordning de provas. */
  const PROVROLL = { parent: 'familj', tutor: 'studiehjälpare' };
  const INST_KOLUMNER = 'paminnelser_timmar, chatt_samla_minuter, pass_samla_minuter, uppdaterad, uppdaterad_av';
  const DRIFT_KOLUMNER = 'mejl_sandlada, sms_lage, sms_tak_per_dygn, uppdaterad, uppdaterad_av';

  const IKON_OK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/>'
    + '<path d="m8.5 12.2 2.4 2.4 4.6-5"/></svg>';
  const IKON_VARNING = '<svg viewBox="0 0 24 24" aria-hidden="true" style="stroke:var(--acc-text)">'
    + '<path d="M12 3.8 2.8 19.5h18.4z"/><path d="M12 9.8v4.4M12 16.9h.01"/></svg>';

  function klocka(iso) {
    return iso ? new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '';
  }

  function tidCell(iso) {
    if (!iso) return '<span style="color:var(--bl-3)">—</span>';
    return '<span class="adm-tal">' + esc(kortDatum(iso)) + '</span>'
      + '<span class="adm-und">' + esc(klocka(iso)) + '</span>';
  }

  /* En adress eller ett telefonnummer i en feltext blir ett ord.
     Grovt med flit: hellre en maskad bit för mycket än en adress i
     en lista som visas på en delad skärm. */
  function utanAdresser(text) {
    return String(text == null ? '' : text)
      .replace(/[^\s@<>()"',;:]+@[^\s@<>()"',;:]+/g, '[adress]')
      .replace(/(?:\+|\b0)\d[\d\s-]{6,}\d/g, '[nummer]');
  }

  /* Rollen står som den står i profiles. Förut blev allt som inte var
     tutor "Familj", också ett konto med rollen admin. Arbetaren skriver
     visserligen ett sådant kontos mejl som till en familj, men listan
     svarar på vem som fick det, inte på hur det såg ut. */
  const MOTTAGARROLL = { parent: 'Familj', tutor: 'Studiehjälpare', admin: 'Admin' };

  /* Namnet går genom utanAdresser() som felen gör. full_name är
     fritext som den som registrerar sig skriver själv, och ett namn
     som är en adress hade annars stått i klartext i listan och i
     "Senast ändrad av". */
  function mottagare(id) {
    const p = S.personer[id];
    if (!p) return { namn: 'Okänt konto', roll: '' };
    const roll = MOTTAGARROLL[p.role] || '';
    return {
      namn: utanAdresser(p.full_name || (roll || 'Konto') + ' utan namn')
        + (S.user && id === S.user.id ? ' (du)' : ''),
      roll: roll
    };
  }

  function ändradText(rad) {
    if (!rad || !rad.uppdaterad) return '';
    const vem = rad.uppdaterad_av && S.personer[rad.uppdaterad_av]
      ? mottagare(rad.uppdaterad_av).namn : null;
    return 'Senast ändrad ' + kortDatum(rad.uppdaterad) + ' kl. ' + klocka(rad.uppdaterad)
      + (vem ? ' av ' + vem : '') + '.';
  }

  function timmarText(lista) {
    if (!lista || !lista.length) return 'Inga påminnelser';
    const sista = lista[lista.length - 1];
    return (lista.length === 1 ? 'Påminnelse ' : 'Påminnelser ')
      + uppräkning(lista.map(String)) + (sista === 1 ? ' timme' : ' timmar') + ' före passet';
  }

  /* Ett heltal ur ett fält, eller NaN. Number('') är 0, och ett tomt
     fält ska inte tyst bli noll minuter. */
  function heltal(sel) {
    const v = String(($(sel) || {}).value || '').trim();
    return /^-?\d+$/.test(v) ? Number(v) : NaN;
  }

  function sammaLista(a, b) {
    const x = a || [], y = b || [];
    return x.length === y.length && x.every((v, i) => Number(v) === Number(y[i]));
  }

  function rpcFel(namn, fel, status) {
    if (saknasFunktion(fel, status)) {
      return 'Funktionen ' + namn + ' finns inte i databasen än. Migrationerna för notiserna är inte körda.';
    }
    return felText(fel);
  }

  /* ---------- rutan Notiser under Inställningar ---------- */

  function ritaNotisrutan() {
    const niForm = $('#ni-form'), ndForm = $('#nd-form');
    if (!niForm || !ndForm) return;
    const N = S.notis;
    const lägeEl = $('#ni-lage');

    let besked = '';
    if (!N.hämtad) besked = '';
    else if (N.saknas) besked = 'Notistabellerna finns inte än. Migrationerna för notiserna (program 2, Fas 2) '
      + 'är inte körda, så här finns inget att ändra.';
    else if (N.fel) besked = 'Kunde inte hämta notisinställningarna: ' + N.fel;
    else if (!N.installning) besked = 'Raden med notisinställningarna saknas i databasen.';
    else if (!N.drift) besked = 'Utskickens inställningar gick inte att läsa. De visas bara för admin.';
    if (lägeEl) { lägeEl.textContent = besked; lägeEl.hidden = !besked; }

    const instKan = !!N.installning;
    const driftKan = !!N.drift;
    niForm.querySelectorAll('input, button').forEach(el => { el.disabled = !instKan; });
    ndForm.querySelectorAll('input, select, button').forEach(el => { el.disabled = !driftKan; });
    $$('[data-notis-kor]').forEach(k => { k.disabled = !instKan; });
    const prov = $('#notis-provmejl');
    if (prov) prov.disabled = !instKan;

    /* Ett formulär någon håller på att fylla i skrivs inte över av en
       hämtning som råkar bli klar under tiden. */
    if (N.installning && niForm.dataset.andrad !== '1') {
      const t = (N.installning.paminnelser_timmar || []).slice(0, 4);
      ['#ni-t1', '#ni-t2', '#ni-t3', '#ni-t4'].forEach((sel, i) => {
        $(sel).value = t[i] != null ? String(t[i]) : '';
      });
      $('#ni-chatt').value = String(N.installning.chatt_samla_minuter);
      $('#ni-pass').value = String(N.installning.pass_samla_minuter);
    }
    if (N.drift && ndForm.dataset.andrad !== '1') {
      $('#nd-sandlada').value = N.drift.mejl_sandlada || '';
      $('#nd-sms-lage').value = N.drift.sms_lage === 'skicka' ? 'skicka' : 'prov';
      $('#nd-tak').value = String(N.drift.sms_tak_per_dygn);
    }
    $('#ni-andrad').textContent = ändradText(N.installning);
    $('#nd-andrad').textContent = ändradText(N.drift);
  }

  const niForm = $('#ni-form');
  if (niForm) {
    niForm.addEventListener('input', () => { niForm.dataset.andrad = '1'; });
    niForm.addEventListener('submit', async e => {
      e.preventDefault();
      const msg = $('#ni-msg');
      rensa(msg);
      const N = S.notis;
      if (!N.installning) { säg(msg, 'Inställningarna är inte hämtade, så inget kan sparas.', false); return; }

      const timmar = [];
      for (const sel of ['#ni-t1', '#ni-t2', '#ni-t3', '#ni-t4']) {
        const fält = $(sel);
        /* Ett nummerfält med bokstäver i har värdet '' och hade annars
           räknats som tomt, alltså som en påminnelse mindre. */
        if (!fält.value.trim() && !(fält.validity && fält.validity.badInput)) continue;
        const h = heltal(sel);
        if (!Number.isInteger(h) || h < 1 || h > 168) {
          säg(msg, 'En påminnelse är ett helt antal timmar mellan 1 och 168.', false);
          fält.focus();
          return;
        }
        if (timmar.indexOf(h) === -1) timmar.push(h);
      }
      /* Längst före passet först, som i databasens förval {24,1}. Samma
         tid två gånger blir en: den hade ändå bara gett en påminnelse. */
      timmar.sort((a, b) => b - a);

      const chatt = heltal('#ni-chatt'), pass = heltal('#ni-pass');
      if (!Number.isInteger(chatt) || chatt < 1 || chatt > 180) {
        säg(msg, 'Mejl om meddelanden väntar mellan 1 och 180 minuter.', false);
        $('#ni-chatt').focus();
        return;
      }
      if (!Number.isInteger(pass) || pass < 0 || pass > 60) {
        säg(msg, 'Mejl om pass väntar mellan 0 och 60 minuter.', false);
        $('#ni-pass').focus();
        return;
      }

      const ändring = {};
      if (!sammaLista(timmar, N.installning.paminnelser_timmar)) ändring.paminnelser_timmar = timmar;
      if (chatt !== N.installning.chatt_samla_minuter) ändring.chatt_samla_minuter = chatt;
      if (pass !== N.installning.pass_samla_minuter) ändring.pass_samla_minuter = pass;
      if (!Object.keys(ändring).length) {
        niForm.dataset.andrad = '';
        ritaNotisrutan();
        säg(msg, 'Inget är ändrat.', true);
        return;
      }

      if ('paminnelser_timmar' in ändring && !timmar.length) {
        const ja = await bekräfta({
          titel: 'Inga påminnelser alls?',
          text: 'Då får ingen familj och ingen studiehjälpare någon påminnelse före ett pass, '
            + 'varken i appen, som mejl eller som SMS.',
          knapp: 'Stäng av påminnelserna'
        });
        if (!ja) return;
      }

      const knapp = niForm.querySelector('button[type="submit"]');
      await medan(knapp, 'Sparar…', async () => {
        const { data, error } = await supa.from('notis_installning').update(ändring).eq('id', 1)
          .select(INST_KOLUMNER);
        if (error) { säg(msg, 'Kunde inte spara: ' + felText(error), false); return; }
        /* RLS svarar inte med ett fel när en rad inte får ändras, bara
           med noll rader. Ingen rad tillbaka betyder att inget sparades. */
        if (!(data || []).length) {
          säg(msg, 'Ingenting sparades. Databasen släppte inte igenom ändringen.', false);
          return;
        }
        N.installning = data[0];
        niForm.dataset.andrad = '';
        ritaNotisrutan();
        säg(msg, 'Sparat. ' + timmarText(N.installning.paminnelser_timmar) + '. Mejl om meddelanden väntar '
          + N.installning.chatt_samla_minuter + ' min, mejl om pass ' + N.installning.pass_samla_minuter
          + ' min.', true);
      });
    });
  }

  const ndForm = $('#nd-form');
  if (ndForm) {
    ndForm.addEventListener('input', () => { ndForm.dataset.andrad = '1'; });
    ndForm.addEventListener('change', () => { ndForm.dataset.andrad = '1'; });
    ndForm.addEventListener('submit', async e => {
      e.preventDefault();
      const msg = $('#nd-msg');
      rensa(msg);
      const N = S.notis;
      if (!N.drift) { säg(msg, 'Inställningarna är inte hämtade, så inget kan sparas.', false); return; }

      const sandlåda = $('#nd-sandlada').value.trim();
      /* Samma regel som villkoret i databasen, så att felet kommer här
         och på svenska i stället för som en rå 23514. */
      if (sandlåda && !NX.epostOk(sandlåda)) {
        säg(msg, 'Sandlådan ska vara en e-postadress, eller tom.', false);
        $('#nd-sandlada').focus();
        return;
      }
      const smsLäge = $('#nd-sms-lage').value === 'skicka' ? 'skicka' : 'prov';
      const tak = heltal('#nd-tak');
      if (!Number.isInteger(tak) || tak < 0 || tak > 5000) {
        säg(msg, 'Dygnstaket är ett helt antal SMS mellan 0 och 5000.', false);
        $('#nd-tak').focus();
        return;
      }

      const ändring = {};
      if ((sandlåda || null) !== (N.drift.mejl_sandlada || null)) ändring.mejl_sandlada = sandlåda || null;
      if (smsLäge !== N.drift.sms_lage) ändring.sms_lage = smsLäge;
      if (tak !== N.drift.sms_tak_per_dygn) ändring.sms_tak_per_dygn = tak;
      if (!Object.keys(ändring).length) {
        ndForm.dataset.andrad = '';
        ritaNotisrutan();
        säg(msg, 'Inget är ändrat.', true);
        return;
      }

      /* Prov till skicka är det enda här som kostar pengar. */
      if (ändring.sms_lage === 'skicka') {
        const flagga = (S.flaggor || []).find(f => f.kod === 'notiser_sms');
        const ja = await bekräfta({
          titel: 'Skicka riktiga SMS?',
          text: 'I läget skicka går riktiga SMS till dem som själva slagit på SMS-påminnelser, så länge '
            + 'flaggan notiser_sms är på. Varje SMS kostar pengar hos SMS-leverantören. '
            + (tak === 0 ? 'Dygnstaket är 0, så inget går förrän det höjs.'
              : 'Högst ' + tak + ' SMS per dygn.')
            + (flagga && !flagga.aktiv ? ' Flaggan notiser_sms är av just nu, så inget skickas förrän den slås på.' : ''),
          knapp: 'Ja, skicka riktiga SMS'
        });
        /* Avbryt lämnade rutan på "Skicka riktiga SMS" fast databasen
           sa prov, och formuläret var märkt som ändrat, så Hämta om
           rättade den inte heller. Rutan visar nu det som gäller, och
           det andra i formuläret står kvar för den som vill spara det. */
        if (!ja) {
          $('#nd-sms-lage').value = N.drift.sms_lage === 'skicka' ? 'skicka' : 'prov';
          if (Object.keys(ändring).length === 1) ndForm.dataset.andrad = '';
          säg(msg, 'Inget sparades. SMS-läget är fortfarande prov.', true);
          return;
        }
      }

      const knapp = ndForm.querySelector('button[type="submit"]');
      await medan(knapp, 'Sparar…', async () => {
        const { data, error } = await supa.from('notis_drift').update(ändring).eq('id', 1)
          .select(DRIFT_KOLUMNER);
        if (error) { säg(msg, 'Kunde inte spara: ' + felText(error), false); return; }
        if (!(data || []).length) {
          säg(msg, 'Ingenting sparades. Databasen släppte inte igenom ändringen.', false);
          return;
        }
        N.drift = data[0];
        ndForm.dataset.andrad = '';
        ritaNotisrutan();
        säg(msg, 'Sparat. ' + (N.drift.mejl_sandlada ? 'Sandlådan tar emot mejlen medan flaggan är av'
          : 'Ingen sandlåda, så mejlen loggas bara medan flaggan är av')
          + '. SMS-läget är ' + (N.drift.sms_lage === 'skicka' ? 'skicka' : 'prov')
          + ', högst ' + N.drift.sms_tak_per_dygn + ' per dygn.', true);
      });
    });
  }

  /* ---------- fliken Utskick ---------- */

  function ritaArbetaren() {
    const host = $('#utskick-lage');
    if (!host) return;
    const N = S.notis;
    if (!N.hämtad) { host.innerHTML = '<div class="loading">Hämtar</div>'; return; }
    if (N.saknas) {
      host.innerHTML = tomt('Notistabellerna finns inte än',
        'Migrationerna för notiserna (program 2, Fas 2) är inte körda. Fliken fylls när de är det.');
      return;
    }
    if (N.fel) {
      host.innerHTML = '<p class="fel">Notisläget svarade inte: ' + esc(N.fel) + '</p>';
      return;
    }

    const senast = N.körningar[0];
    const när = senast ? kortDatum(senast.tid) + ' kl. ' + klocka(senast.tid) : '';
    const väntar = N.väntar === 1 ? '1 utskick väntar' : N.väntar + ' utskick väntar';
    let ruta;
    if (N.tyst) {
      ruta = '<div class="adm-lugnt" role="status" style="background:color-mix(in srgb,var(--acc) 8%,transparent)">'
        + IKON_VARNING
        + '<span><b>' + esc(senast ? 'Arbetaren har inte kört den senaste kvarten'
            : 'Arbetaren har inte kört någon gång') + '</b>'
        + '<span>' + esc(väntar + ' på att skickas.'
            + (senast ? ' Senaste körningen var ' + när + '.' : '')
            + ' Tryck Kör nu. Händer ändå ingenting, se Fel, rutan Anrop som inte gick fram:'
            + ' där syns det om arbetaren svarar med ett fel.') + '</span></span></div>';
    } else {
      ruta = '<div class="adm-lugnt" role="status">' + IKON_OK
        + '<span><b>' + esc(N.väntar ? väntar + ' på att skickas' : 'Inget väntar på att skickas') + '</b>'
        + '<span>' + esc(senast ? 'Arbetaren körde senast ' + när + '.'
            : 'Arbetaren har inte kört någon gång.') + '</span></span></div>';
    }
    host.innerHTML = ruta
      + (N.delfel.length
        ? '<p class="fel" style="margin-top:12px">Delar av notisläget svarade inte: '
          + esc(N.delfel.join(' · ')) + '</p>'
        : '');
  }

  function ritaUtskickLista() {
    const host = $('#utskick-tabell');
    if (!host) return;
    const N = S.notis;
    const antal = $('#utskick-antal');
    /* En lista hämtad med ett annat filter än det som står i rutan
       ritas inte: den är på väg att hämtas om (se hämtaNotisläge). */
    if (!N.hämtad || N.utskickFilter !== N.filter) {
      host.innerHTML = '<div class="loading">Hämtar</div>';
      if (antal) antal.textContent = '';
      return;
    }
    if (N.saknas || N.fel) {
      host.innerHTML = tomt('Ingen kö att visa', N.saknas ? 'Tabellen notis_utskick finns inte än.' : N.fel);
      if (antal) antal.textContent = '';
      return;
    }
    if (antal) {
      antal.textContent = N.utskickTotalt > N.utskick.length
        ? 'visar ' + N.utskick.length + ' av ' + N.utskickTotalt
        : (N.utskickTotalt ? N.utskickTotalt + ' st' : '');
    }

    host.innerHTML = tabell([
      { namn: 'Mottagare', rita: u => {
        const m = mottagare(u.mottagare);
        return '<b>' + esc(m.namn) + '</b>' + (m.roll ? '<span class="adm-und">' + esc(m.roll) + '</span>' : '');
      } },
      { namn: 'Vad', rita: u => {
        const typ = NOTIS_TYP[u.typ] || u.typ;
        if (u.typ === 'meddelande' && u.antal > 1) return esc(u.antal + ' nya meddelanden');
        return esc(typ) + (u.antal > 1 ? '<span class="adm-und">' + esc(u.antal + ' ändringar i samma pass')
          + '</span>' : '');
      } },
      { namn: 'Kanal', rita: u => esc(u.kanal === 'sms' ? 'SMS' : 'Mejl') },
      { namn: 'Läge', rita: u => läge(UTSKICK_LAGE, u.status)
        + (u.till_sandlada ? ' ' + pill('Sandlåda', '') : '')
        + (u.prov === 'true' ? ' ' + pill(PROVROLL[u.prov_roll] ? 'Prov som ' + PROVROLL[u.prov_roll] : 'Prov', '') : '')
        + (u.forsok > 1 ? '<span class="adm-und">' + esc('försök ' + u.forsok) + '</span>' : '') },
      { namn: 'Skapad', rita: u => tidCell(u.skapad) },
      { namn: 'Skicka efter', rita: u => tidCell(u.skicka_efter) },
      { namn: 'Fel', rita: u => u.fel
        ? esc(utanAdresser(u.fel).slice(0, 200))
        : '<span style="color:var(--bl-3)">—</span>' }
    ], N.utskick, N.filter ? 'Inga utskick i det läget' : 'Inga utskick än')
      + (N.utskick.length
        ? '<p class="graf-not">Loggad: skrevs upp men skickades inte, för att flaggan är av och ingen '
          + 'sandlåda är satt, eller för att SMS-läget är prov. Hoppad: databasen stoppade utskicket när '
          + 'det skulle gå, och skälet står under Fel. Sandlåda: mejlet gick till sandlådan i stället för '
          + 'till mottagaren. Prov: ett provmejl till en admin, skrivet som till en familj eller som till '
          + 'en studiehjälpare.</p>'
        : '');
  }

  function ritaKörningar() {
    const host = $('#korningar-tabell');
    if (!host) return;
    const N = S.notis;
    $('#korningar-antal').textContent = N.körningar.length === 1 ? 'den senaste'
      : N.körningar.length ? 'de ' + N.körningar.length + ' senaste' : '';
    if (!N.hämtad) { host.innerHTML = '<div class="loading">Hämtar</div>'; return; }
    if (N.saknas || N.fel) { host.innerHTML = tomt('Inga körningar att visa', ''); return; }
    host.innerHTML = tabell([
      { namn: 'När', rita: k => tidCell(k.tid) },
      { namn: 'Behandlade', höger: true, rita: k => '<span class="adm-tal">' + esc(String(k.behandlade)) + '</span>' },
      { namn: 'Skickade', höger: true, rita: k => '<span class="adm-tal">' + esc(String(k.skickade)) + '</span>' },
      { namn: 'Misslyckade', höger: true, rita: k => k.misslyckade > 0
        ? pill(String(k.misslyckade), 'ar-ny') : '<span class="adm-tal">0</span>' },
      { namn: 'Meddelande', rita: k => k.meddelande
        ? esc(utanAdresser(k.meddelande).slice(0, 200)) : '<span style="color:var(--bl-3)">—</span>' }
    ], N.körningar, 'Arbetaren har inte kört någon gång');
  }

  function ritaSkapfel() {
    const host = $('#nfel-tabell');
    if (!host) return;
    const N = S.notis;
    $('#nfel-antal').textContent = N.skapfelDygn ? N.skapfelDygn + ' senaste dygnet' : '';
    if (!N.hämtad) { host.innerHTML = '<div class="loading">Hämtar</div>'; return; }
    if (N.saknas || N.fel) { host.innerHTML = tomt('Inga fel att visa', ''); return; }
    host.innerHTML = tabell([
      { namn: 'När', rita: f => tidCell(f.skapad) },
      /* kalla är "notis_vid_pass <id>". Id:t kapas som i auditloggen. */
      { namn: 'Var', rita: f => {
        const [var_, id] = String(f.kalla || '').split(' ');
        return '<b>' + esc(var_ || '—') + '</b>'
          + (id ? '<span class="adm-und">' + esc(/^[0-9a-f]{8}-/i.test(id) ? id.slice(0, 8) : id) + '</span>' : '');
      } },
      { namn: 'Felet', rita: f => esc(utanAdresser(f.fel).slice(0, 300)) }
    ], N.skapfel, 'Inga fel sparade');
  }

  function ritaUtskick() {
    ritaArbetaren();
    ritaUtskickLista();
    ritaKörningar();
    ritaSkapfel();
    const N = S.notis;
    märkFlik('#flik-utskick-mark', N.felDygn + N.skapfelDygn);
  }

  function ritaNotisdrift() {
    ritaNotisrutan();
    ritaUtskick();
  }

  /* Hämta om och rita allt som räknar på notisläget, också
     problemrutan på Översikt. */
  async function uppdateraNotiser() {
    await hämtaNotisläge();
    ritaNotisdrift();
    await ritaÖversikt();
  }

  /* Arbetaren går för sig själv: notis_kor_nu() lägger bara ett anrop
     i pg_nets kö. Det som skickas syns alltså först en stund senare,
     och en hämtning till efter några sekunder visar det utan att
     någon behöver trycka. En timer åt gången. */
  let omhämtning = null;
  function hämtaOmSnart() {
    if (omhämtning) clearTimeout(omhämtning);
    omhämtning = setTimeout(() => { omhämtning = null; uppdateraNotiser(); }, 8000);
  }

  function svarsruta(knapp) {
    const box = knapp.closest('.dbox');
    return box ? box.querySelector('[data-notis-svar]') : null;
  }

  function körSvar(d) {
    const nya = Number(d && d.nya_paminnelser) || 0;
    const väntar = Number(d && d.vantar) || 0;
    return 'Klart. '
      + (nya === 1 ? '1 ny påminnelse planerades' : nya + ' nya påminnelser planerades')
      + (väntar
        ? ' och ' + väntar + ' utskick väntar på att skickas. Arbetaren går för sig själv, så det som '
          + 'skickas syns under Utskick en stund senare.'
        : '. Inget väntade på att skickas.');
  }

  /* Kör nu (program 2, Fas 2.3). Fas 7:s regel: ett jobb körs synligt
     för hand innan det körs av sig självt. Knappen finns på två
     ställen, under Inställningar och under Utskick, med samma svar. */
  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-notis-kor]');
    if (!knapp || knapp.getAttribute('aria-busy') === 'true') return;
    const msg = svarsruta(knapp);
    rensa(msg);
    await medan(knapp, 'Kör…', async () => {
      const { data, error, status } = await supa.rpc('notis_kor_nu');
      if (error) { säg(msg, rpcFel('notis_kor_nu', error, status), false); return; }
      säg(msg, körSvar(data), true);
    });
    await uppdateraNotiser();
    hämtaOmSnart();
  });

  /* Provmejlet går till den som trycker, ett av varje sort, oavsett
     flaggan och sandlådan. Det är så avsändaren, DKIM och utseendet
     provas innan någon familj får något.

     ROLLEN VÄLJS (Fas 2.3d). Adminens konto är ett familjekonto, så
     utan val visade provet alltid familjens mejl, och studiehjälparens
     hade ingen sett före det första riktiga. notis_provmejl tar en
     roll i taget, så Båda är ett anrop per roll. Går det första men
     inte det andra står båda sakerna i svaret: det som köades går
     ändå iväg. */
  const provKnapp = $('#notis-provmejl');
  if (provKnapp) provKnapp.addEventListener('click', async () => {
    if (provKnapp.getAttribute('aria-busy') === 'true') return;
    const msg = svarsruta(provKnapp);
    rensa(msg);
    const VAL = [['parent', 'Familj'], ['tutor', 'Studiehjälpare'], ['bada', 'Båda']];
    const roller = await fråga({
      titel: 'Skicka provmejl till dig själv?',
      text: 'Det går riktiga mejl till ' + ((S.user && S.user.email) || 'din egen adress')
        + ', ett av varje sort som kan bli mejl, skrivna så som en familj eller en studiehjälpare får dem. '
        + 'Väljer du båda kommer varje sort två gånger. De går bara till dig, oavsett flaggan '
        + 'notiser_mejl och oavsett sandlådan.',
      innehåll: '<fieldset style="border:0;padding:0;margin:14px 0 0;min-width:0">'
        + '<legend style="padding:0;font-size:.8rem;font-weight:600;margin-bottom:2px">Skrivna som till</legend>'
        + VAL.map(([v, t], i) => '<label class="ag-kryss"><input type="radio" name="prov-roll" value="'
          + esc(v) + '"' + (i === 0 ? ' checked' : '') + '> ' + esc(t) + '</label>').join('')
        + '</fieldset>',
      knapp: 'Skicka provmejl',
      läs: ruta => {
        const v = ruta.querySelector('input[name="prov-roll"]:checked');
        if (!v) return { fel: 'Välj familj, studiehjälpare eller båda.' };
        return { värde: v.value === 'bada' ? Object.keys(PROVROLL) : [v.value] };
      }
    });
    if (!roller) return;

    await medan(provKnapp, 'Köar…', async () => {
      const köade = [];
      let fel = '';
      for (const roll of roller) {
        const köat = await supa.rpc('notis_provmejl', { p_roll: roll });
        if (köat.error) {
          fel = punkt('Provmejlen som ' + PROVROLL[roll] + ' köades inte: '
            + rpcFel('notis_provmejl', köat.error, köat.status));
          break;
        }
        köade.push((Number(köat.data) || 0) + (köade.length ? ' som ' : ' provmejl som ') + PROVROLL[roll]);
      }
      if (!köade.length) { säg(msg, fel, false); return; }

      const vad = uppräkning(köade);
      const kört = await supa.rpc('notis_kor_nu');
      if (kört.error) {
        säg(msg, vad + ' ligger i kön, men arbetaren gick inte att väcka: '
          + punkt(rpcFel('notis_kor_nu', kört.error, kört.status)) + ' Tryck Kör nu.' + (fel ? ' ' + fel : ''), false);
        return;
      }
      säg(msg, vad + ' ligger i kön och arbetaren har väckts. Hur det gick syns under '
        + 'Utskick en stund senare.' + (fel ? ' ' + fel : ''), !fel);
    });
    await uppdateraNotiser();
    hämtaOmSnart();
  });

  const utskickFilter = $('#utskick-filter');
  if (utskickFilter) utskickFilter.addEventListener('change', async () => {
    S.notis.filter = utskickFilter.value;
    /* Filtret skiljer sig nu från listans, så listan ritas som
       Hämtar, utan det gamla antalet. */
    ritaUtskickLista();
    await hämtaNotisläge();
    ritaNotisdrift();
  });

  const utskickHämta = $('#utskick-hamta');
  if (utskickHämta) utskickHämta.addEventListener('click', () =>
    medan(utskickHämta, 'Hämtar…', uppdateraNotiser));

  /* Hämtas om när fliken öppnas: kön ändras av arbetaren, inte av
     den här sidan. Inställningarna likaså, en annan admin kan ha
     ändrat dem. */
  ['#flik-utskick', '#flik-installningar'].forEach(sel => {
    const flik = $(sel);
    if (flik) flik.addEventListener('click', uppdateraNotiser);
  });

  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, {
    /* Utåt heter sökningen ritaAudit: den som ritar vyn vill ha en
       färsk logg, inte en gammal lista i minnet. */
    ritaAdminanvandare, ritaAudit: sökAudit, ritaDokument: hämtaHandlingar,
    ritaFel, ritaFlaggor, ritaInstallningar, ritaIntegrationer, ritaNotisdrift
  });
})();
