// ============================================================
// NEXTRUM — Edge Function: admin-skapa (barnkonton_och_admin)
//
// Bjuder in en ny person som admin (väg A i adminvyn). Personen har
// inget konto: Supabase Auth skickar en inbjudan, personen väljer sitt
// lösenord via länken och landar i adminvyn. Ingen admin sätter någon
// annans lösenord. Har adressen redan ett konto svarar funktionen med
// ett fel som pekar på väg B, Befintlig användare, som går genom
// gor_till_admin direkt från vyn.
//
// SÄKERHET
// verify_jwt är PÅ. Anroparens token prövas mot Auth, och frågan om hen
// får ge behörigheterna ställs till databasen med HENNES token
// (admin_kan_ge). Rollen skrivs sedan med gor_till_admin och samma
// token, så att triggern admin_roller_vakt ser vem som ger vad och
// adminloggen får rätt namn. service_role används bara till det som
// kräver det: inbjudan, att se om adressen finns, adressen på profilen
// och att ta bort kontot igen om rollen nekas. Reglerna står i
// _delad/adminbehorighet.ts och provas i adminbehorighet_test.ts.
// ============================================================

import { json, preflight } from '../_delad/http.ts';
import { kravInloggad, serviceklient } from '../_delad/auth.ts';
import { hanteraNyAdmin, TILLBAKA_ADMIN } from '../_delad/adminbehorighet.ts';

function logga(vad: string, fel: unknown): string {
  const f = fel as { name?: unknown; code?: unknown; status?: unknown } | null;
  console.error(`admin-skapa ${vad}:`, String(f?.name ?? ''), String(f?.code ?? ''), String(f?.status ?? ''));
  return String((fel as { message?: unknown } | null)?.message ?? fel ?? 'fel');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Bara POST.' }, 405);

  try {
    const vem = await kravInloggad(req.headers.get('Authorization'));
    if (!vem.ok) return vem.svar;
    if (vem.appMetadata?.roll === 'barn') return json({ error: 'Den här funktionen är bara för admin.' }, 403);

    const db = serviceklient();
    const svar = await hanteraNyAdmin(await req.json().catch(() => null), {
      kanGe: async (a) => {
        const { data, error } = await vem.klient.rpc('admin_kan_ge', {
          p_behorigheter: a.behorigheter, p_superadmin: a.superadmin,
        });
        if (error) {
          logga('admin_kan_ge', error);
          return 'Adminbehörigheterna finns inte i databasen än, eller så gick frågan inte fram.';
        }
        return typeof data === 'string' && data ? data : null;
      },
      finnsKonto: async (epost) => {
        const { data, error } = await db.from('profiles').select('id').eq('email', epost).limit(1);
        if (error) throw new Error('profiles ' + (error.code ?? ''));
        return (data ?? []).length > 0;
      },
      bjudIn: async (a) => {
        const { data, error } = await db.auth.admin.inviteUserByEmail(a.epost, {
          data: { full_name: a.namn },
          redirectTo: TILLBAKA_ADMIN,
        });
        if (error) return { id: null, fel: logga('inbjudan', error) };
        return { id: data?.user?.id ?? null, fel: null };
      },
      sattAdressAdmin: async (id) => {
        const { error } = await db.from('profiles').update({ role: 'admin' }).eq('id', id);
        if (error) logga('roll', error);
      },
      gorTillAdmin: async (id, a) => {
        const { error } = await vem.klient.rpc('gor_till_admin', {
          p_user_id: id, p_behorigheter: a.behorigheter, p_superadmin: a.superadmin,
        });
        if (!error) return null;
        logga('gor_till_admin', error);
        // Databasens egna meddelanden är skrivna för att läsas i adminvyn.
        return error.message || 'Rollen gick inte att ge.';
      },
      taBortKonto: async (id) => {
        const { error } = await db.auth.admin.deleteUser(id);
        if (error) logga('ta bort', error);
      },
    });
    return json(svar.kropp, svar.status);
  } catch (e) {
    logga('oväntat', e);
    return json({ error: 'Något gick fel. Försök igen om en stund.' }, 500);
  }
});
