// ============================================================
// NEXTRUM — delat lager mot Stripe
//
// Repot har ingen pakethanterare och inget byggsteg, så Stripes SDK
// finns inte att importera. Det behövs inte heller: v1 är
// formulärkodad HTTP och v2 är JSON, och Deno har fetch.
//
// Filen finns för att de tre stripe-funktionerna annars hade fått var
// sin kopia av nyckelhämtning, felhantering och signaturkontroll. Det
// var precis så _delad/ uppstod: sju funktioner med var sin esc(), och
// två av dem escapade inte apostrofen.
//
// TRE REGLER BOR HÄR, INTE I ANROPARNA
//
// 1. IDEMPOTENSNYCKEL PÅ VARJE SKRIVNING. Stripe skapar annars två
//    betalningar av två klick. Nyckeln byggs av kod ur objektets id,
//    aldrig av något anroparen skickar in.
// 2. SIGNATUREN PRÖVAS I KONSTANT TID. En webhook utan
//    signaturkontroll är en adress där vem som helst kan påstå att en
//    faktura är betald. En kontroll som läcker via svarstiden är
//    sämre än ingen, för den ser ut att hålla.
// 3. NYCKELN LÄSES UR MILJÖN, ALDRIG UR ETT ANROP. Den hemliga
//    nyckeln går förbi allt: den hör hemma som secret i Supabase och
//    får aldrig nå webbläsaren.
//
// OKONTROLLERAT MOT DOKUMENTATIONEN: miljön som skrev filen når inte
// docs.stripe.com (nätverkspolicyn svarar 403 på CONNECT), så
// v2-anropens fältnamn är skrivna ur kunskap och inte verifierade mot
// referensen. v1-anropen (Checkout, refunds) är den stabila delen.
// Prova v2-vägen i testläge FÖRST, och läs felsvaret: Stripe säger
// rakt ut vilket fält som heter fel.
// ============================================================

const BAS = 'https://api.stripe.com';

/* Versionen är PINNAD, av samma skäl som supabase-js i auth.ts. En
   API-version som följer med kontots förval ändrar sig den dag Stripe
   flyttar förvalet, och då ändras svarens form i funktioner ingen har
   rört. v2 kräver dessutom headern. */
const API_VERSION = '2025-08-27.basil';

export function nyckel(): string {
  const k = Deno.env.get('STRIPE_SECRET_KEY');
  if (!k) throw new Error('STRIPE_SECRET_KEY saknas i miljön.');
  return k;
}

export type StripeFel = { typ: string; kod: string; meddelande: string; status: number };

export class StripeError extends Error {
  fel: StripeFel;
  constructor(fel: StripeFel) {
    super(fel.meddelande);
    this.fel = fel;
  }
}

async function las(r: Response): Promise<unknown> {
  const text = await r.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { _rå: text };
  }
}

function kastaOmFel(r: Response, kropp: unknown): void {
  if (r.ok) return;
  const e = (kropp as { error?: Record<string, unknown> })?.error ?? {};
  throw new StripeError({
    typ: String(e.type ?? 'api_error'),
    kod: String(e.code ?? ''),
    // Stripes egen text är begriplig och säger vilket fält som är
    // fel. Den går vidare ordagrant till adminvyn, inte till familjen.
    meddelande: String(e.message ?? `Stripe svarade ${r.status}.`),
    status: r.status,
  });
}

/* Formulärkodning för v1. Stripe tar nästlade fält som
   a[b][c]=v och listor som a[0][b]=v. Att skriva det för hand i varje
   anropare är hur en parameter till slut stavas fel på ett ställe. */
export function formulardata(obj: Record<string, unknown>, prefix = ''): string[] {
  const ut: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const namn = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((rad, i) => {
        if (rad !== null && typeof rad === 'object') {
          ut.push(...formulardata(rad as Record<string, unknown>, `${namn}[${i}]`));
        } else {
          ut.push(`${encodeURIComponent(`${namn}[${i}]`)}=${encodeURIComponent(String(rad))}`);
        }
      });
    } else if (typeof v === 'object') {
      ut.push(...formulardata(v as Record<string, unknown>, namn));
    } else {
      ut.push(`${encodeURIComponent(namn)}=${encodeURIComponent(String(v))}`);
    }
  }
  return ut;
}

/** Ett v1-anrop. GET utan kropp, POST formulärkodat. */
export async function v1(
  metod: 'GET' | 'POST',
  vag: string,
  kropp?: Record<string, unknown>,
  idempotens?: string,
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${nyckel()}`,
    'Stripe-Version': API_VERSION,
  };
  if (metod === 'POST') headers['content-type'] = 'application/x-www-form-urlencoded';
  // Idempotensnyckeln gäller bara skrivningar. Stripe struntar i den
  // på GET, men att skicka den där hade dolt att den saknas på en POST.
  if (idempotens && metod === 'POST') headers['Idempotency-Key'] = idempotens;

  const r = await fetch(`${BAS}${vag}`, {
    method: metod,
    headers,
    body: metod === 'POST' ? formulardata(kropp ?? {}).join('&') : undefined,
  });
  const data = await las(r);
  kastaOmFel(r, data);
  return data as Record<string, unknown>;
}

/** Ett v2-anrop. v2 är JSON, inte formulärkodat, och kräver versionen. */
export async function v2(
  metod: 'GET' | 'POST',
  vag: string,
  kropp?: Record<string, unknown>,
  idempotens?: string,
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${nyckel()}`,
    'Stripe-Version': API_VERSION,
    'content-type': 'application/json',
  };
  if (idempotens && metod === 'POST') headers['Idempotency-Key'] = idempotens;

  const r = await fetch(`${BAS}${vag}`, {
    method: metod,
    headers,
    body: metod === 'POST' ? JSON.stringify(kropp ?? {}) : undefined,
  });
  const data = await las(r);
  kastaOmFel(r, data);
  return data as Record<string, unknown>;
}

// ============================================================
// SIGNATUREN
//
// Stripe skickar t=<tid>,v1=<hex> i stripe-signature. Signaturen är
// HMAC-SHA256 över "<t>.<rå kropp>" med webhookhemligheten.
//
// KROPPEN MÅSTE VARA DEN RÅA TEXTEN. Går den genom JSON.parse och
// tillbaka stämmer inte signaturen längre: nyckelordning och
// mellanrum ändras, och felet ser ut som att Stripe skickar skräp.
// ============================================================

function hexTillBytes(hex: string): Uint8Array {
  const rent = hex.trim();
  if (rent.length % 2 !== 0 || /[^0-9a-fA-F]/.test(rent)) return new Uint8Array(0);
  const ut = new Uint8Array(rent.length / 2);
  for (let i = 0; i < ut.length; i++) ut[i] = parseInt(rent.substr(i * 2, 2), 16);
  return ut;
}

/** Konstant tid. Speglar lika() i auth.ts, men över bytes. */
function likaBytes(a: Uint8Array, b: Uint8Array): boolean {
  let skillnad = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) skillnad |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return skillnad === 0;
}

export type SignaturSvar = { ok: true; handelse: Record<string, unknown> } | { ok: false; skal: string };

/**
 * Prövar signaturen och returnerar händelsen. Tar den RÅA kroppen.
 *
 * toleransSek finns för att en klocka som går fel annars gör varje
 * leverans ogiltig. Utan tak går en gammal, avlyssnad leverans att
 * spela upp igen hur länge som helst.
 */
export async function prövaSignatur(
  raKropp: string,
  signaturHeader: string | null,
  hemlighet: string,
  toleransSek = 300,
): Promise<SignaturSvar> {
  if (!signaturHeader) return { ok: false, skal: 'stripe-signature saknas.' };
  if (!hemlighet) return { ok: false, skal: 'Webhookhemligheten är inte satt.' };

  let t = '';
  const signaturer: string[] = [];
  for (const del of signaturHeader.split(',')) {
    const [k, v] = del.split('=', 2);
    if (k?.trim() === 't') t = (v ?? '').trim();
    // Flera v1 kan förekomma under en hemlighetsrotation. Alla prövas.
    if (k?.trim() === 'v1' && v) signaturer.push(v.trim());
  }
  if (!t || !signaturer.length) return { ok: false, skal: 'stripe-signature har fel form.' };

  const alder = Math.abs(Math.floor(Date.now() / 1000) - Number(t));
  if (!Number.isFinite(alder) || alder > toleransSek) {
    return { ok: false, skal: 'Leveransen är för gammal.' };
  }

  const kryptonyckel = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(hemlighet),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const vantad = new Uint8Array(
    await crypto.subtle.sign('HMAC', kryptonyckel, new TextEncoder().encode(`${t}.${raKropp}`)),
  );

  // Alla prövas alltid, utan tidig utgång: att avbryta på första
  // träffen läcker hur många som fanns.
  let traff = false;
  for (const s of signaturer) traff = likaBytes(vantad, hexTillBytes(s)) || traff;
  if (!traff) return { ok: false, skal: 'Signaturen stämmer inte.' };

  try {
    return { ok: true, handelse: JSON.parse(raKropp) as Record<string, unknown> };
  } catch {
    return { ok: false, skal: 'Kroppen är inte JSON.' };
  }
}

// ============================================================
// BELOPPEN
//
// Stripe räknar i minsta enhet, alltså ören för SEK. Det är samma
// enhet som hela den här kodbasen lagrar belopp i, så det finns ingen
// omvandling på den här vägen och ska inte finnas någon heller.
// ============================================================

export const VALUTA = 'sek';

/** Beloppet för ett pass: minuter mot ett timpris i ören. Speglar belopp() i pris.ts. */
export function oreFor(minuter: number, timprisOre: number): number {
  return Math.round((minuter / 60) * timprisOre);
}
