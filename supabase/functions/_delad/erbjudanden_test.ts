import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  arErbjudandekod, extraTimmar, familjerabattPaKop, kanAteranvandas, kassarad, kassaradForUpplagg, kassaradTillPlanen,
  saljs, SALJS_INTE, sammaInnehall,
  svensktDatum,
  manadensForsta,
  planensPeriod,
  planManad,
} from './erbjudanden.ts';

Deno.test('erbjudandekoden: bara katalogens form släpps in', () => {
  assertEquals(arErbjudandekod('klipp10'), true);
  assertEquals(arErbjudandekod('standard'), true);
  assertEquals(arErbjudandekod('plan_standard'), true);
  assertEquals(arErbjudandekod(''), false);
  assertEquals(arErbjudandekod('Klipp10'), false);
  assertEquals(arErbjudandekod("klipp10'; drop"), false);
  assertEquals(arErbjudandekod(10), false);
  assertEquals(arErbjudandekod('a'.repeat(33)), false);
});

Deno.test('bara planerna säljs: Fyll timbanken nekas med ett svenskt besked (2026-10-22)', () => {
  assertEquals(saljs({ sort: 'plan' }), true);
  assertEquals(saljs({ sort: 'klippkort' }), false);
  // En okänd sort, eller ingen rad alls, säljs inte heller.
  assertEquals(saljs({ sort: 'paket' }), false);
  assertEquals(saljs(null), false);
  assertEquals(saljs(undefined), false);
  assertEquals(SALJS_INTE.startsWith('Fyll timbanken går inte att köpa längre.'), true);
  assertEquals(/Timmar ni redan har köpt gäller som förut\.$/.test(SALJS_INTE), true);
  // Inga tankstreck i det familjen läser.
  assertEquals(/[\u2013\u2014]/.test(SALJS_INTE), false);
});

Deno.test('kassaraden säger timmar, rabatt och hur länge det gäller', () => {
  const basic = { kod: 'plan_basic', sort: 'plan', namn: 'Basic', timmar: 4, rabatt_procent: 5,
    giltig_manader: 1, timpris_ore: 39900, pris_ore: 151600, timmar_pa_kopet: 0 };
  assertEquals(kassarad(basic).name, 'Basic');
  assertEquals(kassarad(basic).description, '4 timmar läxhjälp, 5 % rabatt. Gäller i 30 dagar från köpet.');
  assertEquals(kassarad({ ...basic, sort: 'klippkort', namn: 'Klippkort 100 timmar', timmar: 100, rabatt_procent: 5, giltig_manader: 18 })
    .description, '100 timmar läxhjälp, 5 % rabatt. Gäller i 18 månader från köpet.');
  // Standard sedan 2026-10-08: 5 % som de andra, ingen timme på köpet.
  assertEquals(kassarad({ ...basic, kod: 'plan_standard', namn: 'Standard', timmar: 8, pris_ore: 303200 }).description,
    '8 timmar läxhjälp, 5 % rabatt. Gäller i 30 dagar från köpet.');
  // Före planerna (2026-10-07) fanns ingen kolumn: raden är densamma som förut.
  const utan = { kod: 'plan_basic', sort: 'plan', namn: 'Basic', timmar: 4, rabatt_procent: 5,
    giltig_manader: 1, timpris_ore: 37900, pris_ore: 144000 };
  assertEquals(kassarad(utan).description, '4 timmar läxhjälp, 5 % rabatt. Gäller i 30 dagar från köpet.');
});

Deno.test('kassaraden säger rabattkoden när köpet har en (2026-10-13)', () => {
  const basic = { kod: 'plan_basic', sort: 'plan', namn: 'Basic', timmar: 4, rabatt_procent: 5,
    giltig_manader: 1, timpris_ore: 39900, pris_ore: 151600, timmar_pa_kopet: 0 };
  assertEquals(kassarad(basic, 'VAR10').description,
    '4 timmar läxhjälp, 5 % rabatt. Gäller i 30 dagar från köpet. Med rabattkoden VAR10.');
  // Utan kod är raden densamma som förut, också med null.
  assertEquals(kassarad(basic, null).description, kassarad(basic).description);
  // En partnerkod utan rabatt (2026-10-21) gör inte beloppet lägre: raden säger bara koden.
  assertEquals(kassarad(basic, 'FORENING', 0, null, 0).description,
    '4 timmar läxhjälp, 5 % rabatt. Gäller i 30 dagar från köpet. Med koden FORENING.');
  assertEquals(kassarad(basic, 'VAR10', 0, null, 15160).description,
    '4 timmar läxhjälp, 5 % rabatt. Gäller i 30 dagar från köpet. Med rabattkoden VAR10.');
});

Deno.test('kassaraden säger familjens rabatt, aldrig koden (familjerabatter, 2026-10-15)', () => {
  const basic = { kod: 'plan_basic', sort: 'plan', namn: 'Basic', timmar: 4, rabatt_procent: 5,
    giltig_manader: 1, timpris_ore: 39900, pris_ore: 151600, timmar_pa_kopet: 0 };
  assertEquals(kassarad(basic, null, 1000).description,
    '4 timmar läxhjälp, 5 % rabatt. Gäller i 30 dagar från köpet. Med er rabatt på 10 kr per timme.');
  // Med en rabattkod ovanpå står båda, rabatten först.
  assertEquals(kassarad(basic, 'VAR10', 1000).description,
    '4 timmar läxhjälp, 5 % rabatt. Gäller i 30 dagar från köpet. Med er rabatt på 10 kr per timme. Med rabattkoden VAR10.');
  // Noll är ingen rabatt, och raden är densamma som förut.
  assertEquals(kassarad(basic, null, 0).description, kassarad(basic).description);
});

Deno.test('familjens rabatt på ett köp: varje betald timme, och bara när ett pris blir kvar', () => {
  const standard = { timmar: 8, timmar_pa_kopet: 0, rabatterat_timpris_ore: 37900 };
  assertEquals(familjerabattPaKop(standard, 1000), { perTimme: 1000, summa: 8000 });
  // En timme på köpet kostar inget, och får ingen rabatt.
  assertEquals(familjerabattPaKop({ ...standard, timmar_pa_kopet: 1 }, 1000), { perTimme: 1000, summa: 7000 });
  assertEquals(familjerabattPaKop(standard, 0), { perTimme: 0, summa: 0 });
  assertEquals(familjerabattPaKop(standard, 37900), { perTimme: 0, summa: 0 });
  // Ett äldre svar utan timpriset ger ingen rabatt i stället för en gissning.
  assertEquals(familjerabattPaKop({ timmar: 8, timmar_pa_kopet: 0 }, 1000), { perTimme: 0, summa: 0 });
});

// Standard hade en timme på köpet 2026-10-07–08. Katalogen har ingen i dag,
// men kassan ska fortfarande säga det rätt om en plan får en igen.
Deno.test('kassaraden säger timmen på köpet och aldrig 0 % rabatt (planerna, 2026-10-07)', () => {
  const standard = { kod: 'plan_standard', sort: 'plan', namn: 'Standard', timmar: 8, rabatt_procent: 0,
    giltig_manader: 1, timpris_ore: 37900, pris_ore: 265300, timmar_pa_kopet: 1 };
  assertEquals(kassarad(standard).name, 'Standard');
  assertEquals(kassarad(standard).description,
    '8 timmar läxhjälp för priset av 7 (1 timme på köpet). Gäller i 30 dagar från köpet.');
  // Båda på en gång, om katalogen någon gång får det.
  assertEquals(kassarad({ ...standard, timmar: 12, timmar_pa_kopet: 2, rabatt_procent: 5 }).description,
    '12 timmar läxhjälp för priset av 10 (2 timmar på köpet), 5 % rabatt. Gäller i 30 dagar från köpet.');
  // Ingenting av någondera: bara timmarna.
  assertEquals(kassarad({ ...standard, timmar_pa_kopet: 0 }).description,
    '8 timmar läxhjälp. Gäller i 30 dagar från köpet.');
  // Fler timmar på köpet än det finns kan databasen inte ha; raden lovar ändå aldrig ett gratis köp.
  assertEquals(kassarad({ ...standard, timmar_pa_kopet: 9 }).description,
    '8 timmar läxhjälp för priset av 1 (7 timmar på köpet). Gäller i 30 dagar från köpet.');
});

Deno.test('ett väntande köp återanvänds bara med samma pris och inom ett dygn', () => {
  const nu = new Date('2026-09-25T12:00:00Z');
  const kop = { begart_ore: 360000, created_at: '2026-09-25T10:00:00Z' };
  assertEquals(kanAteranvandas(kop, 360000, nu), true);
  // priset har ändrats sedan dess: ett nytt köp
  assertEquals(kanAteranvandas(kop, 370000, nu), false);
  // för gammalt: kassan hos Stripe har gått ut
  assertEquals(kanAteranvandas({ ...kop, created_at: '2026-09-24T12:00:00Z' }, 360000, nu), false);
  assertEquals(kanAteranvandas(null, 360000, nu), false);
});

Deno.test('ett väntande köp återanvänds bara med samma innehåll, inte bara samma pris (2026-10-07)', () => {
  const std = { timmar: 8, timmar_pa_kopet: 1, rabatt_procent: 0, giltig_manader: 1 };
  assertEquals(sammaInnehall({ ...std }, std), true);
  // 9 för 7 kostar lika mycket som 8 för 7, men är inte samma köp.
  assertEquals(sammaInnehall({ ...std }, { ...std, timmar: 9, timmar_pa_kopet: 2 }), false);
  assertEquals(sammaInnehall({ ...std, rabatt_procent: 5 }, std), false);
  assertEquals(sammaInnehall({ ...std, giltig_manader: 6 }, std), false);
  // Före migrationen saknas kolumnen på båda sidor och räknas som 0.
  assertEquals(sammaInnehall({ timmar: 4, rabatt_procent: 10, giltig_manader: 1 },
    { timmar: 4, rabatt_procent: 10, giltig_manader: 1 }), true);
  assertEquals(sammaInnehall(null, std), false);
});

Deno.test('timmar till planen: bara ett heltal mellan 1 och 20 (2026-10-14)', () => {
  assertEquals(extraTimmar(1), 1);
  assertEquals(extraTimmar(20), 20);
  assertEquals(extraTimmar('7'), 7);
  assertEquals(extraTimmar(0), null);
  assertEquals(extraTimmar(21), null);
  assertEquals(extraTimmar(2.5), null);
  assertEquals(extraTimmar('2.5'), null);
  assertEquals(extraTimmar('3; drop'), null);
  assertEquals(extraTimmar(null), null);
  assertEquals(extraTimmar(undefined), null);
  assertEquals(extraTimmar(Number.NaN), null);
});

Deno.test('raden för timmar till planen säger planens timpris och planens sista dag', () => {
  const x = { plan_namn: 'Standard', timmar: 3, rabatterat_timpris_ore: 37900, giltigt_till: '2026-11-03' };
  assertEquals(kassaradTillPlanen(x).name, 'Extra timmar till Standard');
  assertEquals(kassaradTillPlanen(x).description,
    '3 timmar läxhjälp till planens timpris, 379 kr i timmen. Gäller till och med 3 november 2026, samma dag som planen.');
  assertEquals(kassaradTillPlanen({ ...x, timmar: 1 }).description.startsWith('1 timme läxhjälp'), true);
  assertEquals(kassaradTillPlanen({ ...x, plan_namn: '' }).name, 'Extra timmar till planen');
  // Familjens rabatt (familjerabatter, 2026-10-15): timpriset efter den står också.
  assertEquals(kassaradTillPlanen({ ...x, familjerabatt_ore: 1000 }).description,
    '3 timmar läxhjälp till planens timpris, 379 kr i timmen, med er rabatt 369 kr. '
      + 'Gäller till och med 3 november 2026, samma dag som planen.');
  assertEquals(kassaradTillPlanen({ ...x, familjerabatt_ore: 0 }).description, kassaradTillPlanen(x).description);
});

Deno.test('datumet på svenska, och ett datum i fel form står som det är', () => {
  assertEquals(svensktDatum('2026-01-09'), '9 januari 2026');
  assertEquals(svensktDatum('2026-12-31'), '31 december 2026');
  assertEquals(svensktDatum('2026-13-01'), '2026-13-01');
  assertEquals(svensktDatum('igår'), 'igår');
});

Deno.test('planens månad: bara den här eller nästa (2026-10-21)', () => {
  assertEquals(planManad('denna'), 'denna');
  assertEquals(planManad('nasta'), 'nasta');
  assertEquals(planManad('2026-12'), null);
  assertEquals(planManad(undefined), null);
});

Deno.test('planens första dag räknas i Stockholms tid, också över ett årsskifte', () => {
  // 23.30 UTC den 31 oktober är redan den 1 november i Stockholm.
  assertEquals(manadensForsta('denna', new Date('2026-10-31T23:30:00Z')), '2026-11-01');
  assertEquals(manadensForsta('nasta', new Date('2026-10-31T23:30:00Z')), '2026-12-01');
  assertEquals(manadensForsta('denna', new Date('2026-10-20T10:00:00Z')), '2026-10-01');
  assertEquals(manadensForsta('nasta', new Date('2026-12-15T10:00:00Z')), '2027-01-01');
  // Sommartid: 22.30 UTC den 30 juni är 00.30 den 1 juli i Stockholm.
  assertEquals(manadensForsta('denna', new Date('2027-06-30T22:30:00Z')), '2027-07-01');
});

Deno.test('planens period är hela kalendermånaden', () => {
  assertEquals(planensPeriod('2026-11-01'), '1–30 november 2026');
  assertEquals(planensPeriod('2028-02-01'), '1–29 februari 2028');
  assertEquals(planensPeriod('2026-12-01'), '1–31 december 2026');
  assertEquals(planensPeriod('2026-11-15'), '2026-11-15');
});

Deno.test('kassaraden säger planens månad när planen har en', () => {
  const e = { kod: 'plan_standard', sort: 'plan', namn: 'Standard', timmar: 8, rabatt_procent: 5, giltig_manader: 1,
    timpris_ore: 39900, pris_ore: 303200, timmar_pa_kopet: 0, rabatterat_timpris_ore: 37900 };
  assertEquals(kassarad(e, null, 0, '2026-11-01').description,
    '8 timmar läxhjälp, 5 % rabatt. Gäller 1–30 november 2026.');
  // Utan månad som förut.
  assertEquals(kassarad(e).description, '8 timmar läxhjälp, 5 % rabatt. Gäller i 30 dagar från köpet.');
});

// ---------- ett eget upplägg (egna_upplagg, 2026-10-27) ----------

Deno.test('upplägget: namnet, timmarna, timpriset och att det gäller som en plan', () => {
  assertEquals(kassaradForUpplagg({ namn: 'Höstlovet', timmar: 6, timpris_ore: 34900 }), {
    name: 'Eget upplägg: Höstlovet',
    description: '6 timmar läxhjälp, 349 kr i timmen. Gäller i 30 dagar från köpet, som en plan.',
  });
  assertEquals(kassaradForUpplagg({ namn: ' ', timmar: 1, timpris_ore: 37900 }).name, 'Eget upplägg');
  assertEquals(kassaradForUpplagg({ namn: 'x', timmar: 1, timpris_ore: 37900 }).description.startsWith('1 timme läxhjälp'), true);
});

Deno.test('upplägget: familjens rabatt står på raden när den lämnar ett pris kvar', () => {
  assertEquals(kassaradForUpplagg({ namn: 'Lov', timmar: 4, timpris_ore: 30000, familjerabatt_ore: 1000 }).description,
    '4 timmar läxhjälp, 300 kr i timmen, med er rabatt 290 kr. Gäller i 30 dagar från köpet, som en plan.');
  assertEquals(kassaradForUpplagg({ namn: 'Lov', timmar: 4, timpris_ore: 30000, familjerabatt_ore: 30000 }).description,
    kassaradForUpplagg({ namn: 'Lov', timmar: 4, timpris_ore: 30000 }).description);
});
