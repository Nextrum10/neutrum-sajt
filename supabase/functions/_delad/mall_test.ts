// ============================================================
// NEXTRUM — tester för brevmallen
//
// Kör med:  deno test supabase/functions/_delad/
//
// Det som testas är inte hur mejlet SER ut — det är en smaksak och
// ändras. Det som testas är de fyra saker som tyst går sönder och
// som ingen upptäcker förrän en förälder redan fått mejlet:
//
//   · att innehåll escapas innan det blir html
//   · att textversionen finns och innehåller allt html-versionen gör
//   · att kontaktadressen är med i bägge versionerna
//   · att tomma fält inte blir tomma rader
// ============================================================

import { assert, assertEquals, assertStringIncludes }
  from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { brev, html, text, KONTAKT, SAJT } from './mall.ts';

Deno.test('innehåll escapas — ett namn kan inte injicera html', () => {
  const h = html({
    rubrik: 'Hej <script>alert(1)</script>',
    stycken: ['En förälder som heter O\'Brien & "Söderberg"'],
  });
  assert(!h.includes('<script>alert(1)</script>'), 'skripttaggen slapp igenom');
  assertStringIncludes(h, '&lt;script&gt;');
  assertStringIncludes(h, '&#39;Brien &amp; &quot;Söderberg&quot;');
});

Deno.test('en länkadress escapas i href', () => {
  const h = html({
    rubrik: 'R',
    stycken: [],
    knapp: { text: 'Klicka', adress: 'https://nextrum.se/x?a=1&b="2"' },
  });
  assert(!h.includes('href="https://nextrum.se/x?a=1&b="2""'), 'attributet bröts upp');
  assertStringIncludes(h, '&amp;b=&quot;2&quot;');
});

Deno.test('textversionen har allt som html-versionen har', () => {
  const b = {
    rubrik: 'Ni har fått ett tidsförslag',
    stycken: ['Hej Anna,', 'Oskar har föreslagit en tid.'],
    fakta: [['När', '14 oktober kl. 16:00'], ['Ämne', 'Matematik']] as [string, string][],
    knapp: { text: 'Svara', adress: SAJT + '/foralder#pass-lista' },
    efterord: 'Du får det här mejlet för att du har en notis.',
  };
  const t = text(b);
  for (const del of ['Ni har fått ett tidsförslag', 'Hej Anna,', 'Oskar har föreslagit en tid.',
                     'När: 14 oktober kl. 16:00', 'Ämne: Matematik',
                     SAJT + '/foralder#pass-lista', 'Du får det här mejlet']) {
    assertStringIncludes(t, del);
  }
  // Textversionen ska vara ren text, inte html med taggarna kvar.
  assert(!t.includes('<'), 'html läckte in i textversionen');
});

Deno.test('kontaktadressen står i foten, i bägge versionerna', () => {
  const b = brev({ rubrik: 'R', stycken: ['S'] });
  assertStringIncludes(b.text, KONTAKT);
  assertStringIncludes(b.html, KONTAKT);
  assertStringIncludes(b.html, `mailto:${KONTAKT}`);
});

Deno.test('utan knapp, fakta och efterord blir det inga tomma block', () => {
  const b = brev({ rubrik: 'Bara en rubrik', stycken: ['Ett stycke.'] });
  assert(!b.html.includes('border-radius:10px"><a'), 'en knapp ritades utan knapp');
  assertEquals(b.text.includes('undefined'), false);
  assertEquals(b.html.includes('undefined'), false);
});

Deno.test('html-versionen är ett helt dokument med balanserade tabeller', () => {
  const h = html({
    rubrik: 'R',
    stycken: ['S'],
    fakta: [['A', 'b']],
    knapp: { text: 'K', adress: SAJT },
  });
  assertStringIncludes(h, '<!doctype html>');
  assertStringIncludes(h, '</html>');
  assertEquals((h.match(/<table/g) ?? []).length, (h.match(/<\/table>/g) ?? []).length);
  // Mörkt läge är avstängt med flit: se kommentaren i mall.ts.
  assertStringIncludes(h, 'color-scheme" content="light only"');
});
