// ============================================================
// NEXTRUM — Edge Function: bjud-in
//
// Skapar kontot åt den som tas in på plattformen: en familj ur en
// intresseanmälan (Ta in familjen) och en studiehjälpare ur en ansökan
// (Ta in i poolen), eller någon som aldrig gått de vägarna. Personen får
// ett mejl från Supabase Auth med en länk, trycker, väljer sitt lösenord
// två gånger och går igenom introduktionen (studievyn och
// studiehjälparvyn). Varför det är en länk och inte ett lösenord står i
// _delad/inbjudan.ts.
//
// VARFÖR DEN FINNS
// En elev hänger på ett parent_id, och ett parent_id är en rad i
// profiles som bara skapas när någon får ett konto. Tratten stannade
// därför vid en intresseanmälan från en familj som aldrig registrerat
// sig, och poolen var bara nåbar för den som själv registrerat sig efter
// sin ansökan (program 2, Fas 1). Leo 2026-10-06: "när man ska ta in en
// anställd är det krångligt att skapa konto åt den, samma med familj".
// Nu skapar adminvyn kontot i samma tryck som personen tas in.
//
// Med igen: true skickas länken en gång till (Skicka inbjudan igen i
// adminvyn); vad som skickas beror på hur långt personen kommit.
//
// SÄKERHET
// verify_jwt är PÅ, och admin kontrolleras här inne med anroparens
// egen token innan service_role används.
//
// ROLLEN VITLISTAS, aldrig vidare från anropet. Den hamnar i
// metadatan, och handle_new_user läser rollen därifrån. Två värden
// finns: 'parent' och 'tutor'. Allt annat blir 'parent'. is_admin går
// inte att sätta via metadata över huvud taget — den skyddas av
// skydda_profilfalt, och sedan Fas 1.8 blir en profil aldrig ens
// role='admin' av en registrering.
//
// En inbjuden studiehjälpare hamnar i väntläge (tutor_profiles.status
// 'pending', satt av handle_new_user). Att hen blir godkänd, och
// därmed går att matcha, är ett eget steg — Ta in i poolen gör det i
// samma tryck — och sedan Fas 1.5 kan ingen elev matchas med någon som
// inte är godkänd.
//
// Funktionen skickar ett riktigt mejl. Adminvyn frågar därför först.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import { json, preflight } from '../_delad/http.ts';
import { kravAdmin, serviceklient } from '../_delad/auth.ts';
import { hanteraInbjudan } from '../_delad/inbjudan.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

function logga(vad: string, fel: unknown): string {
  const f = fel as { name?: unknown; code?: unknown; status?: unknown } | null;
  console.error(`bjud-in ${vad}:`, String(f?.name ?? ''), String(f?.code ?? ''), String(f?.status ?? ''));
  return String((fel as { message?: unknown } | null)?.message ?? fel ?? 'fel');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
      return json({ error: 'SUPABASE_URL, SUPABASE_ANON_KEY eller SUPABASE_SERVICE_ROLE_KEY saknas på servern.' }, 500);
    }

    // ---------- 1. Vem frågar? ----------
    const vem = await kravAdmin(req.headers.get('Authorization'));
    if (!vem.ok) return vem.svar;

    // ---------- 2. Vem tas in, och vad skickas ----------
    const db = serviceklient();
    const svar = await hanteraInbjudan(await req.json().catch(() => ({})), {
      kontoMedAdress: async (epost) => {
        const { data, error } = await db.from('profiles').select('id, role').eq('email', epost).maybeSingle();
        if (error) throw new Error('profiles ' + (error.code ?? ''));
        return data ? { id: String(data.id), roll: String(data.role ?? '') } : null;
      },
      authKonto: async (id) => {
        const { data, error } = await db.auth.admin.getUserById(id);
        if (error || !data?.user) {
          if (error) logga('konto', error);
          return null;
        }
        return { bekraftad: !!data.user.email_confirmed_at, valkommen: data.user.user_metadata?.valkommen };
      },
      bjudIn: async (epost, data, tillbaka) => {
        const { data: ny, error } = await db.auth.admin.inviteUserByEmail(epost, { data, redirectTo: tillbaka });
        if (error) return { id: null, fel: logga('inbjudan', error) };
        return { id: ny?.user?.id ?? null, fel: null };
      },
      // Samma länk som Glömt lösenordet ger, genom Auths öppna väg: den
      // skickas med Reset password-mallen och har samma tak per adress.
      losenordslank: async (epost, tillbaka) => {
        const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
        const { error } = await anon.auth.resetPasswordForEmail(epost, { redirectTo: tillbaka });
        return error ? logga('lösenordslänk', error) : null;
      },
      kontaktad: async (leadId) => {
        const { error } = await db.from('leads')
          .update({ status: 'contacted', kontaktad_at: new Date().toISOString() })
          .eq('id', leadId)
          .eq('status', 'new');
        if (error) logga('anmälan', error);
      },
    });
    return json(svar.kropp, svar.status);
  } catch (e) {
    logga('oväntat', e);
    return json({ error: 'Något gick fel. Försök igen om en stund.' }, 500);
  }
});
