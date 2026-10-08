# Timmarna: planer, klippkort och timbanken

Arkivet för Fas 16.1, 21 och 22.1–22.4 ur avsnitt 1 och 11 i `CLAUDE.md`, ordagrant, och Leos
besked 2026-09-30 om testköpet. Reglerna står i kärnan, `CLAUDE.md`; siffrorna och
kortbetalningen i `betalning.md`. "Avsnitt N" i texten är kärnans.

---

## Köpta timmar (Fas 16.1 och 21)

**Timmar kan köpas i förväg (Fas 16.1).** Tre planer för en månad sedan
2026-10-07 (Basic 4 timmar, Standard 8 och Intensiv 12, alla −5 % och en
månads bindning sedan 2026-10-08, då Standard förlorade sin timme på köpet;
till 2026-10-07 två, 4 och 8 timmar, −10 %) och klippkort med 10–100 timmar (−5 %, gäller
6–18 månader). Köpet är ett engångsköp med kort, inget abonnemang.
Timmarna betalar sedan ett bekräftat pass med ett barn i stället för
kortet, av sig själva sedan Fas 22.2 (nedan). Flaggan `erbjudanden` är PÅ sedan 2026-09-27: Leo slog på den
innan provköpet i DEPLOY-BETALNING.md 9.12 var gjort. Står den av syns
priserna men inget går att köpa. Klippkorten står i studievyn och på prissidan som en kolumn
bredvid planerna som fälls ut (2026-09-27). De var borta ur
studievyn en förmiddag samma dag och kom tillbaka i den formen.

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
  priset av 7 · ni sparar 379 kr", aldrig ett snittpris.
- Ordet "på köpet" betyder också startrabatten och tipstimmen. Villkoren
  säger att köpta timmar inte betalar "ett pass där en timme är på köpet"
  (startrabatten); ett förtydligande kräver en ny version av villkoren.
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
villkoren (`betalning.md`, sista avsnittet). Siffrorna i stycket ovan är
de som gällde 2026-10-07.

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

## Timbanken (Fas 22.1)

**Det som blir över på ett timpass sparas i timbanken** (Fas 22.1,
2026-09-27). Klippkortet drar en timme per påbörjad timme, men sedan
Fas 20.1 kostar ett kortpass den hållna tiden per påbörjad kvart: ett
pass på två timmar som höll 1 h 15 drog två timmar ur klippkortet och
kostade 1 h 15 med kort. Familjen med rabatt betalade mer. Nu drar
klippkortet som förut, och resten upp till hel timme (45 minuter)
står i familjens timbank. Tre beslut av Leo samma dag:
1. **Bara köpta timmar fyller banken.** Ett kortpass som blev kortare
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
