// ============================================================
// NEXTRUM — prov: att ta in en familj eller en studiehjälpare (2026-10-06)
//
// Kör med:  deno test supabase/functions/_delad/
//
// Att anroparen är admin prövas i bjud-in med hens egen token innan
// något här körs. Här provas det funktionen själv ansvarar för: rollen
// som vitlistas, adressen, att ett befintligt konto inte bjuds in en
// gång till, välkomsten i metadatan, att länken prövas innan den
// mejlas, mejlet med tiden i ämnet (2026-10-07), och vad Skicka igen gör
// för ett konto som inte tryckt på länken och ett som har det.
// ============================================================

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { type AuthKonto, type Beroenden, godLank, hanteraInbjudan, type Konto, MELLAN_MEJL_MS, TILLBAKA,
  tolkaInbjudan, VALKOMMEN_LOSENORD } from './inbjudan.ts';
import { lankAdress } from './notiser/konto.ts';

const SUPA = 'https://ddkfiuvcppalutfulvbi.supabase.co';
const NU = new Date('2026-10-07T13:51:22Z');
const verify = (typ: string, till: string) => `${SUPA}/auth/v1/verify?token=abc123&type=${typ}&redirect_to=${till}`;

type Varld = {
  konto?: Konto | null;
  auth?: AuthKonto | null;
  /** Felet Auth svarar med, per sort av länk. */
  lankFel?: Partial<Record<'invite' | 'recovery', string>>;
  /** En länk som inte är vår. */
  lank?: string;
  mejlFel?: string;
};

function varld(o: Varld = {}) {
  const logg: string[] = [];
  const mejl: { till: string; amne: string; text: string; html: string }[] = [];
  const b: Beroenden = {
    kontoMedAdress: (e) => { logg.push(`finns ${e}`); return Promise.resolve(o.konto ?? null); },
    authKonto: (id) => { logg.push(`auth ${id}`); return Promise.resolve(o.auth === undefined ? null : o.auth); },
    skapaLank: (typ, e, data, tillbaka) => {
      logg.push(`länk ${typ} ${e} ${JSON.stringify(data)} ${tillbaka}`);
      const fel = o.lankFel?.[typ];
      if (fel) return Promise.resolve({ id: null, lank: null, fel });
      return Promise.resolve({ id: o.konto?.id ?? 'ny-id', lank: o.lank ?? verify(typ, tillbaka), fel: null });
    },
    skicka: (till, m) => {
      logg.push(`mejl ${till}`);
      mejl.push({ till, ...m });
      return Promise.resolve(o.mejlFel ?? null);
    },
    kontaktad: (id) => { logg.push(`kontaktad ${id}`); return Promise.resolve(); },
    supabaseUrl: SUPA,
    nu: () => NU,
  };
  return { b, logg, mejl };
}

Deno.test('anropet prövas: adress, barnadress, namnet, rollen vitlistas', () => {
  const t = tolkaInbjudan({ epost: ' Sara.S@Example.se ', namn: '  Sara   Svensson ', roll: 'tutor', lead_id: 'x' });
  assertEquals(t.ok && t.inbjudan, { epost: 'sara.s@example.se', namn: 'Sara Svensson', roll: 'tutor', leadId: null, igen: false });
  const f = tolkaInbjudan({ epost: 'a@example.se', roll: 'admin', lead_id: 'l1', igen: 'true' });
  assertEquals(f.ok && f.inbjudan, { epost: 'a@example.se', namn: '', roll: 'parent', leadId: 'l1', igen: false },
    'allt utom tutor blir förälder, och bara true är igen');
  assertEquals(tolkaInbjudan({ epost: 'inte en adress' }).ok, false);
  assertEquals(tolkaInbjudan({ epost: 'alva@barn.nextrum.se' }).ok, false);
  const lang = tolkaInbjudan({ epost: 'a@example.se', namn: 'x'.repeat(300) });
  assertEquals(lang.ok && lang.inbjudan.namn.length, 120);
});

Deno.test('länken prövas som /lank prövar den: verify hos vårt Supabase, med en token', () => {
  assert(godLank(verify('invite', TILLBAKA.parent), SUPA));
  for (const fel of [
    'https://evil.example/auth/v1/verify?token=abc&type=invite',
    'http://ddkfiuvcppalutfulvbi.supabase.co/auth/v1/verify?token=abc',
    `${SUPA}/auth/v1/token?token=abc`,
    `${SUPA}/auth/v1/verify?type=invite`,
    'inte en adress', null, undefined,
  ]) assertEquals(godLank(fel, SUPA), false, String(fel));
  assertEquals(godLank(verify('invite', TILLBAKA.parent), 'http://ddkfiuvcppalutfulvbi.supabase.co'), false,
    'vårt Supabase är https');
});

Deno.test('en ny familj: länken med välkomsten, ett eget mejl, och anmälan blir kontaktad', async () => {
  const v = varld();
  const s = await hanteraInbjudan({ epost: 'anna@example.se', namn: 'Anna Andersson', lead_id: 'lead-1' }, v.b);
  assertEquals(s, { status: 200, kropp: { ok: true, id: 'ny-id', till: 'anna@example.se', roll: 'parent', skickat: 'inbjudan' } });
  assertEquals(v.logg, [
    'finns anna@example.se',
    `länk invite anna@example.se {"role":"parent","full_name":"Anna Andersson","valkommen":"${VALKOMMEN_LOSENORD}"} ${TILLBAKA.parent}`,
    'mejl anna@example.se',
    'kontaktad lead-1',
  ]);
  assertEquals(v.mejl[0].amne, 'Ditt konto hos Nextrum, 7 oktober kl. 15:51', 'tiden i ämnet: en egen tråd i Gmail');
  assert(v.mejl[0].html.includes(`href="${lankAdress(verify('invite', TILLBAKA.parent))}"`), 'knappen leder till /lank');
  assert(v.mejl[0].text.startsWith('Hej Anna,'), v.mejl[0].text.slice(0, 40));
});

Deno.test('en ny studiehjälpare: länken leder till studiehjälparvyn, ingen anmälan rörs', async () => {
  const v = varld();
  const s = await hanteraInbjudan({ epost: 'sara@example.se', namn: 'Sara', roll: 'tutor', lead_id: 'lead-1' }, v.b);
  assertEquals(s.status, 200);
  assertEquals(s.kropp.roll, 'tutor');
  assertEquals(v.logg, [
    'finns sara@example.se',
    `länk invite sara@example.se {"role":"tutor","full_name":"Sara","valkommen":"losenord"} ${TILLBAKA.tutor}`,
    'mejl sara@example.se',
  ]);
});

Deno.test('ett befintligt konto bjuds inte in en gång till', async () => {
  const v = varld({ konto: { id: 'k1', roll: 'parent' } });
  const s = await hanteraInbjudan({ epost: 'anna@example.se' }, v.b);
  assertEquals(s.status, 409);
  assertEquals(v.logg, ['finns anna@example.se']);
  const t = await hanteraInbjudan({ epost: 'sara@example.se', roll: 'tutor' }, varld({ konto: { id: 'k2', roll: 'tutor' } }).b);
  assertEquals(t.status, 409);
  assertEquals(String(t.kropp.error).includes('Studiehjälpare'), true);
});

Deno.test('Auth säger att adressen redan finns: 409, annat fel: 502, och inget mejl', async () => {
  const a = varld({ lankFel: { invite: 'A user with this email address has already been registered' } });
  assertEquals((await hanteraInbjudan({ epost: 'a@example.se' }, a.b)).status, 409);
  const b = varld({ lankFel: { invite: 'Database error saving new user' } });
  assertEquals((await hanteraInbjudan({ epost: 'a@example.se' }, b.b)).status, 502);
  assertEquals(a.mejl.length + b.mejl.length, 0);
});

Deno.test('kontot är skapat men mejlet går inte: 502 som säger det, och anmälan står kvar som ny', async () => {
  const v = varld({ mejlFel: 'Resend 403' });
  const s = await hanteraInbjudan({ epost: 'anna@example.se', lead_id: 'lead-1' }, v.b);
  assertEquals(s.status, 502);
  assert(String(s.kropp.error).startsWith('Kontot är skapat'), String(s.kropp.error));
  assertEquals(v.logg.includes('kontaktad lead-1'), false);
});

Deno.test('en länk som inte är vår mejlas aldrig', async () => {
  const ny = varld({ lank: 'https://evil.example/auth/v1/verify?token=abc' });
  assertEquals((await hanteraInbjudan({ epost: 'anna@example.se' }, ny.b)).status, 502);
  const igen = varld({ konto: { id: 'k1', roll: 'parent' }, auth: { bekraftad: false, valkommen: VALKOMMEN_LOSENORD },
    lank: 'https://evil.example/auth/v1/verify?token=abc' });
  assertEquals((await hanteraInbjudan({ epost: 'anna@example.se', igen: true }, igen.b)).status, 502);
  assertEquals(ny.mejl.length + igen.mejl.length, 0);
});

Deno.test('skicka igen: inget konto, och ett konto som inte är familj eller studiehjälpare', async () => {
  assertEquals((await hanteraInbjudan({ epost: 'a@example.se', igen: true }, varld().b)).status, 404);
  const v = varld({ konto: { id: 'k1', roll: 'admin' } });
  assertEquals((await hanteraInbjudan({ epost: 'a@example.se', igen: true }, v.b)).status, 409);
  assertEquals(v.logg, ['finns a@example.se']);
});

Deno.test('skicka igen: länken är inte använd, så en ny inbjudan går till rollens vy', async () => {
  const v = varld({ konto: { id: 'k1', roll: 'tutor', namn: 'Sara Svensson' },
    auth: { bekraftad: false, valkommen: VALKOMMEN_LOSENORD } });
  const s = await hanteraInbjudan({ epost: 'sara@example.se', roll: 'parent', igen: true }, v.b);
  assertEquals(s, { status: 200, kropp: { ok: true, id: 'k1', till: 'sara@example.se', roll: 'tutor', skickat: 'inbjudan' } });
  assertEquals(v.logg, ['finns sara@example.se', 'auth k1', `länk invite sara@example.se {} ${TILLBAKA.tutor}`,
    'mejl sara@example.se']);
  assertEquals(v.mejl[0].amne, 'Ditt konto hos Nextrum, 7 oktober kl. 15:51');
  assert(v.mejl[0].text.startsWith('Hej Sara,'), 'namnet ur profilen');
});

// 2026-10-07: Skicka igen går när som helst. Ett konto som tryckt på
// länken får en länk för att välja lösenord, som Glömt lösenordet.
Deno.test('skicka igen: ett konto som tryckt på länken får en länk för att välja lösenord, till rollens vy', async () => {
  for (const [valkommen, roll, vy] of [[VALKOMMEN_LOSENORD, 'parent', '/foralder'], ['intro', 'parent', '/foralder'],
    [undefined, 'tutor', '/larare'], [null, 'parent', '/foralder']] as const) {
    const v = varld({ konto: { id: 'k1', roll }, auth: { bekraftad: true, valkommen } });
    const s = await hanteraInbjudan({ epost: 'anna@example.se', igen: true }, v.b);
    assertEquals(s.status, 200);
    assertEquals(s.kropp.skickat, 'losenord');
    assertEquals(v.logg, ['finns anna@example.se', 'auth k1', 'länk recovery anna@example.se {} https://nextrum.se' + vy,
      'mejl anna@example.se']);
    assertEquals(v.mejl[0].amne, 'Välj ditt lösenord hos Nextrum, 7 oktober kl. 15:51');
  }
});

Deno.test('skicka igen: hann kontot bekräftas under tiden blir det en lösenordslänk', async () => {
  const v = varld({ konto: { id: 'k1', roll: 'parent' }, auth: { bekraftad: false, valkommen: VALKOMMEN_LOSENORD },
    lankFel: { invite: 'A user with this email address has already been registered' } });
  const s = await hanteraInbjudan({ epost: 'anna@example.se', igen: true }, v.b);
  assertEquals(s.status, 200);
  assertEquals(s.kropp.skickat, 'losenord');
  assertEquals(v.logg.filter((r) => r.startsWith('länk')).map((r) => r.split(' ')[1]), ['invite', 'recovery']);
});

Deno.test('skicka igen: högst ett mejl i minuten till samma konto', async () => {
  const nyss = new Date(NU.getTime() - 30_000).toISOString();
  const v = varld({ konto: { id: 'k1', roll: 'parent' }, auth: { bekraftad: true, valkommen: 'intro', senast: nyss } });
  const s = await hanteraInbjudan({ epost: 'anna@example.se', igen: true }, v.b);
  assertEquals(s.status, 429);
  assertEquals(v.logg, ['finns anna@example.se', 'auth k1'], 'ingen länk och inget mejl');
  const forut = new Date(NU.getTime() - MELLAN_MEJL_MS - 1000).toISOString();
  const w = varld({ konto: { id: 'k1', roll: 'parent' }, auth: { bekraftad: true, valkommen: 'intro', senast: forut } });
  assertEquals((await hanteraInbjudan({ epost: 'anna@example.se', igen: true }, w.b)).status, 200);
});

Deno.test('skicka igen: Auth eller Resend säger nej, 502', async () => {
  const a = varld({ konto: { id: 'k1', roll: 'parent' }, auth: { bekraftad: true, valkommen: 'intro' },
    lankFel: { recovery: 'User not found' } });
  assertEquals((await hanteraInbjudan({ epost: 'anna@example.se', igen: true }, a.b)).status, 502);
  const b = varld({ konto: { id: 'k1', roll: 'parent' }, auth: { bekraftad: true, valkommen: 'intro' }, mejlFel: 'Resend 500' });
  assertEquals((await hanteraInbjudan({ epost: 'anna@example.se', igen: true }, b.b)).status, 502);
});
