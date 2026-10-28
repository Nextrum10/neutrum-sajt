/* ============================================================
   NEXTRUM — loggans filer (2026-10-15)

       NODE_PATH="$(npm root -g)" node verktyg/bygg-logga.js

   Källan är bilder/nextrum-logga.svg, spårad ur Leos logga. Härifrån
   ritas allt som bara visar märket:

     favicon.svg                    fliken; brunt blir kräm i mörkt läge
     favicon-48.png, favicon-96.png ikonen bredvid träffen hos Google
     apple-touch-icon.png           iOS hemskärm (ogenomskinlig, iOS rundar själv)
     bilder/nextrum-logo-512.png    strukturerad data och loggan i mejlen
     bilder/nextrum-logo-profil.png profilbilden på info@ (DEPLOY-EPOST.md 5)
     bilder/nextrum-logo-bimi.svg   BIMI, SVG Tiny PS (DEPLOY-EPOST.md 5)
     bilder/nextrum-logo-signatur.png  hela loggan i Gmail-signaturen för info@

   PNG:erna står på papperet (#F1EDE6) ända ut i kanten: Google och
   Gmail beskär till en cirkel, och en genomskinlig ikon blir brun på
   svart i mörkt läge. Märket tar en mindre del av rutan där cirkeln
   skär (profilbilden, BIMI), så att hörnen aldrig kapas.

   Sidornas inline-svg (sidhuvudet, footern, maskoten, affischen) har
   samma vägar men skrivs inte härifrån. Byts loggan: spåra om källan,
   byt vägarna i sidorna (var-ide.html är områdessidornas skal) och
   kör det här. Körs för hand, inte i CI, för det kräver Chromium.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

let pw;
try { pw = require('playwright'); } catch (e) {
  console.error('Hittar inte Playwright. Kör med NODE_PATH="$(npm root -g)".');
  process.exit(2);
}

const ROT = path.dirname(__dirname);
const KALLA = path.join(ROT, 'bilder', 'nextrum-logga.svg');
const BRUN = '#643820', ORANGE = '#F88740', PAPPER = '#F1EDE6', KRAM = '#EFE6D6';
// Märkets mått i källans enheter (se kommentaren i källan).
const MW = 223.5, MH = 169.5;

const källa = fs.readFileSync(KALLA, 'utf8');
function väg(id) {
  const m = källa.match(new RegExp('<path id="' + id + '"[^>]*\\sd="([^"]+)"'));
  if (!m) { console.error('Hittar inte ' + id + ' i ' + KALLA); process.exit(1); }
  return m[1];
}
const BRUN_D = väg('mark-brun'), ORANGE_D = väg('mark-orange');
const ORD_D = väg('ord'), SLOGAN_D = väg('slogan');
const ORD_FLYTT = (källa.match(/<path id="ord"[^>]*\stransform="([^"]+)"/) || [])[1] || '';

/* Märket mitt i en kvadrat med sidan s, andel av bredden som märket tar. */
function placering(s, andel) {
  const k = s * andel / MW;
  const x = (s - MW * k) / 2, y = (s - MH * k) / 2;
  const r = v => Math.round(v * 1000) / 1000;
  return 'translate(' + r(x) + ' ' + r(y) + ') scale(' + r(k) + ')';
}

function ruta(s, andel, bakgrund) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + s + ' ' + s + '" width="' + s + '" height="' + s + '">' +
    (bakgrund ? '<rect width="' + s + '" height="' + s + '" fill="' + bakgrund + '"/>' : '') +
    '<g transform="' + placering(s, andel) + '">' +
    '<path fill="' + BRUN + '" d="' + BRUN_D + '"/>' +
    '<path fill="' + ORANGE + '" d="' + ORANGE_D + '"/></g></svg>';
}

function skriv(fil, text) {
  fs.writeFileSync(path.join(ROT, fil), text);
  console.log('  ' + fil);
}

// Fliken: genomskinlig, så att märket blir så stort som 16 px tillåter.
// Chrome och Firefox läser prefers-color-scheme i en svg-favicon.
skriv('favicon.svg',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + MW + ' ' + MW + '" width="32" height="32">\n' +
  '  <!-- Nextrums märke (2026-10-15), ritat av verktyg/bygg-logga.js ur\n' +
  '       bilder/nextrum-logga.svg. Färgerna är inbakade, för en favicon\n' +
  '       laddas utan sidans CSS. Det bruna blir kräm i mörkt läge. -->\n' +
  '  <style>.b{fill:' + BRUN + '}@media (prefers-color-scheme:dark){.b{fill:' + KRAM + '}}</style>\n' +
  '  <g transform="translate(0 ' + (MW - MH) / 2 + ')">\n' +
  '    <path class="b" d="' + BRUN_D + '"/>\n' +
  '    <path fill="' + ORANGE + '" d="' + ORANGE_D + '"/>\n' +
  '  </g>\n' +
  '</svg>\n');

// BIMI: SVG Tiny PS, kvadratisk, fylld bakgrund, inga stilar.
skriv('bilder/nextrum-logo-bimi.svg',
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<svg xmlns="http://www.w3.org/2000/svg" version="1.2" baseProfile="tiny-ps" viewBox="0 0 512 512">\n' +
  '<title>Nextrum</title>\n' +
  '<rect width="512" height="512" fill="' + PAPPER + '"/>\n' +
  '<g transform="' + placering(512, 0.6) + '">\n' +
  '<path fill="' + BRUN + '" d="' + BRUN_D + '"/>\n' +
  '<path fill="' + ORANGE + '" d="' + ORANGE_D + '"/>\n' +
  '</g>\n' +
  '</svg>\n');

const PNG = [
  // fil, sida, andel av bredden
  ['favicon-48.png', 48, 0.76],
  ['favicon-96.png', 96, 0.76],
  ['apple-touch-icon.png', 180, 0.68],
  ['bilder/nextrum-logo-512.png', 512, 0.72],
  ['bilder/nextrum-logo-profil.png', 1024, 0.6],
];

/* Signaturen (2026-10-28): märket, ordet och "av unga, för unga" på papperet
   i ett kort med rundade hörn. Kortet är ogenomskinligt av samma skäl som
   ikonerna: Gmail i mörkt läge lägger en genomskinlig brun logga på svart.
   Hörnen är genomskinliga och inbakade, för Outlook tar bort border-radius.
   Ritas i tre gånger storleken; mejlet visar det i 232 x 64 px. */
const SIG_B = 232, SIG_H = 64, SIG_SKALA = 3, SIG_LOGGA_H = 34;
function signatur() {
  const k = SIG_LOGGA_H / 193, b = 1027 * k;
  const x = (SIG_B - b) / 2, y = (SIG_H - SIG_LOGGA_H) / 2;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + SIG_B + ' ' + SIG_H + '" width="' + SIG_B * SIG_SKALA +
    '" height="' + SIG_H * SIG_SKALA + '">' +
    '<rect width="' + SIG_B + '" height="' + SIG_H + '" rx="12" fill="' + PAPPER + '"/>' +
    '<g transform="translate(' + x.toFixed(3) + ' ' + y.toFixed(3) + ') scale(' + k.toFixed(5) + ')">' +
    '<path fill="' + BRUN + '" d="' + BRUN_D + '"/>' +
    '<path fill="' + ORANGE + '" d="' + ORANGE_D + '"/>' +
    '<path fill="' + BRUN + '" transform="' + ORD_FLYTT + '" d="' + ORD_D + '"/>' +
    '<path fill="' + ORANGE + '" d="' + SLOGAN_D + '"/></g></svg>';
}

(async () => {
  const webbläsare = await pw.chromium.launch();
  {
    const sida = await webbläsare.newPage({ viewport: { width: SIG_B * SIG_SKALA, height: SIG_H * SIG_SKALA } });
    await sida.setContent('<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}</style>' + signatur());
    await sida.screenshot({ path: path.join(ROT, 'bilder/nextrum-logo-signatur.png'), omitBackground: true });
    await sida.close();
    console.log('  bilder/nextrum-logo-signatur.png  ' + SIG_B * SIG_SKALA + ' x ' + SIG_H * SIG_SKALA + ' px');
  }
  for (const [fil, s, andel] of PNG) {
    const sida = await webbläsare.newPage({ viewport: { width: s, height: s } });
    await sida.setContent('<!doctype html><style>html,body{margin:0}svg{display:block}</style>' +
      ruta(s, andel, PAPPER));
    await sida.screenshot({ path: path.join(ROT, fil) });
    await sida.close();
    console.log('  ' + fil + '  ' + s + ' px');
  }
  await webbläsare.close();
})();
