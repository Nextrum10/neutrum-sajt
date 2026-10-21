/* ============================================================
   NEXTRUM — webbläsarprov för syskontillägget som skuld
   (syskontillagg_som_skuld, 2026-10-21)

       NODE_PATH="$(npm root -g)" node verktyg/prova-syskon.js [mapp för bilder]

   Leo 2026-10-21: familjen väljer vilka syskon som är med på passet,
   tillägget står med livepris i bokningsrutan, villkoren godkänns första
   gången, och tillägget blir en skuld när passet är hållet. Skulden står
   under Betalning som Upplupet tillägg med Betala tillägg nu, och följer
   med som en egen rad i nästa köp. Spärren och en betalning som pågår
   står som egna rader, och studiehjälparen ser barnen på passet.

   Databasens regler (beloppet, spärren, villkoren, posternas lägen,
   betalningen och återbetalningen) provas i rls-test.sql (avsnittet SK)
   och två samtidiga betalningar i prova-tillagg-samtidigt.sh; adminvyns
   flik mot en riktig databas i prova-adminvyn.js. Här provas vyerna, mot
   en falsk Supabase som de andra proven (egen port, 8983). Ett anrop
   till den riktiga adressen fäller provet. Text ur databasen (barnens
   namn) ska stå som text, aldrig som HTML.
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
const PORT = 8983;
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
const sthlm = d => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric',
  month: '2-digit', day: '2-digit' }).format(d);
const dag = n => sthlm(new Date(Date.now() + n * 864e5));

function jwt(sub, roll) {
  const b = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  return b({ alg: 'HS256', typ: 'JWT' }) + '.' + b({ sub, role: roll, exp: 4102444800 }) + '.provet';
}
const FAMILJ = { id: 'fam-a', aud: 'authenticated', role: 'authenticated', email: 'anna@example.se',
  app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-09-10T10:00:00Z' };
const SARA = { id: 'sh-a', aud: 'authenticated', role: 'authenticated', email: 'sara@example.se',
  app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-09-01T10:00:00Z' };

/* Ett namn som är HTML: det ska stå som text överallt. */
const MIO = '<b>Mio</b>';

/* Skulden som mitt_tillagg() lämnar den: två hållna pass med tillägg
   (ett extra barn i en timme, två i två timmar) och ett bokat. Tillägget
   är lika mycket med ett som med två syskon (syskontillagget_fast), så
   det andra är 69 kr × 2 h. */
function poster() {
  return [
    { id: 'post-1', bokning: 'pass-h1', start: dag(-5) + 'T15:00:00+00:00', extra: 1, minuter: 60, belopp_ore: 6900,
      status: 'upplupen', upplupen_at: nu(-5 * 1440) },
    { id: 'post-2', bokning: 'pass-h2', start: dag(-12) + 'T15:00:00+00:00', extra: 2, minuter: 120, belopp_ore: 13800,
      status: 'upplupen', upplupen_at: nu(-12 * 1440) },
    { id: 'post-3', bokning: 'pass-b', start: dag(6) + 'T14:00:00+00:00', extra: 1, minuter: 60, belopp_ore: 6900,
      status: 'bokad', upplupen_at: null }
  ];
}
function tillägg(över) {
  return Object.assign({
    pa: true, version: '2026-10-21', godkand_at: '2026-10-21T09:00:00+00:00', sen_avbokning_timmar: 24,
    debitera_vid_sen_avbokning: true, obligatorisk: true, max_upplupet_ore: 100000, sparr_efter_dagar: 45,
    paminnelse_dagar: 14, sparr: null, upplupet_ore: 20700, upplupna: 2, i_betalning_ore: 0, i_betalning: 0,
    poster: poster()
  }, över || {});
}
const UTAN_SKULD = { upplupet_ore: 0, upplupna: 0, poster: [] };

function värld() {
  const pass = (id, datum, status, extra) => Object.assign({ id, parent_id: 'fam-a', tutor_id: 'sh-a', student_id: 'elev-a',
    subject: 'Matematik', tjanst: 'laxhjalp', wanted_date: datum, wanted_time: '16:00', duration_min: 60, status,
    betalning_status: status === 'completed' ? 'betald' : 'ingen', betalt_ore: status === 'completed' ? 39900 : null,
    fakturerbar: true, startrabatt: false, rabatt_ore: null, timpris_ore: 39900, extra_ore: 6900, antal_barn: 1,
    created_at: nu(-20000) }, extra || {});
  return {
    profiles: [
      { id: 'fam-a', role: 'parent', full_name: 'Anna Andersson', email: 'anna@example.se', is_admin: false,
        match_status: 'matched', matched_tutor_id: 'sh-a', created_at: '2026-09-10T10:00:00Z', last_seen_at: nu(-60) },
      { id: 'sh-a', role: 'tutor', full_name: 'Sara Ahl', email: 'sara@example.se', is_admin: false,
        created_at: '2026-09-01T10:00:00Z', last_seen_at: nu(-30) }
    ],
    tutor_profiles: [{ id: 'sh-a', status: 'approved', hourly_rate: 150, subjects: ['Matematik'], grade_levels: [],
      formats: [], created_at: '2026-09-01T10:00:00Z' }],
    students: [
      { id: 'elev-a', parent_id: 'fam-a', name: 'Kim Andersson', grade: 'Åk 8', matched_tutor_id: 'sh-a',
        match_status: 'matched', created_at: '2026-09-10T10:00:00Z', subjects: ['Matematik'] },
      { id: 'elev-c', parent_id: 'fam-a', name: 'Vera Andersson', grade: 'Åk 6', matched_tutor_id: 'sh-a',
        match_status: 'matched', created_at: '2026-09-10T10:05:00Z', subjects: [] },
      { id: 'elev-d', parent_id: 'fam-a', name: MIO, grade: 'Åk 3', matched_tutor_id: null,
        match_status: 'pending', created_at: '2026-09-10T10:10:00Z', subjects: [] }
    ],
    tjanster: [{ kod: 'laxhjalp', namn: 'Läxhjälp', aktiv: true, for_jobb: true, for_kund: true, ordning: 1,
      pris_per_timme_ore: 39900, extra_personer_ore: 6900, extra_personer_max: 3 }],
    flaggor: [{ kod: 'erbjudanden', aktiv: true, beskrivning: 'Erbjudandena', uppdaterad: '2026-09-27T10:00:00Z' }],
    bookings: [
      pass('pass-h1', dag(-5), 'completed'),
      pass('pass-h2', dag(-12), 'completed', { duration_min: 120, betalt_ore: 79800 }),
      pass('pass-b', dag(6), 'confirmed')
    ],
    lesson_reports: [],
    /* Barnen på passen: huvudbarnet och syskonen. */
    bokning_barn: [
      { bokning_id: 'pass-h1', barn_id: 'elev-a', ar_huvudbarn: true },
      { bokning_id: 'pass-h1', barn_id: 'elev-c', ar_huvudbarn: false },
      { bokning_id: 'pass-h2', barn_id: 'elev-a', ar_huvudbarn: true },
      { bokning_id: 'pass-h2', barn_id: 'elev-c', ar_huvudbarn: false },
      { bokning_id: 'pass-h2', barn_id: 'elev-d', ar_huvudbarn: false },
      { bokning_id: 'pass-b', barn_id: 'elev-a', ar_huvudbarn: true },
      { bokning_id: 'pass-b', barn_id: 'elev-c', ar_huvudbarn: false }
    ],
    klippkort_saldo: [],
    erbjudanden_pris: [
      { kod: 'plan_basic', sort: 'plan', namn: 'Basic', timmar: 4, rabatt_procent: 5, giltig_manader: 1,
        ordning: 1, timpris_ore: 39900, ordinarie_ore: 159600, pris_ore: 151600, rabatterat_timpris_ore: 37900,
        timmar_pa_kopet: 0 },
      { kod: 'klipp10', sort: 'klippkort', namn: '10 timmar', timmar: 10, rabatt_procent: 0, giltig_manader: 6,
        ordning: 10, timpris_ore: 39900, ordinarie_ore: 399000, pris_ore: 399000, rabatterat_timpris_ore: 39900,
        timmar_pa_kopet: 0 }
    ]
  };
}

/* o.anv: den inloggade. o.tillagg: vad mitt_tillagg() svarar (null: en
   databas utan migrationen). */
function falskSupabase(o) {
  const ANV = o.anv || FAMILJ;
  const W = värld();
  if (o.värld) o.värld(W);
  let läge = o.tillagg === null ? null : tillägg(o.tillagg);
  const logg = [];
  let löpnr = 0;
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
      const i = /^in\.\((.*)\)$/.exec(v);
      if (i) { const l = i[1].split(',').map(x => x.replace(/^"|"$/g, '')); ut = ut.filter(r => l.includes(String(r[k]))); }
      if (v === 'is.null') ut = ut.filter(r => r[k] == null);
    }
    return ut;
  }
  const SAKNAS = o.tillagg === null ? ['mitt_tillagg', 'bokning_barn', 'godkann_tillaggsvillkor', 'passens_barn'] : [];
  const RPC = {
    mina_behorigheter: () => ({ admin: false, superadmin: false, behorigheter: [] }),
    mitt_villkorslage: () => ({ version: '2026-10-22', godkant_at: '2026-10-22T09:00:00+00:00', tidigare: false }),
    forsta_timmen_lage: () => ({ beviljad: false, tagen: true, i_planen: true, pa_pass: false }),
    min_familjerabatt: () => 0,
    mitt_utbildningsprov: () => ({ studiehjalpare: true, kravs: false, fragor: [] }),
    mitt_tillagg: () => (ANV.id === 'fam-a' ? läge : null),
    /* Familjens ja, med versionen rutan visade (godkann_tillaggsvillkor). */
    godkann_tillaggsvillkor: k => {
      if (!läge || k.p_version !== läge.version) return { __fel: [400, '22023', 'Villkoren har en ny version.'] };
      läge = Object.assign({}, läge, { godkand_at: nu(0) });
      return läge.godkand_at;
    },
    /* Bara studiehjälparens egna pass, med förnamn och årskurs. */
    passens_barn: k => (W.bokning_barn || [])
      .filter(r => (k.p_bokningar || []).includes(r.bokning_id))
      .map(r => {
        const s = W.students.find(x => x.id === r.barn_id) || {};
        return { bokning_id: r.bokning_id, barn_id: r.barn_id, fornamn: String(s.name || '').split(/\s+/)[0],
          arskurs: s.grade || null, ar_huvudbarn: r.ar_huvudbarn };
      })
  };
  const FUNKTION = {
    /* Betala tillägg nu går till Stripes sida och kommer tillbaka med
       ?tillagg=; ett köp öppnar ingen kassa i provet. */
    'stripe-checkout': k => (k.skuld === true
      ? [200, { lage: 'sida', url: BAS + '/foralder?tillagg=cs_test_prov#betalning', belopp_ore: läge ? läge.upplupet_ore : 0,
        antal_pass: läge ? läge.upplupna : 0 }]
      : [409, { error: 'Provet öppnar ingen kassa.' }])
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
    if (p === '/auth/v1/logout') return svar(route, 204);
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
      const ut = f(kropp || {});
      if (ut && ut.__fel) return svar(route, ut.__fel[0], { code: ut.__fel[1], message: ut.__fel[2] });
      return svar(route, 200, ut);
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
        const rad = Object.assign({ id: tabell + '-' + (++löpnr), created_at: nu(0) }, kropp || {});
        if (tabell === 'bookings') Object.assign(rad, { status: 'requested', betalning_status: 'ingen', timpris_ore: 39900 });
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
    timezoneId: 'Europe/Stockholm' }, o.context || {}));
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
  /* Ett HTML-namn som blev HTML hade kört koden: den sätter en flagga. */
  await page.exposeFunction('__nxInjicerat', () => konsol.push('ett namn ur databasen ritades som HTML'));
  return { context, page, S, riktiga, konsol };
}

const synlig = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const text = (page, sel) => page.locator(sel).first().innerText().catch(() => '');
const innehåll = (page, sel) => page.locator(sel).first().textContent().catch(() => '');
async function bild(page, namn, sel) {
  if (!BILDER) return;
  fs.mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: path.join(BILDER, namn + '.png'), fullPage: false });
  if (sel) await page.locator(sel).first().screenshot({ path: path.join(BILDER, namn + '-del.png') }).catch(() => {});
}
const ingenSidled = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const kassor = S => S.logg.filter(r => r.metod === 'POST' && r.väg === '/functions/v1/stripe-checkout');
const skrivningar = S => S.logg.filter(r => r.metod !== 'GET' && r.metod !== 'HEAD' && !/^\/auth\//.test(r.väg))
  .map(r => r.metod + ' ' + r.väg);
const villkorsruta = '.nx-kassa-villkor';

async function till(page, adress) {
  await page.goto(BAS + adress);
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
  await vänta(900);
  if (await page.locator('.nx-notisruta [data-notisruta-stang]').count()) {
    await page.click('.nx-notisruta [data-notisruta-stang]').catch(() => {});
    await vänta(300);
  }
}
async function väljDagOchTid(page) {
  const host = '#boka-inner';
  await page.waitForSelector(host + ' .mv-dag', { timeout: 8000 }).catch(() => {});
  for (let n = 3; n < 40; n++) {
    const d = dag(n);
    const finns = await page.locator(host + ' .mv-dag[data-datum="' + d + '"]:not([disabled])').count();
    if (!finns) {
      if (!(await page.locator(host + ' .mv-dag[data-datum="' + d + '"]').count())) {
        await page.click(host + ' #bk-nasta').catch(() => {});
        await vänta(80);
      }
      continue;
    }
    await page.click(host + ' .mv-dag[data-datum="' + d + '"]');
    await page.waitForSelector(host + ' .mv-tid', { timeout: 3000 }).catch(() => {});
    if (await page.locator(host + ' .mv-tid').count()) {
      await page.locator(host + ' .mv-tid').first().click();
      await vänta(150);
      // Var ni ses: Online behöver ingen adress.
      await page.click(host + ' #bk-format [data-v="Online"]').catch(() => {});
      await vänta(150);
      return true;
    }
  }
  return false;
}

/* ============ 1. Boka pass första gången: syskonen, livepriset, villkoren ============ */
async function provaBokaFörstaGången(webb) {
  const { context, page, S, riktiga, konsol } = await öppna(webb, { tillagg: Object.assign({ godkand_at: null }, UTAN_SKULD) });
  await till(page, '/foralder#boka');
  const vald = await väljDagOchTid(page);
  prova('boka: en tid går att välja', vald);
  prova('boka: Syskon står i stället för Antal barn',
    (await page.locator('#boka-inner #bk-syskon').count()) === 1 && (await page.locator('#boka-inner #bk-barn').count()) === 0);
  const knappar = await page.locator('#boka-inner #bk-syskon button').allTextContents();
  prova('boka: ett val per syskon, inte passets eget barn', JSON.stringify(knappar) === JSON.stringify(['Vera', MIO]),
    JSON.stringify(knappar));
  prova('boka: ett HTML-namn står som text', (await page.locator('#boka-inner #bk-syskon button b').count()) === 0);
  prova('boka: utan valt syskon står priset i timmen, oavsett antalet syskon',
    /69\s*kr i timmen oavsett hur många syskon/.test(await innehåll(page, '#boka-inner .bk-syskon-info')),
    await innehåll(page, '#boka-inner .bk-syskon-info'));
  prova('boka: knappen går före ett val', !(await page.locator('#bk-boka').isDisabled()));

  await page.click('#boka-inner #bk-syskon button[data-v="elev-c"]');
  await vänta(200);
  prova('boka: ett syskon ger tillägget med livepris', (await innehåll(page, '[data-bk-tillagg]')) === 'Tillägg för syskon: 69 kr × 1 h = 69 kr',
    await innehåll(page, '[data-bk-tillagg]'));
  const villkor = await innehåll(page, '#boka-inner .bk-syskon-villkor');
  prova('boka: villkoren står första gången, med talen ur databasen',
    /Villkor för syskontillägget/.test(villkor) && /24 timmar/.test(villkor) && /1\s?000\s*kr/.test(villkor)
      && /45 dagar/.test(villkor) && /egen rad nästa gång ni köper timmar/.test(villkor) && /Platshållare/.test(villkor), villkor);
  prova('boka: knappen väntar på krysset', await page.locator('#bk-boka').isDisabled());
  prova('boka: priset vid knappen är passets, utan tillägget',
    /399\s*kr/.test(await innehåll(page, '#boka-inner .bk-sum-pris')), await innehåll(page, '#boka-inner .bk-sum-pris'));

  await page.click('#boka-inner #bk-syskon button[data-v="elev-d"]');
  await vänta(200);
  prova('boka: två syskon kostar som ett', (await innehåll(page, '[data-bk-tillagg]')) === 'Tillägg för syskon: 69 kr × 1 h = 69 kr',
    await innehåll(page, '[data-bk-tillagg]'));
  await page.click('#boka-inner #bk-langder button[data-v="120"]');
  await vänta(200);
  prova('boka: längden räknas in direkt', (await innehåll(page, '[data-bk-tillagg]')) === 'Tillägg för syskon: 69 kr × 2 h = 138 kr',
    await innehåll(page, '[data-bk-tillagg]'));
  prova('boka: summeringen säger tre barn och passets pris för två timmar',
    /3 barn/.test(await innehåll(page, '#boka-inner .bk-sum-vad')) && /798\s*kr/.test(await innehåll(page, '#boka-inner .bk-sum-pris')),
    (await innehåll(page, '#boka-inner .bk-sum-vad')) + ' | ' + (await innehåll(page, '#boka-inner .bk-sum-pris')));
  await bild(page, 'boka-syskon-villkor', '#boka-inner');

  await page.check('#boka-inner [data-bk-syskon-ok]');
  await vänta(150);
  prova('boka: krysset släpper knappen', !(await page.locator('#bk-boka').isDisabled()));
  await page.click('#bk-boka');
  await page.waitForFunction(() => !document.querySelector('#bk-boka') || /Skickat|skickat|Förslaget/.test(document.querySelector('#boka-inner').textContent),
    null, { timeout: 5000 }).catch(() => {});
  await vänta(500);
  const ja = S.logg.findIndex(r => r.väg === '/rest/v1/rpc/godkann_tillaggsvillkor');
  const post = S.logg.findIndex(r => r.metod === 'POST' && r.väg === '/rest/v1/bookings');
  prova('boka: villkoren godkänns i databasen före passet, med versionen rutan visade',
    ja !== -1 && post > ja && (S.logg[ja].kropp || {}).p_version === '2026-10-21', JSON.stringify(S.logg[ja] || null));
  const k = post === -1 ? {} : (Array.isArray(S.logg[post].kropp) ? S.logg[post].kropp[0] : S.logg[post].kropp) || {};
  prova('boka: passet skickar syskonen och ett barn, aldrig ett belopp',
    JSON.stringify(k.extra_barn) === JSON.stringify(['elev-c', 'elev-d']) && k.antal_barn === 1 && k.student_id === 'elev-a'
      && !Object.keys(k).some(n => /ore|belopp|tillagg|pris/.test(n)), JSON.stringify(k));
  prova('boka: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('boka: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 2. Godkänt förut: inga villkor, men spärren ============ */
async function provaBokaGodkänd(webb) {
  {
    const { context, page, S, riktiga, konsol } = await öppna(webb, { tillagg: UTAN_SKULD });
    await till(page, '/foralder#boka');
    await väljDagOchTid(page);
    await page.click('#boka-inner #bk-syskon button[data-v="elev-c"]');
    await vänta(200);
    prova('godkänt: tillägget står, villkoren inte', (await page.locator('#boka-inner .bk-syskon-villkor').count()) === 0
      && /Tillägg för syskon: 69 kr × 1 h/.test(await innehåll(page, '[data-bk-tillagg]')));
    prova('godkänt: knappen går direkt', !(await page.locator('#bk-boka').isDisabled()));
    await page.click('#bk-boka');
    await vänta(1200);
    prova('godkänt: inget nytt godkännande', !S.logg.some(r => r.väg === '/rest/v1/rpc/godkann_tillaggsvillkor'));
    prova('godkänt: inga fel i konsolen', konsol.length === 0 && riktiga.length === 0, konsol.concat(riktiga).join(' | '));
    await context.close();
  }
  {
    const { context, page, konsol } = await öppna(webb, { tillagg: { sparr: 'belopp', upplupet_ore: 120000, upplupna: 2 } });
    await till(page, '/foralder#boka');
    await väljDagOchTid(page);
    const spärr = await innehåll(page, '#boka-inner .bk-syskon-sparr');
    prova('spärren: Syskon säger varför, och inga val', /över 1\s?000\s*kr/.test(spärr) && /Ett pass för ett barn går att boka/.test(spärr)
      && (await page.locator('#boka-inner #bk-syskon').count()) === 0, spärr);
    prova('spärren: ett pass för ett barn går att föreslå', !(await page.locator('#bk-boka').isDisabled()));
    prova('spärren: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
}

/* ============ 3. Skulden under Betalning, och Betala tillägg nu ============ */
async function provaSkulden(webb) {
  const { context, page, S, riktiga, konsol } = await öppna(webb, {});
  await till(page, '/foralder#betalning');
  prova('skulden: kortet står under Betalning', await synlig(page, '#bet-tillagg .bet-tillagg-kort'));
  const kort = await innehåll(page, '#bet-tillagg .bet-tillagg-kort');
  prova('skulden: Upplupet tillägg med beloppet ur databasen', /Upplupet tillägg/.test(kort) && /207\s*kr/.test(kort), kort);
  const rader = await page.locator('#bet-tillagg .bet-tillagg-rader li').allTextContents();
  prova('skulden: en rad per hållet pass, inte det bokade',
    rader.length === 2 && /1 extra barn/.test(rader[0]) && /69\s*kr/.test(rader[0]) && /2 extra barn/.test(rader[1])
      && /138\s*kr/.test(rader[1]), rader.join(' | '));
  prova('skulden: knappen är orange och heter Betala tillägg nu',
    (await innehåll(page, '[data-betala-skuld]')) === 'Betala tillägg nu'
      && (await page.locator('[data-betala-skuld].btn-orange').count()) === 1);
  prova('skulden: kortet säger att tillägget följer med nästa köp',
    /följer tillägget med som en egen rad nästa gång ni köper timmar/.test(kort) && /Inget dras av sig självt/.test(kort), kort);
  prova('skulden: inga banderoller utan spärr och utan betalning', (await page.locator('#bet-tillagg .bet-tillagg-banner').count()) === 0);
  await bild(page, 'betalning-skulden', '#bet-tillagg');

  await page.click('[data-betala-skuld]');
  await page.waitForSelector(villkorsruta + ' [data-kassa-kryss]', { timeout: 4000 }).catch(() => {});
  const ruta = await innehåll(page, villkorsruta);
  prova('skulden: kassans ruta säger vad som betalas och att koder inte gäller',
    /Betala tillägget/.test(ruta) && /Upplupet tillägg för extra barn, 2 pass · 207\s*kr/.test(ruta) && /Rabattkoder gäller inte/.test(ruta), ruta);
  prova('skulden: ingen kassa före krysset', kassor(S).length === 0);
  await page.click(villkorsruta + ' [data-kassa-kryss]');
  const fore = S.logg.length;
  await Promise.all([
    page.waitForURL(/\?tillagg=cs_test_prov/, { timeout: 6000 }).catch(() => {}),
    page.click(villkorsruta + ' [data-svar="ja"]')
  ]);
  const k = (kassor(S).pop() || {}).kropp || {};
  prova('skulden: kassan får bara att det är skulden, med krysset, aldrig ett belopp',
    k.skuld === true && k.villkor === true && !('belopp_ore' in k) && !('erbjudande' in k) && !('rabattkod' in k), JSON.stringify(k));
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
  await vänta(1200);
  prova('skulden: tillbaka från Stripe står tacket under Betalning',
    /Betalningen för tillägget är mottagen/.test(await innehåll(page, '#bet-msg')), await innehåll(page, '#bet-msg'));
  prova('skulden: adressen städas', !/tillagg=/.test(page.url()) && /#betalning$/.test(page.url()), page.url());
  /* Sidan som laddas om läser som vanligt (RPC:er är POST) och stämplar
     last_seen_at; inget som rör pengarna, passen eller tillägget skrivs. */
  const efter = S.logg.slice(fore).filter(r => r.metod !== 'GET' && r.metod !== 'HEAD' && !/^\/auth\//.test(r.väg)
    && r.väg !== '/functions/v1/stripe-checkout'
    && (/tillagg|betal|klippkort|bookings|kassa|stripe/.test(r.väg) && r.väg !== '/rest/v1/rpc/mitt_tillagg'
      || (r.väg === '/rest/v1/profiles' && JSON.stringify(Object.keys(r.kropp || {})) !== '["last_seen_at"]')));
  prova('skulden: att komma tillbaka skriver ingenting (webhooken skriver)', efter.length === 0,
    efter.map(r => r.metod + ' ' + r.väg).join(', '));
  prova('skulden: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('skulden: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 4. Spärren och en betalning som pågår ============ */
async function provaBanderollerna(webb) {
  const { context, page, konsol } = await öppna(webb, { tillagg: {
    sparr: 'alder', upplupet_ore: 6900, upplupna: 1, i_betalning_ore: 13800, i_betalning: 1,
    poster: poster().map(p => p.id === 'post-2' ? Object.assign({}, p, { status: 'i_betalning' }) : p) } });
  await till(page, '/foralder#betalning');
  const spärr = await innehåll(page, '#bet-tillagg .bet-tillagg-banner.ar-sparr');
  prova('banderoller: spärren står med skälet', /Extra barn är spärrat/.test(spärr) && /mer än 45 dagar/.test(spärr), spärr);
  const pågår = await innehåll(page, '#bet-tillagg .bet-tillagg-banner.ar-pagar');
  prova('banderoller: En betalning pågår redan', /En betalning pågår redan/.test(pågår) && /1 pass/.test(pågår)
    && /30 minuter/.test(pågår), pågår);
  const rader = await page.locator('#bet-tillagg .bet-tillagg-rader li').allTextContents();
  prova('banderoller: posten i betalningen står inte bland de upplupna', rader.length === 1 && /69\s*kr/.test(rader[0]), rader.join(' | '));
  await bild(page, 'betalning-banderoller', '#bet-tillagg');
  prova('banderoller: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 5. Tillägget som egen rad i ett köp ============ */
async function provaKöpet(webb) {
  for (const [namn, över] of [['obligatoriskt', {}], ['valfritt', { obligatorisk: false }]]) {
    const { context, page, S, konsol } = await öppna(webb, { tillagg: över });
    const larm = [];
    page.on('dialog', d => { larm.push(d.message()); d.dismiss().catch(() => {}); });
    await till(page, '/foralder#erbjudanden');
    await page.waitForSelector('[data-kop="plan_basic"]', { timeout: 6000 }).catch(() => {});
    await page.click('[data-kop="plan_basic"]');
    await page.waitForSelector(villkorsruta + ' [data-kassa-kryss]', { timeout: 4000 }).catch(() => {});
    const ruta = await innehåll(page, villkorsruta + ' .nx-kassa-tillagg');
    prova('köpet ' + namn + ': tillägget står som egen rad, utan rabattkod',
      /Upplupet tillägg för extra barn, 2 pass · 207\s*kr/.test(ruta) && /utan rabattkod/.test(ruta), ruta);
    prova('köpet ' + namn + ': totalen med tillägget', /Totalt 1\s?723\s*kr/.test(ruta), ruta);
    if (namn === 'obligatoriskt') {
      prova('köpet obligatoriskt: inget att kryssa ur', (await page.locator(villkorsruta + ' [data-kassa-tillagg]').count()) === 0);
    } else {
      prova('köpet valfritt: tillägget är ikryssat', await page.locator(villkorsruta + ' [data-kassa-tillagg]').isChecked());
      await page.uncheck(villkorsruta + ' [data-kassa-tillagg]');
      prova('köpet valfritt: utan tillägget är totalen planens',
        /Totalt 1\s?516\s*kr/.test(await innehåll(page, villkorsruta + ' [data-kassa-total]')),
        await innehåll(page, villkorsruta + ' [data-kassa-total]'));
    }
    await bild(page, 'kopet-' + namn, villkorsruta + ' .nx-fraga-box');
    await page.click(villkorsruta + ' [data-kassa-kryss]');
    await page.click(villkorsruta + ' [data-svar="ja"]');
    await vänta(900);
    const k = (kassor(S).pop() || {}).kropp || {};
    prova('köpet ' + namn + ': kassan får köpet och valet, aldrig tilläggets belopp',
      k.erbjudande === 'plan_basic' && !('tillagg_ore' in k) && !('belopp_ore' in k)
        && (namn === 'obligatoriskt' ? !('med_tillagg' in k) : k.med_tillagg === false), JSON.stringify(k));
    prova('köpet ' + namn + ': inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
}

/* ============ 6. Passen: barnen och tillägget ============ */
async function provaPassen(webb) {
  const { context, page, konsol } = await öppna(webb, {});
  await till(page, '/foralder#pass/pass-h2');
  await page.waitForSelector('[data-sek="pass"]:not([hidden])', { timeout: 5000 }).catch(() => {});
  await vänta(400);
  const sida = await innehåll(page, '[data-sek="pass"]');
  prova('passet: alla barnen står, med förnamn', /Kim, Vera och <b>Mio<\/b>/.test(sida), sida.slice(0, 600));
  prova('passet: antalet barn och tillägget att betala', /3 barn på passet · tillägg 138\s*kr att betala/.test(sida), sida.slice(0, 600));
  prova('passet: HTML-namnet står som text', (await page.locator('[data-sek="pass"] b').filter({ hasText: 'Mio' }).count()) === 0);
  await till(page, '/foralder#pass/pass-b');
  await page.waitForSelector('[data-sek="pass"]:not([hidden])', { timeout: 5000 }).catch(() => {});
  await vänta(400);
  prova('passet: det bokade säger att tillägget blir en skuld efter passet',
    /tillägg 69\s*kr, som skuld efter passet/.test(await innehåll(page, '[data-sek="pass"]')), (await innehåll(page, '[data-sek="pass"]')).slice(0, 600));
  prova('passet: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 7. Strömbrytaren av, och utan migrationen ============ */
async function provaAv(webb) {
  for (const [namn, o] of [['strömbrytaren av', { tillagg: Object.assign({ pa: false, version: 'utkast', godkand_at: null }, UTAN_SKULD) }],
    ['utan migrationen', { tillagg: null }]]) {
    const { context, page, S, riktiga, konsol } = await öppna(webb, o);
    await till(page, '/foralder#boka');
    await väljDagOchTid(page);
    prova(namn + ': Antal barn som förut, inga syskonval',
      (await page.locator('#boka-inner #bk-barn').count()) === 1 && (await page.locator('#boka-inner #bk-syskon').count()) === 0);
    await page.click('#boka-inner #bk-barn [data-v="2"]').catch(() => {});
    await vänta(200);
    prova(namn + ': två barn kostar timpriset och tillägget, som förut',
      /468\s*kr/.test(await innehåll(page, '#boka-inner .bk-sum-pris')), await innehåll(page, '#boka-inner .bk-sum-pris'));
    await page.click('#bk-boka');
    await vänta(1200);
    const post = S.logg.find(r => r.metod === 'POST' && r.väg === '/rest/v1/bookings');
    const k = post ? (Array.isArray(post.kropp) ? post.kropp[0] : post.kropp) || {} : {};
    prova(namn + ': passet skickar antal_barn 2 och ingen extra_barn', k.antal_barn === 2 && !('extra_barn' in k), JSON.stringify(k));
    await till(page, '/foralder#betalning');
    prova(namn + ': inget kort för tillägget', !(await synlig(page, '#bet-tillagg')));
    prova(namn + ': inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
    prova(namn + ': inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
}

/* ============ 8. Telefon och mörkt läge ============ */
async function provaTelefonOchMörkt(webb) {
  for (const [namn, ctx] of [['telefon ljust', { viewport: { width: 390, height: 844 }, colorScheme: 'light', isMobile: true, hasTouch: true }],
    ['telefon mörkt', { viewport: { width: 390, height: 844 }, colorScheme: 'dark', isMobile: true, hasTouch: true }],
    ['dator mörkt', { colorScheme: 'dark' }]]) {
    const { context, page, konsol } = await öppna(webb, { tillagg: { godkand_at: null }, context: ctx });
    await till(page, '/foralder#betalning');
    prova(namn + ': Betalning går inte i sidled', await ingenSidled(page));
    const färger = await page.locator('#bet-tillagg .bet-tillagg-kort').first().evaluate(el => {
      const s = getComputedStyle(el);
      return [s.color, s.backgroundColor];
    }).catch(() => ['', '']);
    prova(namn + ': kortet har text och yta i olika färger', färger[0] && färger[0] !== färger[1], JSON.stringify(färger));
    const knapp = await page.locator('[data-betala-skuld]').first().boundingBox().catch(() => null);
    prova(namn + ': knappen är minst 44 px hög', knapp && knapp.height >= 44 - 0.5, JSON.stringify(knapp));
    await bild(page, 'betalning-' + namn.replace(/ /g, '-'), '#bet-tillagg');
    await till(page, '/foralder#boka');
    await väljDagOchTid(page);
    await page.click('#boka-inner #bk-syskon button[data-v="elev-c"]').catch(() => {});
    await vänta(250);
    prova(namn + ': Boka pass med villkoren går inte i sidled', await ingenSidled(page));
    prova(namn + ': villkoren syns', await synlig(page, '#boka-inner .bk-syskon-villkor'));
    await bild(page, 'boka-' + namn.replace(/ /g, '-'), '#boka-inner .bk-syskon-info');
    prova(namn + ': inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
}

/* ============ 9. Studiehjälparen ser barnen på passet ============ */
async function provaStudiehjälparen(webb) {
  const { context, page, S, riktiga, konsol } = await öppna(webb, { anv: SARA, värld: W => {
    // Studiehjälparens pass: det bokade har tre barn, med HTML-namnet.
    W.bokning_barn.push({ bokning_id: 'pass-b', barn_id: 'elev-d', ar_huvudbarn: false });
  } });
  await till(page, '/larare#pass/pass-b');
  await page.waitForSelector('[data-sek="pass"]:not([hidden])', { timeout: 6000 }).catch(() => {});
  await vänta(500);
  const sida = await innehåll(page, '[data-sek="pass"]');
  prova('studiehjälparen: Barnen på passet med förnamn och årskurs',
    /Barnen på passet/.test(sida) && /3 barn/.test(sida) && /Kim \(åk 8\), Vera \(åk 6\) och <b>Mio<\/b> \(åk 3\)/.test(sida), sida.slice(0, 800));
  prova('studiehjälparen: HTML-namnet står som text', (await page.locator('[data-sek="pass"] b').filter({ hasText: 'Mio' }).count()) === 0);
  const fråga = S.logg.find(r => r.väg === '/rest/v1/rpc/passens_barn');
  prova('studiehjälparen: barnen läses genom passens_barn med passens id', fråga && Array.isArray((fråga.kropp || {}).p_bokningar)
    && fråga.kropp.p_bokningar.includes('pass-b'), JSON.stringify(fråga && fråga.kropp));
  prova('studiehjälparen: inga pengar om tillägget', !/tillägg 69|Upplupet/.test(sida), sida.slice(0, 400));
  await bild(page, 'studiehjalparen-passet', '[data-sek="pass"]');
  prova('studiehjälparen: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('studiehjälparen: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

(async function () {
  const server = spawn('python3', [path.join(ROT, '.claude', 'serve.py'), String(PORT)], { stdio: 'ignore' });
  let klar = false;
  for (let i = 0; i < 50 && !klar; i++) {
    try { klar = (await fetch(BAS + '/foralder')).ok; } catch (e) { await vänta(100); }
  }
  const webb = await pw.chromium.launch();
  try {
    await provaBokaFörstaGången(webb);
    await provaBokaGodkänd(webb);
    await provaSkulden(webb);
    await provaBanderollerna(webb);
    await provaKöpet(webb);
    await provaPassen(webb);
    await provaAv(webb);
    await provaTelefonOchMörkt(webb);
    await provaStudiehjälparen(webb);
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
