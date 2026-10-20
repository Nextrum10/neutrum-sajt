// ============================================================
// NEXTRUM — delad hjälp: mejlet vi skriver till den som sökt jobb
// (2026-10-20, ansokan-mejl)
//
// Leo: "går det inte bara att skicka mail från plattformen? jag ska
// kunna redigera mailet och sen bara tryck skicka". Rutan i adminvyn
// öppnade förut ett utkast i Gmail, från det konto som råkade vara
// inloggat i webbläsaren. Nu skickas samma utkast härifrån, från
// info@nextrum.se som alla andra mejl till den som söker, och svaret
// kommer dit.
//
// TRE SAKER BÄR DET
//
// 1. ADRESSEN KOMMER UR ANSÖKAN, ALDRIG UR ANROPET. Funktionen tar ett
//    ansöknings-id och läser adressen med adminens egen token. Annars
//    vore den en knapp som mejlar vem som helst från vår domän med
//    godkänd DKIM, och det enda som skilde den från ett utskick vore
//    vem som tryckt.
//
// 2. TEXTEN SPARAS INTE. Den går till Resend och till den som söker,
//    och en kopia till info@ (hemlig kopia), så att det skickade står i
//    inkorgen bredvid svaret. Ingen tabell, ingen logg med texten eller
//    adressen: bara Resends status när den säger nej.
//
// 3. ETT TRYCK ÄR ETT MEJL. Rutan skickar en nyckel som är densamma
//    för varje tryck i samma ruta (forsok), och Resend skickar samma
//    nyckel bara en gång. Ett dubbelklick eller ett nytt försök efter
//    ett avbrutet svar blir alltså inte två mejl, men samma text en
//    annan gång, i en ny ruta, går iväg igen.
// ============================================================

import { epostOk, esc } from './http.ts';
import { FARG, KONTAKT, SANS, skal } from './notiser/rendera.ts';

export const ANSOKAN_MEJL_FRAN = `Nextrum <${KONTAKT}>`;
export const AMNE_MAX = 150;
export const TEXT_MAX = 5000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FORSOK = /^[a-z0-9-]{8,64}$/i;

export type Brev = { ansokan: string; amne: string; text: string; forsok: string | null };

export function tolkaBrev(kropp: unknown): { ok: true; brev: Brev } | { ok: false; fel: string } {
  const k = (kropp && typeof kropp === 'object' ? kropp : {}) as Record<string, unknown>;
  const ansokan = String(k.ansokan ?? '');
  if (!UUID.test(ansokan)) return { ok: false, fel: 'Ansökan saknas.' };

  /* Ämnet är en rad: en radbrytning i ämnet är en header till. */
  const amne = String(k.amne ?? '').replace(/\s+/g, ' ').trim();
  if (!amne) return { ok: false, fel: 'Skriv ett ämne.' };
  if (amne.length > AMNE_MAX) return { ok: false, fel: `Ämnet får vara högst ${AMNE_MAX} tecken.` };

  const text = String(k.text ?? '').replace(/\r\n?/g, '\n').trim();
  if (!text) return { ok: false, fel: 'Skriv något i mejlet.' };
  if (text.length > TEXT_MAX) return { ok: false, fel: `Mejlet får vara högst ${TEXT_MAX} tecken.` };

  const f = String(k.forsok ?? '');
  return { ok: true, brev: { ansokan, amne, text, forsok: FORSOK.test(f) ? f : null } };
}

/* En https-adress i texten blir en länk, så att bokningssidan går att
   trycka på. Bara https, och skiljetecknet efter adressen hör till
   meningen. Körs på redan escapad text, så att inget annat än det
   escapade kan hamna i href. */
function lankar(escapad: string): string {
  return escapad.replace(/https:\/\/[^\s<]+/g, (traff) => {
    const slut = /[.,!?;:)]+$/.exec(traff);
    const adress = slut ? traff.slice(0, -slut[0].length) : traff;
    return `<a href="${adress}" style="color:${FARG.knapp};text-decoration:underline">${adress}</a>`
      + (slut ? slut[0] : '');
  });
}

export type Renderat = { amne: string; text: string; html: string };

/** Texten som den är, och samma text i mejlens skal: ett stycke per tom rad. */
export function renderaBrev(amne: string, text: string): Renderat {
  const stycken = text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean)
    .map((s) => `<p style="margin:0 0 16px;font:400 16px/1.65 ${SANS};color:${FARG.brod}">`
      + `${lankar(esc(s)).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const forsta = text.split('\n').find((r) => r.trim()) ?? '';
  return {
    amne,
    text,
    html: skal({ amne, forhandstext: forsta.slice(0, 120), innehall: stycken }),
  };
}

export type Utskick = Renderat & { till: string; idempotens: string | null };

export type Beroenden = {
  /** Ansökan, läst med adminens egen token. null: finns inte eller syns inte. */
  ansokan: (id: string) => Promise<{ epost: string | null } | null>;
  /** null när mejlet gått, annars varför det inte gick. */
  skicka: (m: Utskick) => Promise<string | null>;
};

export type Svar = { status: number; kropp: Record<string, unknown> };

export async function hanteraBrev(kropp: unknown, b: Beroenden): Promise<Svar> {
  const t = tolkaBrev(kropp);
  if (!t.ok) return { status: 400, kropp: { error: t.fel } };
  const { ansokan, amne, text, forsok } = t.brev;

  const a = await b.ansokan(ansokan);
  if (!a) return { status: 404, kropp: { error: 'Ansökan finns inte, eller så får du inte läsa den.' } };
  const till = String(a.epost ?? '').trim();
  if (!epostOk(till)) return { status: 400, kropp: { error: 'Ansökan har ingen e-postadress att skicka till.' } };

  const fel = await b.skicka({
    ...renderaBrev(amne, text),
    till,
    idempotens: forsok ? `ansokan-mejl:${ansokan}:${forsok}` : null,
  });
  if (fel) return { status: 502, kropp: { error: `Mejlet gick inte iväg (${fel}).` } };
  return { status: 200, kropp: { ok: true, till } };
}
