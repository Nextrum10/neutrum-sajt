/* ============================================================
   NEXTRUM — webbläsarprov för utbildningsprovet i studiehjälparvyn
   (2026-10-21)

       NODE_PATH="$(npm root -g)" node verktyg/prova-utbildningsprovet.js [mapp för bilder]

   Byggt som verktyg/prova-koder.js (egen port, 8978): sidorna serveras av
   .claude/serve.py, nextrum-config.js byts i farten mot en som pekar på
   https://supabase.test, och varje anrop dit besvaras här av en falsk
   Supabase. Ett anrop till den riktiga adressen fäller provet. Körs inte
   i CI: Playwright är ingen del av repot.

   Databasens regler (spärren, rättningen, facit, väntetiden) provas i
   rls-test.sql, avsnitt 41. Här provas vyerna:
     - studiehjälparvyn: rutan med frågorna innan vyn öppnas, att alla
       frågor måste besvaras, underkänt och väntan, godkänt och Fortsätt,
       väntan direkt vid inloggningen, ingen ruta när provet inte krävs
       eller migrationen saknas, en telefon och mörkt läge
     - adminvyn: fliken Provet i vyn med varningen, frågorna och facit, en
       ny fråga, att stänga av en fråga, gränsen, studiehjälparna, och
       Nollställ provet i studiehjälparens panel
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
const PORT = 8978;
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

function jwt(sub, roll) {
  const b = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  return b({ alg: 'HS256', typ: 'JWT' }) + '.' + b({ sub, role: roll, exp: 4102444800 }) + '.provet';
}
const ADMIN = { id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'leo@example.se',
  app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-09-01T10:00:00Z' };
const SARA = { id: 'sh-a', aud: 'authenticated', role: 'authenticated', email: 'sara@example.se',
  app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-10-20T10:00:00Z' };

const FRÅGOR = [1, 2, 3, 4, 5].map(i => ({ id: 'fraga-' + i, fraga: 'Fråga nummer ' + i + ' om rapporten?',
  alternativ: ['Svar A', 'Svar B', 'Svar C'] }));

function värld() {
  return {
    profiles: [
      { id: 'admin-1', role: 'parent', full_name: 'Leo Admin', email: 'leo@example.se', is_admin: true,
        match_status: 'pending', created_at: '2026-09-01T10:00:00Z' },
      { id: 'sh-a', role: 'tutor', full_name: 'Sara Ahl', email: 'sara@example.se', is_admin: false,
        created_at: '2026-10-20T10:00:00Z' },
      { id: 'sh-b', role: 'tutor', full_name: 'Bo Bengtsson', email: 'bo@example.se', is_admin: false,
        created_at: '2026-09-01T10:00:00Z' }
    ],
    tutor_profiles: [
      { id: 'sh-a', status: 'approved', hourly_rate: 150, subjects: ['Matematik'], grade_levels: [], formats: [],
        created_at: '2026-10-20T10:00:00Z' },
      { id: 'sh-b', status: 'approved', hourly_rate: 150, subjects: [], grade_levels: [], formats: [],
        created_at: '2026-09-01T10:00:00Z' }
    ],
    /* Fyra aktiva frågor: spärren gäller först vid fem. */
    prov_fragor: [1, 2, 3, 4].map(i => ({ id: 'q-' + i, fraga: 'Adminfråga ' + i, alternativ: ['Ja', 'Nej', 'Kanske'],
      ratt_svar: i % 3, aktiv: true, ordning: i * 10, skapad_at: '2026-10-21T08:0' + i + ':00Z', andrad_at: null })),
    prov_installning: [{ grans_procent: 50, min_aktiva_fragor: 5, vantetid_timmar: 24, andrad_at: null }],
    prov_studiehjalpare: [{ id: 'sh-b', kravs: false, utbildningsprov_godkant_at: null, aterstalld_at: null,
      undantagen: 'godkänd före provet (2026-10-21)' }],
    prov_forsok: [{ id: 'f-1', studiehjalpare_id: 'sh-a', inlamnad_at: nu(-60 * 30), ratt: 2, antal: 5, procent: 40,
      godkand: false }],
    tjanster: [{ kod: 'laxhjalp', namn: 'Läxhjälp', aktiv: true, for_jobb: true, for_kund: true, ordning: 1,
      pris_per_timme_ore: 39900 }]
  };
}

/* o.anv: den inloggade. o.prov: vad mitt_utbildningsprov svarar, eller
   null för en databas utan funktionen. o.efter: vad det svarar efter en
   inlämning. o.resultat: vad lamna_in_utbildningsprov svarar. */
function falskSupabase(o) {
  const ANV = o.anv || ADMIN;
  const W = värld();
  const logg = [];
  let löpnr = 0;
  let inlämnat = false;
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
    }
    return ut;
  }
  const admin = ANV.id === 'admin-1';
  const RPC = {
    mina_behorigheter: () => (admin ? { admin: true, superadmin: true, behorigheter: [] }
      : { admin: false, superadmin: false, behorigheter: [] }),
    mitt_villkorslage: () => ({ version: '2026-10-21', godkant_at: '2026-10-21T09:00:00+00:00', tidigare: false }),
    mitt_utbildningsprov: () => (inlämnat && o.efter ? o.efter : o.prov),
    lamna_in_utbildningsprov: () => { inlämnat = true; return o.resultat; },
    utbildningsprovet_lage: () => ({ grans_procent: 50, min_aktiva_fragor: 5, vantetid_timmar: 24,
      aktiva: W.prov_fragor.filter(f => f.aktiv).length, alla: W.prov_fragor.length,
      sparr_galler: W.prov_fragor.filter(f => f.aktiv).length >= 5 }),
    spara_provfraga: k => {
      if (k.p_id) { Object.assign(W.prov_fragor.find(f => f.id === k.p_id) || {}, { aktiv: k.p_aktiv }); return k.p_id; }
      const id = 'q-ny-' + (++löpnr);
      W.prov_fragor.push({ id, fraga: k.p_fraga, alternativ: k.p_alternativ, ratt_svar: k.p_ratt_svar,
        aktiv: k.p_aktiv, ordning: 100, skapad_at: nu(0), andrad_at: null });
      return id;
    },
    satt_provinstallning: () => null,
    aterstall_utbildningsprov: () => null,
    satt_provkrav: () => null
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
    if (p.startsWith('/functions/v1/')) return svar(route, 404, {});
    if (p.startsWith('/storage/v1/')) return svar(route, 200, {});
    if (p.startsWith('/rest/v1/rpc/')) {
      const namn = p.slice('/rest/v1/rpc/'.length);
      const f = RPC[namn];
      if (!f || (namn === 'mitt_utbildningsprov' && o.prov === null)) {
        return svar(route, 404, { code: 'PGRST202', message: 'Could not find the function' });
      }
      return svar(route, 200, f(kropp || {}));
    }
    if (p.startsWith('/rest/v1/')) {
      const tabell = p.slice('/rest/v1/'.length);
      const ett = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
      if (metod === 'GET' || metod === 'HEAD') {
        const rader = filtrera(W[tabell] || [], url.searchParams);
        const cr = rader.length ? '0-' + (rader.length - 1) + '/' + rader.length : '*/0';
        if (ett) return rader.length ? svar(route, 200, rader[0], { 'content-range': cr }) : svar(route, 406, { code: 'PGRST116', message: 'no rows' });
        return svar(route, 200, rader, { 'content-range': cr });
      }
      if (metod === 'PATCH') return svar(route, 204);
      if (metod === 'POST') return svar(route, 201, []);
      return svar(route, 405, {});
    }
    return svar(route, 404, {});
  }
  return { W, logg, hantera, session };
}

async function öppna(webb, o) {
  const context = await webb.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, o.context || {}));
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
    try { localStorage.setItem(nyckel, värde); } catch (e) { /* ingen lagring */ }
  }, [LAGRING, JSON.stringify(S.session())]);
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) konsol.push(m.text()); });
  page.on('pageerror', e => konsol.push('pageerror: ' + e.message));
  return { context, page, S, riktiga, konsol };
}

const synlig = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const text = (page, sel) => page.locator(sel).first().innerText().catch(() => '');
async function bild(page, namn, sel) {
  if (!BILDER) return;
  fs.mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: path.join(BILDER, namn + '.png'), fullPage: false });
  if (sel) await page.locator(sel).first().screenshot({ path: path.join(BILDER, namn + '-del.png') }).catch(() => {});
}
const anrop = (S, namn) => S.logg.filter(r => r.väg === '/rest/v1/rpc/' + namn);

const KRAVS = { studiehjalpare: true, kravs: true, godkant_at: null, grans_procent: 50, kan_gora_om_fran: null,
  senaste: null, fragor: FRÅGOR };

async function tillLärarvyn(page) {
  await page.goto(BAS + '/larare');
  await page.waitForSelector('.nx-prov.open, #view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
  await vänta(300);
}
async function svaraAlla(page, val) {
  for (const f of FRÅGOR) await page.check('input[data-fraga="' + f.id + '"][value="' + val + '"]');
}

/* ============ 1. Studiehjälparvyn: underkänt och väntan ============ */
async function provaUnderkänt(webb) {
  const KAN = nu(24 * 60);
  const { context, page, S, riktiga, konsol } = await öppna(webb, { anv: SARA, prov: KRAVS,
    resultat: { ratt: 2, antal: 5, godkand: false },
    efter: Object.assign({}, KRAVS, { fragor: [], kan_gora_om_fran: KAN,
      senaste: { inlamnad_at: nu(0), ratt: 2, antal: 5, godkand: false } }) });
  await tillLärarvyn(page);
  prova('vyn: rutan Utbildningsprovet står före vyn', (await text(page, '#prov-t')) === 'Utbildningsprovet'
    && !(await synlig(page, '#view-app')), await text(page, '#prov-t'));
  prova('vyn: fem frågor med tre alternativ var', (await page.locator('.nx-prov-fraga').count()) === 5
    && (await page.locator('.nx-prov-alt').count()) === 15);
  const html = await page.content();
  prova('vyn: inget facit i sidan', !/ratt_svar|facit/i.test(html));
  prova('vyn: rutan säger gränsen och att provet kan göras om efter ett dygn',
    /Mer än 50 procent rätt är godkänt/.test(await text(page, '.nx-prov .nx-fraga-box > p'))
    && /efter ett dygn/.test(await text(page, '.nx-prov .nx-fraga-box > p')), await text(page, '.nx-prov .nx-fraga-box > p'));
  prova('vyn: rutan går inte att stänga med Escape', await (async () => {
    await page.keyboard.press('Escape'); await vänta(200); return synlig(page, '.nx-prov.open'); })());
  await bild(page, 'prov-rutan', '.nx-prov .nx-fraga-box');

  await page.check('input[data-fraga="fraga-1"][value="0"]');
  await page.click('form[data-prov] [type="submit"]');
  await vänta(200);
  prova('vyn: alla frågor måste besvaras', /Svara på alla frågor/.test(await text(page, '#prov-msg'))
    && anrop(S, 'lamna_in_utbildningsprov').length === 0, await text(page, '#prov-msg'));

  await svaraAlla(page, 1);
  await page.click('form[data-prov] [type="submit"]');
  await page.waitForSelector('[data-prov-ut]', { timeout: 5000 }).catch(() => {});
  await vänta(300);
  const inl = anrop(S, 'lamna_in_utbildningsprov')[0];
  prova('vyn: svaren skickas som fråga → alternativ, inget annat',
    inl && JSON.stringify(Object.keys(inl.kropp || {})) === '["p_svar"]'
    && Object.keys(inl.kropp.p_svar).length === 5 && Object.values(inl.kropp.p_svar).every(v => v === 1),
    JSON.stringify(inl && inl.kropp));
  const vänt = await text(page, '.nx-prov .nx-fraga-box');
  prova('vyn: underkänt säger poängen och när det går att göra om',
    /Du kan göra om provet senare/.test(vänt) && /2 av 5 rätt/.test(vänt) && /Du kan göra om provet från/.test(vänt), vänt);
  prova('vyn: underkänd kommer inte in, och Logga ut finns', !(await synlig(page, '#view-app'))
    && await synlig(page, '[data-prov-ut]'));
  await bild(page, 'prov-underkant', '.nx-prov .nx-fraga-box');
  prova('vyn underkänt: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('vyn underkänt: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 2. Godkänt, väntan vid inloggningen, och inget prov ============ */
async function provaGodkänt(webb) {
  {
    const { context, page, S, konsol } = await öppna(webb, { anv: SARA, prov: KRAVS,
      resultat: { ratt: 4, antal: 5, godkand: true } });
    await tillLärarvyn(page);
    await svaraAlla(page, 0);
    await page.click('form[data-prov] [type="submit"]');
    await page.waitForSelector('[data-prov-in]', { timeout: 5000 }).catch(() => {});
    prova('vyn: godkänt säger poängen', /Du fick 4 av 5 rätt/.test(await text(page, '.nx-prov .nx-fraga-box')),
      await text(page, '.nx-prov .nx-fraga-box'));
    await bild(page, 'prov-godkant', '.nx-prov .nx-fraga-box');
    await page.click('[data-prov-in]');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
    prova('vyn: Fortsätt öppnar studiehjälparvyn', await synlig(page, '#view-app')
      && (await page.locator('.nx-prov').count()) === 0);
    prova('vyn godkänt: provet lämnades in en gång', anrop(S, 'lamna_in_utbildningsprov').length === 1);
    prova('vyn godkänt: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
  {
    const { context, page, konsol } = await öppna(webb, { anv: SARA,
      prov: Object.assign({}, KRAVS, { fragor: [], kan_gora_om_fran: nu(10 * 60),
        senaste: { inlamnad_at: nu(-14 * 60), ratt: 1, antal: 5, godkand: false } }) });
    await tillLärarvyn(page);
    prova('vyn: den som väntar ser väntan direkt, utan frågor',
      /Du kan göra om provet senare/.test(await text(page, '.nx-prov .nx-fraga-box'))
      && (await page.locator('.nx-prov-fraga').count()) === 0 && !(await synlig(page, '#view-app')));
    prova('vyn väntan: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
  for (const [namn, prov] of [['provet krävs inte', { studiehjalpare: true, kravs: false, fragor: [] }],
                              ['utan migrationen', null]]) {
    const { context, page, konsol } = await öppna(webb, { anv: SARA, prov });
    await tillLärarvyn(page);
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
    prova('vyn ' + namn + ': ingen ruta, vyn öppnas', await synlig(page, '#view-app')
      && (await page.locator('.nx-prov').count()) === 0);
    prova('vyn ' + namn + ': inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
}

/* ============ 3. Telefonen och mörkt läge ============ */
async function provaTelefonen(webb) {
  for (const [namn, context] of [['telefon', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
                                 ['mörkt läge', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
                                   colorScheme: 'dark' }]]) {
    const { context: c, page, konsol } = await öppna(webb, { anv: SARA, prov: KRAVS, context });
    await tillLärarvyn(page);
    const mått = await page.evaluate(() => {
      const box = document.querySelector('.nx-prov .nx-fraga-box').getBoundingClientRect();
      const alt = [...document.querySelectorAll('.nx-prov-alt')].map(a => Math.round(a.getBoundingClientRect().height));
      const fält = getComputedStyle(document.querySelector('.nx-prov-alt')).fontSize;
      const bg = getComputedStyle(document.querySelector('.nx-prov .nx-fraga-box')).backgroundColor;
      return { vänster: box.left, höger: box.right, bredd: innerWidth, alt, fält, bg,
               rullar: document.documentElement.scrollWidth > innerWidth };
    });
    prova(namn + ': rutan ryms i bredden', mått.vänster >= 0 && mått.höger <= mått.bredd && !mått.rullar, JSON.stringify(mått));
    prova(namn + ': varje alternativ är minst 44 px och 16 px text',
      mått.alt.every(h => h >= 44) && mått.fält === '16px', JSON.stringify([mått.alt, mått.fält]));
    prova(namn + ': rutan har en egen yta', mått.bg && mått.bg !== 'rgba(0, 0, 0, 0)', mått.bg);
    await bild(page, 'prov-' + namn.replace(/ /g, '-'), '.nx-prov .nx-fraga-box');
    prova(namn + ': inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await c.close();
  }
}

/* ============ 4. Adminvyn ============ */
async function provaAdminvyn(webb) {
  const { context, page, S, riktiga, konsol } = await öppna(webb, { anv: ADMIN });
  page.on('dialog', d => d.accept());
  await page.goto(BAS + '/admin#ansokningar');
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
  await vänta(900);
  await page.click('#flik-ans-prov');
  await vänta(400);
  prova('admin: fliken Provet i vyn finns i Ansökningar', await synlig(page, '#panel-ans-prov'));
  prova('admin: varningen säger att provet inte krävs än, med fyra av fem',
    /Provet krävs inte av någon än/.test(await text(page, '#prov-varning'))
    && /4 aktiva frågor/.test(await text(page, '#prov-varning')) && /vid 5/.test(await text(page, '#prov-varning')),
    await text(page, '#prov-varning'));
  prova('admin: fyra frågor, var och en med sitt rätta svar markerat',
    (await page.locator('.prov-lista > .prov-fraga').count()) === 4
    && (await page.locator('.prov-alt li.ar-ratt').count()) === 4
    && (await text(page, '.prov-lista > .prov-fraga:first-child .ar-ratt')).includes('Nej'),
    await text(page, '.prov-lista'));
  prova('admin: gränsen, spärren och väntetiden står i formuläret',
    (await page.inputValue('#prov-grans')) === '50' && (await page.inputValue('#prov-minst')) === '5'
    && (await page.inputValue('#prov-vanta')) === '24');
  const personer = await text(page, '#prov-personer');
  prova('admin: studiehjälparna med läget', /Sara Ahl/.test(personer) && /Krävs\b/.test(personer)
    && /Bo Bengtsson/.test(personer) && /Krävs inte/.test(personer) && /2 av 5 rätt/.test(personer), personer);
  await bild(page, 'admin-provet', '#panel-ans-prov');

  /* En ny fråga: en med ett alternativ nekas i vyn, sedan en hel. */
  await page.click('.prov-ny > summary');
  const ny = 'form[data-prov-form="ny"]';
  await page.fill(ny + ' textarea[name="fraga"]', 'När skrivs rapporten?');
  await page.fill(ny + ' input[name="alt"] >> nth=0', 'Direkt efter passet');
  await page.click(ny + ' [type="submit"]');
  await vänta(200);
  prova('admin: en fråga med ett alternativ nekas innan något skickas',
    /minst två alternativ/.test(await text(page, ny + ' [data-prov-msg]')) && anrop(S, 'spara_provfraga').length === 0,
    await text(page, ny + ' [data-prov-msg]'));
  await page.fill(ny + ' input[name="alt"] >> nth=1', 'Nästa vecka');
  await page.fill(ny + ' input[name="alt"] >> nth=2', 'Aldrig');
  await page.check(ny + ' input[name="ratt"][value="0"]');
  await page.click(ny + ' [type="submit"]');
  await vänta(600);
  const sparad = anrop(S, 'spara_provfraga')[0];
  prova('admin: Lägg till frågan skickar frågan, alternativen och facit',
    sparad && sparad.kropp.p_id === null && sparad.kropp.p_fraga === 'När skrivs rapporten?'
    && JSON.stringify(sparad.kropp.p_alternativ) === '["Direkt efter passet","Nästa vecka","Aldrig"]'
    && sparad.kropp.p_ratt_svar === 0 && sparad.kropp.p_aktiv === true, JSON.stringify(sparad && sparad.kropp));
  prova('admin: den nya frågan står i listan, och varningen är borta vid fem',
    (await page.locator('.prov-lista > .prov-fraga').count()) === 5 && !(await text(page, '#prov-varning')).trim(),
    await text(page, '#prov-varning'));

  /* Stänga av en fråga under gränsen frågar först. */
  await page.click('.prov-lista > .prov-fraga:first-child [data-prov-aktiv]');
  await page.waitForSelector('.nx-fraga-box [data-svar="ja"]', { timeout: 3000 }).catch(() => {});
  const fråga = await text(page, '.nx-fraga-box');
  prova('admin: att stänga av en fråga under gränsen frågar först', /spärren gäller först vid 5/.test(fråga), fråga);
  await page.click('.nx-fraga-box [data-svar="ja"]');
  await vänta(600);
  const av = anrop(S, 'spara_provfraga').pop();
  prova('admin: Stäng av sparar frågan som av', av && av.kropp.p_id === 'q-1' && av.kropp.p_aktiv === false,
    JSON.stringify(av && av.kropp));

  await page.fill('#prov-grans', '60');
  await page.click('form[data-prov-inst] [type="submit"]');
  await vänta(600);
  const inst = anrop(S, 'satt_provinstallning')[0];
  prova('admin: gränsen sparas som tal', inst && inst.kropp.p_grans_procent === 60
    && inst.kropp.p_min_aktiva_fragor === 5 && inst.kropp.p_vantetid_timmar === 24, JSON.stringify(inst && inst.kropp));

  /* Studiehjälparens panel: läget, försöket och Nollställ. */
  await page.click('#prov-personer [data-dp="studiehjalpare:sh-a"]');
  await vänta(600);
  const panel = await text(page, '.dp');
  prova('admin: panelen har Utbildningsprovet med läget och försöket',
    /Utbildningsprovet/.test(panel) && /Krävs, inte godkänt än/.test(panel) && /2 av 5 rätt/.test(panel)
    && /Underkänt/.test(panel), panel.slice(0, 1200));
  await bild(page, 'admin-provet-panel', '.dp');
  await page.click('.dp [data-prov-aterstall="sh-a"]');
  await page.waitForSelector('.nx-fraga-box [data-svar="ja"]', { timeout: 3000 }).catch(() => {});
  await page.click('.nx-fraga-box [data-svar="ja"]');
  await vänta(600);
  const noll = anrop(S, 'aterstall_utbildningsprov')[0];
  prova('admin: Nollställ provet anropar databasen för personen', noll && noll.kropp.p_studiehjalpare === 'sh-a',
    JSON.stringify(noll && noll.kropp));
  prova('admin: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('admin: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

(async function () {
  const server = spawn('python3', [path.join(ROT, '.claude', 'serve.py'), String(PORT)], { stdio: 'ignore' });
  let klar = false;
  for (let i = 0; i < 50 && !klar; i++) {
    try { klar = (await fetch(BAS + '/larare')).ok; } catch (e) { await vänta(100); }
  }
  const webb = await pw.chromium.launch();
  try {
    await provaUnderkänt(webb);
    await provaGodkänt(webb);
    await provaTelefonen(webb);
    await provaAdminvyn(webb);
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
