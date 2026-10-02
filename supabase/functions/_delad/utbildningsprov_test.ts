// ============================================================
// NEXTRUM — prov: utbildningsprovet (Fas 22.1)
//
// Kör med:  deno test supabase/functions/_delad/
//
// Proven håller fast det som gör provet värt att göra:
//
//   · 30 frågor, varje med fyra alternativ och exakt ett rätt
//   · 80 procent är 24 av 30, inte 23
//   · facit följer aldrig med till sidan
//   · resultatet säger rätt per avsnitt, aldrig per fråga
//   · ett halvt ifyllt eller påhittat svar rättas inte som ett helt
// ============================================================

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { AVSNITT, FRAGOR, genomgang, kravRatt, publikaFragor, ratta } from './utbildningsprov.ts';
import { ANTAL_FRAGOR } from './utbildningsprov_grans.ts';

function facit(): Record<string, string> {
  return Object.fromEntries(FRAGOR.map((f) => [f.id, f.ratt]));
}

/** n fel: de n första frågorna får ett alternativ som inte är det rätta. */
function medFel(n: number): Record<string, string> {
  const s = facit();
  for (const f of FRAGOR.slice(0, n)) s[f.id] = f.alternativ.find((a) => a.id !== f.ratt)!.id;
  return s;
}

Deno.test('trettio frågor, fyra alternativ var och exakt ett rätt', () => {
  assertEquals(FRAGOR.length, 30);
  // Mejlen säger antalet ur utbildningsprov_grans.ts, utan frågorna.
  assertEquals(ANTAL_FRAGOR, FRAGOR.length);
  const id = new Set<string>();
  for (const f of FRAGOR) {
    assert(!id.has(f.id), `dubblett: ${f.id}`);
    id.add(f.id);
    assert(f.avsnitt in AVSNITT, `${f.id}: okänt avsnitt`);
    assertEquals(f.alternativ.length, 4, f.id);
    assertEquals(new Set(f.alternativ.map((a) => a.id)).size, 4, `${f.id}: två alternativ med samma id`);
    assertEquals(new Set(f.alternativ.map((a) => a.text)).size, 4, `${f.id}: två likadana alternativ`);
    assertEquals(f.alternativ.filter((a) => a.id === f.ratt).length, 1, `${f.id}: rätt svar finns inte`);
    // Id:t lagras i utbildningsprov_forsok.svar och står i sidans
    // formulär. Bara små bokstäver och bindestreck.
    assert(/^[a-z-]+$/.test(f.id), f.id);
  }
});

Deno.test('rätt svar är utspritt, så att "välj alltid b" inte räcker', () => {
  const per = new Map<string, number>();
  for (const f of FRAGOR) per.set(f.ratt, (per.get(f.ratt) ?? 0) + 1);
  for (const [bokstav, n] of per) assert(n <= 10, `${bokstav} är rätt ${n} gånger`);
});

// Förut prövade det här provet bara att det längsta svaret inte var rätt
// i ALLA frågor. Det var rätt i 25 av 30, och den som alltid valde det
// längsta klarade provet utan att ha läst handboken. Gränsen är satt
// kring slumpen: med fyra alternativ träffar en regel rätt i sju eller
// åtta frågor av trettio utan att säga något om svaret.
const TAK_FOR_EN_TUMREGEL = 8;

function valjAlltid(valj: (alt: { id: string; text: string }[]) => string): number {
  return ratta(Object.fromEntries(FRAGOR.map((f) => [f.id, valj(f.alternativ)]))).ratt;
}

Deno.test('provet går inte att klara på svarens längd', () => {
  const langst = valjAlltid((alt) => alt.reduce((a, b) => (b.text.length > a.text.length ? b : a)).id);
  const kortast = valjAlltid((alt) => alt.reduce((a, b) => (b.text.length < a.text.length ? b : a)).id);
  assert(langst <= TAK_FOR_EN_TUMREGEL, `alltid det längsta svaret ger ${langst} rätt`);
  assert(kortast <= TAK_FOR_EN_TUMREGEL, `alltid det kortaste svaret ger ${kortast} rätt`);
});

Deno.test('Nextrum och rutinerna pekar inte ut det rätta svaret', () => {
  // I de svåra situationerna är rätt svar ofta att gå till Nextrum. Står
  // Nextrum bara i det rätta alternativet är frågan redan besvarad.
  for (const f of FRAGOR) {
    const med = f.alternativ.filter((a) => /Nextrum/.test(a.text));
    assert(!(med.length === 1 && med[0].id === f.ratt), `${f.id}: bara rätt svar nämner Nextrum`);
  }
});

Deno.test('80 procent är 24 av 30', () => {
  assertEquals(kravRatt(), 24);
  assertEquals(kravRatt(30), 24);
  assertEquals(kravRatt(25), 20);
  assertEquals(kravRatt(31), 25); // 24,8 avrundas uppåt: 24 av 31 är under 80
  assertEquals(ratta(medFel(6)).godkant, true);
  assertEquals(ratta(medFel(6)).ratt, 24);
  assertEquals(ratta(medFel(7)).godkant, false);
  assertEquals(ratta(facit()).ratt, 30);
});

Deno.test('facit följer aldrig med till sidan', () => {
  const p = publikaFragor();
  assertEquals(p.length, FRAGOR.length);
  const text = JSON.stringify(p);
  assertEquals(text.includes('"ratt"'), false);
  for (const f of p) {
    assertEquals(Object.keys(f).sort(), ['alternativ', 'avsnitt', 'fraga', 'id']);
    for (const a of f.alternativ) assertEquals(Object.keys(a).sort(), ['id', 'text']);
  }
});

Deno.test('alternativen blandas, frågorna står still, och originalet rörs inte', () => {
  const fore = JSON.stringify(FRAGOR);
  let x = 0.123;
  const slump = () => (x = (x * 9301 + 49297) % 233280 / 233280);
  const p = publikaFragor(slump);
  assertEquals(p.map((f) => f.id), FRAGOR.map((f) => f.id));
  assert(p.some((f, i) => f.alternativ.map((a) => a.id).join() !== FRAGOR[i].alternativ.map((a) => a.id).join()),
    'ingenting blandades');
  for (const [i, f] of p.entries()) {
    assertEquals(f.alternativ.map((a) => a.id).sort(), FRAGOR[i].alternativ.map((a) => a.id).sort());
  }
  assertEquals(JSON.stringify(FRAGOR), fore);
});

Deno.test('resultatet räknas per avsnitt, aldrig per fråga', () => {
  const r = ratta(medFel(2));
  assertEquals(r.avsnitt.map((a) => a.namn), Object.values(AVSNITT));
  assertEquals(r.avsnitt.reduce((s, a) => s + a.antal, 0), 30);
  assertEquals(r.avsnitt.reduce((s, a) => s + a.ratt, 0), 28);
  assertEquals(r.avsnitt[0].ratt, r.avsnitt[0].antal - 2);
  for (const a of r.avsnitt) assertEquals(Object.keys(a).sort(), ['antal', 'namn', 'ratt']);
});

Deno.test('ett halvt ifyllt eller påhittat svar rättas inte som ett helt', () => {
  const halvt = facit();
  delete halvt[FRAGOR[3].id];
  const r = ratta(halvt);
  assertEquals(r.obesvarade, [FRAGOR[3].id]);
  assertEquals(r.godkant, false);

  // Ett alternativ som inte finns räknas som obesvarat, inte som fel.
  const ogiltigt = { ...facit(), [FRAGOR[0].id]: 'x' };
  assertEquals(ratta(ogiltigt).obesvarade, [FRAGOR[0].id]);

  // Allt som inte är ett objekt är ett tomt prov.
  for (const skrap of [null, undefined, 'b', 42, ['b', 'c'], { __proto__: { syfte: 'b' } }]) {
    assertEquals(ratta(skrap).obesvarade.length, 30, String(skrap));
  }
});

Deno.test('bara kända id:n följer med till databasen', () => {
  const r = ratta({ ...facit(), 'hittepa': 'a', '<script>': 'b' });
  assertEquals(Object.keys(r.svar).sort(), FRAGOR.map((f) => f.id).sort());
  for (const v of Object.values(r.svar)) assert(/^[a-d]$/.test(v));
});

Deno.test('genomgången för admin säger fråga för fråga vad som var rätt', () => {
  const r = ratta(medFel(2));
  const g = genomgang(r.svar);
  assertEquals(g.length, 30);
  assertEquals(g.filter((x) => !x.stammer).length, 2);
  assertEquals(g.map((x) => x.nr), FRAGOR.map((_, i) => i + 1));
  // Fel svar visar både det valda och det rätta, och de är olika.
  const fel = g.find((x) => !x.stammer)!;
  assert(fel.ditt && fel.ditt !== fel.ratt);
  // Ett obesvarat svar är inget val, inte ett påhittat.
  assertEquals(genomgang({})[0].ditt, null);
});
