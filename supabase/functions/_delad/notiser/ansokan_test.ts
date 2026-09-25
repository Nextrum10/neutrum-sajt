// ============================================================
// NEXTRUM — prov: mejlen till den som sökt jobb (Fas 16.1)
//
// Kör med:  deno test supabase/functions/_delad/
//
// Proven håller fast det som gör mejlen värda att skicka och säkra att
// skicka:
//
//   · varje mejl säger var i processen mottagaren står
//   · mötets tid står i svensk tid, som admin skrev den
//   · en möteslänk blir en knapp bara om den är en riktig https-adress
//   · ingenting ur ansökan återges utom förnamnet
//   · de går inte att välja bort, och de ber om svar till en läst adress
// ============================================================

import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import {
  ANSOKAN_FRAN, ANSOKAN_STEG, RESAN, arAnsokanSteg, motesText, renderaAnsokan, resa, sakerLank,
  type AnsokanSteg,
} from './ansokan.ts';
import { KONTAKT, LOGGA_URL, SAJT } from './rendera.ts';
import { SVAR_INOM_TIMMAR } from './kvitto.ts';

const MOTE = '2026-10-02T15:00:00Z'; // kl. 17:00 i Stockholm, sommartid
const LANK = 'https://meet.google.com/abc-defg-hij';

function mejl(steg: AnsokanSteg, extra: Record<string, unknown> = {}) {
  return renderaAnsokan({ steg, namn: 'Tove Lindqvist', moteTid: MOTE, moteLank: LANK, ...extra });
}

Deno.test('kvittot tackar och lovar svar så fort vi kan, senast inom löftet på sajten', () => {
  const m = mejl('mottagen');
  assertEquals(m.amne, 'Tack för din ansökan till Nextrum');
  assertStringIncludes(m.text, 'Tack för att du vill jobba hos oss');
  assertStringIncludes(m.text, 'så fort vi kan');
  assertStringIncludes(m.text, `senast inom ${SVAR_INOM_TIMMAR} timmar`);
});

Deno.test('varje mejl visar alla fyra stegen och var mottagaren står', () => {
  const nu: Record<AnsokanSteg, string | null> = {
    mottagen: 'Ansökan', mote: 'Digitalt möte', utbildning: 'Introduktion',
    sista_steget: 'Konto och godkännande', valkommen: null,
  };
  for (const steg of ANSOKAN_STEG) {
    const m = mejl(steg);
    for (const s of RESAN) {
      assertStringIncludes(m.text, s, `${steg}: steget ${s} saknas i texten`);
      assertStringIncludes(m.html, s, `${steg}: steget ${s} saknas i HTML`);
    }
    if (nu[steg]) {
      assertStringIncludes(m.text, `[>] ${nu[steg]}  <- du är här`, steg);
      assertStringIncludes(m.html, 'du är här', steg);
    } else {
      // Välkomstmejlet: allt är klart, ingen står kvar någonstans.
      assertEquals(m.text.includes('du är här'), false);
      assertStringIncludes(m.text, 'Alla steg klara');
    }
  }
});

Deno.test('stegen före är klara, stegen efter kommer', () => {
  assertEquals(resa('utbildning').steg.map((s) => s.lage), ['klar', 'klar', 'nu', 'kommer']);
  assertEquals(resa('mottagen').rubrik, 'Steg 1 av 4');
  assertEquals(resa('sista_steget').rubrik, 'Steg 4 av 4');
  assertEquals(resa('valkommen').steg.every((s) => s.lage === 'klar'), true);
});

Deno.test('mötets tid står i svensk tid, inte i UTC', () => {
  // Admin skrev 17:00. Databasen har 15:00Z. Mejlet ska säga 17:00.
  assertEquals(motesText(MOTE), 'fredag 2 oktober kl. 17:00');
  // Vintertid: en timme, inte två.
  assertEquals(motesText('2026-12-03T16:30:00Z'), 'torsdag 3 december kl. 17:30');
  assertEquals(motesText('inte ett datum'), null);
  assertEquals(motesText(null), null);

  const m = mejl('mote');
  assertStringIncludes(m.text, 'När: fredag 2 oktober kl. 17:00');
  assertStringIncludes(m.html, LANK);
  assertStringIncludes(m.text, `Öppna möteslänken:\n${LANK}`);
});

Deno.test('en ny tid får ett eget ämne, så att det inte ser ut som samma mejl igen', () => {
  assertEquals(mejl('mote').amne, 'Ditt möte med Nextrum är bokat');
  assertEquals(mejl('mote', { ombokat: true }).amne, 'Ny tid för ditt möte med Nextrum');
});

Deno.test('bara en riktig https-adress blir en knapp', () => {
  assertEquals(sakerLank(LANK), LANK);
  for (const ond of [
    'javascript:alert(1)',
    'http://meet.google.com/abc',
    'https://nextrum.se@annan.example/inloggning',
    'https://user:pass@meet.example.com/x',
    'data:text/html,<script>',
    'https://localhost/x',
    '',
    'x'.repeat(600),
    null,
  ]) {
    assertEquals(sakerLank(ond), null, `släpptes igenom: ${String(ond).slice(0, 40)}`);
  }

  // Utan en länk att lita på finns ingen knapp, och mejlet säger att
  // länken kommer — i stället för att visa en knapp till ingenting.
  const m = mejl('mote', { moteLank: 'javascript:alert(1)' });
  assertEquals(m.html.includes('javascript:'), false);
  assertEquals(m.text.includes('javascript:'), false);
  assertEquals(m.text.includes('Öppna möteslänken'), false);
  assertStringIncludes(m.text, 'Länken kommer innan mötet');
});

Deno.test('sista steget skickar till kontot, välkomsten till vyn', () => {
  // Utan ett konto finns ingen profil att godkänna (adminvyns "Ta in i
  // poolen"), så det här steget är det enda som ber om en åtgärd.
  assertStringIncludes(mejl('sista_steget').text, `${SAJT}/larare`);
  assertStringIncludes(mejl('sista_steget').text, 'samma e-postadress');
  assertStringIncludes(mejl('valkommen').text, `${SAJT}/larare`);
  assertEquals(mejl('valkommen').amne, 'Välkommen till Nextrum!');
});

Deno.test('ingenting ur ansökan återges, bara förnamnet', () => {
  for (const steg of ANSOKAN_STEG) {
    const m = renderaAnsokan({ steg, namn: 'Tove Lindqvist', moteTid: MOTE, moteLank: LANK });
    assertStringIncludes(m.text, 'Hej Tove,');
    assertEquals(m.text.includes('Lindqvist'), false, `${steg}: efternamnet följde med`);
    assertEquals(m.html.includes('Lindqvist'), false, `${steg}: efternamnet följde med`);
  }
  // Ett "namn" som ser ut som en adress blir inte en länk i Gmail.
  const m = renderaAnsokan({ steg: 'mottagen', namn: 'evil.example/login' });
  assertEquals(m.text.includes('evil.example'), false);
  // Inget namn alls blir en hälsning utan namn, inte "Hej undefined,".
  assertStringIncludes(renderaAnsokan({ steg: 'mottagen', namn: null }).text, 'Hej,');
});

Deno.test('besked, inte nyhetsbrev: ingen avregistrering, svar till en läst adress', () => {
  assertEquals(ANSOKAN_FRAN, `Nextrum <${KONTAKT}>`);
  for (const steg of ANSOKAN_STEG) {
    const m = mejl(steg);
    for (const ut of [m.text, m.html]) {
      assertEquals(ut.includes('/avanmal'), false, `${steg}: avregistreringslänk`);
      assertEquals(ut.includes('Ändra dina val'), false, `${steg}: inställningslänk`);
    }
    // I avslutningen eller i foten, men alltid någonstans.
    assertStringIncludes(m.text, 'Svara på');
    assertStringIncludes(m.text, 'sökt jobb som studiehjälpare');
  }
});

Deno.test('samma ram och samma logga som allt annat vi skickar', () => {
  for (const steg of ANSOKAN_STEG) {
    const m = mejl(steg);
    assertStringIncludes(m.html, '<!doctype html>');
    assertStringIncludes(m.html, 'content="light only"');
    assertEquals((m.html.match(/<img\b/g) ?? []).length, 1, `${steg}: exakt en bild`);
    assertStringIncludes(m.html, LOGGA_URL);
    assert(m.text.length > 100);
  }
});

Deno.test('avböjd och kontakt har ingen mall, med flit', () => {
  // Ett nej skrivs av en människa. Kontakten är adminens eget mejl.
  assertEquals(arAnsokanSteg('avbojd'), false);
  assertEquals(arAnsokanSteg('rejected'), false);
  assertEquals(arAnsokanSteg('kontakt'), false);
  assertEquals(arAnsokanSteg('mottagen'), true);
  // Listan speglar check-villkoret i ansokan_utskick.steg.
  assertEquals([...ANSOKAN_STEG], ['mottagen', 'mote', 'utbildning', 'sista_steget', 'valkommen']);
});
