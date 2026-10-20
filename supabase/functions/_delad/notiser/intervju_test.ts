// ============================================================
// NEXTRUM — prov: mejlet till den som går vidare till intervju
//
// Kör med:  deno test supabase/functions/_delad/
//
// Texten är Leos (2026-10-21, och bokningslänken 2026-10-20). Proven
// håller den: ämnet, hälsningen med förnamnet, styckena med länken till
// bokningssidan och signaturen, och att inget läggs till: ingen knapp
// och ingen avregistrering.
// ============================================================

import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { INTERVJU, renderaIntervjuMejl } from './intervju.ts';

const LEOS_TEXT = 'Hej Sara!\n\n'
  + 'Tack för din ansökan till Nextrum. Vi har läst den och du går vidare till intervjufasen.\n\n'
  + 'Boka en tid för intervjun som passar dig här:\n'
  + 'https://calendar.app.google/rRiTTLP5ymKQunSv7\n\n'
  + 'Intervjun hålls i Google Meet, och länken till mötet kommer i bekräftelsen när du har bokat. '
  + 'Du behöver inget Google-konto. Passar ingen av tiderna får du gärna mejla oss på info@nextrum.se.\n\n'
  + 'Hälsningar\nLeo och Alex, Nextrum\n';

Deno.test('ämnet och texten är Leos, med bokningslänken', () => {
  const m = renderaIntervjuMejl({ fornamn: 'Sara', prov: 'nej' });
  assertEquals(m.amne, 'Du går vidare till intervju');
  assertEquals(m.text, LEOS_TEXT);
});

Deno.test('hälsningen tar bara förnamnet, och "Hej!" utan ett', () => {
  assertStringIncludes(renderaIntervjuMejl({ fornamn: 'Sara Lind Ek', prov: 'nej' }).text, 'Hej Sara!\n');
  assert(renderaIntervjuMejl({ fornamn: null, prov: 'nej' }).text.startsWith('Hej!\n'));
});

Deno.test('html-versionen har samma stycken, bokningssidan och adressen som länkar, och ingen knapp eller avregistrering', () => {
  const h = renderaIntervjuMejl({ fornamn: 'Sara', prov: 'nej' }).html;
  assertStringIncludes(h, 'Hej Sara!');
  assertStringIncludes(h, INTERVJU.forsta);
  assertStringIncludes(h, 'Boka en tid för intervjun som passar dig här:<br><a href="https://calendar.app.google/rRiTTLP5ymKQunSv7"');
  assertStringIncludes(h, 'href="mailto:info@nextrum.se"');
  assertStringIncludes(h, 'Hälsningar<br>Leo och Alex, Nextrum');
  assert(!/Sluta få mejl|Ändra dina val|notis-avanmal/.test(h));
});

Deno.test('ett namn med html blir text', () => {
  const h = renderaIntervjuMejl({ fornamn: '<b>Sara</b>', prov: 'nej' }).html;
  assert(!h.includes('<b>Sara</b>'));
});

Deno.test('i sandlådan säger ämnet och första raden att det är ett prov', () => {
  const m = renderaIntervjuMejl({ fornamn: 'Sara', prov: 'sandlada' });
  assertEquals(m.amne, '[Prov till sökande] Du går vidare till intervju');
  assert(m.text.startsWith('Det här är ett prov'));
  assertStringIncludes(m.text, 'Hej Sara!');
});
