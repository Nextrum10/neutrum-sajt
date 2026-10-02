// ============================================================
// NEXTRUM — Edge Function: admin-paminnelse (2026-10-02)
//
// Skickar ETT mejl till ledningen, av tre slag (admin_paminnelse_utskick.slag):
//
//   · direkt: en jobbansökan har kommit in. Väcks av triggern
//     intern.admin_ansokan_direkt() i samma stund.
//   · morgon: det som ligger kvar i Att göra kl. 9 svensk tid. Väcks av
//     intern.admin_paminnelse_kor() (pg_cron admin-paminnelse, var femte
//     minut, och bara timmen 9 skriver ett mejl).
//   · prov: morgonmejlet som testmejl, märkt som ett.
//
// Direkt och morgon väcks med pg_net, med raden i admin_paminnelse_utskick
// som enda argument; ett testmejl väcks av den som bett om det. Mottagarna är superadminarna (läses i databasen) och info@,
// som aviseringen om en intresseanmälan.
//
// DATABASEN BESTÄMMER, FUNKTIONEN SKICKAR
//
// Vad som är med, vilka som får det och om raden redan skickats avgörs
// av admin_paminnelse_ta(), som också lånar raden i två minuter. Får
// funktionen ingen rad tillbaka är det redan hanterat, och den svarar 200
// utan att göra något. Samma rad kan alltså väckas två gånger utan att
// mejlet går två gånger, och Resends idempotensnyckel är en andra spärr
// om lånet går ut mitt i ett anrop. Samma form som ansokan-notis.
//
// SÄKERHET: samma delade hemlighet som notis-ko, i x-nextrum-notis,
// jämförd i konstant tid mot notis_konfig. verify_jwt är av
// (config.toml) eftersom anroparen är databasen. De två funktionerna den
// anropar kan bara service_role köra.
//
// ALDRIG RÅA FEL UTÅT, ALDRIG ADRESSER I LOGGEN. Svaret hamnar i
// net._http_response, som flera roller kan läsa. Loggen får radens id,
// aldrig en adress, och mejlet innehåller antal och sorter, aldrig ett
// namn (_delad/notiser/admin.ts).
// ============================================================

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import { CORS, db, hemlighetOk, json } from '../_delad/notis.ts';
import { epostOk, preflight } from '../_delad/http.ts';
import { mejlfelSort, skickaViaResend } from '../_delad/mejl.ts';
import { ADMIN_EXTRA_TILL, ADMIN_FRAN, renderaAdminPaminnelse } from '../_delad/notiser/admin.ts';

/** Kortare än radens lån på två minuter, så att ett hängande anrop aldrig överlever lånet. */
const TIDSGRANS_MS = 8_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Rad = {
  id: string;
  till: string[] | null;
  antal: unknown;
  forsok: number | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(CORS);
  if (req.method !== 'POST') return json({ error: 'Bara POST.' }, 405);

  let klient: SupabaseClient;
  try {
    klient = db();
    if (!await hemlighetOk(req, klient)) return json({ error: 'Fel eller saknad hemlighet.' }, 401);
  } catch {
    console.error('admin-paminnelse: hemligheten gick inte att pröva');
    return json({ error: 'Tjänsten är inte tillgänglig just nu.' }, 500);
  }

  // Före raden lånas: utan nyckel hade varje försök bränts på något som
  // rättas på ett ställe. Raden ligger kvar som 'vantar' och jobbet tar
  // den igen när nyckeln finns.
  if (!Deno.env.get('RESEND_API_KEY')) {
    console.error('admin-paminnelse: RESEND_API_KEY saknas som secret. Inget skickades.');
    return json({ error: 'Mejltjänsten är inte inställd.' }, 500);
  }

  const kropp = await req.json().catch(() => null) as { id?: unknown } | null;
  const id = typeof kropp?.id === 'string' && UUID.test(kropp.id) ? kropp.id : null;
  if (!id) return json({ error: 'Inget giltigt id.' }, 400);

  const { data, error } = await klient.rpc('admin_paminnelse_ta', { p_id: id });
  if (error) {
    console.error('admin-paminnelse: raden gick inte att ta', id, error.code ?? '');
    return json({ error: 'Raden gick inte att läsa.' }, 500);
  }
  const rad = (Array.isArray(data) ? data[0] : null) as Rad | null;
  if (!rad) return json({ ok: true, hanterad: 'redan skickad eller slut på försök' }, 200);

  const klar = async (ok: boolean, fel: string | null, leverantorId: string | null, permanent: boolean) => {
    const { error: e } = await klient.rpc('admin_paminnelse_klar', {
      p_id: rad.id, p_ok: ok, p_fel: fel, p_leverantor_id: leverantorId, p_permanent: permanent,
    });
    if (e) console.error('admin-paminnelse: utfallet gick inte att spara', rad.id, e.code ?? '');
  };

  // En adress som inte ser giltig ut stoppar hela utskicket hos Resend
  // (422), så den sorteras bort här i stället för att ta de andra med sig.
  // Superadminarna och info@, utan dubbletter.
  const till = [...new Set([...(Array.isArray(rad.till) ? rad.till : []), ...ADMIN_EXTRA_TILL]
    .filter(epostOk).map((a) => String(a).trim().toLowerCase()))];
  if (!till.length) {
    await klar(false, 'Ingen mottagare med giltig adress.', null, true);
    console.error('admin-paminnelse: ingen mottagare', rad.id);
    return json({ ok: false, orsak: 'ingen mottagare' }, 200);
  }

  try {
    const m = renderaAdminPaminnelse(rad.antal);
    if (!m) {
      await klar(false, 'Inga giltiga sorter i raden.', null, true);
      return json({ ok: false, orsak: 'inget att skicka' }, 200);
    }

    const svar = await skickaViaResend({
      fran: ADMIN_FRAN,
      till,
      amne: m.amne,
      text: m.text,
      html: m.html,
      idempotens: `nextrum-admin-paminnelse-${rad.id}`,
      tidsgransMs: TIDSGRANS_MS,
    });

    if (svar.ok) {
      const j = await svar.json().catch(() => null) as { id?: unknown } | null;
      await klar(true, null, typeof j?.id === 'string' ? j.id : null, false);
      return json({ ok: true }, 200);
    }

    // Statuskoden, aldrig kroppen: den upprepar adresserna.
    const sort = mejlfelSort(svar.status);
    await klar(false, `Resend ${svar.status}`, null, sort === 'permanent');
    console.error('admin-paminnelse:', rad.id, 'Resend', svar.status, sort);
    return json({ ok: false, orsak: `Resend ${svar.status}` }, 502);
  } catch (e) {
    const tidsgrans = (e as { name?: unknown } | null)?.name === 'TimeoutError';
    await klar(false, tidsgrans ? 'Resend svarade inte i tid.' : 'Resend gick inte att nå.', null, false);
    console.error('admin-paminnelse:', rad.id, tidsgrans ? 'tidsgräns' : 'nätfel');
    return json({ ok: false, orsak: tidsgrans ? 'tidsgräns' : 'nätfel' }, 502);
  }
});
