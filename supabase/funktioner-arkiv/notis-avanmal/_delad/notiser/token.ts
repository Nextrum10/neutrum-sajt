// ============================================================
// NEXTRUM — avanmälningstoken
//
// user_id + HMAC-SHA256 med avanmal_nyckel ur notis_konfig. Tokenen
// kan EN sak: stänga av notismejl för just den användaren. Den loggar
// inte in någon, visar ingenting och kan inte slå PÅ notiser igen
// (det kräver inloggning). Den måste fungera utan inloggning — det är
// hela poängen med en avanmälningslänk — och den ligger därför i
// mejlet. Roteras nyckeln slutar gamla länkar fungera, inget annat.
// ============================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signatur(userId: string, nyckel: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(nyckel), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('avanmal:' + userId)));
}

export async function skapaAvanmalToken(userId: string, nyckel: string): Promise<string> {
  return `${userId}.${await signatur(userId, nyckel)}`;
}

/** Svarar med user_id om tokenen är äkta, annars null. */
export async function lasAvanmalToken(token: string, nyckel: string): Promise<string | null> {
  const [id, sig] = String(token ?? '').split('.');
  if (!id || !sig || !UUID.test(id)) return null;
  const vantad = await signatur(id, nyckel);
  if (vantad.length !== sig.length) return null;
  let d = 0;
  for (let i = 0; i < sig.length; i++) d |= sig.charCodeAt(i) ^ vantad.charCodeAt(i);
  return d === 0 ? id : null;
}
