// ============================================================
// NEXTRUM — prov: mejlen till ett barn (barnets_epost)
//
// Kör med:  deno test supabase/functions/_delad/
//
// Det som provas är det som inte får hända i ett mejl till ett barn:
// ett pris, en betalning, ett skäl skrivet till föräldern, en knapp till
// förälderns vy, och i bekräftelsen ett namn till någon som kanske inte
// är barnet alls.
// ============================================================

import { assertEquals, assertStringIncludes, assertThrows } from 'jsr:@std/assert@1';
import { BARN_VY, renderaBarnMejl } from './barn.ts';

const KOD = '6ba7b810-9dad-11d1-80b4-00c04fd430c8.' + 'A'.repeat(43);
const TOKEN = 'barn.6ba7b810-9dad-11d1-80b4-00c04fd430c8.mejl.barn_pass_bokat.' + 'B'.repeat(43);
const NU = new Date('2026-10-13T08:00:00Z');

const PASS = {
  datum: '2026-10-14', tid: '16:00', amne: 'Matematik', studiehjalpare: 'Tove Lind',
  // Inget av det här får synas.
  betalsatt: 'faktura', skal: 'familjen_avslutar', elev: 'Alva Berg', kvar: 3,
  note: 'Ring mamma på 070-123 45 67',
};

Deno.test('ett bokat pass: tid, ämne och studiehjälpare, knappen till barnets vy', () => {
  const m = renderaBarnMejl({ typ: 'barn_pass_bokat', fornamn: 'Alva Berg', data: PASS, token: TOKEN, prov: 'nej', nu: NU });
  assertEquals(m.amne, 'Ditt pass är bokat: onsdag 14 oktober kl. 16:00');
  assertStringIncludes(m.text, 'Hej Alva!');
  assertStringIncludes(m.text, 'Ämne: Matematik');
  assertStringIncludes(m.text, 'Studiehjälpare: Tove');
  assertStringIncludes(m.text, `Öppna din vy:\n${BARN_VY}\n`);
  assertStringIncludes(m.text, `${BARN_VY}#installningar`);
  assertStringIncludes(m.text, '/avanmal?t=');
  assertStringIncludes(m.text, 'din förälder har slagit på mejl till dig');
});

Deno.test('inget om betalning, skäl, efternamn eller annat ur raden', () => {
  for (const typ of ['barn_pass_bokat', 'barn_pass_avbokat', 'barn_paminnelse']) {
    const m = renderaBarnMejl({ typ, fornamn: 'Alva Berg', data: { ...PASS, timmar: 24 }, token: TOKEN, prov: 'nej', nu: NU });
    const allt = m.amne + m.text + m.html;
    for (const fel of ['betala', 'Betala', 'faktura', 'Faktura', ' kr', 'kronor', '379', 'timmar ni', 'avslutar', 'Skäl',
                       'Berg', 'Lind', '070', 'Ring mamma', '/foralder', '/larare']) {
      assertEquals(allt.includes(fel), false, `${typ}: "${fel}" fanns i mejlet`);
    }
  }
});

Deno.test('ett avbokat pass och en påminnelse', () => {
  const av = renderaBarnMejl({ typ: 'barn_pass_avbokat', fornamn: 'Alva', data: PASS, token: TOKEN, prov: 'nej', nu: NU });
  assertEquals(av.amne, 'Passet onsdag 14 oktober kl. 16:00 är avbokat');
  assertStringIncludes(av.text, 'fråga din förälder');

  const p = renderaBarnMejl({ typ: 'barn_paminnelse', fornamn: 'Alva', data: { ...PASS, timmar: 24 }, token: TOKEN, prov: 'nej', nu: NU });
  assertEquals(p.amne, 'Påminnelse: pass i morgon kl. 16:00');
});

Deno.test('bekräftelsen: ingen hälsning med namn, knappen bär koden, ingen avanmälan', () => {
  const m = renderaBarnMejl({ typ: 'barn_bekrafta_epost', fornamn: 'Alva', data: { kod: KOD, elev: 'Alva' },
                              token: null, prov: 'nej', nu: NU });
  assertEquals(m.amne, 'Bekräfta din e-post hos Nextrum');
  assertStringIncludes(m.text, 'Hej!');
  assertEquals((m.amne + m.text + m.html).includes('Alva'), false);
  assertStringIncludes(m.text, `${BARN_VY}?bekrafta=${encodeURIComponent(KOD)}`);
  assertEquals(m.text.includes('/avanmal'), false);
  assertEquals(m.text.includes('Ändra dina val'), false);
  assertStringIncludes(m.text, 'strunta i mejlet');
});

Deno.test('bekräftelsen utan giltig kod skickas inte', () => {
  for (const data of [{}, { kod: 'skräp' }, { kod: KOD + '"><a href=x>' }]) {
    assertThrows(() => renderaBarnMejl({ typ: 'barn_bekrafta_epost', fornamn: null, data, token: null, prov: 'nej', nu: NU }));
  }
});

Deno.test('i sandlådan pekar avanmälan inte på barnet', () => {
  const m = renderaBarnMejl({ typ: 'barn_pass_bokat', fornamn: 'Alva', data: PASS, token: TOKEN, prov: 'sandlada', nu: NU });
  assertStringIncludes(m.amne, '[Prov till barn]');
  assertEquals(m.text.includes(encodeURIComponent(TOKEN)), false);
  assertStringIncludes(m.text, 'Länken för att sluta få mejl är avstängd i provet.');
});

Deno.test('en vuxens sort har ingen mall för barn', () => {
  for (const typ of ['pass_nytt', 'meddelande', 'rapport', 'timmar_gar_ut', '']) {
    assertThrows(() => renderaBarnMejl({ typ, fornamn: 'Alva', data: PASS, token: TOKEN, prov: 'nej', nu: NU }));
  }
});

Deno.test('ett namn som ser ut som en länk blir bara bokstäver', () => {
  const m = renderaBarnMejl({ typ: 'barn_pass_bokat', fornamn: 'alva@evil.com <b>', data: { ...PASS, studiehjalpare: 'x.se' },
                              token: TOKEN, prov: 'nej', nu: NU });
  assertStringIncludes(m.text, 'Hej alvaevilcom!');
  assertEquals(m.html.includes('evil.com'), false);
  assertEquals(m.html.includes('<b>'), false);
});
