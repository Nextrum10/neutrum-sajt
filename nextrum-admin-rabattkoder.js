/* ============================================================
   NEXTRUM — adminvyn, Koder: rabattkoderna och partnerkoderna
   (2026-10-21, koder_for_planer)

   Leo: "Bygg en flik Koder i admin med två typer: partnerkod (spårar
   partnerföreningars volym) och rabattkod (t.ex. Zayans). Båda gäller
   ENBART planköp, aldrig enskilda pass." Och: "Admin skapar,
   inaktiverar och ser användning, men rader raderas inte."

   Två flikar under Koder, bredvid familjernas och studiehjälparnas egna
   koder (nextrum-admin-koder.js, som ritar valet och flikarna):
   #koder/rabattkoder och #koder/partnerkoder. Rabattkoderna stod under
   Tjänster till 2026-10-21, och #katalog/rabattkoder skickas hit
   (FLYTTAT i nextrum-admin.js).

   Koderna står i rabattkoder (S.rabattkoder, som kärnan hämtar), med
   sort 'rabatt' eller 'partner'. Databasen avgör allt: att koden bara
   gäller en plan, rabatten, gränserna, att en kod aldrig raderas och att
   namnet och sorten står fast. Här ritas det, och formuläret ger ett
   begripligt besked i stället för ett constraint-fel. Statistiken räknas
   i databasen (kod_statistik, partner_statistik och
   kodens_anvandningar, bara superadmin), utan testbetalningar om inte
   Räkna testbetalningar är ikryssad: Stripe står i testläge än, och då
   är allt test.

   Text ur databasen (koden, beskrivningen, partnerns och familjens namn)
   går genom esc(), som i resten av vyn: inget av det tolkas som HTML.
   Bara superadmin (BARA_SUPER i nextrum-admin-behorighet.js).

   Ägaren, sök, filter och förhandsvisningen (2026-10-21,
   koderna_agare_och_en_gang). Leo: koderna "läggs ut hos familjer och
   lärare", så en kod kan ha en ägare (rabattkoder.agare), som databasen
   nekar koden; en rabattkod gäller en gång per familj, och det sätter
   databasen (fältet står låst på 1 här bara för att säga det). Listan
   har sök och lägen, och formuläret räknar rabatten på varje plan med
   samma regel som databasen (rabattPå, som _delad/koder.ts rabattenPa
   och intern.rabattkod_prova): en förhandsvisning, aldrig beloppet.
   ============================================================ */
(function () {
  'use strict';

  const { $, esc, säg, rensa, felText, isoFor } = NX;
  const { bekräfta, medan, tomt } = NXStudie;
  const kronor = NXBetalning.kronor;
  const { S, kortDatum, pill, namnFör, ärRaderad } = NXAdmin;

  /* Adressens del efter #koder/ och databasens sort. */
  const DEL = {
    rabattkoder: {
      sort: 'rabatt', namn: 'Rabattkoder', ny: 'Ny rabattkod',
      regel: 'En rabattkod, till exempel för en kampanj, ger en rabatt när familjen köper en plan. Den gäller aldrig ett pass '
        + 'eller timmar till en plan, och ett köp har högst en kod. Databasen prövar koden och räknar rabatten '
        + 'innan kassan öppnas, och ett köp blir aldrig gratis av en kod.',
      förval: 1
    },
    partnerkoder: {
      sort: 'partner', namn: 'Partnerkoder', ny: 'Ny partnerkod',
      regel: 'En partnerförenings kod, som familjen skriver när den köper en plan. Den räknar familjerna, köpen och timmarna som '
        + 'kommit genom föreningen, och kan ge en rabatt eller ingen alls (noll). Den första partnerkoden en familj använder '
        + 'sparas på familjen. Som rabattkoderna gäller den bara planer.',
      förval: null
    }
  };

  /* Statistiken per kod och per partner. undefined: inte hämtad, null: fel.
     planer: katalogens planer till förhandsvisningen. ägare: den valda i
     formuläret. filter och sök per sort, så att flikarna minns sitt. */
  const R = {
    kod: undefined, partner: undefined, fel: null, test: false, hämtas: null, hämtad: 0, anv: {},
    planer: undefined, ägare: null,
    filter: { rabatt: 'alla', partner: 'alla' }, sök: { rabatt: '', partner: '' }
  };

  function var_() {
    const [huvud, del] = String(location.hash || '').replace(/^#/, '').split('/');
    return huvud === 'koder' && DEL[del] ? del : null;
  }

  const får = () => !S.behorighet || S.behorighet.superadmin;
  const saknas = fel => fel && (fel.code === 'PGRST202' || fel.code === '42883');

  /* En gång när fliken öppnas och sedan inte oftare än varje minut, utom
     efter en ändring eller när rutan för testbetalningar ändras. */
  function hämta(tvinga) {
    if (R.hämtas) return R.hämtas;
    if (!tvinga && R.hämtad && Date.now() - R.hämtad < 60000) return Promise.resolve();
    R.hämtad = Date.now();
    R.hämtas = Promise.all([
      supa.rpc('kod_statistik', { p_med_test: R.test }),
      supa.rpc('partner_statistik', { p_med_test: R.test }),
      // Katalogen ändras sällan: en gång per sidladdning räcker.
      R.planer ? Promise.resolve(null) : supa.from('erbjudanden_pris').select('*').order('ordning')
    ]).then(([k, p, e]) => {
      const fel = k.error || p.error;
      R.fel = fel ? (saknas(fel) ? 'Statistiken står här när migrationen koder_for_planer är körd.' : felText(fel)) : null;
      R.kod = k.error ? (R.kod || null) : Object.fromEntries((k.data || []).map(r => [r.kod, r]));
      R.partner = p.error ? (R.partner || null) : (p.data || []);
      // Som intern.kod_galler_kopet: bara en plan i katalogen, aldrig timmar till planen.
      if (e) R.planer = e.error ? null : (e.data || []).filter(x => x.sort === 'plan' && x.kod !== 'plan_extra');
      R.anv = {};
    }, fel => {
      R.fel = felText(fel);
      if (R.kod === undefined) R.kod = null;
      if (R.partner === undefined) R.partner = null;
      if (R.planer === undefined) R.planer = null;
    }).then(() => { R.hämtas = null; });
    return R.hämtas;
  }

  async function hämtaKoderna() {
    const { data, error } = await supa.from('rabattkoder').select('*').order('skapad', { ascending: false });
    if (!error) S.rabattkoder = data || [];
    return !error;
  }

  /* ------------------------------------------------------------
     TEXTERNA
     ------------------------------------------------------------ */
  const tal = v => Number(v || 0);
  const n = (antal, en, fler) => antal + ' ' + (antal === 1 ? en : fler);
  // 'belopp' lagras i öre och skrivs i kronor.
  const rabattText = r => !tal(r.varde) ? 'Ingen rabatt' : r.typ === 'procent' ? r.varde + ' %' : kronor(r.varde);
  const idag = () => isoFor(new Date());
  // plan_standard blir Standard; katalogens namn står inte i svaret.
  const planNamn = k => { const t = String(k).replace(/^plan_/, ''); return t.charAt(0).toUpperCase() + t.slice(1); };

  function läge(r) {
    if (!r.aktiv) return pill('Avstängd', '');
    if (r.max_anvandningar && tal(r.antal_anvandningar) >= r.max_anvandningar) return pill('Slut', 'ar-vantar');
    if (r.giltig_till && r.giltig_till < idag()) return pill('Utgången', 'ar-vantar');
    if (r.giltig_fran && r.giltig_fran > idag()) return pill('Börjar ' + kortDatum(r.giltig_fran), 'ar-vantar');
    return pill('Aktiv', 'ar-klar');
  }

  function giltighet(r) {
    if (r.giltig_fran && r.giltig_till) return 'Gäller ' + kortDatum(r.giltig_fran) + ' till ' + kortDatum(r.giltig_till);
    if (r.giltig_till) return 'Gäller till ' + kortDatum(r.giltig_till);
    if (r.giltig_fran) return 'Gäller från ' + kortDatum(r.giltig_fran);
    return 'Ingen slutdag';
  }

  /* Rabatten i öre på ett belopp, som databasen räknar den
     (intern.rabattkod_prova, _delad/koder.ts rabattenPa): procent nedåt
     till hel öre, ett belopp som det är, aldrig under noll eller över
     priset. */
  function rabattPå(typ, värde, beloppÖre) {
    const belopp = Math.max(Math.trunc(Number(beloppÖre) || 0), 0);
    const v = Math.trunc(Number(värde) || 0);
    const r = typ === 'procent' ? Math.floor(belopp * v / 100) : v;
    return Math.min(Math.max(r, 0), belopp);
  }

  /* Den som koden är utlagd hos: en förälder eller studiehjälpare som
     finns, som triggern rabattkoder_agare kräver. */
  const ROLL = { parent: 'Familj', tutor: 'Studiehjälpare' };
  const kanÄga = p => !!p && !!ROLL[p.role] && !ärRaderad(p);
  const ägareText = id => {
    const p = id && S.personer ? S.personer[id] : null;
    return p ? namnFör(id) + ' (' + (ROLL[p.role] || 'konto').toLowerCase() + ')' : 'ett konto som inte finns längre';
  };
  const panelFör = id => {
    const p = id && S.personer ? S.personer[id] : null;
    return p && !ärRaderad(p) ? (p.role === 'tutor' ? 'studiehjalpare:' : p.role === 'parent' ? 'familj:' : '') + id : '';
  };

  /* Lägena i listan. Gäller nu: på, inom datumen och inte slut. */
  function gällerNu(r) {
    return !!r.aktiv && !(r.max_anvandningar && tal(r.antal_anvandningar) >= r.max_anvandningar)
      && !(r.giltig_till && r.giltig_till < idag()) && !(r.giltig_fran && r.giltig_fran > idag());
  }
  const FILTER = [['alla', 'Alla'], ['nu', 'Gäller nu'], ['inte', 'Gäller inte nu'], ['av', 'Avstängda']];
  const passar = (r, f) => f === 'nu' ? gällerNu(r) : f === 'inte' ? !!r.aktiv && !gällerNu(r) : f === 'av' ? !r.aktiv : true;

  function söker(r, sök) {
    const s = String(sök || '').trim().toLowerCase();
    if (!s) return true;
    const p = r.agare && S.personer ? S.personer[r.agare] : null;
    return [r.kod, r.beskrivning, r.partner_namn, p && p.full_name, p && p.email]
      .map(x => String(x || '')).join(' ').toLowerCase().indexOf(s) !== -1;
  }

  function gränser(r) {
    return [r.max_anvandningar ? n(r.max_anvandningar, 'gång', 'gånger') + ' totalt' : null,
      r.max_per_familj ? (r.max_per_familj === 1 ? 'en gång per familj' : r.max_per_familj + ' gånger per familj') : null]
      .filter(Boolean).join(', ') || 'Utan gräns';
  }

  /* ------------------------------------------------------------
     RITNINGEN
     ------------------------------------------------------------ */
  function kpi(värde, rubrik, under) {
    return '<div class="adm-kpi"><b>' + esc(String(värde)) + '</b><span>' + esc(rubrik) + '</span>'
      + (under ? '<span class="adm-kpi-diff">' + esc(under) + '</span>' : '') + '</div>';
  }

  const koderFör = o => (S.rabattkoder || []).filter(r => r.kod !== 'TIPS' && (r.sort || 'rabatt') === o.sort);

  function ritaTal(o, koder) {
    const host = $('#kp-tal');
    if (!host) return;
    const st = R.kod || {};
    const s = koder.reduce((a, r) => {
      const x = st[r.kod] || {};
      a.kop += tal(x.kop); a.timmar += tal(x.kopta_timmar); a.gjorda += tal(x.genomforda_timmar);
      a.betalt += tal(x.betalt_ore) - tal(x.aterbetalt_ore); a.rabatt += tal(x.rabatt_ore);
      return a;
    }, { kop: 0, timmar: 0, gjorda: 0, betalt: 0, rabatt: 0 });
    const aktiva = koder.filter(r => r.aktiv).length;
    // En familj kan ha använt flera koder: antalet familjer räknas i databasen per partner, inte här.
    const familjer = o.sort === 'partner' && R.partner ? R.partner.reduce((a, p) => a + tal(p.familjer), 0) : null;
    host.innerHTML = kpi(koder.length, koder.length === 1 ? 'Kod' : 'Koder', n(aktiva, 'aktiv', 'aktiva'))
      + kpi(s.kop, s.kop === 1 ? 'Köp med kod' : 'Köp med koderna', R.test ? 'med testbetalningar' : 'utan testbetalningar')
      + (o.sort === 'partner'
        ? kpi(familjer === null ? '–' : familjer, 'Familjer genom partnerna', 'en gång per partner')
          + kpi(s.timmar, 'Köpta timmar', s.gjorda + ' genomförda')
        : kpi(kronor(s.rabatt), 'Rabatt sammanlagt', 'det koderna drog av'))
      + kpi(kronor(s.betalt), 'Betalt', 'efter återbetalningar');
  }

  function ritaRegel(o) {
    const host = $('#kp-regel');
    if (!host) return;
    host.innerHTML = '<div class="kod-regel">'
      + '<span class="kod-regel-text"><b>' + esc(o.namn) + ' gäller bara planer</b>'
      + '<span>' + esc(o.regel) + '</span>'
      + '<span class="kod-regel-not">Koder raderas aldrig: de stängs av. En kods namn och sort ändras aldrig.</span>'
      + '</span></div>';
  }

  function ritaPartner(o) {
    const host = $('#kp-partner');
    if (!host) return;
    if (o.sort !== 'partner') { host.innerHTML = ''; host.hidden = true; return; }
    host.hidden = false;
    if (R.partner === undefined) { NXStudie.laddarFörsta(host); return; }
    if (R.partner === null) { host.innerHTML = tomt('Statistiken gick inte att hämta', R.fel || ''); return; }
    const rader = R.partner.slice().sort((a, b) => (tal(b.kop) - tal(a.kop))
      || String(a.partner_namn).localeCompare(String(b.partner_namn), 'sv'));
    host.innerHTML = '<div class="dbox"><h5>Per partner</h5>'
      + (rader.length
        ? '<div class="adm-skal"><table class="adm"><thead><tr><th>Partner</th><th>Koder</th><th>Familjer</th><th>Köp</th>'
          + '<th>Köpta timmar</th><th>Genomförda timmar</th><th>Betalt</th><th>Rabatt</th></tr></thead><tbody>'
          + rader.map(p => '<tr><td><b>' + esc(p.partner_namn) + '</b></td>'
            + '<td><span class="adm-tal">' + esc(tal(p.aktiva_koder) + ' av ' + tal(p.koder)) + '</span>'
            + '<span class="adm-und">aktiva</span></td>'
            + '<td><span class="adm-tal">' + tal(p.familjer) + '</span></td>'
            + '<td><span class="adm-tal">' + tal(p.kop) + '</span></td>'
            + '<td><span class="adm-tal">' + tal(p.kopta_timmar) + '</span></td>'
            + '<td><span class="adm-tal">' + tal(p.genomforda_timmar) + '</span></td>'
            + '<td><span class="adm-tal">' + esc(kronor(tal(p.betalt_ore) - tal(p.aterbetalt_ore))) + '</span>'
            + (tal(p.aterbetalt_ore) ? '<span class="adm-und">' + esc(kronor(p.aterbetalt_ore)) + ' återbetalt</span>' : '')
            + '</td><td><span class="adm-tal">' + esc(kronor(p.rabatt_ore)) + '</span></td></tr>').join('')
          + '</tbody></table></div>'
          + '<p class="xsmall" style="color:var(--bl-3);margin:10px 0 0;line-height:1.6">Köpta timmar är alla timmar i köpen, '
          + 'också den första planens timme på köpet. Genomförda timmar är pass med rapport som timmarna i köpen betalade. '
          + 'En familj räknas en gång per partner.</p>'
        : tomt('Inga partner än', 'Skapa en partnerkod nedan, så står partnern här.'))
      + '</div>';
  }

  function användningar(r) {
    const lista = R.anv[r.kod];
    if (lista === undefined) return '<p class="kod-tom">Hämtar…</p>';
    if (lista === null) return '<p class="kod-tom">Användningarna gick inte att hämta.</p>';
    if (!lista.length) return '<p class="kod-tom">Ingen har köpt en plan med koden än.</p>';
    return '<ul class="kod-vilka">' + lista.map(a => '<li>'
      + (a.familj
        ? '<button type="button" class="eko-lank" data-dp="familj:' + esc(a.familj) + '">' + esc(a.familj_namn || 'Familjen') + '</button>'
        : '<span>Familjen finns inte längre</span>')
      + '<span class="kod-vilka-nar">' + esc(kortDatum(a.anvand_at) + (a.erbjudande ? ' · ' + planNamn(a.erbjudande) : '')
        + ' · ' + n(tal(a.timmar), 'timme', 'timmar') + ', ' + tal(a.genomforda_timmar) + ' genomförda') + '</span>'
      + '<span class="kod-siffra"><b>' + esc(kronor(tal(a.betalt_ore) - tal(a.aterbetalt_ore))) + '</b>'
      + (tal(a.rabatt_ore) ? ' ' + esc(kronor(a.rabatt_ore)) + ' rabatt' : '') + '</span>'
      + (a.test ? pill('Test', '') : '')
      + (a.status === 'aterbetald' ? pill('Återbetald', '') : a.status === 'delvis_aterbetald' ? pill('Delvis återbetald', '')
        : a.status === 'tvist' ? pill('Tvist', 'ar-vantar') : '')
      + '</li>').join('') + '</ul>'
      + (lista.some(a => a.test) && !R.test
        ? '<p class="kod-tom">Testbetalningar står i listan men räknas inte i siffrorna ovan.</p>' : '');
  }

  function rad(o, r) {
    const x = (R.kod || {})[r.kod] || {};
    return '<details class="kod-rad" data-kp-kod="' + esc(r.kod) + '">'
      + '<summary>'
      + '<span class="kod-person"><span class="kod-person-text"><b>'
      + esc(o.sort === 'partner' ? (r.partner_namn || 'Partner') : (r.beskrivning || 'Rabattkod')) + '</b>'
      + '<span>' + esc([rabattText(r), giltighet(r), r.agare ? 'Utlagd hos ' + ägareText(r.agare) : null]
        .filter(Boolean).join(' · ')) + '</span></span></span>'
      + '<span class="kod-kod"><code translate="no">' + esc(r.kod) + '</code></span>'
      + '<span class="kod-siffror">'
      + '<span class="kod-siffra"><b>' + tal(r.antal_anvandningar) + (r.max_anvandningar ? ' / ' + r.max_anvandningar : '')
      + '</b> använd</span>'
      + '<span class="kod-siffra"><b>' + tal(x.familjer) + '</b> ' + (tal(x.familjer) === 1 ? 'familj' : 'familjer') + '</span>'
      + '<span class="kod-siffra"><b>' + esc(kronor(tal(x.betalt_ore) - tal(x.aterbetalt_ore))) + '</b> betalt</span>'
      + '<span class="kod-under">' + esc(gränser(r)) + '</span>'
      + '</span>'
      + '<span class="kod-lage">' + läge(r)
      // Snabbknappen står i raden: ingen ska behöva fälla ut den för att stänga av en kod.
      + '<button type="button" class="btn btn-ghost btn-sm kp-snabb" data-kp-vaxla="' + esc(r.kod) + '" data-pa="'
      + (r.aktiv ? '0' : '1') + '" aria-label="' + esc((r.aktiv ? 'Stäng av ' : 'Slå på ') + r.kod) + '">'
      + (r.aktiv ? 'Stäng av' : 'Slå på') + '</button>'
      + '<span class="kod-fall"><svg viewBox="0 0 24 24" aria-hidden="true">'
      + '<path d="m6 9 6 6 6-6"/></svg></span></span>'
      + '</summary>'
      + '<div class="kod-kropp">'
      + (o.sort === 'partner' && r.beskrivning ? '<p class="kod-tom">' + esc(r.beskrivning) + '</p>' : '')
      + (r.agare
        ? '<p class="kod-del">Utlagd hos</p><p class="kod-tom">'
          + (panelFör(r.agare)
            ? '<button type="button" class="eko-lank" data-dp="' + esc(panelFör(r.agare)) + '">' + esc(ägareText(r.agare)) + '</button>'
            : esc(ägareText(r.agare)))
          + '. Den som koden är utlagd hos kan inte använda den själv.</p>'
        : '')
      + '<p class="kod-del">Köp med koden</p>'
      + '<div data-kp-anv="' + esc(r.kod) + '">' + användningar(r) + '</div>'
      + '<div class="kod-atg">'
      + '<button type="button" class="btn btn-ghost btn-sm" data-kp-kopiera="' + esc(r.kod) + '">Kopiera koden</button>'
      + '</div>'
      + '</div>'
      + '</details>';
  }

  function ritaChips(o, koder) {
    const host = $('#kp-chips');
    if (!host) return;
    const valt = R.filter[o.sort];
    host.innerHTML = FILTER.map(([k, t]) => '<button type="button" class="chip" data-kp-filter="' + k + '"'
      + ' aria-pressed="' + (k === valt) + '">' + esc(t)
      + ' <span class="eko-chip-tal">' + koder.filter(r => passar(r, k)).length + '</span></button>').join('');
  }

  function ritaLista(o, koder) {
    const host = $('#kp-lista');
    if (!host) return;
    const öppna = new Set(Array.from(host.querySelectorAll('details.kod-rad[open]')).map(d => d.dataset.kpKod));
    const urval = koder.filter(r => passar(r, R.filter[o.sort]) && söker(r, R.sök[o.sort]))
      .sort((a, b) => (Number(b.aktiv) - Number(a.aktiv)) || String(b.skapad || '').localeCompare(String(a.skapad || '')));
    host.innerHTML = urval.length
      ? '<div class="kod-lista">' + urval.map(r => rad(o, r)).join('') + '</div>'
      : koder.length
        ? tomt('Ingen kod passar', 'Ändra sökningen eller välj ett annat läge.')
        : tomt(o.sort === 'partner' ? 'Inga partnerkoder än' : 'Inga rabattkoder än', 'Skapa den första i formuläret ovan.');
    öppna.forEach(kod => {
      const d = host.querySelector('details.kod-rad[data-kp-kod="' + CSS.escape(kod) + '"]');
      if (d) d.open = true;
    });
  }

  function ritaFormuläret(o) {
    const form = $('#kp-form');
    if (!form) return;
    // Bara när fliken byts: ett formulär man skriver i ritas inte om.
    if (form.dataset.sort === o.sort) return;
    form.dataset.sort = o.sort;
    $('#kp-ny').textContent = o.ny;
    const partner = $('#kp-partner-rad');
    if (partner) partner.hidden = o.sort !== 'partner';
    /* En rabattkod gäller en gång per familj, och databasen sätter det
       (rabattkoder_en_gang). Fältet står låst för att säga det. */
    const familj = $('#kp-familj');
    if (familj) {
      familj.value = o.förval == null ? '' : String(o.förval);
      familj.disabled = o.sort === 'rabatt';
    }
    const familjNot = $('#kp-familj-not');
    if (familjNot) familjNot.hidden = o.sort !== 'rabatt';
    const värde = $('#kp-varde');
    if (värde) värde.placeholder = o.sort === 'partner' ? '0' : '10';
    const kod = $('#kp-kod');
    if (kod) kod.placeholder = o.sort === 'partner' ? 'FORENINGEN' : 'ZAYAN10';
    rensa($('#kp-msg'));
    R.ägare = null;
    ritaÄgaren();
    ritaFörhand();
  }

  /* ------------------------------------------------------------
     ÄGAREN I FORMULÄRET: sök en familj eller studiehjälpare, välj, ta bort
     ------------------------------------------------------------ */
  function ritaÄgaren() {
    const vald = $('#kp-agare-vald'), sök = $('#kp-agare-sok'), förslag = $('#kp-agare-forslag');
    if (!vald || !sök || !förslag) return;
    if (R.ägare) {
      vald.hidden = false;
      vald.innerHTML = '<span class="kp-agare-namn">' + esc(ägareText(R.ägare)) + '</span>'
        + '<button type="button" class="btn btn-ghost btn-sm" data-kp-agare-bort>Ta bort</button>';
      sök.hidden = true;
      förslag.innerHTML = '';
      return;
    }
    vald.hidden = true;
    vald.innerHTML = '';
    sök.hidden = false;
    const s = String(sök.value || '').trim().toLowerCase();
    if (s.length < 2) { förslag.innerHTML = ''; return; }
    const träffar = Object.values(S.personer || {})
      .filter(p => kanÄga(p) && [p.full_name, p.email].join(' ').toLowerCase().indexOf(s) !== -1)
      .sort((a, b) => String(a.full_name || a.email || '').localeCompare(String(b.full_name || b.email || ''), 'sv'))
      .slice(0, 6);
    förslag.innerHTML = träffar.length
      ? träffar.map(p => '<button type="button" class="kp-agare-val" data-kp-agare="' + esc(p.id) + '">'
        + '<b>' + esc(p.full_name || p.email || 'Utan namn') + '</b>'
        + '<span>' + esc(ROLL[p.role] + (p.email ? ' · ' + p.email : '')) + '</span></button>').join('')
      : '<p class="kod-tom">Ingen familj eller studiehjälpare heter så.</p>';
  }

  /* ------------------------------------------------------------
     FÖRHANDSVISNINGEN: rabatten på varje plan, före kassan
     ------------------------------------------------------------ */
  function ritaFörhand() {
    const host = $('#kp-forhand');
    const del = var_();
    if (!host || !del) return;
    const o = DEL[del];
    const typ = ($('#kp-typ') || {}).value;
    const fält = String(($('#kp-varde') || {}).value || '').trim();
    const värde = fält === '' ? (o.sort === 'partner' ? 0 : NaN) : Number(fält);
    if (R.planer === undefined) { host.innerHTML = '<p class="kod-tom">Planernas priser hämtas…</p>'; return; }
    if (!R.planer || !R.planer.length) {
      host.innerHTML = '<p class="kod-tom">Planernas priser gick inte att hämta, så rabatten visas inte här.</p>';
      return;
    }
    if (!Number.isFinite(värde) || värde < 0) {
      host.innerHTML = '<p class="kod-tom">Skriv rabattens värde, så står priset för varje plan här.</p>';
      return;
    }
    // Kronor skrivs i kronor och lagras i öre, som i formuläret.
    const v = typ === 'belopp' ? Math.round(värde * 100) : Math.round(värde);
    if (!v) {
      host.innerHTML = '<p class="kod-tom">Ingen rabatt: koden räknar bara köpen, och familjen betalar planens pris.</p>';
      return;
    }
    if (typ === 'procent' && v > 100) { host.innerHTML = '<p class="kod-tom">Procent är högst 100.</p>'; return; }
    host.innerHTML = '<p class="kod-del">Så blir priset</p><ul class="kp-forhand-lista">'
      + R.planer.map(e => {
        const pris = tal(e.pris_ore);
        const rabatt = rabattPå(typ, v, pris);
        return '<li><b>' + esc(e.namn || planNamn(e.kod)) + '</b>'
          + (rabatt >= pris
            ? '<span class="kp-forhand-nej">Nekas: rabatten tar hela priset</span>'
            : '<span>' + esc(kronor(pris)) + '</span><span class="kp-forhand-av">−' + esc(kronor(rabatt)) + '</span>'
              + '<b class="kp-forhand-pris">' + esc(kronor(pris - rabatt)) + '</b>')
          + '</li>';
      }).join('') + '</ul>'
      + '<p class="kod-tom">På katalogens pris. Har familjen en familjerabatt räknas koden på priset efter den, och '
      + 'databasen räknar rabatten igen när familjen köper.</p>';
  }

  function ritaRabattkoder() {
    const vy = $('#kp-vy');
    if (!vy) return;
    const del = var_();
    vy.hidden = !del || !får();
    if (!del || !får()) return;
    const o = DEL[del];
    const flikar = $('#kp-flikar');
    if (flikar && typeof NXAdmin.rita.kodflikar === 'function') flikar.innerHTML = NXAdmin.rita.kodflikar(del);
    const test = $('#kp-test');
    if (test) test.checked = R.test;
    const koder = koderFör(o);
    ritaRegel(o);
    ritaTal(o, koder);
    ritaPartner(o);
    ritaFormuläret(o);
    ritaFörhand();
    ritaChips(o, koder);
    const sök = $('#kp-sok');
    if (sök && sök.value !== R.sök[o.sort]) sök.value = R.sök[o.sort];
    ritaLista(o, koder);
    const fel = $('#kp-fel');
    if (fel) { fel.hidden = !R.fel; fel.textContent = R.fel || ''; }
  }

  function öppnad() {
    if (!var_() || !får()) { ritaRabattkoder(); return; }
    ritaRabattkoder();
    hämta().then(ritaRabattkoder);
  }

  window.addEventListener('hashchange', öppnad);

  /* En kods användningar hämtas när raden fälls ut. */
  document.addEventListener('toggle', async e => {
    const d = e.target;
    if (!(d instanceof HTMLDetailsElement) || !d.open || !d.dataset.kpKod) return;
    const kod = d.dataset.kpKod;
    if (R.anv[kod] !== undefined) return;
    const { data, error } = await supa.rpc('kodens_anvandningar', { p_kod: kod });
    R.anv[kod] = error ? null : (data || []);
    const host = document.querySelector('[data-kp-anv="' + CSS.escape(kod) + '"]');
    const r = (S.rabattkoder || []).find(x => x.kod === kod);
    if (host && r) host.innerHTML = användningar(r);
  }, true);

  document.addEventListener('change', async e => {
    if (e.target.id === 'kp-typ') { ritaFörhand(); return; }
    if (e.target.id !== 'kp-test') return;
    R.test = !!e.target.checked;
    await hämta(true);
    ritaRabattkoder();
  });

  document.addEventListener('input', e => {
    const id = e.target.id;
    if (id === 'kp-varde') { ritaFörhand(); return; }
    if (id === 'kp-agare-sok') { ritaÄgaren(); return; }
    if (id !== 'kp-sok') return;
    const del = var_();
    if (!del) return;
    const o = DEL[del];
    R.sök[o.sort] = e.target.value;
    ritaLista(o, koderFör(o));
  });

  document.addEventListener('submit', async e => {
    if (e.target.id !== 'kp-form') return;
    e.preventDefault();
    const del = var_();
    if (!del) return;
    const o = DEL[del];
    const msg = $('#kp-msg');
    rensa(msg);

    const kod = String($('#kp-kod').value || '').trim().toUpperCase();
    const partner = String(($('#kp-partner-namn') || {}).value || '').trim();
    const typ = $('#kp-typ').value;
    const fält = String($('#kp-varde').value || '').trim();
    const värde = fält === '' ? (o.sort === 'partner' ? 0 : NaN) : Number(fält);
    const från = $('#kp-fran').value || null;
    const till = $('#kp-till').value || null;

    /* Samma villkor som databasens. Det här är inte säkerheten, den
       ligger i basen, utan ett begripligt besked i stället för ett fel. */
    if (!/^[A-Z0-9-]{3,24}$/.test(kod)) {
      säg(msg, 'Koden får bara innehålla A–Z, 0–9 och bindestreck, 3–24 tecken.', false); return;
    }
    if (kod === 'TIPS') { säg(msg, 'TIPS är tipstimmens markering och kan inte bli en kod.', false); return; }
    if (o.sort === 'partner' && (partner.length < 2 || partner.length > 80)) {
      säg(msg, 'Skriv partnerns namn, 2–80 tecken.', false); return;
    }
    if (!Number.isFinite(värde) || värde < 0) { säg(msg, 'Fyll i rabattens värde, noll eller mer.', false); return; }
    if (typ === 'procent' && (värde > 100 || !Number.isInteger(värde))) {
      säg(msg, 'Procent är ett heltal från 0 till 100.', false); return;
    }
    if (från && till && till < från) { säg(msg, 'Slutdagen ligger före första dagen.', false); return; }

    const ägare = R.ägare;
    if (ägare && !kanÄga(S.personer && S.personer[ägare])) {
      säg(msg, 'Koden läggs ut hos en familj eller en studiehjälpare som finns. Välj någon annan, eller ta bort ägaren.', false);
      return;
    }

    await medan($('#kp-spara'), 'Skapar…', async () => {
      const rad = {
        kod,
        sort: o.sort,
        partner_namn: o.sort === 'partner' ? partner : null,
        typ,
        // Kronor skrivs i kronor och lagras i öre, som allt annat.
        varde: typ === 'belopp' ? Math.round(värde * 100) : Math.round(värde),
        giltig_fran: från,
        giltig_till: till,
        max_anvandningar: Number($('#kp-max').value) || null,
        // En rabattkod: en gång per familj, och databasen sätter det ändå.
        max_per_familj: o.sort === 'rabatt' ? 1 : (Number($('#kp-familj').value) || null),
        beskrivning: String($('#kp-text').value || '').trim() || null,
        aktiv: true
      };
      // Bara med en ägare: utan migrationen finns kolumnen inte, och en kod utan ägare ska gå att skapa ändå.
      if (ägare) rad.agare = ägare;
      const { error } = await supa.from('rabattkoder').insert(rad);
      if (error) {
        säg(msg, error.code === '23505' ? 'Det finns redan en kod som heter ' + kod + '.'
          : error.code === 'PGRST204' && ägare
            ? 'En ägare går att sätta när migrationen koderna_agare_och_en_gang är körd. Ta bort ägaren, eller vänta.'
            : saknas(error) || error.code === 'PGRST204'
              ? 'Partnerkoderna går att skapa när migrationen koder_for_planer är körd.'
              : 'Kunde inte skapa: ' + felText(error), false);
        return;
      }
      await hämtaKoderna();
      const form = $('#kp-form');
      form.reset();
      form.dataset.sort = '';
      ritaRabattkoder();
      säg(msg, '✓ ' + kod + ' är skapad och gäller ' + (från && från > idag() ? 'från ' + kortDatum(från) : 'direkt')
        + (ägare ? ', utlagd hos ' + ägareText(ägare) : '') + '.', true);
    });
  });

  document.addEventListener('click', async e => {
    const filter = e.target.closest('[data-kp-filter]');
    if (filter) {
      const del = var_();
      if (!del) return;
      const o = DEL[del];
      R.filter[o.sort] = filter.dataset.kpFilter;
      const koder = koderFör(o);
      /* Listan kan bli mycket kortare: hållLista, som de andra koderna. */
      NXStudie.hållLista($('#kp-lista'), $('#kp-chips'), () => { ritaChips(o, koder); ritaLista(o, koder); });
      return;
    }

    const välj = e.target.closest('[data-kp-agare]');
    if (välj) {
      R.ägare = välj.dataset.kpAgare;
      const sök = $('#kp-agare-sok');
      if (sök) sök.value = '';
      ritaÄgaren();
      return;
    }
    if (e.target.closest('[data-kp-agare-bort]')) {
      R.ägare = null;
      ritaÄgaren();
      const sök = $('#kp-agare-sok');
      if (sök) sök.focus();
      return;
    }

    const kopiera = e.target.closest('[data-kp-kopiera]');
    if (kopiera) {
      const kod = kopiera.dataset.kpKopiera;
      const klart = text => { kopiera.textContent = text; setTimeout(() => { kopiera.textContent = 'Kopiera koden'; }, 2000); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(kod).then(() => klart('Kopierad'), () => klart(kod));
      } else {
        klart(kod);
      }
      return;
    }

    const växla = e.target.closest('[data-kp-vaxla]');
    if (!växla) return;
    // Knappen står i radens summary: ett tryck på den fäller inte ut raden.
    e.preventDefault();
    const kod = växla.dataset.kpVaxla;
    const på = växla.dataset.pa === '1';
    const ja = await bekräfta({
      titel: på ? 'Slå på koden ' + kod + '?' : 'Stäng av koden ' + kod + '?',
      text: på
        ? 'Koden går att använda när en familj köper en plan igen, från och med nu.'
        : 'Koden går inte att använda från och med nu. Köpen som redan gjorts med den behåller sitt pris, och koden står kvar i listan.',
      knapp: på ? 'Slå på' : 'Stäng av'
    });
    if (!ja) return;
    await medan(växla, på ? 'Slår på…' : 'Stänger av…', async () => {
      const { data, error } = await supa.from('rabattkoder').update({ aktiv: på }).eq('kod', kod).select('kod');
      if (error) { alert('Kunde inte ändra koden: ' + felText(error)); return; }
      // En uppdatering som RLS inte släpper fram ger inget fel, bara noll rader.
      if (!data || !data.length) { alert('Ingenting sparades. Koden finns inte längre, eller så får du inte ändra den.'); return; }
      await hämtaKoderna();
    });
    ritaRabattkoder();
  });

  Object.assign(NXAdmin.rita, { ritaRabattkoder });
})();
