// ============================================================
// NEXTRUM — prov för _delad/forhandsvisning.ts (2026-10-27)
//
// Förhandsvisningens kassa: bara en testnyckel, rader med tak, och
// händelserna som webhooken lämnar orörda.
// ============================================================

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  arForhandsvisning, publicerbarTestnyckel, raderUrAnrop, retur, sessionen, testnyckel,
} from './forhandsvisning.ts';

const miljo = (m: Record<string, string>) => (n: string) => m[n];

Deno.test('en skarp nyckel ger ingen kassa', () => {
  assertEquals(testnyckel(miljo({ STRIPE_SECRET_KEY: 'sk_live_abc' })), null);
  assertEquals(testnyckel(miljo({ STRIPE_SECRET_KEY: 'sk_test_abc' })), 'sk_test_abc');
  assertEquals(testnyckel(miljo({ STRIPE_SECRET_KEY: 'rk_test_abc' })), 'rk_test_abc');
  assertEquals(testnyckel(miljo({})), null);
});

Deno.test('en egen testnyckel går före driftens, och en skarp egen ger ingen kassa', () => {
  assertEquals(testnyckel(miljo({ STRIPE_SECRET_KEY: 'sk_live_a', STRIPE_FORHANDSVISNING_SECRET_KEY: 'sk_test_b' })), 'sk_test_b');
  assertEquals(testnyckel(miljo({ STRIPE_SECRET_KEY: 'sk_test_a', STRIPE_FORHANDSVISNING_SECRET_KEY: 'sk_live_b' })), null);
  assertEquals(publicerbarTestnyckel(miljo({ STRIPE_PUBLISHABLE_KEY: 'pk_live_a' })), null);
  assertEquals(publicerbarTestnyckel(miljo({ STRIPE_PUBLISHABLE_KEY: 'pk_live_a', STRIPE_FORHANDSVISNING_PUBLISHABLE_KEY: 'pk_test_b' })), 'pk_test_b');
});

Deno.test('raderna har tak', () => {
  assertEquals(raderUrAnrop([{ text: 'Matematik', ore: 39900 }]), [{ text: 'Matematik', ore: 39900 }]);
  assertEquals(raderUrAnrop([]), null);
  assertEquals(raderUrAnrop([{ text: 'x', ore: 299 }]), null);
  assertEquals(raderUrAnrop([{ text: 'x', ore: 1_000_001 }]), null);
  assertEquals(raderUrAnrop([{ text: 'x', ore: 399.5 }]), null);
  assertEquals(raderUrAnrop([{ text: '  ', ore: 39900 }]), null);
  assertEquals(raderUrAnrop(Array(21).fill({ text: 'x', ore: 39900 })), null);
  assertEquals(raderUrAnrop([{ text: 'a\nb', ore: 39900 }])?.[0].text, 'a b');
});

Deno.test('returadressen är vår egen', () => {
  assertEquals(retur('https://nextrum.se/foralder'), 'https://nextrum.se');
  assertEquals(retur('https://neutrum-sajt-git-gren.vercel.app'), 'https://neutrum-sajt-git-gren.vercel.app');
  assertEquals(retur('http://localhost:8951'), 'http://localhost:8951');
  assertEquals(retur('https://example.com'), 'https://nextrum.se');
  assertEquals(retur('http://nextrum.se'), 'https://nextrum.se');
  assertEquals(retur('javascript:alert(1)'), 'https://nextrum.se');
});

Deno.test('sessionen och dess betalning bär markeringen', () => {
  const s = sessionen([{ text: 'Pass', ore: 39900 }], 'https://nextrum.se', true, 'admin-id');
  assertEquals(arForhandsvisning(s), true);
  assertEquals(arForhandsvisning(s.payment_intent_data), true);
  assertEquals(s.ui_mode, 'embedded');
  const sida = sessionen([{ text: 'Pass', ore: 39900 }], 'https://nextrum.se', false, 'admin-id');
  assertEquals(sida.ui_mode, undefined);
  assertEquals(typeof sida.success_url, 'string');
});

Deno.test('en vanlig betalning är ingen förhandsvisning', () => {
  assertEquals(arForhandsvisning({ metadata: { booking_id: 'x' } }), false);
  assertEquals(arForhandsvisning({ metadata: { forhandsvisning: '0' } }), false);
  assertEquals(arForhandsvisning({}), false);
  assertEquals(arForhandsvisning(null), false);
});
