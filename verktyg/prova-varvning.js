/* ============================================================
   NEXTRUM — webbläsarprov för värvningsbonusen (varvningsbonus,
   2026-10-21)

       NODE_PATH="$(npm root -g)" node verktyg/prova-varvning.js [mapp för bilder]

   Leo: koden i jobbansökan (fältet och ?kod=), prövad på servern, där en
   kod som inte gäller ger ett tydligt besked och lämnas tom men aldrig
   stoppar ansökan; kortet "Värva en kompis" i studiehjälparvyn med koden,
   länken, beloppet ur inställningen och de värvade med bara läget (och
   förnamnet först när kontot finns); och sektionen Värvningsbonus i
   adminvyn med filter, Markera utbetald (lönemånaden krävs), Annullera
   (skälet krävs), summeringen per värvare och månad och CSV.

   Databasens regler (raden, intjänandet en gång, egen kod, samma person,
   den som sökt förut, lägena, att ingen klient skriver, delningen och
   inställningen) provas i rls-test.sql (avsnitt 31 och 52), och sektionen
   mot en riktig databas i prova-adminvyn.js. Här provas vyerna, mot en
   falsk Supabase (egen port, 8984). Ett anrop till den riktiga adressen
   fäller provet. Namn ur databasen ska stå som text, aldrig som HTML.
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
const PORT = 8984;
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
const IDAG = sthlm(new Date());
const DENNA = IDAG.slice(0, 7);
const FÖRRA = (() => {
  const [år, mån] = IDAG.split('-').map(Number);
  return mån === 1 ? (år - 1) + '-12' : år + '-' + String(mån - 1).padStart(2, '0');
})();

function jwt(sub, roll) {
  const b = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  return b({ alg: 'HS256', typ: 'JWT' }) + '.' + b({ sub, role: roll, exp: 4102444800 }) + '.provet';
}
const ADMIN = { id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'leo@example.se',
  app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-09-01T10:00:00Z' };
const SARA = { id: 'sh-a', aud: 'authenticated', role: 'authenticated', email: 'sara@example.se',
  app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-09-01T10:00:00Z' };

/* Ett namn som är HTML: det ska stå som text överallt. */
const ELAK = '<img src=x onerror="window.__xss=1">Mio';

function värld() {
  return {
    profiles: [
      { id: 'admin-1', role: 'parent', full_name: 'Leo Admin', email: 'leo@example.se', is_admin: true,
        match_status: 'pending', created_at: '2026-09-01T10:00:00Z' },
      { id: 'sh-a', role: 'tutor', full_name: 'Sara Ahl', email: 'sara@example.se', is_admin: false,
        created_at: '2026-09-01T10:00:00Z' },
      { id: 'sh-b', role: 'tutor', full_name: 'Bo Berg', email: 'bo@example.se', is_admin: false,
        created_at: '2026-09-01T10:00:00Z' },
      { id: 'sh-v', role: 'tutor', full_name: 'Vera Värvad', email: 'vera@example.se', is_admin: false,
        created_at: '2026-10-02T10:00:00Z' },
      { id: 'sh-m', role: 'tutor', full_name: ELAK, email: 'mio@example.se', is_admin: false,
        created_at: '2026-09-20T10:00:00Z' }
    ],
    tutor_profiles: ['sh-a', 'sh-b', 'sh-v', 'sh-m'].map(id => ({ id, status: 'approved', hourly_rate: 150,
      subjects: ['Matematik'], grade_levels: [], formats: [], created_at: '2026-09-01T10:00:00Z' })),
    applications: [
      { id: 'ans-v', name: 'Vera Värvad', email: 'vera@example.se', status: 'approved', konto_id: 'sh-v', kod: 'SHAAAAAA',
        varvad_av_profil_id: 'sh-a', created_at: FÖRRA + '-02T09:00:00Z', tjanster: ['laxhjalp'] },
      { id: 'ans-k', name: 'Kim Kompis', email: 'kim@example.se', status: 'new', kod: 'SHAAAAAA', varvad_av_profil_id: 'sh-a',
        created_at: nu(-600), tjanster: ['laxhjalp'] },
      { id: 'ans-m', name: ELAK, email: 'mio@example.se', status: 'approved', konto_id: 'sh-m', kod: 'SHBBBBBB',
        varvad_av_profil_id: 'sh-b', created_at: '2026-09-18T09:00:00Z', tjanster: ['laxhjalp'] },
      { id: 'ans-t', name: 'Tea Tidig', email: 'tea@example.se', status: 'new', kod: 'SHAAAAAA', varvad_av_profil_id: 'sh-a',
        created_at: nu(-300), tjanster: ['laxhjalp'] }
    ],
    varvningsbonus: [
      { id: 'vb-1', varvare_profil_id: 'sh-a', varvad_profil_id: 'sh-v', varvad_ansokan_id: 'ans-v', brutto_ore: 30000,
        semester_procent: 12, grundersattning_ore: 26786, semesterersattning_ore: 3214, utlosare: 'konto_skapat',
        status: 'intjanad', skapad_at: FÖRRA + '-02T09:00:00Z', intjanad_at: FÖRRA + '-10T12:00:00Z', utbetald_at: null,
        utbetald_period: null, annullerad_at: null, annullerad_orsak: null, andrad_av: null },
      { id: 'vb-2', varvare_profil_id: 'sh-a', varvad_profil_id: null, varvad_ansokan_id: 'ans-k', brutto_ore: 30000,
        semester_procent: null, grundersattning_ore: null, semesterersattning_ore: null, utlosare: null, status: 'vantar',
        skapad_at: nu(-600), intjanad_at: null, utbetald_at: null, utbetald_period: null, annullerad_at: null,
        annullerad_orsak: null, andrad_av: null },
      { id: 'vb-3', varvare_profil_id: 'sh-b', varvad_profil_id: 'sh-m', varvad_ansokan_id: 'ans-m', brutto_ore: 30000,
        semester_procent: 12, grundersattning_ore: 26786, semesterersattning_ore: 3214, utlosare: 'konto_skapat',
        status: 'utbetald', skapad_at: '2026-09-18T09:00:00Z', intjanad_at: '2026-09-25T12:00:00Z',
        utbetald_at: '2026-10-25T12:00:00Z', utbetald_period: '2026-09', annullerad_at: null, annullerad_orsak: null,
        andrad_av: 'admin-1' },
      { id: 'vb-4', varvare_profil_id: 'sh-a', varvad_profil_id: null, varvad_ansokan_id: 'ans-t', brutto_ore: 30000,
        semester_procent: null, grundersattning_ore: null, semesterersattning_ore: null, utlosare: null, status: 'annullerad',
        skapad_at: nu(-300), intjanad_at: null, utbetald_at: null, utbetald_period: null, annullerad_at: nu(-300),
        annullerad_orsak: 'Har sökt förut, och räknas inte som ny.', andrad_av: null }
    ],
    varvning_installning: [{ id: 1, brutto_ore: 30000, semester_procent: 12, utlosare: 'konto_skapat' }],
    flaggor: [{ kod: 'tipsbonus', aktiv: true, beskrivning: 'Bonusen', uppdaterad: '2026-10-13T10:00:00Z' }],
    foretagsfakta: [{ id: 1, studiehjalpare_form: 'anstallda', arbetsgivarregistrerad: true, lonart_timlon: '11',
      lonart_tipsbonus: '1310' }],
    lon_anstallning: [{ id: 'sh-a', anstallningsnummer: '7' }, { id: 'sh-b', anstallningsnummer: '8' }],
    tjanster: [{ kod: 'laxhjalp', namn: 'Läxhjälp', aktiv: true, for_jobb: true, for_kund: true, ordning: 1,
      pris_per_timme_ore: 39900 }],
    admin_sett: [{ omrade: 'leads', sett_till: nu(-1) }, { omrade: 'ansokningar', sett_till: nu(-1) }],
    tipskoder: [{ kod: 'SHAAAAAA', sort: 'studiehjalpare', person_id: 'sh-a', aktiv: true, created_at: '2026-09-01T10:00:00Z' }]
  };
}

/* o.anv: den inloggade (null: utloggad). o.kod: vad prova_jobbkod svarar.
   o.tips: vad mina_tips svarar för studiehjälparen. */
function falskSupabase(o) {
  const ANV = o.anv === undefined ? ADMIN : o.anv;
  const W = värld();
  if (o.värld) o.värld(W);
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
  const session = () => ({ access_token: jwt(ANV ? ANV.id : 'anon', 'authenticated'), refresh_token: 'prov',
    token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: ANV });
  function filtrera(rader, sök) {
    let ut = rader.slice();
    for (const [k, v] of sök.entries()) {
      if (['select', 'order', 'limit', 'offset', 'columns', 'or'].includes(k)) continue;
      const m = /^eq\.(.*)$/.exec(v);
      if (m) ut = ut.filter(r => String(r[k]) === m[1]);
      const i = /^in\.\((.*)\)$/.exec(v);
      if (i) { const l = i[1].split(',').map(x => x.replace(/^"|"$/g, '')); ut = ut.filter(r => l.includes(String(r[k]))); }
      if (v === 'is.null') ut = ut.filter(r => r[k] == null);
    }
    return ut;
  }
  const admin = ANV && ANV.id === 'admin-1';
  const RPC = {
    mina_behorigheter: () => (admin ? { admin: true, superadmin: true, behorigheter: [] }
      : { admin: false, superadmin: false, behorigheter: [] }),
    notisfel: () => [], ekonomiska_avvikelser: () => [],
    admin_sett_markera: k => k.p_till,
    mitt_villkorslage: () => ({ version: '2026-10-22', godkant_at: '2026-10-22T09:00:00+00:00', tidigare: false }),
    mitt_utbildningsprov: () => ({ studiehjalpare: true, kravs: false, fragor: [] }),
    prova_jobbkod: k => (o.kod ? o.kod(String(k.p_kod || '')) : 'okand'),
    mina_tips: () => o.tips,
    varvningsbonus_utbetald: k => {
      let n = 0;
      W.varvningsbonus.forEach(b => {
        if ((k.p_ids || []).includes(b.id) && b.status === 'intjanad') {
          Object.assign(b, { status: 'utbetald', utbetald_at: nu(0), utbetald_period: k.p_period, andrad_av: 'admin-1' });
          n++;
        }
      });
      return n;
    },
    varvningsbonus_annullera: k => {
      const b = W.varvningsbonus.find(x => x.id === k.p_id);
      if (!b) return { __fel: [400, '22023', 'Bonusen finns inte.'] };
      if (b.status === 'utbetald') return 'utbetald';
      Object.assign(b, { status: 'annullerad', annullerad_at: nu(0), annullerad_orsak: k.p_orsak, andrad_av: 'admin-1' });
      return 'annullerad';
    }
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
    if (p === '/auth/v1/user') return ANV ? svar(route, 200, ANV) : svar(route, 401, {});
    if (p === '/auth/v1/logout') return svar(route, 204);
    if (p.startsWith('/auth/v1/')) return svar(route, 200, {});
    if (p.startsWith('/functions/v1/')) return svar(route, 404, {});
    if (p.startsWith('/storage/v1/')) return svar(route, 200, {});
    if (p.startsWith('/rest/v1/rpc/')) {
      const namn = p.slice('/rest/v1/rpc/'.length);
      const f = RPC[namn];
      if (!f) return svar(route, 404, { code: 'PGRST202', message: 'Could not find the function' });
      const ut = f(kropp || {});
      if (ut && ut.__fel) return svar(route, ut.__fel[0], { code: ut.__fel[1], message: ut.__fel[2] });
      return svar(route, 200, ut === undefined ? null : ut);
    }
    if (p.startsWith('/rest/v1/')) {
      const tabell = p.slice('/rest/v1/'.length);
      const ett = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
      if (metod === 'GET' || metod === 'HEAD') {
        // Värvaren läser aldrig tabellen: bara admin har en policy.
        const rader = tabell === 'varvningsbonus' && !admin ? [] : filtrera(W[tabell] || [], url.searchParams);
        const cr = rader.length ? '0-' + (rader.length - 1) + '/' + rader.length : '*/0';
        if (ett) return rader.length ? svar(route, 200, rader[0], { 'content-range': cr }) : svar(route, 406, { code: 'PGRST116', message: 'no rows' });
        return svar(route, 200, rader, { 'content-range': cr });
      }
      if (metod === 'PATCH') return svar(route, 204);
      if (metod === 'POST') {
        const rad = Object.assign({ id: tabell + '-' + (++löpnr), created_at: nu(0) }, kropp || {});
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
    timezoneId: 'Europe/Stockholm', acceptDownloads: true }, o.context || {}));
  const S = falskSupabase(o);
  const riktiga = [];
  const konsol = [];
  await context.route(RIKTIG, route => { riktiga.push(route.request().url()); return route.abort(); });
  await context.route(/nextrum-config\.js/, async route => {
    const t = fs.readFileSync(path.join(ROT, 'nextrum-config.js'), 'utf8')
      .replace(/SUPABASE_URL:\s*'[^']*'/, "SUPABASE_URL: '" + FALSK + "'")
      .replace(/VARVNING_VILLKOR_URL:\s*'[^']*'/, "VARVNING_VILLKOR_URL: '" + (o.villkor || '') + "'");
    return route.fulfill({ status: 200, contentType: 'application/javascript', body: t });
  });
  await context.route(/^https:\/\/supabase\.test\//, S.hantera);
  await context.routeWebSocket(/supabase\.test/, () => {});
  await context.route(url => !String(url).startsWith(BAS) && !/supabase\.test/.test(String(url)), route => route.abort());
  if (o.anv !== null) {
    await context.addInitScript(([nyckel, värde]) => {
      try { localStorage.setItem(nyckel, värde); sessionStorage.setItem('nx-notisruta-visad', '1'); } catch (e) { /* ingen lagring */ }
    }, [LAGRING, JSON.stringify(S.session())]);
  }
  const page = await context.newPage();
  page.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource|PGRST20[25]|Could not find the (table|function)/.test(m.text())) {
      konsol.push(m.text());
    }
  });
  page.on('pageerror', e => konsol.push('pageerror: ' + e.message));
  page.on('dialog', d => { konsol.push('dialog: ' + d.message()); d.dismiss().catch(() => {}); });
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
const xss = page => page.evaluate(() => !!window.__xss);

/* ============ 1. Koden i jobbansökan ============ */
async function fyllAnsökan(page) {
  await page.fill('#ap-name', 'Kim Kompis');
  await page.fill('#ap-age', '19');
  await page.fill('#ap-email', 'kim@example.se');
  await page.check('#ap-skolniva input[value="gymnasiet"]');
  await page.check('#ap-timmar input[value="ja"]');
  await page.check('#ap-gdpr');
}
async function provaAnsökan(webb) {
  for (const [sida, sv] of [['/bli-studiehjalpare', true], ['/en/bli-studiehjalpare', false]]) {
    const namn = sv ? 'ansökan' : 'ansökan (en)';
    // En kod som gäller, ur adressen.
    {
      const { context, page, S, riktiga, konsol } = await öppna(webb, { anv: null, kod: k => (k === 'SHAAAAAA' ? 'ok' : 'okand') });
      await page.goto(BAS + sida + '?kod=shaaaaaa#ansok');
      await page.waitForSelector('#apply-form');
      await page.waitForFunction(() => !document.querySelector('#ap-kod-besked').hidden, null, { timeout: 4000 }).catch(() => {});
      prova(namn + ': koden ur adressen prövas direkt och gäller',
        (await page.inputValue('#ap-kod')) === 'SHAAAAAA' && (await innehåll(page, '#ap-kod-besked')) === (sv ? 'Koden gäller.' : 'The code is valid.'),
        (await page.inputValue('#ap-kod')) + ' | ' + (await innehåll(page, '#ap-kod-besked')));
      const prövning = S.logg.find(r => r.väg === '/rest/v1/rpc/prova_jobbkod');
      prova(namn + ': prövningen skickar bara koden', prövning && JSON.stringify(Object.keys(prövning.kropp || {})) === '["p_kod"]',
        JSON.stringify(prövning && prövning.kropp));
      await fyllAnsökan(page);
      await page.click('#apply-form button[type="submit"]');
      await page.waitForFunction(() => /Tack|Thank/.test(document.querySelector('#apply-ok').textContent), null, { timeout: 5000 }).catch(() => {});
      const ins = S.logg.filter(r => r.metod === 'POST' && r.väg === '/rest/v1/applications').pop();
      prova(namn + ': ansökan bär koden, aldrig en värvare', ins && ins.kropp && ins.kropp.kod === 'SHAAAAAA'
        && !('varvad_av_profil_id' in ins.kropp), JSON.stringify(ins && ins.kropp));
      if (sv) await bild(page, 'ansokan-kod-galler', '#apply-form');
      prova(namn + ': inga fel i konsolen', konsol.length === 0 && riktiga.length === 0, konsol.concat(riktiga).join(' | '));
      await context.close();
    }
    // En kod som inte gäller: besked när fältet lämnas, och tom vid ansökan.
    {
      const { context, page, S, konsol } = await öppna(webb, { anv: null, kod: () => 'okand' });
      await page.goto(BAS + sida + '#ansok');
      await page.waitForSelector('#apply-form');
      await page.fill('#ap-kod', 'FEL-KOD');
      await page.locator('#ap-kod').blur();
      await page.dispatchEvent('#ap-kod', 'change');
      await page.waitForFunction(() => !document.querySelector('#ap-kod-besked').hidden, null, { timeout: 4000 }).catch(() => {});
      const besked = await innehåll(page, '#ap-kod-besked');
      prova(namn + ': en kod som inte gäller ger ett tydligt besked under fältet',
        (sv ? /Koden gäller inte/ : /The code is not valid/).test(besked)
          && (await page.getAttribute('#ap-kod', 'aria-invalid')) === 'true', besked);
      if (sv) await bild(page, 'ansokan-kod-galler-inte', '#ap-kod-besked');
      await fyllAnsökan(page);
      await page.click('#apply-form button[type="submit"]');
      await page.waitForFunction(() => /Tack|Thank/.test(document.querySelector('#apply-ok').textContent), null, { timeout: 5000 }).catch(() => {});
      const ins = S.logg.filter(r => r.metod === 'POST' && r.väg === '/rest/v1/applications').pop();
      const tack = await innehåll(page, '#apply-ok');
      prova(namn + ': ansökan går in ändå, utan koden, och tacket säger det',
        ins && ins.kropp && !('kod' in ins.kropp) && (sv ? /gällde inte, så ansökan skickades utan den/
          : /was not valid, so your application was sent without it/).test(tack), JSON.stringify(ins && ins.kropp) + ' | ' + tack);
      prova(namn + ': fältet är tomt efteråt', (await page.inputValue('#ap-kod')) === '');
      prova(namn + ': inga fel i konsolen (okänd kod)', konsol.length === 0, konsol.join(' | '));
      await context.close();
    }
  }
  // Över taket: ansökan skickar koden, och databasen prövar den igen.
  {
    const { context, page, S, konsol } = await öppna(webb, { anv: null, kod: () => 'for_manga' });
    await page.goto(BAS + '/bli-studiehjalpare?kod=SHAAAAAA#ansok');
    await page.waitForSelector('#apply-form');
    await page.waitForFunction(() => !document.querySelector('#ap-kod-besked').hidden, null, { timeout: 4000 }).catch(() => {});
    prova('ansökan: över taket säger beskedet att koden prövas när ansökan kommer in',
      /prövar den när ansökan kommer in/.test(await innehåll(page, '#ap-kod-besked')), await innehåll(page, '#ap-kod-besked'));
    await fyllAnsökan(page);
    await page.click('#apply-form button[type="submit"]');
    await page.waitForFunction(() => /Tack/.test(document.querySelector('#apply-ok').textContent), null, { timeout: 5000 }).catch(() => {});
    const ins = S.logg.filter(r => r.metod === 'POST' && r.väg === '/rest/v1/applications').pop();
    prova('ansökan: över taket följer koden med', ins && ins.kropp && ins.kropp.kod === 'SHAAAAAA', JSON.stringify(ins && ins.kropp));
    prova('ansökan: inga fel i konsolen (taket)', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
}

/* ============ 2. Värva en kompis i studiehjälparvyn ============ */
const TIPS = {
  kod: 'SHAAAAAA', sort: 'studiehjalpare', aktiv: true, ansokningar: 3, intagna: 2, bonus_ore: 60000,
  bonus_utbetald_ore: 30000, bonus_ges: true, bonus_belopp_ore: 30000, semester_procent: 12, utlosare: 'konto_skapat',
  varvningar: [
    /* Som mina_tips() svarar: bonusens egna dagar i Stockholms tid, aldrig när kompisen sökte. */
    { id: 'vb-2', status: 'vantar', intjanad: null, utbetald: null, period: null, belopp_ore: 30000, fornamn: null },
    { id: 'vb-1', status: 'intjanad', intjanad: DENNA + '-01', utbetald: null,
      period: null, belopp_ore: 30000, fornamn: 'Vera' },
    { id: 'vb-3', status: 'utbetald', intjanad: '2026-09-25',
      utbetald: '2026-10-25', period: '2026-09', belopp_ore: 30000, fornamn: ELAK }
  ]
};
async function provaStudiehjälparen(webb) {
  {
    const { context, page, S, riktiga, konsol } = await öppna(webb, { anv: SARA, tips: TIPS });
    await page.goto(BAS + '/larare#profil/tips');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
    await page.waitForSelector('#tips-ruta [data-varv-bonus]', { timeout: 8000 }).catch(() => {});
    prova('värva: fliken heter Värva en kompis', /Värva en kompis/.test(await text(page, '#flik-tips')));
    const ruta = await innehåll(page, '#tips-ruta');
    prova('värva: beloppet ur inställningen och händelsen',
      /300\s*kr inklusive semesterersättning när din kompis har fått sitt konto/.test(await innehåll(page, '[data-varv-bonus]')),
      await innehåll(page, '[data-varv-bonus]'));
    prova('värva: koden och länken till jobbansökan', /SHAAAAAA/.test(ruta)
      && (await page.inputValue('#tips-lank')) === 'https://nextrum.se/bli-studiehjalpare?kod=SHAAAAAA#ansok',
      await page.inputValue('#tips-lank').catch(() => ''));
    const rader = await page.locator('#tips-ruta [data-varv-rad]').allTextContents();
    prova('värva: en rad per värvad med läget, och förnamnet bara när kontot finns',
      rader.length === 3 && /En kompis som sökt/.test(rader[0]) && /Väntar/.test(rader[0]) && !/Sökte|\d/.test(rader[0])
        && /Vera/.test(rader[1]) && /Intjänad/.test(rader[1]) && /Utbetald/.test(rader[2])
        && /Utbetald med lönen för september/.test(rader[2]) && rader[2].includes(ELAK), rader.join(' | '));
    prova('värva: ett namn som är HTML står som text', !(await xss(page))
      && (await page.locator('#tips-ruta [data-varv-rad] img').count()) === 0);
    prova('värva: inget om ansökan eller adressen', !/@|kim@|Kim Kompis/.test(ruta), ruta.slice(0, 300));
    prova('värva: villkoren är en platshållare med länken till villkoren för tips',
      /Platshållare: villkoren för värvningsbonusen/.test(ruta)
        && (await page.locator('#tips-ruta a[href="/anvandarvillkor#tips"]').count()) === 1, ruta.slice(-300));
    prova('värva: värvaren läser aldrig tabellen', !S.logg.some(r => r.väg === '/rest/v1/varvningsbonus'));
    await page.click('[data-tips-kopiera]').catch(() => {});
    await vänta(300);
    prova('värva: Kopiera länken svarar', /Kopierad|Markerad/.test(await text(page, '[data-tips-kopiera]')),
      await text(page, '[data-tips-kopiera]'));
    await bild(page, 'varva-en-kompis', '#tips-ruta');

    // Ersättningen: bonusen intjänad den här månaden står som värvningsbonus.
    await page.goto(BAS + '/larare#statistik/ersattning');
    await page.waitForSelector('#ers-pagaende', { timeout: 8000 }).catch(() => {});
    await vänta(1200);
    const ers = await innehåll(page, '#ers-pagaende');
    prova('värva: ersättningen säger värvningsbonusen för månaden', /300\s*kr i värvningsbonus/.test(ers)
      && /för en kompis du värvat/.test(ers), ers.slice(0, 400));
    prova('värva: inga fel i konsolen', konsol.length === 0 && riktiga.length === 0, konsol.concat(riktiga).join(' | '));
    await context.close();
  }
  // Med provet som händelse, villkoren satta och utan värvade.
  {
    const { context, page, konsol } = await öppna(webb, { anv: SARA, villkor: 'https://nextrum.se/anvandarvillkor#varvning',
      tips: Object.assign({}, TIPS, { utlosare: 'prov_godkant', varvningar: [] }) });
    await page.goto(BAS + '/larare#profil/tips');
    await page.waitForSelector('#tips-ruta [data-varv-bonus]', { timeout: 8000 }).catch(() => {});
    prova('värva: händelsen följer inställningen', /när din kompis har klarat utbildningsprovet/.test(await innehåll(page, '[data-varv-bonus]')),
      await innehåll(page, '[data-varv-bonus]'));
    prova('värva: med länken satt står villkoren som länk, utan platshållare',
      (await page.locator('#tips-ruta a[href="https://nextrum.se/anvandarvillkor#varvning"]').count()) === 1
        && !/Platshållare/.test(await innehåll(page, '#tips-ruta')));
    prova('värva: utan värvade säger listan det', /Ingen har sökt med din kod än/.test(await innehåll(page, '#tips-ruta')));
    prova('värva: inga fel i konsolen (provet)', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
  // Telefon i mörkt läge.
  {
    const { context, page, konsol } = await öppna(webb, { anv: SARA, tips: TIPS,
      context: { viewport: { width: 390, height: 844 }, colorScheme: 'dark', isMobile: true, hasTouch: true } });
    await page.goto(BAS + '/larare#profil/tips');
    await page.waitForSelector('#tips-ruta [data-varv-bonus]', { timeout: 8000 }).catch(() => {});
    prova('värva: telefon i mörkt läge går inte i sidled', await ingenSidled(page));
    await bild(page, 'varva-telefon-morkt', '#tips-ruta');
    prova('värva: inga fel i konsolen (telefon)', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
}

/* ============ 3. Sektionen Värvningsbonus i adminvyn ============ */
async function provaAdmin(webb) {
  const { context, page, S, riktiga, konsol } = await öppna(webb, {});
  await page.goto(BAS + '/admin#varvning');
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
  await page.waitForSelector('#vb-lista table', { timeout: 8000 }).catch(() => {});
  await vänta(400);
  prova('admin: sektionen står i menyn', await synlig(page, '#vy-sido a[data-sek="varvning"]'));
  const lista = await innehåll(page, '#vb-lista');
  prova('admin: fyra rader med värvare, värvad, belopp, delning och läge',
    (await page.locator('#vb-lista tbody tr').count()) === 4 && /Sara Ahl/.test(lista) && /Vera Värvad/.test(lista)
      && /Kim Kompis/.test(lista) && /267,86\s*kr grund \+ 32,14\s*kr semester/.test(lista)
      && /Intjänad/.test(lista) && /Väntar/.test(lista) && /Utbetald/.test(lista) && /Annullerad/.test(lista)
      && /Har sökt förut/.test(lista), lista.slice(0, 500));
  prova('admin: ett namn som är HTML står som text', !(await xss(page)) && lista.includes(ELAK));
  prova('admin: inställningen står överst', /300\s*kr brutto/.test(await innehåll(page, '#vb-om'))
    && /12 %/.test(await innehåll(page, '#vb-om')), await innehåll(page, '#vb-om'));
  const sam = await innehåll(page, '#vb-sam');
  prova('admin: summorna: väntar, intjänade och utbetalt', /Väntar\s*1/.test(sam) && /Intjänade, inte utbetalda\s*300\s*kr/.test(sam)
    && /Utbetalt\s*300\s*kr/.test(sam), sam);
  const summa = await innehåll(page, '#vb-summa');
  prova('admin: summeringen per värvare och lönemånad', (await page.locator('#vb-summa tbody tr').count()) === 2
    && /Sara Ahl/.test(summa) && /Bo Berg/.test(summa), summa);
  await bild(page, 'admin-varvning', '[data-sek="varvning"]');

  // Filter: läget och månaden.
  await page.click('[data-vb-filter="intjanad"]');
  await vänta(200);
  prova('admin: filtret Intjänade', (await page.locator('#vb-lista tbody tr').count()) === 1);
  await page.click('[data-vb-filter="alla"]');
  await page.selectOption('#vb-manad', '2026-09-01');
  await vänta(200);
  // vb-3 tjänades in i september 2026; vb-1 förra månaden, som är september när provet körs i oktober.
  prova('admin: filtret på månad', (await page.locator('#vb-lista tbody tr').count()) === (FÖRRA === '2026-09' ? 2 : 1)
    && /Bo Berg/.test(await innehåll(page, '#vb-lista')) && !/Kim Kompis|Tea Tidig/.test(await innehåll(page, '#vb-lista')),
    await innehåll(page, '#vb-lista'));
  await page.selectOption('#vb-manad', 'alla');
  await vänta(200);

  // CSV för revisorn: semikolon, decimalkomma, ören och skälet.
  const [nedladdning] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
    page.click('[data-vb-csv]')
  ]);
  let csv = '';
  if (nedladdning) {
    const fil = await nedladdning.path().catch(() => null);
    if (fil) csv = fs.readFileSync(fil, 'utf8');
  }
  const rader = csv.replace(/^﻿/, '').trim().split(/\r\n/);
  prova('admin: CSV med en rad per bonus, delningen i kronor och ören, och skälet',
    rader.length === 5 && /^id;värvare;värvad;läge;brutto_kr;grund_kr;semester_kr;brutto_ore/.test(rader[0])
      && rader.some(r => /;Intjänad;300,00;267,86;32,14;30000;26786;3214;12;konto_skapat;/.test(r))
      && rader.some(r => /Har sökt förut/.test(r)) && csv.charCodeAt(0) === 0xfeff, rader.slice(0, 3).join(' / '));

  // Markera utbetald: lönemånaden krävs.
  await page.click('#vb-lista [data-varv-utbetald="vb-1"]');
  await page.waitForSelector('.nx-fraga-box #vb-period', { timeout: 3000 }).catch(() => {});
  prova('admin: Markera utbetald föreslår lönemånaden', (await page.inputValue('.nx-fraga-box #vb-period')) === FÖRRA,
    await page.inputValue('.nx-fraga-box #vb-period').catch(() => ''));
  await page.fill('.nx-fraga-box #vb-period', '');
  await page.click('.nx-fraga-box [data-fr="ja"]');
  await vänta(200);
  prova('admin: utan lönemånad markeras inget', /ÅÅÅÅ-MM/.test(await innehåll(page, '.nx-fraga-box #fr-msg'))
    && !S.logg.some(r => r.väg === '/rest/v1/rpc/varvningsbonus_utbetald'));
  await page.fill('.nx-fraga-box #vb-period', FÖRRA);
  await page.click('.nx-fraga-box [data-fr="ja"]');
  await vänta(800);
  const ut = S.logg.find(r => r.väg === '/rest/v1/rpc/varvningsbonus_utbetald');
  prova('admin: utbetald går genom databasens funktion med lönemånaden',
    ut && JSON.stringify(ut.kropp.p_ids) === '["vb-1"]' && ut.kropp.p_period === FÖRRA, JSON.stringify(ut && ut.kropp));
  prova('admin: raden står som utbetald efteråt', /lönen för/.test(await innehåll(page, '#vb-lista'))
    && (await page.locator('#vb-lista [data-varv-utbetald="vb-1"]').count()) === 0);

  // Annullera: skälet krävs.
  await page.click('#vb-lista [data-varv-annullera="vb-2"]');
  await page.waitForSelector('.nx-fraga-box #vb-orsak', { timeout: 3000 }).catch(() => {});
  await page.fill('.nx-fraga-box #vb-orsak', 'x');
  await page.click('.nx-fraga-box [data-fr="ja"]');
  await vänta(200);
  prova('admin: ett för kort skäl nekas', /minst tre tecken/.test(await innehåll(page, '.nx-fraga-box #fr-msg'))
    && !S.logg.some(r => r.väg === '/rest/v1/rpc/varvningsbonus_annullera'));
  await page.fill('.nx-fraga-box #vb-orsak', 'Sökte aldrig på riktigt, <b>prov</b>.');
  await page.click('.nx-fraga-box [data-fr="ja"]');
  await vänta(800);
  const an = S.logg.find(r => r.väg === '/rest/v1/rpc/varvningsbonus_annullera');
  prova('admin: annulleringen går genom databasens funktion med skälet',
    an && an.kropp.p_id === 'vb-2' && an.kropp.p_orsak === 'Sökte aldrig på riktigt, <b>prov</b>.', JSON.stringify(an && an.kropp));
  prova('admin: skälet står som text', /Sökte aldrig på riktigt, <b>prov<\/b>\./.test(await innehåll(page, '#vb-lista'))
    && (await page.locator('#vb-lista .vb-orsak b').count()) === 0);
  prova('admin: ingen skrivning direkt mot tabellen', !S.logg.some(r => r.väg === '/rest/v1/varvningsbonus' && r.metod !== 'GET'));
  await bild(page, 'admin-varvning-efter', '#vb-lista');
  prova('admin: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('admin: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();

  // Telefon i mörkt läge.
  {
    const t = await öppna(webb, { context: { viewport: { width: 390, height: 844 }, colorScheme: 'dark', isMobile: true, hasTouch: true } });
    await t.page.goto(BAS + '/admin#varvning');
    await t.page.waitForSelector('#vb-lista table', { timeout: 8000 }).catch(() => {});
    await vänta(400);
    prova('admin: telefon i mörkt läge går inte i sidled', await ingenSidled(t.page));
    await bild(t.page, 'admin-varvning-telefon', '[data-sek="varvning"]');
    prova('admin: inga fel i konsolen (telefon)', t.konsol.length === 0, t.konsol.join(' | '));
    await t.context.close();
  }
}

(async function () {
  const server = spawn('python3', [path.join(ROT, '.claude', 'serve.py'), String(PORT)], { stdio: 'ignore' });
  let klar = false;
  for (let i = 0; i < 50 && !klar; i++) {
    try { klar = (await fetch(BAS + '/admin')).ok; } catch (e) { await vänta(100); }
  }
  const webb = await pw.chromium.launch();
  try {
    await provaAnsökan(webb);
    await provaStudiehjälparen(webb);
    await provaAdmin(webb);
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
