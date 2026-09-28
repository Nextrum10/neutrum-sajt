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
// invoices och payouts med flit saknar INSERT-policy för användare:
// kan ingen skicka in ett belopp kan ingen skicka in fel belopp.
//
// Räkningen lånas ur _delad/pris.ts, den som faktureringen redan
// använder och som pris_test.ts vaktar. En andra kopia av prislogiken
// hade glidit isär från den första, precis som de sju esc() gjorde.
// ============================================================

import { type Inloggad, kravInloggad, serviceklient } from '../_delad/auth.ts';
import { cors, json, preflight } from '../_delad/http.ts';
import { StripeError, v1, VALUTA } from '../_delad/stripe.ts';
import { familjebelopp, passpris, radtext, standardTjanst, tillaggsbelopp, type Tjanst } from '../_delad/pris.ts';
import { arErbjudandekod, type ErbjudandePris, kanAteranvandas, kassarad } from '../_delad/erbjudanden.ts';

const CORS = cors();

/* Räknas upp när sessionens parametrar ändras. Se idempotensnyckeln.
   2: bara kort och kvitto till familjens adress (Fas 14.3).
   3: Managed Payments uttryckligen av (Fas 14.4).
   4: kassan kan bäddas in i föräldravyn (Fas 14.5).
   5: raden säger när första timmen är på köpet (Fas 19.5).
   6: minuterna betalningen avser står i metadata (Fas 20.1). */
const SESSIONSFORM = 6;

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

/* Kontoutdragets text. Stripe tillåter varken <>'"* eller tecken
   utanför latin-1, och svarar med ett fel i stället för att kapa.

   HÖGST TIO TECKEN (Fas 14.3). Det här är bara tillägget: Stripe
   sätter kontots förkortade namn framför, plus "* ", och hela raden får
   vara högst 22 tecken. Förkortningen får vara upp till tio, så tio
   kvar till ämnet är det enda som alltid ryms. Förut kapades vid 22,
   och "SAMHALLSKUNSKAP" efter "NEXTRUM* " blev 24 — en betalning som
   Stripe hade nekat för ett ämne. */
function descriptor(s: string): string {
  const rent = s
    .replace(/[åäÅÄ]/g, 'A').replace(/[öÖ]/g, 'O').replace(/[éèÉÈ]/g, 'E')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  return rent.slice(0, 10).trim() || 'LAXHJALP';
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
   ============================================================ */
async function köpErbjudande(
  vem: Inloggad,
  kropp: { retur?: string; ui?: string; erbjudande?: string },
): Promise<Response> {
  const kod = String(kropp.erbjudande ?? '').trim();
  if (!arErbjudandekod(kod)) return json({ error: 'Vilket erbjudande?' }, 400, CORS);

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
  const { data: e } = await vem.klient
    .from('erbjudanden_pris')
    .select('kod, sort, namn, timmar, rabatt_procent, giltig_manader, timpris_ore, pris_ore')
    .eq('kod', kod)
    .maybeSingle();
  if (!e || !(Number(e.pris_ore) > 0)) return json({ error: 'Erbjudandet finns inte.' }, 404, CORS);

  try {
    /* Trycker familjen Köp två gånger ska det bli ETT köp. Ett väntande
       köp av samma erbjudande, till samma pris och yngre än ett dygn,
       återanvänds — och därmed samma idempotensnyckel hos Stripe. */
    const { data: forut } = await db.from('klippkort')
      .select('id, begart_ore, created_at')
      .eq('parent_id', vem.anvandare).eq('erbjudande', kod).eq('status', 'vantar')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();

    let kopId: string;
    if (kanAteranvandas(forut, Number(e.pris_ore))) {
      kopId = String(forut!.id);
    } else {
      const { data: ny, error: nyfel } = await db.from('klippkort').insert({
        parent_id: vem.anvandare,
        erbjudande: e.kod,
        namn: e.namn,
        sort: e.sort,
        timmar: e.timmar,
        giltig_manader: e.giltig_manader,
        rabatt_procent: e.rabatt_procent,
        timpris_ore: e.timpris_ore,
        begart_ore: e.pris_ore,
      }).select('id').single();
      if (nyfel || !ny) return json({ error: 'Köpet gick inte att spara. Försök igen.' }, 500, CORS);
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

    const rad = kassarad(e as ErbjudandePris);
    const session = await v1('POST', '/v1/checkout/sessions', {
      mode: 'payment',
      locale: 'sv',
      ...efter,
      // Samma två val som för ett pass, av samma skäl: se Deno.serve.
      payment_method_types: ['card'],
      managed_payments: { enabled: false },
      customer_email: prof.email ?? undefined,
      metadata: { klippkort_id: kopId, erbjudande: e.kod },
      line_items: [{
        quantity: 1,
        price_data: { currency: VALUTA, unit_amount: e.pris_ore, product_data: rad },
      }],
      payment_intent_data: {
        metadata: { klippkort_id: kopId, erbjudande: e.kod },
        statement_descriptor_suffix: descriptor(String(e.namn)),
        receipt_email: prof.email ?? undefined,
      },
    }, `nextrum-klippkort-${kopId}-${e.pris_ore}-f${SESSIONSFORM}-${inbaddad ? 'inbaddad' : 'sida'}`);

    await db.from('klippkort')
      .update({ stripe_session_id: String((session as { id?: string }).id ?? '') })
      .eq('id', kopId);

    const svar = { session: (session as { id?: string }).id, belopp_ore: e.pris_ore, klippkort: kopId };
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(CORS);
  if (req.method !== 'POST') return json({ error: 'Bara POST.' }, 405, CORS);

  // Anroparens egen token först, alltid.
  const vem = await kravInloggad(req.headers.get('authorization'));
  if (!vem.ok) return vem.svar;

  let kropp: { pass?: string; retur?: string; ui?: string; erbjudande?: string; tillagg?: boolean } = {};
  try {
    kropp = await req.json();
  } catch {
    return json({ error: 'Kroppen är inte JSON.' }, 400, CORS);
  }
  // Ett erbjudande (Fas 16.1) är ett eget köp, inte ett pass.
  if (kropp.erbjudande !== undefined) return await köpErbjudande(vem, kropp);

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
     de släpps in, plus ett fakturapass som inte står på en faktura än
     (nedan). */
  if (pass.betalning_status === 'betald') {
    return json({ error: 'Passet är redan betalt.' }, 409, CORS);
  }
  const påFaktura = pass.betalning_status === 'faktura';
  if (!påFaktura && !['ingen', 'vantar', 'misslyckad'].includes(String(pass.betalning_status ?? 'ingen'))) {
    return json({ error: 'Passet har en återbetalning eller en tvist och kan inte betalas här. Skriv till oss.' }, 409, CORS);
  }
  if (!pass.fakturerbar) {
    return json({ error: 'Passet är undantaget och ska inte betalas.' }, 409, CORS);
  }

  const db = serviceklient();

  /* ETT FAKTURAPASS BETALAS MED KORT I SAMMA TRYCK (2026-09-28). Leo:
     "trycker man på betala nu ska man komma vidare till stripe och
     passet kan räknas som betalt efter att man betalat det". Förut
     nekade funktionen ett fakturapass, och vyn bytte därför först
     passet till obetalt: rapporten kom tillbaka under Bekräfta rapport,
     och stängdes kassan utan betalning hade passet inget betalsätt kvar.

     Nu står passet kvar som 'faktura' medan kassan är öppen (skrivningen
     nedan rör inte läget), och webhooken skriver 'betald' när kortet
     dragits: 'faktura' står i dess TAR_EMOT_BETALNING sedan Fas 14.6.
     Stängs kassan betalas passet mot fakturan, som familjen valt.
     Månadskörningen tar bara 'faktura', så ett pass som betalats med
     kort kommer aldrig med på en faktura.

     Står passet redan på en faktura, också ett utkast, betalas det
     genom den: samma regel som skydda_bokningsfalt har för bytet
     tillbaka till kort. Hinner månadskörningen lägga passet på fakturan
     medan kassan står öppen, och familjen betalar ändå, larmar
     betald_och_fakturerad. */
  if (påFaktura) {
    const { data: rader, error: radfel } = await db.from('invoice_lines')
      .select('id').eq('booking_id', pass.id).limit(1);
    if (radfel) return json({ error: 'Passet gick inte att läsa.' }, 500, CORS);
    if (rader?.length) {
      return json({ error: 'Passet står redan på en faktura och betalas genom den.' }, 409, CORS);
    }
  }

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

    const session = await v1('POST', '/v1/checkout/sessions', {
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
              + (pass.startrabatt && rabatt > 0 ? ', första timmen på köpet' : ''),
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
    }, `nextrum-pass-${pass.id}-${netto}-f${SESSIONSFORM}-${inbaddad ? 'inbaddad' : 'sida'}`);

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
       ha betalat det med timmar eller timbanken, eller valt faktura. Utan
       villkoret skrev 'vantar' över 'betald': timmarna var dragna och
       passet stod som obetalt, och betalade familjen sedan kassan togs
       passet två gånger. Nu träffar skrivningen ingenting, och kassan som
       just skapades stängs innan någon hunnit se den.

       Ett fakturapass får inget 'vantar' (se ovan): det betalas mot
       fakturan tills kortet är draget. Villkoret är då att det
       fortfarande är ett fakturapass. */
    const sessionId = String((session as { id?: string }).id ?? '');
    const { data: skrivna, error: sparfel } = await db.from('bookings').update({
      ...(påFaktura ? {} : { betalning_status: 'vantar' }),
      stripe_session_id: sessionId,
      begart_ore: netto,
    }).eq('id', pass.id)
      .in('betalning_status', påFaktura ? ['faktura'] : ['ingen', 'vantar', 'misslyckad']).select('id');

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
    const förra = String(pass.stripe_session_id ?? '');
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
