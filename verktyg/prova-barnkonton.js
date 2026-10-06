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

async function bild(page, namn, sel) {
  if (!BILDER) return;
  fs.mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: path.join(BILDER, namn + '.png'), fullPage: true });
  /* En lång vy blir en lång bild. Med sel sparas också bara den delen,
     som går att läsa utan att leta. */
  if (sel) await page.locator(sel).first().screenshot({ path: path.join(BILDER, namn + '-del.png') }).catch(() => {});
}

const synlig = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);

/* Hälsningen byter bild varje veckodag (2026-10-06). Listan står här
   en gång till, med flit: provet ska se om nextrum-images.js ändrats. */
const VECKODAGAR = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
const DAGENS_BILD = ['hero-nextrum', '01-en-till-en', '03-digital-laxhjalp', '04-sjalvfortroende',
  '02-personlig-anpassning', '07-genombrottet', '09-online-v2'];
async function provaHälsningen(page, vem) {
  const i = (new Date().getDay() + 6) % 7;
  await page.waitForFunction(() => {
    const b = document.querySelector('#vy-hero .vy-hero-still');
    return b && b.complete;
  }, null, { timeout: 5000 }).catch(() => {});
  const dag = (await text(page, '#vy-hero .vy-hero-dag')).trim();
  prova(vem + ': hälsningen säger veckodagen', dag.startsWith(VECKODAGAR[i] + ' '), dag);
  const b = await page.evaluate(() => {
    const el = document.querySelector('#vy-hero .vy-hero-still');
    return el ? { src: el.getAttribute('src'), w: el.naturalWidth, pos: el.style.objectPosition } : null;
  });
  prova(vem + ': dagens bild, och den finns', b && b.src === 'bilder/' + DAGENS_BILD[i] + '-1280.webp' && b.w > 0 && !!b.pos,
    JSON.stringify(b));
  const film = await page.locator('#vy-hero video').count();
  prova(vem + ': filmen bara på måndagen', i === 0 ? true : film === 0, film + ' filmer');
}
const text = (page, sel) => page.locator(sel).first().textContent().catch(() => '');
const vänta = ms => new Promise(r => setTimeout(r, ms));

/* Tummens 44 px mäts i hela pixlar: en sektion som just visats glider in
   (vy-in), och under tiden kan rektangeln bli 43,9999 px för en knapp som
   är 44. */

/* ============ barnets vy ============ */
/* Det enda barnets vy får fråga databasen om (nexlax_for_barnet lade
   till NexLäx, barnets_epost inställningarna och valen). */
const BARNETS_FUNKTIONER = /\/rpc\/(barn_(oversikt|notiser|markera_last|nexlax|uppgift|installningar|notisval)|nexlax_lage|niva_(starta|svara|genomgang))$/;

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
    prova('barn: hälsningen', /^(Godmorgon|Goddag|Godkväll), Alva\.$/.test(await text(page, '#vy-hero h1')), await text(page, '#vy-hero h1'));
    prova('barn: studiehjälparens förnamn', (await text(page, '#vy-hero .vy-hero-lede')).includes('Du pluggar med Sara.'));
    await provaHälsningen(page, 'barn');
    prova('barn: hälsningens kort visar nästa pass', (await text(page, '#vy-hero .vy-hero-kort')).includes('Nästa pass'),
      await text(page, '#vy-hero .vy-hero-kort'));
    const meny = await page.$$eval('#vy-sido a', a => a.filter(x => !x.hidden).map(x => x.textContent.replace(/\d+/g, '').trim()));
    prova('barn: menyn har Översikt, NexLäx, Meddelanden och Profil och inget mer',
      meny.join(',') === 'Översikt,NexLäx,Meddelanden,Profil', meny.join(','));
    prova('barn: Översikt är framme', await synlig(page, 'section[data-sek="oversikt"]'));
    prova('barn: en ny i Meddelanden står i menyn', (await text(page, '#vy-sido a[data-sek="meddelanden"] .vy-sido-mark')) === '1',
      await text(page, '#vy-sido a[data-sek="meddelanden"]'));
    prova('barn: två kommande pass', (await page.locator('#bv-kommande .vy-rad').count()) === 2);
    prova('barn: ett önskat pass väntar på svar', (await text(page, '#bv-kommande')).includes('Väntar på svar'));
    prova('barn: timmarna', (await text(page, '#bv-timmar')).includes('12') && (await text(page, '#bv-timmar')).includes('timme bokade framåt'),
      await text(page, '#bv-timmar'));
    prova('barn: studieplanen', (await text(page, '#bv-plan')).includes('Klara bråk inför provet'));
    prova('barn: genomförda pass', (await page.locator('#bv-genomforda .vy-rad').count()) === 1);
    prova('barn: rapporterna syns inte när föräldern inte slagit på dem', !(await synlig(page, '#bv-rapporter-del')));
    prova('barn: frågan till föräldern står kvar', (await text(page, 'section[data-sek="profil"] .bv-fraga')).trim() === 'Vill du ändra något? Fråga din förälder.');
    prova('barn: text ur databasen ritas som text, inte som html',
      (await page.locator('#view-app img[data-elak]').count()) === 0
      && (await text(page, '#bv-notiser')).includes('<img src=x data-elak=1>'));
    const hela = await page.locator('#view-app').textContent();
    prova('barn: inga priser, inga betalningar, inga länkar ut',
      !/\bkr\b|betal|faktura|erbjud|klippkort|timbank/i.test(hela)
      && (await page.locator('#view-app a:not([href^="#"])').count()) === 0, hela.slice(0, 200));
    prova('barn: bara barnets egna funktioner och Auth frågades',
      S.logg.filter(r => r.väg.startsWith('/rest/')).every(r => BARNETS_FUNKTIONER.test(r.väg)),
      S.logg.filter(r => r.väg.startsWith('/rest/')).map(r => r.väg).join(', '));
    await bild(page, 'barn-vyn-ljus');
    await page.click('#vy-sido a[data-sek="nexlax"]');
    await page.waitForSelector('section[data-sek="nexlax"]:not([hidden])', { timeout: 3000 }).catch(() => {});
    prova('barn: utan barn_nexlax i databasen säger NexLäx det', !(await synlig(page, '#bv-nexlax'))
      && (await text(page, '#bv-nl-tom')).includes('går inte att öppna'), await text(page, '#bv-nl-tom'));

    /* 3. Meddelanden och Läst. */
    await page.click('#vy-sido a[data-sek="meddelanden"]');
    await page.waitForSelector('section[data-sek="meddelanden"]:not([hidden])', { timeout: 3000 }).catch(() => {});
    prova('barn: Meddelanden visar notiserna', await synlig(page, '#bv-notiser .bv-notis'));
    prova('barn: Meddelanden säger hur man frågar studiehjälparen', (await text(page, '#bv-skriva')).includes('be din förälder'));
    await bild(page, 'barn-vyn-meddelanden');
    await page.click('[data-bv-last="notis-1"]');
    await vänta(300);
    const läst = S.logg.find(r => r.väg === '/rest/v1/rpc/barn_markera_last');
    prova('barn: Läst skickar notisens id', läst && läst.kropp && läst.kropp.p_id === 'notis-1', JSON.stringify(läst && läst.kropp));
    prova('barn: den lästa notisen har ingen knapp längre', (await page.locator('[data-bv-last]').count()) === 0);
    prova('barn: siffran i menyn går när den är läst', (await page.locator('#vy-sido .vy-sido-mark').count()) === 0);
    await page.click('#vy-sido a[data-sek="profil"]');
    await page.waitForSelector('section[data-sek="profil"]:not([hidden])', { timeout: 3000 }).catch(() => {});
    prova('barn: Profil utan barn_installningar visar namnet', (await text(page, '#bv-inst')).includes('Alva'), await text(page, '#bv-inst'));
    prova('barn: Profil har Logga ut', await synlig(page, 'section[data-sek="profil"] [data-logout]'));
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
        .filter(b => b.offsetParent).map(b => b.getBoundingClientRect()).filter(r => Math.round(r.height) < 44).length);
      prova(namn + ': tryckytorna är minst 44 px', små === 0, små + ' knappar lägre än 44 px');
      const meny = await page.$$eval('#vy-sido a', a => a.map(x => x.getBoundingClientRect().height).filter(h => Math.round(h) < 44).length);
      prova(namn + ': menyns poster är minst 44 px', meny === 0, meny + ' lägre');
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
  await provaHälsningen(page, 'förälder');
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

/* ============ NexLäx i barnets vy (nexlax_for_barnet, 2026-10-01) ============
   Leo: "Nexläx syns inte i barnens vy". Samma bana och spelare som i
   studievyn, ur barn_nexlax(), och nivåerna startas och rättas med
   barnets eget id. Ingen bedömning och inga pass i Din utveckling. */
function nexlaxRpc(extra) {
  const anrop = [];
  const N1 = { id: 'niva-1', nyckel: 'ma-6-brak-1', amne: 'Matematik', arskurs: 'ak6', omrade: 'Bråk',
               titel: 'Jämför bråk', beskrivning: 'Vilket bråk är störst?', ordning: 1, antal_fragor: 1,
               aktiv: true, sort: 'vanlig', lastext: null };
  const N2 = Object.assign({}, N1, { id: 'niva-2', nyckel: 'ma-6-brak-2', titel: 'Förläng bråk', ordning: 2 });
  const rpc = Object.assign(barnRpc(), {
    barn_nexlax: () => {
      anrop.push(['barn_nexlax']);
      return {
        lage: 'ok', elev: 'barn-1', arskurs: 'Åk 6', amnen: ['Matematik'],
        katalog: [N1, N2], forsok: [], pagaende: {},
        uppgifter: [
          { id: 'lax-1', student_id: 'barn-1', title: 'Läs kapitel 3', instructions: ELAK + 'Sidorna 40 till 45.',
            subject: 'Matematik', due_date: dagar(3), status: 'ej_paborjad', completed_at: null, created_at: nu(-600),
            niva_id: null, bibliotek_id: null, biblioteksmaterial: null, nivaer: null },
          { id: 'lax-2', student_id: 'barn-1', title: 'Gör nivån Jämför bråk', instructions: null,
            subject: 'Matematik', due_date: dagar(4), status: 'ej_paborjad', completed_at: null, created_at: nu(-500),
            niva_id: 'niva-1', bibliotek_id: null, biblioteksmaterial: null,
            nivaer: { id: 'niva-1', titel: 'Jämför bråk', amne: 'Matematik', arskurs: 'ak6', omrade: 'Bråk',
                      beskrivning: 'Vilket bråk är störst?', antal_fragor: 1, aktiv: true } }
        ]
      };
    },
    nexlax_lage: k => {
      anrop.push(['nexlax_lage', k]);
      return { xp: 120, xp_vecka: 40, serie: { nu: 2, basta: 3 }, dagar: [], banor: [],
               uppgifter: { klara: 5, forsta: 6, forsta_ratt: 4 }, idag: dagar(0) };
    },
    niva_starta: k => {
      anrop.push(['niva_starta', k]);
      return { forsok: 'forsok-1',
               niva: { id: 'niva-1', titel: 'Jämför bråk', amne: 'Matematik', omrade: 'Bråk', arskurs: 'ak6', sort: 'vanlig', lastext: null },
               fragor: [{ id: 'fr-1', typ: 'val', fraga: 'Vilket är störst?', alternativ: ['1/2', '1/3'] }], klara: [] };
    },
    niva_svara: k => {
      anrop.push(['niva_svara', k]);
      return { ratt: true, facit: '0', forklaring: 'Halva är mest.', klar: true, xp: 10,
               resultat: { antal: 1, ratt_direkt: 1, stjarnor: 3, godkand: true, forut: 0, klar_at: nu(0),
                           xp_fragor: 10, xp_niva: 50, xp_omrade: 0 } };
    },
    barn_uppgift: k => { anrop.push(['barn_uppgift', k]); return true; }
  }, extra || {});
  return { rpc, anrop };
}

async function provaBarnetsNexlax(webb) {
  {
    const { rpc, anrop } = nexlaxRpc();
    const { context, page, S, riktiga, konsol } = await öppna(webb, { rpc, inloggad: 'barnkonto-1' });
    await page.goto(BAS + '/barn#nexlax');
    await page.waitForSelector('#bv-nexlax:not([hidden])', { timeout: 8000 }).catch(() => {});
    prova('barn nexlax: sektionen syns', await synlig(page, '#bv-nexlax'));
    await page.waitForFunction(() => /Jämför bråk/.test(document.querySelector('#bv-nl-vag').textContent), null, { timeout: 5000 }).catch(() => {});
    const väg = await text(page, '#bv-nl-vag');
    prova('barn nexlax: vägen visar banans nivåer', väg.includes('Jämför bråk'), väg.slice(0, 160));
    prova('barn nexlax: det studiehjälparen gett står på vägen', väg.includes('Läs kapitel 3') && väg.includes('Rekommenderat av Sara'),
      väg.slice(0, 200));
    prova('barn nexlax: text ur databasen ritas som text',
      (await page.locator('#bv-nexlax img[data-elak]').count()) === 0 && väg.includes('<img src=x data-elak=1>'));
    prova('barn nexlax: läget hämtas med barnets id', anrop.some(a => a[0] === 'nexlax_lage' && a[1].p_elev === 'barn-1'),
      JSON.stringify(anrop.filter(a => a[0] === 'nexlax_lage')));
    await bild(page, 'barn-nexlax-vag');

    /* En vanlig uppgift bockas av. */
    await page.click('[data-lax="klar"][data-id="lax-1"]');
    await page.waitForFunction(() => true, null, { timeout: 500 }).catch(() => {});
    await vänta(400);
    const bock = anrop.find(a => a[0] === 'barn_uppgift');
    prova('barn nexlax: Klar bockar av uppgiften med barn_uppgift',
      bock && bock[1].p_id === 'lax-1' && bock[1].p_status === 'klar', JSON.stringify(bock));

    /* En nivå: start, svar, resultat. */
    await page.click('[data-lax-starta="lax-2"]');
    await page.waitForSelector('.upg-spel', { timeout: 5000 }).catch(() => {});
    prova('barn nexlax: spelaren öppnas', await synlig(page, '.upg-spel'));
    const start = anrop.find(a => a[0] === 'niva_starta');
    prova('barn nexlax: nivån startas med barnets eget id', start && start[1].p_niva === 'niva-1' && start[1].p_elev === 'barn-1',
      JSON.stringify(start));
    await page.click('.upg-spel .upg-alt[data-alt="0"]');
    await page.click('.upg-spel [data-spel="kolla"]');
    await page.waitForSelector('.upg-spel [data-spel="vidare"]', { timeout: 5000 }).catch(() => {});
    const svar = anrop.find(a => a[0] === 'niva_svara');
    prova('barn nexlax: svaret rättas i databasen', svar && svar[1].p_forsok === 'forsok-1' && svar[1].p_fraga === 'fr-1'
      && svar[1].p_svar && svar[1].p_svar.val === 0, JSON.stringify(svar));
    await bild(page, 'barn-nexlax-spelaren');
    await page.click('.upg-spel [data-spel="vidare"]');
    await page.waitForSelector('.upg-spel [data-spel="klar"]', { timeout: 5000 }).catch(() => {});
    const före = anrop.filter(a => a[0] === 'barn_nexlax').length;
    await page.click('.upg-spel [data-spel="klar"]');
    await page.waitForFunction(() => !document.querySelector('.upg-spel'), null, { timeout: 5000 }).catch(() => {});
    await vänta(400);
    prova('barn nexlax: spelaren stängs och banan hämtas om', !(await synlig(page, '.upg-spel'))
      && anrop.filter(a => a[0] === 'barn_nexlax').length > före, String(anrop.filter(a => a[0] === 'barn_nexlax').length));

    /* Din utveckling: talen, men ingen bedömning och inga pass. */
    await page.click('#bv-flik-utveckling');
    await page.waitForSelector('#bv-panel-utveckling:not([hidden])', { timeout: 3000 }).catch(() => {});
    const utv = await text(page, '#bv-nl-utveckling');
    prova('barn nexlax: Din utveckling visar XP', utv.includes('XP totalt'), utv.slice(0, 120));
    prova('barn nexlax: ingen bedömning och inga pass i Din utveckling',
      !utv.includes('Studiehjälparens bedömning') && !utv.includes('Med studiehjälparen'), utv.slice(0, 200));
    prova('barn nexlax: flikarna säger vilken som är vald',
      (await page.getAttribute('#bv-flik-utveckling', 'aria-selected')) === 'true'
      && (await page.getAttribute('#bv-flik-vag', 'aria-selected')) === 'false' && !(await synlig(page, '#bv-panel-vag')));
    await bild(page, 'barn-nexlax-utveckling');

    const hela = await page.locator('#view-app').textContent();
    prova('barn nexlax: inga priser, inga betalningar, inga länkar ut',
      !/\bkr\b|betal|faktura|erbjud|klippkort|timbank/i.test(hela) && (await page.locator('#view-app a:not([href^="#"])').count()) === 0,
      hela.slice(0, 160));
    prova('barn nexlax: bara barnets egna funktioner frågades',
      S.logg.filter(r => r.väg.startsWith('/rest/')).every(r => BARNETS_FUNKTIONER.test(r.väg)),
      S.logg.filter(r => r.väg.startsWith('/rest/')).map(r => r.väg).join(', '));
    prova('barn nexlax: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
    const fel = konsol.filter(t => !/Failed to load resource/.test(t));
    prova('barn nexlax: inga fel i konsolen', fel.length === 0, fel.join(' | ').slice(0, 300));
    await context.close();
  }

  /* Telefonen, ljust och mörkt: vägen får plats och tummen når. */
  for (const [namn, context] of [
    ['barn-nexlax-telefon', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
    ['barn-nexlax-telefon-mork', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark' }]
  ]) {
    const { rpc } = nexlaxRpc();
    const { context: c, page } = await öppna(webb, { rpc, inloggad: 'barnkonto-1', context });
    await page.goto(BAS + '/barn#nexlax');
    await page.waitForSelector('#bv-nexlax:not([hidden])', { timeout: 8000 }).catch(() => {});
    await page.waitForFunction(() => /Jämför bråk/.test(document.querySelector('#bv-nl-vag').textContent), null, { timeout: 5000 }).catch(() => {});
    const bredd = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    prova(namn + ': ingen sidledsscroll', bredd <= 0, bredd + ' px');
    const små = await page.evaluate(() => Array.from(document.querySelectorAll('#bv-nexlax button'))
      .filter(b => b.offsetParent).map(b => ({ t: b.textContent.trim().slice(0, 20), h: b.getBoundingClientRect().height }))
      .filter(r => Math.round(r.h) < 44));
    prova(namn + ': tryckytorna i NexLäx är minst 44 px', små.length === 0, JSON.stringify(små).slice(0, 200));
    await bild(page, namn);
    await c.close();
  }
}

/* ============ e-post eller användarnamn, i varje inloggning (2026-10-01) ============
   Logga in på sajten leder till studievyn, och där prövades det första
   riktiga barnkontot. Varje inloggning tar e-post eller användarnamn:
   ett barn hamnar i sin vy, en vuxen i sin, och barnkontots tekniska
   adress nekas utan fråga till Auth. */
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
    const roller = await page.$$eval('.vy-roll b', b => b.map(x => x.textContent.trim()));
    prova('familjen: rollvalet är Förälder, Elev och Studiehjälpare', roller.join(',') === 'Förälder,Elev,Studiehjälpare', roller.join(','));
    prova('familjen: Elev leder till barnets inloggning', (await page.getAttribute('.vy-roll:nth-child(2)', 'href')) === '/barn');
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
    prova('familjen: barnets vy öppnas inloggad', /, Alva\.$/.test(await text(page, '#vy-hero h1')), await text(page, '#vy-hero h1'));
    const familjens = S.logg.filter(r => /^\/rest\/v1\/(profiles|students|bookings|lesson_reports)/.test(r.väg));
    prova('familjen: inget av familjens hämtades', familjens.length === 0, familjens.map(r => r.väg).join(', '));
    prova('familjen: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
    await context.close();
  }

  /* 3. Barnkontots tekniska adress nekas i alla fyra, utan fråga till
     Auth: ett barn loggar bara in med användarnamnet. */
  for (const [vy, fält, knapp] of [['/foralder', '#a-email', '#auth-submit'], ['/larare', '#a-email', '#auth-submit'],
                                   ['/admin', '#a-email', '#auth-submit'], ['/barn', '#bv-anv', '#bv-logga-in']]) {
    const { context, page, S } = await öppna(webb, { rpc: barnRpc() });
    await page.goto(BAS + vy);
    await page.waitForSelector('#view-auth:not([hidden])', { timeout: 8000 }).catch(() => {});
    await page.fill(fält, 'Alva.A@barn.nextrum.se');
    await page.fill('#a-pass', 'alva-losen-1');
    await page.click(knapp);
    await page.waitForFunction(() => document.querySelector('#auth-msg').textContent.length > 0, null, { timeout: 5000 }).catch(() => {});
    prova(vy.slice(1) + ': barnkontots tekniska adress nekas',
      (await text(page, '#auth-msg')).trim() === 'Fel e-post eller lösenord.' && page.url().endsWith(vy),
      (await text(page, '#auth-msg')) + ' ' + page.url());
    prova(vy.slice(1) + ': och Auth tillfrågas inte', !S.logg.some(r => r.väg === '/auth/v1/token'));
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

  /* 6. Studiehjälparvyn och adminvyn tar också ett användarnamn, fast
     fältet heter E-post där: ingen vuxen har ett. Barnet hamnar på /barn. */
  for (const vy of ['/larare', '/admin']) {
    const { context, page, S } = await öppna(webb, { rpc: barnRpc() });
    await page.goto(BAS + vy);
    await page.waitForSelector('#view-auth:not([hidden])', { timeout: 8000 }).catch(() => {});
    prova(vy.slice(1) + ': fältet heter E-post', (await text(page, 'label[for="a-email"]')) === 'E-post');
    await page.fill('#a-email', 'alva.a');
    await page.fill('#a-pass', 'alva-losen-1');
    await page.click('#auth-submit');
    await page.waitForURL(/\/barn$/, { timeout: 5000 }).catch(() => {});
    const försök = S.logg.filter(r => r.väg === '/auth/v1/token').pop();
    prova(vy.slice(1) + ': ett användarnamn loggar in barnet och leder till /barn',
      /\/barn$/.test(page.url()) && försök && försök.kropp && försök.kropp.email === 'alva.a@barn.nextrum.se',
      page.url() + ' ' + JSON.stringify(försök && försök.kropp));
    await context.close();
  }
  {
    const { context, page, S } = await öppna(webb, {});
    await page.goto(BAS + '/larare');
    await page.waitForSelector('#view-auth:not([hidden])', { timeout: 8000 }).catch(() => {});
    await page.click('[data-glomt] button');
    await page.fill('#a-email', 'alva.a');
    await page.click('#auth-submit');
    await page.waitForFunction(() => document.querySelector('#auth-msg').textContent.length > 0, null, { timeout: 5000 }).catch(() => {});
    prova('studiehjälpare: ett användarnamn i Glömt lösenordet får förälderbeskedet',
      (await text(page, '#auth-msg')).startsWith('Ett barns lösenord'), await text(page, '#auth-msg'));
    await page.fill('#a-email', 'sara svensson');
    await page.click('#auth-submit');
    await page.waitForFunction(() => /Kontrollera/.test(document.querySelector('#auth-msg').textContent), null, { timeout: 5000 }).catch(() => {});
    prova('studiehjälpare: något som varken är adress eller användarnamn stoppas',
      (await text(page, '#auth-msg')).startsWith('Kontrollera e-postadressen'), await text(page, '#auth-msg'));
    prova('studiehjälpare: och inget mejl begärs', !S.logg.some(r => r.väg === '/auth/v1/recover'));
    await context.close();
  }

  /* 7. Barnets vy tar också en vuxens e-post, och den vuxne hamnar i sin
     egen vy. Inte genom en länk: det krävs den vuxnes lösenord. */
  {
    const { context, page, S } = await öppna(webb, { rpc: Object.assign(barnRpc(), { mina_barnkonton: () => [] }) });
    await page.goto(BAS + '/barn');
    await page.waitForSelector('#view-auth:not([hidden])');
    await page.fill('#bv-anv', 'anna@example.se');
    await page.fill('#a-pass', 'fel');
    await page.click('#bv-logga-in');
    await page.waitForFunction(() => document.querySelector('#auth-msg').textContent.length > 0, null, { timeout: 5000 }).catch(() => {});
    prova('barn: en vuxens e-post med fel lösenord får vuxnas besked',
      (await text(page, '#auth-msg')).trim() === 'Fel e-post eller lösenord.' && (await page.inputValue('#a-pass')) === '',
      await text(page, '#auth-msg'));
    await page.fill('#a-pass', 'anna-losen');
    await page.click('#bv-logga-in');
    await page.waitForURL(/\/foralder$/, { timeout: 5000 }).catch(() => {});
    prova('barn: en vuxens e-post leder till den vuxnes vy', /\/foralder$/.test(page.url()), page.url());
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
    prova('barn: och den vuxne är inloggad där', await synlig(page, '#view-app'));
    const barnets = S.logg.filter(r => /\/rpc\/barn_/.test(r.väg));
    prova('barn: barnets funktioner frågades aldrig med den vuxnes inloggning', barnets.length === 0, barnets.map(r => r.väg).join(', '));
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

/* ============ barnets egen e-post (barnets_epost, 2026-10-01) ============
   Föräldern lägger till adressen och styr mejlen, barnet bekräftar med
   länken och väljer bort det hen inte vill ha, och barnet loggar in med
   adressen genom barn-inloggning. Databasens regler provas i
   rls-test.sql avsnitt 15; här provas det en människa ser och vad som
   skickas. */
const KOD = 'barn-1.' + 'A'.repeat(43);

function epostRad(o) {
  return Object.assign({ barn_id: 'barn-1', epost: 'alva@example.org', bekraftad: null, notiser: false,
                         skickad: nu(-5), gammal: false }, o || {});
}

async function provaBarnetsEpost(webb) {
  const konton = [
    { barn_id: 'barn-1', anvandarnamn: 'alva.a', barn_aktiv: true, visa_rapporter: false,
      vardnadshavare_godkand_at: '2026-09-30T10:00:00Z', senast_inloggad: '2026-09-30T15:30:00Z' },
    { barn_id: 'barn-2', anvandarnamn: null, barn_aktiv: true, visa_rapporter: false,
      vardnadshavare_godkand_at: null, senast_inloggad: null }
  ];

  /* 1. Föräldern: lägger till, skickar igen, får databasens besked. */
  {
    const läge = { pa: true, rad: { barn_id: 'barn-1' }, igenFel: false };
    const { context, page, S, riktiga } = await öppna(webb, {
      inloggad: 'foralder-1',
      rpc: {
        mina_barnkonton: () => konton,
        mina_barns_epost: () => ({ pa: läge.pa, barn: [läge.rad] }),
        barn_epost_satt: k => { läge.rad = epostRad({ epost: String(k.p_epost).trim().toLowerCase() }); return läge.rad; },
        barn_epost_skicka_igen: () => läge.igenFel
          ? { __fel: { code: 'P0001', message: 'Vänta en minut innan du skickar ett nytt bekräftelsemejl.' } } : läge.rad,
        barn_epost_notiser: k => { läge.rad.notiser = k.p_pa; return läge.rad; },
        barn_epost_ta_bort: () => { läge.rad = { barn_id: 'barn-1' }; return null; }
      }
    });
    await page.goto(BAS + '/foralder#profil/barn');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
    const flik = page.locator('section[data-sek="profil"] .vy-flik[data-flik="barn"]');
    if (await flik.count()) await flik.click();
    await page.waitForSelector('.bi-kort[data-bi="barn-1"] .bi-epost', { timeout: 5000 }).catch(() => {});
    const alva = '.bi-kort[data-bi="barn-1"]';
    prova('e-post förälder: Alva har en ruta för e-post, med fältet', await synlig(page, alva + ' [data-bi-epost]'));
    prova('e-post förälder: ett barn utan inloggning har ingen', (await page.locator('.bi-kort[data-bi="barn-2"] .bi-epost').count()) === 0);
    prova('e-post förälder: rutan säger att barnet bekräftar först och att lösenordet är förälderns',
      /trycker på först/.test(await text(page, alva + ' .bi-epost')) && /det styr ni/.test(await text(page, alva + ' .bi-epost')));
    await bild(page, 'epost-foralder-tom', alva);

    await page.fill(alva + ' [data-bi-epost]', 'inte en adress');
    await page.click(alva + ' [data-bi-epostform] button[type="submit"]');
    prova('e-post förälder: något som inte är en adress stoppas i rutan',
      (await text(page, '#bi-msg')).includes('inte ut som en e-postadress') && !S.logg.some(r => /barn_epost_satt/.test(r.väg)),
      await text(page, '#bi-msg'));

    await page.fill(alva + ' [data-bi-epost]', '  Alva@Example.org ');
    await page.click(alva + ' [data-bi-epostform] button[type="submit"]');
    await page.waitForFunction(() => /skickat en länk/.test(document.querySelector('#bi-msg').textContent), null, { timeout: 5000 }).catch(() => {});
    const satt = S.logg.find(r => /\/rpc\/barn_epost_satt$/.test(r.väg));
    prova('e-post förälder: Lägg till skickar barnet och adressen',
      satt && satt.kropp && satt.kropp.p_barn === 'barn-1' && satt.kropp.p_epost === 'Alva@Example.org', JSON.stringify(satt && satt.kropp));
    prova('e-post förälder: beskedet säger vart länken gick',
      (await text(page, '#bi-msg')).includes('alva@example.org'), await text(page, '#bi-msg'));
    prova('e-post förälder: läget är Väntar, med Skicka igen, Byt och Ta bort',
      /Väntar på att Alva trycker/.test(await text(page, alva + ' .bi-epost'))
      && await synlig(page, alva + ' [data-bi-epost-igen]') && await synlig(page, alva + ' [data-bi-epost-byt]')
      && await synlig(page, alva + ' [data-bi-epost-bort]') && !(await synlig(page, alva + ' [data-bi-epost-mejl]')),
      await text(page, alva + ' .bi-epost'));
    await bild(page, 'epost-foralder-vantar', alva);

    läge.igenFel = true;
    await page.click(alva + ' [data-bi-epost-igen]');
    await page.waitForFunction(() => /Vänta en minut/.test(document.querySelector('#bi-msg').textContent), null, { timeout: 5000 }).catch(() => {});
    prova('e-post förälder: databasens besked visas som det är',
      (await text(page, '#bi-msg')).trim() === 'Vänta en minut innan du skickar ett nytt bekräftelsemejl.', await text(page, '#bi-msg'));

    /* Bekräftad: mejlen kan slås på. */
    läge.rad = epostRad({ bekraftad: nu(-1) });
    await page.click(alva + ' [data-bi-epost-byt]');
    await page.click(alva + ' [data-bi-epost-byt]');
    await page.waitForSelector(alva + ' [data-bi-epost-mejl]', { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => document.querySelector('#bi-msg').textContent = '');
    /* Rutan läses om efter en ändring; Byt och Avbryt ritar bara om. Ladda om. */
    await page.reload();
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
    if (await flik.count()) await flik.click();
    await page.waitForSelector(alva + ' [data-bi-epost-mejl]', { timeout: 5000 }).catch(() => {});
    prova('e-post förälder: bekräftad adress har valet Mejl till Alva, avslaget',
      (await page.getAttribute(alva + ' [data-bi-epost-mejl]', 'aria-pressed').catch(() => null)) === 'false'
      && /Bekräftad/.test(await text(page, alva + ' .bi-epost')));
    await page.click(alva + ' [data-bi-epost-mejl]');
    await page.waitForFunction(sel => document.querySelector(sel) && document.querySelector(sel).getAttribute('aria-pressed') === 'true',
      alva + ' [data-bi-epost-mejl]', { timeout: 5000 }).catch(() => {});
    const not = S.logg.filter(r => /\/rpc\/barn_epost_notiser$/.test(r.väg)).pop();
    prova('e-post förälder: Mejl till Alva skickar barnet och på',
      not && not.kropp && not.kropp.p_barn === 'barn-1' && not.kropp.p_pa === true, JSON.stringify(not && not.kropp));
    await bild(page, 'epost-foralder-bekraftad', alva);

    page.removeAllListeners('dialog');
    await page.click(alva + ' [data-bi-epost-bort]');
    await page.waitForSelector('.nx-fraga.open', { timeout: 3000 }).catch(() => {});
    prova('e-post förälder: Ta bort adressen frågar först', await synlig(page, '.nx-fraga'));
    await page.click('.nx-fraga [data-svar="ja"]');
    await page.waitForFunction(() => /borttagen/.test(document.querySelector('#bi-msg').textContent), null, { timeout: 5000 }).catch(() => {});
    prova('e-post förälder: adressen tas bort, och fältet är tillbaka',
      S.logg.some(r => /\/rpc\/barn_epost_ta_bort$/.test(r.väg) && r.kropp && r.kropp.p_barn === 'barn-1')
      && await synlig(page, alva + ' [data-bi-epost]'));
    prova('e-post förälder: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
    await context.close();
  }

  /* 2. Föräldern i telefon, och med flaggan av. */
  {
    const { context, page } = await öppna(webb, {
      inloggad: 'foralder-1',
      context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
      rpc: { mina_barnkonton: () => konton, mina_barns_epost: () => ({ pa: true, barn: [epostRad({ bekraftad: nu(-1), notiser: true })] }) }
    });
    await page.goto(BAS + '/foralder#profil/barn');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
    const flik = page.locator('section[data-sek="profil"] .vy-flik[data-flik="barn"]');
    if (await flik.count()) await flik.click();
    await page.waitForSelector('.bi-epost', { timeout: 5000 }).catch(() => {});
    const bredd = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    prova('e-post förälder telefon: ingen sidledsscroll', bredd <= 0, bredd + ' px');
    const små = await page.evaluate(() => Array.from(document.querySelectorAll('.bi-epost button'))
      .filter(b => b.offsetParent).map(b => b.getBoundingClientRect()).filter(r => Math.round(r.height) < 44).length);
    prova('e-post förälder telefon: knapparna är minst 44 px', små === 0, små + ' lägre');
    await page.locator('.bi-epost').first().scrollIntoViewIfNeeded().catch(() => {});
    await bild(page, 'epost-foralder-telefon', '.bi-kort[data-bi="barn-1"]');
    await context.close();
  }
  for (const [namn, rad, väntat] of [
    ['flaggan av utan adress', { barn_id: 'barn-1' }, 0],
    ['flaggan av med en adress', epostRad({ bekraftad: nu(-1), notiser: true }), 1]
  ]) {
    const { context, page } = await öppna(webb, {
      inloggad: 'foralder-1',
      rpc: { mina_barnkonton: () => konton, mina_barns_epost: () => ({ pa: false, barn: [rad] }) }
    });
    await page.goto(BAS + '/foralder#profil/barn');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
    const flik = page.locator('section[data-sek="profil"] .vy-flik[data-flik="barn"]');
    if (await flik.count()) await flik.click();
    await page.waitForSelector('#bi-ruta:not([hidden])', { timeout: 5000 }).catch(() => {});
    await vänta(200);
    const rutor = await page.locator('.bi-epost').count();
    const knappar = await page.locator('.bi-epost button').count();
    prova('e-post förälder, ' + namn + ': ' + (väntat ? 'bara Ta bort adressen' : 'ingen ruta'),
      rutor === väntat && (väntat === 0 || (knappar === 1 && await synlig(page, '[data-bi-epost-bort]'))),
      rutor + ' rutor, ' + knappar + ' knappar');
    await context.close();
  }

  /* 3. Barnets inställningar. */
  const inst = o => Object.assign({ lage: 'ok', fornamn: 'Alva', anvandarnamn: 'alva.a', pa: true,
    epost: 'alva@example.org', bekraftad: '2026-10-01T10:00:00Z', notiser: true,
    typer: [{ typ: 'barn_pass_bokat', pa: true }, { typ: 'barn_pass_avbokat', pa: true }, { typ: 'barn_paminnelse', pa: false }] }, o || {});
  {
    let val = inst();
    const { context, page, S } = await öppna(webb, {
      inloggad: 'barnkonto-1',
      rpc: barnRpc({
        barn_installningar: () => val,
        barn_notisval: k => {
          val = inst({ typer: val.typer.map(t => t.typ === k.p_typ ? { typ: t.typ, pa: k.p_pa } : t) });
          return val;
        }
      })
    });
    await page.goto(BAS + '/barn#installningar');
    await page.waitForSelector('section[data-sek="profil"]:not([hidden])', { timeout: 5000 }).catch(() => {});
    prova('e-post barnet: Inställningar syns, med användarnamnet och adressen',
      (await text(page, '#bv-inst')).includes('alva.a') && (await text(page, '#bv-inst')).includes('alva@example.org'),
      await text(page, '#bv-inst'));
    const tryck = await page.$$eval('#bv-inst [data-bv-val]', b => b.map(x => x.getAttribute('aria-pressed')).join(','));
    prova('e-post barnet: tre sorter, med barnets val', tryck === 'true,true,false', tryck);
    /* Sidan är för kort för att sektionen ska nå toppen; den ska synas,
       och rubriken ska inte ligga under sidhuvudet. */
    const [topp, rullat, höjd] = await page.evaluate(() =>
      [document.querySelector('#installningar').getBoundingClientRect().top, window.scrollY, window.innerHeight]);
    prova('e-post barnet: länken Ändra dina val går till inställningarna', rullat > 0 && topp >= 70 && topp < höjd - 100
      && await synlig(page, 'section[data-sek="profil"]') && (await page.evaluate(() => location.hash)) === '#profil',
      topp + ' px, rullat ' + rullat);
    await page.click('#bv-inst [data-bv-val="barn_pass_bokat"]');
    await page.waitForFunction(() => document.querySelector('#bv-inst [data-bv-val="barn_pass_bokat"]').getAttribute('aria-pressed') === 'false',
      null, { timeout: 5000 }).catch(() => {});
    const v = S.logg.filter(r => /\/rpc\/barn_notisval$/.test(r.väg)).pop();
    prova('e-post barnet: ett val skickar sorten och av',
      v && v.kropp && v.kropp.p_typ === 'barn_pass_bokat' && v.kropp.p_pa === false, JSON.stringify(v && v.kropp));
    prova('e-post barnet: bara barnets egna funktioner frågades',
      S.logg.filter(r => r.väg.startsWith('/rest/')).every(r => BARNETS_FUNKTIONER.test(r.väg)),
      S.logg.filter(r => r.väg.startsWith('/rest/')).map(r => r.väg).join(', '));
    await bild(page, 'epost-barnet-installningar', '#installningar');
    await context.close();
  }
  for (const [namn, o, koll] of [
    ['flaggan av', { pa: false, epost: null, bekraftad: null, notiser: false },
      async page => !(await text(page, '#bv-inst')).includes('E-post') && (await page.locator('#bv-inst [data-bv-val]').count()) === 0],
    ['obekräftad adress', { bekraftad: null, notiser: false },
      async page => /väntar på att du bekräftar/.test(await text(page, '#bv-inst'))
        && (await page.$$eval('#bv-inst [data-bv-val]', b => b.every(x => x.disabled)))],
    ['föräldern har inte slagit på mejlen', { notiser: false },
      async page => /inte slagit på mejl/.test(await text(page, '#bv-inst'))
        && (await page.$$eval('#bv-inst [data-bv-val]', b => b.every(x => !x.disabled)))]
  ]) {
    const { context, page } = await öppna(webb, { inloggad: 'barnkonto-1', rpc: barnRpc({ barn_installningar: () => inst(o) }) });
    await page.goto(BAS + '/barn#profil');
    await page.waitForSelector('section[data-sek="profil"]:not([hidden])', { timeout: 5000 }).catch(() => {});
    prova('e-post barnet, ' + namn, await koll(page), await text(page, '#bv-inst'));
    await context.close();
  }
  for (const [namn, context] of [
    ['epost-barnet-telefon', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
    ['epost-barnet-telefon-mork', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark' }]
  ]) {
    const { context: c, page } = await öppna(webb, { inloggad: 'barnkonto-1', context, rpc: barnRpc({ barn_installningar: () => inst() }) });
    await page.goto(BAS + '/barn#profil');
    await page.waitForSelector('section[data-sek="profil"]:not([hidden])', { timeout: 5000 }).catch(() => {});
    const bredd = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    prova(namn + ': ingen sidledsscroll', bredd <= 0, bredd + ' px');
    const små = await page.evaluate(() => Array.from(document.querySelectorAll('#installningar button'))
      .filter(b => b.offsetParent).map(b => ({ t: b.textContent.trim(), h: b.getBoundingClientRect().height,
        o: b.offsetHeight })).filter(r => Math.round(r.h) < 44));
    prova(namn + ': valen är minst 44 px', små.length === 0, JSON.stringify(små));
    await page.locator('#installningar').scrollIntoViewIfNeeded().catch(() => {});
    await bild(page, namn, '#installningar');
    await c.close();
  }

  /* 4. Länken i bekräftelsemejlet. */
  for (const [svar, rubrik] of [['ok', 'Klart, din e-post är bekräftad'], ['gammal', 'Länken har gått ut'],
                                ['upptagen', 'Adressen används redan'], ['ogiltig', 'Länken gäller inte']]) {
    const { context, page, S } = await öppna(webb, { rpc: { barn_epost_bekrafta: () => svar } });
    await page.goto(BAS + '/barn?bekrafta=' + encodeURIComponent(KOD));
    await page.waitForSelector('#view-bekrafta:not([hidden])', { timeout: 5000 }).catch(() => {});
    if (svar === 'ok') {
      prova('e-post länken: vyn Bekräfta visas utan inloggning', await synlig(page, '#bv-bek-knapp'));
      prova('e-post länken: koden tas ur adressen direkt', !page.url().includes('bekrafta'), page.url());
      prova('e-post länken: ingenting bekräftas innan knappen trycks', !S.logg.some(r => /barn_epost_bekrafta/.test(r.väg)));
      await bild(page, 'epost-lanken');
    }
    await page.click('#bv-bek-knapp');
    await page.waitForFunction(r => document.querySelector('#bv-bek-rubrik').textContent === r, rubrik, { timeout: 5000 }).catch(() => {});
    const anrop = S.logg.find(r => /\/rpc\/barn_epost_bekrafta$/.test(r.väg));
    prova('e-post länken, ' + svar + ': rätt besked, och koden skickades som den var',
      (await text(page, '#bv-bek-rubrik')) === rubrik && anrop && anrop.kropp && anrop.kropp.p_kod === KOD
      && !(await synlig(page, '#bv-bek-knapp')), (await text(page, '#bv-bek-rubrik')) + ' ' + JSON.stringify(anrop && anrop.kropp));
    if (svar === 'ok') await bild(page, 'epost-lanken-klar');
    await context.close();
  }
  {
    const { context, page } = await öppna(webb, { inloggad: 'foralder-1', rpc: { barn_epost_bekrafta: () => 'ok' } });
    await page.goto(BAS + '/barn?bekrafta=' + encodeURIComponent(KOD));
    await page.waitForSelector('#view-bekrafta:not([hidden])', { timeout: 5000 }).catch(() => {});
    prova('e-post länken: fungerar också när en vuxen är inloggad i webbläsaren',
      (await synlig(page, '#bv-bek-knapp')) && !(await synlig(page, '#view-annan')));
    await context.close();
  }

  /* 5. Barnet loggar in med sin adress. */
  const barnInlogg = (ref, utfall) => kropp => {
    ref.anrop.push(kropp);
    if (utfall === 'ok') {
      ref.S.inloggad.id = 'barnkonto-1';
      const s = ref.S.session('barnkonto-1');
      return [200, { access_token: s.access_token, refresh_token: s.refresh_token, expires_in: 3600,
                     expires_at: s.expires_at, token_type: 'bearer' }];
    }
    if (utfall === 'tak') return [429, { error: 'För många försök. Vänta en stund och försök igen.' }];
    return [400, { error: 'Fel e-post eller lösenord.' }];
  };
  for (const [vy, fält, knapp] of [['/barn', '#bv-anv', '#bv-logga-in'], ['/foralder', '#a-email', '#auth-submit']]) {
    const ref = { anrop: [] };
    const o = { rpc: Object.assign(barnRpc(), { mina_barnkonton: () => [] }), funktioner: { 'barn-inloggning': barnInlogg(ref, 'ok') } };
    const { context, page, S } = await öppna(webb, o);
    ref.S = S;
    await page.goto(BAS + vy);
    await page.waitForSelector('#view-auth:not([hidden])', { timeout: 8000 }).catch(() => {});
    await page.fill(fält, ' Alva@Example.org ');
    await page.fill('#a-pass', 'alva-losen-1');
    await page.click(knapp);
    await page.waitForURL(/\/barn$/, { timeout: 5000 }).catch(() => {});
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 5000 }).catch(() => {});
    prova('e-post inloggning ' + vy + ': barnets adress öppnar barnets vy',
      /\/barn$/.test(page.url()) && /, Alva\.$/.test(await text(page, '#vy-hero h1')), page.url() + ' ' + await text(page, '#vy-hero h1'));
    prova('e-post inloggning ' + vy + ': Auth först, sedan barn-inloggning med adressen och lösenordet',
      ref.anrop.length === 1 && ref.anrop[0].epost === 'Alva@Example.org' && ref.anrop[0].losenord === 'alva-losen-1'
      && S.logg.some(r => r.väg === '/auth/v1/token' && r.kropp && r.kropp.email === 'Alva@Example.org'),
      JSON.stringify(ref.anrop));
    await context.close();
  }
  for (const [utfall, besked] of [['fel', 'Fel e-post eller lösenord.'], ['tak', 'För många försök. Vänta en stund och försök igen.']]) {
    const ref = { anrop: [] };
    const { context, page, S } = await öppna(webb, { rpc: barnRpc(), funktioner: { 'barn-inloggning': barnInlogg(ref, utfall) } });
    ref.S = S;
    await page.goto(BAS + '/barn');
    await page.waitForSelector('#view-auth:not([hidden])');
    await page.fill('#bv-anv', 'alva@example.org');
    await page.fill('#a-pass', 'fel');
    await page.click('#bv-logga-in');
    await page.waitForFunction(() => document.querySelector('#auth-msg').textContent.length > 0, null, { timeout: 5000 }).catch(() => {});
    prova('e-post inloggning, ' + utfall + ': ' + besked,
      (await text(page, '#auth-msg')).trim() === besked && (await synlig(page, '#view-auth')), await text(page, '#auth-msg'));
    await context.close();
  }
  {
    /* En förälder med rätt lösenord når aldrig barn-inloggning; med fel
       provas adressen också som ett barns, och beskedet är detsamma. */
    const ref = { anrop: [] };
    const { context, page, S } = await öppna(webb, { rpc: { mina_barnkonton: () => [] },
      funktioner: { 'barn-inloggning': barnInlogg(ref, 'fel') } });
    ref.S = S;
    await page.goto(BAS + '/foralder');
    await page.waitForSelector('#view-auth:not([hidden])', { timeout: 8000 }).catch(() => {});
    await page.fill('#a-email', 'anna@example.se');
    await page.fill('#a-pass', 'fel');
    await page.click('#auth-submit');
    await page.waitForFunction(() => document.querySelector('#auth-msg').textContent.length > 0, null, { timeout: 5000 }).catch(() => {});
    prova('e-post inloggning: en förälders fel lösenord provas som barnadress, med samma besked',
      ref.anrop.length === 1 && (await text(page, '#auth-msg')).trim() === 'Fel e-post eller lösenord.', await text(page, '#auth-msg'));
    await page.fill('#a-pass', 'anna-losen');
    await page.click('#auth-submit');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
    prova('e-post inloggning: rätt lösenord når aldrig barn-inloggning', ref.anrop.length === 1 && (await synlig(page, '#view-app')));
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
    await provaBarnetsNexlax(webb);
    await provaFamiljensInloggning(webb);
    await provaBarnpanelen(webb);
    await provaBarnetsEpost(webb);
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
