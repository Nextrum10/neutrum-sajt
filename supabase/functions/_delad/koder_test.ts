// Koderna i kassan (koder_for_planer, 2026-10-21): bara planer, databasens
// svar prövas, och rabatten räknas som intern.rabattkod_prova gör.
// Ingen databas och inget nät: Kodklient är en falsk.
import { assertEquals } from 'jsr:@std/assert@1';
import {
  fragaOmKoden, KOD_BARA_PLAN, KOD_FINNS_INTE, KOD_GICK_INTE, KOD_GRATIS, type Kodklient, type Kodsvar,
  kodenGallerKopet, kodPaFelBetalning, normaliseraKod, planensKod, provaKodsvaret, rabattenPa,
} from './koder.ts';

// Standard i katalogen: 8 timmar à 379 kr.
const PRIS = 303200;

/** En falsk databas som svarar per kod, och minns vad den fick. */
function falskDb(svar: Record<string, Kodsvar | 'fel' | 'saknas'>, utanNyaFunktionen = false) {
  const anrop: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const db: Kodklient = {
    rpc(fn, args) {
      anrop.push({ fn, args });
      if (fn === 'kod_pa_planen' && utanNyaFunktionen) {
        return Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'saknas' } });
      }
      const s = svar[String(args.p_kod)] ?? 'saknas';
      if (s === 'fel') return Promise.resolve({ data: null, error: { code: '57014', message: 'timeout' } });
      if (s === 'saknas') return Promise.resolve({ data: [], error: null });
      if (fn === 'kolla_rabattkod_kop') {
        const { rabatt_typ: _t, rabatt_varde: _v, ...gamla } = s;
        return Promise.resolve({ data: [gamla], error: null });
      }
      return Promise.resolve({ data: [s], error: null });
    },
  };
  return { db, anrop };
}

const giltig = (rabatt: number, typ: string | null, varde: number | null): Kodsvar => ({
  giltig: true, orsak: null, rabatt_ore: rabatt, pris_ore: PRIS, att_betala_ore: PRIS - rabatt,
  rabatt_typ: typ, rabatt_varde: varde,
});
const nej = (orsak: string): Kodsvar => ({
  giltig: false, orsak, rabatt_ore: 0, pris_ore: PRIS, att_betala_ore: PRIS, rabatt_typ: null, rabatt_varde: null,
});

const PLAN = { kod: 'plan_standard', sort: 'plan' };

Deno.test('koden skrivs som databasen lagrar den, och något annat är ingen kod', () => {
  assertEquals(normaliseraKod('  zayan-10 '), 'ZAYAN-10');
  assertEquals(normaliseraKod(''), null);
  assertEquals(normaliseraKod('   '), null);
  assertEquals(normaliseraKod(null), null);
  assertEquals(normaliseraKod(undefined), null);
  assertEquals(normaliseraKod('ab'), false);
  assertEquals(normaliseraKod('ÅÄÖ123'), false);
  assertEquals(normaliseraKod('A'.repeat(25)), false);
  assertEquals(normaliseraKod('KOD 10'), false);
  assertEquals(normaliseraKod(10), false);
});

Deno.test('en kod nekas på ett pass, ett tillägg, kortet och timmar till planen', () => {
  assertEquals(kodPaFelBetalning({ pass: 'b1', rabattkod: 'ZAYAN10' }), KOD_BARA_PLAN);
  assertEquals(kodPaFelBetalning({ pass: 'b1', tillagg: true, rabattkod: 'ZAYAN10' }), KOD_BARA_PLAN);
  assertEquals(kodPaFelBetalning({ kort: 'spara', rabattkod: 'zayan10' }), KOD_BARA_PLAN);
  assertEquals(kodPaFelBetalning({ erbjudande: 'plan_extra', timmar: 3, rabattkod: 'ZAYAN10' }), KOD_BARA_PLAN);
  // En kod som inte ens har formen nekas också: familjen skrev något i rutan.
  assertEquals(kodPaFelBetalning({ pass: 'b1', rabattkod: '?' }), KOD_BARA_PLAN);
  // Utan kod, eller på en plan, säger den inget.
  assertEquals(kodPaFelBetalning({ pass: 'b1' }), null);
  assertEquals(kodPaFelBetalning({ pass: 'b1', rabattkod: '  ' }), null);
  assertEquals(kodPaFelBetalning({ erbjudande: 'plan_basic', rabattkod: 'ZAYAN10' }), null);
  assertEquals(kodPaFelBetalning(null), null);
});

Deno.test('bara en plan tar en kod, aldrig Fyll timbanken eller timmar till planen', () => {
  assertEquals(kodenGallerKopet({ kod: 'plan_basic', sort: 'plan' }), true);
  assertEquals(kodenGallerKopet({ kod: 'klipp10', sort: 'klippkort' }), false);
  assertEquals(kodenGallerKopet({ kod: 'plan_extra', sort: 'klippkort' }), false);
  assertEquals(kodenGallerKopet({ kod: 'plan_extra', sort: 'plan' }), false);
  assertEquals(kodenGallerKopet({ kod: 'plan_eget', sort: 'plan' }), false);
  assertEquals(kodenGallerKopet(null), false);
});

// Samma exempel som rls-test.sql avsnitt 46 räknar i databasen.
Deno.test('rabatten: procent nedåt till hel öre, kronor som de är, noll, och aldrig över priset', () => {
  assertEquals(rabattenPa('procent', 10, PRIS), 30320);
  assertEquals(rabattenPa('procent', 10, 151599), 15159);
  assertEquals(rabattenPa('procent', 0, PRIS), 0);
  assertEquals(rabattenPa('procent', 100, PRIS), PRIS);
  assertEquals(rabattenPa('belopp', 10000, PRIS), 10000);
  assertEquals(rabattenPa('belopp', 5000, PRIS), 5000);
  assertEquals(rabattenPa('belopp', 0, PRIS), 0);
  assertEquals(rabattenPa('belopp', 99999900, PRIS), PRIS);
  assertEquals(rabattenPa('belopp', -100, PRIS), 0);
  assertEquals(rabattenPa('procent', 10, -5), 0);
});

Deno.test('databasens svar: procent, kronor och noll går igenom med beloppet', () => {
  assertEquals(provaKodsvaret(giltig(30320, 'procent', 10)), { ok: true, pris: PRIS, rabatt: 30320, attBetala: 272880 });
  assertEquals(provaKodsvaret(giltig(10000, 'belopp', 10000)), { ok: true, pris: PRIS, rabatt: 10000, attBetala: 293200 });
  // En partnerkod utan rabatt: priset är detsamma, och koden räknas.
  assertEquals(provaKodsvaret(giltig(0, 'procent', 0)), { ok: true, pris: PRIS, rabatt: 0, attBetala: PRIS });
  // PostgREST skickar bigint som tal; en sträng med siffror läses som tal.
  assertEquals(provaKodsvaret({ ...giltig(10000, 'belopp', 10000), rabatt_ore: '10000', pris_ore: String(PRIS),
                                att_betala_ore: '293200' }),
               { ok: true, pris: PRIS, rabatt: 10000, attBetala: 293200 });
});

Deno.test('databasens svar: en kod som inte gäller säger databasens skäl', () => {
  for (const orsak of ['Koden har gått ut.', 'Koden gäller från 2026-11-01.', 'Koden är slut.', KOD_FINNS_INTE,
                       'Ni har redan använt koden. Den gäller en gång per familj.', KOD_BARA_PLAN, KOD_GRATIS]) {
    assertEquals(provaKodsvaret(nej(orsak)), { ok: false, status: 409, fel: orsak });
  }
  assertEquals(provaKodsvaret(null), { ok: false, status: 409, fel: KOD_GICK_INTE });
});

Deno.test('databasens svar: en rabatt över eller lika med priset blir ett nej, aldrig ett gratis köp', () => {
  assertEquals(provaKodsvaret(giltig(PRIS, 'procent', 100)), { ok: false, status: 409, fel: KOD_GRATIS });
  assertEquals(provaKodsvaret({ ...giltig(PRIS + 1, 'belopp', PRIS + 1), att_betala_ore: -1 }),
               { ok: false, status: 409, fel: KOD_GRATIS });
});

Deno.test('databasens svar: rabatten som inte stämmer med typen och värdet öppnar ingen kassa', () => {
  // Databasen säger tio procent men drar hundra kronor: något har glidit isär.
  assertEquals(provaKodsvaret(giltig(10000, 'procent', 10)), { ok: false, status: 409, fel: KOD_GICK_INTE });
  // Det som ska betalas går inte ihop med priset och rabatten.
  assertEquals(provaKodsvaret({ ...giltig(30320, 'procent', 10), att_betala_ore: PRIS }),
               { ok: false, status: 409, fel: KOD_GICK_INTE });
  // Ett svar utan tal.
  assertEquals(provaKodsvaret({ ...giltig(30320, 'procent', 10), rabatt_ore: null }),
               { ok: false, status: 409, fel: KOD_GICK_INTE });
  // Före migrationen saknas typen och värdet: då prövas bara att beloppen går ihop.
  assertEquals(provaKodsvaret(giltig(30320, null, null)), { ok: true, pris: PRIS, rabatt: 30320, attBetala: 272880 });
});

Deno.test('planens kod: utan kod frågas inte databasen', async () => {
  const { db, anrop } = falskDb({});
  assertEquals(await planensKod(db, '', PLAN), { ok: true, kod: null });
  assertEquals(await planensKod(db, undefined, PLAN), { ok: true, kod: null });
  assertEquals(anrop.length, 0);
});

Deno.test('planens kod: en kod utan form och en kod på Fyll timbanken nekas före databasen', async () => {
  const { db, anrop } = falskDb({ ZAYAN10: giltig(30320, 'procent', 10) });
  assertEquals(await planensKod(db, 'x', PLAN), { ok: false, status: 409, fel: KOD_FINNS_INTE });
  assertEquals(await planensKod(db, 'ZAYAN10', { kod: 'klipp10', sort: 'klippkort' }),
               { ok: false, status: 409, fel: KOD_BARA_PLAN });
  assertEquals(anrop.length, 0);
});

Deno.test('planens kod: en giltig kod på en plan ger databasens belopp, med koden i versaler', async () => {
  const { db, anrop } = falskDb({ ZAYAN10: giltig(30320, 'procent', 10), FORENING: giltig(0, 'procent', 0) });
  assertEquals(await planensKod(db, ' zayan10', PLAN),
               { ok: true, kod: 'ZAYAN10', pris: PRIS, rabatt: 30320, attBetala: 272880 });
  assertEquals(await planensKod(db, 'FORENING', PLAN),
               { ok: true, kod: 'FORENING', pris: PRIS, rabatt: 0, attBetala: PRIS });
  assertEquals(anrop.map((a) => a.fn), ['kod_pa_planen', 'kod_pa_planen']);
  assertEquals(anrop[0].args, { p_kod: 'ZAYAN10', p_erbjudande: 'plan_standard' });
});

Deno.test('planens kod: databasens nej, ett fel och ett tomt svar', async () => {
  const { db } = falskDb({ GAMMAL: nej('Koden har gått ut.'), STOR: nej(KOD_GRATIS), TRASIG: 'fel' });
  assertEquals(await planensKod(db, 'GAMMAL', PLAN), { ok: false, status: 409, fel: 'Koden har gått ut.' });
  assertEquals(await planensKod(db, 'STOR', PLAN), { ok: false, status: 409, fel: KOD_GRATIS });
  assertEquals(await planensKod(db, 'TRASIG', PLAN), { ok: false, status: 409, fel: KOD_GICK_INTE });
  assertEquals(await planensKod(db, 'OKAND', PLAN), { ok: false, status: 409, fel: KOD_GICK_INTE });
});

Deno.test('planens kod: före migrationen frågas kolla_rabattkod_kop, och beloppen prövas ändå', async () => {
  const { db, anrop } = falskDb({ ZAYAN10: giltig(30320, 'procent', 10) }, true);
  assertEquals(await planensKod(db, 'ZAYAN10', PLAN),
               { ok: true, kod: 'ZAYAN10', pris: PRIS, rabatt: 30320, attBetala: 272880 });
  assertEquals(anrop.map((a) => a.fn), ['kod_pa_planen', 'kolla_rabattkod_kop']);
  const svar = await fragaOmKoden(db, 'ZAYAN10', 'plan_standard');
  assertEquals(svar?.rabatt_typ, undefined);
});
