/* ============================================================
   NEXTRUM — webbläsarprov för kassan, timbankens månader, Liggaren
   och Kortet (2026-10-21, Fas 3)

       NODE_PATH="$(npm root -g)" node verktyg/prova-kassan.js [mapp för bilder]

   Leo (2026-10-21): köpvillkoren kryssas i före varje kassa, en plan
   köps för "Den här månaden" eller "Nästa månad", timbanken visar båda
   månaderna ("3 av 8 timmar återstår", "0 av 0"), kassan får bara vad
   som köps och aldrig ett belopp, att komma tillbaka från Stripe
   skriver ingenting, och adminvyn har en liggare med en rad per
   betalning och återbetalning, och en lista över kortet med de nekade
   överst. Databasens regler provas i rls-test.sql (avsnitten BL, PM
   och KD); här provas vyerna, mot en falsk Supabase, som
   verktyg/prova-familjerabatter.js (egen port, 8979). Ett anrop till
   den riktiga adressen fäller provet.

   Dagarna räknas i Stockholms tid, som databasen räknar dem, och
   webbläsaren går i samma tidszon.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let pw;
try { pw = require('playwright'); } catch (e) {
  console.error('Hittar inte Playwright. Kör med NODE_PATH="$(npm root -g)".');
  process.exit(2);
}

const ROT = path.dirname(__dirname);
const PORT = 8979;
const BAS = 'http://localhost:' + PORT;
const FALSK = 'https://supabase.test';
const RIKTIG = /ddkfiuvcppalutfulvbi\.supabase\.co/;
const LAGRING = 'sb-supabase-auth-token';
const BILDER = process.argv[2] || null;

const utfall = [];
function prova(namn, ok, detalj) {
  utfall.push({ namn, ok: !!ok, detalj: ok ? '' : String(detalj == null ? '' : detalj) });
}
const vänta = ms => new Promise(r => setTimeout(r, ms));
const nu = min => new Date(Date.now() + min * 60000).toISOString();

/* Stockholms dagar: i dag, den 1:a i den här och nästa månad, och en
   månads sista dag. */
const sthlm = d => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric',
  month: '2-digit', day: '2-digit' }).format(d);
const IDAG = sthlm(new Date());
const DENNA = IDAG.slice(0, 8) + '01';
const NASTA = (() => {
  const [år, mån] = IDAG.split('-').map(Number);
  return (mån === 12 ? år + 1 : år) + '-' + String(mån === 12 ? 1 : mån + 1).padStart(2, '0') + '-01';
})();
const sista = första => {
  const [år, mån] = första.split('-').map(Number);
  return new Date(Date.UTC(år, mån, 0)).toISOString().slice(0, 10);
};
const MÅNADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september',
  'oktober', 'november', 'december'];
const månad = första => MÅNADER[Number(första.slice(5, 7)) - 1];
const stor = t => t.charAt(0).toUpperCase() + t.slice(1);
const dag = n => sthlm(new Date(Date.now() + n * 864e5));
const NÄSTA_TEXT = 'Gäller 1–' + Number(sista(NASTA).slice(8)) + ' ' + månad(NASTA);

function jwt(sub, roll) {
  const b = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  return b({ alg: 'HS256', typ: 'JWT' }) + '.' + b({ sub, role: roll, exp: 4102444800 }) + '.provet';
}
const ADMIN = { id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'leo@example.se',
  app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-09-01T10:00:00Z' };
const FAMILJ = { id: 'fam-a', aud: 'authenticated', role: 'authenticated', email: 'anna@example.se',
  app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-09-10T10:00:00Z' };

/* Den här månadens plan: 8 timmar, 5 använda. */
const PLAN_DENNA = {
  id: 'plan-denna', parent_id: 'fam-a', erbjudande: 'plan_standard', namn: 'Standard', sort: 'plan',
  timmar: 8, anvanda: 5, kvar: 3, giltigt_till: sista(DENNA), status: 'betald', begart_ore: 303200, betalt_ore: 303200,
  aterbetald_ore: 0, timpris_ore: 39900, betald_at: nu(-2880), created_at: nu(-2880), brukbar: true,
  vid_uppsagning_ore: 103700, angerfrist_till: dag(12), vid_anger_ore: 113700, gratis_kvar: 0, gratis_till: null,
  aterkallad_at: null, till_plan: null, rabatterat_timpris_ore: 37900, familjerabatt_ore: 0,
  galler_fran: DENNA, aterbetalda_timmar: 0
};
/* Nästa månads plan, köpt i dag: gäller inte än. */
const PLAN_NASTA = Object.assign({}, PLAN_DENNA, {
  id: 'plan-nasta', erbjudande: 'plan_basic', namn: 'Basic', timmar: 4, anvanda: 0, kvar: 4,
  giltigt_till: sista(NASTA), begart_ore: 151600, betalt_ore: 151600, vid_uppsagning_ore: 151600,
  vid_anger_ore: 151600, betald_at: nu(-60), created_at: nu(-60), brukbar: false, galler_fran: NASTA
});

function värld() {
  return {
    profiles: [
      { id: 'admin-1', role: 'parent', full_name: 'Leo Admin', email: 'leo@example.se', is_admin: true,
        match_status: 'pending', created_at: '2026-09-01T10:00:00Z', last_seen_at: nu(-5) },
      { id: 'fam-a', role: 'parent', full_name: 'Anna Andersson', email: 'anna@example.se', is_admin: false,
        match_status: 'matched', matched_tutor_id: 'sh-a', created_at: '2026-09-10T10:00:00Z', last_seen_at: nu(-60) },
      { id: 'fam-b', role: 'parent', full_name: 'Bo Berg', email: 'bo@example.se', is_admin: false,
        match_status: 'matched', matched_tutor_id: 'sh-a', created_at: '2026-09-20T10:00:00Z', last_seen_at: nu(-60) },
      { id: 'sh-a', role: 'tutor', full_name: 'Sara Ahl', email: 'sara@example.se', is_admin: false,
        created_at: '2026-09-01T10:00:00Z', last_seen_at: nu(-30) }
    ],
    tutor_profiles: [{ id: 'sh-a', status: 'approved', hourly_rate: 150, created_at: '2026-09-01T10:00:00Z' }],
    students: [
      { id: 'elev-a', parent_id: 'fam-a', name: 'Kim', matched_tutor_id: 'sh-a', match_status: 'matched',
        created_at: '2026-09-10T10:00:00Z' },
      { id: 'elev-b', parent_id: 'fam-b', name: 'Lo', matched_tutor_id: 'sh-a', match_status: 'matched',
        created_at: '2026-09-20T10:00:00Z' }
    ],
    tjanster: [{ kod: 'laxhjalp', namn: 'Läxhjälp', aktiv: true, for_jobb: true, for_kund: true, ordning: 1,
      pris_per_timme_ore: 39900, extra_personer_ore: 6900, extra_personer_max: 3 }],
    flaggor: [{ kod: 'erbjudanden', aktiv: true, beskrivning: 'Erbjudandena', uppdaterad: '2026-09-27T10:00:00Z' }],
    admin_sett: [{ omrade: 'leads', sett_till: nu(-1) }, { omrade: 'ansokningar', sett_till: nu(-1) }],
    bookings: [
      /* Ett bekräftat pass att betala i förväg. */
      { id: 'pass-1', parent_id: 'fam-a', tutor_id: 'sh-a', student_id: 'elev-a', subject: 'Matematik',
        tjanst: 'laxhjalp', wanted_date: dag(9), wanted_time: '16:00', duration_min: 60, status: 'confirmed',
        betalning_status: 'ingen', fakturerbar: true, startrabatt: false, rabatt_ore: null, timpris_ore: 39900,
        extra_ore: 6900, antal_barn: 1, created_at: nu(-600) },
      /* Betalt med kort och delvis återbetalt. */
      { id: 'pass-2', parent_id: 'fam-a', tutor_id: 'sh-a', student_id: 'elev-a', subject: 'Engelska',
        tjanst: 'laxhjalp', wanted_date: dag(-12), wanted_time: '17:00', duration_min: 60, status: 'completed',
        betalning_status: 'aterbetald', betalt_ore: 39900, aterbetald_ore: 10000, fakturerbar: true,
        startrabatt: false, timpris_ore: 39900, extra_ore: 6900, antal_barn: 1, created_at: nu(-30000) },
      /* Två pass som betalas med kortet: det ena nekat, det andra reserverat. */
      { id: 'pass-k1', parent_id: 'fam-a', tutor_id: 'sh-a', student_id: 'elev-a', subject: 'Svenska',
        tjanst: 'laxhjalp', wanted_date: dag(-1), wanted_time: '15:00', duration_min: 60, status: 'completed',
        betalning_status: 'ingen', fakturerbar: true, startrabatt: false, timpris_ore: 39900, extra_ore: 6900,
        antal_barn: 1, created_at: nu(-9000) },
      { id: 'pass-k2', parent_id: 'fam-b', tutor_id: 'sh-a', student_id: 'elev-b', subject: 'Matematik',
        tjanst: 'laxhjalp', wanted_date: dag(1), wanted_time: '18:00', duration_min: 60, status: 'confirmed',
        betalning_status: 'ingen', fakturerbar: true, startrabatt: false, timpris_ore: 39900, extra_ore: 6900,
        antal_barn: 1, created_at: nu(-9000) },
      { id: 'pass-k3', parent_id: 'fam-b', tutor_id: 'sh-a', student_id: 'elev-b', subject: 'Fysik',
        tjanst: 'laxhjalp', wanted_date: dag(-2), wanted_time: '18:00', duration_min: 60, status: 'completed',
        betalning_status: 'ingen', fakturerbar: true, startrabatt: false, timpris_ore: 39900, extra_ore: 6900,
        antal_barn: 1, created_at: nu(-9000) }
    ],
    klippkort_saldo: [Object.assign({}, PLAN_DENNA)],
    klippkort: [{ id: 'plan-denna', stripe_skarp: true }],
    erbjudanden_pris: [
      { kod: 'plan_basic', sort: 'plan', namn: 'Basic', timmar: 4, rabatt_procent: 5, giltig_manader: 1,
        ordning: 1, timpris_ore: 39900, ordinarie_ore: 159600, pris_ore: 151600, rabatterat_timpris_ore: 37900,
        timmar_pa_kopet: 0 },
      { kod: 'plan_standard', sort: 'plan', namn: 'Standard', timmar: 8, rabatt_procent: 5, giltig_manader: 1,
        ordning: 2, timpris_ore: 39900, ordinarie_ore: 319200, pris_ore: 303200, rabatterat_timpris_ore: 37900,
        timmar_pa_kopet: 0 },
      { kod: 'klipp10', sort: 'klippkort', namn: '10 timmar', timmar: 10, rabatt_procent: 0, giltig_manader: 6,
        ordning: 10, timpris_ore: 39900, ordinarie_ore: 399000, pris_ore: 399000, rabatterat_timpris_ore: 39900,
        timmar_pa_kopet: 0 }
    ],
    /* Liggaren: en plan med kod, ett pass delvis tillbaka, ett tillägg,
       ett testköp och en betalning som inte kunde skrivas ner. */
    betalningar: [
      { id: 'lig-1', familj: 'fam-a', typ: 'plan', erbjudande: 'plan_standard', klippkort_id: 'plan-denna',
        booking_id: null, belopp_ore: 303200, aterbetalt_ore: 0, valuta: 'sek', status: 'betald', kod: 'VAN10',
        stripe_payment_intent: 'pi_plan1', stripe_charge: 'ch_plan1', avgift_ore: 5000, netto_ore: 298200,
        skarp: true, utan_rad: false, betald_at: nu(-2880), bokford_at: nu(-2880), andrad_at: null },
      { id: 'lig-2', familj: 'fam-a', typ: 'pass', erbjudande: null, klippkort_id: null, booking_id: 'pass-2',
        belopp_ore: 39900, aterbetalt_ore: 10000, valuta: 'sek', status: 'delvis_aterbetald', kod: null,
        stripe_payment_intent: 'pi_pass2', stripe_charge: 'ch_pass2', skarp: true, utan_rad: false,
        betald_at: nu(-20000), bokford_at: nu(-20000), andrad_at: nu(-3000) },
      { id: 'lig-3', familj: 'fam-b', typ: 'tillagg', erbjudande: null, klippkort_id: null, booking_id: 'pass-k3',
        belopp_ore: 10000, aterbetalt_ore: 0, valuta: 'sek', status: 'betald', kod: null,
        stripe_payment_intent: 'pi_till3', stripe_charge: 'ch_till3', skarp: true, utan_rad: false,
        betald_at: nu(-4000), bokford_at: nu(-4000), andrad_at: null },
      { id: 'lig-4', familj: 'fam-b', typ: 'timbank', erbjudande: 'klipp10', klippkort_id: 'kk-test', booking_id: null,
        belopp_ore: 399000, aterbetalt_ore: 0, valuta: 'sek', status: 'betald', kod: null,
        stripe_payment_intent: 'pi_test4', stripe_charge: 'ch_test4', skarp: false, utan_rad: false,
        betald_at: nu(-5000), bokford_at: nu(-5000), andrad_at: null },
      { id: 'lig-5', familj: 'fam-a', typ: 'pass', erbjudande: null, klippkort_id: null, booking_id: 'pass-1',
        belopp_ore: 39900, aterbetalt_ore: 0, valuta: 'sek', status: 'betald', kod: null,
        stripe_payment_intent: 'pi_utan5', stripe_charge: null, skarp: true, utan_rad: true,
        betald_at: nu(-7000), bokford_at: nu(-7000), andrad_at: null }
    ],
    kortreservationer: [
      { booking_id: 'pass-k1', parent_id: 'fam-a', lage: 'misslyckad', fel: 'card_declined', forsok: 2,
        nekad_sedan: nu(-600), stripe_reservation: null, reserverat_ore: null, dragen_ore: null, andrad: nu(-120) },
      { booking_id: 'pass-k2', parent_id: 'fam-b', lage: 'reserverad', fel: null, forsok: 1, nekad_sedan: null,
        stripe_reservation: 'pi_res2', reserverat_ore: 39900, dragen_ore: null, andrad: nu(-300) },
      { booking_id: 'pass-k3', parent_id: 'fam-b', lage: 'misslyckad', fel: 'authentication_required', forsok: 1,
        nekad_sedan: nu(-90), stripe_reservation: null, reserverat_ore: null, dragen_ore: null, andrad: nu(-90) }
    ],
    betalning_installning: [{ id: 1, automatiska_forsok: 3, timmar_mellan_forsok: 6, larm_efter_timmar: 24,
      sen_avbokning_timmar: 0, andrad_at: null }]
  };
}

function falskSupabase(o) {
  const ANV = (o && o.anv) || ADMIN;
  const W = värld();
  if (o && o.värld) o.värld(W);
  const logg = [];
  const svar = (route, status, kropp, extra) => route.fulfill({
    status,
    headers: Object.assign({
      'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
      'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range, x-total-count'
    }, extra || {}),
    body: kropp === undefined ? '' : JSON.stringify(kropp)
  });
  const session = () => ({ access_token: jwt(ANV.id, 'authenticated'), refresh_token: 'prov', token_type: 'bearer',
    expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: ANV });
  function filtrera(rader, sök) {
    let ut = rader.slice();
    for (const [k, v] of sök.entries()) {
      if (['select', 'order', 'limit', 'offset', 'columns', 'or'].includes(k)) continue;
      const m = /^eq\.(.*)$/.exec(v);
      if (m) ut = ut.filter(r => String(r[k]) === m[1]);
      const ne = /^neq\.(.*)$/.exec(v);
      if (ne) ut = ut.filter(r => String(r[k]) !== ne[1]);
      const gt = /^gt\.(.*)$/.exec(v);
      if (gt) ut = ut.filter(r => Number(r[k]) > Number(gt[1]));
      const i = /^in\.\((.*)\)$/.exec(v);
      if (i) { const l = i[1].split(',').map(x => x.replace(/^"|"$/g, '')); ut = ut.filter(r => l.includes(String(r[k]))); }
      if (v === 'is.null') ut = ut.filter(r => r[k] == null);
    }
    return ut;
  }
  const familj = ANV.id !== 'admin-1';
  /* Utan migrationerna: liggaren, inställningen och månaderna finns inte. */
  const SAKNAS = o && o.utanMigrationen
    ? ['betalningar', 'betalning_installning', 'planens_manader', 'klippkort_aterbetalning_lage', 'kortreservation_forsok_nu']
    : [];
  const RPC = {
    mina_behorigheter: () => (familj ? { admin: false, superadmin: false, behorigheter: [] }
      : { admin: true, superadmin: true, behorigheter: [] }),
    notisfel: () => [], ekonomiska_avvikelser: () => [],
    admin_sett_markera: k => k.p_till,
    mitt_villkorslage: () => ({ version: '2026-10-21', godkant_at: '2026-10-21T09:00:00+00:00', tidigare: false }),
    forsta_timmen_lage: () => ({ beviljad: false, tagen: true, i_planen: true, pa_pass: false }),
    min_familjerabatt: () => 0,
    planens_manader: () => ({ denna: DENNA, nasta: NASTA, idag: IDAG }),
    extra_timmar_erbjudande: k => ({ ok: true, plan: 'plan-denna', plan_namn: 'Standard', timmar: k.p_timmar,
      timpris_ore: 39900, rabatt_procent: 5, rabatterat_timpris_ore: 37900, familjerabatt_ore: 0,
      pris_ore: 37900 * k.p_timmar, giltigt_till: sista(DENNA) }),
    /* Vad en återbetalning av ett köp blir, som databasen räknar det. */
    klippkort_aterbetalning_lage: k => {
      const kvar = 3;
      const hela = k.p_timmar == null || k.p_timmar >= kvar;
      return { ok: true, klippkort: k.p_id, namn: 'Standard', familj: 'fam-a', pi: 'pi_plan1', hela,
        timmar: hela ? kvar : k.p_timmar, kvar_betalda: kvar, kvar, per_timme_ore: 37900,
        belopp_ore: hela ? 103700 : 37900 * k.p_timmar, vid_uppsagning_ore: 103700, betalt_ore: 303200,
        aterbetald_ore: 0, giltigt_till: sista(DENNA), utgangen: false };
    },
    kortreservation_forsok_nu: k => {
      const r = W.kortreservationer.find(x => x.booking_id === k.p_bokning && x.lage === 'misslyckad');
      if (!r) return 'inget att försöka igen';
      Object.assign(r, { lage: 'vald', andrad: nu(0) });
      return 'vald';
    }
  };
  const FUNKTION = {
    'stripe-checkout': () => [409, { error: 'Provet öppnar ingen kassa.' }],
    'stripe-aterbetalning': k => [200, { ok: true, aterbetalning: 're_prov', belopp_ore: 75800, timmar: k.timmar,
      hela: false, varning: null }]
  };
  async function hantera(route) {
    const req = route.request();
    const url = new URL(req.url());
    const metod = req.method();
    if (metod === 'OPTIONS') return svar(route, 204);
    let kropp = null;
    try { kropp = req.postDataJSON(); } catch (e) { kropp = req.postData(); }
    logg.push({ metod, väg: url.pathname, sök: url.search, kropp });
    const p = url.pathname;
    if (p === '/auth/v1/token') return svar(route, 200, session());
    if (p === '/auth/v1/user') return svar(route, 200, ANV);
    if (p.startsWith('/auth/v1/')) return svar(route, 200, {});
    if (p.startsWith('/functions/v1/')) {
      const f = FUNKTION[p.slice('/functions/v1/'.length)];
      if (!f) return svar(route, 404, {});
      const [status, ut] = f(kropp || {});
      return svar(route, status, ut);
    }
    if (p.startsWith('/storage/v1/')) return svar(route, 200, {});
    if (p.startsWith('/rest/v1/rpc/')) {
      const namn = p.slice('/rest/v1/rpc/'.length);
      const f = SAKNAS.includes(namn) ? null : RPC[namn];
      if (!f) return svar(route, 404, { code: 'PGRST202', message: 'Could not find the function' });
      return svar(route, 200, f(kropp || {}));
    }
    if (p.startsWith('/rest/v1/')) {
      const tabell = p.slice('/rest/v1/'.length);
      if (SAKNAS.includes(tabell)) {
        return svar(route, 404, { code: 'PGRST205', message: 'Could not find the table public.' + tabell + ' in the schema cache' });
      }
      const ett = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
      if (metod === 'GET' || metod === 'HEAD') {
        const rader = filtrera(W[tabell] || [], url.searchParams);
        const cr = rader.length ? '0-' + (rader.length - 1) + '/' + rader.length : '*/0';
        if (ett) return rader.length ? svar(route, 200, rader[0], { 'content-range': cr }) : svar(route, 406, { code: 'PGRST116', message: 'no rows' });
        return svar(route, 200, rader, { 'content-range': cr });
      }
      if (metod === 'PATCH') {
        const träff = filtrera(W[tabell] || [], url.searchParams);
        träff.forEach(r => Object.assign(r, kropp || {}));
        const vill = (req.headers()['prefer'] || '').includes('return=representation');
        return vill ? svar(route, 200, träff) : svar(route, 204);
      }
      if (metod === 'POST') {
        const rad = Object.assign({ id: tabell + '-' + logg.length, created_at: nu(0) }, kropp || {});
        (W[tabell] = W[tabell] || []).push(rad);
        return ett ? svar(route, 201, rad) : svar(route, 201, [rad]);
      }
      return svar(route, 405, {});
    }
    return svar(route, 404, {});
  }
  return { W, logg, hantera, session };
}

async function öppna(webb, o) {
  const context = await webb.newContext(Object.assign({ viewport: { width: 1280, height: 900 },
    timezoneId: 'Europe/Stockholm' }, (o && o.context) || {}));
  const S = falskSupabase(o);
  const riktiga = [];
  const konsol = [];
  await context.route(RIKTIG, route => { riktiga.push(route.request().url()); return route.abort(); });
  await context.route(/nextrum-config\.js/, async route => {
    const t = fs.readFileSync(path.join(ROT, 'nextrum-config.js'), 'utf8')
      .replace(/SUPABASE_URL:\s*'[^']*'/, "SUPABASE_URL: '" + FALSK + "'");
    return route.fulfill({ status: 200, contentType: 'application/javascript', body: t });
  });
  await context.route(/^https:\/\/supabase\.test\//, S.hantera);
  await context.routeWebSocket(/supabase\.test/, () => {});
  await context.route(url => !String(url).startsWith(BAS) && !/supabase\.test/.test(String(url)), route => route.abort());
  await context.addInitScript(([nyckel, värde]) => {
    try { localStorage.setItem(nyckel, värde); sessionStorage.setItem('nx-notisruta-visad', '1'); } catch (e) { /* ingen lagring */ }
  }, [LAGRING, JSON.stringify(S.session())]);
  const page = await context.newPage();
  page.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource|PGRST20[25]|Could not find the (table|function)|Provet öppnar ingen kassa/.test(m.text())) {
      konsol.push(m.text());
    }
  });
  page.on('pageerror', e => konsol.push('pageerror: ' + e.message));
  return { context, page, S, riktiga, konsol };
}

const synlig = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const text = (page, sel) => page.locator(sel).first().innerText().catch(() => '');
/* textContent, inte innerText: det som står i DOM:en, också det som inte syns. */
const innehåll = (page, sel) => page.locator(sel).first().textContent().catch(() => '');
async function bild(page, namn, sel) {
  if (!BILDER) return;
  fs.mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: path.join(BILDER, namn + '.png'), fullPage: false });
  if (sel) await page.locator(sel).first().screenshot({ path: path.join(BILDER, namn + '-del.png') }).catch(() => {});
}
const ingenSidled = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const kassor = S => S.logg.filter(r => r.metod === 'POST' && r.väg === '/functions/v1/stripe-checkout');
/* Allt som skriver: allt utom läsningar, och en RPC är en POST. */
const skrivningar = S => S.logg.filter(r => r.metod !== 'GET' && r.metod !== 'HEAD' && !/^\/auth\//.test(r.väg))
  .map(r => r.metod + ' ' + r.väg);

async function tillErbjudanden(page) {
  await page.goto(BAS + '/foralder#erbjudanden');
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
  await page.waitForSelector('#erb-planer .erb-kort', { timeout: 8000 }).catch(() => {});
  await vänta(700);
}
async function tillAdmin(page, sek) {
  await page.goto(BAS + '/admin#' + sek);
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
  await vänta(1000);
}
const villkorsruta = '.nx-kassa-villkor';
async function kryssaOchTillKassan(page) {
  await page.click(villkorsruta + ' [data-kassa-kryss]').catch(() => {});
  await page.click(villkorsruta + ' [data-svar="ja"]').catch(() => {});
  await vänta(700);
}

/* ============ 1. Timbanken och planerna per månad ============ */
async function provaMånaderna(webb) {
  const { context, page, S, riktiga, konsol } = await öppna(webb, { anv: FAMILJ });
  /* Kassans nej är en alert (startaKassa); Playwright stänger den. */
  const larm = [];
  page.on('dialog', d => { larm.push(d.message()); d.dismiss().catch(() => {}); });
  await tillErbjudanden(page);

  /* Er timbank: båda månaderna, med textContent. */
  const rader = await page.locator('#erb-mina .tb-manad').allTextContents().catch(() => []);
  prova('timbanken: två månader under batteriet', rader.length === 2, rader.join(' | '));
  prova('timbanken: den här månaden "3 av 8 timmar återstår" och sista dagen',
    (rader[0] || '').includes(stor(månad(DENNA))) && /3 av 8 timmar återstår/.test(rader[0] || '')
      && /Går ut/.test(rader[0] || ''), rader[0]);
  prova('timbanken: nästa månad utan plan är "0 av 0"',
    (rader[1] || '').includes(stor(månad(NASTA))) && /0 av 0 timmar återstår/.test(rader[1] || '')
      && (rader[1] || '').includes(NÄSTA_TEXT), rader[1]);
  prova('timbanken: inget odefinierat i texten', !/undefined|NaN|null/.test(await innehåll(page, '#erb-mina-box')),
    await innehåll(page, '#erb-mina-box'));
  prova('timbanken: batteriet räknar den här månadens timmar',
    /3 av 8 timmar kvar/.test(await innehåll(page, '#erb-mina-box .tb-batteri-tal')),
    await innehåll(page, '#erb-mina-box .tb-batteri-tal'));
  await bild(page, 'timbanken-manader', '#erb-mina-box');

  /* Plankorten: Den här månaden som förval, och Fyll timbanken utan val. */
  const val = await page.locator('#erb-planer [data-erb-manad]').count();
  prova('planerna: två månadsval per plan, inget på Fyll timbanken', val === 4
    && (await page.locator('#erb-planer .erb-klippkol [data-erb-manad]').count()) === 0, String(val));
  const tryckt = sel => page.locator(sel).first().getAttribute('aria-pressed').catch(() => null);
  prova('planerna: Den här månaden är valt från början',
    (await tryckt('[data-erb-manad="denna"][data-erb-kod="plan_standard"]')) === 'true'
      && (await tryckt('[data-erb-manad="nasta"][data-erb-kod="plan_standard"]')) === 'false');
  prova('planerna: raden under säger till vilken dag planen gäller',
    /^Gäller till och med \d{1,2} \S+/.test(await innehåll(page, '[data-erb-manad-not="plan_standard"]')),
    await innehåll(page, '[data-erb-manad-not="plan_standard"]'));
  const kortet = page.locator('#erb-planer .erb-kort', { has: page.locator('[data-kop="plan_standard"]') }).first();
  const höjdFöre = await kortet.evaluate(el => el.getBoundingClientRect().height).catch(() => -1);
  await page.click('[data-erb-manad="nasta"][data-erb-kod="plan_standard"]');
  await vänta(150);
  prova('planerna: Nästa månad väljs, och raden säger månaden',
    (await tryckt('[data-erb-manad="nasta"][data-erb-kod="plan_standard"]')) === 'true'
      && (await tryckt('[data-erb-manad="denna"][data-erb-kod="plan_standard"]')) === 'false'
      && (await innehåll(page, '[data-erb-manad-not="plan_standard"]')) === NÄSTA_TEXT,
    await innehåll(page, '[data-erb-manad-not="plan_standard"]'));
  prova('planerna: valet gäller bara sin plan',
    (await tryckt('[data-erb-manad="denna"][data-erb-kod="plan_basic"]')) === 'true');
  const höjdEfter = await kortet.evaluate(el => el.getBoundingClientRect().height).catch(() => -2);
  prova('planerna: kortet byter inte höjd när månaden väljs', Math.abs(höjdFöre - höjdEfter) < 1,
    höjdFöre + ' mot ' + höjdEfter);
  const minHöjd = await page.locator('#erb-planer [data-erb-manad]').evaluateAll(l =>
    Math.min(...l.map(el => el.getBoundingClientRect().height)));
  prova('planerna: månadsknapparna är minst 44 px', minHöjd >= 44, String(minHöjd));
  await bild(page, 'planerna-manad', '#erb-planer');

  /* Köp: rutan med köpvillkoren, som avbryts och sedan godkänns. */
  await page.click('[data-kop="plan_standard"]');
  await page.waitForSelector(villkorsruta + ' [data-kassa-kryss]', { timeout: 4000 }).catch(() => {});
  const ruta = await innehåll(page, villkorsruta);
  prova('kassan: rutan säger vad som köps, priset och månaden',
    /Köp Standard/.test(ruta) && /8 timmar/.test(ruta) && /3\s?032\s*kr/.test(ruta) && ruta.includes(NÄSTA_TEXT), ruta);
  prova('kassan: krysset har fokus, och Till kassan går inte att trycka på före det',
    await page.evaluate(sel => {
      const ja = document.querySelector(sel + ' [data-svar="ja"]');
      return !!ja && ja.disabled && document.activeElement === document.querySelector(sel + ' [data-kassa-kryss]');
    }, villkorsruta));
  prova('kassan: länken går till köpvillkoren',
    (await page.locator(villkorsruta + ' a').first().getAttribute('href').catch(() => '')) === '/anvandarvillkor#kopvillkor');
  await bild(page, 'kassan-villkor', villkorsruta + ' .nx-fraga-box');
  await page.click(villkorsruta + ' [data-svar="ja"]', { force: true, timeout: 1000 }).catch(() => {});
  await vänta(200);
  prova('kassan: ett tryck på Till kassan utan kryss gör ingenting',
    kassor(S).length === 0 && await synlig(page, villkorsruta));
  await page.keyboard.press('Escape');
  await vänta(250);
  prova('kassan: Escape stänger rutan, och ingen kassa öppnas',
    !(await synlig(page, villkorsruta)) && kassor(S).length === 0);

  await page.click('[data-kop="plan_standard"]');
  await page.waitForSelector(villkorsruta + ' [data-kassa-kryss]', { timeout: 4000 }).catch(() => {});
  await page.click(villkorsruta + ' [data-kassa-kryss]');
  prova('kassan: krysset släpper fram Till kassan',
    await page.evaluate(sel => !document.querySelector(sel + ' [data-svar="ja"]').disabled, villkorsruta));
  await page.click(villkorsruta + ' [data-svar="ja"]');
  await vänta(800);
  const k = (kassor(S).pop() || {}).kropp || {};
  prova('kassan: anropet bär planen, nästa månad och krysset, aldrig ett belopp',
    k.erbjudande === 'plan_standard' && k.manad === 'nasta' && k.villkor === true
      && !('belopp_ore' in k) && !('pris' in k) && !('pris_ore' in k), JSON.stringify(k));
  prova('kassan: kassans nej säger funktionens egen text', larm.includes('Provet öppnar ingen kassa.'), larm.join(' | '));

  /* Fyll timbanken: ingen månad i anropet. */
  await page.click('#erb-planer .erb-klippkol summary').catch(() => {});
  await vänta(250);
  await page.click('[data-kop="klipp10"]').catch(() => {});
  await page.waitForSelector(villkorsruta + ' [data-kassa-kryss]', { timeout: 4000 }).catch(() => {});
  await kryssaOchTillKassan(page);
  const k2 = (kassor(S).pop() || {}).kropp || {};
  prova('kassan: Fyll timbanken bär ingen månad', k2.erbjudande === 'klipp10' && !('manad' in k2) && k2.villkor === true,
    JSON.stringify(k2));

  /* Profil → Timbanken visar samma månader. */
  await page.evaluate(() => { location.hash = '#profil/timbank'; });
  await page.waitForSelector('#timbank-timmar .tb-manad', { timeout: 5000 }).catch(() => {});
  const profil = await page.locator('#timbank-timmar .tb-manad').allTextContents().catch(() => []);
  prova('profilen: Timbanken visar båda månaderna', profil.length === 2 && /3 av 8 timmar återstår/.test(profil[0] || '')
    && /0 av 0 timmar återstår/.test(profil[1] || ''), profil.join(' | '));
  prova('månaderna: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('månaderna: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 2. Nästa månads plan, och timmar som betalats tillbaka ============ */
async function provaKöptaMånader(webb) {
  {
    const { context, page, konsol } = await öppna(webb, { anv: FAMILJ,
      värld: W => { W.klippkort_saldo.push(Object.assign({}, PLAN_NASTA)); } });
    await tillErbjudanden(page);
    const rader = await page.locator('#erb-mina .tb-manad').allTextContents().catch(() => []);
    prova('nästa månads plan: "4 av 4 timmar återstår" i nästa månad', /4 av 4 timmar återstår/.test(rader[1] || '')
      && /3 av 8 timmar återstår/.test(rader[0] || ''), rader.join(' | '));
    prova('nästa månads plan: batteriet räknar den inte än',
      /3 av 8 timmar kvar/.test(await innehåll(page, '#erb-mina-box .tb-batteri-tal')),
      await innehåll(page, '#erb-mina-box .tb-batteri-tal'));
    const kommande = page.locator('#erb-mina .erb-mitt.ar-kommande');
    prova('nästa månads plan: står i listan med sin månad',
      (await kommande.count()) === 1 && (await kommande.first().textContent()).includes(NÄSTA_TEXT)
        && /Basic/.test(await kommande.first().textContent()), await innehåll(page, '#erb-mina'));
    prova('nästa månads plan: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await bild(page, 'timbanken-nasta-manad', '#erb-mina-box');
    await context.close();
  }
  {
    const { context, page, konsol } = await öppna(webb, { anv: FAMILJ,
      värld: W => { Object.assign(W.klippkort_saldo[0], { aterbetalda_timmar: 2, kvar: 1 }); } });
    await tillErbjudanden(page);
    const rader = await page.locator('#erb-mina .tb-manad').allTextContents().catch(() => []);
    prova('återbetalda timmar: räknas inte i månaden ("1 av 6")', /1 av 6 timmar återstår/.test(rader[0] || ''),
      rader.join(' | '));
    prova('återbetalda timmar: inte heller på köpets rad',
      /1 av 6 timmar kvar/.test(await innehåll(page, '#erb-mina .erb-mitt:not(.ar-kommande) .erb-kvar')),
      await innehåll(page, '#erb-mina'));
    prova('återbetalda timmar: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
}

/* ============ 3. Utan migrationerna ============ */
async function provaUtanMånader(webb) {
  const { context, page, S, konsol } = await öppna(webb, { anv: FAMILJ, utanMigrationen: true });
  await tillErbjudanden(page);
  prova('utan migrationen: inget månadsval och inga månader i timbanken',
    (await page.locator('[data-erb-manad]').count()) === 0 && (await page.locator('.tb-manader').count()) === 0
      && (await page.locator('[data-kop="plan_standard"]').count()) === 1);
  await page.click('[data-kop="plan_standard"]');
  await page.waitForSelector(villkorsruta + ' [data-kassa-kryss]', { timeout: 4000 }).catch(() => {});
  prova('utan migrationen: köpvillkoren frågas ändå', await synlig(page, villkorsruta));
  await kryssaOchTillKassan(page);
  const k = (kassor(S).pop() || {}).kropp || {};
  prova('utan migrationen: kassan får ingen månad', k.erbjudande === 'plan_standard' && !('manad' in k) && k.villkor === true,
    JSON.stringify(k));
  prova('utan migrationen: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 4. Ett pass betalas med kort ============ */
async function provaPasset(webb) {
  const { context, page, S, konsol } = await öppna(webb, { anv: FAMILJ });
  await page.goto(BAS + '/foralder#pass/pass-1');
  await page.waitForSelector('#pass-sida [data-betala]', { timeout: 10000 }).catch(() => {});
  await vänta(300);
  await page.click('#pass-sida [data-betala]').catch(() => {});
  await page.waitForSelector(villkorsruta + ' [data-kassa-kryss]', { timeout: 4000 }).catch(() => {});
  const ruta = await innehåll(page, villkorsruta);
  prova('passet: köpvillkoren före kassan, med passet', /Betala passet/.test(ruta) && /Matematik/.test(ruta), ruta);
  await page.click(villkorsruta + ' [data-svar="nej"]');
  await vänta(250);
  prova('passet: Avbryt öppnar ingen kassa', kassor(S).length === 0 && !(await synlig(page, villkorsruta)));
  await page.click('#pass-sida [data-betala]').catch(() => {});
  await page.waitForSelector(villkorsruta + ' [data-kassa-kryss]', { timeout: 4000 }).catch(() => {});
  await kryssaOchTillKassan(page);
  const k = (kassor(S).pop() || {}).kropp || {};
  prova('passet: kassan får passet och krysset, aldrig ett belopp',
    k.pass === 'pass-1' && k.villkor === true && !('belopp_ore' in k) && !('pris' in k), JSON.stringify(k));
  prova('passet: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 5. Tillbaka från Stripe skriver ingenting ============ */
async function provaTillbaka(webb) {
  let vanlig;
  {
    const { context, page, S } = await öppna(webb, { anv: FAMILJ });
    await tillErbjudanden(page);
    await vänta(5600);
    vanlig = new Set(skrivningar(S));
    await context.close();
  }
  const { context, page, S, konsol } = await öppna(webb, { anv: FAMILJ });
  await page.goto(BAS + '/foralder?kopt=cs_test_prov#erbjudanden');
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
  await vänta(6200);
  const egna = skrivningar(S).filter(s => !vanlig.has(s));
  prova('tillbaka: beskedet står, och adressen är städad',
    /Köpet är klart/.test(await innehåll(page, '#erb-msg')) && !/kopt=/.test(page.url()),
    (await innehåll(page, '#erb-msg')) + ' ' + page.url());
  prova('tillbaka: inget skrivs för att familjen kommit tillbaka', egna.length === 0, egna.join(', '));
  prova('tillbaka: inget anrop till kassan eller till webhooken',
    !S.logg.some(r => /\/functions\/v1\/stripe-/.test(r.väg)), S.logg.filter(r => /functions/.test(r.väg)).map(r => r.väg).join(', '));
  prova('tillbaka: timbanken läses om', S.logg.filter(r => r.väg === '/rest/v1/klippkort_saldo').length >= 2);
  prova('tillbaka: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 6. Telefonen och mörkt läge ============ */
async function provaTelefonOchMörkt(webb) {
  {
    const { context, page, konsol } = await öppna(webb, { anv: FAMILJ,
      context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } });
    await tillErbjudanden(page);
    prova('telefon: ingen sidledsscroll under Erbjudanden', await ingenSidled(page));
    const minHöjd = await page.locator('#erb-planer [data-erb-manad]').evaluateAll(l =>
      Math.min(...l.map(el => el.getBoundingClientRect().height)));
    prova('telefon: månadsknapparna är minst 44 px', minHöjd >= 44, String(minHöjd));
    await bild(page, 'telefon-planerna', '#erb-planer');
    await page.click('[data-kop="plan_basic"]');
    await page.waitForSelector(villkorsruta + ' [data-kassa-kryss]', { timeout: 4000 }).catch(() => {});
    const ruta = await page.locator(villkorsruta + ' .nx-fraga-box').boundingBox().catch(() => null);
    prova('telefon: rutan med köpvillkoren ryms', !!ruta && ruta.x >= 0 && ruta.x + ruta.width <= 390 + 0.5,
      JSON.stringify(ruta));
    const kryss = await page.locator(villkorsruta + ' .nx-kassa-kryss').boundingBox().catch(() => null);
    prova('telefon: krysset är en tryckyta på minst 44 px', !!kryss && kryss.height >= 44, JSON.stringify(kryss));
    await bild(page, 'telefon-kassan', villkorsruta + ' .nx-fraga-box');
    prova('telefon: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
  {
    const { context, page, konsol } = await öppna(webb, { anv: FAMILJ, context: { colorScheme: 'dark' } });
    await tillErbjudanden(page);
    const färg = sel => page.locator(sel).first().evaluate(el => getComputedStyle(el).backgroundColor).catch(() => '');
    const på = await färg('[data-erb-manad="denna"][data-erb-kod="plan_standard"]');
    const av = await färg('[data-erb-manad="nasta"][data-erb-kod="plan_standard"]');
    prova('mörkt: det valda månadsvalet syns', på && av && på !== av, på + ' mot ' + av);
    const tal = await page.locator('#erb-mina .tb-manad-tal').first().evaluate(el => getComputedStyle(el).color).catch(() => '');
    const yta = await page.locator('#erb-mina-box').first().evaluate(el => getComputedStyle(el).backgroundColor).catch(() => '');
    prova('mörkt: månadernas text har en egen färg mot ytan', tal && tal !== yta, tal + ' på ' + yta);
    await page.click('[data-kop="plan_standard"]');
    await page.waitForSelector(villkorsruta + ' [data-kassa-kryss]', { timeout: 4000 }).catch(() => {});
    const box = await färg(villkorsruta + ' .nx-fraga-box');
    prova('mörkt: rutan med köpvillkoren har en yta', box && box !== 'rgba(0, 0, 0, 0)', box);
    await bild(page, 'mork-kassan', villkorsruta + ' .nx-fraga-box');
    prova('mörkt: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
}

/* ============ 7. Adminvyn: Liggaren ============ */
async function provaLiggaren(webb) {
  const { context, page, S, riktiga, konsol } = await öppna(webb, {});
  await tillAdmin(page, 'ekonomi/liggaren');
  await page.waitForSelector('#lig-lista .eko-rad', { timeout: 6000 }).catch(() => {});
  prova('liggaren: fliken finns och öppnas från adressen', await synlig(page, '#panel-liggaren #lig-lista'));
  const sam = await innehåll(page, '#lig-sam');
  prova('liggaren: summorna räknar bara skarpa betalningar',
    /Inbetalt\s*3\s?930\s*kr\s*4 betalningar/.test(sam) && /Tillbaka till familjer\s*100\s*kr/.test(sam)
      && /Netto\s*3\s?830\s*kr/.test(sam), sam);
  prova('liggaren: en rad per betalning, testköpet med', (await page.locator('#lig-lista .eko-rad').count()) === 5);
  const plan = await innehåll(page, '[data-lig-rad="lig-1"]');
  prova('liggaren: köpet med namn, kod, läge och belopp',
    /Standard/.test(plan) && /Kod VAN10/.test(plan) && /Betald/.test(plan) && /3\s?032\s*kr/.test(plan)
      && (await page.locator('[data-lig-rad="lig-1"] [data-aterbetala-kop="plan-denna"]').count()) === 1, plan);
  const pass = await innehåll(page, '[data-lig-rad="lig-2"]');
  prova('liggaren: passet delvis tillbaka, med passets knapp',
    /Delvis tillbaka/.test(pass) && /100\s*kr tillbaka/.test(pass)
      && (await page.locator('[data-lig-rad="lig-2"] [data-aterbetala="pass-2"]').count()) === 1, pass);
  prova('liggaren: tillägget och betalningen utan rad betalas tillbaka i Stripe',
    /Betalas tillbaka i Stripe/.test(await innehåll(page, '[data-lig-rad="lig-3"]'))
      && /Inte nedskriven på sin rad/.test(await innehåll(page, '[data-lig-rad="lig-5"]'))
      && /Betalas tillbaka i Stripe/.test(await innehåll(page, '[data-lig-rad="lig-5"]')));
  prova('liggaren: testköpet är märkt', /Test/.test(await innehåll(page, '[data-lig-rad="lig-4"] .eko-lage')));
  prova('liggaren: finstilen säger att raderna aldrig raderas', /raderas aldrig/.test(await innehåll(page, '#lig-fot')));
  await bild(page, 'liggaren', '#panel-liggaren');

  const filter = async (k, väntat, namn) => {
    await page.click('[data-lig-filter="' + k + '"]');
    await vänta(120);
    const id = await page.locator('#lig-lista .eko-rad').evaluateAll(l => l.map(el => el.dataset.ligRad));
    prova('liggaren: ' + namn, JSON.stringify(id) === JSON.stringify(väntat), JSON.stringify(id));
  };
  await filter('plan', ['lig-1'], 'Planer visar planen');
  await filter('test', ['lig-4'], 'Test visar bara testköpet');
  await filter('tillbaka', ['lig-2'], 'Tillbaka visar det som gått tillbaka');
  await filter('alla', ['lig-1', 'lig-2', 'lig-3', 'lig-4', 'lig-5'], 'Alla visar allt');
  await page.fill('#lig-sok', 'pi_utan5');
  await vänta(150);
  prova('liggaren: sökningen hittar Stripes id',
    JSON.stringify(await page.locator('#lig-lista .eko-rad').evaluateAll(l => l.map(el => el.dataset.ligRad))) === '["lig-5"]');
  await page.fill('#lig-sok', '');
  await vänta(150);

  /* Återbetala ett köp: antalet timmar, aldrig ett belopp. */
  await page.click('[data-aterbetala-kop="plan-denna"]');
  await page.waitForSelector('.nx-fraga-box #lig-timmar', { timeout: 4000 }).catch(() => {});
  const fråga = await innehåll(page, '.nx-fraga-box');
  prova('återbetala köp: rutan säger hela köpet och priset per timme',
    /Betala tillbaka Standard\?/.test(fråga) && /Hela köpet: 3 timmar, 1\s?037\s*kr/.test(fråga)
      && /379\s*kr per timme/.test(fråga) && /aldrig de som redan använts/.test(fråga), fråga);
  await page.check('.nx-fraga-box input[name="lig-hur"][value="del"]');
  await page.fill('#lig-timmar', '3');
  await page.click('.nx-fraga-box [data-fr="ja"]');
  await vänta(200);
  prova('återbetala köp: lika många timmar som är kvar är hela köpet, inte en del',
    /Välj mellan 1 och 2 timmar/.test(await innehåll(page, '#fr-msg'))
      && !S.logg.some(r => r.väg === '/functions/v1/stripe-aterbetalning'), await innehåll(page, '#fr-msg'));
  await page.fill('#lig-timmar', '2');
  await page.fill('#lig-anledning', 'ångrade två timmar');
  await page.click('.nx-fraga-box [data-fr="ja"]');
  await vänta(800);
  const åter = (S.logg.filter(r => r.väg === '/functions/v1/stripe-aterbetalning').pop() || {}).kropp || {};
  prova('återbetala köp: funktionen får köpet och timmarna, aldrig ett belopp',
    åter.klippkort === 'plan-denna' && åter.timmar === 2 && åter.anledning === 'ångrade två timmar'
      && !('belopp_ore' in åter), JSON.stringify(åter));
  prova('återbetala köp: liggaren läses om efteråt',
    S.logg.filter(r => r.väg === '/rest/v1/betalningar').length >= 2);

  /* Telefonen: ingen sidledsscroll. */
  await page.setViewportSize({ width: 390, height: 844 });
  await vänta(300);
  prova('liggaren på telefon: ingen sidledsscroll', await ingenSidled(page));
  await bild(page, 'liggaren-telefon', '#panel-liggaren');
  await page.setViewportSize({ width: 1280, height: 900 });

  /* ============ Kortet ============ */
  await page.click('#flik-kortdragning');
  await page.waitForSelector('#kd-lista .eko-rad', { timeout: 5000 }).catch(() => {});
  const kortRader = await page.locator('#kd-lista .eko-rad').allTextContents();
  prova('kortet: tre pass, de nekade överst', kortRader.length === 3 && /Nekad/.test(kortRader[0] || '')
    && /Nekad/.test(kortRader[1] || '') && /Reserverad/.test(kortRader[2] || ''), kortRader.join(' | '));
  const nekat = kortRader.find(t => /card_declined/.test(t)) || '';
  prova('kortet: det nekade säger koden, försöken och nästa försök',
    /2 försök/.test(nekat) && /Nekad sedan/.test(nekat) && /Nästa försök/.test(nekat) && /Svenska/.test(nekat), nekat);
  const bekräfta = kortRader.find(t => /authentication_required/.test(t)) || '';
  prova('kortet: ett kort som kräver familjen provas inte igen av sig självt',
    !!bekräfta && !/Nästa försök/.test(bekräfta), bekräfta);
  prova('kortet: summan av nekade', /Nekade\s*2/.test(await innehåll(page, '#kd-sam')), await innehåll(page, '#kd-sam'));
  prova('kortet: finstilen säger försöken, larmet och att passet aldrig avbokas',
    /efter 6 timmar, högst 3 försök/.test(await innehåll(page, '#kd-fot'))
      && /efter 24 timmar/.test(await innehåll(page, '#kd-fot')) && /avbokas aldrig/.test(await innehåll(page, '#kd-fot')),
    await innehåll(page, '#kd-fot'));
  await bild(page, 'kortet', '#panel-kortdragning');
  await page.click('[data-kort-forsok="pass-k1"]');
  await vänta(700);
  const försök = (S.logg.filter(r => r.väg === '/rest/v1/rpc/kortreservation_forsok_nu').pop() || {}).kropp || {};
  prova('kortet: Försök igen frågar databasen om passet', försök.p_bokning === 'pass-k1', JSON.stringify(försök));
  prova('kortet: raden står som Ej försökt efteråt',
    /Ej försökt/.test((await page.locator('#kd-lista .eko-rad').allTextContents()).join(' | ')));
  prova('liggaren: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('liggaren: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 8. Adminvyn utan migrationerna ============ */
async function provaLiggarenUtan(webb) {
  const { context, page, konsol } = await öppna(webb, { utanMigrationen: true });
  await tillAdmin(page, 'ekonomi/liggaren');
  await page.waitForFunction(() => !/Hämtar/.test((document.querySelector('#lig-lista') || {}).textContent || 'Hämtar'),
    null, { timeout: 6000 }).catch(() => {});
  prova('utan migrationen: Liggaren säger att den inte är körd',
    /migrationen betalningsliggaren är inte körd/.test(await innehåll(page, '#lig-lista')), await innehåll(page, '#lig-lista'));
  await page.click('#flik-kortdragning');
  await vänta(300);
  prova('utan migrationen: Kortet står ändå, utan försöken',
    (await page.locator('#kd-lista .eko-rad').count()) === 3 && !/Nästa försök/.test(await innehåll(page, '#kd-lista')),
    await innehåll(page, '#kd-lista'));
  prova('utan migrationen: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

(async function () {
  const server = spawn('python3', [path.join(ROT, '.claude', 'serve.py'), String(PORT)], { stdio: 'ignore' });
  let klar = false;
  for (let i = 0; i < 50 && !klar; i++) {
    try { klar = (await fetch(BAS + '/admin')).ok; } catch (e) { await vänta(100); }
  }
  const webb = await pw.chromium.launch();
  try {
    await provaMånaderna(webb);
    await provaKöptaMånader(webb);
    await provaUtanMånader(webb);
    await provaPasset(webb);
    await provaTillbaka(webb);
    await provaTelefonOchMörkt(webb);
    await provaLiggaren(webb);
    await provaLiggarenUtan(webb);
  } catch (e) {
    prova('provet kraschade', false, e && e.stack || e);
  } finally {
    await webb.close();
    server.kill();
  }
  const fel = utfall.filter(u => !u.ok);
  utfall.forEach(u => console.log((u.ok ? 'ok   ' : 'FEL  ') + u.namn + (u.ok ? '' : '  (' + u.detalj + ')')));
  console.log('\n' + (utfall.length - fel.length) + ' av ' + utfall.length + ' gröna.');
  process.exit(fel.length ? 1 : 0);
})();
