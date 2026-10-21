/* ============================================================
   NEXTRUM — adminvyn, Betalningar → Liggaren och Kortet (2026-10-21)

   LIGGAREN. Leo: en tabell betalningar med en rad per betalning, och en
   vy över den med återbetalning. Varje kortbetalning familjerna gjort
   står här, en rad per betalning i Stripe (betalningar, som databasen
   skriver när webhooken skrivit pengarna på sin rad): planer, timmar
   till en plan, Fyll timbanken, pass och tillägg. Raderna raderas
   aldrig, och det bokförda ändras aldrig härifrån: Återbetala går genom
   stripe-aterbetalning, som en återbetalning alltid gjort.

     · Ett pass betalas tillbaka som förut (data-aterbetala, lyssnaren i
       nextrum-admin-ekonomi.js), med beloppet att välja.
     · Ett köp av timmar betalas tillbaka helt eller med ett antal timmar
       (data-aterbetala-kop). Timmarna dras tillbaka, aldrig under det
       som använts, och beloppet räknas i databasen
       (klippkort_aterbetalning_lage): hela köpet är det villkoren lovar
       den som slutar, en del är timmarna till det pris familjen betalade.
     · Ett tillägg och en betalning utan rad (två kassor stod öppna)
       betalas tillbaka i Stripes dashboard; webhooken skriver det här.

   KORTET. Varje pass som betalas med det sparade kortet, med läget med
   Leos ord (ej försökt, reserverad, dragen, nekad, frigjord), och de
   nekade överst: när kortet nekades, hur många försök, och när nästa
   automatiska försök görs. Försök igen provar direkt
   (kortreservation_forsok_nu). Passet avbokas aldrig för att kortet
   nekas; efter ett dygn blir det en uppgift under Att göra.

   Bara superadmin: Betalningar är superadminens, och båda tabellerna
   släpper bara fram is_admin(). Före migrationerna står en rad om det.

   KORTEN (2026-10-21, Leo: "Snyggare kortsektion i betalningsvyn"): en
   betalning är ett kort med beloppet, läget i färg, familjen, typen,
   koden och dagen, och raderna den betalade: en betalning som bär en plan
   och tillägg (betalningsrader, syskontillägget) är ett kort med en rad
   per sak. Utan raderna är betalningen själv raden. Bara visning: det
   bokförda ändras aldrig härifrån.

   MARKERINGARNA (betalningar_dolda, 2026-10-21): en testbetalning som
   rensa-leo-testbetalning.sql dolt står bara under Dolda, och en riktig
   betalning märkt annullerad står kvar, i summorna, med märket Annullerad.
   ============================================================ */
(function () {
  'use strict';

  const { $, $$, esc, felText } = NX;
  const { medan } = NXStudie;
  const kronor = NXBetalning.kronor;
  const { S, fråga, funktionsFel, hämtaAlla, kortDatum, namnFör, pill, ärSuperadmin } = NXAdmin;

  const L = {
    rader: [], kort: [], inst: null, filter: 'alla', sök: '',
    saknas: false, fel: null, kortSaknas: false, kortFel: null,
    // betalningens rader per betalning, och markeringarna per betalning
    betRader: {}, dolda: {}
  };

  const TYP = { plan: 'Plan', timbank: 'Fyll timbanken', pass: 'Pass', tillagg: 'Tillägg' };
  /* Märkenas färger är adminvyns tre (.adm-status): mossa klart, ockra
     väntar, lera ert drag eller fel. Här stod 'klar', 'pa' och 'fel', som
     ingen regel hade, och märkena blev grå (2026-10-21). */
  const LÄGE = {
    betald: ['Betald', 'ar-klar'],
    delvis_aterbetald: ['Delvis tillbaka', 'ar-vantar'],
    aterbetald: ['Återbetald', ''],
    tvist: ['Tvist', 'ar-ny']
  };
  /* Kortets lägen med Leos namn (2026-10-21): ej försökt, reserverad,
     dragen (capturad), nekad (misslyckad), frigjord. Återbetald står på
     betalningen i Liggaren, inte på reservationen. */
  const KORT = {
    vald: ['Ej försökt', ''],
    reserverad: ['Reserverad', 'ar-vantar'],
    dragen: ['Dragen', 'ar-klar'],
    slapps: ['Släpps', ''],
    slappt: ['Frigjord', ''],
    utgangen: ['Gick ut, dras efter passet', 'ar-vantar'],
    misslyckad: ['Nekad', 'ar-ny']
  };
  const FILTER = [['alla', 'Alla'], ['plan', 'Planer'], ['timbank', 'Fyll timbanken'], ['pass', 'Pass'],
    ['tillagg', 'Tillägg'], ['tillbaka', 'Tillbaka'], ['test', 'Test'], ['dolda', 'Dolda']];

  /* Samma byggstenar som Alla betalningar (nextrum-admin-ekonomi.js). */
  const knapp = (attr, värde, text, primär) => '<button class="btn ' + (primär ? 'btn-primary' : 'btn-ghost')
    + ' btn-sm" type="button" ' + attr + '="' + esc(värde) + '">' + esc(text) + '</button>';
  const samKort = (rubrik, tal, under, gör) => '<div' + (gör ? ' class="ar-gor"' : '') + '><small>'
    + esc(rubrik) + '</small><b>' + esc(tal) + '</b><span>' + esc(under) + '</span></div>';
  function dagRuta(iso) {
    const d = String(iso || '').slice(0, 10).split('-').map(Number);
    if (!d[1]) return '<span class="eko-dag"><b>—</b></span>';
    return '<span class="eko-dag" aria-hidden="true"><b>' + d[2] + '</b><small>'
      + esc(NX.MANADER[d[1] - 1].slice(0, 3)) + '</small></span>';
  }
  const familjLänk = id => id ? '<button type="button" class="eko-lank" data-dp="familj:' + esc(id) + '">'
    + esc(namnFör(id)) + '</button>' : '';
  const saknasKod = fel => !!fel && (fel.code === 'PGRST205' || fel.code === '42P01' || fel.code === 'PGRST202');

  async function hämta() {
    const [l, k, i, br, bd] = await Promise.all([
      hämtaAlla('betalningar', '*', q => q.order('betald_at', { ascending: false })),
      hämtaAlla('kortreservationer', '*', q => q.order('andrad', { ascending: false }), 'booking_id'),
      supa.from('betalning_installning').select('*').maybeSingle(),
      // Betalningens rader och markeringarna; före migrationerna finns de inte, och korten klarar sig utan.
      hämtaAlla('betalningsrader', '*', q => q),
      hämtaAlla('betalningar_dolda', '*', q => q, 'betalning_id')
    ]);
    L.betRader = {};
    (br.error ? [] : (br.data || [])).forEach(x => { (L.betRader[x.betalning_id] = L.betRader[x.betalning_id] || []).push(x); });
    L.dolda = {};
    (bd.error ? [] : (bd.data || [])).forEach(x => { L.dolda[x.betalning_id] = x; });
    L.saknas = saknasKod(l.error);
    L.fel = l.error && !L.saknas ? felText(l.error) : null;
    L.rader = l.data || [];
    L.kortSaknas = saknasKod(k.error);
    L.kortFel = k.error && !L.kortSaknas ? felText(k.error) : null;
    L.kort = k.data || [];
    L.inst = i.error ? null : (i.data || null);
  }

  async function ritaLiggaren() {
    if (!ärSuperadmin() || !$('#lig-lista')) return;
    await hämta();
    rita();
    ritaKortet();
  }

  /* ---------- liggaren ---------- */
  function vad(r) {
    const pass = r.booking_id ? (S.bokningar || []).find(b => b.id === r.booking_id) : null;
    const köp = r.klippkort_id ? (S.klippkort || []).find(k => k.id === r.klippkort_id) : null;
    if (köp) return köp.namn || TYP[r.typ];
    if (pass) return TYP[r.typ] + ' ' + kortDatum(pass.wanted_date) + (pass.subject ? ', ' + pass.subject : '');
    return TYP[r.typ] || r.typ;
  }

  /* En testbetalning som skriptet dolt står bara under Dolda. En
     annullerad står kvar överallt: pengarna rörde sig. */
  const dold = r => !!L.dolda[r.id] && L.dolda[r.id].skal === 'test';

  /* Raderna betalningen betalade: betalningsrader när de finns, annars
     betalningen själv. */
  const RADVAD = { plan: 'Plan', timbank: 'Fyll timbanken', pass: 'Pass', tillagg: 'Tillägg för syskon' };
  function radVad(x) {
    const pass = x.booking_id ? (S.bokningar || []).find(b => b.id === x.booking_id) : null;
    const köp = x.klippkort_id ? (S.klippkort || []).find(k => k.id === x.klippkort_id) : null;
    if (köp) return köp.namn || RADVAD[x.typ] || x.typ;
    if (pass) return (RADVAD[x.typ] || x.typ) + ', pass ' + kortDatum(pass.wanted_date);
    return x.beskrivning || RADVAD[x.typ] || x.typ;
  }
  function raderFör(r) {
    const egna = L.betRader[r.id] || [];
    return egna.length
      ? egna.map(x => ({ typ: x.typ, vad: radVad(x), belopp: Number(x.belopp_ore || 0), kod: x.kod || null }))
      : [{ typ: r.typ, vad: vad(r), belopp: Number(r.belopp_ore || 0), kod: r.kod || null }];
  }

  function synlig(r) {
    if (L.filter === 'dolda') return dold(r);
    if (dold(r)) return false;
    if (L.filter === 'test' ? r.skarp !== false : L.filter !== 'alla' && r.skarp === false) return false;
    if (L.filter === 'tillbaka' && !(r.aterbetalt_ore > 0)) return false;
    if (TYP[L.filter] && r.typ !== L.filter) return false;
    if (!L.sök) return true;
    return [namnFör(r.familj), vad(r), r.kod, r.stripe_payment_intent].concat(raderFör(r).map(x => x.vad))
      .join(' ').toLowerCase().indexOf(L.sök) !== -1;
  }

  function radKnappar(r) {
    const kvar = Number(r.belopp_ore) - Number(r.aterbetalt_ore || 0);
    if (!(kvar > 0) || r.status === 'tvist') return '';
    if (r.utan_rad || r.typ === 'tillagg') return '<span class="eko-not">Betalas tillbaka i Stripe</span>';
    if (r.typ === 'pass' && r.booking_id && (S.bokningar || []).some(b => b.id === r.booking_id)) {
      return knapp('data-aterbetala', r.booking_id, 'Återbetala');
    }
    if ((r.typ === 'plan' || r.typ === 'timbank') && r.klippkort_id) {
      return knapp('data-aterbetala-kop', r.klippkort_id, 'Återbetala');
    }
    return '';
  }

  /* Ett kort per betalning: beloppet och läget överst, familjen och dagen,
     typen och koden, raderna, och knappen sist. Läget färgar kortets kant
     (lig-<status>), och märkena är adminvyns. */
  function rad(r) {
    const tillbaka = Number(r.aterbetalt_ore || 0);
    const läget = LÄGE[r.status] || [r.status, ''];
    const märkt = L.dolda[r.id];
    const knappar = radKnappar(r);
    const rader = raderFör(r);
    return '<article class="lig-kort lig-' + esc(r.status) + '" data-lig-rad="' + esc(r.id) + '">'
      + '<div class="lig-kort-topp">'
      + '<span class="lig-belopp"><b>' + esc(kronor(r.belopp_ore)) + '</b>'
      + (tillbaka > 0 ? '<small>' + esc(kronor(tillbaka)) + ' tillbaka</small>' : '') + '</span>'
      + '<span class="lig-lage">' + pill(läget[0], läget[1])
      + (r.skarp === false ? ' ' + pill('Test', '') : '')
      + (märkt && märkt.skal === 'annullerad' ? ' ' + pill('Annullerad', 'ar-ny') : '')
      + (märkt && märkt.skal === 'test' ? ' ' + pill('Dold', '') : '') + '</span>'
      + '</div>'
      + '<div class="lig-kort-vem">' + (familjLänk(r.familj) || '<span>Familj saknas</span>')
      + '<time datetime="' + esc(String(r.betald_at || '').slice(0, 10)) + '">' + esc(kortDatum(r.betald_at)) + '</time></div>'
      + '<div class="lig-kort-taggar"><span class="lig-typ" data-typ="' + esc(r.typ) + '">' + esc(TYP[r.typ] || r.typ) + '</span>'
      + (r.kod ? '<span class="lig-kod">Kod <code translate="no">' + esc(r.kod) + '</code></span>' : '')
      + (r.utan_rad ? '<span class="lig-varning">Inte nedskriven på sin rad</span>' : '')
      + '</div>'
      + '<ul class="lig-rader" aria-label="Det betalningen betalade">'
      + rader.map(x => '<li data-typ="' + esc(x.typ) + '"><span class="lig-rad-typ">' + esc(TYP[x.typ] || x.typ) + '</span>'
        // Raden säger inte typen två gånger (Fyll timbanken utan namn på köpet).
        + '<span class="lig-rad-vad">' + esc(x.vad === (TYP[x.typ] || x.typ) ? '' : x.vad)
        + (x.kod && rader.length > 1 ? ' · kod ' + esc(x.kod) : '') + '</span>'
        + '<b>' + esc(kronor(x.belopp)) + '</b></li>').join('')
      + '</ul>'
      + (knappar ? '<div class="lig-kort-fot">' + knappar + '</div>' : '')
      + '</article>';
  }

  function rita() {
    const host = $('#lig-lista'), sam = $('#lig-sam'), chips = $('#lig-chips'), fot = $('#lig-fot');
    if (L.saknas) {
      host.innerHTML = '<p class="vy-tom">Liggaren finns inte än: migrationen betalningsliggaren är inte körd.</p>';
      sam.innerHTML = ''; chips.innerHTML = ''; fot.textContent = '';
      return;
    }
    if (L.fel) { host.innerHTML = '<p class="vy-tom">Liggaren gick inte att hämta: ' + esc(L.fel) + '</p>'; return; }
    const skarpa = L.rader.filter(r => r.skarp !== false);
    const in_ = skarpa.reduce((t, r) => t + Number(r.belopp_ore || 0), 0);
    const ut = skarpa.reduce((t, r) => t + Number(r.aterbetalt_ore || 0), 0);
    sam.innerHTML = samKort('Inbetalt', kronor(in_), skarpa.length + (skarpa.length === 1 ? ' betalning' : ' betalningar'))
      + samKort('Tillbaka till familjer', kronor(ut), 'återbetalt')
      + samKort('Netto', kronor(in_ - ut), 'före Stripes avgifter');
    // Dolda står bara när något är dolt.
    const antalDolda = L.rader.filter(dold).length;
    chips.innerHTML = FILTER.filter(([k]) => k !== 'dolda' || antalDolda || L.filter === 'dolda')
      .map(([k, t]) => '<button type="button" class="chip" data-lig-filter="' + k
      + '" aria-pressed="' + (L.filter === k) + '">' + esc(t)
      + (k === 'dolda' ? ' <span class="eko-chip-tal">' + antalDolda + '</span>' : '') + '</button>').join('');
    const synliga = L.rader.filter(synlig);
    host.innerHTML = synliga.length ? synliga.map(rad).join('')
      : '<p class="vy-tom">' + (L.rader.length ? 'Inga betalningar som passar.' : 'Inga betalningar än.') + '</p>';
    fot.textContent = 'Ett kort per betalning i Stripe, skriven av databasen när webhooken skrivit pengarna. Raderna raderas '
      + 'aldrig: de är bokföringsunderlag i sju år. Testbetalningar räknas inte i summorna, och de som är dolda står under '
      + 'Dolda. En annullerad betalning står kvar i summorna tills den betalats tillbaka.';
  }

  /* ---------- kortet ---------- */
  function nästaFörsök(k) {
    const i = L.inst;
    if (!i || k.lage !== 'misslyckad' || Number(k.forsok) >= Number(i.automatiska_forsok)) return null;
    if (['authentication_required', 'card_authentication_required', 'expired_card', 'kortet_saknas'].indexOf(k.fel) !== -1) return null;
    return new Date(Date.parse(k.andrad) + Number(i.timmar_mellan_forsok) * 3600e3);
  }

  function kortRad(k) {
    const pass = (S.bokningar || []).find(b => b.id === k.booking_id);
    const läge = KORT[k.lage] || [k.lage, ''];
    const nästa = nästaFörsök(k);
    const meta = [familjLänk(k.parent_id)]
      .concat(k.fel ? ['Kod ' + esc(k.fel)] : [])
      .concat(k.forsok ? [esc(k.forsok + ' försök')] : [])
      .concat(k.nekad_sedan ? ['Nekad sedan ' + esc(kortDatum(k.nekad_sedan))] : [])
      .concat(nästa ? ['Nästa försök ' + esc(nästa.toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))] : []);
    const gör = k.lage === 'misslyckad' || k.lage === 'utgangen'
      ? knapp('data-kort-forsok', k.booking_id, 'Försök igen', k.lage === 'misslyckad') : '';
    const belopp = k.dragen_ore || k.reserverat_ore;
    return '<div class="eko-rad">'
      + dagRuta(pass ? pass.wanted_date : k.andrad)
      + '<span class="eko-mitt"><button type="button" class="eko-titel" data-dp="pass:' + esc(k.booking_id) + '">'
      + esc(pass ? 'Pass ' + kortDatum(pass.wanted_date) + (pass.subject ? ', ' + pass.subject : '') : 'Pass') + '</button>'
      + '<span class="eko-meta">' + meta.map(m => '<span>' + m + '</span>').join('') + '</span></span>'
      + '<span class="eko-atg">' + gör + '</span>'
      + '<span class="eko-lage">' + pill(läge[0], läge[1]) + '</span>'
      + '<span class="eko-belopp"><b>' + esc(belopp ? kronor(belopp) : '—') + '</b></span>'
      + '</div>';
  }

  function ritaKortet() {
    const host = $('#kd-lista'), sam = $('#kd-sam'), fot = $('#kd-fot');
    if (!host) return;
    if (L.kortSaknas) {
      host.innerHTML = '<p class="vy-tom">Kortet finns inte än: migrationen kortet_reserveras är inte körd.</p>';
      return;
    }
    if (L.kortFel) { host.innerHTML = '<p class="vy-tom">Kortets rader gick inte att hämta: ' + esc(L.kortFel) + '</p>'; return; }
    const nekade = L.kort.filter(k => k.lage === 'misslyckad');
    const väntar = L.kort.filter(k => k.lage === 'vald' || k.lage === 'reserverad' || k.lage === 'utgangen');
    sam.innerHTML = samKort('Nekade', String(nekade.length), nekade.length ? 'väntar på familjen eller ett nytt försök' : 'inga', nekade.length > 0)
      + samKort('Reserverade', String(L.kort.filter(k => k.lage === 'reserverad').length), 'dras när rapporten finns')
      + samKort('Väntar', String(väntar.length), 'valt, reserverat eller gått ut');
    const ordning = { misslyckad: 0, utgangen: 1, vald: 2, reserverad: 3, slapps: 4, dragen: 5, slappt: 6 };
    const rader = L.kort.slice().sort((a, c) => (ordning[a.lage] ?? 9) - (ordning[c.lage] ?? 9)
      || String(c.andrad).localeCompare(String(a.andrad)));
    host.innerHTML = rader.length ? rader.map(kortRad).join('') : '<p class="vy-tom">Inga pass betalas med kortet än.</p>';
    const i = L.inst;
    /* Strömbrytaren kortreservation står av sedan betala_nu (2026-10-21):
       familjen betalar med Betala nu, och jobbet släpper det som ändå står
       reserverat. Texten följer strömbrytaren (2026-10-21). */
    const på = !!(S.kortFlagga && S.kortFlagga.aktiv);
    fot.textContent = (på
      ? 'Kortet reserveras två dagar före passet och dras när rapporten är skriven.'
      : 'Kortet reserveras inte längre: familjen betalar varje pass med Betala nu. Här står reservationerna som fanns, '
        + 'och jobbet släpper dem som inte ska dras.')
      + ' Nekas en dragning försöker vi igen'
      + (i ? ' efter ' + i.timmar_mellan_forsok + ' timmar, högst ' + i.automatiska_forsok + ' försök' : '')
      + ', när koden säger att det kan gå, och efter ' + (i ? i.larm_efter_timmar : 24) + ' timmar blir det en uppgift '
      + 'under Att göra. Passet avbokas aldrig för att kortet nekas.';
  }

  /* ---------- knapparna ---------- */
  document.addEventListener('click', async e => {
    const f = e.target.closest('[data-lig-filter]');
    if (f) {
      L.filter = f.dataset.ligFilter;
      rita();
      return;
    }

    const fk = e.target.closest('[data-kort-forsok]');
    if (fk) {
      await medan(fk, 'Försöker…', async () => {
        const { data, error } = await supa.rpc('kortreservation_forsok_nu', { p_bokning: fk.dataset.kortForsok });
        if (error) { alert(felText(error)); return; }
        if (data !== 'vald') alert(data === 'betalas inte med kortet' ? 'Passet betalas inte längre med kortet.' : 'Det finns inget att försöka igen.');
        await ritaLiggaren();
      });
      return;
    }

    const åk = e.target.closest('[data-aterbetala-kop]');
    if (!åk) return;
    const kort = åk.dataset.aterbetalaKop;
    const hela = await supa.rpc('klippkort_aterbetalning_lage', { p_id: kort });
    if (hela.error) { alert(felText(hela.error)); return; }
    const l = hela.data || {};
    if (l.fel) { alert(l.fel); return; }
    const valt = await fråga({
      titel: 'Betala tillbaka ' + (l.namn || 'köpet') + '?',
      text: namnFör(l.familj) + '. Timmarna dras tillbaka, aldrig de som redan använts. Hela köpet räknas som villkoren '
        + 'säger för den som slutar: de använda timmarna till ordinarie timpris. En del är timmarna till det pris familjen '
        + 'betalade per timme. Stripes avgift kommer inte tillbaka.',
      innehåll: '<fieldset class="fgroup lig-val" style="margin:14px 0 0"><legend>Vad betalas tillbaka</legend>'
        + '<label class="lig-alt"><input type="radio" name="lig-hur" value="hela" checked> Hela köpet: '
        + esc(String(l.kvar_betalda)) + ' timmar, ' + esc(kronor(l.belopp_ore)) + '</label>'
        + (Number(l.kvar_betalda) > 1
          ? '<label class="lig-alt"><input type="radio" name="lig-hur" value="del"> Ett antal timmar, '
            + esc(kronor(l.per_timme_ore)) + ' per timme</label>'
            + '<div class="fgroup"><label for="lig-timmar">Timmar</label>'
            + '<input class="inp" id="lig-timmar" type="number" min="1" max="' + esc(String(Number(l.kvar_betalda) - 1))
            + '" step="1" value="1" inputmode="numeric"></div>'
          : '')
        + '</fieldset>'
        + (l.utgangen ? '<p class="xsmall" style="color:var(--bl-3);margin:8px 0 0">Köpet har gått ut. Villkoren '
          + 'lovar inte pengar för timmar som förfallit, så det här är ett val ni gör.</p>' : '')
        + '<div class="fgroup" style="margin:14px 0 0"><label for="lig-anledning">Anledning, för vår egen skull</label>'
        + '<input class="inp" id="lig-anledning" placeholder="t.ex. familjen slutar"></div>',
      knapp: 'Betala tillbaka',
      läs: ruta => {
        const hur = (ruta.querySelector('input[name="lig-hur"]:checked') || {}).value;
        const anledning = ((ruta.querySelector('#lig-anledning') || {}).value || '').trim();
        if (hur !== 'del') return { värde: { timmar: null, anledning } };
        const n = Number((ruta.querySelector('#lig-timmar') || {}).value);
        if (!Number.isInteger(n) || n < 1 || n >= Number(l.kvar_betalda)) {
          return { fel: 'Välj mellan 1 och ' + (Number(l.kvar_betalda) - 1) + ' timmar, eller hela köpet.' };
        }
        return { värde: { timmar: n, anledning } };
      }
    });
    if (!valt) return;
    await medan(åk, 'Betalar tillbaka…', async () => {
      const svar = await supa.functions.invoke('stripe-aterbetalning', {
        body: { klippkort: kort, timmar: valt.timmar, anledning: valt.anledning }
      });
      if (svar.error) { alert(await funktionsFel(svar.error)); return; }
      if (svar.data && svar.data.varning) alert(svar.data.varning);
      await ritaLiggaren();
    });
  });

  document.addEventListener('input', e => {
    const s = e.target.closest('#lig-sok');
    if (!s) return;
    L.sök = s.value.trim().toLowerCase();
    rita();
  });

  Object.assign(NXAdmin.rita, { ritaLiggaren });
})();
