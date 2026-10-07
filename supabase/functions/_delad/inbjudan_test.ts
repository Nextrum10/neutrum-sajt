// ============================================================
// NEXTRUM — prov: att ta in en familj eller en studiehjälpare (2026-10-06)
//
// Kör med:  deno test supabase/functions/_delad/
//
// Att anroparen är admin prövas i bjud-in med hens egen token innan
// något här körs. Här provas det funktionen själv ansvarar för: rollen
// som vitlistas, adressen, att ett befintligt konto inte bjuds in en
// gång till, välkomsten i metadatan, och vad Skicka igen gör för ett
// konto som inte tryckt på länken, ett som inte valt lösenord och ett
// som är i bruk.
// ============================================================

import { assertEquals } from 'jsr:@std/assert@1';
import { type AuthKonto, type Beroenden, hanteraInbjudan, type Konto, TILLBAKA, tolkaInbjudan,
  VALKOMMEN_LOSENORD } from './inbjudan.ts';

function varld(o: { konto?: Konto | null; auth?: AuthKonto | null; bjudFel?: string; lankFel?: string } = {}) {
  const logg: string[] = [];
  const b: Beroenden = {
    kontoMedAdress: (e) => { logg.push(`finns ${e}`); return Promise.resolve(o.konto ?? null); },
    authKonto: (id) => { logg.push(`auth ${id}`); return Promise.resolve(o.auth === undefined ? null : o.auth); },
    bjudIn: (e, data, tillbaka) => {
      logg.push(`bjud in ${e} ${JSON.stringify(data)} ${tillbaka}`);
      return Promise.resolve(o.bjudFel ? { id: null, fel: o.bjudFel } : { id: 'ny-id', fel: null });
    },
    losenordslank: (e, tillbaka) => { logg.push(`länk ${e} ${tillbaka}`); return Promise.resolve(o.lankFel ?? null); },
    kontaktad: (id) => { logg.push(`kontaktad ${id}`); return Promise.resolve(); },
  };
  return { b, logg };
}

Deno.test('anropet prövas: adress, barnadress, namnet, rollen vitlistas', () => {
  const t = tolkaInbjudan({ epost: ' Sara.S@Example.se ', namn: '  Sara   Svensson ', roll: 'tutor', lead_id: 'x' });
  assertEquals(t.ok && t.inbjudan, { epost: 'sara.s@example.se', namn: 'Sara Svensson', roll: 'tutor', leadId: null, igen: false });
  const f = tolkaInbjudan({ epost: 'a@example.se', roll: 'admin', lead_id: 'l1', igen: 'true' });
  assertEquals(f.ok && f.inbjudan, { epost: 'a@example.se', namn: '', roll: 'parent', leadId: 'l1', igen: false },
    'allt utom tutor blir förälder, och bara true är igen');
  assertEquals(tolkaInbjudan({ epost: 'inte en adress' }).ok, false);
  assertEquals(tolkaInbjudan({ epost: 'alva@barn.nextrum.se' }).ok, false);
  const lang = tolkaInbjudan({ epost: 'a@example.se', namn: 'x'.repeat(300) });
  assertEquals(lang.ok && lang.inbjudan.namn.length, 120);
});

Deno.test('en ny familj: bjuds in med välkomsten, och anmälan blir kontaktad', async () => {
  const v = varld();
  const s = await hanteraInbjudan({ epost: 'anna@example.se', namn: 'Anna Andersson', lead_id: 'lead-1' }, v.b);
  assertEquals(s, { status: 200, kropp: { ok: true, id: 'ny-id', till: 'anna@example.se', roll: 'parent', skickat: 'inbjudan' } });
  assertEquals(v.logg, [
    'finns anna@example.se',
    `bjud in anna@example.se {"role":"parent","full_name":"Anna Andersson","valkommen":"${VALKOMMEN_LOSENORD}"} ${TILLBAKA.parent}`,
    'kontaktad lead-1',
  ]);
});

Deno.test('en ny studiehjälpare: länken leder till studiehjälparvyn, ingen anmälan rörs', async () => {
  const v = varld();
  const s = await hanteraInbjudan({ epost: 'sara@example.se', namn: 'Sara', roll: 'tutor', lead_id: 'lead-1' }, v.b);
  assertEquals(s.status, 200);
  assertEquals(s.kropp.roll, 'tutor');
  assertEquals(v.logg[1], `bjud in sara@example.se {"role":"tutor","full_name":"Sara","valkommen":"losenord"} ${TILLBAKA.tutor}`);
  assertEquals(v.logg.length, 2);
});

Deno.test('ett befintligt konto bjuds inte in en gång till', async () => {
  const v = varld({ konto: { id: 'k1', roll: 'parent' } });
  const s = await hanteraInbjudan({ epost: 'anna@example.se' }, v.b);
  assertEquals(s.status, 409);
  assertEquals(v.logg, ['finns anna@example.se']);
  const t = await hanteraInbjudan({ epost: 'sara@example.se', roll: 'tutor' }, varld({ konto: { id: 'k2', roll: 'tutor' } }).b);
  assertEquals(t.status, 409);
  assertEquals(String(t.kropp.error).includes('Studiehjälpare'), true);
});

Deno.test('Auth säger att adressen redan finns: 409, annat fel: 502', async () => {
  assertEquals((await hanteraInbjudan({ epost: 'a@example.se' },
    varld({ bjudFel: 'A user with this email address has already been registered' }).b)).status, 409);
  assertEquals((await hanteraInbjudan({ epost: 'a@example.se' }, varld({ bjudFel: 'Error sending invite email' }).b)).status, 502);
});

Deno.test('skicka igen: inget konto, och ett konto som inte är familj eller studiehjälpare', async () => {
  assertEquals((await hanteraInbjudan({ epost: 'a@example.se', igen: true }, varld().b)).status, 404);
  const v = varld({ konto: { id: 'k1', roll: 'admin' } });
  assertEquals((await hanteraInbjudan({ epost: 'a@example.se', igen: true }, v.b)).status, 409);
  assertEquals(v.logg, ['finns a@example.se']);
});

Deno.test('skicka igen: länken är inte använd, så inbjudan går igen till rollens vy', async () => {
  const v = varld({ konto: { id: 'k1', roll: 'tutor' }, auth: { bekraftad: false, valkommen: VALKOMMEN_LOSENORD } });
  const s = await hanteraInbjudan({ epost: 'sara@example.se', roll: 'parent', igen: true }, v.b);
  assertEquals(s, { status: 200, kropp: { ok: true, id: 'k1', till: 'sara@example.se', roll: 'tutor', skickat: 'inbjudan' } });
  assertEquals(v.logg, ['finns sara@example.se', 'auth k1', `bjud in sara@example.se {} ${TILLBAKA.tutor}`]);
});

Deno.test('skicka igen: länken är använd men lösenordet inte valt, så en lösenordslänk går', async () => {
  const v = varld({ konto: { id: 'k1', roll: 'parent' }, auth: { bekraftad: true, valkommen: VALKOMMEN_LOSENORD } });
  const s = await hanteraInbjudan({ epost: 'anna@example.se', igen: true }, v.b);
  assertEquals(s.kropp.skickat, 'losenord');
  assertEquals(v.logg, ['finns anna@example.se', 'auth k1', `länk anna@example.se ${TILLBAKA.parent}`]);
  const nyss = await hanteraInbjudan({ epost: 'anna@example.se', igen: true },
    varld({ konto: { id: 'k1', roll: 'parent' }, auth: { bekraftad: true, valkommen: VALKOMMEN_LOSENORD },
      lankFel: 'For security purposes, you can only request this after 42 seconds.' }).b);
  assertEquals(nyss.status, 429);
});

// 2026-10-07: Skicka igen går när som helst. Ett konto i bruk får en länk
// för att välja lösenord, som Glömt lösenordet, till sin egen inkorg.
Deno.test('skicka igen: ett konto i bruk får en länk för att välja lösenord, till rollens vy', async () => {
  for (const [valkommen, roll, vy] of [['intro', 'parent', '/foralder'], [undefined, 'tutor', '/larare'],
    [null, 'parent', '/foralder']] as const) {
    const v = varld({ konto: { id: 'k1', roll }, auth: { bekraftad: true, valkommen } });
    const s = await hanteraInbjudan({ epost: 'anna@example.se', igen: true }, v.b);
    assertEquals(s.status, 200);
    assertEquals(s.kropp.skickat, 'losenord');
    assertEquals(v.logg, ['finns anna@example.se', 'auth k1', 'länk anna@example.se https://nextrum.se' + vy]);
  }
});
