/* ============================================================
   NEXTRUM — delningsbilderna (2026-10-07)

       NODE_PATH="$(npm root -g)" node verktyg/bygg-delningsbilder.js

   En bild per öppen sida, 1200 × 630, som visas när någon delar länken
   i en föräldragrupp, i WhatsApp eller på Facebook. Förut visades bara
   ett foto; nu står sidans rubrik och en rad med priset ovanpå fotot,
   så att länken säger vad den leder till innan någon klickar.

   Sidorna är de som står i sitemap.xml. Bilderna hamnar i
   delning/<sida>.jpg (en/<sida> blir en-<sida>.jpg, startsidan index),
   och vad som står i dem skrivs till delning/innehall.json.

   Körs för hand, som bygg-introbilder.js: när en rubrik eller priset
   ändras, och när en sida kommer till. Inte i CI, för det kräver
   Chromium. kolla-delningsbilder.py vaktar i CI att varje sida pekar
   på sin bild och att rubriken och priset i innehall.json är sidans
   och nextrum-config.js:s. En delningsbild med ett gammalt pris är
   samma sak som en sida med ett gammalt pris.

   Fotot är det sidan delade förut (og:image), och står sedan kvar i
   innehall.json. En ny sida får det första fotot i sin <main>.
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
const MAPP = path.join(ROT, 'delning');
const INNEHALL = path.join(MAPP, 'innehall.json');
const PORT = 8967;
const BAS = 'http://127.0.0.1:' + PORT;
const vänta = ms => new Promise(r => setTimeout(r, ms));

const config = fs.readFileSync(path.join(ROT, 'nextrum-config.js'), 'utf8');
const PRIS = Number((config.match(/PRIS_PER_TIMME:\s*(\d+)/) || [])[1]);
if (!PRIS) { console.error('Hittar inte PRIS_PER_TIMME i nextrum-config.js.'); process.exit(1); }

/* Samma regel som kolla-delningsbilder.py: taggarna bort, <br> blir
   mellanslag, tecknen avkodas och blanktecknen slås ihop. */
function rubrikUr(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (!m) return null;
  return m[1].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

function sidorIKartan() {
  const karta = fs.readFileSync(path.join(ROT, 'sitemap.xml'), 'utf8');
  return [...karta.matchAll(/<loc>https:\/\/nextrum\.se\/([^<]*)<\/loc>/g)].map(m => {
    const v = m[1];
    if (v === '') return 'index.html';
    if (v === 'en/') return 'en/index.html';
    return v + '.html';
  });
}

const namnPå = fil => fil.replace(/^en\//, 'en-').replace(/\.html$/, '');

/* Raden under rubriken. Priset står bara där sidan handlar om läxhjälp:
   en guide, villkoren och jobbsidan säger något annat. */
function radFör(fil, html, en) {
  const sida = fil.replace(/^en\//, '').replace(/\.html$/, '');
  if (sida === 'bli-studiehjalpare') return en ? 'Work as a tutor · Nextrum' : 'Jobba som studiehjälpare · Nextrum';
  if (['anvandarvillkor', 'integritetspolicy', 'lagring'].includes(sida)) {
    return en ? 'Nextrum · tutoring in Stockholm' : 'Nextrum · läxhjälp i Stockholm';
  }
  if (html.includes('>Guide för föräldrar</span>')) return 'Guide för föräldrar · Nextrum';
  return en ? `Tutoring in Stockholm · SEK ${PRIS} an hour` : `Läxhjälp i Stockholm · ${PRIS} kr i timmen`;
}

function fotoFör(fil, html, förut) {
  if (förut && förut.foto) return förut.foto;
  const og = html.match(/og:image" content="https:\/\/nextrum\.se\/bilder\/([a-z0-9-]+)-1280\.jpg"/);
  if (og) return og[1];
  const kropp = html.split('<main')[1] || '';
  const m = kropp.match(/bilder\/([a-z0-9-]+)-1280\.jpg/);
  return m ? m[1] : 'hero-nextrum';
}

const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function mall(rubrik, rad, foto) {
  const storlek = rubrik.length <= 26 ? 78 : rubrik.length <= 44 ? 66 : 56;
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${BAS}/nextrum-typsnitt.css">
<style>
  html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #1A1813; }
  .bild { position: absolute; inset: 0; background: url(${BAS}/bilder/${foto}-1280.jpg) center / cover no-repeat; }
  .ton { position: absolute; inset: 0;
    background: linear-gradient(90deg, rgba(26,24,19,.94) 0%, rgba(26,24,19,.82) 42%, rgba(26,24,19,.30) 78%, rgba(26,24,19,.12) 100%); }
  .text { position: absolute; left: 72px; right: 300px; top: 64px; bottom: 64px;
    display: flex; flex-direction: column; justify-content: space-between;
    font-family: 'Schibsted Grotesk', system-ui, sans-serif; color: #F2EDE3; }
  .namn { display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 700; letter-spacing: -.01em; }
  .namn img { width: 40px; height: 40px; border-radius: 9px; }
  h1 { margin: 0; font-size: ${storlek}px; line-height: 1.04; font-weight: 700; letter-spacing: -.025em; text-wrap: balance; }
  .rad { margin-top: 26px; font-size: 28px; font-weight: 500; color: #C08A2E; }
</style></head><body>
<div class="bild"></div><div class="ton"></div>
<div class="text">
  <div class="namn"><img src="${BAS}/apple-touch-icon.png" alt="">Nextrum</div>
  <div><h1>${esc(rubrik)}</h1><div class="rad">${esc(rad)}</div></div>
</div>
</body></html>`;
}

async function main() {
  const förut = fs.existsSync(INNEHALL) ? JSON.parse(fs.readFileSync(INNEHALL, 'utf8')).sidor || {} : {};
  fs.mkdirSync(MAPP, { recursive: true });

  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', ROT],
                       { stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) {
      try { const r = await fetch(BAS + '/nextrum-typsnitt.css'); if (r.ok) break; } catch (e) { /* inte uppe än */ }
      await vänta(100);
    }
    const webbläsare = await pw.chromium.launch();
    const sida = await webbläsare.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    // Mallen serveras från serverns origin: typsnittet hämtas annars från
    // en annan origin utan CORS, och då ritas bilden med reservtypsnittet.
    let aktuell = '';
    await sida.route(BAS + '/__mall*', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: aktuell }));
    let nr = 0;
    const sidor = {};
    for (const fil of sidorIKartan()) {
      const html = fs.readFileSync(path.join(ROT, fil), 'utf8');
      const en = /<html lang="en"/.test(html);
      const rubrik = rubrikUr(html);
      if (!rubrik) { console.error('ingen <h1> i ' + fil); process.exitCode = 1; continue; }
      const rad = radFör(fil, html, en);
      const foto = fotoFör(fil, html, förut[fil]);
      const namn = namnPå(fil);
      aktuell = mall(rubrik, rad, foto);
      await sida.goto(BAS + '/__mall?' + (++nr), { waitUntil: 'load' });
      await sida.evaluate(() => document.fonts.ready);
      if (!await sida.evaluate(() => document.fonts.check('700 40px "Schibsted Grotesk"'))) {
        throw new Error('typsnittet laddades inte, bilden hade fått fel typsnitt');
      }
      await vänta(60);
      await sida.screenshot({ path: path.join(MAPP, namn + '.jpg'), type: 'jpeg', quality: 84 });
      sidor[fil] = { bild: 'delning/' + namn + '.jpg', rubrik, rad, foto };
      console.log('  ' + namn + '.jpg  ' + rubrik);
    }
    await webbläsare.close();
    fs.writeFileSync(INNEHALL, JSON.stringify({ pris: PRIS, sidor }, null, 2) + '\n');
    console.log(Object.keys(sidor).length + ' delningsbilder i delning/. Kör sedan verktyg/kolla-delningsbilder.py.');
  } finally {
    server.kill();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
