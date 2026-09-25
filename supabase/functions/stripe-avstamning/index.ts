// ============================================================
// NEXTRUM — stripe-avstamning (Fas 14.7)
//
// Hämtar Stripes avgift, nettot och läget (skarp eller test) för
// betalningar där de saknas.
//
// De två första betalningarna som gick hela vägen (2026-09-25) fick
// ingen avgift. Stripe skapar balanstransaktionen en stund efter att
// sessionen fullbordats, och webhooken frågade för tidigt. Sedan Fas
// 14.7 tar webhooken emot charge.updated och skriver in den när den
// kommer, men det hjälper inte en betalning som redan kommit in, eller
// en endpoint där händelsen inte är ikryssad.
//
// Det gick att rätta i efterhand för att charge-id:t sparas vid varje
// betalning. En charge bär sin balanstransaktion.
//
//
// FUNKTIONEN FRÅGAR STRIPE, DEN GISSAR INTE
//
// Siffrorna skrivs bara om Stripe svarar med dem. Ett pass där
// balanstransaktionen fortfarande saknas står kvar som det var och
// räknas i svaret, så att knappen kan tryckas igen senare.
//
// En avgift som redan står skrivs aldrig över. Stripe ändrar inte
// avgiften på en betalning i efterhand; står det en siffra är den
// skriven av webhooken ur samma källa.
//
//
// ORDNINGEN: anroparens egen token prövas mot Auth och is_admin FÖRST.
// service_role används sedan till att läsa charge-id:n och skriva
// tillbaka svaret. Id:n kommer ur vår egen tabell, aldrig ur anropet,
// och prövas till formen innan de hamnar i en adress.
// ============================================================

import { kravAdmin, serviceklient } from '../_delad/auth.ts';
import { cors, json, preflight } from '../_delad/http.ts';
import { arStripeId, balans, StripeError, v1 } from '../_delad/stripe.ts';

const CORS = cors();

// Ett tak per tryck. Stripe tål mer, men en knapp som kör i minuter
// ser trasig ut, och det som inte hanns med tas nästa gång.
const TAK = 50;

type Rad = {
  id: string;
  stripe_charge_id: string | null;
  stripe_avgift_ore: number | null;
  stripe_skarp: boolean | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(CORS);
  if (req.method !== 'POST') return json({ error: 'Bara POST.' }, 405, CORS);

  const vem = await kravAdmin(req.headers.get('authorization'));
  if (!vem.ok) return vem.svar;

  const db = serviceklient();

  const { data, error } = await db.from('bookings')
    .select('id, stripe_charge_id, stripe_avgift_ore, stripe_skarp')
    .not('stripe_charge_id', 'is', null)
    .or('stripe_avgift_ore.is.null,stripe_skarp.is.null')
    .order('betald_at', { ascending: true })
    .limit(TAK + 1);
  if (error) return json({ error: 'Kunde inte läsa betalningarna: ' + error.message }, 500, CORS);

  const rader = (data ?? []) as Rad[];
  const svar = { granskade: 0, avgifter: 0, markta: 0, vantar: 0, fel: [] as string[], fler: rader.length > TAK };

  for (const r of rader.slice(0, TAK)) {
    svar.granskade++;
    const ch = r.stripe_charge_id;
    if (!arStripeId(ch, 'ch') && !arStripeId(ch, 'py')) {
      svar.fel.push(`${r.id}: charge-id:t har fel form`);
      continue;
    }
    try {
      const charge = await v1('GET', `/v1/charges/${ch}?expand[]=balance_transaction`);
      const b = balans(charge.balance_transaction);
      const andring: Record<string, unknown> = {};
      if (r.stripe_skarp === null && typeof charge.livemode === 'boolean') {
        andring.stripe_skarp = charge.livemode;
        svar.markta++;
      }
      if (r.stripe_avgift_ore === null) {
        if (b.id && b.avgiftOre !== null) {
          andring.stripe_balanstransaktion_id = b.id;
          andring.stripe_avgift_ore = b.avgiftOre;
          andring.stripe_netto_ore = b.nettoOre;
          svar.avgifter++;
        } else {
          svar.vantar++;
        }
      }
      if (Object.keys(andring).length) {
        const { error: sparfel } = await db.from('bookings').update(andring).eq('id', r.id);
        if (sparfel) svar.fel.push(`${r.id}: ${sparfel.message}`);
      }
    } catch (e) {
      /* En test-charge går inte att läsa med en skarp nyckel, och
         tvärtom. Det är ett besked, inte ett krasch: raden står kvar,
         och svaret säger varför. */
      svar.fel.push(`${r.id}: ${e instanceof StripeError ? e.fel.meddelande : (e as Error)?.message ?? 'okänt fel'}`);
    }
  }

  return json(svar, 200, CORS);
});
