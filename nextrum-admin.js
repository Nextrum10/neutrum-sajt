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
      supa.from('students').select('id, parent_id, name, grade, school, subjects, goals'),
      supa.from('tutor_profiles').select('id, age, school, city, subjects, grade_levels, status, hourly_rate, created_at')
    ]);
    if (profiler.error) throw profiler.error;

    S.personer = {};
    (profiler.data || []).forEach(p => { S.personer[p.id] = p; });

    S.elever = {};
    (elever.data || []).forEach(e => {
      (S.elever[e.parent_id] = S.elever[e.parent_id] || []).push(e);
    });

    S.tutorProfiler = {};
    (tutorer.data || []).forEach(t => { S.tutorProfiler[t.id] = t; });

    const [leads, ans, kontakt, bok, fakt, utb, chatt, fel, pris, integ] = await Promise.all([
      supa.from('leads').select('*').order('created_at', { ascending: false }),
      supa.from('applications').select('*').order('created_at', { ascending: false }),
      supa.from('contact_messages').select('*').order('created_at', { ascending: false }),
      supa.from('bookings').select('id, parent_id, tutor_id, student_id, subject, format, wanted_date, wanted_time, duration_min, status, attendance, created_at').order('wanted_date', { ascending: false }),
      supa.from('invoices').select('*').order('period', { ascending: false }),
      supa.from('payouts').select('*').order('period', { ascending: false }),
      supa.from('messages').select('parent_id, tutor_id, sender_id, body, created_at, read_at').order('created_at', { ascending: false }).limit(400),
      supa.from('klientfel').select('*').order('created_at', { ascending: false }).limit(100),
      supa.from('prissattning').select('*').limit(1),
      supa.from('integrationer').select('*')
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

  /* ============================================================
     ÖVERSIKTEN
     ============================================================ */

  async function ritaÖversikt() {
    const host = $('#adm-tal');
    const { data, error } = await supa.from('admin_lage').select('*').limit(1);

    /* Vyn ligger i schema-v13.sql. Är den inte körd säger vi det
       rakt ut med filnamnet, i stället för att visa nollor som
       läser som "inget att göra". */
    if (error || !data || !data.length) {
      host.innerHTML = '<div class="empty" style="grid-column:1/-1"><b>Nyckeltalen saknas</b><br>'
        + '<span>Vyn <code>admin_lage</code> finns inte i databasen än. Kör '
        + '<code>schema-v13.sql</code> i Supabase → SQL Editor, så fylls den här raden.</span></div>';
      ritaÖversiktslistor();
      return;
    }

    const l = data[0];
    const tal = [
      ['Nya intresseanmälningar', l.nya_leads, l.nya_leads > 0],
      ['Nya ansökningar', l.nya_ansokningar, l.nya_ansokningar > 0],
      ['Studiehjälpare att godkänna', l.vantande_studiehjalpare, l.vantande_studiehjalpare > 0],
      ['Familjer utan match', l.omatchade_familjer, l.omatchade_familjer > 0],
      ['Ohanterade meddelanden', l.ohanterade_meddelanden, l.ohanterade_meddelanden > 0],
      ['Obesvarade passförfrågningar', l.obesvarade_pass, l.obesvarade_pass > 0],
      ['Kommande pass', l.kommande_pass, false],
      ['Obetalda fakturor', l.obetalda_fakturor, l.obetalda_fakturor > 0],
      ['Utestående belopp', kronor(l.obetalt_ore), false],
      ['Att betala ut', kronor(l.att_betala_ut_ore), false]
    ];
    host.innerHTML = tal.map(t =>
      '<div class="adm-kpi' + (t[2] ? ' ar-larm' : '') + '">'
      + '<b>' + esc(String(t[1])) + '</b><span>' + esc(t[0]) + '</span></div>').join('');

    märkFlik('#flik-fakt-mark', l.obetalda_fakturor);
    märkFlik('#flik-inkorg-mark', l.ohanterade_meddelanden);
    if (S.sido) {
      S.sido.märke('leads', l.nya_leads);
      S.sido.märke('ansokningar', l.nya_ansokningar);
      S.sido.märke('meddelanden', l.ohanterade_meddelanden);
      S.sido.märke('studiehjalpare', l.vantande_studiehjalpare);
    }
    ritaÖversiktslistor();
  }

  function ritaÖversiktslistor() {
    const nya = S.leads.filter(l => l.status === 'new').slice(0, 4);
    $('#ov-leads').innerHTML = !nya.length
      ? tomt('Inga nya intresseanmälningar', 'Allt inkommet är påbörjat.')
      : nya.map(l => rad(l.parent_name, [l.subject, l.grade].filter(Boolean).join(' · ') || l.email,
        kortDatum(l.created_at))).join('');

    const omatchade = Object.values(S.personer)
      .filter(p => p.role === 'parent' && p.match_status !== 'matched').slice(0, 4);
    $('#ov-omatchade').innerHTML = !omatchade.length
      ? tomt('Alla familjer är matchade', 'Ingen står och väntar.')
      : omatchade.map(p => rad(p.full_name || p.email,
        (S.elever[p.id] || []).map(e => e.name).join(', ') || 'Inga barn inlagda än',
        kortDatum(p.created_at))).join('');

    const väntande = Object.values(S.tutorProfiler).filter(t => t.status === 'pending').slice(0, 4);
    $('#ov-vantande').innerHTML = !väntande.length
      ? tomt('Inga som väntar', 'Alla konton är avgjorda.')
      : väntande.map(t => rad(namnFör(t.id),
        [t.city, (t.subjects || []).join(', ')].filter(Boolean).join(' · '),
        kortDatum(t.created_at))).join('');

    const idag = isoFor(new Date());
    const kommande = S.bokningar
      .filter(b => b.wanted_date >= idag && (b.status === 'requested' || b.status === 'confirmed'))
      .sort((a, b) => (a.wanted_date + (a.wanted_time || '')).localeCompare(b.wanted_date + (b.wanted_time || '')))
      .slice(0, 4);
    $('#ov-pass').innerHTML = !kommande.length
      ? tomt('Inga pass framåt', 'Ingen har bokat något ännu.')
      : kommande.map(b => rad(
        kortDatum(b.wanted_date) + (b.wanted_time ? ' kl. ' + String(b.wanted_time).slice(0, 5) : ''),
        namnFör(b.parent_id) + ' · ' + namnFör(b.tutor_id),
        BOK_LAGE[b.status] ? BOK_LAGE[b.status][0] : b.status)).join('');
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
    ], rader, 'Inga intresseanmälningar matchar');
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
    ], rader, 'Inga ansökningar matchar');
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
    ], rader, bara ? 'Inget ohanterat kvar' : 'Inga meddelanden matchar');
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
     FAMILJER — matchningen
     ============================================================ */

  function godkändaTutorer() {
    return Object.values(S.tutorProfiler)
      .filter(t => t.status === 'approved')
      .map(t => ({ id: t.id, namn: namnFör(t.id), ort: t.city, amnen: (t.subjects || []).join(', ') }))
      .sort((a, b) => a.namn.localeCompare(b.namn, 'sv'));
  }

  function ritaFamiljer() {
    const sök = $('#fam-sok').value.trim();
    const st = $('#fam-status').value;
    const alla = Object.values(S.personer).filter(p => p.role === 'parent')
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const rader = alla
      .filter(p => !st || (st === 'matched' ? p.match_status === 'matched' : p.match_status !== 'matched'))
      .filter(p => matchar(p, ['full_name', 'email', 'phone'], sök));

    const tutorer = godkändaTutorer();

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
        /* Matchningen ÄR den här rullgardinen. Förr var den två
           kolumner i Table Editor: matched_tutor_id och
           match_status, som måste sättas i rätt ordning för att
           vyn skulle låsas upp. Här är det ett val. */
        if (!tutorer.length) {
          return '<span class="xsmall" style="color:var(--bl-3)">Inga godkända studiehjälpare än</span>';
        }
        return '<select class="sel" style="min-width:168px;max-width:200px;padding:7px 28px 7px 10px;font-size:.84rem" '
          + 'data-match="' + p.id + '" aria-label="Matcha med studiehjälpare">'
          + '<option value="">Ingen — väntar</option>'
          + tutorer.map(t => '<option value="' + t.id + '"'
            + (p.matched_tutor_id === t.id ? ' selected' : '') + '>'
            + esc(t.namn) + (t.ort ? ' · ' + esc(t.ort) : '') + '</option>').join('')
          + '</select>'
          + '<button class="btn btn-ghost btn-sm" style="margin-left:6px" data-not="' + p.id
          + '" title="Anteckningar" aria-label="Anteckningar om ' + esc(p.full_name || p.email || '') + '">✎</button>';
      } }
    ], rader, 'Inga familjer matchar');
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
    ], rader, 'Inga studiehjälpare matchar');
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
    ], rader, 'Inga bokningar matchar');
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

    /* Matchningen. Två fält, alltid tillsammans: en familj med en
       studiehjälpare men match_status = 'pending' ser en låst vy
       och förstår inte varför. Det var det gamla felet i Table
       Editor, där de var två kolumner man kunde glömma. */
    if (el.dataset && el.dataset.match) {
      const p = S.personer[el.dataset.match];
      const nyTutor = el.value || null;
      const gammal = { t: p.matched_tutor_id, s: p.match_status };
      p.matched_tutor_id = nyTutor;
      p.match_status = nyTutor ? 'matched' : 'pending';
      const ok = await skriv('profiles', p.id,
        { matched_tutor_id: nyTutor, match_status: p.match_status });
      if (!ok) { p.matched_tutor_id = gammal.t; p.match_status = gammal.s; }
      ritaFamiljer(); ritaStudiehjalpare(); ritaÖversikt();
      return;
    }

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

      function följHash() {
        const [huvud, flik] = String(location.hash || '').replace(/^#/, '').split('/');
        if (flik && S.flikar[huvud]) S.flikar[huvud].visa(flik);
      }
      window.addEventListener('hashchange', följHash);
      följHash();

      S.hero = NXArbete.hero({
        host: $('#vy-hero'),
        namn: S.profil.full_name,
        etikett: 'Adminvy',
        lede: 'Intresseanmälningar, matchning, bokningar, fakturor och utbetalningar.',
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
      const attGöra = S.leads.filter(l => l.status === 'new').length
        + Object.values(S.tutorProfiler).filter(t => t.status === 'pending').length;

      S.hero.uppdatera({
        nasta: nästa ? {
          href: '#bokningar',
          text: 'Nästa pass · ' + kortDatum(nästa.wanted_date)
            + (nästa.wanted_time ? ' kl. ' + String(nästa.wanted_time).slice(0, 5) : ''),
          under: namnFör(nästa.parent_id) + ' · ' + namnFör(nästa.tutor_id)
        } : { href: '#bokningar', text: 'Inga pass framåt', under: 'Ingen har bokat ännu' },
        chatt: attGöra
          ? { href: '#leads', text: attGöra + (attGöra === 1 ? ' sak att göra' : ' saker att göra'),
              under: 'Nya anmälningar och konton att godkänna' }
          : { href: '#leads', text: 'Inget som väntar', under: 'Inkorgen är tom' }
      });

      supa.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', S.user.id);
    } catch (fel) {
      visaFel(fel, 'adminvyn skulle hämtas');
    }
  }

  start();
})();
