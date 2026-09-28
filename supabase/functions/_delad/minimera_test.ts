import { assertEquals } from 'jsr:@std/assert@1';
import { fornamn, maskera } from './minimera.ts';

Deno.test('fornamn: bara första ordet går till AI-leverantören', () => {
  assertEquals(fornamn('Alva Berg Lindqvist'), 'Alva');
  assertEquals(fornamn('  Elsa  '), 'Elsa');
  assertEquals(fornamn(''), null);
});

Deno.test('maskera: personnummer, telefon och e-post försvinner', () => {
  assertEquals(maskera('Alvas personnummer 20100101-1234 stod i CV:t'), 'Alvas personnummer [nummer] stod i CV:t');
  assertEquals(maskera('ring 070-123 45 67'), 'ring [nummer]');
  assertEquals(maskera('+46 70 123 45 67'), '+[nummer]');
  assertEquals(maskera('mejla anna@example.com'), 'mejla [e-post]');
});

Deno.test('maskera: datum, årtal och vanliga tal står kvar', () => {
  assertEquals(maskera('provet 2026-09-20'), 'provet 2026-09-20');
  assertEquals(maskera('år 2026, sida 42, 3 av 5 rätt'), 'år 2026, sida 42, 3 av 5 rätt');
  assertEquals(maskera(null), '');
});
