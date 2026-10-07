import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { arErbjudandekod, kanAteranvandas, kassarad } from './erbjudanden.ts';

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

Deno.test('kassaraden säger timmar, rabatt och hur länge det gäller', () => {
  const basic = { kod: 'plan_basic', sort: 'plan', namn: 'Basic', timmar: 4, rabatt_procent: 5,
    giltig_manader: 1, timpris_ore: 37900, pris_ore: 144000, timmar_pa_kopet: 0 };
  assertEquals(kassarad(basic).name, 'Basic');
  assertEquals(kassarad(basic).description, '4 timmar läxhjälp, 5 % rabatt. Gäller i 1 månad från köpet.');
  assertEquals(kassarad({ ...basic, namn: 'Klippkort 100 timmar', timmar: 100, rabatt_procent: 5, giltig_manader: 18 })
    .description, '100 timmar läxhjälp, 5 % rabatt. Gäller i 18 månader från köpet.');
  // Före planerna (2026-10-07) fanns ingen kolumn: raden är densamma som förut.
  const utan = { kod: 'plan_basic', sort: 'plan', namn: 'Basic', timmar: 4, rabatt_procent: 5,
    giltig_manader: 1, timpris_ore: 37900, pris_ore: 144000 };
  assertEquals(kassarad(utan).description, '4 timmar läxhjälp, 5 % rabatt. Gäller i 1 månad från köpet.');
});

Deno.test('kassaraden säger timmen på köpet och aldrig 0 % rabatt (planerna, 2026-10-07)', () => {
  const standard = { kod: 'plan_standard', sort: 'plan', namn: 'Standard', timmar: 8, rabatt_procent: 0,
    giltig_manader: 1, timpris_ore: 37900, pris_ore: 265300, timmar_pa_kopet: 1 };
  assertEquals(kassarad(standard).name, 'Standard');
  assertEquals(kassarad(standard).description,
    '8 timmar läxhjälp för priset av 7 (1 timme på köpet). Gäller i 1 månad från köpet.');
  // Båda på en gång, om katalogen någon gång får det.
  assertEquals(kassarad({ ...standard, timmar: 12, timmar_pa_kopet: 2, rabatt_procent: 5 }).description,
    '12 timmar läxhjälp för priset av 10 (2 timmar på köpet), 5 % rabatt. Gäller i 1 månad från köpet.');
  // Ingenting av någondera: bara timmarna.
  assertEquals(kassarad({ ...standard, timmar_pa_kopet: 0 }).description,
    '8 timmar läxhjälp. Gäller i 1 månad från köpet.');
  // Fler timmar på köpet än det finns kan databasen inte ha; raden lovar ändå aldrig ett gratis köp.
  assertEquals(kassarad({ ...standard, timmar_pa_kopet: 9 }).description,
    '8 timmar läxhjälp för priset av 1 (7 timmar på köpet). Gäller i 1 månad från köpet.');
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
