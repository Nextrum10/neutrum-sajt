// ============================================================
// NEXTRUM — kortet reserveras (kortet_reserveras, 2026-10-13)
//
// Det som stripe-reservation, stripe-checkout och stripe-webhook delar
// om ett sparat kort och en reservation, och som går att pröva utan
// databas och utan Stripe (kortreservation_test.ts). VAD som ska göras
// avgör databasen (kortreservation_att_gora, kortreservation_skriv); här
// räknas beloppen, och Stripes svar tolkas.
//
// Designen står i minne/betalning.md (Kortet reserveras vid bokningen):
// kortet sparas när familjen väljer det, beloppet reserveras två dagar
// före passet, och pengarna dras när rapporten finns.
// ============================================================

import { minuterspris } from './pris.ts';
import { type StripeFel, tidFranUnix } from './stripe.ts';

/**
 * Metadata-nyckeln som bär passet på ett PaymentIntent som
 * stripe-reservation skapar. MED FLIT INTE booking_id: den läser webhooken
 * som en betalning genom kassan, och payment_intent.payment_failed hade då
 * skrivit 'misslyckad' på passet i stället för på reservationen.
 */
export const KORTRESERVATION = 'kortreservation';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Passet ett PaymentIntent reserverar eller drar för, ur metadata vi själva skrev. Annars null. */
export function reservationensPass(metadata: unknown): string | null {
  const v = (metadata as Record<string, unknown> | null | undefined)?.[KORTRESERVATION];
  return typeof v === 'string' && UUID.test(v) ? v : null;
}

export type Kortet = {
  metod: string;
  marke: string | null;
  sista4: string | null;
  manad: number | null;
  ar: number | null;
};

const heltal = (v: unknown, fran: number, till: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= fran && v <= till ? v : null;

/**
 * Det familjen ser av kortet, ur Stripes payment_method: märke, sista fyra
 * siffror och giltighetstid, i de former sparade_kort kräver. Ett fält som
 * inte har formen blir null, hellre än att raden nekas och kortet inte
 * sparas alls. Utan ett id i Stripes form finns inget kort: null.
 */
export function kortetsDelar(pm: unknown): Kortet | null {
  const p = pm as { id?: unknown; card?: Record<string, unknown> | null } | null | undefined;
  const metod = typeof p?.id === 'string' && /^pm_[A-Za-z0-9]+$/.test(p.id) ? p.id : null;
  if (!metod) return null;
  const c = p?.card ?? {};
  const marke = typeof c.brand === 'string' && /^[a-z_]{1,24}$/.test(c.brand.toLowerCase())
    ? c.brand.toLowerCase() : null;
  const sista4 = typeof c.last4 === 'string' && /^[0-9]{4}$/.test(c.last4) ? c.last4 : null;
  return { metod, marke, sista4, manad: heltal(c.exp_month, 1, 12), ar: heltal(c.exp_year, 2000, 2100) };
}

/** Passets pris, fryst vid bokningen (Fas 19.5): timpriset, tillägget för syskon och rabatten. */
export type Passpris = { timprisOre: number; extraOre: number; barn: number; rabattOre: number };

/**
 * Vad reservationen håller: priset för den bokade tiden, med rabatten, som
 * kassan tar för ett bekräftat pass. Den hållna tiden finns inte än.
 */
export function reservationsbelopp(bokadeMin: number, p: Passpris): number {
  return minuterspris({ minuter: bokadeMin, ...p });
}

/**
 * Dragningen när rapporten finns. Priset för den tid familjen betalar
 * (den hållna, per påbörjad kvart, minus övertiden timbanken tog), men
 * aldrig mer än reservationen: resten är ett tillägg, som familjen betalar
 * som förut (pass_tillagg). minuter är vad betalningen avser, och webhooken
 * skriver den som passets stripe_minuter: den hållna tiden, eller den
 * bokade när den hållna kostar mer än reservationen.
 *
 * Ett belopp på noll (rabatten täcker den hållna tiden) dras inte:
 * reservationen släpps.
 */
export function dragning(o: { familjensMin: number; bokadeMin: number; reserveratOre: number; pris: Passpris }):
  { belopp: number; minuter: number } {
  const hela = minuterspris({ minuter: o.familjensMin, ...o.pris });
  if (hela <= o.reserveratOre) return { belopp: hela, minuter: o.familjensMin };
  return { belopp: o.reserveratOre, minuter: o.bokadeMin };
}

/**
 * Ska ett fel från Stripe stå på reservationen som nekat? Då får familjen
 * veta (notisen kort_nekat), och inget nytt försök görs förrän de lagt till
 * ett kort eller tryckt Försök igen. Ett nekat kort (card_error, 402) bär
 * Stripes kod. Ett kort eller en kund som inte finns hos Stripe längre blir
 * kortet_saknas: inget nytt försök hjälper där heller.
 *
 * Allt annat (Stripe nere, ett fel i vårt anrop) är inte familjens sak:
 * null, och jobbet försöker igen om tio minuter.
 */
export function nekadKod(fel: StripeFel): string | null {
  if (fel.typ === 'card_error' || fel.status === 402) {
    return /^[a-z0-9_]{1,60}$/.test(fel.kod) ? fel.kod : 'nekat';
  }
  if (fel.typ === 'invalid_request_error' && fel.kod === 'resource_missing') return 'kortet_saknas';
  return null;
}

/**
 * Vem släppte reservationen? Våra egna släpp har en orsak som
 * stripe-reservation sätter (requested_by_customer, duplicate, abandoned).
 * En reservation som inte drogs i tid släpper Stripe själv, med en egen
 * orsak eller ingen: då har den gått ut.
 */
export function slappetsLage(orsak: unknown): 'slappt' | 'utgangen' {
  return orsak === 'requested_by_customer' || orsak === 'duplicate' || orsak === 'abandoned'
    || orsak === 'fraudulent'
    ? 'slappt' : 'utgangen';
}

/**
 * Stripes gräns för dragningen, ur chargen (payment_method_details.card.
 * capture_before). Läses alltid därifrån, aldrig ur en tabell här: Visa ger
 * fyra dygn och arton timmar för en reservation utan familjen, de andra
 * märkena sju dagar, och reglerna ändras utan förvarning. Okänd: null.
 */
export function reserveradTill(charge: unknown): string | null {
  const c = charge as { payment_method_details?: { card?: { capture_before?: unknown } | null } | null } | null;
  return tidFranUnix(c?.payment_method_details?.card?.capture_before);
}

/**
 * Idempotensnyckeln för en reservation eller en dragning utan reservation.
 * Radens ändringstid står i den: inom samma läge ger två körningar samma
 * PaymentIntent, men ett nytt försök (nytt kort, Försök igen, ett flyttat
 * pass) är ett nytt anrop. Stripe sparar annars svaret på nyckeln, också
 * ett nej, i ett dygn.
 */
export function nyckelFor(atgard: 'reservera' | 'debitera', pass: string, andrad: string | null): string {
  const t = andrad ? Date.parse(andrad) : NaN;
  return `nextrum-${atgard}-${pass}-${Number.isFinite(t) ? t : 0}`;
}
