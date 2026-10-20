// ============================================================
// NEXTRUM — Edge Function: ansokan-mejl (2026-10-20)
//
// Mejlet vi skriver till den som sökt jobb, från rutan i adminvyns
// Rekrytering (Skriv till hen, Skicka utbildningen): admin redigerar
// och trycker Skicka, och mejlet går från info@nextrum.se genom Resend,
// med en hemlig kopia till info@. Varför och hur: _delad/ansokan_mejl.ts.
//
//   POST { ansokan, amne, text, forsok }  →  { ok: true, till }
//
// SÄKERHET
// verify_jwt är PÅ, och admin prövas här inne med anroparens egen
// token. Ansökan läses med samma token, så RLS avgör om den finns, och
// adressen kommer ur den raden, aldrig ur anropet. service_role används
// inte alls.
//
// Funktionen skickar ett riktigt mejl, och rutan är frågan före.
// ============================================================

import { json, preflight } from '../_delad/http.ts';
import { kravAdmin } from '../_delad/auth.ts';
import { ANSOKAN_MEJL_FRAN, hanteraBrev } from '../_delad/ansokan_mejl.ts';
import { skickaViaResend } from '../_delad/mejl.ts';
import { KONTAKT } from '../_delad/notiser/rendera.ts';

/* Varken adressen eller texten loggas: bara vad som gick fel. */
function logga(vad: string, fel: unknown): void {
  const f = fel as { name?: unknown; code?: unknown; status?: unknown } | null;
  console.error(`ansokan-mejl ${vad}:`, String(f?.name ?? ''), String(f?.code ?? ''), String(f?.status ?? ''));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Bara POST.' }, 405);

  try {
    const vem = await kravAdmin(req.headers.get('Authorization'));
    if (!vem.ok) return vem.svar;

    const svar = await hanteraBrev(await req.json().catch(() => ({})), {
      ansokan: async (id) => {
        const { data, error } = await vem.klient.from('applications').select('email').eq('id', id).maybeSingle();
        if (error) throw new Error('applications ' + (error.code ?? ''));
        return data ? { epost: data.email ?? null } : null;
      },
      skicka: async (m) => {
        try {
          const resend = await skickaViaResend({
            fran: ANSOKAN_MEJL_FRAN, till: [m.till], kopia: [KONTAKT],
            amne: m.amne, text: m.text, html: m.html,
            idempotens: m.idempotens ?? undefined, tidsgransMs: 15_000,
          });
          if (resend.ok) return null;
          logga('resend', { status: resend.status });
          return `Resend svarade ${resend.status}`;
        } catch (e) {
          logga('resend', e);
          return 'Resend svarade inte';
        }
      },
    });
    return json(svar.kropp, svar.status);
  } catch (e) {
    logga('oväntat', e);
    return json({ error: 'Något gick fel. Försök igen om en stund.' }, 500);
  }
});
