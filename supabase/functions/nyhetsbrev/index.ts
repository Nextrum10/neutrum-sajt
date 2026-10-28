// ============================================================
// NEXTRUM — Edge Function: nyhetsbrev (2026-10-28)
//
// Anmälan till nyhetsbrevet, med dubbel opt-in. Tre saker, alla POST:
//   { epost, kalla, sida, webbplats }  anmäl (webbplats är honungsfällan)
//   { bekrafta: token }                bekräfta från länken i mejlet
//   { avanmal: token }                 avanmäl, och raden raderas
// och POST ?a=<token> från mejlprogrammets "Avsluta prenumeration"
// (List-Unsubscribe-Post, RFC 8058). GET skickas vidare med 303 till
// nextrum.se/nyhetsbrev, där en knapp POSTar: länkskannrar följer varje
// länk i varje mejl, och en GET som bekräftade eller avanmälde hade
// gjort det åt dem (samma skäl som notis-avanmal).
//
// SÄKERHET: verify_jwt är av (config.toml), för den som anmäler sig är
// inte inloggad. service_role rör bara tabellen nyhetsbrev, som ingen
// inloggad når. Taket: fem anmälningar i timmen per IP-nummer (som en
// hash, aldrig numret) och 300 i timmen totalt. Svaret är detsamma
// oavsett om adressen redan finns, så att formuläret inte kan användas
// för att ta reda på vem som är anmäld.
// ============================================================

import { cors, esc, epostOk, json as jsonMed, preflight } from '../_delad/http.ts';
import { serviceklient } from '../_delad/auth.ts';
import { skickaViaResend } from '../_delad/mejl.ts';
import { FARG, SAJT, rubrikHtml, skal } from '../_delad/notiser/rendera.ts';

const FRAN = 'Nextrum <info@nextrum.se>';
const AUDIENCE = Deno.env.get('RESEND_AUDIENCE_ID') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const PEPPAR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_FN = `${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/nyhetsbrev`;

const CORS = cors();
const json = (b: unknown, s: number) => jsonMed(b, s, CORS);

const TAK_IP = 5;
const TAK_ALLA = 300;

async function hash(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(PEPPAR + '|' + text));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

/* Cloudflare sätter sin egen; utan den det sista numret i kedjan, som
   Supabases proxy lagt till, aldrig det första, som klienten kan skriva. */
function ip(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const kedja = (req.headers.get('x-forwarded-for') ?? '').split(',');
  return (kedja[kedja.length - 1] ?? '').trim();
}

function sidaAdress(param: 'b' | 'a', token: string): string {
  return `${SAJT}/nyhetsbrev?${param}=${encodeURIComponent(token)}`;
}

function knapp(href: string, text: string): string {
  return `<p style="margin:24px 0"><a href="${esc(href)}" style="display:inline-block;background:${FARG.knapp};color:${FARG.knapptext};`
    + `padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600">${esc(text)}</a></p>`;
}

function stycke(text: string): string {
  return `<p style="margin:0 0 14px">${esc(text)}</p>`;
}

async function bekraftelsemejl(epost: string, token: string): Promise<void> {
  const lank = sidaAdress('b', token);
  const amne = 'Bekräfta att du vill få Nextrums nyhetsbrev';
  const html = skal({
    amne,
    forhandstext: 'Ett tryck så är du med.',
    innehall: rubrikHtml('Bekräfta din anmälan')
      + stycke('Någon, förhoppningsvis du, har anmält den här adressen till Nextrums nyhetsbrev: studietips och nyheter två gånger i månaden.')
      + knapp(lank, 'Ja, skicka mig nyhetsbrevet')
      + stycke('Var det inte du behöver du inte göra något. Utan ett tryck på knappen får du inga mejl, och adressen raderas efter sju dagar.'),
  });
  const text = `Bekräfta din anmälan till Nextrums nyhetsbrev:\n${lank}\n\nVar det inte du behöver du inte göra något. Adressen raderas efter sju dagar.`;
  await skicka(epost, amne, text, html, `nyhetsbrev-bekrafta-${token}-${new Date().toISOString().slice(0, 13)}`);
}

async function valkomstmejl(epost: string, token: string): Promise<void> {
  const av = sidaAdress('a', token);
  const amne = 'Välkommen till Nextrums nyhetsbrev';
  const html = skal({
    amne,
    forhandstext: 'Två mejl i månaden, med studietips och det som är nytt hos oss.',
    innehall: rubrikHtml('Nu är du med')
      + stycke('Tack! Du får studietips och nyheter från Nextrum två gånger i månaden.')
      + stycke('Vill du sluta får du en länk längst ner i varje mejl, och då raderar vi adressen.'),
    fot: `<p style="margin:0"><a href="${esc(av)}" style="color:${FARG.fotLank};text-decoration:underline">Avsluta nyhetsbrevet</a></p>`,
  });
  const text = `Tack! Du får studietips och nyheter från Nextrum två gånger i månaden.\n\nAvsluta: ${av}`;
  await skicka(epost, amne, text, html, `nyhetsbrev-valkommen-${token}`, {
    'List-Unsubscribe': `<${SUPABASE_FN}?a=${encodeURIComponent(token)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  });
}

async function skicka(till: string, amne: string, text: string, html: string, idempotens: string, headers?: Record<string, string>) {
  try {
    const svar = await skickaViaResend({ fran: FRAN, till: [till], amne, text, html, idempotens, headers, tidsgransMs: 10_000 });
    if (!svar.ok) console.error('nyhetsbrev: Resend', svar.status);
  } catch (_e) {
    console.error('nyhetsbrev: Resend gick inte att nå');
  }
}

/* Resends lista är bara en kopia att skicka utskicken från; tabellen är
   sanningen. Går anropet fel loggas det, och anmälan gäller ändå. */
async function audience(metod: 'POST' | 'DELETE', epost: string): Promise<void> {
  if (!AUDIENCE || !RESEND_API_KEY) return;
  const bas = `https://api.resend.com/audiences/${AUDIENCE}/contacts`;
  try {
    const svar = await fetch(metod === 'POST' ? bas : `${bas}/${encodeURIComponent(epost)}`, {
      method: metod,
      headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: metod === 'POST' ? JSON.stringify({ email: epost, unsubscribed: false }) : undefined,
    });
    if (!svar.ok && svar.status !== 404) console.error('nyhetsbrev: audience', metod, svar.status);
  } catch (_e) {
    console.error('nyhetsbrev: audience', metod, 'nätet');
  }
}

async function anmal(body: Record<string, unknown>, req: Request): Promise<Response> {
  /* Honungsfällan: en bot fyller i allt. Den får samma svar som en människa. */
  if (String(body.webbplats ?? '').trim()) return json({ ok: true }, 200);

  const epost = String(body.epost ?? '').trim().toLowerCase();
  if (!epostOk(epost) || epost.length > 254) return json({ fel: 'epost' }, 400);
  const kalla = String(body.kalla ?? '').slice(0, 40) || null;
  const sida = String(body.sida ?? '').split('?')[0].slice(0, 200) || null;

  const db = serviceklient();
  const ipNyckel = await hash(ip(req));
  const timme = new Date(Date.now() - 3600_000).toISOString();

  const [perIp, alla] = await Promise.all([
    db.from('nyhetsbrev').select('id', { count: 'exact', head: true }).eq('ip_nyckel', ipNyckel).gte('created_at', timme),
    db.from('nyhetsbrev').select('id', { count: 'exact', head: true }).gte('created_at', timme),
  ]);
  if ((alla.count ?? 0) >= TAK_ALLA) return json({ fel: 'tak' }, 429);
  if ((perIp.count ?? 0) >= TAK_IP) return json({ ok: true }, 200);

  const { data: finns, error: lasfel } = await db.from('nyhetsbrev').select('token, lage').eq('epost', epost).maybeSingle();
  if (lasfel) return json({ fel: 'server' }, 500);

  /* Redan bekräftad: inget mejl, samma svar. Väntar: samma länk igen
     (idempotensen i Resend gör det till högst ett mejl i timmen). */
  if (finns?.lage === 'bekraftad') return json({ ok: true }, 200);
  if (finns) {
    await bekraftelsemejl(epost, finns.token);
    return json({ ok: true }, 200);
  }

  const { data: ny, error } = await db.from('nyhetsbrev')
    .insert({ epost, kalla, sida, ip_nyckel: ipNyckel })
    .select('token').single();
  if (error) {
    /* 23505: två anmälningar med samma adress samtidigt. Den andra har mejlat. */
    if (error.code === '23505') return json({ ok: true }, 200);
    console.error('nyhetsbrev: insert', error.code ?? '');
    return json({ fel: 'server' }, 500);
  }
  await bekraftelsemejl(epost, ny.token);
  return json({ ok: true }, 200);
}

async function bekrafta(token: string): Promise<Response> {
  const db = serviceklient();
  const { data, error } = await db.from('nyhetsbrev')
    .update({ lage: 'bekraftad', bekraftad_at: new Date().toISOString(), ip_nyckel: null })
    .eq('token', token).eq('lage', 'vantar')
    .select('epost').maybeSingle();
  if (error) return json({ fel: 'server' }, 500);
  if (!data) {
    /* Redan bekräftad är inget fel: länken trycktes två gånger. */
    const { data: rad } = await db.from('nyhetsbrev').select('lage').eq('token', token).maybeSingle();
    return rad ? json({ ok: true }, 200) : json({ fel: 'ogiltig' }, 403);
  }
  await audience('POST', data.epost);
  await valkomstmejl(data.epost, token);
  return json({ ok: true }, 200);
}

async function avanmal(token: string): Promise<Response> {
  const db = serviceklient();
  const { data, error } = await db.from('nyhetsbrev').delete().eq('token', token).select('epost').maybeSingle();
  if (error) return json({ fel: 'server' }, 500);
  if (data) await audience('DELETE', data.epost);
  /* En okänd token är också klart: adressen finns inte hos oss. */
  return json({ ok: true }, 200);
}

const TOKEN = /^[0-9a-f]{48}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(CORS);
  const url = new URL(req.url);
  const a = url.searchParams.get('a') ?? '';

  if (req.method === 'GET' || req.method === 'HEAD') {
    const till = TOKEN.test(a) ? sidaAdress('a', a) : `${SAJT}/nyhetsbrev`;
    return new Response(null, { status: 303, headers: { location: till } });
  }
  if (req.method !== 'POST') return json({ fel: 'metod' }, 405);

  /* Mejlprogrammets ettklicksavanmälan har token i adressen och en formulärkropp. */
  if (a) return TOKEN.test(a) ? avanmal(a) : json({ fel: 'ogiltig' }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_e) {
    return json({ fel: 'kropp' }, 400);
  }
  if (typeof body.bekrafta === 'string') return TOKEN.test(body.bekrafta) ? bekrafta(body.bekrafta) : json({ fel: 'ogiltig' }, 403);
  if (typeof body.avanmal === 'string') return TOKEN.test(body.avanmal) ? avanmal(body.avanmal) : json({ fel: 'ogiltig' }, 403);
  return anmal(body, req);
});
