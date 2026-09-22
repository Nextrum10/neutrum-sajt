// ============================================================
// NEXTRUM — notiserna: typerna och vad som får följa med
//
// Typerna står i databasen i notis_typer() och notis_mejlbara()
// (program 2, Fas 2.1). De står här en gång till, för att mallarna,
// tokenen och SMS:et ska kunna prövas utan databas. Ändras listan
// där ska den ändras här, i samma ändring.
//
//
// INGEN BRÖDTEXT, NÅGONSIN
//
// En rad i kön bär ett litet data-fält: datum, tid, ämne och förnamn.
// renData() plockar ut exakt de fälten och inget annat. Kommer det
// en nyckel till (body, note, location, ett efternamn) följer den
// inte med, för den läses aldrig. Det är skillnaden mellan en regel
// man ska komma ihåg och en regel koden håller.
//
// Varje namn går genom samma förnamnsregel som intern.fornamn() i
// databasen, även om databasen redan gjort det. full_name är fritext
// utan gräns: ett "namn" som ser ut som en adress blir en länk i
// Gmail, i ett mejl från vår egen domän med godkänd DKIM.
// ============================================================

export const NOTIS_TYPER = [
  'pass_nytt', 'pass_bekraftat', 'pass_flyttat', 'pass_avbokat', 'pass_avbojt',
  'meddelande', 'rapport', 'paminnelse',
] as const;

export type NotisTyp = typeof NOTIS_TYPER[number];

/** Samma som notis_mejlbara(): allt utom rapport, som bara syns i appen. */
export const MEJLBARA = [
  'pass_nytt', 'pass_bekraftat', 'pass_flyttat', 'pass_avbokat', 'pass_avbojt',
  'meddelande', 'paminnelse',
] as const;

export type MejlbarTyp = typeof MEJLBARA[number];

export type Kanal = 'mejl' | 'sms';

/** Databasen svarar 'parent' eller 'tutor'. Allt annat läses som familj. */
export type Roll = 'parent' | 'tutor';

export function arNotisTyp(v: unknown): v is NotisTyp {
  return typeof v === 'string' && (NOTIS_TYPER as readonly string[]).includes(v);
}

export function arMejlbar(v: unknown): v is MejlbarTyp {
  return typeof v === 'string' && (MEJLBARA as readonly string[]).includes(v);
}

export function arKanal(v: unknown): v is Kanal {
  return v === 'mejl' || v === 'sms';
}

export function tillRoll(v: unknown): Roll {
  return v === 'tutor' ? 'tutor' : 'parent';
}

/**
 * Förnamnet, och bara det, och bara bokstäver och bindestreck. Samma
 * regel som intern.fornamn(): första ordet, allt annat bort, högst 30
 * tecken. "Tove <script>" blir Tove, "anna@evil.com" blir annaevilcom
 * (ingen punkt, alltså ingen länk), och ett ord utan en enda bokstav
 * blir inget namn alls.
 */
export function fornamn(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const forsta = v.trim().split(/\s+/)[0] ?? '';
  const ren = forsta.replace(/[^\p{L}-]/gu, '').slice(0, 30);
  return /\p{L}/u.test(ren) ? ren : null;
}

/** Det enda ur data som mallarna och SMS:et får se. */
export type RenData = {
  datum: string | null;
  tid: string | null;
  franDatum: string | null;
  franTid: string | null;
  amne: string | null;
  elev: string | null;
  studiehjalpare: string | null;
  fran: string | null;
  timmar: number | null;
  status: 'requested' | 'confirmed' | 'cancelled' | 'completed' | null;
  prov: boolean;
};

function datumOk(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [a, m, d] = v.split('-').map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? v : null;
}

function tidOk(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.slice(0, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : null;
}

function timmarOk(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 168 ? n : null;
}

const STATUSAR = ['requested', 'confirmed', 'cancelled', 'completed'] as const;

export function renData(v: unknown): RenData {
  const d = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const status = STATUSAR.find((s) => s === d.status) ?? null;
  return {
    datum: datumOk(d.datum),
    tid: tidOk(d.tid),
    franDatum: datumOk(d.fran_datum),
    franTid: tidOk(d.fran_tid),
    amne: fornamn(d.amne),
    elev: fornamn(d.elev),
    studiehjalpare: fornamn(d.studiehjalpare),
    fran: fornamn(d.fran),
    timmar: timmarOk(d.timmar),
    status,
    prov: d.prov === true,
  };
}

/** Antalet i en sammanslagen chattnotis. Aldrig under 1. */
export function antalOk(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, 999) : 1;
}
