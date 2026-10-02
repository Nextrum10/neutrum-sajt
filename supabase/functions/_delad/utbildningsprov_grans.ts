// ============================================================
// NEXTRUM — utbildningsprovets siffror (Fas 22.1)
//
// Antalet frågor och gränsen för godkänt, utan frågorna. Mejlen till
// den som söker säger båda, och ansokan-notis ska inte behöva bära
// hela frågebanken och dess facit för att skriva "21 rätt av 26".
// utbildningsprov_test.ts håller ANTAL_FRAGOR lika med FRAGOR.length.
// ============================================================

export const ANTAL_FRAGOR = 26;

/** 80 procent. Samma gräns räknas i databasen (utbildningsprov_lamna), i heltal. */
export const GRANS_PROCENT = 80;

/** Hur många rätt som krävs för godkänt. 21 av 26. */
export function kravRatt(antal = ANTAL_FRAGOR): number {
  return Math.ceil((antal * GRANS_PROCENT) / 100);
}
