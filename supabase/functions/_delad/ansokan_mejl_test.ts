// Prov för mejlet vi skriver till den som sökt jobb (ansokan-mejl, 2026-10-20).
//   deno test supabase/functions/_delad/ansokan_mejl_test.ts

import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import {
  AMNE_MAX, ANSOKAN_MEJL_FRAN, TEXT_MAX, hanteraBrev, renderaBrev, tolkaBrev, type Beroenden, type Utskick,
} from './ansokan_mejl.ts';

const ID = '0b6f1c1e-3a52-4b6c-9d2e-7f0a1b2c3d4e';

function beroenden(epost: string | null = 'bo@example.se', fel: string | null = null, finns = true) {
  const skickade: Utskick[] = [];
  const lasta: string[] = [];
  const b: Beroenden = {
    ansokan: async (id) => {
      lasta.push(id);
      return finns ? { epost } : null;
    },
    skicka: async (m) => {
      skickade.push(m);
      return fel;
    },
  };
  return { b, skickade, lasta };
}

Deno.test('från info@, så att svaret kommer dit', () => {
  assertEquals(ANSOKAN_MEJL_FRAN, 'Nextrum <info@nextrum.se>');
});

Deno.test('adressen kommer ur ansökan, aldrig ur anropet', async () => {
  const { b, skickade, lasta } = beroenden('bo@example.se');
  const svar = await hanteraBrev({ ansokan: ID, amne: 'Hej', text: 'Text', till: 'nagon@annan.se' }, b);
  assertEquals(svar.status, 200);
  assertEquals(lasta, [ID]);
  assertEquals(skickade.length, 1);
  assertEquals(skickade[0].till, 'bo@example.se');
  assertEquals(svar.kropp.till, 'bo@example.se');
});

Deno.test('en ansökan som inte syns ger 404 och inget mejl', async () => {
  const { b, skickade } = beroenden('bo@example.se', null, false);
  const svar = await hanteraBrev({ ansokan: ID, amne: 'Hej', text: 'Text' }, b);
  assertEquals(svar.status, 404);
  assertEquals(skickade.length, 0);
});

Deno.test('en ansökan utan giltig adress ger 400 och inget mejl', async () => {
  for (const epost of [null, '', 'inte en adress']) {
    const { b, skickade } = beroenden(epost);
    const svar = await hanteraBrev({ ansokan: ID, amne: 'Hej', text: 'Text' }, b);
    assertEquals(svar.status, 400, String(epost));
    assertEquals(skickade.length, 0);
  }
});

Deno.test('fel id, tomt ämne, tom text och för långt nekas innan något läses', async () => {
  const fall = [
    { ansokan: 'x', amne: 'Hej', text: 'Text' },
    { ansokan: ID, amne: '   ', text: 'Text' },
    { ansokan: ID, amne: 'Hej', text: '\n \n' },
    { ansokan: ID, amne: 'a'.repeat(AMNE_MAX + 1), text: 'Text' },
    { ansokan: ID, amne: 'Hej', text: 'a'.repeat(TEXT_MAX + 1) },
    null,
  ];
  for (const k of fall) {
    const { b, skickade, lasta } = beroenden();
    const svar = await hanteraBrev(k, b);
    assertEquals(svar.status, 400, JSON.stringify(k));
    assertEquals(lasta.length, 0);
    assertEquals(skickade.length, 0);
  }
});

Deno.test('ämnet blir en rad: en radbrytning kan inte bli en header', () => {
  const t = tolkaBrev({ ansokan: ID, amne: 'Hej\r\nBcc: alla@example.se', text: 'Text' });
  assert(t.ok);
  if (t.ok) assertEquals(t.brev.amne, 'Hej Bcc: alla@example.se');
});

Deno.test('samma ruta ger samma nyckel, och utan nyckel ingen', async () => {
  const { b, skickade } = beroenden();
  await hanteraBrev({ ansokan: ID, amne: 'Hej', text: 'Text', forsok: 'abc12345-ruta' }, b);
  await hanteraBrev({ ansokan: ID, amne: 'Hej', text: 'Text', forsok: 'abc12345-ruta' }, b);
  await hanteraBrev({ ansokan: ID, amne: 'Hej', text: 'Text' }, b);
  await hanteraBrev({ ansokan: ID, amne: 'Hej', text: 'Text', forsok: 'kort' }, b);
  assertEquals(skickade[0].idempotens, `ansokan-mejl:${ID}:abc12345-ruta`);
  assertEquals(skickade[1].idempotens, skickade[0].idempotens);
  assertEquals(skickade[2].idempotens, null);
  assertEquals(skickade[3].idempotens, null);
});

Deno.test('ett nej från Resend blir 502 med skälet', async () => {
  const { b } = beroenden('bo@example.se', 'Resend svarade 422');
  const svar = await hanteraBrev({ ansokan: ID, amne: 'Hej', text: 'Text' }, b);
  assertEquals(svar.status, 502);
  assertStringIncludes(String(svar.kropp.error), 'Resend svarade 422');
});

Deno.test('texten går som den är, och HTML:en har ett stycke per tom rad', () => {
  const text = 'Hej Bo,\n\nTack för din ansökan.\nRad två.\n\nHälsningar,\nNextrum';
  const r = renderaBrev('Din ansökan', text);
  assertEquals(r.text, text);
  assertEquals(r.amne, 'Din ansökan');
  assertEquals((r.html.match(/<p style="margin:0 0 16px/g) ?? []).length, 3);
  assertStringIncludes(r.html, 'Tack för din ansökan.<br>Rad två.');
});

Deno.test('det admin skriver escapas', () => {
  const r = renderaBrev('Hej', '<script>alert(1)</script> & "citat"');
  assert(!r.html.includes('<script>alert'));
  assertStringIncludes(r.html, '&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;citat&quot;');
});

Deno.test('bokningslänken går att trycka på, utan skiljetecknet efter', () => {
  const r = renderaBrev('Hej', 'Välj en tid här: https://calendar.app.google/rRiTTLP5ymKQunSv7.');
  assertStringIncludes(r.html,
    '<a href="https://calendar.app.google/rRiTTLP5ymKQunSv7" style="color:');
  assertStringIncludes(r.html, '>https://calendar.app.google/rRiTTLP5ymKQunSv7</a>.');
});

Deno.test('bara https blir en länk, och inget kan ta sig ur href', () => {
  const r = renderaBrev('Hej', 'http://exempel.se och javascript:alert(1) och https://a.se/"onmouseover="x');
  assert(!r.html.includes('href="http://'));
  assert(!r.html.includes('href="javascript'));
  assert(!r.html.includes('"onmouseover="'));
  assertStringIncludes(r.html, 'href="https://a.se/&quot;onmouseover=&quot;x"');
});
