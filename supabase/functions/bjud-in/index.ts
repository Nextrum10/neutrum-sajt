// ============================================================
// NEXTRUM — Edge Function: bjud-in
//
// Bjuder in en familj som hört av sig men inte har något konto.
// Anropas av knappen i rutan "Skapa elev ur anmälan" i adminvyn.
//
// VARFÖR DEN FINNS
// En elev hänger på ett parent_id, och ett parent_id är en rad i
// profiles som bara skapas när någon får ett konto. Tratten stannade
// därför vid en intresseanmälan från en familj som aldrig registrerat
// sig: adminvyn kunde inte skapa eleven, och fick be familjen gå in
// på nextrum.se och registrera sig själv.
//
// Nu skickar Supabase Auth en inbjudan. Familjen väljer sitt lösenord
// via länken, kontot skapas, och triggern handle_new_user gör
// profilraden — med rollen förälder, aldrig något annat.
//
// SÄKERHET
// verify_jwt är PÅ, och admin kontrolleras här inne med anroparens
// egen token innan service_role används. Inbjudan kan bara ge rollen
// 'parent'. is_admin går inte att sätta via metadata över huvud
// taget — den skyddas av skydda_profilfalt.
//
// Funktionen skickar ett riktigt mejl. Adminvyn frågar därför först.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

// Dit länken i mejlet leder när lösenordet är valt. Adressen måste
// finnas bland de tillåtna i Supabase Auth; annars används Site URL.
const TILLBAKA = 'https://nextrum.se/foralder';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

function epostOk(v: unknown): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? '').trim());
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
      return json({ error: 'SUPABASE_URL, SUPABASE_ANON_KEY eller SUPABASE_SERVICE_ROLE_KEY saknas på servern.' }, 500);
    }

    // ---------- 1. Vem frågar? ----------
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return json({ error: 'Ingen inloggning.' }, 401);

    const somAnvandare = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    });
    const { data: jag, error: jagFel } = await somAnvandare.auth.getUser();
    if (jagFel || !jag?.user) return json({ error: 'Inloggningen gick inte att verifiera.' }, 401);

    const { data: profil } = await somAnvandare
      .from('profiles').select('is_admin').eq('id', jag.user.id).maybeSingle();
    if (!profil?.is_admin) return json({ error: 'Bara admin kan bjuda in.' }, 403);

    // ---------- 2. Vem bjuds in? ----------
    const kropp = await req.json().catch(() => ({}));
    const epost = String(kropp?.epost ?? '').trim().toLowerCase();
    const namn = String(kropp?.namn ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const leadId = kropp?.lead_id ? String(kropp.lead_id) : null;

    if (!epostOk(epost)) return json({ error: 'Adressen ser inte ut som en e-postadress.' }, 400);

    const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Finns kontot redan ska det användas, inte bjudas in en gång till.
    const { data: finns } = await db.from('profiles').select('id').eq('email', epost).maybeSingle();
    if (finns) return json({ error: 'Det finns redan ett konto med den adressen. Välj det i listan.' }, 409);

    // ---------- 3. Skicka ----------
    const { data, error } = await db.auth.admin.inviteUserByEmail(epost, {
      data: { role: 'parent', full_name: namn },
      redirectTo: TILLBAKA,
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

    return json({ ok: true, id: data?.user?.id ?? null, till: epost }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
