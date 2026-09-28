/* ============================================================
   NEXTRUM — adminvyn, Månadens ekonomi: vad månadens pass har dragit
   in, vad som väntar, och hos vem

   Leo 2026-09-28: "gör en till ekonomi avdelning för månaden ... där
   ska man aktuellt se hur många fakturor som ska skickas samt så många
   lektioner som är betalda för. hur många timmar är betalt samt ej
   ännu betalt ... när man klickar på siffrorna ska man få upp vilka
   familjer som det handlar om ... detta för att ej ha problem om
   kassalikviditet".

   Ekonomi (nextrum-admin-ekonomi.js) svarar på om månaden går ihop och
   kan stängas. Den här sidan svarar på något annat: vilka pengar har
   kommit in för månadens pass, vilka väntar, och hos vem. Varje tal är
   en knapp, och under talen står familjerna det gäller, med passen och
   vägen till familjens egen panel.

   INGET NYTT I DATABASEN. Allt räknas ur det adminvyn redan hämtat:
   passen, passunderlaget, fakturorna med sina rader, tilläggen och
   köpen av timmar. Samma gränser som Ekonomi: passets månad, och
   passunderlagets minuter för ett genomfört pass. Ett tal här och en
   rad under Ekonomi räknas alltså aldrig på två sätt.

   VARJE PASS FÅR ETT LÄGE. läge() sorterar passet efter hur det är
   betalt (kort, faktura, köpta timmar, timbanken) eller varför det inte
   är det (fakturan väntar, passet hölls utan betalning, passet har inte
   hållits än). Talen är summor av lägena, och familjelistan visar samma
   lägen per pass.

   BELOPPEN. För ett betalt pass kvittot: betalt_ore minus det som gått
   tillbaka. För ett pass på en faktura fakturans rad. För det som inte
   är betalt vad passet kostar, med samma regel som familjen ser i sin
   vy (NXBetalning.passpris). Testbetalningar räknas för sig och aldrig
   in, som i bokslutet: ett testpass ska aldrig se ut som pengar.

   FAKTURORNA SKAPAS HÄR, men inte på ett nytt sätt. Knappen kör
   månadskörningen för den valda månaden, samma körning som under
   Ekonomi och Löner, och knapparna på varje faktura är samma som under
   Ekonomi → Fakturor (data-fakt-*): lyssnarna bor där. Fortnox har
   ingen import av kundfakturor från fil, så fakturan läggs in där för
   hand med Underlag, och numret skrivs tillbaka med Lagd i Fortnox.
   ============================================================ */
(function () {
  'use strict';

  const { $, esc, isoFor } = NX;
  const { tomt } = NXStudie;
  const kronor = NXBetalning.kronor;
  const { S, FAKT_LAGE, kortDatum, namnFör, pill } = NXAdmin;

  /* ------------------------------------------------------------
     MÅNADEN
     En egen väljare, som Ekonomi och Löner har sina: sidorna läses var
     för sig, och en månad vald här ska inte flytta de andra.
     ------------------------------------------------------------ */
  let MV = null;
  /* Talet vars familjer står under talen. Ej betalda först: det är
     det man gör något åt. */
  let vy = 'ejbetalda';

  function starta() {
    if (MV) return;
    const host = $('#man-manader');
    if (!host) return;
    MV = NXStudie.månadsval(host, {
      antal: 12,
      framåt: 2,
      märke: m => S.stangdaManader && S.stangdaManader.has(m) ? 'Stängd' : '',
      vidVal: () => ritaMånaden()
    });
  }

  const valdMånad = () => { starta(); return MV ? MV.vald() : NXStudie.månadIso(new Date()); };
  const månadText = () => NXStudie.månadsNamn(valdMånad());

  /* gte och lt på datumet som text, som i Ekonomi och manad_lage(). */
  function iMånaden(datum) {
    if (!datum) return false;
    const g = NXStudie.månadsGräns(valdMånad());
    const d = String(datum).slice(0, 10);
    return d >= g.från && d < g.till;
  }

  /* En tidsstämpel hör till den svenska dagen, inte UTC-dagen: ett köp
     strax efter midnatt den 1:a hör till den nya månaden. */
  const iMånadenTid = ts => !!ts && iMånaden(isoFor(new Date(ts)));

  /* Katalogen är reserven för pass som bokades innan priset började
     frysas (Fas 19.5). Den laddas en gång; tills den finns står ett
     sådant pass utan belopp, och sidan ritas om när den kommer. */
  let katalogen = null;
  function laddaKatalogen() {
    if (katalogen || typeof NXTjanster === 'undefined') return;
    katalogen = NXTjanster.ladda().then(() => ritaMånaden(), () => {});
  }

  /* ------------------------------------------------------------
     LÄGENA
     Ordet på passet, färgen, och ordet med ett antal framför ("2 med
     kort") i familjens rad. Färgen är samma som i resten av Ekonomi:
     grönt är betalt, gult väntar på något, rött borde ha hänt redan.
     ------------------------------------------------------------ */
  const LÄGE = {
    kort:              ['Betalt med kort', 'ar-klar', 'med kort'],
    faktura_betald:    ['Fakturan betald', 'ar-klar', 'på betald faktura'],
    timmar:            ['Köpta timmar', 'ar-klar', 'med köpta timmar'],
    timbank:           ['Timbanken', 'ar-klar', 'ur timbanken'],
    obetalt:           ['Hölls, inte betalt', 'ar-ny', 'hölls, inte betalt'],
    faktura_saknas:    ['Ska faktureras', 'ar-vantar', 'ska faktureras'],
    faktura_utkast:    ['Inte inlagd i Fortnox', 'ar-vantar', 'på faktura som inte är inlagd i Fortnox'],
    faktura_skickad:   ['Fakturerat', 'ar-vantar', 'fakturerat'],
    faktura_forfallen: ['Fakturan har förfallit', 'ar-ny', 'på förfallen faktura'],
    kommande:          ['Inte hållet än', '', 'inte hållet än'],
    bjudet:            ['Första timmen bjuden', '', 'första timmen bjuden'],
    aterbetalt:        ['Återbetalt', '', 'återbetalt'],
    makulerad:         ['Fakturan makulerad', '', 'på makulerad faktura'],
    test:              ['Testbetalning', '', 'testbetalning']
  };

  const BETALDA = ['kort', 'faktura_betald', 'timmar', 'timbank'];
  const HÅLLNA_OBETALDA = ['obetalt', 'faktura_saknas', 'faktura_utkast', 'faktura_skickad', 'faktura_forfallen'];
  const KOMMANDE = ['kommande'];
  const PENGAR_IN = ['kort', 'faktura_betald'];
  const MED_TIMMAR = ['timmar', 'timbank'];

  /* Hur passet är betalt, eller varför det inte är det. Sätter också
     r.öre: kvittot, fakturaraden eller vad passet kostar. null betyder
     att priset inte går att räkna (katalogen är inte laddad än). */
  function läge(r) {
    const b = r.b;
    const st = b.betalning_status || 'ingen';
    r.öre = 0;
    if (st === 'betald' || st === 'tvist') {
      /* Köpta timmar och timbanken är betalda med pengar som kom in när
         timmarna köptes. De är betalda, men de är inga pengar i månaden. */
      if (b.klippkort_id) return 'timmar';
      if (S.timbankPass && S.timbankPass.has(b.id)) return 'timbank';
      if (b.stripe_skarp === false) return 'test';
      r.öre = Number(b.betalt_ore || 0) - Number(b.aterbetald_ore || 0);
      return 'kort';
    }
    if (st === 'faktura') {
      if (!r.faktura) { r.öre = pris(r); return 'faktura_saknas'; }
      r.öre = Number(r.faktura.rad.belopp_ore || 0);
      const fl = NXBetalning.fakturaLage(r.faktura.f);
      if (fl === 'betald') return 'faktura_betald';
      if (fl === 'forfallen') return 'faktura_forfallen';
      if (fl === 'skickad') return 'faktura_skickad';
      if (fl === 'makulerad') { r.öre = 0; return 'makulerad'; }
      return 'faktura_utkast';
    }
    if (st === 'aterbetald') return 'aterbetalt';
    const p = pris(r);
    /* Ett pass på noll kronor är inte obetalt (Fas 19.5). */
    if (p === 0) return 'bjudet';
    r.öre = p;
    return r.b.status === 'completed' ? 'obetalt' : 'kommande';
  }

  /* Vad passet kostar familjen. Ett genomfört pass kostar den hållna
     tiden minus övertiden timbanken tog, alla andra det bokade: samma
     minuter som familjens vy och kassan räknar. */
  function pris(r) {
    const minuter = r.b.status === 'completed'
      ? r.min - Number((r.u && r.u.timbank_min) || 0)
      : r.min;
    return NXBetalning.passpris(r.b, r.u, minuter);
  }

  /* Månadens pass, ett objekt per pass med läget och minuterna. Bara
     bekräftade och genomförda: ett förslag är inget pass än, och ett
     avbokat ska inte betalas (det som ändå betalats larmar under
     Ekonomi som betald_men_avbokad). */
  function månadensPass() {
    const pu = new Map((S.passunderlag || []).map(p => [p.id, p]));
    const påFaktura = new Map();
    (S.fakturor || []).forEach(f => (f.invoice_lines || []).forEach(rad => {
      if (rad.booking_id) påFaktura.set(rad.booking_id, { f, rad });
    }));
    /* Tillägget för övertid är en egen kortbetalning (Fas 20.1). Samma
       urval som manad_lage(): betalt, återbetalt eller bestritt, och
       aldrig en testbetalning. */
    const tillägg = new Map();
    (S.tillagg || []).forEach(t => {
      if (['betald', 'aterbetald', 'tvist'].indexOf(t.status) === -1 || t.stripe_skarp === false) return;
      tillägg.set(t.booking_id, (tillägg.get(t.booking_id) || 0)
        + Number(t.betalt_ore || 0) - Number(t.aterbetald_ore || 0));
    });

    return (S.bokningar || [])
      .filter(b => iMånaden(b.wanted_date) && (b.status === 'confirmed' || b.status === 'completed'))
      .map(b => {
        const u = pu.get(b.id) || null;
        const r = {
          b, u,
          /* Den hållna tiden för ett genomfört pass (passunderlaget),
             annars det bokade. */
          min: b.status === 'completed'
            ? Number((u && u.debiterade_min) || b.duration_min || 60)
            : Number(b.duration_min || 60),
          undantaget: b.fakturerbar === false,
          tillägg: tillägg.get(b.id) || 0,
          faktura: påFaktura.get(b.id) || null
        };
        r.läge = läge(r);
        return r;
      });
  }

  /* ------------------------------------------------------------
     TALEN
     ------------------------------------------------------------ */
  function summa(rader, lägen) {
    const r = rader.filter(x => lägen.indexOf(x.läge) !== -1);
    return {
      rader: r,
      pass: r.length,
      min: r.reduce((n, x) => n + x.min, 0),
      öre: r.reduce((n, x) => n + Number(x.öre || 0), 0),
      okända: r.filter(x => x.öre == null).length
    };
  }

  const passText = n => n + ' pass';
  const tim = m => NXBetalning.timmar(m);

  /* Fakturorna som ska ut för månadens pass: familjer vars fakturapass
     inte står på någon faktura än, och utkast som inte lagts in i
     Fortnox. En faktura per familj och period, så det är familjer och
     utkast som räknas, inte pass. */
  function fakturorAttSkicka(rader) {
    const attSkapa = new Set(rader.filter(x => x.läge === 'faktura_saknas').map(x => x.b.parent_id));
    const utkast = new Set(rader.filter(x => x.läge === 'faktura_utkast').map(x => x.faktura.f.id));
    return { attSkapa, utkast, antal: attSkapa.size + utkast.size };
  }

  /* Köpta timmar, på dagen de betalades. Pengarna kom in i månaden,
     men de är en skuld till familjen tills timmarna använts. */
  function köpIMånaden() {
    return (S.klippkort || []).filter(k =>
      ['betald', 'aterbetald', 'tvist'].indexOf(k.status) !== -1
      && iMånadenTid(k.betald_at)
      && !(S.klippkortTest && S.klippkortTest.has(k.id)));
  }

  /* Ett tal är en knapp som visar familjerna under talen. Lönerna har
     en egen sida, och deras tal är därför en länk dit. */
  function tavla(id, tal, rubrik, under, larm) {
    const inne = '<b>' + esc(String(tal)) + '</b>'
      + '<span>' + esc(rubrik) + '</span>'
      + (under ? '<span class="adm-kpi-diff">' + esc(under) + '</span>' : '');
    const klass = 'adm-kpi man-tavla' + (larm ? ' ar-larm' : '');
    if (id === 'loner') return '<a class="' + klass + '" href="#loner" data-man-loner>' + inne + '</a>';
    return '<button type="button" class="' + klass + '" data-man-vy="' + id + '"'
      + ' aria-pressed="' + (vy === id) + '" aria-controls="man-detalj">' + inne + '</button>';
  }

  function ritaTal(rader) {
    const host = $('#man-tal');
    if (!host) return;
    const g = NXStudie.månadsGräns(valdMånad());
    const slut = isoFor(new Date()) >= g.till;
    const räknas = rader.filter(x => !x.undantaget);

    const betalda = summa(räknas, BETALDA);
    const timmar = summa(räknas, MED_TIMMAR);
    const hållna = summa(räknas, HÅLLNA_OBETALDA);
    const obetalda = summa(räknas, ['obetalt', 'faktura_forfallen']);
    const kommande = summa(räknas, KOMMANDE);
    const inKort = summa(räknas, PENGAR_IN);
    const tillägg = räknas.reduce((n, x) => n + x.tillägg, 0);
    const fakt = fakturorAttSkicka(räknas);
    const köp = köpIMånaden();
    const köpt = köp.reduce((n, k) => n + Number(k.betalt_ore || 0) - Number(k.aterbetald_ore || 0), 0);
    const köptaTimmar = köp.reduce((n, k) => n + Number(k.timmar || 0), 0);
    const lön = typeof NXAdmin.rita.lönFörMånad === 'function' ? NXAdmin.rita.lönFörMånad(valdMånad()) : null;
    const okänt = n => n ? ' · ' + n + ' utan pris' : '';

    /* Lönen för månadens pass betalas ut den 25:e månaden efter. */
    const nästa = g.till;
    host.innerHTML =
      '<h6 class="man-rubrik">Passen i ' + esc(månadText()) + '</h6>'
      + '<div class="adm-tal-rad man-tavlor">'
      + tavla('betalda', passText(betalda.pass), 'Betalda', tim(betalda.min)
          + (timmar.pass ? ' · ' + timmar.pass + ' med köpta timmar' : ''))
      + tavla('ejbetalda', passText(hållna.pass), 'Hållna, inte betalda än', tim(hållna.min) + ' · '
          + kronor(hållna.öre) + okänt(hållna.okända), obetalda.pass > 0)
      + tavla('fakturor', fakt.antal, fakt.antal === 1 ? 'Faktura att skicka' : 'Fakturor att skicka',
          fakt.antal ? fakt.attSkapa.size + ' att skapa · ' + fakt.utkast.size + ' att lägga in i Fortnox'
            : 'inga som väntar', slut && fakt.attSkapa.size > 0)
      + tavla('kommande', passText(kommande.pass), 'Kommande, inte betalda', tim(kommande.min) + ' · '
          + kronor(kommande.öre) + okänt(kommande.okända))
      + '</div>'
      + '<h6 class="man-rubrik">Pengarna</h6>'
      + '<div class="adm-tal-rad man-tavlor">'
      + tavla('inbetalt', kronor(inKort.öre + tillägg), 'Inbetalt för månadens pass',
          'kort och betalda fakturor' + (tillägg ? ' · ' + kronor(tillägg) + ' i tillägg' : ''))
      + tavla('attfain', kronor(hållna.öre + kommande.öre), 'Att få in',
          kronor(hållna.öre) + ' för hållna pass' + okänt(hållna.okända + kommande.okända))
      + tavla('kopta', kronor(köpt), 'Köpta timmar', köp.length
          ? köp.length + (köp.length === 1 ? ' köp' : ' köp') + ' · ' + köptaTimmar + ' timmar'
          : 'inga köp i månaden')
      + tavla('loner', lön ? kronor(lön.öre) : '—', 'Löner att betala ut',
          lön ? (lön.beräknat ? 'beräknat · ' : '') + 'den 25 ' + NXStudie.månadsNamn(nästa, false)
            : 'räknas under Löner')
      + '</div>';
  }

  /* ------------------------------------------------------------
     FAMILJERNA BAKOM TALET
     ------------------------------------------------------------ */
  const VYER = {
    betalda: {
      rubrik: 'Betalda pass',
      text: 'Pass i månaden som är betalda, med kort, mot en betald faktura eller med timmar familjen köpt i förväg. Pengarna för köpta timmar kom in när de köptes.',
      lägen: BETALDA, tillägg: true
    },
    ejbetalda: {
      rubrik: 'Hållna pass som inte är betalda än',
      text: 'Hölls i månaden och är inte betalda. Kort: familjen betalar när de bekräftar rapporten, och betalningsknappen ligger kvar på passet i deras vy. Faktura: fakturan skapas i månadskörningen, läggs in i Fortnox och betalas inom tio dagar.',
      lägen: HÅLLNA_OBETALDA
    },
    kommande: {
      rubrik: 'Kommande pass som inte är betalda',
      text: 'Bekräftade pass som inte hållits än. Familjen betalar i förväg eller efter passet, med kort eller faktura. Köpta timmar betalar dem av sig själva.',
      lägen: KOMMANDE
    },
    inbetalt: {
      rubrik: 'Inbetalt för månadens pass',
      text: 'Kortbetalningar, fakturor som är betalda och tillägg för övertid, minus det som betalats tillbaka. Testbetalningar räknas inte.',
      lägen: PENGAR_IN, tillägg: true
    },
    attfain: {
      rubrik: 'Pengar som ska komma in',
      text: 'Hållna pass som inte är betalda, och kommande pass som inte är betalda i förväg. Beloppet är vad passet kostar, med priset som frystes när det bokades.',
      lägen: HÅLLNA_OBETALDA.concat(KOMMANDE)
    }
  };

  function kontakt(id) {
    const p = S.personer[id] || {};
    return [p.email, p.phone].filter(Boolean).join(' · ');
  }

  function passRad(x, medTillägg) {
    const b = x.b;
    const l = LÄGE[x.läge] || [x.läge, ''];
    const belopp = x.öre == null ? 'pris saknas'
      : MED_TIMMAR.indexOf(x.läge) !== -1 ? tim(x.min)
      : kronor(x.öre);
    return '<li>'
      + '<button type="button" class="eko-lank" data-dp="pass:' + esc(b.id) + '"><b>' + esc(kortDatum(b.wanted_date)) + '</b></button>'
      + '<span class="man-pass-vad">' + esc([b.subject || 'Pass', namnFör(b.tutor_id), tim(x.min)]
          .filter(v => v && v !== '—').join(' · ')) + ' ' + pill(l[0], l[1])
      + (b.betalning_status === 'tvist' ? ' ' + pill('Tvist', 'ar-ny') : '')
      + (medTillägg && x.tillägg ? ' <span class="man-not">+ ' + esc(kronor(x.tillägg)) + ' i tillägg</span>' : '')
      + '</span>'
      + '<span class="man-pass-belopp">' + esc(belopp) + '</span>'
      + '</li>';
  }

  function familjLista(rader, v) {
    const per = new Map();
    rader.forEach(x => {
      const med = v.lägen.indexOf(x.läge) !== -1;
      if (!med && !(v.tillägg && x.tillägg)) return;
      const id = x.b.parent_id || '';
      const f = per.get(id) || { id, rader: [], min: 0, öre: 0, okända: 0, timmar: 0 };
      f.rader.push(x);
      if (med) {
        f.min += x.min;
        if (x.öre == null) f.okända++;
        else f.öre += x.öre;
        if (MED_TIMMAR.indexOf(x.läge) !== -1) f.timmar += x.min;
      }
      if (v.tillägg) f.öre += x.tillägg;
      per.set(id, f);
    });
    const familjer = Array.from(per.values()).sort((a, b) =>
      (b.öre - a.öre) || (b.rader.length - a.rader.length)
      || namnFör(a.id).localeCompare(namnFör(b.id), 'sv'));

    if (!familjer.length) {
      return tomt('Inga pass här i ' + månadText(), 'Talet är noll: ingen familj att visa.');
    }
    return '<div class="man-familjer">' + familjer.map(f => {
      const räkna = {};
      f.rader.forEach(x => { räkna[x.läge] = (räkna[x.läge] || 0) + 1; });
      const lägen = Object.keys(räkna).filter(k => v.lägen.indexOf(k) !== -1)
        .map(k => { const l = LÄGE[k] || [k, '', k]; return pill(räkna[k] + ' ' + l[2], l[1]); }).join(' ');
      const antal = f.rader.filter(x => v.lägen.indexOf(x.läge) !== -1).length;
      const summaText = f.öre || !f.timmar ? kronor(f.öre) : tim(f.timmar) + ' med timmar';
      return '<div class="man-fam">'
        + '<div class="man-fam-topp">'
        + '<div class="man-fam-vem"><b>' + esc(f.id ? namnFör(f.id) : 'Pass utan familj') + '</b>'
        + (kontakt(f.id) ? '<span>' + esc(kontakt(f.id)) + '</span>' : '') + '</div>'
        + '<div class="man-fam-tal"><b>' + esc(summaText) + '</b>'
        + '<span>' + esc(passText(antal) + ' · ' + tim(f.min) + (f.okända ? ' · ' + f.okända + ' utan pris' : '')) + '</span></div>'
        + '<div class="man-fam-atg">' + (f.id
          ? '<button class="btn btn-ghost btn-sm" type="button" data-dp="familj:' + esc(f.id) + '">Öppna familjen</button>'
          : '') + '</div>'
        + (lägen ? '<div class="man-fam-lagen">' + lägen + '</div>' : '')
        + '</div>'
        + '<details class="man-fam-pass"><summary>Visa passen</summary><ul>'
        + f.rader.slice().sort((a, b) => String(a.b.wanted_date).localeCompare(String(b.b.wanted_date)))
          .map(x => passRad(x, v.tillägg)).join('')
        + '</ul></details>'
        + '</div>';
    }).join('') + '</div>';
  }

  /* Fakturorna för månadens pass, per familj och i den ordning de ska
     hanteras: att skapa, att lägga in i Fortnox, att få betalt för,
     betalda. Knapparna är desamma som under Ekonomi → Fakturor och
     sköts av lyssnarna där. */
  function fakturaLista(rader) {
    const fakturapass = rader.filter(x => x.b.betalning_status === 'faktura');
    if (!fakturapass.length) {
      return tomt('Inga fakturapass i ' + månadText(),
        'Familjen väljer faktura när de bekräftar rapporten, och passen samlas på en faktura i början av nästa månad.');
    }
    const attSkapa = new Map();
    const fakturor = new Map();
    fakturapass.forEach(x => {
      if (x.faktura) {
        const f = x.faktura.f;
        const post = fakturor.get(f.id) || { f, rader: [] };
        post.rader.push(x);
        fakturor.set(f.id, post);
      } else {
        const post = attSkapa.get(x.b.parent_id) || { id: x.b.parent_id, rader: [], öre: 0, okända: 0 };
        post.rader.push(x);
        if (x.öre == null) post.okända++; else post.öre += x.öre;
        attSkapa.set(x.b.parent_id, post);
      }
    });

    const ORDNING = { utkast: 0, forfallen: 1, skickad: 2, betald: 3, makulerad: 4 };
    const lista = Array.from(fakturor.values()).sort((a, b) =>
      (ORDNING[NXBetalning.fakturaLage(a.f)] - ORDNING[NXBetalning.fakturaLage(b.f)])
      || namnFör(a.f.parent_id).localeCompare(namnFör(b.f.parent_id), 'sv'));

    const passLista = post => '<details class="man-fam-pass"><summary>Visa passen</summary><ul>'
      + post.rader.slice().sort((a, b) => String(a.b.wanted_date).localeCompare(String(b.b.wanted_date)))
        .map(x => passRad(x, false)).join('') + '</ul></details>';

    let h = '<div class="man-familjer">';
    Array.from(attSkapa.values()).forEach(post => {
      h += '<div class="man-fam"><div class="man-fam-topp">'
        + '<div class="man-fam-vem"><b>' + esc(namnFör(post.id)) + '</b>'
        + (kontakt(post.id) ? '<span>' + esc(kontakt(post.id)) + '</span>' : '') + '</div>'
        + '<div class="man-fam-tal"><b>' + esc(kronor(post.öre)) + '</b><span>'
        + esc(passText(post.rader.length) + (post.okända ? ' · ' + post.okända + ' utan pris' : '')) + '</span></div>'
        + '<div class="man-fam-atg"><button class="btn btn-ghost btn-sm" type="button" data-dp="familj:'
        + esc(post.id) + '">Öppna familjen</button></div>'
        + '<div class="man-fam-lagen">' + pill('Ingen faktura än', 'ar-vantar')
        + ' <span class="man-not">skapas av månadskörningen ovanför</span></div>'
        + '</div>' + passLista(post) + '</div>';
    });
    lista.forEach(post => {
      const f = post.f;
      const l = FAKT_LAGE[NXBetalning.fakturaLage(f)] || [f.status, ''];
      const knappar = ['<button class="btn btn-ghost btn-sm" type="button" data-fakt-underlag="' + esc(f.id) + '">Underlag</button>'];
      if (f.status === 'utkast') {
        knappar.push('<button class="btn btn-primary btn-sm" type="button" data-fakt-fortnox="' + esc(f.id) + '">Lagd i Fortnox</button>');
      } else if (f.status === 'skickad' || f.status === 'forfallen') {
        knappar.push('<button class="btn btn-primary btn-sm" type="button" data-fakt-betald="' + esc(f.id) + '">Betald</button>');
      }
      knappar.push('<button class="btn btn-ghost btn-sm" type="button" data-dp="familj:' + esc(f.parent_id) + '">Öppna familjen</button>');
      const om = [
        'Faktura för ' + NXBetalning.periodText(f.period),
        f.fortnox_fakturanummer ? 'nr ' + f.fortnox_fakturanummer + ' i Fortnox' : null,
        f.forfaller ? 'förfaller ' + kortDatum(f.forfaller) : null
      ].filter(Boolean).join(' · ');
      h += '<div class="man-fam"><div class="man-fam-topp">'
        + '<div class="man-fam-vem"><b>' + esc(namnFör(f.parent_id)) + '</b>'
        + '<span>' + esc(om) + '</span></div>'
        + '<div class="man-fam-tal"><b>' + esc(kronor(f.belopp_ore)) + '</b><span>'
        + esc(passText((f.invoice_lines || []).length) + ' på fakturan') + '</span></div>'
        + '<div class="man-fam-atg">' + knappar.join(' ') + '</div>'
        + '<div class="man-fam-lagen">' + pill(l[0], l[1]) + '</div>'
        + '</div>' + passLista(post) + '</div>';
    });
    return h + '</div>';
  }

  function köpLista() {
    const köp = köpIMånaden();
    if (!köp.length) {
      return tomt('Inga köpta timmar i ' + månadText(), 'Familjerna köper planer och klippkort i studievyn.');
    }
    return '<div class="man-familjer">' + köp.slice()
      .sort((a, b) => String(a.betald_at).localeCompare(String(b.betald_at)))
      .map(k => '<div class="man-fam"><div class="man-fam-topp">'
        + '<div class="man-fam-vem"><b>' + esc(namnFör(k.parent_id)) + '</b>'
        + '<span>' + esc([k.namn, 'köpt ' + kortDatum(isoFor(new Date(k.betald_at))),
            k.giltigt_till ? 'gäller till ' + kortDatum(k.giltigt_till) : null].filter(Boolean).join(' · ')) + '</span></div>'
        + '<div class="man-fam-tal"><b>' + esc(kronor(Number(k.betalt_ore || 0) - Number(k.aterbetald_ore || 0))) + '</b>'
        + '<span>' + esc(k.kvar + ' av ' + k.timmar + ' timmar kvar') + '</span></div>'
        + '<div class="man-fam-atg"><button class="btn btn-ghost btn-sm" type="button" data-dp="familj:'
        + esc(k.parent_id) + '">Öppna familjen</button></div>'
        + (Number(k.aterbetald_ore || 0) > 0 ? '<div class="man-fam-lagen">'
          + pill(kronor(k.aterbetald_ore) + ' tillbaka', '') + '</div>' : '')
        + '</div></div>').join('') + '</div>';
  }

  function ritaDetalj(rader) {
    const topp = $('#man-lista-topp'), host = $('#man-lista'), körning = $('#man-korning');
    if (!topp || !host) return;
    const räknas = rader.filter(x => !x.undantaget);
    const undantagna = rader.length - räknas.length;
    const test = räknas.filter(x => x.läge === 'test').length;

    if (körning) {
      körning.hidden = vy !== 'fakturor';
      if (NXAdmin.rita.sättKörningsperiod) NXAdmin.rita.sättKörningsperiod(körning, valdMånad());
    }

    let rubrik, text, kropp;
    if (vy === 'fakturor') {
      /* Att månaden pågår, eller inte har börjat, säger körningens ruta
         (data-kor-not), likadant på alla tre ställen. */
      rubrik = 'Fakturorna för ' + månadText();
      text = 'Pass där familjen valt faktura. Månadskörningen skapar ett utkast per familj, och det läggs in i Fortnox för hand: '
        + 'Fortnox läser inte in kundfakturor från en fil. Tryck Underlag, skapa fakturan i Fortnox och tryck Lagd i Fortnox med numret, OCR och förfallodagen. '
        + 'Fortnox skickar fakturan och visar när den är betald.';
      kropp = fakturaLista(räknas);
    } else if (vy === 'kopta') {
      rubrik = 'Köpta timmar i ' + månadText();
      text = 'Planer och klippkort som betalades i månaden. Pengarna har kommit in, men timmarna är familjens tills de använts: '
        + 'slutar familjen betalas det som inte använts tillbaka (villkoren).';
      kropp = köpLista();
    } else {
      const v = VYER[vy] || VYER.ejbetalda;
      rubrik = v.rubrik + ' i ' + månadText();
      text = v.text;
      kropp = familjLista(räknas, v);
    }
    topp.innerHTML = '<h5>' + esc(rubrik) + '</h5><p class="xsmall man-lista-text">' + esc(text) + '</p>';
    /* Det som inte räknas in någonstans, så att ett tal som ser lågt
       ut inte behöver utredas: undantagna pass (Ekonomi → Avvikelser)
       och testbetalningar. */
    const utanför = [
      undantagna ? undantagna + (undantagna === 1 ? ' undantaget pass' : ' undantagna pass') : null,
      test ? test + (test === 1 ? ' pass betalt med testkort' : ' pass betalda med testkort') : null
    ].filter(Boolean);
    host.innerHTML = kropp
      + (utanför.length ? '<p class="eko-andra" style="margin-top:14px">Räknas inte in: '
        + esc(utanför.join(' och ')) + '.</p>' : '');
  }

  /* ------------------------------------------------------------
     RITNINGEN
     Allt ur det som redan är hämtat; ingenting här frågar databasen.
     Ekonomi ritar om sidan genom rita när något ändrats där.
     ------------------------------------------------------------ */
  function ritaMånaden() {
    if (!$('#man-tal')) return;
    starta();
    laddaKatalogen();
    if (MV) MV.märk();
    const rader = månadensPass();
    ritaTal(rader);
    ritaDetalj(rader);
  }

  document.addEventListener('click', e => {
    /* Lönerna öppnas med samma månad vald. Länken går dit själv. */
    if (e.target.closest('[data-man-loner]')) {
      if (typeof NXAdmin.rita.visaLönemånad === 'function') NXAdmin.rita.visaLönemånad(valdMånad());
      return;
    }
    const k = e.target.closest('[data-man-vy]');
    if (!k) return;
    vy = k.dataset.manVy;
    /* Talen står kvar där de står (bara aria-pressed byts), och det som
       ändrar höjd ligger under dem. Hålls ändå, för en telefon. */
    NXStudie.håll(k, () => {
      Array.prototype.forEach.call(document.querySelectorAll('[data-man-vy]'), t => {
        t.setAttribute('aria-pressed', String(t.dataset.manVy === vy));
      });
      ritaDetalj(månadensPass());
    });
  });

  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, {
    ritaMånaden
  });
})();
