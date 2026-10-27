// ============================================================
// NEXTRUM — prov för _delad/passkassa.ts (flera pass i samma kassa, 2026-10-27)
//
// Utan nät och utan databas: Stripes två anrop för en äldre kassa är
// falska, och databasens kassa en funktion som svarar det
// passkassa_skapa() svarar. Återbetalningen per rad får liggaren, raderna
// och Stripes lista utifrån, som skrivRaderna får dem.
// ============================================================

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  arFleraPass, type Betalningsrad, kassanForPassen, kassaUrMetadata, lasKassan, type Liggarrad, type Passkassan, passensIdn,
  passetsBelopp, passetsRad, raderUrStripe, skrivRaderna,
} from './passkassa.ts';
import type { KassaStripe } from './tillagg.ts';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';

// ---------- passen i anropet ----------

Deno.test('passen: två till tjugo unika id:n, i gemener', () => {
  assertEquals(passensIdn([A, B]), [A, B]);
  assertEquals(passensIdn([A.toUpperCase(), B]), [A, B]);
  assertEquals(passensIdn(Array.from({ length: 20 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`))?.length, 20);
});

Deno.test('passen: ett ensamt pass betalas pass för pass, och fler än tjugo är för många', () => {
  assertEquals(passensIdn([A]), null);
  assertEquals(passensIdn(Array.from({ length: 21 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)), null);
});

Deno.test('passen: samma pass två gånger, något som inte är ett id, och inte en lista nekas', () => {
  assertEquals(passensIdn([A, A]), null);
  assertEquals(passensIdn([A, A.toUpperCase()]), null);
  assertEquals(passensIdn([A, 'pass']), null);
  assertEquals(passensIdn(A), null);
  assertEquals(passensIdn(null), null);
});

// ---------- beloppet ----------

const pris = { timme: 39900, extra: 6900 };
const bekraftat = { status: 'confirmed', duration_min: 60, antal_barn: 1, rabatt_ore: 0 };

Deno.test('beloppet: ett bekräftat pass kostar den bokade tiden till det frysta priset', () => {
  const b = passetsBelopp({ ...bekraftat, duration_min: 120 }, pris, null, null);
  assertEquals(b.ok && [b.minuter, b.netto], [120, 79800]);
});

Deno.test('beloppet: tillägget för fler barn är ett per timme, oavsett hur många', () => {
  const tva = passetsBelopp({ ...bekraftat, antal_barn: 2 }, pris, null, null);
  const tre = passetsBelopp({ ...bekraftat, antal_barn: 3 }, pris, null, null);
  assertEquals(tva.ok && tva.netto, 46800);
  assertEquals(tre.ok && tre.netto, 46800);
});

Deno.test('beloppet: ett genomfört pass kostar den hållna tiden minus timbankens övertid', () => {
  const b = passetsBelopp({ ...bekraftat, status: 'completed' }, pris, null, { debiterade_min: 90, timbank_min: 15 });
  assertEquals(b.ok && [b.minuter, b.netto], [75, Math.round(75 / 60 * 39900)]);
});

Deno.test('beloppet: rabatten dras en gång, och en sen avbokning kostar avgiften utan rabatt', () => {
  const r = passetsBelopp({ ...bekraftat, rabatt_ore: 10000 }, pris, null, null);
  assertEquals(r.ok && [r.netto, r.rabatt], [29900, 10000]);
  const s = passetsBelopp({ ...bekraftat, status: 'cancelled', rabatt_ore: 10000 }, pris, { minuter: 30, ore: 19950 }, null);
  assertEquals(s.ok && [s.minuter, s.netto, s.rabatt], [30, 19950, 0]);
});

Deno.test('beloppet: ett pass på noll kronor betalas inte, och ett pass utan pris går inte att räkna', () => {
  const noll = passetsBelopp({ ...bekraftat, rabatt_ore: 39900, startrabatt: true }, pris, null, null);
  assertEquals(noll.ok, false);
  assertEquals(!noll.ok && noll.fel, 'Passet kostar ingenting: första timmen är på köpet.');
  const utan = passetsBelopp(bekraftat, { timme: 0, extra: 0 }, null, null);
  assertEquals(!utan.ok && utan.status, 409);
});

// ---------- raden ----------

Deno.test('raden: ämnet och dagen, barnen, minuterna och familjens rabatt, som kassan för ett pass', () => {
  assertEquals(passetsRad({ subject: 'Matematik', wanted_date: '2026-11-03', minuter: 60, barn: 2, sen: false, rabatt: 0,
                            rabattPerTimme: 1000 }),
    { name: 'Matematik 3 november (2 barn)', description: 'Läxhjälp, 60 minuter, med er rabatt på 10 kr per timme' });
  assertEquals(passetsRad({ subject: null, wanted_date: '2026-11-03', minuter: 60, barn: 1, sen: false, startrabatt: true,
                            rabatt: 39900, rabattPerTimme: 0 }).description, 'Läxhjälp, 60 minuter, första timmen på köpet');
  assertEquals(passetsRad({ subject: 'Engelska', wanted_date: '2026-11-04', minuter: 30, barn: 1, sen: true, rabatt: 0,
                            rabattPerTimme: 0 }),
    { name: 'Sen avbokning: Engelska 4 november',
      description: 'Hälften av passet, som avbokades mindre än 12 timmar före start (30 minuter)' });
});

// ---------- en kassa åt gången ----------

function stripe(lagen: Record<string, string>, ui: Record<string, string> = {}) {
  const gick: string[] = [];
  const s: KassaStripe = {
    utgang: (sid) => {
      if (lagen[sid] !== 'open') return Promise.reject(new Error('inte öppen'));
      lagen[sid] = 'expired';
      gick.push(sid);
      return Promise.resolve({});
    },
    hamta: (sid) => Promise.resolve({ status: lagen[sid], ui_mode: ui[sid] ?? 'embedded' }),
  };
  return { s, gick };
}

const kassa = (o: Partial<Passkassan> = {}): Passkassan => ({
  forsok: C, belopp_ore: 79800, antal_pass: 2, aterbruk: false, upphor_at: null, session: null, ersatta: [], ...o,
});

Deno.test('en kassa åt gången: de släppta kassorna går ut innan den nya öppnas', async () => {
  const { s, gick } = stripe({ cs_test_gammal: 'open' });
  const slappta: string[] = [];
  const k = await kassanForPassen(s, (id) => { slappta.push(id); return Promise.resolve(); },
    () => Promise.resolve(kassa({ ersatta: ['cs_test_gammal'] })), true);
  assertEquals((k as Passkassan).forsok, C);
  assertEquals(gick, ['cs_test_gammal']);
  assertEquals(slappta, []);
});

Deno.test('en kassa åt gången: en släppt kassa som redan betalats öppnar ingen ny', async () => {
  const { s } = stripe({ cs_test_betald: 'complete' });
  const slappta: string[] = [];
  const k = await kassanForPassen(s, (id, orsak) => { slappta.push(`${id}:${orsak}`); return Promise.resolve(); },
    () => Promise.resolve(kassa({ ersatta: ['cs_test_betald'] })), true);
  assertEquals(k, 'pagar');
  assertEquals(slappta, [`${C}:avbruten`]);
});

Deno.test('två tryck: en öppen kassa i samma läge återanvänds som den är', async () => {
  const { s, gick } = stripe({ cs_test_oppen: 'open' });
  let skapade = 0;
  const k = await kassanForPassen(s, () => Promise.resolve(),
    () => { skapade++; return Promise.resolve(kassa({ aterbruk: true, session: 'cs_test_oppen' })); }, true);
  assertEquals((k as Passkassan).session, 'cs_test_oppen');
  assertEquals([skapade, gick.length], [1, 0]);
});

Deno.test('två tryck: en kassa i ett annat läge eller som gått ut ersätts av en ny', async () => {
  for (const [lage, ui] of [['open', 'hosted'], ['expired', 'embedded']]) {
    const { s } = stripe({ cs_test_x: lage }, { cs_test_x: ui });
    const slappta: string[] = [];
    let skapade = 0;
    const k = await kassanForPassen(s, (id, orsak) => { slappta.push(orsak); return Promise.resolve(); }, () => {
      skapade++;
      return Promise.resolve(skapade === 1 ? kassa({ aterbruk: true, session: 'cs_test_x' })
        : kassa({ forsok: A }));
    }, true);
    assertEquals((k as Passkassan).forsok, A);
    assertEquals(slappta, ['ersatt']);
  }
});

Deno.test('två tryck: en återanvänd kassa som redan betalats öppnar ingen ny', async () => {
  const { s } = stripe({ cs_test_klar: 'complete' });
  const k = await kassanForPassen(s, () => Promise.resolve(),
    () => Promise.resolve(kassa({ aterbruk: true, session: 'cs_test_klar' })), true);
  assertEquals(k, 'pagar');
});

Deno.test('ett besked från databasen går fram som det är', async () => {
  const { s } = stripe({});
  const k = await kassanForPassen(s, () => Promise.resolve(), () => Promise.resolve({ fel: 'Ett av passen är redan betalt.' }), true);
  assertEquals(k, { fel: 'Ett av passen är redan betalt.' });
});

// ---------- svaret och metadata ----------

Deno.test('svaret från databasen prövas: ett id, ett belopp och sessionerna som ska gå ut', () => {
  assertEquals(lasKassan({ forsok: C.toUpperCase(), belopp_ore: 79800, antal_pass: 2, aterbruk: true,
                           upphor_at: '2026-10-27T15:00:00Z', session: 'cs_test_a', ersatta: ['cs_test_b', 7, ''] }),
    { forsok: C, belopp_ore: 79800, antal_pass: 2, aterbruk: true, upphor_at: '2026-10-27T15:00:00Z',
      session: 'cs_test_a', ersatta: ['cs_test_b'] });
  assertEquals(lasKassan({ fel: 'Välj mellan 2 och 20 pass att betala tillsammans.' }),
    { fel: 'Välj mellan 2 och 20 pass att betala tillsammans.' });
  assertEquals(lasKassan({ forsok: 'kassa', belopp_ore: 1, antal_pass: 2 }), null);
  assertEquals(lasKassan({ forsok: C, belopp_ore: 0, antal_pass: 2 }), null);
  assertEquals(lasKassan(null), null);
});

Deno.test('metadata: kassans id känns igen, och inget annat', () => {
  assertEquals(kassaUrMetadata({ pass_kassa: C.toUpperCase() }), C);
  assertEquals(kassaUrMetadata({ pass_kassa: 'x' }), null);
  assertEquals(kassaUrMetadata({ booking_id: C }), null);
  assertEquals(kassaUrMetadata(null), null);
});

// ---------- återbetalningen per rad ----------

const FLERA = { typ: 'pass', booking_id: null, utan_rad: false };
const PASSEN: Betalningsrad[] = [
  { id: 'rad-a', typ: 'pass', belopp_ore: 39900, booking_id: 'pass-a' },
  { id: 'rad-b', typ: 'pass', belopp_ore: 79800, booking_id: 'pass-b' },
];

Deno.test('flera pass: bara en betalning för flera pass, som passkassa_betald skrev den', () => {
  assertEquals(arFleraPass(FLERA), true);
  assertEquals(arFleraPass({ typ: 'pass', booking_id: A, utan_rad: false }), false);
  assertEquals(arFleraPass({ typ: 'pass', booking_id: null, utan_rad: true }), false);
  assertEquals(arFleraPass({ typ: 'plan', booking_id: null, utan_rad: false }), false);
  assertEquals(arFleraPass(null), false);
});

Deno.test('flera pass: ett pass tillbaka hör till sin rad, ur raden eller passet i metadata', () => {
  const f = raderUrStripe(FLERA, PASSEN, [
    { id: 're_1', amount: 10000, status: 'succeeded', metadata: { betalningsrad: 'rad-b' } },
    { id: 're_2', amount: 5000, status: 'succeeded', metadata: { booking_id: 'pass-a', av: 'system' } },
  ], 15000, 119700);
  assertEquals([f.perRad, f.ofordelat, f.hela], [{ 'rad-a': 5000, 'rad-b': 10000 }, 0, false]);
});

Deno.test('flera pass: allt tillbaka i Stripes dashboard är varje rad tillbaka, utan någon som avgör', () => {
  const f = raderUrStripe(FLERA, PASSEN, [{ id: 're_1', amount: 119700, status: 'succeeded' }], 119700, 119700);
  assertEquals([f.perRad, f.ofordelat, f.hela], [{ 'rad-a': 39900, 'rad-b': 79800 }, 0, true]);
});

Deno.test('flera pass: en del tillbaka i Stripes dashboard är ofördelad, och ett köp med tillägg gissar aldrig', () => {
  const f = raderUrStripe(FLERA, PASSEN, [{ id: 're_1', amount: 2000, status: 'succeeded' }], 2000, 119700);
  assertEquals([f.perRad, f.ofordelat], [{ 'rad-a': 0, 'rad-b': 0 }, 2000]);
  const kop = raderUrStripe({ typ: 'plan', booking_id: null, utan_rad: false },
    [{ id: 'rad-plan', typ: 'plan', belopp_ore: 151600, klippkort_id: 'kk' }, { id: 'rad-t', typ: 'syskon', belopp_ore: 6900 }],
    [{ id: 're_1', amount: 158500, status: 'succeeded' }], 158500, 158500);
  assertEquals([kop.ofordelat, kop.hela], [158500, false]);
});

function io(betalning: (Liggarrad & { rader: Betalningsrad[] }) | null) {
  const skrivet: unknown[] = [];
  return {
    skrivet,
    io: {
      betalning: () => Promise.resolve(betalning),
      lista: () => Promise.resolve([{ id: 're_1', amount: 13300, status: 'succeeded', metadata: { booking_id: 'pass-b' } }]),
      charge: () => Promise.resolve({ aterbetalt: 13300, totalt: 119700 }),
      skriv: (pi: string, perRad: Record<string, number>, aterbetalt: number) => {
        skrivet.push([pi, perRad, aterbetalt]);
        return Promise.resolve();
      },
    },
  };
}

Deno.test('raderna skrivs om ur Stripes lista för en betalning för flera pass, och bara då', async () => {
  const f = io({ ...FLERA, rader: PASSEN });
  assertEquals(await skrivRaderna('pi_x', 'ch_x', f.io), true);
  assertEquals(f.skrivet, [['pi_x', { 'rad-a': 0, 'rad-b': 13300 }, 13300]]);
  // Ett pass för sig: anroparen skriver passet som förut.
  const ett = io({ typ: 'pass', booking_id: 'pass-a', utan_rad: false,
                   rader: [{ id: 'rad-a', typ: 'pass', belopp_ore: 39900, booking_id: 'pass-a' }] });
  assertEquals(await skrivRaderna('pi_y', 'ch_y', ett.io), false);
  assertEquals(ett.skrivet, []);
  assertEquals(await skrivRaderna('pi_z', 'ch_z', io(null).io), false);
});
