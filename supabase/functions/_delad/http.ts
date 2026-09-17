// ============================================================
// NEXTRUM — delad hjälp: svar, CORS och text
//
// Sju edge-funktioner hade var sin json(), tre var sin esc() — och
// två av dem escapade inte apostrofen. Här finns en av varje (Fas 3).
// ============================================================

const GRUNDHEADERS = 'authorization, x-client-info, apikey, content-type';

/** CORS-headers, med funktionens egna extra headers tillagda. */
export function cors(...extra: string[]): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': [GRUNDHEADERS, ...extra].join(', '),
  };
}

export const CORS = cors();

/** Ett JSON-svar. headers är funktionens CORS om den har egna. */
export function json(body: unknown, status: number, headers: Record<string, string> = CORS): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'content-type': 'application/json' },
  });
}

/** Svaret på en preflight. */
export function preflight(headers: Record<string, string> = CORS): Response {
  return new Response('ok', { headers });
}

/** Text in i HTML. Apostrofen med, så att texten också tål att stå i ett attribut. */
export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Ser det ut som en e-postadress? Samma grova kontroll som i formulären. */
export function epostOk(v: unknown): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? '').trim());
}
