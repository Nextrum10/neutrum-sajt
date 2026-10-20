// ============================================================
// NEXTRUM — det stripe-reservation gör med en rad (2026-10-21)
//
// Ur stripe-reservation, oförändrat i sak, så att reservationen,
// dragningen, släppet, dragningen utan reservation och ett nekat kort går
// att pröva utan nät och utan databas (reservationen_test.ts). Varför det
// ser ut som det gör står i funktionens filhuvud och i
// minne/betalning.md (Kortet reserveras vid bokningen).
//
// STRIPE OCH DATABASEN KOMMER IN UTIFRÅN (Sammanhang): funktionen skickar
// in v1() och kortreservation_skriv, proven en falsk Stripe och en lista.
//
// 48-TIMMARSFÖNSTRET (2026-10-21). Databasen väljer vad som ska göras
// (kortreservation_att_gora: ett bekräftat pass reserveras när det börjar
// inom 48 timmar, intern.passets_start i Stockholms tid). Funktionen
// prövar fönstret en gång till innan den reserverar
// (reservationsfonster, RESERVATION_TIMMAR): en reservation som görs för
// tidigt hinner Stripe släppa före passet. De två ändras tillsammans.
// ============================================================

import type { StripeAnrop } from './aterbetalning.ts';
import { arStripeId, descriptor, StripeError, VALUTA } from './stripe.ts';
import { radtext } from './pris.ts';
import {
  dragning, KORTRESERVATION, nekadKod, nyckelFor, type Passpris, reservationensPass, reservationsbelopp,
  reserveradTill,
} from './kortreservation.ts';

/** Timmar före passet då kortet reserveras. Samma som kortreservation_att_gora i databasen. */
export const RESERVATION_TIMMAR = 48;

export type Atgard = 'reservera' | 'dra' | 'debitera' | 'slapp';

export type Rad = {
  booking_id: string;
  parent_id: string;
  atgard: Atgard;
  lage: string;
  stripe_reservation: string | null;
  reserverat_ore: number | null;
  stripe_kund: string | null;
  stripe_metod: string | null;
};

export type Pass = {
  id: string;
  parent_id: string | null;
  tutor_id: string | null;
  subject: string | null;
  wanted_date: string;
  wanted_time?: string | null;
  duration_min: number | null;
  tjanst: string | null;
  antal_barn: number | null;
  rabatt_ore: number | null;
  timpris_ore: number | null;
  extra_ore: number | null;
  status: string;
};

export type PI = {
  id?: string;
  status?: string;
  amount_capturable?: number;
  amount_received?: number;
  latest_charge?: unknown;
  metadata?: Record<string, string>;
};

export type Reservationslage = 'reserverad' | 'dragen' | 'slappt' | 'utgangen' | 'misslyckad';

export type Sammanhang = {
  stripe: StripeAnrop;
  /** kortreservation_skriv: svarar med det läge raden fick. */
  skriv(pass: string, lage: Reservationslage, pi?: string | null, belopp?: number | null, till?: string | null,
    felkod?: string | null): Promise<string>;
  /** Radens ändringstid nu, efter en skrivning: nyckeln ska följa läget. */
  andradNu(pass: string): Promise<string | null>;
  /** Radens ändringstid när listan lästes. */
  andrad(pass: string): string | null;
  /** Passets pris, fryst vid bokningen; null när det inte går att räkna. */
  pris(p: Pass): Passpris | null;
  /** Tiden familjen betalar för ett genomfört pass. */
  familjensMin(p: Pass): number;
  /** Familjens adress för kvittot. */
  epost(familj: string): string | undefined;
  /** Klockan; proven sätter den. */
  nu?: () => Date;
};

/**
 * Passets start i Stockholms tid som en tidpunkt, som intern.passets_start:
 * datumet och tiden (ingen tid är midnatt). Null för ett datum i fel form.
 */
export function passetsStart(datum: string, tid: string | null | undefined): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(datum ?? ''));
  const t = /^(\d{2}):(\d{2})/.exec(String(tid ?? '00:00'));
  if (!d || !t) return null;
  const gissning = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]);
  // Stockholms förskjutning från UTC vid en tidpunkt (en eller två timmar).
  const forskjutning = (ms: number): number => {
    const delar = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Stockholm', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(ms));
    const v = (typ: string) => Number(delar.find((x) => x.type === typ)?.value);
    return Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute')) - ms;
  };
  // Två varv, för dagarna då klockan ställs om.
  const forsta = gissning - forskjutning(gissning);
  return new Date(gissning - forskjutning(forsta));
}

/**
 * Ska passet reserveras nu? Ja när det börjar inom RESERVATION_TIMMAR
 * (exakt 48 timmar före räknas), också när det redan har börjat; annars
 * väntar reservationen.
 */
export function reservationsfonster(start: Date, nu: Date, timmar = RESERVATION_TIMMAR): 'vanta' | 'reservera' {
  return start.getTime() - nu.getTime() <= timmar * 3600_000 ? 'reservera' : 'vanta';
}

/** Gör det databasen sagt för en rad. Svarar med en kort text för funktionens räkning. */
export async function gorRad(r: Rad, p: Pass, s: Sammanhang): Promise<string> {
  /* Släpper en reservation. En som redan är släppt, dragen eller utgången
     går inte att släppa, och det felet är väntat: läget hos Stripe avgör.
     Orsaken är vår, så att webhooken skiljer vårt släpp från Stripes. */
  const slapp = async (pi: string, orsak: 'requested_by_customer' | 'duplicate' | 'abandoned'): Promise<PI> => {
    try {
      return await s.stripe('POST', `/v1/payment_intents/${pi}/cancel`, { cancellation_reason: orsak },
        `nextrum-slapp-${pi}`) as PI;
    } catch (e) {
      if (!(e instanceof StripeError)) throw e;
      return await s.stripe('GET', `/v1/payment_intents/${pi}`) as PI;
    }
  };

  /* Drar en reservation: beloppet och minuterna betalningen avser, som
     webhooken skriver på passet. Redan dragen eller släppt av Stripe innan
     vi hann: läget hos Stripe avgör. */
  const fanga = async (pass: string, pi: string, belopp: number, minuter: number): Promise<string> => {
    let svar: PI;
    try {
      svar = await s.stripe('POST', `/v1/payment_intents/${pi}/capture`,
        { amount_to_capture: belopp, metadata: { minuter: String(minuter) } }, `nextrum-dra-${pi}`) as PI;
    } catch (e) {
      if (!(e instanceof StripeError)) throw e;
      svar = await s.stripe('GET', `/v1/payment_intents/${pi}`) as PI;
    }
    if (svar.status === 'succeeded') {
      await s.skriv(pass, 'dragen', pi, Number(svar.amount_received) || belopp);
      return 'dragen';
    }
    if (svar.status === 'canceled') {
      // Stripe släppte den: nästa körning drar utan reservation.
      await s.skriv(pass, 'utgangen', pi);
      return 'utgången';
    }
    return `står som ${svar.status ?? 'okänt'}`;
  };

  /* Har kunden redan ett PaymentIntent för passet som gäller? Se
     stripe-reservations filhuvud: två dragningar får aldrig hända. */
  const befintlig = async (kund: string, pass: string): Promise<PI | null> => {
    const svar = await s.stripe('GET', `/v1/payment_intents?customer=${kund}&limit=20&expand[]=data.latest_charge`) as
      { data?: PI[] };
    const egna = (svar.data ?? []).filter((x) => reservationensPass(x.metadata) === pass);
    return egna.find((x) => x.status === 'succeeded')
      ?? egna.find((x) => x.status === 'processing')
      ?? egna.find((x) => x.status === 'requires_capture')
      ?? null;
  };

  /* Ett kort som nekas, eller en bank som vill att familjen bekräftar,
     står på reservationen. Stripe nere eller ett fel i vårt anrop gör det
     inte: felet kastas, och jobbet försöker igen om tio minuter. */
  const nekad = async (pass: string, e: unknown): Promise<string> => {
    const kod = e instanceof StripeError ? nekadKod(e.fel) : null;
    if (!kod) throw e;
    await s.skriv(pass, 'misslyckad', null, null, null, kod);
    return 'nekad';
  };

  const kortetsParametrar = () => ({
    currency: VALUTA,
    customer: r.stripe_kund,
    payment_method: r.stripe_metod,
    // Bara kort, och utan familjen: kortet sparades för det (Checkout i läget setup).
    payment_method_types: ['card'],
    confirm: true,
    off_session: true,
    statement_descriptor_suffix: descriptor(String(p.subject ?? 'Laxhjalp')),
    // Kvittot till familjens adress, som i kassan. I testläge skickar Stripe inga.
    receipt_email: s.epost(r.parent_id) ?? undefined,
  });

  switch (r.atgard) {
    case 'slapp': {
      if (!arStripeId(r.stripe_reservation, 'pi')) return 'utan reservation';
      const pi = await slapp(r.stripe_reservation, 'requested_by_customer');
      if (pi.status === 'succeeded') {
        await s.skriv(p.id, 'dragen', r.stripe_reservation, Number(pi.amount_received) || null);
        return 'var redan dragen';
      }
      if (pi.status !== 'canceled') return `står som ${pi.status ?? 'okänt'}`;
      // 'vald' när passet flyttats och ska reserveras igen före den nya tiden.
      const blev = await s.skriv(p.id, 'slappt', r.stripe_reservation);
      return blev === 'vald' ? 'släppt, reserveras igen' : 'släppt';
    }

    case 'dra': {
      if (!arStripeId(r.stripe_reservation, 'pi') || !(Number(r.reserverat_ore) > 0)) return 'utan reservation';
      const pris = s.pris(p);
      if (!pris) return 'utan pris';
      const d = dragning({
        familjensMin: s.familjensMin(p), bokadeMin: Number(p.duration_min || 60),
        reserveratOre: Number(r.reserverat_ore), pris,
      });
      if (d.belopp <= 0) {
        // Rabatten täcker den hållna tiden: inget att dra.
        const pi = await slapp(r.stripe_reservation, 'requested_by_customer');
        if (pi.status === 'canceled') await s.skriv(p.id, 'slappt', r.stripe_reservation);
        return 'inget att dra, släppt';
      }
      return await fanga(p.id, r.stripe_reservation, d.belopp, d.minuter);
    }

    case 'reservera': {
      if (!arStripeId(r.stripe_kund, 'cus') || !arStripeId(r.stripe_metod, 'pm')) return 'utan kort';
      // Fönstret en gång till (filhuvudet). Ett pass utan läsbar start prövas inte här.
      const start = passetsStart(p.wanted_date, p.wanted_time);
      if (start && reservationsfonster(start, s.nu ? s.nu() : new Date()) === 'vanta') return 'för tidigt';
      const pris = s.pris(p);
      if (!pris) return 'utan pris';
      const belopp = reservationsbelopp(Number(p.duration_min || 60), pris);
      if (!(belopp > 0)) return 'kostar inget';

      let pi = await befintlig(r.stripe_kund, p.id);
      if (pi?.status === 'succeeded' || pi?.status === 'processing') {
        // Dragen förut (en körning som föll): webhooken skriver betalningen.
        if (pi.status === 'succeeded') await s.skriv(p.id, 'dragen', String(pi.id), Number(pi.amount_received) || null);
        return 'var redan dragen';
      }
      if (!pi) {
        try {
          pi = await s.stripe('POST', '/v1/payment_intents', {
            ...kortetsParametrar(),
            amount: belopp,
            capture_method: 'manual',
            description: `${radtext(p.subject, String(p.wanted_date))}, reserverat`,
            metadata: { [KORTRESERVATION]: p.id, tutor_id: p.tutor_id ?? undefined },
            expand: ['latest_charge'],
          }, nyckelFor('reservera', p.id, s.andrad(p.id))) as PI;
        } catch (e) {
          return await nekad(p.id, e);
        }
      }
      if (pi.status !== 'requires_capture' || !arStripeId(pi.id, 'pi')) {
        // Banken vill att familjen bekräftar (requires_action), och utan familjen går det inte.
        if (arStripeId(pi.id, 'pi') && pi.status !== 'canceled') await slapp(pi.id, 'abandoned');
        await s.skriv(p.id, 'misslyckad', null, null, null,
          pi.status === 'requires_action' ? 'authentication_required' : 'nekat');
        return 'nekad';
      }
      const blev = await s.skriv(p.id, 'reserverad', pi.id, Number(pi.amount_capturable) || belopp,
        reserveradTill(pi.latest_charge));
      if (blev === 'saknas' || blev === 'avvisad') {
        // Familjen valde bort kortet medan Stripe svarade, eller raden har redan en annan.
        await slapp(pi.id, 'duplicate');
        return 'över, släppt';
      }
      return 'reserverad';
    }

    case 'debitera': {
      if (!arStripeId(r.stripe_kund, 'cus') || !arStripeId(r.stripe_metod, 'pm')) return 'utan kort';
      const pris = s.pris(p);
      if (!pris) return 'utan pris';
      const bokade = Number(p.duration_min || 60);

      // En reservation som Stripe inte släppt än dras hellre: annars hölls två belopp för samma pass.
      const pi = await befintlig(r.stripe_kund, p.id);
      if (pi?.status === 'succeeded') {
        await s.skriv(p.id, 'dragen', String(pi.id), Number(pi.amount_received) || null);
        return 'var redan dragen';
      }
      if (pi?.status === 'processing') return 'pågår';
      if (pi?.status === 'requires_capture' && arStripeId(pi.id, 'pi')) {
        const d = dragning({
          familjensMin: s.familjensMin(p), bokadeMin: bokade,
          reserveratOre: Number(pi.amount_capturable) || Number(r.reserverat_ore) || 0, pris,
        });
        if (d.belopp > 0) return await fanga(p.id, pi.id, d.belopp, d.minuter);
        await slapp(pi.id, 'requested_by_customer');
        return 'inget att dra, släppt';
      }

      // Ingen reservation gäller. Står raden ändå som reserverad har Stripe
      // släppt den: läget skrivs först, så att ett nej kan stå på raden.
      let nyckelTid = s.andrad(p.id);
      if (r.lage === 'reserverad' && arStripeId(r.stripe_reservation, 'pi')) {
        await s.skriv(p.id, 'utgangen', r.stripe_reservation);
        nyckelTid = await s.andradNu(p.id);
      }
      const d = dragning({ familjensMin: s.familjensMin(p), bokadeMin: bokade, reserveratOre: Number.MAX_SAFE_INTEGER, pris });
      if (!(d.belopp > 0)) return 'kostar inget';
      let ny: PI;
      try {
        ny = await s.stripe('POST', '/v1/payment_intents', {
          ...kortetsParametrar(),
          amount: d.belopp,
          description: radtext(p.subject, String(p.wanted_date)),
          metadata: { [KORTRESERVATION]: p.id, minuter: String(d.minuter), tutor_id: p.tutor_id ?? undefined },
        }, nyckelFor('debitera', p.id, nyckelTid)) as PI;
      } catch (e) {
        return await nekad(p.id, e);
      }
      if (ny.status === 'succeeded' && arStripeId(ny.id, 'pi')) {
        await s.skriv(p.id, 'dragen', ny.id, Number(ny.amount_received) || d.belopp);
        return 'dragen';
      }
      if (ny.status === 'processing') return 'pågår';
      if (arStripeId(ny.id, 'pi') && ny.status !== 'canceled') await slapp(ny.id, 'abandoned');
      await s.skriv(p.id, 'misslyckad', null, null, null,
        ny.status === 'requires_action' ? 'authentication_required' : 'nekat');
      return 'nekad';
    }
  }
}
