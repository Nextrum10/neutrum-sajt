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
- **Upplåsningen är en spelregel, inte ett skydd.** Den räknas i
  `nextrum-uppgifter.js`: en nivå är öppen när den är först i banan, när
  den före är klarad, när den redan är klarad eller påbörjad, eller när
  studiehjälparen gett den. `niva_starta()` startar vilken nivå som helst
  åt familjens eget barn; den som hoppar fram genom API:t hoppar i sitt
  eget spel.
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
- Barnet har inget eget konto: nivåerna görs i familjens inloggning
  (avsnitt 11).

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
  skriver en tvåa. Exponenten godtas bara efter en längdenhet: "3x2" är
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

---

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
  1. **Barnet har inget eget konto.** Nivåerna görs i familjens
     inloggning, alltså med betalning, bokning och meddelanden en knapp
     bort. Ett elevkonto, eller en länk per barn som bara öppnar
     Uppgifter (som utbildningsprovets nyckel), rör Auth och ska göras
     för sig. Konsekvensbedömningen i `DATASKYDD.md` säger redan att
     den ska göras om den dagen barn får egna konton.
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
