// ============================================================
// NEXTRUM — stripe-reservation (kortet_reserveras, 2026-10-13)
//
// Reserverar, drar och släpper pengar på familjens sparade kort. Väcks av
// jobbet kortreservation (pg_cron var tionde minut, genom
// intern.kortreservation_vack) när kortreservation_att_gora() har något:
//
//   reservera  ett bekräftat pass som börjar inom 48 timmar: priset för
//              den bokade tiden hålls på kortet (capture_method manual),
//              utan att familjen är med (off_session)
//   dra        rapporten finns: priset för den hållna tiden dras, högst det
//              reserverade, och resten släpps (amount_to_capture)
//   debitera   rapporten finns men ingen reservation gäller (den hann inte
//              göras, eller Stripe släppte den): en vanlig dragning
//   slapp      reservationen ska bort (avbokat, betalt på annat sätt, kortet
//              bortvalt eller borttaget, passet flyttat)
//
// Leo 2026-10-13: "när passet har rapporterats kan pengarna dras". Varför
// två dagar före passet: Stripe släpper en reservation som inte dragits,
// för Visa efter fyra dygn och arton timmar när familjen inte är med.
// Gränsen läses ur chargen (capture_before), aldrig ur en tabell här.
// Designen står i minne/betalning.md (Kortet reserveras vid bokningen).
//
//
// FUNKTIONEN SÄTTER ALDRIG ETT PASS SOM BETALT
//
// Den skriver bara reservationens läge (kortreservation_skriv). Att passet
// är betalt, och med hur mycket, skriver stripe-webhook ur
// payment_intent.succeeded, som för kassan: bara webhooken skriver
// betald och betalt_ore. Minuterna betalningen avser följer med i
// metadata, så att webhooken kan skriva dem (stripe_minuter).
//
//
// TVÅ DRAGNINGAR FÅR ALDRIG HÄNDA
//
// Varje anrop som skapar ett PaymentIntent har en idempotensnyckel med
// radens ändringstid, och FÖRST frågas Stripe om kunden redan har ett
// PaymentIntent för passet: föll en körning mellan Stripes svar och vår
// skrivning används det i stället för att ett nytt skapas. Listan är
// kundens, i realtid; Stripes sökning släpar efter.
//
// SÄKERHET: samma delade hemlighet som notis-ko, i x-nextrum-notis,
// jämförd i konstant tid mot notis_konfig. verify_jwt är av
// (config.toml) eftersom anroparen är databasen. Funktionerna den anropar
// kan bara service_role köra. Svaret hamnar i net._http_response, som
// flera roller kan läsa: där står bara antal, aldrig ett id eller ett fel
// från Stripe. De står i funktionens logg.
// ============================================================

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
import { CORS, db, hemlighetOk, json } from '../_delad/notis.ts';
import { preflight } from '../_delad/http.ts';
import { arStripeId, descriptor, StripeError, v1, VALUTA } from '../_delad/stripe.ts';
import { passpris, radtext, standardTjanst, type Tjanst } from '../_delad/pris.ts';
import {
  dragning, KORTRESERVATION, nekadKod, nyckelFor, type Passpris, reservationensPass, reservationsbelopp,
  reserveradTill,
} from '../_delad/kortreservation.ts';

/** Rader per väckning. Resten tas om tio minuter; en körning ska hinna klart långt före pg_nets 60 sekunder. */
const GRANS = 20;

type Atgard = 'reservera' | 'dra' | 'debitera' | 'slapp';

type Rad = {
  booking_id: string;
  parent_id: string;
  atgard: Atgard;
  lage: string;
  stripe_reservation: string | null;
  reserverat_ore: number | null;
  stripe_kund: string | null;
  stripe_metod: string | null;
};

type Pass = {
  id: string;
  parent_id: string | null;
  tutor_id: string | null;
  subject: string | null;
  wanted_date: string;
  duration_min: number | null;
  tjanst: string | null;
  antal_barn: number | null;
  rabatt_ore: number | null;
  timpris_ore: number | null;
  extra_ore: number | null;
  status: string;
};

type PI = {
  id?: string;
  status?: string;
  amount_capturable?: number;
  amount_received?: number;
  latest_charge?: unknown;
  metadata?: Record<string, string>;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(CORS);
  if (req.method !== 'POST') return json({ error: 'Bara POST.' }, 405);

  let klient: SupabaseClient;
  try {
    klient = db();
    if (!await hemlighetOk(req, klient)) return json({ error: 'Fel eller saknad hemlighet.' }, 401);
  } catch {
    console.error('stripe-reservation: hemligheten gick inte att pröva');
    return json({ error: 'Tjänsten är inte tillgänglig just nu.' }, 500);
  }
  // Före listan: utan nyckel görs ingenting, och raderna står kvar till nästa gång.
  if (!Deno.env.get('STRIPE_SECRET_KEY')) {
    console.error('stripe-reservation: STRIPE_SECRET_KEY saknas. Inget gjordes.');
    return json({ error: 'Stripe är inte inställt.' }, 500);
  }

  const { data: rader, error: listfel } = await klient.rpc('kortreservation_att_gora', { p_grans: GRANS });
  if (listfel) {
    console.error('stripe-reservation: listan gick inte att läsa', listfel.message);
    return json({ error: 'Listan gick inte att läsa.' }, 500);
  }
  const lista = (rader ?? []) as Rad[];
  const utfall: Record<string, number> = {};
  if (!lista.length) return json({ ok: true, utfall }, 200);

  // ---------- passen, priserna och radernas ändringstid, en gång ----------
  const ids = [...new Set(lista.map((r) => r.booking_id))];
  const familjer = [...new Set(lista.map((r) => r.parent_id))];
  const [lPass, lVal, lUnderlag, lKatalog, lPris, lProf] = await Promise.all([
    klient.from('bookings')
      .select('id, parent_id, tutor_id, subject, wanted_date, duration_min, tjanst, antal_barn, rabatt_ore, timpris_ore, extra_ore, status')
      .in('id', ids),
    klient.from('kortreservationer').select('booking_id, andrad').in('booking_id', ids),
    // Bara genomförda pass står i passunderlag: den hållna tiden och timbankens övertid.
    klient.from('passunderlag').select('id, debiterade_min, timbank_min').in('id', ids),
    klient.from('tjanster').select('kod, aktiv, for_kund, ordning, pris_per_timme_ore, extra_personer_ore, ersattning_per_timme_ore, rut_berattigad, rut_procent'),
    klient.from('prissattning').select('pris_per_timme_ore').maybeSingle(),
    klient.from('profiles').select('id, email').in('id', familjer),
  ]);
  const lasfel = [lPass, lVal, lUnderlag, lKatalog, lPris, lProf].find((x) => x.error)?.error;
  if (lasfel) {
    console.error('stripe-reservation: passen gick inte att läsa', lasfel.message);
    return json({ error: 'Passen gick inte att läsa.' }, 500);
  }
  const passen = new Map(((lPass.data ?? []) as Pass[]).map((p) => [p.id, p]));
  const andrad = new Map(((lVal.data ?? []) as { booking_id: string; andrad: string }[]).map((v) => [v.booking_id, v.andrad]));
  const underlag = new Map(((lUnderlag.data ?? []) as { id: string; debiterade_min: number | null; timbank_min: number | null }[])
    .map((u) => [u.id, u]));
  const tjanster = (lKatalog.data ?? []) as Tjanst[];
  const reservOre = Number((lPris.data as { pris_per_timme_ore?: number } | null)?.pris_per_timme_ore ?? 0);
  const epost = new Map(((lProf.data ?? []) as { id: string; email: string | null }[]).map((p) => [p.id, p.email]));

  /** Passets pris, fryst vid bokningen (Fas 19.5); tjänstens är reserven, som i kassan. */
  const passetsPris = (p: Pass): Passpris | null => {
    const tjanst = tjanster.find((t) => t.kod === p.tjanst) ?? standardTjanst(tjanster) ?? undefined;
    const { timme, extra } = passpris(p, tjanst, reservOre);
    if (!timme) return null;
    return { timprisOre: timme, extraOre: extra, barn: Math.max(1, Number(p.antal_barn || 1)), rabattOre: Number(p.rabatt_ore || 0) };
  };

  /** Tiden familjen betalar för ett genomfört pass: den hållna, minus övertiden timbanken tog. */
  const familjensMin = (p: Pass): number => {
    const u = underlag.get(p.id);
    return Number(u?.debiterade_min || p.duration_min || 60) - Number(u?.timbank_min || 0);
  };

  // ---------- skrivningarna ----------
  const skriv = async (pass: string, lage: 'reserverad' | 'dragen' | 'slappt' | 'utgangen' | 'misslyckad',
    pi: string | null = null, belopp: number | null = null, till: string | null = null, felkod: string | null = null,
  ): Promise<string> => {
    const { data, error } = await klient.rpc('kortreservation_skriv', {
      p_bokning: pass, p_lage: lage, p_pi: pi, p_belopp: belopp, p_till: till, p_fel: felkod,
    });
    if (error) throw new Error('kortreservation_skriv: ' + error.message);
    return String(data ?? '');
  };

  /** Radens ändringstid nu, efter en skrivning: nyckeln ska följa läget. */
  const andradNu = async (pass: string): Promise<string | null> => {
    const { data, error } = await klient.from('kortreservationer').select('andrad').eq('booking_id', pass).maybeSingle();
    if (error) throw new Error('kortreservationer: ' + error.message);
    return (data as { andrad?: string } | null)?.andrad ?? null;
  };

  // ---------- Stripe ----------
  /* Släpper en reservation. En som redan är släppt, dragen eller utgången
     går inte att släppa, och det felet är väntat: läget hos Stripe avgör.
     Orsaken är vår, så att webhooken skiljer vårt släpp från Stripes. */
  const slapp = async (pi: string, orsak: 'requested_by_customer' | 'duplicate' | 'abandoned'): Promise<PI> => {
    try {
      return await v1('POST', `/v1/payment_intents/${pi}/cancel`, { cancellation_reason: orsak }, `nextrum-slapp-${pi}`) as PI;
    } catch (e) {
      if (!(e instanceof StripeError)) throw e;
      return await v1('GET', `/v1/payment_intents/${pi}`) as PI;
    }
  };

  /* Drar en reservation: beloppet och minuterna betalningen avser, som
     webhooken skriver på passet. Redan dragen eller släppt av Stripe innan
     vi hann: läget hos Stripe avgör. */
  const fanga = async (pass: string, pi: string, belopp: number, minuter: number): Promise<string> => {
    let svar: PI;
    try {
      svar = await v1('POST', `/v1/payment_intents/${pi}/capture`,
        { amount_to_capture: belopp, metadata: { minuter: String(minuter) } }, `nextrum-dra-${pi}`) as PI;
    } catch (e) {
      if (!(e instanceof StripeError)) throw e;
      svar = await v1('GET', `/v1/payment_intents/${pi}`) as PI;
    }
    if (svar.status === 'succeeded') {
      await skriv(pass, 'dragen', pi, Number(svar.amount_received) || belopp);
      return 'dragen';
    }
    if (svar.status === 'canceled') {
      // Stripe släppte den: nästa körning drar utan reservation.
      await skriv(pass, 'utgangen', pi);
      return 'utgången';
    }
    return `står som ${svar.status ?? 'okänt'}`;
  };

  /* Har kunden redan ett PaymentIntent för passet som gäller? Se filhuvudet. */
  const befintlig = async (kund: string, pass: string): Promise<PI | null> => {
    const svar = await v1('GET', `/v1/payment_intents?customer=${kund}&limit=20&expand[]=data.latest_charge`) as { data?: PI[] };
    const egna = (svar.data ?? []).filter((x) => reservationensPass(x.metadata) === pass);
    return egna.find((x) => x.status === 'succeeded')
      ?? egna.find((x) => x.status === 'processing')
      ?? egna.find((x) => x.status === 'requires_capture')
      ?? null;
  };

  /* Ett kort som nekas, eller en bank som vill att familjen bekräftar,
     står på reservationen, och familjen får notisen kort_nekat. Stripe nere
     eller ett fel i vårt anrop gör det inte: felet kastas, och jobbet
     försöker igen om tio minuter. */
  const nekad = async (pass: string, e: unknown): Promise<string> => {
    const kod = e instanceof StripeError ? nekadKod(e.fel) : null;
    if (!kod) throw e;
    await skriv(pass, 'misslyckad', null, null, null, kod);
    return 'nekad';
  };

  const kortetsParametrar = (r: Rad, p: Pass) => ({
    currency: VALUTA,
    customer: r.stripe_kund,
    payment_method: r.stripe_metod,
    // Bara kort, och utan familjen: kortet sparades för det (Checkout i läget setup).
    payment_method_types: ['card'],
    confirm: true,
    off_session: true,
    statement_descriptor_suffix: descriptor(String(p.subject ?? 'Laxhjalp')),
    // Kvittot till familjens adress, som i kassan. I testläge skickar Stripe inga.
    receipt_email: epost.get(r.parent_id) ?? undefined,
  });

  // ---------- åtgärderna ----------
  const gor = async (r: Rad, p: Pass): Promise<string> => {
    switch (r.atgard) {
      case 'slapp': {
        if (!arStripeId(r.stripe_reservation, 'pi')) return 'utan reservation';
        const pi = await slapp(r.stripe_reservation, 'requested_by_customer');
        if (pi.status === 'succeeded') {
          await skriv(p.id, 'dragen', r.stripe_reservation, Number(pi.amount_received) || null);
          return 'var redan dragen';
        }
        if (pi.status !== 'canceled') return `står som ${pi.status ?? 'okänt'}`;
        // 'vald' när passet flyttats och ska reserveras igen före den nya tiden.
        const blev = await skriv(p.id, 'slappt', r.stripe_reservation);
        return blev === 'vald' ? 'släppt, reserveras igen' : 'släppt';
      }

      case 'dra': {
        if (!arStripeId(r.stripe_reservation, 'pi') || !(Number(r.reserverat_ore) > 0)) return 'utan reservation';
        const pris = passetsPris(p);
        if (!pris) return 'utan pris';
        const d = dragning({
          familjensMin: familjensMin(p), bokadeMin: Number(p.duration_min || 60),
          reserveratOre: Number(r.reserverat_ore), pris,
        });
        if (d.belopp <= 0) {
          // Rabatten täcker den hållna tiden: inget att dra.
          const pi = await slapp(r.stripe_reservation, 'requested_by_customer');
          if (pi.status === 'canceled') await skriv(p.id, 'slappt', r.stripe_reservation);
          return 'inget att dra, släppt';
        }
        return await fanga(p.id, r.stripe_reservation, d.belopp, d.minuter);
      }

      case 'reservera': {
        if (!arStripeId(r.stripe_kund, 'cus') || !arStripeId(r.stripe_metod, 'pm')) return 'utan kort';
        const pris = passetsPris(p);
        if (!pris) return 'utan pris';
        const belopp = reservationsbelopp(Number(p.duration_min || 60), pris);
        if (!(belopp > 0)) return 'kostar inget';

        let pi = await befintlig(r.stripe_kund, p.id);
        if (pi?.status === 'succeeded' || pi?.status === 'processing') {
          // Dragen förut (en körning som föll): webhooken skriver betalningen.
          if (pi.status === 'succeeded') await skriv(p.id, 'dragen', String(pi.id), Number(pi.amount_received) || null);
          return 'var redan dragen';
        }
        if (!pi) {
          try {
            pi = await v1('POST', '/v1/payment_intents', {
              ...kortetsParametrar(r, p),
              amount: belopp,
              capture_method: 'manual',
              description: `${radtext(p.subject, String(p.wanted_date))}, reserverat`,
              metadata: { [KORTRESERVATION]: p.id, tutor_id: p.tutor_id ?? undefined },
              expand: ['latest_charge'],
            }, nyckelFor('reservera', p.id, andrad.get(p.id) ?? null)) as PI;
          } catch (e) {
            return await nekad(p.id, e);
          }
        }
        if (pi.status !== 'requires_capture' || !arStripeId(pi.id, 'pi')) {
          // Banken vill att familjen bekräftar (requires_action), och utan familjen går det inte.
          if (arStripeId(pi.id, 'pi') && pi.status !== 'canceled') await slapp(pi.id, 'abandoned');
          await skriv(p.id, 'misslyckad', null, null, null,
            pi.status === 'requires_action' ? 'authentication_required' : 'nekat');
          return 'nekad';
        }
        const blev = await skriv(p.id, 'reserverad', pi.id, Number(pi.amount_capturable) || belopp,
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
        const pris = passetsPris(p);
        if (!pris) return 'utan pris';
        const bokade = Number(p.duration_min || 60);

        // En reservation som Stripe inte släppt än dras hellre: annars hölls två belopp för samma pass.
        const pi = await befintlig(r.stripe_kund, p.id);
        if (pi?.status === 'succeeded') {
          await skriv(p.id, 'dragen', String(pi.id), Number(pi.amount_received) || null);
          return 'var redan dragen';
        }
        if (pi?.status === 'processing') return 'pågår';
        if (pi?.status === 'requires_capture' && arStripeId(pi.id, 'pi')) {
          const d = dragning({
            familjensMin: familjensMin(p), bokadeMin: bokade,
            reserveratOre: Number(pi.amount_capturable) || Number(r.reserverat_ore) || 0, pris,
          });
          if (d.belopp > 0) return await fanga(p.id, pi.id, d.belopp, d.minuter);
          await slapp(pi.id, 'requested_by_customer');
          return 'inget att dra, släppt';
        }

        // Ingen reservation gäller. Står raden ändå som reserverad har Stripe
        // släppt den: läget skrivs först, så att ett nej kan stå på raden.
        let nyckelTid = andrad.get(p.id) ?? null;
        if (r.lage === 'reserverad' && arStripeId(r.stripe_reservation, 'pi')) {
          await skriv(p.id, 'utgangen', r.stripe_reservation);
          nyckelTid = await andradNu(p.id);
        }
        const d = dragning({ familjensMin: familjensMin(p), bokadeMin: bokade, reserveratOre: Number.MAX_SAFE_INTEGER, pris });
        if (!(d.belopp > 0)) return 'kostar inget';
        let ny: PI;
        try {
          ny = await v1('POST', '/v1/payment_intents', {
            ...kortetsParametrar(r, p),
            amount: d.belopp,
            description: radtext(p.subject, String(p.wanted_date)),
            metadata: { [KORTRESERVATION]: p.id, minuter: String(d.minuter), tutor_id: p.tutor_id ?? undefined },
          }, nyckelFor('debitera', p.id, nyckelTid)) as PI;
        } catch (e) {
          return await nekad(p.id, e);
        }
        if (ny.status === 'succeeded' && arStripeId(ny.id, 'pi')) {
          await skriv(p.id, 'dragen', ny.id, Number(ny.amount_received) || d.belopp);
          return 'dragen';
        }
        if (ny.status === 'processing') return 'pågår';
        if (arStripeId(ny.id, 'pi') && ny.status !== 'canceled') await slapp(ny.id, 'abandoned');
        await skriv(p.id, 'misslyckad', null, null, null,
          ny.status === 'requires_action' ? 'authentication_required' : 'nekat');
        return 'nekad';
      }
    }
  };

  for (const r of lista) {
    const p = passen.get(r.booking_id);
    let resultat: string;
    try {
      resultat = p ? await gor(r, p) : 'passet saknas';
    } catch (e) {
      // Id och Stripes kod i loggen, aldrig i svaret.
      const vad = e instanceof StripeError ? `Stripe ${e.fel.status} ${e.fel.typ} ${e.fel.kod}` : (e as Error)?.message ?? String(e);
      console.error('stripe-reservation:', r.atgard, r.booking_id, vad);
      resultat = 'fel';
    }
    const k = `${r.atgard}: ${resultat}`;
    utfall[k] = (utfall[k] ?? 0) + 1;
  }
  return json({ ok: true, utfall }, 200);
});
