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

  const { DP, FAKT_LAGE, S, SH_LAGE, UTB_LAGE, kortDatum, märkFlik, namnFör, pill, rad, skriv,
          tabell } = NXAdmin;
  /* Funktioner som bor i andra områden. Anropen går via
     NXAdmin.rita, som fylls när alla filer laddats. */
  const ritaDetalj = (...a) => NXAdmin.rita.ritaDetalj(...a);
  const träffar = (...a) => NXAdmin.rita.träffar(...a);
  const laddaOmEkonomi = (...a) => NXAdmin.rita.laddaOmEkonomi(...a);

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
        + 'kundfaktura i Fortnox, och utbetalningarna som leverantörsfakturor — så att '
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
      + 'hemlighet — den ligger då hos varenda person som öppnar sidan. '
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

  /* Notiser som inte gick fram. Statuskoden är hela beskedet: 401 är
     fel hemlighet mellan triggern och funktionen, 5xx är funktionen
     själv, och en tom kod med "tog slut" är ett anrop som aldrig kom
     fram. Innehållet i svaret visas inte — det kan bära uppgifter ur
     anmälan som felet gällde. */
  function ritaNotisfel() {
    const rader = S.notisfel || [];
    $('#notis-antal').textContent = rader.length ? rader.length + ' st' : '';
    $('#notis-tabell').innerHTML = tabell([
      { namn: 'När', rita: n => '<span class="adm-tal">' + esc(kortDatum(n.tidpunkt)) + '</span>' },
      { namn: 'Svar', rita: n => n.status_kod
        ? pill(String(n.status_kod), n.status_kod >= 500 ? '' : 'ar-vantar')
        : pill(n.tog_slut ? 'Tidsgräns' : 'Inget svar', '') },
      { namn: 'Felet', rita: n => esc(n.fel || 'Funktionen svarade med en felkod.') }
    ], rader, 'Inga misslyckade utskick det senaste dygnet');
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
    ], rader, 'Inget RUT-tak inlagt — faktureringen drar ingen RUT');

    const pekare = $('#inst-pekare');
    if (pekare) {
      const PEKARE = [
        ['Bolagsfakta', 'Organisationsnummer, moms, F-skatt och hur studiehjälparna anlitas.', '#agenter/bolaget'],
        ['Tjänster och priser', 'Pris, ersättning, RUT-andel och villkor per tjänst.', '#katalog/tjanster'],
        ['Rabattkoder', 'Koder, värden och giltighet.', '#katalog/rabattkoder'],
        ['Integrationer', 'Google och Fortnox.', '#system/integrationer'],
        ['Adminanvändare', 'Vem som ser den här vyn.', '#system/adminanvandare']
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
    studiehjalpare: 'Studiehjälpare', skatteuppgifter: 'Personnummer', rut_tak: 'RUT-tak'
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
    rut_procent: 'RUT-andel', rut_berattigad: 'RUT'
  };

  const MATCH_LAGE = { pending: 'väntar', matched: 'matchad', paused: 'pausad' };
  const STATUS_KARTA = { invoices: FAKT_LAGE, payouts: UTB_LAGE, tutor_profiles: SH_LAGE };

  function auditVärde(nyckel, v, tabellNamn) {
    if (v === null || v === undefined) return '—';
    if (nyckel === 'status' && STATUS_KARTA[tabellNamn] && STATUS_KARTA[tabellNamn][v]) {
      return String(STATUS_KARTA[tabellNamn][v][0]).toLowerCase();
    }
    if (nyckel === 'match_status' && MATCH_LAGE[v]) return MATCH_LAGE[v];
    if (typeof v === 'boolean') return v ? 'ja' : 'nej';
    if (/_ore$/.test(nyckel) && typeof v === 'number') return kronor(v);
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

  function ritaAudit() {
    const host = $('#audit-tabell');
    if (!host) return;
    const filter = ($('#audit-filter') || {}).value || '';
    const rader = (S.audit || []).filter(r => !filter || String(r.handling).split('.')[0] === filter);
    $('#audit-antal').textContent = rader.length ? rader.length + ' st' : '';
    host.innerHTML = tabell([
      { namn: 'När', rita: r => '<span class="adm-tal">' + esc(kortDatum(r.tid)) + '</span>'
        + '<span class="adm-und">' + esc(new Date(r.tid).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })) + '</span>' },
      { namn: 'Vem', rita: r => r.aktor ? esc(namnFör(r.aktor)) : pill('System', 'ar-vantar') },
      { namn: 'Vad', rita: r => {
        const [obj, gjord] = String(r.handling).split('.');
        return '<b>' + esc(AUDIT_OBJEKT[obj] || obj) + '</b> ' + esc(AUDIT_HANDLING[gjord] || gjord || '');
      } },
      { namn: 'Gäller', rita: r => esc(S.personer && S.personer[r.objekt_id]
        ? namnFör(r.objekt_id) : String(r.objekt_id).slice(0, 8)) },
      { namn: 'Ändring', rita: auditÄndring }
    ], rader, filter ? 'Inga händelser av den sorten' : 'Inget loggat än');
  }

  const auditFilter = $('#audit-filter');
  if (auditFilter) auditFilter.addEventListener('change', ritaAudit);

  /* Loggen hämtas om när fliken öppnas: det som hänt sedan sidan
     laddades — av någon annan admin, eller nyss här — ska synas. */
  const auditFlik = $('#flik-audit');
  if (auditFlik) auditFlik.addEventListener('click', async () => {
    const { data, error } = await supa.from('audit_logg').select('*')
      .order('tid', { ascending: false }).limit(300);
    if (!error) { S.audit = data || []; ritaAudit(); }
  });


  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, {
    ritaAdminanvandare, ritaAudit, ritaFel, ritaInstallningar, ritaIntegrationer
  });
})();
