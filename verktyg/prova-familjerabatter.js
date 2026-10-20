/* ============================================================
   NEXTRUM — webbläsarprov för familjerabatterna (familjerabatter,
   2026-10-15)

       NODE_PATH="$(npm root -g)" node verktyg/prova-familjerabatter.js [mapp för bilder]

   Leo: "vi i admin vill skapa egna rabattkoder som bara vi har tillgång
   till ... vi ser rabattkoden när vi klickar på deras namn och kan välja
   ta bort eller ändra ... de ser bara att de har rabatt vid checkout men
   inte annat", och samma kväll om korten under Erbjudanden: "Visa på
   korten också". Provet går igenom fliken Familjerabatter under Tjänster
   (skapa, nytt belopp, stäng av), familjens panel (raden under Översikt,
   valet under Ekonomi, Ta bort), passets panel och Ta in familjen, och
   studievyn: priset vid knappen i Boka pass, på plankortet och i Fyll
   timbanken och i Köp till timmar, med och utan rabatt, och vyerna utan
   migrationen. Databasens regler provas i
   rls-test.sql (avsnittet FR); här provas vyerna, mot en falsk Supabase,
   som verktyg/prova-koder.js (egen port, 8977). Ett anrop till den
   riktiga adressen fäller provet.
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
const PORT = 8977;
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
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const dag = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

function jwt(sub, roll) {
  const b = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  return b({ alg: 'HS256', typ: 'JWT' }) + '.' + b({ sub, role: roll, exp: 4102444800 }) + '.provet';
}
const ADMIN = { id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'leo@example.se',
  app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-09-01T10:00:00Z' };
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
        match_status: 'matched', matched_tutor_id: 'sh-a', created_at: '2026-09-20T10:00:00Z', last_seen_at: nu(-60) },
      { id: 'sh-a', role: 'tutor', full_name: 'Sara Ahl', email: 'sara@example.se', is_admin: false,
        created_at: '2026-09-01T10:00:00Z', last_seen_at: nu(-30) }
    ],
    tutor_profiles: [{ id: 'sh-a', status: 'approved', hourly_rate: 150, created_at: '2026-09-01T10:00:00Z' }],
    students: [
      { id: 'elev-a', parent_id: 'fam-a', name: 'Kim', matched_tutor_id: 'sh-a', match_status: 'matched',
        created_at: '2026-09-10T10:00:00Z' },
      { id: 'elev-b', parent_id: 'fam-b', name: 'Lo', matched_tutor_id: 'sh-a', match_status: 'matched',
        created_at: '2026-09-20T10:00:00Z' }
    ],
    leads: [
      { id: 'lead-x', parent_name: 'Xenia Ek', email: 'xenia@example.se', child_name: 'Max', grade: 'Åk 9',
        subject: 'Engelska', status: 'new', created_at: nu(-120), kund_id: null }
    ],
    tjanster: [{ kod: 'laxhjalp', namn: 'Läxhjälp', aktiv: true, for_jobb: true, for_kund: true, ordning: 1,
      pris_per_timme_ore: 39900, extra_personer_ore: 6900, extra_personer_max: 3 }],
    rabattkoder: [{ kod: 'SOMMAR10', typ: 'procent', varde: 10, aktiv: true, antal_anvandningar: 0, skapad: nu(-9000) }],
    familjerabatter: [
      { kod: 'PARTNER-X', beskrivning: 'Samarbete med föreningen X', ore_per_timme: 1000, aktiv: true, skapad: nu(-3000) },
      { kod: 'PARTNER-Z', beskrivning: null, ore_per_timme: 2500, aktiv: true, skapad: nu(-4000) },
      { kod: 'GAMMAL', beskrivning: null, ore_per_timme: 2000, aktiv: false, skapad: nu(-9000) }
    ],
    familjens_rabatt: [{ parent_id: 'fam-a', kod: 'PARTNER-X', andrad_at: nu(-2000), andrad_av: 'admin-1' }],
    flaggor: [{ kod: 'erbjudanden', aktiv: true, beskrivning: 'Erbjudandena', uppdaterad: '2026-09-27T10:00:00Z' }],
    admin_sett: [{ omrade: 'leads', sett_till: nu(-1) }, { omrade: 'ansokningar', sett_till: nu(-1) }],
    /* Ett pass bokat med rabatten: timpriset är redan sänkt. */
    bookings: [{ id: 'pass-1', parent_id: 'fam-a', tutor_id: 'sh-a', student_id: 'elev-a', subject: 'Matematik',
      tjanst: 'laxhjalp', wanted_date: dag(9), wanted_time: '16:00', duration_min: 60, status: 'confirmed',
      betalning_status: 'ingen', fakturerbar: true, startrabatt: false, rabatt_ore: null, timpris_ore: 38900,
      extra_ore: 6900, familjerabatt_ore: 1000, antal_barn: 1, created_at: nu(-600) }],
    /* Familjens plan, för Köp till timmar. Timmarna är använda, så att
       Boka pass visar priset i stället för timmarna. */
    klippkort_saldo: [{ id: 'plan-a', parent_id: 'fam-a', erbjudande: 'plan_standard', namn: 'Standardplan', sort: 'plan',
      timmar: 8, anvanda: 8, kvar: 0, giltigt_till: dag(20), status: 'betald', begart_ore: 295200, betalt_ore: 295200,
      aterbetald_ore: 0, timpris_ore: 39900, betald_at: nu(-1440), created_at: nu(-1440), brukbar: false,
      vid_uppsagning_ore: 295200, angerfrist_till: dag(13), vid_anger_ore: 295200, gratis_kvar: 0, gratis_till: null,
      aterkallad_at: null, till_plan: null, rabatterat_timpris_ore: 37900, familjerabatt_ore: 1000 }],
    erbjudanden_pris: [
      { kod: 'plan_standard', sort: 'plan', namn: 'Standard', timmar: 8, rabatt_procent: 5, giltig_manader: 1,
        ordning: 2, timpris_ore: 39900, ordinarie_ore: 319200, pris_ore: 303200, rabatterat_timpris_ore: 37900,
        timmar_pa_kopet: 0 },
      { kod: 'klipp10', sort: 'klippkort', namn: '10 timmar', timmar: 10, rabatt_procent: 0, giltig_manader: 6,
        ordning: 10, timpris_ore: 39900, ordinarie_ore: 399000, pris_ore: 399000, rabatterat_timpris_ore: 39900,
        timmar_pa_kopet: 0 }
    ]
  };
}

function falskSupabase(o) {
  const ANV = (o && o.anv) || ADMIN;
  const W = värld();
  if (o && o.värld) o.värld(W);
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
  /* Utan migrationen: tabellerna och funktionerna finns inte. */
  const SAKNAS = o && o.utanMigrationen ? ['familjerabatter', 'familjens_rabatt', 'min_familjerabatt', 'satt_familjerabatt'] : [];
  const RPC = {
    mina_behorigheter: () => (familj ? { admin: false, superadmin: false, behorigheter: [] }
      : { admin: true, superadmin: true, behorigheter: [] }),
    notisfel: () => [], ekonomiska_avvikelser: () => [],
    admin_sett_markera: k => k.p_till,
    mitt_villkorslage: () => ({ version: '2026-10-15', godkant_at: '2026-10-15T09:00:00+00:00', tidigare: false }),
    forsta_timmen_lage: () => ({ beviljad: false, tagen: false, i_planen: false, pa_pass: false }),
    /* Bara beloppet per timme, för den inloggade familjen. */
    min_familjerabatt: () => {
      const r = W.familjens_rabatt.find(x => x.parent_id === ANV.id);
      const k = r && r.kod ? W.familjerabatter.find(x => x.kod === r.kod && x.aktiv) : null;
      return k ? k.ore_per_timme : 0;
    },
    satt_familjerabatt: k => {
      const ren = k.p_kod ? String(k.p_kod).trim().toUpperCase() : null;
      const kod = ren ? W.familjerabatter.find(x => x.kod === ren) : null;
      if (ren && (!kod || !kod.aktiv)) return { __fel: [400, '22023', 'Familjerabatten ' + ren + ' är avstängd.'] };
      const rad = W.familjens_rabatt.find(x => x.parent_id === k.p_familj);
      if (rad) Object.assign(rad, { kod: ren, andrad_at: nu(0), andrad_av: 'admin-1' });
      else W.familjens_rabatt.push({ parent_id: k.p_familj, kod: ren, andrad_at: nu(0), andrad_av: 'admin-1' });
      return { ok: true, kod: ren, ore_per_timme: kod ? kod.ore_per_timme : 0 };
    },
    /* Timmar till planen, som extra_timmar_erbjudande räknar dem. */
    extra_timmar_erbjudande: k => {
      const d = RPC.min_familjerabatt();
      return { ok: true, plan: 'plan-a', plan_namn: 'Standardplan', timmar: k.p_timmar, timpris_ore: 39900,
        rabatt_procent: 5, rabatterat_timpris_ore: 37900, familjerabatt_ore: d, pris_ore: (37900 - d) * k.p_timmar,
        giltigt_till: dag(20) };
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
    if (p === '/auth/v1/user') return svar(route, 200, ANV);
    if (p.startsWith('/auth/v1/')) return svar(route, 200, {});
    if (p.startsWith('/functions/v1/')) return svar(route, 404, {});
    if (p.startsWith('/storage/v1/')) return svar(route, 200, {});
    if (p.startsWith('/rest/v1/rpc/')) {
      const namn = p.slice('/rest/v1/rpc/'.length);
      const f = SAKNAS.includes(namn) ? null : RPC[namn];
      if (!f) return svar(route, 404, { code: 'PGRST202', message: 'Could not find the function' });
      const ut = f(kropp || {});
      if (ut && ut.__fel) return svar(route, ut.__fel[0], { code: ut.__fel[1], message: ut.__fel[2] });
      return svar(route, 200, ut);
    }
    if (p.startsWith('/rest/v1/')) {
      const tabell = p.slice('/rest/v1/'.length);
      if (SAKNAS.includes(tabell)) {
        return svar(route, 404, { code: 'PGRST205', message: 'Could not find the table public.' + tabell + ' in the schema cache' });
      }
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
        if (tabell === 'familjerabatter') { delete rad.id; rad.aktiv = rad.aktiv !== false; rad.skapad = nu(0); }
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
  await context.addInitScript(([nyckel, värde]) => {
    try { localStorage.setItem(nyckel, värde); sessionStorage.setItem('nx-notisruta-visad', '1'); } catch (e) { /* ingen lagring */ }
  }, [LAGRING, JSON.stringify(S.session())]);
  const page = await context.newPage();
  page.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource|PGRST20[25]|Could not find the (table|function)/.test(m.text())) konsol.push(m.text());
  });
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
/* Öppnar en panel som en lista gör: en knapp med data-dp. */
async function öppnaPanel(page, mål, flik) {
  await page.evaluate(([m, f]) => {
    const b = document.createElement('button');
    b.dataset.dp = m;
    if (f) b.dataset.dpStart = f;
    document.body.appendChild(b);
    b.click();
    b.remove();
  }, [mål, flik || null]);
  await page.waitForSelector('.dp.ar-oppen', { timeout: 3000 }).catch(() => {});
  await vänta(500);
}
async function svaraJa(page) {
  await page.waitForSelector('.nx-fraga-box [data-svar="ja"]', { timeout: 3000 }).catch(() => {});
  const fråga = await text(page, '.nx-fraga-box');
  await page.click('.nx-fraga-box [data-svar="ja"]').catch(() => {});
  await vänta(500);
  return fråga;
}
const ingenSidled = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/* ============ 1. Fliken Familjerabatter ============ */
async function provaFliken(webb) {
  const { context, page, S, riktiga, konsol } = await öppna(webb, {});
  await tillAdmin(page, 'katalog/familjerabatter');
  prova('fliken: Tjänster har fliken Familjerabatter', await synlig(page, '#flik-familjerabatter'));
  prova('fliken: adressen öppnar den', await synlig(page, '#panel-familjerabatter #frab-form'));
  const tabell = await text(page, '#frab-tabell');
  prova('fliken: koderna står med beskrivning, antal familjer och läge',
    /PARTNER-X/.test(tabell) && /Samarbete med föreningen X/.test(tabell) && /GAMMAL/.test(tabell)
      && /Aktiv/.test(tabell) && /Avstängd/.test(tabell), tabell);
  prova('fliken: PARTNER-X bärs av en familj, och beloppet står i fältet',
    (await page.inputValue('form[data-fr-belopp="PARTNER-X"] input')) === '10'
      && /PARTNER-X[\s\S]*\b1\b/.test(tabell), tabell);
  prova('fliken: antalet står i rubriken', (await text(page, '#frab-antal')) === '3 st', await text(page, '#frab-antal'));
  await bild(page, 'fliken', '#panel-familjerabatter');

  /* Formuläret: villkoren, och en krock med en rabattkod. */
  await page.fill('#frab-kod', 'x');
  await page.fill('#frab-kr', '10');
  await page.click('#frab-spara');
  await vänta(200);
  prova('fliken: en för kort kod nekas med ett besked', /A–Z, 0–9 och bindestreck/.test(await text(page, '#frab-msg')),
    await text(page, '#frab-msg'));
  await page.fill('#frab-kod', 'partner-y');
  await page.fill('#frab-kr', '250');
  await page.click('#frab-spara');
  await vänta(200);
  prova('fliken: mer än 200 kr nekas', /mellan 1 och 200/.test(await text(page, '#frab-msg')), await text(page, '#frab-msg'));
  await page.fill('#frab-kod', 'sommar10');
  await page.fill('#frab-kr', '15');
  await page.click('#frab-spara');
  await vänta(200);
  prova('fliken: ett namn som en rabattkod redan har nekas', /redan en rabattkod som heter SOMMAR10/.test(await text(page, '#frab-msg')),
    await text(page, '#frab-msg'));
  prova('fliken: inget skickades för de tre', !S.logg.some(r => r.metod === 'POST' && r.väg === '/rest/v1/familjerabatter'));

  await page.fill('#frab-kod', 'partner-y');
  await page.fill('#frab-kr', '15');
  await page.fill('#frab-text', 'Föreningen Y');
  await page.click('#frab-spara');
  await page.waitForFunction(() => /PARTNER-Y är skapad/.test(document.querySelector('#frab-msg').textContent), null, { timeout: 4000 }).catch(() => {});
  const post = S.logg.find(r => r.metod === 'POST' && r.väg === '/rest/v1/familjerabatter');
  prova('fliken: en ny kod skickas i versaler och i öre',
    post && post.kropp && post.kropp.kod === 'PARTNER-Y' && post.kropp.ore_per_timme === 1500
      && post.kropp.beskrivning === 'Föreningen Y', JSON.stringify(post && post.kropp));
  prova('fliken: kvittot säger var den sätts, och den står i tabellen',
    /familjens panel, under Ekonomi/.test(await text(page, '#frab-msg')) && /PARTNER-Y/.test(await text(page, '#frab-tabell')),
    await text(page, '#frab-msg'));

  /* Nytt belopp: frågan säger hur många familjer det rör. */
  await page.fill('form[data-fr-belopp="PARTNER-X"] input', '20');
  await page.click('form[data-fr-belopp="PARTNER-X"] button');
  const fråga = await svaraJa(page);
  prova('fliken: ett nytt belopp frågar först och säger familjen och att det bokade står fast',
    /Ändra PARTNER-X till 20 kr per timme/.test(fråga) && /Familjen med koden betalar 20 kr mindre/.test(fråga)
      && /redan är bokat och köpt behåller sitt pris/.test(fråga), fråga);
  const patch = S.logg.find(r => r.metod === 'PATCH' && r.väg === '/rest/v1/familjerabatter' && /PARTNER-X/.test(r.sök));
  prova('fliken: och skriver beloppet i öre', patch && patch.kropp && patch.kropp.ore_per_timme === 2000,
    JSON.stringify(patch && patch.kropp));

  /* Stäng av: frågar när en familj bär koden. */
  await page.click('[data-fr-vaxla="PARTNER-X"]');
  const fråga2 = await svaraJa(page);
  prova('fliken: Stäng av frågar när en familj har koden', /Stäng av PARTNER-X/.test(fråga2)
    && /En familj har koden/.test(fråga2) && /ordinarie pris/.test(fråga2), fråga2);
  const av = S.logg.find(r => r.metod === 'PATCH' && r.väg === '/rest/v1/familjerabatter' && r.kropp && r.kropp.aktiv === false);
  prova('fliken: och stänger av koden', !!av && /Avstängd/.test(await text(page, '#frab-tabell')), JSON.stringify(av));
  /* Slå på igen frågar inte. */
  await page.click('[data-fr-vaxla="PARTNER-X"]');
  await vänta(400);
  prova('fliken: Slå på frågar inte', !(await synlig(page, '.nx-fraga-box'))
    && S.logg.some(r => r.metod === 'PATCH' && r.väg === '/rest/v1/familjerabatter' && r.kropp && r.kropp.aktiv === true));

  /* Telefonen. */
  await page.setViewportSize({ width: 390, height: 844 });
  await vänta(300);
  prova('fliken: inget i sidled på en telefon', await ingenSidled(page));
  await bild(page, 'fliken-telefon', '#panel-familjerabatter');
  await page.emulateMedia({ colorScheme: 'dark' });
  await vänta(300);
  await bild(page, 'fliken-telefon-morkt', '#panel-familjerabatter');

  prova('fliken: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('fliken: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 2. Familjens panel, passets panel och Ta in familjen ============ */
async function provaPanelen(webb) {
  const { context, page, S, riktiga, konsol } = await öppna(webb, {});
  await tillAdmin(page, 'familjer');

  await öppnaPanel(page, 'familj:fam-a');
  const fakta = await text(page, '.dp .dp-fakta');
  prova('panelen: Översikt säger familjens kod och beloppet', /Familjerabatt/.test(fakta)
    && /PARTNER-X, 10 kr av per timme/.test(fakta), fakta);
  await page.click('.dp [data-dp-flik="ekonomi"]');
  await vänta(400);
  const eko = await text(page, '.dp');
  prova('panelen: Ekonomi har rutan, med vem och när', /Familjerabatt/.test(eko) && /PARTNER-X, 10 kr av per timme/.test(eko)
    && /satt .* av Leo Admin/.test(eko) && /Byt till/.test(eko), eko.slice(0, 1500));
  prova('panelen: Byt till har de aktiva koderna utom familjens egen',
    (await page.locator('form[data-dp-rabatt] option').allInnerTexts()).join('|') === 'PARTNER-Z, 25 kr per timme',
    (await page.locator('form[data-dp-rabatt] option').allInnerTexts()).join('|'));
  await bild(page, 'panelen-ekonomi', '.dp');

  await page.click('[data-dp-rabatt-bort="fam-a"]');
  const fråga = await svaraJa(page);
  prova('panelen: Ta bort frågar först och säger att det bokade står fast', /Ta bort familjerabatten/.test(fråga)
    && /ordinarie pris/.test(fråga) && /behåller priset med rabatten/.test(fråga), fråga);
  const bort = S.logg.find(r => r.väg === '/rest/v1/rpc/satt_familjerabatt');
  prova('panelen: Ta bort skickar null', bort && bort.kropp && bort.kropp.p_familj === 'fam-a' && bort.kropp.p_kod === null,
    JSON.stringify(bort && bort.kropp));
  await vänta(400);
  const efter = await text(page, '.dp');
  prova('panelen: kvittot står, och rutan säger ingen rabatt', /Familjerabatten PARTNER-X är borttagen/.test(efter)
    && /Ingen familjerabatt/.test(efter) && /Ge rabatten/.test(efter)
    && (await page.locator('form[data-dp-rabatt] option').allInnerTexts()).join('|') === 'PARTNER-X, 10 kr per timme|PARTNER-Z, 25 kr per timme',
    efter.slice(0, 1500));

  /* En annan familj får koden. */
  await öppnaPanel(page, 'familj:fam-b', 'ekonomi');
  await page.selectOption('form[data-dp-rabatt] select', 'PARTNER-X');
  await page.click('form[data-dp-rabatt] button[type="submit"]');
  const fråga2 = await svaraJa(page);
  prova('panelen: Ge frågar först och säger vad familjen ser', /Ge PARTNER-X/.test(fråga2)
    && /Bo Berg betalar 10 kr mindre för varje timme/.test(fråga2) && /aldrig koden/.test(fråga2), fråga2);
  const ge = S.logg.filter(r => r.väg === '/rest/v1/rpc/satt_familjerabatt').pop();
  prova('panelen: Ge skickar koden', ge && ge.kropp && ge.kropp.p_familj === 'fam-b' && ge.kropp.p_kod === 'PARTNER-X',
    JSON.stringify(ge && ge.kropp));
  await vänta(400);
  const räknat = await page.$$eval('#frab-tabell tr', rader => rader.map(r => Array.from(r.cells).map(c => c.textContent.trim()).join('|')));
  prova('panelen: och fliken räknar familjen', räknat.some(r => /^PARTNER-X/.test(r) && /\|1\|Aktiv/.test(r)), räknat.join(' / '));

  /* Passets panel: timpriset med rabatten dragen. */
  await öppnaPanel(page, 'pass:pass-1');
  const pass = await text(page, '.dp .dp-fakta');
  prova('passet: timpriset står med familjerabatten dragen', /389 kr per timme, med familjerabatten 10 kr dragen/.test(pass), pass);
  await page.keyboard.press('Escape');
  await vänta(300);

  /* Ta in familjen: valet står bredvid gratistimmarna. */
  await page.goto(BAS + '/admin#leads');
  await vänta(1000);
  await page.evaluate(() => {
    const b = document.createElement('button');
    b.dataset.leadElev = 'lead-x';
    document.body.appendChild(b);
    b.click();
    b.remove();
  });
  await page.waitForSelector('.nx-fraga-box #le-rabatt', { timeout: 3000 }).catch(() => {});
  const val = await page.locator('.nx-fraga-box #le-rabatt option').allInnerTexts().catch(() => []);
  prova('ta in familjen: rutan har Familjerabatt, Ingen som förval och de aktiva koderna',
    val.join('|') === 'Ingen|PARTNER-X, 10 kr av per timme|PARTNER-Z, 25 kr av per timme', val.join('|'));
  await bild(page, 'ta-in-familjen', '.nx-fraga-box');

  prova('panelen: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('panelen: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 3. Studievyn: priset med rabatten ============ */
async function väljDagOchTid(page) {
  const host = '#boka-inner';
  await page.waitForSelector(host + ' .mv-dag', { timeout: 8000 }).catch(() => {});
  for (let n = 3; n < 40; n++) {
    const d = dag(n);
    const finns = await page.locator(host + ' .mv-dag[data-datum="' + d + '"]:not([disabled])').count();
    if (!finns) {
      if (!(await page.locator(host + ' .mv-dag[data-datum="' + d + '"]').count())) {
        await page.click(host + ' #bk-nasta').catch(() => {});
        await vänta(80);
      }
      continue;
    }
    await page.click(host + ' .mv-dag[data-datum="' + d + '"]');
    await page.waitForSelector(host + ' .mv-tid', { timeout: 3000 }).catch(() => {});
    if (await page.locator(host + ' .mv-tid').count()) {
      await page.locator(host + ' .mv-tid').first().click();
      await vänta(150);
      return true;
    }
  }
  return false;
}

async function provaStudievyn(webb) {
  for (const [namn, o, rabatt] of [['med rabatt', { anv: FAMILJ }, true],
    ['utan rabatt', { anv: FAMILJ, värld: W => { W.familjens_rabatt = []; } }, false],
    ['utan migrationen', { anv: FAMILJ, utanMigrationen: true }, false]]) {
    const { context, page, S, riktiga, konsol } = await öppna(webb, o);
    await page.goto(BAS + '/foralder#boka');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
    await vänta(900);
    const vald = await väljDagOchTid(page);
    const pris = await text(page, '#boka-inner .bk-sum-pris');
    prova('studievyn ' + namn + ': priset vid knappen', vald && (rabatt
      ? /389\s*kr/.test(pris) && /1 timme, med er rabatt/.test(pris)
      : /399\s*kr/.test(pris) && !/rabatt/.test(pris)), (vald ? '' : 'ingen tid vald; ') + pris);
    if (rabatt) {
      /* Två barn: tillägget står kvar, rabatten bara på timpriset. */
      if (await page.locator('#boka-inner #bk-barn [data-v="2"]').count()) {
        await page.click('#boka-inner #bk-barn [data-v="2"]');
        await vänta(150);
        prova('studievyn med rabatt: två barn kostar timpriset efter rabatten och hela tillägget',
          /458\s*kr/.test(await text(page, '#boka-inner .bk-sum-pris')), await text(page, '#boka-inner .bk-sum-pris'));
      }
      await bild(page, 'studievyn-boka', '#boka-inner .bk-sum');
    }

    /* Korten under Erbjudanden säger priset med rabatten (Leo 2026-10-15:
       "Visa på korten också"), aldrig koden: Standard 8 betalda timmar,
       10 kr av på var och en, och Fyll timbanken 10 timmar. */
    await page.goto(BAS + '/foralder#erbjudanden');
    await vänta(900);
    const plan = await text(page, '#erb-planer .erb-kort:not(.erb-klippkol)');
    prova('studievyn ' + namn + ': plankortet', rabatt
      ? /2\s*952\s*kr/.test(plan) && /med er rabatt/.test(plan) && /369\s*kr/.test(plan) && /3\s*192\s*kr/.test(plan)
      : /3\s*032\s*kr/.test(plan) && /379\s*kr/.test(plan) && !/er rabatt/.test(plan), plan);
    await page.click('#erb-planer .erb-klippkol summary').catch(() => {});
    await vänta(250);
    const klipp = await text(page, '#erb-planer .erb-klippkol');
    prova('studievyn ' + namn + ': Fyll timbanken', rabatt
      ? /3\s*890\s*kr/.test(klipp) && /389\s*kr per timme/.test(klipp) && /med er rabatt/.test(klipp)
      : /3\s*990\s*kr/.test(klipp) && /399\s*kr per timme/.test(klipp) && !/er rabatt/.test(klipp), klipp);
    prova('studievyn ' + namn + ': korten säger aldrig koden', !/PARTNER/.test(await text(page, '#erb-planer')));
    if (rabatt) await bild(page, 'studievyn-kort', '#erb-planer');

    /* Köp till timmar: priset efter rabatten, i steget före kassan. */
    await page.click('[data-extra-valj]').catch(() => {});
    await vänta(300);
    const extra = await text(page, '#erb-mina .erb-extra');
    prova('studievyn ' + namn + ': Köp till timmar', rabatt
      ? /738\s*kr/.test(extra) && /med er rabatt/.test(extra) && /379 kr i timmen/.test(extra)
      : /758\s*kr/.test(extra) && !/med er rabatt/.test(extra), extra);
    if (rabatt) {
      await page.click('[data-extra-steg="1"]');
      await vänta(150);
      prova('studievyn med rabatt: stegen räknar med rabatten', /1\s*107\s*kr/.test(await text(page, '#erb-mina .erb-extra-pris')),
        await text(page, '#erb-mina .erb-extra-pris'));
      await bild(page, 'studievyn-kop-till', '#erb-mina .erb-extra');
    }
    prova('studievyn ' + namn + ': frågar efter beloppet, aldrig koden',
      S.logg.some(r => r.väg === '/rest/v1/rpc/min_familjerabatt')
        && !S.logg.some(r => /familjens_rabatt|familjerabatter/.test(r.väg)));
    prova('studievyn ' + namn + ': inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
    prova('studievyn ' + namn + ': inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
}

/* ============ 4. Adminvyn utan migrationen ============ */
async function provaUtanMigrationen(webb) {
  const { context, page, riktiga, konsol } = await öppna(webb, { utanMigrationen: true });
  await tillAdmin(page, 'katalog/familjerabatter');
  prova('utan migrationen: fliken säger att den inte är körd', /Migrationen familjerabatter är inte körd/.test(await text(page, '#frab-tabell')),
    await text(page, '#frab-tabell'));
  await öppnaPanel(page, 'familj:fam-a', 'ekonomi');
  const eko = await text(page, '.dp');
  /* Resten av Ekonomi: talet för hållna pass som inte är betalda (Faktura
     som betalsätt stod här till 2026-10-21). */
  prova('utan migrationen: panelen säger det, och resten av Ekonomi står', /Familjerabatterna finns inte i databasen än/.test(eko)
    && /Hållna, inte betalda/.test(eko), eko.slice(0, 800));
  await öppnaPanel(page, 'pass:pass-1');
  prova('utan migrationen: passets panel står', /Timpris/.test(await text(page, '.dp .dp-fakta')));
  prova('utan migrationen: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('utan migrationen: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

(async function () {
  const server = spawn('python3', [path.join(ROT, '.claude', 'serve.py'), String(PORT)], { stdio: 'ignore' });
  let klar = false;
  for (let i = 0; i < 50 && !klar; i++) {
    try { klar = (await fetch(BAS + '/admin')).ok; } catch (e) { await vänta(100); }
  }
  const webb = await pw.chromium.launch();
  try {
    await provaFliken(webb);
    await provaPanelen(webb);
    await provaStudievyn(webb);
    await provaUtanMigrationen(webb);
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
