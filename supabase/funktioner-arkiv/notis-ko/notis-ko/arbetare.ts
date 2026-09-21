// ============================================================
// NEXTRUM — notis-ko: själva arbetet, utan Supabase och utan Resend
//
// Allt som pratar med omvärlden kommer in som beroenden. Det är vad
// som gör att testerna kan köra hela flödet med en låtsas-Resend.
// ============================================================

import { rendera, type Roll } from '../_delad/notiser/rendera.ts';
import { avsandare, type NotisKonfig } from '../_delad/notiser/konfig.ts';
import { skapaAvanmalToken } from '../_delad/notiser/token.ts';
import { epostOk } from '../_delad/http.ts';
import type { Mejl } from '../_delad/mejl.ts';

export type KoRad = {
  id: number;
  typ: string;
  antal: number;
  forsok: number;
  mottagare_id: string | null;
  epost: string | null;
  fornamn: string | null;
  roll: string;
  notismail: boolean;
  aktuell: boolean;
};

export type Utfall = 'skickad' | 'hoppad' | 'fel' | 'permanent';

export type Beroenden = {
  konfig: NotisKonfig;
  avanmalNyckel: string | null;
  hamta: (max: number) => Promise<KoRad[]>;
  klar: (id: number, utfall: Utfall, fel?: string | null, resendId?: string | null) => Promise<void>;
  skicka: (m: Mejl) => Promise<Response>;
  logg?: (s: string) => void;
};

export type Summering = Record<Utfall, number>;

/** 4xx utom 403/408/409/429 är fel i själva mejlet — att försöka igen hjälper inte.
 *  403 räknas som tillfälligt: det är vad Resend svarar innan domänen är
 *  verifierad, och då ska mejlet gå iväg när DNS är klart. */
export function arPermanent(status: number): boolean {
  return status >= 400 && status < 500 && ![403, 408, 409, 429].includes(status);
}

export async function korArbetare(b: Beroenden, max = 25): Promise<Summering> {
  const s: Summering = { skickad: 0, hoppad: 0, fel: 0, permanent: 0 };
  const logg = b.logg ?? ((x: string) => console.log(x));
  const rader = await b.hamta(max);

  for (const r of rader) {
    let utfall: Utfall;
    let fel: string | null = null;
    let resendId: string | null = null;

    try {
      const roll: Roll = r.roll === 'tutor' ? 'tutor' : r.roll === 'lead' ? 'lead' : 'parent';
      const arTransaktion = r.typ === 'intresse_bekraftelse';

      if (!arTransaktion && !r.notismail) {
        utfall = 'hoppad'; fel = 'Mottagaren har stängt av notiser via mejl.';
      } else if (!r.aktuell) {
        utfall = 'hoppad'; fel = 'Redan läst i Nextrum.';
      } else if (!epostOk(r.epost)) {
        utfall = 'permanent'; fel = 'Ingen giltig e-postadress.';
      } else {
        const avanmalUrl = !arTransaktion && r.mottagare_id && b.avanmalNyckel && b.konfig.funktionUrl
          ? `${b.konfig.funktionUrl}/notis-avanmal?t=${encodeURIComponent(
              await skapaAvanmalToken(r.mottagare_id, b.avanmalNyckel))}`
          : null;
        // Länken i mejlet går till en sida på nextrum.se som frågar först.
        // Den direkta funktionsadressen används bara i List-Unsubscribe,
        // där mejlprogrammet POSTar på användarens uttryckliga begäran.
        const sidUrl = avanmalUrl
          ? `${b.konfig.basUrl}/avanmal?t=${avanmalUrl.split('?t=')[1]}`
          : null;

        const m = rendera({ typ: r.typ, roll, fornamn: r.fornamn, antal: r.antal, avanmalUrl: sidUrl }, b.konfig);

        const headers: Record<string, string> = {};
        if (avanmalUrl) {
          headers['List-Unsubscribe'] = `<${avanmalUrl}>, <mailto:${b.konfig.svaraTill}?subject=Avanm%C3%A4l%20notiser>`;
          headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
        }

        const till = b.konfig.lage === 'sandlada' ? b.konfig.sandladaTill : String(r.epost).trim();
        const mejl: Mejl = {
          fran: avsandare(b.konfig),
          till: [till],
          svaraTill: [b.konfig.svaraTill],
          amne: m.amne,
          text: m.text,
          html: m.html,
          idempotens: `nextrum-notis-${r.id}`,
          headers,
        };

        if (b.konfig.lage === 'logg') {
          logg(`[notis-ko TESTLÄGE] rad ${r.id} ${r.typ} -> ${roll}\nÄmne: ${m.amne}\n${m.text}`);
          utfall = 'hoppad'; fel = 'Testläge: loggat, inte skickat.';
        } else {
          const svar = await b.skicka(mejl);
          if (svar.ok) {
            utfall = 'skickad';
            resendId = (await svar.json().catch(() => null))?.id ?? null;
          } else {
            fel = `Resend ${svar.status}: ${(await svar.text().catch(() => '')).slice(0, 200)}`;
            utfall = arPermanent(svar.status) ? 'permanent' : 'fel';
          }
        }
      }
    } catch (e) {
      // Mall saknas och liknande: ett fel i koden, inte i nätet.
      const msg = String((e as Error)?.message ?? e);
      utfall = msg.startsWith('Mall saknas') ? 'permanent' : 'fel';
      fel = msg.slice(0, 300);
    }

    s[utfall]++;
    await b.klar(r.id, utfall, fel, resendId);
  }
  return s;
}
