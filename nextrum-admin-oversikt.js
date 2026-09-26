/* ============================================================
   NEXTRUM — adminvyn, Översikt och Statistik

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

  const { DAG, S, dagarSedan, elevNamn, kortDatum, märkFlik, namnFör,
          närText, tabell } = NXAdmin;
  /* Funktioner som bor i andra områden. Anropen går via
     NXAdmin.rita, som fylls när alla filer laddats. */
  const ritaNotiser = (...a) => NXAdmin.rita.ritaNotiser(...a);
  const steg = (...a) => NXAdmin.rita.steg(...a);
  const utanRapport = (...a) => NXAdmin.rita.utanRapport(...a);

  /* En elev räknas som aktiv om hen haft ett pass de senaste 30
     dagarna eller har ett inbokat framåt. Definitionen är vår egen
     — det finns ingen "aktiv"-kolumn — och därför står den också i
     hjälptexten under talet, så att ingen tolkar siffran som något
     annat än vad den är. */
  function aktivaElever(från, till) {
    const set = {};
    S.bokningar.forEach(b => {
      if (!b.student_id || b.status === 'cancelled') return;
      if (b.wanted_date >= från && b.wanted_date <= till) set[b.student_id] = 1;
    });
    return Object.keys(set).length;
  }

  function pil(upp) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">'
      + (upp ? '<path d="M12 19V5M6 11l6-6 6 6"/>' : '<path d="M12 5v14M6 13l6 6 6-6"/>')
      + '</svg>';
  }

  /* Talet, etiketten, och en förändring bara när den är sann.
     jämför === null betyder "ingen föregående period", och då
     ritas raden inte alls. */
  function kpi(tal, etikett, jämför, extra) {
    let diff = '';
    if (jämför !== null && jämför !== undefined) {
      const upp = jämför >= 0;
      diff = '<span class="adm-kpi-diff ' + (upp ? 'ar-upp' : 'ar-ner') + '">'
        + pil(upp) + esc((upp ? '+' : '') + jämför + ' sedan förra månaden') + '</span>';
    } else if (extra) {
      diff = '<span class="adm-kpi-diff">' + esc(extra) + '</span>';
    }
    return '<div class="adm-kpi"><b>' + esc(String(tal)) + '</b>'
      + '<span>' + esc(etikett) + '</span>' + diff + '</div>';
  }

  function ritaTal() {
    const idag = isoFor(new Date());
    const fram = isoFor(new Date(Date.now() + 365 * DAG));

    /* Senaste 30 dagarna plus allt framåt, mot de 30 dagarna
       dessförinnan. Båda räknas ur bokningarna, alltså ur samma
       källa — jämförelsen blir då äpplen mot äpplen. */
    const nu = aktivaElever(dagarSedan(30), fram);
    const förr = aktivaElever(dagarSedan(60), dagarSedan(31));

    const godkända = Object.values(S.tutorProfiler).filter(t => t.status === 'approved');
    const nyaShDennaMånad = godkända.filter(t =>
      String(t.created_at || '').slice(0, 7) === idag.slice(0, 7)).length;

    const kommande = S.bokningar.filter(b =>
      b.wanted_date >= idag && (b.status === 'requested' || b.status === 'confirmed')).length;

    /* Intäkten är det som kommit in på kort under månaden, efter
       återbetalningar, räknat på betalningsdagen (Fas 14.2). Förut var
       den summan av månadens fakturor — och familjen får ingen faktura
       längre, så talet hade stått på noll medan pengarna kom in. Äldre
       fakturor räknas med på sin period, så att en månad från före
       omställningen inte tappar sin intäkt.

       Betalningsdagen och inte passets dag: ett pass betalas innan det
       hålls, och det som kom in i september kom in i september. */
    const period = idag.slice(0, 7);
    const förraPeriod = (() => {
      const d = new Date(); d.setMonth(d.getMonth() - 1);
      return isoFor(d).slice(0, 7);
    })();
    const kortIn = mån => S.bokningar
      .filter(b => b.betald_at && isoFor(new Date(b.betald_at)).slice(0, 7) === mån)
      .reduce((n, b) => n + Number(b.betalt_ore || 0) - Number(b.aterbetald_ore || 0), 0);
    const fakturerat = mån => S.fakturor
      .filter(f => String(f.period || '').slice(0, 7) === mån && f.status !== 'makulerad')
      .reduce((n, f) => n + (f.belopp_ore || 0), 0);
    const belopp = kortIn(period) + fakturerat(period);
    const förraBelopp = kortIn(förraPeriod) + fakturerat(förraPeriod);

    /* Intäkten får INGEN procentjämförelse. Månaden är inte slut,
       och en halv månad mot en hel månad är alltid en nedgång —
       ett tal som säger "det går sämre" var enda gång det visas
       säger ingenting alls. Förra månadens summa står som kontext
       i stället, och den är entydig. */
    $('#adm-tal').innerHTML =
      kpi(nu, 'Aktiva elever', förr ? nu - förr : null,
        förr ? null : 'pass senaste 30 dagarna')
      + kpi(godkända.length, 'Aktiva studiehjälpare', null,
        nyaShDennaMånad ? '+' + nyaShDennaMånad + ' denna månad' : 'godkända konton')
      + kpi(kommande, 'Kommande lektioner', null, 'bekräftade och önskade')
      + kpi(kronor(belopp), 'Intäkt denna månad', null,
        förraBelopp ? 'förra månaden ' + kronor(förraBelopp)
          : (belopp ? 'betalt hittills' : 'inget betalt än'));
  }

  /* ------------------------------------------------------------
     ARBETSKÖN
     Varje post är en sak som ligger och väntar på en människa, och
     varje post är vägen dit. Listan byggs ur admin_lage där den
     finns och ur lokal data där den inte täcker — elever utan
     studiehjälpare räknas här, för vyn känner bara till familjer.
     ------------------------------------------------------------ */
  function byggAttGöra() {
    const l = S.lage || {};
    const idag = isoFor(new Date());

    /* Elevens egen matchning sedan schema-v14, inte familjens.
       En familj kan vara "matchad" och ändå ha ett barn utan
       studiehjälpare — det är precis det fallet den här raden
       finns för att hitta. */
    const utanHjälpare = S.elevlista.filter(e =>
      !e.matched_tutor_id || e.match_status !== 'matched').length;

    const obetalda = S.fakturor.filter(f =>
      f.status === 'skickad' || f.status === 'forfallen').length;
    /* Fas 14.6. Ett fakturautkast är ingen faktura förrän någon lagt in
       det i Fortnox. Ingen annan än vi kan göra det. */
    const attLäggaIn = S.fakturor.filter(f => f.status === 'utkast').length;
    const attBetalaUt = S.utbetalningar.filter(u =>
      u.status === 'utkast' || u.status === 'godkand').length;
    const obekräftade = S.bokningar.filter(b =>
      b.status === 'requested' && b.wanted_date >= idag).length;

    return [
      { antal: l.nya_leads != null ? l.nya_leads : S.leads.filter(x => x.status === 'new').length,
        rubrik: 'nya intresseanmälningar', ental: 'ny intresseanmälan',
        under: 'Familjer som hört av sig och väntar på svar.', till: '#leads' },
      { antal: l.nya_ansokningar != null ? l.nya_ansokningar : S.ansokningar.filter(x => x.status === 'new').length,
        rubrik: 'nya ansökningar', ental: 'ny ansökan',
        under: 'Unga som vill bli studiehjälpare.', till: '#ansokningar' },
      { antal: Object.values(S.tutorProfiler).filter(t => t.status === 'pending').length,
        rubrik: 'studiehjälpare att godkänna', ental: 'studiehjälpare att godkänna',
        under: 'Kontot fungerar men vyn är låst tills någon godkänner.', till: '#studiehjalpare' },
      { antal: utanHjälpare,
        rubrik: 'elever saknar studiehjälpare', ental: 'elev saknar studiehjälpare',
        under: 'Ingen är kopplad till dem än.', till: '#matchning' },
      { antal: obekräftade,
        rubrik: 'passförfrågningar väntar', ental: 'passförfrågan väntar',
        under: 'Bokade men inte bekräftade av studiehjälparen.', till: '#bokningar' },
      { antal: l.ohanterade_meddelanden != null ? l.ohanterade_meddelanden
          : S.kontakt.filter(k => !k.hanterad_at).length,
        rubrik: 'frågor i inkorgen', ental: 'fråga i inkorgen',
        under: 'Från kontaktformuläret, ingen har svarat än.', till: '#meddelanden' },
      { antal: S.bokningar.filter(b =>
          b.status !== 'cancelled' && b.status !== 'completed'
          && String(b.wanted_date) < idag).length,
        rubrik: 'pass saknar rapport', ental: 'pass saknar rapport',
        under: 'Hållna men orapporterade. De kommer inte med på underlaget.', till: '#lektioner' },
      { antal: utanRapport().length,
        rubrik: 'genomförda pass saknar rapport', ental: 'genomfört pass saknar rapport',
        under: 'Pass saknar rapport och kan därför inte behandlas automatiskt.', till: '#ekonomi/avvikelser' },
      { antal: attLäggaIn,
        rubrik: 'fakturor att lägga in i Fortnox', ental: 'faktura att lägga in i Fortnox',
        under: 'Månadskörningen har skapat dem. Familjen har inte fått dem än.', till: '#ekonomi/fakturor' },
      { antal: obetalda,
        rubrik: 'obetalda fakturor', ental: 'obetald faktura',
        under: 'Skickade från Fortnox men inte betalda.', till: '#ekonomi/fakturor' },
      { antal: attBetalaUt,
        rubrik: 'utbetalningar att göra', ental: 'utbetalning att göra',
        under: 'Studiehjälpare som väntar på sin ersättning.', till: '#ekonomi/utbetalningar' }
    ].filter(p => p.antal > 0);
  }

  function ritaAttGöra() {
    S.attGora = byggAttGöra();
    const host = $('#adm-att-gora');
    const summa = S.attGora.reduce((n, p) => n + p.antal, 0);
    $('#adm-att-antal').textContent = summa ? summa + ' st' : '';

    if (!S.attGora.length) {
      host.innerHTML = '<div class="adm-lugnt">'
        + '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/></svg>'
        + '<span><b>Ingenting väntar just nu</b>'
        + '<span>Inkorgen är tom, alla konton är avgjorda och alla pass är bekräftade.</span></span>'
        + '</div>';
      return;
    }

    host.innerHTML = '<div class="adm-att-gora">' + S.attGora.map(p =>
      '<a href="' + esc(p.till) + '">'
      + '<span class="adm-att-antal">' + p.antal + '</span>'
      + '<span class="adm-att-text"><b>' + esc(p.antal === 1 ? p.ental : p.rubrik) + '</b>'
      + '<span>' + esc(p.under) + '</span></span>'
      + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M12 5l7 7-7 7"/></svg>'
      + '</a>').join('') + '</div>';
  }

  /* ============================================================
     PROBLEM (Fas 6)

     Det som gått fel eller fastnat — det som INTE redan står i
     "Kräver din uppmärksamhet" ovanför, så att ingenting räknas två
     gånger. Räknat i databasen (admin_lage, ekonomiska_avvikelser)
     där det går, annars ur det vyn redan har.
     ============================================================ */
  function övrigaAvvikelser() {
    return (S.avvikelser || []).filter(a => a.typ !== 'pass_utan_rapport' && a.typ !== 'fristaende_rapport');
  }
  /* Till problemrutan: utan det som redan har en egen rad (förfallna
     fakturor) eller står i arbetskön (väntande utbetalningar). */
  const EGEN_RAD = ['faktura_forfallen', 'utbetalning_vantar'];

  function byggProblem() {
    const l = S.lage || {};
    const idag = isoFor(new Date());
    const öppna = (S.uppgifter || []).filter(u => u.status === 'oppen' || u.status === 'pagar');
    const sena = öppna.filter(u => u.forfallodag && u.forfallodag < idag);
    const förfallna = l.forfallna_fakturor != null ? l.forfallna_fakturor
      : (S.fakturor || []).filter(f => (f.status === 'skickad' || f.status === 'forfallen')
          && !f.betald_at && f.forfaller && f.forfaller < idag).length;
    return [
      { antal: förfallna, rubrik: 'förfallna fakturor', ental: 'förfallen faktura',
        under: 'Skickade, obetalda och efter förfallodagen.', till: '#ekonomi/fakturor' },
      { antal: l.forsenade_uppgifter != null ? l.forsenade_uppgifter : sena.length,
        rubrik: 'försenade uppgifter', ental: 'försenad uppgift',
        under: 'Öppna efter dagen de skulle vara klara.', till: '#uppgifter' },
      { antal: övrigaAvvikelser().filter(a => EGEN_RAD.indexOf(a.typ) === -1).length,
        rubrik: 'ekonomiska avvikelser', ental: 'ekonomisk avvikelse',
        under: 'Pass som hölls utan betalning, eller något i utbetalningarna som inte går ihop.', till: '#ekonomi/avvikelser' },
      { antal: l.klientfel_24h != null ? l.klientfel_24h : 0, rubrik: 'fel hos användarna', ental: 'fel hos en användare',
        under: 'Rapporterade från webbläsarna det senaste dygnet.', till: '#system/fel' },
      { antal: (S.notisfel || []).length, rubrik: 'notiser som inte gick fram', ental: 'notis som inte gick fram',
        under: 'Mejl som skulle ha skickats det senaste dygnet.', till: '#system/fel' },
      { antal: öppna.length - (l.forsenade_uppgifter != null ? l.forsenade_uppgifter : sena.length),
        rubrik: 'öppna uppgifter', ental: 'öppen uppgift',
        under: 'Inte klara, men inte heller sena.', till: '#uppgifter' }
    ].filter(p => p.antal > 0);
  }

  function ritaProblem() {
    const host = $('#adm-problem');
    if (!host) return;
    /* Sparas på S av samma skäl som S.attGora: driftkonsolen visar
       samma poster och ska räkna dem EN gång, inte bygga en tredje
       lista som kan säga något annat. */
    const problem = S.problem = byggProblem();
    const summa = problem.reduce((n, p) => n + p.antal, 0);
    $('#adm-problem-antal').textContent = summa ? summa + ' st' : '';
    if (!problem.length) {
      host.innerHTML = '<div class="adm-lugnt">'
        + '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/></svg>'
        + '<span><b>Inga problem just nu</b>'
        + '<span>Inga obetalda pass, inga sena uppgifter och inga fel det senaste dygnet.</span></span>'
        + '</div>';
      return;
    }
    host.innerHTML = '<div class="adm-att-gora">' + problem.map(p =>
      '<a href="' + esc(p.till) + '">'
      + '<span class="adm-att-antal">' + p.antal + '</span>'
      + '<span class="adm-att-text"><b>' + esc(p.antal === 1 ? p.ental : p.rubrik) + '</b>'
      + '<span>' + esc(p.under) + '</span></span>'
      + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M12 5l7 7-7 7"/></svg>'
      + '</a>').join('') + '</div>';
  }

  /* Hur många händelser som ritas i Senaste aktivitet.

     Blocket står bredvid Närmaste passen i samma rad, och en lista som
     växer förbi grannen trycker ned allt under sig på Översikt. Fem är
     valt för att blocket ska sluta där grannen slutar, inte för att
     fem vore ett naturligt antal händelser.

     Notisklockan i nextrum-admin.js har SIN EGEN gräns på samma flöde.
     Den är en annan sak — en klocka som visar det senaste, inte en yta
     som ska hålla en höjd — så de två ska inte slås ihop. */
  const FLODE_MAX = 5;

  function byggFlöde() {
    const p = [];
    const lägg = (när, rubrik, under) => { if (när) p.push({ när, rubrik, under }); };

    S.leads.forEach(l => lägg(l.created_at, 'Ny intresseanmälan',
      (l.parent_name || l.email || 'Någon') + ' skickade in en intresseanmälan.'));
    S.ansokningar.forEach(a => lägg(a.created_at, 'Ny ansökan',
      (a.name || 'Någon') + ' vill bli studiehjälpare.'));
    S.kontakt.forEach(k => lägg(k.created_at, 'Nytt meddelande',
      (k.name || 'Någon') + ' skrev via kontaktformuläret.'));
    S.rapporter.forEach(r => lägg(r.created_at, 'Lektion rapporterad',
      namnFör(r.tutor_id) + ' skrev rapport för passet ' + kortDatum(r.lesson_date) + '.'));
    S.bokningar.forEach(b => lägg(b.created_at, 'Pass bokat',
      namnFör(b.parent_id) + ' · ' + (b.subject || 'Pass') + ' ' + kortDatum(b.wanted_date) + '.'));
    S.fakturor.forEach(f => {
      lägg(f.betald_at, 'Betalning registrerad', namnFör(f.parent_id) + ' betalade ' + kronor(f.belopp_ore) + '.');
      lägg(f.skickad_at, 'Faktura skickad', namnFör(f.parent_id) + ' · ' + kronor(f.belopp_ore) + '.');
    });
    S.utbetalningar.forEach(u => lägg(u.utbetald_at, 'Ersättning utbetald',
      namnFör(u.tutor_id) + ' · ' + kronor(u.belopp_ore) + '.'));

    return p.sort((a, b) => String(b.när).localeCompare(String(a.när)));
  }

  function ritaFlöde() {
    const alla = byggFlöde();
    const host = $('#adm-flode');
    if (!alla.length) {
      host.innerHTML = tomt('Inget har hänt än',
        'Anmälningar, bokningar och betalningar dyker upp här allteftersom.');
      return;
    }
    const dygnet = Date.now() - DAG;
    host.innerHTML = '<div class="adm-flode">' + alla.slice(0, FLODE_MAX).map(h =>
      '<div class="adm-flode-post' + (new Date(h.när).getTime() > dygnet ? ' ar-ny' : '') + '">'
      + '<span class="adm-flode-nar">' + esc(närText(h.när)) + '</span>'
      + '<span class="adm-flode-text"><b>' + esc(h.rubrik) + '</b>'
      + '<span>' + esc(h.under) + '</span></span>'
      + '</div>').join('') + '</div>'
      /* Foten säger hur många som inte syns. Utan den vet den som ser
         fem rader inte om det är fem händelser totalt eller fem av
         trehundra — och en avkortad lista som ser komplett ut är värre
         än en lång. Samma resonemang som tidslinjen i detaljpanelen,
         som skriver ut "Visar de N senaste av M". */
      + (alla.length > FLODE_MAX
          ? '<p class="xsmall" style="margin-top:10px;color:var(--bl-3)">Visar de '
            + FLODE_MAX + ' senaste av ' + alla.length + ' händelser.</p>'
          : '');
  }

  /* ------------------------------------------------------------
     NÄRMASTE PASSEN
     Ett kort per pass i stället för en tabellrad. Tiden är det man
     letar efter och står därför först och störst.
     ------------------------------------------------------------ */
  function ritaNärmastePass() {
    const idag = isoFor(new Date());
    const kommande = S.bokningar
      .filter(b => b.wanted_date >= idag && (b.status === 'requested' || b.status === 'confirmed'))
      .sort((a, b) => (a.wanted_date + (a.wanted_time || ''))
        .localeCompare(b.wanted_date + (b.wanted_time || '')));

    $('#adm-pass-antal').textContent = kommande.length ? kommande.length + ' framåt' : '';
    const host = $('#ov-pass');
    if (!kommande.length) {
      host.innerHTML = tomt('Inga pass framåt', 'Ingen har bokat något ännu.');
      return;
    }

    host.innerHTML = '<div class="adm-passrad">' + kommande.slice(0, 5).map(b => {
      const online = String(b.format || '').toLowerCase().indexOf('online') !== -1;
      const elev = elevNamn(b.student_id);
      return '<a class="adm-pass" href="#bokningar">'
        + '<span class="adm-pass-nar"><b>'
        + esc(b.wanted_time ? String(b.wanted_time).slice(0, 5) : '—')
        + '</b><span>' + esc(kortDatum(b.wanted_date)) + '</span></span>'
        + '<span class="adm-pass-vad"><b>' + esc(b.subject || 'Pass') + '</b>'
        + '<span class="adm-pass-vem">' + esc(elev || namnFör(b.parent_id))
        + '<span class="adm-pil">→</span>' + esc(namnFör(b.tutor_id))
        + '</span></span>'
        + '<span class="adm-format' + (online ? '' : ' ar-plats') + '">'
        + esc(online ? 'Online' : (b.format || 'På plats')) + '</span>'
        + '</a>';
    }).join('') + '</div>';
  }

  async function ritaÖversikt() {
    const { data, error } = await supa.from('admin_lage').select('*').limit(1);

    /* Vyn admin_lage räknar samma saker i databasen som klienten
       kan räkna själv, men på ALLA rader — inte bara de RLS släppt
       igenom och de gränser hämtningen satte. Finns den används
       den. Finns den inte räknar vi lokalt i stället för att visa
       ett fel: siffrorna blir desamma i den här storleken. */
    S.lage = (!error && data && data.length) ? data[0] : null;

    ritaTal();
    ritaAttGöra();
    ritaProblem();
    /* EFTER de två blocken: konsolen läser S.attGora och S.problem,
       som de sätter. Ritas den före står den med tomma listor. */
    if (NXAdmin.rita.ritaKonsol) NXAdmin.rita.ritaKonsol();
    ritaNärmastePass();
    ritaFlöde();
    ritaNotiser();

    const l = S.lage;
    if (l) {
      /* Det som väntar på oss under Fakturor: utkast att lägga in i
         Fortnox och fakturor som förfallit (Fas 14.6). En skickad faktura
         som inte förfallit väntar på familjen, inte på oss. */
      märkFlik('#flik-fakt-mark', Number(l.fakturor_att_lagga_in || 0) + Number(l.forfallna_fakturor || 0));
      märkFlik('#flik-inkorg-mark', l.ohanterade_meddelanden);
    }
    märkFlik('#flik-avv-mark', utanRapport().length + övrigaAvvikelser().length);
    if (S.sido) {
      /* Summan av allt som pekar dit. Förut räknades bara den första
         posten, så Ekonomi visade pass utan rapport men inte obetalda
         fakturor eller väntande utbetalningar. */
      const av = nyckel => S.attGora
        .filter(x => x.till === nyckel || x.till.indexOf(nyckel + '/') === 0)
        .reduce((n, p) => n + p.antal, 0);
      S.sido.märke('leads', av('#leads'));
      S.sido.märke('ansokningar', av('#ansokningar'));
      S.sido.märke('meddelanden', av('#meddelanden'));
      S.sido.märke('studiehjalpare', av('#studiehjalpare'));
      S.sido.märke('matchning', av('#matchning'));
      S.sido.märke('bokningar', av('#bokningar'));
      S.sido.märke('lektioner', av('#lektioner'));
      S.sido.märke('ekonomi', av('#ekonomi'));
      /* Försenade uppgifter märks på SYSTEM, inte på uppgifter.

         Uppgifter har ingen menypost längre — listan nås från System →
         Automationer. märke() hoppar tyst över en sektion utan länk, så
         siffran hade försvunnit helt och en försenad uppgift slutat
         synas i menyn. Den flyttar dit vägen in numera går. */
      S.sido.märke('system', S.lage && S.lage.forsenade_uppgifter != null
        ? S.lage.forsenade_uppgifter
        : (S.uppgifter || []).filter(u => (u.status === 'oppen' || u.status === 'pagar')
            && u.forfallodag && u.forfallodag < isoFor(new Date())).length);
    }
  }

  /* ============================================================
     STATISTIK

     Frågorna är få med flit: en sida med tolv grafer är en sida
     ingen läser, och den som vill gräva har rådatan i sektionerna
     ovanför.

     Staplarna ritas med NXArbete.graf, samma komponent som
     studievyn och studiehjälparvyn använder för sina sex månader
     (Fas 9.3 — förut fanns den i tre kopior). Samma höjd, samma
     färg för innevarande månad, samma sätt att läsa.

     TALEN KOMMER UR DATABASEN SEDAN FAS 9.6

     Förut räknades de här, ur S.bokningar och S.fakturor. Det gav
     två definitioner av samma sak: grafen räknade
     status='completed' medan noten under lovade "genomfört när
     rapporten finns". Tre av fem completed-pass i driften saknar
     rapport, så grafen var för hög OCH texten falsk. Nu kommer
     talen ur analysvyerna, som alla räknar på
     passunderlag.har_rapport.

     LUCKOR SKRIVS UT

     En anmälan utan källa, en avbokning utan tidpunkt och en
     konvertering utan kund_id har inte ett värde vi kan gissa. De
     står som "okänd" med en förklaring, aldrig som noll och aldrig
     hopslagna med något som råkar likna dem.
     ============================================================ */

  /* Analysvyernas månad är ett datum ('2026-08-01'), och nyckeln i
     NXArbete.sexMånader är 'ÅÅÅÅ-MM'. Ett ställe som översätter. */
  function månadsNyckel(rad) { return String(rad.manad || '').slice(0, 7); }

  /* Lägg raderna ur en analysvy i sex staplar. varde(rad) plockar
     ut talet; rader utanför de sex månaderna faller bort, och rader
     utan månad (okänd tidpunkt) räknas aldrig in i en månad de inte
     hör hemma i. */
  function staplar(rader, varde) {
    const m = NXArbete.sexMånader();
    (rader || []).forEach(r => {
      if (!r.manad) return;
      const s = m.find(x => x.nyckel === månadsNyckel(r));
      if (s) s.antal += Number(varde(r) || 0);
    });
    return m;
  }

  function ritaStatistik() {
    if (!$('#stat-pass')) return;

    const A = S.analys;

    if (S.analysFel) {
      $('#stat-pass').innerHTML = '<p class="fel">Analysvyerna svarade inte: '
        + esc(S.analysFel) + '</p>';
    } else {
      /* ---- Genomförda pass ---- */
      NXArbete.graf($('#stat-pass'), staplar(A.aktiva, r => r.genomforda_pass), {
        nagot: 'Bara genomförda pass räknas — alltså pass med rapport. '
             + 'Ett pass som står som genomfört utan rapport räknas inte här.',
        inget: 'Inget genomfört pass de senaste sex månaderna.'
      });

      /* ---- Aktiva elever ----
         Inte "nya elever" som förut: en elev som lades in i januari
         och inte haft ett pass sedan dess sa ingenting om februari. */
      NXArbete.graf($('#stat-elever'), staplar(A.aktiva, r => r.aktiva_elever), {
        nagot: 'Elever med minst ett genomfört pass under månaden. '
             + 'Samma elev räknas en gång per månad, hur många pass hen än haft.',
        inget: 'Ingen elev har haft ett genomfört pass de senaste sex månaderna.'
      });

      /* ---- Betalt ----
         Förut fakturerat belopp per period. Familjen får ingen faktura
         sedan Fas 14.2, så grafen hade stått tom medan pengarna kom
         in. Nu: kortbetalningar på betalningsmånaden, efter
         återbetalningar, plus betalda äldre fakturor på sin period.
         Allt räknat i analys_ekonomi, inte här. */
      NXArbete.graf($('#stat-intakt'), staplar(A.ekonomi, r =>
        Number(r.kortbetalt_ore || 0) - Number(r.aterbetalt_ore || 0) + Number(r.betalt_ore || 0)), {
        nagot: 'Det familjerna betalat, efter återbetalningar. Ett pass betalas innan det '
             + 'hålls, så pengarna kan stå på månaden före passet.',
        inget: 'Ingen betalning har kommit in de senaste sex månaderna.'
      }, v => kronor(v));
    }

    ritaStatTal();
    ritaTratt();
    ritaKallor();
    ritaAvbokningar();
  }

  /* Talen här är TOTALER, till skillnad från Översiktens som är
     "just nu". Samma komponent, annan fråga: Översikt svarar på hur
     det ser ut idag, Statistik på hur långt vi kommit.

     Summorna tas ur analysvyerna och inte ur S.bokningar, så att de
     håller samma definition som graferna ovanför. */
  function ritaStatTal() {
    const host = $('#stat-tal');
    if (!host) return;
    const ek = S.analys.ekonomi;
    const summa = (rader, falt) => (rader || []).reduce((n, r) => n + Number(r[falt] || 0), 0);

    const pass = summa(ek, 'genomforda_pass');
    const minuter = summa(ek, 'minuter');
    const familjer = Object.values(S.personer).filter(p => p.role === 'parent').length;
    /* Betalt = kort efter återbetalningar plus betalda äldre fakturor,
       samma definition som grafen ovanför. ej_betalda är pass som
       hölls och rapporterades utan att familjen betalat. */
    const betalt = summa(ek, 'kortbetalt_ore') - summa(ek, 'aterbetalt_ore') + summa(ek, 'betalt_ore');
    const ejBetalda = summa(ek, 'ej_betalda');

    host.innerHTML =
      '<div class="adm-kpi"><b>' + pass + '</b><span>Genomförda pass</span>'
      + '<span class="adm-kpi-diff">sedan starten, med rapport</span></div>'
      + '<div class="adm-kpi"><b>' + NXBetalning.timmar(minuter) + '</b><span>Undervisad tid</span>'
      + '<span class="adm-kpi-diff">i genomförda pass</span></div>'
      + '<div class="adm-kpi"><b>' + familjer + '</b><span>Familjer</span>'
      + '<span class="adm-kpi-diff">' + S.elevlista.length
      + (S.elevlista.length === 1 ? ' elev' : ' elever') + '</span></div>'
      + '<div class="adm-kpi"><b>' + kronor(betalt) + '</b><span>Betalt</span>'
      + '<span class="adm-kpi-diff">' + (ejBetalda
        ? ejBetalda + (ejBetalda === 1 ? ' pass hölls' : ' pass hölls') + ' utan betalning'
        : 'sedan starten, efter återbetalningar') + '</span></div>';
  }

  /* ------------------------------------------------------------
     VARIFRÅN FAMILJERNA KOM (Fas 9.6)

     Källan mättes redan, men skrevs in i anmälans fritext. Där
     kunde den kapas bort av längdtaket, och där gick den inte att
     räkna utan att läsa något familjen själv skrivit. Sedan 9.5
     har den egna kolumner.

     Anmälningar från före 9.5 har ingen källa. De står som "okänd",
     och de bakfylldes med flit inte: att läsa tillbaka en kanal ur
     fritext är precis det vi slutade göra.
     ------------------------------------------------------------ */
  function ritaKallor() {
    const host = $('#stat-kallor');
    if (!host) return;

    /* Slå ihop månaderna: frågan är vilken kanal som ger kunder,
       inte vilken månad den gjorde det. */
    const per = {};
    (S.analys.kallor || []).forEach(r => {
      const nyckel = r.kalla || '';
      const p = per[nyckel] || (per[nyckel] = {
        kalla: r.kalla, medium: r.medium, anmalningar: 0, matchade: 0, blev_kund: 0
      });
      p.anmalningar += Number(r.anmalningar || 0);
      p.matchade += Number(r.matchade || 0);
      p.blev_kund += Number(r.blev_kund || 0);
      if (r.kalla && r.medium && p.medium !== r.medium) p.medium = null; // flera medier
    });

    const rader = Object.values(per).sort((a, b) => b.anmalningar - a.anmalningar);
    if (!rader.length) { host.innerHTML = tomt('Ingen intresseanmälan än', ''); return; }

    host.innerHTML = tabell([
      { namn: 'Kanal', rita: r => r.kalla
        ? '<b>' + esc(r.kalla) + '</b>'
          + (r.medium ? '<span class="adm-und">' + esc(r.medium) + '</span>' : '')
        : '<b>Okänd</b><span class="adm-und">kom in innan källan mättes</span>' },
      { namn: 'Anmälningar', höger: true, rita: r => '<span class="adm-tal">' + r.anmalningar + '</span>' },
      { namn: 'Matchade', höger: true, rita: r => '<span class="adm-tal">' + r.matchade + '</span>' },
      { namn: 'Blev kund', höger: true, rita: r => '<span class="adm-tal">' + r.blev_kund + '</span>' }
    ], rader)
      + '<p class="graf-not">"Blev kund" kräver att anmälan kopplats till ett konto. '
      + 'Anmälningar som konverterades innan kopplingen började skrivas saknar den, '
      + 'och räknas därför inte — se tratten ovan.</p>';
  }

  /* ------------------------------------------------------------
     AVBOKNINGAR (Fas 9.6)

     Tidpunkten finns sedan 9.4. Före den vet vi bara ATT passet
     avbokades, inte när — och de raderna placeras därför inte i
     någon månad. Att lägga dem på passets datum hade gjort en
     avbokning i mars till en avbokning i maj.
     ------------------------------------------------------------ */
  function ritaAvbokningar() {
    const host = $('#stat-avbok');
    if (!host) return;

    const rader = S.analys.avbokningar || [];
    if (!rader.length) { host.innerHTML = tomt('Ingen avbokning än', ''); return; }

    const utanTid = rader.filter(r => !r.manad)
      .reduce((n, r) => n + Number(r.avbokningar || 0), 0);

    NXArbete.graf(host, staplar(rader, r => r.avbokningar), false);

    const summa = falt => rader.reduce((n, r) => n + Number(r[falt] || 0), 0);
    host.innerHTML += '<div class="adm-tal-rad">'
      + '<div class="adm-kpi"><b>' + summa('av_familjen') + '</b><span>Av familjen</span></div>'
      + '<div class="adm-kpi"><b>' + summa('av_studiehjalparen') + '</b><span>Av studiehjälparen</span></div>'
      + '<div class="adm-kpi"><b>' + summa('utan_avsandare') + '</b><span>Utan avsändare</span>'
      + '<span class="adm-kpi-diff">schemalagt eller före 9.4</span></div>'
      + '</div>'
      + '<p class="graf-not">'
      + (utanTid
          ? utanTid + ' ' + (utanTid === 1 ? 'avbokning' : 'avbokningar')
            + ' saknar tidpunkt och står utanför staplarna: de skedde innan '
            + 'tidpunkten började sparas. De räknas i talen under.'
          : 'Staplarna visar när passet avbokades, inte när det skulle ha hållits.')
      + '</p>';
  }

  /* ------------------------------------------------------------
     TRATTEN
     Intresseanmälan → kontakt → matchning → kund.

     De tre första stegen är lägen i leads.status. Det fjärde är
     inte det: en "kund" är en familj som faktiskt finns i
     profiles med ett matchat barn, inte en anmälan någon kryssat
     i. Att läsa det sista steget ur samma tabell som de andra
     hade varit snyggare och fel.

     Bortfallet mellan stegen är det enda värda att titta på, så
     det står i siffror bredvid varje stapel och inte bara som en
     smalnande form.
     ------------------------------------------------------------ */
  function ritaTratt() {
    const host = $('#stat-tratt');
    if (!host) return;

    const L = S.leads;
    const kom = L.length;
    /* Kumulativt, inte per läge: en anmälan som blivit matchad HAR
       varit kontaktad, även om statusfältet bara minns det sista.
       Räknat per läge hade tratten sett ut att smalna och sedan
       breddas igen. */
    const kontaktade = L.filter(l => l.status !== 'new').length;
    const matchade = L.filter(l => l.status === 'matched').length;
    const kunder = Object.values(S.personer).filter(p =>
      p.role === 'parent' && (S.elever[p.id] || []).some(e =>
        e.matched_tutor_id && e.match_status === 'matched')).length;

    /* Fas 9.6: hur många anmälningar som är märkta matchade men
       saknar kopplingen till ett konto. De går inte att följa
       vidare, och kopplingen gissas inte fram. Utan den här siffran
       ser sista steget ut som ett bortfall, när det i själva verket
       är en lucka i mätningen. */
    const ejSpårbara = (S.analys.konvertering || [])
      .reduce((n, r) => n + Number(r.ej_sparbara || 0), 0);

    const steg = [
      ['Intresseanmälningar', 'allt som kommit in', kom],
      ['Kontaktade', 'någon har hört av sig tillbaka', kontaktade],
      ['Matchade', 'anmälan ledde till en studiehjälpare', matchade],
      ['Aktiva familjer', 'har minst ett matchat barn i systemet', kunder]
    ];

    const störst = Math.max(1, ...steg.map(s => s[2]));

    host.innerHTML = '<div class="tratt">' + steg.map((s, i) => {
      const föregående = i ? steg[i - 1][2] : null;
      const tapp = föregående !== null ? föregående - s[2] : null;
      let under;
      if (tapp === null) under = 'ingång';
      else if (tapp > 0) under = '−' + tapp + ' här';
      else if (s[2] > föregående) under = '+' + (s[2] - föregående) + ' utanför';
      else under = 'inget tapp';
      return '<div class="tratt-steg"><div>'
        + '<span class="tratt-namn"><b>' + esc(s[0]) + '</b><span>' + esc(s[1]) + '</span></span>'
        + '<span class="tratt-stapel"><i style="width:'
        + Math.max(2, Math.round((s[2] / störst) * 100)) + '%"></i></span>'
        + '</div>'
        + '<span class="tratt-tal"><b>' + s[2] + '</b>'
        + '<span' + (tapp > 0 ? ' class="ar-tapp"' : '') + '>' + esc(under) + '</span></span>'
        + '</div>';
    }).join('') + '</div>'
      /* "+N utanför" behöver en förklaring första gången man ser
         det, annars läser det som ett räknefel. */
      + '<p class="graf-not">Aktiva familjer kan vara fler än matchade anmälningar: '
      + 'alla familjer kom inte in via formuläret.'
      + (ejSpårbara
          ? ' ' + ejSpårbara + ' ' + (ejSpårbara === 1 ? 'matchad anmälan' : 'matchade anmälningar')
            + ' saknar koppling till ett konto och går inte att följa längre än hit — '
            + 'kopplingen började skrivas först i Fas 7, och den gissas inte fram i efterhand.'
          : '')
      + '</p>';
  }



  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, {
    byggFlöde, ritaStatistik, ritaÖversikt
  });
})();
