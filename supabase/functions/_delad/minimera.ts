/**
 * Det som skickas till en AI-leverantör, minimerat (GDPR art. 5.1 c
 * och art. 25).
 *
 * Rapportutkasten (generate-feedback) och hälsningarna till ett
 * tidsförslag (generate-message) skickade förut elevens FULLA namn och
 * studiehjälparens råa anteckningar som de stod till Anthropic. För ett
 * utkast till en förälder räcker förnamnet, och ett personnummer, ett
 * telefonnummer eller en e-postadress som hamnat i anteckningarna har
 * ingen plats i en prompt.
 *
 * maskera() är samma regler som public.maska_kontakt() i databasen
 * (Fas 8.8), som maskar det drift-agenten läser. Ändras den ena ska den
 * andra ändras i samma ändring.
 *
 * Det här är minimering, inte avidentifiering: anteckningarna kan
 * fortfarande innehålla ett namn eller en diagnos. Därför säger
 * rapportrutan i studiehjälparvyn att diagnoser inte ska skrivas där.
 */

export { fornamn } from './notiser/typer.ts';

const ISO_DATUM = /(\d{4})-(\d{2})-(\d{2})/g;
const EPOST = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Minst sex tecken, börjar och slutar med en siffra. Fyrsiffriga årtal
// går igenom; 070-123 45 67, 0701234567, +46 70 123 45 67 och
// 20100101-1234 maskas.
const NUMMER = /[0-9][0-9 .+()/-]{4,}[0-9]/g;

export function maskera(v: unknown): string {
  let t = String(v ?? '');
  // ISO-datum undantas: "2026-09-20" är inte ett telefonnummer.
  t = t.replace(ISO_DATUM, '$1\u0001$2\u0001$3');
  t = t.replace(EPOST, '[e-post]');
  t = t.replace(NUMMER, '[nummer]');
  return t.replaceAll('\u0001', '-');
}
