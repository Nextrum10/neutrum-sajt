// ============================================================
// NEXTRUM — delad hjälp: vem anropar?
//
// Tre funktioner kontrollerade is_admin på var sitt sätt, och två
// jämförde hemligheter med ===. Här finns en väg för varje fråga
// (Fas 3).
//
// Ordningen gäller överallt: anroparens EGEN token prövas mot Auth
// och RLS innan service_role används till något. service_role går
// förbi RLS, och en kontroll som ligger efter den är ingen kontroll.
// ============================================================

/* VERSIONEN ÄR PINNAD, och det är hela poängen.

   Raden löd förut @2 — alltså "vad esm.sh råkar mena med tvåan just
   nu". CI cachar ingenting och hämtar om vid varje körning, så den
   dagen paketets typer ändrades föll `deno check` med femton
   TS7006 i ekonomi och fakturering: .select() slutade ge data en typ,
   och det i filer ingen hade rört på flera veckor.

   Samma fälla som frontend redan gått i. Biblioteket där låg på
   unpkg som @2 och flyttade sig från 2.115.0 till 2.116.0 av sig
   själv under en timmes arbete; det ligger nu vendorat i
   bibliotek/supabase-js-2.116.0.js. Edge-funktionerna pinnas till
   SAMMA version, så att de två inte kan glida isär.

   Uppgradering är därmed ett beslut: byt versionen här och i
   bibliotek/, kör proven, driftsätt. Inte något som händer medan
   ingen tittar. */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import { json } from './http.ts';

/** Klient som agerar som den inloggade. RLS gäller. */
export function anvandarklient(authHeader: string): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
}

/** Klient med service_role. Går förbi RLS — använd först efter kontrollen. */
export function serviceklient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

export type Inloggad = { ok: true; anvandare: string; klient: SupabaseClient };
export type Nekad = { ok: false; svar: Response };

/** Kräver en giltig inloggning. Svarar med klienten som agerar som den inloggade. */
export async function kravInloggad(authHeader: string | null): Promise<Inloggad | Nekad> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, svar: json({ error: 'Du måste vara inloggad.' }, 401) };
  }
  const klient = anvandarklient(authHeader);
  const { data: u, error } = await klient.auth.getUser();
  if (error || !u?.user) {
    return { ok: false, svar: json({ error: 'Inloggningen gick inte att verifiera.' }, 401) };
  }
  return { ok: true, anvandare: u.user.id, klient };
}

/** Är den inloggade admin? Läst med den inloggades egen token. */
export async function arAdmin(klient: SupabaseClient, anvandare: string): Promise<boolean> {
  const { data } = await klient.from('profiles').select('is_admin').eq('id', anvandare).maybeSingle();
  return data?.is_admin === true;
}

/** Kräver en inloggad admin. */
export async function kravAdmin(authHeader: string | null): Promise<Inloggad | Nekad> {
  const vem = await kravInloggad(authHeader);
  if (!vem.ok) return vem;
  if (!await arAdmin(vem.klient, vem.anvandare)) {
    return { ok: false, svar: json({ error: 'Den här funktionen är bara för admin.' }, 403) };
  }
  return vem;
}

/** Jämför två hemligheter utan att svarstiden avslöjar hur mycket som stämde. */
export function lika(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let skillnad = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) skillnad |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return skillnad === 0;
}
