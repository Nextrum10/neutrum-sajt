// ============================================================
// NEXTRUM — stripe-lage (Fas 14.3)
//
// Punkt 10 och 11 på säljarens MVP-lista: kontoutdraget och att
// kedjan är provad. Ingen av dem gick att kontrollera härifrån.
// Miljön som skrev betalkoden når inte api.stripe.com, så
// DEPLOY-BETALNING.md fick skriva "okänt härifrån" om nyckeln och
// "troligen dahlia" om webhookens version, och en endpoint som saknar
// en händelse ser inte ut som ett fel någonstans: leveransen kommer
// bara aldrig.
//
// Funktionen frågar Stripe med servernyckeln och svarar med en lista
// som adminvyn ritar. Reglerna för vad som är grönt står i
// granskaStripe() i _delad/stripe.ts, där de har egna prov.
//
//
// DEN LÄSER, DEN SKRIVER INGENTING
//
// Två GET mot Stripe och en räkning i stripe_handelser. Ingen knapp
// här kan ändra något hos Stripe: endpoints, kontouppgifter och
// kvitton ändras i Stripes dashboard, av en människa.
//
//
// NYCKELN LÄMNAR ALDRIG FUNKTIONEN
//
// Svaret säger om den är en test- eller skarp nyckel, läst ur de första
// tecknen. Inte ett tecken till. Samma för webhookhemligheten: bara om
// den finns.
//
//
// ORDNINGEN: anroparens egen token prövas mot Auth och is_admin FÖRST.
// service_role används sedan till en enda sak, att räkna rader i
// stripe_handelser, som inte har någon läspolicy alls.
// ============================================================

import { kravAdmin, serviceklient } from '../_delad/auth.ts';
import { cors, json, preflight } from '../_delad/http.ts';
import {
  granskaStripe, nyckelLage, type Punkt, type StripeEndpoint, StripeError, type StripeKonto, v1,
} from '../_delad/stripe.ts';

const CORS = cors();

/* Den publicerbara nyckeln (Fas 14.5). Utan den öppnas kassan på
   Stripes egen sida i stället för i panelen i föräldravyn. Det
   fungerar, men det är inte vad som ska hända, och därför säger raden
   det. Två nycklar från olika lägen ger ingen panel alls, och
   stripe-checkout faller då tyst tillbaka på Stripes sida: den här
   raden är enda stället det syns. Som med den hemliga nyckeln lämnar
   bara läget funktionen, aldrig ett tecken av nyckeln. */
function publicerbarPunkt(pk: string, sk: string): Punkt {
  const rubrik = 'Kassan på sidan';
  const lage = (k: string) => /^(pk|sk|rk)_test_/.test(k) ? 'test' : /^(pk|sk|rk)_live_/.test(k) ? 'skarp' : null;
  if (!pk) {
    return {
      ok: null, rubrik,
      text: 'STRIPE_PUBLISHABLE_KEY är inte satt. Betalningen öppnas då på Stripes egen sida i stället för i en panel '
        + 'på er sida. Sätt den publicerbara nyckeln (pk_…) bredvid den hemliga, under Edge Functions → Secrets.',
    };
  }
  if (!pk.startsWith('pk_')) {
    return { ok: false, rubrik, text: 'STRIPE_PUBLISHABLE_KEY ska vara den publicerbara nyckeln, den som börjar med pk_.' };
  }
  if (lage(pk) !== lage(sk)) {
    const namn = (l: string | null) => l === 'test' ? 'en testnyckel' : l === 'skarp' ? 'skarp' : 'av okänt läge';
    return {
      ok: false, rubrik,
      text: `Den publicerbara nyckeln är ${namn(lage(pk))}, men den hemliga är ${namn(lage(sk))}. Då går panelen inte `
        + 'att öppna, och betalningen öppnas på Stripes sida i stället. Båda ska komma från samma läge.',
    };
  }
  return { ok: true, rubrik, text: 'Satt, och i samma läge som den hemliga. Kassan öppnas i en panel på er sida.' };
}

function felText(e: unknown): string {
  if (e instanceof StripeError) return `${e.fel.meddelande} (${e.fel.status})`;
  return (e as Error)?.message ?? 'okänt fel';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(CORS);
  if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'Bara GET eller POST.' }, 405, CORS);

  const vem = await kravAdmin(req.headers.get('authorization'));
  if (!vem.ok) return vem.svar;

  const nyckel = nyckelLage(Deno.env.get('STRIPE_SECRET_KEY'));
  const webhookhemlighet = !!Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const vantadUrl = `${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/stripe-webhook`;
  const kanFraga = nyckel === 'test' || nyckel === 'skarp' || nyckel === 'begransad';

  let konto: StripeKonto | null = null;
  let kontoFel: string | null = null;
  let endpoints: StripeEndpoint[] | null = null;
  let endpointFel: string | null = null;

  if (kanFraga) {
    // Samtidigt: två oberoende frågor, och ett fel i den ena ska inte
    // dölja svaret på den andra.
    const [k, e] = await Promise.allSettled([
      v1('GET', '/v1/account'),
      v1('GET', '/v1/webhook_endpoints?limit=20'),
    ]);
    if (k.status === 'fulfilled') konto = k.value as StripeKonto;
    else kontoFel = felText(k.reason);
    if (e.status === 'fulfilled') {
      endpoints = ((e.value as { data?: StripeEndpoint[] }).data ?? []).map((x) => ({
        url: x.url ?? null,
        status: x.status ?? null,
        api_version: x.api_version ?? null,
        enabled_events: x.enabled_events ?? [],
      }));
    } else {
      endpointFel = felText(e.reason);
    }
  }

  /* Leveranserna räknas i databasen. stripe_handelser har RLS utan en
     enda policy, så admin ser den inte med sin egen token; därför
     service_role, efter kontrollen ovan, och bara antal, senaste typ och
     resultat. Tabellen bär ingen betaldata att lämna ut. */
  let leveranser: { antal: number; senast: string | null; typ: string | null; resultat: string | null } | null = null;
  try {
    const db = serviceklient();
    const [antal, sista] = await Promise.all([
      db.from('stripe_handelser').select('id', { count: 'exact', head: true }),
      db.from('stripe_handelser').select('typ, resultat, mottagen_at').order('mottagen_at', { ascending: false }).limit(1),
    ]);
    // Ett fel får inte bli "noll leveranser": det hade sett ut som att
    // Stripe aldrig hört av sig, när det är vi som inte kunde läsa.
    if (!antal.error && !sista.error) {
      const s = (sista.data ?? [])[0] as { typ?: string; resultat?: string; mottagen_at?: string } | undefined;
      leveranser = { antal: antal.count ?? 0, senast: s?.mottagen_at ?? null, typ: s?.typ ?? null, resultat: s?.resultat ?? null };
    }
  } catch {
    leveranser = null;
  }

  const punkter = granskaStripe({
    nyckel, webhookhemlighet, vantadUrl, konto, kontoFel, endpoints, endpointFel, leveranser,
  });
  // Direkt under de två nyckelraderna, där den hör hemma.
  punkter.splice(2, 0, publicerbarPunkt(
    Deno.env.get('STRIPE_PUBLISHABLE_KEY') ?? '', Deno.env.get('STRIPE_SECRET_KEY') ?? '',
  ));

  return json({
    nyckel,
    webhookhemlighet,
    vantadUrl,
    leveranser,
    punkter,
    rott: punkter.filter((p) => p.ok === false).length,
  }, 200, CORS);
});
