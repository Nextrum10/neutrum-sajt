// ============================================================
// NEXTRUM — prisräkningen för månadskörningen (Fas 5, ombyggd i Fas 14.2)
//
// Allt fakturering/index.ts räknar ut, som rena funktioner: in med
// passen, katalogen och timpenningarna, ut med raderna och svaret.
// Ingen databas och inget nätverk här, så att varje öre går att
// testa (pris_test.ts) — förut satt räkningen inne i Deno.serve och
// hade inte ett enda test.
//
// FAS 14.2 TOG BORT FAMILJENS HALVA. Familjen betalar varje pass med
// kort (stripe-checkout), sedan Fas 19.2 i förväg eller efter passet
// när de bekräftar rapporten. Körningen bygger studiehjälparens
// underlag, och räknar upp de pass som hölls utan att familjen betalat,
// med det belopp passet skulle ha kostat. En faktura skapas inte av
// det: listan är till för att någon ska se passen, inte för att de ska
// drivas in av sig själva.
//
// FAS 14.6 GAV TILLBAKA EN DEL AV DEN. Familjen kan välja faktura på
// ett pass (betalning_status = 'faktura'), och bara de passen samlas
// på en månadsfaktura: byggFakturor(). Samma pris som kortet tar, ur
// familjebelopp(), så att betalsättet aldrig ändrar vad passet kostar.
// Ett pass familjen inte valt faktura för faktureras aldrig av sig
// självt, också om det är obetalt.
//
// PRISLOGIKEN ÄR DENSAMMA SOM FÖRUT (planens avsnitt D):
//   · priset som frystes på passet när det bokades (Fas 19.5), annars
//   · tjänstens timpris, eller standardtjänstens om passets saknar pris
//   · ett FAST tillägg per timme när fler än ett barn sitter med
//   · rabatten är fryst vid bokningen och sänker aldrig ersättningen
//   · ersättningen räknar inte med tillägget för flera barn
// pris_test.ts jämför med en ordagrann kopia av den gamla koden.
//
// ERSÄTTNINGEN: tjänstens (tjanster.ersattning_per_timme_ore) när den
// är satt, annars studiehjälparens egen timpenning — så som kolumnen
// och adminvyn beskriver den. Läxhjälp har ingen egen.
//
// RUT DRAS INTE LÄNGRE HÄR. Avdraget fanns bara på familjens faktura,
// och den finns inte. skydda_tjansteaktivering() nekar en RUT-
// berättigad tjänst för kunder tills kortbetalningen kan dra det, så
// det finns inget pass som skulle ha fått avdraget. rutFor() står
// kvar, testad, för den dagen: regeln om hela kronor nedåt och taket
// är dyrköpt och ska inte behöva skrivas om ur minnet.
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
  // Valfri i typen med flit: en anropare som inte hämtar kolumnen får
  // passet räknat som obetalt. Att gissa "betalt" hade gömt det.
  betalning_status?: string | null;
  // Fas 20.1, ur passunderlag. Saknas de gäller det bokade, precis som
  // förut: ett pass utan tid i rapporten kostar det som bokades.
  //   debiterade_min  den hållna tiden per påbörjad kvart, det familjen betalar
  //   lon_min         det studiehjälparen får betalt för: nedåt alltid,
  //                   uppåt bara när övertiden är betald
  debiterade_min?: number | null;
  lon_min?: number | null;
  // Fas 22.1: övertiden timbanken tog. Den är betald med minuter familjen
  // redan köpt, och ska varken dras med kort eller stå på en faktura.
  timbank_min?: number | null;
  // Priset fryst vid bokningen (Fas 19.5). Saknas det räknas passet på
  // tjänstens pris, som före Fas 19.5.
  timpris_ore?: number | null;
  extra_ore?: number | null;
};

// Fas 20.1. Minuterna familjen betalar för, och minuterna lönen räknas på.
// Fas 22.1: minus övertiden timbanken redan tagit.
export const familjensMinuter = (b: Pass) =>
  Number(b.debiterade_min || b.duration_min || 60) - Number(b.timbank_min || 0);
export const lonensMinuter = (b: Pass) => Number(b.lon_min || b.duration_min || 60);

/**
 * Passets pris per timme och tillägget för flera barn (Fas 19.5).
 *
 * Villkoren lovar priset vid bokningen, så det frysta priset på passet
 * går först. Tjänstens pris är reserven, för ett pass som bokades innan
 * priset började frysas, och det är samma räkning som före Fas 19.5:
 * tjänstens timpris eller reserven, och inget tillägg för en okänd tjänst.
 */
export function passpris(
  b: { timpris_ore?: number | null; extra_ore?: number | null },
  t: Tjanst | undefined,
  reservOre: number,
): { timme: number; extra: number } {
  const fryst = Number(b.timpris_ore ?? 0);
  if (fryst > 0) return { timme: fryst, extra: Number(b.extra_ore ?? 0) };
  return t
    ? { timme: Number(t.pris_per_timme_ore ?? 0) || reservOre, extra: Number(t.extra_personer_ore ?? 0) }
    : { timme: reservOre, extra: 0 };
}

// Lägen där familjen INTE har betalat. Samma tre som avvikelsen
// ej_betalt i avvikelser_rader() — ändras den ena ska den andra
// ändras i samma ändring.
//
//   ingen       — ingen betalning har ens påbörjats.
//   vantar      — en checkout-session är öppnad. Det är inte en
//                 betalning; bara webhooken kan säga att pengarna kom.
//   misslyckad  — kortet nekades.
//
// 'betald' och 'tvist' är betalda. 'aterbetald' är inte med: där har
// någon redan beslutat vad som ska hända med pengarna, och en lista
// över obetalda pass ska inte se ut att riva det beslutet. 'faktura'
// (Fas 14.6) är inte med: passet betalas mot faktura, och om fakturan
// är betald står på fakturan, inte här.
export const OBETALDA_LAGEN = new Set(['ingen', 'vantar', 'misslyckad']);

export function obetalt(b: Pass): boolean {
  return OBETALDA_LAGEN.has(String(b.betalning_status ?? 'ingen'));
}

export type Rad = {
  booking_id: string;
  beskrivning: string;
  minuter: number;
  belopp_ore: number;
  timpris_ore: number;
};

export type Obetalt = {
  booking_id: string;
  parent_id: string;
  datum: string;
  lage: string;
  belopp_ore: number;
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

// Månaden en tidpunkt hör till, i svensk tid, som ÅÅÅÅ-MM-01. I UTC är
// klockan 00.30 den 1:a fortfarande förra månaden.
export function manadenNu(nu: Date): string {
  const [ar, man] = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit',
  }).format(nu).split('-').map(Number);
  return `${ar}-${String(man).padStart(2, '0')}-01`;
}

// Är perioden (ÅÅÅÅ-MM-01) slut i svensk tid? Underlag och fakturor
// skapas först då (2026-10-01). Den 29 september kördes september med
// knappen medan den pågick, och ett pass som rapporterades samma kväll
// fick inte plats: en studiehjälpare har ett underlag per månad, så
// schemat svarade 207 den 1 oktober och passet fick vänta en månad på
// sin lön.
export function manadenArSlut(period: string, nu: Date): boolean {
  return period < manadenNu(nu);
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
// hela kronor nedåt. Används inte av något sedan Fas 14.2 — se
// filhuvudet om varför den står kvar.
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

export function byggUnderlag(o: {
  pass: Pass[];
  tjanster: Tjanst[];
  timprisOre: number;
  timpenningar: Map<string, number>;
}) {
  const perKod = new Map<string, Tjanst>();
  for (const t of o.tjanster) perKod.set(t.kod, t);
  const standard = standardTjanst(o.tjanster);

  // Samma reservordning som förut: passets tjänst, annars standard-
  // tjänsten; en okänd kod får standardpriset utan tillägg.
  const tjanstFor = (kod: string | null): Tjanst | undefined =>
    perKod.get(kod ?? standard?.kod ?? '');

  const perTutor = new Map<string, Rad[]>();
  const utanTimpenning: string[] = [];
  // Pass som hölls utan att familjen betalat. De RAPPORTERAS: ett pass
  // som tyst hoppas över är ett pass ingen tar betalt för, och det
  // felet ser likadant ut som att allt gick bra.
  const obetalda: Obetalt[] = [];

  for (const b of o.pass) {
    const text = radtext(b.subject, b.wanted_date);
    const t = tjanstFor(b.tjanst);

    // FAMILJENS HALVA är en lista, inte en faktura. Ett pass som står
    // på en äldre faktura drivs in genom den och räknas inte här.
    if (b.parent_id && !b.fakturerad && obetalt(b)) {
      const p = passpris(b, t, o.timprisOre);
      const barn = Math.max(1, Number(b.antal_barn || 1));
      const brutto = familjebelopp(familjensMinuter(b), p.timme, p.extra, barn);
      // Rabatten är framräknad och fryst vid bokningen. Den räknas
      // ALDRIG om här — annars ändrar sig ett gammalt pass pris den
      // dag någon justerar koden.
      const rabatt = Math.min(Math.max(Number(b.rabatt_ore || 0), 0), brutto);
      // Ett pass där rabatten täcker allt (första timmen bjuds, Fas 19.5)
      // har ingenting att betala och är inte obetalt.
      if (brutto - rabatt > 0) {
        obetalda.push({
          booking_id: b.id,
          parent_id: b.parent_id,
          datum: b.wanted_date,
          lage: String(b.betalning_status ?? 'ingen'),
          belopp_ore: brutto - rabatt,
        });
      }
    }

    // STUDIEHJÄLPARENS HALVA har med flit inte samma villkor: hen har
    // hållit passet oavsett hur familjen betalade, och ersättningen den
    // 25:e räknas fram som vanligt. Att ett obetalt pass inte ska hållas
    // alls sköter spärren kortsparr i databasen, inte den här räkningen.
    if (b.tutor_id && !b.pa_underlag) {
      // Tjänstens ersättning när den är satt, annars studiehjälparens
      // egen timpenning. Utan någon av dem kan ersättningen inte räknas
      // ut, och att gissa vore värre än att låta passet ligga kvar till
      // nästa körning. Det rapporteras i svaret så att någon kan fylla i den.
      //
      // Ersättningen påverkas ALDRIG av familjens rabatt, och räknar
      // inte med tillägget för flera barn.
      const timpenning = Number(t?.ersattning_per_timme_ore || 0) || o.timpenningar.get(b.tutor_id) || 0;
      if (!timpenning) { utanTimpenning.push(b.tutor_id); continue; }
      // Fas 20.1: den hållna tiden nedåt alltid, uppåt bara när
      // övertiden är betald. Regeln bor i passunderlag.lon_min.
      const minuter = lonensMinuter(b);
      const lista = perTutor.get(b.tutor_id) ?? [];
      lista.push({
        booking_id: b.id, beskrivning: text, minuter,
        belopp_ore: belopp(minuter, timpenning), timpris_ore: timpenning,
      });
      perTutor.set(b.tutor_id, lista);
    }
  }

  return { perTutor, utanTimpenning, obetalda };
}

export type Fakturarad = {
  booking_id: string;
  beskrivning: string;
  minuter: number;
  pris_per_timme_ore: number;
  belopp_ore: number;
};

/**
 * Familjens månadsfaktura (Fas 14.6): en lista rader per familj, för
 * pass familjen valt att betala mot faktura och som inte redan står på
 * en faktura. Priset räknas precis som stripe-checkout räknar det:
 * tjänstens timpris, det fasta tillägget för flera barn, och rabatten
 * som frystes vid bokningen. Beskrivningen är ämne och datum, aldrig
 * barnets namn: fakturan läggs in i Fortnox och kan hamna i en inkorg.
 */
export function byggFakturor(o: { pass: Pass[]; tjanster: Tjanst[]; timprisOre: number }) {
  const perKod = new Map<string, Tjanst>();
  for (const t of o.tjanster) perKod.set(t.kod, t);
  const standard = standardTjanst(o.tjanster);

  const perFamilj = new Map<string, Fakturarad[]>();
  for (const b of o.pass) {
    if (!b.parent_id || b.fakturerad || b.betalning_status !== 'faktura') continue;
    const t = perKod.get(b.tjanst ?? standard?.kod ?? '');
    const { timme, extra } = passpris(b, t, o.timprisOre);
    // Fas 20.1: fakturan tar den hållna tiden.
    const minuter = familjensMinuter(b);
    const barn = Math.max(1, Number(b.antal_barn || 1));
    const brutto = familjebelopp(minuter, timme, extra, barn);
    const rabatt = Math.min(Math.max(Number(b.rabatt_ore || 0), 0), brutto);
    // En rad på noll kronor är ingen faktura (Fas 19.5).
    if (brutto - rabatt <= 0) continue;
    const lista = perFamilj.get(b.parent_id) ?? [];
    lista.push({
      booking_id: b.id,
      beskrivning: radtext(b.subject, b.wanted_date)
        + (barn > 1 ? ` (${barn} barn)` : '')
        + (rabatt > 0 ? ' − rabatt' : ''),
      minuter,
      pris_per_timme_ore: timme + (barn > 1 ? extra : 0),
      belopp_ore: brutto - rabatt,
    });
    perFamilj.set(b.parent_id, lista);
  }
  return perFamilj;
}

/**
 * Vad ett pass kostar familjen för ett antal minuter: tjänstens timpris,
 * tillägget för flera barn, och rabatten som frystes vid bokningen.
 * Aldrig under noll: en rabatt som täcker mer än minuterna kostar inget.
 */
export function minuterspris(o: {
  minuter: number; timprisOre: number; extraOre: number; barn: number; rabattOre: number;
}): number {
  const brutto = familjebelopp(o.minuter, o.timprisOre, o.extraOre, Math.max(1, o.barn));
  return brutto - Math.min(Math.max(o.rabattOre, 0), brutto);
}

/**
 * Tillägget för övertid på ett pass som redan var betalt (Fas 20.1):
 * vad den debiterade tiden kostar minus vad den betalda tiden kostar,
 * båda med samma pris och samma rabatt. Rabatten dras alltså en gång,
 * och ett pass med första timmen bjuden får inte timmen två gånger.
 * Noll när ingenting är över.
 */
export function tillaggsbelopp(o: {
  debiteradeMin: number; betaldaMin: number; timprisOre: number; extraOre: number; barn: number; rabattOre: number;
}): number {
  if (o.debiteradeMin <= o.betaldaMin) return 0;
  const pris = (minuter: number) => minuterspris({ ...o, minuter });
  return Math.max(pris(o.debiteradeMin) - pris(o.betaldaMin), 0);
}

export const summa = (rader: { belopp_ore: number }[]) => rader.reduce((a, r) => a + r.belopp_ore, 0);
export const minuterSum = (rader: Rad[]) => rader.reduce((a, r) => a + r.minuter, 0);

// Svaret. `obetalda` står alltid med, också tom: en tom lista är ett
// besked ("alla hållna pass är betalda"), en saknad nyckel är en fråga.
export function sammanfatta(o: {
  korningAv: 'nyckel' | 'schema' | 'admin';
  period: string;
  slut: string;
  timprisOre: number;
  underlag: ReturnType<typeof byggUnderlag>;
  fakturor?: ReturnType<typeof byggFakturor>;
  utanRapport: ReturnType<typeof sorteraPass>['utanRapport'];
  undantagna: string[];
}) {
  const u = o.underlag;
  return {
    korning_av: o.korningAv,
    period: o.period,
    pass_till_och_med: new Date(Date.parse(o.slut) - 86_400_000).toISOString().slice(0, 10),
    pris_per_timme_ore: o.timprisOre,
    utbetalningar: [...u.perTutor].map(([id, r]) => ({ tutor_id: id, pass: r.length, belopp_ore: summa(r) })),
    // Fas 14.6. Står alltid med, också tom, av samma skäl som obetalda.
    fakturor: [...(o.fakturor ?? new Map<string, Fakturarad[]>())]
      .map(([id, r]) => ({ parent_id: id, pass: r.length, belopp_ore: summa(r) })),
    obetalda: u.obetalda,
    hoppade_over_utan_timpenning: [...new Set(u.utanTimpenning)],
    hoppade_over_utan_rapport: o.utanRapport,
    undantagna_pass: o.undantagna.length,
  };
}
