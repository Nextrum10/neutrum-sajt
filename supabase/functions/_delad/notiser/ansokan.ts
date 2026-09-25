// ============================================================
// NEXTRUM — mejlen till den som sökt jobb (Fas 16.1)
//
// Ett kvitto när ansökan kommit in, och ett mejl per steg framåt:
// mötet bokat, mötet hållet, introduktionen klar, godkänd. Varje mejl
// visar alla fyra stegen och vilket mottagaren står på — den som söker
// ska kunna se var hen är utan att behöva fråga.
//
// Samma sort som kvittot på en intresseanmälan (kvitto.ts), och av
// samma skäl gör de samma saker annorlunda än notismejlen:
//
//   · de går inte att välja bort. Det är besked om något mottagaren
//     själv satt igång, inte nyhetsbrev. Foten säger varför de kom.
//   · de skickas från info@, inte no-reply@. Varje mejl ber om svar
//     om något inte stämmer — ett möte som inte passar, en fråga.
//   · de återger ingenting ur ansökan. Inte skolan, inte ämnena, inte
//     texten om varför. Förnamnet och mötets tid och länk är allt,
//     och de två sista är själva beskedet.
//
//
// AVBÖJD HAR INGEN MALL, MED FLIT
//
// Ett nej ska skrivas av en människa. Det är ofta en sextonåring som
// söker sitt första jobb, och ett felklick som genast mejlar ett nej
// går inte att ta tillbaka. Databasen köar inget sådant heller.
//
//
// KONTAKT-STEGET HAR INGEN MALL HELLER
//
// När admin kallar till intervju skriver hen ett eget mejl med
// förslag på tider (adminvyn öppnar det i hens mejlprogram). Ett
// automatiskt mejl i samma stund hade varit samma besked två gånger.
// ============================================================

import { fornamn } from './typer.ts';
import { datumText } from './tid.ts';
import { SVAR_INOM_TIMMAR } from './kvitto.ts';
import { KONTAKT, SAJT, renderaRam, type Ram, type Renderat, type Resa } from './rendera.ts';

/** Avsändaren. Varje mejl ber om svar, så de kommer från en läst adress. */
export const ANSOKAN_FRAN = `Nextrum <${KONTAKT}>`;

export const ANSOKAN_STEG = ['mottagen', 'mote', 'utbildning', 'sista_steget', 'valkommen'] as const;
export type AnsokanSteg = typeof ANSOKAN_STEG[number];

export function arAnsokanSteg(v: unknown): v is AnsokanSteg {
  return typeof v === 'string' && (ANSOKAN_STEG as readonly string[]).includes(v);
}

/**
 * Processen som den som söker ser den. Samma ordning som
 * rekryteringsrutan i adminvyn (Fas 13.1), men med den sökandes ord:
 * "Kontakt" och "In i poolen" är våra steg, inte hens.
 */
export const RESAN = ['Ansökan', 'Digitalt möte', 'Introduktion', 'Konto och godkännande'];

const PLATS: Record<AnsokanSteg, number> = {
  mottagen: 0, mote: 1, utbildning: 2, sista_steget: 3, valkommen: RESAN.length,
};

export function resa(steg: AnsokanSteg): Resa {
  const nu = PLATS[steg];
  return {
    rubrik: nu >= RESAN.length ? 'Alla steg klara' : `Steg ${nu + 1} av ${RESAN.length}`,
    steg: RESAN.map((text, i) => ({ text, lage: i < nu ? 'klar' : i === nu ? 'nu' : 'kommer' })),
  };
}

const STOCKHOLM = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/**
 * '2026-10-02T15:00:00Z' → 'torsdag 2 oktober kl. 17:00', i svensk tid.
 *
 * mote_tid är en timestamptz. Adminvyn skriver den ur webbläsarens
 * lokala tid, och mejlet ska säga samma klockslag som admin skrev —
 * inte UTC, som hade flyttat ett möte klockan 17 till 15.
 */
export function motesText(iso: unknown): string | null {
  if (typeof iso !== 'string' || !iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const delar = STOCKHOLM.formatToParts(d);
  const del = (t: string) => delar.find((p) => p.type === t)?.value ?? '';
  return `${datumText(`${del('year')}-${del('month')}-${del('day')}`)} kl. ${del('hour')}:${del('minute')}`;
}

/**
 * Möteslänken, eller null om den inte går att lita på.
 *
 * Den skrivs av admin, och sedan Fas 16.1 kan ingen annan sätta den.
 * Ändå prövas den här: en knapp i ett mejl från vår domän är det
 * mottagaren litar mest på, och "javascript:", "http:" eller en adress
 * med inloggning i (https://nextrum.se@annan.example) ska aldrig bli
 * en sådan knapp oavsett hur den hamnade i raden.
 */
export function sakerLank(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.length > 500) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password || !u.hostname.includes('.')) return null;
  return u.href;
}

export type AnsokanIn = {
  steg: AnsokanSteg;
  /** Fritexten ur ansökan. Kapas till ett förnamn här. */
  namn: unknown;
  moteTid?: unknown;
  moteLank?: unknown;
  /** Det har redan gått ett mötesmejl för den här ansökan: det här är en ny tid. */
  ombokat?: boolean;
};

type Text = {
  amne: string;
  rubrik: string;
  mening: string;
  fakta?: [string, string][];
  knapp?: string;
  knappAdress?: string;
  avslutning: string;
};

const VARFOR = 'Du får det här mejlet för att du har sökt jobb som studiehjälpare hos Nextrum '
  + 'med den här e-postadressen.';

function texten(a: AnsokanIn): Text {
  switch (a.steg) {
    case 'mottagen':
      return {
        amne: 'Tack för din ansökan till Nextrum',
        rubrik: 'Tack för att du vill jobba hos oss',
        mening: 'Vi läser varje ansökan själva och hör av oss så fort vi kan, '
          + `senast inom ${SVAR_INOM_TIMMAR} timmar. Du behöver inte göra något mer så länge.`,
        knapp: 'Om att jobba hos Nextrum',
        knappAdress: `${SAJT}/bli-studiehjalpare`,
        avslutning: 'Undrar du något, eller vill du ändra något i ansökan? '
          + 'Svara på det här mejlet så läser vi det.',
      };

    case 'mote': {
      const nar = motesText(a.moteTid);
      const lank = sakerLank(a.moteLank);
      return {
        amne: a.ombokat ? 'Ny tid för ditt möte med Nextrum' : 'Ditt möte med Nextrum är bokat',
        rubrik: a.ombokat ? 'Vi har en ny tid för vårt möte' : 'Nu är vårt möte bokat',
        mening: 'Det är ett samtal på ungefär en kvart, inget prov. Vi vill höra hur du '
          + 'förklarar saker och vilka ämnen du känner dig trygg i.',
        fakta: [
          ...(nar ? [['När', nar] as [string, string]] : []),
          ['Var', lank ? 'Videomöte, länken nedan' : 'Videomöte. Länken kommer innan mötet.'],
        ],
        knapp: lank ? 'Öppna möteslänken' : undefined,
        knappAdress: lank ?? undefined,
        avslutning: 'Passar inte tiden? Svara på det här mejlet så hittar vi en annan.',
      };
    }

    case 'utbildning':
      return {
        amne: 'Tack för mötet! Nästa steg är introduktionen',
        rubrik: 'Tack för mötet',
        mening: 'Nästa steg är vår introduktion inför ditt första pass: hur ett pass läggs '
          + 'upp och hur rapporten efteråt fungerar. Vi hör av oss om hur du går igenom den.',
        avslutning: 'Har du frågor om mötet eller om nästa steg? Svara på det här mejlet.',
      };

    case 'sista_steget':
      return {
        amne: 'Sista steget innan du börjar hos Nextrum',
        rubrik: 'Introduktionen är klar',
        mening: 'Sista steget är ditt konto. Skapa det på nextrum.se med samma e-postadress '
          + 'som i ansökan, så godkänner vi din profil och du kan börja få uppdrag.',
        knapp: 'Skapa ditt konto',
        knappAdress: `${SAJT}/larare`,
        avslutning: 'Har du redan ett konto behöver du inte göra något mer. '
          + 'Vi hör av oss när profilen är godkänd.',
      };

    case 'valkommen':
      return {
        amne: 'Välkommen till Nextrum!',
        rubrik: 'Välkommen, nu är du en av oss',
        mening: 'Din profil är godkänd. Nu kan vi matcha dig med familjer som behöver hjälp '
          + 'i dina ämnen, och du ser dina uppdrag när du loggar in.',
        knapp: 'Till din sida',
        knappAdress: `${SAJT}/larare`,
        avslutning: 'Undrar du något inför ditt första pass? Svara på det här mejlet.',
      };
  }
}

/** Ämne, text och HTML för ett besked till den som sökt jobb. */
export function renderaAnsokan(a: AnsokanIn): Renderat {
  const t = texten(a);
  const forst = fornamn(a.namn);
  const ram: Ram = {
    roll: 'tutor',
    halsning: forst ? `Hej ${forst},` : 'Hej,',
    innehall: {
      amne: t.amne,
      rubrik: t.rubrik,
      mening: t.mening,
      knapp: t.knapp ?? '',
      mal: 'sajten',
      fakta: t.fakta ?? [],
    },
    knappAdress: t.knappAdress ?? SAJT,
    varfor: a.steg === 'mottagen'
      ? VARFOR + ' Var det inte du kan du bortse från mejlet.'
      : VARFOR,
    // Besked, inte nyhetsbrev: ingen avanmälan, ingen inställningssida.
    avregistrera: null,
    val: null,
    provrad: null,
    avslutning: t.avslutning,
    resa: resa(a.steg),
  };
  return renderaRam(ram);
}
