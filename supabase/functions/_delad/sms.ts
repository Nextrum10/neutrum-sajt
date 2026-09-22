// ============================================================
// NEXTRUM — delad hjälp: SMS via 46elks
//
// Bara påminnelser före ett pass går som SMS (program 2, Fas 2), och
// bara till den som själv slagit på det. Här finns texten och själva
// anropet.
//
//
// TEXTEN
//
// Ett SMS syns på en låst skärm och går genom operatörernas nät.
// Därför står där inget barnnamn och inget ämne, bara när passet är
// och en länk in. Avsändaren är ett namn, inte ett nummer, så det går
// inte att svara; det står i texten.
//
// Varje tecken ska finnas i GSM 03.38:s grunduppsättning. Ett enda
// tecken utanför, ett tankstreck eller ett typografiskt citattecken,
// byter hela meddelandet till UTF-16: 70 tecken per del i stället för
// 160, och varje del kostar. arGsm() prövar det, och testerna håller
// fast att texten får plats i en del.
//
//
// ANROPET
//
// POST https://api.46elks.com/a1/sms, formulärkodat, Basic-auth med
// ELKS_API_ANVANDARE och ELKS_API_LOSENORD. dontlog=message gör att
// texten inte sparas i 46elks historik. I läget 'prov' går anropet
// med dryrun=yes: 46elks prövar numret och räknar kostnaden men
// skickar inget och tar inget betalt. Det är förvalet i notis_drift.
//
// Anropet får ta högst SMS_TIDSGRANS_MS. Utan gräns kan ett hängande
// anrop hålla raden längre än lånet på fem minuter, och då tas den
// igen medan det första anropet pågår. 46elks har ingen
// idempotensnyckel, så ett anrop som tog för lång tid i läget
// 'skicka' kan ha gått fram: det blir ett permanent fel i stället för
// ett nytt försök. Ett uteblivet SMS är bättre än två, och mejlet om
// samma påminnelse går sin egen väg. I provläget kostar ett nytt
// försök ingenting, så där prövas det igen.
// ============================================================

import { narText, paminnelseNar } from './notiser/tid.ts';
import { renData, tillRoll } from './notiser/typer.ts';

export type SmsLage = 'prov' | 'skicka';

export type SmsUt = { till: string; text: string; lage: SmsLage };

export type SmsSvar = {
  ok: boolean;
  /** 46elks id för meddelandet. Saknas i provläget. */
  id: string | null;
  /** 46elks cost eller estimated_cost: tiotusendelar av kontots valuta. */
  kostnad: number | null;
  /** Ett fel som inte blir bättre av ett nytt försök. */
  permanent: boolean;
  /** Kort och utan nummer eller text. Hamnar i notis_utskick.fel. */
  fel: string | null;
};

export const SMS_URL = 'https://api.46elks.com/a1/sms';
export const SMS_AVSANDARE = 'Nextrum';
export const SMS_TIDSGRANS_MS = 8_000;

/* GSM 03.38, grunduppsättningen (utan escape och utan tilläggstabellen,
   vars tecken kostar två platser). Ordningen är tabellens, 0x00–0x7F. */
const GSM =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';

export function arGsm(s: string): boolean {
  for (const c of s) if (c === '' || !GSM.includes(c)) return false;
  return true;
}

/**
 * Påminnelsen som SMS. Bara tid och en länk:
 *
 *   Påminnelse: du har ett pass i morgon kl. 16:00. Svara inte på
 *   det här SMS:et.
 *   https://nextrum.se/foralder#lektioner/pass
 *
 * '#' finns i GSM 03.38:s grunduppsättning, så länken byter inte
 * kodning. Länken står sist på egen rad, så att telefonen inte tar
 * med en punkt eller ett ord i adressen.
 */
export function smsText(o: { roll: unknown; data: unknown; nu: Date }): string {
  const d = renData(o.data);
  const nar = paminnelseNar(d, o.nu) ?? narText(d.datum, d.tid);
  const vy = tillRoll(o.roll) === 'tutor' ? 'larare' : 'foralder';
  const forsta = nar ? `Påminnelse: du har ett pass ${nar}.` : 'Påminnelse: du har ett pass snart.';
  return `${forsta} Svara inte på det här SMS:et.\nhttps://nextrum.se/${vy}#lektioner/pass`;
}

/** Basic-auth utan btoa på text som kanske inte är latin-1. */
function basic(anvandare: string, losenord: string): string {
  const bytes = new TextEncoder().encode(`${anvandare}:${losenord}`);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return 'Basic ' + btoa(bin);
}

const E164 = /^\+[1-9][0-9]{6,14}$/;

export type SmsBeroenden = {
  env?: (k: string) => string | undefined;
  fetch?: typeof fetch;
  /** Förval SMS_TIDSGRANS_MS. */
  tidsgransMs?: number;
};

/**
 * Skickar ett SMS, eller i provläget låtsas skicka det. Kastar
 * aldrig: allt blir ett SmsSvar, och permanent säger om ett nytt
 * försök är meningslöst.
 */
export async function skickaSms(ut: SmsUt, b: SmsBeroenden = {}): Promise<SmsSvar> {
  const env = b.env ?? ((k: string) => Deno.env.get(k));
  const hamta = b.fetch ?? fetch;
  const fel = (text: string, permanent: boolean): SmsSvar => ({ ok: false, id: null, kostnad: null, permanent, fel: text });

  const anvandare = env('ELKS_API_ANVANDARE');
  const losenord = env('ELKS_API_LOSENORD');
  if (!anvandare || !losenord) return fel('SMS-nyckel saknas', true);
  if (!E164.test(ut.till)) return fel('Numret är inte i formatet +46…', true);
  if (!ut.text || !arGsm(ut.text)) return fel('Texten håller inte GSM 03.38', true);

  const kropp = new URLSearchParams({
    from: SMS_AVSANDARE,
    to: ut.till,
    message: ut.text,
    dontlog: 'message',
  });
  if (ut.lage !== 'skicka') kropp.set('dryrun', 'yes');

  // En egen timer i stället för AbortSignal.timeout: den rensas när
  // svaret kommit, så att ingen timer lever kvar efter anropet.
  const ctrl = new AbortController();
  let tidenUte = false;
  const vakt = setTimeout(() => { tidenUte = true; ctrl.abort(); }, b.tidsgransMs ?? SMS_TIDSGRANS_MS);
  let svar: Response;
  try {
    svar = await hamta(SMS_URL, {
      method: 'POST',
      headers: {
        authorization: basic(anvandare, losenord),
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: kropp.toString(),
      signal: ctrl.signal,
    });
  } catch {
    if (!tidenUte) return fel('46elks gick inte att nå', false);
    return ut.lage === 'skicka'
      ? fel('46elks svarade inte i tid. Skickas inte igen, eftersom det kan ha gått fram', true)
      : fel('46elks svarade inte i tid', false);
  } finally {
    clearTimeout(vakt);
  }

  if (!svar.ok) {
    // Kroppen läses inte in i felet: den kan upprepa numret. Status räcker
    // för att veta om det är vårt fel (4xx) eller deras (5xx, 429).
    await svar.body?.cancel().catch(() => {});
    const permanent = svar.status >= 400 && svar.status < 500 && svar.status !== 408 && svar.status !== 429;
    return fel(`46elks svarade ${svar.status}`, permanent);
  }

  const j = await svar.json().catch(() => null) as Record<string, unknown> | null;
  const kostnad = typeof j?.cost === 'number' ? j.cost
    : typeof j?.estimated_cost === 'number' ? j.estimated_cost : null;
  if (j?.status === 'failed') return fel('46elks: failed', true);
  return { ok: true, id: typeof j?.id === 'string' ? j.id : null, kostnad, permanent: false, fel: null };
}
