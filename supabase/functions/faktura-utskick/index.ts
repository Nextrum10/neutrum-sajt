// ============================================================
// NEXTRUM — Edge Function: faktura-utskick
//
// Skickar ett ersättningsunderlag till en studiehjälpare. Anropas av
// knappen Skicka underlag under Ekonomi → Utbetalningar.
//
// FAKTUROR SKICKAS INTE HÄRIFRÅN LÄNGRE (Fas 14.6). Funktionen skickade
// förut också familjens månadsfaktura, som ett eget mejl från Nextrum
// med texten "Ni betalar alltid i efterskott". Fas 14.2 rev
// månadsfakturan, och Fas 14.6 gav familjen faktura som val igen, men
// nu skapas och skickas fakturan i Wint, med Wints OCR-nummer och
// bankgiro. Ett andra fakturamejl härifrån hade gett familjen två
// fakturor för samma pass, med olika nummer. Ett anrop med
// typ = 'faktura' nekas därför, med ett besked om vägen dit.
//
// Namnet står kvar. Det är adressen adminvyn anropar, och ett nytt
// namn hade varit en ny funktion i driften medan den gamla låg kvar
// ACTIVE utan anropare.
//
// VARFÖR DEN FINNS
// Månadskörningen (fakturering) SKAPAR underlagen men skickar dem
// inte. Studiehjälparen ska se vad hen kommer att få, och hinna säga
// ifrån, innan pengarna går den 25:e.
//
// SÄKERHET
// verify_jwt är PÅ. Det räcker inte: varje inloggad har en giltig
// JWT, och den här funktionen kan läsa vilket underlag som helst.
// Därför kontrolleras is_admin här inne, med anroparens egen token mot
// RLS, innan service_role används till något.
//
// Ordningen är hela poängen. service_role går förbi RLS. Skulle
// kontrollen ligga efter, eller bygga på något klienten skickat in,
// vore funktionen en öppen läsväg till alla studiehjälpares
// ersättningar för vem som helst med ett konto.
//
// INGEN RESERVAVSÄNDARE
// lead-notis faller tillbaka på onboarding@resend.dev när
// nextrum.se inte är verifierad. Det är rätt DÄR: en avisering till
// fel avsändare är bättre än ingen aning om att en familj hört av
// sig, och mejlet går ändå till oss. Här vore det fel: reservavsändaren
// når bara Resend-kontots EGEN adress, alltså inte studiehjälparen.
//
// Varje utskick bär en idempotensnyckel till Resend. Trycker någon två
// gånger i snabb följd, eller skickar två flikar samtidigt, skickar
// Resend bara det första.
// ============================================================

import { json, preflight, esc, epostOk } from '../_delad/http.ts';
import { kravAdmin, serviceklient } from '../_delad/auth.ts';
import { MANADER } from '../_delad/konstanter.ts';
import { skickaViaResend } from '../_delad/mejl.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const FRAN = 'Nextrum <no-reply@nextrum.se>';
const SVARA_TILL = 'info@nextrum.se';

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

function periodText(iso: string): string {
  const [ar, man] = String(iso).split('-').map(Number);
  return `${MANADER[man - 1]} ${ar}`;
}

function timmar(minuter: number): string {
  return (Number(minuter || 0) / 60).toLocaleString('sv-SE', { maximumFractionDigits: 2 }) + ' h';
}

// ------------------------------------------------------------
// Mejlet. Ett bord med raderna och en summa. Inga bilder och ingen
// extern CSS: ett underlag ska gå att läsa i vilken klient som helst,
// också en som blockerar allt.
// ------------------------------------------------------------
function utbetalningsMejl(u: any, rader: any[], namn: string) {
  const rubrik = `Ditt underlag för ${periodText(u.period)}`;

  const textRader = rader.map((r) =>
    `  ${r.beskrivning}  ·  ${timmar(r.minuter)}  ·  ${kronor(r.belopp_ore)}`).join('\n');

  const text =
    `${rubrik}\n\nHej ${namn}!\n\n` +
    `Här är underlaget för de pass du höll och rapporterade i ${periodText(u.period)}.\n\n` +
    `${textRader}\n\n` +
    `Totalt: ${kronor(u.belopp_ore)}  (${timmar(u.minuter)})\n\n` +
    `Ett pass räknas när du skrivit rapporten.\n\n` +
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
    `rapporten.</p>` +
    `<p style="margin:0;font-size:14px;color:#665C49">Stämmer något inte — svara på det här ` +
    `mejlet innan utbetalningen görs.</p></div>`;

  return { amne: `${rubrik} — Nextrum`, text, html };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
      return json({ error: 'SUPABASE_URL, SUPABASE_ANON_KEY eller SUPABASE_SERVICE_ROLE_KEY saknas på servern.' }, 500);
    }

    // ---------- 1. Vem frågar? ----------
    // Anroparens egen token mot Auth och RLS, i _delad/auth.ts.
    const vem = await kravAdmin(req.headers.get('Authorization'));
    if (!vem.ok) return vem.svar;

    // ---------- 2. Vad ska skickas? ----------
    const kropp = await req.json().catch(() => ({}));
    if (kropp?.typ !== 'utbetalning') {
      return json({
        error: 'Fakturor skapas och skickas i Wint sedan Fas 14.6. Lägg in fakturan där, och skriv in '
          + 'Wints fakturanummer under Ekonomi → Fakturor.',
      }, 409);
    }
    const id = String(kropp?.id ?? '').trim();
    const torrkorning = kropp?.torrkorning === true;

    if (!id) return json({ error: 'Ingen id angiven.' }, 400);

    // Först härifrån används service_role. Kontrollen ovan är redan
    // gjord; allt nedan går förbi RLS med flit, eftersom ett underlag
    // hör till en studiehjälpare som admin inte är part i.
    const db = serviceklient();

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

    const mottagare = String(p!.email).trim();
    const namn = String(p?.full_name ?? '').split(' ')[0] || 'du';
    const mejl = utbetalningsMejl(u, rader, namn);

    // Torrkörning: räkna ut allt, skicka ingenting. Gör den först,
    // en gång, så att man ser vad studiehjälparen faktiskt kommer att
    // läsa innan det ligger i hens inkorg.
    if (torrkorning) {
      return json({ ok: true, torrkorning: true, till: mottagare, amne: mejl.amne, text: mejl.text }, 200);
    }

    if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY saknas som secret.' }, 500);

    // ---------- 3. Skicka ----------
    // Samma nyckel för samma sak inom samma minut. Det stoppar ett
    // dubbelklick eller två flikar som skickar samtidigt, men låter ett
    // nytt försök efter ett rättat fel gå igenom — en nyckel som gällde
    // hela dygnet hade kunnat låsa fast ett misslyckat svar till nästa
    // dag.
    const minut = new Date().toISOString().slice(0, 16);
    const idempotens = `utbetalning-${u.id}-utskick-${minut}`;

    const svar = await skickaViaResend({
      fran: FRAN,
      till: [mottagare],
      svaraTill: [SVARA_TILL],
      amne: mejl.amne,
      text: mejl.text,
      html: mejl.html,
      idempotens,
    });

    if (svar.status === 403) {
      return json({
        error: 'Resend vägrar skicka från ' + FRAN + '. Domänen nextrum.se är inte verifierad. '
             + 'Ingenting har skickats.',
        orsak: await svar.text(),
      }, 502);
    }
    if (!svar.ok) {
      return json({ error: 'Resend svarade ' + svar.status + ': ' + (await svar.text()) }, 502);
    }
    const resendId = (await svar.json())?.id ?? null;

    // Underlaget ändrar ingen status: att visa ett underlag är inte att
    // godkänna det.
    return json({ ok: true, id: resendId, till: mottagare }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
