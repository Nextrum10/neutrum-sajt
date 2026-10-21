import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { betalaTillbakaKortare, type KortareRad } from './kortare.ts';

const rad: KortareRad = { booking_id: 'b1', belopp_ore: 9975, payment_intent: 'pi_1', betalt_ore: 39900, aterbetald_ore: 0 };

Deno.test('kortare pass: mellanskillnaden går tillbaka, och läget läses från Stripe', async () => {
  const anrop: { vag: string; kropp?: Record<string, unknown>; nyckel?: string }[] = [];
  let skrivet: unknown[] = [];
  const svar = await betalaTillbakaKortare(rad, async (_m, vag, kropp, nyckel) => {
    anrop.push({ vag, kropp, nyckel });
    return vag === '/v1/refunds' ? { id: 're_1', charge: 'ch_1' } : { amount_refunded: 9975 };
  }, async (...a) => { skrivet = a; });
  assertEquals(svar, 'återbetalt');
  assertEquals(anrop[0].kropp?.amount, 9975);
  assertEquals(anrop[0].nyckel, 'nextrum-kortare-b1-0-9975');
  assertEquals(skrivet, ['b1', 9975, 39900, 'ch_1']);
});

Deno.test('kortare pass: aldrig mer än det som kom in, och inget utan PaymentIntent', async () => {
  let belopp: unknown = null;
  await betalaTillbakaKortare({ ...rad, belopp_ore: 99999, aterbetald_ore: 30000 }, async (_m, vag, kropp) => {
    if (vag === '/v1/refunds') belopp = kropp?.amount;
    return {};
  }, async () => {});
  assertEquals(belopp, 9900);
  let rört = false;
  const svar = await betalaTillbakaKortare({ ...rad, payment_intent: '' }, async () => { rört = true; return {}; }, async () => {});
  assertEquals(svar, 'inget att betala tillbaka');
  assertEquals(rört, false);
});
