// ============================================================
// NEXTRUM — tester för prisräkningen (Fas 5, ombyggda i Fas 14.2)
//
// Kör med:  deno test supabase/functions/_delad/
//
// Faktureringens räkning flyttade från fakturering/index.ts till
// pris.ts i Fas 5. Planens krav var att läxhjälpen inte ändras med ett
// öre. Därför jämförs den nya räkningen här med en ORDAGRANN kopia av
// den gamla (gammalUnderlag nedan, avskriven från fakturering/index.ts
// v20), på ett par hundra slumpade pass.
//
// Sedan Fas 14.2 får familjen ingen månadsfaktura. Studiehjälparens
// underlag jämförs fortfarande rad för rad med den gamla koden, och
// familjens halva — som nu är en lista över pass som hölls utan
// betalning — jämförs belopp för belopp med de fakturarader den gamla
// koden hade skrivit. Samma pass ska kosta samma sak, oavsett om det
// betalas med kort eller står på listan över obetalda.
// ============================================================

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  belopp, byggUnderlag, familjebelopp, type Pass, radtext, rutFor, sammanfatta,
  sorteraPass, standardTjanst, type Tjanst,
} from './pris.ts';
import { MANADER } from './konstanter.ts';

const KATALOG: Tjanst[] = [
  { kod: 'laxhjalp', aktiv: true, for_kund: true, ordning: 10, pris_per_timme_ore: 37900, extra_personer_ore: 6900,
    ersattning_per_timme_ore: null, rut_berattigad: false, rut_procent: 0 },
  { kod: 'barnvakt', aktiv: false, for_kund: true, ordning: 20, pris_per_timme_ore: null, extra_personer_ore: null,
    ersattning_per_timme_ore: null, rut_berattigad: false, rut_procent: 0 },
  { kod: 'forsaljning', aktiv: false, for_kund: false, ordning: 40, pris_per_timme_ore: null, extra_personer_ore: null,
    ersattning_per_timme_ore: null, rut_berattigad: false, rut_procent: 0 },
];

// ---------- den gamla räkningen, ordagrant ur fakturering v20 ----------
function gammalBelopp(minuter: number, timprisOre: number): number {
  return Math.round((minuter / 60) * timprisOre);
}
function gammalFamiljebelopp(minuter: number, timprisOre: number, extraOre: number, antalBarn: number): number {
  const tim = timprisOre + (antalBarn > 1 ? extraOre : 0);
  return Math.round((minuter / 60) * tim);
}
function gammalRadtext(subject: string | null, datum: string): string {
  const [, m, d] = datum.split('-');
  return `${subject || 'Pass'} ${Number(d)} ${MANADER[Number(m) - 1]}`;
}
function gammalUnderlag(pass: Pass[], tjanster: Tjanst[], timprisOre: number, timpenningar: Map<string, number>) {
  type TjanstPris = { timme: number; extra: number };
  const prisFor = new Map<string, TjanstPris>();
  for (const t of tjanster) {
    prisFor.set(t.kod, { timme: Number(t.pris_per_timme_ore ?? 0), extra: Number(t.extra_personer_ore ?? 0) });
  }
  const tjanstPris = (kod: string | null): TjanstPris =>
    prisFor.get(kod ?? 'laxhjalp') ?? { timme: timprisOre, extra: 0 };

  type Rad = { booking_id: string; beskrivning: string; minuter: number; belopp_ore: number; timpris_ore: number };
  const perFamilj = new Map<string, Rad[]>();
  const perTutor = new Map<string, Rad[]>();
  const utanTimpenning: string[] = [];

  for (const b of pass) {
    const minuter = Number(b.duration_min || 60);
    const text = gammalRadtext(b.subject, b.wanted_date);
    if (b.parent_id && !b.fakturerad) {
      const p = tjanstPris(b.tjanst);
      const barn = Math.max(1, Number(b.antal_barn || 1));
      const brutto = gammalFamiljebelopp(minuter, p.timme || timprisOre, p.extra, barn);
      const rabatt = Math.min(Math.max(Number(b.rabatt_ore || 0), 0), brutto);
      const lista = perFamilj.get(b.parent_id) ?? [];
      lista.push({
        booking_id: b.id,
        beskrivning: text + (barn > 1 ? ` (${barn} barn)` : '') + (rabatt > 0 ? ' − rabatt' : ''),
        minuter,
        belopp_ore: brutto - rabatt,
        timpris_ore: (p.timme || timprisOre) + (barn > 1 ? p.extra : 0),
      });
      perFamilj.set(b.parent_id, lista);
    }
    if (b.tutor_id && !b.pa_underlag) {
      const timpenning = timpenningar.get(b.tutor_id);
      if (!timpenning) { utanTimpenning.push(b.tutor_id); continue; }
      const lista = perTutor.get(b.tutor_id) ?? [];
      lista.push({ booking_id: b.id, beskrivning: text, minuter, belopp_ore: gammalBelopp(minuter, timpenning), timpris_ore: timpenning });
      perTutor.set(b.tutor_id, lista);
    }
  }
  return { perFamilj, perTutor, utanTimpenning };
}

// Deterministiska "slumptal", så att ett fel går att återskapa.
function lcg(frö: number) {
  let s = frö >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}
function välj<T>(r: () => number, lista: T[]): T { return lista[Math.floor(r() * lista.length)]; }

function slumpPass(antal: number, frö: number): Pass[] {
  const r = lcg(frö);
  const ut: Pass[] = [];
  for (let i = 0; i < antal; i++) {
    const dag = 1 + Math.floor(r() * 28);
    ut.push({
      id: `b${frö}-${i}`,
      subject: välj(r, ['Matematik', null, 'Svenska', '']),
      tjanst: välj(r, ['laxhjalp', 'laxhjalp', 'laxhjalp', null, 'barnvakt', 'okand']),
      wanted_date: `2026-${välj(r, ['01', '08', '09', '12'])}-${String(dag).padStart(2, '0')}`,
      duration_min: välj(r, [60, 60, 120, 180, 90, null, 0]),
      parent_id: välj(r, ['p1', 'p2', 'p3', null]),
      tutor_id: välj(r, ['t1', 't2', 't3', null]),
      antal_barn: välj(r, [1, 1, 2, 3, null, 0]),
      rabatt_ore: välj(r, [null, 0, 5000, 37900, 999999, -100]),
      fakturerbar: r() > 0.1,
      har_rapport: r() > 0.1,
      fakturerad: r() > 0.8,
      pa_underlag: r() > 0.8,
    });
  }
  return ut;
}

// ---------- grundräkningen ----------
Deno.test('belopp och familjebelopp räknar i hela ören', () => {
  assertEquals(belopp(60, 37900), 37900);
  assertEquals(belopp(90, 37900), 56850);
  assertEquals(familjebelopp(60, 37900, 6900, 1), 37900);
  assertEquals(familjebelopp(60, 37900, 6900, 2), 44800);
  assertEquals(familjebelopp(60, 37900, 6900, 3), 44800);   // fast tillägg, inte per barn
  assertEquals(familjebelopp(120, 37900, 6900, 2), 89600);
});

Deno.test('radtext som förut', () => {
  assertEquals(radtext('Matematik', '2026-08-19'), `Matematik 19 ${MANADER[7]}`);
  assertEquals(radtext(null, '2026-01-05'), `Pass 5 ${MANADER[0]}`);
});

Deno.test('standardtjänsten är den första aktiva för kunder, annars den första i katalogen', () => {
  assertEquals(standardTjanst(KATALOG)?.kod, 'laxhjalp');
  // Som standard_tjanst() i databasen: ingen aktiv, då den första.
  assertEquals(standardTjanst(KATALOG.filter((t) => t.kod !== 'laxhjalp'))?.kod, 'barnvakt');
  assertEquals(standardTjanst([]), null);
});

// ---------- driftens augustipass (2026-09-19) ----------
// Samma två pass som en SELECT-spegling av fakturering v20 gav för
// perioden 2026-08: 2 pass à 60 min, läxhjälp, ett barn, ingen rabatt,
// studiehjälparens timpenning 120 kr. Underlaget ska vara tecken för
// tecken detsamma som då. Fakturan på 758 kr finns inte längre — i
// stället står båda passen som obetalda, och tillsammans kostar de
// exakt vad fakturan hade kostat.
Deno.test('torrkörningen för augusti: underlaget som förut, och fakturan är en lista över obetalda pass', () => {
  const P = 'a3acb449-b4bd-44d9-af06-b2a8e63f957a', T = '74c44af8-1a47-4c6a-95ef-41a89ed72891';
  const grund = { subject: 'Matematik', tjanst: 'laxhjalp', duration_min: 60, parent_id: P, tutor_id: T,
    antal_barn: 1, rabatt_ore: null, fakturerbar: true, har_rapport: true, fakturerad: false, pa_underlag: false };
  const alla: Pass[] = [
    { id: 'x1', wanted_date: '2026-08-19', ...grund },
    { id: 'x2', wanted_date: '2026-08-26', ...grund },
  ];
  const { pass, utanRapport, undantagna } = sorteraPass(alla);
  const underlag = byggUnderlag({ pass, tjanster: KATALOG, timprisOre: 37900, timpenningar: new Map([[T, 12000]]) });
  const svar = { torrkorning: true, ...sammanfatta({
    korningAv: 'admin', period: '2026-08-01', slut: '2026-09-01', timprisOre: 37900, underlag, utanRapport, undantagna,
  }) };
  assertEquals(JSON.stringify(svar), JSON.stringify({
    torrkorning: true,
    korning_av: 'admin',
    period: '2026-08-01',
    pass_till_och_med: '2026-08-31',
    pris_per_timme_ore: 37900,
    utbetalningar: [{ tutor_id: T, pass: 2, belopp_ore: 24000 }],
    obetalda: [
      { booking_id: 'x1', parent_id: P, datum: '2026-08-19', lage: 'ingen', belopp_ore: 37900 },
      { booking_id: 'x2', parent_id: P, datum: '2026-08-26', lage: 'ingen', belopp_ore: 37900 },
    ],
    hoppade_over_utan_timpenning: [],
    hoppade_over_utan_rapport: [],
    undantagna_pass: 0,
  }));
  assertEquals(svar.obetalda.reduce((a, o) => a + o.belopp_ore, 0), 75800);
});

// ---------- ny räkning = gammal räkning ----------
Deno.test('underlaget är den gamla räkningen, och varje obetalt pass kostar sin gamla fakturarad (600 slumpade pass, tre frön)', () => {
  const timpenningar = new Map([['t1', 12000], ['t2', 15000]]);
  const perPass = (lista: [string, number][]) => [...lista].sort((a, b) => a[0].localeCompare(b[0]));
  for (const frö of [1, 42, 20260919]) {
    const { pass } = sorteraPass(slumpPass(200, frö));
    const gammal = gammalUnderlag(pass, KATALOG, 37900, timpenningar);
    const ny = byggUnderlag({ pass, tjanster: KATALOG, timprisOre: 37900, timpenningar });

    assertEquals([...ny.perTutor], [...gammal.perTutor]);
    assertEquals(ny.utanTimpenning, gammal.utanTimpenning);

    // De slumpade passen saknar betalning_status, alltså är inget av
    // dem betalt: listan ska ha precis de pass den gamla koden
    // fakturerade, med precis de beloppen.
    const gamlaRader = [...gammal.perFamilj.values()].flat()
      .map((r): [string, number] => [r.booking_id, r.belopp_ore]);
    const obetalda = ny.obetalda.map((o): [string, number] => [o.booking_id, o.belopp_ore]);
    assert(gamlaRader.length > 0);
    assertEquals(perPass(obetalda), perPass(gamlaRader));
  }
});

Deno.test('sammanfattningen har sina nycklar i fast ordning', () => {
  const { pass, utanRapport, undantagna } = sorteraPass(slumpPass(100, 7));
  const underlag = byggUnderlag({ pass, tjanster: KATALOG, timprisOre: 37900, timpenningar: new Map([['t1', 12000]]) });
  const s = sammanfatta({ korningAv: 'nyckel', period: '2026-09-01', slut: '2026-10-01', timprisOre: 37900, underlag, utanRapport, undantagna });
  assertEquals(Object.keys(s), [
    'korning_av', 'period', 'pass_till_och_med', 'pris_per_timme_ore', 'utbetalningar', 'obetalda',
    'hoppade_over_utan_timpenning', 'hoppade_over_utan_rapport', 'undantagna_pass',
  ]);
  assert(s.obetalda.length > 0);
  for (const o of s.obetalda) assertEquals(Object.keys(o), ['booking_id', 'parent_id', 'datum', 'lage', 'belopp_ore']);
});

// ---------- ersättningen ----------
Deno.test('tjänstens ersättning går före studiehjälparens egen, och tom ersättning ändrar inget', () => {
  const katalog: Tjanst[] = [{ ...KATALOG[0], ersattning_per_timme_ore: 11000 }];
  const pass: Pass[] = [
    { id: 'e1', subject: 'M', tjanst: 'laxhjalp', wanted_date: '2026-09-02', duration_min: 60, parent_id: 'p', tutor_id: 'medEgen',
      antal_barn: 1, rabatt_ore: null, fakturerbar: true, har_rapport: true, fakturerad: false, pa_underlag: false },
    { id: 'e2', subject: 'M', tjanst: 'laxhjalp', wanted_date: '2026-09-03', duration_min: 60, parent_id: 'p', tutor_id: 'utanEgen',
      antal_barn: 1, rabatt_ore: null, fakturerbar: true, har_rapport: true, fakturerad: false, pa_underlag: false },
  ];
  const u = byggUnderlag({ pass, tjanster: katalog, timprisOre: 37900, timpenningar: new Map([['medEgen', 12000]]) });
  assertEquals(u.perTutor.get('medEgen')?.[0].belopp_ore, 11000);
  assertEquals(u.perTutor.get('medEgen')?.[0].timpris_ore, 11000);
  assertEquals(u.perTutor.get('utanEgen')?.[0].belopp_ore, 11000);
  assertEquals(u.utanTimpenning, []);

  // Utan tjänstens ersättning: studiehjälparens egen, som förut.
  const utan = byggUnderlag({ pass, tjanster: KATALOG, timprisOre: 37900, timpenningar: new Map([['medEgen', 12000]]) });
  assertEquals(utan.perTutor.get('medEgen')?.[0].belopp_ore, 12000);
  assertEquals(utan.utanTimpenning, ['utanEgen']);
});

// ---------- RUT ----------
// rutFor används inte av något sedan Fas 14.2, men står kvar för den
// dag kortbetalningen ska dra avdraget. Se filhuvudet i pris.ts.
const RUTKATALOG: Tjanst[] = [
  ...KATALOG,
  { kod: 'hushallsnara', aktiv: true, for_kund: true, ordning: 30, pris_per_timme_ore: 50000, extra_personer_ore: null,
    ersattning_per_timme_ore: null, rut_berattigad: true, rut_procent: 50 },
];

Deno.test('rutFor: andelen, taket, hela kronor nedåt och noll för det som inte är berättigat', () => {
  assertEquals(rutFor(50000, RUTKATALOG[3], 1_000_000), 25000);
  assertEquals(rutFor(50001, RUTKATALOG[3], 1_000_000), 25000);   // aldrig mer än andelen
  assertEquals(rutFor(37901, RUTKATALOG[3], 1_000_000), 18900);   // hela kronor
  assertEquals(rutFor(50000, RUTKATALOG[3], 10050), 10000);       // taket, i hela kronor
  assertEquals(rutFor(50000, RUTKATALOG[3], 10000), 10000);
  assertEquals(rutFor(50000, RUTKATALOG[3], 0), 0);
  assertEquals(rutFor(50000, KATALOG[0], 1_000_000), 0);
  assertEquals(rutFor(50000, undefined, 1_000_000), 0);
});

// Körningen drar inget avdrag längre. Ett RUT-pass som ändå skulle
// hamna här (det kan det inte: skydda_tjansteaktivering nekar en sådan
// tjänst för kunder) står med hela sitt belopp — hellre för högt och
// synligt än ett avdrag ingen begärt från Skatteverket.
Deno.test('körningen drar ingen RUT, och en RUT-tjänst står med hela beloppet', () => {
  const u = byggUnderlag({
    pass: [{ id: 'r1', subject: 'Städ', tjanst: 'hushallsnara', wanted_date: '2026-09-10', duration_min: 60,
      parent_id: 'k', tutor_id: 't1', antal_barn: 1, rabatt_ore: null, fakturerbar: true, har_rapport: true,
      fakturerad: false, pa_underlag: false }],
    tjanster: RUTKATALOG, timprisOre: 37900, timpenningar: new Map([['t1', 12000]]),
  });
  assertEquals(u.obetalda.map((o) => o.belopp_ore), [50000]);
  assertEquals(u.perTutor.get('t1')!.map((r) => r.belopp_ore), [12000]);
});

// ---------- Fas 14.2: familjen betalar med kort, före passet ----------
//
// Månadsfakturan till familjen finns inte längre. Det som är kvar av
// familjens halva är en fråga: hölls det här passet utan att någon
// betalade för det? Svaret ska vara exakt — ett betalt pass på listan
// är en påminnelse till en familj som redan betalat, och ett obetalt
// pass som saknas är pengar ingen frågar efter.
const P = 'p1', T = 't1';
const GRUND = {
  subject: 'Matematik', tjanst: 'laxhjalp', duration_min: 60, parent_id: P, tutor_id: T,
  antal_barn: 1, rabatt_ore: null, fakturerbar: true, har_rapport: true,
  fakturerad: false, pa_underlag: false,
};

Deno.test('bara pass familjen inte betalat är obetalda, och underlaget rörs inte', () => {
  const pass: Pass[] = [
    { ...GRUND, id: 'b-betald', wanted_date: '2026-08-03', betalning_status: 'betald' },
    { ...GRUND, id: 'b-vantar', wanted_date: '2026-08-04', betalning_status: 'vantar' },
    { ...GRUND, id: 'b-ater', wanted_date: '2026-08-05', betalning_status: 'aterbetald' },
    { ...GRUND, id: 'b-tvist', wanted_date: '2026-08-06', betalning_status: 'tvist' },
    { ...GRUND, id: 'b-ingen', wanted_date: '2026-08-07', betalning_status: 'ingen' },
    { ...GRUND, id: 'b-misslyckad', wanted_date: '2026-08-10', betalning_status: 'misslyckad' },
    // Utan kolumnen alls: en anropare som inte hämtar den ska få passet
    // räknat som obetalt, inte som betalt.
    { ...GRUND, id: 'b-utan', wanted_date: '2026-08-11' },
  ];

  const u = byggUnderlag({ pass, tjanster: KATALOG, timprisOre: 37900, timpenningar: new Map([[T, 12000]]) });

  assertEquals(u.obetalda.map((o) => o.booking_id), ['b-vantar', 'b-ingen', 'b-misslyckad', 'b-utan']);
  assertEquals(u.obetalda.map((o) => o.lage), ['vantar', 'ingen', 'misslyckad', 'ingen']);
  assertEquals(u.obetalda.map((o) => o.belopp_ore), [37900, 37900, 37900, 37900]);

  // STUDIEHJÄLPARENS UNDERLAG RÖRS INTE. Hen har hållit alla sju
  // passen och får betalt för alla sju den 25:e, oavsett hur familjen
  // betalade. Att ett obetalt pass inte ska hållas alls är spärrens
  // sak (kortsparr i databasen), inte den här räkningens.
  assertEquals((u.perTutor.get(T) ?? []).length, 7);
});

Deno.test('ett pass på en äldre faktura är inte obetalt, men kommer med på underlaget', () => {
  const u = byggUnderlag({
    pass: [{ ...GRUND, id: 'b-fakt', wanted_date: '2026-08-03', fakturerad: true, betalning_status: 'ingen' }],
    tjanster: KATALOG, timprisOre: 37900, timpenningar: new Map([[T, 12000]]),
  });
  assertEquals(u.obetalda, []);
  assertEquals((u.perTutor.get(T) ?? []).map((r) => r.booking_id), ['b-fakt']);
});

Deno.test('obetalda räknas som kortbetalningen: tillägg för syskon och fryst rabatt', () => {
  const u = byggUnderlag({
    pass: [
      { ...GRUND, id: 'b-syskon', wanted_date: '2026-08-03', duration_min: 120, antal_barn: 3 },
      { ...GRUND, id: 'b-rabatt', wanted_date: '2026-08-04', rabatt_ore: 5000 },
      { ...GRUND, id: 'b-gratis', wanted_date: '2026-08-05', rabatt_ore: 999999 },
    ],
    tjanster: KATALOG, timprisOre: 37900, timpenningar: new Map([[T, 12000]]),
  });
  // Två timmar à 379 + 69 (fast, inte per barn), 379 − 50, och en
  // rabatt större än passet blir noll — aldrig negativt.
  assertEquals(u.obetalda.map((o) => o.belopp_ore), [89600, 32900, 0]);
  // Ersättningen påverkas varken av syskonen eller av rabatten.
  assertEquals(u.perTutor.get(T)!.map((r) => r.belopp_ore), [24000, 12000, 12000]);
});

Deno.test('obetalda står alltid i svaret, också när allt är betalt', () => {
  const args = {
    korningAv: 'admin' as const, period: '2026-08', slut: '2026-09-01',
    timprisOre: 37900, utanRapport: [], undantagna: [],
  };
  const betald = sammanfatta({
    ...args,
    underlag: byggUnderlag({
      pass: [{ ...GRUND, id: 'b1', wanted_date: '2026-08-03', betalning_status: 'betald' }],
      tjanster: KATALOG, timprisOre: 37900, timpenningar: new Map([[T, 12000]]),
    }),
  });
  assertEquals(betald.obetalda, []);
  assertEquals(betald.utbetalningar.length, 1);

  const obetald = sammanfatta({
    ...args,
    underlag: byggUnderlag({
      pass: [{ ...GRUND, id: 'b1', wanted_date: '2026-08-03' }],
      tjanster: KATALOG, timprisOre: 37900, timpenningar: new Map([[T, 12000]]),
    }),
  });
  assertEquals(obetald.obetalda, [{ booking_id: 'b1', parent_id: P, datum: '2026-08-03', lage: 'ingen', belopp_ore: 37900 }]);
});
