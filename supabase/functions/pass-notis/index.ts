// ============================================================
// NEXTRUM — Edge Function: pass-notis
//
// Mejlar familjen när studiehjälparen föreslår en tid.
//
// Förslaget syns redan i studievyn som en notis. Men en familj som
// inte råkar logga in ser det inte, och tiden står och blockerar
// studiehjälparens kalender under tiden. Mejlet är det som gör att
// någon faktiskt svarar.
//
//
// VARFÖR BARA FÖRSLAG FRÅN STUDIEHJÄLPAREN
//
// bookings får rader från båda håll. Familjen som bokar själv har
// redan sett vad de gjorde — ett mejl om det är ett kvitto ingen bad
// om. Studiehjälparens förslag är det enda som kräver ett svar från
// någon som inte var där när raden skapades.
//
// Villkoret står i TRIGGERN, inte här: `created_by <> parent_id`.
// Funktionen kontrollerar det en gång till ändå, för en trigger kan
// ändras av någon som inte läser den här filen.
//
//
// SÄKERHET
//
// Anropas av en databastrigger, aldrig av en webbläsare. Skyddas av
// samma sorts delade hemlighet som lead-notis: x-nextrum-notis måste
// matcha en secret på servern. verify_jwt = false.
//
//
// INNAN DEN FUNGERAR
//
//   1. supabase secrets set PASS_NOTIS_HEMLIGHET="<slumpa 32 tecken>"
//      (eller Dashboard → Edge Functions → Secrets)
//   2. schema-v22.sql med samma sträng i triggern.
//
// Utan secreten svarar funktionen 401 på varje anrop. Det är med
// flit: hellre tyst och stoppad än öppen för vem som helst.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const HEMLIGHET = Deno.env.get('PASS_NOTIS_HEMLIGHET');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

// Samma avsändare som lead-notis. Går domänen inte att verifiera
// hos Resend faller den tillbaka på deras testdomän.
const FRAN = 'Nextrum <no-reply@nextrum.se>';
const RESERV_FRAN = 'Nextrum <onboarding@resend.dev>';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-nextrum-notis',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

function esc(t: string): string {
  return String(t).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

const MANADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni',
                 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];

function datumText(iso: string): string {
  const [, m, d] = String(iso).split('-');
  return `${Number(d)} ${MANADER[Number(m) - 1] ?? ''}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return json({ error: 'SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY saknas.' }, 500);
    }
    if (!HEMLIGHET || req.headers.get('x-nextrum-notis') !== HEMLIGHET) {
      return json({ error: 'Fel eller saknad hemlighet.' }, 401);
    }
    if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY saknas som secret.' }, 500);

    const kropp = await req.json();
    const b = kropp?.record;
    if (!b) return json({ error: 'Ingen record i webhook-anropet.' }, 400);

    // Dubbelkontroll av triggerns villkor. Se kommentaren överst.
    if (!b.parent_id || !b.created_by || b.created_by === b.parent_id) {
      return json({ hoppade_over: 'Inte ett förslag från studiehjälparen.' }, 200);
    }
    if (b.status !== 'requested') {
      return json({ hoppade_over: `Status är ${b.status}, inte requested.` }, 200);
    }

    const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Familjens adress, studiehjälparens namn, och barnets namn.
    // Tre frågor i en runda: listorna är en rad lång var.
    const [foralder, tutor, elev] = await Promise.all([
      db.from('profiles').select('email, full_name').eq('id', b.parent_id).maybeSingle(),
      db.from('profiles').select('full_name').eq('id', b.created_by).maybeSingle(),
      b.student_id
        ? db.from('students').select('name').eq('id', b.student_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const till = foralder.data?.email;
    if (!till) return json({ error: 'Familjen har ingen e-postadress.' }, 422);

    const vem = tutor.data?.full_name ?? 'Er studiehjälpare';
    const barn = (elev as { data?: { name?: string } }).data?.name;
    const klockan = b.wanted_time ? ` kl. ${String(b.wanted_time).slice(0, 5)}` : '';
    const langd = b.duration_min ? `${b.duration_min} minuter` : '';

    const rader = [
      `När: ${datumText(b.wanted_date)}${klockan}`,
      barn ? `För: ${barn}` : '',
      b.subject ? `Ämne: ${b.subject}` : '',
      b.format ? `Upplägg: ${b.format}` : '',
      b.location ? `Plats: ${b.location}` : '',
      langd ? `Längd: ${langd}` : '',
      b.note ? `\nMeddelande från ${vem}:\n${b.note}` : '',
    ].filter(Boolean).join('\n');

    const text =
      `${vem} har föreslagit en tid för ett pass.\n\n${rader}\n\n` +
      `Svara ja eller nej i studievyn:\nhttps://nextrum.se/foralder#pass-lista\n\n` +
      `Tiden står bokad hos ${vem} tills ni svarat, så säg gärna till ` +
      `även om den inte passar.\n`;

    const html =
      `<h2 style="font:600 18px system-ui;margin:0 0 14px">Ny tid föreslagen</h2>` +
      `<pre style="font:14px/1.6 ui-monospace,monospace;white-space:pre-wrap;margin:0 0 18px">${esc(rader)}</pre>` +
      `<p style="font:14px/1.6 system-ui;margin:0 0 18px">` +
      `<a href="https://nextrum.se/foralder#pass-lista" ` +
      `style="display:inline-block;background:#9C4520;color:#fff;text-decoration:none;` +
      `padding:11px 20px;border-radius:10px;font-weight:600">Svara på förslaget</a></p>` +
      `<p style="font:13px/1.6 system-ui;color:#666;margin:0">` +
      `Tiden står bokad hos ${esc(vem)} tills ni svarat, så säg gärna till även om den inte passar.</p>`;

    const skicka = (avsandare: string) => fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: avsandare,
        to: [till],
        subject: `Ny tid föreslagen: ${datumText(b.wanted_date)}${klockan}`,
        text,
        html,
      }),
    });

    const svar = await skicka(FRAN);

    // 403 = domänen inte verifierad hos Resend. Allt annat är ett
    // riktigt fel och ska synas som det.
    if (svar.status === 403) {
      const orsak = await svar.text();
      const reserv = await skicka(RESERV_FRAN);
      if (reserv.ok) {
        return json({ skickat: true, avsandare: RESERV_FRAN, notering: orsak }, 200);
      }
      return json({ error: 'Kunde inte skicka: ' + (await reserv.text()) }, 502);
    }

    if (!svar.ok) return json({ error: 'Kunde inte skicka: ' + (await svar.text()) }, 502);

    return json({ skickat: true, avsandare: FRAN }, 200);
  } catch (fel) {
    return json({ error: String((fel as Error)?.message ?? fel) }, 500);
  }
});
