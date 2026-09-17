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
// tjanster, ersättningen från tutor_profiles.hourly_rate.
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
import { BETALNINGSVILLKOR_DAGAR, MANADER } from '../_delad/konstanter.ts';

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
async function allaRader<T>(
  fraga: (fran: number, till: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const SIDA = 500;
  const ut: T[] = [];
  for (let fran = 0; ; fran += SIDA) {
    const { data, error } = await fraga(fran, fran + SIDA - 1);
    if (error) throw new Error(error.message);
    ut.push(...(data ?? []));
    if (!data || data.length < SIDA) return ut;
  }
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

function radtext(subject: string | null, datum: string): string {
  const [, m, d] = datum.split('-');
  return `${subject || 'Pass'} ${Number(d)} ${MANADER[Number(m) - 1]}`;
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
      db.from('tjanster').select('kod, pris_per_timme_ore, extra_personer_ore'),
    ]);

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
    const laxhjalp = (tjanster.data ?? []).find((t) => t.kod === 'laxhjalp');
    const timprisOre = Number(laxhjalp?.pris_per_timme_ore ?? 0)
      || Number(pris.data?.pris_per_timme_ore ?? 0);

    if (!timprisOre) {
      return json({
        error: 'Hittar inget timpris. Varken tjanster.laxhjalp eller prissattning gick att läsa.',
        trolig_orsak: 'SUPABASE_SERVICE_ROLE_KEY på funktionen är sannolikt inte en '
          + 'service_role-nyckel. Utan den läser funktionen som anon, och kan då '
          + 'varken läsa priset eller skriva fakturor.',
      }, 500);
    }

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
    // Vyn passunderlag svarar för varje genomfört pass om det har en
    // rapport, är undantaget, redan fakturerat eller redan med på ett
    // underlag. Bara pass till och med periodens sista dag.
    type Pass = {
      id: string; subject: string | null; tjanst: string | null; wanted_date: string;
      duration_min: number | null; parent_id: string | null; tutor_id: string | null;
      antal_barn: number | null; rabatt_ore: number | null;
      fakturerbar: boolean; har_rapport: boolean; fakturerad: boolean; pa_underlag: boolean;
    };
    let allaPass: Pass[];
    try {
      allaPass = await allaRader<Pass>((fran, till) => db.from('passunderlag')
        .select('id, subject, tjanst, wanted_date, duration_min, parent_id, tutor_id, antal_barn, '
          + 'rabatt_ore, fakturerbar, har_rapport, fakturerad, pa_underlag')
        .lt('wanted_date', slut)
        .or('fakturerad.eq.false,pa_underlag.eq.false')
        .order('wanted_date').order('id')
        .range(fran, till));
    } catch (fel) {
      return json({ error: 'Kunde inte hämta passen: ' + (fel as Error).message }, 500);
    }

    // Två sorters pass som INTE går vidare, och som ska synas i svaret
    // i stället för att försvinna tyst.
    const utanRapport: { booking_id: string; datum: string; parent_id: string | null; tutor_id: string | null }[] = [];
    const undantagna: string[] = [];
    const pass: Pass[] = [];
    for (const b of allaPass) {
      if (!b.fakturerbar) { undantagna.push(b.id); continue; }
      if (!b.har_rapport) {
        utanRapport.push({ booking_id: b.id, datum: b.wanted_date, parent_id: b.parent_id, tutor_id: b.tutor_id });
        continue;
      }
      pass.push(b);
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

    // ---------- gruppera ----------
    type Rad = { booking_id: string; beskrivning: string; minuter: number; belopp_ore: number; timpris_ore: number };
    const perFamilj = new Map<string, Rad[]>();
    const perTutor = new Map<string, Rad[]>();
    const utanTimpenning: string[] = [];

    for (const b of pass) {
      const minuter = Number(b.duration_min || 60);
      const text = radtext(b.subject, b.wanted_date);

      if (b.parent_id && !b.fakturerad) {
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
          // Radens eget timpris — tjänstens, med tillägget för flera
          // barn när det gäller. Förut stod läxhjälpens pris på varje
          // rad, oavsett vad raden faktiskt kostade.
          timpris_ore: (p.timme || timprisOre) + (barn > 1 ? p.extra : 0),
        });
        perFamilj.set(b.parent_id, lista);
      }

      if (b.tutor_id && !b.pa_underlag) {
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
        lista.push({ booking_id: b.id, beskrivning: text, minuter, belopp_ore: belopp(minuter, timpenning), timpris_ore: timpenning });
        perTutor.set(b.tutor_id, lista);
      }
    }

    const summa = (rader: Rad[]) => rader.reduce((a, r) => a + r.belopp_ore, 0);
    const minuterSum = (rader: Rad[]) => rader.reduce((a, r) => a + r.minuter, 0);

    const sammanfattning = {
      korning_av: korningAv,
      period,
      pass_till_och_med: new Date(Date.parse(slut) - 86_400_000).toISOString().slice(0, 10),
      pris_per_timme_ore: timprisOre,
      fakturor: [...perFamilj].map(([id, r]) => ({ parent_id: id, pass: r.length, belopp_ore: summa(r) })),
      utbetalningar: [...perTutor].map(([id, r]) => ({ tutor_id: id, pass: r.length, belopp_ore: summa(r) })),
      hoppade_over_utan_timpenning: [...new Set(utanTimpenning)],
      hoppade_over_utan_rapport: utanRapport,
      undantagna_pass: undantagna.length,
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
          minuter: r.minuter, pris_per_timme_ore: r.timpris_ore, belopp_ore: r.belopp_ore,
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
