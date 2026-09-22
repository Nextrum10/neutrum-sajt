// ============================================================
// NEXTRUM — prov: vad som får följa med ut i ett mejl
//
// Kör med:  deno test supabase/functions/_delad/
//
// renData() och fornamn() ÄR sekretessen i notismejlen. Allt annat i
// systemet — mallarna, ramen, foten — kan skrivas om utan att något
// läcker, så länge de två håller. Därför provas de på det som
// faktiskt står i raderna: en förälder som skriver "Elsa behöver
// hjälp med matten" i meddelanderutan, och ett efternamn i full_name.
//
// Provet är skrivet så att det går sönder när någon LÄGGER TILL ett
// fält i renData utan att tänka efter: vitlistan jämförs som en hel
// nyckelmängd, inte fält för fält.
// ============================================================

import { assertEquals, assertNotEquals } from 'jsr:@std/assert@1';
import {
  antalOk, arKanal, arMejlbar, arNotisTyp, fornamn, MEJLBARA,
  NOTIS_TYPER, renData, tillRoll,
} from './typer.ts';

Deno.test('renData släpper bara igenom de vitlistade fälten', () => {
  const rad = renData({
    datum: '2026-10-14',
    tid: '16:30:00',
    amne: 'Matematik',
    elev: 'Alva Berg',
    studiehjalpare: 'Tove Lind',
    // Allt nedanför ska inte finnas i svaret.
    body: 'Elsa behöver hjälp med matten inför provet',
    note: 'Ring mamma på 070-123 45 67',
    location: 'Hemma hos familjen, Storgatan 4',
    efternamn: 'Berg',
    epost: 'anna@example.se',
  });

  assertEquals(rad.datum, '2026-10-14');
  assertEquals(rad.tid, '16:30');
  assertEquals(rad.elev, 'Alva');
  assertEquals(rad.studiehjalpare, 'Tove');

  // Nycklarna, som mängd. Lägger någon till ett fält i RenData faller
  // det här provet, och den som lägger till det får läsa kommentaren
  // överst innan det går igenom.
  assertEquals(Object.keys(rad).sort(), [
    'amne', 'datum', 'elev', 'fran', 'franDatum', 'franTid',
    'prov', 'status', 'studiehjalpare', 'tid', 'timmar',
  ]);

  // Ingen av texterna finns kvar någonstans i svaret.
  const allt = JSON.stringify(rad);
  for (const hemligt of ['behöver hjälp', 'Ring mamma', '070', 'Storgatan', 'Berg', 'example.se']) {
    assertEquals(allt.includes(hemligt), false, `${hemligt} följde med ut`);
  }
});

Deno.test('renData tar bara datum och tider som verkligen finns', () => {
  assertEquals(renData({ datum: '2026-02-30' }).datum, null, 'den 30 februari finns inte');
  assertEquals(renData({ datum: '2026-02-28' }).datum, '2026-02-28');
  assertEquals(renData({ datum: '2026-2-3' }).datum, null, 'kräver nollor');
  assertEquals(renData({ datum: 'imorgon' }).datum, null);
  assertEquals(renData({ tid: '24:00' }).tid, null);
  assertEquals(renData({ tid: '23:59' }).tid, '23:59');
  assertEquals(renData({ tid: '9:30' }).tid, null, 'kräver nollor');
  assertEquals(renData({ fran_datum: '2026-10-01', fran_tid: '08:00' }).franDatum, '2026-10-01');
  assertEquals(renData({ fran_datum: '2026-10-01', fran_tid: '08:00' }).franTid, '08:00');
});

Deno.test('renData tar bara kända statusar, timmar inom dygnsgränserna och prov som exakt true', () => {
  assertEquals(renData({ status: 'confirmed' }).status, 'confirmed');
  assertEquals(renData({ status: 'nagot_annat' }).status, null);
  assertEquals(renData({ timmar: 3 }).timmar, 3);
  assertEquals(renData({ timmar: '3' }).timmar, 3);
  assertEquals(renData({ timmar: 0 }).timmar, null);
  assertEquals(renData({ timmar: 169 }).timmar, null);
  assertEquals(renData({ timmar: 1.5 }).timmar, null);
  assertEquals(renData({ prov: true }).prov, true);
  assertEquals(renData({ prov: 'true' }).prov, false, 'bara boolean true räknas');
});

Deno.test('renData tål skräp i stället för ett objekt', () => {
  for (const skrap of [null, undefined, 'text', 42, []]) {
    const r = renData(skrap);
    assertEquals(r.datum, null);
    assertEquals(r.prov, false);
  }
});

Deno.test('fornamn kapar till första ordet och lämnar inget som blir en länk', () => {
  assertEquals(fornamn('Tove Lind'), 'Tove');
  assertEquals(fornamn('  Tove   Lind  '), 'Tove');
  assertEquals(fornamn('Anna-Karin Ek'), 'Anna-Karin');
  assertEquals(fornamn('José'), 'José');

  // Det här är hela skälet till regeln: full_name är fritext, och ett
  // "namn" som ser ut som en adress blir annars klickbart i Gmail, i
  // ett mejl från vår egen domän med godkänd DKIM.
  assertEquals(fornamn('anna@evil.com'), 'annaevilcom');
  assertEquals(fornamn('nextrum.se/betala'), 'nextrumsebetala');
  // Ingen tagg, ingen parentes, ingen siffra blir kvar. Hela strängen
  // räknas som ett ord eftersom den saknar mellanslag.
  assertEquals(fornamn('<script>alert(1)</script>'), 'scriptalertscript');
  assertEquals(fornamn('Tove <script>'), 'Tove');

  assertEquals(fornamn('070-1234567'), null, 'ett ord utan bokstav är inget namn');
  assertEquals(fornamn(''), null);
  assertEquals(fornamn(null), null);
  assertEquals(fornamn(42), null);
  assertEquals(fornamn('A'.repeat(50)), 'A'.repeat(30), 'kapas till 30 tecken');
});

Deno.test('ämnet går genom samma förnamnsregel, och tappar därmed sin kurskod', () => {
  // Inte vackert, men medvetet: ämnet kommer ur en rad någon skrivit,
  // och regeln är densamma för all text som når ett mejl. Konsekvensen
  // är att "Matte 1c" blir "Matte". Ändras det ska det ändras som ett
  // beslut, inte för att någon tyckte att provet var i vägen.
  assertEquals(renData({ amne: 'Matematik' }).amne, 'Matematik');
  assertEquals(renData({ amne: 'Matte 1c' }).amne, 'Matte');
  assertEquals(renData({ amne: 'Svenska som andraspråk' }).amne, 'Svenska');
});

Deno.test('antalOk är aldrig under 1 och aldrig över 999', () => {
  assertEquals(antalOk(1), 1);
  assertEquals(antalOk(7), 7);
  assertEquals(antalOk(0), 1);
  assertEquals(antalOk(-3), 1);
  assertEquals(antalOk(5000), 999);
  assertEquals(antalOk(null), 1);
  assertEquals(antalOk('4'), 4);
  assertEquals(antalOk('fyra'), 1);
});

Deno.test('tillRoll läser allt som inte är tutor som familj', () => {
  assertEquals(tillRoll('tutor'), 'tutor');
  assertEquals(tillRoll('parent'), 'parent');
  assertEquals(tillRoll('admin'), 'parent');
  assertEquals(tillRoll(null), 'parent');
});

Deno.test('rapport finns som notistyp men mejlas aldrig', () => {
  assertEquals(arNotisTyp('rapport'), true);
  assertEquals(arMejlbar('rapport'), false, 'rapporten syns bara i vyn');

  // Listorna står också i databasen (notis_typer, notis_mejlbara).
  // Ändras den ena ska den andra ändras i samma ändring.
  assertEquals(NOTIS_TYPER.length, 8);
  assertEquals(MEJLBARA.length, 7);
  for (const t of MEJLBARA) assertEquals(arNotisTyp(t), true, `${t} saknas i NOTIS_TYPER`);

  assertEquals(arNotisTyp('pass_installt'), false);
  assertEquals(arMejlbar(''), false);
  assertEquals(arKanal('mejl'), true);
  assertEquals(arKanal('sms'), true);
  assertEquals(arKanal('brev'), false);
});

Deno.test('de två listorna är inte samma lista', () => {
  // Ett prov som faller om någon "städar" genom att låta MEJLBARA
  // peka på NOTIS_TYPER. Då börjar rapporten mejlas.
  assertNotEquals(NOTIS_TYPER.length, MEJLBARA.length);
});
