// ============================================================
// NEXTRUM — prov för _delad/webhooken.ts (2026-10-21)
//
// Webhookens mottagning utan nät och utan databas: en giltig och en
// ogiltig signatur, och samma händelse två gånger som ger EN effekt.
// stripe_handelser är en Map med tabellens primärnyckel.
// ============================================================

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { type Handelselager, type Leverans, markeraKlar, taEmotLeverans } from './webhooken.ts';

const HEMLIGHET = 'whsec_prov_hemlighet_som_aldrig_anvands_skarpt';

async function signera(kropp: string, hemlighet = HEMLIGHET, tid?: number): Promise<string> {
  const t = tid ?? Math.floor(Date.now() / 1000);
  const nyckel = await crypto.subtle.importKey('raw', new TextEncoder().encode(hemlighet),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', nyckel, new TextEncoder().encode(`${t}.${kropp}`)));
  return `t=${t},v1=${[...sig].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** stripe_handelser som en Map: id är primärnyckeln. */
function falsktLager(o: { trasig?: boolean } = {}): { lager: Handelselager; rader: Map<string, { hanterad_at: string | null; resultat: string | null }> } {
  const rader = new Map<string, { hanterad_at: string | null; resultat: string | null }>();
  const lager: Handelselager = {
    spara: (rad) => Promise.resolve(
      o.trasig ? { error: { code: '08006', message: 'databasen svarar inte' } }
        : rader.has(rad.id) ? { error: { code: '23505', message: 'duplicate key' } }
        : (rader.set(rad.id, { hanterad_at: null, resultat: null }), { error: null }),
    ),
    hanterad: (id) => Promise.resolve({ data: rader.has(id) ? { hanterad_at: rader.get(id)!.hanterad_at } : null }),
    markera: (id, resultat) => {
      const r = rader.get(id);
      if (r) Object.assign(r, { hanterad_at: '2026-10-21T10:00:00Z', resultat });
      return Promise.resolve({ error: null });
    },
  };
  return { lager, rader };
}

const KROPP = JSON.stringify({
  id: 'evt_prov_1',
  type: 'payment_intent.succeeded',
  livemode: false,
  data: { object: { id: 'pi_prov', amount_received: 39900 } },
});

/** En leverans som webhooken gör den: kör bara på 'kor', och markera klar efter effekten. */
async function leverera(lager: Handelselager, kropp: string, header: string, effekt: () => void): Promise<Leverans> {
  const l = await taEmotLeverans(kropp, header, HEMLIGHET, lager);
  if (l.gora === 'kor') {
    effekt();
    await markeraKlar(lager, l.id, 'klar');
  }
  return l;
}

Deno.test('en giltig signatur tas emot, och händelsen körs med id, typ och testläge', async () => {
  const { lager, rader } = falsktLager();
  const l = await taEmotLeverans(KROPP, await signera(KROPP), HEMLIGHET, lager);
  assertEquals(l.gora, 'kor');
  if (l.gora === 'kor') {
    assertEquals([l.id, l.typ, l.skarp, l.igen], ['evt_prov_1', 'payment_intent.succeeded', false, false]);
  }
  assertEquals(rader.has('evt_prov_1'), true);
});

Deno.test('en ogiltig signatur nekas, och inget skrivs i tabellen', async () => {
  const { lager, rader } = falsktLager();
  const fel = await signera(KROPP, 'whsec_fel_hemlighet');
  const l = await taEmotLeverans(KROPP, fel, HEMLIGHET, lager);
  assertEquals(l.gora, 'neka');
  // En ändrad kropp med en riktig signatur för originalet.
  const pillad = KROPP.replace('39900', '1');
  assertEquals((await taEmotLeverans(pillad, await signera(KROPP), HEMLIGHET, lager)).gora, 'neka');
  // Ingen header alls.
  assertEquals((await taEmotLeverans(KROPP, null, HEMLIGHET, lager)).gora, 'neka');
  assertEquals(rader.size, 0);
});

Deno.test('samma händelse två gånger ger en effekt', async () => {
  const { lager } = falsktLager();
  let effekter = 0;
  const header = await signera(KROPP);
  const forsta = await leverera(lager, KROPP, header, () => effekter++);
  const andra = await leverera(lager, KROPP, await signera(KROPP), () => effekter++);
  assertEquals(forsta.gora, 'kor');
  assertEquals(andra.gora, 'kvittera');
  assertEquals(effekter, 1);
});

Deno.test('en leverans som föll innan den blev klar körs om, och sedan aldrig mer', async () => {
  const { lager } = falsktLager();
  let effekter = 0;
  // Första leveransen: tabellraden skrivs, men effekten kastar och raden blir aldrig klar.
  const forsta = await taEmotLeverans(KROPP, await signera(KROPP), HEMLIGHET, lager);
  assertEquals(forsta.gora, 'kor');
  const andra = await leverera(lager, KROPP, await signera(KROPP), () => effekter++);
  assertEquals(andra.gora === 'kor' && andra.igen, true);
  const tredje = await leverera(lager, KROPP, await signera(KROPP), () => effekter++);
  assertEquals(tredje.gora, 'kvittera');
  assertEquals(effekter, 1);
});

Deno.test('tabellen som inte svarar ger fel, aldrig en tyst kvittens', async () => {
  const { lager } = falsktLager({ trasig: true });
  assertEquals((await taEmotLeverans(KROPP, await signera(KROPP), HEMLIGHET, lager)).gora, 'fel');
});

Deno.test('en händelse utan id eller typ nekas', async () => {
  const { lager } = falsktLager();
  const utan = JSON.stringify({ type: 'charge.refunded', data: {} });
  assertEquals((await taEmotLeverans(utan, await signera(utan), HEMLIGHET, lager)).gora, 'neka');
});
