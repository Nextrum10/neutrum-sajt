// ============================================================
// NEXTRUM — mejlen till admin (2026-10-02)
//
// Två sorters mejl till ledningen, och ett prov:
//
//   · DIREKT: en jobbansökan har kommit in. Ett mejl per ansökan, i samma
//     stund. (Intresseanmälan mejlas direkt av lead-notis, som förut.)
//   · MORGON: det som ligger kvar i Att göra kl. 9 svensk tid, i ETT mejl
//     om dagen. Rapporter som familjen inte bekräftat, pass utan rapport,
//     fakturor, utbetalningar, frågor, uppgifter. Varje sak kommer med en
//     gång.
//   · PROV: morgonmejlet som ett testmejl, märkt som ett, när en människa
//     bett om ett.
//
// Köas av intern.admin_paminnelse_kor() och intern.admin_ansokan_direkt()
// i databasen och skickas av admin-paminnelse. Samma skal, samma
// avsändare och samma tre regler som kvittot och beskeden till den som
// sökt (kvitto.ts, ansokan.ts):
//
//   · det går inte att välja bort per mejl. Strömbrytaren är jobbet
//     admin-paminnelse (System → Automationer) och, för det direkta,
//     triggern admin_ansokan_direkt.
//   · det skickas från info@, som det andra vi skickar.
//   · INGET ur raderna återges. Inte namn, inte adresser, inte texten i en
//     fråga eller en uppgift: mejlet passerar servrar vi inte styr över och
//     ligger kvar i inkorgar vi inte kontrollerar. Antalet och sorten är
//     allt, och resten står bakom inloggningen.
//
//
// SORTERNA ÄR EN LISTA HÄR OCH EN I DATABASEN
//
// ADMIN_SORTER speglar intern.admin_att_gora() i databasen: Att göra i
// vyn, minus det som mejlas direkt (intresseanmälan, jobbansökan, som inte
// ska komma en gång till i morgonmejlet). En sort som databasen skickar
// men som inte står här tas inte med, hellre än att texten ur databasen
// hamnar i ett mejl. Ändras den ena listan ändras den andra.
// ============================================================

import { KONTAKT, SAJT, renderaRam, type Ram, type Renderat } from './rendera.ts';

/** Avsändaren. Samma som kvittot och ansökningsmejlen. */
export const ADMIN_FRAN = `Nextrum <${KONTAKT}>`;

/**
 * Ut över superadminarna går de också till info@, som aviseringen om en
 * intresseanmälan (lead-notis), så att det finns en adress som läses
 * också när ingen av dem hinner.
 */
export const ADMIN_EXTRA_TILL = [KONTAKT] as const;

/** Adminvyns första sida, där Att göra står. */
export const ADMIN_ADRESS = `${SAJT}/admin#oversikt`;

/** Ansökningarna i adminvyn, dit det direkta mejlet leder. */
export const ADMIN_ANSOKNINGAR = `${SAJT}/admin#ansokningar`;

export const ADMIN_SORTER = [
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

export type AdminSlag = 'direkt' | 'morgon' | 'prov';

/** Ett heltal 1–99 999, annars inget. Allt annat ur databasen följer inte med. */
function antalOk(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 99_999 ? n : null;
}

function versal(s: string): string {
  return s.charAt(0).toLocaleUpperCase('sv-SE') + s.slice(1);
}

function objekt(v: unknown): Record<string, unknown> {
  return (v && typeof v === 'object' && !Array.isArray(v) ? v : {}) as Record<string, unknown>;
}

/**
 * Slaget ur raden: databasen lägger det i antal-objektet (admin_paminnelse_ta
 * har samma signatur som förut). Saknas det är det ett morgonmejl, som raderna
 * var innan slaget fanns. Ett slag vi inte känner ger null, och då skickas inget.
 */
export function adminSlag(antal: unknown): AdminSlag | null {
  const d = objekt(antal);
  if (!Object.hasOwn(d, 'slag')) return 'morgon';
  const s = d.slag;
  return s === 'direkt' || s === 'morgon' || s === 'prov' ? s : null;
}

/**
 * Raderna i morgonmejlet, i listans ordning. `antal` är ett objekt av typ →
 * antal, som databasen skriver det. En typ som inte står i listan (också
 * ny_lead och ny_ansokan, som mejlas direkt), och ett antal som inte är ett
 * heltal, hoppas över.
 */
export function adminRader(antal: unknown): AdminRad[] {
  const d = objekt(antal);
  const ut: AdminRad[] = [];
  for (const s of ADMIN_SORTER) {
    const n = antalOk(Object.hasOwn(d, s.typ) ? d[s.typ] : undefined);
    if (n === null) continue;
    ut.push({ typ: s.typ, antal: n, etikett: versal(n === 1 ? s.ental : s.flertal) });
  }
  return ut;
}

const INTERNT = 'Det här är ett internt mejl till Nextrums ledning.';

function direkt(antal: unknown): Renderat | null {
  // Bara EN sort går direkt, och bara som ett: en ansökan, ett mejl.
  if (antalOk(objekt(antal).ny_ansokan) === null) return null;

  const ram: Ram = {
    roll: 'parent',
    halsning: 'Hej,',
    innehall: {
      amne: 'Ny jobbansökan har kommit in',
      rubrik: 'Ny jobbansökan',
      mening: 'Någon har skickat en jobbansökan på nextrum.se. Vem det är och vad som står i den ser du i '
            + 'adminvyn, under Ansökningar. Det kommer ett mejl per ansökan, en gång.',
      knapp: 'Öppna Ansökningar',
      mal: 'sajten',
      fakta: [],
    },
    knappAdress: ADMIN_ANSOKNINGAR,
    varfor: `${INTERNT} Det kommer direkt när en jobbansökan kommer in.`,
    // Ett internt mejl: ingen avanmälan, ingen inställningssida.
    avregistrera: null,
    val: null,
    provrad: null,
    avslutning: 'Inga namn eller uppgifter står i mejlet. Resten finns i adminvyn.',
  };
  return renderaRam(ram);
}

function morgon(antal: unknown, prov: boolean): Renderat | null {
  const rader = adminRader(antal);
  if (!rader.length) return null;
  const summa = rader.reduce((s, r) => s + r.antal, 0);
  const amne = `Väntar på er: ${summa} ${summa === 1 ? 'sak' : 'saker'} i Att göra`;

  const ram: Ram = {
    roll: 'parent',
    halsning: 'Hej,',
    innehall: {
      amne: prov ? `[Test] ${amne}` : amne,
      rubrik: 'Det här väntar på er',
      mening: 'Det här ligger kvar i Att göra. Varje sak kommer med i ett morgonmejl en gång, '
            + 'så de här kommer inte igen.',
      knapp: 'Öppna Att göra',
      mal: 'sajten',
      fakta: rader.map((r): [string, string] => [r.etikett, String(r.antal)]),
    },
    knappAdress: ADMIN_ADRESS,
    varfor: `${INTERNT} Morgonmejlet kommer kl. 9, och bara när något ligger kvar i Att göra.`,
    // Ett internt mejl: ingen avanmälan, ingen inställningssida.
    avregistrera: null,
    val: null,
    provrad: prov
      ? 'Det här är ett testmejl, för att visa hur morgonmejlet ser ut. Sakerna är de som ligger i Att göra just nu. Inget behöver göras.'
      : null,
    avslutning: 'Inga namn eller uppgifter står i mejlet. Resten finns i adminvyn.',
  };
  return renderaRam(ram);
}

/**
 * Mejlet, eller null när det inte finns något giltigt att skicka. Null är inget
 * att skicka: ett mejl utan innehåll hade bara varit ett larm utan skäl.
 */
export function renderaAdminPaminnelse(antal: unknown): Renderat | null {
  const slag = adminSlag(antal);
  if (slag === 'direkt') return direkt(antal);
  if (slag === 'morgon') return morgon(antal, false);
  if (slag === 'prov') return morgon(antal, true);
  return null;
}
