// ============================================================
// Proven för google.ts. Inget nät: varje anrop till Google går genom
// en fetch som proven själva skriver svaret till.
//
//   deno test --allow-env supabase/functions/_delad/
//
// Det som vaktas är det som annars bara syns i drift: att
// klienthemligheten aldrig står i adressen till Google, att ett
// ändrat eller gammalt läge nekas, att en länk bara blir en länk om
// den leder till meet.google.com, och att ett rum som inte blev öppet
// säger det.
// ============================================================

import { assert, assertEquals, assertFalse, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  aterkalla, aterkomstAdress, arMeetLank, atkomstVarning, behorighetsAdress, bytKod, feltext, fornya,
  GoogleFel, harMeetScope, type Hamta, klientUrMiljon, kontoOk, LAGE_GILTIGT_S, lasIdToken, lasLage,
  MEET_SCOPE, signeraLage, skapaRum, ursprungOk,
} from './google.ts';

const KLIENT = { id: '123-abc.apps.googleusercontent.com', hemlighet: 'GOCSPX-hemlig-hemlighet' };
const ADMIN = '5f0c8a8e-2b7d-4c3e-9a1f-0d2e4b6c8a10';
const NU = 1_790_000_000;

type Anrop = { adress: string; init: RequestInit };

/** En fetch som svarar med det provet bestämt och minns vad den fick. */
function falsk(status: number, kropp: unknown): { hamta: Hamta; anrop: Anrop[] } {
  const anrop: Anrop[] = [];
  const hamta = ((adress: string | URL | Request, init?: RequestInit) => {
    anrop.push({ adress: String(adress), init: init ?? {} });
    return Promise.resolve(new Response(JSON.stringify(kropp), {
      status, headers: { 'content-type': 'application/json' },
    }));
  }) as Hamta;
  return { hamta, anrop };
}

function trasig(): Hamta {
  return (() => Promise.reject(new TypeError('network down'))) as Hamta;
}

function formularet(a: Anrop): URLSearchParams {
  return new URLSearchParams(String(a.init.body ?? ''));
}

/** En id_token som Google skriver dem. Signaturen läses aldrig. */
function idToken(payload: Record<string, unknown>): string {
  const b = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return b({ alg: 'RS256', typ: 'JWT' }) + '.' + b(payload) + '.c2lnbmF0dXI';
}

async function fel(p: Promise<unknown>): Promise<GoogleFel> {
  try {
    await p;
  } catch (e) {
    assert(e instanceof GoogleFel, 'väntade ett GoogleFel, fick ' + e);
    return e;
  }
  throw new Error('Anropet skulle ha kastat.');
}

// ---------- klienten och adresserna ----------

Deno.test('klienten kräver både id och hemlighet', () => {
  const env = (m: Record<string, string>) => (n: string) => m[n];
  assertEquals(klientUrMiljon(env({ GOOGLE_KLIENT_ID: ' id ', GOOGLE_KLIENT_HEMLIGHET: ' h ' })), { id: 'id', hemlighet: 'h' });
  assertEquals(klientUrMiljon(env({ GOOGLE_KLIENT_ID: 'id' })), null);
  assertEquals(klientUrMiljon(env({ GOOGLE_KLIENT_HEMLIGHET: 'h' })), null);
  assertEquals(klientUrMiljon(env({ GOOGLE_KLIENT_ID: ' ', GOOGLE_KLIENT_HEMLIGHET: 'h' })), null);
});

Deno.test('återkomstadressen är funktionens egen, med eller utan snedstreck', () => {
  const v = 'https://ddkfiuvcppalutfulvbi.supabase.co/functions/v1/google-koppla';
  assertEquals(aterkomstAdress('https://ddkfiuvcppalutfulvbi.supabase.co'), v);
  assertEquals(aterkomstAdress('https://ddkfiuvcppalutfulvbi.supabase.co/'), v);
});

Deno.test('admin skickas bara tillbaka till nextrum.se eller en lokal server', () => {
  for (const ok of ['https://nextrum.se', 'https://www.nextrum.se', 'http://localhost:8951', 'http://127.0.0.1:8951', 'http://localhost']) {
    assert(ursprungOk(ok), ok);
  }
  for (const nej of [
    'https://nextrum.se.evil.com', 'https://evil.com', 'http://nextrum.se', 'https://nextrum.se/',
    'https://sub.nextrum.se', 'https://nextrum.se:8443', 'javascript:alert(1)', 'https://nextrum.se@evil.com',
    '', null, undefined, 42,
  ]) {
    assertFalse(ursprungOk(nej), String(nej));
  }
});

// ---------- läget ----------

Deno.test('ett läge vi signerat läses tillbaka', async () => {
  const s = await signeraLage({ admin: ADMIN, ursprung: 'https://nextrum.se', utgarS: NU + LAGE_GILTIGT_S }, KLIENT.hemlighet);
  assertEquals(await lasLage(s, KLIENT.hemlighet, NU), { admin: ADMIN, ursprung: 'https://nextrum.se' });
});

Deno.test('ett ändrat läge nekas, i datan och i signaturen', async () => {
  const s = await signeraLage({ admin: ADMIN, ursprung: 'https://nextrum.se', utgarS: NU + 60 }, KLIENT.hemlighet);
  const [data, sig] = s.split('.');
  const byt = (t: string, i: number) => t.slice(0, i) + (t[i] === 'A' ? 'B' : 'A') + t.slice(i + 1);
  assertEquals(await lasLage(byt(data, 3) + '.' + sig, KLIENT.hemlighet, NU), null);
  assertEquals(await lasLage(data + '.' + byt(sig, 5), KLIENT.hemlighet, NU), null);
  assertEquals(await lasLage(s, 'en annan hemlighet', NU), null);
});

Deno.test('ett gammalt läge nekas, liksom ett som gäller för länge', async () => {
  const gammalt = await signeraLage({ admin: ADMIN, ursprung: 'https://nextrum.se', utgarS: NU - 1 }, KLIENT.hemlighet);
  assertEquals(await lasLage(gammalt, KLIENT.hemlighet, NU), null);
  const forLange = await signeraLage({ admin: ADMIN, ursprung: 'https://nextrum.se', utgarS: NU + 86400 }, KLIENT.hemlighet);
  assertEquals(await lasLage(forLange, KLIENT.hemlighet, NU), null);
});

Deno.test('ett signerat läge med främmande ursprung eller admin nekas ändå', async () => {
  const ursprung = await signeraLage({ admin: ADMIN, ursprung: 'https://evil.com', utgarS: NU + 60 }, KLIENT.hemlighet);
  assertEquals(await lasLage(ursprung, KLIENT.hemlighet, NU), null);
  const admin = await signeraLage({ admin: 'inte-ett-uuid', ursprung: 'https://nextrum.se', utgarS: NU + 60 }, KLIENT.hemlighet);
  assertEquals(await lasLage(admin, KLIENT.hemlighet, NU), null);
});

Deno.test('skräp i läget är null, aldrig ett fel', async () => {
  for (const s of ['', 'a', 'a.b', 'a.b.c', '!!!.???', 'x'.repeat(3000), null, undefined, 7, {}]) {
    assertEquals(await lasLage(s, KLIENT.hemlighet, NU), null);
  }
});

// ---------- adressen till Google ----------

Deno.test('adressen till Google bär aldrig klienthemligheten', () => {
  const url = new URL(behorighetsAdress({ klient: KLIENT, aterkomst: 'https://x.supabase.co/functions/v1/google-koppla', lage: 'LAGE' }));
  assertFalse(url.toString().includes(KLIENT.hemlighet));
  assertFalse(url.searchParams.has('client_secret'));
  assertEquals(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assertEquals(url.searchParams.get('client_id'), KLIENT.id);
  assertEquals(url.searchParams.get('redirect_uri'), 'https://x.supabase.co/functions/v1/google-koppla');
  assertEquals(url.searchParams.get('state'), 'LAGE');
  assertEquals(url.searchParams.get('access_type'), 'offline');
  assertEquals(url.searchParams.get('prompt'), 'consent');
  assert(harMeetScope(url.searchParams.get('scope') ?? ''));
});

// ---------- tokens ----------

Deno.test('koden byts mot tokens med hemligheten i kroppen', async () => {
  const { hamta, anrop } = falsk(200, {
    access_token: 'ya29.a', refresh_token: '1//r', scope: 'openid ' + MEET_SCOPE, id_token: 'x.y.z',
  });
  const t = await bytKod('4/kod', KLIENT, 'https://x/functions/v1/google-koppla', hamta);
  assertEquals(t, { atkomst: 'ya29.a', refresh: '1//r', scope: 'openid ' + MEET_SCOPE, idToken: 'x.y.z' });
  assertEquals(anrop.length, 1);
  assertEquals(anrop[0].adress, 'https://oauth2.googleapis.com/token');
  const f = formularet(anrop[0]);
  assertEquals(f.get('grant_type'), 'authorization_code');
  assertEquals(f.get('code'), '4/kod');
  assertEquals(f.get('client_secret'), KLIENT.hemlighet);
  assertEquals(f.get('redirect_uri'), 'https://x/functions/v1/google-koppla');
});

Deno.test('tokenändpunktens fel får rätt sort', async () => {
  assertEquals((await fel(bytKod('k', KLIENT, 'a', falsk(400, { error: 'invalid_grant' }).hamta))).sort, 'utgangen');
  assertEquals((await fel(bytKod('k', KLIENT, 'a', falsk(401, { error: 'invalid_client' }).hamta))).sort, 'klienten');
  assertEquals((await fel(bytKod('k', KLIENT, 'a', falsk(400, { error: 'redirect_uri_mismatch' }).hamta))).sort, 'klienten');
  assertEquals((await fel(bytKod('k', KLIENT, 'a', falsk(503, {}).hamta))).sort, 'tillfalligt');
  assertEquals((await fel(bytKod('k', KLIENT, 'a', trasig()))).sort, 'tillfalligt');
  assertEquals((await fel(bytKod('k', KLIENT, 'a', falsk(200, { scope: 'x' }).hamta))).sort, 'svaret');
});

Deno.test('förnyelsen skickar tokenen och tar emot en åtkomst', async () => {
  const { hamta, anrop } = falsk(200, { access_token: 'ya29.b', expires_in: 3599 });
  assertEquals(await fornya('1//r', KLIENT, hamta), 'ya29.b');
  const f = formularet(anrop[0]);
  assertEquals(f.get('grant_type'), 'refresh_token');
  assertEquals(f.get('refresh_token'), '1//r');
});

Deno.test('en återkallad token är utgangen, en hicka är tillfällig', async () => {
  const utg = await fel(fornya('r', KLIENT, falsk(400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }).hamta));
  assertEquals(utg.sort, 'utgangen');
  assertStringIncludes(feltext(utg), 'Koppla Google igen');
  assertEquals((await fel(fornya('r', KLIENT, falsk(500, {}).hamta))).sort, 'tillfalligt');
  assertEquals((await fel(fornya('r', KLIENT, falsk(429, {}).hamta))).sort, 'tillfalligt');
});

Deno.test('återkallelsen är sann också när tokenen redan var stängd', async () => {
  assert(await aterkalla('t', falsk(200, {}).hamta));
  assert(await aterkalla('t', falsk(400, { error: 'invalid_token' }).hamta));
  assertFalse(await aterkalla('t', falsk(500, {}).hamta));
  assertFalse(await aterkalla('t', trasig()));
});

// ---------- vem som godkände ----------

Deno.test('id_token läses bara om den är till oss och från Google', () => {
  const rätt = { aud: KLIENT.id, iss: 'https://accounts.google.com', email: 'Info@Nextrum.se', email_verified: true, hd: 'nextrum.se' };
  assertEquals(lasIdToken(idToken(rätt), KLIENT.id), { epost: 'info@nextrum.se', verifierad: true, doman: 'nextrum.se' });
  assertEquals(lasIdToken(idToken({ ...rätt, iss: 'accounts.google.com', email_verified: 'true' }), KLIENT.id)?.verifierad, true);
  assertEquals(lasIdToken(idToken({ ...rätt, aud: 'någon-annans-klient' }), KLIENT.id), null);
  assertEquals(lasIdToken(idToken({ ...rätt, iss: 'https://evil.com' }), KLIENT.id), null);
  assertEquals(lasIdToken(idToken({ ...rätt, email: undefined }), KLIENT.id), null);
  assertEquals(lasIdToken('inte.en', KLIENT.id), null);
  assertEquals(lasIdToken('a.!!!.c', KLIENT.id), null);
  assertEquals(lasIdToken(null, KLIENT.id), null);
});

Deno.test('bara ett verifierat konto i Nextrums Workspace duger', () => {
  assert(kontoOk({ epost: 'info@nextrum.se', verifierad: true, doman: 'nextrum.se' }));
  assert(kontoOk({ epost: 'leo@nextrum.se', verifierad: true, doman: 'nextrum.se' }));
  // Ett privat Gmail-konto har ingen hd.
  assertFalse(kontoOk({ epost: 'leo.thriskos@gmail.com', verifierad: true, doman: null }));
  assertFalse(kontoOk({ epost: 'x@annat.se', verifierad: true, doman: 'annat.se' }));
  assertFalse(kontoOk({ epost: 'info@nextrum.se', verifierad: false, doman: 'nextrum.se' }));
  assertFalse(kontoOk(null));
});

Deno.test('Meet-scopet räknas bara som helt ord', () => {
  assert(harMeetScope('openid email ' + MEET_SCOPE));
  assert(harMeetScope(MEET_SCOPE + ' openid'));
  assertFalse(harMeetScope('openid email'));
  assertFalse(harMeetScope(MEET_SCOPE + '.readonly'));
  assertFalse(harMeetScope(''));
});

// ---------- rummet ----------

Deno.test('bara en adress hos meet.google.com med en mötesskod är en Meet-länk', () => {
  assert(arMeetLank('https://meet.google.com/abc-defg-hij'));
  for (const nej of [
    'http://meet.google.com/abc-defg-hij',
    'https://meet.google.com.evil.com/abc-defg-hij',
    'https://evil.com/?https://meet.google.com/abc-defg-hij',
    'https://user@meet.google.com/abc-defg-hij',
    'https://meet.google.com/abc-defg-hij?authuser=1',
    'https://meet.google.com/abc-defg-hij/x',
    'https://meet.google.com/ABC-DEFG-HIJ',
    'https://meet.google.com/lookup/abc',
    'https://meet.google.com/',
    'javascript:alert(1)//https://meet.google.com/abc-defg-hij',
    ' https://meet.google.com/abc-defg-hij',
    null, 42,
  ]) {
    assertFalse(arMeetLank(nej), String(nej));
  }
});

Deno.test('rummet skapas öppet, med åtkomsten i headern', async () => {
  const { hamta, anrop } = falsk(200, {
    name: 'spaces/jQCFfuBOdN5z', meetingUri: 'https://meet.google.com/abc-mnop-xyz', meetingCode: 'abc-mnop-xyz',
    config: { accessType: 'OPEN', entryPointAccess: 'ALL' },
  });
  const rum = await skapaRum('ya29.c', hamta);
  assertEquals(rum, { lank: 'https://meet.google.com/abc-mnop-xyz', rum: 'spaces/jQCFfuBOdN5z', atkomst: 'OPEN' });
  assertEquals(anrop[0].adress, 'https://meet.googleapis.com/v2/spaces');
  assertEquals((anrop[0].init.headers as Record<string, string>).authorization, 'Bearer ya29.c');
  assertEquals(JSON.parse(String(anrop[0].init.body)), { config: { accessType: 'OPEN' } });
  assertEquals(atkomstVarning(rum.atkomst), null);
});

Deno.test('ett rum som inte blev öppet säger det', async () => {
  const rum = await skapaRum('t', falsk(200, {
    name: 'spaces/a', meetingUri: 'https://meet.google.com/abc-mnop-xyz', config: { accessType: 'TRUSTED' },
  }).hamta);
  assertEquals(rum.atkomst, 'TRUSTED');
  assertStringIncludes(atkomstVarning(rum.atkomst) ?? '', 'TRUSTED');
  assertStringIncludes(atkomstVarning(null) ?? '', 'okänd åtkomst');
});

Deno.test('ett svar med en främmande länk blir inget rum', async () => {
  const f = await fel(skapaRum('t', falsk(200, { name: 'spaces/a', meetingUri: 'https://evil.com/abc-defg-hij' }).hamta));
  assertEquals(f.sort, 'svaret');
  assertEquals((await fel(skapaRum('t', falsk(200, { meetingUri: 'https://meet.google.com/abc-defg-hij' }).hamta))).sort, 'svaret');
});

Deno.test('Meet-API:ts fel får rätt sort', async () => {
  const av = { error: { code: 403, status: 'PERMISSION_DENIED', message: 'Google Meet REST API has not been used in project 1 before or it is disabled.', details: [{ reason: 'SERVICE_DISABLED' }] } };
  const apiAv = await fel(skapaRum('t', falsk(403, av).hamta));
  assertEquals(apiAv.sort, 'api_av');
  assertStringIncludes(feltext(apiAv), 'Google Meet REST API');
  assertEquals((await fel(skapaRum('t', falsk(403, { error: { message: 'nej' } }).hamta))).sort, 'nekad');
  // En färsk åtkomst som Meet inte godtar är inte ett dött godkännande.
  assertEquals((await fel(skapaRum('t', falsk(401, { error: { message: 'bad' } }).hamta))).sort, 'nekad');
  assertEquals((await fel(skapaRum('t', falsk(503, {}).hamta))).sort, 'tillfalligt');
  assertEquals((await fel(skapaRum('t', trasig()))).sort, 'tillfalligt');
});

Deno.test('feltexten säger alltid något, också om ett vanligt fel', () => {
  for (const sort of ['utgangen', 'klienten', 'api_av', 'nekad', 'tillfalligt', 'svaret'] as const) {
    assert(feltext(new GoogleFel(sort, 400, 'x')).length > 20, sort);
  }
  assertEquals(feltext(new Error('rå text')), 'rå text');
  assertEquals(feltext('inget fel alls'), 'Okänt fel.');
  const e = new GoogleFel('nekad', 403, 'x');
  assert(e instanceof Error);
  assertEquals(e.name, 'GoogleFel');
});
