// ============================================================
// NEXTRUM — utbildningsprovet (Fas 22.1)
//
// Tjugofem flervalsfrågor om Handledarhandboken, som gås igenom på
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
// en rimlig människa kan tro på. Alternativen blandas om vid varje
// hämtning.
//
// Formen får inte avslöja svaret. Första versionen hade det längsta
// alternativet rätt i 25 av 30 frågor, och den som alltid valde det
// längsta klarade provet utan att ha läst handboken. Nu är de fel lika
// utförliga som det rätta, och Nextrum och rutinerna står också i fel
// alternativ. Proven i utbildningsprov_test.ts räknar vad en tumregel
// ger; skriver du om en fråga, kör dem.
//
// Ändras en fråga ska id:t bytas om svaret byter betydelse:
// utbildningsprov_forsok.svar lagrar id:n, och ett gammalt försök ska
// inte se ut att ha svarat på en ny fråga.
//
// Tiden: 25 frågor med fyra alternativ, de flesta scenarier, är
// omkring 15 till 20 minuter för den som läser ordentligt. Uppdraget var 15 till
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
      { id: 'a', text: 'Att eleven får så höga resultat som möjligt på nästa prov, så att familjen ser att läxhjälpen ger något.' },
      { id: 'b', text: 'Att eleven på lång sikt blir en självständig och trygg lärande individ med goda studievanor.' },
      { id: 'c', text: 'Att eleven blir klar med sina läxor varje vecka, så att inget ligger efter inför proven.' },
      { id: 'd', text: 'Att gå igenom kursens innehåll en gång till, i samma ordning och takt som läraren, så att eleven hänger med i klassen.' },
    ],
    ratt: 'b',
  },
  {
    id: 'metod', avsnitt: 'grund',
    fraga: 'Du vet inte vilket arbetssätt som passar din nya elev bäst. Vad gör du?',
    alternativ: [
      { id: 'a', text: 'Frågar eleven hur hen lär sig bäst första gången ni ses, och håller dig sedan till det svaret resten av terminen.' },
      { id: 'b', text: 'Använder muntliga genomgångar, eftersom de fungerar för de flesta elever i den åldern.' },
      { id: 'c', text: 'Provar olika arbetssätt, ser vad som håller elevens fokus och noterar vad som fungerar.' },
      { id: 'd', text: 'Väntar tills föräldern har berättat vilken metod skolan använder, så att ni inte krockar med läraren.' },
    ],
    ratt: 'c',
  },
  {
    id: 'intresse', avsnitt: 'grund',
    fraga: 'Din elev älskar fotboll men tycker att procent är tråkigt. Hur använder du intresset bäst?',
    alternativ: [
      { id: 'a', text: 'Ni räknar procent på riktiga matchresultat och statistik, så att matten känns meningsfull.' },
      { id: 'b', text: 'Ni pratar fotboll den första halvan av passet, så att eleven kommer i gott humör inför matten efteråt.' },
      { id: 'c', text: 'Du håller fotbollen utanför passet helt, eftersom den tar fokus från det eleven ska lära sig.' },
      { id: 'd', text: 'Eleven får välja fritt vad ni pratar om, så länge hen trivs och vill komma tillbaka.' },
    ],
    ratt: 'a',
  },
  {
    id: 'material', avsnitt: 'grund',
    fraga: 'Vilket material ska du i första hand utgå från?',
    alternativ: [
      { id: 'a', text: 'Ditt eget material, eftersom du vet vad som har fungerat för dig och kan förklara det bäst.' },
      { id: 'b', text: 'Övningsblad från internet som täcker hela kursen, så att eleven får träna på allt inför terminen.' },
      { id: 'c', text: 'Det som eleven tycker är roligast just nu.' },
      { id: 'd', text: 'Elevens läroböcker och uppgifter från skolan, lärarens instruktioner och kommande prov.' },
    ],
    ratt: 'd',
  },
  {
    id: 'eget-material', avsnitt: 'grund',
    fraga: 'När är det rätt att använda eget material, till exempel extra övningar eller en egen bild?',
    alternativ: [
      { id: 'a', text: 'Aldrig. Handledningen ska bara använda det material som skolan och läraren har delat ut.' },
      { id: 'b', text: 'Som ett komplement när det behövs, inte som en ersättning för det eleven gör i skolan.' },
      { id: 'c', text: 'Alltid, så att eleven får en egen undervisning vid sidan av skolan som går lite längre.' },
      { id: 'd', text: 'Bara de veckor då eleven inte har några läxor eller prov att förbereda sig inför.' },
    ],
    ratt: 'b',
  },

  // ---------- En trygg lärmiljö ----------
  {
    id: 'fel-svar', avsnitt: 'trygg',
    fraga: 'Eleven svarar fel på en fråga. Vilket svar följer handboken?',
    alternativ: [
      { id: 'a', text: '"Nej, det blev fel. Försök igen."' },
      { id: 'b', text: '"Det här borde du kunna vid det här laget, vi gick ju igenom samma sak förra veckan."' },
      { id: 'c', text: '"Din klasskompis fick samma uppgift och klarade den, så jag vet att du också kan."' },
      { id: 'd', text: '"Jag förstår hur du tänkte. Ska vi titta på det tillsammans?"' },
    ],
    ratt: 'd',
  },
  {
    id: 'dalig-pa-matte', avsnitt: 'trygg',
    fraga: 'Eleven säger: "Jag är dålig på matte." Vad svarar du?',
    alternativ: [
      { id: 'a', text: '"Det är svårt just nu, men det betyder inte att du inte kan lära dig det. Vi tar det steg för steg."' },
      { id: 'b', text: '"Nej, det är du inte alls. Du är jätteduktig egentligen, du tror bara att du är dålig på det."' },
      { id: 'c', text: '"Det är okej, alla kan inte vara bra på matte. Vi fokuserar på att du klarar provet."' },
      { id: 'd', text: '"Då får vi köra extra hårt de närmaste veckorna, så att du slipper känna så längre."' },
    ],
    ratt: 'a',
  },
  {
    id: 'berom', avsnitt: 'trygg',
    fraga: 'Vad ska ditt beröm i första hand handla om?',
    alternativ: [
      { id: 'a', text: 'Att eleven är smart och har talang för ämnet, så att hen får tro på sig själv.' },
      { id: 'b', text: 'Bara rätta svar, så att berömmet betyder något när det väl kommer.' },
      { id: 'c', text: 'Ansträngningen och strategin, till exempel att eleven delade upp problemet.' },
      { id: 'd', text: 'Att eleven gör det bättre än sina klasskompisar, eftersom det motiverar mest.' },
    ],
    ratt: 'c',
  },
  {
    id: 'tystnad', avsnitt: 'trygg',
    fraga: 'Eleven blir tyst en stund efter din fråga. Vad gör du?',
    alternativ: [
      { id: 'a', text: 'Förklarar direkt en gång till på ett annat sätt, så att tystnaden inte hinner bli obekväm.' },
      { id: 'b', text: 'Väntar några sekunder och frågar sedan: "Hur tänker du?"' },
      { id: 'c', text: 'Ger svaret och visar hur man kommer fram till det, så att ni hinner mer under passet.' },
      { id: 'd', text: 'Går vidare till nästa uppgift.' },
    ],
    ratt: 'b',
  },
  {
    id: 'undvik', avsnitt: 'trygg',
    fraga: 'Vad ska du undvika enligt handboken?',
    alternativ: [
      { id: 'a', text: 'Att låta eleven göra misstag.' },
      { id: 'b', text: 'Att fråga vad eleven själv tror är nästa steg, eftersom det kan göra hen osäker.' },
      { id: 'c', text: 'Att anpassa svårighetsgraden efter eleven i stället för att följa klassens nivå.' },
      { id: 'd', text: 'Sarkasm och att jämföra eleven med andra elever.' },
    ],
    ratt: 'd',
  },
  {
    id: 'svarighet', avsnitt: 'trygg',
    fraga: 'Hur svåra ska uppgifterna vara?',
    alternativ: [
      { id: 'a', text: 'Så att eleven utmanas men kan lyckas med stöd.' },
      { id: 'b', text: 'Så lätta att eleven alltid lyckas, för att bygga upp självförtroendet först.' },
      { id: 'c', text: 'Så svåra som möjligt, eftersom det är när man kämpar som man lär sig mest.' },
      { id: 'd', text: 'På samma nivå som resten av klassen, så att eleven inte halkar efter.' },
    ],
    ratt: 'a',
  },

  // ---------- Aktivt lärande och studieteknik ----------
  {
    id: 'fastnar', avsnitt: 'aktiv',
    fraga: 'Eleven har fastnat på en uppgift. Vad gör du först?',
    alternativ: [
      { id: 'a', text: 'Visar hela lösningen steg för steg, så att eleven ser hur man gör och kan härma det.' },
      { id: 'b', text: 'Säger att ni hoppar över den nu och tar den nästa gång, när eleven är piggare.' },
      { id: 'c', text: 'Frågar vilken del som känns svårast, i stället för att ge svaret.' },
      { id: 'd', text: 'Förklarar samma sak en gång till, långsammare och med andra ord.' },
    ],
    ratt: 'c',
  },
  {
    id: 'chunking', avsnitt: 'aktiv',
    fraga: 'Eleven ska plugga ett helt kapitel och känner sig överväldigad. Vilken teknik hjälper mest just då?',
    alternativ: [
      { id: 'a', text: 'Interleaving: blanda in uppgifter från andra kapitel och ämnen, så att det blir variation.' },
      { id: 'b', text: 'Att läsa hela kapitlet flera gånger i rad.' },
      { id: 'c', text: 'Spaced repetition: vänta några dagar innan ni börjar, så att det hinner sjunka in.' },
      { id: 'd', text: 'Chunking: dela upp kapitlet och ta ett begrepp i taget.' },
    ],
    ratt: 'd',
  },
  {
    id: 'recall', avsnitt: 'aktiv',
    fraga: 'Vilket är ett exempel på active recall (aktiv återhämtning)?',
    alternativ: [
      { id: 'a', text: 'Eleven förklarar med egna ord det ni gick igenom förra veckan, utan boken.' },
      { id: 'b', text: 'Eleven läser samma sida tre gånger och markerar det som känns viktigast.' },
      { id: 'c', text: 'Eleven stryker under det viktigaste i texten och skriver av det i sitt block.' },
      { id: 'd', text: 'Du sammanfattar lektionen för eleven, så att hen har allt samlat på ett ställe.' },
    ],
    ratt: 'a',
  },
  {
    id: 'spaced', avsnitt: 'aktiv',
    fraga: 'Vad innebär spaced repetition (utspridd repetition)?',
    alternativ: [
      { id: 'a', text: 'Att plugga intensivt kvällen före provet.' },
      { id: 'b', text: 'Att göra tio likadana uppgifter i rad, så att metoden sätter sig ordentligt.' },
      { id: 'c', text: 'Att repetera med allt längre mellanrum, innan kunskapen hunnit glömmas.' },
      { id: 'd', text: 'Att repetera allt som eleven har läst varje dag, i samma takt hela terminen.' },
    ],
    ratt: 'c',
  },

  // ---------- Dokumentation och första lektionen ----------
  {
    id: 'dokumentera-vad', avsnitt: 'forsta',
    fraga: 'Vad ska du dokumentera efter varje lektion?',
    alternativ: [
      { id: 'a', text: 'Hur länge passet varade och vilka sidor i boken ni hann med, så att familjen kan se tiden.' },
      { id: 'b', text: 'Din personliga uppfattning om elevens familj och hemsituation, så att nästa studiehjälpare vet.' },
      { id: 'c', text: 'Ingenting om lektionen gick bra. Det räcker att skriva när något har gått snett.' },
      { id: 'd', text: 'Vad ni gjorde, vad eleven kan, vad som ska utvecklas, vilka metoder som fungerade och nästa mål.' },
    ],
    ratt: 'd',
  },
  {
    id: 'dokumentera-var', avsnitt: 'forsta',
    fraga: 'Var dokumenterar du lektionen?',
    alternativ: [
      { id: 'a', text: 'I Nextrums system, i rapporten efter passet.' },
      { id: 'b', text: 'I ett eget dokument på din dator, som du tar med dig till nästa pass.' },
      { id: 'c', text: 'I ett mejl till Nextrum efter passet.' },
      { id: 'd', text: 'I en chatt med eleven, så att ni båda kan gå tillbaka och läsa.' },
    ],
    ratt: 'a',
  },
  {
    id: 'forsta-mal', avsnitt: 'forsta',
    fraga: 'Vad är huvudmålet med den första lektionen?',
    alternativ: [
      { id: 'a', text: 'Att hinna gå igenom så mycket av kursen som möjligt, så att familjen ser att det ger resultat direkt.' },
      { id: 'b', text: 'Att ge eleven ett diagnostiskt prov med betyg, så att ni vet exakt var ni står.' },
      { id: 'c', text: 'Att bygga förtroende och förstå elevens behov, nivå och sätt att plugga.' },
      { id: 'd', text: 'Att gå igenom reglerna för passen och vad som händer om eleven inte har gjort läxan.' },
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
      { id: 'a', text: 'Du sammanfattar vad ni gjort, vad som fungerade och vad nästa lektion ska handla om.' },
      { id: 'b', text: 'Du ger eleven en lista på allt hen behöver bli bättre på, så att hen vet var ni ska lägga fokus.' },
      { id: 'c', text: 'Ni slutar när tiden är slut.' },
      { id: 'd', text: 'Du ger eleven ett prov att göra hemma till nästa gång, så att du ser vad som har fastnat.' },
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
      { id: 'c', text: 'Höra av dig till Nextrum när du känner dig obekväm i en situation med en familj.' },
      { id: 'd', text: 'Låta eleven välja mellan två olika sätt att arbeta med samma uppgift.' },
    ],
    ratt: 'b',
  },
  {
    id: 'sekretess', avsnitt: 'svart',
    fraga: 'En kompis frågar hur det går för eleven du hjälper. Vad gäller?',
    alternativ: [
      { id: 'a', text: 'Det går bra att berätta så länge du inte säger elevens efternamn eller vilken skola hen går på.' },
      { id: 'b', text: 'Det går bra att berätta positiva saker, till exempel att eleven har höjt sig på ett prov.' },
      { id: 'c', text: 'Du berättar ingenting. Det om eleven delas bara med dem som behöver det i arbetet.' },
      { id: 'd', text: 'Det går bra så länge du inte har skrivit under något avtal om tystnadsplikt med Nextrum.' },
    ],
    ratt: 'c',
  },
  {
    id: 'sjalvskada', avsnitt: 'svart',
    fraga: 'En elev säger något om att skada sig själv, men verkar skämta. Vad gäller?',
    alternativ: [
      { id: 'a', text: 'Du tar det alltid på allvar: lyssnar, dokumenterar och följer Nextrums rutiner direkt, aldrig på egen hand.' },
      { id: 'b', text: 'Skämtar eleven behöver du inte göra något, men du skriver en rad om det i rapporten.' },
      { id: 'c', text: 'Du bedömer själv hur allvarligt det är innan du säger något, så att du inte oroar familjen i onödan.' },
      { id: 'd', text: 'Du pratar med eleven om det varje lektion tills det känns bättre, och berättar för Nextrum om det inte gör det.' },
    ],
    ratt: 'a',
  },
  {
    id: 'vagrar', avsnitt: 'svart',
    fraga: 'Eleven vägrar arbeta. Vad gör du?',
    alternativ: [
      { id: 'a', text: 'Säger bestämt att ni inte slutar förrän uppgiften är klar, så att eleven lär sig att det inte lönar sig.' },
      { id: 'b', text: 'Säger till föräldern efter passet att eleven är lat och behöver mer disciplin hemma.' },
      { id: 'c', text: 'Låter eleven göra något annat resten av passet och skriver i rapporten att hen inte ville.' },
      { id: 'd', text: 'Undviker en maktkamp, försöker förstå varför och förenklar uppgiften eller ger eleven ett val.' },
    ],
    ratt: 'd',
  },
  {
    id: 'barnkonventionen', avsnitt: 'svart',
    fraga: 'Vad innebär barnkonventionen för dig som studiehjälpare?',
    alternativ: [
      { id: 'a', text: 'Den är svensk lag, och barnets bästa ska beaktas i beslut som rör barnet.' },
      { id: 'b', text: 'Den är en rekommendation från FN som bara gäller skolor och myndigheter, inte läxhjälp.' },
      { id: 'c', text: 'Att föräldern alltid bestämmer vad som är bäst för barnet, också under passet.' },
      { id: 'd', text: 'Att barn under 15 år inte får ha läxhjälp utan att en förälder är med i rummet.' },
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

export type Genomgang = {
  nr: number;
  avsnitt: string;
  fraga: string;
  ditt: string | null;
  ratt: string;
  stammer: boolean;
}[];

/**
 * Fråga för fråga, med facit: bara för admin som provar provet
 * (2026-10-02). Den som söker får aldrig det här, se filhuvudet: med
 * svaret per fråga går provet att klara på tre försök utan att ha läst
 * något. Funktionen prövar inte vem som frågar; det gör anroparen,
 * innan den anropas.
 */
export function genomgang(svar: Record<string, string>): Genomgang {
  return FRAGOR.map((f, i) => {
    const valt = f.alternativ.find((a) => a.id === svar[f.id]);
    return {
      nr: i + 1,
      avsnitt: AVSNITT[f.avsnitt],
      fraga: f.fraga,
      ditt: valt ? valt.text : null,
      ratt: f.alternativ.find((a) => a.id === f.ratt)!.text,
      stammer: svar[f.id] === f.ratt,
    };
  });
}
