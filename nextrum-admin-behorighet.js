/* ============================================================
   NEXTRUM — adminvyn: behörigheterna och adminhanteringen
   (barnkonton_och_admin)

   TVÅ SAKER I EN FIL

   1. Vad den inloggade får se. En superadmin får hela vyn, som förut.
      En admin med vissa behörigheter får bara sektionerna och flikarna
      som hör till dem; resten ritas aldrig och går inte att nå med en
      adress. Det är bekvämlighet, inte skydd: varje fråga går med samma
      nyckel som förut, och databasen svarar med tomma listor och nekade
      skrivningar för det behörigheten inte täcker (RLS, har_behorighet).

   2. System → Adminhantering: vilka som är admins och vad var och en
      får, en inbjudan till en ny person (edge-funktionen admin-skapa),
      en befintlig användare som blir admin (gor_till_admin), ändringar,
      borttagning (ta_bort_admin) och loggen (admin_logg). Reglerna står
      i databasen, i triggern admin_roller_vakt: ingen ändrar sig själv,
      ingen ger det den inte har, bara en superadmin gör någon till
      superadmin, och den sista superadminen går inte att ta bort. Vyn
      visar reglerna i förväg, så att knappen inte finns där databasen
      ändå säger nej.
   ============================================================ */
(function () {
  'use strict';

  const { $, $$, esc, säg, rensa, felText } = NX;
  const { bekräfta, medan, tomt } = NXStudie;
  const { S, funktionsFel, fråga, kortDatum, pill, ärRaderad } = NXAdmin;

  /* Samma nio som i databasen (intern.admin_behorigheter) och i
     _delad/adminbehorighet.ts. verktyg/kolla-behorigheter.py ser att
     de tre listorna är lika. */
  const BEHORIGHETER = [
    ['leads', 'Intresseanmälningar', 'Läsa och hantera familjernas intresseanmälningar.'],
    ['matchning', 'Matchning', 'Se elever, studiehjälpare och deras tider, och matcha en elev med en studiehjälpare.'],
    ['anvandare_las', 'Läsa användare', 'Se familjer, elever och studiehjälpare med kontaktuppgifter.'],
    ['anvandare_redigera', 'Ändra användare', 'Rätta familjers, elevers och studiehjälpares uppgifter. Kräver Läsa användare.'],
    ['studiehjalpare_godkann', 'Godkänna studiehjälpare', 'Godkänna en studiehjälpare och välja om profilen syns på sajten.'],
    ['bokningar_las', 'Läsa bokningar', 'Se alla pass med namn och tider, men inte ändra dem.'],
    ['rapporter_las', 'Läsa rapporter', 'Läsa lektionsrapporterna under Elever.'],
    ['notiskonfig', 'Notiser', 'Styra notisernas drift, se kön och felen, och slå på eller av mejl och SMS.'],
    ['admin_hantera', 'Hantera admins', 'Bjuda in och ta bort admins och ge dem de behörigheter du själv har.']
  ];
  const NAMN = Object.fromEntries(BEHORIGHETER.map(([kod, namn]) => [kod, namn]));
  const SUPER_VARNING = 'En superadmin kommer åt allt i adminvyn, också betalningar, löner, chattar, '
    + 'raderingen och systemet, och kan göra andra till superadmin. Ge det bara till den som driver bolaget.';

  /* ============================================================
     1. VAD DEN INLOGGADE FÅR SE
     ============================================================ */

  /* Sektion → behörigheterna som öppnar den. Saknas sektionen här är
     den bara för en superadmin. Listorna följer policyerna i
     migrationen: den som kan läsa eleverna ser Elever, och så vidare. */
  const SEKTIONER = {
    leads: ['leads'],
    familjer: ['anvandare_las', 'anvandare_redigera', 'matchning'],
    elever: ['anvandare_las', 'anvandare_redigera', 'matchning', 'bokningar_las', 'rapporter_las'],
    studiehjalpare: ['anvandare_las', 'anvandare_redigera', 'matchning', 'studiehjalpare_godkann'],
    matchning: ['matchning'],
    bokningar: ['bokningar_las'],
    system: ['admin_hantera', 'notiskonfig']
  };
  /* Flikarna i en sektion som en begränsad admin ser. En flik som inte
     står här är superadminens, också i en sektion som syns. */
  const FLIKAR = {
    system: { adminanvandare: ['admin_hantera'], notiser: ['notiskonfig'] },
    bokningar: { lista: ['bokningar_las'], kalender: ['bokningar_las'] }
  };
  /* Det start() ritar, och vem som behöver det. Det som inte står här
     ritas bara för en superadmin; för de andra blir funktionen tom, så
     att inget område frågar databasen om det den ändå inte får läsa. */
  const RITA = {
    ritaLeads: SEKTIONER.leads,
    ritaFamiljer: SEKTIONER.familjer,
    ritaElever: SEKTIONER.elever,
    ritaStudiehjalpare: SEKTIONER.studiehjalpare,
    ritaMatchning: SEKTIONER.matchning,
    ritaBokningar: SEKTIONER.bokningar,
    ritaKalender: SEKTIONER.bokningar,
    ritaNotisdrift: ['notiskonfig'],
    ritaAdminhantering: ['admin_hantera'],
    ritaDetalj: null, stängDetalj: null, byggFlöde: null, visaRadering: null
  };
  const BARA_SUPER = ['ritaÖversikt', 'ritaStatistik', 'ritaAnsokningar', 'ritaKontakt', 'ritaChattar',
    'ritaLektioner', 'ritaUppdrag', 'ritaUppgifter', 'ritaBibliotek', 'ritaFakturor', 'ritaUtbetalningar',
    'ritaKortbetalningar', 'ritaAvvikelser', 'fyllPerioder', 'ritaMånaden', 'ritaLöner', 'ritaIntegrationer',
    'ritaPris', 'ritaTjanster', 'ritaRabattkoder', 'ritaKoder', 'ritaFel', 'ritaInstallningar', 'ritaDokument',
    'ritaAudit', 'ritaAutomationer', 'ritaMaskinUppgifter', 'ritaAI', 'ritaFörslag', 'ritaDriftlogg',
    'laddaOmEkonomi', 'ritaAttGöra', 'ritaBokslut', 'laddaBokslut'];

  function har(lista) {
    const b = S.behorighet;
    if (!b) return false;
    if (b.superadmin) return true;
    return (lista || []).some(x => b.behorigheter.indexOf(x) !== -1);
  }

  /* Den inloggades roll ur databasen. Saknas funktionen (migrationen är
     inte körd) gäller det som gällde förut: is_admin är allt. Ett nätfel
     ger samma svar; databasen frågar ändra inte vyn om lov. */
  async function läsBehörighet() {
    try {
      const svar = await supa.rpc('mina_behorigheter');
      if (!svar.error && svar.data) {
        const d = svar.data;
        return { admin: !!d.admin, superadmin: !!d.superadmin, migrerad: true,
                 behorigheter: Array.isArray(d.behorigheter) ? d.behorigheter : [] };
      }
    } catch (e) { /* som om funktionen saknades */ }
    const full = !!(S.profil && S.profil.is_admin);
    return { admin: full, superadmin: full, behorigheter: [], migrerad: false };
  }

  function tillåten(sek) {
    if (!S.behorighet || S.behorighet.superadmin) return true;
    return !!SEKTIONER[sek] && har(SEKTIONER[sek]);
  }

  function förstaSektion() {
    const a = $$('#vy-sido a[data-sek]').find(x => tillåten(x.dataset.sek));
    return a ? a.dataset.sek : 'oversikt';
  }

  /* Körs före flikarna och menyn byggs, bara för en begränsad admin. */
  function begränsaVyn() {
    if (!S.behorighet || S.behorighet.superadmin) return;

    Object.entries(FLIKAR).forEach(([sek, flikar]) => {
      const sektion = $('section[data-sek="' + sek + '"]');
      if (!sektion) return;
      $$('.vy-flik', sektion).forEach(k => {
        const krav = flikar[k.dataset.flik];
        if (krav && har(krav)) return;
        const panel = $('.vy-flik-panel[data-flik="' + k.dataset.flik + '"]', sektion);
        if (panel) panel.remove();
        k.remove();
      });
    });

    Object.keys(NXAdmin.rita).forEach(namn => {
      const krav = RITA[namn];
      if (krav === null) return;
      if (krav ? !har(krav) : BARA_SUPER.indexOf(namn) !== -1) NXAdmin.rita[namn] = () => {};
    });

    /* Rutor som läser det bara en superadmin får läsa. Tips och
       kampanjer stod under Intresseanmälningar, som en admin med
       behörigheten leads ser; sedan 2026-10-06 står den under Tjänster,
       som bara superadmin ser, och attributet är en andra spärr. */
    $$('[data-bara-super]').forEach(el => el.remove());

    document.body.classList.add('adm-begransad');
  }

  /* En rubrik i menyn utan en enda synlig post under sig göms. */
  function städaMenyn() {
    const nav = $('#vy-sido');
    if (!nav) return;
    let rubrik = null, synlig = false;
    const stäng = () => { if (rubrik) rubrik.hidden = !synlig; };
    Array.from(nav.children).forEach(el => {
      if (el.classList.contains('vy-sido-rubrik')) { stäng(); rubrik = el; synlig = false; return; }
      if (el.matches('a[data-sek]') && !el.hidden) synlig = true;
    });
    stäng();
  }

  function rollText() {
    const b = S.behorighet;
    if (!b || !b.admin) return '';
    return b.superadmin && b.migrerad ? 'Superadmin' : 'Admin';
  }

  /* ============================================================
     2. ADMINHANTERINGEN
     ============================================================ */
  const AH = { roller: null, fel: null, logg: null, loggFel: null, ändrar: null, vald: null };

  async function hämtaRoller() {
    const [r, l] = await Promise.all([
      supa.from('admin_roller').select('user_id, ar_superadmin, behorigheter, skapad_av, skapad_at, andrad_at')
        .order('skapad_at'),
      supa.from('admin_logg').select('id, tid, aktor, handling, mal_anvandare, detaljer')
        .order('tid', { ascending: false }).limit(60)
    ]);
    AH.fel = r.error ? r.error : null;
    AH.roller = r.error ? null : (r.data || []);
    AH.loggFel = l.error ? felText(l.error) : null;
    AH.logg = l.error ? [] : (l.data || []);
  }

  function personNamn(id) {
    const p = S.personer[id];
    if (!p) return 'Okänt konto';
    return p.full_name || p.email || 'Okänt konto';
  }
  function personEpost(id) {
    const p = S.personer[id];
    return p && p.email && p.email !== p.full_name ? p.email : '';
  }

  const jag = () => S.user && S.user.id;
  const ärSuper = () => !!(S.behorighet && S.behorighet.superadmin);
  const minaBehorigheter = () => (S.behorighet && S.behorighet.behorigheter) || [];

  /* Samma regler som admin_roller_vakt, för att kunna säga dem i förväg.
     Databasen prövar dem igen. */
  function kanÄndra(r) {
    if (!r || r.user_id === jag()) return { ja: false, varför: 'Din egen roll ändras av någon annan.' };
    if (ärSuper()) {
      if (r.ar_superadmin && antalSuper() <= 1) {
        return { ja: false, varför: 'Den sista superadminen. Gör någon annan till superadmin först.' };
      }
      return { ja: true };
    }
    if (r.ar_superadmin) return { ja: false, varför: 'En superadmin ändras bara av en superadmin.' };
    const mina = minaBehorigheter();
    if (!(r.behorigheter || []).every(b => mina.indexOf(b) !== -1)) {
      return { ja: false, varför: 'Har behörigheter du inte har. Ändras av en superadmin.' };
    }
    return { ja: true };
  }

  function antalSuper() { return (AH.roller || []).filter(r => r.ar_superadmin).length; }

  /* Kryssrutorna för behörigheterna. En som den inloggade inte själv
     har står avstängd, med skälet, i stället för att saknas: då syns
     det att den finns och vem man ska fråga. */
  function väljare(prefix, valda, superadmin) {
    const mina = minaBehorigheter();
    const rutor = BEHORIGHETER.map(([kod, namn, text]) => {
      const kan = ärSuper() || mina.indexOf(kod) !== -1;
      const id = prefix + '-' + kod;
      return '<label class="ah-val' + (kan ? '' : ' ar-av') + '" for="' + esc(id) + '">'
        + '<input type="checkbox" id="' + esc(id) + '" data-ah-beh="' + esc(kod) + '"'
        + ((valda || []).indexOf(kod) !== -1 ? ' checked' : '')
        + (kan && !superadmin ? '' : ' disabled') + '>'
        + '<span><b>' + esc(namn) + '</b><span class="adm-und">' + esc(text)
        + (kan ? '' : ' Du har den inte själv.') + '</span></span></label>';
    }).join('');
    const sup = ärSuper()
      ? '<label class="ah-val ah-super" for="' + esc(prefix) + '-super">'
        + '<input type="checkbox" id="' + esc(prefix) + '-super" data-ah-super' + (superadmin ? ' checked' : '') + '>'
        + '<span><b>Superadmin</b><span class="adm-und">' + esc(SUPER_VARNING) + '</span></span></label>'
      : '';
    return '<div class="ah-valen" data-ah-valen>' + sup + rutor + '</div>';
  }

  function läsVal(host) {
    const superadmin = !!($('[data-ah-super]', host) || {}).checked;
    const behorigheter = superadmin ? []
      : $$('[data-ah-beh]', host).filter(x => x.checked && !x.disabled).map(x => x.dataset.ahBeh);
    if (!superadmin && !behorigheter.length) return { fel: 'Välj minst en behörighet.' };
    if (behorigheter.indexOf('anvandare_redigera') !== -1 && behorigheter.indexOf('anvandare_las') === -1) {
      return { fel: 'Ändra användare kräver Läsa användare. Kryssa i båda.' };
    }
    return { superadmin, behorigheter };
  }

  /* Superadmin stänger de andra rutorna: en superadmin har allt, och en
     lista bredvid sparas inte. */
  document.addEventListener('change', e => {
    const s = e.target.closest('[data-ah-super]');
    if (!s) return;
    const valen = s.closest('[data-ah-valen]');
    const mina = minaBehorigheter();
    $$('[data-ah-beh]', valen).forEach(x => {
      x.disabled = s.checked || !(ärSuper() || mina.indexOf(x.dataset.ahBeh) !== -1);
    });
  });

  function ritaAdminhantering() {
    const host = $('#ah-lista');
    if (!host) return;
    if (!S.behorighet || !S.behorighet.migrerad) {
      host.innerHTML = tomt('Adminhanteringen är inte på plats än',
        'Migrationen barnkonton_och_admin är inte körd. Tills dess är varje admin superadmin.');
      $$('[data-ah-kraver-migrering]').forEach(el => { el.hidden = true; });
      return;
    }
    if (AH.roller === null && !AH.fel) {
      host.innerHTML = '<div class="loading">Hämtar</div>';
      hämtaRoller().then(ritaAdminhantering, fel => {
        AH.fel = fel;
        ritaAdminhantering();
      });
      return;
    }
    if (AH.fel) {
      host.innerHTML = tomt('Kunde inte läsa adminerna', felText(AH.fel));
      return;
    }

    const lista = AH.roller.slice().sort((a, b) =>
      (b.ar_superadmin - a.ar_superadmin) || personNamn(a.user_id).localeCompare(personNamn(b.user_id), 'sv'));
    $('#ah-antal').textContent = lista.length + (lista.length === 1 ? ' person' : ' personer');

    host.innerHTML = lista.map(r => {
      const du = r.user_id === jag();
      const kan = kanÄndra(r);
      const märken = r.ar_superadmin
        ? pill('Superadmin', '')
        : (r.behorigheter || []).map(b => pill(NAMN[b] || b, '')).join(' ');
      const öppen = AH.ändrar === r.user_id;
      return '<div class="ah-rad" data-ah-rad="' + esc(r.user_id) + '">'
        + '<div class="ah-rad-topp"><div>'
        + '<b>' + esc(personNamn(r.user_id)) + (du ? ' (du)' : '') + '</b>'
        + (personEpost(r.user_id) ? '<span>' + esc(personEpost(r.user_id)) + '</span>' : '')
        + '<span class="ah-markar">' + märken + '</span>'
        + '</div><div class="ah-rad-knappar">'
        + (kan.ja
          ? (öppen ? '' : '<button class="btn btn-ghost btn-sm" type="button" data-ah-andra="' + esc(r.user_id) + '">Ändra</button>')
            + '<button class="btn btn-ghost btn-sm" type="button" data-ah-bort="' + esc(r.user_id) + '">Ta bort</button>'
          : '<span class="adm-und">' + esc(kan.varför) + '</span>')
        + '</div></div>'
        + (öppen
          ? '<form class="ah-form" data-ah-spara="' + esc(r.user_id) + '" novalidate>'
            + väljare('ah-e-' + r.user_id.slice(0, 8), r.behorigheter, r.ar_superadmin)
            + '<div class="vy-knapprad">'
            + '<button class="btn btn-primary btn-sm" type="submit">Spara</button>'
            + '<button class="btn btn-ghost btn-sm" type="button" data-ah-avbryt>Avbryt</button>'
            + '</div></form>'
          : '')
        + '</div>';
    }).join('') || tomt('Inga admins', '');

    ritaLogg();
    ritaNyForm();
  }

  function ritaLogg() {
    const host = $('#ah-logg');
    if (!host) return;
    if (AH.loggFel) { host.innerHTML = tomt('Kunde inte läsa loggen', AH.loggFel); return; }
    const beskriv = d => {
      const lista = x => !x ? '' : x.superadmin ? 'superadmin'
        : (x.behorigheter || []).map(b => NAMN[b] || b).join(', ');
      if (!d) return '';
      if (d.fore && d.efter) return lista(d.fore) + ' → ' + lista(d.efter);
      return lista(d.efter || d.fore);
    };
    const HANDLING = { skapad: 'Blev admin', andrad: 'Ändrad', borttagen: 'Togs bort' };
    const VIA = { migrering: 'Flyttad från is_admin', 'profiles.is_admin': 'Satt i SQL' };
    host.innerHTML = (AH.logg || []).length
      ? '<div class="adm-skal"><table class="adm"><thead><tr><th>När</th><th>Vem</th><th>Vad</th><th>Av</th></tr></thead><tbody>'
        + AH.logg.map(r => '<tr>'
          + '<td><span class="adm-tal">' + esc(kortDatum(r.tid)) + '</span>'
          + '<span class="adm-und">' + esc(new Date(r.tid).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })) + '</span></td>'
          + '<td>' + esc(personNamn(r.mal_anvandare)) + '</td>'
          + '<td><b>' + esc(HANDLING[r.handling] || r.handling) + '</b>'
          + '<span class="adm-und">' + esc(beskriv(r.detaljer)) + '</span></td>'
          + '<td>' + esc(r.aktor ? personNamn(r.aktor)
            : VIA[(r.detaljer || {}).via] || 'Systemet') + '</td>'
          + '</tr>').join('')
        + '</tbody></table></div>'
      : tomt('Inget i loggen än', 'Varje ny, ändrad och borttagen admin hamnar här.');
  }

  /* Formulären för en ny admin ritas en gång per laddning, med de
     behörigheter den inloggade får ge. */
  function ritaNyForm() {
    const ny = $('#ah-ny-valen');
    if (ny && !ny.dataset.ritad) { ny.innerHTML = väljare('ah-ny', [], false); ny.dataset.ritad = '1'; }
    ritaBefintlig();
  }

  function ritaBefintlig() {
    const host = $('#ah-bef-traffar');
    const fält = $('#ah-bef-sok');
    if (!host || !fält) return;
    const vald = AH.vald ? S.personer[AH.vald] : null;
    if (vald) {
      host.innerHTML = '<div class="ah-vald"><div class="dp-rad"><div><b>' + esc(personNamn(vald.id)) + '</b>'
        + '<span>' + esc([vald.email, vald.role === 'tutor' ? 'studiehjälpare'
          : vald.role === 'parent' ? 'förälder' : null].filter(Boolean).join(' · ')) + '</span></div>'
        + '<span class="dp-rad-hoger"><button class="btn btn-ghost btn-sm" type="button" data-ah-bef-byt>Välj någon annan</button></span></div>'
        + '<form class="ah-form" data-ah-bef-form novalidate>'
        + väljare('ah-bef', [], false)
        + '<div class="vy-knapprad"><button class="btn btn-primary btn-sm" type="submit">Gör till admin</button></div>'
        + '</form></div>';
      return;
    }
    const sök = fält.value.trim().toLowerCase();
    if (sök.length < 2) { host.innerHTML = ''; return; }
    const admins = new Set((AH.roller || []).map(r => r.user_id));
    const träffar = Object.values(S.personer)
      .filter(p => !admins.has(p.id) && !ärRaderad(p))
      .filter(p => [p.full_name, p.email].filter(Boolean).join(' ').toLowerCase().indexOf(sök) !== -1)
      .slice(0, 8);
    host.innerHTML = träffar.length
      ? träffar.map(p => '<div class="dp-rad"><div><b>' + esc(p.full_name || p.email || 'Okänt konto') + '</b>'
          + '<span>' + esc(p.email || '') + '</span></div>'
          + '<span class="dp-rad-hoger"><button class="btn btn-ghost btn-sm" type="button" data-ah-bef-valj="'
          + esc(p.id) + '">Välj</button></span></div>').join('')
      : tomt('Ingen matchar', 'Personen behöver ett konto på sidan. Har hen inget: bjud in hen ovanför.');
  }

  const befSök = $('#ah-bef-sok');
  if (befSök) befSök.addEventListener('input', () => { AH.vald = null; ritaBefintlig(); });

  async function laddaOm() {
    await hämtaRoller();
    ritaAdminhantering();
  }

  document.addEventListener('click', async e => {
    const ändra = e.target.closest('[data-ah-andra]');
    if (ändra) { AH.ändrar = ändra.dataset.ahAndra; rensa($('#ah-msg')); ritaAdminhantering(); return; }
    if (e.target.closest('[data-ah-avbryt]')) { AH.ändrar = null; ritaAdminhantering(); return; }

    const välj = e.target.closest('[data-ah-bef-valj]');
    if (välj) { AH.vald = välj.dataset.ahBefValj; rensa($('#ah-bef-msg')); ritaBefintlig(); return; }
    if (e.target.closest('[data-ah-bef-byt]')) { AH.vald = null; ritaBefintlig(); $('#ah-bef-sok').focus(); return; }

    const bort = e.target.closest('[data-ah-bort]');
    if (bort) {
      const id = bort.dataset.ahBort;
      const namn = personNamn(id);
      const ja = await bekräfta({
        titel: 'Ta bort ' + namn + ' som admin?',
        text: namn + ' kommer inte längre in i adminvyn. Kontot i övrigt påverkas inte, och det går att '
          + 'göra hen till admin igen.',
        knapp: 'Ta bort som admin'
      });
      if (!ja) return;
      const msg = $('#ah-msg');
      rensa(msg);
      await medan(bort, 'Tar bort…', async () => {
        const { error } = await supa.rpc('ta_bort_admin', { p_user_id: id });
        if (error) { säg(msg, 'Kunde inte ta bort: ' + felText(error), false); return; }
        AH.ändrar = null;
        await laddaOm();
        säg(msg, '✓ ' + namn + ' är inte längre admin.', true);
      });
    }
  });

  document.addEventListener('submit', async e => {
    const form = e.target;

    if (form.matches('[data-ah-spara]')) {
      e.preventDefault();
      const id = form.dataset.ahSpara;
      const msg = $('#ah-msg');
      rensa(msg);
      const val = läsVal(form);
      if (val.fel) { säg(msg, val.fel, false); return; }
      const r = (AH.roller || []).find(x => x.user_id === id);
      if (val.superadmin && !(r && r.ar_superadmin)) {
        const ja = await bekräfta({ titel: 'Göra ' + personNamn(id) + ' till superadmin?', text: SUPER_VARNING,
          knapp: 'Gör till superadmin' });
        if (!ja) return;
      }
      await medan(form.querySelector('button[type="submit"]'), 'Sparar…', async () => {
        const { error } = await supa.rpc('gor_till_admin',
          { p_user_id: id, p_behorigheter: val.behorigheter, p_superadmin: val.superadmin });
        if (error) { säg(msg, 'Kunde inte spara: ' + felText(error), false); return; }
        AH.ändrar = null;
        await laddaOm();
        säg(msg, '✓ Sparat.', true);
      });
      return;
    }

    if (form.matches('[data-ah-bef-form]')) {
      e.preventDefault();
      const msg = $('#ah-bef-msg');
      rensa(msg);
      const id = AH.vald;
      if (!id) return;
      const val = läsVal(form);
      if (val.fel) { säg(msg, val.fel, false); return; }
      const ja = await bekräfta({
        titel: 'Göra ' + personNamn(id) + ' till admin?',
        text: val.superadmin ? SUPER_VARNING
          : 'Hen får: ' + val.behorigheter.map(b => NAMN[b]).join(', ') + '. Det går att ändra och ta bort igen.',
        knapp: 'Gör till admin'
      });
      if (!ja) return;
      await medan(form.querySelector('button[type="submit"]'), 'Sparar…', async () => {
        const { error } = await supa.rpc('gor_till_admin',
          { p_user_id: id, p_behorigheter: val.behorigheter, p_superadmin: val.superadmin });
        if (error) { säg(msg, 'Kunde inte spara: ' + felText(error), false); return; }
        const namn = personNamn(id);
        AH.vald = null;
        $('#ah-bef-sok').value = '';
        await laddaOm();
        säg(msg, '✓ ' + namn + ' är admin. Hen loggar in på nextrum.se/admin med sitt vanliga konto.', true);
      });
      return;
    }

    if (form.matches('#ah-ny-form')) {
      e.preventDefault();
      const msg = $('#ah-ny-msg');
      rensa(msg);
      const epost = $('#ah-ny-epost').value.trim();
      const namn = $('#ah-ny-namn').value.trim().replace(/\s+/g, ' ');
      if (!NX.epostOk(epost)) { säg(msg, 'Skriv en giltig e-postadress.', false); $('#ah-ny-epost').focus(); return; }
      if (!namn) { säg(msg, 'Skriv personens namn.', false); $('#ah-ny-namn').focus(); return; }
      const val = läsVal(form);
      if (val.fel) { säg(msg, val.fel, false); return; }
      if (val.superadmin) {
        const ja = await bekräfta({ titel: 'Bjuda in ' + namn + ' som superadmin?', text: SUPER_VARNING,
          knapp: 'Bjud in som superadmin' });
        if (!ja) return;
      }
      await medan(form.querySelector('button[type="submit"]'), 'Bjuder in…', async () => {
        const svar = await supa.functions.invoke('admin-skapa',
          { body: { epost, namn, behorigheter: val.behorigheter, superadmin: val.superadmin } });
        if (svar.error) { säg(msg, await funktionsFel(svar.error), false); return; }
        form.reset();
        $$('[data-ah-beh]', form).forEach(x => {
          x.disabled = !(ärSuper() || minaBehorigheter().indexOf(x.dataset.ahBeh) !== -1);
        });
        await laddaOm();
        säg(msg, '✓ Inbjudan skickad till ' + epost + '. Länken i mejlet leder till adminvyn, där '
          + namn + ' väljer ett lösenord.', true);
      });
    }
  });

  /* ============================================================
     3. LÖSENORDET
     Den som bjudits in har inget lösenord: länken i mejlet loggar in en
     gång, och sedan behövs ett. Samma ruta finns i kontomenyn, för den
     som vill byta.
     ============================================================ */
  async function väljLösenord(inbjuden) {
    for (;;) {
      const lösen = await fråga({
        titel: inbjuden ? 'Välj ditt lösenord' : 'Byt lösenord',
        text: inbjuden
          ? 'Välkommen! Du loggade in med länken i inbjudan. Välj ett lösenord, så loggar du in med din e-post och det nästa gång.'
          : 'Minst 8 tecken. Du förblir inloggad här.',
        innehåll: '<div class="fgroup"><label for="ah-los1">Nytt lösenord</label>'
          + '<input class="inp" id="ah-los1" type="password" autocomplete="new-password" minlength="8"></div>'
          + '<div class="fgroup" style="margin-top:12px"><label for="ah-los2">Upprepa lösenordet</label>'
          + '<input class="inp" id="ah-los2" type="password" autocomplete="new-password"></div>',
        knapp: 'Spara lösenordet',
        läs: ruta => {
          const a = $('#ah-los1', ruta).value, b = $('#ah-los2', ruta).value;
          if (a.length < 8) return { fel: 'Lösenordet måste ha minst 8 tecken.' };
          if (a !== b) return { fel: 'Lösenorden är inte lika.' };
          return { värde: a };
        }
      });
      if (!lösen) return false;
      const { error } = await supa.auth.updateUser({ password: lösen });
      if (!error) {
        await bekräfta({ titel: 'Lösenordet är sparat', text: 'Nästa gång loggar du in med din e-post och det nya lösenordet.',
          knapp: 'Okej', avbryt: 'Stäng' });
        return true;
      }
      const ja = await bekräfta({ titel: 'Lösenordet sparades inte', text: felText(error), knapp: 'Försök igen', avbryt: 'Avbryt' });
      if (!ja) return false;
    }
  }

  document.addEventListener('click', e => {
    if (e.target.closest('[data-byt-losen]')) väljLösenord(false);
  });

  Object.assign(NXAdmin.rita, {
    läsBehörighet, tillåten, förstaSektion, begränsaVyn, städaMenyn, rollText,
    ritaAdminhantering, väljLösenord
  });
})();
