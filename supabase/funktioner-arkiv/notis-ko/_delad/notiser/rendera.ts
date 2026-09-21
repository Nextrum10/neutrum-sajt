// ============================================================
// NEXTRUM — notismejl: mall + layout -> ämne, text och HTML
//
// Texterna ligger i mallar/sv.json. Här finns bara layouten, som är
// densamma för alla mejl, och reglerna för vad som FÅR stå i dem:
// förnamn, typ av notis, en länk in. Inget annat går att få in,
// eftersom rendera() inte tar emot något annat.
// ============================================================

import mallarSv from './mallar/sv.json' with { type: 'json' };
import { esc } from '../http.ts';
import type { NotisKonfig } from './konfig.ts';

export type Roll = 'parent' | 'tutor' | 'lead';

export type Indata = {
  typ: string;
  roll: Roll;
  fornamn?: string | null;
  antal?: number;
  /** Bara för notiser till konton. Transaktionsmejl har ingen. */
  avanmalUrl?: string | null;
};

export type Renderat = { amne: string; text: string; html: string; transaktion: boolean };

type Stycke = string | { lista: string[] };
type Mall = {
  amne: string;
  etikett?: string;
  rubrik?: string;
  forhandstext?: string;
  typrad?: string;
  stycken?: Stycke[];
  knapp?: string;
  vy?: string | Record<string, string>;
  transaktion?: boolean;
};
type Mallar = Record<string, unknown> & { _gemensamt: Record<string, string> };

/**
 * Ett förnamn får bara vara bokstäver, bindestreck, apostrof och
 * mellanslag. Intresseformuläret är publikt: utan det här kunde vem
 * som helst skriva en länk eller en säljtext som "namn" och få oss
 * att skicka den från info@nextrum.se till en valfri adress.
 */
export function sakertFornamn(v: unknown): string | null {
  const s = String(v ?? '').trim().split(/\s+/)[0] ?? '';
  if (!s || s.length > 40) return null;
  return /^[\p{L}][\p{L}'’-]*$/u.test(s) ? s : null;
}

export function hittaMall(typ: string, roll: Roll, mallar: Mallar = mallarSv as Mallar): Mall {
  const m = (mallar[`${typ}.${roll}`] ?? mallar[typ]) as Mall | undefined;
  if (!m || typeof m !== 'object' || !m.amne) throw new Error(`Mall saknas: ${typ} (${roll})`);
  return m;
}

function fyll(s: string, v: Record<string, string>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
}

export function rendera(ind: Indata, k: NotisKonfig, mallar: Mallar = mallarSv as Mallar): Renderat {
  const g = mallar._gemensamt;
  const m = hittaMall(ind.typ, ind.roll, mallar);
  const transaktion = m.transaktion === true;

  const namn = sakertFornamn(ind.fornamn);
  const v: Record<string, string> = { fornamn: namn ?? '', antal: String(Math.max(1, ind.antal ?? 1)) };

  const halsning = namn ? fyll(g.halsning, v) : g.halsning_utan_namn;
  const rubrik = fyll(m.rubrik ?? g.notisrubrik, v);
  const stycken: Stycke[] = (m.stycken ?? (m.typrad ? [m.typrad] : []))
    .map((s) => typeof s === 'string' ? fyll(s, v) : { lista: s.lista.map((x) => fyll(x, v)) });

  const vy = typeof m.vy === 'string' ? m.vy : m.vy?.[ind.roll];
  const lank = vy ? k.basUrl + vy : null;
  // #profil/konto: fliken "Mitt konto", där nextrum-notiser.js lägger kryssrutan.
  const installningarUrl = transaktion ? null : `${k.basUrl}${ind.roll === 'tutor' ? '/larare' : '/foralder'}#profil/konto`;
  const varfor = transaktion ? g.varfor_transaktion : g.varfor_notis;
  const forhand = fyll(m.forhandstext ?? m.typrad ?? rubrik, v);

  // ---------- text ----------
  const t: string[] = [halsning, '', rubrik, ''];
  for (const s of stycken) {
    if (typeof s === 'string') t.push(s, '');
    else { for (const x of s.lista) t.push(`– ${x}`); t.push(''); }
  }
  if (lank && m.knapp) t.push(`${m.knapp}: ${lank}`, '');
  t.push(g.avslutning, '', g.signatur, '', '—', varfor);
  if (installningarUrl) t.push(`${g.installningar}: ${installningarUrl}`);
  if (ind.avanmalUrl && !transaktion) t.push(`${g.avanmal}: ${ind.avanmalUrl}`);
  t.push(g.avsandarrad);
  const text = t.join('\n') + '\n';

  // ---------- HTML ----------
  // Samma material som sajten: lin-bakgrund, bark-text, rostknapp,
  // märket + versal ordbild, mono-etikett med ett streck före.
  // Ingen ruta, inget färgat sidhuvud — ett brev, inte en mall.
  const C = { pap: '#EFE6D6', pap2: '#E5D8C2', bl: '#2E2A20', bl2: '#4F4738', bl3: '#665C49',
              ln: '#C9B492', acc: '#9C4520', accText: '#7A3417' };
  const sans = `'Schibsted Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif`;
  const mono = `'IBM Plex Mono',ui-monospace,Menlo,Consolas,monospace`;
  const p = (s: string, farg = C.bl2) =>
    `<p style="margin:0 0 18px;font:400 16px/1.6 ${sans};color:${farg}">${esc(s)}</p>`;
  const kropp = stycken.map((s) => typeof s === 'string' ? p(s) :
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px">` +
    s.lista.map((x, i) =>
      `<tr><td valign="top" style="padding:0 14px 10px 0;font:500 13px/1.9 ${mono};color:${C.accText}">0${i + 1}</td>` +
      `<td style="padding:0 0 10px;font:400 16px/1.6 ${sans};color:${C.bl2}">${esc(x)}</td></tr>`).join('') +
    `</table>`).join('');

  const knapp = lank && m.knapp ? `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 30px"><tr>
<td class="n-knapp" style="background:${C.acc};border-radius:999px">
<a href="${esc(lank)}" style="display:inline-block;padding:15px 28px;font:600 16px/1 ${sans};color:${C.pap};text-decoration:none;border-radius:999px">${esc(m.knapp)}&nbsp;&nbsp;&rarr;</a>
</td></tr></table>` : '';

  // Märket: en bildfil med sajtens riktiga N om NOTIS_LOGO_URL är satt,
  // annars ett bokstavs-N. Cellen har samma bakgrund som märket, så även
  // när mejlprogrammet blockerar bilder syns en mörk ruta med ett N (alt).
  const markInnehall = k.logoUrl
    ? `<img src="${esc(k.logoUrl)}" width="26" height="26" alt="N" style="display:block;width:26px;height:26px;border:0;border-radius:7px;font:700 15px/26px ${sans};color:${C.pap};text-align:center">`
    : 'N';
  const logga = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td class="n-mark" width="26" height="26" align="center" valign="middle" style="width:26px;height:26px;background:${C.bl};border-radius:7px;font:700 15px/26px ${sans};color:${C.pap}">${markInnehall}</td>
<td class="n-text" style="padding-left:10px;font:800 17px/26px ${sans};letter-spacing:-0.02em;text-transform:uppercase;color:${C.bl}">Nextrum</td>
</tr></table>`;

  const etikett = m.etikett
    ? `<p class="n-acc" style="margin:0 0 22px;font:500 12px/1 ${mono};letter-spacing:0.14em;text-transform:uppercase;color:${C.accText}"><span class="n-streck" style="display:inline-block;width:22px;height:1px;background:${C.accText};vertical-align:middle;margin-right:12px"></span>${esc(m.etikett)}</p>`
    : '';

  const fot = [
    esc(varfor),
    [installningarUrl ? `<a href="${esc(installningarUrl)}" style="color:${C.bl3};text-decoration:underline">${esc(g.installningar)}</a>` : '',
     ind.avanmalUrl && !transaktion ? `<a href="${esc(ind.avanmalUrl)}" style="color:${C.bl3};text-decoration:underline">${esc(g.avanmal)}</a>` : '']
      .filter(Boolean).join('&nbsp;&nbsp;&middot;&nbsp;&nbsp;'),
    esc(g.avsandarrad),
  ].filter(Boolean).join('<br><br>');

  const html = `<!doctype html>
<html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${esc(fyll(m.amne, v))}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=Schibsted+Grotesk:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
@media (prefers-color-scheme:dark){
  .n-bg{background:${C.bl}!important}
  .n-bg p,.n-bg td,.n-bg h1,.n-bg .n-text{color:${C.pap}!important}
  .n-bg .n-mark{box-shadow:0 0 0 1px #665C49}
  .n-bg .n-acc{color:#D98C63!important}
  .n-bg .n-streck{background:#D98C63!important}
  .n-bg a{color:#B3A88F!important}
  .n-bg .n-knapp a{color:${C.pap}!important}
  .n-bg .n-linje{border-color:#4F4738!important}
}
@media (max-width:480px){ .n-h1{font-size:30px!important} }
</style>
</head>
<body class="n-bg" style="margin:0;padding:0;background:${C.pap};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(forhand)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="n-bg" style="background:${C.pap}"><tr><td align="center" style="padding:36px 20px 40px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px">
<tr><td style="padding:0 0 48px">${logga}</td></tr>
<tr><td>
${etikett}
${p(halsning, C.bl)}
<h1 class="n-h1" style="margin:0 0 20px;font:800 34px/1.08 ${sans};letter-spacing:-0.035em;color:${C.bl}">${esc(rubrik)}</h1>
${kropp}${knapp}
${p(g.avslutning)}
<p style="margin:0;font:400 16px/1.6 ${sans};color:${C.bl2}">${g.signatur.split('\n').map(esc).join('<br>')}</p>
</td></tr>
<tr><td class="n-linje" style="padding:40px 0 0;border-bottom:1px solid ${C.ln}"></td></tr>
<tr><td style="padding:22px 0 0;font:400 12.5px/1.6 ${sans};color:${C.bl3}">${fot}</td></tr>
</table></td></tr></table>
</body></html>`;

  return { amne: fyll(m.amne, v), text, html, transaktion };
}
