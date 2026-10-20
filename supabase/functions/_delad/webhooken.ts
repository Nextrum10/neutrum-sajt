// ============================================================
// NEXTRUM — webhookens mottagning: signaturen och samma händelse en gång
// (2026-10-21)
//
// Ur stripe-webhook, oförändrat i sak, så att det går att pröva utan nät
// och utan databas (webhooken_test.ts): en leverans med fel signatur
// nekas med 400 (Stripe ska inte försöka igen med något som aldrig går
// igenom), en händelse som redan är hanterad kvitteras med 200 och gör
// ingenting, och en som påbörjades men aldrig blev klar körs om.
// Stripe lovar minst en leverans, inte exakt en; taket är primärnyckeln
// i stripe_handelser.
//
// TABELLEN KOMMER IN UTIFRÅN (Handelselager): webhooken skickar in
// stripe_handelser genom tjänstekontot, proven en Map.
// ============================================================

import { prövaSignatur } from './stripe.ts';

export type Tabellfel = { code?: string; message: string } | null;

/** Det mottagningen behöver av stripe_handelser. */
export type Handelselager = {
  spara(rad: { id: string; typ: string; skarp: boolean | null }): PromiseLike<{ error: Tabellfel }>;
  hanterad(id: string): PromiseLike<{ data: { hanterad_at: string | null } | null }>;
  markera(id: string, resultat: string): PromiseLike<{ error: Tabellfel }>;
};

export type Leverans =
  /** Signaturen stämmer inte, eller händelsen saknar id eller typ: 400, och Stripe slutar försöka. */
  | { gora: 'neka'; fel: string }
  /** Händelsen är redan hanterad: 200, och ingenting görs. */
  | { gora: 'kvittera' }
  /** Tabellen tog inte emot den: 500, och Stripe försöker igen. */
  | { gora: 'fel' }
  /** Kör den. igen: den påbörjades förut men blev aldrig klar. */
  | { gora: 'kor'; id: string; typ: string; skarp: boolean | null; handelse: Record<string, unknown>; igen: boolean };

/**
 * Tar emot en leverans: signaturen på den råa kroppen först, sedan raden
 * i stripe_handelser. Bara 'kor' ska leda till något.
 */
export async function taEmotLeverans(
  raKropp: string,
  signaturHeader: string | null,
  hemlighet: string,
  lager: Handelselager,
): Promise<Leverans> {
  const provning = await prövaSignatur(raKropp, signaturHeader, hemlighet);
  if (!provning.ok) return { gora: 'neka', fel: provning.skal };

  const h = provning.handelse as { id?: unknown; type?: unknown; livemode?: unknown };
  const id = String(h.id ?? '');
  const typ = String(h.type ?? '');
  if (!id || !typ) return { gora: 'neka', fel: 'Händelsen saknar id eller typ.' };
  const skarp = typeof h.livemode === 'boolean' ? h.livemode : null;

  const { error } = await lager.spara({ id, typ, skarp });
  if (error) {
    if (error.code !== '23505') return { gora: 'fel' };
    const { data } = await lager.hanterad(id);
    if (data?.hanterad_at) return { gora: 'kvittera' };
    // Finns men blev aldrig klar: kör om.
    return { gora: 'kor', id, typ, skarp, handelse: provning.handelse, igen: true };
  }
  return { gora: 'kor', id, typ, skarp, handelse: provning.handelse, igen: false };
}

/** Händelsen är klar: nästa leverans av samma id kvitteras och gör ingenting. */
export async function markeraKlar(lager: Handelselager, id: string, resultat: string): Promise<void> {
  await lager.markera(id, resultat);
}
