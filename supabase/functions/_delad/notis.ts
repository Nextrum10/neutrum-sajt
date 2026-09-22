// ============================================================
// NEXTRUM — delad hjälp för notisfunktionerna
//
// Två saker som lead-notis, pass-notis och meddelande-notis alla
// behöver: kontrollera den delade hemligheten, och skicka ett mejl
// via Resend.
//
//
// HEMLIGHETEN LIGGER I EN TABELL, INTE I EN SECRET
//
// notis_konfig (schema-v17) har en rad med hemligheten. Skälet står
// i den migrationen: en secret och en webhook-header i två olika
// fönster glider isär, och funktionen svarar då 401 på varje
// anmälan som kommer in emellan — de mejlen kommer aldrig.
//
// I en tabell byts båda i SAMMA transaktion. Och det som kanske
// väger tyngst i praktiken: ingen behöver besöka dashboarden och
// klistra in en sträng för hand, vilket är precis där den förra
// hemligheten blev den bokstavliga texten "openssl rand -hex 32".
//
// Tabellen har RLS på och noll policyer. Bara service_role ser den.
//
// Sedan Fas 3 bygger modulen på http.ts, auth.ts och mejl.ts, som
// alla funktioner delar. Exporterna här är desamma som förut.
// ============================================================

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import { cors, json as jsonMed, esc as escHtml } from './http.ts';
import { lika, serviceklient } from './auth.ts';
import { skickaViaResend } from './mejl.ts';
import { MANADER } from './konstanter.ts';

export const CORS = cors('x-nextrum-notis');

export function json(body: unknown, status: number) {
  return jsonMed(body, status, CORS);
}

export const esc = escHtml;

export function datumText(iso: string): string {
  const [, m, d] = String(iso).split('-');
  return `${Number(d)} ${MANADER[Number(m) - 1] ?? ''}`;
}

/** Klient med service_role. Den enda som ser notis_konfig. */
export function db(): SupabaseClient {
  if (!Deno.env.get('SUPABASE_URL') || !Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    throw new Error('SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY saknas.');
  }
  return serviceklient();
}

/**
 * Jämför headern mot hemligheten i notis_konfig, i konstant tid.
 *
 * FEL HEMLIGHET OCH TRASIG LÄSNING ÄR INTE SAMMA SAK
 *
 * En anropare utifrån ska få samma svar oavsett hur servern mår —
 * därför säger 401 aldrig något om varför. Men om TABELLEN inte går
 * att läsa är det inte ett svar om hemligheten alls, det är att
 * servern är trasig. Funktionen kastar då i stället, och anroparen
 * får 500.
 *
 * Skillnaden spelar roll just här: triggern sväljer felet, så det
 * enda spåret som blir kvar är statuskoden i net._http_response. En
 * 401 där läser man som "någon knackade med fel nyckel" och lägger
 * ner. En 500 läser man som "gå och titta". Att låta det ena se ut
 * som det andra är precis hur den förra hemligheten kunde vara ordet
 * "openssl rand -hex 32" i ett halvår utan att någon märkte något.
 *
 * Ett omförsök innan dess. Första anropet mot en nyss driftsatt
 * funktion sker i en kall isolat där nätet inte alltid är uppe, och
 * en notis ska inte falla bort för att den råkade vara först.
 */
export async function hemlighetOk(req: Request, klient: SupabaseClient): Promise<boolean> {
  const header = req.headers.get('x-nextrum-notis');
  if (!header) return false;

  let senasteFel = '';
  for (let forsok = 1; forsok <= 2; forsok++) {
    const { data, error } = await klient
      .from('notis_konfig').select('hemlighet').eq('id', 1).maybeSingle();

    if (!error && data?.hemlighet) return lika(header, data.hemlighet);

    senasteFel = error?.message ?? 'raden saknas';
    console.error(`notis_konfig gick inte att läsa (försök ${forsok}):`, senasteFel);
    if (forsok === 1) await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('notis_konfig gick inte att läsa: ' + senasteFel);
}

const FRAN = 'Nextrum <no-reply@nextrum.se>';
const RESERV_FRAN = 'Nextrum <onboarding@resend.dev>';

// Resends testavsändare når BARA kontots egen adress. Till en familj
// eller en studiehjälpare går reserven aldrig fram, och försöket gömde
// bara det egentliga felet — att vår egen domän inte är verifierad.
// Reserven används därför bara när mottagaren är vi.
const RESERV_NAR = ['info@nextrum.se'];

/**
 * Skickar via Resend, med fallback till deras testdomän när vår
 * egen inte är verifierad (403) och mejlet går till Nextrum självt.
 * Allt annat är ett riktigt fel och ska synas som det.
 */
export async function skickaMejl(o: {
  till: string; amne: string; text: string; html: string; svaraTill?: string;
}): Promise<Response> {
  if (!Deno.env.get('RESEND_API_KEY')) return json({ error: 'RESEND_API_KEY saknas som secret.' }, 500);

  const skicka = (avsandare: string) => skickaViaResend({
    fran: avsandare,
    till: [o.till],
    svaraTill: o.svaraTill ? [o.svaraTill] : undefined,
    amne: o.amne,
    text: o.text,
    html: o.html,
  });

  const svar = await skicka(FRAN);
  if (svar.status === 403) {
    const orsak = await svar.text();
    if (!RESERV_NAR.includes(o.till.trim().toLowerCase())) {
      return json({ error: 'Resend vägrar skicka från ' + FRAN + ', och reservavsändaren når inte '
        + 'den här mottagaren. Ingenting skickades.', orsak }, 502);
    }
    const reserv = await skicka(RESERV_FRAN);
    if (reserv.ok) return json({ skickat: true, avsandare: RESERV_FRAN, notering: orsak }, 200);
    return json({ error: 'Kunde inte skicka: ' + (await reserv.text()) }, 502);
  }
  if (!svar.ok) return json({ error: 'Kunde inte skicka: ' + (await svar.text()) }, 502);
  return json({ skickat: true, avsandare: FRAN }, 200);
}
