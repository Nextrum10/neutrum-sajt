// ============================================================
// NEXTRUM — stripe-checkout (Fas 12.2, ombyggd i Fas 12.5 och 14.1)
//
// Familjens kortbetalning för ETT pass. HELA beloppet landar hos
// Nextrum. Ingen destination, ingen application fee, inget anslutet
// konto inblandat.
//
//
// FUNKTIONEN PÅSTÅR INGENTING OM ATT NÅGOT ÄR BETALT (Fas 14.1)
//
// Den skapar en session och skriver ner vad vi BAD om (begart_ore).
// Vad som faktiskt drogs vet bara Stripe, och det skrivs av
// stripe-webhook. Förut skrev den här funktionen betalt_ore direkt,
// alltså ett belopp ingen ännu betalat, och resten av systemet läste
// det som ett kvitto.
//
//
// VARFÖR CONNECT ÄR BORTA HÄRIFRÅN (Fas 12.5)
//
// Studiehjälparen får betalt den 25:e, som en löning, i en klump för
// månadens rapporterade pass. Det är `payouts` och månadskörningens
// jobb, och det är den enda vägen pengar går till en hjälpare.
//
// En destination charge hade lagt hjälparens del på hens Stripe-saldo
// vid VARJE pass, och sedan hade månadskörningen betalat samma timmar
// en gång till. Två system som räknar samma arbete är inte krångel,
// det är dubbelbetalning som ingen ser förrän någon stämmer av.
//
// Säljarens egen lista sa det: "byt till separate charges and
// transfers om ersättningen ska frisläppas först efter genomförd
// lektion". Hos Nextrum sker det inte ens då, utan på en lönedag, så
// Stripe ska inte vara med i den delen alls.
//
// ERSÄTTNINGEN RÄKNAS INTE HÄR. Den räknas av `fakturering` när
// underlaget byggs, ur passets rapport. Att också räkna den vid
// betalningen hade gett två källor till samma siffra, och den som
// skrivs först hade vunnit av en slump.
//
//
// VARFÖR BETALNINGEN LIGGER PÅ "BEKRÄFTAT" OCH INTE PÅ "BOKAT"
//
// Ett pass börjar alltid som `requested` och bekräftas av MOTPARTEN
// (skydda_bokningsfalt, Fas 1.5). Att ta betalt redan vid förfrågan
// hade betytt en återbetalning för varje pass som studiehjälparen
// tackar nej till, och varje återbetalning är en kortavgift Nextrum
// inte får tillbaka plus en familj som undrar vad som hände.
//
// Vid `confirmed` finns båda parterna, tiden och priset. Det är den
// första punkt där det går att ta rätt belopp av rätt person.
//
//
// BELOPPEN RÄKNAS HÄR, ALDRIG I ANROPET
//
// Kroppen säger vilket pass det gäller. Ingenting annat. Priset,
// rabatten och ersättningen läses ur databasen, av samma skäl som
// payouts med flit saknar INSERT-policy för användare:
// kan ingen skicka in ett belopp kan ingen skicka in fel belopp.
//
// Räkningen lånas ur _delad/pris.ts, den som faktureringen redan
// använder och som pris_test.ts vaktar. En andra kopia av prislogiken
// hade glidit isär från den första, precis som de sju esc() gjorde.
// ============================================================

import { arAdmin, type Inloggad, kravInloggad, serviceklient } from '../_delad/auth.ts';
import { cors, json, preflight } from '../_delad/http.ts';
import { arStripeId, descriptor, StripeError, v1, VALUTA } from '../_delad/stripe.ts';
import { familjebelopp, passpris, radtext, standardTjanst, tillaggsbelopp, type Tjanst } from '../_delad/pris.ts';
import {
  arErbjudandekod, type ErbjudandePris, extraTimmar, familjerabattPaKop, kanAteranvandas, kassarad, kassaradTillPlanen,
  sammaInnehall,
} from '../_delad/erbjudanden.ts';

const CORS = cors();

/* Räknas upp när sessionens parametrar ändras. Se idempotensnyckeln.
   2: bara kort och kvitto till familjens adress (Fas 14.3).
   3: Managed Payments uttryckligen av (Fas 14.4).
   4: kassan kan bäddas in i föräldravyn (Fas 14.5).
   5: raden säger när första timmen är på köpet (Fas 19.5).
   6: minuterna betalningen avser står i metadata (Fas 20.1).
   7: planerna (2026-10-07): raden säger timmen på köpet ("8 timmar
      läxhjälp för priset av 7") och aldrig "0 % rabatt". Ett väntande
      köp som återanvänds får annars en ny beskrivning under samma
      nyckel, och Stripe nekar.
   8: en rabattkod på ett köp av timmar (rabattkoden_timmar_och_tak,
      2026-10-13): beloppet är köpets begart_ore, som databasen räknat,
      och raden och metadata säger koden.
   9: familjens rabatt (familjerabatter, 2026-10-15): raden säger den, på
      ett pass och på ett köp, och beloppet är databasens efter den. */
const SESSIONSFORM = 9;

/* DEN INBÄDDADE KASSAN (Fas 14.5)

   Leo: "när man betalar med kort ska man fortfarande vara kvar på
   sidan". Stripes Embedded Checkout ritar samma kassa i en ram på vår
   sida, i stället för att skicka familjen till checkout.stripe.com.
   Kortuppgifterna tas fortfarande emot av Stripe, i Stripes ram: vi
   ser dem aldrig, precis som förut.

   Den kräver den PUBLICERBARA nyckeln i webbläsaren. Den är inte
   hemlig, men den ligger ändå som secret bredvid den hemliga
   (STRIPE_PUBLISHABLE_KEY), för att de två måste höra till samma läge:
   en testnyckel på ena sidan och en skarp på den andra ger en kassa som
   inte går att öppna. Här prövas det, och stämmer det inte blir det
   Stripes egen sida, som förut.

   Stripes sida finns kvar som reserv av samma skäl. Vyn ber om den
   inbäddade kassan, men om Stripe.js inte går att ladda (en
   annonsblockerare, ett nätverk som stoppar js.stripe.com) frågar den
   igen och får adressen. En familj ska aldrig stå utan väg att betala. */
function publicerbarNyckel(): string | null {
  const pk = Deno.env.get('STRIPE_PUBLISHABLE_KEY') ?? '';
  const sk = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  const lage = (k: string) => /^(pk|sk|rk)_test_/.test(k) ? 'test'
    : /^(pk|sk|rk)_live_/.test(k) ? 'skarp' : null;
  if (!pk.startsWith('pk_')) return null;
  if (!lage(pk) || lage(pk) !== lage(sk)) {
    console.error('stripe-checkout: publicerbara nyckeln hör inte till samma läge som den hemliga; Stripes sida används');
    return null;
  }
  return pk;
}

/* FAMILJENS RABATT (familjerabatter, 2026-10-15). Kronor av per timme som
   admin satt på familjen, frågat med familjens egen token: bara beloppet,
   aldrig koden. Databasen drar dem när priset sätts (passet när det bokas,
   köpet när det skapas); här behövs beloppet till raden i kassan och till
   att känna igen ett väntande köp. Saknas funktionen, före migrationen, är
   det noll, och kassan är som förut. */
async function familjensRabatt(vem: Inloggad): Promise<number> {
  const { data, error } = await vem.klient.rpc('min_familjerabatt');
  if (error) return 0;
  const ore = Number(data);
  return Number.isInteger(ore) && ore > 0 ? ore : 0;
}

/* Bara vår egen sajt får vara returadress. En öppen omdirigering i ett
   betalflöde är en inloggningssida som ser äkta ut. */
function egenAdress(u: unknown, reserv: string): string {
  try {
    const a = new URL(String(u));
    const ok = a.hostname === 'nextrum.se' || a.hostname === 'www.nextrum.se'
      || a.hostname === 'localhost' || a.hostname === '127.0.0.1';
    if (ok && (a.protocol === 'https:' || a.hostname === 'localhost')) return a.origin;
  } catch { /* faller igenom */ }
  return reserv;
}

/* ============================================================
   ETT ERBJUDANDE (Fas 16.1): en plan eller ett klippkort

   Samma kassa som för ett pass, men köpet är en rad i klippkort, inte
   ett pass. Tre saker skiljer:

   · PRISET LÄSES UR erbjudanden_pris, med den inloggades token — samma
     vy som prissidan och studievyn visar. Anropet säger bara VILKET
     erbjudande; beloppet kommer aldrig därifrån.
   · RADEN SKAPAS FÖRE KASSAN, med service_role, som 'vantar'. Ingen
     familj kan skriva i klippkort (ingen skrivpolicy), och webhooken
     hittar köpet genom metadata.klippkort_id.
   · FLAGGAN erbjudanden måste vara på. Den står av tills
     provbetalningen gått igenom och stripe-webhook är driftsatt i den
     här versionen: en äldre webhook kvitterar ett köpt klippkort som
     "utan pass-id", med pengarna dragna.

   Inget client_reference_id: webhooken läser det som ett pass-id.

   EN RABATTKOD (rabattkoden_timmar_och_tak, 2026-10-13, Leo:
   "rabattkoden kan användas för att köpa timmar i timbanken"). Kassan
   prövar koden med familjens token (kolla_rabattkod_kop), så att
   familjen får veta varför en kod inte gäller i stället för att betala
   fullt pris. Beloppet räknas ändå i databasen: triggern
   intern.klippkort_rabatt sätter rabatt_ore och begart_ore när köpet
   skapas, och det är begart_ore som dras. Tar triggern bort koden (den
   tog slut emellan) öppnas ingen kassa.

   FAMILJENS RABATT (familjerabatter, 2026-10-15) dras på samma ställe,
   från varje betald timme, före en kod. Kassan räknar samma sak bara för
   att känna igen ett väntande köp med samma pris; beloppet som dras är
   databasens, och raden säger rabatten när köpet har en.
   ============================================================ */
async function köpErbjudande(
  vem: Inloggad,
  kropp: { retur?: string; ui?: string; erbjudande?: string; rabattkod?: string; timmar?: unknown },
): Promise<Response> {
  const kod = String(kropp.erbjudande ?? '').trim();
  if (!arErbjudandekod(kod)) return json({ error: 'Vilket erbjudande?' }, 400, CORS);
  // Samma form som i databasen: stora bokstäver, utan mellanslag runt.
  const rabattkod = String(kropp.rabattkod ?? '').trim().toUpperCase() || null;

  const db = serviceklient();
  const { data: flagga } = await db.from('flaggor').select('aktiv').eq('kod', 'erbjudanden').maybeSingle();
  if (!flagga?.aktiv) {
    return json({ error: 'Erbjudandena går inte att köpa än. Skriv till oss, så ordnar vi det.' }, 409, CORS);
  }

  // Den inloggade och priset läses med den inloggades egen token.
  const { data: prof } = await vem.klient
    .from('profiles').select('email, role').eq('id', vem.anvandare).maybeSingle();
  if (!prof || prof.role !== 'parent') {
    return json({ error: 'Erbjudandena köps av familjen.' }, 403, CORS);
  }
  // Timmar till planen (2026-10-14) står inte i katalogen: priset är planens.
  if (kod === 'plan_extra') return await köpTimmarTillPlanen(vem, kropp, String(prof.email ?? '') || undefined);
  /* Hela raden, inte en uttrycklig lista: timmar_pa_kopet finns först
     efter migrationen planerna_basic_standard_intensiv (2026-10-07), och
     en lista som nämner den hade nekats av PostgREST före den. Så tål
     kassan att migrationen saknas och kan driftsättas före den, och inget
     glapp uppstår där den gamla kassan säljer Standard med "0 % rabatt"
     (granskningen 2026-10-07). Priset läses ur vyn, som förut. */
  const { data: e } = await vem.klient
    .from('erbjudanden_pris')
    .select('*')
    .eq('kod', kod)
    .maybeSingle();
  if (!e || !(Number(e.pris_ore) > 0)) return json({ error: 'Erbjudandet finns inte.' }, 404, CORS);

  /* Vad familjen ska betala: katalogens pris minus familjens rabatt, eller
     priset med koden som databasen säger att den gäller (efter rabatten). */
  const egen = familjerabattPaKop(e as ErbjudandePris, await familjensRabatt(vem));
  let attBetala = Number(e.pris_ore) - egen.summa;
  if (rabattkod) {
    const { data: prov, error: provfel } = await vem.klient
      .rpc('kolla_rabattkod_kop', { p_kod: rabattkod, p_erbjudande: e.kod });
    const svar = Array.isArray(prov) ? prov[0] : prov;
    if (provfel || !svar) {
      return json({ error: 'Rabattkoden gick inte att pröva just nu. Försök igen, eller köp utan koden.' }, 409, CORS);
    }
    if (!svar.giltig) return json({ error: String(svar.orsak || 'Koden gäller inte.') }, 409, CORS);
    attBetala = Number(svar.att_betala_ore);
    if (!(attBetala > 0)) return json({ error: 'Koden gäller inte köp av timmar.' }, 409, CORS);
  }

  try {
    /* Trycker familjen Köp två gånger ska det bli ETT köp. Ett väntande
       köp av samma erbjudande, till samma pris och yngre än ett dygn,
       återanvänds — och därmed samma idempotensnyckel hos Stripe. */
    /* Hela raden av samma skäl som ovan; sammaInnehall prövar att det
       väntande köpet också har samma timmar, timmar på köpet, rabatt och
       giltighet som katalogen nu, inte bara samma pris. En katalog som
       ändrats till samma pris (9 för 7 i stället för 8 för 7) hade annars
       gett samma idempotensnyckel med en annan kassarad. */
    const { data: forut } = await db.from('klippkort')
      .select('*')
      .eq('parent_id', vem.anvandare).eq('erbjudande', kod).eq('status', 'vantar')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();

    let kopId: string;
    let belopp: number;
    // Familjens rabatt per timme på köpet, som databasen satte den.
    let rabattPerTimme: number;
    if (kanAteranvandas(forut, attBetala) && sammaInnehall(forut, e as ErbjudandePris)
        && (forut?.rabattkod ?? null) === rabattkod
        && (Number(forut?.familjerabatt_ore) || 0) === egen.perTimme) {
      kopId = String(forut!.id);
      belopp = Number(forut!.begart_ore);
      rabattPerTimme = Number(forut!.familjerabatt_ore) || 0;
    } else {
      const { data: ny, error: nyfel } = await db.from('klippkort').insert({
        parent_id: vem.anvandare,
        erbjudande: e.kod,
        namn: e.namn,
        sort: e.sort,
        timmar: e.timmar,
        // Planerna (2026-10-07): fryst som rabatten. Timmarna på köpet
        // ingår i timmar och dras som de andra. Bara när vyn har kolumnen:
        // före migrationen finns den inte i klippkort heller.
        ...(e.timmar_pa_kopet != null ? { timmar_pa_kopet: Number(e.timmar_pa_kopet) || 0 } : {}),
        giltig_manader: e.giltig_manader,
        rabatt_procent: e.rabatt_procent,
        timpris_ore: e.timpris_ore,
        // Med en kod eller familjens rabatt räknar triggern om beloppet.
        begart_ore: attBetala,
        ...(rabattkod ? { rabattkod } : {}),
        // Hela raden tillbaka: familjerabatt_ore finns först efter migrationen.
      }).select('*').single();
      if (nyfel || !ny) return json({ error: 'Köpet gick inte att spara. Försök igen.' }, 500, CORS);
      kopId = String(ny.id);
      belopp = Number(ny.begart_ore);
      rabattPerTimme = Number(ny.familjerabatt_ore) || 0;
      /* Databasen tog bort koden (den tog slut emellan) och satte
         katalogens pris. Då öppnas ingen kassa: familjen trodde att
         koden gällde. Köpet står kvar som väntande och används inte. */
      if (rabattkod && belopp !== attBetala) {
        return json({ error: 'Koden gick inte att använda just nu. Försök igen, eller köp utan koden.' }, 409, CORS);
      }
    }

    const bas = egenAdress(kropp.retur, 'https://nextrum.se');
    const pk = kropp.ui === 'inbaddad' ? publicerbarNyckel() : null;
    const inbaddad = pk !== null;
    const efter = inbaddad
      ? { ui_mode: 'embedded', redirect_on_completion: 'if_required',
          return_url: `${bas}/foralder?kopt={CHECKOUT_SESSION_ID}#erbjudanden` }
      : { success_url: `${bas}/foralder?kopt={CHECKOUT_SESSION_ID}#erbjudanden`,
          cancel_url: `${bas}/foralder#erbjudanden` };

    const rad = kassarad(e as ErbjudandePris, rabattkod, rabattPerTimme);
    const session = await v1('POST', '/v1/checkout/sessions', {
      mode: 'payment',
      locale: 'sv',
      ...efter,
      // Samma två val som för ett pass, av samma skäl: se Deno.serve.
      payment_method_types: ['card'],
      managed_payments: { enabled: false },
      customer_email: prof.email ?? undefined,
      metadata: { klippkort_id: kopId, erbjudande: e.kod, ...(rabattkod ? { rabattkod } : {}) },
      line_items: [{
        quantity: 1,
        price_data: { currency: VALUTA, unit_amount: belopp, product_data: rad },
      }],
      payment_intent_data: {
        metadata: { klippkort_id: kopId, erbjudande: e.kod, ...(rabattkod ? { rabattkod } : {}) },
        statement_descriptor_suffix: descriptor(String(e.namn)),
        receipt_email: prof.email ?? undefined,
      },
    }, `nextrum-klippkort-${kopId}-${belopp}-f${SESSIONSFORM}-${inbaddad ? 'inbaddad' : 'sida'}`);

    await db.from('klippkort')
      .update({ stripe_session_id: String((session as { id?: string }).id ?? '') })
      .eq('id', kopId);

    const svar = { session: (session as { id?: string }).id, belopp_ore: belopp, klippkort: kopId,
                   rabatt_ore: Number(e.pris_ore) - belopp,
                   familjerabatt_ore: familjerabattPaKop(e as ErbjudandePris, rabattPerTimme).summa };
    return inbaddad
      ? json({ lage: 'inbaddad', client_secret: (session as { client_secret?: string }).client_secret ?? null,
               nyckel: pk, ...svar }, 200, CORS)
      : json({ lage: 'sida', url: (session as { url?: string }).url ?? null, ...svar }, 200, CORS);
  } catch (fel) {
    if (fel instanceof StripeError) {
      console.error('stripe-checkout: Stripe nekade erbjudandet', JSON.stringify({ erbjudande: kod, ...fel.fel }));
      return json({ error: 'Stripe nekade: ' + fel.fel.meddelande, stripe: fel.fel }, 502, CORS);
    }
    console.error('stripe-checkout: fel i erbjudandet', JSON.stringify({ erbjudande: kod, fel: (fel as Error)?.message ?? String(fel) }));
    return json({ error: (fel as Error)?.message ?? 'Okänt fel.' }, 500, CORS);
  }
}

/* ============================================================
   TIMMAR TILL PLANEN (2026-10-14, timmarna_delas_och_kops_till)

   Leo: "man kan köpa till timmar med plan men de går ut när månaden är
   slut. man ska kunna välja hur många timmar man köper, det ska finnas
   välj själv knapp och checkout för de specifika timmarna". Ett köp i
   klippkort som de andra, med erbjudandet plan_extra och till_plan:

   · PRISET RÄKNAS I DATABASEN, i extra_timmar_erbjudande() med den
     inloggades token: planens eget timpris och rabatt gånger timmarna,
     för den inloggades senaste plan som gäller minst en dag till.
     Anropet säger bara hur många timmar (1–20).
   · SISTA DAGEN ÄR PLANENS. klippkort_betald sätter den när köpet blir
     betalt, och kassan är öppen i högst ett dygn.
   · Ett väntande köp återanvänds bara för samma plan, samma timmar och
     samma pris, och planens sista dag står i idempotensnyckeln: raden i
     kassan säger den.
   ============================================================ */
async function köpTimmarTillPlanen(
  vem: Inloggad,
  kropp: { retur?: string; ui?: string; timmar?: unknown },
  epost: string | undefined,
): Promise<Response> {
  const timmar = extraTimmar(kropp.timmar);
  if (timmar === null) return json({ error: 'Välj mellan 1 och 20 timmar.' }, 400, CORS);

  const { data: x, error: xfel } = await vem.klient.rpc('extra_timmar_erbjudande', { p_timmar: timmar });
  if (xfel) {
    console.error('stripe-checkout: extra_timmar_erbjudande', JSON.stringify({ fel: xfel.message }));
    return json({ error: 'Priset gick inte att räkna. Försök igen om en stund.' }, 500, CORS);
  }
  const e = (x ?? {}) as {
    ok?: boolean; fel?: string; plan?: string; plan_namn?: string; timmar?: number; timpris_ore?: number;
    rabatt_procent?: number; rabatterat_timpris_ore?: number; pris_ore?: number; giltigt_till?: string;
    familjerabatt_ore?: number;
  };
  // Familjens rabatt per timme (familjerabatter, 2026-10-15), redan dragen
  // i pris_ore. Saknas den, före migrationen, är den noll.
  const rabattPerTimme = Number(e.familjerabatt_ore) > 0 ? Number(e.familjerabatt_ore) : 0;
  // Ett besked från databasen, skrivet för familjen: visas som det är.
  if (!e.ok) return json({ error: e.fel ?? 'Timmarna går inte att köpa just nu.' }, 409, CORS);
  if (!(Number(e.pris_ore) > 0) || !e.plan || !e.giltigt_till) {
    return json({ error: 'Timmarna går inte att köpa just nu.' }, 409, CORS);
  }

  const db = serviceklient();
  try {
    const { data: forut } = await db.from('klippkort')
      .select('*')
      .eq('parent_id', vem.anvandare).eq('erbjudande', 'plan_extra').eq('till_plan', e.plan)
      .eq('timmar', timmar).eq('status', 'vantar')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();

    const rad = kassaradTillPlanen({
      plan_namn: String(e.plan_namn ?? ''), timmar, rabatterat_timpris_ore: Number(e.rabatterat_timpris_ore),
      giltigt_till: String(e.giltigt_till), familjerabatt_ore: rabattPerTimme,
    });

    let kopId: string;
    if (kanAteranvandas(forut, Number(e.pris_ore))
        && Number(forut!.rabatt_procent) === Number(e.rabatt_procent)
        && Number(forut!.timpris_ore) === Number(e.timpris_ore)
        && (Number(forut!.familjerabatt_ore) || 0) === rabattPerTimme) {
      kopId = String(forut!.id);
    } else {
      const { data: ny, error: nyfel } = await db.from('klippkort').insert({
        parent_id: vem.anvandare,
        erbjudande: 'plan_extra',
        namn: rad.name,
        sort: 'klippkort',
        timmar,
        // Sista dagen sätts av klippkort_betald, ur planen.
        giltig_manader: 1,
        rabatt_procent: e.rabatt_procent,
        timpris_ore: e.timpris_ore,
        begart_ore: e.pris_ore,
        till_plan: e.plan,
        // Rabatten är redan dragen i priset; köpet säger hur mycket per timme.
        ...(rabattPerTimme > 0 ? { familjerabatt_ore: rabattPerTimme } : {}),
      }).select('id').single();
      if (nyfel || !ny) {
        console.error('stripe-checkout: köpet till planen', JSON.stringify({ fel: nyfel?.message }));
        return json({ error: 'Köpet gick inte att spara. Försök igen.' }, 500, CORS);
      }
      kopId = String(ny.id);
    }

    const bas = egenAdress(kropp.retur, 'https://nextrum.se');
    const pk = kropp.ui === 'inbaddad' ? publicerbarNyckel() : null;
    const inbaddad = pk !== null;
    const efter = inbaddad
      ? { ui_mode: 'embedded', redirect_on_completion: 'if_required',
          return_url: `${bas}/foralder?kopt={CHECKOUT_SESSION_ID}#erbjudanden` }
      : { success_url: `${bas}/foralder?kopt={CHECKOUT_SESSION_ID}#erbjudanden`,
          cancel_url: `${bas}/foralder#erbjudanden` };

    const session = await v1('POST', '/v1/checkout/sessions', {
      mode: 'payment',
      locale: 'sv',
      ...efter,
      // Samma två val som för ett pass, av samma skäl: se Deno.serve.
      payment_method_types: ['card'],
      managed_payments: { enabled: false },
      customer_email: epost,
      metadata: { klippkort_id: kopId, erbjudande: 'plan_extra' },
      line_items: [{
        quantity: 1,
        price_data: { currency: VALUTA, unit_amount: e.pris_ore, product_data: rad },
      }],
      payment_intent_data: {
        metadata: { klippkort_id: kopId, erbjudande: 'plan_extra' },
        statement_descriptor_suffix: descriptor(String(e.plan_namn ?? 'TIMMAR')),
        receipt_email: epost,
      },
    }, `nextrum-klippkort-${kopId}-${e.pris_ore}-${e.giltigt_till}-f${SESSIONSFORM}-${inbaddad ? 'inbaddad' : 'sida'}`);

    await db.from('klippkort')
      .update({ stripe_session_id: String((session as { id?: string }).id ?? '') })
      .eq('id', kopId);

    const svar = { session: (session as { id?: string }).id, belopp_ore: e.pris_ore, klippkort: kopId,
                   familjerabatt_ore: rabattPerTimme * timmar };
    return inbaddad
      ? json({ lage: 'inbaddad', client_secret: (session as { client_secret?: string }).client_secret ?? null,
               nyckel: pk, ...svar }, 200, CORS)
      : json({ lage: 'sida', url: (session as { url?: string }).url ?? null, ...svar }, 200, CORS);
  } catch (fel) {
    if (fel instanceof StripeError) {
      console.error('stripe-checkout: Stripe nekade timmarna till planen', JSON.stringify({ ...fel.fel }));
      return json({ error: 'Stripe nekade: ' + fel.fel.meddelande, stripe: fel.fel }, 502, CORS);
    }
    console.error('stripe-checkout: fel i timmarna till planen', JSON.stringify({ fel: (fel as Error)?.message ?? String(fel) }));
    return json({ error: (fel as Error)?.message ?? 'Okänt fel.' }, 500, CORS);
  }
}

/* ============================================================
   TILLÄGGET (Fas 20.1): övertiden på ett pass som redan var betalt

   Passet var betalt i förväg, med kort eller med timmar, och
   studiehjälparen skrev i rapporten att det drog över. Familjen betalar
   resten när de bekräftar rapporten. Leos val: inget dras automatiskt,
   och det är familjen som trycker.

   · MINUTERNA LÄSES UR passunderlag: debiterade_min är den hållna tiden
     per påbörjad kvart, betalda_min det familjen redan betalat för
     (kortet, timmarna, ett tidigare tillägg). Anropet säger bara vilket
     pass.
   · BELOPPET ÄR SKILLNADEN I PRIS, tillaggsbelopp() i pris.ts: samma
     timpris, samma tillägg för syskon, och rabatten dras en gång.
   · EN EGEN RAD I pass_tillagg, skapad före kassan med service_role.
     Passets betalningskolumner beskriver passets betalning, och
     webhooken skriver återbetalningar och tvister på den rad som bär
     chargen. Hade tillägget legat där hade en återbetalning av det
     skrivit över passets.
   · INGET client_reference_id och inget booking_id i metadata: webhooken
     läser båda som "det här passet är betalt". Tillägget bär
     tillagg_booking_id.
   ============================================================ */
type PassForTillagg = {
  id: string; parent_id: string | null; tutor_id: string | null; subject: string | null;
  wanted_date: string; tjanst: string | null; antal_barn: number | null; rabatt_ore: number | null;
  timpris_ore: number | null; extra_ore: number | null;
  status: string; betalning_status: string | null; fakturerbar: boolean;
};

async function betalaTillagg(
  vem: Inloggad,
  kropp: { retur?: string; ui?: string },
  pass: PassForTillagg,
): Promise<Response> {
  if (pass.status !== 'completed') {
    return json({ error: 'Ett tillägg betalas när passet är rapporterat.' }, 409, CORS);
  }
  if (!pass.fakturerbar) return json({ error: 'Passet är undantaget och ska inte betalas.' }, 409, CORS);
  if (pass.betalning_status !== 'betald') {
    return json({ error: 'Passet är inte betalt än. Betala passet, så kommer hela tiden med.' }, 409, CORS);
  }

  const db = serviceklient();
  try {
    const [{ data: underlag }, { data: forut }, { data: katalog }, { data: pris }] = await Promise.all([
      db.from('passunderlag').select('debiterade_min, betalda_min').eq('id', pass.id).maybeSingle(),
      db.from('pass_tillagg').select('status, begart_ore').eq('booking_id', pass.id).maybeSingle(),
      db.from('tjanster').select('kod, aktiv, for_kund, ordning, pris_per_timme_ore, extra_personer_ore, ersattning_per_timme_ore, rut_berattigad, rut_procent'),
      db.from('prissattning').select('pris_per_timme_ore').maybeSingle(),
    ]);

    if (forut?.status === 'betald' || forut?.status === 'tvist') {
      return json({ error: 'Tillägget är redan betalt.' }, 409, CORS);
    }
    /* Ett återbetalt tillägg är ett beslut Nextrum tagit, och en ny kassa
       hade rivit det. Samma regel som larmet tillagg_obetalt (Fas 20.4). */
    if (forut?.status === 'aterbetald') {
      return json({ error: 'Tillägget är återbetalt. Skriv till oss om något ska betalas.' }, 409, CORS);
    }
    const debiterade = Number(underlag?.debiterade_min ?? 0);
    const betalda = Number(underlag?.betalda_min ?? 0);
    if (!(debiterade > betalda)) return json({ error: 'Passet har inget tillägg att betala.' }, 409, CORS);

    // Samma pris som passet betalades med, fryst vid bokningen (Fas 19.5):
    // se Deno.serve nedan.
    const tjanster = (katalog ?? []) as Tjanst[];
    const tjanst = tjanster.find((t) => t.kod === pass.tjanst) ?? standardTjanst(tjanster) ?? undefined;
    const { timme: timprisOre, extra: extraOre } = passpris(pass, tjanst, Number(pris?.pris_per_timme_ore ?? 0));
    if (!timprisOre) return json({ error: 'Tjänsten saknar pris. Sätt det i adminvyn först.' }, 409, CORS);

    const minuter = debiterade - betalda;
    const belopp = tillaggsbelopp({
      debiteradeMin: debiterade, betaldaMin: betalda, timprisOre,
      extraOre,
      barn: Math.max(1, Number(pass.antal_barn || 1)),
      rabattOre: Number(pass.rabatt_ore || 0),
    });
    if (belopp <= 0) return json({ error: 'Passet har inget tillägg att betala.' }, 409, CORS);

    /* Raden skapas om den saknas och skrivs om bara medan tillägget är
       obetalt. Förut skrev upserten status 'vantar' utan villkor: hann
       webhooken sätta 'betald' mellan kontrollen ovan och skrivningen
       blev ett betalt tillägg obetalt igen. */
    const { error: nyfel } = await db.from('pass_tillagg').upsert({
      booking_id: pass.id, minuter, begart_ore: belopp, status: 'vantar',
    }, { onConflict: 'booking_id', ignoreDuplicates: true });
    if (nyfel) return json({ error: 'Tillägget gick inte att spara. Försök igen.' }, 500, CORS);
    const { data: skrevs, error: radfel } = await db.from('pass_tillagg')
      .update({ minuter, begart_ore: belopp, status: 'vantar' })
      .eq('booking_id', pass.id).in('status', ['vantar', 'misslyckad']).select('booking_id');
    if (radfel) return json({ error: 'Tillägget gick inte att spara. Försök igen.' }, 500, CORS);
    if (!skrevs?.length) return json({ error: 'Tillägget är redan betalt.' }, 409, CORS);

    const { data: kund } = await vem.klient
      .from('profiles').select('email').eq('id', vem.anvandare).maybeSingle();
    const bas = egenAdress(kropp.retur, 'https://nextrum.se');
    const pk = kropp.ui === 'inbaddad' ? publicerbarNyckel() : null;
    const inbaddad = pk !== null;
    const efter = inbaddad
      ? { ui_mode: 'embedded', redirect_on_completion: 'if_required',
          return_url: `${bas}/foralder?betalt={CHECKOUT_SESSION_ID}` }
      : { success_url: `${bas}/foralder?betalt={CHECKOUT_SESSION_ID}`,
          cancel_url: `${bas}/foralder?betalning=avbruten` };

    const metadata = { tillagg_booking_id: pass.id, minuter: String(minuter) };
    const session = await v1('POST', '/v1/checkout/sessions', {
      mode: 'payment',
      locale: 'sv',
      ...efter,
      // Samma två val som för passet, av samma skäl: se Deno.serve.
      payment_method_types: ['card'],
      managed_payments: { enabled: false },
      customer_email: kund?.email ?? undefined,
      metadata,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: VALUTA,
          unit_amount: belopp,
          product_data: {
            name: `Tillägg: ${radtext(pass.subject, String(pass.wanted_date))}`,
            description: `Passet drog över, ${minuter} minuter`,
          },
        },
      }],
      payment_intent_data: {
        metadata,
        statement_descriptor_suffix: descriptor(String(pass.subject ?? 'Laxhjalp')),
        receipt_email: kund?.email ?? undefined,
      },
    }, `nextrum-tillagg-${pass.id}-${belopp}-f${SESSIONSFORM}-${inbaddad ? 'inbaddad' : 'sida'}`);

    await db.from('pass_tillagg')
      .update({ stripe_session_id: String((session as { id?: string }).id ?? '') })
      .eq('booking_id', pass.id);

    const svar = { session: (session as { id?: string }).id, belopp_ore: belopp, minuter };
    return inbaddad
      ? json({ lage: 'inbaddad', client_secret: (session as { client_secret?: string }).client_secret ?? null,
               nyckel: pk, ...svar }, 200, CORS)
      : json({ lage: 'sida', url: (session as { url?: string }).url ?? null, ...svar }, 200, CORS);
  } catch (fel) {
    if (fel instanceof StripeError) {
      console.error('stripe-checkout: Stripe nekade tillägget', JSON.stringify({ pass: pass.id, ...fel.fel }));
      return json({ error: 'Stripe nekade: ' + fel.fel.meddelande, stripe: fel.fel }, 502, CORS);
    }
    console.error('stripe-checkout: fel i tillägget', JSON.stringify({ pass: pass.id, fel: (fel as Error)?.message ?? String(fel) }));
    return json({ error: (fel as Error)?.message ?? 'Okänt fel.' }, 500, CORS);
  }
}

/* ============================================================
   KORTET (kortet_reserveras, 2026-10-13)

   Leo: "när man klickar på boka pass eller godkänn förslaget från barnet
   ska man kunna betala nu, eller på faktura. då reserveras pengar från
   stripe och när passet har hållits och läxhjälparen har skrivit rapport
   så dras pengarna". Kortet sparas hos Stripe när familjen väljer det på
   ett pass, och stripe-reservation reserverar två dagar före passet och
   drar när rapporten finns (minne/betalning.md).

   · SPARA: en kassa i läget setup, på familjens kund hos Stripe. Den tar
     ingen betalning. Webhooken skriver kortet (kort_sparat) när kassan är
     klar, ur Stripes svar, aldrig ur vyn. Bara familjen, och bara med
     strömbrytaren kortreservation på.
   · TA BORT: kortet kopplas bort hos Stripe, reservationerna släpps av
     jobbet och valen glöms (kort_borttaget). Familjen tar bort sitt eget,
     admin en familjs. Går alltid, också med strömbrytaren av.

   KUNDEN är en per familj (stripe_kunder), utan namn och e-post: Stripe
   behöver en kund att spara kortet på, och familjens id i metadata räcker.
   ============================================================ */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function familjensKund(db: ReturnType<typeof serviceklient>, familj: string): Promise<string> {
  const { data: finns, error: lasfel } = await db.from('stripe_kunder')
    .select('stripe_kund').eq('parent_id', familj).maybeSingle();
  if (lasfel) throw new Error('stripe_kunder: ' + lasfel.message);
  if (finns?.stripe_kund) return String(finns.stripe_kund);

  // Två tryck samtidigt ger samma kund: nyckeln är familjens.
  const kund = await v1('POST', '/v1/customers', { metadata: { parent_id: familj } }, `nextrum-kund-${familj}`);
  const id = String(kund.id ?? '');
  if (!arStripeId(id, 'cus')) throw new Error('Stripe svarade utan en kund.');
  const { error: skrivfel } = await db.from('stripe_kunder').insert({ parent_id: familj, stripe_kund: id });
  if (skrivfel && skrivfel.code !== '23505') throw new Error('stripe_kunder: ' + skrivfel.message);
  // Hann ett annat anrop först står dess kund kvar, och den gäller.
  const { data: nu } = await db.from('stripe_kunder').select('stripe_kund').eq('parent_id', familj).maybeSingle();
  return String(nu?.stripe_kund ?? id);
}

async function kortet(
  vem: Inloggad,
  kropp: { kort?: string; retur?: string; ui?: string; familj?: string },
): Promise<Response> {
  // Barnet sparar och tar inte bort något kort (barnkonton_och_admin).
  if (vem.appMetadata?.roll === 'barn') return json({ error: 'Kortet sköts av föräldern.' }, 403, CORS);
  const db = serviceklient();

  try {
    if (kropp.kort === 'ta_bort') {
      let familj = vem.anvandare;
      if (kropp.familj !== undefined && kropp.familj !== vem.anvandare) {
        if (!UUID.test(String(kropp.familj))) return json({ error: 'Vilken familj?' }, 400, CORS);
        if (!await arAdmin(vem.klient, vem.anvandare)) {
          return json({ error: 'Bara admin tar bort en annan familjs kort.' }, 403, CORS);
        }
        familj = String(kropp.familj);
      }
      const { data: metod, error } = await db.rpc('kort_borttaget', { p_parent: familj });
      if (error) return json({ error: 'Kortet gick inte att ta bort. Försök igen.' }, 500, CORS);
      /* Raden är borta, och inget reserveras med kortet igen. Hos Stripe
         kopplas alla kort på familjens kund bort, också ett som blev kvar när
         kortet byttes. Det är städning: går det inte står kortet kvar på en
         kund ingen använder, och felet står i loggen. En reservation som står
         släpps av jobbet ändå, för den hålls på sitt PaymentIntent. */
      const metoder = new Set<string>(arStripeId(metod, 'pm') ? [metod] : []);
      const { data: kunden } = await db.from('stripe_kunder').select('stripe_kund').eq('parent_id', familj).maybeSingle();
      const kund = String(kunden?.stripe_kund ?? '');
      try {
        if (arStripeId(kund, 'cus')) {
          const lista = await v1('GET', `/v1/payment_methods?customer=${kund}&type=card&limit=20`) as { data?: { id?: string }[] };
          for (const x of lista.data ?? []) if (arStripeId(x.id, 'pm')) metoder.add(x.id);
        }
        for (const m of metoder) {
          await v1('POST', `/v1/payment_methods/${m}/detach`, {}, `nextrum-koppla-bort-${m}`)
            .catch((e) => {
              // Redan bortkopplat: inget att göra.
              if (!(e instanceof StripeError)) throw e;
              console.error('stripe-checkout: kortet kopplades inte bort', JSON.stringify({ familj, ...e.fel }));
            });
        }
      } catch (e) {
        if (!(e instanceof StripeError)) throw e;
        console.error('stripe-checkout: korten gick inte att läsa hos Stripe', JSON.stringify({ familj, ...e.fel }));
      }
      return json({ ok: true, borttaget: arStripeId(metod, 'pm') }, 200, CORS);
    }

    if (kropp.kort !== 'spara') return json({ error: 'Vad ska göras med kortet?' }, 400, CORS);

    const { data: prof } = await vem.klient
      .from('profiles').select('role').eq('id', vem.anvandare).maybeSingle();
    if (!prof || prof.role !== 'parent') return json({ error: 'Kortet sparas av familjen.' }, 403, CORS);
    const { data: flagga } = await db.from('flaggor').select('aktiv').eq('kod', 'kortreservation').maybeSingle();
    if (!flagga?.aktiv) {
      return json({ error: 'Kort går inte att spara just nu. Betala efter passet.' }, 409, CORS);
    }

    const kund = await familjensKund(db, vem.anvandare);
    const bas = egenAdress(kropp.retur, 'https://nextrum.se');
    const pk = kropp.ui === 'inbaddad' ? publicerbarNyckel() : null;
    const inbaddad = pk !== null;
    // Vyn läser kortet ur mitt_kort() när den kommer tillbaka: webhooken kan vara några sekunder efter.
    const efter = inbaddad
      ? { ui_mode: 'embedded', redirect_on_completion: 'if_required', return_url: `${bas}/foralder?kort={CHECKOUT_SESSION_ID}` }
      : { success_url: `${bas}/foralder?kort={CHECKOUT_SESSION_ID}`, cancel_url: `${bas}/foralder?kort=avbrutet` };
    const parametrar = {
      mode: 'setup',
      locale: 'sv',
      ...efter,
      customer: kund,
      // Bara kort, som kassan. Inga pengar dras här, så inget kvitto och ingen säljare att välja.
      payment_method_types: ['card'],
      metadata: { kort_parent: vem.anvandare },
      setup_intent_data: {
        metadata: { kort_parent: vem.anvandare },
        description: 'Kortet sparas för passen hos Nextrum',
      },
    };
    /* Ett dubbeltryck inom samma minut ger samma kassa. En kassa som redan
       är klar eller har gått ut går inte att öppna: då en ny, med en egen
       nyckel, som för passet. */
    const nyckel = `nextrum-kortkassa-${vem.anvandare}-${Math.floor(Date.now() / 60_000)}-${inbaddad ? 'inbaddad' : 'sida'}`;
    let session = await v1('POST', '/v1/checkout/sessions', parametrar, nyckel);
    if (String((session as { status?: string }).status ?? 'open') !== 'open') {
      session = await v1('POST', '/v1/checkout/sessions', parametrar, `${nyckel}-n${Date.now()}`);
    }
    const id = (session as { id?: string }).id;
    return inbaddad
      ? json({ lage: 'inbaddad', client_secret: (session as { client_secret?: string }).client_secret ?? null,
               nyckel: pk, session: id }, 200, CORS)
      : json({ lage: 'sida', url: (session as { url?: string }).url ?? null, session: id }, 200, CORS);
  } catch (fel) {
    if (fel instanceof StripeError) {
      console.error('stripe-checkout: Stripe nekade kortet', JSON.stringify({ kort: kropp.kort, ...fel.fel }));
      return json({ error: 'Stripe nekade: ' + fel.fel.meddelande, stripe: fel.fel }, 502, CORS);
    }
    console.error('stripe-checkout: fel med kortet', JSON.stringify({ kort: kropp.kort, fel: (fel as Error)?.message ?? String(fel) }));
    return json({ error: (fel as Error)?.message ?? 'Okänt fel.' }, 500, CORS);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(CORS);
  if (req.method !== 'POST') return json({ error: 'Bara POST.' }, 405, CORS);

  // Anroparens egen token först, alltid.
  const vem = await kravInloggad(req.headers.get('authorization'));
  if (!vem.ok) return vem.svar;

  let kropp: {
    pass?: string; retur?: string; ui?: string; erbjudande?: string; timmar?: unknown; tillagg?: boolean;
    kort?: string; familj?: string;
  } = {};
  try {
    kropp = await req.json();
  } catch {
    return json({ error: 'Kroppen är inte JSON.' }, 400, CORS);
  }
  // Ett erbjudande (Fas 16.1) är ett eget köp, inte ett pass.
  if (kropp.erbjudande !== undefined) return await köpErbjudande(vem, kropp);
  // Kortet som sparas eller tas bort (2026-10-13) är inte heller ett pass.
  if (kropp.kort !== undefined) return await kortet(vem, kropp);

  const passId = String(kropp.pass ?? '').trim();
  if (!passId) return json({ error: 'Vilket pass?' }, 400, CORS);

  /* Passet läses med den INLOGGADES token. RLS avgör om hen får se
     det; vi avgör om hen får betala det.

     SELECT-STRÄNGEN ÄR EN ENDA LITERAL, och det är inte en stilfråga.
     supabase-js tolkar strängen på TYPNIVÅ för att räkna ut radens
     form. Slås den ihop med + vidgar TypeScript den till `string`,
     tolkningen misslyckas, och varje fältåtkomst nedan blir
     "Property 'x' does not exist on type 'GenericStringError'".
     Kostade en röd CI-körning. fakturering/index.ts:220 gör rätt. */
  const { data: pass, error: passfel } = await vem.klient
    .from('bookings')
    .select('id, parent_id, tutor_id, subject, wanted_date, duration_min, tjanst, antal_barn, rabatt_ore, timpris_ore, extra_ore, startrabatt, status, betalning_status, stripe_session_id, fakturerbar, klippkort_id')
    .eq('id', passId)
    .maybeSingle();

  if (passfel) return json({ error: 'Passet gick inte att läsa.' }, 500, CORS);
  if (!pass) return json({ error: 'Passet finns inte.' }, 404, CORS);

  if (pass.parent_id !== vem.anvandare) {
    return json({ error: 'Det är familjen som betalar passet.' }, 403, CORS);
  }
  /* 'completed' släpps in sedan Fas 14.1, och det är inte en uppmjukning.
     Förut kunde ett genomfört obetalt pass ALDRIG betalas: funktionen
     svarade 409 och det fanns ingen annan väg in. Med månadsfakturan
     borta hade det blivit en skuld utan betalningssätt.

     'requested' släpps fortfarande INTE in. Att ta betalt innan
     motparten tackat ja betyder en återbetalning för varje pass som
     studiehjälparen nekar, och varje återbetalning är en kortavgift vi
     inte får tillbaka. Se filhuvudet. */
  if (pass.status !== 'confirmed' && pass.status !== 'completed') {
    return json({ error: 'Passet betalas när det är bekräftat.' }, 409, CORS);
  }
  if (!pass.tutor_id) {
    return json({ error: 'Passet har ingen studiehjälpare än.' }, 409, CORS);
  }
  // Övertiden på ett pass som redan var betalt (Fas 20.1) är ett eget köp.
  if (kropp.tillagg === true) return await betalaTillagg(vem, kropp, pass);
  /* EN TILLÅT-LISTA, INTE ETT UNDANTAG (Fas 14.6). Här stod bara
     "neka 'betald'". Allt annat släpptes in och fick 'vantar' skrivet
     över sig: en tvist blev en öppen kassa, en återbetalning likaså.
     Ett pass som ska betalas med kort står i ett av tre lägen, och bara
     de släpps in. (Ett fakturapass släpptes också in, från Fas 14.6 tills
     fakturan togs bort 2026-10-21.) */
  if (pass.betalning_status === 'betald') {
    return json({ error: 'Passet är redan betalt.' }, 409, CORS);
  }
  if (!['ingen', 'vantar', 'misslyckad'].includes(String(pass.betalning_status ?? 'ingen'))) {
    return json({ error: 'Passet har en återbetalning eller en tvist och kan inte betalas här. Skriv till oss.' }, 409, CORS);
  }
  if (!pass.fakturerbar) {
    return json({ error: 'Passet är undantaget och ska inte betalas.' }, 409, CORS);
  }

  const db = serviceklient();

  try {
    // ---------- beloppet, ur databasen ----------
    const [{ data: katalog }, { data: pris }] = await Promise.all([
      // En literal, av samma skäl som selecten ovan.
      db.from('tjanster').select('kod, aktiv, for_kund, ordning, pris_per_timme_ore, extra_personer_ore, ersattning_per_timme_ore, rut_berattigad, rut_procent'),
      db.from('prissattning').select('pris_per_timme_ore').maybeSingle(),
    ]);

    const tjanster = (katalog ?? []) as Tjanst[];
    const standard = standardTjanst(tjanster);
    const tjanst = tjanster.find((t) => t.kod === pass.tjanst) ?? standard ?? undefined;

    /* PRISET ÄR DET SOM FRYSTES VID BOKNINGEN (Fas 19.5). Villkoren
       lovar priset vid bokningen, och här räknades förut dagens pris:
       höjdes priset mellan bokningen och betalningen drog kortet mer än
       vi lovat. Tjänstens pris är bara reserven, för ett pass som saknar
       det frysta. */
    const { timme: timprisOre, extra: extraOre } =
      passpris(pass, tjanst, Number(pris?.pris_per_timme_ore ?? 0));
    /* FAS 20.1: ETT GENOMFÖRT PASS KOSTAR DEN TID DET HÖLLS. Rapporten
       bär tiden, per påbörjad kvart, och passunderlag läser den. Ett
       bekräftat pass som betalas i förväg kostar det bokade; drar det
       över betalas resten som ett tillägg. Minuterna följer med i
       metadata, så att webhooken kan skriva vad betalningen avsåg. */
    let minuter = Number(pass.duration_min || 60);
    if (pass.status === 'completed') {
      /* Fas 22.1: övertiden timbanken tog när rapporten skrevs är
         betald, med minuter familjen redan köpt. Kortet tar resten. */
      const { data: underlag } = await db.from('passunderlag')
        .select('debiterade_min, timbank_min').eq('id', pass.id).maybeSingle();
      minuter = Number(underlag?.debiterade_min || minuter) - Number(underlag?.timbank_min || 0);
    }
    const barn = Math.max(1, Number(pass.antal_barn || 1));

    if (!timprisOre) {
      return json({ error: 'Tjänsten saknar pris. Sätt det i adminvyn först.' }, 409, CORS);
    }

    const brutto = familjebelopp(minuter, timprisOre, extraOre, barn);
    // Rabatten är fryst vid bokningen och räknas aldrig om här.
    const rabatt = Math.min(Math.max(Number(pass.rabatt_ore || 0), 0), brutto);
    const netto = brutto - rabatt;

    /* Första timmen bjuds (Fas 19.5): ett pass på en timme kan kosta
       ingenting. Det ska inte betalas, och vyn visar ingen knapp för det. */
    if (netto <= 0) {
      return json({
        error: pass.startrabatt
          ? 'Passet kostar ingenting: första timmen är på köpet.'
          : 'Passets belopp blir noll.',
      }, 409, CORS);
    }

    // ---------- sessionen ----------
    const { data: kund } = await vem.klient
      .from('profiles').select('email').eq('id', vem.anvandare).maybeSingle();

    /* Familjens rabatt (familjerabatter, 2026-10-15) är redan dragen i det
       frysta timpriset; raden säger den, för kassan är där familjen ser att
       den har rabatt. En egen fråga, så att kassan tål att kolumnen saknas. */
    const { data: frys } = await vem.klient
      .from('bookings').select('familjerabatt_ore').eq('id', pass.id).maybeSingle();
    const rabattPerTimme = Number((frys as { familjerabatt_ore?: number | null } | null)?.familjerabatt_ore) || 0;

    const bas = egenAdress(kropp.retur, 'https://nextrum.se');
    const text = radtext(pass.subject, String(pass.wanted_date));

    // Inbäddad bara när vyn ber om det OCH nyckeln finns. Se ovan.
    const pk = kropp.ui === 'inbaddad' ? publicerbarNyckel() : null;
    const inbaddad = pk !== null;

    /* Vart familjen tar vägen efteråt. Stripes sida skickar tillbaka
       till en av två adresser. Den inbäddade kassan stannar på sidan
       när betalningen är klar (redirect_on_completion 'if_required':
       ett kort behöver aldrig lämna sidan, också 3D Secure sker i
       ramen), och vyn får beskedet genom onComplete. return_url är
       Stripes krav för ett betalsätt som måste lämna sidan; med bara
       kort används den inte, men den pekar på samma besked som förut. */
    const efter = inbaddad
      ? {
        ui_mode: 'embedded',
        redirect_on_completion: 'if_required',
        return_url: `${bas}/foralder?betalt={CHECKOUT_SESSION_ID}`,
      }
      : {
        success_url: `${bas}/foralder?betalt={CHECKOUT_SESSION_ID}`,
        cancel_url: `${bas}/foralder?betalning=avbruten`,
      };

    const parametrar = {
      mode: 'payment',
      locale: 'sv',
      ...efter,
      /* BARA KORT (punkt 6 på MVP-listan, Fas 14.3). Utan raden väljer
         Stripe betalsätt ur dashboardens inställningar, och slås Klarna
         eller Swish på där erbjuds de här. Båda kan bli klara först i
         efterhand: sessionen fullbordas som obetald och pengarna kommer
         med checkout.session.async_payment_succeeded, en händelse
         webhooken inte lyssnar på. Familjen hade betalat och passet
         stått som obetalt för alltid. Villkoren säger kort, och det är
         det som tas emot. Apple Pay och Google Pay är kort i plånbok och
         följer med. */
      payment_method_types: ['card'],
      /* NEXTRUM SÄLJER, INTE STRIPE (Fas 14.4). Kontot hade Managed
         Payments påslaget som förval, och då är Stripe säljaren gentemot
         familjen: Stripe står på köpet, sköter tvisterna och tar en
         avgift till ovanpå kortavgiften. Det är byggt för digitala
         produkter, inte för ett pass med en människa, och det motsäger
         villkoren, där Nextrum är den familjen köper av och den som
         tar emot hela beloppet. Med förvalet på nekade Stripe dessutom
         receipt_email nedan, och kassan gick inte att öppna alls.

         Valet står här och inte bara i dashboarden, av samma skäl som
         payment_method_types: ett förval någon slår om hos Stripe ska
         inte kunna byta säljare på våra betalningar. */
      managed_payments: { enabled: false },
      customer_email: kund?.email ?? undefined,
      // Passets id följer med hela vägen, så att webhooken vet vilken
      // rad som ska ändras utan att gissa.
      client_reference_id: pass.id,
      metadata: { booking_id: pass.id, tutor_id: pass.tutor_id, minuter: String(minuter) },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: VALUTA,
          unit_amount: netto,
          product_data: {
            name: `${text}${barn > 1 ? ` (${barn} barn)` : ''}`,
            description: `Läxhjälp, ${minuter} minuter`
              + (pass.startrabatt && rabatt > 0 ? ', första timmen på köpet' : '')
              + (rabattPerTimme > 0 ? `, med er rabatt på ${Math.round(rabattPerTimme / 100)} kr per timme` : ''),
          },
        },
      }],
      payment_intent_data: {
        /* Varken transfer_data eller application_fee_amount, och inte
           on_behalf_of heller. Hela beloppet stannar hos Nextrum, som
           är den betalningsansvariga verksamheten. Studiehjälparen är
           inte part i den här betalningen alls; hen får sitt den 25:e
           genom payouts. Se filhuvudet. */
        metadata: { booking_id: pass.id, tutor_id: pass.tutor_id },
        statement_descriptor_suffix: descriptor(String(pass.subject ?? 'Laxhjalp')),
        /* Kvittot (punkt 10). Med adressen satt skickar Stripe kvittot i
           skarpt läge oavsett inställningen under Settings → Emails, så
           det hänger inte på att någon kommit ihåg en kryssruta. I
           testläge skickas inga kvitton alls. */
        receipt_email: kund?.email ?? undefined,
      },
    };
    // En idempotensnyckel per pass OCH belopp. Klickar familjen två
    // gånger får de samma session. Ändras beloppet (rabatt, ny tjänst)
    // blir det en ny, för det är en annan betalning.
    //
    // SESSIONSFORM står i nyckeln för att Stripe vägrar en nyckel som
    // återanvänds med ANDRA parametrar inom ett dygn: den som klickat
    // Betala före en driftsättning som ändrar sessionen hade annars fått
    // ett idempotensfel i stället för en kassa. Räkna upp den när
    // parametrarna ovan ändras. Kassans sort står med av samma skäl:
    // en inbäddad och en på Stripes sida är olika parametrar, och vyn
    // kan be om den ena efter den andra för samma pass.
    const nyckel = `nextrum-pass-${pass.id}-${netto}-f${SESSIONSFORM}-${inbaddad ? 'inbaddad' : 'sida'}`;
    let session = await v1('POST', '/v1/checkout/sessions', parametrar, nyckel);

    /* EN ÅTERANVÄND NYCKEL KAN GE EN STÄNGD KASSA (2026-09-29). Stripe
       minns svaret på en idempotensnyckel i ett dygn och lämnar ut det
       igen, också när kassan det beskriver har stängts sedan dess. Gick
       beloppet från A till B och tillbaka till A (en rapport som rättas)
       fick familjen A-kassan igen, som stängdes när B skapades: en kassa
       som inte gick att öppna, i upp till ett dygn.

       Är kassan inte den passet redan bär frågas Stripe om den är
       öppen. Är den stängd skapas en ny med en egen nyckel. Är den
       betald är passet betalt med den, och webhooken är på väg. */
    const förra = String(pass.stripe_session_id ?? '');
    const fåttId = String((session as { id?: string }).id ?? '');
    if (fåttId && fåttId !== förra) {
      const läge = String((await v1('GET', `/v1/checkout/sessions/${fåttId}`) as { status?: string }).status ?? '');
      if (läge === 'complete') {
        return json({ error: 'Passet har just betalats. Ladda om sidan.' }, 409, CORS);
      }
      if (läge === 'expired') {
        session = await v1('POST', '/v1/checkout/sessions', parametrar, `${nyckel}-n${Date.now()}`);
      }
    }

    // ---------- vad vi BAD om skrivs ner ----------
    /* Först nu, och bara med service_role. Skrivningen kan inte göras
       från en inloggad session: bookings-triggern är en tillåt-lista
       och kolumnerna står inte i den. */

    /* HÄR SKREVS FÖRUT betalt_ore, OCH DET VAR FEL (rättat i Fas 14.1).
       Ingen har betalat något när en session skapas. Siffran var vårt
       påstående, och den lästes som ett kvitto: adminvyn visade den,
       stripe-aterbetalning använde den som tak, och bokföringen hade
       fått den.

       Skillnaden blir verklig så fort beloppet ändras mellan att
       sessionen skapas och att familjen betalar. Ändras rabatten eller
       längden får passet en NY session med ett nytt belopp, men den
       gamla sessionen ligger kvar öppen hos Stripe tills den går ut.
       Betalar familjen den gamla har de betalat ett annat belopp än
       det vi hade skrivit.

       betalt_ore skrivs nu av webhooken, ur sessionens amount_total,
       alltså vad Stripe faktiskt drog. Här står bara vad vi begärde.

       ersattning_ore och avgift_ore lämnas orörda med flit:
       studiehjälparens ersättning räknas av fakturering ur rapporten,
       och två källor till samma siffra är en siffra ingen kan lita på.

       SKRIVNINGEN KRÄVER ATT PASSET FORTFARANDE ÄR OBETALT (Fas 22.1).
       Passet lästes innan sessionen skapades, och under tiden kan familjen
       ha betalat det med timmar eller timbanken. Utan
       villkoret skrev 'vantar' över 'betald': timmarna var dragna och
       passet stod som obetalt, och betalade familjen sedan kassan togs
       passet två gånger. Nu träffar skrivningen ingenting, och kassan som
       just skapades stängs innan någon hunnit se den. */
    const sessionId = String((session as { id?: string }).id ?? '');
    const { data: skrivna, error: sparfel } = await db.from('bookings').update({
      betalning_status: 'vantar',
      stripe_session_id: sessionId,
      begart_ore: netto,
    }).eq('id', pass.id)
      .in('betalning_status', ['ingen', 'vantar', 'misslyckad']).select('id');

    if (!sparfel && !skrivna?.length) {
      try {
        await v1('POST', `/v1/checkout/sessions/${sessionId}/expire`);
      } catch (e) {
        /* En kassa som redan betalats eller gått ut kan inte stängas. Det
           händer när familjen betalat samma kassa i en annan flik, och då
           är passet betalt med just den. */
        if (!(e instanceof StripeError)) {
          console.error('stripe-checkout: kassan stängdes inte', JSON.stringify({ pass: pass.id, fel: (e as Error)?.message }));
        }
      }
      return json({ error: 'Passet har just betalats, eller fått ett annat betalsätt. Ladda om sidan.' }, 409, CORS);
    }

    if (sparfel) {
      /* Sessionen finns hos Stripe men raden vet inte om den. Det är
         inte tyst-bart: betalar familjen nu hittar webhooken passet
         via metadata ändå, men adminvyn hade visat "obetald" på ett
         pass som är på väg att betalas. */
      return json({
        error: 'Betalningen skapades men kunde inte sparas. Kontakta oss innan du betalar.',
        detalj: sparfel.message,
        session: (session as { id?: string }).id,
      }, 500, CORS);
    }

    /* DEN FÖRRA KASSAN STÄNGS. Passet bär bara en session åt gången, men
       Stripe glömmer inte den förra: stod den öppen i en annan flik, eller
       skapades den med ett annat belopp (förbetalt, sedan den hållna
       tiden), kunde familjen betala båda och kortet dras två gånger. En
       kassa som redan betalats eller gått ut går inte att stänga; det felet
       är väntat och sväljs. */
    if (förra && förra !== sessionId) {
      try {
        await v1('POST', `/v1/checkout/sessions/${förra}/expire`);
      } catch (e) {
        if (!(e instanceof StripeError)) {
          console.error('stripe-checkout: förra kassan stängdes inte', JSON.stringify({ pass: pass.id, fel: (e as Error)?.message }));
        }
      }
    }

    /* Den inbäddade kassan har ingen adress, bara en client_secret som
       vyn ger Stripe.js. Den och den publicerbara nyckeln är allt vyn
       behöver; ingen av dem går att använda till något annat än att
       betala just det här passet. */
    if (inbaddad) {
      return json({
        lage: 'inbaddad',
        client_secret: (session as { client_secret?: string }).client_secret ?? null,
        nyckel: pk,
        session: (session as { id?: string }).id,
        belopp_ore: netto,
      }, 200, CORS);
    }
    return json({
      lage: 'sida',
      url: (session as { url?: string }).url ?? null,
      session: (session as { id?: string }).id,
      belopp_ore: netto,
    }, 200, CORS);
  } catch (e) {
    /* Felet skrivs också till funktionens logg. Förut stod Stripes svar
       bara i familjens ruta i webbläsaren: fem nekade betalningar på två
       dagar syntes i loggen som "502" och ingenting mer, och ingen hos
       oss kunde läsa varför. Stripes text innehåller varken nyckeln eller
       kortet; passets id står med för att kunna hitta raden. */
    if (e instanceof StripeError) {
      console.error('stripe-checkout: Stripe nekade', JSON.stringify({ pass: passId, ...e.fel }));
      return json({ error: 'Stripe nekade: ' + e.fel.meddelande, stripe: e.fel }, 502, CORS);
    }
    console.error('stripe-checkout: fel', JSON.stringify({ pass: passId, fel: (e as Error)?.message ?? String(e) }));
    return json({ error: (e as Error)?.message ?? 'Okänt fel.' }, 500, CORS);
  }
});
