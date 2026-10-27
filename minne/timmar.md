# Timmarna: planer, klippkort och timbanken

Arkivet för Fas 16.1, 21 och 22.1–22.4 ur avsnitt 1 och 11 i `CLAUDE.md`, ordagrant, och Leos
besked 2026-09-30 om testköpet. Gratistimmarna (2026-10-13) står efter köpta timmar. Reglerna står i kärnan, `CLAUDE.md`; siffrorna och
kortbetalningen i `betalning.md`. "Avsnitt N" i texten är kärnans.

---

## Köpta timmar (Fas 16.1 och 21)

**Timmar kan köpas i förväg (Fas 16.1).** Tre planer för en månad sedan
2026-10-07 (Basic 4 timmar, Standard 8 och Intensiv 12, alla −5 %, en månad i
taget, sedan 2026-10-08 (ingen bindning: villkoren säger ingen bindningstid), då Standard förlorade sin timme på köpet;
till 2026-10-07 två, 4 och 8 timmar, −10 %) och klippkort med 10–100 timmar (−5 %, gäller
6–18 månader). Köpet är ett engångsköp med kort, inget abonnemang.
Timmarna betalar sedan ett bekräftat pass med ett barn i stället för
kortet, av sig själva sedan Fas 22.2 (nedan). Flaggan `erbjudanden` är PÅ sedan 2026-09-27: Leo slog på den
innan provköpet i DEPLOY-BETALNING.md 9.12 var gjort. Står den av syns
priserna men inget går att köpa. Klippkorten står i studievyn och på prissidan som en kolumn
bredvid planerna som fälls ut (2026-09-27). De var borta ur
studievyn en förmiddag samma dag och kom tillbaka i den formen.

**Inget abonnemang, och köpen väntar på matchningen (2026-10-12).** Leo:
"på erbjudanden i studivyn ska man kunna köpa de med stripe. Eventuellt
ska planerna även gå att ta på autogiro eller någon automatisk betalning
varje månad med stripe. Köp knappen ska vara orange". Köpet fanns redan och
flaggan stod på; det Leo såg var låset före matchningen, för båda
föräldrakontona i driften, hans eget också, var omatchade (`S.väntar`, och
knappen grå). På frågan valde han:
- **Låset står kvar.** En plans månad börjar vid köpet, så en familj som
  köper medan vi letar studiehjälpare bränner timmar den betalat för. Ett
  provköp görs med ett konto som matchats under Familjer i adminvyn.
  Databasen och `stripe-checkout` prövar inte matchningen; det gör bara vyn.
- **Inget abonnemang nu**, bara engångsköp. Autogiro går inte genom Stripe
  (Stripe har inte Bankgirots autogiro), så det enda vore ett
  kortabonnemang. Ett abonnemang på timmar som går ut efter en månad är den
  modell som ger tvister (familjen betalar av sig själv för timmar den inte
  hunnit använda), och det kräver en ny version av villkoren på båda
  språken, en Säg upp i vyn, sparade kort hos Stripe (dataskyddet och
  policyn), juristen och skarp Stripe. Tas det upp igen: bestäm först om
  outnyttjade timmar följer med till nästa månad.
- **Köp är orange** (`.btn-orange` i `köpKnapp`), som Betala i förväg
  (`minne/vyerna.md`, Orange är inget läge).

**Plankortens text på prissidan (2026-10-08).** Leo: "på erbjudanden texten
ovanför priset ska de stå exempelvis på basic 4 timmar per månad, sen på
standard 8 timmar per månad och intensiv 12 timmar per månad, obundet för de
betalas som förköp där timmarna samlas som man sedan själv distruberrar ut
på lektioner under en månad". Raden ovanför priset är "**4 timmar per
månad**, obundet. Ni betalar timmarna i förväg och fördelar dem själva på
pass under månaden." (Hours per month, no commitment, på engelska), med
antalet i `data-erb-antal`; "Ett pass i veckan" och "en månad i taget" gick ur
korten. Obundet är sant mot villkoren: en plan är ett engångsköp som gäller
en månad från köpet, förnyas inte, och har ingen bindningstid. Studievyns kort
säger fortfarande "4 timmar · en månad i taget" (`erbKort`), som inte bad om
att ändras.

**Planerna heter Basic, Standard och Intensiv (2026-10-07).** Leo: "Ändra
namnet på standard planen till basic planen och namnet på intensiv planen
till standard planen. Och skapa en intensiv plan med 12 timmars läxhjälp
varje månad. Basic planen kan ha 5% rabbat, standard planen en timme på
köpet och intensiv planen 5% rabbat." På frågan svarade han att Standard är
8 timmar där familjen betalar för 7, och att Intensiv ska ha 5 % fast den då
blir dyrare per timme än Standard (360 mot i snitt 332 kr, och Basic +
Standard ger 12 timmar för 4 093 kr mot Intensivs 4 320). Med 379 kr i
timmen: 1 440, 2 653 och 4 320 kr. Basic blev dyrare än gamla Standard
(1 440 mot 1 364).
- Nya koder `plan_basic`, `plan_standard` och `plan_intensiv`. `standard`
  och `intensiv` stängdes (`aktiv = false`) och står kvar: Leos testköp
  pekar på `standard` med en FK utan ON UPDATE, och en kod som bytt innehåll
  hade låtit prissidan visa fyratimmarspriset i åttatimmarskortet mellan
  merge och migration. Katalogen är historik, som uppdragen i NexLäx.
- En timme på köpet är `erbjudanden.timmar_pa_kopet` (villkoret
  0 <= x < timmar), fryst i `klippkort.timmar_pa_kopet` och loggad i
  auditen. Aldrig en procent: en åttondel är 12,5 %, som inte ryms i
  heltalet `rabatt_procent`, och med timpriset nedåt till hel krona hade
  det blivit 2 648 kr i stället för 7 × 379.
- `timmar` är fortfarande alla timmar på kortet. Därför ändrades varken
  `klippkort_saldo`, `klippkort_dra`, ångerrätten (betalt / timmar) eller
  uppsägningen (använda timmar till ordinarie timpris).
- Kassans rad är "8 timmar läxhjälp för priset av 7 (1 timme på köpet)",
  och den säger aldrig "0 % rabatt" (`SESSIONSFORM` 7 i stripe-checkout).
- Studievyn läser vyn med `*` (tål att migrationen saknas: då ritas den
  gamla katalogen, som kassan då tar betalt efter) och lyfter fram planen
  med timmar på köpet; märket är "1 timme på köpet" och raden "8 timmar för
  priset av 7", aldrig ett snittpris ("ni sparar" på raden är borta sedan
  2026-10-12, `betalning.md`).
- Ordet "på köpet" betyder också startrabatten och tipstimmen. Villkoren
  säger att köpta timmar inte betalar "ett pass där en timme är på köpet"
  (startrabatten); ett förtydligande kräver en ny version av villkoren.
- **Första timmen i den första planen** (2026-10-09): den första plan en
  familj betalar får en timme till, i `timmar` och `timmar_pa_kopet`, och
  `forsta_timmen` sant (`minne/betalning.md`). Studievyns plankort säger
  "Er första plan: en timme till, gratis" så länge familjen inte fått sin
  timme, och det köpta kortet "första timmen gratis ingår". Klippkort får
  den aldrig.
- `rls-test.sql` avsnitt 25 (Planerna) och det omskrivna provet 16.1d.
- Prissidans plankort, lyftet bredvid starterbjudandet och startsidans Just
  nu (`#just-nu`, som 2026-10-08 ersatte lappen i #plattformen) döljs när
  koderna saknas i svaret (som före migrationen, som kördes 2026-10-07 efter
  `stripe-checkout` v18; `minne/databasen.md`). Just nu har inga av våra
  kronor i HTML, bara konkurrentpriset 5 000 kr. Leos testköp "Standardplan"
  syns bara i hans vy.

**Paketen kostar 379 kr i timmen (2026-10-08).** Leo: "Läxhjälpen ska
kosta 399kr standard obundet. Sen på våra paket blir man bunden i 1 månad
och de kostar 379kr". Timpriset blev 399 kr och rabatten stod kvar på 5 %
(399 × 0,95 nedåt till hel krona är 379), så paketen och klippkorten
kostar 379 kr i timmen: 1 516, 3 032 och 4 548 kr, och 3 790 kr för tio
timmar. Standard fick 5 % i stället för "8 timmar för priset av 7" och
lyfts fram på koden (Vårt tips) i stället för på timmen på köpet. Allt
som räknar en timme på köpet står kvar, för katalogen är historik och ett
köp med en timme på köpet kan finnas. Bindningen står på sidorna men inte i
villkoren (`betalning.md`, sista avsnittet); sedan 2026-10-09 inte på
sidorna heller (Leo: "inget är de"), och 399 kr heter "pass för pass". Siffrorna i stycket ovan är
de som gällde 2026-10-07.

**Märket och tejperna på paketen (2026-10-08, samma kväll).** Leo: "Ta bort
-5% på erbjudande skriv istället 399 streck över de, 379", och "på basic
upp till 2000kr mindre [än] liknande jämförbara paket från andra aktörer
... då allakando tar 3540", Standard 2 800 och Intensiv 3 800 kr, "som tejp
på erbjudanden". Märket på planerna och klippkorten, på prissidan och i
studievyn, är nu 399 kr överstruket och 379 kr, ur svaret, och varje
plankort på prissidan har en tejp med skillnaden i kronor mot ett
jämförelsepris, nedåt till hundratal, och en liten rad under om när
jämförelserna gjordes. Spara-raden säger planen ("med Intensivplanen":
Leo trodde att 1 440 kr var Basics). Hur det räknas och vad underlaget
är: `betalning.md`, Kronortejperna.

**Ett pass betalt med timmar avbokar familjen själv** (Fas 21.1), och
studiehjälparen kan också. Det har inga pengar på sig, och
`klippkort_saldo` räknar bara pass som inte är avbokade, så timmarna
kommer tillbaka av sig själva. Spärren för betalda pass gäller
fortfarande så fort det ligger kortpengar på passet. Nollningen av
betalningen (`klippkortspass_avbokat`) körs av triggern
`bookings_timmarna_tillbaka`, som måste vara den SISTA
before-triggern på `bookings`: körs den före `skydda_bokningsfalt`
ser spärren betalningen ändras i samma skrivning och nekar. Den hette
förut `bookings_klippkortspass_avbokat` och gällde bara admin.
**Tio dagar innan ett kort går ut** mejlas familjen om det finns
timmar kvar (Fas 21.2, notistypen `timmar_gar_ut`), och rutan Era
timmar säger samma sak från samma dag.

**Klippkorten heter Fyll timbanken (2026-10-12).** Leo: "klippkort ska heta
köp timmar till timbanken, de lägg ju in i timbanken. visa innan ändring de
ska kosta 399kr". Han fick se prissidan före och efter, och två invändningar:
till 399 kr är timmarna sämre än pass för pass (samma pris, betalt i förväg,
och de går ut), och timbanken heter i villkoren det som "inte går ut", så ett
namn med timbanken på timmar som förfaller lovar något de inte håller. Svaret:
"6 månader, fyll timbanken ska det heta. redovisa med en bild och en liten
text vad timbanken är för något också".
- Katalogen: `klipp10`–`klipp100` har 0 % rabatt och `giltig_manader = 6`
  (förut 5 %, och 12 och 18 månader för 60 och 100 timmar), och namnet
  "Fyll timbanken, N timmar", som är raden i Stripes kassa och på kvittot.
  Sorten heter fortfarande `klippkort`, och tabellen och koderna också.
- Prissidan (båda språken): rubriken Fyll timbanken (Fill the time bank),
  399 kr, ingen överstrykning och inget "Ni sparar", sex månader i alla
  kort, och en ruta under raden (`.pr-timbank`) med en bild (påfyllningen,
  burken, kalendern; ritad med sidans tokens, så den följer mörkt läge) och
  texten om vad timbanken är. Den säger det som skiljer: köpta timmar gäller
  i sex månader, sparade minuter går aldrig ut.
- Studievyn: kolumnen Fyll timbanken, och överstrykningen och "ni sparar"
  bara på ett kort som är billigare än timpriset. I Betalning heter ett pass
  betalt med timmar "Köpta timmar" och ett betalt med minuter "Sparade
  minuter" (förut "Timmar ur klippkortet" och "Timbanken", som nu hade
  betytt samma sak).
- Villkoren: "Planer och timbanken", timmarna till timbanken till ordinarie
  timpris, sex månader för alla, och timbanken rymmer både de köpta timmarna
  och de sparade minuterna. Version 2026-10-12, så alla får frågan igen.
- Adminvyn och resten (Leo samma kväll: "fortsätt med arbetet i alla andra
  ställen också ... anpassa de gamla grejerna om klippkort efter nya
  saken"): Betalningar → Köpta timmar heter "Planer och Fyll timbanken" och
  "Sparade minuter i timbanken", ett köp är ett köp och inte ett kort,
  strömbrytaren och raderingens hinder säger Fyll timbanken eller köpta
  timmar, och studievyn drar timmarna "från det köp som går ut först".
  Agentens fakta (`_delad/nextrum-fakta.ts`) har en rad om Fyll timbanken,
  utan tabellnamn. Strömbrytarens beskrivning i `flaggor` byts i migrationen
  med `flaggor_stampla` av runt den raden, som i
  `fas14_9_bokforingen_i_fortnox` (triggern skriver annars tillbaka den
  gamla texten och stämplar om datumet), och en kontroll efteråt att den
  är på igen.
  Koden, tabellerna, loggarna och `klippkort-betala` heter som förut.
- **Timbanken fylls på två sätt** (Leo samma kväll: "timbanken fylls antingen
  med plan eller förköpta timmarna, frågan är bara om hur man betalar och vad
  man klickar i. dvs om man köper plan eller lektion i förväg. om man köper
  lektion för lektion så betalas det per lektion enligt de reglern som redan
  finns"). Timbanken är alla köpta timmar, planernas och Fyll timbankens, och
  de sparade minuterna; pass för pass går inte genom den. Det första utkastet
  sade "köpta timmar gäller i sex månader", som inte stämmer för en plan.
  Prissidans ruta, villkoren, studievyn ("Er timbank" i stället för "Era
  timmar") och agentens fakta säger nu det, med en plans månad och Fyll
  timbankens sex månader var för sig. Samma version av villkoren, 2026-10-12:
  ingen hade hunnit godkänna den förra texten.
- **Tillgängliga timmar under Erbjudanden** (Leo samma kväll: "lägg till de
  även under erbjudanden, tillgängliga timmar och sedan ska man hänvisas till
  inställningar för att läsa villkor eller liknande"). Rutan Er timbank står
  alltid, också med noll timmar: summan av `kvar` på köpen som går att
  använda (timmar på förslag och bokade pass är redan dragna), de sparade
  minuterna, köpen var för sig, och en länk till Profil & inställningar →
  Timbanken. Den långa texten om minuterna gick därifrån, och fliken under
  Profil fick en ruta överst, Vad är timbanken?, med villkorslänken.
- **I drift 2026-10-12**, samma kväll: migrationen efter merge av PR #254,
  hela `rls-test.sql` 1519 av 1519 mot driften och `drift` v16
  (`minne/databasen.md` och `minne/funktioner.md`).

## Gratistimmar (2026-10-13)

**Admin sätter in gratistimmar i familjens timbank.** Leo: "när vi tar in en
familj ska vi kunna fylla deras timbank med önskade timmar som vi klickar in,
inte de. vi kan även sätta in gratis timmar som vi själva väljer när familjen
redan är inne i system". Han fick tre frågor och svarade: timmarna är gratis
också när familjen tas in (inte ett köp vi förbereder, inte Swish eller
faktura vid sidan av), de gäller i "60 dagar men de används först av alla
timmar om man har flera timmar", och det som blir över av en gratistimme
sparas inte (sparade minuter betalas tillbaka i kronor, och en gåva hade då
blivit pengar).
- **Det river beskedet 2026-10-09** ("MAXIMALT en timme gratis ... de kan spara
  genom timbanken men inte få gratis av oss"). Leo fick höra det, och att en
  gratistimme kostar lönen ändå: studiehjälparen får betalt för den tid som
  hölls (`passunderlag.lon_min`), hur familjen än betalade. Första timmen står
  kvar som den var, högst en per familj, och gratistimmarna räknas inte dit
  (`intern.forsta_timmen_tagen` är orörd), som tipstimmen.
- **En gåva är en rad i `klippkort`** med erbjudandet `gratis`, en katalograd
  som aldrig säljs (`aktiv` falsk, och villkoret `erbjudanden_gratis_saljs_inte`
  håller den så). Då gäller allt som finns för köpta timmar utan att något
  skrivs om: saldot, att timmarna betalar förslag och bokade pass av sig själva
  (Fas 22.2–22.4), Er timbank, Profil → Timbanken och Köpta timmar i adminvyn.
  `betalt_ore` är 0 och `betald_at` null (villkoret `klippkort_gratis_utan_betalning`):
  listorna över pengar (Betalningar, Översikt, Månadens ekonomi) tar köp efter
  `betald_at`, så gåvan står aldrig som pengar in, och `vid_uppsagning_ore`,
  `vid_anger_ore` och `angerfrist_till` blir 0 och null. `begart_ore` får inte
  vara noll (villkoret går inte att ändra utan en drop) och bär timmarnas
  värde till ordinarie timpris. Sorten är `klippkort`, `giltig_manader` 2
  (närmaste hela månad, läses inte) och `giltigt_till` i dag plus 60 dagar.
- **Först av alla timmar**: en annan session byggde samma dag att planens
  gratis timme går ut efter 60 dagar och dras först (`gratistimmarna_60_dagar`,
  nedan), och mergades först. Min migration körs efter den och lappar dess
  ordning: `(k.erbjudande = 'gratis' or <planens gratis timme kvar>) desc`,
  sedan kortet som går ut först, i `klippkort_dra` och `intern.timmar_betala`;
  studievyns `harGratis` räknar ett kort med gratistimmar som gratis. Ett kort
  med gratistimmar har `timmar_pa_kopet` 0 (villkoret kräver färre än
  `timmar`), så den modellens `gratis_kvar` och `gratis_till` är 0 och null
  för det: kortets egna `giltigt_till` är de 60 dagarna. Ett kort valdes då bara om det
  räckte till hela passet, så ett pass på tre timmar betalades med köpta timmar
  när två gratistimmar fanns kvar; sedan 2026-10-14 delas passet (sist i filen). **Risken med ordningen**, som Leo valt: har
  familjen en plan (en månad) och gratistimmar samtidigt tar gratistimmarna
  passen först, och bokar familjen för lite kan planens timmar gå ut obrukade.
  Påminnelsen tio dagar före och villkorens "hör av er, så betalar vi tillbaka
  resten" är skyddet. Åt andra hållet blir mer kvar av det betalda om familjen
  slutar eller ångrar sig.
- **Inga sparade minuter**: `intern.timbank_in` ger noll för ett pass betalt
  med gratistimmar, och frågar `intern.ar_gratistimmar()` (security definer),
  så att svaret är detsamma för en studiehjälpare som inte läser familjens kort.
- **Påminnelsen** (sedan 2026-10-15, `gratistimmarna_paminns`; förut ingen):
  `intern.timmar_gar_ut_koa` påminner om gratistimmarna tio dagar innan, med
  `gratis: true` i datan, och mallen lovar då inga pengar tillbaka (sist i
  filen). Förut hoppade den över dem, för mejlet sa "köpta timmar" och lovade
  att resten betalas tillbaka.
- **Inga villkor först**: `intern.kop_kraver_villkor` släpper en gåva, så den
  kan sättas in när familjen tas in, innan de loggat in. Timmarna betalar inget
  förrän familjen godkänt villkoren och föreslagit ett pass.
- **Sätta in**: `ge_gratistimmar(familj, timmar)`, 1–40 åt gången, bara
  `is_admin()` (sedan 2026-10-21 med orsak och månad, nedan). Efter insättningen betalar timmarna familjens obetalda förslag
  och bokade pass direkt (`intern.timmar_betalar_obetalda`, samma som jobbet
  `timmar-betalar`), och svaret säger hur många. Strömbrytaren `erbjudanden`
  gäller som för köpta timmar: står den av betalar timmarna inget.
- **Ta tillbaka**: `ta_tillbaka_gratistimmar(id)` tar det som inte ligger på
  ett förslag eller pass. Ligger timmar där krymper kortet till dem (och
  avbokas passet kommer timmen tillbaka som förut); ligger inga där togs kortet
  bort, efter att avbokade pass som bär det släppts. Auditen loggar nu också
  `timmar` och borttagningen (`klippkort_audit`). Den versionen kom aldrig in i
  driften (verktygets fråga syntes inte), och sedan 2026-10-14 återkallas kortet
  i stället (sist i filen).
- **Vyerna**: Ta in familjen har ett fält Gratistimmar i timbanken (0 som
  förval, bara när kontot skapas där; rutan för första timmen bredvid togs
  bort 2026-10-15), och kvittot säger
  hur många och till vilken dag. Familjens panel har raden Timbanken under
  Översikt och allt under Ekonomi: köpen och gratistimmarna kort för kort,
  de sparade minuterna, Sätt in (med en fråga till) och Ta tillbaka. Bara för
  en superadmin, som enda har köpen i `S.klippkort`. Betalningar säger
  Gratistimmar på ett pass de betalat, och Köpta timmar visar gåvan som
  Gratis. Studievyn kallar dem Gratistimmar från Nextrum ("gratis, från oss"),
  drar dem först, och Profil → Timbanken säger reglerna; Betalning säger
  Gratistimmar på passet. Koden `gratis` står en gång i JavaScript:
  `NXBetalning.gratistimmar(k)`.
- **Villkoren** (`#gratistimmar`, båda språken), integritetspolicyn,
  `DATASKYDD.md` rad 8 och agentens fakta säger det. Version 2026-10-13.
- `rls-test.sql` avsnitt 30 (17 prov, `GTB`). Lokalt, ur alla 187
  migrationer, 1620 av 1620. Utan lappen i ordningen faller tre av dem.
- **Villkorens version** är 2026-10-13, satt av `gratistimmarna_60_dagar`,
  som ändrade samma sida samma dag. Har den körts och någon hunnit godkänna
  2026-10-13 innan texten om gratistimmarna kom ut på sidan, har de inte
  sett den: byt då datumet på båda sidorna och skriv `villkor_version` i
  `gratistimmar` (`kolla-villkor.py`). Ingen hade godkänt 2026-10-13 när
  migrationerna kördes, och sidan var ute.
- **I drift 2026-10-13 kväll, och återtagandet 2026-10-14**: allt i
  `gratistimmar` är inne och lika en lokal databas ur alla migrationer.
  `ta_tillbaka_gratistimmar` (avsnitt 7) kördes aldrig, för verktygets fråga
  syntes inte; `timmarna_delas_och_kops_till` skrev den utan `delete`
  2026-10-14 (kortet återkallas, nedan), och filen registrerades då med en
  anteckning om avsnitt 7 (`minne/databasen.md`, Körda i driften).

## Timbanken (Fas 22.1)

**Det som blir över på ett timpass sparas i timbanken** (Fas 22.1,
2026-09-27). Klippkortet drar en timme per påbörjad timme, men sedan
Fas 20.1 kostar ett kortpass den hållna tiden per påbörjad kvart: ett
pass på två timmar som höll 1 h 15 drog två timmar ur klippkortet och
kostade 1 h 15 med kort. Familjen med rabatt betalade mer. Nu drar
klippkortet som förut, och resten upp till hel timme (45 minuter)
står i familjens timbank. Tre beslut av Leo samma dag:
1. **Bara köpta timmar fyller banken** (sedan 2026-10-13 aldrig gratistimmar,
   ovan). Ett kortpass som blev kortare
   får pengarna tillbaka (`betalt_for_lange`), som villkoren lovar. Ett
   tillgodohavande i stället för en återbetalning är sämre för
   familjen, och det var det som föreslogs först.
2. **Banken är familjens**, som klippkortet. Syskon delar den.
3. **Minuterna tar övertiden först, av sig själva, och kan betala ett
   helt pass.** Övertiden dras när rapporten skrivs
   (`intern.timbank_overtid`), innan någon ser ett tillägg, och bara på
   pass med ett barn. Räcker minuterna till det bokade går passet att
   betala med Betala med timbanken (`timbank_dra` genom
   `klippkort-betala`), och sedan Fas 22.2 betalar de det av sig
   själva när det bekräftas, sedan Fas 22.3 också när banken fylls på
   efter bekräftelsen. Utan det hade en familj vars pass ofta blir
   korta samlat minuter ingen använder, och det är pengar vi är skyldiga.
Insättningarna RÄKNAS ur passen (`intern.timbank_in`), uttagen LAGRAS i
`timbank_uttag`: övertiden beror på vad saldot var när rapporten skrevs,
och en senare insättning ska inte göra ett betalt tillägg onödigt.
`passunderlag.timbank_min` är övertiden banken tog; den räknas som
betald (`betalda_min`, och därmed lönen), och kassan och fakturan tar
`debiterade_min` minus den. **Minuterna går inte ut.** Slutar familjen
betalas de tillbaka till ordinarie timpris, samma pris som klippkortets
använda timmar räknas till då (`timbank_saldo.varde_ore`), och admin
markerar banken utbetald under Betalningar → Köpta timmar. Studiehjälparen
ser familjens minuter på passet, så att hen vet hur långt passet kan
dra över utan kostnad, men inte vad de är värda. Villkoren säger det
sedan samma dag (`#timbank`, båda språken). Familjen ser banken på två
ställen, ur samma hämtning: som en rad under Era timmar i Erbjudanden
(bara när det finns något), och under **Profil → Timbanken**
(`#profil/timbank`), där den står alltid, med vad som gått in och ut
rad för rad ur `timbank_rorelser`. Leo samma kväll: "timbanken ska
finnas i profil".

**Uttagen följer passet** (`timbanken_foljer_passet`, samma kväll).
Övertiden räknas i `intern.timbank_rakna_overtid` och räknas om när
rapportens tid rättas OCH när admin ändrar längden, antalet barn eller
undantaget (`bookings_timbank_foljer_passet`). Den räknas från det
bokade, eller från det kortet betalade om det var mer: ett kortpass som
betalades efter passet bär den hållna tiden minus det banken tog i
`stripe_minuter`, och banken ska inte ta de minuterna en gång till. Ett
helt pass ur banken drar den nya längden, så att banken alltid betalar
den tid som hölls. När kortet vinner över ett pass betalt med banken
skriver `timbank_kort_vinner` kortbetalningen och ger tillbaka
minuterna i samma transaktion; förut var det två anrop från webhooken.
Kassan skriver `vantar` bara på ett pass som fortfarande är obetalt, och
stänger annars sin nya session: förut kunde den skriva över ett pass som
hann betalas med timmar medan kassan skapades.

## Timmarna betalar passen (Fas 22.2 och 22.3)

**Timmarna betalar passen av sig själva (Fas 22.2, 2026-09-27).** Leo:
"köper man klippkorten eller timmarna i förväg innan bokade lektioner,
då kostar ej nästkommande lektioner som man har timmar för", och
"timbanken ska även inkludera klippkort". Förut betalade familjen varje
pass med Betala med timmar, och ett pass de glömt larmade som obetalt
med timmarna oanvända bredvid.
- **När ett pass bekräftas eller genomförs** betalar triggern
  `bookings_timmar_betalar` (`intern.timmar_betalar_passet`) det i samma
  skrivning: klippkortet som går ut först och räcker, som
  `klippkort_dra` väljer, annars timbanken när minuterna räcker till det
  bokade. Samma pass som knappen: ett barn, inte passet med första timmen
  bjuden, inte ett undantaget, och bara med flaggan `erbjudanden` på.
  Triggern kör efter `skydda_bokningsfalt` och `skydda_klippkortet`
  (namnordning), så betalningen prövas inte som en ändring från vyn, och
  före `bookings_timmarna_tillbaka`, som ska stå sist.
- **När ett köp blir betalt** betalar `klippkort_betalar_passen`
  (`intern.timmar_betalar_kommande`, efter `klippkort_betald`) familjens
  bekräftade obetalda pass från och med i dag, i datumordning, så långt
  de nya timmarna räcker. Ett pass som inte ryms hoppas över. Bara det
  nya kortet: att låsa familjens andra kort med köpet redan låst hade
  kunnat låsa fast mot en bekräftelse som låser i andra ordningen. Blir
  något fel skrivs köpet ändå och admin får en uppgift.
- **Ett pass med en påbörjad kassa (`vantar`) betalas också**, för en
  kassa som aldrig slutförts står kvar som `vantar` för alltid. Kassan
  stängs inte härifrån; betalar familjen den ändå vinner kortet och
  timmarna går tillbaka (webhooken, Fas 16.1).
- **Timmar som blir lediga betalar nästa pass inom fem minuter** (Fas
  22.3, Leo samma kväll: "se till att den funkar som den ska"). Fas 22.2
  betalade bara i de två ögonblicken ovan, så en timme som kom tillbaka
  när ett pass avbokades, eller när kortet vann, lämnade ett bekräftat
  pass obetalt bredvid timmen tills rapporten skrevs. Detsamma gällde
  timbanken som fylldes på och flaggan som slogs på. En trigger på
  avbokningen går inte: den körs i familjens eller studiehjälparens
  session, och `skydda_bokningsfalt` nekar då en betalning på ett annat
  pass. I stället kör pg_cron `timmar-betalar` var femte minut
  (`intern.timmar_betalar_obetalda`), som postgres, och låter samma val
  som triggern (`intern.timmar_betala`, utflyttat ur den) betala de
  bekräftade obetalda passen från och med i dag i datumordning. Jobbet
  väntar aldrig på ett lås (`skip locked` på passet, `nowait` på korten
  och banken), för det låser pass efter pass i en transaktion och hade
  annars kunnat låsa fast mot en bekräftelse. Knappen Betala med timmar
  står kvar och gör samma sak direkt.
- **Mejlen säger det.** `intern.betalsatt_kod` ger `timmar` till
  `notis_vid_pass` och `notis_planera`, och bekräftelsen och påminnelsen
  säger att passet är betalt med timmarna, med knappen till passet. Ett
  pass jobbet betalar får inget eget mejl; påminnelsen säger det.
- **Vid ånger eller när en familj slutar: avboka först ALLA kommande
  pass familjen inte vill ha, och deras förslag**, inte bara de
  timmarna betalat. `vid_anger_ore` och `vid_uppsagning_ore` räknar
  varje pass som inte är avbokat som använt, också ett som inte hållits
  och sedan Fas 22.4 också ett förslag, och sedan Fas 22.3 betalar en
  timme som blir ledig nästa pass inom fem minuter: avbokas bara det
  betalda passet flyttar timmen till nästa.

## Timmen dras när förslaget skickas (Fas 22.4)

**Timmen dras när familjen föreslår passet (Fas 22.4, 2026-09-28).**
Leo: "när man skickar ett förslag försvinner en av de förköpta timmarna
man köpt, om studiehjälparen inte kan den tiden och föreslår om är det
den timmen som fortfarande betalar av passet." Förut drogs timmarna vid
bekräftelsen, och ett förslag ägde ingen timme: bekräftades ett senare
förslag medan familjen funderade på ett motförslag, tog det senare
timmen. Migrationen (`20260928174612_fas22_4_…`) kördes minuten efter
att PR #105 mergats, i samma stund som föräldravyn gick ut: vyn räknar
inte längre bort väntande förslag, så utan migrationen hade Boka pass
lovat timmar som databasen inte dragit.
- **Förslaget betalas när det skapas.** `bookings_timmar_betalar_forslaget`
  (BEFORE INSERT, status `requested`) kör samma val som bekräftelsen.
  Namnet gör att den kör efter skydden och `bookings_startrabatt`: första
  timmen är avgjord innan timmarna väljer. Timbankens uttag skrivs i
  samma BEFORE INSERT, innan passets rad finns, och därför är
  `timbank_uttag_booking_id_fkey` `deferrable initially deferred`.
- **Timmarna går före en rabattkod** (2026-10-13,
  `rabattkoden_krockar_inte`): `bookings_timmar_betalar_utan_kod` kör
  efter de två triggrarna ovan och före `bookings_timmarna_tillbaka`, och
  tar bort koden från ett pass som timmarna betalar, när det skapas och
  senare. Allt om det i `minne/betalning.md`.
- **Timmen följer passet.** Ett motförslag ändrar bara tid, status och
  `created_by` (`skydda_bokningsfalt`), så betalningen ligger kvar, också
  när tiden flyttas förbi kortets sista dag, som för ett bekräftat pass
  som flyttas. `bookings_timmar_betalar` går också på `requested`: ett
  obetalt bekräftat pass som flyttas betalas som ett nytt förslag.
- **Ett nej ger tillbaka timmen**, som en avbokning (Fas 21.1): avböjt
  och tillbakadraget är avbokat.
- **Ett förslag som ingen svarat på när dagen gått lämnar tillbaka
  timmen** (`intern.obesvarade_forslag_slapper_timmarna`, först i jobbet
  `timmar-betalar`, oavsett flaggan). Utan det hade en timme legat kvar
  på ett förslag som aldrig blev ett pass. Hölls passet ändå betalar
  timmarna det igen när rapporten gör det genomfört.
- **Jobbet och köpet betalar förslag** som bekräftade pass, i
  datumordning. Ett förslag som skickas när timmarna tagit slut står
  obetalt tills timmar blir lediga eller köps.
- Boka pass räknar som databasen: ett kort som gäller dagen och räcker
  till hela passet, annars timbanken. Kvittot säger vad som drogs och
  att det följer med ett motförslag.
**Boka pass visar timmarna innan något är valt** (2026-09-28, Leo:
"innan du bokar ett pass ska det stå 4 av 4 timmar kvar"). Överst står
varje kort med timmarna kvar och sista dagen (`#boka-timmar`), och vid
knappen står "Era timmar, −1 timme, 3 kvar efter" i stället för
priset när timmarna räcker (`opts.timmar` i `NXArbete.bokning`).
Förslagen räknades bort här (`lovadeTimmar`) innan Fas 22.4; sedan
dess har de redan dragit sina timmar, och kvar står som databasen
räknat det. Passet med första timmen bjuden visar priset som förut:
timmarna betalar det inte.
Profil → Timbanken visar köpta timmar kort för kort, med passen varje
kort betalat ur vyn `klippkort_rorelser` (samma timmar som
`klippkort_saldo`), och de sparade minuterna under dem. `rls-test.sql`
slår av flaggan `erbjudanden` överst, så att proven som räknar med
obetalda pass inte får dem betalda, och på i blocken för 22.2, 22.3 och
22.4. Blocken för 22.2 som provar bekräftelsen slår på den först efter
förslagen, annars betalar förslagen sig själva. Blocken för 22.3 och
22.4 kör jobbet för familj P direkt i stället för att vänta på schemat.

---

## Gratis timmar gäller i 60 dagar och dras först (2026-10-13, `gratistimmarna_60_dagar`)

Leo 2026-10-13, efter `rabattkoden_krockar_inte`: "gratis timmar går ut
efter 60 dagar att de läggs in, planerna man köper går ut samma månad",
"gratis timmar går ut först sen planerna", om den första planen "så får
man gratis timmen inkluderad, alltså 9h vid köp av 8 exempelvis", och om
villkoren "fixa villkoren".

- **Planens gratis timme står kvar i planen** (`timmar_pa_kopet`, som
  `intern.planens_forsta_timme` lägger till när den första planen blir
  betald). Den dras först, så den är oanvänd bara så länge planen använts
  mindre än så. Planen går ut en månad efter köpet, som förut ("samma
  månad" lästes så, och villkoren säger "en månad från köpet"); en gratis
  timme som inte använts gäller sedan till 60 dagar efter köpet.
  `intern.kortets_timmar(till, betald, timmar, gratis, anvanda, dag)` säger
  hur många timmar ett kort räcker till en dag, och `klippkort_saldo` har
  `gratis_kvar` och `gratis_till` sist, och `brukbar` räknar med dem.
- **Gratis först.** `intern.timmar_betala` och `klippkort_dra` väljer först
  ett kort med gratis timmar kvar som gäller passets dag, sedan kortet som
  går ut först för den dagen (`intern.kortets_sista_dag`). Sedan
  `gratistimmar` (samma dag, ovan) räknas också ett kort med gratistimmar
  som admin satt in som gratis. Dagen är
  passets, aldrig före i dag. Jobbets förurval (`timmar_betalar_obetalda`)
  tar med en gratis timme efter planens månad. Vyn gör samma val
  (`kortetsTimmar`, `harGratis`, `kortFör`, `timmarFörFörslag`).
- **Tipstimmen och första timmen pass för pass** (som inte ges sedan
  2026-10-15, `minne/betalning.md`) är fortfarande ett avdrag
  på passet (`startrabatt`), inte en timme i timbanken, och gäller ett pass
  inom 60 dagar: tipstimmen från dagen den nya familjen haft sina två
  timmar (`intern.tipstimmar_oanvanda` ger sista dagen för var och en,
  ett pass med timmen tar den äldsta som gällde, och
  `intern.tipstimmar_kvar(familj, dag)` räknar), första timmen från
  `forsta_timmen_beviljad.beviljad_at`. `mina_tips()` har `kvar_till` och
  `forsta_timmen_lage()` `beviljad_till`, och priset vid knappen bjuder
  bara för en dag inom dem (`bjuden(minuter, dag)`).
- **Påminnelsen** (`timmar_gar_ut_koa`) räknar bara de timmar som går ut
  med planen; en oanvänd gratis timme gör det inte. Den påminns för sig sedan
  2026-10-15, tio dagar före sin egen sista dag (`gratistimmarna_paminns`,
  sist i filen); förut inte alls, för mejlet sa "köpta timmar" och att resten
  betalas tillbaka, och en gratis timme betalas aldrig ut.
- **Återbetalningen räknas som förut** (`vid_anger_ore`,
  `vid_uppsagning_ore`): en använd timme kostar, också den gratis. Hade
  den gratis timmen räknats först även där, hade en familj kunnat köpa
  planen, använda timmen och ångra köpet utan att betala något. Leo har
  inte bestämt det; frågan står öppen.
- **Kvar som förut**: en gratis timme räcker bara till pass med ett barn,
  som alla timmar, och ett pass på två timmar betalas av ett kort som
  räcker till båda. Har en familj med plan en tipstimme betalas resten av
  ett längre pass med kort, för timmarna betalar inte ett pass med
  `startrabatt`.
- **Villkoren** (#erbjudanden, #forsta-timmen, #tips) och prissidan och
  FAQ på båda språken säger det, och versionen är 2026-10-13, så alla får
  frågan igen. Agentens fakta (`_delad/nextrum-fakta.ts`) också, så `drift`
  driftsätts efter merge. Betygsgarantins timmar (sex månader i villkoren)
  rördes inte.
- **Prov**: `rls-test.sql` avsnitt 29 (17 rader), och de pass i tips- och
  första timmen-blocken som låg mer än 60 dagar fram flyttades inom dem.
  `prova-barnforslag.js` 3f och 3g.

---

## Ur avsnitt 11: driftsättningen och testköpet

- **Planer och klippkort (Fas 16.1) är öppna sedan 2026-09-27**, på
  Leos besked och INNAN provköpet var gjort. Stripe hade då bara körts i
  testläge, och det fanns två föräldrakonton. Funktionerna ligger ute:
  `stripe-webhook` (version 9) och `stripe-checkout` (version 13) är
  identiska med main, och `klippkort-betala` driftsattes då för första
  gången — den fanns inte i driften, så Betala med timmar hade fått 404.
  Provköpet i DEPLOY-BETALNING.md 9.12 är fortfarande ogjort och ska
  göras innan en riktig familj köper. Går något fel: stäng av flaggan.
  Sedan Fas 21 avbokar familjen själv ett pass betalt med timmar, och
  påminns tio dagar innan timmarna går ut. `notis-ko` med mallen för
  `timmar_gar_ut` är driftsatt (version 18, 2026-09-27, jämförd byte för
  byte mot repot). **Timbanken (Fas 22.1) är driftsatt samma dag, i
  databasen och i funktionerna**, i den här ordningen: `stripe-webhook`
  (version 10), `stripe-checkout` (version 14), `klippkort-betala`
  (version 2) och `fakturering` (version 31), var och en hämtad tillbaka
  och jämförd byte för byte mot grenen. Webhooken först, för en äldre
  lämnar minuterna dragna när kortet vinner; kassan före vyerna, för en
  äldre tar kort för övertid timbanken redan betalat. Funktionerna
  fungerar med de gamla vyerna, så knappen Betala med timbanken kommer
  när vyerna gör det. Samma kväll gick rättelserna ut
  (`timbanken_foljer_passet`, se avsnitt 1): `stripe-webhook` version
  11, `stripe-checkout` version 15 och `klippkort-betala` version 3,
  också de jämförda byte för byte, och därefter togs
  `timbank_kortet_vann` bort ur databasen, när ingen webhook längre
  anropade den. **Fas 22.2, samma kväll**: migrationen
  `fas22_2_timmarna_betalar_passen` är körd och `notis-ko` version 19
  driftsatt, jämförd byte för byte, i den ordningen: en äldre arbetare
  läser koden `timmar` som ingen kod och skriver det vanliga
  betalningsmejlet, så databasen kunde gå först. Inga köpta timmar
  fanns i driften då, så ingen familj fick ett pass betalt av
  ändringen. **Fas 22.3** (2026-09-28) är bara databasen:
  migrationen `fas22_3_lediga_timmar_betalar_nasta_pass` med jobbet
  `timmar-betalar`. Ingen funktion ändrades, och fortfarande fanns
  inga köpta timmar i driften. **Fas 22.4** (2026-09-28) är också bara
  databasen: migrationen `fas22_4_timmen_dras_nar_forslaget_skickas`,
  körd som `20260928174612` direkt efter att PR #105 mergats, och
  ordagrant filen (samma md5 som satserna i `schema_migrations`). Hela
  `rls-test.sql` gick igenom mot driften efteråt, 693 av 693. Då fanns
  ett betalt klippkort i driften, och inget förslag att betala.
  **Betala med kort nu** (2026-09-28, PR #106, avsnitt 1):
  `stripe-checkout` version 16 och `stripe-webhook` version 12,
  driftsatta från main efter mergen och jämförda byte för byte. De bar
  också 38a646e, som låg i main utan att vara driftsatt: ett skrivfel i
  webhooken ger Stripe ett nytt försök, en betalning som inte blev
  nedskriven blir en uppgift, och kassan stänger passets förra session. Kvar: en familj som inte är matchad når inte
  Erbjudanden (föräldravyn är låst till dess), så timmar köps först
  efter samtalet och matchningen.

- **Det enda köpet av timmar är märkt skarpt fast det gjordes i
  testläge** (2026-09-29). Leo: "jag behöver se hur det ser ut när
  någon faktiskt köper klippkort, från vår admins sida". Köpet är Leos
  egen Standardplan, 4 timmar för 1 364 kr den 28 september, och
  `stripe_skarp` sattes till true för hand. Det räknas därför som pengar
  in i september, i Översikt och Månadens ekonomi, fast inga pengar kom
  in. Ingen trigger och ingen auditrad följer kolumnen, så det syns bara
  här. Bokslutet (`manad_lage()`) räknar inte köpta timmar, så en
  stängd september fryser inte talet, och webhooken skriver bara om
  kolumnen på ett köp som inte är betalt. **Det ska tillbaka när Leo
  sett det**: `update public.klippkort set stripe_skarp = false where
  id = '9f4f87ae-6c14-430d-a87c-61bef5d09a82';`, och sedan bort härifrån.

  **Leo 2026-09-30: klippkortet dras inte tillbaka.** Timmarna gäller
  till kortets sista dag, som hos varje kund. Uppdateringen ovan rör bara
  märkningen `stripe_skarp`, alltså om köpet räknas som pengar in i
  Översikt och Månadens ekonomi, aldrig kortet eller timmarna, och den
  körs inte utan att Leo ber om just den.

  **Leo samma kväll bad om den ("fixa de")**, och den kördes 2026-09-30:
  köpet är märkt som test igen och räknas inte längre som pengar in i
  september. Kortet, dess fyra pass och timmarna är orörda.

---

## Timmarna för tips i timbanken (2026-10-13)

Leo: "timmarna läggs in i timbanken för familjerna". Tipstimmen (en per ny
familj som anmält sig med familjens kod och haft två timmar läxhjälp,
`minne/affaren.md`) står sedan dess i timbanken, i vyn. Den är aldrig
pengar: den betalas inte tillbaka när familjen slutar och ingår inte i
`vid_uppsagning_ore`.

- **Regeln är `gratistimmarna_60_dagar`s** (samma dag, Leo: "gratis timmar
  går ut efter 60 dagar att de läggs in", "gratis timmar går ut först sen
  planerna"): timmen gäller i 60 dagar från dagen den nya familjen haft sina
  två timmar och dras först, som ett avdrag på nästa läxhjälpspass
  (`forsta_timmen_bjuds`, `intern.tipstimmar_kvar`). Ett pass med timmen
  betalas inte med köpta timmar (Fas 22.2); resten av ett längre pass
  betalas som pass för pass. Avbokas passet kommer timmen tillbaka, till
  samma sista dag.
- **Grenen hade först en annan regel.** `tipskoder_bonus_och_timbanken`
  drog timmen sist (en egen trigger efter timmarna) och lät den aldrig gå
  ut, för att en familj med plan annars betalar resten av passet med kort
  medan planens timmar går ut. Main fick Leos 60 dagar och "gratis först"
  innan grenen var mergad, och det är hans senare ord, så den regeln ströks
  vid sammanslagningen. Problemet med kortet står kvar: vill Leo att köpta
  timmar betalar resten av ett pass med tipstimmen är det Fas 22.2 som ska
  ändras, inte ordningen.
- **Den är ingen rad i `klippkort`.** Det hade gjort den till ett köp (0 kr
  i Köpta timmar, ångerrätten, uppsägningen och avstämningen). Den räknas
  ur raderna som förut (`intern.tipstimmar_intjanade`,
  `intern.tipstimmar_oanvanda`), och `mina_tips()` svarar med `kvar` (de som
  gäller i dag) och `kvar_till` (sista dagen för den som gäller längst).
- **Vyn**: Er timbank under Erbjudanden säger "och N timmar för tips" och
  har ett kort Timmar för tips med en mätare och sista dagen; Profil →
  Timbanken har samma kort under Timmar, med passen timmen använts till, och
  Vad är timbanken? säger det. Boka pass visar timmen i förväg som förut
  (`bjuden(minuter, dag)`, inom `kvar_till`).

## Timmarna delas, och timmar köps till planen (2026-10-14, `timmarna_delas_och_kops_till`)

Leo 2026-10-13 kväll: "tipstimmen används också före planerna då den är
gratis. man kan köpa till timmar med plan men de går ut när månaden är slut.
man ska kunna välja hur många timmar man köper, det ska finnas välj själv
knapp och checkout för de specifika timmarna". Fyra frågor, och han valde de
rekommenderade svaren: timmarna till planen kostar planens timpris (379 kr),
Välj själv finns bara för att köpa till en plan (inte för Fyll timbanken), 1–20
timmar som går ut samma dag som planen; tipstimmen först och planen resten;
och ett pass får delas mellan gratistimmarna och planen.

- **Högst två köp per pass.** `bookings.forsta_klippkort_id` och
  `forsta_klippkort_timmar` (1–2) är det som drogs först, och `klippkort_id`
  resten, som förut. `intern.timmar_fordela(familj, dag, behov, utom)` väljer:
  korten i samma ordning som förut (gratis först, sedan det som går ut först,
  sedan köpdagen); räcker det första till hela passet dras bara det, annars
  allt som är kvar på det och resten från det första kort i ordningen som
  räcker till resten. Två kort räcker till tre timmar; behövs tre betalas passet
  som förut. Villkoren `bookings_forsta_kortet_paret` och
  `bookings_forsta_kortet_med_kort` håller paret ihop och skilt från
  huvudkortet, och `intern.forsta_kortet_foljer` (BEFORE UPDATE) nollar det
  första kortet när huvudkortet blir null (ett obesvarat förslag, kortet som
  vann i webhooken). Skyddstriggern på `bookings` prövar alla tre kolumnerna.
- **Bakifrån.** Blir passet kortare än bokat kommer timmarna tillbaka från
  huvudkortet först: första kortet har använt `least(forsta_klippkort_timmar,
  a)` och huvudkortet resten, där a är passets korttimmar. Samma uttryck står i
  `intern.kortets_anvanda`, `klippkort_saldo` och `klippkort_rorelser` (vyerna
  är security_invoker och läses av familjen, så uttrycket står i dem i stället
  för hjälparen). Gratistimmarna är då de som använts.
- **Timmen på köpet.** `intern.passets_korttimmar(b)` är varje påbörjad timme
  minus en när `startrabatt` (tipstimmen eller första timmen pass för pass).
  Ett pass på en timme med timmen på köpet drar inget, och `klippkort_dra`
  säger "Timmen på köpet täcker hela passet". Timbanken (minuterna) betalar
  fortfarande bara hela pass utan timme på köpet: en kortbetalning för resten
  av ett pass med en gratis timme finns inte heller, så en familj som betalar
  pass för pass betalar resten med kort som förut.
- **De sparade minuterna.** `intern.timbank_in` räknar med korttimmarna: noll
  när timmen på köpet täckte allt, och noll när den sista timmen kom från ett
  kort med gratistimmar (det första kortet om passet inte drog längre än dess
  timmar).
- **Köpet betalar med alla kort.** `intern.timmar_betalar_kommande` (när ett köp
  blir betalt) använder samma val som annars, också pass med en timme på
  köpet, och inte längre bara det nya kortet. Rls-testets block 4 och 5 i
  avsnitt 22.2 låter därför c16a ha gått ut.
- **Gratistimmar återkallas.** `ta_tillbaka_gratistimmar` sätter
  `klippkort.aterkallad_at` när inga timmar ligger på något pass, i stället för
  att radera kortet: ett pass kan peka på kortet som första kort, historiken
  ska stå kvar, och verktygets fråga för en funktion med `delete` syntes inte i
  Leos app (`minne/databasen.md`). Ett återkallat kort har inget kvar, är inte
  brukbart, och familjens vy visar det inte. Villkoret
  `klippkort_aterkallad_bara_gratis`; auditen loggar `aterkallad_at`.
- **Köp till timmar.** En rad i `klippkort` med erbjudandet `plan_extra` (en
  katalograd som aldrig säljs, villkoret `erbjudanden_extra_saljs_inte`) och
  `till_plan` (villkoret `klippkort_till_plan_bara_extra`). Priset räknas i
  `extra_timmar_erbjudande(timmar)`, som den inloggade frågar själv (kassan med
  familjens token): den senaste betalda planen som gäller minst en dag till,
  dess eget timpris och rabatt (`floor(timpris × (100 − rabatt) / 10000) × 100`,
  samma som `klippkort_saldo.rabatterat_timpris_ore`), aldrig katalogens, så en
  prishöjning gäller inte en köpt plan. `stripe-checkout` skapar köpet med
  `service_role` och samma kassa som de andra (`köpTimmarTillPlanen`, planens
  sista dag i idempotensnyckeln), och `klippkort_betald` ger timmarna planens
  sista dag; kom betalningen efter den gäller de i dag och admin får en
  uppgift. De får ingen gratis timme (sorten är `klippkort`, så
  `planens_forsta_timme` hoppar över dem), och påminnelsen tio dagar före
  räknar dem med planen (ett mejl om dagen, inte ett per köp).
- **Vyn.** Er timbank har rutan Köp till timmar när familjen har en plan som
  gäller: Välj själv öppnar ett val av 1–20 timmar (två som förval) med stegknappar
  på 44 px, priset och planens sista dag, och Till kassan (orange, ett köp)
  öppnar samma inbäddade kassa som planerna (`köpIKassan`). Förslaget i Boka
  pass speglar valet (`fördela` i `nextrum-studie-vy.js`, och `o.timmar` får
  veta att en timme är gratis), Betala med timmar säger båda köpen, och
  Betalning läser vilka köp ett pass drogs från ur `klippkort_rorelser`, för
  passens kolumnlista får inte nämna en kolumn som saknas före migrationen.
- **Rättelsen.** `gratistimmarna_60_dagar` gav inte `service_role` rätt att
  köra `intern.kortets_timmar`, `intern.gratis_till` och
  `intern.kortets_sista_dag`, och `klippkort_dra` körs med `service_role`
  (`klippkort-betala`). Betala med timmar svarade därför "permission denied"
  för varje riktigt pass sedan 2026-10-13. Hjälparna här får samma rätt, och
  `rls-test.sql` avsnitt 34 kör funktionen som `service_role`.
- **Prov.** `rls-test.sql` avsnitt 34 (33 prov, `TD`), och tolv äldre prov
  skrivna om till den nya regeln (19.5, 22.2 block 4 och 5, 22.4, Tips, GT,
  GTB B och C). Lokalt ur alla 191 migrationer: 1738 av 1738, och i driftens läge
  (till och med `rabattkoden_timmar_och_tak`, utan återtagandet och `kortet_reserveras`, och filen ovanpå)
  1703 av 1703, där avsnitt 33 hoppar över sig självt med en rad. Med `kortet_reserveras`
  körd efter filen, som den kommer att köras i driften: 1738 av 1738. Webbläsarprovet
  `prova-barnforslag.js` 3i (tio prov): timmen på köpet med timmar, två köp på
  ett pass, Välj själv, telefonen och kassans kropp (erbjudandet och antalet,
  aldrig ett pris).
- **I drift 2026-10-14** (`CLAUDE.md` avsnitt 11, `minne/databasen.md`), och
  Betala med timmar svarar inte längre "permission denied". Kvar: ett provköp
  av Köp till timmar, och att juristen läser villkoren.

## Gratis timmar påminns, och batteriet (2026-10-15, `gratistimmarna_paminns`)

Leo 2026-10-15: "fixa påminelse. i timbanken kan du göra en animerad bild
som ändras beroende på hur många timamr. så typ som ett batteri bara att
orange timmar är köpta och gratis är gröna. sen kan det stå 9av 9 timmar
finns kvar".

- **Påminnelsen.** `intern.timmar_gar_ut_koa` har fyra delar i en `union
  all`: köpta timmar som förut (med timmarna köpta till planen), gratistimmar
  vi satt in (`erbjudande = 'gratis'`), planens gratis timme när den gäller
  efter planen (`gratis_till > giltigt_till`; går de ut samma dag räknas den i
  planens mejl, som förut) och tipstimmarna (`intern.tipstimmar_oanvanda`, en
  rad per familj och sista dag, bara för familjer med en kod och ett konto som
  inte är raderat). De gratis får `gratis: true` i datan. En påminnelse per kort
  och sista dag, som förut; planens gratis timme har planens id men en senare
  dag, och tipstimmarnas har inget kort (`klippkort` saknas i datan,
  idempotensnyckeln slutar på `:tips:<dag>`). Ett återkallat kort har inga
  timmar kvar i `klippkort_saldo` och påminns aldrig.
- **Utan studiehjälpare** (`profiles.match_status` inte `matched` eller ingen
  `matched_tutor_id`, som `S.väntar`) kan familjen inte boka, och ett mejl om
  att boka vore fel. Gratistimmar kan sättas in redan när familjen tas in, före
  matchningen. Då blir det en uppgift till oss (`skapa_uppgift`, nyckeln
  `gratistimmar_utan_hjalpare:<kort>:<dag>`, för tipstimmarna `tips:<familj>` i
  stället för kortet, förfallodag sista dagen): matcha familjen, och för
  gratistimmar vi satt in också "ta tillbaka timmarna och sätt in nya". Den
  kommer en gång per kort och dag, också efter att den klarmarkerats
  (`skapa_uppgift` släpper annars en ny när den gamla är klar), och får familjen
  en studiehjälpare innan dagen går mejlet vid nästa körning. Köpta timmar
  påminns som förut, också utan studiehjälpare: det mejlet erbjuder pengarna
  tillbaka, och det går utan att boka.
- **Två sessioner byggde samma påminnelse** samma kväll: PR #287
  (`20261015100000_gratistimmarna_paminns`) och den här (#292,
  `20261015140000`). Leo valde en, den här, med #287:s uppgift utan
  studiehjälpare intagen och utan villkorsbytet. Vakten släpper bara igenom
  driftens funktion (md5 `2c8fa456…`) eller filens egen (`c54a9b63…`), för båda
  funktionskropparna innehåller ordet `gratistimmarna_paminns`, och den gamla
  vakten (som letade efter ordet) hade låtit den som kördes sist skriva över
  den andra utan fel.
- **Mejlet** (`mallar.ts`, `timmar_gar_ut`): med `gratis` "Era gratis timmar
  går ut …" (eller "Er gratis timme"), att de används först, och att de
  förfaller och inte betalas ut. Inget om pengar tillbaka: det löftet är de
  köpta timmarnas. `RenData.gratis` är sant bara för `true`; allt annat ger
  köptimmarnas mejl, hellre löftet en gång för mycket än att en familj som
  betalat inte får det. Foten säger "timmar som går ut", och valet under
  Profil → Notiser heter Timmar som går ut.
- **Ordningen i driften**: `notis-ko` först, sedan migrationen. Utan den nya
  mallen får familjen köptimmarnas text om en gåva. `familjerabatter`
  (20261015210000, #293) kördes i driften före den här, fast numret är högre,
  och skrev om `klippkort_saldo` (familjerabatt_ore sist, vid_uppsagning_ore
  räknad med den). Vakten godkänner båda vyerna (`a34041ef…` och `e4bf8d23…`),
  för kolumnerna påminnelsen läser är desamma; lokalt gick hela `rls-test.sql`
  1798 av 1798 i båda ordningarna, med #287:s två migrationer före.
- **I drift 2026-10-16.** PR #292 mergades 00.28 UTC (aabb046), och Vercel
  lade ut batteriet. Sessionen startades sedan om och låg nere i över åtta
  timmar, så `notis-ko` v26 gick ut först 08.59 UTC, från merge-commiten och
  byte för byte lika i alla 15 filer, och migrationen 09.00, hel i ett do-block
  (`minne/databasen.md`). Under natten sa Profil → Notiser redan "köpta eller
  gratis timmar" medan databasen bara påminde om köpta: inget gick fel, för
  inga gratistimmar fanns. En torrkörning i driften efteråt (rullad tillbaka)
  köade inga mejl och inga uppgifter.
- **Villkoren** sa att gratistimmar "förfaller utan påminnelse"
  (`#gratistimmar`). Orden skulle tas bort i nästa version, inte i en egen (Leo
  2026-10-15, på förslaget från #287): alla har fått frågan om villkoren nästan
  varje dag sedan 2026-10-07, och en påminnelse till är inget familjen förlorar
  på. De togs bort med versionen 2026-10-16 (familjerabatten,
  `minne/betalning.md`), och villkoren lovar ingen påminnelse om gratistimmar;
  för köpta timmar lovar de ett mejl tio dagar innan.
- **Batteriet** (`nextrum-studie-vy.js`, `batteriTimmar`, `fyllBatteri`,
  `sättBatterier`) står överst i Er timbank och under Profil → Timbanken. En
  ruta per timme i det som gäller nu: köp som inte gått ut (med de använda
  tomma), planens gratis timme efter planen, och timmarna för tips (en använd
  så länge passet är högst 60 dagar gammalt, en ungefärlig regel: vyn vet inte
  vilken dag timmen tjänades in). Köpta orange, gratis mossa, närmast de tomma,
  för de dras först. Över 24 timmar en stapel. "N av M timmar kvar", och en
  rad med köpta och gratis. Skriptet sätter klasserna och `--d`, CSS rör sig:
  rutorna fylls i tur och ordning första gången batteriet syns
  (IntersectionObserver), och bara de som ändras byter färg sedan. Batteriet är
  samma element mellan omritningarna, annars fylldes det om från tomt varje
  gång rutan ritades om (tipsen kommer, Välj själv öppnas). Kortens mätare har
  samma färger: köpta orange, gratis mossa. Orange bar förut bara Betala i
  förväg och Köp (`minne/vyerna.md`).
- **Prov.** `rls-test.sql`: GTB E (utan studiehjälpare en uppgift och inget
  mejl, en gång också efter klar; med studiehjälpare påminns gratistimmarna,
  märkta, en gång; köpta som förut; ett återkallat kort inte), GTB F (planens
  gratis timme) och två prov efter GT G (tipstimmen utan och med
  studiehjälpare). Vakten provades mot #287:s funktion och stoppade. Lokalt ur
  alla 195 migrationer 1756 av 1756. Deno: `typer_test.ts` och
  `rendera_test.ts`. Batteriet provades i förhandsvisningen med påhittade köp
  (rutor, stapel, tomt, mörkt läge); provet checkades inte in.

## Planerna i 30 dagar (2026-10-21, `betala_nu`)

Samma kväll (Leo: planen köps "direkt och den används 30 dagar framåt") gick månadsvalet: en plan
gäller 30 dagar från betalningen (`klippkort_betald`), `intern.klippkort_manad` sätter ingen
`galler_fran`, och vyn har en rad per plan under batteriet i stället för en per månad. Avsnittet
nedan är historik, utom återbetalningen av ett köp, som står kvar (`minne/betalning.md`, Betala nu).

## Planerna per kalendermånad, och ett köp som betalas tillbaka (2026-10-21, `planerna_per_manad`, i drift sedan 2026-10-20)

Leo (2026-10-21): en plan köps för "Den här månaden" eller "Nästa månad", timmarna går ut när månaden är
slut, timbanken visar båda månaderna ("3 av 8 timmar återstår", "0 av 0" för en månad utan plan),
förbrukningen räknas ur passen, saldot prövas med radlås, och en återbetalning drar tillbaka timmar men
aldrig under det som använts.

**Förut** gällde en plan en månad från betalningen (`giltig_manader` från betaldagen), och ett köp hade
ingen första dag. Nu bara planerna: Fyll timbanken (sex månader från köpet), gratistimmarna (60 dagar),
planens gratis timme (60 dagar efter köpet, som förut) och tipstimmen är orörda.

**Månaden.** `klippkort.galler_fran` är planens första dag, den 1:a i den här eller nästa månad i
Stockholms tid, skriven av `stripe-checkout` ur anropets `manad` (`denna` eller `nasta`, `planManad` och
`manadensForsta` i `_delad/erbjudanden.ts`) och prövad i databasen (`intern.klippkort_manad`, BEFORE
INSERT): en annan dag ger 22023, som kassan säger (midnatt den sista kan göra den här månaden till förra).
Utan `manad` sätter databasen den här månaden på en plan. Timmar till planen (`plan_extra`) tar planens
månad, och allt annat har null. `klippkort_betald` sätter `giltigt_till` till månadens sista dag för en
plan med `galler_fran`; betalas den efter sin månad (en kassa som stått öppen över månadsskiftet) blir det
en uppgift till oss, för timmarna har då redan gått ut. Kassans rad säger månaden (`kassarad`). Planer
köpta före filen har null och behåller sina datum.

**Förbrukningen** räknas som förut ur passen (`klippkort_saldo`, `anvanda`), och tre ställen följer
månaden: `intern.timmar_fordela` (ett köp betalar inget pass före sin första dag, och timmar som betalats
tillbaka finns inte), `klippkort_saldo` (`kvar` och `brukbar` räknar månaden och de återbetalda timmarna;
`galler_fran` och `aterbetalda_timmar` sist i vyn) och `extra_timmar_erbjudande` (Köp till timmar går till
den här månadens plan, aldrig till nästa månads och aldrig till ett köp av timmar till en plan, vilket den
gamla "senaste raden" kunde bli). **Saldot prövas med lås** som förut: `klippkort_dra` och
`intern.timmar_betala` tar `for update` på passet och köpen och det rådgivande låset `timbank:<familj>`, så
två pass kan inte dra samma timme. Låset prövas inte av `rls-test.sql`, som är en enda transaktion; sviten prövar räkningen.

**Vyn.** Plankorten har två knappar, Den här månaden (förval) och Nästa månad, och raden under säger vad
valet betyder ("Gäller till och med 31 oktober, 12 dagar" eller "Gäller 1–30 november"); bara knapparna och
raden byts, så kortet inte byter höjd. Månaderna kommer ur `planens_manader()` (databasens datum, Stockholms
tid), och utan den (före migrationen) står ett Köp som förut och kassan får ingen månad. Rutan med
köpvillkoren säger månaden igen. Under batteriet i Er timbank och i Profil → Timbanken står en rad per
månad (`månadsRader`, `.tb-manader`): "<b>3</b> av 8 timmar återstår" och sista dagen, och "0 av 0" för en
månad utan plan; Köp till timmar räknas med sin plan, och en plan köpt före filen räknas till den här
månaden så länge den gäller. Batteriet räknar bara det som gäller nu: nästa månads plan står i listan som
kommande (`.ar-kommande`, "Gäller 1–30 november") men inte i batteriet. Barnets vy visar inga timmar, som
förut. Proven: `rls-test.sql` avsnitt 43 (PM) och `verktyg/prova-kassan.js`.

**Ett köp betalas tillbaka** under Betalningar → Liggaren (`minne/betalning.md`), helt eller med ett antal
timmar. `klippkort_aterbetalning_lage(p_id, p_timmar)` (admin eller tjänstekontot) räknar beloppet, aldrig
anropet: hela köpet är det villkoren lovar den som slutar (`vid_uppsagning_ore`: använda timmar till
ordinarie timpris, med familjerabatten dragen), en del är timmarna till det pris familjen betalade per
betald timme (`betalt_ore` delat på de betalda timmarna), aldrig mer än hela köpet; gratistimmar, ett köp
utan betalning i Stripe, ett i tvist och ett redan återbetalt nekas med en mening. Timmar som använts dras
aldrig tillbaka, och en del tar betalda timmar, aldrig den gratis. `stripe-aterbetalning` (`{klippkort,
timmar, anledning}`, `_delad/aterbetalning.ts`) gör återbetalningen i Stripe först, med köpets id, timmarna
och adminens id i metadata och en nyckel av köpet, det som redan gått tillbaka och beloppet, och skriver
den sedan med `klippkort_aterbetalad()` (tjänstekontot): en rad per återbetalning i
`klippkort_aterbetalningar` (Stripes `re_`-id, timmar, belopp, hela, vem, anledningen), `aterbetalda_timmar`
upp, `aterbetald_ore` till summan, och hela köpet stänger det (`aterbetald`). Hann funktionen inte skriva
skriver webhooken samma återbetalning ur Stripes metadata när `charge.refunded` kommer (`stamAvKopet`), och
samma återbetalning två gånger blir en rad. Användes timmar under tiden drogs färre tillbaka, och det blir
en uppgift. En återbetalning i Stripes dashboard (utan köpets id) stänger köpet som förut och blir en
uppgift: där drogs inga timmar.

## Insatta timmar med orsak och månad (2026-10-21, `timmar_med_orsak`)

Leo: "Verifiera att admin kan lägga in timmar manuellt med loggrad. Om det
saknas, bygg det: timmar, månad, obligatorisk orsak, egen oföränderlig
loggrad." Det fanns: `ge_gratistimmar(familj, timmar)` och auditen (vem som
skapade kortet). Det saknades: varför, och vilken månad.

- **`ge_gratistimmar(familj, timmar, orsak, månad)`**: kräver en orsak (3–500
  tecken, btrim) och en månad från september 2026 till och med nästa månad,
  svensk tid; utan månad den innevarande. Den kör den gamla insättningen och
  skriver raden i samma transaktion. Den gamla med två argument kör ingen
  inloggad längre (inget drop: den körs av den nya).
- **`timmar_insatta`**: familjen, kortet, timmarna, `avser_manad` (första
  dagen), orsaken, vem (`insatt_av`) och när. Bara funktionen skriver; ingen
  ändrar, tar bort eller tömmer tabellen, inte heller databasens ägare
  (`timmar_insatta_star_fast`, före update, delete och truncate). Det som går
  förbi körs av databasen i en trigger (`pg_trigger_depth() > 1`): en
  främmande nyckel som blir null när kontot eller kortet tas bort, och
  gallringen. Bara en superadmin läser (`is_admin()`), som köpen.
- **Gallringen**: orsaken är fritext och kan nämna familjen, så den töms när
  familjen avidentifieras (`profiles_timmar_insatta_gallras`, som
  `profiles_partner_rensas`). Antalet, månaden och kortet står kvar.
- **Månaden** säger vad timmarna avser (ett pass som ställdes in i
  september), inte när de går ut: det är 60 dagar från insättningen, som förut.
- **Vyerna**: familjens panel, Ekonomi: Sätt in har Timmar, Avser månad
  (september 2026 till nästa månad, den här förvald) och Orsak (krävs, minst
  tre tecken), frågan före säger månaden och orsaken, och raderna står under
  Insatta timmar med månaden, orsaken, vem och när. Ta in familjen: orsaken
  fälls ut när timmarna är fler än noll och krävs innan kontot skapas;
  timmarna avser den månaden. Raden Första timmen gratis under Översikt är
  borta (Leo samma dag), med frågan `forsta_timmen_lage` panelen ställde.
- **Första timmen med planen fungerar**: `intern.planens_forsta_timme` ger den
  första planen familjen betalar en timme till när `klippkort_betald` (som
  webhooken kör) sätter den betald, också med rabattkod, och aldrig Fyll
  timbanken; `rls-test.sql` avsnitt 28 provar det och gick igenom med alla
  migrationer 2026-10-21.
- Provat: `rls-test.sql` avsnitt 49 (`TI`, 15 prov), `prova-intag.js` och
  `prova-adminvyn.js` (raden läses ur en riktig databas).
- **Granskningen 2026-10-21**: orsaken gick att tömma på en familj som fanns
  kvar. `skydda_profilfalt` släpper igenom admin, så en superadmin som satte
  `profiles.raderad_at` och tog bort den igen gav orsaken "Gallrad", och
  familjen stod kvar som förut. Nu står `raderad_at` fast när den satts
  (`profiles_raderad_star_fast`, också mot databasens ägare: en raderad
  familj blir aldrig oraderad), och `timmar_insatta_star_fast` släpper vid
  `pg_trigger_depth() > 1` bara det databasen gör där: en nyckel som blir
  null och orsaken som töms vid gallringen, inget annat. Provat:
  `rls-test.sql` avsnitt 49 (ett prov till). Avser månad förväljs i
  Stockholms tid också i webbläsaren (`nextrum-admin-detalj.js`).


## Sen avbokning med timmar (2026-10-22, `sen_avbokning`, i drift sedan samma kväll)
Avbokar familjen ett pass som timmarna betalat mindre än 12 timmar före start räknas det som hållet i halva den
bokade tiden (`minne/betalning.md`, Sen avbokning). Passet står kvar betalt med timmarna (`klippkortspass_avbokat`
hoppar över det), och timmarna räknas som för ett pass som blev kortare: `intern.debiterade_min` ger halva tiden,
`intern.kortets_anvanda` drar de påbörjade timmarna (ett pass på 60 minuter drar en timme), och `intern.timbank_in`
sparar det som blir över av en köpt timme (30 minuter), aldrig av en gratistimme. En tipstimme och planens gratis
timme är använda, och ett pass betalt ur timbanken får halva minuterna tillbaka. Efterskänker superadmin avgiften
blir passet en vanlig avbokning: timmarna kommer tillbaka och `betalning_status` blir `ingen`. Inget larm och inget
att betala; adminvyn visar passet som "Sen avbokning, ur timmarna" under Alla betalningar.


## Fyll timbanken säljs inte (2026-10-22, i drift sedan 2026-10-24)
PR #331 mergades 2026-10-24 (9e72f81), och `drift` v26 och `stripe-checkout` v25 gick ut från merge-commiten samma
kväll (kärnans avsnitt 11, `minne/funktioner.md`). Det fanns inga köp av timmar i driften, så inget köpt kort berördes.
Leo: "Det ska bara finnas tre köpbara planer: 4, 8 och 12 timmar", "Redan köpta klippkort ligger kvar och gäller",
"Servern ska avvisa nya klippkortsköp", och en ruta "Behöver ni ett eget upplägg? Kontakta oss." på prissidan och i
kassan. Inget får droppas, och ingen migration får ändra eller radera befintlig data.
- **Prissidan** (båda språken): raden Fyll timbanken under planerna är borta, och där står rutan Eget upplägg
  (`.pr-erb-eget`). Leo bad om en länk till info@ med ämnet Eget upplägg, "finns redan ett kontaktformulär, använd det
  i stället", och det finns ett (`/faq#kontakt`, `contact_messages`): knappen går dit med `?amne=eget-upplagg`, och
  formuläret börjar då meddelandet med "Eget upplägg: " (`NX.t('egetUpplagg')`), bara för det värdet. Kalkylatorns
  tredje läge (ett barn och ingen plan med de timmarna) var Fyll timbanken och är Eget upplägg. Ingressen och Vad är
  timbanken? säger bara planen. Studievyns ruta går till samma formulär, i en ny flik.
- **Studievyn**: `S.erb.katalog` är bara planerna, och kolumnen (`klippKolumn`) är borta. Er timbank, batteriet,
  Profil → Timbanken och Betala med timmar läser köpen ur `klippkort_saldo` som förut, så ett köpt kort syns och räknas
  ner till sin sista dag. Profilens förklaring säger att timmar köpta med Fyll timbanken gäller i sex månader.
- **Servern**: `stripe-checkout` nekar allt i katalogen som inte är en plan, efter att raden lästs och före köpet och
  kassan, med 410 och `SALJS_INTE` (`_delad/erbjudanden.ts`, `saljs()`, provat i `erbjudanden_test.ts`). Ett väntande
  köp återanvänds alltså inte. En kassa som redan öppnats betalas av webhooken som förut. Timmar till planen
  (`plan_extra`) går sin egen väg och rörs inte.
- **Databasen rörs inte**: katalogens rader `klipp10`–`klipp100` står kvar och aktiva (köpta kort pekar på dem, och
  `erbjudanden_pris` visar dem för den som frågar API:t direkt), och `flaggor.beskrivning` för `erbjudanden` säger
  fortfarande Fyll timbanken. En vakt i databasen (en BEFORE INSERT på `klippkort` för sorten) skrevs inte: den
  lokala databasen gick inte att bygga i sessionen (Docker Hub svarade 429, och ECR:s lagring stoppades av proxyn), och
  en migration som inte provats ska inte till driften. Den är nästa steg om kassan ska sluta vara enda spärren; den
  måste släppa igenom databasens ägare, annars faller `rls-test.sql`, som lägger `klipp10` som fixtur.
- **Strömbrytaren `erbjudanden` ska stå på**: `klippkort-betala` nekar utan den, och då betalar inga köpta timmar ett
  pass.
- **Villkoren** var oförändrade (2026-10-23) när grenen gick ut: de beskrev Fyll timbanken, som fortfarande gäller för
  de köpta korten. **Versionen 2026-10-26** (Leo: "fixa villkoren", `villkoren_utan_fyll_timbanken`) säger att timbanken
  fylls med en plan, att Fyll timbanken inte säljs längre och att timmar köpta med den gäller som förut. Fyll timbanken
  är struken där villkoren räknar upp vad man kan köpa (familjerabatten, betalningen, syskontillägget, köpvillkoren,
  Planer och timbanken och ångerrätten), och reglerna för köpta timmar står kvar (sex månader, timbanken, prisgarantin
  och Att sluta). Syskontilläggets egen version, 2026-10-23, står kvar: dess regel är densamma. Alla får frågan igen.
  I drift sedan 2026-10-26 (PR #336, 7d5de9d; migrationen ur merge-commiten, md5 `05139538…`, och `rls-test.sql` 2131
  av 2131 mot driften, tillbakarullat).
- **Stripe**: kassan skapar inga produkter i Stripe (raderna går med `price_data` och `product_data` i varje kassa),
  så det finns inget att arkivera. Ligger något med namnet Fyll timbanken i Stripes produktkatalog ändå: arkivera, radera
  inte.
- Adminvyn: texterna om vad familjerna kan köpa säger planer, och strömbrytaren heter Planer och köpta timmar.
  Listorna över köp och Liggarens typ `timbank` heter som förut, för de visar köp som redan finns.

## Egna upplägg (2026-10-27, `egna_upplagg`, i drift samma kväll)

Leo: "gör en funktion att admin kan skicka egna upplägg att köpa, det är tex så att admin säljer 6 h till familjen
därför att det är lov och då skickar vi ett upplägg, villkoren är samma men det är bara 6h istället." Samma meddelande
sa att planerna skulle gälla köpmånaden i stället för 30 dagar; Leo tog tillbaka det samma dag ("skojade, planerna är
i 30 dagar"), och inget ändrades där. Samma eftermiddag gjordes upplägget om (Leo: "rabattkod gäller också för upplägg.
Samma sak som vanliga planer bara annat antal timmar och vi från admin skickar de som möjlighet till köp, De köper och
möjligheten försvinner, vill de ha eget upplägg igen måste vi skicka igen. Mejl ska gå ut när de fått möjlighet till
eget upplägg"): den första versionen hade ett timpris admin satte, ingen kod, inga timmar till det och inget mejl.

- **Admin skickar** i familjens panel, under Ekonomi → Egna upplägg (`skicka_eget_upplagg()`, bara `is_admin()`): ett
  namn som familjen ser och som står på kvittot (högst 60 tecken, hjälptexten ber om inget om barnet), 1–40 timmar och
  hur många dagar familjen kan köpa det (1–60, 14 som förval). **Priset är planernas**: databasen sätter timpriset ur
  `erbjudanden_pris` (det lägsta rabatterade timpriset bland planerna, 379 kr i dag) och fryser det på upplägget, så att
  mejlet och kassan säger samma pris; det finns inget fält för ett eget pris. Högst fem som väntar per familj. Upplägget
  står fast när det skickats (`intern.egna_upplagg_vakt`): bara att det köpts eller dragits tillbaka
  (`aterkalla_eget_upplagg()`) skrivs. Skriv i Gmail står kvar för ett eget ord.
- **Mejlet**: triggern `egna_upplagg_notis` köar ett mejl till familjen (typen `eget_upplagg`, `minne/notiser.md`) med
  timmarna, priset med familjens rabatt och sista dagen. Det går om fem minuter och bara medan upplägget går att köpa.
- **Familjen köper en gång** under Betalning & planer, där upplägget står som ett band ovanför planerna (`#erb-upplagg`,
  `ritaUpplagg`) och i notisrutan, med Köp och köpvillkoren först. `stripe-checkout` (`{ upplagg, rabattkod }`) läser
  upplägget med familjens token, prövar koden mot uppläggets pris (`kod_pa_upplagget`), och databasen skapar köpet
  (`eget_upplagg_kop()`, bara tjänstekontot): en rad i `klippkort` med erbjudandet `plan_eget`, sorten `plan`,
  `upplagg_id` och koden, där `intern.klippkort_rabatt` räknar priset som för en plan ur katalogen (uppläggets pris,
  familjerabatten på varje timme och koden på det som är kvar). Ett väntande köp av samma upplägg med samma kod och pris
  återanvänds i 23 timmar. När köpet är betalt är upplägget köpt och syns inte längre, och `eget_upplagg_kop()` och
  `kod_pa_upplagget` säger nej till det; vill familjen ha ett till skickar admin ett nytt. Katalogens rad `plan_eget` säljs
  aldrig (`erbjudanden_eget_saljs_inte`), och raden i kassan är `kassaradForUpplagg`, med koden när köpet har en.
- **Det är en plan**, med allt: 30 dagar från betalningen (`klippkort_betald`), timbanken och ordningen timmarna dras i,
  första timmen gratis om det är familjens första plan, familjerabatten, rabattkoden, Köp till timmar
  (`extra_timmar_erbjudande` och vyns `planFörExtra` tar det som en plan, till köpets timpris), påminnelsen tio dagar
  innan, ångerrätten, Att sluta och återbetalningen under Liggaren. Villkoren säger det (`#eget-upplagg`, version
  2026-10-27), och nämner inga koder, som resten av villkoren.
- **Betalt två gånger** (två kassor) eller efter att det drogs tillbaka (kassan stod öppen): köpet står, för pengarna
  kom, och en uppgift säger vad admin ska avgöra (`eget_upplagg_dubbel:<köp>`, `eget_upplagg_aterkallat:<köp>`).
- **Provat** i `rls-test.sql` avsnitt 58 (21 rader), `koder_test.ts`, `erbjudanden_test.ts`, `rendera_test.ts` och
  `prova-kassan.js` (Egna upplägg, och Upplägget med kod).
