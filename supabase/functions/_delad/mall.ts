// ============================================================
// NEXTRUM — delad hjälp: hur ett mejl från oss ser ut
//
// Fem funktioner skrev var sin <h2 style="font:600 18px system-ui">
// och var sin knapp. Två av dem hade kvar #9C4520 som knappfärg —
// en roströd ton sajten slutade använda när paletten blev svart på
// vitt. Mejlen såg alltså ut att komma från ett annat företag än
// det man nyss besökt, vilket är precis fel signal i det enda
// meddelande där mottagaren ska känna igen avsändaren direkt.
//
// Här ligger ramen en gång: samma typsnittstrappa, samma svarta
// knapp, samma fot med kontaktadress. Den som skriver ett nytt
// mejl skriver bara innehållet.
//
//
// VARFÖR TABELLER OCH INLINE-CSS
//
// Outlook på Windows renderar med Word, inte med en webbläsare.
// Flexbox, grid, klasser i <head> och moderna enheter försvinner
// tyst. Tabeller med width i px och style på varje element är fult
// att läsa men är det som faktiskt kommer fram — och ett mejl som
// ser trasigt ut i en förälders inkorg kostar mer förtroende än
// koden kostar i läsbarhet.
//
// Typsnittet är medvetet system-ui och INTE Schibsted Grotesk.
// Webbtypsnitt laddas inte i de flesta mejlklienter, så en
// @font-face-regel hade bara gett en tyst fallback till något
// godtyckligt. Bättre att välja fallbacken själv.
// ============================================================

import { esc } from './http.ts';

/* Samma tokens som :root i nextrum.css. Ändras paletten där ska de
   ändras här — mejlen är en del av samma yta. */
const FG = '#0A0A0A';
const BG = '#FFFFFF';
const YTA = '#F7F7F6';
const MUTED = '#5B5B5B';
const LINJE = '#E5E5E3';

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export const KONTAKT = 'info@nextrum.se';
export const SAJT = 'https://nextrum.se';

export type Knapp = { text: string; adress: string };

export type Brev = {
  /** Rubriken i brevet. Inte samma sak som ämnesraden. */
  rubrik: string;
  /** Brödtext, ett stycke per element. Escapas — skriv ren text. */
  stycken: string[];
  /** Den enda knappen. Fler knappar är ingen knapp. */
  knapp?: Knapp;
  /** Faktarutan under knappen: etikett och värde, redan trimmat. */
  fakta?: [string, string][];
  /** Sista raden före foten. Förklarar varför mejlet kom. */
  efterord?: string;
};

/* ============================================================
   TEXTVERSIONEN

   Skickas alltid med. Den som läser i en klient utan html, eller
   med bilder och stilar avstängda, får samma innehåll — och ett
   mejl utan text/plain-del väger tyngre i varje skräppostfilter
   som finns.
   ============================================================ */
export function text(b: Brev): string {
  const delar: string[] = [b.rubrik, ''];
  delar.push(b.stycken.join('\n\n'));

  if (b.fakta?.length) {
    delar.push('');
    delar.push(b.fakta.map(([etikett, varde]) => `${etikett}: ${varde}`).join('\n'));
  }
  if (b.knapp) {
    delar.push('');
    delar.push(`${b.knapp.text}:\n${b.knapp.adress}`);
  }
  if (b.efterord) {
    delar.push('');
    delar.push(b.efterord);
  }

  delar.push('');
  delar.push('—');
  delar.push(`Nextrum — av unga, för unga.`);
  delar.push(`Frågor? Svara på det här mejlet eller skriv till ${KONTAKT}.`);
  delar.push(SAJT);

  return delar.join('\n') + '\n';
}

/* ============================================================
   HTML-VERSIONEN
   ============================================================ */
function stycke(s: string): string {
  return `<p style="margin:0 0 16px;font:400 16px/1.65 ${SANS};color:${FG}">${esc(s)}</p>`;
}

function knappHtml(k: Knapp): string {
  /* Knappen är en tabell, inte en <a> med padding. Outlook ger inte
     en länk någon höjd, så knappen kollapsar till understruken text
     mitt i brevet. En cell med bgcolor håller formen överallt. */
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" `
    + `style="margin:8px 0 24px"><tr><td bgcolor="${FG}" style="border-radius:10px">`
    + `<a href="${esc(k.adress)}" style="display:inline-block;padding:13px 26px;`
    + `font:600 15px/1 ${SANS};color:${BG};text-decoration:none;border-radius:10px">`
    + `${esc(k.text)}</a></td></tr></table>`;
}

function faktaHtml(rader: [string, string][]): string {
  const celler = rader.map(([etikett, varde]) =>
    `<tr><td style="padding:5px 16px 5px 0;font:400 14px/1.5 ${SANS};color:${MUTED};`
    + `white-space:nowrap;vertical-align:top">${esc(etikett)}</td>`
    + `<td style="padding:5px 0;font:500 14px/1.5 ${SANS};color:${FG}">${esc(varde)}</td></tr>`
  ).join('');

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" `
    + `style="background:${YTA};border-radius:12px;margin:0 0 24px"><tr><td style="padding:18px 20px">`
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0">${celler}</table>`
    + `</td></tr></table>`;
}

export function html(b: Brev): string {
  const kropp = [
    `<h1 style="margin:0 0 18px;font:600 23px/1.3 ${SANS};color:${FG};`
      + `letter-spacing:-.01em">${esc(b.rubrik)}</h1>`,
    ...b.stycken.map(stycke),
    b.fakta?.length ? faktaHtml(b.fakta) : '',
    b.knapp ? knappHtml(b.knapp) : '',
    b.efterord
      ? `<p style="margin:0;font:400 14px/1.6 ${SANS};color:${MUTED}">${esc(b.efterord)}</p>`
      : '',
  ].join('');

  return `<!doctype html><html lang="sv"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1">`
    /* Mörkt läge stängs av med flit. Gmail och Outlook färgar annars
       om bakgrunder på egen hand och lämnar texten kvar — svart på
       svart är ett tomt mejl. */
    + `<meta name="color-scheme" content="light only">`
    + `<meta name="supported-color-schemes" content="light only">`
    + `<title>${esc(b.rubrik)}</title></head>`
    + `<body style="margin:0;padding:0;background:${YTA};-webkit-text-size-adjust:100%">`

    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" `
    + `style="background:${YTA}"><tr><td align="center" style="padding:32px 16px">`

    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" `
    + `style="width:100%;max-width:560px;background:${BG};border-radius:16px;`
    + `border:1px solid ${LINJE}">`

    /* Avsändaren överst. Ordmärket som text, inte som bild: bilder
       är avstängda som standard i flera klienter, och en logotyp
       som inte laddar är sämre än inget alls. */
    + `<tr><td style="padding:28px 32px 0">`
    + `<a href="${SAJT}" style="font:600 17px/1 ${SANS};color:${FG};`
    + `text-decoration:none;letter-spacing:-.01em">Nextrum</a></td></tr>`

    + `<tr><td style="padding:22px 32px 28px">${kropp}</td></tr>`

    + `<tr><td style="padding:0 32px"><div style="height:1px;background:${LINJE}"></div></td></tr>`
    + `<tr><td style="padding:20px 32px 28px">`
    + `<p style="margin:0 0 6px;font:400 13px/1.6 ${SANS};color:${MUTED}">`
    + `Nextrum — av unga, för unga.</p>`
    + `<p style="margin:0;font:400 13px/1.6 ${SANS};color:${MUTED}">`
    + `Frågor? Svara på det här mejlet eller skriv till `
    + `<a href="mailto:${KONTAKT}" style="color:${FG}">${KONTAKT}</a>.</p>`
    + `</td></tr></table>`

    + `</td></tr></table></body></html>`;
}

/** Bägge versionerna av samma brev. */
export function brev(b: Brev): { text: string; html: string } {
  return { text: text(b), html: html(b) };
}
