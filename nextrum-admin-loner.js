/* ============================================================
   NEXTRUM — adminvyn, Löner: vad varje studiehjälpare ska ha för
   månaden, och lönefilen till Fortnox Lön

   Leo 2026-09-28: "lägg till en till avdelning för löner, personer och
   deras uppgifter samt exportera löner till tex fortnox. timmar att
   betala ut och vanlig månadskörning".

   Underlagen (payouts) fanns redan, under Ekonomi → Utbetalningar, och
   de skapas av månadskörningen. Det som saknades var en plats där man
   ser personerna och det lönen behöver om dem, timmarna som ska betalas
   ut innan underlaget ens är skapat, och en väg vidare till Fortnox.

   PERSONERNA. En rad per godkänd studiehjälpare, och per den som har
   något att få för månaden. Här sätts anställningsnumret (tabellen
   lon_anstallning, Fas 17.1: bara admin når den, för i tutor_profiles
   hade studiehjälparen kunnat skriva in en kollegas nummer) och
   timpenningen, som förut bara gick att sätta när personen togs in i
   poolen. Personnummer, adress, bankkonto och skattetabell står i
   Fortnox Lön och inte här, med flit: filen behöver dem inte, och
   studiehjälparna är ofta sexton.

   TIMMARNA ATT BETALA UT. Finns månadens underlag är det underlagets
   tal. Finns det inte än räknas de pass som månadens körning kommer
   att ta (NXAdmin.lönemånad): genomförda, med rapport, inte
   undantagna och inte redan på ett underlag, med lönetiden ur
   passunderlaget (lon_min) och tjänstens ersättning eller
   studiehjälparens timpenning. Det är ett beräknat tal och märks så;
   underlaget är det som betalas.

   Varje pass räknas i EN månad. Körningen tar allt till och med
   periodens slut som inte står på ett underlag, och första versionen
   räknade som körningen: septembers pass stod både i september och i
   oktober, och Månadens ekonomi visade dem som lön båda månaderna.
   Ett pass som rapporterats efter att dess månad körts står nu i nästa
   körnings månad, märkt "från tidigare månader", och i sin egen som
   "på nästa underlag".

   LÖNEFILEN (Fas 17.1 byggde halvan i databasen). PAXml 2.0, som
   Fortnox Lön läser in under Lön → Kalender → Importera löneunderlag.
   En lönetransaktion per pass: anställningsnumret, lönearten för
   timlön (foretagsfakta.lonart_timlon), passets datum, timmarna,
   timpenningen och beloppet, ur underlagets rader. Fortnox matchar på
   anställningsnumret, så ett nummer som saknas stoppar filen i stället
   för att en persons timmar försvinner ur den. Semesterersättningen
   står inte i filen: Fortnox lägger på den själv, och hade filen också
   gjort det hade den betalats två gånger.

   Bara GODKÄNDA underlag kommer med. Godkänd betyder att någon granskat
   underlaget (Fas 2.6), och en fil med ogranskade timmar ska inte gå
   att läsa in. Utbetald kommer inte med: den lönen är redan betald,
   och så kan inte samma underlag läsas in en gång till efter att det
   markerats.

   Filen byggs i webbläsaren ur det admin redan får läsa. Ingenting
   skickas härifrån, och ingenting ändras av att filen laddas ned.
   ============================================================ */
(function () {
  'use strict';

  const { $, esc, säg, felText, isoFor } = NX;
  const { bekräfta, medan, tomt } = NXStudie;
  const kronor = NXBetalning.kronor;
  const { S, UTB_LAGE, fråga, hämtaAlla, lönemånad, namnFör, pill, senasteLönemånad, tabell, väljare } = NXAdmin;

  /* Anställningsnumren och bolagsfakta. Hämtas när sidan ritas första
     gången, och om efter varje ändring härifrån. */
  const L = { anst: new Map(), bolag: {}, klar: false, anstFel: null, bolagFel: null, laddas: null };

  async function laddaLönefakta() {
    const [a, f] = await Promise.all([
      supa.from('lon_anstallning').select('id, anstallningsnummer'),
      supa.from('foretagsfakta')
        .select('organisationsnummer, studiehjalpare_form, arbetsgivarregistrerad, lonart_timlon')
        .eq('id', 1).maybeSingle()
    ]);
    /* Ett läsfel är inte "inga nummer": listan säger att den inte kunde
       läsa, och filen byggs inte, i stället för att alla ser ut att sakna
       nummer. */
    L.anstFel = a.error ? felText(a.error) : null;
    L.bolagFel = f.error ? felText(f.error) : null;
    L.anst = new Map((a.data || []).map(r => [r.id, r.anstallningsnummer]));
    L.bolag = f.data || {};
    L.klar = true;
  }

  function laddaEnGång() {
    if (L.laddas) return;
    L.laddas = laddaLönefakta().then(() => ritaLöner(), fel => {
      L.anstFel = L.bolagFel = felText(fel);
      L.klar = true;
      ritaLöner();
    });
  }

  /* ------------------------------------------------------------
     MÅNADEN ÄR UTBETALNINGSMÅNADEN (2026-09-28)
     Leo: "september jobb betalas i oktober, därför ska 240kronorna
     visas i oktober". Raden väljer månaden lönen betalas ut, den 25:e,
     och sidan visar passen månaden före: oktober är lönen för
     septembers pass. Så heter en lönekörning i Fortnox Lön också, efter
     utbetalningen. Första versionen valde passens månad, och septembers
     lön stod under september fast den betalas i oktober.

     Bara raden byter. Underlaget (payouts.period), körningen, Ekonomi,
     Månadens ekonomi och studiehjälparens lönespecifikation räknar
     fortfarande på passens månad, och allt under raden räknas på den
     (passmånad).

     Förvald är nästa lönedag: till och med den 25:e den här månadens
     utbetalning, efter den nästa månads.
     ------------------------------------------------------------ */
  let MV = null;
  let önskad = null;

  function passmånad(utbetalning) {
    const [år, mån] = String(utbetalning).split('-').map(Number);
    return NXStudie.månadIso(new Date(år, mån - 2, 1, 12));
  }

  function starta() {
    if (MV) return;
    const host = $('#lon-manader');
    if (!host) return;
    const nu = new Date();
    MV = NXStudie.månadsval(host, {
      antal: 12,
      framåt: 1,
      vald: önskad || NXStudie.månadIso(new Date(nu.getFullYear(), nu.getMonth() + (nu.getDate() > 25 ? 1 : 0), 1, 12)),
      /* Utbetald när varje underlag för passen är det. Stängd (Fas 20.2)
         gäller passens månad och står under Ekonomi; här hade den stått
         en månad senare och sett ut att gälla utbetalningen. */
      märke: m => {
        const p = passmånad(m);
        const u = (S.utbetalningar || []).filter(x => String(x.period).slice(0, 10) === p);
        return u.length && u.every(x => x.status === 'utbetald') ? 'Utbetald' : '';
      },
      vidVal: () => ritaLöner()
    });
  }

  const valdMånad = () => { starta(); return MV ? MV.vald() : NXStudie.månadIso(new Date()); };
  const namn = (m, medÅr) => NXStudie.månadsNamn(m, medÅr);

  /* Månadens ekonomi länkar hit med utbetalningsmånaden för sina pass. */
  function visaLönemånad(utbetalning) {
    önskad = utbetalning;
    if (MV) { MV.sätt(utbetalning); ritaLöner(); }
  }

  /* ------------------------------------------------------------
     RÄKNINGEN
     Samma regler som byggUnderlag() i _delad/pris.ts. Ersättningen är
     tjänstens (tjanster.ersattning_per_timme_ore) när den är satt,
     annars studiehjälparens egen timpenning. Passets tjänst, annars
     standardtjänsten: den första aktiva som kunder kan köpa.
     ------------------------------------------------------------ */
  function standardTjänst() {
    const ordnad = (S.tjanster || []).slice().sort((a, b) =>
      (Number(a.ordning == null ? 100 : a.ordning) - Number(b.ordning == null ? 100 : b.ordning))
      || String(a.kod).localeCompare(String(b.kod)));
    return ordnad.find(t => t.aktiv && t.for_kund) || ordnad[0] || null;
  }

  function timpenningÖre(p) {
    const std = standardTjänst();
    const t = (S.tjanster || []).find(x => x.kod === (p.tjanst || (std && std.kod))) || null;
    const tjänstens = Number((t && t.ersattning_per_timme_ore) || 0);
    if (tjänstens) return tjänstens;
    const egen = (S.tutorProfiler[p.tutor_id] || {}).hourly_rate;
    return egen != null ? Math.round(Number(egen) * 100) : 0;
  }

  const lönMin = p => Number(p.lon_min || p.duration_min || 60);

  const tomRad = id => ({
    id, underlag: null, passIMånaden: 0, tidigare: 0,
    beräknat: { pass: 0, min: 0, öre: 0, utanTimpenning: 0 },
    senare: { pass: 0, min: 0 }, utanRapport: { pass: 0, min: 0 }
  });

  /* En rad per studiehjälpare för månaden. underlag är månadens
     underlag om det finns; beräknat är vad månadens körning tar med om
     det inte finns, och tidigare hur många av de passen som hölls en
     tidigare månad; senare är månadens egna pass som väntar på en
     senare körning; utanRapport är månadens egna pass som inte kommer
     med förrän rapporten finns.

     Ett pass räknas bara i den månad vars körning tar det. Här stod
     förut samma urval som körningen gör, allt till och med månadens
     slut, och då stod septembers pass i oktober också. */
  function månadensLöner(månad) {
    const g = NXStudie.månadsGräns(månad);
    const senast = senasteLönemånad();
    const per = new Map();
    const post = id => {
      if (!per.has(id)) per.set(id, tomRad(id));
      return per.get(id);
    };

    (S.utbetalningar || []).forEach(u => {
      if (String(u.period).slice(0, 10) === g.från) post(u.tutor_id).underlag = u;
    });

    (S.passunderlag || []).forEach(p => {
      if (!p.tutor_id || !p.fakturerbar) return;
      const d = String(p.wanted_date).slice(0, 10);
      if (d >= g.till) return;
      const egen = d >= g.från;
      if (egen) post(p.tutor_id).passIMånaden++;
      if (p.pa_underlag) return;
      const min = lönMin(p);
      if (!p.har_rapport) {
        if (egen) { const r = post(p.tutor_id); r.utanRapport.pass++; r.utanRapport.min += min; }
        return;
      }
      /* En månad med underlag är körd, så ett pass som inte står på det
         tas av en senare körning. */
      if (lönemånad(d, senast) !== g.från) {
        if (egen) { const r = post(p.tutor_id); r.senare.pass++; r.senare.min += min; }
        return;
      }
      const r = post(p.tutor_id);
      if (!egen) r.tidigare++;
      const öre = timpenningÖre(p);
      if (!öre) { r.beräknat.utanTimpenning++; return; }
      r.beräknat.pass++;
      r.beräknat.min += min;
      r.beräknat.öre += Math.round((min / 60) * öre);
    });
    return per;
  }

  const attBetala = r => r.underlag ? Number(r.underlag.belopp_ore || 0) : r.beräknat.öre;
  const lönetid = r => r.underlag ? Number(r.underlag.minuter || 0) : r.beräknat.min;

  /* Månadens ekonomi visar samma tal, och säger när lönen redan är
     utbetald och när ett pass inte räknas för att timpenningen saknas:
     annars hade en lön på noll kronor sett ut som en månad utan pass. */
  function lönFörMånad(månad) {
    const per = månadensLöner(månad);
    let öre = 0, min = 0, beräknat = false, utanTimpenning = 0, underlag = 0, utbetalda = 0, utbetaltÖre = 0;
    per.forEach(r => {
      öre += attBetala(r);
      min += lönetid(r);
      if (!r.underlag && r.beräknat.pass) beräknat = true;
      utanTimpenning += r.beräknat.utanTimpenning;
      if (r.underlag) {
        underlag++;
        if (r.underlag.status === 'utbetald') { utbetalda++; utbetaltÖre += attBetala(r); }
      }
    });
    return {
      öre, min, beräknat, utanTimpenning, utbetaltÖre,
      utbetald: underlag > 0 && utbetalda === underlag && !beräknat
    };
  }

  /* ------------------------------------------------------------
     RITNINGEN
     ------------------------------------------------------------ */
  const tim = m => NXBetalning.timmar(m);

  function kpi(tal, rubrik, under, larm) {
    return '<div class="adm-kpi' + (larm ? ' ar-larm' : '') + '"><b>' + esc(String(tal)) + '</b>'
      + '<span>' + esc(rubrik) + '</span>'
      + (under ? '<span class="adm-kpi-diff">' + esc(under) + '</span>' : '') + '</div>';
  }

  /* Vilka som står i listan: alla godkända studiehjälpare, och alla som
     har något för månaden även om de inte längre är godkända. */
  function personerna(per) {
    const ids = new Set(Object.keys(S.tutorProfiler || {})
      .filter(id => (S.tutorProfiler[id] || {}).status === 'approved'));
    per.forEach((r, id) => {
      if (r.underlag || r.beräknat.pass || r.beräknat.utanTimpenning || r.utanRapport.pass
        || r.senare.pass || r.passIMånaden) ids.add(id);
    });
    return Array.from(ids).map(id => per.get(id) || tomRad(id))
      .sort((a, b) => (attBetala(b) - attBetala(a)) || namnFör(a.id).localeCompare(namnFör(b.id), 'sv'));
  }

  const harNågotAttFå = r => attBetala(r) > 0 || r.beräknat.utanTimpenning > 0;

  function ritaTal(rader, månad) {
    const host = $('#lon-tal');
    if (!host) return;
    const g = NXStudie.månadsGräns(månad);
    const öre = rader.reduce((n, r) => n + attBetala(r), 0);
    const min = rader.reduce((n, r) => n + lönetid(r), 0);
    const pass = rader.reduce((n, r) => n + (r.underlag ? 0 : r.beräknat.pass), 0);
    const tidigare = rader.reduce((n, r) => n + (r.underlag ? 0 : r.tidigare), 0);
    const underlag = rader.filter(r => r.underlag).map(r => r.underlag);
    const godkända = underlag.filter(u => u.status === 'godkand').length;
    const utbetalda = underlag.filter(u => u.status === 'utbetald').length;
    const beräknat = rader.some(r => !r.underlag && r.beräknat.pass);
    const utanRapport = rader.reduce((n, r) => n + r.utanRapport.pass, 0);
    const utanNummer = rader.filter(r => harNågotAttFå(r) && !L.anst.has(r.id)).length;
    const utanTimpenning = rader.reduce((n, r) => n + r.beräknat.utanTimpenning, 0);

    host.innerHTML = '<div class="adm-tal-rad">'
      + kpi(kronor(öre), 'Att betala ut', (beräknat ? 'beräknat · ' : '') + 'den 25 ' + namn(g.till, false)
        + ', pass i ' + namn(månad, false))
      /* En körd månad har inga beräknade pass: det som inte står på
         underlaget tas av nästa körning (NXAdmin.lönemånad). */
      + kpi(tim(min), 'Lönetid', underlag.length ? 'ur underlagen'
        : pass ? pass + ' pass med rapport' + (tidigare ? ', ' + tidigare + ' från tidigare månader' : '')
          : 'inga pass att betala för')
      + kpi(underlag.length, 'Underlag',
        underlag.length ? godkända + ' godkända · ' + utbetalda + ' utbetalda' : 'inte skapade än')
      + kpi(utanRapport, 'Pass utan rapport', utanRapport ? 'kommer inte med förrän rapporten finns' : 'alla har rapport',
        utanRapport > 0)
      /* Innan numren är hämtade vet sidan inte vem som saknar ett, och
         ett tal där hade larmat för alla i en halv sekund. */
      + (L.klar && !L.anstFel
        ? kpi(utanNummer, 'Saknar anställningsnummer', utanNummer ? 'kommer inte med i lönefilen' : 'alla har ett',
          utanNummer > 0)
        : kpi('—', 'Saknar anställningsnummer', L.anstFel ? 'gick inte att läsa' : 'hämtar'))
      + (utanTimpenning ? kpi(utanTimpenning, 'Pass utan timpenning', 'körningen hoppar över dem', true) : '')
      + '</div>';
  }

  function ritaPersoner(rader, månad) {
    const host = $('#lon-personer');
    if (!host) return;
    host.innerHTML = (L.anstFel ? '<p class="eko-andra">Anställningsnumren gick inte att läsa: '
      + esc(L.anstFel) + '</p>' : '') + tabell([
      { namn: 'Studiehjälpare', rita: r => {
        const p = S.personer[r.id] || {};
        const tp = S.tutorProfiler[r.id] || {};
        return '<button type="button" class="eko-lank" data-dp="studiehjalpare:' + esc(r.id) + '"><b>'
          + esc(namnFör(r.id)) + '</b></button>'
          + '<span class="adm-und">' + esc([p.email, p.phone].filter(Boolean).join(' · ') || 'ingen kontakt') + '</span>'
          + (tp.status && tp.status !== 'approved' ? ' ' + pill('Inte godkänd', '') : '');
      } },
      { namn: 'Anst.nr', rita: r => {
        const nr = L.anst.get(r.id);
        return '<button type="button" class="btn btn-ghost btn-sm" data-lon-anst="' + esc(r.id) + '">'
          + esc(nr || 'Sätt') + '</button>'
          + (!nr && L.klar && !L.anstFel && harNågotAttFå(r) ? ' ' + pill('Saknas', 'ar-ny') : '');
      } },
      { namn: 'Timpenning', rita: r => {
        const tp = S.tutorProfiler[r.id] || {};
        return '<button type="button" class="btn btn-ghost btn-sm" data-lon-timpenning="' + esc(r.id) + '">'
          + esc(tp.hourly_rate != null ? NX.kr(tp.hourly_rate) : 'Ej satt') + '</button>';
      } },
      { namn: 'Pass i ' + namn(månad, false), rita: r => '<span class="adm-tal">' + r.passIMånaden + '</span>'
        + (r.utanRapport.pass ? '<span class="adm-und">' + r.utanRapport.pass + ' utan rapport</span>' : '')
        + (r.senare.pass ? '<span class="adm-und">' + r.senare.pass + ' på nästa underlag</span>' : '')
        + (r.tidigare ? '<span class="adm-und">+ ' + r.tidigare + ' från tidigare månader</span>' : '') },
      { namn: 'Lönetid', rita: r => '<span class="adm-tal">' + esc(lönetid(r) ? tim(lönetid(r)) : '—') + '</span>' },
      { namn: 'Att få', rita: r => {
        const öre = attBetala(r);
        return '<span class="adm-tal">' + esc(öre ? kronor(öre) : '—') + '</span>'
          + (r.underlag ? '<span class="adm-und">underlag</span>'
            : r.beräknat.pass ? '<span class="adm-und">beräknat</span>' : '')
          + (r.beräknat.utanTimpenning ? '<span class="adm-und" style="color:var(--acc-text)">'
            + r.beräknat.utanTimpenning + ' pass utan timpenning</span>' : '');
      } },
      /* Rullgardinen och Skicka underlag är samma som under Ekonomi →
         Utbetalningar, och sköts av lyssnarna i nextrum-admin.js. */
      { namn: 'Underlag', höger: true, rita: r => r.underlag
        ? väljare('utb', UTB_LAGE, r.underlag.status, 'data-utb="' + esc(r.underlag.id) + '"')
          + (r.underlag.status !== 'utbetald'
            ? ' <button class="btn btn-ghost btn-sm" type="button" data-skicka="utbetalning" data-id="'
              + esc(r.underlag.id) + '">Skicka underlag</button>' : '')
        : '<span class="adm-und">inte skapat</span>' }
    ], rader, 'Inga godkända studiehjälpare, och ingen med pass i ' + namn(månad));
  }

  /* ------------------------------------------------------------
     LÖNEFILEN
     ------------------------------------------------------------ */
  const FORM = { anstallda: 'anställda', uppdragstagare: 'uppdragstagare', oklart: 'oklart' };

  /* Vad som hindrar filen, och vad som bara ska sägas. månad är passens. */
  function lönefilensLäge(rader, månad) {
    const b = L.bolag;
    const underlag = rader.filter(r => r.underlag).map(r => r.underlag);
    const godkända = underlag.filter(u => u.status === 'godkand');
    const utanNummer = godkända.filter(u => !L.anst.has(u.tutor_id));
    const hinder = [];
    const varningar = [];
    if (!b.lonart_timlon) hinder.push('Lönearten för timlön är inte satt.');
    if (b.studiehjalpare_form === 'uppdragstagare') {
      hinder.push('Bolagsfakta säger att studiehjälparna är uppdragstagare. Då får de inte lön genom Fortnox Lön, de fakturerar.');
    }
    if (!godkända.length) {
      hinder.push(underlag.length
        ? 'Inget av underlagen för pass i ' + namn(månad) + ' är godkänt. Godkänn dem i listan ovanför när du granskat dem.'
        : 'Underlagen för pass i ' + namn(månad) + ' är inte skapade. Kör månadskörningen först.');
    }
    if (utanNummer.length) {
      hinder.push('Anställningsnummer saknas för ' + utanNummer.map(u => namnFör(u.tutor_id)).join(', ') + '.');
    }
    if (b.studiehjalpare_form !== 'anstallda' && b.studiehjalpare_form !== 'uppdragstagare') {
      varningar.push('Bolagsfakta säger att studiehjälparnas form är oklar. En lönefil förutsätter att de är anställda: bestäm det med revisorn innan den första lönen.');
    }
    if (!b.arbetsgivarregistrerad) {
      varningar.push('Bolaget står inte som registrerat arbetsgivare i bolagsfakta.');
    }
    const ogodkända = underlag.length - godkända.length - underlag.filter(u => u.status === 'utbetald').length;
    if (ogodkända > 0 && godkända.length) {
      varningar.push(ogodkända + (ogodkända === 1 ? ' underlag är inte godkänt och kommer inte med.' : ' underlag är inte godkända och kommer inte med.'));
    }
    return { godkända, hinder, varningar };
  }

  function ritaLönefil(rader, månad) {
    const host = $('#lon-fil');
    if (!host) return;
    const läsfel = L.anstFel || L.bolagFel;
    if (läsfel) { host.innerHTML = tomt('Lönefilen går inte att bygga', läsfel); return; }
    if (!L.klar) { NXStudie.laddarFörsta(host); return; }
    const b = L.bolag;
    const l = lönefilensLäge(rader, månad);
    const summa = l.godkända.reduce((n, u) => n + Number(u.belopp_ore || 0), 0);
    const bock = (ok, text, knapp) => '<li class="' + (ok ? 'ar-ok' : 'ar-saknas') + '"><span>' + text + '</span>'
      + (knapp || '') + '</li>';

    host.innerHTML = '<ul class="lon-krav">'
      + bock(!!b.lonart_timlon, 'Löneart för timlön: ' + (b.lonart_timlon ? '<b>' + esc(b.lonart_timlon) + '</b>' : 'inte satt'),
          '<button type="button" class="btn btn-ghost btn-sm" data-lon-lonart>' + (b.lonart_timlon ? 'Ändra' : 'Sätt') + '</button>')
      + bock(l.godkända.length > 0, l.godkända.length
          ? l.godkända.length + (l.godkända.length === 1 ? ' godkänt underlag, ' : ' godkända underlag, ') + esc(kronor(summa))
          : 'Inga godkända underlag för pass i ' + esc(namn(månad)))
      + bock(!l.godkända.some(u => !L.anst.has(u.tutor_id)), l.godkända.some(u => !L.anst.has(u.tutor_id))
          ? 'Anställningsnummer saknas för någon med godkänt underlag' : 'Alla med godkänt underlag har anställningsnummer')
      + bock(b.studiehjalpare_form === 'anstallda', 'Studiehjälparnas form i bolagsfakta: <b>'
          + esc(FORM[b.studiehjalpare_form] || 'okänd') + '</b>',
          '<a class="btn btn-ghost btn-sm" href="#agenter/bolaget">Bolagsfakta</a>')
      + '</ul>'
      + (l.varningar.length ? '<ul class="lon-varning">' + l.varningar.map(v => '<li>' + esc(v) + '</li>').join('') + '</ul>' : '')
      + '<div style="margin-top:14px"><button type="button" class="btn btn-primary btn-sm" data-lon-fil'
      + (l.hinder.length ? ' disabled aria-describedby="lon-fil-varfor"' : '') + '>Ladda ned lönefilen</button>'
      + (l.hinder.length ? '<p class="xsmall" id="lon-fil-varfor" style="color:var(--bl-3);margin:8px 0 0;line-height:1.6">'
        + l.hinder.map(esc).join('<br>') + '</p>' : '')
      + '</div>'
      + '<p class="ok-msg" id="lon-fil-msg" aria-live="polite"></p>';
  }

  /* PAXml 2.0. En lönetransaktion per rad: anställningsnummer, löneart,
     datum, antal timmar, timpris och belopp, i kronor med punkt som
     decimaltecken. Ingen semesterersättning (se filhuvudet), och inget
     personnummer: Fortnox matchar på anstid. */
  function paxml(rader, skapad) {
    const x = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const två = n => String(n).padStart(2, '0');
    const tid = d => d.getFullYear() + '-' + två(d.getMonth() + 1) + '-' + två(d.getDate())
      + 'T' + två(d.getHours()) + ':' + två(d.getMinutes()) + ':' + två(d.getSeconds());
    const kr = öre => (Number(öre) / 100).toFixed(2);
    return '<?xml version="1.0" encoding="utf-8"?>\n'
      + '<paxml xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.paxml.se/2.0/paxml.xsd">\n'
      + '  <header>\n'
      + '    <format>LÖNIN</format>\n'
      + '    <version>2.0</version>\n'
      + '    <datum>' + tid(skapad) + '</datum>\n'
      + '  </header>\n'
      + '  <lonetransaktioner>\n'
      + rader.map(r => '    <lonetrans anstid="' + x(r.anstid) + '">\n'
        + '      <lonart>' + x(r.lonart) + '</lonart>\n'
        + '      <datum>' + x(r.datum) + '</datum>\n'
        + '      <antal>' + (Number(r.minuter) / 60).toFixed(2) + '</antal>\n'
        + '      <apris>' + kr(r.timpenning_ore) + '</apris>\n'
        + '      <belopp>' + kr(r.belopp_ore) + '</belopp>\n'
        + '    </lonetrans>\n').join('')
      + '  </lonetransaktioner>\n'
      + '</paxml>\n';
  }

  function sistaDagen(månad) {
    const [år, mån] = String(månad).split('-').map(Number);
    return isoFor(new Date(år, mån, 0, 12));
  }

  /* Raderna till filen, ur underlagens rader. Datumet är passets; ett
     pass som inte finns i minnet slås upp, och en rad utan pass (passet
     borttaget) får månadens sista dag. */
  async function filensRader(godkända, månad) {
    /* Alla rader (hämtaAlla): en fil med de tusen första hade nekats av
       kontrollen att raderna summerar till underlaget, men först efter
       att någon letat efter felet i fel ände. */
    const { data, error } = await hämtaAlla('payout_lines',
      'id, payout_id, booking_id, beskrivning, minuter, timpenning_ore, belopp_ore',
      q => q.in('payout_id', godkända.map(u => u.id)));
    if (error) throw error;
    const rader = data || [];

    const datum = new Map((S.bokningar || []).map(b => [b.id, String(b.wanted_date).slice(0, 10)]));
    const saknas = rader.map(r => r.booking_id).filter(id => id && !datum.has(id));
    if (saknas.length) {
      const svar = await supa.from('bookings').select('id, wanted_date').in('id', saknas);
      if (svar.error) throw svar.error;
      (svar.data || []).forEach(b => datum.set(b.id, String(b.wanted_date).slice(0, 10)));
    }

    const underlag = new Map(godkända.map(u => [u.id, u]));
    const lonart = L.bolag.lonart_timlon;
    return rader.map(r => ({
      tutor: underlag.get(r.payout_id).tutor_id,
      payout: r.payout_id,
      anstid: L.anst.get(underlag.get(r.payout_id).tutor_id),
      lonart,
      datum: (r.booking_id && datum.get(r.booking_id)) || sistaDagen(månad),
      minuter: Number(r.minuter),
      timpenning_ore: Number(r.timpenning_ore),
      belopp_ore: Number(r.belopp_ore),
      beskrivning: r.beskrivning
    })).sort((a, b) => String(a.anstid).localeCompare(String(b.anstid), 'sv', { numeric: true })
      || a.datum.localeCompare(b.datum));
  }

  document.addEventListener('click', async e => {
    const knapp = e.target.closest('[data-lon-fil]');
    if (!knapp || knapp.disabled) return;
    const utbetalning = valdMånad();
    const månad = passmånad(utbetalning);
    const msg = $('#lon-fil-msg');
    const l = lönefilensLäge(personerna(månadensLöner(månad)), månad);
    if (l.hinder.length) { säg(msg, l.hinder.join(' '), false); return; }

    let rader;
    try {
      rader = await medan(knapp, 'Hämtar raderna…', () => filensRader(l.godkända, månad));
    } catch (fel) {
      säg(msg, 'Underlagens rader gick inte att läsa: ' + felText(fel), false);
      return;
    }

    /* Filen ska säga exakt det underlagen säger. En rad som inte går
       ihop, eller ett underlag vars rader inte summerar till dess
       belopp, stoppar filen: det är samma fel som larmar som
       utbetalning_summa_fel under Ekonomi. */
    const fel = [];
    l.godkända.forEach(u => {
      const egna = rader.filter(r => r.payout === u.id);
      const summa = egna.reduce((n, r) => n + r.belopp_ore, 0);
      if (!egna.length) fel.push(namnFör(u.tutor_id) + ': underlaget har inga rader.');
      else if (summa !== Number(u.belopp_ore)) {
        fel.push(namnFör(u.tutor_id) + ': raderna blir ' + kronor(summa) + ', underlaget säger ' + kronor(u.belopp_ore) + '.');
      }
    });
    if (fel.length) { säg(msg, 'Filen byggdes inte. ' + fel.join(' '), false); return; }

    const avrundade = rader.filter(r => r.minuter % 15 !== 0
      || Math.round(r.minuter * r.timpenning_ore / 60) !== r.belopp_ore).length;
    const perPerson = l.godkända.map(u => {
      const egna = rader.filter(r => r.payout === u.id);
      return 'Anst.nr ' + L.anst.get(u.tutor_id) + '  ' + namnFör(u.tutor_id) + '  ·  '
        + egna.length + ' pass  ·  ' + tim(egna.reduce((n, r) => n + r.minuter, 0))
        + '  ·  ' + kronor(u.belopp_ore);
    });
    const ja = await bekräfta({
      titel: 'Ladda ned lönefilen för den 25 ' + namn(utbetalning) + '?',
      text: 'Passen i ' + namn(månad) + '. I Fortnox: Lön → Kalender → Importera löneunderlag, för utbetalningen '
        + 'den 25 ' + namn(utbetalning, false) + ', och välj filen. Läs in den en gång: '
        + 'finns timmarna redan i Fortnox läggs de till en gång till. Markera underlagen Utbetald här '
        + 'när lönen är betald, så kommer de inte med i nästa fil.'
        + (l.varningar.length ? '\n\n' + l.varningar.join('\n') : '')
        + (avrundade ? '\n\n' + avrundade + (avrundade === 1 ? ' rad har' : ' rader har')
          + ' ett belopp som inte är exakt timmar gånger timpris. Beloppet i filen är underlagets.' : ''),
      forhandsvisning: 'Löneart ' + L.bolag.lonart_timlon + ', ' + rader.length
        + (rader.length === 1 ? ' lönetransaktion' : ' lönetransaktioner') + '\n\n' + perPerson.join('\n'),
      knapp: 'Ladda ned',
      avbryt: 'Avbryt'
    });
    if (!ja) return;

    const xml = paxml(rader, new Date());
    const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml;charset=utf-8' }));
    const länk = document.createElement('a');
    länk.href = url;
    /* Filen heter efter utbetalningen, som lönekörningen i Fortnox. */
    länk.download = 'nextrum-lonefil-' + utbetalning.slice(0, 7) + '.xml';
    document.body.appendChild(länk);
    länk.click();
    länk.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    säg(msg, 'Lönefilen är nedladdad: ' + rader.length + (rader.length === 1 ? ' rad' : ' rader') + ', '
      + kronor(l.godkända.reduce((n, u) => n + Number(u.belopp_ore || 0), 0)) + '.', true);
  });

  /* ------------------------------------------------------------
     PERSONERNAS UPPGIFTER
     ------------------------------------------------------------ */
  document.addEventListener('click', async e => {
    const anst = e.target.closest('[data-lon-anst]');
    const timp = e.target.closest('[data-lon-timpenning]');
    const lonart = e.target.closest('[data-lon-lonart]');
    if (!anst && !timp && !lonart) return;

    if (anst) {
      const id = anst.dataset.lonAnst;
      const nu = L.anst.get(id) || '';
      const svar = await fråga({
        titel: 'Anställningsnummer för ' + namnFör(id),
        text: 'Samma nummer som personen har i personalregistret i Fortnox Lön. Lönefilen matchar på det, '
          + 'och ett fel nummer ger timmarna till fel person.',
        innehåll: '<div class="fgroup" style="margin-top:14px"><label for="lon-anst-nr">Anställningsnummer</label>'
          + '<input class="inp" id="lon-anst-nr" autocomplete="off" maxlength="20" value="' + esc(nu) + '"></div>'
          + '<p class="xsmall" style="color:var(--bl-3);margin:8px 0 0">Tomt tar bort numret.</p>',
        knapp: 'Spara',
        läs: ruta => {
          const v = $('#lon-anst-nr', ruta).value.trim();
          if (v && !/^[0-9A-Za-z-]{1,20}$/.test(v)) {
            return { fel: 'Bara siffror, bokstäver och bindestreck, högst 20 tecken.' };
          }
          const upptaget = v && Array.from(L.anst.entries()).find(([annan, n]) => n === v && annan !== id);
          if (upptaget) return { fel: 'Numret används redan av ' + namnFör(upptaget[0]) + '.' };
          return { värde: { nr: v } };
        }
      });
      if (!svar || svar.nr === nu) return;
      await medan(anst, 'Sparar…', async () => {
        const { error } = svar.nr
          ? await supa.from('lon_anstallning')
            .upsert({ id, anstallningsnummer: svar.nr, satt_at: new Date().toISOString() }, { onConflict: 'id' })
          : await supa.from('lon_anstallning').delete().eq('id', id);
        if (error) { alert('Kunde inte spara anställningsnumret: ' + felText(error)); return; }
        await laddaLönefakta();
      });
      ritaLöner();
      return;
    }

    if (timp) {
      const id = timp.dataset.lonTimpenning;
      const tp = S.tutorProfiler[id];
      if (!tp) { alert(namnFör(id) + ' har ingen profil som studiehjälpare.'); return; }
      const kr = await fråga({
        titel: 'Timpenning för ' + namnFör(id),
        text: 'Kronor per timme, före skatt. Gäller pass som kommer med på nästa underlag: underlag som redan '
          + 'skapats är räknade och ändras inte. En tjänst med egen ersättning (Tjänster & priser) går före timpenningen.',
        innehåll: '<div class="fgroup" style="margin-top:14px"><label for="lon-timpenning">Timpenning, kronor</label>'
          + '<input class="inp" id="lon-timpenning" type="number" min="1" max="2000" step="0.01" inputmode="decimal" value="'
          + esc(tp.hourly_rate != null ? String(tp.hourly_rate) : '') + '"></div>',
        knapp: 'Spara',
        läs: ruta => {
          const v = Number($('#lon-timpenning', ruta).value);
          if (!v || v < 1 || v > 2000) return { fel: 'Skriv timpenningen i kronor, mellan 1 och 2 000.' };
          return { värde: Math.round(v * 100) / 100 };
        }
      });
      if (!kr || Number(tp.hourly_rate) === kr) return;
      await medan(timp, 'Sparar…', async () => {
        const { error } = await supa.from('tutor_profiles').update({ hourly_rate: kr }).eq('id', id);
        if (error) { alert('Kunde inte spara timpenningen: ' + felText(error)); return; }
        tp.hourly_rate = kr;
      });
      ritaLöner();
      if (typeof NXAdmin.rita.ritaStudiehjalpare === 'function') NXAdmin.rita.ritaStudiehjalpare();
      if (typeof NXAdmin.rita.ritaMånaden === 'function') NXAdmin.rita.ritaMånaden();
      return;
    }

    const nu = (L.bolag && L.bolag.lonart_timlon) || '';
    const svar = await fråga({
      titel: 'Löneart för timlön',
      text: 'Numret på lönearten för timlön i Fortnox Lön. Alla timmar i lönefilen skrivs på den. '
        + 'Semesterersättningen lägger Fortnox på själv, och den står inte i filen.',
      innehåll: '<div class="fgroup" style="margin-top:14px"><label for="lon-lonart">Löneart</label>'
        + '<input class="inp" id="lon-lonart" autocomplete="off" maxlength="10" value="' + esc(nu) + '"></div>',
      knapp: 'Spara',
      läs: ruta => {
        const v = $('#lon-lonart', ruta).value.trim();
        if (v && !/^[0-9A-Za-z]{1,10}$/.test(v)) return { fel: 'Bara siffror och bokstäver, högst tio tecken.' };
        return { värde: { lonart: v } };
      }
    });
    if (!svar || svar.lonart === nu) return;
    await medan(lonart, 'Sparar…', async () => {
      const { error } = await supa.from('foretagsfakta')
        .update({ lonart_timlon: svar.lonart || null, uppdaterad: new Date().toISOString() }).eq('id', 1);
      if (error) { alert('Kunde inte spara lönearten: ' + felText(error)); return; }
      await laddaLönefakta();
    });
    ritaLöner();
  });

  /* ------------------------------------------------------------
     RITNINGEN
     ------------------------------------------------------------ */
  function ritaLöner() {
    if (!$('#lon-tal')) return;
    starta();
    laddaEnGång();
    if (MV) MV.märk();
    const utbetalning = valdMånad();
    const månad = passmånad(utbetalning);
    const rader = personerna(månadensLöner(månad));
    ritaTal(rader, månad);
    ritaPersoner(rader, månad);
    ritaLönefil(rader, månad);
    const filMånad = $('#lon-fil-manad');
    if (filMånad) filMånad.textContent = 'den 25 ' + namn(utbetalning);
    /* Körningen gäller passens månad: oktobers lön är körningen för
       september. */
    const körning = $('#lon-korning');
    if (körning && NXAdmin.rita.sättKörningsperiod) {
      NXAdmin.rita.sättKörningsperiod(körning, månad);
      const rubrik = körning.querySelector('[data-kor-namn]');
      if (rubrik) rubrik.textContent = 'pass i ' + namn(månad);
    }
  }

  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, {
    lönFörMånad, paxml, ritaLöner, visaLönemånad
  });
})();
