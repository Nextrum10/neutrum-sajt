/* ============================================================
   NEXTRUM — webbläsarprov för barnens förslag på pass
   (barnet_foreslar_pass, 2026-10-12)

       NODE_PATH="$(npm root -g)" node verktyg/prova-barnforslag.js [mapp för bilder]

   Kräver Playwright och Chromium (finns i molnsessionerna, installeras
   annars globalt). Körs inte i CI: ingen pakethanterare i repot.

   ALDRIG MOT DRIFTEN. Sidorna serveras av .claude/serve.py, och
   nextrum-config.js byts i farten mot en som pekar på
   https://supabase.test, en adress som inte finns. Varje anrop dit
   besvaras här, av en falsk Supabase med en påhittad familj. Ett anrop
   till den riktiga Supabase-adressen stoppas och fäller provet.

   Leo: "barn skickar förslag, precis som förälder, men ser inte priset.
   förälder får förslaget och kan ändra i förslaget, samt ser pris och
   kan ange rabattkod om det finns. sedan godkänner föräldern förslaget
   och det går vidare till studiehjälparen". Provet ser det en människa
   ser i barnets vy och i studievyn; reglerna i databasen provas i
   verktyg/rls-test.sql (avsnitt 26), inte här.
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
const BILDER = process.argv[2] || null;
const LAGRING = 'sb-supabase-auth-token';

/* ============ utfallet ============ */
const utfall = [];
function prova(namn, ok, detalj) {
  utfall.push({ namn, ok: !!ok, detalj: ok ? '' : String(detalj == null ? '' : detalj) });
}

/* ============ den falska Supabase ============ */
const idag = new Date();
const dagar = n => { const d = new Date(idag); d.setDate(d.getDate() + n); return iso(d); };
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const nu = n => new Date(Date.now() + n * 60000).toISOString();
const vänta = ms => new Promise(r => setTimeout(r, ms));

function jwt(sub, roll) {
  const b = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  return b({ alg: 'HS256', typ: 'JWT' }) + '.' + b({ sub, role: roll, exp: 4102444800 }) + '.provet';
}

const ANVANDARE = {
  'foralder-1': { id: 'foralder-1', aud: 'authenticated', role: 'authenticated', email: 'anna@example.se',
                  app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-09-01T10:00:00Z' },
  'barnkonto-1': { id: 'barnkonto-1', aud: 'authenticated', role: 'nextrum_barn', email: 'alva.a@barn.nextrum.se',
                   app_metadata: { provider: 'email', roll: 'barn', barn_id: 'barn-1', forald_id: 'foralder-1' },
                   user_metadata: {}, created_at: '2026-09-01T10:00:00Z' }
};

const ELAK = '<img src=x data-elak=1>';
/* Förslagens id är uuid: adressen #boka/forslag-<id> kräver det. */
const F1 = '11111111-1111-4111-8111-111111111111';
const F2 = '22222222-2222-4222-8222-222222222222';
const F3 = '33333333-3333-4333-8333-333333333333';

/* En vardag minst fem dagar fram, med tider kvar (11–22). */
function framåt(n) { return dagar(n); }

function värld() {
  return {
    profiles: [
      { id: 'foralder-1', role: 'parent', full_name: 'Anna Andersson', email: 'anna@example.se', is_admin: false,
        match_status: 'matched', matched_tutor_id: 'handledare-1', created_at: '2026-09-01T10:00:00Z' },
      { id: 'handledare-1', role: 'tutor', full_name: 'Sara Svensson', email: 'sara@example.se', is_admin: false,
        created_at: '2026-09-01T10:00:00Z' }
    ],
    students: [
      { id: 'barn-1', parent_id: 'foralder-1', name: 'Alva', grade: 'Åk 6', subjects: ['Matematik'],
        matched_tutor_id: 'handledare-1', match_status: 'matched', created_at: '2026-09-01T10:00:00Z' },
      { id: 'barn-2', parent_id: 'foralder-1', name: 'Bo', grade: 'Åk 3', subjects: ['Svenska'],
        matched_tutor_id: 'handledare-1', match_status: 'matched', created_at: '2026-09-02T10:00:00Z' }
    ],
    tutor_profiles: [
      { id: 'handledare-1', status: 'approved', subjects: ['Matematik'], grade_levels: ['Åk 6'], formats: [],
        hourly_rate: 150, age: 19, school: 'Testskolan', city: 'Stockholm' }
    ],
    tutor_busy_slots: [
      /* Kl. 18 dagen för F1 är tagen hos studiehjälparen. */
      { tutor_id: 'handledare-1', wanted_date: framåt(5), wanted_time: '18:00' }
    ],
    bookings: [],
    barn_passforslag: [
      { id: F1, barn_id: 'barn-1', parent_id: 'foralder-1', tutor_id: 'handledare-1', datum: framåt(5), tid: '16:00',
        langd_min: 60, amne: 'Matematik', format: 'Online', plats: null, rad: ELAK + 'Provet på fredag',
        lage: 'vantar', skapad: nu(-90) },
      { id: F2, barn_id: 'barn-2', parent_id: 'foralder-1', tutor_id: 'handledare-1', datum: framåt(8), tid: '17:00',
        langd_min: 120, amne: 'Engelska', format: 'På plats', plats: 'Stadsbiblioteket', rad: null,
        lage: 'vantar', skapad: nu(-30) },
      { id: F3, barn_id: 'barn-1', parent_id: 'foralder-1', tutor_id: 'handledare-1', datum: dagar(-2), tid: '15:00',
        langd_min: 60, amne: 'Svenska', format: 'Online', plats: null, rad: null,
        lage: 'vantar', skapad: nu(-6000) }
    ]
  };
}

function falskSupabase(o) {
  const W = värld();
  if (o.värld) o.värld(W);
  const logg = [];
  const inloggad = { id: o.inloggad || null };

  const svar = (route, status, kropp, extra) => route.fulfill({
    status,
    headers: Object.assign({
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': '*',
      'access-control-expose-headers': 'content-range, x-total-count'
    }, extra || {}),
    body: kropp === undefined ? '' : JSON.stringify(kropp)
  });

  function session(id) {
    return { access_token: jwt(id, ANVANDARE[id].role), refresh_token: 'prov-' + id, token_type: 'bearer',
             expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: ANVANDARE[id] };
  }

  function filtrera(rader, sök) {
    let ut = rader.slice();
    for (const [k, v] of sök.entries()) {
      if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
      const m = /^eq\.(.*)$/.exec(v);
      if (m) ut = ut.filter(r => String(r[k]) === m[1]);
      const i = /^in\.\((.*)\)$/.exec(v);
      if (i) { const lista = i[1].split(',').map(x => x.replace(/^"|"$/g, '')); ut = ut.filter(r => lista.includes(String(r[k]))); }
      if (v === 'is.null') ut = ut.filter(r => r[k] == null);
    }
    return ut;
  }

  const RPC = Object.assign({
    mina_behorigheter: () => ({ admin: false, superadmin: false, behorigheter: [] })
  }, o.rpc || {});

  async function hantera(route) {
    const req = route.request();
    const url = new URL(req.url());
    const metod = req.method();
    if (metod === 'OPTIONS') return svar(route, 204);
    let kropp = null;
    try { kropp = req.postDataJSON(); } catch (e) { kropp = req.postData(); }
    logg.push({ metod, väg: url.pathname, sök: url.search, kropp });

    const p = url.pathname;
    if (p === '/auth/v1/token') {
      if (inloggad.id) return svar(route, 200, session(inloggad.id));
      return svar(route, 400, { error: 'invalid_grant' });
    }
    if (p === '/auth/v1/user') {
      if (!inloggad.id) return svar(route, 401, { message: 'no user' });
      return svar(route, 200, ANVANDARE[inloggad.id]);
    }
    if (p === '/auth/v1/logout') { inloggad.id = null; return svar(route, 204); }
    if (p.startsWith('/auth/v1/')) return svar(route, 200, {});
    if (p.startsWith('/functions/v1/')) return svar(route, 404, { error: 'Ingen sådan funktion i provet.' });

    if (p.startsWith('/rest/v1/rpc/')) {
      const namn = p.slice('/rest/v1/rpc/'.length);
      const f = RPC[namn];
      if (!f) {
        return svar(route, 404, { code: 'PGRST202', message: 'Could not find the function public.' + namn + ' in the schema cache' });
      }
      const data = f(kropp || {}, W);
      if (data && data.__fel) return svar(route, 400, data.__fel);
      return svar(route, 200, data === undefined ? null : data);
    }

    if (p.startsWith('/rest/v1/')) {
      const tabell = p.slice('/rest/v1/'.length);
      if ((o.utanTabell || []).includes(tabell)) {
        return svar(route, 404, { code: 'PGRST205', message: "Could not find the table 'public." + tabell + "' in the schema cache" });
      }
      if (metod === 'GET' || metod === 'HEAD') {
        const rader = filtrera(W[tabell] || [], url.searchParams);
        const vill = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
        const cr = rader.length ? '0-' + (rader.length - 1) + '/' + rader.length : '*/0';
        if (vill) return rader.length ? svar(route, 200, rader[0], { 'content-range': cr })
          : svar(route, 406, { code: 'PGRST116', message: 'no rows' });
        return svar(route, 200, rader, { 'content-range': cr });
      }
      if (metod === 'PATCH') {
        const ut = filtrera(W[tabell] || [], url.searchParams);
        ut.forEach(r => Object.assign(r, kropp || {}));
        return svar(route, 204);
      }
      /* Familjens eget förslag: raden som databasen skapade, med det
         triggrarna gjort av den (o.bokat), som PostgREST svarar. */
      if (metod === 'POST' && tabell === 'bookings') {
        const rad = Object.assign({ id: 'pass-eget', status: 'requested', klippkort_id: null, betalning_status: null,
                                    rabattkod: null, startrabatt: false }, kropp || {});
        const ut = o.bokat ? o.bokat(rad) : rad;
        W.bookings.push(ut);
        const vill = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
        return svar(route, 201, vill ? ut : [ut]);
      }
      return svar(route, 201, []);
    }
    return svar(route, 404, {});
  }

  return { W, logg, inloggad, hantera, session };
}

/* ============ en sida med den falska Supabase ============ */
async function öppna(webb, o) {
  const context = await webb.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, o.context || {}));
  const S = falskSupabase(o);
  const riktiga = [];
  const konsol = [];

  await context.route(RIKTIG, route => { riktiga.push(route.request().url()); return route.abort(); });
  await context.route(/nextrum-config\.js/, async route => {
    const text = fs.readFileSync(path.join(ROT, 'nextrum-config.js'), 'utf8')
      .replace(/SUPABASE_URL:\s*'[^']*'/, "SUPABASE_URL: '" + FALSK + "'");
    return route.fulfill({ status: 200, contentType: 'application/javascript', body: text });
  });
  await context.route(/^https:\/\/supabase\.test\//, S.hantera);
  await context.routeWebSocket(/supabase\.test/, () => { /* Realtime svarar aldrig; det gör ingenting här */ });
  await context.route(url => !String(url).startsWith(BAS) && !/supabase\.test/.test(String(url)),
    route => route.abort());

  if (o.inloggad) {
    const sess = S.session(o.inloggad);
    await context.addInitScript(([nyckel, värde]) => {
      try { localStorage.setItem(nyckel, värde); } catch (e) { /* ingen lagring */ }
    }, [LAGRING, JSON.stringify(sess)]);
    /* Rutan med det som väntar (NXStudie.notisruta, 2026-10-12) visas en
       gång per flik och konto. Här är den redan visad, utom där provet
       tittar på den (o.notisruta). */
    if (!o.notisruta) {
      await context.addInitScript(id => {
        try { sessionStorage.setItem('nx-notisruta', id); } catch (e) { /* ingen lagring */ }
      }, o.inloggad);
    }
  }

  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') konsol.push(m.text()); });
  page.on('pageerror', e => konsol.push('pageerror: ' + e.message));
  page.on('dialog', d => d.dismiss());
  return { context, page, S, riktiga, konsol };
}

async function bild(page, namn, sel) {
  if (!BILDER) return;
  fs.mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: path.join(BILDER, namn + '.png'), fullPage: true });
  if (sel) await page.locator(sel).first().screenshot({ path: path.join(BILDER, namn + '-del.png') }).catch(() => {});
}

const synlig = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const text = (page, sel) => page.locator(sel).first().textContent().catch(() => '');
/* Konsolens fel utom nätverksfelen för det provet själv stoppar: bilder
   och typsnitt utanför localhost, och 404 för funktioner som inte finns. */
const egnaFel = konsol => konsol.filter(t => !/Failed to load resource|ERR_FAILED|net::/.test(t));

/* ============ barnets vy ============ */
const BARNETS_FUNKTIONER = /\/rpc\/(barn_(oversikt|notiser|markera_last|nexlax|uppgift|installningar|notisval|chatt|chatt_last|chatt_skriv|passforslag|foresla_pass|upptagna_tider|aterkalla_forslag)|nexlax_lage|niva_(starta|svara|genomgang))$/;

function barnRpc(o) {
  const egna = o.egna || [
    { id: 'eget-1', datum: framåt(3), tid: '15:00', langd_min: 60, amne: ELAK + 'Fysik', format: 'Online',
      lage: 'skickat', skapad: nu(-3000), besvarad: nu(-2000),
      pass: { status: 'requested', datum: framåt(3), tid: '16:00', langd_min: 60 } },
    { id: 'eget-2', datum: framåt(4), tid: '12:00', langd_min: 60, amne: 'Kemi', format: 'Online',
      lage: 'nej', skapad: nu(-4000), besvarad: nu(-3500), pass: null }
  ];
  const anrop = [];
  const rpc = {
    barn_oversikt: () => ({
      lage: 'ok', fornamn: 'Alva', studiehjalpare: 'Sara',
      antal: { genomforda: 3, kommande: 1 },
      kommande: [{ datum: framåt(2), tid: '16:00', langd_min: 120, status: 'confirmed', amne: 'Matematik' }],
      genomforda: [{ datum: dagar(-4), tid: '16:00', langd_min: 120, amne: 'Matematik' }],
      timmar: { genomforda: 3, bokade: 2 },
      studieplan: null, visa_rapporter: false, rapporter: null,
      behorigheter: o.behorigheter || ['pass', 'boka', 'studieplan', 'nexlax', 'meddelanden', 'chatt']
    }),
    barn_notiser: () => [],
    barn_chatt: () => ({ lage: 'ok', studiehjalpare: 'Sara', kan_skriva: true, olasta: 0, meddelanden: [] }),
    barn_passforslag: () => {
      anrop.push(['barn_passforslag']);
      if (o.lista) return o.lista;
      return { lage: 'ok', studiehjalpare: 'Sara', kan_foresla: o.kanFöreslå !== false, far_se_passen: true,
               forslag: egna.slice() };
    },
    barn_upptagna_tider: k => {
      anrop.push(['barn_upptagna_tider', k]);
      return [{ datum: framåt(6), tid: '16:00' }];
    },
    barn_foresla_pass: k => {
      anrop.push(['barn_foresla_pass', k]);
      if (o.foreslå) return o.foreslå(k);
      const id = '44444444-4444-4444-8444-44444444444' + egna.length;
      egna.unshift({ id, datum: k.p_datum, tid: k.p_tid, langd_min: k.p_langd, amne: k.p_amne, format: k.p_format,
                     lage: 'vantar', skapad: nu(0), besvarad: null, pass: null });
      return { lage: 'ok', id };
    },
    barn_aterkalla_forslag: k => {
      anrop.push(['barn_aterkalla_forslag', k]);
      const f = egna.find(x => x.id === k.p_id);
      if (f) { f.lage = 'aterkallat'; f.besvarad = nu(0); }
      return { lage: 'ok' };
    }
  };
  if (o.utanFunktionerna) {
    delete rpc.barn_passforslag; delete rpc.barn_upptagna_tider;
    delete rpc.barn_foresla_pass; delete rpc.barn_aterkalla_forslag;
  }
  return { rpc, anrop, egna };
}

/* Dagen i kalendern och en tid den dagen, i ytan host. */
async function väljDagOchTid(page, host, datum, tid) {
  await page.click(host + ' .mv-dag[data-datum="' + datum + '"]');
  await page.waitForSelector(host + ' .mv-tid', { timeout: 3000 }).catch(() => {});
  if (tid) await page.click(host + ' .mv-tid[data-tid="' + tid + '"]');
}

/* Kalendern visar en månad i taget. Står dagen i nästa månad trycks
   pilen fram. */
async function tillMånaden(page, host, datum) {
  for (let i = 0; i < 3; i++) {
    if (await page.locator(host + ' .mv-dag[data-datum="' + datum + '"]').count()) return;
    await page.click(host + ' #bk-nasta');
    await vänta(50);
  }
}

async function provaBarnetsVy(webb) {
  /* 1. Föräldern har slagit på det: menyposten, ytan utan pris, ett
        förslag som skickas och ett som tas tillbaka. */
  {
    const B = barnRpc({});
    const { context, page, S, riktiga, konsol } = await öppna(webb, { rpc: B.rpc, inloggad: 'barnkonto-1' });
    await page.goto(BAS + '/barn');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
    await page.waitForFunction(() => {
      const a = document.querySelector('#vy-sido a[data-sek="boka"]');
      return a && !a.hidden;
    }, null, { timeout: 5000 }).catch(() => {});
    prova('barnet: menyposten Boka pass syns när föräldern slagit på det', await synlig(page, '#vy-sido a[data-sek="boka"]'));
    await page.click('#vy-sido a[data-sek="boka"]');
    await page.waitForSelector('#bv-boka-ruta:not([hidden]) .mv-dag', { timeout: 5000 }).catch(() => {});
    prova('barnet: ytan står i Boka pass', await synlig(page, '#bv-boka-ruta'));
    prova('barnet: rubriken säger hos vem', (await text(page, '#bv-boka-hos')) === 'hos Sara', await text(page, '#bv-boka-hos'));
    const hämta = B.anrop.find(a => a[0] === 'barn_upptagna_tider');
    prova('barnet: de upptagna timmarna hämtas med barnets funktion', hämta && hämta[1].p_fran && hämta[1].p_till,
      JSON.stringify(hämta));

    /* De egna förslagen: ett som gick vidare med en annan tid, och ett som inte skickades. */
    const egna = await text(page, '#bv-forslag');
    prova('barnet: Dina förslag visar vad föräldern gjort',
      egna.includes('Väntar på Sara') && egna.includes('Din förälder ändrade tiden') && egna.includes('Inte skickat'), egna);
    prova('barnet: text ur databasen ritas som text', (await page.locator('#bv-forslag img[data-elak]').count()) === 0
      && egna.includes('<img src=x data-elak=1>Fysik'));

    /* En tid. Kl. 16 dagen efter F1 är upptagen. */
    const host = '#bv-boka-yta';
    await tillMånaden(page, host, framåt(6));
    await page.click(host + ' .mv-dag[data-datum="' + framåt(6) + '"]');
    await page.waitForSelector(host + ' .mv-tid', { timeout: 3000 }).catch(() => {});
    prova('barnet: en upptagen timme går inte att välja',
      (await page.locator(host + ' .mv-tid[data-tid="16:00"]').count()) === 0
      && (await page.locator(host + ' .mv-tid[data-tid="15:00"]').count()) === 0
      && (await page.locator(host + ' .mv-tid[data-tid="17:00"]').count()) === 1);
    await page.click(host + ' .mv-tid[data-tid="17:00"]');
    await page.click(host + ' #bk-format button[data-v="Online"]').catch(() => {});
    await page.fill(host + ' #bk-not', 'Bråk inför provet');
    const yta = await text(page, '#bv-boka-ruta');
    prova('barnet: inget pris i ytan', !/\d\s*kr\b|kronor|pris/i.test(yta), yta.match(/.{0,40}(kr|pris).{0,40}/i));
    prova('barnet: inget val av antal barn', (await page.locator(host + ' #bk-barn').count()) === 0);
    prova('barnet: där priset hade stått står vem som ser förslaget först',
      (await text(page, host + ' .bk-sum-pris')).includes('Din förälder'), await text(page, host + ' .bk-sum-pris'));
    prova('barnet: ingen mening om ångerrätten, men att förslaget går till föräldern',
      !/ångerfrist/i.test(yta) && /går först till din förälder/.test(yta));
    prova('barnet: knappen säger Skicka till din förälder', (await text(page, host + ' #bk-boka')).trim() === 'Skicka till din förälder');
    await bild(page, 'barnet-boka', '#bv-boka-ruta');

    await page.click(host + ' #bk-boka');
    await page.waitForSelector(host + ' .bk-kvitto', { timeout: 5000 }).catch(() => {});
    const skickat = B.anrop.find(a => a[0] === 'barn_foresla_pass');
    /* Längden och ämnet ärvs från förra passet (två timmar matte). */
    prova('barnet: förslaget skickas med barn_foresla_pass', skickat && skickat[1].p_datum === framåt(6)
      && skickat[1].p_tid === '17:00' && skickat[1].p_langd === 120 && skickat[1].p_amne === 'Matematik' && skickat[1].p_format === 'Online'
      && skickat[1].p_rad === 'Bråk inför provet' && skickat[1].p_plats === null && typeof skickat[1].p_amne === 'string',
      JSON.stringify(skickat && skickat[1]));
    prova('barnet: kvittot säger att förslaget gick till föräldern',
      (await text(page, host + ' .bk-kvitto')).includes('skickat till din förälder'), await text(page, host + ' .bk-kvitto'));
    await page.waitForFunction(() => /Väntar på din förälder/.test(document.querySelector('#bv-forslag').textContent),
      null, { timeout: 5000 }).catch(() => {});
    prova('barnet: förslaget står överst i Dina förslag och väntar på föräldern',
      (await text(page, '#bv-forslag .vy-rad')).includes('Väntar på din förälder'));
    prova('barnet: inget går till en tabell', !S.logg.some(r => r.väg.startsWith('/rest/v1/') && !BARNETS_FUNKTIONER.test(r.väg)),
      S.logg.filter(r => r.väg.startsWith('/rest/v1/') && !BARNETS_FUNKTIONER.test(r.väg)).map(r => r.väg).join(', '));

    /* Ta tillbaka. */
    await page.click('#bv-forslag [data-bv-tillbaka]');
    await page.waitForFunction(() => /Tillbakataget/.test(document.querySelector('#bv-forslag').textContent),
      null, { timeout: 5000 }).catch(() => {});
    const tillbaka = B.anrop.find(a => a[0] === 'barn_aterkalla_forslag');
    prova('barnet: Ta tillbaka anropar barn_aterkalla_forslag med förslaget',
      tillbaka && /^44444444-/.test(tillbaka[1].p_id), JSON.stringify(tillbaka && tillbaka[1]));
    prova('barnet: förslaget står som Tillbakataget, utan knapp',
      (await text(page, '#bv-forslag .vy-rad')).includes('Tillbakataget')
      && (await page.locator('#bv-forslag [data-bv-tillbaka]').count()) === 0);
    prova('barnet: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
    prova('barnet: inga fel i konsolen', egnaFel(konsol).length === 0, egnaFel(konsol).join(' | '));
    await context.close();
  }

  /* 2. Databasens nej står i ytan. */
  {
    const B = barnRpc({ foreslå: () => ({ lage: 'tak' }) });
    const { context, page } = await öppna(webb, { rpc: B.rpc, inloggad: 'barnkonto-1' });
    await page.goto(BAS + '/barn#boka');
    await page.waitForSelector('#bv-boka-ruta:not([hidden]) .mv-dag', { timeout: 8000 }).catch(() => {});
    const host = '#bv-boka-yta';
    await tillMånaden(page, host, framåt(6));
    await väljDagOchTid(page, host, framåt(6), '19:00');
    await page.click(host + ' #bk-format button[data-v="Online"]').catch(() => {});
    await page.click(host + ' #bk-boka');
    await page.waitForFunction(() => /redan skickat många/.test(document.querySelector('#bk-msg') ? document.querySelector('#bk-msg').textContent : ''),
      null, { timeout: 5000 }).catch(() => {});
    prova('barnet: taket på väntande förslag säger vad barnet kan göra',
      (await text(page, host + ' #bk-msg')).includes('Vänta tills din förälder svarat'), await text(page, host + ' #bk-msg'));
    await context.close();
  }

  /* 3. Föräldern har inte slagit på det: ingen menypost, och adressen
        #boka säger varför. Förslagen hämtas inte. */
  {
    const B = barnRpc({ behorigheter: ['pass', 'studieplan', 'nexlax', 'meddelanden', 'chatt'] });
    const { context, page } = await öppna(webb, { rpc: B.rpc, inloggad: 'barnkonto-1' });
    await page.goto(BAS + '/barn#boka');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
    await vänta(400);
    prova('barnet utan boka: ingen menypost', !(await synlig(page, '#vy-sido a[data-sek="boka"]')));
    prova('barnet utan boka: sektionen säger att föräldern valt bort det',
      (await text(page, '#bv-boka-av')).includes('Din förälder har valt att du inte föreslår pass här')
      && !(await synlig(page, '#bv-boka-ruta')), await text(page, '#bv-boka-av'));
    prova('barnet utan boka: förslagen hämtas inte', !B.anrop.some(a => a[0] === 'barn_passforslag'));
    prova('barnet utan boka: översikten säger inget om att föreslå',
      !/Föreslå en tid/.test(await page.locator('section[data-sek="oversikt"]').innerText().catch(() => '')));
    await context.close();
  }

  /* 4. Föräldern stängde av det efter att vyn laddats: databasen svarar avstangd. */
  {
    const B = barnRpc({ lista: { lage: 'avstangd' } });
    const { context, page } = await öppna(webb, { rpc: B.rpc, inloggad: 'barnkonto-1' });
    await page.goto(BAS + '/barn#boka');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
    await page.waitForFunction(() => !document.querySelector('#bv-boka-av').hidden, null, { timeout: 5000 }).catch(() => {});
    prova('barnet avstängt i databasen: samma besked, ingen yta',
      (await text(page, '#bv-boka-av')).includes('Din förälder har valt') && !(await synlig(page, '#bv-boka-ruta')));
    await context.close();
  }

  /* 5. Utan studiehjälpare. */
  {
    const B = barnRpc({ kanFöreslå: false, egna: [] });
    const { context, page } = await öppna(webb, { rpc: B.rpc, inloggad: 'barnkonto-1' });
    await page.goto(BAS + '/barn#boka');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
    await page.waitForFunction(() => !document.querySelector('#bv-boka-av').hidden, null, { timeout: 5000 }).catch(() => {});
    prova('barnet utan studiehjälpare: säger när det går',
      (await text(page, '#bv-boka-av')).includes('När du har en studiehjälpare') && !(await synlig(page, '#bv-boka-ruta'))
      && !(await synlig(page, '#bv-forslag-ruta')));
    await context.close();
  }

  /* 6. Listan säger boka men funktionerna saknas: ett lugnt besked. */
  {
    const B = barnRpc({ utanFunktionerna: true });
    const { context, page, konsol } = await öppna(webb, { rpc: B.rpc, inloggad: 'barnkonto-1' });
    await page.goto(BAS + '/barn#boka');
    await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
    await page.waitForFunction(() => !document.querySelector('#bv-boka-av').hidden, null, { timeout: 5000 }).catch(() => {});
    prova('barnet utan funktionerna: förslagen går inte att hämta just nu',
      (await text(page, '#bv-boka-av')).includes('går inte att hämta just nu'), await text(page, '#bv-boka-av'));
    prova('barnet utan funktionerna: inga fel i konsolen', egnaFel(konsol).length === 0, egnaFel(konsol).join(' | '));
    await context.close();
  }

  /* 7. Telefonen. */
  for (const mörk of [false, true]) {
    const B = barnRpc({});
    const namn = 'barnet på telefon' + (mörk ? ', mörkt' : '');
    const { context, page } = await öppna(webb, { rpc: B.rpc, inloggad: 'barnkonto-1',
      context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: mörk ? 'dark' : 'light' } });
    await page.goto(BAS + '/barn#boka');
    await page.waitForSelector('#bv-boka-ruta:not([hidden]) .mv-dag', { timeout: 8000 }).catch(() => {});
    const host = '#bv-boka-yta';
    await tillMånaden(page, host, framåt(6));
    await väljDagOchTid(page, host, framåt(6), '17:00');
    const bredd = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    prova(namn + ': ingen sidledsscroll', bredd <= 0, bredd + ' px');
    const små = await page.evaluate(() => Array.from(document.querySelectorAll('section[data-sek="boka"] button'))
      .filter(b => b.offsetParent && !b.closest('.mv-grid')).map(b => b.getBoundingClientRect())
      .filter(r => Math.round(r.height) < 44).length);
    prova(namn + ': tryckytorna är minst 44 px', små === 0, små + ' knappar lägre än 44 px');
    await bild(page, 'barnet-boka-telefon' + (mörk ? '-mork' : ''), 'section[data-sek="boka"]');
    await context.close();
  }
}

/* ============ förälderns granskning ============ */
function foralderRpc(o) {
  const anrop = [];
  const får = { 'barn-1': ['pass', 'boka', 'studieplan', 'nexlax', 'meddelanden', 'chatt'] };
  const rpc = {
    /* Första timmen bara för en familj vi valt (2026-10-09). */
    forsta_timmen_lage: () => o.forsta || { beviljad: false, tagen: false },
    mina_barnkonton: () => [
      { barn_id: 'barn-1', anvandarnamn: 'alva.a', barn_aktiv: true, visa_rapporter: false,
        vardnadshavare_godkand_at: '2026-09-30T10:00:00Z', senast_inloggad: '2026-10-11T15:30:00Z' }
    ],
    mina_barns_behorigheter: () => ({ alla: o.alla || ['pass', 'boka', 'studieplan', 'rapporter', 'nexlax', 'meddelanden', 'chatt'],
      barn: Object.keys(får).map(id => ({ barn_id: id, behorigheter: får[id] })) }),
    barn_behorigheter_satt: k => {
      anrop.push(['barn_behorigheter_satt', k]);
      får[k.p_barn] = Array.from(new Set(k.p_lista || [])).sort();
      return { barn_id: k.p_barn, behorigheter: får[k.p_barn] };
    },
    kolla_rabattkod: k => {
      anrop.push(['kolla_rabattkod', k]);
      if (k.p_kod === 'VAN10') return [{ giltig: true, orsak: null, rabatt_ore: Math.round(k.p_belopp_ore / 10), beskrivning: '10 % rabatt' }];
      return [{ giltig: false, orsak: 'Koden finns inte.', rabatt_ore: 0, beskrivning: null }];
    },
    skicka_barnets_forslag: (k, W) => {
      anrop.push(['skicka_barnets_forslag', k]);
      if (o.skicka) return o.skicka(k, W);
      const f = W.barn_passforslag.find(x => x.id === k.p_id);
      if (f) { f.lage = 'skickat'; f.besvarad = nu(0); f.pass_id = 'pass-ny'; }
      return { id: 'pass-ny', status: 'requested', klippkort_id: null, betalning_status: null,
               rabattkod: o.tappaKoden ? null : k.p_pass.rabattkod };
    },
    barnforslag_neka: (k, W) => {
      anrop.push(['barnforslag_neka', k]);
      const f = W.barn_passforslag.find(x => x.id === k.p_id);
      if (f) { f.lage = 'nej'; f.besvarad = nu(0); }
      return { lage: 'ok' };
    }
  };
  if (o.tips) rpc.mina_tips = () => ({ kod: 'ANNA1', anmalda: 1, kunder: 1, kvar: 1 });
  return { rpc, anrop, får };
}

async function väntaPåListan(page) {
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 10000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelectorAll('#bf-lista .vy-rad').length > 0, null, { timeout: 8000 }).catch(() => {});
}

async function provaFörälderns(webb) {
  /* 1. Listan, Att göra, siffran och granskningen med rabattkod. */
  {
    const R = foralderRpc({});
    const { context, page, S, riktiga, konsol } = await öppna(webb, { rpc: R.rpc, inloggad: 'foralder-1', notisruta: true });
    await page.goto(BAS + '/foralder');
    await väntaPåListan(page);
    /* Rutan vid inloggningen säger att förslagen väntar. */
    await page.waitForSelector('.nx-notisruta', { timeout: 8000 }).catch(() => {});
    prova('förälder: rutan vid inloggningen säger att barnens förslag väntar',
      /3 förslag från barnen/.test(await text(page, '.nx-notisruta')), await text(page, '.nx-notisruta'));
    await page.click('.nx-notisruta [data-notisruta-stang]').catch(() => {});
    await page.waitForSelector('.nx-notisruta', { state: 'detached', timeout: 3000 }).catch(() => {});
    prova('förälder: Att göra har barnens förslag',
      (await text(page, '#ov-gora')).includes('Alva föreslår ett pass') && (await text(page, '#ov-gora')).includes('Bo föreslår ett pass'),
      await text(page, '#ov-gora'));
    prova('förälder: raden i Att göra leder till förslaget',
      (await page.locator('#ov-gora a[href="#boka/forslag-' + F1 + '"]').count()) === 1);
    prova('förälder: siffran vid Boka pass räknar de väntande',
      (await text(page, '#vy-sido a[data-sek="boka"] .vy-sido-mark')) === '3', await text(page, '#vy-sido a[data-sek="boka"] .vy-sido-mark'));
    await page.click('#vy-sido a[data-sek="boka"]');
    await page.waitForSelector('#bf-ruta:not([hidden])', { timeout: 5000 }).catch(() => {});
    prova('förälder: Förslag från barnen står överst under Boka pass', await synlig(page, '#bf-ruta'));
    const lista = await text(page, '#bf-lista');
    prova('förälder: varje förslag har barnets namn, tiden och Granska',
      lista.includes('Alva · ') && lista.includes('Bo · ') && lista.includes('kl. 16:00')
      && (await page.locator('#bf-lista [data-bf-granska]').count()) === 3, lista);
    prova('förälder: en dag som varit sägs', lista.includes('dagen har varit'), lista);
    await bild(page, 'foraldern-barnens-forslag', '#bf-ruta');

    /* Granska: allt barnet valt står ifyllt, och priset syns. */
    await page.click('#bf-lista [data-bf-granska="' + F1 + '"]');
    await page.waitForSelector('#boka-inner .bk-forslag', { timeout: 5000 }).catch(() => {});
    const host = '#boka-inner';
    prova('förälder: granskningen säger vems förslaget är', (await text(page, host + ' .bk-forslag')).includes('Alvas förslag'),
      await text(page, host + ' .bk-forslag'));
    prova('förälder: dagen är vald', (await page.getAttribute(host + ' .mv-dag[data-datum="' + framåt(5) + '"]', 'aria-pressed')) === 'true');
    prova('förälder: tiden är vald', (await page.getAttribute(host + ' .mv-tid[data-tid="16:00"]', 'aria-pressed')) === 'true');
    prova('förälder: den upptagna timmen syns inte', (await page.locator(host + ' .mv-tid[data-tid="18:00"]').count()) === 0);
    prova('förälder: ämne, längd och plats är valda',
      (await page.getAttribute(host + ' #bk-amnen button[data-v="Matematik"]', 'aria-pressed')) === 'true'
      && (await page.getAttribute(host + ' #bk-langder button[data-v="60"]', 'aria-pressed')) === 'true'
      && (await page.getAttribute(host + ' #bk-format button[data-v="Online"]', 'aria-pressed')) === 'true');
    prova('förälder: barnets rad står i fältet, som text',
      (await page.inputValue(host + ' #bk-not')) === ELAK + 'Provet på fredag'
      && (await page.locator(host + ' img[data-elak]').count()) === 0);
    prova('förälder: priset syns', /399\s*kr/.test(await text(page, host + ' .bk-sum-pris')), await text(page, host + ' .bk-sum-pris'));
    prova('förälder: ångerrättens mening står där', /ångerfristen på 14 dagar/.test(await text(page, host + ' .bk-anger')));
    prova('förälder: knappen skickar till studiehjälparen',
      /^Skicka till Sara/.test((await text(page, host + ' #bk-boka')).trim()), await text(page, host + ' #bk-boka'));
    prova('förälder: Granska blir Öppet nedan', (await text(page, '#bf-lista')).includes('Öppet nedan'));

    /* Rabattkoden: fel först, sedan rätt. */
    await page.fill(host + ' #bk-rabatt', 'fel');
    await page.click(host + ' [data-bk-rabatt]');
    await page.waitForFunction(() => /finns inte/.test(document.querySelector('.bk-rabatt-svar').textContent), null, { timeout: 5000 }).catch(() => {});
    const k1 = R.anrop.find(a => a[0] === 'kolla_rabattkod');
    prova('förälder: koden prövas mot databasen med passets pris', k1 && k1[1].p_kod === 'FEL' && k1[1].p_belopp_ore === 39900
      && k1[1].p_tjanst === 'laxhjalp', JSON.stringify(k1 && k1[1]));
    prova('förälder: en kod som inte gäller säger varför', (await text(page, host + ' .bk-rabatt-svar')).includes('Koden finns inte.'));
    await page.fill(host + ' #bk-rabatt', 'van10');
    await page.press(host + ' #bk-rabatt', 'Enter');
    await page.waitForFunction(() => /VAN10/.test(document.querySelector('.bk-rabatt-svar').textContent), null, { timeout: 5000 }).catch(() => {});
    prova('förälder: en kod som gäller syns, och priset blir lägre',
      (await text(page, host + ' .bk-rabatt-svar')).includes('VAN10: −39,90 kr') && /^359,10\s*kr/.test(await text(page, host + ' .bk-sum-pris'))
      && (await text(page, host + ' .bk-sum-pris')).includes('Med rabattkoden VAN10'), await text(page, host + ' .bk-sum-pris'));

    /* Föräldern ändrar längden: koden prövas igen med det nya priset. */
    await page.click(host + ' #bk-langder button[data-v="120"]');
    await page.waitForFunction(() => /718,20\s*kr/.test(document.querySelector('#boka-inner .bk-sum-pris').textContent), null, { timeout: 5000 }).catch(() => {});
    const k3 = R.anrop.filter(a => a[0] === 'kolla_rabattkod').pop();
    prova('förälder: en annan längd prövar koden igen, och priset följer', k3 && k3[1].p_belopp_ore === 79800
      && /^718,20\s*kr/.test(await text(page, host + ' .bk-sum-pris')), JSON.stringify(k3 && k3[1]) + ' ' + await text(page, host + ' .bk-sum-pris'));
    await bild(page, 'foraldern-granskar', '#boka-inner');

    await page.click(host + ' #bk-boka');
    await page.waitForSelector(host + ' .bk-kvitto', { timeout: 5000 }).catch(() => {});
    const sk = R.anrop.find(a => a[0] === 'skicka_barnets_forslag');
    prova('förälder: Skicka går genom skicka_barnets_forslag med det föräldern valt',
      sk && sk[1].p_id === F1 && sk[1].p_pass.datum === framåt(5) && sk[1].p_pass.tid === '16:00'
      && sk[1].p_pass.minuter === 120 && sk[1].p_pass.amne === 'Matematik' && sk[1].p_pass.format === 'Online'
      && sk[1].p_pass.rabattkod === 'VAN10' && sk[1].p_pass.not === ELAK + 'Provet på fredag' && sk[1].p_pass.barn === 1,
      JSON.stringify(sk && sk[1]));
    prova('förälder: ingen bokning skrivs direkt i tabellen', !S.logg.some(r => r.väg === '/rest/v1/bookings' && r.metod === 'POST'));
    const kv = await text(page, host + ' .bk-kvitto');
    prova('förälder: kvittot säger att Alvas förslag är skickat och att hon ser det',
      kv.includes('Alvas förslag är skickat') && kv.includes('Alva ser att ni skickat det'), kv);
    prova('förälder: kvittot länkar till passet', (await page.locator(host + ' .bk-kvitto a[href="#pass/pass-ny"]').count()) === 1);
    await page.waitForFunction(() => document.querySelectorAll('#bf-lista .vy-rad').length === 2, null, { timeout: 5000 }).catch(() => {});
    prova('förälder: förslaget lämnar listan', (await page.locator('#bf-lista .vy-rad').count()) === 2
      && (await text(page, '#vy-sido a[data-sek="boka"] .vy-sido-mark')) === '2');
    prova('förälder: granskningen är slut', (await page.locator(host + ' .bk-forslag').count()) === 0);

    /* Skicka inte, på Bos förslag. */
    await page.click('#bf-lista [data-bf-granska="' + F2 + '"]');
    await page.waitForSelector(host + ' .bk-forslag', { timeout: 5000 }).catch(() => {});
    prova('förälder: Bos förslag med platsen ifylld',
      (await text(page, host + ' .bk-forslag')).includes('Bos förslag')
      && (await page.inputValue(host + ' #bk-plats')) === 'Stadsbiblioteket'
      && (await page.getAttribute(host + ' #bk-langder button[data-v="120"]', 'aria-pressed')) === 'true');
    await page.click(host + ' [data-bk-neka]');
    await page.waitForFunction(() => /skickades inte/.test(document.querySelector('#bf-msg').textContent), null, { timeout: 5000 }).catch(() => {});
    const nej = R.anrop.find(a => a[0] === 'barnforslag_neka');
    prova('förälder: Skicka inte anropar barnforslag_neka', nej && nej[1].p_id === F2, JSON.stringify(nej && nej[1]));
    prova('förälder: beskedet säger att barnet ser det', (await text(page, '#bf-msg')).includes('Bo ser det i sin vy'), await text(page, '#bf-msg'));
    prova('förälder: ytan är familjens egen igen', (await page.locator(host + ' .bk-forslag').count()) === 0
      && (await page.locator('#bf-lista .vy-rad').count()) === 1);

    /* Tillbaka, på det gamla förslaget: dagen har varit. */
    await page.click('#bf-lista [data-bf-granska="' + F3 + '"]');
    await page.waitForSelector(host + ' .bk-forslag', { timeout: 5000 }).catch(() => {});
    prova('förälder: en dag som varit står inte ifylld, och hjälpraden säger det',
      (await text(page, host + ' .bk-hjalp')).includes('Dagen i förslaget har redan varit')
      && (await page.locator(host + ' .mv-dag[aria-pressed="true"]').count()) === 0, await text(page, host + ' .bk-hjalp'));
    await page.click(host + ' [data-bk-avbryt]');
    await vänta(200);
    prova('förälder: Tillbaka släpper förslaget utan att svara på det',
      (await page.locator(host + ' .bk-forslag').count()) === 0 && !R.anrop.some(a => a[0] === 'barnforslag_neka' && a[1].p_id === F3)
      && (await page.locator('#bf-lista [data-bf-granska="' + F3 + '"]').count()) === 1);

    /* Familjens eget förslag har samma ruta för en rabattkod
       (rabattkoden_krockar_inte, 2026-10-13). */
    await page.click(host + ' .mv-dag[data-datum="' + framåt(5) + '"]').catch(() => {});
    await page.waitForSelector(host + ' .mv-tid', { timeout: 3000 }).catch(() => {});
    prova('förälder: familjens eget förslag har rutan för en rabattkod', (await page.locator(host + ' #bk-rabatt').count()) === 1);
    prova('förälder: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
    prova('förälder: inga fel i konsolen', egnaFel(konsol).length === 0, egnaFel(konsol).join(' | '));
    await context.close();
  }

  /* 2. Adressen från Att göra och mejlet öppnar förslaget direkt. En kod
        databasen inte tog står i kvittot. */
  {
    const R = foralderRpc({ tappaKoden: true });
    const { context, page } = await öppna(webb, { rpc: R.rpc, inloggad: 'foralder-1' });
    await page.goto(BAS + '/foralder#boka/forslag-' + F1);
    await page.waitForSelector('#boka-inner .bk-forslag', { timeout: 10000 }).catch(() => {});
    prova('förälder via adressen: förslaget öppnas', (await text(page, '#boka-inner .bk-forslag')).includes('Alvas förslag'));
    prova('förälder via adressen: adressen blir #boka', new URL(page.url()).hash === '#boka', page.url());
    await page.fill('#boka-inner #bk-rabatt', 'VAN10');
    await page.click('#boka-inner [data-bk-rabatt]');
    await page.waitForFunction(() => /VAN10/.test(document.querySelector('.bk-rabatt-svar').textContent), null, { timeout: 5000 }).catch(() => {});
    await page.click('#boka-inner #bk-boka');
    await page.waitForSelector('#boka-inner .bk-kvitto', { timeout: 5000 }).catch(() => {});
    prova('förälder: en kod som inte gällde när passet skapades står i kvittot',
      (await text(page, '#boka-inner .bk-kvitto')).includes('Rabattkoden VAN10 gällde inte'), await text(page, '#boka-inner .bk-kvitto'));
    await context.close();
  }

  /* 3. En kod i rutan som inte prövats prövas när föräldern trycker på
        Skicka; gäller den inte skickas ingenting. Och databasens besked
        om ett redan besvarat förslag står i ytan. */
  {
    const R = foralderRpc({ skicka: () => ({ __fel: { code: 'P0001', hint: 'barnforslag', message: 'Förslaget är redan besvarat.' } }) });
    const { context, page } = await öppna(webb, { rpc: R.rpc, inloggad: 'foralder-1' });
    await page.goto(BAS + '/foralder#boka');
    await väntaPåListan(page);
    await page.click('#bf-lista [data-bf-granska="' + F1 + '"]');
    await page.waitForSelector('#boka-inner .bk-forslag', { timeout: 5000 }).catch(() => {});
    await page.fill('#boka-inner #bk-rabatt', 'NEJ');
    await page.click('#boka-inner #bk-boka');
    await page.waitForFunction(() => /Rabattkoden gäller inte/.test(document.querySelector('#bk-msg').textContent), null, { timeout: 5000 }).catch(() => {});
    prova('förälder: en kod som inte gäller stoppar Skicka', (await text(page, '#boka-inner #bk-msg')).includes('Rabattkoden gäller inte')
      && !R.anrop.some(a => a[0] === 'skicka_barnets_forslag'), await text(page, '#boka-inner #bk-msg'));
    await page.fill('#boka-inner #bk-rabatt', '');
    await page.click('#boka-inner #bk-boka');
    await page.waitForFunction(() => /redan besvarat/.test(document.querySelector('#bk-msg').textContent), null, { timeout: 5000 }).catch(() => {});
    prova('förälder: databasens besked står i ytan', (await text(page, '#boka-inner #bk-msg')).includes('Förslaget är redan besvarat.'),
      await text(page, '#boka-inner #bk-msg'));
    await context.close();
  }

  /* 3b. Första timmen och koden: timmen går före koden, och de läggs
         inte ihop (rabattkoden_krockar_inte). Priset vid knappen är
         detsamma som utan kod, och rutan säger varför. */
  {
    const R = foralderRpc({ forsta: { beviljad: true, tagen: false } });
    const { context, page } = await öppna(webb, { rpc: R.rpc, inloggad: 'foralder-1' });
    await page.goto(BAS + '/foralder#boka/forslag-' + F2);
    await page.waitForSelector('#boka-inner .bk-forslag', { timeout: 10000 }).catch(() => {});
    prova('förälder med första timmen: två timmar, en på köpet', /^399\s*kr/.test(await text(page, '#boka-inner .bk-sum-pris'))
      && (await text(page, '#boka-inner .bk-sum-pris')).includes('Första timmen på köpet'), await text(page, '#boka-inner .bk-sum-pris'));
    await page.fill('#boka-inner #bk-rabatt', 'VAN10');
    await page.click('#boka-inner [data-bk-rabatt]');
    await page.waitForFunction(() => /VAN10/.test(document.querySelector('#boka-inner .bk-rabatt-svar').textContent), null, { timeout: 5000 }).catch(() => {});
    prova('förälder med första timmen: koden läggs inte ovanpå timmen',
      /^399\s*kr/.test(await text(page, '#boka-inner .bk-sum-pris'))
      && (await text(page, '#boka-inner .bk-sum-pris')).includes('Första timmen på köpet')
      && !(await text(page, '#boka-inner .bk-sum-pris')).includes('VAN10'),
      await text(page, '#boka-inner .bk-sum-pris'));
    prova('förälder med första timmen: rutan säger att koden inte används här',
      (await text(page, '#boka-inner .bk-rabatt-svar')).includes('VAN10 gäller, men inte på det här passet: första timmen är på köpet'),
      await text(page, '#boka-inner .bk-rabatt-svar'));
    await bild(page, 'foraldern-kod-och-forsta-timmen', '#boka-inner');
    await context.close();
  }

  /* 3c. Tipstimmen går före koden, som första timmen
         (rabattkoden_krockar_inte). Förut gick koden före, och timmen
         sköts till ett senare pass. */
  {
    const R = foralderRpc({ tips: true });
    const { context, page } = await öppna(webb, { rpc: R.rpc, inloggad: 'foralder-1' });
    await page.goto(BAS + '/foralder#boka/forslag-' + F1);
    await page.waitForSelector('#boka-inner .bk-forslag', { timeout: 10000 }).catch(() => {});
    await page.waitForFunction(() => /tips/.test(document.querySelector('#boka-inner .bk-sum-pris').textContent), null, { timeout: 5000 }).catch(() => {});
    prova('förälder med tipstimme: passet är på köpet', /^0\s*kr/.test(await text(page, '#boka-inner .bk-sum-pris'))
      && (await text(page, '#boka-inner .bk-sum-pris')).includes('En timme på köpet för ert tips'), await text(page, '#boka-inner .bk-sum-pris'));
    await page.fill('#boka-inner #bk-rabatt', 'VAN10');
    await page.click('#boka-inner [data-bk-rabatt]');
    await page.waitForFunction(() => /VAN10/.test(document.querySelector('#boka-inner .bk-rabatt-svar').textContent), null, { timeout: 5000 }).catch(() => {});
    prova('förälder med tipstimme: med en kod gäller tipstimmen, inte koden',
      /^0\s*kr/.test(await text(page, '#boka-inner .bk-sum-pris'))
      && (await text(page, '#boka-inner .bk-sum-pris')).includes('En timme på köpet för ert tips'), await text(page, '#boka-inner .bk-sum-pris'));
    prova('förälder med tipstimme: rutan säger att koden inte används här',
      (await text(page, '#boka-inner .bk-rabatt-svar')).includes('passet får en timme på köpet för ert tips'),
      await text(page, '#boka-inner .bk-rabatt-svar'));
    await context.close();
  }

  /* 3d. Familjens eget förslag med en kod (2026-10-13): priset vid
         knappen, koden i skrivningen och inget i kvittot om att den
         inte gällde. */
  {
    const R = foralderRpc({});
    const { context, page, S } = await öppna(webb, { rpc: R.rpc, inloggad: 'foralder-1' });
    await page.goto(BAS + '/foralder#boka');
    await page.waitForSelector('#boka-inner .mv-dag', { timeout: 10000 }).catch(() => {});
    await tillMånaden(page, '#boka-inner', framåt(6));
    await väljDagOchTid(page, '#boka-inner', framåt(6), '17:00');
    await page.click('#boka-inner #bk-format button[data-v="Online"]').catch(() => {});
    await page.fill('#boka-inner #bk-rabatt', 'van10');
    await page.click('#boka-inner [data-bk-rabatt]');
    await page.waitForFunction(() => /359,10/.test(document.querySelector('#boka-inner .bk-sum-pris').textContent), null, { timeout: 5000 }).catch(() => {});
    prova('förälder, eget förslag: en kod som gäller ger priset vid knappen',
      /^359,10\s*kr/.test(await text(page, '#boka-inner .bk-sum-pris'))
      && (await text(page, '#boka-inner .bk-sum-pris')).includes('Med rabattkoden VAN10'), await text(page, '#boka-inner .bk-sum-pris'));
    await page.click('#boka-inner #bk-boka');
    await page.waitForSelector('#boka-inner .bk-kvitto', { timeout: 5000 }).catch(() => {});
    const post = S.logg.filter(r => r.metod === 'POST' && r.väg === '/rest/v1/bookings').pop();
    prova('förälder, eget förslag: koden följer med passet, i versaler', post && post.kropp && post.kropp.rabattkod === 'VAN10',
      JSON.stringify(post && post.kropp));
    prova('förälder, eget förslag: kvittot säger inget om koden när den gällde',
      (await text(page, '#boka-inner .bk-kvitto')).includes('Förslaget är skickat')
      && !(await text(page, '#boka-inner .bk-kvitto')).includes('gällde inte'), await text(page, '#boka-inner .bk-kvitto'));
    prova('förälder, eget förslag: rutan är tom igen efteråt', (await page.inputValue('#boka-inner #bk-rabatt').catch(() => '')) === '');
    await context.close();
  }

  /* 3e. Timbanken går före koden: räcker timmarna står de vid knappen,
         rutan säger att koden inte används, och kvittot säger att
         timmarna betalade. Koden skickas ändå; databasen avgör. */
  {
    const R = foralderRpc({});
    const { context, page, S } = await öppna(webb, {
      rpc: R.rpc, inloggad: 'foralder-1',
      värld: W => {
        W.flaggor = [{ kod: 'erbjudanden', aktiv: true }];
        W.klippkort_saldo = [{ id: 'kk-1', parent_id: 'foralder-1', erbjudande: 'klipp10', namn: 'Fyll timbanken, 10 timmar',
          sort: 'klippkort', timmar: 10, anvanda: 0, kvar: 10, giltigt_till: dagar(150), status: 'betald', brukbar: true,
          created_at: nu(-6000) }];
      },
      bokat: rad => Object.assign(rad, { klippkort_id: 'kk-1', betalning_status: 'betald', rabattkod: null })
    });
    await page.goto(BAS + '/foralder#boka');
    await page.waitForSelector('#boka-inner .mv-dag', { timeout: 10000 }).catch(() => {});
    await tillMånaden(page, '#boka-inner', framåt(6));
    await väljDagOchTid(page, '#boka-inner', framåt(6), '17:00');
    await page.click('#boka-inner #bk-format button[data-v="Online"]').catch(() => {});
    await page.fill('#boka-inner #bk-rabatt', 'VAN10');
    await page.click('#boka-inner [data-bk-rabatt]');
    await page.waitForFunction(() => /VAN10/.test(document.querySelector('#boka-inner .bk-rabatt-svar').textContent), null, { timeout: 5000 }).catch(() => {});
    prova('förälder med timmar: timmarna står vid knappen, inte koden',
      (await text(page, '#boka-inner .bk-sum-pris')).includes('Er timbank')
      && !(await text(page, '#boka-inner .bk-sum-pris')).includes('VAN10'), await text(page, '#boka-inner .bk-sum-pris'));
    prova('förälder med timmar: rutan säger att timbanken betalar och koden inte används',
      (await text(page, '#boka-inner .bk-rabatt-svar')).includes('passet betalas med timmar ur er timbank'),
      await text(page, '#boka-inner .bk-rabatt-svar'));
    await bild(page, 'foraldern-kod-och-timmar', '#boka-inner');
    await page.click('#boka-inner #bk-boka');
    await page.waitForSelector('#boka-inner .bk-kvitto', { timeout: 5000 }).catch(() => {});
    const post = S.logg.filter(r => r.metod === 'POST' && r.väg === '/rest/v1/bookings').pop();
    prova('förälder med timmar: koden skickas, och databasen avgör', post && post.kropp && post.kropp.rabattkod === 'VAN10',
      JSON.stringify(post && post.kropp));
    prova('förälder med timmar: kvittot säger att timmarna betalade, och inget om koden',
      (await text(page, '#boka-inner .bk-kvitto')).includes('Passet är betalt med 1 timme av era timmar')
      && !(await text(page, '#boka-inner .bk-kvitto')).includes('gällde inte'), await text(page, '#boka-inner .bk-kvitto'));
    await context.close();
  }

  /* 4. Inställningen: Föreslå pass under Profil → Barn, av som förval. */
  {
    const R = foralderRpc({});
    const { context, page } = await öppna(webb, { rpc: R.rpc, inloggad: 'foralder-1' });
    await page.goto(BAS + '/foralder#profil/barn');
    await page.waitForSelector('#bi-ruta:not([hidden])', { timeout: 10000 }).catch(() => {});
    const knapp = '[data-bi-far="barn-1:boka"]';
    prova('förälder: valet Föreslå pass står i barnets kort', (await page.locator(knapp).count()) === 1
      && (await text(page, '.bi-kort[data-bi="barn-1"] .bi-far')).includes('Föreslå pass'));
    prova('förälder: valet är på för Alva', (await text(page, knapp)) === 'På', await text(page, knapp));
    await page.click(knapp);
    await vänta(300);
    const s = R.anrop.filter(a => a[0] === 'barn_behorigheter_satt').pop();
    prova('förälder: av går genom barn_behorigheter_satt', s && s[1].p_barn === 'barn-1' && !s[1].p_lista.includes('boka')
      && s[1].p_lista.includes('pass'), JSON.stringify(s && s[1]));
    prova('förälder: knappen säger Av efteråt', (await text(page, knapp)) === 'Av');
    await bild(page, 'foraldern-barnets-val', '.bi-kort[data-bi="barn-1"]');
    await context.close();
  }

  /* 5. En databas utan boka i listan: inget val, och utan tabellen ingen
        lista. Inget annat går sönder. */
  {
    const R = foralderRpc({ alla: ['pass', 'studieplan', 'rapporter', 'nexlax', 'meddelanden', 'chatt'] });
    const { context, page, konsol } = await öppna(webb, { rpc: R.rpc, inloggad: 'foralder-1', utanTabell: ['barn_passforslag'] });
    await page.goto(BAS + '/foralder#profil/barn');
    await page.waitForSelector('#bi-ruta:not([hidden])', { timeout: 10000 }).catch(() => {});
    prova('förälder utan migrationen: inget val Föreslå pass', (await page.locator('[data-bi-far="barn-1:boka"]').count()) === 0);
    await page.click('#vy-sido a[data-sek="boka"]');
    await page.waitForSelector('#boka-inner .mv-dag', { timeout: 5000 }).catch(() => {});
    prova('förälder utan migrationen: bokningen fungerar, utan förslag från barnen',
      (await synlig(page, '#boka-inner .mv-dag')) && !(await synlig(page, '#bf-ruta'))
      && (await page.locator('#vy-sido a[data-sek="boka"] .vy-sido-mark').count()) === 0);
    prova('förälder utan migrationen: inga fel i konsolen', egnaFel(konsol).length === 0, egnaFel(konsol).join(' | '));
    await context.close();
  }

  /* 6. Telefonen. */
  for (const mörk of [false, true]) {
    const R = foralderRpc({});
    const namn = 'förälder på telefon' + (mörk ? ', mörkt' : '');
    const { context, page } = await öppna(webb, { rpc: R.rpc, inloggad: 'foralder-1',
      context: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: mörk ? 'dark' : 'light' } });
    await page.goto(BAS + '/foralder#boka/forslag-' + F1);
    await page.waitForSelector('#boka-inner .bk-forslag', { timeout: 10000 }).catch(() => {});
    await page.fill('#boka-inner #bk-rabatt', 'VAN10');
    await page.click('#boka-inner [data-bk-rabatt]');
    await vänta(300);
    const bredd = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    prova(namn + ': ingen sidledsscroll', bredd <= 0, bredd + ' px');
    const små = await page.evaluate(() => Array.from(document.querySelectorAll('#bf-ruta button, #boka-inner .bk-forslag button, #boka-inner .bk-rabatt button, #boka-inner .bk-rabatt input'))
      .filter(b => b.offsetParent).map(b => b.getBoundingClientRect()).filter(r => Math.round(r.height) < 44).length);
    prova(namn + ': tryckytorna är minst 44 px', små === 0, små + ' lägre än 44 px');
    const fält = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#bk-rabatt')).fontSize));
    prova(namn + ': rabattfältet har minst 16 px text', fält >= 16, fält + ' px');
    await bild(page, 'foraldern-granskar-telefon' + (mörk ? '-mork' : ''), '#boka-inner');
    await context.close();
  }
}

(async function () {
  const server = spawn('python3', [path.join(ROT, '.claude', 'serve.py'), String(PORT)], { stdio: 'ignore' });
  let klar = false;
  for (let i = 0; i < 50 && !klar; i++) {
    try { klar = (await fetch(BAS + '/barn')).ok; } catch (e) { await vänta(100); }
  }
  const webb = await pw.chromium.launch();
  try {
    await provaBarnetsVy(webb);
    await provaFörälderns(webb);
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
