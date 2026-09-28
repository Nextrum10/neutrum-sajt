// ============================================================
// NEXTRUM — utbildningsprovet (Fas 22.1)
//
// Trettio flervalsfrågor om Handledarhandboken, som gås igenom på
// utbildningsmötet. Den som sökt jobb gör provet efter mötet, utan
// tidsgräns, och är godkänd vid 80 procent. Handboken finns inte i
// repot; frågorna är skrivna ur versionen från september 2026, och
// ändras handboken ska frågorna läsas om mot den.
//
//
// FACIT BOR HÄR OCH INGEN ANNANSTANS
//
// Sidan på nextrum.se får frågorna utan svar (publikaFragor) och
// skickar tillbaka vilket alternativ som valdes. Rättningen sker här,
// i edge-funktionen. Hade facit legat i sidans JavaScript hade provet
// gått att klara med utvecklarverktygen öppna, och då säger ett
// godkänt ingenting.
//
// Efter ett försök får den sökande veta hur många rätt det blev per
// AVSNITT, inte vilka frågor som var fel. Med fritt antal försök och
// svaret per fråga går varje prov att klara på tre försök utan att ha
// läst ett ord; per avsnitt pekar det ändå ut vad som ska läsas om.
//
//
// FRÅGORNA
//
// Varje fråga har ett rätt svar som står i handboken, och tre fel som
// en rimlig människa kan tro på. Svaret som följer handboken är inte
// alltid det längsta, och alternativen blandas om vid varje hämtning.
// Ändras en fråga ska id:t bytas om svaret byter betydelse:
// utbildningsprov_forsok.svar lagrar id:n, och ett gammalt försök ska
// inte se ut att ha svarat på en ny fråga.
//
// Tiden: 30 frågor med fyra alternativ, de flesta scenarier, är
// omkring 20 minuter för den som läser ordentligt. Uppdraget var 15 till
// 30 minuter.
// ============================================================

import { GRANS_PROCENT, kravRatt } from './utbildningsprov_grans.ts';

export type Alternativ = { id: string; text: string };
export type Fraga = {
  id: string;
  avsnitt: AvsnittId;
  fraga: string;
  alternativ: Alternativ[];
  ratt: string;
};

export const AVSNITT = {
  grund: 'Syftet och grundprinciperna',
  trygg: 'En trygg lärmiljö',
  aktiv: 'Aktivt lärande och studieteknik',
  forsta: 'Dokumentation och första lektionen',
  svart: 'Förhållningssätt och svåra situationer',
} as const;
export type AvsnittId = keyof typeof AVSNITT;

export { GRANS_PROCENT, kravRatt };

export const FRAGOR: Fraga[] = [
  // ---------- Syftet och grundprinciperna ----------
  {
    id: 'syfte', avsnitt: 'grund',
    fraga: 'Vad är enligt handboken det övergripande målet med handledningen?',
    alternativ: [
      { id: 'a', text: 'Att eleven får så höga resultat som möjligt på nästa prov.' },
      { id: 'b', text: 'Att eleven blir en bättre lärande individ på lång sikt, med självförtroende, självständighet och goda studievanor.' },
      { id: 'c', text: 'Att eleven blir klar med sina läxor så snabbt som möjligt.' },
      { id: 'd', text: 'Att gå igenom kursens innehåll en gång till, i samma ordning som läraren.' },
    ],
    ratt: 'b',
  },
  {
    id: 'metod', avsnitt: 'grund',
    fraga: 'Du vet inte vilket arbetssätt som passar din nya elev bäst. Vad gör du?',
    alternativ: [
      { id: 'a', text: 'Frågar eleven en gång och håller dig sedan till det svaret.' },
      { id: 'b', text: 'Använder muntliga förklaringar, eftersom de fungerar för de flesta.' },
      { id: 'c', text: 'Testar olika arbetssätt, ser vad som håller elevens fokus och engagemang, och dokumenterar vad som fungerar.' },
      { id: 'd', text: 'Väntar tills föräldern berättar vilken metod skolan använder.' },
    ],
    ratt: 'c',
  },
  {
    id: 'intresse', avsnitt: 'grund',
    fraga: 'Din elev älskar fotboll men tycker att procent är tråkigt. Hur använder du intresset bäst?',
    alternativ: [
      { id: 'a', text: 'Ni räknar procent och statistik på riktiga matchresultat, så att matten känns meningsfull.' },
      { id: 'b', text: 'Ni pratar fotboll första halvan av passet så att eleven kommer i gott humör.' },
      { id: 'c', text: 'Du undviker fotboll helt, eftersom det tar fokus från skolarbetet.' },
      { id: 'd', text: 'Eleven får välja fritt vad ni pratar om, så länge hen trivs.' },
    ],
    ratt: 'a',
  },
  {
    id: 'material', avsnitt: 'grund',
    fraga: 'Vilket material ska du i första hand utgå från?',
    alternativ: [
      { id: 'a', text: 'Ditt eget material, eftersom du vet vad som fungerar för dig.' },
      { id: 'b', text: 'Övningsblad från internet som täcker hela kursen.' },
      { id: 'c', text: 'Det som eleven tycker är roligast just nu.' },
      { id: 'd', text: 'Elevens läroböcker, uppgifter från skolan, lärarens instruktioner och kommande prov.' },
    ],
    ratt: 'd',
  },
  {
    id: 'eget-material', avsnitt: 'grund',
    fraga: 'När är det rätt att använda eget material, till exempel extra övningar eller en egen bild?',
    alternativ: [
      { id: 'a', text: 'Aldrig. Handledningen ska bara använda skolans material.' },
      { id: 'b', text: 'Som ett komplement när det behövs, inte som en ersättning för det eleven gör i skolan.' },
      { id: 'c', text: 'Alltid, så att eleven får en egen undervisning vid sidan av skolan.' },
      { id: 'd', text: 'Bara när eleven inte har några läxor.' },
    ],
    ratt: 'b',
  },

  // ---------- En trygg lärmiljö ----------
  {
    id: 'fel-svar', avsnitt: 'trygg',
    fraga: 'Eleven svarar fel på en fråga. Vilket svar följer handboken?',
    alternativ: [
      { id: 'a', text: '"Nej, det där är fel. Försök igen."' },
      { id: 'b', text: '"Det där borde du kunna vid det här laget."' },
      { id: 'c', text: '"Din klasskompis fick samma uppgift och klarade den."' },
      { id: 'd', text: '"Jag förstår hur du tänkte. Ska vi titta på det tillsammans och se vad som händer här?"' },
    ],
    ratt: 'd',
  },
  {
    id: 'dalig-pa-matte', avsnitt: 'trygg',
    fraga: 'Eleven säger: "Jag är dålig på matte." Vad svarar du?',
    alternativ: [
      { id: 'a', text: '"Du kanske tycker att matte är svårt just nu, men det betyder inte att du inte kan lära dig det. Vi tar det steg för steg."' },
      { id: 'b', text: '"Nej, det är du inte."' },
      { id: 'c', text: '"Det är okej, alla kan inte vara bra på matte."' },
      { id: 'd', text: '"Då får vi köra extra hårt tills du inte känner så längre."' },
    ],
    ratt: 'a',
  },
  {
    id: 'berom', avsnitt: 'trygg',
    fraga: 'Vad ska ditt beröm i första hand handla om?',
    alternativ: [
      { id: 'a', text: 'Att eleven är smart.' },
      { id: 'b', text: 'Bara rätt svar, så att berömmet betyder något.' },
      { id: 'c', text: 'Ansträngning och strategi, till exempel att eleven bröt ner problemet i mindre delar.' },
      { id: 'd', text: 'Att eleven gör det bättre än sina klasskompisar.' },
    ],
    ratt: 'c',
  },
  {
    id: 'tystnad', avsnitt: 'trygg',
    fraga: 'Eleven blir tyst en stund efter din fråga. Vad gör du?',
    alternativ: [
      { id: 'a', text: 'Förklarar direkt en gång till, så att tystnaden inte blir obekväm.' },
      { id: 'b', text: 'Väntar några sekunder och frågar sedan: "Hur tänker du?"' },
      { id: 'c', text: 'Ger svaret, så att ni hinner mer under passet.' },
      { id: 'd', text: 'Går vidare till nästa uppgift.' },
    ],
    ratt: 'b',
  },
  {
    id: 'undvik', avsnitt: 'trygg',
    fraga: 'Vad ska du undvika enligt handboken?',
    alternativ: [
      { id: 'a', text: 'Att låta eleven göra misstag.' },
      { id: 'b', text: 'Att fråga vad eleven själv tror är nästa steg.' },
      { id: 'c', text: 'Att anpassa svårighetsgraden efter eleven.' },
      { id: 'd', text: 'Sarkasm och att jämföra eleven med andra elever.' },
    ],
    ratt: 'd',
  },
  {
    id: 'svarighet', avsnitt: 'trygg',
    fraga: 'Hur svåra ska uppgifterna vara?',
    alternativ: [
      { id: 'a', text: 'Så att eleven utmanas men fortfarande kan lyckas med stöd.' },
      { id: 'b', text: 'Så lätta att eleven alltid lyckas, för att bygga självförtroende.' },
      { id: 'c', text: 'Så svåra som möjligt, eftersom det ger mest lärande.' },
      { id: 'd', text: 'På samma nivå som resten av klassen, oavsett elev.' },
    ],
    ratt: 'a',
  },

  // ---------- Aktivt lärande och studieteknik ----------
  {
    id: 'fastnar', avsnitt: 'aktiv',
    fraga: 'Eleven har fastnat på en uppgift. Vad gör du först?',
    alternativ: [
      { id: 'a', text: 'Visar hela lösningen så att eleven ser hur man gör.' },
      { id: 'b', text: 'Säger att ni hoppar över den och tar den nästa gång.' },
      { id: 'c', text: 'Frågar "Vilken del känns svårast?" i stället för att ge svaret.' },
      { id: 'd', text: 'Förklarar samma sak en gång till, långsammare.' },
    ],
    ratt: 'c',
  },
  {
    id: 'chunking', avsnitt: 'aktiv',
    fraga: 'Eleven ska plugga ett helt kapitel och känner sig överväldigad. Vilken teknik hjälper mest just då?',
    alternativ: [
      { id: 'a', text: 'Interleaving: blanda in uppgifter från andra ämnen.' },
      { id: 'b', text: 'Att läsa hela kapitlet flera gånger i rad.' },
      { id: 'c', text: 'Spaced repetition: vänta en vecka innan ni börjar.' },
      { id: 'd', text: 'Chunking: dela upp kapitlet i mindre delar och ta ett begrepp i taget.' },
    ],
    ratt: 'd',
  },
  {
    id: 'recall', avsnitt: 'aktiv',
    fraga: 'Vilket är ett exempel på active recall (aktiv återhämtning)?',
    alternativ: [
      { id: 'a', text: 'Eleven förklarar med egna ord vad ni gick igenom förra veckan, utan att titta i boken.' },
      { id: 'b', text: 'Eleven läser samma sida tre gånger.' },
      { id: 'c', text: 'Eleven stryker under det viktigaste i texten.' },
      { id: 'd', text: 'Du sammanfattar lektionen för eleven.' },
    ],
    ratt: 'a',
  },
  {
    id: 'spaced', avsnitt: 'aktiv',
    fraga: 'Vad innebär spaced repetition (utspridd repetition)?',
    alternativ: [
      { id: 'a', text: 'Att plugga intensivt kvällen före provet.' },
      { id: 'b', text: 'Att göra tio likadana uppgifter i rad.' },
      { id: 'c', text: 'Att repetera vid allt längre tidsintervall, helst innan kunskapen hunnit glömmas bort.' },
      { id: 'd', text: 'Att repetera allt varje dag i samma takt.' },
    ],
    ratt: 'c',
  },
  {
    id: 'interleaving', avsnitt: 'aktiv',
    fraga: 'Varför är interleaving (varierad träning) effektivt?',
    alternativ: [
      { id: 'a', text: 'Det känns enklare för eleven att göra likadana uppgifter i rad.' },
      { id: 'b', text: 'Eleven måste själv avgöra vilken metod som passar, precis som på ett riktigt prov.' },
      { id: 'c', text: 'Eleven lär sig känna igen mönster snabbare.' },
      { id: 'd', text: 'Man kan hoppa över de svåra områdena.' },
    ],
    ratt: 'b',
  },

  // ---------- Dokumentation och första lektionen ----------
  {
    id: 'dokumentera-vad', avsnitt: 'forsta',
    fraga: 'Vad ska du dokumentera efter varje lektion?',
    alternativ: [
      { id: 'a', text: 'Bara hur länge passet varade.' },
      { id: 'b', text: 'Din personliga uppfattning om elevens familj.' },
      { id: 'c', text: 'Ingenting, om lektionen gick bra.' },
      { id: 'd', text: 'Vad ni arbetade med, vad eleven behärskar, vad som behöver utvecklas, vilka metoder som fungerade och målet till nästa gång.' },
    ],
    ratt: 'd',
  },
  {
    id: 'dokumentera-var', avsnitt: 'forsta',
    fraga: 'Var dokumenterar du lektionen?',
    alternativ: [
      { id: 'a', text: 'I Nextrums system, i rapporten efter passet.' },
      { id: 'b', text: 'I ett eget dokument på din dator.' },
      { id: 'c', text: 'I ett sms till föräldern.' },
      { id: 'd', text: 'I en chatt med eleven.' },
    ],
    ratt: 'a',
  },
  {
    id: 'objektivt', avsnitt: 'forsta',
    fraga: 'Hur ska du skriva när du dokumenterar?',
    alternativ: [
      { id: 'a', text: 'Med dina egna tolkningar av varför eleven beter sig som hen gör.' },
      { id: 'b', text: 'Objektivt och faktabaserat.' },
      { id: 'c', text: 'Så kort som möjligt, gärna med förkortningar bara du förstår.' },
      { id: 'd', text: 'Så positivt som möjligt, även om något oroande har hänt.' },
    ],
    ratt: 'b',
  },
  {
    id: 'forsta-mal', avsnitt: 'forsta',
    fraga: 'Vad är huvudmålet med den första lektionen?',
    alternativ: [
      { id: 'a', text: 'Att hinna gå igenom så mycket av kursen som möjligt.' },
      { id: 'b', text: 'Att ge eleven ett prov med betyg, så att ni vet var ni står.' },
      { id: 'c', text: 'Att bygga förtroende, lära känna eleven och förstå elevens behov, nivå och sätt att plugga.' },
      { id: 'd', text: 'Att gå igenom regler och vad som händer om eleven inte gör läxan.' },
    ],
    ratt: 'c',
  },
  {
    id: 'lara-kanna', avsnitt: 'forsta',
    fraga: 'Vilken fråga passar bäst när du lär känna eleven första gången?',
    alternativ: [
      { id: 'a', text: '"Hur går det hemma mellan dina föräldrar?"' },
      { id: 'b', text: '"Har du pojkvän eller flickvän?"' },
      { id: 'c', text: '"Varför har du så svårt i skolan?"' },
      { id: 'd', text: '"Hur brukar du plugga inför prov?"' },
    ],
    ratt: 'd',
  },
  {
    id: 'avsluta', avsnitt: 'forsta',
    fraga: 'Hur avslutar du den första lektionen?',
    alternativ: [
      { id: 'a', text: 'Du sammanfattar vad ni gått igenom, vad som fungerade bra och vad nästa lektion ska handla om.' },
      { id: 'b', text: 'Du ger eleven en lista på allt hen behöver bli bättre på.' },
      { id: 'c', text: 'Ni slutar när tiden är slut, oavsett var ni är.' },
      { id: 'd', text: 'Du ger eleven ett prov att göra till nästa gång.' },
    ],
    ratt: 'a',
  },

  // ---------- Förhållningssätt och svåra situationer ----------
  {
    id: 'aldrig', avsnitt: 'svart',
    fraga: 'Vilket av följande ska du aldrig göra?',
    alternativ: [
      { id: 'a', text: 'Säga till eleven att det är okej att göra misstag.' },
      { id: 'b', text: 'Lova en förälder att eleven kommer att få ett visst betyg.' },
      { id: 'c', text: 'Höra av dig till Nextrum när du känner dig obekväm i en situation.' },
      { id: 'd', text: 'Låta eleven välja mellan två sätt att arbeta.' },
    ],
    ratt: 'b',
  },
  {
    id: 'sekretess', avsnitt: 'svart',
    fraga: 'En kompis frågar hur det går för eleven du hjälper. Vad gäller?',
    alternativ: [
      { id: 'a', text: 'Det går bra att berätta så länge du inte säger elevens efternamn.' },
      { id: 'b', text: 'Det går bra att berätta positiva saker.' },
      { id: 'c', text: 'Du berättar ingenting. Information om eleven delas bara med dem som behöver den i arbetet.' },
      { id: 'd', text: 'Det går bra om du inte har skrivit på något avtal om tystnad.' },
    ],
    ratt: 'c',
  },
  {
    id: 'angest', avsnitt: 'svart',
    fraga: 'En elev berättar att hen har mycket ångest och ber dig lova att inte säga något till någon. Vad gör du?',
    alternativ: [
      { id: 'a', text: 'Lovar att det stannar mellan er, så att eleven fortsätter lita på dig.' },
      { id: 'b', text: 'Försöker lista ut vilken diagnos eleven kan ha och ger råd.' },
      { id: 'c', text: 'Byter ämne, eftersom det inte hör till läxhjälpen.' },
      { id: 'd', text: 'Lyssnar lugnt, tackar för förtroendet, lovar inte fullständig tystnad och följer Nextrums rutiner.' },
    ],
    ratt: 'd',
  },
  {
    id: 'sjalvskada', avsnitt: 'svart',
    fraga: 'En elev säger något om att skada sig själv, men verkar skämta. Vad gäller?',
    alternativ: [
      { id: 'a', text: 'Du tar det alltid på största allvar: behåller lugnet, lyssnar, dokumenterar och följer Nextrums rutiner direkt. Du hanterar det aldrig på egen hand.' },
      { id: 'b', text: 'Skämtar eleven behöver du inte göra något.' },
      { id: 'c', text: 'Du bedömer själv hur allvarligt det är innan du säger något till någon.' },
      { id: 'd', text: 'Du pratar med eleven om det varje lektion tills det känns bättre.' },
    ],
    ratt: 'a',
  },
  {
    id: 'far-illa', avsnitt: 'svart',
    fraga: 'Eleven berättar något som gör att du misstänker att hen far illa hemma. Vad gör du?',
    alternativ: [
      { id: 'a', text: 'Frågar ut eleven och föräldrarna för att ta reda på vad som hänt innan du säger något.' },
      { id: 'b', text: 'Dokumenterar vad som sagts och observerats, med tid och sammanhang, och kontaktar Nextrum och socialtjänsten så snart som möjligt.' },
      { id: 'c', text: 'Väntar och ser om det händer igen, så att du är säker.' },
      { id: 'd', text: 'Tar upp det med föräldern vid nästa lektion.' },
    ],
    ratt: 'b',
  },
  {
    id: 'foralder', avsnitt: 'svart',
    fraga: 'En förälder är nedvärderande och aggressiv mot eleven under passet. Hur gör du?',
    alternativ: [
      { id: 'a', text: 'Säger ifrån till föräldern direkt, så att eleven ser att du står på hens sida.' },
      { id: 'b', text: 'Låtsas att du inte märkte något, det är familjens sak.' },
      { id: 'c', text: 'Behåller ett professionellt bemötande, går inte in i en konflikt, dokumenterar objektivt och berättar för Nextrum.' },
      { id: 'd', text: 'Avbryter passet och går utan att säga något.' },
    ],
    ratt: 'c',
  },
  {
    id: 'vagrar', avsnitt: 'svart',
    fraga: 'Eleven vägrar arbeta. Vad gör du?',
    alternativ: [
      { id: 'a', text: 'Säger bestämt att ni inte slutar förrän uppgiften är klar.' },
      { id: 'b', text: 'Säger till föräldern att eleven är lat.' },
      { id: 'c', text: 'Låter eleven göra något annat resten av passet.' },
      { id: 'd', text: 'Undviker en maktkamp, försöker förstå varför och förenklar uppgiften, byter arbetssätt eller ger eleven ett val.' },
    ],
    ratt: 'd',
  },
  {
    id: 'barnkonventionen', avsnitt: 'svart',
    fraga: 'Vad innebär barnkonventionen för dig som studiehjälpare?',
    alternativ: [
      { id: 'a', text: 'Den är svensk lag, och barnets bästa ska alltid beaktas i beslut som rör barnet.' },
      { id: 'b', text: 'Den är en rekommendation som bara gäller skolor.' },
      { id: 'c', text: 'Att föräldern alltid bestämmer vad som är bäst för barnet.' },
      { id: 'd', text: 'Att barn under 15 inte får ha läxhjälp utan en förälder i rummet.' },
    ],
    ratt: 'a',
  },
];

export type PublikFraga = {
  id: string;
  avsnitt: string;
  fraga: string;
  alternativ: Alternativ[];
};

/**
 * Frågorna som sidan får dem: utan svaret, med alternativen i ny
 * ordning varje gång. Ordningen på frågorna står still, för de är
 * grupperade per avsnitt som i handboken.
 */
export function publikaFragor(slump: () => number = Math.random): PublikFraga[] {
  return FRAGOR.map((f) => {
    const alt = f.alternativ.map((a) => ({ id: a.id, text: a.text }));
    for (let i = alt.length - 1; i > 0; i--) {
      const j = Math.floor(slump() * (i + 1));
      [alt[i], alt[j]] = [alt[j], alt[i]];
    }
    return { id: f.id, avsnitt: AVSNITT[f.avsnitt], fraga: f.fraga, alternativ: alt };
  });
}

export type Rattat = {
  ratt: number;
  antal: number;
  godkant: boolean;
  /** Frågor utan ett giltigt svar. Ett försök med obesvarade frågor rättas inte. */
  obesvarade: string[];
  /** Per avsnitt, i handbokens ordning. Aldrig per fråga, se filhuvudet. */
  avsnitt: { namn: string; ratt: number; antal: number }[];
  /** Svaren som de lagras: bara id:n provet känner igen. */
  svar: Record<string, string>;
};

/**
 * Rättar ett försök. svar kommer från webbläsaren och är alltså vad
 * som helst: allt som inte är en känd fråga med ett känt alternativ
 * räknas som obesvarat, och okända nycklar följer inte med till
 * databasen.
 */
export function ratta(svar: unknown): Rattat {
  const in_ = (svar && typeof svar === 'object' && !Array.isArray(svar))
    ? svar as Record<string, unknown> : {};
  const rent: Record<string, string> = {};
  const obesvarade: string[] = [];
  const perAvsnitt = new Map<AvsnittId, { ratt: number; antal: number }>();
  let ratt = 0;

  for (const f of FRAGOR) {
    const val = Object.prototype.hasOwnProperty.call(in_, f.id) ? in_[f.id] : undefined;
    const giltigt = typeof val === 'string' && f.alternativ.some((a) => a.id === val);
    const a = perAvsnitt.get(f.avsnitt) ?? { ratt: 0, antal: 0 };
    a.antal++;
    if (!giltigt) {
      obesvarade.push(f.id);
    } else {
      rent[f.id] = val as string;
      if (val === f.ratt) {
        ratt++;
        a.ratt++;
      }
    }
    perAvsnitt.set(f.avsnitt, a);
  }

  const antal = FRAGOR.length;
  return {
    ratt,
    antal,
    godkant: obesvarade.length === 0 && ratt >= kravRatt(antal),
    obesvarade,
    avsnitt: (Object.keys(AVSNITT) as AvsnittId[])
      .filter((k) => perAvsnitt.has(k))
      .map((k) => ({ namn: AVSNITT[k], ...perAvsnitt.get(k)! })),
    svar: rent,
  };
}
