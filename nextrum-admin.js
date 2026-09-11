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
    matchunderlag: [], matchunderlagFel: null, valdElev: null, kalender: null,
    detaljCache: {}
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
      { antal: S.bokningar.filter(b =>
          b.status !== 'cancelled' && b.status !== 'completed'
          && String(b.wanted_date) < idag).length,
        rubrik: 'pass saknar rapport', ental: 'pass saknar rapport',
        under: 'Hållna men orapporterade. De faktureras inte.', till: '#lektioner' },
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
      S.sido.märke('lektioner', av('#lektioner'));
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
          + (matchade.length < barn.length
            ? '<a class="btn btn-ghost btn-sm" href="#matchning">Matcha</a>' : '')
          /* Anteckningsknappen är borta. Anteckningarna är en flik i
             detaljpanelen nu, tillsammans med allt annat om samma
             person — två knappar som öppnade två olika paneler om
             samma familj var en uppdelning utan skäl. */
          + '<button class="btn btn-ghost btn-sm" data-dp="familj:' + esc(p.id) + '">Öppna</button>'
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
      { namn: '', höger: true, rita: e =>
        '<button class="btn btn-ghost btn-sm" data-dp="elev:' + esc(e.id) + '">Öppna</button>' }
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
        + '<button class="btn btn-ghost btn-sm" style="margin-left:6px" data-dp="studiehjalpare:'
        + esc(t.id) + '">Öppna</button>' }
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
      .map(b => ({ ...b, familj: namnFör(b.parent_id), hjalpare: namnFör(b.tutor_id),
                   elev: elevNamn(b.student_id) || '' }))
      /* elev är med i söket sedan matchningen blev en elevfråga. Utan
         den gick ett pass inte att hitta på barnets namn, vilket är
         det man har när en familj ringer. */
      .filter(b => matchar(b, ['familj', 'elev', 'hjalpare', 'subject', 'format'], sök));

    $('#bok-antal').textContent = rader.length + ' av ' + S.bokningar.length;
    $('#bok-tabell').innerHTML = tabell([
      { namn: 'När', rita: b => '<b>' + esc(kortDatum(b.wanted_date)) + '</b>'
        + '<span class="adm-und">' + esc(b.wanted_time ? String(b.wanted_time).slice(0, 5) : '')
        + ' · ' + ((b.duration_min || 60) / 60) + ' h</span>' },
      { namn: 'Elev', rita: b => b.elev
        ? '<b>' + esc(b.elev) + '</b><span class="adm-und">' + esc(b.familj) + '</span>'
        : esc(b.familj) + '<span class="adm-und">inget barn valt</span>' },
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
     LEKTIONER

     En lektion är inget eget objekt i databasen, och ska inte bli
     det: ett genomfört pass PLUS dess rapport ÄR lektionen. En
     tredje tabell hade gett två sanningar om samma timme.

     Sektionen finns ändå, för den svarar på en annan fråga än
     Bokningar. Bokningar tittar framåt. Lektioner tittar bakåt:
     hände det, skrevs det en rapport, kan det faktureras.

     RAPPORTEN ÄR PENGAR

     Ett pass blir 'completed' när studiehjälparen skrivit
     rapporten, och bara completed-pass hamnar på fakturan. Ett
     hållet men orapporterat pass är alltså en timme ingen får
     betalt för — varken familjen faktureras eller studiehjälparen
     ersätts. Därför är "rapport saknas" sektionens första siffra
     och dess enda larm.
     ============================================================ */

  /* Pass som redan varit, oavsett om någon rapporterat dem.
     Avbokade räknas inte: de hände aldrig. */
  function hållnaPass() {
    const idag = isoFor(new Date());
    return S.bokningar.filter(b =>
      b.status !== 'cancelled' && String(b.wanted_date) < idag);
  }

  function ritaLektionstal() {
    const host = $('#lekt-tal');
    if (!host) return;
    const hållna = hållnaPass();
    const genomförda = hållna.filter(b => b.status === 'completed');
    const utanRapport = hållna.filter(b => b.status !== 'completed');
    const minuter = genomförda.reduce((n, b) => n + (b.duration_min || 60), 0);

    /* Frånvaro räknas bara på pass där någon faktiskt fyllt i det.
       Ett tomt fält betyder "ingen sa något", inte "eleven kom". */
    const markerade = hållna.filter(b => b.attendance);
    const uteblev = markerade.filter(b => b.attendance === 'franvarande').length;

    host.innerHTML =
      '<div class="adm-kpi' + (utanRapport.length ? ' ar-larm' : '') + '">'
      + '<b>' + utanRapport.length + '</b><span>Rapport saknas</span>'
      + '<span class="adm-kpi-diff">' + (utanRapport.length
        ? 'faktureras inte förrän den skrivs' : 'allt hållet är rapporterat') + '</span></div>'
      + '<div class="adm-kpi"><b>' + genomförda.length + '</b><span>Genomförda pass</span>'
      + '<span class="adm-kpi-diff">totalt</span></div>'
      + '<div class="adm-kpi"><b>' + NXBetalning.timmar(minuter) + '</b><span>Undervisad tid</span>'
      + '<span class="adm-kpi-diff">i genomförda pass</span></div>'
      + '<div class="adm-kpi"><b>' + uteblev + '</b><span>Uteblivna</span>'
      + '<span class="adm-kpi-diff">' + (markerade.length
        ? 'av ' + markerade.length + ' markerade' : 'ingen har markerats') + '</span></div>';
  }

  function ritaLektioner() {
    ritaLektionstal();
    const host = $('#lekt-tabell');
    if (!host) return;

    const sök = $('#lekt-sok').value.trim().toLowerCase();
    const rapportFilter = $('#lekt-rapport').value;
    const dagar = $('#lekt-period').value;

    let alla = hållnaPass();
    if (dagar) {
      const från = dagarSedan(Number(dagar));
      alla = alla.filter(b => String(b.wanted_date) >= från);
    }
    alla.sort((a, b) => String(b.wanted_date + (b.wanted_time || ''))
      .localeCompare(String(a.wanted_date + (a.wanted_time || ''))));

    const rader = alla
      .filter(b => {
        if (!rapportFilter) return true;
        const har = b.status === 'completed';
        return rapportFilter === 'finns' ? har : !har;
      })
      .filter(b => {
        if (!sök) return true;
        return [b.subject, b.format, elevNamn(b.student_id),
          namnFör(b.parent_id), namnFör(b.tutor_id)]
          .filter(Boolean).join(' ').toLowerCase().indexOf(sök) !== -1;
      });

    $('#lekt-antal').textContent = rader.length + ' av ' + alla.length;
    host.innerHTML = tabell([
      { namn: 'När', rita: b => '<b>' + esc(kortDatum(b.wanted_date)) + '</b>'
        + '<span class="adm-und">' + esc((b.wanted_time ? String(b.wanted_time).slice(0, 5) + ' · ' : '')
          + (b.duration_min || 60) + ' min') + '</span>' },
      { namn: 'Elev', rita: b => esc(elevNamn(b.student_id) || namnFör(b.parent_id))
        + '<span class="adm-und">' + esc(namnFör(b.parent_id)) + '</span>' },
      { namn: 'Studiehjälpare', rita: b => esc(namnFör(b.tutor_id)) },
      { namn: 'Ämne', rita: b => esc(b.subject || '—')
        + (b.format ? '<span class="adm-und">' + esc(b.format) + '</span>' : '') },
      { namn: 'Närvaro', rita: b => {
        if (b.attendance === 'franvarande') return pill('Uteblev', 'ar-ny');
        if (b.attendance === 'narvarande') return pill('Närvarade', 'ar-klar');
        return '<span style="color:var(--bl-2)">Ej markerad</span>';
      } },
      { namn: 'Rapport', höger: true, rita: b => {
        if (b.status === 'completed') {
          return pill('Skriven', 'ar-klar')
            + '<span class="adm-und lekt-fakturerad">Kan faktureras</span>';
        }
        /* Inte ett fel att laga härifrån: rapporten skrivs av
           studiehjälparen i hens egen vy. Adminvyn kan se att den
           saknas och påminna, inte skriva den. */
        return pill('Saknas', 'ar-ny')
          + '<span class="adm-und">Passet är ' + esc(BOK_LAGE[b.status] ? BOK_LAGE[b.status][0].toLowerCase() : b.status) + '</span>';
      } }
    /* Periodfiltret står på 30 dagar från början, så det räknas inte
       som ett filter användaren satt. Annars fick en tom databas
       beskedet "matchar filtret", vilket skickar folk att leta efter
       ett filter de aldrig rört. Finns det inga hållna pass alls är
       det den sanningen som ska stå. */
    ], rader, tomtText(hållnaPass().length && (sök || rapportFilter),
      'Ingen lektion matchar filtret',
      hållnaPass().length
        ? 'Inga pass i den här perioden'
        : 'Inga pass har hållits än'));
  }

  ['#lekt-sok', '#lekt-rapport', '#lekt-period'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('input', ritaLektioner);
  });


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


  /* ============================================================
     EKONOMI
     ============================================================ */

  /* ------------------------------------------------------------
     KALENDERN

     Ritas av NXStudie.schema — samma modul som studievyn och
     studiehjälparvyn använder. Månad, vecka, dag, samma färg per
     läge, samma chip.

     Att bygga en egen hade gett ledningen en kalender som ser ut
     som en annan produkt än den familjen ser, och två uppsättningar
     buggar att laga. Skillnaden här är bara etiketten på ett pass:
     familjen ser sitt barns namn, ledningen ser båda parterna.
     ------------------------------------------------------------ */
  function ritaKalender() {
    const host = $('#bok-kalender');
    if (!host) return;

    /* Avbokade är med. I familjens kalender är de brus, i
       ledningens är de en fråga: varför ställdes det in? */
    const namn = b => [elevNamn(b.student_id) || namnFör(b.parent_id), namnFör(b.tutor_id)]
      .filter(Boolean).join(' → ');

    if (S.kalender) { S.kalender.sättBokningar(S.bokningar); return; }
    S.kalender = NXStudie.schema({
      host: host,
      bokningar: S.bokningar,
      lage: 'manad',
      namn: namn,
      onOppna: b => {
        /* Listan är där man ändrar ett pass. Kalendern säger var
           det ligger och skickar vidare — två vyer som båda kan
           skriva vore två ställen att glömma uppdatera. */
        const f = S.flikar.bokningar;
        if (f) f.visa('lista');
        /* Tidsfiltret står på "framåt" som standard. Ett passerat
           pass hade alltså försvunnit i samma sekund man klickat på
           det i kalendern — filtret nollas därför här. */
        const när = $('#bok-nar');
        if (när) när.value = 'alla';
        const sök = $('#bok-sok');
        if (sök) sök.value = elevNamn(b.student_id) || namnFör(b.parent_id);
        ritaBokningar();
      }
    });
  }

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

  /* Anteckningarna låg här som en egen panel med en egen
     hämtning och ett eget formulär. De är nu en flik i
     detaljpanelen, tillsammans med allt annat om samma person —
     två paneler om en familj var en uppdelning utan skäl. Se
     dpNoteringar. */

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
        /* Samma rad syns på fyra ställen. Ritas bara listan om blir
           kalendern och lektionslistan kvar med det gamla läget, och
           då står det två olika saker om samma pass på samma skärm. */
        ritaBokningar(); ritaKalender(); ritaLektioner(); ritaStatistik();
        await ritaÖversikt();
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
     DETALJPANELEN

     En familj, en elev eller en studiehjälpare, öppnad från vilken
     lista som helst. Samma panel för alla tre — det som skiljer är
     vilka flikar den har och vad som hämtas.

     HÄMTAS NÄR DEN ÖPPNAS, INTE I FÖRVÄG

     Studieplaner, läxor, material, utvecklingsområden, rapporter
     och tillgänglighet för ALLA vore sju frågor till vid varje
     sidladdning, och nästan ingenting av det tittar man på. Med
     två elever spelar det ingen roll. Med hundra gör det det, och
     då är det för sent att ändra arkitektur.

     Panelen cachar per person i S.detaljCache: öppnar man samma
     familj två gånger i rad hämtas ingenting andra gången.
     ============================================================ */

  const DP = {
    bak: null, panel: null, typ: null, id: null, flik: null
  };

  function byggPanel() {
    if (DP.panel) return;

    DP.bak = document.createElement('div');
    DP.bak.className = 'dp-bak';
    DP.bak.hidden = true;
    DP.bak.addEventListener('click', stängDetalj);

    DP.panel = document.createElement('aside');
    DP.panel.className = 'dp';
    DP.panel.hidden = true;
    DP.panel.setAttribute('role', 'dialog');
    DP.panel.setAttribute('aria-modal', 'true');
    DP.panel.setAttribute('aria-label', 'Detaljer');

    document.body.appendChild(DP.bak);
    document.body.appendChild(DP.panel);

    DP.panel.addEventListener('click', e => {
      if (e.target.closest('[data-dp-stang]')) { stängDetalj(); return; }
      const f = e.target.closest('[data-dp-flik]');
      if (f) { DP.flik = f.dataset.dpFlik; ritaDetalj(); }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && DP.panel && !DP.panel.hidden) stängDetalj();
    });
  }

  function stängDetalj() {
    if (!DP.panel) return;
    DP.panel.classList.remove('ar-oppen');
    DP.bak.classList.remove('ar-oppen');
    DP.typ = null; DP.id = null;
    /* Vänta ut övergången innan hidden sätts, annars hoppar
       panelen bort i stället för att glida. */
    setTimeout(() => {
      if (DP.typ) return;           // hann öppnas igen
      DP.panel.hidden = true;
      DP.bak.hidden = true;
    }, 280);
    if (DP.sistaFokus && DP.sistaFokus.focus) DP.sistaFokus.focus();
  }

  /* ------------------------------------------------------------
     HÄMTNINGEN
     En fråga per tabell panelen behöver, alla parallellt. Vad som
     behövs beror på typ: en studiehjälpare har ingen studieplan,
     en familj har ingen tillgänglighet.
     ------------------------------------------------------------ */
  async function hämtaDetalj(typ, id) {
    const nyckel = typ + ':' + id;
    if (S.detaljCache[nyckel]) return S.detaljCache[nyckel];

    const d = { fel: null };
    const frågor = [];
    const namn = [];

    function lägg(n, q) { namn.push(n); frågor.push(q); }

    if (typ === 'elev') {
      lägg('plan', supa.from('study_plans')
        .select('subject, goals, plan_text, updated_at').eq('student_id', id)
        .order('updated_at', { ascending: false }).limit(1));
      lägg('laxor', supa.from('homework')
        .select('id, title, subject, due_date, status, created_at').eq('student_id', id)
        .order('due_date', { ascending: false }).limit(50));
      lägg('material', supa.from('materials')
        .select('id, title, kind, subject, url, created_at').eq('student_id', id)
        .order('created_at', { ascending: false }).limit(50));
      lägg('utveckling', supa.from('progress_items')
        .select('id, subject, area, level, comment, updated_at').eq('student_id', id)
        .order('subject').order('area'));
      lägg('rapporter', supa.from('lesson_reports')
        .select('id, lesson_date, went_well, needs_practice, next_focus, ai_feedback, created_at')
        .eq('student_id', id).order('lesson_date', { ascending: false }).limit(30));
    } else if (typ === 'studiehjalpare') {
      lägg('tillgang', supa.from('tutor_availability')
        .select('weekday, start_time, end_time').eq('tutor_id', id).order('weekday'));
      lägg('blockerat', supa.from('tutor_blocked')
        .select('block_date, block_time, reason').eq('tutor_id', id)
        .gte('block_date', isoFor(new Date())).order('block_date').limit(30));
      lägg('rapporter', supa.from('lesson_reports')
        .select('id, student_id, lesson_date, created_at').eq('tutor_id', id)
        .order('lesson_date', { ascending: false }).limit(30));
      lägg('noteringar', supa.from('admin_noteringar')
        .select('id, text, skriven_av, created_at').eq('om_profil', id)
        .order('created_at', { ascending: false }));
    } else {
      lägg('noteringar', supa.from('admin_noteringar')
        .select('id, text, skriven_av, created_at').eq('om_profil', id)
        .order('created_at', { ascending: false }));
    }

    /* Varje fråga fångas var för sig.

       Promise.all avvisar vid FÖRSTA felet, och då kastades
       undantaget hela vägen ut — panelen blev stående på "Hämtar"
       i varenda flik, även de som inte hade med den trasiga
       frågan att göra. En saknad tabell eller ett tappat nät
       räckte för att frysa hela vyn.

       Nu blir ett fel ett fel i EN flik. Resten ritas. */
    const svar = await Promise.all(frågor.map(q =>
      Promise.resolve(q).then(
        r => r,
        e => ({ data: null, error: e })
      )));

    svar.forEach((r, i) => {
      d[namn[i]] = (r && r.data) || [];
      if (r && r.error) d[namn[i] + 'Fel'] = felText(r.error);
    });

    S.detaljCache[nyckel] = d;
    return d;
  }

  /* ------------------------------------------------------------
     FLIKARNA PER TYP
     ------------------------------------------------------------ */
  const DP_FLIKAR = {
    familj:         [['oversikt', 'Översikt'], ['barn', 'Barn'], ['pass', 'Pass'],
                     ['ekonomi', 'Ekonomi'], ['anteckningar', 'Anteckningar']],
    elev:           [['oversikt', 'Översikt'], ['pass', 'Pass'], ['uppgifter', 'Uppgifter'],
                     ['utveckling', 'Utveckling'], ['rapporter', 'Rapporter']],
    studiehjalpare: [['oversikt', 'Översikt'], ['elever', 'Elever'], ['pass', 'Pass'],
                     ['tider', 'Tider'], ['ersattning', 'Ersättning'],
                     ['anteckningar', 'Anteckningar']]
  };

  async function öppnaDetalj(typ, id) {
    if (!DP_FLIKAR[typ]) return;
    byggPanel();
    DP.sistaFokus = document.activeElement;
    DP.typ = typ; DP.id = id;
    DP.flik = DP_FLIKAR[typ][0][0];

    DP.bak.hidden = false;
    DP.panel.hidden = false;
    /* Två bildrutor innan klassen sätts, annars hinner webbläsaren
       inte se starttillståndet och övergången uteblir. */
    requestAnimationFrame(() => requestAnimationFrame(() => {
      DP.bak.classList.add('ar-oppen');
      DP.panel.classList.add('ar-oppen');
    }));

    ritaDetalj(true);
    await hämtaDetalj(typ, id);
    if (DP.typ === typ && DP.id === id) ritaDetalj();
  }


  /* ------------------------------------------------------------
     RITNINGEN
     ------------------------------------------------------------ */
  function dpFakta(rader) {
    return '<div class="dp-fakta">' + rader.map(r =>
      '<div><span>' + esc(r[0]) + '</span>'
      + (r[1] ? '<span>' + r[1] + '</span>'
              : '<span class="ar-tom">' + esc(r[2] || 'ej angivet') + '</span>')
      + '</div>').join('') + '</div>';
  }

  function dpRubrik(text, extra) {
    return '<div class="dp-rubrik"><span>' + esc(text) + '</span>'
      + (extra ? '<em>' + esc(extra) + '</em>' : '') + '</div>';
  }

  function dpTal(par) {
    return '<div class="dp-tal">' + par.map(p =>
      '<div><b>' + esc(String(p[0])) + '</b><span>' + esc(p[1]) + '</span></div>').join('') + '</div>';
  }

  function dpRad(rubrik, under, höger) {
    return '<div class="dp-rad"><div><b>' + esc(rubrik) + '</b>'
      + (under ? '<span>' + esc(under) + '</span>' : '') + '</div>'
      + '<span class="dp-rad-hoger">' + (höger || '') + '</span></div>';
  }

  function passFör(filter) {
    return S.bokningar.filter(filter).sort((a, b) =>
      String(b.wanted_date + (b.wanted_time || ''))
        .localeCompare(String(a.wanted_date + (a.wanted_time || ''))));
  }

  function passLista(pass, visaVem) {
    if (!pass.length) return tomt('Inga pass', 'Bokade pass dyker upp här.');
    return pass.slice(0, 30).map(b => dpRad(
      kortDatum(b.wanted_date) + (b.wanted_time ? ' kl. ' + String(b.wanted_time).slice(0, 5) : ''),
      [b.subject, b.format, (b.duration_min || 60) + ' min',
        visaVem ? visaVem(b) : null].filter(Boolean).join(' · '),
      läge(BOK_LAGE, b.status))).join('');
  }

  const NIVA_TEXT = {
    behover_traning: ['Behöver träning', 'ar-ny'],
    pa_god_vag: ['På god väg', 'ar-vantar'],
    sitter: ['Sitter', 'ar-klar']
  };

  function dpFamilj(p, d) {
    const barn = S.elever[p.id] || [];
    const pass = passFör(b => b.parent_id === p.id);
    const genomförda = pass.filter(b => b.status === 'completed');
    const fakturor = S.fakturor.filter(f => f.parent_id === p.id);
    const obetalt = fakturor.filter(f => f.status === 'skickad' || f.status === 'forfallen')
      .reduce((n, f) => n + (f.belopp_ore || 0), 0);
    const idag = isoFor(new Date());
    const nästa = pass.filter(b => b.wanted_date >= idag && b.status !== 'cancelled').pop();

    if (DP.flik === 'barn') {
      if (!barn.length) return tomt('Inga barn inlagda', 'Familjen lägger till dem i studievyn.');
      return barn.map(e => {
        const t = elevHjälpare(e);
        return '<div class="dp-rad"><div>'
          + '<b>' + esc(e.name) + '</b>'
          + '<span>' + esc([e.grade, e.school, (e.subjects || []).join(', ')]
              .filter(Boolean).join(' · ') || 'Inga uppgifter') + '</span>'
          + '<span>' + (t ? 'Studiehjälpare: ' + esc(t.full_name || t.email || '—')
                          : 'Ingen studiehjälpare') + '</span></div>'
          + '<span class="dp-rad-hoger">'
          + '<button class="btn btn-ghost btn-sm" data-dp="elev:' + esc(e.id) + '">Öppna</button>'
          + '</span></div>';
      }).join('');
    }

    if (DP.flik === 'pass') return passLista(pass, b => elevNamn(b.student_id) || '');

    if (DP.flik === 'ekonomi') {
      return dpTal([
        [kronor(obetalt), 'Utestående'],
        [fakturor.length, 'Fakturor'],
        [genomförda.length, 'Fakturerbara pass']
      ])
      + dpRubrik('Fakturor')
      + (fakturor.length
        ? fakturor.map(f => dpRad(
            NX.MANADER[Number(String(f.period).slice(5, 7)) - 1] + ' ' + String(f.period).slice(0, 4),
            kronor(f.belopp_ore) + (f.forfaller ? ' · förfaller ' + kortDatum(f.forfaller) : ''),
            läge(FAKT_LAGE, f.status))).join('')
        : tomt('Inga fakturor än', 'Den första skapas när en månad med genomförda pass är slut.'));
    }

    if (DP.flik === 'anteckningar') return dpNoteringar(p.id, d);

    return dpTal([
      [barn.length, barn.length === 1 ? 'Barn' : 'Barn'],
      [genomförda.length, 'Genomförda pass'],
      [kronor(obetalt), 'Utestående']
    ])
    + dpRubrik('Kontakt')
    + dpFakta([
      ['E-post', p.email ? esc(p.email) : null],
      ['Telefon', p.phone ? esc(p.phone) : null],
      ['Konto skapat', p.created_at ? esc(kortDatum(p.created_at)) : null],
      ['Senast inloggad', p.last_seen_at ? esc(kortDatum(p.last_seen_at)) : null, 'aldrig'],
      ['Om familjen', p.bio ? esc(p.bio) : null]
    ])
    + dpRubrik('Nästa pass')
    + (nästa
      ? dpRad(kortDatum(nästa.wanted_date)
          + (nästa.wanted_time ? ' kl. ' + String(nästa.wanted_time).slice(0, 5) : ''),
          [elevNamn(nästa.student_id), nästa.subject, namnFör(nästa.tutor_id)]
            .filter(Boolean).join(' · '),
          läge(BOK_LAGE, nästa.status))
      : tomt('Inget pass inbokat', 'Familjen bokar i studievyn.'));
  }

  function dpElev(e, d) {
    const f = S.personer[e.parent_id];
    const t = elevHjälpare(e);
    const pass = passFör(b => b.student_id === e.id);
    const genomförda = pass.filter(b => b.status === 'completed');
    const plan = (d.plan || [])[0];

    if (DP.flik === 'pass') return passLista(pass, b => namnFör(b.tutor_id));

    if (DP.flik === 'uppgifter') {
      const öppna = (d.laxor || []).filter(h => h.status !== 'klar');
      return dpRubrik('Läxor', öppna.length ? öppna.length + ' öppna' : 'allt avbockat')
        + ((d.laxor || []).length
          ? d.laxor.map(h => dpRad(h.title,
              [h.subject, h.due_date ? 'till ' + kortDatum(h.due_date) : null]
                .filter(Boolean).join(' · '),
              pill(h.status === 'klar' ? 'Klar' : h.status === 'paborjad' ? 'Påbörjad' : 'Ej påbörjad',
                h.status === 'klar' ? 'ar-klar' : h.status === 'paborjad' ? 'ar-vantar' : ''))).join('')
          : tomt('Inga läxor', 'Studiehjälparen lägger upp dem i sin vy.'))
        + dpRubrik('Material')
        + ((d.material || []).length
          ? d.material.map(m => dpRad(m.title,
              [m.subject, m.kind === 'lank' ? 'länk' : m.kind].filter(Boolean).join(' · '),
              kortDatum(m.created_at))).join('')
          : tomt('Inget material', 'Filer och länkar från studiehjälparen hamnar här.'));
    }

    if (DP.flik === 'utveckling') {
      const u = d.utveckling || [];
      if (!u.length) return tomt('Inga områden satta',
        'Studiehjälparen sätter dem efter hand som de arbetar.');
      return u.map(x => dpRad(x.area, [x.subject, x.comment].filter(Boolean).join(' · '),
        pill((NIVA_TEXT[x.level] || [x.level])[0], (NIVA_TEXT[x.level] || [, ''])[1]))).join('');
    }

    if (DP.flik === 'rapporter') {
      const r = d.rapporter || [];
      if (!r.length) return tomt('Inga rapporter än',
        'Studiehjälparen skriver en efter varje pass. Utan den faktureras inte passet.');
      return r.map(x => '<div style="margin-bottom:18px">'
        + dpRubrik(kortDatum(x.lesson_date))
        + dpFakta([
          ['Gick bra', x.went_well ? esc(x.went_well) : null],
          ['Att öva på', x.needs_practice ? esc(x.needs_practice) : null],
          ['Nästa gång', x.next_focus ? esc(x.next_focus) : null]
        ]) + '</div>').join('');
    }

    return dpTal([
      [genomförda.length, 'Genomförda pass'],
      [(d.laxor || []).filter(h => h.status !== 'klar').length, 'Öppna läxor'],
      [(d.utveckling || []).length, 'Områden']
    ])
    + dpRubrik('Eleven')
    + dpFakta([
      ['Årskurs', e.grade ? esc(e.grade) : null],
      ['Skola', e.school ? esc(e.school) : null],
      ['Ämnen', (e.subjects || []).length ? esc(e.subjects.join(', ')) : null],
      ['Mål', e.goals ? esc(e.goals) : null],
      ['Familj', f ? '<button class="btn btn-ghost btn-sm" data-dp="familj:' + esc(f.id) + '">'
        + esc(f.full_name || f.email || '—') + '</button>' : null],
      ['Studiehjälpare', t
        ? '<button class="btn btn-ghost btn-sm" data-dp="studiehjalpare:' + esc(t.id) + '">'
          + esc(t.full_name || t.email || '—') + '</button>'
        : null, 'ingen matchad än']
    ])
    + dpRubrik('Studieplan', plan && plan.updated_at ? 'uppdaterad ' + kortDatum(plan.updated_at) : '')
    + (plan && (plan.plan_text || plan.goals)
      ? '<div class="dp-text">' + esc(plan.plan_text || plan.goals) + '</div>'
      : tomt('Ingen studieplan', 'Studiehjälparen skriver den efter första passet.'));
  }

  function dpStudiehjalpare(p, d) {
    const tp = S.tutorProfiler[p.id] || {};
    const elever = S.elevlista.filter(e => e.matched_tutor_id === p.id && e.match_status === 'matched');
    const pass = passFör(b => b.tutor_id === p.id);
    const genomförda = pass.filter(b => b.status === 'completed');
    const minuter = genomförda.reduce((n, b) => n + (b.duration_min || 60), 0);
    const utb = S.utbetalningar.filter(u => u.tutor_id === p.id);

    if (DP.flik === 'elever') {
      if (!elever.length) return tomt('Inga elever',
        'Matcha någon under Matchning, så syns de här.');
      return elever.map(e => {
        const fam = S.personer[e.parent_id];
        return '<div class="dp-rad"><div><b>' + esc(e.name) + '</b>'
          + '<span>' + esc([e.grade, fam && (fam.full_name || fam.email)]
              .filter(Boolean).join(' · ')) + '</span></div>'
          + '<span class="dp-rad-hoger">'
          + '<button class="btn btn-ghost btn-sm" data-dp="elev:' + esc(e.id) + '">Öppna</button>'
          + '</span></div>';
      }).join('');
    }

    if (DP.flik === 'pass') return passLista(pass, b => elevNamn(b.student_id) || namnFör(b.parent_id));

    if (DP.flik === 'tider') {
      const t = d.tillgang || [];
      const bl = d.blockerat || [];
      return dpRubrik('Kan jobba', t.length ? t.length + ' block' : 'inga tider inlagda')
        + (t.length
          /* weekday är 0 = måndag i tutor_availability, precis som
             NX.DAGAR. Ingen omräkning, och framför allt ingen
             (+6)%7 — den hör hemma när man kommer från
             Date.getDay(), som börjar på söndag. */
          ? t.map(x => dpRad(NX.DAGAR[x.weekday] || 'Dag ' + x.weekday,
              String(x.start_time).slice(0, 5) + '–' + String(x.end_time).slice(0, 5), '')).join('')
          : tomt('Inga tider inlagda',
              'Familjen kan bara boka inom tiderna hen lagt in. Utan dem går inga pass att boka.'))
        + dpRubrik('Spärrade tider framåt')
        + (bl.length
          ? bl.map(x => dpRad(kortDatum(x.block_date),
              [x.block_time ? String(x.block_time).slice(0, 5) : 'hela dagen', x.reason]
                .filter(Boolean).join(' · '), '')).join('')
          : tomt('Inget spärrat', 'Inga undantag framåt.'));
    }

    if (DP.flik === 'ersattning') {
      const väntar = utb.filter(u => u.status === 'utkast' || u.status === 'godkand')
        .reduce((n, u) => n + (u.belopp_ore || 0), 0);
      const utbetalt = utb.filter(u => u.status === 'utbetald')
        .reduce((n, u) => n + (u.belopp_ore || 0), 0);
      return dpTal([
        [kronor(väntar), 'Väntar'],
        [kronor(utbetalt), 'Utbetalt'],
        [tp.hourly_rate ? NX.kr(tp.hourly_rate) : '—', 'Per timme']
      ])
      + dpRubrik('Underlag')
      + (utb.length
        ? utb.map(u => dpRad(
            NX.MANADER[Number(String(u.period).slice(5, 7)) - 1] + ' ' + String(u.period).slice(0, 4),
            kronor(u.belopp_ore) + ' · ' + NXBetalning.timmar(u.minuter || 0),
            läge(UTB_LAGE, u.status))).join('')
        : tomt('Inga underlag än', 'De skapas av faktureringskörningen efter varje månad.'));
    }

    if (DP.flik === 'anteckningar') return dpNoteringar(p.id, d);

    return dpTal([
      [elever.length, 'Elever'],
      [genomförda.length, 'Genomförda pass'],
      [NXBetalning.timmar(minuter), 'Undervisad tid']
    ])
    + dpRubrik('Profilen')
    + dpFakta([
      ['E-post', p.email ? esc(p.email) : null],
      ['Telefon', p.phone ? esc(p.phone) : null],
      ['Ålder', tp.age ? esc(String(tp.age) + ' år') : null],
      ['Skola', tp.school ? esc(tp.school) : null],
      ['Ort', tp.city ? esc(tp.city) : null],
      ['Ämnen', (tp.subjects || []).length ? esc(tp.subjects.join(', ')) : null],
      ['Årskurser', (tp.grade_levels || []).length ? esc(tp.grade_levels.join(', ')) : null],
      ['Format', (tp.formats || []).length ? esc(tp.formats.join(', ')) : null],
      ['Timpenning', tp.hourly_rate ? esc(NX.kr(tp.hourly_rate)) : null, 'ej satt'],
      ['Stripe', tp.stripe_klar ? 'Klar' : null, 'inte kopplad — ingen utbetalning går'],
      ['Senast inloggad', p.last_seen_at ? esc(kortDatum(p.last_seen_at)) : null, 'aldrig']
    ])
    + (tp.bio ? dpRubrik('Om hen') + '<div class="dp-text">' + esc(tp.bio) + '</div>' : '');
  }

  function dpNoteringar(profilId, d) {
    const n = d.noteringar || [];
    return dpRubrik('Interna anteckningar', 'syns bara för admin')
      + '<form data-dp-not="' + esc(profilId) + '" style="margin-bottom:16px">'
      + '<textarea class="inp" name="text" style="min-height:74px" '
      + 'placeholder="Vad behöver vi minnas om den här personen?" required></textarea>'
      + '<button class="btn btn-primary btn-sm" type="submit" style="margin-top:9px">Spara anteckning</button>'
      + '<p class="ok-msg" data-dp-not-msg></p></form>'
      + (d.noteringarFel
        ? tomt('Kunde inte hämta anteckningarna', d.noteringarFel + ' — är schema-v13.sql kört?')
        : n.length
          ? n.map(x => dpRad(x.text, namnFör(x.skriven_av) + ' · ' + kortDatum(x.created_at), ''))
              .join('')
          : tomt('Inga anteckningar än', 'Den första du skriver hamnar överst.'));
  }

  function ritaDetalj(laddarÄn) {
    if (!DP.panel || !DP.typ) return;
    const flikar = DP_FLIKAR[DP.typ] || [];
    let person, rubrik, under, märken = '';

    if (DP.typ === 'elev') {
      person = S.elevlista.find(x => x.id === DP.id);
      if (!person) { stängDetalj(); return; }
      const f = S.personer[person.parent_id];
      rubrik = person.name || '(namn saknas)';
      under = [person.grade, person.school, f && (f.full_name || f.email)]
        .filter(Boolean).join(' · ');
      märken = elevHjälpare(person) ? pill('Matchad', 'ar-klar') : pill('Ingen studiehjälpare', 'ar-ny');
    } else {
      person = S.personer[DP.id];
      if (!person) { stängDetalj(); return; }
      rubrik = person.full_name || person.email || '(namn saknas)';
      under = person.email || '';
      if (DP.typ === 'studiehjalpare') {
        const tp = S.tutorProfiler[DP.id] || {};
        märken = läge(SH_LAGE, tp.status);
      } else {
        const barn = S.elever[DP.id] || [];
        const matchade = barn.filter(e => e.matched_tutor_id && e.match_status === 'matched').length;
        märken = pill(barn.length
          ? matchade + ' av ' + barn.length + (barn.length === 1 ? ' barn matchat' : ' barn matchade')
          : 'Inga barn inlagda', matchade === barn.length && barn.length ? 'ar-klar' : 'ar-ny');
      }
      if (person.is_admin) märken += ' ' + pill('Admin', 'ar-vantar');
    }

    const d = S.detaljCache[DP.typ + ':' + DP.id];
    let kropp;
    if (laddarÄn || !d) kropp = laddar();
    else if (DP.typ === 'familj') kropp = dpFamilj(person, d);
    else if (DP.typ === 'elev') kropp = dpElev(person, d);
    else kropp = dpStudiehjalpare(person, d);

    DP.panel.innerHTML =
      '<div class="dp-topp">'
      + M.avatar(rubrik, (person.avatar_url || null), {})
      + '<span class="dp-namn"><b>' + esc(rubrik) + '</b>'
      + (under ? '<span>' + esc(under) + '</span>' : '')
      + (märken ? '<span class="dp-marken">' + märken + '</span>' : '')
      + '</span>'
      + '<button class="dp-stang" type="button" data-dp-stang aria-label="Stäng">'
      + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>'
      + '</div>'
      + '<div class="dp-flikar" role="tablist">'
      + flikar.map(f => '<button class="dp-flik" type="button" role="tab" data-dp-flik="' + f[0] + '"'
        + ' aria-selected="' + (f[0] === DP.flik) + '">' + esc(f[1]) + '</button>').join('')
      + '</div>'
      + '<div class="dp-kropp">' + kropp + '</div>';
  }

  /* Öppnas från vilken lista som helst, och från panelen själv:
     en elev leder till sin familj, en familj till sina barn. */
  document.addEventListener('click', e => {
    const k = e.target.closest('[data-dp]');
    if (!k) return;
    const [typ, id] = String(k.dataset.dp).split(':');
    öppnaDetalj(typ, id);
  });

  document.addEventListener('submit', async e => {
    const f = e.target.closest('[data-dp-not]');
    if (!f) return;
    e.preventDefault();
    const msg = f.querySelector('[data-dp-not-msg]');
    const text = f.text.value.trim();
    if (!text) return;
    const profilId = f.dataset.dpNot;
    const { error } = await supa.from('admin_noteringar')
      .insert({ om_profil: profilId, text, skriven_av: S.user.id });
    if (error) { säg(msg, '⚠️ ' + felText(error), false); return; }
    /* Cachen är nu inaktuell för den här personen. Att tömma den
       och hämta om är billigare än att gissa vad servern satte
       för id och tidsstämpel. */
    delete S.detaljCache[DP.typ + ':' + profilId];
    await hämtaDetalj(DP.typ, profilId);
    ritaDetalj();
  });


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
     SKALET
     Topprad, global sök, notiser, hopfällbar sidomeny och menyns
     fot. Fyra saker som gäller hela vyn och ingen enskild sektion.
     ============================================================ */

  const SEKTIONSNAMN = {
    oversikt: 'Översikt', leads: 'Intresseanmälningar', ansokningar: 'Ansökningar',
    meddelanden: 'Meddelanden', familjer: 'Familjer', elever: 'Elever',
    studiehjalpare: 'Studiehjälpare', matchning: 'Matchning', bokningar: 'Bokningar',
    lektioner: 'Lektioner', statistik: 'Statistik',
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
        bokningar: NXArbete.flikar($('section[data-sek="bokningar"]')),
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
      ritaKalender();
      ritaLektioner();
      ritaStatistik();
      ritaFakturor();
      ritaUtbetalningar();
      ritaIntegrationer();
      ritaAdminanvandare();
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
