import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { arErbjudandekod, kanAteranvandas, kassarad } from './erbjudanden.ts';

Deno.test('erbjudandekoden: bara katalogens form släpps in', () => {
  assertEquals(arErbjudandekod('klipp10'), true);
  assertEquals(arErbjudandekod('standard'), true);
  assertEquals(arErbjudandekod(''), false);
  assertEquals(arErbjudandekod('Klipp10'), false);
  assertEquals(arErbjudandekod("klipp10'; drop"), false);
  assertEquals(arErbjudandekod(10), false);
  assertEquals(arErbjudandekod('a'.repeat(33)), false);
});

Deno.test('kassaraden säger timmar, rabatt och hur länge det gäller', () => {
  const plan = { kod: 'standard', sort: 'plan', namn: 'Standardplan', timmar: 4, rabatt_procent: 10,
    giltig_manader: 1, timpris_ore: 37900, pris_ore: 136400 };
  assertEquals(kassarad(plan).name, 'Standardplan');
  assertEquals(kassarad(plan).description, '4 timmar läxhjälp, 10 % rabatt. Gäller i 1 månad från köpet.');
  assertEquals(kassarad({ ...plan, namn: 'Klippkort 100 timmar', timmar: 100, rabatt_procent: 5, giltig_manader: 18 })
    .description, '100 timmar läxhjälp, 5 % rabatt. Gäller i 18 månader från köpet.');
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
