// ============================================================
// NEXTRUM — barnets inloggning, utan nät (barnkonton_och_admin)
//
// Edge-funktionen barn-konto gör fem saker åt en förälder: skapar
// barnets inloggning, byter lösenordet, pausar, aktiverar och tar bort
// inloggningen. Allt som talar med omvärlden kommer in som beroenden,
// som i notiser/ko.ts, så att barnkonto_test.ts kan köra varje väg med
// en låtsas-databas och ett låtsas-Auth.
//
// ORDNINGEN GÄLLER ÖVERALLT (CLAUDE.md avsnitt 6): förälderns egen
// token prövas först, mot RLS, och sedan jämförs raden med den
// inloggade. En admin läser alla barn men är inte förälder till dem;
// barnets inloggning är förälderns sak. Först därefter används
// service_role.
//
// KONTOT SKAPAS GENOM ETT FÖNSTER (barnkonto_skapas_genom_auth). GoTrue
// skriver raden i auth.users innan anropets app_metadata finns på den,
// så databasen kan inte se familjen i anropet. Funktionen väljer därför
// kontots id, öppnar ett skapandefönster med id:t, barnet och
// användarnamnet, och ger Auth samma id. Databasen släpper bara in en
// barnadress med ett öppet fönster för exakt det id:t och skriver
// app_metadata själv. En registrering genom signUp får sitt id av Auth.
//
// Användarnamnets regel står också i databasen (students_anvandarnamn_form,
// auth_barnkonto_skapas och fönstrets villkor) och i barninloggningen
// (nextrum-barn-vy.js). Ändras den ena ska de andra följa med.
// ============================================================

export const BARN_DOMAN = 'barn.nextrum.se';
export const ANVANDARNAMN = /^[a-z0-9._-]{3,20}$/;
export const MINSTA_LOSENORD = 8;
/** bcrypt läser bara 72 byte, och GoTrue nekar längre lösenord. */
export const STORSTA_LOSENORD_BYTE = 72;
/** Pausen i Auth: hundra år, alltså tills föräldern aktiverar igen. */
export const PAUS = '876000h';

export const ATGARDER = ['skapa', 'byt_losenord', 'pausa', 'aktivera', 'ta_bort_inloggning'] as const;
export type Atgard = typeof ATGARDER[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normaliseraAnvandarnamn(v: unknown): string {
  return String(v ?? '').trim().toLowerCase();
}

export function barnEpost(anvandarnamn: string): string {
  return `${anvandarnamn}@${BARN_DOMAN}`;
}

export function arBarnadress(epost: unknown): boolean {
  return String(epost ?? '').trim().toLowerCase().endsWith('@' + BARN_DOMAN);
}

export function provaAnvandarnamn(namn: string): string | null {
  if (!namn) return 'Skriv ett användarnamn.';
  if (namn.length < 3) return 'Användarnamnet måste ha minst 3 tecken.';
  if (namn.length > 20) return 'Användarnamnet får ha högst 20 tecken.';
  if (!ANVANDARNAMN.test(namn)) {
    return 'Användarnamnet får bara innehålla a–z, siffror, punkt, bindestreck och understreck.';
  }
  return null;
}

export function provaLosenord(losenord: unknown, anvandarnamn: string): string | null {
  const l = typeof losenord === 'string' ? losenord : '';
  if (l.length < MINSTA_LOSENORD) return `Lösenordet måste ha minst ${MINSTA_LOSENORD} tecken.`;
  if (new TextEncoder().encode(l).length > STORSTA_LOSENORD_BYTE) return 'Lösenordet är för långt.';
  const jamfor = l.trim().toLowerCase();
  if (anvandarnamn && (jamfor === anvandarnamn || jamfor === barnEpost(anvandarnamn))) {
    return 'Lösenordet får inte vara samma som användarnamnet.';
  }
  return null;
}

export type Anrop =
  | { atgard: 'skapa'; barnId: string; anvandarnamn: string; losenord: string }
  | { atgard: 'byt_losenord'; barnId: string; losenord: string }
  | { atgard: 'pausa' | 'aktivera' | 'ta_bort_inloggning'; barnId: string };

export type Tolkat = { ok: true; anrop: Anrop } | { ok: false; fel: string };

/** Anropets kropp, prövad innan något annat görs. */
export function tolkaAnrop(kropp: unknown): Tolkat {
  const k = kropp && typeof kropp === 'object' ? kropp as Record<string, unknown> : {};
  const atgard = k.atgard;
  if (typeof atgard !== 'string' || !(ATGARDER as readonly string[]).includes(atgard)) {
    return { ok: false, fel: 'Okänd åtgärd.' };
  }
  const barnId = String(k.barn_id ?? '');
  if (!UUID.test(barnId)) return { ok: false, fel: 'Barnet saknas i anropet.' };

  if (atgard === 'skapa') {
    const anvandarnamn = normaliseraAnvandarnamn(k.anvandarnamn);
    const f1 = provaAnvandarnamn(anvandarnamn);
    if (f1) return { ok: false, fel: f1 };
    const f2 = provaLosenord(k.losenord, anvandarnamn);
    if (f2) return { ok: false, fel: f2 };
    // true och inget annat: "ja", 1 och "true" är inte ett godkännande
    // från en vårdnadshavare, de är ett formulär som skickats fel.
    if (k.vardnadshavare_godkand !== true) {
      return { ok: false, fel: 'Kryssa i att du är vårdnadshavare och godkänner att barnet använder Nextrum.' };
    }
    return { ok: true, anrop: { atgard, barnId, anvandarnamn, losenord: k.losenord as string } };
  }
  if (atgard === 'byt_losenord') {
    // Användarnamnet jämförs i hanteraBarnkonto, när det lästs ur databasen.
    const f = provaLosenord(k.losenord, '');
    if (f) return { ok: false, fel: f };
    return { ok: true, anrop: { atgard, barnId, losenord: k.losenord as string } };
  }
  return { ok: true, anrop: { atgard: atgard as 'pausa' | 'aktivera' | 'ta_bort_inloggning', barnId } };
}

/** Ett fel från Auth som betyder att adressen redan finns. */
export function arUpptagen(meddelande: unknown): boolean {
  return /already|exists|registered|duplicate/i.test(String(meddelande ?? ''));
}

// ------------------------------------------------------------
// Själva hanteringen
// ------------------------------------------------------------

export type Barnrad = {
  id: string;
  parent_id: string;
  user_id: string | null;
  anvandarnamn: string | null;
  barn_aktiv: boolean;
  raderad_at: string | null;
};

export type Beroenden = {
  /** Den inloggade, prövad mot Auth. appMetadata ur Auth, aldrig ur anropet. */
  anvandare: string;
  appMetadata: Record<string, unknown>;
  /** students-raden läst med förälderns EGEN token (RLS gäller). */
  lasEgetBarn: (barnId: string) => Promise<{ id: string; parent_id: string } | null>;
  /** Samma rad med service_role, med inloggningens kolumner. */
  lasBarn: (barnId: string) => Promise<Barnrad | null>;
  anvandarnamnUpptaget: (anvandarnamn: string) => Promise<boolean>;
  /** Id:t det nya kontot ska få, valt här och inte av Auth. */
  nyttId: () => string;
  /** Skapandefönstret: databasen släpper in exakt det här kontot. */
  oppnaSkapandefonster: (barnId: string, userId: string, anvandarnamn: string) => Promise<string | null>;
  /** Kontot i Auth, med id:t ur fönstret. app_metadata skriver databasen. */
  skapaAnvandare: (a: {
    id: string; epost: string; losenord: string;
  }) => Promise<{ id: string | null; fel: string | null }>;
  /** Barnets rad efter att triggern kopplat kontot. */
  kopplad: (barnId: string) => Promise<string | null>;
  bytLosenord: (userId: string, losenord: string) => Promise<string | null>;
  sattPaus: (userId: string, banTid: string) => Promise<string | null>;
  sattAktiv: (barnId: string, aktiv: boolean) => Promise<string | null>;
  taBortAnvandare: (userId: string) => Promise<string | null>;
  /** Fönstret för ett lösenordsbyte. */
  oppnaFonster: (barnId: string) => Promise<string | null>;
  /** Stänger barnets fönster, båda sorterna. */
  stangFonster: (barnId: string) => Promise<void>;
  loggaUt: (barnId: string) => Promise<void>;
};

export type Svar = { status: number; kropp: Record<string, unknown> };

const nej = (status: number, error: string): Svar => ({ status, kropp: { error } });

export async function hanteraBarnkonto(kropp: unknown, b: Beroenden): Promise<Svar> {
  // Ett barn ändrar aldrig sin egen inloggning, inte heller genom
  // funktionen. app_metadata kommer ur Auth, inte ur anropet.
  if (b.appMetadata?.roll === 'barn') return nej(403, 'Barnets inloggning ändras av föräldern.');

  const t = tolkaAnrop(kropp);
  if (!t.ok) return nej(400, t.fel);
  const a = t.anrop;

  // Förälderns egen token först. RLS lämnar ut barnet till föräldern,
  // och till admin; därför jämförs raden med den inloggade.
  const egen = await b.lasEgetBarn(a.barnId);
  if (!egen || egen.parent_id !== b.anvandare) return nej(403, 'Bara barnets förälder kan ändra barnets inloggning.');

  const barn = await b.lasBarn(a.barnId);
  if (!barn || barn.parent_id !== b.anvandare || barn.raderad_at) {
    return nej(403, 'Bara barnets förälder kan ändra barnets inloggning.');
  }

  if (a.atgard === 'skapa') {
    if (barn.user_id) return nej(409, 'Barnet har redan en inloggning.');
    if (await b.anvandarnamnUpptaget(a.anvandarnamn)) return nej(409, 'Användarnamnet är upptaget');
    // Fönstret först, med kontots id. Det stängs alltid, också när Auth
    // säger nej: ett fönster som står kvar är ett konto till som får
    // skapas, fast bara med id:t, som ingen annan har.
    const id = b.nyttId();
    const oppet = await b.oppnaSkapandefonster(a.barnId, id, a.anvandarnamn);
    if (oppet) return nej(500, 'Inloggningen gick inte att skapa. Försök igen.');
    let ny: { id: string | null; fel: string | null };
    try {
      ny = await b.skapaAnvandare({ id, epost: barnEpost(a.anvandarnamn), losenord: a.losenord });
    } finally {
      await b.stangFonster(a.barnId);
    }
    if (ny.fel || !ny.id) {
      return arUpptagen(ny.fel) ? nej(409, 'Användarnamnet är upptaget')
        : nej(502, 'Inloggningen gick inte att skapa. Försök igen om en stund.');
    }
    // Databasen kopplar kontot i samma transaktion som det skapas. Står
    // barnet ändå utan koppling, eller fick kontot ett annat id, tas det
    // bort, hellre än att en inloggning finns som inte hör till något barn.
    if (ny.id !== id || await b.kopplad(a.barnId) !== id) {
      await b.taBortAnvandare(ny.id);
      return nej(500, 'Inloggningen gick inte att koppla till barnet. Försök igen.');
    }
    return { status: 200, kropp: { ok: true, anvandarnamn: a.anvandarnamn } };
  }

  if (!barn.user_id) return nej(409, 'Barnet har ingen inloggning.');

  if (a.atgard === 'byt_losenord') {
    const f = provaLosenord(a.losenord, barn.anvandarnamn ?? '');
    if (f) return nej(400, f);
    // Fönstret först: utan det nekar databasen bytet
    // (auth_barnkonto_las). Stängs alltid, också när bytet gick fel.
    const oppet = await b.oppnaFonster(a.barnId);
    if (oppet) return nej(500, 'Lösenordet gick inte att byta. Försök igen.');
    let fel: string | null;
    try {
      fel = await b.bytLosenord(barn.user_id, a.losenord);
    } finally {
      await b.stangFonster(a.barnId);
    }
    if (fel) return nej(502, 'Lösenordet gick inte att byta. Försök igen om en stund.');
    // Den som hade det gamla lösenordet ska inte vara kvar inloggad.
    await b.loggaUt(a.barnId);
    return { status: 200, kropp: { ok: true } };
  }

  if (a.atgard === 'pausa') {
    // Databasen först: barnets funktioner lämnar inget ut från och med
    // nu, också medan en redan utlämnad token gäller.
    const f1 = await b.sattAktiv(a.barnId, false);
    if (f1) return nej(500, 'Inloggningen gick inte att pausa. Försök igen.');
    const f2 = await b.sattPaus(barn.user_id, PAUS);
    await b.loggaUt(a.barnId);
    if (f2) return nej(502, 'Inloggningen är pausad i Nextrum, men kontot gick inte att spärra. Försök igen.');
    return { status: 200, kropp: { ok: true, barn_aktiv: false } };
  }

  if (a.atgard === 'aktivera') {
    // Auth först: blir spärren kvar ska barnet inte se "aktiv" och ändå
    // inte komma in.
    const f1 = await b.sattPaus(barn.user_id, 'none');
    if (f1) return nej(502, 'Inloggningen gick inte att aktivera. Försök igen om en stund.');
    const f2 = await b.sattAktiv(a.barnId, true);
    if (f2) return nej(500, 'Inloggningen gick inte att aktivera. Försök igen.');
    return { status: 200, kropp: { ok: true, barn_aktiv: true } };
  }

  // ta_bort_inloggning. Kontot i Auth tas bort; databasen tömmer
  // användarnamnet och barnets notiser genom främmande nyckeln.
  const fel = await b.taBortAnvandare(barn.user_id);
  if (fel) return nej(502, 'Inloggningen gick inte att ta bort. Försök igen om en stund.');
  return { status: 200, kropp: { ok: true } };
}
