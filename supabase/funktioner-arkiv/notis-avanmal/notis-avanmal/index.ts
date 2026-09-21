// ============================================================
// NEXTRUM — Edge Function: notis-avanmal
//
// Stänger av notismejl för en användare. Två vägar in:
//
//  1. List-Unsubscribe-Post (RFC 8058). Gmail/Apple Mail POSTar hit
//     när användaren trycker "Avsluta prenumeration" i mejlprogrammet.
//     Tokenen står i ?t=.
//  2. nextrum.se/avanmal, som POSTar {"t": "..."} efter att
//     användaren tryckt på en knapp.
//
// GET gör INGENTING. Länkskannrar i företagsmejl och antivirus följer
// varje länk i ett mejl; om en GET avanmälde skulle folk bli avanmälda
// utan att ha rört något.
//
// Tokenen kan bara stänga AV (se _delad/notiser/token.ts). Att slå på
// igen görs inloggad, i vyn. Transaktionsmejl (bekräftelsen på en
// intresseanmälan) påverkas inte.
// ============================================================

import { cors, json as jsonMed, preflight } from '../_delad/http.ts';
import { serviceklient } from '../_delad/auth.ts';
import { lasAvanmalToken } from '../_delad/notiser/token.ts';

const CORS = cors();
const json = (b: unknown, s: number) => jsonMed(b, s, CORS);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(CORS);
  if (req.method !== 'POST') {
    return json({ error: 'Använd knappen på nextrum.se/avanmal.' }, 405);
  }

  try {
    const url = new URL(req.url);
    let token = url.searchParams.get('t') ?? '';
    if (!token && (req.headers.get('content-type') ?? '').includes('application/json')) {
      token = String((await req.json().catch(() => ({})))?.t ?? '');
    }
    if (!token) return json({ error: 'Länken saknar kod.' }, 400);

    const klient = serviceklient();
    const { data: k } = await klient.from('notis_konfig').select('avanmal_nyckel').eq('id', 1).maybeSingle();
    if (!k?.avanmal_nyckel) return json({ error: 'Tjänsten är inte konfigurerad.' }, 503);

    const anvandare = await lasAvanmalToken(token, k.avanmal_nyckel);
    if (!anvandare) return json({ error: 'Länken är ogiltig eller gammal.' }, 400);

    const { error } = await klient.rpc('notis_avanmal', { p_user: anvandare });
    if (error) return json({ error: 'Kunde inte spara. Försök igen om en stund.' }, 500);

    return json({ ok: true }, 200);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
