// ============================================================
// NEXTRUM — Edge Function: notis-ko
//
// Tömmer kön notis_utskick: mejl och SMS-påminnelser. Väcks av
// notis_minut() i databasen (via pg_net, knappen "Kör nu" i adminvyn
// och senare pg_cron), men bara när något faktiskt väntar.
//
// NAMNET ÄR TAGET ÖVER. Under samma namn låg en äldre kö i driften
// som aldrig fanns i git (supabase/funktioner-arkiv/notis-ko/). Den
// här koden ersätter den och talar med databasen genom de nya
// funktionerna från program 2 Fas 2.3: notis_utskick_ta (med
// mottagaren i svaret sedan 2.3d), notis_utskick_klar,
// notis_arbetare_klar och notis_avregistreringsnyckel. De gamla namnen
// (notis_hamta, notis_klar, notis_konfig.lage) används inte, och
// tabellen notis_utskick läses aldrig direkt.
//
// SÄKERHET: samma delade hemlighet som övriga notisfunktioner, i
// headern x-nextrum-notis, jämförd mot notis_konfig i konstant tid.
// verify_jwt är av (config.toml) eftersom anroparen är databasen,
// inte en inloggad användare. Funktionerna den anropar kan bara
// service_role köra.
//
// ALDRIG RÅA FEL UTÅT. Svaret hamnar i net._http_response, som flera
// roller kan läsa. Där står antal och en kort text, aldrig ett
// felmeddelande från databasen eller Resend.
//
// Själva arbetet ligger i _delad/notiser/ko.ts, med kön, Resend och
// 46elks som beroenden, så att det går att testa utan någon av dem.
// ============================================================

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import { CORS, db, hemlighetOk, json } from '../_delad/notis.ts';
import { preflight } from '../_delad/http.ts';
import { skickaViaResend } from '../_delad/mejl.ts';
import { skickaSms } from '../_delad/sms.ts';
import { korKon, type Summering, type UtskickRad } from '../_delad/notiser/ko.ts';

async function loggaKorning(klient: SupabaseClient, s: Summering, meddelande: string | null): Promise<void> {
  const { error } = await klient.rpc('notis_arbetare_klar', {
    p_behandlade: s.behandlade,
    p_skickade: s.skickade,
    p_misslyckade: s.misslyckade,
    p_meddelande: meddelande,
  });
  if (error) throw new Error('notis_arbetare_klar ' + (error.code ?? ''));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(CORS);
  if (req.method !== 'POST') return json({ error: 'Bara POST.' }, 405);

  let klient: SupabaseClient;
  try {
    klient = db();
    if (!await hemlighetOk(req, klient)) return json({ error: 'Fel eller saknad hemlighet.' }, 401);
  } catch {
    console.error('notis-ko: hemligheten gick inte att pröva');
    return json({ error: 'Tjänsten är inte tillgänglig just nu.' }, 500);
  }

  const noll: Summering = { behandlade: 0, skickade: 0, misslyckade: 0 };
  const avbryt = async (meddelande: string, svar: string) => {
    console.error('notis-ko: ' + meddelande);
    await loggaKorning(klient, noll, meddelande).catch(() => {});
    return json({ error: svar, ...noll }, 500);
  };

  // Före första raden: utan Resend-nyckel skulle varje mejl bli ett
  // fel och raderna brännas på fem försök. Hellre ingenting ur kön
  // och en rad i notis_korningar som säger varför.
  if (!Deno.env.get('RESEND_API_KEY')) {
    return await avbryt('RESEND_API_KEY saknas som secret. Inget togs ur kön.', 'Mejltjänsten är inte inställd.');
  }

  // Utan nyckeln går det inte att skriva en avregistreringslänk, och
  // ett notismejl utan en sådan ska inte gå ut alls.
  const { data: nyckel, error: nyckelFel } = await klient.rpc('notis_avregistreringsnyckel');
  if (nyckelFel || typeof nyckel !== 'string' || !nyckel) {
    return await avbryt('Avregistreringsnyckeln gick inte att läsa. Inget togs ur kön.', 'Nyckeln gick inte att läsa.');
  }

  const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');

  const resultat = await korKon({
    ta: async (max) => {
      const { data, error } = await klient.rpc('notis_utskick_ta', { p_max: max });
      if (error) throw new Error('notis_utskick_ta ' + (error.code ?? ''));
      return (data ?? []) as UtskickRad[];
    },
    klar: async (k) => {
      const { error } = await klient.rpc('notis_utskick_klar', {
        p_id: k.id,
        p_ok: k.ok,
        p_fel: k.fel,
        p_leverantor_id: k.leverantorId,
        p_permanent: k.permanent,
        p_loggad: k.loggad,
      });
      if (error) throw new Error('notis_utskick_klar ' + (error.code ?? ''));
    },
    arbetareKlar: (s, meddelande) => loggaKorning(klient, s, meddelande),
    skickaMejl: skickaViaResend,
    skickaSms: (s) => skickaSms(s),
    nyckel,
    funktionUrl: `${supabaseUrl}/functions/v1`,
  });

  const { behandlade, skickade, misslyckade } = resultat;
  if (resultat.fel) {
    return json({ error: 'Kön gick inte att tömma helt.', behandlade, skickade, misslyckade }, 500);
  }
  // Samma slags fel som en saknad RESEND_API_KEY ovan, och samma svar:
  // 500 syns i adminvyn under Fel, rutan Anrop som inte gick fram, och
  // skälet står i notis_korningar.
  if (resultat.mejlStoppat) {
    return json({ error: 'Mejltjänsten nekade nyckeln eller avsändardomänen.', behandlade, skickade, misslyckade }, 500);
  }
  return json({ behandlade, skickade, misslyckade }, 200);
});
