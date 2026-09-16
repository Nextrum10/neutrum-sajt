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
// Anropas av en databastrigger, aldrig av en webbläsare. Hemligheten
// jämförs mot raden i notis_konfig — samma tabell som lead-notis och
// meddelande-notis använder.
//
// Den låg förut i en egen secret, PASS_NOTIS_HEMLIGHET, som aldrig
// blev satt. Det är precis den sortens halvfärdiga uppställning som
// schema-v17 flyttade bort från: en secret och en trigger-header i
// två olika fönster glider isär, och den som ska sätta dem måste
// klistra in samma sträng två gånger utan att se dem bredvid
// varandra. I tabellen finns hemligheten redan, och triggern hämtar
// den i samma SQL-block som skapar den.
// ============================================================

import { CORS, json, esc, datumText, db, hemlighetOk, skickaMejl } from '../_delad/notis.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const klient = db();
    if (!await hemlighetOk(req, klient)) {
      return json({ error: 'Fel eller saknad hemlighet.' }, 401);
    }

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

    // Familjens adress, studiehjälparens namn, och barnets namn.
    // Tre frågor i en runda: listorna är en rad lång var.
    const [foralder, tutor, elev] = await Promise.all([
      klient.from('profiles').select('email, full_name').eq('id', b.parent_id).maybeSingle(),
      klient.from('profiles').select('full_name').eq('id', b.created_by).maybeSingle(),
      b.student_id
        ? klient.from('students').select('name').eq('id', b.student_id).maybeSingle()
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

    return await skickaMejl({
      till,
      amne: `Ny tid föreslagen: ${datumText(b.wanted_date)}${klockan}`,
      text,
      html,
    });
  } catch (fel) {
    return json({ error: String((fel as Error)?.message ?? fel) }, 500);
  }
});
