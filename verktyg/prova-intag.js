/* ============================================================
   NEXTRUM — webbläsarprov för intaget i adminvyn (2026-10-06)

       NODE_PATH="$(npm root -g)" node verktyg/prova-intag.js [mapp för bilder]

   Leo: "när man ska ta in en anställd är det krångligt att skapa konto
   åt den, samma med familj". Ta in i poolen skapar nu kontot med
   adressen i ansökan när ingen har den, Ta in familjen gör konto,
   inbjudan och elev i ett tryck, och Skicka inbjudan igen står vid den
   som aldrig loggat in. Edge-funktionen bjud-in svarar här som den gör
   (_delad/inbjudan.ts, provad i inbjudan_test.ts), och skapar profilen
   som handle_new_user gör, så att vyn hittar kontot efteråt.

   Byggt som verktyg/prova-ansokningar.js (egen port, 8969), mot en
   falsk Supabase; ett anrop till den riktiga adressen fäller provet.
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
const PORT = 8969;
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

function värld() {
  return {
    profiles: [
      { id: 'admin-1', role: 'parent', full_name: 'Leo Admin', email: 'leo@example.se', is_admin: true,
        match_status: 'pending', created_at: '2026-09-01T10:00:00Z', last_seen_at: nu(-5) },
      /* Registrerade sig själv efter sin ansökan, väntar. */
      { id: 'sh-1', role: 'tutor', full_name: 'Tove Lind', email: 'tove@example.se', is_admin: false,
        created_at: '2026-10-03T10:00:00Z', last_seen_at: nu(-3000) },
      /* Inbjuden, har aldrig loggat in. */
      { id: 'familj-1', role: 'parent', full_name: 'Per Persson', email: 'per@example.se', is_admin: false,
        match_status: 'pending', created_at: '2026-10-04T10:00:00Z', last_seen_at: null }
    ],
    tutor_profiles: [{ id: 'sh-1', status: 'pending', created_at: '2026-10-03T10:00:00Z' }],
    applications: [
      { id: 'ans-ny', name: 'Sara Nyberg', email: 'Sara.N@example.se', age: 19, status: 'contacted',
        school: 'KTH', subjects: 'Matematik, Fysik', availability: 'Vardagar', tjanster: ['laxhjalp'],
        created_at: nu(-6000), utbildad_at: nu(-60), intervju_at: nu(-3000), why: 'Jag gillar att förklara.',
        vardnadshavare_epost: null, vardnadshavare_godkand_at: null, vardnadshavare_svar: null },
      { id: 'ans-har', name: 'Tove Lind', email: 'tove@example.se', age: 18, status: 'contacted',
        school: 'Södra Latin', subjects: 'Engelska', availability: 'Helger', tjanster: ['laxhjalp'],
        created_at: nu(-7000), utbildad_at: nu(-120), intervju_at: nu(-4000), why: 'Hej',
        vardnadshavare_epost: null, vardnadshavare_godkand_at: null, vardnadshavare_svar: null }
    ],
    leads: [
      { id: 'lead-ny', parent_name: 'Karin Karlsson', email: 'karin@example.se', child_name: 'Kim', grade: 'Åk 8',
        subject: 'Engelska, Matematik', tjanst: 'laxhjalp', status: 'new', created_at: nu(-30), kund_id: null }
    ],
    students: [],
    ansokan_utskick: [],
    admin_sett: [{ omrade: 'leads', sett_till: nu(-1) }, { omrade: 'ansokningar', sett_till: nu(-1) }],
    tjanster: [{ kod: 'laxhjalp', namn: 'Läxhjälp', aktiv: true, for_jobb: true, for_kund: true, ordning: 1 }],
    flaggor: [],
    /* Användarvillkoren (2026-10-07): Tove kryssade i när hon registrerade
       sig, familjen vi bjudit in har inte loggat in och inte godkänt. */
    villkor_godkannanden: [{ anvandare: 'sh-1', version: '2026-09-30', godkant_at: '2026-10-03T10:00:00+00:00',
                             kalla: 'registrering' }]
  };
}

function falskSupabase(o) {
  const W = värld();
  const logg = [];
  const bjudIn = [];
  let löpnr = 0;
  const svar = (route, status, kropp, extra) => route.fulfill({
    status,
    headers: Object.assign({
      'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
      'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range, x-total-count'
    }, extra || {}),
    body: kropp === undefined ? '' : JSON.stringify(kropp)
  });
  const session = () => ({ access_token: jwt('admin-1', 'authenticated'), refresh_token: 'prov', token_type: 'bearer',
    expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: ADMIN });
  function filtrera(rader, sök) {
    let ut = rader.slice();
    for (const [k, v] of sök.entries()) {
      if (['select', 'order', 'limit', 'offset', 'columns'].includes(k)) continue;
      const m = /^eq\.(.*)$/.exec(v);
      if (m) ut = ut.filter(r => String(r[k]) === m[1]);
      const i = /^in\.\((.*)\)$/.exec(v);
      if (i) { const l = i[1].split(',').map(x => x.replace(/^"|"$/g, '')); ut = ut.filter(r => l.includes(String(r[k]))); }
      if (v === 'is.null') ut = ut.filter(r => r[k] == null);
    }
    return ut;
  }
  /* bjud-in som funktionen svarar, och handle_new_user. */
  function bjudInFunktion(k) {
    bjudIn.push(k);
    const epost = String(k.epost || '').trim().toLowerCase();
    if (k.igen) {
      const p = W.profiles.find(x => String(x.email).toLowerCase() === epost);
      if (!p) return [404, { error: 'Det finns inget konto med den adressen. Bjud in personen i stället.' }];
      return [200, { ok: true, id: p.id, till: epost, roll: p.role, skickat: o.igenSvar || 'inbjudan' }];
    }
    if (W.profiles.some(x => String(x.email).toLowerCase() === epost)) {
      return [409, { error: 'Det finns redan ett konto med den adressen.' }];
    }
    const roll = k.roll === 'tutor' ? 'tutor' : 'parent';
    const id = 'ny-' + (++löpnr);
    W.profiles.push({ id, role: roll, full_name: k.namn || '', email: epost, is_admin: false,
      match_status: roll === 'parent' ? 'pending' : null, created_at: nu(0), last_seen_at: null });
    if (roll === 'tutor') W.tutor_profiles.push({ id, status: 'pending', created_at: nu(0) });
    if (k.lead_id) {
      const l = W.leads.find(x => x.id === k.lead_id);
      if (l && l.status === 'new') Object.assign(l, { status: 'contacted', kontaktad_at: nu(0) });
    }
    return [200, { ok: true, id, till: epost, roll, skickat: 'inbjudan' }];
  }
  const RPC = {
    mina_behorigheter: () => ({ admin: true, superadmin: true, behorigheter: [] }),
    notisfel: () => [], ekonomiska_avvikelser: () => [], tipskoder_lage: () => [],
    admin_sett_markera: k => k.p_till,
    /* Adminens eget läge: panelen läser bara den gällande versionen ur det. */
    mitt_villkorslage: () => ({ version: '2026-09-30', godkant_at: '2026-10-01T09:00:00+00:00', tidigare: false })
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
    if (p === '/auth/v1/user') return svar(route, 200, ADMIN);
    if (p.startsWith('/auth/v1/')) return svar(route, 200, {});
    if (p === '/functions/v1/bjud-in') {
      const [status, data] = bjudInFunktion(kropp || {});
      return svar(route, status, data);
    }
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
        return svar(route, 204);
      }
      if (metod === 'POST') {
        if (tabell === 'students' && o.elevFel && !o.elevFelSagt) {
          o.elevFelSagt = true;
          return svar(route, 400, { code: '23514', message: 'new row violates check constraint' });
        }
        const rad = Object.assign({ id: tabell + '-' + (++löpnr), created_at: nu(0) },
          tabell === 'students' ? { uppdrag_id: 'uppdrag-' + löpnr, match_status: 'pending' } : {}, kropp || {});
        (W[tabell] = W[tabell] || []).push(rad);
        return ett ? svar(route, 201, rad) : svar(route, 201, [rad]);
      }
      return svar(route, 405, {});
    }
    return svar(route, 404, {});
  }
  return { W, logg, bjudIn, hantera, session };
}

async function öppna(webb, o) {
  const context = await webb.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, o.context || {}));
  const S = falskSupabase(o);
  const riktiga = [];
  const konsol = [];
  const dialoger = [];
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
  page.on('dialog', d => { dialoger.push(d.message()); d.dismiss(); });
  return { context, page, S, riktiga, konsol, dialoger };
}

const synlig = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const text = (page, sel) => page.locator(sel).first().textContent().catch(() => '');
async function bild(page, namn, sel) {
  if (!BILDER) return;
  fs.mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: path.join(BILDER, namn + '.png'), fullPage: false });
  if (sel) await page.locator(sel).first().screenshot({ path: path.join(BILDER, namn + '-del.png') }).catch(() => {});
}
async function tillAdmin(page, sek) {
  await page.goto(BAS + '/admin#' + sek);
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
  await vänta(700);
}

/* ============ 1. Ta in i poolen, utan konto ============ */
async function provaPoolenUtanKonto(webb) {
  const { context, page, S, riktiga, konsol } = await öppna(webb, {});
  await tillAdmin(page, 'ansokningar');
  await page.click('[data-dp="ansokan:ans-ny"]');
  await vänta(400);
  prova('pool: ansökan säger att kontot skapas när hen tas in', (await page.locator('.dp-fakta').first().innerText())
    .includes('det skapas när hen tas in i poolen'));
  await page.click('[data-ans-pool="ans-ny"]');
  await page.waitForSelector('#ap-konto', { timeout: 4000 }).catch(() => {});
  prova('pool: Skapa kontot med adressen i ansökan är valt', (await page.inputValue('#ap-konto')) === '__nytt'
    && (await text(page, '#ap-konto option[value="__nytt"]')).includes('sara.n@example.se'), await page.inputValue('#ap-konto'));
  prova('pool: rutan säger att hen får länken till lösenordet', (await text(page, '#ap-konto-text')).includes('länk där hen väljer sitt lösenord'),
    await text(page, '#ap-konto-text'));
  prova('pool: knappen säger vad den gör', (await text(page, '#ap-godkann')) === 'Ta in och skicka inbjudan', await text(page, '#ap-godkann'));
  prova('pool: den som registrerat sig själv står kvar att välja', (await page.locator('#ap-konto option[value="sh-1"]').count()) === 1);
  await bild(page, 'pool-skapa', '.nx-fraga-box');

  await page.click('#ap-godkann');
  prova('pool: utan timpenning skickas ingenting', S.bjudIn.length === 0 && (await text(page, '#ap-msg')).includes('timpenningen'));
  await page.fill('#ap-timpenning', '180');
  await page.click('#ap-godkann');
  await page.waitForFunction(() => /intagen/.test((document.querySelector('.nx-fraga-box h3') || {}).textContent || ''), null, { timeout: 6000 }).catch(() => {});
  const b = S.bjudIn[0];
  prova('pool: bjud-in får adressen, namnet och rollen studiehjälpare', b && b.epost === 'Sara.N@example.se'
    && b.namn === 'Sara Nyberg' && b.roll === 'tutor' && !b.igen, JSON.stringify(b));
  const tp = S.logg.find(r => r.metod === 'PATCH' && r.väg === '/rest/v1/tutor_profiles');
  prova('pool: det nya kontot godkänns, med timpenningen', tp && /id=eq\.ny-1/.test(tp.sök) && tp.kropp.status === 'approved'
    && tp.kropp.hourly_rate === 180, JSON.stringify(tp));
  prova('pool: kontot skapas före godkännandet', S.logg.findIndex(r => r.väg === '/functions/v1/bjud-in')
    < S.logg.findIndex(r => r.metod === 'PATCH' && r.väg === '/rest/v1/tutor_profiles'));
  const ap = S.logg.find(r => r.metod === 'PATCH' && r.väg === '/rest/v1/applications');
  prova('pool: ansökan blir godkänd', ap && ap.kropp.status === 'approved' && /id=eq\.ans-ny/.test(ap.sök), JSON.stringify(ap));
  prova('pool: kvittot säger vart länken gick', (await text(page, '.nx-fraga-box h3')) === 'Sara Nyberg är intagen'
    && (await text(page, '.nx-fraga-box')).includes('sara.n@example.se'), await text(page, '.nx-fraga-box'));
  await bild(page, 'pool-kvitto', '.nx-fraga-box');
  await page.click('[data-ap-stang]');
  prova('pool: Stäng stänger kvittot', !(await synlig(page, '.nx-fraga')));
  prova('pool: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('pool: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 2. Ta in i poolen, med kontot hen skapat själv ============ */
async function provaPoolenMedKonto(webb) {
  const { context, page, S, konsol } = await öppna(webb, {});
  await tillAdmin(page, 'ansokningar');
  await page.click('[data-dp="ansokan:ans-har"]');
  await vänta(400);
  await page.click('[data-ans-pool="ans-har"]');
  await page.waitForSelector('#ap-konto', { timeout: 4000 }).catch(() => {});
  prova('pool med konto: kontot med samma adress är valt', (await page.inputValue('#ap-konto')) === 'sh-1', await page.inputValue('#ap-konto'));
  prova('pool med konto: inget nytt konto erbjuds för en adress som redan finns',
    (await page.locator('#ap-konto option[value="__nytt"]').count()) === 0);
  prova('pool med konto: knappen heter som förut', (await text(page, '#ap-godkann')) === 'Ta in i poolen');
  await page.fill('#ap-timpenning', '170');
  await page.click('#ap-godkann');
  await vänta(600);
  prova('pool med konto: ingen inbjudan', S.bjudIn.length === 0);
  const tp = S.logg.find(r => r.metod === 'PATCH' && r.väg === '/rest/v1/tutor_profiles');
  prova('pool med konto: kontot godkänns', tp && /id=eq\.sh-1/.test(tp.sök) && tp.kropp.status === 'approved', JSON.stringify(tp));
  prova('pool med konto: rutan stängs som förut', !(await synlig(page, '.nx-fraga')));
  prova('pool med konto: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 3. Ta in familjen ============ */
async function provaFamiljen(webb) {
  const { context, page, S, konsol } = await öppna(webb, {});
  await tillAdmin(page, 'leads');
  await page.click('[data-dp="anmalan:lead-ny"]');
  await vänta(400);
  prova('familj: knappen heter Ta in familjen när kontot saknas', (await text(page, '[data-lead-elev="lead-ny"]')) === 'Ta in familjen',
    await text(page, '[data-lead-elev="lead-ny"]'));
  await page.click('[data-lead-elev="lead-ny"]');
  await page.waitForSelector('#le-t', { timeout: 4000 }).catch(() => {});
  prova('familj: rutan heter Ta in familjen', (await text(page, '#le-t')) === 'Ta in familjen');
  prova('familj: rutan säger att kontot skapas och mejlet går', (await text(page, '#le-familj-rad')).includes('Det skapas när du tar in familjen'));
  prova('familj: ingen separat inbjudningsknapp', (await page.locator('#le-bjud').count()) === 0);
  prova('familj: eleven är ifylld ur anmälan', (await page.inputValue('#le-namn')) === 'Kim' && (await page.inputValue('#le-arskurs')) === 'Åk 8');
  await bild(page, 'familj-ta-in', '.nx-fraga-box');
  await page.click('#le-skapa');
  await page.waitForFunction(() => /intagen/.test((document.querySelector('.nx-fraga-box h3') || {}).textContent || ''), null, { timeout: 6000 }).catch(() => {});
  const b = S.bjudIn[0];
  prova('familj: bjud-in får anmälans adress, namn och anmälan', b && b.epost === 'karin@example.se'
    && b.namn === 'Karin Karlsson' && b.lead_id === 'lead-ny' && !b.roll, JSON.stringify(b));
  const elev = S.logg.find(r => r.metod === 'POST' && r.väg === '/rest/v1/students');
  prova('familj: eleven skapas på det nya kontot, med ämnena delade', elev && elev.kropp.parent_id === 'ny-1'
    && elev.kropp.name === 'Kim' && JSON.stringify(elev.kropp.subjects) === JSON.stringify(['Engelska', 'Matematik']),
    JSON.stringify(elev && elev.kropp));
  const kund = S.logg.filter(r => r.metod === 'PATCH' && r.väg === '/rest/v1/leads');
  prova('familj: anmälan kopplas till kontot och blir klar', kund.some(r => r.kropp.kund_id === 'ny-1')
    && kund.some(r => r.kropp.status === 'matched'), JSON.stringify(kund.map(r => r.kropp)));
  prova('familj: ordningen är konto, koppling, elev', S.logg.findIndex(r => r.väg === '/functions/v1/bjud-in')
    < S.logg.findIndex(r => r.metod === 'POST' && r.väg === '/rest/v1/students'));
  prova('familj: kvittot säger att familjen är intagen och vad som händer sedan', (await text(page, '.nx-fraga-box h3')) === 'Familjen är intagen'
    && (await text(page, '.nx-fraga-box')).includes('väljer sitt lösenord'), await text(page, '.nx-fraga-box'));
  prova('familj: vidare till matchningen finns', await synlig(page, '[data-le-match]'));
  await bild(page, 'familj-kvitto', '.nx-fraga-box');
  prova('familj: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 3b. Kontot gick, eleven inte ============
   medan() ställer tillbaka knappens text när den är klar; efter
   inbjudan ska knappen ändå heta Skapa elev, och nästa tryck får inte
   bjuda in en gång till. */
async function provaFamiljenElevenFaller(webb) {
  const { context, page, S, konsol } = await öppna(webb, { elevFel: true });
  await tillAdmin(page, 'leads');
  await page.click('[data-dp="anmalan:lead-ny"]');
  await vänta(400);
  await page.click('[data-lead-elev="lead-ny"]');
  await page.waitForSelector('#le-t', { timeout: 4000 }).catch(() => {});
  await page.click('#le-skapa');
  await page.waitForFunction(() => /eleven kunde inte skapas/.test((document.querySelector('#le-msg') || {}).textContent || ''),
    null, { timeout: 6000 }).catch(() => {});
  prova('eleven faller: beskedet säger att kontot och mejlet gick', (await text(page, '#le-msg')).includes('Familjen har fått sitt konto och mejlet'),
    await text(page, '#le-msg'));
  prova('eleven faller: knappen heter Skapa elev och går att trycka', (await text(page, '#le-skapa')) === 'Skapa elev'
    && !(await page.locator('#le-skapa').isDisabled()), await text(page, '#le-skapa'));
  prova('eleven faller: rutan heter Skapa elev ur anmälan', (await text(page, '#le-t')) === 'Skapa elev ur anmälan');
  await page.click('#le-skapa');
  await page.waitForFunction(() => /intagen/.test((document.querySelector('.nx-fraga-box h3') || {}).textContent || ''), null, { timeout: 6000 }).catch(() => {});
  prova('eleven faller: andra trycket bjuder inte in igen', S.bjudIn.length === 1, S.bjudIn.length);
  prova('eleven faller: andra trycket skapar eleven på kontot', S.W.students.length === 1 && S.W.students[0].parent_id === 'ny-1',
    JSON.stringify(S.W.students));
  prova('eleven faller: kvittot säger att familjen är intagen', (await text(page, '.nx-fraga-box h3')) === 'Familjen är intagen');
  prova('eleven faller: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 4. Skicka inbjudan igen ============ */
async function provaIgen(webb) {
  for (const [igenSvar, väntat] of [['inbjudan', 'En ny inbjudan har gått till per@example.se.'],
                                     ['losenord', 'En länk för att välja lösenord har gått till per@example.se.']]) {
    const { context, page, S, konsol, dialoger } = await öppna(webb, { igenSvar });
    await tillAdmin(page, 'familjer');
    await page.click('[data-dp="familj:familj-1"]');
    await vänta(400);
    prova('igen (' + igenSvar + '): Senast inloggad aldrig, med knappen', (await page.locator('.dp-fakta').first().innerText()).includes('aldrig')
      && (await synlig(page, '[data-dp-bjud-igen="familj-1"]')));
    prova('igen (' + igenSvar + '): panelen säger att villkoren inte är godkända än',
      /Användarvillkoren\s*inte godkända än/.test(await page.locator('.dp-fakta').first().innerText()),
      await page.locator('.dp-fakta').first().innerText());
    page.removeAllListeners('dialog');
    page.on('dialog', d => { dialoger.push(d.message()); d.dismiss(); });
    await page.click('[data-dp-bjud-igen="familj-1"]');
    await page.waitForSelector('.nx-fraga.open', { timeout: 3000 }).catch(() => {});
    prova('igen (' + igenSvar + '): frågar först, och säger vad som kan hända', (await text(page, '.nx-fraga-box')).includes('Har hen redan valt sitt lösenord skickas ingenting'));
    await page.click('.nx-fraga [data-svar="ja"]');
    await page.waitForFunction(n => window.__x || true, null);
    await vänta(700);
    const b = S.bjudIn[0];
    prova('igen (' + igenSvar + '): bjud-in får adressen och igen', b && b.epost === 'per@example.se' && b.igen === true, JSON.stringify(b));
    prova('igen (' + igenSvar + '): beskedet säger vad som gick', dialoger.includes(väntat), dialoger.join(' | '));
    prova('igen (' + igenSvar + '): inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
  /* Den som loggat in har ingen knapp. */
  {
    const { context, page } = await öppna(webb, {});
    await tillAdmin(page, 'studiehjalpare');
    await page.click('[data-dp="studiehjalpare:sh-1"]');
    await vänta(400);
    prova('igen: den som loggat in har ingen knapp', (await page.locator('[data-dp-bjud-igen]').count()) === 0);
    const fakta = await page.locator('.dp-fakta').first().innerText();
    prova('villkor: panelen säger när studiehjälparen godkände dem', /Användarvillkoren\s*godkända 3 oktober, när kontot skapades/.test(fakta),
      fakta);
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
    await provaPoolenUtanKonto(webb);
    await provaPoolenMedKonto(webb);
    await provaFamiljen(webb);
    await provaFamiljenElevenFaller(webb);
    await provaIgen(webb);
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
