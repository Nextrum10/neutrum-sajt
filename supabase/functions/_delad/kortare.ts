// ============================================================
// NEXTRUM — pengarna tillbaka när passet blev kortare (betala_nu, 2026-10-21)
//
// Leo 2026-10-21: familjen betalar passet med Betala nu när tiden är
// bekräftad, och blir passet kortare än bokat betalas mellanskillnaden
// tillbaka. Villkoren (#hallen-tid) lovar att vi gör det av oss själva,
// när rapporten är skriven. Förut larmade det som betalt_for_lange, och
// admin tryckte Återbetala.
//
// stripe-reservation kör det här när jobbet kortreservation väcker den.
// Listan och beloppet kommer ur databasen (kortare_pass_att_aterbetala),
// aldrig ur ett anrop. Stripe och skrivningen skickas in, så att flödet
// går att pröva utan nät (kortare_test.ts).
//
// INGET BETALAS TILLBAKA TVÅ GÅNGER. Nyckeln bär passet, det som redan
// gått tillbaka och beloppet: en körning som föll mellan Stripes svar och
// vår skrivning ger samma återbetalning nästa gång. Efter skrivningen är
// beloppet noll, och passet står inte längre i listan.
// ============================================================

export type KortareRad = {
  booking_id: string;
  belopp_ore: number;
  payment_intent: string;
  betalt_ore: number;
  aterbetald_ore: number;
};

type Stripe = (metod: 'GET' | 'POST', vag: string, kropp?: Record<string, unknown>, nyckel?: string) => Promise<unknown>;
type Skriv = (pass: string, aterbetalt: number, betalt: number, charge: string | null) => Promise<void>;

/** Betalar tillbaka ett pass. Svarar vad som hände, för loggen och svaret (aldrig ett id). */
export async function betalaTillbakaKortare(r: KortareRad, stripe: Stripe, skriv: Skriv): Promise<string> {
  const belopp = Math.round(Number(r.belopp_ore));
  const redan = Math.max(0, Math.round(Number(r.aterbetald_ore) || 0));
  const betalt = Math.round(Number(r.betalt_ore));
  // Taket är det som kom in, som i stripe-aterbetalning.
  const kvar = betalt - redan;
  if (!(belopp > 0) || !(kvar > 0) || !/^pi_/.test(String(r.payment_intent ?? ''))) return 'inget att betala tillbaka';
  const summa = Math.min(belopp, kvar);
  const re = await stripe('POST', '/v1/refunds', {
    payment_intent: r.payment_intent,
    amount: summa,
    metadata: { booking_id: r.booking_id, av: 'system', anledning: 'Passet blev kortare än bokat' },
  }, `nextrum-kortare-${r.booking_id}-${redan}-${summa}`) as { charge?: string };
  // Läget läses tillbaka från Stripe, som i stripe-aterbetalning: amount_refunded är summan.
  let totalt = redan + summa;
  const charge = typeof re?.charge === 'string' ? re.charge : null;
  if (charge) {
    try {
      const c = await stripe('GET', `/v1/charges/${charge}`) as { amount_refunded?: number };
      if (typeof c?.amount_refunded === 'number') totalt = c.amount_refunded;
    } catch {
      // Återbetalningen är gjord; webhooken skriver samma siffra med charge.refunded.
    }
  }
  await skriv(r.booking_id, totalt, betalt, charge);
  return 'återbetalt';
}
