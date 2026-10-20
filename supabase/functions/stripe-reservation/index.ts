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
import { StripeError, v1 } from '../_delad/stripe.ts';
import { passpris, standardTjanst, type Tjanst } from '../_delad/pris.ts';
import type { Passpris } from '../_delad/kortreservation.ts';
import { gorRad, type Pass, type Rad, type Reservationslage } from '../_delad/reservationen.ts';

/** Rader per väckning. Resten tas om tio minuter; en körning ska hinna klart långt före pg_nets 60 sekunder. */
const GRANS = 20;

/* Vad som görs med en rad står i _delad/reservationen.ts (2026-10-21), med
   Stripe och skrivningen inskickade, så att det går att pröva utan nät
   (reservationen_test.ts). Här läses listan och det raderna behöver. */

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
      .select('id, parent_id, tutor_id, subject, wanted_date, wanted_time, duration_min, tjanst, antal_barn, rabatt_ore, timpris_ore, extra_ore, status')
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
  const skriv = async (pass: string, lage: Reservationslage,
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

  const sammanhang = {
    stripe: v1,
    skriv,
    andradNu,
    andrad: (pass: string) => andrad.get(pass) ?? null,
    pris: passetsPris,
    familjensMin,
    epost: (familj: string) => epost.get(familj) ?? undefined,
  };

  for (const r of lista) {
    const p = passen.get(r.booking_id);
    let resultat: string;
    try {
      resultat = p ? await gorRad(r, p, sammanhang) : 'passet saknas';
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
