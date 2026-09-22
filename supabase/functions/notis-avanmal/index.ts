// ============================================================
// NEXTRUM — Edge Function: notis-avanmal
//
// Stänger av en sorts notis i en kanal för en person, utifrån
// tokenen i mejlets länk. Bara POST avregistrerar: från
// nextrum.se/avanmal efter ett knapptryck, eller från mejlprogrammets
// "Avsluta prenumeration" (List-Unsubscribe-Post, RFC 8058). GET och
// HEAD skickas vidare med 303 till nextrum.se/avanmal med samma token,
// så att länkskannrar inte avregistrerar någon men en människa som
// öppnat adressen i webbläsaren kommer fram till knappen.
//
// NAMNET ÄR TAGET ÖVER. Under samma namn låg en äldre version i
// driften (supabase/funktioner-arkiv/notis-avanmal/), som läste
// notis_konfig.avanmal_nyckel och stängde av allt på en gång. Den här
// läser nyckeln genom notis_avregistreringsnyckel() och stänger bara
// av det tokenen pekar ut, genom notis_avregistrera().
//
// SÄKERHET: verify_jwt är av (config.toml), för länken måste fungera
// utan inloggning. Det som skyddar är HMAC-signaturen i tokenen
// (_delad/notiser/token.ts). service_role används bara till de två
// funktionerna ovan, som bara kan läsa nyckeln och stänga av, aldrig
// slå på, och som aldrig rör profiles.
// ============================================================

import { serviceklient } from '../_delad/auth.ts';
import { hanteraAvregistrering } from '../_delad/notiser/avanmal.ts';

Deno.serve((req) => hanteraAvregistrering(req, {
  nyckel: async () => {
    const { data, error } = await serviceklient().rpc('notis_avregistreringsnyckel');
    if (error || typeof data !== 'string' || !data) throw new Error('nyckeln gick inte att läsa');
    return data;
  },
  avregistrera: async (uid, typ, kanal) => {
    const { error } = await serviceklient().rpc('notis_avregistrera', { p_profil: uid, p_typ: typ, p_kanal: kanal });
    if (!error) return 'ok';
    // 22023: kontot finns inte längre (eller en typ databasen inte
    // känner igen). Det är länken som är fel, inte servern.
    if (error.code === '22023') return 'ogiltig';
    console.error('notis-avanmal: notis_avregistrera', error.code ?? '');
    return 'fel';
  },
}));
