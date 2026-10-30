// ============================================================
// NEXTRUM — Edge Function: nyheter-utskick (2026-10-30)
//
// Mejlar en publicerad nyhet till varje bekräftad adress i nyhetsbrevet.
// Leo: "när vi postar de får medlemmar automatiskt mejl om de nyheterna".
//
// Väcks av databasen (intern.nyheter_vack) när en nyhet publiceras med
// mejl, och av pg_cron-jobbet nyheter-utskick var tionde minut så länge
// en nyhet har mottagare kvar. Anropet har ingen kropp: funktionen frågar
// själv vilka nyheter som väntar (nyheter_att_mejla).
//
// PARTIER OM HUNDRA genom Resends batch, ett anrop per parti, med
// partiets id som idempotensnyckel. Databasen tar partiet
// (nyheter_utskick_ta), och först när Resend sagt ja står det som
// skickat. Dör funktionen mitt i tas samma parti igen efter tio minuter,
// med samma nyckel, så att det som redan gick inte går två gånger.
//
// SÄKERHET: verify_jwt är av (config.toml); hemligheten i x-nextrum-notis
// jämförs mot notis_konfig i konstant tid, som admin-paminnelse. Ingen
// adress kommer ur anropet: alla ur databasen. service_role når bara de
// fyra funktionerna, inte tabellerna.
// ============================================================

import { CORS, db, hemlighetOk, json } from '../_delad/notis.ts';
import { mejlfelSort } from '../_delad/mejl.ts';
import { preflight } from '../_delad/http.ts';
import { nyhetsmejl, type Mottagare, type Nyhet } from '../_delad/nyheter.ts';

const AVANMAL_FN = `${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/nyhetsbrev`;

/* Hela körningen får ta 100 sekunder, under väckningens två minuter. Det
   som inte hinns tar jobbet nästa gång. */
const BUDGET_MS = 100_000;
/* Resend tar två anrop i sekunden som förval. */
const PAUS_MS = 600;

type Parti = { klar: boolean; vanta?: boolean; parti?: string; mottagare: Mottagare[]; nyhet?: Nyhet };

async function skickaParti(p: Parti): Promise<{ ok: true } | { ok: false; status: number }> {
  const nyckel = Deno.env.get('RESEND_API_KEY');
  if (!nyckel) throw new Error('RESEND_API_KEY saknas som secret.');
  const svar = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${nyckel}`,
      'Idempotency-Key': `nyhet-${p.parti}`,
    },
    body: JSON.stringify(p.mottagare.map((m) => nyhetsmejl(p.nyhet!, m, AVANMAL_FN))),
    signal: AbortSignal.timeout(20_000),
  });
  await svar.body?.cancel();
  return svar.ok ? { ok: true } : { ok: false, status: svar.status };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(CORS);
  if (req.method !== 'POST') return json({ fel: 'metod' }, 405);

  const klient = db();
  try {
    if (!(await hemlighetOk(req, klient))) return json({ fel: 'Fel hemlighet.' }, 401);
  } catch (e) {
    console.error('nyheter-utskick:', (e as Error).message);
    return json({ fel: 'server' }, 500);
  }

  const start = Date.now();
  const { data: nyheter, error } = await klient.rpc('nyheter_att_mejla');
  if (error) {
    console.error('nyheter-utskick: nyheter_att_mejla', error.code ?? '');
    return json({ fel: 'server' }, 500);
  }

  let skickade = 0;
  for (const id of (nyheter ?? []) as string[]) {
    while (Date.now() - start < BUDGET_MS) {
      const { data, error: tafel } = await klient.rpc('nyheter_utskick_ta', { p_nyhet: id, p_antal: 100 });
      if (tafel) {
        console.error('nyheter-utskick: ta', tafel.code ?? '');
        return json({ fel: 'server', skickade }, 500);
      }
      const p = data as Parti;
      if (p.klar || p.vanta || !p.parti || !p.mottagare.length) break;

      let utfall: Awaited<ReturnType<typeof skickaParti>>;
      try {
        utfall = await skickaParti(p);
      } catch (e) {
        /* Nätet eller tidsgränsen: mejlen kan ha gått. Partiet står kvar
           som taget och tas igen efter tio minuter med samma nyckel. */
        console.error('nyheter-utskick: Resend', (e as Error).name);
        return json({ ok: false, skickade }, 200);
      }

      if (utfall.ok) {
        const { error: sfel } = await klient.rpc('nyheter_utskick_skickad', { p_parti: p.parti });
        if (sfel) console.error('nyheter-utskick: skickad', sfel.code ?? '');
        skickade += p.mottagare.length;
      } else {
        const sort = mejlfelSort(utfall.status);
        console.error('nyheter-utskick: Resend', utfall.status, sort);
        /* Bara ett fel i själva mejlen räknas mot de tre försöken. Kontot
           och det tillfälliga gäller alla partier: sluta, och låt jobbet
           ta samma parti igen. */
        if (sort === 'permanent') {
          await klient.rpc('nyheter_utskick_misslyckad', { p_parti: p.parti, p_fel: `Resend ${utfall.status}` });
          continue;
        }
        return json({ ok: false, skickade }, 200);
      }
      await new Promise((r) => setTimeout(r, PAUS_MS));
    }
  }
  return json({ ok: true, skickade }, 200);
});
