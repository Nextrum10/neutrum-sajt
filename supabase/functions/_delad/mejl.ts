// ============================================================
// NEXTRUM — delad hjälp: ett mejl via Resend
//
// Själva anropet, en gång. Vad som händer när Resend säger nej —
// reservavsändare eller inte, status eller inte — bestämmer den som
// anropar, för det skiljer sig med flit mellan en avisering till oss
// och en faktura till en familj.
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
};

/** Skickar och lämnar svaret orört. Saknas nyckeln kastas ett fel. */
export async function skickaViaResend(m: Mejl): Promise<Response> {
  const nyckel = Deno.env.get('RESEND_API_KEY');
  if (!nyckel) throw new Error('RESEND_API_KEY saknas som secret.');

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${nyckel}`,
  };
  if (m.idempotens) headers['Idempotency-Key'] = m.idempotens;

  return await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      from: m.fran,
      to: m.till,
      reply_to: m.svaraTill && m.svaraTill.length ? m.svaraTill : undefined,
      subject: m.amne,
      text: m.text,
      html: m.html,
    }),
  });
}
