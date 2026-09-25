// ============================================================
// NEXTRUM — delad hjälp: Nextrums Google-konto (Fas 18.1)
//
// Raden i google_koppling och statusen i integrationer. google.ts
// pratar med Google; den här filen håller reda på hur det gick, så att
// adminvyn kan säga det. google-koppla och google-meet går båda genom
// den, så att "hur ser ett fel ut i statusen" bara står på ett ställe.
//
//
// ETT FEL BETYDER INTE ATT KOPPLINGEN ÄR BORTA
//
// Regeln stod i INTEGRATIONER.md långt innan något var kopplat: går
// något fel sätts senaste_fel, och kopplad lämnas som den är. Att slå
// om till "inte kopplad" vid varje hicka gör statusen oläslig.
//
// Undantaget är när Googles tokenändpunkt säger invalid_grant. Då
// finns kopplingen inte längre — den har dragits tillbaka hos Google,
// eller kontot har ändrats — och ingenting härifrån kan väcka den.
// Att låta kortet stå kvar på Kopplad vore att ljuga, så raden tas
// bort och statusen säger varför.
//
//
// BARA DEN TOKEN SOM FÖLL TAS BORT
//
// Ett anrop som läste tokenen, fick invalid_grant och sedan tar bort
// raden kan krocka med en admin som just kopplat om. Borttagningen
// gäller därför bara raden med exakt den token som föll. Har någon
// hunnit koppla om står den nya kvar, och statusen rörs inte.
// ============================================================

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import { feltext, fornya, GoogleFel, type Hamta, type Klient } from './google.ts';

const TJANST = 'google_workspace';

export type Koppling = { konto: string; refresh: string };

export async function lasKoppling(db: SupabaseClient): Promise<Koppling | null> {
  const { data, error } = await db.from('google_koppling')
    .select('konto, refresh_token').eq('id', true).maybeSingle();
  if (error) throw new Error('google_koppling gick inte att läsa: ' + error.message);
  if (!data) return null;
  return { konto: String(data.konto), refresh: String(data.refresh_token) };
}

/* Statusraden skrivs efter att något hänt hos Google. Går själva
   skrivningen fel ska det inte ta med sig svaret till den som väntar
   på en länk; felet hamnar i funktionens logg. */
async function status(db: SupabaseClient, falt: Record<string, unknown>): Promise<void> {
  const { error } = await db.from('integrationer')
    .update({ ...falt, uppdaterad: new Date().toISOString() }).eq('tjanst', TJANST);
  if (error) console.error('integrationer gick inte att skriva:', error.message);
}

export async function skrivFel(db: SupabaseClient, text: string): Promise<void> {
  await status(db, { senaste_fel: String(text).slice(0, 600) });
}

export async function skrivLyckat(db: SupabaseClient): Promise<void> {
  await status(db, { senaste_synk: new Date().toISOString(), senaste_fel: null });
}

/** Sparar tokenen och säger Kopplad. En rad, aldrig fler: primärnyckeln är alltid true. */
export async function sparaKoppling(
  db: SupabaseClient,
  k: { konto: string; refresh: string; scopes: string; admin: string },
): Promise<void> {
  const nu = new Date().toISOString();
  const { error } = await db.from('google_koppling').upsert({
    id: true, konto: k.konto, refresh_token: k.refresh, scopes: k.scopes, kopplad_at: nu,
  }, { onConflict: 'id' });
  if (error) throw new Error('Kopplingen gick inte att spara: ' + error.message);
  await status(db, {
    kopplad: true, konto: k.konto, kopplad_av: k.admin, kopplad_at: nu, senaste_fel: null,
  });
}

/**
 * Tar bort kopplingen och säger Inte kopplad.
 *
 * Med endastToken tas raden bort bara om den fortfarande bär just den
 * tokenen (se filhuvudet), och statusen rörs bara om något togs bort.
 */
export async function kopplaBort(
  db: SupabaseClient,
  fel: string | null,
  endastToken?: string,
): Promise<boolean> {
  let fraga = db.from('google_koppling').delete().eq('id', true);
  if (endastToken) fraga = fraga.eq('refresh_token', endastToken);
  const { data, error } = await fraga.select('id');
  if (error) throw new Error('Kopplingen gick inte att ta bort: ' + error.message);
  const borttagen = Array.isArray(data) && data.length > 0;
  if (borttagen || !endastToken) {
    await status(db, {
      kopplad: false, konto: null, kopplad_av: null, kopplad_at: null,
      senaste_fel: fel === null ? null : String(fel).slice(0, 600),
    });
  }
  return borttagen;
}

export type Atkomst =
  | { ok: true; konto: string; token: string }
  | { ok: false; kopplad: boolean; text: string };

/**
 * En åtkomst till kontot i en timme, eller varför det inte gick.
 *
 * Skriver statusen själv när något är fel, så att den som anropar bara
 * behöver välja vad hen svarar sin egen anropare.
 */
export async function atkomstTillKontot(
  db: SupabaseClient,
  klient: Klient | null,
  hamta: Hamta = fetch,
): Promise<Atkomst> {
  const k = await lasKoppling(db);
  if (!k) return { ok: false, kopplad: false, text: 'Google är inte kopplat.' };

  if (!klient) {
    const text = 'GOOGLE_KLIENT_ID eller GOOGLE_KLIENT_HEMLIGHET saknas bland funktionernas secrets i Supabase.';
    await skrivFel(db, text);
    return { ok: false, kopplad: true, text };
  }

  try {
    return { ok: true, konto: k.konto, token: await fornya(k.refresh, klient, hamta) };
  } catch (e) {
    const text = feltext(e);
    if (e instanceof GoogleFel && e.sort === 'utgangen') {
      await kopplaBort(db, text, k.refresh);
      return { ok: false, kopplad: false, text };
    }
    await skrivFel(db, text);
    return { ok: false, kopplad: true, text };
  }
}
