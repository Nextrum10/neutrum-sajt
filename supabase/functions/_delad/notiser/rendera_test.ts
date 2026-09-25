// ============================================================
// NEXTRUM — prov: mallarna och ramen runt dem
//
// Kör med:  deno test supabase/functions/_delad/
//
// Två sorters prov, och det andra är det som betyder något.
//
// Det första är att varje mejlbar typ faktiskt går att rendera, i
// båda rollerna, med både text och HTML. Ett mejl utan text/plain
// väger tyngre i varje skräppostfilter som finns.
//
// Det andra är LÄCKAGEPROVET. Det matar in en rad där varje fält är
// fyllt med en text som aldrig får nå en inkorg — en meddelandetext
// om ett barn, en hemadress, ett telefonnummer — och letar efter den
// i utdata för VARJE typ och VARJE roll. Faller det är det inte
// mallen som är fel, det är att någon lagt till ett fält i renData.
// ============================================================

import { assertEquals, assertStringIncludes, assertThrows } from 'jsr:@std/assert@1';
import { renderaMejl, avregistreringsAdress, vyAdress, KONTAKT, SAJT } from './rendera.ts';
import { MEJLBARA, type Roll } from './typer.ts';

const NU = new Date('2026-10-13T09:00:00Z');
const TOKEN = 'nagon-token-som-inte-provas-har';

/** En rad där varje fält bär något som inte får synas i ett mejl. */
const SMUTSIG = {
  datum: '2026-10-14',
  tid: '16:30',
  fran_datum: '2026-10-12',
  fran_tid: '15:00',
  amne: 'Matematik',
  elev: 'Alva Efternamnsson',
  studiehjalpare: 'Tove Efternamnsson',
  fran: 'Tove Efternamnsson',
  status: 'requested',
  timmar: 2,
  // Inget av det här får nå en inkorg.
  body: 'Alva har svårt med bråk och blir ledsen av läxorna',
  note: 'Ring mamma först, pappa vet inte om det',
  location: 'Storgatan 4, 3 tr, Stockholm',
  telefon: '070-123 45 67',
  epost: 'anna@example.se',
  diagnos: 'utreds för dyslexi',
};

const FORBJUDET = [
  'svårt med bråk', 'blir ledsen', 'Ring mamma', 'pappa vet inte',
  'Storgatan', '070-123', 'example.se', 'dyslexi', 'Efternamnsson',
];

function rendera(typ: string, roll: Roll, extra: Record<string, unknown> = {}) {
  return renderaMejl({
    typ, roll, fornamn: 'Anna', antal: 1, data: SMUTSIG,
    token: TOKEN, prov: 'nej', nu: NU, ...extra,
  });
}

Deno.test('varje mejlbar typ renderas i båda rollerna, med ämne, text och HTML', () => {
  for (const typ of MEJLBARA) {
    for (const roll of ['parent', 'tutor'] as Roll[]) {
      const m = rendera(typ, roll);
      const vem = `${typ}/${roll}`;

      assertEquals(m.amne.length > 0, true, `${vem}: tom ämnesrad`);
      assertEquals(m.amne.length < 120, true, `${vem}: ämnesraden är för lång`);
      assertEquals(m.amne.includes('undefined'), false, `${vem}: undefined i ämnet`);

      assertEquals(m.text.length > 0, true, `${vem}: ingen textversion`);
      assertEquals(m.text.includes('undefined'), false, `${vem}: undefined i texten`);

      assertStringIncludes(m.html, '<!doctype html>', `${vem}`);
      assertStringIncludes(m.html, '</html>');
      assertEquals(m.html.includes('undefined'), false, `${vem}: undefined i HTML`);
    }
  }
});

Deno.test('LÄCKAGE: inget ur raden utanför vitlistan når vare sig text eller HTML', () => {
  for (const typ of MEJLBARA) {
    for (const roll of ['parent', 'tutor'] as Roll[]) {
      const m = rendera(typ, roll);
      for (const hemligt of FORBJUDET) {
        assertEquals(m.text.includes(hemligt), false, `${typ}/${roll}: "${hemligt}" i textversionen`);
        assertEquals(m.html.includes(hemligt), false, `${typ}/${roll}: "${hemligt}" i HTML`);
        assertEquals(m.amne.includes(hemligt), false, `${typ}/${roll}: "${hemligt}" i ämnesraden`);
      }
    }
  }
});

Deno.test('förnamnen kommer med, efternamnen inte', () => {
  const m = rendera('pass_nytt', 'parent');
  assertStringIncludes(m.text, 'Hej Anna,');
  assertStringIncludes(m.text, 'Tove');
  assertEquals(m.text.includes('Efternamnsson'), false);
});

Deno.test('studiehjälparen ser eleven, familjen ser studiehjälparen', () => {
  // Faktarutan ska inte visa mottagaren för sig själv.
  const till_familj = rendera('pass_nytt', 'parent');
  assertStringIncludes(till_familj.text, 'Studiehjälpare: Tove');

  const till_hjalpare = rendera('pass_nytt', 'tutor');
  assertEquals(till_hjalpare.text.includes('Studiehjälpare:'), false);
  assertStringIncludes(till_hjalpare.text, 'Elev: Alva');
});

Deno.test('varje mejl har en knapp till rätt vy, och bara en', () => {
  const familj = rendera('meddelande', 'parent');
  assertStringIncludes(familj.text, `${SAJT}/foralder#meddelanden`);

  const hjalpare = rendera('meddelande', 'tutor');
  assertStringIncludes(hjalpare.text, `${SAJT}/larare#meddelanden`);

  const pass = rendera('paminnelse', 'parent');
  assertStringIncludes(pass.text, `${SAJT}/foralder#lektioner/pass`);

  assertEquals(vyAdress('tutor', 'val'), `${SAJT}/larare#profil/notiser`);
  // Boka pass finns bara i föräldravyn.
  assertEquals(vyAdress('parent', 'boka'), `${SAJT}/foralder#boka`);
  assertEquals(vyAdress('tutor', 'boka'), `${SAJT}/larare#lektioner/pass`);
});

Deno.test('familjens bekräftelse och påminnelse säger att passet betalas före, studiehjälparens inte', () => {
  // Villkor 3 och 4 för spärren "ingen betalning, inget pass"
  // (DEPLOY-BETALNING.md 9.9). Meningen är samma som på sidorna.
  const bekraftat = rendera('pass_bekraftat', 'parent');
  assertStringIncludes(bekraftat.text, 'Ett pass som inte är betalt hålls inte.');
  assertStringIncludes(bekraftat.text, `${SAJT}/foralder#betalning`);
  assertStringIncludes(bekraftat.html, 'Gå till betalningen');
  // Villkorat: ett betalt pass som flyttats och bekräftats igen får
  // samma mejl, och ska inte läsa det som en ny räkning.
  assertStringIncludes(bekraftat.text, 'om ni inte redan har gjort det');

  const paminnelse = rendera('paminnelse', 'parent');
  assertStringIncludes(paminnelse.text, 'om ni inte redan har gjort det');
  assertStringIncludes(paminnelse.text, 'Ett pass som inte är betalt hålls inte.');

  for (const typ of ['pass_bekraftat', 'paminnelse', 'pass_nytt'] as const) {
    const hjalpare = rendera(typ, 'tutor');
    assertEquals(hjalpare.text.includes('betal'), false, `${typ} till studiehjälparen nämner betalning`);
  }
  assertEquals(vyAdress('parent', 'betalning'), `${SAJT}/foralder#betalning`);
  assertEquals(vyAdress('tutor', 'betalning'), `${SAJT}/larare#lektioner/pass`);
});

Deno.test('ett fakturapass får inget kortmejl (Fas 14.6)', () => {
  for (const typ of ['pass_bekraftat', 'paminnelse', 'pass_nytt'] as const) {
    const familj = rendera(typ, 'parent', { data: { ...SMUTSIG, status: 'confirmed', betalsatt: 'faktura' } });
    assertStringIncludes(familj.text, 'månadens faktura', typ);
    assertEquals(familj.text.includes('med kort'), false, `${typ} ber en fakturafamilj betala med kort`);
    assertEquals(familj.text.includes('Ett pass som inte är betalt hålls inte'), false, typ);
    assertEquals(familj.text.includes('#betalning'), false, `${typ} leder till betalningen`);

    const hjalpare = rendera(typ, 'tutor', { data: { ...SMUTSIG, status: 'confirmed', betalsatt: 'faktura' } });
    assertEquals(hjalpare.text.includes('faktura'), false, `${typ} till studiehjälparen nämner fakturan`);
  }
  // En okänd kod är samma sak som ingen kod: kortmejlet.
  assertStringIncludes(rendera('pass_bekraftat', 'parent', { data: { ...SMUTSIG, betalsatt: 'swish' } }).text, 'med kort');
});

Deno.test('foten säger varför mejlet kom, hur man slutar få det, och vart man skriver', () => {
  const m = rendera('meddelande', 'parent');
  assertStringIncludes(m.text, 'Du får det här för att du har ett konto på Nextrum');
  assertStringIncludes(m.text, 'nya meddelanden är påslaget');
  assertStringIncludes(m.text, `${SAJT}/avanmal?t=`);
  assertStringIncludes(m.text, 'Ändra dina val');
  assertStringIncludes(m.text, KONTAKT);

  assertStringIncludes(m.html, `${SAJT}/avanmal?t=`);
  assertStringIncludes(m.html, 'Sluta få mejl om det här');
});

Deno.test('i sandlådan märks ämnet och avregistreringslänken pekar inte på någon', () => {
  // Någon annan än mottagaren läser provet. En äkta länk där hade
  // stängt av familjens mejl.
  const m = rendera('meddelande', 'parent', { prov: 'sandlada', token: null });
  assertStringIncludes(m.amne, '[Prov till familj]');
  assertStringIncludes(m.text, 'Länken för att sluta få mejl är avstängd i provet');
  assertStringIncludes(m.text, `${SAJT}/avanmal`);
  assertEquals(m.text.includes('/avanmal?t='), false, 'ingen token i en sandlådelänk');

  const hjalpare = rendera('meddelande', 'tutor', { prov: 'provmejl' });
  assertStringIncludes(hjalpare.amne, '[Prov till studiehjälpare]');

  assertEquals(avregistreringsAdress(null), `${SAJT}/avanmal`);
});

Deno.test('flera meddelanden blir ett mejl som säger hur många', () => {
  const ett = renderaMejl({ typ: 'meddelande', roll: 'parent', fornamn: 'Anna', antal: 1,
    data: { fran: 'Tove' }, token: TOKEN, prov: 'nej', nu: NU });
  assertStringIncludes(ett.amne, 'Nytt meddelande');

  const flera = renderaMejl({ typ: 'meddelande', roll: 'parent', fornamn: 'Anna', antal: 4,
    data: { fran: 'Tove' }, token: TOKEN, prov: 'nej', nu: NU });
  assertStringIncludes(flera.amne, '4 nya meddelanden');
  assertStringIncludes(flera.text, 'Läs meddelandena');
});

Deno.test('passändringar säger vad som hänt, aldrig vem som gjorde det', () => {
  // När admin ändrar ett pass får BÅDA parterna notisen, och då hade
  // "Tove har flyttat passet" varit fel för den ena. Texterna är
  // därför passiva: "Passet har flyttats", inte "X flyttade passet".
  //
  // Provet letar efter ett NAMN som handlande subjekt, inte efter
  // verben i sig — "har flyttats" är precis det vi vill ha.
  for (const typ of ['pass_flyttat', 'pass_avbokat', 'pass_avbojt'] as const) {
    for (const roll of ['parent', 'tutor'] as Roll[]) {
      const m = rendera(typ, roll);
      for (const namn of ['Tove', 'Alva']) {
        assertEquals(
          new RegExp(`${namn}\\s+(har|hade|flyttade|avbokade|avböjde|ändrade)\\b`).test(m.text),
          false,
          `${typ}/${roll}: ${namn} står som den som gjorde något`,
        );
      }
      // Namnet får däremot stå i faktarutan och i "passet med Tove".
      assertEquals(m.text.includes('Tove') || m.text.includes('Alva'), true,
        `${typ}/${roll}: namnet får finnas, bara inte som handlande`);
    }
  }
});

Deno.test('meddelandemallen är den enda som säger vem, för där är det avsändaren', () => {
  // Här är "vem" inte en handling på ett pass utan vem som skrev, och
  // mottagaren är alltid den andra parten.
  const m = rendera('meddelande', 'parent');
  assertStringIncludes(m.text, 'Tove har skrivit till dig');
  assertStringIncludes(m.text, 'Själva texten läser du där, inte i mejlet');
});

Deno.test('ett avbokat pass säger skälet med våra ord och leder till en ny tid', () => {
  const familj = rendera('pass_avbokat', 'parent', { data: { ...SMUTSIG, status: 'cancelled', skal: 'sjukdom' } });
  assertStringIncludes(familj.text, 'Skäl');
  assertStringIncludes(familj.text, 'Sjukdom');
  assertStringIncludes(familj.text, 'Föreslå en ny tid');
  assertStringIncludes(familj.text, `${SAJT}/foralder#boka`);

  // Studiehjälparen föreslår inte pass själv — familjen gör det. Knappen
  // leder därför till chatten.
  const hjalpare = rendera('pass_avbokat', 'tutor', { data: { ...SMUTSIG, status: 'cancelled', skal: 'forhinder' } });
  assertStringIncludes(hjalpare.text, 'Förhinder');
  assertStringIncludes(hjalpare.text, `${SAJT}/larare#meddelanden`);

  // Avslutar familjen finns ingen ny tid att föreslå.
  const slut = rendera('pass_avbokat', 'parent', { data: { ...SMUTSIG, status: 'cancelled', skal: 'familjen_avslutar' } });
  assertEquals(slut.text.includes('Föreslå en ny tid'), false);
  assertStringIncludes(slut.text, `${SAJT}/foralder#lektioner/pass`);

  // En text i stället för en kod når aldrig mejlet.
  const fritext = rendera('pass_avbokat', 'parent', { data: { ...SMUTSIG, skal: 'Alva har ont i magen' } });
  assertEquals(fritext.text.includes('ont i magen'), false);
  assertEquals(fritext.text.includes('Skäl'), false);
});

Deno.test('avböjt och avbokat är olika besked', () => {
  const avbokat = rendera('pass_avbokat', 'parent');
  const avbojt = rendera('pass_avbojt', 'parent');
  assertStringIncludes(avbokat.text, 'avbokat');
  assertStringIncludes(avbojt.text, 'avböjd');
  assertEquals(avbokat.amne === avbojt.amne, false);
});

Deno.test('ett namn med HTML i blir text, inte markup', () => {
  const m = renderaMejl({
    typ: 'meddelande', roll: 'parent', fornamn: 'Anna', antal: 1,
    data: { fran: '<b>Tove</b>' }, token: TOKEN, prov: 'nej', nu: NU,
  });
  // fornamn() plockar redan bort taggtecknen, och esc() fångar resten.
  assertEquals(m.html.includes('<b>Tove</b>'), false);
});

Deno.test('en typ som inte mejlas renderas inte', () => {
  // rapport står i notis_typer men inte i notis_mejlbara.
  assertThrows(() => renderaMejl({
    typ: 'rapport', roll: 'parent', fornamn: 'Anna', antal: 1,
    data: {}, token: TOKEN, prov: 'nej', nu: NU,
  }));
  assertThrows(() => renderaMejl({
    typ: 'pass_installt', roll: 'parent', fornamn: 'Anna', antal: 1,
    data: {}, token: TOKEN, prov: 'nej', nu: NU,
  }));
});

Deno.test('mörkt läge är avstängt och typsnittet är systemets', () => {
  // Gmail och Outlook färgar annars om bakgrunden och lämnar texten
  // kvar: bark på bark är ett tomt mejl.
  const m = rendera('meddelande', 'parent');
  assertStringIncludes(m.html, 'content="light only"');
  // Ingen extern begäran ur ett mejl: ett typsnitt från en annan
  // server är en spårningspixel.
  assertEquals(m.html.includes('fonts.googleapis.com'), false);
  assertEquals(m.html.includes('<img'), false, 'loggan ritas som text');
});
