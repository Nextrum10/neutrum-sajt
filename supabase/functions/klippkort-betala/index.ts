// ============================================================
// NEXTRUM — klippkort-betala (Fas 16.1)
//
// Familjen betalar ett bekräftat pass med timmar från en plan eller
// ett klippkort. Inga pengar rör sig: timmarna köptes och betalades när
// kortet köptes, och här dras de bara.
//
//
// VARFÖR EN FUNKTION OCH INTE ETT RPC-ANROP FRÅN VYN
//
// skydda_bokningsfalt låter inte en inloggad familj skriva
// betalning_status eller klippkort_id, och det är rätt: annars kunde
// vem som helst märka sitt pass som betalt. Dragningen görs därför av
// klippkort_dra() med service_role, som webhooken, och den funktionen
// når bara service_role.
//
// ANROPARENS TOKEN FÖRST (CLAUDE.md avsnitt 6). Passet läses med
// familjens egen token innan service_role används: ser familjen inte
// passet genom RLS finns det inte för den här funktionen heller.
// klippkort_dra prövar dessutom själv att passet och kortet hör till
// samma familj — den litar inte på att anroparen gjort det.
//
// DEN ÖPPNA KASSAN STÄNGS. Har familjen öppnat kortbetalningen för
// passet och sedan valt timmar står kassan kvar hos Stripe i ett dygn.
// Den stängs här, så att passet inte kan betalas två gånger. Hinner en
// betalning igenom ändå vinner kortet i webhooken, och timmarna kommer
// tillbaka på klippkortet.
// ============================================================

import { kravInloggad, serviceklient } from '../_delad/auth.ts';
import { cors, json, preflight } from '../_delad/http.ts';
import { StripeError, v1 } from '../_delad/stripe.ts';

const CORS = cors();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(CORS);
  if (req.method !== 'POST') return json({ error: 'Bara POST.' }, 405, CORS);

  const vem = await kravInloggad(req.headers.get('authorization'));
  if (!vem.ok) return vem.svar;

  let kropp: { pass?: string } = {};
  try {
    kropp = await req.json();
  } catch {
    return json({ error: 'Kroppen är inte JSON.' }, 400, CORS);
  }
  const passId = String(kropp.pass ?? '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(passId)) return json({ error: 'Vilket pass?' }, 400, CORS);

  // Med familjens egen token: RLS avgör om passet alls finns för hen.
  const { data: pass } = await vem.klient
    .from('bookings').select('id').eq('id', passId).maybeSingle();
  if (!pass) return json({ error: 'Passet finns inte.' }, 404, CORS);

  const db = serviceklient();
  const { data: flagga } = await db.from('flaggor').select('aktiv').eq('kod', 'erbjudanden').maybeSingle();
  if (!flagga?.aktiv) {
    return json({ error: 'Timmarna går inte att använda än. Betala passet med kort.' }, 409, CORS);
  }

  const { data: svar, error } = await db.rpc('klippkort_dra', { p_pass: passId, p_foralder: vem.anvandare });
  if (error) {
    console.error('klippkort-betala: klippkort_dra', JSON.stringify({ pass: passId, fel: error.message }));
    return json({ error: 'Timmarna gick inte att dra. Försök igen, eller betala med kort.' }, 500, CORS);
  }
  const s = (svar ?? {}) as { ok?: boolean; fel?: string; kvar?: number; session?: string | null };
  // Ett besked från databasen, skrivet för familjen: visas som det är.
  if (!s.ok) return json({ error: s.fel ?? 'Timmarna gick inte att dra.' }, 409, CORS);

  if (s.session) {
    try {
      await v1('POST', `/v1/checkout/sessions/${s.session}/expire`);
    } catch (e) {
      /* En kassa som redan gått ut eller betalats kan inte stängas, och
         det är inget fel här: passet är betalt med timmar, och en
         betalning som ändå kom in hanteras av webhooken. */
      if (!(e instanceof StripeError)) {
        console.error('klippkort-betala: kassan stängdes inte', JSON.stringify({ pass: passId, fel: (e as Error)?.message }));
      }
    }
  }

  return json({ ok: true, kvar: s.kvar ?? null }, 200, CORS);
});
