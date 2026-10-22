/* ============================================================
   NEXTRUM — webbläsarprov för Fyll timbanken som inte säljs
   (2026-10-22, grenen klippkort-bort)

       NODE_PATH="$(npm root -g)" node verktyg/prova-klippkort-bort.js [mapp för bilder]

   Leo: "Det ska bara finnas tre köpbara planer: 4, 8 och 12 timmar",
   "Redan köpta klippkort ligger kvar och gäller", och en ruta "Behöver
   ni ett eget upplägg? Kontakta oss." på prissidan och i kassan.

   Provet går igenom:
   · prissidan på båda språken, i två bredder och båda lägena: exakt tre
     planer, ingen Fyll timbanken, rutan Eget upplägg som går till
     kontaktformuläret, och kalkylatorns läge utan plan;
   · kontaktformuläret börjar meddelandet med Eget upplägg, bara när
     länken bär just det värdet;
   · studievyns Erbjudanden (kassan): exakt tre planer att köpa fast
     katalogen i svaret har klippkorten kvar, och rutan Eget upplägg;
   · ett köpt Fyll timbanken-kort: det syns under Er timbank, betalar ett
     pass med Betala med timmar, och räknas ner från 7 till 6;
   · kassans spärr i stripe-checkout: nejet kommer före köpet och kassan.
     Regeln själv provas i _delad/erbjudanden_test.ts (Deno).

   Mot en falsk Supabase på https://supabase.test, som prova-kassan.js.
   Ett anrop till den riktiga adressen, eller någon annanstans utanför
   localhost, fäller provet.
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
const PORT = 8988;
const BAS = 'http://localhost:' + PORT;
const FALSK = 'https://supabase.test';
const RIKTIG = /ddkfiuvcppalutfulvbi\.supabase\.co/;
const LAGRING = 'sb-supabase-auth-token';
const BILDER = process.argv[2] || null;
/* Rutan Eget upplägg går till kontaktformuläret på FAQ-sidan, som fanns
   sedan förut (Leo: "Finns redan ett kontaktformulär, använd det i stället"). */
const FORMULÄR = { sv: '/faq?amne=eget-upplagg#kontakt', en: '/en/faq?amne=eget-upplagg#kontakt' };

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

/* Katalogen som driften har den: tre planer och klippkorten, som står
   kvar och aktiva i databasen (köpta kort pekar på dem). */
const TIMPRIS = 39900;
function katalog() {
  return [
    ['plan_basic', 'plan', 'Basic', 4, 5, 1, 10], ['plan_standard', 'plan', 'Standard', 8, 5, 1, 20],
    ['plan_intensiv', 'plan', 'Intensiv', 12, 5, 1, 25],
    ['klipp10', 'klippkort', 'Fyll timbanken, 10 timmar', 10, 0, 6, 30],
    ['klipp20', 'klippkort', 'Fyll timbanken, 20 timmar', 20, 0, 6, 40],
    ['klipp30', 'klippkort', 'Fyll timbanken, 30 timmar', 30, 0, 6, 50],
    ['klipp60', 'klippkort', 'Fyll timbanken, 60 timmar', 60, 0, 6, 60],
    ['klipp100', 'klippkort', 'Fyll timbanken, 100 timmar', 100, 0, 6, 70]
  ].map(([kod, sort, namn, timmar, rabatt, man, ordning]) => {
    const rab = Math.floor(TIMPRIS * (100 - rabatt) / 10000) * 100;
    return { kod, sort, namn, timmar, rabatt_procent: rabatt, giltig_manader: man, ordning, timpris_ore: TIMPRIS,
      ordinarie_ore: timmar * TIMPRIS, pris_ore: timmar * rab, rabatterat_timpris_ore: rab, timmar_pa_kopet: 0 };
  });
}

/* Ett Fyll timbanken-kort köpt före spärren: 10 timmar, 3 använda. */
const KLIPP = {
  id: 'kk-gammal', parent_id: 'fam-a', erbjudande: 'klipp10', namn: 'Fyll timbanken, 10 timmar', sort: 'klippkort',
  timmar: 10, anvanda: 3, kvar: 7, giltigt_till: dag(120), status: 'betald', begart_ore: 399000, betalt_ore: 399000,
  aterbetald_ore: 0, timpris_ore: 39900, betald_at: nu(-40000), created_at: nu(-40000), brukbar: true,
  vid_uppsagning_ore: 279300, angerfrist_till: dag(-14), vid_anger_ore: 279300, gratis_kvar: 0, gratis_till: null,
  aterkallad_at: null, till_plan: null, rabatterat_timpris_ore: 39900, familjerabatt_ore: 0, galler_fran: null,
  aterbetalda_timmar: 0
};

function värld() {
  return {
    profiles: [
      { id: 'fam-a', role: 'parent', full_name: 'Anna Andersson', email: 'anna@example.se', is_admin: false,
        match_status: 'matched', matched_tutor_id: 'sh-a', created_at: '2026-09-10T10:00:00Z', last_seen_at: nu(-60) },
      { id: 'sh-a', role: 'tutor', full_name: 'Sara Ahl', email: 'sara@example.se', is_admin: false,
        created_at: '2026-09-01T10:00:00Z', last_seen_at: nu(-30) }
    ],
    tutor_profiles: [{ id: 'sh-a', status: 'approved', hourly_rate: 150, created_at: '2026-09-01T10:00:00Z' }],
    students: [{ id: 'elev-a', parent_id: 'fam-a', name: 'Kim', matched_tutor_id: 'sh-a', match_status: 'matched',
      created_at: '2026-09-10T10:00:00Z' }],
    tjanster: [{ kod: 'laxhjalp', namn: 'Läxhjälp', aktiv: true, for_jobb: true, for_kund: true, ordning: 1,
      pris_per_timme_ore: 39900, extra_personer_ore: 6900, extra_personer_max: 3 }],
    flaggor: [{ kod: 'erbjudanden', aktiv: true, beskrivning: 'Erbjudandena', uppdaterad: '2026-09-27T10:00:00Z' }],
    bookings: [
      /* Ett bekräftat pass som timmarna kan betala. */
      { id: 'pass-1', parent_id: 'fam-a', tutor_id: 'sh-a', student_id: 'elev-a', created_by: 'fam-a',
        subject: 'Matematik', tjanst: 'laxhjalp', wanted_date: dag(9), wanted_time: '16:00', duration_min: 60,
        status: 'confirmed', betalning_status: 'ingen', fakturerbar: true, startrabatt: false, rabatt_ore: null,
        timpris_ore: 39900, extra_ore: 6900, antal_barn: 1, klippkort_id: null, format: 'Online', location: null,
        created_at: nu(-600) }
    ],
    klippkort_saldo: [Object.assign({}, KLIPP)],
    klippkort_rorelser: [
      { klippkort_id: 'kk-gammal', booking_id: null, timmar: 3, datum: dag(-20), status: 'completed' }
    ],
    klippkort: [{ id: 'kk-gammal', stripe_skarp: false }],
    erbjudanden_pris: katalog()
  };
}

function falskSupabase(o) {
  const ANV = FAMILJ;
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
      const i = /^in\.\((.*)\)$/.exec(v);
      if (i) { const l = i[1].split(',').map(x => x.replace(/^"|"$/g, '')); ut = ut.filter(r => l.includes(String(r[k]))); }
      if (v === 'is.null') ut = ut.filter(r => r[k] == null);
    }
    return ut;
  }
  const RPC = {
    mina_behorigheter: () => ({ admin: false, superadmin: false, behorigheter: [] }),
    notisfel: () => [],
    mitt_villkorslage: () => ({ version: '2026-10-23', godkant_at: '2026-10-22T09:00:00+00:00', tidigare: false }),
    forsta_timmen_lage: () => ({ beviljad: false, tagen: true, i_planen: true, pa_pass: false }),
    min_familjerabatt: () => 0,
    sen_avbokning_lage: () => null
  };
  /* klippkort-betala som databasen gör det: en timme dras från kortet,
     och passet står betalt med timmarna. */
  const FUNKTION = {
    'klippkort-betala': k => {
      const kort = W.klippkort_saldo.find(x => x.id === 'kk-gammal');
      const pass = W.bookings.find(x => x.id === k.pass);
      if (!kort || !pass || kort.kvar < 1) return [409, { error: 'Timmarna räcker inte.' }];
      kort.kvar -= 1;
      kort.anvanda += 1;
      Object.assign(pass, { betalning_status: 'betald', klippkort_id: kort.id });
      W.klippkort_rorelser.push({ klippkort_id: kort.id, booking_id: pass.id, timmar: 1, datum: pass.wanted_date,
        status: 'confirmed' });
      return [200, { ok: true, kvar: kort.kvar }];
    },
    'stripe-checkout': () => [409, { error: 'Provet öppnar ingen kassa.' }]
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
      const f = RPC[p.slice('/rest/v1/rpc/'.length)];
      if (!f) return svar(route, 404, { code: 'PGRST202', message: 'Could not find the function' });
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
      if (metod === 'PATCH') {
        const träff = filtrera(W[tabell] || [], url.searchParams);
        träff.forEach(r => Object.assign(r, kropp || {}));
        return (req.headers()['prefer'] || '').includes('return=representation') ? svar(route, 200, träff) : svar(route, 204);
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

const LÄGEN = [
  { namn: '1440-ljust', context: { viewport: { width: 1440, height: 900 }, colorScheme: 'light' } },
  { namn: '390-morkt', context: { viewport: { width: 390, height: 844 }, colorScheme: 'dark', isMobile: true, hasTouch: true } }
];

async function öppna(webb, o) {
  const context = await webb.newContext(Object.assign({ viewport: { width: 1280, height: 900 },
    timezoneId: 'Europe/Stockholm' }, (o && o.context) || {}));
  const S = falskSupabase(o);
  const utanför = [];
  const konsol = [];
  await context.route(RIKTIG, route => { utanför.push(route.request().url()); return route.abort(); });
  await context.route(/nextrum-config\.js/, async route => {
    const t = fs.readFileSync(path.join(ROT, 'nextrum-config.js'), 'utf8')
      .replace(/SUPABASE_URL:\s*'[^']*'/, "SUPABASE_URL: '" + FALSK + "'");
    return route.fulfill({ status: 200, contentType: 'application/javascript', body: t });
  });
  await context.route(/^https:\/\/supabase\.test\//, S.hantera);
  await context.routeWebSocket(/supabase\.test/, () => {});
  await context.route(url => !String(url).startsWith(BAS) && !/supabase\.test/.test(String(url)),
    route => { utanför.push(route.request().url()); return route.abort(); });
  if (o && o.inloggad) {
    await context.addInitScript(([nyckel, värde]) => {
      try { localStorage.setItem(nyckel, värde); sessionStorage.setItem('nx-notisruta-visad', '1'); } catch (e) { /* ingen lagring */ }
    }, [LAGRING, JSON.stringify(S.session())]);
  }
  const page = await context.newPage();
  page.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource|PGRST20[25]|Could not find the (table|function)|Provet öppnar ingen kassa/.test(m.text())) {
      konsol.push(m.text());
    }
  });
  page.on('pageerror', e => konsol.push('pageerror: ' + e.message));
  return { context, page, S, utanför, konsol };
}

const innehåll = (page, sel) => page.locator(sel).first().textContent().catch(() => '');
const ingenSidled = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
async function bild(page, namn, sel) {
  if (!BILDER) return;
  fs.mkdirSync(BILDER, { recursive: true });
  await page.locator(sel).first().screenshot({ path: path.join(BILDER, namn + '.png') }).catch(() => {});
}

/* ============ 1. Prissidan ============ */
async function provaPrissidan(webb, språk, läge, o) {
  const namn = 'prissidan ' + språk + ' ' + läge.namn + (o && o.utanIntensiv ? ' utan Intensiv' : '');
  const { context, page, utanför, konsol } = await öppna(webb, Object.assign({ context: läge.context }, o || {}));
  await page.goto(BAS + (språk === 'en' ? '/en/priser' : '/priser'), { waitUntil: 'networkidle' });
  await vänta(500);
  const planer = await page.$$eval('#erbjudanden [data-erb]', el => el
    .filter(x => !x.hidden && !x.closest('[hidden]') && x.classList.contains('pr-erb-plan'))
    .map(x => x.getAttribute('data-erb')));
  const väntat = o && o.utanIntensiv ? ['plan_basic', 'plan_standard'] : ['plan_basic', 'plan_standard', 'plan_intensiv'];
  prova(namn + ': planerna och inget annat', JSON.stringify(planer) === JSON.stringify(väntat), planer.join(', '));
  prova(namn + ': inget klippkort i sidan', (await page.locator('[data-erb^="klipp"], .pr-erb-klippkol, [data-erb-grupp]').count()) === 0);
  const hela = await page.evaluate(() => document.body.innerText);
  prova(namn + ': Fyll timbanken säljs inte i texten', !/Fyll timbanken|Fill the time bank/i.test(hela),
    (hela.match(/.{0,60}(Fyll timbanken|Fill the time bank).{0,60}/i) || [''])[0]);
  const eget = await innehåll(page, '#erbjudanden .pr-erb-eget');
  prova(namn + ': rutan Eget upplägg', språk === 'sv' ? /Behöver ni ett eget upplägg\? Kontakta oss\./.test(eget)
    : /Need a custom set-up\? Contact us\./.test(eget), eget);
  const href = await page.locator('#erbjudanden .pr-erb-eget a').first().getAttribute('href').catch(() => '');
  prova(namn + ': knappen går till kontaktformuläret', href === FORMULÄR[språk], href);
  prova(namn + ': rutan syns', await page.locator('#erbjudanden .pr-erb-eget').isVisible());

  /* Kalkylatorn: ett barn och tre timmar i veckan är tolv timmar, Intensiv. */
  await page.locator('[data-kalk-val="tim"] button[data-v="3"]').click();
  await vänta(250);
  const lägen = await page.$$eval('[data-kalk-tips]', el => el.filter(x => !x.hidden).map(x => x.getAttribute('data-kalk-tips')));
  if (o && o.utanIntensiv) {
    prova(namn + ': kalkylatorn utan plan för de timmarna säger Eget upplägg', JSON.stringify(lägen) === '["ingen"]'
      && /(Eget upplägg|Custom set-up)/.test(await innehåll(page, '[data-kalk-tips="ingen"]')), lägen.join(','));
    const kh = await page.locator('[data-kalk-tips="ingen"] a').first().getAttribute('href').catch(() => '');
    prova(namn + ': kalkylatorns länk går till kontaktformuläret', kh === FORMULÄR[språk], kh);
  } else {
    prova(namn + ': kalkylatorn visar Intensiv för tolv timmar', JSON.stringify(lägen) === '["plan"]', lägen.join(','));
  }
  prova(namn + ': ingen sidledsrullning', await ingenSidled(page));
  prova(namn + ': inget anrop utanför localhost och den falska Supabase', utanför.length === 0, utanför.join(', '));
  prova(namn + ': inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  if (!(o && o.utanIntensiv)) await bild(page, 'prissidan-' + språk + '-' + läge.namn, '#erbjudanden');
  await context.close();
}

/* ============ 2. Studievyn: kassan och det köpta kortet ============ */
async function tillErbjudanden(page) {
  await page.goto(BAS + '/foralder#erbjudanden');
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
  await page.waitForSelector('#erb-planer .erb-kort', { timeout: 8000 }).catch(() => {});
  await vänta(700);
  if (await page.locator('.nx-notisruta [data-notisruta-stang]').count()) {
    await page.click('.nx-notisruta [data-notisruta-stang]').catch(() => {});
    await vänta(300);
  }
}

async function provaKassan(webb, läge) {
  const namn = 'kassan ' + läge.namn;
  const { context, page, S, utanför, konsol } = await öppna(webb, { context: läge.context, inloggad: true });
  const larm = [];
  page.on('dialog', d => { larm.push(d.message()); d.dismiss().catch(() => {}); });
  await tillErbjudanden(page);
  const köp = await page.$$eval('#erb-planer [data-kop]', b => b.map(x => x.getAttribute('data-kop')));
  prova(namn + ': exakt tre planer att köpa, fast katalogen i svaret har klippkorten',
    JSON.stringify(köp) === '["plan_basic","plan_standard","plan_intensiv"]'
      && S.W.erbjudanden_pris.some(e => e.sort === 'klippkort'), köp.join(', '));
  prova(namn + ': ingen Fyll timbanken att köpa', (await page.locator('#erb-planer .erb-klippkol, [data-kop^="klipp"]').count()) === 0);
  const rubrik = await page.locator('#erb-planer').locator('xpath=..').locator('h5').first().textContent().catch(() => '');
  prova(namn + ': rubriken säger Planer', rubrik.trim() === 'Planer', rubrik);
  const sek = await innehåll(page, 'section.vy-sek[data-sek="erbjudanden"]');
  prova(namn + ': inget i Erbjudanden säger att Fyll timbanken går att köpa',
    !/med Fyll timbanken|Planer och Fyll timbanken|Se planer och Fyll timbanken/.test(sek),
    (sek.match(/.{0,60}Fyll timbanken.{0,60}/) || [''])[0]);
  const eget = await innehåll(page, '.erb-eget');
  prova(namn + ': rutan Eget upplägg', /Behöver ni ett eget upplägg\? Kontakta oss\./.test(eget) && !/[–—]/.test(eget), eget);
  const kl = page.locator('#erb-kontakt');
  prova(namn + ': rutans knapp går till kontaktformuläret, i en ny flik',
    (await kl.getAttribute('href')) === FORMULÄR.sv && (await kl.getAttribute('target')) === '_blank'
      && /noopener/.test(await kl.getAttribute('rel') || ''), await kl.getAttribute('href'));

  /* Det köpta kortet: under Er timbank, 7 av 10 timmar. */
  const mina = await innehåll(page, '#erb-mina-box');
  prova(namn + ': det köpta Fyll timbanken-kortet står under Er timbank', /Fyll timbanken, 10 timmar/.test(mina), mina);
  prova(namn + ': och räknar 7 av 10 timmar kvar', /7\s*av 10 timmar kvar/.test(mina), mina);
  prova(namn + ': ingen sidledsrullning', await ingenSidled(page));
  await bild(page, 'kassan-' + läge.namn, 'section.vy-sek[data-sek="erbjudanden"]');

  /* Kortet betalar ett pass: Betala med timmar drar en timme, och vyn räknar ner. */
  await page.goto(BAS + '/foralder#pass/pass-1');
  await page.waitForSelector('#pass-sida [data-timmar]', { timeout: 10000 }).catch(() => {});
  prova(namn + ': ett bekräftat pass har Betala med timmar', (await page.locator('#pass-sida [data-timmar]').count()) > 0);
  await page.locator('#pass-sida [data-timmar]').first().click().catch(() => {});
  await page.waitForSelector('[data-svar="ja"]', { timeout: 4000 }).catch(() => {});
  const fråga = await innehåll(page, '.nx-fraga-box');
  prova(namn + ': rutan säger att timmen dras från det köpta kortet', /Fyll timbanken, 10 timmar/.test(fråga), fråga);
  await page.locator('[data-svar="ja"]').first().click().catch(() => {});
  await vänta(1200);
  const drag = S.logg.filter(r => r.metod === 'POST' && r.väg === '/functions/v1/klippkort-betala');
  prova(namn + ': klippkort-betala anropas för passet', drag.length === 1 && drag[0].kropp && drag[0].kropp.pass === 'pass-1',
    JSON.stringify(drag));
  await tillErbjudanden(page);
  const efter = await innehåll(page, '#erb-mina-box');
  prova(namn + ': kortet räknas ner till 6 av 10', /6\s*av 10 timmar kvar/.test(efter), efter);
  prova(namn + ': ingen kassa öppnades', S.logg.filter(r => r.väg === '/functions/v1/stripe-checkout').length === 0);
  prova(namn + ': inga larm', larm.length === 0, larm.join(' | '));
  prova(namn + ': inget anrop utanför localhost och den falska Supabase', utanför.length === 0, utanför.join(', '));
  prova(namn + ': inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 3. Kontaktformuläret ============ */
async function provaFormuläret(webb, språk) {
  const namn = 'formuläret ' + språk;
  const sida = språk === 'en' ? '/en/faq' : '/faq';
  const { context, page, utanför, konsol } = await öppna(webb, {});
  const värde = async adress => {
    await page.goto(BAS + adress, { waitUntil: 'networkidle' });
    return page.locator('#c-msg').inputValue().catch(() => null);
  };
  prova(namn + ': från rutan börjar meddelandet med ämnet',
    await värde(FORMULÄR[språk]) === (språk === 'en' ? 'Custom set-up: ' : 'Eget upplägg: '));
  prova(namn + ': utan värdet står meddelandet tomt', await värde(sida + '#kontakt') === '');
  prova(namn + ': ett annat värde skrivs aldrig in', await värde(sida + '?amne=%3Cb%3Ehej%3C%2Fb%3E#kontakt') === '');
  prova(namn + ': inget anrop utanför localhost och den falska Supabase', utanför.length === 0, utanför.join(', '));
  prova(namn + ': inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 4. Kassans spärr i stripe-checkout ============
   Deno-provet säger att regeln nekar klippkorten. Här: att kassan
   frågar regeln innan den skapar ett köp, återanvänder ett väntande
   eller öppnar en kassa hos Stripe. */
function provaSpärren() {
  const k = fs.readFileSync(path.join(ROT, 'supabase/functions/stripe-checkout/index.ts'), 'utf8');
  const start = k.indexOf('async function köpErbjudande(');
  const slut = k.indexOf('async function köpTimmarTillPlanen(', start);
  const del = k.slice(start, slut > start ? slut : undefined);
  const spärr = del.indexOf('if (!saljs(e as ErbjudandePris)) return json({ error: SALJS_INTE }, 410, CORS);');
  prova('servern: köpErbjudande nekar med SALJS_INTE och 410', spärr > 0);
  prova('servern: spärren kommer efter att katalogens rad lästs',
    spärr > del.indexOf(".from('erbjudanden_pris')") && del.indexOf(".from('erbjudanden_pris')") > 0);
  for (const [vad, sträng] of [['ett väntande köp återanvänds', 'kanAteranvandas('], ['ett köp skapas', ".from('klippkort').insert("],
                                ['en kassa öppnas hos Stripe', "'/v1/checkout/sessions'"]]) {
    const i = del.indexOf(sträng);
    prova('servern: nejet kommer innan ' + vad, i > spärr, sträng + ' på ' + i + ', spärren på ' + spärr);
  }
  const d = fs.readFileSync(path.join(ROT, 'supabase/functions/_delad/erbjudanden.ts'), 'utf8');
  prova('servern: regeln är bara planerna', /export function saljs\([^)]*\): boolean \{\s*return !!e && e\.sort === 'plan';\s*\}/.test(d));
  prova('servern: beskedet är svenska och utan tankstreck',
    /Fyll timbanken går inte att köpa längre\./.test(d) && !/SALJS_INTE[^;]*[–—]/.test(d));
}

(async function () {
  const server = spawn('python3', [path.join(ROT, '.claude', 'serve.py'), String(PORT)], { stdio: 'ignore' });
  let klar = false;
  for (let i = 0; i < 50 && !klar; i++) {
    try { klar = (await fetch(BAS + '/priser')).ok; } catch (e) { await vänta(100); }
  }
  const webb = await pw.chromium.launch();
  try {
    for (const läge of LÄGEN) {
      await provaPrissidan(webb, 'sv', läge);
      await provaPrissidan(webb, 'en', läge);
      await provaKassan(webb, läge);
    }
    await provaPrissidan(webb, 'sv', LÄGEN[0], { utanIntensiv: true,
      värld: W => { W.erbjudanden_pris = W.erbjudanden_pris.filter(e => e.kod !== 'plan_intensiv'); } });
    await provaPrissidan(webb, 'en', LÄGEN[1], { utanIntensiv: true,
      värld: W => { W.erbjudanden_pris = W.erbjudanden_pris.filter(e => e.kod !== 'plan_intensiv'); } });
    await provaFormuläret(webb, 'sv');
    await provaFormuläret(webb, 'en');
    provaSpärren();
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
