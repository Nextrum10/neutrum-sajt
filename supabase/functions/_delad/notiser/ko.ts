// ============================================================
// NEXTRUM — notis-ko: själva arbetet, utan Supabase och utan Resend
//
// Allt som talar med omvärlden kommer in som beroenden: kön, Resend
// och 46elks. Det är det som gör att testerna i _delad/notiser/ kan
// köra hela flödet med en låtsas-kö och en låtsas-Resend. Koden ligger
// under _delad/ av samma skäl: CI kör deno test bara där.
//
//
// DATABASEN BESTÄMMER, ARBETAREN SKICKAR
//
// notis_utskick_ta() lämnar bara ut rader som faktiskt ska gå: den
// har redan prövat flaggan, mottagarens val, om passet fortfarande är
// bokat, om chatten redan lästs och om utskicket är för sent, och den
// har redan valt adressen (auth.users, eller sandlådan). Raderna är
// låsta i fem minuter. Här finns alltså ingen affärslogik kvar, bara
// att skriva mejlet, skicka det och säga hur det gick.
//
// ETT MEJL UTAN AVREGISTRERING SKICKAS INTE. Tokenen kräver mottagarens
// id, som notis_utskick_ta lämnar ut sedan 2.3d. Saknas det ändå blir
// raden ett tillfälligt fel och prövas igen, i stället för att gå ut
// utan länk.
//
// ETT FEL PÅ KONTOT STOPPAR KÖRNINGEN. Svarar Resend 401 eller 403 är
// det nyckeln eller avsändardomänen, inte mejlet. Att fortsätta rad
// för rad hade bränt hela kön på något som rättas på ett ställe. Raden
// som fick svaret går tillbaka som tillfälligt fel, övriga mejl i
// omgången går tillbaka utan försök, ingen ny omgång tas och skälet
// står i notis_korningar.
//
// KÖRNINGEN SKA VARA KLAR INNAN DATABASEN SLUTAR VÄNTA. notis_minut()
// väntar 20 sekunder på svar. Ett svar som kommer senare sparas i
// net._http_response som tidsgräns, och adminvyn visar det under Fel
// som ett anrop som inte gick fram, fast allt gick. Därför slutar
// arbetaren ta nya rader efter cirka 15 sekunder, och tar aldrig fler
// än hinner gå. cron väcker den igen nästa minut.
//
// ALDRIG BRÖDTEXT I LOGGARNA. Det som loggas är radens id, typ, kanal
// och utfall. Aldrig adress, nummer, namn eller leverantörens felkropp,
// som kan upprepa adressen.
// ============================================================

import type { Mejl } from '../mejl.ts';
import { epostOk } from '../http.ts';
import { smsText, type SmsSvar, type SmsUt } from '../sms.ts';
import { renderaMejl, KONTAKT, type ProvLage } from './rendera.ts';
import { skapaToken } from './token.ts';
import { arMejlbar } from './typer.ts';

export const FRAN = 'Nextrum <no-reply@nextrum.se>';

/** En rad ur notis_utskick_ta() (2.3d). */
export type UtskickRad = {
  id: string;
  /** Mottagarens id i profiles. Tokenen i avregistreringslänken signeras för det. */
  mottagare: string | null;
  kanal: string;
  typ: string;
  antal: number | null;
  data: unknown;
  /** Mottagarens roll, eller för en provrad (data.prov) den roll admin valde. */
  roll: string | null;
  fornamn: string | null;
  epost: string | null;
  telefon: string | null;
  till_sandlada: boolean | null;
  sms_lage: string | null;
};

/** Argumenten till notis_utskick_klar. */
export type Klar = {
  id: string;
  ok: boolean;
  fel: string | null;
  leverantorId: string | null;
  permanent: boolean;
  loggad: boolean;
};

export type Summering = { behandlade: number; skickade: number; misslyckade: number };

export type Beroenden = {
  /** rpc notis_utskick_ta(p_max). */
  ta: (max: number) => Promise<UtskickRad[]>;
  /** rpc notis_utskick_klar. */
  klar: (k: Klar) => Promise<void>;
  /** rpc notis_arbetare_klar. */
  arbetareKlar: (s: Summering, meddelande: string | null) => Promise<void>;
  skickaMejl: (m: Mejl) => Promise<Response>;
  skickaSms: (s: SmsUt) => Promise<SmsSvar>;
  /** notis_avregistreringsnyckel(), base64. */
  nyckel: string;
  /** https://<ref>.supabase.co/functions/v1, för List-Unsubscribe. */
  funktionUrl: string;
  nu?: () => Date;
  /** Ingen ny omgång tas efter så här lång tid. Förval TIDSGRANS_MS. */
  tidsgransMs?: number;
  /** Högst så många rader per omgång. Förval PER_OMGANG. */
  perOmgang?: number;
  logg?: (rad: string) => void;
};

export type Resultat = Summering & {
  meddelande: string | null;
  /** Kön gick inte att läsa. */
  fel: boolean;
  /** Resend svarade 401 eller 403 och körningen avbröts. */
  mejlStoppat: boolean;
};

type Utfall = Klar & { kostnad?: number | null; stopp?: boolean };

/**
 * notis_minut() väntar 20 sekunder. 15 lämnar marginal för den sista
 * raden och för svaret tillbaka.
 */
export const TIDSGRANS_MS = 15_000;

/** Små omgångar, så att en omgång som börjar strax före gränsen inte drar långt över. */
export const PER_OMGANG = 10;

/**
 * Så länge ett anrop till Resend eller 46elks får ta. Utan gräns kan ett
 * hängande anrop hålla raden längre än lånet på fem minuter, och då tas
 * raden igen medan det första anropet fortfarande pågår.
 */
export const ANROP_TIDSGRANS_MS = 8_000;

const MAX_OMGANGAR = 40;

export type Mejlfel = 'permanent' | 'tillfalligt' | 'kontot';

/**
 * Hur ett felsvar från Resend ska tas emot.
 *
 *   401, 403   kontot: nyckeln saknas eller är fel, eller domänen är inte
 *              verifierad. Gäller varje mejl, så körningen stoppas.
 *   408        Resend hann inte. Samma anrop kan gå nästa gång.
 *   409        krock på idempotensnyckeln: samma rad skickas redan, till
 *              exempel efter ett lån som gått ut. Ett nytt försök med
 *              samma nyckel får det första anropets svar.
 *   429, 5xx   blir bättre av att vänta.
 *   övriga 4xx fel i själva mejlet (adressen, innehållet). Ett nytt
 *              försök ger samma svar.
 */
export function mejlfelSort(status: number): Mejlfel {
  if (status === 401 || status === 403) return 'kontot';
  if (status === 408 || status === 409 || status === 429) return 'tillfalligt';
  if (status >= 400 && status < 500) return 'permanent';
  return 'tillfalligt';
}

/** Resends felnamn (validation_error, rate_limit_exceeded …), aldrig meddelandet. */
async function resendFelnamn(svar: Response): Promise<string> {
  const j = await svar.json().catch(() => null) as { name?: unknown } | null;
  const namn = typeof j?.name === 'string' ? j.name.replace(/[^a-z_]/g, '').slice(0, 60) : '';
  return namn ? `Resend ${svar.status}: ${namn}` : `Resend ${svar.status}`;
}

function klart(id: string, ok: boolean, fel: string | null, permanent = false): Utfall {
  return { id, ok, fel, leverantorId: null, permanent, loggad: false };
}

function arTidsgrans(e: unknown): boolean {
  return (e as { name?: unknown } | null)?.name === 'TimeoutError';
}

async function mejla(r: UtskickRad, b: Beroenden, nu: Date): Promise<Utfall> {
  const typ = r.typ;
  if (!epostOk(r.epost)) return klart(r.id, false, 'Ogiltig e-postadress.', true);
  if (!arMejlbar(typ)) return klart(r.id, false, 'Typen mejlas inte.', true);

  const prov: ProvLage = r.till_sandlada === true ? 'sandlada'
    : (r.data as { prov?: unknown } | null)?.prov === true ? 'provmejl' : 'nej';

  // I sandlådan läser någon annan än mottagaren mejlet. En äkta
  // avregistreringslänk där hade stängt av mejlen för familjen, så
  // länken pekar inte på någon och List-Unsubscribe utelämnas.
  let token: string | null = null;
  if (prov !== 'sandlada') {
    if (!r.mottagare) return klart(r.id, false, 'Mottagaren saknades i raden. Inget skickades utan avregistreringslänk.');
    token = await skapaToken(r.mottagare, 'mejl', typ, b.nyckel);
  }

  const m = renderaMejl({
    typ, roll: r.roll ?? 'parent', fornamn: r.fornamn, antal: r.antal ?? 1,
    data: r.data, token, prov, nu,
  });

  const headers: Record<string, string> = {};
  if (token) {
    headers['List-Unsubscribe'] =
      `<${b.funktionUrl}/notis-avanmal?t=${encodeURIComponent(token)}>, <mailto:${KONTAKT}?subject=Avregistrera>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  let svar: Response;
  try {
    svar = await b.skickaMejl({
      fran: FRAN,
      till: [String(r.epost).trim()],
      svaraTill: [KONTAKT],
      amne: m.amne,
      text: m.text,
      html: m.html,
      // Samma rad ger samma nyckel. Går raden igen efter ett avbrott
      // (lånet gick ut innan notis_utskick_klar hann köras) skickar
      // Resend inte en gång till.
      idempotens: `nextrum-notis-${r.id}`,
      headers,
      tidsgransMs: ANROP_TIDSGRANS_MS,
    });
  } catch (e) {
    // Också ett anrop som tog för lång tid prövas igen: kom det fram
    // ändå svarar Resend nästa gång med samma id, tack vare nyckeln.
    return klart(r.id, false, arTidsgrans(e) ? 'Resend svarade inte i tid.' : 'Resend gick inte att nå.');
  }

  if (svar.ok) {
    const j = await svar.json().catch(() => null) as { id?: unknown } | null;
    return { ...klart(r.id, true, null), leverantorId: typeof j?.id === 'string' ? j.id : null };
  }
  const sort = mejlfelSort(svar.status);
  return { ...klart(r.id, false, await resendFelnamn(svar), sort === 'permanent'), stopp: sort === 'kontot' };
}

async function smsa(r: UtskickRad, b: Beroenden, nu: Date): Promise<Utfall> {
  if (r.typ !== 'paminnelse') return klart(r.id, false, 'SMS finns bara för påminnelser.', true);
  if (!r.telefon) return klart(r.id, false, 'Inget mobilnummer.', true);

  // Allt som inte uttryckligen är 'skicka' är prov. Ett okänt läge
  // ska kosta noll kronor, inte skicka.
  const lage = r.sms_lage === 'skicka' ? 'skicka' : 'prov';
  const s = await b.skickaSms({ till: r.telefon, text: smsText({ roll: r.roll, data: r.data, nu }), lage });
  if (!s.ok) return klart(r.id, false, s.fel ?? 'SMS gick inte att skicka.', s.permanent);
  return { id: r.id, ok: true, fel: null, leverantorId: s.id, permanent: false, loggad: lage === 'prov', kostnad: s.kostnad };
}

async function behandla(r: UtskickRad, b: Beroenden, nu: Date): Promise<Utfall> {
  try {
    if (r.kanal === 'mejl') return await mejla(r, b, nu);
    if (r.kanal === 'sms') return await smsa(r, b, nu);
    return klart(r.id, false, 'Okänd kanal.', true);
  } catch {
    // Ett fel i vår egen kod (en mall, en token). Ett nytt försök
    // hjälper sällan, men raden får fem chanser innan den blir 'fel',
    // och det syns i adminvyn med den här texten.
    return klart(r.id, false, 'Utskicket gick inte att förbereda.');
  }
}

/** Kostnaden som 46elks räknar i tiotusendelar, som text med två decimaler. */
function kostnadText(tiotusendelar: number): string {
  return (tiotusendelar / 10000).toFixed(2).replace('.', ',');
}

const OFORSOKT = 'Inte försökt: körningen avbröts efter ett nyckel- eller domänfel hos Resend.';

/**
 * Tömmer kön i omgångar tills den är tom eller tidsgränsen nåtts.
 * Kastar aldrig: ett fel blir fel=true och en rad i notis_korningar.
 */
export async function korKon(b: Beroenden): Promise<Resultat> {
  const nu = b.nu ?? (() => new Date());
  const logg = b.logg ?? ((s: string) => console.log(s));
  const grans = b.tidsgransMs ?? TIDSGRANS_MS;
  const perOmgang = b.perOmgang ?? PER_OMGANG;
  const start = nu().getTime();

  const s: Summering = { behandlade: 0, skickade: 0, misslyckade: 0 };
  let prov = 0;
  let provKostnad = 0;
  let klarFel = 0;
  let fel = false;
  let avbrott: string | null = null;
  let senasteFull = false;
  // Svaret från Resend som stoppade körningen, till exempel "Resend 403: validation_error".
  let stopp: string | null = null;
  let oforsokta = 0;

  const markera = async (u: Klar) => {
    try {
      await b.klar({ id: u.id, ok: u.ok, fel: u.fel, leverantorId: u.leverantorId, permanent: u.permanent, loggad: u.loggad });
    } catch {
      // Raden står kvar som 'skickar' tills lånet går ut och tas då
      // igen. Mejlet skyddas av idempotensnyckeln.
      klarFel++;
      logg(`notis-ko: ${u.id} gick inte att markera som klar`);
    }
  };

  try {
    for (let omgang = 0; omgang < MAX_OMGANGAR && !stopp; omgang++) {
      // Hur många rader som hinner gå före gränsen, räknat på hur lång
      // tid en rad tagit hittills i körningen. En rad som tagits ur kön
      // är utlånad och har fått ett försök till, så det är bättre att ta
      // färre än att lämna tillbaka.
      //
      // FÖRSTA OMGÅNGEN HAR INGEN MÄTNING och tog därför perOmgang
      // rader rakt av. Tio mejl som var och ett gick mot
      // ANROP_TIDSGRANS_MS blev 80 sekunder, medan notis_minut() väntar
      // i 20: svaret hamnade i net._http_response som en tidsgräns, och
      // adminvyn visade en körning där varje mejl gick ut som ett anrop
      // som inte gick fram.
      //
      // Utan mätning räknas därför på det långsammaste en rad KAN ta.
      // Det blir en rad i första omgången; går den fort finns en riktig
      // mätning redan i omgång två, och då tas hela perOmgang. Kostnaden
      // är ett extra anrop per körning, och vinsten är att en rad aldrig
      // lånas ut för att sedan lämnas tillbaka oförsökt — det senare
      // kostar ett av radens fem försök och skjuter den framåt, och fem
      // sådana varv gör en notis som aldrig prövats till status 'fel'.
      const gatt = nu().getTime() - start;
      const perRad = s.behandlade ? gatt / s.behandlade : ANROP_TIDSGRANS_MS;
      const hinner = Math.floor((grans - gatt) / perRad);
      const max = Math.min(perOmgang, hinner);
      if (gatt >= grans || max < 1) {
        if (senasteFull) avbrott = 'Tidsgränsen nåddes, resten tas vid nästa körning';
        break;
      }

      const rader = await b.ta(max);
      if (!rader.length) break;
      senasteFull = rader.length >= max;

      for (const r of rader) {
        // Efter ett kontofel går omgångens övriga mejl tillbaka utan
        // försök. SMS går inte genom Resend och skickas som vanligt.
        if (stopp && r.kanal === 'mejl') {
          oforsokta++;
          logg(`notis-ko: ${r.id} ${r.kanal} ${r.typ} tillbaka utan försök`);
          await markera(klart(r.id, false, OFORSOKT));
          continue;
        }

        s.behandlade++;
        const u = await behandla(r, b, nu());
        if (!u.ok) s.misslyckade++;
        else if (u.loggad) { prov++; provKostnad += u.kostnad ?? 0; }
        else s.skickade++;
        if (u.stopp) stopp = u.fel;
        logg(`notis-ko: ${r.id} ${r.kanal} ${r.typ} ${u.ok ? (u.loggad ? 'loggad' : 'skickad')
          : u.stopp ? 'kontofel, körningen avbryts' : (u.permanent ? 'permanent fel' : 'tillfälligt fel')}`);
        await markera(u);
      }
    }
  } catch {
    fel = true;
    logg('notis-ko: kön gick inte att läsa');
  }

  const delar: string[] = [];
  if (fel) delar.push('Kön gick inte att läsa');
  if (stopp) {
    // Först i meddelandet: adminvyn visar bara de första 200 tecknen.
    delar.unshift(`${stopp}. Nyckeln eller avsändardomänen godtogs inte. Körningen avbröts och mejlet gick tillbaka till kön`
      + (oforsokta ? `, liksom ${oforsokta} mejl som inte försöktes` : ''));
  }
  if (avbrott) delar.push(avbrott);
  if (klarFel) delar.push(`${klarFel} rader gick inte att markera som klara och tas igen när lånet gått ut`);
  if (prov) delar.push(`${prov} SMS i provläge` + (provKostnad ? `, beräknad kostnad ${kostnadText(provKostnad)} i kontots valuta` : ''));
  const meddelande = delar.length ? delar.join('. ') + '.' : null;

  try {
    await b.arbetareKlar(s, meddelande);
  } catch {
    logg('notis-ko: körningen gick inte att logga');
  }
  return { ...s, meddelande, fel, mejlStoppat: stopp !== null };
}
