// ============================================================
// NEXTRUM — stripe-aterbetalning (Fas 12.4)
//
// Punkt 9 på MVP-listan: återbetalning med transfer reversal.
//
// Utan den här funktionen finns ingen väg tillbaka. En familj som ska
// ha pengar tillbaka hade krävt att någon loggar in i Stripes
// dashboard och kommer ihåg att kryssa i båda rutorna, varje gång.
//
//
// TVÅ KRYSS SOM MÅSTE VARA I, OCH VARFÖR
//
// reverse_transfer: studiehjälparens del ligger redan på HENS konto
// (destination charge). Utan reversal betalar Nextrum tillbaka hela
// beloppet till familjen medan hjälparen behåller sin del. Pengarna
// kommer då ur Nextrums ficka, tyst.
//
// refund_application_fee: annars behåller Nextrum sin avgift på ett
// pass som aldrig blev av. Det är inte en intäkt, det är en skuld.
//
//
// FUNKTIONEN SÄTTER INGET LÄGE UR EGET HUVUD
//
// Den läser tillbaka charge-objektet från Stripe efteråt och skriver
// amount_refunded därifrån — exakt samma fält webhooken använder. Så
// spelar det ingen roll om återbetalningen gjordes här eller i Stripes
// dashboard: båda vägarna hamnar på samma siffra, och den siffran
// kommer från Stripe, aldrig från ett anrop.
//
//
// BELOPPET KOMMER FRÅN DATABASEN, INTE FRÅN ANROPET
//
// Admin får säga "återbetala en del" och hur mycket, men taket är vad
// som faktiskt betalats minus vad som redan gått tillbaka, läst ur
// raden. Ett anrop kan alltså inte betala tillbaka mer än vad som kom
// in. Samma regel som att stripe-checkout räknar priset själv.
// ============================================================

import { kravAdmin, serviceklient } from '../_delad/auth.ts';
import { cors, json, preflight } from '../_delad/http.ts';
import { aterbetalningsLage, StripeError, v1 } from '../_delad/stripe.ts';

const CORS = cors();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(CORS);
  if (req.method !== 'POST') return json({ error: 'Bara POST.' }, 405, CORS);

  // Anroparens egen token prövas mot Auth OCH is_admin innan
  // service_role rör någonting. Att gömma knappen är inte säkerhet.
  const vem = await kravAdmin(req.headers.get('authorization'));
  if (!vem.ok) return vem.svar;

  let kropp: { pass?: string; belopp_ore?: number; anledning?: string } = {};
  try {
    kropp = await req.json();
  } catch {
    return json({ error: 'Kroppen är inte JSON.' }, 400, CORS);
  }
  const passId = String(kropp.pass ?? '').trim();
  if (!passId) return json({ error: 'Vilket pass?' }, 400, CORS);

  const db = serviceklient();

  try {
    const { data: pass, error: passfel } = await db
      .from('bookings')
      .select('id, betalning_status, stripe_payment_intent_id, stripe_charge_id, betalt_ore, aterbetald_ore')
      .eq('id', passId)
      .maybeSingle();

    if (passfel) return json({ error: 'Passet gick inte att läsa.' }, 500, CORS);
    if (!pass) return json({ error: 'Passet finns inte.' }, 404, CORS);

    if (!pass.stripe_payment_intent_id) {
      return json({ error: 'Passet har ingen genomförd kortbetalning.' }, 409, CORS);
    }
    if (pass.betalning_status !== 'betald' && pass.betalning_status !== 'tvist') {
      return json({
        error: `Passet står som "${pass.betalning_status}" och går inte att återbetala.`,
      }, 409, CORS);
    }

    const betalt = Number(pass.betalt_ore ?? 0);
    const redan = Number(pass.aterbetald_ore ?? 0);
    const kvar = betalt - redan;
    if (kvar <= 0) return json({ error: 'Hela beloppet är redan återbetalt.' }, 409, CORS);

    /* Utan belopp i anropet betyder det HELA resten. Med belopp
       begränsas det till resten — en admin som skriver fel siffra ska
       inte kunna betala tillbaka mer än som kom in. */
    const onskat = Number(kropp.belopp_ore ?? 0);
    const belopp = onskat > 0 ? Math.min(Math.round(onskat), kvar) : kvar;
    if (belopp <= 0) return json({ error: 'Beloppet blir noll.' }, 409, CORS);

    /* Anledningen är fritext från admin och går till Stripes metadata,
       aldrig till familjen. Kapad, för att metadata har en gräns och
       ett avvisat anrop hade sett ut som ett fel i återbetalningen. */
    const anledning = String(kropp.anledning ?? '').slice(0, 300);

    const aterbetalning = await v1('POST', '/v1/refunds', {
      payment_intent: pass.stripe_payment_intent_id,
      amount: belopp,
      // De två kryssen. Se filhuvudet.
      reverse_transfer: true,
      refund_application_fee: true,
      metadata: { booking_id: pass.id, av: vem.anvandare, anledning },
    // Nyckeln bär passet OCH beloppet: två klick på samma knapp ger en
    // återbetalning, men en andra, avsiktlig delåterbetalning på ett
    // annat belopp går fortfarande igenom.
    }, `nextrum-aterbet-${pass.id}-${redan}-${belopp}`);

    /* Läget läses TILLBAKA från Stripe, inte räknat ut här. Charge-
       objektets amount_refunded är summan av alla återbetalningar på
       betalningen, och det är samma fält webhooken skriver från. */
    let aterbetaltTotalt = redan + belopp;
    let laddat = false;
    const chargeId = pass.stripe_charge_id
      ?? (aterbetalning as { charge?: string }).charge
      ?? null;

    if (chargeId) {
      try {
        const charge = await v1('GET', `/v1/charges/${chargeId}`);
        aterbetaltTotalt = Number((charge as { amount_refunded?: number }).amount_refunded ?? aterbetaltTotalt);
        laddat = true;
      } catch {
        /* Återbetalningen ÄR gjord. Att läsningen efteråt inte gick
           fram får inte se ut som att den misslyckades: webhooken
           skriver samma siffra när charge.refunded kommer. */
      }
    }

    const { error: sparfel } = await db.from('bookings').update({
      aterbetald_ore: aterbetaltTotalt,
      betalning_status: aterbetalningsLage(aterbetaltTotalt, betalt),
      stripe_charge_id: chargeId,
    }).eq('id', pass.id);

    return json({
      ok: true,
      aterbetalning: (aterbetalning as { id?: string }).id ?? null,
      belopp_ore: belopp,
      aterbetalt_totalt_ore: aterbetaltTotalt,
      last_fran_stripe: laddat,
      // Skrivfelet döljs inte. Pengarna är tillbaka hos familjen
      // oavsett, men adminvyn skulle visa fel tills webhooken hinner.
      varning: sparfel ? 'Återbetalningen gick igenom men raden kunde inte uppdateras: ' + sparfel.message : null,
    }, 200, CORS);
  } catch (e) {
    if (e instanceof StripeError) {
      return json({ error: 'Stripe nekade: ' + e.fel.meddelande, stripe: e.fel }, 502, CORS);
    }
    return json({ error: (e as Error)?.message ?? 'Okänt fel.' }, 500, CORS);
  }
});
