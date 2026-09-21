// ============================================================
// NEXTRUM — tester för SMS-påminnelsen och 46elks-klienten
//
// Kör med:  deno test supabase/functions/_delad/
//
// Två saker kostar pengar om de går fel utan att någon märker det:
// ett tecken utanför GSM 03.38 (då blir varje SMS två eller tre
// delar) och ett anrop som skickar på riktigt när läget är prov. Och
// en sak kostar förtroende: ett barnnamn på en låst skärm.
// ============================================================

import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { arGsm, skickaSms, smsText, SMS_URL } from '../sms.ts';
import { plusDagar } from './tid.ts';

const NU = new Date('2026-09-22T10:00:00Z');
const NYCKLAR = (k: string) => ({ ELKS_API_ANVANDARE: 'u123', ELKS_API_LOSENORD: 'hemligt' } as Record<string, string>)[k];

Deno.test('SMS-texten håller GSM 03.38 och ryms i en del, för alla dagar och tider', () => {
  let langst = '';
  for (let dag = 0; dag < 400; dag++) {
    const datum = plusDagar('2026-09-22', dag);
    for (const timmar of [1, 2, 19, 24, 48, 168]) {
      for (const roll of ['parent', 'tutor']) {
        const t = smsText({ roll, data: { datum, tid: '23:59', timmar }, nu: NU });
        assert(arGsm(t), `utanför GSM 03.38: ${t}`);
        assert(t.length <= 160, `${t.length} tecken: ${t}`);
        if (t.length > langst.length) langst = t;
      }
    }
  }
  assert(langst.length > 60, 'texten är misstänkt kort');
});

Deno.test('SMS-texten har tid och länk, och inget namn eller ämne', () => {
  const t = smsText({
    roll: 'parent',
    data: { datum: '2026-09-23', tid: '16:00', timmar: 24, elev: 'Alva', amne: 'Matematik',
            studiehjalpare: 'Tove', fran: 'Tove', body: 'hemlig text', location: 'Storgatan 1' },
    nu: NU,
  });
  assertStringIncludes(t, 'i morgon kl. 16:00');
  assertStringIncludes(t, 'Svara inte på det här SMS:et.');
  assert(t.endsWith('\nhttps://nextrum.se/foralder#lektioner/pass'), t);
  for (const x of ['Alva', 'Matematik', 'Tove', 'hemlig', 'Storgatan']) assert(!t.includes(x), x);

  const h = smsText({ roll: 'tutor', data: { datum: '2026-09-22', tid: '13:00', timmar: 1 }, nu: NU });
  assertStringIncludes(h, 'om en timme, kl. 13:00');
  assert(h.endsWith('https://nextrum.se/larare#lektioner/pass'), h);
});

Deno.test('arGsm känner igen svenska och fäller tankstreck och specialtecken', () => {
  assert(arGsm('Åsa, Ärla och Östen: pass kl. 16:00! (ok?) - /#'));
  for (const c of ['—', '–', '’', '”', '{', '}', '[', ']', '~', '\\', '^', '|', '€', '\u{1F98C}']) {
    assert(!arGsm(`pass ${c}`), `släppte igenom ${JSON.stringify(c)}`);
  }
});

type Anrop = { url: string; init: RequestInit };

function fejkFetch(svar: () => Response | Promise<Response>) {
  const anrop: Anrop[] = [];
  const f = ((url: string | URL | Request, init?: RequestInit) => {
    anrop.push({ url: String(url), init: init ?? {} });
    return Promise.resolve(svar());
  }) as typeof fetch;
  return { f, anrop };
}

Deno.test('saknas nycklarna blir det ett permanent fel, utan anrop', async () => {
  const { f, anrop } = fejkFetch(() => new Response('{}'));
  const s = await skickaSms({ till: '+46701234567', text: 'hej', lage: 'prov' }, { env: () => undefined, fetch: f });
  assertEquals(s, { ok: false, id: null, kostnad: null, permanent: true, fel: 'SMS-nyckel saknas' });
  assertEquals(anrop.length, 0);
});

Deno.test('provläget skickar med dryrun, dontlog och Basic-auth, och läser den beräknade kostnaden', async () => {
  const { f, anrop } = fejkFetch(() => new Response(JSON.stringify({ status: 'created', estimated_cost: 5200, parts: 1 })));
  const text = smsText({ roll: 'parent', data: { datum: '2026-09-23', tid: '16:00', timmar: 24 }, nu: NU });
  const s = await skickaSms({ till: '+46701234567', text, lage: 'prov' }, { env: NYCKLAR, fetch: f });

  assertEquals(s, { ok: true, id: null, kostnad: 5200, permanent: false, fel: null });
  assertEquals(anrop.length, 1);
  assertEquals(anrop[0].url, SMS_URL);
  assertEquals(anrop[0].init.method, 'POST');
  const h = new Headers(anrop[0].init.headers);
  assertEquals(h.get('authorization'), 'Basic ' + btoa('u123:hemligt'));
  assertEquals(h.get('content-type'), 'application/x-www-form-urlencoded');
  const kropp = new URLSearchParams(String(anrop[0].init.body));
  assertEquals(kropp.get('from'), 'Nextrum');
  assertEquals(kropp.get('to'), '+46701234567');
  assertEquals(kropp.get('message'), text);
  assertEquals(kropp.get('dontlog'), 'message');
  assertEquals(kropp.get('dryrun'), 'yes');
});

Deno.test('läget skicka skickar utan dryrun och ger id och kostnad', async () => {
  const { f, anrop } = fejkFetch(() => new Response(JSON.stringify({ status: 'created', id: 's70df', cost: 5200 })));
  const s = await skickaSms({ till: '+46701234567', text: 'hej', lage: 'skicka' }, { env: NYCKLAR, fetch: f });
  assertEquals(s, { ok: true, id: 's70df', kostnad: 5200, permanent: false, fel: null });
  assertEquals(new URLSearchParams(String(anrop[0].init.body)).get('dryrun'), null);
});

Deno.test('4xx är permanent, 429 och 5xx och nätfel är tillfälliga, och felet bär inget nummer', async () => {
  for (const [status, permanent] of [[400, true], [401, true], [403, true], [429, false], [500, false], [503, false]] as const) {
    const { f } = fejkFetch(() => new Response('Invalid to number +46701234567', { status }));
    const s = await skickaSms({ till: '+46701234567', text: 'hej', lage: 'skicka' }, { env: NYCKLAR, fetch: f });
    assertEquals(s.ok, false, String(status));
    assertEquals(s.permanent, permanent, String(status));
    assert(!String(s.fel).includes('4670'), `${status}: numret i felet`);
  }
  const nere = (() => Promise.reject(new Error('nätet'))) as typeof fetch;
  const s = await skickaSms({ till: '+46701234567', text: 'hej', lage: 'skicka' }, { env: NYCKLAR, fetch: nere });
  assertEquals([s.ok, s.permanent], [false, false]);
});

Deno.test('ett nummer som inte är E.164 eller en text utanför GSM skickas aldrig', async () => {
  const { f, anrop } = fejkFetch(() => new Response('{}'));
  const a = await skickaSms({ till: '0701234567', text: 'hej', lage: 'skicka' }, { env: NYCKLAR, fetch: f });
  const b = await skickaSms({ till: '+46701234567', text: 'pass — i dag', lage: 'skicka' }, { env: NYCKLAR, fetch: f });
  assertEquals([a.ok, a.permanent, b.ok, b.permanent], [false, true, false, true]);
  assertEquals(anrop.length, 0);
});

Deno.test('ett anrop som inte besvaras i tid avbryts: i skicka-läget utan nytt försök, i provläget med', async () => {
  // Hänger tills signalen avbryter, som ett nät som slutat svara.
  let fickSignal = false;
  const hanger = ((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_ja, nej) => {
    fickSignal = init?.signal instanceof AbortSignal;
    init?.signal?.addEventListener('abort', () => nej(new DOMException('avbrutet', 'AbortError')));
  })) as typeof fetch;

  const skarp = await skickaSms({ till: '+46701234567', text: 'hej', lage: 'skicka' }, { env: NYCKLAR, fetch: hanger, tidsgransMs: 20 });
  assert(fickSignal, 'fetch fick ingen signal');
  // 46elks har ingen idempotensnyckel: kom anropet fram ändå hade ett nytt försök gett två SMS.
  assertEquals([skarp.ok, skarp.permanent], [false, true]);
  assertStringIncludes(String(skarp.fel), 'inte i tid');
  assert(!String(skarp.fel).includes('4670'), 'numret i felet');

  const prov = await skickaSms({ till: '+46701234567', text: 'hej', lage: 'prov' }, { env: NYCKLAR, fetch: hanger, tidsgransMs: 20 });
  assertEquals([prov.ok, prov.permanent], [false, false]);

  // Ett vanligt nätfel före svaret är fortfarande tillfälligt, också i skicka-läget.
  const nere = (() => Promise.reject(new TypeError('nätet'))) as typeof fetch;
  const n = await skickaSms({ till: '+46701234567', text: 'hej', lage: 'skicka' }, { env: NYCKLAR, fetch: nere, tidsgransMs: 20 });
  assertEquals([n.ok, n.permanent, n.fel], [false, false, '46elks gick inte att nå']);
});
