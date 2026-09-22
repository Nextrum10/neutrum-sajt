// ============================================================
// NEXTRUM — prov: kvittot på en intresseanmälan
//
// Kör med:  deno test supabase/functions/_delad/
//
// Kvittot är det enda mejl som går till någon utan konto, och det
// enda som inte går att välja bort. Proven håller fast de tre saker
// som gör det till ett transaktionsmejl och inte en notis:
//
//   · ingen avregistreringslänk, för det finns inget att avregistrera
//   · avsändaren är info@, för mejlet ber om svar
//   · ingenting ur anmälan återges, bara förnamnet
// ============================================================

import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { KVITTO_FRAN, KVITTO_TEXT, SVAR_INOM_TIMMAR, renderaKvitto } from './kvitto.ts';
import { KONTAKT, SAJT } from './rendera.ts';

Deno.test('ämnesraden är den som står i beställningen', () => {
  assertEquals(renderaKvitto('Anna').amne, 'Tack för din intresseanmälan till Nextrum');
});

Deno.test('mejlet tackar, bekräftar och lovar svar inom 24 timmar', () => {
  const m = renderaKvitto('Anna Andersson');

  assertStringIncludes(m.text, 'Hej Anna,');
  assertStringIncludes(m.text, 'Tack, vi har fått din anmälan');
  assertStringIncludes(m.text, `inom ${SVAR_INOM_TIMMAR} timmar`);
  assertEquals(SVAR_INOM_TIMMAR, 24, 'löftet står också på sajten');

  // Efternamnet följer inte med, som i alla andra mejl.
  assertEquals(m.text.includes('Andersson'), false);
});

Deno.test('mejlet förklarar de tre stegen som följer', () => {
  const m = renderaKvitto('Anna');
  assertEquals(KVITTO_TEXT.steg.length, 3);
  for (const [rubrik, text] of KVITTO_TEXT.steg) {
    assertStringIncludes(m.text, rubrik);
    assertStringIncludes(m.text, text);
    assertStringIncludes(m.html, rubrik);
  }
});

Deno.test('knappen går till den publika sidan, inte till en inloggning', () => {
  // Mottagaren har inget konto än. En knapp till /foralder hade mött
  // en inloggningsruta en minut efter att formuläret fyllts i.
  const m = renderaKvitto('Anna');
  assertStringIncludes(m.text, `${SAJT}/sa-fungerar-nextrum`);
  assertStringIncludes(m.html, `${SAJT}/sa-fungerar-nextrum`);
  assertEquals(m.text.includes('/foralder'), false);
  assertEquals(m.html.includes('/foralder'), false);
});

Deno.test('INGEN avregistreringslänk, i vare sig text eller HTML', () => {
  // Ett kvitto går inte att välja bort — nästa anmälan får ett ändå.
  // En länk som lovar motsatsen är värre än ingen länk.
  const m = renderaKvitto('Anna');
  for (const ut of [m.text, m.html]) {
    assertEquals(ut.includes('/avanmal'), false, 'avregistreringslänk i kvittot');
    assertEquals(ut.includes('Sluta få mejl'), false);
    assertEquals(ut.includes('Ändra dina val'), false);
    assertEquals(ut.includes('#profil/notiser'), false);
  }
});

Deno.test('foten säger ändå varför mejlet kom', () => {
  // Kravet är att man ska veta varför man fått ett mejl, inte
  // nödvändigtvis kunna säga nej till ett kvitto man bett om.
  const m = renderaKvitto('Anna');
  assertStringIncludes(m.text, 'en intresseanmälan med din e-postadress');
  assertStringIncludes(m.text, 'Var det inte du');
  assertStringIncludes(m.html, 'en intresseanmälan med din e-postadress');
});

Deno.test('avslutningen står i BÅDA versionerna, inte bara i texten', () => {
  const m = renderaKvitto('Anna');
  assertStringIncludes(m.text, 'svara på det här mejlet');
  assertStringIncludes(m.html, 'svara på det här mejlet');
  assertStringIncludes(m.text, `skriv till ${KONTAKT}`);
});

Deno.test('avsändaren är info@, för mejlet ber om svar', () => {
  // Ett no-reply på ett mejl som ber familjen höra av sig är en
  // motsägelse, och svaret hamnar i ingenting.
  assertEquals(KVITTO_FRAN, 'Nextrum <info@nextrum.se>');
  assertEquals(KVITTO_FRAN.includes('no-reply'), false);
});

Deno.test('utan namn blir hälsningen "Hej," och inget annat', () => {
  for (const namn of [null, undefined, '', '   ', 42, '070-1234567']) {
    const m = renderaKvitto(namn);
    assertStringIncludes(m.text, 'Hej,');
    assertEquals(m.text.includes('undefined'), false);
    assertEquals(m.text.includes('null'), false);
    assertEquals(m.amne, 'Tack för din intresseanmälan till Nextrum');
  }
});

Deno.test('ett namn som ser ut som en adress blir inte en länk', () => {
  const m = renderaKvitto('anna@evil.com');
  assertStringIncludes(m.text, 'Hej annaevilcom,');
  assertEquals(m.html.includes('anna@evil.com'), false);
});

Deno.test('både HTML och ren text produceras, och HTML är ett helt dokument', () => {
  const m = renderaKvitto('Anna');
  assertEquals(m.text.length > 100, true);
  assertStringIncludes(m.html, '<!doctype html>');
  assertStringIncludes(m.html, '</html>');
  // Samma ram som notismejlen: logga, palett, ljust läge.
  assertStringIncludes(m.html, 'content="light only"');
  assertStringIncludes(m.html, '#9C4520');
  assertEquals(m.html.includes('<img'), false);
});

Deno.test('kvittot märks aldrig som ett prov', () => {
  // Provraden hör till kön. Ett kvitto som gick ut med "[Prov till
  // familj]" i ämnet hade varit ett riktigt mejl till en riktig
  // familj med fel ämnesrad.
  const m = renderaKvitto('Anna');
  assertEquals(m.amne.includes('[Prov'), false);
  assertEquals(m.text.includes('Det här är ett prov'), false);
});
