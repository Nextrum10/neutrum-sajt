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
   innan ansökan avböjs, godkännandet i ansökan, att siffran vid
   Ansökningar och Intresseanmälningar går bort när man tittat, och
   ansökningarnas steg (2026-10-22): flikarna Nya ansökningar, Intervju,
   Utbildning, Konto skapat och Avböjda med antal, Intervjus tre knappar
   (Skicka intervjulänk igen, Ångra intervju, Gå vidare till utbildning)
   och Utbildning hållen, som skapar kontot med bjud-in och kopplar det i
   databasen. Reglerna i databasen provas i verktyg/rls-test.sql (avsnitt
   47), mallarna i supabase/functions/_delad/notiser/ansokan_test.ts.
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
/* Samma regel som intern.ansokan_steg (ansokningarnas_steg). */
function stegFör(a) {
  if (a.konto_id || a.status === 'approved') return 'konto_skapat';
  if (a.intervju_at || a.utbildningsmote_at || a.utbildad_at) return 'utbildning';
  if (a.till_intervju_at) return 'intervju';
  return 'ny';
}

function värld(o) {
  const w = {
    profiles: [
      { id: 'admin-1', role: 'parent', full_name: 'Leo Admin', email: 'leo@example.se', is_admin: true,
        match_status: 'pending', created_at: '2026-09-01T10:00:00Z' },
      { id: 'sh-1', role: 'tutor', full_name: 'Tove Lind', email: 'tove@example.se', is_admin: false,
        created_at: '2026-10-03T10:00:00Z' },
      /* Ulla har redan ett konto med adressen i ansökan (2026-10-22). */
      { id: 'sh-ulla', role: 'tutor', full_name: 'Ulla Utbildning', email: 'ulla@example.se', is_admin: false,
        created_at: '2026-10-04T10:00:00Z' }
    ],
    tutor_profiles: [{ id: 'sh-1', status: 'pending', created_at: '2026-10-03T10:00:00Z' },
      { id: 'sh-ulla', status: 'pending', created_at: '2026-10-04T10:00:00Z' }],
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
  /* Ansökningarnas steg (2026-10-22): en i Intervju och en till i Ny, två i
     Utbildning (en med konto på adressen), en under 18 i Utbildning utan
     vårdnadshavarens godkännande, en med konto och en avböjd. */
  if (o.steg) {
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
        vardnadshavare_epost: null, vardnadshavare_godkand_at: null, vardnadshavare_svar: null },
      { id: 'ans-ung-utb', name: 'Unga Utb', email: 'unga@example.se', age: 16, status: 'new',
        created_at: '2026-09-25T10:00:00Z', till_intervju_at: '2026-10-05T10:00:00Z', intervju_at: '2026-10-06T10:00:00Z',
        tjanster: ['laxhjalp'], why: 'Hej', vardnadshavare_epost: 'pappa@example.se', vardnadshavare_godkand_at: null,
        vardnadshavare_svar: null },
      { id: 'ans-konto', name: 'Kim Konto', email: 'kim@example.se', age: 23, status: 'approved',
        created_at: '2026-09-19T10:00:00Z', till_intervju_at: '2026-09-25T10:00:00Z', intervju_at: '2026-09-27T10:00:00Z',
        utbildad_at: '2026-09-30T10:00:00Z', tjanster: ['laxhjalp'], why: 'Hej',
        vardnadshavare_epost: null, vardnadshavare_godkand_at: null, vardnadshavare_svar: null },
      { id: 'ans-nej', name: 'Nils Nej', email: 'nils@example.se', age: 30, status: 'rejected',
        created_at: '2026-09-18T10:00:00Z', tjanster: ['laxhjalp'], why: 'Hej',
        vardnadshavare_epost: null, vardnadshavare_godkand_at: null, vardnadshavare_svar: null });
  }
  if (o.utanKolumner) {
    w.applications.forEach(a => {
      delete a.vardnadshavare_epost; delete a.vardnadshavare_godkand_at; delete a.vardnadshavare_svar;
    });
    w.ansokan_utskick.forEach(u => { delete u.skicka_efter; });
  }
  /* Kolumnerna: select=* ger nyckeln på varje rad när den finns, null eller
     inte. Steget räknar den falska databasen som den riktiga
     (intern.ansokan_steg), och utan migrationen ansokningarnas_steg finns
     varken steg eller konto_id. */
  w.applications.forEach(a => {
    if (!('till_intervju_at' in a)) a.till_intervju_at = null;
    if (!o.utanStegKolumn) { a.konto_id = a.konto_id || null; a.steg = stegFör(a); }
  });
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
    /* ansokningarnas_steg (2026-10-22): samma svar som databasen ger. */
    ansokan_intervjulank_igen: k => {
      const a = W.applications.find(x => x.id === k.p_ansokan);
      return a && stegFör(a) === 'intervju' && a.status !== 'rejected'
        ? { ok: true } : { ok: false, fel: 'Länken skickas bara medan hen står i Intervju.' };
    },
    ansokan_utbildning_hallen: k => {
      const a = W.applications.find(x => x.id === k.p_ansokan);
      const p = W.profiles.find(x => x.id === k.p_konto);
      if (!a || !p) return { ok: false, fel: 'Ansökan eller kontot finns inte.' };
      if (a.konto_id === k.p_konto) return { ok: true, redan: true, konto: k.p_konto };
      if (stegFör(a) !== 'utbildning') return { ok: false, fel: 'Hen står inte i Utbildning.' };
      if (String(p.email).toLowerCase() !== String(a.email).toLowerCase()) return { ok: false, fel: 'Kontot har en annan adress.' };
      Object.assign(a, { konto_id: k.p_konto, utbildad_at: a.utbildad_at || new Date().toISOString(), status: 'approved' });
      a.steg = stegFör(a);
      const tp = W.tutor_profiles.find(x => x.id === k.p_konto);
      if (tp) Object.assign(tp, { status: 'approved', hourly_rate: k.p_timpenning });
      return { ok: true, redan: false, konto: k.p_konto };
    },
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
    /* bjud-in (2026-10-22): skapar studiehjälparkontot, som den riktiga, och
       säger 409 om adressen redan har ett. */
    if (p === '/functions/v1/bjud-in') {
      const epost = String(kropp && kropp.epost || '').toLowerCase();
      if (W.profiles.some(x => String(x.email).toLowerCase() === epost)) return svar(route, 409, { error: 'Adressen har redan ett konto.' });
      const id = 'ny-' + epost.split('@')[0];
      W.profiles.push({ id, role: 'tutor', full_name: kropp.namn || '', email: epost, is_admin: false, created_at: nu(0) });
      W.tutor_profiles.push({ id, status: 'pending', created_at: nu(0) });
      return svar(route, 200, { ok: true, id });
    }
    if (p.startsWith('/functions/v1/')) return svar(route, 404, {});
    if (p.startsWith('/storage/v1/')) return svar(route, 200, { Key: 'cv/x' });
    if (p.startsWith('/rest/v1/rpc/')) {
      const namn = p.slice('/rest/v1/rpc/'.length);
      if (namn === 'admin_sett_markera' && o.utanSett) return svar(route, 404, { code: 'PGRST202', message: 'saknas' });
      const f = RPC[namn];
      if (!f || (o.utanStegKolumn && /^ansokan_(intervjulank_igen|utbildning_hallen)$/.test(namn))) {
        return svar(route, 404, { code: 'PGRST202', message: 'Could not find the function public.' + namn });
      }
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
        if (tabell === 'applications' && !o.utanStegKolumn) träff.forEach(r => { r.steg = stegFör(r); });
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
const öppnaAdmin = async (page, hash) => {
  await page.goto(BAS + '/admin#' + (hash || 'ansokningar'));
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
  await vänta(800);
};

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
    await öppnaAdmin(page);
    prova('admin utan admin_sett: läget Ny räknas som förut', (await märke(page, 'ansokningar')) === '1'
      && (await märke(page, 'leads')) === '2', (await märke(page, 'ansokningar')) + ' / ' + (await märke(page, 'leads')));
    prova('admin utan admin_sett: ingen markering skickas',
      !S.logg.some(r => r.väg === '/rest/v1/rpc/admin_sett_markera'));
    prova('admin utan admin_sett: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }

  /* 3. Under 18: vårdnadshavaren och godkännandet. */
  {
    const { context, page, S, konsol } = await öppna(webb, { inloggad: true });
    await öppnaAdmin(page);
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
    prova('admin under 18: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }

  /* 4. Nejet: rutan visar mejlet, Avbryt ändrar inget, Avböj sparar. */
  {
    const { context, page, S, konsol } = await öppna(webb, { inloggad: true });
    await öppnaAdmin(page);
    await page.click('[data-dp="ansokan:ans-gammal"]');
    await vänta(400);
    await bild(page, 'admin-ansokan-lage', '.dp');
    await page.click('[data-ans-nej="ans-gammal"]');
    await page.waitForSelector('.nx-fraga-prov', { timeout: 3000 }).catch(() => {});
    const prov = await text(page, '.nx-fraga-prov');
    prova('admin: Avböj visar mejlet först', prov.includes('Ämne: Om din ansökan till Nextrum') && prov.includes('Hej Kalle,')
      && prov.includes('Vi har valt att gå vidare med andra sökande den här gången.'), prov);
    prova('admin: och när det går', /får mejlet nedan (i dag|i morgon) kl\. \d\d:\d\d/.test(await text(page, '.nx-fraga-box p')),
      await text(page, '.nx-fraga-box p'));
    await bild(page, 'admin-avbojd-ruta', '.nx-fraga-box');
    await page.click('[data-svar="nej"]');
    await vänta(200);
    prova('admin: Avbryt sparar inget', !S.logg.some(r => r.metod === 'PATCH' && r.kropp && r.kropp.status === 'rejected')
      && (await page.locator('[data-ans-nej="ans-gammal"]').count()) === 1);

    await page.click('[data-ans-nej="ans-gammal"]');
    await page.waitForSelector('.nx-fraga-prov', { timeout: 3000 }).catch(() => {});
    S.W.ansokan_utskick.push({ id: 'u3', ansokan_id: 'ans-gammal', steg: 'avbojd', nyckel: 'avbojd', status: 'vantar',
      forsok: 0, fel: null, skapad: nu(0), uppdaterad: nu(0), skicka_efter: nu(30) });
    await page.click('[data-svar="ja"]');
    await vänta(500);
    prova('admin: Avböj och mejla sparar läget och inget annat', S.logg.some(r => r.metod === 'PATCH' && r.kropp
      && JSON.stringify(r.kropp) === '{"status":"rejected"}'));
    prova('admin: och hämtar beskeden om', S.logg.some(r => r.metod === 'GET' && r.väg === '/rest/v1/ansokan_utskick'
      && r.sök.includes('ans-gammal')));
    const mejlen = await text(page, '.ans-mejlen');
    prova('admin: Mejlen till hen säger när nejet går', /Nejet:.*går (i dag|i morgon) kl\./.test(mejlen), mejlen);
    prova('admin: panelen säger Avböjd och har Ta tillbaka nejet', (await text(page, '.ans-nu b')) === 'Avböjd'
      && (await page.locator('[data-ans-ja="ans-gammal"]').count()) === 1, await text(page, '.ans-nu'));
    await page.click('[data-dp-stang]').catch(() => {});
    await vänta(300);
    await page.click('#flik-ans-avbojda');
    await vänta(200);
    prova('admin: hen står under Avböjda, med antalet på fliken',
      (await page.locator('#ans-avbojda [data-dp="ansokan:ans-gammal"]').count()) === 1
      && (await text(page, '#flik-ans-avbojda-mark')) === '1', await text(page, '#flik-ans-avbojda-mark'));
    prova('admin nejet: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }

  /* 5. Utan migrationen ansokan_vardnadshavare_och_nej: ingen ruta om ett
        mejl som aldrig går, inga rader för vårdnadshavaren. */
  {
    const { context, page, S, konsol } = await öppna(webb, { inloggad: true, utanKolumner: true });
    await öppnaAdmin(page);
    await page.click('[data-dp="ansokan:ans-ung"]');
    await vänta(400);
    const panel = await page.locator('.dp-fakta').first().innerText().catch(() => '');
    prova('admin utan migrationen: inga rader om vårdnadshavaren', !panel.includes('Vårdnadshavare'), panel);
    await page.click('[data-ans-nej="ans-ung"]');
    await vänta(300);
    prova('admin utan migrationen: ingen ruta som lovar ett mejl', (await page.locator('.nx-fraga-prov').count()) === 0);
    prova('admin utan migrationen: läget sparas', S.logg.some(r => r.metod === 'PATCH' && r.kropp && r.kropp.status === 'rejected'));
    prova('admin utan migrationen: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
}

/* ============ ansökningarnas steg (2026-10-22) ============
   Leo: "Lägen: Ny, Intervju, Utbildning, Konto skapat. ... Vyn 'Alla
   ansökningar' visar bara de som ligger i Ny." Flikarna med antal, de tre
   knapparna i Intervju, Ångra, Gå vidare till utbildning och Utbildning
   hållen, som skapar kontot med bjud-in och kopplar det i databasen. */
async function provaStegen(webb) {
  const { context, page, S, riktiga, konsol, dialoger } = await öppna(webb, { inloggad: true, steg: true,
    medIntervjumejl: true, bokning: 'https://calendar.app.google/provet123' });
  await öppnaAdmin(page);
  const patchar = () => S.logg.filter(r => r.metod === 'PATCH' && r.väg === '/rest/v1/applications');
  const rpc = namn => S.logg.filter(r => r.metod === 'POST' && r.väg === '/rest/v1/rpc/' + namn);
  const flik = async f => { await page.click('#flik-ans-' + f); await vänta(200); };
  const listan = async sel => page.locator(sel + ' [data-dp]').evaluateAll(l => l.map(x => x.dataset.dp).sort());
  const tal = async () => {
    const m = async f => (await text(page, '#flik-ans-' + f + '-mark')) || '0';
    return [await m('alla'), await m('intervju'), await m('utbildning'), await m('konto'), await m('avbojda')].join(' ');
  };
  const ansökan = id => S.W.applications.find(a => a.id === id);

  /* Flikarna och Nya ansökningar. */
  prova('steg: flikarna har antal per steg', (await tal()) === '3 1 3 1 1', await tal());
  prova('steg: Nya ansökningar visar bara de som står i Ny', (await listan('#ans-tabell')).join()
    === 'ansokan:ans-boka,ansokan:ans-gammal,ansokan:ans-ung', (await listan('#ans-tabell')).join());
  prova('steg: varje ny har Till intervju', (await page.locator('#ans-tabell [data-ans-vidare^="intervju:"]').count()) === 3);
  prova('steg: inget filter på läget längre', (await page.locator('#ans-status').count()) === 0);
  await bild(page, 'steg-nya', '#panel-ans-alla');

  /* Panelen för en ny: steget först, en knapp. Inget Boka digitalt möte,
     ingen flik Rekryteringen. */
  await page.click('#ans-tabell [data-dp="ansokan:ans-boka"]');
  await vänta(400);
  prova('steg: panelen börjar med steget och en tydlig nästa åtgärd', (await text(page, '.ans-nu b')) === 'Ny'
    && (await page.locator('.ans-nu [data-ans-vidare="intervju:ans-boka"].btn-primary').count()) === 1,
    await text(page, '.ans-nu'));
  prova('steg: ingen flik Rekryteringen och inget Boka möte', (await page.locator('[data-dp-flik="rekrytering"]').count()) === 0
    && (await page.locator('[data-ans-mote]').count()) === 0 && !(await page.locator('.dp').innerText()).includes('Boka digitalt möte'));
  await bild(page, 'steg-panel-ny', '.dp');

  /* Till intervju visar mejlet och sparar bara steget. */
  await page.click('.ans-nu [data-ans-vidare="intervju:ans-boka"]');
  await page.waitForSelector('.nx-fraga-prov', { timeout: 3000 }).catch(() => {});
  prova('steg: Till intervju visar intervjumejlet först', (await text(page, '.nx-fraga-prov')).includes('Ämne: Du går vidare till intervju'),
    await text(page, '.nx-fraga-prov'));
  await page.click('[data-svar="ja"]');
  await vänta(500);
  const tillIntervju = patchar().pop();
  prova('steg: Till intervju sparar steget och inget annat', tillIntervju && tillIntervju.sök.includes('ans-boka')
    && Object.keys(tillIntervju.kropp || {}).join() === 'till_intervju_at', JSON.stringify(tillIntervju));
  prova('steg: flikarna räknar om', (await tal()) === '2 2 3 1 1', await tal());

  /* Intervju: status plus tre knappar. */
  prova('steg: Intervju har tre knappar och inget annat', (await text(page, '.ans-nu b')) === 'Intervju'
    && (await page.locator('.ans-nu .ans-nu-knappar .btn').count()) === 3
    && (await page.locator('.ans-nu [data-ans-igen="ans-boka"]').count()) === 1
    && (await page.locator('.ans-nu [data-ans-angra="ans-boka"]').count()) === 1
    && (await page.locator('.ans-nu [data-ans-vidare="utbildning:ans-boka"]').count()) === 1,
    await text(page, '.ans-nu'));
  await bild(page, 'steg-panel-intervju', '.dp');

  /* Skicka intervjulänk igen: frågan visar mejlet, databasen köar det. */
  await page.click('[data-ans-igen="ans-boka"]');
  await page.waitForSelector('.nx-fraga-prov', { timeout: 3000 }).catch(() => {});
  prova('steg: Skicka intervjulänk igen visar mejlet med länken', (await text(page, '.nx-fraga-prov'))
    .includes('https://calendar.app.google/rRiTTLP5ymKQunSv7'), await text(page, '.nx-fraga-prov'));
  await page.click('[data-svar="nej"]');
  await vänta(200);
  prova('steg: Avbryt köar inget', rpc('ansokan_intervjulank_igen').length === 0);
  await page.click('[data-ans-igen="ans-boka"]');
  await page.waitForSelector('.nx-fraga-prov', { timeout: 3000 }).catch(() => {});
  await page.click('[data-svar="ja"]');
  await vänta(500);
  const igen = rpc('ansokan_intervjulank_igen').pop();
  prova('steg: Skicka länken anropar databasen med bara ansökan', igen && JSON.stringify(igen.kropp) === '{"p_ansokan":"ans-boka"}',
    JSON.stringify(igen && igen.kropp));
  prova('steg: panelen säger att länken mejlats igen', (await text(page, '.ans-nu span')).includes('mejlad igen'), await text(page, '.ans-nu'));

  /* Ångra intervju: frågar, och sätter bara tillbaka steget. */
  const föreÅngra = patchar().length;
  await page.click('[data-ans-angra="ans-boka"]');
  await page.waitForSelector('.nx-fraga-box', { timeout: 3000 }).catch(() => {});
  prova('steg: Ångra intervju frågar först', (await text(page, '.nx-fraga-box h3')).startsWith('Ångra intervjun'),
    await text(page, '.nx-fraga-box h3'));
  await page.click('[data-svar="nej"]');
  await vänta(200);
  prova('steg: Avbryt ångrar inget', patchar().length === föreÅngra);
  await page.click('[data-ans-angra="ans-boka"]');
  await page.waitForSelector('.nx-fraga-box', { timeout: 3000 }).catch(() => {});
  await page.click('[data-svar="ja"]');
  await vänta(500);
  const ångra = patchar().pop();
  prova('steg: Ångra nollar steget och inget annat', ångra && JSON.stringify(ångra.kropp) === '{"till_intervju_at":null}',
    JSON.stringify(ångra && ångra.kropp));
  prova('steg: hen står i Ny igen', (await text(page, '.ans-nu b')) === 'Ny' && (await tal()) === '3 1 3 1 1', await tal());

  /* Gå vidare till utbildning, från Intervju-fliken. */
  await page.click('[data-dp-stang]').catch(() => {});
  await vänta(200);
  await flik('intervju');
  prova('steg: Intervju har den som skickats dit, med Till utbildning', (await listan('#ans-intervju')).join() === 'ansokan:ans-intervju'
    && (await page.locator('#ans-intervju [data-ans-vidare="utbildning:ans-intervju"]').count()) === 1, (await listan('#ans-intervju')).join());
  await bild(page, 'steg-intervju', '#panel-ans-intervju');
  await page.click('#ans-intervju [data-ans-vidare="utbildning:ans-intervju"]');
  await page.waitForSelector('.nx-fraga-box', { timeout: 3000 }).catch(() => {});
  prova('steg: Till utbildning frågar och säger att ett mejl går', (await text(page, '.nx-fraga-box')).includes('mejl'),
    await text(page, '.nx-fraga-box'));
  await page.click('[data-svar="ja"]');
  await vänta(500);
  const tillUtb = patchar().pop();
  prova('steg: Till utbildning sätter intervju_at och inget annat', tillUtb && tillUtb.sök.includes('ans-intervju')
    && Object.keys(tillUtb.kropp || {}).join() === 'intervju_at', JSON.stringify(tillUtb));
  prova('steg: hen står i Utbildning', (await tal()) === '3 0 4 1 1', await tal());

  /* Utbildning hållen: kontot skapas med bjud-in och kopplas i databasen. */
  await flik('utbildning');
  prova('steg: varje rad i Utbildning har Utbildning hållen',
    (await page.locator('#ans-utbildning [data-ans-hallen]').count()) === 4, await page.locator('#ans-utbildning [data-ans-hallen]').count());
  await bild(page, 'steg-utbildning', '#panel-ans-utbildning');
  await page.click('#ans-utbildning [data-ans-hallen="ans-intervju"]');
  await page.waitForSelector('#uh-ok', { timeout: 3000 }).catch(() => {});
  prova('steg: Utbildning hållen säger att kontot skapas med adressen', (await text(page, '.nx-fraga-box')).includes('ivar@example.se')
    && (await text(page, '#uh-ok')) === 'Skapa kontot och skicka inbjudan', await text(page, '.nx-fraga-box'));
  await bild(page, 'steg-hallen-ruta', '.nx-fraga-box');
  await page.click('#uh-ok');
  await vänta(300);
  prova('steg: utan timpenning sparas inget', (await text(page, '#uh-msg')).includes('timpenningen')
    && rpc('ansokan_utbildning_hallen').length === 0, await text(page, '#uh-msg'));
  await page.fill('#uh-timpenning', '180');
  await page.click('#uh-ok');
  await vänta(900);
  const bjud = S.logg.filter(r => r.väg === '/functions/v1/bjud-in').pop();
  const hallen = rpc('ansokan_utbildning_hallen').pop();
  prova('steg: bjud-in skapar studiehjälparkontot med adressen i ansökan', bjud && bjud.kropp.epost === 'ivar@example.se'
    && bjud.kropp.roll === 'tutor', JSON.stringify(bjud && bjud.kropp));
  prova('steg: databasen kopplar det nya kontot med timpenningen', hallen && hallen.kropp.p_ansokan === 'ans-intervju'
    && hallen.kropp.p_konto === 'ny-ivar' && hallen.kropp.p_timpenning === 180, JSON.stringify(hallen && hallen.kropp));
  prova('steg: rutan säger att hen fått sitt konto', (await text(page, '.nx-fraga-box h3')).includes('har fått sitt konto'),
    await text(page, '.nx-fraga-box'));
  await page.click('[data-uh-stang]');
  await vänta(300);
  prova('steg: hen står under Konto skapat', (await tal()) === '3 0 3 2 1' && ansökan('ans-intervju').konto_id === 'ny-ivar', await tal());

  /* Ett konto som redan finns med adressen kopplas, utan bjud-in. */
  const bjudFöre = S.logg.filter(r => r.väg === '/functions/v1/bjud-in').length;
  await page.click('#ans-utbildning [data-ans-hallen="ans-utb"]');
  await page.waitForSelector('#uh-ok', { timeout: 3000 }).catch(() => {});
  prova('steg: med ett konto på adressen kopplas det', (await text(page, '#uh-ok')) === 'Koppla kontot och godkänn',
    await text(page, '#uh-ok'));
  await page.fill('#uh-timpenning', '170');
  await page.click('#uh-ok');
  await vänta(800);
  prova('steg: inget nytt konto skapas', S.logg.filter(r => r.väg === '/functions/v1/bjud-in').length === bjudFöre);
  prova('steg: databasen kopplar kontot som fanns', rpc('ansokan_utbildning_hallen').pop().kropp.p_konto === 'sh-ulla');
  await page.click('[data-uh-stang]');
  await vänta(300);

  /* Under 18 utan godkännande: frågan först. */
  await page.click('#ans-utbildning [data-ans-hallen="ans-ung-utb"]');
  await vänta(300);
  prova('steg: Utbildning hållen frågar om vårdnadshavarens godkännande', (await text(page, '.nx-fraga-box h3'))
    === 'Vårdnadshavarens godkännande saknas', await text(page, '.nx-fraga-box h3'));
  await page.click('[data-svar="nej"]');
  await vänta(200);

  /* Konto skapat: panelen säger det och har inga knappar för stegen. */
  await flik('konto');
  await page.click('#ans-konto [data-dp="ansokan:ans-intervju"]');
  await vänta(400);
  prova('steg: Konto skapat har inga knappar för stegen', (await text(page, '.ans-nu b')) === 'Konto skapat'
    && (await page.locator('.ans-nu [data-ans-vidare], .ans-nu [data-ans-hallen], .ans-nu [data-ans-igen]').count()) === 0,
    await text(page, '.ans-nu'));
  await bild(page, 'steg-panel-konto', '.dp');

  prova('steg: inga rutor från webbläsaren', dialoger.length === 0, dialoger.join(' | '));
  prova('steg: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('steg: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
  await context.close();

  /* Utan bokningssidan går ingen länk att skicka igen, och inget köas. */
  {
    const { context, page, S, konsol, dialoger } = await öppna(webb, { inloggad: true, steg: true, bokning: '' });
    await öppnaAdmin(page);
    await page.click('#flik-ans-intervju');
    await vänta(200);
    await page.click('#ans-intervju [data-dp="ansokan:ans-intervju"]');
    await vänta(400);
    await page.click('[data-ans-igen="ans-intervju"]');
    await vänta(400);
    prova('steg utan bokningssida: tydligt fel och inget köas', dialoger.some(d => d.includes('INTERVJU_BOKNING_URL'))
      && !S.logg.some(r => r.väg === '/rest/v1/rpc/ansokan_intervjulank_igen'), dialoger.join(' | '));
    prova('steg utan bokningssida: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }

  /* Telefonen: knappen under namnet, minst 44 px, inget utanför rutan,
     och panelens tre knappar ryms. */
  {
    const { context, page, konsol } = await öppna(webb, { inloggad: true, steg: true,
      context: { viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true } });
    await öppnaAdmin(page);
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

    await page.click('#flik-ans-intervju');
    await vänta(200);
    await page.click('#ans-intervju [data-dp="ansokan:ans-intervju"]');
    await vänta(500);
    const panel = await page.evaluate(() => [...document.querySelectorAll('.ans-nu .btn')].map(k => {
      k.scrollIntoView({ block: 'center' });
      const kr = k.getBoundingClientRect();
      const mitt = document.elementFromPoint(kr.left + kr.width / 2, kr.top + kr.height / 2);
      return { h: Math.round(kr.height), vänster: kr.left, höger: kr.right, bredd: innerWidth,
        sida: document.documentElement.scrollWidth, träff: !!mitt && mitt.closest('.btn') === k };
    }));
    prova('steg telefon: panelens tre knappar är minst 44 px, träffbara och inom rutan', panel.length === 3
      && panel.every(p => p.h >= 44 && p.träff && p.vänster >= 0 && p.höger <= p.bredd && p.sida <= p.bredd),
      JSON.stringify(panel));
    await bild(page, 'steg-telefon-panel', '.dp');
    prova('steg telefon: inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
  }
}

/* ============ Skriv till hen (2026-10-20, flyttad 2026-10-22) ============
   Skicka i rutan anropar ansokan-mejl med ansökan, det redigerade ämnet
   och texten och en nyckel för rutan, aldrig en adress. Knappen står vid
   adressen i ansökan, inte i stegen, och flyttar ingen: att vi skrivit
   står på ansökan (kontaktad_at) och inget annat. */
async function provaSkickaHarifran(webb) {
  for (const går of [true, false]) {
    const namn = går ? 'skicka' : 'skicka utan funktionen';
    const { context, page, S, riktiga, konsol } = await öppna(webb, { inloggad: true, steg: true, mejl: går });
    await öppnaAdmin(page);
    await page.evaluate(() => { window.open = u => { window.öppnadGmail = String(u); return null; }; });
    const patchar = () => S.logg.filter(r => r.metod === 'PATCH' && r.väg === '/rest/v1/applications');
    const anrop = () => S.logg.filter(r => r.väg === '/functions/v1/ansokan-mejl' && r.metod === 'POST');

    await page.click('#ans-tabell [data-dp="ansokan:ans-boka"]');
    await vänta(400);
    prova(namn + ': Skriv till hen står vid adressen', (await page.locator('.dp-fakta [data-ans-kontakt="ans-boka"]').count()) === 1);
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
    await page.fill('#kt-amne', 'Om din ansökan');
    await page.locator('#kt-text').evaluate(el => { el.value = el.value + '\n\nPS. Hör av dig om något är oklart.'; });
    await page.click('#kt-skicka');
    await vänta(700);
    const a = anrop().pop();
    prova(namn + ': Skicka anropar ansokan-mejl med ansökan, ämnet och den redigerade texten',
      a && a.kropp && a.kropp.ansokan === 'ans-boka' && a.kropp.amne === 'Om din ansökan'
      && a.kropp.text.includes('PS. Hör av dig')
      && /^[a-z0-9-]{8,64}$/i.test(a.kropp.forsok || '') && !('till' in a.kropp),
      JSON.stringify(a && a.kropp).slice(0, 300));
    prova(namn + ': Gmail öppnas inte', !(await page.evaluate(() => window.öppnadGmail)));
    if (går) {
      prova(namn + ': rutan stängs', (await page.locator('#kt-skicka').count()) === 0);
      const st = patchar().pop();
      prova(namn + ': bara att vi skrivit sparas, och ingen flyttas', patchar().length === före + 1
        && st && Object.keys(st.kropp).join() === 'kontaktad_at' && (await text(page, '.ans-nu b')) === 'Ny',
        JSON.stringify(st && st.kropp));
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

/* ============ Intervjumejlet (2026-10-21) ============
   Skicka till intervju köar ett mejl, så frågan visar det först, ord för
   ord; Avbryt sparar inget, och ett mejl som redan gått sägs. */
async function provaIntervjumejlet(webb) {
  const { context, page, S, konsol } = await öppna(webb, { inloggad: true, steg: true, medIntervjumejl: true });
  await öppnaAdmin(page);
  const patchar = () => S.logg.filter(r => r.metod === 'PATCH' && r.väg === '/rest/v1/applications');

  await page.click('#ans-tabell [data-dp="ansokan:ans-ung"]');
  await vänta(400);
  await page.click('.ans-nu [data-ans-vidare="intervju:ans-ung"]');
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

  await page.click('.ans-nu [data-ans-vidare="intervju:ans-ung"]');
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

/* ============ före migrationen ansokningarnas_steg ============
   Utan kolumnerna steg och konto_id räknar vyn steget själv, med samma
   regel, och Utbildning hållen säger att migrationen saknas. */
async function provaStegenUtanKolumnen(webb) {
  const { context, page, S, riktiga, konsol } = await öppna(webb, { inloggad: true, steg: true, utanStegKolumn: true });
  await öppnaAdmin(page);
  const tal = async () => {
    const m = async f => (await text(page, '#flik-ans-' + f + '-mark')) || '0';
    return [await m('alla'), await m('intervju'), await m('utbildning'), await m('konto'), await m('avbojda')].join(' ');
  };
  prova('steg utan kolumnen: flikarna räknar med samma regel', (await tal()) === '3 1 3 1 1', await tal());
  await page.click('#flik-ans-utbildning');
  await vänta(200);
  await page.click('#ans-utbildning [data-ans-hallen="ans-utb"]');
  await page.waitForSelector('#uh-ok', { timeout: 3000 }).catch(() => {});
  await page.fill('#uh-timpenning', '180');
  await page.click('#uh-ok');
  await vänta(800);
  prova('steg utan kolumnen: Utbildning hållen säger att migrationen saknas',
    (await text(page, '#uh-msg')).includes('ansokningarnas_steg'), await text(page, '#uh-msg'));
  prova('steg utan kolumnen: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova('steg utan kolumnen: inga fel i konsolen', konsol.filter(k => !/PGRST202|404/.test(k)).length === 0, konsol.join(' | '));
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
    await provaSkickaHarifran(webb);
    await provaIntervjumejlet(webb);
    await provaStegenUtanKolumnen(webb);
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
