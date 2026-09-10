// ============================================================
// NEXTRUM — tester för agentmotorn
//
// Kör med:  deno test supabase/functions/_delad/agent_test.ts
//
// Bara de tre funktioner som ÄR spärrarna testas här. Resten av
// motorn pratar med Anthropic och Supabase och går inte att testa
// utan att ringa någon. De här tre gör det, och de är också de enda
// där ett fel är tyst: en trasig domänspärr syns inte i ett svar,
// den syns i att agenten hämtat något den inte skulle.
//
// Fallen med värdnamn i sökväg och värdnamn som användardel
// (https://riksdagen.se@evil.com/) är inte teoretiska. Det är så en
// naiv kontroll med indexOf går sönder, och därför de står kvar.
// ============================================================

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { tillatenVard, tillText, granskaKallor } from './agent.ts';

const KALLOR = ['riksdagen.se', 'lagrummet.se', 'eur-lex.europa.eu'];

Deno.test('domänspärren släpper igenom rätt värdar', () => {
  assertEquals(tillatenVard('https://riksdagen.se/dokument', KALLOR), true);
  assertEquals(tillatenVard('https://data.riksdagen.se/dokumentlista', KALLOR), true);
  assertEquals(tillatenVard('https://RIKSDAGEN.SE/dokument', KALLOR), true);
  assertEquals(tillatenVard('https://eur-lex.europa.eu/eli/reg/2016/679', KALLOR), true);
});

Deno.test('domänspärren stoppar allt annat', () => {
  assertEquals(tillatenVard('https://example.com/', KALLOR), false);
  assertEquals(tillatenVard('http://riksdagen.se/', KALLOR), false, 'bara https');
  assertEquals(tillatenVard('https://evilriksdagen.se/', KALLOR), false, 'suffix är inte subdomän');
  assertEquals(tillatenVard('https://evil.com/riksdagen.se', KALLOR), false, 'värd i sökväg');
  assertEquals(tillatenVard('https://riksdagen.se@evil.com/', KALLOR), false, 'värd som användardel');
  assertEquals(tillatenVard('inte en url', KALLOR), false);
});

Deno.test('html blir läsbar text', () => {
  assertEquals(tillText('<p>Hej <b>du</b></p><script>ful()</script>'), 'Hej du');
  assertEquals(tillText('<p>1 &sect; 2 &amp; 3</p>'), '1 § 2 & 3');
});

Deno.test('källkontrollen behåller bara hämtade adresser', () => {
  const hamtade = new Set(['https://riksdagen.se/sfs-2005-59']);

  assertEquals(
    granskaKallor('Se https://riksdagen.se/sfs-2005-59 .', hamtade),
    { kallor: ['https://riksdagen.se/sfs-2005-59'], pahittade: [] },
  );

  assertEquals(
    granskaKallor('Se https://riksdagen.se/hittepa-1999-1 .', hamtade),
    { kallor: [], pahittade: ['https://riksdagen.se/hittepa-1999-1'] },
    'en adress som aldrig hämtades är påhittad även om värden är tillåten',
  );

  assertEquals(
    granskaKallor('KÄLLOR\nhttps://riksdagen.se/sfs-2005-59.', hamtade),
    { kallor: ['https://riksdagen.se/sfs-2005-59'], pahittade: [] },
    'punkt i slutet av meningen hör inte till adressen',
  );

  assertEquals(
    granskaKallor('Enligt 2 kap. 10 § gäller ångerrätt.', hamtade),
    { kallor: [], pahittade: [] },
    'ett svar helt utan adresser ger tom lista, och då kastas svaret',
  );
});
