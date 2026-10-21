// ============================================================
// NEXTRUM — syskontillägget som skuld (2026-10-21)
//
// Leo: "bokar en familj ett pass med fler än ett barn tillkommer ett
// tillägg per extra barn. Tillägget blir en skuld på familjen när passet
// är hållet. Familjen kan betala skulden när hen vill under Betalningar,
// eller så läggs den som en egen rad i nästa betalning."
//
// Databasen äger skulden: posterna (tillagg_poster), deras lägen,
// beloppen och låsningen i ett betalningsförsök (tillagg_forsok). Här
// står det Stripe-delen gör med den, så att det går att pröva utan nät
// och utan databas (tillagg_test.ts):
//
//   · tillaggetsBelopp räknar som databasen (intern.tillaggets_belopp):
//     extra barn × pris per barn och timme × minuter / 60, avrundat till
//     hela ören. De ändras tillsammans. Beloppet som dras är alltid
//     databasens; den här är en kontroll och en visning.
//   · buntaKassan lägger tillägget som en egen rad bredvid planen eller
//     passet. Rabattkoden räknas bara på huvudraden, aldrig på tillägget,
//     och totalen är raderna. Med TILLAGG_OBLIGATORISK_I_NASTA_BETALNING
//     (tillagg_installning.obligatorisk_i_nasta_betalning) följer det
//     alltid med; annars får familjen kryssa ur det.
//   · huvudbeloppUrTotal: webhooken skriver bara huvudradens del på
//     köpet eller passet, aldrig tillägget.
//   · fordelaAterbetalningar: en återbetalning hör till raden den bär i
//     metadata, och en rad får aldrig mer tillbaka än den betalade.
//   · hanteraTillagg: webhookens gren för en betalning som BARA är
//     tillägg (Betala tillägg nu), en session som går ut eller avbryts,
//     och en tvist. Databasen kommer in utifrån (TillaggDb): webhooken
//     skickar in sin klient, proven en falsk.
// ============================================================

/** Ett uuid, som databasens id:n. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tilläggets belopp i öre: extra barn × pris per barn och timme × minuter
 * / 60, avrundat till hela ören. Samma regel som intern.tillaggets_belopp:
 * round() i Postgres avrundar en halv öre uppåt, som Math.round för
 * positiva tal. Ett belopp som inte går att räkna är ett fel, aldrig noll.
 */
export function tillaggetsBelopp(extraBarn: number, prisOrePerTimme: number, minuter: number): number {
  if (!Number.isInteger(extraBarn) || extraBarn < 0) throw new Error('Antalet extra barn är inte ett heltal från noll.');
  if (!Number.isInteger(prisOrePerTimme) || prisOrePerTimme < 0) throw new Error('Priset är inte ett belopp i öre.');
  if (!Number.isInteger(minuter) || minuter <= 0) throw new Error('Passets längd är inte ett antal minuter.');
  return Math.round((extraBarn * prisOrePerTimme * minuter) / 60);
}

/** Raden i kassan och i Stripe. Aldrig ett namn på ett barn. */
export function tillaggetsRadtext(antalPass: number): string {
  return `Upplupet tillägg för extra barn, ${antalPass} pass`;
}

/**
 * Tilläggets rad i Stripes kassa, med databasens belopp. Egen rad bredvid
 * planen, aldrig en del av den: koden räknas bara på planen.
 */
export function tillaggetsLinje(beloppOre: number, antalPass: number, valuta: string) {
  if (!Number.isInteger(beloppOre) || beloppOre <= 0) throw new Error('Tillägget saknar belopp.');
  if (!Number.isInteger(antalPass) || antalPass <= 0) throw new Error('Tillägget saknar pass.');
  return {
    quantity: 1,
    price_data: {
      currency: valuta,
      unit_amount: beloppOre,
      product_data: {
        name: tillaggetsRadtext(antalPass),
        description: 'Tillägget för syskon på samma pass, för pass som redan hållits. Rabattkoder gäller inte tillägget.',
      },
    },
  };
}

/**
 * Kassans utgångstid i sekunder, ur försökets upphor_at, så att två tryck
 * på samma försök ger samma parametrar till Stripe (samma idempotensnyckel).
 * Försöket gäller 30 minuter och en halv, och Stripe kräver minst 30.
 */
export function utgangstid(upphorAt: string | null | undefined, nuMs: number): number {
  const t = Date.parse(String(upphorAt ?? ''));
  return Number.isFinite(t) ? Math.floor(t / 1000) : Math.floor(nuMs / 1000) + 30 * 60 + 30;
}

export type Huvudrad = {
  typ: 'plan' | 'timbank' | 'pass';
  namn: string;
  /** Huvudradens pris före koden (efter familjens rabatt), i öre. */
  beloppOre: number;
  /** Kodens rabatt, som databasen räknat den. Noll utan kod. */
  rabattOre: number;
  kod: string | null;
};

export type Kassarad = {
  typ: 'plan' | 'timbank' | 'pass' | 'tillagg';
  namn: string;
  beloppOre: number;
  rabattOre: number;
  kod: string | null;
};

/**
 * Kassans rader: huvudraden med koden dragen, och tillägget som en egen
 * rad, orört. Rabattkoden räknas bara på huvudraden. Ett köp blir aldrig
 * gratis av en kod, och ingen rad är negativ.
 */
export function buntaKassan(
  huvud: Huvudrad,
  tillagg: { beloppOre: number; antalPass: number } | null,
  val: { obligatorisk: boolean; medTillagg: boolean },
): { rader: Kassarad[]; totalOre: number; medTillagg: boolean } {
  if (!Number.isInteger(huvud.beloppOre) || huvud.beloppOre <= 0) throw new Error('Huvudraden saknar belopp.');
  if (!Number.isInteger(huvud.rabattOre) || huvud.rabattOre < 0) throw new Error('Rabatten är inte ett belopp.');
  if (huvud.rabattOre >= huvud.beloppOre) throw new Error('En kod gör aldrig köpet gratis.');
  if (tillagg && (!Number.isInteger(tillagg.beloppOre) || tillagg.beloppOre < 0)) {
    throw new Error('Tillägget är inte ett belopp.');
  }
  const rader: Kassarad[] = [{
    typ: huvud.typ, namn: huvud.namn, beloppOre: huvud.beloppOre - huvud.rabattOre, rabattOre: huvud.rabattOre,
    kod: huvud.kod,
  }];
  const finns = !!tillagg && tillagg.beloppOre > 0;
  const med = finns && (val.obligatorisk || val.medTillagg);
  if (med) {
    rader.push({ typ: 'tillagg', namn: tillaggetsRadtext(tillagg!.antalPass), beloppOre: tillagg!.beloppOre,
                 rabattOre: 0, kod: null });
  }
  return { rader, totalOre: rader.reduce((a, r) => a + r.beloppOre, 0), medTillagg: med };
}

/**
 * Huvudradens del av det Stripe drog, när ett tillägg följde med i samma
 * betalning. null när det inte går ihop: då skrivs ingenting som betalt.
 */
export function huvudbeloppUrTotal(totalOre: number, tillaggOre: number): number | null {
  if (!Number.isInteger(totalOre) || !Number.isInteger(tillaggOre)) return null;
  if (tillaggOre < 0 || totalOre < tillaggOre) return null;
  return totalOre - tillaggOre;
}

export type Aterbetalning = {
  id: string; amount: number; status?: string; metadata?: Record<string, unknown> | null;
};

/**
 * Återbetalningarna på en betalning, fördelade per rad. En återbetalning
 * med raden i metadata (betalningsrad) hör till den raden; en med köpets
 * id (klippkort_id, som adminvyns återbetalning av ett köp skriver) hör
 * till köpets rad. En rad får aldrig mer tillbaka än den betalade: det som
 * går över är överskott. En utan rad, eller med en rad som inte finns på
 * betalningen, är ofördelad, och då avgör en människa (en uppgift). Samma
 * återbetalning räknas en gång, och en som misslyckats räknas inte.
 */
export function fordelaAterbetalningar(
  rader: { id: string; beloppOre: number; klippkortId?: string | null }[],
  aterbetalningar: Aterbetalning[],
): { perRad: Record<string, number>; ofordelat: number; overskott: number } {
  const perRad: Record<string, number> = {};
  const tak = new Map<string, number>();
  const kopetsRad = new Map<string, string>();
  for (const r of rader) {
    perRad[r.id] = 0;
    tak.set(r.id, Math.max(0, Math.trunc(r.beloppOre)));
    if (r.klippkortId) kopetsRad.set(r.klippkortId, r.id);
  }
  let ofordelat = 0;
  let overskott = 0;
  const sedda = new Set<string>();
  for (const a of aterbetalningar) {
    if (!a || sedda.has(a.id)) continue;
    sedda.add(a.id);
    if (a.status !== undefined && a.status !== 'succeeded' && a.status !== 'pending') continue;
    const belopp = Math.max(0, Math.trunc(Number(a.amount) || 0));
    const md = (a.metadata ?? {}) as Record<string, unknown>;
    const rad = String(md.betalningsrad ?? '') || kopetsRad.get(String(md.klippkort_id ?? '')) || '';
    if (!rad || !tak.has(rad)) { ofordelat += belopp; continue; }
    const kvar = tak.get(rad)! - perRad[rad];
    const del = Math.min(belopp, Math.max(0, kvar));
    perRad[rad] += del;
    overskott += belopp - del;
  }
  return { perRad, ofordelat, overskott };
}

/** Betalningsförsökets id ur sessionens metadata, som stripe-checkout skrev den. */
export function forsokUrMetadata(m: unknown): string | null {
  const v = String(((m ?? {}) as Record<string, unknown>).tillagg_forsok ?? '');
  return UUID.test(v) ? v.toLowerCase() : null;
}

/** Det webhooken behöver av databasen för tillägget (RPC:er med service_role). */
export type TillaggDb = {
  /** tillagg_forsok_betald: liggaren, raderna och posterna i en transaktion.
   *  'betald', 'redan' (samma betalning), 'dubbel' (en annan betalning),
   *  'fel_belopp' eller 'okant'. */
  betald(a: {
    forsok: string; pi: string; charge: string | null; belopp: number; skarp: boolean | null;
    avgift: number | null; netto: number | null;
  }): Promise<string>;
  /** tillagg_forsok_vantar: sessionen är klar men pengarna kommer senare (Klarna). */
  vantar(a: { forsok: string; session: string }): Promise<boolean>;
  /** tillagg_forsok_slapp: posterna tillbaka till upplupen. */
  slapp(a: { forsok: string; orsak: 'utgangen' | 'avbruten' }): Promise<boolean>;
  /** betalning_tvist: tvisten flaggas på betalningen i liggaren, ingen annan åtgärd. */
  tvist(a: { charge: string; lage: string }): Promise<boolean>;
};

/** Betalningens charge, avgift och netto, som webhooken hämtar dem ur Stripe. */
export type ChargeUppslag = (pi: string) => Promise<{ chargeId: string | null; avgiftOre: number | null; nettoOre: number | null }>;

/**
 * Webhookens gren för tillägget. Svarar null när händelsen inte är
 * tilläggets: då tar webhookens andra grenar den. En session för ett köp
 * eller ett pass som bär ett tillägg skrivs av köpets gren (i samma
 * transaktion som köpet), inte här; här skrivs bara en betalning som är
 * enbart tillägg, en session som går ut eller avbryts, och en tvist som
 * ingen annan rad bär (webhooken frågar då, efter passen och köpen).
 */
export async function hanteraTillagg(
  typ: string,
  obj: Record<string, unknown>,
  skarp: boolean | null,
  db: TillaggDb,
  charge?: ChargeUppslag,
): Promise<string | null> {
  const m = (obj.metadata ?? {}) as Record<string, unknown>;
  const forsok = forsokUrMetadata(m);
  const bararTillagg = !!forsok && !m.klippkort_id && !m.booking_id && !m.tillagg_booking_id
    && !obj.client_reference_id;

  if (typ === 'checkout.session.expired' || typ === 'checkout.session.async_payment_failed') {
    if (!forsok) return null;
    await db.slapp({ forsok, orsak: typ === 'checkout.session.expired' ? 'utgangen' : 'avbruten' });
    return 'tillägg släppt';
  }

  if (typ === 'checkout.session.completed' || typ === 'checkout.session.async_payment_succeeded') {
    if (!forsok) return null;
    /* Pengarna kommer senare (Klarna): försöket märks, också när tillägget
       är en rad i ett köp, så att jobbet inte släpper posterna medan
       betalningen är på väg. Köpet har inget att skriva förrän pengarna kommer. */
    if (obj.payment_status !== 'paid') {
      await db.vantar({ forsok, session: String(obj.id ?? '') });
      return 'tillägg: väntar på betalningen';
    }
    if (!bararTillagg) return null;
    const pi = String(obj.payment_intent ?? '');
    const belopp = typeof obj.amount_total === 'number' ? obj.amount_total : Number.NaN;
    if (!/^pi_[A-Za-z0-9_]+$/.test(pi) || !Number.isInteger(belopp)) return 'tillägg: sessionen saknar betalning';
    const c = charge ? await charge(pi) : { chargeId: null, avgiftOre: null, nettoOre: null };
    const svar = await db.betald({
      forsok: forsok!, pi, charge: c.chargeId, belopp, skarp, avgift: c.avgiftOre, netto: c.nettoOre,
    });
    if (svar === 'betald') return 'tillägg betalt';
    if (svar === 'redan') return 'tillägget var redan betalt';
    if (svar === 'fel_belopp') return 'tillägg: beloppet stämmer inte, ingenting markerat';
    if (svar === 'dubbel') return 'tillägg: betalt två gånger, uppgift skapad';
    return 'tillägg: okänt försök';
  }

  if (typ === 'charge.dispute.created' || typ === 'charge.dispute.updated' || typ === 'charge.dispute.closed') {
    const charge = String(obj.charge ?? '');
    if (!charge) return null;
    await db.tvist({ charge, lage: String(obj.status ?? '') || 'needs_response' });
    return 'tillägg: tvisten flaggad';
  }

  return null;
}
