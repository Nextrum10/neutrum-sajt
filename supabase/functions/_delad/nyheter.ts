// ============================================================
// NEXTRUM — delad hjälp: en nyhet som mejl (2026-10-30)
//
// nyheter-utskick mejlar en publicerad nyhet till nyhetsbrevet. Här står
// hur texten blir HTML och hur ett mejl till en adress ser ut, så att det
// går att pröva utan Resend (nyheter_test.ts).
//
// TEXTEN är vanlig text ur adminvyn: en tom rad är ett nytt stycke, en
// radbrytning en ny rad, och en adress som börjar med https:// blir en
// länk. Ingen HTML från adminvyn går igenom: allt escapas först. Samma
// regel står i nextrum-nyheter.js för sidan, och de ändras tillsammans.
// ============================================================

import { esc } from './http.ts';
import { FARG, SAJT, SANS, rubrikHtml, skal } from './notiser/rendera.ts';

export type Nyhet = { slug: string; rubrik: string; ingress: string | null; text: string };
export type Mottagare = { epost: string; token: string };

export const FRAN = 'Nextrum <info@nextrum.se>';

const LANK = /https:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;

/** Stycken ur vanlig text, escapade, med https-adresser som länkar. */
export function styckenHtml(text: string, stil = ''): string {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const inne = esc(s).replace(LANK, (u) => {
        /* esc() har redan gjort & till &amp;; adressen i href ska vara densamma. */
        return `<a href="${u}" style="color:${FARG.knapp};text-decoration:underline">${u}</a>`;
      }).replace(/\n/g, '<br>');
      return `<p style="${stil}">${inne}</p>`;
    })
    .join('');
}

export function nyhetAdress(slug: string): string {
  return `${SAJT}/nyheter?n=${encodeURIComponent(slug)}`;
}

export function avslutaAdress(token: string): string {
  return `${SAJT}/nyhetsbrev?a=${encodeURIComponent(token)}`;
}

/** Ett mejl till en adress, i Resends form. */
export function nyhetsmejl(n: Nyhet, m: Mottagare, funktionsAdress: string) {
  const las = nyhetAdress(n.slug);
  const av = avslutaAdress(m.token);
  const stycke = `margin:0 0 14px;font:400 16px/1.6 ${SANS};color:${FARG.brod}`;
  const ingress = n.ingress
    ? `<p style="margin:0 0 18px;font:600 17px/1.55 ${SANS};color:${FARG.text}">${esc(n.ingress)}</p>`
    : '';
  const html = skal({
    amne: n.rubrik,
    forhandstext: n.ingress || n.text.slice(0, 140),
    innehall: rubrikHtml(n.rubrik)
      + ingress
      + styckenHtml(n.text, stycke)
      + `<p style="margin:24px 0"><a href="${esc(las)}" style="display:inline-block;background:${FARG.knapp};`
      + `color:${FARG.knapptext};padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600">`
      + `Läs på nextrum.se</a></p>`,
    fot: `<p style="margin:0 0 8px">Du får det här för att du anmält dig till Nextrums nyhetsbrev.</p>`
      + `<p style="margin:0"><a href="${esc(av)}" style="color:${FARG.fotLank};text-decoration:underline">`
      + `Avsluta nyhetsbrevet</a></p>`,
  });
  const text = [n.rubrik, n.ingress ?? '', n.text, `Läs på nextrum.se: ${las}`, `Avsluta nyhetsbrevet: ${av}`]
    .filter(Boolean).join('\n\n');
  return {
    from: FRAN,
    to: [m.epost],
    subject: n.rubrik,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${funktionsAdress}?a=${encodeURIComponent(m.token)}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}
