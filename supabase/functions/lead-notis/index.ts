// ============================================================
// NEXTRUM — Edge Function: lead-notis
//
// Två mejl när någon skickar en intresseanmälan: en avisering till
// ledningen, och ett kvitto till familjen.
//
// Anmälan sparas i databasen som förut; det här är mejl ovanpå, inte
// i stället för. Går de fel ligger raden kvar.
//
//
// DE TVÅ ÄR OBEROENDE AV VARANDRA
//
// Ett kvitto som inte gick fram får inte se ut som att anmälan inte
// kom in, och en avisering som inte gick fram får inte hindra
// kvittot. Båda försöken görs, och båda utfallen står i svaret.
//
// Aviseringen först, för det är den som får någon att ringa inom de
// 24 timmar sajten lovar. Kvittot är det familjen ser, men det
// lovar bara att vi hört av oss — löftet hålls av aviseringen.
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
import { lika, serviceklient } from '../_delad/auth.ts';
import { skickaViaResend } from '../_delad/mejl.ts';
import { KVITTO_FRAN, renderaKvitto } from '../_delad/notiser/kvitto.ts';
import { FARG, KONTAKT, SANS, rubrikHtml, skal } from '../_delad/notiser/rendera.ts';

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

/** Så länge ett anrop till Resend får ta innan webhooken ger upp. */
const KVITTO_TIDSGRANS_MS = 8_000;

/* ============================================================
   BROMSARNA PÅ KVITTOT

   leads tar emot INSERT från vem som helst. Policyn heter "vem som
   helst kan skicka intresseanmälan" och har `with check (true)`, och
   det är meningen: formuläret är publikt och anon-nyckeln står i
   sidans källkod.

   Så länge en anmälan bara mejlade OSS var den öppenheten
   självreglerande — den som spammar formuläret fyller vår egen
   inkorg. Kvittot vänder på det. Utan broms kan vem som helst posta
   rader i en slinga med en adress DE valt, och få oss att skicka
   DKIM-signerade mejl från info@nextrum.se till en utomstående: en
   mejlbomb på vår domän, vår Resend-kvot och vårt rykte.

   Tre bromsar, räknade i databasen av lead_kvitto_broms() (Fas 16.2):

     1. EN ADRESS FÅR ETT KVITTO PER DYGN. Tusen anmälningar med samma
        offers adress blir ett mejl, inte tusen. Adressen jämförs som
        den levereras, utan skiftläge och plustillägg: offer+1@gmail.com
        och offer+2@gmail.com är samma inkorg.
     2. ETT TAK PER MINUT ÖVER LAG, fem.
     3. ETT TAK PER TIMME ÖVER LAG, tjugo. Fem i minuten är annars
        7 200 kvitton per dygn för den som håller takten.

   Reglerna och jämförelsen är desamma som för ansökningskvittot, och
   de står på ett ställe (intern.epost_nyckel). Förut räknade den här
   filen själv, med ilike på den exakta adressen, och bromsen gick
   runt med ett plustecken — och med en bakdaterad created_at, som
   Fas 16.1c stängde.

   ADVISERINGEN TILL OSS GÅR UT I ALLA FALLEN. Den är inte spärrad,
   för det är så en människa får veta att något pågår.

   Går kontrollen inte att göra skickas INGET kvitto. En broms som
   släpper igenom när den är trasig är ingen broms.
   ============================================================ */

export type KvittoUtfall = { skickat: boolean; id?: string | null; orsak?: string };

/** Ett skäl att hoppa över kvittot, eller null när det får gå. */
async function kvittoBromsat(r: Record<string, unknown>): Promise<string | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE) return 'Takten gick inte att kontrollera.';

  try {
    const { data, error } = await serviceklient().rpc('lead_kvitto_broms', {
      p_epost: String(r.email).trim(),
      /* Raden som just skapades räknas inte som en tidigare anmälan. */
      p_id: typeof r.id === 'string' && r.id ? r.id : null,
    });
    if (error) return 'Takten gick inte att kontrollera.';
    return typeof data === 'string' && data ? data : null;
  } catch {
    return 'Takten gick inte att kontrollera.';
  }
}

/**
 * Kvittot till den som anmälde sig. Kastar aldrig: utfallet blir en
 * rad i svaret, så att en trasig kvittoväg syns i webhookloggen utan
 * att aviseringen till oss påverkas.
 */
async function skickaKvitto(r: Record<string, unknown>): Promise<KvittoUtfall> {
  if (!epostOk(r.email)) {
    return { skickat: false, orsak: 'Anmälan har ingen giltig e-postadress.' };
  }

  const bromsat = await kvittoBromsat(r);
  if (bromsat) return { skickat: false, orsak: bromsat };

  /* Idempotensnyckeln byggs ur radens id. SAKNAS DET SÄTTS INGEN
     NYCKEL: en nyckel som blir "…-undefined" hade varit samma nyckel
     för varje anmälan, och Resend hade då skickat kvittot till den
     första familjen och tyst hoppat över resten. Hellre risk för två
     kvitton till en familj än noll kvitton till alla andra. */
  const id = typeof r.id === 'string' && r.id ? r.id : null;

  try {
    /* Renderingen ligger INNANFÖR try:t, inte före. Den kastar inte i
       dag — fornamn() tål vad som helst och mallen har inga grenar —
       men funktionen anropas i en Promise.all bredvid aviseringen till
       oss. Kastade den skulle hela webhooken svara 500 med aviseringen
       redan skickad, och utfallet för den försvinna ur loggen. Löftet
       i kommentaren ovan ska hålla av konstruktion, inte av tur. */
    const m = renderaKvitto(r.parent_name);

    const svar = await skickaViaResend({
      fran: KVITTO_FRAN,
      till: [String(r.email).trim()],
      /* Mejlet ber om svar, så svaret ska gå till en läst adress. */
      svaraTill: [KONTAKT],
      amne: m.amne,
      text: m.text,
      html: m.html,
      idempotens: id ? `nextrum-kvitto-${id}` : undefined,
      tidsgransMs: KVITTO_TIDSGRANS_MS,
    });
    if (svar.ok) {
      const j = await svar.json().catch(() => null) as { id?: unknown } | null;
      return { skickat: true, id: typeof j?.id === 'string' ? j.id : null };
    }
    /* Statuskoden, aldrig kroppen: den upprepar adressen vi skickade
       till, och webhookloggen är inte rätt ställe för den. */
    return { skickat: false, orsak: `Resend svarade ${svar.status} på kvittot.` };
  } catch (e) {
    return {
      skickat: false,
      orsak: (e as { name?: string })?.name === 'TimeoutError'
        ? 'Resend svarade inte i tid på kvittot.'
        : 'Resend gick inte att nå för kvittot.',
    };
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

    const falt =
      rad('Namn', r.parent_name) +
      rad('E-post', r.email) +
      rad('Elevens namn', r.child_name) +
      rad('Årskurs', r.grade) +
      rad('Ämne', r.subject);

    const text =
      'Ny intresseanmälan på nextrum.se\n\n' +
      falt +
      (r.message ? `\nMeddelande:\n${r.message}\n` : '') +
      `\nInkom: ${r.created_at ?? 'okänt'}\nRad-id: ${r.id ?? 'okänt'}\n`;

    /* Samma skal som allt annat vi skickar, och innehållet är texten
       ovan ordagrant: HTML-versionen kan inte säga något annat än
       textversionen, för den ÄR textversionen. <pre> och inte en div,
       för radbrytningarna ska stå kvar också där white-space inte
       stöds (Outlook på Windows). Fälten blir förhandstexten, så att
       inkorgen visar vem och vad innan någon öppnat mejlet. */
    const html = skal({
      amne: 'Ny intresseanmälan',
      forhandstext: falt.trim().split('\n').join(' · ') || 'Ny intresseanmälan på nextrum.se',
      innehall: rubrikHtml('Ny intresseanmälan')
        + `<pre style="margin:0;font:400 15px/1.6 ${SANS};color:${FARG.brod};`
        + `white-space:pre-wrap;word-wrap:break-word">${esc(text)}</pre>`,
    });

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

    /* De två mejlen är oberoende, så de görs samtidigt: webhooken ska
       inte vänta på två Resend-anrop i rad. skickaKvitto kastar
       aldrig, så Promise.all kan inte falla på kvittot. */
    const [svar, kvitto] = await Promise.all([skicka(FRAN, TILL), skickaKvitto(r)]);

    /* Ett uteblivet kvitto syns annars bara som ett fält i en kropp
       ingen läser: svaret är 200 så länge aviseringen till oss gick,
       och webhookloggen ser grön ut medan varje familj får tystnad.
       Det mest troliga skälet är dessutom systematiskt — svarar Resend
       403 på avsändardomänen gäller det ALLA kvitton, inte ett.
       Raden hamnar i funktionsloggen, som är där man tittar.
       Anmälans id, aldrig adressen. */
    if (!kvitto.skickat) {
      console.error('lead-notis: kvittot gick inte ut för', r.id ?? 'okänd rad', '—', kvitto.orsak);
    }

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
          kvitto,
        }, 200);
      }
      return json({
        error: 'Resend svarade 403 på ' + FRAN + ' och '
             + reserv.status + ' på reserven: ' + (await reserv.text()),
        orsak,
        kvitto,
      }, 502);
    }

    if (!svar.ok) {
      return json({ error: 'Resend svarade ' + svar.status + ': ' + (await svar.text()), kvitto }, 502);
    }

    return json({ ok: true, id: (await svar.json())?.id ?? null, kvitto }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
