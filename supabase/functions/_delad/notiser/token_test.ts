// ============================================================
// NEXTRUM — tester för avregistreringstokenen
//
// Kör med:  deno test supabase/functions/_delad/
//
// Tokenen är det enda som står mellan en länk i ett mejl och att
// någon annans notiser stängs av. Det som testas är att den går åt
// båda hållen, och att allt som inte är exakt en äkta token nekas:
// en ändrad signatur, ett annat konto, en annan typ eller kanal med
// samma signatur, en annan nyckel, och trasiga format.
// ============================================================

import { assert, assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { lasToken, skapaToken, type TokenTyp } from './token.ts';
import { NOTIS_TYPER } from './typer.ts';

const NYCKEL = btoa('0123456789abcdef0123456789abcdef');
const ANNAN_NYCKEL = btoa('fedcba9876543210fedcba9876543210');
const UID = '3f2c8a1e-5b7d-4c9e-8f01-2a3b4c5d6e7f';
const ANNAN_UID = '3f2c8a1e-5b7d-4c9e-8f01-2a3b4c5d6e70';

Deno.test('tokenen går åt båda hållen, för varje typ och kanal', async () => {
  const typer: TokenTyp[] = [...NOTIS_TYPER, 'alla'];
  for (const kanal of ['mejl', 'sms'] as const) {
    for (const typ of typer) {
      const t = await skapaToken(UID, kanal, typ, NYCKEL);
      assertEquals(t.split('.').slice(0, 3), [UID, kanal, typ]);
      assertEquals(await lasToken(t, NYCKEL), { uid: UID, kanal, typ });
    }
  }
});

Deno.test('tokenen är densamma varje gång, och bara url-säkra tecken', async () => {
  const a = await skapaToken(UID, 'mejl', 'pass_nytt', NYCKEL);
  const b = await skapaToken(UID, 'mejl', 'pass_nytt', NYCKEL);
  assertEquals(a, b);
  assert(/^[0-9a-f-]+\.mejl\.pass_nytt\.[A-Za-z0-9_-]{43}$/.test(a), a);
  assertEquals(encodeURIComponent(a), a);
});

Deno.test('en ändrad signatur nekas', async () => {
  const t = await skapaToken(UID, 'mejl', 'meddelande', NYCKEL);
  const sig = t.split('.')[3];
  for (const i of [0, 10, 42]) {
    const byt = sig[i] === 'A' ? 'B' : 'A';
    const falsk = t.slice(0, t.length - sig.length) + sig.slice(0, i) + byt + sig.slice(i + 1);
    assertEquals(await lasToken(falsk, NYCKEL), null, `tecken ${i}`);
  }
  assertEquals(await lasToken(t.slice(0, -1), NYCKEL), null, 'kortare signatur');
  assertEquals(await lasToken(t + 'A', NYCKEL), null, 'längre signatur');
});

Deno.test('samma signatur med en annan typ, kanal eller ett annat konto nekas', async () => {
  const t = await skapaToken(UID, 'mejl', 'pass_nytt', NYCKEL);
  const sig = t.split('.')[3];
  assertEquals(await lasToken(`${UID}.mejl.alla.${sig}`, NYCKEL), null, 'typen bytt till alla');
  assertEquals(await lasToken(`${UID}.mejl.meddelande.${sig}`, NYCKEL), null, 'typen bytt');
  assertEquals(await lasToken(`${UID}.sms.pass_nytt.${sig}`, NYCKEL), null, 'kanalen bytt');
  assertEquals(await lasToken(`${ANNAN_UID}.mejl.pass_nytt.${sig}`, NYCKEL), null, 'kontot bytt');
});

Deno.test('en token med en annan nyckel nekas', async () => {
  const t = await skapaToken(UID, 'mejl', 'paminnelse', NYCKEL);
  assertEquals(await lasToken(t, ANNAN_NYCKEL), null);
});

Deno.test('trasiga och okända format nekas', async () => {
  const sig = (await skapaToken(UID, 'mejl', 'pass_nytt', NYCKEL)).split('.')[3];
  for (const t of [
    '', 'abc', `${UID}.${sig}`, `${UID}.mejl.${sig}`, `${UID}.mejl.pass_nytt.${sig}.extra`,
    `${UID.toUpperCase()}.mejl.pass_nytt.${sig}`, `inte-ett-id.mejl.pass_nytt.${sig}`,
    `${UID}.post.pass_nytt.${sig}`, `${UID}.mejl.okand_typ.${sig}`, `${UID}.mejl.pass_nytt.!!!`,
    null, undefined, 42,
  ]) {
    assertEquals(await lasToken(t, NYCKEL), null, String(t));
  }
});

Deno.test('tokenen görs bara för ett konto, en kanal och en känd typ', async () => {
  await assertRejects(() => skapaToken('inte-ett-id', 'mejl', 'pass_nytt', NYCKEL));
  // deno-lint-ignore no-explicit-any
  await assertRejects(() => skapaToken(UID, 'post' as any, 'pass_nytt', NYCKEL));
  // deno-lint-ignore no-explicit-any
  await assertRejects(() => skapaToken(UID, 'mejl', 'body' as any, NYCKEL));
});

Deno.test('en kort eller trasig nyckel signerar ingenting', async () => {
  await assertRejects(() => skapaToken(UID, 'mejl', 'pass_nytt', btoa('kort')));
  await assertRejects(() => skapaToken(UID, 'mejl', 'pass_nytt', '%%% inte base64 %%%'));
});
