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

  const { DP, FAKT_LAGE, S, SH_LAGE, UTB_LAGE, kontaktaRuta, kortDatum, märkFlik, namnFör, närText,
          pill, rad, skriv, tabell } = NXAdmin;
  /* Funktioner som bor i andra områden. Anropen går via
     NXAdmin.rita, som fylls när alla filer laddats. */
  const ritaDetalj = (...a) => NXAdmin.rita.ritaDetalj(...a);
  const träffar = (...a) => NXAdmin.rita.träffar(...a);
  const laddaOmEkonomi = (...a) => NXAdmin.rita.laddaOmEkonomi(...a);
  const skapaUppgift = (...a) => NXAdmin.rita.skapaUppgift(...a);

  /* ============================================================
     SYSTEM
     ============================================================ */

  /* Integrationskorten. Det viktiga är vad de INTE gör: det finns
     ingen "koppla"-knapp här, för en OAuth-koppling kräver en
     klienthemlighet, och en hemlighet som webbläsaren kan läsa är
     ingen hemlighet. Kopplingen görs på servern; den här sidan
     rapporterar bara vad servern säger.

     Fortnox hade ett kort här till Fas 14.8, som tog bort den aldrig
     gjorda kopplingen (fortnox_token) när bokföringen skulle ligga i
     Wint. Fas 14.9 bytte Wint mot Fortnox, utan koppling. Fortnox får
     ändå inget kort: det finns ingen koppling att rapportera om, och
     ett kort som står på "Inte kopplad" för alltid är brus. */
  const TJANSTER = {
    google_workspace: {
      namn: 'Google Workspace',
      ikon: '<path d="M12 3.5 3.5 8 12 12.5 20.5 8z"/><path d="M3.5 12 12 16.5 20.5 12"/><path d="M3.5 16 12 20.5 20.5 16"/>',
      vad: 'Kalendern och mejlen. Bokade pass läggs som händelser i studiehjälparens '
        + 'och familjens kalender, och underlagen till studiehjälparna går från en riktig '
        + 'adress i stället för en no-reply.',
      krav: 'Krävs: ett Google Cloud-projekt med Calendar API och Gmail API påslagna, '
        + 'ett tjänstekonto med domänvid delegering, och GOOGLE_KLIENT_ID + '
        + 'GOOGLE_KLIENT_HEMLIGHET som secrets på edge-funktionen. Se GOOGLE.md.'
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
      + 'Den kopplas inte härifrån, och det är med flit. Den kräver en '
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
            'Kör schema-v13.sql i Supabase → SQL Editor. Tills dess står den som inte kopplad, '
            + 'vilket råkar vara sant.') + '</div>'
        : '');
  }

  /* ------------------------------------------------------------
     KLIENTFEL

     Förut en rad per fel och en knapp som hette Rensa. Det enda
     man kunde göra med ett fel var alltså att få det att försvinna,
     och samma TypeError från tjugo besök blev tjugo rader att
     klicka bort utan att någon fick veta vad den betydde.

     Nu grupperas felen på meddelande och sida, och varje grupp får
     en förklaring, ett råd och tre sätt att åtgärda den: skriva
     till den som drabbades, göra det till en uppgift, eller
     markera det åtgärdat.

     Förklaringen är en gissning ur meddelandet, inte en diagnos.
     Den står därför som "troligen", och stacken finns alltid ett
     klick bort. Ordningen i listan spelar roll: första träffen
     vinner, och "NXStudie is not defined" är en fil som inte
     laddade, inte ett stavfel i koden.
     ------------------------------------------------------------ */
  const FELSORTER = [
    { sort: 'cache', klass: 'ar-vantar', test: /\bNX\w* is not defined|en modul laddade inte|unexpected token '<'/i,
      rubrik: 'Gammal fil i cachen', åtgärd: 'kontakta',
      text: 'En del av sidan laddades inte, oftast för att webbläsaren höll kvar en äldre fil efter en driftsättning.',
      råd: 'Be personen ladda om med Cmd+Shift+R (Ctrl+Shift+R på Windows). Kommer felet tillbaka efter det är det ett riktigt fel.' },
    { sort: 'nat', klass: '', test: /failed to fetch|networkerror|load failed|network request failed|the network connection was lost/i,
      rubrik: 'Nätverket', åtgärd: 'avfärda',
      text: 'Webbläsaren nådde inte servern. Nästan alltid ett glappande nät, en mobil i tunnelbanan eller en blockerare – inte ett fel i koden.',
      råd: 'Enstaka: markera åtgärdat. Många från olika personer på kort tid: kontrollera att Supabase är uppe.' },
    { sort: 'inlogg', klass: 'ar-vantar', test: /jwt expired|auth session missing|refresh token|not authenticated|invalid claim/i,
      rubrik: 'Inloggningen gick ut', åtgärd: 'kontakta',
      text: 'Sessionen hade löpt ut när sidan försökte hämta något, och personen behöver logga in igen.',
      råd: 'Får samma person det gång på gång loggas hen ut i onödan. Hör av dig och fråga vilken webbläsare det gäller.' },
    { sort: 'nekad', klass: 'ar-ny', test: /permission denied|42501|row-level security/i,
      rubrik: 'Nekad av databasen', åtgärd: 'uppgift',
      text: 'En policy eller en trigger sa nej. Antingen försökte personen något hen inte får, eller så nekar en policy för mycket.',
      råd: 'Gör det till en uppgift. En policy som nekar för mycket ser ut som en tom lista för användaren, så det här är ofta det enda spåret.' },
    { sort: 'extern', klass: '', test: /^script error\.?$|resizeobserver loop/i,
      rubrik: 'Utifrån', åtgärd: 'avfärda',
      text: 'Felet kom från ett skript på en annan domän eller ett tillägg i webbläsaren, och webbläsaren döljer detaljerna.',
      råd: 'Går inte att rätta härifrån. Markera åtgärdat.' },
    { sort: 'kod', klass: 'ar-ny', test: /typeerror|referenceerror|rangeerror|syntaxerror|cannot read propert|is not a function|is not defined|is null|is undefined/i,
      rubrik: 'Fel i koden', åtgärd: 'uppgift',
      text: 'Sidan försökte använda något som inte fanns. Det här går inte över av sig självt – koden behöver rättas.',
      råd: 'Gör det till en uppgift med stacken, och markera det åtgärdat först när rättelsen är driftsatt. Annars kommer det tillbaka och ser nytt ut.' }
  ];
  const OKÄND_SORT = {
    sort: 'okand', klass: 'ar-ny', rubrik: 'Okänt', åtgärd: 'uppgift',
    text: 'Meddelandet känns inte igen.',
    råd: 'Läs stacken. Är du osäker: gör en uppgift hellre än att markera det åtgärdat.'
  };

  function felSort(f) {
    /* e.message saknar felets namn ("Cannot read properties …"),
       men stackens första rad har det ("TypeError: Cannot …"). */
    const text = String(f.meddelande || '') + ' ' + String(f.stack || '').split('\n')[0];
    return FELSORTER.find(s => s.test.test(text)) || OKÄND_SORT;
  }

  /* Sidan utan hash: samma fel på /larare#pass och /larare#elever
     är samma fel. Hashen står kvar i detaljerna. */
  const felVäg = f => String(f.sida || '—').split('#')[0] || '—';

  /* Gruppens nyckel står i knappens data-attribut. Den hashas i
     stället för att bära meddelandet: HTML-parsern byter ut
     NUL-tecken och normaliserar radbrytningar i attribut, så en
     nyckel med meddelandet i klartext kom inte alltid tillbaka lik
     sig själv, och knappen hittade då ingen grupp. */
  function felNyckel(f) {
    const text = String(f.meddelande) + '\n' + felVäg(f);
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    return 'f' + (h >>> 0).toString(36) + text.length.toString(36);
  }

  function felGrupper() {
    const grupper = {};
    S.klientfel.forEach(f => {
      const nyckel = felNyckel(f);
      const g = grupper[nyckel] || (grupper[nyckel] = {
        nyckel, meddelande: f.meddelande, väg: felVäg(f), sort: felSort(f),
        rader: [], personer: [], sidor: [], webbläsare: [], stack: null
      });
      g.rader.push(f);
      if (f.anvandare && g.personer.indexOf(f.anvandare) === -1) g.personer.push(f.anvandare);
      if (f.sida && g.sidor.indexOf(f.sida) === -1) g.sidor.push(f.sida);
      if (f.webblasare && g.webbläsare.indexOf(f.webblasare) === -1) g.webbläsare.push(f.webblasare);
      if (!g.stack && f.stack) g.stack = f.stack;   // listan är nyast först
    });
    return Object.keys(grupper).map(k => grupper[k]).map(g => Object.assign(g, {
      senast: g.rader[0].created_at,
      först: g.rader[g.rader.length - 1].created_at,
      utloggade: g.rader.filter(f => !f.anvandare).length
    }));
  }

  /* Uppgiftens titel byggs ur felet, så att samma fel alltid ger
     samma titel. Det är så knappen vet att en uppgift redan finns. */
  const felTitel = g => ('Fel på ' + g.väg + ': ' + String(g.meddelande)).slice(0, 200);
  const öppenUppgift = g => (S.uppgifter || []).find(u => u.titel === felTitel(g)
    && (u.status === 'oppen' || u.status === 'pagar'));

  function personTyp(id) {
    const p = S.personer[id];
    if (!p) return null;
    return p.role === 'tutor' ? 'studiehjalpare' : p.role === 'parent' ? 'familj' : null;
  }

  /* Alla utloggade räknas som en: det går inte att veta om fem
     utloggade rader är fem personer eller en som laddat om. */
  const antalPersoner = g => g.personer.length + (g.utloggade ? 1 : 0);

  function ritaFelGrupp(g) {
    const s = g.sort;
    const antalPers = antalPersoner(g);
    const uppgift = öppenUppgift(g);
    const knapp = (primär, attr, text) => '<button type="button" class="btn '
      + (primär ? 'btn-primary' : 'btn-ghost') + ' btn-sm" ' + attr + '>' + esc(text) + '</button>';

    const personer = g.personer.map(id => {
      const typ = personTyp(id);
      return typ
        ? '<button type="button" class="fel-person" data-dp="' + typ + ':' + esc(id) + '">'
          + esc(namnFör(id)) + '</button>'
        : '<span class="fel-person">' + esc(namnFör(id)) + '</span>';
    }).join('') + (g.utloggade ? '<span class="fel-person ar-anonym">Utloggad'
      + (g.utloggade > 1 ? ' ×' + g.utloggade : '') + '</span>' : '');

    const kontaktbar = g.personer.filter(id => S.personer[id] && S.personer[id].email);

    return '<article class="fel-grupp" data-sort="' + s.sort + '">'
      + '<div class="fel-huvud">'
      + '<span class="fel-antal" title="Antal gånger">×' + g.rader.length + '</span>'
      + '<div class="fel-titel"><b>' + esc(g.meddelande) + '</b>'
      + '<span class="fel-meta">' + esc(g.väg)
      + ' · senast ' + esc(kortDatum(g.senast))
      + (g.rader.length > 1 ? ' · första ' + esc(kortDatum(g.först)) : '')
      + ' · ' + antalPers + (antalPers === 1 ? ' person' : ' personer') + '</span></div>'
      + pill(s.rubrik, s.klass) + '</div>'
      + '<p class="fel-forklaring">Troligen: ' + esc(s.text) + '</p>'
      + '<p class="fel-rad"><b>Gör så här:</b> ' + esc(s.råd) + '</p>'
      + '<details class="fel-detaljer"><summary>Detaljer</summary>'
      + '<dl>'
      + '<dt>Vem</dt><dd class="fel-personer">' + (personer || '—') + '</dd>'
      + '<dt>Sidor</dt><dd>' + esc(g.sidor.join(', ') || '—') + '</dd>'
      + '<dt>Webbläsare</dt><dd>' + esc(g.webbläsare.join(' · ') || '—') + '</dd>'
      + '</dl>'
      + (g.stack ? '<pre class="fel-stack">' + esc(g.stack) + '</pre>'
        : '<p class="xsmall" style="color:var(--muted-2)">Ingen stack sparades för det här felet.</p>')
      + '</details>'
      + '<div class="fel-knappar">'
      + (s.åtgärd === 'kontakta' && kontaktbar.length
        ? knapp(true, 'data-fel-kontakta="' + esc(g.nyckel) + '"',
          kontaktbar.length === 1 ? 'Skriv till ' + namnFör(kontaktbar[0]).split(' ')[0] : 'Skriv till de drabbade')
        : '')
      + (uppgift
        ? '<span class="fel-finns">' + pill('Uppgift finns', 'ar-vantar') + '</span>'
        : knapp(s.åtgärd === 'uppgift', 'data-fel-uppgift="' + esc(g.nyckel) + '"', 'Gör till uppgift'))
      /* Går den drabbade inte att nå (utloggad) finns inget att skriva,
         och då är det att markera åtgärdat som återstår. */
      + knapp(s.åtgärd === 'avfärda' || (s.åtgärd === 'kontakta' && !kontaktbar.length), 'data-fel-atgardat="' + esc(g.nyckel) + '"',
        g.rader.length > 1 ? 'Markera alla ' + g.rader.length + ' åtgärdade' : 'Markera åtgärdat')
      + '</div></article>';
  }

  function ritaFel() {
    const grupper = felGrupper().sort((a, b) => String(b.senast).localeCompare(String(a.senast)));
    $('#fel-antal').textContent = S.klientfel.length
      ? S.klientfel.length + ' st' + (grupper.length !== S.klientfel.length ? ', ' + grupper.length + ' olika' : '')
      : '';
    märkFlik('#flik-fel-mark', S.klientfel.length + S.notisfel.length);
    $('#fel-tabell').innerHTML = grupper.length
      ? grupper.map(ritaFelGrupp).join('')
        + (S.klientfel.length >= 100
          ? '<p class="xsmall" style="color:var(--muted-2);margin-top:12px">Visar de 100 senaste. '
            + 'Äldre rader kommer fram när de här är åtgärdade.</p>' : '')
      : tomt('Inga fel rapporterade', 'Ingen har sett en trasig sida sedan listan senast tömdes.');

    ritaNotisfel();
  }

  const felGrupp = nyckel => felGrupper().find(g => g.nyckel === nyckel);

  /* Hämtar om i stället för att bara filtrera bort raderna. Bara de
     100 senaste finns i minnet, så ett fel som hänt oftare än så har
     äldre rader kvar i databasen — och de ska synas, inte gömmas. */
  async function hämtaFelIgen() {
    const { data, error } = await supa.from('klientfel').select('*')
      .order('created_at', { ascending: false }).limit(100);
    if (!error) S.klientfel = data || [];
    ritaFel();
  }

  document.addEventListener('click', async e => {
    const åtgärdat = e.target.closest('[data-fel-atgardat]');
    const uppgift = e.target.closest('[data-fel-uppgift]');
    const kontakta = e.target.closest('[data-fel-kontakta]');
    if (!åtgärdat && !uppgift && !kontakta) return;
    const knappen = åtgärdat || uppgift || kontakta;
    const g = felGrupp(knappen.dataset.felAtgardat || knappen.dataset.felUppgift || knappen.dataset.felKontakta);
    if (!g) { ritaFel(); return; }

    if (kontakta) {
      const till = g.personer.map(id => S.personer[id]).filter(p => p && p.email);
      kontaktaRuta({
        namn: till.length === 1 ? till[0].full_name || till[0].email : 'de drabbade',
        till: till.map(p => p.email).join(', '),
        amne: 'Sidan hos Nextrum',
        text: 'Hej' + (till.length === 1 && till[0].full_name ? ' ' + till[0].full_name.split(' ')[0] : '') + '!\n\n'
          + 'Vi såg att ' + (g.väg === '/larare' ? 'studiehjälparvyn' : g.väg === '/foralder' ? 'föräldravyn' : 'sidan')
          + ' inte laddade som den skulle för dig '
          + datumText(String(g.senast).slice(0, 10)) + '. '
          + (g.sort.sort === 'inlogg'
            ? 'Det verkar som att inloggningen hade gått ut. Logga in igen så ska det fungera. '
              + 'Händer det ofta får du gärna svara på det här mejlet och berätta vilken webbläsare du använder.'
            : 'Ladda om sidan med Cmd+Shift+R (Ctrl+Shift+R på Windows) så hämtas den på nytt. '
              + 'Fungerar det fortfarande inte får du gärna svara på det här mejlet.')
          + '\n\nVänliga hälsningar\nNextrum'
      });
      return;
    }

    if (uppgift) {
      const stack = g.stack ? '\n\nStack:\n' + g.stack : '';
      const text = (g.sort.rubrik + ' (gissning ur meddelandet).\n'
        + g.rader.length + (g.rader.length === 1 ? ' gång, ' : ' gånger, ')
        + antalPersoner(g) + (antalPersoner(g) === 1 ? ' person. ' : ' personer. ')
        + 'Första ' + kortDatum(g.först) + ', senast ' + kortDatum(g.senast) + '.\n'
        + 'Sidor: ' + (g.sidor.join(', ') || '—') + '\n'
        + 'Webbläsare: ' + (g.webbläsare.join(' · ') || '—') + stack).slice(0, 2000);
      await medan(uppgift, 'Skapar…', async () => {
        const rad = await skapaUppgift({
          titel: felTitel(g), typ: 'problem', beskrivning: text
        });
        if (rad) ritaFel();
      });
      return;
    }

    const ja = await bekräfta({
      titel: g.rader.length > 1 ? 'Markera alla ' + g.rader.length + ' som åtgärdade?' : 'Markera som åtgärdat?',
      text: 'Raderna tas bort ur listan. Att de togs bort, och av vem, står kvar i auditloggen. '
        + 'Kommer felet tillbaka dyker det upp här igen som nytt.',
      knapp: 'Markera åtgärdat'
    });
    if (!ja) return;
    await medan(åtgärdat, 'Tar bort…', async () => {
      /* Läs svaret. Nekar policyn blir det inget fel, bara noll
         rader — och då ska listan inte låtsas att felet är borta. */
      const { data, error } = await supa.from('klientfel').delete()
        .in('id', g.rader.map(f => f.id)).select('id');
      if (error) { alert('Kunde inte ta bort: ' + felText(error)); return; }
      if (!data || !data.length) { alert('Databasen tog inte bort något. Är du inloggad som admin?'); return; }
      await hämtaFelIgen();
    });
  });

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
        ['Integrationer', 'Google Workspace. Bokföringen sköts i Fortnox, utan koppling hit.', '#system/integrationer'],
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
    studiehjalpare: 'Studiehjälpare', skatteuppgifter: 'Personnummer', rut_tak: 'RUT-tak',
    anmalan: 'Intresseanmälan', ansokan: 'Ansökan', uppdrag: 'Uppdrag', uppgift: 'Uppgift',
    /* Fas 8 och 9.3. Passet loggas numera hela vägen, inte bara när
       det undantas från fakturering. */
    ai_forslag: 'AI-förslag', ai_konfig: 'AI-taket', kontaktmeddelande: 'Kontaktmeddelande',
    klientfel: 'Klientfel', bolagsfakta: 'Bolagsfakta'
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
    studiehjalpare_form: 'studiehjälparnas form', bokforingssystem: 'bokföringssystem'
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
     NOTISER (Fas 13.4)

     Reglaget som saknades. Runda 2 byggde hela vägen — triggrar,
     kö, pg_cron, arbetare, mallar, avanmälan — men strömbrytaren
     låg bara i tabellen flaggor, och INGEN fil i repot nämnde den
     tabellen. Utskicken stod därför av utan att det gick att se
     någonstans i produkten: notiserna dök upp i vyn, raderna hamnade
     i kön, och notis_utskick_ta märkte varje mejlrad som "loggad"
     och gick vidare. Ett avstängt system och ett trasigt system ser
     likadana ut inifrån.

     Skrivningarna fanns redan i databasen: flaggor och notis_drift
     har adminpolicy och kolumnrättigheter sedan Runda 2, och
     notis_provmejl och notis_kor_nu är nåbara för authenticated och
     kollar is_admin() själva. Det som lades till i Fas 13.4 är
     notis_lage() — läsningen — och det här, som anropar dem.

     Räkningen sker i databasen. Att hämta kön och räkna här hade
     fungerat medan kön var tom och slutat fungera tyst när den
     växte, precis som auditfliken gjorde före Fas 9.8.
     ============================================================ */

  /* Flaggorna som hör hemma här. Tabellen bär också
     utbetalningsmetod, som är en annan fråga och hör till en annan
     flik den dagen den byggs — en sida som listar ALLA flaggor
     inbjuder till att slå om en man inte förstår. */
  const NOTISFLAGGOR = {
    notiser_mejl: 'Mejl till familjer och studiehjälpare',
    notiser_sms: 'SMS-påminnelser'
  };

  const KO_LAGE = {
    vantar: ['Väntar', 'ar-vantar'],
    skickar: ['Skickas nu', 'ar-vantar'],
    skickad: ['Skickad', 'ar-klar'],
    loggad: ['Bara loggad', ''],
    hoppad: ['Överhoppad', ''],
    fel: ['Fel', 'ar-ny']
  };

  /* Hämtat på begäran, inte i hämtaAllt: köns läge är färskvara och
     en siffra från inloggningen hade ljugit resten av passet. */
  let ND = { flaggor: [], drift: null, lage: null, fel: null };

  async function hämtaNotisdrift() {
    if (!$('#panel-notiser')) return;
    const [flg, drift, lage] = await Promise.all([
      supa.from('flaggor').select('*').order('kod'),
      supa.from('notis_drift').select('*').eq('id', 1).maybeSingle(),
      supa.rpc('notis_lage')
    ]);
    /* Ett fel här ska synas som ett fel, inte som ett tomt system.
       "Inga körningar" och "frågan gick inte fram" är två helt olika
       besked, och det var precis den förväxlingen som gjorde att
       avstängningen kunde stå oupptäckt. */
    ND = {
      flaggor: flg.data || [],
      drift: drift.data || null,
      lage: lage.data || null,
      fel: (flg.error || drift.error || lage.error) || null
    };
    ritaNotisdrift();
  }

  function mejlPå() {
    const f = (ND.flaggor || []).find(x => x.kod === 'notiser_mejl');
    return !!(f && f.aktiv);
  }

  function ritaHälsa() {
    const host = $('#nd-halsa');
    if (!host) return;
    if (ND.fel) {
      host.innerHTML = tomt('Läget gick inte att hämta', felText(ND.fel));
      return;
    }
    const l = ND.lage || {};
    const k = l.klocka || null;
    const sandlåda = ND.drift && ND.drift.mejl_sandlada;

    const rader = [
      ['Mejlutskick',
        mejlPå() ? pill('På', 'ar-klar') : pill('Av', 'ar-ny'),
        mejlPå() ? 'Notismejlen går till mottagarna.'
          : 'Notiserna syns i vyn, men inget mejl lämnar systemet. Raderna märks "bara loggad".'],
      ['Sandlåda',
        sandlåda ? pill('På', 'ar-vantar') : pill('Av', ''),
        sandlåda ? 'Allt går till ' + sandlåda + ' i stället för till mottagaren.'
          : 'Mejlen går dit de ska.'],
      ['Schemat',
        k ? (k.aktiv ? pill('Går', 'ar-klar') : pill('Stoppat', 'ar-ny')) : pill('Okänt', ''),
        /* närText och inte kortDatum: jobbet går varje minut, och
           "23 september" svarar inte på frågan man faktiskt ställer,
           som är om klockan gick de senaste minuterna. */
        k ? 'Väcker arbetaren ' + (k.schema === '* * * * *' ? 'varje minut' : k.schema)
            + (k.senast ? '. Senast ' + närText(k.senast) : '')
          : 'pg_cron svarade inte. Utan schemat skickas ingenting av sig självt.'],
      ['Väntar just nu',
        pill(String(l.vantar_nu == null ? '—' : l.vantar_nu), l.vantar_nu ? 'ar-vantar' : ''),
        'Rader som är mogna att skickas nästa gång arbetaren väcks.'],
      ['Senast skickade mejl',
        pill(l.senast_skickat ? närText(l.senast_skickat) : 'Aldrig',
          l.senast_skickat ? 'ar-klar' : ''),
        l.senast_skickat ? '' : 'Inget notismejl har någonsin lämnat systemet.']
    ];

    host.innerHTML = rader.map(([namn, märke, text]) =>
      '<div class="dp-rad"><div><b>' + esc(namn) + '</b>'
      + (text ? '<span class="adm-und">' + esc(text) + '</span>' : '')
      + '</div><span class="dp-rad-hoger">' + märke + '</span></div>').join('');
  }

  function ritaFlaggor() {
    const host = $('#nd-flaggor');
    if (!host) return;
    const rader = (ND.flaggor || []).filter(f => NOTISFLAGGOR[f.kod]);
    if (!rader.length) {
      host.innerHTML = tomt('Inga flaggor hittades',
        'Tabellen flaggor är tom eller saknas. Kör migrationen r2_fas1_1_flaggor.');
      return;
    }
    host.innerHTML = rader.map(f =>
      '<div class="adm-koppling-kort" style="margin-bottom:14px">'
      + '<h6>' + esc(NOTISFLAGGOR[f.kod])
      + (f.aktiv ? pill('På', 'ar-klar') : pill('Av', '')) + '</h6>'
      + '<p>' + esc(f.beskrivning || '') + '</p>'
      + (f.vantar_pa
        ? '<div class="adm-krav">Ska vara avgjort först: ' + esc(f.vantar_pa) + '</div>' : '')
      + '<p class="xsmall" style="color:var(--bl-3);margin-top:10px">Ändrad '
      + esc(kortDatum(f.uppdaterad)) + '</p>'
      + '<div style="margin-top:12px"><button class="btn '
      + (f.aktiv ? 'btn-ghost' : 'btn-primary') + ' btn-sm" type="button" data-nd-flagga="'
      + esc(f.kod) + '" data-nd-varde="' + (f.aktiv ? '0' : '1') + '">'
      + (f.aktiv ? 'Stäng av' : 'Slå på') + '</button></div>'
      + '</div>').join('');
  }

  function ritaKo() {
    const koHost = $('#nd-ko');
    const körHost = $('#nd-korningar');
    if (!koHost || !körHost) return;
    const l = ND.lage || {};
    const ko = l.ko || [];
    const totalt = ko.reduce((s, r) => s + (r.antal || 0), 0);
    const trasiga = ko.filter(r => r.status === 'fel').reduce((s, r) => s + (r.antal || 0), 0);

    $('#nd-ko-antal').textContent = totalt ? totalt + ' rader' : '';
    märkFlik('#flik-notiser-mark', trasiga);

    koHost.innerHTML = tabell([
      { namn: 'Läge', rita: r => {
        const l2 = KO_LAGE[r.status] || [r.status, ''];
        return pill(l2[0], l2[1]);
      } },
      { namn: 'Kanal', rita: r => esc(r.kanal === 'sms' ? 'SMS' : 'Mejl') },
      { namn: 'Antal', höger: true, rita: r => '<span class="adm-tal">' + esc(String(r.antal)) + '</span>' }
    ], ko, 'Kön är tom — ingenting har köats än');

    körHost.innerHTML = tabell([
      { namn: 'När', rita: r => '<span class="adm-tal">' + esc(närText(r.tid)) + '</span>' },
      { namn: 'Tog', höger: true, rita: r => '<span class="adm-tal">' + esc(String(r.behandlade)) + '</span>' },
      { namn: 'Skickade', höger: true, rita: r => '<span class="adm-tal">' + esc(String(r.skickade)) + '</span>' },
      { namn: 'Misslyckade', höger: true, rita: r => r.misslyckade
        ? pill(String(r.misslyckade), 'ar-ny')
        : '<span class="adm-tal">0</span>' },
      /* Meddelandet är det första stället att läsa när något står
         stilla: det säger om körningen avbröts på ett kontofel hos
         Resend eller om nyckeln saknas. */
      { namn: 'Meddelande', rita: r => esc(r.meddelande || '—') }
    ], l.korningar || [], 'Arbetaren har inte kört än');
  }

  function ritaNotisdrift() {
    const fält = $('#nd-sandlada');
    /* Skriv inte över det någon håller på att skriva. */
    if (fält && document.activeElement !== fält) {
      fält.value = (ND.drift && ND.drift.mejl_sandlada) || '';
    }
    ritaHälsa();
    ritaFlaggor();
    ritaKo();
  }

  const ndForm = $('#nd-sandlada-form');
  if (ndForm) ndForm.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#nd-sandlada-msg');
    rensa(msg);
    const adress = $('#nd-sandlada').value.trim();
    if (!adress) { säg(msg, 'Skriv en adress, eller använd knappen bredvid för att stänga av.', false); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adress)) { säg(msg, 'Det där ser inte ut som en e-postadress.', false); return; }
    await medan(ndForm.querySelector('button[type="submit"]'), 'Sparar…', async () => {
      const { error } = await supa.from('notis_drift').update({ mejl_sandlada: adress }).eq('id', 1);
      if (error) { säg($('#nd-sandlada-msg'), 'Kunde inte spara: ' + felText(error), false); return; }
      await hämtaNotisdrift();
      säg($('#nd-sandlada-msg'), '✓ Allt går nu till ' + adress + ' i stället för till mottagarna.', true);
    });
  });

  const ndBort = $('#nd-sandlada-bort');
  if (ndBort) ndBort.addEventListener('click', async () => {
    const msg = $('#nd-sandlada-msg');
    rensa(msg);
    if (!(ND.drift && ND.drift.mejl_sandlada)) { säg(msg, 'Sandlådan är redan av.', true); return; }
    const ja = await bekräfta({
      titel: 'Stänga av sandlådan?',
      text: mejlPå()
        ? 'Nästa notismejl går till den riktiga mottagaren. Mejlutskicken är påslagna.'
        : 'Mejlutskicken är ändå avstängda, så inget går ut till mottagarna heller efteråt.',
      knapp: 'Stäng av'
    });
    if (!ja) return;
    await medan(ndBort, 'Stänger av…', async () => {
      const { error } = await supa.from('notis_drift').update({ mejl_sandlada: null }).eq('id', 1);
      if (error) { säg($('#nd-sandlada-msg'), 'Kunde inte spara: ' + felText(error), false); return; }
      await hämtaNotisdrift();
      säg($('#nd-sandlada-msg'), '✓ Sandlådan är av.', true);
    });
  });

  async function slåOmFlagga(kod, värde) {
    const f = (ND.flaggor || []).find(x => x.kod === kod);
    if (!f) return;
    const namn = NOTISFLAGGOR[kod] || kod;
    const ja = await bekräfta(värde ? {
      titel: 'Slå på: ' + namn + '?',
      text: (ND.drift && ND.drift.mejl_sandlada)
        ? 'Sandlådan är satt, så allt går ändå till ' + ND.drift.mejl_sandlada
          + ' tills du stänger av den.'
        : 'Från och med nu går utskicken till riktiga familjer och studiehjälpare.',
      /* vantar_pa står som förhandsvisning och inte i brödtexten:
         det är ofta tre meningar, och en <p> hade klämt ihop dem
         till en enda vägg man klickar förbi. */
      forhandsvisning: f.vantar_pa ? 'Det här skulle vara avgjort först:\n\n' + f.vantar_pa : null,
      knapp: 'Slå på'
    } : {
      titel: 'Stänga av: ' + namn + '?',
      text: 'Notiserna fortsätter synas i vyerna, men inget utskick går ut. '
        + 'Raderna som köas under tiden märks "bara loggad" och går inte att skicka i efterhand.',
      knapp: 'Stäng av'
    });
    if (!ja) return;
    const { error } = await supa.from('flaggor').update({ aktiv: värde }).eq('kod', kod);
    if (error) { alert('Kunde inte ändra flaggan: ' + felText(error)); return; }
    await hämtaNotisdrift();
  }

  document.addEventListener('click', async e => {
    const flagga = e.target.closest('[data-nd-flagga]');
    if (flagga) {
      await slåOmFlagga(flagga.dataset.ndFlagga, flagga.dataset.ndVarde === '1');
      return;
    }

    const prov = e.target.closest('[data-nd-prov]');
    if (prov) {
      const roll = prov.dataset.ndProv;
      const msg = $('#nd-prov-msg');
      rensa(msg);
      await medan(prov, 'Köar…', async () => {
        const { data, error } = await supa.rpc('notis_provmejl', { p_roll: roll });
        if (error) { säg($('#nd-prov-msg'), 'Gick inte: ' + felText(error), false); return; }
        /* Köade, inte skickade. Arbetaren väcks av schemat inom en
           minut — eller nu, med knappen bredvid. Att säga "skickat"
           här hade varit ett löfte den här knappen inte kan hålla. */
        const { error: körFel } = await supa.rpc('notis_kor_nu');
        await hämtaNotisdrift();
        säg($('#nd-prov-msg'), körFel
          ? '✓ ' + data + ' provmejl är köade. De går ut nästa minut.'
          : '✓ ' + data + ' provmejl är köade och arbetaren är väckt. Kolla inkorgen om en stund.', true);
      });
      return;
    }

    const kör = e.target.closest('#nd-kor');
    if (kör) {
      const msg = $('#nd-prov-msg');
      rensa(msg);
      await medan(kör, 'Kör…', async () => {
        const { data, error } = await supa.rpc('notis_kor_nu');
        if (error) { säg($('#nd-prov-msg'), 'Gick inte: ' + felText(error), false); return; }
        await hämtaNotisdrift();
        const väntar = data && data.vantar;
        säg($('#nd-prov-msg'), väntar
          ? '✓ Arbetaren är väckt. ' + väntar + ' rader låg och väntade.'
          : '✓ Arbetaren är väckt. Ingenting låg och väntade.', true);
      });
      return;
    }

    if (e.target.closest('#nd-uppdatera')) {
      await medan(e.target.closest('#nd-uppdatera'), 'Hämtar…', hämtaNotisdrift);
    }
  });

  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, {
    /* Utåt heter sökningen ritaAudit: den som ritar vyn vill ha en
       färsk logg, inte en gammal lista i minnet. */
    ritaAdminanvandare, ritaAudit: sökAudit, ritaDokument: hämtaHandlingar,
    ritaFel, ritaInstallningar, ritaIntegrationer,
    /* Heter inte ritaNotiser: det namnet är taget av klockan i
       topplisten (nextrum-admin.js), och två olika saker på samma
       nyckel i NXAdmin.rita hade tyst skrivit över varandra. */
    ritaNotisdrift: hämtaNotisdrift
  });
})();
