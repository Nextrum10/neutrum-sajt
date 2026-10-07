// ============================================================
// NEXTRUM — mejlet med länken till kontot (2026-10-07)
//
// bjud-in skickar det själv sedan 2026-10-07, genom Resend som våra
// andra mejl, i stället för att låta Supabase Auth göra det med mallen i
// panelen. Skälet är Gmail: tre inbjudningar till samma adress hade samma
// ämne och samma text, så Gmail lade dem i en tråd och gömde det som
// upprepades bakom tre prickar. Det senaste mejlet såg tomt ut, och
// länkarna som syntes var de gamla, som inte fungerade längre (Alexandar,
// två gånger samma dag). Auths mallar har inget som skiljer två utskick
// åt och går att visa: bara koden och dess hash, och ingen av dem hör
// hemma i ett ämne.
//
// Här står tiden i ämnet och i mejlet, så att varje utskick blir en egen
// tråd och det syns vilket som är det senaste. Två utskick till samma
// konto ligger minst en minut isär (MELLAN_MEJL_MS i inbjudan.ts), så två
// ämnen blir aldrig lika. Länken går genom /lank som förut, kodad en gång
// som Auths mallar gör (nextrum-lank.js avkodar).
//
// Ett transaktionsmejl: ingen avanmälan och inga val, och foten säger
// varför det kom. Bara förnamnet följer med.
// ============================================================

import { MANADER } from '../konstanter.ts';
import { fornamn, type Roll } from './typer.ts';
import { KONTAKT, SAJT, renderaRam, type Renderat } from './rendera.ts';

/** Avsändaren. Den som inte kommer in svarar på mejlet, så det kommer från en läst adress. */
export const KONTO_FRAN = `Nextrum <${KONTAKT}>`;

/** inbjudan: kontot har inte använt någon länk än. losenord: kontot finns, och personen väljer lösenord. */
export type Kontomejl = 'inbjudan' | 'losenord';

const KLOCKA = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Stockholm', year: 'numeric', month: 'numeric', day: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** '7 oktober kl. 15:51', i svensk tid. Servern går i UTC, mottagaren gör det inte. */
export function skickadText(nu: Date): string {
  const delar = KLOCKA.formatToParts(nu);
  const del = (t: string) => delar.find((p) => p.type === t)?.value ?? '';
  return `${Number(del('day'))} ${MANADER[Number(del('month')) - 1]} kl. ${del('hour')}:${del('minute')}`;
}

/** /lank med Auths länk efter #, kodad en gång. */
export function lankAdress(verify: string): string {
  return `${SAJT}/lank#${encodeURIComponent(verify)}`;
}

export const KONTO_TEXT = {
  inbjudan: {
    amne: 'Ditt konto hos Nextrum',
    rubrik: 'Välkommen till Nextrum',
    mening: 'Vi har skapat ett konto åt dig. Tryck på knappen och välj ditt lösenord, så är du inne.',
    knapp: 'Välj lösenord',
    varfor: 'Du får det här mejlet för att Nextrum har skapat ett konto åt dig med den här adressen. '
      + 'Väntade du dig inte mejlet kan du strunta i det.',
  },
  losenord: {
    amne: 'Välj ditt lösenord hos Nextrum',
    rubrik: 'Välj ditt lösenord',
    mening: 'Tryck på knappen och välj ditt lösenord. Har du redan ett fungerar det tills du valt ett nytt.',
    knapp: 'Välj lösenord',
    varfor: 'Du får det här mejlet för att Nextrum skickade dig en länk för att välja lösenord. '
      + 'Har du inte bett om det kan du strunta i mejlet.',
  },
  avslutning: 'Har du fått flera mejl från oss fungerar bara länken i det senaste. Nästa gång loggar du in '
    + 'under Logga in på nextrum.se, med den här adressen och ditt lösenord.',
};

export type KontomejlIn = {
  typ: Kontomejl;
  roll: Roll;
  /** Namnet på kontot. Bara förnamnet följer med. */
  namn: unknown;
  /** Auths länk (verify), som /lank lägger bakom en knapp. */
  verify: string;
  nu: Date;
};

export function renderaKontomejl(k: KontomejlIn): Renderat {
  const t = KONTO_TEXT[k.typ];
  const nar = skickadText(k.nu);
  const forst = fornamn(k.namn);
  return renderaRam({
    roll: k.roll,
    halsning: forst ? `Hej ${forst},` : 'Hej,',
    innehall: {
      amne: `${t.amne}, ${nar}`,
      rubrik: t.rubrik,
      mening: t.mening,
      knapp: t.knapp,
      mal: 'sajten',
      fakta: [['Skickat', nar], ['Länken gäller', 'en gång, i en timme']],
    },
    knappAdress: lankAdress(k.verify),
    varfor: t.varfor,
    // Transaktionsmejl: ingen avanmälan, ingen inställningssida.
    avregistrera: null,
    val: null,
    provrad: null,
    avslutning: KONTO_TEXT.avslutning,
  });
}
