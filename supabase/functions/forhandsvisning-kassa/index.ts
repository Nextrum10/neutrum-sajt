// ============================================================
// NEXTRUM — forhandsvisning-kassa (2026-10-27)
//
// Stripes kassa för förhandsvisningen av studievyn: en superadmin
// betalar ett påhittat pass eller en plan i Stripes testläge, med
// Stripes testkort, och ser hela vägen genom kassan. Varför beloppen
// får komma ur anropet just här, och varför inga riktiga pengar kan
// dras, står i _delad/forhandsvisning.ts.
//
// Två anrop:
//   { rader, retur, ui }  öppnar en kassa och svarar som stripe-checkout
//                         (lage, client_secret, nyckel eller url)
//   { session }           svarar om sessionen är betald
//
// Funktionen skriver ingenting i databasen. Webhooken får sessionens
// händelser och skriver ingenting heller (arForhandsvisning).
// ============================================================

import { kravAdmin } from '../_delad/auth.ts';
import { cors, json, preflight } from '../_delad/http.ts';
import { API_VERSION, formulardata } from '../_delad/stripe.ts';
import {
  arForhandsvisning, publicerbarTestnyckel, raderUrAnrop, retur, sessionen, testnyckel,
} from '../_delad/forhandsvisning.ts';

const CORS = cors();
const env = (n: string) => Deno.env.get(n);

async function stripe(nyckel: string, metod: 'GET' | 'POST', vag: string, kropp?: Record<string, unknown>) {
  const r = await fetch(`https://api.stripe.com${vag}`, {
    method: metod,
    headers: {
      authorization: `Bearer ${nyckel}`,
      'Stripe-Version': API_VERSION,
      ...(metod === 'POST' ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: metod === 'POST' ? formulardata(kropp ?? {}).join('&') : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const fel = (data as { error?: { message?: string } }).error?.message ?? `Stripe svarade ${r.status}.`;
    throw new Error(fel);
  }
  return data as Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(CORS);
  if (req.method !== 'POST') return json({ error: 'Bara POST.' }, 405, CORS);

  const vem = await kravAdmin(req.headers.get('authorization'));
  if (!vem.ok) return vem.svar;

  const nyckel = testnyckel(env);
  if (!nyckel) {
    return json({ error: 'Förhandsvisningen betalar bara i Stripes testläge, och ingen testnyckel är satt. '
      + 'Sätt STRIPE_FORHANDSVISNING_SECRET_KEY (sk_test_…) under Edge Functions → Secrets.' }, 409, CORS);
  }

  let kropp: Record<string, unknown>;
  try { kropp = await req.json(); } catch { return json({ error: 'Ogiltig JSON.' }, 400, CORS); }

  try {
    if (typeof kropp.session === 'string') {
      if (!/^cs_test_[A-Za-z0-9_]+$/.test(kropp.session)) return json({ error: 'Ingen sådan kassa.' }, 400, CORS);
      const s = await stripe(nyckel, 'GET', `/v1/checkout/sessions/${kropp.session}`);
      if (!arForhandsvisning(s)) return json({ error: 'Kassan hör inte till förhandsvisningen.' }, 403, CORS);
      return json({ status: s.status ?? null, betald: s.payment_status === 'paid',
        belopp_ore: typeof s.amount_total === 'number' ? s.amount_total : null }, 200, CORS);
    }

    const rader = raderUrAnrop(kropp.rader);
    if (!rader) return json({ error: 'Kassan behöver 1–20 rader, var och en mellan 3 och 10 000 kr.' }, 400, CORS);
    const pk = publicerbarTestnyckel(env);
    const inbaddad = kropp.ui !== 'sida' && !!pk;
    const s = await stripe(nyckel, 'POST', '/v1/checkout/sessions',
      sessionen(rader, retur(kropp.retur), inbaddad, vem.anvandare));
    const belopp = rader.reduce((t, r) => t + r.ore, 0);
    return json(inbaddad
      ? { lage: 'inbaddad', client_secret: s.client_secret, nyckel: pk, session: s.id, belopp_ore: belopp }
      : { lage: 'sida', url: s.url, session: s.id, belopp_ore: belopp }, 200, CORS);
  } catch (e) {
    return json({ error: 'Stripe nekade: ' + ((e as Error)?.message ?? 'okänt fel') }, 502, CORS);
  }
});
