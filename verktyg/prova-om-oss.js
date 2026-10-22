/* ============================================================
   NEXTRUM — webbläsarprov för Om oss och exemplen på startsidan
   (2026-10-22, grenen om-oss-sida)

       NODE_PATH="$(npm root -g)" node verktyg/prova-om-oss.js

   Provet går igenom:
   · /om-oss och startsidan i tre bredder (1440, 820, 390) och båda
     lägena: inga fel i konsolen, ingen sidledsrullning, och inga anrop
     utanför localhost från Om oss (det är barn på sajten). Startsidan
     frågar Supabase som förut (planerna, studiehjälparna); de anropen
     besvaras tomt här och är de enda som går ut;
   · med reducerad rörelse står varje rubrik i Om oss framme utan att
     någon rullat dit;
   · flikarna i #exempel: WAI-ARIA:s roller, en panel i taget, klick,
     piltangenterna åt båda hållen och runt, Home och End, och Tab till
     panelen;
   · utan JavaScript: de tre delarna står under varandra med sina
     rubriker, och inga flikar syns;
   · knapparna till intresseanmälan bär rätt utm, på båda språken;
   · nextrum-exempel.js och -css hämtar ingenting.
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
const PORT = 8989;
const BAS = 'http://localhost:' + PORT;
const SUPABASE_REST = /^https:\/\/[a-z0-9]+\.supabase\.co\/rest\/v1\//;

const BREDDER = [1440, 820, 390];
const LÄGEN = ['light', 'dark'];
const UTM_OM = 'utm_source=om-oss&utm_medium=sajt&utm_campaign=okt26';
const UTM_EX = 'utm_source=startsida&utm_medium=sajt&utm_campaign=okt26&utm_content=exempel';

const utfall = [];
function prova(namn, ok, detalj) {
  utfall.push({ namn, ok: !!ok, detalj: ok ? '' : String(detalj == null ? '' : detalj) });
}
const vänta = ms => new Promise(r => setTimeout(r, ms));

/* En sida i ett eget sammanhang. Allt utanför localhost räknas och
   stoppas; Supabases REST besvaras tomt så att startsidan ritar som
   utan data och inget når driften. */
async function öppna(webb, url, o) {
  const ctx = await webb.newContext({
    viewport: { width: o.w, height: o.w < 600 ? 844 : 900 }, colorScheme: o.cs || 'light',
    isMobile: o.w < 600, hasTouch: o.w < 600, reducedMotion: o.rörelse || 'no-preference',
    javaScriptEnabled: o.js !== false
  });
  const ute = [], konsol = [];
  await ctx.route(u => !String(u).startsWith(BAS), r => {
    const u = r.request().url();
    ute.push(u);
    if (SUPABASE_REST.test(u)) {
      return r.fulfill({ status: 200, contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: '[]' });
    }
    return r.abort();
  });
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error') konsol.push(m.text()); });
  p.on('pageerror', e => konsol.push('pageerror: ' + e.message));
  await p.goto(BAS + url, { waitUntil: 'networkidle' });
  await vänta(300);
  return { ctx, p, ute, konsol };
}

async function sidledes(p) {
  return p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

async function provaBredder(webb) {
  for (const w of BREDDER) for (const cs of LÄGEN) {
    const namn = w + ' ' + (cs === 'dark' ? 'mörkt' : 'ljust');
    {
      const { ctx, p, ute, konsol } = await öppna(webb, '/om-oss', { w, cs });
      // Rulla igenom sidan, så att allt som tonar in har gjort det.
      await p.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); }
      });
      await vänta(400);
      prova('om-oss ' + namn + ': inga fel i konsolen', konsol.length === 0, konsol.join(' / '));
      prova('om-oss ' + namn + ': ingen sidledsrullning', (await sidledes(p)) <= 0, await sidledes(p));
      prova('om-oss ' + namn + ': inga anrop utanför localhost', ute.length === 0, ute.join(', '));
      await ctx.close();
    }
    {
      const { ctx, p, ute, konsol } = await öppna(webb, '/#exempel', { w, cs });
      prova('startsidan ' + namn + ': inga fel i konsolen', konsol.length === 0, konsol.join(' / '));
      prova('startsidan ' + namn + ': ingen sidledsrullning', (await sidledes(p)) <= 0, await sidledes(p));
      const andra = ute.filter(u => !SUPABASE_REST.test(u));
      prova('startsidan ' + namn + ': bara Supabase som förut utanför localhost', andra.length === 0, andra.join(', '));
      const ex = await p.evaluate(() => {
        const s = document.getElementById('exempel');
        const r = s.getBoundingClientRect();
        return { bred: r.width, flikar: s.querySelectorAll('[role="tab"]').length };
      });
      prova('startsidan ' + namn + ': exemplen står med tre flikar', ex.bred > 0 && ex.flikar === 3, JSON.stringify(ex));
      await ctx.close();
    }
  }
}

async function provaRörelsen(webb) {
  const { ctx, p } = await öppna(webb, '/om-oss', { w: 1440, rörelse: 'reduce' });
  const dolda = await p.evaluate(() => [...document.querySelectorAll('main h1, main h2')]
    .filter(h => {
      let e = h;
      while (e) { if (parseFloat(getComputedStyle(e).opacity) < 1) return true; e = e.parentElement; }
      return false;
    }).map(h => h.textContent.trim().slice(0, 30)));
  prova('om-oss med reducerad rörelse: varje rubrik står framme utan rullning', dolda.length === 0, dolda.join(' | '));
  await ctx.close();
}

async function provaFlikarna(webb) {
  const { ctx, p } = await öppna(webb, '/#exempel', { w: 1440 });
  const läge = () => p.evaluate(() => {
    const s = document.getElementById('exempel');
    const lista = s.querySelector('[role="tablist"]');
    const flikar = [...s.querySelectorAll('[role="tab"]')];
    return {
      lista: !!lista, namn: lista && lista.getAttribute('aria-labelledby'),
      valda: flikar.map(f => f.getAttribute('aria-selected')),
      tabbar: flikar.map(f => f.tabIndex),
      synliga: [...s.querySelectorAll('[role="tabpanel"]')].map(x => !x.hidden && x.getBoundingClientRect().height > 0),
      kopplade: flikar.every(f => {
        const pnl = document.getElementById(f.getAttribute('aria-controls'));
        return pnl && pnl.getAttribute('aria-labelledby') === f.id;
      }),
      fokus: document.activeElement && (document.activeElement.dataset.exFlik || document.activeElement.id || document.activeElement.tagName)
    };
  });
  let l = await läge();
  prova('flikarna: tablist med sektionens rubrik som namn', l.lista && l.namn === 'ex-t', JSON.stringify(l));
  prova('flikarna: tab och tabpanel är kopplade åt båda hållen', l.kopplade);
  prova('flikarna: rapporten vald först, bara den i tabbordningen och bara dess panel synlig',
    l.valda.join() === 'true,false,false' && l.tabbar.join() === '0,-1,-1' && l.synliga.join() === 'true,false,false', JSON.stringify(l));

  await p.click('#exempel [data-ex-flik="plan"]');
  l = await läge();
  prova('flikarna: klick på Studieplan byter panel', l.valda.join() === 'false,true,false' && l.synliga.join() === 'false,true,false', JSON.stringify(l));

  await p.focus('#exempel [data-ex-flik="rapport"]');
  await p.keyboard.press('ArrowRight');
  l = await läge();
  prova('flikarna: högerpil går till nästa och väljer den', l.fokus === 'plan' && l.valda.join() === 'false,true,false', JSON.stringify(l));
  await p.keyboard.press('ArrowRight');
  await p.keyboard.press('ArrowRight');
  l = await läge();
  prova('flikarna: högerpil från den sista går runt till den första', l.fokus === 'rapport' && l.valda.join() === 'true,false,false', JSON.stringify(l));
  await p.keyboard.press('ArrowLeft');
  l = await läge();
  prova('flikarna: vänsterpil från den första går runt till den sista', l.fokus === 'vy' && l.valda.join() === 'false,false,true', JSON.stringify(l));
  await p.keyboard.press('Home');
  l = await läge();
  prova('flikarna: Home går till den första', l.fokus === 'rapport' && l.valda.join() === 'true,false,false', JSON.stringify(l));
  await p.keyboard.press('End');
  l = await läge();
  prova('flikarna: End går till den sista', l.fokus === 'vy' && l.valda.join() === 'false,false,true', JSON.stringify(l));
  await p.keyboard.press('Tab');
  l = await läge();
  prova('flikarna: Tab går från fliken till panelen', l.fokus === 'ex-vy', JSON.stringify(l));
  await ctx.close();
}

async function provaUtanSkript(webb) {
  for (const url of ['/', '/en/']) {
    const { ctx, p } = await öppna(webb, url + '#exempel', { w: 390, js: false });
    const l = await p.evaluate(() => {
      const s = document.getElementById('exempel');
      const synlig = e => !!e && e.getBoundingClientRect().height > 0 && getComputedStyle(e).visibility !== 'hidden';
      return {
        flikar: synlig(s.querySelector('[data-ex-flikar]')),
        roller: s.querySelectorAll('[role="tab"],[role="tabpanel"]').length,
        paneler: [...s.querySelectorAll('[data-ex-panel]')].map(synlig),
        rubriker: [...s.querySelectorAll('.ex-panel-rubrik')].map(synlig)
      };
    });
    prova('utan skript ' + url + ': tre delar under varandra med rubriker, inga flikar',
      !l.flikar && l.roller === 0 && l.paneler.join() === 'true,true,true' && l.rubriker.join() === 'true,true,true', JSON.stringify(l));
    await ctx.close();
  }
}

async function provaLänkarna(webb) {
  const fall = [
    ['/om-oss', 'main a[href*="intresseanmalan"]', '/intresseanmalan?' + UTM_OM],
    ['/', '#exempel a[href*="intresseanmalan"]', '/intresseanmalan?' + UTM_EX],
    ['/en/', '#exempel a[href*="intresseanmalan"]', '/en/intresseanmalan?' + UTM_EX]
  ];
  for (const [url, väljare, väntat] of fall) {
    const { ctx, p } = await öppna(webb, url, { w: 1440 });
    const hrefs = await p.$$eval(väljare, as => as.map(a => a.getAttribute('href')));
    prova('utm ' + url + ': ' + hrefs.length + ' knappar till intresseanmälan, alla med ' + väntat,
      hrefs.length > 0 && hrefs.every(h => h === väntat), hrefs.join(', '));
    await ctx.close();
  }
}

function provaFilerna() {
  for (const f of ['nextrum-exempel.js', 'nextrum-exempel.css', 'nextrum-om-oss.css']) {
    const s = fs.readFileSync(path.join(ROT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const träff = s.match(/https?:|\/\/[a-z]|fetch\(|XMLHttpRequest|sendBeacon|@import|url\(|WebSocket|localStorage|document\.cookie/);
    prova(f + ' hämtar och sparar ingenting', !träff, träff && träff[0]);
  }
}

(async function () {
  const server = spawn('python3', [path.join(ROT, '.claude', 'serve.py'), String(PORT)], { stdio: 'ignore' });
  let klar = false;
  for (let i = 0; i < 50 && !klar; i++) {
    try { klar = (await fetch(BAS + '/om-oss')).ok; } catch (e) { await vänta(100); }
  }
  const webb = await pw.chromium.launch();
  try {
    await provaBredder(webb);
    await provaRörelsen(webb);
    await provaFlikarna(webb);
    await provaUtanSkript(webb);
    await provaLänkarna(webb);
    provaFilerna();
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
