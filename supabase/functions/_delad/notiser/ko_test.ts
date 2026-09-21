// ============================================================
// NEXTRUM — tester för arbetaren i notis-ko
//
// Kör med:  deno test supabase/functions/_delad/
//
// Kön, Resend och 46elks är låtsade. Det som testas är det arbetaren
// själv bestämmer:
//
//   · varje mejl har idempotensnyckel, svarsadress och List-Unsubscribe
//   · tokenen signeras för mottagaren ur raden
//   · sandlådan får ingen äkta avregistrering
//   · inget mejl går ut utan avregistreringslänk
//   · vilka fel som är permanenta och vilka som prövas igen
//   · 401 och 403 från Resend stoppar körningen i stället för att bränna kön
//   · körningen tar inga fler rader än som hinner gå före tidsgränsen
//   · SMS i provläget blir loggade, inte skickade
//   · varje rad får notis_utskick_klar, och körningen loggas en gång
//   · loggarna bär aldrig adress, nummer eller namn
// ============================================================

import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import type { Mejl } from '../mejl.ts';
import type { SmsSvar, SmsUt } from '../sms.ts';
import { korKon, mejlfelSort, TIDSGRANS_MS, type Beroenden, type Klar, type Summering, type UtskickRad } from './ko.ts';
import { lasToken } from './token.ts';

const NYCKEL = btoa('0123456789abcdef0123456789abcdef');
const UID = '3f2c8a1e-5b7d-4c9e-8f01-2a3b4c5d6e7f';
const FUNK = 'https://ddkfiuvcppalutfulvbi.supabase.co/functions/v1';
const NU = new Date('2026-09-22T10:00:00Z');

function rad(over: Partial<UtskickRad> = {}): UtskickRad {
  return {
    id: crypto.randomUUID(), mottagare: UID, kanal: 'mejl', typ: 'pass_nytt', antal: 1,
    data: { datum: '2026-09-23', tid: '16:00', amne: 'Matematik', elev: 'Alva', studiehjalpare: 'Tove', status: 'confirmed' },
    roll: 'parent', fornamn: 'Anna', epost: 'anna.hemlig@example.se', telefon: null,
    till_sandlada: false, sms_lage: 'prov', ...over,
  };
}

type Spar = {
  mejl: Mejl[];
  sms: SmsUt[];
  klar: Klar[];
  korningar: { s: Summering; meddelande: string | null }[];
  loggar: string[];
  tagna: number;
  /** p_max i varje anrop till notis_utskick_ta. */
  maxar: number[];
};

function bygg(omgangar: UtskickRad[][], over: Partial<Beroenden> = {}): { b: Beroenden; spar: Spar } {
  const spar: Spar = { mejl: [], sms: [], klar: [], korningar: [], loggar: [], tagna: 0, maxar: [] };
  const ko = [...omgangar];
  const b: Beroenden = {
    // Som databasen: aldrig fler rader än p_max.
    ta: (max) => { spar.tagna++; spar.maxar.push(max); return Promise.resolve((ko.shift() ?? []).slice(0, max)); },
    klar: (k) => { spar.klar.push(k); return Promise.resolve(); },
    arbetareKlar: (s, meddelande) => { spar.korningar.push({ s, meddelande }); return Promise.resolve(); },
    skickaMejl: (m) => { spar.mejl.push(m); return Promise.resolve(new Response(JSON.stringify({ id: 're_123' }))); },
    skickaSms: (s): Promise<SmsSvar> => {
      spar.sms.push(s);
      return Promise.resolve({ ok: true, id: s.lage === 'skicka' ? 'elk_1' : null, kostnad: 5200, permanent: false, fel: null });
    },
    nyckel: NYCKEL,
    funktionUrl: FUNK,
    nu: () => NU,
    logg: (s) => spar.loggar.push(s),
    ...over,
  };
  return { b, spar };
}

Deno.test('ett mejl går ut med avsändare, svarsadress, idempotensnyckel och List-Unsubscribe', async () => {
  const r = rad();
  const { b, spar } = bygg([[r]]);
  const res = await korKon(b);

  assertEquals([res.behandlade, res.skickade, res.misslyckade, res.fel], [1, 1, 0, false]);
  assertEquals(spar.mejl.length, 1);
  const m = spar.mejl[0];
  assertEquals(m.fran, 'Nextrum <no-reply@nextrum.se>');
  assertEquals(m.till, ['anna.hemlig@example.se']);
  assertEquals(m.svaraTill, ['info@nextrum.se']);
  assertEquals(m.idempotens, `nextrum-notis-${r.id}`);

  const lista = m.headers?.['List-Unsubscribe'] ?? '';
  const t = decodeURIComponent(/notis-avanmal\?t=([^>]+)>/.exec(lista)?.[1] ?? '');
  assert(lista.startsWith(`<${FUNK}/notis-avanmal?t=`), lista);
  assertStringIncludes(lista, '<mailto:info@nextrum.se?subject=Avregistrera>');
  assertEquals(m.headers?.['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  // Tokenen gäller mottagaren, mejl och just den här typen.
  assertEquals(await lasToken(t, NYCKEL), { uid: UID, kanal: 'mejl', typ: 'pass_nytt' });
  // Samma token står i den synliga länken.
  assertStringIncludes(m.html, `https://nextrum.se/avanmal?t=${t}`);

  assertEquals(spar.klar, [{ id: r.id, ok: true, fel: null, leverantorId: 're_123', permanent: false, loggad: false }]);
  assertEquals(spar.korningar, [{ s: { behandlade: 1, skickade: 1, misslyckade: 0 }, meddelande: null }]);
});

Deno.test('sandlådan får provmärkt ämne och ingen äkta avregistrering', async () => {
  const r = rad({ till_sandlada: true, epost: 'sandlada@nextrum.se', roll: 'tutor' });
  const { b, spar } = bygg([[r]]);
  await korKon(b);
  const m = spar.mejl[0];
  assert(m.amne.startsWith('[Prov till studiehjälpare] '), m.amne);
  assertEquals(m.headers?.['List-Unsubscribe'], undefined);
  assert(!m.html.includes('avanmal?t='), 'äkta token i sandlådan');
});

Deno.test('ett provmejl renderas för rollen i raden och får en äkta länk för mottagaren', async () => {
  // För en provrad är roll den roll admin valde (notis_provmejl, 2.3d),
  // och mottagaren är admin själv.
  const admin = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
  const r = rad({ mottagare: admin, roll: 'tutor', data: { prov: true, datum: '2026-09-23', tid: '16:00', amne: 'Matematik' } });
  const { b, spar } = bygg([[r]]);
  await korKon(b);
  const m = spar.mejl[0];
  assert(m.amne.startsWith('[Prov till studiehjälpare] '), m.amne);
  const lista = m.headers?.['List-Unsubscribe'] ?? '';
  const t = decodeURIComponent(/notis-avanmal\?t=([^>]+)>/.exec(lista)?.[1] ?? '');
  assertEquals(await lasToken(t, NYCKEL), { uid: admin, kanal: 'mejl', typ: 'pass_nytt' });
});

Deno.test('saknas mottagaren i raden skickas inget, och raden prövas igen', async () => {
  const r = rad({ mottagare: null });
  const { b, spar } = bygg([[r]]);
  const res = await korKon(b);
  assertEquals(spar.mejl.length, 0);
  assertEquals(res.misslyckade, 1);
  assertEquals([spar.klar[0].ok, spar.klar[0].permanent], [false, false]);
});

Deno.test('Resend: 4xx är permanent utom 408, 409 och 429, som prövas igen liksom 5xx och nätfel', async () => {
  const fall = [[400, true], [404, true], [422, true], [408, false], [409, false], [429, false], [500, false], [503, false]] as const;
  for (const [status, permanent] of fall) {
    const { b, spar } = bygg([[rad()]], {
      skickaMejl: () => Promise.resolve(new Response(
        JSON.stringify({ name: 'validation_error', message: 'Invalid `to` field anna.hemlig@example.se' }), { status })),
    });
    const res = await korKon(b);
    assertEquals(res.misslyckade, 1, String(status));
    assertEquals(res.mejlStoppat, false, String(status));
    assertEquals(spar.klar[0].permanent, permanent, String(status));
    assertEquals(spar.klar[0].fel, `Resend ${status}: validation_error`, String(status));
  }
  assertEquals([mejlfelSort(401), mejlfelSort(403)], ['kontot', 'kontot']);

  const { b, spar } = bygg([[rad()]], { skickaMejl: () => Promise.reject(new Error('nätet')) });
  await korKon(b);
  assertEquals([spar.klar[0].ok, spar.klar[0].permanent, spar.klar[0].fel], [false, false, 'Resend gick inte att nå.']);

  // Ett anrop som tog för lång tid prövas igen; idempotensnyckeln skyddar.
  const t = bygg([[rad()]], { skickaMejl: () => Promise.reject(new DOMException('tiden', 'TimeoutError')) });
  await korKon(t.b);
  assertEquals([t.spar.klar[0].ok, t.spar.klar[0].permanent, t.spar.klar[0].fel], [false, false, 'Resend svarade inte i tid.']);
});

Deno.test('varje mejl har en tidsgräns, så att ett hängande anrop inte håller raden längre än lånet', async () => {
  const { b, spar } = bygg([[rad()]]);
  await korKon(b);
  const ms = spar.mejl[0].tidsgransMs ?? 0;
  assert(ms > 0 && ms < 20_000, String(ms));
});

Deno.test('401 och 403 från Resend stoppar körningen: raden och omgångens mejl går tillbaka, SMS går ändå', async () => {
  for (const status of [401, 403]) {
    const sms = rad({ kanal: 'sms', typ: 'paminnelse', telefon: '+46701234567', data: { datum: '2026-09-23', tid: '16:00', timmar: 24 } });
    const forsta = rad();
    const tva = rad();
    const tre = rad();
    let forsok = 0;
    const { b, spar } = bygg([[forsta, sms, tva, tre], [rad(), rad()]], {
      skickaMejl: () => {
        forsok++;
        return Promise.resolve(new Response(JSON.stringify({ name: 'validation_error', message: 'The nextrum.se domain is not verified' }), { status }));
      },
    });
    const res = await korKon(b);

    assertEquals(forsok, 1, `${status}: bara ett mejl försöktes`);
    assertEquals(spar.tagna, 1, `${status}: ingen ny omgång`);
    assertEquals(spar.sms.length, 1, `${status}: SMS:et i omgången gick ändå`);
    assertEquals(res.mejlStoppat, true);
    assertEquals(res.fel, false);
    assertEquals([res.behandlade, res.misslyckade], [2, 1]);

    const k = new Map(spar.klar.map((x) => [x.id, x]));
    assertEquals(spar.klar.length, 4, `${status}: varje rad i omgången fick notis_utskick_klar`);
    assertEquals([k.get(forsta.id)?.ok, k.get(forsta.id)?.permanent, k.get(forsta.id)?.fel],
      [false, false, `Resend ${status}: validation_error`]);
    for (const r of [tva, tre]) {
      assertEquals([k.get(r.id)?.ok, k.get(r.id)?.permanent], [false, false]);
      assertStringIncludes(String(k.get(r.id)?.fel), 'Inte försökt');
    }
    assertEquals(k.get(sms.id)?.ok, true);

    assertEquals(spar.korningar.length, 1);
    const medd = String(spar.korningar[0].meddelande);
    assertStringIncludes(medd, `Resend ${status}: validation_error`);
    // Adminvyn visar de första 200 tecknen; skälet ska rymmas där.
    const synligt = medd.slice(0, 200);
    assert(synligt.startsWith(`Resend ${status}: validation_error.`), medd);
    assertStringIncludes(synligt, 'Körningen avbröts');
    assertStringIncludes(synligt, '2 mejl som inte försöktes');
    assert(!medd.includes('verified'), 'Resends meddelande i loggen');
  }
});

Deno.test('förvalet för tidsgränsen ryms i databasens 20 sekunder', () => {
  assert(TIDSGRANS_MS <= 15_000, String(TIDSGRANS_MS));
});

Deno.test('omgången blir aldrig större än vad som hinner gå före tidsgränsen', async () => {
  let klocka = NU.getTime();
  const { b, spar } = bygg([Array.from({ length: 5 }, () => rad()), Array.from({ length: 10 }, () => rad()), [rad()]], {
    perOmgang: 10,
    tidsgransMs: 15_000,
    nu: () => new Date(klocka),
    skickaMejl: () => { klocka += 2_000; return Promise.resolve(new Response('{"id":"x"}')); },
  });
  const res = await korKon(b);
  // Fem rader à två sekunder: tio sekunder gått, fem kvar, två rader hinner.
  // Sedan fjorton sekunder gått och ingen rad hinner.
  assertEquals(spar.maxar, [10, 2]);
  assertEquals(res.behandlade, 7);
  assertStringIncludes(String(res.meddelande), 'Tidsgränsen');
});

Deno.test('en ogiltig adress eller en typ som inte mejlas blir ett permanent fel utan utskick', async () => {
  const { b, spar } = bygg([[rad({ epost: 'inte en adress' }), rad({ typ: 'rapport' }), rad({ kanal: 'fax' })]]);
  const res = await korKon(b);
  assertEquals(spar.mejl.length, 0);
  assertEquals(res.misslyckade, 3);
  assert(spar.klar.every((k) => !k.ok && k.permanent));
});

Deno.test('SMS i provläget blir loggat, i skicka-läget skickat, och bara påminnelser går', async () => {
  const data = { datum: '2026-09-23', tid: '16:00', timmar: 24, elev: 'Alva', amne: 'Matematik' };
  const prov = rad({ kanal: 'sms', typ: 'paminnelse', telefon: '+46701234567', sms_lage: 'prov', data });
  const skarp = rad({ kanal: 'sms', typ: 'paminnelse', telefon: '+46701234568', sms_lage: 'skicka', data });
  const okant = rad({ kanal: 'sms', typ: 'paminnelse', telefon: '+46701234569', sms_lage: 'nagot', data });
  const fel = rad({ kanal: 'sms', typ: 'pass_nytt', telefon: '+46701234560' });
  const { b, spar } = bygg([[prov, skarp, okant, fel]]);
  const res = await korKon(b);

  assertEquals(spar.sms.map((s) => s.lage), ['prov', 'skicka', 'prov']);
  assertStringIncludes(spar.sms[0].text, 'i morgon kl. 16:00');
  assert(!spar.sms[0].text.includes('Alva') && !spar.sms[0].text.includes('Matematik'));

  const k = new Map(spar.klar.map((x) => [x.id, x]));
  assertEquals([k.get(prov.id)?.ok, k.get(prov.id)?.loggad], [true, true]);
  assertEquals([k.get(skarp.id)?.ok, k.get(skarp.id)?.loggad, k.get(skarp.id)?.leverantorId], [true, false, 'elk_1']);
  assertEquals([k.get(okant.id)?.ok, k.get(okant.id)?.loggad], [true, true]);
  assertEquals([k.get(fel.id)?.ok, k.get(fel.id)?.permanent], [false, true]);

  assertEquals([res.behandlade, res.skickade, res.misslyckade], [4, 1, 1]);
  assertStringIncludes(String(res.meddelande), '2 SMS i provläge');
  assertStringIncludes(String(res.meddelande), '1,04');
});

Deno.test('ett SMS-fel från klienten går vidare som det är', async () => {
  const r = rad({ kanal: 'sms', typ: 'paminnelse', telefon: '+46701234567', data: { datum: '2026-09-23', tid: '16:00', timmar: 24 } });
  const { b, spar } = bygg([[r]], {
    skickaSms: () => Promise.resolve({ ok: false, id: null, kostnad: null, permanent: true, fel: 'SMS-nyckel saknas' }),
  });
  await korKon(b);
  assertEquals(spar.klar[0], { id: r.id, ok: false, fel: 'SMS-nyckel saknas', leverantorId: null, permanent: true, loggad: false });
});

Deno.test('kön töms i omgångar tills den är tom, och körningen loggas en gång', async () => {
  const forsta = Array.from({ length: 3 }, () => rad());
  const andra = [rad()];
  const { b, spar } = bygg([forsta, andra], { perOmgang: 3 });
  const res = await korKon(b);
  assertEquals(spar.tagna, 3, 'två omgångar och en tom');
  assertEquals([res.behandlade, res.skickade], [4, 4]);
  assertEquals(spar.klar.length, 4);
  assertEquals(spar.korningar.length, 1);
});

Deno.test('efter tidsgränsen tas ingen ny omgång', async () => {
  let klocka = NU.getTime();
  const { b, spar } = bygg([[rad(), rad()], [rad()]], {
    perOmgang: 2,
    nu: () => new Date(klocka),
    skickaMejl: () => { klocka += 8_000; return Promise.resolve(new Response('{"id":"x"}')); },
  });
  const res = await korKon(b);
  assertEquals(spar.tagna, 1);
  assertEquals(res.behandlade, 2);
  assertStringIncludes(String(res.meddelande), 'Tidsgränsen');
});

Deno.test('går kön inte att läsa blir det fel, och körningen loggas ändå', async () => {
  const { b, spar } = bygg([], { ta: () => Promise.reject(new Error('permission denied')) });
  const res = await korKon(b);
  assertEquals(res.fel, true);
  assertEquals(spar.korningar.length, 1);
  assertEquals(spar.korningar[0].meddelande, 'Kön gick inte att läsa.');
  assert(!JSON.stringify(spar).includes('permission denied'), 'rått fel sparat');
});

Deno.test('går en rad inte att markera som klar fortsätter arbetaren och säger det', async () => {
  const { b } = bygg([[rad(), rad()]], { klar: () => Promise.reject(new Error('nere')) });
  const res = await korKon(b);
  assertEquals(res.behandlade, 2);
  assertStringIncludes(String(res.meddelande), '2 rader gick inte att markera som klara');
});

Deno.test('loggarna bär aldrig adress, nummer, namn eller ämne', async () => {
  const rader = [
    rad(),
    rad({ till_sandlada: true, epost: 'sandlada.hemlig@example.se' }),
    rad({ kanal: 'sms', typ: 'paminnelse', telefon: '+46709998877', data: { datum: '2026-09-23', tid: '16:00', timmar: 24 } }),
    rad({ epost: 'trasig' }),
  ];
  const { b, spar } = bygg([rader], {
    skickaMejl: () => Promise.resolve(new Response('{"name":"x","message":"anna.hemlig@example.se"}', { status: 422 })),
  });
  const res = await korKon(b);
  const allt = spar.loggar.join('\n') + String(res.meddelande) + JSON.stringify(spar.klar.map((k) => k.fel));
  for (const hemligt of ['hemlig', 'example.se', '4670999', 'Anna', 'Alva', 'Tove', 'Matematik']) {
    assert(!allt.includes(hemligt), hemligt);
  }
});
