// ============================================================
// NEXTRUM — erbjudandena (Fas 16.1)
//
// Det som stripe-checkout behöver veta om ett köpt erbjudande och som
// går att pröva utan databas. PRISET RÄKNAS INTE HÄR: det står i vyn
// erbjudanden_pris, och stripe-checkout läser det därifrån — samma rad
// som prissidan och studievyn visar. En andra räkning här hade glidit
// isär från den första, som de sju esc() gjorde.
// ============================================================

/** En kod ur katalogen. Allt annat nekas innan databasen tillfrågas. */
export function arErbjudandekod(v: unknown): v is string {
  return typeof v === 'string' && /^[a-z0-9_]{1,32}$/.test(v);
}

export type ErbjudandePris = {
  kod: string;
  sort: 'plan' | 'klippkort' | string;
  namn: string;
  timmar: number;
  rabatt_procent: number;
  giltig_manader: number;
  timpris_ore: number;
  pris_ore: number;
  /** Planerna 2026-10-07: timmar som inte kostar något (Standard, 8 för 7). */
  timmar_pa_kopet?: number;
};

const timmarText = (n: number) => (n === 1 ? '1 timme' : `${n} timmar`);

/**
 * Raden i kassan och på kvittot. Säger vad familjen köper och hur länge
 * det gäller — det är de två sakerna som står i villkoren, och de ska
 * stå likadant på kvittot.
 *
 * Planerna (2026-10-07): Standard har ingen rabatt utan en timme på
 * köpet, och kvittot ska säga det i stället för "0 % rabatt". Timmen
 * står som "för priset av 7", samma ord som på sidan, så att den inte
 * blandas ihop med första timmen som bjuds på ett pass (startrabatten).
 * Ett klippkort får exakt samma rad som förut.
 */
export function kassarad(e: ErbjudandePris): { name: string; description: string } {
  const man = e.giltig_manader === 1 ? '1 månad' : `${e.giltig_manader} månader`;
  const timmar = Number(e.timmar);
  const pa = Math.max(0, Math.min(Number(e.timmar_pa_kopet) || 0, timmar - 1));
  const rabatt = Number(e.rabatt_procent) || 0;
  let vad = `${timmarText(timmar)} läxhjälp`;
  if (pa > 0) vad += ` för priset av ${timmar - pa} (${timmarText(pa)} på köpet)`;
  if (rabatt > 0) vad += `, ${rabatt} % rabatt`;
  return { name: e.namn, description: `${vad}. Gäller i ${man} från köpet.` };
}

/**
 * Hur länge ett obetalt köp återanvänds när familjen trycker Köp igen.
 * Stripe låter en kassa stå öppen i ett dygn; ett köp som är äldre än
 * så hör till en kassa som inte längre går att betala.
 */
export const ATERANVAND_TIMMAR = 23;

/** Får ett väntande köp återanvändas? Samma pris och inom tiden. */
export function kanAteranvandas(
  kop: { begart_ore: number; created_at: string } | null | undefined,
  prisOre: number,
  nu: Date = new Date(),
): boolean {
  if (!kop || kop.begart_ore !== prisOre) return false;
  const alder = nu.getTime() - new Date(kop.created_at).getTime();
  return alder >= 0 && alder < ATERANVAND_TIMMAR * 3600_000;
}
