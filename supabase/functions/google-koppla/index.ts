// ============================================================
// NEXTRUM — google-koppla (Fas 18.1)
//
// Knappen Koppla Google under System → Integrationer, och det Google
// skickar tillbaka. Fyra vägar:
//
//   POST { steg: 'starta', ursprung }   admin: adressen till Google
//   GET  ?code=…&state=…                Google: tillbaka efter godkännandet
//   POST { steg: 'prova' }              admin: skapar ett rum och visar länken
//   POST { steg: 'koppla_fran' }        admin: stänger tokenen, tar bort raden
//
//
// VARFÖR DET NU FINNS EN KOPPLA-KNAPP
//
// INTEGRATIONER.md och adminvyn sa länge att det inte fick finnas en,
// eftersom en koppling kräver en klienthemlighet och en hemlighet som
// webbläsaren kan läsa inte är någon hemlighet. Det skälet står kvar,
// och knappen bryter inte mot det: vyn får en adress till Google och
// ingenting mer. Google skickar tillbaka en engångskod HIT, och det är
// här koden byts mot en token, med hemligheten, där ingen webbläsare
// når. Adminvyn rapporterar fortfarande bara vad servern säger.
//
//
// VERIFY_JWT ÄR AV (supabase/config.toml), och det är med flit
//
// Google skickar tillbaka webbläsaren med en vanlig omdirigering, och
// en omdirigering bär ingen inloggning. De tre POST-vägarna prövar
// adminens token själva, med kravAdmin, innan något annat händer.
//
// GET-vägen prövar det signerade läget (google.ts): bara en admin kan
// ha fått ett, det gäller i tio minuter och säger vem som bad om det.
// Den personen prövas en gång till mot profiles innan tokenen sparas.
// En admin som fråntagits rollen under de tio minuterna ska inte hinna
// koppla.
//
//
// KONTOT MÅSTE HÖRA TILL NEXTRUM (kontoOk i google.ts). Ett privat
// Gmail-konto nekas, och den token det fick stängs direkt. Samma sak
// om den som godkände kryssade ur Meet-rutan: en koppling som inte kan
// skapa rum ska inte stå som Kopplad.
//
//
// SAMMA KONTO IGEN STÄNGER INTE DEN GAMLA TOKENEN. Google stänger hela
// godkännandet när en token återkallas, alltså också den nya. Bara när
// kopplingen flyttar till ett ANNAT konto stängs den gamla.
// ============================================================

import { kravAdmin, serviceklient } from '../_delad/auth.ts';
import { cors, json, preflight } from '../_delad/http.ts';
import {
  aterkalla, aterkomstAdress, atkomstVarning, behorighetsAdress, bytKod, DOMAN, feltext,
  FORESLAGET_KONTO, GoogleFel, harMeetScope, klientUrMiljon, kontoOk, LAGE_GILTIGT_S, lasIdToken,
  lasLage, signeraLage, skapaRum, STANDARD_URSPRUNG, type Tokens, ursprungOk,
} from '../_delad/google.ts';
import {
  atkomstTillKontot, kopplaBort, lasKoppling, sparaKoppling, skrivFel, skrivLyckat,
} from '../_delad/google_konto.ts';

const CORS = cors();

const nuS = () => Math.floor(Date.now() / 1000);
const aterkomst = () => aterkomstAdress(Deno.env.get('SUPABASE_URL') ?? '');

/* Hur det gick, tillbaka till adminvyn. Utfallet är ett ord ur en fast
   lista som vyn översätter till en mening; ingen text härifrån hamnar
   i adressfältet. */
type Utfall = 'kopplad' | 'nekad' | 'fel' | 'fel_konto' | 'saknar_meet' | 'ogiltig' | 'ej_satt';

function tillbakaTill(ursprung: string, utfall: Utfall): Response {
  return new Response(null, {
    status: 302,
    headers: {
      location: ursprung + '/admin?google=' + utfall + '#system/integrationer',
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
    },
  });
}

/* ------------------------------------------------------------
   GOOGLE SKICKAR TILLBAKA
   ------------------------------------------------------------ */
async function nyKoppling(url: URL): Promise<Response> {
  const klient = klientUrMiljon();
  if (!klient) return tillbakaTill(STANDARD_URSPRUNG, 'ej_satt');

  // Utan ett äkta läge vet vi inte vem som började, och inte vart
  // webbläsaren ska. Den skickas då till nextrum.se, aldrig vidare.
  const lage = await lasLage(url.searchParams.get('state'), klient.hemlighet, nuS());
  if (!lage) return tillbakaTill(STANDARD_URSPRUNG, 'ogiltig');

  const googlesFel = url.searchParams.get('error');
  if (googlesFel) return tillbakaTill(lage.ursprung, googlesFel === 'access_denied' ? 'nekad' : 'fel');
  const kod = url.searchParams.get('code');
  if (!kod) return tillbakaTill(lage.ursprung, 'fel');

  const db = serviceklient();
  const { data: profil } = await db.from('profiles').select('is_admin').eq('id', lage.admin).maybeSingle();
  if (profil?.is_admin !== true) return tillbakaTill(lage.ursprung, 'ogiltig');

  let t: Tokens;
  try {
    t = await bytKod(kod, klient, aterkomst());
  } catch (e) {
    // invalid_grant här gäller koden, inte en koppling: den hann gå ut,
    // eller sidan laddades om och koden användes en gång till.
    await skrivFel(db, e instanceof GoogleFel && e.sort === 'utgangen'
      ? 'Koden från Google hann gå ut eller var redan använd, så ingenting kopplades. Tryck Koppla Google igen.'
      : 'Kopplingen gick inte igenom. ' + feltext(e));
    return tillbakaTill(lage.ursprung, 'fel');
  }

  const vem = lasIdToken(t.idToken, klient.id);
  if (!vem || !kontoOk(vem)) {
    await aterkalla(t.refresh ?? t.atkomst);
    await skrivFel(db, 'Kopplingen nekades: ' + (vem?.epost ?? 'kontot') + ' hör inte till Nextrums Google Workspace ('
      + DOMAN + '). Koppla igen och logga in som ' + FORESLAGET_KONTO + '.');
    return tillbakaTill(lage.ursprung, 'fel_konto');
  }
  if (!harMeetScope(t.scope)) {
    await aterkalla(t.refresh ?? t.atkomst);
    await skrivFel(db, 'Kopplingen nekades: rutan för Google Meet var inte ikryssad när Google frågade. '
      + 'Koppla igen och låt den vara ikryssad.');
    return tillbakaTill(lage.ursprung, 'saknar_meet');
  }
  if (!t.refresh) {
    await skrivFel(db, 'Google lämnade ingen refresh-token, så kopplingen hade slutat gälla inom en timme. Koppla igen.');
    return tillbakaTill(lage.ursprung, 'fel');
  }

  const forra = await lasKoppling(db).catch(() => null);
  try {
    await sparaKoppling(db, { konto: vem.epost, refresh: t.refresh, scopes: t.scope, admin: lage.admin });
  } catch (e) {
    await aterkalla(t.refresh);
    await skrivFel(db, (e as Error).message);
    return tillbakaTill(lage.ursprung, 'fel');
  }
  if (forra && forra.konto !== vem.epost) await aterkalla(forra.refresh);
  return tillbakaTill(lage.ursprung, 'kopplad');
}

/* ------------------------------------------------------------
   ADMINS KNAPPAR
   ------------------------------------------------------------ */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(CORS);
  if (req.method === 'GET') return await nyKoppling(new URL(req.url));
  if (req.method !== 'POST') return json({ error: 'Bara GET eller POST.' }, 405, CORS);

  const vem = await kravAdmin(req.headers.get('authorization'));
  if (!vem.ok) return vem.svar;

  let kropp: { steg?: unknown; ursprung?: unknown } = {};
  try {
    kropp = await req.json();
  } catch {
    return json({ error: 'Kroppen är inte JSON.' }, 400, CORS);
  }

  const klient = klientUrMiljon();

  if (kropp.steg === 'starta') {
    if (!klient) {
      return json({
        error: 'GOOGLE_KLIENT_ID och GOOGLE_KLIENT_HEMLIGHET är inte satta. De sätts under Edge Functions → '
          + 'Secrets i Supabase, och hur de skapas i Google Cloud står i INTEGRATIONER.md.',
      }, 409, CORS);
    }
    if (!ursprungOk(kropp.ursprung)) {
      return json({ error: 'Kopplingen kan bara startas från adminvyn på nextrum.se.' }, 400, CORS);
    }
    const lage = await signeraLage(
      { admin: vem.anvandare, ursprung: kropp.ursprung, utgarS: nuS() + LAGE_GILTIGT_S }, klient.hemlighet);
    return json({ url: behorighetsAdress({ klient, aterkomst: aterkomst(), lage }) }, 200, CORS);
  }

  // Från och med här service_role: raderna i google_koppling har ingen
  // policy alls, så adminens egen token ser dem inte. Prövad ovan.
  const db = serviceklient();

  if (kropp.steg === 'prova') {
    const a = await atkomstTillKontot(db, klient);
    if (!a.ok) return json({ error: a.text, kopplad: a.kopplad }, 409, CORS);
    try {
      const rum = await skapaRum(a.token);
      const varning = atkomstVarning(rum.atkomst);
      if (varning) await skrivFel(db, varning);
      else await skrivLyckat(db);
      return json({ lank: rum.lank, atkomst: rum.atkomst, konto: a.konto, varning }, 200, CORS);
    } catch (e) {
      const text = feltext(e);
      await skrivFel(db, text);
      return json({ error: text }, 502, CORS);
    }
  }

  if (kropp.steg === 'koppla_fran') {
    const k = await lasKoppling(db);
    const stangd = k ? await aterkalla(k.refresh) : true;
    await kopplaBort(db, stangd ? null
      : 'Tokenen gick inte att stänga hos Google. Kopplingen är borttagen här; ta bort åtkomsten för appen under '
        + 'myaccount.google.com → Säkerhet → Tredjepartsappar om du vill vara säker.');
    return json({ ok: true, stangd }, 200, CORS);
  }

  return json({ error: 'Okänt steg.' }, 400, CORS);
});
