// ============================================================
// NEXTRUM — stripe-webhook (Fas 12.2)
//
// Den ENDA väg som får ändra en betalnings status.
//
// Att familjen kommer tillbaka till success_url betyder ingenting: den
// adressen kan vem som helst öppna, och webbläsaren kan dö mellan
// betalningen och redirecten. Samma regel som faktura-utskick redan
// följer åt andra hållet — mejlet först, statusen sedan — och av
// samma skäl: ett läge som säger "betald" om en betalning som inte
// skedde får någon att sluta undra var pengarna tog vägen.
//
//
// TRE SAKER SOM BÄR FUNKTIONEN
//
// 1. SIGNATUREN PRÖVAS PÅ DEN RÅA KROPPEN. Går texten genom
//    JSON.parse och tillbaka stämmer inte signaturen längre:
//    nyckelordning och mellanrum ändras. Felet ser då ut som att
//    Stripe skickar skräp, och det är svårt att sluta tro.
//
// 2. SAMMA HÄNDELSE FÅR KOMMA IGEN. Stripe garanterar MINST en
//    leverans, inte exakt en. Taket är primärnyckeln i
//    stripe_handelser. En andra leverans av ett id som redan är
//    hanterat svarar 200 och gör ingenting: ett fel hade fått Stripe
//    att försöka igen i all oändlighet med något som redan är klart.
//
//    En leverans som PÅBÖRJADES men inte blev klar (raden finns,
//    hanterad_at är null) körs däremot om. Annars hade ett
//    tillfälligt databasfel gjort en betalning osynlig för alltid.
//
// 3. CHARGE-ID HÄMTAS, FÖR DET BEHÖVS SENARE. En återbetalning görs
//    mot betalningen, men charge.refunded-händelsen kommer tillbaka
//    med charge-id:t. Sparas det inte nu finns ingen väg från
//    händelsen till passet som inte går genom metadata, och den
//    metadatan ärver Stripe åt oss i stället för att vi skriver den.
//
//    Sedan Fas 12.5 finns ingen transfer att hålla reda på: hela
//    beloppet stannar hos Nextrum, och studiehjälparen får sitt den
//    25:e genom payouts.
//
//
// verify_jwt = false. Anroparen är Stripe, inte en inloggad
// användare. Skyddet är signaturen, och raden står i config.toml i
// samma ändring som funktionen — se filhuvudet där för vad som annars
// händer vid nästa deploy.
// ============================================================

import { serviceklient } from '../_delad/auth.ts';
import { json } from '../_delad/http.ts';
import { aterbetalningsLage, prövaSignatur, v1 } from '../_delad/stripe.ts';

type Handelse = {
  id?: string;
  type?: string;
  data?: { object?: Record<string, unknown> };
};

Deno.serve(async (req) => {
  // Ingen CORS och ingen OPTIONS: ingen webbläsare ska nå hit.
  if (req.method !== 'POST') return json({ error: 'Bara POST.' }, 405, {});

  const raKropp = await req.text();

  /* Hemligheten ligger i miljön här, inte i en tabell. Skillnaden mot
     notis_konfig är att den här hemligheten ÄGS av Stripe: den byts i
     Stripes dashboard, och en tabellrad hade bara blivit en andra
     plats där samma sträng kan bli inaktuell. */
  const provning = await prövaSignatur(
    raKropp,
    req.headers.get('stripe-signature'),
    Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '',
  );
  if (!provning.ok) {
    // 400, inte 401: Stripe ska inte försöka igen med en leverans som
    // aldrig kommer att gå igenom.
    return json({ error: provning.skal }, 400, {});
  }

  const h = provning.handelse as Handelse;
  const id = String(h.id ?? '');
  const typ = String(h.type ?? '');
  const obj = (h.data?.object ?? {}) as Record<string, unknown>;
  if (!id || !typ) return json({ error: 'Händelsen saknar id eller typ.' }, 400, {});

  const db = serviceklient();

  // ---------- taket mot dubbletter ----------
  const { error: insfel } = await db.from('stripe_handelser').insert({ id, typ });
  if (insfel) {
    if (insfel.code !== '23505') {
      return json({ error: 'Kunde inte ta emot händelsen.' }, 500, {});
    }
    const { data: sedd } = await db.from('stripe_handelser')
      .select('hanterad_at').eq('id', id).maybeSingle();
    if (sedd?.hanterad_at) {
      return json({ ok: true, not: 'redan hanterad' }, 200, {});
    }
    // Finns men aldrig blev klar: kör om.
  }

  const klar = async (resultat: string) => {
    await db.from('stripe_handelser')
      .update({ hanterad_at: new Date().toISOString(), resultat })
      .eq('id', id);
    return json({ ok: true, resultat }, 200, {});
  };

  try {
    switch (typ) {
      // ---------- betalningen gick igenom ----------
      case 'checkout.session.completed': {
        if (obj.payment_status !== 'paid') return await klar('session utan betalning');

        const passId = String(obj.client_reference_id
          ?? (obj.metadata as Record<string, string> | undefined)?.booking_id ?? '');
        if (!passId) return await klar('session utan pass-id');

        const piId = String(obj.payment_intent ?? '');
        let chargeId: string | null = null;

        if (piId) {
          /* Charge-id:t är det enda som gör en senare
             charge.refunded-händelse spårbar till rätt pass utan att
             lita på metadata vi inte skriver själva. */
          const pi = await v1('GET', `/v1/payment_intents/${piId}?expand[]=latest_charge`);
          const charge = (pi as { latest_charge?: Record<string, unknown> }).latest_charge;
          if (charge && typeof charge === 'object') chargeId = String(charge.id ?? '') || null;
        }

        /* `.eq('betalning_status', 'vantar')` är inte pynt. Två
           samtidiga leveranser som båda ser hanterad_at = null hinner
           annars båda hit; den andra träffar noll rader. */
        await db.from('bookings').update({
          betalning_status: 'betald',
          betald_at: new Date().toISOString(),
          stripe_payment_intent_id: piId || null,
          stripe_charge_id: chargeId,
        }).eq('id', passId).eq('betalning_status', 'vantar');

        return await klar('betald');
      }

      // ---------- betalningen gick inte igenom ----------
      case 'payment_intent.payment_failed': {
        const passId = String((obj.metadata as Record<string, string> | undefined)?.booking_id ?? '');
        if (!passId) return await klar('utan pass-id');
        // Tillbaka till "misslyckad", inte till "ingen": familjen ska
        // kunna försöka igen, och adminvyn ska kunna se att det hände.
        await db.from('bookings').update({ betalning_status: 'misslyckad' })
          .eq('id', passId).eq('betalning_status', 'vantar');
        return await klar('misslyckad');
      }

      // ---------- återbetalning ----------
      case 'charge.refunded': {
        const aterbetalt = Number(obj.amount_refunded ?? 0);
        const totalt = Number(obj.amount ?? 0);
        const andring = {
          aterbetald_ore: aterbetalt,
          betalning_status: aterbetalningsLage(aterbetalt, totalt),
        };

        /* CHARGE-ID FÖRST, metadata bara som reserv.
           metadata på en charge ÄRVS från PaymentIntent, och den
           ärvningen är Stripes beteende, inte något vi styr. Charge-id
           skrev vi själva när betalningen kom in, så det är det enda
           här som vi vet finns.

           Händelsen kommer också när någon återbetalat i Stripes
           dashboard, alltså utan att ha gått genom vår funktion. Då är
           det HÄR siffran hamnar. */
        const chargeId = String(obj.id ?? '');
        if (chargeId) {
          await db.from('bookings').update(andring).eq('stripe_charge_id', chargeId);
          return await klar(`återbetalt ${aterbetalt} öre`);
        }
        const passId = String((obj.metadata as Record<string, string> | undefined)?.booking_id ?? '');
        if (!passId) return await klar('återbetalning utan charge-id och utan pass-id');
        await db.from('bookings').update(andring).eq('id', passId);
        return await klar(`återbetalt ${aterbetalt} öre (via metadata)`);
      }

      // ---------- korttvist ----------
      case 'charge.dispute.created':
      case 'charge.dispute.closed': {
        const chargeId = String(obj.charge ?? '');
        if (!chargeId) return await klar('tvist utan charge');
        const vunnen = typ.endsWith('closed') && obj.status === 'won';
        await db.from('bookings')
          .update({ betalning_status: vunnen ? 'betald' : 'tvist' })
          .eq('stripe_charge_id', chargeId);
        /* Tvisten belastar NEXTRUMS saldo, inte studiehjälparens.
           Att föra tillbaka hens del är ett beslut för en människa och
           beror på vad avtalet säger — därför ingen automatisk
           transfer reversal här. */
        return await klar(`tvist: ${String(obj.status ?? typ)}`);
      }

      /* HÄR LÅG transfer.created, transfer.reversed, account.updated
         och payout.*. Alla fyra hörde till Connect: anslutna konton,
         överföringar till dem och Stripes utbetalningar från deras
         saldon. Inget av det finns kvar sedan Fas 12.5, så de faller
         igenom till default nedan och kvitteras som ohanterade. Skulle
         de dyka upp ändå är det ett tecken på att någon slagit på
         Connect igen, inte något den här funktionen ska tolka. */

      default:
        // Okända typer kvitteras. Att svara med fel hade fått Stripe
        // att köa om varje händelse vi inte bryr oss om.
        return await klar('ohanterad typ');
    }
  } catch (e) {
    /* Raden lämnas med hanterad_at = null, så att Stripes nästa försök
       kör om den. 500 är rätt här: det säger åt Stripe att komma
       tillbaka. */
    return json({ error: (e as Error)?.message ?? 'Okänt fel.' }, 500, {});
  }
});
