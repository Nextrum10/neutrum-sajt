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
  'meddelande', 'rapport', 'paminnelse', 'timmar_gar_ut', 'barnforslag', 'kort_nekat',
  'tillagg_paminnelse', 'tillagg_kvitto', 'varvningsbonus',
] as const;

export type NotisTyp = typeof NOTIS_TYPER[number];

/** Samma som notis_mejlbara(): allt utom rapport, som bara syns i appen.
 *  barnforslag (barnet_foreslar_pass, 2026-10-12): ett barn har föreslagit
 *  ett pass som väntar på föräldern. kort_nekat (kortet_reserveras,
 *  2026-10-13): det sparade kortet nekades när beloppet skulle reserveras
 *  eller dras. tillagg_paminnelse och tillagg_kvitto (syskontillagg_som_skuld,
 *  2026-10-21): det upplupna tillägget för syskon, och kvittot när det
 *  betalats. Belopp och antal pass, aldrig ett barns namn. varvningsbonus
 *  (varvningsbonus, 2026-10-21): värvarens bonus är intjänad. Bara
 *  beloppet, aldrig vem som värvats. */
export const MEJLBARA = [
  'pass_nytt', 'pass_bekraftat', 'pass_flyttat', 'pass_avbokat', 'pass_avbojt',
  'meddelande', 'paminnelse', 'timmar_gar_ut', 'barnforslag', 'kort_nekat',
  'tillagg_paminnelse', 'tillagg_kvitto', 'varvningsbonus',
] as const;

export type MejlbarTyp = typeof MEJLBARA[number];

/**
 * BARNETS MEJL (barnets_epost). Sorterna ett barn kan få till sin egen
 * bekräftade adress, samma lista som intern.barn_mejltyper() i
 * databasen; ändras den ena ändras den andra. Bekräftelsen av adressen
 * är en fjärde sort som inte står här: den går inte att välja bort och
 * har ingen avanmälan, den är svaret på något föräldern just gjort.
 */
export const BARN_MEJLTYPER = ['barn_pass_bokat', 'barn_pass_avbokat', 'barn_paminnelse'] as const;

export type BarnMejltyp = typeof BARN_MEJLTYPER[number];

export const BARN_BEKRAFTA = 'barn_bekrafta_epost';

export function arBarnMejltyp(v: unknown): v is BarnMejltyp {
  return typeof v === 'string' && (BARN_MEJLTYPER as readonly string[]).includes(v);
}

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

/**
 * Avbokningens skäl, samma koder som bookings_avbokningsskal_check.
 * En KOD, aldrig text: mallen slår upp orden själv, så att det som
 * står i mejlet alltid är något vi skrivit. Allt som inte är en av
 * koderna blir null.
 */
export const AVBOKNINGSSKAL = [
  'sjukdom', 'forhinder', 'ombokat', 'ingen_hjalpare', 'familjen_avslutar', 'annat',
] as const;

export type Avbokningsskal = typeof AVBOKNINGSSKAL[number];

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
  skal: Avbokningsskal | null;
  /** Fas 14.6. En kod, aldrig text: 'timmar' (Fas 22.2: köpta timmar eller
   *  timbanken har betalat passet) eller null. 'faktura' gick med fakturan
   *  (2026-10-21). */
  betalsatt: Betalsatt | null;
  /** Fas 21.2. Köpta timmar som är kvar på ett kort som snart går ut. */
  kvar: number | null;
  /** gratistimmar_paminns (2026-10-15). Timmarna i påminnelsen är gratis
   *  (gratistimmar vi satt in, eller planens gratis timme), så mejlet
   *  lovar inga pengar tillbaka: en gåva betalas aldrig ut. Sant bara
   *  för true, aldrig för text. */
  gratis: boolean;
  /** kortet_reserveras. Varför kortet inte gick: 'bekrafta' (banken vill
   *  att familjen bekräftar betalningen) eller 'nekat'. Sedan 2026-10-21
   *  (kortdragningen_forsoker_igen) 'igen' när vi provar kortet igen av oss
   *  själva, så att mejlet bara lovar det då. En kod, aldrig Stripes text. */
  kortet: 'bekrafta' | 'nekat' | 'igen' | null;
  /** barnets_epost. Koden i länken som bekräftar barnets adress:
   *  barnets id, en punkt och en HMAC. Ingen personuppgift: den räknas
   *  fram när mejlet skickas och sparas ingenstans. */
  kod: string | null;
  prov: boolean;
  /** syskontillagg_som_skuld (2026-10-21). Det upplupna eller betalda
   *  tillägget i ören, antalet pass, och kvittots rader: dagen, antalet barn
   *  på passet och beloppet. Inga namn: renData tar bara de tre talen. */
  belopp: number | null;
  antalPass: number | null;
  rader: { datum: string; barn: number; belopp: number }[];
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

/** Ett klippkort har högst 200 timmar (erbjudanden.timmar). */
function kvarOk(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 200 ? n : null;
}

/** Ett belopp i hela ören, från noll till en miljon kronor. */
function oreOk(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= 100_000_000 ? n : null;
}

/** Kvittots rader: högst 60, och varje rad dag, antal barn (2–10) och belopp. */
function raderOk(v: unknown): { datum: string; barn: number; belopp: number }[] {
  if (!Array.isArray(v)) return [];
  const ut: { datum: string; barn: number; belopp: number }[] = [];
  for (const r of v.slice(0, 60)) {
    const x = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    const datum = datumOk(x.datum);
    const barn = typeof x.barn === 'number' && Number.isInteger(x.barn) && x.barn >= 2 && x.barn <= 10 ? x.barn : null;
    const belopp = oreOk(x.belopp);
    if (datum && barn !== null && belopp !== null) ut.push({ datum, barn, belopp });
  }
  return ut;
}

/** intern.barn_epost_kod(): ett uuid, en punkt, 43 tecken base64url. */
const KOD = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/;

const STATUSAR = ['requested', 'confirmed', 'cancelled', 'completed'] as const;

/** Koderna intern.betalsatt_kod() skickar. Allt annat blir null. */
const BETALSATT = ['timmar'] as const;
export type Betalsatt = typeof BETALSATT[number];

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
    skal: AVBOKNINGSSKAL.find((k) => k === d.skal) ?? null,
    betalsatt: BETALSATT.find((k) => k === d.betalsatt) ?? null,
    kvar: kvarOk(d.kvar),
    gratis: d.gratis === true,
    kortet: d.kortet === 'bekrafta' || d.kortet === 'nekat' || d.kortet === 'igen' ? d.kortet : null,
    kod: typeof d.kod === 'string' && KOD.test(d.kod) ? d.kod : null,
    prov: d.prov === true,
    belopp: oreOk(d.belopp),
    antalPass: kvarOk(d.antal_pass),
    rader: raderOk(d.rader),
  };
}

/** Antalet i en sammanslagen chattnotis. Aldrig under 1. */
export function antalOk(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, 999) : 1;
}
