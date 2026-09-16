// ============================================================
// NEXTRUM — Edge Function: meddelande-notis
//
// Mejlar mottagaren när ett meddelande skrivs i en tråd.
//
// Trådarna syns redan i båda vyerna med en olästräknare. Men en
// familj som inte loggar in vet inte att studiehjälparen frågat
// något — och en fråga inför morgondagens pass som besvaras om en
// vecka hade lika gärna kunnat vara obesvarad.
//
//
// VEM SOM FÅR MEJLET
//
// Motparten, aldrig avsändaren. En rad i messages har parent_id och
// tutor_id; sender_id säger vem som skrev. Mottagaren är den andra
// av de två.
//
//
// INGEN MEDDELANDETEXT I MEJLET
//
// Notisen säger ATT något kommit och vem det är från, inte VAD som
// står. Innehållet kan gälla ett barns skolgång, och ett mejl
// passerar servrar vi inte styr över och ligger kvar i inkorgar vi
// inte kontrollerar. Den som vill läsa loggar in — det är två
// klick, och tråden finns där.
//
//
// EN I TIMMEN, INTE EN PER RAD
//
// En chatt är korta repliker. Fem rader på tre minuter ska inte bli
// fem mejl, och den som får fem mejl slutar läsa det sjätte.
// Funktionen skickar bara om mottagaren INTE redan fått en notis
// för samma tråd den senaste timmen.
// ============================================================

import { CORS, json, esc, db, hemlighetOk, skickaMejl } from '../_delad/notis.ts';

const TYST_MINUTER = 60;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const klient = db();
    if (!await hemlighetOk(req, klient)) {
      return json({ error: 'Fel eller saknad hemlighet.' }, 401);
    }

    const kropp = await req.json();
    const m = kropp?.record;
    if (!m) return json({ error: 'Ingen record i webhook-anropet.' }, 400);
    if (!m.parent_id || !m.tutor_id || !m.sender_id) {
      return json({ hoppade_over: 'Raden saknar parter.' }, 200);
    }

    const mottagare = m.sender_id === m.parent_id ? m.tutor_id : m.parent_id;
    if (mottagare === m.sender_id) {
      return json({ hoppade_over: 'Avsändare och mottagare är samma.' }, 200);
    }

    // Har mottagaren redan fått en notis för den här tråden nyss?
    const sedan = new Date(Date.now() - TYST_MINUTER * 60_000).toISOString();
    const { count } = await klient
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', m.parent_id)
      .eq('tutor_id', m.tutor_id)
      .neq('sender_id', mottagare)
      .gte('created_at', sedan)
      .neq('id', m.id);

    if ((count ?? 0) > 0) {
      return json({ hoppade_over: `Notis redan skickad inom ${TYST_MINUTER} minuter.` }, 200);
    }

    const [till, fran] = await Promise.all([
      klient.from('profiles').select('email, full_name, role').eq('id', mottagare).maybeSingle(),
      klient.from('profiles').select('full_name, role').eq('id', m.sender_id).maybeSingle(),
    ]);

    const adress = till.data?.email;
    if (!adress) return json({ error: 'Mottagaren har ingen e-postadress.' }, 422);

    const avsandare = fran.data?.full_name
      ?? (fran.data?.role === 'tutor' ? 'Er studiehjälpare' : 'Familjen');
    const vy = till.data?.role === 'tutor' ? '/larare' : '/foralder';

    const text =
      `${avsandare} har skrivit till dig i Nextrum.\n\n` +
      `Läs och svara här:\nhttps://nextrum.se${vy}#meddelanden\n\n` +
      `Själva meddelandet står bara i vyn, inte i det här mejlet — det kan gälla ` +
      `ett barns skolgång, och sådant ska inte ligga i en inkorg.\n`;

    const html =
      `<h2 style="font:600 18px system-ui;margin:0 0 14px">Nytt meddelande</h2>` +
      `<p style="font:15px/1.6 system-ui;margin:0 0 18px">` +
      `<b>${esc(avsandare)}</b> har skrivit till dig i Nextrum.</p>` +
      `<p style="font:14px/1.6 system-ui;margin:0 0 18px">` +
      `<a href="https://nextrum.se${vy}#meddelanden" ` +
      `style="display:inline-block;background:#9C4520;color:#fff;text-decoration:none;` +
      `padding:11px 20px;border-radius:10px;font-weight:600">Läs och svara</a></p>` +
      `<p style="font:13px/1.6 system-ui;color:#666;margin:0">` +
      `Själva meddelandet står bara i vyn, inte i det här mejlet — det kan gälla ett ` +
      `barns skolgång, och sådant ska inte ligga i en inkorg.</p>`;

    return await skickaMejl({
      till: adress,
      amne: `Nytt meddelande från ${avsandare}`,
      text,
      html,
    });
  } catch (fel) {
    return json({ error: String((fel as Error)?.message ?? fel) }, 500);
  }
});
