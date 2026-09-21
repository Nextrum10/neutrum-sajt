// ============================================================
// NEXTRUM — Edge Function: bjud-in
//
// Bjuder in en familj som hört av sig men inte har något konto, eller
// en studiehjälpare som redan arbetar för Nextrum men aldrig ansökt
// via sajten. Anropas från adminvyn: rutan "Skapa elev ur anmälan",
// "Ny familj" och "Lägg till studiehjälpare".
//
// VARFÖR DEN FINNS
// En elev hänger på ett parent_id, och ett parent_id är en rad i
// profiles som bara skapas när någon får ett konto. Tratten stannade
// därför vid en intresseanmälan från en familj som aldrig registrerat
// sig: adminvyn kunde inte skapa eleven, och fick be familjen gå in
// på nextrum.se och registrera sig själv.
//
// Nu skickar Supabase Auth en inbjudan. Personen väljer sitt lösenord
// via länken, kontot skapas, och triggern handle_new_user gör
// profilraden. Samma sak gällde studiehjälparna: poolen var bara nåbar
// för den som själv registrerat sig och skickat in en ansökan, så en
// befintlig anställd gick inte att lägga in (program 2, Fas 1).
//
// SÄKERHET
// verify_jwt är PÅ, och admin kontrolleras här inne med anroparens
// egen token innan service_role används.
//
// ROLLEN VITLISTAS HÄR, aldrig vidare från anropet. Den hamnar i
// metadatan, och handle_new_user läser rollen därifrån. Två värden
// finns: 'parent' och 'tutor'. Allt annat blir 'parent'. is_admin går
// inte att sätta via metadata över huvud taget — den skyddas av
// skydda_profilfalt, och sedan Fas 1.8 blir en profil aldrig ens
// role='admin' av en registrering.
//
// En inbjuden studiehjälpare hamnar i väntläge (tutor_profiles.status
// 'pending', satt av handle_new_user). Att hen blir godkänd, och
// därmed går att matcha, är ett eget steg i adminvyn — och sedan Fas
// 1.5 kan ingen elev matchas med någon som inte är godkänd.
//
// Funktionen skickar ett riktigt mejl. Adminvyn frågar därför först.
// ============================================================

import { json, preflight, epostOk } from '../_delad/http.ts';
import { kravAdmin, serviceklient } from '../_delad/auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

// Dit länken i mejlet leder när lösenordet är valt, per roll.
// Adresserna måste finnas bland de tillåtna i Supabase Auth; annars
// används Site URL.
const TILLBAKA: Record<string, string> = {
  parent: 'https://nextrum.se/foralder',
  tutor: 'https://nextrum.se/larare',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
      return json({ error: 'SUPABASE_URL, SUPABASE_ANON_KEY eller SUPABASE_SERVICE_ROLE_KEY saknas på servern.' }, 500);
    }

    // ---------- 1. Vem frågar? ----------
    const vem = await kravAdmin(req.headers.get('Authorization'));
    if (!vem.ok) return vem.svar;

    // ---------- 2. Vem bjuds in? ----------
    const kropp = await req.json().catch(() => ({}));
    const epost = String(kropp?.epost ?? '').trim().toLowerCase();
    const namn = String(kropp?.namn ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const roll = kropp?.roll === 'tutor' ? 'tutor' : 'parent';
    const leadId = roll === 'parent' && kropp?.lead_id ? String(kropp.lead_id) : null;

    if (!epostOk(epost)) return json({ error: 'Adressen ser inte ut som en e-postadress.' }, 400);

    const db = serviceklient();

    // Finns kontot redan ska det användas, inte bjudas in en gång till.
    const { data: finns } = await db.from('profiles').select('id').eq('email', epost).maybeSingle();
    if (finns) {
      return json({
        error: roll === 'tutor'
          ? 'Det finns redan ett konto med den adressen. Är det en studiehjälpare går hen att godkänna i listan Studiehjälpare.'
          : 'Det finns redan ett konto med den adressen. Välj det i listan.',
      }, 409);
    }

    // ---------- 3. Skicka ----------
    const { data, error } = await db.auth.admin.inviteUserByEmail(epost, {
      data: { role: roll, full_name: namn },
      redirectTo: TILLBAKA[roll],
    });

    if (error) {
      const redan = /already|registered|exists/i.test(error.message);
      return json({
        error: redan
          ? 'Det finns redan ett konto med den adressen.'
          : 'Inbjudan gick inte att skicka: ' + error.message,
      }, redan ? 409 : 502);
    }

    // Anmälan är kontaktad nu. Står den kvar som ny ligger den kvar i
    // arbetskön fast någon redan agerat på den.
    if (leadId) {
      await db.from('leads')
        .update({ status: 'contacted', kontaktad_at: new Date().toISOString() })
        .eq('id', leadId)
        .eq('status', 'new');
    }

    return json({ ok: true, id: data?.user?.id ?? null, till: epost, roll }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
