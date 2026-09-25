// ============================================================
// NEXTRUM — Edge Function: ansokan-notis (Fas 16.1)
//
// Skickar ETT besked till den som sökt jobb: kvittot, eller mejlet om
// ett steg framåt. Väcks av triggern ansokan_besked (och av
// omförsöksjobbet) med pg_net, med raden i ansokan_utskick som enda
// argument.
//
// DATABASEN BESTÄMMER, FUNKTIONEN SKICKAR
//
// Vilket steg, om det redan skickats, om ansökan hunnit avböjas eller
// mötet fått en nyare tid — allt det avgörs av ansokan_besked_ta(),
// som också lånar raden i två minuter. Får funktionen ingen rad
// tillbaka är beskedet redan hanterat, och den svarar 200 utan att
// göra något. Samma rad kan alltså väckas två gånger utan att mejlet
// går två gånger, och Resends idempotensnyckel är en andra spärr om
// lånet går ut mitt i ett anrop.
//
// SÄKERHET: samma delade hemlighet som notis-ko, i x-nextrum-notis,
// jämförd i konstant tid mot notis_konfig. verify_jwt är av
// (config.toml) eftersom anroparen är databasen. De två funktionerna
// den anropar kan bara service_role köra.
//
// ALDRIG RÅA FEL UTÅT, ALDRIG ADRESSER I LOGGEN. Svaret hamnar i
// net._http_response, som flera roller kan läsa. Loggen får radens id
// och steg, aldrig adress eller namn.
// ============================================================

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import { CORS, db, hemlighetOk, json } from '../_delad/notis.ts';
import { epostOk, preflight } from '../_delad/http.ts';
import { mejlfelSort, skickaViaResend } from '../_delad/mejl.ts';
import { KONTAKT } from '../_delad/notiser/rendera.ts';
import { ANSOKAN_FRAN, arAnsokanSteg, renderaAnsokan } from '../_delad/notiser/ansokan.ts';

/** Kortare än radens lån på två minuter, så att ett hängande anrop aldrig överlever lånet. */
const TIDSGRANS_MS = 8_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Rad = {
  id: string;
  steg: string;
  namn: string | null;
  epost: string | null;
  mote_tid: string | null;
  mote_lank: string | null;
  ombokat: boolean | null;
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
    console.error('ansokan-notis: hemligheten gick inte att pröva');
    return json({ error: 'Tjänsten är inte tillgänglig just nu.' }, 500);
  }

  // Före raden lånas: utan nyckel hade varje försök bränts på något
  // som rättas på ett ställe. Raden ligger kvar som 'vantar' och
  // omförsöksjobbet tar den när nyckeln finns.
  if (!Deno.env.get('RESEND_API_KEY')) {
    console.error('ansokan-notis: RESEND_API_KEY saknas som secret. Inget skickades.');
    return json({ error: 'Mejltjänsten är inte inställd.' }, 500);
  }

  const kropp = await req.json().catch(() => null) as { id?: unknown } | null;
  const id = typeof kropp?.id === 'string' && UUID.test(kropp.id) ? kropp.id : null;
  if (!id) return json({ error: 'Inget giltigt id.' }, 400);

  const { data, error } = await klient.rpc('ansokan_besked_ta', { p_id: id });
  if (error) {
    console.error('ansokan-notis: raden gick inte att ta', id, error.code ?? '');
    return json({ error: 'Raden gick inte att läsa.' }, 500);
  }
  const rad = (Array.isArray(data) ? data[0] : null) as Rad | null;
  if (!rad) return json({ ok: true, hanterad: 'redan skickad, avböjd eller ersatt' }, 200);

  const klar = async (ok: boolean, fel: string | null, leverantorId: string | null, permanent: boolean) => {
    const { error: e } = await klient.rpc('ansokan_besked_klar', {
      p_id: rad.id, p_ok: ok, p_fel: fel, p_leverantor_id: leverantorId, p_permanent: permanent,
    });
    if (e) console.error('ansokan-notis: utfallet gick inte att spara', rad.id, e.code ?? '');
  };

  if (!arAnsokanSteg(rad.steg)) {
    await klar(false, 'Okänt steg.', null, true);
    return json({ error: 'Okänt steg.' }, 400);
  }
  if (!epostOk(rad.epost)) {
    await klar(false, 'Ansökan har ingen giltig e-postadress.', null, true);
    return json({ ok: false, orsak: 'ogiltig adress' }, 200);
  }

  try {
    const m = renderaAnsokan({
      steg: rad.steg,
      namn: rad.namn,
      moteTid: rad.mote_tid,
      moteLank: rad.mote_lank,
      ombokat: rad.ombokat === true,
    });

    const svar = await skickaViaResend({
      fran: ANSOKAN_FRAN,
      till: [String(rad.epost).trim()],
      svaraTill: [KONTAKT],
      amne: m.amne,
      text: m.text,
      html: m.html,
      idempotens: `nextrum-ansokan-${rad.id}`,
      tidsgransMs: TIDSGRANS_MS,
    });

    if (svar.ok) {
      const j = await svar.json().catch(() => null) as { id?: unknown } | null;
      await klar(true, null, typeof j?.id === 'string' ? j.id : null, false);
      return json({ ok: true, steg: rad.steg }, 200);
    }

    // Statuskoden, aldrig kroppen: den upprepar adressen.
    const sort = mejlfelSort(svar.status);
    await klar(false, `Resend ${svar.status}`, null, sort === 'permanent');
    console.error('ansokan-notis:', rad.id, rad.steg, 'Resend', svar.status, sort);
    return json({ ok: false, orsak: `Resend ${svar.status}` }, 502);
  } catch (e) {
    const tidsgrans = (e as { name?: unknown } | null)?.name === 'TimeoutError';
    await klar(false, tidsgrans ? 'Resend svarade inte i tid.' : 'Resend gick inte att nå.', null, false);
    console.error('ansokan-notis:', rad.id, rad.steg, tidsgrans ? 'tidsgräns' : 'nätfel');
    return json({ ok: false, orsak: tidsgrans ? 'tidsgräns' : 'nätfel' }, 502);
  }
});
