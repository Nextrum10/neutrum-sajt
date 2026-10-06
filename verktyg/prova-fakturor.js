/* ============================================================
   NEXTRUM — webbläsarprov för familjens faktura (2026-10-06)

       NODE_PATH="$(npm root -g)" node verktyg/prova-fakturor.js [mapp för bilder]

   Byggt som verktyg/prova-ansokningar.js och körs likadant: Playwright
   och Chromium, inte i CI. ALDRIG MOT DRIFTEN: nextrum-config.js byts i
   farten mot en som pekar på https://supabase.test, varje anrop dit
   besvaras här av en falsk Supabase, och ett anrop till den riktiga
   adressen stoppas och fäller provet. Klockan står på 6 oktober 2026.

   Provet ser det Leo bad om: en rad per familj och månad under
   Betalningar → Fakturor, där oktobers pass samlas och septembers
   utkast tar det sena passet, att familjens namn fäller ut passen med
   dag, klocka och studiehjälpare, att Skapa nu gör körningen utan ett
   eget torrkörningssteg men visar vad som skapas först, och att
   familjens panel säger med vem passen hölls. Körningen själv provas i
   supabase/functions/_delad/pris_test.ts.
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
const PORT = 8964;
const BAS = 'http://localhost:' + PORT;
const FALSK = 'https://supabase.test';
const RIKTIG = /ddkfiuvcppalutfulvbi\.supabase\.co/;
const BILDER = process.argv[2] || null;
const LAGRING = 'sb-supabase-auth-token';
const NU = new Date('2026-10-06T10:00:00+02:00');

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

/* ============ världen ============ */
function pass(id, o) {
  return Object.assign({ id, parent_id: 'fam-1', tutor_id: 'sh-1', student_id: 'barn-1', subject: 'Matematik',
    tjanst: 'laxhjalp', format: 'hemma', wanted_time: '16:00:00', duration_min: 60, status: 'completed',
    attendance: 'narvarande', created_at: '2026-09-01T10:00:00Z', betalning_status: 'faktura', fakturerbar: true,
    antal_barn: 1, rabatt_ore: 0, timpris_ore: 37900, extra_ore: 6900, startrabatt: false }, o);
}
function underlag(b, o) {
  return Object.assign({ id: b.id, wanted_date: b.wanted_date, parent_id: b.parent_id, tutor_id: b.tutor_id,
    student_id: b.student_id, har_rapport: true, fakturerbar: true, pa_underlag: false, debiterade_min: 60,
    timbank_min: 0, lon_min: 60, timpris_ore: 37900, extra_ore: 6900, rabatt_ore: 0, status: b.status }, o);
}

function värld() {
  const bokningar = [
    /* Anna: två pass på septembers utkast, ett sent septemberpass som natten
       ska lägga på det, ett oktoberpass som samlas och ett utan rapport. */
    pass('b1', { wanted_date: '2026-09-10' }),
    pass('b2', { wanted_date: '2026-09-17', tutor_id: 'sh-2', subject: 'Engelska' }),
    pass('b3', { wanted_date: '2026-09-30', wanted_time: '17:00:00' }),
    pass('b4', { wanted_date: '2026-10-01' }),
    pass('b5', { wanted_date: '2026-10-05', tutor_id: 'sh-2' }),
    pass('b6', { wanted_date: '2026-10-08', status: 'confirmed' }),
    /* Per: septembers faktura är skickad. */
    pass('b7', { wanted_date: '2026-09-15', parent_id: 'fam-2', student_id: 'barn-2', tutor_id: 'sh-2' }),
    /* Karin: ett septemberpass utan faktura, som natten ska göra ett utkast av. */
    pass('b8', { wanted_date: '2026-09-25', parent_id: 'fam-3', student_id: 'barn-3' })
  ];
  const pu = bokningar.filter(b => b.status === 'completed').map(b => underlag(b, b.id === 'b5' ? { har_rapport: false } : {}));
  return {
    profiles: [
      { id: 'admin-1', role: 'parent', full_name: 'Leo Admin', email: 'leo@example.se', is_admin: true,
        match_status: 'pending', created_at: '2026-09-01T10:00:00Z' },
      { id: 'fam-1', role: 'parent', full_name: 'Anna Andersson', email: 'anna@example.se', phone: '070-123 45 67',
        is_admin: false, match_status: 'matched', matched_tutor_id: 'sh-1', created_at: '2026-09-01T10:00:00Z' },
      { id: 'fam-2', role: 'parent', full_name: 'Per Persson', email: 'per@example.se', is_admin: false,
        match_status: 'matched', matched_tutor_id: 'sh-2', created_at: '2026-09-01T10:00:00Z' },
      { id: 'fam-3', role: 'parent', full_name: 'Karin Karlsson', email: 'karin@example.se', is_admin: false,
        match_status: 'matched', matched_tutor_id: 'sh-1', created_at: '2026-09-01T10:00:00Z' },
      { id: 'sh-1', role: 'tutor', full_name: 'Sara Svensson', email: 'sara@example.se', is_admin: false,
        created_at: '2026-09-01T10:00:00Z' },
      { id: 'sh-2', role: 'tutor', full_name: 'Tove Lind', email: 'tove@example.se', is_admin: false,
        created_at: '2026-09-01T10:00:00Z' }
    ],
    tutor_profiles: [
      { id: 'sh-1', status: 'approved', created_at: '2026-09-01T10:00:00Z' },
      { id: 'sh-2', status: 'approved', created_at: '2026-09-01T10:00:00Z' }
    ],
    students: [
      { id: 'barn-1', parent_id: 'fam-1', name: 'Alva', grade: 'Åk 6', matched_tutor_id: 'sh-1', match_status: 'matched',
        created_at: '2026-09-01T10:00:00Z' },
      { id: 'barn-2', parent_id: 'fam-2', name: 'Pelle', grade: 'Åk 8', matched_tutor_id: 'sh-2', match_status: 'matched',
        created_at: '2026-09-01T10:00:00Z' },
      { id: 'barn-3', parent_id: 'fam-3', name: 'Kim', grade: 'Åk 4', matched_tutor_id: 'sh-1', match_status: 'matched',
        created_at: '2026-09-01T10:00:00Z' }
    ],
    bookings: bokningar,
    passunderlag: pu,
    invoices: [
      { id: 'f-sep', parent_id: 'fam-1', period: '2026-09-01', status: 'utkast', belopp_ore: 75800,
        created_at: '2026-10-01T02:17:00Z', fortnox_fakturanummer: null, ocr: null, forfaller: null,
        invoice_lines: [
          { id: 'l1', booking_id: 'b1', beskrivning: 'Matematik 10 september', minuter: 60, pris_per_timme_ore: 37900, belopp_ore: 37900 },
          { id: 'l2', booking_id: 'b2', beskrivning: 'Engelska 17 september', minuter: 60, pris_per_timme_ore: 37900, belopp_ore: 37900 }
        ] },
      { id: 'f-per', parent_id: 'fam-2', period: '2026-09-01', status: 'skickad', belopp_ore: 37900,
        created_at: '2026-10-01T02:17:00Z', skickad_at: '2026-10-02T09:00:00Z', fortnox_fakturanummer: '1001',
        ocr: null, forfaller: '2026-10-20',
        invoice_lines: [
          { id: 'l3', booking_id: 'b7', beskrivning: 'Matematik 15 september', minuter: 60, pris_per_timme_ore: 37900, belopp_ore: 37900 }
        ] }
    ],
    payouts: [],
    flaggor: [{ kod: 'faktura', aktiv: true, vantar_pa: '' }],
    tjanster: [{ kod: 'laxhjalp', namn: 'Läxhjälp', aktiv: true, for_jobb: true, for_kund: true, ordning: 1,
      pris_per_timme_ore: 37900, extra_personer_ore: 6900 }]
  };
}

function falskSupabase(o) {
  const W = värld();
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
    manadskorning_lage: () => o.utanSchema ? { pa: false } : { pa: true, adress: true, schema: '17 4 * * *' }
  };

  /* fakturering: torrkörningen svarar med vad natten skulle göra, den
     skarpa lägger det sena passet på septembers utkast och gör Karins. */
  function fakturering(kropp) {
    const torr = !!(kropp && kropp.torrkorning);
    const svarData = {
      period: '2026-09-01', pass_till_och_med: '2026-09-30',
      fakturor: [
        { parent_id: 'fam-1', pass: 1, belopp_ore: 37900, period: '2026-09-01', tillagg: true },
        { parent_id: 'fam-3', pass: 1, belopp_ore: 37900, period: '2026-09-01', tillagg: false }
      ],
      utbetalningar: [{ tutor_id: 'sh-1', pass: 2, belopp_ore: 24000, period: '2026-09-01', tillagg: false }],
      obetalda: [], hoppade_over_utan_rapport: [], hoppade_over_utan_timpenning: [], undantagna_pass: 0, problem: []
    };
    if (torr) return svarData;
    const f = W.invoices.find(x => x.id === 'f-sep');
    if (!f.invoice_lines.some(l => l.booking_id === 'b3')) {
      f.invoice_lines.push({ id: 'l4', booking_id: 'b3', beskrivning: 'Matematik 30 september', minuter: 60,
        pris_per_timme_ore: 37900, belopp_ore: 37900 });
      f.belopp_ore += 37900;
      W.invoices.push({ id: 'f-karin', parent_id: 'fam-3', period: '2026-09-01', status: 'utkast', belopp_ore: 37900,
        created_at: NU.toISOString(), fortnox_fakturanummer: null, ocr: null, forfaller: null,
        invoice_lines: [{ id: 'l5', booking_id: 'b8', beskrivning: 'Matematik 25 september', minuter: 60,
          pris_per_timme_ore: 37900, belopp_ore: 37900 }] });
    }
    return Object.assign(svarData, { skapade: { utbetalningar: 1, fakturor: 1 }, tillagda: { utbetalningar: 0, fakturor: 1 } });
  }

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
    if (p === '/functions/v1/fakturering') return svar(route, 200, fakturering(kropp));
    if (p.startsWith('/functions/v1/')) return svar(route, 404, {});
    if (p.startsWith('/storage/v1/')) return svar(route, 200, {});
    if (p.startsWith('/rest/v1/rpc/')) {
      const namn = p.slice('/rest/v1/rpc/'.length);
      const f = RPC[namn];
      if (!f) return svar(route, 404, { code: 'PGRST202', message: 'Could not find the function public.' + namn });
      return svar(route, 200, f(kropp || {}));
    }
    if (p.startsWith('/rest/v1/')) {
      const tabell = p.slice('/rest/v1/'.length);
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
      if (metod === 'POST') return svar(route, 201, []);
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
  await context.addInitScript(([nyckel, värde]) => {
    try { localStorage.setItem(nyckel, värde); } catch (e) { /* ingen lagring */ }
  }, [LAGRING, JSON.stringify(S.session())]);
  const page = await context.newPage();
  await page.clock.setFixedTime(NU);
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) konsol.push(m.text()); });
  page.on('pageerror', e => konsol.push('pageerror: ' + e.message));
  page.on('dialog', d => { dialoger.push(d.message()); d.dismiss(); });
  return { context, page, S, riktiga, konsol, dialoger };
}

async function bild(page, namn, sel) {
  if (!BILDER) return;
  fs.mkdirSync(BILDER, { recursive: true });
  if (sel) await page.locator(sel).first().screenshot({ path: path.join(BILDER, namn + '.png') }).catch(() => {});
  else await page.screenshot({ path: path.join(BILDER, namn + '.png'), fullPage: false });
}

const text = (page, sel) => page.locator(sel).first().innerText().catch(() => '');
/* Gruppens kort: rubriken, kanske en text, och kortet med raderna. */
const rad = (page, grupp, familj) => page.locator('#' + grupp)
  .locator('xpath=following-sibling::div[contains(@class,"vy-kort")][1]')
  .locator('.fakt-fam', { hasText: familj }).first();

async function provaFakturor(webb, o) {
  const namn = o.namn;
  const { context, page, S, riktiga, konsol, dialoger } = await öppna(webb, o);
  await page.goto(BAS + '/admin#ekonomi/fakturor');
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
  await page.waitForSelector('#fakt-lista .fakt-fam', { timeout: 10000 }).catch(() => {});
  await vänta(600);

  const steg = await text(page, '#fakt-steg');
  prova(namn + ': flödet har Samlas och inget Att skapa', /Samlas/.test(steg) && !/Att skapa/.test(steg), steg);
  const stegTal = await page.$$eval('#fakt-steg li b', l => l.map(b => b.textContent));
  prova(namn + ': ett samlas, två att lägga in, en hos familjen, inga betalda', stegTal.join(',') === '1,2,1,0', stegTal.join(','));

  /* Oktober: Annas faktura samlas, med passet utan rapport utanför summan. */
  const okt = rad(page, 'fakt-samlas', 'Anna Andersson');
  const oktText = await okt.innerText().catch(() => '');
  prova(namn + ': oktober är en rad för Anna, och den samlas', /Samlas/.test(oktText) && /okt/i.test(oktText), oktText);
  prova(namn + ': oktobers summa är passet med rapport, 379 kr', /379 kr/.test(oktText) && /hittills/.test(oktText), oktText);
  prova(namn + ': passet utan rapport står på raden', /1 pass utan rapport/.test(oktText), oktText);
  prova(namn + ': oktober har ingen knapp att köra något', (await okt.locator('.eko-atg button').count()) === 0);

  /* September: utkastet och det sena passet på EN rad. */
  const sep = rad(page, 'fakt-utkast', 'Anna Andersson');
  const sepText = await sep.innerText().catch(() => '');
  prova(namn + ': september är en rad, med det sena passet i summan', /1\s?137 kr/.test(sepText), sepText);
  prova(namn + ': och den säger vad som kommer till',
    o.utanSchema ? /varav 379 kr inte på än/.test(sepText) : /varav 379 kr i natt/.test(sepText), sepText);
  prova(namn + ': Annas familj har bara två rader', (await page.locator('#fakt-lista .fakt-fam', { hasText: 'Anna Andersson' }).count()) === 2);

  const karin = rad(page, 'fakt-utkast', 'Karin Karlsson');
  const karinText = await karin.innerText().catch(() => '');
  prova(namn + ': Karins september utan utkast',
    o.utanSchema ? /Ingen faktura än/.test(karinText) : /Blir utkast i natt/.test(karinText), karinText);
  prova(namn + ': och har Skapa nu', (await karin.locator('[data-fakt-skapa]').count()) === 1);

  const per = rad(page, 'fakt-ute', 'Per Persson');
  prova(namn + ': Pers skickade faktura står hos familjen', /nr 1001/.test(await per.innerText().catch(() => '')));

  /* Körningen för hand är hopfälld. */
  prova(namn + ': körningen för hand är hopfälld', !(await page.locator('#kor-torr').isVisible()));
  prova(namn + ': schemats rad syns', /Går av sig själv|Månadskörningen går bara/.test(await text(page, '#kor-schema')),
    await text(page, '#kor-schema'));
  await bild(page, (o.utanSchema ? 'utan-schema-' : '') + 'fakturor', '#panel-fakturor');

  /* Trycker man på familjen fälls passen ut. */
  await sep.locator('[data-fakt-visa]').click();
  await vänta(200);
  const ut = sep.locator('details.fakt-fam-pass');
  prova(namn + ': familjens namn fäller ut passen', await ut.evaluate(d => d.open).catch(() => false));
  prova(namn + ': och knappen säger det', (await sep.locator('[data-fakt-visa]').getAttribute('aria-expanded')) === 'true');
  const passText = await ut.innerText().catch(() => '');
  prova(namn + ': passen säger med vem', /Med Sara Svensson/.test(passText) && /Med Tove Lind/.test(passText), passText);
  prova(namn + ': och när', /tor kl\. 16:00/.test(passText) && /ons kl\. 17:00/.test(passText), passText);
  prova(namn + ': och ämnet och barnet', /Engelska/.test(passText) && /Alva/.test(passText), passText);
  prova(namn + ': familjens e-post och telefon', /anna@example\.se/.test(passText) && /070-123 45 67/.test(passText), passText);
  prova(namn + ': det sena passet är märkt',
    o.utanSchema ? /Inte på fakturan än/.test(passText) : /Läggs på i natt/.test(passText), passText);
  prova(namn + ': passen i datumordning', passText.indexOf('Sara') < passText.indexOf('Tove'), passText);
  await bild(page, (o.utanSchema ? 'utan-schema-' : '') + 'fakturor-utfalld', '#fakt-lista');

  if (o.utanSchema) {
    prova(namn + ': inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
    prova(namn + ': inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
    await context.close();
    return;
  }

  /* Skapa nu: torrkörningen i bakgrunden, rutan visar vad, sedan skarpt. */
  await sep.locator('[data-fakt-skapa]').click();
  await page.waitForSelector('.nx-fraga-prov', { timeout: 5000 }).catch(() => {});
  const fråga = await text(page, '.nx-fraga');
  const torr = S.logg.filter(r => r.väg === '/functions/v1/fakturering');
  prova(namn + ': Skapa nu torrkör först, för förra månaden', torr.length === 1 && torr[0].kropp.torrkorning === true
    && torr[0].kropp.period === '2026-09', JSON.stringify(torr.map(r => r.kropp)));
  prova(namn + ': rutan visar fakturorna och underlagen', /Anna Andersson · 1 pass · 379 kr/.test(fråga)
    && /Karin Karlsson/.test(fråga) && /Sara Svensson · 2 pass/.test(fråga), fråga);
  prova(namn + ': rutan säger att natten gör samma sak', /gör körningen i natt av sig själv/.test(fråga), fråga);
  await bild(page, 'skapa-nu-fragan', '.nx-fraga');
  await page.click('.nx-fraga [data-svar="ja"]');
  await page.waitForFunction(() => {
    const p = document.querySelector('#panel-fakturor [data-fakt-svar]');
    return p && !p.hidden;
  }, null, { timeout: 5000 }).catch(() => {});
  await vänta(400);
  const skarp = S.logg.filter(r => r.väg === '/functions/v1/fakturering');
  prova(namn + ': och sedan skarpt, samma månad', skarp.length === 2 && !skarp[1].kropp.torrkorning
    && skarp[1].kropp.period === '2026-09', JSON.stringify(skarp.map(r => r.kropp)));
  prova(namn + ': svaret står ovanför listan', /Klart: en ny faktura och pass tillagda på ett utkast/.test(
    await text(page, '#panel-fakturor [data-fakt-svar]')), await text(page, '#panel-fakturor [data-fakt-svar]'));
  const sep2 = rad(page, 'fakt-utkast', 'Anna Andersson');
  const sep2Text = await sep2.innerText().catch(() => '');
  prova(namn + ': septembers utkast har passet nu, utan Lägg till nu', /1\s?137 kr/.test(sep2Text)
    && (await sep2.locator('[data-fakt-skapa]').count()) === 0 && !/varav/.test(sep2Text), sep2Text);
  prova(namn + ': och står kvar utfällt', await sep2.locator('details.fakt-fam-pass').evaluate(d => d.open).catch(() => false));
  prova(namn + ': Karins utkast finns', /Utkast/.test(await rad(page, 'fakt-utkast', 'Karin Karlsson').innerText().catch(() => '')));

  /* Panelen: med vem, och fakturorna med passen. */
  await sep2.locator('[data-dp="familj:fam-1"]').click();
  await page.waitForSelector('.dp:not([hidden])', { timeout: 5000 }).catch(() => {});
  await vänta(300);
  const översikt = await text(page, '.dp');
  prova(namn + ': panelen visar de senaste passen med vem', /Senaste passen/.test(översikt) && /med Tove Lind/.test(översikt), översikt);
  await page.click('.dp [data-dp-flik="pass"]');
  await vänta(200);
  const passFlik = await text(page, '.dp');
  prova(namn + ': Pass säger med vem', /med Sara Svensson/.test(passFlik), passFlik);
  await page.click('.dp [data-dp-flik="ekonomi"]');
  await vänta(200);
  const ekonomi = await text(page, '.dp');
  prova(namn + ': Ekonomi har oktober som samlas och september med passen',
    /Oktober 2026/.test(ekonomi) && /Samlas/.test(ekonomi) && /September 2026/.test(ekonomi)
    && /med Sara Svensson · Matematik · Alva · 379 kr/.test(ekonomi), ekonomi);
  await bild(page, 'panelen-ekonomi', '.dp');
  await page.keyboard.press('Escape');

  /* Månadens ekonomi: samma rader för oktober, körningen hopfälld. */
  await page.goto(BAS + '/admin#manaden');
  await page.waitForSelector('#man-fakt-lista .fakt-fam', { timeout: 10000 }).catch(() => {});
  await vänta(400);
  const man = await text(page, '#man-fakt-lista');
  prova(namn + ': Månadens ekonomi visar oktobers faktura som samlas', /Anna Andersson/.test(man) && /Samlas/.test(man), man);
  prova(namn + ': och torrkörningen är hopfälld', !(await page.locator('#man-korning [data-kor-torr]').isVisible()));
  await bild(page, 'manaden-fakturor', '#man-fakt-lista');

  /* En telefon: inget skjuts ut i sidled. */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BAS + '/admin#ekonomi/fakturor');
  await page.waitForSelector('#fakt-lista .fakt-fam', { timeout: 10000 }).catch(() => {});
  await vänta(400);
  await page.locator('#fakt-lista [data-fakt-visa]').first().click();
  await vänta(200);
  const bredd = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  prova(namn + ': på en telefon går inget utanför i sidled', bredd <= 0, bredd + ' px');
  await bild(page, 'telefon-fakturor', '#fakt-lista');

  prova(namn + ': inga oväntade rutor', dialoger.length === 0, dialoger.join(' | '));
  prova(namn + ': inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  prova(namn + ': inga fel i konsolen', konsol.length === 0, konsol.join(' | '));
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
    await provaFakturor(webb, { namn: 'fakturor' });
    await provaFakturor(webb, { namn: 'utan schemat', utanSchema: true });
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
