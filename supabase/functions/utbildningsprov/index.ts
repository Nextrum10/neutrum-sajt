// ============================================================
// NEXTRUM — Edge Function: utbildningsprov (Fas 22.1)
//
// Provet efter utbildningsmötet, för den som sökt jobb. Sidan
// nextrum.se/utbildningsprov anropar funktionen med nyckeln ur länken
// i mejlet:
//
//   { t, handling: 'hamta' }          läget, och frågorna utan svar
//   { t, handling: 'lamna', svar }    rättar, sparar, säger hur det gick
//
// SÄKERHET: verify_jwt är av (config.toml). Den som gör provet har
// inget konto än, det skapas i steget efter. Det som skyddar är
// nyckeln i länken: slumpad, 122 bitar, och den öppnar bara provet för
// en ansökan. service_role används bara till två funktioner i
// databasen, utbildningsprov_lage och utbildningsprov_lamna, som inte
// kan läsa något annat än läget och inte skriva något annat än ett
// försök.
//
// Facit lämnar aldrig funktionen (_delad/utbildningsprov.ts). Gränsen
// 80 procent prövas en gång till i databasen, och taket på tio försök
// per dygn står bara där.
//
// ALDRIG RÅA FEL UTÅT, ALDRIG NYCKELN I LOGGEN. En nyckel i en logg är
// en länk till någon annans prov.
// ============================================================

import { cors, json as jsonMed, preflight } from '../_delad/http.ts';
import { serviceklient } from '../_delad/auth.ts';
import { GRANS_PROCENT, kravRatt, publikaFragor, ratta } from '../_delad/utbildningsprov.ts';

const CORS = cors();
const json = (body: unknown, status: number) => jsonMed(body, status, CORS);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Lage = {
  lage: 'oppet' | 'stangt' | 'godkant';
  fornamn: string | null;
  sista_dag: string | null;
  forsok: number;
  forsok_idag: number;
  basta_ratt: number | null;
  basta_antal: number | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(CORS);
  if (req.method !== 'POST') return json({ fel: 'Bara POST.' }, 405);

  const kropp = await req.json().catch(() => null) as
    { t?: unknown; handling?: unknown; svar?: unknown } | null;
  const nyckel = typeof kropp?.t === 'string' && UUID.test(kropp.t) ? kropp.t.toLowerCase() : null;
  // Samma svar för en nyckel som inte ser ut som en nyckel och en som
  // inte finns: ingen ska kunna skilja på dem utifrån.
  if (!nyckel) return json({ fel: 'ogiltig' }, 404);

  const db = serviceklient();

  if (kropp?.handling === 'hamta') {
    const { data, error } = await db.rpc('utbildningsprov_lage', { p_nyckel: nyckel });
    if (error) {
      console.error('utbildningsprov: läget gick inte att läsa', error.code ?? '');
      return json({ fel: 'server' }, 500);
    }
    const l = (Array.isArray(data) ? data[0] : null) as Lage | null;
    if (!l) return json({ fel: 'ogiltig' }, 404);
    return json({
      lage: l.lage,
      fornamn: l.fornamn,
      sista_dag: l.sista_dag,
      forsok: l.forsok,
      forsok_idag: l.forsok_idag,
      basta: l.basta_ratt === null ? null : { ratt: l.basta_ratt, antal: l.basta_antal },
      grans_procent: GRANS_PROCENT,
      krav: kravRatt(),
      fragor: l.lage === 'oppet' ? publikaFragor() : [],
    }, 200);
  }

  if (kropp?.handling === 'lamna') {
    const r = ratta(kropp.svar);
    // Ett halvt ifyllt prov rättas inte. Sidan hindrar det redan, så
    // hit kommer bara ett anrop som inte gått genom sidan.
    if (r.obesvarade.length) return json({ fel: 'obesvarade', obesvarade: r.obesvarade }, 400);

    const { data, error } = await db.rpc('utbildningsprov_lamna', {
      p_nyckel: nyckel, p_ratt: r.ratt, p_antal: r.antal, p_svar: r.svar,
    });
    if (error) {
      console.error('utbildningsprov: försöket gick inte att spara', error.code ?? '');
      return json({ fel: 'server' }, 500);
    }
    const u = (Array.isArray(data) ? data[0] : null) as
      { utfall: string; godkant: boolean; forsok: number } | null;
    if (!u || u.utfall === 'okand') return json({ fel: 'ogiltig' }, 404);
    // Läget ändrades medan provet var öppet i fliken: stängt, redan
    // godkänt eller för många försök. Inget resultat, för inget sparades.
    if (u.utfall !== 'ok') return json({ utfall: u.utfall }, 200);

    return json({
      utfall: 'ok',
      godkant: u.godkant,
      ratt: r.ratt,
      antal: r.antal,
      krav: kravRatt(r.antal),
      forsok: u.forsok,
      avsnitt: r.avsnitt,
    }, 200);
  }

  return json({ fel: 'Okänd handling.' }, 400);
});
