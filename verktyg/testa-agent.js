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

/* De två nedan hittades genom att faktiskt titta på sidan i en
   webbläsare, inte genom att läsa koden. Modellen radbryter sin text
   där den råkar hamna, och båda felen såg ut som designfel. */

ok('radbrutet stycke blir ETT stycke, inte tre',
  NXAgent.formatera('Ja, lagen gäller när en familj\nbokar ett pass via sidan.\nNi har en informationsplikt.', []),
  '<p>Ja, lagen gäller när en familj bokar ett pass via sidan. Ni har en informationsplikt.</p>');

ok('citat som spänner över flera rader hittas ändå',
  NXAgent.formatera('"Konsumenten har rätt att frånträda avtalet genom att\nlämna ett meddelande inom 14 dagar."', []),
  s => s.startsWith('<blockquote>') && !s.includes('<p>'));

ok('tomrad delar två stycken',
  NXAgent.formatera('Första.\n\nAndra.', []),
  '<p>Första.</p><p>Andra.</p>');

ok('källdelen klipps bort ur brödtexten och ritas för sig',
  NXAgent.formatera('Svaret.\n\nKÄLLOR\n' + EKTA, [EKTA]),
  s => !s.includes('riksdagen'));

/* ---------- källrutan ---------- */

ok('äkta länkas, påhittad ritas överstruken',
  NXAgent.ritaKallor([EKTA], [FALSK]),
  s => s.includes('<a href="' + EKTA) && s.includes('<span>' + FALSK + '</span>'));

ok('utan källor ritas ingenting alls', NXAgent.ritaKallor([], []), '');

/* ============================================================
   DRIFT-AGENTENS VERKTYGSLISTA (Fas 9.9)

   Filen läses som TEXT, inte importeras: supabase/functions/drift
   startar en server på toppnivå, och ett test ska inte göra det.

   De tre raderna här nere vaktar tre beslut som är lätta att ångra
   av misstag, ett i taget, med goda skäl varje gång:

     1. Drift-agenten har INGET utgående verktyg. En agent som både
        läser känsliga rader och kan hämta en adress kan bära ut
        dem, och det räcker med en rad injicerad text i en
        intresseanmälan för att försöket ska göras.
     2. Verktygslistan är en fast mängd. Ett nytt verktyg ska kräva
        att någon ändrar det här testet — alltså tänker efter en
        gång till om vad det lämnar ut.
     3. Steget är takat. En agent som loopar fritt mot betalda
        API-anrop är en räkning som växer medan ingen tittar.
   ============================================================ */

const driftKod = fs.readFileSync(
  path.join(rot, 'supabase', 'functions', 'drift', 'index.ts'), 'utf8');

const driftVerktyg = (driftKod.match(/^\s{4}name: '([a-z_]+)',$/gm) || [])
  .map(r => r.replace(/.*'([a-z_]+)'.*/, '$1')).sort();

ok('drift har exakt de verktyg den ska ha',
  driftVerktyg.join(' '),
  ['analys', 'avvikelser', 'flagga_problem', 'foresla_matchning', 'kommande_pass',
   'matchningsforslag', 'nya_leads', 'omatchade_elever', 'saknade_rapporter'].sort().join(' '));

ok('drift har inget utgående verktyg',
  driftVerktyg.filter(n => /hamta|hämta|sok|sök|webb|url|fetch/.test(n)).length, 0);

ok('drift importerar inte hamta ur den delade agenten',
  /\bhamta\b/.test(driftKod.split('const SYSTEM')[0]), false);

ok('drifts stegtak är satt och rimligt',
  Number((driftKod.match(/MAX_STEG_DRIFT = (\d+)/) || [])[1]),
  n => Number.isInteger(n) && n > 0 && n <= 20);

/* Beskrivningarna är det modellen läser. Lovar en av dem namn,
   adress eller e-post är det antingen en lögn eller ett läckage —
   och båda är värda att stoppa i CI. */
ok('ingen verktygsbeskrivning lovar namn eller kontaktuppgifter',
  (driftKod.match(/description: [^]*?(?=\n\s{4}input_schema)/g) || [])
    .filter(d => /(namnen på|ger namn|med namn|lämnar ut namn|e-postadress|telefonnummer till)/i.test(d))
    .length,
  0);

/* ============================================================
   HUSETS KUNSKAP I SYSTEMPROMPTEN (_delad/nextrum-fakta.ts)

   Texten går in i ett betalt modellanrop hos en agent som samtidigt
   läser personuppgifter om barn. Två saker kan gå sönder tyst:

     1. PRISET GLIDER. Ändras 379 i nextrum-config.js men inte här
        börjar NEX svara med ett gammalt pris, självsäkert och fel.
        Ingen kontroll fångar det — texten är ju bara en sträng.
     2. INFRASTRUKTUR SMYGER IN. "Den ligger i tabellen profiles" är
        frestande att skriva när man vill att svaret ska bli bättre.
        En modell som kan upprepa sin systemprompt ritar då en karta
        över var skyddet sitter, och den kartan behövdes aldrig för
        att svara på "vad bör jag göra först idag".

   Bara den EXPORTERADE STRÄNGEN prövas, inte filhuvudet: kommentaren
   ovanför måste få tala om just de orden för att förklara varför de
   inte får stå nedanför.
   ============================================================ */

const faktaKod = fs.readFileSync(
  path.join(rot, 'supabase', 'functions', '_delad', 'nextrum-fakta.ts'), 'utf8');

const faktaText = (faktaKod.match(/export const NEXTRUM_FAKTA = `([^]*?)`;/) || [])[1] || '';

ok('fakta-texten går att läsa ut', faktaText.length > 400, true);

const konfig = fs.readFileSync(path.join(rot, 'nextrum-config.js'), 'utf8');
const konfigTal = n => Number((konfig.match(new RegExp(n + ': (\\d+)')) || [])[1]);

ok('timpriset i fakta stämmer med nextrum-config.js',
  faktaText.includes(konfigTal('PRIS_PER_TIMME') + ' kronor i timmen'), true);

ok('barntillägget i fakta stämmer med nextrum-config.js',
  faktaText.includes(konfigTal('PRIS_EXTRA_BARN') + ' kronor i timmen i tillägg'), true);

/* Tre barn = grundpris + ETT tillägg. Står summan fel i prompten
   svarar NEX med ett pris ingen familj har fått. */
ok('tre-barn-exemplet är uträknat rätt',
  faktaText.includes((konfigTal('PRIS_PER_TIMME') + konfigTal('PRIS_EXTRA_BARN')) + ' kronor i timmen'),
  true);

const FORBJUDET = [
  'service_role', 'anon-nyckel', 'RLS', 'policy', 'policyn', 'trigger',
  'migration', 'supabase', 'postgres', 'edge function', 'ddkfiuvcppalutfulvbi',
  'profiles', 'bookings', 'lesson_reports', 'invoices', 'payouts', 'tutor_profiles',
];
ok('fakta-texten nämner ingen infrastruktur',
  FORBJUDET.filter(o => new RegExp(o, 'i').test(faktaText)).join(' ') || 'inget',
  'inget');

/* Kunskapen ska faktiskt nå modellen, och cache-brytpunkten ska ligga
   SIST i systemlistan — ligger den först cachas bara det första
   blocket, och slingans fjorton anrop betalar resten varje gång. */
const systemblock = (driftKod.match(/const SYSTEMBLOCK = \[([^]*?)\];/) || [])[1] || '';
ok('drift skickar husets fakta till modellen',
  /NEXTRUM_FAKTA/.test(systemblock) && /system: SYSTEMBLOCK/.test(driftKod), true);
ok('cache-brytpunkten ligger på sista systemblocket',
  systemblock.lastIndexOf('cache_control') > systemblock.indexOf('NEXTRUM_FAKTA'), true);

/* ============================================================
   MODELL, TANKEDJUP OCH AVHUGGNA SVAR (Fas 12.1)

   Tre fel som alla ser ut som förbättringar tills någon räknar efter.
   ============================================================ */

const motorKod = fs.readFileSync(
  path.join(rot, 'supabase', 'functions', '_delad', 'agent.ts'), 'utf8');

/* Förvalet för effort SKILJER SIG MELLAN MODELLER: high på Opus 5,
   medium på Opus 5.5. Byter någon modellsträngen utan att skriva ut
   tankedjupet sänks kvaliteten tyst, och den lägre räkningen ser ut
   som att den nya modellen bara var billigare. */
ok('drift skriver ut tankedjupet i stället för att ärva förvalet',
  /ANSTRANGNING_DRIFT\s*=\s*'(low|medium|high|xhigh|max)'/.test(driftKod)
    && /anstrangning: ANSTRANGNING_DRIFT/.test(driftKod), true);

/* Modellen är driftens egen. Den delade MODELL bär juridik och
   ekonomi, och de har inte provats på samma modell. */
ok('drift har en egen modell och rör inte den delade',
  /MODELL_DRIFT\s*=\s*'[a-z0-9-]+'/.test(driftKod)
    && /modell: MODELL_DRIFT/.test(driftKod), true);

/* Ett avhugget svar såg förut ut som ett färdigt: max_tokens föll ihop
   med end_turn, adminvyn fick en halv mening och loggen sa "klar". */
ok('motorn skiljer ett avhugget svar från ett färdigt',
  /avhugget: svar\.stop_reason === 'max_tokens'/.test(motorKod), true);
ok('drift vägrar lämna ut ett avhugget svar',
  /if \(resultat\.avhugget\)/.test(driftKod), true);

/* Cachade tokens har egen taxa och räknas inte i input_tokens. Utan
   att de loggas går det inte att räkna ut vad en körning kostade, och
   inte att se om cachen slutat träffa. */
ok('motorn räknar de cachade tokenen',
  /cache_read_input_tokens/.test(motorKod)
    && /cache_creation_input_tokens/.test(motorKod), true);

console.log(fel === 0 ? '\nAlla tester gröna.' : '\n' + fel + ' test misslyckades.');
process.exit(fel === 0 ? 0 : 1);
