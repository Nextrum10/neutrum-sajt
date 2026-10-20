// ============================================================
// NEXTRUM — prov för _delad/reservationen.ts (2026-10-21)
//
// Kortet utan nät och utan databas, med en falsk Stripe: 48-timmars-
// fönstret (före, exakt, efter, och ett pass som bokas närmare än så),
// reservationen, dragningen, släppet, en reservation som gått ut, ett
// nekat kort och att inget dras två gånger.
// ============================================================

import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  gorRad, type Pass, passetsStart, type Rad, RESERVATION_TIMMAR, reservationsfonster, type Sammanhang,
} from './reservationen.ts';
import type { StripeAnrop } from './aterbetalning.ts';
import { StripeError } from './stripe.ts';

const PASS_ID = '33333333-3333-4333-8333-333333333333';
const FAMILJ = '44444444-4444-4444-8444-444444444444';

type Anrop = { metod: string; vag: string; kropp?: Record<string, unknown>; nyckel?: string };

/** En falsk Stripe som minns anropen och svarar med det provet ger. */
function falskStripe(svar: (a: Anrop) => Record<string, unknown>): { stripe: StripeAnrop; anrop: Anrop[] } {
  const anrop: Anrop[] = [];
  const stripe: StripeAnrop = (metod, vag, kropp, nyckel) => {
    const a = { metod, vag, kropp, nyckel };
    anrop.push(a);
    return Promise.resolve().then(() => svar(a));
  };
  return { stripe, anrop };
}

type Skrivning = { lage: string; pi: string | null; belopp: number | null; felkod: string | null };

/** Sammanhanget: ett pass för 399 kr i timmen, och en lista över skrivningarna. */
function sammanhang(stripe: StripeAnrop, o: { nu?: Date; minuter?: number; svar?: string } = {}):
  { s: Sammanhang; skrivet: Skrivning[] } {
  const skrivet: Skrivning[] = [];
  const s: Sammanhang = {
    stripe,
    skriv: (_pass, lage, pi = null, belopp = null, _till = null, felkod = null) => {
      skrivet.push({ lage, pi, belopp, felkod });
      return Promise.resolve(o.svar ?? lage);
    },
    andradNu: () => Promise.resolve('2026-10-21T10:05:00Z'),
    andrad: () => '2026-10-21T10:00:00Z',
    pris: () => ({ timprisOre: 39900, extraOre: 6900, barn: 1, rabattOre: 0 }),
    familjensMin: () => o.minuter ?? 60,
    epost: () => 'familjen@example.se',
    nu: () => o.nu ?? new Date('2026-10-21T08:00:00Z'),
  };
  return { s, skrivet };
}

/** Ett pass den 23 oktober kl. 10 i Stockholm (08.00 UTC, sommartid). */
const pass = (o: Partial<Pass> = {}): Pass => ({
  id: PASS_ID, parent_id: FAMILJ, tutor_id: null, subject: 'Matematik', wanted_date: '2026-10-23', wanted_time: '10:00',
  duration_min: 60, tjanst: 'laxhjalp', antal_barn: 1, rabatt_ore: 0, timpris_ore: 39900, extra_ore: 6900,
  status: 'confirmed', ...o,
});
const rad = (o: Partial<Rad> = {}): Rad => ({
  booking_id: PASS_ID, parent_id: FAMILJ, atgard: 'reservera', lage: 'vald', stripe_reservation: null,
  reserverat_ore: null, stripe_kund: 'cus_prov01', stripe_metod: 'pm_prov01', ...o,
});

// ---------- 48-timmarsfönstret ----------

Deno.test('passets start räknas i Stockholms tid, också över omställningen till vintertid', () => {
  assertEquals(passetsStart('2026-10-23', '10:00')?.toISOString(), '2026-10-23T08:00:00.000Z');
  // Söndagen den 25 oktober 2026 går klockan tillbaka: kl. 10 är då 09.00 UTC.
  assertEquals(passetsStart('2026-10-25', '10:00')?.toISOString(), '2026-10-25T09:00:00.000Z');
  assertEquals(passetsStart('2026-12-01', '17:30:00')?.toISOString(), '2026-12-01T16:30:00.000Z');
  // Ingen tid är midnatt, som intern.passets_start.
  assertEquals(passetsStart('2026-10-23', null)?.toISOString(), '2026-10-22T22:00:00.000Z');
  assertEquals(passetsStart('23/10', '10:00'), null);
});

Deno.test('fönstret: före 48 timmar väntar, exakt 48 och efter reserveras', () => {
  const start = new Date('2026-10-23T08:00:00Z');
  const timmarFore = (t: number) => new Date(start.getTime() - t * 3600_000);
  assertEquals(RESERVATION_TIMMAR, 48);
  assertEquals(reservationsfonster(start, timmarFore(49)), 'vanta');
  assertEquals(reservationsfonster(start, new Date(start.getTime() - 48 * 3600_000 - 1000)), 'vanta');
  assertEquals(reservationsfonster(start, timmarFore(48)), 'reservera');
  assertEquals(reservationsfonster(start, timmarFore(47)), 'reservera');
  // Ett pass som bokas när det börjar om tre timmar reserveras direkt.
  assertEquals(reservationsfonster(start, timmarFore(3)), 'reservera');
  // Ett pass som redan börjat (och inte är genomfört) reserveras också.
  assertEquals(reservationsfonster(start, new Date(start.getTime() + 600_000)), 'reservera');
});

Deno.test('för tidigt: ingen reservation och inget anrop till Stripe', async () => {
  const { stripe, anrop } = falskStripe(() => ({}));
  const { s, skrivet } = sammanhang(stripe, { nu: new Date('2026-10-21T07:00:00Z') });
  assertEquals(await gorRad(rad(), pass(), s), 'för tidigt');
  assertEquals(anrop.length, 0);
  assertEquals(skrivet.length, 0);
});

// ---------- reservationen ----------

const reserverad = { id: 'pi_reserv1', status: 'requires_capture', amount_capturable: 39900,
  latest_charge: { payment_method_details: { card: { capture_before: 1793174400 } } } };

Deno.test('exakt 48 timmar före: priset för den bokade tiden reserveras utan familjen', async () => {
  const { stripe, anrop } = falskStripe((a) => a.metod === 'GET' ? { data: [] } : reserverad);
  const { s, skrivet } = sammanhang(stripe, { nu: new Date('2026-10-21T08:00:00Z') });
  assertEquals(await gorRad(rad(), pass(), s), 'reserverad');
  const skapa = anrop.find((a) => a.metod === 'POST')!;
  assertEquals(skapa.vag, '/v1/payment_intents');
  assertEquals(skapa.kropp?.amount, 39900);
  assertEquals(skapa.kropp?.capture_method, 'manual');
  assertEquals(skapa.kropp?.off_session, true);
  assertEquals(skapa.kropp?.payment_method_types, ['card']);
  assertEquals(skapa.nyckel, `nextrum-reservera-${PASS_ID}-${Date.parse('2026-10-21T10:00:00Z')}`);
  assertEquals(skrivet, [{ lage: 'reserverad', pi: 'pi_reserv1', belopp: 39900, felkod: null }]);
});

Deno.test('ett PaymentIntent som redan finns för passet används, inget dras två gånger', async () => {
  const { stripe, anrop } = falskStripe(() => ({
    data: [{ id: 'pi_gammal1', status: 'succeeded', amount_received: 39900, metadata: { kortreservation: PASS_ID } }],
  }));
  const { s, skrivet } = sammanhang(stripe);
  assertEquals(await gorRad(rad(), pass(), s), 'var redan dragen');
  assertEquals(anrop.filter((a) => a.metod === 'POST').length, 0);
  assertEquals(skrivet, [{ lage: 'dragen', pi: 'pi_gammal1', belopp: 39900, felkod: null }]);
});

Deno.test('ett nekat kort står på reservationen med Stripes kod', async () => {
  const { stripe } = falskStripe((a) => {
    if (a.metod === 'GET') return { data: [] };
    throw new StripeError({ typ: 'card_error', kod: 'card_declined', meddelande: 'Your card was declined.', status: 402 });
  });
  const { s, skrivet } = sammanhang(stripe);
  assertEquals(await gorRad(rad(), pass(), s), 'nekad');
  assertEquals(skrivet, [{ lage: 'misslyckad', pi: null, belopp: null, felkod: 'card_declined' }]);
});

Deno.test('Stripe nere är inte familjens sak: felet kastas och inget skrivs', async () => {
  const { stripe } = falskStripe((a) => {
    if (a.metod === 'GET') return { data: [] };
    throw new StripeError({ typ: 'api_error', kod: 'api_error', meddelande: 'Stripe svarar inte.', status: 500 });
  });
  const { s, skrivet } = sammanhang(stripe);
  await assertRejects(() => gorRad(rad(), pass(), s), StripeError);
  assertEquals(skrivet.length, 0);
});

Deno.test('en bank som vill att familjen bekräftar: släpps, och står som authentication_required', async () => {
  const { stripe, anrop } = falskStripe((a) => a.metod === 'GET' ? { data: [] }
    : a.vag.endsWith('/cancel') ? { id: 'pi_3ds0001', status: 'canceled' }
    : { id: 'pi_3ds0001', status: 'requires_action' });
  const { s, skrivet } = sammanhang(stripe);
  assertEquals(await gorRad(rad(), pass(), s), 'nekad');
  assertEquals(anrop.some((a) => a.vag === '/v1/payment_intents/pi_3ds0001/cancel' && a.kropp?.cancellation_reason === 'abandoned'), true);
  assertEquals(skrivet.at(-1)?.felkod, 'authentication_required');
});

// ---------- dragningen ----------

Deno.test('dragningen: den hållna tiden, högst det reserverade, med minuterna i metadata', async () => {
  const { stripe, anrop } = falskStripe((a) => ({ id: 'pi_reserv1', status: 'succeeded', amount_received: a.kropp?.amount_to_capture }));
  const { s, skrivet } = sammanhang(stripe, { minuter: 45 });
  const r = rad({ atgard: 'dra', lage: 'reserverad', stripe_reservation: 'pi_reserv1', reserverat_ore: 39900 });
  assertEquals(await gorRad(r, pass({ status: 'completed' }), s), 'dragen');
  const dra = anrop.find((a) => a.vag === '/v1/payment_intents/pi_reserv1/capture')!;
  // 45 minuter av 399 kr i timmen.
  assertEquals(dra.kropp?.amount_to_capture, 29925);
  assertEquals((dra.kropp?.metadata as Record<string, string>).minuter, '45');
  assertEquals(dra.nyckel, 'nextrum-dra-pi_reserv1');
  assertEquals(skrivet, [{ lage: 'dragen', pi: 'pi_reserv1', belopp: 29925, felkod: null }]);
});

Deno.test('dragningen tar aldrig mer än reservationen', async () => {
  const { stripe, anrop } = falskStripe((a) => ({ id: 'pi_reserv1', status: 'succeeded', amount_received: a.kropp?.amount_to_capture }));
  const { s } = sammanhang(stripe, { minuter: 90 });
  const r = rad({ atgard: 'dra', lage: 'reserverad', stripe_reservation: 'pi_reserv1', reserverat_ore: 39900 });
  await gorRad(r, pass({ status: 'completed' }), s);
  assertEquals(anrop[0].kropp?.amount_to_capture, 39900);
});

Deno.test('en reservation som gått ut: dragningen står som utgången, och nästa körning drar utan', async () => {
  // Stripe nekar dragningen och PaymentIntent står som släppt.
  const forsta = falskStripe((a) => {
    if (a.vag.endsWith('/capture')) {
      throw new StripeError({ typ: 'invalid_request_error', kod: 'payment_intent_unexpected_state', meddelande: 'canceled', status: 400 });
    }
    return { id: 'pi_reserv1', status: 'canceled' };
  });
  const a = sammanhang(forsta.stripe);
  const r = rad({ atgard: 'dra', lage: 'reserverad', stripe_reservation: 'pi_reserv1', reserverat_ore: 39900 });
  assertEquals(await gorRad(r, pass({ status: 'completed' }), a.s), 'utgången');
  assertEquals(a.skrivet, [{ lage: 'utgangen', pi: 'pi_reserv1', belopp: null, felkod: null }]);

  // Nästa körning: debitera, utan reservation, med en ny nyckel.
  const andra = falskStripe((x) => x.metod === 'GET' ? { data: [] } : { id: 'pi_nytt01', status: 'succeeded', amount_received: 39900 });
  const b = sammanhang(andra.stripe);
  const r2 = rad({ atgard: 'debitera', lage: 'utgangen', stripe_reservation: 'pi_reserv1', reserverat_ore: 39900 });
  assertEquals(await gorRad(r2, pass({ status: 'completed' }), b.s), 'dragen');
  const ny = andra.anrop.find((x) => x.metod === 'POST')!;
  assertEquals(ny.kropp?.capture_method, undefined);
  assertEquals(ny.kropp?.amount, 39900);
  assertEquals(ny.nyckel, `nextrum-debitera-${PASS_ID}-${Date.parse('2026-10-21T10:00:00Z')}`);
  assertEquals(b.skrivet, [{ lage: 'dragen', pi: 'pi_nytt01', belopp: 39900, felkod: null }]);
});

Deno.test('debitera på en rad som står som reserverad: utgången skrivs först, och nyckeln följer den nya tiden', async () => {
  const { stripe, anrop } = falskStripe((x) => x.metod === 'GET' ? { data: [] } : { id: 'pi_nytt01', status: 'succeeded', amount_received: 39900 });
  const { s, skrivet } = sammanhang(stripe);
  const r = rad({ atgard: 'debitera', lage: 'reserverad', stripe_reservation: 'pi_reserv1', reserverat_ore: 39900 });
  await gorRad(r, pass({ status: 'completed' }), s);
  assertEquals(skrivet[0].lage, 'utgangen');
  assertEquals(anrop.find((x) => x.metod === 'POST')!.nyckel, `nextrum-debitera-${PASS_ID}-${Date.parse('2026-10-21T10:05:00Z')}`);
});

Deno.test('ett nekat kort när passet ska betalas utan reservation står som nekat', async () => {
  const { stripe } = falskStripe((x) => {
    if (x.metod === 'GET') return { data: [] };
    throw new StripeError({ typ: 'card_error', kod: 'insufficient_funds', meddelande: 'Insufficient funds.', status: 402 });
  });
  const { s, skrivet } = sammanhang(stripe);
  const r = rad({ atgard: 'debitera', lage: 'vald' });
  assertEquals(await gorRad(r, pass({ status: 'completed' }), s), 'nekad');
  assertEquals(skrivet, [{ lage: 'misslyckad', pi: null, belopp: null, felkod: 'insufficient_funds' }]);
});

// ---------- släppet ----------

Deno.test('släppet: reservationen släpps med vår orsak och står som släppt', async () => {
  const { stripe, anrop } = falskStripe(() => ({ id: 'pi_reserv1', status: 'canceled' }));
  const { s, skrivet } = sammanhang(stripe);
  const r = rad({ atgard: 'slapp', lage: 'slapps', stripe_reservation: 'pi_reserv1', reserverat_ore: 39900 });
  assertEquals(await gorRad(r, pass({ status: 'cancelled' }), s), 'släppt');
  assertEquals(anrop[0].vag, '/v1/payment_intents/pi_reserv1/cancel');
  assertEquals(anrop[0].kropp?.cancellation_reason, 'requested_by_customer');
  assertEquals(anrop[0].nyckel, 'nextrum-slapp-pi_reserv1');
  assertEquals(skrivet, [{ lage: 'slappt', pi: 'pi_reserv1', belopp: null, felkod: null }]);
});

Deno.test('släppet av en reservation som redan drogs: dragen, inte släppt', async () => {
  const { stripe } = falskStripe((a) => {
    if (a.vag.endsWith('/cancel')) {
      throw new StripeError({ typ: 'invalid_request_error', kod: 'payment_intent_unexpected_state', meddelande: 'succeeded', status: 400 });
    }
    return { id: 'pi_reserv1', status: 'succeeded', amount_received: 39900 };
  });
  const { s, skrivet } = sammanhang(stripe);
  const r = rad({ atgard: 'slapp', lage: 'slapps', stripe_reservation: 'pi_reserv1', reserverat_ore: 39900 });
  assertEquals(await gorRad(r, pass({ status: 'cancelled' }), s), 'var redan dragen');
  assertEquals(skrivet, [{ lage: 'dragen', pi: 'pi_reserv1', belopp: 39900, felkod: null }]);
});

Deno.test('ett flyttat pass släpps och reserveras igen före den nya tiden', async () => {
  const { stripe } = falskStripe(() => ({ id: 'pi_reserv1', status: 'canceled' }));
  const { s } = sammanhang(stripe, { svar: 'vald' });
  const r = rad({ atgard: 'slapp', lage: 'reserverad', stripe_reservation: 'pi_reserv1', reserverat_ore: 39900 });
  assertEquals(await gorRad(r, pass(), s), 'släppt, reserveras igen');
});
