import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  byggUnderlag, dagarSedan, forraManaden, giltigManad, manadenFore, manadsnamn, rubrik, svarstext,
} from './manadsrapport.ts';

Deno.test('förra månaden räknas i Stockholm, också över nyår och vid midnatt', () => {
  assertEquals(forraManaden(new Date('2026-11-01T06:13:00Z')), '2026-10-01');
  assertEquals(forraManaden(new Date('2027-01-01T06:13:00Z')), '2026-12-01');
  // 23.30 UTC den 31 oktober är redan 1 november i Stockholm.
  assertEquals(forraManaden(new Date('2026-10-31T23:30:00Z')), '2026-10-01');
  assertEquals(manadenFore('2026-01-01'), '2025-12-01');
});

Deno.test('namnet och rubriken', () => {
  assertEquals(manadsnamn('2026-10-01'), 'oktober 2026');
  assertEquals(rubrik('2026-10-01'), 'Månadsrapport för oktober 2026');
  assertEquals(giltigManad('2026-10-01'), '2026-10-01');
  assertEquals(giltigManad('2026-13-01'), null);
  assertEquals(giltigManad('2026-10-02'), null);
  assertEquals(dagarSedan('2026-10-01', new Date('2026-11-01T06:00:00Z')), 32);
});

Deno.test('underlaget har summor, aldrig id:n, initialer eller fritext', () => {
  const u = byggUnderlag('2026-10-01', {
    analys: [
      { manad: '2026-10-01', genomforda_pass: 4, minuter: 270, betalt_ore: 151600, utbetalt_ore: 0 },
      { manad: '2026-09-01', genomforda_pass: 1, minuter: 60 },
    ],
    avvikelser: [
      { typ: 'ej_betalt', belopp_ore: 39900, kund_id: 'x', objekt_id: 'y' },
      { typ: 'ej_betalt', belopp_ore: 39900, kund_id: 'z', objekt_id: 'w' },
    ],
    omatchade: [{ id: 'a', initialer: 'E.S', dagar_utan_match: 12 }, { id: 'b', initialer: 'L.T', dagar_utan_match: 3 }],
    saknadeRapporter: [{ id: 'p', har_uppgift: true }, { id: 'q', har_uppgift: false }],
    nyaLeads: [
      { id: 'l1', skapad: '2026-10-03', status: 'new', meddelande: 'Elsa behöver hjälp' },
      { id: 'l2', skapad: '2026-09-28', status: 'new', meddelande: 'annan månad' },
    ],
    kommandePass: [{ id: 'k' }],
  });
  const text = JSON.stringify(u);
  for (const forbjudet of ['E.S', 'L.T', 'Elsa', '"id"', 'kund_id', 'objekt_id']) {
    assertEquals(text.includes(forbjudet), false, forbjudet);
  }
  // deno-lint-ignore no-explicit-any
  const okt = (u.siffror as any)['oktober 2026'];
  assertEquals(okt.genomforda_pass, 4);
  assertEquals(okt.timmar, 4.5);
  assertEquals(okt.betalt_kr, 1516);
  assertEquals(u.avvikelser_nu, [{ typ: 'ej_betalt', antal: 2, belopp_kr: 798 }]);
  assertEquals(u.vantar_nu.elever_utan_studiehjalpare, 2);
  assertEquals(u.vantar_nu.langst_vantat_dagar, 12);
  assertEquals(u.vantar_nu.varav_utan_uppgift_till_oss, 1);
  assertEquals(u.anmalningar_i_manaden_per_lage, { new: 1 });
});

Deno.test('en månad utan rader är null, inte nollor', () => {
  const u = byggUnderlag('2026-10-01', {
    analys: [], avvikelser: [], omatchade: [], saknadeRapporter: [], nyaLeads: [], kommandePass: [],
  });
  // deno-lint-ignore no-explicit-any
  assertEquals((u.siffror as any)['oktober 2026'], null);
});

Deno.test('ett avhugget eller tomt svar är inget svar', () => {
  assertEquals(svarstext({ stop_reason: 'end_turn', content: [{ type: 'thinking' }, { type: 'text', text: ' ok ' }] }), 'ok');
  assertEquals(svarstext({ stop_reason: 'max_tokens', content: [{ type: 'text', text: 'halv' }] }), null);
  assertEquals(svarstext({ stop_reason: 'end_turn', content: [] }), null);
});
