import { assertEquals, assertRejects, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { aterbetalaKop, kopetsNyckel, provaKopetsLage, type Rpc, stamAvKopet, type StripeAnrop } from './aterbetalning.ts';
import { StripeError } from './stripe.ts';

const KORT = '11111111-1111-4111-8111-111111111111';
const ADMIN = '22222222-2222-4222-8222-222222222222';

type Anrop = { metod: string; vag: string; kropp?: Record<string, unknown>; nyckel?: string };

/** En falsk Stripe som minns anropen och svarar med det testet ger. */
function falskStripe(svar: (a: Anrop) => Record<string, unknown>): { stripe: StripeAnrop; anrop: Anrop[] } {
  const anrop: Anrop[] = [];
  const stripe: StripeAnrop = (metod, vag, kropp, nyckel) => {
    const a = { metod, vag, kropp, nyckel };
    anrop.push(a);
    return Promise.resolve().then(() => svar(a));
  };
  return { stripe, anrop };
}

/** En falsk databas: ett svar per funktion, och listan över anropen. */
function falskDb(svar: Record<string, { data?: unknown; error?: { message: string } | null }>): { rpc: Rpc; anrop: { namn: string; args: Record<string, unknown> }[] } {
  const anrop: { namn: string; args: Record<string, unknown> }[] = [];
  const rpc: Rpc = (namn, args) => {
    anrop.push({ namn, args });
    const s = svar[namn] ?? { data: null, error: { message: 'okänd funktion ' + namn } };
    return Promise.resolve({ data: s.data ?? null, error: s.error ?? null });
  };
  return { rpc, anrop };
}

/** Ett köp av 8 timmar för 3 032 kr (379 kr i timmen), 2 använda: 6 betalda kvar. */
const LAGE_DEL = { ok: true, pi: 'pi_123', hela: false, timmar: 3, belopp_ore: 113700, aterbetald_ore: 0,
  kvar_betalda: 6, per_timme_ore: 37900, vid_uppsagning_ore: 223400, betalt_ore: 303200 };

Deno.test('nyckeln bär köpet, det som redan gått tillbaka och beloppet', () => {
  assertEquals(kopetsNyckel(KORT, 0, 113700), `nextrum-aterbet-kop-${KORT}-0-113700`);
  assertEquals(kopetsNyckel(KORT, 113700, 189500), `nextrum-aterbet-kop-${KORT}-113700-189500`);
});

Deno.test('en del av ett köp: beloppet och timmarna ur databasen, Stripe först, sedan timmarna', async () => {
  const { stripe, anrop } = falskStripe(() => ({ id: 're_1', amount: 113700 }));
  const db = falskDb({ klippkort_aterbetalning_lage: { data: LAGE_DEL }, klippkort_aterbetalad: { data: { ok: true } } });
  const u = await aterbetalaKop(stripe, db.rpc, { kort: KORT, timmar: 3, anledning: 'ångrat', av: ADMIN });
  assertEquals(u, { ok: true, aterbetalning: 're_1', belopp_ore: 113700, timmar: 3, hela: false, varning: null });
  assertEquals(anrop.length, 1);
  assertEquals(anrop[0].metod, 'POST');
  assertEquals(anrop[0].vag, '/v1/refunds');
  assertEquals(anrop[0].kropp, {
    payment_intent: 'pi_123', amount: 113700,
    metadata: { klippkort_id: KORT, timmar: '3', hela: 'nej', av: ADMIN, anledning: 'ångrat' },
  });
  assertEquals(anrop[0].nyckel, kopetsNyckel(KORT, 0, 113700));
  assertEquals(db.anrop.map((x) => x.namn), ['klippkort_aterbetalning_lage', 'klippkort_aterbetalad']);
  assertEquals(db.anrop[0].args, { p_id: KORT, p_timmar: 3 });
  assertEquals(db.anrop[1].args, {
    p_refund: 're_1', p_kort: KORT, p_timmar: 3, p_belopp: 113700, p_hela: false, p_av: ADMIN, p_anledning: 'ångrat',
  });
});

Deno.test('hela köpet: timmar null till databasen, hela ja till Stripe', async () => {
  const { stripe, anrop } = falskStripe(() => ({ id: 're_2' }));
  const db = falskDb({
    klippkort_aterbetalning_lage: { data: { ok: true, pi: 'pi_9', hela: true, timmar: 5, belopp_ore: 183500, aterbetald_ore: 0,
      kvar_betalda: 5, per_timme_ore: 37900, vid_uppsagning_ore: 183500, betalt_ore: 303200 } },
    klippkort_aterbetalad: { data: { ok: true } },
  });
  const u = await aterbetalaKop(stripe, db.rpc, { kort: KORT, timmar: null, anledning: null, av: ADMIN });
  assertEquals(u.ok, true);
  assertEquals(db.anrop[0].args, { p_id: KORT, p_timmar: null });
  assertEquals((anrop[0].kropp?.metadata as Record<string, string>).hela, 'ja');
  assertEquals('anledning' in (anrop[0].kropp?.metadata as Record<string, string>), false);
});

Deno.test('databasen säger nej: inget anrop till Stripe', async () => {
  const { stripe, anrop } = falskStripe(() => ({ id: 're_x' }));
  const db = falskDb({ klippkort_aterbetalning_lage: { data: { fel: 'Det finns inget att betala tillbaka: timmarna är använda.' } } });
  const u = await aterbetalaKop(stripe, db.rpc, { kort: KORT, timmar: 2, anledning: null, av: ADMIN });
  assertEquals(u, { ok: false, status: 409, fel: 'Det finns inget att betala tillbaka: timmarna är använda.' });
  assertEquals(anrop.length, 0);
});

Deno.test('Stripe nekar: inga timmar dras tillbaka', async () => {
  const { stripe } = falskStripe(() => {
    throw new StripeError({ typ: 'invalid_request_error', kod: 'charge_already_refunded', meddelande: 'Redan återbetald.', status: 400 });
  });
  const db = falskDb({ klippkort_aterbetalning_lage: { data: LAGE_DEL } });
  const u = await aterbetalaKop(stripe, db.rpc, { kort: KORT, timmar: 3, anledning: null, av: ADMIN });
  assertEquals(u.ok, false);
  if (!u.ok) {
    assertEquals(u.status, 502);
    assertStringIncludes(u.fel, 'Redan återbetald.');
  }
  assertEquals(db.anrop.map((x) => x.namn), ['klippkort_aterbetalning_lage']);
});

Deno.test('timmarna går inte att skriva: pengarna är tillbaka, och svaret säger det', async () => {
  const { stripe } = falskStripe(() => ({ id: 're_3' }));
  const db = falskDb({
    klippkort_aterbetalning_lage: { data: LAGE_DEL },
    klippkort_aterbetalad: { error: { message: 'nätet föll' } },
  });
  const u = await aterbetalaKop(stripe, db.rpc, { kort: KORT, timmar: 3, anledning: null, av: ADMIN });
  assertEquals(u.ok, true);
  if (u.ok) assertStringIncludes(String(u.varning), 'timmarna drogs inte tillbaka');
});

Deno.test('webhooken: våra återbetalningar skrivs med timmarna, Stripes panel räknas ihop', async () => {
  const { stripe, anrop } = falskStripe(() => ({
    data: [
      { id: 're_vår', status: 'succeeded', amount: 113700, metadata: { klippkort_id: KORT, timmar: '3', hela: 'nej', av: ADMIN } },
      { id: 're_panel', status: 'succeeded', amount: 5000, metadata: {} },
      { id: 're_annat_kop', status: 'succeeded', amount: 700, metadata: { klippkort_id: 'annat', timmar: '1' } },
      { id: 're_nekad', status: 'failed', amount: 9999, metadata: {} },
    ],
  }));
  const db = falskDb({ klippkort_aterbetalad: { data: { ok: true } } });
  const u = await stamAvKopet(stripe, db.rpc, { kort: KORT, charge: 'ch_1' });
  assertEquals(u, { registrerade: 1, framande_ore: 5700 });
  assertEquals(anrop[0].metod, 'GET');
  assertEquals(anrop[0].vag, '/v1/refunds?charge=ch_1&limit=100');
  assertEquals(db.anrop.length, 1);
  assertEquals(db.anrop[0].args, {
    p_refund: 're_vår', p_kort: KORT, p_timmar: 3, p_belopp: 113700, p_hela: false, p_av: ADMIN, p_anledning: null,
  });
});

Deno.test('webhooken: en återbetald tilläggsrad på samma betalning är inte främmande för köpet', async () => {
  const { stripe } = falskStripe(() => ({
    data: [
      { id: 're_vår', status: 'succeeded', amount: 37900, metadata: { klippkort_id: KORT, timmar: '1', hela: 'nej' } },
      { id: 're_tillagg', status: 'succeeded', amount: 6900, metadata: { betalningsrad: 'rad-1', tillagg_post: 'post-1' } },
      { id: 're_panel', status: 'succeeded', amount: 1000, metadata: {} },
    ],
  }));
  const db = falskDb({ klippkort_aterbetalad: { data: { ok: true } } });
  const u = await stamAvKopet(stripe, db.rpc, { kort: KORT, charge: 'ch_1', utom: (md) => !!md.betalningsrad });
  assertEquals(u, { registrerade: 1, framande_ore: 1000 });
});

Deno.test('webhooken: ett fel när timmarna skrivs kastas, så att Stripe försöker igen', async () => {
  const { stripe } = falskStripe(() => ({
    data: [{ id: 're_vår', status: 'succeeded', amount: 100, metadata: { klippkort_id: KORT, timmar: '1', hela: 'nej' } }],
  }));
  const db = falskDb({ klippkort_aterbetalad: { error: { message: 'låst' } } });
  await assertRejects(() => stamAvKopet(stripe, db.rpc, { kort: KORT, charge: 'ch_1' }), Error, 'klippkort_aterbetalad');
});

Deno.test('en återbetalning går aldrig under det som använts', () => {
  // 8 köpta, 5 använda: 3 betalda kvar. Hela köpet är det villkoren lovar den som slutar.
  const kop = { ok: true, pi: 'pi_1', kvar_betalda: 3, per_timme_ore: 37900, betalt_ore: 303200, aterbetald_ore: 0,
    vid_uppsagning_ore: 303200 - 5 * 39900 };
  assertEquals(provaKopetsLage({ ...kop, hela: false, timmar: 2, belopp_ore: 2 * 37900 }), null);
  assertEquals(provaKopetsLage({ ...kop, hela: true, timmar: 3, belopp_ore: 303200 - 5 * 39900 }), null);
  // Fler timmar än de som inte använts.
  assertStringIncludes(String(provaKopetsLage({ ...kop, hela: false, timmar: 4, belopp_ore: 4 * 37900 })), 'inte använts');
  // Ett belopp som räknar de använda timmarna som obetalda.
  assertStringIncludes(String(provaKopetsLage({ ...kop, hela: true, timmar: 3, belopp_ore: 303200 })), 'använda timmarna');
  // En del som kostar mer än timmarna.
  assertStringIncludes(String(provaKopetsLage({ ...kop, hela: false, timmar: 1, belopp_ore: 50000 })), 'timmarna kostade');
  // Mer än det som är kvar när en del redan gått tillbaka.
  assertStringIncludes(String(provaKopetsLage({ ...kop, aterbetald_ore: 280000, hela: false, timmar: 1, belopp_ore: 37900 })),
    'kvar av köpet');
  // Ett svar utan talen håller inte.
  assertStringIncludes(String(provaKopetsLage({ ok: true, pi: 'pi_1', hela: true, timmar: 3, belopp_ore: 100 })), 'inte använts');
});

Deno.test('databasens svar som inte håller: inget anrop till Stripe', async () => {
  const { stripe, anrop } = falskStripe(() => ({ id: 're_x' }));
  const db = falskDb({ klippkort_aterbetalning_lage: { data: { ...LAGE_DEL, timmar: 7, belopp_ore: 7 * 37900 } } });
  const u = await aterbetalaKop(stripe, db.rpc, { kort: KORT, timmar: 7, anledning: null, av: ADMIN });
  assertEquals(u.ok, false);
  if (!u.ok) assertEquals(u.status, 409);
  assertEquals(anrop.length, 0);
});
