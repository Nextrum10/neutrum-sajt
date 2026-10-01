// ============================================================
// NEXTRUM — prov: barnets inloggning med sin egen e-post
// (barnets_epost)
//
// Kör med:  deno test supabase/functions/_delad/
//
// Funktionen har verify_jwt av och svarar med en session. Proven är
// skrivna mot det som en angripare skulle pröva: lista ut vilka adresser
// som hör till ett barn (genom svaret eller tiden), använda den tekniska
// adressen, skicka en jättekropp, och mot det som inte får hända med
// sessionen: att den cachas eller hamnar hos en annan sajt.
// ============================================================

import { assertEquals } from 'jsr:@std/assert@1';
import {
  type AuthSvar, type Beroenden, FEL, GOLV_MS, hanteraBarnInloggning, klientensIp, MAX_KROPP, NERE, SPARRAD,
  TILLATNA_URSPRUNG, tolka, type Uppslag,
} from './barninloggning.ts';

const ADRESS = 'https://x.supabase.co/functions/v1/barn-inloggning';
const SESSION = {
  access_token: 'a.b.c', refresh_token: 'r1', expires_in: 3600, expires_at: 2000000000, token_type: 'bearer',
};

type Logg = { uppslag: { epost: string; ip: string }[]; inloggningar: string[]; lyckade: string[]; vantat: number };

function beroenden(o: { uppslag?: Uppslag | 'kastar'; auth?: AuthSvar | 'kastar'; tarMs?: number } = {}) {
  let klocka = 0;
  const logg: Logg = { uppslag: [], inloggningar: [], lyckade: [], vantat: 0 };
  const b: Beroenden = {
    uppslag: (epost, ip) => {
      logg.uppslag.push({ epost, ip });
      if (o.uppslag === 'kastar') return Promise.reject(new Error('nere'));
      return Promise.resolve(o.uppslag ?? { lage: 'ok', adress: 'alva.b@barn.nextrum.se', e: 'e:1', i: 'i:1' });
    },
    lyckades: (e) => { logg.lyckade.push(e); return Promise.resolve(); },
    loggaIn: (adress) => {
      logg.inloggningar.push(adress);
      klocka += o.tarMs ?? 0;
      if (o.auth === 'kastar') return Promise.reject(new Error('nät'));
      return Promise.resolve(o.auth ?? { ok: true, session: SESSION });
    },
    vanta: (ms) => { logg.vantat += ms; klocka += ms; return Promise.resolve(); },
    nu: () => klocka,
  };
  return { b, logg, tid: () => klocka };
}

function post(kropp: unknown, h: Record<string, string> = {}): Request {
  return new Request(ADRESS, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: TILLATNA_URSPRUNG[0], ...h },
    body: typeof kropp === 'string' ? kropp : JSON.stringify(kropp),
  });
}

Deno.test('rätt adress och lösenord ger barnets session, med den tekniska adressen hos Auth', async () => {
  const { b, logg } = beroenden();
  const r = await hanteraBarnInloggning(post({ epost: ' Alva@Example.org ', losenord: 'hemligt123' },
    { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }), b);
  assertEquals(r.status, 200);
  assertEquals(await r.json(), SESSION);
  assertEquals(logg.uppslag, [{ epost: 'alva@example.org', ip: '203.0.113.9' }]);
  assertEquals(logg.inloggningar, ['alva.b@barn.nextrum.se']);
  assertEquals(logg.lyckade, ['e:1']);
  assertEquals(r.headers.get('cache-control'), 'no-store');
});

Deno.test('okänd adress och fel lösenord ger samma svar och minst samma tid', async () => {
  const okand = beroenden({ uppslag: { lage: 'okand' } });
  const r1 = await hanteraBarnInloggning(post({ epost: 'x@example.org', losenord: 'fel' }), okand.b);
  const fel = beroenden({ auth: { ok: false, status: 400 }, tarMs: 300 });
  const r2 = await hanteraBarnInloggning(post({ epost: 'alva@example.org', losenord: 'fel' }), fel.b);

  assertEquals([r1.status, r2.status], [400, 400]);
  assertEquals(await r1.json(), { error: FEL });
  assertEquals(await r2.json(), { error: FEL });
  assertEquals(okand.tid() >= GOLV_MS && fel.tid() >= GOLV_MS, true);
  // Den okända adressen nådde aldrig Auth.
  assertEquals(okand.logg.inloggningar.length, 0);
  assertEquals(fel.logg.lyckade.length, 0);
});

Deno.test('spärrad, Auth som säger 429 och Auth som är nere', async () => {
  const sparrad = beroenden({ uppslag: { lage: 'sparrad' } });
  const r1 = await hanteraBarnInloggning(post({ epost: 'alva@example.org', losenord: 'x' }), sparrad.b);
  assertEquals([r1.status, (await r1.json()).error], [429, SPARRAD]);
  assertEquals(sparrad.logg.inloggningar.length, 0);

  const auth429 = beroenden({ auth: { ok: false, status: 429 } });
  assertEquals((await hanteraBarnInloggning(post({ epost: 'alva@example.org', losenord: 'x' }), auth429.b)).status, 429);

  const nere = beroenden({ auth: 'kastar' });
  const r3 = await hanteraBarnInloggning(post({ epost: 'alva@example.org', losenord: 'x' }), nere.b);
  assertEquals([r3.status, (await r3.json()).error], [503, NERE]);

  const dbNere = beroenden({ uppslag: 'kastar' });
  assertEquals((await hanteraBarnInloggning(post({ epost: 'alva@example.org', losenord: 'x' }), dbNere.b)).status, 503);
});

Deno.test('med flaggan av: nej direkt, utan Auth', async () => {
  const av = beroenden({ uppslag: { lage: 'av' } });
  const r = await hanteraBarnInloggning(post({ epost: 'alva@example.org', losenord: 'x' }), av.b);
  assertEquals([r.status, (await r.json()).error], [400, FEL]);
  assertEquals(av.logg.inloggningar.length, 0);
  assertEquals(av.logg.vantat, 0);
});

Deno.test('den tekniska adressen, en trasig kropp och för långa värden nås aldrig databasen med', async () => {
  for (const kropp of [
    { epost: 'alva.b@barn.nextrum.se', losenord: 'x' },
    { epost: 'ALVA.B@BARN.NEXTRUM.SE', losenord: 'x' },
    { epost: 'alva.b', losenord: 'x' },
    { epost: 'alva@example.org', losenord: '' },
    { epost: 'alva@example.org', losenord: 'å'.repeat(40) },
    { epost: 'a'.repeat(250) + '@example.org', losenord: 'x' },
    { epost: ['alva@example.org'], losenord: 'x' },
    'inte json',
  ]) {
    const { b, logg } = beroenden();
    const r = await hanteraBarnInloggning(post(kropp), b);
    assertEquals(r.status, 400, JSON.stringify(kropp));
    assertEquals(logg.uppslag.length, 0, JSON.stringify(kropp));
  }
  const { b, logg } = beroenden();
  const stor = await hanteraBarnInloggning(post({ epost: 'alva@example.org', losenord: 'x'.repeat(MAX_KROPP * 2) }), b);
  assertEquals(stor.status, 400);
  assertEquals(logg.uppslag.length, 0);
});

Deno.test('ett uppslag som inte svarar med en barnadress loggar inte in någon', async () => {
  const { b, logg } = beroenden({ uppslag: { lage: 'ok', adress: 'leo@example.org', e: 'e', i: 'i' } });
  const r = await hanteraBarnInloggning(post({ epost: 'alva@example.org', losenord: 'x' }), b);
  assertEquals(r.status, 400);
  assertEquals(logg.inloggningar.length, 0);
});

Deno.test('bara nextrum.se får läsa svaret, och bara POST loggar in', async () => {
  const { b } = beroenden();
  const frammande = await hanteraBarnInloggning(post({ epost: 'alva@example.org', losenord: 'x' },
    { origin: 'https://evil.example' }), b);
  assertEquals(frammande.headers.get('access-control-allow-origin'), null);
  assertEquals(frammande.headers.get('vary'), 'Origin');

  for (const metod of ['GET', 'PUT', 'DELETE']) {
    const { b: b2, logg } = beroenden();
    const r = await hanteraBarnInloggning(new Request(ADRESS, { method: metod }), b2);
    assertEquals(r.status, 405);
    assertEquals(logg.uppslag.length, 0);
  }
  const pre = await hanteraBarnInloggning(new Request(ADRESS, { method: 'OPTIONS', headers: { origin: TILLATNA_URSPRUNG[1] } }), b);
  assertEquals(pre.headers.get('access-control-allow-origin'), TILLATNA_URSPRUNG[1]);
});

Deno.test('tolka och klientensIp', () => {
  assertEquals(tolka(JSON.stringify({ epost: 'A@B.se', losenord: 'p' })), { epost: 'a@b.se', losenord: 'p' });
  assertEquals(tolka(null), null);
  assertEquals(klientensIp(new Request(ADRESS, { headers: { 'x-forwarded-for': ' 198.51.100.4 , 10.1.1.1' } })), '198.51.100.4');
  assertEquals(klientensIp(new Request(ADRESS)), '');
});
