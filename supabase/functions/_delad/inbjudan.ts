// ============================================================
// NEXTRUM — inbjudan av en familj eller en studiehjälpare, utan nät
//
// Edge-funktionen bjud-in skapar kontot åt den som tas in på
// plattformen och mejlar en länk där personen väljer sitt lösenord. Det
// som går att pröva utan Auth och databasen står här, och hanteringen
// tar omvärlden som beroenden (som adminbehorighet.ts), så att
// inbjudan_test.ts kan köra varje väg.
//
// MEJLET SKICKAR VI SJÄLVA (2026-10-07)
// Auth skapar kontot och länken (generateLink) men mejlar inget; mejlet
// går genom Resend med tiden i ämnet (notiser/konto.ts). Förut mejlade
// Auth med mallen i panelen, och tre inbjudningar till samma adress blev
// en tråd i Gmail där det senaste mejlet såg tomt ut och länkarna som
// syntes var gamla. Länken passerar nu Resend i stället för Googles
// SMTP; den gäller en gång och i en timme, och går bara till personens
// egen adress. Länken prövas här på samma sätt som /lank prövar den, så
// att inget mejl går med en länk som sidan sedan säger nej till.
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
// Har personen inte tryckt på länken skickas inbjudan igen (Auth gör en
// ny länk till ett obekräftat konto). Har hen tryckt går en länk för
// att välja lösenord, samma som Glömt lösenordet, också när hen redan
// valt ett och loggat in (2026-10-07, Leo: "i admin ska vi kunna skicka
// inbjudningslänk när vi vill efter, ifall de missar den"). Länken går
// bara till personens egen inkorg, och lösenordet byts först när hen
// väljer ett nytt. Varje ny länk gör den förra oanvändbar: det är bara
// det senaste mejlet som fungerar. Två mejl till samma konto ligger
// minst en minut isär, som Auths egen spärr för Glömt lösenordet.
// ============================================================

import { epostOk } from './http.ts';
import { arBarnadress } from './barnkonto.ts';
import { type Kontomejl, renderaKontomejl } from './notiser/konto.ts';
import type { Renderat } from './notiser/rendera.ts';

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

export type Konto = { id: string; roll: string; namn?: string | null };
export type AuthKonto = {
  bekraftad: boolean;
  valkommen: unknown;
  /** När Auth senast gjorde en länk till kontot, av vilket slag som helst. */
  senast?: string | null;
};
export type Lank = { id: string | null; lank: string | null; fel: string | null };

export type Beroenden = {
  /** Profilen med adressen, läst med service_role. */
  kontoMedAdress: (epost: string) => Promise<Konto | null>;
  /** Kontot i Auth: har adressen bekräftats (länken använts), och välkomsten. */
  authKonto: (id: string) => Promise<AuthKonto | null>;
  /** Auths länk, utan mejl (generateLink). invite skapar kontot när det saknas. */
  skapaLank: (typ: 'invite' | 'recovery', epost: string, data: Record<string, unknown>, tillbaka: string) =>
    Promise<Lank>;
  /** Mejlet, genom Resend. null om det gick, annars felet. */
  skicka: (till: string, mejl: Renderat) => Promise<string | null>;
  /** Anmälan är kontaktad: kontot som skapades ÄR familjen den kom från. */
  kontaktad: (leadId: string) => Promise<void>;
  /** Vårt Supabase. Länken måste gå till verify där, annars säger /lank nej. */
  supabaseUrl: string;
  nu: () => Date;
};

export type Svar = { status: number; kropp: Record<string, unknown> };

/** Minst så här länge mellan två mejl till samma konto, som Auths spärr för Glömt lösenordet. */
export const MELLAN_MEJL_MS = 60_000;

/** Samma prövning som nextrum-lank.js: verify hos vårt eget Supabase, med en token. */
export function godLank(lank: unknown, supabaseUrl: string): lank is string {
  try {
    const u = new URL(String(lank ?? ''));
    const bas = new URL(supabaseUrl);
    return bas.protocol === 'https:' && u.origin === bas.origin && u.pathname === '/auth/v1/verify'
      && !!u.searchParams.get('token');
  } catch {
    return false;
  }
}

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
    const roll = finns.roll as Roll;
    const tillbaka = TILLBAKA[roll];
    const auth = await b.authKonto(finns.id);
    if (!auth) return { status: 404, kropp: { error: 'Kontot finns inte i inloggningen.' } };

    const senast = auth.senast ? Date.parse(auth.senast) : NaN;
    if (b.nu().getTime() - senast < MELLAN_MEJL_MS) {
      return { status: 429, kropp: { error: 'Ett mejl gick nyss till adressen. Vänta en minut och försök igen.' } };
    }

    // Inte tryckt på länken: en ny inbjudan. Tryckt: en länk för att välja
    // lösenord, oavsett om hen valt ett än (auth.valkommen säger bara vad
    // vyn visar först). Hann kontot bekräftas mellan frågan och länken
    // svarar Auth att det redan finns, och då gäller lösenordslänken.
    let typ: Kontomejl = auth.bekraftad ? 'losenord' : 'inbjudan';
    let l = await b.skapaLank(typ === 'inbjudan' ? 'invite' : 'recovery', i.epost, {}, tillbaka);
    if (typ === 'inbjudan' && arRedanRegistrerad(l.fel)) {
      typ = 'losenord';
      l = await b.skapaLank('recovery', i.epost, {}, tillbaka);
    }
    if (l.fel || !godLank(l.lank, b.supabaseUrl)) {
      return { status: 502, kropp: { error: 'Länken gick inte att skapa. Försök igen om en stund.' } };
    }
    const fel = await b.skicka(i.epost, renderaKontomejl({ typ, roll, namn: finns.namn, verify: l.lank, nu: b.nu() }));
    if (fel) return { status: 502, kropp: { error: 'Mejlet gick inte att skicka. Försök igen om en stund.' } };
    return { status: 200, kropp: { ok: true, id: finns.id, till: i.epost, roll: finns.roll, skickat: typ } };
  }

  // Finns kontot redan ska det användas, inte bjudas in en gång till.
  if (finns) return { status: 409, kropp: { error: REDAN[i.roll] } };

  const ny = await b.skapaLank('invite', i.epost, { role: i.roll, full_name: i.namn, valkommen: VALKOMMEN_LOSENORD },
    TILLBAKA[i.roll]);
  if (ny.fel || !ny.id) {
    return arRedanRegistrerad(ny.fel)
      ? { status: 409, kropp: { error: 'Det finns redan ett konto med den adressen.' } }
      : { status: 502, kropp: { error: 'Inbjudan gick inte att skicka: ' + (ny.fel ?? 'okänt fel') } };
  }

  // Kontot finns nu, med eller utan mejl. Går mejlet inte iväg säger
  // svaret det, och Skicka inbjudan igen i personens panel gör resten.
  const efter = 'Kontot är skapat, men mejlet gick inte att skicka. Tryck Skicka inbjudan igen i personens '
    + 'panel om en stund.';
  if (!godLank(ny.lank, b.supabaseUrl)) return { status: 502, kropp: { error: efter } };
  const fel = await b.skicka(i.epost,
    renderaKontomejl({ typ: 'inbjudan', roll: i.roll, namn: i.namn, verify: ny.lank, nu: b.nu() }));
  if (fel) return { status: 502, kropp: { error: efter } };

  // Anmälan är kontaktad nu. Står den kvar som ny ligger den kvar i
  // arbetskön fast någon redan agerat på den.
  if (i.leadId) await b.kontaktad(i.leadId);

  return { status: 200, kropp: { ok: true, id: ny.id, till: i.epost, roll: i.roll, skickat: 'inbjudan' } };
}
