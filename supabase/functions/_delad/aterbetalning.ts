// ============================================================
// NEXTRUM — ett köp av timmar betalas tillbaka (2026-10-21, planerna_per_manad)
//
// Leo: en återbetalning drar tillbaka timmar, men aldrig under det som
// använts. stripe-aterbetalning gör det från adminvyn, och webhooken
// stämmer av det när Stripe säger att charge:n återbetalats.
//
// STRIPE OCH DATABASEN KOMMER IN UTIFRÅN (StripeAnrop, Rpc), så att
// flödet går att pröva utan nät och utan databas (aterbetalning_test.ts).
// Edge-funktionerna skickar in v1() och supabase-klientens rpc().
//
// BELOPPET OCH TIMMARNA RÄKNAS I DATABASEN (klippkort_aterbetalning_lage),
// aldrig ur anropet: hela köpet är det villkoren lovar den som slutar
// (använda timmar till ordinarie timpris), en del är timmarna till det
// pris familjen betalade per timme. Stripe först, databasen sedan: faller
// funktionen mellan dem skriver webhooken samma återbetalning ur Stripes
// metadata, och samma återbetalning två gånger blir en rad
// (klippkort_aterbetalningar, Stripes re_-id).
// ============================================================

import { StripeError } from './stripe.ts';

/** Samma form som v1() i stripe.ts. */
export type StripeAnrop = (
  metod: 'GET' | 'POST',
  vag: string,
  kropp?: Record<string, unknown>,
  idempotens?: string,
) => Promise<Record<string, unknown>>;

/** Samma form som supabase-klientens rpc(). */
export type Rpc = (
  namn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;

/** Idempotensnyckeln: köpet, det som redan återbetalats och beloppet. Två tryck blir en återbetalning. */
export function kopetsNyckel(kort: string, redanOre: number, beloppOre: number): string {
  return `nextrum-aterbet-kop-${kort}-${Math.round(Number(redanOre) || 0)}-${Math.round(Number(beloppOre) || 0)}`;
}

export type KopetsAterbetalning =
  | { ok: true; aterbetalning: string; belopp_ore: number; timmar: number; hela: boolean; varning: string | null }
  | { ok: false; status: number; fel: string; stripe?: unknown };

type Lage = {
  ok?: boolean;
  fel?: string;
  pi?: string;
  hela?: boolean;
  timmar?: number;
  belopp_ore?: number;
  aterbetald_ore?: number;
};

/**
 * Betalar tillbaka ett köp, helt (timmar null) eller ett antal timmar.
 * av är adminens id, anledning en fritext till Stripe och raden.
 */
export async function aterbetalaKop(
  stripe: StripeAnrop,
  rpc: Rpc,
  a: { kort: string; timmar: number | null; anledning: string | null; av: string },
): Promise<KopetsAterbetalning> {
  const { data, error } = await rpc('klippkort_aterbetalning_lage', { p_id: a.kort, p_timmar: a.timmar });
  if (error) return { ok: false, status: 500, fel: 'Köpet gick inte att läsa: ' + error.message };
  const l = (data ?? {}) as Lage;
  if (!l.ok || l.fel) return { ok: false, status: 409, fel: String(l.fel || 'Köpet går inte att betala tillbaka.') };
  const belopp = Math.round(Number(l.belopp_ore) || 0);
  const timmar = Math.round(Number(l.timmar) || 0);
  if (!(belopp > 0) || !l.pi) return { ok: false, status: 409, fel: 'Det finns inget att betala tillbaka.' };

  let aterbetalning: Record<string, unknown>;
  try {
    aterbetalning = await stripe('POST', '/v1/refunds', {
      payment_intent: l.pi,
      amount: belopp,
      // Webhooken känner igen återbetalningen på de här, och skriver timmarna om funktionen inte hann.
      metadata: {
        klippkort_id: a.kort,
        timmar: String(timmar),
        hela: l.hela ? 'ja' : 'nej',
        av: a.av,
        ...(a.anledning ? { anledning: a.anledning.slice(0, 300) } : {}),
      },
    }, kopetsNyckel(a.kort, Number(l.aterbetald_ore) || 0, belopp));
  } catch (e) {
    if (e instanceof StripeError) return { ok: false, status: 502, fel: 'Stripe nekade: ' + e.fel.meddelande, stripe: e.fel };
    throw e;
  }
  const id = String(aterbetalning.id ?? '');

  const { error: skrivfel } = await rpc('klippkort_aterbetalad', {
    p_refund: id,
    p_kort: a.kort,
    p_timmar: timmar,
    p_belopp: belopp,
    p_hela: !!l.hela,
    p_av: a.av,
    p_anledning: a.anledning,
  });
  return {
    ok: true,
    aterbetalning: id,
    belopp_ore: belopp,
    timmar,
    hela: !!l.hela,
    // Pengarna är tillbaka hos familjen oavsett; webhooken skriver timmarna när den kommer.
    varning: skrivfel ? 'Pengarna är tillbaka, men timmarna drogs inte tillbaka än: ' + skrivfel.message : null,
  };
}

/**
 * Webhooken: varje återbetalning på köpets charge som bär köpets id
 * skrivs med sina timmar (samma rad två gånger blir en). Det som
 * återbetalats utan köpets id (i Stripes panel) räknas ihop: då drogs
 * inga timmar tillbaka, och köpet ska stängas som förut.
 */
export async function stamAvKopet(
  stripe: StripeAnrop,
  rpc: Rpc,
  a: { kort: string; charge: string },
): Promise<{ registrerade: number; framande_ore: number }> {
  const lista = await stripe('GET', `/v1/refunds?charge=${encodeURIComponent(a.charge)}&limit=100`);
  const rader = Array.isArray(lista.data) ? (lista.data as Record<string, unknown>[]) : [];
  let registrerade = 0;
  let framande = 0;
  for (const r of rader) {
    const status = String(r.status ?? '');
    if (status !== 'succeeded' && status !== 'pending') continue;
    const md = (r.metadata ?? {}) as Record<string, string>;
    const belopp = Math.round(Number(r.amount) || 0);
    if (md.klippkort_id === a.kort && /^\d{1,4}$/.test(String(md.timmar ?? ''))) {
      const { error } = await rpc('klippkort_aterbetalad', {
        p_refund: String(r.id ?? ''),
        p_kort: a.kort,
        p_timmar: Number(md.timmar),
        p_belopp: belopp,
        p_hela: md.hela === 'ja',
        p_av: /^[0-9a-f-]{36}$/.test(String(md.av ?? '')) ? md.av : null,
        p_anledning: md.anledning ?? null,
      });
      if (error) throw new Error('klippkort_aterbetalad: ' + error.message);
      registrerade += 1;
    } else {
      framande += belopp;
    }
  }
  return { registrerade, framande_ore: framande };
}
