/* ============================================================
   NEXTRUM — uppgifterna (Fas 23.1)

   Leo 2026-09-28: läxorna ska vara roligare, "lite som duolingo, du
   klarar en nivå och går vidare", gå att göra i mobilen i steg, och
   ge något tillbaka ju fler man klarar. Min utveckling ska fungera
   som rättningen av dem. I vyerna heter läxorna uppgifter.

   Delas av foralder.html och larare.html. Här ligger banan, spelaren,
   stjärnorna och märkena, rättningen per område och genomgången av
   ett klart försök. Varje vy äger sina egna frågor mot databasen för
   uppgifterna (homework); det här är det som ska se likadant ut i båda.

   RÄTTNINGEN SKER I DATABASEN. Spelaren skickar varje svar till
   niva_svara() och visar vad den säger. Ingenting här räknar ut om
   ett svar är rätt, och ingenting skriver ett resultat: frågorna
   kommer utan facit, och facit kommer först efter ett svar. Se
   filhuvudet i fas23_1_uppgifterna_blir_digitala.sql.

   UPPLÅSNINGEN SKER HÄR, och bara här. Den är en spelregel och inget
   skydd: niva_starta() startar vilken nivå som helst åt familjens eget
   barn. En nivå är öppen när den är först i sin bana, när nivån före
   är klarad, när den redan är klarad eller påbörjad, eller när
   studiehjälparen gett den som uppgift.

   MÄRKENA RÄKNAS UR RADERNA, de sparas inte. Ett märke som stod i en
   egen tabell hade kunnat säga något annat än försöken det bygger på.
   Varje tal på sidan går därför att räkna fram ur niva_forsok och
   homework, och försöken skrivs bara av databasen.

   Inga serier som straffar. En veckoserie i stället för Duolingos
   dagliga: barnen har uppgifter ett par gånger i veckan, och en serie
   som bryts varje torsdag är en skuld, inte en belöning. Ingenting
   här skickar en påminnelse om den.
   ============================================================ */
window.NXUppgifter = (function () {
  'use strict';

  const esc = NX.esc;

  /* ---------- ikonerna ---------- */
  const IKON = {
    stjärna: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.85 5.95 6.45.83-4.72 4.47 1.2 6.4L12 17.1l-5.78 3.15 1.2-6.4L2.7 9.38l6.45-.83z"/></svg>',
    lås: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>',
    bock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    kryss: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
    spela: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5v13l10-6.5z"/></svg>',
    låga: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.2c-3.9 0-6.6-2.6-6.6-6.2 0-3.2 2.1-5.3 3.7-7.1.4 1.9 1.4 3.1 2.6 3.7-.3-3.1 1.1-6 3.7-8.6.3 3.1 2.4 5 3.8 7.1a8 8 0 0 1 1.4 4.7c0 3.6-3 6.4-8.6 6.4z"/></svg>',
    flagga: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4M6 4.5h11l-2.2 4 2.2 4H6"/></svg>',
    pokal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0zM7.5 6H4.5a3 3 0 0 0 3 4.2M16.5 6h3a3 3 0 0 1-3 4.2M12 13.5V17M8.5 20.5h7M9.5 17h5v3.5h-5z"/></svg>',
    uppåt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17l5.5-5.5 3.5 3.5L20 8M15 8h5v5"/></svg>',
    klocka: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    böcker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 5.5h5v13h-5zM9.5 5.5h5v13h-5zM15 6.2l4.6-1.3 3 12.6-4.6 1.2z"/></svg>'
  };

  /* Gränserna för stjärnorna. Samma tal står i niva_svara(), som är
     den som räknar; här står de bara för att kunna förklaras. */
  const STJÄRNGRÄNS = [
    'under 60 procent rätt på första försöket: nivån räknas inte som klarad',
    'minst 60 procent rätt på första försöket',
    'minst 80 procent rätt på första försöket',
    'allt rätt på första försöket'
  ];

  const TYPTEXT = { val: 'Välj rätt svar', skriv: 'Skriv svaret', ordna: 'Sätt i rätt ordning' };
  const HEJA = ['Rätt!', 'Snyggt!', 'Precis!', 'Helt rätt!', 'Bra jobbat!', 'Klockrent!'];

  /* ============================================================
     DATAN
     ============================================================ */
  let katalogLöfte = null;

  /* Alla aktiva nivåer, en gång per sidladdning. Katalogen är liten
     (några hundra rader i ett helt skolsystem) och läses av alla
     inloggade, och med den i minnet byter banan ämne utan att vänta
     på nätet. Svarar null om tabellen inte finns än: då står
     uppgifterna kvar som förut, utan de digitala delarna. */
  function laddaKatalog(supa) {
    if (!katalogLöfte) {
      katalogLöfte = supa.from('nivaer')
        .select('id, nyckel, amne, arskurs, omrade, titel, beskrivning, ordning, antal_fragor, aktiv')
        .order('amne').order('arskurs').order('ordning')
        .then(({ data, error }) => {
          if (error) { katalogLöfte = null; console.warn('Nivåerna gick inte att läsa', error); return null; }
          return data || [];
        });
    }
    return katalogLöfte;
  }

  function laddaFörsök(supa, elevId) {
    return supa.from('niva_forsok')
      .select('id, niva_id, student_id, startad_at, klar_at, antal, ratt_direkt, stjarnor, godkand')
      .eq('student_id', elevId).order('startad_at', { ascending: true }).limit(2000)
      .then(({ data, error }) => {
        if (error) { console.warn('Försöken gick inte att läsa', error); return null; }
        return data || [];
      });
  }

  function efterId(rader) {
    const m = {};
    (rader || []).forEach(r => { m[r.id] = r; });
    return m;
  }

  /* Varje nivå eleven rört: bästa stjärnorna, om den klarats, det
     första klara försöket (det är det som räknas som rättningen: då
     hade eleven inte sett svaren) och ett påbörjat försök från det
     senaste dygnet, som spelaren fortsätter i. */
  function perNivå(forsok) {
    const m = {};
    const dygn = Date.now() - 86400000;
    (forsok || []).forEach(f => {
      const x = m[f.niva_id] || (m[f.niva_id] = { klar: false, stjarnor: 0, klaraFörsök: 0, första: null, pågår: null });
      if (f.klar_at) {
        x.klaraFörsök++;
        if (!x.första) x.första = f;
        if (f.godkand) x.klar = true;
        x.stjarnor = Math.max(x.stjarnor, Number(f.stjarnor) || 0);
      } else if (Date.parse(f.startad_at) > dygn) {
        x.pågår = f;
      }
    });
    return m;
  }

  function banansNivåer(katalog, amne, arskurs) {
    return (katalog || []).filter(n => n.aktiv && n.amne === amne && n.arskurs === arskurs)
      .sort((a, b) => a.ordning - b.ordning);
  }

  /* Banan som noder, i ordning, med läget för varje. */
  function banan(katalog, amne, arskurs, forsok, uppgifter) {
    const läge = perNivå(forsok);
    const givna = {};
    (uppgifter || []).forEach(h => { if (h.niva_id && h.status !== 'klar') givna[h.niva_id] = h; });
    let förraKlar = true;
    let aktuellFinns = false;
    return banansNivåer(katalog, amne, arskurs).map((n, i) => {
      const l = läge[n.id] || {};
      const nod = {
        niva: n, klar: !!l.klar, stjarnor: l.stjarnor || 0, pågår: !!l.pågår,
        given: givna[n.id] || null,
        öppen: i === 0 || förraKlar || !!l.klar || !!l.pågår || !!givna[n.id],
        aktuell: false
      };
      if (!aktuellFinns && nod.öppen && !nod.klar) { nod.aktuell = true; aktuellFinns = true; }
      förraKlar = !!l.klar;
      return nod;
    });
  }

  /* Vilka ämnen och årskurser som har en bana. */
  function banor(katalog) {
    const ämnen = {};
    (katalog || []).forEach(n => {
      if (!n.aktiv) return;
      (ämnen[n.amne] = ämnen[n.amne] || new Set()).add(n.arskurs);
    });
    const ordning = NX.ARSKURSER.map(a => a.kod);
    const ut = {};
    Object.keys(ämnen).forEach(a => {
      ut[a] = Array.from(ämnen[a]).sort((x, y) => ordning.indexOf(x) - ordning.indexOf(y));
    });
    return ut;
  }

  /* Den årskurs banan öppnar i: elevens egen om den har en bana,
     annars den närmaste under (det man redan borde kunna), annars den
     första som finns. */
  function förvaldÅrskurs(årskurser, elevensKod) {
    if (!årskurser || !årskurser.length) return '';
    if (elevensKod && årskurser.includes(elevensKod)) return elevensKod;
    const ordning = NX.ARSKURSER.map(a => a.kod);
    const min = ordning.indexOf(elevensKod);
    if (min >= 0) {
      const under = årskurser.filter(k => ordning.indexOf(k) < min);
      if (under.length) return under[under.length - 1];
    }
    return årskurser[0];
  }

  /* ============================================================
     STJÄRNOR, SERIER OCH MÄRKEN
     ============================================================ */
  function veckonyckel(t) {
    const d = new Date(t);
    const måndag = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
    return NX.isoFor(måndag);
  }
  function veckanFöre(nyckel) {
    const [å, m, d] = nyckel.split('-').map(Number);
    return NX.isoFor(new Date(å, m - 1, d - 7));
  }
  /* ISO-veckans nummer, som det står i en svensk almanacka. */
  function veckonummer(t) {
    const d = new Date(t);
    const tors = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7) + 3);
    const förstaTors = new Date(tors.getFullYear(), 0, 4);
    return 1 + Math.round(((tors - förstaTors) / 86400000 - 3 + ((förstaTors.getDay() + 6) % 7)) / 7);
  }

  /* Veckor med något klarat: en klarad nivå eller en uppgift från
     studiehjälparen som bockats av. Serien räknas bakåt från den här
     veckan, eller från förra om den här inte har något än — veckan är
     inte slut, och en serie ska inte se bruten ut en måndag morgon. */
  function veckoserie(forsok, uppgifter) {
    const veckor = new Set();
    (forsok || []).forEach(f => { if (f.klar_at && f.godkand) veckor.add(veckonyckel(f.klar_at)); });
    (uppgifter || []).forEach(h => { if (h.status === 'klar' && h.completed_at) veckor.add(veckonyckel(h.completed_at)); });

    let v = veckonyckel(Date.now());
    if (!veckor.has(v)) v = veckanFöre(v);
    let nu = 0;
    while (veckor.has(v)) { nu++; v = veckanFöre(v); }

    const sorterade = Array.from(veckor).sort();
    let bäst = 0, rad = 0, förra = null;
    sorterade.forEach(k => {
      rad = förra && veckanFöre(k) === förra ? rad + 1 : 1;
      bäst = Math.max(bäst, rad);
      förra = k;
    });
    return { nu, bäst, dennaVecka: veckor.has(veckonyckel(Date.now())) };
  }

  /* Allt märkena och talen räknas ur. */
  function underlag(katalog, forsok, uppgifter) {
    const nivå = efterId(katalog);
    const läge = perNivå(forsok);
    const d = { klaradeNivåer: 0, stjärnor: 0, treStjärnor: 0, helaAvsnitt: 0, helaBanor: 0,
                förbättringar: 0, iTid: 0, ämnen: 0 };
    const ämnen = new Set();
    Object.keys(läge).forEach(id => {
      const l = läge[id];
      d.stjärnor += l.stjarnor;
      if (l.stjarnor === 3) d.treStjärnor++;
      if (l.klar) { d.klaradeNivåer++; if (nivå[id]) ämnen.add(nivå[id].amne); }
    });
    d.ämnen = ämnen.size;

    /* Bättre andra gången: ett klart försök med fler stjärnor än ett
       tidigare klart försök på samma nivå. */
    const bästHittills = {};
    const bättre = new Set();
    (forsok || []).filter(f => f.klar_at).sort((a, b) => Date.parse(a.klar_at) - Date.parse(b.klar_at)).forEach(f => {
      const s = Number(f.stjarnor) || 0;
      if (f.niva_id in bästHittills && s > bästHittills[f.niva_id]) bättre.add(f.niva_id);
      bästHittills[f.niva_id] = Math.max(bästHittills[f.niva_id] || 0, s);
    });
    d.förbättringar = bättre.size;

    const grupper = {}, banGrupper = {};
    (katalog || []).filter(n => n.aktiv).forEach(n => {
      const a = n.amne + '|' + n.arskurs + '|' + n.omrade, b = n.amne + '|' + n.arskurs;
      (grupper[a] = grupper[a] || []).push(n.id);
      (banGrupper[b] = banGrupper[b] || []).push(n.id);
    });
    const allaKlara = ids => ids.every(id => läge[id] && läge[id].klar);
    d.helaAvsnitt = Object.values(grupper).filter(allaKlara).length;
    d.helaBanor = Object.values(banGrupper).filter(allaKlara).length;

    d.iTid = (uppgifter || []).filter(h => h.status === 'klar' && h.due_date && h.completed_at
      && NX.isoFor(new Date(h.completed_at)) <= h.due_date).length;

    const serie = veckoserie(forsok, uppgifter);
    d.serie = serie.nu;
    d.bästaSerie = serie.bäst;
    d.dennaVecka = serie.dennaVecka;
    return d;
  }

  const MÄRKEN = [
    { id: 'forsta', namn: 'Första nivån', text: 'Klara en nivå.', ikon: 'flagga', mål: 1, mät: d => d.klaradeNivåer },
    { id: 'stjarnor-10', namn: 'Tio stjärnor', text: 'Samla 10 stjärnor.', ikon: 'stjärna', mål: 10, mät: d => d.stjärnor },
    { id: 'allt-ratt', namn: 'Allt rätt direkt', text: 'Klara en nivå utan ett enda fel.', ikon: 'bock', mål: 1, mät: d => d.treStjärnor },
    { id: 'serie-3', namn: 'Tre veckor i rad', text: 'Klara något varje vecka, tre veckor i rad.', ikon: 'låga', mål: 3, mät: d => d.bästaSerie },
    { id: 'battre', namn: 'Bättre andra gången', text: 'Gör om en nivå och få fler stjärnor.', ikon: 'uppåt', mål: 1, mät: d => d.förbättringar },
    { id: 'i-tid', namn: 'I tid', text: 'Gör fem uppgifter från studiehjälparen i tid.', ikon: 'klocka', mål: 5, mät: d => d.iTid },
    { id: 'avsnitt', namn: 'Ett helt avsnitt', text: 'Klara alla nivåer i ett avsnitt.', ikon: 'flagga', mål: 1, mät: d => d.helaAvsnitt },
    { id: 'stjarnor-25', namn: '25 stjärnor', text: 'Samla 25 stjärnor.', ikon: 'stjärna', mål: 25, mät: d => d.stjärnor },
    { id: 'tva-amnen', namn: 'Två ämnen', text: 'Klara nivåer i två olika ämnen.', ikon: 'böcker', mål: 2, mät: d => d.ämnen },
    { id: 'allt-ratt-5', namn: 'Fem felfria', text: 'Klara fem nivåer utan ett enda fel.', ikon: 'bock', mål: 5, mät: d => d.treStjärnor },
    { id: 'stjarnor-50', namn: '50 stjärnor', text: 'Samla 50 stjärnor.', ikon: 'stjärna', mål: 50, mät: d => d.stjärnor },
    { id: 'serie-8', namn: 'Åtta veckor i rad', text: 'Klara något varje vecka, åtta veckor i rad.', ikon: 'låga', mål: 8, mät: d => d.bästaSerie },
    { id: 'bana', namn: 'En hel bana', text: 'Klara alla nivåer i en bana.', ikon: 'pokal', mål: 1, mät: d => d.helaBanor },
    { id: 'stjarnor-100', namn: '100 stjärnor', text: 'Samla 100 stjärnor.', ikon: 'pokal', mål: 100, mät: d => d.stjärnor }
  ];

  function märken(d) {
    return MÄRKEN.map(m => {
      const har = Math.min(m.mål, m.mät(d) || 0);
      return { id: m.id, namn: m.namn, text: m.text, ikon: m.ikon, mål: m.mål, har, klart: har >= m.mål };
    });
  }

  function stjärnRad(antal, max, klass) {
    let ut = '<span class="upg-stj' + (klass ? ' ' + klass : '') + '" role="img" aria-label="'
      + antal + ' av ' + (max || 3) + ' stjärnor">';
    for (let i = 1; i <= (max || 3); i++) ut += '<i class="' + (i <= antal ? 'tand' : '') + '">' + IKON.stjärna + '</i>';
    return ut + '</span>';
  }

  function märkesHtml(m, opts) {
    const o = opts || {};
    return '<div class="upg-marke' + (m.klart ? ' klart' : '') + (o.nytt ? ' nytt' : '') + '">'
      + '<span class="upg-marke-ikon">' + IKON[m.ikon] + '</span>'
      + '<b>' + esc(m.namn) + '</b>'
      + '<span class="upg-marke-text">' + esc(m.klart ? m.text.replace(/\.$/, '') + ' ✓' : m.text) + '</span>'
      + (!m.klart && m.mål > 1
          ? '<span class="upg-marke-mat" aria-label="' + m.har + ' av ' + m.mål + '"><i style="width:'
            + Math.round(m.har / m.mål * 100) + '%"></i></span><span class="upg-marke-tal">' + m.har + ' / ' + m.mål + '</span>'
          : '')
      + '</div>';
  }

  /* Serien, stjärnorna och märkena. Ritas i Uppgifter, under banan. */
  function ritaBelöningar(host, katalog, forsok, uppgifter) {
    if (!host) return;
    const d = underlag(katalog, forsok, uppgifter);
    const lista = märken(d);
    const klara = lista.filter(m => m.klart).length;
    host.innerHTML = '<div class="upg-bel-tal">'
      + '<div><span class="upg-bel-ikon stj">' + IKON.stjärna + '</span><b>' + d.stjärnor + '</b><span>stjärnor</span></div>'
      + '<div><span class="upg-bel-ikon serie' + (d.dennaVecka ? ' tand' : '') + '">' + IKON.låga + '</span><b>' + d.serie + '</b><span>'
        + (d.serie === 1 ? 'vecka i rad' : 'veckor i rad') + '</span></div>'
      + '<div><span class="upg-bel-ikon pokal">' + IKON.pokal + '</span><b>' + klara + '</b><span>av ' + lista.length + ' märken</span></div>'
      + '</div>'
      + '<p class="upg-bel-not">' + esc(d.dennaVecka
          ? 'Den här veckan är klar för serien.'
          : d.serie ? 'Klara en nivå eller en uppgift den här veckan så fortsätter serien.'
          : 'Klara en nivå eller en uppgift en vecka i taget så växer serien.') + '</p>'
      + '<div class="upg-marken">' + lista.map(m => märkesHtml(m)).join('') + '</div>';
  }

  /* ============================================================
     BANAN
     opts: { host, katalog, forsok, uppgifter, amne, arskurs, elevKod,
             öppen (nivå-id vars kort är utfällt), onVal({amne, arskurs}),
             onStarta(nivå) }
     ============================================================ */
  const XLED = [0, 1, 2, 1, 0, -1, -2, -1];

  function ritaBana(o) {
    const host = o.host;
    if (!host) return;
    const finns = banor(o.katalog);
    const ämnen = Object.keys(finns).sort((a, b) => NX.AMNEN.indexOf(a) - NX.AMNEN.indexOf(b));
    if (!ämnen.length) {
      host.innerHTML = '<div class="empty"><b>Inga nivåer än</b><br><span>Banan fylls på med nivåer i fler ämnen och årskurser.</span></div>';
      return;
    }
    const amne = finns[o.amne] ? o.amne : ämnen[0];
    const årskurser = finns[amne];
    const arskurs = årskurser.includes(o.arskurs) ? o.arskurs : förvaldÅrskurs(årskurser, o.elevKod);
    const noder = banan(o.katalog, amne, arskurs, o.forsok, o.uppgifter);
    const klara = noder.filter(n => n.klar).length;
    const stj = noder.reduce((s, n) => s + n.stjarnor, 0);

    let avsnitt = 0, förraOmråde = null, x = 0;
    const rader = noder.map(n => {
      let rubrik = '';
      if (n.niva.omrade !== förraOmråde) {
        avsnitt++;
        förraOmråde = n.niva.omrade;
        rubrik = '<li class="upg-avsnitt"><span>Avsnitt ' + avsnitt + '</span><b>' + esc(n.niva.omrade) + '</b></li>';
      }
      const läge = n.klar ? 'klar' : n.aktuell ? 'aktuell' : n.öppen ? 'oppen' : 'last';
      const ärÖppen = o.öppen === n.niva.id;
      const led = XLED[x++ % XLED.length];
      return rubrik + '<li class="upg-nod ' + läge + (ärÖppen ? ' vald' : '') + '" style="--x:' + led + '">'
        + '<button type="button" class="upg-nod-knapp" data-upg-nod="' + esc(n.niva.id) + '" aria-expanded="' + (ärÖppen ? 'true' : 'false') + '"'
        + ' aria-label="' + esc(n.niva.titel + ', ' + (n.klar ? 'klar, ' + n.stjarnor + ' av 3 stjärnor' : n.öppen ? 'öppen' : 'låst')) + '">'
        + (n.klar ? IKON.bock : n.öppen ? IKON.spela : IKON.lås)
        + (n.aktuell ? '<span class="upg-nod-bubbla" aria-hidden="true">' + (n.pågår ? 'Fortsätt' : 'Börja') + '</span>' : '')
        + '</button>'
        + '<span class="upg-nod-namn">' + esc(n.niva.titel) + '</span>'
        + (n.klar ? stjärnRad(n.stjarnor, 3, 'upg-stj-sm') : n.given ? '<span class="upg-nod-given">Från studiehjälparen</span>' : '')
        + (ärÖppen ? nodKort(n, noder) : '')
        + '</li>';
    }).join('');

    /* Ämnesraden är en rad man drar i sidled. Den ritas om med banan,
       och utan det här hoppade ett ämne man dragit fram tillbaka till
       början (samma fälla som bokningens ämnesrad, CLAUDE.md avsnitt 3). */
    const förraRaden = host.querySelector('.upg-amnen');
    const sidled = förraRaden ? förraRaden.scrollLeft : 0;

    host.innerHTML =
      '<div class="upg-bana-val">'
      + '<div class="upg-amnen" role="group" aria-label="Ämne">' + ämnen.map(a =>
          '<button type="button" class="chip" data-upg-amne="' + esc(a) + '" aria-pressed="' + (a === amne ? 'true' : 'false') + '">'
          + esc(a.split(' / ')[0]) + '</button>').join('') + '</div>'
      + (årskurser.length > 1
          ? '<label class="upg-arskurs"><span>Årskurs</span><select class="sel sel-sm" data-upg-arskurs aria-label="Årskurs">'
            + årskurser.map(k => '<option value="' + k + '"' + (k === arskurs ? ' selected' : '') + '>' + esc(NX.årskursText(k)) + '</option>').join('')
            + '</select></label>'
          : '<span class="upg-arskurs-en">' + esc(NX.årskursText(arskurs)) + '</span>')
      + '</div>'
      + '<div class="upg-bana-lage">'
      + '<div><b>' + klara + ' av ' + noder.length + ' nivåer klara</b><span>' + stj + ' av ' + noder.length * 3 + ' stjärnor i banan</span></div>'
      + '<span class="upg-mat" aria-hidden="true"><i style="width:' + (noder.length ? Math.round(klara / noder.length * 100) : 0) + '%"></i></span>'
      + '</div>'
      + '<ol class="upg-stig">' + rader + '</ol>';

    host.dataset.amne = amne;
    host.dataset.arskurs = arskurs;
    const raden = host.querySelector('.upg-amnen');
    if (raden && sidled) raden.scrollLeft = sidled;
  }

  function nodKort(n, noder) {
    const niva = n.niva;
    const i = noder.indexOf(n);
    const förra = i > 0 ? noder[i - 1].niva : null;
    const frågor = niva.antal_fragor ? niva.antal_fragor + ' frågor · ungefär ' + Math.max(2, Math.round(niva.antal_fragor * 0.5)) + ' minuter' : '';
    let knapp, text;
    if (!n.öppen) {
      text = 'Klara "' + (förra ? förra.titel : 'nivån före') + '" först, så öppnas den här.';
      knapp = '';
    } else {
      text = n.klar
        ? 'Klarad med ' + n.stjarnor + (n.stjarnor === 1 ? ' stjärna' : ' stjärnor') + '. Gör om den för fler, det bästa resultatet räknas.'
        : n.pågår ? 'Du har börjat. Det du svarat är sparat.'
        : n.given ? 'Din studiehjälpare har gett dig den här.' : '';
      knapp = '<button type="button" class="btn btn-primary btn-sm" data-upg-starta="' + esc(niva.id) + '">'
        + (n.klar ? 'Gör om' : n.pågår ? 'Fortsätt' : 'Starta') + '</button>';
    }
    return '<div class="upg-nod-kort">'
      + '<b>' + esc(niva.titel) + '</b>'
      + (niva.beskrivning ? '<p>' + esc(niva.beskrivning) + '</p>' : '')
      + (frågor ? '<span class="upg-nod-fakta">' + esc(frågor) + '</span>' : '')
      + (text ? '<p class="upg-nod-lage">' + esc(text) + '</p>' : '')
      + knapp
      + '</div>';
  }

  /* ============================================================
     RÄTTNINGEN PER OMRÅDE (Min utveckling)
     Det FÖRSTA klara försöket på varje nivå räknas, inte det bästa:
     efter ett försök har eleven sett svaren, och ett andra försök
     mäter minnet av dem. Stjärnorna i banan räknar det bästa, för där
     är det spelet. Här är det rättningen.
     ============================================================ */
  function perOmråde(katalog, forsok) {
    const nivå = efterId(katalog);
    const läge = perNivå(forsok);
    const g = {};
    Object.keys(läge).forEach(id => {
      const l = läge[id], n = nivå[id];
      if (!n || !l.första) return;
      const k = n.amne + '|' + n.omrade;
      const x = g[k] || (g[k] = { amne: n.amne, omrade: n.omrade, ratt: 0, antal: 0, nivåer: 0, klara: 0, senast: null });
      x.ratt += Number(l.första.ratt_direkt) || 0;
      x.antal += Number(l.första.antal) || 0;
      x.nivåer++;
      if (l.klar) x.klara++;
      if (!x.senast || l.första.klar_at > x.senast) x.senast = l.första.klar_at;
    });
    return Object.values(g).sort((a, b) => String(b.senast).localeCompare(String(a.senast)));
  }

  /* Klarade nivåer per vecka, de åtta senaste veckorna. */
  function perVecka(forsok) {
    const veckor = [];
    let v = veckonyckel(Date.now());
    for (let i = 0; i < 8; i++) { veckor.unshift({ nyckel: v, antal: 0, ratt: 0, frågor: 0 }); v = veckanFöre(v); }
    const efterNyckel = {};
    veckor.forEach(x => { efterNyckel[x.nyckel] = x; });
    (forsok || []).forEach(f => {
      if (!f.klar_at) return;
      const x = efterNyckel[veckonyckel(f.klar_at)];
      if (!x) return;
      if (f.godkand) x.antal++;
      x.ratt += Number(f.ratt_direkt) || 0;
      x.frågor += Number(f.antal) || 0;
    });
    veckor.forEach(x => { const [å, m, d] = x.nyckel.split('-').map(Number); x.nr = veckonummer(new Date(å, m - 1, d)); });
    return veckor;
  }

  /* Brickorna i en ordna-fråga som text. En mening (stor bokstav
     först, skiljetecken sist) sätts ihop med mellanslag; allt annat
     (tal, steg i en uträkning, ord i bokstavsordning) med pilar.
     Med mellanslag blev "8 / 2", "30 / 5" till "8 / 2 30 / 5", och
     ingen kunde se var en bricka slutade. */
  function brickText(brickor) {
    const b = (brickor || []).map(x => String(x));
    if (!b.length) return '';
    const mening = /^[A-ZÅÄÖ]/.test(b[0]) && /[.?!]$/.test(b[b.length - 1]);
    return mening ? b.join(' ').replace(/\s+([.,!?:;])/g, '$1') : b.join(' → ');
  }

  /* ============================================================
     SPELAREN
     En nivå i helskärm, en fråga i taget, med tummen. Frågorna kommer
     från niva_starta() utan facit; varje svar går till niva_svara(),
     som rättar det. Fel svar kommer tillbaka sist, tills allt är rätt.

     o: { supa, niva, elev, katalog, forsok, uppgifter, onStäng(ändrat) }
     ============================================================ */
  let öppenSpelare = null;

  function spela(o) {
    if (öppenSpelare) return;
    const supa = o.supa;
    const rot = document.createElement('div');
    rot.className = 'upg-spel';
    rot.setAttribute('role', 'dialog');
    rot.setAttribute('aria-modal', 'true');
    rot.innerHTML =
      '<div class="upg-spel-ram">'
      + '<div class="upg-spel-topp">'
      + '<button type="button" class="upg-spel-stang" data-spel-stang aria-label="Sluta">' + IKON.kryss + '</button>'
      + '<span class="upg-spel-mat" role="progressbar" aria-label="Rätt besvarade frågor" aria-valuemin="0"><i></i></span>'
      + '<span class="upg-spel-tal" aria-hidden="true"></span>'
      + '</div>'
      + '<div class="upg-spel-kropp"></div>'
      + '<div class="upg-spel-fot">'
      + '<div class="upg-besked" aria-live="polite"></div>'
      + '<div class="upg-spel-knappar"></div>'
      + '</div></div>';

    const kropp = rot.querySelector('.upg-spel-kropp');
    const besked = rot.querySelector('.upg-besked');
    const knappar = rot.querySelector('.upg-spel-knappar');
    const mätare = rot.querySelector('.upg-spel-mat');
    const talEl = rot.querySelector('.upg-spel-tal');

    let T = null;
    let ändrat = false;
    let stänger = false;
    let forsok = (o.forsok || []).slice();
    const märkenFöre = new Set(märken(underlag(o.katalog, forsok, o.uppgifter)).filter(m => m.klart).map(m => m.id));

    /* ---------- in och ut ---------- */
    const bakom = Array.from(document.body.children).filter(el => el !== rot && !el.inert);
    const fokusFöre = document.activeElement;
    document.body.appendChild(rot);
    bakom.forEach(el => { el.inert = true; });
    document.documentElement.classList.add('upg-spelar');
    void rot.offsetWidth;
    rot.classList.add('open');
    öppenSpelare = rot;

    /* Bakåtknappen på en telefon ska stänga nivån, inte lämna sidan.
       Ett eget steg i historiken, med samma adress: sidomenyn lyssnar
       på hashchange och märker ingenting. */
    let historik = false;
    try { history.pushState({ upgSpel: true }, '', location.href); historik = true; } catch (e) { /* inbäddad */ }
    window.addEventListener('popstate', påBakåt);

    function mittINivån() {
      return T && T.data && !T.resultat && T.svarade > 0;
    }

    async function påBakåt() {
      if (stänger) { städa(); return; }
      historik = false;
      if (mittINivån() && !(await frågaOmSluta())) {
        try { history.pushState({ upgSpel: true }, '', location.href); historik = true; } catch (e) { /* inbäddad */ }
        return;
      }
      städa();
    }

    function frågaOmSluta() {
      return NXStudie.bekräfta({
        titel: 'Sluta nu?',
        text: 'Det du svarat är sparat. Börjar du nivån igen i dag fortsätter du där du slutade.',
        knapp: 'Sluta', avbryt: 'Fortsätt öva'
      });
    }

    async function stäng() {
      if (mittINivån() && !(await frågaOmSluta())) return;
      if (historik && history.state && history.state.upgSpel) {
        stänger = true;
        history.back();
        /* Kommer popstate inte (en inbäddad vy utan historik) städas
           det ändå. */
        setTimeout(() => { if (öppenSpelare === rot) städa(); }, 400);
      } else {
        städa();
      }
    }

    function städa() {
      if (öppenSpelare !== rot) return;
      öppenSpelare = null;
      window.removeEventListener('popstate', påBakåt);
      document.removeEventListener('keydown', tangent);
      bakom.forEach(el => { el.inert = false; });
      document.documentElement.classList.remove('upg-spelar');
      rot.remove();
      if (fokusFöre && fokusFöre.isConnected && fokusFöre.focus) fokusFöre.focus({ preventScroll: true });
      if (typeof o.onStäng === 'function') o.onStäng(ändrat);
    }

    rot.addEventListener('click', e => {
      if (e.target.closest('[data-spel-stang]')) { stäng(); return; }
      const alt = e.target.closest('[data-alt]');
      if (alt && T && T.läge === 'svara') { väljAlt(Number(alt.dataset.alt)); return; }
      const bricka = e.target.closest('[data-bricka]');
      if (bricka && T && T.läge === 'svara') { flyttaBricka(Number(bricka.dataset.bricka)); return; }
      const k = e.target.closest('[data-spel]');
      if (!k) return;
      const vad = k.dataset.spel;
      if (vad === 'kolla') kolla();
      else if (vad === 'vidare') vidare();
      else if (vad === 'igen') starta(T.niva);
      else if (vad === 'nasta' && T.nästa) starta(T.nästa);
      else if (vad === 'klar') stäng();
      else if (vad === 'forsok-igen') kolla();
    });
    rot.addEventListener('input', e => {
      if (e.target.matches('.upg-skriv') && T) {
        T.svar = e.target.value;
        sättKnapp();
      }
    });
    function tangent(e) {
      if (!T || öppenSpelare !== rot || document.querySelector('.nx-fraga')) return;
      if (e.key === 'Escape') { e.preventDefault(); stäng(); return; }
      if (e.key === 'Enter') {
        /* Enter på ett alternativ eller en bricka väljer den, som en
           knapp ska. Annars skickade Enter in det förra valet. */
        if (e.target && e.target.closest && e.target.closest('.upg-alt, .upg-bricka, [data-spel-stang]')) return;
        const k = knappar.querySelector('.btn-primary:not(:disabled)');
        if (k) { e.preventDefault(); k.click(); }
        return;
      }
      if (T.läge === 'svara' && T.fråga && T.fråga.typ === 'val' && /^[1-5]$/.test(e.key)
          && !(e.target && e.target.matches && e.target.matches('input'))) {
        const i = Number(e.key) - 1;
        if (T.ordning && i < T.ordning.length) väljAlt(T.ordning[i]);
      }
    }
    document.addEventListener('keydown', tangent);

    /* ---------- en nivå ---------- */
    async function starta(niva) {
      T = { niva, data: null, kö: [], klara: 0, total: 0, svarade: 0, fråga: null, svar: null, ordning: null,
            läge: 'hämtar', resultat: null, start: Date.now(), nästa: null, felSenast: null };
      rot.setAttribute('aria-label', niva.titel);
      besked.className = 'upg-besked';
      besked.innerHTML = '';
      knappar.innerHTML = '';
      kropp.innerHTML = '<div class="upg-spel-laddar"><b>' + esc(niva.titel) + '</b><span>Hämtar frågorna</span></div>';
      mätare.firstChild.style.width = '0%';
      talEl.textContent = '';

      const { data, error } = await supa.rpc('niva_starta', { p_niva: niva.id, p_elev: o.elev });
      if (öppenSpelare !== rot) return;
      if (error) {
        kropp.innerHTML = '<div class="upg-spel-fel"><b>Nivån gick inte att starta</b><p>' + esc(NX.felText(error)) + '</p></div>';
        knappar.innerHTML = '<button type="button" class="btn btn-primary btn-block" data-spel="klar">Stäng</button>';
        return;
      }
      ändrat = true;
      T.data = data;
      const klara = new Set(data.klara || []);
      T.total = (data.fragor || []).length;
      T.klara = klara.size;
      T.svarade = klara.size;
      T.kö = (data.fragor || []).filter(f => !klara.has(f.id));
      uppdateraMätare();
      if (!T.kö.length) {
        kropp.innerHTML = '<div class="upg-spel-fel"><b>Den här nivån är redan klar</b><p>Stäng och starta den igen för ett nytt försök.</p></div>';
        knappar.innerHTML = '<button type="button" class="btn btn-primary btn-block" data-spel="klar">Stäng</button>';
        return;
      }
      nästaFråga();
    }

    function uppdateraMätare() {
      const andel = T.total ? T.klara / T.total : 0;
      mätare.firstChild.style.width = Math.round(andel * 100) + '%';
      mätare.setAttribute('aria-valuemax', String(T.total));
      mätare.setAttribute('aria-valuenow', String(T.klara));
      talEl.textContent = T.total ? T.klara + '/' + T.total : '';
    }

    function nästaFråga() {
      T.fråga = T.kö.shift();
      T.svar = null;
      T.brickor = null;
      T.läge = 'svara';
      besked.className = 'upg-besked';
      besked.innerHTML = '';
      rot.classList.remove('ratt', 'fel');
      ritaFråga();
      sättKnapp();
    }

    function blandat(n) {
      const a = Array.from({ length: n }, (_, i) => i);
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    function ritaFråga() {
      const f = T.fråga;
      let svar = '';
      if (f.typ === 'val') {
        T.ordning = blandat((f.alternativ || []).length);
        svar = '<div class="upg-val" role="group" aria-label="Svarsalternativ">' + T.ordning.map((i, nr) =>
          '<button type="button" class="upg-alt" data-alt="' + i + '" aria-pressed="false">'
          + '<span class="upg-alt-nr" aria-hidden="true">' + (nr + 1) + '</span>'
          + '<span>' + esc(f.alternativ[i]) + '</span></button>').join('') + '</div>';
      } else if (f.typ === 'skriv') {
        svar = '<input class="upg-skriv inp" type="text" autocomplete="off" autocapitalize="off" autocorrect="off"'
          + ' spellcheck="false" enterkeyhint="done" maxlength="200" aria-label="Ditt svar" placeholder="Ditt svar"'
          + (f.numerisk ? ' inputmode="decimal"' : '') + '>';
      } else {
        T.brickor = (f.brickor || []).map((text, i) => ({ i, text, lagd: false }));
        T.rad = [];
        svar = '<div class="upg-rad" aria-label="Ditt svar"></div>'
          + '<div class="upg-brickor" role="group" aria-label="Brickor">' + T.brickor.map(b =>
            '<button type="button" class="upg-bricka" data-bricka="' + b.i + '">' + esc(b.text) + '</button>').join('') + '</div>';
      }
      kropp.innerHTML = '<div class="upg-fraga">'
        + '<p class="upg-fraga-typ">' + esc(TYPTEXT[f.typ] || '') + '</p>'
        + '<h2 class="upg-fraga-text" tabindex="-1">' + esc(f.fraga) + '</h2>'
        + svar + '</div>';
      kropp.scrollTop = 0;
      const rubrik = kropp.querySelector('.upg-fraga-text');
      const fält = kropp.querySelector('.upg-skriv');
      /* Tangentbordet fälls upp direkt för en skrivfråga på en dator,
         men inte på en telefon: där skjuter det frågan ur bild innan
         man hunnit läsa den. */
      if (fält && window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches) fält.focus();
      else if (rubrik) rubrik.focus({ preventScroll: true });
    }

    function väljAlt(i) {
      T.svar = i;
      kropp.querySelectorAll('.upg-alt').forEach(b => b.setAttribute('aria-pressed', Number(b.dataset.alt) === i ? 'true' : 'false'));
      sättKnapp();
    }

    /* En bricka flyttas mellan banken och raden. I banken lämnar den
       en tom plats efter sig: brickorna under ska inte hoppa när man
       tar en, för det är nästa man ska trycka på. */
    function flyttaBricka(i) {
      const b = T.brickor[i];
      if (!b) return;
      b.lagd = !b.lagd;
      if (b.lagd) T.rad.push(i); else T.rad = T.rad.filter(x => x !== i);
      const rad = kropp.querySelector('.upg-rad');
      rad.innerHTML = T.rad.map(x =>
        '<button type="button" class="upg-bricka" data-bricka="' + x + '">' + esc(T.brickor[x].text) + '</button>').join('');
      kropp.querySelectorAll('.upg-brickor .upg-bricka').forEach(k => {
        const lagd = T.brickor[Number(k.dataset.bricka)].lagd;
        k.classList.toggle('lagd', lagd);
        k.disabled = lagd;
        k.setAttribute('aria-hidden', lagd ? 'true' : 'false');
      });
      T.svar = T.rad.length ? T.rad.map(x => T.brickor[x].text) : null;
      sättKnapp();
    }

    function harSvar() {
      if (!T.fråga) return false;
      if (T.fråga.typ === 'skriv') return !!(T.svar && String(T.svar).trim());
      return T.svar !== null && T.svar !== undefined;
    }

    function sättKnapp() {
      if (T.läge === 'svara') {
        knappar.innerHTML = '<button type="button" class="btn btn-primary btn-block upg-kolla" data-spel="kolla"'
          + (harSvar() ? '' : ' disabled') + '>Kontrollera</button>';
      }
    }

    async function kolla() {
      if (T.läge !== 'svara' && T.läge !== 'nätfel') return;
      if (!harSvar()) return;
      const f = T.fråga;
      const p_svar = f.typ === 'val' ? { val: T.svar } : f.typ === 'skriv' ? { text: String(T.svar).trim() } : { ordning: T.svar };
      T.läge = 'rättar';
      const knapp = knappar.querySelector('button');
      if (knapp) { knapp.setAttribute('aria-busy', 'true'); knapp.textContent = 'Rättar…'; }
      kropp.querySelectorAll('button, input').forEach(el => { el.disabled = true; });

      const { data, error } = await supa.rpc('niva_svara', { p_forsok: T.data.forsok, p_fraga: f.id, p_svar });
      if (öppenSpelare !== rot) return;
      if (error) {
        /* Svaret står kvar, och samma tryck skickar det igen. Går det
           fram två gånger ger databasen samma besked utan en ny rad. */
        T.läge = 'nätfel';
        besked.className = 'upg-besked natfel';
        besked.innerHTML = '<b>Svaret kom inte fram</b><p>' + esc(NX.felText(error)) + '</p>';
        knappar.innerHTML = '<button type="button" class="btn btn-primary btn-block" data-spel="forsok-igen">Försök igen</button>';
        return;
      }
      T.svarade++;
      visaBesked(f, data);
    }

    function facitText(f, facit) {
      if (f.typ === 'val') return f.alternativ[Number(facit)] || '';
      if (f.typ === 'ordna') return brickText(facit);
      return String(facit || '');
    }

    function visaBesked(f, svar) {
      T.läge = 'besked';
      const rätt = !!svar.ratt;
      if (rätt) T.klara++;
      else T.kö.push(f);
      uppdateraMätare();
      rot.classList.toggle('ratt', rätt);
      rot.classList.toggle('fel', !rätt);

      /* Svaret som gavs står kvar i frågan, markerat. */
      if (f.typ === 'val') {
        kropp.querySelectorAll('.upg-alt').forEach(b => {
          const i = Number(b.dataset.alt);
          if (i === Number(svar.facit)) b.classList.add('ar-ratt');
          else if (i === T.svar) b.classList.add('ar-fel');
        });
      } else if (f.typ === 'skriv') {
        const fält = kropp.querySelector('.upg-skriv');
        if (fält) fält.classList.add(rätt ? 'ar-ratt' : 'ar-fel');
      } else {
        const rad = kropp.querySelector('.upg-rad');
        if (rad) rad.classList.add(rätt ? 'ar-ratt' : 'ar-fel');
      }

      const heja = HEJA[Math.floor(Math.random() * HEJA.length)];
      besked.className = 'upg-besked ' + (rätt ? 'ratt' : 'fel');
      besked.innerHTML = '<div class="upg-besked-topp"><span class="upg-besked-ikon">' + (rätt ? IKON.bock : IKON.kryss) + '</span>'
        + '<b>' + esc(rätt ? heja : 'Inte riktigt') + '</b></div>'
        + (!rätt ? '<p class="upg-besked-facit">Rätt svar: <span>' + esc(facitText(f, svar.facit)) + '</span></p>' : '')
        + (svar.forklaring ? '<p class="upg-besked-varfor">' + esc(svar.forklaring) + '</p>' : '')
        + (!rätt ? '<p class="upg-besked-igen">Frågan kommer tillbaka i slutet.</p>' : '');

      if (svar.klar && svar.resultat) T.resultat = svar.resultat;
      knappar.innerHTML = '<button type="button" class="btn btn-primary btn-block" data-spel="vidare">'
        + (T.resultat ? 'Se resultatet' : 'Fortsätt') + '</button>';
      const k = knappar.querySelector('button');
      if (k) k.focus({ preventScroll: true });
    }

    function vidare() {
      if (T.läge !== 'besked') return;
      if (T.resultat) return slut();
      if (!T.kö.length) return slut();
      nästaFråga();
    }

    /* ---------- resultatet ---------- */
    function slut() {
      T.läge = 'slut';
      rot.classList.remove('ratt', 'fel');
      besked.className = 'upg-besked';
      besked.innerHTML = '';
      const r = T.resultat || {};
      const stj = Number(r.stjarnor) || 0;
      const nya = Math.max(0, stj - (Number(r.forut) || 0));
      const sek = Math.round((Date.now() - T.start) / 1000);
      const tid = Math.floor(sek / 60) + ':' + String(sek % 60).padStart(2, '0');

      /* Försöket läggs till lokalt, så att märkena och nästa nivå räknas
         på det som just hände. Vyn hämtar om allt när spelaren stängs. */
      forsok = forsok.concat([{ id: T.data.forsok, niva_id: T.niva.id, startad_at: new Date(T.start).toISOString(),
        klar_at: r.klar_at || new Date().toISOString(), antal: r.antal, ratt_direkt: r.ratt_direkt,
        stjarnor: stj, godkand: !!r.godkand }]);
      const nuKlara = märken(underlag(o.katalog, forsok, o.uppgifter)).filter(m => m.klart && !märkenFöre.has(m.id));
      nuKlara.forEach(m => märkenFöre.add(m.id));

      const noder = banan(o.katalog, T.niva.amne, T.niva.arskurs, forsok, o.uppgifter);
      const här = noder.findIndex(n => n.niva.id === T.niva.id);
      const nästa = here => noder.slice(here + 1).find(n => n.öppen && !n.klar);
      const nn = r.godkand && här >= 0 ? nästa(här) : null;
      T.nästa = nn ? nn.niva : null;

      kropp.innerHTML = '<div class="upg-slut' + (r.godkand ? ' klarad' : '') + '">'
        + '<div class="upg-slut-stj">' + [1, 2, 3].map(i =>
            '<i class="' + (i <= stj ? 'tand' : '') + '" style="--i:' + i + '">' + IKON.stjärna + '</i>').join('') + '</div>'
        + '<h2 tabindex="-1">' + esc(r.godkand ? (stj === 3 ? 'Allt rätt direkt!' : 'Nivån klar!') : 'Nästan!') + '</h2>'
        + '<p class="upg-slut-rad"><b>' + (r.ratt_direkt || 0) + ' av ' + (r.antal || 0) + '</b> rätt på första försöket · ' + esc(tid) + '</p>'
        + (r.godkand
            ? (nya ? '<p class="upg-slut-ny">+' + nya + (nya === 1 ? ' ny stjärna' : ' nya stjärnor') + '</p>'
                   : stj < 3 ? '<p class="upg-slut-not">Gör om nivån när du vill. Allt rätt direkt ger tre stjärnor.</p>' : '')
            : '<p class="upg-slut-not">Du behöver minst 60 procent rätt på första försöket för att nästa nivå ska öppnas. Försök igen, nu har du sett svaren.</p>')
        + (nuKlara.length
            ? '<div class="upg-slut-marken"><p>' + (nuKlara.length === 1 ? 'Nytt märke' : 'Nya märken') + '</p>'
              + nuKlara.map(m => märkesHtml(m, { nytt: true })).join('') + '</div>'
            : '')
        + '</div>';
      const h = kropp.querySelector('h2');
      if (h) h.focus({ preventScroll: true });
      mätare.firstChild.style.width = '100%';

      knappar.innerHTML = r.godkand
        ? (T.nästa ? '<button type="button" class="btn btn-primary btn-block" data-spel="nasta">Nästa nivå: ' + esc(T.nästa.titel) + '</button>' : '')
          + '<button type="button" class="btn ' + (T.nästa ? 'btn-ghost' : 'btn-primary') + ' btn-block" data-spel="klar">Klar</button>'
        : '<button type="button" class="btn btn-primary btn-block" data-spel="igen">Försök igen</button>'
          + '<button type="button" class="btn btn-ghost btn-block" data-spel="klar">Klar för nu</button>';
    }

    starta(o.niva);
  }

  /* ============================================================
     GENOMGÅNGEN
     Ett klart försök fråga för fråga: vad som frågades, vad eleven
     svarade (alla svar, i ordning), rätt svar och förklaringen. Det är
     rättningen, och den ser likadan ut hos familjen och studiehjälparen.
     ============================================================ */
  function svarText(q, s) {
    const v = s && s.svar;
    if (!v) return '';
    if (q.typ === 'val') return (q.alternativ || [])[Number(v.val)] || '–';
    if (q.typ === 'skriv') return String(v.text || '');
    return brickText(v.ordning);
  }
  function facitVisning(q) {
    if (q.typ === 'val') return (q.alternativ || [])[Number(q.facit)] || '';
    if (q.typ === 'ordna') return brickText(q.facit);
    return String(q.facit || '');
  }

  function genomgångHtml(g) {
    const f = g.forsok, n = g.niva;
    return '<div class="upg-genom-huvud">'
      + '<span class="upg-genom-etikett">' + esc([n.amne.split(' / ')[0], NX.årskursText(n.arskurs), n.omrade].join(' · ')) + '</span>'
      + '<h3 id="upg-genom-t">' + esc(n.titel) + '</h3>'
      + '<p>' + stjärnRad(f.stjarnor) + '<span><b>' + f.ratt_direkt + ' av ' + f.antal + '</b> rätt på första försöket · '
      + esc(NX.datumText(String(f.klar_at).slice(0, 10))) + '</span></p>'
      + '</div>'
      + '<ol class="upg-genom-lista">' + (g.fragor || []).map(q => {
          const svar = q.svar || [];
          const först = svar[0];
          const direkt = !!(först && först.ratt);
          return '<li class="' + (direkt ? 'direkt' : 'efter') + '">'
            + '<p class="upg-genom-fraga"><span class="upg-genom-tecken">' + (direkt ? IKON.bock : IKON.kryss) + '</span>' + esc(q.fraga) + '</p>'
            + '<div class="upg-genom-svar">' + svar.map((s, i) =>
                '<span class="' + (s.ratt ? 'ratt' : 'fel') + '"><em>' + (i === 0 ? 'Svar' : 'Sedan') + '</em> ' + esc(svarText(q, s)) + '</span>').join('')
            + '</div>'
            + (!direkt ? '<p class="upg-genom-facit">Rätt svar: <b>' + esc(facitVisning(q)) + '</b></p>' : '')
            + (q.forklaring ? '<p class="upg-genom-varfor">' + esc(q.forklaring) + '</p>' : '')
            + '</li>';
        }).join('') + '</ol>';
  }

  function ruta(innehåll, etikett) {
    const r = document.createElement('div');
    r.className = 'upg-genom';
    r.innerHTML = '<div class="upg-genom-box" role="dialog" aria-modal="true" aria-labelledby="upg-genom-t">'
      + '<button type="button" class="upg-genom-stang" data-genom-stang aria-label="Stäng">' + IKON.kryss + '</button>'
      + '<div class="upg-genom-inne">' + innehåll + '</div></div>';
    const fokus = document.activeElement;
    function stäng() {
      r.remove();
      document.removeEventListener('keydown', tangent);
      document.documentElement.classList.remove('upg-genom-oppen');
      if (fokus && fokus.isConnected && fokus.focus) fokus.focus({ preventScroll: true });
    }
    function tangent(e) { if (e.key === 'Escape') stäng(); }
    r.addEventListener('click', e => {
      if (e.target === r || e.target.closest('[data-genom-stang]')) stäng();
    });
    document.addEventListener('keydown', tangent);
    document.body.appendChild(r);
    document.documentElement.classList.add('upg-genom-oppen');
    void r.offsetWidth;
    r.classList.add('open');
    const k = r.querySelector('[data-genom-stang]');
    if (k) k.focus({ preventScroll: true });
    r.setAttribute('aria-label', etikett || 'Genomgång');
    return { r, stäng, sätt: html => { r.querySelector('.upg-genom-inne').innerHTML = html; } };
  }

  async function genomgång(supa, forsokId) {
    const g = ruta('<div class="loading">Hämtar rättningen</div>', 'Rättningen');
    const { data, error } = await supa.rpc('niva_genomgang', { p_forsok: forsokId });
    if (error) { g.sätt('<div class="empty"><b>Rättningen gick inte att hämta</b><br><span>' + esc(NX.felText(error)) + '</span></div>'); return; }
    g.sätt(genomgångHtml(data));
  }

  /* Studiehjälparens förhandsvisning: frågorna och facit, innan nivån
     ges som uppgift. Läser niva_fragor direkt; bara godkända
     studiehjälpare och admin har en policy där. */
  async function förhandsvisa(supa, niva) {
    const g = ruta('<div class="loading">Hämtar frågorna</div>', niva.titel);
    const { data, error } = await supa.from('niva_fragor')
      .select('id, ordning, typ, fraga, alternativ, ratt, forklaring')
      .eq('niva_id', niva.id).eq('aktiv', true).order('ordning');
    if (error) { g.sätt('<div class="empty"><b>Frågorna gick inte att hämta</b><br><span>' + esc(NX.felText(error)) + '</span></div>'); return; }
    const facit = q => q.typ === 'val' ? (q.alternativ || [])[Number(q.ratt)]
      : q.typ === 'skriv' ? (q.ratt || []).join(' eller ')
      : brickText(q.ratt);
    g.sätt('<div class="upg-genom-huvud">'
      + '<span class="upg-genom-etikett">' + esc([niva.amne.split(' / ')[0], NX.årskursText(niva.arskurs), niva.omrade].join(' · ')) + '</span>'
      + '<h3 id="upg-genom-t">' + esc(niva.titel) + '</h3>'
      + (niva.beskrivning ? '<p>' + esc(niva.beskrivning) + '</p>' : '')
      + '</div><ol class="upg-genom-lista">' + (data || []).map(q =>
        '<li class="forhand"><span class="upg-genom-typ">' + esc(TYPTEXT[q.typ]) + '</span>'
        + '<p class="upg-genom-fraga">' + esc(q.fraga) + '</p>'
        + (q.typ === 'val' ? '<p class="upg-genom-alt">' + (q.alternativ || []).map(a => esc(a)).join(' · ') + '</p>' : '')
        + (q.typ === 'ordna' && q.alternativ ? '<p class="upg-genom-alt">Extra brickor: ' + q.alternativ.map(a => esc(a)).join(' · ') + '</p>' : '')
        + '<p class="upg-genom-facit">Rätt svar: <b>' + esc(facit(q)) + '</b></p>'
        + (q.forklaring ? '<p class="upg-genom-varfor">' + esc(q.forklaring) + '</p>' : '')
        + '</li>').join('') + '</ol>');
  }

  /* ============================================================
     RADERNA
     ============================================================ */

  /* Resultatet på en digital uppgift, för raden i uppgiftslistan. */
  function uppgiftsResultat(h, forsok) {
    const mina = (forsok || []).filter(f => f.niva_id === h.niva_id && f.klar_at
      && Date.parse(f.klar_at) >= Date.parse(h.created_at || 0));
    if (!mina.length) return '';
    const bäst = mina.reduce((a, f) => (Number(f.stjarnor) || 0) > (Number(a.stjarnor) || 0) ? f : a, mina[0]);
    const först = mina[0];
    return '<div class="upg-resultat">' + stjärnRad(Number(bäst.stjarnor) || 0, 3, 'upg-stj-sm')
      + '<span>' + esc(först.ratt_direkt + ' av ' + först.antal + ' rätt första gången'
        + (mina.length > 1 ? ', ' + mina.length + ' försök' : '')) + '</span>'
      + '<button type="button" class="upg-lank" data-upg-genomgang="' + esc(först.id) + '">Se rättningen</button>'
      + '</div>';
  }

  /* Nivån en digital uppgift går ut på, och hur det gått. Samma rad
     hos familjen och studiehjälparen; bara knapparna under skiljer. */
  function digitalRad(h, forsok) {
    const n = h.nivaer;
    if (!n) return '';
    return '<div class="upg-digital">'
      + '<span class="upg-digital-ikon">' + IKON.spela + '</span>'
      + '<span class="upg-digital-text"><b>' + esc(n.titel) + '</b><span>'
      + esc(['Digital uppgift', n.omrade, n.antal_fragor ? n.antal_fragor + ' frågor' : ''].filter(Boolean).join(' · '))
      + '</span></span></div>'
      + uppgiftsResultat(h, forsok);
  }

  /* Ett klart försök som rad i listan Rättade uppgifter. */
  function försöksRad(f, niva) {
    const n = niva || { titel: 'Nivå', amne: '', omrade: '' };
    return '<div class="upg-forsok-rad">'
      + '<div class="upg-forsok-text"><b>' + esc(n.titel) + '</b>'
      + '<span>' + esc([n.amne ? n.amne.split(' / ')[0] : '', n.omrade, NX.datumText(String(f.klar_at).slice(0, 10))].filter(Boolean).join(' · ')) + '</span></div>'
      + '<div class="upg-forsok-tal">' + stjärnRad(Number(f.stjarnor) || 0, 3, 'upg-stj-sm')
      + '<span>' + esc(f.ratt_direkt + ' av ' + f.antal) + '</span></div>'
      + '<button type="button" class="btn btn-ghost btn-sm" data-upg-genomgang="' + esc(f.id) + '">Se rättningen</button>'
      + '</div>';
  }

  /* Rättningen per område som staplar, med studiehjälparens bedömning
     bredvid när samma område finns där. progress: rader ur
     progress_items. */
  function områdesHtml(katalog, forsok, progress) {
    const rader = perOmråde(katalog, forsok);
    if (!rader.length) return '';
    const bedömd = {};
    (progress || []).forEach(p => { bedömd[(p.subject + '|' + p.area).toLowerCase()] = p; });
    return '<div class="upg-omraden">' + rader.map(r => {
      const andel = r.antal ? Math.round(r.ratt / r.antal * 100) : 0;
      const p = bedömd[(r.amne + '|' + r.omrade).toLowerCase()];
      const nivå = andel >= 80 ? 'hog' : andel >= 60 ? 'mellan' : 'lag';
      return '<div class="upg-omrade">'
        + '<div class="upg-omrade-topp"><b>' + esc(r.omrade) + '</b><span>' + esc(r.amne.split(' / ')[0]) + '</span>'
        + '<strong class="' + nivå + '">' + andel + ' %</strong></div>'
        + '<span class="upg-omrade-mat ' + nivå + '" aria-hidden="true"><i style="width:' + andel + '%"></i></span>'
        + '<p>' + esc(r.ratt + ' av ' + r.antal + ' rätt första gången, i ' + r.nivåer + (r.nivåer === 1 ? ' nivå' : ' nivåer')
          + (r.klara < r.nivåer ? ' (' + r.klara + ' klarade)' : '')
          + (p ? '. Studiehjälparens bedömning: ' + NXStudie.stegText(NXStudie.stegFör(p)).toLowerCase() : '') + '.') + '</p>'
        + '</div>';
    }).join('') + '</div>';
  }

  return {
    IKON, STJÄRNGRÄNS,
    laddaKatalog, laddaFörsök, perNivå, banan, banor, förvaldÅrskurs, efterId,
    underlag, märken, veckoserie, perOmråde, perVecka, stjärnRad,
    ritaBana, ritaBelöningar, spela, genomgång, förhandsvisa,
    uppgiftsResultat, digitalRad, försöksRad, områdesHtml
  };
})();
