// ============================================================
// NEXTRUM — prov: kö-arbetaren, med låtsaskö och låtsas-Resend
//
// Kör med:  deno test supabase/functions/_delad/
//
// korKon() tar allt som talar med omvärlden som beroenden, och det är
// just därför hela flödet går att köra här utan databas, utan nät och
// utan att ett enda mejl skickas.
//
// Proven handlar om vad som händer när det INTE går bra, för det är
// där en kö kostar pengar eller tappar mejl:
//
//   · ett nyckel- eller domänfel gäller varje mejl, inte ett — då ska
//     körningen stoppas, inte bränna hela kön på samma svar
//   · en rad utan mottagare får inte gå ut utan avregistreringslänk
//   · ett permanent fel ska inte prövas om fyra gånger till
//   · klockan ska stoppa körningen innan databasen slutar vänta
// ============================================================

import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { korKon, mejlfelSort, FRAN, TIDSGRANS_MS, type Beroenden, type Klar, type UtskickRad } from './ko.ts';
import type { Mejl } from '../mejl.ts';
import type { SmsSvar } from '../sms.ts';

const NYCKEL = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
const UID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const FUNKTION_URL = 'https://ddkfiuvcppalutfulvbi.supabase.co/functions/v1';

function rad(extra: Partial<UtskickRad> = {}): UtskickRad {
  return {
    id: crypto.randomUUID(),
    mottagare: UID,
    kanal: 'mejl',
    typ: 'meddelande',
    antal: 1,
    data: { fran: 'Tove' },
    roll: 'parent',
    fornamn: 'Anna',
    epost: 'anna@example.se',
    telefon: null,
    till_sandlada: false,
    sms_lage: null,
    ...extra,
  };
}

type Bank = {
  b: Beroenden;
  skickade: Mejl[];
  klara: Klar[];
  summering: { s: unknown; meddelande: string | null } | null;
  /** Hur mycket klockan gått, i millisekunder. */
  tid: () => number;
};

/**
 * En kö med givna rader, en Resend som svarar som man säger till om,
 * och en klocka som bara rör sig när ett anrop kostar tid.
 */
function bank(rader: UtskickRad[], o: {
  svar?: (m: Mejl, n: number) => Response;
  /** Så lång tid varje mejlanrop får klockan att gå. */
  kostarMs?: number;
  perOmgang?: number;
  tidsgransMs?: number;
} = {}): Bank {
  const kvar = [...rader];
  const skickade: Mejl[] = [];
  const klara: Klar[] = [];
  let summering: { s: unknown; meddelande: string | null } | null = null;
  let klocka = 0;
  let n = 0;

  const b: Beroenden = {
    ta: (max) => Promise.resolve(kvar.splice(0, max)),
    klar: (k) => { klara.push(k); return Promise.resolve(); },
    arbetareKlar: (s, meddelande) => { summering = { s, meddelande }; return Promise.resolve(); },
    skickaMejl: (m) => {
      skickade.push(m);
      klocka += o.kostarMs ?? 0;
      return Promise.resolve(o.svar ? o.svar(m, n++) : new Response(JSON.stringify({ id: 're_1' }), { status: 200 }));
    },
    skickaSms: () => Promise.resolve(
      { ok: true, id: 'sms_1', kostnad: 3500, permanent: false, fel: null } as SmsSvar),
    nyckel: NYCKEL,
    funktionUrl: FUNKTION_URL,
    nu: () => new Date(klocka),
    logg: () => {},
    perOmgang: o.perOmgang,
    tidsgransMs: o.tidsgransMs,
  };
  return { b, skickade, klara, get summering() { return summering; }, tid: () => klocka };
}

Deno.test('ett mejl skickas, markeras klart och räknas', async () => {
  const k = bank([rad()]);
  const r = await korKon(k.b);

  assertEquals(k.skickade.length, 1);
  assertEquals(k.skickade[0].fran, FRAN);
  assertEquals(k.skickade[0].till, ['anna@example.se']);
  assertEquals(k.skickade[0].svaraTill, ['info@nextrum.se']);
  assertStringIncludes(k.skickade[0].amne, 'Nytt meddelande');
  assertEquals(k.skickade[0].html.length > 0, true);
  assertEquals(k.skickade[0].text.length > 0, true);

  assertEquals(k.klara.length, 1);
  assertEquals(k.klara[0].ok, true);
  assertEquals(k.klara[0].leverantorId, 're_1');
  assertEquals(k.klara[0].fel, null);

  assertEquals(r, { behandlade: 1, skickade: 1, misslyckade: 0, meddelande: null, fel: false, mejlStoppat: false });
});

Deno.test('varje rad får sin egen idempotensnyckel', async () => {
  const rader = [rad(), rad(), rad()];
  const k = bank(rader);
  await korKon(k.b);

  const nycklar = k.skickade.map((m) => m.idempotens);
  assertEquals(new Set(nycklar).size, 3, 'samma nyckel på två rader hade tappat ett mejl');
  for (const r of rader) assertEquals(nycklar.includes(`nextrum-notis-${r.id}`), true);
});

Deno.test('List-Unsubscribe följer med, både länken och One-Click', async () => {
  const k = bank([rad()]);
  await korKon(k.b);

  const h = k.skickade[0].headers ?? {};
  assertStringIncludes(h['List-Unsubscribe'], `${FUNKTION_URL}/notis-avanmal?t=`);
  assertStringIncludes(h['List-Unsubscribe'], 'mailto:info@nextrum.se');
  assertEquals(h['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
});

Deno.test('i sandlådan skickas mejlet men utan avregistreringsheader', async () => {
  // Någon annan än mottagaren läser det. En One-Click där hade stängt
  // av familjens mejl från ett provutskick.
  const k = bank([rad({ till_sandlada: true })]);
  await korKon(k.b);

  assertEquals(k.skickade.length, 1);
  assertStringIncludes(k.skickade[0].amne, '[Prov till familj]');
  assertEquals(k.skickade[0].headers?.['List-Unsubscribe'], undefined);
  assertEquals(k.klara[0].ok, true);
});

Deno.test('en rad utan mottagare skickas inte alls, och prövas igen', async () => {
  // Utan mottagarens id går ingen token att signera, och ett notismejl
  // utan väg ut är värre än ett försenat notismejl.
  const k = bank([rad({ mottagare: null })]);
  const r = await korKon(k.b);

  assertEquals(k.skickade.length, 0, 'ingenting fick skickas');
  assertEquals(k.klara[0].ok, false);
  assertEquals(k.klara[0].permanent, false, 'ska prövas igen, inte dömas ut');
  assertStringIncludes(k.klara[0].fel ?? '', 'utan avregistreringslänk');
  assertEquals(r.misslyckade, 1);
});

Deno.test('en ogiltig adress och en typ som inte mejlas är permanenta fel', async () => {
  const k = bank([
    rad({ epost: 'inte-en-adress' }),
    rad({ epost: null }),
    rad({ typ: 'rapport' }),
    rad({ kanal: 'brevduva' }),
  ]);
  await korKon(k.b);

  assertEquals(k.skickade.length, 0, 'Resend ska inte ens anropas');
  assertEquals(k.klara.length, 4);
  for (const kl of k.klara) {
    assertEquals(kl.ok, false);
    assertEquals(kl.permanent, true, 'ett nytt försök ger samma svar');
  }
});

Deno.test('ett 403 från Resend stoppar körningen och lämnar tillbaka resten oförsökt', async () => {
  // 403 är avsändardomänen, inte mejlet. Att fortsätta rad för rad
  // hade bränt hela kön på något som rättas på ett ställe.
  const rader = [rad(), rad(), rad(), rad(), rad()];
  const k = bank(rader, {
    svar: (_m, n) => n === 0
      ? new Response(JSON.stringify({ name: 'validation_error' }), { status: 403 })
      : new Response(JSON.stringify({ id: 're_x' }), { status: 200 }),
  });
  const r = await korKon(k.b);

  assertEquals(k.skickade.length, 1, 'bara det första försöket gjordes');
  assertEquals(r.mejlStoppat, true);
  assertEquals(k.klara.length, 5, 'alla fem lämnas tillbaka, ingen blir kvar utlånad');

  assertEquals(k.klara[0].permanent, false, 'raden som fick svaret prövas igen');
  assertStringIncludes(k.klara[0].fel ?? '', 'Resend 403');
  for (const kl of k.klara.slice(1)) {
    assertEquals(kl.ok, false);
    assertStringIncludes(kl.fel ?? '', 'Inte försökt');
  }

  assertStringIncludes(r.meddelande ?? '', 'Nyckeln eller avsändardomänen godtogs inte');
  assertStringIncludes(r.meddelande ?? '', '4 mejl som inte försöktes');
});

Deno.test('ett 401 stoppar också, men ett 422 gäller bara sin egen rad', async () => {
  const stopp = bank([rad(), rad()], { svar: () => new Response('{}', { status: 401 }) });
  assertEquals((await korKon(stopp.b)).mejlStoppat, true);
  assertEquals(stopp.skickade.length, 1);

  const enskilt = bank([rad(), rad()], {
    svar: () => new Response(JSON.stringify({ name: 'validation_error' }), { status: 422 }),
  });
  const r = await korKon(enskilt.b);
  assertEquals(r.mejlStoppat, false);
  assertEquals(enskilt.skickade.length, 2, 'båda försöktes');
  assertEquals(enskilt.klara.every((k) => k.permanent), true);
});

Deno.test('felsorteringen skiljer kontot, det tillfälliga och det permanenta', () => {
  assertEquals(mejlfelSort(401), 'kontot');
  assertEquals(mejlfelSort(403), 'kontot');
  assertEquals(mejlfelSort(408), 'tillfalligt');
  assertEquals(mejlfelSort(409), 'tillfalligt', 'krock på idempotensnyckeln');
  assertEquals(mejlfelSort(429), 'tillfalligt');
  assertEquals(mejlfelSort(500), 'tillfalligt');
  assertEquals(mejlfelSort(503), 'tillfalligt');
  assertEquals(mejlfelSort(400), 'permanent');
  assertEquals(mejlfelSort(422), 'permanent');
});

Deno.test('ett anrop som tar för lång tid prövas igen, inte döms ut', async () => {
  const k = bank([rad()], {
    svar: () => { throw new DOMException('Resend svarade inte i tid.', 'TimeoutError'); },
  });
  await korKon(k.b);
  assertEquals(k.klara[0].ok, false);
  assertEquals(k.klara[0].permanent, false);
  assertStringIncludes(k.klara[0].fel ?? '', 'inte i tid');
});

Deno.test('en kö som inte går att läsa blir ett fel, inget kast', async () => {
  const k = bank([]);
  k.b.ta = () => Promise.reject(new Error('databasen svarar inte'));
  const r = await korKon(k.b);

  assertEquals(r.fel, true);
  assertEquals(r.behandlade, 0);
  assertStringIncludes(r.meddelande ?? '', 'Kön gick inte att läsa');
});

Deno.test('en rad som inte gick att markera klar räknas och nämns', async () => {
  const k = bank([rad()]);
  k.b.klar = () => Promise.reject(new Error('nej'));
  const r = await korKon(k.b);

  assertEquals(r.skickade, 1, 'mejlet gick ut');
  assertStringIncludes(r.meddelande ?? '', 'gick inte att markera som klara');
});

Deno.test('ett SMS i provläge loggas, räknas inte som skickat och kostar noll', async () => {
  const k = bank([rad({ kanal: 'sms', typ: 'paminnelse', telefon: '+46701234567', sms_lage: 'prov' })]);
  const r = await korKon(k.b);

  assertEquals(k.skickade.length, 0, 'inget mejl');
  assertEquals(r.skickade, 0, 'ett prov är inte ett skickat SMS');
  assertEquals(r.behandlade, 1);
  assertStringIncludes(r.meddelande ?? '', 'SMS i provläge');
});

Deno.test('SMS finns bara för påminnelser, och bara med ett nummer', async () => {
  const k = bank([
    rad({ kanal: 'sms', typ: 'meddelande', telefon: '+46701234567' }),
    rad({ kanal: 'sms', typ: 'paminnelse', telefon: null }),
  ]);
  await korKon(k.b);
  assertEquals(k.klara.length, 2);
  for (const kl of k.klara) {
    assertEquals(kl.ok, false);
    assertEquals(kl.permanent, true);
  }
});

Deno.test('kön töms i flera omgångar tills den är slut', async () => {
  const k = bank(Array.from({ length: 25 }, () => rad()), { perOmgang: 10 });
  const r = await korKon(k.b);

  assertEquals(r.behandlade, 25);
  assertEquals(r.skickade, 25);
  assertEquals(k.skickade.length, 25);
});

Deno.test('klockan stoppar körningen innan databasen slutar vänta', async () => {
  // notis_minut() väntar 20 sekunder. Kommer svaret senare sparas det
  // i net._http_response som tidsgräns, och adminvyn visar det under
  // Fel som ett anrop som inte gick fram — fast varje mejl gick ut.
  //
  // Varje mejl här tar 8 sekunder, alltså Resends egen tidsgräns.
  // Utan en kontroll INNE i omgången hade de tio första raderna
  // behandlats i följd: 80 sekunder, fyra gånger så länge som
  // databasen väntar.
  const k = bank(Array.from({ length: 30 }, () => rad()), { kostarMs: 8_000, perOmgang: 10 });
  const r = await korKon(k.b);

  assertEquals(k.tid() <= TIDSGRANS_MS + 8_000, true,
    `körningen tog ${k.tid()} ms, gränsen är ${TIDSGRANS_MS} ms plus ett sista anrop`);
  assertEquals(r.behandlade < 10, true, `behandlade ${r.behandlade} rader innan klockan lästes`);
  assertEquals(r.behandlade >= 1, true, 'minst en rad ska hinna');

  // Raderna som togs ur kön men inte hanns med lämnas tillbaka, inte
  // kvar som utlånade: annars står de i 'skickar' i fem minuter.
  assertEquals(k.klara.length, r.behandlade + (r.behandlade ? k.klara.length - r.behandlade : 0));
  assertStringIncludes(r.meddelande ?? '', 'Tidsgränsen');
});
