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

  const { S, elevNamn, funktionsFel, hämtaAllt, hämtaEkonomiunderlag,
          hämtaMatchunderlag, kortDatum, namnFör, närText, skriv, tabell,
          visa } = NXAdmin;
  /* Funktioner som bor i andra områden. Anropen går via
     NXAdmin.rita, som fylls när alla filer laddats. */
  const byggFlöde = (...a) => NXAdmin.rita.byggFlöde(...a);
  const fyllPerioder = (...a) => NXAdmin.rita.fyllPerioder(...a);
  const ritaAdminanvandare = (...a) => NXAdmin.rita.ritaAdminanvandare(...a);
  const ritaAnsokningar = (...a) => NXAdmin.rita.ritaAnsokningar(...a);
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
  const ritaLeads = (...a) => NXAdmin.rita.ritaLeads(...a);
  const ritaLektioner = (...a) => NXAdmin.rita.ritaLektioner(...a);
  const ritaMatchning = (...a) => NXAdmin.rita.ritaMatchning(...a);
  const ritaPris = (...a) => NXAdmin.rita.ritaPris(...a);
  const ritaRabattkoder = (...a) => NXAdmin.rita.ritaRabattkoder(...a);
  const ritaStatistik = (...a) => NXAdmin.rita.ritaStatistik(...a);
  const ritaStudiehjalpare = (...a) => NXAdmin.rita.ritaStudiehjalpare(...a);
  const ritaTjanster = (...a) => NXAdmin.rita.ritaTjanster(...a);
  const ritaUtbetalningar = (...a) => NXAdmin.rita.ritaUtbetalningar(...a);
  const ritaÖversikt = (...a) => NXAdmin.rita.ritaÖversikt(...a);
  const ritaInstallningar = (...a) => NXAdmin.rita.ritaInstallningar(...a);
  const ritaAudit = (...a) => NXAdmin.rita.ritaAudit(...a);
  const ritaAutomationer = (...a) => NXAdmin.rita.ritaAutomationer(...a);
  const ritaUppdrag = (...a) => NXAdmin.rita.ritaUppdrag(...a);
  const ritaUppgifter = (...a) => NXAdmin.rita.ritaUppgifter(...a);
  const laddaOmEkonomi = (...a) => NXAdmin.rita.laddaOmEkonomi(...a);

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
      /* Avvikelserna och översikten följer med: en betald faktura är
         inte längre förfallen. */
      ritaFakturor(); await laddaOmEkonomi();
      return;
    }

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
      Object.assign(u, fält);
      await skriv('payouts', u.id, fält);
      ritaUtbetalningar(); await laddaOmEkonomi();
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
          await laddaOmEkonomi();
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
    lektioner: 'Lektioner', statistik: 'Statistik',
    ekonomi: 'Fakturor & utbetalningar', system: 'System',
    agenter: 'Agenter', uppdrag: 'Uppdrag', uppgifter: 'Uppgifter', katalog: 'Tjänster & priser'
  };

  /* Området varje sektion hör till (Fas 6) — samma nio rubriker som
     i sidomenyn. Visas i brödsmulan när det inte bara upprepar
     sektionens namn. */
  const OMRADE = {
    oversikt: 'Översikt', statistik: 'Översikt',
    leads: 'Kunder', familjer: 'Kunder', elever: 'Kunder', studiehjalpare: 'Kunder',
    matchning: 'Drift', bokningar: 'Drift', lektioner: 'Drift', uppdrag: 'Drift', uppgifter: 'Drift',
    meddelanden: 'Kommunikation', ekonomi: 'Ekonomi', ansokningar: 'Rekrytering',
    katalog: 'Tjänster', agenter: 'AI', system: 'System'
  };

  function ritaVar() {
    const sek = String(location.hash || '').replace(/^#/, '').split('/')[0] || 'oversikt';
    const namn = SEKTIONSNAMN[sek] || 'Översikt';
    const el = $('#adm-var');
    if (el) el.textContent = namn;
    const område = $('#adm-omrade');
    if (område) {
      const o = OMRADE[sek] || '';
      område.textContent = o;
      område.hidden = !o || o === namn;
    }
  }

  /* Adresser som flyttat. Tjänstekatalogen och rabattkoderna låg
     under System till Fas 6. Paret sektion/flik, inte bara sektionen,
     för #system är fortfarande en giltig adress. */
  const FLYTTAT = {
    'system/tjanster': 'katalog/tjanster',
    'system/rabattkoder': 'katalog/rabattkoder'
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
       som tillkommit. */
    async function hämtaOmListorna(nytt) {
      const [l2, a2, k2] = await Promise.all([
        supa.from('leads').select('*').order('created_at', { ascending: false }),
        supa.from('applications').select('*').order('created_at', { ascending: false }),
        supa.from('contact_messages').select('*').order('created_at', { ascending: false })
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
         Den nollställs av sättTitel(0) när man öppnar notiserna. */
      if (nytt > 0) sättTitel(nytt);
    }

    /* Titeln bär antalet nya, som i studievyerna. */
    function sättTitel(n) {
      const ren = document.title.replace(/^\(\d+\)\s*/, '');
      document.title = n ? '(' + n + ') ' + ren : ren;
    }

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
        agenter: NXArbete.flikar($('section[data-sek="agenter"]')),
        katalog: NXArbete.flikar($('section[data-sek="katalog"]')),
        ansokningar: NXArbete.flikar($('section[data-sek="ansokningar"]')),
        system: NXArbete.flikar($('section[data-sek="system"]'))
      };

      /* Agenterna bor i en egen fil och läser egna bord. Den startas
         här, där vi vet att den inloggade är admin, men INTE med
         await: en agentfråga som tar nittio sekunder att hämta logg
         för ska inte hålla resten av vyn tom under tiden. */
      if (typeof NXAdminAgenter !== 'undefined') NXAdminAgenter.start();

      S.sido = NXStudie.sidomeny({
        nav: $('#vy-sido'), rot: $('#view-app'), standard: 'oversikt'
      });

      $('#adm-topp').hidden = false;
      startaFall();
      ritaSidofot();
      ritaVar();

      function följHash() {
        const adress = String(location.hash || '').replace(/^#/, '');
        if (FLYTTAT[adress]) { location.replace('#' + FLYTTAT[adress]); return; }
        const [huvud, flik] = adress.split('/');
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
      await hämtaEkonomiunderlag();

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
      ritaAvvikelser();
      fyllPerioder();
      ritaIntegrationer();
      ritaAdminanvandare();
      ritaPris();
      ritaTjanster();
      ritaRabattkoder();
      ritaFel();
      ritaInstallningar();
      ritaAudit();
      ritaUppdrag();
      ritaUppgifter();
      ritaAutomationer();
      await ritaÖversikt();

      /* Samma summa som arbetskön på Översikt visar, inte en egen
         räkning. Två tal som båda heter "saker att göra" och säger
         olika saker är värre än inget tal alls. */
      const attGöra = S.attGora.reduce((n, p) => n + p.antal, 0);
      const främst = S.attGora[0];

      /* "Nästa pass" stod här förut. Det är familjens och
         studiehjälparens fråga, inte ledningens — och det står redan
         under Bokningar. Vad ledningen behöver veta av hjältebilden
         är hur mycket som väntar på någon, och det är det enda kort
         som är kvar. */
      S.hero.uppdatera({
        chatt: attGöra
          ? { href: främst ? främst.till : '#oversikt',
              text: attGöra + (attGöra === 1 ? ' sak att göra' : ' saker att göra'),
              under: främst
                ? 'Främst: ' + (främst.antal === 1 ? främst.ental : främst.antal + ' ' + främst.rubrik)
                : 'Se Översikt' }
          : { href: '#oversikt', text: 'Inget som väntar', under: 'Allt är avklarat' }
      });

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
