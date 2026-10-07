/* ============================================================
   NEXTRUM — webbläsarprov för första inloggningen och introduktionen
   (2026-10-06)

       NODE_PATH="$(npm root -g)" node verktyg/prova-introduktion.js [mapp för bilder]

   Byggt som verktyg/prova-aterstallning.js (egen port, 8967): sidorna
   serveras av .claude/serve.py, nextrum-config.js byts i farten mot en
   som pekar på https://supabase.test, och varje anrop dit besvaras här
   av en falsk Supabase som minns user_metadata, som Auth gör. Ett anrop
   till den riktiga adressen fäller provet. Körs inte i CI: Playwright
   är ingen del av repot.

   Det som provas: rutan för första lösenordet (inbjudans länk, och
   välkomsten 'losenord' utan länk), att den inte går att hoppa över men
   att Logga ut finns, introduktionen efter lösenordet och dess Fortsätt,
   att välkomsten tas bort, introduktionen igen från Profil, knapparna
   som står stilla mellan bilderna (dator och telefon), bilderna, att en
   familj som inte är matchad än kommer in och får veta varför bokningen
   och köpen väntar, och att Senast inloggad stämplas också då. Att kontot skapas utan lösenord provas i
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
    erbjudanden_pris: [{ kod: 'klipp10', sort: 'klippkort', namn: 'Klippkort 10', timmar: 10, rabatt_procent: 5,
      giltig_manader: 6, timpris_ore: 37900, ordinarie_ore: 379000, pris_ore: 360000, rabatterat_timpris_ore: 36000 }]
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
  if (o.utanBilder) {
    await context.route(/nextrum-images\.js/, route => route.fulfill({ status: 200, contentType: 'application/javascript',
      body: fs.readFileSync(path.join(ROT, 'nextrum-images.js'), 'utf8').replace('window.NEXTRUM_INTRO =', 'window.NEXTRUM_INTRO_GAMMAL =') }));
  }
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

/* Klickar igenom introduktionen och svarar med vad den såg per bild. */
async function genomIntro(page) {
  const sett = [];
  /* Rutan glider fram när den öppnas (.nx-fraga-box, en halv sekund):
     första mätningen väntar in den. */
  await vänta(650);
  for (let i = 0; i < 12; i++) {
    if (!(await synlig(page, '.nx-intro.open'))) break;
    sett.push(await page.evaluate(() => {
      const k = document.querySelector('[data-intro-fram]').getBoundingClientRect();
      const img = document.querySelector('.nx-intro-bild img');
      return {
        nr: document.querySelector('.nx-intro-nr').textContent,
        rubrik: document.querySelector('#nx-intro-t').textContent,
        text: document.querySelector('#nx-intro-text').textContent,
        knapp: document.querySelector('[data-intro-fram]').textContent,
        bak: document.querySelector('[data-intro-bak]').disabled,
        topp: Math.round(k.top), höger: Math.round(k.right), bredd: Math.round(k.width),
        bild: img ? { src: img.getAttribute('src'), alt: img.getAttribute('alt'), w: img.naturalWidth } : null,
        klar: !document.querySelector('.nx-intro-klar').hidden,
        väntar: !document.querySelector('.nx-intro-vantar').hidden
      };
    }));
    /* Bilden laddas innan nästa: naturalWidth säger att filen kom fram. */
    await page.waitForFunction(() => {
      const img = document.querySelector('.nx-intro-bild img');
      return !img || img.complete;
    }, null, { timeout: 4000 }).catch(() => {});
    sett[sett.length - 1].bild = await page.evaluate(() => {
      const img = document.querySelector('.nx-intro-bild img');
      return img ? { src: img.getAttribute('src'), alt: img.getAttribute('alt'), w: img.naturalWidth } : null;
    });
    await page.click('[data-intro-fram]');
    await vänta(120);
  }
  return sett;
}

/* ============ 1. Familjen som tagits in: länken, lösenordet, introduktionen ============ */
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
  await page.waitForSelector('.nx-intro.open', { timeout: 6000 }).catch(() => {});
  const put = S.logg.find(r => r.väg === '/auth/v1/user' && r.metod === 'PUT' && r.kropp && r.kropp.password);
  prova('familj: lösenordet och välkomsten sparas i ett anrop', put && put.kropp.password === 'ett-langt-losen'
    && put.kropp.data && put.kropp.data.valkommen === 'intro', JSON.stringify(put && put.kropp));
  prova('familj: lösenordsrutan är borta och introduktionen öppen', !(await synlig(page, '#nylos-t'))
    && (await synlig(page, '.nx-intro.open')));
  prova('familj: vyn är inte framme bakom introduktionen', !(await synlig(page, '#view-app')));
  await bild(page, 'familj-intro-1');
  await page.keyboard.press('Escape');
  prova('familj: Escape stänger inte introduktionen första gången', await synlig(page, '.nx-intro.open'));
  prova('familj: ingen Stäng första gången', (await page.locator('[data-intro-stang]').count()) === 0);

  const sett = await genomIntro(page);
  prova('familj: sju bilder, 1 av 7 till 7 av 7', sett.length === 7 && sett[0].nr === '1 av 7' && sett[6].nr === '7 av 7',
    sett.map(s => s.nr).join(', '));
  prova('familj: rubrikerna följer menyn', JSON.stringify(sett.map(s => s.rubrik)) === JSON.stringify(
    ['Översikt', 'Boka pass', 'Mina lektioner', 'Bekräfta rapport', 'NexLäx', 'Meddelanden', 'Profil & inställningar']),
    sett.map(s => s.rubrik).join(', '));
  prova('familj: första bilden säger att lösenordet är sparat, de andra inte', sett[0].klar && sett.slice(1).every(s => !s.klar));
  prova('familj: Tillbaka går inte på första bilden', sett[0].bak && sett.slice(1).every(s => !s.bak));
  prova('familj: Nästa, och Fortsätt sist', sett.slice(0, 6).every(s => s.knapp === 'Nästa') && sett[6].knapp === 'Fortsätt',
    sett.map(s => s.knapp).join(', '));
  prova('familj: varje bild kom fram och har en alt-text', sett.every(s => s.bild && s.bild.w === 780 && s.bild.alt.length > 30),
    JSON.stringify(sett.map(s => s.bild && [s.bild.src, s.bild.w])));
  prova('familj: knappen står still mellan bilderna, också när den blir Fortsätt (dator)',
    new Set(sett.map(s => s.topp + ':' + s.höger + ':' + s.bredd)).size === 1,
    sett.map(s => s.topp + '/' + s.höger + '/' + s.bredd).join(', '));
  prova('familj: sista bilden säger att vi matchar dem först', sett[6].väntar && sett.slice(0, 6).every(s => !s.väntar));
  prova('familj: sista bilden säger var familjen och barnet loggar in nästa gång',
    /Logga in på nextrum\.se/.test(sett[6].text) && /barnet på samma ställe med sitt användarnamn/.test(sett[6].text),
    sett[6].text);
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 6000 }).catch(() => {});
  /* Före matchningen är vyn öppen (2026-10-07): inget väntläge, men
     bokningen och köpen väntar på studiehjälparen. */
  prova('familj: Fortsätt leder in i vyn, också före matchningen', await synlig(page, '#view-app') && !(await synlig(page, '.nx-intro')));
  await page.waitForSelector('#ov-gora .vy-rad', { timeout: 6000 }).catch(() => {});
  prova('familj: Översikt säger att vi letar studiehjälpare, och leder till barnen',
    /Vi letar studiehjälpare åt er/.test(await text(page, '#ov-gora'))
    && (await page.locator('#ov-gora a[href="#profil/barn"]').count()) === 1, await text(page, '#ov-gora'));
  await bild(page, 'familj-oversikt-fore-matchning');
  await page.goto(BAS + '/foralder#boka');
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 6000 }).catch(() => {});
  await page.waitForFunction(() => /Bokningen öppnas när ni är matchade/.test(document.querySelector('#boka-inner').textContent),
    null, { timeout: 6000 }).catch(() => {});
  prova('familj: Boka pass säger att bokningen öppnas när de är matchade',
    /Bokningen öppnas när ni är matchade/.test(await text(page, '#boka-inner')), await text(page, '#boka-inner'));
  await bild(page, 'familj-boka-fore-matchning');
  await page.goto(BAS + '/foralder#erbjudanden');
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 6000 }).catch(() => {});
  await page.waitForFunction(() => /matchat er/.test(document.querySelector('#erb-msg').textContent), null, { timeout: 6000 }).catch(() => {});
  prova('familj: inget går att köpa före matchningen, och raden säger varför',
    (await page.locator('[data-kop]').count()) === 0 && /Timmarna köper ni när vi matchat er/.test(await text(page, '#erb-msg')),
    await text(page, '#erb-msg'));
  await bild(page, 'familj-erbjudanden-fore-matchning');
  prova('familj: ingen bokning eller kassa skickades', !S.logg.some(r => r.metod === 'POST'
    && (r.väg === '/rest/v1/bookings' || /\/functions\/v1\//.test(r.väg))), S.logg.filter(r => r.metod === 'POST').map(r => r.väg).join(', '));
  await vänta(300);
  prova('familj: välkomsten tas bort efter Fortsätt', sattes(S, 'valkommen', null));
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
    /* Provets inloggning läggs tillbaka vid varje sidladdning
       (addInitScript), så det som syns efteråt säger inget här: att
       utloggningen gick och att sidan laddades om gör det. */
    const omladdad = page.waitForEvent('load', { timeout: 8000 }).then(() => true, () => false);
    await page.click('[data-nylos-ut]');
    prova('utan länk: Logga ut loggar ut, lokalt', (await omladdad) && S.logg.some(r => r.väg === '/auth/v1/logout'
      && /scope=local/.test(r.sök)), S.logg.filter(r => r.väg === '/auth/v1/logout').map(r => r.sök).join(', '));
    prova('utan länk: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
  /* Lösenordet valt, introduktionen inte sedd: bara introduktionen. */
  {
    const { context, page, S, konsol } = await öppna(webb, { inloggad: 'foralder-1', matchad: true,
      metadata: { valkommen: 'intro' } });
    await page.goto(BAS + '/foralder');
    await page.waitForSelector('.nx-intro.open', { timeout: 8000 }).catch(() => {});
    prova('intro kvar: ingen lösenordsruta', !(await synlig(page, '#nylos-t')));
    const sett = await genomIntro(page);
    prova('intro kvar: introduktionen, utan raden om lösenordet', sett.length === 7 && !sett[0].klar);
    prova('intro kvar: en matchad familj får ingen rad om matchningen', sett.every(s => !s.väntar));
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
    prova('intro kvar: Fortsätt leder in i vyn', await synlig(page, '#view-app'));
    await vänta(300);
    prova('intro kvar: välkomsten tas bort, och inget lösenord skickas', sattes(S, 'valkommen', null)
      && !S.logg.some(r => r.metod === 'PUT' && r.kropp && r.kropp.password));
    prova('intro kvar: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    /* Motprovet till familjen före matchningen: här går det att köpa. */
    await page.goto(BAS + '/foralder#erbjudanden');
    await page.waitForSelector('[data-kop]', { timeout: 6000 }).catch(() => {});
    prova('intro kvar: en matchad familj kan köpa timmar', (await page.locator('[data-kop]').count()) === 1);

    /* Igen från Profil: Stäng finns, Escape stänger, inget sparas. */
    const före = S.logg.filter(r => r.metod === 'PUT').length;
    await page.goto(BAS + '/foralder#profil');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
    await vänta(400);
    await page.click('[data-intro="foralder"]');
    await page.waitForSelector('.nx-intro.open', { timeout: 4000 }).catch(() => {});
    prova('Profil: Visa introduktionen öppnar den', (await text(page, '.nx-intro-nr')) === '1 av 7');
    prova('Profil: öppnad igen har den Stäng', await synlig(page, '[data-intro-stang]'));
    await page.keyboard.press('ArrowRight');
    prova('Profil: pilen åt höger går framåt', (await text(page, '.nx-intro-nr')) === '2 av 7', await text(page, '.nx-intro-nr'));
    await page.keyboard.press('ArrowLeft');
    prova('Profil: pilen åt vänster går tillbaka', (await text(page, '.nx-intro-nr')) === '1 av 7', await text(page, '.nx-intro-nr'));
    await page.keyboard.press('Escape');
    await vänta(150);
    prova('Profil: Escape stänger den', !(await synlig(page, '.nx-intro')));
    prova('Profil: att se den igen sparar ingenting', S.logg.filter(r => r.metod === 'PUT').length === före);
    await context.close();
  }
  /* Ett konto i bruk: ingenting. */
  {
    const { context, page, S, konsol } = await öppna(webb, { inloggad: 'foralder-1', matchad: true, metadata: {} });
    await page.goto(BAS + '/foralder');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
    await vänta(500);
    prova('i bruk: varken ruta eller introduktion', !(await synlig(page, '.nx-fraga.open')) && (await synlig(page, '#view-app')));
    prova('i bruk: inget skrivs till Auth', !S.logg.some(r => r.väg === '/auth/v1/user' && r.metod === 'PUT'));
    prova('i bruk: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
  /* En gammal nextrum-images.js i cachen: texten utan bilder. */
  {
    const { context, page, konsol } = await öppna(webb, { inloggad: 'foralder-1', matchad: true,
      metadata: { valkommen: 'intro' }, utanBilder: true });
    await page.goto(BAS + '/foralder');
    await page.waitForSelector('.nx-intro.open', { timeout: 8000 }).catch(() => {});
    prova('utan bildregistret: texten står, utan bild', !(await synlig(page, '.nx-intro-bild'))
      && (await text(page, '#nx-intro-t')) === 'Översikt');
    prova('utan bildregistret: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
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
    await page.waitForSelector('.nx-intro.open', { timeout: 6000 }).catch(() => {});
    if (godkand) await bild(page, 'studiehjalpare-intro-1');
    const sett = await genomIntro(page);
    prova(v + ': åtta bilder', sett.length === 8 && sett[7].nr === '8 av 8', sett.map(s => s.nr).join(', '));
    prova(v + ': rubrikerna följer menyn', JSON.stringify(sett.map(s => s.rubrik)) === JSON.stringify(
      ['Översikt', 'Föreslagna tider', 'Lektioner & elever', 'Skriv rapport', 'Uppgifter & material', 'Meddelanden',
       'Statistik & ersättning', 'Profil & inställningar']), sett.map(s => s.rubrik).join(', '));
    prova(v + ': varje bild kom fram', sett.every(s => s.bild && s.bild.w === 780), JSON.stringify(sett.map(s => s.bild && s.bild.w)));
    prova(v + ': sista bilden säger att profilen väntar bara när den gör det', sett[7].väntar === !godkand);
    prova(v + ': sista bilden säger var du loggar in nästa gång', /Logga in på nextrum\.se/.test(sett[7].text), sett[7].text);
    const vy = godkand ? '#view-app' : '#view-pending';
    await page.waitForSelector(vy + ':not([hidden])', { timeout: 8000 }).catch(() => {});
    prova(v + ': Fortsätt leder in i vyn', await synlig(page, vy));
    await vänta(300);
    prova(v + ': välkomsten tas bort', sattes(S, 'valkommen', null));
    prova(v + ': inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
}

/* ============ 4. Telefonen ============ */
async function provaTelefonen(webb) {
  /* Den lilla telefonen (360 × 740) är där den längsta texten tar mest
     plats: knappen ska stå still också där. */
  for (const [namn, mörkt, bredd, höjd] of [['telefon', false, 390, 844], ['telefon mörkt', true, 390, 844],
                                            ['liten telefon', false, 360, 740]]) {
    const { context, page, konsol } = await öppna(webb, { inloggad: 'foralder-1', matchad: true, metadata: { valkommen: 'intro' },
      context: { viewport: { width: bredd, height: höjd }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
                 colorScheme: mörkt ? 'dark' : 'light' } });
    await page.goto(BAS + '/foralder');
    await page.waitForSelector('.nx-intro.open', { timeout: 8000 }).catch(() => {});
    const mått = await page.evaluate(() => {
      const boxEl = document.querySelector('.nx-intro-box');
      const box = boxEl.getBoundingClientRect();
      /* Rutan glider in med transform: bredderna mäts i layouten, inte på skärmen. */
      const st = getComputedStyle(boxEl);
      const inne = boxEl.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
      const fig = { width: document.querySelector('.nx-intro-bild').offsetWidth };
      const kn = [...document.querySelectorAll('.nx-intro-knappar .btn')].map(b => b.getBoundingClientRect().height);
      return { vänster: box.left, höger: box.right, bredd: innerWidth, fig: fig.width, inne, kn,
               rullar: document.documentElement.scrollWidth > innerWidth };
    });
    prova(namn + ': rutan ryms i bredden', mått.vänster >= 0 && mått.höger <= mått.bredd && !mått.rullar, JSON.stringify(mått));
    prova(namn + ': bilden fyller rutans bredd', mått.fig >= mått.inne - 1 && mått.fig > 280, mått.fig + ' av ' + mått.inne);
    prova(namn + ': knapparna är minst 44 px', mått.kn.every(h => h >= 44), mått.kn.join(', '));
    await bild(page, namn.replace(/ /g, '-') + '-intro');
    if (!mörkt) {
      const sett = await genomIntro(page);
      prova(namn + ': knappen står still mellan bilderna', new Set(sett.map(s => s.topp)).size === 1, sett.map(s => s.topp).join(', '));
    }
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
