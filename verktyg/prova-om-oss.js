/* ============================================================
   NEXTRUM — webbläsarprov för Om oss (2026-10-22, grenen om-oss-sida)

       NODE_PATH="$(npm root -g)" node verktyg/prova-om-oss.js

   Provet går igenom:
   · /om-oss och startsidan i tre bredder (1440, 820, 390) och båda
     lägena: inga fel i konsolen, ingen sidledsrullning, och inga anrop
     utanför localhost från Om oss (det är barn på sajten). Startsidan
     frågar Supabase som förut (planerna, studiehjälparna); de anropen
     besvaras tomt här och är de enda som går ut;
   · med reducerad rörelse står varje rubrik i Om oss framme utan att
     någon rullat dit;
   · startsidan har inget exempel kvar (#exempel togs bort 2026-10-26,
     Leo: "ta bort den"), och inget på den pekar dit;
   · knapparna till intresseanmälan bär rätt utm, och länken i Vi är nya
     går till studievyn på För elever och föräldrar;
   · nextrum-om-oss.css hämtar ingenting.
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
      const { ctx, p, ute, konsol } = await öppna(webb, '/', { w, cs });
      prova('startsidan ' + namn + ': inga fel i konsolen', konsol.length === 0, konsol.join(' / '));
      prova('startsidan ' + namn + ': ingen sidledsrullning', (await sidledes(p)) <= 0, await sidledes(p));
      const andra = ute.filter(u => !SUPABASE_REST.test(u));
      prova('startsidan ' + namn + ': bara Supabase som förut utanför localhost', andra.length === 0, andra.join(', '));
      const ex = await p.evaluate(() => ({
        sektion: !!document.getElementById('exempel'),
        länkar: document.querySelectorAll('a[href*="#exempel"]').length,
        filer: [...document.querySelectorAll('link[href*="exempel"],script[src*="exempel"]')].length
      }));
      prova('startsidan ' + namn + ': inget exempel kvar och inget som pekar dit',
        !ex.sektion && ex.länkar === 0 && ex.filer === 0, JSON.stringify(ex));
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

async function provaLänkarna(webb) {
  const fall = [
    ['/om-oss', 'main a[href*="intresseanmalan"]', '/intresseanmalan?' + UTM_OM]
  ];
  for (const [url, väljare, väntat] of fall) {
    const { ctx, p } = await öppna(webb, url, { w: 1440 });
    const hrefs = await p.$$eval(väljare, as => as.map(a => a.getAttribute('href')));
    prova('utm ' + url + ': ' + hrefs.length + ' knappar till intresseanmälan, alla med ' + väntat,
      hrefs.length > 0 && hrefs.every(h => h === väntat), hrefs.join(', '));
    await ctx.close();
  }
  const { ctx, p } = await öppna(webb, '/om-oss', { w: 1440 });
  const nya = await p.$$eval('[data-vi-ar-nya] a', as => as.map(a => a.getAttribute('href')));
  prova('Vi är nya: länken går till studievyn på För elever och föräldrar',
    nya.length === 1 && nya[0] === '/for-elever-och-foraldrar', nya.join(', '));
  await ctx.close();
  const svar = await fetch(BAS + '/for-elever-och-foraldrar');
  prova('/for-elever-och-foraldrar finns', svar.ok, svar.status);
  const allaOmOss = fs.readFileSync(path.join(ROT, 'om-oss.html'), 'utf8');
  prova('om-oss.html pekar inte på #exempel', !/href="[^"]*#exempel"/.test(allaOmOss));
}

function provaFilerna() {
  for (const f of ['nextrum-om-oss.css']) {
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
