// ============================================================
// NEXTRUM — Edge Function: lead-notis
//
// Mejlar info@nextrum.se när någon skickar en intresseanmälan.
// Anmälan sparas i databasen som förut; det här är en avisering
// ovanpå, inte i stället för. Går mejlet fel ligger raden kvar.
//
// ANROPAS AV EN DATABASWEBHOOK, inte av webbläsaren. Det är med
// flit. En funktion som tar emot formulärdata från klienten är en
// öppen väg att fylla er inkorg med skräp — vem som helst kan läsa
// adressen i JavaScript och anropa den i en slinga. Webhooken körs
// på Supabases sida när raden faktiskt skapats, så det som mejlas
// är alltid något som verkligen står i databasen.
//
// verify_jwt är av, eftersom en webhook inte har någon inloggad
// användare. I stället krävs en delad hemlighet i en egen header.
// Utan den svarar funktionen 401 och gör ingenting.
// ============================================================

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const NOTIS_HEMLIGHET = Deno.env.get('NOTIS_HEMLIGHET');

const FRAN = 'Nextrum <no-reply@nextrum.se>';
const TILL = 'info@nextrum.se';

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/* Rader som saknas ska inte bli tomma etiketter i mejlet. */
function rad(etikett: string, varde: unknown): string {
  const v = String(varde ?? '').trim();
  return v ? `${etikett}: ${v}\n` : '';
}

/* Ser adressen ut som en adress? Samma grova kontroll som i
   formuläret. Den finns HÄR också, för databasen kan fyllas på
   från annat håll än sidan och en trasig rad får inte kunna
   stoppa aviseringen om sig själv. */
function epostOk(v: unknown): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? '').trim());
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

Deno.serve(async (req) => {
  try {
    /* Hemligheten kollas FÖRST. Den förra ordningen svarade
       "RESEND_API_KEY saknas" till vem som helst som pingade
       adressen — ett litet läckage om serverns tillstånd till någon
       som inte ens fått visa att de hör hemma här. Nu får en
       oautentiserad anropare bara 401, oavsett hur servern mår. */
    if (!NOTIS_HEMLIGHET || req.headers.get('x-nextrum-notis') !== NOTIS_HEMLIGHET) {
      return json({ error: 'Fel eller saknad hemlighet.' }, 401);
    }

    if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY saknas som secret.' }, 500);

    const kropp = await req.json();
    const r = kropp?.record;
    if (!r) return json({ error: 'Ingen record i webhook-anropet.' }, 400);

    const text =
      'Ny intresseanmälan på nextrum.se\n\n' +
      rad('Namn', r.parent_name) +
      rad('E-post', r.email) +
      rad('Elevens namn', r.child_name) +
      rad('Årskurs', r.grade) +
      rad('Ämne', r.subject) +
      (r.message ? `\nMeddelande:\n${r.message}\n` : '') +
      `\nInkom: ${r.created_at ?? 'okänt'}\nRad-id: ${r.id ?? 'okänt'}\n`;

    const html =
      `<h2 style="font:600 18px system-ui;margin:0 0 14px">Ny intresseanmälan</h2>` +
      `<pre style="font:14px/1.6 ui-monospace,monospace;white-space:pre-wrap;margin:0">${esc(text)}</pre>`;

    const svar = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FRAN,
        to: [TILL],
        /* Svara-knappen ska gå till familjen, inte till no-reply.
           Utan det här måste man kopiera adressen ur mejlet.

           Bara när adressen ser giltig ut. Resend avvisar HELA
           utskicket med 422 på en ogiltig svarsadress, och då dog
           aviseringen om just den anmälan som behövde granskas mest.
           Adressen står ändå i texten ovan, så ingenting går
           förlorat — mejlet kommer fram, utan svara-knapp. */
        reply_to: epostOk(r.email) ? [String(r.email).trim()] : undefined,
        subject: `Intresseanmälan: ${r.parent_name ?? 'okänd'}${r.grade ? ' — ' + r.grade : ''}`,
        text,
        html,
      }),
    });

    if (!svar.ok) {
      return json({ error: 'Resend svarade ' + svar.status + ': ' + (await svar.text()) }, 502);
    }

    return json({ ok: true, id: (await svar.json())?.id ?? null }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
