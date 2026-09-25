// ============================================================
// NEXTRUM — Edge Function: fakturering (månadskörningen)
//
// Kör en gång i månaden. Samlar alla genomförda pass som ännu inte
// kommit med på ett underlag, och skapar ett underlag per
// studiehjälpare: vad hen ska få den 25:e.
//
// FAMILJEN BETALAR MED KORT, ELLER MOT FAKTURA OM DEN VALT DET.
// Fas 14.2 tog bort månadsfakturan: familjen betalar varje pass med
// kort före passet, genom stripe-checkout. Pass som hölls utan att
// familjen betalat räknas upp i svaret under `obetalda`, med beloppet,
// och syns under Avvikelser som Inte betalt. De försvinner inte tyst,
// och de faktureras inte i efterhand av sig själva.
//
// Fas 14.6 lät familjen välja faktura på ett pass. Bara de passen,
// betalning_status = 'faktura', samlas på ett fakturautkast per
// familj och period i invoices, med en rad per pass i invoice_lines.
// Utkastet läggs in i Wint av admin (Ekonomi → Fakturor), och det är
// Wint som skickar fakturan. Den här funktionen skickar ingenting.
//
// Funktionen heter kvar fakturering. Namnet är adressen adminvyn och
// ett framtida schema anropar, och ett nytt namn hade varit en ny
// funktion i driften medan den gamla låg kvar ACTIVE utan anropare.
//
// Ersättningen kommer från tjanster.ersattning_per_timme_ore när den
// är satt, annars från tutor_profiles.hourly_rate. Själva räkningen
// ligger i _delad/pris.ts, där den är testad öre för öre (pris_test.ts).
//
// SÄKERHET
// Den här funktionen använder service_role, för payouts och fakturornas
// belopp skrivs med flit inte från webbläsaren: kan ingen skriva belopp
// där kan ingen skriva fel belopp. Därför får den heller inte gå att
// anropa av vem som helst. Två vägar in:
//
//   · x-fakturering-nyckel som matchar secreten FAKTURERING_NYCKEL —
//     för ett schema, som inte är en inloggad användare.
//   · en inloggad ADMIN. Knapparna under Ekonomi → Månadskörning.
//     Inloggningen prövas mot Auth och is_admin läses med anroparens
//     egen token, innan service_role används till något.
//
// verify_jwt är AV för funktionen, för schemat har ingen JWT. Därför
// kontrolleras inloggningen här inne i stället för i porten.
//
// VILKA PASS SOM KOMMER MED (Fas 2)
// Urvalet läses ur vyn passunderlag. Ett pass kommer med om det är
// genomfört, har en rapport kopplad, inte är undantaget av admin
// (fakturerbar) och inte redan finns på ett underlag. Pass utan
// rapport och undantagna pass räknas upp i svaret, så att någon kan
// ta ställning till dem.
//
// PERIODEN
// Underlaget gäller en månad, och standard är FÖREGÅENDE månad —
// körningen den 1:a oktober tar med september, och pengarna går den
// 25:e. Med kommer alla pass TILL OCH MED periodens sista dag som inte
// redan finns på ett underlag, så ett pass som rapporterades för sent
// till förra körningen kommer med på nästa i stället för att falla
// bort. Pass efter perioden väntar till nästa månad.
//
// KÖR TORRT FÖRST
// Med { "torrkorning": true } räknar den ut allt och svarar med vad
// som SKULLE skapas, utan att skriva en rad. Gör alltid det innan
// första skarpa körningen.
// ============================================================

import { cors, json as jsonMed, preflight } from '../_delad/http.ts';
import { kravAdmin, lika, serviceklient } from '../_delad/auth.ts';
import {
  byggFakturor, byggUnderlag, minuterSum, type Pass, sammanfatta, sorteraPass,
  standardTjanst, summa, type Tjanst,
} from '../_delad/pris.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const NYCKEL = Deno.env.get('FAKTURERING_NYCKEL');

const CORS = cors('x-fakturering-nyckel');
const json = (body: unknown, status: number) => jsonMed(body, status, CORS);

// Periodens första dag som YYYY-MM-DD. Alla belopp hör till en månad,
// och unique(tutor_id, period) på payouts gör att en omkörning inte
// kan skapa dubbletter — den krockar i stället, vilket är precis vad
// vi vill.
//
// Månaden räknas i svensk tid. I UTC är klockan 00.30 den 1:a
// fortfarande förra månaden, och då hade körningen tagit fel månad
// varannan gång den startades strax efter midnatt.
function forraManaden(nu: Date): string {
  const [ar, man] = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit',
  }).format(nu).split('-').map(Number);
  const a = man === 1 ? ar - 1 : ar;
  const m = man === 1 ? 12 : man - 1;
  return `${a}-${String(m).padStart(2, '0')}-01`;
}

// "2026-09" eller "2026-09-01" in, "2026-09-01" ut. Allt annat är ett
// fel hos anroparen och ska sägas, inte gissas.
function tolkaPeriod(v: unknown): string | null {
  const m = /^(\d{4})-(\d{2})(?:-01)?$/.exec(String(v ?? '').trim());
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null;
  return `${m[1]}-${m[2]}-01`;
}

// Första dagen i månaden EFTER perioden. Pass före den kommer med.
function periodSlut(period: string): string {
  const [ar, man] = period.split('-').map(Number);
  const a = man === 12 ? ar + 1 : ar;
  const m = man === 12 ? 1 : man + 1;
  return `${a}-${String(m).padStart(2, '0')}-01`;
}

// PostgREST lämnar ut högst tusen rader per fråga. En lista som tyst
// kapas är värre än ingen lista, så urvalet hämtas i sidor.
//
// Raderna tas emot som unknown[] och får sin typ här. supabase-js kan
// inte härleda typen ur en kolumnlista som byggs av flera strängar,
// och ger den då typen GenericStringError[].
async function allaRader<T>(
  fraga: (fran: number, till: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const SIDA = 500;
  const ut: T[] = [];
  for (let fran = 0; ; fran += SIDA) {
    const { data, error } = await fraga(fran, fran + SIDA - 1);
    if (error) throw new Error(error.message);
    ut.push(...((data ?? []) as T[]));
    if (!data || data.length < SIDA) return ut;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(CORS);

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return json({ error: 'SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY saknas på servern.' }, 500);
    }

    // ---------- vem anropar ----------
    let korningAv: 'nyckel' | 'admin';
    const nyckel = req.headers.get('x-fakturering-nyckel');
    if (nyckel !== null) {
      if (!NYCKEL) {
        return json({ error: 'FAKTURERING_NYCKEL är inte satt som secret. Nyckelvägen är stängd.' }, 500);
      }
      if (!lika(nyckel, NYCKEL)) return json({ error: 'Fel nyckel.' }, 401);
      korningAv = 'nyckel';
    } else {
      const auth = req.headers.get('Authorization');
      if (!auth) return json({ error: 'Ingen nyckel och ingen inloggning.' }, 401);
      const vem = await kravAdmin(auth);
      if (!vem.ok) return vem.svar;
      korningAv = 'admin';
    }

    const kropp = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const torrkorning = kropp.torrkorning === true;
    const period = kropp.period === undefined || kropp.period === null || kropp.period === ''
      ? forraManaden(new Date())
      : tolkaPeriod(kropp.period);
    if (!period) return json({ error: 'Perioden ska skrivas ÅÅÅÅ-MM, till exempel 2026-09.' }, 400);
    const slut = periodSlut(period);

    const db = serviceklient();

    // ---------- priserna ----------
    const [pris, tjanster] = await Promise.all([
      db.from('prissattning').select('pris_per_timme_ore').maybeSingle(),
      db.from('tjanster').select('kod, aktiv, for_kund, ordning, pris_per_timme_ore, extra_personer_ore, '
        + 'ersattning_per_timme_ore, rut_berattigad, rut_procent'),
    ]);
    const katalog = (tjanster.data ?? []) as unknown as Tjanst[];

    // Priset tas i första hand ur `tjanster`, som är källan sedan
    // schema-v18. prissattning är reserv.
    //
    // Ordningen var tvärtom och gjorde funktionen omöjlig att köra:
    // prissattning har RLS med läsrätt bara för `authenticated`,
    // medan `tjanster` är läsbar för alla. En äkta service_role-nyckel
    // går förbi RLS och ser båda — men gör den inte det, till exempel
    // för att SUPABASE_SERVICE_ROLE_KEY råkar vara den publicerbara
    // nyckeln, läser klienten som anon och prissattning blir tom.
    // Funktionen avbröt då med "Priset i prissattning är 0", vilket
    // pekade på fel sak: priset fanns, men nyckeln räckte inte.
    //
    // Standardtjänsten (den första aktiva som kunder kan köpa, i dag
    // läxhjälp) ger baspriset — inte en inskriven tjänstekod (Fas 5.4).
    const standard = standardTjanst(katalog);
    const timprisOre = Number(standard?.pris_per_timme_ore ?? 0)
      || Number(pris.data?.pris_per_timme_ore ?? 0);

    if (!timprisOre) {
      return json({
        error: 'Hittar inget timpris. Varken standardtjänsten i tjanster eller prissattning gick att läsa.',
        trolig_orsak: 'SUPABASE_SERVICE_ROLE_KEY på funktionen är sannolikt inte en '
          + 'service_role-nyckel. Utan den läser funktionen som anon, och kan då '
          + 'varken läsa priset eller skriva underlag.',
      }, 500);
    }

    // ---------- passen som inte tagits med ----------
    // Vyn passunderlag svarar för varje genomfört pass om det har en
    // rapport, är undantaget, står på en äldre faktura, är betalt och
    // redan är med på ett underlag. Bara pass till och med periodens
    // sista dag, och bara de som inte redan finns på ett underlag.
    //
    // Förut hämtades också pass som fanns på ett underlag men inte på
    // en faktura, för familjens halva. Den halvan finns inte längre.
    // Ett obetalt pass som redan är med på ett underlag räknas inte upp
    // här en gång till — avvikelsen ej_betalt ser det varje dag.
    let allaPass: Pass[];
    try {
      allaPass = await allaRader<Pass>((fran, till) => db.from('passunderlag')
        .select('id, subject, tjanst, wanted_date, duration_min, parent_id, tutor_id, antal_barn, '
          + 'rabatt_ore, fakturerbar, har_rapport, fakturerad, pa_underlag, betalning_status')
        .lt('wanted_date', slut)
        .eq('pa_underlag', false)
        .order('wanted_date').order('id')
        .range(fran, till));
    } catch (fel) {
      return json({ error: 'Kunde inte hämta passen: ' + (fel as Error).message }, 500);
    }

    // Två sorters pass som INTE går vidare, och som ska synas i svaret
    // i stället för att försvinna tyst.
    const { pass, utanRapport, undantagna } = sorteraPass(allaPass);

    // ---------- fakturapassen (Fas 14.6) ----------
    // En egen fråga, för urvalet ovan tar bara pass som inte står på ett
    // underlag. Ett fakturapass kan redan ha kommit med på
    // studiehjälparens underlag förra månaden (rapporten kom i tid) och
    // ändå sakna faktura (familjen valde faktura efteråt, eller körningen
    // fanns inte). Villkoret är fakturan, inte underlaget.
    let fakturapass: Pass[];
    try {
      fakturapass = await allaRader<Pass>((fran, till) => db.from('passunderlag')
        .select('id, subject, tjanst, wanted_date, duration_min, parent_id, tutor_id, antal_barn, '
          + 'rabatt_ore, fakturerbar, har_rapport, fakturerad, pa_underlag, betalning_status')
        .lt('wanted_date', slut)
        .eq('betalning_status', 'faktura')
        .eq('fakturerad', false)
        .eq('fakturerbar', true)
        .eq('har_rapport', true)
        .order('wanted_date').order('id')
        .range(fran, till));
    } catch (fel) {
      return json({ error: 'Kunde inte hämta fakturapassen: ' + (fel as Error).message }, 500);
    }

    // ---------- timpenningarna ----------
    const tutorIdn = [...new Set(pass.filter((b) => !b.pa_underlag).map((b) => b.tutor_id).filter(Boolean))];
    const timpenningar = new Map<string, number>();
    if (tutorIdn.length) {
      const tp = await db.from('tutor_profiles').select('id, hourly_rate').in('id', tutorIdn);
      for (const r of tp.data ?? []) {
        if (r.hourly_rate != null) timpenningar.set(r.id, Math.round(Number(r.hourly_rate) * 100));
      }
    }

    // ---------- räkna ----------
    const underlag = byggUnderlag({ pass, tjanster: katalog, timprisOre, timpenningar });
    const { perTutor } = underlag;
    const fakturor = byggFakturor({ pass: fakturapass, tjanster: katalog, timprisOre });

    const sammanfattning = sammanfatta({
      korningAv, period, slut, timprisOre, underlag, fakturor, utanRapport, undantagna,
    });

    if (torrkorning) return json({ torrkorning: true, ...sammanfattning }, 200);

    // ---------- skriv ----------
    // Underlag, och ett fakturautkast per familj som valt faktura. Ett
    // obetalt kortpass skrivs inte någonstans: det finns i svaret som
    // `obetalda`, och i databasen som avvikelsen ej_betalt.
    const skapade = { utbetalningar: 0, fakturor: 0 };
    const problem: string[] = [];

    /* Fakturan FÖRST, raderna SEDAN, och fakturan tas bort om raderna
       inte gick in — samma ordning som underlaget nedan. En faktura
       utan rader hade larmat som faktura_summa_fel, men ett utkast med
       rätt summa och fel rader hade lagts in i Wint utan att någon sett
       det. UNIQUE(parent_id, period) gör att en omkörning krockar i
       stället för att skapa en andra faktura: krocken står i `problem`. */
    for (const [foralder, rader] of fakturor) {
      const f = await db.from('invoices').insert({
        parent_id: foralder, period, status: 'utkast', belopp_ore: summa(rader),
      }).select('id').single();

      if (f.error) { problem.push(`faktura ${foralder}: ${f.error.message}`); continue; }

      const l = await db.from('invoice_lines').insert(rader.map((r) => ({
        invoice_id: f.data.id, booking_id: r.booking_id, beskrivning: r.beskrivning,
        minuter: r.minuter, pris_per_timme_ore: r.pris_per_timme_ore, belopp_ore: r.belopp_ore,
      })));

      if (l.error) {
        await db.from('invoices').delete().eq('id', f.data.id);
        problem.push(`fakturarader ${foralder}: ${l.error.message}`);
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

      // Radens egen timpenning: tjänstens ersättning när den är satt,
      // annars studiehjälparens egen. För läxhjälp alltid hens egen.
      const l = await db.from('payout_lines').insert(
        rader.map((r) => ({
          payout_id: p.data.id, booking_id: r.booking_id, beskrivning: r.beskrivning,
          minuter: r.minuter, timpenning_ore: r.timpris_ore, belopp_ore: r.belopp_ore,
        })));

      if (l.error) {
        await db.from('payouts').delete().eq('id', p.data.id);
        problem.push(`utbetalningsrader ${tutorId}: ${l.error.message}`);
        continue;
      }
      skapade.utbetalningar++;
    }

    // Pengarna går inte härifrån. Underlaget är ett utkast som admin
    // granskar, och utbetalningen den 25:e görs från banken. Stripe är
    // inte med i den här halvan alls: Connect togs bort i Fas 12.5,
    // eftersom en överföring per pass hade betalat samma timmar två
    // gånger — en gång vid passet och en gång här. Fakturan skickas av
    // Wint, inte härifrån.

    return json({ ...sammanfattning, skapade, problem }, problem.length ? 207 : 200);
  } catch (fel) {
    return json({ error: String((fel as Error)?.message ?? fel) }, 500);
  }
});
