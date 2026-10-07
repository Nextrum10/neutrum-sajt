// ============================================================
// NEXTRUM — inbjudan av en familj eller en studiehjälpare, utan nät
//
// Edge-funktionen bjud-in skapar kontot åt den som tas in på
// plattformen, och Supabase Auth mejlar en länk där personen väljer sitt
// lösenord. Det som går att pröva utan Auth och databasen står här, och
// hanteringen tar omvärlden som beroenden (som adminbehorighet.ts), så
// att inbjudan_test.ts kan köra varje väg.
//
// VARFÖR EN LÄNK OCH INTE ETT LÖSENORD (2026-10-06)
// Leo ville att kontot skulle få lösenordet 12345678 och att personen
// byter det första gången. Det blir samma steg för personen med en
// länk: mejlet, ett tryck, "skapa nytt lösenord" två gånger. Men ett
// lösenord som alla nya konton delar kan vem som helst som hört talas om
// det använda före personen själv, och kontot är en familjs barn,
// passen och betalningarna. Länken gäller en gång och bara för den som
// har inkorgen. Att bytet görs innan något annat händer avgör vyn; det
// skyddar ingenting, och därför finns inget gemensamt lösenord att
// skydda.
//
// VÄLKOMSTEN (user_metadata.valkommen)
// Ett nytt konto bär 'losenord' tills lösenordet är valt, och sedan
// 'intro' tills introduktionen är genomgången (studievyn och
// studiehjälparvyn). Den står i user_metadata, som personen själv
// skriver: den säger bara vad vyn ska visa först, aldrig vad någon får.
//
// SKICKA IGEN
// Har personen inte tryckt på länken skickas inbjudan igen (Auth bjuder
// in ett obekräftat konto en gång till). Har hen tryckt går en länk för
// att välja lösenord, samma som Glömt lösenordet, också när hen redan
// valt ett och loggat in (2026-10-07, Leo: "i admin ska vi kunna skicka
// inbjudningslänk när vi vill efter, ifall de missar den"). Länken går
// bara till personens egen inkorg, och lösenordet byts först när hen
// väljer ett nytt. Varje ny länk gör den förra oanvändbar: det är bara
// det senaste mejlet som fungerar.
// ============================================================

import { epostOk } from './http.ts';
import { arBarnadress } from './barnkonto.ts';

export type Roll = 'parent' | 'tutor';

/** Dit länken i mejlet leder, per roll. Måste stå bland Redirect URLs i Supabase Auth. */
export const TILLBAKA: Record<Roll, string> = {
  parent: 'https://nextrum.se/foralder',
  tutor: 'https://nextrum.se/larare',
};

/** user_metadata.valkommen för ett konto som inte valt sitt lösenord än. */
export const VALKOMMEN_LOSENORD = 'losenord';

export type Inbjudan = {
  epost: string;
  namn: string;
  roll: Roll;
  leadId: string | null;
  igen: boolean;
};

export function tolkaInbjudan(kropp: unknown): { ok: true; inbjudan: Inbjudan } | { ok: false; fel: string } {
  const k = kropp && typeof kropp === 'object' ? kropp as Record<string, unknown> : {};
  const epost = String(k.epost ?? '').trim().toLowerCase();
  const namn = String(k.namn ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
  // Rollen vitlistas här, aldrig vidare från anropet: allt utom tutor
  // blir förälder. Den hamnar i metadatan, och handle_new_user läser den.
  const roll: Roll = k.roll === 'tutor' ? 'tutor' : 'parent';
  const leadId = roll === 'parent' && k.lead_id ? String(k.lead_id) : null;

  if (!epostOk(epost)) return { ok: false, fel: 'Adressen ser inte ut som en e-postadress.' };
  if (arBarnadress(epost)) return { ok: false, fel: 'Adresser på barn.nextrum.se är barnkonton och bjuds inte in.' };
  return { ok: true, inbjudan: { epost, namn, roll, leadId, igen: k.igen === true } };
}

/** Ett fel från Auth som betyder att adressen redan har ett konto. */
export function arRedanRegistrerad(meddelande: unknown): boolean {
  return /already|exists|registered|duplicate/i.test(String(meddelande ?? ''));
}

export type Konto = { id: string; roll: string };
export type AuthKonto = { bekraftad: boolean; valkommen: unknown };

export type Beroenden = {
  /** Profilen med adressen, läst med service_role. */
  kontoMedAdress: (epost: string) => Promise<Konto | null>;
  /** Kontot i Auth: har adressen bekräftats (länken använts), och välkomsten. */
  authKonto: (id: string) => Promise<AuthKonto | null>;
  bjudIn: (epost: string, data: Record<string, unknown>, tillbaka: string) =>
    Promise<{ id: string | null; fel: string | null }>;
  /** Länken för att välja lösenord, som Glömt lösenordet. null om den gick, annars felet. */
  losenordslank: (epost: string, tillbaka: string) => Promise<string | null>;
  /** Anmälan är kontaktad: kontot som skapades ÄR familjen den kom från. */
  kontaktad: (leadId: string) => Promise<void>;
};

export type Svar = { status: number; kropp: Record<string, unknown> };

const REDAN = {
  parent: 'Det finns redan ett konto med den adressen. Välj det i listan.',
  tutor: 'Det finns redan ett konto med den adressen. Är det en studiehjälpare går hen att godkänna i listan Studiehjälpare.',
};

export async function hanteraInbjudan(kropp: unknown, b: Beroenden): Promise<Svar> {
  const t = tolkaInbjudan(kropp);
  if (!t.ok) return { status: 400, kropp: { error: t.fel } };
  const i = t.inbjudan;

  const finns = await b.kontoMedAdress(i.epost);

  if (i.igen) {
    if (!finns) {
      return { status: 404, kropp: { error: 'Det finns inget konto med den adressen. Bjud in personen i stället.' } };
    }
    // Rollen tas ur profilen, inte ur anropet: länken ska leda till den
    // vy personen faktiskt hör hemma i.
    if (finns.roll !== 'parent' && finns.roll !== 'tutor') {
      return { status: 409, kropp: { error: 'Det här kontot bjuds inte in härifrån.' } };
    }
    const tillbaka = TILLBAKA[finns.roll as Roll];
    const auth = await b.authKonto(finns.id);
    if (!auth) return { status: 404, kropp: { error: 'Kontot finns inte i inloggningen.' } };

    if (!auth.bekraftad) {
      const ny = await b.bjudIn(i.epost, {}, tillbaka);
      if (ny.fel) {
        return { status: 502, kropp: { error: 'Inbjudan gick inte att skicka. Försök igen om en stund.' } };
      }
      return { status: 200, kropp: { ok: true, id: finns.id, till: i.epost, roll: finns.roll, skickat: 'inbjudan' } };
    }
    // Länken är använd: en länk för att välja lösenord, oavsett om hen
    // valt ett än (auth.valkommen säger bara vad vyn visar först).
    const fel = await b.losenordslank(i.epost, tillbaka);
    if (fel) {
      return {
        status: /after|rate|too many/i.test(fel) ? 429 : 502,
        kropp: {
          error: /after|rate|too many/i.test(fel)
            ? 'Ett mejl gick nyss till adressen. Vänta en minut och försök igen.'
            : 'Länken gick inte att skicka. Försök igen om en stund.',
        },
      };
    }
    return { status: 200, kropp: { ok: true, id: finns.id, till: i.epost, roll: finns.roll, skickat: 'losenord' } };
  }

  // Finns kontot redan ska det användas, inte bjudas in en gång till.
  if (finns) return { status: 409, kropp: { error: REDAN[i.roll] } };

  const ny = await b.bjudIn(i.epost, { role: i.roll, full_name: i.namn, valkommen: VALKOMMEN_LOSENORD },
    TILLBAKA[i.roll]);
  if (ny.fel || !ny.id) {
    return arRedanRegistrerad(ny.fel)
      ? { status: 409, kropp: { error: 'Det finns redan ett konto med den adressen.' } }
      : { status: 502, kropp: { error: 'Inbjudan gick inte att skicka: ' + (ny.fel ?? 'okänt fel') } };
  }

  // Anmälan är kontaktad nu. Står den kvar som ny ligger den kvar i
  // arbetskön fast någon redan agerat på den.
  if (i.leadId) await b.kontaktad(i.leadId);

  return { status: 200, kropp: { ok: true, id: ny.id, till: i.epost, roll: i.roll, skickat: 'inbjudan' } };
}
