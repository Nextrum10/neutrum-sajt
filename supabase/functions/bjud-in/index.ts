// ============================================================
// NEXTRUM — Edge Function: bjud-in
//
// Skapar kontot åt den som tas in på plattformen: en familj ur en
// intresseanmälan (Ta in familjen) och en studiehjälpare ur en ansökan
// (Ta in i poolen), eller någon som aldrig gått de vägarna. Personen får
// ett mejl med en länk, trycker, väljer sitt lösenord två gånger och går
// igenom introduktionen (studievyn och studiehjälparvyn). Varför det är
// en länk och inte ett lösenord står i _delad/inbjudan.ts.
//
// Auth gör kontot och länken (generateLink) och mejlar inget; mejlet
// skickar funktionen själv genom Resend, med tiden i ämnet
// (_delad/notiser/konto.ts). Varför: _delad/inbjudan.ts.
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

import { json, preflight } from '../_delad/http.ts';
import { kravAdmin, serviceklient } from '../_delad/auth.ts';
import { hanteraInbjudan } from '../_delad/inbjudan.ts';
import { skickaViaResend } from '../_delad/mejl.ts';
import { KONTO_FRAN } from '../_delad/notiser/konto.ts';

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
        const { data, error } = await db.from('profiles').select('id, role, full_name').eq('email', epost)
          .maybeSingle();
        if (error) throw new Error('profiles ' + (error.code ?? ''));
        return data ? { id: String(data.id), roll: String(data.role ?? ''), namn: data.full_name ?? null } : null;
      },
      authKonto: async (id) => {
        const { data, error } = await db.auth.admin.getUserById(id);
        if (error || !data?.user) {
          if (error) logga('konto', error);
          return null;
        }
        const u = data.user;
        // Den senaste länken av vilket slag som helst: spärren gäller alla.
        const tider = [u.invited_at, u.confirmation_sent_at, u.recovery_sent_at]
          .map((t) => (t ? Date.parse(t) : NaN)).filter((t) => !Number.isNaN(t));
        return {
          bekraftad: !!u.email_confirmed_at,
          valkommen: u.user_metadata?.valkommen,
          senast: tider.length ? new Date(Math.max(...tider)).toISOString() : null,
        };
      },
      skapaLank: async (typ, epost, data, tillbaka) => {
        const { data: gjord, error } = typ === 'invite'
          ? await db.auth.admin.generateLink({ type: 'invite', email: epost, options: { data, redirectTo: tillbaka } })
          : await db.auth.admin.generateLink({ type: 'recovery', email: epost, options: { redirectTo: tillbaka } });
        if (error) return { id: null, lank: null, fel: logga('länk', error) };
        return { id: gjord?.user?.id ?? null, lank: gjord?.properties?.action_link ?? null, fel: null };
      },
      // Länken står i mejlet, så varken mejlet eller Resends svar loggas:
      // bara statusen när Resend säger nej.
      skicka: async (till, m) => {
        try {
          const resend = await skickaViaResend({
            fran: KONTO_FRAN, till: [till], amne: m.amne, text: m.text, html: m.html, tidsgransMs: 15_000,
          });
          if (resend.ok) return null;
          console.error('bjud-in mejl:', resend.status);
          return `Resend ${resend.status}`;
        } catch (e) {
          return logga('mejl', e);
        }
      },
      supabaseUrl: SUPABASE_URL,
      nu: () => new Date(),
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
