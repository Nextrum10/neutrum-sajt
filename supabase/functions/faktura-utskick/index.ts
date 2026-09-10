// ============================================================
// NEXTRUM — Edge Function: faktura-utskick
//
// Skickar en faktura till en familj, eller ett ersättningsunderlag
// till en studiehjälpare. Anropas av knappen i adminvyn.
//
// VARFÖR DEN FINNS
// Månadskörningen (fakturering) SKAPADE fakturor men skickade dem
// aldrig. Adminvyn kunde sätta status till "skickad" — men det var
// bara ett ord i en tabell, ingenting lämnade huset. En knapp som
// säger "skickad" om ett mejl som aldrig gick är värre än ingen
// knapp alls: den får någon att sluta undra var fakturan tog vägen.
//
// Nu skickas mejlet FÖRST. Statusen sätts bara om Resend svarade
// att det gick iväg.
//
// SÄKERHET
// verify_jwt är PÅ. Det räcker inte: varje inloggad familj har en
// giltig JWT, och den här funktionen kan läsa vilken familjs
// faktura som helst. Därför kontrolleras is_admin här inne, med
// anroparens egen token mot RLS, innan service_role används till
// något.
//
// Ordningen är hela poängen. service_role går förbi RLS. Skulle
// kontrollen ligga efter, eller bygga på något klienten skickat in,
// vore funktionen en öppen läsväg till alla familjers uppgifter för
// vem som helst med ett konto.
//
// INGEN RESERVAVSÄNDARE
// lead-notis faller tillbaka på onboarding@resend.dev när
// nextrum.se inte är verifierad. Det är rätt DÄR: en avisering till
// fel avsändare är bättre än ingen aning om att en familj hört av
// sig, och mejlet går ändå till oss.
//
// Här vore det fel. Reservavsändaren når bara Resend-kontots EGEN
// adress — alltså inte familjen. Att markera en faktura som skickad
// när den landade hos oss själva är att skriva in en osanning i
// databasen och sedan fakturera på den. Alltså: 403 är ett fel,
// fakturan står kvar som utkast, och den som tryckte får veta att
// domänen inte är klar.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const FRAN = 'Nextrum <no-reply@nextrum.se>';
const SVARA_TILL = 'info@nextrum.se';

// Måste stämma med prissidan, FAQ:n och användarvillkoren. Samma
// konstant finns i fakturering — en faktura som förfaller på en annan
// dag än villkoret lovar är en tvist, inte ett skrivfel.
const BETALNINGSVILLKOR_DAGAR = 14;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function epostOk(v: unknown): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? '').trim());
}

// Ören in, kronor ut. Decimalerna visas bara när de finns: "379 kr"
// är lättare att läsa än "379,00 kr", men 90 minuter blir 568,50 och
// då måste de synas. Samma regel som nextrum-betalning.js i vyerna —
// står det olika belopp i mejlet och i vyn är det en tvist.
function kronor(ore: number): string {
  const n = Number(ore || 0) / 100;
  const heltal = Math.round(n * 100) % 100 === 0;
  return n.toLocaleString('sv-SE', {
    minimumFractionDigits: heltal ? 0 : 2,
    maximumFractionDigits: 2,
  }) + ' kr';
}

const MANADER = ['januari', 'februari', 'mars', 'april', 'maj', 'juni',
                 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];

function periodText(iso: string): string {
  const [ar, man] = String(iso).split('-').map(Number);
  return `${MANADER[man - 1]} ${ar}`;
}

function datumText(iso: string | null): string {
  if (!iso) return '';
  const [ar, man, dag] = String(iso).slice(0, 10).split('-').map(Number);
  return `${dag} ${MANADER[man - 1]} ${ar}`;
}

function timmar(minuter: number): string {
  return (Number(minuter || 0) / 60).toLocaleString('sv-SE', { maximumFractionDigits: 2 }) + ' h';
}

// ------------------------------------------------------------
// Mejlet. Ett bord med raderna, en summa, ett förfallodatum.
// Inga bilder och ingen extern CSS: ett fakturamejl ska gå att
// läsa i vilken klient som helst, också en som blockerar allt.
// ------------------------------------------------------------
function fakturaMejl(f: any, rader: any[], namn: string, paminnelse: boolean) {
  const rubrik = paminnelse
    ? `Påminnelse: faktura för ${periodText(f.period)}`
    : `Faktura för ${periodText(f.period)}`;

  const textRader = rader.map((r) =>
    `  ${r.beskrivning}  ·  ${timmar(r.minuter)}  ·  ${kronor(r.belopp_ore)}`).join('\n');

  const text =
    `${rubrik}\n\n` +
    `Hej ${namn}!\n\n` +
    (paminnelse
      ? `Det här är en påminnelse om fakturan nedan. Har ni redan betalat kan ni bortse från det här mejlet.\n\n`
      : `Här kommer fakturan för de pass som genomfördes i ${periodText(f.period)}.\n\n`) +
    `${textRader}\n\n` +
    `Att betala: ${kronor(f.belopp_ore)}\n` +
    (f.forfaller ? `Förfaller: ${datumText(f.forfaller)}\n` : '') +
    `\nNi betalar alltid i efterskott, för de pass som faktiskt hållits. ` +
    `Ett pass som ställdes in eller flyttades finns inte på fakturan.\n\n` +
    `Fakturan finns också under Betalning i studievyn: https://nextrum.se/foralder\n\n` +
    `Undrar ni över något — svara på det här mejlet.\n\nNextrum\n`;

  const html =
    `<div style="font:15px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;color:#2E2A20;max-width:560px">` +
    `<h2 style="font-size:20px;font-weight:700;margin:0 0 6px">${esc(rubrik)}</h2>` +
    `<p style="margin:0 0 18px">Hej ${esc(namn)}!</p>` +
    `<p style="margin:0 0 18px">${paminnelse
      ? 'Det här är en påminnelse om fakturan nedan. Har ni redan betalat kan ni bortse från det här mejlet.'
      : `Här kommer fakturan för de pass som genomfördes i ${esc(periodText(f.period))}.`}</p>` +
    `<table style="width:100%;border-collapse:collapse;margin:0 0 18px">` +
    rader.map((r) =>
      `<tr>` +
      `<td style="padding:9px 0;border-bottom:1px solid #DDCDB2">${esc(r.beskrivning)}` +
      `<br><span style="font-size:13px;color:#665C49">${esc(timmar(r.minuter))}</span></td>` +
      `<td style="padding:9px 0;border-bottom:1px solid #DDCDB2;text-align:right;white-space:nowrap">` +
      `${esc(kronor(r.belopp_ore))}</td></tr>`).join('') +
    `<tr><td style="padding:13px 0;font-weight:700">Att betala</td>` +
    `<td style="padding:13px 0;text-align:right;font-weight:700;white-space:nowrap">` +
    `${esc(kronor(f.belopp_ore))}</td></tr>` +
    (f.forfaller
      ? `<tr><td style="padding:0 0 9px;color:#665C49">Förfaller</td>` +
        `<td style="padding:0 0 9px;text-align:right;color:#665C49">${esc(datumText(f.forfaller))}</td></tr>`
      : '') +
    `</table>` +
    `<p style="margin:0 0 18px;font-size:14px;color:#4F4738">Ni betalar alltid i efterskott, ` +
    `för de pass som faktiskt hållits. Ett pass som ställdes in eller flyttades finns inte på fakturan.</p>` +
    `<p style="margin:0 0 18px;font-size:14px">Fakturan finns också under Betalning i ` +
    `<a href="https://nextrum.se/foralder" style="color:#9C4520">studievyn</a>.</p>` +
    `<p style="margin:0;font-size:14px;color:#665C49">Undrar ni över något — svara på det här mejlet.</p>` +
    `</div>`;

  return { amne: `${rubrik} — Nextrum`, text, html };
}

function utbetalningsMejl(u: any, rader: any[], namn: string) {
  const rubrik = `Ditt underlag för ${periodText(u.period)}`;

  const textRader = rader.map((r) =>
    `  ${r.beskrivning}  ·  ${timmar(r.minuter)}  ·  ${kronor(r.belopp_ore)}`).join('\n');

  const text =
    `${rubrik}\n\nHej ${namn}!\n\n` +
    `Här är underlaget för de pass du höll och rapporterade i ${periodText(u.period)}.\n\n` +
    `${textRader}\n\n` +
    `Totalt: ${kronor(u.belopp_ore)}  (${timmar(u.minuter)})\n\n` +
    `Ett pass räknas när du skrivit rapporten. Det är samma regel som avgör vad ` +
    `familjen faktureras — inget pass kan hamna på den ena listan utan att finnas på den andra.\n\n` +
    `Underlaget finns också under Statistik & ersättning i din vy: https://nextrum.se/larare\n\n` +
    `Stämmer något inte — svara på det här mejlet innan utbetalningen görs.\n\nNextrum\n`;

  const html =
    `<div style="font:15px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;color:#2E2A20;max-width:560px">` +
    `<h2 style="font-size:20px;font-weight:700;margin:0 0 6px">${esc(rubrik)}</h2>` +
    `<p style="margin:0 0 18px">Hej ${esc(namn)}!</p>` +
    `<p style="margin:0 0 18px">Här är underlaget för de pass du höll och rapporterade i ` +
    `${esc(periodText(u.period))}.</p>` +
    `<table style="width:100%;border-collapse:collapse;margin:0 0 18px">` +
    rader.map((r) =>
      `<tr><td style="padding:9px 0;border-bottom:1px solid #DDCDB2">${esc(r.beskrivning)}` +
      `<br><span style="font-size:13px;color:#665C49">${esc(timmar(r.minuter))}</span></td>` +
      `<td style="padding:9px 0;border-bottom:1px solid #DDCDB2;text-align:right;white-space:nowrap">` +
      `${esc(kronor(r.belopp_ore))}</td></tr>`).join('') +
    `<tr><td style="padding:13px 0;font-weight:700">Totalt</td>` +
    `<td style="padding:13px 0;text-align:right;font-weight:700;white-space:nowrap">` +
    `${esc(kronor(u.belopp_ore))}</td></tr></table>` +
    `<p style="margin:0 0 18px;font-size:14px;color:#4F4738">Ett pass räknas när du skrivit ` +
    `rapporten. Samma regel avgör vad familjen faktureras.</p>` +
    `<p style="margin:0;font-size:14px;color:#665C49">Stämmer något inte — svara på det här ` +
    `mejlet innan utbetalningen görs.</p></div>`;

  return { amne: `${rubrik} — Nextrum`, text, html };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
      return json({ error: 'SUPABASE_URL, SUPABASE_ANON_KEY eller SUPABASE_SERVICE_ROLE_KEY saknas på servern.' }, 500);
    }

    // ---------- 1. Vem frågar? ----------
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return json({ error: 'Ingen inloggning.' }, 401);

    // Anroparens egen token mot RLS. Läser bara den egna profilraden,
    // för det är allt RLS släpper fram — vilket är precis vad vi vill
    // veta något om.
    const somAnvandare = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: jag, error: jagFel } = await somAnvandare.auth.getUser();
    if (jagFel || !jag?.user) return json({ error: 'Inloggningen gick inte att verifiera.' }, 401);

    const { data: profil } = await somAnvandare
      .from('profiles').select('is_admin, full_name').eq('id', jag.user.id).maybeSingle();

    if (!profil?.is_admin) return json({ error: 'Bara admin får skicka fakturor.' }, 403);

    // ---------- 2. Vad ska skickas? ----------
    const kropp = await req.json().catch(() => ({}));
    const typ = kropp?.typ === 'utbetalning' ? 'utbetalning' : 'faktura';
    const id = String(kropp?.id ?? '').trim();
    const paminnelse = kropp?.paminnelse === true;
    const torrkorning = kropp?.torrkorning === true;

    if (!id) return json({ error: 'Ingen id angiven.' }, 400);

    // Först härifrån används service_role. Kontrollen ovan är redan
    // gjord; allt nedan går förbi RLS med flit, eftersom en faktura
    // hör till en familj som admin inte är part i.
    const db = createClient(SUPABASE_URL, SERVICE_ROLE);

    let mottagare = '';
    let namn = '';
    let mejl: { amne: string; text: string; html: string };
    let rad: any;

    if (typ === 'faktura') {
      const { data: f, error } = await db.from('invoices')
        .select('id, parent_id, period, status, belopp_ore, forfaller, skickad_at')
        .eq('id', id).maybeSingle();
      if (error) return json({ error: 'Kunde inte läsa fakturan: ' + error.message }, 500);
      if (!f) return json({ error: 'Fakturan finns inte.' }, 404);

      // En makulerad faktura ska aldrig gå iväg, och en betald ska
      // aldrig påminnas om. Kontrollen ligger här och inte i knappen:
      // knappen kan vara ritad ur en lista som är någon minut gammal.
      if (f.status === 'makulerad') return json({ error: 'Fakturan är makulerad.' }, 409);
      if (f.status === 'betald') return json({ error: 'Fakturan är redan betald.' }, 409);

      const [{ data: rader }, { data: p }] = await Promise.all([
        db.from('invoice_lines').select('beskrivning, minuter, belopp_ore').eq('invoice_id', f.id),
        db.from('profiles').select('email, full_name').eq('id', f.parent_id).maybeSingle(),
      ]);
      if (!rader?.length) return json({ error: 'Fakturan saknar rader.' }, 409);
      if (!epostOk(p?.email)) return json({ error: 'Familjen saknar en giltig e-postadress.' }, 409);

      /* Förfallodagen räknas från när fakturan SKICKAS, inte från när
         månadskörningen skapade den. Villkoret lovar familjen fjorton
         dagar; skapas fakturan den 1:a och skickas den 5:e vore det
         tio. Att den som skickar sent äter upp mottagarens betaltid är
         inte ett villkor någon gått med på.

         Bara vid första utskicket. En påminnelse ska aldrig flytta
         fram förfallodagen — då vore påminnelsen en förlängning. */
      const förstaUtskicket = f.status === 'utkast' && !paminnelse;
      if (förstaUtskicket) {
        const d = new Date();
        d.setDate(d.getDate() + BETALNINGSVILLKOR_DAGAR);
        f.forfaller = d.toISOString().slice(0, 10);
      }

      mottagare = String(p!.email).trim();
      namn = String(p?.full_name ?? '').split(' ')[0] || 'du';
      mejl = fakturaMejl(f, rader, namn, paminnelse);
      rad = f;
    } else {
      const { data: u, error } = await db.from('payouts')
        .select('id, tutor_id, period, status, belopp_ore, minuter')
        .eq('id', id).maybeSingle();
      if (error) return json({ error: 'Kunde inte läsa underlaget: ' + error.message }, 500);
      if (!u) return json({ error: 'Underlaget finns inte.' }, 404);

      const [{ data: rader }, { data: p }] = await Promise.all([
        db.from('payout_lines').select('beskrivning, minuter, belopp_ore').eq('payout_id', u.id),
        db.from('profiles').select('email, full_name').eq('id', u.tutor_id).maybeSingle(),
      ]);
      if (!rader?.length) return json({ error: 'Underlaget saknar rader.' }, 409);
      if (!epostOk(p?.email)) return json({ error: 'Studiehjälparen saknar en giltig e-postadress.' }, 409);

      mottagare = String(p!.email).trim();
      namn = String(p?.full_name ?? '').split(' ')[0] || 'du';
      mejl = utbetalningsMejl(u, rader, namn);
      rad = u;
    }

    // Torrkörning: räkna ut allt, skicka ingenting. Gör den först,
    // en gång, så att man ser vad familjen faktiskt kommer att läsa
    // innan det ligger i deras inkorg.
    if (torrkorning) {
      return json({ ok: true, torrkorning: true, till: mottagare, amne: mejl.amne, text: mejl.text }, 200);
    }

    if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY saknas som secret.' }, 500);

    // ---------- 3. Skicka ----------
    const svar = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: FRAN,
        to: [mottagare],
        reply_to: [SVARA_TILL],
        subject: mejl.amne,
        text: mejl.text,
        html: mejl.html,
      }),
    });

    if (svar.status === 403) {
      return json({
        error: 'Resend vägrar skicka från ' + FRAN + '. Domänen nextrum.se är inte verifierad. '
             + 'Fakturan står kvar som den var — ingenting har skickats och ingen status har ändrats.',
        orsak: await svar.text(),
      }, 502);
    }
    if (!svar.ok) {
      return json({ error: 'Resend svarade ' + svar.status + ': ' + (await svar.text()) }, 502);
    }
    const resendId = (await svar.json())?.id ?? null;

    // ---------- 4. Först NU ändras statusen ----------
    // Ordningen är hela poängen med funktionen. Går mejlet fel står
    // fakturan kvar som utkast och någon kan försöka igen.
    if (typ === 'faktura' && !paminnelse) {
      const { error } = await db.from('invoices')
        .update({
          status: 'skickad',
          skickad_at: new Date().toISOString(),
          // Samma datum som stod i mejlet. Skulle de skilja sig åt
          // vore fakturan i familjens vy en annan faktura än den de
          // fick — och den skillnaden märks först i en tvist.
          forfaller: rad.forfaller,
        })
        .eq('id', rad.id);
      if (error) {
        // Mejlet ÄR skickat. Att svara "det gick fel" hade fått någon
        // att trycka igen och skicka två fakturor för samma månad.
        return json({
          ok: true, id: resendId, till: mottagare,
          varning: 'Mejlet gick iväg, men statusen kunde inte uppdateras: ' + error.message
                 + ' — sätt den till Skickad för hand, och skicka INTE om.',
        }, 200);
      }
    }

    return json({ ok: true, id: resendId, till: mottagare, paminnelse }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
