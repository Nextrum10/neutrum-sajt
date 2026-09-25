// ============================================================
// NEXTRUM — google-meet (Fas 18.1)
//
// Länken till ett onlinepass. Passets sida i föräldravyn och
// studiehjälparvyn läser först pass_moten själv; finns ingen rad och
// passet är ett bekräftat onlinepass kommer den hit.
//
//   POST { pass }  →  { lank }                 länken, ny eller befintlig
//                  →  { lank: null, kopplad }  Google är inte kopplat
//
// Allt annat är ett fel, och vyn visar då texten om att länken kommer
// i meddelanden. Vad som gick fel står under System → Integrationer,
// inte i svaret: familjen ska inte läsa om klienthemligheter.
//
//
// VARFÖR NÄR NÅGON ÖPPNAR PASSET, OCH INTE AV EN TRIGGER
//
// En trigger på bookings hade behövt en kö, ett schema som väcker den,
// omförsök och ett sätt att märka när den tystnat. Notiserna har allt
// det, och det tog en hel runda innan de sa sanningen om sig själva.
// Här behövs länken först när någon letar efter den, och då sitter
// någon och väntar på svaret. Går det fel ser hen det direkt, och
// admin ser varför. Ingenting kan tystna utan att någon märker det.
//
// Det ger också rätt svar på passen som bekräftades innan Google
// kopplades: de får sin länk nästa gång någon öppnar dem, utan en
// körning i efterhand.
//
//
// ANROPARENS TOKEN FÖRST (CLAUDE.md avsnitt 6). Passet läses med den
// inloggades egen token: ser hen inte passet genom RLS finns det inte
// här heller. Först därefter service_role, till tre saker: kopplingens
// rad, rummets rad och statusen.
//
//
// TVÅ SAMTIDIGA ANROP FÅR SAMMA LÄNK. Båda kan hinna skapa ett rum,
// men bara det första hamnar i pass_moten, där passet är primärnyckel,
// och båda svarar med raden som står där. Det andra rummet används
// aldrig och kostar ingenting.
//
//
// LÄNKEN LIGGER KVAR när passet flyttas: samma pass, samma rum. Den
// visas inte för ett avbokat eller genomfört pass, men den tas inte
// bort — ett rum hos Google är inget att städa.
// ============================================================

import { kravInloggad, serviceklient } from '../_delad/auth.ts';
import { cors, json, preflight } from '../_delad/http.ts';
import { atkomstVarning, feltext, klientUrMiljon, type Rum, skapaRum } from '../_delad/google.ts';
import { atkomstTillKontot, skrivFel, skrivLyckat } from '../_delad/google_konto.ts';

const CORS = cors();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INTE_NU = 'Länken gick inte att skapa just nu.';

/* Datumet i Stockholm. wanted_date är ett svenskt datum, och klockan
   på servern går i UTC: mellan midnatt och två på natten hade
   gårdagens pass annars räknats som dagens. */
function idagIStockholm(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(CORS);
  if (req.method !== 'POST') return json({ error: 'Bara POST.' }, 405, CORS);

  const vem = await kravInloggad(req.headers.get('authorization'));
  if (!vem.ok) return vem.svar;

  let kropp: { pass?: unknown } = {};
  try {
    kropp = await req.json();
  } catch {
    return json({ error: 'Kroppen är inte JSON.' }, 400, CORS);
  }
  const passId = String(kropp.pass ?? '').trim();
  if (!UUID.test(passId)) return json({ error: 'Vilket pass?' }, 400, CORS);

  // Med den inloggades egen token: RLS avgör om passet alls finns för hen.
  const { data: b } = await vem.klient
    .from('bookings').select('id, status, format, wanted_date').eq('id', passId).maybeSingle();
  if (!b) return json({ error: 'Passet finns inte.' }, 404, CORS);

  const { data: finns } = await vem.klient
    .from('pass_moten').select('lank').eq('booking_id', passId).maybeSingle();
  if (finns?.lank) return json({ lank: finns.lank }, 200, CORS);

  if (b.status !== 'confirmed' || b.format !== 'Online') {
    return json({ error: 'Bara ett bekräftat onlinepass får en möteslänk.' }, 409, CORS);
  }
  if (String(b.wanted_date ?? '') < idagIStockholm()) {
    return json({ error: 'Passet har redan varit.' }, 409, CORS);
  }

  const db = serviceklient();
  const a = await atkomstTillKontot(db, klientUrMiljon());
  if (!a.ok) {
    // Inte kopplat är inget fel, det är läget tills någon kopplat.
    // Kopplat men trasigt är ett fel, och står redan i statusen.
    return a.kopplad ? json({ error: INTE_NU }, 502, CORS) : json({ lank: null, kopplad: false }, 200, CORS);
  }

  let rum: Rum;
  try {
    rum = await skapaRum(a.token);
  } catch (e) {
    await skrivFel(db, feltext(e));
    return json({ error: INTE_NU }, 502, CORS);
  }

  // Ett rum som inte blev öppet sparas inte. Se google.ts.
  const varning = atkomstVarning(rum.atkomst);
  if (varning) {
    await skrivFel(db, varning);
    return json({ error: INTE_NU }, 502, CORS);
  }

  const { error: sparFel } = await db.from('pass_moten')
    .upsert({ booking_id: b.id, lank: rum.lank, rum: rum.rum }, { onConflict: 'booking_id', ignoreDuplicates: true });
  if (sparFel) {
    await skrivFel(db, 'Länken skapades men gick inte att spara: ' + sparFel.message);
    return json({ error: INTE_NU }, 500, CORS);
  }

  // Den som står i tabellen, inte den vi nyss skapade: hann ett annat
  // anrop före är det dess länk som gäller för båda.
  const { data: rad } = await db.from('pass_moten').select('lank').eq('booking_id', b.id).maybeSingle();
  await skrivLyckat(db);
  return json({ lank: rad?.lank ?? rum.lank }, 200, CORS);
});
