/* ============================================================
   NEXTRUM — webbläsarprov för intaget i adminvyn (2026-10-06)

       NODE_PATH="$(npm root -g)" node verktyg/prova-intag.js [mapp för bilder]

   Leo: "när man ska ta in en anställd är det krångligt att skapa konto
   åt den, samma med familj". Utbildning hållen (Ta in i poolen till
   2026-10-21) skapar kontot med adressen i ansökan när ingen har den, Ta in familjen gör konto,
   inbjudan och elev i ett tryck, och Skicka inbjudan igen står vid den
   som aldrig loggat in. Sedan 2026-10-07 står knappen också vid den som
   loggat in, som Skicka länk för lösenord. Edge-funktionen bjud-in svarar här som den gör
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
        subject: 'Engelska, Matematik', tjanst: 'laxhjalp', status: 'new', created_at: nu(-30), kund_id: null,
        kalla: 'google', medium: 'cpc', kampanj: 'host26', message: 'Telefon: 070-111 22 33\nHej' },
      /* Intagen före 2026-10-21: kontot och eleven finns, anmälan står kvar. */
      { id: 'lead-gammal', parent_name: 'Per Persson', email: 'per@example.se', child_name: 'Pia', grade: 'Åk 5',
        subject: 'Matematik', tjanst: 'laxhjalp', status: 'matched', created_at: nu(-20000), kund_id: 'familj-1',
        kalla: 'facebook', medium: 'social', kampanj: null, message: 'Telefon: 070-999 88 77\nVi vill ha hjälp' }
    ],
    intagna_anmalningar: [],
    students: [
      { id: 'elev-pia', parent_id: 'familj-1', name: 'Pia', grade: 'Åk 5', matched_tutor_id: null, match_status: 'pending',
        created_at: nu(-19000) }
    ],
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
    /* Anmälan flyttas till familjen (2026-10-21), som intern.intag_lead:
       raden ur leads och källan, koden och meddelandet till
       intagna_anmalningar. Utan o.utanIntag finns funktionen. */
    intag_lead: o.utanIntag ? null : k => {
      const i = W.leads.findIndex(l => l.id === k.p_lead);
      if (i < 0) return { redan: true };
      const l = W.leads.splice(i, 1)[0];
      const familj = k.p_familj || l.kund_id;
      W.intagna_anmalningar.push({ id: l.id, parent_id: familj, anmald_at: l.created_at, kontaktad_at: l.kontaktad_at || null,
        intagen_at: nu(0), intagen_av: 'admin-1', tjanst: l.tjanst, grade: l.grade, subject: l.subject,
        kalla: l.kalla || null, medium: l.medium || null, kampanj: l.kampanj || null, kod: l.kod || null,
        meddelande: l.message || null });
      return { redan: false, familj, kalla: l.kalla || null };
    },
    mina_behorigheter: () => ({ admin: true, superadmin: true, behorigheter: [] }),
    /* Utbildning hållen (ansokningarnas_steg, 2026-10-21), som databasen:
       ansökan får kontot och blir godkänd, och profilen godkänns med
       timpenningen. */
    ansokan_utbildning_hallen: k => {
      const a = W.applications.find(x => x.id === k.p_ansokan);
      if (!a) return { ok: false, fel: 'Ansökan finns inte.' };
      Object.assign(a, { konto_id: k.p_konto, status: 'approved', utbildad_at: a.utbildad_at || nu(0) });
      const t = W.tutor_profiles.find(x => x.id === k.p_konto);
      if (t) Object.assign(t, { status: 'approved', hourly_rate: k.p_timpenning });
      return { ok: true, konto: k.p_konto, redan: false };
    },
    notisfel: () => [], ekonomiska_avvikelser: () => [], tipskoder_lage: () => [],
    admin_sett_markera: k => k.p_till,
    /* Adminens eget läge: panelen läser bara den gällande versionen ur det. */
    mitt_villkorslage: () => ({ version: '2026-09-30', godkant_at: '2026-10-01T09:00:00+00:00', tidigare: false }),
    /* Första timmen (2026-10-09): bara läget. Valet pass för pass togs
       bort 2026-10-15, och proven säger att inget anropar det. */
    forsta_timmen_lage: () => ({ beviljad: false, tagen: false, i_planen: false, pa_pass: false }),
    /* Gratistimmarna (2026-10-13): kortet står i klippkort_saldo som
       databasen skriver det, så att panelen ser det när vyn hämtar om. */
    ge_gratistimmar: k => {
      const sista = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
      const rad = { id: 'gava-' + (++löpnr), parent_id: k.p_familj, erbjudande: 'gratis', namn: 'Gratistimmar från Nextrum',
        sort: 'klippkort', timmar: k.p_timmar, anvanda: 0, kvar: k.p_timmar, giltigt_till: sista, status: 'betald',
        brukbar: true, betalt_ore: 0, betald_at: null, vid_uppsagning_ore: 0, vid_anger_ore: 0, angerfrist_till: null,
        created_at: nu(0) };
      (W.klippkort_saldo = W.klippkort_saldo || []).push(rad);
      return { ok: true, id: rad.id, timmar: k.p_timmar, giltigt_till: sista, betalda_pass: 0 };
    },
    ta_tillbaka_gratistimmar: k => {
      const i = (W.klippkort_saldo || []).findIndex(r => r.id === k.p_id);
      const rad = i >= 0 ? W.klippkort_saldo.splice(i, 1)[0] : null;
      return { ok: true, tillbaka: rad ? rad.timmar : 0, pa_pass: 0, borttagen: true };
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
        /* Som PostgREST: raderna tillbaka när vyn ber om dem (skriv() gör
           det sedan 2026-10-15, för att se en skrivning som inte träffade). */
        if ((req.headers()['prefer'] || '').includes('return=representation')) {
          const objekt = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
          return svar(route, 200, objekt ? (träff[0] || null) : träff);
        }
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

/* ============ 1. Utbildning hållen, utan konto ============
   Ta in i poolen blev Utbildning hållen (ansokningarnas_steg, 2026-10-21):
   kontot skapas med adressen i ansökan genom bjud-in, och databasen
   kopplar det och godkänner profilen (ansokan_utbildning_hallen). Stegen
   provas i prova-ansokningar.js; här provas intaget: adressen, namnet,
   rollen, ordningen och kvittot. */
async function provaPoolenUtanKonto(webb) {
  const { context, page, S, riktiga, konsol } = await öppna(webb, {});
  await tillAdmin(page, 'ansokningar');
  await page.click('#flik-ans-utbildning');
  await vänta(300);
  await page.click('#panel-ans-utbildning [data-dp="ansokan:ans-ny"]');
  await vänta(400);
  prova('intag: ansökan säger att Utbildning hållen skapar kontot', (await text(page, '.dp .ans-nu'))
    .includes('Utbildning hållen skapar kontot'), await text(page, '.dp .ans-nu'));
  await page.click('.dp [data-ans-hallen="ans-ny"]');
  await page.waitForSelector('#uh-ok', { timeout: 4000 }).catch(() => {});
  prova('intag: rutan säger att kontot skapas med adressen i ansökan och att hen väljer lösenordet',
    (await text(page, '.nx-fraga-box')).includes('sara.n@example.se')
    && (await text(page, '.nx-fraga-box')).includes('väljer sitt lösenord'), await text(page, '.nx-fraga-box'));
  prova('intag: knappen säger vad den gör', (await text(page, '#uh-ok')) === 'Skapa kontot och skicka inbjudan', await text(page, '#uh-ok'));
  await bild(page, 'intag-utbildning-hallen', '.nx-fraga-box');

  await page.click('#uh-ok');
  prova('intag: utan timpenning skickas ingenting', S.bjudIn.length === 0 && (await text(page, '#uh-msg')).includes('timpenningen'));
  await page.fill('#uh-timpenning', '180');
  await page.click('#uh-ok');
  await page.waitForFunction(() => /har fått sitt konto/.test((document.querySelector('.nx-fraga-box h3') || {}).textContent || ''),
    null, { timeout: 6000 }).catch(() => {});
  const b = S.bjudIn[0];
  prova('intag: bjud-in får adressen, namnet och rollen studiehjälpare', b && b.epost === 'Sara.N@example.se'
    && b.namn === 'Sara Nyberg' && b.roll === 'tutor' && !b.igen, JSON.stringify(b));
  const h = S.logg.find(r => r.väg === '/rest/v1/rpc/ansokan_utbildning_hallen');
  prova('intag: databasen kopplar det nya kontot, med timpenningen', h && h.kropp.p_ansokan === 'ans-ny'
    && h.kropp.p_konto === 'ny-1' && h.kropp.p_timpenning === 180, JSON.stringify(h && h.kropp));
  prova('intag: kontot skapas före kopplingen', S.logg.findIndex(r => r.väg === '/functions/v1/bjud-in')
    < S.logg.findIndex(r => r.väg === '/rest/v1/rpc/ansokan_utbildning_hallen'));
  prova('intag: vyn skriver inte själv i tutor_profiles eller applications',
    !S.logg.some(r => r.metod === 'PATCH' && (r.väg === '/rest/v1/tutor_profiles' || r.väg === '/rest/v1/applications')));
  prova('intag: kvittot säger vart länken gick', (await text(page, '.nx-fraga-box h3')) === 'Sara Nyberg har fått sitt konto'
    && (await text(page, '.nx-fraga-box')).includes('sara.n@example.se'), await text(page, '.nx-fraga-box'));
  await bild(page, 'intag-kvitto', '.nx-fraga-box');
  await page.click('[data-uh-stang]');
  prova('intag: Stäng stänger kvittot', !(await synlig(page, '.nx-fraga')));
  prova('intag: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('intag: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 2. Utbildning hållen, med kontot hen skapat själv ============ */
async function provaPoolenMedKonto(webb) {
  const { context, page, S, konsol } = await öppna(webb, {});
  await tillAdmin(page, 'ansokningar');
  await page.click('#flik-ans-utbildning');
  await vänta(300);
  await page.click('#panel-ans-utbildning [data-dp="ansokan:ans-har"]');
  await vänta(400);
  await page.click('.dp [data-ans-hallen="ans-har"]');
  await page.waitForSelector('#uh-ok', { timeout: 4000 }).catch(() => {});
  prova('intag med konto: kontot med samma adress kopplas, inget nytt skapas',
    (await text(page, '#uh-ok')) === 'Koppla kontot och godkänn' && (await text(page, '.nx-fraga-box')).includes('finns redan'),
    await text(page, '.nx-fraga-box'));
  await page.fill('#uh-timpenning', '170');
  await page.click('#uh-ok');
  await page.waitForFunction(() => /har fått sitt konto/.test((document.querySelector('.nx-fraga-box h3') || {}).textContent || ''),
    null, { timeout: 6000 }).catch(() => {});
  prova('intag med konto: ingen inbjudan', S.bjudIn.length === 0);
  const h = S.logg.find(r => r.väg === '/rest/v1/rpc/ansokan_utbildning_hallen');
  prova('intag med konto: databasen kopplar kontot som fanns', h && h.kropp.p_konto === 'sh-1' && h.kropp.p_timpenning === 170,
    JSON.stringify(h && h.kropp));
  prova('intag med konto: kvittot säger att hen loggar in med kontot hen har',
    (await text(page, '.nx-fraga-box')).includes('loggar in med kontot hen redan har'), await text(page, '.nx-fraga-box'));
  prova('intag med konto: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
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
  prova('familj: ingen ruta för första timmen pass för pass (2026-10-15)', (await page.locator('#le-forsta').count()) === 0
    && !/första timmen/i.test(await text(page, '.nx-fraga-box')), await text(page, '.nx-fraga-box'));
  prova('familj: fältet för gratistimmar finns och står på 0', (await page.locator('#le-gratis').count()) === 1
    && (await page.inputValue('#le-gratis')) === '0');
  await page.fill('#le-gratis', '41');
  await page.click('#le-skapa');
  await vänta(300);
  prova('familj: 41 gratistimmar nekas innan kontot skapas', S.bjudIn.length === 0
    && (await text(page, '#le-msg')).includes('mellan 0 och 40'), await text(page, '#le-msg'));
  await page.fill('#le-gratis', '3');
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
  /* 2026-10-21: anmälan flyttas till familjen sist, när eleven finns. */
  const flytt = S.logg.find(r => r.väg === '/rest/v1/rpc/intag_lead');
  prova('familj: anmälan flyttas till det nya kontot', flytt && flytt.kropp.p_lead === 'lead-ny' && flytt.kropp.p_familj === 'ny-1',
    JSON.stringify(flytt && flytt.kropp));
  prova('familj: flytten kommer efter eleven', S.logg.indexOf(flytt) > S.logg.findIndex(r => r.metod === 'POST' && r.väg === '/rest/v1/students'));
  prova('familj: kvittot säger att anmälan flyttats och inte står i listan', (await text(page, '.nx-fraga-box')).includes('är flyttad till familjen'),
    await text(page, '.nx-fraga-box'));
  prova('familj: anmälan står inte längre i listan', !S.W.leads.some(l => l.id === 'lead-ny')
    && (await page.locator('#leads-tabell [data-dp="anmalan:lead-ny"]').count()) === 0);
  prova('familj: vidare till matchningen finns', await synlig(page, '[data-le-match]'));
  prova('familj: ingen första timme pass för pass väljs', !S.logg.some(r => r.väg === '/rest/v1/rpc/ge_forsta_timmen'));
  prova('familj: kvittot säger inget om första timmen', !/första timmen/i.test(await text(page, '.nx-fraga-box')),
    await text(page, '.nx-fraga-box'));
  const gt = S.logg.find(r => r.väg === '/rest/v1/rpc/ge_gratistimmar');
  prova('familj: gratistimmarna sätts in på det nya kontot', gt && gt.kropp.p_familj === 'ny-1' && gt.kropp.p_timmar === 3,
    JSON.stringify(gt && gt.kropp));
  prova('familj: gratistimmarna sätts in efter kontot och före eleven', S.logg.indexOf(gt) > S.logg.findIndex(r => r.väg === '/functions/v1/bjud-in')
    && S.logg.indexOf(gt) < S.logg.findIndex(r => r.metod === 'POST' && r.väg === '/rest/v1/students'));
  prova('familj: kvittot säger hur många gratistimmar och till vilken dag', /3 gratistimmar står i familjens timbank, till och med \d+ \S+/
    .test(await text(page, '.nx-fraga-box')), await text(page, '.nx-fraga-box'));
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
  const nyaElever = S.W.students.filter(e => e.parent_id === 'ny-1');
  prova('eleven faller: andra trycket skapar eleven på kontot', nyaElever.length === 1,
    JSON.stringify(S.W.students));
  prova('eleven faller: kvittot säger att familjen är intagen', (await text(page, '.nx-fraga-box h3')) === 'Familjen är intagen');
  prova('eleven faller: anmälan flyttas först när eleven finns, en gång',
    S.logg.filter(r => r.väg === '/rest/v1/rpc/intag_lead').length === 1);
  prova('eleven faller: inga gratistimmar när fältet står på 0', !S.logg.some(r => r.väg === '/rest/v1/rpc/ge_gratistimmar'));
  prova('eleven faller: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 3c. Gratistimmar i familjens panel (2026-10-13) ============
   Översikt säger timbanken i korthet, och knappen går till Ekonomi, där
   gratistimmarna sätts in efter en fråga och tas tillbaka. */
async function provaGratistimmarIPanelen(webb) {
  const { context, page, S, konsol } = await öppna(webb, {});
  await tillAdmin(page, 'familjer');
  await page.click('[data-dp="familj:familj-1"]');
  await vänta(400);
  const fakta = await page.locator('.dp-fakta').first().innerText();
  prova('gratis: Översikt säger timbanken, utan timmar', /Timbanken\s*0 timmar/.test(fakta), fakta);
  prova('panel: första timmen är ett läge, utan knapp pass för pass (2026-10-15)',
    /Första timmen gratis\s*inte given än/.test(fakta) && (await page.locator('[data-dp-forsta]').count()) === 0, fakta);
  await page.click('.dp-fakta [data-dp-flik="ekonomi"]');
  await page.waitForSelector('form[data-dp-gratis="familj-1"]', { timeout: 3000 }).catch(() => {});
  prova('gratis: knappen går till Ekonomi, där rutan finns', await synlig(page, 'form[data-dp-gratis="familj-1"]'));
  await page.fill('#dp-gratis-n', '2');
  await page.click('form[data-dp-gratis] [type="submit"]');
  await page.waitForSelector('.nx-fraga.open', { timeout: 3000 }).catch(() => {});
  prova('gratis: frågar först, med antalet och sista dagen', /Sätt in 2 gratistimmar\?/.test(await text(page, '.nx-fraga-box h3'))
    && (await text(page, '.nx-fraga-box')).includes('till och med'), await text(page, '.nx-fraga-box'));
  await page.click('.nx-fraga [data-svar="ja"]');
  await page.waitForFunction(() => /insatta/.test((document.querySelector('.dp-gratis .ok-msg') || {}).textContent || ''),
    null, { timeout: 6000 }).catch(() => {});
  const gt = S.logg.find(r => r.väg === '/rest/v1/rpc/ge_gratistimmar');
  prova('gratis: ge_gratistimmar får familjen och antalet', gt && gt.kropp.p_familj === 'familj-1' && gt.kropp.p_timmar === 2,
    JSON.stringify(gt && gt.kropp));
  const panel = await page.locator('.dp').first().innerText();
  prova('gratis: kortet står i panelen med timmarna', panel.includes('Gratistimmar från Nextrum') && panel.includes('2 av 2 timmar kvar'), panel);
  prova('gratis: kvittot säger att de är insatta', (await text(page, '.dp-gratis .ok-msg')).startsWith('2 gratistimmar insatta, till och med'),
    await text(page, '.dp-gratis .ok-msg'));
  await bild(page, 'gratis-panelen', '.dp');
  await page.click('[data-dp-gratis-tillbaka]');
  await page.waitForSelector('.nx-fraga.open', { timeout: 3000 }).catch(() => {});
  prova('gratis: Ta tillbaka frågar först', (await text(page, '.nx-fraga-box')).includes('står kvar där'), await text(page, '.nx-fraga-box'));
  await page.click('.nx-fraga [data-svar="ja"]');
  await page.waitForFunction(() => /togs tillbaka/.test((document.querySelector('.dp-gratis .ok-msg') || {}).textContent || ''),
    null, { timeout: 6000 }).catch(() => {});
  const tt = S.logg.find(r => r.väg === '/rest/v1/rpc/ta_tillbaka_gratistimmar');
  prova('gratis: ta_tillbaka_gratistimmar får kortet', tt && /^gava-/.test(tt.kropp.p_id),
    JSON.stringify(tt && tt.kropp));
  prova('gratis: kortet är borta, och kvittot säger det', !(await page.locator('.dp').first().innerText()).includes('Gratistimmar från Nextrum')
    && (await text(page, '.dp-gratis .ok-msg')) === '2 gratistimmar togs tillbaka.', await text(page, '.dp-gratis .ok-msg'));
  prova('gratis: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 3d. Flytta till familjen, och familjen är intagen (2026-10-21) ============
   En anmälan som togs in före flytten står kvar i listan som Intagen.
   Knappen i panelen flyttar den, efter en fråga, och familjens panel
   öppnas med källan och meddelandet. Familjelistan säger Intagen, och
   barnet säger om det är matchat. */
async function provaFlyttaTillFamiljen(webb) {
  const { context, page, S, konsol } = await öppna(webb, {});
  await tillAdmin(page, 'familjer');
  const lista = await page.locator('#fam-tabell').innerText();
  prova('intag: familjelistan säger Intagen, inte matchad', /Intagen/.test(lista) && !/Ingen matchad|matchade/.test(lista), lista);
  await tillAdmin(page, 'leads');
  await page.click('[data-dp="anmalan:lead-gammal"]');
  await vänta(400);
  prova('intag: anmälan som redan är intagen heter Intagen', (await page.locator('.dp').first().innerText()).includes('Intagen'));
  prova('intag: knappen Flytta till familjen står där', await synlig(page, '[data-lead-intag="lead-gammal"]'));
  prova('intag: ingen Ta in familjen på en intagen anmälan', (await page.locator('[data-lead-elev="lead-gammal"]').count()) === 0);
  await page.click('[data-lead-intag="lead-gammal"]');
  await page.waitForSelector('.nx-fraga.open', { timeout: 3000 }).catch(() => {});
  prova('intag: frågar först, och säger vad som flyttas', (await text(page, '.nx-fraga-box')).includes('Källan, koden och det Per Persson skrev'),
    await text(page, '.nx-fraga-box'));
  await bild(page, 'intag-fraga', '.nx-fraga-box');
  await page.click('.nx-fraga [data-svar="ja"]');
  await page.waitForFunction(() => /Kom via/.test((document.querySelector('.dp') || {}).innerText || ''), null, { timeout: 6000 }).catch(() => {});
  const flytt = S.logg.find(r => r.väg === '/rest/v1/rpc/intag_lead');
  prova('intag: intag_lead får anmälan och familjen', flytt && flytt.kropp.p_lead === 'lead-gammal' && flytt.kropp.p_familj === 'familj-1',
    JSON.stringify(flytt && flytt.kropp));
  const panel = await page.locator('.dp').first().innerText();
  prova('intag: familjens panel öppnas med Intagen, källan och meddelandet', /Intagen/.test(panel) && /Kom via\s*facebook \/ social/.test(panel)
    && panel.includes('Vi vill ha hjälp'), panel);
  await bild(page, 'intag-familjen', '.dp');
  await page.click('.dp [data-dp-flik="barn"]');
  await vänta(300);
  prova('intag: barnet säger att det inte är matchat', /Ej matchad/.test(await page.locator('.dp').first().innerText()),
    await page.locator('.dp').first().innerText());
  prova('intag: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();

  /* Utan migrationen: Ta in familjen gör som förut och säger det. */
  const u = await öppna(webb, { utanIntag: true });
  await tillAdmin(u.page, 'leads');
  await u.page.click('[data-dp="anmalan:lead-ny"]');
  await vänta(400);
  await u.page.click('[data-lead-elev="lead-ny"]');
  await u.page.waitForSelector('#le-t', { timeout: 4000 }).catch(() => {});
  await u.page.click('#le-skapa');
  await u.page.waitForFunction(() => /intagen/.test((document.querySelector('.nx-fraga-box h3') || {}).textContent || ''), null, { timeout: 6000 }).catch(() => {});
  prova('intag utan migrationen: kvittot säger att anmälan är intagen, utan flytt', (await text(u.page, '.nx-fraga-box')).includes('är markerad som intagen'),
    await text(u.page, '.nx-fraga-box'));
  prova('intag utan migrationen: anmälan står kvar', u.S.W.leads.some(l => l.id === 'lead-ny'));
  prova('intag utan migrationen: inga fel i konsolen', u.konsol.length === 0, u.konsol.join(' | '));
  await u.context.close();
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
    prova('igen (' + igenSvar + '): frågar först, och säger att bara det nya mejlet fungerar sedan',
      (await text(page, '.nx-fraga-box')).includes('Bara länken i det nya mejlet fungerar sedan'));
    await page.click('.nx-fraga [data-svar="ja"]');
    await page.waitForFunction(n => window.__x || true, null);
    await vänta(700);
    const b = S.bjudIn[0];
    prova('igen (' + igenSvar + '): bjud-in får adressen och igen', b && b.epost === 'per@example.se' && b.igen === true, JSON.stringify(b));
    prova('igen (' + igenSvar + '): beskedet säger vad som gick', dialoger.includes(väntat), dialoger.join(' | '));
    prova('igen (' + igenSvar + '): inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
  /* Den som loggat in får knappen också (2026-10-07: "när vi vill"), men
     den heter Skicka länk för lösenord, och frågan säger att det nuvarande
     lösenordet fungerar tills ett nytt är valt. */
  {
    const { context, page, S } = await öppna(webb, { igenSvar: 'losenord' });
    await tillAdmin(page, 'studiehjalpare');
    await page.click('[data-dp="studiehjalpare:sh-1"]');
    await vänta(400);
    const knapp = page.locator('[data-dp-bjud-igen="sh-1"]');
    prova('igen: den som loggat in har knappen Skicka länk för lösenord',
      (await knapp.count()) === 1 && (await knapp.innerText()).trim() === 'Skicka länk för lösenord',
      (await knapp.count()) ? await knapp.innerText() : 'ingen knapp');
    page.removeAllListeners('dialog');
    page.on('dialog', d => d.dismiss());
    await knapp.click();
    await page.waitForSelector('.nx-fraga.open', { timeout: 3000 }).catch(() => {});
    prova('igen: frågan säger att det nuvarande lösenordet fungerar tills ett nytt är valt',
      (await text(page, '.nx-fraga-box')).includes('Det nuvarande lösenordet fungerar tills hen valt ett nytt'));
    await page.click('.nx-fraga [data-svar="ja"]');
    await vänta(700);
    prova('igen: bjud-in får adressen och igen, för den som loggat in också',
      S.bjudIn.length === 1 && S.bjudIn[0].igen === true, JSON.stringify(S.bjudIn));
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
    await provaGratistimmarIPanelen(webb);
    await provaFlyttaTillFamiljen(webb);
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
