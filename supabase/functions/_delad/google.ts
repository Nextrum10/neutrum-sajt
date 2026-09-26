// ============================================================
// NEXTRUM — delad hjälp: Google (Fas 18.1)
//
// Onlinepassen får en Meet-länk. Allt som pratar med Google står
// här, och det som avgör om ett svar från Google går att lita på.
// google-koppla och google-meet är tunna runt den här filen, och
// varje anrop tar emot sin fetch: proven i google_test.ts går utan
// nät och utan ett Google-konto.
//
// Databasen rör den här filen inte. Kopplingens rad och statusen
// adminvyn läser sköts i google_konto.ts.
//
//
// VARFÖR ETT GODKÄNNANDE AV ETT KONTO, INTE ETT TJÄNSTEKONTO
//
// INTEGRATIONER.md föreslog länge ett tjänstekonto med domänvid
// delegering. Det hade varit en nyckelfil som kan uppträda som
// VARJE konto i Nextrums Workspace, inom de scopes som delegerats,
// liggande som en secret på en edge-funktion. Nya Google
// Cloud-organisationer stänger dessutom av nyckelfiler som förval,
// så första steget hade varit att slå av ett skydd.
//
// Här godkänner en person, inloggad som info@nextrum.se, ett enda
// scope utöver sin e-postadress: att skapa Meet-rum. Det kontot
// äger rummen och ingenting annat nås. Nyckeln Google lämnar
// (refresh-token) går bara att använda tillsammans med
// klienthemligheten, och de två ligger på var sitt ställe: tokenen i
// tabellen google_koppling, hemligheten som secret.
//
//
// VARFÖR MEET-API:T OCH INTE EN KALENDERHÄNDELSE
//
// En länk som skapas genom en kalenderhändelse får Workspace
// förvalda åtkomst, oftast betrodd: den som inte är inbjuden och
// inloggad med rätt konto måste knacka, och bara någon från Nextrum
// kan släppa in. På ett pass är ingen från Nextrum med. Ett barn på
// skolans Chromebook hade stått utanför en dörr ingen öppnar.
//
// Meet-API:t tar emot åtkomsten när rummet skapas, och vi ber om
// OPEN: den som har länken går in. Svarar Google med något annat
// sparas länken inte (se atkomstVarning). En länk till en stängd
// dörr är värre än texten som säger att länken kommer i meddelanden.
// ============================================================

/** Workspace-domänen. Kontot som kopplas måste höra hit. */
export const DOMAN = 'nextrum.se';

/** Kontot som bör äga rummen. En rollbrevlåda försvinner inte när någon slutar. */
export const FORESLAGET_KONTO = 'info@nextrum.se';

/** Det enda scope som behövs för rummen. openid och email säger vem som godkände. */
export const MEET_SCOPE = 'https://www.googleapis.com/auth/meetings.space.created';
export const SCOPES = ['openid', 'email', MEET_SCOPE];

const BEHORIGHET = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const ATERKALLA = 'https://oauth2.googleapis.com/revoke';
const RUM = 'https://meet.googleapis.com/v2/spaces';

/** Så länge ett påbörjat godkännande gäller, i sekunder. */
export const LAGE_GILTIGT_S = 600;

/** Så länge ett anrop till Google får ta. Ett hängande anrop ska inte hålla passets sida. */
const TIDSGRANS_MS = 10_000;

export type Klient = { id: string; hemlighet: string };
export type Hamta = typeof fetch;

/** Klienten ur funktionens secrets. null om någon av dem saknas. */
export function klientUrMiljon(
  env: (namn: string) => string | undefined = (n) => Deno.env.get(n),
): Klient | null {
  const id = (env('GOOGLE_KLIENT_ID') ?? '').trim();
  const hemlighet = (env('GOOGLE_KLIENT_HEMLIGHET') ?? '').trim();
  return id && hemlighet ? { id, hemlighet } : null;
}

/** Adressen Google skickar tillbaka till. Måste stå exakt så i Google Cloud. */
export function aterkomstAdress(supabaseUrl: string): string {
  return String(supabaseUrl ?? '').replace(/\/+$/, '') + '/functions/v1/google-koppla';
}

/* ------------------------------------------------------------
   VART ADMIN SKICKAS TILLBAKA

   Ursprunget följer med i det signerade läget, så att den som kopplar
   från en lokal server också hamnar där. Listan är stängd: ett läge är
   visserligen signerat, men en omdirigering till en adress som någon
   annan valt är ett fel oavsett vem som signerade den.
   ------------------------------------------------------------ */
const URSPRUNG = [
  /^https:\/\/(www\.)?nextrum\.se$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/,
];
export const STANDARD_URSPRUNG = 'https://nextrum.se';

export function ursprungOk(v: unknown): v is string {
  return typeof v === 'string' && URSPRUNG.some((r) => r.test(v));
}

/* ------------------------------------------------------------
   DET SIGNERADE LÄGET (state)

   Google skickar tillbaka webbläsaren till google-koppla med en kod
   och det läge vi skickade med. Anropet bär ingen inloggning — det är
   en omdirigering, inte ett anrop från vyn — så läget är det enda som
   säger att en admin började kopplingen. Därför är det signerat med
   klienthemligheten, bär vem som började och tar slut efter tio
   minuter.

   Prefixet gör att en signatur av något annat med samma nyckel aldrig
   kan läsas som ett läge.
   ------------------------------------------------------------ */
const LAGE_PREFIX = 'google-koppla:v1:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type Lage = { admin: string; ursprung: string };

/* WebCrypto tar emot en ren ArrayBuffer i alla versioner av
   typdefinitionerna. Samma skäl som i notiser/token.ts. */
function buffert(bytes: ArrayLike<number>): ArrayBuffer {
  const ut = new ArrayBuffer(bytes.length);
  const vy = new Uint8Array(ut);
  for (let i = 0; i < bytes.length; i++) vy[i] = bytes[i];
  return ut;
}

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function franB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacNyckel(hemlighet: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'raw', buffert(new TextEncoder().encode(hemlighet)), { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign', 'verify'],
  );
}

export async function signeraLage(
  l: Lage & { utgarS: number },
  hemlighet: string,
): Promise<string> {
  const data = b64url(new TextEncoder().encode(JSON.stringify({ a: l.admin, u: l.ursprung, t: l.utgarS })));
  const sig = await crypto.subtle.sign(
    'HMAC', await hmacNyckel(hemlighet), buffert(new TextEncoder().encode(LAGE_PREFIX + data)));
  return data + '.' + b64url(new Uint8Array(sig));
}

/** Läget om det är äkta, oförändrat och inte gått ut. Annars null, aldrig ett fel. */
export async function lasLage(s: unknown, hemlighet: string, nuS: number): Promise<Lage | null> {
  if (typeof s !== 'string' || s.length > 2000) return null;
  const delar = s.split('.');
  if (delar.length !== 2) return null;
  const [data, sig] = delar;
  // HMAC-SHA256 är 32 byte: alltid 43 tecken i base64url utan utfyllnad.
  if (!/^[A-Za-z0-9_-]+$/.test(data) || !/^[A-Za-z0-9_-]{43}$/.test(sig)) return null;

  // verify jämför i konstant tid. En egen jämförelse av strängarna hade
  // läckt hur mycket av signaturen som stämde.
  let akta = false;
  try {
    akta = await crypto.subtle.verify(
      'HMAC', await hmacNyckel(hemlighet), buffert(franB64url(sig)),
      buffert(new TextEncoder().encode(LAGE_PREFIX + data)));
  } catch {
    return null;
  }
  if (!akta) return null;

  let p: { a?: unknown; u?: unknown; t?: unknown };
  try {
    p = JSON.parse(new TextDecoder().decode(franB64url(data)));
  } catch {
    return null;
  }
  if (!p || typeof p.a !== 'string' || !UUID.test(p.a)) return null;
  if (!ursprungOk(p.u)) return null;
  if (typeof p.t !== 'number' || !Number.isFinite(p.t)) return null;
  if (p.t < nuS) return null;
  // Ett läge som sägs gälla längre än vi någonsin skriver har inte
  // skrivits av oss, signatur eller inte.
  if (p.t > nuS + LAGE_GILTIGT_S + 60) return null;
  return { admin: p.a, ursprung: p.u };
}

/* ------------------------------------------------------------
   GODKÄNNANDET
   ------------------------------------------------------------ */

/**
 * Adressen admin skickas till hos Google.
 *
 * prompt=consent: Google lämnar bara en refresh-token när någon
 * faktiskt godkänner. Utan den får den som kopplar om samma konto en
 * andra gång ingen token alls, och kopplingen ser ut att ha gått bra.
 *
 * hd och login_hint är förslag till Google, inte skydd. Skyddet är
 * kontoOk, som prövar vem som faktiskt loggade in.
 */
export function behorighetsAdress(o: { klient: Klient; aterkomst: string; lage: string }): string {
  const p = new URLSearchParams({
    client_id: o.klient.id,
    redirect_uri: o.aterkomst,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    hd: DOMAN,
    login_hint: FORESLAGET_KONTO,
    state: o.lage,
  });
  return BEHORIGHET + '?' + p.toString();
}

/* ------------------------------------------------------------
   FELEN

   Sorten avgör vad som händer sedan, inte texten:

     utgangen     Google godtar inte tokenen (eller koden) längre.
                  Kopplingen finns inte, och det enda som hjälper är
                  att koppla igen.
     klienten     Klient-id, hemlighet eller återkomstadress stämmer
                  inte med Google Cloud. Samma svar varje gång.
     api_av       Google Meet REST API är inte påslaget i projektet.
     nekad        Google sa nej av ett annat skäl, till exempel att
                  scopet inte godkändes.
     tillfalligt  Google svarade inte, eller bad oss vänta.
     svaret       Google svarade, men inte med något vi känner igen.
   ------------------------------------------------------------ */
export type GoogleFelSort = 'utgangen' | 'klienten' | 'api_av' | 'nekad' | 'tillfalligt' | 'svaret';

export class GoogleFel extends Error {
  constructor(public sort: GoogleFelSort, public status: number, message: string) {
    super(message);
    this.name = 'GoogleFel';
  }
}

type Kropp = Record<string, unknown>;

async function lasKropp(svar: Response): Promise<Kropp> {
  try {
    const k = await svar.json();
    return k && typeof k === 'object' ? k as Kropp : {};
  } catch {
    return {};
  }
}

async function skicka(hamta: Hamta, adress: string, init: RequestInit): Promise<{ status: number; kropp: Kropp }> {
  let svar: Response;
  try {
    svar = await hamta(adress, { ...init, signal: AbortSignal.timeout(TIDSGRANS_MS) });
  } catch (e) {
    throw new GoogleFel('tillfalligt', 0, 'Google gick inte att nå: ' + ((e as Error)?.name || 'okänt fel') + '.');
  }
  return { status: svar.status, kropp: await lasKropp(svar) };
}

function formular(f: Record<string, string>): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(f).toString(),
  };
}

/** Tokenändpunktens fel, som OAuth skriver dem: { error, error_description }. */
function tokenfel(status: number, kropp: Kropp): GoogleFel {
  const kod = String(kropp.error ?? '');
  const text = String(kropp.error_description ?? kod ?? '').slice(0, 200);
  if (kod === 'invalid_grant') return new GoogleFel('utgangen', status, text || 'invalid_grant');
  if (kod === 'invalid_client' || kod === 'unauthorized_client' || kod === 'redirect_uri_mismatch') {
    return new GoogleFel('klienten', status, text || kod);
  }
  if (status === 429 || status >= 500) return new GoogleFel('tillfalligt', status, text || 'HTTP ' + status);
  return new GoogleFel('nekad', status, text || 'HTTP ' + status);
}

export type Tokens = { atkomst: string; refresh: string | null; scope: string; idToken: string | null };

/** Byter engångskoden från Google mot tokens. Koden gäller en gång, i några minuter. */
export async function bytKod(kod: string, klient: Klient, aterkomst: string, hamta: Hamta = fetch): Promise<Tokens> {
  const { status, kropp } = await skicka(hamta, TOKEN, formular({
    code: kod,
    client_id: klient.id,
    client_secret: klient.hemlighet,
    redirect_uri: aterkomst,
    grant_type: 'authorization_code',
  }));
  if (status !== 200) throw tokenfel(status, kropp);
  if (typeof kropp.access_token !== 'string' || !kropp.access_token) {
    throw new GoogleFel('svaret', status, 'Svaret saknade access_token.');
  }
  return {
    atkomst: kropp.access_token,
    refresh: typeof kropp.refresh_token === 'string' && kropp.refresh_token ? kropp.refresh_token : null,
    scope: typeof kropp.scope === 'string' ? kropp.scope : '',
    idToken: typeof kropp.id_token === 'string' ? kropp.id_token : null,
  };
}

/** En åtkomst i en timme, ur den sparade refresh-tokenen. */
export async function fornya(refresh: string, klient: Klient, hamta: Hamta = fetch): Promise<string> {
  const { status, kropp } = await skicka(hamta, TOKEN, formular({
    grant_type: 'refresh_token',
    refresh_token: refresh,
    client_id: klient.id,
    client_secret: klient.hemlighet,
  }));
  if (status !== 200) throw tokenfel(status, kropp);
  if (typeof kropp.access_token !== 'string' || !kropp.access_token) {
    throw new GoogleFel('svaret', status, 'Svaret saknade access_token.');
  }
  return kropp.access_token;
}

/** Stänger tokenen hos Google. Sant också om den redan var stängd. */
export async function aterkalla(token: string, hamta: Hamta = fetch): Promise<boolean> {
  try {
    const { status, kropp } = await skicka(hamta, ATERKALLA, formular({ token }));
    return status === 200 || kropp.error === 'invalid_token';
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------
   VEM SOM GODKÄNDE

   id_token kommer direkt från Googles tokenändpunkt, över TLS och i
   utbyte mot vår hemlighet. Då räcker det att läsa den; signaturen
   behöver inte prövas (OpenID Connect Core 3.1.3.7, punkt 6). aud och
   iss prövas ändå: de är billiga, och en token till någon annans klient
   ska inte gå att läsa som vår.
   ------------------------------------------------------------ */
export type IdUppgifter = { epost: string; verifierad: boolean; doman: string | null };

export function lasIdToken(idToken: string | null, klientId: string): IdUppgifter | null {
  if (!idToken) return null;
  const delar = idToken.split('.');
  if (delar.length !== 3) return null;
  let p: Kropp;
  try {
    p = JSON.parse(new TextDecoder().decode(franB64url(delar[1])));
  } catch {
    return null;
  }
  if (!p || typeof p !== 'object') return null;
  if (p.aud !== klientId) return null;
  if (p.iss !== 'https://accounts.google.com' && p.iss !== 'accounts.google.com') return null;
  if (typeof p.email !== 'string' || !p.email.includes('@')) return null;
  return {
    epost: p.email.trim().toLowerCase(),
    verifierad: p.email_verified === true || p.email_verified === 'true',
    doman: typeof p.hd === 'string' && p.hd ? p.hd.trim().toLowerCase() : null,
  };
}

/**
 * Hör kontot till Nextrums Workspace?
 *
 * Ett privat Gmail-konto har ingen hd. Det är det fel som ska stoppas:
 * rummen hade ägts av en privatperson, och i ett Google Cloud-projekt
 * utanför organisationen går en token ut efter sju dagar medan
 * projektet står i testläge. Kopplingen hade dött en vecka senare
 * utan att någon förstod varför.
 */
export function kontoOk(u: IdUppgifter | null): boolean {
  if (!u || !u.verifierad || !u.doman) return false;
  return u.doman === DOMAN || u.epost.endsWith('@' + DOMAN);
}

/** Godkände personen rummen? Google låter den som godkänner kryssa ur enskilda scopes. */
export function harMeetScope(scope: string): boolean {
  return String(scope ?? '').split(/\s+/).includes(MEET_SCOPE);
}

/* ------------------------------------------------------------
   RUMMET
   ------------------------------------------------------------ */

/* Bara https, bara meet.google.com, bara en mötesskod i sökvägen.
   Samma form som villkoret på pass_moten.lank, och samma som vyerna
   prövar innan något blir en länk. */
const MEET = /^https:\/\/meet\.google\.com\/[a-z]+-[a-z]+-[a-z]+$/;

export function arMeetLank(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 60 && MEET.test(v);
}

export type Rum = { lank: string; rum: string; atkomst: string | null };

/** Googles API-fel: { error: { code, message, status, details: [{ reason }] } }. */
function apifel(status: number, kropp: Kropp): GoogleFel {
  const e = (kropp.error && typeof kropp.error === 'object' ? kropp.error : {}) as Kropp;
  const text = String(e.message ?? '').slice(0, 300) || 'HTTP ' + status;
  const skal = Array.isArray(e.details)
    ? (e.details as Kropp[]).map((d) => String(d?.reason ?? '')).filter(Boolean)
    : [];
  /* 401 här är INTE utgangen. Åtkomsten är nypräglad ur tokenen, och
     bara tokenändpunkten kan säga att kopplingen är död. Ett 401 från
     Meet med en färsk åtkomst är något annat, och ska inte koppla bort
     någonting. */
  if (status === 403 && (skal.includes('SERVICE_DISABLED') || /has not been used|is disabled/i.test(text))) {
    return new GoogleFel('api_av', status, text);
  }
  if (status === 429 || status >= 500) return new GoogleFel('tillfalligt', status, text);
  if (status === 401 || status === 403) return new GoogleFel('nekad', status, text);
  return new GoogleFel('svaret', status, text);
}

/** Ett nytt Meet-rum, öppet för den som har länken. */
export async function skapaRum(atkomst: string, hamta: Hamta = fetch): Promise<Rum> {
  const { status, kropp } = await skicka(hamta, RUM, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + atkomst, 'content-type': 'application/json' },
    body: JSON.stringify({ config: { accessType: 'OPEN' } }),
  });
  if (status !== 200) throw apifel(status, kropp);
  const lank = kropp.meetingUri;
  const namn = kropp.name;
  if (!arMeetLank(lank)) {
    throw new GoogleFel('svaret', status, 'Länken i svaret har inte formen https://meet.google.com/xxx-xxxx-xxx.');
  }
  if (typeof namn !== 'string' || !/^spaces\/[A-Za-z0-9_-]{1,100}$/.test(namn)) {
    throw new GoogleFel('svaret', status, 'Svaret saknade rummets namn.');
  }
  const config = (kropp.config && typeof kropp.config === 'object' ? kropp.config : {}) as Kropp;
  return { lank, rum: namn, atkomst: typeof config.accessType === 'string' ? config.accessType : null };
}

/**
 * null om rummet är öppet. Annars vad som är fel och var det rättas.
 *
 * Workspace kan vara inställt så att öppna möten inte tillåts. Då
 * skapar Google rummet med en annan åtkomst i stället för att säga nej,
 * och det enda som avslöjar det är config.accessType i svaret.
 */
export function atkomstVarning(atkomst: string | null): string | null {
  if (atkomst === 'OPEN') return null;
  return 'Google skapade rummet som ' + (atkomst || 'okänd åtkomst') + ' i stället för öppet. Då måste den som '
    + 'inte hör till Nextrum knacka, och ingen från Nextrum är med på passen för att släppa in, så länken sparas '
    + 'inte. Tillåt att möten är öppna för alla med länken i Google Admin under Appar → Google Workspace → '
    + 'Google Meet, och tryck Prova igen.';
}

/** Vad admin ska läsa om ett fel. Kort, och alltid med vad som görs åt det. */
export function feltext(e: unknown): string {
  if (!(e instanceof GoogleFel)) return (e as Error)?.message || 'Okänt fel.';
  switch (e.sort) {
    case 'utgangen':
      return 'Google godtar inte kopplingen längre: den har dragits tillbaka, eller kontots lösenord eller '
        + 'behörighet har ändrats. Koppla Google igen.';
    case 'klienten':
      return 'Google känner inte igen klienten (' + e.message + '). Kontrollera GOOGLE_KLIENT_ID och '
        + 'GOOGLE_KLIENT_HEMLIGHET, och att återkomstadressen i Google Cloud är exakt den som står i INTEGRATIONER.md.';
    case 'api_av':
      return 'Google Meet REST API är inte påslaget i Google Cloud-projektet. Slå på det under API:er och tjänster, '
        + 'vänta en minut och tryck Prova.';
    case 'nekad':
      return 'Google sa nej (' + e.message + '). Kontrollera att kontot får skapa Meet-möten, och att rutan för '
        + 'Google Meet var ikryssad när kopplingen godkändes. Koppla annars igen.';
    case 'tillfalligt':
      return 'Google svarade inte (' + (e.status || 'inget svar') + '). Det brukar gå över. Tryck Prova om en stund.';
    default:
      return 'Google svarade med något vi inte känner igen: ' + e.message;
  }
}
