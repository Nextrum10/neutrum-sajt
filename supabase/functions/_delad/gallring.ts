// ============================================================
// NEXTRUM — ansokan-gallring: själva arbetet, utan Supabase
//
// Integritetspolicyn lovar att en ansökan som inte leder till
// anställning sparas högst ett år. Den här modulen tar bort det som
// förfallit: CV-filen först, sedan raden. Allt som talar med omvärlden
// kommer in som beroenden, så att ordningen går att prova utan
// databas och utan Storage (gallring_test.ts).
//
//
// DATABASEN BESTÄMMER, FUNKTIONEN TAR BORT
//
// Vilka ansökningar som är förfallna, vilka filer som hör till dem och
// vilka filer ingen ansökan pekar ut avgörs i databasen
// (ansokningar_gallras_efter_ett_ar). Här tolkas ingen CV-rad och
// räknas inga datum. Filerna tas bort genom Storage-API:t, för
// storage.objects går inte att ta bort ur med SQL.
//
//
// FILEN FÖRST, OCH SVARET LÄSES
//
// Svarar Storage med ett fel rörs inte raden: den står kvar till nästa
// natt, med sökvägen till filen i behåll. Tas raden bort först finns
// sökvägen ingenstans, och filen går inte längre att koppla till
// någon. ansokan_gallra() prövar dessutom själv att filerna är borta
// ur storage.objects innan raden tas bort, så att ordningen inte
// hänger på att den här koden kommer ihåg den.
//
//
// ALDRIG ETT FILNAMN I LOGGEN ELLER I SVARET
//
// Filnamnet är vad den sökande själv döpt filen till, i praktiken
// "Alva_Berg_CV.pdf". Loggen får ansökans id och utfallet. Svaret, som
// hamnar i net._http_response, får bara antal och korta skäl.
// ============================================================

/** En rad ur ansokan_gallring_lista(). */
export type Forfallen = { ansokan_id: string; filer: string[] | null };

/** Utfallen ansokan_gallra() kan svara med. */
export type Utfall = 'borttagen' | 'finns_inte' | 'inte_forfallen' | 'filen_finns_kvar';

export type Borttagning = { borttagna: string[] } | { fel: string };

export type Beroenden = {
  /** ansokan_gallring_lista(): förfallna ansökningar och filerna som ska bort först. */
  forfallna(): Promise<Forfallen[]>;
  /** cv_foraldralosa(): filer i hinken cv som ingen ansökan pekar ut, äldre än ett år. */
  foraldralosa(): Promise<string[]>;
  /** ansokan_gallra(id): ett av Utfall, men läses som text och prövas. */
  gallra(id: string): Promise<string>;
  /** Storage: tar bort namnen ur hinken cv. Svarar med namnen som faktiskt togs bort. */
  taBort(namn: string[]): Promise<Borttagning>;
  /** Loggen. Får ansökans id och utfallet, aldrig ett filnamn. */
  logg?(rad: string): void;
  /** Millisekunder sedan start. Inskickad för att proven ska kunna flytta klockan. */
  klocka?(): number;
};

export type Summering = {
  /** Rader som togs bort. */
  ansokningar: number;
  /** Filer som hörde till en ansökan och togs bort. */
  filer: number;
  /** Filer utan ansökan som togs bort. */
  foraldralosa: number;
  /** Förfallna ansökningar som står kvar efter körningen: fel, fil kvar eller slut på tid. */
  kvar: number;
  /** Korta skäl, aldrig namn på en fil eller en person. */
  fel: string[];
};

/** Hur länge körningen tar nya ansökningar. intern.ansokan_gallring_vack() väntar 60 sekunder på svar. */
export const TIDSGRANS_MS = 40_000;

/** Tar bort det som är förfallet: varje ansökans filer och sedan raden, och till sist filerna utan ansökan. */
export async function gallra(d: Beroenden, tidsgransMs = TIDSGRANS_MS): Promise<Summering> {
  const s: Summering = { ansokningar: 0, filer: 0, foraldralosa: 0, kvar: 0, fel: [] };
  const logg = d.logg ?? (() => {});
  const start = Date.now();
  const klocka = d.klocka ?? (() => Date.now() - start);

  const forfallna = await d.forfallna();
  for (let i = 0; i < forfallna.length; i++) {
    const a = forfallna[i];
    if (klocka() >= tidsgransMs) {
      // Resten får vänta till nästa natt. Det är inget fel.
      s.kvar += forfallna.length - i;
      logg(`tiden slut, ${forfallna.length - i} ansökningar får vänta`);
      break;
    }

    const filer = (a.filer ?? []).filter((n) => typeof n === 'string' && n !== '');
    if (filer.length) {
      let svar: Borttagning;
      try {
        svar = await d.taBort(filer);
      } catch {
        svar = { fel: 'Storage gick inte att nå' };
      }
      if ('fel' in svar) {
        s.kvar++;
        s.fel.push(`en ansökans fil gick inte att ta bort (${svar.fel})`);
        logg(`${a.ansokan_id}: filen gick inte att ta bort, raden står kvar (${svar.fel})`);
        continue;
      }
      // Bara det som efterfrågades räknas. Ett namn som inte kom tillbaka
      // kan redan ha varit borta; ansokan_gallra() avgör.
      s.filer += svar.borttagna.filter((n) => filer.includes(n)).length;
    }

    let utfall: string;
    try {
      utfall = await d.gallra(a.ansokan_id);
    } catch {
      s.kvar++;
      s.fel.push('en ansökan gick inte att ta bort ur databasen');
      logg(`${a.ansokan_id}: ansokan_gallra kastade`);
      continue;
    }

    if (utfall === 'borttagen') {
      s.ansokningar++;
    } else if (utfall === 'filen_finns_kvar') {
      s.kvar++;
      s.fel.push('en ansökans fil finns kvar i hinken, raden står kvar');
    } else if (utfall !== 'finns_inte' && utfall !== 'inte_forfallen') {
      // finns_inte: någon annan hann före. inte_forfallen: ett steg har
      // tagits sedan listan lästes. Inget av dem är ett fel.
      s.kvar++;
      s.fel.push('okänt svar från ansokan_gallra');
    }
    logg(`${a.ansokan_id}: ${utfall}`);
  }

  if (klocka() < tidsgransMs) {
    let namn: string[];
    try {
      namn = (await d.foraldralosa()).filter((n) => typeof n === 'string' && n !== '');
    } catch {
      namn = [];
      s.fel.push('filerna utan ansökan gick inte att läsa');
      logg('cv_foraldralosa kastade');
    }
    if (namn.length) {
      let svar: Borttagning;
      try {
        svar = await d.taBort(namn);
      } catch {
        svar = { fel: 'Storage gick inte att nå' };
      }
      if ('fel' in svar) {
        s.fel.push(`filerna utan ansökan gick inte att ta bort (${svar.fel})`);
        logg(`filer utan ansökan: ${namn.length} st gick inte att ta bort (${svar.fel})`);
      } else {
        s.foraldralosa = svar.borttagna.filter((n) => namn.includes(n)).length;
        logg(`filer utan ansökan: ${s.foraldralosa} av ${namn.length} borttagna`);
      }
    }
  }

  return s;
}

/** Ett StorageError som ett kort skäl: statuskoden, aldrig meddelandet, som kan upprepa sökvägen. */
export function lagringsfel(e: unknown): string {
  const status = (e as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? `Storage ${status}` : 'Storage svarade med fel';
}
