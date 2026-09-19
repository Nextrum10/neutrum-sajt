// ============================================================
// NEXTRUM — Edge Function: lead-notis
//
// Skickar TVÅ mejl när någon lämnar en intresseanmälan:
//
//   1. aviseringen till ledningen, så att någon kan ringa
//   2. kvittensen till familjen, så att de vet att den kom fram
//
// Anmälan sparas i databasen som förut; båda mejlen är ovanpå, inte
// i stället för. Går de fel ligger raden kvar.
//
//
// VARFÖR KVITTENSEN LIGGER HÄR OCH INTE I EN EGEN FUNKTION
//
// Det är samma händelse. En egen funktion hade krävt en andra
// webhook på samma tabell, med samma hemlighet och samma
// record-kropp — två saker att driftsätta och två ställen där det
// kan sluta avfyras, för ett mejl som utlöses av exakt det som
// redan utlöst det här.
//
//
// ORDNINGEN ÄR INTE GODTYCKLIG
//
// Aviseringen skickas FÖRST och kvittensen sedan. Den familjen inte
// får är en besviken förälder; den VI inte får är en kund som
// ringde och aldrig blev uppringd. 24-timmarslöftet på sajten
// hänger på det första mejlet.
//
// Därför får ett fel på kvittensen aldrig fälla hela svaret. En
// 502 här får webhooken att försöka igen, och nästa försök skickar
// aviseringen EN GÅNG TILL. Kvittensens utfall rapporteras i stället
// i svaret, och raden ligger kvar att skicka om från.
//
// ANROPAS AV EN DATABASWEBHOOK, inte av webbläsaren. Det är med
// flit. En funktion som tar emot formulärdata från klienten är en
// öppen väg att fylla er inkorg med skräp — vem som helst kan läsa
// adressen i JavaScript och anropa den i en slinga. Webhooken körs
// på Supabases sida när raden faktiskt skapats, så det som mejlas
// är alltid något som verkligen står i databasen.
//
// verify_jwt är av, eftersom en webhook inte har någon inloggad
// användare. I stället krävs en delad hemlighet i en egen header.
// Utan den svarar funktionen 401 och gör ingenting.
//
// HEMLIGHETEN LIGGER I public.notis_konfig, inte i en secret. Den
// låg förut i Deno.env som NOTIS_HEMLIGHET och var satt till den
// bokstavliga strängen "openssl rand -hex 32" — kommandot hade
// klistrats in i stället för körts. I en tabell kan den roteras med
// en SQL-rad, i samma transaktion som webhookens header, i stället
// för att kräva ett dashboard-besök och rätt ordning mellan två
// fönster. Tabellen har RLS på utan en enda policy, så bara
// service_role ser den.
// ============================================================

import { json as jsonMed, esc, epostOk } from '../_delad/http.ts';
import { lika } from '../_delad/auth.ts';
import { skickaViaResend } from '../_delad/mejl.ts';
import { brev, SAJT, KONTAKT } from '../_delad/mall.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

/* Injiceras av Supabase i varje Edge Function, behöver inte sättas. */
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const FRAN = 'Nextrum <info@nextrum.se>';

/* Alla tre får samma mejl. Det är med flit: den som råkar se det
   först kan ringa, och 24-timmarslöftet på sajten håller inte om
   aviseringen ligger i en inkorg som ingen öppnar förrän på måndag. */
const TILL = [
  'alexandarjovanoviccc@gmail.com',
  'leo.thriskos@gmail.com',
  'info@nextrum.se',
];

/* Reservavsändare. Resend låter varje konto skicka från den här
   adressen utan att någon domän är verifierad — men BARA till
   kontots egen e-postadress. Den finns här för att en overifierad
   domän inte ska betyda noll avisering: hellre ett mejl med fel
   avsändare än ingen aning om att en familj hört av sig.

   Den används först när det riktiga försöket fått 403, alltså
   precis det svar Resend ger på en domän som inte är klar. Så fort
   nextrum.se verifieras slutar reserven användas av sig själv,
   utan att någon behöver komma ihåg att ta bort den. */
const RESERV_FRAN = 'Nextrum <onboarding@resend.dev>';

/* Reserven går bara till EN adress. onboarding@resend.dev får bara
   leverera till Resend-kontots egen adress, så ett försök med hela
   listan avvisas i sin helhet och reserven vore meningslös. Är
   kontot registrerat på en annan adress än den här faller även
   reserven — men då står orsaken i svaret i stället för att
   aviseringen försvinner tyst. */
const RESERV_TILL = 'info@nextrum.se';

/* Läses en gång per instans. En kall start kostar ett anrop, sedan
   ligger den kvar tills instansen återvinns. Roteras hemligheten
   hinner en varm instans ha den gamla kvar en kort stund — därför
   sker bytet i tabellen och i webhooken i SAMMA transaktion, så att
   de två aldrig glider isär mer än en instanslivstid. */
let cachadHemlighet: string | null = null;

async function hämtaHemlighet(): Promise<string | null> {
  if (cachadHemlighet) return cachadHemlighet;
  if (!SUPABASE_URL || !SERVICE_ROLE) return null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/notis_konfig?select=hemlighet&id=eq.1`,
      { headers: { apikey: SERVICE_ROLE, authorization: `Bearer ${SERVICE_ROLE}` } },
    );
    if (!r.ok) return null;
    const rader = await r.json();
    const h = Array.isArray(rader) && rader[0] ? rader[0].hemlighet : null;
    if (typeof h !== 'string' || !h) return null;
    cachadHemlighet = h;
    return h;
  } catch (_e) {
    return null;
  }
}

/* Webhooken är ingen webbläsare, så svaren har inga CORS-headers. */
const json = (body: unknown, status: number) => jsonMed(body, status, {});

/* Rader som saknas ska inte bli tomma etiketter i mejlet. */
function rad(etikett: string, varde: unknown): string {
  const v = String(varde ?? '').trim();
  return v ? `${etikett}: ${v}\n` : '';
}

/* epostOk (från _delad/http.ts) kollas HÄR också, för databasen kan
   fyllas på från annat håll än sidan och en trasig rad får inte kunna
   stoppa aviseringen om sig själv. */

/* Förnamnet. Formuläret ber om "Namn" i ett fält, så det som kommer
   in är allt från "Anna" till "Anna Svensson-Lindqvist". Ett mejl som
   inleds med hela personnumret på namnet låter som ett register. */
function förnamn(helaNamnet: unknown): string {
  return String(helaNamnet ?? '').trim().split(/\s+/)[0] ?? '';
}

/* ============================================================
   KVITTENSEN TILL FAMILJEN

   Den som just tryckt på knappen har lämnat ifrån sig sitt barns
   namn och sin egen adress till ett företag de inte känner. Kom det
   fram? Läser någon det? Sajten svarar med en rad text som försvinner
   när fliken stängs — mejlet är det enda som ligger kvar.

   Tre saker ska stå i det, och inget mer: att den kom fram, när vi
   hör av oss, och vart man skriver om man kommer på något under
   tiden. Ingen kampanj, inga länkar till prissidan, ingen
   nyhetsbrevsruta. Det här är ett kvitto, inte ett utskick.

   IDEMPOTENSNYCKELN är radens id. En webhook som försöker igen —
   efter en timeout, en kall start eller ett nätfel — skickar då
   samma kvittens en gång till, och Resend levererar den ändå bara
   en gång. En familj som får två tackmejl för samma anmälan tror
   att de skickade in två.
   ============================================================ */
async function skickaKvittens(r: Record<string, unknown>): Promise<Response> {
  const adress = String(r.email ?? '').trim();
  const namn = förnamn(r.parent_name);
  const barn = String(r.child_name ?? '').trim();
  const amne = String(r.subject ?? '').trim();

  const stycken = [
    namn ? `Hej ${namn},` : 'Hej,',

    `tack för att ni hörde av er. Er intresseanmälan har kommit fram till oss och ligger `
      + `hos en människa nu, inte i en kö.`,

    `Vi hör av oss inom 24 timmar, på den här adressen eller på telefon om ni lämnade ett `
      + `nummer. Skickade ni in sent på kvällen eller under helgen kan det bli morgonen `
      + `efter — men inom ett dygn hör ni från oss.`,

    `Det första vi gör är att ringa eller skriva och gå igenom vad ${barn || 'eleven'} `
      + `behöver hjälp med${amne ? `, inte bara "${amne}" utan var det faktiskt går trögt` : ''}. `
      + `Först därefter väljer vi studiehjälpare. Vi matchar hellre långsamt och rätt än `
      + `snabbt och ungefär — fel person är sämre än ingen person.`,

    `När matchningen är klar skriver vi en studieplan och låser upp studievyn, där ni bokar `
      + `pass, läser rapporten efter varje gång och når studiehjälparen direkt.`,

    `Ni har inte bundit er vid någonting genom att skicka in det här, och det kostar `
      + `ingenting förrän ni har haft ett pass. Kommer ni på något i mellantiden, eller vill `
      + `ändra något ni skrev — svara bara på det här mejlet, eller skriv till ${KONTAKT}.`,
  ];

  const { text, html } = brev({
    rubrik: namn ? `Tack ${namn} — vi hörde er` : 'Tack — vi hörde er',
    stycken,
    knapp: { text: 'Läs hur det går till', adress: `${SAJT}/sa-fungerar-nextrum` },
    efterord: 'Du får det här mejlet för att adressen angavs i en intresseanmälan på '
            + 'nextrum.se. Var det inte du — svara på mejlet, så tar vi bort uppgifterna.',
  });

  return await skickaViaResend({
    fran: FRAN,
    till: [adress],
    amne: namn ? `Tack ${namn}, vi hör av oss inom 24 timmar` : 'Tack, vi hör av oss inom 24 timmar',
    text,
    html,
    idempotens: r.id ? `lead-kvittens-${r.id}` : undefined,
  });
}

/* Kvittensen, inpackad så att den aldrig kan fälla aviseringen.
   Returnerar vad som hände i stället för att kasta — utfallet ska
   synas i webhookloggen bredvid aviseringens, inte ersätta den.

   Adressen kontrolleras med epostOk först. En rad kan ha kommit in
   från annat håll än formuläret, och Resend svarar 422 på en adress
   som inte är en adress; det är inget fel att larma om, det är bara
   ingen att kvittera till. */
async function försökKvittens(r: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!epostOk(r.email)) {
    return { skickad: false, orsak: 'Adressen i raden ser inte ut som en e-postadress.' };
  }
  try {
    const svar = await skickaKvittens(r);
    if (svar.ok) return { skickad: true, id: (await svar.json())?.id ?? null };
    return { skickad: false, status: svar.status, orsak: await svar.text() };
  } catch (e) {
    return { skickad: false, orsak: String(e) };
  }
}

Deno.serve(async (req) => {
  try {
    /* Hemligheten kollas FÖRST. Den förra ordningen svarade
       "RESEND_API_KEY saknas" till vem som helst som pingade
       adressen — ett litet läckage om serverns tillstånd till någon
       som inte ens fått visa att de hör hemma här. Nu får en
       oautentiserad anropare bara 401, oavsett hur servern mår.

       Saknas headern helt svarar vi innan uppslaget mot tabellen. Den
       som bara pingar adressen får alltså 401 och lär sig ingenting,
       medan en riktig webhook — som alltid skickar headern — får 503
       och en begriplig rad i webhookloggen om tabellen är trasig. */
    const presenterad = req.headers.get('x-nextrum-notis');
    if (!presenterad) return json({ error: 'Fel eller saknad hemlighet.' }, 401);

    const hemlighet = await hämtaHemlighet();
    if (!hemlighet) {
      return json({ error: 'Hemligheten gick inte att läsa ur public.notis_konfig.' }, 503);
    }
    if (!lika(presenterad, hemlighet)) {
      return json({ error: 'Fel eller saknad hemlighet.' }, 401);
    }

    if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY saknas som secret.' }, 500);

    const kropp = await req.json();
    const r = kropp?.record;
    if (!r) return json({ error: 'Ingen record i webhook-anropet.' }, 400);

    const text =
      'Ny intresseanmälan på nextrum.se\n\n' +
      rad('Namn', r.parent_name) +
      rad('E-post', r.email) +
      rad('Elevens namn', r.child_name) +
      rad('Årskurs', r.grade) +
      rad('Ämne', r.subject) +
      (r.message ? `\nMeddelande:\n${r.message}\n` : '') +
      `\nInkom: ${r.created_at ?? 'okänt'}\nRad-id: ${r.id ?? 'okänt'}\n`;

    const html =
      `<h2 style="font:600 18px system-ui;margin:0 0 14px">Ny intresseanmälan</h2>` +
      `<pre style="font:14px/1.6 ui-monospace,monospace;white-space:pre-wrap;margin:0">${esc(text)}</pre>`;

    const skicka = (avsandare: string, mottagare: string[]) => skickaViaResend({
      fran: avsandare,
      till: mottagare,
      /* Svara-knappen ska gå till familjen, inte till avsändaren.
         Utan det här måste man kopiera adressen ur mejlet.

         Bara när adressen ser giltig ut. Resend avvisar HELA
         utskicket med 422 på en ogiltig svarsadress, och då dog
         aviseringen om just den anmälan som behövde granskas mest.
         Adressen står ändå i texten ovan, så ingenting går
         förlorat — mejlet kommer fram, utan svara-knapp. */
      svaraTill: epostOk(r.email) ? [String(r.email).trim()] : undefined,
      amne: `Intresseanmälan: ${r.parent_name ?? 'okänd'}${r.grade ? ' — ' + r.grade : ''}`,
      text,
      html,
    });

    const svar = await skicka(FRAN, TILL);

    /* 403 = domänen är inte verifierad hos Resend. Allt annat är ett
       riktigt fel och ska synas som det. Kroppen läses ut här, för en
       Response går bara att läsa en gång och orsaken ska med i svaret
       även när reserven lyckas — annars ser loggen ut som att allt är
       bra medan avsändaren i själva verket är fel. */
    if (svar.status === 403) {
      const orsak = await svar.text();
      const reserv = await skicka(RESERV_FRAN, [RESERV_TILL]);
      if (reserv.ok) {
        return json({
          ok: true,
          reserv: true,
          avsandare: RESERV_FRAN,
          mottagare: RESERV_TILL,
          varning: 'nextrum.se är inte verifierad hos Resend — mejlet gick via '
                 + 'reservavsändaren och nådde bara ' + RESERV_TILL + ', inte hela listan.',
          orsak,
          id: (await reserv.json())?.id ?? null,
          /* Ingen kvittens härifrån, och inget försök heller.
             Reservavsändaren får bara leverera till Resend-kontots
             egen adress — ett försök mot familjen hade avvisats, och
             det enda det gett är en rad till i loggen om samma sak
             som varningen ovan redan säger. */
          kvittens: {
            skickad: false,
            orsak: 'Domänen är inte verifierad hos Resend, så inget mejl kan nå familjen. '
                 + 'Verifiera nextrum.se och skicka om raden.',
          },
        }, 200);
      }
      return json({
        error: 'Resend svarade 403 på ' + FRAN + ' och '
             + reserv.status + ' på reserven: ' + (await reserv.text()),
        orsak,
      }, 502);
    }

    if (!svar.ok) {
      return json({ error: 'Resend svarade ' + svar.status + ': ' + (await svar.text()) }, 502);
    }

    /* Aviseringen gick fram. Först nu kvittensen — se ORDNINGEN
       överst. Utfallet följer med i svaret men kan inte ändra
       statuskoden: en 502 här hade fått webhooken att försöka igen
       och skickat aviseringen en andra gång. */
    const aviseringsId = (await svar.json())?.id ?? null;
    const kvittens = await försökKvittens(r);
    if (!kvittens.skickad) console.error('Kvittensen gick inte iväg:', kvittens.orsak);

    return json({ ok: true, id: aviseringsId, kvittens }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
