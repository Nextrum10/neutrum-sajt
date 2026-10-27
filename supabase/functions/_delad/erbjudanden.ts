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
  /** Timpriset efter rabatten, nedåt till hel krona. Saknas i äldre svar. */
  rabatterat_timpris_ore?: number;
};

/** Hur länge en plan gäller från betalningen, som klippkort_betald räknar (2026-10-21). */
export const PLANENS_DAGAR = 30;

/**
 * Säljs erbjudandet? Bara planerna sedan 2026-10-22 (Leo: tre planer, 4, 8
 * och 12 timmar). Fyll timbanken, sorten 'klippkort' i katalogen, står kvar
 * i erbjudanden_pris, för köpta kort pekar på sin rad där och syns i
 * vyerna; därför prövas sorten här och inte i databasen. Det som redan är
 * köpt rörs inte: klippkort-betala drar timmarna som förut, och en kassa som
 * öppnades före spärren betalas av webhooken som förut. Timmar till en plan
 * (plan_extra) går en egen väg i kassan och prövas inte här.
 */
export function saljs(e: Pick<ErbjudandePris, 'sort'> | null | undefined): boolean {
  return !!e && e.sort === 'plan';
}

/** Kassans nej till ett köp som inte säljs, för familjen. */
export const SALJS_INTE = 'Fyll timbanken går inte att köpa längre. Välj en av planerna, eller kontakta oss '
  + 'om ni behöver ett eget upplägg. Timmar ni redan har köpt gäller som förut.';

const timmarText = (n: number) => (n === 1 ? '1 timme' : `${n} timmar`);

/** Ören som kronor på kvittot: hela kronor utan decimaler, annars två. */
const kr = (ore: number) =>
  Number(ore) % 100 === 0 ? String(Number(ore) / 100) : (Number(ore) / 100).toFixed(2).replace('.', ',');

/**
 * Familjens rabatt på ett köp ur katalogen (familjerabatter, 2026-10-15):
 * kronor av på varje betald timme, när de lämnar ett pris kvar. Samma regel
 * som intern.klippkort_rabatt, som räknar beloppet när köpet skapas, och
 * det är databasens belopp kassan drar. Här avgör regeln bara om ett
 * väntande köp har samma pris som ett nytt hade fått.
 */
export function familjerabattPaKop(
  e: Pick<ErbjudandePris, 'timmar' | 'timmar_pa_kopet' | 'rabatterat_timpris_ore'>,
  perTimmeOre: number,
): { perTimme: number; summa: number } {
  const per = Number(perTimmeOre) || 0;
  const betalda = Math.max(Number(e.timmar) - (Number(e.timmar_pa_kopet) || 0), 0);
  const timpris = Number(e.rabatterat_timpris_ore);
  if (!(per > 0) || !(betalda > 0) || !(timpris > per)) return { perTimme: 0, summa: 0 };
  return { perTimme: per, summa: betalda * per };
}

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
 *
 * Familjens rabatt (familjerabatter, 2026-10-15) står på raden när köpet
 * har en: kassan är det enda ställe familjen ser att den har rabatt, och
 * kvittot ska säga varför beloppet är lägre. Aldrig koden.
 */
export function kassarad(
  e: ErbjudandePris,
  rabattkod: string | null = null,
  familjerabattOre = 0,
  gallerFran: string | null = null,
  kodensRabattOre: number | null = null,
): { name: string; description: string } {
  const man = e.giltig_manader === 1 ? '1 månad' : `${e.giltig_manader} månader`;
  const timmar = Number(e.timmar);
  const pa = Math.max(0, Math.min(Number(e.timmar_pa_kopet) || 0, timmar - 1));
  const rabatt = Number(e.rabatt_procent) || 0;
  let vad = `${timmarText(timmar)} läxhjälp`;
  if (pa > 0) vad += ` för priset av ${timmar - pa} (${timmarText(pa)} på köpet)`;
  if (rabatt > 0) vad += `, ${rabatt} % rabatt`;
  // Koden står på raden, så att kvittot säger varför beloppet är lägre.
  // En partnerkod utan rabatt (koder_for_planer, 2026-10-21) gör inte
  // beloppet lägre, och då säger raden bara koden.
  const kod = !rabattkod ? ''
    : kodensRabattOre === 0 ? ` Med koden ${rabattkod}.` : ` Med rabattkoden ${rabattkod}.`;
  const egen = Number(familjerabattOre) > 0 ? ` Med er rabatt på ${kr(familjerabattOre)} kr per timme.` : '';
  // En plan gäller 30 dagar från köpet (2026-10-21, Leo: "köper planen
  // direkt och den används 30 dagar framåt"). Ett köp som bär en månad
  // (planerna per kalendermånad, samma dag) säger sin månad.
  const nar = gallerFran ? `Gäller ${planensPeriod(gallerFran)}.`
    : e.sort === 'plan' ? `Gäller i ${PLANENS_DAGAR} dagar från köpet.` : `Gäller i ${man} från köpet.`;
  return { name: e.namn, description: `${vad}. ${nar}${egen}${kod}` };
}

/** Ett eget upplägg (egna_upplagg, 2026-10-27), som eget_upplagg_kop() svarar det. */
export type Upplagget = {
  namn: string; timmar: number; timpris_ore: number; familjerabatt_ore?: number;
  /** Koden på köpet och dess egen rabatt i ören, som databasen drog den. */
  rabattkod?: string | null; kodens_rabatt_ore?: number | null;
};

/**
 * Raden i kassan och på kvittot för ett eget upplägg: namnet admin gav
 * det, timmarna och timpriset, och att det gäller som en plan, 30 dagar
 * från köpet. Familjens rabatt och koden står när köpet har dem, som för
 * en plan. Beloppet är databasens (eget_upplagg_kop), aldrig räknat här.
 */
export function kassaradForUpplagg(u: Upplagget): { name: string; description: string } {
  const timpris = Number(u.timpris_ore);
  const rabatt = Number(u.familjerabatt_ore) || 0;
  const namn = String(u.namn ?? '').trim();
  // Som kassarad: en partnerkod utan rabatt säger bara koden.
  const kod = !u.rabattkod ? ''
    : Number(u.kodens_rabatt_ore) === 0 ? ` Med koden ${u.rabattkod}.` : ` Med rabattkoden ${u.rabattkod}.`;
  return {
    name: namn ? `Eget upplägg: ${namn}` : 'Eget upplägg',
    description: `${timmarText(Number(u.timmar))} läxhjälp, ${kr(timpris)} kr i timmen`
      + (rabatt > 0 && rabatt < timpris ? `, med er rabatt ${kr(timpris - rabatt)} kr` : '')
      + `. Gäller i ${PLANENS_DAGAR} dagar från köpet, som en plan.${kod}`,
  };
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

/**
 * Har ett väntande köp samma innehåll som katalogens rad nu? Priset
 * räcker inte sedan planerna fick timmar på köpet (2026-10-07): 8 för 7
 * och 9 för 7 kostar lika mycket. En kolumn som saknas (före migrationen)
 * räknas som 0, på båda sidor.
 */
export function sammaInnehall(
  kop: { timmar?: unknown; timmar_pa_kopet?: unknown; rabatt_procent?: unknown; giltig_manader?: unknown } | null | undefined,
  e: Pick<ErbjudandePris, 'timmar' | 'rabatt_procent' | 'giltig_manader'> & { timmar_pa_kopet?: number | null },
): boolean {
  if (!kop) return false;
  const tal = (v: unknown) => Number(v) || 0;
  return tal(kop.timmar) === tal(e.timmar)
    && tal(kop.timmar_pa_kopet) === tal(e.timmar_pa_kopet)
    && tal(kop.rabatt_procent) === tal(e.rabatt_procent)
    && tal(kop.giltig_manader) === tal(e.giltig_manader);
}

/* ============================================================
   TIMMAR TILL PLANEN (2026-10-14, timmarna_delas_och_kops_till)

   Leo: "man ska kunna välja hur många timmar man köper". Priset räknas
   i databasen (extra_timmar_erbjudande), och här står bara det som går
   att pröva utan den: hur många timmar anropet får be om, och raden i
   kassan och på kvittot.
   ============================================================ */

/** Högst så många timmar åt gången, som i extra_timmar_erbjudande(). */
export const EXTRA_TIMMAR_MAX = 20;

/** Ett heltal 1–20, eller null. Allt annat nekas innan databasen frågas. */
export function extraTimmar(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,2}$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= EXTRA_TIMMAR_MAX ? n : null;
}

const MANADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september',
  'oktober', 'november', 'december'];

/* ============================================================
   PLANERNA PER MÅNAD (2026-10-21, planerna_per_manad)

   Leo: en plan köps för "Den här månaden" eller "Nästa månad", och
   timmarna går ut när månaden är slut. Kassan räknar planens första dag
   här, i Stockholms tid, och databasen prövar den igen
   (intern.klippkort_manad): bara den 1:a i den här eller nästa månad.
   ============================================================ */

/** Planens månad i anropet: den här eller nästa. Allt annat är null. */
export function planManad(v: unknown): 'denna' | 'nasta' | null {
  return v === 'denna' || v === 'nasta' ? v : null;
}

/** Den 1:a i den här eller nästa månad i Stockholms tid, som "2026-11-01". */
export function manadensForsta(val: 'denna' | 'nasta', nu: Date = new Date()): string {
  const delar = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit' })
    .formatToParts(nu);
  let ar = Number(delar.find((d) => d.type === 'year')?.value);
  let man = Number(delar.find((d) => d.type === 'month')?.value);
  if (val === 'nasta') {
    man += 1;
    if (man > 12) {
      man = 1;
      ar += 1;
    }
  }
  return `${ar}-${String(man).padStart(2, '0')}-01`;
}

/** "2026-11-01" som "1–30 november 2026", planens hela månad. En annan form står som den är. */
export function planensPeriod(forsta: string): string {
  const m = /^(\d{4})-(\d{2})-01$/.exec(String(forsta ?? ''));
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return String(forsta ?? '');
  const ar = Number(m[1]);
  const man = Number(m[2]);
  const sista = new Date(Date.UTC(ar, man, 0)).getUTCDate();
  return `1–${sista} ${MANADER[man - 1]} ${ar}`;
}

/** "2026-11-03" som "3 november 2026". Ett datum i fel form står som det är. */
export function svensktDatum(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return String(iso ?? '');
  return `${Number(m[3])} ${MANADER[Number(m[2]) - 1]} ${m[1]}`;
}

export type ExtraTimmar = {
  plan_namn: string;
  timmar: number;
  rabatterat_timpris_ore: number;
  giltigt_till: string;
  /** Familjens rabatt per timme (familjerabatter, 2026-10-15), eller 0. */
  familjerabatt_ore?: number;
};

/**
 * Raden i kassan och på kvittot för timmar till en plan. Som kassarad():
 * vad familjen köper och hur länge det gäller, och här att det är
 * planens timpris och planens sista dag. Med familjens rabatt står också
 * timpriset efter den.
 */
export function kassaradTillPlanen(x: ExtraTimmar): { name: string; description: string } {
  const timpris = Number(x.rabatterat_timpris_ore);
  const rabatt = Number(x.familjerabatt_ore) || 0;
  const med = rabatt > 0 && rabatt < timpris ? `, med er rabatt ${kr(timpris - rabatt)} kr` : '';
  return {
    name: `Extra timmar till ${String(x.plan_namn || 'planen')}`,
    description: `${timmarText(Number(x.timmar))} läxhjälp till planens timpris, ${kr(Math.floor(timpris / 100) * 100)} kr i timmen${med}. `
      + `Gäller till och med ${svensktDatum(x.giltigt_till)}, samma dag som planen.`,
  };
}
