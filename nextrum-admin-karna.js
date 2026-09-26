/* ============================================================
   NEXTRUM — adminvyn, kärnan: tillstånd, hjälpare och hämtningar som alla områden delar

   En del av nextrum-admin.js, utflyttad i Fas 6 utan att någon
   funktion skrivits om. Kärnan (nextrum-admin-karna.js) laddas
   först och delar tillståndet S och hjälparna; varje område
   registrerar de funktioner andra områden anropar i
   NXAdmin.rita. Skalet (nextrum-admin.js) laddas sist och
   startar vyn. Ordningen står i admin.html.
   ============================================================ */
const NXAdmin = (function () {
  'use strict';

  const { $, $$, esc, säg, rensa, felText, datumText, isoFor } = NX;
  const { bekräfta, medan, tomt, laddar } = NXStudie;
  const kronor = NXBetalning.kronor;
  const M = NXMedia;

  /* Områdenas funktioner, fyllda av varje områdesfil. Kärnan själv
     anropar dem bara efter att alla filer laddats. */
  const rita = {};

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
    leads: [], ansokningar: [], kontakt: [], bokningar: [], bibliotek: [],
    /* Fas 16.1: mejlen till den som sökt jobb, per ansökan. */
    ansokanUtskick: {}, ansokanUtskickFel: null,
    fakturor: [], utbetalningar: [], chattar: [], klientfel: [], notisfel: [],
    integrationer: [], pris: null, tjanster: [], rabattkoder: [], saknasV13: [],
    elevlista: [], rapporter: [], lage: null, attGora: [],
    matchunderlag: [], matchunderlagFel: null, valdElev: null, kalender: null,
    matForslag: [], detaljCache: {},
    /* Fas 6: uppdrag, uppgifter, RUT-tak, auditloggens senaste
       rader och databasens lista över ekonomiska avvikelser. */
    uppdrag: [], uppgifter: [], rutTak: [], audit: [], auditAktorer: [],
    avvikelser: [], avvikelserFel: null,
    /* Fas 9: analysvyerna. Tomma tills hämtaAnalys() kört, så att
       statistiken ritar "hämtar" i stället för nollor. */
    analys: { kallor: [], konvertering: [], aktiva: [], ekonomi: [], avbokningar: [] },
    analysFel: null,
    /* Fas 9.10: handlingar om verksamheten. Hämtas först när fliken
       öppnas — de läses sällan och är inte en del av arbetskön. */
    handlingar: [], handlingarFel: null
  };

  /* Har modulvakten (nextrum-modulvakt.js) redan konstaterat att en
     fil inte kom fram står felrutan kvar. Utan den raden ritade
     skalet över den med inloggningsrutan, och en adminvy som saknar
     halva sin kod bad i stället om lösenord och gjorde sedan
     ingenting när det matades in. */
  function visa(id) {
    if (document.documentElement.dataset.modulfel && id !== 'view-fel') return;
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
  /* Fas 9.4. Koderna är databasens och står i en CHECK; texten är
     vår. Skälet sätts av Nextrum i efterhand, aldrig av den som
     avbokar: att släppa in fältet i skydda_bokningsfalts vitlista
     hade vidgat F-6, och en fritextruta hade gjort avbokningarna
     till något ingen kan räkna på. Tomt är ett eget läge — ett skäl
     som saknas är inte "annat". */
  const AVBOKNINGSSKAL = {
    '': ['Skäl saknas', ''], sjukdom: ['Sjukdom', ''], forhinder: ['Förhinder', ''],
    ombokat: ['Ombokat', ''], ingen_hjalpare: ['Ingen studiehjälpare', ''],
    familjen_avslutar: ['Familjen avslutar', ''], annat: ['Annat', '']
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
      supa.from('students').select('id, parent_id, name, grade, school, subjects, goals, about, behov, format_onskemal, created_at, matched_tutor_id, match_status, uppdrag_id'),
      supa.from('tutor_profiles').select('id, age, school, city, subjects, grade_levels, status, hourly_rate, visa_publikt, created_at')
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

    const [leads, ans, kontakt, bok, fakt, utb, chatt, fel, notis, pris, integ, tj, rk, rapporter,
           upd, uppg, rt, audit, bib, flaggor, tvister, fsparr, kk, ansUt] = await Promise.all([
      supa.from('leads').select('*').order('created_at', { ascending: false }),
      supa.from('applications').select('*').order('created_at', { ascending: false }),
      supa.from('contact_messages').select('*').order('created_at', { ascending: false }),
      supa.from('bookings').select('id, parent_id, tutor_id, student_id, subject, tjanst, format, wanted_date, wanted_time, duration_min, status, attendance, created_at, uppdrag_id, avbokad_at, avbokad_av, avbokningsskal, betalning_status, fakturerbar, begart_ore, betalt_ore, ersattning_ore, avgift_ore, aterbetald_ore, betald_at, stripe_payment_intent_id, stripe_transfer_id, stripe_charge_id, stripe_avgift_ore, stripe_netto_ore, stripe_skarp, klippkort_id').order('wanted_date', { ascending: false }),
      /* Raderna följer med (Fas 14.6): de är underlaget admin lägger in
         i Fortnox, och vilket pass som står på vilken faktura. */
      supa.from('invoices').select('*, invoice_lines(id, booking_id, beskrivning, minuter, pris_per_timme_ore, belopp_ore)')
        .order('period', { ascending: false }),
      supa.from('payouts').select('*').order('period', { ascending: false }),
      supa.from('messages').select('parent_id, tutor_id, sender_id, body, created_at, read_at').order('created_at', { ascending: false }).limit(400),
      supa.from('klientfel').select('*').order('created_at', { ascending: false }).limit(100),
      /* Notisutskick som inte gick fram. Funktionen är admin-only i
         databasen; en icke-admin som anropar den får noll rader. */
      supa.rpc('notisfel', { timmar: 24 }),
      supa.from('prissattning').select('*').limit(1),
      supa.from('integrationer').select('*'),
      supa.from('tjanster').select('*').order('ordning'),
      supa.from('rabattkoder').select('*').order('skapad', { ascending: false }),
      /* Rapporterna används bara av aktivitetsflödet, och bara de
         senaste. Ett "lektion genomförd" i flödet är ett pass som
         faktiskt rapporterats, inte ett pass vars datum passerat. */
      supa.from('lesson_reports').select('id, student_id, tutor_id, lesson_date, created_at')
        .order('created_at', { ascending: false }).limit(40),
      /* Fas 6. Alla fyra är admin-only i databasen. Auditloggen växer
         för alltid; här de senaste 300 raderna.

         Sedan Fas 9.8 söker auditfliken i databasen (audit_sok), och
         de här raderna används bara till att fylla listan över VEM
         man kan filtrera på. Därför en egen plats i S: annars hade
         sökningens svar och den här listan skrivit över varandra. */
      supa.from('uppdrag').select('*').order('created_at', { ascending: false }),
      supa.from('uppgifter').select('*').order('created_at', { ascending: false }),
      supa.from('rut_tak').select('*').order('ar', { ascending: false }),
      supa.from('audit_logg').select('aktor').order('tid', { ascending: false }).limit(300),
      supa.from('biblioteksmaterial').select('*').order('created_at', { ascending: false }),
      /* Fas 14.2: spärren "ingen betalning, inget pass". En rad i
         flaggor, som notismejlen. Slås om under Ekonomi →
         Kortbetalningar, där det den styr också syns. */
      /* Fas 14.6: och strömbrytaren för faktura som betalsätt, samma
         sort. Båda i en fråga. */
      /* Fas 16.1: och erbjudandena, samma sort. */
      supa.from('flaggor').select('*').in('kod', ['kortsparr', 'faktura', 'erbjudanden']),
      /* Fas 14.3: korttvisterna, med sista dagen att svara. Bara admin
         ser tabellen; för alla andra är svaret tomt. */
      supa.from('stripe_tvister').select('*').order('skapad', { ascending: false }),
      /* Fas 14.6: familjer som inte får välja faktura. */
      supa.from('faktura_sparr').select('parent_id, satt_at'),
      /* Fas 16.1: köpta planer och klippkort, med timmarna räknade i
         databasen och vad som går tillbaka om familjen slutar i dag. */
      supa.from('klippkort_saldo').select('*').order('created_at', { ascending: false }),
      /* Fas 16.1: vilka besked den som sökt jobb har fått. Tabellen
         bär ingen adress och ingen brödtext, bara steg och utfall.
         Bara admin läser den. */
      supa.from('ansokan_utskick').select('ansokan_id, steg, status, forsok, fel, skapad, uppdaterad')
        .order('skapad', { ascending: false })
    ]);

    S.leads = leads.data || [];
    S.bibliotek = bib.data || [];
    S.ansokningar = ans.data || [];
    /* Nyast först per ansökan, så att ett ombokat möte visar det
       senaste mejlet och inte det första. */
    S.ansokanUtskick = {};
    (ansUt.data || []).forEach(r => {
      (S.ansokanUtskick[r.ansokan_id] = S.ansokanUtskick[r.ansokan_id] || []).push(r);
    });
    S.ansokanUtskickFel = ansUt.error ? felText(ansUt.error) : null;
    S.kontakt = kontakt.data || [];
    S.bokningar = bok.data || [];
    S.fakturor = fakt.data || [];
    S.utbetalningar = utb.data || [];
    S.klientfel = fel.data || [];
    S.notisfel = notis.data || [];
    S.pris = (pris.data || [])[0] || null;
    S.integrationer = integ.data || [];
    S.tjanster = tj.data || [];
    S.rabattkoder = rk.data || [];
    S.rapporter = rapporter.data || [];
    S.uppdrag = upd.data || [];
    S.uppgifter = uppg.data || [];
    S.rutTak = rt.data || [];
    S.auditAktorer = audit.data || [];
    /* null betyder att raden inte gick att läsa, inte att spärren är
       av. Kortet säger det i stället för att visa ett läge det inte vet. */
    S.kortsparr = (flaggor.data || []).find(f => f.kod === 'kortsparr') || null;
    S.kortsparrFel = flaggor.error ? felText(flaggor.error) : null;
    S.fakturaFlagga = (flaggor.data || []).find(f => f.kod === 'faktura') || null;
    S.erbFlagga = (flaggor.data || []).find(f => f.kod === 'erbjudanden') || null;
    S.klippkort = kk.data || [];
    S.klippkortFel = kk.error ? felText(kk.error) : null;
    S.fakturaSparr = new Set((fsparr.data || []).map(r => r.parent_id));
    S.fakturaSparrFel = fsparr.error ? felText(fsparr.error) : null;
    /* Ett läsfel är inte "inga tvister": rutan säger att den inte
       kunde läsa, i stället för att se lugn ut. */
    S.tvister = tvister.data || [];
    S.tvisterFel = tvister.error ? felText(tvister.error) : null;

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

  /* Passunderlaget (Fas 2): varje genomfört pass, och om det kan
     faktureras — har det en rapport, är det undantaget, är det redan
     med. Samma vy som månadskörningen väljer ur, så att avvikelserna
     här är exakt de pass körningen hoppar över.

     Till det de fristående rapporterna, som kan kopplas till ett pass
     som saknar sin. Saknas vyn — migrationen inte körd — säger
     avvikelsefliken det, i stället för att hela vyn dör. */
  async function hämtaEkonomiunderlag() {
    const [pu, fri, avv] = await Promise.all([
      supa.from('passunderlag').select('*').order('wanted_date', { ascending: false }),
      supa.from('lesson_reports').select('id, student_id, tutor_id, lesson_date, created_at, raw_notes')
        .is('booking_id', null).order('lesson_date', { ascending: false }),
      /* Fas 6: allt annat som inte går ihop, räknat i databasen. */
      supa.rpc('ekonomiska_avvikelser')
    ]);
    S.passunderlagFel = pu.error ? felText(pu.error) : null;
    S.passunderlag = pu.data || [];
    S.fristaendeRapporter = fri.data || [];
    S.avvikelserFel = avv.error ? felText(avv.error) : null;
    S.avvikelser = avv.data || [];
  }

  /* ------------------------------------------------------------
     ANALYSVYERNA (Fas 9.6)

     Statistiken räknade förut i webbläsaren, ur S.bokningar och
     S.fakturor. Det gick, men det gav TVÅ definitioner av samma
     sak: grafen räknade status='completed', medan noten under den
     lovade "genomfört när rapporten finns". Tre av fem completed-
     pass i driften saknar rapport, så grafen var för hög och
     texten falsk.

     Nu kommer talen ur analysvyerna, som alla bygger på
     passunderlag.har_rapport. En definition, ett ställe.
     ------------------------------------------------------------ */
  async function hämtaAnalys() {
    const [kallor, konv, aktiva, ekonomi, avbok] = await Promise.all([
      supa.from('analys_leads_per_kalla').select('*').order('manad', { ascending: false }),
      supa.from('analys_konvertering').select('*').order('manad', { ascending: false }),
      supa.from('analys_aktiva').select('*').order('manad', { ascending: false }),
      supa.from('analys_ekonomi').select('*').order('manad', { ascending: false }),
      supa.from('analys_avbokningar').select('*')
    ]);
    /* Ett fel per vy, inte ett för hela statistiken: saknas en vy
       ska de andra fyra fortfarande gå att läsa. */
    S.analysFel = [kallor, konv, aktiva, ekonomi, avbok]
      .filter(r => r.error).map(r => felText(r.error)).join(' · ') || null;
    S.analys = {
      kallor: kallor.data || [],
      konvertering: konv.data || [],
      aktiva: aktiva.data || [],
      ekonomi: ekonomi.data || [],
      avbokningar: avbok.data || []
    };
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
    /* Poängen per elev hämtas var för sig ur databasen (Fas 8) och
       cachas. Ändras underlaget är den cachen gammal — och ett gammalt
       fel ska inte hindra nästa försök. */
    S.matchpoang = {};
    S.matchpoangFel = {};
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

  /* Elevens egen studiehjälpare sedan schema-v14. Föll tidigare
     tillbaka på familjens, vilket var hela problemet: två syskon
     i olika ämnen kunde inte ha var sin. */
  function elevHjälpare(e) {
    if (!e.matched_tutor_id || e.match_status !== 'matched') return null;
    return S.personer[e.matched_tutor_id]
      || { id: e.matched_tutor_id, full_name: null };
  }

  function elevNamn(id) {
    const e = (S.elevlista || []).find(x => x.id === id);
    return e ? (e.name || '—') : '—';
  }

  /* ============================================================
     VISA EN RUTA

     .nx-fraga har opacity:0 i grunden och blir synlig först med
     klassen .open (nextrum-vy.css:447). Adminvyns fyra egenbyggda
     rutor la aldrig på den. De fanns alltså på skärmen — position
     fixed, inset 0, z-index 900 — fullt klickbara och helt
     osynliga, med sidans rullning låst. Utifrån såg det ut som att
     Kontakta och Skapa elev hängde sig: inget syntes, inget gick
     att rulla, och ett klick var som helst stängde det som inte
     syntes.

     Felet gick att göra fyra gånger för att varje ruta monterade
     sig själv. Nu finns en väg in, och den lägger på klassen.
     Reflowen mellan är inte prydnad: utan den ser webbläsaren bara
     ett element som föddes med .open och animerar ingenting — men
     framför allt är det den som gör att regeln hinner gälla. */
  function visaRuta(ruta) {
    document.body.appendChild(ruta);
    document.body.style.overflow = 'hidden';
    void ruta.offsetWidth;
    ruta.classList.add('open');
    return ruta;
  }

  /* En ruta med ett eget fält. bekräfta() räcker när svaret är ja
     eller nej; här behövs ett val eller en text. läs() får rutan och
     svarar { värde } eller { fel } — ett fel stänger inte rutan. */
  function fråga(o) {
    return new Promise(klar => {
      const ruta = document.createElement('div');
      ruta.className = 'nx-fraga';
      ruta.innerHTML =
        '<div class="nx-fraga-box" role="dialog" aria-modal="true" aria-labelledby="fr-t">'
        + '<h3 id="fr-t">' + esc(o.titel) + '</h3>'
        + (o.text ? '<p>' + esc(o.text) + '</p>' : '')
        + o.innehåll
        + '<p class="ok-msg" id="fr-msg"></p>'
        + '<div class="nx-fraga-knappar">'
        + '<button type="button" class="btn btn-ghost" data-fr="nej">Avbryt</button>'
        + '<button type="button" class="btn btn-primary" data-fr="ja">' + esc(o.knapp) + '</button>'
        + '</div></div>';
      visaRuta(ruta);

      const stäng = v => { ruta.remove(); document.body.style.overflow = ''; klar(v); };
      ruta.addEventListener('click', ev => {
        if (ev.target === ruta || ev.target.closest('[data-fr="nej"]')) { stäng(null); return; }
        if (!ev.target.closest('[data-fr="ja"]')) return;
        const svar = o.läs(ruta) || {};
        if (svar.fel) { säg($('#fr-msg', ruta), svar.fel, false); return; }
        stäng(svar.värde);
      });
      ruta.addEventListener('keydown', ev => { if (ev.key === 'Escape') stäng(null); });
      const först = ruta.querySelector('input, textarea, select') || ruta.querySelector('[data-fr="ja"]');
      if (först) först.focus();
    });
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

  /* ============================================================
     KONTAKTRUTAN

     Adminvyn kunde se att någon hört av sig men inte svara dem.
     Enda vägen var att kopiera adressen och byta program, och det
     som hände där syntes aldrig i systemet — en anmälan såg
     obesvarad ut för alltid.

     VARFÖR mailto: OCH INTE ETT UTSKICK HÄRIFRÅN

     Svaret ska komma från en riktig person och gå att svara på. Ett
     mejl skickat av servern har vår avsändare men ingen som läser
     svaret, och det första en familj gör är att svara. Med mailto:
     hamnar utkastet i ert eget mejlprogram, med er adress som
     avsändare och hela tråden där ni sedan letar efter den.

     Systemet stämplar kontaktad_at när utkastet öppnas. Det är inte
     bevis på att mejlet skickades — men "vi öppnade ett svar till
     den här personen" är oändligt mycket mer än vad som fanns förut,
     och stämpeln går att ta bort om man ångrar sig.
     ============================================================ */
  function kontaktaRuta(o) {
    const ruta = document.createElement('div');
    ruta.className = 'nx-fraga';
    ruta.innerHTML =
      '<div class="nx-fraga-box nx-fraga-bred" role="dialog" aria-modal="true" aria-labelledby="kt-t">'
      + '<h3 id="kt-t">' + esc(o.titel || 'Skriv till ' + (o.namn || '')) + '</h3>'
      + '<p>Utkastet öppnas i ditt mejlprogram med din adress som avsändare, så att '
      + 'svaret kommer till dig. Ändra fritt innan du skickar.</p>'
      + '<div class="fgroup"><label for="kt-till">Till</label>'
      + '<input class="inp" id="kt-till" value="' + esc(o.till || '') + '"></div>'
      + '<div class="fgroup" style="margin-top:12px"><label for="kt-amne">Ämne</label>'
      + '<input class="inp" id="kt-amne" value="' + esc(o.amne || '') + '"></div>'
      + '<div class="fgroup" style="margin-top:12px"><label for="kt-text">Meddelande</label>'
      + '<textarea class="inp" id="kt-text" rows="12">' + esc(o.text || '') + '</textarea></div>'
      + '<p class="ok-msg" id="kt-msg"></p>'
      + '<div class="nx-fraga-knappar">'
      + '<button type="button" class="btn btn-ghost" data-kt-stang>Avbryt</button>'
      + '<button type="button" class="btn btn-primary" id="kt-oppna">Öppna i mejl</button>'
      + '</div></div>';

    visaRuta(ruta);
    const stäng = () => { ruta.remove(); document.body.style.overflow = ''; };
    ruta.addEventListener('click', ev => {
      if (ev.target === ruta || ev.target.closest('[data-kt-stang]')) stäng();
    });

    $('#kt-oppna', ruta).addEventListener('click', async () => {
      const till = $('#kt-till', ruta).value.trim();
      if (!till) { säg($('#kt-msg', ruta), 'Fyll i en adress.', false); return; }

      /* encodeURIComponent på både ämne och kropp. Ett svenskt
         tecken eller en radbrytning i klartext kapar annars mejlet
         på vägen till mejlprogrammet. */
      const url = 'mailto:' + encodeURIComponent(till)
        + '?subject=' + encodeURIComponent($('#kt-amne', ruta).value)
        + '&body=' + encodeURIComponent($('#kt-text', ruta).value);
      window.location.href = url;

      if (typeof o.efterat === 'function') await o.efterat();
      stäng();
    });
  }


  const DP = {
    bak: null, panel: null, typ: null, id: null, flik: null
  };

  return {
    ANS_LAGE, AVBOKNINGSSKAL, BOK_LAGE, DAG, DP, FAKT_LAGE, LEAD_LAGE, S, SH_LAGE,
    UTB_LAGE, dagarSedan, elevHjälpare, elevNamn, fråga, funktionsFel,
    hämtaAllt, hämtaAnalys, hämtaEkonomiunderlag, hämtaMatchunderlag, kontaktaRuta,
    kortDatum, läge, matchar, märkFlik, namnFör, närText, pill, rad, skriv,
    tabell, tomtText, visa, visaRuta, väljare, rita
  };
})();
