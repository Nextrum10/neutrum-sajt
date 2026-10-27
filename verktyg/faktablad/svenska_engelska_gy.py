# -*- coding: utf-8 -*-
"""Faktabladen för Svenska gy1–gy3 och Engelska gy1–gy3 (2026-10-27). Skrivna område för område efter nivåernas frågor och förklaringar, med exempel på andra ord än bankens, och för engelskan på svenska med exemplen på engelska."""
from fakta import blad

FAKTABLAD = [
    # ------------------------------------------------------------------
    # Svenska gy1
    # ------------------------------------------------------------------
    blad("Svenska", "gy1", "Språket och samhället",
         mal=["Placera svenskan och andra språk i rätt språkfamilj och språkgrupp.",
              "Räkna upp Sveriges fem nationella minoritetsspråk.",
              "Skilja på dialekt, sociolekt, etnolekt och idiolekt.",
              "Förklara varför du anpassar språket efter situationen."],
         fakta=["Svenskan är ett nordgermanskt språk. De germanska språken hör till den indoeuropeiska språkfamiljen, "
                "liksom de romanska (franska, italienska) och de slaviska (ryska, tjeckiska).",
                "Finska, estniska och samiska hör inte till den indoeuropeiska familjen utan till den uraliska.",
                "Sverige har fem nationella minoritetsspråk: finska, meänkieli, samiska, romani chib och jiddisch.",
                "Språket varierar med var du bor, vilken grupp du hör till och vem du är. Ingen variant är fel, "
                "och standardsvenskan är den gemensamma svenska som uppfattas som neutral.",
                "Du väljer ord och stil efter mottagare och situation. Talspråk som ”typ” och ”liksom” passar sällan "
                "i en formell text."],
         exempel=[("Hör norska och portugisiska till samma språkfamilj?",
                   "Ja. Norska är germanskt och portugisiska romanskt, men båda grupperna hör till den indoeuropeiska "
                   "familjen.")],
         ord=[("besläktade språk", "språk som har utvecklats ur samma äldre språk"),
              ("dialekt", "variant av språket som hör ihop med en plats"),
              ("sociolekt", "variant som hör ihop med en social grupp, till exempel ålder eller yrke"),
              ("etnolekt", "variant som präglas av en flerspråkig miljö"),
              ("idiolekt", "en enskild persons eget sätt att tala och skriva"),
              ("kodväxling", "att växla mellan två språk i samma samtal")],
         tips="Skilj på nivåerna: ett språk hör till en grupp, som de germanska, och gruppen till en större familj, "
              "som den indoeuropeiska."),

    blad("Svenska", "gy1", "Argumentation",
         mal=["Hitta tes, argument, underargument, motargument och bemötande i en text.",
              "Pröva om ett argument är hållbart och relevant.",
              "Känna igen vanliga argumentationsfel, som personangrepp, halmgubbe och falskt dilemma."],
         fakta=["Tesen är det skribenten vill övertyga om. Argumenten är skäl för tesen, och ett underargument "
                "stöder ett argument.",
                "Ett motargument talar emot tesen. I ett bemötande visar skribenten varför motargumentet inte räcker.",
                "Ett argument är hållbart om det är sant eller väl underbyggt, och relevant om det hänger ihop med "
                "tesen. Ett sant argument kan ändå vara irrelevant.",
                "Ett argumentationsfel kan låta övertygande men håller inte när du granskar det. Vem som säger något, "
                "eller hur många som tycker likadant, avgör inte om det är sant."],
         exempel=[("Tes: ”Skolan bör ha längre lunchrast.” Är ”Jag gillar pizza” ett relevant argument?",
                   "Nej. Det kan vara sant, men det säger inget om varför rasten borde vara längre. Ett relevant "
                   "argument vore att eleverna hinner både äta och vila.")],
         ord=[("personangrepp", "att angripa personen i stället för argumentet"),
              ("halmgubbe", "att förvränga motståndarens åsikt och angripa den förvrängda versionen"),
              ("falskt dilemma", "att framställa det som om det bara fanns två alternativ"),
              ("cirkelresonemang", "när skälet bara upprepar påståendet"),
              ("förhastad generalisering", "en allmän slutsats dragen av ett eller några få fall"),
              ("hänvisning till majoriteten", "att något sägs vara rätt för att många gör eller tycker så")],
         tips="Fråga dig om ett svar angriper argumentet eller personen: bara det första är sakligt."),

    blad("Svenska", "gy1", "Källor",
         mal=["Skilja på primärkällor och sekundärkällor.",
              "Känna igen tendens och beroende i en källa.",
              "Skilja på referat, citat och plagiat, och veta när du ska ange källan."],
         fakta=["En primärkälla kommer direkt från händelsen, som ett originaldokument eller ett vittne. "
                "En sekundärkälla återger vad andra källor sagt, som en lärobok eller en uppslagsbok.",
                "En källa har tendens när avsändaren har ett intresse av att vinkla. Den kan ändå vara användbar, "
                "om du vet om tendensen.",
                "En källa är beroende när den bygger på vad någon annan sagt. Kontrollera en uppgift hos flera "
                "oberoende källor, och kom ihåg att ny inte betyder sann.",
                "Ett referat återger innehållet med egna ord, ett citat återger exakta ord inom citattecken. "
                "Ange källan i båda fallen: annars är det plagiat.",
                "Källförteckningen ger det läsaren behöver för att hitta källan, som författare, titel och år."],
         exempel=[("Är ett brev som en strejkande arbetare skrev 1909 en primär- eller sekundärkälla om strejken?",
                   "En primärkälla: brevet kommer direkt från en person som var med. Det kan ändå ha en tendens.")],
         ord=[("referentgranskning", "när andra forskare granskar en vetenskaplig artikel innan den publiceras"),
              ("referatmarkör", "ord som visar vems tankar det är, som enligt, menar och skriver")],
         tips="Fråga dig vem som står bakom en källa och vad hen vill uppnå: då ser du tendensen."),

    blad("Svenska", "gy1", "Grammatik",
         mal=["Skilja på konjunktion, subjunktion och infinitivmärke.",
              "Känna igen presens particip.",
              "Känna igen relativa bisatser, att-satser och adverbiella bisatser, och säga vilken satsdel de är.",
              "Placera ”inte” rätt i en bisats."],
         fakta=["Konjunktioner (och, men, eller, för) binder ihop led av samma slag, till exempel två huvudsatser. "
                "Subjunktioner (att, eftersom, när, om, därför att) inleder bisatser.",
                "”Att” framför ett verb i infinitiv är ett infinitivmärke: Hon älskar att läsa. ”Att” som inleder "
                "en bisats är en subjunktion: Hon sa att det regnade.",
                "Presens particip slutar på -ande eller -ende och används ofta som adjektiv: en skrattande flicka.",
                "En relativ bisats beskriver ett ord före sig och inleds ofta med som, där eller vars. En att-sats är "
                "ofta objekt, och en adverbiell bisats säger när, varför eller hur och är adverbial.",
                "I en bisats står ”inte” och andra satsadverbial före det finita verbet: … att han inte kommer. "
                "I en huvudsats står det efter: Han kommer inte."],
         exempel=[("Vilken satsdel är bisatsen i ”Hon berättade att hon hade flyttat.”?",
                   "Fråga: Vad berättade hon? Att hon hade flyttat. Bisatsen svarar på vad, så den är objekt.")],
         ord=[("finit verb", "verbet som är böjt i tempus, som springer eller sprang"),
              ("satsadverbial", "ord som inte, aldrig och kanske, som säger något om hela satsen")],
         tips="Kom ihåg BIFF: i Bisatser står Inte Före det Finita verbet."),

    blad("Svenska", "gy1", "Litteratur",
         mal=["Känna igen liknelse, metafor, personifikation och allitteration.",
              "Skilja på tema och motiv, och förklara vad det betyder att gestalta.",
              "Avgöra vem som berättar och vad berättaren kan veta.",
              "Läsa en krönika och hitta huvudtanken och det som står mellan raderna."],
         fakta=["En liknelse jämför med ”som”: kall som is. En metafor säger att något är något annat. "
                "En personifikation ger en sak mänskliga egenskaper. Allitteration är ord i rad med samma första ljud.",
                "Temat är det övergripande texten handlar om, till exempel svek eller vänskap. Ett motiv är en "
                "återkommande situation i litteraturen, som hämnden eller hemkomsten.",
                "Att gestalta är att visa känslor genom handlingar och detaljer i stället för att säga dem rakt ut.",
                "En allvetande berättare vet vad alla personer tänker och känner. En jagberättare är en person i "
                "texten och inte samma sak som författaren.",
                "En krönika är en personlig text, ofta med ett jag, där en vardaglig händelse leder fram till en "
                "större tanke."],
         exempel=[("Vad gestaltar meningen ”Han stod länge i dörren och vågade inte knacka.”?",
                   "Tvekan eller nervositet. Känslan sägs inte, men handlingen visar den.")],
         ord=[("novell", "kort berättelse med få personer, ofta med en vändpunkt"),
              ("huvudtanke", "det viktigaste skribenten vill säga med hela texten")],
         tips="Läs krönikans slut extra noga: där brukar den större tanken bli tydlig."),

    blad("Svenska", "gy1", "NP-träning: argumentera och referera",
         mal=["Känna igen ethos, pathos och logos och förklara vad som gör ett tal övertygande.",
              "Skriva en tes och bygga argument med belägg och hänvisningar till källor.",
              "Återge ett motargument rättvist och bemöta det sakligt.",
              "Skriva ett neutralt referat med referatmarkörer."],
         fakta=["Ethos bygger på talarens trovärdighet, pathos på känslor och logos på fakta och logik. Ett tal kan "
                "använda alla tre, och det formas efter mottagare, syfte och situation.",
                "Tesen är det du vill övertyga om, argumenten är skäl för den och belägg är fakta, statistik eller "
                "exempel som stöder ett argument.",
                "Återge ett motargument rättvist innan du bemöter det. Avsluta med tesen i nya ord och de viktigaste "
                "argumenten, utan ny information.",
                "Ett referat skrivs i presens och utan egna värderingar, med referatmarkörer som menar, skriver och "
                "konstaterar. Ange källan i löptexten, till exempel med författare, titel och år.",
                "Hänvisa alltid till de källor du använder, och utveckla och värdera det de säger i stället för att "
                "bara återge det."],
         exempel=[("Gör om till ett neutralt referat: ”Lindqvist skriver klokt att unga läser för lite.”",
                   "Stryk värderingen ”klokt”: ”Lindqvist skriver att unga läser för lite.”")],
         ord=[("belägg", "fakta, statistik eller exempel som stöder ett argument"),
              ("bindeord", "ord som visar hur tankarna hänger ihop, som alltså, dessutom och å andra sidan")],
         tips="Skriv ”enligt” eller ”menar” när du återger en källa och ”jag anser” när du tycker själv, så att "
              "läsaren ser skillnaden."),

    blad("Svenska", "gy1", "Läsa: NP-träning",
         mal=["Analysera ett tal med ethos, pathos och logos, mottagare och syfte.",
              "Hitta innehåll, syfte och olika synsätt i en sakprosatext.",
              "Tolka berättarperspektiv, symboler och tema i en berättelse.",
              "Skilja på referat, citat och egen åsikt när du återger en artikel."],
         fakta=["Läs hela texten först. Gå sedan tillbaka till rätt stycke för varje fråga, och svara utifrån det "
                "som står där.",
                "Skilj på det som står i texten och det du kan dra slutsatser om. Ett påstående är sant bara om "
                "texten stöder det.",
                "Fråga dig vad texten vill: informera, övertyga eller berätta. En informerande text kan beskriva "
                "flera synsätt utan att själv ta ställning.",
                "I ett tal är tesen det talaren vill att publiken ska tycka, mottagaren de talet riktar sig till och "
                "syftet det talaren vill uppnå. Ethos, pathos och logos är tre sätt att övertyga.",
                "I en berättelse kan en sak eller en plats symbolisera något större, som en känsla eller en del av "
                "livet. Temat är det hela berättelsen handlar om."],
         ord=[("symbol", "något konkret som står för något abstrakt"),
              ("tredjepersonsberättare", "berättar om personerna som hon, han eller med namn"),
              ("referatmarkör", "ord som enligt, menar och skriver, som visar vems tankar det är"),
              ("citat", "någons exakta ord inom citattecken")],
         tips="Stöd varje tolkning på något som faktiskt står i texten, till exempel en detalj eller en mening."),

    blad("Svenska", "gy1", "Skriva rätt",
         mal=["Sätta komma i uppräkningar, före ”men” och runt extra information.",
              "Använda kolon, citattecken och stor bokstav rätt.",
              "Välja rätt mellan fler och flera, var och vart, sin och hans, de och dem, många och mycket.",
              "Skriva ihop sammansatta ord."],
         fakta=["I en uppräkning skiljs leden åt med komma, men före ”och” vid sista ledet sätter du normalt inget. "
                "Binder ”men” ihop två huvudsatser sätter du komma före.",
                "En bisats som bara ger extra information, och går att stryka, står mellan kommatecken. Kolon kan "
                "inleda en uppräkning efter en hel sats, och citattecken visar ord som återges ordagrant.",
                "Namn på personer, platser och länder har stor bokstav. Språk, veckodagar och månader har liten: "
                "tyska, fredag, mars.",
                "Fler står vid jämförelse med ”än”, flera betyder ett antal. Vart gäller riktning, var gäller plats. "
                "Vid likhet heter det lika … som. Många om det som går att räkna, mycket om resten.",
                "Sin syftar tillbaka på subjektet, hans och hennes på någon annan. De är subjekt och dem objekt. "
                "Sammansatta ord skrivs ihop: särskrivning är ett fel."],
         exempel=[("Sätt in komma: ”Hon ville åka men bussen var redan full.”",
                   "”Hon ville åka, men bussen var redan full.” Båda delarna kan stå som egna meningar."),
                  ("Välj ord: ”___ ligger nyckeln?”",
                   "Var: frågan gäller platsen där nyckeln finns, inte en riktning.")],
         ord=[("direkt anföring", "ord som återges ordagrant, inom citattecken")],
         tips="Osäker på de eller dem? Byt mot vi eller oss: passar ”oss” ska det vara ”dem”."),

    blad("Svenska", "gy1", "Språket förändras",
         mal=["Hitta huvudtanken i en krönika om hur språket förändras.",
              "Förklara hur nya ord kommer in i språket.",
              "Dra slutsatser om vad skribenten menar och se hur texten är byggd."],
         fakta=["Språket förändras hela tiden: nya ord skapas, gamla ord får nya betydelser och ord lånas från andra "
                "språk. Vissa ord blir kvar, andra försvinner.",
                "Ett lånord kommer från ett annat språk och anpassas ofta till svensk stavning och böjning.",
                "Ord kan också visa vilken grupp man hör till, till exempel bland unga.",
                "En krönika är personlig och utgår ofta från något vardagligt, som en egen upplevelse.",
                "Huvudtanken är det skribenten vill säga med hela texten, inte en enskild detalj. Jämför början och "
                "slutet för att hitta den."],
         exempel=[("Ordet ”dejt” kommer från engelskans ”date”. Vad har hänt med det i svenskan?",
                   "Det har fått svensk stavning och böjs som ett svenskt ord: en dejt, flera dejter.")],
         ord=[("lånord", "ord som har tagits in från ett annat språk"),
              ("nyord", "ett nytt ord, eller en ny betydelse, som börjar användas"),
              ("krönika", "personlig text som utgår från något vardagligt och leder till en tanke")],
         tips="När en fråga säger ”enligt texten” ska svaret stå i texten, inte vara din egen åsikt."),

    blad("Svenska", "gy1", "NP-träning: utredande text",
         mal=["Förklara vad en utredande text ska göra och hur den skiljer sig från en argumenterande.",
              "Formulera en frågeställning och göra en disposition.",
              "Skriva stycken med kärnmeningar i en saklig ton.",
              "Redovisa olika perspektiv med källor och avsluta med en källförteckning."],
         fakta=["En utredande text reder ut en fråga och ger läsaren förståelse. Den driver ingen tes, utan väger "
                "olika perspektiv mot varandra.",
                "Frågeställningen står i inledningen och ska gå att besvara med hjälp av källor. Avslutningen knyter "
                "an till den.",
                "Gör en disposition innan du skriver: vilka delar och aspekter ska med, och i vilken ordning? Varje "
                "stycke börjar gärna med en kärnmening som säger vad stycket handlar om.",
                "Skriv sakligt: välj neutrala ord i stället för värdeord och talspråk, och förklara svåra ord för "
                "läsaren.",
                "Ange vilken källa som säger vad, och visa när källorna är oense. Sist står källförteckningen med "
                "upphovsperson, titel och år."],
         exempel=[("Gör meningen saklig: ”Det är helt galet hur många som slutar idrotta.”",
                   "”Många slutar idrotta.” Värderingen ”helt galet” är borta, och påståendet står kvar.")],
         ord=[("frågeställning", "den fråga texten ska besvara"),
              ("aspekt", "en sida av frågan som tas upp"),
              ("disposition", "planen för textens delar och ordning"),
              ("värdeord", "ord som visar vad någon tycker, som ”katastrof”")],
         tips="Ställ frågeställningen som en hur- eller varför-fråga: då får du flera perspektiv att utreda."),

    # ------------------------------------------------------------------
    # Svenska gy2
    # ------------------------------------------------------------------
    blad("Svenska", "gy2", "Källkritiska kriterier",
         mal=["Förklara de fyra källkritiska kriterierna: äkthet, beroende, samtidighet och tendens.",
              "Välja vilket kriterium som väger tyngst för en viss källa.",
              "Avgöra hur många oberoende källor som står bakom en uppgift."],
         fakta=["Äkthet: är källan vad den utger sig för att vara? En oredigerad bild kan ändå vilseleda, om den sägs "
                "visa en annan händelse än den gör.",
                "Beroende: bygger källan på andra källor? Flera texter med samma ursprung räknas som en källa.",
                "Samtidighet: hur nära händelsen i tid och rum är källan? En källa nära händelsen väger i regel "
                "tyngre än en som skrevs långt senare.",
                "Tendens: finns det ett syfte eller intresse som kan färga källan, till exempel att sälja något? "
                "En källa med tendens är inte falsk, men den behöver jämföras med oberoende källor.",
                "Ta först reda på vem som står bakom en okänd webbplats och varför. Att många skriver samma sak gör "
                "det inte sant."],
         exempel=[("Fem webbplatser återger samma pressmeddelande från ett företag. Hur många oberoende källor är "
                   "det, och vilket kriterium är viktigast?",
                   "En enda, eftersom alla bygger på pressmeddelandet. Tendens är viktigt, för företaget har ett "
                   "intresse av att framstå i god dager.")],
         ord=[("oberoende källa", "en källa som inte bygger på samma ursprung som de andra"),
              ("kriterium", "en måttstock att pröva något mot, i plural kriterier")],
         tips="Fråga dig vem som tjänar på att du tror på källan: då hittar du tendensen."),

    blad("Svenska", "gy2", "Primär- och sekundärkällor",
         mal=["Avgöra om en källa är en primärkälla eller en sekundärkälla.",
              "Kontrollera uppgifter på nätet med oberoende källor, originalkällan, datum och bildsökning.",
              "Dra en slutsats om hur mycket du kan lita på en källa."],
         fakta=["En primärkälla kommer direkt från händelsen, som ett foto, en dagbok eller ett protokoll. "
                "En sekundärkälla beskriver händelsen i efterhand, som en lärobok.",
                "Både primär- och sekundärkällor kan ha tendens, och en sekundärkälla är inte alltid mindre "
                "trovärdig.",
                "Jämför ett påstående med flera oberoende källor, leta upp originalkällan för att se vad som "
                "faktiskt sades och i vilket sammanhang, och kontrollera när texten publicerades.",
                "En omvänd bildsökning visar var och när en bild har publicerats tidigare. En faktagranskande sajt "
                "kontrollerar om påståenden som sprids stämmer.",
                "En bedömning av en källa slutar med en slutsats om hur mycket du kan lita på den."],
         exempel=[("Du undersöker en skolstrejk. Vilken källa är primär: en lärares minnesanteckningar från samma "
                   "dag, eller en artikel skriven tio år senare?",
                   "Lärarens anteckningar: de kommer direkt från händelsen. Artikeln beskriver den i efterhand och "
                   "är en sekundärkälla.")],
         ord=[("originalkälla", "den källa där en uppgift först kom fram"),
              ("omvänd bildsökning", "att söka med en bild för att hitta var den har funnits förut")],
         tips="Två källor som bygger på varandra gör inte en uppgift säkrare: räkna bara de oberoende."),

    blad("Svenska", "gy2", "Litteraturens epoker",
         mal=["Beskriva allmänna drag i upplysningen, romantiken, realismen, naturalismen och modernismen.",
              "Känna igen epoken i ett kort textstycke.",
              "Ordna epokerna i tid och förklara varför de överlappar.",
              "Förklara fri vers och inre monolog."],
         fakta=["Upplysningen (1700-talet) trodde på förnuft och vetenskap. Romantiken (tidigt 1800-tal) var delvis en "
                "reaktion mot den, med känsla, natur och längtan i centrum.",
                "Realismen (1800-talets mitt och slut) skildrar vardagen och vanliga människors villkor sanningsenligt. "
                "Naturalismen går längre och visar hur människan formas av arv och miljö.",
                "Modernismen (från tidigt 1900-tal) bryter mot traditionen och experimenterar med form och språk, "
                "till exempel med fri vers och inre monolog. Den splittrade formen kan spegla en splittrad värld.",
                "En epok är en period då många författare skriver med liknande tankar och stil. Gränserna är inte "
                "skarpa, för nya idéer växer fram långsamt och epokerna överlappar.",
                "Nationalromantiken intresserade sig för det egna landets natur, historia och folkdikt."],
         exempel=[("Vilken epok passar bäst: ”Han vandrade ensam mot fjället, där stormen talade till hans själ om "
                   "allt han hade förlorat.”?",
                   "Romantiken: naturen, känslan och längtan står i centrum, och stormen får tala som en människa.")],
         ord=[("epok", "tidsperiod vars litteratur har gemensamma drag i tema och stil"),
              ("fri vers", "dikt utan rim och utan fast versmått"),
              ("inre monolog", "en persons tankar återgivna direkt, som en röst inne i huvudet")],
         tips="Se vart texten riktar blicken: mot naturen och känslan (romantiken), mot samhället och vardagen "
              "(realismen) eller mot en splittrad inre upplevelse (modernismen)."),

    blad("Svenska", "gy2", "Läsa och tolka",
         mal=["Avgöra vem som berättar en novell och i vilken ordning det händer.",
              "Tolka vad en sak i berättelsen kan stå för.",
              "Känna igen personifikation, liknelse och metafor.",
              "Beskriva stämningen och hur den förändras."],
         fakta=["Läs hela novellen först. Gå sedan tillbaka till texten för varje svar, och skilj på det "
                "som står och det du tolkar.",
                "Berättaren är rösten som berättar. En jagberättare är en person i berättelsen, och vem det är ser du "
                "av det som sägs om hen och till hen.",
                "En symbol är något konkret som står för något större, som en känsla, en relation eller tiden som "
                "går. Leta efter saker som återkommer eller som berättelsen stannar vid.",
                "En liknelse jämför med ”som”, en metafor säger att något är något annat, och en personifikation ger "
                "en sak mänskliga egenskaper.",
                "Stämningen är känslan texten ger, och den byggs av detaljer, ljud och ordval. Jämför början och "
                "slutet för att se om den skiftar."],
         exempel=[("Vilken stilfigur är ”Huset sov under snön”?",
                   "Personifikation: huset får en mänsklig handling, att sova.")],
         ord=[("tolka", "att förklara vad något kan betyda, med stöd i texten"),
              ("stämning", "den känsla en text eller en scen ger läsaren")],
         tips="En tolkning är rimlig när du kan peka på en mening i texten som stöder den."),

    # ------------------------------------------------------------------
    # Svenska gy3
    # ------------------------------------------------------------------
    blad("Svenska", "gy3", "Referera och citera",
         mal=["Skilja på att citera, parafrasera och sammanfatta.",
              "Skriva ett referat i presens, med referatmarkörer och utan egna åsikter.",
              "Hänvisa till källor i löptexten och i en källförteckning.",
              "Formulera en avgränsad forskningsfråga."],
         fakta=["Ett citat är ordagrant och står inom citattecken. En parafras säger samma idé med egna ord och är "
                "ungefär lika utförlig. En sammanfattning tar bara med det viktigaste och är kortare.",
                "Ett referat skrivs i presens och innehåller inga egna åsikter. Referatmarkörer som enligt, menar och "
                "skriver visar att tankarna är någon annans.",
                "Neutrala verb som ”skriver” och ”beskriver” tar inte ställning till det källan säger. Ett verb som "
                "”påstår” kan visa att du tvivlar.",
                "Alla lånade idéer kräver källhänvisning, också parafraser och sammanfattningar. I löptexten skriver "
                "du till exempel upphovspersonens efternamn och år inom parentes.",
                "I källförteckningen står upphovsperson, år, titel och var texten är publicerad. En bra "
                "forskningsfråga är avgränsad och går att undersöka."],
         exempel=[("Parafrasera: ”Den som läser mycket får ett större ordförråd.”",
                   "Till exempel: ”Läser man mycket lär man sig fler ord.” Idén är densamma, orden är dina egna, "
                   "och källan ska ändå anges."),
                  ("Gör frågan ”Hur påverkar läsning unga?” mer avgränsad.",
                   "Till exempel: ”Läser elever i årskurs 9 fler böcker om skolan har en daglig lässtund?” Den säger "
                   "vilka, vad och hur det kan undersökas.")],
         ord=[("parafras", "samma idé med egna ord, ungefär lika utförligt"),
              ("löptext", "den vanliga brödtexten, till skillnad från rubriker och källförteckning")],
         tips="Byter du bara ut några ord i en mening blir det varken citat eller parafras: skriv om helt, eller "
              "citera ordagrant."),

    blad("Svenska", "gy3", "Utredande text",
         mal=["Bygga en utredande text med inledning, avhandling och avslutning.",
              "Formulera en frågeställning som går att utreda från flera håll.",
              "Jämföra och värdera källornas perspektiv och hålla isär dem från din egen slutsats.",
              "Skriva sakligt med bindeord som visar hur tankarna hänger ihop."],
         fakta=["Inledningen presenterar ämne, syfte och frågeställning. Avhandlingen redovisar olika perspektiv med "
                "stöd i källor. Avslutningen sammanfattar och drar en egen slutsats.",
                "En utredande text undersöker en fråga från flera håll i stället för att driva en tes. En öppen fråga "
                "med hur eller varför passar bättre än en ja- eller nej-fråga.",
                "Håll isär vad källorna säger och vad du själv drar för slutsats, till exempel med ”min slutsats är "
                "att”. För en högre nivå jämför och värderar du perspektiven och avsändarna.",
                "Bindeord visar hur tankarna hänger ihop: följd (därför, alltså), motsättning (men, å andra sidan) "
                "och omformulering (det vill säga).",
                "Skriv sakligt, utan talspråk och värderingar, och förklara ämnets fackord när det behövs."],
         exempel=[("Gör om till en öppen frågeställning: ”Är läxor bra?”",
                   "Till exempel: ”Hur påverkar läxor elevers lärande och fritid?” Den bjuder in till flera "
                   "perspektiv.")],
         ord=[("avhandling", "textens huvuddel, där perspektiven redovisas"),
              ("perspektiv", "ett sätt att se på frågan, ofta en viss källas"),
              ("avsändare", "den som står bakom en text")],
         tips="Två källor som verkar oense kan båda ha rätt om de talar om olika saker: läs noga vad var och en "
              "påstår."),

    blad("Svenska", "gy3", "Läsa: NP-träning",
         mal=["Hitta huvudbudskapet och viktiga detaljer i en saklig text.",
              "Jämföra två texter: huvudtanke, likheter, skillnader och avsändare.",
              "Tolka en liknelse och se vad ett argument bygger på.",
              "Skriva ett sakligt referat och en egen slutsats som bygger på flera källor."],
         fakta=["Läs texten först och leta upp huvudbudskapet. Leta sedan efter de detaljer frågorna gäller, och svara utifrån "
                "texten, inte utifrån det du redan vet.",
                "Huvudbudskapet är det texten vill säga i sin helhet. En detalj stämmer bara om texten säger just det.",
                "När du jämför två texter: ta reda på vem avsändaren är, vad var och en tycker, var de är överens och "
                "var de skiljer sig åt.",
                "Ett argument kan bygga på fakta, på forskning eller på egen erfarenhet. Textsorten, som "
                "debattartikel, blogg eller intervju, säger något om avsändarens syfte.",
                "Ett sakligt referat återger med referatmarkörer och utan värderingar. En egen slutsats väger ihop "
                "källorna och säger något mer än var och en gör."],
         ord=[("avsändare", "den som står bakom texten"),
              ("liknelse", "en jämförelse med ”som”"),
              ("huvudbudskap", "det viktigaste texten vill säga")],
         tips="Se efter om texten anger vilka källor den bygger på: det säger något om hur säkra uppgifterna är."),

    blad("Svenska", "gy3", "Vetenskaplig metod",
         mal=["Förklara hypotes, population, urval, bortfall och kontrollgrupp.",
              "Skilja på kvalitativa och kvantitativa metoder och förklara validitet.",
              "Skilja på samband och orsak, och känna igen skensamband.",
              "Granska en undersökning och formulera en försiktig slutsats."],
         fakta=["En hypotes är ett antagande som en undersökning ska pröva. Den måste gå att pröva, till exempel "
                "genom att jämföra två grupper.",
                "Populationen är alla som undersökningen vill säga något om, urvalet de som väljs ut och bortfallet "
                "de i urvalet som inte deltar. Ett slumpmässigt urval är bättre än ett stort men skevt.",
                "Hög validitet betyder att undersökningen mäter det den ska mäta. Kvantitativa metoder räknar och "
                "mäter många svar, kvalitativa går på djupet, till exempel med intervjuer.",
                "Att två saker varierar tillsammans bevisar inte att den ena orsakar den andra. Påverkar en "
                "bakomliggande faktor båda är det ett skensamband.",
                "Svarar bara de som vill, eller uppger alla själva sina svar, kan resultatet bli skevt. Skriv att "
                "resultatet ”tyder på” något, och generalisera försiktigt."],
         exempel=[("Av en skolas 400 elever svarar 50 på en enkät. Hur stor del svarade, och vad betyder det?",
                   "50 av 400 är en åttondel, 12,5 %. Bortfallet är stort, så resultatet säger lite om skolans alla "
                   "elever."),
                  ("Städer med många brandmän har fler bränder. Orsakar brandmännen bränderna?",
                   "Nej. Stora städer har både fler brandmän och fler bränder: stadens storlek är den bakomliggande "
                   "faktorn.")],
         ord=[("kontrollgrupp", "en jämförelsegrupp som inte får det som prövas"),
              ("korrelation", "att två saker varierar tillsammans"),
              ("representativt urval", "ett urval som liknar hela populationen"),
              ("reliabilitet", "att undersökningen ger samma resultat om den görs om")],
         tips="Fråga alltid: vilka svarade, hur många, och kan något annat förklara resultatet?"),

    blad("Svenska", "gy3", "NP-träning: vetenskapligt skrivande",
         mal=["Skilja på syfte och frågeställning, och ordna inledningen i ett vetenskapligt arbete.",
              "Skilja på att sammanfatta, analysera och tolka.",
              "Belägga en tolkning med citat och kommentera citatet.",
              "Skriva objektivt och ordna en källförteckning."],
         fakta=["Syftet säger vad arbetet ska uppnå, frågeställningen vad som ska besvaras och metoden hur "
                "undersökningen går till. Inledningen går ofta från bakgrund till syfte och frågeställning.",
                "En sammanfattning återger innehållet. En analys undersöker hur texten är gjord och vad det får för "
                "verkan. En tolkning föreslår vad något i texten kan betyda.",
                "En tolkning behöver stöd i texten. Följ ett citat med en kommentar som förklarar vad det visar.",
                "Hänvisar du med efternamn och år i texten ska källan också stå i källförteckningen, ordnad i "
                "bokstavsordning efter efternamn.",
                "Skriv objektivt: håll isär fakta och värderingar, och skriv ”tyder på” eller ”pekar på” när "
                "resultatet inte bevisar något."],
         exempel=[("Gör meningen objektiv: ”Den här studien är helt fantastisk och bevisar allt.”",
                   "Till exempel: ”Studien ger stöd för hypotesen.” Värderingen är borta, och påståendet är inte "
                   "starkare än resultatet.")],
         ord=[("belägg", "det i texten eller materialet som stöder ett påstående, till exempel ett citat"),
              ("metod", "hur undersökningen går till"),
              ("objektiv", "saklig, utan att ta parti")],
         tips="Välj det citat som tydligast visar det du påstår, och låt det aldrig stå utan kommentar."),

    # ------------------------------------------------------------------
    # Engelska gy1
    # ------------------------------------------------------------------
    blad("Engelska", "gy1", "Ordförråd",
         mal=["Använda sambandsord som visar motsats, följd, tillägg och exempel.",
              "Bilda substantiv och adjektiv med suffix.",
              "Bilda motsatsord med prefix som un-, im-, ir- och dis-.",
              "Undvika falska vänner som eventually."],
         fakta=["Sambandsord visar hur tankar hänger ihop: however och nevertheless visar motsats, therefore och "
                "consequently följd, furthermore tillägg och for instance exempel.",
                "Suffix kan ändra ordklass: -ment, -ness, -tion, -dom och -ship bildar ofta substantiv (agreement, "
                "kindness), och -ous och -ful adjektiv (famous, helpful).",
                "Prefix kan ge motsatsen: un- (unhappy), dis- (dislike), im- ofta före p och m (impatient), ir- före "
                "r (irregular) och il- före l (illegal).",
                "Suffixet -less betyder utan: homeless, hopeless.",
                "Eventually betyder till slut, inte eventuellt. Eventuellt heter possibly eller perhaps."],
         exempel=[("Bilda substantivet av adjektivet 'kind' och av verbet 'agree'.",
                   "kindness och agreement."),
                  ("Vad är motsatsen till 'legal'?",
                   "illegal: il- står före ord som börjar på l.")],
         ord=[("on the one hand … on the other hand", "å ena sidan … å andra sidan"),
              ("although", "fastän; inleder en bisats")],
         tips="Lär dig ordfamiljer i stället för enstaka ord: succeed, success, successful."),

    blad("Engelska", "gy1", "Verb",
         mal=["Välja rätt tempus, från present perfect till future perfect.",
              "Använda for och since, och used to om sådant som var förr.",
              "Bilda passiv i olika tempus.",
              "Använda have something done om att låta någon göra något."],
         fakta=["Present perfect knyter det förflutna till nu: I have lived here since May (sedan en tidpunkt) eller "
                "for two years (under en tid). Det heter inte I live here since May.",
                "Past continuous (was reading) är något som pågick när något annat hände (past simple: called). Past "
                "perfect (had finished, had been working) är det som hade hänt före en annan händelse.",
                "Future continuous (will be travelling) pågår vid en tidpunkt i framtiden. Future perfect (will have "
                "finished) är klart före en tidpunkt i framtiden.",
                "Passiv: be i rätt tempus + perfekt particip: is cleaned, is being cleaned, was cleaned, has been "
                "cleaned, will be cleaned. By säger vem som utförde handlingen.",
                "Have something done betyder att låta någon annan göra något: I had my bike repaired = jag lät laga "
                "cykeln."],
         exempel=[("Skriv i passiv, present perfect: Someone has painted the door.",
                   "The door has been painted."),
                  ("Fyll i: When we arrived, the film ___ (already/start).",
                   "had already started. Filmen började före vår ankomst, så det blir past perfect.")],
         ord=[("used to + verb", "brukade förr, men gör inte längre: I used to live in Malmö"),
              ("past participle", "perfekt particip, som cleaned, written och stolen")],
         tips="Fråga dig när något hände och om det fortfarande pågår: svaret väljer tempus åt dig."),

    blad("Engelska", "gy1", "Konditionalis",
         mal=["Bilda tredje konditionalis om sådant som kunde ha hänt men inte gjorde det.",
              "Skilja tredje konditionalis från andra, som handlar om nu.",
              "Uttrycka önskningar med wish och if only.",
              "Använda unless, provided och as long as i villkor."],
         fakta=["Tredje konditionalis: If + had + perfekt particip, would have + perfekt particip. If I had seen the "
                "sign, I would have stopped. Det handlar om något i det förflutna som inte hände.",
                "Andra konditionalis handlar om nu eller framtiden, om något som inte är så: If + past simple, would "
                "+ verb. If I lived closer, I would walk.",
                "Wish + past simple (med be ofta were) handlar om nu: I wish I knew. Wish + had + perfekt particip "
                "handlar om det förflutna: I wish I had gone. Wish + would: du vill att någon ändrar sig.",
                "If only betyder om bara och följer samma mönster som wish: If only I knew.",
                "Unless betyder om inte: unless you hurry = if you don't hurry. Provided (that) betyder förutsatt "
                "att, och as long as betyder så länge som."],
         exempel=[("Fyll i: If he ___ (not/forget) his phone, he ___ (call) us.",
                   "If he hadn't forgotten his phone, he would have called us.")],
         ord=[("condition", "villkor"),
              ("past participle", "perfekt particip, som seen, gone och forgotten")],
         tips="Skriv inte would i if-satsen: det står i den andra delen av meningen."),

    blad("Engelska", "gy1", "Stil och idiom",
         mal=["Skriva formell engelska i brev, mejl och ansökningar.",
              "Börja och avsluta ett formellt brev rätt.",
              "Förstå vanliga idiom och vad de betyder i sammanhanget."],
         fakta=["Formell engelska har hela former (do not, I am), artiga omskrivningar (Would you be able to …?) och "
                "mer formella ord (receive i stället för get).",
                "Vet du mottagarens namn börjar du med Dear Mr Patel och slutar med Yours sincerely. Vet du inte "
                "namnet börjar du med Dear Sir or Madam och slutar med Yours faithfully (brittisk engelska).",
                "Fasta fraser i formella brev: I am writing to …, I would be grateful if you could …, I look forward "
                "to hearing from you.",
                "Ett idiom betyder något annat än orden var för sig och kan sällan översättas ord för ord. Lär dig "
                "idiom i sammanhang, inte i listor."],
         exempel=[("Vad betyder 'to break the ice'?",
                   "Att få igång ett samtal när stämningen är stel."),
                  ("Vad betyder 'It's a piece of cake'?",
                   "Att något är mycket lätt.")],
         ord=[("idiom", "fast uttryck vars betydelse inte går att räkna ut ur orden"),
              ("formal", "formell, artig och opersonlig")],
         tips="Idiom hör oftast hemma i tal och vardaglig text: använd dem sparsamt i en formell ansökan."),

    blad("Engelska", "gy1", "Läsförståelse",
         mal=["Hitta fakta och siffror i en engelsk artikel.",
              "Förstå svåra ord utifrån sammanhanget.",
              "Förklara vad personerna i en text menar.",
              "Tolka bilder i språket och läsa mellan raderna i en novell."],
         fakta=["Läs texten först. Siffror, namn och årtal hittar du sedan snabbast om du skummar den efter just dem.",
                "Ett okänt ord kan du ofta lista ut ur meningen runt det: vad händer, och är ordet positivt eller "
                "negativt?",
                "När en fråga gäller vad någon menar, svarar du med vad orden innebär i sammanhanget, inte vad de "
                "betyder ord för ord.",
                "En liknelse jämför med like eller as: The clouds hung like grey blankets. Fråga dig vad jämförelsen "
                "säger om stämningen.",
                "Ett påstående är sant bara om texten stöder det. Det du gissar eller tycker räknas inte."],
         exempel=[("'Her voice was shaky and she kept checking the clock.' Hur mår personen?",
                   "Hon är troligen nervös. Texten säger det inte, men detaljerna visar det.")],
         ord=[("simile", "liknelse, en jämförelse med like eller as"),
              ("read between the lines", "läsa mellan raderna, förstå det som antyds")],
         tips="Leta upp stället i texten för varje svar: en detaljfråga besvaras nästan alltid av en eller två "
              "meningar."),

    blad("Engelska", "gy1", "Skriva: stil och struktur",
         mal=["Skriva ett formellt mejl med rätt hälsning, ordning och avslutning.",
              "Bygga en argumenterande text med inledning, topic sentences, en annan synvinkel och avslutning.",
              "Skilja på formell och informell stil och välja bindeord.",
              "Undvika vanliga fel, som fel tempus med since."],
         fakta=["Ett formellt mejl: hälsning, varför du skriver, detaljer, artig avslutning och namn. Använd hela "
                "former (I am, do not) och artiga frågor (Could you please …?).",
                "Efter Dear + namn slutar du med Yours sincerely, efter Dear Sir or Madam med Yours faithfully "
                "(brittisk engelska). Efter look forward to kommer -ing: I look forward to meeting you.",
                "En argumenterande text: inledning med ämne och åsikt, stycken med skäl och exempel, en annan "
                "synvinkel och en avslutning. Varje stycke börjar med en topic sentence.",
                "Bindeord: in addition lägger till, however visar motsats, as a result visar följd och for example "
                "ger exempel.",
                "Since + tidpunkt kräver present perfect: I have worked here since June. Information får inget -s, "
                "och månader och veckodagar skrivs med stor bokstav."],
         exempel=[("Gör formellt: 'Sorry I'm late with the form, there was a problem.'",
                   "I apologise for the delay in returning the form. Unfortunately, there was a problem.")],
         ord=[("topic sentence", "meningen som säger vad stycket handlar om"),
              ("contraction", "kortform, som I'm och don't")],
         tips="Kortformer som I'm och don't är fel i ett formellt mejl men helt rätt i ett meddelande till en vän."),

    blad("Engelska", "gy1", "Läsa: NP-träning",
         mal=["Hitta huvudtanken och viktiga detaljer i en engelsk artikel.",
              "Avgöra skribentens attityd till ämnet.",
              "Hitta ord i texten som betyder det frågan beskriver.",
              "Tolka personer, detaljer och tema i en kort berättelse."],
         fakta=["Läs texten först. Se sedan vad varje fråga frågar efter: en siffra, ett namn, en orsak eller en åsikt.",
                "Find a word that means …: leta i rätt stycke efter ett ord av samma ordklass som förklaringen.",
                "Skribentens attityd syns i ordvalen och i hur kritik bemöts. En text kan vara positiv och ändå ta upp "
                "svagheter.",
                "I en berättelse säger detaljer, som kläder och kroppsspråk, mycket om en person. Temat är det "
                "berättelsen säger om livet, inte bara vad som händer.",
                "Ett uttryck som 'my heart sank' ska förstås i bild, inte ord för ord: fråga dig vilken känsla det "
                "beskriver."],
         ord=[("main idea", "huvudtanke"),
              ("attitude", "inställning, vad skribenten tycker om ämnet"),
              ("theme", "tema, det berättelsen säger om livet")],
         tips="Ett svar på vad som hände ska gå att stödja på en mening du kan peka på i texten."),

    blad("Engelska", "gy1", "Modala verb och återgivet tal",
         mal=["Använda must have, can't have, might have och should have om det förflutna.",
              "Återge vad någon har sagt med tidsförskjutning.",
              "Använda rapporterande verb som promise, warn, suggest, admit och deny med rätt form efter."],
         fakta=["Modalt verb + have + perfekt particip handlar om det förflutna: must have (nästan säkert), can't have "
                "(omöjligt), might have eller could have (kanske), should have (borde ha, men gjorde inte).",
                "I återgivet tal flyttas verbet ofta ett steg bakåt: is blir was, has seen blir had seen, will blir "
                "would, can blir could och must blir ofta had to.",
                "Pronomen och tidsord ändras också: I blir he eller she, och tomorrow blir the next day.",
                "Promise, agree och refuse följs av to + verb. Warn someone (not) to + verb. Suggest, admit och deny "
                "följs av -ing eller en that-sats: She denied lying."],
         exempel=[("Gör om till indirekt tal: 'I can't find my phone,' Sam said.",
                   "Sam said that he couldn't find his phone."),
                  ("Fyll i: The window is open. Someone ___ (forget) to close it.",
                   "must have forgotten. Du är nästan säker på vad som har hänt.")],
         ord=[("reported speech", "återgivet tal, indirekt anföring"),
              ("backshift", "tidsförskjutning: verbet flyttas ett steg bakåt")],
         tips="Skriv aldrig suggest to go: det heter suggest going eller suggest that we go."),

    blad("Engelska", "gy1", "Läsa en nyhet",
         mal=["Hitta huvudbudskapet i en engelsk nyhetsartikel.",
              "Hitta detaljer, siffror och orsaker i texten.",
              "Förstå vanliga ord i nyhetstexter.",
              "Dra slutsatser om vad som kan hända härnäst."],
         fakta=["En nyhetsartikel börjar med det viktigaste: rubriken och första stycket säger vad som har hänt och "
                "vem det gäller. Detaljer och bakgrund kommer längre ned.",
                "Citat visar vad personerna själva säger. En talesperson (spokesperson) talar för en organisation, "
                "till exempel en kommun.",
                "Siffror och villkor står ofta mitt i texten: läs dem noga och se vad de gäller.",
                "En slutsats om framtiden ska bygga på det texten säger, till exempel ett villkor eller ett försök som "
                "pågår.",
                "Ordningsfrågor: leta efter tidsord som at first, then, after och finally. Texten berättar inte alltid "
                "i den ordning det hände."],
         ord=[("headline", "rubrik"),
              ("council", "kommunen, som styr en stad eller ort i Storbritannien"),
              ("trial", "försök, ett test under en viss tid")],
         tips="Rubriker saknar ofta småord: 'School to close early' betyder 'The school is going to close early'."),

    blad("Engelska", "gy1", "NP-träning: skriva",
         mal=["Börja en argumenterande och en berättande text så att läsaren fångas.",
              "Bygga en berättelse med början, problem, höjdpunkt och lösning.",
              "Visa känslor i stället för att bara säga dem, och hålla dig till ett tempus.",
              "Välja formell stil och undvika vanliga fel."],
         fakta=["En argumenterande text kan börja med en fråga eller ett påstående som väcker intresse, och slutar med "
                "din åsikt och de viktigaste skälen. Ta också upp den andra sidans argument.",
                "En berättelse presenterar personer och miljö, sedan kommer ett problem som når en höjdpunkt och till "
                "sist löses. Börja nytt stycke när tid, plats eller den som talar byts.",
                "Visa känslor genom handlingar och detaljer. Håll berättelsen i past tense, och lär dig de "
                "oregelbundna verben: swim – swam – swum, ring – rang – rung.",
                "I formell stil byter du ofta ett phrasal verb mot ett enda ord: find out blir discover, go up blir "
                "increase.",
                "Vanliga fel: discuss utan about, explain something to someone, a lot i två ord, och their (deras), "
                "there (där) och they're (they are)."],
         exempel=[("Visa i stället för att säga: 'She was happy.'",
                   "Till exempel: 'She laughed and spun around in the rain.' Läsaren förstår känslan av det hon gör.")],
         ord=[("narrative", "berättande text"),
              ("argumentative", "argumenterande"),
              ("phrasal verb", "verb med partikel, som find out och go up")],
         tips="Läs igenom texten en gång bara för småfel: tempus, stavning och stor bokstav, som i Swedish och Monday."),

    # ------------------------------------------------------------------
    # Engelska gy2
    # ------------------------------------------------------------------
    blad("Engelska", "gy2", "Läsa och analysera",
         mal=["Analysera miljö, berättare, stämning och symbolik i en kort text.",
              "Använda begrepp som setting, narrator, symbol, tone och theme, och stödja påståenden med citat.",
              "Följa innehåll, ton och struktur i en essä och en åsiktstext.",
              "Känna igen självironi, direkt tilltal och citattecken som visar distans."],
         fakta=["Setting är tid, plats och stämning. Narrator är rösten som berättar: i första person säger berättaren "
                "I, i tredje person he, she eller ett namn.",
                "En symbol är en sak som står för en idé. Theme är huvudtanken eller budskapet, och tone är "
                "skribentens inställning till ämnet.",
                "Stöd varje påstående i en analys med ett kort citat. Skiftar stämningen: citera något från före och "
                "något från efter skiftet.",
                "En åsiktstext (opinion piece) argumenterar för skribentens syn. Självironi och direkt tilltal (you) "
                "ger en lätt, informell ton, men ämnet kan ändå vara allvarligt.",
                "Citattecken runt ett enstaka ord kan visa att skribenten inte helt godtar ordet. Ett stycke som "
                "nyanserar visar att saken inte är svart eller vit."],
         exempel=[("What kind of image is 'The city breathed slowly in the heat'?",
                   "Personification: staden får en mänsklig handling, att andas.")],
         ord=[("simile", "liknelse med like eller as"),
              ("personification", "besjälning, en sak får mänskliga egenskaper"),
              ("mood", "stämningen i en text"),
              ("nuance", "nyans, att visa att något inte är svart eller vitt")],
         tips="Fortsätter du en text: behåll samma person, samma tempus och samma ton."),

    blad("Engelska", "gy2", "Argumentera",
         mal=["Skriva en diskuterande text med fördelar, nackdelar och en slutsats.",
              "Formulera en tes och topic sentences.",
              "Presentera ett motargument rättvist och bemöta det.",
              "Mildra påståenden med hedging och skriva formellt och sammanhängande."],
         fakta=["En diskuterande text belyser ämnet från mer än ett håll. Inledningen presenterar ämnet, varför det är "
                "viktigt nu och vad texten tar upp.",
                "Tesen (thesis) är din ståndpunkt i en tydlig mening. En topic sentence står först i ett stycke och "
                "säger vad stycket handlar om.",
                "Ett starkt motargumentstycke återger den andra sidan rättvist (Some people claim that …) och svarar "
                "med ett skäl (However, …).",
                "Hedging betyder att du inte överdriver: ord som might, can, arguably och tends to gör ett påstående "
                "försiktigare och svårare att avfärda.",
                "Sammanhang (cohesion) skapar du med pronomen som syftar bakåt, synonymer i stället för upprepning "
                "och bindeord. Formella ord: purchase (buy), require (need), assist (help)."],
         exempel=[("Hedge the claim: 'Homework improves results.'",
                   "Till exempel: 'Homework may improve results for some students.'")],
         ord=[("counterargument", "motargument"),
              ("rebuttal", "bemötande av ett motargument"),
              ("In conclusion", "sammanfattningsvis; inleder en slutsats"),
              ("cohesion", "hur meningarna hänger ihop så att läsaren kan följa med")],
         tips="Ett motargument som du bemöter gör din text starkare, inte svagare."),

    blad("Engelska", "gy2", "Ord och nyanser",
         mal=["Använda kollokationer, ord som hör ihop på engelska.",
              "Skilja på ord med nästan samma betydelse men olika klang.",
              "Välja ett starkare eller mer exakt ord, som furious i stället för very angry."],
         fakta=["Kollokationer är ord som ofta står tillsammans, och de följer inte alltid svenskan: man säger strong "
                "coffee, inte powerful coffee.",
                "Make används ofta om att skapa något (make a cake, make a plan), do om uppgifter och arbete (do the "
                "dishes, do research). Många kombinationer måste du ändå lära dig en och en.",
                "Ord kan ha samma grundbetydelse men olika klang: slim är positivt, skinny ofta negativt. De kan också "
                "skilja i styrka: angry och furious.",
                "Exakta verb målar en bild: whisper (viska), mutter (muttra) och yell (vråla) säger mer än say."],
         exempel=[("Välj verb: Can you ___ me a favour?",
                   "do: do someone a favour är en fast kombination."),
                  ("Vilket ord är beröm: 'confident' eller 'arrogant'?",
                   "confident. Båda handlar om att tro på sig själv, men arrogant är negativt.")],
         ord=[("collocation", "kollokation, ord som brukar stå tillsammans"),
              ("connotation", "klang, den känsla ett ord väcker utöver betydelsen")],
         tips="Slå upp hela uttrycket, inte bara ordet: exempelmeningar visar vilka ord som hör ihop."),

    blad("Engelska", "gy2", "Engelskans varieteter",
         mal=["Skilja på accent, dialekt och jargong.",
              "Förklara varför samma person talar olika i olika situationer.",
              "Förstå vad en skribent menar och hur hen ser på olika sätt att tala engelska."],
         fakta=["Engelska är förstaspråk i bland annat Storbritannien, Irland, USA, Kanada, Australien och Nya "
                "Zeeland, och varje land har sina varieteter. Ingen av dem är mer rätt än någon annan.",
                "En accent är hur man uttalar orden. En dialekt omfattar också ordförråd och grammatik.",
                "Jargong är fackord inom ett yrke eller en grupp och kan vara svår att förstå för den som står utanför. "
                "Slang är vardagliga ord som ofta hör till en viss grupp eller tid.",
                "Brittisk och amerikansk engelska skiljer sig i ord (flat och apartment, lift och elevator) och i "
                "stavning (colour och color).",
                "Samma person byter register efter situation och mottagare, till exempel med kompisar och i ett "
                "möte med rektorn."],
         exempel=[("Vad heter 'autumn' och 'mobile phone' på amerikansk engelska?",
                   "fall och cell phone.")],
         ord=[("accent", "uttal"),
              ("dialect", "dialekt: uttal, ord och grammatik"),
              ("jargon", "jargong, fackord inom ett yrke"),
              ("register", "språklig stil som passar en viss situation, formell eller informell")],
         tips="Skilj på vad skribenten berättar att hen har upplevt och vad hen drar för slutsats av det."),

    blad("Engelska", "gy2", "Läsa: NP-träning",
         mal=["Hitta kravet, beläggen och bemötandet av motargument i en debattartikel.",
              "Förklara varför en skribent tar med en viss uppgift eller jämförelse.",
              "Tolka berättare, liknelser och symboler i en novell, och vad slutet antyder.",
              "Hitta ord och uttryck i texten utifrån en förklaring."],
         fakta=["En debattartikel har ett krav eller en tes, belägg som visar att idén fungerar, svar på invändningar "
                "och ofta en uppmaning till läsaren.",
                "Frågar någon varför skribenten nämner något: tänk på vad uppgiften gör för argumentet. Bygger den "
                "trovärdighet, ger den belägg eller bemöter den en invändning?",
                "En liknelse (like, as) säger något om hur något sker eller känns. En symbol står för något större, "
                "som en känsla eller en idé.",
                "Slutet på en novell antyder ofta hur huvudpersonen har förändrats. Läs sista meningen noga och "
                "jämför med början.",
                "Find an expression that means …: läs stycket frågan pekar på och leta efter ord med samma ordklass "
                "och betydelse."],
         ord=[("objection", "invändning"),
              ("evidence", "belägg, stöd för ett påstående"),
              ("call to action", "uppmaning till läsaren att göra något")],
         tips="Läs påståenden med not och only extra noga: ett enda ord kan göra dem falska."),

    blad("Engelska", "gy2", "NP-träning: ord och stil",
         mal=["Förstå och använda akademiska ord i en formell text.",
              "Bilda substantiv av verb och adjektiv, och använda grekisk och latinsk plural.",
              "Välja sambandsord för kontrast, tillägg och följd.",
              "Förstå idiom som är vanliga i debatter och artiklar."],
         fakta=["Akademisk engelska väljer ofta längre och mer exakta ord: approximately (about), indicate (show), "
                "obtain (get).",
                "Många verb och adjektiv får substantiv på -sion, -tion eller -ance: decide – decision, describe – "
                "description, relevant – relevance.",
                "Några ord har grekisk eller latinsk plural: criterion – criteria, analysis – analyses, thesis – "
                "theses.",
                "By contrast och in contrast jämför två saker. On the contrary betyder tvärtom och avvisar något som "
                "just sagts. Furthermore lägger till, och hence visar följd.",
                "Idiom i debatter beskriver ofta något i bild: a slippery slope är ett första steg som sägs leda till "
                "något värre."],
         exempel=[("Make it formal: 'The number of cars went down a lot.'",
                   "The number of cars decreased considerably.")],
         ord=[("academic", "akademisk, som i en utredning eller ett vetenskapligt arbete"),
              ("linking word", "sambandsord")],
         tips="Formellt betyder inte krångligt: välj det exakta ordet, inte det längsta."),

    # ------------------------------------------------------------------
    # Engelska gy3
    # ------------------------------------------------------------------
    blad("Engelska", "gy3", "Argumenterande text",
         mal=["Skriva en tydlig thesis statement som går att argumentera om.",
              "Skriva topic sentences och undvika cirkelresonemang.",
              "Presentera ett motargument och bemöta det med en rebuttal.",
              "Avsluta en essä utan nya argument."],
         fakta=["En thesis statement säger din ståndpunkt som ett påstående någon kan säga emot, gärna med skälen i "
                "korthet. Den är ingen fråga och inget faktum, och står oftast sist i inledningen.",
                "Varje body paragraph driver en huvudpoäng, och topic sentence säger den i början av stycket.",
                "Ett cirkelresonemang upprepar påståendet i stället för att ge ett skäl. Ge ett konkret skäl: varför, "
                "och hur märks det?",
                "Counterargument är den andra sidans syn, återgiven rättvist, och rebuttal ditt svar på den. Det visar "
                "att du har tänkt på andra synsätt och gör texten mer övertygande.",
                "Avslutningen sammanfattar och upprepar tesen med nya ord, utan nya argument, och kan sluta med en "
                "tanke som stannar kvar hos läsaren."],
         exempel=[("What is wrong with 'Homework is pointless because it has no point'?",
                   "Det är ett cirkelresonemang. Bättre: 'Homework should be limited because it leaves students less "
                   "time for sleep and hobbies.'")],
         ord=[("thesis statement", "tes, din ståndpunkt i en mening"),
              ("body paragraph", "stycke i textens huvuddel"),
              ("rebuttal", "bemötande av ett motargument")],
         tips="Testa din tes: kan någon rimligen säga emot den? Om inte är den ett faktum och ingen tes."),

    blad("Engelska", "gy3", "Språket i en essä",
         mal=["Välja sambandsord för kontrast, följd, exempel och tillägg.",
              "Skilja på hur although, however och whereas används i en mening.",
              "Skriva formellt utan kortformer och slang.",
              "Välja exakta och akademiska formuleringar."],
         fakta=["Sambandsord har olika uppgifter: kontrast (however, nevertheless), följd (therefore, as a result), "
                "exempel (for instance) och tillägg (furthermore, moreover).",
                "Although inleder en bisats och binder ihop två satser i samma mening: Although it rained, we played. "
                "However står ofta först i en ny mening, följt av komma: It rained. However, we played.",
                "Whereas ställer två saker mot varandra inne i en mening: Tom likes tea, whereas Ann prefers coffee.",
                "Formell stil: inga kortformer (it is, inte it's), ingen slang (gonna, stuff) och opersonliga fraser "
                "som It can be argued that i stället för I think.",
                "Välj exakta ord: improve, considerable, harmful. Affect är ett verb (påverka) och effect oftast ett "
                "substantiv (effekt)."],
         exempel=[("Join with although: 'The test was hard. Most students passed.'",
                   "Although the test was hard, most students passed.")],
         ord=[("connector", "sambandsord"),
              ("contraction", "kortform, som don't och it's")],
         tips="Byt inte sambandsord bara för variationens skull: välj det som visar rätt samband."),

    blad("Engelska", "gy3", "Retoriska grepp",
         mal=["Känna igen retorisk fråga, hyperbole, understatement, upprepning, anafor och alliteration.",
              "Skilja på ethos, pathos och logos.",
              "Känna igen ironi och antites och förklara vilken effekt ett grepp har.",
              "Bygga upp ett kort övertygande tal."],
         fakta=["Ethos vädjar till talarens trovärdighet, pathos till publikens känslor och logos till förnuft, fakta "
                "och logik. Pathos är inte att ljuga, utan att väcka känslor.",
                "En retorisk fråga ställs för effekten, inte för att få svar. Hyperbole är en medveten överdrift, "
                "understatement en medveten förminskning.",
                "Repetition upprepar för eftertryck, och anaphora är när samma ord inleder flera meningar. Rule of "
                "three är tre led i rad. Alliteration är ord i rad som börjar med samma ljud.",
                "Ironi säger motsatsen till vad som menas. Antites ställer två motsatta delar mot varandra i en "
                "balanserad mening.",
                "Ett övertygande tal börjar med något som fångar publiken (a hook), säger huvudpoängen, stöder den "
                "med skäl och belägg och slutar med en uppmaning (a call to action)."],
         exempel=[("Which device is used in 'I have told you a million times'?",
                   "Hyperbole: en överdrift som ingen tar bokstavligt."),
                  ("Which devices are used in 'Big dreams, brave hearts, bright futures'?",
                   "Alliteration (b-ljudet) och rule of three: tre led i rad.")],
         ord=[("anaphora", "anafor, samma ord inleder flera meningar"),
              ("antithesis", "antites, två motsatser i balans"),
              ("understatement", "medveten förminskning"),
              ("call to action", "uppmaning till publiken att göra något")],
         tips="Fråga dig inte bara vilket grepp det är, utan vad det gör med publiken: överdriver talaren hela tiden "
              "sjunker trovärdigheten."),

    blad("Engelska", "gy3", "Engelskans historia",
         mal=["Förklara varför engelskan har ord från germanska språk, fornnordiska och franska.",
              "Följa hur en essä förklarar och tolkar ordens ursprung.",
              "Förstå bildspråk och skribentens slutsats om lånord."],
         fakta=["Fornengelskan var ett germanskt språk som anglosaxarna förde till England på 400-talet. Många "
                "vardagsord kommer därifrån.",
                "Vikingarna kom till England från slutet av 700-talet, och fornnordiskan gav engelskan många ord, "
                "också vardagliga.",
                "Efter den normandiska erövringen på 1000-talet var franska språket hos dem som styrde England i "
                "flera hundra år. Därför finns ofta ett germanskt och ett franskt ord för liknande saker: calf och veal.",
                "Engelskan har fortsatt att låna ord från språk över hela världen genom handel och andra kontakter.",
                "Läs efter hur skribenten resonerar: ord som probably och perhaps visar att en förklaring inte är "
                "säker."],
         exempel=[("Which word in each pair came into English through French: 'house – mansion' and 'ask – inquire'?",
                   "mansion och inquire. House och ask är germanska ord från fornengelskan.")],
         ord=[("Old English", "fornengelska"),
              ("Old Norse", "fornnordiska, vikingarnas språk"),
              ("Germanic", "germansk"),
              ("loanword", "lånord")],
         tips="Ett bildspråk som 'words are travellers' ska tolkas: fråga dig vad bilden säger om språket."),
]
