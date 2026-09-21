// ============================================================
// NEXTRUM — tester för notismejlen
//
// Kör med:  deno test supabase/functions/_delad/
//
// Det som testas är inte hur mejlet SER ut. Det är de saker som tyst
// går sönder och som ingen upptäcker förrän en förälder redan fått
// mejlet:
//
//   · varje typ och roll ger ett ämne, en knapp som går till en flik
//     som finns, och en avregistreringslänk med rätt token
//   · ett namn med html eller en adress escapas och klipps till
//     förnamnet, i ämnet, i texten och i HTML
//   · ingen nyckel utöver datum, tid, ämne och förnamn hamnar i mejlet
//   · "i morgon" står bara när passet faktiskt är i morgon
//   · avböjt och avbokat är olika besked
//   · inga tankstreck, inget "lärare"
// ============================================================

import { assert, assertEquals, assertMatch, assertStringIncludes, assertThrows }
  from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { avregistreringsAdress, renderaMejl, type MejlIn } from './rendera.ts';
import { MEJLBARA, type Roll } from './typer.ts';

const TOKEN = '3f2c8a1e-5b7d-4c9e-8f01-2a3b4c5d6e7f.mejl.pass_nytt.AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCd';
// 12:00 i Stockholm, tisdag 22 september 2026.
const NU = new Date('2026-09-22T10:00:00Z');

const DATA = {
  datum: '2026-09-23', tid: '16:00', langd_min: 60, amne: 'Matematik', elev: 'Alva',
  studiehjalpare: 'Tove', status: 'confirmed', fran_datum: '2026-09-24', fran_tid: '15:00',
  fran: 'Tove', timmar: 24,
};

function mejl(typ: string, roll: Roll, over: Partial<MejlIn> = {}) {
  return renderaMejl({
    typ, roll, fornamn: 'Anna', antal: 1, data: DATA, token: TOKEN, prov: 'nej', nu: NU, ...over,
  });
}

/** Det mottagaren läser: texten, och HTML utan taggar och attribut. */
function synligt(m: { amne: string; text: string; html: string }): string {
  return [m.amne, m.text, m.html.replace(/<[^>]*>/g, ' ')].join('\n');
}

Deno.test('varje typ och roll ger ämne, rubrik, en knapp och avregistreringslänk', () => {
  for (const typ of MEJLBARA) {
    for (const roll of ['parent', 'tutor'] as const) {
      const m = mejl(typ, roll);
      const vy = roll === 'tutor' ? '/larare' : '/foralder';
      const flik = typ === 'meddelande' ? '#meddelanden' : '#lektioner/pass';

      assert(m.amne.length > 5, `${typ}/${roll}: tomt ämne`);
      assert(!/[\r\n]/.test(m.amne), `${typ}/${roll}: radbrytning i ämnet`);

      // Exakt en knapp, och den går till en flik som finns i vyn.
      const knappar = m.html.match(/<td bgcolor="#9C4520"/g) ?? [];
      assertEquals(knappar.length, 1, `${typ}/${roll}: knappar`);
      assertStringIncludes(m.html, `href="https://nextrum.se${vy}${flik}"`);
      assertStringIncludes(m.text, `https://nextrum.se${vy}${flik}`);

      // Foten: avregistrering för typen, valen och kontaktadressen.
      const avreg = avregistreringsAdress(TOKEN);
      assertStringIncludes(m.html, `href="${avreg}"`);
      assertStringIncludes(m.text, avreg);
      assertStringIncludes(m.html, 'Sluta få mejl om det här');
      assertStringIncludes(m.html, `href="https://nextrum.se${vy}#profil/notiser"`);
      assertStringIncludes(m.html, 'Ändra dina val');
      assertStringIncludes(m.html, 'mailto:info@nextrum.se');
      assertStringIncludes(m.text, 'info@nextrum.se');
      assertStringIncludes(m.text, 'Du får det här för att');
    }
  }
});

Deno.test('inga tankstreck, inget "lärare" och ingen html i textversionen', () => {
  for (const typ of MEJLBARA) {
    for (const roll of ['parent', 'tutor'] as const) {
      for (const prov of ['nej', 'sandlada', 'provmejl'] as const) {
        const m = mejl(typ, roll, { prov, antal: 3 });
        const s = synligt(m);
        assert(!/[–—]/.test(s), `${typ}/${roll}/${prov}: tankstreck`);
        assert(!/lärare/i.test(s), `${typ}/${roll}/${prov}: "lärare"`);
        assert(!m.text.includes('<'), `${typ}/${roll}/${prov}: html i textversionen`);
        assert(!s.includes('undefined') && !s.includes('null'), `${typ}/${roll}/${prov}: tomt fält`);
      }
    }
  }
});

Deno.test('ett namn med html eller en adress escapas och klipps till förnamnet', () => {
  const farligt = {
    ...DATA,
    elev: '<script>alert(1)</script> Svensson',
    studiehjalpare: 'tove@evil.com Andersson',
    fran: 'Tove <img src=x onerror=alert(1)> www.evil.com',
    amne: 'Matte<b>fet</b> https://evil.com',
  };
  for (const typ of MEJLBARA) {
    for (const roll of ['parent', 'tutor'] as const) {
      const m = mejl(typ, roll, { data: farligt, fornamn: 'Anna-Lena "<b>" Berg' });
      for (const del of [m.amne, m.text, m.html]) {
        assert(!del.includes('<script'), `${typ}/${roll}: script`);
        assert(!del.includes('<img'), `${typ}/${roll}: img`);
        assert(!del.includes('<b>'), `${typ}/${roll}: b`);
        assert(!del.includes('evil.com'), `${typ}/${roll}: adressen`);
        assert(!del.includes('@evil'), `${typ}/${roll}: e-post`);
        assert(!del.includes('Svensson') && !del.includes('Andersson') && !del.includes('Berg'),
          `${typ}/${roll}: efternamn`);
      }
      assertStringIncludes(m.text, 'Hej Anna-Lena,');
    }
  }
  // Förnamnet som blir kvar är bara bokstäver: ingen punkt, alltså ingen länk.
  const m = mejl('meddelande', 'parent', { data: { fran: 'tove@evil.com' } });
  assertStringIncludes(m.amne, 'från toveevilcom');
});

Deno.test('ingen nyckel utöver datum, tid, ämne och förnamn hamnar i mejlet', () => {
  const med = {
    ...DATA,
    body: 'HEMLIGT-MEDDELANDE', note: 'HEMLIG-ANTECKNING', location: 'STORGATAN-1',
    raw_notes: 'RAPPORTTEXT', efternamn: 'EFTERNAMNET', epost: 'someone@example.com',
    telefon: '+46701234567', mal: '#pass-lista', html: '<h1>X</h1>',
  };
  for (const typ of MEJLBARA) {
    for (const roll of ['parent', 'tutor'] as const) {
      const s = synligt(mejl(typ, roll, { data: med, antal: 2 }));
      for (const hemligt of ['HEMLIGT', 'HEMLIG-', 'STORGATAN', 'RAPPORTTEXT', 'EFTERNAMNET',
                             'example.com', '4670123', 'pass-lista', '<h1>']) {
        assert(!s.includes(hemligt), `${typ}/${roll}: ${hemligt}`);
      }
    }
  }
});

Deno.test('chatten säger hur många meddelanden, och aldrig vad de säger', () => {
  assertEquals(mejl('meddelande', 'parent').amne, 'Nytt meddelande från Tove');
  assertEquals(mejl('meddelande', 'tutor', { antal: 3 }).amne, '3 nya meddelanden från Tove');
  assertEquals(mejl('meddelande', 'parent', { antal: 2, data: {} }).amne, '2 nya meddelanden');
  const m = mejl('meddelande', 'parent', { antal: 3 });
  assertStringIncludes(m.html, '3 nya meddelanden');
  assertStringIncludes(m.html, 'Läs meddelandena');
  assertStringIncludes(mejl('meddelande', 'parent').html, 'Läs meddelandet');
});

Deno.test('påminnelsen räknar fram "i morgon" i stället för att anta det', () => {
  const p = (data: Record<string, unknown>, nu = NU) => mejl('paminnelse', 'parent', { data, nu }).amne;

  assertEquals(p({ datum: '2026-09-23', tid: '16:00', timmar: 24 }), 'Påminnelse: pass i morgon kl. 16:00');
  assertEquals(p({ datum: '2026-09-22', tid: '13:00', timmar: 1 }), 'Påminnelse: pass om en timme, kl. 13:00');
  assertEquals(p({ datum: '2026-09-22', tid: '15:00', timmar: 3 }), 'Påminnelse: pass om 3 timmar, kl. 15:00');
  // 20 timmar före ett pass kl. 23:00 är samma dag, inte i morgon.
  assertEquals(p({ datum: '2026-09-22', tid: '23:00', timmar: 20 }), 'Påminnelse: pass i dag kl. 23:00');
  // Två dagar före: dagen skrivs ut.
  assertEquals(p({ datum: '2026-09-24', tid: '16:00', timmar: 48 }), 'Påminnelse: pass torsdag 24 september kl. 16:00');
  // 00:30 i Stockholm är fortfarande 22:30 UTC dagen före. Dagen är Stockholms.
  assertEquals(p({ datum: '2026-09-23', tid: '16:00', timmar: 24 }, new Date('2026-09-22T22:30:00Z')),
    'Påminnelse: pass i dag kl. 16:00');
  // Utan datum blir det ingen påhittad tid.
  assertEquals(p({ timmar: 24 }), 'Påminnelse om pass');
});

Deno.test('avböjt och avbokat är olika besked', () => {
  for (const roll of ['parent', 'tutor'] as const) {
    const avbojt = mejl('pass_avbojt', roll);
    const avbokat = mejl('pass_avbokat', roll);
    assertMatch(avbojt.amne, /avböjd/);
    assertMatch(avbokat.amne, /avbokat/);
    assert(!/avbokat/i.test(synligt(avbojt).replace(/avbokade pass/g, '')), `${roll}: avböjt säger avbokat`);
    assert(!/avböjd/i.test(synligt(avbokat)), `${roll}: avbokat säger avböjd`);
  }
});

Deno.test('ett önskat pass ber om svar, ett bokat gör det inte', () => {
  const onskat = mejl('pass_nytt', 'tutor', { data: { ...DATA, status: 'requested' } });
  assertStringIncludes(onskat.amne, 'Nytt pass att svara på');
  assertStringIncludes(onskat.html, 'Svara i Nextrum');
  const bokat = mejl('pass_nytt', 'tutor');
  assertStringIncludes(bokat.amne, 'Nytt pass bokat: onsdag 23 september kl. 16:00');
  assertStringIncludes(bokat.html, 'Visa passet');
});

Deno.test('en flytt visar både den nya och den tidigare tiden', () => {
  const m = mejl('pass_flyttat', 'parent', { data: { ...DATA, status: 'requested' } });
  assertEquals(m.amne, 'Passet är flyttat till onsdag 23 september kl. 16:00');
  assertStringIncludes(m.text, 'Ny tid: onsdag 23 september kl. 16:00');
  assertStringIncludes(m.text, 'Tidigare: torsdag 24 september kl. 15:00');
  assertStringIncludes(m.text, 'Svara ja eller nej');
});

Deno.test('familjen ser studiehjälparen, studiehjälparen ser eleven', () => {
  const familj = mejl('pass_bekraftat', 'parent').text;
  assertStringIncludes(familj, 'Studiehjälpare: Tove');
  assertStringIncludes(familj, 'Elev: Alva');
  const hjalpare = mejl('pass_bekraftat', 'tutor').text;
  assert(!hjalpare.includes('Studiehjälpare: '), 'studiehjälparen ser sig själv');
  assertStringIncludes(hjalpare, 'Elev: Alva');
  // Utan elev i data (mottagaren får inte se barnet) står inget namn.
  const utan = mejl('pass_nytt', 'tutor', { data: { ...DATA, elev: undefined } }).text;
  assert(!utan.includes('Alva'), 'elevens namn utan att databasen skickat det');
});

Deno.test('sandlådan och provmejlet märks i ämnet, och sandlådan har ingen äkta länk', () => {
  const s = mejl('pass_nytt', 'parent', { prov: 'sandlada' });
  assert(s.amne.startsWith('[Prov till familj] '), s.amne);
  assert(!s.html.includes('avanmal?t='), 'sandlådan fick en äkta avregistreringslänk');
  assertStringIncludes(s.html, 'href="https://nextrum.se/avanmal"');

  const t = mejl('meddelande', 'tutor', { prov: 'sandlada' });
  assert(t.amne.startsWith('[Prov till studiehjälpare] '), t.amne);

  const p = mejl('paminnelse', 'parent', { prov: 'provmejl' });
  assert(p.amne.startsWith('[Prov till familj] '), p.amne);
  assertStringIncludes(p.html, `href="${avregistreringsAdress(TOKEN)}"`);

  assert(!mejl('pass_nytt', 'parent').amne.startsWith('['), 'ett riktigt mejl fick provmärkning');
});

Deno.test('en typ som inte mejlas har ingen mall', () => {
  assertThrows(() => mejl('rapport', 'parent'));
  assertThrows(() => mejl('okand', 'parent'));
});

Deno.test('html-versionen är ett helt dokument med balanserade tabeller och ljust läge', () => {
  const h = mejl('pass_flyttat', 'parent').html;
  assertStringIncludes(h, '<!doctype html>');
  assertStringIncludes(h, '</html>');
  assertEquals((h.match(/<table/g) ?? []).length, (h.match(/<\/table>/g) ?? []).length);
  assertStringIncludes(h, 'color-scheme" content="light only"');
  assert(!h.includes('fonts.googleapis'), 'webbtypsnitt i mejlet');
  assert(!/<img\b/.test(h), 'en bild som kan saknas');
});
