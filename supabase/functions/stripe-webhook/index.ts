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
//    dragna och passet stod som misslyckat. Kortet vinner: pengarna är
//    dragna. (Läget 'faktura' stod här från Fas 14.6 tills fakturan
//    togs bort 2026-10-21.)
//
// 7. SKARP ELLER TEST (Fas 14.7). Händelsens livemode sparas på
//    händelsen och på passet, så att en testbetalning aldrig ser ut
//    som en intäkt i ett underlag till bokföringen.
//
// 8. SYSKONTILLÄGGET (syskontillagg_som_skuld, 2026-10-21). En session
//    med tillagg_forsok i metadata betalar familjens upplupna tillägg:
//    ensam (Betala tillägg nu) eller som egen rad i ett köp av timmar.
//    Databasen skriver liggaren, betalningens rader och posterna i en
//    transaktion; en session som går ut eller avbryts släpper posterna.
//    Endpointen behöver checkout.session.expired för det; utan händelsen
//    släpper jobbet tillagg-forsok dem efter 35 minuter.
//
// 9. BETALA ALLA (flera_pass_och_aterbetalningar, 2026-10-27). En session
//    med pass_kassa i metadata betalar flera pass. Databasen skriver
//    liggaren, varje pass med sin del och en rad per pass i en transaktion
//    (passkassa_betald); passen pekar på kassan, för PaymentIntent och
//    charge är unika per pass. Avgiften delas på passen, en återbetalning
//    skrivs per rad och en tvist på liggaren och passen. Varje
//    återbetalning den ser skrivs också ner (aterbetalning_logga), var den
//    än gjordes.
//
//
// verify_jwt = false. Anroparen är Stripe, inte en inloggad
// användare. Skyddet är signaturen, och raden står i config.toml i
// samma ändring som funktionen — se filhuvudet där för vad som annars
// händer vid nästa deploy.
// ============================================================

import { stamAvKopet } from '../_delad/aterbetalning.ts';
import { serviceklient } from '../_delad/auth.ts';
import { json } from '../_delad/http.ts';
import {
  aterbetalningsLage, arStripeId, balans, betallageEfterTvist, StripeError, tidFranUnix,
  tvistOrsakText, tvistUnderlag, tvistUtfall, tvistVantarPaOss, v1,
} from '../_delad/stripe.ts';
import { type Handelselager, markeraKlar, taEmotLeverans } from '../_delad/webhooken.ts';
import { kortetsDelar, reservationensPass, reserveradTill, slappetsLage } from '../_delad/kortreservation.ts';
import { type Aterbetalning, forsokUrMetadata, hanteraTillagg, type TillaggDb } from '../_delad/tillagg.ts';
import { arFleraPass, type Betalningsrad, kassaUrMetadata, raderUrStripe } from '../_delad/passkassa.ts';

type Handelse = {
  id?: string;
  type?: string;
  livemode?: boolean;
  data?: { object?: Record<string, unknown> };
};

// Lägen där passet ännu inte är betalt med kort. Se punkt 6 i
// filhuvudet. 'betald' är inte med: en andra leverans av samma
// betalning ska träffa noll rader.
const TAR_EMOT_BETALNING = ['ingen', 'vantar', 'misslyckad'];

/* Minuterna betalningen avsåg (Fas 20.1), ur metadata vi själva skrev
   (stripe-checkout, och stripe-reservation sedan 2026-10-13). Saknas de,
   eller ser de fel ut, skrivs inget: passunderlag räknar då med det
   bokade, som förut. */
function minuterUr(metadata: unknown): number | null {
  const t = (metadata as Record<string, string> | undefined)?.minuter;
  return /^\d{2,3}$/.test(String(t ?? '')) && Number(t) >= 15 && Number(t) <= 240 ? Number(t) : null;
}

Deno.serve(async (req) => {
  // Ingen CORS och ingen OPTIONS: ingen webbläsare ska nå hit.
  if (req.method !== 'POST') return json({ error: 'Bara POST.' }, 405, {});

  const raKropp = await req.text();
  const db = serviceklient();

  /* Signaturen och taket mot dubbletter (_delad/webhooken.ts, provade i
     webhooken_test.ts). Hemligheten ligger i miljön här, inte i en
     tabell: den ÄGS av Stripe och byts i Stripes dashboard, och en
     tabellrad hade bara blivit en andra plats där samma sträng kan bli
     inaktuell. */
  const lager: Handelselager = {
    spara: (rad) => db.from('stripe_handelser').insert(rad),
    hanterad: (hid) => db.from('stripe_handelser').select('hanterad_at').eq('id', hid).maybeSingle(),
    markera: (hid, resultat) => db.from('stripe_handelser')
      .update({ hanterad_at: new Date().toISOString(), resultat }).eq('id', hid),
  };
  const leverans = await taEmotLeverans(
    raKropp,
    req.headers.get('stripe-signature'),
    Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '',
    lager,
  );
  // 400, inte 401: Stripe ska inte försöka igen med en leverans som aldrig kommer att gå igenom.
  if (leverans.gora === 'neka') return json({ error: leverans.fel }, 400, {});
  if (leverans.gora === 'fel') return json({ error: 'Kunde inte ta emot händelsen.' }, 500, {});
  if (leverans.gora === 'kvittera') return json({ ok: true, not: 'redan hanterad' }, 200, {});

  const { id, typ, skarp } = leverans;
  const h = leverans.handelse as Handelse;
  const obj = (h.data?.object ?? {}) as Record<string, unknown>;

  const klar = async (resultat: string) => {
    await markeraKlar(lager, id, resultat);
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
    kopplad: { tabell: 'bookings'; id: string } | null,
    galler: { booking?: string; klippkort?: string; tillagg?: boolean } = {}) => {
    const kr = typeof belopp === 'number' ? `${Math.round(belopp / 100)} kr` : 'okänt belopp';
    /* Pengarna står i liggaren ändå (betalningsliggaren, 2026-10-21): det är
       riktiga pengar in, och de ska tillbaka. Familjen läses ur raden de
       gällde. Utan funktionen (före migrationen) bara uppgiften, som förut. */
    if (pi && typeof belopp === 'number' && belopp > 0 && (galler.booking || galler.klippkort)) {
      const { error: lfel } = await db.rpc('betalning_utan_rad', {
        p_pi: pi, p_belopp: belopp, p_charge: null, p_skarp: skarp,
        p_booking: galler.booking ?? null, p_klippkort: galler.klippkort ?? null, p_tillagg: !!galler.tillagg,
      });
      if (lfel && lfel.code !== 'PGRST202') throw new Error('betalning_utan_rad: ' + lfel.message);
    }
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

  /* EN SÄKERT HÄMTAD CHARGE (Fas 12.2, en hjälpare sedan 2026-10-13).
     Charge-id:t är det enda som gör en senare charge.refunded-händelse
     spårbar till rätt pass utan att lita på metadata vi inte skriver
     själva.

     BALANSTRANSAKTIONEN ÄR DEN ANDRA HALVAN. Stripe betalar ut i KLUMPAR,
     netto efter avgift, med fördröjning: ingen rad på bankkontot
     motsvarar ett enskilt pass. txn_-id:t är enda vägen från passet till
     den bankraden, och avgiften finns ingen annanstans alls: den syns
     varken i vad familjen betalade eller i vad vi begärde. Ofta finns den
     inte än (punkt 5 i filhuvudet), och då kommer den med charge.updated. */
  const chargeOchBalans = async (piId: string): Promise<{ chargeId: string | null; b: ReturnType<typeof balans> }> => {
    const pi = await v1('GET', `/v1/payment_intents/${piId}?expand[]=latest_charge.balance_transaction`);
    const charge = (pi as { latest_charge?: Record<string, unknown> }).latest_charge;
    if (charge && typeof charge === 'object') {
      return {
        chargeId: String(charge.id ?? '') || null,
        b: balans((charge as { balance_transaction?: unknown }).balance_transaction),
      };
    }
    return { chargeId: null, b: balans(null) };
  };

  /* SYSKONTILLÄGGET (syskontillagg_som_skuld, 2026-10-21). Databasens
     funktioner gör varje steg i en transaktion: liggaren, raderna, posterna
     och försöket. Här är bara anropen, och varje fel kastas, så att raden i
     stripe_handelser står kvar ohanterad och Stripe försöker igen. Logiken
     står i _delad/tillagg.ts, och tillagg_test.ts prövar den. */
  const rpcText = async (namn: string, args: Record<string, unknown>): Promise<string> => {
    const { data, error } = await db.rpc(namn, args);
    if (error) throw new Error(namn + ': ' + error.message);
    return String(data);
  };
  const tillaggDb: TillaggDb = {
    betald: (a) => rpcText('tillagg_forsok_betald', {
      p_forsok: a.forsok, p_pi: a.pi, p_charge: a.charge, p_belopp: a.belopp, p_skarp: a.skarp,
      p_avgift: a.avgift, p_netto: a.netto,
    }),
    vantar: async (a) => (await rpcText('tillagg_forsok_vantar', { p_forsok: a.forsok, p_session: a.session })) === 'true',
    slapp: async (a) => (await rpcText('tillagg_forsok_slapp', { p_forsok: a.forsok, p_orsak: a.orsak })) === 'true',
    tvist: async (a) => (await rpcText('betalning_tvist', { p_charge: a.charge, p_utfall: tvistUtfall(a.lage) })) === 'true',
  };
  const chargeUppslag = async (pi: string) => {
    const { chargeId, b } = await chargeOchBalans(pi);
    return { chargeId, avgiftOre: b.avgiftOre, nettoOre: b.nettoOre };
  };

  /* AVGIFTEN FÖR EN BETALNING SOM BARA ÄR TILLÄGG (Betala tillägg nu,
     granskningen 2026-10-21) ELLER FLERA PASS (Betala alla, 2026-10-27).
     Ingen pass-, köp- eller övertidsrad bär chargen, så avgiften skrivs på
     liggarens rad när den kommer med charge.updated, och för flera pass
     delas den på passen i samma transaktion (betalning_avgift). En avgift
     som redan står skrivs aldrig över. */
  const avgiftenPaLiggaren = async (chargeId: string, forsta: ReturnType<typeof balans>) => {
    const { data: ligg, error } = await db.from('betalningar')
      .select('id, typ, booking_id, avgift_ore').eq('stripe_charge', chargeId);
    if (error) throw new Error('betalningar: ' + error.message);
    const lig = (ligg ?? []).find((r) => r.typ === 'syskon' || (r.typ === 'pass' && !r.booking_id));
    if (!lig) return await klar('charge utan pass');
    if (lig.avgift_ore !== null && lig.avgift_ore !== undefined) return await klar('avgiften fanns redan');
    let bt = forsta;
    if (bt.avgiftOre === null && arStripeId(bt.id, 'txn')) {
      bt = balans(await v1('GET', `/v1/balance_transactions/${bt.id}`));
    }
    if (lig.typ === 'pass') {
      await rpcText('betalning_avgift', { p_charge: chargeId, p_bt: bt.id, p_avgift: bt.avgiftOre, p_netto: bt.nettoOre });
      return await klar(bt.avgiftOre === null ? 'balanstransaktion utan avgift'
        : `avgift ${bt.avgiftOre} öre på liggaren, delad på passen`);
    }
    const { error: avgfel } = await db.from('betalningar')
      .update({ avgift_ore: bt.avgiftOre, netto_ore: bt.nettoOre })
      .eq('id', lig.id).is('avgift_ore', null);
    if (avgfel) throw new Error('liggarens avgift: ' + avgfel.message);
    return await klar(bt.avgiftOre === null ? 'balanstransaktion utan avgift' : `avgift ${bt.avgiftOre} öre på liggaren`);
  };

  /* EN BETALNING MED TILLÄGG ÅTERBETALAS PER RAD (syskontillagg_som_skuld).
     Liggaren har en rad per PaymentIntent, och betalningsrader en per del:
     köpet och varje tillägg. Stripes lista över återbetalningarna fördelas
     på raderna ur metadata (fordelaAterbetalningar): tilläggets rad bär
     betalningsrad, köpets bär klippkort_id. Databasen skriver summorna, så
     samma händelse två gånger ändrar ingenting, och ingen rad får mer än
     den betalade. Köpets del skrivs på köpet som förut, men bara köpets
     del. En återbetalning utan rad (Stripes panel) fördelas inte av en
     maskin: köpet stängs som förut, och en människa får en uppgift.

     FLERA PASS (Betala alla, 2026-10-27) återbetalas också per rad: en rad
     per pass, och databasen skriver passets återbetalda belopp och läge ur
     raden. Är hela betalningen tillbaka är varje rad det, med eller utan
     metadata; annars avgör en människa en återbetalning utan rad.

     Svarar null när betalningen varken har en tilläggsrad eller är en
     betalning för flera pass: då gör grenen nedan som förut. */
  const aterbetalaRader = async (
    chargeId: string, pi: string, aterbetalt: number, totalt: number, aterbet: Aterbetalning[],
  ): Promise<string | null> => {
    const fraga = db.from('betalningar').select('id, stripe_payment_intent, typ, booking_id, utan_rad, familj');
    const { data: bet, error: bfel } = await (arStripeId(pi, 'pi')
      ? fraga.eq('stripe_payment_intent', pi) : fraga.eq('stripe_charge', chargeId)).maybeSingle();
    if (bfel) {
      if (bfel.code === '42P01' || bfel.code === 'PGRST205') return null;
      throw new Error('betalningar: ' + bfel.message);
    }
    if (!bet) return null;
    const { data: rader, error: rfel } = await db.from('betalningsrader')
      .select('id, typ, belopp_ore, klippkort_id, booking_id').eq('betalning_id', bet.id);
    if (rfel) {
      if (rfel.code === '42P01' || rfel.code === 'PGRST205') return null;
      throw new Error('betalningsrader: ' + rfel.message);
    }
    const fleraPass = arFleraPass(bet);
    if (!fleraPass && !(rader ?? []).some((r) => r.typ === 'syskon')) return null;

    // Samma fördelning som stripe-aterbetalning och stripe-reservation gör (raderUrStripe).
    const f = raderUrStripe(bet, (rader ?? []) as Betalningsrad[], aterbet, aterbetalt, totalt);

    if (fleraPass) {
      await rpcText('betalningsrader_aterbetalda', {
        p_pi: bet.stripe_payment_intent, p_per_rad: f.perRad, p_totalt: aterbetalt,
      });
      if (f.ofordelat > 0 || f.overskott > 0) {
        const { error: ufel } = await db.rpc('skapa_uppgift', {
          p_titel: 'En återbetalning på en betalning för flera pass saknar pass',
          p_nyckel: `aterbetalning-utan-rad:${chargeId}:${aterbetalt}`,
          p_typ: 'kontroll',
          p_beskrivning: `${Math.round((f.ofordelat + f.overskott) / 100)} kr betalades tillbaka utan att det står `
            + 'vilket pass det gällde (troligen i Stripes dashboard). Betalningen gällde flera pass, och inget av '
            + 'dem är ändrat för den. Avgör vilket pass som betalades tillbaka; betala hellre tillbaka ett pass från '
            + 'Liggaren i adminvyn nästa gång.',
          p_kopplad_tabell: 'profiles',
          p_kopplad_id: String(bet.familj),
          p_skapad_av_typ: 'system',
        });
        if (ufel) throw new Error('skapa_uppgift: ' + ufel.message);
      }
      return `återbetalt per pass ${aterbetalt} öre${f.hela ? ', hela betalningen' : ''}`;
    }

    await rpcText('betalningsrader_aterbetalda', {
      p_pi: bet.stripe_payment_intent, p_per_rad: f.perRad, p_totalt: aterbetalt,
    });

    let kopText = '';
    const plan = (rader ?? []).find((r) => r.klippkort_id);
    if (plan) {
      const kopet = String(plan.klippkort_id);
      const { framande_ore } = await stamAvKopet(v1, (namn, args) => db.rpc(namn, args),
        { kort: kopet, charge: chargeId, utom: (md) => !!md.betalningsrad });
      const kopets = f.perRad[String(plan.id)] ?? 0;
      const stang = framande_ore > 0 || kopets >= Number(plan.belopp_ore);
      const { error: k1 } = await db.from('klippkort')
        .update(stang ? { aterbetald_ore: kopets, status: 'aterbetald' } : { aterbetald_ore: kopets })
        .eq('id', kopet).neq('status', 'tvist');
      if (k1) throw new Error('klippkort: ' + k1.message);
      const { error: k2 } = await db.from('klippkort').update({ aterbetald_ore: kopets })
        .eq('id', kopet).eq('status', 'tvist');
      if (k2) throw new Error('klippkort: ' + k2.message);
      kopText = `, köpet ${kopets} öre${stang ? ', stängt' : ''}`;
    }
    if (f.ofordelat > 0 || f.overskott > 0) {
      const { error: ufel } = await db.rpc('skapa_uppgift', {
        p_titel: 'En återbetalning på en betalning med tillägg saknar rad',
        p_nyckel: `aterbetalning-utan-rad:${chargeId}:${aterbetalt}`,
        p_typ: 'kontroll',
        p_beskrivning: `${Math.round((f.ofordelat + f.overskott) / 100)} kr betalades tillbaka utan att det står `
          + 'vilken rad det gällde (troligen i Stripes dashboard). Betalningen bär både ett köp och syskontillägg. '
          + 'Avgör vilken rad som betalades tillbaka; köpet är stängt för säkerhets skull.',
        p_kopplad_tabell: plan ? 'klippkort' : null,
        p_kopplad_id: plan ? String(plan.klippkort_id) : null,
        p_skapad_av_typ: 'system',
      });
      if (ufel) throw new Error('skapa_uppgift: ' + ufel.message);
    }
    return `återbetalt per rad ${aterbetalt} öre${kopText}`;
  };

  /* VARJE ÅTERBETALNING SKRIVS NER (flera_pass_och_aterbetalningar,
     2026-10-27), var den än gjordes: i adminvyn (vem och varför står i
     Stripes metadata, som stripe-aterbetalning skrev dem), av sig själv
     (ett kortare pass, av 'system') eller i Stripes dashboard (ingen
     metadata). Samma återbetalning två gånger blir en rad, och
     stripe-aterbetalning skriver samma sak ur samma metadata, så det spelar
     ingen roll vem som hinner först. Databasen läser betalningen, familjen
     och vad det var ur liggaren; anropet säger bara raden, passet eller
     köpet ur metadata. Före migrationen finns funktionen inte, och då
     skrivs inget. */
  const loggaAterbetalningar = async (pi: string, lista: Aterbetalning[]) => {
    if (!arStripeId(pi, 'pi')) return;
    const id = (v: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v ?? ''))
      ? String(v).toLowerCase() : null;
    for (const a of lista) {
      if (!a || (a.status !== undefined && a.status !== 'succeeded' && a.status !== 'pending')) continue;
      const md = (a.metadata ?? {}) as Record<string, unknown>;
      const av = id(md.av);
      const { error } = await db.rpc('aterbetalning_logga', {
        p_refund: String(a.id ?? ''), p_pi: pi, p_belopp: Math.trunc(Number(a.amount) || 0),
        p_rad: id(md.betalningsrad), p_booking: id(md.booking_id) ?? id(md.tillagg_booking_id),
        p_klippkort: id(md.klippkort_id), p_tillagg: !!id(md.tillagg_booking_id),
        p_anledning: String(md.anledning ?? '').slice(0, 300) || null,
        p_av: av, p_satt: av ? 'adminvyn' : md.av === 'system' ? 'automatiskt' : 'stripe',
      });
      if (error) {
        if (error.code === 'PGRST202') return;
        throw new Error('aterbetalning_logga: ' + error.message);
      }
    }
  };

  /* BETALA ALLA (flera_pass_och_aterbetalningar, 2026-10-27). Pengarna för
     en kassa med flera pass: databasen skriver liggaren, varje pass med sin
     del på samma tre vägar som betalaPasset nedan (obetalt, timmarna eller
     timbanken: kortet vinner) och en rad per pass, i en transaktion, och
     prövar själv vad som redan är betalt. Ett pass som hann betalas på
     annat sätt får sin rad med en uppgift om att betala tillbaka den. Ett
     fel kastas, så att Stripe försöker igen. */
  const betalaKassan = async (kassa: string, piId: string, draget: number | null): Promise<Response> => {
    if (!arStripeId(piId, 'pi')) return await klar('kassa för flera pass utan payment intent');
    const { chargeId, b } = await chargeOchBalans(piId);
    const svar = await rpcText('passkassa_betald', {
      p_kassa: kassa, p_pi: piId, p_charge: chargeId, p_belopp: draget, p_bt: b.id,
      p_avgift: b.avgiftOre, p_netto: b.nettoOre, p_skarp: skarp,
    });
    if (svar === 'betald') return await klar('kassa för flera pass betald');
    if (svar === 'delvis') return await klar('kassa för flera pass betald, ett pass var redan betalt: uppgift skapad');
    if (svar === 'redan') return await klar('kassan för flera pass var redan betald');
    if (svar === 'dubbel') return await klar('kassa för flera pass betald två gånger: i liggaren, uppgift skapad');
    if (svar === 'fel_belopp') return await klar('kassa för flera pass med fel belopp: i liggaren, uppgift skapad');
    // Kassan finns inte (familjen är borta med den): pengarna kom ändå, och en människa betalar tillbaka dem.
    return await ejNedskriven(`kassan för flera pass ${kassa}`, piId, draget, null);
  };

  /* PASSETS BETALNING SKRIVS (Fas 14.1; en egen funktion sedan 2026-10-13).
     Kassans betalning och en dragning med det sparade kortet
     (kortet_reserveras) är samma sak för passet: pengarna är dragna med
     kort, och samma regler gäller, också när timmarna eller timbanken
     hann före. Bara den här funktionen skriver betald och betalt_ore. */
  const betalaPasset = async (
    passId: string, piId: string, chargeId: string | null, b: ReturnType<typeof balans>,
    draget: number | null, minuter: number | null,
  ): Promise<Response> => {
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
        return await ejNedskriven('passet', piId, draget, nu ? { tabell: 'bookings', id: passId } : null,
          nu ? { booking: passId } : {});
      }
    }

    return await klar('betald');
  };

  try {
    switch (typ) {
      // ---------- betalningen gick igenom ----------
      /* KLARNA (2026-10-21, Leo: "betala direkt med kort eller betala med
         klarna"). Klarna i kassan blir i regel klar direkt, och då kommer
         betalningen som en vanlig checkout.session.completed med
         payment_status 'paid'. Skulle Stripe ändå fullborda sessionen som
         obetald och låta pengarna komma efteråt kommer de med
         async_payment_succeeded, med samma session och payment_status
         'paid': samma gren skriver dem. Utan den raden hade familjen betalat
         och passet stått som obetalt för alltid. */
      case 'checkout.session.async_payment_succeeded':
      case 'checkout.session.completed': {
        /* KORTET SPARAS (kortet_reserveras, 2026-10-13). En kassa i läget
           setup tar ingen betalning: den sparar familjens kort hos Stripe,
           på familjens kund. Den prövas före betalningen nedan, som annars
           hade kvitterat den som en session utan betalning. KUNDEN avgör
           familjen, inte metadata: kunden skapade stripe-checkout själv,
           en per familj (stripe_kunder). */
        if (obj.mode === 'setup') {
          const kund = String(obj.customer ?? '');
          const seti = String(obj.setup_intent ?? '');
          if (!arStripeId(kund, 'cus') || !arStripeId(seti, 'seti')) {
            return await klar('kortkassa utan kund eller setup_intent');
          }
          const { data: k, error: kfel } = await db.from('stripe_kunder')
            .select('parent_id').eq('stripe_kund', kund).maybeSingle();
          if (kfel) throw new Error('stripe_kunder: ' + kfel.message);
          if (!k) return await klar('kortkassa för en kund vi inte känner');
          const si = await v1('GET', `/v1/setup_intents/${seti}?expand[]=payment_method`);
          if (si.status !== 'succeeded') return await klar(`kortkassa: setup_intent står som ${String(si.status)}`);
          const kort = kortetsDelar(si.payment_method);
          if (!kort) return await klar('kortkassa utan kort');
          const { data: forra, error: sparfel } = await db.rpc('kort_sparat', {
            p_parent: k.parent_id, p_metod: kort.metod, p_marke: kort.marke, p_sista4: kort.sista4,
            p_manad: kort.manad, p_ar: kort.ar,
          });
          if (sparfel) throw new Error('kort_sparat: ' + sparfel.message);
          /* Ett kort per familj: det förra kopplas bort hos Stripe. En
             reservation som redan står på det dras ändå, för den hålls på
             sitt PaymentIntent. Städning: ett fel här kastas inte. */
          if (arStripeId(forra, 'pm') && forra !== kort.metod) {
            try {
              await v1('POST', `/v1/payment_methods/${forra}/detach`, {}, `nextrum-koppla-bort-${forra}`);
            } catch (e) {
              if (!(e instanceof StripeError)) throw e;
              console.error('stripe-webhook: det förra kortet kopplades inte bort', JSON.stringify(e.fel));
            }
          }
          return await klar(arStripeId(forra, 'pm') ? 'kortet bytt' : 'kortet sparat');
        }

        /* BETALA TILLÄGG NU (syskontillagg_som_skuld, 2026-10-21): en session
           som bara är tillägg. En session som väntar på pengarna (Klarna)
           märks, så att jobbet inte släpper posterna. */
        const tSvar = await hanteraTillagg(typ, obj, skarp, tillaggDb, chargeUppslag);
        if (tSvar !== null) return await klar(tSvar);

        /* BETALA ALLA (2026-10-27): kassans id i metadata, och inget pass.
           Pengar som kommer senare (Klarna) märker kassan, så att passen
           inte betalas en gång till medan de är på väg. */
        const passkassa = kassaUrMetadata(obj.metadata);
        if (passkassa) {
          if (obj.payment_status !== 'paid') {
            await rpcText('passkassa_vantar', { p_kassa: passkassa, p_session: String(obj.id ?? '') });
            return await klar('kassa för flera pass: väntar på betalningen');
          }
          return await betalaKassan(passkassa, String(obj.payment_intent ?? ''),
            typeof obj.amount_total === 'number' ? obj.amount_total : null);
        }

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
        const { chargeId, b } = piId ? await chargeOchBalans(piId) : { chargeId: null, b: balans(null) };

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
          /* MED TILLÄGGET SOM EGEN RAD (syskontillagg_som_skuld, 2026-10-21):
             köpet, liggaren, raderna och posterna skrivs i en transaktion.
             Köpet får bara sin del av beloppet; tillägget är posternas. */
          const forsok = forsokUrMetadata(obj.metadata);
          if (forsok) {
            const svar = await rpcText('klippkort_betald_med_tillagg', {
              p_id: kkId, p_betalt: draget, p_pi: piId || null, p_charge: chargeId, p_bt: b.id,
              p_avgift: b.avgiftOre, p_netto: b.nettoOre, p_skarp: skarp, p_forsok: forsok,
            });
            if (svar === 'betald') return await klar('klippkort och tillägg betalda');
            if (svar === 'redan') return await klar('klippkortet och tillägget var redan betalda');
            if (svar === 'dubbel') return await klar('klippkort betalt, tillägget betalt två gånger: uppgift skapad');
            if (svar !== 'kop_redan') {
              // Försöket hörde inte till köpet, eller beloppet gick inte ihop: pengarna bokförs och en människa avgör.
              return await ejNedskriven(`klippkortet ${kkId} med tillägg (${svar})`, piId, draget, null, { klippkort: kkId });
            }
            // Köpet väntade inte: samma prövning som utan tillägg, nedan.
          }
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
            return await ejNedskriven(`klippkortet ${kkId}`, piId, draget, null, { klippkort: kkId });
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
            return await ejNedskriven('tillägget till passet', piId, draget, { tabell: 'bookings', id: tillaggId },
              { booking: tillaggId, tillagg: true });
          }
          return await klar('tillägget var redan betalt');
        }

        return await betalaPasset(passId, piId, chargeId, b, draget, minuterUr(obj.metadata));
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
        if (!rad) return await avgiftenPaLiggaren(chargeId, bt);
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
      /* Klarna sa nej efter att sessionen fullbordats: PaymentIntent får
         sitt eget payment_intent.payment_failed, som skriver läget nedan.
         Här finns inget mer att göra. */
      case 'checkout.session.async_payment_failed': {
        /* En kassa för flera pass släpps (2026-10-27): sessionen är klar och
           kan inte betalas igen, och passen ska gå att betala på nytt. */
        const kassaNej = kassaUrMetadata(obj.metadata);
        if (kassaNej) {
          await rpcText('passkassa_slapp', { p_kassa: kassaNej, p_orsak: 'avbruten' });
          return await klar('klarna sa nej, kassan för flera pass släppt; payment_intent.payment_failed skriver passen');
        }
        // Ett försök för tillägget släpps: posterna blir upplupna igen (syskontillagg_som_skuld).
        const tSvar = await hanteraTillagg(typ, obj, skarp, tillaggDb);
        return await klar(tSvar ? `${tSvar}; klarna sa nej, payment_intent.payment_failed skriver resten`
          : 'klarna sa nej, payment_intent.payment_failed skriver det');
      }

      /* EN SESSION SOM GÅR UT (syskontillagg_som_skuld, 2026-10-21). Bara ett
         försök för tillägget skrivs: posterna blir upplupna igen, så att
         familjen kan betala dem en annan gång. Jobbet tillagg-forsok gör
         samma sak efter 35 minuter om händelsen aldrig kommer. Ett köp eller
         ett pass står kvar som förut. */
      case 'checkout.session.expired': {
        // En kassa för flera pass släpps (2026-10-27); passen står kvar som obetalda.
        const kassaUte = kassaUrMetadata(obj.metadata);
        if (kassaUte) {
          const slappt = await rpcText('passkassa_slapp', { p_kassa: kassaUte, p_orsak: 'utgangen' });
          return await klar(slappt === 'true' ? 'kassan för flera pass gick ut' : 'kassan för flera pass var redan stängd');
        }
        const tSvar = await hanteraTillagg(typ, obj, skarp, tillaggDb);
        return await klar(tSvar ?? 'sessionen gick ut');
      }

      case 'payment_intent.payment_failed': {
        /* En reservation eller en dragning med det sparade kortet
           (kortet_reserveras, 2026-10-13): stripe-reservation skriver nejet
           i samma stund som Stripe svarar, och familjen får notisen. Här
           skrivs inget. Passet står inte i 'vantar', och en andra skrivning
           hade räknat försöken dubbelt. */
        if (reservationensPass(obj.metadata)) return await klar('kortet nekades, stripe-reservation skriver det');
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
        // Passen i en kassa för flera pass (2026-10-27): de som väntar blir misslyckade.
        const kassaMiss = kassaUrMetadata(obj.metadata);
        if (kassaMiss) {
          const n = await rpcText('passkassa_misslyckad', { p_kassa: kassaMiss });
          return await klar(`kassa för flera pass misslyckad, ${n} pass`);
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
        /* En reservation som drogs delvis (kortet_reserveras, 2026-10-13) har
           amount_captured under amount, och det dragna är helheten: att
           allt det dragna betalats tillbaka är en hel återbetalning. Sedan
           API-versionen 2025-03-31.basil räknas det som aldrig drogs inte
           som återbetalt. */
        const totalt = Number(typeof obj.amount_captured === 'number' && obj.amount_captured > 0
          ? obj.amount_captured : obj.amount ?? 0);
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
          /* Stripes lista över återbetalningarna, en gång: varje återbetalning
             skrivs ner, och raderna fördelas ur den. */
          const lista = await v1('GET', `/v1/refunds?charge=${encodeURIComponent(chargeId)}&limit=100`);
          const aterbet = (Array.isArray(lista.data) ? lista.data : []) as Aterbetalning[];
          await loggaAterbetalningar(String(obj.payment_intent ?? ''), aterbet);
          /* En betalning med tillägg (syskontillagg_som_skuld) och en för flera
             pass (2026-10-27) återbetalas per rad. */
          const radSvar = await aterbetalaRader(chargeId, String(obj.payment_intent ?? ''), aterbetalt, totalt, aterbet);
          if (radSvar !== null) return await klar(radSvar);
          const passen = await aterbetala('bookings', 'stripe_charge_id', chargeId, 'betalning_status', lage);
          /* Ett köp av timmar (Fas 16.1). En återbetalning i Stripes panel
             STÄNGER köpet, också en delvis: villkoren har tre skäl att
             betala tillbaka ett köp (ångerrätten, att familjen slutar, och
             en timme som gick förlorad när kortet löpte ut för att vi
             avbokat för sent), och i alla tre är det slut. Öppet hade det
             låtit familjen dra timmar som redan gått tillbaka.

             Sedan 2026-10-21 (planerna_per_manad) drar adminvyns
             återbetalning tillbaka timmarna själv (stripe-aterbetalning):
             den bär köpets id i Stripes metadata, och då står köpet kvar
             med de timmar som är kvar. Varje sådan återbetalning skrivs här
             också, om funktionen inte hann. Allt som återbetalats utan
             köpets id stänger köpet som förut, och blir en uppgift. */
          const { data: kop, error: kopfel } = await db.from('klippkort')
            .select('id').eq('stripe_charge_id', chargeId).maybeSingle();
          if (kopfel) throw new Error('klippkort: ' + kopfel.message);
          if (kop) {
            const { framande_ore } = await stamAvKopet(v1, (namn, args) => db.rpc(namn, args),
              { kort: String(kop.id), charge: chargeId });
            const stang = framande_ore > 0 || aterbetalt >= totalt;
            if (stang) {
              await aterbetala('klippkort', 'stripe_charge_id', chargeId, 'status', 'aterbetald');
            } else {
              /* Bara beloppet: läget är det avstämningen just lämnade (hela
                 köpet tillbaka genom adminvyn har redan stängt det). */
              const { error: bfel } = await db.from('klippkort')
                .update({ aterbetald_ore: aterbetalt }).eq('stripe_charge_id', chargeId);
              if (bfel) throw new Error('klippkort: ' + bfel.message);
            }
            if (framande_ore > 0) {
              const { error: ufel } = await db.rpc('skapa_uppgift', {
                p_titel: 'Ett köp av timmar betalades tillbaka i Stripe',
                p_nyckel: `kop-aterbetalt-i-stripe:${chargeId}:${aterbetalt}`,
                p_typ: 'kontroll',
                p_beskrivning: `${Math.round(framande_ore / 100)} kr betalades tillbaka i Stripes dashboard, inte i `
                  + 'adminvyn, så inga timmar drogs tillbaka och köpet stängdes. Stäm av med familjen vilka timmar '
                  + 'som ska gälla.',
                p_kopplad_tabell: 'klippkort',
                p_kopplad_id: String(kop.id),
                p_skapad_av_typ: 'system',
              });
              if (ufel) throw new Error('skapa_uppgift: ' + ufel.message);
            }
            return await klar(`klippkort återbetalt ${aterbetalt} öre${stang ? ', stängt' : ''}`);
          }
          // Ett tillägg (Fas 20.1) har sin egen charge, och sin egen rad.
          if (await aterbetala('pass_tillagg', 'stripe_charge_id', chargeId, 'status', lage)) {
            return await klar(`tillägg återbetalt ${aterbetalt} öre`);
          }
          /* Ingen rad bär charge:n: en betalning som inte kunde skrivas ner
             (betalning_utan_rad) står bara i liggaren, och återbetalas där. */
          const pi = String(obj.payment_intent ?? '');
          if (!passen && pi) {
            const { error: lfel } = await db.rpc('betalning_aterbetald', { p_pi: pi, p_aterbetalt: aterbetalt });
            if (lfel && lfel.code !== 'PGRST202') throw new Error('betalning_aterbetald: ' + lfel.message);
          }
          return await klar(`återbetalt ${aterbetalt} öre`);
        }
        const passId = String((obj.metadata as Record<string, string> | undefined)?.booking_id ?? '');
        if (!passId) return await klar('återbetalning utan charge-id och utan pass-id');
        await aterbetala('bookings', 'id', passId, 'betalning_status', lage);
        return await klar(`återbetalt ${aterbetalt} öre (via metadata)`);
      }

      // ---------- kortet reserveras (kortet_reserveras, 2026-10-13) ----------
      /* stripe-reservation skriver reservationens läge själv, i samma stund
         som Stripe svarar. Händelserna här är reserven: föll funktionen
         mellan Stripes svar och skrivningen, skriver webhooken. Varje
         skrivning går att göra två gånger (kortreservation_skriv). Bara ett
         PaymentIntent som bär kortreservation i metadata rörs här: kassans
         egna har sina grenar ovan, och deras payment_intent-händelser
         kvitteras utan att något skrivs. */
      case 'payment_intent.amount_capturable_updated': {
        const passId = reservationensPass(obj.metadata);
        const piId = String(obj.id ?? '');
        if (!passId || !arStripeId(piId, 'pi')) return await klar('inte en reservation');
        // Läget läses färskt: en sen leverans kan gälla en reservation som redan släppts.
        const pi = await v1('GET', `/v1/payment_intents/${piId}?expand[]=latest_charge`);
        const belopp = typeof pi.amount_capturable === 'number' ? pi.amount_capturable : 0;
        if (pi.status !== 'requires_capture' || !(belopp > 0)) {
          return await klar(`reservation som står som ${String(pi.status)}`);
        }
        const { data: blev, error } = await db.rpc('kortreservation_skriv', {
          p_bokning: passId, p_lage: 'reserverad', p_pi: piId, p_belopp: belopp,
          p_till: reserveradTill(pi.latest_charge),
        });
        if (error) throw new Error('kortreservation_skriv: ' + error.message);
        /* Familjen valde bort kortet medan Stripe svarade, eller raden har
           redan en annan reservation: den här släpps. */
        if (blev === 'saknas' || blev === 'avvisad') {
          try {
            await v1('POST', `/v1/payment_intents/${piId}/cancel`, { cancellation_reason: 'duplicate' },
              `nextrum-slapp-${piId}`);
          } catch (e) {
            if (!(e instanceof StripeError)) throw e;
          }
          return await klar('reservationen var över och släpptes');
        }
        return await klar(`reservation: ${String(blev)}`);
      }

      /* PENGARNA DROGS med det sparade kortet: en reservation som drogs när
         rapporten kom, eller en dragning utan reservation. Passet blir betalt
         på samma sätt som genom kassan (betalaPasset), med beloppet Stripe
         drog och minuterna stripe-reservation skrev i metadata. */
      case 'payment_intent.succeeded': {
        const passId = reservationensPass(obj.metadata);
        const piId = String(obj.id ?? '');
        if (!passId || !arStripeId(piId, 'pi')) return await klar('betalas genom kassan');
        const draget = typeof obj.amount_received === 'number' ? obj.amount_received : null;
        const { error } = await db.rpc('kortreservation_skriv', {
          p_bokning: passId, p_lage: 'dragen', p_pi: piId, p_belopp: draget,
        });
        if (error) throw new Error('kortreservation_skriv: ' + error.message);
        const { chargeId, b } = await chargeOchBalans(piId);
        return await betalaPasset(passId, piId, chargeId, b, draget, minuterUr(obj.metadata));
      }

      /* RESERVATIONEN SLÄPPTES. Vårt eget släpp har en orsak som
         stripe-reservation sätter; utan den släppte Stripe en reservation
         som inte drogs i tid, och den har gått ut. Raden ändras bara om den
         pekar på just det här PaymentIntent. */
      case 'payment_intent.canceled': {
        const passId = reservationensPass(obj.metadata);
        const piId = String(obj.id ?? '');
        if (!passId || !arStripeId(piId, 'pi')) return await klar('inte en reservation');
        const lage = slappetsLage(obj.cancellation_reason);
        const { data: blev, error } = await db.rpc('kortreservation_skriv', {
          p_bokning: passId, p_lage: lage, p_pi: piId,
        });
        if (error) throw new Error('kortreservation_skriv: ' + error.message);
        return await klar(`reservation ${lage === 'slappt' ? 'släppt' : 'utgången'}: ${String(blev)}`);
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

        /* En betalning som bara är tillägg (Betala tillägg nu) eller som
           gällde flera pass (Betala alla, 2026-10-27) bärs av ingen rad ovan:
           tvisten flaggas på liggarens rad och, för flera pass, på passen
           (betalning_tvist), och inget annat görs (syskontillagg_som_skuld). Efter vakten ovan (granskningen
           2026-10-21): en sen updated efter en stängd tvist satte annars
           betalningen i tvist igen. */
        const tillaggSvar = !pass && !kort && !tillagg ? await hanteraTillagg(typ, obj, skarp, tillaggDb) : null;

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
        return await klar(`tvist ${tvistId}: ${lage}${tillaggSvar ? ', ' + tillaggSvar : ''}${uppgiftsfel}`);
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
