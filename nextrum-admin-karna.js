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
    leads: [], ansokningar: [], kontakt: [], bokningar: [],
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
    handlingar: [], handlingarFel: null,
    /* Program 2, Fas 1: id för de studiehjälpare som bjudits in
       härifrån, läst ur anteckningarna. Se INBJUDAN_NOT. */
    inbjudna: new Set()
  };

  /* Anteckningen som skrivs när en studiehjälpare bjuds in härifrån.
     Den är det enda spåret av inbjudan: bjud-in loggar ingenting, och
     auth.users går inte att läsa från vyn. Pillen "Inbjuden" byggde
     förut på att personen aldrig loggat in, men last_seen_at skrivs
     aldrig för studiehjälpare, så pillen hade suttit på varje väntande
     som registrerat sig själv. Texten jämförs exakt, så den ändras
     inte utan att hämtningen nedan ändras med den. */
  const INBJUDAN_NOT = 'Inbjuden härifrån som studiehjälpare.';

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
    /* bio, formats och stripe_klar hämtades inte, fast detaljpanelen
       visar dem. "Om familjen", Format och "Om hen" stod därför alltid
       tomma, och Stripe sa alltid "inte kopplad". Kolumnnamnen är
       kontrollerade mot katalogen (program 2, Fas 1).

       avatar_url hämtas med flit INTE. Den är en sökväg i den privata
       hinken, inte en adress, och M.avatar() lägger den rakt i en
       <img src>. Med kolumnen hade panelen visat en trasig bild i
       stället för initialerna. */
    const [profiler, elever, tutorer] = await Promise.all([
      supa.from('profiles').select('id, role, full_name, email, is_admin, match_status, matched_tutor_id, phone, bio, created_at, last_seen_at'),
      supa.from('students').select('id, parent_id, name, grade, school, subjects, goals, created_at, matched_tutor_id, match_status, uppdrag_id'),
      supa.from('tutor_profiles').select('id, age, school, city, subjects, grade_levels, formats, bio, status, hourly_rate, stripe_klar, visa_publikt, created_at')
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
           upd, uppg, rt, audit, inbjudna] = await Promise.all([
      supa.from('leads').select('*').order('created_at', { ascending: false }),
      supa.from('applications').select('*').order('created_at', { ascending: false }),
      supa.from('contact_messages').select('*').order('created_at', { ascending: false }),
      supa.from('bookings').select('id, parent_id, tutor_id, student_id, subject, tjanst, format, wanted_date, wanted_time, duration_min, status, attendance, created_at, uppdrag_id, avbokad_at, avbokad_av, avbokningsskal').order('wanted_date', { ascending: false }),
      supa.from('invoices').select('*').order('period', { ascending: false }),
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
      /* Bara inbjudningarna, inte alla anteckningar: de läses per
         person i detaljpanelen. Går frågan fel blir mängden tom, och
         då visas ingen pill alls. Hellre det än en pill som påstår
         något vi inte vet. */
      supa.from('admin_noteringar').select('om_profil').eq('text', INBJUDAN_NOT)
    ]);

    S.leads = leads.data || [];
    S.ansokningar = ans.data || [];
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
    S.inbjudna = new Set((inbjudna.data || []).map(n => n.om_profil));

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
     RUTORNA

     .nx-fraga står med opacity 0 tills den får klassen open
     (nextrum-vy.css). bekräfta() i NXStudie sätter den, men adminvyns
     egna rutor gjorde det aldrig. I drift blev varje sådan ruta ett
     osynligt lager över hela skärmen: sidan slutade rulla, och nästa
     klick stängde lagret eller hamnade i ett fält ingen såg. Kontakta,
     Skapa elev, Bjud in och Ta in i poolen gick alltså inte att använda.

     Därför EN väg in för varje ruta i adminvyn. Den gör det som alla
     rutor behöver och som var och en hade glömt något av:

       1. lägger in rutan och tvingar en omritning INNAN open sätts,
          annars ser webbläsaren aldrig starttillståndet och
          övergången uteblir
       2. låser rullningen bakom, och släpper den först när den SISTA
          rutan stängts: en bekräftelse kan ligga ovanpå
       3. flyttar fokus in, och tillbaka dit det kom ifrån
       4. håller Tab inne i rutan
       5. stänger på Escape och på klick på bakgrunden, men bara när
          rutan är den översta
       6. går INTE att stänga medan den arbetar, se nedan

     Svarar med stäng(). o.vidStängning körs en gång, efter att rutan
     tagits bort. o.först väljer fältet som får fokus, o.återFokus ger
     elementet fokus ska tillbaka till när det ursprungliga ritats om
     under tiden (detaljpanelen ritas om i sin helhet).

     MEDAN RUTAN ARBETAR. En ruta arbetar när något i den bär
     aria-busy="true", och det sätter medan() på knappen som trycktes.
     Då stänger varken Escape eller bakgrundsklicket, och knappar
     märkta data-ruta-avbryt stängs av. Förut gick alla tre att använda
     under "Skickar…": rutan försvann, men arbetet fortsatte. Inbjudan
     gick iväg, barnen skapades, och det som gick fel skrevs i en ruta
     som inte längre fanns. Admin fick aldrig veta att familjen fått
     ett mejl men saknade sitt barn. stäng() själv spärras inte: koden
     i rutan anropar den när arbetet lyckats, och det är just då.
     ============================================================ */
  const FOKUSERBARA = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]),'
    + ' select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function öppnaRuta(ruta, o) {
    const opt = o || {};
    const tidigare = document.activeElement;
    let stängd = false;
    let nedPå = null;

    const överst = () => {
      const alla = document.querySelectorAll('.nx-fraga');
      return alla.length > 0 && alla[alla.length - 1] === ruta;
    };
    const fokusbara = () => Array.from(ruta.querySelectorAll(FOKUSERBARA))
      .filter(el => !el.closest('[hidden]')
        && (el.offsetParent !== null || el === document.activeElement));
    const arbetar = () => !!ruta.querySelector('[aria-busy="true"]');

    /* Avbryt-knapparna följer aria-busy. En observatör i stället för
       ett anrop i varje flöde: medan() vet inte vilken ruta knappen
       sitter i, och ett flöde som glömmer att låsa är precis det fel
       som ska bort. childList också, för en arbetande knapp som tas
       bort ur rutan ändrar inget attribut men låser upp den. */
    const lås = () => {
      const nu = arbetar();
      ruta.querySelectorAll('[data-ruta-avbryt]').forEach(k => { k.disabled = nu; });
    };
    const vakt = new MutationObserver(lås);
    vakt.observe(ruta, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-busy'] });

    /* På document och inte på rutan: klickar man på en yta i rutan
       som inte tar fokus hamnar fokus på body, och då hade Escape
       aldrig nått fram. Överst-kontrollen gör att en bekräftelse som
       öppnats ovanpå stänger sig själv, inte rutan under. */
    function tangent(ev) {
      if (stängd || !överst()) return;
      if (ev.key === 'Escape') {
        ev.preventDefault();
        if (!arbetar()) stäng();
        return;
      }
      if (ev.key !== 'Tab') return;
      const kan = fokusbara();
      if (!kan.length) { ev.preventDefault(); return; }
      const först = kan[0], sist = kan[kan.length - 1];
      if (!ruta.contains(document.activeElement)) {
        ev.preventDefault(); (ev.shiftKey ? sist : först).focus();
      } else if (ev.shiftKey && document.activeElement === först) {
        ev.preventDefault(); sist.focus();
      } else if (!ev.shiftKey && document.activeElement === sist) {
        ev.preventDefault(); först.focus();
      }
    }

    function stäng() {
      if (stängd) return;
      stängd = true;
      vakt.disconnect();
      document.removeEventListener('keydown', tangent);
      ruta.remove();
      if (!document.querySelector('.nx-fraga.open')) document.body.style.overflow = '';
      const ny = typeof opt.återFokus === 'function' ? opt.återFokus() : null;
      const åter = ny && document.contains(ny) ? ny
        : tidigare && document.contains(tidigare) ? tidigare : null;
      if (åter && typeof åter.focus === 'function') åter.focus();
      if (typeof opt.vidStängning === 'function') opt.vidStängning();
    }

    /* Bakgrundsklicket räknas bara när det också BÖRJADE på
       bakgrunden. Den som markerar text i ett fält och släpper
       musen utanför rutan ska inte förlora allt hen skrivit. */
    ruta.addEventListener('mousedown', ev => { nedPå = ev.target; });
    ruta.addEventListener('click', ev => {
      const började = nedPå;
      nedPå = null;
      if (ev.target === ruta && började === ruta && överst() && !arbetar()) stäng();
    });
    document.addEventListener('keydown', tangent);

    document.body.appendChild(ruta);
    document.body.style.overflow = 'hidden';
    void ruta.offsetWidth;
    ruta.classList.add('open');

    const först = (opt.först && ruta.querySelector(opt.först))
      || fokusbara().find(el => /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName))
      || fokusbara()[0];
    if (först) först.focus();
    return stäng;
  }

  /* En ruta med ett eget fält. bekräfta() räcker när svaret är ja
     eller nej; här behövs ett val eller en text. läs() får rutan och
     svarar { värde } eller { fel }. Ett fel stänger inte rutan.
     Avbruten ruta svarar null. */
  function fråga(o) {
    return new Promise(klar => {
      const ruta = document.createElement('div');
      ruta.className = 'nx-fraga';
      ruta.innerHTML =
        '<div class="nx-fraga-box" role="dialog" aria-modal="true" aria-labelledby="fr-t">'
        + '<h3 id="fr-t">' + esc(o.titel) + '</h3>'
        + (o.text ? '<p>' + esc(o.text) + '</p>' : '')
        + o.innehåll
        + '<p class="ok-msg" id="fr-msg" role="status"></p>'
        + '<div class="nx-fraga-knappar">'
        + '<button type="button" class="btn btn-ghost" data-fr="nej" data-ruta-avbryt>Avbryt</button>'
        + '<button type="button" class="btn btn-primary" data-fr="ja">' + esc(o.knapp) + '</button>'
        + '</div></div>';

      let svar = null;
      const stäng = öppnaRuta(ruta, {
        först: 'input, textarea, select, [data-fr="ja"]',
        vidStängning: () => klar(svar)
      });
      ruta.addEventListener('click', ev => {
        if (ev.target.closest('[data-fr="nej"]')) { stäng(); return; }
        if (!ev.target.closest('[data-fr="ja"]')) return;
        const s = o.läs(ruta) || {};
        if (s.fel) { säg($('#fr-msg', ruta), s.fel, false); return; }
        svar = s.värde;
        stäng();
      });
    });
  }

  /* ============================================================
     BARNEN I EN RUTA

     Samma fält i Ny familj och i Lägg till barn, så att ett barn som
     läggs in den ena vägen ser ut som ett som läggs in den andra.

     Årskursen är samma lista som familjen väljer ur i sin egen vy.
     Matchningen jämför årskurser som text, och "åk 8" och "Åk 8" är
     två olika saker för den.

     Ämnena är en text[] som inte får vara null (förvalet är en tom
     array). Fritexten delas på komma och tomma bitar tas bort: förut
     gick strängen rakt in, och då svarade databasen 22P02 på
     "matte, svenska" och 23502 på ett tomt fält.
     ============================================================ */
  const ÅRSKURSER = ['Åk 1', 'Åk 2', 'Åk 3', 'Åk 4', 'Åk 5', 'Åk 6', 'Åk 7', 'Åk 8', 'Åk 9',
    'Gymnasiet år 1', 'Gymnasiet år 2', 'Gymnasiet år 3'];

  function delaÄmnen(text) {
    return String(text || '').split(',').map(x => x.trim()).filter(Boolean);
  }

  let barnRäknare = 0;

  function barnFält() {
    barnRäknare++;
    const id = 'nb-' + barnRäknare;
    return '<fieldset data-barn style="border:1px solid var(--ln);border-radius:12px;'
      + 'padding:10px 14px 2px;margin:12px 0 0;min-width:0">'
      + '<legend style="padding:0 6px;font-size:.82rem;font-weight:600">Barn</legend>'
      + '<div class="ag-faltrad">'
      + '<div class="fgroup"><label for="' + id + '-namn">Namn</label>'
      + '<input class="inp" id="' + id + '-namn" data-barn-falt="namn" maxlength="120" autocomplete="off"></div>'
      + '<div class="fgroup"><label for="' + id + '-ak">Årskurs</label>'
      + '<select class="sel" id="' + id + '-ak" data-barn-falt="arskurs"><option value="">Välj</option>'
      + ÅRSKURSER.map(a => '<option>' + esc(a) + '</option>').join('') + '</select></div>'
      + '</div>'
      + '<div class="fgroup"><label for="' + id + '-amnen">Ämnen, med komma emellan</label>'
      + '<input class="inp" id="' + id + '-amnen" data-barn-falt="amnen" maxlength="300"'
      + ' placeholder="t.ex. Matematik, Engelska" autocomplete="off"></div>'
      + '<button type="button" class="btn btn-ghost btn-sm" data-barn-bort'
      + ' style="min-height:44px;margin:0 0 12px">Ta bort barnet</button>'
      + '</fieldset>';
  }

  /* Rubrikerna numreras om efter varje ändring, och Ta bort döljs när
     bara ett barn är kvar: en ruta för barn utan fält för barn är en
     ruta som inte kan göra det den heter. */
  function numreraBarn(host) {
    const alla = Array.from(host.querySelectorAll('[data-barn]'));
    alla.forEach((f, i) => {
      f.querySelector('legend').textContent = 'Barn ' + (i + 1);
      const bort = f.querySelector('[data-barn-bort]');
      bort.hidden = alla.length < 2;
      bort.setAttribute('aria-label', 'Ta bort barn ' + (i + 1));
    });
  }

  /* host är elementet barnfälten ligger i. Knappen "Lägg till ett
     barn till" ska ha data-barn-ny och ligga i samma ruta. */
  function kopplaBarn(ruta, host) {
    host.insertAdjacentHTML('beforeend', barnFält());
    numreraBarn(host);
    ruta.addEventListener('click', ev => {
      if (ev.target.closest('[data-barn-ny]')) {
        host.insertAdjacentHTML('beforeend', barnFält());
        numreraBarn(host);
        const sista = host.querySelectorAll('[data-barn]');
        sista[sista.length - 1].querySelector('[data-barn-falt="namn"]').focus();
        return;
      }
      const bort = ev.target.closest('[data-barn-bort]');
      if (bort && host.contains(bort)) {
        bort.closest('[data-barn]').remove();
        numreraBarn(host);
        const ny = ruta.querySelector('[data-barn-ny]');
        if (ny) ny.focus();
      }
    });
  }

  /* Svarar { barn: [...] } eller { fel }. Ett barn där inget fält är
     ifyllt räknas inte; ett barn med årskurs men utan namn är ett fel,
     inte något som tyst försvinner. */
  function läsBarn(host) {
    const barn = [];
    const alla = Array.from(host.querySelectorAll('[data-barn]'));
    for (let i = 0; i < alla.length; i++) {
      const f = alla[i];
      const värde = n => f.querySelector('[data-barn-falt="' + n + '"]').value.trim();
      const namn = värde('namn'), årskurs = värde('arskurs'), ämnen = delaÄmnen(värde('amnen'));
      if (!namn && !årskurs && !ämnen.length) continue;
      if (!namn) {
        return { fel: 'Barn ' + (i + 1) + ' behöver ett namn.',
          fält: f.querySelector('[data-barn-falt="namn"]') };
      }
      barn.push({ namn: namn, årskurs: årskurs || null, ämnen: ämnen, fält: f });
    }
    return { barn: barn };
  }

  /* Ett barn i taget och i den ordning de står. Två skäl: ett fel ska
     gå att peka ut ("Nils kunde inte sparas"), och familjens härledda
     match följer det äldsta barnet, så ordningen är inte likgiltig. */
  async function skapaBarn(parentId, lista) {
    const skapade = [], misslyckade = [];
    for (const b of lista) {
      const { data, error } = await supa.from('students')
        .insert({ parent_id: parentId, name: b.namn, grade: b.årskurs, subjects: b.ämnen })
        .select('id').single();
      if (error || !data) {
        misslyckade.push({ namn: b.namn, fält: b.fält,
          fel: error ? felText(error) : 'Databasen svarade utan rad.' });
      } else {
        skapade.push({ namn: b.namn, id: data.id, fält: b.fält });
      }
    }
    return { skapade: skapade, misslyckade: misslyckade };
  }

  /* "Alva och Nils", "Alva, Nils och Elin". */
  function uppräkning(lista) {
    if (lista.length < 2) return lista.join('');
    return lista.slice(0, -1).join(', ') + ' och ' + lista[lista.length - 1];
  }

  /* En punkt sist, men bara en. Databasens meddelanden slutar ibland
     med punkt och ibland inte, och en mening som byggs av två delar
     fick annars två punkter i rad. */
  function punkt(text) {
    const t = String(text == null ? '' : text).trim();
    return /[.!?]$/.test(t) ? t : t + '.';
  }

  /* Vad som INTE gick, en mening per barn, med databasens egen
     förklaring. Tom sträng när allt gick. */
  function barnFel(res) {
    return res.misslyckade.map(m => m.namn + ' kunde inte sparas: ' + punkt(m.fel)).join(' ');
  }

  /* ------------------------------------------------------------
     LÄNKAR TILL MEJL OCH TELEFON

     Ritas när listan eller panelen ritas, aldrig statiskt i sidan:
     NX.initHeader() skriver om varje mailto: som finns när sidan
     laddas till Nextrums egen adress.
     ------------------------------------------------------------ */
  function mejlHref(adress) {
    return 'mailto:' + encodeURIComponent(String(adress || '').trim()).replace(/%40/g, '@');
  }

  /* Bara siffror och plustecken. Numret är fritext från ett formulär,
     och "070-111 22 33 (kvällar)" ska bli ett nummer telefonen kan
     ringa, inte en trasig länk. För kort för att vara ett nummer ger
     ingen länk alls. */
  function telHref(nummer) {
    const rent = String(nummer || '').replace(/[^\d+]/g, '');
    return rent.replace(/\D/g, '').length >= 5 ? 'tel:' + rent : null;
  }

  /* En funktion som inte finns i databasen än: PostgREST svarar
     PGRST202 (och 404), Postgres själv 42883. Det är ett läge, inte
     ett fel att visa. */
  function saknasFunktion(fel, status) {
    if (status === 404) return true;
    const kod = fel && fel.code;
    return kod === 'PGRST202' || kod === '42883';
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
     bevis på att mejlet skickades, men "vi öppnade ett svar till
     den här personen" är oändligt mycket mer än vad som fanns förut,
     och stämpeln går att ta bort om man ångrar sig.

     o.efterat({ till, amne }) körs när utkastet öppnats. Svarar den
     med en text har något inte gått att spara här, och rutan står
     kvar med den texten: utkastet är redan öppet, så det enda som
     återstår är att säga vad som INTE blev noterat.
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
      + '<input class="inp" id="kt-till" type="email" value="' + esc(o.till || '') + '"></div>'
      + '<div class="fgroup" style="margin-top:12px"><label for="kt-amne">Ämne</label>'
      + '<input class="inp" id="kt-amne" value="' + esc(o.amne || '') + '"></div>'
      + '<div class="fgroup" style="margin-top:12px"><label for="kt-text">Meddelande</label>'
      + '<textarea class="inp" id="kt-text" rows="12">' + esc(o.text || '') + '</textarea></div>'
      + '<p class="ok-msg" id="kt-msg" role="status"></p>'
      + '<div class="nx-fraga-knappar">'
      + '<button type="button" class="btn btn-ghost" data-kt-stang data-ruta-avbryt>Avbryt</button>'
      + '<button type="button" class="btn btn-primary" id="kt-oppna">Öppna i mejl</button>'
      + '</div></div>';

    const stäng = öppnaRuta(ruta, { först: o.först || null, återFokus: o.återFokus });
    ruta.addEventListener('click', ev => {
      if (ev.target.closest('[data-kt-stang]')) stäng();
    });

    const öppna = $('#kt-oppna', ruta);
    öppna.addEventListener('click', async () => {
      const msg = $('#kt-msg', ruta);
      rensa(msg);
      const till = $('#kt-till', ruta).value.trim();
      if (!till) { säg(msg, 'Fyll i en adress.', false); return; }
      const amne = $('#kt-amne', ruta).value;

      /* encodeURIComponent på både ämne och kropp. Ett svenskt
         tecken eller en radbrytning i klartext kapar annars mejlet
         på vägen till mejlprogrammet. */
      const url = 'mailto:' + encodeURIComponent(till)
        + '?subject=' + encodeURIComponent(amne)
        + '&body=' + encodeURIComponent($('#kt-text', ruta).value);
      window.location.href = url;

      if (typeof o.efterat === 'function') {
        let fel = null;
        await medan(öppna, 'Sparar…', async () => {
          try { fel = await o.efterat({ till: till, amne: amne }); }
          catch (e) { fel = felText(e); }
        });
        if (typeof fel === 'string' && fel) {
          säg(msg, 'Utkastet öppnades, men det gick inte att notera här: ' + punkt(fel), false);
          const avbryt = ruta.querySelector('[data-kt-stang]');
          if (avbryt) avbryt.textContent = 'Stäng';
          return;
        }
      }
      stäng();
    });
  }


  const DP = {
    bak: null, panel: null, typ: null, id: null, flik: null
  };

  return {
    ANS_LAGE, AVBOKNINGSSKAL, BOK_LAGE, DAG, DP, FAKT_LAGE, INBJUDAN_NOT, LEAD_LAGE, S, SH_LAGE,
    UTB_LAGE, ÅRSKURSER, barnFel, dagarSedan, delaÄmnen, elevHjälpare, elevNamn, fråga,
    funktionsFel, hämtaAllt, hämtaAnalys, hämtaEkonomiunderlag, hämtaMatchunderlag,
    kontaktaRuta, kopplaBarn, kortDatum, läge, läsBarn, matchar, mejlHref, märkFlik,
    namnFör, närText, numreraBarn, pill, punkt, rad, saknasFunktion, skapaBarn, skriv, tabell, telHref,
    tomtText, uppräkning, visa, väljare, öppnaRuta, rita
  };
})();
