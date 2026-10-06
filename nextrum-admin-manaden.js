/* ============================================================
   NEXTRUM — adminvyn, Månadens ekonomi: hur månadens pass är betalda,
   vad som väntar och hos vem, och om pengarna räcker till det som ska
   ut

   Leo 2026-09-28: "gör en till ekonomi avdelning för månaden ... där
   ska man aktuellt se hur många fakturor som ska skickas samt så många
   lektioner som är betalda för. hur många timmar är betalt samt ej
   ännu betalt ... när man klickar på siffrorna ska man få upp vilka
   familjer som det handlar om ... detta för att ej ha problem om
   kassalikviditet". Och 2026-09-29: "månadens ekonomi måste du göra
   mycket bättre också och funktionell".

   Betalningar (nextrum-admin-ekonomi.js) är betalningarna en och en,
   och det som väntar på er. Den här sidan är månaden i stort:

   LÄGET. Hur många av månadens timmar som är betalda, som en mätare i
   en färg. Delarna står i talen under, så mätaren behöver ingen
   förklaring i färg.

   TALEN. Betalda, hållna men inte betalda, kommande och fakturor att
   skicka. De tre första är knappar som visar familjerna bakom talet;
   fakturornas leder till fakturorna längre ner.

   PENGARNA. Det som kommit in, det som väntar och det som går ut
   (lönerna den 25:e och det som ska tillbaka till familjer), och vad
   som blir kvar, i dag och när det som väntar har kommit in. Det är
   svaret på frågan om kassan räcker. Förut stod lönen och de köpta
   timmarna som två tal bland åtta, och ingenting räknade ihop dem.

   FAMILJERNA. En rad per familj med det som väntar, Påminn på raden och
   passen och betalningarna under, med samma knappar som i Betalningar.

   SAMMA RADER SOM BETALNINGAR. Pengarna, passen och timmarna räknas på
   betalningsrader() i Betalningar, för den här sidans månad. Förut
   räknade sidan på sitt eget sätt, och samma månad hade två belopp på
   två sidor: tillägget för övertid och ett avbokat pass som betalats
   stod bara i Betalningar. Ett tal här och ett där kan därför stämmas
   av mot varandra, och länken till Alla betalningar öppnar samma månad.

   INGET NYTT I DATABASEN. Allt räknas ur det adminvyn redan hämtat.
   Lönen är Löners egen räkning (lönFörMånad): underlaget för passens
   månad, som betalas ut den 25:e månaden efter.

   FAKTURORNA skapas här med månadskörningen, samma körning som under
   Betalningar → Fakturor och Löner, och knapparna på varje faktura är
   desamma (data-fakt-*): lyssnarna bor i nextrum-admin-ekonomi.js.
   Fortnox läser inte in kundfakturor från en fil, så fakturan läggs in
   där för hand med Underlag, och numret skrivs tillbaka med Lagd i
   Fortnox.
   ============================================================ */
(function () {
  'use strict';

  const { $, esc, isoFor } = NX;
  const { tomt } = NXStudie;
  const kronor = NXBetalning.kronor;
  const tim = m => NXBetalning.timmar(m);
  const { S, kortDatum, namnFör, pill } = NXAdmin;

  /* ------------------------------------------------------------
     MÅNADEN
     En egen väljare, som Betalningar och Löner har sina: sidorna läses
     var för sig, och en månad vald här ska inte flytta de andra.
     ------------------------------------------------------------ */
  let MV = null;
  /* Familjerna som visas: alla, eller de bakom ett av talen. Står kvar
     när månaden byts. */
  let filter = 'alla';

  function starta() {
    if (MV) return;
    const host = $('#man-manader');
    if (!host) return;
    MV = NXStudie.månadsval(host, {
      alla: true,
      årFramåt: 1,
      märke: m => S.stangdaManader && S.stangdaManader.has(m) ? 'Stängd' : '',
      vidVal: () => ritaMånaden()
    });
  }

  const valdMånad = () => { starta(); return MV ? MV.vald() : NXStudie.månadIso(new Date()); };
  const månadText = () => NXStudie.månadsNamn(valdMånad());
  const månadNamn = () => NXStudie.månadsNamn(valdMånad(), false);
  const stor = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);

  /* Katalogen är reserven för pass som bokades innan priset började
     frysas (Fas 19.5). Den laddas en gång; tills den finns står ett
     sådant pass utan belopp, och sidan ritas om när den kommer. */
  let katalogen = null;
  function laddaKatalogen() {
    if (katalogen || typeof NXTjanster === 'undefined') return;
    katalogen = NXTjanster.ladda().then(() => ritaMånaden(), () => {});
  }

  /* ------------------------------------------------------------
     RADERNA
     En rad per pass, tillägg och köp av timmar i månaden, med läge och
     belopp: in, attFåIn, kommande, attÅterbetala. Ett pass räknas
     (räknas) när det är bekräftat eller genomfört, inte undantaget och
     inte betalt med testkort.
     ------------------------------------------------------------ */
  function raderna() {
    const f = NXAdmin.rita.betalningsrader;
    return typeof f === 'function' ? f(valdMånad()) : [];
  }

  const summa = (lista, fält) => lista.reduce((n, r) => n + Number(r[fält] || 0), 0);
  const ärPass = r => r.typ === 'pass' && r.räknas;
  /* Betalt med kort, mot en betald faktura, med köpta timmar eller ur
     timbanken. Ett pass i tvist är betalt tills tvisten avgjorts: det
     står i Betalningar → Att göra. */
  const ärBetalt = r => ärPass(r) && (r.filter.has('betalda') || r.filter.has('tvist'));
  const ärObetalt = r => ärPass(r) && r.filter.has('attbetala');
  const ärKommande = r => ärPass(r) && r.filter.has('kommande');
  const medTimmar = r => r.sätt === 'Köpta timmar' || r.sätt === 'Timbanken';
  const utanPris = r => r.belopp == null && r.beloppText == null;

  function passen(rader) {
    const pass = rader.filter(ärPass);
    const del = lista => ({ rader: lista, pass: lista.length, min: summa(lista, 'min') });
    const betalda = del(pass.filter(ärBetalt));
    const obetalda = del(pass.filter(ärObetalt));
    const kommande = del(pass.filter(ärKommande));
    return {
      alla: del(pass), betalda, obetalda, kommande,
      /* Första timmen bjuden, återbetalt, en makulerad faktura. */
      övriga: del(pass.filter(r => !ärBetalt(r) && !ärObetalt(r) && !ärKommande(r))),
      medTimmar: betalda.rader.filter(medTimmar).length,
      obetaltÖre: summa(obetalda.rader, 'attFåIn'),
      kommandeÖre: summa(kommande.rader, 'kommande'),
      utanPris: obetalda.rader.concat(kommande.rader).filter(utanPris).length
    };
  }

  /* Fakturorna för månadens pass. Att skapa är familjer vars hållna
     fakturapass inte står på någon faktura än; resten är fakturorna de
     står på. En faktura per familj och period, så det är familjer och
     fakturor som räknas, inte pass. */
  function fakturorna(rader) {
    const påFaktura = new Map();
    (S.fakturor || []).forEach(f => (f.invoice_lines || []).forEach(l => {
      if (l.booking_id) påFaktura.set(l.booking_id, f);
    }));
    const attSkapa = new Map();
    const fakturor = new Map();
    rader.filter(r => ärPass(r) && r.sätt === 'Faktura').forEach(r => {
      const f = påFaktura.get(r.booking);
      if (f) { fakturor.set(f.id, f); return; }
      if (!r.filter.has('attbetala')) return;
      const post = attSkapa.get(r.parent) || { id: r.parent, pass: 0, öre: 0, utanPris: 0, sista: '' };
      post.pass++;
      if (utanPris(r)) post.utanPris++; else post.öre += r.attFåIn;
      if (String(r.datum) > post.sista) post.sista = String(r.datum);
      attSkapa.set(r.parent, post);
    });
    const ORDNING = { utkast: 0, forfallen: 1, skickad: 2, betald: 3, makulerad: 4 };
    const lista = Array.from(fakturor.values())
      .map(f => ({ f, läge: NXBetalning.fakturaLage(f), familj: namnFör(f.parent_id) }))
      .sort((a, b) => ((ORDNING[a.läge] == null ? 9 : ORDNING[a.läge]) - (ORDNING[b.läge] == null ? 9 : ORDNING[b.läge]))
        || a.familj.localeCompare(b.familj, 'sv'));
    return {
      attSkapa: Array.from(attSkapa.values()).sort((a, b) => namnFör(a.id).localeCompare(namnFör(b.id), 'sv')),
      fakturor: lista,
      utkast: lista.filter(x => x.läge === 'utkast').length,
      förfallna: lista.filter(x => x.läge === 'forfallen').length
    };
  }

  /* ------------------------------------------------------------
     PENGARNA
     Kommit in är samma tal som Inbetalt under Betalningar, för samma
     månad. Stripes avgift dras först i Kvar, som Betalningar säger den
     bredvid summan i stället för att dra den.
     ------------------------------------------------------------ */
  function pengarna(rader) {
    const s = (villkor, fält) => summa(rader.filter(villkor), fält);
    const kort = r => r.typ === 'pass' && r.sätt !== 'Faktura';
    const faktura = r => r.typ === 'pass' && r.sätt === 'Faktura';
    const ejSkickad = r => faktura(r) && (r.fakturaläge === 'saknas' || r.fakturaläge === 'utkast');
    const skickad = r => faktura(r) && (r.fakturaläge === 'skickad' || r.fakturaläge === 'forfallen');
    const tillägg = r => r.typ === 'tillagg';
    const köp = r => r.typ === 'kop';
    const alla = () => true;
    const lön = typeof NXAdmin.rita.lönFörMånad === 'function' ? NXAdmin.rita.lönFörMånad(valdMånad()) : null;

    const p = {
      in: {
        kort: s(kort, 'in'), faktura: s(faktura, 'in'), tillägg: s(tillägg, 'in'), köp: s(köp, 'in'),
        oanvänt: s(köp, 'oanvänt'), avgift: s(alla, 'avgift')
      },
      väntar: {
        kort: s(kort, 'attFåIn'), attFakturera: s(ejSkickad, 'attFåIn'), fakturerat: s(skickad, 'attFåIn'),
        förfallet: s(r => faktura(r) && r.fakturaläge === 'forfallen', 'attFåIn'),
        tillägg: s(tillägg, 'attFåIn'), kommande: s(alla, 'kommande'),
        utanPris: rader.filter(r => (r.filter.has('attbetala') || r.filter.has('kommande')) && utanPris(r)).length
      },
      ut: { lön, tillbaka: s(alla, 'attÅterbetala') }
    };
    p.in.summa = p.in.kort + p.in.faktura + p.in.tillägg + p.in.köp;
    p.väntar.summa = p.väntar.kort + p.väntar.attFakturera + p.väntar.fakturerat + p.väntar.tillägg + p.väntar.kommande;
    p.ut.summa = (lön ? lön.öre : 0) + p.ut.tillbaka;
    p.kvarNu = p.in.summa - p.in.avgift - p.ut.summa;
    p.kvarSen = p.kvarNu + p.väntar.summa;
    return p;
  }

  /* ------------------------------------------------------------
     FAMILJERNA
     ------------------------------------------------------------ */
  function familjerna(rader) {
    const per = new Map();
    rader.forEach(r => {
      const id = r.parent || '';
      let f = per.get(id);
      if (!f) {
        f = {
          id, rader: [], pass: 0, min: 0, betalda: 0, timmarMin: 0, obetalda: 0, kommande: 0, faktura: {}, köp: [],
          in: 0, attFåIn: 0, kommandeÖre: 0, attÅterbetala: 0, köpt: 0,
          tilläggObetalt: 0, tvist: 0, utanPris: 0, påminn: '', sök: namnFör(id)
        };
        per.set(id, f);
      }
      f.rader.push(r);
      f.in += r.in;
      f.attFåIn += r.attFåIn;
      f.kommandeÖre += r.kommande;
      f.attÅterbetala += r.attÅterbetala;
      f.sök += ' ' + r.sök;
      if (r.påminn && !f.påminn) f.påminn = r.påminn;
      if (r.filter.has('tvist')) f.tvist++;
      if (r.typ === 'kop' && !r.test) { f.köp.push(r); f.köpt += r.in; }
      if (r.typ === 'tillagg' && r.filter.has('attbetala')) f.tilläggObetalt++;
      if (!ärPass(r)) return;
      f.pass++;
      f.min += r.min;
      if (ärBetalt(r)) {
        f.betalda++;
        if (medTimmar(r)) f.timmarMin += r.min;
      } else if (ärObetalt(r)) {
        if (r.sätt === 'Faktura') f.faktura[r.fakturaläge] = (f.faktura[r.fakturaläge] || 0) + 1;
        else f.obetalda++;
        if (utanPris(r)) f.utanPris++;
      } else if (ärKommande(r)) f.kommande++;
    });
    return Array.from(per.values());
  }

  const FILTER = [
    ['alla', 'Alla'], ['attbetala', 'Inte betalda'], ['kommande', 'Kommande'], ['betalda', 'Betalda'],
    ['tillbaka', 'Ska ha tillbaka'], ['kop', 'Köpte timmar']
  ];
  const iFilter = (f, k) => k === 'alla'
    || (k === 'attbetala' && f.attFåIn + f.obetalda + f.tilläggObetalt + Object.keys(f.faktura).length > 0)
    || (k === 'kommande' && f.kommande > 0)
    || (k === 'betalda' && f.betalda > 0)
    || (k === 'tillbaka' && f.attÅterbetala > 0)
    || (k === 'kop' && f.köp.length > 0);

  /* Beloppet till höger: det talet familjen står under. Under Alla det
     som är viktigast för just den familjen, med vad det är under. Pass
     betalda med köpta timmar är inga pengar i månaden (de kom när
     timmarna köptes), så de står som timmar, inte som noll kronor. */
  function familjensBelopp(f) {
    const kr = (öre, vad) => ({ text: kronor(öre), vad, värde: öre });
    if (filter === 'kommande') return kr(f.kommandeÖre, 'kommande');
    if (filter === 'betalda') {
      const pengar = f.in - f.köpt;
      if (!pengar && f.timmarMin) return { text: tim(f.timmarMin), vad: 'med köpta timmar', värde: 0 };
      return kr(pengar, f.timmarMin ? 'betalt, och ' + tim(f.timmarMin) + ' med timmar' : 'betalt för passen');
    }
    if (filter === 'tillbaka') return kr(f.attÅterbetala, 'ska tillbaka');
    if (filter === 'kop') return kr(f.köpt, 'köpta timmar');
    if (f.attFåIn > 0) return kr(f.attFåIn, 'att få in');
    if (f.attÅterbetala > 0) return kr(f.attÅterbetala, 'ska tillbaka');
    if (f.kommandeÖre > 0) return kr(f.kommandeÖre, 'kommande');
    if (!f.in && f.timmarMin) return { text: tim(f.timmarMin), vad: 'med köpta timmar', värde: 0 };
    return kr(f.in, f.in ? 'har kommit in' : '');
  }

  const plural = (n, en, flera) => n + ' ' + (n === 1 ? en : flera);

  /* Lägena som märken, det som väntar på er först. Samma färger som
     resten av Betalningar: lera är ert drag, ockra väntar på någon
     annan, mossa är klart. */
  function märken(f, slut) {
    const m = [];
    if (f.tvist) m.push(pill('Tvist', 'ar-ny'));
    if (f.obetalda) m.push(pill(plural(f.obetalda, 'pass inte betalt', 'pass inte betalda'), 'ar-ny'));
    if (f.tilläggObetalt) m.push(pill('Tillägg inte betalt', 'ar-ny'));
    if (f.faktura.forfallen) m.push(pill('Fakturan har förfallit', 'ar-ny'));
    if (f.attÅterbetala > 0) m.push(pill(kronor(f.attÅterbetala) + ' ska tillbaka', 'ar-ny'));
    const attFakturera = (f.faktura.saknas || 0) + (f.faktura.utkast || 0);
    if (attFakturera) m.push(pill(plural(attFakturera, 'pass ska faktureras', 'pass ska faktureras'), slut ? 'ar-ny' : 'ar-vantar'));
    if (f.faktura.skickad) m.push(pill(plural(f.faktura.skickad, 'pass fakturerat', 'pass fakturerade'), 'ar-vantar'));
    if (f.kommande) m.push(pill(plural(f.kommande, 'kommande', 'kommande'), ''));
    if (f.betalda) m.push(pill(plural(f.betalda, 'betalt', 'betalda'), 'ar-klar'));
    return m.join('');
  }

  function familjRad(f, slut) {
    const namn = f.id ? namnFör(f.id) : 'Utan familj';
    const belopp = familjensBelopp(f);
    const meta = [];
    if (f.pass) meta.push(esc(plural(f.pass, 'pass', 'pass') + ' · ' + tim(f.min)));
    f.köp.forEach(k => meta.push(esc('köpte ' + k.titel + ' ' + kortDatum(k.datum))));
    if (f.utanPris) meta.push(esc(plural(f.utanPris, 'pass utan pris', 'pass utan pris')));
    const rader = f.rader.slice().sort((a, b) => (String(a.datum) + (a.tid || '')).localeCompare(String(b.datum) + (b.tid || '')));
    const betRad = NXAdmin.rita.betRad;
    return '<div class="man-fam">'
      + '<div class="man-fam-rad">'
      + (typeof NXMedia !== 'undefined' ? NXMedia.avatar(namn, null, { liten: true }) : '')
      + '<span class="eko-mitt">'
      + (f.id ? '<button type="button" class="eko-titel" data-dp="familj:' + esc(f.id) + '">' + esc(namn) + '</button>'
        : '<span class="eko-titel">' + esc(namn) + '</span>')
      + (meta.length ? '<span class="eko-meta">' + meta.map(x => '<span>' + x + '</span>').join('') + '</span>' : '')
      + '</span>'
      + '<span class="man-fam-lagen">' + märken(f, slut) + '</span>'
      + '<span class="eko-atg">' + (f.påminn || '') + '</span>'
      + '<span class="eko-belopp"><b>' + esc(belopp.text) + '</b>' + (belopp.vad ? '<small>' + esc(belopp.vad) + '</small>' : '') + '</span>'
      + '</div>'
      + (typeof betRad === 'function' ? '<details class="man-fam-pass"><summary>'
        + esc(rader.length === 1 ? 'Visa betalningen' : 'Visa de ' + rader.length + ' betalningarna') + '</summary>'
        + '<div class="man-fam-rader">' + rader.map(r => betRad(r, { utanFamilj: true, utanPåminn: true })).join('') + '</div>'
        + '</details>' : '')
      + '</div>';
  }

  /* Sorteringen: det som väntar på er först, sedan det största beloppet
     för talet familjerna står under, sedan namnet. */
  function ordning(a, b) {
    const vikt = f => filter !== 'alla' ? 0
      : (f.attFåIn > 0 || f.obetalda || f.tilläggObetalt || f.tvist) ? 0 : f.attÅterbetala > 0 ? 1 : f.kommande ? 2 : 3;
    return (vikt(a) - vikt(b)) || (familjensBelopp(b).värde - familjensBelopp(a).värde)
      || (b.timmarMin - a.timmarMin) || namnFör(a.id).localeCompare(namnFör(b.id), 'sv');
  }

  /* ------------------------------------------------------------
     RITNINGEN
     ------------------------------------------------------------ */
  function månadensLäge() {
    const m = valdMånad();
    const g = NXStudie.månadsGräns(m);
    const idag = isoFor(new Date());
    if (S.stangdaManader && S.stangdaManader.has(m)) return { text: 'Stängd', klass: 'ar-klar', slut: true };
    if (idag >= g.till) return { text: 'Avslutad', klass: '', slut: true };
    if (idag < g.från) return { text: 'Har inte börjat', klass: '', slut: false };
    const kvar = Math.round((Date.parse(g.till) - Date.parse(idag)) / 864e5);
    return { text: 'Pågår · ' + (kvar === 1 ? 'sista dagen' : kvar + ' dagar kvar'), klass: 'ar-vantar', slut: false };
  }

  function ritaLäget(p, läge) {
    const host = $('#man-lage');
    if (!host) return;
    /* Nedåt: 99,6 procent är inte allt, och mätaren ska inte säga det. */
    const andel = p.alla.min ? Math.floor(100 * p.betalda.min / p.alla.min) : 0;
    const mening = p.alla.pass
      ? '<b>' + esc(tim(p.betalda.min)) + '</b> av ' + esc(tim(p.alla.min)) + ' är betalda'
      : 'Inga pass i ' + esc(månadNamn()) + ' än';
    const not = [
      plural(p.alla.pass, 'pass bekräftat eller hållet', 'pass bekräftade eller hållna'),
      p.övriga.pass ? tim(p.övriga.min) + ' utan betalning: första timmen bjuden, återbetalt eller en makulerad faktura' : null
    ].filter(Boolean).join(' · ');
    host.innerHTML = '<div class="vy-kort-kropp">'
      + '<div class="man-lage-topp"><h3>' + esc(stor(månadText())) + '</h3>' + pill(läge.text, läge.klass) + '</div>'
      + '<p class="man-lage-mening">' + mening + '</p>'
      + '<div class="man-matare-rad"><span class="man-matare" role="img" aria-label="'
      + esc(andel + ' procent av månadens timmar är betalda') + '"><i style="width:' + andel + '%"></i></span>'
      + '<b>' + andel + ' %</b></div>'
      + (p.alla.pass ? '<p class="man-lage-not">' + esc(not) + '</p>' : '')
      + '</div>';
  }

  /* Ett tal är en knapp. De tre första visar familjerna bakom talet;
     fakturornas leder till fakturorna. Trycket ändrar ingen höjd, bara
     kanten (fälla 4), och sidan läggs vid listan. */
  function tavla(o) {
    const attr = o.till ? ' data-man-till="' + o.till + '"'
      : ' data-man-filter="' + o.filter + '" aria-pressed="' + (filter === o.filter) + '" aria-controls="man-lista"';
    return '<button type="button" class="man-tal' + (o.gör ? ' ar-gor' : '') + '"' + attr + '>'
      + '<small>' + esc(o.rubrik) + '</small><b>' + esc(o.tal) + '</b><span>' + esc(o.under) + '</span></button>';
  }

  function ritaTalen(p, fakt, läge) {
    const host = $('#man-tal');
    if (!host) return;
    const utan = p.utanPris ? ' · ' + plural(p.utanPris, 'pass utan pris', 'pass utan pris') : '';
    const attGöra = fakt.utkast + (läge.slut ? fakt.attSkapa.length : 0);
    host.innerHTML =
      tavla({ filter: 'betalda', rubrik: 'Betalda', tal: plural(p.betalda.pass, 'pass', 'pass'),
        under: tim(p.betalda.min) + (p.medTimmar ? ' · ' + p.medTimmar + ' med köpta timmar' : '') })
      + tavla({ filter: 'attbetala', rubrik: 'Hållna, inte betalda', tal: plural(p.obetalda.pass, 'pass', 'pass'),
        under: p.obetalda.pass ? tim(p.obetalda.min) + ' · ' + kronor(p.obetaltÖre) + utan : 'inget som väntar',
        gör: p.obetalda.pass > 0 })
      + tavla({ filter: 'kommande', rubrik: 'Kommande, inte betalda', tal: plural(p.kommande.pass, 'pass', 'pass'),
        under: p.kommande.pass ? tim(p.kommande.min) + ' · ' + kronor(p.kommandeÖre) : 'inga obetalda framåt' })
      + tavla({ till: 'man-fakturor', rubrik: fakt.attSkapa.length + fakt.utkast === 1 ? 'Faktura att skicka' : 'Fakturor att skicka',
        tal: String(fakt.attSkapa.length + fakt.utkast),
        under: fakt.attSkapa.length + fakt.utkast === 0 ? 'inga som väntar'
          : [fakt.attSkapa.length ? fakt.attSkapa.length + (läge.slut ? ' utan utkast än' : ' samlas till månadens slut') : null,
             fakt.utkast ? fakt.utkast + ' att lägga in i Fortnox' : null].filter(Boolean).join(' · '),
        gör: attGöra > 0 });
  }

  /* En kolumn i pengarna: rubriken, summan och posterna under. En post
     på noll kronor står inte med, utom de som alltid ska synas. */
  function kolumn(rubrik, summaÖre, poster, not) {
    const rader = poster.filter(x => x.alltid || x.öre).map(x => '<div>'
      + '<dt>' + x.text + (x.under ? '<small>' + x.under + '</small>' : '') + '</dt>'
      + '<dd>' + esc(kronor(x.öre)) + '</dd></div>').join('');
    return '<div class="man-kol">'
      + '<h4>' + esc(rubrik) + '</h4><b class="man-summa">' + esc(kronor(summaÖre)) + '</b>'
      + (rader ? '<dl>' + rader + '</dl>' : '<p class="man-kol-tom">Inget än.</p>')
      + (not ? '<p class="man-kol-not">' + not + '</p>' : '')
      + '</div>';
  }

  function ritaPengarna(p) {
    const host = $('#man-pengar');
    if (!host) return;
    const g = NXStudie.månadsGräns(valdMånad());
    const lönedag = '25 ' + NXStudie.månadsNamn(g.till, false);
    const lön = p.ut.lön;

    const inNot = [
      p.in.avgift ? 'Stripe tog ' + esc(kronor(p.in.avgift)) + ' i avgift.' : '',
      p.in.oanvänt ? esc(kronor(p.in.oanvänt)) + ' av de köpta timmarna är inte använda än och är familjernas tills de används.' : ''
    ].filter(Boolean).join(' ');
    const väntarNot = [
      p.väntar.förfallet ? '<b>' + esc(kronor(p.väntar.förfallet)) + ' är på fakturor som har förfallit.</b>' : '',
      p.väntar.utanPris ? esc(plural(p.väntar.utanPris, 'pass saknar', 'pass saknar')) + ' pris och räknas inte in.' : ''
    ].filter(Boolean).join(' ');
    /* Lönedagen är den 25:e månaden efter passen. Har den passerat utan
       att underlagen markerats som utbetalda säger kolumnen det: en lön
       som inte gått ut är ett löfte till en studiehjälpare. */
    const passerad = isoFor(new Date()) > g.till.slice(0, 8) + '25';
    const inteUtbetalt = lön && !lön.utbetald ? lön.öre - Number(lön.utbetaltÖre || 0) : 0;
    const lönText = 'Löner den ' + lönedag;
    const lönUnder = !lön ? 'räknas under Löner' : [
      lön.utbetald ? 'utbetalda'
        : lön.beräknat ? 'beräknat, underlaget är inte skapat'
        : lön.utbetaltÖre ? kronor(lön.utbetaltÖre) + ' utbetalt' : null,
      lön.min ? tim(lön.min) : null
    ].filter(Boolean).join(' · ');
    const utNot = [
      passerad && inteUtbetalt > 0 ? '<b>Lönedagen har passerat och ' + esc(kronor(inteUtbetalt))
        + ' är inte markerat som utbetalt.</b>' : '',
      lön && lön.utanTimpenning ? '<b>' + esc(plural(lön.utanTimpenning, 'pass saknar', 'pass saknar'))
        + ' timpenning och räknas inte in i lönen.</b>' : '',
      '<a class="eko-lank" href="#loner" data-man-loner>Lönerna under Löner</a>'
    ].filter(Boolean).join(' ');

    const kvar = (rubrik, öre, text) => '<div class="man-kvar-del' + (öre < 0 ? ' ar-gor' : '') + '">'
      + '<small>' + esc(rubrik) + '</small><b>' + esc(kronor(öre)) + '</b><span>' + esc(text) + '</span></div>';

    host.innerHTML = '<div class="vy-kort man-pengar"><div class="vy-kort-kropp">'
      + '<div class="man-kolumner">'
      + kolumn('Kommit in', p.in.summa, [
          { text: 'Kort för passen', öre: p.in.kort, alltid: true },
          { text: 'Betalda fakturor', öre: p.in.faktura },
          { text: 'Tillägg för övertid', öre: p.in.tillägg },
          { text: 'Köpta timmar', öre: p.in.köp, under: 'betalda i ' + esc(månadNamn()) }
        ], inNot)
      + kolumn('Väntar', p.väntar.summa, [
          { text: 'Hållna pass, inte betalda', öre: p.väntar.kort, alltid: true },
          { text: 'Ska faktureras', öre: p.väntar.attFakturera },
          { text: 'Fakturerat, inte betalt', öre: p.väntar.fakturerat },
          { text: 'Tillägg för övertid', öre: p.väntar.tillägg },
          { text: 'Kommande pass', öre: p.väntar.kommande, alltid: true }
        ], väntarNot)
      + kolumn('Går ut', p.ut.summa, [
          { text: esc(lönText), öre: lön ? lön.öre : 0, under: esc(lönUnder), alltid: true },
          { text: 'Tillbaka till familjer', öre: p.ut.tillbaka }
        ], utNot)
      + '</div>'
      + '<div class="man-kvar">'
      + kvar('Kvar i dag', p.kvarNu, 'det som kommit in, efter Stripes avgift, minus det som går ut')
      + kvar('När det som väntar har kommit in', p.kvarSen, 'om allt som väntar betalas')
      + '</div>'
      + '</div></div>'
      + '<p class="vy-finstilt">Lönen är underlaget, med semesterersättning (den ingår i timpenningen) men utan arbetsgivaravgifter. '
      + 'Andra kostnader står inte här. Samma belopp som '
      + '<a class="eko-lank" href="#ekonomi/betalningar" data-man-betalningar>Alla betalningar i ' + esc(månadNamn()) + '</a>.</p>';
  }

  function ritaFamiljerna(rader, läge) {
    const host = $('#man-lista');
    if (!host) return;
    /* En reserv från ett chip gäller inte en ny månad (hållLista). */
    NXStudie.släppLista(host);
    const alla = familjerna(rader);
    const räkna = {};
    FILTER.forEach(([k]) => { räkna[k] = alla.filter(f => iFilter(f, k)).length; });
    const antal = $('#man-familjer-antal');
    if (antal) antal.textContent = String(alla.length);

    /* Ett filter utan familjer göms, utom det som är valt: annars hade
       raden bytt form under fingret när den sista försvann. */
    const chips = $('#man-chips');
    if (chips) {
      chips.innerHTML = FILTER.filter(([k]) => k === 'alla' || k === filter || räkna[k] > 0)
        .map(([k, t]) => '<button type="button" class="chip" data-man-filter="' + k + '" aria-pressed="'
          + (k === filter) + '">' + esc(t) + ' <span class="eko-chip-tal">' + (räkna[k] || 0) + '</span></button>')
        .join('');
    }

    const sök = String(($('#man-sok') || {}).value || '').trim().toLowerCase();
    const visa = alla.filter(f => iFilter(f, filter) && (!sök || f.sök.toLowerCase().indexOf(sök) !== -1)).sort(ordning);
    if (!visa.length) {
      host.innerHTML = !alla.length
        ? tomt('Inga betalningar i ' + månadText(), 'Pass som bokas och timmar som köps i månaden står här, per familj.')
        : sök ? tomt('Ingen familj matchar', 'Sök på familjens, elevens eller studiehjälparens namn.')
        : tomt('Ingen familj här i ' + månadText(), 'Talet är noll. Tryck Alla för att se alla familjer i månaden.');
      return;
    }
    host.innerHTML = visa.map(f => familjRad(f, läge.slut)).join('');
  }

  /* Fakturorna (omgjord 2026-10-06): en rad per familj och faktura,
     samma rad som under Betalningar → Fakturor (familjefakturaRad), och
     familjens namn fäller ut passen med dag, klocka och studiehjälpare.
     Under månaden samlas fakturan på raden, och natten mot den 1:a blir
     den ett utkast av sig själv. Med står fakturor som bär ett av
     månadens pass, och månadens egna. Förut var det fakturapass utan
     faktura en rad och fakturan de hamnade på en annan, och körningen
     skulle torrköras här under. */
  const FAKT_ORDNING = { utkast: 0, skapas: 0, forfallen: 1, samlas: 2, rapport: 3, skickad: 4, betald: 5, makulerad: 6 };
  function ritaFakturorna() {
    const host = $('#man-fakt-lista');
    if (!host) return;
    const m = valdMånad();
    const g = NXStudie.månadsGräns(m);
    const iMånaden = d => { const s = String(d || '').slice(0, 10); return s >= g.från && s < g.till; };
    const rad = NXAdmin.rita.familjefakturaRad;
    const alla = typeof NXAdmin.rita.familjefakturor === 'function' ? NXAdmin.rita.familjefakturor() : [];
    const lista = alla.filter(x => x.period === m || x.pass.some(p => iMånaden(p.datum)))
      .sort((a, b) => ((FAKT_ORDNING[a.läge] == null ? 9 : FAKT_ORDNING[a.läge]) - (FAKT_ORDNING[b.läge] == null ? 9 : FAKT_ORDNING[b.läge]))
        || a.familj.localeCompare(b.familj, 'sv'));
    const antal = $('#man-fakturor-antal');
    if (antal) {
      antal.textContent = String(lista.length);
      antal.classList.toggle('ar-gor', lista.some(x => x.läge === 'utkast' || x.läge === 'skapas' || x.läge === 'forfallen'));
    }
    host.innerHTML = lista.length && typeof rad === 'function' ? lista.map(x => rad(x)).join('')
      : tomt('Inga fakturapass i ' + månadText(),
        'Familjen väljer faktura när de bekräftar rapporten. Passen samlas på en faktura per familj, som blir ett utkast när månaden är slut.');

    const körning = $('#man-korning');
    if (körning && NXAdmin.rita.sättKörningsperiod) NXAdmin.rita.sättKörningsperiod(körning, valdMånad());
    const rubrik = $('#man-korning-rubrik');
    if (rubrik) rubrik.textContent = 'Månadskörningen för ' + månadNamn() + ', för hand';
  }

  /* Det som inte räknas in någonstans, så att ett tal som ser lågt ut
     inte behöver utredas: undantagna pass och testbetalningar. */
  function ritaFoten(rader) {
    const host = $('#man-fot');
    if (!host) return;
    const undantagna = rader.filter(r => r.typ === 'pass' && r.filter.has('undantagna')).length;
    const test = rader.filter(r => r.test).length;
    const utanför = [
      undantagna ? plural(undantagna, 'undantaget pass', 'undantagna pass') : null,
      test ? plural(test, 'testbetalning', 'testbetalningar') : null
    ].filter(Boolean);
    host.textContent = 'Passen räknas på passets datum och köpta timmar på dagen de betalades.'
      + (utanför.length ? ' Räknas inte in: ' + utanför.join(' och ') + '.' : '');
  }

  /* LISTAN STÅR STILLA. Ett chip eller söket kan göra listan mycket
     kortare, och chippet flyttade sig då upp till 588 px under fingret
     (NXStudie.hållLista). Ankaret är chipraden och sökfältet, inte
     chippet: chippen ritas om. */
  function ritaListanStilla(ankare) {
    NXStudie.hållLista($('#man-lista'), ankare, () => ritaFamiljerna(raderna(), månadensLäge()));
  }

  /* Allt ur det som redan är hämtat; ingenting här frågar databasen.
     Betalningar ritar om sidan (ritaMånadsvyerna) när något ändrats där:
     en återbetalning, en körning, ett undantag. */
  function ritaMånaden() {
    if (!$('#man-lage')) return;
    starta();
    laddaKatalogen();
    if (MV) MV.märk();
    const rader = raderna();
    const läge = månadensLäge();
    const p = passen(rader);
    const fakt = fakturorna(rader);
    ritaLäget(p, läge);
    ritaTalen(p, fakt, läge);
    ritaPengarna(pengarna(rader));
    ritaFamiljerna(rader, läge);
    ritaFakturorna();
    ritaFoten(rader);
  }

  /* Står listan redan i bild läggs den inte om: då hade sidan hoppat
     för ett tryck som bara bytte filter. */
  function tillListan(el) {
    if (!el) return;
    const topp = el.getBoundingClientRect().top;
    if (topp < 60 || topp > window.innerHeight * 0.55) NXStudie.visaÖverst(el);
  }

  document.addEventListener('click', e => {
    /* Lönerna väljer utbetalningsmånaden, och lönen för månadens pass
       betalas månaden efter: september här öppnar oktober där. Länken
       går dit själv. */
    if (e.target.closest('[data-man-loner]')) {
      if (typeof NXAdmin.rita.visaLönemånad === 'function') {
        NXAdmin.rita.visaLönemånad(NXStudie.månadsGräns(valdMånad()).till);
      }
      return;
    }
    if (e.target.closest('[data-man-betalningar]')) {
      if (typeof NXAdmin.rita.visaBetalningsmånad === 'function') NXAdmin.rita.visaBetalningsmånad(valdMånad());
      return;
    }
    const till = e.target.closest('[data-man-till]');
    if (till) { NXStudie.visaÖverst(document.getElementById(till.dataset.manTill)); return; }

    const k = e.target.closest('[data-man-filter]');
    if (!k) return;
    filter = k.dataset.manFilter;
    /* Talen står kvar där de står (bara aria-pressed byts). Ett tryck på
       ett tal lägger sidan vid listan; ett tryck på ett chip håller
       chipraden still, för listan under byter höjd (fälla 4). */
    Array.prototype.forEach.call(document.querySelectorAll('#man-tal [data-man-filter]'), t => {
      t.setAttribute('aria-pressed', String(t.dataset.manFilter === filter));
    });
    if (k.closest('#man-tal')) {
      ritaFamiljerna(raderna(), månadensLäge());
      tillListan($('#man-familjer'));
    } else {
      ritaListanStilla($('#man-chips'));
    }
  });

  /* Söket ritar bara listan, med fältet stilla. */
  document.addEventListener('input', e => {
    if (e.target && e.target.id === 'man-sok') ritaListanStilla(e.target);
  });

  /* Det andra områden anropar. */
  Object.assign(NXAdmin.rita, {
    ritaMånaden
  });
})();
