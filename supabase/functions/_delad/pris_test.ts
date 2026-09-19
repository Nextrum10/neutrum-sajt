// ============================================================
// NEXTRUM — tester för prisräkningen (Fas 5)
//
// Kör med:  deno test supabase/functions/_delad/
//
// Faktureringens räkning flyttade från fakturering/index.ts till
// pris.ts i Fas 5, och fick RUT. Planens krav är att läxhjälpen inte
// ändras med ett öre. Därför jämförs den nya räkningen här med en
// ORDAGRANN kopia av den gamla (gammalUnderlag nedan, avskriven från
// fakturering/index.ts v20), på ett par hundra slumpade pass, och
// torrkörningens svar för driftens riktiga augustipass jämförs tecken
// för tecken med vad den gamla funktionen svarade.
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

Deno.test('standardtjänsten är den första aktiva för kunder', () => {
  assertEquals(standardTjanst(KATALOG)?.kod, 'laxhjalp');
  assertEquals(standardTjanst(KATALOG.filter((t) => t.kod !== 'laxhjalp')), null);
});

// ---------- driftens augustipass (2026-09-19) ----------
// Samma två pass som en SELECT-spegling av fakturering v20 gav för
// perioden 2026-08: 2 pass à 60 min, läxhjälp, ett barn, ingen rabatt,
// studiehjälparens timpenning 120 kr.
Deno.test('torrkörningen för augusti är tecken för tecken densamma', () => {
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
    fakturor: [{ parent_id: P, pass: 2, belopp_ore: 75800 }],
    utbetalningar: [{ tutor_id: T, pass: 2, belopp_ore: 24000 }],
    hoppade_over_utan_timpenning: [],
    hoppade_over_utan_rapport: [],
    undantagna_pass: 0,
  }));
});

// ---------- ny räkning = gammal räkning, för allt som inte är RUT ----------
Deno.test('ny räkning ger exakt samma rader som den gamla (600 slumpade pass, tre frön)', () => {
  const timpenningar = new Map([['t1', 12000], ['t2', 15000]]);
  for (const frö of [1, 42, 20260919]) {
    const { pass } = sorteraPass(slumpPass(200, frö));
    const gammal = gammalUnderlag(pass, KATALOG, 37900, timpenningar);
    const ny = byggUnderlag({ pass, tjanster: KATALOG, timprisOre: 37900, timpenningar });

    const utanRut = (m: Map<string, { rut_ore: number }[]>) =>
      [...m].map(([k, rader]) => [k, rader.map((r) => { assertEquals(r.rut_ore, 0); const { rut_ore: _, ...rest } = r; return rest; })]);
    assertEquals(utanRut(ny.perFamilj), [...gammal.perFamilj]);
    assertEquals(utanRut(ny.perTutor), [...gammal.perTutor]);
    assertEquals(ny.utanTimpenning, gammal.utanTimpenning);
    assertEquals(ny.rutUtanSkatteuppgifter, []);
    assertEquals(ny.rutUtanTak, false);
  }
});

Deno.test('sammanfattningen har samma nycklar i samma ordning utan RUT', () => {
  const { pass, utanRapport, undantagna } = sorteraPass(slumpPass(100, 7));
  const underlag = byggUnderlag({ pass, tjanster: KATALOG, timprisOre: 37900, timpenningar: new Map([['t1', 12000]]) });
  const s = sammanfatta({ korningAv: 'nyckel', period: '2026-09-01', slut: '2026-10-01', timprisOre: 37900, underlag, utanRapport, undantagna });
  assertEquals(Object.keys(s), [
    'korning_av', 'period', 'pass_till_och_med', 'pris_per_timme_ore', 'fakturor', 'utbetalningar',
    'hoppade_over_utan_timpenning', 'hoppade_over_utan_rapport', 'undantagna_pass',
  ]);
  for (const f of s.fakturor as Record<string, unknown>[]) assertEquals(Object.keys(f), ['parent_id', 'pass', 'belopp_ore']);
});

// ---------- ersättningen ----------
Deno.test('tjänstens ersättning gäller bara när studiehjälparen saknar egen', () => {
  const katalog: Tjanst[] = [{ ...KATALOG[0], ersattning_per_timme_ore: 11000 }];
  const pass: Pass[] = [
    { id: 'e1', subject: 'M', tjanst: 'laxhjalp', wanted_date: '2026-09-02', duration_min: 60, parent_id: 'p', tutor_id: 'medEgen',
      antal_barn: 1, rabatt_ore: null, fakturerbar: true, har_rapport: true, fakturerad: false, pa_underlag: false },
    { id: 'e2', subject: 'M', tjanst: 'laxhjalp', wanted_date: '2026-09-03', duration_min: 60, parent_id: 'p', tutor_id: 'utanEgen',
      antal_barn: 1, rabatt_ore: null, fakturerbar: true, har_rapport: true, fakturerad: false, pa_underlag: false },
  ];
  const u = byggUnderlag({ pass, tjanster: katalog, timprisOre: 37900, timpenningar: new Map([['medEgen', 12000]]) });
  assertEquals(u.perTutor.get('medEgen')?.[0].belopp_ore, 12000);
  assertEquals(u.perTutor.get('utanEgen')?.[0].belopp_ore, 11000);
  assertEquals(u.utanTimpenning, []);
});

// ---------- RUT ----------
const RUTKATALOG: Tjanst[] = [
  ...KATALOG,
  { kod: 'hushallsnara', aktiv: true, for_kund: true, ordning: 30, pris_per_timme_ore: 50000, extra_personer_ore: null,
    ersattning_per_timme_ore: null, rut_berattigad: true, rut_procent: 50 },
];
function rutPass(id: string, parent: string, tjanst = 'hushallsnara', minuter = 60): Pass {
  return { id, subject: 'Städ', tjanst, wanted_date: '2026-09-10', duration_min: minuter, parent_id: parent, tutor_id: 't1',
    antal_barn: 1, rabatt_ore: null, fakturerbar: true, har_rapport: true, fakturerad: false, pa_underlag: false };
}

Deno.test('rutFor: andelen, taket och noll för det som inte är berättigat', () => {
  assertEquals(rutFor(50000, RUTKATALOG[3], 1_000_000), 25000);
  assertEquals(rutFor(50000, RUTKATALOG[3], 10000), 10000);
  assertEquals(rutFor(50000, RUTKATALOG[3], 0), 0);
  assertEquals(rutFor(50000, KATALOG[0], 1_000_000), 0);
  assertEquals(rutFor(50000, undefined, 1_000_000), 0);
});

Deno.test('RUT dras av, och taket räknas ned över kundens rader', () => {
  const u = byggUnderlag({
    pass: [rutPass('r1', 'k'), rutPass('r2', 'k'), rutPass('r3', 'k', 'laxhjalp')],
    tjanster: RUTKATALOG, timprisOre: 37900, timpenningar: new Map([['t1', 12000]]),
    rut: { medSkatteuppgifter: new Set(['k']), takOre: 100000, anvantOre: new Map([['k', 70000]]) },
  });
  const rader = u.perFamilj.get('k')!;
  // 30000 kvar av taket: första raden får 25000, andra 5000, läxhjälpen 0.
  assertEquals(rader.map((r) => r.rut_ore), [25000, 5000, 0]);
  assertEquals(rader.map((r) => r.belopp_ore), [25000, 45000, 37900]);
  assert(rader[0].beskrivning.endsWith(' − RUT'));
  assert(!rader[2].beskrivning.includes('RUT'));
  // Ersättningen påverkas inte av avdraget.
  assertEquals(u.perTutor.get('t1')!.map((r) => r.belopp_ore), [12000, 12000, 12000]);
});

Deno.test('ingen RUT utan skatteuppgifter eller utan tak — och det sägs', () => {
  const utanUppgifter = byggUnderlag({
    pass: [rutPass('u1', 'k')], tjanster: RUTKATALOG, timprisOre: 37900, timpenningar: new Map(),
    rut: { medSkatteuppgifter: new Set(), takOre: 100000, anvantOre: new Map() },
  });
  assertEquals(utanUppgifter.perFamilj.get('k')![0].rut_ore, 0);
  assertEquals(utanUppgifter.perFamilj.get('k')![0].belopp_ore, 50000);
  assertEquals(utanUppgifter.rutUtanSkatteuppgifter, ['k']);

  const utanTak = byggUnderlag({
    pass: [rutPass('u2', 'k')], tjanster: RUTKATALOG, timprisOre: 37900, timpenningar: new Map(),
    rut: { medSkatteuppgifter: new Set(['k']), takOre: null, anvantOre: new Map() },
  });
  assertEquals(utanTak.perFamilj.get('k')![0].rut_ore, 0);
  assertEquals(utanTak.rutUtanTak, true);

  const s = sammanfatta({ korningAv: 'admin', period: '2026-09-01', slut: '2026-10-01', timprisOre: 37900,
    underlag: utanTak, utanRapport: [], undantagna: [] });
  assertEquals(s.rut_utan_tak, 2026);
});

Deno.test('sammanfattningen visar RUT per faktura när det finns', () => {
  const u = byggUnderlag({
    pass: [rutPass('s1', 'k')], tjanster: RUTKATALOG, timprisOre: 37900, timpenningar: new Map(),
    rut: { medSkatteuppgifter: new Set(['k']), takOre: 100000, anvantOre: new Map() },
  });
  const s = sammanfatta({ korningAv: 'admin', period: '2026-09-01', slut: '2026-10-01', timprisOre: 37900,
    underlag: u, utanRapport: [], undantagna: [] });
  assertEquals(s.fakturor, [{ parent_id: 'k', pass: 1, belopp_ore: 25000, rut_ore: 25000 }]);
});
