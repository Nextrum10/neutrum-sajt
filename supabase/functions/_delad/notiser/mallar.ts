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
// ============================================================

import type { MejlbarTyp, RenData, Roll } from './typer.ts';
import { narText, paminnelseNar } from './tid.ts';

/** Vart knappen går. Hashen läses som #sektion/flik i vyerna. */
export type Mal = 'pass' | 'meddelanden';

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
        : m.roll === 'tutor' ? `Passet${med(m)} är bokat hos dig.` : `Passet${med(m)} är bokat.`,
      knapp: svara ? 'Svara i Nextrum' : 'Visa passet',
      mal: 'pass',
      fakta: passFakta(m, nar),
    };
  },

  pass_bekraftat(m) {
    const nar = narText(m.d.datum, m.d.tid);
    return {
      amne: medNar('Passet är bekräftat', nar),
      rubrik: 'Passet är bekräftat',
      mening: `Tiden gäller och passet${med(m)} är bokat.`,
      knapp: 'Visa passet',
      mal: 'pass',
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

  pass_avbokat(m) {
    const nar = narText(m.d.datum, m.d.tid);
    return {
      amne: medNar('Passet är avbokat', nar),
      rubrik: 'Passet är avbokat',
      mening: m.roll === 'parent'
        ? `Passet${med(m)} blir inte av. Du kan boka en ny tid i Nextrum.`
        : `Passet${med(m)} blir inte av.`,
      knapp: 'Visa dina pass',
      mal: 'pass',
      fakta: passFakta(m, nar),
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
      mening: `En påminnelse om passet${med(m)}.`,
      knapp: 'Visa passet',
      mal: 'pass',
      fakta: passFakta(m, narText(m.d.datum, m.d.tid)),
    };
  },
};
