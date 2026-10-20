import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { kortaSvar, svarstext } from './kortsvar.ts';

Deno.test('ett tankeblock först gör inte svaret tomt', () => {
  assertEquals(svarstext({
    stop_reason: 'end_turn',
    content: [{ type: 'thinking', thinking: '...' }, { type: 'text', text: ' Hej. ' }],
  }), 'Hej.');
});

Deno.test('ett avhugget svar är inget svar', () => {
  assertEquals(svarstext({
    stop_reason: 'max_tokens',
    content: [{ type: 'text', text: 'En halv me' }],
  }), null);
});

Deno.test('en vägran och ett tomt svar är inget svar', () => {
  assertEquals(svarstext({ stop_reason: 'refusal', content: [] }), null);
  assertEquals(svarstext({ stop_reason: 'end_turn', content: [] }), null);
  assertEquals(svarstext(null), null);
});

Deno.test('tänkandet i förväg är av', () => {
  assertEquals(kortaSvar().thinking.type, 'between_tools');
  assertEquals(kortaSvar('medium').output_config.effort, 'medium');
});
