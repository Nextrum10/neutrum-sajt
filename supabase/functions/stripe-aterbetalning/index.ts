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
// INGEN TRANSFER ATT BACKA (sedan Fas 12.5)
//
// Först var betalningen en destination charge, och då behövdes
// reverse_transfer och refund_application_fee: hjälparens del låg på
// hens konto och måste dras tillbaka. Den vägen är borta. Hela
// beloppet ligger hos Nextrum, så en vanlig återbetalning räcker, och
// de två flaggorna hade Stripe avvisat som meningslösa på en betalning
// utan destination.
//
// Att ett pass återbetalas betyder däremot att det inte ska hamna på
// studiehjälparens underlag den 25:e. Det sköts av att passet aldrig
// blir genomfört utan rapport — ett avbokat pass får ingen rapport,
// och utan rapport kommer det inte med i månadskörningen.
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
//
//
// ETT KÖP AV TIMMAR (2026-10-21, planerna_per_manad)
//
// Med { klippkort, timmar? } betalas ett köp tillbaka: helt, eller ett
// antal timmar, och timmarna dras tillbaka, aldrig under det som
// använts. Beloppet räknas i databasen och flödet står i
// _delad/aterbetalning.ts, där det prövas utan Stripe.
//
//
// EN RAD MED SYSKONTILLÄGG (2026-10-21, syskontillagg_som_skuld)
//
// Med { betalningsrad, belopp_ore? } betalas en tilläggsrad tillbaka:
// det som är kvar på raden, eller mindre. Raden och det som är kvar läses
// med admins token (betalningsrad_att_aterbetala), och återbetalningen bär
// raden i Stripes metadata, så att webhooken och den här funktionen
// fördelar Stripes lista likadant (fordelaAterbetalningar). Ingen rad får
// mer tillbaka än den betalade, och resten av betalningen rörs inte.
//
//
// ALLT GÅR ATT BETALA TILLBAKA HÄRIFRÅN (2026-10-27, flera_pass_och_aterbetalningar)
//
// Leo: "bygg en återbetalningsfunktion för oss i admin." Det som förut
// bara gick i Stripes dashboard går nu härifrån, med samma tak:
//
//   · { pass } för ett pass som betalats i en kassa för flera pass: det
//     betalas tillbaka från sin rad, som en rad med syskontillägg.
//   · { tillagg: pass } betalar tillbaka övertiden (pass_tillagg).
//   · { betalning } betalar tillbaka en betalning som inte kunde skrivas
//     ner (betalning_utan_rad): två kassor som båda betalades.
//
// Varje återbetalning skrivs ner (aterbetalningar, aterbetalning_logga):
// vad, hur mycket, vem och varför. Anledningen står också i Stripes
// metadata, som förut, och webhooken skriver samma rad ur den om den här
// funktionen inte hann.
// ============================================================

import { aterbetalaKop } from '../_delad/aterbetalning.ts';
import { raderIo, skrivRaderna } from '../_delad/passkassa.ts';
import { kravAdmin, serviceklient } from '../_delad/auth.ts';
import { cors, json, preflight } from '../_delad/http.ts';
import { aterbetalningsLage, StripeError, v1 } from '../_delad/stripe.ts';

const CORS = cors();

/* Raden i en betalning för flera pass som ett pass betalades med
   (2026-10-27), eller null: passet har ingen kassa, eller kassan ingen
   betalning. */
async function passetsRad(db: ReturnType<typeof serviceklient>, pass: string): Promise<string | null> {
  const { data: b } = await db.from('bookings').select('passkassa_id').eq('id', pass).maybeSingle();
  const kassa = (b as { passkassa_id?: string | null } | null)?.passkassa_id;
  if (!kassa) return null;
  const { data: k } = await db.from('passkassor').select('betalning_id').eq('id', kassa).maybeSingle();
  if (!k?.betalning_id) return null;
  const { data: r } = await db.from('betalningsrader').select('id')
    .eq('betalning_id', k.betalning_id).eq('booking_id', pass).eq('typ', 'pass').maybeSingle();
  return r?.id ? String(r.id) : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(CORS);
  if (req.method !== 'POST') return json({ error: 'Bara POST.' }, 405, CORS);

  // Anroparens egen token prövas mot Auth OCH is_admin innan
  // service_role rör någonting. Att gömma knappen är inte säkerhet.
  const vem = await kravAdmin(req.headers.get('authorization'));
  if (!vem.ok) return vem.svar;

  let kropp: {
    pass?: string; belopp_ore?: number; anledning?: string; klippkort?: string; timmar?: unknown; betalningsrad?: string;
    tillagg?: string; betalning?: string;
  } = {};
  try {
    kropp = await req.json();
  } catch {
    return json({ error: 'Kroppen är inte JSON.' }, 400, CORS);
  }

  const db = serviceklient();
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const onskat = Number(kropp.belopp_ore ?? 0);

  /* VARJE ÅTERBETALNING SKRIVS NER (2026-10-27) med vem och varför.
     Webhooken skriver samma rad ur Stripes metadata, så det gör inget om den
     hinner först, och samma återbetalning två gånger blir en rad. Ett fel
     här är ingen återbetalning som misslyckats: pengarna är tillbaka, och
     beskedet säger att raden i listan saknas. */
  const logga = async (a: {
    refund: unknown; pi: string | null; belopp: number; rad?: string | null; booking?: string | null;
    klippkort?: string | null; tillagg?: boolean; anledning: string | null;
  }): Promise<string | null> => {
    const refund = String(a.refund ?? '');
    if (!refund) return null;
    const { error } = await db.rpc('aterbetalning_logga', {
      p_refund: refund, p_pi: a.pi, p_belopp: a.belopp, p_rad: a.rad ?? null, p_booking: a.booking ?? null,
      p_klippkort: a.klippkort ?? null, p_tillagg: !!a.tillagg, p_anledning: a.anledning || null,
      p_av: vem.anvandare, p_satt: 'adminvyn',
    });
    if (!error || error.code === 'PGRST202') return null;
    return 'Pengarna är tillbaka, men återbetalningen står inte i listan än: ' + error.message;
  };
  const ihop = (...v: (string | null)[]) => v.filter(Boolean).join(' ') || null;

  /* En rad i en betalning med flera rader (2026-10-21; ett pass i en kassa
     för flera pass sedan 2026-10-27): det som är kvar på raden, eller
     mindre. Raden och det som är kvar läses med admins token
     (betalningsrad_att_aterbetala), och återbetalningen bär raden i Stripes
     metadata, så att webhooken och den här funktionen fördelar Stripes
     lista likadant (skrivRaderna). */
  const aterbetalaRad = async (rad: string, anledning: string): Promise<Response> => {
    const { data: l, error: lfel } = await vem.klient.rpc('betalningsrad_att_aterbetala', { p_rad: rad });
    if (lfel) return json({ error: lfel.message }, lfel.code === '42501' ? 403 : 409, CORS);
    const lage = (l ?? {}) as {
      pi?: string; charge?: string | null; post?: string | null; pass?: string | null; betalning?: string; kvar_ore?: number;
    };
    const kvar = Math.round(Number(lage.kvar_ore) || 0);
    if (!(kvar > 0)) return json({ error: 'Raden är redan återbetald.' }, 409, CORS);
    if (!lage.pi || !lage.betalning) return json({ error: 'Raden saknar en betalning i Stripe.' }, 409, CORS);
    const belopp = onskat > 0 ? Math.min(Math.round(onskat), kvar) : kvar;
    try {
      const aterbetalning = await v1('POST', '/v1/refunds', {
        payment_intent: lage.pi,
        amount: belopp,
        // Passet följer med för en rad som är ett pass (2026-10-27); en rad med tillägg bär samma som förut.
        metadata: { betalningsrad: rad, tillagg_post: lage.post ?? '', ...(lage.pass ? { booking_id: lage.pass } : {}),
                    av: vem.anvandare, anledning },
      }, `nextrum-aterbet-rad-${rad}-${kvar}-${belopp}`);

      /* Raderna skrivs ur Stripes lista, som webhooken gör: summor per rad,
         så att den här skrivningen och webhookens blir samma, och databasen
         skriver ett pass ur sin rad. Faller den skriver webhooken samma sak
         när charge.refunded kommer. */
      let varning: string | null = null;
      const chargeId = lage.charge ?? (aterbetalning as { charge?: string }).charge ?? null;
      try {
        if (!chargeId) throw new Error('ingen charge');
        await skrivRaderna(lage.pi, chargeId, raderIo(db, v1));
      } catch (e) {
        varning = 'Pengarna är tillbaka, men raden skrivs först när webhooken kommer: ' + ((e as Error)?.message ?? '');
      }
      const id = (aterbetalning as { id?: string }).id ?? null;
      const lv = await logga({ refund: id, pi: lage.pi, belopp, rad, anledning });
      return json({ ok: true, aterbetalning: id, belopp_ore: belopp, varning: ihop(varning, lv) }, 200, CORS);
    } catch (e) {
      if (e instanceof StripeError) return json({ error: 'Stripe nekade: ' + e.fel.meddelande, stripe: e.fel }, 502, CORS);
      return json({ error: (e as Error)?.message ?? 'Okänt fel.' }, 500, CORS);
    }
  };

  // Ett köp av timmar (2026-10-21): beloppet och timmarna ur databasen.
  if (kropp.klippkort !== undefined) {
    const kort = String(kropp.klippkort ?? '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(kort)) return json({ error: 'Vilket köp?' }, 400, CORS);
    const t = kropp.timmar;
    const timmar = t === undefined || t === null || t === '' ? null : Number(t);
    if (timmar !== null && !(Number.isInteger(timmar) && timmar >= 1 && timmar <= 200)) {
      return json({ error: 'Välj ett antal hela timmar.' }, 400, CORS);
    }
    const anledning = String(kropp.anledning ?? '').trim().slice(0, 300) || null;
    try {
      const u = await aterbetalaKop(v1, (namn, args) => db.rpc(namn, args), {
        kort, timmar, anledning, av: vem.anvandare,
      });
      if (!u.ok) return json({ error: u.fel, ...(u.stripe ? { stripe: u.stripe } : {}) }, u.status, CORS);
      const lv = await logga({ refund: u.aterbetalning, pi: null, belopp: u.belopp_ore, klippkort: kort, anledning });
      return json({ ok: true, aterbetalning: u.aterbetalning, belopp_ore: u.belopp_ore, timmar: u.timmar, hela: u.hela,
                    varning: ihop(u.varning, lv) }, 200, CORS);
    } catch (e) {
      return json({ error: (e as Error)?.message ?? 'Okänt fel.' }, 500, CORS);
    }
  }

  // En rad med syskontillägg (2026-10-21) eller ett pass i en kassa för flera pass (2026-10-27).
  if (kropp.betalningsrad !== undefined) {
    const rad = String(kropp.betalningsrad ?? '').trim();
    if (!UUID.test(rad)) return json({ error: 'Vilken rad?' }, 400, CORS);
    return await aterbetalaRad(rad, String(kropp.anledning ?? '').slice(0, 300));
  }

  /* ÖVERTIDEN (Fas 20.1, härifrån sedan 2026-10-27): tillägget för ett pass
     som drog över har sin egen betalning och sin egen rad (pass_tillagg).
     Taket är det tillägget betalade minus det som redan gått tillbaka, och
     läget läses tillbaka från Stripe, som för ett pass. */
  if (kropp.tillagg !== undefined) {
    const tPass = String(kropp.tillagg ?? '').trim();
    if (!UUID.test(tPass)) return json({ error: 'Vilket tillägg?' }, 400, CORS);
    try {
      const { data: t, error: tfel } = await db.from('pass_tillagg')
        .select('booking_id, status, stripe_payment_intent_id, stripe_charge_id, betalt_ore, aterbetald_ore')
        .eq('booking_id', tPass).maybeSingle();
      if (tfel) return json({ error: 'Tillägget gick inte att läsa.' }, 500, CORS);
      if (!t) return json({ error: 'Tillägget finns inte.' }, 404, CORS);
      if (t.status === 'tvist') {
        return json({ error: 'Tillägget har en korttvist. Pengarna går tillbaka genom tvisten; svara på den under Tvister i Stripe.' },
          409, CORS);
      }
      if (t.status !== 'betald') return json({ error: `Tillägget står som "${t.status}" och går inte att återbetala.` }, 409, CORS);
      if (!t.stripe_payment_intent_id || t.betalt_ore === null || t.betalt_ore === undefined) {
        return json({ error: 'Tillägget saknar en kortbetalning från Stripe.' }, 409, CORS);
      }
      const betalt = Number(t.betalt_ore), redan = Number(t.aterbetald_ore ?? 0), kvar = betalt - redan;
      if (kvar <= 0) return json({ error: 'Hela tillägget är redan återbetalt.' }, 409, CORS);
      const belopp = onskat > 0 ? Math.min(Math.round(onskat), kvar) : kvar;
      const anledning = String(kropp.anledning ?? '').slice(0, 300);
      const aterbetalning = await v1('POST', '/v1/refunds', {
        payment_intent: t.stripe_payment_intent_id,
        amount: belopp,
        metadata: { tillagg_booking_id: tPass, av: vem.anvandare, anledning },
      }, `nextrum-aterbet-tillagg-${tPass}-${redan}-${belopp}`);
      let totalt = redan + belopp;
      const chargeId = t.stripe_charge_id ?? (aterbetalning as { charge?: string }).charge ?? null;
      if (chargeId) {
        try {
          totalt = Number((await v1('GET', `/v1/charges/${chargeId}`) as { amount_refunded?: number }).amount_refunded ?? totalt);
        } catch {
          // Återbetalningen är gjord; webhooken skriver samma siffra med charge.refunded.
        }
      }
      const { error: sparfel } = await db.from('pass_tillagg').update({
        aterbetald_ore: totalt, status: aterbetalningsLage(totalt, betalt), stripe_charge_id: chargeId,
      }).eq('booking_id', tPass).eq('status', 'betald');
      const id = (aterbetalning as { id?: string }).id ?? null;
      const lv = await logga({ refund: id, pi: t.stripe_payment_intent_id, belopp, booking: tPass, tillagg: true, anledning });
      return json({ ok: true, aterbetalning: id, belopp_ore: belopp, aterbetalt_totalt_ore: totalt,
                    varning: ihop(sparfel ? 'Återbetalningen gick igenom men tillägget kunde inte uppdateras: ' + sparfel.message : null, lv) },
        200, CORS);
    } catch (e) {
      if (e instanceof StripeError) return json({ error: 'Stripe nekade: ' + e.fel.meddelande, stripe: e.fel }, 502, CORS);
      return json({ error: (e as Error)?.message ?? 'Okänt fel.' }, 500, CORS);
    }
  }

  /* EN BETALNING SOM INTE KUNDE SKRIVAS NER (betalning_utan_rad, härifrån
     sedan 2026-10-27): två kassor som båda betalades, eller en kassa för
     flera pass med fel belopp. Pengarna står bara i liggaren, och de ska
     tillbaka. Raden läses med admins token, och taket är liggarens. */
  if (kropp.betalning !== undefined) {
    const bid = String(kropp.betalning ?? '').trim();
    if (!UUID.test(bid)) return json({ error: 'Vilken betalning?' }, 400, CORS);
    try {
      const { data: b, error: bfel } = await vem.klient.from('betalningar')
        .select('id, utan_rad, status, stripe_payment_intent, stripe_charge, belopp_ore, aterbetalt_ore')
        .eq('id', bid).maybeSingle();
      if (bfel) return json({ error: 'Betalningen gick inte att läsa.' }, 500, CORS);
      if (!b) return json({ error: 'Betalningen finns inte.' }, 404, CORS);
      if (!b.utan_rad) {
        return json({ error: 'Betalningen står på ett pass, ett köp eller en rad, och betalas tillbaka därifrån.' }, 409, CORS);
      }
      if (b.status === 'tvist') {
        return json({ error: 'Betalningen har en korttvist. Pengarna går tillbaka genom tvisten.' }, 409, CORS);
      }
      const redan = Number(b.aterbetalt_ore ?? 0), kvar = Number(b.belopp_ore) - redan;
      if (kvar <= 0) return json({ error: 'Hela betalningen är redan återbetald.' }, 409, CORS);
      const belopp = onskat > 0 ? Math.min(Math.round(onskat), kvar) : kvar;
      const anledning = String(kropp.anledning ?? '').slice(0, 300);
      const aterbetalning = await v1('POST', '/v1/refunds', {
        payment_intent: b.stripe_payment_intent,
        amount: belopp,
        metadata: { betalning_id: bid, av: vem.anvandare, anledning },
      }, `nextrum-aterbet-betalning-${bid}-${redan}-${belopp}`);
      let totalt = redan + belopp;
      const chargeId = b.stripe_charge ?? (aterbetalning as { charge?: string }).charge ?? null;
      if (chargeId) {
        try {
          totalt = Number((await v1('GET', `/v1/charges/${chargeId}`) as { amount_refunded?: number }).amount_refunded ?? totalt);
        } catch {
          // Webhooken skriver samma siffra med charge.refunded.
        }
      }
      const { error: sfel } = await db.rpc('betalning_aterbetald', { p_pi: b.stripe_payment_intent, p_aterbetalt: totalt });
      const id = (aterbetalning as { id?: string }).id ?? null;
      const lv = await logga({ refund: id, pi: b.stripe_payment_intent, belopp, anledning });
      return json({ ok: true, aterbetalning: id, belopp_ore: belopp, aterbetalt_totalt_ore: totalt,
                    varning: ihop(sfel ? 'Pengarna är tillbaka, men liggaren skrivs först när webhooken kommer: ' + sfel.message : null, lv) },
        200, CORS);
    } catch (e) {
      if (e instanceof StripeError) return json({ error: 'Stripe nekade: ' + e.fel.meddelande, stripe: e.fel }, 502, CORS);
      return json({ error: (e as Error)?.message ?? 'Okänt fel.' }, 500, CORS);
    }
  }

  const passId = String(kropp.pass ?? '').trim();
  if (!passId) return json({ error: 'Vilket pass?' }, 400, CORS);

  try {
    const { data: pass, error: passfel } = await db
      .from('bookings')
      .select('id, betalning_status, stripe_payment_intent_id, stripe_charge_id, betalt_ore, aterbetald_ore')
      .eq('id', passId)
      .maybeSingle();

    if (passfel) return json({ error: 'Passet gick inte att läsa.' }, 500, CORS);
    if (!pass) return json({ error: 'Passet finns inte.' }, 404, CORS);

    if (!pass.stripe_payment_intent_id) {
      /* Ett pass som betalats i en kassa för flera pass (2026-10-27) har
         kassans betalning, inte en egen: det betalas tillbaka från sin rad.
         Egna frågor, så att funktionen tål att kolumnen och tabellen saknas. */
      const rad = await passetsRad(db, pass.id);
      if (rad) return await aterbetalaRad(rad, String(kropp.anledning ?? '').slice(0, 300));
      return json({ error: 'Passet har ingen genomförd kortbetalning.' }, 409, CORS);
    }
    /* En betalning i tvist återbetalas inte härifrån (2026-09-29). Pengarna
       är redan på väg tillbaka genom kortutgivaren, och Stripe nekar en
       återbetalning av en bestriden charge. Förut släpptes den in och
       admin fick Stripes engelska fel i stället för ett besked. */
    if (pass.betalning_status === 'tvist') {
      return json({
        error: 'Passet har en korttvist. Pengarna går tillbaka genom tvisten; svara på den under Tvister i Stripe i stället.',
      }, 409, CORS);
    }
    if (pass.betalning_status !== 'betald') {
      return json({
        error: `Passet står som "${pass.betalning_status}" och går inte att återbetala.`,
      }, 409, CORS);
    }

    /* Sedan Fas 14.1 skrivs betalt_ore av webhooken, inte av
       stripe-checkout, och den kan alltså vara null om leveransen
       aldrig kom fram — till exempel innan STRIPE_WEBHOOK_SECRET var
       satt. Utan den här grenen hade `Number(null ?? 0)` gett 0 och
       svaret blivit "Hela beloppet är redan återbetalt" om en
       betalning som tvärtom är orörd. Ett fel som ljuger åt fel håll
       är värre än ett som säger vad som saknas. */
    if (pass.betalt_ore === null || pass.betalt_ore === undefined) {
      return json({
        error: 'Passet saknar betalt belopp från Stripe, så det finns inget tak att återbetala mot. '
          + 'Kontrollera att webhooken tar emot leveranser, eller återbetala i Stripes dashboard — '
          + 'charge.refunded skriver då siffran när den kommer.',
      }, 409, CORS);
    }

    const betalt = Number(pass.betalt_ore ?? 0);
    const redan = Number(pass.aterbetald_ore ?? 0);
    const kvar = betalt - redan;
    if (kvar <= 0) return json({ error: 'Hela beloppet är redan återbetalt.' }, 409, CORS);

    /* Utan belopp i anropet betyder det HELA resten. Med belopp
       begränsas det till resten — en admin som skriver fel siffra ska
       inte kunna betala tillbaka mer än som kom in. */
    const belopp = onskat > 0 ? Math.min(Math.round(onskat), kvar) : kvar;
    if (belopp <= 0) return json({ error: 'Beloppet blir noll.' }, 409, CORS);

    /* Anledningen är fritext från admin och går till Stripes metadata,
       aldrig till familjen. Kapad, för att metadata har en gräns och
       ett avvisat anrop hade sett ut som ett fel i återbetalningen. */
    const anledning = String(kropp.anledning ?? '').slice(0, 300);

    const aterbetalning = await v1('POST', '/v1/refunds', {
      payment_intent: pass.stripe_payment_intent_id,
      amount: belopp,
      metadata: { booking_id: pass.id, av: vem.anvandare, anledning },
    // Nyckeln bär passet OCH beloppet: två klick på samma knapp ger en
    // återbetalning, men en andra, avsiktlig delåterbetalning på ett
    // annat belopp går fortfarande igenom.
    }, `nextrum-aterbet-${pass.id}-${redan}-${belopp}`);
    const lv = await logga({
      refund: (aterbetalning as { id?: string }).id, pi: pass.stripe_payment_intent_id, belopp, booking: pass.id, anledning,
    });

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
      varning: ihop(sparfel ? 'Återbetalningen gick igenom men raden kunde inte uppdateras: ' + sparfel.message : null, lv),
    }, 200, CORS);
  } catch (e) {
    if (e instanceof StripeError) {
      return json({ error: 'Stripe nekade: ' + e.fel.meddelande, stripe: e.fel }, 502, CORS);
    }
    return json({ error: (e as Error)?.message ?? 'Okänt fel.' }, 500, CORS);
  }
});
