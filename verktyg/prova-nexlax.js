/* ============================================================
   NEXTRUM — webbläsarprov för NexLäx: väljaren, NP-sektionen,
   uppdragen, ljudet, vibrationen och firandena (2026-10-06)

       NODE_PATH="$(npm root -g)" node verktyg/prova-nexlax.js [mapp för bilder]

   Byggt som verktyg/prova-barnkonton.js (egen port, 8965): sidorna
   serveras av .claude/serve.py, nextrum-config.js byts i farten mot en
   som pekar på https://supabase.test, och varje anrop dit besvaras här
   av en falsk Supabase. Ett anrop till den riktiga adressen stoppas och
   fäller provet. Körs inte i CI: Playwright är ingen del av repot.

   Ljudet och vibrationen går inte att höra eller känna i ett prov.
   AudioContext och navigator.vibrate byts därför mot attrapper som
   räknar, och NXLjud.känn lyssnas av: provet ser VILKA händelser som
   låter och vibrerar, och att tonerna faktiskt startas.

   Rättningen, XP:n och uppdragen räknas i databasen och provas i
   verktyg/rls-test.sql (avsnitt 19), inte här.
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
const PORT = 8965;
const BAS = 'http://localhost:' + PORT;
const FALSK = 'https://supabase.test';
const RIKTIG = /ddkfiuvcppalutfulvbi\.supabase\.co/;
const BILDER = process.argv[2] || null;
const LAGRING = 'sb-supabase-auth-token';

const utfall = [];
function prova(namn, ok, detalj) {
  utfall.push({ namn, ok: !!ok, detalj: ok ? '' : String(detalj == null ? '' : detalj) });
}

const idag = new Date();
const dagar = n => { const d = new Date(idag); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const nu = n => new Date(Date.now() + n * 60000).toISOString();
const vänta = ms => new Promise(r => setTimeout(r, ms));
const ELAK = '<img src=x data-elak=1>';

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

/* ============ banken i provet ============
   Matematik åk 6 med två områden på vägen och ett i NP-spåret, och
   några banor till, så att väljaren har något att välja mellan: en
   annan årskurs, ett ämne som bara finns i NexLäx och ett språk. */
function n(id, amne, arskurs, omrade, titel, ordning, extra) {
  return Object.assign({ id, nyckel: id, amne, arskurs, omrade, titel, beskrivning: 'Prov: ' + titel, ordning,
                         antal_fragor: 4, aktiv: true, sort: 'vanlig', lastext: null, spar: 'vag' }, extra || {});
}
const KATALOG = [
  n('ma6-brak-1', 'Matematik', 'ak6', 'Bråk', 'Jämför bråk', 1),
  n('ma6-brak-2', 'Matematik', 'ak6', 'Bråk', 'Förläng bråk', 2),
  n('ma6-brak-m', 'Matematik', 'ak6', 'Bråk', 'Mästarprov: Bråk', 3, { sort: 'mastare', antal_fragor: 0 }),
  n('ma6-proc-1', 'Matematik', 'ak6', 'Procent', 'Hundradelar', 4),
  n('ma6-proc-2', 'Matematik', 'ak6', 'Procent', 'Rabatter', 5),
  n('ma6-np-1', 'Matematik', 'ak6', 'NP-träning', 'Utan räknare', 6, { spar: 'np' }),
  n('ma6-np-2', 'Matematik', 'ak6', 'NP-träning', 'Med räknare', 7, { spar: 'np' }),
  n('ma6-np-m', 'Matematik', 'ak6', 'NP-träning', 'Mästarprov: NP-träning', 8, { sort: 'mastare', spar: 'np', antal_fragor: 0 }),
  n('ma6-rep', 'Matematik', 'ak6', 'Repetition', 'Repetition', 9, { sort: 'repetition', antal_fragor: 0 }),
  n('ma7-alg-1', 'Matematik', 'ak7', 'Algebra', 'Uttryck', 1),
  n('sv6-las-1', 'Svenska', 'ak6', 'Läsa', 'Berättelsen', 1),
  n('ju-gy1-avtal-1', 'Juridik', 'gy1', 'Avtal', 'Anbud och accept', 1),
  n('es-ak7-hola-1', 'Spanska', 'ak7', 'Hälsa', '¡Hola!', 1),
  n('en6-np-1', 'Engelska', 'ak6', 'NP-träning: ord och grammatik', 'Words ' + ELAK, 1, { spar: 'np' })
];

/* Uppdragen före och efter en klarad nivå. Efter är alla tre klara. */
function uppdrag(efter) {
  return {
    dag: dagar(0),
    idag: [
      { id: 'xp-50', grupp: 'xp', text: 'Samla 50 XP', mal: 50, har: efter ? 50 : 20, klart: !!efter },
      { id: 'nivaer-1', grupp: 'nivaer', text: 'Klara en nivå', mal: 1, har: efter ? 1 : 0, klart: !!efter },
      { id: 'rad-5', grupp: 'kunna', text: 'Svara rätt fem gånger i rad', mal: 5, har: efter ? 5 : 2, klart: !!efter }
    ],
    kista: !!efter,
    vecka: { id: 'v-dagar-3', text: 'Klara en nivå tre olika dagar den här veckan', mal: 3, har: efter ? 2 : 1, klart: false, till: dagar(4) },
    manad: { manad: dagar(0).slice(0, 7), mal: 20, har: efter ? 7 : 4, klart: false },
    totalt: efter ? 7 : 4, hela_dagar: efter ? 1 : 0, veckor: 0, manader: 0
  };
}

function nexlaxRpc() {
  const anrop = [];
  let lägen = 0;
  /* Fyra frågor: rätt svar är alltid alternativ 0. */
  const frågor = [1, 2, 3, 4].map(i => ({ id: 'fr-' + i, typ: 'val', fraga: 'Fråga ' + i + ': vilket är rätt?', alternativ: ['Rätt', 'Fel'] }));
  const rätt = new Set();
  const hoppade = new Set();
  const forsok = [
    { id: 'f-0', niva_id: 'ma6-brak-2', student_id: 'barn-1', startad_at: nu(-3000), klar_at: nu(-2990), antal: 4, ratt_direkt: 4, stjarnor: 3, godkand: true },
    { id: 'f-1', niva_id: 'ju-gy1-avtal-1', student_id: 'barn-1', startad_at: nu(-2000), klar_at: nu(-1990), antal: 4, ratt_direkt: 3, stjarnor: 1, godkand: true }
  ];
  const rpc = {
    barn_oversikt: () => ({ lage: 'ok', fornamn: 'Alva', studiehjalpare: 'Sara', kommande: [], genomforda: [],
                            timmar: { genomforda: 2, bokade: 0 }, studieplan: null, visa_rapporter: false, rapporter: null }),
    barn_notiser: () => [],
    barn_markera_last: () => true,
    rapportera_fragefel: k => { anrop.push(['rapportera_fragefel', k]); return true; },
    barn_nexlax: () => {
      anrop.push(['barn_nexlax']);
      return { lage: 'ok', elev: 'barn-1', arskurs: 'Åk 6', amnen: ['Matematik'], katalog: KATALOG,
               forsok, pagaende: {}, uppgifter: [] };
    },
    nexlax_lage: k => {
      anrop.push(['nexlax_lage', k]);
      lägen++;
      const efter = rätt.size === frågor.length;
      return { xp: efter ? 820 : 480, xp_idag: efter ? 110 : 20, xp_vecka: 200, serie: { nu: 2, basta: 4, idag: efter },
               dagar: [{ dag: dagar(-1), xp: 160, nivaer: 1, uppgifter: 0, pass: 0 }], banor: [],
               nivaer: {}, omraden: efter ? [{ amne: 'Matematik', arskurs: 'ak6', omrade: 'Bråk', klart: nu(0) }] : [],
               missade: [], uppgifter: { klara: 30, direkt: 25, forsta: 40, forsta_ratt: 30 },
               regler: { val: 10, svarare: 20, niva: 50, omrade: 100 }, uppdrag: uppdrag(efter), idag: dagar(0),
               fripass: { per_vecka: 5, kvar: 5 - hoppade.size, nivaer: [...hoppade], nya: dagar(7) } };
    },
    /* Fripassen (2026-10-27): som niva_starta, och nivån räknas som hoppad. */
    niva_hoppa: k => {
      anrop.push(['niva_hoppa', k]);
      hoppade.add(k.p_niva);
      return { forsok: 'forsok-hopp', niva: { id: k.p_niva, titel: 'Hoppad', amne: 'Matematik', omrade: 'Bråk', arskurs: 'ak6',
               sort: 'vanlig', lastext: null }, fragor: frågor, klara: [],
               fripass: { per_vecka: 5, kvar: 5 - hoppade.size, nivaer: [...hoppade], nya: dagar(7) } };
    },
    niva_starta: k => {
      anrop.push(['niva_starta', k]);
      return { forsok: 'forsok-1', niva: { id: k.p_niva, titel: 'Jämför bråk', amne: 'Matematik', omrade: 'Bråk', arskurs: 'ak6',
               sort: 'vanlig', lastext: null }, fragor: frågor, klara: [...rätt] };
    },
    niva_svara: k => {
      anrop.push(['niva_svara', k]);
      const ok = !!(k.p_svar && k.p_svar.val === 0);
      if (ok) rätt.add(k.p_fraga);
      const klar = rätt.size === frågor.length;
      if (klar && !forsok.some(f => f.id === 'forsok-1')) {
        forsok.push({ id: 'forsok-1', niva_id: 'ma6-brak-1', student_id: 'barn-1', startad_at: nu(-2), klar_at: nu(0),
                      antal: 4, ratt_direkt: 3, stjarnor: 1, godkand: true });
      }
      return { ratt: ok, facit: 0, forklaring: 'Rätt är alltid det första i provet.', klar, xp: ok ? 10 : 0,
               resultat: klar ? { antal: 4, ratt_direkt: 3, stjarnor: 1, godkand: true, forut: 0, klar_at: nu(0),
                                  xp_fragor: 30, xp_niva: 50, xp_omrade: 100 } : null };
    },
    niva_genomgang: () => null
  };
  return { rpc, anrop, lägen: () => lägen };
}

/* ============ den falska Supabase ============ */
function falskSupabase(o) {
  const logg = [];
  const W = o.tabeller || {};
  const svar = (route, status, kropp, extra) => route.fulfill({
    status,
    headers: Object.assign({
      'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
      'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range, x-total-count'
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
  async function hantera(route) {
    const req = route.request();
    const url = new URL(req.url());
    const metod = req.method();
    if (metod === 'OPTIONS') return svar(route, 204);
    let kropp = null;
    try { kropp = req.postDataJSON(); } catch (e) { kropp = req.postData(); }
    logg.push({ metod, väg: url.pathname, kropp });
    const p = url.pathname;
    if (p === '/auth/v1/token') return svar(route, 200, session(o.inloggad));
    if (p === '/auth/v1/user') return svar(route, 200, ANVANDARE[o.inloggad]);
    if (p.startsWith('/auth/v1/')) return svar(route, 200, {});
    if (p.startsWith('/rest/v1/rpc/')) {
      const namn = p.slice('/rest/v1/rpc/'.length);
      const f = (o.rpc || {})[namn];
      if (!f) return svar(route, 404, { code: 'PGRST202', message: 'Could not find the function public.' + namn + ' in the schema cache' });
      const data = f(kropp || {});
      return svar(route, 200, data === undefined ? null : data);
    }
    if (p.startsWith('/rest/v1/')) {
      const tabell = p.slice('/rest/v1/'.length);
      const rader = typeof W[tabell] === 'function' ? W[tabell]() : (W[tabell] || []);
      const ut = filtrera(rader, url.searchParams);
      const vill = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
      const cr = ut.length ? '0-' + (ut.length - 1) + '/' + ut.length : '*/0';
      if (metod === 'GET' || metod === 'HEAD') {
        if (vill) return ut.length ? svar(route, 200, ut[0], { 'content-range': cr }) : svar(route, 406, { code: 'PGRST116', message: 'no rows' });
        return svar(route, 200, ut, { 'content-range': cr });
      }
      return svar(route, metod === 'PATCH' ? 204 : 201, metod === 'PATCH' ? undefined : []);
    }
    return svar(route, 404, {});
  }
  return { logg, hantera, session };
}

/* Ljudet och vibrationen som räknas i stället för att höras. */
function attrapper() {
  window.__toner = 0;
  window.__vibb = [];
  class FalskAC {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    createGain() { return { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect(x) { return x; } }; }
    createOscillator() {
      return { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect(x) { return x; },
               start() { window.__toner++; }, stop() {} };
    }
    createBiquadFilter() { return { type: '', frequency: { value: 0 }, connect(x) { return x; } }; }
    resume() { return Promise.resolve(); }
  }
  window.AudioContext = FalskAC;
  window.webkitAudioContext = FalskAC;
  try { Object.defineProperty(navigator, 'vibrate', { configurable: true, value: m => { window.__vibb.push(m); return true; } }); } catch (e) { /* utan vibrate */ }
}

async function öppna(webb, o) {
  const context = await webb.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, o.context || {}));
  const S = falskSupabase(o);
  const riktiga = [];
  const konsol = [];
  await context.route(RIKTIG, route => { riktiga.push(route.request().url()); return route.abort(); });
  await context.route(/nextrum-config\.js/, async route => {
    const t = fs.readFileSync(path.join(ROT, 'nextrum-config.js'), 'utf8').replace(/SUPABASE_URL:\s*'[^']*'/, "SUPABASE_URL: '" + FALSK + "'");
    return route.fulfill({ status: 200, contentType: 'application/javascript', body: t });
  });
  await context.route(/^https:\/\/supabase\.test\//, S.hantera);
  await context.routeWebSocket(/supabase\.test/, () => {});
  await context.route(url => !String(url).startsWith(BAS) && !/supabase\.test/.test(String(url)), route => route.abort());
  const sess = S.session(o.inloggad);
  await context.addInitScript(([nyckel, värde]) => {
    try { localStorage.setItem(nyckel, värde); } catch (e) { /* ingen lagring */ }
  }, [LAGRING, JSON.stringify(sess)]);
  await context.addInitScript(attrapper);
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') konsol.push(m.text()); });
  page.on('pageerror', e => konsol.push('pageerror: ' + e.message));
  page.on('dialog', d => d.dismiss());
  return { context, page, S, riktiga, konsol };
}

async function bild(page, namn, sel) {
  if (!BILDER) return;
  fs.mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: path.join(BILDER, namn + '.png'), fullPage: !sel });
  if (sel) await page.locator(sel).first().screenshot({ path: path.join(BILDER, namn + '-del.png') }).catch(() => {});
}
const synlig = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const text = (page, sel) => page.locator(sel).first().textContent().catch(() => '');

/* Lyssna på vilka händelser som låter och vibrerar. */
async function lyssna(page) {
  await page.evaluate(() => {
    window.__känt = [];
    const orig = NXLjud.känn;
    NXLjud.känn = (namn, opts) => { window.__känt.push(namn); return orig(namn, opts); };
  });
}
const känt = page => page.evaluate(() => window.__känt.slice());

/* Elevvyn har sedan 2026-10-06 en del i taget i sidomenyn (Översikt,
   Mina lektioner, NexLäx, Meddelanden, Profil): NexLäx öppnas med #nexlax. */
async function tillBarnetsVag(page) {
  await page.goto(BAS + '/barn#nexlax');
  await page.waitForSelector('#bv-nexlax:not([hidden])', { timeout: 8000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelector('#bv-nl-vag .nl-valj'), null, { timeout: 5000 }).catch(() => {});
}

/* ============ barnets vy: väljaren, NP, uppdragen och spelaren ============ */
async function provaBarnet(webb) {
  const { rpc, anrop } = nexlaxRpc();
  const { context, page, riktiga, konsol } = await öppna(webb, { rpc, inloggad: 'barnkonto-1' });
  await tillBarnetsVag(page);
  await lyssna(page);

  /* Väljaren (2026-10-13): tre ämnen framme, resten bakom Visa fler
     ämnen, och årskurserna som små siffror. */
  const namnen = () => page.$$eval('#bv-nl-vag .nl-amne', b => b.map(x => x.querySelector('b').firstChild.textContent));
  /* Banan syns direkt: väljaren är gömd bakom banderollen (2026-10-13). */
  prova('banan: väljaren är gömd och banderollen säger ämnet och årskursen', (await page.locator('#bv-nl-vag .nl-valj').count()) === 0
    && (await text(page, '#bv-nl-vag .nl-baner')).includes('Matematik') && (await text(page, '#bv-nl-vag .nl-baner')).includes('Åk 6'),
    await text(page, '#bv-nl-vag .nl-baner'));
  /* Hälsningen står kvar ovanför (ingen separat sida); menyn lägger sektionen vid sin början. */
  await page.evaluate(() => document.querySelector('#bv-nexlax').scrollIntoView());
  prova('banan: stegen syns i första skärmen', await page.evaluate(() => {
    const k = document.querySelector('#bv-nl-vag .upg-nod-knapp, #bv-nl-vag .nl-omr');
    return !!k && k.getBoundingClientRect().top < window.innerHeight;
  }));
  /* Kortet vid en prick (2026-10-27): det öppnas och stängs på plats, ovanpå
     vägen. Vägen ritas inte om och ingenting under pricken flyttar sig. */
  const kortet = await page.evaluate(async () => {
    const vänta = ms => new Promise(r => setTimeout(r, ms));
    const knapp = document.querySelector('#bv-nl-vag .upg-nod.aktuell .upg-nod-knapp') || document.querySelector('#bv-nl-vag .upg-nod-knapp');
    const li = knapp.closest('.upg-nod');
    const nästa = li.nextElementSibling && li.nextElementSibling.querySelector('.upg-nod-knapp');
    const före = nästa ? nästa.getBoundingClientRect().top : 0;
    knapp.click();
    await vänta(450);
    const kort = li.querySelector('.upg-nod-kort');
    const ut = { öppen: li.classList.contains('vald') && !!kort && getComputedStyle(kort).position === 'absolute',
      sammaKnapp: knapp.isConnected, flytt: nästa ? Math.round(nästa.getBoundingClientRect().top - före) : 0,
      värd: document.querySelector('#bv-nl-vag').dataset.nod === knapp.dataset.nlNod };
    document.querySelector('#bv-nl-vag .nl-omr-huvud').click();
    await vänta(450);
    ut.stängt = !li.classList.contains('vald') && !li.querySelector('.upg-nod-kort') && !document.querySelector('#bv-nl-vag').dataset.nod;
    return ut;
  });
  prova('banan: kortet vid en prick öppnas på plats, ovanpå vägen, och ett tryck utanför stänger det',
    kortet.öppen && kortet.sammaKnapp && kortet.flytt === 0 && kortet.värd && kortet.stängt, JSON.stringify(kortet));
  await page.click('#bv-nl-vag [data-nl-baner]');
  await vänta(100);
  prova('banan: banderollen öppnar väljaren', (await page.getAttribute('#bv-nl-vag [data-nl-baner]', 'aria-expanded')) === 'true'
    && (await page.locator('#bv-nl-vag .nl-valj').count()) === 1);
  const rutor = await namnen();
  prova('väljaren: tre ämnen framme', JSON.stringify(rutor) === JSON.stringify(['Matematik', 'Svenska', 'Engelska']), JSON.stringify(rutor));
  prova('väljaren: Visa fler ämnen säger hur många som är gömda',
    (await text(page, '#bv-nl-vag [data-nl-fler]')).replace(/\s+/g, ' ').trim() === 'Visa fler ämnen 2'
    && (await page.getAttribute('#bv-nl-vag [data-nl-fler]', 'aria-expanded')) === 'false', await text(page, '#bv-nl-vag [data-nl-fler]'));
  await page.click('#bv-nl-vag [data-nl-fler]');
  await vänta(100);
  const alla = await namnen();
  prova('väljaren: fler ämnen visar alla med en bana', JSON.stringify(alla) === JSON.stringify(['Matematik', 'Svenska', 'Engelska', 'Spanska', 'Juridik']), JSON.stringify(alla));
  prova('väljaren: knappen byter till Visa färre och urvalet står kvar',
    (await text(page, '#bv-nl-vag [data-nl-fler]')).includes('Visa färre')
    && (await page.getAttribute('#bv-nl-vag', 'data-amne')) === 'Matematik');
  const ak = await page.$$eval('#bv-nl-vag .nl-ak-knapp', b => b.map(x => x.dataset.nlAk));
  prova('väljaren: årskurserna i det valda ämnet', JSON.stringify(ak) === JSON.stringify(['ak6', 'ak7']), JSON.stringify(ak));
  prova('väljaren: årskurserna är siffror', JSON.stringify(await page.$$eval('#bv-nl-vag .nl-ak-knapp', b => b.map(x => x.textContent.trim()))) === JSON.stringify(['6', '7'])
    && (await text(page, '#bv-nl-vag .nl-ak-grupp > i')) === 'Åk');
  prova('väljaren: elevens egen årskurs är vald och märkt',
    (await page.getAttribute('#bv-nl-vag .nl-ak-knapp[data-nl-ak="ak6"]', 'aria-pressed')) === 'true'
    && (await page.locator('#bv-nl-vag .nl-ak-knapp.egen[data-nl-ak="ak6"]').count()) === 1);
  prova('väljaren: ämnet säger sina årskurser', (await page.getAttribute('#bv-nl-vag .nl-amne[data-nl-amne="Matematik"]', 'aria-label')).includes('Åk 6–7'),
    await page.getAttribute('#bv-nl-vag .nl-amne[data-nl-amne="Matematik"]', 'aria-label'));
  prova('väljaren: NP syns på ämnen med NP-träning', (await page.locator('#bv-nl-vag .nl-amne[data-nl-amne="Matematik"] em').count()) === 1
    && (await page.locator('#bv-nl-vag .nl-amne[data-nl-amne="Svenska"] em').count()) === 0);
  prova('väljaren: inga genvägar', (await page.locator('#bv-nl-vag .nl-senast, #bv-nl-vag .nl-senast-knapp').count()) === 0);
  prova('väljaren: ranken står i toppen', (await text(page, '#bv-nl-vag .nl-rang')).includes('Utforskare')
    && /^Rank /.test(await page.getAttribute('#bv-nl-vag .nl-rang', 'aria-label') || ''), await text(page, '#bv-nl-vag .nl-stat'));
  await page.click('#bv-nl-vag [data-nl-fler]');
  await vänta(100);
  prova('väljaren: Visa färre gömmer dem igen', (await namnen()).length === 3);
  await page.click('#bv-nl-vag .nl-ak-knapp[data-nl-ak="ak7"]');
  await vänta(150);
  prova('väljaren: ett val av årskurs stänger väljaren och byter bana', (await page.locator('#bv-nl-vag .nl-valj').count()) === 0
    && (await page.getAttribute('#bv-nl-vag', 'data-arskurs')) === 'ak7');
  await page.click('#bv-nl-vag [data-nl-baner]');
  await vänta(100);
  await page.click('#bv-nl-vag .nl-ak-knapp[data-nl-ak="ak6"]');
  await vänta(150);
  await page.click('#bv-nl-vag [data-nl-baner]');
  await vänta(100);
  await bild(page, 'nexlax-barn-vag', '#bv-nexlax');

  /* Spelets meny (2026-10-21): Din väg, Din utveckling, Studiehjälparen
     bredvid den, och Rank och märken i en flik. */
  prova('flikarna: fyra delar i spelets meny, Studiehjälparen bredvid Din utveckling',
    JSON.stringify(await page.$$eval('#bv-nexlax .nl-flikar .vy-flik', b => b.map(x => x.dataset.flik)))
    === JSON.stringify(['vag', 'utveckling', 'hjalpare', 'rank']));
  prova('vägen: toppen, remsan, uppdragen och banderollen är ett kort',
    (await page.locator('#bv-nl-vag .nl-kort').count()) === 1
    && (await page.locator('#bv-nl-vag .nl-kort > .nl-topp').count()) === 1
    && (await page.locator('#bv-nl-vag .nl-kort > details.nl-uppdrag').count()) === 1
    && (await page.locator('#bv-nl-vag .nl-kort > .nl-baner').count()) === 1);
  prova('vägen: väljaren står under kortet och säger att vägen går ett steg i taget',
    (await page.locator('#bv-nl-vag .nl-kort + .nl-valj').count()) === 1
    && (await text(page, '#bv-nl-vag .nl-valj')).includes('ett steg i taget'));
  const ljus = await page.evaluate(() => {
    const ljusvärde = el => { const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g).map(Number); return (m[0] + m[1] + m[2]) / 3; };
    const kort = document.querySelector('#bv-nl-vag .nl-kort');
    const bg = getComputedStyle(kort).backgroundImage;
    return { kort: ljusvärde(kort), rad: ljusvärde(document.querySelector('#bv-nexlax .nl-spelrad')), bg };
  });
  prova('vägen: kortet och huvudet är ljusa i ljust läge', ljus.kort > 200 && ljus.rad > 200, JSON.stringify(ljus));
  prova('flikarna: huvudet har NexLäx och ljudet, och menyn står kvar (ingen separat sida)', (await text(page, '#bv-nexlax .nl-spelrad-namn')) === 'NexLäx'
    && (await page.locator('#bv-nexlax .nl-spelrad-ljud svg').count()) === 1 && await synlig(page, '#vy-sido') && (await page.locator('#bv-nexlax .nl-spelrad-ut').count()) === 0);
  const mitt = await page.evaluate(() => {
    const rad = document.querySelector('#bv-nexlax .nl-spelrad').getBoundingClientRect(), t = document.querySelector('#bv-nexlax .nl-spelrad-namn').getBoundingClientRect();
    return { rad: rad.left + rad.width / 2, titel: t.left + t.width / 2 };
  });
  prova('flikarna: NexLäx står i mitten av raden', Math.abs(mitt.rad - mitt.titel) < 1.5, JSON.stringify(mitt));
  prova('flikarna: streak står i stället för dagar', (await text(page, '#bv-nl-vag .nl-serie')).includes('streak') && !(await text(page, '#bv-nl-vag .nl-serie')).includes('dagar'),
    await text(page, '#bv-nl-vag .nl-serie'));
  prova('fortsätt: säger vilket ämne', (await text(page, '#bv-nl-vag .nl-cta-amne')).includes('Åk'), await text(page, '#bv-nl-vag .nl-cta-amne'));
  /* Sidopanelen (2026-10-27): på en bred skärm står dagen bredvid vägen och kortets
     egna uppdrag är dolt; på en smalare är det tvärtom. */
  prova('sidopanel: bred skärm visar dagen bredvid vägen', await synlig(page, '#bv-nl-vag .nl-sida .nl-uppdrag-lista')
    && await synlig(page, '#bv-nl-vag .nl-sida-rang') && !(await synlig(page, '#bv-nl-vag .nl-kort details.nl-uppdrag')));
  await page.setViewportSize({ width: 1000, height: 900 });
  await vänta(150);
  prova('sidopanel: smal skärm döljer den', !(await synlig(page, '#bv-nl-vag .nl-sida')));
  prova('uppdrag: hopfällda, och öppnas med ett tryck', (await page.locator('#bv-nl-vag .nl-kort details.nl-uppdrag[open]').count()) === 0
    && (await page.locator('#bv-nl-vag .nl-kort details.nl-uppdrag').count()) === 1);
  await page.click('#bv-nl-vag .nl-kort details.nl-uppdrag > summary');
  await vänta(100);
  prova('uppdrag: listan syns när man trycker', await synlig(page, '#bv-nl-vag .nl-kort .nl-uppdrag-lista'));
  await page.click('#bv-nl-vag .nl-kort details.nl-uppdrag > summary');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.click('#bv-flik-rank');
  await vänta(250);
  const rk = await page.$$eval('#bv-nl-rank .nl-rk', b => b.map(x => x.className.replace('nl-rk ', '')));
  prova('rank: tio kort i en rad, tre klara, en aktuell', rk.length === 10 && rk.filter(x => x === 'klar').length === 2 && rk.filter(x => x === 'nu').length === 1,
    JSON.stringify(rk));
  const mått = await page.evaluate(() => {
    const rad = document.querySelector('#bv-nl-rank .nl-rank-rad'), nu = rad.querySelector('.nu');
    const r = rad.getBoundingClientRect(), k = nu.getBoundingClientRect();
    const cs = getComputedStyle(rad);
    return { vänster: k.left - r.left, höger: r.right - k.right, scrollLeft: rad.scrollLeft, bredd: rad.clientWidth, innehåll: rad.scrollWidth,
             overflowX: cs.overflowX, overflowY: cs.overflowY };
  });
  prova('rank: den nuvarande ranken syns i raden', mått.vänster >= -1 && mått.höger >= -1, JSON.stringify(mått));
  prova('rank: raden går att svepa i sidled', mått.innehåll > mått.bredd && mått.overflowX === 'auto' && mått.overflowY === 'hidden', JSON.stringify(mått));
  await bild(page, 'nexlax-barn-rank', '#bv-nexlax');
  prova('märken: i samma flik som ranken, under den', await synlig(page, '#bv-nl-marken')
    && await page.evaluate(() => document.querySelector('#bv-nl-rank').getBoundingClientRect().top < document.querySelector('#bv-nl-marken').getBoundingClientRect().top));
  prova('märken: de man har och de man kan få',
    (await page.locator('#bv-nl-marken .upg-marke.klart').count()) > 0 && (await page.locator('#bv-nl-marken .upg-marke:not(.klart)').count()) > 0
    && (await text(page, '#bv-nl-marken .nl-marken-topp')).includes(' av '));
  await bild(page, 'nexlax-barn-marken', '#bv-nexlax');
  await page.click('#bv-flik-utveckling');
  await vänta(150);
  prova('utveckling: en sida, inga sidknappar och inget val', (await page.locator('#bv-nl-utveckling [data-nl-sida], #bv-nl-utveckling [data-nl-del]').count()) === 0);
  prova('utveckling: ranken och märkena har flyttat ut', (await page.locator('#bv-nl-utveckling .nl-rangkort, #bv-nl-utveckling .upg-marken, #bv-nl-utveckling .nl-ranker').count()) === 0);
  const sid1 = await text(page, '#bv-nl-utveckling .nl-sida-kropp');
  prova('utveckling: ämnena och veckorna står på översikten, Rättat är borta', sid1.includes('Dina ämnen') && sid1.includes('XP per vecka')
    && sid1.includes('Uppdrag klara') && !sid1.includes('Rättade nivåer') && !sid1.includes('Område för område'), sid1.slice(0, 300));
  await bild(page, 'nexlax-barn-utveckling', '#bv-nexlax');
  await page.click('#bv-flik-hjalpare');
  await vänta(150);
  prova('studiehjälparen: egen flik, och barnets vy visar ingen bedömning', /studiehjälpar/i.test(await text(page, '#bv-nl-hjalpare'))
    && (await page.locator('#bv-nl-hjalpare').getByText('Studiehjälparens bedömning').count()) === 0, await text(page, '#bv-nl-hjalpare'));
  await bild(page, 'nexlax-barn-hjalpare', '#bv-nexlax');
  await page.click('#bv-flik-vag');
  await vänta(100);

  /* Ut ur NexLäx och in igen: alltid på Din väg. */
  await page.click('#bv-flik-rank');
  await page.click('#vy-sido a[data-sek="oversikt"]');
  await vänta(200);
  prova('NexLäx: ut ur sektionen genom menyn', !(await synlig(page, '#bv-nexlax')) && await synlig(page, '#vy-sido'));
  await page.click('#vy-sido a[data-sek="nexlax"]');
  await vänta(250);
  prova('NexLäx: in igen står man på Din väg', (await page.getAttribute('#bv-flik-vag', 'aria-selected')) === 'true' && await synlig(page, '#bv-panel-vag'));

  /* Vägen har inte NP-nivåerna, och procenten räknar bara vägen. */
  const väg = await text(page, '#bv-nl-vag .nl-vag');
  prova('vägen: NP-träningen står inte på vägen', !väg.includes('Utan räknare') && väg.includes('Jämför bråk'), väg.slice(0, 200));

  /* Ett tryck på juridiken: dess årskurs kommer upp, och banan byts. Hen
     ligger bland de gömda, så Visa fler ämnen först. */
  await page.click('#bv-nl-vag [data-nl-fler]');
  await vänta(100);
  await page.click('#bv-nl-vag .nl-amne[data-nl-amne="Juridik"]');
  await vänta(150);
  prova('väljaren: ett ämne visar sina årskurser och öppnar banan',
    (await page.getAttribute('#bv-nl-vag', 'data-amne')) === 'Juridik' && (await page.getAttribute('#bv-nl-vag', 'data-arskurs')) === 'gy1'
    && JSON.stringify(await page.$$eval('#bv-nl-vag .nl-ak-knapp', b => b.map(x => x.textContent.trim()))) === JSON.stringify(['1']),
    (await page.getAttribute('#bv-nl-vag', 'data-amne')) + ' ' + (await page.getAttribute('#bv-nl-vag', 'data-arskurs')));
  prova('väljaren: juridiken har sin färg och ikon', (await page.getAttribute('#bv-nl-vag', 'data-nl-f')) === 'ju'
    && (await page.locator('#bv-nl-vag .nl-amne[data-nl-amne="Juridik"] svg').count()) === 1);
  prova('väljaren: trycket tickar', (await känt(page)).includes('tryck'), JSON.stringify(await känt(page)));
  prova('väljaren: språket har sin kod i stället för en flagga', (await text(page, '#bv-nl-vag .nl-amne[data-nl-amne="Spanska"] .nl-sprakkod')) === 'ES');
  /* Tillbaka till matematiken: elevens årskurs, och åk 7 med en knapp. */
  if ((await page.locator('#bv-nl-vag .nl-valj').count()) === 0) await page.click('#bv-nl-vag [data-nl-baner]');
  await page.click('#bv-nl-vag .nl-amne[data-nl-amne="Matematik"]');
  await vänta(150);
  prova('väljaren: tillbaka i ämnet står elevens årskurs', (await page.getAttribute('#bv-nl-vag', 'data-arskurs')) === 'ak6');
  await page.click('#bv-nl-vag .nl-ak-knapp[data-nl-ak="ak7"]');
  await vänta(150);
  prova('väljaren: en årskurs byter bana i ämnet', (await page.getAttribute('#bv-nl-vag', 'data-amne')) === 'Matematik'
    && (await page.getAttribute('#bv-nl-vag', 'data-arskurs')) === 'ak7');
  await page.click('#bv-nl-vag [data-nl-baner]');
  await page.click('#bv-nl-vag .nl-ak-knapp[data-nl-ak="ak6"]');
  await vänta(150);

  /* NP-sektionen. */
  prova('NP: knappen finns där banan har NP-träning', await synlig(page, '#bv-nl-vag [data-nl-spar="np"]'));
  await page.click('#bv-nl-vag [data-nl-spar="np"]');
  await vänta(150);
  const np = await text(page, '#bv-nl-vag .nl-np');
  prova('NP: sektionen visar provet och de egna uppgifterna', np.includes('Nationella provet i matematik, åk 6') && np.includes('Nextrums egna'), np.slice(0, 200));
  prova('NP: områdets namn utan NP-träning', np.includes('Blandad träning'), np.slice(0, 300));
  prova('NP: alla nivåer är öppna', (await page.locator('#bv-nl-vag .nl-np-niva:not(.mastare) [data-nl-starta]').count()) === 2);
  prova('NP: provträningen är också öppen', (await page.locator('#bv-nl-vag .nl-np-niva.mastare [data-nl-starta]').count()) === 1
    && (await page.locator('#bv-nexlax .nl-np-niva.last, #bv-nexlax .nl-omr-last').count()) === 0);
  /* Länken ut ur spelet är den enda: tillbaka till Översikt, inom vyn. */
  prova('NP: i barnets vy inga länkar ut', (await page.locator('#bv-nexlax a').count()) === 0,
    await page.locator('#bv-nexlax a').count());
  prova('NP: toppen räknar sektionen', (await text(page, '#bv-nl-vag .nl-baner')).includes('Inför NP'));
  await bild(page, 'nexlax-barn-np', '#bv-nexlax');
  await page.click('#bv-nl-vag [data-nl-spar="vag"]');
  await vänta(150);

  /* Engelska åk 6 har bara NP-nivåer: sektionen står där direkt, utan
     en tom väg och utan knappen mellan dem. Text ur banken ritas som text. */
  if ((await page.locator('#bv-nl-vag .nl-valj').count()) === 0) await page.click('#bv-nl-vag [data-nl-baner]');
  await page.click('#bv-nl-vag .nl-amne[data-nl-amne="Engelska"]');
  await vänta(150);
  prova('NP: en bana med bara NP-nivåer visar sektionen direkt',
    (await page.getAttribute('#bv-nl-vag', 'data-spar')) === 'np' && (await synlig(page, '#bv-nl-vag .nl-np'))
    && (await page.locator('#bv-nl-vag .nl-spar, #bv-nl-vag .nl-vag').count()) === 0,
    await page.getAttribute('#bv-nl-vag', 'data-spar'));
  prova('NP: text ur banken ritas som text', (await page.locator('#bv-nexlax img[data-elak]').count()) === 0
    && (await text(page, '#bv-nl-vag .nl-np')).includes(ELAK));
  if ((await page.locator('#bv-nl-vag .nl-valj').count()) === 0) await page.click('#bv-nl-vag [data-nl-baner]');
  await page.click('#bv-nl-vag .nl-amne[data-nl-amne="Matematik"]');
  await vänta(150);
  prova('NP: tillbaka i matematiken står vägen, som eleven valde', (await page.getAttribute('#bv-nl-vag', 'data-spar')) === 'vag');

  /* Dagens uppdrag. */
  const upp = await text(page, '#bv-nl-vag .nl-uppdrag');
  prova('uppdrag: dagens tre med sina tal', upp.includes('Samla 50 XP') && upp.includes('20/50') && upp.includes('Klara en nivå'), upp.slice(0, 200));
  prova('uppdrag: veckans och månadens', upp.includes('den här veckan') && upp.includes('Månadens utmaning'));
  prova('uppdrag: kistan är stängd', (await page.locator('#bv-nl-vag .nl-kort .nl-kista:not(.oppen)').count()) === 1);
  prova('uppdrag: ingen text säger att något går förlorat', !/förlora|missa|bryts|tappar/i.test(upp), upp);

  /* Ljudet av och på. */
  await page.click('#bv-nl-vag [data-nl-ljud]');
  prova('ljud: av sparas i webbläsaren', (await page.evaluate(() => localStorage.getItem('nx.nexlax.ljud'))) === 'av'
    && (await page.getAttribute('#bv-nl-vag [data-nl-ljud]', 'aria-pressed')) === 'false');
  await page.click('#bv-nl-vag [data-nl-ljud]');
  prova('ljud: på igen', (await page.evaluate(() => localStorage.getItem('nx.nexlax.ljud'))) === 'pa');

  /* Knapparna är tysta (2026-10-13): ett tryck, ett val och ett flikbyte känns men låter inte. */
  await page.evaluate(() => { window.__känt.length = 0; window.__toner = 0; window.__vibb.length = 0; });
  await page.click('#bv-flik-rank');
  await page.click('#bv-flik-vag');
  if ((await page.locator('#bv-nl-vag .nl-valj').count()) === 0) await page.click('#bv-nl-vag [data-nl-baner]');
  await page.click('#bv-nl-vag .nl-amne[data-nl-amne="Svenska"]');
  await page.click('#bv-nl-vag .nl-amne[data-nl-amne="Matematik"]');
  await page.click('#bv-nl-vag [data-nl-baner]');
  const tryckta = await känt(page);
  prova('knappar: tryck och flikbyte känns men har ingen ton', (tryckta.includes('flik') || tryckta.includes('tryck')) && (await page.evaluate(() => window.__toner)) === 0,
    JSON.stringify(tryckta) + ' ' + await page.evaluate(() => window.__toner));
  await page.evaluate(() => { window.__känt.length = 0; window.__toner = 0; window.__vibb.length = 0; });

  /* Spelaren: rätt, fel, rad i rad och resultatet. */
  await page.click('#bv-nl-vag .nl-cta-knapp');
  await page.waitForSelector('.upg-spel .upg-alt', { timeout: 5000 }).catch(() => {});
  prova('spelaren: öppnas med en ljudknapp', await synlig(page, '.upg-spel [data-spel-ljud]'));
  const svara = async val => {
    await page.click('.upg-spel .upg-alt[data-alt="' + val + '"]');
    await page.click('.upg-spel [data-spel="kolla"]');
    await page.waitForSelector('.upg-spel [data-spel="vidare"]', { timeout: 5000 }).catch(() => {});
  };
  await svara(0);
  prova('spelaren: rätt låter och gnistrar', (await känt(page)).includes('ratt') && (await page.evaluate(() => window.__toner)) > 0
    && (await page.locator('.upg-spel .upg-gnistor').count()) === 1, JSON.stringify(await känt(page)));
  prova('spelaren: en dator vibrerar inte och visar inget val för det',
    (await page.evaluate(() => window.__vibb.length)) === 0 && (await page.locator('[data-nl-vibb]').count()) === 0);
  await page.click('.upg-spel [data-spel="vidare"]');
  await svara(0);
  /* Fyra uppgifter är två prickar på vägen (2026-10-27): efter två är första
     delen klar, och Fortsätt hämtar nivån igen och spelar nästa. */
  prova('spelaren: mätaren är delens', (await text(page, '.upg-spel .upg-spel-tal')) === '2/2', await text(page, '.upg-spel .upg-spel-tal'));
  await page.click('.upg-spel [data-spel="vidare"]');
  await page.waitForSelector('.upg-spel .upg-delklar', { timeout: 5000 }).catch(() => {});
  prova('spelaren: första delen klar, med delarna och nästa del ett tryck bort',
    (await text(page, '.upg-spel .upg-delklar')).includes('Del 1 av 2 klar') && (await page.locator('.upg-spel .upg-delklar .nl-delrad i').count()) === 2
    && (await page.locator('.upg-spel [data-spel="nasta-del"]').count()) === 1 && (await känt(page)).includes('upplast'),
    await text(page, '.upg-spel .upg-delklar'));
  await page.click('.upg-spel [data-spel="nasta-del"]');
  await page.waitForSelector('.upg-spel .upg-alt', { timeout: 5000 }).catch(() => {});
  const startAnrop = anrop.filter(a => a[0] === 'niva_starta');
  prova('spelaren: nästa del fortsätter i samma försök', startAnrop.length === 2
    && (await text(page, '.upg-spel .upg-spel-tal')) === '0/2' && (await text(page, '.upg-spel .upg-fraga-text')).includes('Fråga 3'),
    startAnrop.length + ' ' + await text(page, '.upg-spel .upg-fraga-text'));
  await svara(0);
  prova('spelaren: tre i rad säger det', (await text(page, '.upg-spel .upg-besked')).includes('Tre i rad')
    && (await page.locator('.upg-spel.het').count()) === 1, await text(page, '.upg-spel .upg-besked'));
  await bild(page, 'nexlax-spelaren-rad', '.upg-spel');
  await page.click('.upg-spel [data-spel="vidare"]');
  /* Fråga 4 fel: den kommer tillbaka sist, och då rätt. */
  await svara(1);
  prova('spelaren: fel känns, skakar och nollar raden', (await känt(page)).includes('fel')
    && (await page.locator('.upg-spel .upg-fraga.skaka').count()) === 1 && (await page.locator('.upg-spel.het').count()) === 0,
    JSON.stringify(await känt(page)));
  await bild(page, 'nexlax-spelaren-fel', '.upg-spel');
  /* Fel i frågan: fyra skäl, ett tryck skickar, och ett tack. */
  await page.click('.upg-spel [data-fel-oppna]');
  prova('fel i frågan: fyra skäl', (await page.locator('.upg-spel [data-fel-sort]').count()) === 4);
  await page.click('.upg-spel [data-fel-sort="facit"]');
  await page.waitForSelector('.upg-spel .upg-fel-tack', { timeout: 4000 }).catch(() => {});
  const felAnrop = anrop.filter(a => a[0] === 'rapportera_fragefel');
  prova('fel i frågan: skickas med frågan och skälet, och tackar',
    felAnrop.length === 1 && felAnrop[0][1].p_sort === 'facit' && !!felAnrop[0][1].p_fraga
    && (await text(page, '.upg-spel .upg-fel-tack')).includes('Tack'), JSON.stringify(felAnrop));
  await page.click('.upg-spel [data-spel="vidare"]');
  await svara(0);
  await page.click('.upg-spel [data-spel="vidare"]').catch(() => {});
  await page.waitForSelector('.upg-spel .upg-slut', { timeout: 5000 }).catch(() => {});
  await vänta(200);
  prova('resultat: området firas', (await text(page, '.upg-spel .upg-slut-firande')).includes('Du har klarat Bråk'),
    await text(page, '.upg-spel .upg-slut'));
  prova('resultat: konfetti', (await page.locator('.upg-spel .upg-konfetti i').count()) >= 40);
  prova('resultat: XP räknas upp i CSS', (await page.locator('.upg-spel .nl-raknare').count()) === 1
    && (await page.getAttribute('.upg-spel .nl-raknare-ram', 'aria-label')) === '+180');
  await page.waitForSelector('.upg-spel .upg-slut-uppdrag:not([hidden])', { timeout: 5000 }).catch(() => {});
  const ut = await text(page, '.upg-spel .upg-slut-uppdrag');
  prova('resultat: de nya uppdragen och kistan', ut.includes('Uppdrag klara') && ut.includes('Samla 50 XP') && ut.includes('Dagens kista är öppnad'), ut);
  await vänta(6500);
  const ljud = await känt(page);
  prova('resultat: nivån, stjärnorna, området, uppdragen, kistan, märket och den nya ranken låter',
    ['niva', 'stjarna', 'omrade', 'uppdrag', 'kista', 'marke', 'rang'].every(x => ljud.includes(x)), JSON.stringify(ljud));
  prova('resultat: en ny rank visas med namn och emblem', (await text(page, '.upg-spel .upg-slut-rang')).includes('Ny rank') && (await text(page, '.upg-spel .upg-slut-rang')).includes('Tänkare')
    && (await page.locator('.upg-spel .upg-slut-rang svg').count()) === 1, await text(page, '.upg-spel .upg-slut-rang'));
  await bild(page, 'nexlax-resultat', '.upg-spel');

  /* Ljudet av i spelaren: tyst efter det. */
  await page.click('.upg-spel [data-spel-ljud]');
  prova('spelaren: ljudknappen stänger av ljudet', (await page.getAttribute('.upg-spel [data-spel-ljud]', 'aria-pressed')) === 'false'
    && (await page.evaluate(() => localStorage.getItem('nx.nexlax.ljud'))) === 'av');
  await page.click('.upg-spel [data-spel-ljud]');
  await page.click('.upg-spel [data-spel-stang]');
  await page.waitForFunction(() => !document.querySelector('.upg-spel'), null, { timeout: 5000 }).catch(() => {});
  prova('spelaren: stängs, och inga ljud spelas efteråt', !(await synlig(page, '.upg-spel')));

  /* Fripassen (2026-10-27, Leo: "de ska gå att göra de nivåer som är låsta men
     då ska de stå är du säker"): en låst prick frågar, och knappen hoppar dit
     med niva_hoppa. */
  await page.waitForSelector('#bv-nl-vag .upg-nod.last .upg-nod-knapp', { timeout: 5000 }).catch(() => {});
  /* En låst del i en öppen nivå säger "Gör del N först" som förut; provet
     letar upp en nivå som är låst hel. */
  const låsta = page.locator('#bv-nl-vag .upg-nod.last .upg-nod-knapp');
  for (let i = 0, n = await låsta.count(); i < n; i++) {
    /* Ett öppet kort står ovanpå pricken under: trycket går på knappen själv. */
    await låsta.nth(i).evaluate(el => el.click());
    await page.waitForSelector('#bv-nl-vag .upg-nod.vald .upg-nod-kort', { timeout: 3000 }).catch(() => {});
    if (await page.locator('#bv-nl-vag .upg-nod.vald [data-nl-hoppa]').count()) break;
  }
  const låstKort = await text(page, '#bv-nl-vag .upg-nod.vald .upg-nod-kort');
  prova('fripass: en låst prick frågar om man är säker och säger hur många som är kvar',
    låstKort.includes('Är du säker på att du vill göra') && låstKort.includes('5 av 5 kvar den här veckan')
    && (await page.locator('#bv-nl-vag .upg-nod.vald [data-nl-hoppa]').count()) === 1, låstKort);
  await bild(page, 'nexlax-fripass', '#bv-nl-vag .upg-nod.vald .upg-nod-kort');
  const hoppadNiva = await page.getAttribute('#bv-nl-vag .upg-nod.vald [data-nl-hoppa]', 'data-nl-hoppa');
  await page.click('#bv-nl-vag .upg-nod.vald [data-nl-hoppa]');
  await page.waitForSelector('.upg-spel .upg-alt, .upg-spel .upg-fakta-forst', { timeout: 5000 }).catch(() => {});
  /* En nivå i ett nytt område visar faktabladet först, och startas av Jag är redo. */
  if (await page.locator('.upg-spel [data-spel="fakta-klar"]').count()) {
    await page.click('.upg-spel [data-spel="fakta-klar"]');
    await page.waitForSelector('.upg-spel .upg-alt', { timeout: 5000 }).catch(() => {});
  }
  const hopp = anrop.filter(a => a[0] === 'niva_hoppa');
  prova('fripass: knappen startar nivån med niva_hoppa', hopp.length === 1 && hopp[0][1].p_niva === hoppadNiva
    && await synlig(page, '.upg-spel'), JSON.stringify(hopp));
  await page.click('.upg-spel [data-spel-stang]');
  await page.waitForFunction(() => !document.querySelector('.upg-spel'), null, { timeout: 5000 }).catch(() => {});

  /* Din utveckling är en sida, och ranken och märkena har en flik (2026-10-21). */
  await page.click('#bv-flik-rank');
  await vänta(200);
  const rank = await text(page, '#bv-nl-rank');
  prova('rank: ranken med vad som är kvar', rank.includes('Din rank') && /XP kvar till/.test(rank), rank.slice(0, 200));
  prova('rank: alla ranker syns, med den nuvarande', (await page.locator('#bv-nl-rank .nl-rk').count()) === 10
    && (await page.locator('#bv-nl-rank .nl-rk.nu').count()) === 1 && (await page.locator('#bv-nl-rank .nl-rk.klar').count()) === 3);
  prova('rank: varje rank utom den första har ett märke', (await page.locator('#bv-nl-rank .nl-rk-pris:not(.nl-rk-start)').count()) === 9);
  const märk = await text(page, '#bv-nl-marken');
  prova('märken: märkena för uppdragen', märk.includes('Första uppdraget') && märk.includes('Dagens kista'));
  prova('märken: rankmärkena har en egen grupp', märk.includes('Rankmärken') && märk.includes('Märket') === false
    && (await page.locator('#bv-nl-marken .upg-marke').filter({ hasText: 'Upptäckare' }).count()) === 1);
  await page.click('#bv-flik-utveckling');
  await vänta(200);
  const utv = await text(page, '#bv-nl-utveckling');
  prova('utveckling: siffrorna och höjdpunkterna på översikten', utv.includes('I siffror') && utv.includes('Höjdpunkter') && utv.includes('Hela området Bråk klart'), utv.slice(0, 400));
  prova('utveckling: uppdragen i siffror på översikten', utv.includes('Uppdrag klara') && utv.includes('Kistor öppnade'));
  await bild(page, 'nexlax-utveckling', '#bv-nexlax');
  await page.click('#bv-flik-vag');
  await vänta(100);

  /* Profilen: rank, XP och märken att visa upp. */
  await page.click('a[data-sek="profil"]').catch(() => {});
  await vänta(250);
  const prof = await text(page, '#bv-nl-profil');
  prova('profilen: rank, XP och märken syns', prof.includes('Tänkare') && prof.includes('XP') && (await page.locator('#bv-nl-profil .nl-prof-marken li').count()) > 0
    && !prof.includes('Rank:') , prof.slice(0, 200));
  await bild(page, 'nexlax-barn-profil', 'section[data-sek="profil"]');

  prova('barnet: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  const fel = konsol.filter(t => !/Failed to load resource/.test(t));
  prova('barnet: inga fel i konsolen', fel.length === 0, fel.join(' | ').slice(0, 300));
  await context.close();
}

/* ============ rörelse bortvald, telefonen och mörkt läge ============ */
async function provaTelefonen(webb) {
  for (const [namn, ctx] of [
    ['telefon', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
    ['telefon-mork', { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, colorScheme: 'dark' }],
    ['lugn', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }]
  ]) {
    const { rpc } = nexlaxRpc();
    const { context, page } = await öppna(webb, { rpc, inloggad: 'barnkonto-1', context: ctx });
    await tillBarnetsVag(page);
    const bredd = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    prova(namn + ': ingen sidledsscroll', bredd <= 0, bredd + ' px');
    const små = await page.evaluate(() => Array.from(document.querySelectorAll('#bv-nexlax button'))
      .filter(b => b.offsetParent).map(b => ({ t: b.textContent.trim().slice(0, 20), h: b.getBoundingClientRect().height }))
      .filter(r => r.h < 44));
    prova(namn + ': tryckytorna är minst 44 px', små.length === 0, JSON.stringify(små).slice(0, 300));
    await page.click('#bv-nl-vag [data-nl-spar="np"]');
    await vänta(150);
    const bredd2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    prova(namn + ': NP-sektionen ryms', bredd2 <= 0, bredd2 + ' px');
    await bild(page, 'nexlax-' + namn);
    if (namn === 'lugn') {
      await page.click('#bv-nl-vag [data-nl-spar="vag"]');
      await page.click('#bv-nl-vag .nl-cta-knapp');
      await page.waitForSelector('.upg-spel .upg-alt', { timeout: 5000 }).catch(() => {});
      for (let i = 0; i < 14; i++) {
        if (await synlig(page, '.upg-spel .upg-slut')) break;
        if (await synlig(page, '.upg-spel [data-spel="vidare"]')) { await page.click('.upg-spel [data-spel="vidare"]'); continue; }
        /* Nivån är två prickar: efter den första kommer Fortsätt till nästa. */
        if (await synlig(page, '.upg-spel [data-spel="nasta-del"]')) {
          await page.click('.upg-spel [data-spel="nasta-del"]');
          await page.waitForSelector('.upg-spel .upg-alt', { timeout: 5000 }).catch(() => {});
          continue;
        }
        await page.click('.upg-spel .upg-alt[data-alt="0"]').catch(() => {});
        await page.click('.upg-spel [data-spel="kolla"]').catch(() => {});
        await page.waitForSelector('.upg-spel [data-spel="vidare"]', { timeout: 3000 }).catch(() => {});
      }
      await page.waitForSelector('.upg-spel .upg-slut', { timeout: 5000 }).catch(() => {});
      prova('lugn: ingen konfetti med rörelse bortvald', (await page.locator('.upg-spel .upg-konfetti').count()) === 0);
      prova('lugn: telefonen vibrerar vid svaren', (await page.evaluate(() => window.__vibb.length)) > 0,
        await page.evaluate(() => JSON.stringify(window.__vibb)));
      const xp = await page.evaluate(() => {
        const r = document.querySelector('.upg-spel .nl-raknare');
        return r ? getComputedStyle(r).animationName + ' / ' + getComputedStyle(r).counterReset : null;
      });
      prova('lugn: talet står där direkt', xp === 'none / nl-n 180', String(xp));
      await bild(page, 'nexlax-lugn-resultat', '.upg-spel');
    }
    await context.close();
  }
}

/* ============ studievyn: samma väg, och länkarna till provgrupperna ============ */
async function provaStudievyn(webb) {
  const { rpc } = nexlaxRpc();
  const forsok = [];
  const tabeller = {
    profiles: [{ id: 'foralder-1', role: 'parent', full_name: 'Anna Andersson', email: 'anna@example.se', is_admin: false,
                 match_status: 'matched', matched_tutor_id: 'handledare-1', created_at: '2026-09-01T10:00:00Z' },
               { id: 'handledare-1', role: 'tutor', full_name: 'Sara Svensson', email: 'sara@example.se', is_admin: false,
                 created_at: '2026-09-01T10:00:00Z' }],
    students: [{ id: 'barn-1', parent_id: 'foralder-1', name: 'Alva', grade: 'Åk 6', subjects: ['Matematik'],
                 matched_tutor_id: 'handledare-1', match_status: 'matched', created_at: '2026-09-01T10:00:00Z' }],
    nivaer: KATALOG,
    niva_forsok: forsok
  };
  const { context, page, riktiga, konsol } = await öppna(webb, { rpc, inloggad: 'foralder-1', tabeller });
  await page.goto(BAS + '/foralder#nexlax');
  await page.waitForSelector('#view-app:not([hidden])', { timeout: 8000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelector('#nl-vag .nl-baner'), null, { timeout: 8000 }).catch(() => {});
  prova('studievyn: väljaren och uppdragen', await synlig(page, '#nl-vag .nl-baner') && await synlig(page, '#nl-vag .nl-sida .nl-uppdrag'));
  await page.click('#nl-vag [data-nl-spar="np"]').catch(() => {});
  await vänta(200);
  const länkar = await page.$$eval('#nl-vag .nl-np-lank', a => a.map(x => [x.getAttribute('href'), x.getAttribute('target'), x.getAttribute('rel')]));
  prova('studievyn: NP-sektionen länkar till provgruppen i en ny flik',
    länkar.length === 1 && /^https:\/\/www\.su\.se\//.test(länkar[0][0]) && länkar[0][1] === '_blank' && /noopener/.test(länkar[0][2]),
    JSON.stringify(länkar));
  prova('studievyn: och säger varför proven inte står här', (await text(page, '#nl-vag .nl-np-lankar')).includes('upphovsrätten'));
  await bild(page, 'nexlax-studievyn-np', 'section[data-sek="nexlax"]');
  prova('studievyn: inget anrop mot den riktiga Supabase', riktiga.length === 0, riktiga.join(', '));
  const fel = konsol.filter(t => !/Failed to load resource/.test(t));
  prova('studievyn: inga fel i konsolen', fel.length === 0, fel.join(' | ').slice(0, 300));
  await context.close();
}

(async function () {
  const server = spawn('python3', [path.join(ROT, '.claude', 'serve.py'), String(PORT)], { stdio: 'ignore' });
  let klar = false;
  for (let i = 0; i < 50 && !klar; i++) {
    try { klar = (await fetch(BAS + '/barn')).ok; } catch (e) { await vänta(100); }
  }
  const webb = await pw.chromium.launch();
  try {
    await provaBarnet(webb);
    await provaTelefonen(webb);
    await provaStudievyn(webb);
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
