// ============================================================
// NEXTRUM — prov för _delad/tillagg.ts (syskontillägget som skuld, 2026-10-21)
//
// Skrivna före modulen, som Leo bad om: "Skriv testerna för pengalogik
// (beloppsberäkning, hopbuntning av betalning, bonusuppdelning) före
// själva implementationen." Utan nät och utan databas: databasen är en
// falsk TillaggDb med försöken och posterna i minnet, och Stripes
// leveranser går genom webhooken.ts med ett falskt händelselager.
// ============================================================

import { assertEquals, assertRejects, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buntaKassan, fordelaAterbetalningar, type Forsoket, forsoketsKassa, forsokUrMetadata, gamlaKassanGarUt,
  hanteraTillagg, type KassaStripe, tillaggetFoljerMed, tillaggetsBelopp, tillaggetsLinje, tillaggetsRadtext,
  type TillaggDb, utgangstid,
} from './tillagg.ts';
import { type Handelselager, markeraKlar, taEmotLeverans } from './webhooken.ts';

// ---------- beloppet ----------

Deno.test('tillägget: ett extra barn i en timme är priset per barn och timme', () => {
  assertEquals(tillaggetsBelopp(1, 6900, 60), 6900);
});

Deno.test('tillägget: en och en halv timme räknas på minuterna', () => {
  assertEquals(tillaggetsBelopp(1, 6900, 90), 10350);
});

Deno.test('tillägget: två extra barn är två gånger priset', () => {
  assertEquals(tillaggetsBelopp(2, 6900, 60), 13800);
  assertEquals(tillaggetsBelopp(2, 6900, 90), 20700);
});

Deno.test('tillägget: inga extra barn är inget tillägg', () => {
  assertEquals(tillaggetsBelopp(0, 6900, 60), 0);
  assertEquals(tillaggetsBelopp(0, 6900, 180), 0);
});

Deno.test('tillägget: avrundas till hela ören, som databasen', () => {
  // 6901 × 50 / 60 = 5750,83 öre
  assertEquals(tillaggetsBelopp(1, 6901, 50), 5751);
  // 6900 × 45 / 60 = 5175 öre jämnt
  assertEquals(tillaggetsBelopp(1, 6900, 45), 5175);
  // 6901 × 30 / 60 = 3450,5 öre: uppåt, som round() i Postgres
  assertEquals(tillaggetsBelopp(1, 6901, 30), 3451);
});

Deno.test('tillägget: ett belopp som inte går att räkna är ett fel, aldrig noll', () => {
  assertThrows(() => tillaggetsBelopp(-1, 6900, 60));
  assertThrows(() => tillaggetsBelopp(1.5, 6900, 60));
  assertThrows(() => tillaggetsBelopp(1, -6900, 60));
  assertThrows(() => tillaggetsBelopp(1, 6900, 0));
  assertThrows(() => tillaggetsBelopp(1, Number.NaN, 60));
});

Deno.test('tillägget: raden i kassan säger antalet pass och nämner inga barn', () => {
  assertEquals(tillaggetsRadtext(1), 'Upplupet tillägg för extra barn, 1 pass');
  assertEquals(tillaggetsRadtext(3), 'Upplupet tillägg för extra barn, 3 pass');
});

Deno.test('tillägget: raden i Stripes kassa har databasens belopp, och inget barn', () => {
  const l = tillaggetsLinje(13800, 2, 'sek');
  assertEquals(l.quantity, 1);
  assertEquals(l.price_data.unit_amount, 13800);
  assertEquals(l.price_data.currency, 'sek');
  assertEquals(l.price_data.product_data.name, 'Upplupet tillägg för extra barn, 2 pass');
  assertThrows(() => tillaggetsLinje(0, 2, 'sek'));
  assertThrows(() => tillaggetsLinje(13800, 0, 'sek'));
});

Deno.test('tillägget: kassan går ut när försöket gör det, så att två tryck ger samma kassa', () => {
  const nu = Date.parse('2026-10-21T12:00:00Z');
  assertEquals(utgangstid('2026-10-21T12:30:30Z', nu), Date.parse('2026-10-21T12:30:30Z') / 1000);
  assertEquals(utgangstid('2026-10-21T12:30:30Z', nu + 60_000), Date.parse('2026-10-21T12:30:30Z') / 1000);
  // Utan försökets tid: 30 minuter och en halv från nu, som databasen.
  assertEquals(utgangstid(null, nu), nu / 1000 + 1830);
});

// ---------- hopbuntningen ----------

const PLAN = { typ: 'plan' as const, namn: 'Standard', beloppOre: 303200, rabattOre: 30320, kod: 'ZAYAN10' };

Deno.test('bunta: följer med när regeln är på, och annars tills familjen kryssat ur', () => {
  assertEquals(tillaggetFoljerMed(true, false), true);
  assertEquals(tillaggetFoljerMed(true, undefined), true);
  assertEquals(tillaggetFoljerMed(false, undefined), true);
  assertEquals(tillaggetFoljerMed(false, true), true);
  assertEquals(tillaggetFoljerMed(false, false), false);
  // Bara ett uttryckligt false kryssar ur: en sträng eller noll gör det inte.
  assertEquals(tillaggetFoljerMed(false, 'false'), true);
  assertEquals(tillaggetFoljerMed(false, 0), true);
});

Deno.test('bunta: rabattkoden räknas bara på planraden, tilläggsraden är orörd och totalen stämmer', () => {
  const k = buntaKassan(PLAN, { beloppOre: 13800, antalPass: 2 }, { obligatorisk: true, med: true });
  assertEquals(k.medTillagg, true);
  assertEquals(k.rader.length, 2);
  assertEquals(k.rader[0], { typ: 'plan', namn: 'Standard', beloppOre: 272880, rabattOre: 30320, kod: 'ZAYAN10' });
  assertEquals(k.rader[1], {
    typ: 'tillagg', namn: 'Upplupet tillägg för extra barn, 2 pass', beloppOre: 13800, rabattOre: 0, kod: null,
  });
  assertEquals(k.totalOre, 272880 + 13800);
});

Deno.test('bunta: med regeln på följer tillägget med, också om familjen kryssat ur', () => {
  const k = buntaKassan(PLAN, { beloppOre: 13800, antalPass: 2 }, { obligatorisk: true, med: false });
  assertEquals(k.medTillagg, true);
  assertEquals(k.totalOre, 286680);
});

Deno.test('bunta: med regeln av får familjen kryssa ur raden, och utan kryss följer den med', () => {
  const ur = buntaKassan(PLAN, { beloppOre: 13800, antalPass: 2 }, { obligatorisk: false, med: false });
  assertEquals(ur.medTillagg, false);
  assertEquals(ur.rader.map((r) => r.typ), ['plan']);
  assertEquals(ur.totalOre, 272880);
  const tyst = buntaKassan(PLAN, { beloppOre: 13800, antalPass: 2 }, { obligatorisk: false, med: undefined });
  assertEquals(tyst.medTillagg, true);
  assertEquals(tyst.totalOre, 286680);
});

Deno.test('bunta: utan skuld är det bara planen', () => {
  for (const t of [null, { beloppOre: 0, antalPass: 0 }]) {
    const k = buntaKassan(PLAN, t, { obligatorisk: true, med: true });
    assertEquals(k.medTillagg, false);
    assertEquals(k.rader.length, 1);
    assertEquals(k.totalOre, 272880);
  }
});

Deno.test('bunta: Fyll timbanken utan kod får tillägget på samma sätt', () => {
  const kort = { typ: 'timbank' as const, namn: 'Fyll timbanken, 10 timmar', beloppOre: 399000, rabattOre: 0, kod: null };
  const k = buntaKassan(kort, { beloppOre: 6900, antalPass: 1 }, { obligatorisk: true, med: true });
  assertEquals(k.rader.map((r) => [r.typ, r.beloppOre]), [['timbank', 399000], ['tillagg', 6900]]);
  assertEquals(k.totalOre, 405900);
});

Deno.test('bunta: en rabatt blir aldrig hela priset eller mer, och aldrig negativ', () => {
  assertThrows(() => buntaKassan({ ...PLAN, rabattOre: 303200 }, null, { obligatorisk: true, med: true }));
  assertThrows(() => buntaKassan({ ...PLAN, rabattOre: -1 }, null, { obligatorisk: true, med: true }));
  assertThrows(() => buntaKassan(PLAN, { beloppOre: -5, antalPass: 1 }, { obligatorisk: true, med: true }));
});

// ---------- en kassa åt gången (granskningen 2026-10-21) ----------

/** Stripes kassor i minnet: läget och ui per session, och vad som hände. */
function falskaKassor(kassor: Record<string, { status: string; ui_mode: string }>) {
  const logg: string[] = [];
  const stripe: KassaStripe = {
    utgang: (sid) => {
      logg.push('utgang ' + sid);
      const k = kassor[sid];
      if (!k || k.status !== 'open') return Promise.reject(new Error('Bara en öppen kassa kan gå ut.'));
      k.status = 'expired';
      return Promise.resolve({});
    },
    hamta: (sid) => {
      logg.push('hamta ' + sid);
      return Promise.resolve({ ...(kassor[sid] ?? { status: 'expired', ui_mode: 'hosted' }) });
    },
  };
  return { stripe, logg, kassor };
}

function forsoken(...svar: Forsoket[]) {
  const slappta: string[] = [];
  let i = 0;
  return {
    slappta,
    skapa: () => Promise.resolve(svar[Math.min(i++, svar.length - 1)]),
    slapp: (f: string, orsak: string) => {
      slappta.push(`${f}:${orsak}`);
      return Promise.resolve();
    },
    antal: () => i,
  };
}

const NYTT: Forsoket = { forsok: 'f2', belopp_ore: 20700, antal_pass: 3, aterbruk: false, session: null };
const ATERBRUKAT: Forsoket = { forsok: 'f1', belopp_ore: 20700, antal_pass: 3, aterbruk: true, session: 'cs_test_a1' };

Deno.test('en kassa: samma försök, samma läge och öppen kassa ger samma kassa och inget släpps', async () => {
  const k = falskaKassor({ cs_test_a1: { status: 'open', ui_mode: 'embedded' } });
  const f = forsoken(ATERBRUKAT);
  const svar = await forsoketsKassa(k.stripe, f.slapp, f.skapa, true);
  assertEquals(svar, ATERBRUKAT);
  assertEquals(f.slappta, []);
  assertEquals(k.logg, ['hamta cs_test_a1']);
  assertEquals(k.kassor.cs_test_a1.status, 'open');
});

Deno.test('en kassa: sida i stället för inbäddad stänger den gamla och ger ett nytt försök', async () => {
  const k = falskaKassor({ cs_test_a1: { status: 'open', ui_mode: 'embedded' } });
  const f = forsoken(ATERBRUKAT, NYTT);
  const svar = await forsoketsKassa(k.stripe, f.slapp, f.skapa, false);
  assertEquals(svar, NYTT);
  assertEquals(f.slappta, ['f1:ersatt']);
  assertEquals(k.kassor.cs_test_a1.status, 'expired');
  assertEquals(f.antal(), 2);
});

Deno.test('en kassa: en gammal kassa som redan betalats (eller väntar på Klarna) ger ingen ny', async () => {
  const k = falskaKassor({ cs_test_a1: { status: 'complete', ui_mode: 'embedded' } });
  const f = forsoken(ATERBRUKAT, NYTT);
  assertEquals(await forsoketsKassa(k.stripe, f.slapp, f.skapa, false), 'pagar');
  assertEquals(f.slappta, []);
  assertEquals(f.antal(), 1);
});

Deno.test('en kassa: en kassa som gått ut ersätts, i samma läge också', async () => {
  const k = falskaKassor({ cs_test_a1: { status: 'expired', ui_mode: 'embedded' } });
  const f = forsoken(ATERBRUKAT, NYTT);
  assertEquals(await forsoketsKassa(k.stripe, f.slapp, f.skapa, true), NYTT);
  assertEquals(f.slappta, ['f1:ersatt']);
});

Deno.test('en kassa: databasen ersatte ett försök nära utgången, och dess kassa går ut', async () => {
  const k = falskaKassor({ cs_test_gammal: { status: 'open', ui_mode: 'hosted' } });
  const f = forsoken({ ...NYTT, ersatt_session: 'cs_test_gammal' });
  const svar = await forsoketsKassa(k.stripe, f.slapp, f.skapa, true);
  assertEquals((svar as Forsoket).forsok, 'f2');
  assertEquals(k.kassor.cs_test_gammal.status, 'expired');
  assertEquals(f.slappta, []);
});

Deno.test('en kassa: hann den ersatta kassan betalas släpps det nya försöket', async () => {
  const k = falskaKassor({ cs_test_gammal: { status: 'complete', ui_mode: 'hosted' } });
  const f = forsoken({ ...NYTT, ersatt_session: 'cs_test_gammal' });
  assertEquals(await forsoketsKassa(k.stripe, f.slapp, f.skapa, true), 'pagar');
  assertEquals(f.slappta, ['f2:avbruten']);
});

Deno.test('en kassa: en kassa som inte går att stänga är ett fel, aldrig en kassa till', async () => {
  const stripe: KassaStripe = {
    utgang: () => Promise.reject(new Error('nätet föll')),
    hamta: () => Promise.resolve({ status: 'open', ui_mode: 'embedded' }),
  };
  await assertRejects(() => gamlaKassanGarUt(stripe, 'cs_test_x'));
  const f = forsoken(ATERBRUKAT, NYTT);
  await assertRejects(() => forsoketsKassa(stripe, f.slapp, f.skapa, false));
  assertEquals(f.slappta, []);
});

Deno.test('en kassa: utan försök eller utan kassa görs inget hos Stripe', async () => {
  const k = falskaKassor({});
  const utan = forsoken({ forsok: null, belopp_ore: 0, antal_pass: 0, pagar: true });
  assertEquals((await forsoketsKassa(k.stripe, utan.slapp, utan.skapa, true) as Forsoket).pagar, true);
  assertEquals(await gamlaKassanGarUt(k.stripe, null), 'borta');
  assertEquals(await gamlaKassanGarUt(k.stripe, 'inte-en-kassa'), 'borta');
  assertEquals(k.logg, []);
});

// ---------- återbetalningen per rad ----------

const RADER = [
  { id: 'rad-plan', beloppOre: 272880 },
  { id: 'rad-t1', beloppOre: 6900 },
  { id: 'rad-t2', beloppOre: 6900 },
];

Deno.test('återbetalning: en delåterbetalning berör bara sin rad', () => {
  const f = fordelaAterbetalningar(RADER, [{ id: 're_1', amount: 5000, metadata: { betalningsrad: 'rad-t1' } }]);
  assertEquals(f.perRad, { 'rad-plan': 0, 'rad-t1': 5000, 'rad-t2': 0 });
  assertEquals(f.ofordelat, 0);
  assertEquals(f.overskott, 0);
});

Deno.test('återbetalning: en rad får aldrig mer tillbaka än den betalade', () => {
  const f = fordelaAterbetalningar(RADER, [
    { id: 're_1', amount: 5000, metadata: { betalningsrad: 'rad-t1' } },
    { id: 're_2', amount: 4000, metadata: { betalningsrad: 'rad-t1' } },
  ]);
  assertEquals(f.perRad['rad-t1'], 6900);
  assertEquals(f.overskott, 2100);
  assertEquals(f.perRad['rad-t2'], 0);
});

Deno.test('återbetalning: utan rad i metadata, eller med en okänd, är den ofördelad', () => {
  const f = fordelaAterbetalningar(RADER, [
    { id: 're_1', amount: 1000 },
    { id: 're_2', amount: 2000, metadata: { betalningsrad: 'finns-inte' } },
  ]);
  assertEquals(f.ofordelat, 3000);
  assertEquals(Object.values(f.perRad).reduce((a, b) => a + b, 0), 0);
});

Deno.test('återbetalning: köpets återbetalning (köpets id i metadata) hör till planens rad', () => {
  const rader = [{ id: 'rad-plan', beloppOre: 151600, klippkortId: 'kk-1' }, { id: 'rad-t1', beloppOre: 6900 }];
  const f = fordelaAterbetalningar(rader, [
    { id: 're_k', amount: 37900, status: 'succeeded', metadata: { klippkort_id: 'kk-1', timmar: '1' } },
    { id: 're_t', amount: 6900, status: 'succeeded', metadata: { betalningsrad: 'rad-t1' } },
    { id: 're_x', amount: 500, status: 'succeeded', metadata: { klippkort_id: 'ett-annat-kop' } },
  ]);
  assertEquals(f.perRad, { 'rad-plan': 37900, 'rad-t1': 6900 });
  assertEquals(f.ofordelat, 500);
});

Deno.test('återbetalning: en misslyckad återbetalning räknas inte', () => {
  const f = fordelaAterbetalningar(RADER, [
    { id: 're_1', amount: 6900, status: 'failed', metadata: { betalningsrad: 'rad-t1' } },
    { id: 're_2', amount: 1000, status: 'canceled', metadata: { betalningsrad: 'rad-t2' } },
  ]);
  assertEquals(f.perRad, { 'rad-plan': 0, 'rad-t1': 0, 'rad-t2': 0 });
});

Deno.test('återbetalning: samma återbetalning två gånger räknas en gång', () => {
  const r = { id: 're_1', amount: 3000, metadata: { betalningsrad: 'rad-t2' } };
  const f = fordelaAterbetalningar(RADER, [r, r]);
  assertEquals(f.perRad['rad-t2'], 3000);
});

// ---------- försöket i metadata ----------

Deno.test('metadata: bara ett uuid är ett försök', () => {
  const id = '6f1c2e7a-1b2c-4d5e-8f90-1a2b3c4d5e6f';
  assertEquals(forsokUrMetadata({ tillagg_forsok: id }), id);
  assertEquals(forsokUrMetadata({ tillagg_forsok: 'DROP TABLE' }), null);
  assertEquals(forsokUrMetadata({}), null);
  assertEquals(forsokUrMetadata(null), null);
});

// ---------- webhooken, med en falsk databas ----------

type Post = { id: string; status: string; forsok: string | null; belopp: number };
type Forsok = { id: string; status: string; belopp: number; poster: string[]; pi: string | null };

/** Försöken och posterna som databasen håller dem (tillagg_forsok_betald och syskonen). */
function falskDb(poster: Post[], forsok: Forsok[]) {
  const effekter: string[] = [];
  const P = new Map(poster.map((p) => [p.id, { ...p }]));
  const F = new Map(forsok.map((f) => [f.id, { ...f }]));
  const db: TillaggDb = {
    betald: (a) => {
      const f = F.get(a.forsok);
      if (!f) return Promise.resolve('okant');
      if (f.status === 'betald') return Promise.resolve(f.pi === a.pi ? 'redan' : 'dubbel');
      if (a.belopp !== f.belopp) return Promise.resolve('fel_belopp');
      f.status = 'betald';
      f.pi = a.pi;
      for (const id of f.poster) {
        const p = P.get(id)!;
        if (p.forsok === f.id && p.status === 'i_betalning') { p.status = 'betald'; p.forsok = null; }
      }
      effekter.push('betald:' + f.id);
      return Promise.resolve('betald');
    },
    vantar: (a) => {
      const f = F.get(a.forsok);
      if (!f || f.status !== 'oppen') return Promise.resolve(false);
      f.status = 'vantar';
      effekter.push('vantar:' + f.id);
      return Promise.resolve(true);
    },
    slapp: (a) => {
      const f = F.get(a.forsok);
      if (!f || (f.status !== 'oppen' && f.status !== 'vantar')) return Promise.resolve(false);
      f.status = a.orsak;
      for (const id of f.poster) {
        const p = P.get(id)!;
        if (p.forsok === f.id && p.status === 'i_betalning') { p.status = 'upplupen'; p.forsok = null; }
      }
      effekter.push('slapp:' + f.id);
      return Promise.resolve(true);
    },
    tvist: (a) => {
      effekter.push('tvist:' + a.charge + ':' + a.lage);
      return Promise.resolve(true);
    },
  };
  return { db, effekter, P, F };
}

const F1 = '6f1c2e7a-1b2c-4d5e-8f90-1a2b3c4d5e6f';
const sessionen = (o: Record<string, unknown> = {}) => ({
  id: 'cs_test_1', mode: 'payment', payment_status: 'paid', amount_total: 13800, payment_intent: 'pi_tillagg_1',
  metadata: { tillagg_forsok: F1, familj: 'familj-1' }, ...o,
});

Deno.test('webhook: manuell betalning av hela skulden sätter försökets poster betalda', async () => {
  const { db, effekter, P } = falskDb(
    [{ id: 'A', status: 'i_betalning', forsok: F1, belopp: 6900 }, { id: 'B', status: 'i_betalning', forsok: F1, belopp: 6900 }],
    [{ id: F1, status: 'oppen', belopp: 13800, poster: ['A', 'B'], pi: null }],
  );
  const r = await hanteraTillagg('checkout.session.completed', sessionen(), true, db);
  assertEquals(r, 'tillägg betalt');
  assertEquals([P.get('A')!.status, P.get('B')!.status], ['betald', 'betald']);
  assertEquals(effekter, ['betald:' + F1]);
});

Deno.test('webhook: betalningens charge, avgift och netto följer med till databasen', async () => {
  const sett: unknown[] = [];
  const { db } = falskDb(
    [{ id: 'A', status: 'i_betalning', forsok: F1, belopp: 6900 }],
    [{ id: F1, status: 'oppen', belopp: 6900, poster: ['A'], pi: null }],
  );
  const betald = db.betald;
  db.betald = (a) => { sett.push(a); return betald(a); };
  await hanteraTillagg('checkout.session.completed', sessionen({ amount_total: 6900 }), false, db,
    (pi) => Promise.resolve({ chargeId: 'ch_' + pi.slice(3), avgiftOre: 120, nettoOre: 6780 }));
  assertEquals(sett, [{ forsok: F1, pi: 'pi_tillagg_1', charge: 'ch_tillagg_1', belopp: 6900, skarp: false,
                         avgift: 120, netto: 6780 }]);
});

Deno.test('webhook: en betalning som bara täcker försökets poster stänger inga andra', async () => {
  // C blev upplupen efter att försöket skapades: den följer inte med.
  const { db, P } = falskDb(
    [{ id: 'A', status: 'i_betalning', forsok: F1, belopp: 6900 }, { id: 'C', status: 'upplupen', forsok: null, belopp: 6900 }],
    [{ id: F1, status: 'oppen', belopp: 6900, poster: ['A'], pi: null }],
  );
  await hanteraTillagg('checkout.session.completed', sessionen({ amount_total: 6900 }), true, db);
  assertEquals(P.get('A')!.status, 'betald');
  assertEquals(P.get('C')!.status, 'upplupen');
});

Deno.test('webhook: ett belopp som inte är försökets markerar ingenting betalt', async () => {
  const { db, P } = falskDb(
    [{ id: 'A', status: 'i_betalning', forsok: F1, belopp: 6900 }],
    [{ id: F1, status: 'oppen', belopp: 6900, poster: ['A'], pi: null }],
  );
  const r = await hanteraTillagg('checkout.session.completed', sessionen({ amount_total: 100 }), true, db);
  assertEquals(r, 'tillägg: beloppet stämmer inte, ingenting markerat');
  assertEquals(P.get('A')!.status, 'i_betalning');
});

Deno.test('webhook: en session som väntar på pengarna (Klarna) släpps inte, och inget är betalt', async () => {
  const { db, F, P } = falskDb(
    [{ id: 'A', status: 'i_betalning', forsok: F1, belopp: 6900 }],
    [{ id: F1, status: 'oppen', belopp: 6900, poster: ['A'], pi: null }],
  );
  const r = await hanteraTillagg('checkout.session.completed', sessionen({ payment_status: 'unpaid' }), true, db);
  assertEquals(r, 'tillägg: väntar på betalningen');
  assertEquals(F.get(F1)!.status, 'vantar');
  assertEquals(P.get('A')!.status, 'i_betalning');
});

Deno.test('webhook: ett köp med tillägget som väntar på pengarna märks också, så att jobbet inte släpper det', async () => {
  const { db, F, effekter } = falskDb(
    [{ id: 'A', status: 'i_betalning', forsok: F1, belopp: 6900 }],
    [{ id: F1, status: 'oppen', belopp: 6900, poster: ['A'], pi: null }],
  );
  const r = await hanteraTillagg('checkout.session.completed',
    sessionen({ payment_status: 'unpaid', metadata: { tillagg_forsok: F1, klippkort_id: 'kk-1' } }), true, db);
  assertEquals(r, 'tillägg: väntar på betalningen');
  assertEquals(F.get(F1)!.status, 'vantar');
  assertEquals(effekter, ['vantar:' + F1]);
});

Deno.test('webhook: en utgången och en avbruten session släpper posterna', async () => {
  for (const [typ, orsak] of [['checkout.session.expired', 'utgangen'], ['checkout.session.async_payment_failed', 'avbruten']]) {
    const { db, F, P } = falskDb(
      [{ id: 'A', status: 'i_betalning', forsok: F1, belopp: 6900 }],
      [{ id: F1, status: 'oppen', belopp: 6900, poster: ['A'], pi: null }],
    );
    const r = await hanteraTillagg(typ, sessionen({ payment_status: 'unpaid' }), true, db);
    assertEquals(r, 'tillägg släppt');
    assertEquals(F.get(F1)!.status, orsak);
    assertEquals([P.get('A')!.status, P.get('A')!.forsok], ['upplupen', null]);
  }
});

Deno.test('webhook: en session utan försök är inte tilläggets, och då gör modulen ingenting', async () => {
  const { db, effekter } = falskDb([], []);
  assertEquals(await hanteraTillagg('checkout.session.completed', sessionen({ metadata: { booking_id: 'pass-1' } }), true, db), null);
  // Ett tillägg som buntats med ett köp skrivs av köpets gren, inte här.
  assertEquals(await hanteraTillagg('checkout.session.completed',
    sessionen({ metadata: { tillagg_forsok: F1, klippkort_id: 'kk-1' } }), true, db), null);
  assertEquals(effekter, []);
});

Deno.test('webhook: en tvist på en tilläggsbetalning flaggas, och posterna rörs inte', async () => {
  const { db, effekter, P } = falskDb([{ id: 'A', status: 'betald', forsok: null, belopp: 6900 }], []);
  const r = await hanteraTillagg('charge.dispute.created', { id: 'dp_1', charge: 'ch_1', status: 'needs_response' }, true, db);
  assertEquals(r, 'tillägg: tvisten flaggad');
  assertEquals(effekter, ['tvist:ch_1:needs_response']);
  assertEquals(P.get('A')!.status, 'betald');
});

// ---------- signaturen och samma händelse två gånger ----------

const HEMLIGHET = 'whsec_prov_tillagg_aldrig_skarp';

async function signera(kropp: string, hemlighet = HEMLIGHET): Promise<string> {
  const t = Math.floor(Date.now() / 1000);
  const nyckel = await crypto.subtle.importKey('raw', new TextEncoder().encode(hemlighet),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', nyckel, new TextEncoder().encode(`${t}.${kropp}`)));
  return `t=${t},v1=${[...sig].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

function lager(): Handelselager {
  const rader = new Map<string, { hanterad_at: string | null; resultat: string | null }>();
  return {
    spara: (rad) => Promise.resolve(rader.has(rad.id) ? { error: { code: '23505', message: 'duplicate key' } }
      : (rader.set(rad.id, { hanterad_at: null, resultat: null }), { error: null })),
    hanterad: (id) => Promise.resolve({ data: rader.has(id) ? { hanterad_at: rader.get(id)!.hanterad_at } : null, error: null }),
    markera: (id, resultat) => {
      const r = rader.get(id);
      if (r) { r.hanterad_at = new Date().toISOString(); r.resultat = resultat; }
      return Promise.resolve({ error: null });
    },
  };
}

/** Webhookens väg för ett tillägg: mottagningen, sedan modulen, sedan markeringen. */
async function leverera(l: Handelselager, db: TillaggDb, kropp: string, signatur: string): Promise<string> {
  const lev = await taEmotLeverans(kropp, signatur, HEMLIGHET, l);
  if (lev.gora !== 'kor') return lev.gora;
  const h = lev.handelse as { type: string; data: { object: Record<string, unknown> } };
  const r = await hanteraTillagg(h.type, h.data.object, lev.skarp, db);
  await markeraKlar(l, lev.id, r ?? 'ohanterad');
  return r ?? 'ohanterad';
}

Deno.test('webhook: samma händelse två gånger ger en effekt', async () => {
  const { db, effekter } = falskDb(
    [{ id: 'A', status: 'i_betalning', forsok: F1, belopp: 6900 }],
    [{ id: F1, status: 'oppen', belopp: 6900, poster: ['A'], pi: null }],
  );
  const l = lager();
  const kropp = JSON.stringify({ id: 'evt_t1', type: 'checkout.session.completed', livemode: false,
    data: { object: sessionen({ amount_total: 6900 }) } });
  assertEquals(await leverera(l, db, kropp, await signera(kropp)), 'tillägg betalt');
  assertEquals(await leverera(l, db, kropp, await signera(kropp)), 'kvittera');
  assertEquals(effekter, ['betald:' + F1]);
});

Deno.test('webhook: en ogiltig signatur nekas, och ingenting händer', async () => {
  const { db, effekter } = falskDb(
    [{ id: 'A', status: 'i_betalning', forsok: F1, belopp: 6900 }],
    [{ id: F1, status: 'oppen', belopp: 6900, poster: ['A'], pi: null }],
  );
  const kropp = JSON.stringify({ id: 'evt_t2', type: 'checkout.session.completed', livemode: false,
    data: { object: sessionen({ amount_total: 6900 }) } });
  assertEquals(await leverera(lager(), db, kropp, await signera(kropp, 'whsec_fel')), 'neka');
  assertEquals(effekter, []);
});
