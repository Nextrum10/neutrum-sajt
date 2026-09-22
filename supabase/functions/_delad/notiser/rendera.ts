// ============================================================
// NEXTRUM — notismejlet: mall + ram → ämne, text och HTML
//
// Mallarna (mallar.ts) skriver innehållet. Här ligger ramen, en gång:
// hälsning, rubrik, en mening, faktaruta, en knapp och foten med
// varför mejlet kom, hur man slutar få det och vart man skriver.
//
// renderaMejl() tar emot en rad ur kön och ingenting annat. Namn och
// ämne går genom förnamnsregeln (typer.ts) och data genom renData(),
// som bara plockar ut datum, tid, ämne och förnamn. Allt som hamnar
// i HTML går dessutom genom esc().
//
//
// VARFÖR TABELLER OCH INLINE-CSS
//
// Outlook på Windows ritar mejl med Word, inte med en webbläsare.
// Flexbox, grid, klasser i <head> och moderna enheter försvinner
// tyst. Tabeller med style på varje element är fula att läsa men är
// det som faktiskt kommer fram.
//
// FÄRGERNA är jordpaletten ur :root i nextrum-cinema.css: lin till
// botten, bark till text, lera till knappen. Ändras paletten där ska
// den ändras här; mejlet är en del av samma yta. Mörkt läge stängs
// av: Gmail och Outlook färgar annars om bakgrunderna på egen hand
// och lämnar texten kvar, och bark på bark är ett tomt mejl.
//
// TYPSNITTET är systemets. Webbtypsnitt laddas inte i de flesta
// mejlprogram, och en länk till Google Fonts i ett mejl är en
// spårningspixel vi inte vill skicka med.
//
// LOGGAN är text, inte en bild. Sajtens märke finns bara som SVG,
// och SVG visas inte i Gmail eller Outlook. En bild som inte laddar
// är sämre än ingen bild: märket ritas därför som en tabellcell med
// ett N, och ordet Nextrum bredvid.
// ============================================================

import { esc } from '../http.ts';
import { arMejlbar, antalOk, fornamn, renData, tillRoll, type Roll } from './typer.ts';
import { KATEGORI, MALLAR, type Innehall, type Mal } from './mallar.ts';

export const SAJT = 'https://nextrum.se';
export const KONTAKT = 'info@nextrum.se';

const FARG = {
  botten: '#E5D8C2',  // --pap-2, lugn yta runt brevet
  papper: '#EFE6D6',  // --pap, lin
  text: '#2E2A20',    // --bl, bark
  brod: '#4F4738',    // --bl-2, brödtext på lin (7.4:1)
  dampad: '#665C49',  // --bl-3, klarar AA även mot --pap-2
  linje: '#C9B492',   // --ln-2
  knapp: '#9C4520',   // --acc, lera (5.16:1 mot lin, åt båda hållen)
};

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/** Prov: 'nej' för ett riktigt utskick, 'sandlada' när mejlet gick till sandlådan i stället
 *  för till mottagaren, 'provmejl' när admin bett om ett prov till sig själv. */
export type ProvLage = 'nej' | 'sandlada' | 'provmejl';

export type MejlIn = {
  typ: string;
  roll: string;
  /** Mottagarens förnamn. Går genom förnamnsregeln här också. */
  fornamn: string | null;
  antal: number;
  data: unknown;
  /** Token för typen, eller null i sandlådan (då pekar länken inte på någon). */
  token: string | null;
  prov: ProvLage;
  nu: Date;
};

export type Renderat = { amne: string; text: string; html: string };

export function vyAdress(roll: Roll, mal: Mal | 'val'): string {
  const vy = roll === 'tutor' ? '/larare' : '/foralder';
  const hash = mal === 'pass' ? '#lektioner/pass' : mal === 'meddelanden' ? '#meddelanden' : '#profil/notiser';
  return `${SAJT}${vy}${hash}`;
}

/** Sidan på nextrum.se som frågar först och sedan POSTar tokenen till notis-avanmal. */
export function avregistreringsAdress(token: string | null): string {
  return token ? `${SAJT}/avanmal?t=${encodeURIComponent(token)}` : `${SAJT}/avanmal`;
}

type Ram = {
  roll: Roll;
  halsning: string;
  innehall: Innehall;
  knappAdress: string;
  varfor: string;
  avregistrera: string;
  val: string;
  provrad: string | null;
};

function ramen(rad: MejlIn): Ram {
  const typ = rad.typ;
  if (!arMejlbar(typ)) throw new Error(`Ingen mejlmall för typen ${String(typ).slice(0, 40)}.`);
  const roll = tillRoll(rad.roll);
  const d = renData(rad.data);
  const innehall = MALLAR[typ]({ roll, d, antal: antalOk(rad.antal), nu: rad.nu });
  const namn = fornamn(rad.fornamn);
  const mottagare = roll === 'tutor' ? 'studiehjälpare' : 'familj';

  if (rad.prov !== 'nej') innehall.amne = `[Prov till ${mottagare}] ${innehall.amne}`;

  return {
    roll,
    halsning: namn ? `Hej ${namn},` : 'Hej,',
    innehall,
    knappAdress: vyAdress(roll, innehall.mal),
    varfor: `Du får det här för att du har ett konto på Nextrum där mejl om ${KATEGORI[typ]} är påslaget.`,
    avregistrera: avregistreringsAdress(rad.prov === 'sandlada' ? null : rad.token),
    val: vyAdress(roll, 'val'),
    provrad: rad.prov === 'nej' ? null
      : rad.prov === 'sandlada'
        ? `Det här är ett prov av mejlet till en ${mottagare}. Länken för att sluta få mejl är avstängd i provet.`
        : `Det här är ett prov av mejlet till en ${mottagare}.`,
  };
}

/* ============================================================
   TEXTVERSIONEN

   Skickas alltid med. Den som läser utan HTML, eller med bilder och
   stilar avstängda, får samma innehåll, och ett mejl utan text/plain
   väger tyngre i varje skräppostfilter som finns.
   ============================================================ */
function text(r: Ram): string {
  const i = r.innehall;
  const t: string[] = [];
  if (r.provrad) t.push(r.provrad, '');
  t.push(r.halsning, '', i.rubrik, '', i.mening, '');
  if (i.fakta.length) t.push(...i.fakta.map(([k, v]) => `${k}: ${v}`), '');
  t.push(`${i.knapp}:`, r.knappAdress, '');
  // "-- " är signaturavgränsaren som mejlprogram känner igen.
  t.push('-- ', 'Nextrum', r.varfor,
    `Sluta få mejl om det här: ${r.avregistrera}`,
    `Ändra dina val: ${r.val}`,
    `Frågor? Svara på mejlet eller skriv till ${KONTAKT}.`);
  return t.join('\n') + '\n';
}

/* ============================================================
   HTML-VERSIONEN
   ============================================================ */
function faktaHtml(rader: [string, string][]): string {
  if (!rader.length) return '';
  const celler = rader.map(([k, v]) =>
    `<tr><td style="padding:4px 18px 4px 0;font:400 14px/1.5 ${SANS};color:${FARG.dampad};`
    + `white-space:nowrap;vertical-align:top">${esc(k)}</td>`
    + `<td style="padding:4px 0;font:600 14px/1.5 ${SANS};color:${FARG.text}">${esc(v)}</td></tr>`).join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" `
    + `style="background:${FARG.botten};border-radius:12px;margin:0 0 26px">`
    + `<tr><td style="padding:16px 20px">`
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0">${celler}</table>`
    + `</td></tr></table>`;
}

function knappHtml(text: string, adress: string): string {
  /* Knappen är en tabellcell, inte en <a> med padding. Outlook ger
     inte en länk någon höjd, och då kollapsar knappen till en
     understruken rad mitt i brevet. */
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px">`
    + `<tr><td bgcolor="${FARG.knapp}" style="background:${FARG.knapp};border-radius:10px">`
    + `<a href="${esc(adress)}" style="display:inline-block;padding:14px 26px;font:600 15px/1 ${SANS};`
    + `color:${FARG.papper};text-decoration:none;border-radius:10px">${esc(text)}</a>`
    + `</td></tr></table>`;
}

function logga(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>`
    + `<td width="26" height="26" align="center" valign="middle" bgcolor="${FARG.text}" `
    + `style="width:26px;height:26px;background:${FARG.text};border-radius:7px;`
    + `font:700 15px/26px ${SANS};color:${FARG.papper};text-align:center">N</td>`
    + `<td style="padding-left:10px;font:700 17px/26px ${SANS};letter-spacing:-.01em;color:${FARG.text}">`
    + `<a href="${SAJT}" style="color:${FARG.text};text-decoration:none">Nextrum</a></td>`
    + `</tr></table>`;
}

function html(r: Ram): string {
  const i = r.innehall;
  const p = (s: string, stil: string) => `<p style="margin:0 0 16px;${stil}">${esc(s)}</p>`;
  const lank = (text: string, adress: string) =>
    `<a href="${esc(adress)}" style="color:${FARG.text};text-decoration:underline">${esc(text)}</a>`;

  const provrad = r.provrad
    ? `<tr><td style="padding:0 0 14px;font:600 13px/1.5 ${SANS};color:${FARG.text}">${esc(r.provrad)}</td></tr>`
    : '';

  return `<!doctype html><html lang="sv"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<meta name="color-scheme" content="light only">`
    + `<meta name="supported-color-schemes" content="light only">`
    + `<title>${esc(i.amne)}</title></head>`
    + `<body style="margin:0;padding:0;background:${FARG.botten};-webkit-text-size-adjust:100%">`
    /* Förhandstexten: det som syns efter ämnesraden i inkorgen. Utan
       den plockar mejlprogrammet första bästa text, som är loggan. */
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(i.mening)}</div>`
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${FARG.botten}" `
    + `style="background:${FARG.botten}"><tr><td align="center" style="padding:32px 16px">`
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" `
    + `style="width:100%;max-width:560px">`
    + provrad
    + `<tr><td bgcolor="${FARG.papper}" style="background:${FARG.papper};border:1px solid ${FARG.linje};border-radius:16px">`
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">`
    + `<tr><td style="padding:28px 32px 0">${logga()}</td></tr>`
    + `<tr><td style="padding:26px 32px 28px">`
    + p(r.halsning, `font:400 16px/1.6 ${SANS};color:${FARG.brod}`)
    + `<h1 style="margin:0 0 12px;font:700 24px/1.25 ${SANS};letter-spacing:-.015em;color:${FARG.text}">`
    + `${esc(i.rubrik)}</h1>`
    + p(i.mening, `font:400 16px/1.6 ${SANS};color:${FARG.brod};margin-bottom:22px`)
    + faktaHtml(i.fakta)
    + knappHtml(i.knapp, r.knappAdress)
    + `</td></tr>`
    + `<tr><td style="padding:0 32px"><div style="height:1px;line-height:1px;font-size:1px;background:${FARG.linje}">&nbsp;</div></td></tr>`
    + `<tr><td style="padding:20px 32px 28px;font:400 13px/1.6 ${SANS};color:${FARG.dampad}">`
    + `<p style="margin:0 0 8px">${esc(r.varfor)}</p>`
    + `<p style="margin:0 0 8px">${lank('Sluta få mejl om det här', r.avregistrera)}`
    + `&nbsp;&nbsp;&middot;&nbsp;&nbsp;${lank('Ändra dina val', r.val)}</p>`
    + `<p style="margin:0">Frågor? Svara på mejlet eller skriv till `
    + `<a href="mailto:${KONTAKT}" style="color:${FARG.text}">${KONTAKT}</a>.</p>`
    + `</td></tr></table>`
    + `</td></tr></table>`
    + `</td></tr></table></body></html>`;
}

/** Ämne, text och HTML för en rad ur kön. Kastar för en typ som inte mejlas. */
export function renderaMejl(rad: MejlIn): Renderat {
  const r = ramen(rad);
  return { amne: r.innehall.amne, text: text(r), html: html(r) };
}
