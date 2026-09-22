// ============================================================
// NEXTRUM — notiserna: datum och tid i klartext
//
// Passets tid är svensk lokaltid (wanted_date + wanted_time), och
// databasen skickar den som den står. Här blir den text: "tisdag
// 23 september kl. 16:00", eller för en påminnelse "i morgon kl.
// 16:00" och "om en timme, kl. 16:00".
//
// "I MORGON" RÄKNAS, DEN ANTAS INTE
//
// En påminnelse 24 timmar före ett pass går nästan alltid dagen före,
// men inte alltid: med 20 timmar och ett pass kl. 23:00 går den tre
// på natten samma dag. Därför jämförs passets datum med dagens datum
// i Stockholm när mejlet skrivs, och det står "i morgon" bara när det
// stämmer. Annars står dagen utskriven.
// ============================================================

import { MANADER } from '../konstanter.ts';
import type { RenData } from './typer.ts';

const VECKODAGAR = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];

/** '2026-09-23' → 'tisdag 23 september'. Datumet är redan prövat av renData. */
export function datumText(datum: string): string {
  const [a, m, d] = datum.split('-').map(Number);
  const veckodag = VECKODAGAR[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
  return `${veckodag} ${d} ${MANADER[m - 1]}`;
}

/** 'tisdag 23 september kl. 16:00', utan klockslag om det saknas. Null utan datum. */
export function narText(datum: string | null, tid: string | null): string | null {
  if (!datum) return null;
  return tid ? `${datumText(datum)} kl. ${tid}` : datumText(datum);
}

const STOCKHOLM = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Dagens datum i Stockholm, 'YYYY-MM-DD'. Databasen går i UTC, passen gör det inte. */
export function stockholmDatum(nu: Date): string {
  const delar = STOCKHOLM.formatToParts(nu);
  const del = (t: string) => delar.find((p) => p.type === t)?.value ?? '';
  return `${del('year')}-${del('month')}-${del('day')}`;
}

export function plusDagar(datum: string, dagar: number): string {
  const [a, m, d] = datum.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dagar)).toISOString().slice(0, 10);
}

/**
 * När passet är, sett från påminnelsen: 'i morgon kl. 16:00',
 * 'i dag kl. 16:00', 'om en timme, kl. 16:00', 'om 3 timmar, kl.
 * 16:00' eller 'onsdag 24 september kl. 16:00'. Null utan datum.
 *
 * timmar är hur långt före passet påminnelsen planerades. Under 20
 * skrivs det som timmar; från 20 och uppåt som en dag, och dagen
 * räknas fram ur datumet i stället för att antas.
 */
export function paminnelseNar(d: RenData, nu: Date): string | null {
  if (!d.datum) return null;
  const kl = d.tid ? `kl. ${d.tid}` : '';

  if (d.timmar !== null && d.timmar < 20) {
    const om = d.timmar === 1 ? 'om en timme' : `om ${d.timmar} timmar`;
    return kl ? `${om}, ${kl}` : om;
  }

  const idag = stockholmDatum(nu);
  const dag = d.datum === idag ? 'i dag'
    : d.datum === plusDagar(idag, 1) ? 'i morgon'
    : datumText(d.datum);
  return kl ? `${dag} ${kl}` : dag;
}
