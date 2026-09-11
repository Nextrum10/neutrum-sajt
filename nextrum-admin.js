/* ============================================================
   NEXTRUM — adminvyn

   Laddas bara av admin.html. Kräver NX, NXStudie, NXArbete,
   NXBetalning och NXMedia.

   TVÅ SAKER SOM STYR HELA FILEN

   1. Ingenting här ger någon åtkomst. Sidan hämtar allt med samma
      anon-nyckel som de andra vyerna, och det är RLS-reglerna i
      databasen som avgör vad som kommer tillbaka. Att gömma en
      knapp är inte säkerhet — den som inte är admin får tomma
      svar, oavsett vad den här filen ritar. Kontrollen av
      is_admin nedan är alltså för att visa RÄTT SIDA, inte för
      att skydda datan.

   2. Kopplingarna görs lokalt, inte i frågan. profiles, students
      och tutor_profiles hämtas en gång var och läggs i kartor;
      bokningar och fakturor slås ihop mot dem i webbläsaren.

      Anledningen är konkret: bookings har tre främmande nycklar
      mot profiles (parent_id, tutor_id, created_by), och PostgREST
      kräver då att varje inbäddning namnger vilken den menar. Det
      går att skriva, men det går sönder tyst den dagen någon
      lägger till en fjärde. Med kartor blir det en fråga per
      tabell och noll tvetydighet. Volymerna är små — det här är
      ledningens vy för ett bolag med tvåsiffrigt antal familjer,
      inte en rapportmotor.
   ============================================================ */
(function () {
  'use strict';

  const { $, $$, esc, säg, rensa, felText, datumText, isoFor } = NX;
  const { bekräfta, medan, tomt, laddar } = NXStudie;
  const kronor = NXBetalning.kronor;
  const M = NXMedia;

  /* supa är den klient nextrum-app.js redan skapat. Den är
     deklarerad med const på toppnivå i ett vanligt <script>, alltså
     en global lexikal bindning som är synlig här — inte en egen
     klient. En andra klient hade haft en egen sessionslyssnare och
     hållit en andra kopia av token. */

  NX.initHeader();

  const S = {
    user: null, profil: null, sido: null, flikar: {}, hero: null,
    personer: {},      // id → profilrad
    elever: {},        // parent_id → [elevrader]
    tutorProfiler: {}, // id → tutor_profiles-rad
    leads: [], ansokningar: [], kontakt: [], bokningar: [],
    fakturor: [], utbetalningar: [], chattar: [], klientfel: [],
    integrationer: [], pris: null, saknasV13: [],
    elevlista: [], rapporter: [], lage: null, attGora: [],
    matchunderlag: [], matchunderlagFel: null, valdElev: null,
    valdPerson: null
  };

  function visa(id) {
    ['view-loading', 'view-auth', 'view-nekad', 'view-app', 'view-fel']
      .forEach(v => { const el = $('#' + v); if (el) el.hidden = (v !== id); });
  }

  /* ============================================================
     SMÅ BYGGSTENAR
     ============================================================ */

  /* En tabell, inte kort. Ledningen läser många rader fort och
     jämför dem; familjen läser en rad noga. Olika krav, olika
     form. Tabellen får rulla i sidled hellre än att trängas ihop
     tills siffrorna inte går att ställa bredvid varandra. */
  function tabell(kolumner, rader, tomtText) {
    if (!rader.length) return tomt(tomtText || 'Inget här', '');
    return '<div class="adm-skal"><table class="adm"><thead><tr>'
      + kolumner.map(k => '<th' + (k.höger ? ' style="text-align:right"' : '') + '>'
        + esc(k.namn) + '</th>').join('')
      + '</tr></thead><tbody>'
      + rader.map(r => '<tr>' + kolumner.map(k => {
        const v = k.rita(r);
        return '<td' + (k.höger ? ' class="adm-atg"' : '') + '>' + v + '</td>';
      }).join('') + '</tr>').join('')
      + '</tbody></table></div>';
  }

  /* Statusprickar. Färgen är en genväg, texten är beskedet — den
     står alltid kvar, för färgen ensam funkar inte för alla. */
  function pill(text, klass) {
    return '<span class="adm-status' + (klass ? ' ' + klass : '') + '">' + esc(text) + '</span>';
  }

  const LEAD_LAGE = {
    new: ['Ny', 'ar-ny'], contacted: ['Kontaktad', 'ar-vantar'],
    matched: ['Matchad', 'ar-klar'], declined: ['Avböjd', '']
  };
  const ANS_LAGE = {
    new: ['Ny', 'ar-ny'], contacted: ['Kontaktad', 'ar-vantar'],
    approved: ['Godkänd', 'ar-klar'], rejected: ['Avböjd', '']
  };
  const SH_LAGE = {
    pending: ['Väntar', 'ar-vantar'], approved: ['Godkänd', 'ar-klar'], rejected: ['Avböjd', '']
  };
  const BOK_LAGE = {
    requested: ['Önskat', 'ar-ny'], confirmed: ['Bekräftat', 'ar-vantar'],
    completed: ['Genomfört', 'ar-klar'], cancelled: ['Avbokat', '']
  };
  const FAKT_LAGE = {
    utkast: ['Utkast', ''], skickad: ['Skickad', 'ar-vantar'], betald: ['Betald', 'ar-klar'],
    forfallen: ['Förfallen', 'ar-ny'], makulerad: ['Makulerad', '']
  };
  const UTB_LAGE = {
    utkast: ['Utkast', ''], godkand: ['Godkänd', 'ar-vantar'],
    utbetald: ['Utbetald', 'ar-klar'], misslyckad: ['Misslyckad', 'ar-ny']
  };

  function läge(karta, värde) {
    const p = karta[värde] || [värde || '—', ''];
    return pill(p[0], p[1]);
  }

  /* En rullgardin som ÄR handlingen. Ett separat "spara" hade
     betytt att halva raderna blir liggande halvändrade — den som
     byter status i en lista på trettio rader kommer aldrig ihåg
     att trycka spara på var och en. */
  function väljare(id, karta, värde, attribut) {
    return '<select class="sel" style="min-width:132px;padding:7px 28px 7px 10px;font-size:.84rem" '
      + attribut + ' aria-label="Ändra status">'
      + Object.keys(karta).map(k => '<option value="' + k + '"'
        + (k === värde ? ' selected' : '') + '>' + esc(karta[k][0]) + '</option>').join('')
      + '</select>';
  }

  function namnFör(id) {
    const p = S.personer[id];
    return p ? (p.full_name || p.email || '—') : '—';
  }

  function kortDatum(iso) {
    if (!iso) return '—';
    return datumText(String(iso).slice(0, 10));
  }

  /* Tom lista eller tomt filter är två olika besked. "Inga familjer
     matchar" i en databas utan familjer skickar folk på jakt efter
     ett filter som inte är satt. Alla listor nedan väljer därför
     text utifrån om något faktiskt filtrerats bort. */
  function tomtText(filtrerat, medFilter, utanFilter) {
    return filtrerat ? medFilter : utanFilter;
  }

  /* Ett fält som filtreras på: namn, e-post, ämne. Sökningen är
     avsiktligt dum — allt i en sträng, skiftlägesokänsligt. En
     smartare sökning som ibland missar är värre än en trög som
     alltid hittar. */
  function matchar(rad, fält, sök) {
    if (!sök) return true;
    const s = sök.toLowerCase();
    return fält.map(f => String(rad[f] == null ? '' : rad[f])).join(' ').toLowerCase().indexOf(s) !== -1;
  }

  /* ============================================================
     HÄMTNINGEN
     ============================================================ */

  async function hämtaAllt() {
    const [profiler, elever, tutorer] = await Promise.all([
      supa.from('profiles').select('id, role, full_name, email, is_admin, match_status, matched_tutor_id, phone, created_at, last_seen_at'),
      supa.from('students').select('id, parent_id, name, grade, school, subjects, goals, created_at, matched_tutor_id, match_status'),
      supa.from('tutor_profiles').select('id, age, school, city, subjects, grade_levels, status, hourly_rate, created_at')
    ]);
    if (profiler.error) throw profiler.error;

    S.personer = {};
    (profiler.data || []).forEach(p => { S.personer[p.id] = p; });

    S.elever = {};
    (elever.data || []).forEach(e => {
      (S.elever[e.parent_id] = S.elever[e.parent_id] || []).push(e);
    });
    /* Samma rader platt. Familjesidan vill ha dem grupperade per
       förälder, elevsidan och söket vill ha dem i en lista — och
       att bygga om kartan till en lista vid varje omritning är
       arbete för något som aldrig ändrar sig mellan hämtningar. */
    S.elevlista = elever.data || [];

    S.tutorProfiler = {};
    (tutorer.data || []).forEach(t => { S.tutorProfiler[t.id] = t; });

    const [leads, ans, kontakt, bok, fakt, utb, chatt, fel, pris, integ, rapporter] = await Promise.all([
      supa.from('leads').select('*').order('created_at', { ascending: false }),
      supa.from('applications').select('*').order('created_at', { ascending: false }),
      supa.from('contact_messages').select('*').order('created_at', { ascending: false }),
      supa.from('bookings').select('id, parent_id, tutor_id, student_id, subject, format, wanted_date, wanted_time, duration_min, status, attendance, created_at').order('wanted_date', { ascending: false }),
      supa.from('invoices').select('*').order('period', { ascending: false }),
      supa.from('payouts').select('*').order('period', { ascending: false }),
      supa.from('messages').select('parent_id, tutor_id, sender_id, body, created_at, read_at').order('created_at', { ascending: false }).limit(400),
      supa.from('klientfel').select('*').order('created_at', { ascending: false }).limit(100),
      supa.from('prissattning').select('*').limit(1),
      supa.from('integrationer').select('*'),
      /* Rapporterna används bara av aktivitetsflödet, och bara de
         senaste. Ett "lektion genomförd" i flödet är ett pass som
         faktiskt rapporterats, inte ett pass vars datum passerat. */
      supa.from('lesson_reports').select('id, student_id, tutor_id, lesson_date, created_at')
        .order('created_at', { ascending: false }).limit(40)
    ]);

    S.leads = leads.data || [];
    S.ansokningar = ans.data || [];
    S.kontakt = kontakt.data || [];
    S.bokningar = bok.data || [];
    S.fakturor = fakt.data || [];
    S.utbetalningar = utb.data || [];
    S.klientfel = fel.data || [];
    S.pris = (pris.data || [])[0] || null;
    S.integrationer = integ.data || [];
    S.rapporter = rapporter.data || [];

    /* En rad per tråd, den senaste. Trådarna kommer sorterade
       nyast först, så den första träffen på ett par ÄR den senaste. */
    const sedda = {};
    S.chattar = [];
    (chatt.data || []).forEach(m => {
      const nyckel = m.parent_id + '|' + m.tutor_id;
      if (sedda[nyckel]) { sedda[nyckel].antal++; return; }
      sedda[nyckel] = { ...m, antal: 1 };
      S.chattar.push(sedda[nyckel]);
    });

    /* De här två saknas tills schema-v13.sql är kört. Att låta
       hela vyn dö på det vore fel — resten fungerar. */
    S.saknasV13 = [];
    if (integ.error) S.saknasV13.push('integrationer');
    if (kontakt.data && kontakt.data.length && !('hanterad_at' in kontakt.data[0])) {
      S.saknasV13.push('contact_messages.hanterad_at');
    }
  }

  /* Vyn matchningsunderlag räknar antal_elever och genomforda_pass
     per studiehjälpare. Båda ändras när en matchning sätts, så den
     hämtas om i stället för att räknas vidare i minnet. En egen
     funktion, och inte en del av hämtaAllt, just därför.

     Saknas vyn — schema-v14 inte körd — blir listan tom och
     matchningssektionen säger det, i stället för att hela vyn dör. */
  async function hämtaMatchunderlag() {
    const { data, error } = await supa.from('matchningsunderlag').select('*');
    S.matchunderlagFel = error ? felText(error) : null;
    S.matchunderlag = data || [];
  }

  /* ============================================================
     ÖVERSIKTEN

     Fyra block, i den ordning man behöver dem:

       1. Hur går det        — fyra tal om verksamheten
       2. Vad ska jag göra   — arbetskön, en rad per sak
       3. Vad händer härnäst — de närmaste passen
       4. Vad har hänt       — aktivitetsflödet

     Inget av det är påhittat. Saknas data står det tomt, och ett
     jämförelsetal visas bara när det finns en föregående period
     att jämföra med. En nolla där sanningen är "vi vet inte än"
     är ett annat påstående, och det felaktiga.
     ============================================================ */

  const DAG = 86400000;

  function dagarSedan(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return isoFor(d);
  }

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

  /* ------------------------------------------------------------
     AKTIVITETSFLÖDET
     Sammanställs i klienten ur de tabeller som redan är hämtade.
     Ingen händelsetabell: en sådan kräver att någon skriver till
     den vid varje händelse, och blir tyst fel den dagen någon
     glömmer. Härledningen kan inte hamna ur synk med sanningen,
     för den ÄR sanningen, läst en gång till.
     ------------------------------------------------------------ */
  function närText(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const gått = Date.now() - d.getTime();
    if (gått < 0) return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    if (gått < 60000) return 'nu';
    if (gått < DAG && d.getDate() === new Date().getDate()) {
      return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    }
    if (gått < 2 * DAG) return 'igår';
    return datumText(isoFor(d));
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
  function elevNamn(id) {
    const e = S.elevlista.find(x => x.id === id);
    return e ? e.name : null;
  }

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
    ritaNärmastePass();
    ritaFlöde();
    ritaNotiser();

    const l = S.lage;
    if (l) {
      märkFlik('#flik-fakt-mark', l.obetalda_fakturor);
      märkFlik('#flik-inkorg-mark', l.ohanterade_meddelanden);
    }
    if (S.sido) {
      const av = nyckel => {
        const p = S.attGora.find(x => x.till === nyckel || x.till.indexOf(nyckel + '/') === 0);
        return p ? p.antal : 0;
      };
      S.sido.märke('leads', av('#leads'));
      S.sido.märke('ansokningar', av('#ansokningar'));
      S.sido.märke('meddelanden', av('#meddelanden'));
      S.sido.märke('studiehjalpare', av('#studiehjalpare'));
      S.sido.märke('matchning', av('#matchning'));
      S.sido.märke('bokningar', av('#bokningar'));
      S.sido.märke('ekonomi', av('#ekonomi'));
    }
  }

  function rad(rubrik, under, höger) {
    return '<div class="mat" style="grid-template-columns:1fr auto">'
      + '<span class="mat-vad"><b>' + esc(rubrik || '—') + '</b>'
      + '<span>' + esc(under || '') + '</span></span>'
      + '<span class="xsmall" style="color:var(--bl-3);white-space:nowrap">' + esc(höger || '') + '</span>'
      + '</div>';
  }

  function märkFlik(id, antal) {
    const m = $(id);
    if (!m) return;
    m.hidden = !antal;
    m.textContent = antal || '';
  }

  /* ============================================================
     INTRESSEANMÄLNINGAR
     ============================================================ */

  function ritaLeads() {
    const sök = $('#leads-sok').value.trim();
    const st = $('#leads-status').value;
    const rader = S.leads
      .filter(l => !st || l.status === st)
      .filter(l => matchar(l, ['parent_name', 'email', 'child_name', 'subject', 'grade', 'message'], sök));

    $('#leads-antal').textContent = rader.length + ' av ' + S.leads.length;
    $('#leads-tabell').innerHTML = tabell([
      { namn: 'Familj', rita: l => '<b>' + esc(l.parent_name) + '</b>'
        + '<span class="adm-und">' + esc(l.email) + '</span>' },
      { namn: 'Barn', rita: l => esc(l.child_name || '—')
        + (l.grade ? '<span class="adm-und">' + esc(l.grade) + '</span>' : '') },
      { namn: 'Ämne', rita: l => esc(l.subject || '—') },
      { namn: 'Vad de skrev', rita: l => l.message
        ? '<span title="' + esc(l.message) + '">' + esc(l.message.slice(0, 90))
          + (l.message.length > 90 ? '…' : '') + '</span>'
        : '<span style="color:var(--bl-3)">—</span>' },
      { namn: 'Inkom', rita: l => '<span class="adm-tal">' + esc(kortDatum(l.created_at)) + '</span>' },
      { namn: 'Läge', höger: true, rita: l => väljare('lead', LEAD_LAGE, l.status, 'data-lead="' + l.id + '"') }
    ], rader, tomtText(sök || st, 'Ingen intresseanmälan matchar filtret', 'Inga intresseanmälningar än'));
  }

  /* ============================================================
     ANSÖKNINGAR
     ============================================================ */

  function ritaAnsokningar() {
    const sök = $('#ans-sok').value.trim();
    const st = $('#ans-status').value;
    const rader = S.ansokningar
      .filter(a => !st || a.status === st)
      .filter(a => matchar(a, ['name', 'email', 'school', 'subjects', 'why'], sök));

    $('#ans-antal').textContent = rader.length + ' av ' + S.ansokningar.length;
    $('#ans-tabell').innerHTML = tabell([
      { namn: 'Namn', rita: a => '<b>' + esc(a.name) + '</b>'
        + '<span class="adm-und">' + esc(a.email) + (a.age ? ' · ' + a.age + ' år' : '') + '</span>' },
      { namn: 'Skola', rita: a => esc(a.school || '—') },
      { namn: 'Ämnen', rita: a => esc(a.subjects || '—') },
      { namn: 'Kan jobba', rita: a => esc(a.availability || '—') },
      { namn: 'Varför', rita: a => a.why
        ? '<span title="' + esc(a.why) + '">' + esc(a.why.slice(0, 90))
          + (a.why.length > 90 ? '…' : '') + '</span>'
        : '<span style="color:var(--bl-3)">—</span>' },
      { namn: 'Inkom', rita: a => '<span class="adm-tal">' + esc(kortDatum(a.created_at)) + '</span>' },
      { namn: 'Läge', höger: true, rita: a => väljare('ans', ANS_LAGE, a.status, 'data-ans="' + a.id + '"') }
    ], rader, tomtText(sök || st, 'Ingen ansökan matchar filtret', 'Inga ansökningar än'));
  }

  /* ============================================================
     MEDDELANDEN
     ============================================================ */

  function ritaKontakt() {
    const sök = $('#msg-sok').value.trim();
    const bara = $('#msg-ohanterade').checked;
    const rader = S.kontakt
      .filter(m => !bara || !m.hanterad_at)
      .filter(m => matchar(m, ['name', 'email', 'role', 'message'], sök));

    $('#msg-antal').textContent = rader.length + ' av ' + S.kontakt.length;
    $('#msg-tabell').innerHTML = tabell([
      { namn: 'Från', rita: m => '<b>' + esc(m.name) + '</b>'
        + '<span class="adm-und">' + esc(m.email) + (m.role ? ' · ' + esc(m.role) : '') + '</span>' },
      { namn: 'Meddelandet', rita: m => esc(m.message) },
      { namn: 'Inkom', rita: m => '<span class="adm-tal">' + esc(kortDatum(m.created_at)) + '</span>' },
      { namn: '', höger: true, rita: m => m.hanterad_at
        ? pill('Hanterad ' + kortDatum(m.hanterad_at), 'ar-klar')
        : '<a class="btn btn-ghost btn-sm" href="mailto:' + esc(m.email)
          + '" data-mailtext="keep" style="margin-right:7px">Svara</a>'
          + '<button class="btn btn-primary btn-sm" data-hanterad="' + m.id + '">Klart</button>' }
    ], rader, bara ? 'Inget ohanterat kvar' : tomtText(sök, 'Inget meddelande matchar filtret', 'Inga meddelanden än'));
  }

  function ritaChattar() {
    $('#chatt-lista').innerHTML = !S.chattar.length
      ? tomt('Inga chattar än', 'Trådarna dyker upp när en matchad familj skriver.')
      : S.chattar.slice(0, 40).map(m => rad(
        namnFör(m.parent_id) + ' ↔ ' + namnFör(m.tutor_id),
        (m.sender_id === m.parent_id ? 'Familjen: ' : 'Studiehjälparen: ') + m.body.slice(0, 120),
        kortDatum(m.created_at))).join('');
  }

  /* ============================================================
     FAMILJER

     Ingen matchning här längre. Den flyttade till sin egen
     sektion när den blev en elevfråga — se kommentaren vid
     kolumnen Studiehjälpare nedan.
     ============================================================ */

  function ritaFamiljer() {
    const sök = $('#fam-sok').value.trim();
    const st = $('#fam-status').value;
    const alla = Object.values(S.personer).filter(p => p.role === 'parent')
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const rader = alla
      .filter(p => !st || (st === 'matched' ? p.match_status === 'matched' : p.match_status !== 'matched'))
      .filter(p => matchar(p, ['full_name', 'email', 'phone'], sök));

    $('#fam-antal').textContent = rader.length + ' av ' + alla.length;
    $('#fam-tabell').innerHTML = tabell([
      { namn: 'Familj', rita: p => '<b>' + esc(p.full_name || '(namn saknas)') + '</b>'
        + '<span class="adm-und">' + esc(p.email || '') + (p.phone ? ' · ' + esc(p.phone) : '') + '</span>' },
      { namn: 'Barn', rita: p => {
        const b = S.elever[p.id] || [];
        return b.length
          ? b.map(e => esc(e.name) + (e.grade ? ' <span style="color:var(--bl-3)">(' + esc(e.grade) + ')</span>' : '')).join('<br>')
          : '<span style="color:var(--bl-3)">Inga inlagda</span>';
      } },
      { namn: 'Pass', rita: p => {
        const n = S.bokningar.filter(b => b.parent_id === p.id && b.status === 'completed').length;
        return '<span class="adm-tal">' + n + '</span>';
      } },
      { namn: 'Studiehjälpare', höger: true, rita: p => {
        /* Här satt förr en rullgardin som skrev
           profiles.matched_tutor_id. Den är borttagen med flit.

           Sedan schema-v14 äger ELEVEN sin matchning, och
           profiles-kolumnen skrivs av en trigger som räknar om
           den ur barnen. En rullgardin här hade alltså varit en
           andra väg att skriva samma sak, som inte höll ihop med
           den första: familjen hade fått en studiehjälpare som
           inget av barnen var kopplat till.

           Två skrivvägar till samma sanning är inte en bekvämlighet,
           det är en bugg som väntar. Här står resultatet, och
           knappen leder dit arbetet faktiskt görs. */
        const barn = S.elever[p.id] || [];
        const matchade = barn.filter(e => e.matched_tutor_id && e.match_status === 'matched');
        const namn = [];
        matchade.forEach(e => {
          const t = S.personer[e.matched_tutor_id];
          const n = t ? (t.full_name || t.email) : null;
          if (n && namn.indexOf(n) === -1) namn.push(n);
        });

        let text;
        if (!barn.length) text = '<span style="color:var(--bl-2)">Inga barn inlagda</span>';
        else if (!matchade.length) text = pill('Ingen matchad', 'ar-ny');
        else if (matchade.length < barn.length) {
          text = esc(namn.join(', ')) + '<span class="adm-und">'
            + matchade.length + ' av ' + barn.length + ' barn matchade</span>';
        } else {
          text = esc(namn.join(', '))
            + (namn.length > 1 ? '<span class="adm-und">olika per barn</span>' : '');
        }

        return text
          + '<span style="display:inline-flex;gap:6px;margin-left:10px;vertical-align:middle">'
          + '<a class="btn btn-ghost btn-sm" href="#matchning">Matcha</a>'
          + '<button class="btn btn-ghost btn-sm" data-not="' + p.id
          + '" title="Anteckningar" aria-label="Anteckningar om ' + esc(p.full_name || p.email || '') + '">✎</button>'
          + '</span>';
      } }
    ], rader, tomtText(sök || st, 'Ingen familj matchar filtret', 'Inga familjer registrerade än'));
  }


  /* ============================================================
     ELEVER

     Eleven är den enhet allt annat hänger på: läxor, material,
     studieplan, rapporter och utveckling bär ett student_id, och
     ett pass bokas åt en elev.

     Sedan schema-v14 gäller det matchningen också: en elev har en
     egen studiehjälpare, och syskon kan ha var sin. Själva
     matchandet sker under Matchning — här visas bara resultatet,
     med en väg dit för den som saknar.
     ============================================================ */

  /* Elevens egen studiehjälpare sedan schema-v14. Föll tidigare
     tillbaka på familjens, vilket var hela problemet: två syskon
     i olika ämnen kunde inte ha var sin. */
  function elevHjälpare(e) {
    if (!e.matched_tutor_id || e.match_status !== 'matched') return null;
    return S.personer[e.matched_tutor_id]
      || { id: e.matched_tutor_id, full_name: null };
  }

  function nästaPassFör(elevId) {
    const idag = isoFor(new Date());
    return S.bokningar
      .filter(b => b.student_id === elevId && b.wanted_date >= idag && b.status !== 'cancelled')
      .sort((a, b) => (a.wanted_date + (a.wanted_time || ''))
        .localeCompare(b.wanted_date + (b.wanted_time || '')))[0] || null;
  }

  function fyllÅrskurser() {
    const sel = $('#elev-ak');
    if (!sel || sel.dataset.fylld) return;
    const åk = [];
    S.elevlista.forEach(e => { if (e.grade && åk.indexOf(e.grade) === -1) åk.push(e.grade); });
    åk.sort();
    sel.insertAdjacentHTML('beforeend',
      åk.map(a => '<option value="' + esc(a) + '">' + esc(a) + '</option>').join(''));
    sel.dataset.fylld = '1';
  }

  function ritaElever() {
    fyllÅrskurser();
    const sök = $('#elev-sok').value.trim();
    const åk = $('#elev-ak').value;
    const m = $('#elev-match').value;

    const alla = S.elevlista.slice()
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

    const rader = alla
      .filter(e => !åk || e.grade === åk)
      .filter(e => !m || (m === 'ja' ? !!elevHjälpare(e) : !elevHjälpare(e)))
      .filter(e => {
        if (!sök) return true;
        const f = S.personer[e.parent_id];
        const text = [e.name, e.grade, e.school, (e.subjects || []).join(' '),
          f && f.full_name, f && f.email].filter(Boolean).join(' ');
        return text.toLowerCase().indexOf(sök.toLowerCase()) !== -1;
      });

    $('#elev-antal').textContent = rader.length + ' av ' + alla.length;
    $('#elev-tabell').innerHTML = tabell([
      { namn: 'Elev', rita: e => '<b>' + esc(e.name || '(namn saknas)') + '</b>'
        + '<span class="adm-und">' + esc([e.grade, e.school].filter(Boolean).join(' · ') || 'Årskurs saknas') + '</span>' },
      { namn: 'Familj', rita: e => {
        const f = S.personer[e.parent_id];
        if (!f) return '<span style="color:var(--bl-2)">Okänd</span>';
        return esc(f.full_name || f.email || '—')
          + '<span class="adm-und">' + esc(f.email || '') + '</span>';
      } },
      { namn: 'Ämnen', rita: e => (e.subjects && e.subjects.length)
        ? esc(e.subjects.join(', '))
        : '<span style="color:var(--bl-2)">Inga angivna</span>' },
      { namn: 'Studiehjälpare', rita: e => {
        const t = elevHjälpare(e);
        if (t) return esc(t.full_name || t.email || '—');
        /* Ett larm som inte går att trycka på är en påminnelse om
           arbete någon annanstans. Den här tar dig dit. */
        return '<a href="#matchning" data-mt-hoppa="' + esc(e.id) + '">'
          + pill('Matcha', 'ar-ny') + '</a>';
      } },
      { namn: 'Nästa pass', rita: e => {
        const b = nästaPassFör(e.id);
        if (!b) return '<span style="color:var(--bl-2)">—</span>';
        return '<span class="adm-tal">' + esc(kortDatum(b.wanted_date)
          + (b.wanted_time ? ' ' + String(b.wanted_time).slice(0, 5) : '')) + '</span>'
          + '<span class="adm-und">' + esc(b.subject || '') + '</span>';
      } },
      { namn: 'Pass', rita: e => {
        const n = S.bokningar.filter(b => b.student_id === e.id && b.status === 'completed').length;
        return '<span class="adm-tal">' + n + '</span>';
      } },
      { namn: '', höger: true, rita: e => {
        const f = S.personer[e.parent_id];
        return f
          ? '<button class="btn btn-ghost btn-sm" data-elev-familj="' + esc(f.id) + '">Öppna familjen</button>'
          : '';
      } }
    ], rader, tomtText(sök || åk || m, 'Ingen elev matchar filtret', 'Inga elever inlagda än'));
  }

  /* Från elevlistan rakt in i matchningen med rätt elev vald.
     Utan det får man leta upp samma elev en gång till i en annan
     lista, vilket är precis det som gör ett system tröttsamt. */
  document.addEventListener('click', e => {
    const k = e.target.closest('[data-mt-hoppa]');
    if (!k) return;
    S.valdElev = k.dataset.mtHoppa;
    ritaMatchning();
  });

  ['#elev-sok', '#elev-ak', '#elev-match'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('input', ritaElever);
  });

  /* Vägen från en elev till familjens rad. Elevens egna uppgifter
     ägs av familjen i studievyn, och noteringarna hänger på
     profilen — alltså på föräldern.

     Fördröjningen är inte kosmetisk: sektionen byts av hashen, och
     noteringspanelen flyttas in i den sektion som är synlig. Görs
     det i samma tick hamnar panelen i en sektion som just blivit
     dold. */
  document.addEventListener('click', e => {
    const k = e.target.closest('[data-elev-familj]');
    if (!k) return;
    const id = k.dataset.elevFamilj;
    location.hash = '#familjer';
    setTimeout(() => {
      const sek = $('section[data-sek="familjer"]');
      if (sek) öppnaNoteringar(id, sek);
    }, 80);
  });


  /* ============================================================
     MATCHNING

     En elev, en studiehjälpare. Inte en familj och en
     studiehjälpare, vilket det var till schema-v14: två syskon
     som läser olika ämnen i olika årskurser ska inte behöva dela.

     RANKNINGEN RÄKNAS HÄR, INTE I SQL

     Det hade varit enklare att sortera i vyn. Men en ORDER BY
     lämnar ut en ordning, och det man behöver när en förälder
     frågar "varför just hen?" är skälen. Därför lämnar
     matchningsunderlag ut rådata, och varje poäng nedan bär med
     sig vad den kom ifrån.

     FYRA VIKTER, OCH VARFÖR JUST DE

       Ämne      50  Utan rätt ämne spelar resten ingen roll.
       Årskurs   30  En duktig gymnasiematematiker är fel person
                     för en femma, och tvärtom.
       Utrymme   12  Den som har fem elever bör inte få en sjätte
                     före den som har noll.
       Erfarenhet 8  Tie-break, inte mer. En ny studiehjälpare är
                     inte sämre, hen är bara oprövad — och att
                     vikta det tungt hade gjort nya omöjliga att
                     komma igång med.

     "VET EJ" ÄR INTE "NEJ"

     En elev utan angivna ämnen har inte fel ämne, vi vet bara
     inte. Sådana kriterier ger halva poängen och märks med ett
     frågetecken i stället för ett kryss. Att ge noll hade
     straffat en elev för att någon glömt fylla i ett fält.
     ============================================================ */

  const VIKT = { amne: 50, arskurs: 30, utrymme: 12, erfarenhet: 8 };

  /* Årskursen kommer in som fritext från två håll som aldrig
     pratat med varandra: elevens "Åk 8" eller "Gymnasiet år 2"
     från studievyns rullgardin, och studiehjälparens "Åk 7–9"
     eller "Gymnasiet" som aldrig skrivits av någon kod alls utan
     står handskrivet i databasen.

     Parsern läser därför siffror och ordet gymnasiet, och bryr
     sig inte om resten. Tankstreck och bindestreck är samma sak
     för den, vilket de inte är för en jämförelse av strängar. */
  function tolkaNiva(text) {
    const t = String(text || '').toLowerCase();
    const gym = t.indexOf('gymnas') !== -1;
    const siffror = (t.match(/\d+/g) || []).map(Number);
    if (gym) return { gym: true, från: siffror[0] || null, till: siffror[1] || siffror[0] || null };
    if (!siffror.length) return null;
    return { gym: false, från: siffror[0], till: siffror.length > 1 ? siffror[1] : siffror[0] };
  }

  function nivåTäcker(tutorNivåer, elevNivå) {
    const e = tolkaNiva(elevNivå);
    if (!e) return null;                     // vet ej
    const lista = (tutorNivåer || []).map(tolkaNiva).filter(Boolean);
    if (!lista.length) return null;          // vet ej
    return lista.some(n => {
      if (e.gym) return n.gym;
      if (n.gym) return false;
      return e.från >= n.från && e.från <= n.till;
    });
  }

  /* Ämnen jämförs normaliserat. "NO / Fysik / Kemi / Biologi" i
     bokningen och "Fysik" hos studiehjälparen ska räknas som en
     träff, så jämförelsen sker på delsträngar åt båda håll. */
  function normalisera(s) {
    return String(s || '').toLowerCase().replace(/[^a-zåäö0-9]+/g, ' ').trim();
  }

  function ämnenSomMöts(elevÄmnen, tutorÄmnen) {
    const e = (elevÄmnen || []).map(normalisera).filter(Boolean);
    const t = (tutorÄmnen || []).map(normalisera).filter(Boolean);
    if (!e.length || !t.length) return null;   // vet ej
    const träffar = e.filter(x => t.some(y => y.indexOf(x) !== -1 || x.indexOf(y) !== -1));
    return { träffar, andel: träffar.length / e.length };
  }

  function poängFör(elev, tutor) {
    const skäl = [];
    let poäng = 0;

    const ä = ämnenSomMöts(elev.subjects, tutor.amnen);
    if (ä === null) {
      poäng += VIKT.amne / 2;
      skäl.push(['vet-ej', elev.subjects && elev.subjects.length
        ? 'Studiehjälparen har inga ämnen angivna'
        : 'Eleven har inga ämnen angivna']);
    } else if (ä.träffar.length) {
      poäng += VIKT.amne * ä.andel;
      skäl.push([ä.andel === 1 ? 'ja' : 'ja',
        ä.andel === 1 ? 'Täcker alla elevens ämnen'
          : 'Täcker ' + ä.träffar.length + ' av ' + (elev.subjects || []).length + ' ämnen']);
    } else {
      skäl.push(['nej', 'Inget gemensamt ämne']);
    }

    const n = nivåTäcker(tutor.arskurser, elev.grade);
    if (n === null) {
      poäng += VIKT.arskurs / 2;
      skäl.push(['vet-ej', elev.grade ? 'Studiehjälparen har inga årskurser angivna' : 'Eleven saknar årskurs']);
    } else if (n) {
      poäng += VIKT.arskurs;
      skäl.push(['ja', 'Undervisar ' + elev.grade]);
    } else {
      skäl.push(['nej', 'Undervisar inte ' + elev.grade]);
    }

    /* Full poäng vid noll elever, ingen vid fem. Taket är satt
       efter vad en gymnasieelev hinner vid sidan av skolan, inte
       efter vad som ser bra ut i en graf. */
    const antal = Number(tutor.antal_elever || 0);
    const utrymme = Math.max(0, 1 - antal / 5);
    poäng += VIKT.utrymme * utrymme;
    skäl.push([antal < 3 ? 'ja' : 'nej',
      antal === 0 ? 'Har inga elever än'
        : antal + (antal === 1 ? ' elev sedan tidigare' : ' elever sedan tidigare')]);

    const pass = Number(tutor.genomforda_pass || 0);
    poäng += VIKT.erfarenhet * Math.min(1, pass / 10);
    if (pass) skäl.push(['ja', pass + (pass === 1 ? ' genomfört pass' : ' genomförda pass')]);
    else skäl.push(['vet-ej', 'Inga genomförda pass än']);

    /* TAKET VID ETT HÅRT NEJ

       Utan det här hände följande med riktig data: en
       studiehjälpare som täckte båda ämnena men INTE elevens
       årskurs hamnade över en som täckte årskursen och halva
       ämnena. Två poängs skillnad, och fel person överst.

       Ämne och årskurs är inte gradvisa kriterier som väger mot
       varandra. Fel årskurs är fel person, hur många pass hen än
       har kört. Ett nej på något av dem kapar därför poängen
       under 50, så att den aldrig kan gå om någon utan hårt nej.

       Skälen står kvar oavsett — man ska kunna se att hen ändå
       kan matteämnena, och överrida om man vet något systemet
       inte vet. */
    const hårtNej = skäl.some(x => x[0] === 'nej'
      && (x[1].indexOf('ämne') !== -1 || x[1].indexOf('Undervisar inte') !== -1));
    if (hårtNej) poäng = Math.min(poäng, 49);

    return { poäng: Math.round(poäng), skäl, hårtNej };
  }

  function skälIkon(sort) {
    if (sort === 'ja') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg>';
    if (sort === 'nej') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.2 9a2.9 2.9 0 1 1 3.6 2.8c-.5.2-.8.7-.8 1.2v.8M12 17h.01"/></svg>';
  }

  /* ------------------------------------------------------------
     KÖN
     ------------------------------------------------------------ */
  function elevMatchad(e) {
    return !!(e.matched_tutor_id && e.match_status === 'matched');
  }

  function ritaMatchKö() {
    const host = $('#mt-ko');
    if (!host) return;
    const sök = ($('#mt-sok') || {}).value ? $('#mt-sok').value.trim().toLowerCase() : '';

    /* Omatchade först. Det är dem man är här för, och att sortera
       dem sist hade betytt att man scrollar förbi tio matchade
       elever varje gång man ska göra det man kom för. */
    const alla = S.elevlista.slice().sort((a, b) => {
      const am = elevMatchad(a), bm = elevMatchad(b);
      if (am !== bm) return am ? 1 : -1;
      return String(a.name || '').localeCompare(String(b.name || ''), 'sv');
    }).filter(e => {
      if (!sök) return true;
      const f = S.personer[e.parent_id];
      return [e.name, e.grade, f && f.full_name].filter(Boolean)
        .join(' ').toLowerCase().indexOf(sök) !== -1;
    });

    const omatchade = S.elevlista.filter(e => !elevMatchad(e)).length;
    $('#mt-ko-antal').textContent = omatchade
      ? omatchade + (omatchade === 1 ? ' väntar' : ' väntar')
      : 'alla matchade';

    if (!alla.length) {
      host.innerHTML = tomt(sök ? 'Ingen elev matchar' : 'Inga elever inlagda än',
        sök ? '' : 'Elever läggs till av familjen i studievyn.');
      return;
    }

    host.innerHTML = '<div class="mt-ko">' + alla.map(e => {
      const f = S.personer[e.parent_id];
      const m = elevMatchad(e);
      return '<button class="mt-elev" type="button" data-mt-elev="' + esc(e.id) + '"'
        + ' aria-pressed="' + (S.valdElev === e.id ? 'true' : 'false') + '">'
        + '<span class="mt-elev-prick' + (m ? ' ar-matchad' : '') + '" aria-hidden="true"></span>'
        + '<span class="mt-elev-text"><b>' + esc(e.name || '(namn saknas)') + '</b>'
        + '<span>' + esc([e.grade, f && (f.full_name || f.email)].filter(Boolean).join(' · ')
          || 'Årskurs saknas') + '</span></span>'
        + '</button>';
    }).join('') + '</div>';
  }

  /* ------------------------------------------------------------
     FÖRSLAGEN
     ------------------------------------------------------------ */
  function ritaMatchPanel() {
    const host = $('#mt-panel');
    if (!host) return;

    const elev = S.elevlista.find(e => e.id === S.valdElev);
    if (!elev) {
      $('#mt-forslag-antal').textContent = '';
      host.innerHTML = tomt('Välj en elev',
        S.elevlista.length ? 'Listan till vänster. Omatchade står överst.'
          : 'Det finns inga elever att matcha än.');
      return;
    }

    /* Vyn matchningsunderlag ligger i schema-v14. Är den inte
       körd säger vi det med filnamnet, i stället för att visa en
       tom lista som läser som "ingen passar". */
    if (S.matchunderlagFel) {
      host.innerHTML = '<div class="empty"><b>Matchningsunderlaget saknas</b><br>'
        + '<span>Vyn <code>matchningsunderlag</code> finns inte i databasen än. Kör '
        + '<code>schema-v14.sql</code> i Supabase → SQL Editor, så fylls den här sidan.</span></div>';
      return;
    }

    const f = S.personer[elev.parent_id];
    const nuvarande = elev.matched_tutor_id;

    const förslag = S.matchunderlag
      .map(t => Object.assign({ tutor: t }, poängFör(elev, t)))
      .sort((a, b) => {
        /* Den nuvarande studiehjälparen ligger alltid först,
           oavsett poäng. Man är här för att se hur den valda
           ligger till, inte för att leta rätt på den. */
        if (a.tutor.tutor_id === nuvarande) return -1;
        if (b.tutor.tutor_id === nuvarande) return 1;
        return b.poäng - a.poäng;
      });

    $('#mt-forslag-antal').textContent = förslag.length
      ? förslag.length + ' godkända' : '';

    const fakta = [];
    if (elev.grade) fakta.push(['', elev.grade]);
    else fakta.push(['ar-tom', 'Årskurs saknas']);
    if (elev.subjects && elev.subjects.length) {
      elev.subjects.forEach(a => fakta.push(['', a]));
    } else {
      fakta.push(['ar-tom', 'Inga ämnen angivna']);
    }
    if (elev.school) fakta.push(['', elev.school]);

    let ut = '<div class="mt-vald">'
      + M.avatar(elev.name || '?', null, {})
      + '<span class="mt-vald-text"><b>' + esc(elev.name || '(namn saknas)') + '</b>'
      + '<span class="xsmall" style="color:var(--bl-2)">Familj: '
      + esc(f ? (f.full_name || f.email || '—') : 'okänd') + '</span>'
      + '<span class="mt-vald-fakta">'
      + fakta.map(x => '<span class="mt-fakta ' + x[0] + '">' + esc(x[1]) + '</span>').join('')
      + '</span></span>'
      + (nuvarande
        ? '<button class="btn btn-ghost btn-sm" type="button" data-mt-loss="' + esc(elev.id) + '">Ta bort matchningen</button>'
        : '')
      + '</div>';

    if (!förslag.length) {
      host.innerHTML = ut + tomt('Inga godkända studiehjälpare',
        'Godkänn någon under Studiehjälpare, så dyker de upp här.');
      return;
    }

    ut += '<div class="mt-forslag">' + förslag.map(x => {
      const t = x.tutor;
      const är = t.tutor_id === nuvarande;
      return '<div class="mt-kort' + (är ? ' ar-nuvarande' : '') + '">'
        + '<div class="mt-kort-topp">'
        + M.avatar(t.namn || '?', null, { liten: true })
        + '<span class="mt-kort-namn"><b>' + esc(t.namn || '—') + '</b>'
        + '<span>' + esc([t.ort, (t.amnen || []).join(', ')].filter(Boolean).join(' · ') || 'Inga ämnen angivna') + '</span></span>'
        + '<span class="mt-poang"><b>' + x.poäng + '%</b>'
        + '<span>' + (x.hårtNej ? 'Passar illa' : 'Passar') + '</span>'
        + '<span class="mt-stapel' + (x.hårtNej ? ' ar-svag' : '') + '">'
        + '<i style="width:' + Math.max(3, x.poäng) + '%"></i></span></span>'
        + '</div>'
        + '<div class="mt-skal">' + x.skäl.map(s =>
          '<span class="ar-' + s[0] + '">' + skälIkon(s[0]) + esc(s[1]) + '</span>').join('') + '</div>'
        + '<div class="mt-kort-fot">'
        + (är
          ? '<span class="mt-nuvarande-marke">Nuvarande</span>'
          /* Den som passar illa får en dämpad knapp, inte en
             saknad. Ibland vet den som sitter här något systemet
             inte vet — familjen känner personen, eller ämnet står
             fel i profilen. Men den ska inte se ut som ett
             självklart val bredvid en som passar. */
          : '<button class="btn btn-sm ' + (x.hårtNej ? 'btn-ghost' : 'btn-primary')
            + '" type="button" data-mt-valj="' + esc(t.tutor_id) + '">Matcha '
            + esc(förnamn(t.namn)) + '</button>')
        + (t.timpris ? '<span class="xsmall">' + esc(NX.kr(t.timpris)) + '/tim</span>' : '')
        + '</div></div>';
    }).join('') + '</div>';

    host.innerHTML = ut;
  }

  function förnamn(namn) {
    return String(namn || '').trim().split(/\s+/)[0] || 'hen';
  }

  /* ------------------------------------------------------------
     HANDLINGARNA
     ------------------------------------------------------------ */
  async function sättMatchning(elevId, tutorId) {
    const elev = S.elevlista.find(e => e.id === elevId);
    if (!elev) return;

    const ok = await skriv('students', elevId, {
      matched_tutor_id: tutorId,
      match_status: tutorId ? 'matched' : 'pending'
    });
    if (!ok) return;

    elev.matched_tutor_id = tutorId;
    elev.match_status = tutorId ? 'matched' : 'pending';

    /* Triggern synka_familjens_match har just skrivit om
       förälderns rad i databasen. Kartan i minnet vet inte om
       det, och familjelistan läser den — alltså räknas samma
       sak om här, med samma regel som triggern. */
    const syskon = S.elevlista.filter(e => e.parent_id === elev.parent_id);
    const först = syskon.filter(elevMatchad)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0];
    const f = S.personer[elev.parent_id];
    if (f) {
      f.matched_tutor_id = först ? först.matched_tutor_id : null;
      f.match_status = först ? 'matched' : 'pending';
    }

    await hämtaMatchunderlag();
    ritaMatchKö();
    ritaMatchPanel();
    ritaElever();
    ritaFamiljer();
    ritaStudiehjalpare();
    await ritaÖversikt();
  }

  document.addEventListener('click', async e => {
    const välj = e.target.closest('[data-mt-elev]');
    if (välj) {
      S.valdElev = välj.dataset.mtElev;
      ritaMatchKö();
      ritaMatchPanel();
      return;
    }

    const matcha = e.target.closest('[data-mt-valj]');
    if (matcha) {
      const elev = S.elevlista.find(x => x.id === S.valdElev);
      const t = S.matchunderlag.find(x => x.tutor_id === matcha.dataset.mtValj);
      if (!elev || !t) return;
      const ja = await bekräfta({
        titel: 'Matcha ' + (elev.name || 'eleven') + ' med ' + (t.namn || 'studiehjälparen') + '?',
        text: 'De får se varandras uppgifter och kan börja boka pass och skriva till varandra.'
          + (elev.matched_tutor_id ? ' Den nuvarande matchningen ersätts.' : '')
          + ' Det går att ändra efteråt.',
        knapp: 'Matcha'
      });
      if (!ja) return;
      await sättMatchning(elev.id, t.tutor_id);
      return;
    }

    const loss = e.target.closest('[data-mt-loss]');
    if (loss) {
      const elev = S.elevlista.find(x => x.id === loss.dataset.mtLoss);
      if (!elev) return;
      const ja = await bekräfta({
        titel: 'Ta bort matchningen för ' + (elev.name || 'eleven') + '?',
        text: 'De slutar se varandras uppgifter. Bokade pass, läxor och rapporter ligger kvar '
          + 'i databasen men blir oåtkomliga för studiehjälparen.',
        knapp: 'Ta bort'
      });
      if (!ja) return;
      await sättMatchning(elev.id, null);
    }
  });

  const mtSök = $('#mt-sok');
  if (mtSök) mtSök.addEventListener('input', ritaMatchKö);

  function ritaMatchning() {
    ritaMatchKö();
    ritaMatchPanel();
  }

  /* ============================================================
     STUDIEHJÄLPARE
     ============================================================ */

  function ritaStudiehjalpare() {
    const sök = $('#sh-sok').value.trim();
    const st = $('#sh-status').value;
    const alla = Object.values(S.tutorProfiler)
      .map(t => ({ ...t, namn: namnFör(t.id), epost: (S.personer[t.id] || {}).email || '' }))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const rader = alla
      .filter(t => !st || t.status === st)
      .filter(t => matchar({ ...t, amnen: (t.subjects || []).join(' ') },
        ['namn', 'epost', 'city', 'school', 'amnen'], sök));

    $('#sh-antal').textContent = rader.length + ' av ' + alla.length;
    $('#sh-tabell').innerHTML = tabell([
      { namn: 'Namn', rita: t => '<b>' + esc(t.namn) + '</b>'
        + '<span class="adm-und">' + esc(t.epost) + (t.age ? ' · ' + t.age + ' år' : '') + '</span>' },
      { namn: 'Ort & skola', rita: t => esc(t.city || '—')
        + (t.school ? '<span class="adm-und">' + esc(t.school) + '</span>' : '') },
      { namn: 'Ämnen', rita: t => esc((t.subjects || []).join(', ') || '—') },
      /* Två tal i en kolumn. Var två, och tabellen sköt då ut sista
         kolumnen ur rutan på en vanlig skärm — och "elever" och
         "genomförda pass" läses ändå alltid tillsammans. */
      { namn: 'Elever / pass', rita: t => {
        const elever = Object.values(S.personer).filter(p => p.matched_tutor_id === t.id).length;
        const pass = S.bokningar.filter(b => b.tutor_id === t.id && b.status === 'completed').length;
        return '<span class="adm-tal">' + elever + ' / ' + pass + '</span>';
      } },
      { namn: 'Timpenning', rita: t => t.hourly_rate
        ? '<span class="adm-tal">' + esc(NX.kr(t.hourly_rate)) + '</span>'
        : '<span style="color:var(--bl-3)">Ej satt</span>' },
      { namn: 'Läge', höger: true, rita: t => väljare('sh', SH_LAGE, t.status, 'data-sh="' + t.id + '"')
        + '<button class="btn btn-ghost btn-sm" style="margin-left:6px" data-not="' + t.id
        + '" title="Anteckningar" aria-label="Anteckningar om ' + esc(t.namn) + '">✎</button>' }
    ], rader, tomtText(sök || st, 'Ingen studiehjälpare matchar filtret', 'Inga studiehjälpare registrerade än'));
  }

  /* ============================================================
     BOKNINGAR
     ============================================================ */

  function ritaBokningar() {
    const sök = $('#bok-sok').value.trim();
    const st = $('#bok-status').value;
    const när = $('#bok-nar').value;
    const idag = isoFor(new Date());

    const rader = S.bokningar
      .filter(b => !st || b.status === st)
      .filter(b => när === 'alla' || (när === 'framat' ? b.wanted_date >= idag : b.wanted_date < idag))
      .map(b => ({ ...b, familj: namnFör(b.parent_id), hjalpare: namnFör(b.tutor_id) }))
      .filter(b => matchar(b, ['familj', 'hjalpare', 'subject', 'format'], sök));

    $('#bok-antal').textContent = rader.length + ' av ' + S.bokningar.length;
    $('#bok-tabell').innerHTML = tabell([
      { namn: 'När', rita: b => '<b>' + esc(kortDatum(b.wanted_date)) + '</b>'
        + '<span class="adm-und">' + esc(b.wanted_time ? String(b.wanted_time).slice(0, 5) : '')
        + ' · ' + ((b.duration_min || 60) / 60) + ' h</span>' },
      { namn: 'Familj', rita: b => esc(b.familj) },
      { namn: 'Studiehjälpare', rita: b => esc(b.hjalpare) },
      { namn: 'Ämne', rita: b => esc(b.subject || '—')
        + (b.format ? '<span class="adm-und">' + esc(b.format) + '</span>' : '') },
      { namn: 'Läge', rita: b => läge(BOK_LAGE, b.status)
        + (b.attendance === 'franvarande' ? ' ' + pill('Uteblev', 'ar-ny') : '') },
      { namn: '', höger: true, rita: b => (b.status === 'requested' || b.status === 'confirmed')
        ? '<button class="btn btn-ghost btn-sm" data-avboka="' + b.id + '">Avboka</button>'
        : '' }
    ], rader, tomtText(sök || st, 'Ingen bokning matchar filtret', 'Inga bokningar än'));
  }

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

  function ritaPris() {
    const öre = S.pris ? S.pris.pris_per_timme_ore : (NX.CFG.PRIS_PER_TIMME || 379) * 100;
    $('#pris-kr').value = Math.round(öre / 100);
    $('#kor-pris').textContent = kronor(öre);
    $('#pris-uppdaterad').textContent = S.pris && S.pris.uppdaterad
      ? 'ändrat ' + kortDatum(S.pris.uppdaterad) : '';
  }

  function ritaFel() {
    $('#fel-antal').textContent = S.klientfel.length ? S.klientfel.length + ' st' : '';
    märkFlik('#flik-fel-mark', S.klientfel.length);
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
  }

  /* ============================================================
     ANTECKNINGAR

     En panel under tabellen, inte en modal. Anteckningar skrivs
     medan man läser raden bredvid — en ruta som lägger sig över
     tabellen döljer just det man antecknar om.

     Det som står här läses aldrig av den det gäller. Hela
     admin_noteringar är stängd utom för admin, så det finns ingen
     väg dit ens av misstag. Det är också därför den är en egen
     tabell och inte en kolumn på profiles: RLS är radbaserad, och
     en kolumn på en rad som den matchade motparten får läsa hade
     följt med ut.
     ============================================================ */
  /* Ett enda panelelement som flyttas dit knappen trycktes. Två
     paneler med samma id hade varit ogiltig markup, och två med
     olika id hade betytt två uppsättningar kod som gör samma sak. */
  const notPanel = document.createElement('div');
  notPanel.id = 'not-panel';
  notPanel.hidden = true;

  async function öppnaNoteringar(profilId, iSektion) {
    const panel = notPanel;
    if (iSektion) iSektion.appendChild(panel);

    /* Andra klicket på samma person stänger. En panel som bara går
       att öppna blir liggande kvar och pekar på fel rad. */
    if (S.valdPerson === profilId && !panel.hidden) {
      panel.hidden = true;
      S.valdPerson = null;
      return;
    }
    S.valdPerson = profilId;
    panel.hidden = false;
    panel.innerHTML = '<div class="dbox" style="margin-top:clamp(16px,1.8vw,22px)">'
      + '<h5>Anteckningar om ' + esc(namnFör(profilId)) + '</h5>' + laddar() + '</div>';

    const { data, error } = await supa.from('admin_noteringar')
      .select('id, text, skriven_av, created_at')
      .eq('om_profil', profilId).order('created_at', { ascending: false });

    const lista = error
      ? tomt('Kunde inte hämta anteckningarna',
          felText(error) + ' — är schema-v13.sql kört?')
      : (data || []).length
        ? (data || []).map(n => '<div class="mat" style="grid-template-columns:1fr auto">'
            + '<span class="mat-vad"><b>' + esc(n.text) + '</b>'
            + '<span>' + esc(namnFör(n.skriven_av)) + ' · ' + esc(kortDatum(n.created_at)) + '</span></span>'
            + '</div>').join('')
        : tomt('Inga anteckningar än', 'Det som skrivs här ser bara ledningen.');

    panel.innerHTML = '<div class="dbox" style="margin-top:clamp(16px,1.8vw,22px)">'
      + '<h5>Anteckningar om ' + esc(namnFör(profilId))
      + ' <em>bara ledningen ser dem</em></h5>'
      + '<div style="max-height:32vh;overflow:auto">' + lista + '</div>'
      + '<div class="fgroup" style="margin-top:16px">'
      + '<label for="not-text">Ny anteckning</label>'
      + '<textarea class="inp" id="not-text" style="min-height:70px" '
      + 'placeholder="t.ex. Ringde 3/9, vill helst tisdagar."></textarea></div>'
      + '<div class="vy-knapprad">'
      + '<button class="btn btn-primary btn-sm" type="button" id="not-spara">Spara anteckningen</button>'
      + '<button class="btn btn-ghost btn-sm" type="button" id="not-stang">Stäng</button>'
      + '</div><p class="ok-msg" id="not-msg"></p></div>';
  }

  document.addEventListener('click', async e => {
    if (e.target.closest('#not-stang')) {
      notPanel.hidden = true;
      S.valdPerson = null;
      return;
    }
    const spara = e.target.closest('#not-spara');
    if (!spara) return;
    const text = ($('#not-text').value || '').trim();
    const msg = $('#not-msg');
    rensa(msg);
    if (!text) { säg(msg, 'Skriv något först.', false); return; }
    await medan(spara, 'Sparar…', async () => {
      const { error } = await supa.from('admin_noteringar').insert({
        om_profil: S.valdPerson, text, skriven_av: S.user.id
      });
      if (error) { säg(msg, 'Kunde inte spara: ' + felText(error), false); return; }
      const vem = S.valdPerson;
      S.valdPerson = null;          // tvinga en omritning i stället för en stängning
      await öppnaNoteringar(vem, null);
    });
  });

  /* ============================================================
     HANDLINGARNA
     Allt som ändrar något går genom en delegerad lyssnare. En
     lyssnare per knapp hade behövt kopplas om varje gång en
     tabell ritas om, och det är precis då de tappas bort.
     ============================================================ */

  /* supabase-js lägger edge-funktionens felkropp i error.context, inte
     i meddelandet. Utan det här ser varje fel likadant ut — "Edge
     Function returned a non-2xx status code" — och den som tryckte får
     veta att något gick fel men aldrig vad. Serverns svar säger till
     exempel att familjen saknar e-postadress, eller att domänen inte
     är verifierad hos Resend. Det är skillnaden mellan ett fel man kan
     åtgärda och ett man måste felsöka. */
  async function funktionsFel(fel) {
    if (typeof fel === 'string') return fel;
    if (fel && fel.context && typeof fel.context.json === 'function') {
      try {
        const kropp = await fel.context.json();
        if (kropp && kropp.error) return kropp.error;
      } catch (_) { /* svaret var inte JSON — fall igenom */ }
    }
    return (fel && fel.message) || 'Okänt fel.';
  }

  async function skriv(tabellNamn, id, fält, efteråt) {
    const { error } = await supa.from(tabellNamn).update(fält).eq('id', id);
    if (error) { alert('Kunde inte spara: ' + felText(error)); return false; }
    if (efteråt) efteråt();
    return true;
  }

  document.addEventListener('change', async e => {
    const el = e.target;

    if (el.dataset && el.dataset.lead) {
      const l = S.leads.find(x => x.id === el.dataset.lead);
      const gammal = l.status;
      l.status = el.value;
      if (!await skriv('leads', l.id, { status: el.value })) l.status = gammal;
      ritaLeads(); ritaÖversikt();
      return;
    }

    if (el.dataset && el.dataset.ans) {
      const a = S.ansokningar.find(x => x.id === el.dataset.ans);
      const gammal = a.status;
      a.status = el.value;
      if (!await skriv('applications', a.id, { status: el.value })) a.status = gammal;
      ritaAnsokningar(); ritaÖversikt();
      return;
    }

    if (el.dataset && el.dataset.sh) {
      const t = S.tutorProfiler[el.dataset.sh];
      const gammal = t.status;
      t.status = el.value;
      if (!await skriv('tutor_profiles', t.id, { status: el.value })) t.status = gammal;
      ritaStudiehjalpare(); ritaFamiljer(); ritaÖversikt();
      return;
    }

    /* Här låg hanteraren för familjens matchningsrullgardin. Den
       är borttagen tillsammans med rullgardinen: sedan schema-v14
       ägs matchningen av eleven, och profiles.matched_tutor_id
       skrivs av en trigger. Se kommentaren i ritaFamiljer. */

    /* Fakturans läge. Tidsstämplarna sätts av läget, inte av
       handen: "betald" utan betald_at är en rad ingen kan följa
       upp i efterhand. */
    if (el.dataset && el.dataset.fakt) {
      const f = S.fakturor.find(x => x.id === el.dataset.fakt);
      const nu = new Date().toISOString();
      const fält = { status: el.value };
      if (el.value === 'betald' && !f.betald_at) fält.betald_at = nu;
      if (el.value === 'skickad' && !f.skickad_at) fält.skickad_at = nu;
      if (el.value === 'utkast') { fält.betald_at = null; fält.skickad_at = null; }
      Object.assign(f, fält);
      await skriv('invoices', f.id, fält);
      ritaFakturor(); ritaÖversikt();
      return;
    }

    if (el.dataset && el.dataset.utb) {
      const u = S.utbetalningar.find(x => x.id === el.dataset.utb);
      const fält = { status: el.value };
      if (el.value === 'utbetald' && !u.utbetald_at) fält.utbetald_at = new Date().toISOString();
      if (el.value === 'utkast') fält.utbetald_at = null;
      Object.assign(u, fält);
      await skriv('payouts', u.id, fält);
      ritaUtbetalningar(); ritaÖversikt();
      return;
    }
  });

  document.addEventListener('click', async e => {
    if (e.target.closest('[data-logout]')) {
      if (supa) await supa.auth.signOut();
      location.reload();
      return;
    }

    const hanterad = e.target.closest('[data-hanterad]');
    if (hanterad) {
      const m = S.kontakt.find(x => x.id === hanterad.dataset.hanterad);
      await medan(hanterad, 'Sparar…', async () => {
        const fält = { hanterad_at: new Date().toISOString(), hanterad_av: S.user.id };
        if (await skriv('contact_messages', m.id, fält)) Object.assign(m, fält);
        ritaKontakt(); ritaÖversikt();
      });
      return;
    }

    const avboka = e.target.closest('[data-avboka]');
    if (avboka) {
      const b = S.bokningar.find(x => x.id === avboka.dataset.avboka);
      const ja = await bekräfta({
        titel: 'Avboka passet?',
        text: kortDatum(b.wanted_date) + ' hos ' + namnFör(b.tutor_id) + '. Både familjen och '
          + 'studiehjälparen ser ändringen direkt, och passet faktureras inte.',
        knapp: 'Avboka'
      });
      if (!ja) return;
      await medan(avboka, 'Avbokar…', async () => {
        b.status = 'cancelled';
        await skriv('bookings', b.id, { status: 'cancelled' });
        ritaBokningar(); ritaÖversikt();
      });
      return;
    }

    /* ============ SKICKA FAKTURA ELLER UNDERLAG ============
       Två anrop till samma edge-funktion. Det första är en
       torrkörning som svarar med vad mottagaren KOMMER att läsa;
       det andra skickar. Ett mejl som lämnat huset går inte att
       ångra, så det ska gå att läsa igenom först.

       Statusen sätts av servern, och bara om Resend svarat att
       mejlet gick iväg. Rullgardinen här bredvid ändrar bara ordet
       i tabellen — det är två olika saker och de ska förbli det. */
    const skicka = e.target.closest('[data-skicka]');
    if (skicka) {
      const typ = skicka.dataset.skicka;
      const id = skicka.dataset.id;
      const påminnelse = skicka.dataset.paminnelse === '1';

      const prov = await medan(skicka, 'Hämtar…', () =>
        supa.functions.invoke('faktura-utskick',
          { body: { typ, id, paminnelse: påminnelse, torrkorning: true } }));

      const fel = prov.error || (prov.data && prov.data.error);
      if (fel) { alert(await funktionsFel(fel)); return; }

      const ja = await bekräfta({
        titel: påminnelse ? 'Skicka påminnelse?'
          : typ === 'faktura' ? 'Skicka fakturan?' : 'Skicka underlaget?',
        text: 'Går till ' + prov.data.till + '. Så här ser det ut:',
        forhandsvisning: prov.data.text,
        knapp: 'Skicka nu'
      });
      if (!ja) return;

      await medan(skicka, 'Skickar…', async () => {
        const res = await supa.functions.invoke('faktura-utskick',
          { body: { typ, id, paminnelse: påminnelse } });
        const f2 = res.error || (res.data && res.data.error);
        if (f2) { alert(await funktionsFel(f2)); return; }
        if (res.data && res.data.varning) alert('⚠️ ' + res.data.varning);

        /* Servern har ändrat statusen. Hämta om raden i stället för
           att gissa vad den blev — gissar vi fel står tabellen och
           ljuger tills någon laddar om sidan. */
        if (typ === 'faktura' && !påminnelse) {
          const { data } = await supa.from('invoices').select('*').eq('id', id).maybeSingle();
          if (data) {
            const i = S.fakturor.findIndex(x => x.id === id);
            if (i !== -1) S.fakturor[i] = data;
          }
          ritaFakturor();
          await ritaÖversikt();
        }
        alert('✓ Skickat till ' + res.data.till + '.');
      });
      return;
    }

    const not = e.target.closest('[data-not]');
    if (not) { await öppnaNoteringar(not.dataset.not, not.closest('section[data-sek]')); return; }

    const felbort = e.target.closest('[data-felbort]');
    if (felbort) {
      const { error } = await supa.from('klientfel').delete().eq('id', felbort.dataset.felbort);
      if (error) { alert('Kunde inte rensa: ' + felText(error)); return; }
      S.klientfel = S.klientfel.filter(f => f.id !== felbort.dataset.felbort);
      ritaFel();
      return;
    }
  });

  /* Sök- och filterfälten. input, inte change: en lista som
     uppdateras när man tappar fokus känns trasig. */
  [['#leads-sok', ritaLeads], ['#leads-status', ritaLeads],
   ['#ans-sok', ritaAnsokningar], ['#ans-status', ritaAnsokningar],
   ['#msg-sok', ritaKontakt], ['#msg-ohanterade', ritaKontakt],
   ['#fam-sok', ritaFamiljer], ['#fam-status', ritaFamiljer],
   ['#sh-sok', ritaStudiehjalpare], ['#sh-status', ritaStudiehjalpare],
   ['#bok-sok', ritaBokningar], ['#bok-status', ritaBokningar], ['#bok-nar', ritaBokningar],
   ['#fakt-sok', ritaFakturor], ['#fakt-status', ritaFakturor],
   ['#utb-sok', ritaUtbetalningar], ['#utb-status', ritaUtbetalningar]
  ].forEach(([sel, fn]) => {
    const el = $(sel);
    if (el) el.addEventListener('input', fn);
  });

  /* ============ priset ============ */
  $('#pris-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#pris-msg');
    rensa(msg);
    const kr = Number($('#pris-kr').value);
    if (!kr || kr < 1) { säg(msg, 'Fyll i ett pris i hela kronor.', false); return; }

    const ja = await bekräfta({
      titel: 'Ändra priset till ' + kr + ' kr i timmen?',
      text: 'Gäller nya fakturarader. Redan skapade rader behåller sitt pris — en '
        + 'prisändring får aldrig ändra vad någon redan fakturerats. Kom ihåg att ändra '
        + 'priset på prissidan, i FAQ:n och i användarvillkoren också.',
      knapp: 'Ändra priset'
    });
    if (!ja) return;

    await medan($('#pris-spara'), 'Sparar…', async () => {
      const { error } = await supa.from('prissattning')
        .update({ pris_per_timme_ore: kr * 100, uppdaterad: new Date().toISOString() })
        .eq('id', true);
      if (error) { säg(msg, 'Kunde inte spara: ' + felText(error), false); return; }
      S.pris = { pris_per_timme_ore: kr * 100, uppdaterad: new Date().toISOString() };
      ritaPris();
      säg(msg, '✓ Priset är ändrat. Glöm inte de publika sidorna.', true);
    });
  });

  /* ============ inloggning ============ */
  $('#auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#auth-msg'), knapp = $('#auth-submit');
    rensa(msg);
    if (!supa) { säg(msg, 'Databasen är inte kopplad. Fyll i nextrum-config.js.', false); return; }

    const epost = $('#a-email').value.trim();
    const lösen = $('#a-pass').value;
    if (!epost || !lösen) { säg(msg, 'Fyll i e-post och lösenord.', false); return; }

    knapp.setAttribute('aria-busy', 'true');
    const res = await supa.auth.signInWithPassword({ email: epost, password: lösen });
    knapp.removeAttribute('aria-busy');

    if (res.error) {
      säg(msg, res.error.message === 'Invalid login credentials'
        ? 'Fel e-post eller lösenord.' : felText(res.error), false);
      return;
    }
    location.reload();
  });

  /* ============ header ============ */
  /* ============================================================
     SKALET
     Topprad, global sök, notiser, hopfällbar sidomeny och menyns
     fot. Fyra saker som gäller hela vyn och ingen enskild sektion.
     ============================================================ */

  const SEKTIONSNAMN = {
    oversikt: 'Översikt', leads: 'Intresseanmälningar', ansokningar: 'Ansökningar',
    meddelanden: 'Meddelanden', familjer: 'Familjer', elever: 'Elever',
    studiehjalpare: 'Studiehjälpare', matchning: 'Matchning', bokningar: 'Bokningar',
    ekonomi: 'Fakturor & utbetalningar', system: 'System'
  };

  function ritaVar() {
    const sek = String(location.hash || '').replace(/^#/, '').split('/')[0] || 'oversikt';
    const el = $('#adm-var');
    if (el) el.textContent = SEKTIONSNAMN[sek] || 'Översikt';
  }

  /* ------------------------------------------------------------
     HOPFÄLLD SIDOMENY
     Valet sparas per webbläsare. Den som jobbar på en liten skärm
     vill ha den hopfälld varje dag, inte varje gång.
     ------------------------------------------------------------ */
  const FALL_NYCKEL = 'nx-admin-meny-hopfalld';

  function sättFall(hopfälld) {
    const layout = $('#adm-layout'), knapp = $('#adm-fall');
    if (!layout || !knapp) return;
    layout.classList.toggle('ar-hopfalld', hopfälld);
    knapp.setAttribute('aria-expanded', hopfälld ? 'false' : 'true');
    knapp.setAttribute('aria-label', hopfälld ? 'Fäll ut menyn' : 'Fäll ihop menyn');
    try { localStorage.setItem(FALL_NYCKEL, hopfälld ? '1' : '0'); } catch (e) {}
  }

  function startaFall() {
    const knapp = $('#adm-fall');
    if (!knapp) return;
    let sparat = '0';
    try { sparat = localStorage.getItem(FALL_NYCKEL) || '0'; } catch (e) {}
    sättFall(sparat === '1');
    knapp.addEventListener('click', () => {
      sättFall(!$('#adm-layout').classList.contains('ar-hopfalld'));
    });
  }

  /* ------------------------------------------------------------
     MENYNS FOT
     ------------------------------------------------------------ */
  function ritaSidofot() {
    const host = $('#adm-sido-fot');
    if (!host || !S.profil) return;
    const namn = S.profil.full_name || S.user.email;
    host.hidden = false;
    host.innerHTML = M.avatar(namn, S.profil.avatar_url || null, { liten: true })
      + '<span class="adm-sido-fot-text"><b>' + esc(namn) + '</b><span>Admin</span></span>'
      + '<button class="adm-sido-ut" type="button" data-logout title="Logga ut" aria-label="Logga ut">'
      + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4.5H5.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H9"/>'
      + '<path d="M15.5 8.5 19 12l-3.5 3.5M19 12H9"/></svg></button>';
  }

  /* ------------------------------------------------------------
     PANELERNA
     Sök och notiser öppnar var sin. Bara en åt gången, och ett
     klick utanför stänger — samma regel för båda, så att det
     bara finns ett sätt att stänga något.
     ------------------------------------------------------------ */
  function stängPaneler(utom) {
    [['#adm-sokresultat', '#adm-sok'], ['#adm-notiser', '#adm-notis-knapp']].forEach(par => {
      if (par[0] === utom) return;
      const p = $(par[0]), k = $(par[1]);
      if (p) p.hidden = true;
      if (k) k.setAttribute('aria-expanded', 'false');
    });
  }

  document.addEventListener('click', e => {
    if (e.target.closest('.adm-verktygsfalt')) return;
    stängPaneler(null);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') stängPaneler(null);
  });

  /* ------------------------------------------------------------
     GLOBAL SÖK
     Går mot det som redan ligger i minnet. Ingen fråga till
     databasen per tangenttryck: allt adminvyn kan visa är redan
     hämtat, och en sökning som är klar innan fingret lämnat
     tangenten slår en som är korrekt men kommer en halv sekund
     senare.

     Träffarna är typade. Två personer kan heta samma sak, och
     "Adam" kan vara både en elev och en familj.
     ------------------------------------------------------------ */
  const SOK_IKON = {
    Familj: '<circle cx="8.5" cy="8" r="3"/><path d="M3 19c0-2.8 2.5-4.5 5.5-4.5S14 16.2 14 19"/><path d="M16 5.5a3 3 0 0 1 0 5.8M21 19c0-2.2-1.4-3.7-3.5-4.3"/>',
    Elev: '<circle cx="12" cy="7.5" r="3.2"/><path d="M4.5 20c0-3.4 3.2-5.5 7.5-5.5s7.5 2.1 7.5 5.5"/>',
    Studiehjälpare: '<path d="M4 6.5h7v12H4z"/><path d="M13 6.5h7v12h-7z"/><path d="M11 9.5h2M11 13h2"/>',
    Anmälan: '<path d="M3.5 7.5h17v11h-17z"/><path d="m3.5 8 8.5 6 8.5-6"/>',
    Ansökan: '<path d="M6 3.5h8l4 4V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20z"/><path d="M9 12h6M9 16h4"/>',
    Bokning: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3.5v3M16 3.5v3"/>'
  };

  function träffar(sök) {
    const s = sök.toLowerCase();
    const i = text => String(text || '').toLowerCase().indexOf(s) !== -1;
    const ut = [];

    Object.values(S.personer).forEach(p => {
      if (!i(p.full_name) && !i(p.email) && !i(p.phone)) return;
      const typ = p.role === 'tutor' ? 'Studiehjälpare' : 'Familj';
      ut.push({ typ, namn: p.full_name || p.email || '—',
        under: p.email || '', till: p.role === 'tutor' ? '#studiehjalpare' : '#familjer' });
    });

    S.elevlista.forEach(e => {
      if (!i(e.name) && !i(e.school) && !i((e.subjects || []).join(' '))) return;
      const f = S.personer[e.parent_id];
      ut.push({ typ: 'Elev', namn: e.name,
        under: [e.grade, f && (f.full_name || f.email)].filter(Boolean).join(' · '),
        till: '#elever' });
    });

    S.leads.forEach(l => {
      if (!i(l.parent_name) && !i(l.email) && !i(l.child_name)) return;
      ut.push({ typ: 'Anmälan', namn: l.parent_name || l.email || '—',
        under: [l.child_name, l.subject].filter(Boolean).join(' · '), till: '#leads' });
    });

    S.ansokningar.forEach(a => {
      if (!i(a.name) && !i(a.email) && !i(a.school)) return;
      ut.push({ typ: 'Ansökan', namn: a.name || a.email || '—',
        under: [a.school, a.subjects].filter(Boolean).join(' · '), till: '#ansokningar' });
    });

    S.bokningar.forEach(b => {
      const elev = elevNamn(b.student_id);
      if (!i(b.subject) && !i(elev) && !i(namnFör(b.parent_id)) && !i(namnFör(b.tutor_id))) return;
      ut.push({ typ: 'Bokning', namn: (b.subject || 'Pass') + ' · ' + kortDatum(b.wanted_date),
        under: (elev || namnFör(b.parent_id)) + ' → ' + namnFör(b.tutor_id), till: '#bokningar' });
    });

    return ut;
  }

  function ritaSok() {
    const fält = $('#adm-sok'), panel = $('#adm-sokresultat');
    if (!fält || !panel) return;
    const sök = fält.value.trim();

    if (sök.length < 2) {
      panel.hidden = true;
      fält.setAttribute('aria-expanded', 'false');
      return;
    }

    const alla = träffar(sök);
    panel.hidden = false;
    fält.setAttribute('aria-expanded', 'true');

    if (!alla.length) {
      panel.innerHTML = '<div class="adm-panel-tom">Inget matchar <b>' + esc(sök) + '</b>.<br>'
        + 'Söket går mot namn, e-post, skola och ämne.</div>';
      return;
    }

    panel.innerHTML = '<div class="adm-panel-rubrik"><span>'
      + alla.length + (alla.length === 1 ? ' träff' : ' träffar') + '</span></div>'
      + alla.slice(0, 12).map(t =>
        '<a class="adm-rad" href="' + esc(t.till) + '" data-stang-sok>'
        + '<span class="adm-rad-ikon"><svg viewBox="0 0 24 24" aria-hidden="true">'
        + (SOK_IKON[t.typ] || '') + '</svg></span>'
        + '<span class="adm-rad-text"><b>' + esc(t.namn) + '</b>'
        + (t.under ? '<span>' + esc(t.under) + '</span>' : '') + '</span>'
        + '<span class="adm-rad-typ">' + esc(t.typ) + '</span>'
        + '</a>').join('')
      + (alla.length > 12
        ? '<div class="adm-panel-tom" style="padding:10px 12px 14px">'
          + (alla.length - 12) + ' till. Skriv mer för att smalna av.</div>'
        : '');
  }

  (function startaSok() {
    const fält = $('#adm-sok');
    if (!fält) return;
    fält.addEventListener('input', () => { stängPaneler('#adm-sokresultat'); ritaSok(); });
    fält.addEventListener('focus', ritaSok);
    document.addEventListener('click', e => {
      if (!e.target.closest('[data-stang-sok]')) return;
      fält.value = '';
      $('#adm-sokresultat').hidden = true;
      fält.setAttribute('aria-expanded', 'false');
    });
  })();

  /* ------------------------------------------------------------
     NOTISER
     Härledda ur samma arbetskö som Översikt visar, plus de senaste
     händelserna ur flödet. Ingen notistabell: en sådan kräver att
     någon skriver till den vid varje händelse och blir tyst fel
     den dagen någon glömmer.

     Vad som är LÄST sparas däremot lokalt, för det är det enda
     som inte går att härleda ur datan. Nyckeln är tidsstämpeln på
     den senaste händelsen man sett.
     ------------------------------------------------------------ */
  const LAST_NYCKEL = 'nx-admin-notiser-lasta';

  function läsMarkering() {
    try { return localStorage.getItem(LAST_NYCKEL) || ''; } catch (e) { return ''; }
  }

  function byggNotiser() {
    const sedd = läsMarkering();
    const ut = S.attGora.map(p => ({
      larm: true, när: '',
      rubrik: p.antal + ' ' + (p.antal === 1 ? p.ental : p.rubrik),
      under: p.under, till: p.till
    }));
    byggFlöde().slice(0, 6).forEach(h => {
      if (sedd && String(h.när) <= sedd) return;
      ut.push({ larm: false, när: närText(h.när), rubrik: h.rubrik, under: h.under, till: '#oversikt' });
    });
    return ut;
  }

  function ritaNotiser() {
    const knapp = $('#adm-notis-knapp'), panel = $('#adm-notiser');
    if (!knapp || !panel) return;

    const alla = byggNotiser();
    let prick = knapp.querySelector('.adm-prick');
    if (alla.length && !prick) {
      prick = document.createElement('span');
      prick.className = 'adm-prick';
      prick.setAttribute('aria-hidden', 'true');
      knapp.appendChild(prick);
    } else if (!alla.length && prick) {
      prick.remove();
    }
    knapp.setAttribute('aria-label', alla.length ? alla.length + ' notiser' : 'Notiser');

    if (!alla.length) {
      panel.innerHTML = '<div class="adm-panel-tom">Inget nytt.<br>'
        + 'Anmälningar, bokningar och betalningar dyker upp här.</div>';
      return;
    }

    panel.innerHTML = '<div class="adm-panel-rubrik"><span>Notiser</span>'
      + '<button type="button" id="adm-notis-lasta">Markera som lästa</button></div>'
      + alla.map(n =>
        '<a class="adm-rad' + (n.larm ? ' ar-larm' : '') + '" href="' + esc(n.till) + '" data-stang-notis>'
        + '<span class="adm-rad-ikon"><svg viewBox="0 0 24 24" aria-hidden="true">'
        + (n.larm
          ? '<path d="M12 8.5v4M12 16h.01"/><circle cx="12" cy="12" r="9"/>'
          : '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>')
        + '</svg></span>'
        + '<span class="adm-rad-text"><b>' + esc(n.rubrik) + '</b>'
        + '<span>' + esc(n.under) + '</span></span>'
        + (n.när ? '<span class="adm-rad-nar">' + esc(n.när) + '</span>' : '')
        + '</a>').join('');
  }

  (function startaNotiser() {
    const knapp = $('#adm-notis-knapp');
    if (!knapp) return;
    knapp.addEventListener('click', () => {
      const panel = $('#adm-notiser');
      const öppen = !panel.hidden;
      stängPaneler('#adm-notiser');
      panel.hidden = öppen;
      knapp.setAttribute('aria-expanded', öppen ? 'false' : 'true');
    });

    document.addEventListener('click', e => {
      if (e.target.closest('[data-stang-notis]')) { stängPaneler(null); return; }
      if (!e.target.closest('#adm-notis-lasta')) return;
      /* Läst betyder "jag har sett allt fram till nu". Arbetskön
         står kvar oavsett — den försvinner när arbetet är gjort,
         inte när någon tittat på den. */
      const senaste = (byggFlöde()[0] || {}).när;
      try { localStorage.setItem(LAST_NYCKEL, senaste || new Date().toISOString()); } catch (err) {}
      ritaNotiser();
    });
  })();

  function ritaHeader() {
    const na = $('#nav-actions'), ma = $('#m-actions');
    if (!S.user) { na.innerHTML = ''; ma.innerHTML = ''; return; }
    const namn = (S.profil && S.profil.full_name) || S.user.email;
    na.innerHTML = '<span class="who-chip">' + M.avatar(namn, null, { liten: true })
      + '<b>' + esc(namn) + '</b><span class="roll">Admin</span></span>'
      + '<button class="btn btn-ghost btn-sm" data-logout>Logga ut</button>';
    ma.innerHTML = '<button class="btn btn-ghost btn-block" data-logout>Logga ut</button>';
  }

  function visaFel(fel, vad) {
    visa('view-fel');
    $('#fel-text').textContent = 'Något gick fel när ' + vad + '.';
    $('#fel-detalj').textContent = felText(fel);
    console.error(fel);
  }
  $('#fel-igen').addEventListener('click', () => location.reload());

  /* ============================================================
     START
     ============================================================ */
  async function start() {
    try {
      $('#year').textContent = new Date().getFullYear();
      if (!supa) {
        visa('view-auth');
        säg($('#auth-msg'), 'Databasen är inte kopplad. Fyll i nextrum-config.js.', false);
        return;
      }

      S.user = await NX.hämtaSession();
      if (!S.user) { visa('view-auth'); return; }

      S.profil = await NX.hämtaProfil(S.user.id);
      ritaHeader();

      /* is_admin avgör vilken SIDA som visas. Vad som går att LÄSA
         avgörs av RLS i databasen, och den frågar inte den här
         filen om lov. En manipulerad webbläsare kommer alltså in i
         markupen och får tomma tabeller. */
      if (!S.profil || !S.profil.is_admin) { visa('view-nekad'); return; }

      visa('view-app');

      S.flikar = {
        meddelanden: NXArbete.flikar($('section[data-sek="meddelanden"]')),
        ekonomi: NXArbete.flikar($('section[data-sek="ekonomi"]')),
        system: NXArbete.flikar($('section[data-sek="system"]'))
      };

      S.sido = NXStudie.sidomeny({
        nav: $('#vy-sido'), rot: $('#view-app'), standard: 'oversikt'
      });

      $('#adm-topp').hidden = false;
      startaFall();
      ritaSidofot();
      ritaVar();

      function följHash() {
        const [huvud, flik] = String(location.hash || '').replace(/^#/, '').split('/');
        if (flik && S.flikar[huvud]) S.flikar[huvud].visa(flik);
        ritaVar();
      }
      window.addEventListener('hashchange', följHash);
      följHash();

      S.hero = NXArbete.hero({
        host: $('#vy-hero'),
        namn: S.profil.full_name,
        etikett: 'Adminvy',
        lede: 'Här är läget på Nextrum idag.',
        video: 'bilder/hero-studievy.mp4',
        bild: 'bilder/hero-nextrum-1280.jpg',
        marke: { text: 'Ledningen', ikon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 20V8.5l8.5-5 8.5 5V20"/><path d="M9.5 20v-6h5v6"/></svg>' }
      });

      await hämtaAllt();

      ritaLeads();
      ritaAnsokningar();
      ritaKontakt();
      ritaChattar();
      ritaFamiljer();
      ritaElever();
      await hämtaMatchunderlag();
      ritaMatchning();
      ritaStudiehjalpare();
      ritaBokningar();
      ritaFakturor();
      ritaUtbetalningar();
      ritaIntegrationer();
      ritaPris();
      ritaFel();
      await ritaÖversikt();

      const idag = isoFor(new Date());
      const nästa = S.bokningar
        .filter(b => b.wanted_date >= idag && b.status !== 'cancelled')
        .sort((a, b) => (a.wanted_date + (a.wanted_time || ''))
          .localeCompare(b.wanted_date + (b.wanted_time || '')))[0];
      /* Samma summa som arbetskön på Översikt visar, inte en egen
         räkning. Två tal som båda heter "saker att göra" och säger
         olika saker är värre än inget tal alls. */
      const attGöra = S.attGora.reduce((n, p) => n + p.antal, 0);
      const främst = S.attGora[0];

      S.hero.uppdatera({
        nasta: nästa ? {
          href: '#bokningar',
          text: 'Nästa pass · ' + kortDatum(nästa.wanted_date)
            + (nästa.wanted_time ? ' kl. ' + String(nästa.wanted_time).slice(0, 5) : ''),
          under: namnFör(nästa.parent_id) + ' · ' + namnFör(nästa.tutor_id)
        } : { href: '#bokningar', text: 'Inga pass framåt', under: 'Ingen har bokat ännu' },
        chatt: attGöra
          ? { href: främst ? främst.till : '#oversikt',
              text: attGöra + (attGöra === 1 ? ' sak att göra' : ' saker att göra'),
              under: främst
                ? 'Främst: ' + (främst.antal === 1 ? främst.ental : främst.antal + ' ' + främst.rubrik)
                : 'Se Översikt' }
          : { href: '#oversikt', text: 'Inget som väntar', under: 'Allt är avklarat' }
      });

      supa.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', S.user.id);
    } catch (fel) {
      visaFel(fel, 'adminvyn skulle hämtas');
    }
  }

  start();
})();
