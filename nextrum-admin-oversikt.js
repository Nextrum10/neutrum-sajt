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
          närText } = NXAdmin;
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

    /* Intäkten är summan av fakturorna för innevarande period.
       Finns inga fakturor alls står 0 kr, och ingen jämförelse —
       det är sant, och det ändras den dagen faktureringen körts
       första gången. */
    const period = idag.slice(0, 7);
    const iMånaden = S.fakturor.filter(f => String(f.period || '').slice(0, 7) === period
      && f.status !== 'makulerad');
    const belopp = iMånaden.reduce((n, f) => n + (f.belopp_ore || 0), 0);
    const förraPeriod = (() => {
      const d = new Date(); d.setMonth(d.getMonth() - 1);
      return isoFor(d).slice(0, 7);
    })();
    const förraRader = S.fakturor.filter(f => String(f.period || '').slice(0, 7) === förraPeriod
      && f.status !== 'makulerad');
    const förraBelopp = förraRader.reduce((n, f) => n + (f.belopp_ore || 0), 0);

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
        förraRader.length ? 'förra månaden ' + kronor(förraBelopp)
          : (iMånaden.length ? 'fakturerat hittills' : 'inget fakturerat än'));
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
        rubrik: 'meddelanden i inkorgen', ental: 'meddelande i inkorgen',
        under: 'Från kontaktformuläret, ingen har svarat än.', till: '#meddelanden' },
      { antal: S.bokningar.filter(b =>
          b.status !== 'cancelled' && b.status !== 'completed'
          && String(b.wanted_date) < idag).length,
        rubrik: 'pass saknar rapport', ental: 'pass saknar rapport',
        under: 'Hållna men orapporterade. De faktureras inte.', till: '#lektioner' },
      { antal: utanRapport().length,
        rubrik: 'genomförda pass saknar rapport', ental: 'genomfört pass saknar rapport',
        under: 'Pass saknar rapport och kan därför inte behandlas automatiskt.', till: '#ekonomi/avvikelser' },
      { antal: obetalda,
        rubrik: 'obetalda fakturor', ental: 'obetald faktura',
        under: 'Skickade men inte betalda.', till: '#ekonomi' },
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
        under: 'Något i fakturor eller utbetalningar som inte går ihop.', till: '#ekonomi/avvikelser' },
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
    const problem = byggProblem();
    const summa = problem.reduce((n, p) => n + p.antal, 0);
    $('#adm-problem-antal').textContent = summa ? summa + ' st' : '';
    if (!problem.length) {
      host.innerHTML = '<div class="adm-lugnt">'
        + '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/></svg>'
        + '<span><b>Inga problem just nu</b>'
        + '<span>Inga förfallna fakturor, inga sena uppgifter och inga fel det senaste dygnet.</span></span>'
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
    host.innerHTML = '<div class="adm-flode">' + alla.slice(0, 6).map(h =>
      '<div class="adm-flode-post' + (new Date(h.när).getTime() > dygnet ? ' ar-ny' : '') + '">'
      + '<span class="adm-flode-nar">' + esc(närText(h.när)) + '</span>'
      + '<span class="adm-flode-text"><b>' + esc(h.rubrik) + '</b>'
      + '<span>' + esc(h.under) + '</span></span>'
      + '</div>').join('') + '</div>';
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
    ritaNärmastePass();
    ritaFlöde();
    ritaNotiser();

    const l = S.lage;
    if (l) {
      märkFlik('#flik-fakt-mark', l.obetalda_fakturor);
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
      S.sido.märke('uppgifter', S.lage && S.lage.forsenade_uppgifter != null
        ? S.lage.forsenade_uppgifter
        : (S.uppgifter || []).filter(u => (u.status === 'oppen' || u.status === 'pagar')
            && u.forfallodag && u.forfallodag < isoFor(new Date())).length);
    }
  }

  /* ============================================================
     STATISTIK

     Fyra frågor, fyra bilder. Inte fler: en sida med tolv grafer
     är en sida ingen läser, och den som vill gräva har rådatan i
     sektionerna ovanför.

     Staplarna ritas med .graf, samma komponent som studievyn och
     studiehjälparvyn använder för sina sex månader. Samma höjd,
     samma färg för innevarande månad, samma sätt att läsa. En
     egen graf hade gjort adminvyn till en annan produkt.

     ALLTID SEX STAPLAR

     Även när några är tomma. En graf som byter bredd med datan
     går inte att jämföra med sig själv nästa månad, och det är
     hela poängen med att titta på den.
     ============================================================ */

  function sexManader() {
    const ut = [];
    const nu = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(nu.getFullYear(), nu.getMonth() - i, 1);
      ut.push({
        nyckel: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
        namn: NX.MANADER[d.getMonth()].slice(0, 3),
        antal: 0
      });
    }
    return ut;
  }

  /* format(v) gör om ett värde till texten över stapeln. Utan den
     hade kronor ritats som ören, och en stapel med "75800" över
     sig säger ingenting. */
  function ritaGraf(host, månader, not, format) {
    if (!host) return;
    const högst = Math.max(1, ...månader.map(m => m.antal));
    const något = månader.some(m => m.antal);
    host.innerHTML = '<div class="graf">' + månader.map((m, i) =>
      '<div class="graf-stapel' + (i === månader.length - 1 ? ' nu' : '') + '">'
      + '<b>' + esc(format ? format(m.antal) : String(m.antal)) + '</b>'
      + '<i style="height:' + Math.round((m.antal / högst) * 100) + '%"></i>'
      + '<span>' + esc(m.namn) + '</span>'
      + '</div>').join('') + '</div>'
      + '<p class="graf-not">' + esc(något ? not : 'Inget att visa än — grafen fylls i allteftersom.') + '</p>';
  }

  function ritaStatistik() {
    if (!$('#stat-pass')) return;

    /* ---- Genomförda pass ---- */
    const pass = sexManader();
    S.bokningar.filter(b => b.status === 'completed').forEach(b => {
      const m = pass.find(x => x.nyckel === String(b.wanted_date || '').slice(0, 7));
      if (m) m.antal++;
    });
    ritaGraf($('#stat-pass'), pass,
      'Bara genomförda pass räknas. Ett pass blir genomfört när studiehjälparen skrivit rapporten.');

    /* ---- Nya elever ---- */
    const elever = sexManader();
    S.elevlista.forEach(e => {
      const m = elever.find(x => x.nyckel === String(e.created_at || '').slice(0, 7));
      if (m) m.antal++;
    });
    ritaGraf($('#stat-elever'), elever,
      'När eleven lades till av familjen, inte när första passet hölls.');

    /* ---- Fakturerat ----
       Makulerade räknas inte: en makulerad faktura är en som aldrig
       skulle ha skickats, och att räkna den vore att räkna ett
       misstag som intäkt. */
    const intäkt = sexManader();
    S.fakturor.filter(f => f.status !== 'makulerad').forEach(f => {
      const m = intäkt.find(x => x.nyckel === String(f.period || '').slice(0, 7));
      if (m) m.antal += (f.belopp_ore || 0);
    });
    ritaGraf($('#stat-intakt'), intäkt,
      'Fakturerat belopp per period, makulerade borträknade. Inte detsamma som betalt.',
      v => kronor(v));

    ritaStatTal();
    ritaTratt();
  }

  /* Talen här är TOTALER, till skillnad från Översiktens som är
     "just nu". Samma komponent, annan fråga: Översikt svarar på hur
     det ser ut idag, Statistik på hur långt vi kommit. */
  function ritaStatTal() {
    const host = $('#stat-tal');
    if (!host) return;
    const genomförda = S.bokningar.filter(b => b.status === 'completed');
    const minuter = genomförda.reduce((n, b) => n + (b.duration_min || 60), 0);
    const familjer = Object.values(S.personer).filter(p => p.role === 'parent').length;
    const fakturerat = S.fakturor.filter(f => f.status !== 'makulerad')
      .reduce((n, f) => n + (f.belopp_ore || 0), 0);
    const betalt = S.fakturor.filter(f => f.status === 'betald')
      .reduce((n, f) => n + (f.belopp_ore || 0), 0);

    host.innerHTML =
      '<div class="adm-kpi"><b>' + genomförda.length + '</b><span>Genomförda pass</span>'
      + '<span class="adm-kpi-diff">sedan starten</span></div>'
      + '<div class="adm-kpi"><b>' + NXBetalning.timmar(minuter) + '</b><span>Undervisad tid</span>'
      + '<span class="adm-kpi-diff">i genomförda pass</span></div>'
      + '<div class="adm-kpi"><b>' + familjer + '</b><span>Familjer</span>'
      + '<span class="adm-kpi-diff">' + S.elevlista.length
      + (S.elevlista.length === 1 ? ' elev' : ' elever') + '</span></div>'
      + '<div class="adm-kpi"><b>' + kronor(fakturerat) + '</b><span>Fakturerat</span>'
      + '<span class="adm-kpi-diff">' + (fakturerat
        ? kronor(betalt) + ' betalt' : 'ingen faktura än') + '</span></div>';
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
      + 'alla familjer kom inte in via formuläret.</p>';
  }



  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, {
    byggFlöde, ritaStatistik, ritaÖversikt
  });
})();
