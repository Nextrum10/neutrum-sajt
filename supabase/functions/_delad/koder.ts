// ============================================================
// NEXTRUM — koderna i kassan (2026-10-21, koder_for_planer)
//
// En rabattkod eller partnerkod gäller bara när familjen köper en plan
// (Leo: "Båda gäller ENBART planköp, aldrig enskilda pass"). Databasen
// prövar koden och räknar rabatten (intern.rabattkod_prova,
// intern.klippkort_rabatt), och det är databasens belopp kassan drar.
// Här står det kassan gör med koden innan Stripe får ett belopp, så att
// det går att pröva utan nät och utan databas (koder_test.ts):
//
//   · koden skrivs som databasen lagrar den (versaler, 3–24 tecken av
//     A–Z, 0–9 och bindestreck), och en kod på ett pass, ett tillägg,
//     kortet eller timmar till planen nekas innan något annat händer;
//   · bara en plan tar en kod (sort = 'plan'), aldrig Fyll timbanken
//     eller timmar till planen; ett eget upplägg är en plan och tar en
//     (2026-10-27, Leo: "rabattkod gäller också för upplägg"), prövad mot
//     uppläggets pris (kod_pa_upplagget);
//   · databasens svar (kod_pa_planen) prövas: gäller koden inte säger
//     kassan databasens skäl, och rabatten räknas om ur typen och värdet.
//     Det är en kontroll, inte en andra källa: glider räkningarna isär
//     blir det ett nej, aldrig ett annat belopp. rabattenPa och
//     intern.rabattkod_prova ändras tillsammans. Ett köp blir aldrig
//     gratis av en kod.
//
// DATABASEN KOMMER IN UTIFRÅN (Kodklient): stripe-checkout skickar in
// familjens egen klient, proven en falsk.
// ============================================================

/** Svaret när en kod följer med något annat än en plan. Samma text som databasens. */
export const KOD_BARA_PLAN = 'Rabattkoder gäller bara när ni köper en plan.';
/** Svaret när rabatten tar hela priset. Samma text som databasens. */
export const KOD_GRATIS = 'Rabatten är lika stor som priset eller större, och ett köp kan inte bli gratis.';
/** En kod som inte går att pröva just nu (databasen svarade inte, eller svarade fel). */
export const KOD_GICK_INTE = 'Rabattkoden gick inte att pröva just nu. Försök igen, eller köp utan koden.';
/** Samma svar som databasen ger en kod som inte finns. */
export const KOD_FINNS_INTE = 'Koden finns inte, eller gäller inte längre.';

/** Samma villkor som rabattkoder_kod_check. */
export const KODFORM = /^[A-Z0-9-]{3,24}$/;

/**
 * Koden som databasen lagrar den: null utan kod (tom eller bara
 * mellanslag), false för något som inte kan vara en kod.
 */
export function normaliseraKod(v: unknown): string | null | false {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') return false;
  const ren = v.trim().toUpperCase();
  if (!ren) return null;
  return KODFORM.test(ren) ? ren : false;
}

/**
 * Varför koden inte får följa med den här betalningen, eller null. En kod
 * på ett pass, ett tillägg, kortet eller timmar till planen är ett nej,
 * inte något kassan tyst bortser från: familjen trodde att den gällde.
 */
export function kodPaFelBetalning(kropp: Record<string, unknown> | null | undefined): string | null {
  if (!kropp) return null;
  if (normaliseraKod(kropp.rabattkod) === null) return null;
  if (kropp.pass !== undefined || kropp.tillagg !== undefined || kropp.kort !== undefined
      || kropp.erbjudande === 'plan_extra' || (kropp.erbjudande === undefined && kropp.upplagg === undefined)) {
    return KOD_BARA_PLAN;
  }
  return null;
}

/** Tar köpet en kod? En plan, som intern.kod_galler_kopet: aldrig timmar till planen. */
export function kodenGallerKopet(e: { kod?: string | null; sort?: string | null } | null | undefined): boolean {
  return !!e && e.sort === 'plan' && e.kod !== 'plan_extra';
}

/**
 * Rabatten i öre som intern.rabattkod_prova räknar den: procent av
 * beloppet nedåt till hel öre, ett belopp som det är, och aldrig under
 * noll eller över beloppet.
 */
export function rabattenPa(typ: string, varde: number, beloppOre: number): number {
  const belopp = Math.max(Math.trunc(Number(beloppOre) || 0), 0);
  const v = Math.trunc(Number(varde) || 0);
  const r = typ === 'procent' ? Math.floor((belopp * v) / 100) : v;
  return Math.min(Math.max(r, 0), belopp);
}

/** Databasens svar om koden på planen (kod_pa_planen, eller kolla_rabattkod_kop före migrationen). */
export type Kodsvar = {
  giltig?: boolean | null;
  orsak?: string | null;
  rabatt_ore?: number | string | null;
  pris_ore?: number | string | null;
  att_betala_ore?: number | string | null;
  /** Bara kod_pa_planen: 'procent' eller 'belopp'. */
  rabatt_typ?: string | null;
  rabatt_varde?: number | string | null;
};

export type Nej = { ok: false; status: number; fel: string };
export type Kodbelopp = { ok: true; pris: number; rabatt: number; attBetala: number } | Nej;

const heltal = (v: unknown) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isSafeInteger(n) ? n : null;
};

/**
 * Prövar databasens svar. Gäller koden inte är svaret databasens skäl.
 * Gäller den ska rabatten och det som ska betalas gå ihop med priset, ett
 * köp får inte bli gratis, och när svaret säger typen och värdet ska
 * rabatten vara den rabattenPa räknar.
 */
export function provaKodsvaret(svar: Kodsvar | null | undefined): Kodbelopp {
  if (!svar) return { ok: false, status: 409, fel: KOD_GICK_INTE };
  if (svar.giltig !== true) return { ok: false, status: 409, fel: String(svar.orsak || 'Koden gäller inte.') };
  const pris = heltal(svar.pris_ore);
  const rabatt = heltal(svar.rabatt_ore);
  const attBetala = heltal(svar.att_betala_ore);
  if (pris === null || rabatt === null || attBetala === null || pris <= 0 || rabatt < 0 || attBetala !== pris - rabatt) {
    return { ok: false, status: 409, fel: KOD_GICK_INTE };
  }
  if (rabatt >= pris) return { ok: false, status: 409, fel: KOD_GRATIS };
  if (svar.rabatt_typ != null && svar.rabatt_varde != null) {
    const varde = heltal(svar.rabatt_varde);
    if (varde === null || rabattenPa(String(svar.rabatt_typ), varde, pris) !== rabatt) {
      return { ok: false, status: 409, fel: KOD_GICK_INTE };
    }
  }
  return { ok: true, pris, rabatt, attBetala };
}

/** Det kassan behöver av databasen, med familjens egen token. */
export type Kodklient = {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>;
};

/**
 * Frågar databasen om koden på planen: kod_pa_planen, och före
 * migrationen kolla_rabattkod_kop (utan typen och värdet, så kontrollen
 * av rabatten hoppas över då). Null när databasen inte svarar.
 */
export async function fragaOmKoden(db: Kodklient, kod: string, erbjudande: string): Promise<Kodsvar | null> {
  const args = { p_kod: kod, p_erbjudande: erbjudande };
  let { data, error } = await db.rpc('kod_pa_planen', args);
  if (error && (error.code === 'PGRST202' || error.code === '42883')) {
    ({ data, error } = await db.rpc('kolla_rabattkod_kop', args));
  }
  if (error) return null;
  const rad = Array.isArray(data) ? data[0] : data;
  return rad && typeof rad === 'object' ? rad as Kodsvar : null;
}

export type Kodbeslut =
  | { ok: true; kod: null }
  | { ok: true; kod: string; pris: number; rabatt: number; attBetala: number }
  | Nej;

/**
 * Hela vägen för en kod på ett köp ur katalogen, före Stripe: formen,
 * att köpet är en plan, databasens svar och kontrollen. Utan kod frågas
 * inte databasen.
 */
export async function planensKod(
  db: Kodklient,
  rabattkod: unknown,
  e: { kod: string; sort?: string | null },
): Promise<Kodbeslut> {
  const kod = normaliseraKod(rabattkod);
  if (kod === null) return { ok: true, kod: null };
  if (kod === false) return { ok: false, status: 409, fel: KOD_FINNS_INTE };
  if (!kodenGallerKopet(e)) return { ok: false, status: 409, fel: KOD_BARA_PLAN };
  const b = provaKodsvaret(await fragaOmKoden(db, kod, e.kod));
  return b.ok ? { ok: true, kod, pris: b.pris, rabatt: b.rabatt, attBetala: b.attBetala } : b;
}

/**
 * Samma väg för ett eget upplägg (egna_upplagg, 2026-10-27): formen,
 * databasens svar om koden på uppläggets pris (kod_pa_upplagget, med
 * familjens token, som också prövar att upplägget är familjens och går att
 * köpa) och kontrollen. Utan kod frågas inte databasen.
 */
export async function upplaggetsKod(db: Kodklient, rabattkod: unknown, upplagg: string): Promise<Kodbeslut> {
  const kod = normaliseraKod(rabattkod);
  if (kod === null) return { ok: true, kod: null };
  if (kod === false) return { ok: false, status: 409, fel: KOD_FINNS_INTE };
  const { data, error } = await db.rpc('kod_pa_upplagget', { p_kod: kod, p_upplagg: upplagg });
  if (error) return { ok: false, status: 409, fel: KOD_GICK_INTE };
  const rad = Array.isArray(data) ? data[0] : data;
  const b = provaKodsvaret(rad && typeof rad === 'object' ? rad as Kodsvar : null);
  return b.ok ? { ok: true, kod, pris: b.pris, rabatt: b.rabatt, attBetala: b.attBetala } : b;
}
