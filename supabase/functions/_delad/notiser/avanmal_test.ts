// ============================================================
// NEXTRUM — prov: avregistreringen
//
// Kör med:  deno test supabase/functions/_delad/
//
// notis-avanmal har verify_jwt av, för länken måste fungera utan
// inloggning. Två saker måste därför hålla, och båda provas här:
//
//  1. EN GET AVREGISTRERAR ALDRIG. Länkskannrar i företagsmejl och
//     antivirus följer varje länk i varje mejl. Hade en GET stängt av
//     notiser hade folk blivit avregistrerade av sitt eget IT-skydd,
//     utan att ha rört något.
//  2. Svaren säger inget om varför. Den som provar sig fram ska inte
//     kunna läsa ut vilka konton som finns.
// ============================================================

import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import {
  AVANMAL_SIDA, MAX_KROPP, TILLATNA_URSPRUNG, hanteraAvregistrering,
  lasTokenUrAnrop, type AvregBeroenden, type AvregUtfall,
} from './avanmal.ts';
import { skapaToken } from './token.ts';
import type { Kanal } from './typer.ts';

const NYCKEL = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
const UID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const ADRESS = 'https://x.supabase.co/functions/v1/notis-avanmal';

type Kall = { uid: string; typ: string; kanal: Kanal };

function beroenden(o: { utfall?: AvregUtfall; nyckelKastar?: boolean; nyckel?: string } = {}) {
  const kallade: Kall[] = [];
  const b: AvregBeroenden = {
    nyckel: () => o.nyckelKastar
      ? Promise.reject(new Error('nyckeln gick inte att läsa'))
      : Promise.resolve(o.nyckel ?? NYCKEL),
    avregistrera: (uid, typ, kanal) => {
      kallade.push({ uid, typ, kanal });
      return Promise.resolve(o.utfall ?? 'ok');
    },
  };
  return { b, kallade };
}

function post(kropp: string, o: { typ?: string; ursprung?: string; adress?: string } = {}): Request {
  const h: Record<string, string> = { 'content-type': o.typ ?? 'application/json' };
  if (o.ursprung) h.origin = o.ursprung;
  return new Request(o.adress ?? ADRESS, { method: 'POST', headers: h, body: kropp });
}

Deno.test('en GET avregistrerar ingen, den skickar vidare till sidan som frågar först', async () => {
  const { b, kallade } = beroenden();
  const t = await skapaToken(UID, 'mejl', 'meddelande', NYCKEL);

  for (const metod of ['GET', 'HEAD']) {
    const r = await hanteraAvregistrering(
      new Request(`${ADRESS}?t=${encodeURIComponent(t)}`, { method: metod }), b);

    assertEquals(r.status, 303, `${metod} ska skicka vidare, inte avregistrera`);
    assertEquals(r.headers.get('location'), `${AVANMAL_SIDA}?t=${encodeURIComponent(t)}`);
    // Adressen med tokenen får inte följa med som Referer till sidan.
    assertEquals(r.headers.get('referrer-policy'), 'no-referrer');
    assertEquals(r.headers.get('cache-control'), 'no-store');
  }
  assertEquals(kallade.length, 0, 'databasen fick inte röras');
});

Deno.test('en GET utan token går till sidan utan frågetecken', async () => {
  const { b } = beroenden();
  const r = await hanteraAvregistrering(new Request(ADRESS, { method: 'GET' }), b);
  assertEquals(r.status, 303);
  assertEquals(r.headers.get('location'), AVANMAL_SIDA);
});

Deno.test('en POST med giltig token avregistrerar exakt det tokenen pekar ut', async () => {
  const { b, kallade } = beroenden();
  const t = await skapaToken(UID, 'mejl', 'paminnelse', NYCKEL);
  const r = await hanteraAvregistrering(post(JSON.stringify({ t })), b);

  assertEquals(r.status, 200);
  assertEquals(await r.json(), { ok: true, typ: 'paminnelse', kanal: 'mejl' });
  assertEquals(kallade, [{ uid: UID, typ: 'paminnelse', kanal: 'mejl' }]);
});

Deno.test('tokenen läses ur ?t=, ur en JSON-kropp och ur ett formulär', async () => {
  const t = await skapaToken(UID, 'sms', 'alla', NYCKEL);

  // Mejlprogrammets One-Click (RFC 8058) POSTar med tokenen i adressen
  // och List-Unsubscribe=One-Click i kroppen.
  const enKlick = new Request(`${ADRESS}?t=${encodeURIComponent(t)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'List-Unsubscribe=One-Click',
  });
  assertEquals(await lasTokenUrAnrop(enKlick), t);

  assertEquals(await lasTokenUrAnrop(post(JSON.stringify({ t }))), t);
  assertEquals(await lasTokenUrAnrop(
    post(`t=${encodeURIComponent(t)}`, { typ: 'application/x-www-form-urlencoded' })), t);
});

Deno.test('One-Click från ett mejlprogram går hela vägen', async () => {
  const { b, kallade } = beroenden();
  const t = await skapaToken(UID, 'mejl', 'meddelande', NYCKEL);
  const r = await hanteraAvregistrering(new Request(`${ADRESS}?t=${encodeURIComponent(t)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'List-Unsubscribe=One-Click',
  }), b);

  assertEquals(r.status, 200);
  assertEquals(kallade.length, 1);
});

Deno.test('en ogiltig token ger 403 och säger inte varför', async () => {
  const { b, kallade } = beroenden();
  const t = await skapaToken(UID, 'mejl', 'meddelande', NYCKEL);
  const [uid, kanal, typ, sig] = t.split('.');

  for (const trasig of [
    'skräp',
    `${uid}.${kanal}.alla.${sig}`,
    `${uid}.${kanal}.${typ}.${'A'.repeat(43)}`,
  ]) {
    const r = await hanteraAvregistrering(post(JSON.stringify({ t: trasig })), b);
    assertEquals(r.status, 403);
    const svar = await r.json();
    assertEquals(svar.error, 'Länken är ogiltig.');
    // Inget om uid, inget om vilken del som inte stämde.
    assertEquals(JSON.stringify(svar).includes(uid), false);
  }
  assertEquals(kallade.length, 0);
});

Deno.test('utan token blir det 400, inte ett kast', async () => {
  const { b } = beroenden();
  const r = await hanteraAvregistrering(post('{}'), b);
  assertEquals(r.status, 400);
  assertEquals((await r.json()).error, 'Länken saknar kod.');
});

Deno.test('en kropp över taket avvisas', async () => {
  // Funktionen kräver ingen inloggning, så en kropp utan gräns är en
  // öppen väg att göra av med minne.
  const { b } = beroenden();
  const r = await hanteraAvregistrering(post(JSON.stringify({ t: 'x'.repeat(MAX_KROPP * 2) })), b);
  assertEquals(r.status, 400);
});

Deno.test('en trasig nyckel ger 503, inte 403', async () => {
  // Skillnaden spelar roll: 403 läser man som "någon knackade med fel
  // kod", 503 som "gå och titta på servern".
  const kastar = beroenden({ nyckelKastar: true });
  const t = await skapaToken(UID, 'mejl', 'meddelande', NYCKEL);
  const r = await hanteraAvregistrering(post(JSON.stringify({ t })), kastar.b);
  assertEquals(r.status, 503);
  assertEquals(kastar.kallade.length, 0);

  // En nyckel som är för kort får lasToken att kasta, inte att neka.
  const kort = beroenden({ nyckel: btoa('kort') });
  const r2 = await hanteraAvregistrering(post(JSON.stringify({ t })), kort.b);
  assertEquals(r2.status, 503);
});

Deno.test('ett konto som inte finns är länkens fel, ett databasfel är vårt', async () => {
  const t = await skapaToken(UID, 'mejl', 'meddelande', NYCKEL);

  const borta = beroenden({ utfall: 'ogiltig' });
  assertEquals((await hanteraAvregistrering(post(JSON.stringify({ t })), borta.b)).status, 400);

  const trasig = beroenden({ utfall: 'fel' });
  assertEquals((await hanteraAvregistrering(post(JSON.stringify({ t })), trasig.b)).status, 500);
});

Deno.test('andra metoder än POST avregistrerar inte', async () => {
  const { b, kallade } = beroenden();
  for (const metod of ['PUT', 'DELETE', 'PATCH']) {
    const r = await hanteraAvregistrering(new Request(ADRESS, { method: metod }), b);
    assertEquals(r.status, 405);
    assertStringIncludes(r.headers.get('allow') ?? '', 'POST');
  }
  assertEquals(kallade.length, 0);
});

Deno.test('OPTIONS svarar på preflight', async () => {
  const { b } = beroenden();
  const r = await hanteraAvregistrering(
    new Request(ADRESS, { method: 'OPTIONS', headers: { origin: TILLATNA_URSPRUNG[0] } }), b);
  assertEquals(r.status, 200);
  assertEquals(r.headers.get('access-control-allow-origin'), TILLATNA_URSPRUNG[0]);
});

Deno.test('bara nextrum.se får ett Allow-Origin', async () => {
  const { b } = beroenden();
  const t = await skapaToken(UID, 'mejl', 'meddelande', NYCKEL);

  for (const ursprung of TILLATNA_URSPRUNG) {
    const r = await hanteraAvregistrering(post(JSON.stringify({ t }), { ursprung }), b);
    assertEquals(r.headers.get('access-control-allow-origin'), ursprung);
  }

  const frammande = await hanteraAvregistrering(
    post(JSON.stringify({ t }), { ursprung: 'https://evil.example' }), b);
  assertEquals(frammande.headers.get('access-control-allow-origin'), null);
  assertEquals(frammande.headers.get('vary'), 'Origin');
});

Deno.test('svaren cachas aldrig', async () => {
  const { b } = beroenden();
  const t = await skapaToken(UID, 'mejl', 'meddelande', NYCKEL);
  const r = await hanteraAvregistrering(post(JSON.stringify({ t })), b);
  assertEquals(r.headers.get('cache-control'), 'no-store');
});
