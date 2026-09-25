// ============================================================
// NEXTRUM — tester för de delade hjälparna (Fas 3)
//
// Kör med:  deno test supabase/functions/_delad/
//
// esc, epostOk och lika fanns förut i flera kopior som hunnit glida
// isär: två av esc-kopiorna escapade inte apostrofen, och två
// hemlighetsjämförelser använde ===. Testerna håller fast det som
// kopiorna var överens om, och det som bara några av dem gjorde rätt.
// ============================================================

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { cors, CORS, esc, epostOk, json, preflight } from './http.ts';
import { lika, kravAdmin, kravInloggad } from './auth.ts';
import { BETALNINGSVILLKOR_DAGAR, MANADER } from './konstanter.ts';

Deno.test('esc tar alla fem tecknen, apostrofen med', () => {
  assertEquals(esc(`<a href="x" title='y'>&</a>`),
    '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  assertEquals(esc(null), '');
  assertEquals(esc(undefined), '');
  assertEquals(esc(42), '42');
});

Deno.test('epostOk godkänner vanliga adresser och inget annat', () => {
  assertEquals(epostOk('anna@example.se'), true);
  assertEquals(epostOk('  anna@example.se  '), true);
  assertEquals(epostOk('anna@example'), false);
  assertEquals(epostOk('anna@example.s'), false);
  assertEquals(epostOk('anna example@x.se'), false);
  assertEquals(epostOk(''), false);
  assertEquals(epostOk(null), false);
});

Deno.test('cors lägger funktionens egna headers sist', () => {
  assertEquals(CORS['Access-Control-Allow-Origin'], '*');
  assertEquals(CORS['Access-Control-Allow-Headers'],
    'authorization, x-client-info, apikey, content-type');
  assertEquals(cors('x-nextrum-notis')['Access-Control-Allow-Headers'],
    'authorization, x-client-info, apikey, content-type, x-nextrum-notis');
});

Deno.test('json sätter status, innehållstyp och CORS', async () => {
  const r = json({ a: 1 }, 418);
  assertEquals(r.status, 418);
  assertEquals(r.headers.get('content-type'), 'application/json');
  assertEquals(r.headers.get('access-control-allow-origin'), '*');
  assertEquals(await r.json(), { a: 1 });

  // En webhook (lead-notis) skickar tomma headers och ska inte få CORS.
  const utan = json({ ok: true }, 200, {});
  assertEquals(utan.headers.get('access-control-allow-origin'), null);
  assertEquals(utan.headers.get('content-type'), 'application/json');
});

Deno.test('preflight svarar ok med rätt headers', async () => {
  const r = preflight(cors('x-fakturering-nyckel'));
  assertEquals(r.status, 200);
  assertEquals(await r.text(), 'ok');
  assertEquals(r.headers.get('access-control-allow-headers')?.endsWith('x-fakturering-nyckel'), true);
});

Deno.test('lika jämför hela strängen', () => {
  assertEquals(lika('hemlig', 'hemlig'), true);
  assertEquals(lika('hemlig', 'hemliG'), false);
  assertEquals(lika('hemlig', 'hemlig2'), false);
  assertEquals(lika('hemlig2', 'hemlig'), false);
  assertEquals(lika('', 'hemlig'), false);
  assertEquals(lika('', ''), true);
  assertEquals(lika('åäö', 'åäö'), true);
  assertEquals(lika('å', 'a'), false);
});

Deno.test('kravInloggad och kravAdmin nekar utan token, före något nätverksanrop', async () => {
  for (const header of [null, '', 'Basic abc', 'bearer abc']) {
    const a = await kravInloggad(header);
    assertEquals(a.ok, false);
    if (!a.ok) assertEquals(a.svar.status, 401);
    const b = await kravAdmin(header);
    assertEquals(b.ok, false);
    if (!b.ok) assertEquals(b.svar.status, 401);
  }
});

Deno.test('betalningsvillkoret och månaderna', () => {
  // Sedan Fas 14.2 gäller villkoret bara fakturor som skapades innan
  // dess (se _delad/konstanter.ts). Ändras det ska det ändå vara ett
  // beslut, för en sådan faktura har redan lovat familjen tio dagar.
  assertEquals(BETALNINGSVILLKOR_DAGAR, 10);
  assertEquals(MANADER.length, 12);
  assertEquals(MANADER[0], 'januari');
  assertEquals(MANADER[11], 'december');
});
