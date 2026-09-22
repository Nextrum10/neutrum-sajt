// ============================================================
// NEXTRUM — notis-avanmal: själva hanteringen, utan Supabase
//
// Två vägar in som avregistrerar, båda POST:
//
//  1. List-Unsubscribe-Post (RFC 8058). Gmail och Apple Mail POSTar
//     hit när någon trycker "Avsluta prenumeration" i mejlprogrammet.
//     Kroppen är List-Unsubscribe=One-Click och tokenen står i ?t=.
//  2. nextrum.se/avanmal, som frågar först och sedan POSTar { t }.
//
// GET AVREGISTRERAR INGEN. Länkskannrar i företagsmejl och antivirus
// följer varje länk i ett mejl; hade en GET avregistrerat hade folk
// blivit avregistrerade utan att ha rört något. Men samma adress står i
// List-Unsubscribe, och ett mejlprogram som inte gör One-Click (äldre
// Outlook och Thunderbird, eller Gmail när villkoren inte är uppfyllda)
// öppnar den i webbläsaren. Därför skickar GET och HEAD vidare med 303
// till nextrum.se/avanmal med samma token. Där står frågan och knappen,
// och det är knappen som POSTar. Vidareskickningen rör inte databasen.
//
// KROPPEN LÄSES MED TAK. Funktionen kräver ingen inloggning, så en
// kropp utan content-length (chunkad) läses bara till MAX_KROPP byte.
// Är den större räknas den som att koden saknas.
//
// SVAREN SÄGER INGET OM VARFÖR. En ogiltig token, ett konto som inte
// finns och en trasig databas ger korta svar utan interna detaljer.
// Den som provar sig fram ska inte få veta vilka id som finns.
//
// Hanteringen ligger här i stället för i index.ts för att testerna i
// _delad/ ska kunna köra den (CI testar bara _delad/).
// ============================================================

import { lasToken, type Avregistrering, type TokenTyp } from './token.ts';
import type { Kanal } from './typer.ts';

export const TILLATNA_URSPRUNG = ['https://nextrum.se', 'https://www.nextrum.se'];

/** Sidan som frågar först. GET och HEAD skickas hit. */
export const AVANMAL_SIDA = 'https://nextrum.se/avanmal';

/** Utfallet av notis_avregistrera: ok, ett konto som inte finns (22023), eller fel. */
export type AvregUtfall = 'ok' | 'ogiltig' | 'fel';

export type AvregBeroenden = {
  /** rpc notis_avregistreringsnyckel(). Kastar om den inte går att läsa. */
  nyckel: () => Promise<string>;
  /** rpc notis_avregistrera(p_profil, p_typ, p_kanal). */
  avregistrera: (uid: string, typ: TokenTyp, kanal: Kanal) => Promise<AvregUtfall>;
};

export const MAX_KROPP = 4096;
const MAX_TOKEN = 300;

export function cors(req: Request): Record<string, string> {
  const ursprung = req.headers.get('origin') ?? '';
  const h: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
  if (TILLATNA_URSPRUNG.includes(ursprung)) h['Access-Control-Allow-Origin'] = ursprung;
  return h;
}

function svar(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

/**
 * Kroppen som text, men aldrig mer än max byte. Är den större, eller
 * går den inte att läsa, blir svaret null och resten läses aldrig in:
 * läsaren avbryts vid första biten som går över.
 */
export async function lasKropp(req: Request, max = MAX_KROPP): Promise<string | null> {
  if (!req.body) return '';
  const lasare = req.body.getReader();
  const delar: Uint8Array[] = [];
  let langd = 0;
  try {
    for (;;) {
      const { done, value } = await lasare.read();
      if (done) break;
      langd += value.byteLength;
      if (langd > max) {
        await lasare.cancel().catch(() => {});
        return null;
      }
      delar.push(value);
    }
  } catch {
    return null;
  }
  const alla = new Uint8Array(langd);
  let plats = 0;
  for (const d of delar) { alla.set(d, plats); plats += d.byteLength; }
  return new TextDecoder().decode(alla);
}

/** Tokenen ur ?t=, en JSON-kropp { t } eller en formulärkropp med t. */
export async function lasTokenUrAnrop(req: Request): Promise<string | null> {
  const ur = new URL(req.url).searchParams.get('t');
  if (ur) return ur.slice(0, MAX_TOKEN);

  // content-length prövas först, så att en för stor kropp inte läses alls.
  const langd = Number(req.headers.get('content-length') ?? '0');
  if (langd > MAX_KROPP) return null;
  const text = await lasKropp(req);
  if (!text) return null;

  const typ = (req.headers.get('content-type') ?? '').toLowerCase();
  if (!typ.includes('application/x-www-form-urlencoded')) {
    try {
      const j = JSON.parse(text) as { t?: unknown } | null;
      if (typeof j?.t === 'string' && j.t) return j.t.slice(0, MAX_TOKEN);
    } catch { /* inte JSON, prova som formulär */ }
  }
  const t = new URLSearchParams(text).get('t');
  return t ? t.slice(0, MAX_TOKEN) : null;
}

/**
 * GET och HEAD: vidare till sidan som frågar först, med samma token.
 * Adressen är alltid nextrum.se/avanmal; tokenen kodas och kan inte
 * leda någon annanstans. no-referrer, så att adressen med tokenen inte
 * följer med som Referer.
 */
function vidareTillSidan(req: Request, headers: Record<string, string>): Response {
  const t = new URL(req.url).searchParams.get('t');
  const mal = t ? `${AVANMAL_SIDA}?t=${encodeURIComponent(t.slice(0, MAX_TOKEN))}` : AVANMAL_SIDA;
  return new Response(null, {
    status: 303,
    headers: { ...headers, Location: mal, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
  });
}

export async function hanteraAvregistrering(req: Request, b: AvregBeroenden): Promise<Response> {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method === 'GET' || req.method === 'HEAD') return vidareTillSidan(req, h);
  if (req.method !== 'POST') {
    return svar({ error: 'Avregistreringen görs med knappen på nextrum.se.' }, 405, { ...h, Allow: 'GET, HEAD, POST, OPTIONS' });
  }

  const token = await lasTokenUrAnrop(req);
  if (!token) return svar({ error: 'Länken saknar kod.' }, 400, h);

  let nyckel: string;
  try {
    nyckel = await b.nyckel();
  } catch {
    return svar({ error: 'Det går inte att avregistrera just nu. Försök igen om en stund.' }, 503, h);
  }

  let vem: Avregistrering | null;
  try {
    vem = await lasToken(token, nyckel);
  } catch {
    return svar({ error: 'Det går inte att avregistrera just nu. Försök igen om en stund.' }, 503, h);
  }
  if (!vem) return svar({ error: 'Länken är ogiltig.' }, 403, h);

  let utfall: AvregUtfall;
  try {
    utfall = await b.avregistrera(vem.uid, vem.typ, vem.kanal);
  } catch {
    utfall = 'fel';
  }
  if (utfall === 'ogiltig') return svar({ error: 'Länken gäller inte längre.' }, 400, h);
  if (utfall === 'fel') return svar({ error: 'Det gick inte att spara. Försök igen om en stund.' }, 500, h);

  return svar({ ok: true, typ: vem.typ, kanal: vem.kanal }, 200, h);
}
