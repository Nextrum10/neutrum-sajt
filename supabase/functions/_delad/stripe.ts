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
export const API_VERSION = '2025-08-27.basil';

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

/**
 * Vad betalningens läge blir efter en återbetalning.
 *
 * Regeln bor här och inte i anroparna, för TVÅ vägar leder hit: knappen
 * i adminvyn och webhooken när någon återbetalat i Stripes dashboard.
 * Två kopior av "är det här en full eller en del?" hade glidit isär,
 * och då hade samma betalning stått som olika saker beroende på vilken
 * väg som råkade skriva sist.
 *
 * DELÅTERBETALNING LÄMNAR PASSET SOM BETALT. Det är fortfarande
 * betalt, bara inte fullt ut, och aterbetald_ore bär hur mycket.
 */
export function aterbetalningsLage(aterbetaltOre: number, totaltOre: number): 'aterbetald' | 'betald' {
  return totaltOre > 0 && aterbetaltOre >= totaltOre ? 'aterbetald' : 'betald';
}

// ============================================================
// KORTTVISTERNA (Fas 14.3)
//
// Punkt 9 på säljarens MVP-lista. Webhooken och adminvyn läser samma
// regler härifrån, så att en tvist inte kan stå som vunnen på ett
// ställe och öppen på ett annat.
// ============================================================

export type TvistUtfall = 'oppen' | 'vunnen' | 'forlorad';

/**
 * Stripes status till vårt utfall.
 *
 * warning_closed är VUNNEN i den här meningen: det var en förfrågan
 * från banken som stängdes utan återkrav, och pengarna stannade. Förut
 * räknades bara 'won', och en stängd förfrågan stod som tvist för
 * alltid.
 */
export function tvistUtfall(lage: string): TvistUtfall {
  if (lage === 'won' || lage === 'warning_closed' || lage === 'prevented') return 'vunnen';
  if (lage === 'lost') return 'forlorad';
  return 'oppen';
}

/** Väntar Stripe på underlag från oss? Då finns en sista dag att missa. */
export function tvistVantarPaOss(lage: string): boolean {
  return lage === 'needs_response' || lage === 'warning_needs_response';
}

/**
 * Passets betalläge efter tvisten. En vunnen tvist är en betalning
 * igen. En förlorad förblir 'tvist': pengarna är borta, men passet
 * hölls på dem, och vad som hände står i stripe_tvister. Att kalla den
 * återbetald hade blandat ihop ett återkrav vi förlorat med en
 * återbetalning vi valt.
 */
export function betallageEfterTvist(utfall: TvistUtfall): 'betald' | 'tvist' {
  return utfall === 'vunnen' ? 'betald' : 'tvist';
}

/**
 * Orsakskoden med våra ord. Stripe skickar bara koden. En kod som inte
 * står här visas som koden själv, hellre än som ingenting.
 */
export const TVIST_ORSAK: Record<string, string> = {
  fraudulent: 'Kortinnehavaren säger att betalningen inte är hens',
  unrecognized: 'Kortinnehavaren känner inte igen betalningen',
  product_not_received: 'Kortinnehavaren säger att passet inte blev av',
  product_unacceptable: 'Kortinnehavaren är missnöjd med passet',
  duplicate: 'Kortinnehavaren säger att samma pass betalats två gånger',
  credit_not_processed: 'Kortinnehavaren säger att pengarna skulle ha kommit tillbaka',
  subscription_canceled: 'Kortinnehavaren säger att tjänsten var uppsagd',
  customer_initiated: 'Kortinnehavaren har bestridit betalningen',
  debit_not_authorized: 'Kortinnehavaren säger att dragningen inte var godkänd',
  general: 'Ingen särskild orsak angiven',
};

export function tvistOrsakText(kod: string | null | undefined): string {
  if (!kod) return 'Ingen orsak angiven';
  return TVIST_ORSAK[kod] ?? `Annan orsak (${kod})`;
}

/**
 * Vad som ska samlas, per orsak. Underlaget skickas in i Stripes
 * dashboard och sparas aldrig hos oss; det här är listan över vad som
 * ska letas fram.
 */
export function tvistUnderlag(kod: string | null | undefined): string {
  switch (kod) {
    case 'product_not_received':
      return 'Visa att passet hölls: rapporten, närvaron och att familjen bekräftade tiden.';
    case 'fraudulent':
    case 'unrecognized':
    case 'debit_not_authorized':
      return 'Visa att familjen själv bokade och betalade: bokningen i deras konto, '
        + 'tidigare betalda pass och att kortet användes på vår sida.';
    case 'product_unacceptable':
      return 'Villkoren, rapporten från passet och det familjen skrev till oss före tvisten.';
    case 'duplicate':
      return 'Visa att betalningarna gäller olika pass, med datum och tid för vart och ett.';
    case 'credit_not_processed':
      return 'Återbetalningen om den är gjord, annars villkoren som säger varför den inte ska göras.';
    default:
      return 'Bokningen, rapporten från passet, närvaron och villkoren.';
  }
}

/** Stripes tider är sekunder sedan 1970. Allt annat blir null, inte ett påhittat datum. */
export function tidFranUnix(s: unknown): string | null {
  return typeof s === 'number' && Number.isFinite(s) && s > 0 ? new Date(s * 1000).toISOString() : null;
}

// ============================================================
// STRIPE-LÄGET (Fas 14.3)
//
// Punkt 10 och 11 på MVP-listan gick inte att prova härifrån: miljön
// som skrev koden når inte api.stripe.com, och DEPLOY-BETALNING.md
// fick skriva "okänt härifrån" om nyckeln och "troligen dahlia" om
// webhookens version. Funktionen stripe-lage läser svaren från Stripe
// med servernyckeln, och granskaStripe() säger vad de betyder.
//
// Granskningen är en ren funktion, så att den går att prova utan
// Stripe: det är reglerna här som avgör om en rad blir grön.
// ============================================================

/**
 * Händelserna webhooken hanterar. En som saknas på endpointen kommer
 * aldrig fram, och det syns inte som ett fel någonstans.
 */
export const WEBHOOK_HANDELSER = [
  'checkout.session.completed',
  'payment_intent.payment_failed',
  'charge.refunded',
  'charge.dispute.created',
  'charge.dispute.updated',
  'charge.dispute.closed',
];

export type NyckelLage = 'saknas' | 'test' | 'skarp' | 'begransad' | 'publicerbar' | 'okand';

/** Bara nyckelns början läses. Nyckeln själv lämnar aldrig funktionen. */
export function nyckelLage(k: string | undefined | null): NyckelLage {
  if (!k) return 'saknas';
  if (k.startsWith('sk_test_')) return 'test';
  if (k.startsWith('sk_live_')) return 'skarp';
  if (k.startsWith('rk_')) return 'begransad';
  if (k.startsWith('pk_')) return 'publicerbar';
  return 'okand';
}

export type StripeKonto = {
  country?: string | null;
  default_currency?: string | null;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  business_profile?: { name?: string | null } | null;
  settings?: {
    payments?: { statement_descriptor?: string | null } | null;
    card_payments?: { statement_descriptor_prefix?: string | null } | null;
  } | null;
  requirements?: { currently_due?: string[] | null; past_due?: string[] | null; disabled_reason?: string | null } | null;
};

export type StripeEndpoint = {
  url?: string | null;
  status?: string | null;
  api_version?: string | null;
  enabled_events?: string[] | null;
};

/** ok: true klart, false måste åtgärdas, null bra att veta. */
export type Punkt = { ok: boolean | null; rubrik: string; text: string };

export type Granskning = {
  nyckel: NyckelLage;
  webhookhemlighet: boolean;
  vantadUrl: string;
  konto: StripeKonto | null;
  kontoFel?: string | null;
  endpoints: StripeEndpoint[] | null;
  endpointFel?: string | null;
  leveranser: { antal: number; senast: string | null; typ: string | null; resultat: string | null } | null;
};

const utanSnedstreck = (u: string) => u.replace(/\/+$/, '');

export function granskaStripe(g: Granskning): Punkt[] {
  const p: Punkt[] = [];
  const test = g.nyckel === 'test';

  // ---------- nyckeln ----------
  p.push({
    saknas: { ok: false, rubrik: 'Nyckeln', text: 'STRIPE_SECRET_KEY är inte satt. Betala-knappen svarar med ett fel tills den är det.' },
    test: { ok: true, rubrik: 'Nyckeln', text: 'Testnyckel. Inga riktiga pengar dras; betala med testkortet 4242 4242 4242 4242.' },
    skarp: { ok: true, rubrik: 'Nyckeln', text: 'Skarp nyckel. Riktiga kort dras.' },
    begransad: { ok: null, rubrik: 'Nyckeln', text: 'En begränsad nyckel (rk_). Den kan sakna rätt att skapa betalningar eller återbetala; en vanlig hemlig nyckel (sk_) är säkrare här.' },
    publicerbar: { ok: false, rubrik: 'Nyckeln', text: 'Det är den publicerbara nyckeln (pk_). Den kan inte skapa en betalning. STRIPE_SECRET_KEY ska vara den hemliga, som börjar med sk_.' },
    okand: { ok: false, rubrik: 'Nyckeln', text: 'Nyckeln har ett format Stripe inte använder. Kontrollera att hela nyckeln kom med.' },
  }[g.nyckel]);

  p.push(g.webhookhemlighet
    ? { ok: true, rubrik: 'Webhookens hemlighet', text: 'STRIPE_WEBHOOK_SECRET är satt.' }
    : { ok: false, rubrik: 'Webhookens hemlighet', text: 'STRIPE_WEBHOOK_SECRET är inte satt. Då svarar webhooken 400 på varje leverans, och ingen betalning blir registrerad fast pengarna dragits.' });

  if (g.nyckel === 'saknas' || g.nyckel === 'publicerbar' || g.nyckel === 'okand') return p;

  // ---------- kontot ----------
  const k = g.konto;
  if (!k) {
    p.push({ ok: false, rubrik: 'Kontot', text: 'Stripe svarade inte på frågan om kontot: ' + (g.kontoFel || 'okänt fel') + '.' });
  } else {
    const saknas = [...(k.requirements?.past_due ?? []), ...(k.requirements?.currently_due ?? [])];
    if (!k.charges_enabled) {
      p.push({
        ok: test ? null : false,
        rubrik: 'Kontot tar emot betalningar',
        text: 'Nej' + (k.requirements?.disabled_reason ? ` (${k.requirements.disabled_reason})` : '') + '. '
          + (test ? 'I testläge går det ändå, men kontot måste aktiveras innan en riktig familj kan betala.'
            : 'Ingen familj kan betala förrän Stripe fått det de väntar på under Settings → Business.'),
      });
    } else {
      p.push({ ok: true, rubrik: 'Kontot tar emot betalningar', text: 'Ja.' });
    }
    if (saknas.length) {
      p.push({ ok: test ? null : false, rubrik: 'Stripe väntar på uppgifter', text: `${saknas.length} st, till exempel ${saknas.slice(0, 3).join(', ')}. De fylls i under Settings → Business.` });
    }
    if (k.payouts_enabled === false) {
      p.push({ ok: null, rubrik: 'Utbetalning till banken', text: 'Inte påslagen. Betalningarna samlas då hos Stripe och når inte bankkontot.' });
    }
    if (k.country && k.country !== 'SE') {
      p.push({ ok: null, rubrik: 'Land', text: `Kontot står på ${k.country}, inte SE.` });
    }
    if (k.default_currency && k.default_currency !== 'sek') {
      p.push({ ok: null, rubrik: 'Valuta', text: `Kontots valuta är ${k.default_currency.toUpperCase()}. Betalningarna tas i SEK ändå, men utbetalningen växlas.` });
    }

    // ---------- kontoutdraget (punkt 10) ----------
    const text = k.settings?.payments?.statement_descriptor ?? '';
    const prefix = k.settings?.card_payments?.statement_descriptor_prefix ?? '';
    const bas = prefix || text.slice(0, 10);
    if (!text && !prefix) {
      p.push({ ok: false, rubrik: 'Kontoutdraget', text: 'Ingen text är satt. Sätt NEXTRUM under Settings → Business → Public details, annars vet familjen inte vad dragningen är.' });
    } else if (!/nextrum/i.test(text + ' ' + prefix)) {
      p.push({ ok: null, rubrik: 'Kontoutdraget', text: `Familjen ser ungefär "${bas}* MATEMATIK". Står det inte Nextrum ringer de banken i stället för oss.` });
    } else {
      p.push({ ok: true, rubrik: 'Kontoutdraget', text: `Familjen ser ungefär "${bas}* MATEMATIK".` });
    }
  }

  // ---------- webhooken ----------
  if (!g.endpoints) {
    p.push({ ok: false, rubrik: 'Webhook-endpointen', text: 'Stripe svarade inte på frågan om endpoints: ' + (g.endpointFel || 'okänt fel') + '.' });
  } else {
    const hit = g.endpoints.filter((e) => utanSnedstreck(String(e.url ?? '')) === utanSnedstreck(g.vantadUrl));
    if (!hit.length) {
      p.push({
        ok: false,
        rubrik: 'Webhook-endpointen',
        text: `Ingen endpoint i ${test ? 'testläget' : 'det skarpa läget'} pekar på ${g.vantadUrl}. `
          + 'Då kommer ingen leverans fram, och ingen betalning blir registrerad. '
          + (g.endpoints.length ? `Det finns ${g.endpoints.length} som pekar någon annanstans.` : 'Det finns inga alls.'),
      });
    } else {
      const e = hit[0];
      p.push(e.status === 'enabled'
        ? { ok: true, rubrik: 'Webhook-endpointen', text: 'Finns och är påslagen.' }
        : { ok: false, rubrik: 'Webhook-endpointen', text: `Finns men står som "${e.status}". Stripe skickar ingenting till en avstängd endpoint.` });
      if (hit.length > 1) {
        p.push({ ok: null, rubrik: 'Flera endpoints', text: `${hit.length} endpoints pekar hit. Bara den vars hemlighet är satt går igenom; de andra svarar 400 på varje leverans tills Stripe stänger av dem. Ta bort de överflödiga.` });
      }
      const valda = e.enabled_events ?? [];
      if (valda.includes('*')) {
        p.push({ ok: null, rubrik: 'Händelserna', text: 'Alla händelser är valda. Det fungerar, men varje sort webhooken inte hanterar sparas som ohanterad.' });
      } else {
        const saknade = WEBHOOK_HANDELSER.filter((h) => !valda.includes(h));
        p.push(saknade.length
          ? { ok: false, rubrik: 'Händelserna', text: 'Saknas på endpointen: ' + saknade.join(', ') + '. De kommer aldrig fram.' }
          : { ok: true, rubrik: 'Händelserna', text: 'Alla sex som webhooken hanterar är valda.' });
      }
      if (!e.api_version) {
        p.push({ ok: null, rubrik: 'API-versionen', text: 'Stripe säger inte vilken version endpointen står på.' });
      } else if (e.api_version !== API_VERSION) {
        p.push({ ok: null, rubrik: 'API-versionen', text: `Endpointen står på ${e.api_version}, koden pinnar ${API_VERSION}. Fälten webhooken läser är grundfält, men en provbetalning är det som visar att de kommer fram.` });
      } else {
        p.push({ ok: true, rubrik: 'API-versionen', text: `${API_VERSION}, samma som koden.` });
      }
    }
  }

  // ---------- leveranserna (punkt 11) ----------
  const l = g.leveranser;
  if (!l) {
    p.push({ ok: null, rubrik: 'Leveranser', text: 'Kunde inte läsas.' });
  } else if (!l.antal) {
    p.push({ ok: false, rubrik: 'Leveranser', text: 'Ingen leverans från Stripe har kommit fram än. Skicka en testhändelse från endpointens sida i Stripe (DEPLOY-BETALNING.md 9.6, steg 0).' });
  } else {
    p.push({ ok: true, rubrik: 'Leveranser', text: `${l.antal} st. Senast ${l.typ ?? 'okänd typ'}${l.resultat ? ` (${l.resultat})` : ''}.` });
  }

  p.push({ ok: null, rubrik: 'Kvitton', text: 'Går inte att läsa via Stripes API. Betalningen skickar kvittot till familjens adress, och i skarpt läge går det ut oavsett inställningen. I testläge skickar Stripe inga kvitton.' });

  return p;
}
