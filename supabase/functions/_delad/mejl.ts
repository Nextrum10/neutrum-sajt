// ============================================================
// NEXTRUM — delad hjälp: ett mejl via Resend
//
// Själva anropet, en gång. Vad som händer när Resend säger nej —
// reservavsändare eller inte, status eller inte — bestämmer den som
// anropar, för det skiljer sig med flit mellan en avisering till oss
// och en faktura till en familj.
//
// headers och tidsgransMs är valfria och kom till för notis-ko:
// headers för notismejlens List-Unsubscribe, tidsgransMs för att ett
// hängande anrop inte ska hålla en rad i kön längre än dess lån.
// faktura-utskick, lead-notis, pass-notis och meddelande-notis sätter
// ingen av dem och får exakt samma anrop som förut: en tom eller
// saknad headers blir undefined, som JSON.stringify utelämnar, och
// utan tidsgransMs får fetch ingen signal och ingen timer startas.
// ============================================================

export type Mejl = {
  fran: string;
  till: string[];
  amne: string;
  text: string;
  html: string;
  svaraTill?: string[];
  /** Samma nyckel inom Resends fönster skickar bara en gång. */
  idempotens?: string;
  /** Extra mejlheaders, till exempel List-Unsubscribe. */
  headers?: Record<string, string>;
  /**
   * Så länge anropet får ta innan det avbryts. Då kastas ett fel med
   * namnet TimeoutError. Mejlet kan ändå ha gått, så den som sätter
   * gränsen bör också sätta idempotens.
   */
  tidsgransMs?: number;
};

export type Mejlfel = 'permanent' | 'tillfalligt' | 'kontot';

/**
 * Hur ett felsvar från Resend ska tas emot.
 *
 *   401, 403   kontot: nyckeln saknas eller är fel, eller domänen är inte
 *              verifierad. Gäller varje mejl, så körningen stoppas.
 *   408        Resend hann inte. Samma anrop kan gå nästa gång.
 *   409        krock på idempotensnyckeln: samma rad skickas redan, till
 *              exempel efter ett lån som gått ut. Ett nytt försök med
 *              samma nyckel får det första anropets svar.
 *   429, 5xx   blir bättre av att vänta.
 *   övriga 4xx fel i själva mejlet (adressen, innehållet). Ett nytt
 *              försök ger samma svar.
 */
export function mejlfelSort(status: number): Mejlfel {
  if (status === 401 || status === 403) return 'kontot';
  if (status === 408 || status === 409 || status === 429) return 'tillfalligt';
  if (status >= 400 && status < 500) return 'permanent';
  return 'tillfalligt';
}

/** Skickar och lämnar svaret orört. Saknas nyckeln kastas ett fel. */
export async function skickaViaResend(m: Mejl): Promise<Response> {
  const nyckel = Deno.env.get('RESEND_API_KEY');
  if (!nyckel) throw new Error('RESEND_API_KEY saknas som secret.');

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${nyckel}`,
  };
  if (m.idempotens) headers['Idempotency-Key'] = m.idempotens;

  const init: RequestInit = {
    method: 'POST',
    headers,
    body: JSON.stringify({
      from: m.fran,
      to: m.till,
      reply_to: m.svaraTill && m.svaraTill.length ? m.svaraTill : undefined,
      subject: m.amne,
      text: m.text,
      html: m.html,
      headers: m.headers && Object.keys(m.headers).length ? m.headers : undefined,
    }),
  };
  if (!m.tidsgransMs) return await fetch('https://api.resend.com/emails', init);

  // En egen timer i stället för AbortSignal.timeout: den här rensas när
  // svaret kommit, så att ingen timer lever kvar efter anropet.
  const ctrl = new AbortController();
  const vakt = setTimeout(() => ctrl.abort(new DOMException('Resend svarade inte i tid.', 'TimeoutError')), m.tidsgransMs);
  try {
    return await fetch('https://api.resend.com/emails', { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(vakt);
  }
}
