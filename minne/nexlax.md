# NexLäx: uppgifterna, nivåerna och uppgiftsbanken

Arkivet för Fas 23.1–23.3 ur avsnitt 1 och 11 i `CLAUDE.md`, ordagrant. Reglerna står i
kärnan, `CLAUDE.md`, och hur banken byggs i `genererat-och-ci.md` (avsnitt 8). "Avsnitt N" i
texten är kärnans.

---

## Uppgifterna blir digitala (Fas 23.1)

**Läxorna heter uppgifter, och de digitala görs som i Duolingo (Fas
23.1, 2026-09-28).** Leo: "istället för läxor uppgifter", och att göra
dem ska vara roligare, "lite som duolingo, du klarar en nivå och går
vidare", i mobilen och i steg, med belöningar ju fler man klarar, och
Min utveckling ska fungera som rättningen av dem. I studievyn och
studiehjälparvyn heter de uppgifter. Tabellen heter fortfarande
`homework`, sektionerna `nexlax` (studievyn, sedan Fas 23.2; hette
`uppgifter`) och `laxor` (studiehjälparvyn), och i adminvyn står de
kvar som läxor: där betyder
Uppgifter redan adminens att göra-lista (`uppgifter`, `skapa_uppgift()`).
Läxhjälp är fortfarande tjänstens namn; skolan ger läxor, vi ger uppgifter.
- **En nivå** (`nivaer`) är 5–12 frågor i en **bana** per ämne och
  årskurs. Tre frågetyper, för att det är de som en maskin kan rätta och
  en tumme kan göra: val, skriv och ordna (brickor i rätt ordning).
  Fas 23.2 la till matchning (`para`) och läsförståelse (NexLäx nedan).
  Innehållet skrivs i `verktyg/uppgiftsbanken/` och blir en migration
  genom `verktyg/bygg-uppgifter.py` (avsnitt 8).
- **Rättningen sker i databasen.** `niva_starta()` lämnar ut frågorna
  utan facit, `niva_svara()` rättar och sparar varje svar, och när varje
  fråga är rätt besvarad är nivån klar. Betyget räknas på FÖRSTA svaret
  på varje fråga: tre stjärnor för allt rätt, två för minst 80 procent,
  en för minst 60. Under 60 procent är nivån inte klarad och nästa
  öppnas inte. `niva_forsok` och `niva_svar` har ingen skrivpolicy: ett
  resultat som går att skriva från en vy är ett påstående. Facit är inte
  hemligt för den som svarat fel (rätt svar och förklaringen visas, och
  frågan kommer tillbaka sist); poängen är att ett resultat har räknats
  av databasen och inte av webbläsaren.
- **Tal jämförs som tal bara när facit är ett rent tal** (med ett
  procenttecken som enda tillägg). Då godtas "0,5", "0.50" och ",5", och
  en enhet efter elevens tal struntas i ("12 cm" är 12). Ett facit med
  bokstäver jämförs som text. Först lästes y i facit "5y" som en enhet,
  och "5" och "5x" rättades som rätt; en granskare av innehållet hittade
  det. `grund.lika()` är samma regel i Python, för att pröva ett svar
  innan frågan går ut. Klockslag ("14.30") är tal för rättningen och
  frågas därför bara som val.
- **En digital uppgift** är en uppgift med `homework.niva_id`. Den blir
  påbörjad och klar av rättningen (klar när nivån KLARAS, alltså med
  minst en stjärna), och `skydda_laxa` nekar familjen att bocka av den.
  Samma trigger låser sedan Fas 23.1 också `bibliotek_id` och `niva_id`:
  familjen kunde förut peka om en läxa till vilket material som helst
  vars id de kände, och policyn "familj läser bibliotek via läxa" gav dem
  då läsrätt till det.
- **Allt är öppet sedan 2026-10-06.** Leo: "hela nexläx ska också vara
  upplåst så att man kan jobba med vad man vill och behöver". Varje nivå
  och varje Mästarprov går att starta, på vägen och i NP-sektionen.
  Vägen har kvar sin ordning och sitt aktuella steg, som ett förslag.
  Förut öppnades nivåerna en i taget; det var en spelregel i
  `nextrum-uppgifter.js`, inget skydd, och `niva_starta()` startade
  redan vilken nivå som helst åt familjens eget barn.
- **Fel i en fråga (2026-10-06, `nexlax_felrapporter`).** Leo: "gör knapp
  rapportera fel, vi ska se det i admin då". Efter varje svar finns Fel i
  frågan? med fyra skäl (facit, otydlig, språk, annat) och ingen fritext.
  Rapporten bär ingen person: frågan, skälet, sortens konto och tiden,
  så ingen gallring och ingen ändring i policyn. Tabellen har inga
  policyer; `rapportera_fragefel` skriver (familj, barn, studiehjälpare,
  med tak: 20 öppna per fråga och 500 per dygn), och admin läser med
  `nexlax_felrapporter()` och stänger med `nexlax_felrapport_hanterad()`,
  båda bara superadmin. Listan står under Material. En rättad fråga går
  in som en ny bankmigration, aldrig för hand.
- **Stjärnorna, serien och märkena räknas ur försöken** och sparas
  inte, så de kan aldrig säga något annat än raderna. Stjärnorna i banan
  är det BÄSTA försöket per nivå (det är spelet). Rättningen i Din
  utveckling är det FÖRSTA klara försöket per nivå: efter det har eleven
  sett svaren. Serien räknade veckor här, för att ett barn med uppgifter
  två gånger i veckan inte skulle ha en serie som bryts varje torsdag.
  Sedan Fas 23.2 räknar den dagar, på Leos begäran, med passen inräknade
  (NexLäx nedan). Ingenting påminner om den, då som nu.
- **Belöningarna är märken, inte pengar.** Leo skrev "eventuellt". En
  belöning med ett värde i kronor (en rabatt, en bjuden timme) är ett
  pris som ändras och marknadsföring riktad till barn, och den gör
  fusket lönsamt. Det är ett beslut om affären och juridiken; fattas det
  ska det in här och i villkoren, inte bara i koden.
- **Min utveckling hade tre flikar**: Uppgifter (rättningen, rätt första
  gången per kunskapsområde med studiehjälparens bedömning bredvid när
  området heter likadant, klarade nivåer per vecka och varje rättad nivå
  med genomgången fråga för fråga), Passen och Bedömningen
  (femstegsskalan). Sedan Fas 23.2 står allt det under NexLäx → Din
  utveckling, och bedömningen är fortfarande en människas omdöme som
  inte blandas ihop med en maskins rättning: den står i ett eget block,
  Studiehjälparens bedömning.
- Nivåerna görs i familjens inloggning och, sedan 2026-10-01, i barnets
  egen vy (`barn.html`, migrationen `nexlax_for_barnet`, i drift samma
  dag). Leo: "Nexläx syns inte i barnens vy". Barnets roll når
  fortfarande inga tabeller: de fyra
  funktionerna NexLäx bygger på (`niva_starta`, `niva_svara`,
  `niva_genomgang`, `nexlax_lage`) släpper in barnet för dess eget id och
  bara med aktiv inloggning (`intern.mitt_aktiva_barn`), banan läses genom
  `barn_nexlax()` och en vanlig uppgift bockas av genom `barn_uppgift()`.
  Ett försök barnet startar har `startad_av` tom: kolumnen pekar på
  `profiles`, och ett barnkonto har ingen. Barnets vy ritar vägen, spelaren
  och Din utveckling med samma NXUppgifter, men utan studiehjälparens
  bedömning och passen (`barnvy`); "Från passet" på vägen och rapporterna
  syns bara när föräldern slagit på rapporterna. Material följer med bara
  som länk: en fil kräver en signerad adress ur en privat hink, och den
  vägen har barnet inte.

## NexLäx (Fas 23.2)

**NexLäx (Fas 23.2, 2026-09-29).** Leo: Uppgifter och Min utveckling ska
bort ur studievyn och bli EN sektion, NexLäx, "Nextrums egna
Duolingo-liknande lärsystem för skolämnen", inte en egen app. Eleven ska
se serien, XP:n, var hen är på vägen, vad som är klart och låst och
nästa steg, och NexLäx ska hänga ihop med studiehjälparen och passen:
"Lektion → NexLäx → träning hemma → progression → nästa lektion". Samma
tabeller och samma rättning som Fas 23.1; migrationen `fas23_2_nexlax`
lägger till fyra saker, och vyn är ombyggd. Sektionen är `#nexlax` med
flikarna Din väg (`#nexlax/vag`) och Din utveckling
(`#nexlax/utveckling`); de gamla adresserna (`#uppgifter`,
`#utveckling`, `#laxor`, `#material`, `#uppgifter/marken`) leder dit.
- **Din väg**, uppifrån: serien och XP:n, banans procent och nästa steg
  med en knapp (en påbörjad nivå först, sedan det aktuella steget, ett
  Mästarprov, repetitionen), det studiehjälparen gett ("Rekommenderat
  av …", med Börja på en digital nivå), den senaste rapporten från de
  tre senaste veckorna med "Öva mer på" och en knapp till området,
  ämnena med procenten i en ring, och vägen: områdena i ordning med
  nivåerna i sicksack, klart, aktuellt, öppet, nästa och låst. Ett
  område längre fram än nästa visar bara vad som låser upp det.
- **Din utveckling**: talen (XP, serien, nivåer, områden, rätt direkt),
  varje ämne, XP per vecka, de fyra senaste veckorna som en kalender med
  en låga per dag, rättningen område för område med studiehjälparens
  bedömning bredvid, bedömningen själv (femstegsskalan), passen med
  studiehjälparen, de rättade nivåerna med genomgången, och märkena.
- **XP räknas, den sparas inte.** 10 för en fråga man väljer svaret på
  (val, sant eller falskt), 20 för en man skriver, bygger eller parar
  ihop (skriv, ordna, para), 50 när en nivå klaras första gången och 100
  när varje vanlig nivå i ett område är klarad. En fråga ger XP EN gång:
  första gången den sitter direkt, i vilket försök som helst, också i
  ett Mästarprov eller en repetition. XP mäter vad eleven klarat, inte
  hur många gånger hen tryckt, och minskar aldrig: ett område som får en
  ny nivå behåller sina 100, för klarat räknas mot nivåerna som fanns då
  (`nivaer.created_at`). Reglerna står bara i `intern.nexlax_*`, vyerna
  får dem i `nexlax_lage().regler`, och `niva_svara()` säger vad ett
  svar gav. Leo: "XP ska sparas mot den riktiga användaren". Det gör
  den, i svaren och försöken som bara databasen skriver; en egen tabell
  med poäng hade kunnat säga något annat än svaren, samma skäl som för
  stjärnorna.
- **Serien räknar dagar, i svensk tid** (`nexlax_lage().serie`). En dag
  räknas när eleven klarat en nivå (också utan stjärnor: hen har till
  slut svarat rätt på allt), gjort klart något från studiehjälparen,
  eller haft ett pass med rapport utan att vara frånvarande. Passdagen
  räknas med flit: ett barn med pass på tisdagen ska inte tappa serien
  för att det inte också gjorde en nivå. Den bryts först när en hel dag
  gått utan något, så den ser aldrig bruten ut på morgonen, och rekordet
  står kvar. **Ingenting påminner om den**: ingen notistyp och inget
  mejl. En påminnelse om en serie är en skuld riktad till ett barn; det
  är ett beslut, inte något som saknas.
- **Mästarprovet och repetitionen är nivåer utan egna frågor**
  (`nivaer.sort`). Mästarprovet står sist i ett område med minst två
  nivåer och drar högst tio frågor ur dem, i ny ordning varje gång. Det
  öppnas när områdets nivåer är klarade, och med minst två stjärnor är
  området bemästrat (en krona). Repetitionen, en per bana, drar det
  eleven senast svarade fel på första gången, fyllt med frågor ur nivåer
  hen klarat, högst åtta. En fråga ur en nivå med lästext dras aldrig:
  den handlar om en text provet inte visar. `bygg-uppgifter.py` skriver
  båda sorterna själv ur banan (avsnitt 8); ett område med en enda nivå
  får inget prov, för det hade varit samma frågor i ny ordning och 50
  XP för att göra om nivån.
- **Banans procent räknar de vanliga nivåerna.** Ett område är klart när
  dess nivåer är det, som XP:n säger, och Mästarprovet är kronan ovanpå.
  Första versionen räknade provet som ett steg: ett klart område stod
  som "Klart 3/4", och banan nådde aldrig 100 utan det.
- **Tre nya sorters frågor.** Sant eller falskt är ett val med
  alternativen Sant och Falskt (`grund.sant()`, i den ordningen), och
  vyn ritar två stora knappar. Matchning (`para`) är 2–6 par, där
  vänstersidan lämnas ut i sin ordning och högersidan blandad; svaret är
  högersidan i vänsterns ordning, och rättas i databasen som de andra.
  Läsförståelse är en nivå med `lastext`: texten först, sedan frågorna,
  med en knapp tillbaka till texten. Ordna går också att dra, inte bara
  trycka.
- **En enhet med snedstreck eller exponent rättas som talet**: "15
  km/h", "9,8 N/kg" och "20 cm2" är 15, 9,8 och 20, som "12 cm" var 12
  (`intern.niva_tal`, `grund.talvarde`). Fysiken i åk 8 frågar efter
  fart och tyngd och geometrin efter area, och ett tangentbord utan ²
  skriver en tvåa. Exponenten godtas efter en längdenhet och, sedan
  2026-10-05, efter ett snedstreck ("0,25 mol/dm3" och "2 m/s2", som
  NO gy1 och gy2 frågar efter; migrationen
  `rattningen_tar_exponent_efter_snedstreck`), aldrig annars: "3x2" är
  inte talet 3.
- **Studiehjälparvyn** visar elevens XP och serie över Rättade nivåer,
  och nivåväljaren kan ge ett Mästarprov eller repetitionen som uppgift.
- **Upplåsningen är fortfarande en spelregel** (ovan), nu i `vägen()`:
  de vanliga nivåerna öppnas en i taget genom hela banan, Mästarprovet
  när områdets nivåer är klarade, och det studiehjälparen gett och det
  som är påbörjat är öppet.
- **Vakten.** Migrationen skriver om `niva_starta`, `niva_svara`,
  `intern.niva_ratta`, `intern.niva_fraga_ut` och `intern.niva_tal` i sin
  helhet, och avbryter om någon av dem inte har Fas 23.1:s md5 i
  databasen, läst i driften 2026-09-29 (avsnitt 5, flera sessioner).
- **I drift sedan 2026-09-29** (avsnitt 11). **Vyn tål ändå att
  migrationen saknas**, i en databas byggd utan den. Utan `sort` och `lastext` är varje
  nivå vanlig, utan `nexlax_lage()` syns vägen utan XP och serie, och
  utan XP i svaret från `niva_svara()` visar spelaren inga poäng. En
  fråga av typen `para` finns inte förrän banan med dem är inläst.
- Illustrationen av studievyn på startsidan och på För elever &
  föräldrar visar NexLäx i stället för de två gamla sektionerna, och
  rundturen klarar en nivå där (avsnitt 3).
- **Varje ämne har en färg** (2026-09-29, Leo: "gör designen lite mer
  interaktiv och lite mer färgig för att navigera enklare"). Matematik
  blå, svenska röd, engelska lila, NO grön, SO ockra, programmering
  turkos och moderna språk rosa, som `--amne-*` i cinemas `:root` och i
  båda mörka blocken, med `-l`-syskon för barken. Alla klarar AA som
  text mot papperet. Det valda ämnet sätter färgen på vägen
  (`data-nl-f` på `#nl-vag`, satt av `ritaVäg`), och ämneskorten och
  raderna i Din utveckling bär var sin: sken och mätare i toppen, det
  område man står i, nästa nivå, de öppna nivåerna och pratbubblan.
  Lägena har kvar sina färger: klart är mossa, bemästrat ockra, och
  det primära steget i toppen lera, för det är ert drag. Färgen säger
  VAR man är, inte vems drag det är, och resten av sajten använder den
  inte. **Varje område har en egen färg** (samma kväll, Leo: "gör också
  de olika områdena olika färger"), ur samma palett (`områdesFärg`):
  det första området har ämnets, och resten går runt. Den sitter som en
  rand upptill och i nästa nivå; ett klarat område har kvar mossans
  bock. **Översikten över områdena** (`.nl-hopp`) står under Din väg,
  med läget och områdets färg, och går INTE att trycka på. Den hoppade
  först till området, men Leo samma kväll: "de är jobbigt om man råkar
  trycka och hamnar längre ner på sidan": raden dras i sidled, och ett
  tryck mitt i ett drag flyttade sidan. Den ser därför inte ut som
  knappar. **Din utveckling** har samma palett: talen och märkena går
  runt i den, och området och den rättade nivån bär sitt ämnes färg.
  Staplarna i Område för område behåller mossa, ockra och lera, för där
  betyder färgen hur det gick. En nivå lyfter med `scale` när pekaren
  står på den, aldrig med `translate`: den äger sicksacken.

## Uppdragen, NP-sektionen, ljudet och de nya ämnena (Fas 23.4)

**Leo 2026-10-06:** "Ta inspiration från duolingo. Gör de mer interaktivt
och roligare att lära sig. Lägg in mer material. Flera årskurser och
ämnen, som exempelvis juridik, företagsekonomi och andra skolämnen och
gymansieämnen", en enklare väljare av ämne och årskurs, en sektion inför
nationella provet i varje ämne som har ett, ljud och animation vid rätt,
fel, klarad nivå och klarat område, vibration "som på duolingo", en
utveckling som är roligare att följa, och ett quest-system.

- **Gamla nationella prov kopieras fortfarande inte in.** Leo bad om det
  för tredje gången ("Ta gratis nationella prov gamla prov och svar").
  Svaret är detsamma som 2026-09-29 och 2026-10-02: proven är
  upphovsrättsskyddade, provgrupperna släpper dem för undervisning, och
  en kopia i en betald tjänst är spridning. Sektionen Inför nationella
  provet har därför Nextrums egna uppgifter i provens stil, och länkar
  till provgruppernas egna sidor där de gamla proven finns gratis
  (`NP_LÄNKAR` i `nextrum-uppgifter.js`, som speglar
  `verktyg/bladen/lankar.py`; `bygg-uppgifter.py --kolla` nekar en
  adress som inte står där). Barnets vy har inga länkar ut, så där står
  att en vuxen öppnar dem.
- **NP-spåret** (`nivaer.spar`, migrationen `nexlax_uppdrag_och_np`).
  `bygg-uppgifter.py` sätter `np` på varje nivå i ett område vars namn
  innehåller "NP-träning" eller "inför NP" (`NP_OMRADE`), och `vag` på
  resten; "BNP och inflation" är därför inget NP-område. Vyerna lägger
  NP-spårets nivåer i en egen sektion bakom knappen Inför nationella
  provet, där varje vanlig nivå är öppen: inför ett prov väljer man det
  man behöver. Mästarprovet i ett NP-område öppnas som på vägen, och
  heter Provträning, blandat. Vägens upplåsning, banans procent och
  märket En hel bana räknar bara vägen. De 82 NP-steg som redan fanns
  (områdena NP-träning i matematik, svenska, engelska, NO och SO) flyttade
  dit utan nya id: id:t kommer ur nyckeln. Utan kolumnen (en databas före
  migrationen) står allt på vägen som förut. Det är en spelregel, inget
  skydd: databasen rättar och räknar XP för NP-nivåerna som för alla andra.
- **Uppdragen** (`intern.nexlax_uppdrag`, `nexlax_lage().uppdrag`). Tre
  om dagen, ett ur varje grupp (xp, nivaer, kunna), valda ur elevens id
  och dagen med md5 (`intern.nexlax_lott`), så att samma elev har samma
  tre hela dagen på alla enheter; ett i veckan; och månadens utmaning,
  20 av dagens uppdrag i månaden (`intern.nexlax_manadsmal`). De RÄKNAS
  ur svaren och försöken, som stjärnorna, serien och XP:n, och sparas
  aldrig. Rätt i rad räknas ur svaren i den ordning de gavs, över
  nivåerna, inom dagen. **Ett uppdrag ger inga XP**: XP mäter vad eleven
  kan, ett uppdrag att hen övat, och en XP som går att få genom att göra
  om en lätt nivå hade gjort talet meningslöst. Belöningen är att det
  syns: dagens kista öppnas när alla tre är klara, och märkena räknar
  uppdragen, kistorna, veckorna och månaderna. **Ingenting påminner om
  dem**, som om serien, och ingen text säger att något går förlorat.
  **Katalogen är historik** (`intern.nexlax_uppdragen()`): varje uppdrag
  har en dag det gäller från, så att det som redan räknats står still.
  Ändra aldrig ett befintligt uppdrags mål eller mått, ta inte bort ett,
  och lägg till ett nytt id med ett nytt `fran`. Prövat i `rls-test.sql`
  avsnitt 19.
- **Ljudet och vibrationen** (`nextrum-ljud.js`, `NXLjud`). Ljuden räknas
  fram med Web Audio: inga filer, inget att hämta, ingen ny källa i CSP:n.
  Ett tick när man trycker på ett steg, ett ämne eller en årskurs, två
  toner uppåt vid rätt (som stiger en halvton för varje svar i rad),
  två nedåt vid fel, ett arpeggio för en klar nivå, en ton per stjärna,
  en fanfar för ett område och en längre för en hel bana, ett mynt för
  ett uppdrag och ett glitter för kistan. Vibrationen går genom
  `navigator.vibrate` (Android) och, på iPhone som saknar den, genom en
  `<input type="checkbox" switch>` vars etikett klickas (iOS 18 och
  senare ger då systemets tick; samma knep som biblioteket ios-haptics);
  klicket stannar i etiketten och når aldrig sidans lyssnare. Bara med
  ett finger som pekare: Chrome på en dator har `vibrate` men inget som
  vibrerar. Av och på sparas i webbläsaren (`nx.nexlax.ljud`,
  `nx.nexlax.vibration`, `lagring.html`). En iPhone i ljudlöst läge är
  tyst ändå, med flit.
- **Firandena** är klasser och CSS: konfetti (bitar med translate och
  rotate, talen satta på biten själv), gnistor runt bocken vid rätt, en
  skakning vid fel, mätaren som blir varm vid tre i rad, och XP:n som
  räknas upp med en registrerad egenskap (`@property --nl-n`) i stället
  för ett skript som skriver varje bildruta. Med rörelse bortvald finns
  ingen konfetti och talet står där direkt. Firandet växer med det som
  klarades: en nivå, ett område, en bana.
- **Väljaren** ersatte ämnesraden och rullgardinen för årskurs. Samma
  kväll vändes den (Leo: "när man trycker på ett ämne ska årskurserna
  komma upp", och "ta bort senaste de tar bara plats"): först alla ämnen
  som rutor med ikon, årskurser och NP-märke, och under dem årskurserna
  i det valda ämnet (elevens egen med en prick). Ett nytt ämne börjar i
  elevens årskurs om ämnet har den. Inga genvägar. Inget rullar i
  sidled, så ett tryck kan aldrig vara ett drag.
- **Ranken** (i koden `rang`, `RANGER`; Leo ville att den heter rank i
  vyn) räknas ur XP:n, som märkena: tio namn från Nybörjare till Legend,
  och Din utveckling visar alla tio med XP:n som behövs och var eleven
  står. Den ger och tar ingenting, och sjunker aldrig, för XP:n gör det
  inte. (Ordet "krävs" i en text i barnets vy fäller
  `prova-barnkonton.js`: prisfiltret läser "kr" före ett ä som kronor.) Din utveckling har också Höjdpunkter (det
  senast klarade, ur försöken och `nexlax_lage().omraden`), uppdragen i
  siffror och den bästa dagen.
- **Ämnen som bara finns i NexLäx** står i `NX.NEXLAX_AMNEN`, inte i
  `NX.AMNEN`: spanska, tyska, franska, juridik, företagsekonomi,
  psykologi och filosofi (de två sista har färg och ikon men ännu ingen
  bana, och ett ämne utan bana syns inte i väljaren). `NX.AMNEN` är vad familjen ber om hjälp med,
  vad studiehjälparen undervisar i och vad biblioteket märks med, och att
  erbjuda pass i juridik är ett beslut om affären. Språken har moderna
  språkens färg och sin kod (ES, DE, FR) i stället för en flagga, för en
  flagga är ett land. Juridik, företagsekonomi, psykologi och filosofi
  har egna färger i cinema (`--amne-ju`, `-fek`, `-psy`, `-fil`), som
  klarar AA mot papperet. `slug()` i verktyget tar sedan dess bort
  accenter ("Être och avoir"); utfallet för å, ä, ö, é och ü är detsamma
  som förut, så ingen befintlig nyckel byttes.

- **Banken i Fas 23.4** (`20261006120100_uppgiftsbanken_nya_amnen_och_np`,
  körs efter `20261006120000_nexlax_uppdrag_och_np`): 71 banor, 1 148
  nivåer (392 av dem Mästarprov och repetitioner, 122 i NP-spåret) och
  6 485 frågor. Nytt: spanska, tyska och franska i åk 7 och 9,
  företagsekonomi och juridik i gy1 och gy2, engelska i åk 1–2, SO och NO
  i åk 1–3, och NP-träning i svenska (åk 3, 6, 9, gy1, gy3), engelska
  (åk 6, 9, gy1, gy2) och matematik åk 3. Lokalt 2026-10-06: rls-test
  1 340 av 1 340, och facitprovet (varje aktiv fråga lämnas ut, facit
  rättas som rätt och inget fel alternativ godtas) 6 485 frågor utan fel.
  **I drift sedan 2026-10-06**, som `20261006120000` och
  `20261006120100`, körda efter att PR #198 mergats, samma väg som punkt
  3 till 7: databasen hämtade filerna från merge-commiten med tillägget
  `http`, prövade md5 och skrev raderna i `schema_migrations` i samma
  transaktion, så `created_by` är tom. Det driften sparade har samma md5
  som filerna, och 1 148 nivåer och 6 485 frågor är aktiva. Hela
  `rls-test.sql` före, i en transaktion som rullades tillbaka med båda
  migrationerna inlästa, och efter: 1 340 av 1 340. Tillägget `http`
  stod redan installerat i driften och står kvar.
- **Programmering är avstängd sedan 2026-10-07** (Leo: Nextrum erbjuder
  det inte). Banorna i åk 6, åk 9 och gy1 togs bort ur
  `verktyg/uppgiftsbanken/` (`programmering.py` och delarna i
  `blad_so_prog.py`), och `20261007150000_uppgiftsbanken_utan_programmering`
  stänger av de 36 nivåerna och deras frågor, som banken gör med allt som
  tagits bort ur filerna. Inget raderas: gamla försök pekar på nivåerna.
  Efter den är 1 112 nivåer och 6 298 frågor aktiva. Färgen och ikonen
  för ämnet står kvar i `nextrum-uppgifter.js`, för gamla försök, och
  likaså kodblocket i frågan: ingen aktiv fråga har längre flera rader.
  Verktygens rester gick samtidigt (`figurer.kod`, `kodrad` och nyckeln
  `prog`). **I drift sedan 2026-10-07**: båda migrationerna kördes efter
  merge av PR #219, hämtade från merge-commiten (`b82ab12`) med md5
  prövad, och räkningen efteråt stämde (1 112 och 6 298, ingen nivå eller
  fråga i programmering aktiv). Hela `rls-test.sql` 1 490 av 1 490 mot
  driften, tillbakarullat.
- **Skrivet och granskat med AI.** Skribenter skrev språken,
  företagsekonomin, lågstadiet, engelskan och NP-träningen; juridiken
  skrevs i huvudsessionen. En granskare per ämnesgrupp läste sedan varje
  fråga i språken, företagsekonomin, lågstadiet och juridiken: inget
  facit var fel, men ett femtiotal formuleringar, fel alternativ och
  godtagna svar ändrades, flest i juridiken (alternativ som en jurist
  kunde försvara, och rätt alternativ som oftast var längst). En
  granskares rättelse var själv fel (att ett grundlagsfel måste vara
  uppenbart, ett krav som togs bort 2011) och rättades tillbaka. NP
  svenska, NP engelska, engelska åk 1–2 och NP matematik åk 3 har bara
  skribentens egen granskning; matematiken räknades om i huvudsessionen.
  En andra omgång skribenter (psykologi, filosofi, SO för gymnasiet och
  mer NP-matematik) stoppades utan resultat, så de ämnena finns inte.
- **Det en lärare bör läsa först:** juridikens arbetsrätt (provanställning,
  turordning, uppsägningsskäl), konsumentköplagens tider, arvet med
  särkullbarn och laglott; företagsekonomins nyckeltal och BAS-klasser;
  lågstadiets trafikregler och hälsoråd; språkens förenklingar (ser och
  estar, perfekt med sein, partitiv och passé composé med être).

---

## Prova NexLäx på startsidan (2026-10-06, borttaget 2026-10-07)

Startsidan hade en dag en ruta med tre egna frågor utan konto, rättade i
webbläsaren och utan XP. Leo tog bort den efter att ha sett den i drift.
Byggs något liknande igen gäller samma sak: egna frågor, aldrig bankens
(de går ut utan facit och rättas i databasen), inga XP och ingen text i
skriptet. Rutor med `display:grid` behöver en egen `[hidden]`-regel,
annars syns det dolda.

## NexLäx på startsidan (2026-10-07)

Leo: "Under heron ska vi nu sälja in Nexläx gör en cool genomgång av
nexläx som är lika stor som hero bilden. Den ska vara välutvecklad och du
ska vara som en webdesigner." Sektionen `#nexlax` står direkt efter `#hem`,
på papperet i båda lägena, ungefär en skärm hög på datorn: rubrik i h2
(aldrig h1, delningsbilden läser första h1), ingress, en lodrät stig med
fyra delar, en telefon i HTML/CSS med fyra skärmar i samma rutnätscell
(vägen, frågan x + 9 = 23 som rättas, nivån klar, en nivå från
studiehjälparen med dagens uppdrag), ämnena i `--amne-*` (utan programmering; juridik och
företagsekonomi kom med 2026-10-08, i en inbäddad panel, och meningen
säger att de finns på gymnasiet), en rad om stadierna och NP och att
NexLäx ingår, knapparna och bildtexten "Frågan och talen är exempel".

Reglerna:
- Det är en illustration och inget quiz. Scenen är `role="img"` med en
  beskrivning, och inget i den tar fokus. Prova NexLäx kommer inte
  tillbaka.
- Exempelfrågan är vår egen och grep:as mot `verktyg/uppgiftsbanken` och
  `supabase/migrations`. Talen står i markupen och räknas aldrig av
  skriptet: +10 XP för ett val, 50 för en nivå som klaras första gången
  (alltså +100 för nivån), 520 XP ger Utforskare, märket En vecka i rad
  vid 7 dagar, uppdragen xp-50, nivaer-1 och rad-5 (ett ur var grupp),
  "Tre i rad!" ur RAD_HEJA. Ändras XP-reglerna, ranken, märkena eller
  uppdragen ändras illustrationen samtidigt.
- Inget lås, inga antal frågor eller nivåer, inget om lärare.
- Rundturen, `nexlax()` i `nextrum-start.js`: högst tre varv varje gång
  telefonen kommer in i bild; väntan räknas bara medan den syns och fliken
  är framme; `.nlx-paus` stoppar omloppet, svävandet och ringarna; ett tryck
  på en del visar dess skärm i sex sekunder till och spelar sedan klart
  varvet (varven räknas vidare); en linje under delens blad visar skärmens
  tid (`--nlx-tid`, `.nlx-tur`); reducerad rörelse ger ingen rundtur; på
  mobil går samma rundtur.
- Omloppet är dolt under 760 px och mellan 1000 och 1199 px (där klipptes
  brickorna vid kanten), och står stilla vid reducerad rörelse. Lapparna
  visas från 1360 px och står där skärmen är tom.
- Delarnas noder är knappar (`button.nlx-del-nod`, `aria-labelledby` på
  delens rubrik, `aria-current` på den som visas), så att Enter och
  tangentbordet når skärmarna. På telefon döljs de delar som inte visas
  bara för ögat (opacity), aldrig med visibility: en skärmläsare ska höra
  alla fyra (granskningen 2026-10-07).
- Står rundturen still (utanför bild, dold flik) går ingen timer: väntan
  parkerar sig och väcks av `paus()`. Samma sak i studievyns rundtur.
  `.nlx-paus` har en egen regel med högre vikt för de fyra animationer
  som sätts med shorthand i tyngre regler.
- På dator staplar spalterna var för sig (`.nlx-spalt`, `display:contents`
  på telefon), så att ämnena står under telefonen och inte som en egen rad
  under allt; sektionen är cirka 1,2 gånger heron på 1440×900. Telefonen
  på mobil följer också höjden, så att den och delens text ryms på en
  skärm.
- Ingen text i skriptet, ingen `nextrum-uppgifter.css` och ingen
  `nextrum-ljud.js` på startsidan.
- Markupen byggdes ur samma mall på båda språken; ändras texten för hand
  ska taggföljden hållas lika och jämföras med difflib.
- Studievyns NexLäx-panel (startsidan och För elever och föräldrar, båda
  språken) säger "Öppet" och "Nästa steg: Procent" sedan samma dag, inte
  "Låst" och "Nu är Procent öppet".

## Ur avsnitt 11: banken, driftsättningen och det som är kvar

- **Uppgifterna (Fas 23.1) har en bank, inte en kursplan.** Se
  `python3 verktyg/bygg-uppgifter.py` för vad som finns. Fas 23.1 och
  23.2 gav 109 nivåer och 872 frågor i matematik, svenska, engelska och
  NO. **Fas 23.3 (2026-09-29, `uppgiftsbanken_fler_amnen`)** gav 40
  banor, 359 vanliga nivåer och 2 895 frågor, med 199 Mästarprov och
  repetitioner. Leo: "pusha in så mycket material i vårat system som
  möjligt ... fler ämnen fler årskurserna, fler uppgifter". Nya banor
  är SO åk 4, 6, 7 och 9, NO åk 4, 6, 7 och 9, svenska åk 2, 4, 5, 7,
  9 och gy1, engelska åk 3, 5, 7, 9 och gy1, matematik gy2 och
  programmering åk 6 och 9. Varje område som hade en enda nivå fick en
  andra, och därmed ett Mästarprov. Moderna språk har ingen bana: ett
  ämne i `NX.AMNEN` som rymmer flera språk hade blandat spanska och
  tyska i samma bana.
  **Inget är kopierat.** Leo bad om uppgifter ur gamla nationella prov
  och det som finns gratis på nätet. De nationella proven är skyddade
  (Skolverket släpper dem för undervisning, inte för en betald tjänst),
  och sajter som Khan Academy har licenser som inte tillåter
  kommersiell användning. Allt är skrivet från grunden mot Lgr22:s
  centrala innehåll, och lästexterna är påhittade. Skriv så också
  nästa gång; att hämta en uppgift ur ett prov är ingen genväg.
  **Matematik åk 8 fick två nya områden sist**, inte nya nivåer mitt i:
  den enda eleven i drift går där, och en nivå mitt i vägen låser nästa
  (punkt 5 nedan). Andra banor fick nivåer mitt i, för ingen gör dem.
  **Frågorna ska gå att förstå var för sig.** Mästarprovet och
  repetitionen drar dem en och en, så "Samma tes", "Räntan får stå
  kvar" eller en fråga vars svar står i förra frågans förklaring är
  trasig där. Granskningen hittade fyra sådana. Samma sak gäller en
  ordna-fråga med två korrekta ordningar ("raining dogs and cats"): gör
  den till ett val.
  **Kod i en fråga står på raderna efter frågan** (programmeringen),
  med indrag i hårda mellanslag, och spelaren ritar det i ett block med
  lika breda tecken (`frågaHtml` och `.upg-kod`). Ingen annan fråga har
  radbrytningar; en som får det ritas också så.
  Innehållet är skrivet med AI och granskat fråga för fråga, med facit
  uträknat i kod där det går; läs igenom en bana med `--visa` innan den
  används på riktigt, och låt en studiehjälpare som undervisar i ämnet
  göra det. Kvar:
  1. **Nivåerna görs också i barnets egen vy sedan 2026-10-01**
     (`nexlax_for_barnet`, se ovan). Funktionerna prövar barnet med
     `intern.mitt_aktiva_barn()`, konsekvensbedömningen i `DATASKYDD.md`
     har en rad för det, och `rls-test.sql` avsnitt 14 provar att barnet
     bara spelar sitt eget och inte med en pausad inloggning.
  2. **Adminvyn har ingen vy över nivåerna.** Banken ändras i
     `verktyg/uppgiftsbanken/` och går in genom en migration.
  3. **Migrationerna är i drift sedan 2026-09-29**, som
     `20260929100313` (`fas23_1_uppgifterna_blir_digitala`) och
     `20260929100314` (`uppgiftsbanken_startpaketet`), och det driften
     sparade har samma md5 som filerna. Banken är 225 kB och gick inte
     att skicka genom `apply_migration`: databasen hämtade filerna själv
     från main-commiten med tillägget `http` (avsnitt 9), prövade md5
     och skrev raderna i `schema_migrations` i samma transaktion, så
     `created_by` är tom på just de två. Hela `rls-test.sql` gick igenom
     före och efter, 861 av 861. Nästa bank som ändras blir lika stor:
     kör den på samma sätt. Vyerna tål fortfarande att tabellerna
     saknas: uppgifterna syns som förut, utan banan.
  4. **NexLäx-migrationerna (Fas 23.2) är i drift sedan 2026-09-29**,
     som `20260929150309` (`fas23_2_nexlax`) och `20260929150310`
     (`uppgiftsbanken_nexlax`), körda efter att PR #138 mergats, och det
     driften sparade har samma md5 som filerna. Banken är 347 kB och
     gick samma väg som Fas 23.1:s (punkt 3): databasen hämtade filerna
     från main-commiten med tillägget `http`, prövade md5 och skrev
     raderna i `schema_migrations` i samma transaktion, och tillägget
     togs bort igen. Hela `rls-test.sql` gick igenom före, i en
     transaktion som rullades tillbaka med båda migrationerna inlästa,
     och efter: 911 av 911. Vakten släppte igenom: de fem funktionerna
     var Fas 23.1:s.
  5. **Innehållet i Fas 23.2 är skrivet med AI**, av fyra skribenter per
     ämne, och läst en gång till av en granskare som räknade om varje
     facit. Granskaren hittade inga fel facit; två tvetydiga
     slutsatsfrågor, två rätta svar som nekades och fyra förklaringar är
     rättade. Det här bör en människa som undervisar i ämnet läsa innan
     det används på riktigt: Allemansrätten (sv-ak6-lasforstaelse-1,
     skriven ur minnet av Naturvårdsverkets regler; naturvardsverket.se
     gick inte att nå från sessionen), uttrycken i sv-ak6-ordforrad-2,
     slutsatsfrågan i Tomaterna på balkongen (sv-ak8-lasforstaelse-1),
     att bara drunk och forgotten godtas i en-ak8-verb-3, och om
     sannolikhet i två steg (ma-ak8-sannolikhet-2) och olikheter i
     ma-gy1-funktioner-2 ligger rätt i årskursen. En ny nivå mitt i banan
     står i kedjan: den som klarat nivån före men inte börjat nivån
     efter får den nya först, och nivån efter är låst tills den nya är
     klarad. En påbörjad, klarad eller given nivå står öppen, så ingen
     förlorar något hen gjort, men en elev kan se en öppen nivå bli
     låst efter att banken lästs in.
  6. **Fas 23.3:s innehåll** (2 000 nya frågor) är skrivet av sex
     skribenter med AI, ett ämne var, och läst av tre granskare som
     räknade om varje facit. Inga fel facit hittades; en fråga med två
     rätta svar, fyra frågor som byggde på frågan före, ett
     sant-påstående som förklaringen sa emot, kortformer som nekades
     och en ordna-fråga med två ordningar är rättade. Varje facit är
     dessutom rättat som rätt av `intern.niva_ratta` i en lokal databas
     (3 536 svar), och inget fel valalternativ godtas. Skribenterna och
     granskarna listade det en lärare bör läsa; det viktigaste:
     gymnasiets innehåll (gy1 och gy2 i matematik är skrivna efter
     Matematik 1 och 2 i Gy11, och ämnessystemet har nya nivåer),
     förenklingar i SO och NO (Kalmarunionen och Gustav Vasa, spärren
     på 4 procent, lufttrycket 100 kPa, rösträtten 1909), ungefärliga
     pH-värden, svårigheten i programmering åk 9 (`global`,
     `continue`), och språkhistorien i svenska åk 9. Programmeringen
     förutsätter Python i åk 9; Lgr22 kräver inget visst språk.
     **I drift sedan 2026-09-29**, som `20260929155611`
     (`uppgiftsbanken_fler_amnen`), körd efter att PR #144 mergats, och
     det driften sparade har samma md5 som filen. Banken är 1,2 MB och
     gick samma väg som punkt 3 och 4, och tillägget `http` togs bort
     igen. Hela `rls-test.sql` gick igenom före, i en transaktion som
     rullades tillbaka med migrationen inläst, och efter: 923 av 923.
     Ingen fråga blev inaktiv, så gamla svar och XP står kvar.
  7. **Nivåerna ur materialbanken (2026-10-03,
     `uppgiftsbanken_ur_materialbanken`).** Leo: "Använd material banken
     för att uppdatera NexLäx. Fler frågor, fler ämnen Uppdelat i
     årskurs och ämne". Varje övningsblad i `verktyg/bladen/` (155 av
     158; de tre i moderna språk är tyska, spanska och franska, och
     ämnet har ingen bana, se ovan) är minst en nivå, byggd på bladets
     uppgifter och facit och omskriven till frågor som rättas av
     databasen. Öppna uppgifter ("förklara", "visa att", "skriv en
     text") blev valfrågor om samma kunskap, och ett blad med läsetext
     blev en nivå med lästext. Nivåns beskrivning säger vilket blad den
     bygger på. 231 nivåer och 2 094 frågor, 15 nya banor (Matematik
     gy3, Svenska åk 1, gy2 och gy3, Engelska gy2 och gy3, NO åk 1, åk
     2 och gy1 till gy3, SO åk 5, åk 8 och gy3, Programmering gy1), så
     banken har 55 banor, 590 vanliga nivåer och 4 989 frågor.
     **Allt står sist i banorna**, i nya områden, genom listan
     `TILLAGG` i `verktyg/uppgiftsbanken/blad_*.py` (bygg-uppgifter.py
     lägger dem efter banans egna nivåer). Ingen fråga som redan fanns
     ändrades, så ingen blev inaktiv. Skrivet av sju skribenter med AI,
     ett ämnesområde var, och läst av tre granskare som räknade om
     varje facit och körde programmeringens kod: inga fel facit, men
     två faktafel (ekologisk odling får använda vissa bekämpningsmedel,
     Norden blev kristet under medeltiden), en tvetydig källkritikfråga
     och ett hundratal valfrågor där det rätta alternativet var längst
     är rättade. Varje facit rättas som rätt av `intern.niva_ratta` i en
     lokal databas, och inget fel valalternativ godtas. En lärare bör
     läsa: Matematik gy3, som blandar Matematik 3c och 4 som bladen
     gör; tolkningsfrågorna i läsnivåerna (tema, symbol, ton);
     samhällsfakta som ändras (349 ledamöter, 290 kommuner, 21
     regioner, inflationsmålet); Engelska gy3 och Svenska gy2, som till
     stor del är skribentens egen kunskap; och genetiska koden i NO gy3.
     Rättningen nekade först "0,25 mol/dm3" och "2,0 m/s2"; det är
     lagat (punkten om enheter ovan).
     **I drift sedan 2026-10-05**, som `20261003120000` (versionen i
     filnamnet), körd efter att PR #187 mergats, samma väg som punkt 3
     till 6: databasen hämtade filen från merge-commiten med tillägget
     `http`, prövade md5 och skrev raden i `schema_migrations` i samma
     transaktion, så `created_by` är tom. Det driften sparade har samma
     md5 som filen, och 885 nivåer och 4 989 frågor är aktiva, ingen
     inaktiv. Hela `rls-test.sql` efteråt: 1 279 av 1 280. Den som föll,
     "14.6 familjen väljer faktura på ett genomfört obetalt pass", rör
     inte banken: september stängdes i bokföringen 2026-10-03, och
     provets pass ligger i en stängd månad. `rls-test.sql` öppnar sedan
     dess stängda månader överst, i sin egen transaktion.
