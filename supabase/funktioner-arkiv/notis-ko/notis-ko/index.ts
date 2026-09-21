// ============================================================
// NEXTRUM — Edge Function: notis-ko
//
// Tömmer notis_ko. Väcks varje minut av pg_cron
// (notis_vack_arbetaren), men bara när något faktiskt väntar.
//
// SÄKERHET: samma delade hemlighet som övriga notisfunktioner, i
// headern x-nextrum-notis, jämförd mot notis_konfig. verify_jwt är av
// eftersom anroparen är databasen, inte en inloggad användare.
//
// Ingenting här kan blockera en användare: händelsen är redan sparad
// när raden hamnade i kön. Går Resend ner ligger raden kvar och
// försöks igen med backoff (se notis_klar i v26).
// ============================================================

import { CORS, json, db, hemlighetOk } from '../_delad/notis.ts';
import { skickaViaResend } from '../_delad/mejl.ts';
import { lasKonfig } from '../_delad/notiser/konfig.ts';
import { korArbetare, type KoRad } from './arbetare.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const klient = db();
    if (!await hemlighetOk(req, klient)) return json({ error: 'Fel eller saknad hemlighet.' }, 401);

    const { data: kfg } = await klient.from('notis_konfig')
      .select('avanmal_nyckel, lage').eq('id', 1).maybeSingle();

    const konfig = lasKonfig(undefined, kfg?.lage ?? null);
    if (konfig.lage !== 'logg' && !Deno.env.get('RESEND_API_KEY')) {
      return json({ error: 'RESEND_API_KEY saknas som secret.' }, 500);
    }

    const summa = await korArbetare({
      konfig,
      avanmalNyckel: kfg?.avanmal_nyckel ?? null,
      hamta: async (max) => {
        const { data, error } = await klient.rpc('notis_hamta', { max_antal: max });
        if (error) throw new Error('notis_hamta: ' + error.message);
        return (data ?? []) as KoRad[];
      },
      klar: async (id, utfall, fel, resendId) => {
        const { error } = await klient.rpc('notis_klar',
          { p_id: id, p_utfall: utfall, p_fel: fel ?? null, p_resend_id: resendId ?? null });
        if (error) console.error(`notis_klar ${id}:`, error.message);
      },
      skicka: skickaViaResend,
    });

    return json({ ok: true, lage: konfig.lage, ...summa }, 200);
  } catch (fel) {
    return json({ error: String((fel as Error)?.message ?? fel) }, 500);
  }
});
