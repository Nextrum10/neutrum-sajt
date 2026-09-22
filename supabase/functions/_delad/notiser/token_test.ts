// ============================================================
// NEXTRUM — prov: avregistreringstokenen
//
// Kör med:  deno test supabase/functions/_delad/
//
// Tokenen är det enda som skyddar notis-avanmal: funktionen har
// verify_jwt av, för länken måste fungera utan inloggning. Håller inte
// signaturen kan vem som helst stänga av vem som helsts mejl genom att
// gissa ett uuid.
//
// Proven är därför skrivna mot vad en angripare faktiskt skulle prova:
// byta typ i en token de fått själva, byta uid, klippa signaturen, och
// skicka en token signerad med den gamla v1-texten.
// ============================================================

import { assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { lasToken, skapaToken } from './token.ts';

/** 32 byte, som databasens notis_avregistreringsnyckel(). */
function nyckel(fyllnad: number): string {
  const b = new Uint8Array(32).fill(fyllnad);
  return btoa(String.fromCharCode(...b));
}

const NYCKEL = nyckel(7);
const ANNAN = nyckel(9);
const UID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const UID2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

Deno.test('en token går att läsa tillbaka med samma nyckel', async () => {
  const t = await skapaToken(UID, 'mejl', 'meddelande', NYCKEL);
  assertEquals(await lasToken(t, NYCKEL), { uid: UID, kanal: 'mejl', typ: 'meddelande' });

  const alla = await skapaToken(UID, 'sms', 'alla', NYCKEL);
  assertEquals(await lasToken(alla, NYCKEL), { uid: UID, kanal: 'sms', typ: 'alla' });
});

Deno.test('formen är uid.kanal.typ.signatur, med 43 tecken signatur', async () => {
  const delar = (await skapaToken(UID, 'mejl', 'paminnelse', NYCKEL)).split('.');
  assertEquals(delar.length, 4);
  assertEquals(delar[0], UID);
  assertEquals(delar[1], 'mejl');
  assertEquals(delar[2], 'paminnelse');
  // HMAC-SHA256 är 32 byte = 43 tecken base64url utan utfyllnad.
  assertEquals(delar[3].length, 43);
  assertEquals(/^[A-Za-z0-9_-]+$/.test(delar[3]), true, 'base64url, ingen utfyllnad');
});

Deno.test('en annan nyckel läser inte tokenen', async () => {
  const t = await skapaToken(UID, 'mejl', 'meddelande', NYCKEL);
  assertEquals(await lasToken(t, ANNAN), null);
});

Deno.test('signaturen täcker uid, kanal OCH typ', async () => {
  const t = await skapaToken(UID, 'mejl', 'meddelande', NYCKEL);
  const [uid, kanal, typ, sig] = t.split('.');

  // Den som fått en länk för sina egna meddelandemejl ska inte kunna
  // göra om den till "alla", till en annan kanal, eller till någon
  // annans konto.
  assertEquals(await lasToken(`${uid}.${kanal}.alla.${sig}`, NYCKEL), null);
  assertEquals(await lasToken(`${uid}.sms.${typ}.${sig}`, NYCKEL), null);
  assertEquals(await lasToken(`${UID2}.${kanal}.${typ}.${sig}`, NYCKEL), null);
});

Deno.test('en klippt eller ändrad signatur går inte igenom', async () => {
  const t = await skapaToken(UID, 'mejl', 'meddelande', NYCKEL);
  const [uid, kanal, typ, sig] = t.split('.');

  assertEquals(await lasToken(`${uid}.${kanal}.${typ}.${sig.slice(0, 42)}`, NYCKEL), null);
  assertEquals(await lasToken(`${uid}.${kanal}.${typ}.${sig}A`, NYCKEL), null);
  assertEquals(await lasToken(`${uid}.${kanal}.${typ}.`, NYCKEL), null);

  // Ett tecken bytt, samma längd.
  const bytt = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
  assertEquals(await lasToken(`${uid}.${kanal}.${typ}.${bytt}`, NYCKEL), null);
});

Deno.test('en signatur över den gamla v1-texten gäller inte', async () => {
  // v1 signerade bara 'avanmal:' + uid och stängde av allt på en gång.
  // Prefixet v2 finns för att en sådan signatur aldrig ska kunna läsas
  // som en ny, ens med samma nyckel.
  const rat = new Uint8Array(atob(NYCKEL).split('').map((c) => c.charCodeAt(0)));
  const k = await crypto.subtle.importKey('raw', rat, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('avanmal:' + UID)));
  let bin = '';
  for (const b of sig) bin += String.fromCharCode(b);
  const gammal = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  assertEquals(await lasToken(`${UID}.mejl.alla.${gammal}`, NYCKEL), null);
});

Deno.test('skräp i stället för en token ger null, inte ett kast', async () => {
  for (const t of [null, undefined, '', 'abc', 'a.b.c', 'a.b.c.d.e', 42, {}]) {
    assertEquals(await lasToken(t, NYCKEL), null);
  }
  // Rätt form, men uid är inget uuid och typen är okänd.
  assertEquals(await lasToken(`inte-ett-uuid.mejl.meddelande.${'A'.repeat(43)}`, NYCKEL), null);
  assertEquals(await lasToken(`${UID}.mejl.pass_installt.${'A'.repeat(43)}`, NYCKEL), null);
  assertEquals(await lasToken(`${UID}.brev.meddelande.${'A'.repeat(43)}`, NYCKEL), null);
});

Deno.test('skapaToken vägrar göra en token för något okänt', async () => {
  await assertRejects(() => skapaToken('inte-ett-uuid', 'mejl', 'meddelande', NYCKEL));
  await assertRejects(() => skapaToken(UID, 'brev' as 'mejl', 'meddelande', NYCKEL));
  await assertRejects(() => skapaToken(UID, 'mejl', 'pass_installt' as 'meddelande', NYCKEL));
});

Deno.test('en för kort eller trasig nyckel signerar ingenting tyst', async () => {
  // En tom eller stympad nyckel ska stoppa utskicket, inte ge alla
  // länkar en signatur som är lätt att gissa.
  await assertRejects(() => skapaToken(UID, 'mejl', 'meddelande', ''));
  await assertRejects(() => skapaToken(UID, 'mejl', 'meddelande', btoa('kort')));
  await assertRejects(() => skapaToken(UID, 'mejl', 'meddelande', 'inte base64 alls!!'));
  await assertRejects(() => lasToken(`${UID}.mejl.meddelande.${'A'.repeat(43)}`, btoa('kort')));
});
