// ============================================================
// NEXTRUM — barnets inloggning med sin egen e-post, utan nät
// (barnets_epost)
//
// Auth loggar bara in med kontots egen adress, och ett barnkontos är
// den tekniska <namn>@barn.nextrum.se. Barnets riktiga adress står i
// barn_epost och når aldrig Auth. Edge-funktionen barn-inloggning tar
// därför emot { epost, losenord }, slår upp barnets tekniska adress i
// databasen och loggar in med den hos Auth. Svaret är barnets session,
// samma som en inloggning med användarnamnet hade gett, och vyn lägger
// den på plats med setSession. Lösenordet prövas av Auth, aldrig här.
//
// VAD SOM SKYDDAR
//
//   · Databasen räknar varje försök, per adress och per IP-nummer, som
//     en HMAC och aldrig i klartext (barn_inloggning_uppslag). Tio fel på
//     en adress eller tjugo från ett nummer på en kvart, och sedan nekas
//     det en stund. Också en adress som inte finns räknas.
//   · Ett svar säger aldrig om adressen finns: fel adress, fel lösenord,
//     en pausad inloggning och ett okänt konto ger samma text, och alla
//     nej tar minst GOLV_MS. Uppslaget går fort och Auth långsamt; utan
//     golvet hade svarstiden visat vilka adresser som hör till ett barn.
//   · Barnkontots tekniska adress tas inte emot här. Den skrivs aldrig in
//     av någon, och funktionen ska inte bli en andra väg in med den.
//   · Svaret med sessionen sparas aldrig (no-store), och ingenting av
//     adressen, lösenordet eller IP-numret skrivs i loggen.
//
// Med flaggan barn_epost av svarar uppslaget 'av', och funktionen säger
// nej direkt, utan golv: då finns ingen adress att skydda.
//
// Allt som talar med omvärlden kommer in som beroenden, som i
// barnkonto.ts, så att barninloggning_test.ts kan köra varje väg utan nät.
// ============================================================

import { lasKropp } from './notiser/avanmal.ts';
import { arBarnadress } from './barnkonto.ts';

export const TILLATNA_URSPRUNG = ['https://nextrum.se', 'https://www.nextrum.se'];

/** Så länge ett nej tar, minst. Längre än Auth brukar ta på ett fel lösenord. */
export const GOLV_MS = 900;

export const MAX_KROPP = 4096;
/** bcrypt läser bara 72 byte, och Auth nekar längre lösenord. */
const STORSTA_LOSENORD_BYTE = 72;

export const FEL = 'Fel e-post eller lösenord.';
export const SPARRAD = 'För många försök. Vänta en stund och försök igen.';
export const NERE = 'Det gick inte att logga in just nu. Försök igen om en stund.';

export type Uppslag =
  | { lage: 'av' | 'sparrad' | 'okand' }
  | { lage: 'ok'; adress: string; e: string; i: string };

export type Session = {
  access_token: string;
  refresh_token: string;
  expires_in: number | null;
  expires_at: number | null;
  token_type: string;
};

export type AuthSvar = { ok: true; session: Session } | { ok: false; status: number };

export type Beroenden = {
  /** rpc barn_inloggning_uppslag(p_epost, p_ip), med service_role. */
  uppslag: (epost: string, ip: string) => Promise<Uppslag>;
  /** rpc barn_inloggning_lyckades(p_e, p_i). */
  lyckades: (e: string, i: string) => Promise<void>;
  /** Auth: POST /auth/v1/token?grant_type=password med den tekniska adressen. */
  loggaIn: (adress: string, losenord: string) => Promise<AuthSvar>;
  vanta: (ms: number) => Promise<void>;
  nu: () => number;
};

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

/** Den som anropar, första numret i x-forwarded-for. Bara till räknaren, som en HMAC. */
export function klientensIp(req: Request): string {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim().slice(0, 64);
}

/** Anropets adress och lösenord, eller null om något inte stämmer. */
export function tolka(text: string | null): { epost: string; losenord: string } | null {
  let k: unknown;
  try {
    k = JSON.parse(text ?? '');
  } catch {
    return null;
  }
  const o = k && typeof k === 'object' ? k as Record<string, unknown> : {};
  const epost = typeof o.epost === 'string' ? o.epost.trim().toLowerCase() : '';
  const losenord = typeof o.losenord === 'string' ? o.losenord : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(epost) || epost.length > 254) return null;
  if (!losenord || new TextEncoder().encode(losenord).length > STORSTA_LOSENORD_BYTE) return null;
  if (arBarnadress(epost)) return null;
  return { epost, losenord };
}

export async function hanteraBarnInloggning(req: Request, b: Beroenden): Promise<Response> {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method !== 'POST') return svar({ error: 'Bara POST.' }, 405, { ...h, Allow: 'POST, OPTIONS' });

  const start = b.nu();
  const nej = async (status: number, text: string): Promise<Response> => {
    const kvar = GOLV_MS - (b.nu() - start);
    if (kvar > 0) await b.vanta(kvar);
    return svar({ error: text }, status, h);
  };

  if (Number(req.headers.get('content-length') ?? '0') > MAX_KROPP) return await nej(400, FEL);
  const anrop = tolka(await lasKropp(req, MAX_KROPP));
  if (!anrop) return await nej(400, FEL);

  let u: Uppslag;
  try {
    u = await b.uppslag(anrop.epost, klientensIp(req));
  } catch {
    return await nej(503, NERE);
  }
  if (u.lage === 'av') return svar({ error: FEL }, 400, h);
  if (u.lage === 'sparrad') return await nej(429, SPARRAD);
  if (u.lage !== 'ok' || !arBarnadress(u.adress)) return await nej(400, FEL);

  let a: AuthSvar;
  try {
    a = await b.loggaIn(u.adress, anrop.losenord);
  } catch {
    return await nej(503, NERE);
  }
  if (!a.ok) {
    if (a.status === 429) return await nej(429, SPARRAD);
    if (a.status >= 500) return await nej(503, NERE);
    // 400 är fel lösenord, en pausad inloggning eller något annat Auth
    // säger nej till. Samma svar för alla.
    return await nej(400, FEL);
  }

  // En räknare som inte nollas är inget skäl att neka den som just
  // loggat in rätt.
  await b.lyckades(u.e, u.i).catch(() => {});
  const s = a.session;
  return svar({
    access_token: s.access_token, refresh_token: s.refresh_token,
    expires_in: s.expires_in, expires_at: s.expires_at, token_type: s.token_type,
  }, 200, h);
}
