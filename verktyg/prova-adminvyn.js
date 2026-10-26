/* ============================================================
   NEXTRUM — röktestet av adminvyn mot en riktig databas (2026-10-21)

       verktyg/lokal-databas.sh bygg          (eller PORT=… NAMN=… för en egen)
       psql … -f verktyg/prova-adminvyn.sql   (datan, som postgres)
       NODE_PATH="$(npm root -g)" node verktyg/prova-adminvyn.js [mapp för bilder]

   Leo 2026-10-21: "Öppna varje sektion i adminvyn i testmiljön. Läs
   konsol- och nätverksfel, SQL/RLS-fel och trasiga knappar. ... Lägg till
   ett regressionstest som öppnar varje adminsektion och misslyckas vid
   konsolfel."

   De andra webbläsarproven (prova-*.js) svarar ur en falsk värld, och en
   fråga mot en kolumn som inte finns, en funktion utan EXECUTE eller en
   policy som nekar syns aldrig där. Det här provet kör adminvyn mot
   PostgREST framför en LOKAL databas byggd ur alla migrationer: varje
   fråga vyn ställer går mot de riktiga tabellerna, funktionerna och
   policyerna. Bara inloggningen är falsk: en JWT signerad med den lokala
   PostgREST:ens hemlighet, för en admin som finns i databasen.

   ALDRIG MOT DRIFTEN: nextrum-config.js byts i farten mot
   https://supabase.test, som besvaras här (REST vidare till den lokala
   PostgREST:en), och ett anrop till den riktiga adressen stoppas och
   fäller provet. Edge-funktionerna svarar 404, som en funktion som inte
   är driftsatt; vyn ska tåla det utan fel i konsolen.

   Provet öppnar varje sektion i menyn, varje flik i sektionen och den
   första personen eller raden i den (panelen och dess flikar), som
   superadmin och som en admin med behörigheter, och faller på varje fel
   i konsolen, varje sidfel och varje svar från databasen på 400 eller
   mer. Inte i CI: det kräver Docker.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');

let pw;
try { pw = require('playwright'); } catch (e) {
  console.error('Hittar inte Playwright. Kör med NODE_PATH="$(npm root -g)".');
  process.exit(2);
}

const ROT = path.dirname(__dirname);
const PORT = Number(process.env.WEBBPORT || 8981);
const BAS = 'http://localhost:' + PORT;
const DBPORT = Number(process.env.PORT || 54331);
const RESTPORT = Number(process.env.RESTPORT || 54332);
const REST = 'http://localhost:' + RESTPORT;
const HEMLIG = 'nextrum-lokal-hemlighet-minst-32-tecken-lang';
const FALSK = 'https://supabase.test';
const RIKTIG = /ddkfiuvcppalutfulvbi\.supabase\.co/;
const LAGRING = 'sb-supabase-auth-token';
const BILDER = process.argv[2] || null;
const BEHALL = process.env.BEHALL === '1';

const ADMINS = {
  superadmin: { id: 'a1000000-0000-4000-8000-0000000000ad', email: 'prov-admin@example.invalid' },
  behorig: { id: 'a1000000-0000-4000-8000-0000000000ae', email: 'prov-beh@example.invalid' }
};

const utfall = [];
function prova(namn, ok, detalj) {
  utfall.push({ namn, ok: !!ok, detalj: ok ? '' : String(detalj == null ? '' : detalj) });
}
const vänta = ms => new Promise(r => setTimeout(r, ms));

function jwt(anv) {
  const b = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const nu = Math.floor(Date.now() / 1000);
  const huvud = b({ alg: 'HS256', typ: 'JWT' });
  const kropp = b({ sub: anv.id, role: 'authenticated', aud: 'authenticated', email: anv.email,
    iat: nu, exp: nu + 6 * 3600, app_metadata: { provider: 'email' } });
  const sig = crypto.createHmac('sha256', HEMLIG).update(huvud + '.' + kropp).digest('base64url');
  return huvud + '.' + kropp + '.' + sig;
}

function användare(anv) {
  return { id: anv.id, aud: 'authenticated', role: 'authenticated', email: anv.email,
    app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-09-01T10:00:00Z' };
}

/* PostgREST i Docker, framför den lokala databasen. authenticator får
   lösenordet här: bilden har rollen men inget lösenord vi känner. */
function startaRest() {
  execFileSync('psql', ['-h', 'localhost', '-p', String(DBPORT), '-U', 'supabase_admin', '-d', 'postgres', '-q',
    '-c', "alter role authenticator with password 'postgres'"], { env: Object.assign({}, process.env, { PGPASSWORD: 'postgres' }) });
  try { execFileSync('docker', ['rm', '-f', 'nextrum-adminprov-rest'], { stdio: 'ignore' }); } catch (e) { /* fanns inte */ }
  execFileSync('docker', ['run', '-d', '--name', 'nextrum-adminprov-rest', '--network', 'host',
    '-e', 'PGRST_DB_URI=postgres://authenticator:postgres@localhost:' + DBPORT + '/postgres',
    '-e', 'PGRST_DB_SCHEMAS=public', '-e', 'PGRST_DB_ANON_ROLE=anon',
    '-e', 'PGRST_JWT_SECRET=' + HEMLIG, '-e', 'PGRST_SERVER_PORT=' + RESTPORT,
    '-e', 'PGRST_DB_EXTRA_SEARCH_PATH=public,extensions',
    'postgrest/postgrest:v12.2.3'], { stdio: 'ignore' });
}
function stoppaRest() {
  if (BEHALL) return;
  try { execFileSync('docker', ['rm', '-f', 'nextrum-adminprov-rest'], { stdio: 'ignore' }); } catch (e) { /* redan borta */ }
}

const CORS = {
  'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*',
  'access-control-expose-headers': 'content-range, x-total-count, content-profile, preference-applied'
};

async function öppna(webb, anv, o) {
  const context = await webb.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, (o && o.context) || {}));
  const riktiga = [];
  const konsol = [];
  const dbfel = [];
  const funktioner = [];
  const token = jwt(anv);
  const session = { access_token: token, refresh_token: 'prov', token_type: 'bearer', expires_in: 6 * 3600,
    expires_at: Math.floor(Date.now() / 1000) + 6 * 3600, user: användare(anv) };

  await context.route(RIKTIG, route => { riktiga.push(route.request().url()); return route.abort(); });
  await context.route(/nextrum-config\.js/, async route => {
    const t = fs.readFileSync(path.join(ROT, 'nextrum-config.js'), 'utf8')
      .replace(/SUPABASE_URL:\s*'[^']*'/, "SUPABASE_URL: '" + FALSK + "'");
    return route.fulfill({ status: 200, contentType: 'application/javascript', body: t });
  });
  await context.route(/^https:\/\/supabase\.test\//, async route => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (p === '/auth/v1/user') return route.fulfill({ status: 200, headers: Object.assign({ 'content-type': 'application/json' }, CORS), body: JSON.stringify(användare(anv)) });
    if (p === '/auth/v1/token') return route.fulfill({ status: 200, headers: Object.assign({ 'content-type': 'application/json' }, CORS), body: JSON.stringify(session) });
    if (p.startsWith('/auth/v1/')) return route.fulfill({ status: 200, headers: Object.assign({ 'content-type': 'application/json' }, CORS), body: '{}' });
    if (p.startsWith('/functions/v1/')) {
      funktioner.push(req.method() + ' ' + p);
      return route.fulfill({ status: 404, headers: Object.assign({ 'content-type': 'application/json' }, CORS),
        body: JSON.stringify({ code: 'NOT_FOUND', message: 'Requested function was not found' }) });
    }
    if (p.startsWith('/storage/v1/')) {
      return route.fulfill({ status: 200, headers: Object.assign({ 'content-type': 'application/json' }, CORS), body: '[]' });
    }
    if (p.startsWith('/rest/v1/')) {
      const mål = REST + p.slice('/rest/v1'.length) + url.search;
      const headers = Object.assign({}, req.headers());
      // Vyn skickar alltid sin token; anon-nyckeln är driftens och gäller inte här.
      headers.authorization = 'Bearer ' + token;
      delete headers.apikey;
      let svar;
      try {
        svar = await route.fetch({ url: mål, headers });
      } catch (e) {
        dbfel.push(req.method() + ' ' + p + url.search + ' → inget svar: ' + e.message);
        return route.abort();
      }
      if (svar.status() >= 400) {
        let text = '';
        try { text = await svar.text(); } catch (e) { /* inget */ }
        dbfel.push(req.method() + ' ' + decodeURIComponent(p + url.search).slice(0, 220) + ' → ' + svar.status()
          + ' ' + text.slice(0, 300));
      }
      return route.fulfill({ response: svar, headers: Object.assign({}, svar.headers(), CORS) });
    }
    return route.fulfill({ status: 404, headers: CORS, body: '' });
  });
  await context.routeWebSocket(/supabase\.test/, () => { /* Realtime svarar aldrig */ });
  await context.route(url => !String(url).startsWith(BAS) && !/supabase\.test/.test(String(url)), route => route.abort());
  await context.addInitScript(([nyckel, värde]) => {
    try { localStorage.setItem(nyckel, värde); } catch (e) { /* ingen lagring */ }
  }, [LAGRING, JSON.stringify(session)]);

  const page = await context.newPage();
  // En fil som saknas (js, css, en bild) säger bara "Failed to load resource" i konsolen.
  page.on('response', r => {
    if (r.url().startsWith(BAS) && r.status() >= 400) konsol.push('saknas ' + r.status() + ': ' + r.url().slice(BAS.length));
  });
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // Ett svar på 4xx/5xx står redan i dbfel, med databasens text; funktionerna är 404 med flit.
    if (/Failed to load resource/.test(t)) return;
    konsol.push(t);
  });
  page.on('pageerror', e => konsol.push('pageerror: ' + e.message));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  return { context, page, riktiga, konsol, dbfel, funktioner };
}

/* Väntar tills inga frågor varit på väg på en stund. */
async function lugnt(page, ms) {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await vänta(ms || 350);
}

async function bild(page, namn) {
  if (!BILDER) return;
  fs.mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: path.join(BILDER, namn + '.png') }).catch(() => {});
}

/* På en telefon: ingenting i sektionen får göra sidan bredare än skärmen. */
async function iSidled(page, namn, sek, rubrik) {
  const bredd = await page.evaluate(s => {
    const sek = document.querySelector('section.vy-sek[data-sek="' + s + '"]');
    const brett = sek ? [...sek.querySelectorAll('*')].filter(el => {
      const r = el.getBoundingClientRect();
      if (!(r.width > 0 && r.right > innerWidth + 1)) return false;
      // En bred tabell i en ruta som rullar i sidled är med flit: sidan står still.
      for (let p = el.parentElement; p && p !== sek.parentElement; p = p.parentElement) {
        if (/auto|scroll|hidden|clip/.test(getComputedStyle(p).overflowX)) return false;
      }
      return true;
    }).slice(0, 3).map(el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '.' + [...el.classList].join('.')
      + ' ' + Math.round(el.getBoundingClientRect().right)) : [];
    return { sida: document.documentElement.scrollWidth, skärm: innerWidth, brett };
  }, sek);
  prova(namn + ': ' + rubrik + ': inget sticker ut åt sidan', bredd.sida <= bredd.skärm && !bredd.brett.length,
    JSON.stringify(bredd));
}

async function genomAdminvyn(webb, roll, o) {
  const anv = ADMINS[roll];
  const namn = roll + (o && o.namn ? ' ' + o.namn : '');
  const { context, page, riktiga, konsol, dbfel, funktioner } = await öppna(webb, anv, o);
  await page.goto(BAS + '/admin');
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 15000 }).catch(() => {});
  await lugnt(page, 800);
  prova(namn + ': adminvyn öppnas', await page.locator('#view-app:not([hidden])').count() === 1,
    'inloggningen syns fortfarande');

  const sektioner = await page.locator('#vy-sido a[data-sek]').evaluateAll(l =>
    l.filter(a => a.offsetParent !== null).map(a => a.dataset.sek));
  prova(namn + ': menyn har sektioner', sektioner.length > 3, sektioner.join(', '));

  for (const sek of sektioner) {
    const före = { k: konsol.length, d: dbfel.length };
    await page.evaluate(s => { location.hash = '#' + s; }, sek);
    await lugnt(page, 500);
    await bild(page, namn.replace(/ /g, '-') + '-' + sek);

    // Varje flik i sektionen.
    const flikar = await page.locator('section.vy-sek[data-sek="' + sek + '"] .vy-flikar .vy-flik').evaluateAll(l =>
      l.filter(f => f.offsetParent !== null).map(f => f.dataset.flik));
    for (const f of flikar) {
      await page.locator('section.vy-sek[data-sek="' + sek + '"] .vy-flik[data-flik="' + f + '"]').first().click({ timeout: 3000 })
        .catch(() => {});
      await lugnt(page, 300);

      // Den första personen eller raden som öppnar panelen, och panelens flikar.
      const dp = page.locator('section.vy-sek[data-sek="' + sek + '"] .vy-flik-panel:not([hidden]) [data-dp], '
        + 'section.vy-sek[data-sek="' + sek + '"]:not(:has(.vy-flik-panel)) [data-dp]').first();
      if (await dp.count() && await dp.isVisible().catch(() => false)) {
        await dp.click({ timeout: 3000 }).catch(() => {});
        await lugnt(page, 500);
        const dpFlikar = await page.locator('.dp .dp-flik').evaluateAll(l => l.map(x => x.dataset.dpFlik));
        for (const df of dpFlikar.slice(1)) {
          await page.locator('.dp .dp-flik[data-dp-flik="' + df + '"]').first().click({ timeout: 3000 }).catch(() => {});
          await lugnt(page, 350);
        }
        await page.locator('[data-dp-stang]').first().click({ timeout: 2000 }).catch(() => {});
        await vänta(250);
      }
    }
    if (!flikar.length) {
      const dp = page.locator('section.vy-sek[data-sek="' + sek + '"] [data-dp]').first();
      if (await dp.count() && await dp.isVisible().catch(() => false)) {
        await dp.click({ timeout: 3000 }).catch(() => {});
        await lugnt(page, 500);
        const dpFlikar = await page.locator('.dp .dp-flik').evaluateAll(l => l.map(x => x.dataset.dpFlik));
        for (const df of dpFlikar.slice(1)) {
          await page.locator('.dp .dp-flik[data-dp-flik="' + df + '"]').first().click({ timeout: 3000 }).catch(() => {});
          await lugnt(page, 350);
        }
        await page.locator('[data-dp-stang]').first().click({ timeout: 2000 }).catch(() => {});
        await vänta(250);
      }
    }

    const nyaKonsol = konsol.slice(före.k);
    const nyaDb = dbfel.slice(före.d);
    prova(namn + ': ' + sek + ': inga fel i konsolen', nyaKonsol.length === 0, nyaKonsol.join(' | '));
    prova(namn + ': ' + sek + ': inga fel från databasen', nyaDb.length === 0, nyaDb.join(' | '));
    if (o && o.smal) await iSidled(page, namn, sek, sek);
  }

  /* Att göra, sak för sak (2026-10-26): sidan har ingen post i menyn, så
     loopen ovan når den inte. Talet vid ringen leder dit, och raderna är
     ringens tal, en per sak. Fixturen har en elev utan studiehjälpare
     (Cleo Tre), vars rad leder till Matchning med eleven vald, och en
     studiehjälpare att godkänna (Tea Väntar), vars panel öppnas på sidan.
     En admin med behörigheter når den inte, som Översikt. */
  {
    const före = { k: konsol.length, d: dbfel.length };
    const framme = () => page.evaluate(() => {
      const s = document.querySelector('section.vy-sek[data-sek]:not([hidden])');
      return s ? s.dataset.sek : null;
    });
    if (roll === 'superadmin') {
      await page.evaluate(() => { location.hash = '#oversikt'; });
      await lugnt(page, 500);
      const tal = (await page.locator('#kon-disk-tal').innerText().catch(() => '')).trim();
      prova(namn + ': att göra: vägen dit står under listan på Översikt',
        await page.locator('#kon-alla:not([hidden])').count() === 1, 'länken är dold');
      await page.locator('a.kon-nex-lage').click({ timeout: 3000 }).catch(() => {});
      await lugnt(page, 500);
      prova(namn + ': att göra: talet vid ringen leder till sidan', await framme() === 'attgora', await framme());
      await bild(page, namn.replace(/ /g, '-') + '-attgora');
      prova(namn + ': att göra: Översikt står vald i menyn',
        await page.locator('#vy-sido a[data-sek="oversikt"].ar-har').count() === 1, 'ingen vald post');
      // En rad som står för flera (samma fel om och om igen, eller Och N till) bär hur många i data-ganger.
      const sidan = await page.evaluate(() => {
        const v = document.querySelector('#ag-sidan');
        return {
          antal: [...v.querySelectorAll('.vy-grupp .vy-antal')].reduce((n, x) => n + Number(x.textContent), 0),
          rader: [...v.querySelectorAll('.ag-rad')].reduce((n, r) => n + Number(r.dataset.ganger || 1), 0),
          text: v.innerText.replace(/\s+/g, ' ').slice(0, 400)
        };
      });
      prova(namn + ': att göra: grupperna räknar ringens tal', String(sidan.antal) === tal, tal + ' mot ' + JSON.stringify(sidan));
      prova(namn + ': att göra: raderna är ringens tal, sak för sak', String(sidan.rader) === tal,
        tal + ' mot ' + JSON.stringify(sidan));
      const elev = page.locator('#ag-sidan a.ag-rad[data-mt-hoppa="a1000000-0000-4000-8000-0000000005c1"]');
      const elevText = await elev.innerText().catch(() => '');
      prova(namn + ': att göra: eleven utan studiehjälpare står med Matcha', /Cleo Tre/.test(elevText) && /Matcha/.test(elevText),
        sidan.text);
      const hjälpare = page.locator('#ag-sidan button.ag-rad[data-dp="studiehjalpare:a1000000-0000-4000-8000-0000000000a3"]');
      if (await hjälpare.count()) {
        await hjälpare.click({ timeout: 3000 }).catch(() => {});
        await lugnt(page, 500);
        prova(namn + ': att göra: studiehjälparens panel öppnas på sidan',
          await page.locator('.dp.ar-oppen').count() === 1 && await framme() === 'attgora', await framme());
        await page.locator('[data-dp-stang]').first().click({ timeout: 2000 }).catch(() => {});
        await vänta(350);
      } else {
        prova(namn + ': att göra: studiehjälparen att godkänna står med', false, sidan.text);
      }
      if (o && o.smal) await iSidled(page, namn, 'attgora', 'attgora');
      if (await elev.count()) {
        await elev.click({ timeout: 3000 }).catch(() => {});
        await lugnt(page, 700);
        prova(namn + ': att göra: Matcha leder till Matchning med eleven vald', await framme() === 'matchning'
          && await page.locator('[data-mt-elev="a1000000-0000-4000-8000-0000000005c1"][aria-pressed="true"]').count() === 1,
          await framme());
      }
    } else {
      await page.evaluate(() => { location.hash = '#attgora'; });
      await lugnt(page, 400);
      prova(namn + ': att göra: sidan är superadminens', await framme() !== 'attgora', await framme());
    }
    const nyaKonsol = konsol.slice(före.k);
    const nyaDb = dbfel.slice(före.d);
    prova(namn + ': att göra: inga fel i konsolen', nyaKonsol.length === 0, nyaKonsol.join(' | '));
    prova(namn + ': att göra: inga fel från databasen', nyaDb.length === 0, nyaDb.join(' | '));
  }

  /* Undersidorna som bara nås med adressen (2026-10-21): Koders fyra ytor
     har länkar, inte flikar, så loopen ovan når bara valet. Den första
     raden fälls ut, så att en kods användningar hämtas också. */
  if (sektioner.includes('koder')) {
    for (const u of ['koder/familjer', 'koder/studiehjalpare', 'koder/rabattkoder', 'koder/partnerkoder']) {
      const före = { k: konsol.length, d: dbfel.length };
      await page.evaluate(s => { location.hash = '#' + s; }, u);
      await lugnt(page, 700);
      const rad = page.locator('section.vy-sek[data-sek="koder"] details.kod-rad > summary').first();
      if (await rad.count() && await rad.isVisible().catch(() => false)) {
        await rad.click({ timeout: 3000 }).catch(() => {});
        await lugnt(page, 500);
      }
      await bild(page, namn.replace(/ /g, '-') + '-' + u.replace('/', '-'));
      if (u === 'koder/rabattkoder') {
        const lista = await page.locator('#kp-lista').innerText().catch(() => '');
        prova(namn + ': ' + u + ': koden står med sin ägare ur databasen', /PROVRABATT/.test(lista) && /Utlagd hos/.test(lista),
          lista.slice(0, 300));
        await page.fill('#kp-varde', '10').catch(() => {});
        await lugnt(page, 300);
        const förhand = await page.locator('#kp-forhand').innerText().catch(() => '');
        prova(namn + ': ' + u + ': förhandsvisningen har planerna ur erbjudanden_pris', /Så blir priset/i.test(förhand) && /Basic/.test(förhand),
          förhand.slice(0, 300));
        await page.fill('#kp-varde', '').catch(() => {});
      }
      const nyaKonsol = konsol.slice(före.k);
      const nyaDb = dbfel.slice(före.d);
      prova(namn + ': ' + u + ': inga fel i konsolen', nyaKonsol.length === 0, nyaKonsol.join(' | '));
      prova(namn + ': ' + u + ': inga fel från databasen', nyaDb.length === 0, nyaDb.join(' | '));
      if (o && o.smal) await iSidled(page, namn, 'koder', u);
    }
  }

  /* Syskontillägget (syskontillagg_som_skuld, 2026-10-21): fliken läser
     tillagg_oversikt() och posterna ur den riktiga databasen, och
     fixturens familj har ett upplupet tillägg och ett bokat. */
  if (sektioner.includes('ekonomi') && await page.locator('.vy-flik[data-flik="tillagg"]').count()) {
    const före = { k: konsol.length, d: dbfel.length };
    await page.evaluate(() => { location.hash = '#ekonomi'; });
    await lugnt(page, 500);
    await page.locator('.vy-flik[data-flik="tillagg"]').first().click({ timeout: 3000 }).catch(() => {});
    await lugnt(page, 700);
    const familjer = await page.locator('#tl-familjer').innerText().catch(() => '');
    prova(namn + ': syskontillägg: familjen står med 69 kr upplupet ur databasen',
      /Familjen Ett/.test(familjer) && /69\s*kr upplupet, 1 pass/.test(familjer), familjer.slice(0, 300));
    const lista = await page.locator('#tl-lista').innerText().catch(() => '');
    prova(namn + ': syskontillägg: obetalt visar den upplupna posten, inte den bokade',
      /1 extra barn/.test(lista) && /Upplupet/.test(lista) && !/Bokat/.test(lista), lista.slice(0, 300));
    await page.locator('[data-tl-filter="alla"]').first().click({ timeout: 3000 }).catch(() => {});
    await lugnt(page, 300);
    const alla = await page.locator('#tl-lista .tl-post').count();
    // Granskningen 2026-10-21: fixturen har också en betald post och en som väntar på Klarna.
    prova(namn + ': syskontillägg: Alla visar alla fyra posterna', alla === 4, String(alla));
    const släpp = await page.locator('#tl-lista [data-tl-slapp]').count();
    prova(namn + ': syskontillägg: Släpp betalningen står bara på posten som står i en betalning', släpp === 1,
      String(släpp));
    await bild(page, namn.replace(/ /g, '-') + '-ekonomi-tillagg');
    // Tilläggen räknas i månaden: en rad i Betalningar, och en rad i bokslutet.
    await page.locator('.vy-flik[data-flik="betalningar"]').first().click({ timeout: 3000 }).catch(() => {});
    await lugnt(page, 500);
    const betalningar = await page.locator('#bet-lista').textContent().catch(() => '') || '';
    prova(namn + ': betalningar: syskontillägget står som en betalning i månaden',
      /Syskontillägg/.test(betalningar) && /Betala tillägg nu/.test(betalningar), betalningar.slice(0, 300));
    await page.locator('.vy-flik[data-flik="bokslut"]').first().click({ timeout: 3000 }).catch(() => {});
    await lugnt(page, 900);
    const bokslut = await page.locator('[data-flik="bokslut"].vy-flik-panel').textContent().catch(() => '') || '';
    prova(namn + ': bokslut: syskontilläggen betalda i månaden står med',
      /Syskontillägg, betalda i månaden/.test(bokslut) && /69\s*kr · 1 st/.test(bokslut), bokslut.slice(0, 400));
    if (await page.locator('a[data-sek="manaden"]').count()) {
      await page.evaluate(() => { location.hash = '#manaden'; });
      await lugnt(page, 900);
      const pengar = await page.locator('#man-pengar').textContent().catch(() => '') || '';
      prova(namn + ': månadens ekonomi: syskontillägget har kommit in', /Syskontillägg/.test(pengar), pengar.slice(0, 300));
    }
    const nyaKonsol = konsol.slice(före.k);
    const nyaDb = dbfel.slice(före.d);
    prova(namn + ': syskontillägg: inga fel i konsolen', nyaKonsol.length === 0, nyaKonsol.join(' | '));
    prova(namn + ': syskontillägg: inga fel från databasen', nyaDb.length === 0, nyaDb.join(' | '));
  }

  /* Värvningsbonusen (varvningsbonus, 2026-10-21): sektionen läser
     raderna ur den riktiga databasen. Fixturen har en intjänad, en som
     väntar och en annullerad med databasens skäl. Inget trycks här: att
     markera och annullera provas i prova-varvning.js. */
  if (sektioner.includes('varvning')) {
    const före = { k: konsol.length, d: dbfel.length };
    await page.evaluate(() => { location.hash = '#varvning'; });
    await lugnt(page, 700);
    const lista = await page.locator('#vb-lista').innerText().catch(() => '');
    prova(namn + ': värvningsbonus: tre rader ur databasen, med lägena och delningen',
      /Kalle Kompis/.test(lista) && /Intjänad/.test(lista) && /Väntar/.test(lista) && /Annullerad/.test(lista)
        && /267,86\s*kr grund \+ 32,14\s*kr semester/.test(lista) && /Hade redan ett konto/.test(lista), lista.slice(0, 400));
    const summa = await page.locator('#vb-summa').innerText().catch(() => '');
    prova(namn + ': värvningsbonus: summeringen per värvare och lönemånad', /Tove/.test(summa) && /300\s*kr/.test(summa),
      summa.slice(0, 300));
    await bild(page, namn.replace(/ /g, '-') + '-varvning');
    const nyaKonsol = konsol.slice(före.k);
    const nyaDb = dbfel.slice(före.d);
    prova(namn + ': värvningsbonus: inga fel i konsolen', nyaKonsol.length === 0, nyaKonsol.join(' | '));
    prova(namn + ': värvningsbonus: inga fel från databasen', nyaDb.length === 0, nyaDb.join(' | '));
  }

  prova(namn + ': inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  if (funktioner.length) console.log('(' + namn + ' anropade edge-funktioner, som svarade 404: '
    + [...new Set(funktioner)].join(', ') + ')');
  await context.close();
}

(async function () {
  startaRest();
  const server = spawn('python3', [path.join(ROT, '.claude', 'serve.py'), String(PORT)], { stdio: 'ignore' });
  let klar = false;
  for (let i = 0; i < 80 && !klar; i++) {
    try { klar = (await fetch(BAS + '/admin')).ok && (await fetch(REST + '/')).status < 500; } catch (e) { await vänta(150); }
  }
  const webb = await pw.chromium.launch();
  try {
    await genomAdminvyn(webb, 'superadmin');
    await genomAdminvyn(webb, 'behorig');
    // Telefonen i mörkt läge: samma sektioner, och ingen sida bredare än skärmen.
    await genomAdminvyn(webb, 'superadmin', { namn: 'telefon mörkt', smal: true,
      context: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: 'dark' } });
  } catch (e) {
    prova('provet kraschade', false, e && e.stack || e);
  } finally {
    await webb.close();
    server.kill();
    stoppaRest();
  }
  const fel = utfall.filter(u => !u.ok);
  utfall.forEach(u => console.log((u.ok ? 'ok   ' : 'FEL  ') + u.namn + (u.ok ? '' : '  (' + u.detalj + ')')));
  console.log('\n' + (utfall.length - fel.length) + ' av ' + utfall.length + ' gröna.');
  process.exit(fel.length ? 1 : 0);
})();
