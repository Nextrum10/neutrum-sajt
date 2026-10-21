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
import { renderaMejl, avregistreringsAdress, vyAdress, FARG, KONTAKT, LOGGA_URL, SAJT } from './rendera.ts';
import { renderaKvitto } from './kvitto.ts';
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

Deno.test('familjens bekräftelse och påminnelse säger hur passet betalas, studiehjälparens inte', () => {
  // Samma mening som villkoren och sidorna (2026-10-21): kort eller Klarna
  // så fort tiden är bekräftad, med Betala nu. Det gamla löftet att ett
  // obetalt pass inte hålls får inte stå kvar, och inte heller Betala i
  // förväg, som heter Betala nu.
  const VILLKORET = 'med kort eller Klarna så fort studiehjälparen har bekräftat tiden, och blir passet kortare '
    + 'än bokat betalar vi tillbaka mellanskillnaden';
  const bekraftat = rendera('pass_bekraftat', 'parent');
  assertStringIncludes(bekraftat.text, VILLKORET);
  // Fakturan är borta (2026-10-21): inget mejl erbjuder den.
  assertEquals(bekraftat.text.toLowerCase().includes('faktura'), false);
  assertEquals(bekraftat.text.includes('betala i förväg'), false);
  assertEquals(bekraftat.text.includes('hålls inte'), false);
  assertStringIncludes(bekraftat.text, `${SAJT}/foralder#betalning`);
  assertStringIncludes(bekraftat.html, 'Gå till betalningen');
  // Villkorat: ett betalt pass som flyttats och bekräftats igen får
  // samma mejl, och ska inte läsa det som en ny räkning.
  assertStringIncludes(bekraftat.text, 'om ni inte redan har gjort det');

  const paminnelse = rendera('paminnelse', 'parent');
  assertStringIncludes(paminnelse.text, 'om ni inte redan har gjort det');
  assertStringIncludes(paminnelse.text, VILLKORET);
  assertEquals(paminnelse.text.toLowerCase().includes('faktura'), false);
  assertEquals(paminnelse.text.includes('hålls inte'), false);

  for (const typ of ['pass_bekraftat', 'paminnelse', 'pass_nytt'] as const) {
    const hjalpare = rendera(typ, 'tutor');
    assertEquals(hjalpare.text.includes('betal'), false, `${typ} till studiehjälparen nämner betalning`);
  }
  assertEquals(vyAdress('parent', 'betalning'), `${SAJT}/foralder#betalning`);
  // kortdragningen_forsoker_igen (2026-10-21): ett nekat kort före passet leder dit kortet byts.
  assertEquals(vyAdress('parent', 'kortet'), `${SAJT}/foralder#profil/kort`);
  assertEquals(vyAdress('tutor', 'kortet'), `${SAJT}/larare#lektioner/pass`);
  assertEquals(vyAdress('tutor', 'betalning'), `${SAJT}/larare#lektioner/pass`);
});

Deno.test('den gamla fakturakoden ger kortmejlet, som en okänd kod (fakturan togs bort 2026-10-21)', () => {
  for (const kod of ['faktura', 'swish']) {
    const familj = rendera('pass_bekraftat', 'parent', { data: { ...SMUTSIG, status: 'confirmed', betalsatt: kod } });
    assertStringIncludes(familj.text, 'med kort', kod);
    assertEquals(familj.text.toLowerCase().includes('faktura'), false, kod);
  }
});

Deno.test('ett pass som timmarna betalat ber inte om betalning (Fas 22.2)', () => {
  for (const typ of ['pass_bekraftat', 'paminnelse', 'pass_nytt'] as const) {
    const familj = rendera(typ, 'parent', { data: { ...SMUTSIG, status: 'confirmed', betalsatt: 'timmar' } });
    assertStringIncludes(familj.text, 'betalt med timmarna ni köpt i förväg', typ);
    assertEquals(familj.text.includes('med kort'), false, `${typ} ber en familj med timmar betala med kort`);
    assertEquals(familj.text.includes('#betalning'), false, `${typ} leder till betalningen`);

    const hjalpare = rendera(typ, 'tutor', { data: { ...SMUTSIG, status: 'confirmed', betalsatt: 'timmar' } });
    assertEquals(hjalpare.text.includes('timmarna'), false, `${typ} till studiehjälparen nämner timmarna`);
  }
});

Deno.test('påminnelsen om timmarna säger hur många, vilken dag och att resten förfaller (Fas 21.2)', () => {
  const m = rendera('timmar_gar_ut', 'parent', { data: { ...SMUTSIG, datum: '2026-10-23', kvar: 3, klippkort: 'c16a' } });
  assertStringIncludes(m.amne, 'fredag 23 oktober');
  assertStringIncludes(m.text, 'Ni har 3 timmar kvar');
  assertStringIncludes(m.text, 'till och med fredag 23 oktober');
  assertStringIncludes(m.text, 'förfaller');
  assertStringIncludes(m.text, 'Timmar kvar: 3');
  assertStringIncludes(m.text, `${SAJT}/foralder#boka`);
  // Kortets id följer med i datan för dubbletternas skull, men läses aldrig.
  assertEquals(m.text.includes('c16a'), false);

  assertStringIncludes(rendera('timmar_gar_ut', 'parent', { data: { datum: '2026-10-23', kvar: 1 } }).text, 'Ni har 1 timme kvar');

  // Utan ett giltigt antal eller datum blir det ett mejl utan tal, inte "undefined" eller "NaN".
  const utan = rendera('timmar_gar_ut', 'parent', { data: { kvar: 'många', datum: 'snart' } });
  assertStringIncludes(utan.text, 'Ni har köpta timmar kvar som snart går ut.');
  assertEquals(/NaN|undefined|många/.test(utan.text), false);

  // Köpta timmar betalar vi tillbaka; det löftet är mejlets, inte gratistimmarnas.
  assertStringIncludes(m.text, 'betalar vi tillbaka resten');
  assertStringIncludes(m.text, 'timmar som går ut är påslaget');
});

Deno.test('påminnelsen om gratis timmar lovar inga pengar tillbaka (gratistimmarna_paminns)', () => {
  const m = rendera('timmar_gar_ut', 'parent', { data: { ...SMUTSIG, datum: '2026-10-23', kvar: 3, klippkort: 'c16a', gratis: true } });
  assertStringIncludes(m.amne, 'Era gratis timmar går ut fredag 23 oktober');
  assertStringIncludes(m.text, 'Ni har 3 gratis timmar kvar, och de gäller till och med fredag 23 oktober.');
  assertStringIncludes(m.text, 'så används de först');
  assertStringIncludes(m.text, 'förfaller och betalas inte ut');
  assertStringIncludes(m.text, 'Gratis timmar kvar: 3');
  assertStringIncludes(m.text, `${SAJT}/foralder#boka`);
  assertStringIncludes(m.text, 'timmar som går ut är påslaget');
  // En gåva betalas aldrig ut, och det är inga köpta timmar.
  for (const fel of ['betalar vi tillbaka', 'tillbaka resten', 'köpta', 'c16a']) {
    assertEquals(m.text.includes(fel), false, `gratismejlet säger "${fel}"`);
    assertEquals(m.html.includes(fel), false, `gratismejlets html säger "${fel}"`);
  }

  const en = rendera('timmar_gar_ut', 'parent', { data: { datum: '2026-10-23', kvar: 1, gratis: true } });
  assertStringIncludes(en.amne, 'Er gratis timme går ut fredag 23 oktober');
  assertStringIncludes(en.text, 'Ni har 1 gratis timme kvar, och den gäller till och med fredag 23 oktober.');
  assertStringIncludes(en.text, 'Boka ett pass innan dess, så används den först.');
  assertStringIncludes(en.text, 'En gratis timme som inte används förfaller och betalas inte ut.');

  // Utan ett giltigt antal eller datum: inga tal, och fortfarande inget löfte.
  const utan = rendera('timmar_gar_ut', 'parent', { data: { kvar: 'många', datum: 'snart', gratis: true } });
  assertStringIncludes(utan.amne, 'Era gratis timmar går snart ut');
  assertStringIncludes(utan.text, 'Ni har gratis timmar kvar som snart går ut.');
  assertEquals(/NaN|undefined|många|tillbaka/.test(utan.text), false);

  // "gratis" som text är inget gratis: då är det köptimmarnas mejl.
  const text = rendera('timmar_gar_ut', 'parent', { data: { datum: '2026-10-23', kvar: 2, gratis: 'true' } });
  assertStringIncludes(text.text, 'Ni har 2 timmar kvar');
});

Deno.test('ett nekat kort lovar ett nytt försök bara när vi gör ett (kortdragningen_forsoker_igen)', () => {
  const fore = { ...SMUTSIG, status: 'confirmed' };
  const igen = rendera('kort_nekat', 'parent', { data: { ...fore, kortet: 'igen' } });
  assertStringIncludes(igen.text, 'Kortet nekades när vi skulle reservera beloppet');
  assertStringIncludes(igen.text, 'Vi försöker igen om några timmar.');
  assertStringIncludes(igen.text, 'Byter ni kort i Nextrum försöker vi med det nya direkt.');
  assertStringIncludes(igen.text, `${SAJT}/foralder#profil/kort`);
  // Ett kort som gått ut, eller en bank som vill att familjen bekräftar: inget löfte.
  for (const kortet of ['nekat', 'bekrafta', undefined]) {
    const m = rendera('kort_nekat', 'parent', { data: { ...fore, kortet } });
    assertEquals(m.text.includes('Vi försöker igen'), false, `kortet ${kortet} lovar ett nytt försök`);
  }
  const bekrafta = rendera('kort_nekat', 'parent', { data: { ...fore, kortet: 'bekrafta' } });
  assertStringIncludes(bekrafta.text, 'Er bank vill att ni bekräftar betalningen själva');
  // Efter passet: till betalningen, och samma regel.
  const efter = rendera('kort_nekat', 'parent', { data: { ...SMUTSIG, status: 'completed', kortet: 'igen' } });
  assertStringIncludes(efter.text, 'när vi skulle dra betalningen för passet');
  assertStringIncludes(efter.text, 'Vi försöker igen om några timmar.');
  assertStringIncludes(efter.text, `${SAJT}/foralder#betalning`);
  // Passet står kvar: mejlet säger aldrig att det avbokas.
  assertEquals(/avboka/i.test(igen.text + efter.text), false);
});

Deno.test('tillägget för syskon: påminnelsen och kvittot säger belopp och pass, aldrig ett barns namn', () => {
  const pam = rendera('tillagg_paminnelse', 'parent', { data: { ...SMUTSIG, belopp: 20700, antal_pass: 2 } });
  assertStringIncludes(pam.amne, 'Upplupet tillägg för syskon: 207\u00a0kr');
  assertStringIncludes(pam.text, 'Ni har 207\u00a0kr i upplupet tillägg för syskon som varit med på 2 pass');
  assertStringIncludes(pam.text, 'Inget dras av sig självt.');
  assertStringIncludes(pam.text, `${SAJT}/foralder#betalning`);
  const kv = rendera('tillagg_kvitto', 'parent', { data: {
    ...SMUTSIG, belopp: 20700, antal_pass: 2,
    rader: [{ datum: '2026-10-14', barn: 2, belopp: 6900 }, { datum: '2026-10-15', barn: 3, belopp: 13800 }],
  } });
  assertStringIncludes(kv.amne, 'Kvitto: tillägg för syskon, 207\u00a0kr');
  assertStringIncludes(kv.text, '2 barn, 69\u00a0kr');
  assertStringIncludes(kv.text, '3 barn, 138\u00a0kr');
  for (const m of [pam, kv]) {
    // SMUTSIG bär elevens fullständiga namn: det finns inte i mejlen.
    assertEquals(m.text.includes('Alva') || m.html.includes('Alva'), false);
  }
  // Ören visas när de finns, och inget NaN utan belopp.
  const ore = rendera('tillagg_paminnelse', 'parent', { data: { belopp: 17250, antal_pass: 1 } });
  assertStringIncludes(ore.text, '172,50\u00a0kr');
  const tom = rendera('tillagg_paminnelse', 'parent', { data: {} });
  assertEquals(/NaN|undefined|null/.test(tom.text), false);
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
});

Deno.test('brevet är sajtens papper ända ut till kanten, utan ram runt', () => {
  // 2026-09-25: förut låg brevet som ett kort med kant och rundade
  // hörn på en mörkare yta, och mejlprogrammet lade sin egen vita yta
  // runt det. Nu är hela brevet papper. Det måste stå på body för
  // Apple Mail OCH som bgcolor på yttertabellen för Gmail, som kastar
  // body-stilen: saknas något av dem är det vitt i det programmet, och
  // det syns inte i webbläsaren man provar i.
  for (const m of [rendera('pass_bekraftat', 'parent'), rendera('paminnelse', 'tutor', { prov: 'provmejl' }),
    renderaKvitto('Anna')]) {
    assertStringIncludes(m.html, `<body bgcolor="${FARG.papper}"`);
    assertStringIncludes(m.html, `width="100%" bgcolor="${FARG.papper}" style="background:${FARG.papper}"`);
    assertEquals(/border:\s*1px/.test(m.html), false, 'en kant i brevet');
  }
});

Deno.test('loggan är den riktiga, och den kan inte spåra någon', () => {
  // Fas 16.1: loggan är en PNG från nextrum.se, inte längre ett N i
  // systemtypsnittet. Det som gör en bild i ett mejl till en
  // spårningspixel är att adressen skiljer sig per mottagare. Den här
  // är samma för alla — ingen fråga, inget id, ingen annan värd — och
  // det är den enda bilden i mejlet.
  for (const m of [rendera('meddelande', 'parent'), rendera('pass_nytt', 'tutor'), renderaKvitto('Anna')]) {
    const bilder = m.html.match(/<img\b[^>]*>/g) ?? [];
    assertEquals(bilder.length, 1, 'exakt en bild: loggan');
    const bild = bilder[0] ?? '';
    assertStringIncludes(bild, `src="${LOGGA_URL}"`);
    assertEquals(LOGGA_URL.startsWith(`${SAJT}/`), true);
    assertEquals(LOGGA_URL.includes('?'), false);
    // Fasta mått, så att brevet inte hoppar när bilden laddar, och
    // tom alt: ordet Nextrum står bredvid som text, och en skärmläsare
    // ska inte läsa det två gånger.
    assertStringIncludes(bild, 'width="32"');
    assertStringIncludes(bild, 'height="32"');
    assertStringIncludes(bild, 'alt=""');
    // Med bilder avstängda står namnet kvar som text.
    assertStringIncludes(m.html, '>Nextrum</a>');
  }
});
