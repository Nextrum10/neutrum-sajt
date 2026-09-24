// ============================================================
// NEXTRUM — notismejlens texter
//
// En mall per mejlbar typ, med en variant för familj och en för
// studiehjälpare där de behöver säga olika saker. Varje mall ger
// samma fem delar: ämnesrad, rubrik, en kort mening, EN knapp och
// en liten faktaruta (när, ämne, elev, studiehjälpare).
//
// Mallen ser bara RenData: datum, tid, ämne och förnamn. Någon
// meddelandetext, anteckning eller plats finns inte att skriva ut,
// hur mallen än formuleras.
//
// AVBÖJT OCH AVBOKAT ÄR OLIKA BESKED. Avböjt: en önskad tid som
// motparten sa nej till, passet blev aldrig av. Avbokat: ett pass
// som fanns och ställdes in.
//
// VEM SOM GJORDE ÄNDRINGEN SÄGS INTE. Databasen skickar notisen till
// den som inte gjorde ändringen, men ibland var det admin, och då
// får båda den. "Tove har flyttat passet" hade då varit fel. Texterna
// säger vad som hänt, inte vem som gjorde det.
//
// BETALNINGEN STÅR I FAMILJENS MEJL (Fas 14.3). Familjen betalar varje
// pass med kort före passet, och ett pass som inte är betalt hålls
// inte. Bekräftelsen och påminnelsen sa ingenting om det, och det var
// två av de fyra villkoren för spärren "ingen betalning, inget pass"
// (DEPLOY-BETALNING.md 9.9). Mallen vet inte om passet är betalt —
// RenData bär bara datum, tid, ämne och förnamn, och läget hade ändå
// hunnit ändras mellan kön och utskicket — så alla tre säger det
// villkorat. Också en bekräftelse kan gälla ett betalt pass: flyttas
// det och bekräftas igen går samma mejl ut, och "betala det" hade då
// låtit som en ny räkning. Studiehjälparen får ingenting om
// betalningen: det är familjens sak, och studiehjälparvyn visar läget
// när spärren är på.
// ============================================================

import type { Avbokningsskal, MejlbarTyp, RenData, Roll } from './typer.ts';
import { narText, paminnelseNar } from './tid.ts';

/**
 * Vart knappen går. Hashen läses som #sektion/flik i vyerna.
 *
 * 'sajten' är den publika sidan, och används av transaktionsmejlen:
 * kvittot på en intresseanmälan går till någon som ännu inte har ett
 * konto, och en knapp till en inloggad vy hade mött en inloggning.
 */
export type Mal = 'pass' | 'meddelanden' | 'boka' | 'betalning' | 'sajten';

export type Innehall = {
  amne: string;
  rubrik: string;
  mening: string;
  knapp: string;
  mal: Mal;
  fakta: [string, string][];
};

export type MallIn = { roll: Roll; d: RenData; antal: number; nu: Date };

/** Till foten: "… där mejl om {kategori} är påslaget." */
export const KATEGORI: Record<MejlbarTyp, string> = {
  pass_nytt: 'nya pass',
  pass_bekraftat: 'bekräftade pass',
  pass_flyttat: 'flyttade pass',
  pass_avbokat: 'avbokade pass',
  pass_avbojt: 'avböjda tider',
  meddelande: 'nya meddelanden',
  paminnelse: 'påminnelser före pass',
};

const SVARA = 'Svara ja eller nej i Nextrum.';

/* Samma mening som villkoren, prissidan och FAQ:n. Den räknas av
   verktyg/kolla-betalningsvillkor.py, så att mejlet inte kan börja säga
   något annat än sidorna. */
const HALLS_INTE = 'Ett pass som inte är betalt hålls inte.';
const BETALA = `Betala det med kort i Nextrum senast innan det börjar, om ni inte redan har gjort det. ${HALLS_INTE}`;

/**
 * Skälet med våra egna ord. Databasen skickar bara koden, och ett
 * okänt värde har redan blivit null i renData().
 */
export const SKAL_TEXT: Record<Avbokningsskal, string> = {
  sjukdom: 'Sjukdom',
  forhinder: 'Förhinder',
  ombokat: 'Behöver en annan tid',
  ingen_hjalpare: 'Ingen studiehjälpare kunde ta passet',
  familjen_avslutar: 'Familjen avslutar',
  annat: 'Annat',
};

function medNar(bas: string, nar: string | null): string {
  return nar ? `${bas}: ${nar}` : bas;
}

/** Faktarutan för ett pass. Studiehjälparen ser inte sig själv, bara eleven. */
function passFakta(m: MallIn, nar: string | null, etikett = 'När'): [string, string][] {
  const f: [string, string][] = [];
  if (nar) f.push([etikett, nar]);
  if (m.d.amne) f.push(['Ämne', m.d.amne]);
  if (m.d.elev) f.push(['Elev', m.d.elev]);
  if (m.roll === 'parent' && m.d.studiehjalpare) f.push(['Studiehjälpare', m.d.studiehjalpare]);
  return f;
}

/** 'med Tove' för familjen, 'med Alva' för studiehjälparen, annars inget. */
function med(m: MallIn): string {
  const namn = m.roll === 'parent' ? m.d.studiehjalpare : m.d.elev;
  return namn ? ` med ${namn}` : '';
}

export const MALLAR: Record<MejlbarTyp, (m: MallIn) => Innehall> = {
  pass_nytt(m) {
    const nar = narText(m.d.datum, m.d.tid);
    const svara = m.d.status === 'requested';
    return {
      amne: medNar(svara ? 'Nytt pass att svara på' : 'Nytt pass bokat', nar),
      rubrik: svara ? 'Ett nytt pass väntar på ditt svar' : 'Ett nytt pass är bokat',
      mening: svara
        ? `Passet${med(m)} är inte bekräftat än. ${SVARA}`
        : m.roll === 'tutor' ? `Passet${med(m)} är bokat hos dig.` : `Passet${med(m)} är bokat. ${BETALA}`,
      knapp: svara ? 'Svara i Nextrum' : m.roll === 'parent' ? 'Gå till betalningen' : 'Visa passet',
      mal: !svara && m.roll === 'parent' ? 'betalning' : 'pass',
      fakta: passFakta(m, nar),
    };
  },

  pass_bekraftat(m) {
    const nar = narText(m.d.datum, m.d.tid);
    return {
      amne: medNar('Passet är bekräftat', nar),
      rubrik: 'Passet är bekräftat',
      mening: `Tiden gäller och passet${med(m)} är bokat.` + (m.roll === 'parent' ? ` ${BETALA}` : ''),
      knapp: m.roll === 'parent' ? 'Gå till betalningen' : 'Visa passet',
      mal: m.roll === 'parent' ? 'betalning' : 'pass',
      fakta: passFakta(m, nar),
    };
  },

  pass_flyttat(m) {
    const nar = narText(m.d.datum, m.d.tid);
    const fore = narText(m.d.franDatum, m.d.franTid);
    const svara = m.d.status === 'requested';
    const fakta = passFakta(m, nar, 'Ny tid');
    if (fore) fakta.splice(nar ? 1 : 0, 0, ['Tidigare', fore]);
    return {
      amne: nar ? `Passet är flyttat till ${nar}` : 'Ett pass är flyttat',
      rubrik: 'Passet har flyttats',
      mening: svara ? `Den nya tiden är inte bekräftad än. ${SVARA}` : 'Den nya tiden gäller.',
      knapp: svara ? 'Svara i Nextrum' : 'Visa passet',
      mal: 'pass',
      fakta,
    };
  },

  // Skälet står i faktarutan, och meningen säger vad man gör nu. En
  // TID att föreslå kan mejlet inte ge: studiehjälparen har inget
  // schema längre, så det finns inget att räkna fram en ledig tid ur.
  // I stället leder knappen dit där tiden väljs — för familjen Boka
  // pass, för studiehjälparen chatten, eftersom det är familjen som
  // föreslår. Avslutar familjen finns ingen ny tid att föreslå.
  pass_avbokat(m) {
    const nar = narText(m.d.datum, m.d.tid);
    const fakta = passFakta(m, nar);
    if (m.d.skal) fakta.push(['Skäl', SKAL_TEXT[m.d.skal]]);
    const nyTid = m.d.skal !== 'familjen_avslutar';
    const familj = m.roll === 'parent';
    return {
      amne: medNar('Passet är avbokat', nar),
      rubrik: 'Passet är avbokat',
      mening: `Passet${med(m)} blir inte av.` + (!nyTid ? ''
        : familj
          ? ' Föreslå gärna en ny tid som passar er: tryck på en dag under Boka pass, så får studiehjälparen svara.'
          : ' Skriv gärna till familjen vilka tider som passar dig, så kan de föreslå en ny.'),
      knapp: !nyTid ? 'Visa dina pass' : familj ? 'Föreslå en ny tid' : 'Skriv till familjen',
      mal: !nyTid ? 'pass' : familj ? 'boka' : 'meddelanden',
      fakta,
    };
  },

  pass_avbojt(m) {
    const nar = narText(m.d.datum, m.d.tid);
    return {
      amne: medNar('Tiden blev avböjd', nar),
      rubrik: 'Tiden blev avböjd',
      mening: m.roll === 'parent'
        ? 'Passet blir inte av på den tiden. Du kan välja en annan tid i Nextrum.'
        : 'Passet blir inte av på den tiden.',
      knapp: 'Visa dina pass',
      mal: 'pass',
      fakta: passFakta(m, nar),
    };
  },

  meddelande(m) {
    const flera = m.antal > 1;
    const fran = m.d.fran ? ` från ${m.d.fran}` : '';
    const vem = m.d.fran
      ? `${m.d.fran} har skrivit till dig i Nextrum.`
      : flera ? 'Du har fått nya meddelanden i Nextrum.' : 'Du har fått ett nytt meddelande i Nextrum.';
    return {
      amne: flera ? `${m.antal} nya meddelanden${fran}` : `Nytt meddelande${fran}`,
      rubrik: flera ? `${m.antal} nya meddelanden` : 'Nytt meddelande',
      // Varför texten inte står här: den kan gälla ett barns skolgång,
      // och sådant ska inte ligga kvar i en inkorg.
      mening: `${vem} Själva texten läser du där, inte i mejlet.`,
      knapp: flera ? 'Läs meddelandena' : 'Läs meddelandet',
      mal: 'meddelanden',
      fakta: [],
    };
  },

  paminnelse(m) {
    const nar = paminnelseNar(m.d, m.nu);
    return {
      amne: nar ? `Påminnelse: pass ${nar}` : 'Påminnelse om pass',
      rubrik: nar ? `Pass ${nar}` : 'Påminnelse om pass',
      mening: `En påminnelse om passet${med(m)}.` + (m.roll === 'parent' ? ` ${BETALA}` : ''),
      knapp: 'Visa passet',
      mal: 'pass',
      fakta: passFakta(m, narText(m.d.datum, m.d.tid)),
    };
  },
};
