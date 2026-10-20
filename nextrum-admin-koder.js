/* ============================================================
   NEXTRUM — adminvyn, Koder (2026-10-13)

   Leo: "i admin vyn ska du skapa en ny spalt, där ska koder synas,
   allas personliga kod ska synas där. först när jag klicka på koder så
   ska jag klickar om jag vill kolla på familjer eller studiehjälpare.
   när jag har valt ska koderna synas samt att hur många som använt
   personens kod."

   TVÅ SORTER, TVÅ FORMULÄR. En familjs kod skrivs i intresseanmälan
   och ger en timme i familjens timbank när den nya familjen haft två
   timmar läxhjälp. En studiehjälpares kod skrivs i jobbansökan och ger
   300 kr i lönen när vi tar in den som sökt. Databasen avgör vilken kod
   som gäller var (intern.leads_tipskod, intern.ansokan_tipskod) och
   räknar allt (koder_lage); här ritas det bara.

   ALLAS KOD. En kod skapades förut först när personen öppnade Tipsa i
   sin vy. koder_lage skapar de som saknas, så listan har en rad för
   varje familj och varje godkänd studiehjälpare. Därför hämtas den
   först när sektionen öppnas, och inte vid varje start av adminvyn.

   VILKA SOM ANVÄNT EN KOD ser bara admin: anmälningarna och
   ansökningarna står redan i S, och raden fäller ut dem med en länk till
   panelen. Den som tipsat ser antal, aldrig vilka (mina_tips).

   Adressen är #koder för valet och #koder/familjer eller
   #koder/studiehjalpare för listan, så att Tillbaka i webbläsaren går
   tillbaka till valet. Bara superadmin (BARA_SUPER i
   nextrum-admin-behorighet.js): koder_lage svarar bara admin.
   ============================================================ */
(function () {
  'use strict';

  const { $, esc, felText } = NX;
  const { bekräfta, medan, tomt } = NXStudie;
  const kronor = NXBetalning.kronor;
  const M = NXMedia;
  const { S, ANS_LAGE, LEAD_LAGE, kortDatum, namnFör, pill } = NXAdmin;

  const IKON = {
    familj: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8.5" cy="8" r="3"/><path d="M3 19c0-2.8 2.5-4.5 5.5-4.5S14 16.2 14 19"/><path d="M16 5.5a3 3 0 0 1 0 5.8M21 19c0-2.2-1.4-3.7-3.5-4.3"/></svg>',
    studiehjalpare: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h7v12H4z"/><path d="M13 6.5h7v12h-7z"/><path d="M11 9.5h2M11 13h2"/></svg>',
    pil: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    fall: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'
  };

  /* Adressens del efter #koder/ och databasens sort. */
  const SORT = {
    familjer: {
      sort: 'familj', namn: 'Familjer', en: 'familj', flagga: 'tipstimme',
      formulär: 'intresseanmälan',
      regel: 'En timme i timbanken för varje ny familj som anmält sig med koden och haft två timmar läxhjälp, '
        + 'också om en av timmarna var gratis. Timmen gäller i 60 dagar och dras först, som en timme på köpet på nästa pass.',
      kort: 'Koden skrivs i intresseanmälan. En timme i timbanken när den nya familjen haft två timmar läxhjälp.'
    },
    studiehjalpare: {
      sort: 'studiehjalpare', namn: 'Studiehjälpare', en: 'studiehjälpare', flagga: 'tipsbonus',
      formulär: 'jobbansökan',
      regel: '300 kr i lön, inklusive semesterersättning, för varje ny studiehjälpare som sökt jobb med koden och som '
        + 'vi tar in i poolen. Bonusen betalas med lönen för månaden hen togs in och står under Löner, med en egen rad i lönefilen.',
      kort: 'Koden skrivs i jobbansökan. 300 kr i lönen, inklusive semesterersättning, när vi tar in den som sökt.'
    }
  };

  /* Svaren från koder_lage per sort. undefined: inte hämtat, null: fel. */
  const K = {
    rader: { familj: undefined, studiehjalpare: undefined },
    fel: { familj: null, studiehjalpare: null },
    hämtas: null, hämtad: 0,
    filter: { familj: 'alla', studiehjalpare: 'alla' },
    sök: { familj: '', studiehjalpare: '' }
  };

  /* En gång när sektionen öppnas, och sedan inte oftare än varannan
     minut: ett byte mellan flikarna ska inte hämta om, och varje
     hämtning skapar de koder som saknas. tvinga efter en ändring. */
  function hämta(tvinga) {
    if (K.hämtas) return K.hämtas;
    if (!tvinga && K.hämtad && Date.now() - K.hämtad < 120000) return Promise.resolve();
    K.hämtad = Date.now();
    K.hämtas = Promise.all(['familj', 'studiehjalpare'].map(sort =>
      supa.rpc('koder_lage', { p_sort: sort }).then(svar => {
        if (svar.error) {
          K.fel[sort] = svar.error.code === 'PGRST202' || svar.error.code === '42883'
            ? 'Koderna står här när migrationen tipskoder_bonus_och_timbanken är körd.'
            : felText(svar.error);
          if (K.rader[sort] === undefined) K.rader[sort] = null;
        } else {
          K.fel[sort] = null;
          K.rader[sort] = svar.data || [];
        }
      }, fel => {
        K.fel[sort] = felText(fel);
        if (K.rader[sort] === undefined) K.rader[sort] = null;
      })
    )).then(() => { K.hämtas = null; });
    return K.hämtas;
  }

  /* ------------------------------------------------------------
     ADRESSEN
     ------------------------------------------------------------ */
  function var_() {
    const adress = String(location.hash || '').replace(/^#/, '');
    const [huvud, del] = adress.split('/');
    if (huvud !== 'koder') return null;
    return SORT[del] ? del : '';
  }

  /* ------------------------------------------------------------
     RÄKNINGEN
     ------------------------------------------------------------ */
  const tal = v => Number(v || 0);

  function summa(rader) {
    return rader.reduce((s, r) => {
      s.koder++;
      if (tal(r.anvanda)) s.använda++;
      s.anvanda += tal(r.anvanda);
      s.kunder += tal(r.kunder);
      s.belonade += tal(r.belonade);
      s.timmarAnvända += tal(r.timmar_anvanda);
      s.bonus += tal(r.bonus_ore);
      s.utbetalt += tal(r.bonus_utbetald_ore);
      if (!r.aktiv) s.avstängda++;
      return s;
    }, { koder: 0, använda: 0, anvanda: 0, kunder: 0, belonade: 0, timmarAnvända: 0, bonus: 0, utbetalt: 0, avstängda: 0 });
  }

  const n = (antal, en, fler) => antal + ' ' + (antal === 1 ? en : fler);

  /* Vilka som använt koden. Anmälningarna och ansökningarna står i S;
     ingen ny fråga behövs. En anmälan som flyttats till familjen
     (intagna_anmalningar, 2026-10-21) står som familjen, med
     anmälningsdagen. */
  const anmälningar = kod => (S.leads || []).filter(l => l.kod === kod)
    .concat((S.intagna || []).filter(i => i.kod === kod)
      .map(i => ({ id: i.id, intagen: true, kund_id: i.parent_id, created_at: i.anmald_at })))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const ansökningar = kod => (S.ansokningar || []).filter(a => a.kod === kod)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const bonusarFör = id => (S.tipsbonus || []).filter(b => b.studiehjalpare_id === id)
    .sort((a, b) => String(b.intjanad_at).localeCompare(String(a.intjanad_at)));

  const BONUS_LAGE = {
    utkast: ['Bonus, utkast', ''], godkand: ['Bonus godkänd', 'ar-vantar'],
    utbetald: ['Bonus utbetald', 'ar-klar'], struken: ['Bonus struken', '']
  };

  /* ------------------------------------------------------------
     VALET: familjer eller studiehjälpare
     ------------------------------------------------------------ */
  function ritaVal() {
    const host = $('#kod-val');
    if (!host) return;
    host.innerHTML = Object.keys(SORT).map(del => {
      const o = SORT[del];
      const rader = K.rader[o.sort];
      const s = rader ? summa(rader) : null;
      const siffror = rader === undefined ? '<span class="kod-val-tal">Hämtar</span>'
        : rader === null ? '<span class="kod-val-tal">Gick inte att hämta</span>'
        : '<span class="kod-val-tal"><b>' + s.koder + '</b> ' + (s.koder === 1 ? 'kod' : 'koder')
          + ' · <b>' + s.använda + '</b> använda'
          + (o.sort === 'familj'
            ? ' · <b>' + s.belonade + '</b> ' + (s.belonade === 1 ? 'timme' : 'timmar')
            : ' · <b>' + esc(kronor(s.bonus)) + '</b> i bonus')
          + '</span>';
      return '<a class="kod-val-kort" href="#koder/' + del + '">'
        + '<span class="kod-val-ik">' + IKON[o.sort] + '</span>'
        + '<span class="kod-val-text"><b>' + esc(o.namn) + '</b><span>' + esc(o.kort) + '</span>' + siffror + '</span>'
        + '<span class="kod-val-pil">' + IKON.pil + '</span>'
        + '</a>';
    }).join('');
  }

  /* ------------------------------------------------------------
     LISTAN för en sort
     ------------------------------------------------------------ */
  function kpi(värde, rubrik, under) {
    return '<div class="adm-kpi"><b>' + esc(String(värde)) + '</b><span>' + esc(rubrik) + '</span>'
      + (under ? '<span class="adm-kpi-diff">' + esc(under) + '</span>' : '') + '</div>';
  }

  function ritaTal(o, rader) {
    const host = $('#kod-tal');
    if (!host) return;
    if (!rader) { host.innerHTML = ''; return; }
    const s = summa(rader);
    host.innerHTML = kpi(s.koder, o.sort === 'familj' ? 'Familjer med kod' : 'Studiehjälpare med kod',
        s.avstängda ? n(s.avstängda, 'avstängd', 'avstängda') : 'alla aktiva')
      + (o.sort === 'familj'
        ? kpi(s.anvanda, 'Anmälningar med kod', n(s.använda, 'kod har använts', 'koder har använts'))
          + kpi(s.kunder, 'Nya familjer som blev kunder', 'av dem som anmält sig')
          + kpi(s.belonade, s.belonade === 1 ? 'Timme i timbanken' : 'Timmar i timbanken',
            s.timmarAnvända + ' ' + (s.timmarAnvända === 1 ? 'använd' : 'använda'))
        : kpi(s.anvanda, 'Ansökningar med kod', n(s.använda, 'kod har använts', 'koder har använts'))
          + kpi(s.kunder, 'Tagna in i poolen', 'som gett en bonus')
          + kpi(kronor(s.bonus), 'Bonus i lönen', kronor(s.utbetalt) + ' utbetalt'));
  }

  function ritaRegel(o) {
    const host = $('#kod-regel');
    if (!host) return;
    const f = o.flagga === 'tipstimme' ? S.tipsFlagga : S.bonusFlagga;
    host.innerHTML = '<div class="kod-regel">'
      + '<span class="vy-rad-ik' + (f && f.aktiv ? ' ar-mossa' : ' ar-tyst') + '">' + IKON[o.sort] + '</span>'
      + '<span class="kod-regel-text"><b>' + (o.sort === 'familj' ? 'Belöningen för en familjs tips' : 'Bonusen för en studiehjälpares tips')
      + ' ' + (f ? pill(f.aktiv ? 'På' : 'Av', f.aktiv ? 'ar-klar' : '') : '') + '</b>'
      + '<span>' + esc(o.regel) + '</span>'
      + '<span class="kod-regel-not">Koden gäller bara ' + esc(o.formulär) + '. '
      + (o.sort === 'familj' ? 'En studiehjälpares kod blir tom där.' : 'En familjs eller en affischs kod blir tom där.')
      + (f ? ' Ändrad ' + esc(kortDatum(f.uppdaterad)) + '.' : '') + '</span>'
      + '</span>'
      + (f ? '<span class="kod-regel-knapp"><button class="btn ' + (f.aktiv ? 'btn-ghost' : 'btn-primary') + ' btn-sm" type="button"'
        + ' data-koder-flagga="' + esc(o.flagga) + '" data-pa="' + (f.aktiv ? '0' : '1') + '">'
        + (f.aktiv ? 'Stäng av' : 'Slå på') + '</button></span>' : '')
      + '</div>';
  }

  const FILTER = [
    ['alla', 'Alla'], ['anvanda', 'Använda'], ['belonade', 'Med belöning'], ['avstangda', 'Avstängda']
  ];
  const passar = (r, f) => f === 'anvanda' ? tal(r.anvanda) > 0
    : f === 'belonade' ? tal(r.belonade) > 0
    : f === 'avstangda' ? !r.aktiv : true;

  function ritaChips(o, rader) {
    const host = $('#kod-chips');
    if (!host) return;
    const valt = K.filter[o.sort];
    host.innerHTML = FILTER.map(([k, t]) => '<button type="button" class="chip" data-koder-filter="' + k + '"'
      + ' aria-pressed="' + (k === valt) + '">' + esc(t)
      + ' <span class="eko-chip-tal">' + (rader || []).filter(r => passar(r, k)).length + '</span></button>').join('');
  }

  function siffra(värde, text, klass) {
    return '<span class="kod-siffra' + (klass ? ' ' + klass : '') + '"><b>' + esc(String(värde)) + '</b> ' + esc(text) + '</span>';
  }

  function vilka(o, r) {
    if (o.sort === 'familj') {
      const lista = anmälningar(r.kod);
      return '<p class="kod-del">Anmälningar med koden</p>'
        + (lista.length ? '<ul class="kod-vilka">' + lista.map(l => '<li>'
          + (l.intagen
            ? (l.kund_id
              ? '<button type="button" class="eko-lank" data-dp="familj:' + esc(l.kund_id) + '">' + esc(namnFör(l.kund_id)) + '</button>'
              : '<span>Raderad familj</span>')
            : '<button type="button" class="eko-lank" data-dp="anmalan:' + esc(l.id) + '">' + esc(l.parent_name || 'Anmälan') + '</button>')
          + '<span class="kod-vilka-nar">' + esc(kortDatum(l.created_at)) + '</span>'
          + (l.kund_id ? pill('Kund', 'ar-klar') : pill((LEAD_LAGE[l.status] || [l.status || '—'])[0], (LEAD_LAGE[l.status] || [])[1] || ''))
          + '</li>').join('') + '</ul>'
          : '<p class="kod-tom">Ingen har anmält sig med koden än.</p>');
    }
    const lista = ansökningar(r.kod);
    const bonusar = bonusarFör(r.person_id);
    return '<p class="kod-del">Ansökningar med koden</p>'
      + (lista.length ? '<ul class="kod-vilka">' + lista.map(a => {
          const b = bonusar.find(x => x.ansokan_id === a.id);
          return '<li>'
            + '<button type="button" class="eko-lank" data-dp="ansokan:' + esc(a.id) + '">' + esc(a.name || 'Ansökan') + '</button>'
            + '<span class="kod-vilka-nar">' + esc(kortDatum(a.created_at)) + '</span>'
            + (b ? pill((BONUS_LAGE[b.status] || [b.status])[0] + ', ' + kronor(b.belopp_ore), (BONUS_LAGE[b.status] || [])[1] || '')
              : pill((ANS_LAGE[a.status] || [a.status || '—'])[0], (ANS_LAGE[a.status] || [])[1] || ''))
            + '</li>';
        }).join('') + '</ul>'
        : '<p class="kod-tom">Ingen har sökt jobb med koden än.</p>')
      /* En bonus vars ansökan gallrats står kvar: den är lön. */
      + (bonusar.some(b => !b.ansokan_id || !lista.some(a => a.id === b.ansokan_id))
        ? '<p class="kod-del">Bonus för ansökningar som gallrats</p><ul class="kod-vilka">'
          + bonusar.filter(b => !b.ansokan_id || !lista.some(a => a.id === b.ansokan_id)).map(b => '<li>'
            + (b.ny_studiehjalpare_id
              ? '<button type="button" class="eko-lank" data-dp="studiehjalpare:' + esc(b.ny_studiehjalpare_id) + '">'
                + esc(namnFör(b.ny_studiehjalpare_id)) + '</button>'
              : '<span>Kontot finns inte längre</span>')
            + '<span class="kod-vilka-nar">' + esc(kortDatum(b.intjanad_at)) + '</span>'
            + pill((BONUS_LAGE[b.status] || [b.status])[0] + ', ' + kronor(b.belopp_ore), (BONUS_LAGE[b.status] || [])[1] || '')
            + '</li>').join('') + '</ul>'
        : '');
  }

  function rad(o, r) {
    const p = S.personer[r.person_id] || {};
    const namn = namnFör(r.person_id);
    const siffror = o.sort === 'familj'
      ? siffra(tal(r.anvanda), tal(r.anvanda) === 1 ? 'anmäld' : 'anmälda')
        + siffra(tal(r.kunder), tal(r.kunder) === 1 ? 'kund' : 'kunder')
        + siffra(tal(r.belonade), tal(r.belonade) === 1 ? 'timme' : 'timmar', tal(r.belonade) ? 'ar-belonad' : '')
      : siffra(tal(r.anvanda), tal(r.anvanda) === 1 ? 'ansökan' : 'ansökningar')
        + siffra(tal(r.kunder), 'intagna')
        + siffra(kronor(tal(r.bonus_ore)), 'bonus', tal(r.bonus_ore) ? 'ar-belonad' : '');
    const under = o.sort === 'familj' && tal(r.belonade)
      ? tal(r.timmar_anvanda) + ' av ' + n(tal(r.belonade), 'timme', 'timmar') + ' använda'
      : o.sort === 'studiehjalpare' && tal(r.bonus_ore)
        ? kronor(tal(r.bonus_utbetald_ore)) + ' av ' + kronor(tal(r.bonus_ore)) + ' utbetalt'
        : '';
    return '<details class="kod-rad" data-kod="' + esc(r.kod) + '">'
      + '<summary>'
      + '<span class="kod-person">' + M.avatar(namn, null, { liten: true })
      + '<span class="kod-person-text"><b>' + esc(namn) + '</b><span>' + esc(p.email || '') + '</span></span></span>'
      + '<span class="kod-kod"><code translate="no">' + esc(r.kod) + '</code></span>'
      + '<span class="kod-siffror">' + siffror + (under ? '<span class="kod-under">' + esc(under) + '</span>' : '') + '</span>'
      + '<span class="kod-lage">' + (r.aktiv ? pill('Aktiv', 'ar-klar') : pill('Avstängd', ''))
      + '<span class="kod-fall">' + IKON.fall + '</span></span>'
      + '</summary>'
      + '<div class="kod-kropp">'
      + vilka(o, r)
      + '<div class="kod-atg">'
      + '<button type="button" class="btn btn-ghost btn-sm" data-dp="' + (o.sort === 'familj' ? 'familj' : 'studiehjalpare') + ':'
      + esc(r.person_id) + '">Öppna ' + esc(o.sort === 'familj' ? 'familjen' : 'studiehjälparen') + '</button>'
      + '<button type="button" class="btn btn-ghost btn-sm" data-koder-kopiera="' + esc(r.kod) + '">Kopiera koden</button>'
      + '<button type="button" class="btn btn-ghost btn-sm" data-koder-vaxla="' + esc(r.kod) + '" data-pa="' + (r.aktiv ? '0' : '1') + '">'
      + (r.aktiv ? 'Stäng av koden' : 'Slå på koden') + '</button>'
      + '</div>'
      + '</div>'
      + '</details>';
  }

  function ritaRader(o, rader) {
    const host = $('#kod-lista');
    if (!host) return;
    if (rader === undefined) { NXStudie.laddarFörsta(host); return; }
    if (rader === null) { host.innerHTML = tomt('Koderna gick inte att hämta', K.fel[o.sort] || ''); return; }
    const sök = K.sök[o.sort].trim().toLowerCase();
    const filter = K.filter[o.sort];
    const urval = rader.filter(r => passar(r, filter)).filter(r => {
      if (!sök) return true;
      const p = S.personer[r.person_id] || {};
      return [namnFör(r.person_id), p.email, r.kod].some(v => String(v || '').toLowerCase().includes(sök));
    }).sort((a, b) => (tal(b.anvanda) - tal(a.anvanda)) || (tal(b.belonade) - tal(a.belonade))
      || namnFör(a.person_id).localeCompare(namnFör(b.person_id), 'sv'));
    const öppna = new Set(Array.from(host.querySelectorAll('details.kod-rad[open]')).map(d => d.dataset.kod));
    host.innerHTML = urval.length
      ? '<div class="kod-lista">' + urval.map(r => rad(o, r)).join('') + '</div>'
      : tomt(sök ? 'Ingen kod matchar sökningen' : filter !== 'alla' ? 'Inga koder här' : 'Inga koder än',
        sök || filter !== 'alla' ? 'Välj Alla, eller sök på något annat.'
          : o.sort === 'familj' ? 'Varje familj med konto får en kod.' : 'Varje godkänd studiehjälpare får en kod.');
    /* En rad som var utfälld står kvar utfälld efter en ny hämtning. */
    öppna.forEach(kod => {
      const d = host.querySelector('details.kod-rad[data-kod="' + CSS.escape(kod) + '"]');
      if (d) d.open = true;
    });
  }

  function ritaFlikar(del) {
    const host = $('#kod-flikar');
    if (!host) return;
    host.innerHTML = Object.keys(SORT).map(k => '<a class="vy-flik" role="tab" href="#koder/' + k + '"'
      + ' aria-selected="' + (k === del) + '">' + esc(SORT[k].namn) + '</a>').join('');
  }

  /* ------------------------------------------------------------
     RITNINGEN
     ------------------------------------------------------------ */
  function ritaKoderna() {
    const valHost = $('#kod-val'), vyHost = $('#kod-vy');
    if (!valHost || !vyHost) return;
    const del = var_();
    const visaLista = !!del;
    valHost.hidden = visaLista;
    vyHost.hidden = !visaLista;
    if (!visaLista) { ritaVal(); return; }
    const o = SORT[del];
    const rader = K.rader[o.sort];
    ritaFlikar(del);
    ritaTal(o, rader);
    ritaRegel(o);
    ritaChips(o, rader);
    const sök = $('#kod-sok');
    if (sök && sök.value !== K.sök[o.sort]) sök.value = K.sök[o.sort];
    ritaRader(o, rader);
  }

  /* Sektionen hämtar när den öppnas, och ritar om när svaret kommit.
     Valet och listan ritas direkt med det som finns. */
  /* Bara superadmin (koder_lage svarar bara admin): en admin med
     behörigheter som skriver #koder i adressen ska inte ge ett nekat
     anrop i API-loggen. */
  const får = () => !S.behorighet || S.behorighet.superadmin;

  function öppnad() {
    if (var_() === null || !får()) return;
    ritaKoderna();
    hämta().then(ritaKoderna);
  }

  window.addEventListener('hashchange', öppnad);

  document.addEventListener('input', e => {
    if (e.target.id !== 'kod-sok') return;
    const del = var_();
    if (!del) return;
    K.sök[SORT[del].sort] = e.target.value;
    ritaRader(SORT[del], K.rader[SORT[del].sort]);
  });

  document.addEventListener('click', async e => {
    const filter = e.target.closest('[data-koder-filter]');
    if (filter) {
      const del = var_();
      if (!del) return;
      const o = SORT[del];
      K.filter[o.sort] = filter.dataset.koderFilter;
      /* Listan kan bli mycket kortare: hållLista, som Månadens ekonomi. */
      NXStudie.hållLista($('#kod-lista'), $('#kod-chips'), () => { ritaChips(o, K.rader[o.sort]); ritaRader(o, K.rader[o.sort]); });
      return;
    }

    const kopiera = e.target.closest('[data-koder-kopiera]');
    if (kopiera) {
      const kod = kopiera.dataset.koderKopiera;
      const klart = text => { kopiera.textContent = text; setTimeout(() => { kopiera.textContent = 'Kopiera koden'; }, 2000); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(kod).then(() => klart('Kopierad'), () => klart(kod));
      } else {
        klart(kod);
      }
      return;
    }

    const växla = e.target.closest('[data-koder-vaxla]');
    if (växla) {
      const kod = växla.dataset.koderVaxla;
      const på = växla.dataset.pa === '1';
      const ja = await bekräfta({
        titel: på ? 'Slå på koden ' + kod + '?' : 'Stäng av koden ' + kod + '?',
        text: på
          ? 'Koden följer med en anmälan eller ansökan igen från och med nu.'
          : 'En anmälan eller ansökan med koden går in som förut, men utan koden. Det som redan tjänats in med den står kvar.',
        knapp: på ? 'Slå på' : 'Stäng av'
      });
      if (!ja) return;
      await medan(växla, på ? 'Slår på…' : 'Stänger av…', async () => {
        const { data, error } = await supa.from('tipskoder').update({ aktiv: på }).eq('kod', kod).select('kod');
        if (error) { alert('Kunde inte ändra koden: ' + felText(error)); return; }
        if (!data || !data.length) { alert('Koden ändrades inte. Ladda om sidan och försök igen.'); return; }
        await hämta(true);
      });
      ritaKoderna();
      return;
    }

    const flagga = e.target.closest('[data-koder-flagga]');
    if (flagga) {
      const kod = flagga.dataset.koderFlagga;
      const på = flagga.dataset.pa === '1';
      const timme = kod === 'tipstimme';
      const ja = await bekräfta({
        titel: timme ? (på ? 'Slå på timmen för tips?' : 'Stäng av timmen för tips?')
          : (på ? 'Slå på bonusen för tips?' : 'Stäng av bonusen för tips?'),
        text: timme
          ? (på
            ? 'Från och med nu får en familj en timme i timbanken för varje ny familj som anmält sig med familjens kod och haft två timmar läxhjälp. Villkoren ska säga det.'
            : 'En familj som tipsats efter i dag ger ingen timme. Timmar som redan tjänats in ges ändå, för villkoren lovade dem. Villkoren ska ändras i samma veva.')
          : (på
            ? 'Från och med nu får en studiehjälpare 300 kr i lönen, inklusive semesterersättning, för varje ny studiehjälpare som sökt jobb med hens kod och som vi tar in i poolen. Villkoren ska säga det.'
            : 'Den som tas in i poolen efter i dag ger ingen bonus. Bonusar som redan tjänats in står kvar under Löner och betalas. Villkoren ska ändras i samma veva.'),
        knapp: på ? 'Slå på' : 'Stäng av'
      });
      if (!ja) return;
      await medan(flagga, på ? 'Slår på…' : 'Stänger av…', async () => {
        const { error } = await supa.from('flaggor').update({ aktiv: på }).eq('kod', kod);
        if (error) { alert('Kunde inte ändra strömbrytaren: ' + felText(error)); return; }
        // Läses tillbaka: en nekad uppdatering ger noll rader, inget fel.
        const { data } = await supa.from('flaggor').select('*').eq('kod', kod).maybeSingle();
        if (data) {
          if (timme) S.tipsFlagga = data; else S.bonusFlagga = data;
        }
      });
      ritaKoderna();
      if (typeof NXAdmin.rita.ritaInställningar === 'function') NXAdmin.rita.ritaInställningar();
    }
  });

  /* Vid start: valet ritas, och står adressen redan på #koder hämtas
     listan. */
  function ritaKodsidan() {
    ritaKoderna();
    if (var_() !== null && får()) hämta().then(ritaKoderna);
  }

  Object.assign(NXAdmin.rita, { ritaKodsidan });
})();
