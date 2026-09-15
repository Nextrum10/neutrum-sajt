// ============================================================
// NEXTRUM — Edge Function: fakturering
//
// Kör en gång i månaden. Samlar alla genomförda pass som ännu inte
// tagits med någonstans, och skapar två saker av dem:
//
//   · en faktura per familj      (vad de ska betala)
//   · ett underlag per studiehjälpare (vad de ska få)
//
// Samma pass, två sidor. Priset familjen betalar kommer från
// prissattning, ersättningen från tutor_profiles.hourly_rate.
//
// SÄKERHET
// Den här funktionen använder service_role, för invoices och payouts
// har med flit ingen INSERT-policy för användare: kan ingen skriva
// belopp från webbläsaren kan ingen skriva fel belopp. Därför får
// den heller inte gå att anropa av vem som helst — anroparen måste
// skicka x-fakturering-nyckel som matchar en secret på servern.
//
// Sätt verify_jwt = false för den här funktionen (den anropas av ett
// schema, inte av en inloggad användare) och skydda den med nyckeln.
//
// KÖR TORRT FÖRST
// Med { "torrkorning": true } räknar den ut allt och svarar med vad
// som SKULLE skapas, utan att skriva en rad. Gör alltid det innan
// första skarpa körningen.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const NYCKEL = Deno.env.get('FAKTURERING_NYCKEL');

// Hur många dagar familjen har på sig att betala.
// Måste stämma med det som står på prissidan, i FAQ:n och i
// användarvillkoren — en faktura som förfaller på en annan dag än
// villkoret lovar är en tvist, inte ett skrivfel.
// DEN DRIFTSATTA VERSIONEN HADE 10 (upptäckt 2026-09-15, version 5).
// Repot, prissidan, FAQ:n och användarvillkoren säger alla 14, och
// en faktura som förfaller fyra dagar före det villkoret lovar är
// precis den tvist kommentaren nedan varnar för. Deployen från den
// här filen sätter tillbaka 14. Var 10 ett medvetet beslut är det
// texterna som ska ändras, inte den här raden — och då ska alla fyra
// ändras samma dag.
const BETALNINGSVILLKOR_DAGAR = 14;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-fakturering-nyckel',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

// Periodens första dag som YYYY-MM-DD. Alla belopp hör till en månad,
// och unique(parent_id, period) gör att en omkörning inte kan skapa
// dubbletter — den krockar i stället, vilket är precis vad vi vill.
function periodFor(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

// Ören, aldrig flyttal. Math.round sist så att 90 minuter à 379 kr
// blir 56850 och inte 56849.999999.
function belopp(minuter: number, timprisOre: number): number {
  return Math.round((minuter / 60) * timprisOre);
}

// Tillägget för flera barn är EN summa per timme, inte en per barn:
// två syskon och tre syskon kostar lika mycket extra. Regeln och
// beloppet står i tjanster (schema-v20), inte här.
function familjebelopp(
  minuter: number,
  timprisOre: number,
  extraOre: number,
  antalBarn: number,
): number {
  const tim = timprisOre + (antalBarn > 1 ? extraOre : 0);
  return Math.round((minuter / 60) * tim);
}

const MANADER = ['januari','februari','mars','april','maj','juni',
                 'juli','augusti','september','oktober','november','december'];

function radtext(subject: string | null, datum: string): string {
  const [, m, d] = datum.split('-');
  return `${subject || 'Pass'} ${Number(d)} ${MANADER[Number(m) - 1]}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return json({ error: 'SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY saknas på servern.' }, 500);
    }
    if (!NYCKEL) {
      return json({ error: 'FAKTURERING_NYCKEL är inte satt som secret. Funktionen vägrar köra oskyddad.' }, 500);
    }
    if (req.headers.get('x-fakturering-nyckel') !== NYCKEL) {
      return json({ error: 'Fel eller saknad nyckel.' }, 401);
    }

    const kropp = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const torrkorning = kropp.torrkorning === true;
    const period = typeof kropp.period === 'string' ? kropp.period : periodFor(new Date());

    const db = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // ---------- priserna ----------
    // Timpriset kommer numera per tjänst ur `tjanster` (schema-v18).
    // prissattning läses fortfarande som reserv: den speglas av en
    // trigger och är därmed alltid läxhjälpens pris, vilket är rätt
    // svar för varje rad som skrevs innan katalogen fanns.
    const [pris, tjanster] = await Promise.all([
      db.from('prissattning').select('pris_per_timme_ore').maybeSingle(),
      db.from('tjanster').select('kod, pris_per_timme_ore, extra_personer_ore'),
    ]);
    const timprisOre = Number(pris.data?.pris_per_timme_ore ?? 0);
    if (!timprisOre) return json({ error: 'Priset i prissattning är 0 eller saknas.' }, 500);

    type TjanstPris = { timme: number; extra: number };
    const prisFor = new Map<string, TjanstPris>();
    for (const t of tjanster.data ?? []) {
      prisFor.set(t.kod, {
        timme: Number(t.pris_per_timme_ore ?? 0),
        extra: Number(t.extra_personer_ore ?? 0),
      });
    }
    const tjanstPris = (kod: string | null): TjanstPris =>
      prisFor.get(kod ?? 'laxhjalp') ?? { timme: timprisOre, extra: 0 };

    // ---------- passen som inte tagits med ----------
    // left join i PostgREST går inte, så vi hämtar id:n som redan är
    // med och filtrerar bort dem här. Listorna är små: det är en
    // månads pass, inte hela historiken.
    const [pass, fakturerade, utbetalda] = await Promise.all([
      db.from('bookings')
        .select('id, subject, tjanst, wanted_date, duration_min, parent_id, tutor_id, antal_barn, rabatt_ore')
        .eq('status', 'completed'),
      db.from('invoice_lines').select('booking_id').not('booking_id', 'is', null),
      db.from('payout_lines').select('booking_id').not('booking_id', 'is', null),
    ]);

    if (pass.error) return json({ error: 'Kunde inte hämta passen: ' + pass.error.message }, 500);

    const redanFakturerade = new Set((fakturerade.data ?? []).map((r) => r.booking_id));
    const redanUtbetalda = new Set((utbetalda.data ?? []).map((r) => r.booking_id));

    // ---------- timpenningarna ----------
    const tutorIdn = [...new Set((pass.data ?? []).map((b) => b.tutor_id).filter(Boolean))];
    const timpenningar = new Map<string, number>();
    if (tutorIdn.length) {
      const tp = await db.from('tutor_profiles').select('id, hourly_rate').in('id', tutorIdn);
      for (const r of tp.data ?? []) {
        if (r.hourly_rate != null) timpenningar.set(r.id, Math.round(Number(r.hourly_rate) * 100));
      }
    }

    // ---------- gruppera ----------
    type Rad = { booking_id: string; beskrivning: string; minuter: number; belopp_ore: number };
    const perFamilj = new Map<string, Rad[]>();
    const perTutor = new Map<string, Rad[]>();
    const utanTimpenning: string[] = [];

    for (const b of pass.data ?? []) {
      const minuter = Number(b.duration_min || 60);
      const text = radtext(b.subject, b.wanted_date);

      if (b.parent_id && !redanFakturerade.has(b.id)) {
        const p = tjanstPris(b.tjanst);
        const barn = Math.max(1, Number(b.antal_barn || 1));
        const brutto = familjebelopp(minuter, p.timme || timprisOre, p.extra, barn);

        // Rabatten är framräknad och fryst vid bokningen. Den räknas
        // ALDRIG om här — annars ändrar sig ett gammalt pass pris den
        // dag någon justerar koden.
        const rabatt = Math.min(Math.max(Number(b.rabatt_ore || 0), 0), brutto);

        const lista = perFamilj.get(b.parent_id) ?? [];
        lista.push({
          booking_id: b.id,
          beskrivning: text
            + (barn > 1 ? ` (${barn} barn)` : '')
            + (rabatt > 0 ? ' − rabatt' : ''),
          minuter,
          belopp_ore: brutto - rabatt,
        });
        perFamilj.set(b.parent_id, lista);
      }

      if (b.tutor_id && !redanUtbetalda.has(b.id)) {
        const timpenning = timpenningar.get(b.tutor_id);
        // Utan timpenning kan vi inte räkna ut ersättningen, och att
        // gissa vore värre än att låta passet ligga kvar till nästa
        // körning. Det rapporteras i svaret så att någon kan fylla i den.
        //
        // Studiehjälparens ersättning påverkas ALDRIG av familjens
        // rabatt, och räknar inte heller med tillägget för flera barn.
        // En kampanj är vår kostnad, inte hens; och tillägget är vad
        // familjen betalar för att två syskon sitter med, inte en
        // löneförhöjning.
        if (!timpenning) { utanTimpenning.push(b.tutor_id); continue; }
        const lista = perTutor.get(b.tutor_id) ?? [];
        lista.push({ booking_id: b.id, beskrivning: text, minuter, belopp_ore: belopp(minuter, timpenning) });
        perTutor.set(b.tutor_id, lista);
      }
    }

    const summa = (rader: Rad[]) => rader.reduce((a, r) => a + r.belopp_ore, 0);
    const minuterSum = (rader: Rad[]) => rader.reduce((a, r) => a + r.minuter, 0);

    const sammanfattning = {
      period,
      pris_per_timme_ore: timprisOre,
      fakturor: [...perFamilj].map(([id, r]) => ({ parent_id: id, pass: r.length, belopp_ore: summa(r) })),
      utbetalningar: [...perTutor].map(([id, r]) => ({ tutor_id: id, pass: r.length, belopp_ore: summa(r) })),
      hoppade_over_utan_timpenning: [...new Set(utanTimpenning)],
    };

    if (torrkorning) return json({ torrkorning: true, ...sammanfattning }, 200);

    // ---------- skriv ----------
    const forfaller = new Date();
    forfaller.setDate(forfaller.getDate() + BETALNINGSVILLKOR_DAGAR);
    const forfallerIso = forfaller.toISOString().slice(0, 10);

    const skapade = { fakturor: 0, utbetalningar: 0 };
    const problem: string[] = [];

    for (const [parentId, rader] of perFamilj) {
      /* UTKAST, inte "skickad".
         Fakturan skapades förut som skickad, med en skickad_at-stämpel
         — trots att ingenting lämnade huset. Det var ofarligt så länge
         ingen KUNDE skicka: ordet betydde bara "klar att visa i
         familjens vy".

         Nu finns edge-funktionen faktura-utskick, och då måste ordet
         betyda vad det säger. "Skickad" sätts av den funktionen, och
         bara efter att Resend svarat att mejlet gick iväg. En faktura
         som står som skickad utan att någon fått den är en faktura
         ingen letar efter — och den upptäcks först när betalningen
         uteblir. */
      const f = await db.from('invoices').insert({
        parent_id: parentId, period, status: 'utkast',
        belopp_ore: summa(rader), forfaller: forfallerIso,
      }).select('id').single();

      if (f.error) { problem.push(`faktura ${parentId}: ${f.error.message}`); continue; }

      const l = await db.from('invoice_lines').insert(
        rader.map((r) => ({
          invoice_id: f.data.id, booking_id: r.booking_id, beskrivning: r.beskrivning,
          minuter: r.minuter, pris_per_timme_ore: timprisOre, belopp_ore: r.belopp_ore,
        })));

      // Raderna är hela poängen med fakturan. Blir de inte skrivna
      // ska fakturan inte heller stå kvar — annars finns ett belopp
      // ingen kan förklara, och passen räknas som fakturerade.
      if (l.error) {
        await db.from('invoices').delete().eq('id', f.data.id);
        problem.push(`fakturarader ${parentId}: ${l.error.message}`);
        continue;
      }
      skapade.fakturor++;
    }

    for (const [tutorId, rader] of perTutor) {
      const p = await db.from('payouts').insert({
        tutor_id: tutorId, period, status: 'utkast',
        belopp_ore: summa(rader), minuter: minuterSum(rader),
      }).select('id').single();

      if (p.error) { problem.push(`utbetalning ${tutorId}: ${p.error.message}`); continue; }

      const timpenning = timpenningar.get(tutorId)!;
      const l = await db.from('payout_lines').insert(
        rader.map((r) => ({
          payout_id: p.data.id, booking_id: r.booking_id, beskrivning: r.beskrivning,
          minuter: r.minuter, timpenning_ore: timpenning, belopp_ore: r.belopp_ore,
        })));

      if (l.error) {
        await db.from('payouts').delete().eq('id', p.data.id);
        problem.push(`utbetalningsrader ${tutorId}: ${l.error.message}`);
        continue;
      }
      skapade.utbetalningar++;
    }

    // ============================================================
    // HÄR KOPPLAS STRIPE IN
    //
    // Allt ovanför fungerar utan Stripe: fakturan finns, beloppet är
    // uträknat, familjen ser den i sin vy. Det som saknas är att ta
    // emot pengarna. Steg när ni är redo:
    //
    //   1. Skapa en Stripe-kund per familj (spara id:t på profiles).
    //   2. Skapa en Stripe Invoice med samma rader som invoice_lines,
    //      och spara stripe_invoice_id + hosted_invoice_url i
    //      stripe_url. Knappen "Betala" i familjens vy pekar redan dit.
    //   3. Lyssna på invoice.paid i en webhook och sätt status
    //      'betald' + betald_at.
    //   4. För utbetalningar: Stripe Connect, en transfer per payout,
    //      och spara stripe_transfer_id.
    //
    // Gör INTE något av det här härifrån förrän torrkörningen sett
    // rätt ut mot riktig data. Ett fel i en uträkning är en rad att
    // ändra; ett fel som redan dragit pengar är ett samtal.
    // ============================================================

    return json({ ...sammanfattning, skapade, problem }, problem.length ? 207 : 200);
  } catch (fel) {
    return json({ error: String((fel as Error)?.message ?? fel) }, 500);
  }
});
