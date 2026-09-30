// ============================================================
// NEXTRUM — prov: barnets inloggning (barnkonton_och_admin)
//
// Kör med:  deno test supabase/functions/_delad/
//
// hanteraBarnkonto() tar allt som talar med omvärlden som beroenden,
// så att varje väg går att köra här: en låtsasdatabas med två familjer
// och ett låtsas-Auth. Det som hålls fast:
//
//   · användarnamnet och lösenordet prövas innan något skrivs
//   · utan vårdnadshavarens ja skapas ingen inloggning
//   · förälder A kan aldrig skapa, ändra eller ta bort en inloggning
//     åt förälder B:s barn, och en admin är ingen förälder
//   · ett barn ändrar inte sin egen inloggning
//   · kontot skapas inom ett fönster med kontots id, som alltid stängs
//   · lösenordsbytet sker inom ett fönster som alltid stängs
// ============================================================

import { assertEquals } from 'jsr:@std/assert@1';
import {
  arBarnadress, barnEpost, type Barnrad, type Beroenden, hanteraBarnkonto, normaliseraAnvandarnamn,
  PAUS, provaAnvandarnamn, provaLosenord, tolkaAnrop,
} from './barnkonto.ts';

const FORALDER_A = '00000000-0000-4000-8000-00000000000a';
const FORALDER_B = '00000000-0000-4000-8000-00000000000b';
const ADMIN = '00000000-0000-4000-8000-0000000000ad';
const BARN_A = '00000000-0000-4000-8000-0000000005a1';
const BARN_B = '00000000-0000-4000-8000-0000000005b1';
const KONTO_A = '00000000-0000-4000-8000-0000000000c1';

type Skapandefonster = { barnId: string; userId: string; namn: string };

type Varld = {
  b: Beroenden;
  barn: Record<string, Barnrad>;
  logg: string[];
  fonster: string[];
  skapandefonster: Skapandefonster[];
};

/**
 * Två familjer. A:s barn har ingen inloggning, B:s har en. lasEgetBarn
 * gör som RLS: föräldern ser sina egna barn, admin ser alla. Låtsas-Auth
 * gör som databasen (auth_barnkonto_skapas): en barnadress skapas bara
 * med ett öppet skapandefönster för samma id och användarnamn, och
 * familjen tas ur fönstret.
 */
function varld(vem: string, o: {
  roll?: string; skapaFel?: string; kopplas?: boolean; bytFel?: string; fonsterFel?: string; annatId?: string;
} = {}): Varld {
  const barn: Record<string, Barnrad> = {
    [BARN_A]: { id: BARN_A, parent_id: FORALDER_A, user_id: null, anvandarnamn: null, barn_aktiv: true, raderad_at: null },
    [BARN_B]: { id: BARN_B, parent_id: FORALDER_B, user_id: '00000000-0000-4000-8000-0000000000c2', anvandarnamn: 'bert',
      barn_aktiv: true, raderad_at: null },
  };
  const logg: string[] = [];
  const fonster: string[] = [];
  const skapandefonster: Skapandefonster[] = [];
  const b: Beroenden = {
    anvandare: vem,
    appMetadata: o.roll ? { roll: o.roll } : {},
    lasEgetBarn: (id) => {
      const r = barn[id];
      return Promise.resolve(r && (r.parent_id === vem || vem === ADMIN) ? { id: r.id, parent_id: r.parent_id } : null);
    },
    lasBarn: (id) => Promise.resolve(barn[id] ? { ...barn[id] } : null),
    anvandarnamnUpptaget: (namn) => Promise.resolve(Object.values(barn).some((r) => r.anvandarnamn === namn)),
    nyttId: () => KONTO_A,
    oppnaSkapandefonster: (barnId, userId, namn) => {
      logg.push(`skapandefönster ${barnId} ${userId} ${namn}`);
      if (o.fonsterFel) return Promise.resolve(o.fonsterFel);
      skapandefonster.push({ barnId, userId, namn });
      return Promise.resolve(null);
    },
    skapaAnvandare: (a) => {
      logg.push(`skapa ${a.id} ${a.epost}`);
      if (o.skapaFel) return Promise.resolve({ id: null, fel: o.skapaFel });
      const id = o.annatId ?? a.id;
      const namn = a.epost.split('@')[0];
      const i = skapandefonster.findIndex((f) => f.userId === id && f.namn === namn);
      if (i < 0) return Promise.resolve({ id: null, fel: 'Database error creating new user' });
      const [f] = skapandefonster.splice(i, 1);
      // Databasen kopplar kontot i samma transaktion (auth_barnkonto_kopplas).
      if (o.kopplas !== false) {
        barn[f.barnId].user_id = id;
        barn[f.barnId].anvandarnamn = namn;
      }
      return Promise.resolve({ id, fel: null });
    },
    kopplad: (id) => Promise.resolve(barn[id]?.user_id ?? null),
    bytLosenord: (userId) => {
      logg.push(`lösenord ${userId} fönster:${fonster.length}`);
      return Promise.resolve(o.bytFel ?? null);
    },
    sattPaus: (userId, tid) => { logg.push(`paus ${userId} ${tid}`); return Promise.resolve(null); },
    sattAktiv: (id, aktiv) => { barn[id].barn_aktiv = aktiv; logg.push(`aktiv ${aktiv}`); return Promise.resolve(null); },
    taBortAnvandare: (userId) => {
      logg.push(`ta bort ${userId}`);
      for (const r of Object.values(barn)) if (r.user_id === userId) { r.user_id = null; r.anvandarnamn = null; }
      return Promise.resolve(null);
    },
    oppnaFonster: (id) => { fonster.push(id); logg.push('fönster öppnat'); return Promise.resolve(null); },
    stangFonster: (id) => {
      // Båda sorterna, som i databasen: delete where barn_id = ...
      for (let i = fonster.length - 1; i >= 0; i--) if (fonster[i] === id) fonster.splice(i, 1);
      for (let i = skapandefonster.length - 1; i >= 0; i--) if (skapandefonster[i].barnId === id) skapandefonster.splice(i, 1);
      logg.push('fönster stängt');
      return Promise.resolve();
    },
    loggaUt: (id) => { logg.push(`utloggad ${id}`); return Promise.resolve(); },
  };
  return { b, barn, logg, fonster, skapandefonster };
}

const skapa = (barn = BARN_A, extra: Record<string, unknown> = {}) => ({
  atgard: 'skapa', barn_id: barn, anvandarnamn: 'Alva.B', losenord: 'hemligt-lösen', vardnadshavare_godkand: true, ...extra,
});

Deno.test('användarnamnet: gemener, 3–20 tecken, bara a–z, siffror, punkt, bindestreck och understreck', () => {
  assertEquals(normaliseraAnvandarnamn('  Alva.B '), 'alva.b');
  assertEquals(provaAnvandarnamn('alva.b'), null);
  assertEquals(provaAnvandarnamn('a_b-9'), null);
  assertEquals(provaAnvandarnamn('ab') !== null, true);
  assertEquals(provaAnvandarnamn('a'.repeat(21)) !== null, true);
  assertEquals(provaAnvandarnamn('åsa') !== null, true);
  assertEquals(provaAnvandarnamn('alva b') !== null, true);
  assertEquals(provaAnvandarnamn('alva@x') !== null, true);
  assertEquals(provaAnvandarnamn('') !== null, true);
  assertEquals(barnEpost('alva.b'), 'alva.b@barn.nextrum.se');
  assertEquals(arBarnadress('Alva.B@Barn.Nextrum.se '), true);
  assertEquals(arBarnadress('alva@nextrum.se'), false);
});

Deno.test('lösenordet: minst åtta tecken, inte användarnamnet, inte för långt', () => {
  assertEquals(provaLosenord('hemligt!', 'alva'), null);
  assertEquals(provaLosenord('kort', 'alva') !== null, true);
  assertEquals(provaLosenord('alva.bergman', 'alva.bergman') !== null, true);
  assertEquals(provaLosenord(' ALVA.BERGMAN ', 'alva.bergman') !== null, true);
  assertEquals(provaLosenord('alva.b@barn.nextrum.se', 'alva.b') !== null, true);
  assertEquals(provaLosenord('å'.repeat(40), 'alva') !== null, true, '80 byte är för långt för bcrypt');
  assertEquals(provaLosenord(12345678, 'alva') !== null, true);
});

Deno.test('anropet: okänd åtgärd, fel barn-id och ett ja som inte är true nekas', () => {
  assertEquals(tolkaAnrop({ atgard: 'gor_till_admin', barn_id: BARN_A }).ok, false);
  assertEquals(tolkaAnrop({ atgard: 'pausa', barn_id: 'alla' }).ok, false);
  assertEquals(tolkaAnrop(null).ok, false);
  for (const ja of [undefined, false, 'true', 1, 'ja']) {
    assertEquals(tolkaAnrop(skapa(BARN_A, { vardnadshavare_godkand: ja })).ok, false, String(ja));
  }
  const t = tolkaAnrop(skapa());
  assertEquals(t.ok && t.anrop.atgard === 'skapa' && t.anrop.anvandarnamn, 'alva.b');
});

Deno.test('föräldern skapar barnets inloggning: fönstret först, med kontots id, och stängt efteråt', async () => {
  const v = varld(FORALDER_A);
  const s = await hanteraBarnkonto(skapa(), v.b);
  assertEquals(s, { status: 200, kropp: { ok: true, anvandarnamn: 'alva.b' } });
  assertEquals(v.logg, [
    `skapandefönster ${BARN_A} ${KONTO_A} alva.b`,
    `skapa ${KONTO_A} alva.b@barn.nextrum.se`,
    'fönster stängt',
  ]);
  assertEquals(v.barn[BARN_A].user_id, KONTO_A);
  assertEquals(v.skapandefonster, []);
});

Deno.test('kan fönstret inte öppnas anropas inte Auth', async () => {
  const v = varld(FORALDER_A, { fonsterFel: 'nekad' });
  const s = await hanteraBarnkonto(skapa(), v.b);
  assertEquals(s.status, 500);
  assertEquals(v.logg, [`skapandefönster ${BARN_A} ${KONTO_A} alva.b`]);
  assertEquals(v.barn[BARN_A].user_id, null);
});

Deno.test('fönstret stängs också när Auth säger nej', async () => {
  const v = varld(FORALDER_A, { skapaFel: 'Database error creating new user' });
  const s = await hanteraBarnkonto(skapa(), v.b);
  assertEquals(s.status, 502);
  assertEquals(v.logg.at(-1), 'fönster stängt');
  assertEquals(v.skapandefonster, []);
});

Deno.test('ett konto med ett annat id än fönstrets tas bort igen', async () => {
  const annat = '00000000-0000-4000-8000-0000000000c9';
  const v = varld(FORALDER_A, { annatId: annat });
  // Databasen hade nekat det (inget fönster för id:t); låtsas-Auth gör
  // likadant, så provet ger det också ett fönster för att nå kontrollen.
  v.skapandefonster.push({ barnId: BARN_A, userId: annat, namn: 'alva.b' });
  const s = await hanteraBarnkonto(skapa(), v.b);
  assertEquals(s.status, 500);
  assertEquals(v.logg.at(-1), `ta bort ${annat}`);
});

Deno.test('utan vårdnadshavarens ja skapas ingenting', async () => {
  const v = varld(FORALDER_A);
  const s = await hanteraBarnkonto(skapa(BARN_A, { vardnadshavare_godkand: false }), v.b);
  assertEquals(s.status, 400);
  assertEquals(v.logg, []);
});

Deno.test('förälder A kan inte skapa, byta, pausa eller ta bort för förälder B:s barn', async () => {
  for (const kropp of [
    skapa(BARN_B),
    { atgard: 'byt_losenord', barn_id: BARN_B, losenord: 'nytt-lösen-1' },
    { atgard: 'pausa', barn_id: BARN_B },
    { atgard: 'aktivera', barn_id: BARN_B },
    { atgard: 'ta_bort_inloggning', barn_id: BARN_B },
  ]) {
    const v = varld(FORALDER_A);
    const s = await hanteraBarnkonto(kropp, v.b);
    assertEquals(s.status, 403, kropp.atgard);
    assertEquals(v.logg, [], kropp.atgard);
    assertEquals(v.barn[BARN_B].user_id, '00000000-0000-4000-8000-0000000000c2');
  }
});

Deno.test('en admin ser barnet men är ingen förälder', async () => {
  const v = varld(ADMIN);
  const s = await hanteraBarnkonto({ atgard: 'ta_bort_inloggning', barn_id: BARN_B }, v.b);
  assertEquals(s.status, 403);
  assertEquals(v.logg, []);
});

Deno.test('ett barn ändrar inte sin egen inloggning', async () => {
  const v = varld(FORALDER_B, { roll: 'barn' });
  const s = await hanteraBarnkonto({ atgard: 'byt_losenord', barn_id: BARN_B, losenord: 'nytt-lösen-1' }, v.b);
  assertEquals(s.status, 403);
  assertEquals(v.logg, []);
});

Deno.test('ett upptaget användarnamn: samma svar oavsett om databasen eller Auth såg det först', async () => {
  const v1 = varld(FORALDER_A);
  const s1 = await hanteraBarnkonto(skapa(BARN_A, { anvandarnamn: 'bert' }), v1.b);
  assertEquals(s1, { status: 409, kropp: { error: 'Användarnamnet är upptaget' } });
  assertEquals(v1.logg, []);

  const v2 = varld(FORALDER_A, { skapaFel: 'A user with this email address has already been registered' });
  const s2 = await hanteraBarnkonto(skapa(), v2.b);
  assertEquals(s2, { status: 409, kropp: { error: 'Användarnamnet är upptaget' } });
  assertEquals(v2.skapandefonster, []);
});

Deno.test('ett konto som inte kopplades tas bort igen', async () => {
  const v = varld(FORALDER_A, { kopplas: false });
  const s = await hanteraBarnkonto(skapa(), v.b);
  assertEquals(s.status, 500);
  assertEquals(v.logg.at(-1), `ta bort ${KONTO_A}`);
});

Deno.test('ett barn med inloggning får ingen till', async () => {
  const v = varld(FORALDER_B);
  const s = await hanteraBarnkonto(skapa(BARN_B, { anvandarnamn: 'ny.bert' }), v.b);
  assertEquals(s.status, 409);
  assertEquals(v.logg, []);
});

Deno.test('lösenordet byts inom ett fönster som alltid stängs, och barnet loggas ut', async () => {
  const v = varld(FORALDER_B);
  const s = await hanteraBarnkonto({ atgard: 'byt_losenord', barn_id: BARN_B, losenord: 'nytt-lösen-1' }, v.b);
  assertEquals(s.status, 200);
  assertEquals(v.logg, ['fönster öppnat', 'lösenord 00000000-0000-4000-8000-0000000000c2 fönster:1', 'fönster stängt',
    `utloggad ${BARN_B}`]);
  assertEquals(v.fonster, []);

  const fel = varld(FORALDER_B, { bytFel: 'nekad' });
  const s2 = await hanteraBarnkonto({ atgard: 'byt_losenord', barn_id: BARN_B, losenord: 'nytt-lösen-1' }, fel.b);
  assertEquals(s2.status, 502);
  assertEquals(fel.fonster, [], 'fönstret står inte kvar efter ett misslyckat byte');
});

Deno.test('lösenordet får inte vara användarnamnet, också vid byte', async () => {
  const v = varld(FORALDER_B);
  const s = await hanteraBarnkonto({ atgard: 'byt_losenord', barn_id: BARN_B, losenord: 'BERT@barn.nextrum.se' }, v.b);
  assertEquals(s.status, 400);
  assertEquals(v.logg, []);
});

Deno.test('pausa: databasen först, spärren sedan, och barnet loggas ut; aktivera åt andra hållet', async () => {
  const v = varld(FORALDER_B);
  assertEquals((await hanteraBarnkonto({ atgard: 'pausa', barn_id: BARN_B }, v.b)).status, 200);
  assertEquals(v.logg, ['aktiv false', `paus 00000000-0000-4000-8000-0000000000c2 ${PAUS}`, `utloggad ${BARN_B}`]);
  v.logg.length = 0;
  assertEquals((await hanteraBarnkonto({ atgard: 'aktivera', barn_id: BARN_B }, v.b)).status, 200);
  assertEquals(v.logg, ['paus 00000000-0000-4000-8000-0000000000c2 none', 'aktiv true']);
});

Deno.test('ta bort inloggningen tar bort kontot i Auth', async () => {
  const v = varld(FORALDER_B);
  assertEquals((await hanteraBarnkonto({ atgard: 'ta_bort_inloggning', barn_id: BARN_B }, v.b)).status, 200);
  assertEquals(v.logg, ['ta bort 00000000-0000-4000-8000-0000000000c2']);
  assertEquals(v.barn[BARN_B].user_id, null);
});

Deno.test('ett barn utan inloggning: inget att byta, pausa eller ta bort', async () => {
  for (const atgard of ['byt_losenord', 'pausa', 'aktivera', 'ta_bort_inloggning']) {
    const v = varld(FORALDER_A);
    const s = await hanteraBarnkonto({ atgard, barn_id: BARN_A, losenord: 'nytt-lösen-1' }, v.b);
    assertEquals(s.status, 409, atgard);
    assertEquals(v.logg, [], atgard);
  }
});
