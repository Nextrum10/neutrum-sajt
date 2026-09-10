/* ============================================================
   NEXTRUM — tester för nextrum-agent.js

   Kör från projektmappen:  node verktyg/testa-agent.js

   Testar det som faktiskt kan gå fel utan att någon märker det:
   hur ett agentsvar blir html. Resten av filen ritar bara ut saker
   och syns direkt om det är trasigt.

   Den viktigaste raden i hela filen är den som kollar att en PÅHITTAD
   adress inte blir en länk. Agenten skiljer på adresser den läst och
   adresser den skrivit ur minnet, och den skillnaden är hela poängen
   med bygget. Skulle den försvinna här nere ser en påhittad källa ut
   precis som en riktig: blå, understruken, klickbar. Då är spärren på
   servern meningslös, för det är den här sidan människan tittar på.

   Ingen webbläsare behövs. NX stubbas, filen körs som text.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');

const rot = path.join(__dirname, '..');

global.NX = {
  $: () => null,
  esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  felText: e => String(e)
};
global.supa = null;

eval(fs.readFileSync(path.join(rot, 'nextrum-agent.js'), 'utf8') + '\nglobal.NXAgent = NXAgent;');

let fel = 0;
function ok(namn, faktisk, vantat) {
  const bra = typeof vantat === 'function' ? vantat(faktisk) : faktisk === vantat;
  if (bra) { console.log('ok   ' + namn); return; }
  fel++;
  console.log('FEL  ' + namn + '\n     fick: ' + JSON.stringify(faktisk));
}

const EKTA  = 'https://www.riksdagen.se/sfs-2005-59';
const FALSK = 'https://www.riksdagen.se/hittepa-1999-1';

/* ---------- det som gör länkar till länkar ---------- */

ok('en hämtad adress blir klickbar',
  NXAgent.formatera('Se ' + EKTA + ' för detta.', [EKTA]),
  s => s.includes('<a href="' + EKTA + '"'));

ok('en påhittad adress blir ALDRIG klickbar',
  NXAgent.formatera('Se ' + FALSK + ' för detta.', [EKTA]),
  s => !s.includes('<a ') && s.includes('hittepa'));

ok('kortare adress som är början på en längre ger inte nästlade länkar',
  NXAgent.formatera('A https://a.se/x/y B', ['https://a.se/x', 'https://a.se/x/y']),
  s => (s.match(/<a /g) || []).length === 1 && s.includes('>https://a.se/x/y</a>'));

/* ---------- inget ur ett svar får bli körbart ----------
   Agenten citerar hämtade dokument. Ett dokument kan innehålla vad
   som helst, och citatet hamnar i vår html. */

ok('taggar i svaret escapas',
  NXAgent.formatera('<script>alert(1)</script>', []),
  s => !s.includes('<script>') && s.includes('&lt;script&gt;'));

ok('citattecken i en adress kan inte bryta ut ur href',
  NXAgent.formatera('Se https://riksdagen.se/a"onmouseover="x nu',
    ['https://riksdagen.se/a"onmouseover="x']),
  s => !s.includes('onmouseover="x"') && s.includes('&quot;'));

/* ---------- svarets form ---------- */

ok('versalrad blir rubrik',
  NXAgent.formatera('KORT SVAR\nJa, det gäller.', []),
  s => s.startsWith('<h4>KORT SVAR</h4>'));

ok('punkter blir en lista',
  NXAgent.formatera('· ett\n· två', []),
  '<ul><li>ett</li><li>två</li></ul>');

ok('ordagrant citat blir blockquote',
  NXAgent.formatera('"Konsumenten har rätt att frånträda avtalet inom fjorton dagar."', []),
  s => s.startsWith('<blockquote>'));

ok('källdelen klipps bort ur brödtexten och ritas för sig',
  NXAgent.formatera('Svaret.\n\nKÄLLOR\n' + EKTA, [EKTA]),
  s => !s.includes('riksdagen'));

/* ---------- källrutan ---------- */

ok('äkta länkas, påhittad ritas överstruken',
  NXAgent.ritaKallor([EKTA], [FALSK]),
  s => s.includes('<a href="' + EKTA) && s.includes('<span>' + FALSK + '</span>'));

ok('utan källor ritas ingenting alls', NXAgent.ritaKallor([], []), '');

console.log(fel === 0 ? '\nAlla tester gröna.' : '\n' + fel + ' test misslyckades.');
process.exit(fel === 0 ? 0 : 1);
