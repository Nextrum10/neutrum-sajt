// ============================================================
// NEXTRUM — prov: mejlet med länken till kontot (2026-10-07)
//
// Kör med:  deno test supabase/functions/_delad/
//
// Tiden i ämnet är det som håller isär två utskick i Gmail, så den
// provas i svensk sommar- och vintertid och över midnatt. Länken ska gå
// genom /lank och gå att avkoda en gång, som nextrum-lank.js gör.
// ============================================================

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { KONTO_FRAN, KONTO_TEXT, lankAdress, renderaKontomejl, skickadText } from './konto.ts';

const VERIFY = 'https://ddkfiuvcppalutfulvbi.supabase.co/auth/v1/verify?token=abc123&type=invite'
  + '&redirect_to=https://nextrum.se/foralder';

Deno.test('tiden är svensk: sommartid, vintertid och över midnatt', () => {
  assertEquals(skickadText(new Date('2026-10-07T13:51:22Z')), '7 oktober kl. 15:51');
  assertEquals(skickadText(new Date('2026-12-01T08:05:00Z')), '1 december kl. 09:05');
  assertEquals(skickadText(new Date('2026-10-07T22:30:00Z')), '8 oktober kl. 00:30');
});

Deno.test('länken går genom /lank och avkodas en gång till Auths länk', () => {
  const a = lankAdress(VERIFY);
  assert(a.startsWith('https://nextrum.se/lank#https%3A%2F%2F'), a);
  assertEquals(decodeURIComponent(a.split('#')[1]), VERIFY);
});

Deno.test('inbjudan: tiden i ämnet, knappen till /lank, förnamnet, och att bara det senaste fungerar', () => {
  const m = renderaKontomejl({ typ: 'inbjudan', roll: 'parent', namn: 'Anna Andersson', verify: VERIFY,
    nu: new Date('2026-10-07T13:51:22Z') });
  assertEquals(m.amne, 'Ditt konto hos Nextrum, 7 oktober kl. 15:51');
  assert(m.html.includes(`href="${lankAdress(VERIFY)}"`), 'knappen');
  assert(m.text.includes(`${KONTO_TEXT.inbjudan.knapp}:\n${lankAdress(VERIFY)}`), 'länken i textversionen');
  assert(m.text.startsWith('Hej Anna,'), m.text.slice(0, 30));
  assert(!m.text.includes('Andersson') && !m.html.includes('Andersson'), 'bara förnamnet');
  assert(m.text.includes('fungerar bara länken i det senaste'));
  assert(m.text.includes('Skickat: 7 oktober kl. 15:51'));
  assert(!m.text.includes('Sluta få mejl') && !m.html.includes('/avanmal'), 'ett transaktionsmejl har ingen avanmälan');
});

Deno.test('lösenordslänken har ett eget ämne, och två utskick en minut isär har olika ämnen', () => {
  const ett = renderaKontomejl({ typ: 'losenord', roll: 'tutor', namn: null, verify: VERIFY,
    nu: new Date('2026-10-07T13:51:59Z') });
  const tva = renderaKontomejl({ typ: 'losenord', roll: 'tutor', namn: null, verify: VERIFY,
    nu: new Date('2026-10-07T13:52:59Z') });
  assertEquals(ett.amne, 'Välj ditt lösenord hos Nextrum, 7 oktober kl. 15:51');
  assert(ett.amne !== tva.amne);
  assert(ett.text.startsWith('Hej,'), 'utan namn ingen hälsning med namn');
});

Deno.test('avsändaren är en adress vi läser', () => {
  assertEquals(KONTO_FRAN, 'Nextrum <info@nextrum.se>');
});
