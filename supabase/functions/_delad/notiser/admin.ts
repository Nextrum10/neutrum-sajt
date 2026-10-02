// ============================================================
// NEXTRUM — påminnelsen till admin (2026-10-02)
//
// Ett mejl till superadminarna när något legat en timme i Att göra i
// adminvyn: antal per sort och en knapp dit. Köas av
// intern.admin_paminnelse_koa() i databasen och skickas av
// admin-paminnelse. Samma skal, samma avsändare och samma tre regler
// som kvittot och beskeden till den som sökt (kvitto.ts, ansokan.ts):
//
//   · det går inte att välja bort per mejl. Strömbrytaren är jobbet
//     admin-paminnelse (System → Automationer), och mottagarna är de som
//     har Att göra i sin vy.
//   · det skickas från info@, som det andra vi skickar.
//   · INGET ur raderna återges. Inte namn, inte adresser, inte texten i en
//     fråga eller en uppgift: mejlet passerar servrar vi inte styr över och
//     ligger kvar i inkorgar vi inte kontrollerar. Antalet och sorten är
//     allt, och resten står bakom inloggningen.
//
//
// SORTERNA ÄR EN LISTA HÄR OCH EN I DATABASEN
//
// ADMIN_SORTER speglar typlistan i admin_paminnelser (migrationen
// admin_paminnelser) och intern.admin_att_gora(). En sort som databasen
// skickar men som inte står här tas inte med, hellre än att texten ur
// databasen hamnar i ett mejl. Ändras den ena listan ändras den andra.
// ============================================================

import { KONTAKT, SAJT, renderaRam, type Ram, type Renderat } from './rendera.ts';

/** Avsändaren. Samma som kvittot och ansökningsmejlen. */
export const ADMIN_FRAN = `Nextrum <${KONTAKT}>`;

/** Adminvyns första sida, där Att göra står. */
export const ADMIN_ADRESS = `${SAJT}/admin#oversikt`;

export const ADMIN_SORTER = [
  { typ: 'ny_lead', ental: 'ny intresseanmälan', flertal: 'nya intresseanmälningar' },
  { typ: 'ny_ansokan', ental: 'ny jobbansökan', flertal: 'nya jobbansökningar' },
  { typ: 'sh_godkann', ental: 'studiehjälpare att godkänna', flertal: 'studiehjälpare att godkänna' },
  { typ: 'elev_utan_sh', ental: 'elev utan studiehjälpare', flertal: 'elever utan studiehjälpare' },
  { typ: 'fraga', ental: 'fråga i inkorgen', flertal: 'frågor i inkorgen' },
  { typ: 'pass_saknar_rapport', ental: 'pass utan rapport', flertal: 'pass utan rapport' },
  { typ: 'genomfort_utan_rapport', ental: 'genomfört pass utan rapport', flertal: 'genomförda pass utan rapport' },
  { typ: 'rapport_obekraftad', ental: 'rapport som familjen inte bekräftat', flertal: 'rapporter som familjerna inte bekräftat' },
  { typ: 'faktura_lagga_in', ental: 'faktura att lägga in i Fortnox', flertal: 'fakturor att lägga in i Fortnox' },
  { typ: 'faktura_obetald', ental: 'obetald faktura', flertal: 'obetalda fakturor' },
  { typ: 'utbetalning', ental: 'utbetalning att göra', flertal: 'utbetalningar att göra' },
  { typ: 'uppgift', ental: 'uppgift från systemet', flertal: 'uppgifter från systemet' },
] as const;

export type AdminTyp = typeof ADMIN_SORTER[number]['typ'];

export type AdminRad = { typ: AdminTyp; antal: number; etikett: string };

/** Ett heltal 1–99 999, annars inget. Allt annat ur databasen följer inte med. */
function antalOk(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 99_999 ? n : null;
}

function versal(s: string): string {
  return s.charAt(0).toLocaleUpperCase('sv-SE') + s.slice(1);
}

/**
 * Raderna i mejlet, i listans ordning. `antal` är ett objekt av typ →
 * antal, som databasen skriver det. En typ som inte står i listan, och
 * ett antal som inte är ett heltal, hoppas över.
 */
export function adminRader(antal: unknown): AdminRad[] {
  const d = (antal && typeof antal === 'object' && !Array.isArray(antal) ? antal : {}) as Record<string, unknown>;
  const ut: AdminRad[] = [];
  for (const s of ADMIN_SORTER) {
    const n = antalOk(Object.hasOwn(d, s.typ) ? d[s.typ] : undefined);
    if (n === null) continue;
    ut.push({ typ: s.typ, antal: n, etikett: versal(n === 1 ? s.ental : s.flertal) });
  }
  return ut;
}

/**
 * Mejlet, eller null när ingen rad är giltig. Null är inget att skicka:
 * ett mejl utan innehåll hade bara varit ett larm utan skäl.
 */
export function renderaAdminPaminnelse(antal: unknown): Renderat | null {
  const rader = adminRader(antal);
  if (!rader.length) return null;
  const summa = rader.reduce((s, r) => s + r.antal, 0);

  const ram: Ram = {
    roll: 'parent',
    halsning: 'Hej,',
    innehall: {
      amne: `Väntar på er: ${summa} ${summa === 1 ? 'sak' : 'saker'} i Att göra`,
      rubrik: 'Det här har väntat i en timme',
      mening: 'Det har legat i Att göra i över en timme och är fortfarande kvar. '
            + 'Det kommer ett mejl per sak, så de här kommer inte igen.',
      knapp: 'Öppna Att göra',
      mal: 'sajten',
      fakta: rader.map((r): [string, string] => [r.etikett, String(r.antal)]),
    },
    knappAdress: ADMIN_ADRESS,
    varfor: 'Du får det här för att du är superadmin på Nextrum. Mejlet kommer när något legat '
          + 'en timme i Att göra, och högst ett per kvart.',
    // Ett internt mejl: ingen avanmälan, ingen inställningssida.
    avregistrera: null,
    val: null,
    provrad: null,
    avslutning: 'Inga namn eller uppgifter står i mejlet. Resten finns i adminvyn.',
  };

  return renderaRam(ram);
}
