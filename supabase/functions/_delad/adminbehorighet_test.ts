// ============================================================
// NEXTRUM — prov: att bjuda in en ny admin (barnkonton_och_admin)
//
// Kör med:  deno test supabase/functions/_delad/
//
// Reglerna för vem som får ge vad står i databasen och provas i
// verktyg/rls-test.sql. Här provas det edge-funktionen själv ansvarar
// för: att anropet prövas innan något skickas, att ingen inbjudan går
// till någon som sedan nekas rollen, att en befintlig adress pekas mot
// väg B, och att kontot tas bort igen om databasen säger nej.
// ============================================================

import { assertEquals } from 'jsr:@std/assert@1';
import { BEHORIGHETER, type Beroenden, hanteraNyAdmin, REDAN_KONTO, tolkaNyAdmin } from './adminbehorighet.ts';

function varld(o: { kanGe?: string | null; finns?: boolean; bjudFel?: string; gorFel?: string } = {}) {
  const logg: string[] = [];
  const b: Beroenden = {
    kanGe: (a) => { logg.push(`kan ge ${a.behorigheter.join(',')}${a.superadmin ? ' super' : ''}`); return Promise.resolve(o.kanGe ?? null); },
    finnsKonto: (e) => { logg.push(`finns ${e}`); return Promise.resolve(!!o.finns); },
    bjudIn: (a) => { logg.push(`bjud in ${a.epost} ${a.namn}`); return Promise.resolve(o.bjudFel ? { id: null, fel: o.bjudFel } : { id: 'ny-id', fel: null }); },
    sattAdressAdmin: (id) => { logg.push(`adress ${id}`); return Promise.resolve(); },
    gorTillAdmin: (id, a) => { logg.push(`gör ${id} ${a.behorigheter.join(',')}`); return Promise.resolve(o.gorFel ?? null); },
    taBortKonto: (id) => { logg.push(`ta bort ${id}`); return Promise.resolve(); },
  };
  return { b, logg };
}

const ny = (extra: Record<string, unknown> = {}) =>
  ({ epost: ' Ny.Admin@Example.se ', namn: '  Nina   Admin ', behorigheter: ['leads', 'matchning', 'leads'], ...extra });

Deno.test('listan har nio behörigheter, en gång var', () => {
  assertEquals(BEHORIGHETER.length, 9);
  assertEquals(new Set(BEHORIGHETER).size, 9);
});

Deno.test('anropet prövas: adress, namn, kända behörigheter, redigera kräver läs', () => {
  const t = tolkaNyAdmin(ny());
  assertEquals(t.ok && t.admin, { epost: 'ny.admin@example.se', namn: 'Nina Admin', behorigheter: ['leads', 'matchning'], superadmin: false });
  assertEquals(tolkaNyAdmin(ny({ epost: 'inte en adress' })).ok, false);
  assertEquals(tolkaNyAdmin(ny({ epost: 'alva@barn.nextrum.se' })).ok, false);
  assertEquals(tolkaNyAdmin(ny({ namn: '   ' })).ok, false);
  assertEquals(tolkaNyAdmin(ny({ behorigheter: ['betalningar'] })).ok, false);
  assertEquals(tolkaNyAdmin(ny({ behorigheter: 'leads' })).ok, false);
  assertEquals(tolkaNyAdmin(ny({ behorigheter: [] })).ok, false);
  assertEquals(tolkaNyAdmin(ny({ behorigheter: ['anvandare_redigera'] })).ok, false);
  assertEquals(tolkaNyAdmin(ny({ behorigheter: ['anvandare_redigera', 'anvandare_las'] })).ok, true);
  const s = tolkaNyAdmin(ny({ superadmin: true, behorigheter: ['leads'] }));
  assertEquals(s.ok && s.admin.behorigheter, [], 'en superadmin har allt; listan bredvid följer inte med');
  assertEquals(tolkaNyAdmin(ny({ superadmin: 'true' })), tolkaNyAdmin(ny()), 'bara true är superadmin');
});

Deno.test('en ny admin: prövas, bjuds in, får adressen och rollen', async () => {
  const v = varld();
  const s = await hanteraNyAdmin(ny(), v.b);
  assertEquals(s, { status: 200, kropp: { ok: true, id: 'ny-id', epost: 'ny.admin@example.se' } });
  assertEquals(v.logg, ['kan ge leads,matchning', 'finns ny.admin@example.se', 'bjud in ny.admin@example.se Nina Admin',
    'adress ny-id', 'gör ny-id leads,matchning']);
});

Deno.test('databasen säger nej före inbjudan: ingen inbjudan skickas', async () => {
  const v = varld({ kanGe: 'Du kan inte ge en behörighet du inte har själv.' });
  const s = await hanteraNyAdmin(ny(), v.b);
  assertEquals(s, { status: 403, kropp: { error: 'Du kan inte ge en behörighet du inte har själv.' } });
  assertEquals(v.logg, ['kan ge leads,matchning']);
});

Deno.test('en adress med konto pekas mot Befintlig användare', async () => {
  const v1 = varld({ finns: true });
  assertEquals(await hanteraNyAdmin(ny(), v1.b), { status: 409, kropp: { error: REDAN_KONTO } });
  assertEquals(v1.logg.some((r) => r.startsWith('bjud in')), false);

  const v2 = varld({ bjudFel: 'A user with this email address has already been registered' });
  assertEquals(await hanteraNyAdmin(ny(), v2.b), { status: 409, kropp: { error: REDAN_KONTO } });
});

Deno.test('nekas rollen efter inbjudan tas kontot bort', async () => {
  const v = varld({ gorFel: 'Bara en superadmin kan göra någon till superadmin.' });
  const s = await hanteraNyAdmin(ny(), v.b);
  assertEquals(s.status, 403);
  assertEquals(v.logg.at(-1), 'ta bort ny-id');
});

Deno.test('ett fel i Auth som inte är en dubblett säger inte "finns redan"', async () => {
  const v = varld({ bjudFel: 'rate limit exceeded' });
  const s = await hanteraNyAdmin(ny(), v.b);
  assertEquals(s.status, 502);
});
