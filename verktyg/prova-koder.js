/* ============================================================
   NEXTRUM — webbläsarprov för Koder, bonusen i Löner och koden i
   jobbansökan (2026-10-13)

       NODE_PATH="$(npm root -g)" node verktyg/prova-koder.js [mapp för bilder]

   Leo: "i admin vyn ska du skapa en ny spalt, där ska koder synas, allas
   personliga kod ska synas där. först när jag klicka på koder så ska jag
   klickar om jag vill kolla på familjer eller studiehjälpare." Provet går
   igenom valet, båda listorna, vilka som använt en kod, strömbrytaren,
   bonusen under Löner och i ansökans panel, och koden i jobbansökan.
   Databasens regler provas i rls-test.sql (avsnittet KB); här provas
   vyerna, mot en falsk Supabase, som verktyg/prova-intag.js (egen port,
   8973). Ett anrop till den riktiga adressen fäller provet.
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
const PORT = 8973;
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
/* Förra månaden: lönen för den betalas den 25:e i den här, och Löner
   väljer den månaden till och med den 25:e. */
const förraMånaden = (() => {
  const d = new Date();
  const f = new Date(d.getFullYear(), d.getMonth() - (d.getDate() > 25 ? 0 : 1), 1, 12);
  return f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0') + '-01';
})();

function jwt(sub, roll) {
  const b = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  return b({ alg: 'HS256', typ: 'JWT' }) + '.' + b({ sub, role: roll, exp: 4102444800 }) + '.provet';
}
const ADMIN = { id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'leo@example.se',
  app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-09-01T10:00:00Z' };
/* Familjen som tipsat, inloggad i studievyn. */
const FAMILJ = { id: 'fam-a', aud: 'authenticated', role: 'authenticated', email: 'anna@example.se',
  app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-09-10T10:00:00Z' };

function värld() {
  return {
    profiles: [
      { id: 'admin-1', role: 'parent', full_name: 'Leo Admin', email: 'leo@example.se', is_admin: true,
        match_status: 'pending', created_at: '2026-09-01T10:00:00Z', last_seen_at: nu(-5) },
      { id: 'fam-a', role: 'parent', full_name: 'Anna Andersson', email: 'anna@example.se', is_admin: false,
        match_status: 'matched', matched_tutor_id: 'sh-a', created_at: '2026-09-10T10:00:00Z', last_seen_at: nu(-60) },
      { id: 'fam-b', role: 'parent', full_name: 'Bo Berg', email: 'bo@example.se', is_admin: false,
        match_status: 'matched', created_at: '2026-09-20T10:00:00Z', last_seen_at: nu(-60) },
      { id: 'fam-c', role: 'parent', full_name: 'Cecilia Carlsson', email: 'cecilia@example.se', is_admin: false,
        match_status: 'pending', created_at: '2026-10-01T10:00:00Z', last_seen_at: null },
      { id: 'sh-a', role: 'tutor', full_name: 'Sara Ahl', email: 'sara@example.se', is_admin: false,
        created_at: '2026-09-01T10:00:00Z', last_seen_at: nu(-30) },
      { id: 'sh-ny', role: 'tutor', full_name: 'Nils Nyman', email: 'nils@example.se', is_admin: false,
        created_at: '2026-09-25T10:00:00Z', last_seen_at: nu(-30) }
    ],
    tutor_profiles: [
      { id: 'sh-a', status: 'approved', hourly_rate: 150, created_at: '2026-09-01T10:00:00Z' },
      { id: 'sh-ny', status: 'approved', hourly_rate: 150, created_at: '2026-09-25T10:00:00Z' }
    ],
    leads: [
      { id: 'lead-b', parent_name: 'Bo Berg', email: 'bo@example.se', grade: 'Åk 7', subject: 'Matematik',
        status: 'matched', created_at: '2026-09-15T10:00:00Z', kund_id: 'fam-b', kod: 'FAMAAA' },
      { id: 'lead-x', parent_name: 'Xenia Ek', email: 'xenia@example.se', grade: 'Åk 9', subject: 'Engelska',
        status: 'new', created_at: nu(-120), kund_id: null, kod: 'FAMAAA' }
    ],
    applications: [
      { id: 'ans-ny', name: 'Nils Nyman', email: 'nils@example.se', age: 19, status: 'approved',
        created_at: '2026-09-20T10:00:00Z', tjanster: ['laxhjalp'], kod: 'SHAAAA', why: 'Gillar matte.' },
      { id: 'ans-2', name: 'Olle Olsson', email: 'olle@example.se', age: 17, status: 'contacted',
        created_at: nu(-600), tjanster: ['laxhjalp'], kod: 'SHAAAA', why: 'Hej.' }
    ],
    tipsbonus: [
      { id: 'bonus-1', studiehjalpare_id: 'sh-a', ny_studiehjalpare_id: 'sh-ny', ansokan_id: 'ans-ny',
        belopp_ore: 30000, period: förraMånaden, status: 'utkast', intjanad_at: förraMånaden + 'T12:00:00+00:00',
        godkand_at: null, utbetald_at: null, created_at: förraMånaden + 'T12:00:00+00:00' }
    ],
    flaggor: [
      { kod: 'tipstimme', aktiv: true, beskrivning: 'Timmen', uppdaterad: '2026-09-30T10:00:00Z' },
      { kod: 'tipsbonus', aktiv: true, beskrivning: 'Bonusen', uppdaterad: '2026-10-13T10:00:00Z' }
    ],
    foretagsfakta: [{ id: 1, studiehjalpare_form: 'anstallda', arbetsgivarregistrerad: true, lonart_timlon: '11',
      lonart_tipsbonus: null }],
    lon_anstallning: [{ id: 'sh-a', anstallningsnummer: '7' }],
    tjanster: [{ kod: 'laxhjalp', namn: 'Läxhjälp', aktiv: true, for_jobb: true, for_kund: true, ordning: 1,
      pris_per_timme_ore: 39900 }],
    admin_sett: [{ omrade: 'leads', sett_till: nu(-1) }, { omrade: 'ansokningar', sett_till: nu(-1) }],
    /* Familjens pass: ett där tipstimmen dragits. */
    students: [{ id: 'elev-a', parent_id: 'fam-a', name: 'Kim', matched_tutor_id: 'sh-a', match_status: 'matched',
      created_at: '2026-09-10T10:00:00Z' }],
    bookings: [{ id: 'pass-tips', parent_id: 'fam-a', tutor_id: 'sh-a', student_id: 'elev-a', subject: 'Matematik',
      tjanst: 'laxhjalp', wanted_date: '2026-10-02', wanted_time: '16:00', duration_min: 60, status: 'completed',
      betalning_status: 'ingen', fakturerbar: true, startrabatt: true, rabattkod: 'TIPS', rabatt_ore: 39900,
      timpris_ore: 39900, antal_barn: 1, created_at: '2026-09-30T10:00:00Z' }]
  };
}

const KODER = {
  familj: [
    { person_id: 'fam-a', kod: 'FAMAAA', aktiv: true, kod_skapad: '2026-09-10T10:00:00Z', anvanda: 2, kunder: 1,
      belonade: 1, timmar_anvanda: 0, bonus_ore: null, bonus_utbetald_ore: null },
    { person_id: 'fam-b', kod: 'FAMBBB', aktiv: true, kod_skapad: '2026-09-20T10:00:00Z', anvanda: 0, kunder: 0,
      belonade: 0, timmar_anvanda: 0, bonus_ore: null, bonus_utbetald_ore: null },
    { person_id: 'fam-c', kod: 'FAMCCC', aktiv: false, kod_skapad: '2026-10-13T10:00:00Z', anvanda: 0, kunder: 0,
      belonade: 0, timmar_anvanda: 0, bonus_ore: null, bonus_utbetald_ore: null }
  ],
  studiehjalpare: [
    { person_id: 'sh-a', kod: 'SHAAAA', aktiv: true, kod_skapad: '2026-09-01T10:00:00Z', anvanda: 2, kunder: 1,
      belonade: 1, timmar_anvanda: null, bonus_ore: 30000, bonus_utbetald_ore: 0 },
    { person_id: 'sh-ny', kod: 'SHNYNY', aktiv: true, kod_skapad: '2026-10-13T10:00:00Z', anvanda: 0, kunder: 0,
      belonade: 0, timmar_anvanda: null, bonus_ore: 0, bonus_utbetald_ore: 0 }
  ]
};

function falskSupabase(o) {
  const ANV = (o && o.anv) || ADMIN;
  const W = värld();
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
  const familj = ANV.id !== 'admin-1';
  const RPC = {
    mina_behorigheter: () => (familj ? { admin: false, superadmin: false, behorigheter: [] }
      : { admin: true, superadmin: true, behorigheter: [] }),
    /* Familjens kod: två timmar intjänade, en dragen. */
    mina_tips: () => ({ kod: 'FAMAAA', sort: 'familj', aktiv: true, anmalda: 2, kunder: 1, timmar: 2, anvanda: 1,
      kvar: 1, timme_ges: true }),
    notisfel: () => [], ekonomiska_avvikelser: () => [],
    tipskoder_lage: () => KODER.familj.concat(KODER.studiehjalpare).map(k => ({
      kod: k.kod, sort: k.person_id.startsWith('sh') ? 'studiehjalpare' : 'familj', person_id: k.person_id,
      namn: null, aktiv: k.aktiv, created_at: k.kod_skapad, anmalda: 0, kunder: 0, forsta_pass: 0, timmar_anvanda: 0
    })),
    koder_lage: k => KODER[k.p_sort] || [],
    admin_sett_markera: k => k.p_till,
    mitt_villkorslage: () => ({ version: '2026-10-13', godkant_at: '2026-10-13T09:00:00+00:00', tidigare: false }),
    forsta_timmen_lage: () => ({ beviljad: false, tagen: false, i_planen: false, pa_pass: false })
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
    if (p.startsWith('/functions/v1/')) return svar(route, 404, {});
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
        const vill = (req.headers()['prefer'] || '').includes('return=representation');
        return vill ? svar(route, 200, träff) : svar(route, 204);
      }
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
  const context = await webb.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, (o && o.context) || {}));
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
  if (!o || !o.utloggad) {
    await context.addInitScript(([nyckel, värde]) => {
      try { localStorage.setItem(nyckel, värde); } catch (e) { /* ingen lagring */ }
    }, [LAGRING, JSON.stringify(S.session())]);
  }
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
async function tillAdmin(page, sek) {
  await page.goto(BAS + '/admin#' + sek);
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
  await vänta(900);
}
const ingenSidled = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/* ============ 1. Koder: valet, listorna och vilka ============ */
async function provaKoder(webb) {
  const { context, page, S, riktiga, konsol } = await öppna(webb, {});
  await tillAdmin(page, 'koder');
  prova('koder: menyn har Koder', await synlig(page, '#vy-sido a[data-sek="koder"]'));
  prova('koder: valet står först, med två kort', (await page.locator('#kod-val .kod-val-kort').count()) === 2
    && !(await synlig(page, '#kod-vy')));
  const val = await text(page, '#kod-val');
  prova('koder: korten säger antal koder och vad koden ger', /Familjer/.test(val) && /Studiehjälpare/.test(val)
    && /3 koder/.test(val) && /2 koder/.test(val) && /300 kr/.test(val), val);
  prova('koder: listan hämtas när sektionen öppnas, för båda sorterna',
    S.logg.filter(r => r.väg === '/rest/v1/rpc/koder_lage').length >= 2);
  await bild(page, 'koder-val', '#kod-val');

  await page.click('#kod-val a[href="#koder/familjer"]');
  await vänta(400);
  prova('koder: familjerna, en rad per familj', (await page.locator('#kod-lista .kod-rad').count()) === 3);
  const tal = await text(page, '#kod-tal');
  prova('koder: nyckeltalen för familjer', /Familjer med kod/.test(tal) && /Anmälningar med kod/.test(tal)
    && /Timme i timbanken/.test(tal), tal);
  prova('koder: regeln säger timbanken och strömbrytaren står där', /timbanken/.test(await text(page, '#kod-regel'))
    && await synlig(page, '[data-koder-flagga="tipstimme"]'));
  prova('koder: den mest använda står först', (await text(page, '#kod-lista .kod-rad summary')).includes('Anna Andersson'),
    await text(page, '#kod-lista .kod-rad summary'));
  await page.click('#kod-lista .kod-rad[data-kod="FAMAAA"] summary');
  await vänta(250);
  const vilka = await text(page, '#kod-lista .kod-rad[data-kod="FAMAAA"] .kod-kropp');
  prova('koder: utfälld visar vilka som anmält sig med koden', /Bo Berg/.test(vilka) && /Xenia Ek/.test(vilka)
    && /Kund/.test(vilka), vilka);
  await bild(page, 'koder-familjer');

  /* Filtret och söket. */
  await page.click('[data-koder-filter="avstangda"]');
  await vänta(200);
  prova('koder: filtret Avstängda', (await page.locator('#kod-lista .kod-rad').count()) === 1
    && (await text(page, '#kod-lista .kod-rad')).includes('Cecilia'));
  await page.click('[data-koder-filter="alla"]');
  await page.fill('#kod-sok', 'zzz');
  await vänta(200);
  prova('koder: ett sök utan träff säger det', /Ingen kod matchar sökningen/.test(await text(page, '#kod-lista')));
  await page.fill('#kod-sok', 'famb');
  await vänta(200);
  prova('koder: söket hittar koden', (await page.locator('#kod-lista .kod-rad').count()) === 1
    && (await text(page, '#kod-lista .kod-rad')).includes('Bo Berg'));
  await page.fill('#kod-sok', '');

  /* Studiehjälparna, genom fliken. */
  await page.click('#kod-flikar a[href="#koder/studiehjalpare"]');
  await vänta(400);
  prova('koder: studiehjälparna, en rad var', (await page.locator('#kod-lista .kod-rad').count()) === 2);
  const tal2 = await text(page, '#kod-tal');
  prova('koder: nyckeltalen för studiehjälpare', /Ansökningar med kod/.test(tal2) && /Tagna in i poolen/.test(tal2)
    && /Bonus i lönen/.test(tal2) && /300 kr/.test(tal2), tal2);
  await page.click('#kod-lista .kod-rad[data-kod="SHAAAA"] summary');
  await vänta(250);
  const vilka2 = await text(page, '#kod-lista .kod-rad[data-kod="SHAAAA"] .kod-kropp');
  prova('koder: utfälld visar ansökningarna och bonusens läge', /Nils Nyman/.test(vilka2) && /Olle Olsson/.test(vilka2)
    && /Bonus, utkast, 300 kr/.test(vilka2), vilka2);
  await bild(page, 'koder-studiehjalpare');

  /* Strömbrytaren frågar först och skriver sedan. */
  await page.click('[data-koder-flagga="tipsbonus"]');
  await page.waitForSelector('.nx-fraga-box', { timeout: 3000 }).catch(() => {});
  prova('koder: strömbrytaren frågar först', /Stäng av bonusen för tips/.test(await text(page, '.nx-fraga-box')));
  await page.click('.nx-fraga-box [data-svar="ja"]');
  await vänta(500);
  const patch = S.logg.find(r => r.metod === 'PATCH' && r.väg === '/rest/v1/flaggor' && /tipsbonus/.test(r.sök));
  prova('koder: och stänger av flaggan', patch && patch.kropp && patch.kropp.aktiv === false, JSON.stringify(patch));
  prova('koder: regeln säger Av efteråt', /Av/.test(await text(page, '#kod-regel .kod-regel-text b')));

  /* Tillbaka i webbläsaren går till valet. */
  await page.goBack();
  await page.goBack();
  await vänta(400);
  prova('koder: Tillbaka går till valet', await synlig(page, '#kod-val .kod-val-kort'));

  /* Telefonen och mörkt läge. */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BAS + '/admin#koder/studiehjalpare');
  await vänta(1200);
  prova('koder: inget i sidled på en telefon', await ingenSidled(page));
  await page.click('#kod-lista .kod-rad[data-kod="SHAAAA"] summary').catch(() => {});
  await vänta(250);
  await bild(page, 'koder-telefon');
  await page.emulateMedia({ colorScheme: 'dark' });
  await vänta(300);
  await bild(page, 'koder-telefon-morkt');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(BAS + '/admin#koder');
  await vänta(1000);
  await bild(page, 'koder-val-morkt', '#kod-val');

  prova('koder: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('koder: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 2. Bonusen under Löner och i ansökans panel ============ */
async function provaLöner(webb) {
  const { context, page, S, riktiga, konsol } = await öppna(webb, {});
  await tillAdmin(page, 'loner');
  const tal = await text(page, '#lon-tal');
  prova('löner: bonusen står bland talen', /Bonus för tips/.test(tal) && /300 kr/.test(tal), tal);
  prova('löner: rutan Bonus för tips syns', await synlig(page, '#lon-bonus table'));
  prova('löner: studiehjälparen och den hen tipsat', /Sara Ahl/.test(await text(page, '#lon-bonus'))
    && /Nils Nyman/.test(await text(page, '#lon-bonus')), await text(page, '#lon-bonus'));
  prova('löner: Att få säger att bonusen ingår', /varav 300 kr bonus för tips/.test(await text(page, '#lon-personer')),
    await text(page, '#lon-personer'));
  const fil = await text(page, '#lon-fil');
  prova('löner: lönefilen visar lönearten för bonusen', /Löneart för bonus för tips/.test(fil), fil);
  await bild(page, 'loner-bonus', '#lon-bonus');

  /* Utbetald före Godkänd går inte. */
  await page.click('[data-bonus="bonus-1"] button[value="godkand"]');
  await vänta(500);
  const patch = S.logg.find(r => r.metod === 'PATCH' && r.väg === '/rest/v1/tipsbonus');
  prova('löner: Godkänd skrivs bara om läget är det som visades',
    patch && patch.kropp && patch.kropp.status === 'godkand' && /status=eq\.utkast/.test(patch.sök), JSON.stringify(patch));
  const hinder = await text(page, '#lon-fil');
  prova('löner: en godkänd bonus utan löneart stoppar filen', /Lönearten för bonus för tips är inte satt/.test(hinder), hinder);
  await bild(page, 'loner-fil', '#lon-fil');

  /* Ansökans panel. */
  await page.goto(BAS + '/admin#ansokningar');
  await vänta(1000);
  await page.click('[data-dp="ansokan:ans-ny"]').catch(() => {});
  await vänta(500);
  const fakta = await text(page, '.dp-fakta');
  prova('ansökan: panelen säger vem som tipsat och bonusen', /Tipsad av/.test(fakta) && /Sara Ahl/.test(fakta)
    && /Bonus för tipset/.test(fakta) && /300 kr/.test(fakta), fakta);
  await bild(page, 'ansokan-kod', '.dp-fakta');

  prova('löner: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('löner: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 3. Familjens timbank ============ */
async function provaFamiljensTimbank(webb) {
  const { context, page, riktiga, konsol } = await öppna(webb, { anv: FAMILJ });
  await page.goto(BAS + '/foralder#erbjudanden');
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
  await vänta(1200);
  const mina = await text(page, '#erb-mina');
  prova('familjen: Er timbank säger timmen för tips', /och 1 timme för tips/.test(mina) && /Timmar för tips/.test(mina)
    && /1 av 2 timmar kvar/.test(mina), mina);
  await bild(page, 'familj-erbjudanden', '#erb-mina-box');
  await page.goto(BAS + '/foralder#profil/timbank');
  await vänta(700);
  const tim = await text(page, '#timbank-timmar');
  prova('familjen: Profil → Timbanken har timmen och passet den betalat', /Timmar för tips/.test(tim)
    && /Matematik/.test(tim) && /−1 timme/.test(tim), tim);
  await bild(page, 'familj-timbanken', '#timbank-timmar');
  await page.goto(BAS + '/foralder#profil/tips');
  await vänta(500);
  const tips = await text(page, '#tips-ruta');
  prova('familjen: Tipsa säger timmen i timbanken', /En timme i er timbank/.test(tips) && /i er timbank\./.test(tips)
    && /Se timbanken/.test(tips), tips);
  await bild(page, 'familj-tipsa', '#tips-ruta');
  prova('familjen: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('familjen: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 4. Koden i jobbansökan ============ */
async function provaJobbansökan(webb) {
  for (const [sida, sv] of [['/bli-studiehjalpare', true], ['/en/bli-studiehjalpare', false]]) {
    const namn = sv ? 'jobbansökan' : 'jobbansökan (en)';
    const { context, page, S, riktiga, konsol } = await öppna(webb, { utloggad: true });
    await page.goto(BAS + sida + '?kod=sh%20aa-aa#ansok');
    await page.waitForSelector('#apply-form');
    prova(namn + ': koden ur adressen står i fältet', (await page.inputValue('#ap-kod')) === 'SHAA-AA',
      await page.inputValue('#ap-kod'));
    prova(namn + ': hjälptexten säger vilken kod som gäller',
      sv ? /bara en studiehjälpares kod/.test(await text(page, '#ap-kod + .nx-fil-hjalp'))
        : /Only a tutor's code/.test(await text(page, '#ap-kod + .nx-fil-hjalp')), await text(page, '#ap-kod + .nx-fil-hjalp'));
    await page.fill('#ap-name', 'Olle Olsson');
    await page.fill('#ap-age', '19');
    await page.fill('#ap-email', 'olle@example.se');
    await page.check('#ap-timmar input[value="ja"]');
    await page.check('#ap-gdpr');
    await page.click('#apply-form button[type="submit"]');
    await page.waitForFunction(() => /Tack|Thank/.test(document.querySelector('#apply-ok').textContent), null, { timeout: 5000 }).catch(() => {});
    const ins = S.logg.filter(r => r.metod === 'POST' && r.väg === '/rest/v1/applications').pop();
    prova(namn + ': koden skickas med ansökan', ins && ins.kropp && ins.kropp.kod === 'SHAA-AA', JSON.stringify(ins && ins.kropp));
    if (sv) await bild(page, 'jobbansokan-kod', '#apply-form');
    prova(namn + ': inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
    prova(namn + ': inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
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
    await provaKoder(webb);
    await provaLöner(webb);
    await provaFamiljensTimbank(webb);
    await provaJobbansökan(webb);
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
