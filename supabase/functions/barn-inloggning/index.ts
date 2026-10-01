// ============================================================
// NEXTRUM — Edge Function: barn-inloggning (barnets_epost)
//
// Ett barn loggar in med sin egen, bekräftade e-post. Auth känner bara
// barnkontots tekniska adress, så funktionen slår upp den i databasen
// och loggar in med den hos Auth, och svarar med barnets session. Allt
// om varför och hur står i _delad/barninloggning.ts.
//
// SÄKERHET
// verify_jwt är AV (config.toml): den som loggar in har ingen session än.
// Det är samma läge som notis-avanmal: ingen anropares token att pröva,
// så service_role används till två funktioner och inget annat,
// barn_inloggning_uppslag och barn_inloggning_lyckades, som bara
// service_role kan köra. Den ena svarar med en teknisk adress eller ett
// nej och räknar försöket; den andra nollar räknaren. Lösenordet prövas
// av Auth med den publika nyckeln, som när barnet loggar in med sitt
// användarnamn.
//
// Auth ser edge-funktionens IP-nummer, inte barnets: att skicka med det
// riktiga kräver en ny sorts hemlig nyckel (Sb-Forwarded-For). Taket per
// nummer i databasen gör att en ensam angripare inte tömmer Auths kvot.
//
// ALDRIG I LOGGEN: adressen, lösenordet, IP-numret och felmeddelanden
// från Auth eller databasen, som kan upprepa adressen. Bara koder.
// ============================================================

import { serviceklient } from '../_delad/auth.ts';
import { type AuthSvar, hanteraBarnInloggning, type Uppslag } from '../_delad/barninloggning.ts';

const BAS = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
const PUBLIK = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

Deno.serve((req) => hanteraBarnInloggning(req, {
  uppslag: async (epost, ip) => {
    const { data, error } = await serviceklient().rpc('barn_inloggning_uppslag', { p_epost: epost, p_ip: ip });
    if (error) {
      console.error('barn-inloggning: uppslag', error.code ?? '');
      throw new Error('uppslag');
    }
    return data as Uppslag;
  },
  lyckades: async (e, i) => {
    const { error } = await serviceklient().rpc('barn_inloggning_lyckades', { p_e: e, p_i: i });
    if (error) console.error('barn-inloggning: lyckades', error.code ?? '');
  },
  loggaIn: async (adress, losenord): Promise<AuthSvar> => {
    const svar = await fetch(`${BAS}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: PUBLIK, 'content-type': 'application/json' },
      body: JSON.stringify({ email: adress, password: losenord }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!svar.ok) {
      await svar.body?.cancel().catch(() => {});
      if (svar.status >= 500) console.error('barn-inloggning: Auth', svar.status);
      return { ok: false, status: svar.status };
    }
    const j = await svar.json() as Record<string, unknown>;
    if (typeof j.access_token !== 'string' || typeof j.refresh_token !== 'string') {
      console.error('barn-inloggning: Auth svarade utan session');
      return { ok: false, status: 502 };
    }
    return {
      ok: true,
      session: {
        access_token: j.access_token,
        refresh_token: j.refresh_token,
        expires_in: typeof j.expires_in === 'number' ? j.expires_in : null,
        expires_at: typeof j.expires_at === 'number' ? j.expires_at : null,
        token_type: typeof j.token_type === 'string' ? j.token_type : 'bearer',
      },
    };
  },
  vanta: (ms) => new Promise((klar) => setTimeout(klar, ms)),
  nu: () => Date.now(),
}));
