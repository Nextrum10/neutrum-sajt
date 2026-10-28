// ============================================================
// NEXTRUM — förhandsvisningens kassa (2026-10-27)
//
// Leo: "på våran förhandsvisning av studievy ska vi jag och alex kunna
// kontrollera betalningen med stripe, eftersom de är i stripes sandlåda
// kommer ingenting dras".
//
// Förhandsvisningen (nextrum-forhandsvisning.js) är en påhittad familj i
// webbläsaren. Passen och planerna finns inte i databasen, så kassan kan
// inte räkna beloppen ur den som stripe-checkout gör. Här är undantaget
// från regeln att belopp aldrig kommer ur anropet, och det är därför
// inringat:
//   - bara en superadmin (kravAdmin) öppnar en kassa,
//   - bara med en TESTNYCKEL: en skarp nyckel ger ingen kassa alls, så
//     inga riktiga pengar kan dras genom den här vägen,
//   - raderna har tak, och varje rad säger att det är förhandsvisningen,
//   - sessionen och dess PaymentIntent bär forhandsvisning=1 i metadata,
//     och webhooken skriver ingenting för en sådan händelse.
// Ingenting skrivs i databasen: inte liggaren, inte passen, inte
// kvittot. Världen i webbläsaren frågar efteråt om sessionen är betald.
// ============================================================

export const METADATA = 'forhandsvisning';

/* Högst så här mycket i en kassa: tjugo pass, som Betala alla, och en
   rad kostar högst 10 000 kr. Stripe tar inte under 3 kr i SEK. */
export const MAX_RADER = 20;
export const MIN_ORE = 300;
export const MAX_ORE = 1_000_000;

export type Rad = { text: string; ore: number };

/* Styrtecknen skrivs som \x, aldrig som \u och fyra siffror: verktyget som
   driftsätter funktionerna avkodar den formen en gång till (CLAUDE.md
   avsnitt 7), och då hade ett riktigt NUL hamnat i källan. */

/** Raderna ur anropet, prövade. null när något inte stämmer. */
export function raderUrAnrop(v: unknown): Rad[] | null {
  if (!Array.isArray(v) || v.length < 1 || v.length > MAX_RADER) return null;
  const ut: Rad[] = [];
  for (const r of v) {
    const text = String((r as Rad)?.text ?? '').replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, 120);
    const ore = Number((r as Rad)?.ore);
    if (!text || !Number.isInteger(ore) || ore < MIN_ORE || ore > MAX_ORE) return null;
    ut.push({ text, ore });
  }
  return ut;
}

/* Nyckeln kassan får använda: en egen testnyckel om den är satt, annars
   driftens, men bara så länge den är en testnyckel. När Stripe går skarpt
   sätts STRIPE_FORHANDSVISNING_SECRET_KEY och _PUBLISHABLE_KEY till
   kontots testnycklar, och förhandsvisningen fortsätter i sandlådan. */
const ARTEST = (k: string) => /^(sk|rk)_test_/.test(k);
export function testnyckel(env: (n: string) => string | undefined): string | null {
  const egen = env('STRIPE_FORHANDSVISNING_SECRET_KEY') ?? '';
  if (egen) return ARTEST(egen) ? egen : null;
  const drift = env('STRIPE_SECRET_KEY') ?? '';
  return ARTEST(drift) ? drift : null;
}
export function publicerbarTestnyckel(env: (n: string) => string | undefined): string | null {
  const egen = env('STRIPE_FORHANDSVISNING_PUBLISHABLE_KEY') ?? '';
  const k = egen || (env('STRIPE_PUBLISHABLE_KEY') ?? '');
  return /^pk_test_/.test(k) ? k : null;
}

/* Returadressen: vår sajt, en lokal server eller en förhandsdriftsättning
   hos Vercel, där en ny design provas innan den går ut. Bara en
   superadmin kan öppna kassan, så det här är ingen öppen omdirigering
   för någon annan. */
export function retur(u: unknown): string {
  try {
    const a = new URL(String(u));
    const h = a.hostname;
    const ok = h === 'nextrum.se' || h === 'www.nextrum.se' || h.endsWith('.vercel.app')
      || h === 'localhost' || h === '127.0.0.1';
    if (ok && (a.protocol === 'https:' || h === 'localhost' || h === '127.0.0.1')) return a.origin;
  } catch { /* faller igenom */ }
  return 'https://nextrum.se';
}

/** Sessionens parametrar. inbaddad: kassan i panelen, annars Stripes sida. */
export function sessionen(rader: Rad[], bas: string, inbaddad: boolean, admin: string): Record<string, unknown> {
  const tillbaka = `${bas}/foralder?forhandsvisning&fvkassa={CHECKOUT_SESSION_ID}#betalning`;
  return {
    mode: 'payment',
    locale: 'sv',
    payment_method_types: ['card', 'klarna'],
    line_items: rader.map((r) => ({
      quantity: 1,
      price_data: { currency: 'sek', unit_amount: r.ore, product_data: { name: 'Förhandsvisning: ' + r.text } },
    })),
    metadata: { [METADATA]: '1', admin },
    payment_intent_data: { metadata: { [METADATA]: '1' }, description: 'Förhandsvisningen, Stripes testläge' },
    ...(inbaddad
      ? { ui_mode: 'embedded', redirect_on_completion: 'if_required', return_url: tillbaka }
      : { success_url: tillbaka, cancel_url: `${bas}/foralder?forhandsvisning#betalning` }),
  };
}

/** Hör en händelse från Stripe till förhandsvisningen? Sessionen,
    dess PaymentIntent och dess charge bär markeringen. */
export function arForhandsvisning(obj: unknown): boolean {
  const m = (obj as { metadata?: Record<string, unknown> } | null)?.metadata;
  return !!m && m[METADATA] === '1';
}
