/* ============================================================
   NEXTRUM — webbläsarprov för barnkontona och adminbehörigheterna
   (barnkonton_och_admin)

       NODE_PATH="$(npm root -g)" node verktyg/prova-barnkonton.js [mapp för bilder]

   Kräver Playwright och Chromium (finns i molnsessionerna, installeras
   annars globalt). Körs inte i CI: ingen pakethanterare i repot.

   ALDRIG MOT DRIFTEN. Sidorna serveras av .claude/serve.py, och
   nextrum-config.js byts i farten mot en som pekar på
   https://supabase.test, en adress som inte finns. Varje anrop dit
   besvaras här, av en falsk Supabase med påhittade familjer; websocketen
   för Realtime fångas också. Ett anrop till den riktiga Supabase-adressen
   stoppas och fäller provet.

   Provet ser det en människa ser: vilka vyer och sektioner som syns, vad
   som står, vad som skickas till databasen och funktionerna, och att text
   ur databasen ritas som text. Reglerna i databasen provas i
   verktyg/rls-test.sql, inte här.
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
const PORT = 8961;
const BAS = 'http://localhost:' + PORT;
const FALSK = 'https://supabase.test';
const RIKTIG = /ddkfiuvcppalutfulvbi\.supabase\.co/;
const BILDER = process.argv[2] || null;
const LAGRING = 'sb-supabase-auth-token';

/* ============ utfallet ============ */
const utfall = [];
function prova(namn, ok, detalj) {
  utfall.push({ namn, ok: !!ok, detalj: ok ? '' : String(detalj == null ? '' : detalj) });
}

/* ============ den falska Supabase ============ */
const idag = new Date();
const dagar = n => { const d = new Date(idag); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const nu = n => new Date(Date.now() + n * 60000).toISOString();

function jwt(sub, roll) {
  const b = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  return b({ alg: 'HS256', typ: 'JWT' }) + '.' + b({ sub, role: roll, exp: 4102444800 }) + '.provet';
}

const KONTON = {
  'anna@example.se': { id: 'foralder-1', losen: 'anna-losen', role: 'authenticated', app_metadata: { provider: 'email' } },
  'alva.a@barn.nextrum.se': { id: 'barnkonto-1', losen: 'alva-losen-1', role: 'nextrum_barn',
    app_metadata: { provider: 'email', roll: 'barn', barn_id: 'barn-1', forald_id: 'foralder-1' } },
  'leo@example.se': { id: 'admin-1', losen: 'x', role: 'authenticated', app_metadata: { provider: 'email' } },
  'nina@example.se': { id: 'admin-2', losen: 'x', role: 'authenticated', app_metadata: { provider: 'email' } },
  'ola@example.se': { id: 'vanlig-1', losen: 'x', role: 'authenticated', app_metadata: { provider: 'email' } }
};
const ANVANDARE = Object.fromEntries(Object.entries(KONTON).map(([epost, k]) =>
  [k.id, { id: k.id, aud: 'authenticated', role: k.role, email: epost, app_metadata: k.app_metadata,
           user_metadata: {}, created_at: '2026-09-01T10:00:00Z' }]));

const ELAK = '<img src=x data-elak=1>';

function värld() {
  return {
    profiles: [
      { id: 'foralder-1', role: 'parent', full_name: 'Anna Andersson', email: 'anna@example.se', is_admin: false,
        match_status: 'matched', matched_tutor_id: 'handledare-1', created_at: '2026-09-01T10:00:00Z' },
      { id: 'handledare-1', role: 'tutor', full_name: 'Sara Svensson', email: 'sara@example.se', is_admin: false,
        created_at: '2026-09-01T10:00:00Z' },
      { id: 'admin-1', role: 'parent', full_name: 'Leo Superadmin', email: 'leo@example.se', is_admin: true,
        match_status: 'pending', created_at: '2026-09-01T10:00:00Z' },
      { id: 'admin-2', role: 'admin', full_name: 'Nina Begränsad', email: 'nina@example.se', is_admin: false,
        created_at: '2026-09-01T10:00:00Z' },
      { id: 'admin-3', role: 'admin', full_name: 'Omar Matchning', email: 'omar@example.se', is_admin: false,
        created_at: '2026-09-01T10:00:00Z' },
      { id: 'admin-4', role: 'admin', full_name: 'Pia Anmälningar', email: 'pia@example.se', is_admin: false,
        created_at: '2026-09-01T10:00:00Z' },
      { id: 'vanlig-1', role: 'parent', full_name: 'Ola Olsson', email: 'ola@example.se', is_admin: false,
        match_status: 'pending', created_at: '2026-09-02T10:00:00Z' }
    ],
    students: [
      { id: 'barn-1', parent_id: 'foralder-1', name: 'Alva', grade: 'Åk 6', subjects: ['Matematik'],
        matched_tutor_id: 'handledare-1', match_status: 'matched', created_at: '2026-09-01T10:00:00Z' },
      { id: 'barn-2', parent_id: 'foralder-1', name: ELAK + 'Bo', grade: 'Åk 3', subjects: ['Svenska'],
        matched_tutor_id: 'handledare-1', match_status: 'matched', created_at: '2026-09-02T10:00:00Z' }
    ],
    admin_roller: [
      { user_id: 'admin-1', ar_superadmin: true, behorigheter: [], skapad_av: null, skapad_at: '2026-09-30T08:00:00Z', andrad_at: '2026-09-30T08:00:00Z' },
      { user_id: 'admin-2', ar_superadmin: false, behorigheter: ['admin_hantera', 'leads'], skapad_av: 'admin-1', skapad_at: '2026-09-30T09:00:00Z', andrad_at: '2026-09-30T09:00:00Z' },
      { user_id: 'admin-3', ar_superadmin: false, behorigheter: ['leads', 'matchning'], skapad_av: 'admin-1', skapad_at: '2026-09-30T09:10:00Z', andrad_at: '2026-09-30T09:10:00Z' },
      { user_id: 'admin-4', ar_superadmin: false, behorigheter: ['leads'], skapad_av: 'admin-2', skapad_at: '2026-09-30T09:20:00Z', andrad_at: '2026-09-30T09:20:00Z' }
    ],
    admin_logg: [
      { id: 3, tid: '2026-09-30T09:20:00Z', aktor: 'admin-2', handling: 'skapad', mal_anvandare: 'admin-4',
        detaljer: { efter: { superadmin: false, behorigheter: ['leads'] }, via: 'gor_till_admin' } },
      { id: 2, tid: '2026-09-30T09:00:00Z', aktor: 'admin-1', handling: 'skapad', mal_anvandare: 'admin-2',
        detaljer: { efter: { superadmin: false, behorigheter: ['admin_hantera', 'leads'] }, via: 'gor_till_admin' } },
      { id: 1, tid: '2026-09-30T08:00:00Z', aktor: null, handling: 'skapad', mal_anvandare: 'admin-1',
        detaljer: { efter: { superadmin: true, behorigheter: [] }, via: 'migrering' } }
    ],
    leads: [
      { id: 'lead-1', parent_name: 'Karin Karlsson', email: 'karin@example.se', child_name: 'Kim', status: 'new',
        subject: 'Matematik', grade: 'Åk 7', created_at: '2026-09-29T10:00:00Z' }
    ]
  };
}

function falskSupabase(o) {
  const W = värld();
  const logg = [];
  const inloggad = { id: o.inloggad || null };

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

  function session(id) {
    return { access_token: jwt(id, ANVANDARE[id].role), refresh_token: 'prov-' + id, token_type: 'bearer',
             expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: ANVANDARE[id] };
  }

  function filtrera(rader, sök) {
    let ut = rader.slice();
    for (const [k, v] of sök.entries()) {
      if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
      const m = /^eq\.(.*)$/.exec(v);
      if (m) ut = ut.filter(r => String(r[k]) === m[1]);
      const i = /^in\.\((.*)\)$/.exec(v);
      if (i) { const lista = i[1].split(',').map(x => x.replace(/^"|"$/g, '')); ut = ut.filter(r => lista.includes(String(r[k]))); }
      if (v === 'is.null') ut = ut.filter(r => r[k] == null);
    }
    return ut;
  }

  const RPC = Object.assign({
    mina_behorigheter: () => ({ admin: false, superadmin: false, behorigheter: [] })
  }, o.rpc || {});
  const FUNKTIONER = o.funktioner || {};

  async function hantera(route) {
    const req = route.request();
    const url = new URL(req.url());
    const metod = req.method();
    if (metod === 'OPTIONS') return svar(route, 204);
    let kropp = null;
    try { kropp = req.postDataJSON(); } catch (e) { kropp = req.postData(); }
    logg.push({ metod, väg: url.pathname, sök: url.search, kropp });

    const p = url.pathname;
    if (p === '/auth/v1/token') {
      if (url.searchParams.get('grant_type') === 'password') {
        const k = KONTON[kropp && kropp.email];
        if (o.tak) return svar(route, 429, { code: 'over_request_rate_limit', message: 'Request rate limit reached' });
        if (!k || k.losen !== kropp.password) {
          return svar(route, 400, { code: 'invalid_credentials', error: 'invalid_grant', error_description: 'Invalid login credentials', message: 'Invalid login credentials' });
        }
        inloggad.id = k.id;
        return svar(route, 200, session(k.id));
      }
      if (inloggad.id) return svar(route, 200, session(inloggad.id));
      return svar(route, 400, { error: 'invalid_grant' });
    }
    if (p === '/auth/v1/user') {
      if (!inloggad.id) return svar(route, 401, { message: 'no user' });
      if (metod === 'PUT') { logg.push({ lösenordsbyte: true }); }
      return svar(route, 200, ANVANDARE[inloggad.id]);
    }
    if (p === '/auth/v1/logout') { inloggad.id = null; return svar(route, 204); }
    if (p.startsWith('/auth/v1/')) return svar(route, 200, {});

    if (p.startsWith('/functions/v1/')) {
      const namn = p.slice('/functions/v1/'.length);
      const f = FUNKTIONER[namn];
      if (!f) return svar(route, 404, { error: 'Ingen sådan funktion i provet.' });
      const [status, data] = f(kropp);
      return svar(route, status, data);
    }

    if (p.startsWith('/rest/v1/rpc/')) {
      const namn = p.slice('/rest/v1/rpc/'.length);
      const f = RPC[namn];
      if (!f) {
        return svar(route, 404, { code: 'PGRST202', message: 'Could not find the function public.' + namn + ' in the schema cache' });
      }
      const data = f(kropp || {});
      if (data && data.__fel) return svar(route, 400, data.__fel);
      return svar(route, 200, data === undefined ? null : data);
    }

    if (p.startsWith('/rest/v1/')) {
      const tabell = p.slice('/rest/v1/'.length);
      if (metod === 'GET' || metod === 'HEAD') {
        const rader = filtrera(W[tabell] || [], url.searchParams);
        const vill = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
        const cr = rader.length ? '0-' + (rader.length - 1) + '/' + rader.length : '*/0';
        if (vill) return rader.length ? svar(route, 200, rader[0], { 'content-range': cr })
          : svar(route, 406, { code: 'PGRST116', message: 'no rows' });
        return svar(route, 200, rader, { 'content-range': cr });
      }
      if (metod === 'PATCH') {
        const ut = filtrera(W[tabell] || [], url.searchParams);
        ut.forEach(r => Object.assign(r, kropp || {}));
        return svar(route, 204);
      }
      return svar(route, 201, []);
    }
    return svar(route, 404, {});
  }

  return { W, logg, inloggad, hantera, session };
}

/* ============ en sida med den falska Supabase ============ */
async function öppna(webb, o) {
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
  await context.route(/^https:\/\/supabase\.test\//, S.hantera);
  await context.routeWebSocket(/supabase\.test/, () => { /* Realtime svarar aldrig; det gör ingenting här */ });
  /* Allt annat utanför localhost stoppas: provet ska inte nå nätet. */
  await context.route(url => !String(url).startsWith(BAS) && !/supabase\.test/.test(String(url)),
    route => route.abort());

  if (o.inloggad) {
    const sess = S.session(o.inloggad);
    await context.addInitScript(([nyckel, värde]) => {
      try { localStorage.setItem(nyckel, värde); } catch (e) { /* ingen lagring */ }
    }, [LAGRING, JSON.stringify(sess)]);
  }

  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') konsol.push(m.text()); });
  page.on('pageerror', e => konsol.push('pageerror: ' + e.message));
  page.on('dialog', d => d.dismiss());
  return { context, page, S, riktiga, konsol };
}

async function bild(page, namn) {
  if (!BILDER) return;
  fs.mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: path.join(BILDER, namn + '.png'), fullPage: true });
}

const synlig = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const text = (page, sel) => page.locator(sel).first().textContent().catch(() => '');
const vänta = ms => new Promise(r => setTimeout(r, ms));

/* ============ barnets vy ============ */
function barnRpc(extra) {
  return Object.assign({
    barn_oversikt: () => ({
      lage: 'ok', fornamn: 'Alva', studiehjalpare: 'Sara',
      kommande: [
        { datum: dagar(1), tid: '16:00', langd_min: 60, status: 'confirmed', amne: 'Matematik' },
        { datum: dagar(3), tid: '17:00', langd_min: 120, status: 'requested', amne: 'Engelska' }
      ],
      genomforda: [{ datum: dagar(-4), tid: '16:00', langd_min: 60, amne: 'Matematik' }],
      timmar: { genomforda: 12, bokade: 1 },
      studieplan: { amne: 'Matematik', mal: 'Klara bråk inför provet', text: 'Vi tränar bråk varje vecka.\nSedan procent.', uppdaterad: '2026-09-20T10:00:00Z' },
      visa_rapporter: false, rapporter: null
    }),
    barn_notiser: () => [
      { id: 'notis-1', typ: 'bekraftat', text: 'Ditt pass imorgon kl. 16:00 är bekräftat.', skapad: nu(-60), last_at: null },
      { id: 'notis-2', typ: 'genomfort', text: ELAK + 'Passet är klart. Bra jobbat!', skapad: nu(-3000), last_at: nu(-2000) }
    ],
    barn_markera_last: () => true
  }, extra || {});
}

async function provaBarnvyn(webb) {
  /* 1. Utloggad: inloggningen, och samma besked för allt som är fel. */
  {
    const { context, page, S, riktiga } = await öppna(webb, { rpc: barnRpc() });
    await page.goto(BAS + '/barn');
    await page.waitForSelector('#view-auth:not([hidden])');
    prova('barn: utloggad ser inloggningen', await synlig(page, '#bv-form'));
    prova('barn: ingen länk till föräldervyn i inloggningen',
      (await page.locator('a[href*="foralder"], a[href*="larare"], a[href*="admin"]').count()) === 0);
    await bild(page, 'barn-inloggning');

    await page.fill('#bv-anv', 'Ogiltigt Namn!');
    await page.fill('#a-pass', 'vadsomhelst');
    await page.click('#bv-logga-in');
    await vänta(150);
    prova('barn: ogiltigt användarnamn ger samma besked',
      (await text(page, '#auth-msg')).trim() === 'Fel användarnamn eller lösenord', await text(page, '#auth-msg'));
    prova('barn: ogiltigt användarnamn skickas aldrig till Auth',
      !S.logg.some(r => r.väg === '/auth/v1/token'));

    await page.fill('#bv-anv', 'alva.a');
    await page.fill('#a-pass', 'fel-losen');
    await page.click('#bv-logga-in');
    await page.waitForFunction(() => document.querySelector('#auth-msg').textContent.length > 0);
    prova('barn: fel lösenord ger samma besked',
      (await text(page, '#auth-msg')).trim() === 'Fel användarnamn eller lösenord', await text(page, '#auth-msg'));
    const försök = S.logg.filter(r => r.väg === '/auth/v1/token').pop();
    prova('barn: adressen byggs som <namn>@barn.nextrum.se',
      försök && försök.kropp && försök.kropp.email === 'alva.a@barn.nextrum.se', JSON.stringify(försök && försök.kropp));
    prova('barn: lösenordsfältet töms efter ett fel', (await page.inputValue('#a-pass')) === '');

    await page.fill('#bv-anv', 'finns.inte');
    await page.fill('#a-pass', 'nagot-langt');
    await page.click('#bv-logga-in');
    await vänta(300);
    prova('barn: okänt användarnamn ger samma besked',
      (await text(page, '#auth-msg')).trim() === 'Fel användarnamn eller lösenord');

    /* 2. Rätt lösenord: vyn, med versaler i namnet som blir gemener. */
    await page.fill('#bv-anv', '  Alva.A ');
    await page.fill('#a-pass', 'alva-losen-1');
    await page.click('#bv-logga-in');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 5000 }).catch(() => {});
    prova('barn: rätt lösenord öppnar vyn', await synlig(page, '#view-app'));
    prova('barn: hälsningen', (await text(page, '#bv-rubrik')) === 'Hej, Alva!', await text(page, '#bv-rubrik'));
    prova('barn: studiehjälparens förnamn', (await text(page, '#bv-lede')).includes('Du pluggar med Sara.'));
    prova('barn: två kommande pass', (await page.locator('#bv-kommande .vy-rad').count()) === 2);
    prova('barn: ett önskat pass väntar på svar', (await text(page, '#bv-kommande')).includes('Väntar på svar'));
    prova('barn: timmarna', (await text(page, '#bv-timmar')).includes('12') && (await text(page, '#bv-timmar')).includes('timme bokade framåt'),
      await text(page, '#bv-timmar'));
    prova('barn: studieplanen', (await text(page, '#bv-plan')).includes('Klara bråk inför provet'));
    prova('barn: genomförda pass', (await page.locator('#bv-genomforda .vy-rad').count()) === 1);
    prova('barn: rapporterna syns inte när föräldern inte slagit på dem', !(await synlig(page, '#bv-rapporter-del')));
    prova('barn: frågan till föräldern står kvar', (await text(page, '.bv-fraga')).trim() === 'Vill du ändra något? Fråga din förälder.');
    prova('barn: text ur databasen ritas som text, inte som html',
      (await page.locator('#view-app img[data-elak]').count()) === 0
      && (await text(page, '#bv-notiser')).includes('<img src=x data-elak=1>'));
    const hela = await page.locator('#view-app').innerText();
    prova('barn: inga priser, inga betalningar, inga länkar ut',
      !/\bkr\b|betal|faktura|erbjud|klippkort|timbank/i.test(hela)
      && (await page.locator('#view-app a').count()) === 0, hela.slice(0, 200));
    prova('barn: bara barnets tre funktioner och Auth frågades',
      S.logg.filter(r => r.väg.startsWith('/rest/')).every(r => /\/rpc\/barn_(oversikt|notiser|markera_last)$/.test(r.väg)),
      S.logg.filter(r => r.väg.startsWith('/rest/')).map(r => r.väg).join(', '));
    await bild(page, 'barn-vyn-ljus');

    /* 3. Läst. */
    await page.click('[data-bv-last="notis-1"]');
    await vänta(300);
    const läst = S.logg.find(r => r.väg === '/rest/v1/rpc/barn_markera_last');
    prova('barn: Läst skickar notisens id', läst && läst.kropp && läst.kropp.p_id === 'notis-1', JSON.stringify(läst && läst.kropp));
    prova('barn: den lästa notisen har ingen knapp längre', (await page.locator('[data-bv-last]').count()) === 0);
    prova('barn: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
    await context.close();
  }

  /* 4. Rapporterna, mörkt läge och telefon. */
  for (const [namn, context] of [
    ['barn-vyn-mork', { colorScheme: 'dark' }],
    ['barn-vyn-telefon', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
    ['barn-vyn-telefon-mork', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark' }]
  ]) {
    const rpc = barnRpc({
      barn_oversikt: () => Object.assign(barnRpc().barn_oversikt(), {
        visa_rapporter: true,
        rapporter: [{ datum: dagar(-4), amne: 'Matematik', gick: 'bra', text: 'Alva räknade bråk med nämnare upp till tolv.',
                      trana: 'Förlänga bråk', nasta: 'Procent' }]
      })
    });
    const { context: c, page } = await öppna(webb, { rpc, inloggad: 'barnkonto-1', context });
    await page.goto(BAS + '/barn');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 5000 }).catch(() => {});
    prova(namn + ': vyn visas', await synlig(page, '#view-app'));
    prova(namn + ': rapporterna syns när föräldern slagit på dem', await synlig(page, '#bv-rapporter-del')
      && (await text(page, '#bv-rapporter')).includes('Förlänga bråk'));
    const bredd = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    prova(namn + ': ingen sidledsscroll', bredd <= 0, bredd + ' px');
    if (namn.includes('telefon')) {
      const små = await page.evaluate(() => Array.from(document.querySelectorAll('#view-app button, #nav-actions button'))
        .filter(b => b.offsetParent).map(b => b.getBoundingClientRect()).filter(r => r.height < 44).length);
      prova(namn + ': tryckytorna är minst 44 px', små === 0, små + ' knappar lägre än 44 px');
    }
    if (namn.includes('mork')) {
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const m = /rgba?\((\d+), (\d+), (\d+)/.exec(bg) || [0, 255, 255, 255];
      prova(namn + ': mörk bakgrund', (Number(m[1]) + Number(m[2]) + Number(m[3])) / 3 < 80, bg);
    }
    await bild(page, namn);
    await c.close();
  }

  /* 5. Pausad, och en vuxen i samma webbläsare. */
  {
    const { context, page } = await öppna(webb, { rpc: barnRpc({ barn_oversikt: () => ({ lage: 'pausad' }) }), inloggad: 'barnkonto-1' });
    await page.goto(BAS + '/barn');
    await page.waitForSelector('#view-stopp:not([hidden])', { timeout: 5000 }).catch(() => {});
    prova('barn: pausad inloggning säger det', (await text(page, '#bv-stopp-rubrik')) === 'Din inloggning är pausad');
    prova('barn: pausad visar inget av vyn', !(await synlig(page, '#view-app')));
    await bild(page, 'barn-pausad');
    await context.close();
  }
  {
    const { context, page, S } = await öppna(webb, { rpc: barnRpc(), inloggad: 'foralder-1' });
    await page.goto(BAS + '/barn');
    await page.waitForSelector('#view-annan:not([hidden])', { timeout: 5000 }).catch(() => {});
    prova('barn: en vuxen i samma webbläsare ser bara "Någon annan är inloggad"', await synlig(page, '#view-annan'));
    prova('barn: den vuxnes uppgifter hämtas inte', !S.logg.some(r => r.väg.startsWith('/rest/')));
    prova('barn: ingen länk till den vuxnes vy', (await page.locator('#view-annan a').count()) === 0);
    await context.close();
  }
  {
    const { context, page } = await öppna(webb, { rpc: barnRpc(), tak: true });
    await page.goto(BAS + '/barn');
    await page.waitForSelector('#view-auth:not([hidden])');
    await page.fill('#bv-anv', 'alva.a');
    await page.fill('#a-pass', 'alva-losen-1');
    await page.click('#bv-logga-in');
    await page.waitForFunction(() => document.querySelector('#auth-msg').textContent.length > 0);
    prova('barn: för många försök säger det, utan att säga något om kontot',
      (await text(page, '#auth-msg')).startsWith('För många försök'), await text(page, '#auth-msg'));
    await context.close();
  }

  /* 6. Barnet skickas hem från de vuxnas vyer. */
  for (const vy of ['/foralder', '/larare', '/admin']) {
    const { context, page } = await öppna(webb, { rpc: barnRpc(), inloggad: 'barnkonto-1' });
    await page.goto(BAS + vy);
    await page.waitForURL(/\/barn$/, { timeout: 5000 }).catch(() => {});
    prova('barn: ' + vy + ' skickar barnet till /barn', /\/barn$/.test(page.url()), page.url());
    await context.close();
  }
}

/* ============ föräldrarnas ruta ============ */
async function provaBarnpanelen(webb) {
  const konton = [
    { barn_id: 'barn-1', anvandarnamn: 'alva.a', barn_aktiv: true, visa_rapporter: false,
      vardnadshavare_godkand_at: '2026-09-30T10:00:00Z', senast_inloggad: '2026-09-30T15:30:00Z' },
    { barn_id: 'barn-2', anvandarnamn: null, barn_aktiv: true, visa_rapporter: false,
      vardnadshavare_godkand_at: null, senast_inloggad: null }
  ];
  const anrop = [];
  const { context, page, S, riktiga } = await öppna(webb, {
    inloggad: 'foralder-1',
    rpc: { mina_barnkonton: () => konton },
    funktioner: {
      'barn-konto': kropp => {
        anrop.push(kropp);
        if (kropp.atgard === 'skapa' && kropp.anvandarnamn === 'upptaget') {
          return [409, { error: 'Användarnamnet är upptaget. Välj ett annat.' }];
        }
        if (kropp.atgard === 'skapa') {
          Object.assign(konton[1], { anvandarnamn: kropp.anvandarnamn, vardnadshavare_godkand_at: new Date().toISOString() });
        }
        if (kropp.atgard === 'pausa') konton[0].barn_aktiv = false;
        return [200, { ok: true }];
      }
    }
  });
  await page.goto(BAS + '/foralder#profil/barn');
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
  prova('förälder: vyn laddar', await synlig(page, '#view-app'));
  const flik = page.locator('section[data-sek="profil"] .vy-flik[data-flik="barn"]');
  if (await flik.count()) await flik.click();
  await page.waitForSelector('#bi-ruta:not([hidden])', { timeout: 5000 }).catch(() => {});
  prova('förälder: rutan Barnens inloggning syns', await synlig(page, '#bi-ruta'));
  prova('förälder: ett kort per barn', (await page.locator('#bi-lista .bi-kort').count()) === 2);
  const alva = page.locator('.bi-kort[data-bi="barn-1"]');
  prova('förälder: Alva har en aktiv inloggning', (await alva.locator('.lage').textContent()) === 'Aktiv');
  prova('förälder: användarnamnet och senaste inloggningen', (await alva.textContent()).includes('alva.a')
    && (await alva.textContent()).includes('Senast inloggad'));
  prova('förälder: barnets namn ritas som text',
    (await page.locator('#bi-lista img[data-elak]').count()) === 0
    && (await page.locator('.bi-kort[data-bi="barn-2"] .bi-topp b').textContent()).startsWith('<img'));
  await bild(page, 'foralder-barnens-inloggning');

  /* Skapa: fel först, sedan rätt. */
  const bo = '.bi-kort[data-bi="barn-2"]';
  await page.fill(bo + ' [data-bi-anv]', 'Bo!');
  await page.click(bo + ' button[type="submit"]');
  prova('förälder: ett ogiltigt användarnamn stoppas i rutan', (await text(page, '#bi-msg')).includes('3–20 tecken') && anrop.length === 0,
    await text(page, '#bi-msg'));
  await page.fill(bo + ' [data-bi-anv]', 'bo.b');
  await page.fill(bo + ' [data-bi-los]', 'hemligt-1');
  await page.fill(bo + ' [data-bi-los2]', 'hemligt-2');
  await page.click(bo + ' button[type="submit"]');
  prova('förälder: olika lösenord stoppas', (await text(page, '#bi-msg')).includes('inte lika') && anrop.length === 0);
  await page.fill(bo + ' [data-bi-los2]', 'hemligt-1');
  await page.click(bo + ' button[type="submit"]');
  prova('förälder: utan vårdnadshavarens ja skickas ingenting', (await text(page, '#bi-msg')).includes('vårdnadshavare') && anrop.length === 0);
  await page.check(bo + ' [data-bi-ja]');
  await page.click(bo + ' button[type="submit"]');
  await page.waitForFunction(() => /loggar nu in/.test(document.querySelector('#bi-msg').textContent), null, { timeout: 5000 }).catch(() => {});
  const skapa = anrop.find(a => a.atgard === 'skapa');
  prova('förälder: Skapa skickar barnet, namnet, lösenordet och ja:et',
    skapa && skapa.barn_id === 'barn-2' && skapa.anvandarnamn === 'bo.b' && skapa.losenord === 'hemligt-1'
    && skapa.vardnadshavare_godkand === true, JSON.stringify(skapa));
  prova('förälder: lösenordet står inte i sidan efteråt', !(await page.locator('body').innerText()).includes('hemligt-1'));
  prova('förälder: Bo har nu en inloggning', (await page.locator(bo + ' .lage').textContent()) === 'Aktiv');

  /* Rapportvalet skrivs på barnet. */
  await page.click('.bi-kort[data-bi="barn-1"] [data-bi-rapporter]');
  await vänta(300);
  const patch = S.logg.find(r => r.metod === 'PATCH' && r.väg === '/rest/v1/students');
  prova('förälder: rapportvalet skrivs som visa_rapporter på barnet',
    patch && patch.kropp && patch.kropp.visa_rapporter === true && /id=eq\.barn-1/.test(patch.sök), JSON.stringify(patch));

  /* Pausa frågar först. */
  page.removeAllListeners('dialog');
  await page.click('.bi-kort[data-bi="barn-1"] [data-bi-paus]');
  await page.waitForSelector('.nx-fraga.open', { timeout: 3000 }).catch(() => {});
  prova('förälder: Pausa frågar först', await synlig(page, '.nx-fraga'));
  await page.click('.nx-fraga [data-svar="ja"]');
  await page.waitForFunction(() => /pausad/.test(document.querySelector('#bi-msg').textContent), null, { timeout: 5000 }).catch(() => {});
  prova('förälder: Pausa anropar barn-konto', anrop.some(a => a.atgard === 'pausa' && a.barn_id === 'barn-1'));
  prova('förälder: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  await bild(page, 'foralder-efter');
  await context.close();

  /* Utan migrationen: rutan syns inte, och inget annat går sönder. */
  {
    const { context: c, page: p } = await öppna(webb, { inloggad: 'foralder-1', rpc: {} });
    await p.goto(BAS + '/foralder#profil/barn');
    await p.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
    await vänta(500);
    prova('förälder utan migrationen: vyn laddar och rutan är dold',
      (await synlig(p, '#view-app')) && !(await synlig(p, '#bi-ruta')));
    await c.close();
  }
}

/* ============ ett barn i familjens inloggning (2026-10-01) ============
   Logga in på sajten leder till studievyn, och där prövades det första
   riktiga barnkontot. Barnets användarnamn ska fungera där, barnet
   hamna i sin vy, och föräldrarnas inloggning vara som förut. */
async function provaFamiljensInloggning(webb) {
  /* 1. Etiketten följer läget, och fel lösenord ger barnvyns besked. */
  {
    const { context, page, S, riktiga } = await öppna(webb, { rpc: barnRpc() });
    await page.goto(BAS + '/foralder');
    await page.waitForSelector('#view-auth:not([hidden])', { timeout: 8000 }).catch(() => {});
    const etikett = () => text(page, 'label[for="a-email"]');
    prova('familjen: fältet heter E-post eller användarnamn när man loggar in',
      (await etikett()) === 'E-post eller användarnamn', await etikett());
    await page.click('[data-auth="up"]');
    prova('familjen: och E-post när man skapar konto', (await etikett()) === 'E-post', await etikett());
    await page.click('[data-auth="in"]');
    await bild(page, 'familjen-inloggning');

    await page.click('#auth-submit');
    prova('familjen: tomma fält nämner användarnamnet',
      (await text(page, '#auth-msg')).trim() === 'Fyll i e-post eller användarnamn och lösenord.', await text(page, '#auth-msg'));

    await page.fill('#a-email', ' Alva.A ');
    await page.fill('#a-pass', 'fel-losen');
    await page.click('#auth-submit');
    await page.waitForFunction(() => document.querySelector('#auth-msg').textContent.includes('användarnamn eller lösenord'),
      null, { timeout: 5000 }).catch(() => {});
    prova('familjen: ett användarnamn med fel lösenord får barnvyns besked',
      (await text(page, '#auth-msg')).trim() === 'Fel användarnamn eller lösenord', await text(page, '#auth-msg'));
    const försök = S.logg.filter(r => r.väg === '/auth/v1/token').pop();
    prova('familjen: användarnamnet blir barnadressen, med gemener',
      försök && försök.kropp && försök.kropp.email === 'alva.a@barn.nextrum.se', JSON.stringify(försök && försök.kropp));
    prova('familjen: lösenordsfältet töms efter ett fel', (await page.inputValue('#a-pass')) === '');
    prova('familjen: sidan står kvar efter ett fel', /\/foralder$/.test(page.url()), page.url());

    /* 2. Rätt lösenord: barnet hamnar i sin vy, och familjens uppgifter
       hämtas aldrig med barnets inloggning. */
    await page.fill('#a-pass', 'alva-losen-1');
    await page.click('#auth-submit');
    await page.waitForURL(/\/barn$/, { timeout: 5000 }).catch(() => {});
    prova('familjen: barnets användarnamn leder till /barn', /\/barn$/.test(page.url()), page.url());
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 5000 }).catch(() => {});
    prova('familjen: barnets vy öppnas inloggad', (await text(page, '#bv-rubrik')) === 'Hej, Alva!', await text(page, '#bv-rubrik'));
    const familjens = S.logg.filter(r => /^\/rest\/v1\/(profiles|students|bookings|lesson_reports)/.test(r.väg));
    prova('familjen: inget av familjens hämtades', familjens.length === 0, familjens.map(r => r.väg).join(', '));
    prova('familjen: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
    await context.close();
  }

  /* 3. Hela barnadressen fungerar också. */
  {
    const { context, page } = await öppna(webb, { rpc: barnRpc() });
    await page.goto(BAS + '/foralder');
    await page.waitForSelector('#view-auth:not([hidden])', { timeout: 8000 }).catch(() => {});
    await page.fill('#a-email', 'alva.a@barn.nextrum.se');
    await page.fill('#a-pass', 'alva-losen-1');
    await page.click('#auth-submit');
    await page.waitForURL(/\/barn$/, { timeout: 5000 }).catch(() => {});
    prova('familjen: hela barnadressen leder också till /barn', /\/barn$/.test(page.url()), page.url());
    await context.close();
  }

  /* 4. En förälder loggar in som förut. */
  {
    const { context, page, S } = await öppna(webb, { rpc: { mina_barnkonton: () => [] } });
    await page.goto(BAS + '/foralder');
    await page.waitForSelector('#view-auth:not([hidden])', { timeout: 8000 }).catch(() => {});
    await page.fill('#a-email', 'anna@example.se');
    await page.fill('#a-pass', 'fel');
    await page.click('#auth-submit');
    await page.waitForFunction(() => document.querySelector('#auth-msg').textContent.length > 0, null, { timeout: 5000 }).catch(() => {});
    prova('familjen: en förälder med fel lösenord får samma besked som förut',
      (await text(page, '#auth-msg')).trim() === 'Fel e-post eller lösenord.', await text(page, '#auth-msg'));
    await page.fill('#a-pass', 'anna-losen');
    await page.click('#auth-submit');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
    const adresser = S.logg.filter(r => r.väg === '/auth/v1/token' && r.kropp && r.kropp.email).map(r => r.kropp.email);
    prova('familjen: föräldern loggar in med sin adress och ser studievyn',
      (await synlig(page, '#view-app')) && /\/foralder$/.test(page.url()) && adresser.length === 2
      && adresser.every(a => a === 'anna@example.se'), page.url() + ' ' + adresser.join(', '));
    await context.close();
  }

  /* 5. Glömt lösenordet med ett användarnamn: inget mejl, föräldern byter. */
  {
    const { context, page, S } = await öppna(webb, {});
    await page.goto(BAS + '/foralder');
    await page.waitForSelector('#view-auth:not([hidden])', { timeout: 8000 }).catch(() => {});
    await page.click('[data-glomt] button');
    prova('familjen: i Glömt lösenordet heter fältet E-post', (await text(page, 'label[for="a-email"]')) === 'E-post');
    await page.fill('#a-email', 'alva.a');
    await page.click('#auth-submit');
    await page.waitForFunction(() => document.querySelector('#auth-msg').textContent.length > 0, null, { timeout: 5000 }).catch(() => {});
    prova('familjen: ett användarnamn i Glömt lösenordet får förälderbeskedet',
      (await text(page, '#auth-msg')).includes('byts av föräldern'), await text(page, '#auth-msg'));
    prova('familjen: och inget mejl begärs', !S.logg.some(r => r.väg === '/auth/v1/recover'));
    await context.close();
  }

  /* 6. Studiehjälparvyn: ett ord utan @ är en ofullständig adress, inget barn. */
  {
    const { context, page, S } = await öppna(webb, {});
    await page.goto(BAS + '/larare');
    await page.waitForSelector('#view-auth:not([hidden])', { timeout: 8000 }).catch(() => {});
    prova('studiehjälpare: fältet heter E-post', (await text(page, 'label[for="a-email"]')) === 'E-post');
    await page.click('[data-glomt] button');
    await page.fill('#a-email', 'alva.a');
    await page.click('#auth-submit');
    await page.waitForFunction(() => document.querySelector('#auth-msg').textContent.length > 0, null, { timeout: 5000 }).catch(() => {});
    prova('studiehjälpare: ett ord utan @ i Glömt lösenordet är en ofullständig adress',
      (await text(page, '#auth-msg')).startsWith('Kontrollera e-postadressen'), await text(page, '#auth-msg'));
    prova('studiehjälpare: och inget mejl begärs', !S.logg.some(r => r.väg === '/auth/v1/recover'));
    await context.close();
  }

  /* 7. Barnets vy tar också hela barnadressen. */
  {
    const { context, page, S } = await öppna(webb, { rpc: barnRpc() });
    await page.goto(BAS + '/barn');
    await page.waitForSelector('#view-auth:not([hidden])');
    await page.fill('#bv-anv', 'Alva.A@barn.nextrum.se');
    await page.fill('#a-pass', 'alva-losen-1');
    await page.click('#bv-logga-in');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 5000 }).catch(() => {});
    const försök = S.logg.filter(r => r.väg === '/auth/v1/token').pop();
    prova('barn: hela barnadressen fungerar också',
      (await synlig(page, '#view-app')) && försök && försök.kropp && försök.kropp.email === 'alva.a@barn.nextrum.se',
      JSON.stringify(försök && försök.kropp));
    await context.close();
  }

  /* 8. Telefonen: den längre etiketten får plats. */
  {
    const { context, page } = await öppna(webb, {
      context: { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    });
    await page.goto(BAS + '/foralder');
    await page.waitForSelector('#view-auth:not([hidden])', { timeout: 8000 }).catch(() => {});
    const bredd = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    prova('familjen telefon: ingen sidledsscroll', bredd <= 0, bredd + ' px');
    /* Lösenord står alltid på en rad: lika hög är en rad. */
    const höjd = await page.evaluate(() => ['a-email', 'a-pass'].map(id =>
      document.querySelector('label[for="' + id + '"]').getBoundingClientRect().height));
    prova('familjen telefon: etiketten står på en rad', höjd[0] <= höjd[1] + 1, höjd.join(' mot ') + ' px');
    await bild(page, 'familjen-inloggning-telefon');
    await context.close();
  }
}

/* ============ adminvyn ============ */
const ALLA = ['leads', 'matchning', 'anvandare_las', 'anvandare_redigera', 'studiehjalpare_godkann',
  'bokningar_las', 'rapporter_las', 'notiskonfig', 'admin_hantera'];

function adminRpc(roll, extra) {
  return Object.assign({
    mina_behorigheter: () => roll,
    gor_till_admin: k => ({ user_id: k.p_user_id, superadmin: !!k.p_superadmin, behorigheter: k.p_behorigheter }),
    ta_bort_admin: () => true
  }, extra || {});
}

async function provaAdminvyn(webb) {
  /* Superadmin: allt, och Adminhantering. */
  {
    const skickat = [];
    const { context, page, S, riktiga } = await öppna(webb, {
      inloggad: 'admin-1',
      rpc: adminRpc({ admin: true, superadmin: true, behorigheter: ALLA }),
      funktioner: { 'admin-skapa': k => { skickat.push(k); return [200, { ok: true, id: 'ny-1', epost: k.epost }]; } }
    });
    await page.goto(BAS + '/admin#system/adminanvandare');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
    prova('superadmin: adminvyn laddar', await synlig(page, '#view-app'));
    prova('superadmin: hela menyn', (await page.locator('#vy-sido a[data-sek]:not([hidden])').count()) >= 18,
      await page.locator('#vy-sido a[data-sek]:not([hidden])').count());
    await page.waitForSelector('#ah-lista .ah-rad', { timeout: 5000 }).catch(() => {});
    prova('superadmin: fyra admins i listan', (await page.locator('#ah-lista .ah-rad').count()) === 4);
    const du = page.locator('.ah-rad[data-ah-rad="admin-1"]');
    prova('superadmin: den egna raden går inte att ändra', (await du.locator('[data-ah-andra], [data-ah-bort]').count()) === 0);
    prova('superadmin: loggen visar tre rader', (await page.locator('#ah-logg tbody tr').count()) === 3);
    prova('superadmin: rutan Superadmin finns i inbjudan', (await page.locator('#ah-ny-form [data-ah-super]').count()) === 1);
    await bild(page, 'admin-superadmin-adminhantering');

    /* Bjud in. */
    await page.fill('#ah-ny-epost', 'ny.person@example.se');
    await page.fill('#ah-ny-namn', 'Ny Person');
    await page.check('#ah-ny-form [data-ah-beh="anvandare_redigera"]');
    await page.click('#ah-ny-form button[type="submit"]');
    prova('superadmin: ändra utan läsa stoppas i rutan', (await text(page, '#ah-ny-msg')).includes('Läsa användare') && skickat.length === 0,
      await text(page, '#ah-ny-msg'));
    await page.check('#ah-ny-form [data-ah-beh="anvandare_las"]');
    await page.click('#ah-ny-form button[type="submit"]');
    await page.waitForFunction(() => /Inbjudan skickad/.test(document.querySelector('#ah-ny-msg').textContent), null, { timeout: 5000 }).catch(() => {});
    prova('superadmin: inbjudan skickar adress, namn och behörigheter',
      skickat[0] && skickat[0].epost === 'ny.person@example.se' && skickat[0].namn === 'Ny Person'
      && JSON.stringify(skickat[0].behorigheter) === JSON.stringify(['anvandare_las', 'anvandare_redigera'])
      && skickat[0].superadmin === false, JSON.stringify(skickat[0]));

    /* Befintlig användare. */
    await page.fill('#ah-bef-sok', 'ola');
    await page.click('[data-ah-bef-valj="vanlig-1"]');
    await page.check('[data-ah-bef-form] [data-ah-beh="leads"]');
    page.removeAllListeners('dialog');
    await page.click('[data-ah-bef-form] button[type="submit"]');
    await page.waitForSelector('.nx-fraga.open', { timeout: 3000 }).catch(() => {});
    await page.click('.nx-fraga [data-svar="ja"]');
    await page.waitForFunction(() => /är admin/.test(document.querySelector('#ah-bef-msg').textContent), null, { timeout: 5000 }).catch(() => {});
    const gor = S.logg.find(r => r.väg === '/rest/v1/rpc/gor_till_admin');
    prova('superadmin: befintlig användare blir admin genom gor_till_admin',
      gor && gor.kropp.p_user_id === 'vanlig-1' && JSON.stringify(gor.kropp.p_behorigheter) === '["leads"]'
      && gor.kropp.p_superadmin === false, JSON.stringify(gor && gor.kropp));

    /* Ta bort. */
    await page.click('[data-ah-bort="admin-4"]');
    await page.waitForSelector('.nx-fraga.open', { timeout: 3000 }).catch(() => {});
    await page.click('.nx-fraga [data-svar="ja"]');
    await vänta(400);
    const bort = S.logg.find(r => r.väg === '/rest/v1/rpc/ta_bort_admin');
    prova('superadmin: Ta bort anropar ta_bort_admin', bort && bort.kropp.p_user_id === 'admin-4', JSON.stringify(bort && bort.kropp));
    prova('superadmin: ingen skrivning av is_admin på profilen',
      !S.logg.some(r => r.metod === 'PATCH' && r.väg === '/rest/v1/profiles' && r.kropp && 'is_admin' in r.kropp));
    prova('superadmin: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
    await context.close();
  }

  /* En admin med Intresseanmälningar och Hantera admins. */
  {
    const { context, page, S } = await öppna(webb, {
      inloggad: 'admin-2',
      rpc: adminRpc({ admin: true, superadmin: false, behorigheter: ['admin_hantera', 'leads'] })
    });
    await page.goto(BAS + '/admin#ekonomi');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
    prova('begränsad: adminvyn laddar', await synlig(page, '#view-app'));
    const synliga = await page.locator('#vy-sido a[data-sek]').evaluateAll(as => as.filter(a => !a.hidden).map(a => a.dataset.sek));
    prova('begränsad: menyn har bara Intresseanmälningar och System', JSON.stringify(synliga) === '["leads","system"]', JSON.stringify(synliga));
    const framme = await page.locator('section.vy-sek[data-sek]:not([hidden])').evaluateAll(s => s.map(x => x.dataset.sek));
    prova('begränsad: en adress till Betalningar landar i Intresseanmälningar', JSON.stringify(framme) === '["leads"]', JSON.stringify(framme));
    const rubriker = await page.locator('#vy-sido .vy-sido-rubrik').evaluateAll(r => r.filter(x => !x.hidden).map(x => x.textContent));
    prova('begränsad: rubriker utan poster göms', JSON.stringify(rubriker) === '["Kunder","Inställningar"]', JSON.stringify(rubriker));
    prova('begränsad: Tips och kampanjer är borta', (await page.locator('#koder-tabell').count()) === 0);
    const förbjudna = S.logg.filter(r => /rpc\/(ekonomiska_avvikelser|audit_sok|tipskoder_lage|driftkorningar)|\/(passunderlag|analys_|admin_lage)/.test(r.väg));
    prova('begränsad: det superadminen ser hämtas inte', förbjudna.length === 0, förbjudna.map(r => r.väg).join(', '));
    await page.goto(BAS + '/admin#system/adminanvandare');
    await vänta(300);
    const flikar = await page.locator('section[data-sek="system"] .vy-flik').evaluateAll(f => f.map(x => x.dataset.flik));
    prova('begränsad: System har bara Adminhantering', JSON.stringify(flikar) === '["adminanvandare"]', JSON.stringify(flikar));
    await page.waitForSelector('#ah-lista .ah-rad', { timeout: 5000 }).catch(() => {});
    prova('begränsad: superadminen går inte att ändra',
      (await page.locator('.ah-rad[data-ah-rad="admin-1"] [data-ah-andra], .ah-rad[data-ah-rad="admin-1"] [data-ah-bort]').count()) === 0
      && (await page.locator('.ah-rad[data-ah-rad="admin-1"]').textContent()).includes('bara av en superadmin'));
    prova('begränsad: den som har mer än jag går inte att ändra',
      (await page.locator('.ah-rad[data-ah-rad="admin-3"] [data-ah-andra]').count()) === 0);
    prova('begränsad: den som har mindre går att ändra',
      (await page.locator('.ah-rad[data-ah-rad="admin-4"] [data-ah-andra]').count()) === 1);
    prova('begränsad: ingen ruta Superadmin', (await page.locator('[data-ah-super]').count()) === 0);
    const aktiva = await page.locator('#ah-ny-form [data-ah-beh]').evaluateAll(i => i.filter(x => !x.disabled).map(x => x.dataset.ahBeh));
    prova('begränsad: bara de egna behörigheterna går att ge', JSON.stringify(aktiva) === '["leads","admin_hantera"]', JSON.stringify(aktiva));
    prova('begränsad: kontomenyn säger Admin', (await page.locator('#nav-actions .roll').first().textContent()) === 'Admin');
    await bild(page, 'admin-begransad');
    await context.close();
  }

  /* En admin utan Hantera admins: ingen System alls. */
  {
    const { context, page } = await öppna(webb, {
      inloggad: 'admin-2',
      rpc: adminRpc({ admin: true, superadmin: false, behorigheter: ['matchning'] })
    });
    await page.goto(BAS + '/admin');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
    const synliga = await page.locator('#vy-sido a[data-sek]').evaluateAll(as => as.filter(a => !a.hidden).map(a => a.dataset.sek));
    prova('matchning: Familjer, Elever, Studiehjälpare och Matchning',
      JSON.stringify(synliga) === '["familjer","elever","studiehjalpare","matchning"]', JSON.stringify(synliga));
    await context.close();
  }

  /* Ingen adminroll: nekad, och ett konto som bara är admin får ingen väg till studievyn. */
  {
    const { context, page } = await öppna(webb, {
      inloggad: 'admin-2', rpc: adminRpc({ admin: false, superadmin: false, behorigheter: [] })
    });
    await page.goto(BAS + '/admin');
    await page.waitForSelector('#view-nekad:not([hidden])', { timeout: 8000 }).catch(() => {});
    prova('nekad: utan roll visas "Du har inte behörighet hit"', await synlig(page, '#view-nekad'));
    prova('nekad: ett konto som bara är admin har ingen länk till studievyn', !(await synlig(page, '#nekad-studievyn')));
    await context.close();
  }
  {
    const { context, page } = await öppna(webb, {
      inloggad: 'vanlig-1', rpc: adminRpc({ admin: false, superadmin: false, behorigheter: [] })
    });
    await page.goto(BAS + '/admin');
    await page.waitForSelector('#view-nekad:not([hidden])', { timeout: 8000 }).catch(() => {});
    prova('nekad: en förälder utan roll nekas', await synlig(page, '#view-nekad'));
    await context.close();
  }

  /* Inbjudan: vyn ber om ett lösenord. */
  {
    const { context, page, S } = await öppna(webb, {
      inloggad: 'admin-2', rpc: adminRpc({ admin: true, superadmin: false, behorigheter: ['leads'] })
    });
    await page.goto(BAS + '/admin#access_token=' + jwt('admin-2', 'authenticated')
      + '&expires_in=3600&refresh_token=prov-admin-2&token_type=bearer&type=invite');
    await page.waitForSelector('.nx-fraga.open', { timeout: 8000 }).catch(() => {});
    prova('inbjudan: vyn ber om ett lösenord', (await text(page, '.nx-fraga h3')) === 'Välj ditt lösenord', await text(page, '.nx-fraga h3'));
    await page.fill('#ah-los1', 'kort');
    await page.fill('#ah-los2', 'kort');
    await page.click('.nx-fraga [data-fr="ja"]');
    prova('inbjudan: för kort lösenord stoppas', (await text(page, '#fr-msg')).includes('minst 8'));
    await page.fill('#ah-los1', 'ett-langre-losen');
    await page.fill('#ah-los2', 'ett-langre-losen');
    await page.click('.nx-fraga [data-fr="ja"]');
    await vänta(500);
    prova('inbjudan: lösenordet sparas med updateUser', S.logg.some(r => r.väg === '/auth/v1/user' && r.metod === 'PUT'
      && r.kropp && r.kropp.password === 'ett-langre-losen'));
    await context.close();
  }

  /* Admin som också är förälder: studievyn med länken Adminvy. */
  {
    const { context, page } = await öppna(webb, {
      inloggad: 'foralder-1',
      rpc: { mina_behorigheter: () => ({ admin: true, superadmin: false, behorigheter: ['leads'] }), mina_barnkonton: () => [] }
    });
    await page.goto(BAS + '/foralder');
    await page.waitForSelector('#nav-actions a[href="/admin"]', { timeout: 8000 }).catch(() => {});
    prova('förälder och admin: länken Adminvy i sidhuvudet', (await text(page, '#nav-actions a[href="/admin"]')) === 'Adminvy');
    await context.close();
  }
}

/* ============ körningen ============ */
(async function () {
  const server = spawn('python3', [path.join(ROT, '.claude', 'serve.py'), String(PORT)], { stdio: 'ignore' });
  let klar = false;
  for (let i = 0; i < 50 && !klar; i++) {
    try { klar = (await fetch(BAS + '/barn')).ok; } catch (e) { await vänta(100); }
  }
  const webb = await pw.chromium.launch();
  try {
    await provaBarnvyn(webb);
    await provaFamiljensInloggning(webb);
    await provaBarnpanelen(webb);
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
