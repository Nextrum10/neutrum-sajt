/* ============================================================
   NEXTRUM — webbläsarprov för användarvillkoren (2026-10-07)

       NODE_PATH="$(npm root -g)" node verktyg/prova-villkor.js [mapp för bilder]

   Leo: "Fixa den gamla luckan". Ingen godkände användarvillkoren när
   kontot skapades. Nu kräver Skapa konto en kryssruta, och den som saknar
   ett godkännande av den gällande versionen får en ruta vid inloggningen
   som inte går att stänga: efter lösenordet, före introduktionen.

   Byggt som verktyg/prova-introduktion.js (egen port, 8971), mot en
   falsk Supabase som kan mitt_villkorslage, godkann_villkor och
   registreringen. Ett anrop till den riktiga adressen fäller provet.
   Spärren i databasen provas i rls-test.sql, avsnitt 23.
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
const PORT = 8971;
const BAS = 'http://localhost:' + PORT;
const FALSK = 'https://supabase.test';
const RIKTIG = /ddkfiuvcppalutfulvbi\.supabase\.co/;
const LAGRING = 'sb-supabase-auth-token';
const BILDER = process.argv[2] || null;
const VERSION = '2026-09-30';

const utfall = [];
function prova(namn, ok, detalj) {
  utfall.push({ namn, ok: !!ok, detalj: ok ? '' : String(detalj == null ? '' : detalj) });
}
const vänta = ms => new Promise(r => setTimeout(r, ms));

function jwt(sub, roll) {
  const b = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  return b({ alg: 'HS256', typ: 'JWT' }) + '.' + b({ sub, role: roll, exp: 4102444800 }) + '.provet';
}
function subUr(huvud) {
  try {
    const del = String(huvud || '').replace(/^Bearer /, '').split('.')[1];
    return JSON.parse(Buffer.from(del, 'base64url').toString()).sub || null;
  } catch (e) { return null; }
}

/* ============ den falska Supabase ============
   o.villkor: 'ja' (gällande version godkänd), 'nej' (inget godkännande),
   'äldre' (en äldre version) eller 'saknas' (en databas före
   migrationen: funktionerna finns inte). */
function falskSupabase(o) {
  const logg = [];
  const användare = {
    'foralder-1': { id: 'foralder-1', aud: 'authenticated', role: 'authenticated', email: 'anna@example.se',
                    app_metadata: { provider: 'email' }, user_metadata: Object.assign({}, o.metadata || {}),
                    created_at: '2026-10-06T10:00:00Z' },
    'handledare-1': { id: 'handledare-1', aud: 'authenticated', role: 'authenticated', email: 'sara@example.se',
                      app_metadata: { provider: 'email' }, user_metadata: Object.assign({}, o.metadata || {}),
                      created_at: '2026-10-06T10:00:00Z' }
  };
  let villkor = o.villkor || 'nej';
  const W = {
    profiles: [
      { id: 'foralder-1', role: 'parent', full_name: 'Anna Andersson', email: 'anna@example.se', is_admin: false,
        match_status: o.matchad ? 'matched' : 'pending', matched_tutor_id: o.matchad ? 'handledare-1' : null },
      { id: 'handledare-1', role: 'tutor', full_name: 'Sara Svensson', email: 'sara@example.se', is_admin: false }
    ],
    tutor_profiles: [{ id: 'handledare-1', status: 'pending', school: null, city: null,
      subjects: ['Matematik'], grade_levels: [], formats: [], bio: null, age: 22, hourly_rate: 180 }]
  };
  const läge = () => ({ version: VERSION, godkant_at: villkor === 'ja' ? '2026-10-07T08:00:00+00:00' : null,
                        tidigare: villkor === 'äldre' });
  const svar = (route, status, kropp, extra) => route.fulfill({
    status,
    headers: Object.assign({
      'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
      'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range, x-total-count'
    }, extra || {}),
    body: kropp === undefined ? '' : JSON.stringify(kropp)
  });
  function session(id) {
    return { access_token: jwt(id, 'authenticated'), refresh_token: 'prov-' + id, token_type: 'bearer',
             expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: användare[id] };
  }
  async function hantera(route) {
    const req = route.request();
    const url = new URL(req.url());
    const metod = req.method();
    if (metod === 'OPTIONS') return svar(route, 204);
    let kropp = null;
    try { kropp = req.postDataJSON(); } catch (e) { kropp = req.postData(); }
    const vem = subUr(req.headers()['authorization']);
    logg.push({ metod, väg: url.pathname, sök: url.search, kropp, vem });
    const p = url.pathname;
    if (p === '/auth/v1/user') {
      const anv = användare[vem];
      if (!anv) return svar(route, 401, { code: 'bad_jwt', message: 'invalid JWT' });
      if (metod === 'PUT') {
        Object.entries((kropp && kropp.data) || {}).forEach(([k, v]) => {
          if (v === null) delete anv.user_metadata[k]; else anv.user_metadata[k] = v;
        });
      }
      return svar(route, 200, anv);
    }
    /* Registreringen: kontot skapas och väntar på att adressen bekräftas. */
    if (p === '/auth/v1/signup') {
      return svar(route, 200, { id: 'ny-1', aud: 'authenticated', role: '', email: kropp && kropp.email,
        user_metadata: (kropp && kropp.data) || {}, app_metadata: { provider: 'email' },
        created_at: '2026-10-07T10:00:00Z', identities: [{ id: 'ny-1' }] });
    }
    if (p === '/auth/v1/logout') return svar(route, 204);
    if (p === '/auth/v1/token') return svar(route, 200, session(o.inloggad));
    if (p.startsWith('/auth/v1/')) return svar(route, 200, {});
    if (p.startsWith('/functions/v1/')) return svar(route, 404, {});
    if (p.startsWith('/storage/v1/')) return svar(route, 400, {});
    if (p === '/rest/v1/rpc/mina_behorigheter') return svar(route, 200, { admin: false, superadmin: false, behorigheter: [] });
    if (villkor !== 'saknas' && p === '/rest/v1/rpc/mitt_villkorslage') return svar(route, 200, läge());
    if (villkor !== 'saknas' && p === '/rest/v1/rpc/godkann_villkor') {
      if (!kropp || kropp.p_version !== VERSION) {
        return svar(route, 400, { code: '22023', message: 'Villkoren har ändrats sedan sidan laddades. Ladda om sidan och läs dem igen.' });
      }
      villkor = 'ja';
      return svar(route, 200, läge());
    }
    if (p.startsWith('/rest/v1/rpc/')) return svar(route, 404, { code: 'PGRST202', message: 'Ingen sådan funktion i provet.' });
    if (p.startsWith('/rest/v1/')) {
      if (metod !== 'GET' && metod !== 'HEAD') return svar(route, metod === 'PATCH' ? 204 : 201, metod === 'PATCH' ? undefined : []);
      const tabell = p.slice('/rest/v1/'.length);
      let rader = W[tabell] || [];
      const id = url.searchParams.get('id');
      if (id && id.startsWith('eq.')) rader = rader.filter(r => r.id === id.slice(3));
      const ett = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
      const cr = rader.length ? '0-' + (rader.length - 1) + '/' + rader.length : '*/0';
      if (ett) return rader.length ? svar(route, 200, rader[0], { 'content-range': cr }) : svar(route, 406, { code: 'PGRST116', message: 'no rows' });
      return svar(route, 200, rader, { 'content-range': cr });
    }
    return svar(route, 404, {});
  }
  return { logg, hantera, session, användare };
}

/* o.inloggad: kontots id, eller null för en utloggad sida. o.länk: 'invite'
   öppnar vyn med inbjudans länk i stället för en sparad inloggning. */
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
  if (o.inloggad && !o.länk) {
    await context.addInitScript(([nyckel, värde]) => {
      try { localStorage.setItem(nyckel, värde); } catch (e) { /* ingen lagring */ }
    }, [LAGRING, JSON.stringify(S.session(o.inloggad))]);
  }
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|status of 40[046]/.test(m.text())) konsol.push(m.text()); });
  page.on('pageerror', e => konsol.push('pageerror: ' + e.message));
  page.on('dialog', d => d.dismiss());
  return { context, page, S, riktiga, konsol };
}

const länk = (id, typ) => '#access_token=' + jwt(id, 'authenticated')
  + '&expires_in=3600&refresh_token=prov-' + id + '&sb=&token_type=bearer&type=' + typ;
const synlig = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const text = (page, sel) => page.locator(sel).first().textContent().catch(() => '');
const godkännanden = S => S.logg.filter(r => r.väg === '/rest/v1/rpc/godkann_villkor');

async function bild(page, namn) {
  if (!BILDER) return;
  fs.mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: path.join(BILDER, namn + '.png'), fullPage: false });
}

/* ============ 1. Familjen vi tagit in: lösenordet, villkoren, introduktionen ============ */
async function provaFamiljenTagenIn(webb) {
  const { context, page, S, riktiga, konsol } = await öppna(webb, { inloggad: 'foralder-1', länk: true, villkor: 'nej',
    metadata: { role: 'parent', full_name: 'Anna Andersson', valkommen: 'losenord' } });
  await page.goto(BAS + '/foralder' + länk('foralder-1', 'invite'));
  await page.waitForSelector('.nx-fraga.open #nylos-t', { timeout: 8000 }).catch(() => {});
  prova('familj: lösenordet först, ingen villkorsruta än', (await synlig(page, '#nylos-t')) && !(await synlig(page, '#villkor-t'))
    && godkännanden(S).length === 0);
  await page.fill('#nylos-1', 'ett-langt-losen');
  await page.fill('#nylos-2', 'ett-langt-losen');
  await page.click('form[data-nylos] [type="submit"]');
  await page.waitForSelector('.nx-fraga.open #villkor-t', { timeout: 6000 }).catch(() => {});
  prova('familj: sedan villkoren, före introduktionen', (await text(page, '#villkor-t')) === 'Godkänn användarvillkoren'
    && !(await synlig(page, '.nx-intro.open')), await text(page, '#villkor-t'));
  prova('familj: texten nämner bokning, betalning och ångerrätten', /bokning, betalning och avbokning/.test(await text(page, '#villkor-d'))
    && /ångerrätten/.test(await text(page, '#villkor-d')), await text(page, '#villkor-d'));
  const länkar = await page.$$eval('.nx-fraga.open a', as => as.map(a => [a.getAttribute('href'), a.target, a.rel]));
  prova('familj: villkoren och policyn öppnas i en ny flik', JSON.stringify(länkar) === JSON.stringify(
    [['/anvandarvillkor', '_blank', 'noopener'], ['/integritetspolicy', '_blank', 'noopener']]), JSON.stringify(länkar));
  const länkstil = await page.$$eval('.nx-fraga.open .nx-villkor-lankar a', as => as.map(a => {
    const st = getComputedStyle(a);
    /* offsetHeight: rutan glider fram med en skala, och skärmens mått
       är mindre än layoutens tills den stannat. */
    return { understruken: /underline/.test(st.textDecorationLine), höjd: a.offsetHeight,
             färg: st.color !== getComputedStyle(a.parentElement).color };
  }));
  prova('familj: länkarna ser ut som länkar och är minst 44 px', länkstil.length === 2
    && länkstil.every(l => l.understruken && l.färg && l.höjd >= 44), JSON.stringify(länkstil));
  prova('familj: kryssrutan är inte ikryssad från början', !(await page.isChecked('#villkor-ja')));
  prova('familj: inget Inte nu, men Logga ut', (await page.locator('.nx-fraga.open [data-nylos-nej]').count()) === 0
    && (await synlig(page, '[data-villkor-ut]')));
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 5);
  prova('familj: varken Escape eller ett tryck utanför stänger', await synlig(page, '.nx-fraga.open #villkor-t'));
  await bild(page, 'villkor-familj');

  await page.click('form[data-villkor] [type="submit"]');
  prova('familj: utan kryss sparas inget', (await text(page, '#villkor-msg')) === 'Kryssa i rutan för att godkänna villkoren.'
    && godkännanden(S).length === 0, await text(page, '#villkor-msg'));
  /* Hela raden är tryckytan, och den är minst 44 px. */
  const rad = await page.evaluate(() => document.querySelector('.nx-fraga.open .nx-ja').getBoundingClientRect().height);
  prova('familj: kryssraden är minst 44 px', rad >= 44, rad);
  await page.click('.nx-fraga.open .nx-ja span');
  prova('familj: ett tryck på texten kryssar i', await page.isChecked('#villkor-ja'));
  await page.click('form[data-villkor] [type="submit"]');
  await page.waitForSelector('.nx-intro.open', { timeout: 6000 }).catch(() => {});
  const g = godkännanden(S);
  prova('familj: godkännandet skickas en gång, med den gällande versionen', g.length === 1 && g[0].kropp
    && g[0].kropp.p_version === VERSION && g[0].vem === 'foralder-1', JSON.stringify(g.map(r => r.kropp)));
  prova('familj: rutan stängs och introduktionen tar vid', !(await synlig(page, '#villkor-t')) && (await synlig(page, '.nx-intro.open')));
  prova('familj: vyn är inte framme bakom introduktionen', !(await synlig(page, '#view-locked')) && !(await synlig(page, '#view-app')));
  prova('familj: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('familj: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 2. Ett konto i bruk ============ */
async function provaKontoIBruk(webb) {
  /* Registrerad före 2026-10-07, utan godkännande: rutan, och Logga ut. */
  {
    const { context, page, S, konsol } = await öppna(webb, { inloggad: 'foralder-1', matchad: true, villkor: 'nej', metadata: {} });
    await page.goto(BAS + '/foralder');
    await page.waitForSelector('.nx-fraga.open #villkor-t', { timeout: 8000 }).catch(() => {});
    prova('i bruk utan godkännande: rutan kommer, utan lösenordsrutan', (await synlig(page, '#villkor-t')) && !(await synlig(page, '#nylos-t')));
    prova('i bruk utan godkännande: vyn väntar bakom rutan', !(await synlig(page, '#view-app')));
    const omladdad = page.waitForEvent('load', { timeout: 8000 }).then(() => true, () => false);
    await page.click('[data-villkor-ut]');
    prova('i bruk utan godkännande: Logga ut loggar ut, lokalt', (await omladdad) && S.logg.some(r => r.väg === '/auth/v1/logout'
      && /scope=local/.test(r.sök)) && godkännanden(S).length === 0);
    prova('i bruk utan godkännande: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
  /* Godkände en äldre version: rutan säger att villkoren ändrats. */
  {
    const { context, page, S, konsol } = await öppna(webb, { inloggad: 'foralder-1', matchad: true, villkor: 'äldre', metadata: {} });
    await page.goto(BAS + '/foralder');
    await page.waitForSelector('.nx-fraga.open #villkor-t', { timeout: 8000 }).catch(() => {});
    prova('nya villkor: rubriken säger att de ändrats', (await text(page, '#villkor-t')) === 'Användarvillkoren har ändrats',
      await text(page, '#villkor-t'));
    prova('nya villkor: och när', /senast 30 september/.test(await text(page, '#villkor-d')), await text(page, '#villkor-d'));
    await page.check('#villkor-ja');
    await page.click('form[data-villkor] [type="submit"]');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
    prova('nya villkor: godkänt leder in i vyn', (await synlig(page, '#view-app')) && !(await synlig(page, '#villkor-t'))
      && godkännanden(S).length === 1);
    prova('nya villkor: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
  /* Godkänt: ingen ruta, inget skickas. */
  {
    const { context, page, S, konsol } = await öppna(webb, { inloggad: 'foralder-1', matchad: true, villkor: 'ja', metadata: {} });
    await page.goto(BAS + '/foralder');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
    await vänta(400);
    prova('godkänt: ingen ruta, vyn öppnas', !(await synlig(page, '.nx-fraga.open')) && (await synlig(page, '#view-app')));
    prova('godkänt: läget frågas, inget godkännande skickas', S.logg.some(r => r.väg === '/rest/v1/rpc/mitt_villkorslage')
      && godkännanden(S).length === 0);
    prova('godkänt: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
  /* En databas före migrationen: ingen ruta, vyn går att använda. */
  {
    const { context, page, konsol } = await öppna(webb, { inloggad: 'foralder-1', matchad: true, villkor: 'saknas', metadata: {} });
    await page.goto(BAS + '/foralder');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
    await vänta(400);
    prova('utan migrationen: ingen ruta, vyn öppnas', !(await synlig(page, '.nx-fraga.open')) && (await synlig(page, '#view-app')));
    prova('utan migrationen: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
}

/* ============ 3. Studiehjälparen vi tagit in ============ */
async function provaStudiehjälparen(webb) {
  const { context, page, S, konsol } = await öppna(webb, { inloggad: 'handledare-1', länk: true, villkor: 'nej',
    metadata: { role: 'tutor', valkommen: 'losenord' } });
  await page.goto(BAS + '/larare' + länk('handledare-1', 'invite'));
  await page.waitForSelector('.nx-fraga.open #nylos-t', { timeout: 8000 }).catch(() => {});
  await page.fill('#nylos-1', 'sara-forsta-losen');
  await page.fill('#nylos-2', 'sara-forsta-losen');
  await page.click('form[data-nylos] [type="submit"]');
  await page.waitForSelector('.nx-fraga.open #villkor-t', { timeout: 6000 }).catch(() => {});
  prova('studiehjälpare: villkoren efter lösenordet', (await text(page, '#villkor-t')) === 'Godkänn användarvillkoren');
  prova('studiehjälpare: texten är till studiehjälparen', /studiehjälpare/.test(await text(page, '#villkor-d')),
    await text(page, '#villkor-d'));
  await bild(page, 'villkor-studiehjalpare');
  await page.check('#villkor-ja');
  await page.click('form[data-villkor] [type="submit"]');
  await page.waitForSelector('.nx-intro.open', { timeout: 6000 }).catch(() => {});
  prova('studiehjälpare: godkänt, sedan introduktionen', (await synlig(page, '.nx-intro.open')) && godkännanden(S).length === 1
    && godkännanden(S)[0].vem === 'handledare-1');
  prova('studiehjälpare: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 4. Skapa konto ============ */
async function provaSkapaKonto(webb) {
  for (const [vy, roll] of [['/foralder', 'parent'], ['/larare', 'tutor']]) {
    const { context, page, S, konsol } = await öppna(webb, { inloggad: null });
    await page.goto(BAS + vy);
    await page.waitForSelector('#view-auth:not([hidden])', { timeout: 8000 }).catch(() => {});
    prova(vy + ': kryssrutan syns inte i Logga in', !(await synlig(page, '#villkor-grupp')));
    await page.click('[data-auth="up"]');
    prova(vy + ': kryssrutan syns i Skapa konto, inte ikryssad', (await synlig(page, '#villkor-grupp'))
      && !(await page.isChecked('#a-villkor')));
    const länkar = await page.$$eval('#villkor-grupp a', as => as.map(a => [a.getAttribute('href'), a.target]));
    prova(vy + ': länkarna går till villkoren och policyn, i en ny flik', JSON.stringify(länkar) === JSON.stringify(
      [['/anvandarvillkor', '_blank'], ['/integritetspolicy', '_blank']]), JSON.stringify(länkar));
    await page.fill('#a-name', 'Kim Karlsson');
    await page.fill('#a-email', 'kim@example.se');
    await page.fill('#a-pass', 'ett-langt-losen');
    await page.click('#auth-submit');
    await vänta(300);
    prova(vy + ': utan kryss skapas inget konto', (await text(page, '#auth-msg')) === 'Kryssa i att du godkänner användarvillkoren.'
      && !S.logg.some(r => r.väg === '/auth/v1/signup'), await text(page, '#auth-msg'));
    await bild(page, 'villkor-skapa-konto' + vy.replace('/', '-'));
    await page.check('#a-villkor');
    await page.click('#auth-submit');
    await page.waitForFunction(() => /Kontot är skapat/.test(document.querySelector('#auth-msg').textContent), null,
      { timeout: 6000 }).catch(() => {});
    const reg = S.logg.find(r => r.väg === '/auth/v1/signup');
    prova(vy + ': kontot skapas med villkor: true och rätt roll', reg && reg.kropp && reg.kropp.data
      && reg.kropp.data.villkor === true && reg.kropp.data.role === roll, JSON.stringify(reg && reg.kropp && reg.kropp.data));
    await page.click('[data-auth="in"]');
    prova(vy + ': tillbaka i Logga in är kryssrutan borta igen', !(await synlig(page, '#villkor-grupp')));
    prova(vy + ': inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
}

/* ============ 5. Telefonen ============ */
async function provaTelefonen(webb) {
  for (const [namn, mörkt] of [['telefon', false], ['telefon mörkt', true]]) {
    const { context, page, konsol } = await öppna(webb, { inloggad: 'foralder-1', matchad: true, villkor: 'nej', metadata: {},
      context: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
                 colorScheme: mörkt ? 'dark' : 'light' } });
    await page.goto(BAS + '/foralder');
    await page.waitForSelector('.nx-fraga.open #villkor-t', { timeout: 8000 }).catch(() => {});
    await vänta(650);
    const mått = await page.evaluate(() => {
      const box = document.querySelector('.nx-fraga.open .nx-fraga-box').getBoundingClientRect();
      const kn = [...document.querySelectorAll('.nx-fraga.open .btn')].map(b => b.getBoundingClientRect().height);
      const rad = document.querySelector('.nx-fraga.open .nx-ja').getBoundingClientRect().height;
      return { vänster: box.left, höger: box.right, bredd: innerWidth, kn, rad,
               rullar: document.documentElement.scrollWidth > innerWidth };
    });
    prova(namn + ': rutan ryms i bredden', mått.vänster >= 0 && mått.höger <= mått.bredd && !mått.rullar, JSON.stringify(mått));
    prova(namn + ': knapparna och kryssraden är minst 44 px', mått.kn.every(h => h >= 44) && mått.rad >= 44, JSON.stringify(mått));
    await bild(page, 'villkor-' + namn.replace(/ /g, '-'));
    prova(namn + ': inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
}

(async function () {
  const server = spawn('python3', [path.join(ROT, '.claude', 'serve.py'), String(PORT)], { stdio: 'ignore' });
  let klar = false;
  for (let i = 0; i < 50 && !klar; i++) {
    try { klar = (await fetch(BAS + '/foralder')).ok; } catch (e) { await vänta(100); }
  }
  const webb = await pw.chromium.launch();
  try {
    await provaFamiljenTagenIn(webb);
    await provaKontoIBruk(webb);
    await provaStudiehjälparen(webb);
    await provaSkapaKonto(webb);
    await provaTelefonen(webb);
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
