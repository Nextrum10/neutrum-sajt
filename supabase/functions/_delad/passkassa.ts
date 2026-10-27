// ============================================================
// NEXTRUM — flera pass i samma kassa (2026-10-27, flera_pass_och_aterbetalningar)
//
// Leo: "man ska kunna betala flera saker under samma kassa, eller
// alltså fler pass samtidigt. antingen alla eller pass för pass."
//
// Pass för pass är som förut: Betala nu på ett pass. Betala alla är en
// kassa för två till tjugo pass, med en rad per pass hos Stripe och på
// kvittot. Databasen äger kassan (passkassor och passkassa_*): vilka
// pass, att de är familjens och betalbara, en kassa åt gången och
// betalningen i en transaktion. Här står det kassan och webhooken gör som
// går att pröva utan nät och utan databas (passkassa_test.ts):
//
//   · passensIdn: anropets lista med pass.
//   · passetsBelopp: vad ett pass kostar i kassan. stripe-checkout räknar
//     varje pass med den, i båda kassorna: en andra kopia hade glidit isär.
//   · passetsRad: passets rad i Stripes kassa och på kvittot, samma ord
//     i båda kassorna.
//   · kassanForPassen: en kassa åt gången, med Stripes två anrop utifrån,
//     som syskontilläggets försök (forsoketsKassa i tillagg.ts).
//   · kassaUrMetadata: kassans id ur sessionens metadata, för webhooken.
//   · raderUrStripe och skrivRaderna: en återbetalning på en betalning med
//     flera rader skrivs per rad ur Stripes lista, likadant i webhooken,
//     stripe-aterbetalning och stripe-reservation.
// ============================================================

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import { familjebelopp, radtext } from './pris.ts';
import { type Aterbetalning, fordelaAterbetalningar, gamlaKassanGarUt, type KassaStripe } from './tillagg.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Som villkoret passkassor_antal_pass_check: ett pass ensamt betalas pass för pass. */
export const PASS_MIN = 2;
export const PASS_MAX = 20;

/** Anropets pass: 2–20 unika uuid:n, i gemener. Allt annat är null. */
export function passensIdn(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const idn = v.map((x) => String(x ?? '').trim().toLowerCase());
  if (idn.length < PASS_MIN || idn.length > PASS_MAX) return null;
  if (!idn.every((x) => UUID.test(x))) return null;
  if (new Set(idn).size !== idn.length) return null;
  return idn;
}

export type PassForBelopp = {
  status: string;
  duration_min: number | null;
  antal_barn: number | null;
  rabatt_ore: number | null;
  startrabatt?: boolean | null;
};

export type Belopp =
  | { ok: true; minuter: number; netto: number; brutto: number; rabatt: number; barn: number }
  | { ok: false; status: number; fel: string };

/**
 * Vad ett pass kostar i kassan, i ören, med samma regel som kassan för ett
 * pass alltid räknat:
 *   · en sen avbokning kostar avgiften databasen satte, för halva tiden
 *     (sen_avbokning, 2026-10-22), och ingen rabatt till;
 *   · ett genomfört pass kostar den hållna tiden minus övertiden
 *     timbanken redan tagit (passunderlag, Fas 20.1 och 22.1), alla andra
 *     det bokade;
 *   · det frysta timpriset och tillägget för fler barn (passpris, Fas 19.5);
 *   · rabatten är fryst vid bokningen och dras en gång.
 * Ett pass på noll kronor (första timmen på köpet) betalas inte.
 */
export function passetsBelopp(
  pass: PassForBelopp,
  pris: { timme: number; extra: number },
  sen: { minuter: number; ore: number } | null,
  underlag: { debiterade_min?: number | null; timbank_min?: number | null } | null,
): Belopp {
  let minuter = Number(pass.duration_min || 60);
  if (sen) {
    minuter = sen.minuter;
  } else if (pass.status === 'completed') {
    minuter = Number(underlag?.debiterade_min || minuter) - Number(underlag?.timbank_min || 0);
  }
  const barn = Math.max(1, Number(pass.antal_barn || 1));
  if (!pris.timme) return { ok: false, status: 409, fel: 'Tjänsten saknar pris. Sätt det i adminvyn först.' };
  const brutto = sen ? sen.ore : familjebelopp(minuter, pris.timme, pris.extra, barn);
  const rabatt = sen ? 0 : Math.min(Math.max(Number(pass.rabatt_ore || 0), 0), brutto);
  const netto = brutto - rabatt;
  if (netto <= 0) {
    return {
      ok: false, status: 409,
      fel: pass.startrabatt ? 'Passet kostar ingenting: första timmen är på köpet.' : 'Passets belopp blir noll.',
    };
  }
  return { ok: true, minuter, netto, brutto, rabatt, barn };
}

/**
 * Passets rad i kassan och på kvittot: ämnet och dagen, barnen, minuterna,
 * första timmen och familjens rabatt. Samma ord i kassan för ett pass och
 * i kassan för flera.
 */
export function passetsRad(o: {
  subject: string | null; wanted_date: string; minuter: number; barn: number; sen: boolean;
  startrabatt?: boolean | null; rabatt: number; rabattPerTimme: number;
}): { name: string; description: string } {
  const text = radtext(o.subject, String(o.wanted_date));
  if (o.sen) {
    return {
      name: `Sen avbokning: ${text}`,
      description: `Hälften av passet, som avbokades mindre än 12 timmar före start (${o.minuter} minuter)`,
    };
  }
  return {
    name: `${text}${o.barn > 1 ? ` (${o.barn} barn)` : ''}`,
    description: `Läxhjälp, ${o.minuter} minuter`
      + (o.startrabatt && o.rabatt > 0 ? ', första timmen på köpet' : '')
      + (o.rabattPerTimme > 0 ? `, med er rabatt på ${Math.round(o.rabattPerTimme / 100)} kr per timme` : ''),
  };
}

/** Kassan som databasen öppnade (passkassa_skapa). */
export type Passkassan = {
  forsok: string;
  belopp_ore: number;
  antal_pass: number;
  aterbruk: boolean;
  upphor_at: string | null;
  session: string | null;
  ersatta: string[];
};

export type Skapat = Passkassan | { fel: string } | null;

/**
 * En kassa åt gången, som syskontilläggets försök. Kassorna databasen
 * släppte när den öppnade den nya (ersatta) går ut hos Stripe; har en
 * redan blivit betald, eller väntar Klarna på den, öppnas ingen ny och
 * svaret är 'pagar'. En kassa som återanvänds har redan en session: är
 * den öppen och i samma läge (inbäddad eller Stripes sida) ger samma
 * nyckel samma session, annars går den ut, kassan släpps och en ny öppnas.
 */
export async function kassanForPassen(
  stripe: KassaStripe,
  slapp: (kassa: string, orsak: 'ersatt' | 'avbruten') => Promise<void>,
  skapa: () => Promise<Skapat>,
  inbaddad: boolean,
): Promise<Skapat | 'pagar'> {
  let k = await skapa();
  if (!k || 'fel' in k) return k;
  for (const s of k.ersatta ?? []) {
    if (await gamlaKassanGarUt(stripe, s) === 'betald') {
      if (!k.aterbruk) await slapp(k.forsok, 'avbruten');
      return 'pagar';
    }
  }
  if (k.aterbruk && k.session) {
    const gammal = await stripe.hamta(k.session);
    if (gammal.status === 'complete') return 'pagar';
    if (!(gammal.status === 'open' && (gammal.ui_mode === 'embedded') === inbaddad)) {
      if (await gamlaKassanGarUt(stripe, k.session) === 'betald') return 'pagar';
      await slapp(k.forsok, 'ersatt');
      k = await skapa();
      if (!k || 'fel' in k) return k;
    }
  }
  return k;
}

/** Svaret från passkassa_skapa, prövat: ett id, ett belopp och sessionerna som ska gå ut. */
export function lasKassan(data: unknown): Skapat {
  const d = (data ?? {}) as Record<string, unknown>;
  if (typeof d.fel === 'string' && d.fel) return { fel: d.fel };
  const id = String(d.forsok ?? '');
  const belopp = Number(d.belopp_ore);
  const antal = Number(d.antal_pass);
  if (!UUID.test(id) || !Number.isInteger(belopp) || belopp <= 0 || !Number.isInteger(antal)) return null;
  return {
    forsok: id.toLowerCase(),
    belopp_ore: belopp,
    antal_pass: antal,
    aterbruk: d.aterbruk === true,
    upphor_at: typeof d.upphor_at === 'string' ? d.upphor_at : null,
    session: typeof d.session === 'string' && d.session ? d.session : null,
    ersatta: Array.isArray(d.ersatta) ? d.ersatta.filter((s): s is string => typeof s === 'string' && !!s) : [],
  };
}

/** Kassans id ur sessionens eller betalningens metadata, som stripe-checkout skrev det. */
export function kassaUrMetadata(m: unknown): string | null {
  const v = String(((m ?? {}) as Record<string, unknown>).pass_kassa ?? '');
  return UUID.test(v) ? v.toLowerCase() : null;
}

// ---------- återbetalningen per rad ----------

/** Liggarens rad för en betalning, det som avgör hur den återbetalas. */
export type Liggarrad = { typ: string; booking_id: string | null; utan_rad: boolean | null };

/** En rad i betalningsrader. */
export type Betalningsrad = {
  id: string; typ: string; belopp_ore: number; klippkort_id?: string | null; booking_id?: string | null;
};

/** En betalning för flera pass (passkassa_betald): ett pass utan pass på liggarens rad, och nedskriven. */
export function arFleraPass(b: Liggarrad | null | undefined): boolean {
  return !!b && b.typ === 'pass' && !b.booking_id && !b.utan_rad;
}

/**
 * Återbetalningarna på en betalning, per rad, ur Stripes lista
 * (fordelaAterbetalningar). För en betalning för flera pass gäller dessutom
 * att när hela betalningen är tillbaka är varje rad det, med eller utan
 * metadata: allt tillbaka i Stripes dashboard behöver ingen som avgör vilket
 * pass det var. Annars är en återbetalning utan rad ofördelad.
 */
export function raderUrStripe(
  b: Liggarrad, rader: Betalningsrad[], lista: Aterbetalning[], aterbetalt: number, totalt: number,
): { perRad: Record<string, number>; ofordelat: number; overskott: number; hela: boolean } {
  if (arFleraPass(b) && totalt > 0 && aterbetalt >= totalt) {
    return {
      perRad: Object.fromEntries(rader.map((r) => [String(r.id), Number(r.belopp_ore)])),
      ofordelat: 0, overskott: 0, hela: true,
    };
  }
  const f = fordelaAterbetalningar(rader.map((r) => ({
    id: String(r.id), beloppOre: Number(r.belopp_ore), klippkortId: r.klippkort_id ?? null, bookingId: r.booking_id ?? null,
  })), lista);
  return { ...f, hela: false };
}

/** Det skrivRaderna behöver av databasen och Stripe, utifrån: funktionerna skickar in sina, proven falska. */
export type RaderIo = {
  /** Liggarens rad för PaymentIntent, med betalningens rader, eller null. */
  betalning(pi: string): Promise<(Liggarrad & { rader: Betalningsrad[] }) | null>;
  /** Stripes återbetalningar på charge:n. */
  lista(charge: string): Promise<Aterbetalning[]>;
  /** Charge:ns återbetalda summa och det som drogs. */
  charge(charge: string): Promise<{ aterbetalt: number; totalt: number }>;
  /** betalningsrader_aterbetalda: summorna per rad och betalningens. */
  skriv(pi: string, perRad: Record<string, number>, aterbetalt: number): Promise<void>;
};

/**
 * Raderna skrivs om ur Stripes lista efter en återbetalning, som webhooken
 * gör när charge.refunded kommer: stripe-aterbetalning efter en rad, och
 * stripe-reservation efter ett kortare pass i en betalning för flera pass.
 * Summor per rad, så att samma sak två gånger inte ändrar något, och
 * databasen skriver passen ur sina rader. Svarar false när betalningen
 * inte har rader att skriva (ett pass eller ett köp för sig): då skriver
 * anroparen som förut.
 */
export async function skrivRaderna(pi: string, charge: string, io: RaderIo): Promise<boolean> {
  const b = await io.betalning(pi);
  if (!b || !(arFleraPass(b) || b.rader.some((r) => r.typ === 'syskon'))) return false;
  const [lista, c] = await Promise.all([io.lista(charge), io.charge(charge)]);
  const f = raderUrStripe(b, b.rader, lista, c.aterbetalt, c.totalt);
  await io.skriv(pi, f.perRad, c.aterbetalt);
  return true;
}

/**
 * RaderIo med tjänstekontots klient och Stripes API, för stripe-aterbetalning
 * och stripe-reservation. Varje fel kastas: återbetalningen är gjord, och
 * webhooken skriver samma sak när charge.refunded kommer.
 */
export function raderIo(
  k: SupabaseClient,
  stripe: (metod: 'GET', vag: string) => Promise<Record<string, unknown>>,
): RaderIo {
  return {
    betalning: async (pi) => {
      const { data: b, error } = await k.from('betalningar')
        .select('id, typ, booking_id, utan_rad').eq('stripe_payment_intent', pi).maybeSingle();
      if (error) throw new Error('betalningar: ' + error.message);
      if (!b) return null;
      const { data: rader, error: rfel } = await k.from('betalningsrader')
        .select('id, typ, belopp_ore, klippkort_id, booking_id').eq('betalning_id', b.id);
      if (rfel) throw new Error('betalningsrader: ' + rfel.message);
      return { typ: String(b.typ), booking_id: b.booking_id ?? null, utan_rad: !!b.utan_rad,
               rader: (rader ?? []) as Betalningsrad[] };
    },
    lista: async (charge) => {
      const l = await stripe('GET', `/v1/refunds?charge=${encodeURIComponent(charge)}&limit=100`);
      return (Array.isArray(l.data) ? l.data : []) as Aterbetalning[];
    },
    charge: async (charge) => {
      const c = await stripe('GET', `/v1/charges/${charge}`);
      const dragen = typeof c.amount_captured === 'number' && c.amount_captured > 0 ? c.amount_captured : c.amount;
      return { aterbetalt: Number(c.amount_refunded ?? 0), totalt: Number(dragen ?? 0) };
    },
    skriv: async (pi, perRad, aterbetalt) => {
      const { error } = await k.rpc('betalningsrader_aterbetalda', { p_pi: pi, p_per_rad: perRad, p_totalt: aterbetalt });
      if (error) throw new Error('betalningsrader_aterbetalda: ' + error.message);
    },
  };
}
