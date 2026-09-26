// ============================================================
// Proven för google_konto.ts, mot en databas i minnet.
//
// Det som vaktas är filens två regler: ett fel lämnar kopplingen stå
// (men säger det), och bara ett dött godkännande tar bort den — och då
// bara raden med den token som faktiskt föll.
// ============================================================

import { assert, assertEquals, assertFalse } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import type { Hamta } from './google.ts';
import { atkomstTillKontot, kopplaBort, sparaKoppling } from './google_konto.ts';

const KLIENT = { id: 'id', hemlighet: 'hemlighet' };
const ADMIN = '5f0c8a8e-2b7d-4c3e-9a1f-0d2e4b6c8a10';

type Rad = { id: true; konto: string; refresh_token: string; scopes: string; kopplad_at: string };

/* Bara det supabase-js-anrop google_konto.ts gör, och inget mer: en
   byggare som minns operationen och filtren och körs när den väntas in. */
function minnesdb(start: Rad | null) {
  const lage = { rad: start, status: {} as Record<string, unknown>, statusskrivningar: 0 };

  function from(tabell: string) {
    let op: 'select' | 'update' | 'upsert' | 'delete' = 'select';
    let varden: Record<string, unknown> = {};
    const filter: Record<string, unknown> = {};

    const matchar = () => !!lage.rad
      && Object.entries(filter).every(([k, v]) => (lage.rad as unknown as Record<string, unknown>)[k] === v);

    function kor(): { data: unknown; error: null } {
      if (tabell === 'integrationer') {
        assertEquals(op, 'update');
        assertEquals(filter.tjanst, 'google_workspace');
        lage.statusskrivningar++;
        Object.assign(lage.status, varden);
        return { data: null, error: null };
      }
      assertEquals(tabell, 'google_koppling');
      if (op === 'upsert') {
        lage.rad = varden as unknown as Rad;
        return { data: null, error: null };
      }
      if (op === 'delete') {
        if (!matchar()) return { data: [], error: null };
        lage.rad = null;
        return { data: [{ id: true }], error: null };
      }
      return { data: matchar() ? { konto: lage.rad!.konto, refresh_token: lage.rad!.refresh_token } : null, error: null };
    }

    const b = {
      select: (_k?: string) => b,
      update: (v: Record<string, unknown>) => { op = 'update'; varden = v; return b; },
      upsert: (v: Record<string, unknown>) => { op = 'upsert'; varden = v; return b; },
      delete: () => { op = 'delete'; return b; },
      eq: (k: string, v: unknown) => { filter[k] = v; return b; },
      maybeSingle: () => Promise.resolve(kor()),
      then: (ok: (v: unknown) => unknown, nej?: (e: unknown) => unknown) => Promise.resolve(kor()).then(ok, nej),
    };
    return b;
  }

  return { db: { from } as unknown as SupabaseClient, lage };
}

function rad(token = '1//gammal'): Rad {
  return { id: true, konto: 'info@nextrum.se', refresh_token: token, scopes: 'openid', kopplad_at: '2026-09-25T10:00:00Z' };
}

function google(status: number, kropp: unknown): Hamta {
  return (() => Promise.resolve(new Response(JSON.stringify(kropp), { status }))) as Hamta;
}

Deno.test('utan koppling finns ingen åtkomst, och statusen rörs inte', async () => {
  const { db, lage } = minnesdb(null);
  const a = await atkomstTillKontot(db, KLIENT, google(200, { access_token: 'x' }));
  assertEquals(a, { ok: false, kopplad: false, text: 'Google är inte kopplat.' });
  assertEquals(lage.statusskrivningar, 0);
});

Deno.test('saknade secrets är ett fel, inte en bortkoppling', async () => {
  const { db, lage } = minnesdb(rad());
  const a = await atkomstTillKontot(db, null, google(200, { access_token: 'x' }));
  assertFalse(a.ok);
  assert(!a.ok && a.kopplad);
  assert(lage.rad, 'raden ska stå kvar');
  assertEquals(lage.status.kopplad, undefined);
  assert(String(lage.status.senaste_fel).includes('GOOGLE_KLIENT_ID'));
});

Deno.test('en förnyad åtkomst skriver ingenting', async () => {
  const { db, lage } = minnesdb(rad());
  const a = await atkomstTillKontot(db, KLIENT, google(200, { access_token: 'ya29.nu' }));
  assertEquals(a, { ok: true, konto: 'info@nextrum.se', token: 'ya29.nu' });
  assertEquals(lage.statusskrivningar, 0);
});

Deno.test('ett dött godkännande kopplar bort och säger varför', async () => {
  const { db, lage } = minnesdb(rad());
  const a = await atkomstTillKontot(db, KLIENT, google(400, { error: 'invalid_grant' }));
  assert(!a.ok && !a.kopplad);
  assertEquals(lage.rad, null);
  assertEquals(lage.status.kopplad, false);
  assertEquals(lage.status.konto, null);
  assert(String(lage.status.senaste_fel).includes('Koppla Google igen'));
});

Deno.test('en hicka hos Google lämnar kopplingen stå', async () => {
  const { db, lage } = minnesdb(rad());
  const a = await atkomstTillKontot(db, KLIENT, google(503, {}));
  assert(!a.ok && a.kopplad);
  assert(lage.rad, 'raden ska stå kvar');
  assertEquals('kopplad' in lage.status, false);
  assert(String(lage.status.senaste_fel).length > 0);
});

Deno.test('en token som föll tar inte bort en koppling som hunnit göras om', async () => {
  const { db, lage } = minnesdb(rad('1//ny'));
  assertFalse(await kopplaBort(db, 'gammalt fel', '1//gammal'));
  assertEquals(lage.rad?.refresh_token, '1//ny');
  assertEquals(lage.statusskrivningar, 0);
});

Deno.test('koppla från tar bort raden oavsett token', async () => {
  const { db, lage } = minnesdb(rad());
  assert(await kopplaBort(db, null));
  assertEquals(lage.rad, null);
  assertEquals(lage.status.kopplad, false);
  assertEquals(lage.status.senaste_fel, null);
});

Deno.test('en ny koppling sparas och säger vem som gjorde den', async () => {
  const { db, lage } = minnesdb(null);
  await sparaKoppling(db, { konto: 'info@nextrum.se', refresh: '1//r', scopes: 'openid email', admin: ADMIN });
  assertEquals(lage.rad?.refresh_token, '1//r');
  assertEquals(lage.rad?.id, true);
  assertEquals(lage.status.kopplad, true);
  assertEquals(lage.status.konto, 'info@nextrum.se');
  assertEquals(lage.status.kopplad_av, ADMIN);
  assertEquals(lage.status.senaste_fel, null);
});
