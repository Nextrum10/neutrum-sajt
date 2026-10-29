# Nextrum — projektminne
Läxhjälpsförmedling i Stockholm: publik sajt på två språk och tre inloggade vyer, statiska filer
mot Supabase, driftsatt på Vercel (`nextrum.se`). **Nextrum AB** (559609-3269) är avtalspart och
personuppgiftsansvarigt sedan 2026-10-28 (Leo: "alex och leo ansvarar inte längre för datan"); organisationsnumret
står sist i footern på varje sida, i villkoren och i policyn. F-skatt, moms och arbetsgivarregistrering väntar. Driften står i `START-HÄR.md` och
`DEPLOY-*.md`. Det här är kärnan, som läses i varje session: reglerna och fällorna, kort.
Varför, historien och proven står i `minne/`, som läses när arbetet rör området:
- `minne/grunden.md`: stacken, hela filkartan, språket, arbetssättet
- `minne/affaren.md`: flödet, bokningen, svaren, passets sida, avtal, chatten, ordlistan
- `minne/betalning.md`: siffrorna, kort, Stripe, hållen tid, bokslut, löner (och fakturan, borta sedan 2026-10-21)
- `minne/timmar.md`: planer, klippkort och timbanken (Fas 16.1, 21, 22)
- `minne/nexlax.md`: uppgifterna, nivåerna, NexLäx och uppgiftsbanken (Fas 23)
- `minne/vyerna.md`: startsidan, paletten, fällorna i vyerna, adminvyn, tusen rader
- `minne/databasen.md`: tabeller, migrationer, audit, jobb, gallring, radering
- `minne/notiser.md`: notiserna, beskeden till den som söker, utbildningsprovet, mejlens skal
- `minne/sakerhet.md`: säkerheten, inloggningen, samtycket, advisorn, CSP
- `minne/funktioner.md`: edge functions, agenterna, AI-lagret, maskoten
- `minne/genererat-och-ci.md`: genererade filer, sidornas innehåll, CI, `rls-test.sql`
- `minne/barnkonton-och-admin.md`: barnens inloggning, rollen `nextrum_barn`, adminrollerna

**Ändras en regel: ändra kärnan och filen i `minne/` i samma commit**, och `MINNESPOSTER.md` om
regeln står där. `.vercelignore` utesluter `*.md` och `/minne`.

## 1. Affären, i ordning
1. Familjen skickar **intresseanmälan** → rad i `leads` (Nextrum matchar; ingen katalog)
2. Ni ringer och väljer studiehjälpare
3. Admin tar in familjen (**Ta in familjen** på anmälan, 2026-10-06): kontot skapas med anmälans
   adress, eleven ur anmälan, och familjen väljer lösenordet genom länken i mejlet; i samma ruta kan
   vi sätta in gratistimmar (2026-10-13). **Inget Skapa
   konto** på sajten (2026-10-07): konton skapar bara vi (`bjud-in`) och föräldern (barnets inloggning).
   **Anmälan flyttar till familjen** (2026-10-21, `intag_lead()`, bara superadmin: sist i Ta in familjen,
   och knappen Flytta till familjen för en som redan tagits in): det som inte är personuppgifter (källan, kampanjen, utm, koden, tjänsten) står sedan i
   `intagna_anmalningar` med anmälans id, raden i `leads` raderas och anmälan lämnar listan, och familjen står
   som **Intagen** och barnet som **Matchad** i adminvyn. Tipstimmen, koderna och statistiken läser båda
   tabellerna, för de hittade den nya familjen genom anmälan; familjens profil får inga nya kolumner
   (`skydda_profilfalt`). Meddelandet gallras som i `leads`
4. `admin.html` → **Familjer** → välj hjälpare: sätter `matched_tutor_id` och `match_status`
   **samtidigt**. Först då öppnas bokningen, köpen och tråden; före det är vyn öppen med barnen,
   NexLäx och profilen, och säger att vi letar studiehjälpare (`S.väntar`, 2026-10-07; inget väntläge)
5. Föräldern lägger in barnet, hjälparen skriver studieplanen
- **Behoven styr matchningen** (2026-10-21, `behov_i_matchningen`, Leo: "det är ju behovet som ska ge oss den
  statistiken"): familjens behov (`NX.BEHOV`, sex koder) väljs i intresseanmälan (`leads.behov`, och upplägget i
  `leads.format_onskemal`) eller på barnet, och Ta in familjen för dem till eleven; studiehjälparen väljer samma
  koder som styrkor i sin profil (`tutor_profiles.styrkor`, i vitlistan i `skydda_tutorfalt`). `matchningspoang()`
  ger behoven 12 av 100 (ämne 45, årskurs 27, utrymme 10, erfarenhet 6), aldrig ett hårt nej, och halva när någon
  sida saknar dem. Koderna ändras i `NX.BEHOV`, `students.behov`, `leads` och `tutor_profiles` samtidigt.
- **Kön i matchningen** (2026-10-26, `kon_i_matchningen`, Leo: "vill studiehjälparen inte hjälpa motsatta könet syns
  då inte den studiehjälparen i matchning"): elevens kön står i `students.kon` (föräldern i studievyn, admin i Ta in
  familjen och Redigera), och studiehjälparens kön och val (`bara_samma_kon`) i `matchningsval`, aldrig i
  `tutor_profiles`, som familjen läser: valet ser bara hen och vi. Två koder för alla, `kvinna` och `man` (`NX.KON_ELEV`
  säger flicka och pojke), och tomt är inget svar. Den som bara vill hjälpa sitt eget kön visas inte för en elev av ett
  annat eller utan angivet kön (`matchningsforslag_rader`, och adminvyns `krockarMedValet` med samma regel), utom
  elevens nuvarande, och databasen nekar en ny sådan matchning för alla (`students_vakt_kon`, som går sist av
  BEFORE-triggrarna); en matchning som redan står rivs aldrig utan blir en uppgift (`kon_krock:<elev>:<studiehjälpare>`).
  **Förälderns kön sparas inte** (Leo skrev "alla profiler"; matchningen behöver det inte). Det är en särbehandling på
  grund av kön i en tjänst till allmänheten, och juristen har inte läst den (avsnitt 11).
- **Uppstartsrutan**: `data-uppstart` och banans vecka byts tillsammans, på båda sidorna; när
  passen börjat går rutan och `nextrum-uppstart.css` bort. Den är en låg remsa ovanför formuläret, och
  intresseanmälan har inget sidhuvud: formuläret står överst med rubriken i sin yta (`.nx-anm`, 2026-10-08,
  Leo: "Ha formuläret högst upp").
- **Förslag**: inga nya statusar, inga raderade pass, avbokning med fast skäl; en vy ändrar bara
  tid, status och skäl. Tider 11–22 på vardagar och 9–22 på helger (`HELA_DAGEN`), bara i vyn.
  `svar_meddelande` hålls utanför audit, notiser och AI.
- **Ångerrätten** (14 dagar) gäller också köpta timmar, och använda timmar räknas då till
  avtalat pris. Meningen sist i bokningens dagpanel bär undantaget för hållna pass och får inte
  tas bort.
- **Sen avbokning** (2026-10-22, `sen_avbokning`, Leo: "minst 12h innan måste det avbokas, avbokas det inom 12h av att
  lektionen ska hållas betalas 50% av belopp, eller spenderas hälften av planerade timmar för lektionen"): avbokar
  familjen ett bokat pass mindre än 12 timmar före start (också efter start; exakt 12 är i tid) räknas det som hållet i
  halva tiden: hälften av priset med Betala nu och resten tillbaka av ett betalt pass, eller halva tiden ur timmarna (en
  gratistimme sparar inget, tipstimmen och planens gratis timme är använda). Samma när admin avbokar på familjens
  begäran (`avbokad_for_familjen`, bara `is_admin()`, frågan i Avboka); förslag, studiehjälparens och vår egen
  avbokning kostar inget, och familjen flyttar inte ett bokat pass inom gränsen. Bara pass som föreslogs efter att
  familjen godkänt villkoren 2026-10-23 (`intern.familjen_har_avbokningsregeln`), och vyerna frågar databasen
  (`sen_avbokning_lage()`), aldrig sin egen räkning. Avgiften sätts bara av `stampla_avbokningen` när passet avbokas,
  och efteråt kan superadmin bara efterskänka den; gränsen och andelen är låsta i `betalning_installning`
  (`avbokning_avgift_timmar`, `_procent`) och står i villkoren (`#avbokning`), och ändras tillsammans. Studiehjälparen
  får ingen lön för passet. Ångerrätten går före: en ångrad bokning som inte börjat kostar inget, och villkoren säger
  det.
- **Omdömen** hittas aldrig på och visas bara ihop med hur de kontrolleras; alla familjer med
  två rapporter får samma Google-fråga, och `tutor_reviews` blir aldrig publik. **Trustpilot** (2026-10-27) står under
  brevet i `#rost` ur `omdomen.json`, avskriven för hand, alla omdömen med och de senaste först, och aldrig Trustpilots
  skript eller ram: de öppna sidorna laddar inget från andra domäner (`nextrum-socialt.js`, `minne/vyerna.md`, Fas 25).
- **Om oss** (2026-10-22, `/om-oss`, Leo: "varje påstående måste gå att belägga i koden eller i befintlig sajttext"):
  det som inte går att visa står inte där. Inga antal, omdömen, procent, kronor, namn eller titlar, ingen garanti, inget
  "forskning visar" och inget om bakgrundskontroller; priset står på prissidan. `test/innehall-regler.py` vaktar i CI och
  skriver ut platshållarna. Startsidans exempel, Så ser ni att det funkar (`#exempel`, `nextrum-exempel.js` och
  `-css`), togs bort 2026-10-26 (Leo: "ta bort den"), och Om oss länk till det går till studievyn på För elever och
  föräldrar.
- **Betygsgarantin** (2026-10-07, `#betygsgaranti`): svår att få genom villkor som går att
  räkna (hållen tid, uteblivna pass, uppgifterna i tid, betalningarna), aldrig genom att vi
  bedömer engagemang; den enda bedömningen är Leos regel att ett ämne som inte gick upp för att
  tiden lagts på ett annat av ämnena med garanti inte omfattas, och hjälp i andra ämnen påverkar
  den inte. Årskursens sista betyg (varje årskurs), högst tre ämnen, två timmar i veckan och 10
  timmar sammanlagt, och bara anmäld och påbörjad senast 31 december. Föräldern anmäler i vyn
  med barnets nuvarande betyg, och bara `anmal_betygsgaranti()` skriver och prövar; anmälan är låst
  för familjen, och bara admin rättar den (`andra_betygsgaranti()`), med "senast ändrad" i familjens vy
  och vem i `andrad_av`, som ingen inloggad läser; ämnena står i `NX.GARANTI_AMNEN` och
  `intern.betygsgaranti_amnen()` och ändras tillsammans, betyget gallras den 1
  oktober efter läsåret, och kopiorna vid anspråket raderas för hand. Ett anspråk prövas i elevens
  panel (2026-10-15): `betygsgaranti_underlag()`, bara superadmin, räknar det villkoren säger att vi
  prövar ur det familjen ser och sparar inget, och det som inte går att räkna (slutbetyget, lovveckorna,
  vem som avbokade, tiden mellan ämnena) står under Bedöms av er. Tiden räknas ur rapportens ämne, och
  studiehjälparen ser därför vilka ämnen eleven har garanti i, aldrig betyget
  (`mina_elevers_garantiamnen()`, i elevprofilen och rapporten). Ersättningen är timmar,
  aldrig pengar. Startsidan, prissidan och FAQ säljer den utan villkor och siffror (utom sista
  dagen i FAQ-svaren, som annars missas), men länkar alltid till villkoren, säger att de gäller
  och lovar aldrig ett betyg.
- **Chatten** läser admin med `chatt_las()` (loggat, aldrig cachat), aldrig `NXKontakt.tråd()`;
  att vi kan läsa står i policyn och chatten och tas inte bort.
- **Månader** väljs på passets månad, och ingen väljare börjar före september 2026.
- **Betalning: Betala nu** (2026-10-21, `betala_nu`, Leo: "man betalar när man fått de bekräftat att man
  kan boka lektionen", "betala direkt med kort eller betala med klarna", "Alla betala knappar ska vara oranga och
  stå betala nu. Så bekräfta rapport kan tas bort"): familjen betalar varje pass med kort eller Klarna så fort
  studiehjälparen bekräftat tiden, med den orange knappen Betala nu (på passet, i listorna och under Betalning,
  som visar Att betala och Betalt), och betalar de inte hålls passet ändå och vi följer upp (Leo: "Passet hålls,
  vi jagar"). **Bekräfta rapport finns inte**: menyn, sektionen och knapparna är borta, `#bekrafta` leder till
  Betalning, och `rapport_bekraftelser` står kvar som historik. Kassan tar `BETALSATT` (`card`, `klarna`) och
  webhooken `checkout.session.async_payment_succeeded`. Strömbrytaren `kortreservation` står av och ska inte slås
  på utan nya villkor; texten och strömbrytaren följs åt (Siffror nedan). Ett hållet pass betalas
  även obetalt före. Ett pass med kortpengar avbokas inte från en vy, och ett i tvist återbetalas inte.
  **Ingen faktura** (2026-10-21, Leo: "Ta bort fakturasystemet helt"; ingen hade gått till en familj):
  inget betalsätt, ingen månadsfaktura för obetalda pass, ingen text som lovar en. Del 1
  (`fakturan_tas_bort`) låser strömbrytaren `faktura` av (`flaggor_faktura_av`, som `kortsparr`) och
  skriver om allt som läste fakturan; del 2 (`fakturans_tabeller_tas_bort`, för hand efter en backup)
  droppar `invoices`, `invoice_lines`, `faktura_sparr` och `intern.kassan_oppnad`, och `faktura` är inte
  längre ett `betalning_status`. Båda stannar om en rad hör till någon annan än testkontot Leo Trikke eller
  ett adminkonto (2026-10-20, Leo: utkastet och fyra fakturapass på hans eget adminkonto räknas som test).
  Ett obetalt pass följs upp av oss (`ej_betalt`), och påminnelser tas ut utan avgift.
  `passunderlag.fakturerad` (alltid falsk) och analysvyernas fakturakolumner (alltid noll) står kvar för
  vyerna som bygger på dem, och `fakturering` och `faktura-utskick` behåller sina namn: de gör lönernas
  underlag.
- **Betala alla** (2026-10-27, `flera_pass_och_aterbetalningar`, Leo: "man ska kunna betala flera saker under samma
  kassa, eller alltså fler pass samtidigt. antingen alla eller pass för pass"; i drift sedan 2026-10-27): 2–20 bekräftade pass i
  EN kassa med en rad per pass, och pass för pass som förut. Kassan bär Stripes id i stället för passen
  (`passkassor`, `passkassor_pass`: `bookings` har ett unikt PaymentIntent och en unik session per pass), och passen
  får `passkassa_id` när den är betald. Bara databasen räknar och skriver (`passkassa_skapa`; `passkassa_betald` i en
  transaktion: liggarens rad, varje pass med sin del, kortet vinner över timmarna och timbanken, avgiften delad på
  passen), en familj har en öppen kassa åt gången, och en kassa vars Klarna-betalning väntar (`vantar_at`) släpps
  inte och tar inga av sina pass till en ny. Med i Betala alla är bara pass vars rad säger Betala nu: ett pass som går
  att betala med timmarna står utanför. Ett pass i en kassa betalas tillbaka på sin rad, aldrig över den.
- **Hållen tid** (Fas 20.1) debiteras per påbörjad kvart; avvikelse kräver skäl, ingen ändring i
  efterhand. Övertid på egen rad (`pass_tillagg`), aldrig passets betalningskolumner. Lönen
  följer tiden nedåt, uppåt bara när övertiden är betald. Blir ett betalt pass kortare går mellanskillnaden
  tillbaka av sig själv (2026-10-21: `kortare_pass_att_aterbetala()`, `stripe-reservation`, `_delad/kortare.ts`),
  och villkoren lovar det; tillägget betalas med Betala nu.
- **En stängd månad** (Fas 20.2) är låst i databasen, också för admin, tills den öppnas.
- **Betalningar, Månadens ekonomi och Löner** räknar på `betalningsrader()` och
  `NXBetalning.passpris`, så en månad har ett belopp; testbetalningar räknas aldrig. En månad
  skapas först när den är slut: `fakturering` nekar en som pågår med 409, och rutan låter bara
  torrköra den (2026-10-01). Ett pass hör till EN lönemånad: sin egen månads så länge den är ett
  utkast, och körningen går varje natt och lägger sena pass där (`malmanad`,
  `NXBetalning.lonemanad`); Godkänd sparas bara om beloppet är det som visades. Körningen står under
  Betalningar → Månadskörningen (fliken hette Fakturor till 2026-10-21). PAXml tar bara godkända, inte
  utbetalda underlag och är inte provläst i Fortnox. Personnummer, bankkonto och skatt står i
  Fortnox, aldrig här, och lönespecen räknar inget och drar ingen skatt. **Timpenningen är
  inklusive semesterersättning** (2026-10-01): filen lägger inget på, och Fortnox får inte heller
  (löneart som inte är semestergrundande, ingen semesterersättning inställd på personen).
- **Timmarna**: `bookings_timmarna_tillbaka` är den SISTA before-triggern på `bookings`
  (namnordning), och klippkortets triggrar rör inte `skydda_bokningsfalt`. Timmen dras bara i
  `klippkort_dra()`, när förslaget skapas, och kommer tillbaka vid nej, avbokning eller
  obesvarat förslag. `timmar-betalar` väntar aldrig på ett lås. **Ett pass dras från högst två köp**
  (2026-10-14, Leo: ett pass "kan delas" mellan gratistimmarna och planen): det första i
  `forsta_klippkort_id` och `forsta_klippkort_timmar`, resten i `klippkort_id`, i ordningen ur
  `intern.timmar_fordela` (gratis först, sedan det som går ut först), och blir passet kortare kommer
  timmarna tillbaka bakifrån (`intern.kortets_anvanda`, och samma uttryck i vyerna). Ett pass med en
  timme på köpet drar resten ur timmarna (`intern.passets_korttimmar`; Leo: "tipstimmen används också
  före planerna"), men timbanken betalar bara hela pass utan den. De sparade minuterna kommer bara ur
  köpta timmar och går inte ut. Timbanken visar sedan 2026-10-13 också timmar för tips, som är ett avdrag
  på nästa pass, inte ett köp. Vid ånger eller uppsägning: avboka först allt kommande.
- **Gratistimmar** (2026-10-13, Leo): admin sätter in dem i familjens timbank, i Ta in familjen och i
  familjens panel under Ekonomi, och bara genom `ge_gratistimmar()` (1–40 åt gången, `is_admin()`). **Med en orsak
  och en månad** (2026-10-21, `timmar_med_orsak`, Leo: "timmar, månad, obligatorisk orsak, egen oföränderlig
  loggrad"): `ge_gratistimmar(familj, timmar, orsak, månad)` kräver orsaken (3–500 tecken) och månaden timmarna avser
  (september 2026 till nästa månad, utan månad den innevarande), och skriver en rad i `timmar_insatta` som ingen
  ändrar eller tar bort (orsaken töms när familjen avidentifieras, och `profiles.raderad_at` står fast när den satts:
  `profiles_raderad_star_fast`, granskningen 2026-10-21); den gamla med två argument kör ingen inloggad.
  Månaden säger vad timmarna avser, inte när de går ut. Raden Första timmen gratis i familjens panel är borta
  (samma dag, Leo); timmen själv följer den första planen som förut. De är
  en rad i `klippkort` med erbjudandet `gratis` (katalograden säljs aldrig), utan betalning (`betalt_ore`
  0, `betald_at` null) och utan villkor först: en gåva är inget köp. De gäller i 60 dagar och dras först,
  med planens gratis timme, före köpta timmar (Leo: "de används först av alla timmar"; ordningen är
  `gratistimmarna_60_dagar`s, där ett kort med gratistimmar räknas som gratis), sparar inga minuter
  (`intern.timbank_in`) och betalas aldrig ut; studiehjälparen får lön som vanligt. **De påminns** tio dagar
  innan de går ut (2026-10-15, `gratistimmarna_paminns`, Leo: "fixa påminelse"), med planens gratis timme som
  gäller efter planen och tipstimmarna: samma mejltyp och val som köpta timmar, med `gratis` i datan, och mejlet
  lovar då inga pengar tillbaka. Utan studiehjälpare (`S.väntar`) kan familjen inte boka, så då blir det en uppgift
  till oss i stället, en gång per kort och dag (idén från PR #287). Ett återkallat kort påminns aldrig. Villkoren
  sa "förfaller utan påminnelse" (`#gratistimmar`) till versionen 2026-10-16, då orden togs bort; de lovar ingen påminnelse.
  `ta_tillbaka_gratistimmar()` tar bara det som inte ligger på ett pass, och återkallar kortet
  (`aterkallad_at`) i stället för att radera det (2026-10-14): ingen `delete`, och historiken står kvar.
  De står utanför första timmen, som tipstimmen. Det river beskedet 2026-10-09 "inte få gratis av oss".
- **NexLäx**: rättningen sker i databasen; frågorna går ut utan facit, försök och svar har ingen
  skrivpolicy, och en digital uppgift bockas inte av för hand. Stjärnor, serie, märken och XP
  sparas aldrig; XP:s regler står bara i `intern.nexlax_*`, och XP minskar aldrig. **Din väg går ett steg i
  taget** (2026-10-27, Leo: "Steg i nexläx din väg ska gå steg för steg"): en nivå öppnas när den före är klar
  (eller studiehjälparen gett den), och delarna i en nivå görs i ordning; ämne och årskurs väljs fritt, och NP-spåret
  är helt öppet. Från 2026-10-06 till dess var allt öppet, och det som klarades då står kvar som klart. **Fripassen**
  (samma kväll, `nexlax_fripass`, Leo: "de ska gå att göra de nivåer som är låsta men då ska de stå är du säker ... 5 såna
  hoppa nivåer fripass per vecka"): kortet vid en låst nivå frågar "Är du säker på att du vill göra den här nivån före
  ...?" och tar ett fripass (`niva_hoppa()`), fem i veckan per elev (måndag till söndag, svensk tid,
  `intern.nexlax_fripass_per_vecka()`), som inte sparas till nästa vecka; en hoppad nivå är öppen för gott och kostar inget
  mer. Databasen räknar dem ur försöken (`niva_forsok.fripass`, bara `niva_hoppa` sätter den) och vyerna läser
  `nexlax_lage().fripass`; låset självt är fortfarande vyns spelregel. En låst del i en öppen nivå tar inget fripass. Startsidan visar NexLäx bara som en
  illustration (2026-10-07): exempelfrågan finns inte i banken; XP och uppdrag i den följer
  `intern.nexlax_*`, rank och märke `RANGER` och `MÄRKEN` i `nextrum-uppgifter.js`, och den ändras med dem. Belöningar är märken, inte pengar, och serien påminns aldrig om: båda är
  beslut. `.nl-hopp` går med flit inte att trycka på. **Uppdragen** (Fas 23.4) räknas av
  `intern.nexlax_uppdrag`, sparas aldrig, ger inga XP och påminns aldrig om; katalogen är
  historik, så ett nytt uppdrag får ett nytt id och ett `fran`. **NP-spåret** är `nivaer.spar`,
  satt av verktyget ur områdets namn, och där är varje nivå öppen. Gamla nationella prov
  kopieras aldrig in: NP-sektionen länkar till provgrupperna (`NP_LÄNKAR` speglar `lankar.py`),
  och barnets vy har inga länkar ut. Fel i en fråga rapporteras i spelaren (`rapportera_fragefel`,
  fyra skäl, ingen fritext, ingen person) och syns under Material i adminvyn. Ljuden räknas fram i webbläsaren (`nextrum-ljud.js`) och
  valet sparas där. Ämnen som bara finns i NexLäx står i `NX.NEXLAX_AMNEN`, aldrig i `NX.AMNEN`.
  **NexLäx är ett spel i studievyn** (2026-10-13; enklare och ljust 2026-10-21, Leo: "jag tycker de blev för
  komplicerat"): fyra flikar (Din väg, Din utveckling, Studiehjälparen, Rank och märken), alltid på Din väg när man
  kommer in, banan synlig direkt (toppen, studiehjälparens remsa, Dagens uppdrag hopfällt och ämnesbanderollen i ETT
  kort, `.nl-kort`; väljaren under kortet, där ämne och årskurs byts fritt med elevens egna som förval), ytan och inte
  barken i ljust läge (barkens tokens pekar om på ytan, så mörkt läge är mörkt som förut), huvudsidans gradient på NexLäx titel och val (ingen separat sida: menyn och hälsningen står kvar, Leo
  2026-10-13), ranker som en rad kort att svepa i med rankmärken som belöning (aldrig pengar) och märkena under i samma
  flik, märken som färgglada medaljer (räknade, aldrig sparade) också på profilen, Din utveckling som EN sida
  (talen, ämne för ämne, veckorna, uppdragen; inga sidknappar, ingen Rättat), tre ämnen framme och resten bakom Visa fler ämnen, och klockljud i
  `nextrum-ljud.js` som bara låter för det man klarar (rätt svar, nivå, uppdrag, kista, märke, ny rank): knappar
  och flikar ger bara vibration (Leo 2026-10-13). Grupper att tävla i är inte byggda (`minne/nexlax.md`).
  **Faktabladen** (2026-10-27, Fas 25): ett blad per område (vad man lär sig, vad man behöver veta, exempel, ord),
  i `verktyg/faktablad/`, byggt till `nexlax-fakta/<ämne>-<årskurs>.json` av `bygg-faktablad.py`, aldrig en tabell, och
  visat en gång när ett nytt område börjar och under lampan; ett nytt område får sitt blad i samma ändring (CI nekar
  annars). **Ledet**: varje område har ett enda streck som fylls med de klara frågorna och procenten bredvid, 100 % först när allt är klart; inget sparas. **Prickarna** (Fas 25.1,
  Leo: "max vara 3 uppgifter i varje liksom prick"): en nivå står på vägen som en prick per högst tre frågor (`delar()`), med
  en ring runt den som står på tur, och spelas en del i taget i samma försök; databasen vet inget om delarna, och stjärnorna är
  nivåns. Ett försök fortsätter bara ett dygn (`niva_starta`), så gjorda prickar blir ogjorda efter det. Kortet vid en prick
  står ovanpå vägen och öppnas på plats (`växlaNod`), aldrig genom att vyn ritar om vägen (Leo: "mer smooth att trycka på").
  Vägens områden har startsidans fyra färger (`OMRÅDESFÄRGER`: blå, grön, lila, rosa, som prickarna i `.hj-nex-bild`), och de
  klara prickarna är fyllda i områdets färg; ändras prickarna på startsidan ändras listan med.
  **Vägen som i Duolingo** (2026-10-27, Leo: "gör den lika fin som duolingo ... när man klarar nivåerna då blir de färg ...
  något kul vid sidan som täcker sidan"): prickarna är större och tjockare med blank översida och bredare sicksack, och
  varje nivå har en egen färg ur de fyra (`områdesFärg(amne, områdesindex + nivånummer)`, `data-nl-f` på prickens `li`), så
  vägen blir färgglad när man klarar nivåerna; prickarna är mynt som Duolingos (`--nod`, samma kväll, Leo skickade en bild:
  platt färg, tjock kant, diagonala ränder, aldrig lack, gradient eller skugga); en nivå är ett uppdrag med högst tre frågor per prick, som förut. På en skärm
  från 1100 px står dagen i en sidopanel bredvid vägen (`sidaHtml`: serien, rangen med vägen till nästa, Dagens uppdrag öppet),
  och kortets egna uppdrag och statpiller döljs då; inget nytt sparas. Ämnet och årskursen eleven valde minns webbläsaren
  (`nx.nexlax.bana.<barn>`, på `lagring.html`).
  Ett klart steg leder vidare med EN knapp, Fortsätt, till nästa del eller nästa steg, och kortet vid en prick har en knapp
  (Leo 2026-10-27: "som duolingo nu gör du de för komplicerat").
  Att vi bygger mest på matematik, svenska och engelska (2026-10-12) står under ämnesbrickorna
  (`.nlx-bygger`, brickorna `fokus`) och sist i Välj ämne (`.nl-valj-not`), och ändras på alla ställen samtidigt.
- **Tipskoder** (2026-09-30): en kod per familj och godkänd studiehjälpare och en kampanjkod per
  affisch. **En familjs kod och en kampanjkod gäller intresseanmälan (`leads.kod`), en studiehjälpares
  jobbansökan (`applications.kod`)** (2026-10-13, Leo: "ansökning ska inte kunna använda koder från
  familjer och familjer ska inte använda koder från anställda"); fel sort blir null som en okänd kod,
  och admin som rättar in fel sort får ett fel. Koden syns i formuläret och lagras aldrig i
  webbläsaren, och en okänd kod fäller aldrig anmälan eller ansökan. Tipstimmen är `startrabatt` med
  `rabattkod = 'TIPS'` (raden i `rabattkoder` blir aldrig aktiv): en per ny familj som haft två
  timmar läxhjälp i hållna pass (sedan 2026-10-09; förut det första passet, `intern.tva_timmar_hallna`),
  också om den familjen fått en av timmarna gratis, och intjänad ges den också med flaggan `tipstimme` av.
  Den gäller i 60 dagar från den dagen (2026-10-13, `intern.tipstimmar_kvar`).
  Den står utanför taket för första timmen. **Den står i timbanken** (2026-10-13, Leo: "timmarna läggs
  in i timbanken för familjerna"): Er timbank och Profil → Timbanken visar den med sista dagen, och den
  dras först, som en gratis timme (`forsta_timmen_bjuds`). En studiehjälpares kod är hens
  värvningskod och ger **värvningsbonusen** (nedan; från 2026-10-13 till 2026-10-21 bonusen för tips i
  `tipsbonus`, som står kvar som historik). En familj som tipsat ser antal, aldrig vilka. **Koder** i adminvyn (`koder_lage`, `nextrum-admin-koder.js`) har allas kod och skapar de som
  saknas, utom åt admins. `/affisch` tar ingen fritext ur adressen, och QR-koden går till formuläret,
  inte till en områdessida.
- **Värvningsbonusen** (2026-10-21, `varvningsbonus`; Leo: "en studiehjälpare som värvar en kompis får en bonus på
  300 kr brutto, inklusive semesterersättning, när kompisen har fått sitt studiehjälparkonto. Systemet betalar INGENTING
  ut"): bonusen är underlag för lönen, aldrig en utbetalning och aldrig i `payouts`. **Koden** är studiehjälparens
  tipskod, som databasen skapar när hen blir godkänd (`intern.tipsbonus_vid_intag`; en ny kod har åtta tecken ur
  `gen_random_bytes`), och den gäller bara medan ägaren är godkänd och kontot inte raderat. Jobbansökan tar den i fältet
  Kod från en studiehjälpare och ur `?kod=`, frågar `prova_jobbkod()` (gäller eller inte, aldrig vems; tio okända i
  timmen per IP-nummer, Cloudflares och aldrig ett värde klienten satt först i X-Forwarded-For, som en HMAC, och högst
  500 okända i timmen totalt) och skickar ansökan utan en kod som inte gäller, med ett besked. Databasen sätter
  `applications.kod` och värvaren (`varvad_av_profil_id`) när ansökan kommer in; bara admin ändrar koden, värvaren
  följer den, och när bonusen tjänats in står koden fast. **En rad** i `varvningsbonus` per ansökan med en giltig kod:
  `vantar`, eller `annullerad` med skälet när den som söker inte är ny (sin egen kod, har sökt förut, hade ett konto).
  **Bonusen följer ansökan som blev kontot** (`applications.konto_id`; granskningen 2026-10-21): en väntande rad
  annulleras med skälet när dess ansökan avböjs, gallras eller tas bort, när en annan ansökan från samma person blir
  kontot och när admin byter eller tar bort koden (då med en ny rad åt den nya värvaren), och att personen är ny prövas
  igen när bonusen tjänas in (kontot fanns före ansökan, en tidigare ansökan, den egna koden). Högst en levande bonus per
  ansökan och per konto, och en intjänad per person. Den blir `intjanad` **exakt en gång**, under radlås,
  när händelsen i `varvning_installning.utlosare` inträffar för kompisen (`konto_skapat` som förval: godkänd i poolen
  eller kopplad av Utbildning hållen; `prov_godkant`; `forsta_pass_genomfort`), med värvaren godkänd och flaggan
  `tipsbonus` på (annars annulleras den med skälet). Bruttot fryses när raden skrivs och delningen när den tjänas in:
  grund `round(brutto / (1 + procent/100))`, semester resten, 26 786 + 3 214 = 30 000 öre. **`varvning_installning` är
  det enda stället** för beloppet, procenten och händelsen (VARVNINGSBONUS_BRUTTO_KR, SEMESTERERSATTNING_PROCENT,
  VARVNINGSBONUS_TRIGGER), och en ändring där rör aldrig en intjänad rad; ändras händelsen ändras policyn och villkoren
  med. Lägena går bara framåt (`vantar` till `intjanad` eller `annullerad`, `intjanad` till `utbetald` eller
  `annullerad`; `intern.varvningsbonus_vakt`), ingen klient skriver och raden raderas aldrig. Admin markerar utbetald med
  lönemånaden och annullerar med ett skäl, bara genom `varvningsbonus_utbetald()` och `varvningsbonus_annullera()`
  (sektionen Värvningsbonus, med filter, summering per värvare och månad och CSV, och rutan under Löner), och lönefilen
  tar de intjänade på lönearten `lonart_tipsbonus`. Värvaren ser under Värva en kompis bara läget och, när kontot finns,
  förnamnet (`mina_tips()`), och får ett mejl när bonusen tjänas in, med beloppet och inget om kompisen. Villkoren för
  bonusen är punkten `#tips` i användarvillkoren, omskriven för den i versionen 2026-10-22 (Leo: "Fixa nr 6"; länken i
  `CFG.VARVNING_VILLKOR_URL`), och ändras med händelsen, beloppet och det värvaren ser. Revisorn avgör anställningen,
  avgifterna och semesterersättningen före första utbetalningen.
- **Bonusarna godkänns av oss** (2026-10-28, `bonusarna_godkanns`, Leo: "värvnings bonus och tipsa familj bonus. de
  registreras på samma sätt, men i admin behöver vi godkänna de ifall de ska få de bonusarna"): värvningsbonusen och
  tipstimmen registreras som förut, men ingen får något förrän en superadmin godkänt det under **Bonusar** (sektionen
  `varvning`) eller Att göra (`bonus_godkann`, också i morgonmejlet). Värvningsbonusen går `vantar` → `att_godkanna`
  (händelsen har inträffat: delningen fryses, `uppfylld_at`, inget mejl) → `intjanad` bara genom
  `varvningsbonus_godkann()` (`intjanad_at` och `godkand_av`, mejlet till värvaren går då, och lönemånaden är
  godkännandets), och kan annulleras med skäl i båda lägena. Tipstimmen räknas bara med en rad i `tipstimme_beslut`
  (en per tipsad familj, `godkand` eller `nekad` med skälet, bara genom `tipstimme_besluta()`, ändras aldrig), och de 60
  dagarna räknas från det senare av intjänad och godkänd (`intern.tipstimmar_godkanda`). Familjen ser
  `att_godkanna` i `mina_tips()`. Villkoren (`#tips`, version 2026-10-28) säger att vi godkänner och bara prövar det
  som står där, och att ett nej har ett skäl.
- **Materialbanken** (2026-10-02): bladen är våra egna. Nationella prov och läromedel kopieras aldrig in,
  banken länkar till provgruppernas egna sidor (`verktyg/bladen/lankar.py`), NP-träningen är egna
  uppgifter i provens stil som säger det på bladet, och genomgångarna är egna faktablad, aldrig bokens text.
  Facit (2026-10-02) står i `verktyg/bladen/facit_*.py`, ett svar per uppgift, och ritas till `bank/facit/`;
  det visas för studiehjälparen och admin (`NX.facitLänk`), aldrig på bladet, i beskrivningen eller i
  familjens och barnets vy. Ändras en uppgift ändras dess svar samtidigt.
- **Frågorna**: talregeln i `intern.niva_tal` och i Pythons `grund.lika()` ändras tillsammans.
  En fråga med svar tas aldrig bort, en ändrad får nytt id. De skrivs från grunden mot Lgr22,
  aldrig ur nationella prov, och ska förstås ensamma. Nytt läggs sist i en bana som används
  (`TILLAGG` i `verktyg/uppgiftsbanken/blad_*.py`, som bär nivåerna ur materialbankens blad, och `fler_*.py`, Fas 23.5).
- **Intaget** (2026-10-06): vi skapar familjens och studiehjälparens konto (Ta in familjen, Utbildning
  hållen som hette Ta in i poolen till 2026-10-21, `bjud-in`) med personens adress, och personen väljer lösenordet själv, två gånger, i en
  ruta som inte går att stänga (`user_metadata.valkommen = 'losenord'`, `NXStudie.lösenordFörst`).
  **Inget gemensamt startlösenord**: ett känt lösenord är ett konto vem som helst kan ta före
  ägaren. Sedan rundturen (`'intro'`, `NXIntro`) i den färdiga vyn, där sista trycket släpper in; den går
  igen under Profil, och en studiehjälpare som inte är godkänd får den först när vyn finns. Skicka inbjudan igen står alltid i personens panel (2026-10-07): före första
  inloggningen en ny inbjudan, sedan en länk för lösenord (`bjud-in` med `igen`). Bara det senaste
  mejlet fungerar, och en trasig länk ger rutan Länken fungerar inte längre (`'lankfel'`), aldrig
  Glömt lösenordet. Mejlen skickar `bjud-in` själv med tiden i ämnet, så att Gmail aldrig lägger
  två i samma tråd och gömmer det senaste (2026-10-07).
- **Användarvillkoren** (2026-10-07): ett godkännande per konto och version (`villkor_godkannanden`),
  med databasens tid och aldrig anropets: rutan vid inloggningen (`NXStudie.villkorFörst`, efter
  lösenordet, för en studiehjälpare efter provet, och före introduktionen, och den går inte att stänga). Kryssrutan i Skapa konto
  (`villkor: true`, triggern på `auth.users`) gick med Skapa konto samma dag; triggern står kvar. Databasen kräver det: den som föreslår eller bekräftar
  ett pass och den som köper timmar har godkänt den gällande versionen (`bookings_kraver_villkor`,
  `klippkort_kraver_villkor`). Avbokningar, databasens egna vägar och admin stoppas aldrig, och barnet
  godkänner inget. Versionen är sidans datum och `intern.villkor_version()`; de ändras tillsammans
  (`kolla-villkor.py`), och då får alla frågan igen.
- **Programmering erbjuds inte** (2026-10-07, Leo): inte i `NX.AMNEN`, NexLäx, materialbanken
  eller betygsgarantin, och ingen sida; `/laxhjalp-programmering` omdirigeras till navet.
- **Vem som får bli studiehjälpare** (2026-10-06, Leo): alla som får jobba och har börjat
  gymnasiet (2026-10-14, Leo: "vi anställer gymnasieelever och uppåt", efter en ansökan från en
  13-åring). Ansökan frågar var man är i skolan (`skolniva`, svaret överst i why), och Grundskolan
  stoppar den i formuläret, inte i databasen. Efter gymnasiet krävs inga studier; "nyligen läst samma
  kurser" är vad matchningen letar efter, inget krav för att söka.
- **Under 18 i jobbansökan** (2026-10-05): åldern under 18 fäller ut vårdnadshavarens e-post, och
  databasen mejlar vårdnadshavaren om ett skriftligt godkännande. Admin lägger in svaret (tid och
  kopia) i ansökan. Adressen sparas bara under 18, godkännandet skrivs aldrig utifrån, och Utbildning
  hållen frågar först om det saknas.
- **Intervjumejlet** (2026-10-21): när admin skickar en ansökan vidare till intervju köar databasen Leos
  mejl "Du går vidare till intervju" till den som sökt, en gång per ansökan (`intern.ansokan_intervjumejl`;
  `applications.intervju_mejl_skickat_at` sätter bara databasen), aldrig till en avböjd och aldrig när ett
  möte bokas i samma steg (mötets mejl är inbjudan) eller när Skriv till hen skickar kallelsen med
  bokningssidan (`kontaktad_at` i samma ändring, 2026-10-20: det mejlet är kallelsen). Det går genom notiskön (`notis_utskick.ansokan_id`,
  rollen `sokande`), så sandlådan och `notiser_mejl` gäller; `notis_konfig.lage` läses inte av någon kod och
  rörs inte. Texten är Leos, i `intervju.ts` och i adminvyn (`INTERVJU_MEJLET`, som visar mejlet
  innan steget sätts), och `kolla-mejltexter.py` håller dem lika. **Mejlet är kallelsen** (2026-10-20, Leo: "lägg in
  bokningslänken i det automatiska meddelandet"): det har länken till bokningssidan, där hen bokar en tid själv, och
  adressen är `INTERVJU_BOKNINGSLANK`, som kontrollen också prövar (mallen läser inte configen). Ansökans tack är "Tack, din ansökan är
  skickad! Vi hör av oss inom 24 timmar."
- **Utbildningsprovet i studiehjälparvyn** (2026-10-21): en godkänd studiehjälpare gör provet vid första
  inloggningen, direkt efter lösenordet och före villkoren och vyn (`NXProvet`; 2026-10-20, Leo: "först välja
  lösenord och sen provet"), och en gång: mer än gränsen rätt (`prov_installning`, 55 % sedan 2026-10-20)
  är godkänt (`prov_studiehjalpare.utbildningsprov_godkant_at`), och den som inte klarar det gör om det efter
  väntetiden (24 timmar). Databasen rättar (`lamna_in_utbildningsprov()` svarar bara poängen och godkänt eller
  inte), `mitt_utbildningsprov()` lämnar frågorna utan facit, och `prov_fragor` läser bara superadmin.
  Spärren står i databasen (`intern.provet_sparrar()`, avsnitt 6) och gäller först med minst fem aktiva
  frågor; adminvyn varnar till dess. De som var godkända före migrationen är undantagna, och admin slår av och
  på kravet och nollställer provet per person (superadmin eller Godkänna). **Frågorna kommer ur
  Handledarhandboken** (2026-10-20, Leo: "provet ska vara utformat efter det dokumenten, 55% rätt för godkänd"):
  26 lätta frågor med tre alternativ (Leo samma kväll: "ersätt med nya på 26 frågor ... gör provet relativt lätt"),
  på de 26 ämnen som provet i ansökan hade, och åtta äldre avstängda (`supabase/scripts/provets-fragor-latta.sql`). De ändras i vyn under Ansökningar → Provet, aldrig i en
  migration och aldrig med påhittade frågor, och ändras handboken läses de om. **Det är det enda provet**
  (2026-10-21, `provet_i_ansokan_tas_bort`, Leo: "ta bort gamla"): provet i ansökan (Fas 22.1, `utbildningsprov.html`
  och edge-funktionen `utbildningsprov`) är borta utan att någon gjort det, utbildningsmötet öppnar inget, och inget
  mejl om ett prov köas (`ansokan_utskick_inga_provmejl`). `applications.prov_*` och `utbildningsprov_forsok` står
  kvar tomma, som historik.
- **Barnkontona** (2026-09-30): ett barnkonto är ett användarnamn och ett lösenord, inget mer.
  Varje inloggning tar e-post eller användarnamn (`NXStudie.loggaIn`, 2026-10-01): med @ en
  vuxen, utan @ ett barn, som hamnar på `/barn`. Adressen `<namn>@barn.nextrum.se` finns bara
  för att Auth kräver en, nekas i inloggningen och tar aldrig emot mejl. Bara föräldern skapar, pausar och tar bort
  inloggningen, genom `barn-konto`. Barnet kan inte boka, avboka, svara eller ändra något utöver
  NexLäx, bocken på en vanlig uppgift (`nexlax_for_barnet`, 2026-10-01), sin tråd med
  studiehjälparen och sina förslag på pass (nedan), och ser aldrig priser, betalningar, erbjudanden eller föräldern; timmarna är
  genomförda och bokade pass, aldrig timbanken. NexLäx görs i barnets vy och i familjens
  inloggning, med samma rader. Elevvyn har fem delar och inget mer (2026-10-06): Översikt
  (antal genomförda och kommande pass), Mina lektioner (utan betalning), NexLäx, Meddelanden och
  Profil, och Boka pass som en sjätte bara när föräldern låtit barnet föreslå pass (2026-10-12). **En inloggning** för förälder, elev och studiehjälpare (2026-10-07): samma ruta på
  `/foralder` och `/larare`, två kort (Familj och elev, Studiehjälpare). **Kortet gäller i
  inloggningen** (2026-10-27, Leo: "trycker jag som studiehjälpare och loggar in som familj så kommer jag
  in utan problem som familj. fixa det"): ett familje- eller barnkonto under Studiehjälpare och ett
  studiehjälparkonto under Familj och elev loggas ut igen med ett besked om rätt kort (`rättKort` i
  `NXStudie.loggaInHär`), och admin loggar in var som helst. En session som redan finns skickas till sin vy
  som förut: studievyn skickar en studiehjälpare till `/larare`, studiehjälparvyn en förälder till `/foralder`,
  och ett barn hamnar på `/barn`. `#elev` tas bort ur adressen, och `/barn` har ingen egen inloggning.
  **Föräldern väljer vad barnet får** (2026-10-06): pass, studieplan, rapporter, NexLäx, notiserna
  och tråden med studiehjälparen (`barn_behorigheter`, rapporterna i `visa_rapporter`), och att
  föreslå pass (`boka` i `far_boka`, av som förval, 2026-10-12). Barnets
  funktioner lämnar inte ut det som är av; vyn säger bara det.
- **Barnets förslag på pass** (2026-10-12, Leo: "barn skickar förslag, precis som förälder, men ser
  inte priset"): förslaget står i `barn_passforslag`, aldrig i `bookings`, och är inget pass. Föräldern
  ser det (Boka pass, Att göra, mejlet `barnforslag`), granskar det i den vanliga ytan med priset
  och skickar det som sitt eget (`skicka_barnets_forslag()`, SECURITY INVOKER, så policyn
  och alla triggrar på `bookings` gäller), eller låter bli. Barnet ser aldrig ett pris, och priset
  vid knappen följer databasens ordning. Ingen rabattkod på ett pass (Koderna, nedan).
- **Koderna gäller bara planköp** (2026-10-21, `koder_for_planer`, Leo: "Bygg en flik Koder i admin med två typer:
  partnerkod (spårar partnerföreningars volym) och rabattkod (t.ex. Zayans). Båda gäller ENBART planköp, aldrig enskilda
  pass"). Koderna är `rabattkoder`, med `sort` ('rabatt' eller 'partner') och `partner_namn`; `typ` är rabattens typ
  (procent, eller belopp i öre) och `varde` får vara noll (en partnerkod som bara räknar). **Ett pass tar ingen kod**, för
  någon (`bookings_kod_bara_pa_planer`, och `intern.rabattkod_prova` säger samma nej till varje kod på ett pass); TIPS är
  tipstimmens markering och står kvar, och ett pass som redan bar en kod behåller den. Bland köpen bara en plan i katalogen
  (`intern.kod_galler_kopet`), aldrig Fyll timbanken, timmar till planen eller gratistimmar; ett eget upplägg är en plan och
  tar en kod (2026-10-27, Leo: "rabattkod gäller också för upplägg"; `kod_pa_upplagget`). **En kod per köp**
  (`klippkort.rabattkod`); familjerabatten och den första planens gratis timme är inga koder och staplas med den (Leo
  2026-10-15). Databasen prövar koden och räknar rabatten (`intern.klippkort_rabatt`, aldrig så att köpet blir gratis), och
  kassan frågar `kod_pa_planen()` med familjens token, räknar om rabatten ur typen och värdet (`_delad/koder.ts`, samma regel
  som `intern.rabattkod_prova`, och de ändras tillsammans) och öppnar ingen kassa när den inte stämmer; en kod på ett pass,
  ett tillägg, kortet eller timmar till planen är ett nej. **Användningen står vid betalningen**: `kod_anvandningar`, en
  rad per betalt köp med en kod, med `betalning_id`, skriven av databasen när liggaren bokför betalningen, aldrig av en
  klient; den och koderna raderas aldrig (triggrar), och en kods namn och sort står fast. **Familjens partner**
  (`familjens_partner`) sparas första gången och ändras aldrig, och tas bort när familjen avidentifieras. Statistiken
  (`kod_statistik`, `partner_statistik`, `kodens_anvandningar`) är superadminens och räknar inte testbetalningar utom på
  begäran. Adminvyn: Koder → Rabattkoder och Partnerkoder. Studievyn: rutan Kod till en plan under Betalning & planer, och ingen ruta i
  Boka pass. **Hur många gånger** sätts per kod, totalt och per familj (`max_anvandningar`, `max_per_familj`), och ett
  återbetalt köp ger tillbaka sin gång. **En rabattkod gäller en gång per familj, och aldrig den egna** (2026-10-21,
  `koderna_agare_och_en_gang`, Leo: "Man kan inte använda sin egen kod. En familj kan använda samma kod högst en gång"):
  databasen sätter `max_per_familj` 1 på varje rabattkod (`rabattkoder_en_gang`, villkoret `rabattkoder_rabatt_en_gang`),
  och en partnerkod behåller gränsen admin satt, för den räknar föreningens volym. En kod kan vara utlagd hos en familj
  eller en studiehjälpare (`rabattkoder.agare`, som triggern `rabattkoder_agare` prövar), och `intern.rabattkod_prova`
  nekar ägaren koden. **Två kassor samtidigt** (granskningen 2026-10-21): familjens egna köp med koden den senaste timmen
  räknas mot gränsen (`intern.klippkort_rabatt`), så den andra kassan får inte koden, och betalas två köp ändå blir det en
  uppgift (`kod_for_manga`). Statistiken räknar köpets rad i liggaren, aldrig ett syskontillägg i samma betalning
  (`intern.betalningens_kopdel`). Adminvyn har sök, lägen, ägaren och en förhandsvisning av rabatten på varje plan (`rabattPå`, samma
  regel som `rabattenPa`). Prövningen har ett tak (avsnitt 6). Villkoren nämner inga koder: en kods villkor
  ska stå där den delas ut (avsnitt 11). Historiken (koden på ett pass, 2026-10-13 till 2026-10-21): `minne/betalning.md`.
- **Familjerabatter** (2026-10-15, Leo: "egna rabattkoder som bara vi har tillgång till ... 10 kr billigare på alla
  timmar som köps tex ... tills vi tar bort rabatten. ... de ser bara att de har rabatt vid checkout men inte annat"): våra
  egna koder (`familjerabatter`, Tjänster → Familjerabatter), kronor av per timme, 1–200 kr i hela kronor, som admin sätter
  på en familj i familjens panel (Ekonomi) och i Ta in familjen, bara genom `satt_familjerabatt()` (`is_admin()`, en kod per
  familj, null tar bort: raden står kvar utan kod, aldrig ett `delete`). Ingen rabattkod: familjen skriver den aldrig, ser
  aldrig koden och den räknas inte. Familjen får bara beloppet (`min_familjerabatt()`), och vyn visar det bara där familjen
  betalar: på plankorten under Betalning & planer (Leo samma kväll: "Visa på korten också"; `medRabatt()`, samma regel som databasen),
  vid priset i Boka pass, i Köp till timmar och i kassan. Kronorna dras på varje timme familjen betalar med pengar, när priset fryses:
  passets `timpris_ore` (`frys_passets_pris`; `bookings.familjerabatt_ore` säger hur mycket), ett köp ur katalogen per betald
  timme (`intern.klippkort_rabatt`; `klippkort.familjerabatt_ore`, och `timpris_ore` står kvar som katalogens) och timmar
  till en plan (`extra_timmar_erbjudande()`). Tillägget för fler barn, gratistimmar, första timmen och tipstimmen rörs inte,
  och en rabattkod räknas på priset efter den: de staplas (Leo samma kväll). Det bokade och köpta står fast när rabatten sätts, ändras eller tas bort, och
  en avstängd kod ger ingen rabatt. Slutar familjen räknas de använda timmarna och minuterna till timpriset minus den
  (`vid_uppsagning_ore`, `intern.timbank_varde`). Lönen rörs inte. Den ändrar inget publikt pris. **Villkoren har en egen
  punkt** (`#familjerabatt`, version 2026-10-16, Leo: "fixa villkoren"): vad den gäller, att den gäller tills vidare, att vi
  kan ändra eller ta bort den och att det bokade och köpta behåller sitt pris, och Att sluta säger att timmarna och minuterna
  då räknas till ordinarie timpris med rabatten dragen; beloppet ser familjen vid priset. Auditen får att familjen fick eller blev av med en
  rabatt (`har_rabatt`), aldrig koden, som kan säga vilken partner familjen kom genom.
- **Egna upplägg** (2026-10-27, `egna_upplagg`, Leo: "admin säljer 6 h till familjen därför att det är lov och då
  skickar vi ett upplägg, villkoren är samma men det är bara 6h istället", och samma dag: "rabattkod gäller också för
  upplägg. Samma sak som vanliga planer bara annat antal timmar ... De köper och möjligheten försvinner, vill de ha eget
  upplägg igen måste vi skicka igen. Mejl ska gå ut när de fått möjlighet till eget upplägg"; i drift sedan 2026-10-27): admin
  skickar en familj ett upplägg i familjens panel (`skicka_eget_upplagg()`, `is_admin()`: ett namn, 1–40 timmar och
  1–60 dagar att köpa det), till planernas timpris (det rabatterade timpriset i `erbjudanden_pris`, 379 kr i dag, satt
  av databasen och fryst på upplägget; admin sätter inget eget pris). Familjen får ett mejl (notistypen `eget_upplagg`,
  avsnitt 5), ser det överst bland planerna och köper det en gång: när köpet är betalt är upplägget köpt och syns inte
  längre, och vill familjen ha ett till skickar vi ett nytt. Köpet är en plan (`klippkort` med erbjudandet `plan_eget`,
  sorten `plan` och `upplagg_id`), och allt som gäller en plan gäller det: 30 dagar från betalningen, timbanken,
  ordningen, påminnelsen, första timmen gratis om det är familjens första plan, familjerabatten, rabattkoden
  (`intern.klippkort_rabatt` räknar den på uppläggets pris, och `kod_pa_upplagget` svarar som `kod_pa_planen`), Köp till
  timmar, ångerrätten och Att sluta. Villkoren säger det (`#eget-upplagg`, version 2026-10-27, utan att nämna koderna).
  Katalogens rad `plan_eget` säljs aldrig (`erbjudanden_eget_saljs_inte`), ett upplägg står fast när det skickats (bara
  köpt eller tillbakadraget skrivs), och ett köp som betalas för ett upplägg som redan köpts eller dragits tillbaka blir
  en uppgift. Skriv i Gmail står kvar i panelen för ett eget ord.
- **Kortet reserveras** (av sedan 2026-10-21, `betala_nu`: familjen betalar med Betala nu; koden och tabellerna
  står kvar, och jobbet släpper det som ändå skulle stå reserverat och betalar tillbaka kortare pass. Historik:
  2026-10-13, i drift sedan 2026-10-14; Leo: "betala nu, eller på faktura. då reserveras pengar från stripe
  och när passet har hållits och läxhjälparen har skrivit rapport så dras pengarna"): valet är frivilligt, och kortet
  och reservationen står i egna tabeller, aldrig på `bookings` (`kortreservationer`, bara genom `valj_kort()` och
  tjänstekontot). Kortet sparas hos Stripe (`sparade_kort`; familjen ser märke, sista fyra och giltighetstid genom
  `mitt_kort()`), beloppet reserveras två dagar före ett bekräftat pass, dras efter rapporten och släpps när passet
  inte längre ska betalas med kortet. Stripe släpper en reservation vi gjort utan familjen efter 4 dygn och 18 timmar
  (Visa) eller 7 dagar, och gränsen läses ur Stripe (`capture_before`). En reservation som står skrivs aldrig om
  till nekad, bara webhooken skriver betalningen på passet, och raderingen väntar på kortet. Reservationen,
  dragningen och släppet gör `stripe-reservation` (jobbet `kortreservation`), som först frågar Stripe om passet
  redan har ett PaymentIntent: **inget dras två gånger**. Ett nej skriver bara den, och ett släpp rör bara radens
  egen reservation. Vyerna (2026-10-14) visar valet bara med strömbrytaren på, och då tar Välj kort platsen från
  Betala i förväg; med den av räknar vyn bara med en reservation som står, för jobbet reserverar och drar inget
  val då. Strömbrytaren `kortreservation` står på sedan 2026-10-14 (`minne/betalning.md`, Kortet reserveras vid
  bokningen).
  **Villkoren** (version 2026-10-15, `villkoren_kortet`) har en egen punkt (`#kortet`): valet ger oss rätt att
  reservera den bokade tiden och dra den hållna, aldrig mer än det reserverade, och den som väljer kortet har
  godkänt den gällande versionen (`kortreservationer_kraver_villkor`; bort går alltid). Texten gick ut några timmar
  före strömbrytaren (Leos beslut, PR #281); sedan kedjan i `DEPLOY-BETALNING.md` 9.14 kördes samma eftermiddag
  säger sidorna, villkoren, mejlen, agenterna och vyn samma sak, pass för pass (PR #283, Leo: "sajt ska säga samma
  sak som vyn, lektion per lektion"), och databasens version blev 2026-10-15.
- **Betalningsliggaren** (2026-10-21, `betalningsliggaren`, i drift sedan 2026-10-20; Leo: "raderas ALDRIG och ingår inte i
  något städjobb"): en rad per betalning i `betalningar`, skriven av databasen själv (AFTER-triggrar,
  `intern.betalningar_bokfor()`) när tjänstekontot sätter pengarna på passet, köpet eller tillägget, en rad per
  PaymentIntent, aldrig av en vy och aldrig för att någon kommer tillbaka från Stripe. Triggrar nekar delete och
  truncate för alla, bara det Stripe ändrar efteråt (återbetalt, läget, avgift) får ändras, ingen inloggad skriver,
  och en familj med en rad avidentifieras i stället för att raderas (`on delete restrict`). En betalning som inte
  kunde skrivas ner (två kassor) står där också (`betalning_utan_rad`). Liggaren och Kortet står under Betalningar.
  **En betalning döljs eller annulleras utan att röras** (2026-10-21, `betalningar_dolda`, Leo: "riktiga betalningar
  raderas inte utan markeras annullerad/dold"): en rad i `betalningar_dolda`, skriven bara av databasens ägare
  (`supabase/scripts/rensa-leo-testbetalning.sql`, som bara tar ett konto med en adminroll och märker en riktig betalning
  bara med `markera_riktiga => true`; tjänstekontot skriver inte heller där), som aldrig ändras eller tas bort. `test` (bara på en betalning med
  `skarp = false`) döljer den i Liggaren, under Dolda; `annullerad` märker en riktig betalning, som också döljs i
  standardvyn (Leo: "märkas annullerad och döljas i standardvyn") men står kvar i summorna tills den betalats tillbaka
  i Stripe. **Liggaren är kort** (samma dag, Leo: "Snyggare kortsektion i
  betalningsvyn"): ett kort per betalning med beloppet, läget som kantens färg, familjen, typen, koden, dagen och
  raderna betalningen betalade (`betalningsrader` när de finns), bara visning.
- **Återbetalningarna** (2026-10-27, `flera_pass_och_aterbetalningar`, Leo: "bygg en återbetalningsfunktion för oss i
  admin"; i drift sedan 2026-10-27): allt betalas tillbaka från Liggaren (passet, köpet, en rad i en betalning med flera,
  övertiden och en betalning utan rad), med beloppet ur databasen och en anledning, aldrig mer än det som är kvar.
  Varje återbetalning i Stripe, var den än gjordes, står i `aterbetalningar` (`aterbetalning_logga`, från
  `stripe-aterbetalning` och webhooken, med Stripes metadata som facit), med vem av oss, varför och var (`adminvyn`,
  `automatiskt`, `stripe`), och syns under Betalningar → Återbetalningar, där en i Stripes dashboard räknas för sig att
  stämma av. En rad raderas aldrig, och anledningen töms när familjen avidentifieras.
- **Köpvillkoren i kassan** (2026-10-21, i drift sedan 2026-10-20; texten sedan samma kväll, Leo: "fixa"): varje kassa
  föregås av en ruta med vad som köps, priset och kryssrutan för köpvillkoren (`NXStudie.kassansVillkor`, länken
  `CFG.KOPVILLKOR_URL`), och `stripe-checkout` nekar allt utom Ta bort kortet utan `villkor: true` och sparar krysset
  (`kopvillkor_godkannanden`, databasens tid och version). Anropet bär vad som köps, aldrig ett belopp. Köpvillkoren
  pekar på reglerna i resten av villkoren i stället för att säga dem igen, och punkten om ett nekat kort (två försök
  till, sex timmar emellan) ändras med `betalning_installning`.
- **Kortet försöker igen** (2026-10-21, `kortdragningen_forsoker_igen`, i drift sedan 2026-10-20): ett nekat kort provas igen
  efter sex timmar, högst tre försök, bara med en kod där ett nytt försök kan gå (`intern.kortet_provas_igen`, som
  också avgör om mejlet lovar ett försök: `kortet: 'igen'`), mejlas en gång per serie, och efter ett dygn blir det en
  uppgift till oss; admin försöker igen under Betalningar → Kortet. Passet avbokas aldrig för att kortet nekas.
  Inställningarna står i `betalning_installning`, och `sen_avbokning_timmar` är låst på 0 som `kortsparr`: den är
  kortreservationens, och den sena avbokningens gräns står i `avbokning_avgift_timmar`. Databasen väcker `stripe-reservation` direkt när ett pass har något att göra nu.
- **Syskontillägget som skuld** (2026-10-21, `syskontillagg_som_skuld`, strömbrytaren `syskonskuld` AV; Leo: "Tillägget
  blir en skuld på familjen när passet är hållet. Familjen kan betala skulden när hen vill under Betalningar, eller så
  läggs den som en egen rad i nästa betalning"): med strömbrytaren på väljer familjen vilka syskon som är med
  (`bookings.extra_barn`, `bokning_barn`), passet har `antal_barn = 1` (passets pris och timmarna är ett barns), och
  tillägget är en egen post (`tillagg_poster`, en per pass, beloppet fryst vid bokningen: tjänstens `extra_personer_ore`
  gånger minuterna, lika mycket med ett som med två syskon, aldrig ur anropet; `syskontillagget_fast`). Posten är `bokad`, blir `upplupen` när passet hålls,
  till hälften när familjen avbokar sent (Sen avbokning, ovan), och `frigjord` annars; bara triggrarna och
  databasens funktioner byter läge, och ingen klient skriver. Skulden betalas med Betala tillägg nu (`stripe-checkout`
  med `skuld: true`) eller som en egen rad i nästa köp av timmar (plan, Fyll timbanken, timmar till planen), aldrig i
  Betala nu för ett pass (varför: `minne/betalning.md`). En post står i högst ett öppet försök (`tillagg_forsok`,
  familjens lås och radlås), bara webhooken sätter den betald, och en rabattkod räknas aldrig på tillägget. Barnen,
  längden och antalet står fast efter bokningen, också för admin. Spärren (över `max_upplupet_ore` eller en post äldre
  än `sparr_efter_dagar`) stoppar extra barn i databasen, aldrig ett pass för ett barn. Gränserna och villkorens
  version står i `tillagg_installning` (2026-10-23 sedan `sen_avbokning`, med texten i villkoren, `#syskontillagg`, och
  talen där speglar tabellen), familjens ja i `tillagg_godkannanden`. **Strömbrytaren går inte på med utkastet**. Tre barn kostar 468 kr i timmen också med den på (Leo 2026-10-21: "Tre barn
  kostar 468 i timmen"): det som ändras är att tillägget betalas efter passet, och sidorna och villkoren säger det i
  samma ändring. Betalningens delar står i `betalningsrader`, som aldrig raderas.
  **Granskningen 2026-10-21**: en kassa åt gången (en äldre kassa för samma skuld går ut hos Stripe innan en ny öppnas,
  och har den redan betalats öppnas ingen: `forsoketsKassa`); ett försök som aldrig kan bli betalt (köpet betalt i en
  annan kassa, fel belopp, dubbelt) släpps; Klarna som väntar känns igen på försöket, inte på kassan, blir en uppgift
  efter en vecka och släpps av admin med en orsak (Släpp betalningen, `tillagg_forsok_slapp_admin`); ett hållet pass som
  avbokas medan posten står i en betalning blir en uppgift, och posten blir frigjord om betalningen släpps
  (`avbokad_fran`); familjen flyttar inte ett bekräftat pass med syskon inom gränsen för sen avbokning; ett barn som är
  syskon på ett kommande pass raderas inte (`syskon_kommande`), och godkännandet raderas med kontot. Tilläggen räknas
  på betalningsdagen i Betalningar, Månadens ekonomi och bokslutet (`manad_lage` → `syskon`).
- **Barnets chatt** (2026-10-06): barnet och studiehjälparen skriver i `barn_meddelanden`, bara
  genom funktionerna (`barn_chatt_skriv()`, `barnchatt_skriv()`, med tak); föräldern läser men
  skriver aldrig, och admin läser bara genom `barnchatt_las()` (loggat). Att föräldern och
  Nextrum kan läsa står i barnets och studiehjälparens ruta och i policyn och tas inte bort.
  Barnet får ingen notis om chatten, och studiehjälparens bär aldrig texten. Har föräldern stängt
  av tråden (`chatt`) skriver ingen av dem i den, men den går att läsa.
- **Barnets egen e-post** (`barnets_epost`, 2026-10-01; flaggan `barn_epost` står AV tills
  juristen läst): föräldern lägger till den, barnet bekräftar den med en knapp, och först då
  används den, till inloggning (`barn-inloggning`) och, om föräldern slår på det, till mejl om
  bokat, avbokat och påminnelse. Den står i `barn_epost`, aldrig i Auth, och ingen inloggad når
  tabellen. Föräldern styr adressen, mejlen och lösenordet; barnet väljer bara bort sorter.
  Ta bort och stäng av går alltid, också med flaggan av.
### Ordlistan (använd den, i kod och i text)
| Ord | Betyder |
|---|---|
| studiehjälpare | den som håller passet; aldrig "lärare" utåt; syns publikt först som Godkänd |
| pass | ett bokat tillfälle (`bookings`), hela timmar, 1–3 |
| rapport | `lesson_reports`; **passet är genomfört först när rapporten finns** |
| underlag | vad studiehjälparen ska få (`payouts`) |
| betalning | vad familjen betalat för ett pass (`betalning_status`, `betalt_ore`) |
| liggaren | `betalningar`: en rad per kortbetalning (pass, plan, Fyll timbanken, tillägg), skriven av databasen och aldrig raderad |
| tjänst | rad i `tjanster`; `aktiv` avgör vad som syns |
| uppgift | det eleven gör mellan passen (`homework`); i adminvyn att göra-listan |
| nivå | 5–12 frågor i en bana (`nivaer`); Mästarprov och repetition drar ur banan |
| NexLäx | studievyns sektion för banan (`nexlax`, `NXUppgifter`) |
| motförslag | en annan tid på samma pass (`motforslag_at`), ja eller nej; ett avslag är `cancelled` |
| XP | poäng ur svaren och försöken, aldrig sparade |
| tipskod | en familjs egen kod i intresseanmälan, eller en studiehjälpares i jobbansökan (`tipskoder`); en kampanjkod är en affischs |
| tipstimme | en timme på köpet för ett tips, i timbanken i 60 dagar: `startrabatt` och `rabattkod = 'TIPS'` på passet |
| värvningsbonus | 300 kr brutto, inklusive semesterersättning, till en studiehjälpare vars kod en kompis sökt jobb med, intjänad när kompisen fått sitt konto (`varvningsbonus`); underlag för lönen, aldrig en utbetalning och aldrig ett underlag. Hette tipsbonus (`tipsbonus`) till 2026-10-21 |
| timbanken | familjens köpta timmar (en plan, och Fyll timbanken som köptes före 2026-10-22), gratistimmar och sparade minuter; pass för pass går inte genom den |
| gratistimmar | timmar vi sätter in i familjens timbank utan kostnad (`klippkort` med erbjudandet `gratis`); 60 dagar, dras först med planens gratis timme. Inte första timmen eller tipstimmen |
| familjerabatt | kronor av per timme för en familj vi satt en av våra koder på (`familjerabatter`, `familjens_rabatt`); aldrig en rabattkod, och familjen ser aldrig koden, bara priset |
| rabattkod | en kod som ger en rabatt när familjen köper en plan, aldrig på ett pass (`rabattkoder`, `sort = 'rabatt'`) |
| partnerkod | en partnerförenings kod till en plan, med eller utan rabatt (`rabattkoder`, `sort = 'partner'`); den första sparas på familjen (`familjens_partner`) |
| Fyll timbanken | timmar köpta i förväg till timpriset, sex månader (`erbjudanden.sort = 'klippkort'`); säljs inte sedan 2026-10-22, men köpta gäller; utåt aldrig "klippkort" |
| timmar till planen | Köp till timmar: 1–20 timmar till en plan som gäller, till planens timpris, som går ut med planen (`klippkort` med erbjudandet `plan_extra` och `till_plan`; Välj själv under Er timbank) |
| barnkonto | barnets egen inloggning (`students.user_id`, `app_metadata.roll = 'barn'`, rollen `nextrum_barn`) |
| superadmin | admin med allt (`admin_roller.ar_superadmin`, `is_admin()`); andra admins har behörigheter (`har_behorighet()`) |
| syskontillägg | 69 kr i timmen för syskon på passet, lika mycket med ett som med två, som en skuld efter passet (`tillagg_poster`, typen `syskon` i liggaren), med `syskonskuld` på; aldrig övertid, som är `pass_tillagg` och typen `tillagg` |
| upplupet tillägg | familjens obetalda syskontillägg för hållna pass (`tillagg_skuld()`), som betalas med Betala tillägg nu eller i nästa köp av timmar |
| sen avbokning | familjen avbokar ett bokat pass mindre än 12 timmar före start: passet räknas som hållet i halva tiden, och familjen betalar hälften eller får halva tiden dragen ur timmarna (`sen_avbokning_minuter`, `sen_avbokning_ore`); aldrig "avbokningsavgift" utåt |
| Betala alla | flera bekräftade pass i en kassa, en rad per pass (`passkassor`, `passkassor_pass`); pass för pass är som förut |
| eget upplägg | en plan med ett annat antal timmar, till planernas timpris, som admin skickar till en familj och familjen köper en gång (`egna_upplagg`, köpet `plan_eget`): allt som gäller en plan gäller det, också koderna och Köp till timmar |
| återbetalningarna | `aterbetalningar`: en rad per återbetalning i Stripe, var den än gjordes, med vem av oss och varför; raderas aldrig |
### Siffror som måste stämma överallt
- **399 kr/tim** utan bindning (`PRIS_PER_TIMME` och läxhjälpens rad i `tjanster`, 2026-10-08), och
  det är priset, aldrig ett "från"-pris; **69 kr/tim** för fler barn, fast (tre barn: 468, inte 537), också
  med `syskonskuld` på (Leo 2026-10-21: "Tre barn kostar 468 i timmen", `syskontillagget_fast`): då betalas det som en
  skuld efter passet, och sidorna och villkoren säger det när den slås på (avsnitt 1). Priset står i `tjanster`
  (`extra_personer_ore`) och i `PRIS_SYSKON_TILLAGG_KR_PER_TIMME`, som hette `PRIS_EXTRA_BARN` till 2026-10-21.
  **Paketen** (planerna) kostar 379 kr i timmen, en månad i taget: 5 % av 399 nedåt till hel krona. De
  binder inte: villkoren säger ingen bindningstid och att det som är kvar betalas tillbaka, så sajten säger
  "en månad i taget" eller "obundet", aldrig "bindning" (Leo 2026-10-08; en riktig bindning kräver nya villkor).
  **Ingen av dem binder** (Leo 2026-10-09: "De är ingen bindning för man köper ett erbjudande som ska förbrukas på
  en månad"), så "utan bindning" ställs aldrig mot paketen: 399 kr är "pass för pass" där de står bredvid varandra.
  Plankorten på prissidan säger "N timmar per månad, obundet" och att timmarna betalas i förväg och fördelas på
  pass under månaden (Leo samma dag: "obundet för de betalas som förköp").
  **Timbanken** är familjens köpta timmar och sparade minuter, och den fylls med en plan; sedan 2026-10-13 visar den
  också timmar för tips, som inte köps och gäller i 60 dagar. **Fyll timbanken** (klippkorten `klipp10`–`klipp100` i
  databasen, timpriset och sex månader) **säljs inte sedan 2026-10-22** (Leo: "Det ska bara finnas tre köpbara planer:
  4, 8 och 12 timmar"): prissidan och studievyn visar bara planerna och rutan Eget upplägg (till kontaktformuläret på
  `/faq?amne=eget-upplagg#kontakt`, som börjar meddelandet med ämnet), och `stripe-checkout` nekar ett köp av en annan sort än en plan (`saljs()` och `SALJS_INTE` i
  `_delad/erbjudanden.ts`, 410). Katalogens rader står kvar och aktiva, för köpta kort pekar på dem, och strömbrytaren
  `erbjudanden` ska stå på: utan den betalar inga köpta timmar ett pass. Köpta timmar gäller till sin sista dag, syns i
  Er timbank och räknas ner som förut. Sedan 2026-10-13 sätter vi också in gratistimmar där (avsnitt 1). **Köp till timmar**
  (2026-10-14, Leo: "man kan köpa till timmar med plan men de går ut när månaden är slut ... välj själv knapp och
  checkout för de specifika timmarna"): med en plan som gäller minst en dag till, också ett eget upplägg, köper
  familjen 1–20 timmar åt
  gången under Er timbank, till planens eget timpris (379 kr i dag; `extra_timmar_erbjudande()` räknar, aldrig
  anropet), och de går ut samma dag som planen (`klippkort_betald`). De får ingen gratis timme, och påminnelsen
  tio dagar innan räknar dem med planen. Pass för pass går inte genom timbanken. Köpta timmar går ut, sparade minuter gör det inte: sidan
  och villkoren säger båda, så att namnet aldrig lovar att timmarna står kvar. Utåt heter det aldrig klippkort.
  Studievyns Betalning & planer (Erbjudanden gick upp i den 2026-10-27, och `#erbjudanden` leder dit) visar alltid Er timbank med de tillgängliga timmarna och hänvisar till Profil → Timbanken,
  där förklaringen och villkoren står (Leo samma kväll). **Batteriet** (2026-10-15, Leo: "som ett batteri bara att
  orange timmar är köpta och gratis är gröna ... 9 av 9 timmar finns kvar") står överst på båda ställena: en ruta per
  timme i det som gäller nu (köp som inte gått ut, med de använda tomma; planens gratis timme efter planen; timmarna för
  tips), gratis närmast de tomma för de dras först, "N av M timmar kvar", och en stapel över 24 timmar
  (`batteriTimmar`, `fyllBatteri`). Kortens mätare har samma färger. **En plan gäller 30 dagar från betalningen**
  (2026-10-21, `betala_nu`, Leo: planen köps "direkt och den används 30 dagar framåt"; samma dag hade en plan köpts för en
  kalendermånad, `planerna_per_manad`, och ingen hann köpa en): inget månadsval på plankortet, `intern.klippkort_manad`
  sätter ingen `galler_fran`, och `klippkort_betald` räknar 30 dagar (`PLANENS_DAGAR` i vyn och i
  `_delad/erbjudanden.ts`). Fyll timbanken, gratistimmarna, planens gratis timme och tipstimmen räknas som förut. Under
  batteriet står en rad per plan som gäller, "3 av 8 timmar återstår" och när den går ut (`planRader`). **Ett köp betalas tillbaka** under Liggaren, helt eller med ett antal timmar:
  databasen räknar beloppet (`klippkort_aterbetalning_lage`), och timmarna dras tillbaka, aldrig under det som
  använts (`klippkort_aterbetalningar`, en rad per återbetalning i Stripe).
- Betalningsmeningen står på 36 ställen i 23 filer och i mejlen, och `kolla-betalningsvillkor.py` räknar
  dem. **En betalning som tas på ett annat sätt än villkoren lovar är en tvist, inte ett skrivfel.**
  Fakturameningen, meningen om de obetalda passen och `BETALNINGSVILLKOR_DAGAR` gick med fakturan
  2026-10-21 och står bland det gamla: en sida som säger att familjen kan välja faktura lovar ett
  betalsätt som inte finns. Meningen är sedan 2026-10-21 "med kort eller Klarna så fort studiehjälparen har
  bekräftat tiden, och blir passet kortare än bokat betalar vi tillbaka mellanskillnaden"; kortet som reserveras
  och "när ni bekräftar rapporten" står bland det gamla. Slås `kortreservation` på igen ändras meningen, villkoren
  och kontrollen i samma ändring.
- **12 timmar och hälften** (sen avbokning, 2026-10-22): villkoren (`#avbokning`, Ångerrätt, Att sluta), FAQ:n, Så
  fungerar Nextrum, prisguiden (`bygg-omradessidor.py`), agentens fakta, vyerna (`NXBetalning.SEN_AVBOKNING`) och
  `betalning_installning` säger samma sak. Ändras gränsen eller andelen ändras alla, och villkoren får en ny version.
- **Den 25:e** lön för månadens rapporterade pass. Erbjudandenas priser står bara i
  `erbjudanden_pris`; prissidans kalkylator (2026-10-06, omgjord 2026-10-07) läser planpriset, namnet
  och märket ur planens kort (`data-erb-ore`) och räknar bara timpris och tillägg ur `CFG`; svaret är månadskostnaden och
  säger det, och den räknar aldrig på flera månader (2026-10-12, Leo: "ta bort månaderna"). Allt med
  `data-erb` (planerna, lyftet `.pr-lyft` med tejpen `.nx-tejp`, startsidans Just nu `#just-nu`) tar siffrorna ur samma svar från
  `initErbjudanden()` (`select=*`, hela dokumentet), och en kod som saknas i svaret döljs. **Planerna** (2026-10-07) är Basic (`plan_basic`, 4 timmar),
  Standard (`plan_standard`, 8) och Intensiv (`plan_intensiv`, 12), alla −5 % och en månad i taget sedan
  2026-10-08, då Standard förlorade "8 timmar för priset av 7";
  `standard` och `intensiv` står kvar avstängda, för ett köp pekar på dem. En timme på köpet i en plan är
  `timmar_pa_kopet`, aldrig en procent: priset är timpriset gånger de BETALDA timmarna, och ett kort med
  timmar på köpet visar aldrig ett timpris. Jämförelsen med andra aktörer (`data-erb-lagre`) avrundas till närmaste
  fem (Leo 2026-10-08: "upp till 40 %"; exakt är 3 032 mot 5 000 kr 39,4 %). **Kronortejpen** på varje plankort
  (`.nx-tejp-kort`, 2026-10-08) säger "upp till N kr mindre" (`data-erb-mindre`): skillnaden mot jämförelsepriset på
  tejpen (`data-erb-jamfor-ore`: Basic 3 540, Standard 5 832, Intensiv 8 348 kr; avsnitt 11) avrundad NEDÅT till
  hundratal, så att den aldrig lovar mer; tejpen har eget `data-erb` och döljs ensam vid fel timmar eller under 100 kr,
  och raden "Jämförelserna gjordes med en elev i årskurs 9 i oktober 2026" (`data-erb-jamfor-not`) står bara när en
  tejp syns. "Spara upp till N kr på 6 månader" (`data-erb-spara`) är skillnaden mellan ordinarie och planens pris
  gånger månaderna, båda ur svaret, för planen i `data-erb-spara-kod`, annars kortet raden står i, annars den största;
  med `data-erb-spara-forsta` räknas första timmen in en gång, till timpriset ur svaret, och texten säger det
  (2026-10-09, Leo: "skriv spara upp 1359 på 6 månader med standard planen", med utropstecken). Startsidans Just nu och
  prissidans rad är Standards (1 359 kr), och varje plankort har sin egen (879, 1 359, 1 839 kr). Märket på planerna och klippkorten, på prissidan och i studievyn, är
  timpriset utan bindning överstruket och det rabatterade bredvid, aldrig en procent (Leo 2026-10-08), och döljs när de
  är lika. Plankorten har ingen rad med timpris och "ni sparar" under priset (2026-10-12, Leo: "de ska bort"), varken
  på prissidan eller i studievyn, och kalkylatorn säger inget "Ni sparar" heller (Leo samma kväll). Priset fryses vid bokningen. **Första timmen gratis** (2026-10-09, Leo: "bara folk som köper planen ska få
  gratis första lektion", "MAXIMALT ... en timme gratis"): högst en per familj, någonsin, utom tipstimmar
  och gratistimmar (`intern.forsta_timmen_tagen`). Den första planen familjen betalar får en timme till (`klippkort.forsta_timmen`,
  `timmar` och `timmar_pa_kopet` ett steg upp, `intern.planens_forsta_timme` när den blir betald), **också
  med rabattkod**, och sedan ingen (2026-10-15, Leo: "har man en rabattkod får man ändå gratis timmen", "alltså den
  första"). Till dess står den som Erbjudande överst bland planerna under Betalning & planer (`#erb-forsta-box`; Leo: "det ska stå
  som erbjudande i deras erbjudanden"). **Pass för pass ges den inte** (samma dag, Leo: "det ska bara finnas ge gratis
  timmar till timbanken"): vill vi bjuda en familj sätter vi in gratistimmar. Valet (`forsta_timmen_beviljad`, `ge_forsta_timmen()`, då med Fas 19.5:s `startrabatt`)
  står kvar i databasen utan knapp, och villkorens "kan vi, om vi kommit överens" gick med versionen 2026-10-16. Studievyns
  `bjuden` speglar regeln ur `forsta_timmen_lage()`, och utan den gamla regeln. Tipstimmen är samma rabatt; ett pass på noll kronor är INTE betalt.
  **En gratis timme gäller i 60 dagar och dras först** (2026-10-13, Leo: "gratis timmar går ut efter 60 dagar att de
  läggs in", "gratis timmar går ut först sen planerna", "9h vid köp av 8"): planens gratis timme (`timmar_pa_kopet`) dras
  först och gäller efter planens månad så länge den inte använts, till 60 dagar efter köpet (`klippkort_saldo.gratis_kvar`
  och `gratis_till`, `intern.kortets_timmar`), och bland korten väljs först ett med gratis timmar, sedan det som går ut
  först (`intern.timmar_betala`, `klippkort_dra`, `kortFör`). Tipstimmen och första timmen pass för pass gäller ett pass
  inom 60 dagar (`intern.tipstimmar_kvar`, `beviljad_till`), och vyn bjuder bara för en dag inom dem. Återbetalningen
  räknas som förut: en använd timme kostar, också den gratis.
  Belopp i **ören**, kronor först vid visning.

Detaljer: `minne/affaren.md`, `minne/betalning.md`, `minne/timmar.md`, `minne/nexlax.md`.

## 2. Stacken
**Inget byggsteg, ingen pakethanterare, inget ramverk.** Filerna i roten serveras som de är, och
`supabase-js` är vendorad i `bibliotek/`. Vanilla JS i `<script src>`, moduler som IIFE:er på
`window` (`NX`, `NXStudie`, `NXArbete` och de andra `NX*`). Supabase (Postgres, RLS, Auth,
Storage) och Deno edge functions. Vercel med `cleanUrls: true`; botten ska inte kommentera
PR:er, och repository_dispatch ska stå på, för IndexNow lyssnar. Mejl genom Resend. Modeller
från Anthropic, bara i edge functions. Lokalt: `python3 .claude/serve.py 8951`.

Detaljer: `minne/grunden.md`.

## 3. Filkartan
- `nextrum-config.js` är enda filen som ändras vid uppsättning; `nextrum-fel.js` laddas före
  `nextrum-app.js` (`NX`) och rapporterar bara fel ur vår egen kod (2026-10-27: inte "Script error.",
  och inte det appar som Instagram kör på sidans rad 1, där varje sida har `<!doctype html>`); bildvägar står bara i `nextrum-images.js`, också vyernas bild per
  veckodag (`NEXTRUM_HERO_VECKA`; filmen bara på måndagen); `nextrum-samtycke.js` bara
  på öppna sidor. `nextrum-modulvakt.js` prövar en funktion per fil i alla fyra vyerna, moduler
  nås som identifierare (aldrig `window[...]`), och en ny `nextrum-admin-*.js` ska in där.
- Delat: `nextrum-studie.js` och syskonen; vyerna `-studie-vy`, `-larare-vy`, `-barn-vy` (bara NX,
  NXStudie, NXUppgifter och NXArbete för hälsningen) och `nextrum-admin.js`, med `-admin-karna.js` först och ett område per
  `-admin-*.js`; `-admin-behorighet.js` avgör vad en admin med behörigheter ser.
  `nextrum-introduktion.js` (`NXIntro`) är rundturen i studievyn och studiehjälparvyn, i den riktiga vyn sedan
  2026-10-27 (Leo: "live när man är inne i vyn första gången ... små rutor med två meningars beskrivningar ... går
  vidare genom att bara trycka var som helst"): den byter sektion med menyn, tonar ner allt utom ett hål runt
  sektionens början (`.nt-hal`) och låter en ruta med två meningar ploppa upp bredvid; inga skärmdumpar, och den
  körs när vyn är hämtad, före notisrutan. `nextrum-hemskarm.js` (`NXHemskarm`) är rutan och guiden
  för att lägga vyn på hemskärmen (krysset i `nx.hemskarm`, lagring.html), i båda vyerna.
  `nextrum-socialt.js` ritar Trustpilot och Instagram på startsidan, och `nextrum-start-scen.js` startsidans
  scener med GSAP (bentots ljus, manifestets ord och studievyns tippning, 2026-10-29). `nextrum-landning.js` och `-css` är
  landningssidornas rörelse (stegen, linjen, ämnets färg i `data-lp-amne`), skrivna in av `bygg-omradessidor.py`;
  flikarna (`data-lp-flikar`, Vad passen går ut på och Var passen hålls) och ljuset över korten fungerar också
  utan GSAP och med reducerad rörelse, och utan skriptet står flikarnas innehåll som lista och stycken.
- **Loggan** (2026-10-15, Leo: "implementera våran nya logga"): märket och ordet nextrum, spårade i vektor ur Leos
  bild, och källan är `bilder/nextrum-logga.svg`. Sidorna har dem som två inline-svg (`.mark`, `.logo-text`) i samma
  höjd (`--logga-h`); det bruna är `currentColor` (`--logga-brun`, kräm i mörkt läge och på mörka ytor) och det
  orange (#F88740) står i markupen. Byts loggan ändras vägarna på alla sidor (`var-ide.html` är områdessidornas
  skal), i maskoten och affischen, och `bygg-logga.js` körs.
- CSS: `nextrum.css`, `-home`, `-cinema`, `-vy`, `-arbetsyta`, `-agent`. **Cinema är
  sanningen**; `-vy`, `-agent` och `-typsnitt` har inga hexkoder. Papperet (`#F1EDE6` sedan 2026-10-08) tar
  `theme-color` med sig, men mejlens `FARG` ändras för sig. Adminpaletten laddas sist.
### Startsidan efter hero
De sex menysidorna (2026-10-06) laddar start och sist `nextrum-sidor.css` och använder startsidans
delar som de är; deras text följer inte med formen, och `.faq-item` är orörd (generatorerna läser den).
Hero är orörd med flit: film, etiketten Nextrum, rubrik och ingress (Leo, igen 2026-10-07). Det enda nya är raden
under knapparna med pris, första timmen, 24 timmar och bindningstid (2026-10-06). Startlägen gömmer inget utan `html.nx-sr`. Telefonens hero-film görs om
när originalet byts och provas som VP9. Mörka ytor glider in med `.nx-framme`, aldrig `.nx-in`.
**Ordningen efter heron** (2026-10-08, Leo): Hur hjälper vi ert barn, Just nu, Vår idé, studievyn, NexLäx,
Från intresseanmälan till första passet, studiehjälparna, bildväggen, omdömena (`#rost`), För dig
som vill jobba (`#bli`) och Nästa steg; Trygg hjälp gick upp i Hur hjälper vi 2026-10-29 (Leo: "Just nu är mycket bara
i kolumner och tråkiga", med React Bits som förebild, och "Du får göra allt"). **Läxhjälpssidorna står längst ner i footern** (`.ftr-lax`, 2026-10-13, Leo: "lägg in de längst ner vid de andra landingssidorna och gör de snyggt"): ämnena, stadierna och guiderna i var sin grupp med ämnesfärgens prick, och under Område navets regioner (Hela Stockholm, Innerstaden, Söderort, Västerort, Norr och väster om stan, Söder och öster om stan), Online och In English, på varje publik sida och båda språken, i stället för startsidans sektion Läxhjälp för just ert barn (2026-10-10 till 2026-10-13) och footerns gamla spalt Läxhjälp. **Orterna står i navets ortskatalog**, inte en och en i footern (2026-10-26, när stadsdelsområdena och kommunerna fick egna sidor: trettio länkar på varje sida, och trettiofyra efter sidrensningen 2026-10-27, hade varken varit snyggt eller sett ut som något annat än en doorway-lista); en ny ämnes-, stadie- eller guidesida läggs in i footern på alla sidor, en ny ort bara i generatorn, och `var-ide.html` är generatorns källa. **Hur hjälper vi ert barn** ("ert barn?" sedan 2026-10-09, Leo; `#sa-hjalper-vi`, avsnitt 17; på startsidan med etiketten
"Vad är Nextrum" och Leos ingress om prisvärd läxhjälp för elever sedan 2026-10-08, på Vår idé som förut): på startsidan
sedan 2026-10-29 ett bentorutnät (`.nx-bento`, avsnitt 19, efter React Bits MagicBento) med sju rutor, läxhjälpen stor med
fotot hemma hos familjen, expertisen, erfarenheten, matchningen och tryggheten (ur Trygg hjälps band), NexLäx och Allt på
ett ställe (ur manifestet) breda, var och en med ordningens färg i `--f`, och ett ljus som följer musen (`data-ljus`, bara
med mus); på Vår idé fyra blad i en rad som förut. Inget nytt påstående i rutorna: varje mening stod redan på sidan.
Erfarenheten är studiehjälparnas, aldrig ett antal år. **Betygsgarantin har ingen egen sektion**: den är en
platt remsa under bladen (`.hj-gar`, `id="betygsgaranti"`, 2026-10-08, Leo: "Gör betygsgarantin mindre"), med bara
meningen "Vi erbjuder betygsgarantin för att vi är säkra på våra metoder." över, de fyra stegen 01–04 (siffra och
rubrik) i en rad med streck emellan, varje steg under sitt blad (`.hj-gar-steg`, `data-gar-flode="tur"`, tänds i tur
när remsan syns), och "Villkor gäller." med villkorslänken under; samma remsa står på Vår idé. Det släckta läget
hänger på `.i-gang`, aldrig bara på `html.nx-sr`. **Just nu** (`#just-nu`, avsnitt 16) står direkt under Hur hjälper vi: "för" timpriset pass för pass (`data-stat`) med den lilla tejpen "Det är priset, inte ett
från-pris" (`.jn-fast`, 2026-10-09),
paketens timpris (Standards `data-erb-rabatterat`) med "spara upp till … med Xplanen" (`data-erb-spara`), och jämförelsen
Standard mot "Andra aktörer 5 000 kr+" (`data-erb-jamfor-ore` på figuren) med tejpen `.nx-tejp` över rutan och raden om att den bygger på priser för årskurs 9. Vårt
pris står aldrig i HTML, procenten avrundas till närmaste fem (40, exakt 39,4), figuren och tejpen döljs om planen inte har
8 timmar eller inte är minst 5 % billigare, och sektionen döljs om Standard saknas. **Prissidan har ingen
garantisektion** (2026-10-08, Leo: "öndödigt stor"): där står bara raden "Betygsgaranti, utan extra kostnad (villkor
gäller)" i 399-kortet, länken "Läs mer om betygsgarantin" under dess knapp (`.pr-gar-lank`, till villkoren) och
FAQ-svaret; det stora flödet (`.nx-gar`) är borta, och `garantiflöde()` sköter bara remsan. NexLäx (`#nexlax`, avsnitt
13, `nexlax()`): en telefon som visar sig själv i fyra skärmar och en stig som följer med, på papperet; en
illustration (`role="img"`), inget att svara i, högst tre varv och pausad utanför bild; varje skärm står lika
länge. **Ämnesfärgerna är den röda tråden** på startsidan och menysidorna (2026-10-08, avsnitt 18 i
nextrum-start.css), efter två regler: **ordningen** (i en rad blad eller steg får det n:te färg n, blå, lila, grön,
lera, rosa, och SO:s ockra som sjätte i bandet; `--f` sätts på ett ställe, och siffran, figuren eller etiketten
läser `var(--f, sin gamla färg)`, aldrig texten) och **ämnet** (studiehjälparnas ämnen, `data-amne`). **Gradienten**
(blå, lila, rosa) står bara i NexLäx rubrik (`.nlx-rubrik em`); andra rubrikers `<em>` (också "ert barn?", Just nus
slogan och Nästa steg) och citattecknen är orange eller vita som förut (Leo 2026-10-08: "när de inte gäller nexläx").
Garantin har leran; på bark byts färgerna mot `-l`; erbjudandena och Just nu har sina egna, och i vyerna står
de bara i NexLäx. **`#bli` står på mörka
lägets svarta** (`--bli-bg`, #1A1813) i båda lägena, med lera runt kolumnerna (`--bli-kant`), och Nästa steg
efter den börjar i samma svarta; Bli studiehjälpare-sidans sidhuvud och band (`.bli-svart`) står i samma svarta
med samma lera (2026-10-08). **Nästa steg i mörkt läge** står på sidans papper (`--pap`) på alla sidor, aldrig på
barken (cinema, DE MÖRKA YTORNA; efter `#bli` fortsätter dess sken över gränsen), och i ljust läge som förut.
**Footern** står i `--ftr-bg` (#1F1915) i båda lägena (2026-10-08), aldrig i barken.
Stegscenen (avsnitt 14, `stegFoton`) har två lägen ur
`html[data-motion]`, inte ur bredden: pinnad på `full`, en svepbar rad ovanpå fotot på `lite`; båda
kräver `.igang`, och grunden i cinema har alla steg öppna. Startsidans foton byggs ur registret
(`data-bild`), och alt-texten står på steget (`data-alt`). Manifestet har inga blad sedan 2026-10-29: rubriken,
Rätt matchs mening och knapparna, och orden blir skarpa i takt med scrollen (`data-scrollord`); manifestets och Nästa
stegs knapp har en kant där ett ljus glider (`.nx-stjarnkant`, StarBorder). Studievyns rubrik står i mitten, och fönstret
tippar upp med scrollen på dator (`data-tipp`). Studiehjälparna står i en rad
man sveper i, med märket Exempel kvar. Menyn bakom de tre strecken har inga pilar (2026-10-07).
Listorna 1–4 (`.nx-holdpunkter`, `.nx-apply-flow`) står två och två på telefon och har ingen fokuseffekt
(2026-10-08: `hållpunkter()` är borta, inget kort tonar ned grannarna), och `.sid-kort` är en lista under 861 px.
Studievyns och NexLäx markup kopieras till `for-elever-och-foraldrar.html`, NexLäx direkt under studievyn och
utan Se studievyn, och Hur hjälper vi till `var-ide.html` i stället för Bakgrunden, med NexLäx-länken till
`/for-elever-och-foraldrar#nexlax` (2026-10-08; `jamfor-sprak.py` ser bara första skillnaden). **Skriptet sätter klasser, CSS rör sig**: ingen stil per bildruta, ingen
animerad `box-shadow`, och en custom property sätts där den läses, för den ärvs. **Undantaget är landningssidorna**
(2026-10-28, Leo: "göra den lite roligare ... främst alla landings sidor", med GSAP): `nextrum-landning.js` låter
GSAP och ScrollTrigger (vendorade i `bibliotek/`, aldrig från en CDN) dra skenan i Så går det till, platserna som
en linje och korten, bara på de genererade `laxhjalp-*` och guiderna; stegen tänds ändå med en klass, och utan GSAP
eller med reducerad rörelse står allt färdigt i CSS. **Och startsidan** (2026-10-29): `nextrum-start-scen.js` låter GSAP
dra manifestets ord (opacitet och sudd) och studievyns `.sd-rum` (bara tier `full`), och ljuset skriver `--gx`, `--gy` och
`--gn` på den ruta det lyser på, registrerade utan arv (`@property`), så att en musrörelse aldrig räknar om det som står i
rutan. Utan skriptet står allt som `nextrum-start.js` lämnar det. Rubrikerna, `.rv` och parallaxen är kvar i `nextrum-motion.js`.
1. En `once`-scen är klar först när `run()` svarar annat än `false`.
2. `preserve-3d` i en rullbar behållare ger fel `elementFromPoint`.
3. `scrollIntoView` i en rad som flyttas med transform rullar sidan; bandet är `overflow:clip`,
   och kanterna tonas med gradienter, aldrig `mask-image` (Safari).
4. Det som fälls ut i bandet klipps.
5. En snäppande rad (2026-10-07): inträdet observerar RADEN, aldrig korten, raden har
   `overflow-y:hidden`, och den rullas bara med `scrollBy`/`scrollTo` på raden.
### Två fällor när en palett byts
Den dag någon sätter `--pap`, `--bl` eller `--acc` på en vy: (1) en alias-token på `:root`
fryser rotens värde, så hela mängden aliaser upprepas; (2) mörkerreglerna väger (0,4,0).
`--acc-lugn` är hovringens accent, ingen felfärg.
### Fyra fällor som gör vyerna hackiga
Safari har ingen scroll anchoring: prova som en telefon. Tryck och hovring rör sig med `scale`,
aldrig `transform`, `translate` eller ändrad storlek; `[aria-pressed]` animeras inte; iPhones
`:active` kräver touch-lyssnaren i `nextrum-studie.js`; `aria-busy` stoppar bara musen, så
knappen stängs med `NXStudie.medan()`.
1. **Byt aldrig en lista som har innehåll mot "Hämtar"**: `NXStudie.laddarFörsta`, `håll` och
   `hållLista` (ankaret är chipraden); visa det nya innan det gamla går.
2. **`1fr` är `minmax(auto,1fr)`**: skriv `minmax(0,1fr)`.
3. **Det som rör sig kostar**: ingen video under 700 px, inget `backdrop-filter` på sidhuvudet,
   ingen mjuk scrollning i vyerna.
4. **Det som står ovanför det man trycker på får inte byta höjd**: reservera höjden och håll det
   tryckta med `stilla()` och `NXStudie.håll`.
### Innehållet i studievyn och studiehjälparvyn
Lägets färg säger vems drag det är: lera ert drag eller fel, ockra väntar, mossa klart (tokens i
cinemas `:root` och båda mörka blocken); som serier skiljs de inte åt av färgblinda, och
ämnesfärgerna finns bara i NexLäx. Orange (`--orange`) är inget läge: den bär bara knapparna
som betalar: Betala nu, Betala med timmar och Köp under Betalning & planer (2026-10-21, Leo: "Alla betala knappar ska vara
oranga"; valen i `.vy-betalval` med `ar-orange`),
och köpta timmar i timbankens batteri och mätare, där gratis timmar är mossa (2026-10-15, Leo). Ett drag överst, en knapp per listrad, tid och plats genom
`NXKontakt.passRad`, betalvalen i `.vy-betalval`. **Datumrutan** på ett pass bär betalningen (2026-10-27, Leo):
röd att betala, grön betalt, gul en tid som väntar på svar (`dagTon()`, `--dag-*` i cinema), och ett förslag från
studiehjälparen eller barnet har en prick och sitt namn ("Sara föreslår"), familjens eget "Ni önskade". Adminvyns månadsväljare är ett fält med en
ruta för år och månad (2026-10-06), från september 2026 till och med december nästa år; märket
står i fältet och i rutan, och Lektioner räknar upp andra månader utan rapport under det.
**Tummen**: tryckytor minst 44 px, och `::after` provas med `elementFromPoint`. Ett fält har
minst 16 px text (`.inp,.sel` är 1rem), annars zoomar en iPhone in sidan vid tryck. **På en
telefon** flyttar ett tryck i sektionsraden aldrig raden (2026-10-12, Leo: "ska skärmen inte
automatiskt hoppa ner"): högst upp står sidan still, och står raden fast långt ned läggs sektionen
vid sin början under den (`sidomeny`, `början()`). Den valda posten är en pill som glider
(`läggPil`, `.vy-sido-pil`), med samma vikt på alla poster. Vyns delar står i menyn bakom de tre
strecken (`mobilmeny`), och Enter är en ny rad i chatten.
**Notiserna vid inloggningen** (2026-10-12): det som väntar på en står i en ruta när vyn öppnas
(`NXStudie.notisruta`), med samma poster som klockan i sidhuvudet (`notisposter()` i båda vyerna),
och väntar inget kommer ingen ruta. En gång per inloggning (`sessionStorage`, som `loggaUt()` och
vakten tömmer), aldrig på väg tillbaka från kassan, och inte i barnets vy. Den går inte att stänga
av: inget val under Profil → Notiser. Stäng och Escape stänger rutan, ett tryck utanför gör det inte.
### Adminvyns skal
Samma hus som de andra vyerna: KÄNSLAN och INNEHÅLLET står på `.vy` och adminvyn har inga egna
ytor; ändras de andra vyerna oväntat är specificiteten första stället. Menyn är en egen rullyta
som `sidomeny()` drar, aldrig sidan, och en lång etikett får bryta; `täcktÖverst()` räknar
toppraden. `.btn-sm` är liten bara som `.vy-admin main .btn-sm`; Att göra är bara vårt drag.
**Att göra sak för sak** (2026-10-26, Leo: "nex visar 3 saker att göra, jag ser bara två"): ringen räknar
saker och listan poster, så ringens tal och Att göra leder till `#attgora`, en rad per sak (Översikt står
vald, bara superadmin). Varje post i `byggAttGöra` och `byggProblem` bär sina `saker` ur samma urval som
antalet, och en ny post får dem i samma ändring. **Talen går att trycka på** (2026-10-29, Leo: "jag vill kunna
klicka på allt för att få upp mer info om det"): ett tal, en stapel eller ett trattsteg med `data-urval` öppnar en ruta
med raderna det är räknat ur (`NXAdmin.urval[nyckel]`, öppnad av `nextrum-admin-konsol.js` med Att görs `sakRad`), och
raden öppnar sin panel. Raderna räknas ur samma urval som talet, i samma fil (Statistikens följer analysvyerna); ett nytt
tal i Översikt eller Statistik får sitt urval i samma ändring. Listorna i de andra sektionerna öppnar redan panelen. En knapp som
databasen bara släpper fram för en superadmin eller en behörighet ritas efter `ärSuperadmin()` eller `får(kod)`
(2026-10-15), och `skriv()` säger Ingenting sparades när en uppdatering inte träffade något. Siffran vid
Intresseanmälningar och Ansökningar är det DU inte sett (`admin_sett`, 2026-10-05), och att visa
sektionen är att se den; utan tabellen räknas läget Ny som förut. Ett läge sätts med märkena
(`lägesväljare()`, 2026-10-06), aldrig en rullgardin: gruppen skickar `change` som en `<select>`, så
lyssnarna är desamma, och ett nej på frågan före bytet sätter `value` tillbaka. En dag ur en tidsstämpel är
Stockholms (`sthlmDag` i kärnan, som `kortDatum` går genom), aldrig `slice(0, 10)` av UTC (granskningen 2026-10-21).
**Ansökningarnas steg** (2026-10-21, `ansokningarnas_steg`, Leo: "Lägen: Ny, Intervju, Utbildning, Konto skapat. En
ansökan finns i exakt ett läge åt gången"): `applications.steg` är genererad ur det ansökan bär (`intern.ansokan_steg`:
`konto_id` eller läget Godkänd, intervjun hållen, `till_intervju_at`), och `intern.ansokan_steg_vakt` släpper bara Ny till
Intervju, tillbaka till Ny (Ångra intervju), Intervju till Utbildning och Utbildning till Konto skapat, det sista bara genom
`ansokan_utbildning_hallen()`, för admin också; en ny ansökan börjar i Ny, och medan den är Avböjd står stegets kolumner
still (granskningen 2026-10-21). Avböjd är inget steg utan ett beslut: egen flik, och det går i varje steg.
Flikarna är Nya ansökningar (bara Ny), Intervju, Utbildning, Konto skapat och Avböjda, med antal. Panelen börjar med steget
och dess knappar (`nästaSteg`): Intervju har tre, Skicka intervjulänk igen (`ansokan_intervjulank_igen()`, notiskön, högst
en gång i tio minuter), Ångra intervju och Gå vidare till utbildning. **Utbildning hållen** är det som var Ta in i poolen:
`bjud-in` skapar kontot med ansökans adress, och funktionen kopplar det (`konto_id`, unikt åt båda hållen), godkänner
profilen och sätter utbildad och Godkänd i en transaktion; samma konto igen gör ingenting. Fliken Rekryteringen, läget
Kontaktad som val, Boka digitalt möte, Skicka utbildningen och Markera utbildad är borta. Varje steg står i
`ansokan_steg_logg`, som aldrig ändras och går med ansökan (utom att `andrad_av` blir null när den personen raderas). Skriv till hen står vid adressen och flyttar ingen.
**Papperskorgen** (2026-10-26, `papperskorgen`, Leo: "radera uppgifter från det stället ... så finns personen kvar i
vårt system och i familj"): en ikon sist på varje rad under Intresseanmälningar och i varje flik under Ansökningar,
bara för superadmin (`papperskorg()` i kärnan, `o.bort` i `namnlista()`), som tar bort den raden och inget annat
(`ta_bort_ur_stallet()`): en anmälan avidentifieras, en ansökan tas bort med CV:t först. Rutan (`visaPapperskorg`)
säger ur `stalle_lage()` var personen står kvar; är raden det sista stället heter den "Ta bort X helt?" med Avbryt och
Gå vidare, och databasen kräver det svaret (`p_helt`). Den frågar också när personen står kvar, för ett CV går inte
att få tillbaka. Radera i panelen är vägen när personen ska bort med allt från samma adress.
**Intervjun bokas på en bokningssida** (2026-10-20, Leo: "så att jag bara kan skicka ut länk"): ett bokningsschema i
Google Kalender för info@, aldrig ett privat Gmail (`INTERVJU_BOKNINGSLANK`, som hette `INTERVJU_BOKNING_URL` till
2026-10-21, och hur det skapas står överst i nextrum-config.js; ingen OAuth: det är en länk). Länken står i intervjumejlet; Google mejlar tiden och Meet-länken, och vyn läser aldrig kalendern.
Policyn lovar att bokningen tas bort för hand senast ett år efter intervjun.
**Mejl från adminvyn skrivs i Gmail** (2026-10-11, Leo: "alltid ... i gmail och inte mail"):
`gmailLänk()` och `gmailAdress()` i kärnan, en ny flik, aldrig `mailto:` (som öppnar Mail på en Mac).
Familjernas och studiehjälparnas sidor behåller `mailto:`. **Till den som sökt jobb skickas mejlet härifrån** (2026-10-20,
Leo: "jag ska kunna redigera mailet och sen bara tryck skicka"): Skriv till hen och Skicka utbildningen har Skicka, och
`ansokan-mejl` skickar från info@ med adressen ur ansökan (aldrig ur anropet), en hemlig kopia till info@ och en nyckel per
ruta; texten sparas inte. Gmail står kvar bredvid som reserv.
**Förhandsvisningen** (2026-10-12, Leo: "föreslå tid och byta vy och acceptera"): sektionen
Förhandsvisning (för varje admin) öppnar `/foralder?forhandsvisning` och `/larare?forhandsvisning`, de
riktiga vyerna med en påhittad familj och studiehjälpare. `nextrum-forhandsvisning.js` laddas före
`nextrum-app.js` och ger vyn en klient som svarar ur en värld i webbläsaren; de två vyerna delar den
(`localStorage`), och remsan överst byter vy. Den når aldrig databasen, så inget av det räknas i
statistik, lön eller betalningar. **Två saker frågar ut** (2026-10-27, Leo): Betala nu, Betala alla och
planerna öppnar Stripes kassa i TESTLÄGE (`forhandsvisning-kassa`, bara superadmin, ingen kassa med en
skarp nyckel, beloppet ur världen, och webhooken skriver inget för `forhandsvisning=1`), och NexLäx spelar
den riktiga banan (`forhandsvisning_niva()`, `forhandsvisning_ratta()` och, för repetitionen, `forhandsvisning_repetition()`
med webbläsarens missade frågor, inget sparat; stjärnorna räknas i webbläsaren med niva_svaras gränser, som
`kolla-forhandsvisning.py` jämför); båda med adminens
inloggning. Går Stripe skarpt sätts `STRIPE_FORHANDSVISNING_SECRET_KEY` och `_PUBLISHABLE_KEY` till
testnycklarna (`minne/sakerhet.md`). Börjar vyerna fråga efter en ny tabell eller funktion ska den in i
världen (`prova-forhandsvisning.js` säger vad som saknas). **Adminkontona räknas inte i
statistiken** (samma dag): Översiktens tal (`räknas()`, `ärAdminkonto()`) och analysvyerna
(`intern.utanfor_statistiken`) räknar inga pass där familjen eller studiehjälparen har en adminroll;
listorna, betalningarna och lönerna som förut.
Fällor: `h5` och `h6` har webbläsarens marginal; `--pap-2` och `--yta` är nästan samma i mörkt
läge (`--tint`, `--bricka`); KÄNSLAN står sist och väger lika mycket; `nextrum-admin-konsol.css`
vinner över arbetsytan. Headless Chromium döljer rullningslister; mät ett tryck med `el.click()`
i sidan och `getBoundingClientRect`.
### Tusen rader
PostgREST lämnar ut högst tusen rader utan att säga det. **En lista som växer hämtas med
`NXStudie.hämtaAlla`** (adminvyn: `hämtaAlla`): sida efter sida tills `count`, sorterad på en
unik nyckel; ett fel ger felet, aldrig en halv lista. En `.limit()` över tusen är tusen.

Detaljer: `minne/grunden.md` (filkartan), `minne/vyerna.md`.

## 4. Språk
**Koden är svensk**: identifierare, kommentarer, commits, filnamn, kolumner. `/en/` är genererad
ur de svenska sidorna, textnod för textnod. Undantaget är `en/tutoring-stockholm` (2026-10-07),
sidan för utlandsfamiljer, som bara finns på engelska och lovar pass på engelska bara när vi har rätt person.
1. Generatorn översätter aldrig `<script>`: text från JavaScript ligger som par i `ORD`
   (`NX.t()`, `ord()`), med språket ur `<html lang>`.
2. Det som skrivs till databasen förblir svenska.
3. Generatorn finns inte i repot: engelskan följer med för hand, och `jamfor-sprak.py` vaktar.
4. Baslinjen har bara avsiktliga avvikelser; allt nytt är ett fel.

Detaljer: `minne/grunden.md`.

## 5. Databasen
**Sanningen om vad som är kört står i databasen** (projekt-ref `ddkfiuvcppalutfulvbi`):
`select version, name from supabase_migrations.schema_migrations order by version;`
- Ny SQL: `supabase/migrations/<version>_<namn>.sql` med den version `apply_migration`
  registrerade (`kolla-migrationer.py`). **Klistra aldrig in SQL i SQL Editor utan att den blir
  en fil.** Migrationen körs efter merge, och vyerna tål att den saknas.
- **Verktygen som ändrar driften ber om en bekräftelse** för `drop`, för en `delete` utanför en funktion
  och för en funktion med två `delete` (2026-10-13 också för en med ett `delete` och två `update`,
  `ta_tillbaka_gratistimmar`), och hänger sig i 60 sekunder om ingen svarar: inget har hänt, och
  `apply_migration` gör likadant. Rutan syns inte i alla klienter (den syntes aldrig i Leos app, fem gånger 2026-10-13 och 14).
  Skriv migrationer utan dem (en kontroll i stället för `drop policy`, en rensning per funktion, en
  tidsstämpel i stället för `delete`, som `klippkort.aterkallad_at` 2026-10-14), kör dem avsnitt för avsnitt med
  `execute_sql` och registrera filens text sedan i
  `supabase_migrations.schema_migrations` (`minne/databasen.md`). Runda aldrig spärren med dynamisk SQL
  (det gjordes två gånger 2026-10-20, båda med Leos uttryckliga ja: PR #307:s åtta sista migrationer, avsnitt 11,
  och rensningen av testkontot, `minne/databasen.md`),
  och prova den aldrig med objekt som blir kvar i driften (`zz_prov_*` från 2026-10-02 står kvar och väntar
  på ett ja, avsnitt 11).
- `arkiv/` ändras aldrig; en rättelse är en ny migration. `schema-v22.sql` kördes aldrig, kör
  den inte. `schema.sql` rensar tabellerna.
- **Flera sessioner** kör mot samma databas: läs driften, inte grenen. Lappa en funktion med
  `replace()` på `pg_get_functiondef()` och en vakt som räknar träffarna; läs vyns kolumner i
  driften före `create or replace view`. **En driftsättning har EN session** (2026-10-13 körde tre
  samma kedja samtidigt och fick veta det först efteråt): fråga de andra sessionerna innan du börjar
  (`minne/databasen.md`).
- **Auditloggen** går inte att ändra, inte ens för admin, och loggar bara vitlistade kolumner,
  aldrig namn eller fritext; en läsning den berörda inte märker loggas av funktionen som läser.
  Sök med `audit_sok()`; AI-märkningen läses inte ur `aktor_typ`.
- **Triggrar på samma händelse körs i namnordning.** En `UPDATE OF`-trigger ser bara kolumnerna
  i själva UPDATE:n, inte dem en BEFORE-trigger ändrar.
- **Ring aldrig `net.http_post` direkt**, bara `intern.natanrop(mal, …)`. Schemat `intern` är
  databasens egna funktioner, inget API.
- En tjänst får inte vara aktiv och oklar (`skydda_tjansteaktivering`); avstängning släpps
  alltid igenom; spegeln i `nextrum-admin-tjanster.js` följer triggern.
- `kortsparr` kan inte slås på; går villkoren tillbaka till betalning före passet tas villkoret
  bort i samma migration som texterna.
- Biblioteket är kurerat: `delad` slås inte på nerifrån, en länk är http(s), `bibliotek_id`
  pekar och kopierar inte, och `NX.ARSKURSER` speglar villkoret. Material når familjen bara
  genom en läxa, och `materials` (vårt eget underlag) städas inte bort.
- Maskiners uppgifter går genom `skapa_uppgift()` med nyckel; kontrollerna är med flit inte
  schemalagda, och schemaläggs de ska texterna säga det. Analysvyerna: genomfört är
  `har_rapport`, varje rad bär `underlag_rader`, och luckor redovisas i stället för att fyllas.
- Ett schema som står av ser ut som ett som fungerar: jobben syns under System → Automationer,
  utan sina kommandon. Flyttas `manadskorning` flyttas `manadskorning-svar` med.
- **Syskontillägget** (2026-10-21): `tillagg_poster`, `tillagg_forsok`, `tillagg_forsok_poster` och `betalningsrader`
  raderas aldrig (triggrar mot delete och truncate, också för ägaren), och en post byter bara läge längs de tillåtna
  övergångarna (`tillagg_poster_vakt`). Varje betalning får en rad i `betalningsrader` vid commit om ingen skrev en
  (`betalningar_rader`, en deferred constraint trigger). Jobben `tillagg-forsok` (var 15:e minut, släpper ett försök
  efter 35 minuter, och gör en uppgift av ett som väntat på Klarna i en vecka) och `tillagg-paminnelse` (en gång om
  dagen, dagarna räknade i Stockholms tid). Ett försök släpps av kassan, webhooken, jobbet eller admin med en orsak, och
  posterna i det blir upplupna igen genom `intern.tillagg_poster_tillbaka`, utom ett hållet pass som avbokats.
  `service_role` skriver inte direkt i tilläggets tabeller, `timmar_insatta`, `ansokan_steg_logg`, `betalningar_dolda`,
  `varvningsbonus`, `passkassor`, `passkassor_pass`, `aterbetalningar` eller `egna_upplagg` (de fyra sista sedan
  2026-10-27): edge-funktionerna läser och skriver genom databasens funktioner (granskningen 2026-10-21).
- **Värvningsbonusen** (2026-10-21): `varvningsbonus` raderas aldrig (triggrar mot delete och truncate), lägena går
  bara framåt (`intern.varvningsbonus_vakt`, och sedan 2026-10-28 via `att_godkanna`), och bara databasen skriver: raden när ansökan kommer in
  (`applications_varvning`), intjänandet (`intern.varvning_prova`, från triggrarna på `tutor_profiles`,
  `applications.konto_id`, `prov_studiehjalpare` och `lesson_reports`, och för alla väntande när händelsen i
  `varvning_installning` byts) och admins två funktioner. En rad skapas bara som `vantar` eller `annullerad`
  (`varvningsbonus_ny`), och unikheten gäller bara levande rader (en per ansökan och konto som inte är annullerad, en
  intjänad eller utbetald per person). Personen räknas som en HMAC av adressen (`intern.varvning_epost_nyckel`: gemener,
  utan +tagg, och Gmail utan punkter) med `notis_konfig.barn_nyckel`: byts nyckeln räknas en tidigare värvad som ny.
- **Gallringen**: lagringstiderna hålls av databasen (`DATASKYDD.md` är registret). Anmälningar
  avidentifieras, konton raderas aldrig av sig själva, ett jobb som fastnat blir en uppgift, och
  `landningssida` bär bara våra utm-taggar. Ett nytt rekryteringssteg med tidsstämpel ska in i
  `intern.ansokan_gallras_fran()`.
- **Adminrollerna**: sanningen är `admin_roller`, och `profiles.is_admin` speglar superadmin.
  `is_admin()` är superadmin och `har_behorighet()` resten; en ny adminpolicy väljer en av dem.
  Reglerna står i triggern `admin_roller_vakt`, och `admin_logg` går inte att ändra.
- **Barnets roll** `nextrum_barn` har inga tabellrättigheter; en ny tabell eller vy ger den
  ingenting, och en ny barnfunktion hittar barnet med `intern.mitt_barn()`, eller med
  `intern.mitt_aktiva_barn()` när en pausad inloggning inte ska kunna göra den, och i NexLäx med
  `intern.mitt_nexlax_barn()`. En ny behörighet för barnet går in i `intern.barn_behorigheter_alla()`,
  villkoret, förvalet och båda vyerna samtidigt (`kolla-behorigheter.py`). **GoTrue skriver
  raden i `auth.users` före `app_metadata`**: ett barnkonto skapas bara genom ett fönster som
  `barn-konto` öppnar för kontots eget id, och lösenordet byts bara i ett fönster
  (`barn_andringsfonster`). Databasen skriver tillbaka barnets `app_metadata`, spärrar adress
  och återställning, och håller `*_sent_at` år 2999 så att Auth aldrig mejlar ett barn. Prova
  i GoTrues ordning, aldrig med raden färdig i en INSERT.
- **Rätta och radera en person** i adminvyns panel (`radera_person()`), **aldrig i
  dashboarden**: `bookings.parent_id` är ON DELETE CASCADE. Databasen väljer helt eller
  avidentifierat och vägrar medan pengar inte är uppgjorda eller filer finns kvar. Ett
  adminkonto raderas inte där, och e-posten ändras inte i Redigera (profiles följer inte Auth).
- **Testkontot Leo Trikke rensas med `supabase/scripts/rensa-testkonto.sql`** (2026-10-21), i SQL
  Editor och aldrig i dashboarden: `dry_run` är förvalet och listar varje rad som skulle gå (pass,
  rapporter, timmar, underlag och, så länge tabellerna finns, fakturor), kontot står kvar, allt sker
  i en transaktion, och en skarp betalning eller ett utbetalt underlag stoppar den. Skriptet är ingen
  migration och registreras inte. **Det tar familjens namn** (2026-10-20): i driften är familjen med
  passen Leos adminkonto `leo thriskos` och Leo Trikke studiehjälparen, och ett konto som inte är en
  familj nekas (med Leo Trikke hade skriptet raderat ingenting). **Körd i driften 2026-10-20** (Leo:
  "nollställ statistiken"): 16 pass, 6 rapporter, septembers underlag och testköpet är borta, liggarens
  rad står kvar som test, och septembers bokslut är stängt igen med nollor (`minne/databasen.md`).
### Notiserna
- Trigger → `intern.notis_skapa()` → `intern.notis_koa()` → `notis-minut` → `notis-ko` → Resend.
  `notiser_mejl` är strömbrytaren (av och trasigt ser likadana ut); `loggad` är slutläge.
- Ingen får en notis om sin egen åtgärd. Mallarna ser bara `RenData`, varje namn och ämne går
  genom `fornamn()`, och `rapport` mejlas aldrig. Typlistorna i databasen och i `typer.ts`
  ändras tillsammans, och en ny typ går ut med både `notis-ko` och `notis-avanmal`: avanmälan prövar
  tokenens typ mot listan och svarar annars 403 (2026-10-21). En saknad rad i `notis_val` betyder PÅ, avanmälan skriver bara där, och
  länken i mejlet kan aldrig slå på något och har med flit ingen utgångstid.
- Barnkontots tekniska adress får aldrig ett mejl: `notis_utskick_ta` och `notis-ko` hoppar
  över `@barn.nextrum.se`, och barnets notiser står i `barn_notiser`. Ett barns egen bekräftade
  adress får mejl bara som en rad med `barn_id` (aldrig `mottagare`), som `notis_utskick_ta`
  prövar igen när den ska gå; barnets mallar (`barn.ts`) har aldrig pris, betalning eller skäl,
  bekräftelsen hälsar inte med namn och har ingen avanmälan, och barnets avanmälningstoken har
  fem delar, så den aldrig kan läsas som en vuxens.
- **Mejl till admin** (2026-10-02, i drift samma dag): en intresseanmälan mejlas direkt, en gång, av `lead-notis`; en jobbansökan
  direkt, en gång, av triggern `admin_ansokan_direkt` (ingen uppgift om vem som sökt, och högst fem på tio
  minuter). **Resten av Att göra går i ETT mejl kl. 9 svensk tid**: pg_cron `admin-paminnelse` (var femte minut)
  → `intern.admin_paminnelse_koa()` → `admin-paminnelse` → Resend. Klockan avgörs i funktionen
  (`Europe/Stockholm`, bara timmen 9), aldrig i schemat, som går i UTC. Varje sak mejlas EN gång, aldrig en
  intresseanmälan eller en ansökan (de mejlas direkt), aldrig namn eller text, och inget mejl en dag utan något nytt.
  Till superadmins och `info@`. Listan står både i `byggAttGöra` och i `intern.admin_att_gora()` och ändras
  tillsammans; rapporten som familjen inte bekräftat och uppgifter systemet lagt finns bara i databasen. Morgonmejlet
  slås av genom att jobbet stängs av med `cron.alter_job` (syns under System → Automationer); det direkta
  följer triggern, inte jobbet.
- **Signaturen i mejlen** (2026-10-28, Leo: "den följer med i alla de där mailen"): sist i varje mejl som går
  genom `renderaRam()` (notiserna, kvittot, mejlen till den som sökt, barnets och kontomejlen), före footern:
  loggan, Nextrum, sloganen "Av unga, för unga." (Leos ord; den står inte på sajten), nextrum.se, Instagram
  (`instagram.com/nextrum.se`), `info@` och bolagets rad med orgnumret (`signaturHtml()`, `SIGNATUR_TEXT` i
  `rendera.ts`; ändras de ändras sajtens footer med). Inga ikonbilder, loggan är den enda bilden (nu två gånger).
  **Ingen signatur** i mejlen till oss (`utanSignatur: true`, `admin.ts`) och i det som inte går genom
  `renderaRam()`: Leos intervjumejl och admins egna brev (adminvyn visar texten innan den går, och HTML kan inte
  säga något annat än den), underlaget, nyhetsbrevet och aviseringen om en anmälan; de har `skal()` utan `signatur`.
- **Sätt sandlådan innan du provar något som köar.** Ett gammalt anrop utan pg_net-svar är inget
  fel. Mejlens papper står på `body` och som `bgcolor`; loggans `.gitignore`-undantag står kvar.
- Till den som söker: bara kvittot och vårdnadshavarens mejl styrs av en INSERT, med samma broms;
  möteslänken är https, ett steg mejlas en gång, och Godkänd sätts bara av Utbildning hållen (2026-10-21).
  Avböjd mejlar ett nej (2026-10-05) men inte genast: tidigast en halvtimme senare, aldrig 20–9,
  och inte om läget hunnit bytas. Avböjd visar mejlet först, och texten står i mallen och i
  adminvyn (`kolla-mejltexter.py`).
  Provet i ansökan och dess tre mejl är borta (2026-10-21): utbildningsmötet mejlar inget, och Markera
  utbildad mejlar sista steget, en gång och efter en fråga.
  Intervjumejlet (2026-10-21) är det enda till den som söker som går genom notiskön: en rad med
  `ansokan_id` (villkoret `notis_utskick_en_mottagare` kräver exakt en av `mottagare`, `barn_id` och
  `ansokan_id`), som `notis_utskick_ta` prövar igen när den ska gå (ansökan står kvar i steget Intervju
  och är inte avböjd, sedan 2026-10-21 också med `steg`), och `notis-ko` mejlar den från info@
  (`intervju.ts`). Skicka intervjulänk igen köar samma mejl med en egen nyckel (`ansokan_intervju:<id>:igen:<tid>`).
- **Egna upplägg** (2026-10-27) mejlar familjen när admin skickar ett (typen `eget_upplagg`, nyckeln
  `eget_upplagg:mejl:<id>`, valet under Profil → Notiser, triggern `egna_upplagg_notis`): timmarna, priset med familjens
  rabatt och sista dagen, aldrig namnet, om fem minuter, och `notis_utskick_ta` hoppar över det när upplägget inte går att
  köpa längre. Ingen notis om sin egen åtgärd, och ett mejl som inte går att köa tar aldrig upplägget med sig (`notis_fel`).
- **Värvningsbonusen** (2026-10-21) mejlar värvaren en gång per bonus när den tjänas in (typen `varvningsbonus`,
  nyckeln `varvningsbonus:mejl:<id>`, valet under Profil → Notiser): beloppet och att bonusen hanteras enligt
  villkoren, aldrig kompisens namn. Ett mejl som inte går att köa tar aldrig bonusen med sig (`notis_fel`).

Detaljer: `minne/databasen.md`, `minne/notiser.md`.

## 6. Säkerhetsmodellen
Inte förhandlingsbar. **Allt skydd ligger i RLS, ingenting i gränssnittet**: adminvyn hämtar med
samma anon-nyckel, och `is_admin` i klienten visar bara rätt sida.
- Ändras vad som sparas, till vem eller hur länge: ändra `DATASKYDD.md` och integritetspolicyn
  på båda språken i samma ändring. `_delad/minimera.ts` och `maska_kontakt()` har samma regler.
- anon-nyckeln är inte hemlig. **`service_role` får aldrig in i en klientfil**, och **i en edge
  function prövas anroparens token mot Auth och RLS innan `service_role` används**
  (`_delad/auth.ts`; uppfinn ingen ny väg).
- **Ett CHECK-villkor körs som anroparen**: revoke aldrig en funktion som backar ett villkor,
  flytta den till `intern`.
- RLS begränsar inte kolumner: `is_admin`, `matched_tutor_id`, `status` och bokningsfälten
  vaktas av triggrar. Admin ges under System → Adminhantering (`gor_till_admin`, `ta_bort_admin`,
  `admin-skapa`) eller med SQL (`is_admin = true` blir superadmin); ingen vy skriver `is_admin`,
  ingen ändrar sin egen roll, och ett barn blir aldrig admin. En policy som nekar för mycket ser
  ut som en tom lista, inte som ett fel.
- En funktion som svarar om en PERSON har `is_admin`s vakt på första raden. Supabase ger varje
  ny funktion EXECUTE som förval; en triggerfunktion ska inte ha den.
- `invoices` och `payouts` har ingen INSERT-policy och `integrationer` ingen skrivpolicy;
  `google_koppling` ser ingen inloggad; delade avtal läses genom `mina_handlingar()`, och ett
  inklistrat avtal genom `min_handling_text()`: en handling är en fil, eller en text och/eller bilder
  (`handlingar.bilder`, skärmdumpar, 2026-10-26, genom `mina_handlingar_bilder()`), och texten och bilderna
  ändras aldrig (`handlingar_texten_star_fast`, `handlingar_bilderna`). Bildernas sökvägar skrivs med raden, i
  handlingens mapp med ett nummer och inget filnamn, och vyn delar handlingen sist, när bilderna är uppe.
  Notishemligheten står i `notis_konfig`, inte i en secret.
- **Utbildningsprovet** (2026-10-21) har databasens första restriktiva policyer ("utbildningsprovet först"
  på `bookings`, `students`, `lesson_reports`, `messages`, `study_plans`, `tutor_reviews`, `notiser` och
  `profiles`, där den egna raden alltid syns), och `is_my_student()` och barnchatten frågar
  `intern.provet_sparrar()`: resten (läxor, material, NexLäx, förberedelser, tillägg) går genom dem. En ny väg
  till en studiehjälpares elever gör likadant. Provets läge står i `prov_studiehjalpare`, aldrig på
  `tutor_profiles` (`skydda_tutorfalt` släpper bara vitlistade kolumner), och admins spärras aldrig.
- Rå servertext visas bara i de inloggade vyerna; en återvändsgränd bär `{oss}`. Anonyma
  skrivningar har tak, och deras `created_at` sätts av databasen.
- Hinkarna är privata och sökvägen är ett uuid, aldrig ett namn. I `cv` ändras `CV_RAD` och
  `NX.kopplaAnsökan` tillsammans, liksom sökvägens form och policyn.
- **Filen först, raden sedan, och läs svaret.** En fil öppnas i samma tryck
  (`NXMedia.öppnaFil`): Safari stoppar ett fönster som öppnas efter en väntan.
- **Inloggningen i vyerna**: logga ut med `scope: 'local'` (`NXStudie.loggaUt()`); ut överallt
  görs i databasen. `NXStudie.vaktaInloggningen()` byter en utloggad vy mot inloggningen.
  "permission denied" eller tomma listor: titta i API-loggen först. **Glömt lösenordet**:
  länken leder tillbaka till vyn där man bad om den, `type=recovery` och `type=invite` läses
  innan klienten skapas, rutan för lösenord väntas in före rolldirigeringen (också för en
  inbjudan, i alla tre vyerna), och beskedet är detsamma oavsett om kontot finns. Ett konto vi
  skapat får rutan utan Inte nu vid varje inloggning tills lösenordet är valt; `valkommen` säger
  bara vad vyn visar först, aldrig vad någon får.
  Inbjudan och Skicka igen mejlar `bjud-in` själv genom Resend (2026-10-07); Glömt lösenordet och
  `admin-skapa` mejlar Supabase Auth (Googles SMTP som info@), med mallarna i `minne/sakerhet.md`.
  Länken går alltid genom knappen på `/lank`, aldrig rakt till Auth.
- **Samtycket**: öppna sidor sätter inga cookies utan ja; det som kräver samtycke går genom
  `NXSamtycke`, och rutan visas bara när något i `SAMTYCKE` är på (på igen sedan 2026-10-11). Dölj
  den aldrig med CSS medan skripten går. Vercels statistik och **Google Analytics**
  (`G-V6Y6Q0SRXX`, 2026-10-11) hör till syftet statistik och laddas först efter ja, aldrig med
  statisk tagg; Google Ads hör till annonser. Consent Mode börjar på `denied` för alla fyra och
  uppdateras per syfte, `ad_personalization` aldrig. Adressen lämnar oss utan frågesträng utom
  utm (`renAdress`), och en sida med en nyckel i adressen (`avanmal`) laddar
  inte samtyckesrutan. Okänd källa är `null`, aldrig "direkt"; Global Privacy Control är nej; ja och
  nej är samma sorts knapp (Godkänn alla och Neka alla båda fyllda, kryssrutorna bakom Anpassa,
  2026-10-11); klasserna heter `nx-kakor-*`. Ändras lagringen följer `lagring.html`
  med; före ett pixel-id, se `minne/sakerhet.md`.
- **Advisorn** larmar om det som är med flit (listan i `minne/sakerhet.md`). Läckta lösenord
  kontrolleras inte. `kolla_rabattkod`, `kolla_rabattkod_kop` och `kod_pa_planen` har ett tak: tio okända koder i timmen per
  konto, sparade som HMAC i ett dygn (`intern.rabattkod_forsok`, `rabattkoden_timmar_och_tak`). Passets ruta prövar
  ingen kod alls sedan 2026-10-21 (`koder_for_planer`).
- **Förhandsvisningen använder aldrig den riktiga klienten**: med `?forhandsvisning` på `/foralder`
  eller `/larare` och utan `nextrum-forhandsvisning.js` skapar `nextrum-app.js` ingen klient alls, och
  modulvakten säger det. Den riktiga inloggningen frågar bara `mina_behorigheter()` (grinden, som är
  bekvämlighet: allt i världen är påhittat), och Logga ut där leder till adminvyn.
- **Content-Security-Policy**: `/admin`, `/larare`, `/barn`, `/lank` och `/foralder` har `script-src 'self'`,
  alltså **ingen inline-JavaScript** där (`kolla-csp.py`). `/foralder` släpper in Stripe, som
  aldrig vendoras. **Två skarpa CSP-rader får aldrig matcha samma sida.**

Detaljer: `minne/sakerhet.md`.

## 7. Edge functions (`supabase/functions/`)
- Det delade bor i `_delad/`: **lägg inte tillbaka en kopia**. `verify_jwt = false` står i
  `supabase/config.toml`, inte i dashboarden; en ny funktion utan inloggning får sin rad där
  samtidigt.
- Belopp räknas i funktionen, aldrig ur anropet, och en nyckel lämnar aldrig funktionen. Bara
  `stripe-webhook` sätter en betalning som betald och skriver `betalt_ore` (`begart_ore` är det
  begärda); den kastar varje fel så att Stripe försöker igen, och en tvist äger läget. Kassan
  tar bara kort, `faktura-utskick` skickar bara underlag och mejlet före statusen, och `google-meet`
  sparar bara öppna rum.
- **Syskontillägget** (2026-10-21): `stripe-checkout` tar `skuld: true` (Betala tillägg nu, utan kod) och lägger
  tillägget som en egen rad i ett köp av timmar (`med_tillagg: false` bara när det inte är obligatoriskt); beloppet
  är databasens (`tillagg_forsok_skapa`), och kassans utgångstid är försökets. `stripe-webhook` skriver betalningen
  genom `tillagg_forsok_betald` och `klippkort_betald_med_tillagg` (planen och tillägget i en transaktion), släpper
  försöket vid `checkout.session.expired` och `async_payment_failed`, och fördelar en återbetalning per rad
  (`_delad/tillagg.ts`). `stripe-aterbetalning` betalar tillbaka en rad (`betalningsrad`), aldrig över den.
  Granskningen 2026-10-21: kassan har en kassa åt gången per försök (`forsoketsKassa`: en äldre session går ut med
  `/expire`, och en som redan blivit klar ger 409 med `pagar`), bygger köpets rader med `buntaKassan` och läser
  regeln som ett fel om den inte går att läsa; webhooken prövar en sen tvisthändelse före tilläggets gren och skriver
  avgiften för en betalning som bara är tillägg på liggarens rad (`charge.updated`).
- **Betala alla och upplägget** (2026-10-27, i drift sedan samma kväll): `stripe-checkout` tar `{passen: [...]}` (2–20 pass,
  databasens belopp per pass, nyckeln `nextrum-passen-`) och `{upplagg, rabattkod}` (koden prövad med familjens token i
  `kod_pa_upplagget`, priset och koden dragna av databasen i `eget_upplagg_kop()`, och ingen kassa när koden hunnit sluta
  gälla; nyckeln `nextrum-upplagg-`), och SESSIONSFORM står kvar på 12. Webhooken betalar kassan genom `passkassa_betald` och
  loggar varje återbetalning (`aterbetalning_logga`), och `stripe-aterbetalning` och `stripe-reservation` betalar
  tillbaka ett pass i en kassa på sin rad, med `booking_id` i Stripes metadata (`_delad/passkassa.ts`). Kassan
  driftsätts sist (`DEPLOY-BETALNING.md` 9.28).
- **Sen avbokning** (2026-10-22): `stripe-checkout` tar ett avbokat pass bara när det har en avgift (SESSIONSFORM 12),
  med databasens belopp och minuter och ingen rabatt till; webhooken skriver den som en passbetalning. `notis-ko` bär
  avgiften i familjens mejl och bara att avbokningen var sen i studiehjälparens.
- **Verktyget avkodar bakstreck-u och fyra hexsiffror en gång till**, efter JSON-tolkningen och i varje anrop: escapen
  för det hårda mellanslaget i `notiser/mallar.ts` går ut som tecknet självt, och dubblade bakstreck blir två i filen.
  Skicka bakstrecket som en sådan följd (u005c, med bakstrecket före den dubblat i JSON), prova skrivningen på något
  ofarligt först, och jämför mekaniskt efteråt (`minne/funktioner.md`).
- `apply_migration` och `functions deploy` ändrar driften direkt: commit:a i samma arbetspass,
  och **driftsätt aldrig från en gren som inte är mergad**. Driften var 2026-09-30 ÄLDRE än
  main i 16 av 23 funktioner; alla driftsattes samma kväll, och `notis-ko`, `notis-avanmal` och
  `barn-inloggning` 2026-10-01, och `juridik`, `ekonomi` och `drift` 2026-10-07. Ingen skiljer i sak från main: en äldre kopia av en delad fil
  saknar bara tillägg som funktionen inte använder (`minne/funktioner.md`).
- `bjud-in` (`_delad/inbjudan.ts`) skapar kontot och länken med `generateLink` och sätter aldrig ett
  lösenord; mejlet skickar den själv genom Resend med tiden i ämnet (`notiser/konto.ts`), och länken
  prövas som `/lank` prövar den innan den mejlas. Igen skickar en ny inbjudan om länken inte använts,
  annars länken för lösenordet, också till ett konto i bruk, och högst ett mejl i minuten.
- `barn-konto` prövar föräldern och `admin-skapa` skriver rollen med anroparens token; bara det
  Auth kräver görs med `service_role`, och ett barnkonto skapas aldrig utan vårdnadshavarens ja.
  `barn-konto` väljer barnkontots id och ger Auth varken `app_metadata` eller roll: det skriver
  databasen, ur fönstret.
- `barn-inloggning` (verify_jwt av) är en inloggning, inte en anropare med token: den slår upp
  barnets tekniska adress med `service_role` och låter Auth pröva lösenordet. Samma svar och
  minst 0,9 sekunder för varje nej; databasen räknar försöken som HMAC. Ett vuxeninlogg som
  får "fel lösenord" provas också som barnadress (`NXStudie.loggaIn`).
- **Agentregeln**: hårt stegtak, källtvång i kod, bara verifierade `kallor` klickbara (aldrig
  med regex), `ekonomi` skriver aldrig, och agenterna läser källan, aldrig ur minnet.
- **Nex månadsrapport** (2026-10-21, Leo: "det är ju bra att den automatiskt ger en inblick i läget av
  företaget varje månad"): `nex-manadsrapport` skriver förra månadens rapport den 1:a (pg_cron
  `nex-manadsrapport`, 06.13 UTC, `intern.nex_manadsrapport_vack()`, `notis_konfig.nex_url`), och Skriv nu på
  Översikt skriver den när som helst. Inga verktyg och ingen slinga: drifts läsfunktioner läses med
  `service_role` efter hemligheten eller en superadmins token, och bara summor går till modellen
  (`_delad/manadsrapport.ts`; inga id:n, initialer eller fritext). Rapporten är en körning i `agent_korningar`
  (agent `drift`, frågan "Månadsrapport för …", en per månad) och en uppgift (`nex-manad:ÅÅÅÅ-MM`) säger att den
  är klar, så den syns i Att göra och morgonmejlet. Texten töms med agentloggen efter 90 dagar.
- **AI-lagret**: `drift` har inget utgående verktyg, och ingen AI-väg skriver i affärstabeller
  (rollen `nextrum_ai`). AI:n formulerar aldrig en nyckel eller en titel; `godkann_forslag()`
  utför med adminens token, en gren per typ, aldrig `update <tabell> set <payload>`. Databasens
  svar märks för modellen, domänspärren gäller efter varje omdirigering, analysvyerna nås bara
  genom omslag med fast kolumnlista, och `material-forslag` ger aldrig länkar. Maskoten har
  ingen modell, och provbänken `_prov-admin-*` checkas aldrig in.

Detaljer: `minne/funktioner.md`.

## 8. Genererade filer — ändra aldrig för hand
Byggs av `verktyg/`: `bygg-maskotsvar.py`, `bygg-faq-schema.py`, `bygg-omradessidor.py`
(`laxhjalp-*` med stadiesidorna, orterna, guiderna, navets kort och ortskatalog, affischens ortslista och `404.html`), `bygg-sitemap.py` (`lastmod` ur texten), `bygg-logga.js` (för hand: favicons, mejlloggan, BIMI och profilbilden ur
`bilder/nextrum-logga.svg`),
`bygg-banken.py` (för hand, och `--facit`; bladen och facit står i `verktyg/bladen/`), `bygg-webp.py` (inte i CI; `kolla-webp.py` vaktar),
`bygg-delningsbilder.js` (för hand: en delningsbild per sida i kartan, `delning/`, med rubriken och
priset; körs när en rubrik eller priset ändras, och `kolla-delningsbilder.py` vaktar) och
`bygg-uppgifter.py --sql` (alltid en ny migration), `bygg-faktablad.py --skriv` (faktabladen i `nexlax-fakta/`).
**`satt-version.py` körs SIST.** Sidorna
säger bara det som är sant: inga antal, betyg, betygshöjningar, okontrollerade skolnamn,
kursnamn med årtal eller vad familjerna brukar göra (de är för få, 2026-10-06); en guide länkar det den påstår, och dess författare är Nextrum. En adress
som stått i kartan blir aldrig en 404. Förladda inte typsnittet utan att mäta.
**Titeln och beskrivningen syns hela i en sökträff** (2026-10-26): högst 600 och 920 px i Arial
(`verktyg/textbredd.py`, `kolla-titlar.py` i CI), unika, `og:` och `twitter:` som sidans, och priset
tidigt i läxhjälpssidornas beskrivning; generatorn skriver mot 580 och 900 och väljer ortssidornas titel
själv (`omradestitel()`). **En ort får en sida** (2026-10-26, Leo: "lägg till landningssidor för varje ort
i Stockholm") bara med lika mycket eget som de första orterna: delområdena, trafiken och biblioteken,
kontrollerade mot källor, och sina grannar (`grannar`, `region`); en ort som inte gått att kontrollera
väntar hellre än står med påhittade bibliotek. Varje ort har ett eget par av de allmänna frågorna
(`prova_fragorna()`, 2026-10-27): samma par gjorde två ortssidor till de mest lika på sajten. Navets `areaServed`
nämner bara kommuner som har en ortssida (`prova_navets_omraden()`). Länkar i
löptexten på de genererade sidorna är understrukna (`.nx-text p a` i cinema), annars syns de inte.

Detaljer: `minne/genererat-och-ci.md`.

## 9. CI — `.github/workflows/kontroll.yml`
Varje push och PR, och lokalt före push: `node --check`, `testa-agent.js`,
`kolla-betalningsvillkor.py`, `kolla-migrationer.py`, `bygg-uppgifter.py --kolla`, `bygg-faktablad.py --kolla`,
`kolla-csp.py`, `kolla-behorigheter.py`, `kolla-webp.py`, `kolla-mejltexter.py`, `kolla-villkor.py`, `kolla-delningsbilder.py`, `kolla-titlar.py`, `kolla-forhandsvisning.py`, `test/innehall-regler.py`, `satt-version.py --kolla`, de genererade filerna
(`git diff --exit-code`), språkdiffen (också attributnamn), `deno check` och `deno test`.
- `node --check` ser bara syntax; ett namn som inte hämtats ur `NXAdmin` smäller vid körning.
- `indexnow.yml` är ingen kontroll. Nyckeln står i roten och i `verktyg/indexnow.py`: byt båda.
  Den tar `success`, aldrig `promoted`, och checkar ut den driftsatta commiten, så en ändring i
  den går inte att prova på en gren; en utebliven körning syns bara i Actions.
- **`verktyg/rls-test.sql`** körs inte i CI. Kör HELA filen som ett anrop efter varje ändring i
  en policy eller trigger; varje rad ska vara ok. Den slår upp triggrar på funktionen, har
  flaggan `erbjudanden` av, stänger av driftens frågor till utbildningsprovet och sätter provets förval
  (2026-10-20: med driftens 26 frågor spärrades fixturernas studiehjälpare, och 66 prov föll), och en
  fixtur syns för resten av filen. Lokalt först, med
  `verktyg/lokal-databas.sh` (`STOPP=`); driften i en transaktion som rullas tillbaka, hämtad
  med tillägget `http` från en commit.
  I en molnsession: `dockerd &`, och Deno ur npm med en importkarta (`minne/genererat-och-ci.md`).
- **`verktyg/prova-adminvyn.js`** (2026-10-21) körs inte i CI heller: adminvyn mot PostgREST framför en lokal
  databas med `prova-adminvyn.sql`, varje sektion, flik och den första panelen, som superadmin, som admin med
  behörigheter och på en telefon i mörkt läge. Det faller på varje fel i konsolen och varje svar från databasen på
  400 eller mer, och de andra webbläsarproven, som svarar ur en falsk värld, ser inte de felen. Kör det efter en
  ändring i adminvyn eller i en policy den läser.
- **`verktyg/prova-tillagg-samtidigt.sh`** (2026-10-21) körs inte i CI: två psql-sessioner betalar samma skuld
  samtidigt mot den lokala databasen, och varje post ska stå i exakt ett försök. Kör det efter en ändring i
  `tillagg_forsok_skapa` eller låsen; `rls-test.sql` kör i en transaktion och kan inte pröva två samtidiga.

Detaljer: `minne/genererat-och-ci.md`.

## 10. Arbetssätt
Commits är svenska och beskriver följden ("Fas 2.5: en faktura skickas bara en gång"); följ
fasnumreringen. Kommentarerna förklarar varför, inte vad. `bilder/*.png`, `.claude/skills/`,
`.agents/` och `skills-lock.json` är gitignorerade och finns ingen annanstans. En
Claude-artefaktlänk kan aldrig prata med Supabase: testa mot riktiga filer.

Detaljer: `minne/grunden.md`.

## 11. Vad som inte är byggt
- **Signaturen i mejlen** (2026-10-28, `rendera.ts`, PR #381) är i drift sedan kvällen 2026-10-28 (Leo: "ja, merga och
  driftsätt"): PR #381 mergades (1f7a4b4) och fem funktioner lades ut från merge-commiten, genom MCP från hjälpagenter:
  `notis-ko` v41, `ansokan-notis` v11, `bjud-in` v13, `lead-notis` v33 (kvittot till familjen) och `admin-paminnelse`
  v5. Alla fem är hämtade tillbaka och byte för byte lika main (17, 13, 13, 11 och 12 filer), med verify_jwt som i
  `config.toml`. `notis-avanmal`, `ansokan-mejl`, `faktura-utskick` och `nyhetsbrev` importerar `rendera.ts` men
  ändras inte (de har `skal()` utan `signatur`), och `barn-*` importerar den inte. Ingen migration. **Escapen i
  `mallar.ts` gick fel två gånger** (`notis-ko` v39 och v40 låg ute några minuter med `\\u005cu00a0` i `kronor()`,
  så ett belopp i ett mejl kunde stå med den texten; v41 rättade det): se avsnitt 7, skicka bakstrecket som
  `\\u005cu00a0` i JSON och jämför varje fil efteråt. Inget mejl gick under de minuterna (`notis_utskick` hade inga
  rader med ändrad tid mellan 19.27 och 19.55 UTC), så ingen fick den texten. `lead-notis` låg före på v31, äldre än main (saknade `_delad/erbjudanden.ts`), så den fick mer än
  signaturen. `stripe-webhook` gick v17 till v18 under kvällen utan att den här sessionen rörde den; v18 är byte för byte lika main
  (12 filer), alltså förhandsvisningens kassa som väntade på den (`forhandsvisning=1`).
- **Fripassen i NexLäx** (2026-10-27, `nexlax_fripass` 20261028130000) är i drift sedan förmiddagen 2026-10-28 (Leo:
  "Merge", sedan "Kör"): PR #370 mergades (931e821) och Vercel lade ut vyerna och policyn, och migrationen kördes hel i
  en transaktion ur merge-commiten, prövad mot sin md5 (`1d3148d5…`) och registrerad med filens text i samma
  transaktion. Före: `nexlax_lage` hade samma md5 som när filen skrevs (`7b055d4c…`). Efter: `niva_hoppa`,
  `intern.nexlax_fripass`, `intern.nexlax_fripass_per_vecka` och `nexlax_lage` är byte för byte lika en databas byggd ur
  alla 234 migrationer, `niva_hoppa` nås av `authenticated` och `nextrum_barn` men inte `anon`, de interna inte av någon
  inloggad, och inget försök är märkt. Ingen edge-funktion. Lokalt före: `rls-test.sql` 2242 av 2242, `prova-nexlax.js`
  111 av 111 och `prova-forhandsvisning.js` 75 av 75; `rls-test.sql` kördes inte mot driften (ingen policy eller
  trigger ändrades). Versionen var först 20261028120000, samma som nyhetsbrevets, och flyttades vid sammanslagningen
  med main. Juristen har inte läst policyns nya halvmening om fripassen.
- **Nyhetsbrevet** (2026-10-28, `nyhetsbrev` 20261028120000, Leo: "gör detta arbete simpelt") är inte i drift.
  Formuläret står bara i footern på varje öppen sida (startsidans Nästa steg hade ett till, borttaget 2026-10-29, Leo: "Ta bort denna"; `nextrum-nyhetsbrev.js`, laddat av
  `nextrum-samtycke.js`, så aldrig i vyerna eller på en sida med en nyckel i adressen); ingen popup, inget i
  webbläsaren och ingen rabatt. Dubbel opt-in genom edge-funktionen `nyhetsbrev` (`verify_jwt` av, taket fem i timmen
  per IP-hash och 300 totalt, samma svar om adressen finns), och `/nyhetsbrev` bekräftar (`?b=`) och avslutar (`?a=`)
  med en knapp. En avanmälan raderar raden, och en obekräftad raderas efter sju dagar. Tabellen är sanningen; Resends
  Audience (`RESEND_AUDIENCE_ID`) är en kopia att skicka från. Inget skickar nyhetsbrevet än: varje utskick ska ha
  länken `/nyhetsbrev?a=<token>`. Kvar: migrationen och funktionen efter merge, secreten, att prova flödet, och
  juristen (rad 40 i `DATASKYDD.md`, policyns stycke).
- **Förhandsvisningens kassa och NexLäx** (2026-10-27, `forhandsvisningens_nexlax` 20261028110000 och edge-funktionen
  `forhandsvisning-kassa`) är i drift sedan natten till 2026-10-28 (Leo: "Kör"): PR #371 och #374 mergades (6da87bf),
  migrationen kördes hel i ett do-block med filens md5 (`6a34cd0c…`) och registrerades med filens text, och
  `forhandsvisning-kassa` v1 gick ut från 6da87bf och är hämtad tillbaka. Provat mot driften, tillbakarullat: en annan än
  admin nekas, en superadmin får engelska åk 9 utan facit och en rättning, och inga försök eller svar sparas; funktionen
  svarar 401 ur sin egen kod utan inloggning. Advisorn fick bara de två nya funktionerna för `authenticated`, med flit.
  `stripe-webhook` v18 med raden för `forhandsvisning=1` gick ut 2026-10-28 från 88dd4b4 (Leo: "kör"), hämtad tillbaka
  och byte för byte lika i alla tolv filer, och svarar 400 ur sin egen kod utan signatur. **Repetitionen**
  (`forhandsvisningens_repetition` 20261028140000, PR #382) är i drift sedan samma kväll: urvalet i
  `intern.nexlax_repetition_ur`, som elevens repetition och `forhandsvisning_repetition()` delar; körd i ett do-block ur
  88dd4b4 med filens md5 (`60fcfebe…`) och vakten mot driftens `nexlax_repetitionsfragor` (`4e2204bb…`), registrerad
  med filens text, och de tre funktionerna är byte för byte lika en databas byggd ur filerna. Provat mot driften,
  tillbakarullat: elevens repetition drar, superadmin får frågorna utan facit och inget sparas, och en annan än admin
  nekas. Lokalt `rls-test.sql` 2294 av 2294 och `prova-forhandsvisning.js` 77 av 77. `#374` bytte
  `\u`-escapes mot `\x` i `_delad/forhandsvisning.ts`, för verktyget avkodar dem (avsnitt 7). Kvar: ett köp med
  testkortet i förhandsvisningen. Datumrutans förslag har samma enda kant som de andra sedan 2026-10-27 (Leo: den gula
  "har extra streck inuti").
- **Nextrum AB och bonusarna som godkänns** (2026-10-28, `bonusarna_godkanns` 20261028100000) är inte i drift. Efter
  merge: Vercel lägger ut sidorna (footern, villkoren och policyn), sedan `admin-paminnelse` (känner `bonus_godkann`; utan
  den hoppas raden över, inget går sönder), migrationen (md5-vakter mot driften 2026-10-27 för vakten, `varvning_prova`,
  tipstimmarna och `admin_att_gora`, ett `drop constraint` för statuslistan), och `drift` (agentens fakta). Lokalt:
  `rls-test.sql` 2275 av 2275, `prova-adminvyn.js` 209 av 209 och `prova-varvning.js` 68 av 68. I driften fanns inga
  värvningsbonusar eller tipstimmar 2026-10-27. Villkorens version blir 2026-10-28, så alla får frågan igen. Juristen har
  inte läst övergången från Leo och Alex till bolaget (policyn och villkorens Vem avtalet är med), som är en överföring
  av personuppgifter, eller den nya punkten om att vi godkänner. Leverantörskontona står fortfarande i Leos och Alex namn
  (`DATASKYDD.md`, avsnitt 9). Adressen Mönsteråsgränd 4 står kvar som bolagets.
- **Betala alla, återbetalningarna och egna upplägg** (2026-10-27, `flera_pass_och_aterbetalningar` 20261027160000
  och `egna_upplagg` 20261027170000) är i drift sedan kvällen 2026-10-27 (Leo: "Testa så allt funkar som det ska och sen
  Merge, driftsätt och migrera"). Först en provkörning mot driften före merge, båda migrationerna och hela
  `rls-test.sql`, tillbakarullad: 2264 av 2264. PR #354 mergades (b9acaa7), Vercel lade ut sajten med villkoren
  2026-10-27, `notis-ko` v38 och `notis-avanmal` v11 gick ut före migrationerna (de känner mejlet om upplägget), sedan
  migrationerna i ordning, var och en hel i ett do-block ur merge-commiten med md5 och filens text, och sist funktionerna:
  `stripe-webhook` v17, `stripe-reservation` v4, `stripe-aterbetalning` v10, `stripe-avstamning` v3, `klippkort-betala` v5
  och kassan `stripe-checkout` v26, med `drift` v27. Alla är hämtade tillbaka och byte för byte lika main, utom en tom rad
  i en kommentar i kassans `index.ts` (samma kod, lika nästa gång kassan driftsätts), de 30
  funktionerna och de nya tabellerna i databasen är lika en databas byggd ur filerna, hela `rls-test.sql` gick 2264 av 2264
  mot driften efteråt, tillbakarullat, och advisorn fick bara de tre nya funktionerna för `authenticated`, med flit
  (`DEPLOY-BETALNING.md` 9.28). Samma meddelande sa att planerna skulle gälla köpmånaden; Leo tog
  tillbaka det ("skojade, planerna är i 30 dagar"), och inget ändrades där. Upplägget gjordes om samma eftermiddag (Leo:
  "rabattkod gäller också för upplägg. Samma sak som vanliga planer bara annat antal timmar"): planernas timpris i stället
  för ett pris admin satte, koderna och Köp till timmar som på en plan, och ett mejl när det skickas. Villkorens version
  är 2026-10-27, så alla får frågan igen. Ett eget upplägg ger första timmen gratis om det är familjens första plan, för
  villkoren är planens. Kvar: provet i testläge (9.28 steg 7), att säga till familjerna om villkoren, och juristen har
  inte läst `#eget-upplagg`, raderna 37–39 i
  `DATASKYDD.md`, policyns nya meningar om återbetalningarna, kassan och upplägget, eller mejlet om upplägget, som är ett
  erbjudande till en befintlig kund med avanmälan i varje mejl.
- **Fas 25** (2026-10-27, Leos lista samma morgon: NexLäx från åk 6, faktabladen och ledet, Betalning & planer i
  en sektion, datumrutans färger, hemskärmen, introduktionen med rörelse, inga hopp, och de öppna sidorna;
  `minne/nexlax.md` och `minne/vyerna.md`, Fas 25). PR #346 och Fas 25.1 (#347) är mergade och utlagda av Vercel, och
  **migrationen `20261027120000_uppgiftsbanken_fortsattning` är i drift sedan 2026-10-27** (Leo: "Kör"):
  hämtad ur merge-commiten 0873d83, prövad mot sin md5 (`ee55c1ad…`) och körd och registrerad i ett do-block med
  vakter före och efter (1 285 nivåer och 7 515 frågor aktiva före, 1 462 och 8 762 efter). Facitprovet mot driften:
  38 187 prov på alla 8 762 aktiva frågor, 0 fel. Ingen edge-funktion och ingen ändring i databasens regler. Frågorna och
  de 470 faktabladen är skrivna och granskade med AI, inte lästa av någon som undervisar. **Facitgranskningen**
  (2026-10-27, Leo: "granska facit så att den inte är fel"): alla 8 762 frågor lösta av AI-granskare utan facit och
  jämförda; inget facit var fel, men en parning var tvetydig, sex förklaringar sa fel och ett trettiotal rätta svar
  godtogs inte ("pratminus", "t = 2", "åtta"). Rättat i `20261027150000_uppgiftsbanken_granskningen` (30 frågor
  får nytt id), i drift sedan 2026-10-27 (Leo: "kör"): hämtad ur merge-commiten 22a7847, prövad mot sin md5
  (`a76ce426…`), körd och registrerad i ett do-block; 8 762 frågor och 1 462 nivåer aktiva före och efter. Trustpilots adress
  (`se.trustpilot.com/review/nextrum.se`) och TikToks handtag (`@nextrum.ab`) är inte kontrollerade, och fotot på
  Instagramkortet är vårt eget, inte ur flödet.
- **Ortssidorna och sökträffarna** (2026-10-26, Leo: "gör rubrikerna bättre, Bilderna mer passande, fixa små felen
  ... Lägg även till landningssidor för varje ort i Stockholm") är i drift sedan natten till 2026-10-27 (Leo: "merge"):
  24 nya ortssidor (30 med de första), navets ortskatalog, footerns regioner, nya titlar och beskrivningar på alla öppna
  sidor, `kolla-titlar.py` i CI och ämnets, stadiets eller ortens eget foto i delningsbilderna. PR #341 mergades
  (6a20718) efter en provmerge med main där alla kontroller gick igenom, och Vercels driftsättning av merge-commiten
  blev klar med nextrum.se som alias; sidorna är inte hämtade därifrån, för miljön nådde inte nextrum.se. Ingen
  migration och ingen edge-funktion. Sitemapen skickades in på nytt i Search Console 2026-10-27 och lästes inom en
  minut; 2026-10-28 var 79 av 80 adresser indexerade, granskade en och en, och kvar är bara `/laxhjalp-online`
  (`GOOGLE.md`, "Läget"). **De sista
  kommunerna** (Sigtuna, Upplands-Bro, Ekerö, Nykvarn, Haninge, Tyresö, Nynäshamn och Värmdö) är i drift sedan
  morgonen 2026-10-27 (Leo: "Merge"): PR #342 mergades (9c44994) och Vercel lade ut den på nextrum.se, kontrollerat
  från databasen: de nya sidorna svarar, `/laxhjalp-osteraker` leder till navets region och sitemapen har 83 adresser.
  Med dem kom en granskning av alla ortssidor (Leo: "De ska också vara snygga, bra
  för SEO och funktionella"): länkarna i löptexten på 53 genererade sidor syntes inte (samma färg, ingen
  understrykning) och är understrukna, och de mest lika ortssidorna fick egna allmänna frågor. Inga konsolfel, trasiga
  länkar eller sidledsrullning på någon av ortssidorna, i mobil och dator. **Sidrensningen** (samma dag, Leo bockade av
  i en checklista med alla sidor): Vaxholm och Norrtälje, byggda samma dag, togs bort innan de gick ut, och Österåker,
  ute sedan #341, togs bort och leder till navets region (`/laxhjalp-stockholm#norr-och-vaster` i `vercel.json`): en
  adress som stått i kartan blir aldrig en 404. Samma förmiddag gick också Södertälje (ute sedan #341), Nykvarn och
  Nynäshamn (ute sedan #342; Leo: "nykvarn, nynäshamn, södertälje ska också bort"). De leder till Söder och öster om
  stan (`/laxhjalp-stockholm#soder-och-oster`), Botkyrka, Salem och Haninge fick nya grannar, och sitemapen har 80 adresser.
  Inga nya foton: nätet släppte inte fram någon bildtjänst, så sidorna
  delar på de 14 som finns, och inget foto visar orten. Trettiofyra sidor med samma upplägg är vad Google kallar
  doorway-sidor om de saknar eget innehåll; de har det
  (delarna, trafiken, biblioteken, egna frågor), men följ dem i Search Console när de är ute: en ort som inte visas
  efter några månader slås hellre ihop med sin region än får fler likadana grannar (`minne/genererat-och-ci.md`).
- **Dokument med bilder, kön i matchningen och papperskorgen** (2026-10-26, `dokument_med_bilder` 20261026140000,
  `kon_i_matchningen` 20261026150000 och `papperskorgen` 20261026160000) är i drift sedan kvällen 2026-10-26 (Leo:
  "merge och driftsätt"): PR #338 mergades (64d0a90), och Vercel lade ut vyerna och integritetspolicyn på båda språken
  (kontrollerat från databasen mot nextrum.se). Sedan `dokument_med_bilder` hel i ett do-block ur merge-commiten (md5
  `71ae383b…`), och `kon_i_matchningen` och `papperskorgen` som var sitt `execute_sql` (de har ett `delete` i en
  funktion, och då inte genom `http_get` och `execute`), registrerade med filens text ur merge-commiten (md5
  `6d80122b…`, `b1836d61…`). De 17 funktionskropparna med inställningar, rättigheter och kommentarer, villkoren,
  triggrarna, policyerna och vyn är lika en databas byggd ur filerna, hela `rls-test.sql` gick 2202 av 2202 mot
  driften, tillbakarullat, och advisorn fick bara `mina_handlingar_bilder`, `stalle_lage` och `ta_bort_ur_stallet` som
  nya poster för `authenticated` (med flit). Ingen edge-funktion. Valet om kön syns sedan dess i studiehjälparnas
  profil, och föräldern kan ange barnets kön. Juristen har inte läst rad 17 och 36 i `DATASKYDD.md`, de två nya
  raderna i konsekvensbedömningen, policyns meningar om kön, eller frågan om diskrimineringslagen 2 kap. 12 § (avsnitt
  8 där), och Leo valde att driftsätta före; säg inte till studiehjälparna att valet finns förrän juristen läst det.
  Leo bad om kön på "alla profiler"; föräldrarnas sparas inte, och fältet får stå tomt.
- **Fyll timbanken säljs inte** (2026-10-22, `klippkort-bort`) är i drift sedan kvällen 2026-10-24 (Leo: "push, merge
  commit och migrera"): PR #331 mergades (9e72f81), och Vercel lade ut prissidan på båda språken, studievyn och adminvyns
  texter (kontrollerat från databasen mot nextrum.se). Sedan `drift` v26 och `stripe-checkout` v25 från merge-commiten,
  genom MCP från hjälpagenter, hämtade tillbaka och jämförda fil för fil: `drift` byte för byte lika i alla fem filer,
  `stripe-checkout` i åtta av nio, och i dess `index.ts` saknas en tom rad mellan två satser (rad 361), samma kod, som
  blir lika nästa gång kassan driftsätts. Röktest från databasen: 401 "Inloggningen gick inte att verifiera" ur båda
  funktionernas egen kod. Ingen migration: katalogen, köpen (det fanns inga köp av timmar) och strömbrytarens beskrivning
  i `flaggor` (som fortfarande säger Fyll timbanken) rörs inte, och i Stripe ingenting (kassan skapar inga produkter,
  raderna går med `price_data`). **Villkoren 2026-10-26** (`villkoren_utan_fyll_timbanken`, 20261026120000, Leo: "fixa
  villkoren") säger att timbanken fylls med en plan, att Fyll timbanken inte säljs längre och att timmar köpta med den
  gäller som förut; Fyll timbanken är struken där villkoren räknar upp vad man kan köpa, och reglerna för köpta timmar
  (sex månader, timbanken, prisgarantin, Att sluta) står kvar. Syskontilläggets version (2026-10-23) står kvar, för dess
  regel är densamma. I drift sedan eftermiddagen 2026-10-26: PR #336 mergades (7d5de9d), Vercel lade ut sidorna
  (kontrollerat från databasen mot nextrum.se), och migrationen kördes hel i ett do-block, hämtad ur merge-commiten,
  prövad mot sin md5 (`05139538…`) och registrerad med filens text. Hela `rls-test.sql` gick 2131 av 2131 mot driften,
  tillbakarullat. Alla får frågan igen; två konton hade godkänt 2026-10-23. Juristen har inte läst den nya texten.
- **Sen avbokning** (2026-10-22, `sen_avbokning`, 20261022100000) är i drift sedan kvällen 2026-10-22 (Leo: "merg och
  driftsätt"): PR #329 mergades (c0d787a), och Vercel lade ut villkoren 2026-10-23 med `#avbokning` och
  `#syskontillagg` (Leo: "skriv villkorstexten själv, du har all info"), FAQ:n, Så fungerar Nextrum, prisguiden och
  vyerna. Sedan `drift` v25, `stripe-checkout` v24 (SESSIONSFORM 12) och `notis-ko` v37 (avgiften i mejlet) från
  merge-commiten, hämtade tillbaka och byte för byte lika main, och sist migrationen hel i ett do-block (md5
  `15bc9fc3…`, vakten mot driftens 20 funktioner, och 25 funktionskroppar lika en databas byggd ur filerna). Hela
  `rls-test.sql` gick 2131 av 2131 mot driften, tillbakarullat, före och efter, och advisorn fick bara
  `sen_avbokning_lage` som ny post, för `authenticated` (`DEPLOY-BETALNING.md` 9.27). `notis-ko` blev rätt först i
  femte försöket, för verktyget avkodar escapen för det hårda mellanslaget i `mallar.ts` (avsnitt 7); v35 skrev den som
  text i tio minuter, då kön var tom. Kvar: provet i testläge (9.27 steg 5) och att säga till familjerna. Alla får
  frågan om villkoren igen, och regeln gäller först pass som föreslås efter att familjen godkänt dem. Juristen har
  inte läst regeln, meningen om ångerrätten (en ångrad bokning som inte börjat kostar inget, så avgiften gäller i praktiken pass
  bokade mer än 14 dagar före; ingen har prövat undantaget för fritidsverksamhet i 2 kap. 11 §), syskontilläggets
  villkor eller rad 5 i `DATASKYDD.md`. Edge-funktionen `utbildningsprov` tar Leo bort i Supabases panel (verktygen kan
  inte ta bort en funktion).
- **Om oss och Så ser ni att det funkar** (2026-10-22, `om-oss-sida`) är i drift sedan kvällen 2026-10-24: PR #332
  mergades (deb70ce) efter #331, med main intagen och två versionsstämplar i `om-oss.html` omstämplade, och Vercel lade
  ut sidorna (kontrollerat från databasen mot nextrum.se: `/om-oss` utan platshållare, `#exempel` och footerns länk på
  båda språken). `/om-oss` (bara på svenska; footern länkar dit på varje sida, engelskan med "About us (in Swedish)").
  Startsidans `#exempel` togs bort 2026-10-26 (Leo: "ta bort den"), på båda språken. Ingen migration och ingen
  edge-funktion. Varför vi startade (rutan `.om-egna` sist under
  Idén) är skriven ur grundarnas egna ord på startsidan (2026-10-24, Leo: "lös det själv"), utan någon scen eller
  detalj som inte står på sajten; skriver Leo en egen byts den. Organisationsnummer och postadress har inga sidor än:
  bolaget är under bildande. Sidan säger att en ny studiehjälpare inte ser några elever förrän provet är godkänt: det
  gäller först när Kräv provet står på och minst fem frågor är aktiva (avsnitt 11, Intervjumejlet och utbildningsprovet).
  Startsidans `#rost` har fortfarande citatet från "Leo & Alex, grundare av Nextrum"; Om oss nämner inga namn.
- **Syskontillägget fast** (2026-10-21, `syskontillagget_fast`, 20261021230000) är i drift sedan kvällen 2026-10-21 (Leo:
  "Tre barn kostar 468 i timmen", sedan "Merge oxh migrera"): tillägget är `extra_ore` gånger minuterna, lika mycket med
  ett som med två syskon, i databasen (`intern.tillaggets_belopp`, villkoret `tillagg_poster_belopp`), i
  `_delad/tillagg.ts`, i `nextrum-betalning.js` och i bokningsrutan. PR #327 mergades (05cb8c1), och Vercel lade ut
  vyerna byte för byte som main; sedan bytet av villkoret som en egen sats med texten synlig (ett `drop`, som gick igenom
  utan fråga), och resten i ett do-block ur merge-commiten, med filens och restens md5 prövade (`DEPLOY-BETALNING.md`
  9.26). Inga poster fanns. Ingen edge-funktion lades ut: ingen anropar spegeln i drift. Hela `rls-test.sql` gick 2107
  av 2107 mot driften, tillbakarullat, och advisorn är oförändrad. `syskonskuld` står av, så inget pris har ändrats.
- **Kedjan 2026-10-21 är i drift** sedan kvällen 2026-10-21 (Leo: "Fixa nr 6 och Merge sen och driftsätt och migrera"):
  PR #325 mergades (829d2c0) och Vercel lade ut sajten; sedan 13 edge-funktioner från merge-commiten, hämtade tillbaka
  och byte för byte lika main, och de tio migrationerna `20261021170000` till `20261021215000`, var och en i ett eget
  do-block med md5 och filens text, där bytet av `betalningar_typ_check` gick som en egen sats med texten synlig
  (`DEPLOY-BETALNING.md` 9.25, `minne/databasen.md`). Hela `rls-test.sql` gick 2106 av 2106 mot driften,
  tillbakarullat, advisorn fick bara `prova_jobbkod` (med flit) som ny post för `anon`, och funktionerna i databasen är
  lika en databas byggd ur filerna, utom `zz_prov_*` och fyra gamla som bara skiljer i kommentarer. I Stripes sandlåda
  var Klarna redan på, och endpointen tar emot `checkout.session.expired`, `async_payment_succeeded` och `_failed`.
  Leos testbetalning är dold i Liggaren, och inget raderades. Ingen backup togs för hand; en ögonblicksbild före visar
  att samma rader står kvar. En jämförelse av de andra sjutton funktionerna med main hittade ett fel i sak:
  `notis-avanmal` v9 kände inte fem notistyper, så avanmälan i de mejlen svarade 403. v10 från 829d2c0 rättade det
  innan något sådant mejl gått ut (`minne/notiser.md`).
- **Den oberoende granskningen av del 1–8** (2026-10-21): tre granskare som inte skrivit koden läste hela diffen
  (databasens skydd, pengaflödet, tidszonen och vyerna) och bevisade sina fynd mot en lokal databas. Allt rättades i
  samma migrationer, i drift sedan kvällen 2026-10-21, med prov i `rls-test.sql` (avsnitt 47–52) och `tillagg_test.ts`.
  Kvar, och äldre än grenen: bokslutet räknar inga köp av timmar, en återbetalning som står som pending räknas som
  återbetald, och `betalning_tvist` litar på webhookens vakt mot sena tvisthändelser.
- **Värvningsbonusen** (2026-10-21, `varvningsbonus`, 20261021215000) är i drift sedan kvällen 2026-10-21: `notis-ko`
  v32 före migrationen. Båda godkända studiehjälparna hade redan en kod, och varken `tipsbonus` eller ansökningarna i
  gång gav någon rad, så ingen bonus finns. Villkoren `#tips` är omskrivna för bonusen i versionen 2026-10-22, som ingen
  hade godkänt när texten gick ut (Leo: "Fixa nr 6"): när kompisen fått sitt konto, vem som räknas som ny, och att
  värvaren ser läget och förnamnet; Leo läser dem. Kvar: provet (`DEPLOY-BETALNING.md` 9.24 steg 8). Revisorn avgör
  anställningen, arbetsgivaravgifterna och semesterersättningen före första utbetalningen, och lönearten
  (`lonart_tipsbonus`) sätts i Fortnox. Juristen har inte läst rad 27 i `DATASKYDD.md` eller policyns nya ord om koden
  och förnamnet.
- **Syskontillägget som skuld** (2026-10-21, `syskontillagg_som_skuld`, 20261021214000) är i drift sedan kvällen
  2026-10-21, och strömbrytaren `syskonskuld` står av: migrationen, sedan `stripe-checkout` v23, `stripe-aterbetalning`
  v9 och `notis-ko` v32 (`stripe-webhook` v16 gick ut före, med Betala nu). Stripes endpoint tar emot
  `checkout.session.expired`, och jobben `tillagg-forsok` och `tillagg-paminnelse` går. Villkorstexten
  (`#syskontillagg`, länken i `CFG.TILLAGG_VILLKOR_URL`) och versionen 2026-10-23 i `tillagg_installning` är i drift
  sedan 2026-10-22 med `sen_avbokning` (ovan), som också avgör den sena avbokningen: hälften av tillägget, som hälften
  av passet. Kvar för Leo: att prissidan, FAQ:n och /en/ säger att tillägget betalas efter passet, och sist strömbrytaren. Priset är bestämt:
  tre barn kostar 468 kr i timmen också med den på (`syskontillagget_fast`, ovan). Juristen har inte läst rad 35 i
  `DATASKYDD.md` eller policyns stycke om tillägget. Med strömbrytaren av bokas syskon som förut, och inget pris ändras.
- **Liggarens markeringar och testbetalningen** (2026-10-21, `betalningar_dolda`, 20261021213000) är i drift sedan
  kvällen 2026-10-21, och Leos testbetalning (planen för 1 364 kr den 2026-09-28, `skarp = false`) står som `test` under
  Dolda; ingenting raderades. `supabase/scripts/rensa-leo-testbetalning.sql` fastnade på verktygets bekräftelse
  (funktionen har tre `delete`), så torrkörningens lista togs med läsfrågor (en betalning i liggaren, inga riktiga,
  inga pass, köp, kodanvändningar eller tilläggsposter) och raden skrevs med en `insert` med skriptets vakter
  (`minne/databasen.md`). En riktig betalning märks annullerad bara med skriptet och `markera_riktiga => true`, i SQL
  Editor.
- **Insatta timmar med orsak och månad** (2026-10-21, `timmar_med_orsak`, 20261021212000) är i drift sedan kvällen
  2026-10-21. Inga gratistimmar fanns, så ingen rad saknar orsak. Juristen har inte läst rad 34 i `DATASKYDD.md` eller
  policyns nya ord om orsaken.
- **Kodernas ägare och en gång per familj** (2026-10-21, `koderna_agare_och_en_gang`, 20261021211000) är i drift sedan
  kvällen 2026-10-21: `TIPS`, den enda koden, har `max_per_familj` 1 och står av som förut. Ingen edge-funktion ändrades
  för den: kassan frågar `kod_pa_planen()`, som svarar ur `intern.rabattkod_prova`. Juristen har inte läst den nya
  meningen på rad 33 i `DATASKYDD.md` eller policyns om koden som är er.
- **Ansökningarnas steg** (2026-10-21, `ansokningarnas_steg`, 20261021210000) är i drift sedan kvällen 2026-10-21: den
  godkända ansökan kopplades till kontot med samma adress och står i Konto skapat, fyra står i Intervju och tio i Ny.
  Juristen har inte läst raden om stegen i `DATASKYDD.md` (rad 10).
- **Betala nu, Klarna, planerna i 30 dagar och NexLäx enklare och ljus** (2026-10-21) är i drift sedan kvällen
  2026-10-21: `stripe-webhook` v16, `stripe-reservation` v3, `notis-ko` v32, `drift` v24 och `ekonomi` v27 från
  merge-commiten av PR #325, migrationen `betala_nu` (20261021200000), och `stripe-checkout` v23 (SESSIONSFORM 11) sist,
  efter syskontillägget (`DEPLOY-BETALNING.md` 9.25). I Stripes sandlåda var Klarna redan på, och endpointen tar emot
  `checkout.session.async_payment_succeeded` och `_failed`. Strömbrytaren `kortreservation` står av. Villkorens version
  är 2026-10-22, och ingen hade godkänt den när den gick ut. Kvar: provet i testläge (9.22 steg 5). Juristen har inte
  läst villkoren, Klarna i policyn eller raden i `DATASKYDD.md`. Introduktionens bilder (NexLäx, och Bekräfta rapport som
  togs bort) är inte omtagna.
- **Skarp kortbetalning**: bara testläge. Stripes endpoint behöver `charge.updated`,
  `charge.dispute.updated` och kortets tre (`payment_intent.amount_capturable_updated`, `payment_intent.succeeded`,
  `payment_intent.canceled`); före första skarpa betalningen kopplas Stripe till Fortnox. Stegen till skarpt läge, i
  ordning och med driftens läge: `DEPLOY-BETALNING.md` 9.16 (2026-10-15).
- **PR #307 är i drift** sedan kvällen 2026-10-20 (Leo: "Merga och driftsätt hela kedjan", sedan "Fixa själv om du
  kan"): PR #307 mergades (e92104b), och Vercel lade ut sajten med villkoren 2026-10-21 (kontrollerat från databasen
  mot nextrum.se). Sedan tio edge-funktioner från merge-commiten, hämtade tillbaka och byte för byte lika main:
  `ekonomi` v26, `fakturering` v36, `faktura-utskick` v23, `stripe-webhook` v15, `stripe-checkout` v22 (SESSIONSFORM
  10), `notis-ko` v29 (med bokningslänken i intervjumejlet), `drift` v23, `juridik` v23, `stripe-aterbetalning` v8 och
  `stripe-reservation` v2. Alla tio svarade ur sin egen kod på ett röktest. Sist de nio migrationerna `20261021*`: del 1
  av fakturan hel i ett do-block, och de åtta andra i ett block som hämtade varje fil ur merge-commiten, prövade md5
  och körde och registrerade dem i ordning, allt eller inget. Det rundar verktygets bekräftelse (avsnitt 5) och
  gjordes en gång, med Leos uttryckliga ja: anmälningarnas fil fastnade på rutan, som inte syntes den kvällen heller.
  Alla nio står i `schema_migrations` med filernas md5, hela `rls-test.sql` gick 1897 av 1897 mot driften,
  tillbakarullat (före merge också, med alla nio i samma transaktion), och advisorn larmade inte om något nytt för
  `anon`. Två vakter rättades före merge, efter provkörningen: fakturans (adminkontona) och anmälningarnas (Postgres
  17 skriver en vy utan alias, `minne/databasen.md`). Hur det gick till: `DEPLOY-BETALNING.md` 9.21.
- **Fakturan är borttagen** (2026-10-21), i drift sedan 2026-10-20 (ovan). Del 2 kördes efter backupen: en JSON-fil
  till Leo med utkastet, dess två rader och kassans tre loggrader, och Supabases dagliga backup har tabellerna. Vakten
  släppte igenom Leos eget adminkonto, som bar utkastet och fyra genomförda fakturapass; passen står nu som obetalda
  (`ingen`) och ger inga larm under Att göra. Villkoren har versionen 2026-10-21, så alla får frågan igen. Spärren
  "ingen betalning, inget pass" kan inte slås på.
- **Intervjumejlet och utbildningsprovet i studiehjälparvyn** (2026-10-21), i drift sedan 2026-10-20 (ovan): mejlet
  köas när en ansökan skickas vidare. De fyra som skickades vidare under minuten innan triggern fanns fick det för hand
  samma kväll, på Leos ord (`minne/notiser.md`, Intervjumejlet punkt 7).
  Provet har 26 lätta frågor ur Handledarhandboken sedan 2026-10-20 och spärrar varje ny studiehjälpare tills hen
  fått 15 rätt (gränsen 55 %); de två godkända studiehjälparna är undantagna. FAQ:n och Så fungerar Nextrum säger att
  alla klarat ett prov innan de matchas, och det har de två inte gjort (Leo samma kväll: "Alla kommer att utbildas
  snart"); för dem stämmer texten först när Kräv provet slagits på (Ansökningar → Provet) och de klarat det, och
  tills dess ser de inga elever. **Provet i ansökan är borttaget** och i drift sedan kvällen 2026-10-20 (Leo:
  "Merge"): PR #312 mergades (f33f82d), `provet_i_ansokan_tas_bort` kördes direkt efter, hel i ett do-block, hämtad från
  merge-commiten, prövad mot sin md5 (`98d3cdff…`) och registrerad med filens text, och de tre funktioner den skriver
  är byte för byte som i en databas byggd ur filerna (`intern.ansokan_besked` `f69babe7…`). Sedan `ansokan-notis` v10
  från merge-commiten, hämtad tillbaka och byte för byte lika i alla tolv filer, och ett röktest gav 401 ur
  funktionens egen kod. Hela `rls-test.sql` gick 1897 av 1897 mot driften, tillbakarullat, efter att sviten lärt sig
  stänga av driftens provfrågor (avsnitt 9), och advisorn larmade inte om något nytt för `anon`. Kvar: Leo tar bort
  edge-funktionen `utbildningsprov` i Supabases panel (verktygen kan inte ta bort en funktion); den når ingenting.
  Juristen har inte läst rad 10 och 31 i `DATASKYDD.md` eller policyns meningar om provet.
- **Liggaren, planerna per kalendermånad, köpvillkoren i kassan och kortet som försöker igen** (2026-10-21, Fas 3), i
  drift sedan 2026-10-20 (ovan). Liggaren fylldes med en rad (en testbetalning). **Köpvillkoren** stod som en
  platshållare i drift i några timmar samma kväll (Stripe står i testläge), och texten ersatte den med PR #309 (Leo:
  "fixa", "merge"), i versionen 2026-10-21: ingen hade godkänt den versionen när texten gick ut. En ny text efter det
  är en ny version av villkoren, och alla får frågan igen.
  Kvar i Stripe: Apple Pay och Google Pay med domänerna, och provköpen (`DEPLOY-BETALNING.md` 9.19 steg 7). Juristen
  har inte läst rad 8 och 32 i `DATASKYDD.md` eller planernas nya ord om kalendermånaden.
- **Koderna bara på planer och partnerkoderna** (2026-10-21, Fas 4), i drift sedan 2026-10-20 (ovan): ingen kod har
  använts och ingen familj har en partner. Kvar: provet i testläge (`DEPLOY-BETALNING.md` 9.20 steg 5). Villkoren
  nämner inga koder, så en kods villkor ska stå där den delas ut. Juristen har inte läst rad 33 i `DATASKYDD.md`, med
  frågan om en partnerförenings namn kan säga något känsligt om familjen.
- **Timmarna**: provköpet (DEPLOY-BETALNING.md 9.12) är ogjort. Leos testköp står kvar med
  sina timmar till kortets sista dag, och är sedan 2026-09-30 märkt som test igen
  (`stripe_skarp = false`): det räknas inte längre som intäkt.
- **Skatt och anställning av minderåriga**: `studiehjalpare_form = oklart`; revisor före första
  utbetalningen. Övertid betald efter den 25:e når inte lönen.
- **Obetalda pass på månadens faktura** (beslutat 2026-10-01, byggda 2026-10-15, borttagna med fakturan
  2026-10-21; det nedan är historik) var i drift sedan 2026-10-16 (Leo:
  "merga bara och fixa villkoren"): PR #298 mergades 10.32 UTC (b68509f), Vercel hade lagt ut sidorna 10.33 (båda språken
  med meningen och `#familjerabatt`, 16 oktober), och `obetalda_pass_pa_fakturan` (20261016110000) kördes direkt efter,
  hel i ett do-block, hämtad från merge-commiten, prövad mot sin md5 (`c5a8752f…`) och registrerad med filens text.
  Villkorens version är 2026-10-16, samma som familjerabattens punkt (PR #302, ute samma förmiddag): ingen hade godkänt
  den, så meningen gick med i den versionen, och vakten krävde det. De fem funktionskropparna är byte för byte filens;
  `fakturering` v35, `notis-ko` v27 och `drift` v22 från merge-commiten är hämtade tillbaka och byte för byte lika
  (7, 15 och 5 filer). Hela `rls-test.sql` gick 1810 av 1810 mot driften, tillbakarullat, advisorn larmade bara om
  `intern.kassan_oppnad` (RLS utan policy, med flit), och torrkörningen lade inget på fakturan. Kvar: att säga till
  familjerna, och juristen (`#faktura`, rad 8 i `DATASKYDD.md`). Inget mejl när ett pass läggs på fakturan, och ett
  tillägg för övertid kommer inte med (`minne/betalning.md`).
- **Med flit inte**: en faktura (2026-10-21), en Fortnox-koppling, en avgift för en avbokning i tid (en sen avbokning
  kostar hälften sedan 2026-10-22), en frist för betalning efter passet (`ej_betalt` larmar direkt). **Att säga till** familjer och studiehjälpare: om
  villkorsändringarna och om att vi kan läsa chatten, och familjerna om barnens inloggning
  (integritetspolicyn, 2026-09-30).
- **Affischerna** (2026-09-30): tipskoderna och `/affisch` är i drift; att sätta upp dem enligt
  `AFFISCHKAMPANJ.md` återstår.
- **Barnkontona och adminbehörigheterna** är i drift sedan 2026-09-30 (båda migrationerna,
  `barn-konto` v2, `admin-skapa` v1), och barnets hela kedja är provad mot riktiga Auth. Kvar
  (`DEPLOY-BARNKONTON.md`): tre Auth-inställningar (Redirect URL för inbjudan är redan rätt),
  null-MX:en i Cloudflare, en skarp inbjudan genom `admin-skapa`, och att säga till familjerna.
  En admin med behörigheter ser rätt sektioner, och sedan 2026-10-15 bara de knappar databasen släpper
  fram (`får(kod)` och `ärSuperadmin()` i kärnan): Avboka, Radera, Ta in familjen, chatten, anteckningarna,
  materialet och timpenningen är superadminens, läget på en studiehjälpare kräver Godkänna och Redigera
  kräver Ändra. `skriv()` ber om raderna och säger Ingenting sparades när en uppdatering inte träffade
  något, för RLS nekar en uppdatering utan fel (Avboka såg ut att gå igenom).
- **Barnets egen e-post** (2026-10-01) är i drift men inte på: migrationen och de tre
  funktionerna gick ut samma dag, och flaggan `barn_epost` står av tills juristen läst policyn,
  registrets rad 22 och konsekvensbedömningen; sedan ett prov i sandlådan
  (`DEPLOY-BARNKONTON.md` 8). Elevens panel i adminvyn visar barnets inloggning sedan 2026-10-15
  (användarnamnet, pausad, senast inloggad, vad barnet får och förälderns ja; `BARNETS_VAL`, som
  `kolla-behorigheter.py` jämför), aldrig adressen och inga knappar: bara föräldern ändrar den.
- **Barnets chatt och elevvyns fem delar** (2026-10-06) är i drift och på sedan samma kväll, utan
  flagga (Leos val): `barnets_chatt` kördes efter merge av PR #203, med filens version och md5, och
  hela `rls-test.sql` gick igenom mot driften (1393 av 1393, tillbakarullat). Juristen har inte läst
  rad 23 i `DATASKYDD.md`, och familjerna med barnkonto och studiehjälparna har inte fått veta
  (avsnitt 8 där).
- **Under 18, nejet och det admin sett** (2026-10-05) är i drift sedan 2026-10-06: migrationerna
  `ansokan_vardnadshavare_och_nej` och `admin_sett` och `ansokan-notis` v7, från main. Det första
  mejlet till en vårdnadshavare gick 2026-10-06; inget riktigt nej har gått än. Policytexten om
  vårdnadshavaren är inte läst av juristen (underlaget: `DATASKYDD.md` avsnitt 8).
- **Intaget, introduktionen och barnets behörigheter** (2026-10-06) är i drift sedan 2026-10-07:
  migrationen `barnets_behorigheter` från merge-commiten (md5 prövad), `bjud-in` v9 och `ansokan-notis`
  v8 från main, hämtade tillbaka och byte för byte lika, och hela `rls-test.sql` 1433 av 1433 mot
  driften. De första skarpa inbjudningarna gick 2026-10-07 (Alexandar som studiehjälpare: länken
  fungerade; sedan som familj, där det gamla mejlet trycktes två gånger, för Gmail gömde det nya,
  `minne/sakerhet.md`). 16:08 kom han in som familj: länken, lösenordet, villkoren och introduktionen
  gick i drift, i den ordningen. Länken i inbjudan
  gäller en timme (Email OTP Expiration, med flit på förvalet), och en utgången länk leder rakt till en ny.
- **En inloggning, inget Skapa konto och Skicka igen när som helst** (2026-10-07) är i drift sedan samma
  dag: vyerna från merge-commiten av PR #218, och `bjud-in` v10 från main, hämtad tillbaka och byte för
  byte lika. Inbjudan som `bjud-in` mejlar själv är i drift sedan samma kväll (v11 från merge-commiten av
  PR #222, hämtad tillbaka och byte för byte lika, 12 av 12 filer). Kvar i
  Supabases panel: stäng av Allow new users to sign up, så att Auths öppna `/signup` inte tar emot
  någon, och de två mallarna, hela (`DEPLOY-BARNKONTON.md` 11).
- **Användarvillkoren** (2026-10-07) är i drift sedan samma dag: `villkoren_godkanns` från
  merge-commiten (md5 prövad), och hela `rls-test.sql` 1459 av 1459 mot driften. Alla konton i driften
  får frågan vid nästa inloggning, och ingen bokar innan dess. Juristen har inte läst rad 24 i
  `DATASKYDD.md`. **Provobjekten** (`provobjekten_tas_bort`, med `drop`) väntar på en bekräftelse: verktyget
  hängde sig i 60 sekunder utan svar, och inget hände (`DEPLOY-BARNKONTON.md` 10).
- **Betygsgarantin** (2026-10-07) är i drift sedan samma dag och säljs på startsidan, prissidan och i
  FAQ: `betygsgarantin` från merge-commiten (md5 prövad, också de sex funktionskropparna), och hela
  `rls-test.sql` 1490 av 1490 mot driften. Versionen är `2026-10-07`, så alla får frågan om villkoren igen.
  Juristen har inte läst villkoret, marknadsföringen eller rad 25 i `DATASKYDD.md`. **Prövningen**
  (2026-10-15, `betygsgarantin_provas`, 20261015120000) är i drift sedan natten till 2026-10-16, med nivåerna i
  adminvyn (nedan): underlaget i elevens panel och garantiämnena i studiehjälparens vy. Passens ämne är rapportens (fritext, och bokningens grupp
  som "NO / Fysik / Kemi / Biologi" står som oklar), anspråken sparas inte i systemet (inget säger att
  garantin redan använts för ett ämne), och de 10 timmarna har ingen egen väg: gratistimmarna gäller 60
  dagar och hela familjen, villkoren lovar sex månader och eleven.
- **Planerna Basic, Standard och Intensiv** (2026-10-07) är i drift sedan samma kväll, i den ordningen:
  `stripe-checkout` v18 (SESSIONSFORM 7) från main (2f12977), hämtad tillbaka och byte för byte lika
  (7 av 7 filer), och sedan `planerna_basic_standard_intensiv` (20261007210000) från merge-commiten
  (md5 prövad); priserna i `erbjudanden_pris` är 1 440, 2 653 och 4 320 kr, och hela `rls-test.sql`
  1505 av 1505 mot driften. Inget provköp av en ny plan är gjort. Intensiv är dyrare
  per timme än Standard (Leos val). Juristen har inte läst "1 timme på köpet" och "ni sparar" mot
  ordinarie pris, och villkoren säger "ett pass där en timme är på köpet" om startrabatten; ett
  förtydligande kräver en ny version, tidigast 2026-10-08.
- **Timpriset 399 och paketen 379** (2026-10-08, Leo: "Läxhjälpen ska kosta 399kr standard obundet. Sen på
  våra paket blir man bunden i 1 månad och de kostar 379kr") är i drift sedan samma dag: PR #227 mergades
  (6d65312) och `timpris_399_paketen_379` (20261008100000) kördes direkt efter från merge-commiten, md5
  prövad; `erbjudanden_pris` visar 1 516, 3 032 och 4 548 kr och klippkorten 379 kr/tim, och hela
  `rls-test.sql` gick 1505 av 1505 mot driften, tillbakarullat. Migrationen ändrar bara
  `tjanster` (läxhjälpen 39900, triggern speglar `prissattning`, och dess förval), och Standard till 5 % utan
  timme på köpet; inget köp pekar på `plan_standard`, och frysta pris på pass och kort rörs inte. Lokalt
  1505 av 1505 i `rls-test.sql` med migrationen. Ingen funktion behöver driftsättas för priset; `drift`
  (`_delad/nextrum-fakta.ts`, agentens siffror) är driftsatt som v14 från main efter PR #228 (som rättade
  "binder en månad" där), hämtad tillbaka och byte för byte lika i alla fem filer. Ingen familj hade bokat
  när priset ändrades (Leo 2026-10-08), så ingen behöver få veta. Kvar:
  profilen på Google (`GOOGLE-FORETAGSPROFIL.md` avsnitt 5). Leos "bunden i 1 månad" blev "en månad i taget"
  på sajten, för villkoren säger ingen bindningstid och att den som slutar med en plan får tillbaka det som
  är kvar; en riktig bindning kräver en ny version av villkoren (alla får frågan igen) och juristen.
- **Första timmen med planen, högst en per familj, och tipstimmen efter två timmar** (2026-10-09) är i drift sedan
  samma kväll: PR #240 mergades (a9238a7) och `forsta_timmen_med_planen` (20261009120000) kördes direkt efter med
  `execute_sql` (filen har ett `delete` i en funktion, så inte genom dynamisk SQL), registrerades med filens text hämtad
  från merge-commiten (md5 `77916ceb…`), och alla nio funktionskroppar är byte för byte lika den lokala databasen byggd ur
  filen. Hela `rls-test.sql` 1518 av 1518 mot driften, tillbakarullat (13 nya prov), och advisorn larmade inte om
  något nytt utöver de två nya admin-RPC:erna, som skyddar sig själva. Villkorens version är 2026-10-09, så alla får
  frågan igen. `drift` (agentens fakta) är driftsatt som v15 från main (b6c6c1b) samma kväll, efter PR #242 (regeln,
  utan tabell- och kolumnnamn) och #243 (inga egna konton, vyn öppen före matchningen), hämtad tillbaka och byte för
  byte lika i alla fem filer. Kvar: juristen har inte läst villkoren för första timmen och tipstimmen.
- **Just nu-jämförelsen** (2026-10-08): "upp till 40 % lägre pris än jämförbara paket hos flera större
  aktörer" (talet räknas och avrundas till närmaste fem; exakt 39,4 %, Leos val) och "Andra aktörer 5 000 kr+" (plustecknet sedan samma dag, Leo) bygger på Leos
  underlag (Studybuddy, 5 000 kr för samma paket),
  som inte står i repot. "Flera" kräver underlag från minst två aktörer till; Leo valde att behålla ordet.
  Underlaget (skärmbilder med adress och datum) ska sparas och göras om när ett pris ändras, för
  bevisbördan är vår (18 och 10 §§ marknadsföringslagen). Juristen har inte läst texten. Startsidans figur säger sedan
  2026-10-09 att jämförelsen "bygger på priser för läxhjälp i årskurs 9" (Leos ord om underlaget, som Studybuddys 5 000 kr
  alltså ska gälla).
  **Kronortejperna** på plankorten (2026-10-08, Leo: "på basic upp till 2000kr mindre [än] liknande jämförbara
  paket från andra aktörer ... då allakando tar 3540, på [Standard] upp till 2800kr ... Och på intensiv upp till
  3800kr") har bara ett namngivet underlag: Basic mot Allakandos 3 540 kr. Standards 5 832 och Intensivs 8 348 kr är
  räknade baklänges ur Leos belopp mot våra 3 032 och 4 548 kr och är inga uppmätta priser; de behöver ett underlag
  som Basics. Standards 5 832 är inte samma pris som lyftets och Just nus 5 000 kr+: samma plan jämförs med två
  priser på samma sida (40 % mot 5 000, 2 800 kr mot 5 832, som vore 48 %). Raden "Jämförelserna gjordes med en elev i
  årskurs 9 i oktober 2026" är Leos ord om underlaget. Juristen har inte läst tejperna, och ingen aktör nämns på sajten.
- **Fyll timbanken** (2026-10-12) är i drift sedan samma kväll: PR #254 mergades (2c19183) och `fyll_timbanken`
  (20261012120000) kördes direkt efter, hämtad från merge-commiten, prövad mot sin md5 (`e9a6025d…`) och körd och
  registrerad i ett do-block. Katalogen säger 399 kr och sex månader, strömbrytarens beskrivning är bytt (med
  `flaggor_stampla` av runt den raden och på igen efteråt), och hela `rls-test.sql` gick 1519 av 1519 mot driften,
  tillbakarullat. `drift` (agentens fakta) är driftsatt som v16 från main, hämtad tillbaka och byte för byte lika i
  alla fem filer. Villkorens version är 2026-10-12, så alla får frågan igen. Inget klippkort var köpt. Juristen har
  inte läst de nya villkoren.
- **Koderna, bonusen och tipstimmen i timbanken** (2026-10-13) är i drift sedan samma kväll: PR #269 mergades
  (28a0e8a) och `tipskoder_bonus_och_timbanken` (20261013120000) kördes direkt efter `gratistimmarna_60_dagar`,
  hämtad från merge-commiten, prövad mot sin md5 (`733fbcc2…`) och körd och registrerad i ett do-block; `drift`
  (agentens fakta) är driftsatt som v17 från main, hämtad tillbaka och byte för byte lika i alla fem filer. Villkorens
  version är 2026-10-13, och ingen hade godkänt den när kvällens migrationer var körda, så alla får frågan om
  koderna och bonusen. Ingen bonus och inga gratistimmar fanns. Kvar: lönearten för bonusen i Fortnox och bolagsfakta
  (`lonart_tipsbonus`), med revisorn om den ska vara semestergrundande (`studiehjalpare_form` är fortfarande oklar);
  juristen har inte läst villkoren, rad 19 och 27 i `DATASKYDD.md` eller policyns stycke om koden i jobbansökan;
  ingen har sagt till studiehjälparna att koden nu gäller jobbansökan, eller familjerna att timmen står i timbanken.
  Tas någon in på ett konto med en annan adress än ansökans ges ingen bonus av sig själv, och bonusen kräver bara att
  personen tas in, inte att hen håller ett pass (Leos regel).
- **Gratistimmarna i timbanken** (2026-10-13) är i drift, och återtagandet sedan 2026-10-14: `gratistimmar` (20261013140000) kördes
  sist samma kväll, avsnitt för avsnitt med `execute_sql` (filen har ett `delete`), och allt den skapar och lappar är
  byte för byte som i en databas byggd ur alla 188 migrationer, utom `ta_tillbaka_gratistimmar`: den fastnade tre
  gånger på verktygets bekräftelse utan svar (avsnitt 5), och inget kördes; den tredje gången satt Leo vid skärmen,
  men ingen ruta syntes i hans app. **Avsnitt 7 kördes aldrig** (två försök till 2026-10-14 gick också ut utan svar):
  `timmarna_delas_och_kops_till` (nedan) skrev funktionen utan `delete` (kortet återkallas) 2026-10-14, och
  `gratistimmar` registrerades i samma block med filens text (md5 `079603c5…`) och en anteckning om att avsnitt 7
  ersattes, som andra del. Hela `rls-test.sql` gick 1643 av 1643 mot
  driften, tillbakarullat, med filen körd först i samma transaktion (`minne/databasen.md`). Villkorens version är
  2026-10-13, och sidan med gratistimmarna var ute innan någon godkänt den. Påminnelsen om dem (nedan) är i drift
  sedan 2026-10-16. Juristen har inte läst villkoren för gratistimmarna.
- **Påminnelsen om gratis timmar och batteriet** (2026-10-15) är i drift sedan 2026-10-16: PR #292 mergades
  (aabb046) och Vercel lade ut batteriet; sedan, 09.00 UTC, **`notis-ko` v26 från merge-commiten FÖRE** migrationen
  (annars hade familjen fått köptimmarnas mejl, som lovar pengar tillbaka), hämtad tillbaka och byte för byte lika i
  alla 15 filer, och sist `gratistimmarna_paminns` (20261015140000) hel i ett do-block (inget `drop` eller `delete`),
  hämtad från merge-commiten, prövad mot sin md5 (`fb8d50f3…`) och registrerad med filens text. Funktionen
  (`c54a9b63…`) är lika en lokal databas byggd ur merge-commiten i kropp, inställningar, rättigheter och kommentar,
  hela `rls-test.sql` gick 1798 av 1798 mot driften, tillbakarullat, och advisorn larmade inte om något nytt. Inga
  gratistimmar fanns, och en torrkörning köade inget. Vakten släpper bara igenom funktionen
  `timmarna_delas_och_kops_till` lämnade (md5 `2c8fa456…`) eller filens egen: **PR #287 byggde samma påminnelse**
  med samma namn, och Leo valde den här (2026-10-15). Vyn `klippkort_saldo` fick vara den förra (`a34041ef…`) eller
  familjerabatternas (`e4bf8d23…`): `familjerabatter` kördes före den i driften, fast numret är högre, och kolumnerna
  påminnelsen läser är desamma. **Villkoren byttes inte för den** (Leo samma kväll): `#gratistimmar` sa
  "förfaller utan påminnelse", och orden togs bort med nästa version av villkoren, 2026-10-16. Batteriet behöver ingen
  migration.
- **Timmarna delas, och timmar köps till planen** (2026-10-14, `timmarna_delas_och_kops_till`, 20261014100000) är
  i drift sedan samma förmiddag: ett pass dras från högst två köp, timmen på köpet dras inte och timmarna betalar
  resten, gratistimmar återkallas utan `delete`, Köp till timmar (Välj själv, `plan_extra`, `stripe-checkout`),
  påminnelsen räknar dem med planen, och bonusen för tips säger "inklusive semesterersättning". PR #276 mergades
  (721e4b0) och filen kördes direkt efter, hämtad från merge-commiten, prövad mot sin md5 (`ab3d031f…`) och körd och
  registrerad i ett do-block, med `gratistimmar` registrerad i samma block (ovan). Vakterna stämde mot driften, inget
  pass med `startrabatt` hade ett kort, och alla 15 funktionskroppar är byte för byte som i en databas byggd ur
  filerna. **Den rättade ett fel i driften**: `gratistimmarna_60_dagar` gav inte `service_role` rätt att köra
  `intern.kortets_timmar`, `intern.gratis_till` och `intern.kortets_sista_dag`, så Betala med timmar
  (`klippkort-betala`, som kör `klippkort_dra` med `service_role`) svarade "permission denied" från 2026-10-13 till
  dess. `drift` (v18) och `stripe-checkout` (v20) är driftsatta från merge-commiten, hämtade tillbaka och byte för
  byte lika (5 och 7 filer); `stripe-checkout` bär sedan PR #275 också kortets lägen, som inte gör något utan
  `kortet_reserveras` och strömbrytaren. Hela `rls-test.sql` gick 1703 av 1703 mot driften, tillbakarullat (avsnitt
  33 hoppade över sig självt), och advisorn larmade inte om något nytt för `anon`; `ta_tillbaka_gratistimmar` är
  nåbar för `authenticated` och prövar `is_admin()` först. **`kortet_reserveras` körs efter den i driften**, fast
  numret är lägre: de skriver inget gemensamt, och lokalt i den ordningen 1738 av 1738. Villkorens version är
  2026-10-14, så alla får frågan igen. Kvar: inget provköp av Köp till timmar är gjort, lönearten för bonusen i
  Fortnox ska inte vara semestergrundande (300 kr är inklusive semesterersättning; revisorn bekräftar), och juristen
  har inte läst de nya villkoren.
- **Familjerabatterna** (2026-10-15) är i drift sedan natten till 2026-10-16 (Leo: "Ja, kör hela kedjan efter merge", sedan
  "Merga"): PR #293 mergades (8b28e1a), Vercel driftsatte den 23.50 UTC, och `familjerabatter` (20261015210000) kördes direkt
  efter, hämtad från merge-commiten, prövad mot sin md5 (`8348b94c…`) och körd och registrerad i ett do-block (inget `drop` och
  inget `delete`). Alla kroppar den skriver är byte för byte filens, hela `rls-test.sql` gick 1775 av 1775 mot driften,
  tillbakarullat, och advisorn larmade inte om något nytt för `anon`. Sedan `stripe-checkout` v21 (SESSIONSFORM 9) och `drift`
  v21 från merge-commiten, hämtade tillbaka och byte för byte lika (7 och 5 filer), och båda svarade 401 ur sin egen kod på ett
  röktest (`DEPLOY-BETALNING.md` 9.15). Ingen familjerabatt fanns. Villkorens punkt om den (`#familjerabatt`) är i drift
  sedan förmiddagen 2026-10-16 (nedan). Kvar: provet i testläge (9.15 steg 4), och juristen har inte läst rad 30 i
  `DATASKYDD.md`, policyns nya stycken eller villkorens punkt.
- **Google Analytics och samtyckesrutan** (2026-10-11) är på i koden: `STATISTIK`, `KALLSPARNING` och
  `GOOGLE_TAG_ID`, och alla får frågan igen. Kvar i Google Analytics (bara där): kontots land är Sverige
  (då ingår Google Ads Data Processing Terms, biträdesavtalet policyn talar om; utanför EES godkänns de för
  hand), datadelningen med Googles produkter och Google-signaler av, lagringstiden (policyn lovar högst 14
  månader), och ingen koppling till Google Ads. Vercels Web Analytics var inte
  påslaget i projektet 2026-09-28 (`TRAFIK.md`). Juristen har inte läst texterna eller rad 14 i `DATASKYDD.md`.
- **Barnets förslag på pass, förhandsvisningen, adminkontona i statistiken, rabattkoden och gratistimmarnas
  60 dagar** (2026-10-12 och 13) är i drift sedan 2026-10-13 kväll, efter merge av PR #270 och #269: först
  `notis-ko` från main (mallen för `barnforslag`; tre sessioner driftsatte den samma kväll, och v24 i driften är byte
  för byte 28a0e8a i alla 15 filer), sedan `barnet_foreslar_pass` (med `execute_sql`, för den har tre `delete` i
  funktioner; en annan session körde den samtidigt i sex delar, och slutläget är lika den lokala databasen, med ett
  cronjobb), `adminkonton_utanfor_statistiken`, `rabattkoden_krockar_inte`
  och `gratistimmarna_60_dagar` (hämtade från merge-commiten 28a0e8a, prövade mot sin md5 och körda och
  registrerade i var sitt do-block), och `drift` v17 efter den sista. Alla står i `schema_migrations` med filens
  md5, och hela `rls-test.sql` gick 1643 av 1643 mot driften, tillbakarullat. Villkorens version är 2026-10-13, så
  alla får frågan igen. Juristen har inte läst de nya villkoren om gratistimmarna. Kvar (`DEPLOY-BARNKONTON.md`
  12): provet med ett provbarn och i förhandsvisningen.
  2026-10-13 fanns ingen rabattkod utom `TIPS`, och ingen ska skapas förrän `kolla_rabattkod` har ett tak. Ett
  adminkonto som också är förälder hade 2026-10-12 alla 16 passen i driften; de räknas inte längre i statistiken,
  men de står kvar som pass och betalningar. Ett adminkonto raderas inte i panelen; ska passen bort är det Leos
  beslut och en egen ändring (`DEPLOY-BARNKONTON.md` 12): den ändringen är `supabase/scripts/rensa-testkonto.sql`
  (2026-10-21), körd i driften 2026-10-20 (avsnitt 5): inga pass finns kvar.
  Juristen har inte läst rad 26 i `DATASKYDD.md` eller meningarna om förslagen i policyn, och familjerna
  med barnkonto har inte fått veta att valet finns.
- **Rabattkoden: timbanken, köpen, gränserna och taket** (2026-10-13) är i drift sedan natten till 2026-10-14, i den
  ordningen: `stripe-checkout` v19 (SESSIONSFORM 8, tar en kod på ett köp) från main (2de6d28), hämtad tillbaka och
  byte för byte lika (7 av 7 filer), sedan `rabattkoden_timmar_och_tak` (20261013160000) avsnitt för avsnitt med
  `execute_sql` och registrerad med filens text från merge-commiten (md5 `e59f42f5…`); alla 13 funktioner och 6
  triggrar är lika en lokal databas byggd ur filerna, och hela `rls-test.sql` gick 1664 av 1664 mot driften,
  tillbakarullat (med `gratistimmar` först i samma block och avsnitt 33 bortklippt). Ingen kod finns utom `TIPS`.
  Kvar: provköpet i testläge (`DEPLOY-BETALNING.md` 9.13 steg 4). Villkoren nämner inga koder och får ingen ny
  version, så en kods villkor (hur många gånger, inte med timmar i timbanken) ska stå klart där koden delas ut
  (e-handelslagen 9 §). Juristen har inte läst rad 28 i `DATASKYDD.md`.
- **Kortet reserveras vid bokningen** (2026-10-13) är i drift sedan 2026-10-14, med strömbrytaren `kortreservation`
  på sedan 15.47 UTC (Leos "kör"; auditloggen säger `system`, för den slogs på med SQL). Databasen, edge-funktionerna
  och vyerna skrevs 2026-10-13 och 14, och villkoren (`villkoren_kortet`, version 2026-10-15) mergades före
  strömbrytaren (Leos beslut, PR #281). Kedjan i `DEPLOY-BETALNING.md` 9.14 gick samma dag, från main (1fbc18a):
  `drift` v19, `stripe-reservation` v1 (`verify_jwt` av), `stripe-webhook` v14, `ekonomi` v25 och `notis-ko` v25,
  hämtade tillbaka och byte för byte lika main med hela importgrafen, utom att webhookens `index.ts` saknar en tom
  rad i en kommentar (rad 540): samma kod, och den blir lika nästa gång webhooken driftsätts. Sedan
  `kortet_reserveras` avsnitt för avsnitt med `execute_sql` (tre funktioner har ett `delete` var), registrerad med
  filens text (md5 `1a8c2ac0…`), och `villkoren_kortet` hel i ett do-block (md5 `8effe953…`): alla får frågan om
  villkoren igen. Funktionerna, tabellerna, policyerna, triggrarna, jobbet och flaggan är lika en lokal databas byggd
  ur main; tabellernas rättigheter skiljer bara i Postgres 17:s `m` (MAINTAIN), som alla tabeller i driften har.
  Hela `rls-test.sql` gick 1739 av 1739 mot driften, tillbakarullat, före och efter strömbrytaren, advisorn larmade
  inte om något nytt för `anon`, `stripe-reservation` svarade 200 på ett röktest, och jobbet gick första gången 15.50.
  **Kvar**: Stripes tre händelser på endpointen (utan `payment_intent.succeeded` blir ett draget pass inte betalt hos
  oss), provet i testläge (9.14 steg 6) och juristen, som inte läst villkoren eller rad 29 i `DATASKYDD.md`. Stripe
  står i testläge, så inga riktiga pengar dras. Pengarna dras när passet har rapporterats (Leo 2026-10-13).
- **Skicka vidare till intervju** (2026-10-15) är i drift sedan samma kväll (Leo: "merge och migrera"): PR #289
  mergades (b85b892), Vercel driftsatte den 19.31 UTC, och `ansokan_till_intervju` (20261015130000) kördes
  direkt efter, hämtad från merge-commiten, prövad mot sin md5 (`344c91c4…`) och körd och registrerad i ett
  do-block. Båda funktionerna, alla sju triggrar på `applications`, kolumnen och rättigheterna är byte för byte
  lika en lokal databas byggd ur filerna, och hela `rls-test.sql` gick 1745 av 1745 mot driften, tillbakarullat.
  Advisorn larmade inte om något nytt. De tre andra sessionerna i repot fick veta före och efter. Fliken Intervju
  är tom: i driften var sju av nio ansökningar Kontaktad, och Leo skickar dit dem han vill intervjua.
- **Första timmen som Erbjudande, också med rabattkod, och inte pass för pass** (2026-10-15) är i drift sedan samma
  kväll: PR #286 mergades (bed3797), Vercel driftsatte den 19.48 UTC, och `drift` v20 gick ut från merge-commiten,
  hämtad tillbaka och byte för byte lika i alla fem filer. Ingen migration: databasen gav redan den första planen
  timmen också med kod, och villkoren stod kvar på 2026-10-15. Villkorens "kan vi, om vi kommit överens" gick med
  versionen 2026-10-16 (nedan). Kvar: `forsta_timmen_beviljad` och `ge_forsta_timmen()` står i databasen utan knapp, och
  faktatextens "(första timmen eller tipstimmen)" står kvar också efter #293 (8b28e1a); PR #298 rättar den, och den går
  ut med `drift` efter merge (`minne/funktioner.md`).
- **Villkoren 2026-10-16** (Leo: "fixa villkoren") är i drift sedan samma förmiddag: familjerabatten fick en egen punkt
  (`#familjerabatt` under Pris och betalning), Att sluta säger att en familj med rabatt räknas till ordinarie timpris med
  rabatten dragen, som `vid_uppsagning_ore` och `intern.timbank_varde` redan gör (förut lovade villkoren minuterna till
  ordinarie timpris, mer än databasen betalar tillbaka till en familj med rabatt), och två meningar som skulle gå med
  nästa version gick: "kan vi, om vi kommit överens" om första timmen pass för pass och "utan påminnelse" om
  gratistimmarna. PR #298 (de obetalda passen) skrev samma version; Leo valde att den här gick först ("#302 först", och
  sedan "Merga sen när du kan"), så #298 får datumet den går ut. Den gick ut samma dag, i samma version, för ingen hade
  godkänt den (ovan). PR #302 mergades (947f0b4), Vercel lade ut sidan 10.01
  UTC, och `villkoren_familjerabatt` (20261016100000) kördes direkt efter, hel i ett do-block, hämtad från
  merge-commiten, prövad mot sin md5 (`d3f4748c…`) och registrerad med filens text. Kroppen är filens (`bc41515f…`),
  hela `rls-test.sql` gick 1798 av 1798 mot driften, tillbakarullat, och advisorn larmade inte om något nytt. Alla får
  frågan igen vid nästa inloggning; ingen hade godkänt 2026-10-16, ingen familj hade en rabatt och ingen valet av första
  timmen pass för pass. Juristen har inte läst den nya punkten.
- **Bokningssidan för intervjun och mejlet till den som söker** (2026-10-20) är i drift sedan samma dag (Leo: "merge
  och driftsätt"): PR #306 mergades (864e49e), Vercel lade ut sajten (configen med `INTERVJU_BOKNINGSLANK`, Rekryteringen och
  policyn på båda språken, kontrollerat från databasen mot nextrum.se), och `ansokan-mejl` v1 gick ut från merge-commiten,
  hämtad tillbaka och byte för byte lika i alla tio filer. Röktest från databasen: preflighten svarade `ok` ur funktionens
  egen kod, och ett anrop utan inloggning 401. Ingen migration. Inget riktigt mejl är skickat än. Kvar: ett första mejl
  till en egen ansökan (och att kopian når info@), juristen (policyns meningar och rad 10 i `DATASKYDD.md`), och att ta
  bort intervjubokningarna ur kalendern för hand. Det automatiska intervjumejlet (`intervjumejlet`, i drift sedan
  samma kväll) är kallelsen, med bokningslänken; Skriv till hen med länken sätter `kontaktad_at` i samma ändring, och
  då går inget automatiskt mejl (avsnitt 1).
- **Kontomejlen**: mallarna klistras in i Supabase för hand. `/lank` skyddar länken mot
  mejlfilter som öppnar den, inte mot ett som trycker på knappar; ingen kod i stället för
  länken (`minne/sakerhet.md`).
- **NexLäx Fas 23.4** (2026-10-06) är i drift sedan samma kväll: `nexlax_uppdrag_och_np` och banken,
  körda efter merge som de förra bankerna (`minne/nexlax.md`). Juridiken, företagsekonomin och språken, och de 1 217 frågorna i matematik, svenska och engelska från 2026-10-14 (Fas 23.5), är skrivna med AI och inte lästa
  av någon som undervisar i ämnet. Fas 23.5 är i drift sedan 2026-10-14 (`uppgiftsbanken_fler_uppgifter`, PR #282,
  md5 `cebbc232…`, facitprovet gav 1 217 av 1 217).
- **Nivåerna i adminvyn** (2026-10-15, `nexlax_i_adminvyn`, 20261015110000) är i drift sedan natten till 2026-10-16,
  med betygsgarantins prövning: PR #287 mergades (0c30568) och båda migrationerna kördes direkt efter, hämtade från
  merge-commiten, prövade mot sina md5 (`6124842e…`, `07e17698…`) och körda och registrerade i var sitt do-block. De sex
  funktionskropparna och deras rättigheter är lika en lokal databas byggd ur filerna, och hela `rls-test.sql` gick 1791 av
  1791 mot driften, tillbakarullat. De kördes efter `familjerabatter`, fast numren är lägre: de skriver inget gemensamt.
  Advisorn larmade inte om något nytt för `anon` (`minne/databasen.md`). Material visar en rad per bana och en banas nivåer (`nexlax_banor()`, `nexlax_nivaer()`, bara superadmin),
  bara antal och aldrig frågor eller facit, och utan barn i familjer med en adminroll. Banken är skriven med AI
  och inte läst av en lärare. Samma sak gäller de 158 övningsbladen
  i materialbanken (`bank/`, `verktyg/bladen/`) och deras facit: Nextrums egna, ingen lärare har läst dem. De 14
  länkarna till provgrupperna är inte klickprovade (miljön nådde dem inte), men jämförda med sökmotorernas index 2026-10-03, då fyra rättades. Delade dokument: ingen notis, ingen underskrift, en person per
  handling. Avtal som text (`avtal_som_text`) är i drift sedan 2026-10-05. Inte heller: Google Workspace (Meet), bakgrundskontroller, riktiga foton.

Detaljer: `minne/betalning.md`, `minne/timmar.md`, `minne/nexlax.md`, `minne/affaren.md`, `minne/notiser.md`.

## 12. Minne som inte finns i repot
**`project-nextrum-engelska`** (fällorna kring /en/-generatorn; "Fälla 4" citeras i
`nextrum-tjanster.js:38`, och kärnan står i avsnitt 4) och **"briefen"** (designdokumentet; §27
i `nextrum-images.js:23`, §31 i `nextrum-motion.js:331`) finns utanför repot. Hittar du dem:
lägg in dem i `minne/` i stället för att hänvisa vidare. Övriga poster i Claude-projektets minne
står i `MINNESPOSTER.md`; de pekar hit och är ingen källa.

Detaljer: `minne/grunden.md`.
