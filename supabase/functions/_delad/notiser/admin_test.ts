// ============================================================
// NEXTRUM — prov: påminnelsen till admin
//
// Kör med:  deno test supabase/functions/_delad/
//
// Mejlet går till superadminarna och bär bara antal och sorter. Proven
// håller fast det som gör det säkert att skicka:
//
//   · inget ur databasens rader återges, bara antal vi själva räknat
//   · en sort vi inte känner igen tas inte med, och ger inget mejl om den
//     är den enda
//   · ingen avregistreringslänk: strömbrytaren är jobbet, inte mejlet
// ============================================================

import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { ADMIN_ADRESS, ADMIN_SORTER, adminRader, renderaAdminPaminnelse } from './admin.ts';
import { SAJT } from './rendera.ts';

Deno.test('ämnesraden räknar sakerna och böjer sak', () => {
  assertEquals(renderaAdminPaminnelse({ ny_lead: 1 })!.amne, 'Väntar på er: 1 sak i Att göra');
  assertEquals(
    renderaAdminPaminnelse({ ny_lead: 2, ny_ansokan: 1, rapport_obekraftad: 4 })!.amne,
    'Väntar på er: 7 saker i Att göra',
  );
});

Deno.test('varje sort står med sin etikett, i ental och flertal', () => {
  const ett = renderaAdminPaminnelse({ ny_ansokan: 1 })!;
  assertStringIncludes(ett.text, 'Ny jobbansökan: 1');
  const flera = renderaAdminPaminnelse({ ny_ansokan: 3 })!;
  assertStringIncludes(flera.text, 'Nya jobbansökningar: 3');
  assertStringIncludes(flera.html, 'Nya jobbansökningar');
});

Deno.test('raderna står i listans ordning, inte i den ordning databasen skrev dem', () => {
  const r = adminRader({ uppgift: 1, ny_lead: 2, faktura_obetald: 3 });
  assertEquals(r.map((x) => x.typ), ['ny_lead', 'faktura_obetald', 'uppgift']);
});

Deno.test('mejlet säger rapporten som familjen inte bekräftat', () => {
  const m = renderaAdminPaminnelse({ rapport_obekraftad: 2 })!;
  assertStringIncludes(m.text, 'Rapporter som familjerna inte bekräftat: 2');
});

Deno.test('knappen går till adminvyn och inget annat', () => {
  const m = renderaAdminPaminnelse({ ny_lead: 1 })!;
  assertEquals(ADMIN_ADRESS, `${SAJT}/admin#oversikt`);
  assertStringIncludes(m.text, ADMIN_ADRESS);
  assertStringIncludes(m.html, ADMIN_ADRESS);
  assertStringIncludes(m.text, 'Öppna Att göra');
});

Deno.test('en sort som inte finns, och ett antal som inte är ett heltal, hoppas över', () => {
  const m = renderaAdminPaminnelse({
    ny_lead: 2,
    '<script>': 5,
    okand_sort: 3,
    ny_ansokan: -1,
    sh_godkann: 0,
    fraga: 1.5,
    uppgift: 'många',
    utbetalning: 100_000,
  })!;
  assertEquals(adminRader({ ny_lead: 2 }).length, 1);
  assertStringIncludes(m.text, 'Nya intresseanmälningar: 2');
  for (const ut of [m.text, m.html]) {
    assertEquals(ut.includes('script'), false);
    assertEquals(ut.includes('okand_sort'), false);
    assertEquals(ut.includes('många'), false);
  }
  assertEquals(m.amne, 'Väntar på er: 2 saker i Att göra');
});

Deno.test('ett antal som kommer som text och ser ut som ett heltal räknas', () => {
  assertEquals(adminRader({ ny_lead: '3' }).map((x) => x.antal), [3]);
});

Deno.test('inga giltiga sorter ger inget mejl', () => {
  for (const v of [null, undefined, {}, [], 'ny_lead', 7, { okand: 1 }, { ny_lead: 0 }, [['ny_lead', 1]]]) {
    assertEquals(renderaAdminPaminnelse(v), null);
  }
});

Deno.test('ärvda egenskaper räknas inte som sorter', () => {
  // {}.constructor finns på varje objekt. Bara det som står i objektet självt får vara med.
  const arvt = Object.create({ ny_lead: 5 });
  assertEquals(renderaAdminPaminnelse(arvt), null);
});

Deno.test('INGEN avregistreringslänk, i vare sig text eller HTML', () => {
  // Strömbrytaren är jobbet admin-paminnelse. En länk som lovar att sluta
  // mejla lovar något mejlet inte kan hålla.
  const m = renderaAdminPaminnelse({ ny_lead: 1 })!;
  for (const ut of [m.text, m.html]) {
    assertEquals(ut.includes('/avanmal'), false);
    assertEquals(/sluta få mejl|ändra dina val/i.test(ut), false);
  }
});

Deno.test('mejlet förklarar varför det kom, och nämner inga namn', () => {
  const m = renderaAdminPaminnelse({ ny_lead: 1 })!;
  assertStringIncludes(m.text, 'superadmin');
  assertStringIncludes(m.text, 'Inga namn eller uppgifter står i mejlet');
});

Deno.test('alla sorter har en etikett i ental och flertal', () => {
  const typer = new Set<string>();
  for (const s of ADMIN_SORTER) {
    assertEquals(typer.has(s.typ), false, `${s.typ} står två gånger`);
    typer.add(s.typ);
    assertEquals(s.ental.length > 0 && s.flertal.length > 0, true);
    // Varje sort kan ritas, i båda formerna.
    assertEquals(adminRader({ [s.typ]: 1 })[0].etikett.length > 0, true);
    assertEquals(adminRader({ [s.typ]: 2 })[0].etikett.length > 0, true);
  }
  assertEquals(typer.size, 12);
});
