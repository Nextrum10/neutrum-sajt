/* ============================================================
   NEXTRUM — webbläsarprov för sen avbokning (sen_avbokning, 2026-10-22)

       NODE_PATH="$(npm root -g)" node verktyg/prova-sen-avbokning.js [mapp för bilder]

   Leo (2026-10-22): "minst 12h innan måste det avbokas, avbokas det inom
   12h av att lektionen ska hållas betalas 50% av belopp, eller spenderas
   hälften av planerade timmar för lektionen". Databasens regler provas i
   rls-test.sql (avsnitt 53, SA); här provas vyerna mot en falsk Supabase,
   som verktyg/prova-kassan.js (egen port, 8986). Den falska databasen gör
   det stampla_avbokningen gör med passet när det avbokas, och svarar på
   sen_avbokning_lage() som databasen. Ett anrop till den riktiga adressen
   fäller provet.

   Familjens vy: rutan säger vad en sen avbokning kostar innan familjen
   bestämt sig, passet flyttas inte de sista 12 timmarna, avgiften står
   under Betalning med Betala nu, och ett pass som bokades på de gamla
   villkoren (regeln gäller inte) ser ut som förut. Adminvyn: Avboka frågar
   om familjen bad om det, avgiften står under Att göra och Alla
   betalningar, och passets panel efterskänker den. Utan migrationen ser
   båda vyerna ut som förut.
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
const PORT = 8986;
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

/* Stockholms dag och klockslag, som databasen räknar passets start. */
function sthlm(ms) {
  const f = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Stockholm', hourCycle: 'h23', year: 'numeric',
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(ms)).forEach(p => { f[p.type] = p.value; });
  return { dag: f.year + '-' + f.month + '-' + f.day, tid: f.hour + ':' + f.minute };
}
const om = timmar => sthlm(Date.now() + timmar * 3600e3);
const dag = n => sthlm(Date.now() + n * 864e5).dag;

function jwt(sub, roll) {
  const b = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  return b({ alg: 'HS256', typ: 'JWT' }) + '.' + b({ sub, role: roll, exp: 4102444800 }) + '.provet';
}
const ADMIN = { id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'leo@example.se',
  app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-09-01T10:00:00Z' };
const FAMILJ = { id: 'fam-a', aud: 'authenticated', role: 'authenticated', email: 'anna@example.se',
  app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-09-10T10:00:00Z' };

/* Passen. sen: mindre än 12 timmar kvar. Ett pass i GAMLA bokades innan
   familjen godkänt villkoren med regeln, och där gäller den inte. */
const SEN = { 'pass-sen': true, 'pass-tim': true, 'pass-gammal': true, 'pass-adm': true, 'pass-adm2': true };
const GAMLA = ['pass-gammal'];
const HALV = 30, AVGIFT = 19950;

function pass(id, familj, elev, när, extra) {
  return Object.assign({ id, parent_id: familj, tutor_id: 'sh-a', student_id: elev, subject: 'Matematik',
    tjanst: 'laxhjalp', format: 'Online', wanted_date: när.dag, wanted_time: när.tid, duration_min: 60,
    status: 'confirmed', betalning_status: 'ingen', fakturerbar: true, startrabatt: false, rabatt_ore: null,
    timpris_ore: 39900, extra_ore: 6900, antal_barn: 1, created_by: familj, created_at: nu(-600) }, extra || {});
}

function värld(o) {
  const W = {
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
      pass('pass-sen', 'fam-a', 'elev-a', om(3)),
      pass('pass-langt', 'fam-a', 'elev-a', { dag: dag(3), tid: '16:00' }, { subject: 'Engelska' }),
      pass('pass-tim', 'fam-a', 'elev-a', om(5), { subject: 'Svenska', klippkort_id: 'kort-1',
        betalning_status: 'betald', betald_at: nu(-100) }),
      pass('pass-gammal', 'fam-a', 'elev-a', om(4), { subject: 'Fysik', created_at: nu(-20000) }),
      /* Avbokat sent i går, avgiften obetald. */
      pass('pass-avb', 'fam-a', 'elev-a', { dag: dag(0), tid: '08:00' }, { subject: 'Kemi', status: 'cancelled',
        avbokningsskal: 'sjukdom', avbokad_av: 'fam-a', avbokad_at: nu(-700),
        sen_avbokning_minuter: HALV, sen_avbokning_ore: AVGIFT, avbokad_for_familjen: false }),
      pass('pass-adm', 'fam-b', 'elev-b', om(2)),
      pass('pass-adm2', 'fam-b', 'elev-b', om(6), { subject: 'Biologi' })
    ],
    klippkort_saldo: [{
      id: 'kort-1', parent_id: 'fam-a', erbjudande: 'klipp10', namn: '10 timmar', sort: 'klippkort', timmar: 10,
      anvanda: 1, kvar: 9, giltigt_till: dag(150), status: 'betald', begart_ore: 399000, betalt_ore: 399000,
      aterbetald_ore: 0, timpris_ore: 39900, betald_at: nu(-3000), created_at: nu(-3000), brukbar: true,
      vid_uppsagning_ore: 359100, angerfrist_till: dag(10), vid_anger_ore: 359100, gratis_kvar: 0, gratis_till: null,
      aterkallad_at: null, till_plan: null, rabatterat_timpris_ore: 39900, familjerabatt_ore: 0, galler_fran: null,
      aterbetalda_timmar: 0
    }],
    klippkort: [{ id: 'kort-1', stripe_skarp: true }],
    erbjudanden_pris: [],
    betalning_installning: [{ id: 1, automatiska_forsok: 3, timmar_mellan_forsok: 6, larm_efter_timmar: 24,
      sen_avbokning_timmar: 0, avbokning_avgift_timmar: 12, avbokning_avgift_procent: 50, andrad_at: null }]
  };
  /* Utan migrationen finns inga kolumner för avgiften: det sent avbokade
     passet är ett vanligt avbokat pass. */
  if (o && o.utanMigrationen) {
    W.bookings.forEach(b => { delete b.sen_avbokning_minuter; delete b.sen_avbokning_ore; delete b.avbokad_for_familjen; });
  }
  return W;
}

function falskSupabase(o) {
  const ANV = (o && o.anv) || ADMIN;
  const W = värld(o);
  const logg = [];
  const utan = !!(o && o.utanMigrationen);
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
      if (v === 'not.is.null') ut = ut.filter(r => r[k] != null);
    }
    return ut;
  }
  const familj = ANV.id !== 'admin-1';
  const lage = id => {
    const b = W.bookings.find(x => x.id === id);
    if (!b || (familj && b.parent_id !== ANV.id)) return null;
    return { galler: b.status === 'confirmed' && !GAMLA.includes(id), sen: !!SEN[id], minuter: HALV,
      ore: b.klippkort_id ? 0 : AVGIFT, timmar: 12 };
  };
  const RPC = {
    mina_behorigheter: () => (familj ? { admin: false, superadmin: false, behorigheter: [] }
      : { admin: true, superadmin: true, behorigheter: [] }),
    notisfel: () => [],
    /* Larmen, som avvikelser_rader() ger dem: den obetalda avgiften. */
    ekonomiska_avvikelser: () => W.bookings.filter(b => b.status === 'cancelled' && Number(b.sen_avbokning_ore) > 0
      && ['ingen', 'vantar', 'misslyckad'].includes(b.betalning_status))
      .map(b => ({ typ: 'sen_avbokning_obetald', objekt_tabell: 'bookings', objekt_id: b.id, datum: b.wanted_date,
        belopp_ore: b.sen_avbokning_ore, kund_id: b.parent_id, studiehjalpare_id: b.tutor_id })),
    admin_sett_markera: k => k.p_till,
    mitt_villkorslage: () => ({ version: '2026-10-23', godkant_at: '2026-10-21T09:00:00+00:00', tidigare: false }),
    forsta_timmen_lage: () => ({ beviljad: false, tagen: true, i_planen: true, pa_pass: false }),
    min_familjerabatt: () => 0,
    sen_avbokning_lage: k => lage(k.p_pass)
  };
  const FUNKTION = {
    'stripe-checkout': () => [409, { error: 'Provet öppnar ingen kassa.' }]
  };
  /* Det stampla_avbokningen gör när passet avbokas: inom 12 timmar, av
     familjen eller av Nextrum på familjens begäran, och bara när regeln
     gäller passet. */
  function avboka(b, kropp) {
    const forFam = !familj && kropp.avbokad_for_familjen === true;
    if (familj) delete kropp.avbokad_for_familjen;
    if (b.status === 'confirmed' && kropp.status === 'cancelled' && !utan && SEN[b.id] && !GAMLA.includes(b.id)
        && ((familj && b.parent_id === ANV.id) || forFam)) {
      kropp.sen_avbokning_minuter = HALV;
      kropp.sen_avbokning_ore = b.klippkort_id ? 0 : AVGIFT;
    }
    if (kropp.status === 'cancelled') { kropp.avbokad_av = ANV.id; kropp.avbokad_at = nu(0); }
  }
  async function hantera(route) {
    const req = route.request();
    const url = new URL(req.url());
    const metod = req.method();
    if (metod === 'OPTIONS') return svar(route, 204);
    let kropp = null;
    try { kropp = req.postDataJSON(); } catch (e) { kropp = req.postData(); }
    logg.push({ metod, väg: url.pathname, sök: url.search, kropp: kropp && typeof kropp === 'object'
      ? JSON.parse(JSON.stringify(kropp)) : kropp });
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
      const f = utan && namn === 'sen_avbokning_lage' ? null : RPC[namn];
      if (!f) return svar(route, 404, { code: 'PGRST202', message: 'Could not find the function' });
      return svar(route, 200, f(kropp || {}));
    }
    if (p.startsWith('/rest/v1/')) {
      const tabell = p.slice('/rest/v1/'.length);
      const urval = url.searchParams.get('select') || '';
      if (utan && tabell === 'bookings' && /sen_avbokning|avbokad_for_familjen/.test(urval + JSON.stringify(kropp || {}))) {
        return svar(route, 400, { code: '42703', message: 'column bookings.sen_avbokning_minuter does not exist' });
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
        träff.forEach(r => {
          const ny = Object.assign({}, kropp || {});
          if (tabell === 'bookings') avboka(r, ny);
          Object.assign(r, ny);
        });
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
  const larm = [];
  page.on('dialog', d => { larm.push(d.message()); d.dismiss().catch(() => {}); });
  page.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource|PGRST20[25]|Could not find the (table|function)|Provet öppnar ingen kassa/.test(m.text())) {
      konsol.push(m.text());
    }
  });
  page.on('pageerror', e => konsol.push('pageerror: ' + e.message));
  return { context, page, S, riktiga, konsol, larm };
}

const synlig = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const innehåll = (page, sel) => page.locator(sel).first().textContent().catch(() => '');
async function bild(page, namn, sel) {
  if (!BILDER) return;
  fs.mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: path.join(BILDER, namn + '.png'), fullPage: false });
  if (sel) await page.locator(sel).first().screenshot({ path: path.join(BILDER, namn + '-del.png') }).catch(() => {});
}
const ingenSidled = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const patchar = (S, id) => S.logg.filter(r => r.metod === 'PATCH' && r.väg === '/rest/v1/bookings'
  && new URLSearchParams(r.sök).get('id') === 'eq.' + id);
const lägen = (S, id) => S.logg.filter(r => r.väg === '/rest/v1/rpc/sen_avbokning_lage' && (r.kropp || {}).p_pass === id);
const kassor = S => S.logg.filter(r => r.metod === 'POST' && r.väg === '/functions/v1/stripe-checkout');

async function stängNotis(page) {
  if (await page.locator('.nx-notisruta [data-notisruta-stang]').count()) {
    await page.click('.nx-notisruta [data-notisruta-stang]').catch(() => {});
    await vänta(300);
  }
}
async function tillPasset(page, id) {
  await page.goto(BAS + '/foralder#pass/' + id);
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
  await page.waitForSelector('#pass-sida .ps-tillbaka', { timeout: 8000 }).catch(() => {});
  await vänta(900);
  await stängNotis(page);
}
async function tillAdmin(page, sek) {
  await page.goto(BAS + '/admin#' + sek);
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
  await vänta(1200);
}
async function välj(page, skäl) {
  await page.click('.nx-fraga-box [data-skal="' + skäl + '"]');
  await page.click('.nx-fraga-box [data-avb="ja"]');
  await vänta(900);
}

/* ============ 1. Familjen avbokar sent och betalar avgiften ============ */
async function provaFamiljenSent(webb) {
  const { context, page, S, riktiga, konsol } = await öppna(webb, { anv: FAMILJ });
  await tillPasset(page, 'pass-sen');
  const sida = await innehåll(page, '#pass-sida');
  prova('passet: de sista 12 timmarna säger beskedet att det inte går att flytta, och vad en avbokning kostar',
    /mindre än 12 timmar, så det går inte att flytta/.test(sida) && /hälften av priset, 199,50\s*kr/.test(sida), sida);
  prova('passet: ingen knapp för att flytta', (await page.locator('#pass-sida [data-flytta]').count()) === 0);
  prova('passet: databasen tillfrågas om passet', lägen(S, 'pass-sen').length >= 1);
  await bild(page, 'familj-sent-passet', '#pass-sida');

  await page.click('#pass-sida [data-avboka="pass-sen"]');
  await page.waitForSelector('.nx-fraga-box [data-skal]', { timeout: 4000 }).catch(() => {});
  const ruta = await innehåll(page, '.nx-fraga-box');
  prova('avboka: rutan säger att det är en sen avbokning och vad den kostar, före beslutet',
    /räknas som en sen avbokning: ni betalar hälften av passet, 199,50\s*kr/.test(ruta), ruta);
  prova('avboka: knappen heter Avboka ändå', (await innehåll(page, '.nx-fraga-box [data-avb="ja"]')) === 'Avboka ändå',
    await innehåll(page, '.nx-fraga-box [data-avb="ja"]'));
  prova('avboka: rutan frågar databasen på nytt när familjen trycker', lägen(S, 'pass-sen').length >= 2);
  await bild(page, 'familj-sent-rutan', '.nx-fraga-box');
  await välj(page, 'sjukdom');
  const k = (patchar(S, 'pass-sen').pop() || {}).kropp || {};
  prova('avboka: familjen skriver bara läget och skälet, aldrig avgiften eller begäran',
    k.status === 'cancelled' && k.avbokningsskal === 'sjukdom' && !('sen_avbokning_ore' in k)
      && !('sen_avbokning_minuter' in k) && !('avbokad_for_familjen' in k), JSON.stringify(k));

  await page.waitForFunction(() => /Ni betalar hälften av passet/.test((document.querySelector('#pass-sida') || {}).textContent || ''),
    null, { timeout: 5000 }).catch(() => {});
  const efter = await innehåll(page, '#pass-sida');
  prova('efteråt: passet säger halva tiden och avgiften, och ber om betalningen',
    /räknas det som hållet i halva tiden \(30 min\)/.test(efter) && /Ni betalar hälften av passet, 199,50\s*kr/.test(efter), efter);
  prova('efteråt: Betala nu står på passet', (await page.locator('#pass-sida [data-betala="pass-sen"]').count()) >= 1);
  prova('efteråt: priset är avgiften, med vad den är', /199,50\s*kr/.test(efter) && /Sen avbokning: hälften av passet/.test(efter), efter);
  await bild(page, 'familj-sent-efter', '#pass-sida');

  await page.evaluate(() => { location.hash = '#betalning'; });
  await page.waitForSelector('#bet-att-betala .vy-rad, #bet-att-betala a', { timeout: 5000 }).catch(() => {});
  await vänta(400);
  const lista = await innehåll(page, '#bet-att-betala');
  prova('betalning: båda sena avbokningarna står under Att betala, med avgiften',
    (lista.match(/Avbokat sent: hälften av passet/g) || []).length === 2 && /199,50\s*kr/.test(lista)
      && (await page.locator('#bet-att-betala [data-betala="pass-avb"]').count()) === 1, lista);
  // Två bokade pass i tid (399 kr var) och två avgifter (199,50 kr var).
  prova('betalning: summan räknar avgifterna med passen', /Att betala\s*1\s?197\s*kr\s*4 pass väntar/.test(await innehåll(page, '#bet-sam')),
    await innehåll(page, '#bet-sam'));
  await bild(page, 'familj-betalning', '#bet-att-betala');
  await page.click('#bet-att-betala [data-betala="pass-avb"]');
  await page.waitForSelector('.nx-kassa-villkor [data-kassa-kryss]', { timeout: 4000 }).catch(() => {});
  await page.click('.nx-kassa-villkor [data-kassa-kryss]').catch(() => {});
  await page.click('.nx-kassa-villkor [data-svar="ja"]').catch(() => {});
  await vänta(700);
  const kassa = (kassor(S).pop() || {}).kropp || {};
  prova('betalning: kassan får passet och krysset, aldrig ett belopp',
    kassa.pass === 'pass-avb' && kassa.villkor === true && !('belopp_ore' in kassa) && !('pris' in kassa), JSON.stringify(kassa));
  prova('familjen sent: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('familjen sent: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 2. I tid, med timmar och på de gamla villkoren ============ */
async function provaFamiljenAnnat(webb) {
  const { context, page, S, konsol } = await öppna(webb, { anv: FAMILJ });
  await tillPasset(page, 'pass-langt');
  prova('i tid: inget om en sen avbokning, och passet går att flytta',
    !/12 timmar/.test(await innehåll(page, '#pass-sida')) && (await page.locator('#pass-sida [data-flytta]').count()) === 1);
  await page.click('#pass-sida [data-avboka="pass-langt"]');
  await page.waitForSelector('.nx-fraga-box [data-skal]', { timeout: 4000 }).catch(() => {});
  const ruta = await innehåll(page, '.nx-fraga-box');
  prova('i tid: rutan som förut, och databasen tillfrågas inte',
    /Vill ni hellre byta tid/.test(ruta) && !/sen avbokning/.test(ruta) && lägen(S, 'pass-langt').length === 0, ruta);
  await page.keyboard.press('Escape');
  await vänta(250);
  prova('i tid: Escape avbokar inget', patchar(S, 'pass-langt').length === 0);

  await tillPasset(page, 'pass-tim');
  await page.click('#pass-sida [data-avboka="pass-tim"]');
  await page.waitForSelector('.nx-fraga-box [data-skal]', { timeout: 4000 }).catch(() => {});
  const tim = await innehåll(page, '.nx-fraga-box');
  prova('med timmar: halva tiden dras ur timmarna, och inga pengar',
    /räknas som hållet i halva tiden/.test(tim) && /Hälften av tiden, 30 min, dras ur timmarna, och resten kommer tillbaka/.test(tim)
      && !/kr/.test(tim), tim);
  await välj(page, 'forhinder');
  await page.waitForFunction(() => /halva tiden/.test((document.querySelector('#pass-sida') || {}).textContent || ''),
    null, { timeout: 5000 }).catch(() => {});
  const timSida = await innehåll(page, '#pass-sida');
  prova('med timmar: passet säger att tiden är dragen, och priset är tiden, aldrig 0 kr',
    /dragen ur era timmar/.test(timSida) && /30 min ur timmarna/.test(timSida) && !/\b0 kr/.test(timSida)
      && (await page.locator('#pass-sida [data-betala]').count()) === 0, timSida);

  await tillPasset(page, 'pass-gammal');
  const gammal = await innehåll(page, '#pass-sida');
  prova('gamla villkoren: databasen säger att regeln inte gäller, och passet ser ut som förut',
    lägen(S, 'pass-gammal').length >= 1 && !/12 timmar/.test(gammal)
      && (await page.locator('#pass-sida [data-flytta]').count()) === 1, gammal);
  await page.click('#pass-sida [data-avboka="pass-gammal"]');
  await page.waitForSelector('.nx-fraga-box [data-skal]', { timeout: 4000 }).catch(() => {});
  prova('gamla villkoren: rutan säger inget om en avgift', !/sen avbokning/.test(await innehåll(page, '.nx-fraga-box')));
  await page.keyboard.press('Escape');
  prova('i tid, timmar och gamla villkor: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 3. Familjen utan migrationen ============ */
async function provaFamiljenUtan(webb) {
  const { context, page, S, konsol } = await öppna(webb, { anv: FAMILJ, utanMigrationen: true });
  await tillPasset(page, 'pass-sen');
  prova('utan migrationen: inget om en sen avbokning, och passet går att flytta',
    !/12 timmar/.test(await innehåll(page, '#pass-sida')) && (await page.locator('#pass-sida [data-flytta]').count()) === 1);
  await page.click('#pass-sida [data-avboka="pass-sen"]');
  await page.waitForSelector('.nx-fraga-box [data-skal]', { timeout: 4000 }).catch(() => {});
  prova('utan migrationen: rutan som förut', /Vill ni hellre byta tid/.test(await innehåll(page, '.nx-fraga-box')));
  await page.keyboard.press('Escape');
  await page.evaluate(() => { location.hash = '#betalning'; });
  await vänta(900);
  prova('utan migrationen: inget sent avbokat pass att betala',
    !/Avbokat sent/.test(await innehåll(page, '#bet-att-betala')), await innehåll(page, '#bet-att-betala'));
  prova('utan migrationen: frågan om avgifterna föll, och inget annat',
    S.logg.some(r => r.väg === '/rest/v1/bookings' && /sen_avbokning/.test(decodeURIComponent(r.sök))));
  prova('utan migrationen: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 4. Telefonen och mörkt läge ============ */
async function provaTelefon(webb) {
  for (const [namn, extra] of [['telefon', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
    ['telefon mörkt', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark' }]]) {
    const { context, page, konsol } = await öppna(webb, { anv: FAMILJ, context: extra });
    await tillPasset(page, 'pass-avb');
    prova(namn + ': passet går inte i sidled', await ingenSidled(page));
    prova(namn + ': Betala nu är minst 44 px hög',
      ((await page.locator('#pass-sida [data-betala="pass-avb"]').first().boundingBox().catch(() => null)) || {}).height >= 44);
    await bild(page, namn.replace(' ', '-') + '-avgiften', '#pass-sida');
    await page.goto(BAS + '/foralder#pass/pass-sen');
    await vänta(900);
    await page.click('#pass-sida [data-avboka="pass-sen"]').catch(() => {});
    await page.waitForSelector('.nx-fraga-box', { timeout: 4000 }).catch(() => {});
    const box = await page.locator('.nx-fraga-box').boundingBox().catch(() => null);
    prova(namn + ': rutan ryms', !!box && box.x >= 0 && box.x + box.width <= 390.5, JSON.stringify(box));
    await bild(page, namn.replace(' ', '-') + '-rutan', '.nx-fraga-box');
    prova(namn + ': inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
}

/* ============ 5. Adminvyn ============ */
async function provaAdmin(webb) {
  const { context, page, S, riktiga, konsol, larm } = await öppna(webb, {});
  await tillAdmin(page, 'bokningar');
  await page.waitForSelector('[data-avboka="pass-adm"]', { timeout: 6000 }).catch(() => {});

  // På familjens begäran: frågan, sedan skälet, och begäran i samma skrivning.
  await page.click('[data-avboka="pass-adm"]');
  await page.waitForSelector('.nx-fraga-box [data-svar="ja"]', { timeout: 4000 }).catch(() => {});
  const fråga = await innehåll(page, '.nx-fraga-box');
  prova('admin: inom 12 timmar frågar Avboka om familjen bad om det, med avgiften ur databasen',
    /Bad familjen om avbokningen\?/.test(fråga) && /hälften av passet, 199,50\s*kr/.test(fråga)
      && /kostar det ingenting/.test(fråga) && lägen(S, 'pass-adm').length === 1, fråga);
  await bild(page, 'admin-fragan', '.nx-fraga-box');
  await page.click('.nx-fraga-box [data-svar="ja"]');
  await page.waitForSelector('.nx-fraga-box [data-skal]', { timeout: 4000 }).catch(() => {});
  const ruta = await innehåll(page, '.nx-fraga-box');
  prova('admin: rutan säger vad familjen betalar', /sen avbokning för familjen: de betalar 199,50\s*kr med Betala nu/.test(ruta), ruta);
  await välj(page, 'forhinder');
  const k = (patchar(S, 'pass-adm').pop() || {}).kropp || {};
  prova('admin: begäran skrivs i samma uppdatering som avbokningen, aldrig ett belopp',
    k.status === 'cancelled' && k.avbokningsskal === 'forhinder' && k.avbokad_for_familjen === true
      && !('sen_avbokning_ore' in k), JSON.stringify(k));
  prova('admin: avgiften läses tillbaka ur databasen, och inget larm om att den saknas',
    S.logg.some(r => r.metod === 'GET' && r.väg === '/rest/v1/bookings' && /sen_avbokning_ore/.test(decodeURIComponent(r.sök))
      && /id=eq\.pass-adm(&|$)/.test(r.sök)) && larm.length === 0, larm.join(' | '));

  // Inte på familjens begäran.
  await page.click('[data-avboka="pass-adm2"]');
  await page.waitForSelector('.nx-fraga-box [data-svar="nej"]', { timeout: 4000 }).catch(() => {});
  await page.click('.nx-fraga-box [data-svar="nej"]');
  await page.waitForSelector('.nx-fraga-box [data-skal]', { timeout: 4000 }).catch(() => {});
  prova('admin: Nej ger rutan som förut', /inte betalt, så det finns inget att betala tillbaka/.test(await innehåll(page, '.nx-fraga-box')));
  await välj(page, 'ingen_hjalpare');
  const k2 = (patchar(S, 'pass-adm2').pop() || {}).kropp || {};
  prova('admin: Nej skriver ingen begäran', k2.status === 'cancelled' && !('avbokad_for_familjen' in k2), JSON.stringify(k2));

  // Ett pass långt fram: ingen fråga.
  await page.click('[data-avboka="pass-langt"]');
  await page.waitForSelector('.nx-fraga-box', { timeout: 4000 }).catch(() => {});
  prova('admin: mer än 12 timmar kvar ger ingen fråga, och databasen tillfrågas inte',
    (await page.locator('.nx-fraga-box [data-skal]').count()) > 0 && !/Bad familjen/.test(await innehåll(page, '.nx-fraga-box'))
      && lägen(S, 'pass-langt').length === 0);
  await page.keyboard.press('Escape');
  await vänta(200);

  // Pengarna: Att göra, Alla betalningar och passets panel.
  await tillAdmin(page, 'ekonomi');
  await page.click('#flik-attgora').catch(() => {});
  await page.waitForFunction(() => /sen avbokning/.test((document.querySelector('#eko-attgora') || {}).textContent || ''),
    null, { timeout: 5000 }).catch(() => {});
  const attGöra = await innehåll(page, '#eko-attgora');
  prova('admin: Att göra säger att familjen inte betalat en sen avbokning',
    /Anna Andersson har inte betalat en sen avbokning/.test(attGöra) && /Kemi, sen avbokning/.test(attGöra), attGöra);
  await bild(page, 'admin-att-gora', '#eko-attgora');
  await page.click('#flik-betalningar');
  await page.waitForSelector('#bet-lista .eko-rad', { timeout: 5000 }).catch(() => {});
  await vänta(300);
  const rad = await page.locator('#bet-lista .eko-rad', { hasText: 'Kemi' }).first().textContent().catch(() => '');
  prova('admin: Alla betalningar har avgiften som obetald, med halva passet',
    /Sen avbokning, obetald/.test(rad) && /199,50\s*kr/.test(rad) && /avbokat sent/.test(rad) && /hälften av passet/.test(rad), rad);
  const adm = await page.locator('#bet-lista .eko-rad', { hasText: 'Bo Berg' }).allTextContents().catch(() => []);
  prova('admin: passet som avbokades på familjens begäran står där också', adm.some(t => /Sen avbokning, obetald/.test(t)),
    adm.join(' | '));
  await bild(page, 'admin-betalningar', '#bet-lista');

  await page.click('#bet-lista [data-dp="pass:pass-avb"]');
  await page.waitForFunction(() => /Sen avbokning/.test((document.querySelector('.dp') || {}).textContent || ''),
    null, { timeout: 5000 }).catch(() => {});
  const panel = await innehåll(page, '.dp');
  prova('panelen: den sena avbokningen med tiden, avgiften och vem som avbokade',
    /Räknas som hållet\s*30 min av 60 bokade/.test(panel) && /Avgift\s*199,50\s*kr/.test(panel) && /av familjen/.test(panel), panel);
  await bild(page, 'admin-panelen', '.dp');
  await page.click('.dp [data-dp-sen-efterskank="pass-avb"]');
  await page.waitForSelector('.nx-fraga-box [data-svar="ja"]', { timeout: 4000 }).catch(() => {});
  prova('efterskänk: rutan säger vad det betyder', /blir en vanlig avbokning/.test(await innehåll(page, '.nx-fraga-box')));
  await page.click('.nx-fraga-box [data-svar="ja"]');
  await vänta(1200);
  const e = (patchar(S, 'pass-avb').pop() || {}).kropp || {};
  prova('efterskänk: båda kolumnerna blir null, och inget annat',
    JSON.stringify(e) === JSON.stringify({ sen_avbokning_minuter: null, sen_avbokning_ore: null }), JSON.stringify(e));
  prova('admin: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('admin: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 6. Adminvyn utan migrationen ============ */
async function provaAdminUtan(webb) {
  const { context, page, S, konsol } = await öppna(webb, { utanMigrationen: true });
  await tillAdmin(page, 'bokningar');
  await page.waitForSelector('[data-avboka="pass-adm"]', { timeout: 6000 }).catch(() => {});
  await page.click('[data-avboka="pass-adm"]');
  await page.waitForSelector('.nx-fraga-box', { timeout: 4000 }).catch(() => {});
  prova('admin utan migrationen: ingen fråga om familjens begäran',
    (await page.locator('.nx-fraga-box [data-skal]').count()) > 0 && !/Bad familjen/.test(await innehåll(page, '.nx-fraga-box')));
  await välj(page, 'sjukdom');
  const k = (patchar(S, 'pass-adm').pop() || {}).kropp || {};
  prova('admin utan migrationen: avbokningen skrivs som förut',
    k.status === 'cancelled' && !('avbokad_for_familjen' in k), JSON.stringify(k));
  prova('admin utan migrationen: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
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
    await provaFamiljenSent(webb);
    await provaFamiljenAnnat(webb);
    await provaFamiljenUtan(webb);
    await provaTelefon(webb);
    await provaAdmin(webb);
    await provaAdminUtan(webb);
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
