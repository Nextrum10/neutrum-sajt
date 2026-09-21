// ============================================================
// NEXTRUM — avregistreringslänken, version 2
//
//   <uid>.<kanal>.<typ>.<base64url(HMAC-SHA256(nyckel,
//        "avanmal:v2:" + uid + ":" + kanal + ":" + typ))>
//
// typ är en notistyp eller 'alla'. Nyckeln är 32 slumpade byte som
// databasen lämnar ut som base64 (notis_avregistreringsnyckel(), bara
// service_role).
//
// VAD TOKENEN KAN: stänga av EN sak för EN person, utan inloggning.
// Det är hela poängen med en länk i ett mejl. Den loggar inte in
// någon, visar ingenting och kan inte slå på något igen; det görs
// inloggad, under Profil. Den rör aldrig profiles: notis_avregistrera
// skriver bara i notis_val.
//
// VARFÖR v2: arkivets token (funktioner-arkiv/notis-ko) signerade
// bara 'avanmal:' + uid och stängde av allt på en gång. Prefixet
// v2 gör att en gammal signatur aldrig kan tolkas som en ny, även om
// nyckeln skulle vara densamma.
//
// Ingen utgångstid, med flit: en länk i ett mejl från i våras ska
// fortfarande fungera. Byts nyckeln i notis_konfig slutar alla gamla
// länkar att gälla, och inget annat händer.
// ============================================================

import { arKanal, arNotisTyp, type Kanal, type NotisTyp } from './typer.ts';

export type TokenTyp = NotisTyp | 'alla';
export type Avregistrering = { uid: string; kanal: Kanal; typ: TokenTyp };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/* HMAC-SHA256 är 32 byte, alltid 43 tecken i base64url utan utfyllnad. */
const SIGNATUR_LANGD = 43;
const SIGNATUR = /^[A-Za-z0-9_-]{43}$/;

function typOk(v: unknown): v is TokenTyp {
  return v === 'alla' || arNotisTyp(v);
}

/* Bufferten byggs som en ren ArrayBuffer. WebCrypto tar emot det i
   alla versioner av typdefinitionerna; en Uint8Array från
   TextEncoder har bytt typ mellan TypeScript-versioner och fäller
   då typkontrollen i CI utan att koden ändrats. */
function buffert(bytes: ArrayLike<number>): ArrayBuffer {
  const ut = new ArrayBuffer(bytes.length);
  const vy = new Uint8Array(ut);
  for (let i = 0; i < bytes.length; i++) vy[i] = bytes[i];
  return ut;
}

function nyckelBuffert(nyckelB64: string): ArrayBuffer {
  let bin: string;
  try {
    bin = atob(String(nyckelB64 ?? '').trim());
  } catch {
    throw new Error('Avregistreringsnyckeln är inte giltig base64.');
  }
  // 32 byte i databasen. Under 16 är något fel, och en kort nyckel
  // ska inte tyst signera länkar.
  if (bin.length < 16) throw new Error('Avregistreringsnyckeln är för kort.');
  return buffert(Array.from(bin, (c) => c.charCodeAt(0)));
}

async function signera(nyckelB64: string, text: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    'raw', nyckelBuffert(nyckelB64), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, buffert(new TextEncoder().encode(text)));
  return new Uint8Array(sig);
}

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function meddelande(uid: string, kanal: Kanal, typ: TokenTyp): string {
  return `avanmal:v2:${uid}:${kanal}:${typ}`;
}

export async function skapaToken(uid: string, kanal: Kanal, typ: TokenTyp, nyckelB64: string): Promise<string> {
  if (!UUID.test(uid) || !arKanal(kanal) || !typOk(typ)) {
    throw new Error('Tokenen kan bara göras för ett konto, en kanal och en känd typ.');
  }
  return `${uid}.${kanal}.${typ}.${b64url(await signera(nyckelB64, meddelande(uid, kanal, typ)))}`;
}

/**
 * Svarar med vem, vilken kanal och vilken typ om tokenen är äkta,
 * annars null. Signaturen jämförs som text, tecken för tecken utan
 * att avbryta vid första skillnaden, så att svarstiden inte avslöjar
 * hur mycket av en gissning som stämde.
 *
 * Texten jämförs, inte de avkodade bytena: base64 har två bitar över
 * i sista tecknet, och en avkodning bryr sig inte om dem. Två olika
 * strängar hade då räknats som samma signatur.
 */
export async function lasToken(token: unknown, nyckelB64: string): Promise<Avregistrering | null> {
  const delar = String(token ?? '').trim().split('.');
  if (delar.length !== 4) return null;
  const [uid, kanal, typ, sig] = delar;
  if (!UUID.test(uid) || !arKanal(kanal) || !typOk(typ)) return null;
  if (!SIGNATUR.test(sig)) return null;

  const vantad = b64url(await signera(nyckelB64, meddelande(uid, kanal, typ)));
  let skillnad = 0;
  for (let i = 0; i < SIGNATUR_LANGD; i++) skillnad |= sig.charCodeAt(i) ^ vantad.charCodeAt(i);
  return skillnad === 0 ? { uid, kanal, typ } : null;
}
