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

  /* EN BETALNING SOM INTE KUNDE SKRIVAS NER: två kassor stod öppna och
     familjen betalade båda, eller raden tog inte emot betalningen av
     något annat skäl. Pengarna är dragna, men raden bär en annan
     betalning eller ingen, så den här syns ingenstans utom i Stripe.
     Förut kvitterades den som betald och försvann. Nu en uppgift, så att
     en människa betalar tillbaka den. skapa_uppgift svarar null på en
     andra leverans med samma nyckel, så en omleverans ger ingen dubblett. */
  const ejNedskriven = async (vad: string, pi: string, belopp: number | null,
    kopplad: { tabell: 'bookings'; id: string } | null) => {
    const kr = typeof belopp === 'number' ? `${Math.round(belopp / 100)} kr` : 'okänt belopp';
    const { error } = await db.rpc('skapa_uppgift', {
      p_titel: 'Kontrollera en kortbetalning som inte blev nedskriven',
      p_nyckel: `ej-nedskriven:${pi || 'utan-pi'}`,
      p_typ: 'problem',
      p_beskrivning: `Stripe tog ${kr} för ${vad} (${pi || 'utan payment intent'}), men raden bär redan `
        + 'en annan betalning eller tog inte emot den. Troligen en andra kassa som stod öppen. '
        + 'Stäm av i Stripes dashboard och betala tillbaka det som betalats två gånger.',
      p_kopplad_tabell: kopplad?.tabell ?? null,
      p_kopplad_id: kopplad?.id ?? null,
      p_skapad_av_typ: 'system',
    });
    if (error) throw new Error('skapa_uppgift: ' + error.message);
    return await klar(`ej nedskriven: ${vad}, uppgift skapad`);
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
        // Ett tillägg för övertid (Fas 20.1) bär sitt pass här, aldrig i
        // booking_id: det är inte passets betalning.
        const tillaggId = String((obj.metadata as Record<string, string> | undefined)?.tillagg_booking_id ?? '');

        const passId = String(obj.client_reference_id
          ?? (obj.metadata as Record<string, string> | undefined)?.booking_id ?? '');
        if (!passId && !kkId && !tillaggId) return await klar('session utan pass-id');

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
          if (blev) return await klar('klippkort betalt');
          const { data: kk, error: kklas } = await db.from('klippkort')
            .select('stripe_payment_intent_id').eq('id', kkId).maybeSingle();
          if (kklas) throw new Error('klippkort: ' + kklas.message);
          if (piId && kk?.stripe_payment_intent_id !== piId) {
            return await ejNedskriven(`klippkortet ${kkId}`, piId, draget, null);
          }
          return await klar('klippkortet var redan betalt');
        }

        /* TILLÄGGET (Fas 20.1) skrivs på sin egen rad, aldrig på passets
           betalningskolumner. Villkoret på läget gör en andra leverans
           till noll rader, som för passet. Ett fel kastas: ett betalt
           tillägg som inte blev skrivet fortsätter larma som obetalt. */
        if (tillaggId) {
          /* Minuterna betalningen avsåg, som för passet: raden kan ha
             skrivits om av en senare kassa medan den här stod öppen. */
          const tMinText = (obj.metadata as Record<string, string> | undefined)?.minuter;
          const tMin = /^\d{1,3}$/.test(String(tMinText ?? '')) && Number(tMinText) >= 1 && Number(tMinText) <= 240
            ? Number(tMinText) : null;
          const { data: blev, error: tfel } = await db.from('pass_tillagg').update({
            ...(tMin !== null ? { minuter: tMin } : {}),
            status: 'betald',
            betald_at: new Date().toISOString(),
            betalt_ore: draget,
            aterbetald_ore: 0,
            stripe_payment_intent_id: piId || null,
            stripe_charge_id: chargeId,
            stripe_balanstransaktion_id: b.id,
            stripe_avgift_ore: b.avgiftOre,
            stripe_netto_ore: b.nettoOre,
            stripe_skarp: skarp,
          }).eq('booking_id', tillaggId).in('status', ['vantar', 'misslyckad']).select('booking_id');
          if (tfel) throw new Error('pass_tillagg: ' + tfel.message);
          if (blev?.length) return await klar('tillägg betalt');
          const { data: tr, error: tlas } = await db.from('pass_tillagg')
            .select('stripe_payment_intent_id').eq('booking_id', tillaggId).maybeSingle();
          if (tlas) throw new Error('pass_tillagg: ' + tlas.message);
          if (piId && tr?.stripe_payment_intent_id !== piId) {
            return await ejNedskriven('tillägget till passet', piId, draget, { tabell: 'bookings', id: tillaggId });
          }
          return await klar('tillägget var redan betalt');
        }

        /* Minuterna betalningen avsåg (Fas 20.1), ur metadata vi själva
           skrev i stripe-checkout. Saknas de, eller ser de fel ut, skrivs
           inget: passunderlag räknar då med det bokade, som förut. */
        const minText = (obj.metadata as Record<string, string> | undefined)?.minuter;
        const minuter = /^\d{2,3}$/.test(String(minText ?? '')) && Number(minText) >= 15 && Number(minText) <= 240
          ? Number(minText) : null;

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
          stripe_minuter: minuter,
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
        const { data: traffade, error: skrivfel } = await db.from('bookings').update(kortbetalning)
          .eq('id', passId).in('betalning_status', TAR_EMOT_BETALNING).select('id');
        /* Ett fel kastas, så att raden i stripe_handelser står kvar ohanterad
           och Stripe försöker igen. Förut lästes felet aldrig: ett tillfälligt
           fel gav 200, och passet stod obetalt med pengarna dragna. */
        if (skrivfel) throw new Error('bookings: ' + skrivfel.message);

        /* PASSET VAR REDAN BETALT MED TIMMAR (Fas 16.1). Kassan kan ha
           stått öppen när familjen drog timmarna — klippkort-betala
           stänger den, men en betalning som redan var på väg hinner
           igenom. Pengarna är dragna, så kortet vinner, som i punkt 6:
           passet står som betalt med kort, och klippkort_id nollas så
           att timmarna kommer tillbaka på kortet. En andra leverans
           träffar noll rader, för då finns stripe_payment_intent_id. */
        if (!traffade?.length) {
          const { data: tillbaka, error: tbfel } = await db.from('bookings')
            .update({ ...kortbetalning, klippkort_id: null })
            .eq('id', passId).eq('betalning_status', 'betald')
            .not('klippkort_id', 'is', null).is('stripe_payment_intent_id', null)
            .select('id');
          if (tbfel) throw new Error('bookings: ' + tbfel.message);
          if (tillbaka?.length) return await klar('betald med kort, klippkortets timmar tillbaka');

          /* PASSET VAR BETALT MED TIMBANKEN (Fas 22.1). Samma sak: kortet
             vinner. timbank_kort_vinner skriver kortbetalningen och ger
             tillbaka minuterna i samma transaktion. Förut var det två anrop,
             och föll det andra stod passet som obetalt med pengarna dragna
             tills Stripe levererade igen. Ett fel kastas, så att Stripe
             försöker igen: ingenting är då skrivet. */
          const { data: vann, error: bankfel } = await db.rpc('timbank_kort_vinner',
            { p_pass: passId, p_kort: kortbetalning });
          if (bankfel) throw new Error('timbank_kort_vinner: ' + bankfel.message);
          if (vann === true) return await klar('betald med kort, timbankens minuter tillbaka');

          /* Ingenting tog emot betalningen. Bär passet samma betalning är
             det en andra leverans av samma händelse, och allt är redan
             nedskrivet. Annars är det en betalning till. */
          const { data: nu, error: nufel } = await db.from('bookings')
            .select('stripe_payment_intent_id').eq('id', passId).maybeSingle();
          if (nufel) throw new Error('bookings: ' + nufel.message);
          if (piId && nu?.stripe_payment_intent_id !== piId) {
            return await ejNedskriven('passet', piId, draget, nu ? { tabell: 'bookings', id: passId } : null);
          }
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
        /* En läsning som faller kastas: annars såg den ut som "ingen rad",
           och händelsen kvitterades som en charge utan pass. */
        const { data: pass, error: l1 } = await db.from('bookings')
          .select('id, stripe_avgift_ore').eq('stripe_charge_id', chargeId).maybeSingle();
        if (l1) throw new Error('bookings: ' + l1.message);
        const { data: kort, error: l2 } = pass ? { data: null, error: null } : await db.from('klippkort')
          .select('id, stripe_avgift_ore').eq('stripe_charge_id', chargeId).maybeSingle();
        if (l2) throw new Error('klippkort: ' + l2.message);
        // Ett tillägg för övertid (Fas 20.1) bär också en egen charge.
        const { data: tillagg, error: l3 } = pass || kort ? { data: null, error: null } : await db.from('pass_tillagg')
          .select('id, stripe_avgift_ore').eq('stripe_charge_id', chargeId).maybeSingle();
        if (l3) throw new Error('pass_tillagg: ' + l3.message);
        const rad = pass ?? kort ?? tillagg;
        if (!rad) return await klar('charge utan pass');
        if (rad.stripe_avgift_ore !== null && rad.stripe_avgift_ore !== undefined) {
          return await klar('avgiften fanns redan');
        }

        if (bt.avgiftOre === null && arStripeId(bt.id, 'txn')) {
          bt = balans(await v1('GET', `/v1/balance_transactions/${bt.id}`));
        }
        const { error: avgfel } = await db.from(pass ? 'bookings' : kort ? 'klippkort' : 'pass_tillagg').update({
          stripe_balanstransaktion_id: bt.id,
          stripe_avgift_ore: bt.avgiftOre,
          stripe_netto_ore: bt.nettoOre,
        }).eq('id', rad.id).is('stripe_avgift_ore', null);
        if (avgfel) throw new Error('avgiften: ' + avgfel.message);
        return await klar(bt.avgiftOre === null ? 'balanstransaktion utan avgift' : `avgift ${bt.avgiftOre} öre`);
      }

      // ---------- betalningen gick inte igenom ----------
      case 'payment_intent.payment_failed': {
        const tillaggId = String((obj.metadata as Record<string, string> | undefined)?.tillagg_booking_id ?? '');
        /* Varje skrivning läser sitt fel och kastar det (2026-09-29), som
           betalningen ovan. Förut kvitterades händelsen även när
           skrivningen föll, och Stripe försökte aldrig igen. */
        if (tillaggId) {
          const { error } = await db.from('pass_tillagg').update({ status: 'misslyckad' })
            .eq('booking_id', tillaggId).eq('status', 'vantar');
          if (error) throw new Error('pass_tillagg: ' + error.message);
          return await klar('tillägg misslyckat');
        }
        const kkId = String((obj.metadata as Record<string, string> | undefined)?.klippkort_id ?? '');
        if (kkId) {
          const { error } = await db.from('klippkort').update({ status: 'misslyckad' })
            .eq('id', kkId).eq('status', 'vantar');
          if (error) throw new Error('klippkort: ' + error.message);
          return await klar('klippkort misslyckat');
        }
        const passId = String((obj.metadata as Record<string, string> | undefined)?.booking_id ?? '');
        if (!passId) return await klar('utan pass-id');
        // Tillbaka till "misslyckad", inte till "ingen": familjen ska
        // kunna försöka igen, och adminvyn ska kunna se att det hände.
        const { error } = await db.from('bookings').update({ betalning_status: 'misslyckad' })
          .eq('id', passId).eq('betalning_status', 'vantar');
        if (error) throw new Error('bookings: ' + error.message);
        return await klar('misslyckad');
      }

      // ---------- återbetalning ----------
      case 'charge.refunded': {
        const aterbetalt = Number(obj.amount_refunded ?? 0);
        const totalt = Number(obj.amount ?? 0);
        const lage = aterbetalningsLage(aterbetalt, totalt);

        /* EN TVIST ÄGER LÄGET (2026-09-29). Beloppet skrivs alltid, men en
           rad som står i tvist behåller 'tvist': förut skrev en sen
           charge.refunded 'betald' över den, och ett bestritt pass såg ut
           som ett vanligt betalt. När tvisten stängs räknas läget om ur
           utfallet, i grenen för tvisterna nedan.

           Varje skrivning läser sitt fel och kastar det. Förut kvitterades
           händelsen även när skrivningen föll, och återbetalningen syntes
           aldrig i raden. */
        const aterbetala = async (
          tabell: 'bookings' | 'klippkort' | 'pass_tillagg',
          kolumn: 'id' | 'stripe_charge_id',
          varde: string,
          lageKolumn: 'betalning_status' | 'status',
          nytt: string,
        ): Promise<number> => {
          const { data: vanliga, error: fel1 } = await db.from(tabell)
            .update({ aterbetald_ore: aterbetalt, [lageKolumn]: nytt })
            .eq(kolumn, varde).neq(lageKolumn, 'tvist').select('id');
          if (fel1) throw new Error(tabell + ': ' + fel1.message);
          const { data: itvist, error: fel2 } = await db.from(tabell)
            .update({ aterbetald_ore: aterbetalt })
            .eq(kolumn, varde).eq(lageKolumn, 'tvist').select('id');
          if (fel2) throw new Error(tabell + ': ' + fel2.message);
          return (vanliga?.length ?? 0) + (itvist?.length ?? 0);
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
          await aterbetala('bookings', 'stripe_charge_id', chargeId, 'betalning_status', lage);
          /* Ett klippkort (Fas 16.1) STÄNGS av varje återbetalning, också
             en delvis. Villkoren har tre skäl att betala tillbaka ett
             köp: ångerrätten, att familjen slutar, och en timme som gick
             förlorad när kortet löpte ut för att vi avbokat för sent. I
             alla tre är kortet slut. En delåterbetalning som lämnade det
             öppet hade låtit familjen fortsätta dra timmar som redan gått
             tillbaka. */
          if (await aterbetala('klippkort', 'stripe_charge_id', chargeId, 'status', 'aterbetald')) {
            return await klar(`klippkort återbetalt ${aterbetalt} öre, stängt`);
          }
          // Ett tillägg (Fas 20.1) har sin egen charge, och sin egen rad.
          if (await aterbetala('pass_tillagg', 'stripe_charge_id', chargeId, 'status', lage)) {
            return await klar(`tillägg återbetalt ${aterbetalt} öre`);
          }
          return await klar(`återbetalt ${aterbetalt} öre`);
        }
        const passId = String((obj.metadata as Record<string, string> | undefined)?.booking_id ?? '');
        if (!passId) return await klar('återbetalning utan charge-id och utan pass-id');
        await aterbetala('bookings', 'id', passId, 'betalning_status', lage);
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

        // Läsfel kastas, av samma skäl som i charge.updated.
        const { data: passen, error: l1 } = await db.from('bookings')
          .select('id, betalning_status').eq('stripe_charge_id', chargeId).limit(1);
        if (l1) throw new Error('bookings: ' + l1.message);
        const pass = passen?.[0] ?? null;
        // Ett köpt klippkort kan också bestridas (Fas 16.1).
        const { data: kort, error: l2 } = pass ? { data: null, error: null } : await db.from('klippkort')
          .select('id, status').eq('stripe_charge_id', chargeId).maybeSingle();
        if (l2) throw new Error('klippkort: ' + l2.message);
        // Ett tillägg för övertid (Fas 20.1) kan också bestridas.
        const { data: tillagg, error: l3 } = pass || kort ? { data: null, error: null } : await db.from('pass_tillagg')
          .select('id, booking_id, status').eq('stripe_charge_id', chargeId).maybeSingle();
        if (l3) throw new Error('pass_tillagg: ' + l3.message);

        const { data: forut, error: l4 } = await db.from('stripe_tvister')
          .select('stangd, lage').eq('id', tvistId).maybeSingle();
        if (l4) throw new Error('stripe_tvister: ' + l4.message);
        if (forut?.stangd && !stangs) {
          return await klar(`tvist ${tvistId}: sen händelse efter stängning, ignorerad`);
        }

        const evidens = obj.evidence_details as Record<string, unknown> | undefined;
        const { error: tvfel } = await db.from('stripe_tvister').upsert({
          id: tvistId,
          booking_id: pass?.id ?? tillagg?.booking_id ?? null,
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
          const { error } = await db.from('bookings')
            .update({ betalning_status: betallageEfterTvist(tvistUtfall(lage)) })
            .eq('id', pass.id);
          if (error) throw new Error('bookings: ' + error.message);
        }
        /* Ett klippkort i tvist går inte att dra timmar från
           (klippkort_dra kräver 'betald'): pengarna kan vara på väg
           tillbaka. Vinner vi öppnas det igen; förlorar vi står det kvar
           som tvist, som passen. */
        if (tillagg && (tillagg.status === 'betald' || tillagg.status === 'tvist')) {
          const { error } = await db.from('pass_tillagg')
            .update({ status: betallageEfterTvist(tvistUtfall(lage)) })
            .eq('id', tillagg.id);
          if (error) throw new Error('pass_tillagg: ' + error.message);
        }
        if (kort && (kort.status === 'betald' || kort.status === 'tvist')) {
          const { error } = await db.from('klippkort')
            .update({ status: betallageEfterTvist(tvistUtfall(lage)) })
            .eq('id', kort.id);
          if (error) throw new Error('klippkort: ' + error.message);
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
            p_kopplad_tabell: pass || tillagg ? 'bookings' : kort ? 'klippkort' : null,
            p_kopplad_id: pass?.id ?? tillagg?.booking_id ?? kort?.id ?? null,
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
         de dyka upp ändå är det ett tecken på att någon slått på
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
