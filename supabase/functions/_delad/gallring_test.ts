// ============================================================
// NEXTRUM — tester för gallringen av ansökningar
//
// Kör med:  deno test supabase/functions/_delad/
//
// Det som provas är ordningen och att svaren läses: filen tas bort
// före raden, en fil som inte gick att ta bort lämnar raden kvar, och
// inget filnamn hamnar i loggen eller i svaret. Regeln för vad som är
// förfallet står i databasen och provas i verktyg/rls-test.sql.
// ============================================================

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { type Beroenden, type Borttagning, gallra, lagringsfel } from './gallring.ts';

/** En låtsasvärld: ansökningar med filer, en hink och en logg över anropen i ordning. */
function varld(o: {
  forfallna?: { ansokan_id: string; filer: string[] | null }[];
  foraldralosa?: string[];
  hink?: string[];
  lagringsfel?: (namn: string[]) => string | null;
  gallraSvar?: (id: string) => string;
  gallraKastar?: string[];
}) {
  const hink = new Set(o.hink ?? []);
  const anrop: string[] = [];
  const logg: string[] = [];
  const d: Beroenden = {
    forfallna: () => Promise.resolve(o.forfallna ?? []),
    foraldralosa: () => Promise.resolve(o.foraldralosa ?? []),
    taBort: (namn): Promise<Borttagning> => {
      anrop.push('taBort ' + namn.join(','));
      const fel = o.lagringsfel?.(namn) ?? null;
      if (fel) return Promise.resolve({ fel });
      const borttagna = namn.filter((n) => hink.delete(n));
      return Promise.resolve({ borttagna });
    },
    gallra: (id) => {
      anrop.push('gallra ' + id);
      if (o.gallraKastar?.includes(id)) return Promise.reject(new Error('databasen'));
      return Promise.resolve(o.gallraSvar ? o.gallraSvar(id) : 'borttagen');
    },
    logg: (rad) => logg.push(rad),
  };
  return { d, hink, anrop, logg };
}

Deno.test('filen tas bort före raden, och båda räknas', async () => {
  const v = varld({
    forfallna: [
      { ansokan_id: 'a1', filer: ['1-x-Alva_Berg_CV.pdf'] },
      { ansokan_id: 'a2', filer: [] },
    ],
    hink: ['1-x-Alva_Berg_CV.pdf'],
  });
  const s = await gallra(v.d);
  assertEquals(v.anrop, ['taBort 1-x-Alva_Berg_CV.pdf', 'gallra a1', 'gallra a2']);
  assertEquals(s, { ansokningar: 2, filer: 1, foraldralosa: 0, kvar: 0, fel: [] });
  assertEquals(v.hink.size, 0);
});

Deno.test('svarar Storage med fel rörs inte raden, och nästa ansökan tas ändå', async () => {
  const v = varld({
    forfallna: [
      { ansokan_id: 'a1', filer: ['1-x-Alva_Berg_CV.pdf'] },
      { ansokan_id: 'a2', filer: ['2-y-Bo_CV.pdf'] },
    ],
    hink: ['1-x-Alva_Berg_CV.pdf', '2-y-Bo_CV.pdf'],
    lagringsfel: (namn) => namn.includes('1-x-Alva_Berg_CV.pdf') ? 'Storage 500' : null,
  });
  const s = await gallra(v.d);
  assert(!v.anrop.includes('gallra a1'), 'raden får inte tas bort när filen står kvar');
  assert(v.anrop.includes('gallra a2'));
  assertEquals(s.ansokningar, 1);
  assertEquals(s.kvar, 1);
  assertEquals(s.fel.length, 1);
});

Deno.test('en Storage som kastar behandlas som ett fel, inte som en borttagen fil', async () => {
  const v = varld({ forfallna: [{ ansokan_id: 'a1', filer: ['1-x-CV.pdf'] }] });
  v.d.taBort = () => Promise.reject(new Error('nätet'));
  const s = await gallra(v.d);
  assert(!v.anrop.includes('gallra a1'));
  assertEquals(s.kvar, 1);
  assertEquals(s.ansokningar, 0);
});

Deno.test('en fil som redan var borta hindrar inte raden: databasen avgör', async () => {
  const v = varld({ forfallna: [{ ansokan_id: 'a1', filer: ['1-x-CV.pdf'] }], hink: [] });
  const s = await gallra(v.d);
  assertEquals(v.anrop, ['taBort 1-x-CV.pdf', 'gallra a1']);
  assertEquals(s.filer, 0);
  assertEquals(s.ansokningar, 1);
});

Deno.test('databasen som säger att filen finns kvar är ett fel och raden räknas som kvar', async () => {
  const v = varld({
    forfallna: [{ ansokan_id: 'a1', filer: ['1-x-CV.pdf'] }],
    hink: ['1-x-CV.pdf'],
    gallraSvar: () => 'filen_finns_kvar',
  });
  const s = await gallra(v.d);
  assertEquals(s.ansokningar, 0);
  assertEquals(s.kvar, 1);
  assertEquals(s.fel.length, 1);
});

Deno.test('ett steg sedan listan lästes, eller någon som hann före, är inget fel', async () => {
  const v = varld({
    forfallna: [{ ansokan_id: 'a1', filer: [] }, { ansokan_id: 'a2', filer: [] }],
    gallraSvar: (id) => id === 'a1' ? 'inte_forfallen' : 'finns_inte',
  });
  const s = await gallra(v.d);
  assertEquals(s, { ansokningar: 0, filer: 0, foraldralosa: 0, kvar: 0, fel: [] });
});

Deno.test('en databas som kastar på en rad stoppar inte nästa', async () => {
  const v = varld({
    forfallna: [{ ansokan_id: 'a1', filer: [] }, { ansokan_id: 'a2', filer: [] }],
    gallraKastar: ['a1'],
  });
  const s = await gallra(v.d);
  assertEquals(s.ansokningar, 1);
  assertEquals(s.kvar, 1);
  assertEquals(s.fel.length, 1);
});

Deno.test('ett okänt svar från databasen är ett fel', async () => {
  const v = varld({ forfallna: [{ ansokan_id: 'a1', filer: [] }], gallraSvar: () => 'null' });
  const s = await gallra(v.d);
  assertEquals(s.kvar, 1);
  assertEquals(s.fel.length, 1);
});

Deno.test('filer utan ansökan tas bort, och bara det som efterfrågades räknas', async () => {
  const v = varld({
    foraldralosa: ['9-z-Gammal.pdf', '8-z-Borta.pdf'],
    hink: ['9-z-Gammal.pdf', '7-z-Annan.pdf'],
  });
  v.d.taBort = (namn) => {
    v.anrop.push('taBort ' + namn.join(','));
    // Storage som svarar med mer än det fick: räknas inte.
    return Promise.resolve({ borttagna: ['9-z-Gammal.pdf', '7-z-Annan.pdf'] });
  };
  const s = await gallra(v.d);
  assertEquals(v.anrop, ['taBort 9-z-Gammal.pdf,8-z-Borta.pdf']);
  assertEquals(s.foraldralosa, 1);
  assertEquals(s.fel, []);
});

Deno.test('filer utan ansökan som inte gick att ta bort är ett fel', async () => {
  const v = varld({ foraldralosa: ['9-z-Gammal.pdf'], lagringsfel: () => 'Storage 403' });
  const s = await gallra(v.d);
  assertEquals(s.foraldralosa, 0);
  assertEquals(s.fel.length, 1);
});

Deno.test('ingenting förfallet betyder inga anrop till Storage', async () => {
  const v = varld({});
  const s = await gallra(v.d);
  assertEquals(v.anrop, []);
  assertEquals(s, { ansokningar: 0, filer: 0, foraldralosa: 0, kvar: 0, fel: [] });
});

Deno.test('när tiden är slut får resten vänta, och det är inget fel', async () => {
  const v = varld({
    forfallna: [{ ansokan_id: 'a1', filer: [] }, { ansokan_id: 'a2', filer: [] }, { ansokan_id: 'a3', filer: [] }],
    foraldralosa: ['9-z-Gammal.pdf'],
  });
  let tid = 0;
  v.d.klocka = () => tid;
  const gallraFörst = v.d.gallra;
  v.d.gallra = (id) => { tid += 30_000; return gallraFörst(id); };
  const s = await gallra(v.d, 40_000);
  assertEquals(v.anrop, ['gallra a1', 'gallra a2']);
  assertEquals(s.ansokningar, 2);
  assertEquals(s.kvar, 1);
  assertEquals(s.fel, []);
});

Deno.test('listan som inte går att läsa avbryter innan något tas bort', async () => {
  const v = varld({ hink: ['1-x-CV.pdf'] });
  v.d.forfallna = () => Promise.reject(new Error('databasen'));
  let kastade = false;
  try {
    await gallra(v.d);
  } catch {
    kastade = true;
  }
  assert(kastade);
  assertEquals(v.anrop, []);
});

Deno.test('inget filnamn i loggen eller i svaret, inte ens när något går fel', async () => {
  const namn = ['1-x-Alva_Berg_CV.pdf', '2-y-Bo_Ek_CV.docx', '3-z-Cilla_CV.pdf'];
  const v = varld({
    forfallna: [
      { ansokan_id: 'a1', filer: [namn[0]] },
      { ansokan_id: 'a2', filer: [namn[1]] },
    ],
    foraldralosa: [namn[2]],
    hink: namn,
    lagringsfel: (n) => n.includes(namn[1]) || n.includes(namn[2]) ? 'Storage 500' : null,
  });
  const s = await gallra(v.d);
  const allt = JSON.stringify(s) + '\n' + v.logg.join('\n');
  for (const n of namn) {
    assert(!allt.includes(n), n + ' står i loggen eller svaret');
    assert(!allt.includes(n.replace(/^\d+-[a-z]+-/, '').replace(/\.\w+$/, '')), 'namnet ur ' + n + ' står där');
  }
  assertEquals(s.fel.length, 2);
});

Deno.test('ett StorageError blir statuskoden, aldrig meddelandet', () => {
  assertEquals(lagringsfel({ status: 404, message: 'Object not found: 1-x-Alva_Berg_CV.pdf' }), 'Storage 404');
  assertEquals(lagringsfel(new Error('1-x-Alva_Berg_CV.pdf')), 'Storage svarade med fel');
  assertEquals(lagringsfel(null), 'Storage svarade med fel');
});
