// ============================================================
// NEXTRUM — kvittot på en intresseanmälan
//
// Ett av två slags mejl vi skickar till någon som INTE har ett konto.
// Det andra är beskeden till den som sökt jobb (ansokan.ts, Fas 16.1),
// som följer samma tre regler av samma skäl. De gör tre saker
// annorlunda än notismejlen, och alla tre är avsiktliga.
//
//
// 1. DET GÅR INTE ATT VÄLJA BORT
//
// Ett transaktionsmejl: ett kvitto på något personen själv just
// gjorde, en sekund tidigare. Det ligger inte i notis_val, har ingen
// token och ingen avregistreringslänk. En avanmälningslänk här hade
// lovat något vi inte tänker hålla — nästa anmälan får ett kvitto
// ändå — och en länk som ljuger är värre än ingen länk.
//
// Foten säger i stället varför mejlet kom. Det är kravet i sak: man
// ska veta varför man fått ett mejl, inte nödvändigtvis kunna säga
// nej till ett kvitto man bett om.
//
//
// 2. DET SKICKAS FRÅN info@, INTE no-reply@
//
// Mejlet lovar svar inom 24 timmar och ber familjen höra av sig om
// något ska ändras. Ett no-reply som avsändare på ett mejl som ber om
// svar är en motsägelse, och svaret hamnar i ingenting.
//
//
// 3. KNAPPEN GÅR TILL DEN PUBLIKA SIDAN
//
// Mottagaren har inget konto än. En knapp till /foralder hade mött en
// inloggning, vilket är precis fel sak att möta en minut efter att man
// fyllt i ett formulär.
//
//
// INGA UPPGIFTER UR ANMÄLAN ÅTERGES
//
// Inte barnets namn, inte årskursen, inte meddelandet. Mejlet är ett
// kvitto på att anmälan kommit fram, inte en utskrift av den. Samma
// regel som gäller notismejlen, av samma skäl: mejlet passerar
// servrar vi inte styr över och ligger kvar i inkorgar vi inte
// kontrollerar. Förnamnet är det enda som följer med, och det går
// genom samma förnamnsregel som allt annat.
// ============================================================

import { fornamn } from './typer.ts';
import { KONTAKT, SAJT, renderaRam, type Ram, type Renderat } from './rendera.ts';

/** Avsändaren. Kvittot ber om svar, så det kommer från en läst adress. */
export const KVITTO_FRAN = `Nextrum <${KONTAKT}>`;

/** Löftet står på sajten. Ändras det här ska det ändras där också. */
export const SVAR_INOM_TIMMAR = 24;

export const KVITTO_TEXT = {
  amne: 'Tack för din intresseanmälan till Nextrum',
  rubrik: 'Tack, vi har fått din anmälan',
  mening: `Vi hör av oss inom ${SVAR_INOM_TIMMAR} timmar. Du behöver inte göra något `
        + 'mer så länge.',
  knapp: 'Så fungerar Nextrum',
  /* Siffror som etikett, inte rubriker. Faktarutan ritar etiketten
     dämpad och värdet fett, vilket är rätt för "När: 14 oktober" men
     bakvänt för ett steg: då hamnar tyngden på förklaringen i stället
     för på vad som faktiskt händer. Med en siffra till vänster läses
     det som den numrerade lista det är. */
  steg: [
    ['1', 'Vi läser din anmälan för hand. Ingen matchning sker automatiskt.'],
    ['2', 'Vi ringer för ett kort samtal om vad ni behöver hjälp med.'],
    ['3', 'Vi föreslår en studiehjälpare som passar, och ni får säga ja eller nej.'],
  ] as [string, string][],
  avslutning: 'Vill du ändra något du skrivit, eller undrar du över något, '
            + 'svara på det här mejlet så läser vi det.',
  varfor: 'Du får det här mejlet för att en intresseanmälan med din e-postadress '
        + 'skickades på nextrum.se. Var det inte du kan du bortse från mejlet — '
        + 'vi hör av oss bara en gång.',
};

/**
 * Kvittot till den som anmält intresse.
 *
 * namn är fritexten ur formuläret och kapas till ett förnamn. Saknas
 * det blir hälsningen "Hej," utan namn, vilket är bättre än "Hej
 * undefined," och mycket bättre än att låta bli att skicka.
 */
export function renderaKvitto(namn: unknown): Renderat {
  const forst = fornamn(namn);
  const ram: Ram = {
    roll: 'parent',
    halsning: forst ? `Hej ${forst},` : 'Hej,',
    innehall: {
      amne: KVITTO_TEXT.amne,
      rubrik: KVITTO_TEXT.rubrik,
      mening: KVITTO_TEXT.mening,
      knapp: KVITTO_TEXT.knapp,
      mal: 'sajten',
      fakta: KVITTO_TEXT.steg,
    },
    knappAdress: `${SAJT}/sa-fungerar-nextrum`,
    varfor: KVITTO_TEXT.varfor,
    // Transaktionsmejl: ingen avanmälan, ingen inställningssida.
    avregistrera: null,
    val: null,
    provrad: null,
    avslutning: KVITTO_TEXT.avslutning,
  };

  return renderaRam(ram);
}
