// ============================================================
// NEXTRUM — tester för notis-avanmal
//
// Kör med:  deno test supabase/functions/_delad/
//
// Det som testas: bara POST avregistrerar (en länkskanner som gör
// GET ska inte kunna stänga av någons mejl), GET och HEAD skickas
// vidare till nextrum.se/avanmal med samma token, tokenen tas emot på
// alla tre sätten den kommer (?t= från mejlprogrammets One-Click, JSON
// och formulär), en kropp läses aldrig in över taket, en falsk token
// når aldrig databasen, och svaren säger ingenting om varför.
// ============================================================

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { cors, hanteraAvregistrering, lasKropp, MAX_KROPP, type AvregBeroenden, type AvregUtfall } from './avanmal.ts';
import { skapaToken } from './token.ts';

const NYCKEL = btoa('0123456789abcdef0123456789abcdef');
const UID = '3f2c8a1e-5b7d-4c9e-8f01-2a3b4c5d6e7f';
const URL_ = 'https://ddkfiuvcppalutfulvbi.supabase.co/functions/v1/notis-avanmal';

function bygg(utfall: AvregUtfall = 'ok', over: Partial<AvregBeroenden> = {}) {
  const anrop: [string, string, string][] = [];
  const b: AvregBeroenden = {
    nyckel: () => Promise.resolve(NYCKEL),
    avregistrera: (uid, typ, kanal) => { anrop.push([uid, typ, kanal]); return Promise.resolve(utfall); },
    ...over,
  };
  return { b, anrop };
}

async function las(r: Response) {
  return { status: r.status, body: await r.json().catch(() => null) };
}

Deno.test('GET och HEAD avregistrerar ingen, utan skickar vidare till sidan med samma token', async () => {
  const t = await skapaToken(UID, 'mejl', 'pass_nytt', NYCKEL);
  const { b, anrop } = bygg();
  for (const metod of ['GET', 'HEAD']) {
    const r = await hanteraAvregistrering(new Request(`${URL_}?t=${encodeURIComponent(t)}`, { method: metod }), b);
    assertEquals(r.status, 303, metod);
    assertEquals(r.headers.get('location'), `https://nextrum.se/avanmal?t=${encodeURIComponent(t)}`, metod);
    assertEquals(r.headers.get('referrer-policy'), 'no-referrer', metod);
    assertEquals(r.headers.get('cache-control'), 'no-store', metod);
    assertEquals(await r.text(), '', metod);
  }

  // Utan token till sidan ändå: den säger själv att koden saknas.
  const utan = await hanteraAvregistrering(new Request(URL_, { method: 'GET' }), b);
  assertEquals([utan.status, utan.headers.get('location')], [303, 'https://nextrum.se/avanmal']);

  // Vad som än står i ?t= hamnar kodat i t, på nextrum.se/avanmal.
  const konstig = 'a&t=b#c/../../x?//evil.example';
  const k = await hanteraAvregistrering(new Request(`${URL_}?t=${encodeURIComponent(konstig)}`, { method: 'GET' }), b);
  const dit = new URL(k.headers.get('location') ?? '');
  assertEquals(dit.origin + dit.pathname, 'https://nextrum.se/avanmal');
  assertEquals([...dit.searchParams.entries()], [['t', konstig]]);
  assertEquals(dit.hash, '');

  const put = await hanteraAvregistrering(new Request(`${URL_}?t=${t}`, { method: 'PUT' }), b);
  assertEquals(put.status, 405);
  assertEquals(put.headers.get('allow'), 'GET, HEAD, POST, OPTIONS');
  assertEquals(anrop.length, 0);
});

/** En kropp i bitar utan content-length, som en chunkad överföring. Räknar det som läses. */
function strom(bitar: Uint8Array[], oandlig?: Uint8Array) {
  const matt = { lasta: 0 };
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(c) {
      const bit = i < bitar.length ? bitar[i++] : oandlig;
      if (!bit || matt.lasta > 20 * 1024 * 1024) { c.close(); return; }
      matt.lasta += bit.byteLength;
      c.enqueue(bit);
    },
  });
  return { body, matt };
}

Deno.test('en kropp utan content-length läses bara till taket', async () => {
  // 20 MB i bitar om 1 KB, utan ?t= och utan content-length.
  const { body, matt } = strom([], new Uint8Array(1024).fill(120));
  const req = { method: 'POST', url: URL_, headers: new Headers(), body } as unknown as Request;
  const { b, anrop } = bygg();
  const r = await hanteraAvregistrering(req, b);
  assertEquals(await las(r), { status: 400, body: { error: 'Länken saknar kod.' } });
  assert(matt.lasta <= MAX_KROPP + 4 * 1024, `läste ${matt.lasta} byte`);
  assertEquals(anrop.length, 0);

  // Under taket läses den som vanligt, också i flera bitar.
  const t = await skapaToken(UID, 'mejl', 'meddelande', NYCKEL);
  const text = new TextEncoder().encode(new URLSearchParams({ t }).toString());
  const halv = Math.floor(text.length / 2);
  const s2 = strom([text.slice(0, halv), text.slice(halv)]);
  assertEquals(await lasKropp({ body: s2.body } as unknown as Request), new TextDecoder().decode(text));
  const ok = await hanteraAvregistrering({
    method: 'POST', url: URL_, body: strom([text.slice(0, halv), text.slice(halv)]).body,
    headers: new Headers({ 'content-type': 'application/x-www-form-urlencoded' }),
  } as unknown as Request, b);
  assertEquals(await las(ok), { status: 200, body: { ok: true, typ: 'meddelande', kanal: 'mejl' } });

  // Precis på taket går, en byte över gör det inte.
  assertEquals((await lasKropp({ body: strom([new Uint8Array(MAX_KROPP)]).body } as unknown as Request))?.length, MAX_KROPP);
  assertEquals(await lasKropp({ body: strom([new Uint8Array(MAX_KROPP + 1)]).body } as unknown as Request), null);
});

Deno.test('One-Click från mejlprogrammet: tokenen i adressen, formulärkropp', async () => {
  const t = await skapaToken(UID, 'mejl', 'meddelande', NYCKEL);
  const { b, anrop } = bygg();
  const r = await hanteraAvregistrering(new Request(`${URL_}?t=${encodeURIComponent(t)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'List-Unsubscribe=One-Click',
  }), b);
  assertEquals(await las(r), { status: 200, body: { ok: true, typ: 'meddelande', kanal: 'mejl' } });
  assertEquals(anrop, [[UID, 'meddelande', 'mejl']]);
});

Deno.test('sidan på nextrum.se: JSON { t }, och formuläret med t', async () => {
  const t = await skapaToken(UID, 'sms', 'paminnelse', NYCKEL);
  const { b, anrop } = bygg();
  const a = await hanteraAvregistrering(new Request(URL_, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://nextrum.se' },
    body: JSON.stringify({ t }),
  }), b);
  assertEquals(await las(a), { status: 200, body: { ok: true, typ: 'paminnelse', kanal: 'sms' } });

  const alla = await skapaToken(UID, 'mejl', 'alla', NYCKEL);
  const f = await hanteraAvregistrering(new Request(URL_, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ t: alla }).toString(),
  }), b);
  assertEquals(await las(f), { status: 200, body: { ok: true, typ: 'alla', kanal: 'mejl' } });
  assertEquals(anrop, [[UID, 'paminnelse', 'sms'], [UID, 'alla', 'mejl']]);
});

Deno.test('utan token 400, med falsk token 403, och databasen nås aldrig', async () => {
  const { b, anrop } = bygg();
  const utan = await hanteraAvregistrering(new Request(URL_, { method: 'POST', body: 'List-Unsubscribe=One-Click' }), b);
  assertEquals(await las(utan), { status: 400, body: { error: 'Länken saknar kod.' } });

  const t = await skapaToken(UID, 'mejl', 'pass_nytt', NYCKEL);
  const falsk = t.replace('.pass_nytt.', '.alla.');
  const r = await hanteraAvregistrering(new Request(`${URL_}?t=${falsk}`, { method: 'POST' }), b);
  assertEquals(await las(r), { status: 403, body: { error: 'Länken är ogiltig.' } });

  const annan = await skapaToken(UID, 'mejl', 'pass_nytt', btoa('fedcba9876543210fedcba9876543210'));
  const r2 = await hanteraAvregistrering(new Request(`${URL_}?t=${annan}`, { method: 'POST' }), b);
  assertEquals(r2.status, 403);
  assertEquals(anrop.length, 0);
});

Deno.test('ett konto som inte finns, en trasig databas och en oläslig nyckel säger inget om varför', async () => {
  const t = await skapaToken(UID, 'mejl', 'pass_nytt', NYCKEL);
  const post = () => new Request(`${URL_}?t=${t}`, { method: 'POST' });

  assertEquals(await las(await hanteraAvregistrering(post(), bygg('ogiltig').b)),
    { status: 400, body: { error: 'Länken gäller inte längre.' } });
  assertEquals((await hanteraAvregistrering(post(), bygg('fel').b)).status, 500);
  assertEquals((await hanteraAvregistrering(post(), bygg('ok', {
    avregistrera: () => Promise.reject(new Error('relation "notis_val" does not exist')),
  }).b)).status, 500);
  const utanNyckel = await las(await hanteraAvregistrering(post(), bygg('ok', {
    nyckel: () => Promise.reject(new Error('permission denied for function')),
  }).b));
  assertEquals(utanNyckel.status, 503);
  assertEquals(Object.keys(utanNyckel.body), ['error']);
  assert(!JSON.stringify(utanNyckel.body).includes('permission'), 'rått fel utåt');
});

Deno.test('CORS bara för nextrum.se och www.nextrum.se', async () => {
  // Origin prövas på headers direkt: en webbläsare låter inte ett skript
  // sätta den på en Request, och provet ska gå att köra där också.
  const med = (ursprung: string) => ({ headers: new Headers({ origin: ursprung }) }) as unknown as Request;
  for (const ursprung of ['https://nextrum.se', 'https://www.nextrum.se']) {
    assertEquals(cors(med(ursprung))['Access-Control-Allow-Origin'], ursprung);
  }
  for (const ursprung of ['https://evil.example', 'https://nextrum.se.evil.example', 'http://nextrum.se', 'null']) {
    assertEquals(cors(med(ursprung))['Access-Control-Allow-Origin'], undefined, ursprung);
  }
  assertEquals(cors(med('https://nextrum.se')).Vary, 'Origin');

  const { b, anrop } = bygg();
  const r = await hanteraAvregistrering(new Request(URL_, { method: 'OPTIONS' }), b);
  assertEquals(r.status, 200);
  assertEquals(r.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
  assertEquals(anrop.length, 0);
});
