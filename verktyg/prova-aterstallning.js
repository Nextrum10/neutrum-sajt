/* ============================================================
   NEXTRUM — webbläsarprov för Glömt lösenordet (2026-09-30)

       NODE_PATH="$(npm root -g)" node verktyg/prova-aterstallning.js [mapp för bilder]

   Kräver Playwright och Chromium (finns i molnsessionerna, installeras
   annars globalt). Körs inte i CI: ingen pakethanterare i repot.

   ALDRIG MOT DRIFTEN. Sidorna serveras av .claude/serve.py, och
   nextrum-config.js byts i farten mot en som pekar på
   https://supabase.test, en adress som inte finns. Varje anrop dit
   besvaras här, av en falsk Supabase som svarar som Auth gör på
   /recover och /user; ett anrop till den riktiga adressen stoppas och
   fäller provet.

   Länken i mejlet provas som Auth skickar den: vyns adress med
   #access_token=…&type=recovery, eller med #error_code=… när länken
   gått ut. Att Auth tillåter adresserna som redirect provades mot
   driften 2026-09-30 (minne/sakerhet.md), inte här.
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
const PORT = 8962;
const BAS = 'http://localhost:' + PORT;
const FALSK = 'https://supabase.test';
const RIKTIG = /ddkfiuvcppalutfulvbi\.supabase\.co/;
const BILDER = process.argv[2] || null;

/* ============ utfallet ============ */
const utfall = [];
function prova(namn, ok, detalj) {
  utfall.push({ namn, ok: !!ok, detalj: ok ? '' : String(detalj == null ? '' : detalj) });
}

/* ============ den falska Supabase ============ */
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

const ANVANDARE = Object.fromEntries([
  ['foralder-1', 'anna@example.se'],
  ['handledare-1', 'sara@example.se'],
  ['adminkonto-1', 'nina@example.se']
].map(([id, epost]) => [id, { id, aud: 'authenticated', role: 'authenticated', email: epost,
  app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-09-01T10:00:00Z' }]));

const PROFILER = [
  { id: 'foralder-1', role: 'parent', full_name: 'Anna Andersson', email: 'anna@example.se', is_admin: false,
    match_status: 'pending', matched_tutor_id: null },
  { id: 'handledare-1', role: 'tutor', full_name: 'Sara Svensson', email: 'sara@example.se', is_admin: false },
  /* Ett konto som bara är admin (admin-skapa): studievyn skickar det till /admin. */
  { id: 'adminkonto-1', role: 'admin', full_name: 'Nina Admin', email: 'nina@example.se', is_admin: false }
];

/* En inbjuden studiehjälpare har en profil i väntläge (handle_new_user). */
const TUTORPROFILER = [{ id: 'handledare-1', status: 'pending', school: null, city: null, subjects: [],
  grade_levels: [], formats: [], bio: null, age: null, hourly_rate: null }];

function falskSupabase(o) {
  const logg = [];
  const svar = (route, status, kropp, extra) => route.fulfill({
    status,
    headers: Object.assign({
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': '*',
      'access-control-expose-headers': 'content-range, x-total-count'
    }, extra || {}),
    body: kropp === undefined ? '' : JSON.stringify(kropp)
  });

  async function hantera(route) {
    const req = route.request();
    const url = new URL(req.url());
    const metod = req.method();
    if (metod === 'OPTIONS') return svar(route, 204);
    let kropp = null;
    try { kropp = req.postDataJSON(); } catch (e) { kropp = req.postData(); }
    const vem = subUr(req.headers()['authorization']);
    logg.push({ metod, väg: url.pathname, sök: url.searchParams, kropp, vem });

    const p = url.pathname;
    if (p === '/auth/v1/recover') {
      /* Auth svarar likadant för en adress som inte finns, och 429 när
         samma adress bett om en länk för mindre än en minut sedan. */
      const r = o.recover || 'ok';
      if (o.fördröj) await vänta(o.fördröj);
      if (r === 'nat') return route.abort('failed');
      if (r === 'nyss') return svar(route, 429, { code: 'over_email_send_rate_limit',
        message: 'For security purposes, you can only request this after 42 seconds.' });
      if (r === 'tak') return svar(route, 429, { code: 'over_email_send_rate_limit', message: 'Email rate limit exceeded' });
      if (r === 'fel') return svar(route, 500, { code: 'unexpected_failure', message: 'Error sending recovery email' });
      return svar(route, 200, {});
    }
    if (p === '/auth/v1/user') {
      const anv = ANVANDARE[vem];
      if (!anv) return svar(route, 401, { code: 'bad_jwt', message: 'invalid JWT' });
      if (metod === 'PUT' && o.byte === 'samma') {
        return svar(route, 422, { code: 'same_password', message: 'New password should be different from the old password.' });
      }
      return svar(route, 200, anv);
    }
    if (p === '/auth/v1/verify' && metod === 'GET') {
      /* Länken i mejlet: Auth förbrukar token och skickar vidare till
         redirect_to med inloggningen i fragmentet, eller med felet när
         token inte finns. tok-<id> är en token för kontot <id>. */
      const token = url.searchParams.get('token') || '';
      const id = token.startsWith('tok-') ? token.slice(4) : null;
      const hash = id && ANVANDARE[id] && !o.förbrukad
        ? '#access_token=' + jwt(id, 'authenticated') + '&expires_in=3600&refresh_token=prov-' + id
          + '&token_type=bearer&type=' + (url.searchParams.get('type') || '')
        : UTGÅNGEN;
      return route.fulfill({ status: 303, headers: { location: (url.searchParams.get('redirect_to') || BAS + '/') + hash } });
    }
    if (p === '/auth/v1/logout') return svar(route, 204);
    if (p.startsWith('/auth/v1/')) return svar(route, 200, {});

    if (p === '/rest/v1/rpc/mina_behorigheter') return svar(route, 200, { admin: false, superadmin: false, behorigheter: [] });
    if (p.startsWith('/rest/v1/rpc/')) return svar(route, 404, { code: 'PGRST202', message: 'Ingen sådan funktion i provet.' });
    if (p.startsWith('/rest/v1/')) {
      if (metod !== 'GET' && metod !== 'HEAD') return svar(route, 201, []);
      let rader = p === '/rest/v1/profiles' ? PROFILER : p === '/rest/v1/tutor_profiles' ? TUTORPROFILER : [];
      const id = url.searchParams.get('id');
      if (id && id.startsWith('eq.')) rader = rader.filter(r => r.id === id.slice(3));
      return svar(route, 200, rader, { 'content-range': rader.length ? '0-' + (rader.length - 1) + '/' + rader.length : '*/0' });
    }
    return svar(route, 404, {});
  }
  return { logg, hantera };
}

/* ============ en sida med den falska Supabase ============ */
async function öppna(webb, o) {
  o = o || {};
  const context = await webb.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, o.context || {}));
  const S = falskSupabase(o);
  const riktiga = [];
  const konsol = [];

  await context.route(RIKTIG, route => { riktiga.push(route.request().url()); return route.abort(); });
  await context.route(/nextrum-config\.js/, async route => {
    const text = fs.readFileSync(path.join(ROT, 'nextrum-config.js'), 'utf8')
      .replace(/SUPABASE_URL:\s*'[^']*'/, "SUPABASE_URL: '" + FALSK + "'");
    return route.fulfill({ status: 200, contentType: 'application/javascript', body: text });
  });
  if (o.studie) await context.route(/nextrum-studie\.js/, route => route.fulfill({ status: 200, contentType: 'application/javascript', body: o.studie }));
  await context.route(/^https:\/\/supabase\.test\//, S.hantera);
  await context.routeWebSocket(/supabase\.test/, () => { /* Realtime svarar aldrig; det gör ingenting här */ });
  /* Allt annat utanför localhost stoppas: provet ska inte nå nätet. */
  await context.route(url => !String(url).startsWith(BAS) && !/supabase\.test/.test(String(url)),
    route => route.abort());

  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') konsol.push(m.text()); });
  page.on('pageerror', e => konsol.push('pageerror: ' + e.message));
  page.on('dialog', d => d.dismiss());
  return { context, page, S, riktiga, konsol };
}

async function bild(page, namn) {
  if (!BILDER) return;
  fs.mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: path.join(BILDER, namn + '.png'), fullPage: false });
}

const synlig = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const text = (page, sel) => page.locator(sel).first().textContent().catch(() => '');
const fokus = page => page.evaluate(() => (document.activeElement && document.activeElement.id) || '');
const vänta = ms => new Promise(r => setTimeout(r, ms));
const väntaText = (page, sel, mönster) => page.waitForFunction(([s, m]) => {
  const el = document.querySelector(s);
  return !!el && new RegExp(m).test(el.textContent);
}, [sel, mönster], { timeout: 6000 }).catch(() => {});

/* Länken i mejlet som Auth skickar tillbaka den (implicit flow). */
const länk = (id, typ) => '#access_token=' + jwt(id, 'authenticated')
  + '&expires_in=3600&refresh_token=prov-' + id + '&sb=&token_type=bearer&type=' + (typ || 'recovery');
const UTGÅNGEN = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=';

const VYER = [
  { väg: '/foralder', titel: 'Studievyn', flikar: true },
  { väg: '/larare', titel: 'Studiehjälparvyn', flikar: true },
  { väg: '/admin', titel: 'Adminvyn', flikar: false }
];

/* ============ 1. Glömt lösenordet? vid inloggningen ============ */
async function provaInloggningen(webb) {
  for (const vy of VYER) {
    const v = vy.väg.slice(1);
    const { context, page, S, riktiga, konsol } = await öppna(webb, {});
    await page.goto(BAS + vy.väg);
    await page.waitForSelector('#view-auth:not([hidden])', { timeout: 8000 }).catch(() => {});

    prova(v + ': Glömt lösenordet? syns vid inloggningen', await synlig(page, '[data-glomt] button'));
    prova(v + ': Tillbaka syns inte vid inloggningen', !(await synlig(page, '[data-glomt-tillbaka] button')));
    const höjd = await page.locator('[data-glomt] button').evaluate(b => b.getBoundingClientRect().height);
    prova(v + ': länken är minst 44 px hög', höjd >= 44, höjd);
    await bild(page, v + '-inloggning');

    await page.click('[data-glomt] button');
    prova(v + ': rubriken blir Glömt lösenordet?', (await text(page, '#auth-title')) === 'Glömt lösenordet?', await text(page, '#auth-title'));
    prova(v + ': lösenordsfältet döljs', !(await synlig(page, '#a-pass')));
    prova(v + ': flikarna döljs', !(await synlig(page, '.auth-tabs')));
    prova(v + ': knappen heter Skicka länken', (await text(page, '#auth-submit')) === 'Skicka länken', await text(page, '#auth-submit'));
    prova(v + ': fokus flyttas till e-posten', (await fokus(page)) === 'a-email', await fokus(page));
    prova(v + ': Tillbaka syns', await synlig(page, '[data-glomt-tillbaka] button'));

    await page.click('#auth-submit');
    prova(v + ': tom adress stoppas', (await text(page, '#auth-msg')).startsWith('Skriv e-postadressen'), await text(page, '#auth-msg'));
    await page.fill('#a-email', 'anna@example');
    await page.click('#auth-submit');
    prova(v + ': en adress utan domän stoppas', (await text(page, '#auth-msg')).startsWith('Kontrollera e-postadressen'), await text(page, '#auth-msg'));
    await page.fill('#a-email', 'alva.a@barn.nextrum.se');
    await page.press('#a-email', 'Enter');
    prova(v + ': en barnadress får beskedet om föräldern', (await text(page, '#auth-msg')).startsWith('Ett barns lösenord'), await text(page, '#auth-msg'));
    prova(v + ': en barnadress skickar ingenting', !S.logg.some(r => r.väg === '/auth/v1/recover'));

    await page.fill('#a-email', '  anna@example.se ');
    await page.click('#auth-submit');
    await väntaText(page, '#auth-msg', '^Om adressen');
    const begäran = S.logg.filter(r => r.väg === '/auth/v1/recover');
    prova(v + ': en begäran till Auth', begäran.length === 1, begäran.length);
    const r = begäran[0] || { sök: new URLSearchParams(), kropp: {} };
    prova(v + ': adressen utan mellanslag', r.kropp && r.kropp.email === 'anna@example.se', JSON.stringify(r.kropp));
    prova(v + ': länken leder tillbaka till ' + vy.väg, r.sök.get('redirect_to') === BAS + vy.väg, r.sök.get('redirect_to'));
    prova(v + ': beskedet säger inte om kontot finns', (await text(page, '#auth-msg')).startsWith('Om adressen hör till ett konto hos oss'),
      await text(page, '#auth-msg'));
    prova(v + ': knappen släpps', (await text(page, '#auth-submit')) === 'Skicka länken'
      && !(await page.locator('#auth-submit').isDisabled()));
    await bild(page, v + '-glomt-skickat');

    await page.click('[data-glomt-tillbaka] button');
    prova(v + ': tillbaka: lösenordsfältet syns', await synlig(page, '#a-pass'));
    prova(v + ': tillbaka: rubriken är vyns', (await text(page, '#auth-title')) === vy.titel, await text(page, '#auth-title'));
    prova(v + ': tillbaka: knappen heter Logga in', (await text(page, '#auth-submit')) === 'Logga in');
    prova(v + ': tillbaka: beskedet är borta', !(await synlig(page, '#auth-msg')));
    prova(v + ': tillbaka: fokus på lösenordet', (await fokus(page)) === 'a-pass', await fokus(page));
    prova(v + ': tillbaka: lösenordet krävs igen', await page.locator('#a-pass').evaluate(i => i.required));
    if (vy.flikar) {
      prova(v + ': tillbaka: flikarna syns', await synlig(page, '.auth-tabs'));
      await page.click('[data-auth="up"]');
      prova(v + ': ingen Glömt lösenordet? när kontot skapas', !(await synlig(page, '[data-glomt] button')));
    }
    prova(v + ': inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    prova(v + ': inget anrop till den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
    await context.close();
  }

  /* Svaren från Auth: bara ett mejl som faktiskt gått får beskedet att det gått. */
  for (const [läge, början, fel] of [
    ['nyss', 'Om adressen hör till ett konto', false],
    ['tak', 'Vi kan inte skicka fler mejl just nu', true],
    ['fel', 'Mejlet gick inte att skicka', true],
    ['nat', 'Vi nådde inte servern', true]
  ]) {
    const { context, page } = await öppna(webb, { recover: läge });
    await page.goto(BAS + '/foralder');
    await page.waitForSelector('#view-auth:not([hidden])', { timeout: 8000 }).catch(() => {});
    await page.click('[data-glomt] button');
    await page.fill('#a-email', 'anna@example.se');
    await page.click('#auth-submit');
    await väntaText(page, '#auth-msg', '.');
    const besked = await text(page, '#auth-msg');
    prova('svaret ' + läge + ': ' + början, besked.startsWith(början), besked);
    prova('svaret ' + läge + ': ' + (fel ? 'som fel' : 'som ett vanligt besked'),
      (await page.locator('#auth-msg').evaluate(p => p.classList.contains('is-err'))) === fel);
    prova('svaret ' + läge + ': ingen engelsk servertext', !/rate limit|security purposes|Error sending|Failed to fetch/i.test(besked), besked);
    await context.close();
  }

  /* Tillbaka medan länken skickas: rutan byter inte läge under svaret. */
  {
    const { context, page, S } = await öppna(webb, { fördröj: 900 });
    await page.goto(BAS + '/larare');
    await page.waitForSelector('#view-auth:not([hidden])', { timeout: 8000 }).catch(() => {});
    await page.click('[data-glomt] button');
    await page.fill('#a-email', 'sara@example.se');
    await page.click('#auth-submit');
    await page.waitForSelector('#auth-submit[aria-busy]', { timeout: 3000 }).catch(() => {});
    prova('under utskicket: knappen säger Skickar…', (await text(page, '#auth-submit')) === 'Skickar…', await text(page, '#auth-submit'));
    await page.click('[data-glomt-tillbaka] button');
    prova('under utskicket: Tillbaka byter inte läge', (await text(page, '#auth-title')) === 'Glömt lösenordet?', await text(page, '#auth-title'));
    await väntaText(page, '#auth-msg', '^Om adressen');
    prova('efter utskicket: beskedet står i rätt läge', (await text(page, '#auth-msg')).startsWith('Om adressen')
      && (await text(page, '#auth-title')) === 'Glömt lösenordet?');
    prova('efter utskicket: knappen heter Skicka länken', (await text(page, '#auth-submit')) === 'Skicka länken', await text(page, '#auth-submit'));
    prova('efter utskicket: en begäran', S.logg.filter(r => r.väg === '/auth/v1/recover').length === 1);
    await page.click('[data-glomt-tillbaka] button');
    prova('efter utskicket: Tillbaka fungerar igen', (await text(page, '#auth-submit')) === 'Logga in', await text(page, '#auth-submit'));
    await context.close();
  }
}

/* ============ 2. Länken i mejlet ============ */
async function provaLänken(webb) {
  /* Studievyn: rutan före dirigeringen, och vyn fortsätter efteråt. */
  {
    const { context, page, S, konsol } = await öppna(webb, {});
    await page.goto(BAS + '/foralder' + länk('foralder-1'));
    await page.waitForSelector('.nx-fraga.open #nylos-t', { timeout: 8000 }).catch(() => {});
    prova('förälder: rutan för nytt lösenord', (await text(page, '#nylos-t')) === 'Välj ett nytt lösenord', await text(page, '#nylos-t'));
    prova('förälder: vyn bakom väntar på rutan', await synlig(page, '#view-loading'));
    prova('förälder: token är borta ur adressen', !/access_token/.test(page.url()), page.url());
    prova('förälder: fokus i första fältet', (await fokus(page)) === 'nylos-1', await fokus(page));
    prova('förälder: lösenordshanteraren får adressen',
      (await page.locator('form[data-nylos] input[autocomplete="username"]').getAttribute('value')) === 'anna@example.se');
    await bild(page, 'foralder-nytt-losenord');

    await page.fill('#nylos-1', 'kort');
    await page.fill('#nylos-2', 'kort');
    await page.click('form[data-nylos] [type="submit"]');
    prova('förälder: för kort stoppas', (await text(page, '#nylos-msg')) === 'Lösenordet måste ha minst 6 tecken.', await text(page, '#nylos-msg'));
    await page.fill('#nylos-1', 'ett-nytt-losen');
    await page.fill('#nylos-2', 'ett-annat-losen');
    await page.press('#nylos-2', 'Enter');
    prova('förälder: olika lösenord stoppas', (await text(page, '#nylos-msg')) === 'Lösenorden är inte lika.', await text(page, '#nylos-msg'));
    prova('förälder: inget sparat än', !S.logg.some(r => r.väg === '/auth/v1/user' && r.metod === 'PUT'));
    /* Ett tryck utanför rutan stänger den inte. */
    await page.mouse.click(5, 5);
    prova('förälder: ett tryck utanför stänger inte', await synlig(page, '.nx-fraga.open #nylos-t'));

    await page.fill('#nylos-2', 'ett-nytt-losen');
    await page.click('form[data-nylos] [type="submit"]');
    await page.waitForSelector('[data-nylos-klar]', { timeout: 6000 }).catch(() => {});
    const byte = S.logg.filter(r => r.väg === '/auth/v1/user' && r.metod === 'PUT');
    prova('förälder: lösenordet sparas en gång, med länkens inloggning',
      byte.length === 1 && byte[0].kropp && byte[0].kropp.password === 'ett-nytt-losen' && byte[0].vem === 'foralder-1',
      JSON.stringify(byte.map(b => [b.vem, b.kropp])));
    prova('förälder: rutan säger att det är klart', (await text(page, '#nylos-t')) === 'Lösenordet är bytt', await text(page, '#nylos-t'));
    prova('förälder: fokus på Fortsätt', await page.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-nylos-klar')));
    await bild(page, 'foralder-losenord-bytt');
    await page.click('[data-nylos-klar]');
    await page.waitForSelector('#view-locked:not([hidden])', { timeout: 8000 }).catch(() => {});
    prova('förälder: vyn fortsätter efter rutan', await synlig(page, '#view-locked'));
    prova('förälder: rutan är borta', (await page.locator('#nylos-t').count()) === 0);
    prova('förälder: sidan rullar igen', await page.evaluate(() => document.body.style.overflow === ''));
    prova('förälder: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }

  /* Ett konto som bara är admin och kom till studievyn: rutan först, sedan /admin. */
  {
    const { context, page, S } = await öppna(webb, {});
    await page.goto(BAS + '/foralder' + länk('adminkonto-1'));
    await page.waitForSelector('.nx-fraga.open #nylos-t', { timeout: 8000 }).catch(() => {});
    await vänta(400);
    prova('adminkonto i studievyn: rutan står kvar i studievyn', new URL(page.url()).pathname === '/foralder', page.url());
    await page.fill('#nylos-1', 'ett-langt-losen');
    await page.fill('#nylos-2', 'ett-langt-losen');
    await page.click('form[data-nylos] [type="submit"]');
    await page.waitForSelector('[data-nylos-klar]', { timeout: 6000 }).catch(() => {});
    prova('adminkonto i studievyn: sparat', S.logg.some(r => r.väg === '/auth/v1/user' && r.metod === 'PUT' && r.vem === 'adminkonto-1'));
    await page.click('[data-nylos-klar]');
    await page.waitForURL(BAS + '/admin', { timeout: 8000 }).catch(() => {});
    prova('adminkonto i studievyn: sedan till adminvyn', new URL(page.url()).pathname === '/admin', page.url());
    await context.close();
  }

  /* Studiehjälparvyn: Inte nu stänger utan att spara, och samma lösenord får ett svenskt svar. */
  {
    const { context, page, S, konsol } = await öppna(webb, { byte: 'samma' });
    await page.goto(BAS + '/larare' + länk('handledare-1'));
    await page.waitForSelector('.nx-fraga.open #nylos-t', { timeout: 8000 }).catch(() => {});
    prova('studiehjälpare: rutan för nytt lösenord', (await text(page, '#nylos-t')) === 'Välj ett nytt lösenord');
    await page.fill('#nylos-1', 'samma-som-forr');
    await page.fill('#nylos-2', 'samma-som-forr');
    await page.click('form[data-nylos] [type="submit"]');
    await väntaText(page, '#nylos-msg', '.');
    prova('studiehjälpare: samma lösenord som förut får ett svenskt svar',
      (await text(page, '#nylos-msg')) === 'Det nya lösenordet måste vara ett annat än det gamla.', await text(page, '#nylos-msg'));
    prova('studiehjälpare: rutan står kvar efter felet', await synlig(page, '.nx-fraga.open #nylos-t'));
    await page.click('[data-nylos-nej]');
    await page.waitForSelector('#view-pending:not([hidden])', { timeout: 8000 }).catch(() => {});
    prova('studiehjälpare: Inte nu stänger och vyn fortsätter', await synlig(page, '#view-pending'));
    prova('studiehjälpare: bara försöket sparades', S.logg.filter(r => r.metod === 'PUT').length === 1);
    /* 422:an är provets eget svar; webbläsaren skriver varje sådant i konsolen. */
    const övriga = konsol.filter(k => !/status of 422/.test(k));
    prova('studiehjälpare: inga andra fel i konsolen', övriga.length === 0, övriga.join(' | '));
    await context.close();
  }

  /* Adminvyn: minst 8 tecken, och rutan kommer före behörigheten. */
  {
    const { context, page, S, konsol } = await öppna(webb, {});
    await page.goto(BAS + '/admin' + länk('adminkonto-1'));
    await page.waitForSelector('.nx-fraga.open #nylos-t', { timeout: 8000 }).catch(() => {});
    prova('admin: rutan för nytt lösenord', (await text(page, '#nylos-t')) === 'Välj ett nytt lösenord');
    prova('admin: rutan säger minst 8 tecken', (await text(page, '#nylos-t + p')).includes('minst 8 tecken'));
    await page.fill('#nylos-1', 'sju-tkn');
    await page.fill('#nylos-2', 'sju-tkn');
    await page.click('form[data-nylos] [type="submit"]');
    prova('admin: sju tecken stoppas', (await text(page, '#nylos-msg')) === 'Lösenordet måste ha minst 8 tecken.', await text(page, '#nylos-msg'));
    await page.keyboard.press('Escape');
    await page.waitForSelector('#view-nekad:not([hidden])', { timeout: 8000 }).catch(() => {});
    prova('admin: Escape stänger och vyn fortsätter (nekad utan adminroll)', await synlig(page, '#view-nekad'));
    prova('admin: inget sparat', !S.logg.some(r => r.metod === 'PUT'));
    prova('admin: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }

  /* En länk som gått ut: rakt till Glömt lösenordet, med förklaringen. */
  for (const vy of VYER) {
    const v = vy.väg.slice(1);
    const { context, page, konsol } = await öppna(webb, {});
    await page.goto(BAS + vy.väg + UTGÅNGEN);
    await page.waitForSelector('#view-auth:not([hidden])', { timeout: 8000 }).catch(() => {});
    prova(v + ' utgången länk: rubriken är Glömt lösenordet?', (await text(page, '#auth-title')) === 'Glömt lösenordet?', await text(page, '#auth-title'));
    prova(v + ' utgången länk: förklaringen står överst', (await text(page, '#auth-sub')).startsWith('Länken i mejlet gick inte att använda'),
      await text(page, '#auth-sub'));
    prova(v + ' utgången länk: felet är borta ur adressen', !/error/.test(page.url()), page.url());
    prova(v + ' utgången länk: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    if (vy.väg === '/foralder') await bild(page, 'foralder-utgangen-lank');
    await context.close();
  }

  /* En länk vars token Auth inte godtar: ingen inloggning, Glömt lösenordet, och token ut ur adressen. */
  {
    const { context, page, konsol } = await öppna(webb, {});
    await page.goto(BAS + '/foralder' + länk('okand-1'));
    await page.waitForSelector('#view-auth:not([hidden])', { timeout: 8000 }).catch(() => {});
    prova('token som inte godtas: Glömt lösenordet med förklaringen',
      (await text(page, '#auth-title')) === 'Glömt lösenordet?'
      && (await text(page, '#auth-sub')).startsWith('Länken i mejlet gick inte att använda'), await text(page, '#auth-sub'));
    prova('token som inte godtas: ingen ruta för nytt lösenord', (await page.locator('#nylos-t').count()) === 0);
    prova('token som inte godtas: token är borta ur adressen', !/access_token/.test(page.url()), page.url());
    const övriga = konsol.filter(k => !/status of 401/.test(k));
    prova('token som inte godtas: inga andra fel i konsolen', övriga.length === 0, övriga.join(' | '));
    await context.close();
  }

  /* En inbjudan från bjud-in (2026-10-01): studievyn och studiehjälparvyn ber om ett lösenord.
     Sedan 2026-10-06 går rutan inte att hoppa över, och introduktionen följer
     (verktyg/prova-introduktion.js provar den i detalj). */
  for (const [väg, id, sedan, steg] of [['/foralder', 'foralder-1', '#view-locked', 7], ['/larare', 'handledare-1', '#view-pending', 8]]) {
    const v = väg.slice(1);
    const { context, page, S, konsol } = await öppna(webb, {});
    await page.goto(BAS + väg + länk(id, 'invite'));
    await page.waitForSelector('.nx-fraga.open #nylos-t', { timeout: 8000 }).catch(() => {});
    prova(v + ' inbjudan: rutan ber om ett lösenord', (await text(page, '#nylos-t')) === 'Skapa ditt lösenord', await text(page, '#nylos-t'));
    prova(v + ' inbjudan: rutan välkomnar', (await text(page, '#nylos-t + p')).startsWith('Välkommen till Nextrum!'), await text(page, '#nylos-t + p'));
    prova(v + ' inbjudan: nytt lösenord och bekräfta det',
      (await text(page, 'label[for="nylos-1"]')) === 'Nytt lösenord' && (await text(page, 'label[for="nylos-2"]')) === 'Bekräfta lösenordet');
    prova(v + ' inbjudan: inget Inte nu, men Logga ut',
      (await page.locator('[data-nylos-nej]').count()) === 0 && (await page.locator('[data-nylos-ut]').count()) === 1);
    await page.keyboard.press('Escape');
    prova(v + ' inbjudan: Escape stänger inte rutan', await synlig(page, '.nx-fraga.open #nylos-t'));
    if (väg === '/foralder') await bild(page, 'foralder-inbjudan');
    await page.fill('#nylos-1', 'mitt-forsta-losen');
    await page.fill('#nylos-2', 'mitt-forsta-losen');
    await page.click('form[data-nylos] [type="submit"]');
    await page.waitForSelector('.nx-intro.open', { timeout: 6000 }).catch(() => {});
    prova(v + ' inbjudan: lösenordet sparas med inbjudans inloggning, och välkomsten går till introduktionen',
      S.logg.some(r => r.väg === '/auth/v1/user' && r.metod === 'PUT' && r.vem === id && r.kropp
        && r.kropp.password === 'mitt-forsta-losen' && r.kropp.data && r.kropp.data.valkommen === 'intro'));
    prova(v + ' inbjudan: introduktionen tar vid', (await text(page, '.nx-intro-nr')) === '1 av ' + steg, await text(page, '.nx-intro-nr'));
    for (let i = 0; i < steg; i++) await page.click('[data-intro-fram]');
    await page.waitForSelector(sedan + ':not([hidden])', { timeout: 8000 }).catch(() => {});
    prova(v + ' inbjudan: vyn fortsätter efter Fortsätt', await synlig(page, sedan) && !(await synlig(page, '.nx-intro')));
    prova(v + ' inbjudan: välkomsten tas bort', S.logg.some(r => r.väg === '/auth/v1/user' && r.metod === 'PUT'
      && r.kropp && r.kropp.data && r.kropp.data.valkommen === null && !r.kropp.password));
    prova(v + ' inbjudan: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
  {
    const { context, page } = await öppna(webb, {});
    await page.goto(BAS + '/foralder' + länk('okand-1', 'invite'));
    await page.waitForSelector('#view-auth:not([hidden])', { timeout: 8000 }).catch(() => {});
    prova('inbjudan som inte godtas: Glömt lösenordet med förklaringen',
      (await text(page, '#auth-sub')).startsWith('Länken i mejlet gick inte att använda'), await text(page, '#auth-sub'));
    prova('inbjudan som inte godtas: token är borta ur adressen', !/access_token/.test(page.url()), page.url());
    await context.close();
  }
  {
    const { context, page } = await öppna(webb, {});
    const frånStartsidan = [];
    page.on('request', r => {
      if (/supabase\.test/.test(r.url()) && new URL(page.url()).pathname === '/') frånStartsidan.push(r.url());
    });
    await page.goto(BAS + '/' + länk('foralder-1', 'invite'));
    await page.waitForURL(u => new URL(u).pathname === '/foralder', { timeout: 8000 }).catch(() => {});
    await page.waitForSelector('.nx-fraga.open #nylos-t', { timeout: 8000 }).catch(() => {});
    prova('startsidan: en inbjudan går vidare till studievyn och ber om ett lösenord',
      new URL(page.url()).pathname === '/foralder' && (await text(page, '#nylos-t')) === 'Skapa ditt lösenord', page.url());
    prova('startsidan: inbjudan rörde inte inloggningen där', frånStartsidan.length === 0, frånStartsidan.join(', '));
    await context.close();
  }

  /* Startsidan (Site URL, som när länken skickas från Supabase-panelen): vidare till studievyn. */
  {
    const { context, page, S } = await öppna(webb, {});
    const frånStartsidan = [];
    page.on('request', r => {
      if (/supabase\.test/.test(r.url()) && new URL(page.url()).pathname === '/') frånStartsidan.push(r.url());
    });
    await page.goto(BAS + '/' + länk('foralder-1'));
    await page.waitForURL(u => new URL(u).pathname === '/foralder', { timeout: 8000 }).catch(() => {});
    await page.waitForSelector('.nx-fraga.open #nylos-t', { timeout: 8000 }).catch(() => {});
    prova('startsidan: länken går vidare till studievyn', new URL(page.url()).pathname === '/foralder', page.url());
    prova('startsidan: rutan för nytt lösenord där', (await text(page, '#nylos-t')) === 'Välj ett nytt lösenord');
    prova('startsidan: startsidan rörde inte inloggningen', frånStartsidan.length === 0, frånStartsidan.join(', '));
    prova('startsidan: en inloggning, i studievyn', S.logg.filter(r => r.väg === '/auth/v1/user' && r.metod === 'GET').length >= 1);
    await context.close();
  }
  {
    const { context, page } = await öppna(webb, {});
    await page.goto(BAS + '/' + UTGÅNGEN);
    await page.waitForURL(u => new URL(u).pathname === '/foralder', { timeout: 8000 }).catch(() => {});
    await page.waitForSelector('#view-auth:not([hidden])', { timeout: 8000 }).catch(() => {});
    prova('startsidan: en utgången länk går vidare till Glömt lösenordet',
      (await text(page, '#auth-title')) === 'Glömt lösenordet?' && new URL(page.url()).pathname === '/foralder', page.url());
    await context.close();
  }

  /* En gammal nextrum-studie.js ur cachen: modulvakten säger det, vyn hänger inte. */
  {
    const gammal = fs.readFileSync(path.join(ROT, 'nextrum-studie.js'), 'utf8').replace('glömtLänkar: glömtLänkar, ', '');
    const { context, page } = await öppna(webb, { studie: gammal });
    await page.goto(BAS + '/foralder');
    await page.waitForSelector('#view-fel:not([hidden])', { timeout: 8000 }).catch(() => {});
    prova('modulvakten: en fil utan glömtLänkar ger felrutan', await synlig(page, '#view-fel'));
    await context.close();
  }
}

/* ============ på en telefon ============ */
/* ============ 3. /lank, knappen före länken (2026-10-01) ============ */
/* Mallens länk som Supabase fyller den: html/template procentkodar allt
   efter # utom A–Z, a–z, 0–9 och -._~, med små hexsiffror. */
const goKoda = s => Array.from(Buffer.from(s, 'utf8')).map(b => {
  const c = String.fromCharCode(b);
  return /[A-Za-z0-9\-._~]/.test(c) ? c : '%' + b.toString(16).padStart(2, '0');
}).join('');
const verify = (token, typ, till) => FALSK + '/auth/v1/verify?token=' + token + '&type=' + typ
  + '&redirect_to=' + BAS + (till || '/foralder');

async function provaMellansidan(webb) {
  /* Återställningen, kodad som i mejlet: knappen, och sedan hela vägen till rutan. */
  {
    const { context, page, S, konsol, riktiga } = await öppna(webb, {});
    await page.goto(BAS + '/lank#' + goKoda(verify('tok-foralder-1', 'recovery')));
    await page.waitForSelector('#lank-knapp', { timeout: 8000 }).catch(() => {});
    prova('lank: rubriken efter typen', (await text(page, '#lank-titel')) === 'Välj ett nytt lösenord', await text(page, '#lank-titel'));
    prova('lank: knappen efter typen', (await text(page, '#lank-knapp')) === 'Välj nytt lösenord', await text(page, '#lank-knapp'));
    prova('lank: ingenting hämtas innan knappen trycks', S.logg.length === 0, JSON.stringify(S.logg.map(r => r.väg)));
    const länkar = await page.locator('a').evaluateAll(as => as.map(a => a.getAttribute('href') || ''));
    prova('lank: Auths länk står inte i någon href som ett filter kan följa', !länkar.some(h => /supabase|verify/.test(h)), länkar.join(' '));
    const höjd = await page.locator('#lank-knapp').evaluate(b => b.getBoundingClientRect().height);
    prova('lank: knappen är minst 44 px hög', höjd >= 44, höjd);
    await bild(page, 'lank-aterstallning');
    await page.click('#lank-knapp');
    await page.waitForURL(u => new URL(u).pathname === '/foralder', { timeout: 8000 }).catch(() => {});
    await page.waitForSelector('.nx-fraga.open #nylos-t', { timeout: 8000 }).catch(() => {});
    const v = S.logg.filter(r => r.väg === '/auth/v1/verify');
    prova('lank: knappen använder länken en gång', v.length === 1 && v[0].sök.get('token') === 'tok-foralder-1'
      && v[0].sök.get('type') === 'recovery', JSON.stringify(v.map(r => r.sök.toString())));
    prova('lank: vidare till studievyn och rutan för nytt lösenord', (await text(page, '#nylos-t')) === 'Välj ett nytt lösenord',
      page.url() + ' ' + (await text(page, '#nylos-t')));
    prova('lank: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    prova('lank: inget anrop till den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
    await context.close();
  }

  /* En okodad länk godtas också; inbjudan och bekräftelsen får sina texter. */
  {
    const { context, page } = await öppna(webb, {});
    await page.goto(BAS + '/lank#' + verify('tok-foralder-1', 'invite'));
    await page.waitForSelector('#lank-knapp', { timeout: 8000 }).catch(() => {});
    prova('lank okodad: inbjudan', (await text(page, '#lank-titel')) === 'Välkommen till Nextrum'
      && (await text(page, '#lank-knapp')) === 'Välj lösenord', await text(page, '#lank-titel'));
    await page.click('#lank-knapp');
    await page.waitForSelector('.nx-fraga.open #nylos-t', { timeout: 8000 }).catch(() => {});
    prova('lank okodad: vidare till rutan för inbjudan', (await text(page, '#nylos-t')) === 'Skapa ditt lösenord', await text(page, '#nylos-t'));
    await context.close();
  }
  {
    const { context, page } = await öppna(webb, {});
    await page.goto(BAS + '/lank#' + goKoda(verify('tok-handledare-1', 'signup', '/larare')));
    await page.waitForSelector('#lank-knapp', { timeout: 8000 }).catch(() => {});
    prova('lank: bekräftelsen av ett nytt konto', (await text(page, '#lank-titel')) === 'Bekräfta din e-postadress'
      && (await text(page, '#lank-knapp')) === 'Bekräfta e-postadressen', await text(page, '#lank-titel'));
    await page.click('#lank-knapp');
    await page.waitForURL(u => new URL(u).pathname === '/larare', { timeout: 8000 }).catch(() => {});
    await page.waitForSelector('#view-pending:not([hidden])', { timeout: 8000 }).catch(() => {});
    prova('lank: bekräftelsen loggar in i studiehjälparvyn utan ruta', await synlig(page, '#view-pending')
      && (await page.locator('#nylos-t').count()) === 0, page.url());
    await context.close();
  }

  /* En förbrukad länk: knappen leder vidare, och vyn säger att den inte gick att använda. */
  {
    const { context, page } = await öppna(webb, { förbrukad: true });
    await page.goto(BAS + '/lank#' + goKoda(verify('tok-foralder-1', 'recovery')));
    await page.waitForSelector('#lank-knapp', { timeout: 8000 }).catch(() => {});
    await page.click('#lank-knapp');
    await page.waitForURL(u => new URL(u).pathname === '/foralder', { timeout: 8000 }).catch(() => {});
    await page.waitForSelector('#view-auth:not([hidden])', { timeout: 8000 }).catch(() => {});
    prova('lank förbrukad: Glömt lösenordet med förklaringen', (await text(page, '#auth-sub')).startsWith('Länken i mejlet gick inte att använda'),
      await text(page, '#auth-sub'));
    await context.close();
  }

  /* Allt som inte är en länk till verify hos vårt Supabase, med token: ingen knapp. */
  for (const [namn, hash] of [
    ['en annan webbplats', '#' + goKoda('https://elak.example/auth/v1/verify?token=tok-foralder-1&type=recovery')],
    ['vårt Supabase men inte verify', '#' + goKoda(FALSK + '/auth/v1/logout?token=tok-foralder-1')],
    ['ingen token', '#' + goKoda(FALSK + '/auth/v1/verify?type=recovery')],
    ['javascript:', '#javascript:alert(1)'],
    ['ingen länk alls', '']
  ]) {
    const { context, page, S, konsol } = await öppna(webb, {});
    await page.goto(BAS + '/lank' + hash);
    await page.waitForSelector('#lank-titel', { timeout: 8000 }).catch(() => {});
    await vänta(150);
    prova('lank ' + namn + ': Länken är inte hel', (await text(page, '#lank-titel')) === 'Länken är inte hel', await text(page, '#lank-titel'));
    prova('lank ' + namn + ': ingen knapp', (await page.locator('#lank-knapp').count()) === 0);
    prova('lank ' + namn + ': väg till inloggningen', (await page.locator('#lank-varfor a[href="/foralder"]').count()) === 1);
    prova('lank ' + namn + ': inga anrop och inga fel', S.logg.length === 0 && konsol.length === 0, konsol.join(' | '));
    await context.close();
  }

  /* Telefonen. */
  {
    const { context, page } = await öppna(webb, { context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } });
    await page.goto(BAS + '/lank#' + goKoda(verify('tok-foralder-1', 'signup')));
    await page.waitForSelector('#lank-knapp', { timeout: 8000 }).catch(() => {});
    const bredd = await page.evaluate(() => document.documentElement.scrollWidth);
    prova('lank telefon: ingen sidledsrullning', bredd <= 390, bredd);
    const ruta = await page.locator('#lank-knapp').boundingBox();
    prova('lank telefon: knappen syns utan att rulla', ruta && ruta.y + ruta.height <= 844, JSON.stringify(ruta));
    await bild(page, 'lank-telefon');
    await context.close();
  }
}

async function provaTelefonen(webb) {
  const { context, page } = await öppna(webb, { context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } });
  await page.goto(BAS + '/foralder');
  await page.waitForSelector('#view-auth:not([hidden])', { timeout: 8000 }).catch(() => {});
  const bredd = await page.evaluate(() => document.documentElement.scrollWidth);
  prova('telefon: ingen sidledsrullning', bredd <= 390, bredd);
  const länken = await page.locator('[data-glomt] button').boundingBox();
  const fältet = await page.locator('#a-pass').boundingBox();
  prova('telefon: länken står under lösenordet, till höger',
    länken && fältet && länken.y >= fältet.y + fältet.height && länken.x + länken.width > fältet.x + fältet.width - 8,
    JSON.stringify({ länken, fältet }));
  await bild(page, 'telefon-inloggning');
  await page.tap('[data-glomt] button');
  prova('telefon: tryck byter läge', (await text(page, '#auth-title')) === 'Glömt lösenordet?');
  await bild(page, 'telefon-glomt');
  await context.close();
}

/* ============ körningen ============ */
(async function () {
  const server = spawn('python3', [path.join(ROT, '.claude', 'serve.py'), String(PORT)], { stdio: 'ignore' });
  let klar = false;
  for (let i = 0; i < 50 && !klar; i++) {
    try { klar = (await fetch(BAS + '/foralder')).ok; } catch (e) { await vänta(100); }
  }
  const webb = await pw.chromium.launch();
  try {
    await provaInloggningen(webb);
    await provaLänken(webb);
    await provaMellansidan(webb);
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
