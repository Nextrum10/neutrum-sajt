// ============================================================
// NEXTRUM — stripe-checkout (Fas 12.2, ombyggd i Fas 12.5)
//
// Familjens kortbetalning för ETT pass. HELA beloppet landar hos
// Nextrum. Ingen destination, ingen application fee, inget anslutet
// konto inblandat.
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

import { kravInloggad, serviceklient } from '../_delad/auth.ts';
import { cors, json, preflight } from '../_delad/http.ts';
import { StripeError, v1, VALUTA } from '../_delad/stripe.ts';
import { familjebelopp, radtext, standardTjanst, type Tjanst } from '../_delad/pris.ts';

const CORS = cors();

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
   utanför latin-1, och svarar med ett fel i stället för att kapa. */
function descriptor(s: string): string {
  const rent = s
    .replace(/[åäÅÄ]/g, 'A').replace(/[öÖ]/g, 'O').replace(/[éèÉÈ]/g, 'E')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  return rent.slice(0, 22) || 'LAXHJALP';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(CORS);
  if (req.method !== 'POST') return json({ error: 'Bara POST.' }, 405, CORS);

  // Anroparens egen token först, alltid.
  const vem = await kravInloggad(req.headers.get('authorization'));
  if (!vem.ok) return vem.svar;

  let kropp: { pass?: string; retur?: string } = {};
  try {
    kropp = await req.json();
  } catch {
    return json({ error: 'Kroppen är inte JSON.' }, 400, CORS);
  }
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
    .select('id, parent_id, tutor_id, subject, wanted_date, duration_min, tjanst, antal_barn, rabatt_ore, status, betalning_status, stripe_session_id, fakturerbar')
    .eq('id', passId)
    .maybeSingle();

  if (passfel) return json({ error: 'Passet gick inte att läsa.' }, 500, CORS);
  if (!pass) return json({ error: 'Passet finns inte.' }, 404, CORS);

  if (pass.parent_id !== vem.anvandare) {
    return json({ error: 'Det är familjen som betalar passet.' }, 403, CORS);
  }
  if (pass.status !== 'confirmed') {
    return json({ error: 'Passet betalas när det är bekräftat.' }, 409, CORS);
  }
  if (!pass.tutor_id) {
    return json({ error: 'Passet har ingen studiehjälpare än.' }, 409, CORS);
  }
  if (pass.betalning_status === 'betald') {
    return json({ error: 'Passet är redan betalt.' }, 409, CORS);
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

    const timprisOre = Number(tjanst?.pris_per_timme_ore ?? 0)
      || Number(pris?.pris_per_timme_ore ?? 0);
    const extraOre = Number(tjanst?.extra_personer_ore ?? 0);
    const minuter = Number(pass.duration_min || 60);
    const barn = Math.max(1, Number(pass.antal_barn || 1));

    if (!timprisOre) {
      return json({ error: 'Tjänsten saknar pris. Sätt det i adminvyn först.' }, 409, CORS);
    }

    const brutto = familjebelopp(minuter, timprisOre, extraOre, barn);
    // Rabatten är fryst vid bokningen och räknas aldrig om här.
    const rabatt = Math.min(Math.max(Number(pass.rabatt_ore || 0), 0), brutto);
    const netto = brutto - rabatt;

    if (netto <= 0) return json({ error: 'Passets belopp blir noll.' }, 409, CORS);

    // ---------- sessionen ----------
    const { data: kund } = await vem.klient
      .from('profiles').select('email').eq('id', vem.anvandare).maybeSingle();

    const bas = egenAdress(kropp.retur, 'https://nextrum.se');
    const text = radtext(pass.subject, String(pass.wanted_date));

    const session = await v1('POST', '/v1/checkout/sessions', {
      mode: 'payment',
      locale: 'sv',
      customer_email: kund?.email ?? undefined,
      // Passets id följer med hela vägen, så att webhooken vet vilken
      // rad som ska ändras utan att gissa.
      client_reference_id: pass.id,
      metadata: { booking_id: pass.id, tutor_id: pass.tutor_id },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: VALUTA,
          unit_amount: netto,
          product_data: {
            name: `${text}${barn > 1 ? ` (${barn} barn)` : ''}`,
            description: `Läxhjälp, ${minuter} minuter`,
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
      },
      success_url: `${bas}/foralder?betalt={CHECKOUT_SESSION_ID}`,
      cancel_url: `${bas}/foralder?betalning=avbruten`,
    // En idempotensnyckel per pass OCH belopp. Klickar familjen två
    // gånger får de samma session. Ändras beloppet (rabatt, ny tjänst)
    // blir det en ny, för det är en annan betalning.
    }, `nextrum-pass-${pass.id}-${netto}`);

    // ---------- beloppen fryses ----------
    /* Först nu, och bara med service_role. Skrivningen kan inte göras
       från en inloggad session: bookings-triggern är en tillåt-lista
       och kolumnerna står inte i den. */
    /* Bara betalt_ore skrivs. ersattning_ore och avgift_ore lämnas
       orörda med flit: studiehjälparens ersättning räknas av
       fakturering ur rapporten, och två källor till samma siffra är
       en siffra ingen kan lita på. */
    const { error: sparfel } = await db.from('bookings').update({
      betalning_status: 'vantar',
      stripe_session_id: String((session as { id?: string }).id ?? ''),
      betalt_ore: netto,
    }).eq('id', pass.id);

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

    return json({
      url: (session as { url?: string }).url ?? null,
      session: (session as { id?: string }).id,
      belopp_ore: netto,
    }, 200, CORS);
  } catch (e) {
    if (e instanceof StripeError) {
      return json({ error: 'Stripe nekade: ' + e.fel.meddelande, stripe: e.fel }, 502, CORS);
    }
    return json({ error: (e as Error)?.message ?? 'Okänt fel.' }, 500, CORS);
  }
});
