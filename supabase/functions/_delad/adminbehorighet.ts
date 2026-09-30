// ============================================================
// NEXTRUM — adminbehörigheterna, utan nät (barnkonton_och_admin)
//
// Edge-funktionen admin-skapa bjuder in en ny person som admin. Det
// som går att pröva utan databasen och Auth står här, och hanteringen
// tar omvärlden som beroenden (som notiser/ko.ts), så att
// adminbehorighet_test.ts kan köra varje väg.
//
// REGLERNA STÅR I DATABASEN. Vem som får ge vad avgörs av triggern
// admin_roller_vakt; admin_kan_ge frågas bara först, så att en inbjudan
// inte skickas till någon som sedan inte får rollen. Rollen skrivs med
// gor_till_admin och ANROPARENS token, aldrig med service_role, så att
// databasen ser vem som ger behörigheten.
//
// Listan över behörigheter finns på tre ställen till: i migrationen
// (villkoret och intern.admin_behorigheter), och i adminvyn
// (nextrum-admin-behorighet.js). verktyg/kolla-behorigheter.py jämför dem.
// ============================================================

import { epostOk } from './http.ts';
import { arBarnadress } from './barnkonto.ts';

export const BEHORIGHETER = [
  'leads', 'matchning', 'anvandare_las', 'anvandare_redigera', 'studiehjalpare_godkann',
  'bokningar_las', 'rapporter_las', 'notiskonfig', 'admin_hantera',
] as const;
export type Behorighet = typeof BEHORIGHETER[number];

/** Dit länken i inbjudan leder. Måste stå bland Redirect URLs i Supabase Auth. */
export const TILLBAKA_ADMIN = 'https://nextrum.se/admin';

export type NyAdmin = { epost: string; namn: string; behorigheter: Behorighet[]; superadmin: boolean };

export function tolkaNyAdmin(kropp: unknown): { ok: true; admin: NyAdmin } | { ok: false; fel: string } {
  const k = kropp && typeof kropp === 'object' ? kropp as Record<string, unknown> : {};
  const epost = String(k.epost ?? '').trim().toLowerCase();
  const namn = String(k.namn ?? '').replace(/\s+/g, ' ').trim();
  const superadmin = k.superadmin === true;

  if (!epostOk(epost)) return { ok: false, fel: 'Adressen ser inte ut som en e-postadress.' };
  if (arBarnadress(epost)) return { ok: false, fel: 'Adresser på barn.nextrum.se är barnkonton och kan inte bli admin.' };
  if (!namn) return { ok: false, fel: 'Skriv personens namn.' };
  if (namn.length > 120) return { ok: false, fel: 'Namnet får ha högst 120 tecken.' };

  if (k.behorigheter !== undefined && !Array.isArray(k.behorigheter)) {
    return { ok: false, fel: 'Behörigheterna ska vara en lista.' };
  }
  const lista = Array.isArray(k.behorigheter) ? k.behorigheter : [];
  const okanda = lista.filter((b) => typeof b !== 'string' || !(BEHORIGHETER as readonly string[]).includes(b));
  if (okanda.length) return { ok: false, fel: 'Okänd behörighet: ' + okanda.map(String).join(', ') + '.' };
  const behorigheter = [...new Set(lista as Behorighet[])].sort();

  if (!superadmin && behorigheter.length === 0) return { ok: false, fel: 'Välj minst en behörighet.' };
  if (!superadmin && behorigheter.includes('anvandare_redigera') && !behorigheter.includes('anvandare_las')) {
    return { ok: false, fel: 'Ändra användare kräver Läsa användare.' };
  }
  // En superadmin har allt; listan bredvid säger ingenting.
  return { ok: true, admin: { epost, namn, behorigheter: superadmin ? [] : behorigheter, superadmin } };
}

/** Ett fel från Auth som betyder att adressen redan har ett konto. */
export function arRedanRegistrerad(meddelande: unknown): boolean {
  return /already|exists|registered|duplicate/i.test(String(meddelande ?? ''));
}

export const REDAN_KONTO =
  'Det finns redan ett konto med den adressen. Lägg till personen under Befintlig användare i stället.';

export type Beroenden = {
  /** admin_kan_ge med ANROPARENS token: null om det går, annars skälet. */
  kanGe: (a: NyAdmin) => Promise<string | null>;
  /** Finns ett konto med adressen? Läst med service_role. */
  finnsKonto: (epost: string) => Promise<boolean>;
  bjudIn: (a: NyAdmin) => Promise<{ id: string | null; fel: string | null }>;
  /** profiles.role = 'admin': bara en adress (vart inloggningen leder), aldrig en behörighet. */
  sattAdressAdmin: (id: string) => Promise<void>;
  /** gor_till_admin med ANROPARENS token. null om det gick, annars skälet. */
  gorTillAdmin: (id: string, a: NyAdmin) => Promise<string | null>;
  taBortKonto: (id: string) => Promise<void>;
};

export type Svar = { status: number; kropp: Record<string, unknown> };

export async function hanteraNyAdmin(kropp: unknown, b: Beroenden): Promise<Svar> {
  const t = tolkaNyAdmin(kropp);
  if (!t.ok) return { status: 400, kropp: { error: t.fel } };
  const a = t.admin;

  const nej = await b.kanGe(a);
  if (nej) return { status: 403, kropp: { error: nej } };

  if (await b.finnsKonto(a.epost)) return { status: 409, kropp: { error: REDAN_KONTO } };

  const ny = await b.bjudIn(a);
  if (ny.fel || !ny.id) {
    return arRedanRegistrerad(ny.fel)
      ? { status: 409, kropp: { error: REDAN_KONTO } }
      : { status: 502, kropp: { error: 'Inbjudan gick inte att skicka. Försök igen om en stund.' } };
  }

  await b.sattAdressAdmin(ny.id);
  const fel = await b.gorTillAdmin(ny.id, a);
  if (fel) {
    // Utan rollen ska kontot inte finnas: länken i mejlet leder då till
    // en inloggning som inte får någonting.
    await b.taBortKonto(ny.id);
    return { status: 403, kropp: { error: fel } };
  }
  return { status: 200, kropp: { ok: true, id: ny.id, epost: a.epost } };
}
