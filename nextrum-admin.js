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

   FAS 6: DELAD I FILER
   Det här är skalet: inloggning, sidomeny, sök, notiser,
   bevakning och start(). Allt annat ligger i nextrum-admin-*.js,
   med den delade kärnan i nextrum-admin-karna.js. Ingen
   funktion skrevs om vid uppdelningen.
   ============================================================ */
(function () {
  'use strict';

  const { $, $$, esc, säg, rensa, felText, datumText, isoFor } = NX;
  const { bekräfta, medan, tomt, laddar } = NXStudie;
  const kronor = NXBetalning.kronor;
  const M = NXMedia;

  const { S, elevNamn, funktionsFel, hämtaAlla, hämtaAllt, hämtaAnalys, hämtaEkonomiunderlag,
          hämtaMatchunderlag, kortDatum, markeraSett, namnFör, närText, skriv, skrivOmOförändrad, tabell,
          visa, ärRaderad } = NXAdmin;
  /* Funktioner som bor i andra områden. Anropen går via
     NXAdmin.rita, som fylls när alla filer laddats. */
  const byggFlöde = (...a) => NXAdmin.rita.byggFlöde(...a);
  const fyllPerioder = (...a) => NXAdmin.rita.fyllPerioder(...a);
  const ritaAdminhantering = (...a) => NXAdmin.rita.ritaAdminhantering(...a);
  const ritaAnsokningar = (...a) => NXAdmin.rita.ritaAnsokningar(...a);
  const ritaBibliotek = (...a) => NXAdmin.rita.ritaBibliotek(...a);
  const ritaAvvikelser = (...a) => NXAdmin.rita.ritaAvvikelser(...a);
  const ritaBokningar = (...a) => NXAdmin.rita.ritaBokningar(...a);
  const ritaChattar = (...a) => NXAdmin.rita.ritaChattar(...a);
  const ritaElever = (...a) => NXAdmin.rita.ritaElever(...a);
  const ritaFakturor = (...a) => NXAdmin.rita.ritaFakturor(...a);
  const ritaFamiljer = (...a) => NXAdmin.rita.ritaFamiljer(...a);
  const ritaFel = (...a) => NXAdmin.rita.ritaFel(...a);
  const ritaIntegrationer = (...a) => NXAdmin.rita.ritaIntegrationer(...a);
  const ritaKalender = (...a) => NXAdmin.rita.ritaKalender(...a);
  const ritaKontakt = (...a) => NXAdmin.rita.ritaKontakt(...a);
  const ritaKoder = (...a) => NXAdmin.rita.ritaKoder(...a);
  const ritaLeads = (...a) => NXAdmin.rita.ritaLeads(...a);
  const ritaLektioner = (...a) => NXAdmin.rita.ritaLektioner(...a);
  const ritaMatchning = (...a) => NXAdmin.rita.ritaMatchning(...a);
  const ritaPris = (...a) => NXAdmin.rita.ritaPris(...a);
  const ritaRabattkoder = (...a) => NXAdmin.rita.ritaRabattkoder(...a);
  const ritaStatistik = (...a) => NXAdmin.rita.ritaStatistik(...a);
  const ritaStudiehjalpare = (...a) => NXAdmin.rita.ritaStudiehjalpare(...a);
  const ritaTjanster = (...a) => NXAdmin.rita.ritaTjanster(...a);
  const ritaUtbetalningar = (...a) => NXAdmin.rita.ritaUtbetalningar(...a);
  const ritaKortbetalningar = (...a) => NXAdmin.rita.ritaKortbetalningar(...a);
  const ritaÖversikt = (...a) => NXAdmin.rita.ritaÖversikt(...a);
  const ritaInstallningar = (...a) => NXAdmin.rita.ritaInstallningar(...a);
  const ritaNotisdrift = (...a) => NXAdmin.rita.ritaNotisdrift(...a);
  const ritaAudit = (...a) => NXAdmin.rita.ritaAudit(...a);
  const ritaDokument = (...a) => NXAdmin.rita.ritaDokument(...a);
  const ritaAutomationer = (...a) => NXAdmin.rita.ritaAutomationer(...a);
  const ritaAI = (...a) => NXAdmin.rita.ritaAI(...a);
  const ritaUppdrag = (...a) => NXAdmin.rita.ritaUppdrag(...a);
  const ritaUppgifter = (...a) => NXAdmin.rita.ritaUppgifter(...a);
  const laddaOmEkonomi = (...a) => NXAdmin.rita.laddaOmEkonomi(...a);
  const ritaMånaden = (...a) => NXAdmin.rita.ritaMånaden(...a);
  const ritaLöner = (...a) => NXAdmin.rita.ritaLöner(...a);

  document.addEventListener('change', async e => {
    const el = e.target;

    if (el.dataset && el.dataset.lead) {
      const l = S.leads.find(x => x.id === el.dataset.lead);
      const gammal = l.status;
      l.status = el.value;
      if (!await skriv('leads', l.id, { status: el.value })) { l.status = gammal; el.value = gammal; }
      ritaLeads(); ritaÖversikt();
      return;
    }

    /* Avbokningsskäl (Fas 9.4). Sätts i efterhand och bara av
       Nextrum: familjen och studiehjälparen kommer inte förbi
       skydda_bokningsfalt, som med flit inte har fältet i sin
       vitlista. Tomt sparas som null — ett skäl som saknas är inte
       "annat", och statistiken ska kunna säga det. */
    if (el.dataset && el.dataset.avbokskal) {
      const b = S.bokningar.find(x => x.id === el.dataset.avbokskal);
      const gammal = b.avbokningsskal;
      b.avbokningsskal = el.value || null;
      if (!await skriv('bookings', b.id, { avbokningsskal: el.value || null })) {
        b.avbokningsskal = gammal;
      }
      ritaBokningar();
      /* Skälet är en av staplarna i Avbokningar. Samma skäl som ovan. */
      await hämtaAnalys(); ritaStatistik();
      return;
    }

    if (el.dataset && el.dataset.ans) {
      const a = S.ansokningar.find(x => x.id === el.dataset.ans);
      const gammal = a.status;
      /* Godkänd mejlar en välkomst (Fas 16.1), och mejlet säger att
         profilen är godkänd. Satt härifrån är den inte det: det är
         "Ta in i poolen" som godkänner profilen och gör hen matchbar.
         Ett välkomstmejl går inte att ta tillbaka. */
      if (el.value === 'approved' && gammal !== 'approved') {
        const ja = await bekräfta({
          titel: 'Godkänna utan att ta in i poolen?',
          text: (a.name || 'Den sökande') + ' får ett välkomstmejl som säger att profilen är '
            + 'godkänd. Men bara läget ändras härifrån: profilen godkänns först med "Ta in i '
            + 'poolen", och till dess går hen inte att matcha.',
          knapp: 'Godkänn och mejla ändå',
          avbryt: 'Avbryt'
        });
        if (!ja) { el.value = gammal; return; }
      }
      /* Avböjd mejlar ett nej (2026-10-05), en halvtimme senare och aldrig
         på kvällen. Rutan visar mejlet och när det går (bekräftaNej i
         nextrum-admin-rekrytering.js). */
      if (el.value === 'rejected' && gammal !== 'rejected') {
        const ja = await NXAdmin.rita.bekräftaNej(a);
        if (!ja) { el.value = gammal; return; }
      }
      a.status = el.value;
      if (!await skriv('applications', a.id, { status: el.value })) { a.status = gammal; el.value = gammal; }
      /* Databasen köar nejet, eller låter det gå förbi när läget byts
         tillbaka. Rekryteringen visar när det går, så raden hämtas om. */
      if ((a.status === 'rejected') !== (gammal === 'rejected') && NXAdmin.rita.hämtaBesked) {
        await NXAdmin.rita.hämtaBesked(a.id);
      }
      ritaAnsokningar(); ritaÖversikt();
      return;
    }

    if (el.dataset && el.dataset.sh) {
      const t = S.tutorProfiler[el.dataset.sh];
      const gammal = t.status;
      t.status = el.value;
      if (!await skriv('tutor_profiles', t.id, { status: el.value })) { t.status = gammal; el.value = gammal; }
      ritaStudiehjalpare(); ritaFamiljer(); ritaÖversikt();
      return;
    }

    /* Här låg hanteraren för familjens matchningsrullgardin. Den
       är borttagen tillsammans med rullgardinen: sedan schema-v14
       ägs matchningen av eleven, och profiles.matched_tutor_id
       skrivs av en trigger. Se kommentaren i ritaFamiljer. */

    /* Fakturans läge hade en rullgardin här. Sedan Fas 14.6 har varje
       läge sin egen knapp under Betalningar → Fakturor (Lagd i Fortnox,
       Betald, Makulera), för Skickad utan fakturanumret i Fortnox och
       förfallodag är en rad ingen kan följa upp i Fortnox. */

    if (el.dataset && el.dataset.utb) {
      const u = S.utbetalningar.find(x => x.id === el.dataset.utb);

      /* Utbetald betyder att pengarna lämnat kontot. Det ska bara gå
         efter att någon granskat underlaget och satt Godkänd — och
         aldrig av misstag i en rullgardin. Överföringen görs utanför
         plattformen, så den här markeringen är det enda spåret av
         den. (Fas 2.6) */
      if (el.value === 'utbetald' && u.status !== 'godkand') {
        alert('Godkänn underlaget först. Utbetald går bara att sätta på ett godkänt underlag.');
        el.value = u.status;
        return;
      }
      if (el.value === 'utbetald') {
        const ja = await bekräfta({
          titel: 'Har pengarna lämnat kontot?',
          text: kronor(u.belopp_ore) + ' till ' + namnFör(u.tutor_id) + ' för '
            + NXBetalning.periodText(u.period) + '. Markera bara som utbetald när '
            + 'överföringen faktiskt är gjord.',
          knapp: 'Ja, den är gjord'
        });
        if (!ja) { el.value = u.status; return; }
      }
      if (u.status === 'utbetald' && el.value !== 'utbetald') {
        const ja = await bekräfta({
          titel: 'Ångra utbetald?',
          text: 'Utbetalningsdatumet tas bort. Gör det bara om överföringen aldrig gick iväg.',
          knapp: 'Ångra'
        });
        if (!ja) { el.value = u.status; return; }
      }

      const fält = { status: el.value };
      if (el.value === 'utbetald' && !u.utbetald_at) fält.utbetald_at = new Date().toISOString();
      if (el.value !== 'utbetald') fält.utbetald_at = null;

      /* Ett utkast som godkänns ska vara det som visades (2026-10-01).
         Månadskörningen går varje natt och lägger sent rapporterade pass
         på utkastet, så beloppet kan ha vuxit sedan sidan hämtades. */
      if (u.status === 'utkast' && el.value !== 'utkast') {
        const svar = await skrivOmOförändrad('payouts', u.id, fält, { status: 'utkast', belopp_ore: u.belopp_ore });
        if (svar === 'ändrad') {
          await hämtaAllt();
          await laddaOmEkonomi();
          const ny = S.utbetalningar.find(x => x.id === u.id);
          /* Noll rader utan att något ändrats är databasen som nekar, inte
             natten som lagt till ett pass. */
          const sammaSom = ny && ny.status === 'utkast' && Number(ny.belopp_ore) === Number(u.belopp_ore);
          alert(sammaSom
            ? 'Underlaget gick inte att spara. Ingenting ändrades.'
            : ny && ny.status === 'utkast'
            ? 'Underlaget har ändrats sedan sidan hämtades: det är nu ' + kronor(ny.belopp_ore) + ' i stället för '
              + kronor(u.belopp_ore) + ', för ett pass har lagts till. Granska det och välj igen. Ingenting sparades.'
            : 'Underlaget har ändrats sedan sidan hämtades. Ingenting sparades, och listan är hämtad på nytt.');
        } else if (svar) {
          Object.assign(u, fält);
        } else {
          el.value = u.status;
        }
        ritaUtbetalningar(); ritaLöner();
        if (svar === true) await laddaOmEkonomi();
        return;
      }

      Object.assign(u, fält);
      await skriv('payouts', u.id, fält);
      ritaUtbetalningar(); await laddaOmEkonomi();
      return;
    }
  });

  document.addEventListener('click', async e => {
    if (e.target.closest('[data-logout]')) {
      await NXStudie.loggaUt(supa);
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
      /* Skälet frågas nu i stunden, inte bara i efterhand: när admin
         avbokar får BÅDA parterna mejlet, och skälet står i det. Det
         skrivs i samma uppdatering som statusen — annars hade mejlet
         redan gått utan skäl. Väljaren i listan finns kvar för att
         rätta ett skäl i efterhand. */
      const skäl = await NXStudie.avbokaRuta({
        admin: true,
        titel: 'Avboka passet?',
        /* Admin är den enda som kan avboka ett betalt pass (Fas 13.1),
           och en avbokning betalar inte tillbaka något av sig själv:
           hur mycket som ska tillbaka är ett beslut. Rutan säger det,
           så att pengarna inte blir liggande för att ingen tänkte på dem. */
        text: kortDatum(b.wanted_date) + ' hos ' + namnFör(b.tutor_id) + '. '
          + (b.betalning_status === 'betald' || b.betalning_status === 'tvist'
            ? 'Passet är betalt, och pengarna går inte tillbaka av sig själva — återbetala '
              + 'under Betalningar → Att göra.'
            : b.betalning_status === 'faktura'
            ? 'Familjen betalar passet mot faktura. Står det redan på en faktura i Fortnox ska raden '
              + 'krediteras där; annars kommer det inte med på nästa faktura.'
            : 'Passet är inte betalt, så det finns inget att betala tillbaka.'),
        not: 'Både familjen och studiehjälparen får ett mejl om att passet är avbokat och varför.'
      });
      if (!skäl) return;
      await medan(avboka, 'Avbokar…', async () => {
        const gammal = { status: b.status, avbokningsskal: b.avbokningsskal };
        Object.assign(b, { status: 'cancelled', avbokningsskal: skäl });
        if (!await skriv('bookings', b.id, { status: 'cancelled', avbokningsskal: skäl })) {
          Object.assign(b, gammal);
        }
        /* Samma rad syns på fyra ställen. Ritas bara listan om blir
           kalendern och lektionslistan kvar med det gamla läget, och
           då står det två olika saker om samma pass på samma skärm.

           Statistiken räknas i databasen sedan Fas 9.6, så den måste
           hämtas om — inte bara ritas om. Annars står avbokningen i
           listan men inte i stapeln, på samma skärm. */
        ritaBokningar(); ritaKalender(); ritaLektioner();
        await hämtaAnalys(); ritaStatistik();
        await ritaÖversikt();
      });
      return;
    }

    /* ============ SKICKA UNDERLAG ============
       Två anrop till samma edge-funktion. Det första är en
       torrkörning som svarar med vad studiehjälparen KOMMER att läsa;
       det andra skickar. Ett mejl som lämnat huset går inte att
       ångra, så det ska gå att läsa igenom först.

       Bara underlag sedan Fas 14.6. Fakturor skapas och skickas i
       Fortnox, och faktura-utskick nekar dem. */
    const skicka = e.target.closest('[data-skicka]');
    if (skicka) {
      const id = skicka.dataset.id;

      const prov = await medan(skicka, 'Hämtar…', () =>
        supa.functions.invoke('faktura-utskick',
          { body: { typ: 'utbetalning', id, torrkorning: true } }));

      const fel = prov.error || (prov.data && prov.data.error);
      if (fel) { alert(await funktionsFel(fel)); return; }

      const ja = await bekräfta({
        titel: 'Skicka underlaget?',
        text: 'Går till ' + prov.data.till + '. Så här ser det ut:',
        forhandsvisning: prov.data.text,
        knapp: 'Skicka nu'
      });
      if (!ja) return;

      await medan(skicka, 'Skickar…', async () => {
        const res = await supa.functions.invoke('faktura-utskick',
          { body: { typ: 'utbetalning', id } });
        const f2 = res.error || (res.data && res.data.error);
        if (f2) { alert(await funktionsFel(f2)); return; }
        alert('✓ Skickat till ' + res.data.till + '.');
      });
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
   ['#bok-sok', ritaBokningar], ['#bok-status', ritaBokningar], ['#bok-nar', ritaBokningar]
   /* Betalningar (2026-09-29): lägena är knappar i sidan, och söken
      (#kort-sok, #fakt-sok) sköts i nextrum-admin-ekonomi.js, med
      listan stilla (NXStudie.hållLista). Underlagen söks under Löner. */
  ].forEach(([sel, fn]) => {
    const el = $(sel);
    if (el) el.addEventListener('input', fn);
  });

  /* ============ inloggning ============ */
  /* Glömt lösenordet? (NXStudie). Adminvyn har inga flikar och inget
     konto att skapa, så rutan byter bara mellan inloggningen och det
     läget, eller 'lankfel' efter en länk som inte fungerade (samma
     formulär, egen rubrik). */
  let glömt = false;
  function sättLäge(l) {
    glömt = l === 'glomt' || l === 'lankfel';
    NXStudie.inloggningsruta(l, {
      titel: 'Adminvyn',
      under: 'För dig som jobbar på Nextrum. Intresseanmälningar, matchning, bokningar, betalningar och utbetalningar.'
    });
  }
  NXStudie.glömtLänkar(sättLäge);

  $('#auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#auth-msg');
    rensa(msg);
    if (!supa) { säg(msg, 'Databasen är inte kopplad. Fyll i nextrum-config.js.', false); return; }
    if (glömt) { await NXStudie.glömtSkicka(supa); return; }

    const epost = $('#a-email').value.trim();
    const lösen = $('#a-pass').value;
    if (!epost || !lösen) { säg(msg, 'Fyll i e-post och lösenord.', false); return; }

    /* E-post eller användarnamn, som i alla vyer: ett barn som loggar in
       här skickas till /barn (NXStudie.loggaInHär). */
    await NXStudie.loggaInHär(supa, epost, lösen);
  });

  /* ============ header ============ */

  /* ============================================================
     SKALET
     Topprad, global sök, notiser, hopfällbar sidomeny och menyns
     fot. Fyra saker som gäller hela vyn och ingen enskild sektion.
     ============================================================ */

  const SEKTIONSNAMN = {
    oversikt: 'Översikt', leads: 'Intresseanmälningar', ansokningar: 'Ansökningar',
    meddelanden: 'Frågor', familjer: 'Familjer', elever: 'Elever',
    studiehjalpare: 'Studiehjälpare', matchning: 'Matchning', bokningar: 'Bokningar',
    lektioner: 'Lektioner', statistik: 'Statistik',
    ekonomi: 'Betalningar', manaden: 'Månadens ekonomi', loner: 'Löner',
    system: 'System',
    agenter: 'Agenter', uppdrag: 'Uppdrag', uppgifter: 'Uppgifter',
    bibliotek: 'Material', katalog: 'Tjänster & priser'
  };

  /* Sektionens namn står i raden överst på en telefon, där menyn är en rad
     man sveper i och rubriken ligger en skärm bort, och i fliktiteln. På
     en dator säger menyn och rubriken var man är. Brödsmulan med området
     (Admin / Kunder / Familjer) är borta sedan 2026-09-29: den sa samma
     sak som menyn och rubriken, en tredje gång. */
  function ritaVar() {
    /* Sektionen som faktiskt står framme. För en admin med vissa
       behörigheter kan adressen peka på en sektion hen inte har, och då
       visar menyn en annan (barnkonton_och_admin). */
    const framme = $('#view-app section.vy-sek[data-sek]:not([hidden])');
    const sek = (framme && framme.dataset.sek)
      || String(location.hash || '').replace(/^#/, '').split('/')[0] || 'oversikt';
    const namn = SEKTIONSNAMN[sek] || 'Översikt';
    const el = $('#adm-var');
    if (el) el.textContent = namn;
    /* Titeln bär sektionen, så att flikarna går att skilja åt när flera
       står öppna. Antalet nya, som sättTitel lägger först, bevaras. */
    const nya = document.title.match(/^\(\d+\)\s*/);
    document.title = (nya ? nya[0] : '') + namn + ' · Admin — Nextrum';
  }

  /* Adresser som flyttat. Tjänstekatalogen och rabattkoderna låg
     under System till Fas 6. Paret sektion/flik, inte bara sektionen,
     för #system är fortfarande en giltig adress. */
  const FLYTTAT = {
    'system/tjanster': 'katalog/tjanster',
    'system/rabattkoder': 'katalog/rabattkoder',
    /* Betalningar gjordes om 2026-09-29. Underlagen bor under Löner,
       månadskörningen under Fakturor, och avvikelserna under Att göra. */
    'ekonomi/kortbetalningar': 'ekonomi/betalningar',
    'ekonomi/avvikelser': 'ekonomi/attgora',
    'ekonomi/utbetalningar': 'loner',
    'ekonomi/korning': 'ekonomi/fakturor'
  };

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
     KONTOT
     Vem som är inloggad, vägen till de andra vyerna och Logga ut, i en
     meny bakom avataren i toppraden (2026-09-29). Det stod på tre ställen
     förut: i sajtens sidhuvud, i menyns fot och i burgarmenyn. Sidhuvudet
     göms nu när man är inne, och menyns fot fanns inte på en telefon, där
     Logga ut annars hade legat i burgaren.
     ------------------------------------------------------------ */
  function ritaAnvandare() {
    const knapp = $('#adm-anv-knapp'), panel = $('#adm-anv-panel');
    if (!knapp || !panel || !S.profil) return;
    const namn = S.profil.full_name || S.user.email;
    const epost = S.profil.email || S.user.email || '';
    const förnamn = String(namn).trim().split(/\s+/)[0];

    knapp.innerHTML = M.avatar(namn, S.profil.avatar_url || null, { liten: true })
      + '<span class="adm-anv-namn">' + esc(förnamn) + '</span>'
      + '<svg class="adm-anv-pil" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg>';
    knapp.setAttribute('aria-label', 'Konto: ' + namn);

    const extern = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M6 4h6v6"/></svg>';
    panel.innerHTML = '<div class="adm-anv-vem"><b>' + esc(namn) + '</b>'
      + (epost && epost !== namn ? '<span>' + esc(epost) + '</span>' : '')
      + '<span class="adm-anv-roll">' + esc(NXAdmin.rita.rollText()) + '</span></div>'
      /* Ett konto som bara är admin (admin-skapa) har ingen studievy att
         gå till; de andra vyerna skickar det tillbaka hit. */
      + (S.profil.role === 'admin' ? ''
        : '<a class="adm-anv-rad" href="/foralder">Studievyn' + extern + '</a>'
          + '<a class="adm-anv-rad" href="/larare">Studiehjälparvyn' + extern + '</a>')
      + '<button class="adm-anv-rad" type="button" data-byt-losen>Byt lösenord'
      + '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/>'
      + '<path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg></button>'
      + '<button class="adm-anv-rad ar-ut" type="button" data-logout>Logga ut'
      + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4.5H5.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H9"/>'
      + '<path d="M15.5 8.5 19 12l-3.5 3.5M19 12H9"/></svg></button>';
  }

  /* ------------------------------------------------------------
     PANELERNA
     Sök, notiser och kontot öppnar var sin. Bara en åt gången, och ett
     klick utanför stänger — samma regel för båda, så att det
     bara finns ett sätt att stänga något.
     ------------------------------------------------------------ */
  function stängPaneler(utom) {
    [['#adm-sokresultat', '#adm-sok'], ['#adm-notiser', '#adm-notis-knapp'],
     ['#adm-anv-panel', '#adm-anv-knapp']].forEach(par => {
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

    /* En träff öppnar personen i panelen (data-dp), och sektionen
       bakom byts till personens lista. Raderade står inte med: de är
       ingen person längre, bara bokföring. */
    Object.values(S.personer).forEach(p => {
      if (ärRaderad(p)) return;
      if (!i(p.full_name) && !i(p.email) && !i(p.phone)) return;
      const typ = p.role === 'tutor' ? 'Studiehjälpare' : 'Familj';
      ut.push({ typ, namn: p.full_name || p.email || '—',
        under: p.email || '', till: p.role === 'tutor' ? '#studiehjalpare' : '#familjer',
        dp: (p.role === 'tutor' ? 'studiehjalpare:' : 'familj:') + p.id });
    });

    S.elevlista.forEach(e => {
      if (!i(e.name) && !i(e.school) && !i((e.subjects || []).join(' '))) return;
      const f = S.personer[e.parent_id];
      ut.push({ typ: 'Elev', namn: e.name,
        under: [e.grade, f && (f.full_name || f.email)].filter(Boolean).join(' · '),
        till: '#elever', dp: 'elev:' + e.id });
    });

    S.leads.forEach(l => {
      if (ärRaderad(l)) return;
      if (!i(l.parent_name) && !i(l.email) && !i(l.child_name)) return;
      ut.push({ typ: 'Anmälan', namn: l.parent_name || l.email || '—',
        under: [l.child_name, l.subject].filter(Boolean).join(' · '), till: '#leads',
        dp: 'anmalan:' + l.id });
    });

    S.ansokningar.forEach(a => {
      if (!i(a.name) && !i(a.email) && !i(a.school)) return;
      ut.push({ typ: 'Ansökan', namn: a.name || a.email || '—',
        under: [a.school, a.subjects].filter(Boolean).join(' · '), till: '#ansokningar',
        dp: 'ansokan:' + a.id });
    });

    S.bokningar.forEach(b => {
      const elev = elevNamn(b.student_id);
      if (!i(b.subject) && !i(elev) && !i(namnFör(b.parent_id)) && !i(namnFör(b.tutor_id))) return;
      ut.push({ typ: 'Bokning', namn: (b.subject || 'Pass') + ' · ' + kortDatum(b.wanted_date),
        under: (elev || namnFör(b.parent_id)) + ' → ' + namnFör(b.tutor_id), till: '#bokningar',
        dp: 'pass:' + b.id });
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
        '<a class="adm-rad" href="' + esc(t.till) + '" data-stang-sok'
        + (t.dp ? ' data-dp="' + esc(t.dp) + '"' : '') + '>'
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

  /* ------------------------------------------------------------
     SETT (2026-10-05)

     När Intresseanmälningar eller Ansökningar står framme markeras det
     nya som sett (markeraSett i kärnan, en tid per admin i admin_sett):
     siffran i menyn, raden i Att göra och pricken i klockan går bort,
     och raderna som var nya märks i listan så länge man står kvar. Det
     räcker att sektionen visas, för det är där man ser att något kommit
     in och vad. En dold flik har inte sett något: då väntar det tills
     den kommer fram. Titelns (n) nollas som när klockan öppnas.

     stannar: samma besök (en ny rad kom in, fliken kom fram). Annars är
     det ett nytt besök om sektionen inte var den förra.
     ------------------------------------------------------------ */
  let settKlar = false;

  async function sektionSedd(stannar) {
    if (!settKlar || document.hidden) return;
    const framme = $('#view-app section[data-sek]:not([hidden])');
    const sek = framme ? framme.dataset.sek : null;
    const samma = !!stannar || S.settSek === sek;
    S.settSek = sek;
    if (sek !== 'leads' && sek !== 'ansokningar') return;
    if (!await markeraSett(sek, samma)) return;
    if (sek === 'leads') ritaLeads(); else ritaAnsokningar();
    await ritaÖversikt();
    if (NXAdmin.rita.sättTitel) NXAdmin.rita.sättTitel(0);
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) sektionSedd(true); });

  /* ------------------------------------------------------------
     BEVAKNINGEN

     Adminvyn hämtade allt EN gång, vid inloggning. Kom en ansökan in
     medan fliken stod öppen fanns den i databasen men inte på
     skärmen, och den som satt och väntade på just den ansökan fick
     veta genom att ladda om av en slump. "Vi får ingen notis när
     någon söker in" var bokstavligen sant.

     REALTID SEDAN FAS 4, med pollningen kvar som gles reserv.

     Förut räknades raderna i de tre borden var 60:e sekund, och
     listorna hämtades om när summan hade vuxit. Tre frågor i minuten,
     dygnet runt, för att upptäcka något som händer några gånger i
     veckan — och ändå upp till en minuts fördröjning på det.

     Nu kommer raden i stället. Reserven finns kvar för att en
     websocket inte är ett löfte: den dör när datorn somnar och när
     nätet byts, och Realtime återansluter utan att säga vad som hann
     passera. Var femte minut, och alltid direkt när fliken kommer
     fram, räknas raderna om på gamla viset.

     Bara de tre borden som kommer utifrån. Fakturor och pass ändras
     av oss själva, och de raderna ritas redan om när vi ändrar dem.
     ------------------------------------------------------------ */
  (function startaBevakning() {
    const RESERV_INTERVALL = 300000;
    const SAMLA_MS = 300;
    let senastAntal = null;
    let samlaTimer = null;

    async function kolla() {
      /* Ingen hämtning när fliken ligger i bakgrunden. Den som inte
         tittar behöver ingen uppdatering, och en vy som pollar i en
         bortglömd flik i åtta timmar är bara trafik. */
      if (document.hidden || !S.user) return;

      const [leads, ans, kontakt] = await Promise.all([
        supa.from('leads').select('id', { count: 'exact', head: true }),
        supa.from('applications').select('id', { count: 'exact', head: true }),
        supa.from('contact_messages').select('id', { count: 'exact', head: true })
      ]);

      const nu = {
        leads: leads.count ?? 0,
        ans: ans.count ?? 0,
        kontakt: kontakt.count ?? 0
      };

      if (!senastAntal) { senastAntal = nu; return; }

      const nytt = (nu.leads - senastAntal.leads)
        + (nu.ans - senastAntal.ans)
        + (nu.kontakt - senastAntal.kontakt);

      if (nytt <= 0) { senastAntal = nu; return; }
      senastAntal = nu;
      await hämtaOmListorna(nytt);
    }

    /* Hämta om de tre listorna och rita om allt som räknar på dem.
       hämtaAllt() hade hämtat om hela vyn, inklusive fakturor och
       matchningsunderlag — fyra gånger så mycket arbete för en rad
       som tillkommit.

       Alla rader, inte de tusen första (hämtaAlla i kärnan): längden
       jämförs med databasens count nedan, och en lista kapad vid tusen
       hade varit kortare än antalet vid varje koll, för alltid. */
    async function hämtaOmListorna(nytt) {
      const nyast = q => q.order('created_at', { ascending: false });
      const [l2, a2, k2] = await Promise.all([
        hämtaAlla('leads', '*', nyast),
        hämtaAlla('applications', '*', nyast),
        hämtaAlla('contact_messages', '*', nyast)
      ]);
      S.leads = l2.data || S.leads;
      S.ansokningar = a2.data || S.ansokningar;
      S.kontakt = k2.data || S.kontakt;

      /* Reserven jämför antal mot förra körningen. Har realtid redan
         hämtat raden ska den inte räknas en gång till. */
      senastAntal = { leads: S.leads.length, ans: S.ansokningar.length, kontakt: S.kontakt.length };

      ritaLeads();
      ritaAnsokningar();
      ritaKontakt();
      await ritaÖversikt();

      /* Titeln är det enda som syns när fliken ligger bakom en annan.
         Den nollställs av sättTitel(0) när man öppnar notiserna, och när
         det nya syns i sektionen man står i (sektionSedd). */
      if (nytt > 0) sättTitel(nytt);
      await sektionSedd(true);
    }

    /* Titeln bär antalet nya, som i studievyerna. */
    function sättTitel(n) {
      const ren = document.title.replace(/^\(\d+\)\s*/, '');
      document.title = n ? '(' + n + ') ' + ren : ren;
    }
    NXAdmin.rita.sättTitel = sättTitel;

    /* ------------------------------------------------------------
       REALTIDEN

       En kanal, tre bord, bara INSERT. En rad som ÄNDRAS i leads är
       nästan alltid admin själv som satt status, och den ritas redan
       om av den som klickade.

       RLS gäller här som överallt annars: de tre borden har en enda
       SELECT-policy var, "endast admin läser …". Kanalen finns för
       att slippa fråga, inte för att komma åt något.
       ------------------------------------------------------------ */
    let nyaSedanSist = 0;

    function planeraOmläsning() {
      nyaSedanSist++;
      if (samlaTimer) clearTimeout(samlaTimer);
      samlaTimer = setTimeout(async () => {
        samlaTimer = null;
        const n = nyaSedanSist;
        nyaSedanSist = 0;
        await hämtaOmListorna(n);
      }, SAMLA_MS);
    }

    if (supa && supa.channel) {
      const kanal = supa.channel('admin-inkorg');
      ['leads', 'applications', 'contact_messages'].forEach(tabell => {
        kanal.on('postgres_changes', { event: 'INSERT', schema: 'public', table: tabell }, planeraOmläsning);
      });
      kanal.subscribe(status => {
        /* Efter varje lyckad anslutning: räkna om en gång, så att det
           som kom in medan socketen låg nere inte faller bort. */
        if (status === 'SUBSCRIBED') kolla();
      });
    }

    setInterval(kolla, RESERV_INTERVALL);
    /* Och direkt när man kommer tillbaka till fliken, i stället för
       att vänta ut resten av intervallet. */
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kolla(); });

    document.addEventListener('click', e => {
      if (e.target.closest('#adm-notis-knapp')) sättTitel(0);
    });
  })();

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

  (function startaKonto() {
    const knapp = $('#adm-anv-knapp');
    if (!knapp) return;
    knapp.addEventListener('click', () => {
      const panel = $('#adm-anv-panel');
      const öppen = !panel.hidden;
      stängPaneler('#adm-anv-panel');
      panel.hidden = öppen;
      knapp.setAttribute('aria-expanded', öppen ? 'false' : 'true');
    });
    /* En länk i menyn tar en därifrån, och Logga ut laddar om sidan;
       inget av det behöver stänga den. */
  })();

  /* Sajtens sidhuvud syns bara medan vyn laddas och i felvyerna (Inte
     admin, Vyn kunde inte laddas): är man inne göms det av
     body.adm-inne och kontot bor i toppraden. Det ritas ändå, för Logga
     ut i "Du har inte behörighet hit" står i det. */
  function ritaHeader() {
    const na = $('#nav-actions'), ma = $('#m-actions');
    if (!S.user) { na.innerHTML = ''; ma.innerHTML = ''; return; }
    const namn = (S.profil && S.profil.full_name) || S.user.email;
    na.innerHTML = '<span class="who-chip">' + M.avatar(namn, null, { liten: true })
      + '<b>' + esc(namn) + '</b><span class="roll">' + esc(NXAdmin.rita.rollText()) + '</span></span>'
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
      if (!S.user) { visa('view-auth'); NXStudie.länkenGickInte(sättLäge); return; }
      /* Ett barnkonto hör hemma i sin egen vy. Här hade det ändå fått
         tomma svar: barnets roll i databasen når inga tabeller. */
      if (NX.skickaBarnHem(S.user)) return;
      /* Försvinner inloggningen medan fliken står öppen visas
         inloggningen, inte en vy där varje knapp nekas (NXStudie). */
      NXStudie.vaktaInloggningen({ supa, user: S.user, utloggad: () => visa('view-auth') });
      /* Från länken i ett återställningsmejl: det nya lösenordet först,
         före behörigheten. Den som bad om länken här ska få byta
         lösenordet också om kontot inte är admin. */
      if (NX.återställning) await NXStudie.nyttLösenord(supa, { minsta: 8, epost: S.user.email });

      S.profil = await NX.hämtaProfil(S.user.id);
      /* Adminrollen avgör vilken SIDA som visas och vilka sektioner som
         står i menyn (barnkonton_och_admin). Vad som går att LÄSA avgörs
         av RLS i databasen, och den frågar inte den här filen om lov. En
         manipulerad webbläsare kommer alltså in i markupen och får tomma
         tabeller. */
      S.behorighet = await NXAdmin.rita.läsBehörighet();
      ritaHeader();

      if (!S.profil || !S.behorighet.admin) {
        const studievyn = $('#nekad-studievyn');
        if (studievyn && S.profil && S.profil.role === 'admin') studievyn.hidden = true;
        visa('view-nekad');
        return;
      }
      const full = S.behorighet.superadmin;
      /* En admin med vissa behörigheter: flikarna hen inte har tas bort
         och det hen inte får se ritas inte (nextrum-admin-behorighet.js). */
      NXAdmin.rita.begränsaVyn();

      visa('view-app');

      S.flikar = {
        meddelanden: NXArbete.flikar($('section[data-sek="meddelanden"]')),
        bokningar: NXArbete.flikar($('section[data-sek="bokningar"]')),
        ekonomi: NXArbete.flikar($('section[data-sek="ekonomi"]')),
        agenter: NXArbete.flikar($('section[data-sek="agenter"]')),
        katalog: NXArbete.flikar($('section[data-sek="katalog"]')),
        ansokningar: NXArbete.flikar($('section[data-sek="ansokningar"]')),
        system: NXArbete.flikar($('section[data-sek="system"]'))
      };

      /* Agenterna bor i en egen fil och läser egna bord. Den startas
         här, där vi vet att den inloggade är admin, men INTE med
         await: en agentfråga som tar nittio sekunder att hämta logg
         för ska inte hålla resten av vyn tom under tiden. */
      if (full && typeof NXAdminAgenter !== 'undefined') NXAdminAgenter.start();

      S.sido = NXStudie.sidomeny({
        nav: $('#vy-sido'), rot: $('#view-app'),
        standard: full ? 'oversikt' : NXAdmin.rita.förstaSektion(),
        tillåten: full ? null : NXAdmin.rita.tillåten
      });
      NXAdmin.rita.städaMenyn();

      startaFall();
      ritaAnvandare();
      ritaVar();

      function följHash() {
        const adress = String(location.hash || '').replace(/^#/, '');
        if (FLYTTAT[adress]) { location.replace('#' + FLYTTAT[adress]); return; }
        const [huvud, flik] = adress.split('/');
        if (flik && S.flikar[huvud]) S.flikar[huvud].visa(flik);
        ritaVar();
        sektionSedd();
      }
      window.addEventListener('hashchange', följHash);
      följHash();

      /* Fotoheron är borta. Den låg överst på alla arton flikar och
         sa hej; namnet står i sidomenyns fot och rollen i sidhuvudet.
         Driftkonsolen på Översikt ersätter den och säger något som
         ändras. */

      /* Den som bjudits in har inget lösenord än (NX.inbjudan). Rutan
         väntas inte in: vyn laddar bakom den. */
      if (NX.inbjudan) NXAdmin.rita.väljLösenord(true);

      await hämtaAllt();
      if (full) await hämtaEkonomiunderlag();

      ritaLeads();
      ritaAnsokningar();
      ritaKontakt();
      ritaChattar();
      ritaFamiljer();
      ritaElever();
      if (NXAdmin.rita.tillåten('matchning')) await hämtaMatchunderlag();
      ritaMatchning();
      ritaStudiehjalpare();
      ritaBokningar();
      ritaKalender();
      ritaLektioner();
      if (full) await hämtaAnalys();
      ritaStatistik();
      ritaFakturor();
      ritaUtbetalningar();
      ritaKortbetalningar();
      ritaAvvikelser();
      fyllPerioder();
      /* Efter Ekonomi: båda läser dess stängda månader och passunderlaget. */
      ritaMånaden();
      ritaLöner();
      ritaIntegrationer();
      ritaAdminhantering();
      ritaPris();
      ritaTjanster();
      ritaRabattkoder();
      ritaKoder();
      ritaFel();
      ritaInstallningar();
      ritaNotisdrift();
      ritaDokument();
      ritaAudit();
      ritaUppdrag();
      ritaUppgifter();
      ritaBibliotek();
      ritaAutomationer();
      await ritaAI();
      await ritaÖversikt();
      /* Står man redan i Ansökningar (en adress med #ansokningar) är det
         nya sett när det ritats. */
      settKlar = true;
      await sektionSedd();

      /* Hjältebildens enda kort räknade "saker att göra" och länkade
         till det främsta. Driftkonsolens disk visar samma tal och
         listan under den är varje post, var för sig, med vägen dit.
         Två tal som båda heter "saker att göra" och räknas på olika
         ställen är värre än inget tal alls — därför räknas det nu
         bara en gång, i nextrum-admin-konsol.js, ur S.lage. */

      /* await, inte bara ett anrop: supabase-js skickar frågan först
         när den väntas in, så utan det gick stämpeln aldrig iväg. Ett
         fel här ska inte stoppa vyn. */
      await supa.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', S.user.id);
    } catch (fel) {
      visaFel(fel, 'adminvyn skulle hämtas');
    }
  }


  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, {
    ritaNotiser, träffar
  });

  start();
})();
