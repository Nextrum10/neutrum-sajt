// ============================================================
// NEXTRUM — prov: mejlen till admin
//
// Kör med:  deno test supabase/functions/_delad/
//
// Mejlen går till ledningen och bär bara antal och sorter. Proven håller
// fast det som gör det säkert att skicka:
//
//   · inget ur databasens rader återges, bara antal vi själva räknat
//   · en sort vi inte känner igen tas inte med, och ger inget mejl om den
//     är den enda
//   · intresseanmälan och jobbansökan kommer aldrig i morgonmejlet: de
//     mejlas direkt, en gång
//   · ett testmejl säger att det är ett
//   · ingen avregistreringslänk: strömbrytaren är jobbet, inte mejlet
// ============================================================

import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import {
  ADMIN_ADRESS, ADMIN_ANSOKNINGAR, ADMIN_EXTRA_TILL, ADMIN_SORTER, adminRader, adminSlag,
  renderaAdminPaminnelse,
} from './admin.ts';
import { KONTAKT, SAJT } from './rendera.ts';

const MORGON = (o: Record<string, unknown>) => ({ ...o, slag: 'morgon' });

Deno.test('morgonmejlets ämne räknar sakerna och böjer sak', () => {
  assertEquals(renderaAdminPaminnelse(MORGON({ fraga: 1 }))!.amne, 'Väntar på er: 1 sak i Att göra');
  assertEquals(
    renderaAdminPaminnelse(MORGON({ fraga: 2, uppgift: 1, rapport_obekraftad: 4 }))!.amne,
    'Väntar på er: 7 saker i Att göra',
  );
});

Deno.test('varje sort står med sin etikett, i ental och flertal', () => {
  const ett = renderaAdminPaminnelse(MORGON({ pass_saknar_rapport: 1 }))!;
  assertStringIncludes(ett.text, 'Pass utan rapport: 1');
  const flera = renderaAdminPaminnelse(MORGON({ fraga: 3 }))!;
  assertStringIncludes(flera.text, 'Frågor i inkorgen: 3');
  assertStringIncludes(flera.html, 'Frågor i inkorgen');
});

Deno.test('raderna står i listans ordning, inte i den ordning databasen skrev dem', () => {
  const r = adminRader({ uppgift: 1, fraga: 2, faktura_obetald: 3 });
  assertEquals(r.map((x) => x.typ), ['fraga', 'faktura_obetald', 'uppgift']);
});

Deno.test('mejlet säger rapporten som familjen inte bekräftat', () => {
  const m = renderaAdminPaminnelse(MORGON({ rapport_obekraftad: 2 }))!;
  assertStringIncludes(m.text, 'Rapporter som familjerna inte bekräftat: 2');
});

Deno.test('uteblivna rapporter står med i morgonmejlet', () => {
  const m = renderaAdminPaminnelse(MORGON({ pass_saknar_rapport: 2, genomfort_utan_rapport: 1 }))!;
  assertStringIncludes(m.text, 'Pass utan rapport: 2');
  assertStringIncludes(m.text, 'Genomfört pass utan rapport: 1');
});

Deno.test('knappen i morgonmejlet går till Att göra och inget annat', () => {
  const m = renderaAdminPaminnelse(MORGON({ fraga: 1 }))!;
  assertEquals(ADMIN_ADRESS, `${SAJT}/admin#oversikt`);
  assertStringIncludes(m.text, ADMIN_ADRESS);
  assertStringIncludes(m.html, ADMIN_ADRESS);
  assertStringIncludes(m.text, 'Öppna Att göra');
});

Deno.test('intresseanmälan och jobbansökan kommer ALDRIG i morgonmejlet', () => {
  // De mejlas direkt, en gång. Kommer de ändå i raden (en äldre rad, ett fel i
  // databasen) hoppas de över, och ensamma ger de inget mejl.
  assertEquals(adminRader({ ny_lead: 2, ny_ansokan: 1 }), []);
  assertEquals(renderaAdminPaminnelse(MORGON({ ny_lead: 2, ny_ansokan: 1 })), null);
  const m = renderaAdminPaminnelse(MORGON({ ny_lead: 2, ny_ansokan: 1, fraga: 1 }))!;
  for (const ut of [m.text, m.html]) {
    assertEquals(/intresseanmäl|jobbansök/i.test(ut), false);
  }
  assertEquals(m.amne, 'Väntar på er: 1 sak i Att göra');
});

Deno.test('en sort som inte finns, och ett antal som inte är ett heltal, hoppas över', () => {
  const m = renderaAdminPaminnelse(MORGON({
    fraga: 2,
    '<script>': 5,
    okand_sort: 3,
    sh_godkann: 0,
    elev_utan_sh: -1,
    pass_saknar_rapport: 1.5,
    uppgift: 'många',
    utbetalning: 100_000,
  }))!;
  assertEquals(adminRader({ fraga: 2 }).length, 1);
  assertStringIncludes(m.text, 'Frågor i inkorgen: 2');
  for (const ut of [m.text, m.html]) {
    assertEquals(ut.includes('script'), false);
    assertEquals(ut.includes('okand_sort'), false);
    assertEquals(ut.includes('många'), false);
  }
  assertEquals(m.amne, 'Väntar på er: 2 saker i Att göra');
});

Deno.test('ett antal som kommer som text och ser ut som ett heltal räknas', () => {
  assertEquals(adminRader({ fraga: '3' }).map((x) => x.antal), [3]);
});

Deno.test('inga giltiga sorter ger inget morgonmejl', () => {
  for (const v of [null, undefined, {}, [], 'fraga', 7, { okand: 1 }, { fraga: 0 }, [['fraga', 1]], { slag: 'morgon' }]) {
    assertEquals(renderaAdminPaminnelse(v), null);
  }
});

Deno.test('ärvda egenskaper räknas inte som sorter eller slag', () => {
  // {}.constructor finns på varje objekt. Bara det som står i objektet självt får vara med.
  const arvt = Object.create({ fraga: 5, slag: 'direkt', ny_ansokan: 1 });
  assertEquals(renderaAdminPaminnelse(arvt), null);
});

// ---------- slaget ----------

Deno.test('slaget läses ur raden, och saknas det är det ett morgonmejl', () => {
  assertEquals(adminSlag({ fraga: 1 }), 'morgon');
  assertEquals(adminSlag({ fraga: 1, slag: 'morgon' }), 'morgon');
  assertEquals(adminSlag({ ny_ansokan: 1, slag: 'direkt' }), 'direkt');
  assertEquals(adminSlag({ fraga: 1, slag: 'prov' }), 'prov');
});

Deno.test('ett slag vi inte känner ger inget mejl', () => {
  for (const s of ['igar', 'DIREKT', '', 'direkt ', null, 7, ['direkt']]) {
    assertEquals(adminSlag({ ny_ansokan: 1, fraga: 1, slag: s }), null);
    assertEquals(renderaAdminPaminnelse({ ny_ansokan: 1, fraga: 1, slag: s }), null);
  }
});

Deno.test('slaget är ingen sort: det syns inte som en rad i mejlet', () => {
  assertEquals(adminRader({ fraga: 1, slag: 'morgon' }).length, 1);
  const m = renderaAdminPaminnelse(MORGON({ fraga: 1 }))!;
  for (const ut of [m.text, m.html]) assertEquals(/slag|morgon:/i.test(ut), false);
});

// ---------- det direkta mejlet ----------

Deno.test('en jobbansökan ger ett direktmejl som säger det, utan uppgifter', () => {
  const m = renderaAdminPaminnelse({ ny_ansokan: 1, slag: 'direkt' })!;
  assertEquals(m.amne, 'Ny jobbansökan har kommit in');
  assertStringIncludes(m.text, 'Någon har skickat en jobbansökan');
  assertStringIncludes(m.text, 'Inga namn eller uppgifter står i mejlet');
  // Ingen faktaruta med antal: ett mejl är en ansökan.
  assertEquals(m.text.split('\n').some((rad) => /^[^:]+: \d+$/.test(rad)), false);
});

Deno.test('knappen i direktmejlet går till Ansökningar i adminvyn', () => {
  const m = renderaAdminPaminnelse({ ny_ansokan: 1, slag: 'direkt' })!;
  assertEquals(ADMIN_ANSOKNINGAR, `${SAJT}/admin#ansokningar`);
  assertStringIncludes(m.text, ADMIN_ANSOKNINGAR);
  assertStringIncludes(m.html, ADMIN_ANSOKNINGAR);
  assertStringIncludes(m.text, 'Öppna Ansökningar');
});

Deno.test('ett direktmejl utan en ansökan i raden ger inget mejl', () => {
  for (const antal of [
    { slag: 'direkt' },
    { ny_ansokan: 0, slag: 'direkt' },
    { ny_ansokan: 'många', slag: 'direkt' },
    // Intresseanmälan mejlas av lead-notis, inte härifrån.
    { ny_lead: 1, slag: 'direkt' },
    // Rader för morgonmejlet blir inget direktmejl.
    { fraga: 3, slag: 'direkt' },
  ]) {
    assertEquals(renderaAdminPaminnelse(antal), null);
  }
});

Deno.test('ett direktmejl tar inte med något annat som står i raden', () => {
  const m = renderaAdminPaminnelse({ ny_ansokan: 1, fraga: 4, rapport_obekraftad: 9, slag: 'direkt' })!;
  for (const ut of [m.text, m.html]) {
    assertEquals(/inkorgen|bekräftat/i.test(ut), false);
  }
});

// ---------- testmejlet ----------

Deno.test('ett testmejl är märkt som ett, i ämnet och i brevet', () => {
  const m = renderaAdminPaminnelse({ fraga: 2, uppgift: 1, slag: 'prov' })!;
  assertEquals(m.amne, '[Test] Väntar på er: 3 saker i Att göra');
  assertStringIncludes(m.text, 'Det här är ett testmejl');
  assertStringIncludes(m.html, 'Det här är ett testmejl');
  assertStringIncludes(m.text, 'Frågor i inkorgen: 2');
});

Deno.test('ett riktigt morgonmejl är aldrig märkt som test', () => {
  const m = renderaAdminPaminnelse(MORGON({ fraga: 2 }))!;
  assertEquals(m.amne.includes('Test'), false);
  assertEquals(/testmejl/i.test(m.text), false);
  assertEquals(/testmejl/i.test(m.html), false);
});

// ---------- gemensamt ----------

Deno.test('INGEN avregistreringslänk, i vare sig text eller HTML', () => {
  // Strömbrytaren är jobbet admin-paminnelse. En länk som lovar att sluta
  // mejla lovar något mejlet inte kan hålla.
  for (const antal of [MORGON({ fraga: 1 }), { ny_ansokan: 1, slag: 'direkt' }, { fraga: 1, slag: 'prov' }]) {
    const m = renderaAdminPaminnelse(antal)!;
    for (const ut of [m.text, m.html]) {
      assertEquals(ut.includes('/avanmal'), false);
      assertEquals(/sluta få mejl|ändra dina val/i.test(ut), false);
    }
  }
});

Deno.test('mejlen förklarar varför de kom, och nämner inga namn', () => {
  const m = renderaAdminPaminnelse(MORGON({ fraga: 1 }))!;
  assertStringIncludes(m.text, 'internt mejl till Nextrums ledning');
  assertStringIncludes(m.text, 'kl. 9');
  assertStringIncludes(m.text, 'Inga namn eller uppgifter står i mejlet');
  const d = renderaAdminPaminnelse({ ny_ansokan: 1, slag: 'direkt' })!;
  assertStringIncludes(d.text, 'internt mejl till Nextrums ledning');
  assertStringIncludes(d.text, 'direkt');
});

Deno.test('mejlen går också till info@, som aviseringen om en intresseanmälan', () => {
  assertEquals([...ADMIN_EXTRA_TILL], [KONTAKT]);
  assertEquals(KONTAKT, 'info@nextrum.se');
});

Deno.test('alla sorter har en etikett i ental och flertal, och inga två är lika', () => {
  const typer = new Set<string>();
  for (const s of ADMIN_SORTER) {
    assertEquals(typer.has(s.typ), false, `${s.typ} står två gånger`);
    typer.add(s.typ);
    assertEquals(s.ental.length > 0 && s.flertal.length > 0, true);
    // Varje sort kan ritas, i båda formerna.
    assertEquals(adminRader({ [s.typ]: 1 })[0].etikett.length > 0, true);
    assertEquals(adminRader({ [s.typ]: 2 })[0].etikett.length > 0, true);
  }
  assertEquals(typer.size, 10);
  assertEquals(typer.has('ny_lead') || typer.has('ny_ansokan'), false);
});
