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
// 4. FUNKTIONEN ÄR DEN ENDA SOM FÅR SKRIVA betalt_ore (Fas 14.1).
//    Siffran läses ur sessionens amount_total, alltså vad kortet
//    faktiskt drogs på. stripe-checkout skriver begart_ore — vad vi
//    bad om — och de två är olika saker så fort en gammal session
//    ligger kvar öppen med ett annat belopp.
//
//    Samtidigt hämtas BALANSTRANSAKTIONEN med sin avgift och sitt
//    netto. Utan den går Stripes klumputbetalning aldrig att stämma av
//    mot banken, och avgiften finns inte någonstans i systemet.
//
// 5. AVGIFTEN KOMMER OFTA SENARE (Fas 14.7). Här stod att
//    balanstransaktionen "bara finns att hämta här". Det var fel två
//    gånger om. Den finns ofta INTE än när sessionen fullbordas:
//    Stripe skapar den en stund efteråt, och de två första betalningarna
//    som gick hela vägen fick båda null. Och den går att hämta senare,
//    för charge-id:t sparas. charge.updated kommer när den finns, och
//    då skrivs den in. stripe-avstamning hämtar den för betalningar som
//    kom in innan händelsen fanns på endpointen.
//
// 6. BETALNINGEN TAS EMOT UR VARJE OBETALT LÄGE (Fas 14.6). Förut
//    skrevs den bara in på ett pass som stod 'vantar'. Nekas ett kort
//    sätter payment_intent.payment_failed 'misslyckad', men kassan är
//    fortfarande öppen och familjen kan försöka igen med ett annat
//    kort. Lyckades det träffade uppdateringen noll rader: pengarna var
//    dragna och passet stod som misslyckat. Detsamma om familjen valt
//    faktura, eller bytt tillbaka till kort, medan kassan stod öppen.
//    Kortet vinner: pengarna är dragna, och en faktura hinner bara
//    skapas om kassan stått öppen över en månadsskiftning, vilket
//    avvikelsen betald_och_fakturerad fångar.
//
// 7. SKARP ELLER TEST (Fas 14.7). Händelsens livemode sparas på
//    händelsen och på passet, så att en testbetalning aldrig ser ut
//    som en intäkt i ett underlag till bokföringen.
//
//
// verify_jwt = false. Anroparen är Stripe, inte en inloggad
// användare. Skyddet är signaturen, och raden står i config.toml i
// samma ändring som funktionen — se filhuvudet där för vad som annars
// händer vid nästa deploy.
// ============================================================

import { serviceklient } from '../_delad/auth.ts';
import { json } from '../_delad/http.ts';
import {
  aterbetalningsLage, arStripeId, balans, betallageEfterTvist, prövaSignatur, tidFranUnix, tvistOrsakText,
  tvistUnderlag, tvistUtfall, tvistVantarPaOss, v1,
} from '../_delad/stripe.ts';

type Handelse = {
  id?: string;
  type?: string;
  livemode?: boolean;
  data?: { object?: Record<string, unknown> };
};

// Lägen där passet ännu inte är betalt med kort. Se punkt 6 i
// filhuvudet. 'betald' är inte med: en andra leverans av samma
// betalning ska träffa noll rader.
const TAR_EMOT_BETALNING = ['ingen', 'vantar', 'misslyckad', 'faktura'];

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
  const skarp = typeof h.livemode === 'boolean' ? h.livemode : null;

  const db = serviceklient();

  // ---------- taket mot dubbletter ----------
  const { error: insfel } = await db.from('stripe_handelser').insert({ id, typ, skarp });
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

        /* ETT KÖPT KLIPPKORT (Fas 16.1) bär sitt id i metadata och
           inget client_reference_id. Det prövas FÖRST: en session för
           ett klippkort har inget pass, och grenen nedanför hade
           kvitterat den som "utan pass-id" med pengarna dragna. */
        const kkId = String((obj.metadata as Record<string, string> | undefined)?.klippkort_id ?? '');

        const passId = String(obj.client_reference_id
          ?? (obj.metadata as Record<string, string> | undefined)?.booking_id ?? '');
        if (!passId && !kkId) return await klar('session utan pass-id');

        const piId = String(obj.payment_intent ?? '');
        let chargeId: string | null = null;
        let b = balans(null);

        if (piId) {
          /* Charge-id:t är det enda som gör en senare
             charge.refunded-händelse spårbar till rätt pass utan att
             lita på metadata vi inte skriver själva.

             BALANSTRANSAKTIONEN ÄR DEN ANDRA HALVAN. Stripe betalar ut
             i KLUMPAR, netto efter avgift, med fördröjning: ingen rad på
             bankkontot motsvarar ett enskilt pass. txn_-id:t är enda
             vägen från passet till den bankraden, och avgiften finns
             ingen annanstans alls — den syns varken i vad familjen
             betalade eller i vad vi begärde. Ofta finns den inte än
             (punkt 5 i filhuvudet), och då kommer den med
             charge.updated. */
          const pi = await v1(
            'GET',
            `/v1/payment_intents/${piId}?expand[]=latest_charge.balance_transaction`,
          );
          const charge = (pi as { latest_charge?: Record<string, unknown> }).latest_charge;
          if (charge && typeof charge === 'object') {
            chargeId = String(charge.id ?? '') || null;
            b = balans((charge as { balance_transaction?: unknown }).balance_transaction);
          }
        }

        /* BELOPPET KOMMER FRÅN STRIPE, INTE FRÅN OSS (Fas 14.1).
           amount_total är vad kortet faktiskt drogs på. Förut skrev
           stripe-checkout betalt_ore redan när sessionen skapades, och
           betalade familjen en äldre session som låg kvar öppen med
           ett annat belopp stod fel siffra i raden för alltid. */
        const draget = typeof obj.amount_total === 'number' ? obj.amount_total : null;

        /* Klippkortet blir betalt, och giltigt från i dag, i databasen:
           klippkort_betald räknar sista dagen i Stockholmstid och träffar
           bara ett köp som väntar, så en andra leverans ändrar ingenting.
           Ett fel kastas, så att Stripe försöker igen — ett köp som inte
           blev skrivet är pengar familjen inte kan använda. */
        if (kkId) {
          const { data: blev, error: kkfel } = await db.rpc('klippkort_betald', {
            p_id: kkId, p_betalt: draget, p_pi: piId || null, p_charge: chargeId,
            p_bt: b.id, p_avgift: b.avgiftOre, p_netto: b.nettoOre, p_skarp: skarp,
          });
          if (kkfel) throw new Error('klippkort_betald: ' + kkfel.message);
          return await klar(blev ? 'klippkort betalt' : 'klippkortet var redan betalt');
        }

        const kortbetalning = {
          betalning_status: 'betald',
          betald_at: new Date().toISOString(),
          stripe_payment_intent_id: piId || null,
          stripe_charge_id: chargeId,
          stripe_balanstransaktion_id: b.id,
          stripe_avgift_ore: b.avgiftOre,
          stripe_netto_ore: b.nettoOre,
          stripe_skarp: skarp,
          betalt_ore: draget,
          /* NOLLAS, och det är avsiktligt. Kolumnerna beskriver den
             betalning som gäller NU. Ett pass som återbetalades och
             sedan betalades igen har en ny charge, och den gamla
             återbetalningen hör till den gamla. Läts siffran stå kvar
             räknade stripe-aterbetalning taket mot fel belopp och
             svarade "Hela beloppet är redan återbetalt" på en
             betalning som just kommit in. */
          aterbetald_ore: 0,
        };

        /* Villkoret på läget är inte pynt. Två samtidiga leveranser som
           båda ser hanterad_at = null hinner annars båda hit; när den
           första satt 'betald' träffar den andra noll rader. Listan
           står i TAR_EMOT_BETALNING, se punkt 6 i filhuvudet. */
        const { data: traffade } = await db.from('bookings').update(kortbetalning)
          .eq('id', passId).in('betalning_status', TAR_EMOT_BETALNING).select('id');

        /* PASSET VAR REDAN BETALT MED TIMMAR (Fas 16.1). Kassan kan ha
           stått öppen när familjen drog timmarna — klippkort-betala
           stänger den, men en betalning som redan var på väg hinner
           igenom. Pengarna är dragna, så kortet vinner, som i punkt 6:
           passet står som betalt med kort, och klippkort_id nollas så
           att timmarna kommer tillbaka på kortet. En andra leverans
           träffar noll rader, för då finns stripe_payment_intent_id. */
        if (!traffade?.length) {
          const { data: tillbaka } = await db.from('bookings')
            .update({ ...kortbetalning, klippkort_id: null })
            .eq('id', passId).eq('betalning_status', 'betald')
            .not('klippkort_id', 'is', null).is('stripe_payment_intent_id', null)
            .select('id');
          if (tillbaka?.length) return await klar('betald med kort, klippkortets timmar tillbaka');
        }

        return await klar('betald');
      }

      // ---------- avgiften kom (Fas 14.7) ----------
      /* charge.updated kommer för många saker: en ändrad beskrivning,
         metadata, en fångad betalning. Bara en sak intresserar oss:
         att balanstransaktionen nu finns. Allt annat är klart utan att
         något skrivs. En avgift som redan står skrivs aldrig över. */
      case 'charge.updated': {
        const chargeId = String(obj.id ?? '');
        if (!arStripeId(chargeId, 'ch') && !arStripeId(chargeId, 'py')) return await klar('charge utan id');
        let bt = balans(obj.balance_transaction);
        if (!bt.id) return await klar('ingen balanstransaktion än');

        /* Ett pass eller ett köpt klippkort (Fas 16.1): avgiften hör till
           den rad som bär chargen, och det är aldrig båda. */
        const { data: pass } = await db.from('bookings')
          .select('id, stripe_avgift_ore').eq('stripe_charge_id', chargeId).maybeSingle();
        const { data: kort } = pass ? { data: null } : await db.from('klippkort')
          .select('id, stripe_avgift_ore').eq('stripe_charge_id', chargeId).maybeSingle();
        const rad = pass ?? kort;
        if (!rad) return await klar('charge utan pass');
        if (rad.stripe_avgift_ore !== null && rad.stripe_avgift_ore !== undefined) {
          return await klar('avgiften fanns redan');
        }

        if (bt.avgiftOre === null && arStripeId(bt.id, 'txn')) {
          bt = balans(await v1('GET', `/v1/balance_transactions/${bt.id}`));
        }
        await db.from(pass ? 'bookings' : 'klippkort').update({
          stripe_balanstransaktion_id: bt.id,
          stripe_avgift_ore: bt.avgiftOre,
          stripe_netto_ore: bt.nettoOre,
        }).eq('id', rad.id).is('stripe_avgift_ore', null);
        return await klar(bt.avgiftOre === null ? 'balanstransaktion utan avgift' : `avgift ${bt.avgiftOre} öre`);
      }

      // ---------- betalningen gick inte igenom ----------
      case 'payment_intent.payment_failed': {
        const kkId = String((obj.metadata as Record<string, string> | undefined)?.klippkort_id ?? '');
        if (kkId) {
          await db.from('klippkort').update({ status: 'misslyckad' })
            .eq('id', kkId).eq('status', 'vantar');
          return await klar('klippkort misslyckat');
        }
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
          /* Ett klippkort (Fas 16.1) STÄNGS av varje återbetalning, också
             en delvis. Villkoren har tre skäl att betala tillbaka ett
             köp: ångerrätten, att familjen slutar, och en timme som gick
             förlorad när kortet löpte ut för att vi avbokat för sent. I
             alla tre är kortet slut. En delåterbetalning som lämnade det
             öppet hade låtit familjen fortsätta dra timmar som redan gått
             tillbaka. */
          const { data: kort } = await db.from('klippkort')
            .update({ aterbetald_ore: aterbetalt, status: 'aterbetald' })
            .eq('stripe_charge_id', chargeId).select('id');
          if (kort?.length) return await klar(`klippkort återbetalt ${aterbetalt} öre, stängt`);
          return await klar(`återbetalt ${aterbetalt} öre`);
        }
        const passId = String((obj.metadata as Record<string, string> | undefined)?.booking_id ?? '');
        if (!passId) return await klar('återbetalning utan charge-id och utan pass-id');
        await db.from('bookings').update(andring).eq('id', passId);
        return await klar(`återbetalt ${aterbetalt} öre (via metadata)`);
      }

      // ---------- korttvist (Fas 14.3) ----------
      /* Förut sattes bara betalning_status = 'tvist'. Sista dagen att
         svara, orsaken och utfallet stod ingenstans, och en förlorad
         tvist såg ut precis som en öppen. Nu sparas allt det i
         stripe_tvister, och den som ska svara får en uppgift med dagen
         som förfallodag.

         HÄNDELSERNA KAN KOMMA I FEL ORDNING. Stripe lovar inte ordning,
         och ett sent 'updated' efter 'closed' får inte öppna en avgjord
         tvist igen. En stängd rad skrivs därför bara över av en annan
         stängning. Passets läge räknas sedan ur raden som den blev, inte
         ur händelsen som råkade komma sist. */
      case 'charge.dispute.created':
      case 'charge.dispute.updated':
      case 'charge.dispute.closed': {
        const tvistId = String(obj.id ?? '');
        const chargeId = String(obj.charge ?? '');
        if (!tvistId || !chargeId) return await klar('tvist utan id eller charge');

        const lage = String(obj.status ?? '') || 'needs_response';
        const stangs = typ === 'charge.dispute.closed' || tvistUtfall(lage) !== 'oppen';
        const nu = new Date().toISOString();

        const { data: passen } = await db.from('bookings')
          .select('id, betalning_status').eq('stripe_charge_id', chargeId).limit(1);
        const pass = passen?.[0] ?? null;
        // Ett köpt klippkort kan också bestridas (Fas 16.1).
        const { data: kort } = pass ? { data: null } : await db.from('klippkort')
          .select('id, status').eq('stripe_charge_id', chargeId).maybeSingle();

        const { data: forut } = await db.from('stripe_tvister')
          .select('stangd, lage').eq('id', tvistId).maybeSingle();
        if (forut?.stangd && !stangs) {
          return await klar(`tvist ${tvistId}: sen händelse efter stängning, ignorerad`);
        }

        const evidens = obj.evidence_details as Record<string, unknown> | undefined;
        const { error: tvfel } = await db.from('stripe_tvister').upsert({
          id: tvistId,
          booking_id: pass?.id ?? null,
          charge_id: chargeId,
          orsak: String(obj.reason ?? '') || null,
          lage,
          belopp_ore: typeof obj.amount === 'number' ? obj.amount : null,
          svara_senast: tidFranUnix(evidens?.due_by),
          skarp: obj.livemode === true,
          skapad: tidFranUnix(obj.created) ?? nu,
          stangd: stangs ? nu : null,
          uppdaterad: nu,
        }, { onConflict: 'id' });
        // Ett fel här ska synas: raden i stripe_handelser lämnas då
        // ohanterad och Stripe skickar händelsen igen.
        if (tvfel) throw new Error('stripe_tvister: ' + tvfel.message);

        /* Passet ändras bara om det står som betalt eller i tvist. Ett
           pass som redan återbetalats har fått pengarna tillbaka en gång;
           tvisten syns i stripe_tvister, och läget ska inte ljuga om att
           de dragits igen. */
        if (pass && (pass.betalning_status === 'betald' || pass.betalning_status === 'tvist')) {
          await db.from('bookings')
            .update({ betalning_status: betallageEfterTvist(tvistUtfall(lage)) })
            .eq('id', pass.id);
        }
        /* Ett klippkort i tvist går inte att dra timmar från
           (klippkort_dra kräver 'betald'): pengarna kan vara på väg
           tillbaka. Vinner vi öppnas det igen; förlorar vi står det kvar
           som tvist, som passen. */
        if (kort && (kort.status === 'betald' || kort.status === 'tvist')) {
          await db.from('klippkort')
            .update({ status: betallageEfterTvist(tvistUtfall(lage)) })
            .eq('id', kort.id);
        }

        /* En uppgift när Stripe väntar på oss, med dagen som förfallodag.
           Nyckeln är tvistens id, och skapa_uppgift vägrar en andra
           medan den första är öppen — så en ny 'updated' blir ingen
           dubblett. Titeln byggs av kod: ingen text från Stripe eller
           kortinnehavaren hamnar i den. */
        let uppgiftsfel = '';
        if (tvistVantarPaOss(lage)) {
          const senast = tidFranUnix(evidens?.due_by);
          /* DAGEN RÄKNAS I UTC, med flit. Stripe sätter ofta fristen
             strax före midnatt UTC, och då är det redan nästa dag i
             Stockholm. UTC-datumet är aldrig senare än den verkliga
             fristen, bara ibland en dag tidigare, och en dag för tidigt
             kostar ingenting. */
          const dag = senast
            ? new Date(senast).toLocaleDateString('sv-SE', { timeZone: 'UTC', day: 'numeric', month: 'long' })
            : null;
          const kr = typeof obj.amount === 'number' ? `${Math.round(obj.amount / 100)} kr` : 'okänt belopp';
          const { error: ufel } = await db.rpc('skapa_uppgift', {
            p_titel: dag ? `Svara på korttvisten senast ${dag}` : 'Svara på korttvisten',
            p_nyckel: `tvist:${tvistId}`,
            p_typ: 'problem',
            p_beskrivning: `${tvistOrsakText(String(obj.reason ?? ''))}. Belopp: ${kr}. `
              + `${tvistUnderlag(String(obj.reason ?? ''))} Underlaget skickas in i Stripes dashboard, `
              + 'under Tvister. Missas dagen är tvisten förlorad. Se DEPLOY-BETALNING.md 9.10.',
            p_kopplad_tabell: pass ? 'bookings' : kort ? 'klippkort' : null,
            p_kopplad_id: pass?.id ?? kort?.id ?? null,
            p_forfallodag: senast ? senast.slice(0, 10) : null,
            p_skapad_av_typ: 'system',
          });
          // Tvisten ÄR sparad. Att uppgiften inte blev av syns i
          // stripe_handelser, i stället för att få hela leveransen att
          // köras om och skriva raden en gång till.
          if (ufel) uppgiftsfel = ', uppgiften gick inte att skapa: ' + ufel.message;
        }

        /* Tvisten belastar Nextrums saldo. Studiehjälparens ersättning
           räknas ur rapporten och påverkas inte av en tvist: om den ska
           det är ett beslut för en människa, inte för en webhook. */
        return await klar(`tvist ${tvistId}: ${lage}${uppgiftsfel}`);
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
