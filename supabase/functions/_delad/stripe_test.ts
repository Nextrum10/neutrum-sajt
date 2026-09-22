// ============================================================
// NEXTRUM — prov för _delad/stripe.ts
//
//   deno test supabase/functions/_delad/stripe_test.ts
//
// Provet finns av samma skäl som agent_test.ts: de fall som står här
// är de som en naiv implementation släpper igenom, och de är värda
// att stå kvar just därför.
//
// Signaturkontrollen är den enda sak som skiljer "Stripe säger att
// passet är betalt" från "någon påstår att passet är betalt". Går den
// sönder blir felet inte ett undantag någon ser — det blir ett pass
// som står som betalt utan att pengar rört sig.
// ============================================================

import { assert, assertEquals, assertFalse } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { aterbetalningsLage, formulardata, oreFor, prövaSignatur } from './stripe.ts';

const HEMLIGHET = 'whsec_prov_hemlighet_som_aldrig_anvands_skarpt';

/** Bygger en giltig stripe-signature-header för en kropp. */
async function signera(kropp: string, hemlighet = HEMLIGHET, tid?: number): Promise<string> {
  const t = tid ?? Math.floor(Date.now() / 1000);
  const nyckel = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(hemlighet),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', nyckel, new TextEncoder().encode(`${t}.${kropp}`)),
  );
  const hex = [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `t=${t},v1=${hex}`;
}

const KROPP = JSON.stringify({
  id: 'evt_1',
  type: 'checkout.session.completed',
  data: { object: { payment_status: 'paid', client_reference_id: 'pass-1' } },
});

Deno.test('en riktig signatur släpps igenom och ger händelsen', async () => {
  const svar = await prövaSignatur(KROPP, await signera(KROPP), HEMLIGHET);
  assert(svar.ok);
  if (svar.ok) assertEquals(svar.handelse.id, 'evt_1');
});

Deno.test('en ändrad kropp underkänns', async () => {
  // Signaturen är räknad på originalet. Att beloppet byts på vägen är
  // precis det angreppet signaturen finns för.
  const header = await signera(KROPP);
  const pillad = KROPP.replace('pass-1', 'pass-2');
  const svar = await prövaSignatur(pillad, header, HEMLIGHET);
  assertFalse(svar.ok);
});

Deno.test('samma kropp med FEL hemlighet underkänns', async () => {
  const header = await signera(KROPP, 'whsec_nagon_annans_hemlighet');
  const svar = await prövaSignatur(KROPP, header, HEMLIGHET);
  assertFalse(svar.ok);
});

Deno.test('en gammal leverans underkänns', async () => {
  // Utan tak går en avlyssnad leverans att spela upp igen hur länge
  // som helst, med en signatur som fortfarande stämmer.
  const gammal = Math.floor(Date.now() / 1000) - 3600;
  const svar = await prövaSignatur(KROPP, await signera(KROPP, HEMLIGHET, gammal), HEMLIGHET);
  assertFalse(svar.ok);
  if (!svar.ok) assert(svar.skal.includes('gammal'));
});

Deno.test('en leverans från framtiden underkänns också', async () => {
  // Absolutbeloppet i åldersräkningen: utan det skulle en klocka satt
  // framåt ge en signatur som aldrig blir för gammal.
  const framtid = Math.floor(Date.now() / 1000) + 3600;
  const svar = await prövaSignatur(KROPP, await signera(KROPP, HEMLIGHET, framtid), HEMLIGHET);
  assertFalse(svar.ok);
});

Deno.test('ingen header, tom hemlighet och trasig header underkänns', async () => {
  assertFalse((await prövaSignatur(KROPP, null, HEMLIGHET)).ok);
  assertFalse((await prövaSignatur(KROPP, await signera(KROPP), '')).ok);
  assertFalse((await prövaSignatur(KROPP, 'trams', HEMLIGHET)).ok);
  assertFalse((await prövaSignatur(KROPP, 't=123', HEMLIGHET)).ok);
  assertFalse((await prövaSignatur(KROPP, 'v1=abcd', HEMLIGHET)).ok);
});

Deno.test('en signatur som inte är hex får inte kasta, bara underkännas', async () => {
  // parseInt på skräp ger NaN, och NaN i en byte-jämförelse är precis
  // den sortens tyst fel som blir ett godkännande.
  const svar = await prövaSignatur(KROPP, 't=' + Math.floor(Date.now() / 1000) + ',v1=ZZZZ', HEMLIGHET);
  assertFalse(svar.ok);
});

Deno.test('flera v1 släpps igenom om EN stämmer (hemlighetsrotation)', async () => {
  /* Under ett hemlighetsbyte skickar Stripe flera signaturer i samma
     header. Prövas bara den första slutar varje leverans gå igenom
     mitt i bytet, och då är det betalningar som tystnar. */
  const header = await signera(KROPP);
  const t = header.split(',')[0];
  const riktig = header.split('v1=')[1];
  const svar = await prövaSignatur(KROPP, `${t},v1=00ff,v1=${riktig}`, HEMLIGHET);
  assert(svar.ok);
});

Deno.test('en giltig signatur över en kropp som inte är JSON underkänns', async () => {
  const text = 'inte json';
  const svar = await prövaSignatur(text, await signera(text), HEMLIGHET);
  assertFalse(svar.ok);
});

// ------------------------------------------------------------
// Formulärkodningen. Stripes v1 tar nästlade fält som a[b][c] och
// listor som a[0][b]. Skrivs det för hand i varje anropare stavas det
// till slut fel på ett ställe, och Stripe svarar med "unknown
// parameter" i stället för att skapa betalningen.
// ------------------------------------------------------------

Deno.test('nästlade fält och listor kodas som Stripe vill ha dem', () => {
  const rader = formulardata({
    mode: 'payment',
    payment_intent_data: {
      transfer_data: { destination: 'acct_1' },
      application_fee_amount: 25900,
    },
    line_items: [{ quantity: 1, price_data: { currency: 'sek', unit_amount: 37900 } }],
  });
  assert(rader.includes('mode=payment'));
  assert(rader.includes('payment_intent_data%5Btransfer_data%5D%5Bdestination%5D=acct_1'));
  assert(rader.includes('payment_intent_data%5Bapplication_fee_amount%5D=25900'));
  assert(rader.includes('line_items%5B0%5D%5Bquantity%5D=1'));
  assert(rader.includes('line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=37900'));
});

Deno.test('null och undefined skickas inte alls', () => {
  // Ett tomt customer_email är inte samma sak som inget: Stripe
  // svarar med ett valideringsfel på en tom sträng.
  const rader = formulardata({ a: null, b: undefined, c: '', d: 0 });
  assertEquals(rader.filter((r) => r.startsWith('a=') || r.startsWith('b=')).length, 0);
  assert(rader.includes('c='));
  assert(rader.includes('d=0'));
});

Deno.test('värden kodas, så att ett ämne med & inte blir två fält', () => {
  const rader = formulardata({ namn: 'Matte & fysik', tid: '10:00' });
  assertEquals(rader.length, 2);
  assert(rader.includes('namn=Matte%20%26%20fysik'));
});

// ------------------------------------------------------------
// Beloppen. Samma regel som belopp() i pris.ts: avrundningen sker
// SIST, annars blir 90 minuter à 379 kr 56849,99 ören.
// ------------------------------------------------------------

Deno.test('öresberäkningen avrundar sist', () => {
  assertEquals(oreFor(60, 37900), 37900);
  assertEquals(oreFor(90, 37900), 56850);
  assertEquals(oreFor(180, 37900), 113700);
  // 50 minuter à 379 kr: 31583,33 → 31583.
  assertEquals(oreFor(50, 37900), 31583);
});

// ------------------------------------------------------------
// Återbetalningens läge. Regeln finns på ETT ställe för att två
// vägar leder hit: knappen i adminvyn och webhooken när någon
// återbetalat i Stripes dashboard. Skrev de olika hade samma
// betalning stått som olika saker beroende på vem som hann sist.
// ------------------------------------------------------------

Deno.test('full återbetalning blir aterbetald, delvis förblir betald', () => {
  assertEquals(aterbetalningsLage(37900, 37900), 'aterbetald');
  assertEquals(aterbetalningsLage(10000, 37900), 'betald');
  assertEquals(aterbetalningsLage(0, 37900), 'betald');
  // Över hela beloppet ska inte tippa tillbaka till betald.
  assertEquals(aterbetalningsLage(40000, 37900), 'aterbetald');
});

Deno.test('ett nollbelopp kan inte bli aterbetald', () => {
  // 0 >= 0 är sant. Utan kravet på totalt > 0 hade ett pass utan
  // betalning räknats som fullt återbetalt.
  assertEquals(aterbetalningsLage(0, 0), 'betald');
});
