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
// tjanster, ersättningen från tjanster.ersattning_per_timme_ore när
// den är satt, annars från tutor_profiles.hourly_rate. Själva räkningen ligger i
// _delad/pris.ts, där den är testad öre för öre (pris_test.ts).
//
// RUT (Fas 5.3): dras bara av för RUT-berättigade tjänster, när kunden
// har skatteuppgifter och admin fyllt i årets tak i rut_tak. För
// läxhjälp är avdraget alltid 0 och svaret ser ut precis som förut.
//
// SÄKERHET
// Den här funktionen använder service_role, för invoices och payouts
// har med flit ingen INSERT-policy för användare: kan ingen skriva
// belopp från webbläsaren kan ingen skriva fel belopp. Därför får
// den heller inte gå att anropa av vem som helst. Två vägar in:
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
// (fakturerbar) och inte redan finns på en faktura respektive ett
// underlag. Pass utan rapport och undantagna pass räknas upp i
// svaret, så att någon kan ta ställning till dem.
//
// PERIODEN
// Fakturan gäller en månad, och standard är FÖREGÅENDE månad —
// körningen den 1:a oktober fakturerar september. Med kommer alla
// pass TILL OCH MED periodens sista dag som inte redan fakturerats,
// så ett pass som rapporterades för sent till förra körningen kommer
// med på nästa i stället för att falla bort. Pass efter perioden
// väntar till nästa månad.
//
// KÖR TORRT FÖRST
// Med { "torrkorning": true } räknar den ut allt och svarar med vad
// som SKULLE skapas, utan att skriva en rad. Gör alltid det innan
// första skarpa körningen.
// ============================================================

import { cors, json as jsonMed, preflight } from '../_delad/http.ts';
import { kravAdmin, lika, serviceklient } from '../_delad/auth.ts';
import { BETALNINGSVILLKOR_DAGAR } from '../_delad/konstanter.ts';
import {
  byggUnderlag, minuterSum, type Pass, type RutLage, sammanfatta, sorteraPass,
  standardTjanst, summa, summaRut, type Tjanst,
} from '../_delad/pris.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const NYCKEL = Deno.env.get('FAKTURERING_NYCKEL');

// Betalningsvillkoret ligger i _delad/konstanter.ts, en gång för alla
// funktioner. Den driftsatta versionen av den här filen hade 14 dagar
// när allt annat sa 10 — det är skälet till att siffran flyttade.

const CORS = cors('x-fakturering-nyckel');
const json = (body: unknown, status: number) => jsonMed(body, status, CORS);

// Periodens första dag som YYYY-MM-DD. Alla belopp hör till en månad,
// och unique(parent_id, period) gör att en omkörning inte kan skapa
// dubbletter — den krockar i stället, vilket är precis vad vi vill.
//
// Månaden räknas i svensk tid. I UTC är klockan 00.30 den 1:a
// fortfarande förra månaden, och då hade körningen fakturerat fel
// månad varannan gång den startades strax efter midnatt.
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
          + 'varken läsa priset eller skriva fakturor.',
      }, 500);
    }

    // ---------- passen som inte tagits med ----------
    // Vyn passunderlag svarar för varje genomfört pass om det har en
    // rapport, är undantaget, redan fakturerat eller redan med på ett
    // underlag. Bara pass till och med periodens sista dag.
    let allaPass: Pass[];
    try {
      allaPass = await allaRader<Pass>((fran, till) => db.from('passunderlag')
        .select('id, subject, tjanst, wanted_date, duration_min, parent_id, tutor_id, antal_barn, '
          + 'rabatt_ore, fakturerbar, har_rapport, fakturerad, pa_underlag, betalning_status')
        .lt('wanted_date', slut)
        .or('fakturerad.eq.false,pa_underlag.eq.false')
        .order('wanted_date').order('id')
        .range(fran, till));
    } catch (fel) {
      return json({ error: 'Kunde inte hämta passen: ' + (fel as Error).message }, 500);
    }

    // Två sorters pass som INTE går vidare, och som ska synas i svaret
    // i stället för att försvinna tyst.
    const { pass, utanRapport, undantagna } = sorteraPass(allaPass);

    // ---------- timpenningarna ----------
    const tutorIdn = [...new Set(pass.filter((b) => !b.pa_underlag).map((b) => b.tutor_id).filter(Boolean))];
    const timpenningar = new Map<string, number>();
    if (tutorIdn.length) {
      const tp = await db.from('tutor_profiles').select('id, hourly_rate').in('id', tutorIdn);
      for (const r of tp.data ?? []) {
        if (r.hourly_rate != null) timpenningar.set(r.id, Math.round(Number(r.hourly_rate) * 100));
      }
    }

    // Förfallodagen räknas redan här: RUT hör till året kunden BETALAR
    // (Skatteverket), och det är förfallodagens år — en faktura för
    // december betalas i januari och ska mot det nya årets tak.
    const forfaller = new Date();
    forfaller.setDate(forfaller.getDate() + BETALNINGSVILLKOR_DAGAR);
    const forfallerIso = forfaller.toISOString().slice(0, 10);
    const rutAr = Number(forfallerIso.slice(0, 4));

    // ---------- RUT ----------
    // Hämtas bara när något pass gäller en RUT-berättigad tjänst. För
    // läxhjälp ställs inga av de här frågorna.
    const rutKoder = new Set(katalog.filter((t) => t.rut_berattigad).map((t) => t.kod));
    const rutKunder = [...new Set(pass
      .filter((b) => b.parent_id && !b.fakturerad && rutKoder.has(b.tjanst ?? standard?.kod ?? ''))
      .map((b) => b.parent_id as string))];
    let rut: RutLage | undefined;
    if (rutKunder.length) {
      const [uppg, tak, anvant] = await Promise.all([
        db.from('kund_skatteuppgifter').select('kund_id').in('kund_id', rutKunder),
        db.from('rut_tak').select('tak_ore').eq('ar', rutAr).maybeSingle(),
        db.from('rut_underlag').select('kund_id, rut_ore').eq('ar', rutAr).in('kund_id', rutKunder),
      ]);
      const fel = uppg.error ?? tak.error ?? anvant.error;
      if (fel) return json({ error: 'Kunde inte läsa RUT-underlaget: ' + fel.message }, 500);
      rut = {
        medSkatteuppgifter: new Set((uppg.data ?? []).map((r): string => r.kund_id as string)),
        takOre: tak.data ? Number(tak.data.tak_ore) : null,
        anvantOre: new Map((anvant.data ?? []).map((r): [string, number] => [r.kund_id as string, Number(r.rut_ore)])),
      };
    }

    // ---------- räkna ----------
    const underlag = byggUnderlag({ pass, tjanster: katalog, timprisOre, timpenningar, rut });
    const { perFamilj, perTutor } = underlag;

    const sammanfattning = sammanfatta({
      korningAv, period, rutAr, slut, timprisOre, underlag, utanRapport, undantagna,
    });

    if (torrkorning) return json({ torrkorning: true, ...sammanfattning }, 200);

    // ---------- skriv ----------
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
      // rut_ar: året avdraget prövades mot taket för. Bara när det
      // finns ett avdrag — en läxhjälpsfaktura skrivs som förut.
      const rut = summaRut(rader);
      const f = await db.from('invoices').insert({
        parent_id: parentId, period, status: 'utkast',
        belopp_ore: summa(rader), rut_ore: rut, forfaller: forfallerIso,
        ...(rut > 0 ? { rut_ar: rutAr } : {}),
      }).select('id').single();

      if (f.error) { problem.push(`faktura ${parentId}: ${f.error.message}`); continue; }

      const l = await db.from('invoice_lines').insert(
        rader.map((r) => ({
          invoice_id: f.data.id, booking_id: r.booking_id, beskrivning: r.beskrivning,
          minuter: r.minuter, pris_per_timme_ore: r.timpris_ore, belopp_ore: r.belopp_ore,
          rut_ore: r.rut_ore,
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
