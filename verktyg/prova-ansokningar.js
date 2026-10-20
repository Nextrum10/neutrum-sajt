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
   innan läget blir Avböjd, godkännandet i ansökan, att siffran vid
   Ansökningar och Intresseanmälningar går bort när man tittat, och
   knapparna som skickar vidare till intervju och utbildning
   (2026-10-13), i ansökans panel och med ett eget steg för intervjun,
   så att läget Kontaktad inte flyttar någon (2026-10-15), och
   bokningssidan för intervjun i mejlet Skriv till hen (2026-10-20). Reglerna
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
  /* Rekryteringens steg (2026-10-13): en i utbildningen utan hållet
     utbildningsmöte, och en som är utbildad och väntar på poolen. Med steget till
     intervju (2026-10-15) också en som skickats dit och en ny att boka
     ett möte med. */
  if (o.steg && !o.utanIntervjuKolumn) {
    w.applications.push(
      { id: 'ans-intervju', name: 'Ivar Intervju', email: 'ivar@example.se', age: 19, status: 'contacted',
        created_at: '2026-09-23T10:00:00Z', till_intervju_at: '2026-10-14T10:00:00Z', tjanster: ['laxhjalp'], why: 'Hej',
        vardnadshavare_epost: null, vardnadshavare_godkand_at: null, vardnadshavare_svar: null },
      { id: 'ans-boka', name: 'Bo Bokare', email: 'bo@example.se', age: 20, status: 'new',
        created_at: '2026-09-24T10:00:00Z', tjanster: ['laxhjalp'], why: 'Hej',
        vardnadshavare_epost: null, vardnadshavare_godkand_at: null, vardnadshavare_svar: null });
  }
  if (o.steg) {
    w.applications.push(
      { id: 'ans-utb', name: 'Ulla Utbildning', email: 'ulla@example.se', age: 20, status: 'contacted',
        created_at: '2026-09-22T10:00:00Z', intervju_at: '2026-10-01T10:00:00Z', tjanster: ['laxhjalp'], why: 'Hej',
        vardnadshavare_epost: null, vardnadshavare_godkand_at: null, vardnadshavare_svar: null },
      { id: 'ans-klar', name: 'Klara Klar', email: 'klara@example.se', age: 21, status: 'contacted',
        created_at: '2026-09-21T10:00:00Z', intervju_at: '2026-09-28T10:00:00Z', utbildningsmote_at: '2026-10-02T10:00:00Z',
        utbildad_at: '2026-10-03T10:00:00Z', tjanster: ['laxhjalp'], why: 'Hej',
        vardnadshavare_epost: null, vardnadshavare_godkand_at: null, vardnadshavare_svar: null });
  }
  if (o.utanKolumner) {
    w.applications.forEach(a => {
      delete a.vardnadshavare_epost; delete a.vardnadshavare_godkand_at; delete a.vardnadshavare_svar;
    });
    w.ansokan_utskick.forEach(u => { delete u.skicka_efter; });
  }
  /* Kolumnen till_intervju_at (migrationen ansokan_till_intervju): select=*
     ger nyckeln på varje rad när den finns, null eller inte. */
  if (!o.utanIntervjuKolumn) {
    w.applications.forEach(a => { if (!('till_intervju_at' in a)) a.till_intervju_at = null; });
  }
  /* Kolumnen intervju_mejl_skickat_at (migrationen intervjumejlet,
     2026-10-21): bara när provet ber om den, så att stegen ovan provar
     vyn som den var innan mejlet fanns. */
  if (o.medIntervjumejl) {
    w.applications.forEach(a => { a.intervju_mejl_skickat_at = null; });
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
    /* ansokan-mejl (2026-10-20): med o.mejl svarar den som när mejlet gått,
       annars som en funktion som inte är driftsatt. */
    if (p === '/functions/v1/ansokan-mejl' && o.mejl) return svar(route, 200, { ok: true, till: 'bo@example.se' });
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
      .replace(/SUPABASE_URL:\s*'[^']*'/, "SUPABASE_URL: '" + FALSK + "'")
      .replace(/INTERVJU_BOKNING_URL:\s*'[^']*'/, "INTERVJU_BOKNING_URL: '" + (o.bokning || '') + "'");
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
  /* Var hen är i skolan (2026-10-14): utan svar skickas inget. */
  await page.check('#ap-skolniva input[value="gymnasiet"]');
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

/* ============ rekryteringens steg (2026-10-13, valet 2026-10-15) ============
   Leo 2026-10-15: läget (Ny, Kontaktad, Godkänd, Avböjd) sätter han själv,
   och under Intervju står bara de han skickat dit. Knappen står på raden och
   i ansökans panel, och Ångra i Rekryteringen. */
async function provaStegen(webb) {
  const { context, page, S, riktiga, konsol } = await öppna(webb, { inloggad: true, steg: true });
  await page.goto(BAS + '/admin#ansokningar');
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
  await vänta(800);
  const patchar = () => S.logg.filter(r => r.metod === 'PATCH' && r.väg === '/rest/v1/applications');
  const rad = id => '#ans-tabell li:has([data-dp="ansokan:' + id + '"])';
  const flik = async f => { await page.click('#flik-ans-' + f); await vänta(200); };
  const lägeI = async id => (await text(page, rad(id) + ' .adm-namn-lage')).trim();
  const flikTal = async () => (await text(page, '#flik-ans-intervju-mark')) + ' / ' + (await text(page, '#flik-ans-utbildning-mark'));
  const öppnaPanel = async id => { await page.click('#ans-tabell [data-dp="ansokan:' + id + '"]'); await vänta(400); };
  const ansökan = id => S.W.applications.find(a => a.id === id);
  const listan = async sel => page.locator(sel + ' [data-dp]').evaluateAll(l => l.map(x => x.dataset.dp));

  /* Alla: läget för den som inte skickats vidare, steget för de andra. */
  prova('steg: Alla visar läget för den som inte gått vidare och steget för de andra',
    (await lägeI('ans-ung')) === 'Ny' && (await lägeI('ans-gammal')) === 'Kontaktad'
    && (await lägeI('ans-intervju')) === 'Intervju' && (await lägeI('ans-klar')) === 'Klar för poolen',
    [await lägeI('ans-ung'), await lägeI('ans-gammal'), await lägeI('ans-intervju'), await lägeI('ans-klar')].join(' / '));
  prova('steg: Till intervju på en ny och på en kontaktad, inte på den som redan gått vidare',
    (await page.locator(rad('ans-ung') + ' [data-ans-vidare="intervju:ans-ung"]').count()) === 1
    && (await page.locator(rad('ans-gammal') + ' [data-ans-vidare="intervju:ans-gammal"]').count()) === 1
    && (await page.locator(rad('ans-intervju') + ' [data-ans-vidare]').count()) === 0);
  prova('steg: läget Kontaktad är inte Intervju, bara den som skickats dit räknas',
    (await flikTal()) === '1 / 2', await flikTal());
  await bild(page, 'steg-alla', '#ans-tabell');

  /* Filtret skiljer Nya och Kontaktade. */
  await page.selectOption('#ans-status', 'kontaktad');
  await vänta(200);
  let filtrerat = (await listan('#ans-tabell')).sort();
  prova('steg: filtret Kontaktade', filtrerat.join() === 'ansokan:ans-gammal', filtrerat.join());
  await page.selectOption('#ans-status', 'ny');
  await vänta(200);
  filtrerat = (await listan('#ans-tabell')).sort();
  prova('steg: filtret Nya', filtrerat.join() === 'ansokan:ans-boka,ansokan:ans-ung', filtrerat.join());
  await page.selectOption('#ans-status', 'intervju');
  await vänta(200);
  filtrerat = (await listan('#ans-tabell')).sort();
  prova('steg: filtret Intervju', filtrerat.join() === 'ansokan:ans-intervju', filtrerat.join());
  await page.selectOption('#ans-status', '');
  await vänta(200);

  /* Läget Kontaktad i panelen sparar läget och flyttar ingen. */
  await öppnaPanel('ans-ung');
  await page.click('[data-ans="ans-ung"] > button[value="contacted"]');
  await vänta(400);
  const läget = patchar().pop();
  prova('steg: läget Kontaktad sparas som läget och inget annat',
    läget && JSON.stringify(läget.kropp) === '{"status":"contacted"}', JSON.stringify(läget && läget.kropp));
  prova('steg: och hen står kvar under Alla', (await lägeI('ans-ung')) === 'Kontaktad' && (await flikTal()) === '1 / 2',
    (await lägeI('ans-ung')) + ' ' + (await flikTal()));

  /* Panelen: Skicka vidare till intervju under läget, och Ta in i poolen
     är inte knappen att trycka på då. */
  prova('steg: panelen har Skicka vidare till intervju under läget',
    (await page.locator('.dp-atgard [data-ans-vidare="intervju:ans-ung"].btn-primary').count()) === 1
    && (await text(page, '.dp-atgard [data-ans-vidare="intervju:ans-ung"]')).trim() === 'Skicka vidare till intervju');
  prova('steg: Ta in i poolen är då inte primär', (await page.locator('.dp-atgard [data-ans-pool="ans-ung"].btn-ghost').count()) === 1);
  await bild(page, 'steg-panel-ny', '.dp');
  await page.click('.dp-atgard [data-ans-vidare="intervju:ans-ung"]');
  await vänta(400);
  const tillIntervju = patchar().pop();
  prova('steg: Skicka vidare till intervju sparar steget och inte läget', tillIntervju && tillIntervju.sök.includes('ans-ung')
    && Object.keys(tillIntervju.kropp || {}).join() === 'till_intervju_at'
    && !Number.isNaN(Date.parse(tillIntervju.kropp.till_intervju_at)), JSON.stringify(tillIntervju));
  prova('steg: utan fråga', (await page.locator('.nx-fraga-box').count()) === 0);
  prova('steg: läget står kvar', ansökan('ans-ung').status === 'contacted', ansökan('ans-ung').status);
  prova('steg: panelen visar Intervju och nästa knapp',
    (await text(page, '.dp-marken')).includes('Intervju')
    && (await page.locator('.dp-atgard [data-ans-vidare="utbildning:ans-ung"]').count()) === 1
    && (await page.locator('.dp-atgard [data-ans-vidare="intervju:ans-ung"]').count()) === 0,
    await text(page, '.dp-marken'));
  prova('steg: fliken Intervju räknar upp', (await flikTal()) === '2 / 2', await flikTal());
  await bild(page, 'steg-panel-intervju', '.dp');
  await page.click('[data-dp-stang]').catch(() => {});
  await vänta(200);

  /* Knappen på raden gör samma sak. */
  await page.click('[data-ans-vidare="intervju:ans-gammal"]');
  await vänta(400);
  const frånRaden = patchar().pop();
  prova('steg: Till intervju på raden sparar steget och inte läget', frånRaden && frånRaden.sök.includes('ans-gammal')
    && Object.keys(frånRaden.kropp || {}).join() === 'till_intervju_at', JSON.stringify(frånRaden));
  prova('steg: raden säger Intervju och knappen är borta', (await lägeI('ans-gammal')) === 'Intervju'
    && (await page.locator(rad('ans-gammal') + ' [data-ans-vidare]').count()) === 0, await lägeI('ans-gammal'));

  await flik('intervju');
  const iIntervju = await listan('#ans-intervju');
  prova('steg: Intervju har bara de tre som skickats dit, i den ordningen',
    iIntervju.join() === 'ansokan:ans-intervju,ansokan:ans-ung,ansokan:ans-gammal', iIntervju.join());
  const underUng = (await text(page, '#ans-intervju li:has([data-dp="ansokan:ans-ung"]) .adm-namn-text span')).trim();
  prova('steg: Intervju säger Kontaktad när läget är det, inte "Inte kontaktad än"', underUng === 'Kontaktad', underUng);
  prova('steg: varje rad i Intervju har Till utbildning',
    (await page.locator('#ans-intervju [data-ans-vidare^="utbildning:"]').count()) === 3);
  await bild(page, 'steg-intervju', '#panel-ans-intervju');

  /* Ångra i Rekryteringen: tillbaka till Alla, läget står kvar. */
  await page.click('#ans-intervju [data-dp="ansokan:ans-ung"]');
  await vänta(400);
  prova('steg: från Intervju öppnas Rekryteringen, med steg 1 Till intervju och Ångra',
    (await text(page, '.ans-steg h4')).includes('Till intervju')
    && (await text(page, '[data-ans-steg="tillintervju:ans-ung"]')).trim() === 'Ångra "till intervju"',
    await text(page, '.ans-steg h4'));
  await bild(page, 'steg-rekryteringen', '.dp');
  await page.click('[data-ans-steg="tillintervju:ans-ung"]');
  await vänta(400);
  const ångra = patchar().pop();
  prova('steg: Ångra tar bort steget och inget annat', ångra && ångra.sök.includes('ans-ung')
    && JSON.stringify(ångra.kropp) === '{"till_intervju_at":null}', JSON.stringify(ångra && ångra.kropp));
  prova('steg: hen har lämnat Intervju, med läget kvar',
    (await page.locator('#ans-intervju [data-dp="ansokan:ans-ung"]').count()) === 0 && (await flikTal()) === '2 / 2'
    && ansökan('ans-ung').status === 'contacted', await flikTal());
  prova('steg: och knappen skickar vidare igen',
    (await text(page, '[data-ans-steg="tillintervju:ans-ung"]')).trim() === 'Skicka vidare till intervju');
  await page.click('[data-ans-steg="tillintervju:ans-ung"]');
  await vänta(400);
  const igen = patchar().pop();
  prova('steg: Skicka vidare i Rekryteringen sätter steget igen', igen
    && Object.keys(igen.kropp || {}).join() === 'till_intervju_at' && igen.kropp.till_intervju_at
    && (await flikTal()) === '3 / 2', JSON.stringify(igen && igen.kropp) + ' ' + (await flikTal()));

  /* Panelen: Skicka vidare till utbildning frågar, för ett mejl går. */
  await page.click('.dp-flik[data-dp-flik="oversikt"]');
  await vänta(300);
  const före = patchar().length;
  await page.click('.dp-atgard [data-ans-vidare="utbildning:ans-ung"]');
  await page.waitForSelector('.nx-fraga-box', { timeout: 3000 }).catch(() => {});
  prova('steg: Skicka vidare till utbildning frågar och säger att ett mejl går',
    (await text(page, '.nx-fraga-box h3')).includes('Tove Lind') && (await text(page, '.nx-fraga-box')).includes('mejl'),
    await text(page, '.nx-fraga-box'));
  await bild(page, 'steg-fraga', '.nx-fraga-box');
  await page.click('[data-svar="nej"]');
  await vänta(200);
  prova('steg: Avbryt sparar inget', patchar().length === före);
  await page.click('.dp-atgard [data-ans-vidare="utbildning:ans-ung"]');
  await page.waitForSelector('.nx-fraga-box', { timeout: 3000 }).catch(() => {});
  await page.click('[data-svar="ja"]');
  await vänta(500);
  const tillUtb = patchar().pop();
  prova('steg: Skicka vidare till utbildning sätter intervju_at och inget annat', tillUtb && tillUtb.sök.includes('ans-ung')
    && Object.keys(tillUtb.kropp || {}).join() === 'intervju_at' && !Number.isNaN(Date.parse(tillUtb.kropp.intervju_at)),
    JSON.stringify(tillUtb));
  prova('steg: och hämtar beskeden om', S.logg.some(r => r.metod === 'GET' && r.väg === '/rest/v1/ansokan_utskick'
    && r.sök.includes('ans-ung')));
  prova('steg: panelen visar Utbildning, ingen knapp vidare, och Ta in i poolen är primär',
    (await text(page, '.dp-marken')).includes('Utbildning')
    && (await page.locator('.dp-atgard [data-ans-vidare]').count()) === 0
    && (await page.locator('.dp-atgard [data-ans-pool="ans-ung"].btn-primary').count()) === 1,
    await text(page, '.dp-marken'));
  prova('steg: flikarna efter utbildningen', (await flikTal()) === '2 / 3', await flikTal());
  await page.click('[data-dp-stang]').catch(() => {});
  await vänta(200);

  /* Raden i Intervju skickar också vidare, efter samma fråga. */
  await page.click('#ans-intervju [data-ans-vidare="utbildning:ans-gammal"]');
  await page.waitForSelector('.nx-fraga-box', { timeout: 3000 }).catch(() => {});
  await page.click('[data-svar="ja"]');
  await vänta(500);
  const radUtb = patchar().pop();
  prova('steg: Till utbildning på raden sätter intervju_at', radUtb && radUtb.sök.includes('ans-gammal')
    && Object.keys(radUtb.kropp || {}).join() === 'intervju_at', JSON.stringify(radUtb));
  prova('steg: Kalle har lämnat Intervju', (await page.locator('#ans-intervju [data-dp="ansokan:ans-gammal"]').count()) === 0
    && (await flikTal()) === '1 / 4', await flikTal());

  await flik('utbildning');
  prova('steg: Utbildning har dem, utbildningsmötet att bocka av och poolen för den som är klar',
    (await page.locator('#ans-utbildning [data-dp="ansokan:ans-gammal"]').count()) === 1
    && (await page.locator('#ans-utbildning [data-dp="ansokan:ans-ung"]').count()) === 1
    && (await page.locator('#ans-utbildning [data-ans-steg="utbmote:ans-utb"]').count()) === 1
    && (await page.locator('#ans-utbildning [data-ans-pool="ans-klar"]').count()) === 1);
  prova('steg: den som är klar säger det', (await text(page, '#ans-utbildning li:has([data-dp="ansokan:ans-klar"]) .adm-namn-text span'))
    .includes('klar att tas in i poolen'));
  await bild(page, 'steg-utbildning', '#panel-ans-utbildning');

  /* Utbildningens nästa steg på raden (2026-10-21, när provet i ansökan
     togs bort): utbildningsmötet går utan fråga och mejlar inget, och
     Markera utbildad frågar först, för den mejlar sista steget. */
  const förMötet = patchar().length;
  await page.click('#ans-utbildning [data-ans-steg="utbmote:ans-utb"]');
  await vänta(500);
  const mötet = patchar().pop();
  prova('steg: utbildningsmötet sparas utan fråga och sätter bara sin tid',
    patchar().length === förMötet + 1 && mötet.sök.includes('ans-utb')
    && Object.keys(mötet.kropp || {}).join() === 'utbildningsmote_at'
    && (await page.locator('.nx-fraga-box').count()) === 0, JSON.stringify(mötet));
  prova('steg: sedan är Markera utbildad nästa steg på raden',
    (await page.locator('#ans-utbildning [data-ans-steg="utbildad:ans-utb"]').count()) === 1
    && (await text(page, '#ans-utbildning li:has([data-dp="ansokan:ans-utb"]) .adm-namn-text span'))
      .includes('inte markerad utbildad än'),
    await text(page, '#ans-utbildning li:has([data-dp="ansokan:ans-utb"]) .adm-namn-text span'));
  const förUtbildad = patchar().length;
  await page.click('#ans-utbildning [data-ans-steg="utbildad:ans-utb"]');
  await page.waitForSelector('.nx-fraga-box', { timeout: 3000 }).catch(() => {});
  prova('steg: Markera utbildad frågar först och säger att sista steget mejlas',
    (await text(page, '.nx-fraga-box')).includes('mejlet om sista steget'), await text(page, '.nx-fraga-box'));
  await page.click('[data-svar="nej"]');
  await vänta(200);
  prova('steg: Avbryt sparar inget', patchar().length === förUtbildad);
  await page.click('#ans-utbildning [data-ans-steg="utbildad:ans-utb"]');
  await page.waitForSelector('.nx-fraga-box', { timeout: 3000 }).catch(() => {});
  await page.click('[data-svar="ja"]');
  await vänta(500);
  const utbildad = patchar().pop();
  prova('steg: Markera utbildad sätter bara utbildad_at', patchar().length === förUtbildad + 1
    && utbildad.sök.includes('ans-utb') && Object.keys(utbildad.kropp || {}).join() === 'utbildad_at',
    JSON.stringify(utbildad));
  prova('steg: och då är poolen nästa steg på raden',
    (await page.locator('#ans-utbildning [data-ans-pool="ans-utb"]').count()) === 1);

  /* Ett bokat möte är intervjun: den nya hamnar under Intervju. */
  await flik('alla');
  await öppnaPanel('ans-boka');
  await page.click('.dp-flik[data-dp-flik="rekrytering"]');
  await vänta(300);
  await page.click('[data-ans-mote="ans-boka"]');
  await page.waitForSelector('#mo-datum', { timeout: 3000 }).catch(() => {});
  const imorgon = new Date(Date.now() + 24 * 3600 * 1000);
  const dag = imorgon.getFullYear() + '-' + String(imorgon.getMonth() + 1).padStart(2, '0') + '-'
    + String(imorgon.getDate()).padStart(2, '0');
  await page.fill('#mo-datum', dag);
  await page.fill('#mo-tid', '17:00');
  await page.fill('#mo-lank', 'meet.google.com/abc-defg-hij');
  await page.click('[data-fr="ja"]');
  await vänta(500);
  const bokat = patchar().pop();
  prova('steg: Boka möte skickar en ny vidare till intervju', bokat && bokat.sök.includes('ans-boka')
    && Object.keys(bokat.kropp || {}).sort().join() === 'mote_lank,mote_tid,till_intervju_at'
    && bokat.kropp.mote_lank === 'https://meet.google.com/abc-defg-hij', JSON.stringify(bokat && bokat.kropp));
  prova('steg: och läget står kvar', ansökan('ans-boka').status === 'new', ansökan('ans-boka').status);
  prova('steg: hen står under Intervju med mötet', (await flikTal()) === '2 / 4'
    && (await text(page, '#ans-intervju li:has([data-dp="ansokan:ans-boka"]) .adm-namn-text span')).startsWith('Möte '),
    await flikTal());
  await page.click('[data-dp-stang]').catch(() => {});
  await vänta(200);

  /* Filtret Utbildning tar med den som är klar. */
  await page.selectOption('#ans-status', 'utbildning');
  await vänta(200);
  filtrerat = (await listan('#ans-tabell')).sort();
  prova('steg: filtret Utbildning', filtrerat.join() === 'ansokan:ans-gammal,ansokan:ans-klar,ansokan:ans-ung,ansokan:ans-utb',
    filtrerat.join());
  await page.selectOption('#ans-status', '');

  prova('steg: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('steg: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();

  /* Telefonen: knappen under namnet, minst 44 px, inget utanför rutan,
     och panelens knappar ryms. */
  {
    const { context, page, konsol } = await öppna(webb, { inloggad: true, steg: true,
      context: { viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true } });
    await page.goto(BAS + '/admin#ansokningar');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
    await vänta(800);
    const mått = await page.evaluate(() => {
      const k = document.querySelector('[data-ans-vidare="intervju:ans-ung"]');
      const n = k.closest('li').querySelector('.adm-namn');
      const kr = k.getBoundingClientRect(), nr = n.getBoundingClientRect();
      const mitt = document.elementFromPoint(kr.left + kr.width / 2, kr.top + kr.height / 2);
      return { h: kr.height, under: kr.top >= nr.bottom - 1, höger: kr.right, bredd: innerWidth,
        sida: document.documentElement.scrollWidth, träff: !!mitt && mitt.closest('[data-ans-vidare]') === k };
    });
    prova('steg telefon: knappen står under namnet', mått.under, JSON.stringify(mått));
    prova('steg telefon: minst 44 px och träffbar', mått.h >= 44 && mått.träff, JSON.stringify(mått));
    prova('steg telefon: inget sticker ut', mått.höger <= mått.bredd && mått.sida <= mått.bredd, JSON.stringify(mått));
    await bild(page, 'steg-telefon', '#ans-tabell');

    await page.click('#ans-tabell [data-dp="ansokan:ans-ung"]');
    await vänta(500);
    const panel = await page.evaluate(() => {
      const k = document.querySelector('.dp-atgard [data-ans-vidare="intervju:ans-ung"]');
      if (!k) return null;
      k.scrollIntoView({ block: 'center' });
      const kr = k.getBoundingClientRect();
      const mitt = document.elementFromPoint(kr.left + kr.width / 2, kr.top + kr.height / 2);
      return { h: kr.height, vänster: kr.left, höger: kr.right, bredd: innerWidth,
        sida: document.documentElement.scrollWidth, träff: !!mitt && mitt.closest('[data-ans-vidare]') === k };
    });
    prova('steg telefon: panelens knapp är minst 44 px, träffbar och inom rutan', panel && panel.h >= 44 && panel.träff
      && panel.vänster >= 0 && panel.höger <= panel.bredd && panel.sida <= panel.bredd, JSON.stringify(panel));
    await bild(page, 'steg-telefon-panel', '.dp');
    prova('steg telefon: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
}

/* ============ bokningssidan för intervjun (2026-10-20) ============
   Med INTERVJU_BOKNING_URL satt har mejlet Skriv till hen länken i
   stället för tre tider, och det skickar en ny till Intervju. Utan den
   är allt som förut: tre tider och bara en kontakt. */
async function provaBokningssidan(webb) {
  const SIDA = 'https://calendar.app.google/provet123';
  for (const medSida of [true, false]) {
    const namn = medSida ? 'bokningssida' : 'utan bokningssida';
    const { context, page, S, riktiga, konsol } = await öppna(webb,
      { inloggad: true, steg: true, bokning: medSida ? SIDA : '' });
    await page.goto(BAS + '/admin#ansokningar');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
    await vänta(800);
    /* Gmail öppnas inte: adressen fångas, och fliken stannar här. */
    await page.evaluate(() => { window.open = u => { window.öppnadGmail = String(u); return null; }; });
    const patchar = () => S.logg.filter(r => r.metod === 'PATCH' && r.väg === '/rest/v1/applications');
    const flikTal = async () => (await text(page, '#flik-ans-intervju-mark')) + ' / ' + (await text(page, '#flik-ans-utbildning-mark'));
    const skrivTill = async id => {
      await page.click('#ans-tabell [data-dp="ansokan:' + id + '"]');
      await vänta(400);
      await page.click('.dp-flik[data-dp-flik="rekrytering"]');
      await vänta(300);
      const steg = await text(page, '.ans-spar-lista');
      await bild(page, (medSida ? 'bokning' : 'bokning-utan') + '-steg-' + id, '.ans-spar-lista');
      await page.click('[data-ans-kontakt="' + id + '"]');
      await page.waitForSelector('#kt-text', { timeout: 3000 }).catch(() => {});
      const mejl = await page.inputValue('#kt-text').catch(() => '');
      await bild(page, (medSida ? 'bokning' : 'bokning-utan') + '-mejl-' + id, '.nx-fraga-box');
      await page.click('#kt-oppna');
      await vänta(500);
      return { steg, mejl, patch: patchar().pop(), gmail: await page.evaluate(() => window.öppnadGmail || '') };
    };

    const ny = await skrivTill('ans-boka');
    const nycklar = ny.patch ? Object.keys(ny.patch.kropp || {}).sort().join() : '';
    if (medSida) {
      prova(namn + ': steg 1 visar bokningssidan', ny.steg.includes('Bokningssida: ' + SIDA), ny.steg.slice(0, 400));
      prova(namn + ': steg 2 säger att mötet står i kalendern och att Boka möte mejlar igen',
        ny.steg.includes('kalendern för info@nextrum.se') && ny.steg.includes('mejlas till hen också när hen redan bokat'));
      prova(namn + ': mejlet har länken och inte de tre tiderna', ny.mejl.includes('Välj en tid som passar dig här:\n' + SIDA)
        && !ny.mejl.includes('Passar någon av de här tiderna') && ny.mejl.includes('Google Meet'), ny.mejl);
      prova(namn + ': länken går med till Gmail', ny.gmail.includes(encodeURIComponent(SIDA)), ny.gmail.slice(0, 200));
      prova(namn + ': Skriv till hen skickar en ny till Intervju', ny.patch && ny.patch.sök.includes('ans-boka')
        && nycklar === 'kontaktad_at,status,till_intervju_at' && ny.patch.kropp.status === 'contacted'
        && ny.patch.kropp.till_intervju_at === ny.patch.kropp.kontaktad_at, JSON.stringify(ny.patch && ny.patch.kropp));
      prova(namn + ': och hen står under Intervju', (await flikTal()) === '2 / 2', await flikTal());
    } else {
      prova(namn + ': steg 1 säger var länken sätts', ny.steg.includes('Ingen bokningssida är satt')
        && ny.steg.includes('INTERVJU_BOKNING_URL'), ny.steg.slice(0, 400));
      prova(namn + ': mejlet föreslår tider som förut', ny.mejl.includes('Passar någon av de här tiderna?')
        && !ny.mejl.includes('calendar.app.google'), ny.mejl);
      prova(namn + ': Skriv till hen är bara en kontakt', nycklar === 'kontaktad_at,status', nycklar);
      prova(namn + ': och hen står kvar under Alla', (await flikTal()) === '1 / 2', await flikTal());
    }
    await page.click('[data-dp-stang]').catch(() => {});
    await vänta(200);

    /* Den som redan är under Intervju får mejlet igen utan ny stämpel. */
    if (medSida) {
      const igen = await skrivTill('ans-intervju');
      prova(namn + ': Skriv igen till den som redan är under Intervju sätter ingen ny stämpel',
        igen.patch && !('till_intervju_at' in (igen.patch.kropp || {})), JSON.stringify(igen.patch && igen.patch.kropp));
    }

    prova(namn + ': inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
    prova(namn + ': inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
}

/* ============ mejlet skickas härifrån (2026-10-20) ============
   Skicka i rutan anropar ansokan-mejl med ansökan, det redigerade ämnet
   och texten och en nyckel för rutan, aldrig en adress. Går mejlet
   stämplas det som Öppna i Gmail gjorde; går det inte står rutan kvar
   med felet, och inget sparas. */
async function provaSkickaHarifran(webb) {
  const SIDA = 'https://calendar.app.google/provet123';
  for (const går of [true, false]) {
    const namn = går ? 'skicka' : 'skicka utan funktionen';
    const { context, page, S, riktiga, konsol } = await öppna(webb,
      { inloggad: true, steg: true, bokning: SIDA, mejl: går });
    await page.goto(BAS + '/admin#ansokningar');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
    await vänta(800);
    await page.evaluate(() => { window.open = u => { window.öppnadGmail = String(u); return null; }; });
    const patchar = () => S.logg.filter(r => r.metod === 'PATCH' && r.väg === '/rest/v1/applications');
    const anrop = () => S.logg.filter(r => r.väg === '/functions/v1/ansokan-mejl' && r.metod === 'POST');
    const flikTal = async () => (await text(page, '#flik-ans-intervju-mark')) + ' / ' + (await text(page, '#flik-ans-utbildning-mark'));

    await page.click('#ans-tabell [data-dp="ansokan:ans-boka"]');
    await vänta(400);
    await page.click('.dp-flik[data-dp-flik="rekrytering"]');
    await vänta(300);
    await page.click('[data-ans-kontakt="ans-boka"]');
    await page.waitForSelector('#kt-skicka', { timeout: 3000 }).catch(() => {});
    if (går) {
      prova(namn + ': rutan har Skicka och Gmail bredvid', (await page.locator('#kt-skicka.btn-primary').count()) === 1
        && (await page.locator('#kt-oppna.btn-ghost').count()) === 1);
      prova(namn + ': Till går inte att ändra', await page.locator('#kt-till').evaluate(el => el.readOnly));
      prova(namn + ': rutan säger att mejlet går från info@', (await text(page, '.nx-fraga-box')).includes('skickas från info@nextrum.se'));
      await bild(page, 'skicka-ruta', '.nx-fraga-box');
    }
    const före = patchar().length;
    await page.fill('#kt-amne', 'Intervju hos Nextrum');
    await page.locator('#kt-text').evaluate(el => { el.value = el.value + '\n\nPS. Hör av dig om något är oklart.'; });
    await page.click('#kt-skicka');
    await vänta(700);
    const a = anrop().pop();
    prova(namn + ': Skicka anropar ansokan-mejl med ansökan, ämnet och den redigerade texten',
      a && a.kropp && a.kropp.ansokan === 'ans-boka' && a.kropp.amne === 'Intervju hos Nextrum'
      && a.kropp.text.includes('PS. Hör av dig') && a.kropp.text.includes(SIDA)
      && /^[a-z0-9-]{8,64}$/i.test(a.kropp.forsok || '') && !('till' in a.kropp),
      JSON.stringify(a && a.kropp).slice(0, 300));
    prova(namn + ': Gmail öppnas inte', !(await page.evaluate(() => window.öppnadGmail)));
    if (går) {
      prova(namn + ': rutan stängs', (await page.locator('#kt-skicka').count()) === 0);
      const st = patchar().pop();
      prova(namn + ': stämpeln sparas och hen står under Intervju', patchar().length === före + 1
        && st && 'till_intervju_at' in st.kropp && (await flikTal()) === '2 / 2',
        JSON.stringify(st && st.kropp) + ' ' + (await flikTal()));
    } else {
      const fel = await text(page, '#kt-msg');
      prova(namn + ': rutan står kvar med felet och Gmail som väg', (await page.locator('#kt-skicka').count()) === 1
        && fel.startsWith('Mejlet skickades inte: ansokan-mejl är inte driftsatt än.') && fel.includes('Gmail'), fel);
      prova(namn + ': inget sparas', patchar().length === före, patchar().length + ' mot ' + före);
      await bild(page, 'skicka-fel', '.nx-fraga-box');
    }
    prova(namn + ': inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
    prova(namn + ': inga fel i konsolen', konsol.filter(k => !/ansokan-mejl|non-2xx/.test(k)).length === 0, konsol.join(' | '));
    await context.close();
  }
}

/* ============ rekryteringens steg utan kolumnen (2026-10-13) ============
   Före migrationen ansokan_till_intervju räknas Intervju ur läget
   Kontaktad, och Till intervju sätter läget, som det gjorde 2026-10-13. */
/* ============ Intervjumejlet (2026-10-21) ============
   Skicka vidare till intervju köar ett mejl, så frågan visar det först,
   ord för ord; Avbryt sparar inget, och ett mejl som redan gått sägs. */
async function provaIntervjumejlet(webb) {
  const { context, page, S, konsol } = await öppna(webb, { inloggad: true, steg: true, medIntervjumejl: true });
  await page.goto(BAS + '/admin#ansokningar');
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
  await vänta(800);
  const patchar = () => S.logg.filter(r => r.metod === 'PATCH' && r.väg === '/rest/v1/applications');

  await page.click('#ans-tabell [data-dp="ansokan:ans-ung"]');
  await vänta(400);
  await page.click('.dp-atgard [data-ans-vidare="intervju:ans-ung"]');
  await page.waitForSelector('.nx-fraga-prov', { timeout: 3000 }).catch(() => {});
  const prov = await text(page, '.nx-fraga-prov');
  prova('intervjumejlet: frågan visar Leos mejl med bokningslänken',
    prov.includes('Ämne: Du går vidare till intervju') && prov.includes('Hej Tove!')
    && prov.includes('Tack för din ansökan till Nextrum. Vi har läst den och du går vidare till intervjufasen.')
    && prov.includes('Boka en tid för intervjun som passar dig här:\nhttps://calendar.app.google/rRiTTLP5ymKQunSv7\n\n'
      + 'Intervjun hålls i Google Meet, och länken till mötet kommer i bekräftelsen när du har bokat. '
      + 'Du behöver inget Google-konto. Passar ingen av tiderna får du gärna mejla oss på info@nextrum.se.')
    && prov.includes('Hälsningar\nLeo och Alex, Nextrum'), prov);
  await bild(page, 'intervjumejlet-ruta', '.nx-fraga-box');
  await page.click('[data-svar="nej"]');
  await vänta(200);
  prova('intervjumejlet: Avbryt sparar inget', patchar().length === 0, JSON.stringify(patchar()));

  await page.click('.dp-atgard [data-ans-vidare="intervju:ans-ung"]');
  await page.waitForSelector('.nx-fraga-prov', { timeout: 3000 }).catch(() => {});
  await page.click('[data-svar="ja"]');
  await vänta(500);
  const sparat = patchar().pop();
  prova('intervjumejlet: Skicka vidare och mejla sparar bara steget', sparat
    && Object.keys(sparat.kropp || {}).join() === 'till_intervju_at', JSON.stringify(sparat));
  await page.click('[data-dp-stang]').catch(() => {});
  await vänta(200);

  /* Ett mejl som redan gått: frågan säger att inget nytt går. */
  S.W.applications.find(a => a.id === 'ans-gammal').intervju_mejl_skickat_at = '2026-10-10T10:00:00Z';
  await page.evaluate(() => location.reload());
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
  await vänta(800);
  await page.click('[data-ans-vidare="intervju:ans-gammal"]');
  await page.waitForSelector('.nx-fraga-box', { timeout: 3000 }).catch(() => {});
  const redan = await text(page, '.nx-fraga-box p');
  prova('intervjumejlet: ett mejl som gått mejlas inte igen, och frågan säger det',
    /fick intervjumejlet .* inget nytt mejl går/.test(redan) && (await page.locator('.nx-fraga-prov').count()) === 0, redan);
  await page.click('[data-svar="nej"]');

  prova('intervjumejlet: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();
}

async function provaStegenUtanKolumnen(webb) {
  const { context, page, S, riktiga, konsol } = await öppna(webb, { inloggad: true, steg: true, utanIntervjuKolumn: true });
  await page.goto(BAS + '/admin#ansokningar');
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
  await vänta(800);
  const patchar = () => S.logg.filter(r => r.metod === 'PATCH' && r.väg === '/rest/v1/applications');
  const rad = id => '#ans-tabell li:has([data-dp="ansokan:' + id + '"])';
  const flik = async f => { await page.click('#flik-ans-' + f); await vänta(200); };

  prova('steg utan kolumnen: en ny ansökan har Till intervju', (await page.locator(rad('ans-ung') + ' [data-ans-vidare="intervju:ans-ung"]').count()) === 1);
  prova('steg utan kolumnen: en som redan gått vidare har ingen knapp i Alla', (await page.locator(rad('ans-gammal') + ' [data-ans-vidare]').count()) === 0);
  prova('steg utan kolumnen: Alla visar steget', (await text(page, rad('ans-gammal') + ' .adm-namn-lage')).trim() === 'Intervju'
    && (await text(page, rad('ans-klar') + ' .adm-namn-lage')).trim() === 'Klar för poolen'
    && (await text(page, rad('ans-ung') + ' .adm-namn-lage')).trim() === 'Ny',
    [await text(page, rad('ans-gammal') + ' .adm-namn-lage'), await text(page, rad('ans-klar') + ' .adm-namn-lage')].join(' / '));
  prova('steg utan kolumnen: flikarna räknar', (await text(page, '#flik-ans-intervju-mark')) === '1'
    && (await text(page, '#flik-ans-utbildning-mark')) === '2',
    (await text(page, '#flik-ans-intervju-mark')) + ' / ' + (await text(page, '#flik-ans-utbildning-mark')));
  await bild(page, 'reserv-steg-alla', '#ans-tabell');

  /* Till intervju: läget Kontaktad, ingen fråga, och raden flyttar. */
  await page.click('[data-ans-vidare="intervju:ans-ung"]');
  await vänta(400);
  const tillIntervju = patchar().pop();
  prova('steg utan kolumnen: Till intervju sparar läget Kontaktad och inget annat', tillIntervju
    && JSON.stringify(tillIntervju.kropp) === '{"status":"contacted"}' && tillIntervju.sök.includes('ans-ung'),
    JSON.stringify(tillIntervju));
  prova('steg utan kolumnen: utan fråga', (await page.locator('.nx-fraga-box').count()) === 0);
  prova('steg utan kolumnen: raden säger Intervju och knappen är borta', (await text(page, rad('ans-ung') + ' .adm-namn-lage')).trim() === 'Intervju'
    && (await page.locator(rad('ans-ung') + ' [data-ans-vidare]').count()) === 0);
  prova('steg utan kolumnen: fliken Intervju räknar upp', (await text(page, '#flik-ans-intervju-mark')) === '2');

  await flik('intervju');
  const iIntervju = await page.locator('#ans-intervju [data-dp]').evaluateAll(l => l.map(x => x.dataset.dp));
  prova('steg utan kolumnen: Intervju har de två som skickats dit', iIntervju.length === 2 && iIntervju.includes('ansokan:ans-ung')
    && iIntervju.includes('ansokan:ans-gammal'), iIntervju.join(', '));
  prova('steg utan kolumnen: varje rad i Intervju har Till utbildning',
    (await page.locator('#ans-intervju [data-ans-vidare^="utbildning:"]').count()) === 2);
  await bild(page, 'reserv-steg-intervju', '#panel-ans-intervju');

  /* Till utbildning frågar, för ett mejl går. Avbryt sparar inget. */
  const före = patchar().length;
  await page.click('[data-ans-vidare="utbildning:ans-gammal"]');
  await page.waitForSelector('.nx-fraga-box', { timeout: 3000 }).catch(() => {});
  prova('steg utan kolumnen: Till utbildning frågar och säger att ett mejl går',
    (await text(page, '.nx-fraga-box h3')).includes('Kalle Sökande') && (await text(page, '.nx-fraga-box')).includes('mejl'),
    await text(page, '.nx-fraga-box'));
  await bild(page, 'reserv-steg-fraga', '.nx-fraga-box');
  await page.click('[data-svar="nej"]');
  await vänta(200);
  prova('steg utan kolumnen: Avbryt sparar inget', patchar().length === före);
  await page.click('[data-ans-vidare="utbildning:ans-gammal"]');
  await page.waitForSelector('.nx-fraga-box', { timeout: 3000 }).catch(() => {});
  await page.click('[data-svar="ja"]');
  await vänta(500);
  const tillUtb = patchar().pop();
  prova('steg utan kolumnen: Skicka till utbildningen sätter intervju_at och inget annat', tillUtb && tillUtb.sök.includes('ans-gammal')
    && Object.keys(tillUtb.kropp || {}).join() === 'intervju_at' && !Number.isNaN(Date.parse(tillUtb.kropp.intervju_at)),
    JSON.stringify(tillUtb));
  prova('steg utan kolumnen: och hämtar beskeden om', S.logg.some(r => r.metod === 'GET' && r.väg === '/rest/v1/ansokan_utskick'
    && r.sök.includes('ans-gammal')));
  prova('steg utan kolumnen: Kalle har lämnat Intervju', (await page.locator('#ans-intervju [data-dp="ansokan:ans-gammal"]').count()) === 0
    && (await text(page, '#flik-ans-intervju-mark')) === '1' && (await text(page, '#flik-ans-utbildning-mark')) === '3');

  await flik('utbildning');
  prova('steg utan kolumnen: Utbildning har Kalle, utbildningsmötet att bocka av och poolen för den som är klar',
    (await page.locator('#ans-utbildning [data-dp="ansokan:ans-gammal"]').count()) === 1
    && (await page.locator('#ans-utbildning [data-ans-steg="utbmote:ans-utb"]').count()) === 1
    && (await page.locator('#ans-utbildning [data-ans-pool="ans-klar"]').count()) === 1);
  prova('steg utan kolumnen: den som är klar säger det', (await text(page, '#ans-utbildning li:has([data-dp="ansokan:ans-klar"]) .adm-namn-text span'))
    .includes('klar att tas in i poolen'));
  await bild(page, 'reserv-steg-utbildning', '#panel-ans-utbildning');

  /* Namnet öppnar fortfarande panelen, med steget överst. */
  await page.click('#ans-utbildning [data-dp="ansokan:ans-gammal"]');
  await vänta(400);
  prova('steg utan kolumnen: panelen visar steget', (await text(page, '.dp-marken')).includes('Utbildning'), await text(page, '.dp-marken'));
  await page.click('[data-dp-stang]').catch(() => {});
  await vänta(200);

  /* Filtret är steget, och Utbildning tar med den som är klar. */
  await flik('alla');
  await page.selectOption('#ans-status', 'utbildning');
  await vänta(200);
  const filtrerat = await page.locator('#ans-tabell [data-dp]').evaluateAll(l => l.map(x => x.dataset.dp).sort());
  prova('steg utan kolumnen: filtret Utbildning', filtrerat.join() === 'ansokan:ans-gammal,ansokan:ans-klar,ansokan:ans-utb', filtrerat.join());
  await page.selectOption('#ans-status', '');

  prova('steg utan kolumnen: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('steg utan kolumnen: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
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
    await provaFormuläret(webb);
    await provaAdminvyn(webb);
    await provaStegen(webb);
    await provaBokningssidan(webb);
    await provaSkickaHarifran(webb);
    await provaStegenUtanKolumnen(webb);
    await provaIntervjumejlet(webb);
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
