// ============================================================
// NEXTRUM — prisräkningen för fakturering (Fas 5)
//
// Allt fakturering/index.ts räknar ut, som rena funktioner: in med
// passen, katalogen och timpenningarna, ut med raderna och svaret.
// Ingen databas och inget nätverk här, så att varje öre går att
// testa (pris_test.ts) — förut satt räkningen inne i Deno.serve och
// hade inte ett enda test.
//
// PRISLOGIKEN ÄR DENSAMMA SOM FÖRUT (planens avsnitt D):
//   · tjänstens timpris, eller standardtjänstens om passets saknar pris
//   · ett FAST tillägg per timme när fler än ett barn sitter med
//   · rabatten är fryst vid bokningen och sänker aldrig ersättningen
//   · ersättningen räknar inte med tillägget för flera barn
// pris_test.ts jämför med en ordagrann kopia av den gamla koden.
//
// NYTT I FAS 5, och noll för läxhjälp:
//   · RUT dras av på rader vars tjänst är RUT-berättigad — bara om
//     kunden har skatteuppgifter och det finns ett tak för året.
//     Annars 0, och kunden eller året listas i svaret.
//   · Ersättningen: tjänstens (tjanster.ersattning_per_timme_ore) när
//     den är satt, annars studiehjälparens egen timpenning — så som
//     kolumnen och adminvyn beskriver den. Läxhjälp har ingen.
//   · RUT avrundas NEDÅT till hela kronor. Skatteverket tar emot
//     begäran i hela kronor, och avdraget får aldrig bli större än
//     andelen.
// ============================================================

import { MANADER } from './konstanter.ts';

export type Tjanst = {
  kod: string;
  aktiv?: boolean | null;
  for_kund?: boolean | null;
  ordning?: number | null;
  pris_per_timme_ore: number | null;
  extra_personer_ore: number | null;
  ersattning_per_timme_ore?: number | null;
  rut_berattigad?: boolean | null;
  rut_procent?: number | null;
};

export type Pass = {
  id: string;
  subject: string | null;
  tjanst: string | null;
  wanted_date: string;
  duration_min: number | null;
  parent_id: string | null;
  tutor_id: string | null;
  antal_barn: number | null;
  rabatt_ore: number | null;
  fakturerbar: boolean;
  har_rapport: boolean;
  fakturerad: boolean;
  pa_underlag: boolean;
  // Fas 14.0. Valfri i typen med flit: en anropare som inte hämtar
  // kolumnen ska få samma beteende som förut, inte ett undantag.
  betalning_status?: string | null;
};

// Lägen där kortvägen RÖRT passet. Ett sådant pass får inte hamna på
// familjens månadsfaktura automatiskt:
//
//   betald      — pengarna är dragna. En fakturarad är en andra debitering.
//   vantar      — en checkout-session är öppen. Fakturerar vi nu och
//                 betalningen landar om en minut har familjen betalat två
//                 gånger, och ingen av vägarna vet om den andra.
//   aterbetald  — pengar har gått tillbaka. VARFÖR de gjorde det är ett
//                 beslut någon tagit, och avbokningspolicyn är inte
//                 skriven. Att automatiskt fakturera beloppet igen vore
//                 att riva det beslutet.
//   tvist       — familjen bestrider. Att skicka en faktura mitt i en
//                 tvist är det sämsta svaret på den.
//
// 'ingen' och 'misslyckad' är inte med: då finns ingen betalning, och
// passet ska faktureras precis som förut.
export const KORTVAGEN_HAR_RORT = new Set(['vantar', 'betald', 'aterbetald', 'tvist']);

export function kortvagenRorde(b: Pass): boolean {
  return KORTVAGEN_HAR_RORT.has(String(b.betalning_status ?? 'ingen'));
}

export type Rad = {
  booking_id: string;
  beskrivning: string;
  minuter: number;
  belopp_ore: number;
  timpris_ore: number;
  rut_ore: number;
};

// Ören, aldrig flyttal. Math.round sist så att 90 minuter à 379 kr
// blir 56850 och inte 56849.999999.
export function belopp(minuter: number, timprisOre: number): number {
  return Math.round((minuter / 60) * timprisOre);
}

// Tillägget för flera barn är EN summa per timme, inte en per barn:
// två syskon och tre syskon kostar lika mycket extra. Regeln och
// beloppet står i tjanster (schema-v20), inte här.
export function familjebelopp(
  minuter: number,
  timprisOre: number,
  extraOre: number,
  antalBarn: number,
): number {
  const tim = timprisOre + (antalBarn > 1 ? extraOre : 0);
  return Math.round((minuter / 60) * tim);
}

export function radtext(subject: string | null, datum: string): string {
  const [, m, d] = datum.split('-');
  return `${subject || 'Pass'} ${Number(d)} ${MANADER[Number(m) - 1]}`;
}

// Tjänsten ett pass utan tjänst räknas som: den första aktiva som
// kunder kan köpa, annars den första i katalogen. Samma regel som
// standard_tjanst() i databasen. I dag läxhjälp.
export function standardTjanst(tjanster: Tjanst[]): Tjanst | null {
  const ordnad = [...tjanster]
    .sort((a, b) => (Number(a.ordning ?? 100) - Number(b.ordning ?? 100)) || a.kod.localeCompare(b.kod));
  return ordnad.find((t) => t.aktiv && t.for_kund) ?? ordnad[0] ?? null;
}

// Skattereduktionen på en rad: tjänstens andel av det kunden annars
// hade betalat, aldrig mer än vad som är kvar av årets tak, och i
// hela kronor nedåt.
export function rutFor(nettoOre: number, t: Tjanst | undefined, kvarOre: number): number {
  if (!t || !t.rut_berattigad || !t.rut_procent || kvarOre <= 0 || nettoOre <= 0) return 0;
  const andel = Math.min((nettoOre * Number(t.rut_procent)) / 100, kvarOre);
  return Math.floor(andel / 100) * 100;
}

// Delar upp det vyn passunderlag gav: pass som går vidare, pass utan
// rapport och undantagna pass. De två senare ska synas i svaret i
// stället för att försvinna tyst.
export function sorteraPass(allaPass: Pass[]) {
  const utanRapport: { booking_id: string; datum: string; parent_id: string | null; tutor_id: string | null }[] = [];
  const undantagna: string[] = [];
  const pass: Pass[] = [];
  for (const b of allaPass) {
    if (!b.fakturerbar) { undantagna.push(b.id); continue; }
    if (!b.har_rapport) {
      utanRapport.push({ booking_id: b.id, datum: b.wanted_date, parent_id: b.parent_id, tutor_id: b.tutor_id });
      continue;
    }
    pass.push(b);
  }
  return { pass, utanRapport, undantagna };
}

// RUT-läget för körningen. Bara ifyllt när något pass gäller en
// RUT-berättigad tjänst — för läxhjälp hämtas ingenting av det här.
export type RutLage = {
  medSkatteuppgifter: Set<string>;     // kunder med kund_skatteuppgifter
  takOre: number | null;               // årets tak ur rut_tak, null = inte ifyllt
  anvantOre: Map<string, number>;      // kund -> redan avdragen RUT i år
};

export function byggUnderlag(o: {
  pass: Pass[];
  tjanster: Tjanst[];
  timprisOre: number;
  timpenningar: Map<string, number>;
  rut?: RutLage;
}) {
  const perKod = new Map<string, Tjanst>();
  for (const t of o.tjanster) perKod.set(t.kod, t);
  const standard = standardTjanst(o.tjanster);

  // Samma reservordning som förut: passets tjänst, annars standard-
  // tjänsten; en okänd kod får standardpriset utan tillägg.
  const tjanstFor = (kod: string | null): Tjanst | undefined =>
    perKod.get(kod ?? standard?.kod ?? '');
  const prisFor = (t: Tjanst | undefined) => t
    ? { timme: Number(t.pris_per_timme_ore ?? 0), extra: Number(t.extra_personer_ore ?? 0) }
    : { timme: o.timprisOre, extra: 0 };

  const perFamilj = new Map<string, Rad[]>();
  const perTutor = new Map<string, Rad[]>();
  const utanTimpenning: string[] = [];
  // Pass där kortvägen redan varit inne. De RAPPORTERAS, de försvinner
  // inte: ett pass som tyst hoppas över är ett pass ingen fakturerar,
  // och det felet ser likadant ut som att allt gick bra.
  const kortbetalda: { booking_id: string; parent_id: string; lage: string }[] = [];
  const rutUtanSkatteuppgifter = new Set<string>();
  let rutUtanTak = false;
  const rutKvar = new Map<string, number>();

  for (const b of o.pass) {
    const minuter = Number(b.duration_min || 60);
    const text = radtext(b.subject, b.wanted_date);
    const t = tjanstFor(b.tjanst);

    // FAMILJENS HALVA. Studiehjälparens ligger nedanför och har med
    // flit inte samma villkor: hen har hållit passet oavsett hur
    // familjen betalade, och ersättningen den 25:e ska räknas fram
    // som vanligt.
    if (b.parent_id && !b.fakturerad && kortvagenRorde(b)) {
      kortbetalda.push({
        booking_id: b.id,
        parent_id: b.parent_id,
        lage: String(b.betalning_status ?? 'ingen'),
      });
    } else if (b.parent_id && !b.fakturerad) {
      const p = prisFor(t);
      const barn = Math.max(1, Number(b.antal_barn || 1));
      const brutto = familjebelopp(minuter, p.timme || o.timprisOre, p.extra, barn);

      // Rabatten är framräknad och fryst vid bokningen. Den räknas
      // ALDRIG om här — annars ändrar sig ett gammalt pass pris den
      // dag någon justerar koden.
      const rabatt = Math.min(Math.max(Number(b.rabatt_ore || 0), 0), brutto);
      const netto = brutto - rabatt;

      let rut = 0;
      if (t?.rut_berattigad && Number(t.rut_procent) > 0) {
        if (!o.rut || !o.rut.medSkatteuppgifter.has(b.parent_id)) {
          rutUtanSkatteuppgifter.add(b.parent_id);
        } else if (o.rut.takOre === null) {
          rutUtanTak = true;
        } else {
          const kvar = rutKvar.get(b.parent_id)
            ?? (o.rut.takOre - (o.rut.anvantOre.get(b.parent_id) ?? 0));
          rut = rutFor(netto, t, kvar);
          rutKvar.set(b.parent_id, kvar - rut);
        }
      }

      const lista = perFamilj.get(b.parent_id) ?? [];
      lista.push({
        booking_id: b.id,
        beskrivning: text
          + (barn > 1 ? ` (${barn} barn)` : '')
          + (rabatt > 0 ? ' − rabatt' : '')
          + (rut > 0 ? ' − RUT' : ''),
        minuter,
        belopp_ore: netto - rut,
        // Radens eget timpris — tjänstens, med tillägget för flera
        // barn när det gäller.
        timpris_ore: (p.timme || o.timprisOre) + (barn > 1 ? p.extra : 0),
        rut_ore: rut,
      });
      perFamilj.set(b.parent_id, lista);
    }

    if (b.tutor_id && !b.pa_underlag) {
      // Tjänstens ersättning när den är satt, annars studiehjälparens
      // egen timpenning. Utan någon av dem kan ersättningen inte räknas
      // ut, och att
      // gissa vore värre än att låta passet ligga kvar till nästa
      // körning. Det rapporteras i svaret så att någon kan fylla i den.
      //
      // Ersättningen påverkas ALDRIG av familjens rabatt eller RUT, och
      // räknar inte med tillägget för flera barn.
      const timpenning = Number(t?.ersattning_per_timme_ore || 0) || o.timpenningar.get(b.tutor_id) || 0;
      if (!timpenning) { utanTimpenning.push(b.tutor_id); continue; }
      const lista = perTutor.get(b.tutor_id) ?? [];
      lista.push({
        booking_id: b.id, beskrivning: text, minuter,
        belopp_ore: belopp(minuter, timpenning), timpris_ore: timpenning, rut_ore: 0,
      });
      perTutor.set(b.tutor_id, lista);
    }
  }

  return {
    perFamilj,
    perTutor,
    utanTimpenning,
    kortbetalda,
    rutUtanSkatteuppgifter: [...rutUtanSkatteuppgifter],
    rutUtanTak,
  };
}

export const summa = (rader: Rad[]) => rader.reduce((a, r) => a + r.belopp_ore, 0);
export const summaRut = (rader: Rad[]) => rader.reduce((a, r) => a + r.rut_ore, 0);
export const minuterSum = (rader: Rad[]) => rader.reduce((a, r) => a + r.minuter, 0);

// Svaret, i exakt samma form som före Fas 5. RUT-fälten läggs bara
// till när de har något att säga — en körning med bara läxhjälp ger
// samma svar, tecken för tecken, som den gjorde förut.
export function sammanfatta(o: {
  korningAv: 'nyckel' | 'admin';
  period: string;
  rutAr?: number;
  slut: string;
  timprisOre: number;
  underlag: ReturnType<typeof byggUnderlag>;
  utanRapport: ReturnType<typeof sorteraPass>['utanRapport'];
  undantagna: string[];
}) {
  const u = o.underlag;
  const ut: Record<string, unknown> = {
    korning_av: o.korningAv,
    period: o.period,
    pass_till_och_med: new Date(Date.parse(o.slut) - 86_400_000).toISOString().slice(0, 10),
    pris_per_timme_ore: o.timprisOre,
    fakturor: [...u.perFamilj].map(([id, r]) => {
      const rut = summaRut(r);
      return rut > 0
        ? { parent_id: id, pass: r.length, belopp_ore: summa(r), rut_ore: rut }
        : { parent_id: id, pass: r.length, belopp_ore: summa(r) };
    }),
    utbetalningar: [...u.perTutor].map(([id, r]) => ({ tutor_id: id, pass: r.length, belopp_ore: summa(r) })),
    hoppade_over_utan_timpenning: [...new Set(u.utanTimpenning)],
    hoppade_over_utan_rapport: o.utanRapport,
    undantagna_pass: o.undantagna.length,
  };
  if (u.kortbetalda.length) ut.hoppade_over_kortvagen = u.kortbetalda;
  if (u.rutUtanSkatteuppgifter.length) ut.rut_utan_skatteuppgifter = u.rutUtanSkatteuppgifter;
  if (u.rutUtanTak) ut.rut_utan_tak = o.rutAr ?? Number(o.period.slice(0, 4));
  return ut;
}
