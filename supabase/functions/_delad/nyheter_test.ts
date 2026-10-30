import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { nyhetsmejl, styckenHtml } from './nyheter.ts';

Deno.test('styckenHtml: stycken, radbrytningar och escapad text', () => {
  assertEquals(styckenHtml('Hej\n\nRad ett\nrad två'), '<p style="">Hej</p><p style="">Rad ett<br>rad två</p>');
  assertEquals(styckenHtml('<b>fet</b> & mer'), '<p style="">&lt;b&gt;fet&lt;/b&gt; &amp; mer</p>');
});

Deno.test('styckenHtml: bara https blir en länk, och punkten efter står utanför', () => {
  const h = styckenHtml('Läs https://nextrum.se/priser. Inte http://exempel.se');
  assertStringIncludes(h, 'href="https://nextrum.se/priser"');
  assert(!h.includes('href="http://exempel.se'));
});

Deno.test('nyhetsmejl: avanmälan i foten och i headern, adressen ur mottagaren', () => {
  const m = nyhetsmejl({ slug: 'ny-plan', rubrik: 'Ny plan', ingress: null, text: 'Text' },
    { epost: 'a@b.se', token: 'abc' }, 'https://x.supabase.co/functions/v1/nyhetsbrev');
  assertEquals(m.to, ['a@b.se']);
  assertEquals(m.subject, 'Ny plan');
  assertStringIncludes(m.html, 'https://nextrum.se/nyhetsbrev?a=abc');
  assertStringIncludes(m.html, 'https://nextrum.se/nyheter?n=ny-plan');
  assertEquals(m.headers['List-Unsubscribe'], '<https://x.supabase.co/functions/v1/nyhetsbrev?a=abc>');
});
