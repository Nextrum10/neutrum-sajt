/* ============================================================
   NEXTRUM — webbläsarprov för första inloggningen och rundturen
   (2026-10-06, rundturen i den riktiga vyn sedan 2026-10-27)

       NODE_PATH="$(npm root -g)" node verktyg/prova-introduktion.js [mapp för bilder]

   Byggt som verktyg/prova-aterstallning.js (egen port, 8967): sidorna
   serveras av .claude/serve.py, nextrum-config.js byts i farten mot en
   som pekar på https://supabase.test, och varje anrop dit besvaras här
   av en falsk Supabase som minns user_metadata, som Auth gör. Ett anrop
   till den riktiga adressen fäller provet. Körs inte i CI: Playwright
   är ingen del av repot.

   Det som provas: rutan för första lösenordet (inbjudans länk, och
   välkomsten 'losenord' utan länk), att den inte går att hoppa över men
   att Logga ut finns, rundturen i den färdiga vyn efter lösenordet (att
   den byter sektion med menyn, att hålet och rutan står på skärmen och
   inte över varandra, att ett tryck var som helst går vidare och inte
   trycker på något i vyn), att välkomsten tas bort, rundturen igen från
   Profil, telefonen i ljust och mörkt, att en familj som inte är matchad
   än kommer in och får veta varför bokningen och köpen väntar, och att
   Senast inloggad stämplas också då. Att kontot skapas utan lösenord provas i
   _delad/inbjudan_test.ts; adminvyns del i prova-intag.js.
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
const PORT = 8967;
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

/* ============ den falska Supabase ============
   o.metadata: user_metadata för den inloggade, som Auth minns den.
   o.matchad: familjen är matchad eller inte (bokningen och köpen väntar).
   o.godkand: studiehjälparens profil är godkänd eller väntar. */
function falskSupabase(o) {
  const logg = [];
  const användare = {
    'foralder-1': { id: 'foralder-1', aud: 'authenticated', role: 'authenticated', email: 'anna@example.se',
                    app_metadata: { provider: 'email' }, user_metadata: Object.assign({}, o.metadata || {}),
                    created_at: '2026-10-06T10:00:00Z' },
    'handledare-1': { id: 'handledare-1', aud: 'authenticated', role: 'authenticated', email: 'sara@example.se',
                      app_metadata: { provider: 'email' }, user_metadata: Object.assign({}, o.metadata || {}),
                      created_at: '2026-10-06T10:00:00Z' }
  };
  const W = {
    profiles: [
      { id: 'foralder-1', role: 'parent', full_name: 'Anna Andersson', email: 'anna@example.se', is_admin: false,
        match_status: o.matchad ? 'matched' : 'pending', matched_tutor_id: o.matchad ? 'handledare-1' : null },
      { id: 'handledare-1', role: 'tutor', full_name: 'Sara Svensson', email: 'sara@example.se', is_admin: false }
    ],
    tutor_profiles: [{ id: 'handledare-1', status: o.godkand ? 'approved' : 'pending', school: null, city: null,
      subjects: ['Matematik'], grade_levels: [], formats: [], bio: null, age: 22, hourly_rate: 180 }],
    /* Erbjudandena på, med ett klippkort: en matchad familj får Köp, en
       som inte är matchad än inte (2026-10-07). */
    flaggor: [{ kod: 'erbjudanden', aktiv: true }],
    /* En plan: bara planerna säljs sedan 2026-10-22 (här stod ett
       klippkort, som studievyn inte längre visar). */
    erbjudanden_pris: [{ kod: 'plan_basic', sort: 'plan', namn: 'Basic', timmar: 4, rabatt_procent: 5,
      giltig_manader: 1, timpris_ore: 39900, ordinarie_ore: 159600, pris_ore: 151600, rabatterat_timpris_ore: 37900,
      timmar_pa_kopet: 0 }]
  };
  const svar = (route, status, kropp, extra) => route.fulfill({
    status,
    headers: Object.assign({
      'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
      'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range, x-total-count'
    }, extra || {}),
    body: kropp === undefined ? '' : JSON.stringify(kropp)
  });
  function session(id) {
    return { access_token: jwt(id, 'authenticated'), refresh_token: 'prov-' + id, token_type: 'bearer',
             expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: användare[id] };
  }
  async function hantera(route) {
    const req = route.request();
    const url = new URL(req.url());
    const metod = req.method();
    if (metod === 'OPTIONS') return svar(route, 204);
    let kropp = null;
    try { kropp = req.postDataJSON(); } catch (e) { kropp = req.postData(); }
    const vem = subUr(req.headers()['authorization']);
    logg.push({ metod, väg: url.pathname, sök: url.search, kropp, vem });
    const p = url.pathname;
    if (p === '/auth/v1/user') {
      const anv = användare[vem];
      if (!anv) return svar(route, 401, { code: 'bad_jwt', message: 'invalid JWT' });
      if (metod === 'PUT') {
        /* GoTrue: data slås ihop med user_metadata, null tar bort nyckeln. */
        Object.entries((kropp && kropp.data) || {}).forEach(([k, v]) => {
          if (v === null) delete anv.user_metadata[k]; else anv.user_metadata[k] = v;
        });
      }
      return svar(route, 200, anv);
    }
    if (p === '/auth/v1/logout') return svar(route, 204);
    if (p === '/auth/v1/token') return svar(route, 200, session(o.inloggad));
    if (p.startsWith('/auth/v1/')) return svar(route, 200, {});
    if (p.startsWith('/functions/v1/')) return svar(route, 404, {});
    if (p.startsWith('/storage/v1/')) return svar(route, 400, {});
    if (p === '/rest/v1/rpc/mina_behorigheter') return svar(route, 200, { admin: false, superadmin: false, behorigheter: [] });
    if (p.startsWith('/rest/v1/rpc/')) return svar(route, 404, { code: 'PGRST202', message: 'Ingen sådan funktion i provet.' });
    if (p.startsWith('/rest/v1/')) {
      if (metod !== 'GET' && metod !== 'HEAD') return svar(route, metod === 'PATCH' ? 204 : 201, metod === 'PATCH' ? undefined : []);
      const tabell = p.slice('/rest/v1/'.length);
      let rader = W[tabell] || [];
      const id = url.searchParams.get('id');
      if (id && id.startsWith('eq.')) rader = rader.filter(r => r.id === id.slice(3));
      const kod = url.searchParams.get('kod');
      if (kod && kod.startsWith('eq.')) rader = rader.filter(r => r.kod === kod.slice(3));
      const ett = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
      const cr = rader.length ? '0-' + (rader.length - 1) + '/' + rader.length : '*/0';
      if (ett) return rader.length ? svar(route, 200, rader[0], { 'content-range': cr }) : svar(route, 406, { code: 'PGRST116', message: 'no rows' });
      return svar(route, 200, rader, { 'content-range': cr });
    }
    return svar(route, 404, {});
  }
  return { logg, hantera, session, användare };
}

/* o.inloggad: kontots id. o.länk: 'invite' öppnar vyn med inbjudans länk
   i stället för en sparad inloggning. */
async function öppna(webb, o) {
  const context = await webb.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, o.context || {}));
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
  if (!o.länk) {
    await context.addInitScript(([nyckel, värde]) => {
      try { localStorage.setItem(nyckel, värde); } catch (e) { /* ingen lagring */ }
    }, [LAGRING, JSON.stringify(S.session(o.inloggad))]);
  }
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|status of 40[46]/.test(m.text())) konsol.push(m.text()); });
  page.on('pageerror', e => konsol.push('pageerror: ' + e.message));
  page.on('dialog', d => d.dismiss());
  return { context, page, S, riktiga, konsol };
}

const länk = (id, typ) => '#access_token=' + jwt(id, 'authenticated')
  + '&expires_in=3600&refresh_token=prov-' + id + '&sb=&token_type=bearer&type=' + typ;
const synlig = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const text = (page, sel) => page.locator(sel).first().textContent().catch(() => '');
const sattes = (S, nyckel, värde) => S.logg.some(r => r.väg === '/auth/v1/user' && r.metod === 'PUT'
  && r.kropp && r.kropp.data && r.kropp.data[nyckel] === värde);

async function bild(page, namn) {
  if (!BILDER) return;
  fs.mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: path.join(BILDER, namn + '.png'), fullPage: false });
}

/* Trycker sig igenom rundturen och svarar med vad den såg per ruta.
   Trycket landar på ett ställe utan något i (o.var, förvalt nere till
   vänster): ett tryck var som helst ska gå vidare. */
async function genomTur(page, o) {
  o = o || {};
  const sett = [];
  await page.waitForSelector('.nx-tur.open', { timeout: 10000 }).catch(() => {});
  for (let i = 0; i < 14; i++) {
    if (!(await page.locator('.nx-tur').count())) break;
    /* Rutan ploppar upp när hålet glidit klart. */
    await page.waitForSelector('.nt-ruta.nt-upp', { timeout: 4000 }).catch(() => {});
    await vänta(450);
    const ruta = await page.evaluate(() => {
      const r = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
      const tur = document.querySelector('.nx-tur.open');
      if (!tur) return null;
      const nav = document.querySelector('#vy-sido a.ar-har');
      const pek = document.querySelector('#vy-sido a.nt-pek');
      return {
        rubrik: (document.querySelector('#nt-t') || {}).textContent || '',
        text: (document.querySelector('#nt-text') || {}).textContent || '',
        et: (document.querySelector('.nt-et') || {}).textContent || '',
        sek: nav ? nav.getAttribute('data-sek') : null,
        pek: pek ? pek.getAttribute('data-sek') : null,
        hål: tur.classList.contains('har-hal') ? r(document.querySelector('.nt-hal')) : null,
        ruta: r(document.querySelector('.nt-ruta')),
        vb: innerWidth, vh: innerHeight,
        klar: !!document.querySelector('.nt-klar'),
        klarText: (document.querySelector('.nt-klar') || {}).textContent || '',
        väntar: !!document.querySelector('.nt-vantar'),
        stäng: !!document.querySelector('[data-tur-stang]'),
        vy: !!document.querySelector('#view-app:not([hidden])'),
        rullar: document.documentElement.scrollWidth > innerWidth
      };
    });
    if (!ruta) break;
    sett.push(ruta);
    if (o.bild) await bild(page, o.bild + '-' + (i + 1));
    const vp = page.viewportSize();
    const [x, y] = o.var || [6, vp.height - 6];
    await page.mouse.click(x, y);
    await vänta(150);
  }
  await vänta(300);
  return sett;
}

const inne = (a, s) => a && a.l >= -1 && a.t >= -1 && a.r <= s.vb + 1 && a.b <= s.vh + 1;
const krockar = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
function provaSett(namn, sett, rubriker, sektioner) {
  prova(namn + ': ' + rubriker.length + ' rutor i menyns ordning', JSON.stringify(sett.map(s => s.rubrik)) === JSON.stringify(rubriker),
    sett.map(s => s.rubrik).join(', '));
  const delar = sett.slice(1, -1);
  prova(namn + ': varje del byter vyn till sin sektion med menyn', JSON.stringify(delar.map(s => s.sek)) === JSON.stringify(sektioner)
    && delar.every(s => s.pek === s.sek), delar.map(s => s.sek + '/' + s.pek).join(', '));
  prova(namn + ': vyn står framme bakom rundturen', sett.every(s => s.vy));
  prova(namn + ': varje del har ett hål på skärmen, första och sista inget', delar.every(s => s.hål && inne(s.hål, s))
    && !sett[0].hål && !sett[sett.length - 1].hål, JSON.stringify(delar.map(s => s.hål)));
  prova(namn + ': rutan står på skärmen och aldrig över hålet', sett.every(s => inne(s.ruta, s) && !krockar(s.ruta, s.hål)),
    JSON.stringify(sett.map(s => [s.rubrik, s.ruta, s.hål])));
  prova(namn + ': två meningar i varje del', delar.every(s => (s.text.match(/[.!?](\s|$)/g) || []).length === 2),
    delar.filter(s => (s.text.match(/[.!?](\s|$)/g) || []).length !== 2).map(s => s.rubrik).join(', '));
  prova(namn + ': delarna räknas, 1 av ' + delar.length + ' och framåt', delar.every((s, i) => s.et === (i + 1) + ' av ' + delar.length),
    delar.map(s => s.et).join(', '));
  prova(namn + ': ingen sidledsrullning', sett.every(s => !s.rullar));
}

const FAMILJ = ['Vi visar er runt i studievyn', 'Översikt', 'Boka pass', 'Mina lektioner', 'NexLäx', 'Meddelanden',
  'Betalning & planer', 'Profil & inställningar', 'Nu är ni igång'];
const FAMILJ_SEK = ['oversikt', 'boka', 'lektioner', 'nexlax', 'meddelanden', 'betalning', 'profil'];
const HJÄLPARE = ['Vi visar dig runt i studiehjälparvyn', 'Översikt', 'Lektioner & elever', 'Föreslagna tider', 'Skriv rapport',
  'Uppgifter & material', 'Meddelanden', 'Statistik & ersättning', 'Profil & inställningar', 'Nu är du igång'];
const HJÄLPARE_SEK = ['oversikt', 'lektioner', 'tider', 'rapporter', 'laxor', 'meddelanden', 'statistik', 'profil'];
const skickat = S => S.logg.filter(r => r.metod === 'POST' && (r.väg === '/rest/v1/bookings' || /\/functions\/v1\//.test(r.väg)));

/* ============ 1. Familjen som tagits in: länken, lösenordet, rundturen ============ */
async function provaFamiljenTagenIn(webb) {
  const { context, page, S, riktiga, konsol } = await öppna(webb, { inloggad: 'foralder-1', länk: true,
    metadata: { role: 'parent', full_name: 'Anna Andersson', valkommen: 'losenord' } });
  await page.goto(BAS + '/foralder' + länk('foralder-1', 'invite'));
  await page.waitForSelector('.nx-fraga.open #nylos-t', { timeout: 8000 }).catch(() => {});
  prova('familj: länken ger rutan Skapa ditt lösenord', (await text(page, '#nylos-t')) === 'Skapa ditt lösenord', await text(page, '#nylos-t'));
  prova('familj: två fält, nytt lösenord och bekräfta', (await text(page, 'label[for="nylos-1"]')) === 'Nytt lösenord'
    && (await text(page, 'label[for="nylos-2"]')) === 'Bekräfta lösenordet');
  prova('familj: inget Inte nu, men Logga ut', (await page.locator('[data-nylos-nej]').count()) === 0
    && (await synlig(page, '[data-nylos-ut]')));
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 5);
  prova('familj: varken Escape eller ett tryck utanför stänger', await synlig(page, '.nx-fraga.open #nylos-t'));
  await bild(page, 'familj-losenord');

  await page.fill('#nylos-1', 'kort');
  await page.fill('#nylos-2', 'kort');
  await page.click('form[data-nylos] [type="submit"]');
  prova('familj: ett för kort lösenord stoppas', (await text(page, '#nylos-msg')).includes('minst 6'), await text(page, '#nylos-msg'));
  await page.fill('#nylos-1', 'ett-langt-losen');
  await page.fill('#nylos-2', 'ett-annat-losen');
  await page.click('form[data-nylos] [type="submit"]');
  prova('familj: olika lösenord stoppas', (await text(page, '#nylos-msg')) === 'Lösenorden är inte lika.', await text(page, '#nylos-msg'));
  prova('familj: inget sparas förrän de är lika', !S.logg.some(r => r.väg === '/auth/v1/user' && r.metod === 'PUT'));
  await page.fill('#nylos-2', 'ett-langt-losen');
  await page.click('form[data-nylos] [type="submit"]');
  await page.waitForSelector('.nx-tur.open', { timeout: 10000 }).catch(() => {});
  const put = S.logg.find(r => r.väg === '/auth/v1/user' && r.metod === 'PUT' && r.kropp && r.kropp.password);
  prova('familj: lösenordet och välkomsten sparas i ett anrop', put && put.kropp.password === 'ett-langt-losen'
    && put.kropp.data && put.kropp.data.valkommen === 'intro', JSON.stringify(put && put.kropp));
  prova('familj: lösenordsrutan är borta och rundturen går i vyn', !(await synlig(page, '#nylos-t'))
    && (await synlig(page, '.nx-tur.open')) && (await synlig(page, '#view-app')));
  await page.waitForSelector('.nt-ruta.nt-upp', { timeout: 4000 }).catch(() => {});
  await page.keyboard.press('Escape');
  prova('familj: Escape stänger inte rundturen första gången', await synlig(page, '.nx-tur.open'));
  prova('familj: ingen Stäng första gången', (await page.locator('[data-tur-stang]').count()) === 0);

  /* Trycket landar mitt på skärmen, där vyn har knappar: det ska gå
     vidare och inte trycka på något under. */
  const vp = page.viewportSize();
  const sett = await genomTur(page, { var: [vp.width / 2, vp.height / 2], bild: BILDER ? 'familj-tur' : null });
  provaSett('familj', sett, FAMILJ, FAMILJ_SEK);
  prova('familj: första rutan hälsar välkommen, de andra inte', sett[0].klar && sett[0].klarText === 'Välkommen till Nextrum!'
    && sett.slice(1).every(s => !s.klar), sett[0].klarText);
  prova('familj: sista rutan säger att vi matchar dem först', sett[sett.length - 1].väntar && sett.slice(0, -1).every(s => !s.väntar));
  prova('familj: sista rutan säger var de loggar in nästa gång', /Logga in på nextrum\.se/.test(sett[sett.length - 1].text),
    sett[sett.length - 1].text);
  prova('familj: rundturen är borta efter sista trycket, och Översikt står framme',
    !(await synlig(page, '.nx-tur')) && (await page.evaluate(() => (document.querySelector('#vy-sido a.ar-har') || {}).dataset.sek)) === 'oversikt');
  prova('familj: menyn är tillbaka som förut', await page.evaluate(() => !document.querySelector('.nt-lyft, .nt-pek')));
  prova('familj: trycken under rundturen tryckte inte på något i vyn', skickat(S).length === 0, skickat(S).map(r => r.väg).join(', '));
  await page.waitForSelector('#ov-gora .vy-rad', { timeout: 6000 }).catch(() => {});
  prova('familj: Översikt säger att vi letar studiehjälpare, och leder till barnen',
    /Vi letar studiehjälpare åt er/.test(await text(page, '#ov-gora'))
    && (await page.locator('#ov-gora a[href="#profil/barn"]').count()) === 1, await text(page, '#ov-gora'));
  await page.goto(BAS + '/foralder#boka');
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 6000 }).catch(() => {});
  await page.waitForFunction(() => /Bokningen öppnas när ni är matchade/.test(document.querySelector('#boka-inner').textContent),
    null, { timeout: 6000 }).catch(() => {});
  prova('familj: Boka pass säger att bokningen öppnas när de är matchade',
    /Bokningen öppnas när ni är matchade/.test(await text(page, '#boka-inner')), await text(page, '#boka-inner'));
  await vänta(300);
  prova('familj: välkomsten tas bort efter sista trycket', sattes(S, 'valkommen', null));
  prova('familj: Senast inloggad stämplas också före matchningen', S.logg.some(r => r.metod === 'PATCH'
    && r.väg === '/rest/v1/profiles' && r.kropp && r.kropp.last_seen_at));
  prova('familj: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('familj: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

/* ============ 2. Utan länken: välkomsten följer kontot ============ */
async function provaUtanLänken(webb) {
  /* Lösenordet inte valt än: rutan kommer ändå, och Logga ut fungerar. */
  {
    const { context, page, S, konsol } = await öppna(webb, { inloggad: 'foralder-1', matchad: true,
      metadata: { valkommen: 'losenord' } });
    await page.goto(BAS + '/foralder');
    await page.waitForSelector('.nx-fraga.open #nylos-t', { timeout: 8000 }).catch(() => {});
    prova('utan länk: välkomsten losenord ger rutan', (await text(page, '#nylos-t')) === 'Skapa ditt lösenord', await text(page, '#nylos-t'));
    const omladdad = page.waitForEvent('load', { timeout: 8000 }).then(() => true, () => false);
    await page.click('[data-nylos-ut]');
    prova('utan länk: Logga ut loggar ut, lokalt', (await omladdad) && S.logg.some(r => r.väg === '/auth/v1/logout'
      && /scope=local/.test(r.sök)), S.logg.filter(r => r.väg === '/auth/v1/logout').map(r => r.sök).join(', '));
    prova('utan länk: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
  /* Lösenordet valt, rundturen inte gjord: bara rundturen. */
  {
    const { context, page, S, konsol } = await öppna(webb, { inloggad: 'foralder-1', matchad: true,
      metadata: { valkommen: 'intro' } });
    await page.goto(BAS + '/foralder');
    await page.waitForSelector('.nx-tur.open', { timeout: 10000 }).catch(() => {});
    prova('intro kvar: ingen lösenordsruta', !(await synlig(page, '#nylos-t')));
    prova('intro kvar: notisrutan väntar tills rundturen är klar', !(await synlig(page, '.nx-notisruta')));
    const sett = await genomTur(page);
    provaSett('intro kvar', sett, FAMILJ, FAMILJ_SEK);
    prova('intro kvar: utan välkomstraden', !sett[0].klar);
    prova('intro kvar: en matchad familj får ingen rad om matchningen', sett.every(s => !s.väntar));
    await vänta(300);
    prova('intro kvar: välkomsten tas bort, och inget lösenord skickas', sattes(S, 'valkommen', null)
      && !S.logg.some(r => r.metod === 'PUT' && r.kropp && r.kropp.password));
    prova('intro kvar: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));

    /* Igen från Profil: Stäng finns, pilarna går, Escape stänger, inget sparas,
       och vyn står kvar på Profil. */
    await page.evaluate(() => { const n = document.querySelector('.nx-notisruta [data-notis-stang], .nx-notisruta .btn'); if (n) n.click(); });
    await page.keyboard.press('Escape');
    const före = S.logg.filter(r => r.metod === 'PUT').length;
    await page.goto(BAS + '/foralder#profil');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
    await vänta(1500);
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.querySelector('[data-intro="foralder"]').click());
    await page.waitForSelector('.nt-ruta.nt-upp', { timeout: 4000 }).catch(() => {});
    prova('Profil: Gå rundturen igen startar den', (await text(page, '#nt-t')) === 'Vi visar er runt i studievyn', await text(page, '#nt-t'));
    prova('Profil: gången igen har den Stäng', await synlig(page, '[data-tur-stang]'));
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => (document.querySelector('#nt-t') || {}).textContent === 'Översikt', null, { timeout: 4000 }).catch(() => {});
    prova('Profil: pilen åt höger går framåt', (await text(page, '#nt-t')) === 'Översikt', await text(page, '#nt-t'));
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => /Vi visar/.test((document.querySelector('#nt-t') || {}).textContent), null, { timeout: 4000 }).catch(() => {});
    prova('Profil: pilen åt vänster går tillbaka', /Vi visar/.test(await text(page, '#nt-t')), await text(page, '#nt-t'));
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await vänta(900);
    await page.keyboard.press('Escape');
    await vänta(400);
    prova('Profil: Escape stänger den', !(await synlig(page, '.nx-tur')));
    prova('Profil: vyn står på Profil igen', (await page.evaluate(() => (document.querySelector('#vy-sido a.ar-har') || {}).dataset.sek)) === 'profil');
    prova('Profil: att gå den igen sparar ingenting', S.logg.filter(r => r.metod === 'PUT').length === före);
    await context.close();
  }
  /* Ett konto i bruk: ingenting. */
  {
    const { context, page, S, konsol } = await öppna(webb, { inloggad: 'foralder-1', matchad: true, metadata: {} });
    await page.goto(BAS + '/foralder');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
    await vänta(1500);
    prova('i bruk: ingen rundtur', !(await page.locator('.nx-tur').count()) && (await synlig(page, '#view-app')));
    prova('i bruk: inget skrivs till Auth', !S.logg.some(r => r.väg === '/auth/v1/user' && r.metod === 'PUT'));
    prova('i bruk: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
}

/* ============ 3. Studiehjälparen ============ */
async function provaStudiehjälparen(webb) {
  for (const godkand of [true, false]) {
    const v = godkand ? 'studiehjälpare' : 'studiehjälpare i väntläge';
    const { context, page, S, konsol } = await öppna(webb, { inloggad: 'handledare-1', länk: true, godkand,
      metadata: { role: 'tutor', valkommen: 'losenord' } });
    await page.goto(BAS + '/larare' + länk('handledare-1', 'invite'));
    await page.waitForSelector('.nx-fraga.open #nylos-t', { timeout: 8000 }).catch(() => {});
    prova(v + ': rutan Skapa ditt lösenord', (await text(page, '#nylos-t')) === 'Skapa ditt lösenord');
    await page.fill('#nylos-1', 'sara-forsta-losen');
    await page.fill('#nylos-2', 'sara-forsta-losen');
    await page.click('form[data-nylos] [type="submit"]');
    if (godkand) {
      const sett = await genomTur(page, { bild: BILDER ? 'studiehjalpare-tur' : null });
      provaSett(v, sett, HJÄLPARE, HJÄLPARE_SEK);
      prova(v + ': sista rutan säger var du loggar in nästa gång', /Logga in på nextrum\.se/.test(sett[sett.length - 1].text));
      await vänta(300);
      prova(v + ': välkomsten tas bort', sattes(S, 'valkommen', null));
    } else {
      /* Ingen vy att gå runt i: väntläget, och rundturen när profilen är godkänd. */
      await page.waitForSelector('#view-pending:not([hidden])', { timeout: 8000 }).catch(() => {});
      await vänta(800);
      prova(v + ': väntläget, utan rundtur', (await synlig(page, '#view-pending')) && !(await page.locator('.nx-tur').count()));
      prova(v + ': välkomsten står kvar till dess', !sattes(S, 'valkommen', null));
    }
    prova(v + ': inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
}

/* ============ 4. Telefonen ============ */
async function provaTelefonen(webb) {
  for (const [namn, mörkt, bredd, höjd] of [['telefon', false, 390, 844], ['telefon mörkt', true, 390, 844],
                                            ['liten telefon', false, 360, 640]]) {
    const { context, page, konsol } = await öppna(webb, { inloggad: 'foralder-1', matchad: true, metadata: { valkommen: 'intro' },
      context: { viewport: { width: bredd, height: höjd }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
                 colorScheme: mörkt ? 'dark' : 'light' } });
    await page.goto(BAS + '/foralder');
    const sett = await genomTur(page, { bild: BILDER ? namn.replace(/ /g, '-') + '-tur' : null });
    provaSett(namn, sett, FAMILJ, FAMILJ_SEK);
    prova(namn + ': inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
}

(async function () {
  const server = spawn('python3', [path.join(ROT, '.claude', 'serve.py'), String(PORT)], { stdio: 'ignore' });
  let klar = false;
  for (let i = 0; i < 50 && !klar; i++) {
    try { klar = (await fetch(BAS + '/foralder')).ok; } catch (e) { await vänta(100); }
  }
  const webb = await pw.chromium.launch();
  try {
    await provaFamiljenTagenIn(webb);
    await provaUtanLänken(webb);
    await provaStudiehjälparen(webb);
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
