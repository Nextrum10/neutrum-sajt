/* ============================================================
   NEXTRUM — webbläsarprov för ansökan under 18, nejet och det du inte
   sett (2026-10-05)

       NODE_PATH="$(npm root -g)" node verktyg/prova-ansokningar.js [mapp för bilder]

   Byggt som verktyg/prova-barnkonton.js och körs likadant: Playwright
   och Chromium, inte i CI. ALDRIG MOT DRIFTEN: nextrum-config.js byts i
   farten mot en som pekar på https://supabase.test, varje anrop dit
   besvaras här av en falsk Supabase, och ett anrop till den riktiga
   adressen stoppas och fäller provet.

   Provet ser det en människa ser: fältet för vårdnadshavaren i
   formuläret på båda språken och vad som skickas, rutan som visar nejet
   innan läget blir Avböjd, godkännandet i ansökan, och att siffran vid
   Ansökningar och Intresseanmälningar går bort när man tittat. Reglerna
   i databasen provas i verktyg/rls-test.sql, mallarna i
   supabase/functions/_delad/notiser/ansokan_test.ts.
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
const PORT = 8963;
const BAS = 'http://localhost:' + PORT;
const FALSK = 'https://supabase.test';
const RIKTIG = /ddkfiuvcppalutfulvbi\.supabase\.co/;
const BILDER = process.argv[2] || null;
const LAGRING = 'sb-supabase-auth-token';

const utfall = [];
function prova(namn, ok, detalj) {
  utfall.push({ namn, ok: !!ok, detalj: ok ? '' : String(detalj == null ? '' : detalj) });
}
const vänta = ms => new Promise(r => setTimeout(r, ms));

function jwt(sub, roll) {
  const b = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  return b({ alg: 'HS256', typ: 'JWT' }) + '.' + b({ sub, role: roll, exp: 4102444800 }) + '.provet';
}
const ADMIN = { id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'leo@example.se',
  app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-09-01T10:00:00Z' };

const nu = min => new Date(Date.now() + min * 60000).toISOString();

/* ============ världen ============ */
function värld(o) {
  const w = {
    profiles: [
      { id: 'admin-1', role: 'parent', full_name: 'Leo Admin', email: 'leo@example.se', is_admin: true,
        match_status: 'pending', created_at: '2026-09-01T10:00:00Z' },
      { id: 'sh-1', role: 'tutor', full_name: 'Tove Lind', email: 'tove@example.se', is_admin: false,
        created_at: '2026-10-03T10:00:00Z' }
    ],
    tutor_profiles: [{ id: 'sh-1', status: 'pending', created_at: '2026-10-03T10:00:00Z' }],
    applications: [
      /* Ny, sexton år, adressen till vårdnadshavaren, inget godkännande. */
      { id: 'ans-ung', name: 'Tove Lind', email: 'tove@example.se', age: 16, status: 'new',
        created_at: nu(-30), tjanster: ['laxhjalp'], why: 'Minst 4 timmar i veckan: ja\n\nJag vill hjälpa.',
        vardnadshavare_epost: 'mamma@example.se', vardnadshavare_godkand_at: null, vardnadshavare_svar: null },
      /* Gammal, sedd för länge sedan. */
      { id: 'ans-gammal', name: 'Kalle Sökande', email: 'kalle@example.se', age: 22, status: 'contacted',
        created_at: '2026-09-20T10:00:00Z', tjanster: ['laxhjalp'], why: 'Hej',
        vardnadshavare_epost: null, vardnadshavare_godkand_at: null, vardnadshavare_svar: null }
    ],
    leads: [
      { id: 'lead-ny', parent_name: 'Karin Karlsson', email: 'karin@example.se', status: 'new', created_at: nu(-10) },
      { id: 'lead-sedd', parent_name: 'Per Persson', email: 'per@example.se', status: 'new',
        created_at: '2026-09-21T10:00:00Z' }
    ],
    ansokan_utskick: [
      { id: 'u1', ansokan_id: 'ans-ung', steg: 'mottagen', nyckel: 'mottagen', status: 'skickad', forsok: 1,
        fel: null, skapad: nu(-29), uppdaterad: nu(-29), skicka_efter: null },
      { id: 'u2', ansokan_id: 'ans-ung', steg: 'vardnadshavare', nyckel: 'vardnadshavare:x', status: 'skickad',
        forsok: 1, fel: null, skapad: nu(-29), uppdaterad: nu(-29), skicka_efter: null }
    ],
    /* Sett till slutet av september: allt efter det är nytt. */
    admin_sett: [
      { omrade: 'leads', sett_till: '2026-09-30T00:00:00Z' },
      { omrade: 'ansokningar', sett_till: '2026-09-30T00:00:00Z' }
    ],
    tjanster: [{ kod: 'laxhjalp', namn: 'Läxhjälp', aktiv: true, for_jobb: true, for_kund: true, ordning: 1 }],
    flaggor: []
  };
  if (o.utanKolumner) {
    w.applications.forEach(a => {
      delete a.vardnadshavare_epost; delete a.vardnadshavare_godkand_at; delete a.vardnadshavare_svar;
    });
    w.ansokan_utskick.forEach(u => { delete u.skicka_efter; });
  }
  return w;
}

function falskSupabase(o) {
  const W = värld(o);
  const logg = [];
  const svar = (route, status, kropp, extra) => route.fulfill({
    status,
    headers: Object.assign({
      'content-type': 'application/json', 'access-control-allow-origin': '*',
      'access-control-allow-headers': '*', 'access-control-allow-methods': '*',
      'access-control-expose-headers': 'content-range, x-total-count'
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

  const RPC = {
    mina_behorigheter: () => ({ admin: true, superadmin: true, behorigheter: [] }),
    notisfel: () => [], ekonomiska_avvikelser: () => [], tipskoder_lage: () => [],
    admin_sett_markera: k => {
      const rad = W.admin_sett.find(r => r.omrade === k.p_omrade);
      if (rad) rad.sett_till = k.p_till; else W.admin_sett.push({ omrade: k.p_omrade, sett_till: k.p_till });
      return k.p_till;
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
    if (p === '/auth/v1/user') return o.inloggad ? svar(route, 200, ADMIN) : svar(route, 401, { message: 'no user' });
    if (p.startsWith('/auth/v1/')) return svar(route, 200, {});
    if (p.startsWith('/functions/v1/')) return svar(route, 404, {});
    if (p.startsWith('/storage/v1/')) return svar(route, 200, { Key: 'cv/x' });
    if (p.startsWith('/rest/v1/rpc/')) {
      const namn = p.slice('/rest/v1/rpc/'.length);
      if (namn === 'admin_sett_markera' && o.utanSett) return svar(route, 404, { code: 'PGRST202', message: 'saknas' });
      const f = RPC[namn];
      if (!f) return svar(route, 404, { code: 'PGRST202', message: 'Could not find the function public.' + namn });
      return svar(route, 200, f(kropp || {}));
    }
    if (p.startsWith('/rest/v1/')) {
      const tabell = p.slice('/rest/v1/'.length);
      if (tabell === 'admin_sett' && o.utanSett) {
        return svar(route, 404, { code: 'PGRST205', message: "Could not find the table 'public.admin_sett' in the schema cache" });
      }
      const ettObjekt = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
      if (metod === 'GET' || metod === 'HEAD') {
        const rader = filtrera(W[tabell] || [], url.searchParams);
        const cr = rader.length ? '0-' + (rader.length - 1) + '/' + rader.length : '*/0';
        if (ettObjekt) return rader.length ? svar(route, 200, rader[0], { 'content-range': cr })
          : svar(route, 406, { code: 'PGRST116', message: 'no rows' });
        return svar(route, 200, rader, { 'content-range': cr });
      }
      if (metod === 'PATCH') {
        const träff = filtrera(W[tabell] || [], url.searchParams);
        träff.forEach(r => Object.assign(r, kropp || {}));
        if ((req.headers()['prefer'] || '').includes('return=representation')) {
          return ettObjekt ? svar(route, 200, träff[0] || null) : svar(route, 200, träff);
        }
        return svar(route, 204);
      }
      if (metod === 'POST') {
        /* Kolumnen saknas en stund efter en driftsättning: PostgREST
           säger PGRST204 och sparar ingenting. */
        if (tabell === 'applications' && o.kolumnSaknas && kropp && 'vardnadshavare_epost' in kropp) {
          return svar(route, 400, { code: 'PGRST204', message: "Could not find the 'vardnadshavare_epost' column of 'applications' in the schema cache" });
        }
        return svar(route, 201, []);
      }
      return svar(route, 405, {});
    }
    return svar(route, 404, {});
  }
  return { W, logg, hantera, session };
}

async function öppna(webb, o) {
  const context = await webb.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, o.context || {}));
  const S = falskSupabase(o);
  const riktiga = [];
  const konsol = [];
  const dialoger = [];
  await context.route(RIKTIG, route => { riktiga.push(route.request().url()); return route.abort(); });
  await context.route(/nextrum-config\.js/, async route => {
    const text = fs.readFileSync(path.join(ROT, 'nextrum-config.js'), 'utf8')
      .replace(/SUPABASE_URL:\s*'[^']*'/, "SUPABASE_URL: '" + FALSK + "'");
    return route.fulfill({ status: 200, contentType: 'application/javascript', body: text });
  });
  await context.route(/^https:\/\/supabase\.test\//, S.hantera);
  await context.routeWebSocket(/supabase\.test/, () => { /* Realtime svarar aldrig */ });
  await context.route(url => !String(url).startsWith(BAS) && !/supabase\.test/.test(String(url)),
    route => route.abort());
  if (o.inloggad) {
    await context.addInitScript(([nyckel, värde]) => {
      try { localStorage.setItem(nyckel, värde); } catch (e) { /* ingen lagring */ }
    }, [LAGRING, JSON.stringify(S.session())]);
  }
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) konsol.push(m.text()); });
  page.on('pageerror', e => konsol.push('pageerror: ' + e.message));
  page.on('dialog', d => { dialoger.push(d.message()); d.dismiss(); });
  return { context, page, S, riktiga, konsol, dialoger };
}

async function bild(page, namn, sel) {
  if (!BILDER) return;
  fs.mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: path.join(BILDER, namn + '.png'), fullPage: false });
  if (sel) await page.locator(sel).first().screenshot({ path: path.join(BILDER, namn + '-del.png') }).catch(() => {});
}

const synlig = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const text = (page, sel) => page.locator(sel).first().textContent().catch(() => '');
const märke = (page, sek) => page.evaluate(s => {
  const m = document.querySelector('#vy-sido a[data-sek="' + s + '"] .vy-sido-mark');
  return m ? m.textContent : '';
}, sek);

/* ============ formuläret ============ */
async function fyll(page, o) {
  await page.fill('#ap-name', o.namn || 'Tove Lind');
  await page.fill('#ap-age', o.ålder);
  await page.fill('#ap-email', o.epost || 'tove@example.se');
  if (o.vh != null) await page.fill('#ap-vh', o.vh);
  await page.check('#ap-timmar input[value="ja"]');
  await page.check('#ap-gdpr');
}
const insättningar = S => S.logg.filter(r => r.metod === 'POST' && r.väg === '/rest/v1/applications');

async function provaFormuläret(webb) {
  for (const [sida, sv] of [['/bli-studiehjalpare', true], ['/en/bli-studiehjalpare', false]]) {
    const namn = sv ? 'formulär' : 'formulär (en)';
    const { context, page, S, riktiga, konsol } = await öppna(webb, {});
    await page.goto(BAS + sida);
    await page.waitForSelector('#apply-form');
    prova(namn + ': vårdnadshavarens fält är dolt från början', !(await synlig(page, '#ap-vh')));
    await page.fill('#ap-age', '16');
    prova(namn + ': under 18 visar fältet', await synlig(page, '#ap-vh'));
    prova(namn + ': etiketten', (await text(page, 'label[for="ap-vh"]')).trim()
      === (sv ? 'Din vårdnadshavares e-post' : 'Your parent or guardian’s email'), await text(page, 'label[for="ap-vh"]'));
    await page.fill('#ap-age', '18');
    prova(namn + ': 18 döljer det igen', !(await synlig(page, '#ap-vh')));
    await page.fill('#ap-age', '16 år');
    prova(namn + ': "16 år" räknas som 16', await synlig(page, '#ap-vh'));
    if (sv) await bild(page, 'formular-under-18', '#apply-form');

    /* Utan adress: inget skickas. */
    await fyll(page, { ålder: '16', vh: '' });
    await page.click('#apply-form button[type="submit"]');
    await vänta(200);
    prova(namn + ': utan vårdnadshavarens adress skickas inget', insättningar(S).length === 0);
    prova(namn + ': och det står varför', (await text(page, '#apply-ok')).includes(sv ? 'vårdnadshavares e-post' : 'guardian’s email'),
      await text(page, '#apply-ok'));
    prova(namn + ': fältet markeras', (await page.getAttribute('#ap-vh', 'aria-invalid')) === 'true');

    /* Den egna adressen duger inte. */
    await page.fill('#ap-vh', 'TOVE@example.se');
    await page.click('#apply-form button[type="submit"]');
    await vänta(200);
    prova(namn + ': den egna adressen nekas', insättningar(S).length === 0
      && (await text(page, '#apply-ok')).includes(sv ? 'inte din' : 'not yours'), await text(page, '#apply-ok'));

    /* Rätt: adressen följer med som en egen kolumn, och tacket nämner vårdnadshavaren. */
    await page.fill('#ap-vh', 'mamma@example.se');
    await page.click('#apply-form button[type="submit"]');
    await page.waitForFunction(() => /Tack|Thank/.test(document.querySelector('#apply-ok').textContent), null, { timeout: 5000 }).catch(() => {});
    const ins = insättningar(S).pop();
    prova(namn + ': adressen skickas som vardnadshavare_epost', ins && ins.kropp && ins.kropp.vardnadshavare_epost === 'mamma@example.se'
      && ins.kropp.age === 16, JSON.stringify(ins && ins.kropp));
    prova(namn + ': tacket säger att vårdnadshavaren får ett mejl',
      (await text(page, '#apply-ok')).includes(sv ? 'Din vårdnadshavare får ett mejl' : 'Your parent or guardian will get an email'),
      await text(page, '#apply-ok'));
    prova(namn + ': formuläret töms och fältet döljs', !(await synlig(page, '#ap-vh')) && (await page.inputValue('#ap-age')) === '');

    /* Vuxen: ingen kolumn alls, och åldern som tal. */
    await fyll(page, { ålder: '22 år', epost: 'kalle@example.se', namn: 'Kalle' });
    await page.click('#apply-form button[type="submit"]');
    await page.waitForFunction(n => document.querySelectorAll('#apply-ok').length && n, insättningar(S).length, { timeout: 3000 }).catch(() => {});
    await vänta(400);
    const vuxen = insättningar(S).pop();
    prova(namn + ': en vuxen skickar ingen adress till en vårdnadshavare',
      vuxen && vuxen.kropp && !('vardnadshavare_epost' in vuxen.kropp) && vuxen.kropp.age === 22, JSON.stringify(vuxen && vuxen.kropp));
    prova(namn + ': inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
    prova(namn + ': inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }

  /* Kolumnen saknas (migrationen inte körd): ansökan går in ändå, med
     adressen först i why. */
  {
    const { context, page, S } = await öppna(webb, { kolumnSaknas: true });
    await page.goto(BAS + '/bli-studiehjalpare');
    await page.waitForSelector('#apply-form');
    await fyll(page, { ålder: '15', vh: 'pappa@example.se' });
    await page.click('#apply-form button[type="submit"]');
    await page.waitForFunction(() => /Tack/.test(document.querySelector('#apply-ok').textContent), null, { timeout: 5000 }).catch(() => {});
    const alla = insättningar(S);
    const andra = alla[1];
    prova('formulär: utan kolumnen försöks det en gång till', alla.length === 2, alla.length + ' insättningar');
    prova('formulär: andra gången utan kolumnen, adressen först i why',
      andra && !('vardnadshavare_epost' in andra.kropp)
      && /^Vårdnadshavarens e-post: pappa@example\.se/.test(andra.kropp.why || ''), JSON.stringify(andra && andra.kropp));
    prova('formulär: och den sökande får tacket', (await text(page, '#apply-ok')).includes('Tack'), await text(page, '#apply-ok'));
    await context.close();
  }
}

/* ============ adminvyn ============ */
async function provaAdminvyn(webb) {
  /* 1. Det du inte sett: siffran, raden i listan, och att den går bort. */
  {
    const { context, page, S, riktiga, konsol } = await öppna(webb, { inloggad: true });
    await page.goto(BAS + '/admin');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
    await vänta(800);
    prova('admin: en ny ansökan sedan sist ger 1 vid Ansökningar', (await märke(page, 'ansokningar')) === '1',
      await märke(page, 'ansokningar'));
    prova('admin: en ny anmälan sedan sist ger 1 vid Intresseanmälningar, inte den gamla',
      (await märke(page, 'leads')) === '1', await märke(page, 'leads'));
    prova('admin: Att göra säger det', (await text(page, '#kon-lage')).includes('ny ansökan')
      && (await text(page, '#kon-lage')).includes('Har kommit in sedan du tittade senast'), await text(page, '#kon-lage'));
    await bild(page, 'admin-oversikt-fore');

    await page.click('#vy-sido a[data-sek="ansokningar"]');
    await vänta(600);
    const markerad = S.logg.find(r => r.väg === '/rest/v1/rpc/admin_sett_markera' && r.kropp.p_omrade === 'ansokningar');
    const ung = S.W.applications.find(a => a.id === 'ans-ung');
    prova('admin: att öppna Ansökningar sparar hur långt du sett, till den nyaste raden',
      markerad && markerad.kropp.p_till === ung.created_at, JSON.stringify(markerad && markerad.kropp));
    prova('admin: siffran vid Ansökningar är borta', (await märke(page, 'ansokningar')) === '', await märke(page, 'ansokningar'));
    prova('admin: den nya ansökan är märkt i listan', (await page.locator('#ans-tabell .adm-namn.ar-nytt').count()) === 1
      && (await text(page, '#ans-tabell .adm-namn.ar-nytt')).includes('Ny sedan du tittade senast'),
      await text(page, '#ans-tabell'));
    prova('admin: den gamla är inte märkt', (await page.locator('#ans-tabell .adm-namn:not(.ar-nytt)').count()) === 1);
    prova('admin: Intresseanmälningar står kvar tills den öppnas', (await märke(page, 'leads')) === '1');
    await bild(page, 'admin-ansokningar-nytt', '#ans-tabell');

    /* Ett nytt besök: inget märkt längre. */
    await page.click('#vy-sido a[data-sek="oversikt"]');
    await vänta(300);
    await page.click('#vy-sido a[data-sek="ansokningar"]');
    await vänta(400);
    prova('admin: nästa besök är inget märkt', (await page.locator('#ans-tabell .adm-namn.ar-nytt').count()) === 0);

    await page.click('#vy-sido a[data-sek="leads"]');
    await vänta(500);
    prova('admin: Intresseanmälningar: siffran går bort och den nya märks',
      (await märke(page, 'leads')) === '' && (await page.locator('#leads-tabell .adm-namn.ar-nytt').count()) === 1,
      (await märke(page, 'leads')) + ' / ' + (await page.locator('#leads-tabell .adm-namn.ar-nytt').count()));
    prova('admin: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
    prova('admin: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }

  /* 2. Utan tabellen: läget Ny räknas som förut, och inget markeras. */
  {
    const { context, page, S, konsol } = await öppna(webb, { inloggad: true, utanSett: true });
    await page.goto(BAS + '/admin#ansokningar');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
    await vänta(800);
    prova('admin utan admin_sett: läget Ny räknas som förut', (await märke(page, 'ansokningar')) === '1'
      && (await märke(page, 'leads')) === '2', (await märke(page, 'ansokningar')) + ' / ' + (await märke(page, 'leads')));
    prova('admin utan admin_sett: ingen markering skickas',
      !S.logg.some(r => r.väg === '/rest/v1/rpc/admin_sett_markera'));
    prova('admin utan admin_sett: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }

  /* 3. Under 18: vårdnadshavaren, godkännandet, och poolen. */
  {
    const { context, page, S, konsol } = await öppna(webb, { inloggad: true });
    await page.goto(BAS + '/admin#ansokningar');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
    await vänta(800);
    await page.click('[data-dp="ansokan:ans-ung"]');
    await vänta(400);
    const panel = await page.locator('.dp-fakta').first().innerText().catch(() => '');
    prova('admin: ansökan visar vårdnadshavarens adress och att den är mejlad',
      panel.includes('mamma@example.se') && panel.includes('mejlad'), panel);
    prova('admin: och att godkännandet väntar', panel.includes('Väntar på svar'), panel);
    await bild(page, 'admin-ansokan-under-18');

    await page.click('[data-ans-vh-in="ans-ung"]');
    await page.waitForSelector('#vh-svar');
    await page.fill('#vh-svar', 'Från: mamma@example.se\nDatum: 5 okt\n\nJag godkänner att Tove Lind söker jobb hos er.');
    await page.click('[data-fr="ja"]');
    await vänta(500);
    const lagd = S.logg.find(r => r.metod === 'PATCH' && r.väg === '/rest/v1/applications'
      && r.kropp && r.kropp.vardnadshavare_svar);
    prova('admin: godkännandet sparas med tid och kopia', lagd && lagd.kropp.vardnadshavare_godkand_at
      && lagd.kropp.vardnadshavare_svar.includes('Jag godkänner'), JSON.stringify(lagd && lagd.kropp));
    prova('admin: kopian står i ansökan', (await page.locator('#dp-panel, .dp-panel, [data-dp-panel]').first().innerText()
      .catch(() => page.locator('body').innerText())).includes('Jag godkänner att Tove Lind'));
    await bild(page, 'admin-ansokan-godkand');

    await page.click('[data-ans-vh-bort="ans-ung"]');
    await page.click('[data-svar="ja"]');
    await vänta(400);
    const bort = S.logg.filter(r => r.metod === 'PATCH' && r.väg === '/rest/v1/applications').pop();
    prova('admin: Ta bort godkännandet nollar båda', bort && bort.kropp.vardnadshavare_godkand_at === null
      && bort.kropp.vardnadshavare_svar === null, JSON.stringify(bort && bort.kropp));

    /* Redigera har fältet. */
    await page.click('[data-dp-redigera]');
    await vänta(200);
    prova('admin: Redigera har vårdnadshavarens e-post', (await page.locator('[name="vardnadshavare_epost"]').count()) === 1);
    await page.click('[data-dp-red-avbryt]');
    await vänta(200);

    /* Poolen utan godkännande: frågan först. */
    await page.click('[data-ans-pool="ans-ung"]');
    await vänta(300);
    prova('admin: Ta in i poolen frågar om godkännandet', (await text(page, '.nx-fraga-box h3')) === 'Vårdnadshavarens godkännande saknas',
      await text(page, '.nx-fraga-box h3'));
    await page.click('[data-svar="nej"]');
    prova('admin under 18: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }

  /* 4. Nejet: rutan visar mejlet, Avbryt ändrar inget, Avböj sparar. */
  {
    const { context, page, S, konsol } = await öppna(webb, { inloggad: true });
    await page.goto(BAS + '/admin#ansokningar');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
    await vänta(800);
    await page.click('[data-dp="ansokan:ans-gammal"]');
    await vänta(400);
    await bild(page, 'admin-ansokan-lage', '.dp');
    await page.click('[data-ans="ans-gammal"] > button[value="rejected"]');
    await page.waitForSelector('.nx-fraga-prov', { timeout: 3000 }).catch(() => {});
    const prov = await text(page, '.nx-fraga-prov');
    prova('admin: Avböjd visar mejlet först', prov.includes('Ämne: Om din ansökan till Nextrum') && prov.includes('Hej Kalle,')
      && prov.includes('Vi har valt att gå vidare med andra sökande den här gången.'), prov);
    prova('admin: och när det går', /får mejlet nedan (i dag|i morgon) kl\. \d\d:\d\d/.test(await text(page, '.nx-fraga-box p')),
      await text(page, '.nx-fraga-box p'));
    await bild(page, 'admin-avbojd-ruta', '.nx-fraga-box');
    await page.click('[data-svar="nej"]');
    await vänta(200);
    prova('admin: Avbryt sparar inget och lämnar läget',
      !S.logg.some(r => r.metod === 'PATCH' && r.kropp && r.kropp.status === 'rejected')
      && (await page.getAttribute('[data-ans="ans-gammal"] > button[value="contacted"]', 'aria-pressed')) === 'true'
      && (await page.getAttribute('[data-ans="ans-gammal"] > button[value="rejected"]', 'aria-pressed')) === 'false');

    await page.click('[data-ans="ans-gammal"] > button[value="rejected"]');
    await page.waitForSelector('.nx-fraga-prov', { timeout: 3000 }).catch(() => {});
    S.W.ansokan_utskick.push({ id: 'u3', ansokan_id: 'ans-gammal', steg: 'avbojd', nyckel: 'avbojd', status: 'vantar',
      forsok: 0, fel: null, skapad: nu(0), uppdaterad: nu(0), skicka_efter: nu(30) });
    await page.click('[data-svar="ja"]');
    await vänta(500);
    prova('admin: Avböj och mejla sparar läget', S.logg.some(r => r.metod === 'PATCH' && r.kropp && r.kropp.status === 'rejected'));
    prova('admin: och hämtar beskeden om', S.logg.some(r => r.metod === 'GET' && r.väg === '/rest/v1/ansokan_utskick'
      && r.sök.includes('ans-gammal')));
    await page.click('[data-dp-flik="rekrytering"]');
    await vänta(300);
    const spår = await page.locator('.ans-spar-lista').first().innerText().catch(() => '');
    const fot = await page.locator('.ans-spar-lista + p, .ans-spar-lista ~ p').first().innerText().catch(() => '');
    prova('admin: Rekryteringen säger när nejet går', /Nejet:.*går (i dag|i morgon) kl\./.test(spår + ' ' + fot + ' '
      + (await page.locator('body').innerText())), spår.slice(-300));
    prova('admin nejet: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }

  /* 5. Utan migrationen: ingen ruta om ett mejl som aldrig går, inga rader för vårdnadshavaren. */
  {
    const { context, page, S, konsol } = await öppna(webb, { inloggad: true, utanKolumner: true });
    await page.goto(BAS + '/admin#ansokningar');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
    await vänta(800);
    await page.click('[data-dp="ansokan:ans-ung"]');
    await vänta(400);
    const panel = await page.locator('.dp-fakta').first().innerText().catch(() => '');
    prova('admin utan migrationen: inga rader om vårdnadshavaren', !panel.includes('Vårdnadshavare'), panel);
    await page.click('[data-ans="ans-ung"] > button[value="rejected"]');
    await vänta(300);
    prova('admin utan migrationen: ingen ruta som lovar ett mejl', (await page.locator('.nx-fraga-prov').count()) === 0);
    prova('admin utan migrationen: läget sparas', S.logg.some(r => r.metod === 'PATCH' && r.kropp && r.kropp.status === 'rejected'));
    prova('admin utan migrationen: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
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
    await provaFormuläret(webb);
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
