// ============================================================
// NEXTRUM — delad hjälp: underlaget till Nex månadsrapport
//
// nex-manadsrapport hämtar raderna ur drifts läsfunktioner
// (ai_analys, ai_avvikelser, ai_omatchade_elever, ai_saknade_rapporter,
// ai_nya_leads, ai_kommande_pass) och skickar en SAMMANFATTNING till
// modellen, aldrig raderna. Här räknas den.
//
// Bara summor lämnar oss: inga id:n, inga initialer, ingen fritext ur
// en anmälan. Det är skillnaden mot drift-agenten, som får rader med
// initialer och maskad fritext (DATASKYDD.md rad 16). En rapport om
// hur månaden gick behöver inte veta vem någon är.
//
// Rena funktioner, så att de går att pröva utan databas
// (manadsrapport_test.ts).
// ============================================================

export const RAPPORT_PREFIX = 'Månadsrapport för ';

const MANADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli',
  'augusti', 'september', 'oktober', 'november', 'december'];

/** År och månad i Stockholm för en tidpunkt. Månaden är 1–12. */
function stockholm(nu: Date): { ar: number; man: number } {
  const delar = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit',
  }).formatToParts(nu);
  const ar = Number(delar.find((d) => d.type === 'year')?.value);
  const man = Number(delar.find((d) => d.type === 'month')?.value);
  return { ar, man };
}

function iso(ar: number, man: number): string {
  return ar + '-' + String(man).padStart(2, '0') + '-01';
}

/** Förra månadens första dag, i Stockholm: 'ÅÅÅÅ-MM-01'. */
export function forraManaden(nu: Date): string {
  const { ar, man } = stockholm(nu);
  return man === 1 ? iso(ar - 1, 12) : iso(ar, man - 1);
}

/** Den här månadens första dag, i Stockholm. */
export function dennaManaden(nu: Date): string {
  const { ar, man } = stockholm(nu);
  return iso(ar, man);
}

/** Månaden före en given månad. */
export function manadenFore(manad: string): string {
  const [a, m] = manad.split('-').map(Number);
  return m === 1 ? iso(a - 1, 12) : iso(a, m - 1);
}

/** 'ÅÅÅÅ-MM-01' om strängen är en sådan, annars null. */
export function giltigManad(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(v)) return null;
  return v;
}

/** "oktober 2026" */
export function manadsnamn(manad: string): string {
  const [a, m] = manad.split('-').map(Number);
  return MANADER[m - 1] + ' ' + a;
}

/** Hur körningen heter i agent_korningar. Adminvyn letar efter den. */
export function rubrik(manad: string): string {
  return RAPPORT_PREFIX + manadsnamn(manad);
}

/** Hur många dagar bakåt som når månadens första dag, minst 1. Fönstret
    till ai_nya_leads; anmälningarna sorteras sedan på månaden. */
export function dagarSedan(manad: string, nu: Date): number {
  const start = Date.parse(manad + 'T00:00:00Z');
  return Math.max(1, Math.ceil((nu.getTime() - start) / 86400000));
}

const tal = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const kr = (ore: unknown) => Math.round(tal(ore) / 100);

// deno-lint-ignore no-explicit-any
type Rad = Record<string, any>;

export type Rader = {
  analys: Rad[];
  avvikelser: Rad[];
  omatchade: Rad[];
  saknadeRapporter: Rad[];
  nyaLeads: Rad[];
  kommandePass: Rad[];
};

function siffror(r: Rad | undefined) {
  if (!r) return null;
  return {
    genomforda_pass: tal(r.genomforda_pass),
    timmar: Math.round(tal(r.minuter) / 6) / 10,
    aktiva_elever: tal(r.aktiva_elever),
    aktiva_studiehjalpare: tal(r.aktiva_studiehjalpare),
    anmalningar: tal(r.anmalningar),
    blev_kund: tal(r.blev_kund),
    fick_forsta_passet: tal(r.fick_forsta_passet),
    anmalningar_som_inte_gar_att_folja: tal(r.ej_sparbara),
    betalt_kr: kr(r.betalt_ore),
    utbetalt_kr: kr(r.utbetalt_ore),
    avbokningar: tal(r.avbokningar),
  };
}

/** Sammanfattningen som går till modellen. Inga id:n och ingen fritext. */
export function byggUnderlag(manad: string, rader: Rader) {
  const forra = manadenFore(manad);
  const radFor = (m: string) => rader.analys.find((r) => String(r.manad).slice(0, 10) === m);

  const avvikelser = new Map<string, { typ: string; antal: number; belopp_kr: number }>();
  for (const a of rader.avvikelser) {
    const typ = String(a.typ ?? 'okänd');
    const f = avvikelser.get(typ) ?? { typ, antal: 0, belopp_kr: 0 };
    f.antal += 1;
    f.belopp_kr += kr(a.belopp_ore);
    avvikelser.set(typ, f);
  }

  const iManaden = rader.nyaLeads.filter((l) => String(l.skapad ?? '').slice(0, 7) === manad.slice(0, 7));
  const perLage: Record<string, number> = {};
  for (const l of iManaden) {
    const s = String(l.status ?? 'okänd');
    perLage[s] = (perLage[s] ?? 0) + 1;
  }

  return {
    manad: manadsnamn(manad),
    siffror: {
      [manadsnamn(manad)]: siffror(radFor(manad)),
      [manadsnamn(forra)]: siffror(radFor(forra)),
    },
    avvikelser_nu: [...avvikelser.values()],
    vantar_nu: {
      elever_utan_studiehjalpare: rader.omatchade.length,
      langst_vantat_dagar: rader.omatchade.reduce((m, e) => Math.max(m, tal(e.dagar_utan_match)), 0),
      pass_utan_rapport: rader.saknadeRapporter.length,
      varav_utan_uppgift_till_oss: rader.saknadeRapporter.filter((p) => !p.har_uppgift).length,
      bokade_pass_kommande_14_dagar: rader.kommandePass.length,
    },
    anmalningar_i_manaden_per_lage: perLage,
  };
}

/** Svarets text, eller null om det inte finns ett helt svar. */
// deno-lint-ignore no-explicit-any
export function svarstext(svar: any): string | null {
  if (!svar || svar.stop_reason === 'max_tokens' || svar.stop_reason === 'refusal') return null;
  const text = (Array.isArray(svar.content) ? svar.content : [])
    // deno-lint-ignore no-explicit-any
    .filter((b: any) => b && b.type === 'text' && typeof b.text === 'string')
    // deno-lint-ignore no-explicit-any
    .map((b: any) => b.text).join('').trim();
  return text || null;
}
