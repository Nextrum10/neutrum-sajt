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
// FÄRGERNA är jordpaletten ur :root i nextrum-cinema.css: papperet
// till botten, bark till text, lera till knappen. Ändras paletten där
// ska den ändras här; mejlet är en del av samma yta. Sajtens papper
// ljusnade 2026-09-25 (#EFE6D6 → #F2EDE3) och mejlen låg kvar på det
// gamla samma dag — det är så lätt den här meningen glöms. Mörkt läge
// stängs av: Gmail och Outlook färgar annars om bakgrunderna på egen
// hand och lämnar texten kvar, och bark på bark är ett tomt mejl.
//
// INGEN RAM RUNT BREVET (2026-09-25). Förut låg brevet som ett kort
// med kant och rundade hörn på en mörkare yta, och mejlprogrammet
// ritar redan sin egen yta runt allt — vit i Gmail. Det blev tre lager
// kanter runt en enda text. Leo: "ta bort de vita kanterna runt
// mailen". Nu är hela brevet sajtens papper, ända ut till kanten, som
// sidorna, och det enda som bryter ytan är faktarutan och knappen. Det
// vita som ändå syns runt ett mejl i Gmail på datorn är Gmails eget,
// och det når inget mejl.
//
// PAPPERET STÅR PÅ FLERA STÄLLEN i skal(), med flit: på body för Apple
// Mail, som målar hela fönstret med den, och på yttertabellen, både som
// bgcolor och som style, för Gmail, som kastar body-stilen. Tas det
// bort från något av dem blir det vitt i något program, och det syns
// inte i den webbläsare man provar i.
//
// UNDERLAGET OCH AVISERINGEN använder samma skal (skal() nedan):
// faktura-utskick och lead-notis anropar det direkt i stället för att
// ha egna färger. Deras egna kopior hade hunnit glida isär med en kant
// i en ton som inte finns i paletten längre, och aviseringen var vit.
//
// TYPSNITTET är systemets. Webbtypsnitt laddas inte i de flesta
// mejlprogram, och en länk till Google Fonts i ett mejl är en
// spårningspixel vi inte vill skicka med.
//
// LOGGAN är den riktiga, som PNG (Fas 16.1). Förut ritades märket som
// en tabellcell med ett N i systemtypsnittet, med motiveringen att en
// bild som inte laddar är sämre än ingen bild. Men det var inte vår
// logga: vårt N har en diagonal som skjuter ut under grundlinjen, och
// ett Helvetica-N i en mörk ruta är ett annat märke som råkar likna.
// Gmail och Apple Mail, där de flesta familjer läser, visar bilder
// direkt.
//
// Där bilder är avstängda (Outlook på Windows, tills mottagaren
// tillåter dem) står ordet Nextrum kvar bredvid, som text. Bilden har
// därför alt="" och fasta mått: ett alt="Nextrum" hade blivit
// "Nextrum Nextrum" för den som läser med skärmläsare, och utan mått
// hoppar brevet när bilden väl laddar. SVG används inte — Gmail och
// Outlook visar den inte alls.
//
// PNG:en ligger på nextrum.se sedan loggan kopplades in för Google
// (bilder/nextrum-logo-512.png, undantagen i .gitignore). Byts loggan
// ska den filen bytas, inte adressen här. Loggan BREDVID avsändaren i
// inkorgen är en annan sak och styrs inte härifrån — se DEPLOY-EPOST.md.
// ============================================================

import { esc } from '../http.ts';
import { arMejlbar, antalOk, fornamn, renData, tillRoll, type Roll } from './typer.ts';
import { KATEGORI, MALLAR, type Innehall, type Mal } from './mallar.ts';

export const SAJT = 'https://nextrum.se';
export const KONTAKT = 'info@nextrum.se';
export const LOGGA_URL = `${SAJT}/bilder/nextrum-logo-512.png`;

export const FARG = {
  papper: '#F2EDE3',     // --pap, hela brevet ända ut till kanten
  yta: '#E9E2D4',        // --pap-2, lugn yta: faktarutan och provraden
  text: '#2E2A20',       // --bl, bark (12,3:1 mot papperet)
  brod: '#4F4738',       // --bl-2, brödtext (7,9:1)
  dampad: '#665C49',     // --bl-3, klarar AA även mot --pap-2 (5,1:1)
  linje: '#CDC2AC',      // --ln-2
  knapp: '#9C4520',      // --acc, lera (5,5:1 mot papperet)
  knapptext: '#EFE6D6',  // --acc-ink, som sajtens knappar (5,2:1 mot leran)
} as const;

export const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

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
  // Den publika sidan har ingen roll och ingen flik.
  if (mal === 'sajten') return SAJT;
  const vy = roll === 'tutor' ? '/larare' : '/foralder';
  // #boka finns bara i föräldravyn. Mallen ger den bara till familjen,
  // men skulle den ändå hamna hos en studiehjälpare blir det passlistan
  // i stället för en sektion som inte finns.
  // Betalning likaså: studiehjälparen betalar ingenting, och får
  // passlistan om en sådan knapp någonsin hamnar hos hen.
  const hash = mal === 'pass' || ((mal === 'boka' || mal === 'betalning') && roll === 'tutor') ? '#lektioner/pass'
    : mal === 'boka' ? '#boka'
    : mal === 'betalning' ? '#betalning'
    : mal === 'meddelanden' ? '#meddelanden' : '#profil/notiser';
  return `${SAJT}${vy}${hash}`;
}

/** Sidan på nextrum.se som frågar först och sedan POSTar tokenen till notis-avanmal. */
export function avregistreringsAdress(token: string | null): string {
  return token ? `${SAJT}/avanmal?t=${encodeURIComponent(token)}` : `${SAJT}/avanmal`;
}

/**
 * Ramen runt ett mejl.
 *
 * avregistrera och val är null i ett TRANSAKTIONSMEJL — ett kvitto på
 * något mottagaren själv just gjort, som inte går att välja bort och
 * därför inte ska erbjuda det. En avanmälningslänk i ett sådant mejl
 * lovar något vi inte tänker hålla.
 */
export type Ram = {
  roll: Roll;
  halsning: string;
  innehall: Innehall;
  knappAdress: string;
  varfor: string;
  avregistrera: string | null;
  val: string | null;
  provrad: string | null;
  /** En sista rad efter knappen, före foten. Notismejlen har ingen. */
  avslutning?: string | null;
  /**
   * Var mottagaren står i en process, steg för steg. Bara mejlen till
   * den som sökt jobb har den (Fas 16.1): den som söker ska kunna se i
   * varje mejl hur långt hen kommit, inte bara vad som hänt senast.
   */
  resa?: Resa | null;
};

export type Resesteg = { text: string; lage: 'klar' | 'nu' | 'kommer' };
export type Resa = { rubrik: string; steg: Resesteg[] };

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
  // Ett mejl utan något att klicka på (ett möte utan länk) har ingen knapp.
  if (i.knapp) t.push(`${i.knapp}:`, r.knappAdress, '');
  if (r.resa) {
    t.push(r.resa.rubrik);
    for (const s of r.resa.steg) {
      t.push(s.lage === 'klar' ? `[x] ${s.text}` : s.lage === 'nu' ? `[>] ${s.text}  <- du är här` : `[ ] ${s.text}`);
    }
    t.push('');
  }
  if (r.avslutning) t.push(r.avslutning, '');
  // "-- " är signaturavgränsaren som mejlprogram känner igen.
  t.push('-- ', 'Nextrum', r.varfor);
  if (r.avregistrera) t.push(`Sluta få mejl om det här: ${r.avregistrera}`);
  if (r.val) t.push(`Ändra dina val: ${r.val}`);
  t.push(`Frågor? Svara på mejlet eller skriv till ${KONTAKT}.`);
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
    + `style="background:${FARG.yta};border-radius:12px;margin:0 0 26px">`
    + `<tr><td bgcolor="${FARG.yta}" style="padding:16px 20px;background:${FARG.yta};border-radius:12px">`
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
    + `color:${FARG.knapptext};text-decoration:none;border-radius:10px">${esc(text)}</a>`
    + `</td></tr></table>`;
}

/* Stegen som en lista med en markör till vänster: bock för det som är
   gjort, en fylld prick för där mottagaren står, en tom för det som
   kommer. Det som är gjort dämpas och det som gäller nu är fett —
   tyngden ska ligga på var man är, inte på det man redan klarat. */
function resaHtml(resa: Resa): string {
  const rader = resa.steg.map((s) => {
    const markor = s.lage === 'klar' ? '&#10003;' : s.lage === 'nu' ? '&#9679;' : '&#9675;';
    const farg = s.lage === 'nu' ? FARG.text : FARG.dampad;
    const vikt = s.lage === 'nu' ? 700 : 400;
    return `<tr><td width="22" style="width:22px;padding:4px 10px 4px 0;font:700 14px/1.5 ${SANS};`
      + `color:${s.lage === 'kommer' ? FARG.linje : FARG.knapp};vertical-align:top">${markor}</td>`
      + `<td style="padding:4px 0;font:${vikt} 14px/1.5 ${SANS};color:${farg}">${esc(s.text)}`
      + (s.lage === 'nu' ? ` <span style="font-weight:400;color:${FARG.dampad}">&middot; du är här</span>` : '')
      + `</td></tr>`;
  }).join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" `
    + `style="border:1px solid ${FARG.linje};border-radius:12px;margin:22px 0 0">`
    + `<tr><td style="padding:14px 20px 12px">`
    + `<p style="margin:0 0 6px;font:600 12px/1.5 ${SANS};letter-spacing:.04em;text-transform:uppercase;`
    + `color:${FARG.dampad}">${esc(resa.rubrik)}</p>`
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0">${rader}</table>`
    + `</td></tr></table>`;
}

function logga(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>`
    + `<td width="32" height="32" valign="middle" style="width:32px;height:32px">`
    + `<a href="${SAJT}" style="text-decoration:none">`
    + `<img src="${LOGGA_URL}" width="32" height="32" alt="" `
    + `style="display:block;width:32px;height:32px;border:0;outline:none"></a></td>`
    + `<td style="padding-left:11px;font:700 19px/32px ${SANS};letter-spacing:-.01em;color:${FARG.text}">`
    + `<a href="${SAJT}" style="color:${FARG.text};text-decoration:none">Nextrum</a></td>`
    + `</tr></table>`;
}

export type Skal = {
  amne: string;
  /** Det som syns efter ämnesraden i inkorgen. Text, inte HTML. */
  forhandstext: string;
  /** Färdig HTML. Allt i den ska redan ha gått genom esc(). */
  innehall: string;
  provrad?: string | null;
};

/**
 * Skalet runt varje mejl vi skickar: dokumentet, papperet och loggan.
 *
 * Notismejlen, kvittot och ansökningsbeskeden går genom html() nedan.
 * Underlaget (faktura-utskick) och aviseringen om en ny anmälan
 * (lead-notis) har eget innehåll och anropar skalet direkt, så att
 * papperet, loggan och kanterna — att det inte finns några — är
 * desamma i allt vi skickar.
 */
export function skal(s: Skal): string {
  /* Provraden står överst på en lugn yta, så att den som läser ett prov
     ser det innan något annat. Den hör till kön och syns aldrig i ett
     riktigt utskick. */
  const provrad = s.provrad
    ? `<tr><td style="padding:0 0 24px">`
      + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>`
      + `<td bgcolor="${FARG.yta}" style="padding:10px 14px;background:${FARG.yta};border-radius:10px;`
      + `font:600 13px/1.5 ${SANS};color:${FARG.text}">${esc(s.provrad)}</td>`
      + `</tr></table></td></tr>`
    : '';

  return `<!doctype html><html lang="sv"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<meta name="color-scheme" content="light only">`
    + `<meta name="supported-color-schemes" content="light only">`
    + `<title>${esc(s.amne)}</title></head>`
    + `<body bgcolor="${FARG.papper}" style="margin:0;padding:0;background:${FARG.papper};-webkit-text-size-adjust:100%">`
    /* Förhandstexten: det som syns efter ämnesraden i inkorgen. Utan
       den plockar mejlprogrammet första bästa text, som är loggan. */
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(s.forhandstext)}</div>`
    /* Yttertabellen ÄR brevet: papperet över hela bredden och ingen
       marginal runt. Luften mot kanten är innerpadding på samma
       papper, så att ingenting annat än papperet syns utanför texten. */
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${FARG.papper}" `
    + `style="background:${FARG.papper}"><tr><td align="center" style="padding:36px 24px 44px">`
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" `
    + `style="width:100%;max-width:520px">`
    + provrad
    + `<tr><td style="padding:0 0 28px">${logga()}</td></tr>`
    + `<tr><td>${s.innehall}</td></tr>`
    + `</table></td></tr></table></body></html>`;
}

/** Rubriken, en gång. Underlaget och aviseringen har samma som notismejlen. */
export function rubrikHtml(text: string): string {
  return `<h1 style="margin:0 0 12px;font:700 24px/1.25 ${SANS};letter-spacing:-.015em;color:${FARG.text}">`
    + `${esc(text)}</h1>`;
}

function html(r: Ram): string {
  const i = r.innehall;
  const p = (s: string, stil: string) => `<p style="margin:0 0 16px;${stil}">${esc(s)}</p>`;
  const lank = (text: string, adress: string) =>
    `<a href="${esc(adress)}" style="color:${FARG.text};text-decoration:underline">${esc(text)}</a>`;

  const innehall = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">`
    + `<tr><td style="padding:0 0 28px">`
    + p(r.halsning, `font:400 16px/1.6 ${SANS};color:${FARG.brod}`)
    + rubrikHtml(i.rubrik)
    + p(i.mening, `font:400 16px/1.6 ${SANS};color:${FARG.brod};margin-bottom:22px`)
    + faktaHtml(i.fakta)
    + (i.knapp ? knappHtml(i.knapp, r.knappAdress) : '')
    + (r.resa ? resaHtml(r.resa) : '')
    + (r.avslutning
      ? `<p style="margin:18px 0 0;font:400 15px/1.6 ${SANS};color:${FARG.brod}">${esc(r.avslutning)}</p>`
      : '')
    + `</td></tr>`
    + `<tr><td><div style="height:1px;line-height:1px;font-size:1px;background:${FARG.linje}">&nbsp;</div></td></tr>`
    + `<tr><td style="padding:20px 0 0;font:400 13px/1.6 ${SANS};color:${FARG.dampad}">`
    + `<p style="margin:0 0 8px">${esc(r.varfor)}</p>`
    /* Var länk för sig, precis som i textversionen. Ett gemensamt
       villkor hade tyst tappat BÅDA om bara den ena vore null, och de
       två versionerna av samma mejl hade då sagt olika saker. */
    + (r.avregistrera || r.val
      ? `<p style="margin:0 0 8px">`
        + (r.avregistrera ? lank('Sluta få mejl om det här', r.avregistrera) : '')
        + (r.avregistrera && r.val ? `&nbsp;&nbsp;&middot;&nbsp;&nbsp;` : '')
        + (r.val ? lank('Ändra dina val', r.val) : '')
        + `</p>`
      : '')
    + `<p style="margin:0">Frågor? Svara på mejlet eller skriv till `
    + `<a href="mailto:${KONTAKT}" style="color:${FARG.text}">${KONTAKT}</a>.</p>`
    + `</td></tr></table>`;

  return skal({ amne: i.amne, forhandstext: i.mening, innehall, provrad: r.provrad });
}

/** Ämne, text och HTML för en rad ur kön. Kastar för en typ som inte mejlas. */
export function renderaMejl(rad: MejlIn): Renderat {
  return renderaRam(ramen(rad));
}

/**
 * Samma ram, för ett mejl som inte kommer ur kön.
 *
 * Finns för transaktionsmejlen — kvittot på en intresseanmälan och
 * mejlen till den som sökt jobb (ansokan.ts). De går till någon som
 * ännu inte har ett konto och därför varken har en rad i notis_val
 * eller en token att signera. De ska ändå se likadana ut som allt
 * annat vi skickar: samma logga, samma palett, samma knapp, samma
 * textversion.
 */
export function renderaRam(r: Ram): Renderat {
  return { amne: r.innehall.amne, text: text(r), html: html(r) };
}
