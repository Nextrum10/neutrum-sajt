// ============================================================
// NEXTRUM — stripe-konto (Fas 12.2)
//
// Studiehjälparens anslutna konto hos Stripe: skapar det, ger en
// onboardinglänk, och läser tillbaka vad Stripe säger om det.
//
// Funktionen fanns som en knapp i studiehjälparvyn långt innan den
// fanns som kod. Knappen anropade det här namnet, fick 404 varje gång
// och plockades till slut bort med kommentaren att en knapp som inte
// går att trycka på är sämre än ingen knapp. Nu finns funktionen, och
// knappen kan komma tillbaka.
//
//
// TRE REGLER, OCH DEN MELLERSTA ÄR DEN SOM KOSTAR PENGAR
//
// 1. NEXTRUM BYGGER ALDRIG EGNA FORMULÄR för personnummer,
//    legitimation eller bankkonto. Kontot skapas på servern och
//    personen skickas till Stripes egen onboarding. Stripe vet vad
//    Sverige kräver, och kan begära komplettering senare när kraven
//    ändras. Vi lagrar id:t, aldrig uppgifterna.
//
// 2. ATT KOMMA TILLBAKA TILL return_url BETYDER INGENTING.
//    Personen kan ha klickat sig igenom, backat, eller stängt fliken
//    mitt i. Tillståndet läses därför ALLTID från Stripe, aldrig från
//    att någon dök upp på returadressen. Det är precis det felet
//    stripe_klar som en ensam boolean bjöd in till, och varför Fas
//    12.1 delade upp den i fem fält.
//
// 3. LÄNKEN ÄR FÄRSKVARA. Den genereras vid klicket, för den
//    inloggade, och mejlas aldrig. En statisk onboardinglänk i ett
//    mejl är en länk in i någon annans Stripe-konto.
//
//
// OKONTROLLERAT MOT DOKUMENTATIONEN: miljön som skrev filen når inte
// docs.stripe.com. v2-anropens fältnamn nedan är skrivna ur kunskap,
// inte verifierade mot referensen. Stripes felsvar går därför
// ordagrant vidare till vyn: prova i TESTLÄGE först, läs felet, rätta
// fältnamnet. Se SKISS-BETALNING-STRIPE.md.
// ============================================================

import { kravInloggad, serviceklient } from '../_delad/auth.ts';
import { cors, json, preflight } from '../_delad/http.ts';
import { StripeError, v2 } from '../_delad/stripe.ts';

const CORS = cors();

type Konto = {
  id?: string;
  configuration?: {
    recipient?: {
      capabilities?: Record<string, { status?: string }>;
    };
  };
  requirements?: {
    entries?: Array<{ description?: string; awaiting_action_from?: string }>;
  };
};

/** Vad Stripe säger om kontot, översatt till de fem fälten i databasen. */
function last(konto: Konto) {
  const formagor = konto.configuration?.recipient?.capabilities ?? {};
  const aktiv = (namn: string) => formagor[namn]?.status === 'active';

  // stripe_transfers: kontot kan ta emot en överföring från oss.
  // stripe_balance/payouts: Stripe betalar ut saldot till banken.
  // De två är inte samma sak, och skillnaden syns först när pengar
  // kommit in och blivit stående.
  const kanTaEmot = aktiv('stripe_transfers');
  const utbetalning = aktiv('stripe_balance') || aktiv('payouts');

  const krav = (konto.requirements?.entries ?? [])
    .filter((e) => e?.awaiting_action_from !== 'stripe')
    .map((e) => String(e?.description ?? ''))
    .filter(Boolean);

  return {
    stripe_kan_ta_emot: kanTaEmot,
    stripe_utbetalning_aktiv: utbetalning,
    stripe_krav: krav,
    // "Klar" betyder att Stripe inte begär något mer, inte att
    // personen har klickat färdigt.
    stripe_onboarding: krav.length === 0 && kanTaEmot ? 'klar' : 'pagar',
    stripe_klar: kanTaEmot && utbetalning,
    stripe_kontrollerad_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(CORS);
  if (req.method !== 'POST') return json({ error: 'Bara POST.' }, 405, CORS);

  // Anroparens EGEN token först. service_role används inte till
  // någonting innan vi vet vem det är och att hen är godkänd.
  const vem = await kravInloggad(req.headers.get('authorization'));
  if (!vem.ok) return vem.svar;

  const { data: profil, error: profilfel } = await vem.klient
    .from('tutor_profiles')
    .select('id, status, stripe_account_id, stripe_onboarding')
    .eq('id', vem.anvandare)
    .maybeSingle();

  if (profilfel) return json({ error: 'Profilen gick inte att läsa.' }, 500, CORS);
  if (!profil) return json({ error: 'Du har ingen studiehjälparprofil.' }, 403, CORS);

  // Ett konto skapas först när någon faktiskt ska hålla pass. Ett
  // anslutet konto per ansökan hade lämnat halvfärdiga konton efter
  // varje person som aldrig blev godkänd.
  if (profil.status !== 'approved') {
    return json({ error: 'Kontot kopplas när din ansökan är godkänd.' }, 403, CORS);
  }

  let kropp: { retur?: string; uppdatera?: boolean } = {};
  try {
    kropp = await req.json();
  } catch {
    // Tom kropp är giltigt: då menas "skapa eller fortsätt".
  }

  const db = serviceklient();

  try {
    let kontoId = profil.stripe_account_id as string | null;

    // ---------- 1. Kontot ----------
    if (!kontoId) {
      /* Recipient-konfiguration, inte merchant: studiehjälparen ska ta
         emot en överföring från Nextrum, aldrig själv skapa
         kortbetalningen. Att begära kortmottagning hade lagt på
         onboardingkrav som inte svarar mot vad personen faktiskt gör.

         fees_collector och losses_collector står båda på application:
         Nextrum betalar Stripes avgift och bär negativa saldon. Det är
         samma sak som att Nextrum äger kundrelationen, uttryckt i
         pengaflödet. */
      const skapat = await v2('POST', '/v2/core/accounts', {
        display_name: 'Nextrum studiehjälpare',
        dashboard: 'express',
        defaults: {
          currency: 'sek',
          locales: ['sv-SE'],
          responsibilities: {
            fees_collector: 'application',
            losses_collector: 'application',
          },
        },
        identity: {
          country: 'SE',
          // Juridisk form bekräftas i onboardingen. Personen kan visa
          // sig driva enskild firma, och då rättar Stripe det där.
          entity_type: 'individual',
        },
        configuration: {
          recipient: {
            capabilities: { stripe_transfers: { requested: true } },
          },
        },
        include: ['configuration.recipient', 'requirements'],
      // Idempotensnyckeln byggs av kod ur personens id. Två klick på
      // samma knapp får aldrig bli två anslutna konton, för det andra
      // blir föräldralöst och syns inte någonstans.
      }, `nextrum-konto-${vem.anvandare}`);

      kontoId = String((skapat as Konto).id ?? '');
      if (!kontoId) return json({ error: 'Stripe svarade utan konto-id.' }, 502, CORS);

      await db.from('tutor_profiles')
        .update({ stripe_account_id: kontoId, stripe_onboarding: 'pagar' })
        .eq('id', vem.anvandare);
    }

    // ---------- 2. Tillståndet, alltid läst från Stripe ----------
    const konto = await v2(
      'GET',
      `/v2/core/accounts/${kontoId}?include=configuration.recipient&include=requirements`,
    ) as Konto;

    const tillstand = last(konto);
    await db.from('tutor_profiles').update(tillstand).eq('id', vem.anvandare);

    // Är allt klart behövs ingen länk. Att ändå skicka en hade lett
    // personen in i ett formulär som inte frågar något.
    if (kropp.uppdatera || (tillstand.stripe_kan_ta_emot && tillstand.stripe_krav.length === 0)) {
      return json({ konto: kontoId, ...tillstand }, 200, CORS);
    }

    // ---------- 3. Onboardinglänken ----------
    /* retur och refresh kommer från anroparen. De får därför INTE
       användas rakt av: en öppen omdirigering i ett Stripe-flöde är en
       inloggningssida som ser äkta ut. Bara vår egen sajt släpps
       igenom, och annars faller vi tillbaka på studiehjälparvyn. */
    const tillaten = (u: unknown): string | null => {
      try {
        const a = new URL(String(u));
        const ok = a.hostname === 'nextrum.se' || a.hostname === 'www.nextrum.se'
          || a.hostname === 'localhost' || a.hostname === '127.0.0.1';
        return ok && (a.protocol === 'https:' || a.hostname === 'localhost') ? a.toString() : null;
      } catch {
        return null;
      }
    };
    const retur = tillaten(kropp.retur) ?? 'https://nextrum.se/larare';

    const lank = await v2('POST', '/v2/core/account_links', {
      account: kontoId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          configurations: ['recipient'],
          refresh_url: retur,
          return_url: retur,
        },
      },
    });

    return json({
      konto: kontoId,
      url: (lank as { url?: string }).url ?? null,
      ...tillstand,
    }, 200, CORS);
  } catch (e) {
    if (e instanceof StripeError) {
      /* Stripes text går vidare ordagrant. Den säger vilket fält som
         är fel, och det är precis vad som behövs första gången det här
         körs mot ett riktigt konto. Den läses av en studiehjälpare, så
         den får inte vara det enda som visas — vyn har en egen mening
         ovanför. */
      return json({ error: 'Stripe nekade: ' + e.fel.meddelande, stripe: e.fel }, 502, CORS);
    }
    return json({ error: (e as Error)?.message ?? 'Okänt fel.' }, 500, CORS);
  }
});
