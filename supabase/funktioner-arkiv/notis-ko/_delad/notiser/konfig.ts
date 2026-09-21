// ============================================================
// NEXTRUM — notismejlens konfiguration
//
// Allt som skiljer produktion från test läses här. Inga nycklar i
// koden. Standardvärdena är produktionens, utom LAGE: utan ett uttalat
// 'skicka' skickas INGENTING på riktigt. Hellre ett glömt värde som
// syns i loggen (status 'hoppad', "testläge") än en testkörning som
// mejlar riktiga familjer.
//
// LAGE kan sättas på två ställen: secreten NOTIS_LAGE (vinner), eller
// kolumnen notis_konfig.lage. Tabellen är skälet att det går att slå
// på och av med en SQL-rad, utan ett besök i dashboarden — samma skäl
// som hemligheten ligger där (se _delad/notis.ts).
// ============================================================

export type Lage = 'skicka' | 'logg' | 'sandlada';

export type NotisKonfig = {
  franEpost: string;
  franNamn: string;
  svaraTill: string;
  basUrl: string;
  funktionUrl: string;
  logoUrl: string | null;
  lage: Lage;
  sandladaTill: string;
};

export function lasKonfig(
  env: (k: string) => string | undefined = (k) => Deno.env.get(k),
  lageIDatabasen?: string | null,
): NotisKonfig {
  const lage = (env('NOTIS_LAGE') ?? lageIDatabasen ?? 'logg') as Lage;
  const bas = (env('NOTIS_BAS_URL') ?? 'https://nextrum.se').replace(/\/+$/, '');
  const supa = (env('SUPABASE_URL') ?? '').replace(/\/+$/, '');
  return {
    franEpost: env('NOTIS_FRAN_EPOST') ?? 'info@nextrum.se',
    franNamn: env('NOTIS_FRAN_NAMN') ?? 'Nextrum',
    svaraTill: env('NOTIS_SVARA_TILL') ?? 'info@nextrum.se',
    basUrl: bas,
    funktionUrl: env('NOTIS_FUNKTION_URL') ?? (supa ? `${supa}/functions/v1` : ''),
    // Sajtens N-märke som PNG, i repots rot. Tom sträng stänger av bilden.
    logoUrl: (env('NOTIS_LOGO_URL') ?? `${bas}/mejl-mark.png`) || null,
    lage: ['skicka', 'logg', 'sandlada'].includes(lage) ? lage : 'logg',
    sandladaTill: env('NOTIS_SANDLADA_TILL') ?? 'delivered@resend.dev',
  };
}

export function avsandare(k: NotisKonfig): string {
  return `${k.franNamn} <${k.franEpost}>`;
}
