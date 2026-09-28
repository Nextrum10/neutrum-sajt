# Nextrum — projektminne

Läxhjälpsförmedling i Stockholm. Publik sajt på två språk plus tre
inloggade vyer, byggd som statiska filer mot Supabase och driftsatt på
Vercel (`nextrum.se`).

Den här filen är minnet: vad som gäller, varför det gäller, och vilka
fel som redan har begåtts en gång. Driftinstruktionerna ligger kvar i
`START-HÄR.md` och `DEPLOY-*.md` — de upprepas inte här.

`MINNESPOSTER.md` är samma kunskap kokad till sju korta poster för
Claude-projektets minne. Ändras en regel här som också står där: ändra
båda i samma commit.

`.vercelignore` utesluter `*.md`, så ingen av dem serveras från sajten.

---

## 1. Affären, i ordning

Det här är inte en katalog man bläddrar i. Nextrum matchar.

1. Familjen skickar **intresseanmälan** → rad i `leads`
2. Ni ringer och väljer studiehjälpare
3. Familjen skapar konto på `foralder.html`
4. `admin.html` → **Familjer** → välj hjälpare i rullgardinen. Sätter
   `matched_tutor_id` och `match_status` **samtidigt** — förr var det
   två kolumner i Table Editor och satte man bara den ena såg familjen
   en låst vy utan att förstå varför
5. Föräldern lägger in barnet, hjälparen skriver studieplanen

Föräldravyn låses upp först efter steg 4. Innan dess: väntläge, inte
trasig sida.

**Ett pass bokas i två steg (Fas 15.1).** Familjen trycker på en dag i
en tom kalender, väljer ämne, tid och antal barn och FÖRESLÅR tiden.
Studiehjälparen accepterar eller föreslår en annan under Föreslagna
tider, och först då står passet under Mina lektioner. Det finns inga
veckotider längre: `tutor_availability` läses inte av något, och
triggern som bekräftade bokningar inom dem är borttagen. En avbokning
kräver ett skäl (fast kod), och motparten får det i mejlet (Fas 15.2).
Väljer familjen ämnet Annat måste de skriva vilket, och det skrivna
ordet är det som sparas i `bookings.subject` (2026-09-25). Mejlen
läser ämnet genom `fornamn()`, så fritexten når dem som ett ord.
Tiderna börjar klockan 11 på vardagar och klockan 9 på lördag och
söndag, och slutar senast 22 (`HELA_DAGEN` i `nextrum-arbetsyta.js`,
som förslaget och flytta-rutan delar). Leo 2026-09-28: "man ska inte
kunna skicka förfrågan innan 11 på vardagar, helger ska man kunna
skicka förfrågan tidigast kl 9", samma kväll som 11 först gällde alla
dagar. Det är passets starttid, inte när förslaget skickas. Röda dagar
mitt i veckan räknas som vardagar. Listan började 07:00, och Leos "man
kan inte föreslå tider före 11:00" från 2026-09-25 lästes då som en
felanmälan i stället för en regel.
Regeln står bara i vyn, som resten av fönstret: databasen spärrar inga
timmar, och en flik som laddats före en ändring erbjuder de gamla
tiderna tills den laddas om. Samma dag går det bara att föreslå tider
minst en timme fram, och tidsraden säger det — annars ser det ut som
att dagens första timmar saknas.

**Ångerrätten står i villkoren** (`#angerratt`, 2026-09-25): 14 dagar
från att passet är bokat. Villkoren nämnde den inte alls förut, och
utan informationen förlängs fristen med upp till tolv månader (lagen
om distansavtal 2 kap. 13 §). Att ett genomfört pass inte går att
ångra, och att en påbörjad del betalas, gäller bara för att familjen
UTTRYCKLIGEN bett att passet hålls inom fristen — den begäran är att
föreslå tiden, och meningen om det står sist i bokningens dagpanel.
Tas meningen bort faller undantaget. Planer och klippkort (Fas 16.1)
har samma ångerrätt, räknad från köpet, och den går inte att avtala
bort. Inom fristen får vi bara behålla en andel av det AVTALADE priset
för de timmar som använts (2 kap. 15 §), alltså det rabatterade.
Regeln att använda timmar räknas till 379 kr när en familj slutar
gäller först efter fristen — adminvyn visar rätt belopp efter datumet
(`vid_anger_ore` och `vid_uppsagning_ore`, Fas 16.1e).

**Timmar kan köpas i förväg (Fas 16.1).** Två planer för en månad
(4 och 8 timmar, −10 %) och klippkort med 10–100 timmar (−5 %, gäller
6–18 månader). Köpet är ett engångsköp med kort, inget abonnemang.
Timmarna betalar sedan ett bekräftat pass med ett barn i stället för
kortet, av sig själva sedan Fas 22.2 (nedan). Flaggan `erbjudanden` är PÅ sedan 2026-09-27: Leo slog på den
innan provköpet i DEPLOY-BETALNING.md 9.12 var gjort. Står den av syns
priserna men inget går att köpa. Klippkorten står i studievyn och på prissidan som en kolumn
bredvid planerna som fälls ut (2026-09-27). De var borta ur
studievyn en förmiddag samma dag och kom tillbaka i den formen.

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
markerar banken utbetald under Ekonomi → Erbjudanden. Studiehjälparen
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

**Förslaget bär var man ses (Fas 15.6).** Online, eller På plats med en
adress i `bookings.location`, och en valfri rad till studiehjälparen i
`note`. Fas 15.1 hade tagit bort frågan, och ett förslag hade då ingen
plats alls. Förval ur förra passet och barnets `format_onskemal`.
Platsen ändras inte när tiden flyttas — `skydda_bokningsfalt` släpper
bara igenom tid och status på ett befintligt pass.

**Ett bekräftat onlinepass har en Meet-länk (Fas 18.1).** Den står under
Var på passets sida, likadan hos familjen och studiehjälparen, och
skapas av `google-meet` första gången någon öppnar passet, inte av en
trigger. Rummet är öppet (den som har länken går in utan att knacka),
för på ett pass är ingen från Nextrum med och släpper in. Blir rummet
inte öppet sparas länken inte. Är Google inte kopplat står den gamla
texten kvar: länken kommer i meddelanden. Leo valde bara det här av
Workspace-kopplingen; kalendern, inbjudningarna och rekryteringsmötet
valdes bort, och mejlen går genom Resend som förut (INTEGRATIONER.md).

**Passet kostar den tid det faktiskt hölls (Fas 20.1, 2026-09-27).**
Studiehjälparen skriver start och slut i rapporten, förifyllt med det
bokade. Avviker tiden krävs ett skäl, som familjen ser bredvid tiden
innan de bekräftar, och databasen nekar både avvikelsen utan skäl och
en tid som ändras i efterhand (`intern.skydda_rapportens_tid`; admin
rättar). Tre beslut av Leo samma dag:
1. **Per påbörjad kvart.** `lesson_reports.debiterade_min` räknas ur
   tiderna; 2 h 05 debiteras som 2 h 15. Saknar rapporten tid (äldre,
   fristående, eleven uteblev) gäller det bokade.
2. **Förbetalt och längre: familjen betalar tillägget** med kort när de
   bekräftar rapporten, i en egen kassa och på en egen rad
   (`pass_tillagg`), aldrig på passets betalningskolumner: webhooken
   skriver återbetalningar och tvister på den rad som bär chargen, och
   en återbetald kvart hade annars skrivit över passets betalning.
   Förbetalt och kortare larmar `betalt_for_lange` med beloppet att
   betala tillbaka (knappen under Kortbetalningar). Timmar på ett
   klippkort går tillbaka av sig själva: klippkortet drar påbörjade
   timmar av det som hölls, upp till det bokade, och resten av den
   sista timmen går till timbanken (Fas 22.1).
3. **Lönen följer tiden nedåt alltid, uppåt bara när övertiden är
   betald** (`passunderlag.lon_min`). Den som skriver in tiden är den
   som får lönen.
Vad kortbetalningen avsåg står i `bookings.stripe_minuter`, skrivet av
webhooken ur sessionens metadata. Namnet börjar med `stripe_` med flit:
`skydda_bokningsfalt` nekar redan varje sådan kolumn från en vy.
Villkoren säger det sedan samma dag (`#hallen-tid`, båda språken).

**Månaden stängs i bokföringen (Fas 20.2).** Adminvyns Ekonomi väljer
månad (`NXStudie.månadsval`, samma rad som i studiehjälparvyn) och visar
`manad_lage()`: passen, tiden, pengarna, underlaget och larmen för
PASSENS månad. **Stäng månaden** går bara när månadens larm är noll, och
en stängd månad är låst i databasen: inget pass och ingen rapport i den
kan skrivas, ändras eller tas bort, inte heller av admin, förrän admin
öppnar den med ett skäl (`oppna_manad`, står i auditloggen). Webhooken
och månadskörningen går igenom låset (`auth.uid()` är null): det som
redan hänt hos Stripe ska gå att skriva ner. Rapportens TEXT går att
skriva om i en stängd månad; bara pass, elev, datum, närvaro och tid är
låsta. Passets plats och rad till studiehjälparen går att TÖMMA men inte
ändra: det är vad `radera_person()` gör när en familj slutar
(2026-09-28, avsnitt 5). Underlag och fakturor låses inte: de betalas
efter månaden.

**Månadens ekonomi och Löner (2026-09-28)** är två egna sidor under
Ekonomi i adminvyn, bredvid Betalningar & utbetalningar. Leo: "där ska
man aktuellt se hur många fakturor som ska skickas samt så många
lektioner som är betalda för. hur många timmar är betalt samt ej ännu
betalt ... detta för att ej ha problem om kassalikviditet", och "en till
avdelning för löner, personer och deras uppgifter samt exportera löner
till tex fortnox". Inget av dem ändrar databasen eller en edge function:
allt räknas ur det adminvyn redan hämtar, på passets månad, så en merge
är hela driftsättningen.
- **Månadens ekonomi** (`#manaden`, `nextrum-admin-manaden.js`) ger
  varje bekräftat eller genomfört pass i månaden ett läge (`läge()`):
  betalt med kort, på betald faktura, med köpta timmar, ur timbanken,
  eller varför det inte är betalt (ska faktureras, faktura inte inlagd i
  Fortnox, fakturerat, förfallen faktura, hölls utan betalning, inte
  hållet än). Talen är summor av lägena och är knappar: ett tryck visar
  familjerna bakom talet, med passen och Öppna familjen (detaljpanelen).
  Beloppet för det obetalda är vad passet kostar, med samma regel som
  familjens vy: `NXBetalning.passpris`, flyttad dit ur studievyn samma dag
  så att webbläsaren har en prisregel och inte två. Köpta timmar räknas
  på dagen de betalades, och testbetalningar och testköp aldrig
  (`S.klippkortTest`). Timbankens pass känns igen på
  `timbank_uttag.sort = 'pass'` (`S.timbankPass`).
- **Fakturorna skapas från sidan med månadskörningen**, samma körning som
  under Ekonomi och Löner, och knapparna på varje faktura är desamma som
  under Ekonomi → Fakturor (`data-fakt-*`, lyssnarna i
  `nextrum-admin-ekonomi.js`). Körningen är en ruta med `data-kor-ruta`
  som kan stå på flera ställen; torrkörningen hör till sin ruta, så en
  torrkörning på en sida ger ingen Skapa-knapp på en annan. **En månad
  som inte har börjat går inte att köra** från någon av rutorna
  (`körningensLäge`): sidorna visar kommande månader, och en körning för
  oktober i september hade lagt septembers pass på oktobers underlag.
  Rutan säger också när månaden pågår, och när en tidigare månad har pass
  men inga underlag (`data-kor-not`).
- **Löner** (`#loner`, `nextrum-admin-loner.js`) listar de godkända
  studiehjälparna och alla med något att få för månaden.
  **Månadsraden är utbetalningsmånaden** (samma kväll, Leo: "september
  jobb betalas i oktober, därför ska 240kronorna visas i oktober"):
  oktober är lönen den 25 oktober, för septembers pass, som en
  lönekörning i Fortnox Lön. Förvalt är nästa lönedag (efter den 25:e
  nästa månad), och en månad märks Utbetald när alla dess underlag är
  det. Allt under raden räknas på passens månad, månaden före
  (`passmånad`), och underlaget (`payouts.period`), körningen, Ekonomi,
  Månadens ekonomi och studiehjälparens lönespec räknar fortfarande på
  passens månad. Länken från Månadens ekonomi öppnar därför månaden
  efter, och lönefilen heter efter utbetalningen. Anställningsnumret
  (`lon_anstallning`, Fas 17.1) och
  timpenningen sätts där; personnummer, adress, bankkonto och
  skattetabell står i Fortnox Lön och inte här, med flit. Finns passens
  underlag gäller underlagets tal; annars räknas de pass som månadens
  körning kommer att ta (genomförda, rapporterade, inte undantagna, inte
  på ett underlag) och märks beräknat. **Varje pass räknas i EN månad**
  (`NXAdmin.lönemånad`): sin egen, eller, när den månaden eller en senare
  redan har underlag, månaden efter den senaste med underlag. Leo samma
  kväll: "septembers pass räknar för lön i sep och okt". Körningen tar
  allt till och med periodens slut som inte står på ett underlag, och
  sidan räknade först likadant, så septembers pass stod som lön både i
  september och i oktober, också i Månadens ekonomi. Ett pass som
  rapporterats efter att dess månad fått underlag står i sin månad som
  "på nästa underlag" och i nästa som "från tidigare månader". Bara
  underlagen räknas som körda, inte fakturorna: körningen skapar
  fakturorna först, och står en månad med fakturor men utan underlag ska
  den köras igen.
- **Lönefilen är PAXml 2.0**, som Fortnox Lön läser in under Lön →
  Kalender → Importera löneunderlag och matchar på anställningsnumret.
  En `lonetrans` per underlagsrad: anstid, löneart
  (`foretagsfakta.lonart_timlon`), passets datum, timmar, timpris och
  belopp. Bara GODKÄNDA underlag kommer med, och utbetalda inte, så ett
  underlag markerat Utbetald kan inte läsas in igen. Filen byggs inte om
  lönearten saknas, om någon med godkänt underlag saknar nummer, om
  raderna inte summerar till underlaget, eller om bolagsfakta säger att
  studiehjälparna är uppdragstagare. Semesterersättningen står inte i
  filen: Fortnox lägger på den. **Filen är byggd efter standarden men
  inte provläst i Fortnox** (Fortnox hjälpsidor och paxml.se nåddes inte
  från sessionen som byggde den). Läs in den första i en löneperiod som
  går att kontrollera; nekar Fortnox den är det `paxml()` som ska rättas.

**Studiehjälparens rapporter och ersättning visas månad för månad**
(2026-09-27): "man ska inte kunna se rapporter från juli idag i
september". Förvalet är den innevarande månaden. Statistiken (Hur passen
gick) läser fortfarande de tjugo senaste.

**Familjens bekräftade rapporter likaså** (2026-09-28, Leo: "bekräftade
rapporter ska filtreras efter månad"): Bekräftade under Bekräfta rapport
har samma rad, på PASSETS månad, och raden är dold tills något är
bekräftat. Att bekräfta filtreras inte. Två saker kom fram i provbänken:
- **En månadsrad som skapas i en dold sektion visade fel månader.**
  Föräldravyns rad och studiehjälparvyns två skapas vid start, när
  sektionen är dold, och bredden noll gjorde att den valda månaden aldrig
  fördes in i bild: när sektionen öppnades stod oktober förra året
  längst till vänster och september låg utanför, på telefon och dator.
  `månadsval` för nu fram den valda när raden börjar synas.
- **`håll()` kan inte scrolla förbi sidans slut.** Listan står sist, och
  en kortare månad längst ned på sidan klämde scrollen: raden flyttade
  sig 84 px under fingret på en telefon. `rbBytMånad` låter listan
  behålla höjden tills tomrummet ligger under skärmkanten.
  Studiehjälparvyns två rader har bara `håll()`.

**Varje avslutad månad har en lönespecifikation** (2026-09-28). Leo:
"skriv lönespec för månaden efter att månaden är klar för
studiehjälparen, under utbetalning för månaden. Så ska det vara för
varje månad." Rutan Utbetalning för månaden (Statistik & ersättning →
Ersättning) visar månadens underlag, `payouts` och `payout_lines`, som
ett dokument: namn, period, timpenning, utbetalningsdag (den 25:e i
månaden efter, eller dagen den betalades), varje pass och summan, och
den går att skriva ut eller spara som PDF. Den räknar ingenting själv:
siffrorna är underlagets, frysta när månadskörningen skrev det
(`NXBetalning.lonespec`). Månadskörningen skriver underlaget den 1:a
varje månad, av sig själv sedan 2026-09-28 (pg_cron-jobbet
`manadskorning`, avsnitt 5; läget står under Ekonomi → Månadskörning),
så en månad har sin lönespec när den är slut. Ett pass som rapporteras
efter körningen kommer med nästa månad, och lönespecen säger det under
summan, liksom pass som saknar rapport. Månaderna som har en lönespec
är märkta i månadsraden. **Ingen skatt, med flit**: `studiehjalpare_form`
står på `oklart` (avsnitt 11), och utan anställningsform finns ingen
skattetabell att dra efter. Summan står "före skatt". Blir
studiehjälparna anställda gör Fortnox Lön lönebeskedet med skatten, och
då ska lönespecen här säga var det finns i stället för att räkna själv.

**Studiehjälparens schema öppnar i Kommande** (2026-09-24): de närmaste
passen per dag, med klockslag och ämne, elevens namn och platsen på var
sin rad. Studievyn och adminvyn öppnar fortfarande i månaden — hos
familjen står schemat direkt under passlistan, och Kommande hade bara
upprepat den.

**Plan & utveckling börjar med vem man skriver om** (2026-09-28, Leo:
"man kan ha flera elever därför behöver man välja"). Med flera elever
står studieplanen och kunskapsområdena dolda tills studiehjälparen själv
tryckt på en elev: där, under Mina elever, eller på ett elevkort eller en
länk i elevens rad ovanför Läxor och Meddelanden. Namnet står sedan i
rubrikerna. Blev eleven aktiv av något annat (den första i listan, en
familj i meddelandelistan, ett pass) frågar fliken igen: `S.elevVald`
minns vem man tryckt på, inte bara att man tryckt. Förut skrev
formulären på den första eleven tills man bytt, och rutan som sa vem
det var stod ovanför sektionen, 800 px över formuläret på en telefon.
Rutan står därför inte längre under Lektioner & elever, bara ovanför
Läxor och Meddelanden. En enda elev väljs inte; kortet säger bara vem.

**Familjen bekräftar rapporten, och får betala då** (Fas 19.1 och 19.2,
2026-09-27) under en egen post i föräldravyns meny, Bekräfta rapport.
Tre sätt att betala: **kort i förväg**, när tiden är bekräftad, **kort
efter passet** och **faktura efter passet** (när flaggan `faktura` är
på). De två senare görs i samband med att familjen bekräftar rapporten:
att välja betalsätt på ett genomfört pass ÄR bekräftelsen, under
Bekräfta rapport och på passets sida. Är passet redan betalt bekräftar
familjen ändå, med knappen Bekräfta rapporten. Bekräftelsen
(`rapport_bekraftelser`) säger bara att familjen läst rapporten; ett
pass som hållits ska betalas även om ingen bekräftat, och villkoren
säger det. Rapporten står kvar under Att bekräfta tills den är
bekräftad OCH passet är betalt eller satt på faktura. Ett genomfört
obetalt pass larmar som förut, direkt, som `ej_betalt`: Leo valde det
framför en frist. Fakturavalet heter "Få faktura nästa månad" (Fas 19.6,
Leo: "betala senare genom att välja att få en faktura skickad till sig
nästkommande månad") och är en knapp bredvid Betala med kort; en ruta
frågar innan betalsättet sparas (Fas 19.7). Vill familjen ändå betala
med kort trycker de **Betala med kort nu**, under Faktura i Betalning
eller på passets sida, och kassan öppnas direkt (2026-09-28, Leo: "passet
kan räknas som betalt efter att man betalat det"). Passet står kvar som
`faktura` tills webhooken skrivit kortbetalningen, så en kassa som
stängs utan betalning ändrar ingenting. Förut hette knappen Betala med
kort i stället och bytte bara passet till obetalt: ingen kassa öppnades,
och rapporten kom tillbaka under Att bekräfta. En skickad faktura står under Betalning i
rutan Fakturor att betala, med belopp, förfallodag, passen, bankgiro
(`BANKGIRO` i `nextrum-config.js`) och OCR. OCR:et skriver admin av från
Fortnox vid Lagd i Fortnox; det räknas aldrig fram här, och
`invoices_ocr_giltigt` prövar kontrollsiffran. Allt det syns först när
flaggan `faktura` är på, för utan den skapas inga fakturor. Fas 19.1 hade först valt bort betalning efter passet
för att villkoren sa före; Leo bestämde samma dag att villkoren skulle
ändras i stället.

**Varje pass har en egen sida, `#pass/<id>`, i båda vyerna.** Ritas av
`NXStudie.passSida`; vyn bestämmer innehållet (familjen ser pris och
betalning, studiehjälparen eleven och familjen). Raderna i listorna
leder dit och bär bara det som är ens eget drag just nu — svara,
betala, skriva rapporten. Föreslå ny tid och avboka ligger på sidan.

**Läxorna heter uppgifter, och de digitala görs som i Duolingo (Fas
23.1, 2026-09-28).** Leo: "istället för läxor uppgifter", och att göra
dem ska vara roligare, "lite som duolingo, du klarar en nivå och går
vidare", i mobilen och i steg, med belöningar ju fler man klarar, och
Min utveckling ska fungera som rättningen av dem. I studievyn och
studiehjälparvyn heter de uppgifter. Tabellen heter fortfarande
`homework`, sektionerna `uppgifter` (studievyn) och `laxor`
(studiehjälparvyn), och i adminvyn står de kvar som läxor: där betyder
Uppgifter redan adminens att göra-lista (`uppgifter`, `skapa_uppgift()`).
Läxhjälp är fortfarande tjänstens namn; skolan ger läxor, vi ger uppgifter.
- **En nivå** (`nivaer`) är 5–12 frågor i en **bana** per ämne och
  årskurs. Tre frågetyper, för att det är de som en maskin kan rätta och
  en tumme kan göra: val, skriv och ordna (brickor i rätt ordning).
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
- **Stjärnorna, veckoserien och märkena räknas ur försöken** och sparas
  inte, så de kan aldrig säga något annat än raderna. Stjärnorna i banan
  är det BÄSTA försöket per nivå (det är spelet). Rättningen i Min
  utveckling är det FÖRSTA klara försöket per nivå: efter det har eleven
  sett svaren. Serien räknar veckor, inte dagar: ett barn med uppgifter
  två gånger i veckan ska inte ha en serie som bryts varje torsdag, och
  ingenting påminner om den.
- **Belöningarna är märken, inte pengar.** Leo skrev "eventuellt". En
  belöning med ett värde i kronor (en rabatt, en bjuden timme) är ett
  pris som ändras och marknadsföring riktad till barn, och den gör
  fusket lönsamt. Det är ett beslut om affären och juridiken; fattas det
  ska det in här och i villkoren, inte bara i koden.
- **Min utveckling har tre flikar**: Uppgifter (rättningen, rätt första
  gången per kunskapsområde med studiehjälparens bedömning bredvid när
  området heter likadant, klarade nivåer per vecka och varje rättad nivå
  med genomgången fråga för fråga), Passen (passen med rapport, tiden,
  närvaron och vad rapporterna sagt) och Bedömningen (femstegsskalan, som
  förut). Bedömningen är en människas omdöme och blandas inte ihop med
  en maskins rättning.
- Barnet har inget eget konto: nivåerna görs i familjens inloggning
  (avsnitt 11).

En studiehjälpare syns publikt först när admin satt läget till
**Godkänd**.

**Omdömen hittas aldrig på** (2026-09-25). Falska
konsumentrecensioner står på marknadsföringslagens svarta lista sedan
1 september 2022, och den som visar recensioner måste säga om och hur
de kontrolleras. Röster på startsidan var tre tomma platshållare; tills
riktiga omdömen finns står där ett brev undertecknat Leo och
Alexandar, under rubriken "Innan de första omdömena". Vad som gäller
för ett riktigt omdöme står i kommentaren över sektionen i
`index.html`. Google-recensionen frågas efter i studievyn
(`ritaRecension`) så fort `GOOGLE_RECENSION_URL` är satt, och alla
familjer med två rapporter får samma fråga: att bara skicka de nöjda
vidare förbjuder Google. `tutor_reviews` (v7) är omdömen om
studiehjälparen, inte om Nextrum, och ska aldrig bli publik, för
studiehjälparna är ofta sexton. Den har noll rader och ingen vy skriver
dit. Insert-policyn prövade förut bara att passet var familjens, så en
familj kunde skriva om vilken studiehjälpare som helst; sedan Fas 19.3
måste `tutor_id` vara passets studiehjälpare och `student_id` passets
elev.

### Ordlistan (använd den, i kod och i text)

| Ord | Betyder |
|---|---|
| studiehjälpare | den som håller passet. Aldrig "lärare" utåt — `larare.html` heter så av historiska skäl. "Privatlärare" står en gång, i FAQ:n, för att säga att en studiehjälpare INTE är det (2026-09-28): ordet är det konkurrenterna och föräldrarna söker på, och svaret är ärligare än att tiga |
| pass | ett bokat tillfälle (`bookings`). Hela timmar, 1–3 |
| rapport | `lesson_reports`. **Passet är genomfört först när rapporten finns** |
| underlag | vad studiehjälparen ska få (`payouts`) |
| betalning | vad familjen betalat för ett pass: med kort, per pass, i förväg eller efter passet när rapporten bekräftas (`bookings.betalning_status`, `betalt_ore`). Eller mot faktura, när flaggan `faktura` är på (Fas 14.6) |
| faktura | `invoices`. Sedan Fas 14.6 ett betalsätt familjen kan välja per pass, efter passet. Påslaget sedan 2026-09-27 (flaggan `faktura`). Skickas från Fortnox, aldrig härifrån |
| tjänst | rad i `tjanster`. `aktiv` avgör vad som syns, inget annat |
| uppgift | i studievyn och studiehjälparvyn det eleven ska göra mellan passen (`homework`, Fas 23.1). Hette läxa. I adminvyn och i tabellen `uppgifter` betyder ordet fortfarande adminens att göra-lista; koden för elevens uppgifter säger `laxor` och `homework` |
| nivå | en digital uppgift i banan (`nivaer`): 5–12 frågor som rättas i databasen. En **bana** är nivåerna i ett ämne och en årskurs |

### Siffror som måste stämma överallt

- **379 kr/tim** (`nextrum-config.js: PRIS_PER_TIMME`)
- **69 kr/tim** tillägg för fler än ett barn — **fast, inte per barn**,
  tak tre barn (`tjanster.extra_personer_max`). Tre barn kostar 448, inte 517
- **Kort per pass, i förväg eller efter passet** (Fas 19.2). Familjen
  betalar varje pass med kort, **antingen i förväg eller efter passet
  när de bekräftar rapporten**, och ett pass som har hållits ska betalas
  även om rapporten inte bekräftats. Fas 14.2 sa före passet och att ett
  obetalt pass inte hålls; det gäller inte längre. Meningen står på 36
  ställen i 23 filer, på båda språken och i familjens mejl — också på
  läxhjälpssidorna och Vår idé, som sa "innan det hålls" ett dygn efter
  Fas 19.2 för att kontrollen inte räknade dem.
  `verktyg/kolla-betalningsvillkor.py` räknar dem, letar efter de gamla
  löftena ("efterskott", "10 dagars …", och sedan Fas 19.2 "hålls
  inte", "innan det hålls", "senast innan passet börjar", "ingenting
  dras i efterhand") i
  allt som serveras, och körs i CI. **En betalning som tas på ett annat
  sätt än villkoren lovar är en tvist, inte ett skrivfel.**

  **Fakturan står bredvid meningen sedan 2026-09-28**: "Efter passet
  kan ni i stället välja faktura, som kommer i början av nästa månad
  med tio dagars betalningstid och utan avgift", på samma 36 ställen,
  också i mejlen (`notis-ko` version 20, driftsatt från main samma dag
  och jämförd byte för byte). Kontrollen räknar den lika många gånger som
  kortmeningen och läser antalet dagar ur `BETALNINGSVILLKOR_DAGAR`, så
  en ändrad betalningstid som inte når texterna blir röd. Flaggan
  `faktura` slogs på 2026-09-27, med SQL medan Fas 19.7 byggdes, och
  texterna följde med först dagen efter; Leo valde att ha kvar den.
  Slås den av ska meningen bort i samma ändring och `FAKTURA_I_TEXTEN`
  i kontrollen bli `False`. Villkoren har en egen punkt om fakturan
  (`#faktura`): de pass under månaden som valts, spärren för den som
  inte betalat en tidigare faktura, och att den hållna tiden kommer
  med på den. DEPLOY-BETALNING.md 9.11 har listan över alla ställen och
  det som återstår.
- **Den 25:e** får studiehjälparen betalt, i en klump för månadens
  rapporterade pass (`payouts`). Det är en lön, inte en andel av varje
  kortbetalning. Studiehjälparen ser underlaget som månadens
  lönespecifikation, före skatt (2026-09-28). Blir studiehjälparna
  anställda går underlaget till Fortnox Lön som en PAXml-fil från
  adminvyns Löner (avsnitt 1); anställningsformen är inte avgjord
  (avsnitt 11).
- **Erbjudandenas priser står i `erbjudanden_pris` och ingen
  annanstans.** Timpriset med rabatt avrundas nedåt till hel krona och
  summan är timpris gånger timmar (Fas 16.1d) — förut avrundades
  summan, och 20 timmar kostade 7 201 kr bredvid texten "360 kr per
  timme". Prissidans siffror är en reserv för den som läser utan
  javascript; `NX.initErbjudanden()` skriver över dem ur vyn med ett
  rått PostgREST-anrop, eftersom supabase-js inte laddas på de publika
  sidorna.
- **Priset fryses när passet bokas** (Fas 19.5). Villkoren lovar
  priset vid bokningen, och kortet räknade förut dagens pris. Nu sätter
  `frys_passets_pris` `bookings.timpris_ore` och `extra_ore` vid
  bokningen, och `stripe-checkout`, `pris.ts` (`passpris()`) och
  föräldravyn (`passetsPris`) räknar på dem, med katalogen som reserv.
  En prishöjning gäller bara pass som bokas efter den. En vy kan inte
  ändra kolumnerna: `skydda_bokningsfalt` släpper bara igenom status,
  tid och skäl på ett befintligt pass.
- **Första timmen är på köpet för nya familjer** (Fas 19.5, prissidans
  starterbjudande). `forsta_timmen_bjuds` ger det läxhjälpspass som gör
  att familjen har bokat två timmar en timme i `rabatt_ore`, till
  passets eget timpris, och märker det `startrabatt`. En gång per
  familj; avbokade pass räknas inte, och avbokas passet med rabatten
  får nästa pass som når två timmar den. Två pass på en timme gör alltså
  det andra gratis. Ett pass på noll kronor är INTE betalt (ett betalt
  pass går inte att avboka), det står kvar som `ingen`, och varken
  `ej_betalt`, `obetalda` eller fakturan räknar det. Klippkortet betalar
  inte ett pass med startrabatt. Triggern heter `bookings_startrabatt`
  för att köras efter `bookings_skydda_rabatt`, som nollar
  `rabatt_ore` på varje ny rad från en vy: triggrar på samma händelse
  körs i namnordning.
- Belopp lagras i **ören** överallt. Kronor blir det först vid visning
  (`NXBetalning.kronor`). Enda stället ett avrundningsfel kan smyga in
  är omvandlingen — gör den en gång, på ett ställe.

---

## 2. Stacken

**Inget byggsteg. Ingen pakethanterare. Inget ramverk.** Filerna i
repotroten är filerna som serveras. `supabase-js` ligger som en
vendorad fil i `bibliotek/`.

- **Frontend:** vanilla ES5/ES6 i `<script src>`, delade moduler som
  IIFE:er på `window` (`NX`, `NXStudie`, `NXArbete`, `NXMedia`,
  `NXKontakt`, `NXBetalning`, `NXTjanster`, `NXAgent`, `NXMotion`,
  `NXSamtycke`, `NXUppgifter`)
- **Backend:** Supabase (Postgres + RLS + Auth + Storage) och Deno
  edge functions i `supabase/functions/`
- **Hosting:** Vercel, `cleanUrls: true` (alltså `/priser`, inte
  `/priser.html`). Vercel-botten ska inte kommentera PR:er
  (2026-09-27): varje kommentar blev ett mejl från GitHub till
  info@nextrum.se, ett per PR. Det ställs in hos Vercel, under
  projektets Settings → Git (`gitComments` i API:t; Vercel-kopplingens
  `update_project` saknar fältet). `github.silent` i `vercel.json`
  hjälpte inte: grenen hade nyckeln, och botten kommenterade PR:en
  ändå. Stäng inte av repository_dispatch-händelserna i samma veva
  (`disableRepositoryDispatchEvents` i API:t, som Vercel-kopplingens
  `get_project` inte visar): `indexnow.yml` lyssnar på
  `vercel.deployment.success` sedan 2026-09-27 och tystnar utan dem,
  utan att något blir rött. GitHub-driftsättningarna behöver den inte
  längre (avsnitt 9)
- **Mejl:** Resend
- **Modeller:** Anthropic, bara från edge functions — aldrig från
  webbläsaren

Lokal server: `python3 .claude/serve.py 8951`. Den härmar `cleanUrls`
med flit; `http.server` rakt av svarar 404 på varenda länk.

---

## 3. Filkartan

| Fil | Roll |
|---|---|
| `nextrum-config.js` | **Enda filen som ska ändras vid uppsättning.** URL, anon-nyckel, pris, e-post, utbildningslänk |
| `nextrum-app.js` | `NX` — delad grund: supa-klient, i18n, datum, fel, header, inloggning |
| `nextrum-fel.js` | Felrapportering till `klientfel`. Laddas **före** `nextrum-app.js`, annars missas uppstartsfelen. Vem felet gällde sätter databasen (`intern.klientfel_vem`, 2026-09-28) ur `auth.uid()` och skriver över det klienten skickar: kolumnen fylldes aldrig förut, och varje fel stod som Utloggad. DATASKYDD.md rad 12 och integritetspolicyn räknar med konto-id, 90 dagar |
| `nextrum-modulvakt.js` | Fångar "en modul laddade inte" innan vyn dör tyst på "Laddar din vy". Laddas i **alla tre** vyerna sedan Fas 14.0 — adminvyn saknade den, fast den har 26 skript mot de andras 17. Prövar en FUNKTION per fil, inte bara att globalen finns: en gammal fil i cachen definierar sin global och ser frisk ut. Modulerna nås som IDENTIFIERARE, aldrig som `window[...]` — hälften deklareras `const NX… = …` på toppnivå och hamnar då inte på window |
| `nextrum-samtycke.js` | `NXSamtycke`: samtyckesrutan och det enda stället som svarar på "får vi?". Bara på de öppna sidorna, efter `nextrum-app.js`. Se avsnitt 6, Samtycket |
| `nextrum-images.js` | **Enda stället bildvägar står skrivna.** Aldrig i HTML |
| `nextrum-motion.js` | `NXImg` (bildmarkup), `NXMotion` (scrollmotor), `NXStory`. Tre lägen: full / lite / still |
| `nextrum-studie.js`, `-arbetsyta.js`, `-kontakt.js`, `-betalning.js`, `-media.js`, `-tjanster.js` | Delat mellan vyerna |
| `nextrum-uppgifter.js` + `nextrum-uppgifter.css` | `NXUppgifter` (Fas 23.1): banan, spelaren, stjärnorna, märkena, rättningen per område och genomgången. Studievyn och studiehjälparvyn, CSS:en efter arbetsytan. Rättar ingenting själv och skriver inget resultat; det gör `niva_svara()` |
| `nextrum-studie-vy.js` | Bara `foralder.html` |
| `nextrum-larare-vy.js` | Bara `larare.html` (2 800 rader) |
| `nextrum-admin.js` | Adminvyns **skal**: inloggning, sidomeny, sök, notiser, bevakning och `start()` |
| `nextrum-admin-karna.js` | `NXAdmin`: tillståndet `S`, hjälparna och hämtningarna. **Laddas först** |
| `nextrum-admin-*.js` | Ett område var: detalj, oversikt, kunder, rekrytering, bibliotek, kommunikation, drift, ekonomi, manaden (Månadens ekonomi), loner (Löner), tjanster, system, automationer, ai, radera. Anropar varandra via `NXAdmin.rita`. En ny områdesfil ska in i `nextrum-modulvakt.js` också |
| `nextrum-admin-agenter.js` | Agentfliken. Delar inget med resten av adminvyn |
| `nextrum-maskot.js` + `-maskot-svar.js` | Hjälprutan. **Ingen språkmodell** |
| `nextrum.css` → `-home.css` → `-cinema.css` → `-vy.css` → `-arbetsyta.css` → `-agent.css` | Stillagren, i laddningsordning. **Cinema är sanningen** — den skriver över nästan allt de två första sätter. `-vy`, `-agent` och `-typsnitt` innehåller noll hexkoder och konsumerar bara. Papperet är `#F2EDE3` på hela sajten sedan 2026-09-25 (var `#EFE6D6`); det står i cinemas `:root` och i de ljusa formulär-öarna i mörkt läge, och `theme-color` på varje sida följer med. Mejlen har sin egen kopia av paletten (`FARG` i `_delad/notiser/rendera.ts`) och följer INTE med av sig själva |
| `nextrum-start.css` + `nextrum-start.js` | **Startsidan** (sv och en), efter cinema respektive före sidans eget skript, **och För elever & föräldrar**, som bara använder studievyns illustration ur dem. Rörelsen efter hero: ordfyllnaden, hållpunkterna 1–4, korten som stiger upp, det rullande bandet, bildväggen och studievyn som visar sig själv (en rundtur, men den går inte att klicka i). Skriptet startar av sig självt och skriver ingen text — allt man läser står i markupen, på båda språken |
| `nextrum-admin-palett.css` | Bara `admin.html`, laddas **sist**. Sedan 2026-09-24 **ingen egen palett**: adminvyn ärver jordpaletten som de två andra vyerna. Filen bär bara `--fel`, `--ln-kontroll`, agentflikens `--acc-lugn` och felsemantiken |
| `verktyg/` | Kontroller och generatorer. Körs i CI |
| `supabase/migrations/` | Databasen. `arkiv/` är historik |

Sex stadsdelssidor, fyra ämnessidor (`laxhjalp-*.html`), onlinesidan
(`laxhjalp-online`) och fyra guider (`hjalpa-barn-med-matte`,
`hjalpa-barn-med-lasforstaelse`, `plugga-infor-prov`,
`barnet-vill-inte-gora-laxorna`) genereras; navet
`laxhjalp-stockholm.html` är handskrivet. `/en/` är elva översatta sidor.

### Startsidan efter hero (2026-09-25)

Hero är orörd med flit. Allt annat på startsidan bor i
`nextrum-start.css` och `nextrum-start.js`, och startlägena gömmer
ingenting utan `html.nx-sr` — klassen sätts av skriptet, så en fil som
inte laddar lämnar sidan i slutläget.

**Skriptet sätter klasser, CSS rör sig.** Första versionen räknade om
kort, ord och ett blad över filmen för varje bildruta medan man
scrollade, och studievyns lutning skrev CSS-variabler på fönstret.
Leo: "alla animationer måste se mer smooth ut och inte laggiga". En
scrollkopplad effekt i JavaScript hamnar ur takt med en scroll som
webbläsaren kör på grafikkortet, och **en custom property ärvs** — en
variabel på ett element med hundratals barn räknar om stilen för alla
vid varje skrivning. Nu säger en IntersectionObserver när något syns,
en klass sätts, och resten är transitions på opacity, transform,
translate och scale. Bandet är en Web Animation. Mätt med samma scroll
och musrörelse: stilomräkningen gick från cirka 700 till 165 ms.
Skriv inte tillbaka stil per bildruta, och animera inte box-shadow —
lägg skuggan i ett eget lager och tona dess opacitet.

Fyra saker som kostade en omgång:

1. **`once`-scenerna i `NXMotion` avslöjade aldrig något.** Scenen
   markerades klar efter första anropet, och det kommer när elementet
   når observatörens marginal — innan det syns, med p = 0. Nödbromsen
   visade sedan ALLT efter två sekunder, så sidan såg frisk ut:
   33 av 33 block under vikningen på startsidan var synliga innan
   någon scrollat. Nu är en once-scen klar först när `run()` svarar
   något annat än `false`, och bromsen visar bara det som står i eller
   ovanför vyn. Gäller alla publika sidor.
2. **`preserve-3d` och en rullbar behållare går inte ihop i Chrome.**
   Studievyns fönster lutade mot pekaren. Med `transform-style:
   preserve-3d` gav `elementFromPoint` föräldern i stället för knappen
   i sidomenyn, och klicket gjorde ingenting. Sedan dess har Leo valt
   bort att illustrationen går att röra (fönstret är `inert`), men
   fällan gäller varje lutat lager med något klickbart i.
3. **`scrollIntoView` i en rad som flyttas med transform rullar
   sidan.** Förr visade `NX.initDrag()` kortet man tryckt på. I
   bandet, som klipps och förskjuts med transform, räknade Chrome fram
   ett mål 400 px bort och rullade hela sidan dit. Bandet är
   `overflow:clip`, inte `hidden`, av samma skäl: `hidden` gör det
   till något som går att scrolla. Kanterna tonas med två stilla
   gradienter, inte `mask-image`: en mask över något som rör sig ritas
   om varje bildruta i Safari.
4. **Det som fälls ut i bandet klipps.** Korten var knappar som
   fällde ut en längre text, och bandet klipper sin höjd, så texten
   syntes bara till hälften. Leo 2026-09-27: ta bort den. Korten är nu
   vanliga `div`:ar utan pil, `NX.initDrag()` finns inte längre, och
   de längre förklaringarna (kontrollen, betalningen,
   kommunikationen, uppföljningen) står inte kvar någonstans på
   startsidan. Kopiorna är `aria-hidden` och har egna id:n; en
   skärmläsare hör sex kort, inte arton.

**De mörka ytorna** har sedan 2026-09-25 en varmare bark på hela
sajten: `--nt` är `#2B221C` (var `#2E2A20`, en grönaktig olivbrun som
blev en lerig vägg mot papperet), och `--band-bg` följer med. Sektionerna
(`.nx-mork`, sidhuvudet och bandet på Bli studiehjälpare, "Nästa steg"
på prissidan) mörknar nedåt mot `--nt-2` (`#1F1915`) och har ett svagt
sken av lera och mossa ur `--nt-glod` och `--nt-mossa`, i cinemas DE
MÖRKA YTORNA. Skenet tonar ut före nederkanten, och det som följer
direkt på en mörk yta — footern, bandet under sidhuvudet — börjar i
`--nt-2` utan lera i överkanten: annars syns en ljusare rand där två
mörka block möts. Footern är därför `--nt-2` på alla sidor. I mörkt
läge är `--nt-2` samma som `--nt`, och där är allt som förut. **Hero behåller den gamla tonen**
(`--nt-film`), för hero är orörd med flit.

Ytorna går kant i kant. En första version lade Bli studiehjälpare och
Nästa steg som rundade kort på papperet som växte in med `scale`; Leo
ville inte ha papperet runt dem. Nu står ytan still och innehållet
glider upp med klassen `.nx-framme` — aldrig `.nx-in`, för
`.nx-in .nx-rad-i` i cinema tänder rubrikens rader på en gång. Stegen i
ansökan har samma 1–4-beteende som hållpunkterna; `hållpunkter()` tar
båda listorna.

Studievyns markup byggs för båda språken ur samma mall, så att
taggsekvensen är identisk. Samma markup står på `for-elever-och-foraldrar.html`
(sv och en, 2026-09-25: den gamla `.nx-mock` stod kvar där). Ändras
den på startsidan ska den kopieras dit. `jamfor-sprak.py` rapporterar bara den
FÖRSTA strukturskillnaden, och på startsidan är den språkväljaren —
en skillnad längre ner syns alltså inte i verktyget. Jämför
taggsekvenserna med `difflib` när du ändrar i sektionen.

### Två fällor när en palett byts

Båda kostade en omgång i Fas 11 och syns inte förrän i drift. Fas 11
gav adminvyn en egen mörkblå palett; den togs bort 2026-09-24 för att
adminvyn skulle se ut som samma hus som studievyn och
studiehjälparvyn. Ingen av fällorna gäller alltså i dag — men de
gäller igen den dag någon sätter `--pap`, `--bl` eller `--acc` på en
vy.

1. **En alias-token fryser rotens värde.** `nextrum-cinema.css:263` sätter
   `--muted-2:var(--bl-3)` på `:root`. En custom property med `var()` i
   värdet substitueras där den **deklareras**, inte där den används. Att
   byta `--bl-3` på `body.vy-admin` når den alltså aldrig — `--muted-2`
   ärvs färdigberäknad. Hela mängden som måste upprepas: `--bg`, `--fg`,
   `--muted`, `--muted-2`, `--line`, `--line-2`, `--surface`,
   `--surface-2`, `--btn-bg`, `--btn-fg`, `--focus`, `--tryck-yta`.
2. **Mörkerreglerna väger fyra klassnivåer.**
   `:root:not([data-theme="light"]) .vy .dbox` i `nextrum-vy.css:679` är
   (0,4,0). En `.vy-admin .dbox` är (0,2,0) och förlorar — men bara i
   mörkt OS-läge, alltså precis det läge den som bygger sitter i.

Och: **`--acc-lugn` är hover-accenten, inte en felfärg.** `cinema.css:517`
har `.btn-primary:hover{background:var(--acc-lugn)}`. Den betyder "fel"
bara i agentfliken.

### Fyra fällor som gör vyerna hackiga

Leo 2026-09-24: "när man trycker på knappar skickas man uppåt" och
"det är laggigt". Inget av det syns i Chrome på en dator, och därför
hade inget av det upptäckts. Mätt i provbänken med 250 ms per fråga,
strypt processor och scroll anchoring avstängd (som Safari):

1. **Byt aldrig en lista som har innehåll mot "Hämtar".** Sidan krymper
   med listans höjd, webbläsaren klämmer scrollen, och man hamnar
   1 000–1 800 px högre upp (läxornas "Klar"). Chrome kompenserar med
   scroll anchoring; **Safari har ingen**. Använd
   `NXStudie.laddarFörsta(host)`: "Hämtar" bara första gången, annars
   står listan kvar nedtonad tills den nya är ritad. Ett formulär som
   stängs ovanför det man tittar på hålls med `NXStudie.håll(ankare, fn)`.
   Samma sak inom en och samma omritning: tar man bort något och visar
   det som ersätter det först efteråt, räcker en påtvingad layout
   emellan (ett `focus()`, en `getBoundingClientRect`) för att scrollen
   ska klämmas. Visa det nya först (`ritaPlanElev`, 2026-09-28).
2. **`1fr` i ett grid är `minmax(auto,1fr)`.** Bokningens kolumn växte
   till 614 px på en 390 px bred telefon så fort en dag valdes, för att
   ämnesraden (en rad man drar i sidled) räknades som kolumnens minsta
   bredd. Tiderna låg utanför skärmen och sidan gick att dra i sidled.
   Skriv `minmax(0,1fr)`.
3. **Det som rör sig kostar hela tiden.** Toppen i vyerna spelade en
   video i loop, med en zoomande bild under och suddiga kort ovanpå —
   och sidhuvudet räknade om en oskärpa vid varje scrollsteg. Nu: ingen
   video under 700 px, allt pausas när toppen inte syns, ingen
   `backdrop-filter` på sidhuvudet i vyerna. Mjuk scrollning är
   avstängd i vyerna (`html:has(> body.vy)`): den fick varje fokus och
   varje omritning att glida iväg med sidan.
4. **Det som står ovanför det man trycker på får inte byta höjd av
   trycket.** Leo, samma dag efter merge: "det hoppar när man väljer
   längd och tid". Bokningens stegrad visade på en telefon bara det
   pågående steget och de gjorda — den växte 40 px vid varje val, och
   hjälpraden under bytte mellan två och tre rader. En vald tid sköt
   tiderna 69 px nedåt under fingret. Nu syns alla tre stegen hela
   tiden, hjälpraden har reserverad höjd, och bokningen ritar om
   genom `stilla()`, som håller det man tryckte på kvar med
   `NXStudie.håll`. Samma omritning nollställde dessutom ämnesraden i
   sidled — en rad man dragit fram Engelska i hoppade tillbaka till
   Matematik.

**Känslan i studievyn och studiehjälparvyn** (2026-09-25, sist i
`nextrum-arbetsyta.css`, `.vy:not(.vy-admin)`): rundare ytor, runda
dagar och tider som piller, och ett tryck som sjunker med `scale` och
fjädrar tillbaka. Aldrig `transform` (cinemas `.btn:active` äger den)
och aldrig en storlek som ändras av trycket (punkt 4). Ingen
animation på `[aria-pressed]`: bokningen ritar om sin panel vid varje
tryck, och allt som redan var valt hade studsat varje gång. iPhone
tänder `:active` först med en touch-lyssnare på sidan; den står i
`nextrum-studie.js`.

### Innehållet i studievyn och studiehjälparvyn (2026-09-28)

Leo: "spalterna till vänster är snygga men innehållet kan bli
snyggare", och sedan "det behöver se bra ut på mobil och enkelt att
använda". Förslaget visades som skärmbilder bredvid skisser och godkändes
("jätte bra"). Sidomenyn är orörd, och adminvyn också:
allt står sist i `nextrum-arbetsyta.css` under `.vy:not(.vy-admin)`,
avsnittet INNEHÅLLET. Sex regler:

1. **Färgen på ett läge säger vems drag det är.** Lera är ert drag
   eller ett fel, ockra väntar på någon annan, mossa är klart. Förut
   hade Betalt och Ej betalt samma grå kant. De mjuka tonerna
   (`--mossa-soft`, `--ockra-soft` och texttonerna), `--yta`,
   `--yta-fot`, `--tint` och `--bricka` står i cinemas `:root`, i båda
   mörka blocken; avsnittet i arbetsyta har inga egna hexkoder.
2. **Ett drag överst, resten längst ner.** Passets sida
   (`NXStudie.passSida`) tar `datum`, `val` (betalvalen), `belopp`,
   `fakta` och `fot`, och ett block med `forst` står direkt under
   beskedet. Föreslå ny tid, skriv och avboka står i foten, och Avboka
   är en stilla länk (`.ps-fot-lank`), inte en knapp lika stor som
   Betala. Samma i båda vyerna.
3. **En knapp per rad i en lista** (`radBetala`). Två knappar bredvid ett
   märke bröt raden i tre på en telefon. Alla betalval står på passets
   sida, dit raden leder.
4. **Tiden och platsen ritar `NXKontakt.passRad`**, med ikon, ur passet.
   Anroparen skickar `med` ("med Alva"), `not`, `varning` och `lage`
   (null tar bort märket), inte tid eller plats i `under`: förut stod
   platsen två gånger när både raden och anroparen skrev den.
5. **Betalvalen heter `.vy-betalval`, inte `.vy-val`.** `.vy-val` är
   ämnes- och formatväljarna i formulären, och första versionen gjorde
   dem till ett rutnät med 220 px breda celler.
6. **Månaden väljs med en stegare** (`månadsval` med `stegare: true`) i
   studiehjälparens rapporter och ersättning och i familjens Bekräftade.
   Raden med tolv knappar låg i en dold flik när den ritades, så den
   innevarande månaden hamnade utanför kanten. "Den här månaden" står
   alltid och tar sin plats, osynlig på den innevarande, annars sköt den
   ner allt under raden efter första trycket. Adminvyns Ekonomi har kvar
   raden: där jämför man månader bredvid varandra.

Och några saker som kostade en omgång: basrubriken `h5` bär en
`margin-top` i em, som med den större rubriken blev 27 px luft överst i
varje kort. En grupp som döljs när den är tom ligger i en `.vy-del`, och
då är rubriken första barnet där och tappar sin luft; regeln för
`.vy-del` ger tillbaka den. Studietiden per vecka på Översikt är fyllt
(genomfört) och streckat (bokat) i samma mossa: mossa och lera som två
serier föll i palettprovet för färgblinda. Krockkollen på föreslagna
tider (`krockFör`) finns bara i vyn: databasen nekar två bekräftade pass
på samma starttid, inte två som överlappar.

**Tummen** (samma kväll, Leo: "är det smidigt att använda mobilen?").
Mätt på 360 och 390 px i varje sektion av båda vyerna: inget spillde
över kanten och inget hoppade, men tre saker var fel.

1. **Tryckytorna var för små.** Kalenderdagarna i Boka pass var 34 px
   med dött mellanrum, schemats pilar 28 px, länkarna 21 px och de
   små knapparna 29–39 px. Under TUMMEN i `nextrum-arbetsyta.css` får
   de minst 44 px på en smal skärm eller med ett finger som pekare,
   länkarna en osynlig yta runt texten (`::after`), och i månadens
   schema är hela dagens ruta passets tryckyta när dagen har ett pass.
   Ett tryck i ytan provas med `elementFromPoint`, inte med
   `getBoundingClientRect`, som inte ser `::after`.
2. **Sektionsraden stod still.** Långt ned på en sida fanns ingen väg
   till en annan sektion utan att rulla upp. Den står nu fast under
   sidhuvudet under 900 px (`--vy-hdr-h`, satt av `sidomeny` på raden
   och inte på `:root`), och den aktiva posten dras in i raden.
3. **Ett sektionsbyte lämnade en mitt i nästa sektion.** Sidan
   flyttades bara när webbläsaren klämt ned scrollen; var nästa sektion
   lika lång stod man kvar på samma höjd. "Till rapporten" långt ned i
   Betalning ledde till mitten av Bekräfta rapport, med rubriken 1 000
   px ovanför skärmen. Nu läggs sektionen vid sin början när man annars
   inte hade sett den, direkt och utan animering, i alla tre vyerna.
   `täcktÖverst()` räknar sidhuvudet och den fasta raden, så att
   rubriken inte hamnar bakom den.

Sidhuvudet i vyerna är helt täckande sedan dess: med 97 % syntes text
som rullade under det. Hälsningen överst tar fortfarande 446 px av en
844 px hög telefon, med flit: nästa pass och meddelandena står där.

Provbänken (`skanna.js` i en scratchpad, inte i repot) trycker på varje
knapp i varje sektion och rapporterar hopp över 40 px. Admin var ren.
Den mäter `scrollY`, inte vad som står stilla på skärmen, så fällan i
punkt 4 syntes inte i den: sidan scrollade inte, innehållet flyttade
sig. Mät ett element före och efter trycket (`getBoundingClientRect`).

---

## 4. Språk

**Koden är svensk.** Identifierare, kommentarer, commit-meddelanden,
filnamn, tabellkolumner. Skriv inte engelsk kod i den här kodbasen.

**Sidorna finns på två språk.** `/en/` är genererad ur de svenska
sidorna genom att textnoder byts ut en och en. Taggsekvensen är därför
identisk mellan språkparen, och det är precis vad
`verktyg/jamfor-sprak.py` utnyttjar.

Fyra saker att veta, alla dyrköpta:

1. **Generatorn översätter aldrig `<script>`.** Allt som skrivs till
   användaren från JavaScript måste därför ligga som ett **par** i
   `ORD` i modulen (`nextrum-app.js` `NX.t()`, `nextrum-tjanster.js`
   `ord()`), med språket läst ur `<html lang>` vid körning. En etikett
   skriven i sidans eget skript blir svensk på den engelska sidan och
   **ingen strukturkontroll ser det**.
2. **Bara det som visas.** Strängar som skrivs till databasen
   ("Telefon: ", "Läst integritetspolicyn: ja") förblir svenska — de
   läses av oss.
3. **Generatorn finns inte i repot.** `/en/`-sidorna är incheckade
   artefakter. Ändras en svensk sida måste engelskan följa med för
   hand, och `jamfor-sprak.py` är det som upptäcker att den inte gjort
   det.
4. **Baslinjen.** `verktyg/jamfor-sprak-baslinje.txt` innehåller de
   avvikelser som är avsiktliga (språkväljaren `<b>SV</b>` vs `<a>`,
   personnamn som inte översätts). CI diffar mot den. **Allt nytt är ett
   fel** — uppdatera baslinjen bara när avvikelsen är avsiktlig.

---

## 5. Databasen

**Sanningen om vad som är kört står i databasen, inte i filnamnen:**

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

- Ny SQL skrivs som `supabase/migrations/<version>_<namn>.sql`, där
  versionen är exakt den `apply_migration` registrerade.
  `verktyg/kolla-migrationer.py` vaktar namnregeln i CI.
- **Klistra aldrig in SQL i SQL Editor utan att den också blir en fil.**
  Det var så tre nummer (v13, v16, v17) kom att tas två gånger.
- `supabase/migrations/arkiv/` är de gamla `schema-v*.sql`. **Ändra dem
  inte** — en rättelse är en ny migration, inte en omskriven historia.
  `arkiv/README.md` mappar varje fil mot sin version i driften.
- `arkiv/schema-v22.sql` kördes **aldrig**. Kör den inte. Ersatt av v25.
- `arkiv/schema.sql` **rensar tabellerna**. Bara i tom miljö.

Projekt-ref i drift: `ddkfiuvcppalutfulvbi`.

Tabeller: `profiles`, `students`, `tutor_profiles`, `tutor_availability`,
`tutor_blocked`, `tutor_reviews`, `bookings`, `lesson_reports`,
`homework`, `materials`, `study_plans`, `progress_items`,
`student_notes`, `messages`, `leads`, `applications`,
`contact_messages`, `invoices`, `invoice_lines`, `payouts`,
`payout_lines`, `tjanster`, `prissattning`, `rabattkoder`,
`integrationer`, `notis_konfig`, `klientfel`,
`agent_korningar`, `agent_steg`, `admin_noteringar`, `foretagsfakta`,
och sedan Fas 5–7: `uppdrag`, `uppgifter`, `audit_logg`, `rut_tak`,
`kund_skatteuppgifter`. Fas 8–9 la till `ai_forslag`, `ai_konfig` och
`handlingar`. Fas 13.2 la till `biblioteksmaterial`. Fas 15.3 la till
`progress_historik` (skrivs bara av en trigger; ingen skrivpolicy).
Fas 14.3 la till `stripe_tvister` (skrivs bara av `stripe-webhook`,
läses bara av admin). Fas 14.6 la till `faktura_sparr` (admin skriver,
familjen läser sin egen rad). Fas 14.8 tog bort `fortnox_token`, som
hörde till en Fortnox-koppling som aldrig gjordes, när bokföringen
skulle ligga i Wint. Fas 14.9 bytte Wint mot Fortnox, utan koppling:
`fortnox_token` kom inte tillbaka, och `invoices.wint_fakturanummer`
heter `fortnox_fakturanummer`.
Fas 16.1 la till `erbjudanden` (katalogen, alla läser) och `klippkort`
(köpen: familjen läser sina, bara `service_role` skriver), med vyerna
`erbjudanden_pris` och `klippkort_saldo`. Timmarna dras bara i
`klippkort_dra()`, och triggrarna för klippkortet är EGNA — de rör inte
`skydda_bokningsfalt` eller `avvikelser_rader`, som Fas 14.6 skrev om.
Fas 22.1 la till `timbank_uttag` (minuterna familjen använt ur timbanken
eller fått utbetalda: parterna och admin läser, bara databasen skriver),
med vyerna `timbank_saldo` och `timbank_rorelser`. Insättningarna står
inte i någon tabell, de räknas ur passen. Fas 22.2 la till vyn
`klippkort_rorelser` (passen varje kort betalat) och triggrarna
`bookings_timmar_betalar` och `klippkort_betalar_passen`, som låter
timmarna betala passen av sig själva (avsnitt 1). Fas 22.3 la till
pg_cron-jobbet `timmar-betalar`, som låter timmar som blivit lediga
betala nästa bekräftade pass. Fas 22.4 la till
`bookings_timmar_betalar_forslaget` och
`intern.obesvarade_forslag_slapper_timmarna`: timmen dras när förslaget
skapas och kommer tillbaka om ingen svarat när dagen gått.
Lönespecifikationen (2026-09-28) la till pg_cron-jobbet `manadskorning`,
den 1:a klockan 04:17 UTC, och `notis_konfig.fakturering_url`.
`intern.manadskorning_vack()` väcker `fakturering` genom
`intern.natanrop` med hemligheten i `x-nextrum-notis`, och den vägen
skriver alltid förra månaden. Saknas adressen blir det en uppgift
(`manadskorning:adress`) i stället för en tyst månad; går anropet fel
står det under System → Fel och passen larmar som `ej_utbetalt`.
Adminvyn visar om jobbet är på (`manadskorning_lage()`, bara admin): ett
schema som står av ser annars ut precis som ett som fungerar.
**Jobbet är på sedan 2026-09-28**, efter stegen i DEPLOY-BETALNING.md
avsnitt 6: `fakturering` version 32 driftsatt från main och jämförd
byte för byte, väckningen torrkörd, och sist migrationen med jobbet.
Det som körs skarpt skriver underlag och fakturautkast för allt som
står klart, och provpasset den 27 september undantogs inte: Leo ville
se hur lönespecen ser ut. Körningen den 1 oktober skriver därför ett
underlag på 240 kr och ett fakturautkast på 758 kr för det, som ska
tas bort när lönespecen är sedd, inte betalas ut eller läggas in i
Fortnox (DEPLOY-BETALNING.md avsnitt 6). Hela `rls-test.sql` gick
igenom mot driften efteråt, 702 av 702.
Fas 16.1 la också till `ansokan_utskick` (beskeden till den som sökt jobb;
skrivs bara av triggern och funktionen, läses bara av admin).
Fas 22.1 (utbildningsprovet) la till `utbildningsprov_forsok` (varje
försök på provet: admin läser, bara `utbildningsprov_lamna()` skriver)
och fyra kolumner på `applications`: `utbildningsmote_at`,
`prov_sista_dag`, `prov_nyckel` och `prov_godkant_at`. Numret krockar:
timbanken kördes som `fas22_1_timbanken` samma förmiddag i en annan
session. Namnen i driften går inte att byta i efterhand.
Fas 18.1 la till `google_koppling` (nyckeln till Nextrums Google-konto:
RLS utan policy, bara `service_role`) och `pass_moten` (Meet-länken per
pass: parterna och admin läser, bara `service_role` skriver, och
villkoret på kolumnen släpper bara igenom `https://meet.google.com/…`).
Fas 19.1 la till `rapport_bekraftelser` (familjen har läst rapporten).
Familjen får skriva EN kolumn, `rapport_id`, genom ett kolumnvis
grant; vem och när sätts av databasen, så en bekräftelse går varken att
skriva i någon annans namn eller bakdatera. Ingen update eller delete,
och admin bekräftar inte åt en familj. Egen tabell och inte en kolumn
på `lesson_reports`, för en uppdatering där kör fyra triggrar.
Fas 20.1 la till `pass_tillagg` (övertiden på ett förbetalt pass:
parterna och admin läser, bara `service_role` skriver) och Fas 20.2
`manadsbokslut` (stängda månader: admin läser, bara `stang_manad` och
`oppna_manad` skriver).
Fas 23.1 la till `nivaer` (katalogen: alla inloggade läser, admin och
migrationerna skriver), `niva_fragor` (frågorna MED facit: familjen har
ingen policy, godkända studiehjälpare och admin läser), `niva_forsok` och
`niva_svar` (försöken och svaren: familjen, elevens studiehjälpare och
admin läser, bara `niva_starta()` och `niva_svara()` skriver) och
`homework.niva_id`. `niva_fragor` får aldrig en rad borttagen som har
svar: en ändrad fråga får ett nytt id och den gamla blir inaktiv, så att
gamla svar pekar på det som faktiskt frågades.
Den första tabellen i `intern` kom 2026-09-27: `intern.natanrop_logg`,
id:t på databasens egna pg_net-anrop (skrivs bara av `intern.natanrop()`,
ingen roll utom ägaren når den). Se Notiserna nedan.

**Flera sessioner kör mot samma databas samtidigt.** Fas 19.5 och Fas
20.1 skrevs samma förmiddag i två sessioner och ändrade båda
`avvikelser_rader`, `klippkort_dra` och `passunderlag`. Den som skrev om
en funktion ur sin egen kopia hade tagit bort den andras ändring utan
att något blev rött. Båda lappade därför med `replace()` på
`pg_get_functiondef()` och en vakt som räknar att texten hittades exakt
så många gånger som väntat, och vyns kolumner lästes i driften före
`create or replace view` (en vy kan inte tappa kolumner, så felet kom
direkt, men först i driften). **Läs driften, inte grenen, innan du
ändrar en funktion eller vy någon annan också ändrar.**
Runda 2 la till notisernas sju: `notiser` (i vyn), `notis_utskick` (kön), `notis_val` (av och på per person, typ och
kanal), `notis_installning`, `notis_drift`, `notis_korningar` och
`notis_fel` — plus `flaggor`, som är strömbrytarna för det som
väntar på ett beslut om affär, juridik eller pengar.

Schemat **`intern`** (Fas 10.3) bär funktioner databasen behöver för
sin egen skull och som inte är ett API. PostgREST exponerar det inte.
Lägg inget där som ett gränssnitt ska anropa.

**Auditloggen (Fas 6) går inte att ändra.** `audit_logg` skrivs av
triggern `logga_andring`, som bara loggar VITLISTADE kolumner — aldrig
namn, adresser, meddelandetexter eller fritext om barn. Update, delete
och truncate är blockerade, också för admin. Lägger du en trigger på en
ny tabell: ta med tillstånd och kopplingar, inte innehåll.

Sedan Fas 9.3 täcker den hela passets liv (skapat, status, närvaro,
avbokning), rapportens födelse, AI-taket, vem som tog hand om ett
kontaktmeddelande, att ett klientfel städats bort och att bolagsfakta
ändrats. `materials` och `admin_noteringar` har MED FLIT ingen trigger:
ett filnamn heter i praktiken "Provräkning Alva v42.pdf".
`kund_skatteuppgifter` har ingen heller — funktionerna skriver redan
sina egna rader, och en trigger hade dubbelloggat.

**Sökningen i loggen går genom `audit_sok()`** (Fas 9.8), som filtrerar
OCH räknar i databasen. Totalen kommer ur `count(*) over ()` på den
filtrerade mängden, alltså före `limit`. Förut hämtades 300 rader och
filtrerades i webbläsaren — det fungerar medan loggen är tom och
slutar fungera tyst vid rad 301. Funktionen är SECURITY INVOKER: den
är ingen väg runt policyn.

**AI-märkningen i loggen läses inte ur `aktor_typ`.** Drift-agenten
talar med databasen genom adminens egen token, så `auth.uid()` ÄR
adminen och `aktor_typ` blir `admin` — det är med flit, för det är så
`skydda_*`-triggrarna fortsätter gälla. En rad märks i stället genom
att den sammanfaller med ett utfört `ai_forslag` på samma objekt:
`godkann_forslag` sätter `utford = now()`, och auditraden får samma
`now()` i samma transaktion.

**En tjänst får inte vara aktiv och oklar** (Fas 10, Fas 14.2).
`skydda_tjansteaktivering()` prövar fyra INVARIANTER vid varje skrivning
på en aktiv rad — inte bara vid påslaget, annars gick det att aktivera
rätt och sedan tömma priset:

1. tjänsten måste gå att boka eller söka till
2. `for_kund` kräver ett pris. Annars tar `stripe-checkout` läxhjälpens
   timpris ur `prissattning` för den och drar det av familjen som om det
   vore tjänstens eget
3. `extra_personer_max > 1` kräver ett tillägg, annars blir det tyst noll
4. `for_kund` och `rut_berattigad` går inte ihop (Fas 14.2). RUT drogs
   bara i månadsfakturan. Kortbetalningen tar hela beloppet, så en
   RUT-tjänst hade tagit fullt pris av en familj som lovats halva, och
   ingen hade begärt resten från Skatteverket. Att PLANERA en RUT-tjänst
   går: invarianten gäller en aktiv rad

**Avstängning släpps alltid igenom.** Den är nödbromsen.

Planen sa "pris, ersättning, krav och bokningstyp". Tre av dem gick
inte att koda: `bokningstyp` och `krav` är NOT NULL med förval och kan
aldrig "saknas", och `ersattning = null` är ett BESLUT som betyder
studiehjälparens egen timpenning — läxhjälp är aktiv med null, så ett
ovillkorligt krav hade låst 379-kronorsraden. De tre hör hemma i
lanseringschecklistan i adminvyn, där en människa läser dem.
**Ändras triggern måste spegeln i `nextrum-admin-tjanster.js` följa
med**, annars kommer felet ut som rå servertext.

**Spärren "ingen betalning, inget pass" är en flagga** (Fas 14.2):
`kortsparr` i `flaggor`, samma mekanism som `notiser_mejl`. Är den på
nekar `skydda_bokningsfalt` `completed` på ett fakturerbart pass vars
`betalning_status` inte är `betald` eller `tvist`. Rapporten gör passet
genomfört i samma skrivning (`rapport_gor_passet_genomfort`), så det
är rapporten som nekas, med ett meddelande som säger varför. Admin går
förbi, som i resten av triggern. Står den av syns ett hållet obetalt
pass i stället som avvikelsen `ej_betalt`, som ersatte `ej_fakturerat`.
**Sedan Fas 19.2 går den inte att slå på**: villkoren låter familjen
betala efter passet, och spärren nekar just den rapporten familjen ska
bekräfta. `flaggor_kortsparr_av` är ett check-villkor på `flaggor`, och
adminvyn har ingen Slå på-knapp. Ska villkoren tillbaka till betalning
före passet tas villkoret bort i samma migration som texterna ändras.
`betald_men_avbokad` (Fas 14.2c) är samma sak åt andra hållet: ett
avbokat pass som familjen betalat, med beloppet som inte gått tillbaka.

**Materialbiblioteket är kurerat** (Fas 13.2). `biblioteksmaterial` är
Nextrums delade bank, inte elevens: `materials` gick inte att använda
eftersom `student_id` är NOT NULL, skrivpolicyn kräver
`is_my_student()` och hinken `material` kräver ett elev-uuid först i
sökvägen.

- **`delad` skiljer två sorter i samma tabell** (Fas 13.3).
  `delad = true` är Nextrums BANK: bara admin skriver, alla godkända
  studiehjälpare läser. `delad = false` är studiehjälparens EGET: bara
  ägaren ser och ändrar det. Banken är kurerad med flit — blir den ett
  fritt uppladdningsutrymme är den inte längre ett urval, och då är
  filtret på ämne och årskurs ingenting värt.
- **`delad` går inte att slå på nerifrån.** Uppdateringspolicyn har
  `not delad` i BÅDE using och with check, så en studiehjälpare kan
  ändra sitt eget men aldrig lyfta in det i banken. Admin gör det med
  knappen "Lyft in i banken", och bara åt det hållet: en delad rad som
  lämnades tillbaka hade försvunnit ur listan hos alla som redan gett
  den som läxa.
- **`ar_godkand_studiehjalpare()`** är den första policyn som ställer
  frågan "är den här personen godkänd" i databasen. Före Fas 13.2
  nämnde noll policyer `tutor_profiles` — det var något adminvyn visste
  och databasen inte.
- **`homework.bibliotek_id` PEKAR, den kopierar inte.** Ett övningsblad
  som rättas ska rättas en gång. `on delete set null`: en läxa som
  getts ska inte försvinna för att banken städas.
- **Familjen når materialet sin läxa bygger på, även om raden stängts
  av och även om den är någons egen.** Den policyn frågar inte efter
  `delad`: läxan ÄR kopplingen. En läxa vars material ger tomt svar är
  en läxa som inte går att göra.
- **`materials` når inte familjen längre.** Både studiehjälparvyns
  materialflik (Fas 13.3) och adminvyns detaljpanel skrev dit; fliken
  är ombyggd till biblioteket, panelen står kvar som VÅRT underlag om
  eleven och säger det i klartext. Vägen till familjen går genom
  biblioteket och en läxa, ingen annanstans.
- **Årskursen är enskild och låst** (`ak1`–`ak9`, `gy1`–`gy3`), och
  koden är inte etiketten. `NX.ARSKURSER` i `nextrum-app.js` speglar
  check-villkoret; `NX.AMNEN` är samma lista i alla tre vyerna.
  Fritext hade betytt att "åk7", "Åk 7" och "7" blir tre årskurser, och
  ett filter som tappar två tredjedelar av banken ser ut som ett tomt
  bibliotek.
- `verktyg/rls-test.sql` har nitton BIB-rader, sju av dem om
  delningen. Kör dem efter varje ändring i policyn.

**Uppgifter som maskiner skapar går genom `skapa_uppgift()`** (Fas 7),
som kräver en nyckel och vägrar skapa en till när det redan finns en
öppen med samma nyckel. Adminvyn skriver direkt i `uppgifter` under sin
egen policy. Kontrollerna (`kontroll_saknade_rapporter`,
`kontroll_ekonomiska_avvikelser`, `paminnelse_forfallna_fakturor`,
`uppfoljning_leads_och_ansokningar`) SKAPAR bara uppgifter — ingen av
dem skickar något, och ingen av dem är schemalagd. `kor_kontrollerna()`
kör alla fyra från fliken System → Automationer.

**Analysvyerna (Fas 9.6) bär tre regler.** `analys_leads_per_kalla`,
`analys_konvertering`, `analys_aktiva`, `analys_ekonomi` och
`analys_avbokningar` är alla `security_invoker=true`.

1. **"Genomfört pass" betyder `passunderlag.har_rapport`**, aldrig
   `status='completed'`. Ordlistan säger att passet är genomfört först
   när rapporten finns, och tre av fem completed-pass i driften saknar
   rapport. Räknas de med blir varje siffra om verksamhet, ersättning
   och beläggning för hög.
2. **Varje rad bär `underlag_rader`** — hur många rader ur
   grundtabellen just den raden räknats fram ur, så att talet går att
   stämma av mot en rå fråga.
3. **Luckor redovisas, de fylls inte.** Anmälningar utan `kalla` står
   som okända (inte "direkt"), avbokningar utan `avbokad_at` hamnar på
   en rad med `manad = null` (inte på passets månad), och
   konverteringar utan `leads.kund_id` räknas i `ej_sparbara`. Inget av
   det bakfylldes: en gissad siffra räknas med i medelvärdet utan att
   någon ser att den är gissad.

### Gallringen (2026-09-27)

Integritetspolicyn lovar lagringstider, och det är databasen som
håller dem, inte en människa som kommer ihåg. `DATASKYDD.md` har hela
registret; det här är det som rör koden.

- **Intresseanmälningar avidentifieras, de tas inte bort.**
  `intern.leads_avidentifiera()` (pg_cron `leads-avidentifiering`,
  varje natt) tömmer namn, e-post, barnets namn, fritexten och
  noteringen sex månader efter senaste kontakten
  (`intern.leads_avidentifieras_fran()`, enda stället regeln står).
  `email = 'gallrad'` är markeringen. Raden står kvar så att
  analysvyerna räknar lika många anmälningar bakåt i tiden.
- **Konton raderas aldrig automatiskt.** `intern.konton_oanvanda()`
  (`konton-oanvanda`, den 1:a varje månad) gör ett konto som inte
  använts på två år till en uppgift. Ett konto hänger ihop med
  bokföringsunderlag som ska sparas i sju år, och det avgör en
  människa.
- **Ett jobb som fastnat blir en uppgift** (`gallring:leads:fastnat`).
  Ett jobb som tyst slutat fungera ser annars ut som ett som inte har
  något att göra.
- **Kontaktmeddelanden tas bort efter sex månader, klientfel efter
  nittio dagar** (`intern.kontakt_och_fel_gallra()`, pg_cron
  `kontakt-och-fel-gallring`). Notiserna har egna tider i
  `notis_stada()`: 180 dagar i vyn, 90 för utskicken.
- **AI-texterna och de avslutade uppgifterna** (2026-09-28,
  `intern.ai_och_uppgifter_gallra()`, pg_cron
  `ai-och-uppgifter-gallring`): agentloggens text efter 90 dagar
  (`gallra_agentloggen(90)`, som bara kördes från en knapp förut),
  `ai_forslag.motivering` 90 dagar efter beslutet, och klara eller
  avbrutna uppgifter ett år efter att de stängdes. `frys_forslaget`
  släpper igenom exakt den tömningen: till null, på ett avgjort förslag,
  utan inloggad användare. Allt annat i ett förslag är fortfarande fryst.
- **`landningssida` bär bara våra egna utm-taggar.** `NX.källa()` sparade
  förut hela adressen, med annonsnätverkens klick-id (`gclid`,
  `fbclid`), som går att koppla till en person hos Google och Meta.
  Avidentifieringen kapar dessutom fältet vid "?".
- Ansökningar och CV:n gallras av `ansokan-gallring`, med samma
  princip: filen först, raden sedan. Se "Gallringen: ansökningar och
  CV:n efter ett år" nedan.

### Rätta och radera en person (2026-09-28)

Leo: "alla personer som finns i våra system i admin, ska vi kunna
redigera och trycka ta bort på", och "radera personen från våra system
med en knapp där ifall personen inte ska anställas eller om personen
inte vill senare ha vår tjänst".

**Listorna är namn.** Intresseanmälningar, Ansökningar (med flikarna
Intervju och Utbildning), Familjer, Elever och Studiehjälpare ritas av
`namnlista()` i `nextrum-admin-karna.js`: namnet och läget, inget annat.
Allt annat står i personpanelen (`nextrum-admin-detalj.js`), som sedan
dess också öppnar anmälan och ansökan. Rekryteringens steg är fliken
Rekryteringen där; rutan de stod i förut är borta. Söket i sidhuvudet
öppnar träffen i panelen. Panelen ritas om när en lista gör det, utom
när något i den är påbörjat (`ritaPanelen()`): listorna ritas om när en
anmälan kommer in via realtid, och det hade suddat ut en halvskriven
anteckning.

**Redigera** sist i Översikt rättar de kolumner vyerna och formulären
själva skriver (`RED` i detalj.js), och bara det som ändrats skrivs.
E-posten på ett konto är inloggningen och ändras inte där: profiles
följer inte med när adressen byts i Auth. CV-raden i en ansökans `why`
står utanför formuläret och läggs tillbaka när texten sparas, för den är
enda kopplingen till filen (`CV_RAD`).

**Radera** (`nextrum-admin-radera.js`) frågar först `radering_lage()` och
visar svaret; `radera_person()` gör det. Båda är SECURITY DEFINER med
`is_admin()` på första raden, och samma `intern.radering_underlag()`
avgör vad rutan lovar och vad som händer. Sju regler:

1. **Databasen väljer sättet.** *Helt* när ingenting om personen är
   bokföring: inloggningen (`auth.users`) tas bort och resten följer med
   genom nycklarna. *Avidentifieras* annars: kontot heter "Raderad
   familj" eller "Raderad studiehjälpare", barnen "Raderad elev",
   adress, telefon, profilbild, chatten, läxorna, planerna, försöken på
   de digitala uppgifterna och rapporternas text är borta, och
   inloggningen stängs som GoTrues egen mjuka radering gör. Försöken
   (`niva_forsok`, Fas 23.1) tas bort bara när tabellen finns, så att
   de två migrationerna kan köras i vilken ordning som helst. Vad som är bokföring står i
   `intern.passet_bar_bokforing()` och ingen annanstans.
2. **Pengar som inte är uppgjorda hindrar.** Betalt men inte hållet,
   timmar eller minuter kvar, en öppen kassa eller tvist, betalt för
   länge, ett pass som börjat utan rapport, och för en studiehjälpare
   matchade elever och kommande kortbetalda pass. Pengar personen är
   skyldig oss hindrar inte: de står som larm i rutan, och admin
   bestämmer.
3. **Samma adress följer med** (`intern.epost_nyckel`): anmälningar
   avidentifieras som i nattjobbet, ansökningar och frågor tas bort. Det
   är personen som raderas, inte en rad.
4. **Kommande obetalda pass avbokas**, med skälet `familjen_avslutar`
   eller `ingen_hjalpare`, och motparten får mejlet. Den som raderas får
   inget: `raderad_at` sätts först, och `notis_vill()` svarar nej för ett
   raderat konto.
5. **Filen först, och databasen vaktar ordningen.** `radering_lage()`
   svarar med profilbilden, barnens mapp och CV:t, adminvyn tar bort dem
   genom Storage och läser svaret, och `radera_person()` vägrar medan en
   fil finns kvar. Admin fick därför ta bort i hinkarna `cv` och
   `avatarer`.
6. **Ett adminkonto raderas inte här**, inte heller ens eget.
7. **Auditloggen får en rad utan namn**: `konto.raderat` eller
   `konto.avidentifierat`, `elev.raderad` eller `elev.avidentifierad`,
   `anmalan.avidentifierad`, `kontaktmeddelande.borttagen` och, genom
   sin egen trigger, `ansokan.borttagen`.

`profiles.raderad_at` och `students.raderad_at` är markeringen, och bara
databasen och admin sätter dem (`skydda_profilfalt`,
`skydda_studentfalt`). Ett avidentifierat konto eller barn står inte i
någon lista (`ärRaderad()` i kärnan), och en familj ser inte ett raderat
barn (policyn `förälder ser egna barn`). Ett gammalt pass pekar
fortfarande på dem, och panelen säger då varför namnet är borta.
`intern.konton_oanvanda()` hoppar över raderade konton.

**Radera aldrig en person i dashboarden.** `bookings.parent_id` är ON
DELETE CASCADE: ett konto som tas bort där tar med sig sina betalda pass,
och bokföringen med dem. Ett konto med klippkort går inte att ta bort
alls där (`klippkort_parent_id_fkey` är RESTRICT).

Migrationen `personer_redigeras_och_raderas` kördes i driften efter
merge, som version `20260928231551`, och det driften sparade har samma
md5 som filen. Hela `rls-test.sql` gick igenom efteråt: 754 av 756, där
de två är Fas 23.1:s prov, som väntar på sin egen migration.
`rls-test.sql` har avsnittet RADERA EN PERSON; kör hela filen efter
varje ändring. Adminvyn tål att funktionerna saknas (en databas byggd
utan migrationen): Radera säger då att raderingen inte finns, och
ingenting raderas.

### Notiserna (Runda 2)

Vägen är alltid densamma, och ingen del av den kan hoppas över:

```
trigger på bookings/messages/lesson_reports
  → intern.notis_skapa()   skriver raden i notiser (syns i vyn)
  → intern.notis_koa()     lägger ett utskick i notis_utskick
  → pg_cron "notis-minut"  varje minut, notis_minut()
  → notis-ko               notis_utskick_ta() → Resend → notis_utskick_klar()
```

Åtta regler bär systemet:

0. **Strömbrytaren är flaggan `notiser_mejl` i `flaggor`, och den är
   inte samma sak som regel 4.** Regel 4 är personens eget val;
   flaggan är hela systemets. Står den av lämnar `notis_utskick_ta()`
   inte ut en enda mejlrad: raden märks **`loggad`**, notisen syns i
   vyn, och ingenting går ut. Kön, schemat och arbetaren fortsätter
   under tiden att se friska ut, för det är de.

   Flaggan stod av från Runda 2 till Fas 13.4 utan att någon fil i
   repot ens nämnde tabellen `flaggor`. Trettonde notisen i rad blev
   `loggad` och systemet såg ut att vara trasigt. **Ett avstängt
   system och ett trasigt system ser likadana ut inifrån** — därför
   finns reglaget nu i produkten, under **System → Notiser**: flaggan
   med sitt `vantar_pa`, sandlådan, provmejlen och köns läge.
   Läsningen är `notis_lage()` (Fas 13.4), som räknar i databasen och
   aldrig lämnar ut adresser, mottagare eller brödtext.

   `loggad` är ett slutläge. De mejl som aldrig gick under
   avstängningen går inte att skicka i efterhand, och ska inte
   heller: en påminnelse om ett pass förra veckan är inte en notis,
   den är förvirring.
1. **Ingen får en notis om sin egen åtgärd.** `intern.notis_skapa()`
   returnerar tyst när mottagaren är `auth.uid()`. Det är därför
   mallarna aldrig säger VEM som gjorde något: när admin ändrar ett
   pass får BÅDA parterna notisen, och "Tove har flyttat passet" hade
   då varit fel för den ena.
2. **Mallarna ser bara `RenData`.** `renData()` i
   `_delad/notiser/typer.ts` plockar ut datum, tid, ämne, förnamn och
   (sedan Fas 15.2) avbokningens skäl som en av sex FASTA KODER.
   Kommer det en nyckel till — `body`, `note`, `location`, ett
   efternamn — följer den inte med, för den läses aldrig. Ingen
   brödtext kan hamna i ett mejl hur mallen än formuleras, och skälet
   skrivs med mallens egna ord (`SKAL_TEXT` i `mallar.ts`), aldrig
   med databasens.
3. **Varje namn går genom `fornamn()`**, som speglar
   `intern.fornamn()`: första ordet, bara bokstäver och bindestreck,
   högst 30 tecken. `full_name` är fritext utan gräns, och ett "namn"
   som ser ut som en adress blir annars en klickbar länk i Gmail, i
   ett mejl från vår egen domän med godkänd DKIM.
4. **Mejl är på som förval, SMS av.** `notis_vill()` faller tillbaka
   på `p_kanal = 'mejl'` när personen inte valt något. Avanmälan
   skriver bara i `notis_val`, aldrig i `profiles`.

   Valen ändras under **Profil → Notiser** i båda vyerna
   (`NXStudie.notisval()`, delad mellan dem). Det är huvudvägen, och
   den enda som kan slå PÅ igen. Länken i mejlets fot är ett
   komplement för mejlprogrammens One-Click och för den som inte vill
   logga in: den stänger av EN sort och kan aldrig slå på något.
   **En saknad rad betyder PÅ** — visar vyn något annat ser en orörd
   inställning avstängd ut medan mejlen fortsätter komma.
5. **`rapport` mejlas aldrig.** Den står i `notis_typer()` men inte i
   `notis_mejlbara()` — den syns bara i vyn. Listorna finns också i
   `typer.ts` för att mallarna ska gå att prova utan databas; **ändras
   den ena ska den andra ändras i samma ändring.**
6. **Avanmälningstokenen har ingen utgångstid, med flit.** En länk i
   ett mejl från i våras ska fortfarande fungera. Byts
   `notis_konfig.avregistreringsnyckel` slutar alla gamla länkar gälla
   på en gång, och inget annat händer. Prefixet `avanmal:v2:` gör att
   en signatur från den gamla varianten aldrig kan läsas som en ny.
7. **Sandlådan är `notis_drift.mejl_sandlada`.** Är den satt går allt
   dit i stället för till mottagaren, och ämnesraden märks. SMS har
   samma sak i `sms_lage`, som står på `prov` och då bara torrkör.
   **Sätt sandlådan innan du provar något som köar.**

`notis_installning` styr takten: påminnelser 24 och 1 timme före,
chattmejl samlas i 10 minuter, passändringar i 3. Samlingen sker i
databasen genom `samlingsnyckel`, inte i arbetaren — fem repliker på
tre minuter blir ett mejl, och den som får fem mejl slutar läsa det
sjätte.

**`timmar_gar_ut` (Fas 21.2) är den enda notisen som inte gäller ett
pass.** Den köas av `intern.timmar_gar_ut_koa()`, som pg_cron-jobbet
`timmar-gar-ut` kör varje timme och som bara gör något mellan 9 och 20
svensk tid. En gång per kort och sista dag; ett förlängt kort får en ny.
Mallen läser `kvar` (heltal, 1–200) och `datum` ur `RenData`, och bara
familjen har raden i `NOTISVAL` (`bara: 'parent'`).

**Notiser som inte gick fram (System → Fel) är bara databasens egna
utskick** (2026-09-27). `notisfel()` läste förut hela
`net._http_response`, och dit kommer varje anrop genom pg_net, också
när en session provar en funktion efter en driftsättning. Utan
hemligheten svarar funktionen 401, med GET 405, och svaret stod sedan i
sex timmar som en notis som inte gick fram: adminvyn sa 8 fel, där tre
var samma fel i koden och fem var prov. Tabellen har ingen adress, och
ett prov och ett utskick med fel hemlighet ger samma 401, så skillnaden
syns bara när anropet görs.

- **Ring aldrig `net.http_post` direkt.** Databasens anrop går genom
  `intern.natanrop(mal, url := …)`, med samma parametrar som
  `net.http_post` och målet först. Den minns anropets id i
  `intern.natanrop_logg`, och `notisfel()` visar bara svar på de
  anropen och på webhooken för intresseanmälan (som minns sina i
  `supabase_functions.hooks`), med vägen i `kalla`. Ett anrop förbi
  `intern.natanrop` syns inte när det går fel; `rls-test.sql` har en
  rad som fångar det.
- **`grindfel` skiljer två 401:or.** Supabases grind svarar med
  `sb-error-code` (`UNAUTHORIZED_…`) när JWT-kravet slagits på igen
  (avsnitt 7, `config.toml`); funktionen själv svarar 401 när
  hemligheten inte stämmer. Adminvyn säger vilket.
- **Svaren finns i sex timmar** (`pg_net.ttl`), inte ett dygn. Listan
  svarar på "gick det fram nyss?", inte på "vad hände i natt?".

`DEPLOY-NOTISER.md` har resten: de tre konfigurationstabellerna, hur
sandlådan slås på innan något provas, och de fem stegen för att lägga
till en ny notistyp utan att den faller ut som `okänd notistyp` ur en
trigger.

### Beskeden till den som söker (Fas 16.1)

Den som skickar in en intresseanmälan får ett kvitto (`lead-notis`,
`_delad/notiser/kvitto.ts`). Den som söker jobb får ett kvitto och
sedan ett mejl per steg framåt (`ansokan-notis`,
`_delad/notiser/ansokan.ts`), och varje sådant mejl visar alla fyra
stegen — Ansökan, Digitalt möte, Introduktion, Konto och godkännande —
med en markör där hen står.

```
applications (insert/update)
  → trigger ansokan_besked → intern.ansokan_besked_koa()
      rad i ansokan_utskick, unik på (ansokan_id, nyckel)
  → pg_net → ansokan-notis → ansokan_besked_ta() → Resend → ansokan_besked_klar()
  → pg_cron "ansokan-besked" var femte minut: omförsök, högst tre, bara senaste dygnet
```

| Händelse i adminvyn | Mejl |
|---|---|
| ansökan kommer in (vem som helst) | `mottagen`: tack, svar inom 24 timmar |
| "Kontakt" | **inget** — admin skriver själv, med förslag på tider |
| mötet sparas eller får ny tid/länk | `mote`: tid i svensk tid, länken som knapp |
| "Mötet är hållet" | `utbildning`: tack, introduktionen är nästa steg |
| "Utbildningsmötet är hållet" | `prov`: länken till provet, öppet i tre dagar (Fas 22.1) |
| dagen efter, och sista dagen, kl. 9 | `prov_paminnelse`, `prov_sista_dagen` (pg_cron `utbildningsprov-paminn`) |
| "Öppna provet i tre dagar till" | `prov` igen, med den nya sista dagen |
| provet klarat, eller "Markera utbildad" | `sista_steget`: skapa konto med samma e-post |
| läget blir Godkänd | `valkommen` |
| läget blir Avböjd | **inget, med flit** |

Sex regler bär det:

1. **INSERT-grenen läser bara kvittot.** Vem som helst kan skriva en
   rad i `applications`, så ingenting annat i raden får styra ett
   mejl. `skydda_ansokningsfalt` nollar dessutom `mote_tid` och
   `mote_lank` vid en insert som inte kommer från admin: annars hade
   en främling kunnat få oss att mejla "ditt möte är bokat" med en
   länk hen själv valt, från vår domän med godkänd DKIM.
2. **Möteslänken prövas två gånger.** Adminvyn nekar allt som inte är
   en https-adress innan det sparas, och `sakerLank()` gör bara en
   https-adress utan inloggningsdel till en knapp. Annars säger mejlet
   att länken kommer senare.
3. **Ett steg mejlas en gång.** Nyckeln är steget, utom för mötet där
   den är tid plus länk: ny tid är nytt mejl ("Ny tid för ditt möte"),
   samma tid igen är det inte. Ångra och klicka igen ger inget nytt
   mejl.
4. **Ett nej skrivs av en människa.** Den som söker är ofta sexton, och
   ett felklick som genast mejlar ett nej går inte att ta tillbaka.
5. **Kvittot bromsas vid flod.** Fler än fem ansökningar på en minut
   eller tjugo på en timme, eller samma adress igen inom ett dygn, blir
   `bromsad` — raden finns, mejlet går inte. Det är skyddet mot att
   formuläret används för att skicka våra mejl till främlingar. Samma
   adress jämförs som den levereras (`intern.epost_nyckel()`: utan
   skiftläge, kantmellanslag och plustillägg), och `created_at` sätts
   av `skydda_ansokningsfalt`, inte av den som postar (Fas 16.1c).
   Innan dess gick bromsen runt med en bakdaterad rad. **`leads` hade
   samma hål och har samma rättelse** i `skydda_leadfalt`: bromsen i
   `lead-notis` och analysvyerna räknar på den kolumnen. Sedan Fas 16.2
   har familjekvittot också samma regler, räknade i databasen av
   `lead_kvitto_broms()` (bara `service_role`). Förut räknade
   `lead-notis` själv med ilike på den exakta adressen, och ett
   plustecken räckte för att få ett kvitto till.
6. **Godkänd i rullgardinen är inte "Ta in i poolen".** Båda mejlar
   välkomsten, men bara den senare godkänner profilen. Rullgardinen
   frågar därför först.

### Utbildningsprovet (Fas 22.1)

Efter utbildningsmötet gör den som söker ett prov på nätet:
`/utbildningsprov?t=<nyckel>`, trettio flervalsfrågor om
Handledarhandboken, ingen tidsgräns, godkänt vid 24 rätt (80 procent).
Hen får göra om det tills det går. Klarat prov sätter `prov_godkant_at`
OCH `utbildad_at`, och då går mejlet om kontot av sig självt; "Markera
utbildad" finns kvar för admin, men frågar först om provet inte är
klarat. Fem regler:

1. **Facit finns bara i edge-funktionen** (`_delad/utbildningsprov.ts`).
   Sidan får frågorna utan svaren, med alternativen i ny ordning vid
   varje hämtning. Gränsen prövas en gång till i
   `utbildningsprov_lamna()`, i heltal (`ratt * 5 >= antal * 4`).
2. **Resultatet säger rätt per avsnitt, aldrig per fråga.** Med fritt
   antal försök och svaret per fråga går provet att klara på tre
   försök utan att ha läst något. Av samma skäl: högst tio försök per
   dygn, räknat i databasen.
3. **Den som söker har inget konto än**, så provet öppnas med en
   slumpad nyckel (`prov_nyckel`, ett uuid). Den öppnar provet och
   inget annat, står i mejlen och adminvyn men aldrig i en logg, och
   sidan har ingen mätning och inget `Referer`. `utbildningsprov` har
   `verify_jwt = false` och når databasen bara genom
   `utbildningsprov_lage()` och `utbildningsprov_lamna()`, båda bara
   för `service_role`.
4. **Tre dagar räknas i svensk tid**: markeras mötet en måndag är
   provet öppet till och med torsdag. `applications_utbildningsprov`
   (en BEFORE-trigger) sätter `prov_sista_dag` och nyckeln.
   **`ansokan_besked` måste lista `utbildningsmote_at`** fast den
   aldrig läser kolumnen: en `UPDATE OF`-trigger går bara på kolumner
   som står i själva UPDATE:n, inte på dem en BEFORE-trigger ändrar.
   Utan den gick länken aldrig ut. Ett rullat prov fångade det.
5. **Påminnelsernas nyckel bär sista dagen** (`prov_paminnelse:2026-09-30`).
   Öppnas provet igen blir det ett nytt fönster med nya påminnelser,
   och en påminnelse från det gamla hoppas över av
   `ansokan_besked_ta()`. Ingenting skickas före klockan nio.

Frågorna är skrivna ur handboken som den såg ut i september 2026.
Handboken finns inte i repot. Ändras den ska frågorna läsas om, och
en fråga som byter betydelse får ett nytt id:
`utbildningsprov_forsok.svar` lagrar id:n. Sidan finns bara på
svenska, med flit: handboken gör det också.

**Formen får inte avslöja svaret** (2026-09-28). Första versionen hade
det längsta alternativet rätt i 25 av 30 frågor, så provet gick att
klara utan att ha läst något. De fel alternativen är nu lika utförliga
som det rätta, och Nextrum och rutinerna står också i fel svar.
`utbildningsprov_test.ts` räknar vad "alltid längsta", "alltid
kortaste" och "det som nämner Nextrum" ger, och taket ligger kring
slumpen (8 av 30). Skriver du om en fråga, kör proven.

Utfallet syns i rekryteringsrutan vid det steg som skickade mejlet, och
ett som inte gick fram är rött. Samma sort som kvittot till familjen:
inget går att välja bort, avsändaren är info@, och ingenting ur
ansökan återges utom förnamnet.

**Loggan i alla mejl är en riktig bild** sedan Fas 16.1:
`bilder/nextrum-logo-512.png`, ritad i 32×32 med `alt=""` och ordet
Nextrum som text bredvid, så att ett mejlprogram som blockerar bilder
fortfarande visar avsändaren. Filen är undantagen i `.gitignore`; tas
undantaget bort blir loggan en trasig bild i varje mejl.

**Alla mejl vi skickar har samma skal** (2026-09-25): `skal()` i
`_delad/notiser/rendera.ts`. Sajtens papper ända ut till kanten, ingen
ram, kant eller mörkare yta runt brevet, loggan överst. Notismejlen,
kvittot och ansökningsbeskeden går genom det via `renderaRam()`;
underlaget i `faktura-utskick` och aviseringen i `lead-notis` anropar
det direkt. Förut hade de två egna färger — underlaget en kant i en ton
som inte fanns i paletten, aviseringen ingen alls — och ramen låg kvar
på det gamla papperet samma dag som sajtens ljusnade. Papperet står på
`body` för Apple Mail OCH som `bgcolor` på yttertabellen för Gmail, som
kastar body-stilen: tas ett av dem bort blir det vitt i det programmet.
Det vita som ändå syns runt ett mejl i Gmail på datorn är Gmails eget
och går inte att nå inifrån ett mejl. Kontomejlen (bekräfta konto,
inbjudan från `bjud-in`) skickas av Supabase Auth med mallar i
dashboarden, inte härifrån, och har inte det här skalet.

### Gallringen: ansökningar och CV:n efter ett år (2026-09-27)

Integritetspolicyn lovar att en ansökan som inte leder till anställning
sparas högst ett år. Förut höll ingenting det: ingen policy, inget jobb
och ingen knapp tog bort vare sig raden eller CV:t.

```
pg_cron "ansokan-gallring", 03:41 UTC
  → intern.ansokan_gallring_vack()   något förfallet? annars inget anrop
  → pg_net → ansokan-gallring        hemligheten i x-nextrum-notis
      → ansokan_gallring_lista()     ansökan och dess filer
      → Storage tar bort filerna     svaret läses
      → ansokan_gallra(id)           raden, bara om filerna är borta
      → cv_foraldralosa() → Storage  filer som ingen ansökan pekar ut
```

Regeln står i `intern.ansokan_gallras_fran()` och ingen annanstans:

1. **En studiehjälpares ansökan står kvar medan hen arbetar, och två
   år till** (2026-09-28). Har ansökan samma adress
   (`intern.epost_nyckel`) som en godkänd studiehjälpare, och är den
   inte avböjd, räknas tiden från studiehjälparens senaste aktivitet:
   kontot, senaste inloggning, senaste pass som inte avbokats, senaste
   rapport. Det finns ingen status för "har slutat", så aktiviteten ÄR
   signalen. Adressen och inte bara läget, för "Ta in i poolen"
   godkänner profilen först och läser inte svaret när ansökan sätts
   till godkänd. En godkänd ansökan utan konto med den adressen gallras
   två år efter sitt senaste steg. En avböjd ansökan gallras alltid,
   också när samma person senare fått ja.
2. **Ett år från `created_at`, men inte mitt i en rekrytering.** En
   ansökan väntar till trettio dagar efter sitt senaste steg: kontakten,
   mötet, utbildningsmötet, provets sista dag, det godkända provet,
   utbildningen. Policyn säger "så att vi kan höra av oss om något dyker
   upp", och den som hörs av i månad elva ska inte förlora ansökan mitt i
   provet. **Får rekryteringen ett nytt steg med en egen tidsstämpel ska
   det in i funktionen**, annars kan en ansökan försvinna mitt i steget.
3. **Filen först, raden sedan, och databasen vaktar ordningen.**
   `storage.objects` går inte att ta bort ur med SQL
   (`protect_objects_delete`), så filen tas bort genom Storage-API:t i
   edge-funktionen. `ansokan_gallra()` vägrar ta bort raden så länge en
   fil den pekar ut finns kvar. En fil som en ansökan som ska vara kvar
   också pekar ut står kvar.
4. **Filer utan ansökan gallras ett år efter uppladdningen.** Kopplingen
   är raden `CV: cv/<sökväg>` i `why` (avsnitt 6, hinkarna), läst av
   `intern.ansokan_cv_namn()`, med flit vidare än `CV_RAD`. Året är också
   ett skydd: ändras CV-raden utan att tolkningen följer med ser varje CV
   föräldralöst ut, och då tas ändå inget bort som inte redan var ett år
   gammalt.
5. **Det som följer med:** `ansokan_utskick` och `utbildningsprov_forsok`
   (cascade) och uppgifter kopplade till ansökan, som kan bära namnet.
   Auditloggens rader om ansökan står kvar, för de bär bara läge och
   tidsstämplar. Borttagningen får en egen, `ansokan.borttagen` av
   `system`, med tidsstämplarna som visar att den var förfallen. Egen
   trigger (`applications_audit_borttagen`): `applications_audit` skrivs
   om av rekryteringens migrationer, och en borttagningsgren där hade
   försvunnit nästa gång.
6. **Vakten räknar utfallet, inte vägen.** Är något en vecka över tiden
   skapar väckningen uppgiften "Gallringen av ansökningar har fastnat".
   En funktion som svarar 401, en fil Storage vägrar ta bort och en rad
   som väntar på sin fil syns alla där. Funktionens svar står i
   `net._http_response`: 200 bara när inget gick fel, och aldrig ett
   filnamn, för det är vad den sökande själv döpt filen till.

Bara `service_role` når `ansokan_gallring_lista`, `cv_foraldralosa` och
`ansokan_gallra`, inte admin. Adressen står i `notis_konfig.gallring_url`,
härledd ur `arbetare_url` som `ansokan_url`. Provad mot driften
2026-09-27 med tre provansökningar och fyra provfiler. **pg_net skickar
bara `application/json`**, och hinken `cv` tar bara PDF och Word: filerna
laddades upp som anon med tillägget `http`, installerat i en transaktion
som rullades tillbaka. Storage sparar filen i sin egen anslutning, så den
blir kvar medan tillägget inte gör det.

---

## 6. Säkerhetsmodellen

Den här är inte förhandlingsbar och förklarar större delen av koden.

Dataskyddet på pappret (registret över behandlingar,
konsekvensbedömningen, incidentrutinen och biträdena) står i
`DATASKYDD.md`. **Ändras vad som sparas, till vem det går eller hur
länge: ändra `DATASKYDD.md` och integritetspolicyn på båda språken i
samma ändring.**

Det som skickas till Anthropic från rapportutkasten och hälsningarna
går genom `_delad/minimera.ts`: förnamnet, och fritext där
personnummer, telefonnummer och e-post är maskade. Samma regler som
`maska_kontakt()` i databasen; ändras den ena ska den andra ändras.

**Allt skydd ligger i RLS. Ingenting ligger i gränssnittet.**
Adminvyn hämtar med samma anon-nyckel som alla andra. Att gömma en
knapp är inte säkerhet — den som inte är admin får tomma svar oavsett
vad filen ritar. `is_admin`-kontrollen i `nextrum-admin.js` finns för
att visa **rätt sida**, inte för att skydda data.

- **Rå servertext visas bara i de inloggade vyerna.** `NX.felText`
  kände igen sex fel och skrev annars ut serverns egen text. På
  `body.vy` (admin, larare, foralder) är det rätt — den som läser är
  vi själva, och "new row violates row-level security policy for table
  bookings" är svaret på frågan. På en publik sida är det fel två
  gånger om: föräldern förstår den inte, och den beskriver en tabell
  och en policy för vem som helst. Sedan Fas 14.0 går den texten till
  konsolen och `klientfel` i stället, och besökaren får ett begripligt
  besked med en adress att mejla. **Varje meddelande som slutar i en
  återvändsgränd ska bära `{oss}`** — `t()` fyller den med `CFG.EPOST`
  utan att anroparen behöver veta om det. Förut stod "Fyll i
  nextrum-config.js" ordagrant på den publika intresseanmälan, och en
  familj som fick det hade ingen väg vidare alls.
- **anon-nyckeln är inte hemlig.** Den hör hemma i webbläsaren.
- **`service_role` får aldrig in i en klientfil.** Den går förbi RLS.
- **I edge functions: anroparens egen token prövas mot Auth och RLS
  INNAN `service_role` används.** En kontroll som ligger efter
  `service_role` är ingen kontroll. `_delad/auth.ts` har en väg per
  fråga — uppfinn inte en ny.
- **Ett CHECK-villkor körs som ANROPAREN, inte som tabellägaren.**
  Dyrköpt i Fas 10: en `revoke execute` på `tjanstkoder_finns`, som
  backar `applications_tjanster_check`, slog sönder hela
  ansökningsvägen med `permission denied`. Ska en funktion som backar
  ett villkor sluta vara nåbar utifrån, FLYTTA den ur `public` i
  stället — schemat `intern` finns för just det, och PostgREST
  exponerar det inte. Ett rullat prov fångade det; utan provet hade
  rekryteringsformuläret tystnat i drift.
- **Postgres RLS kan inte begränsa enskilda kolumner.** Därför vaktas
  `is_admin`, `matched_tutor_id`, `status` och bokningsfälten av
  **triggers** som vägrar ändringen från en inloggad session. Det går
  inte att göra sig själv till admin från någon vy, med flit.
  Admin sätts med SQL:
  ```sql
  update public.profiles set is_admin = true where email = '…';
  ```
- **`invoices` och `payouts` har med flit ingen INSERT-policy för
  användare.** Kan ingen skriva belopp från webbläsaren kan ingen
  skriva fel belopp. Beloppen sätts av `fakturering` med `service_role`.
- **`integrationer` har ingen skrivpolicy alls.** Adminvyn rapporterar
  status. Koppla Google (Fas 18.1) skickar bara admin till Google:
  engångskoden kommer tillbaka till `google-koppla`, byts mot en nyckel
  där, med klienthemligheten, och nyckeln ligger i `google_koppling`,
  som ingen inloggad ser, inte ens admin.
- **Hinkarna är privata, och sökvägen är ett uuid — aldrig ett namn.**
  `material` har elevens id som mapp, `dokument` (Fas 9.10) har
  handlingens, `bibliotek` (Fas 13.2) har materialradens. Ett filnamn heter i praktiken "Avtal Alva Berg 2026.pdf",
  och sökvägen är det enda i en hink som syns innan man öppnat filen.
  `mapp_uuid()` plockar ut den, och policyerna jämför den mot en rad.
  Fas 9.1 rättade att familjegrenen i materialpolicyn jämförde elevens
  NAMN med ett uuid, eftersom `storage.objects.name` skuggades av
  tabellaliaset — familjen hade alltså aldrig kunnat se sitt barns
  material, och en policy som nekar för mycket ser ut som en tom lista,
  inte som ett fel.
- **`cv` är undantaget** (v11, läsrätten 2026-09-27). Den som söker
  har inget konto och ingen rad när filen laddas upp, så sökvägen är
  tid, slump och filnamnet, och kopplingen till ansökan är raden
  `CV: cv/<sökväg>` som `NX.kopplaAnsökan` skriver i
  `applications.why`. Anon laddar upp, bara admin läser
  (`admin läser cv`). Hinken hade ingen läsregel alls förut, så CV:t
  kom fram men gick bara att öppna i dashboarden. Knappen CV under
  Ansökningar läser raden med `CV_RAD` i `nextrum-admin-rekrytering.js`:
  **ändras formatet i den ena ska den andra ändras i samma ändring**,
  annars försvinner knappen utan att något blir rött. En PDF öppnas i
  en ny flik med en länk som gäller fem minuter, och fliken öppnas i
  samma tryck: Safari stoppar tyst ett fönster som öppnas efter en
  väntan på nätet. Word hämtas som en blob och laddas ned. PDF:en kan
  inte gå den vägen, för en blob-adress ärver adminvyns CSP och
  `object-src 'none'` stoppar PDF-visaren. Filen och ansökan gallras
  efter ett år (avsnitt 5, Gallringen).
- **Tar du bort en fil: filen först, raden sedan, och LÄS SVARET.**
  Sökvägen finns bara i raden. Försvinner raden först blir filen omöjlig
  att hitta och omöjlig att städa. Det stod som en kommentar i
  adminvyn långt innan koden faktiskt gjorde det (Fas 9.2). För
  ansökningarna vaktar databasen ordningen: `ansokan_gallra()` tar inte
  bort raden medan filen finns.
- **Notishemligheten ligger i `notis_konfig`, inte i en secret.** En
  secret och en webhook-header i två olika fönster glider isär, och då
  svarar funktionen 401 på varje anmälan emellan — de mejlen kommer
  aldrig. I en tabell byts båda i samma transaktion.

### Samtycket (2026-09-27)

De öppna sidorna sätter inga cookies. Det som kräver samtycke
(LEK 9 kap. 28 §) går genom `NXSamtycke` i `nextrum-samtycke.js`, och
vad som är påslaget står i `NEXTRUM_CONFIG.SAMTYCKE`. **Rutan visas
bara när något där är på.** Är allt av finns ingen ruta, ingen länk i
footern och ingenting lagras: en ruta som ber om lov till ingenting är
brus.

- **Två syften, två val: statistik och annonser.** Rutan har Neka
  alla, Godkänn alla och en kryssruta per syfte (ingen förkryssad) med
  Spara mitt val. Svaret är `{v:2, val:{statistik, annonser}}`; ett
  svar i det gamla formatet räknas som inget svar. `SYFTE` i
  `nextrum-samtycke.js` säger vilket syfte varje reglage hör till.
- **Vercels besöksstatistik laddas först efter ja** (2026-09-27).
  Taggarna till `/_vercel/insights` och `/_vercel/speed-insights` stod
  förut statiskt på alla 35 sidor och körde innan någon frågats. Den
  räknar utan cookies, men skriptet får webbläsaren att skicka data,
  och det är "åtkomst" enligt EDPB:s riktlinjer 2/2023; PTS räknar
  statistik som inte nödvändig. Nu lägger `laddaVercel()` in dem vid
  ja. **Lägg aldrig tillbaka en statisk tagg.** Dras ett ja tillbaka
  laddas sidan om, för ett skript som redan kört går inte att stänga av.
- **Källspårningen hör till annonser.** Med ett ja minns
  webbläsaren landningen tills fliken stängs (sessionStorage
  `nx-kalla`, skrivs av `NX.källa()`), så att en anmälan krediteras
  annonsen och inte sidan den skickades från. **Utan ja är en okänd
  källa `null`, inte "direkt"**: har besökaren kommit från en annan sida
  hos oss vet vi inte var hen landade, och `analys_leads_per_kalla`
  räknar null som okänd (avsnitt 5, regel 3). Förut blev varje familj
  som läst två sidor före anmälan "direkt".
- **Pixlarna (Meta, Google) är byggda och tomma.** Ett id i
  konfigurationen slår på dem, och de laddas först efter ja. Innan ett
  id skrivs in: `lagring.html` och integritetspolicyn på båda språken
  (mottagare, överföring till USA), domänerna i CSP:n i `vercel.json`,
  och för Meta automatisk avancerad matchning AV i Events Manager. IMY
  bötfällde svenska företag för Meta-pixeln 2024. Bara
  `intresseanmalan` är en konvertering; en jobbansökan är inte en kund.
- **Ett ja gäller det rutan beskrev** (`omfattar`). Slås ett nytt syfte
  på frågar rutan alla igen. Svaret (`localStorage` `nx-samtycke`)
  gäller ett år. Global Privacy Control räknas som nej.
- **Ja och nej är samma knapp.** Samma storlek, samma stil, bredvid
  varandra. Gör aldrig nej till en grå länk.
- **Klasserna heter `nx-kakor-*`.** `.nx-samtycke` är GDPR-kryssrutan
  under formulären; första versionen av rutan hette så och flyttade
  kryssrutan ut i hörnet med `position:fixed`.
- Rutan laddas bara på de öppna sidorna. De inloggade vyerna har inget
  som kräver samtycke: inloggningen, de hopfällda menyerna och Stripes
  två cookies (`__stripe_mid`, `__stripe_sid`, satta först när familjen
  trycker Betala med kort) är nödvändiga för något besökaren själv bett
  om.

`lagring.html` (och `/en/`) säger exakt vad som lagras, och panelen
där (`#ditt-val`) är samma val som rutan. **Ändras lagringen ska
sidorna följa med i samma ändring.** Fas 14.5 lade till Stripe utan
att sidan följde med, och i tre veckor stod det "vi sätter inga
cookies alls".

### Supabases säkerhetsadvisor larmar om saker som är med flit

`get_advisors(type: 'security')` ger ett fyrtiotal varningar. De flesta
är väntade, och listan nedan finns för att ingen ska utreda dem en
gång till. **Kontrollerat 2026-09-23, med prov mot driften, och
igen 2026-09-27:**

| Varning | Varför den är väntad |
|---|---|
| `rls_enabled_no_policy` på `notis_konfig`, `kund_skatteuppgifter`, `stripe_handelser` och (sedan Fas 18.1) `google_koppling` | RLS på utan en enda policy ÄR skyddet: bara `service_role` ser dem. Se avsnitt 6 ovan |
| 33 SECURITY DEFINER-funktioner nåbara för `authenticated` (2026-09-28, de senaste är `radering_lage` och `radera_person`, och `manadskorning_lage` före dem) | Adminfunktionerna kontrollerar `is_admin()` internt. Resten svarar bara om den inloggade själv: `faktura_mojlig`, `far_forbereda_passet`, `upptagna_tider` (egen eller matchad studiehjälpare), `ar_*`- och `is_my_*`-hjälparna. Att EXECUTE finns är inte samma sak som att funktionen gör något |
| `is_admin(uid)` nåbar för `anon` | Funktionen hämtar raden bara om `uid` är ens eget ELLER anroparen själv är admin. Som anon är `auth.uid()` null, så villkoret faller alltid |
| `kolla_rabattkod` nåbar för `anon` | Första raden i kroppen är `if auth.uid() is null then return 'Logga in först.'` |
| `ar_matchade`, `ar_min_elev`, `is_my_student`, `is_my_matched_tutor`, `is_matched_tutor_of` nåbara för `anon` | Alla jämför mot `auth.uid()`, som är null för anon, så svaret är alltid falskt. De backar policyer, och en revoke från anon är Fas 10-fällan om någon av dem står i en policy `to public` |
| `publika_studiehjalpare` nåbar för `anon` | Den ÄR den publika listan: förnamn, ålder, stad, ämnen, bio, bara godkända med `visa_publikt` |
| `extension_in_public` för `btree_gist` och `pg_net` | `btree_gist` bär överlappsvillkoret på `bookings` (v9), och `pg_net` går inte att flytta med `set schema`. Att flytta dem vinner ingenting och riskerar det som hänger på dem |

**Triggerfunktioner har ingen EXECUTE** (v14b, v16c, Fas 19.4). Supabases
förval ger varje ny funktion EXECUTE för anon och authenticated, och
Fas 16.1 fick tillbaka tre. En trigger prövar rättigheten när den
skapas, inte när den körs, så en revoke ändrar ingenting i vad den
gör. `rls-test.sql` har en rad som fångar nästa.

Proven, körda som `anon` i en transaktion som rullades tillbaka:
`is_admin(<en riktig admin>)` → `false`, `is_admin(<vanlig användare>)`
→ `false`, `is_admin()` → `false`, `kolla_rabattkod(…)` → `"Logga in
först."`

**Ett larm som VAR äkta, och är rättat:** `ar_godkand_studiehjalpare(uid)`
var nåbar för `anon` och svarade om vilket uuid som helst — prövat mot
driften gav den `true` för en godkänd hjälpare där `is_admin` samma väg
gav `false`. Den saknade alltså precis den vakt som gör `is_admin`
ofarlig. Fas 14.0b gav den samma vakt och återkallade EXECUTE från
anon. Att revoke var säkert PRÖVADES FÖRST: alla fem policyer som
backar funktionen är `to authenticated`, och inget check-villkor, ingen
vy och ingen annan funktion nämner den. Hade någon varit `to anon` hade
Fas 10-fällan slagit till igen. **Lärdomen: en ny funktion som svarar
på en fråga om en PERSON ska ha is_admins vakt från första raden.**

**Två saker som inte är falsklarm:**

1. **Läckta lösenord kontrolleras inte.** Supabase Auth kan stämma av
   mot HaveIBeenPwned. Det är en kryssruta under Authentication →
   Policies, kostar ingenting och gäller nya och ändrade lösenord.
2. **`kolla_rabattkod` har inget tak per inloggad användare.** I dag
   spelar det ingen roll: `rabattkoder` är TOM, så det finns ingenting
   att gissa. **Skapas den första koden återkommer frågan** — en
   inloggad kan då pröva koder i en slinga. Lägg ett tak då, inte nu.

### Content-Security-Policy

`/admin`, `/larare` och `/foralder` får en **skarp** CSP från
`vercel.json`: `script-src 'self'`. Alltså:

**Ingen inline-JavaScript i de tre sidorna. Inga `<script>` utan `src`,
inga `onclick="…"`, inga `javascript:`-adresser.**

`verktyg/kolla-csp.py` kontrollerar det i CI. De publika sidorna har
kvar policyn i Report-Only eftersom de fortfarande har inline-skript.

**`/foralder` släpper in Stripe, och bara Stripe** (Fas 14.5). Kassan
ritas i en panel på sidan i stället för på Stripes egen, och Stripe.js
får inte vendoras: det ska alltid hämtas från `js.stripe.com`. Sidan
har därför en egen rad i `vercel.json`, med Stripes domäner i
`script-src`, `frame-src`, `connect-src` och `img-src`, och
`payment` tillåtet för Stripes ramar i Permissions-Policy (Apple Pay
och Google Pay). `/admin` och `/larare` har kvar exakt den gamla
policyn. Regeln om inline-JavaScript gäller oförändrat också på
`/foralder`: Stripe.js laddas med en `src`, när familjen trycker
Betala. **Lägg aldrig två skarpa CSP-rader som båda matchar samma
sida**: webbläsaren kräver då båda, och Stripe stoppas av den strängare.

---

## 7. Edge functions (`supabase/functions/`)

`_delad/` innehåller det som sju funktioner tidigare hade var sin kopia
av — och kopiorna hade hunnit glida isär (två `esc()` escapade inte
apostrofen, två hemlighetsjämförelser använde `===`). **Lägg inte
tillbaka en kopia.**

| Funktion | Gör | Anropas av |
|---|---|---|
| `fakturering` | Månadskörningen: underlag per studiehjälpare, som är studiehjälparens lönespecifikation (2026-09-28), ett fakturautkast per familj som valt faktura (Fas 14.6), och en lista över pass som hölls utan att betalas. Utkastet läggs in i Fortnox för hand | pg_cron `manadskorning` den 1:a (`x-nextrum-notis`, alltid förra månaden), admin, eller `x-fakturering-nyckel` |
| `faktura-utskick` | Skickar underlaget till en studiehjälpare. **Mejlet först, statusen sedan.** Fakturor vägrar den sedan Fas 14.6: de skickas från Fortnox | Knapp under Ekonomi → Utbetalningar |
| `bjud-in` | Auth-inbjudan till familj utan konto. Ger bara rollen förälder | Adminvyn |
| `lead-notis` | Avisering till ledningen **och kvitto till familjen** när en intresseanmälan kommer in | **Databaswebhook** `ny-intresseanmalan`, `verify_jwt` av, delad hemlighet i header |
| `pass-notis`, `meddelande-notis` | **Anropas inte längre.** Se nedan | — |
| `generate-feedback`, `generate-message` | Claude-utkast. Använder **inte** `service_role`, vidarebefordrar användarens token | Vyerna |
| `material-forslag` | Övningsuppgifter **i klartext, aldrig som länk** | Adminvyn |
| `juridik`, `ekonomi` | Agenter. Läser aldrig ur minnet, läser bara | Adminvyn |
| `drift` | Tredje agenten (Fas 8). Läser verksamheten och siffrorna, föreslår. Inget utgående verktyg | Adminvyn |
| `notis-ko` | Kö-arbetaren (Runda 2). Tar rader ur `notis_utskick`, renderar och skickar. Får alla sina beroenden inskickade | pg_cron, via `notis_konfig.arbetare_url` |
| `ansokan-notis` | Ett besked till den som sökt jobb (Fas 16.1): kvittot, eller mejlet om ett steg framåt med hela processen och var hen står. Databasen bestämmer vad, funktionen skickar | Triggern `ansokan_besked` och pg_cron `ansokan-besked`, via `notis_konfig.ansokan_url` |
| `ansokan-gallring` | Tar bort ansökningar som inte ledde till anställning och CV-filer utan ansökan när de är ett år gamla (2026-09-27, avsnitt 5). Filen först genom Storage-API:t, sedan raden genom `ansokan_gallra()`, som vägrar medan filen finns. Svarar 500 om något inte gick | pg_cron `ansokan-gallring` via `intern.ansokan_gallring_vack()` och `notis_konfig.gallring_url` |
| `notis-avanmal` | Stänger av EN notistyp i EN kanal utifrån en signerad token. Kan aldrig slå på något | Länken i mejlet, och mejlprogrammets One-Click |
| `stripe-checkout` | Familjens kortbetalning för ETT bekräftat pass. **Hela beloppet till Nextrum**, ingen destination och ingen avgift. Beloppet räknas här, aldrig i anropet. Kassan öppnas i en panel på sidan (Fas 14.5), med Stripes egen sida som reserv. Sedan Fas 16.1 också köpet av en plan eller ett klippkort (`erbjudande` i anropet), med priset ur `erbjudanden_pris`. Sedan Fas 20.1 tar ett genomfört pass den hållna tiden, och `tillagg: true` tar betalt för övertiden på ett förbetalt pass (en egen rad i `pass_tillagg`). Sedan 2026-09-28 också ett pass som valts för faktura och inte står på en faktura än: det står kvar som `faktura` tills webhooken skrivit betalningen | Knappen på passet i föräldravyn, Betala med kort nu på ett fakturapass, och Köp under Erbjudanden |
| `klippkort-betala` | Betalar ett bekräftat pass med köpta timmar (Fas 16.1). Prövar familjens token och flaggan, drar i `klippkort_dra()` och stänger en öppen kortkassa för passet. Med `timbank: true` dras minuterna i timbanken i stället, i `timbank_dra()` (Fas 22.1). Sedan Fas 22.2 betalar timmarna passen av sig själva i databasen, och knappen tar det de inte hann | Betala med timmar och Betala med timbanken i föräldravyn |
| `stripe-webhook` | Enda vägen som får sätta en betalning som betald. Signatur i konstant tid, idempotens via `stripe_handelser`. Ett tillägg (Fas 20.1) bär `tillagg_booking_id` och skrivs, återbetalas och bestrids på sin egen rad | Stripe |
| `stripe-aterbetalning` | Återbetalning till familjen, hel eller delvis. Beloppet tas ur raden, aldrig ur anropet | Knappen under Ekonomi → Kortbetalningar |
| `stripe-avstamning` | Hämtar avgift, netto och läge (test eller skarpt) för betalningar som saknar dem (Fas 14.7). Högst femtio per tryck. Skriver bara de kolumnerna | Knappen Hämta från Stripe under Ekonomi → Kortbetalningar |
| `stripe-lage` | Frågar Stripe om nyckeln, kontot, kontoutdraget och webhookens händelser, och säger vad som saknas (Fas 14.3). **Läser, skriver ingenting.** Nyckeln lämnar aldrig funktionen, bara om den är test eller skarp | Knappen Kontrollera Stripe under Ekonomi → Kortbetalningar |
| `google-koppla` | Kopplingen till Google (Fas 18.1): adressen till Google, återkomsten med engångskoden, Prova och Koppla från. Koden byts mot en nyckel HÄR; vyn ser aldrig nyckeln eller klienthemligheten. Återkomsten bär ingen inloggning och skyddas av ett HMAC-signerat läge som gäller i tio minuter. Ett konto utanför nextrum.se nekas | Knapparna under System → Integrationer, och Googles omdirigering |
| `google-meet` | Meet-länken till ett bekräftat onlinepass (Fas 18.1). Läser passet med anroparens token först, skapar ett öppet rum och sparar länken i `pass_moten`. Ett rum som inte blev öppet sparas inte | Passets sida i föräldravyn och studiehjälparvyn |
| `utbildningsprov` | Provet efter utbildningsmötet (Fas 22.1). Lämnar ut frågorna utan facit, rättar, och sparar försöket genom `utbildningsprov_lamna()`. Skyddet är nyckeln i länken, inte en inloggning. I drift sedan 2026-09-27 | `/utbildningsprov`, från länken i mejlet |

`supabase/config.toml` bär `verify_jwt = false` för de nio funktioner
som anropas utan inloggad användare. Inställningen satt länge bara i
dashboarden, och en `supabase functions deploy` utan filen hade slagit
på JWT-kravet igen — då svarar triggrarna och arbetaren 401, och
eftersom anroparen är ett schema finns ingen som ser det. **Filen är
sanningen, inte dashboarden.** Lägger du till en funktion utan
inloggning: skriv raden där i samma ändring.

### `pass-notis` och `meddelande-notis` är pensionerade (Fas 14.0)

Båda hade ingen anropare kvar: Runda 2 bytte webhookarna som ringde
dem mot kötriggrar. Beslutet är taget — källan är borttagen ur repot
och raderna ur `supabase/config.toml`.

**KVAR ATT GÖRA FÖR HAND: de ligger fortfarande ACTIVE i driften.**
Supabase CLI och MCP kan driftsätta en funktion men inte ta bort den;
det görs i dashboarden under Edge Functions. Tills dess svarar de på
sin adress, skyddade av den delade hemligheten i headern, men de gör
ingenting någon ber om.

Så här ser vägarna ut i dag:

| Tabell | Trigger i dag | Funktion |
|---|---|---|
| `bookings` | `bookings_notis` | `notis_vid_pass` — köar |
| `messages` | `messages_notis` | `notis_vid_meddelande` — köar |
| `lesson_reports` | `lesson_reports_notis` | `notis_vid_rapport` — köar |
| `leads` | `ny-intresseanmalan` | `http_request` → `lead-notis` |
| `applications` | `ansokan_besked` | `intern.ansokan_besked` — köar i `ansokan_utskick` och väcker `ansokan-notis` (Fas 16.1) |

`leads` är alltså den enda som fortfarande går via en webhook, och
`lead-notis` den enda av de tre som lever.

Det kostade en gång: `verktyg/rls-test.sql` stängde av
`"nytt-passforslag"` på `bookings` och kraschade på den första satsen
efter `begin` med 42704 — hela sviten gick inte att köra, och en svit
som inte går att köra provar ingenting. Den slår nu upp triggrarna på
FUNKTIONEN i stället för på namnet.

`stripe-konto` hörde till samma sort och **är borttagen ur driften**
(Fas 12.5). Den skapade anslutna Stripe-konton, och ingen knapp
anropade den längre: studiehjälparen får betalt den 25:e genom
`payouts`, så ett anslutet konto fyller ingen funktion.

ACTIVE funktioner som ingen ringer är samma sorts halvfärdighet som
gjorde att hela det här systemet inte fanns i repot. Det är därför de
två ovan är avgjorda och inte utredda en gång till.

### Notissystemet kom hem i efterhand

`notis-ko` och `notis-avanmal` låg ACTIVE i driften utan att finnas i
någon gren, och fjorton migrationer (`r2_fas1_1` till `r2_fas2_4`)
hade körts utan att bli filer. Den här filen varnade för precis det
och sa att det skulle redas ut **innan pg_cron installerades**.
pg_cron installerades ändå. Varningen hann bli osann innan någon
läste den, och beskrev sedan en äldre version av funktionerna: en
`arbetare.ts` som inte längre finns, och en databasdel som sades vara
okörd när den i själva verket var körd.

Allt är nu hämtat hem ordagrant, varje migration kontrollerad mot
databasens md5-summa och funktionsfilerna diffade mot driften.

**Lärdomen är inte "kom ihåg att commit:a".** Den är att
`apply_migration` och `functions deploy` ändrar driften direkt, medan
git är ett skilt steg som ingen kontroll tvingar fram. Två system kan
alltså glida isär utan att något blir rött. Kör frågan i avsnitt 5
innan du tror på filerna — och när du driftsatt något, commit:a det
i samma arbetspass, inte i nästa.

Samma sak hände utbildningsprovet (Fas 22.1). Migrationerna, jobbet
`utbildningsprov-paminn`, funktionen `utbildningsprov` och
`ansokan-notis` med provstegen driftsattes 2026-09-27 från utkastet i
PR #88, som inte var mergat. I ett dygn låg en trigger, ett schemajobb
och mejlmallar i drift som main inte visste om, och en databas byggd ur
main föll på gallringens migration, som läste provkolumnerna. PR #99
tog hem databasdelen och funktionerna ordagrant 2026-09-28, och sidan
och adminvyns del kom med PR #88. **Driftsätt aldrig från en gren som
inte är mergad.**

### Agentregeln

`_delad/agent.ts` bär fyra regler som *är* agenterna:

1. **Hårt stegtak.** En agent som loopar fritt mot betalda API-anrop är
   en räkning som växer medan ingen tittar.
2. **Källtvång som kod, inte som prompt.** Koden kontrollerar att varje
   adress i svarets källista är en adress agenten **faktiskt hämtade**.
   Påhittade adresser plockas bort. Blir listan tom kastas svaret.
3. **Bara `kallor` blir klickbara i gränssnittet.** En påhittad adress
   ritas överstruken i en varningsruta. Att linkifiera med regex vore
   att bygga in precis det fel resten av systemet fångar.
4. **`ekonomi` skriver aldrig.** Alla verktyg är läsande. Det är
   designen, inte tillfällig försiktighet i väntan på bättre modeller.

`verktyg/testa-agent.js` och `_delad/agent_test.ts` vaktar spärrarna.
Testfallen med värdnamn i sökväg och `https://riksdagen.se@evil.com/`
står kvar för att det är så en naiv `indexOf` går sönder.

### AI-lagret (Fas 8)

Tre agenter: `juridik`, `ekonomi` och `drift`. De två första läser
rättskällor och bolagets siffror. Den tredje läser verksamheten —
anmälningar, omatchade elever, kommande pass, saknade rapporter — och
**har med flit inget utgående verktyg**: en agent som både läser
känsliga rader och kan hämta en adress kan bära ut dem, och det räcker
med en rad injicerad text i en intresseanmälan för att försöket ska
göras.

**Regeln "ingen AI-väg skriver i affärstabeller" bor i databasen, inte
i TypeScript.** Rollen `nextrum_ai` har inga tabellrättigheter alls.
Den kan köra sju funktioner, och dörren `ai_verktyg` — den enda väg
drift-agenten talar med databasen genom — **ägs av den rollen**.
Försöker något i dörren skriva i `students` svarar databasen
`permission denied`. Det första den garantin stoppade var dörrens egen
kontroll av att eleven fanns; den fick bli `ai_finns()`.

- **AI:n formulerar aldrig en nyckel eller en titel.** Nycklar byggs av
  kod ur typ och id. Modellens text får bara hamna i `motivering` och
  `beskrivning`, fält som INTE står i auditloggens vitlistor —
  auditloggen går inte att rätta.
- **Förslag, inte åtgärder.** `ai_forslag` bär det AI:n vill göra. En
  nyckel är ett förslag, för alltid: avvisas ett par kommer just det
  paret inte tillbaka. `godkann_forslag()` utför, i SQL, med
  **adminens egen token**, så att `skydda_*`-triggrarna och
  `logga_andring` fungerar precis som när en människa klickar. En gren
  per typ, aldrig `update <tabell> set <payload>`.
- **Databasutdata märks innan modellen ser det.** `somDatabasData()` i
  `_delad/agent.ts` lindar svaret i ett block med ett slumptal per
  anrop, så att texten inte kan stänga sitt eget block. Ett verktyg
  som svarar med `data` i stället för `text` lindas av motorn — att
  låta varje agent göra det själv vore att lita på att ingen glömmer.
- **Domänspärren gäller efter varje omdirigering.** `hamta()` följer
  hoppen för hand och prövar listan vid varje steg; förut kunde en
  tillåten källa svara 302 till vad som helst.
- **Läsverktygen lämnar inte ut namnKOLUMNERNA**, e-postadresser eller
  `bookings.location` (fältet är i praktiken en hemadress). Elever
  visas med initialer — det är en minimering, inte en avidentifiering:
  i Nextrums storlek pekar initialer plus årskurs i praktiken ut ett
  barn. Fritexten maskas på e-post och sifferföljder och kapas, men
  **den kan fortfarande innehålla namn**: familjen skriver ofta
  "Elsa behöver hjälp med matten" i rutan. Det är en avvägning, inte
  ett skydd som håller tätt.
- Matchningspoängen ligger i `matchningspoang()`. Adminvyn hämtar
  svaret och skriver meningarna själv — databasen svarar med koder,
  aldrig med svensk text, så att samma svar kan läsas av en agent utan
  att den får namn på köpet.
- **Analysvyerna når agenten bara genom omslag.** `ai_analys()` och
  `ai_avvikelser()` (Fas 9.9) är SECURITY DEFINER och ägs av postgres,
  eftersom `nextrum_ai` inte kan läsa en invoker-vy: rollen har inga
  tabellrättigheter, så svaret hade blivit `permission denied`, inte en
  tom lista. Omslagen lämnar ut en FAST kolumnlista, aldrig `select *`.
  Källfälten (`kalla`, `kampanj`, `sokord` …) står med flit inte i den:
  de skrivs av en anonym besökare i adressraden, och en modellprompt är
  fel ställe för text en främling formulerat.
- `verktyg/testa-agent.js` vaktar drift-agentens verktygslista i CI:
  exakt nio verktyg, inget utgående, och ett stegtak som är satt.

**Provbänken `_prov-admin-*` får aldrig checkas in.** Den laddar de
riktiga filerna mot en stubbad databas vars `auth` alltid svarar
"inloggad admin" — alltså hela adminvyn utan inloggning — och
`.vercelignore` är en nekande lista som inte täcker den. Den står i
`.gitignore` sedan den en gång följde med en commit.

### Maskoten har med flit ingen modell

En publik chatt mot en API-nyckel har sin adress i sidans JavaScript.
Utan spärr kan vem som helst köra den i en slinga på Nextrums räkning,
och en spärr i webbläsaren går att gå runt. Svaren är dessutom en känd,
ändlig mängd som redan står på `faq.html`. Maskoten kan därför inte
hitta på ett pris, ett villkor eller ett löfte.

---

## 8. Genererade filer — ändra aldrig för hand

| Fil | Byggs av | Ur |
|---|---|---|
| `nextrum-maskot-svar.js` | `verktyg/bygg-maskotsvar.py` | `faq.html`, `en/faq.html` |
| FAQPage-märkningen i `faq.html` och `en/faq.html` | `verktyg/bygg-faq-schema.py` | frågorna på sidan |
| `laxhjalp-*.html` (6 stadsdelar, 4 ämnen, online), de fyra guiderna och ämnes- och guidekorten i `laxhjalp-stockholm.html` | `verktyg/bygg-omradessidor.py` | skalet läses ur `var-ide.html`, alt-texten ur `nextrum-images.js` |
| `sitemap.xml` | `verktyg/bygg-sitemap.py` | sidornas canonical, hreflang och noindex |
| Ikonlänkar och storlekar | `verktyg/satt-logga.py` | `bilder/nextrum-logo.png` — finns inte i dag; PNG:erna är renderade ur `favicon.svg`, se `GOOGLE.md` |
| `bank/*.png` (övningsbladen) | `verktyg/bygg-banken.py` | bladen står i klartext i verktyget. Körs för hand (kräver Chromium), inte i CI. `--sql` ger raderna till `biblioteksmaterial` |
| `?v=`-stämplarna på alla script- och link-taggar | `verktyg/satt-version.py` | filernas egen md5 |
| `bilder/*.webp` | `verktyg/bygg-webp.py` | `bilder/*.jpg` |
| `supabase/migrations/*_uppgiftsbanken_*.sql` (nivåerna och frågorna) | `verktyg/bygg-uppgifter.py --sql` | `verktyg/uppgiftsbanken/*.py`. Ändras banken skrivs en NY migration, den gamla står kvar. `--kolla` (CI) jämför den senaste med vad verktyget skriver nu, och `--visa` skriver ut frågorna med facit för den som ska läsa igenom dem |

CI kör om maskotsvaren, FAQ-schemat och kartan och gör `git diff
--exit-code`. Ändrar du FAQ:n utan att bygga om blir bygget rött, och
samma sak om du ändrar vad en sida säger, lägger till en eller tar bort
en utan att köra `bygg-sitemap.py`.

**Kartans `lastmod` räknas ur texten, inte ur git** (2026-09-26). Den
skrevs för hand förut och hade glidit: `/laxhjalp-stockholm` stod två
gånger och sex sidor saknade datum. Git hade inte hjälpt, för
`satt-version.py` stämplar om varje sida när en js-fil ändras, och då
ser hela sajten nyskriven ut efter varje commit. Google slutar läsa
`lastmod` som inte stämmer. Skriptet räknar i stället en summa av
titel, beskrivning och texten i `<main>`, och flyttar datumet bara när
summan ändras.

**`satt-version.py` körs SIST.** Områdesgeneratorn skriver sina egna
script-taggar och tappar stämpeln, så ordningen är: bygg om, stämpla
sedan. CI kontrollerar med `--kolla` i stället för att skriva.

**`bygg-webp.py` körs INTE i CI**, och det är med flit: en bildkodare
ger inte samma bytes mellan versioner, så `git diff --exit-code` hade
blivit rött av sig självt vid varje uppgradering av cwebp. I stället
vaktar `verktyg/kolla-webp.py` att varje jpg HAR en webp och att den
inte är äldre. En saknad webp går inte sönder — `<picture>` faller
tillbaka på jpg:en — den gör bara den bilden tre gånger tyngre, tyst.

Områdessidorna får **inte** innehålla något som inte är sant: inga
antal, inga betyg, inga "vi har hjälpt N elever i Farsta", inga
okontrollerade skolnamn. Sju sidor som säger samma sak med utbytt
ortnamn är doorway pages, och en påhittad siffra på en sådan sida är
dessutom en påhittad siffra.

**Ämnessidorna** (2026-09-26) finns för sökningar som "läxhjälp matte"
och "läxhjälp kemi", som ingen områdessida svarar på. Samma regel, och
två till: inga betygshöjningar, och inga kursnamn med årtal (gymnasiet
bytte till ämnesbetyg och nivåer, och "Matte 2c" är fel för en del av
eleverna). Det som står om ämnet är vad kursplanen innehåller; det som
står om Nextrum är samma löfte som resten av sajten. Moderna språk, SO
och programmering har ingen sida, för navet säger "fråga i anmälan så
säger vi om vi har rätt person" och en egen sida hade lovat mer.

**Onlinesidan** (2026-09-28, `laxhjalp-online`) svarar på "läxhjälp
online", som ingen sida hade ett ord om fast tjänsten finns. Den byggs
med `amnessida()` men står i `ONLINE`, inte i `AMNEN`: annars hade den
stått som ett ämne under "Läxhjälp per ämne" överallt. Ämnessidorna
länkar dit bland områdena, under rubriken som redan säger "eller
online", och till guiderna längst ner. Sidan säger med flit ingenting
om var i landet eleven får bo, och nämner ingen videotjänst: länken
står "i studievyn", vilket är sant både med och utan Google-kopplingen
(Fas 18.1). Att ta emot familjer utanför Stockholm är ett beslut om
affären; fattas det ska sidan säga det, och inte förr.

**Guiderna** (2026-09-26) svarar på det föräldrar söker innan de vet
att de letar efter läxhjälp, och ska gå att ha nytta av utan att någon
bokar något. Det en guide påstår om forskning eller om andra
organisationer är länkat i `kallor`, och tider står med flit inte med:
de ändras varje termin. Författaren i Article-märkningen är Nextrum,
aldrig ett personnamn.

**Guiden om gratis läxhjälp är borttagen** (2026-09-28). Leo: "på
guider ta bort gratis läxhjälp och skriv andra guider istället". Den
räknade upp biblioteken, Röda Korset och Mattecentrums räknestugor. I
stället kom tre: läsförståelsen, plugga inför prov och när barnet inte
vill göra läxorna. `/gratis-laxhjalp-stockholm` omdirigeras permanent
till navet (`redirects` i `vercel.json`): adressen stod i kartan och i
`GOOGLE.md`:s lista att skicka in, och en adress som stått i kartan
ska inte bli en 404. Provguidens tre källor (Umeå universitet,
Dunlosky m.fl. 2013, SRCD om sömn) är kontrollerade mot sökträffarna,
inte öppnade: nätet i sessionen som skrev dem släppte inte fram sidorna.

**Typsnittet förladdas bara på läxhjälpssidorna och guiderna** (samma
hero med lång rubrik). Utan förladdning bröts navets rubrik om när
typsnittet kom, och bilden under hoppade 57 px (CLS 0,205 i Lighthouse
på mobil, 0,007 efter). På startsidan och prissidan gjorde samma rad
LCP 0,3–0,4 s sämre, eftersom den konkurrerar med herobilden om
bandbredden, och de hade ingen förskjutning att laga. Lägg den inte på
fler sidor utan att mäta.

**Footern har en egen spalt Läxhjälp** med navet, de fyra ämnena och
onlinesidan, på
alla publika sidor och på båda språken. Den ersatte en länk till navet
som stod två gånger i den svenska footern, vilket också var skälet till
nästan alla TEXTNODER-avvikelser i språkbaslinjen.

---

## 9. CI — `.github/workflows/kontroll.yml`

Körs på varje push och PR. Ska vara grön före merge.

1. `node --check` på all JavaScript
2. `node verktyg/testa-agent.js`
3. `verktyg/kolla-betalningsvillkor.py` (betalningslöftet, och att det gamla är borta)
4. `verktyg/kolla-migrationer.py`, och `verktyg/bygg-uppgifter.py --kolla`
   (uppgiftsbankens form, och att den har sin migration)
5. `verktyg/kolla-csp.py`
6. `verktyg/kolla-webp.py`
7. `verktyg/satt-version.py --kolla`
8. Genererade filer är aktuella (bygg om + `git diff --exit-code`):
   maskotsvaren, FAQ-schemat och `sitemap.xml`
9. Språkdiff mot baslinjen — **inklusive attributNAMNEN**, sedan
   `<div role="img" alt="…">` stod på den engelska startsidan där
   svenskan hade `aria-label`. `alt` betyder ingenting på en div, så
   illustrationen var namnlös för skärmläsare på ett av två språk.
   Taggsekvensen var identisk och texten översatt, så verktyget sa ok
10. `deno check supabase/functions/*/index.ts`, `deno test _delad/`

Kör dem lokalt innan du pushar. De är snabba och de fångar exakt det
som annars upptäcks i drift.

**`node --check` prövar bara syntaxen.** Ett namn som inte finns där
det används ger ReferenceError först när raden körs. I adminvyn är det
vanligaste fallet ett namn ur kärnan som aldrig hämtats in ur `NXAdmin`:
auditloggen kraschade från 2026-09-22 till 09-27 på `AVBOKNINGSSKAL`
så fort en avbokning med skäl stod bland raderna, och det syntes bara
som klientfel under System → Fel.

**`.github/workflows/indexnow.yml` är ingen kontroll** (2026-09-26). Den
körs när Vercel rapporterat en lyckad produktionsdriftsättning och
skickar de adresser vars summa i `sitemap.xml` ändrats till IndexNow
(Bing, och därmed ChatGPT:s sökning, Copilot och DuckDuckGo). Nyckeln
ligger i roten som `1ba8bf8c04595e17dff19c8eaf340825.txt` och i
`verktyg/indexnow.py`; den är offentlig med flit. Byts den, byt båda.
Det som återstår för trafiken och bara går att göra med era konton
står i `TRAFIK.md`.

Rapporten från Vercel är sedan 2026-09-27 en `repository_dispatch` av
typen `vercel.deployment.success`, och workflowen skickar bara när
`client_payload.environment` är `production`. Förut var det
`deployment_status` från GitHub-driftsättningarna, som Vercel kallar
föråldrad: slutade Vercel skapa dem hade IndexNow tystnat utan att
någon kontroll blev röd. Payloadens fält (`environment`, `git.sha`,
`git.ref`, `url`, `id`, `project`, `state`) är typade i Vercels eget
paket, `vercel/repository-dispatch` under
`packages/repository-dispatch/src/data/`. Tre saker följer av bytet:

1. **Workflowen körs på main, inte på den driftsatta commiten.** En
   repository_dispatch når bara workflows på default-grenen och körs
   på dess senaste commit; med `deployment_status` var det den
   driftsatta av sig självt. Därför checkas `client_payload.git.sha`
   ut, med `fetch-depth: 2` för jämförelsen med föräldern, och
   körningen blir röd om den inte fick just den commiten. Mergas två
   PR:er tätt kan main redan vara nästa commit när händelsen för den
   första kommer: en utcheckning av main hade då skickat nästa commits
   sidor innan de fanns på nextrum.se, och den förstas aldrig. Av samma
   skäl går en ändring i workflowen inte att prova på en gren.
2. **Bara `success`, aldrig `promoted` också.**
   `vercel.deployment.promoted` kommer för varje befordran till drift,
   automatisk eller manuell, alltså också för samma driftsättning som
   `success`: med båda skickas varje sida två gånger. Efter en
   befordran av en äldre eller en annan driftsättning säger
   jämförelsen med föräldercommiten ingenting om vad som ändrats på
   nextrum.se. Kör då workflowen för hand med `alla`.
3. **En händelse som uteblir syns inte.** Står
   repository_dispatch-händelserna av hos Vercel (avsnitt 2), eller
   slutar Vercel skicka dem, körs ingenting alls. Efter en
   produktionsdriftsättning ska det finnas en körning
   `IndexNow production <commit>` under Actions; saknas den har
   signalen slutat komma.

**`verktyg/rls-test.sql` körs inte i CI** — den behöver en databas.
Kör hela filen som **ett** anrop i SQL Editor eller via `execute_sql`.
Den lägger upp två hjälpare, två familjer, tre barn, pass och en admin,
kör varje behörighetstest i en egen deltransaktion och rullar tillbaka
allt på sista raden. Notistriggern på `bookings` stängs av under
körningen så att fixturpassen aldrig blir ett mejl, och flaggan
`erbjudanden` står av så att timmarna inte betalar dem (Fas 22.2). Svaret är en tabell
`test, ok, detalj` — **varje rad ska vara ok**. Ett villkor som blir
null visas som false sedan 2026-09-28: tre prov stod null i en lista
över ok utan att någon såg det. Kör den efter varje ändring i en policy
eller en trigger.

**Filen är för stor för ett enda `execute_sql` från en session** (350
kB). Låt databasen hämta den själv, i en transaktion som rullas
tillbaka: `begin; create extension if not exists http with schema
extensions;`, sedan ett do-block som hämtar filen (och en ny migration)
från `raw.githubusercontent.com` på en commit, inte en gren, prövar
md5, tar bort raden `begin;`, slutraden och `rollback;`, och kör dem
med `execute`. Sist `select … from utfall` och `rollback;`, som tar
tillägget med sig. Så provades Fas 22.4: hela filen med migrationen,
och utan den, mot driften, utan att något blev kvar.

**Kör hela filen, inte bara ditt eget avsnitt.** 2026-09-27 hade den
varit röd sedan förmiddagen utan att någon sett det, för varje session
provade sin egen del för sig. Fas 19.2 gjorde kortspärren omöjlig att
slå på, och elva äldre prov som slog på den föll med 23514; de lyfter nu
villkoret i sin egen deltransaktion (`pg_temp.sparren_pa()`), så att
koden hålls i form till den dag villkoren går tillbaka till betalning
före passet. Fas 19.5 flyttade sitt pass till i går klockan 10 hos
studiehjälpare A, där fixturen från Fas 14.2 redan stod, och krockade
med `bookings_tutor_slot_unique` i varje hel körning. En fixtur i
huvudtransaktionen syns för allt som kommer efter den i filen.
2026-09-28 igen: blocket för Fas 9.3/9.4 avbokar b0d1 på riktigt, och
b6c1 från Fas 14.6 står bekräftat och obetalt, så sex prov för
timmarna (22.1–22.3) föll i varje hel körning. Fixturerna ställs nu
tillbaka överst i avsnittet för 22.1.

---

## 10. Arbetssätt

- **Commit-meddelanden är svenska och beskriver följden, inte diffen.**
  "Fas 2.5: en faktura skickas bara en gång", inte "fix invoice bug".
  Arbetet har gått i faser (Fas 1 säkerhet, Fas 2 fakturering,
  Fas 3 struktur och CI); följ numreringen när arbetet hör till en fas.
- **Kommentarerna förklarar varför, inte vad.** Kodbasens
  filhuvuden säger vilket fel konstruktionen finns för att hindra. Håll
  den stilen — den är halva minnet.
- **Bilder:** `bilder/*.png` är gitignorerade (originalen, ~50 MB).
  Sajten laddar WebP genom `<picture>`, med JPG som reserv. Tappar du datorn finns
  originalen ingenstans.
- **`.claude/skills/`, `.agents/`, `skills-lock.json`** är
  gitignorerade Higgsfield-verktyg. De försvinner när miljön återskapas.
- **En Claude-artefaktlänk kan aldrig prata med Supabase.** Testa mot
  riktiga filer.

---

## 11. Vad som inte är byggt

- **Betalning.** Familjen betalar varje pass med kort, **i förväg eller
  efter passet när de bekräftar rapporten** (Fas 19.2; före passet från
  Fas 14.2). Faktura finns sedan Fas 14.6 som andra betalsätt, **byggt
  och avstängt** (se nedan). `fakturering` skapar studiehjälparens
  underlag, ett fakturautkast per familj som valt faktura, och räknar
  i sitt svar upp pass som hölls utan att betalas (`obetalda`).
  `faktura-utskick` skickar bara underlag till studiehjälparna sedan
  Fas 14.6: en faktura skickas från Fortnox, aldrig härifrån.

  **Kortvägen har gått hela vägen i testläge** (2026-09-25). Två
  provbetalningar kom fram som `checkout.session.completed`, och båda
  passen står som betalda. `basil`, som `_delad/stripe.ts` pinnar, gick
  inte att välja när endpointen skapades, men fälten webhooken läser
  kom fram ändå. Två saker saknades, och båda lagades i Fas 14.7:

  - **Stripes avgift kom inte med.** Balanstransaktionen, med avgiften,
    finns ofta inte ÄN när sessionen fullbordas. Webhooken tar nu emot
    `charge.updated`, som kommer när den finns, och `stripe-avstamning`
    (knappen **Hämta från Stripe** under Kortbetalningar) hämtar den i
    efterhand för betalningar som kom in före.
  - **Test och skarpt gick inte att skilja åt.** `livemode` sparas nu i
    `bookings.stripe_skarp` och `stripe_handelser.skarp`, och adminvyn
    märker testbetalningarna. Ett testpass i den riktiga databasen hade
    annars sett ut som intäkt.

  Webhooken tog dessutom inte emot en betalning efter ett nekat kort:
  `misslyckad` stod inte bland lägena den skrev över, så pengarna drogs
  och passet stod obetalt. Nu gör den det (`TAR_EMOT_BETALNING`).

  **Endpointen hos Stripe måste ha `charge.updated` och
  `charge.dispute.updated` valda.** Kontrollera Stripe säger vilka som
  saknas.

  **Fas 14.6a stängde ett hål i INSERT.** `skydda_bokningsfalt` prövade
  betalningskolumnerna bara vid UPDATE, så en familj kunde skapa ett
  pass som redan stod `betald`. Ett nytt pass föds nu obetalt, och
  `betalning_status` och `betald_at` står i auditloggen.

  **Faktura som betalsätt (Fas 14.6) är byggt och PÅ sedan 2026-09-27.** Leo
  2026-09-25: familjen ska kunna välja faktura under kortknappen, och
  fakturan och bokföringen sköts i Wint. Samma dag byttes Wint mot
  Fortnox (Fas 14.9), för att Wint blev för dyrt. Bokföringen,
  fakturorna och lönen sköts nu i Fortnox.

  - **Strömbrytaren är flaggan `faktura`** i `flaggor`. Dess
    `vantar_pa` säger vad den väntar på: bolaget registrerat och ett
    Fortnox-konto med bankgiro, de publika texterna, trettio dagars
    avisering till befintliga familjer och påminnelser utan avgift.
    DEPLOY-BETALNING.md 9.11 är checklistan. Flaggan slogs på
    2026-09-27 innan den var avbockad, och de publika texterna sa då
    bara kort i ett dygn. Sedan 2026-09-28 säger villkoren, prissidan,
    FAQ:n, maskoten, studievyn, mejlen och /en/ att familjen kan välja
    faktura efter passet, och Fortnox står i integritetspolicyn. **Kvar,
    och inget av det är kod:** bolaget och Fortnox med bankgiro och OCR
    (`BANKGIRO` i `nextrum-config.js` är tomt, så rutan Fakturor att
    betala säger "står på fakturan"), beskedet trettio dagar i förväg
    till dem som redan har konto, en jurist som läser ångerrätten för
    betalning i efterskott, och provfaktureringen i 9.11 steg 11.
  - **Familjen väljer per pass.** `betalning_status = 'faktura'`.
    `skydda_bokningsfalt` släpper igenom `ingen`/`vantar`/`misslyckad`
    → `faktura` när `intern.faktura_tillaten()` säger ja, och
    `faktura` → `ingen` så länge passet inte står på en fakturarad.
    Kortspärren godtar `faktura`. `stripe-checkout` tar sedan
    2026-09-28 ett fakturapass som inte står på en fakturarad, utan att
    skriva `vantar`: passet betalas mot fakturan tills webhooken skrivit
    `betald` (`faktura` står i `TAR_EMOT_BETALNING`), och
    månadskörningen tar bara `faktura`. Vyn använder inte längre bytet
    `faktura` → `ingen`, men databasen släpper igenom det. Hinner
    månadskörningen lägga passet på fakturan medan kassan står öppen,
    och familjen betalar ändå, larmar `betald_och_fakturerad`.
  - **Sanningen om ett fakturapass står på fakturan.** Passet står kvar
    som `faktura` också när fakturan är betald; `invoices.status`, nådd
    genom `invoice_lines`, säger om den är det.
  - **Alla familjer får välja, men admin kan spärra en** (`faktura_sparr`,
    under familjens Ekonomi). Leo sa alla; spärren finns för familjen
    som inte betalar sin förra faktura.
  - **Fortnox är inte kopplat, med flit.** Månadskörningen skapar ett
    utkast per familj. Admin lägger in det i Fortnox för hand, skriver
    in fakturanumret i Fortnox (`fortnox_fakturanummer`) och
    förfallodagen med **Lagd i Fortnox**, och markerar fakturan betald
    när Fortnox visar det. Fortnox skickar fakturan. Fortnox har ett
    dokumenterat API, vilket Wint inte hade, så en koppling för fakturor
    och lönetransaktioner går att bygga senare. Den byggs först när
    handarbetet faktiskt kostar tid: en koppling mot bokföringen som går
    sönder tyst är värre än ingen.
    Leo bad 2026-09-28 att fakturorna skulle "kopplas vidare till tex
    fortnox". Lönen går sedan dess dit som en fil (PAXml, under Löner,
    avsnitt 1). Fakturorna gör det inte: Fortnox läser inte in
    kundfakturor från en fil, bara genom API:t eller betalda
    tilläggsappar, och en API-koppling gick inte att prova utan ett
    Fortnox-konto med bankgiro, som bolaget inte har än. Den byggs som ett
    eget steg när kontot finns, på samma sätt som Google (Fas 18.1):
    OAuth, nyckeln i en tabell utan policy, och ett anrop per faktura.
  - **Tio dagar, inga avgifter.** `BETALNINGSVILLKOR_DAGAR` står i
    `nextrum-config.js` och `_delad/konstanter.ts`, och
    `kolla-betalningsvillkor.py` jämför dem. Villkoren nämner ingen
    påminnelseavgift, och då får ingen tas ut: påminnelserna i Fortnox
    ska stå utan avgift.
  - **Två nya avvikelser.** `faktura_saknas`: ett hållet fakturapass som
    inte hamnat på någon faktura när månaden är slut.
    `betald_och_fakturerad`: betalt med kort OCH på en faktura, vilket
    bara händer om en kassa stod öppen när familjen bytte till faktura.

  **Det behöver inte gissas längre (Fas 14.3).** Miljön som skrev
  betalkoden når inte `api.stripe.com`, så nyckeln stod som "okänd
  härifrån" och versionen som "troligen". Knappen **Kontrollera
  Stripe** under Kortbetalningar kör `stripe-lage`, som frågar Stripe
  med servernyckeln och säger vad som är rött: nyckelns sort,
  kontot, kontoutdragets grunddel, endpointens adress, version och
  händelser, och leveranserna i `stripe_handelser`. Reglerna står i
  `granskaStripe()` i `_delad/stripe.ts` och har egna prov. **Tryck på
  den före provbetalningen.**

  **Connect är borttaget (Fas 12.5.)** Studiehjälparen får betalt den
  25:e, som en löning, i en klump för månadens rapporterade pass. Det
  är `payouts` och månadskörningens jobb. En destination charge hade
  lagt hjälparens del på hens Stripe-saldo vid varje pass, och sedan
  hade månadskörningen betalat samma timmar en gång till.

  **Spärren "ingen betalning, inget pass" finns, och den kan inte slås
  på** (Fas 19.2, se avsnitt 5). Den hade låst studiehjälparen från att
  rapportera ett obetalt pass, och sedan Fas 19.2 är det normalt att
  familjen betalar först när rapporten finns.

  **Kvar, och inget av det sköter koden åt er:**

  - **Ett avbokat pass kan bli betalt.** Betalsidan kan ligga öppen när
    passet avbokas, och Stripe drar pengarna om familjen betalar
    efteråt. Webhooken skriver ner betalningen, för pengarna är dragna,
    och `betald_men_avbokad` larmar tills beloppet är tillbaka.
    Återbetalningen är en knapp, inte automatisk.
  - **Villkoren ändrades, två gånger.** Den som redan har konto godkände
    månadsfaktura i efterskott med tio dagars betalningsvillkor, sedan
    kort före passet (Fas 14.2), och sedan Fas 19.2 kort i förväg eller
    efter passet. Villkoren har ett avsnitt om ändringar (30 dagar för
    väsentliga). Fas 19.2 ger familjen fler val, inte färre, men ett nytt
    steg, att bekräfta rapporten. Meddela dem.
  - **Övertid som betalas efter den 25:e kommer inte med på lönen av
    sig själv** (Fas 20.1). Lönen räknar uppåt bara när övertiden är
    betald, och underlaget byggs en gång. Betalar familjen tillägget
    efter att passet kommit med på underlaget står övertiden kvar
    obetald till studiehjälparen. En rättelse på nästa underlag är en
    rad för hand tills någon bygger den.
  - **Analysvyerna räknar fortfarande det bokade** (`analys_ekonomi`
    m.fl., Fas 9.6). `passunderlag.debiterade_min` och `lon_min` finns;
    vyerna läser dem inte än.
  - **Villkoren om den hållna tiden (2026-09-27) är ett nytt villkor**
    för den som redan har konto: att betala för mer tid än det bokade
    har ingen godkänt förut. Villkoren har 30 dagar för väsentliga
    ändringar. Meddela familjerna innan första tillägget tas.
  - **Betalningen efter passet har ingen sista dag, med flit.** Leo
    2026-09-27: ingen frist. Kortet dras direkt när familjen betalar,
    och fakturan (när flaggan är på) skickas den 1:a i nästa månad med
    tio dagars betalningsvillkor. Larmet `ej_betalt` kommer direkt; det
    är människan som följer upp. En frist i dagar är ett nytt villkor,
    inte en inställning.
  - **Korttvister har en sista dag, och den är människans (Fas 14.3).**
    Förut satte webhooken bara `betalning_status = 'tvist'`: sista dagen
    att svara, orsaken och utfallet stod ingenstans, och en förlorad
    tvist såg ut som en öppen. Nu sparas de i `stripe_tvister`, en
    uppgift med dagen som förfallodag skapas, och adminvyn visar dagar
    kvar. Underlaget skickas in i Stripes dashboard, av en människa.
    DEPLOY-BETALNING.md 9.10 har processen. En förlorad tvist står kvar
    som `tvist`, inte `aterbetald`: passet hölls, och ett återkrav vi
    förlorat är inte en återbetalning vi valt.
  - **Ingen avbokningsavgift.** Villkoren lovar hela beloppet tillbaka
    för ett pass som aldrig hölls. En avgift för sena avbokningar är ett
    nytt villkor, inte en inställning.
  - **Bokföringen i Fortnox har ingen koppling hit.** Ingenting ur den
    här koden når den; kortbetalningarna ska nå den genom en färdig
    Stripe-integration som väljs och kopplas i Fortnox, utanför koden.
    Stripes utbetalning till banken är netto efter avgiften, i en klump
    för flera pass; avgiften och nettot per pass står under
    Kortbetalningar. Koppla integrationen, och bestäm med revisorn hur
    den bokar kortbetalningarna, avgifterna och utbetalningarna, innan
    första skarpa betalningen (DEPLOY-BETALNING.md 9.7). Fortnox står
    bland leverantörerna i integritetspolicyn sedan 2026-09-28, på båda
    språken: fakturorna bär familjens namn och e-post dit.

  **Fas 14.3 tog säljarens MVP-lista som utgångspunkt** (punkterna står
  i DEPLOY-BETALNING.md 9.8). Utöver tvisterna och kontrollen ovan:
  checkout tar **bara kort**, för Klarna och Swish blir klara först i
  efterhand genom en händelse webhooken inte hanterar, och familjen
  hade betalat ett pass som stod obetalt för alltid. Kvittot skickas
  genom `receipt_email`, inte genom en kryssruta i dashboarden.
  Kontoutdragets tillägg kapas vid tio tecken, för hela raden får vara
  22 och ett långt ämne hade fått Stripe att neka betalningen. Och
  bokningsbekräftelsen och påminnelsen till familjen säger att passet
  betalas före, vilket var villkor 3 och 4 för spärren. Kvar av
  villkoren är bara provbetalningen.

  **Fas 14.1 lagade sex fel i kortvägen före omställningen**, och tre
  av dem ändrar hur man ska läsa raden:

  - **`betalt_ore` är ett kvitto, `begart_ore` är ett påstående.**
    Förut skrev `stripe-checkout` `betalt_ore` redan när sessionen
    skapades, alltså innan någon betalat, och resten av systemet läste
    namnet i stället för kommentaren. Nu skriver checkout `begart_ore`
    och **bara webhooken** skriver `betalt_ore`, ur sessionens
    `amount_total`. Skiljer de sig betalade familjen en äldre session
    som låg kvar öppen med ett annat belopp.
  - **`stripe_balanstransaktion_id` är vägen till avgiften.** Stripe
    betalar ut i klumpar, netto efter avgift: ingen bankrad motsvarar
    ett pass. txn_-id:t är enda vägen dit, och avgiften
    (`stripe_avgift_ore`) finns ingen annanstans i systemet. Här stod
    förut att den bara gick att hämta i stunden. Det var fel: den hänger
    på chargen och går att hämta när som helst. Det som var sant är att
    den ofta inte finns ÄN när sessionen fullbordas (Fas 14.7).
  - **Ett betalt pass går inte att avboka från en vy.**
    `skydda_bokningsfalt` hade `if new.status = 'cancelled' then null` —
    avbokning var det enda statusbytet som inte prövades alls. En familj
    kunde avboka ett pass de betalat och vi behöll pengarna tyst. Nu
    nekas det, med ett meddelande som säger varför. Ingen automatisk
    återbetalning: villkoren lovar sedan Fas 14.2 hela beloppet tillbaka
    för ett pass som aldrig hölls, men återbetalningen görs med en knapp
    under Kortbetalningar, och `betald_men_avbokad` larmar tills den är
    gjord.

  `aterbetald_ore` nollas när en ny betalning kommer in — kolumnerna
  beskriver den betalning som gäller NU, och en gammal återbetalning
  hör till den gamla chargen.

  **Föräldravyn visar kortet först** (Leos val 2026-09-24: "bara kort,
  som Fas 14 sa"; fakturan kom till 2026-09-25). Betalning listar pass
  att betala och betalda pass, båda ritade ur passen. Med flaggan
  `faktura` på står "Få faktura nästa månad" som en knapp bredvid
  kortknappen på ett genomfört pass (2026-09-27; förut en textlänk
  under den, som inte syntes), och familjen bekräftar betalsättet i en
  ruta innan det sparas,
  och rutan Faktura visar familjens fakturor. Ett betalt pass har ingen
  avbokningsknapp i någon vy, inte heller "Avböj" eller "Dra tillbaka"
  på en flyttad tid, eftersom databasen nekar det. Med spärren på går
  också ett passerat, obetalt pass att betala: annars hade ett pass som
  faktiskt hölls fastnat mellan en studiehjälpare som inte får
  rapportera och en familj som inte får betala.

  `SKISS-BETALNING-STRIPE.md` beskriver hur beslutet gick.
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
- **Google Workspace ger bara Meet-länkar, och är inte kopplat än**
  (Fas 18.1). Koden, tabellerna och Koppla-knappen finns; kopplingen
  kräver stegen hos Google i `INTEGRATIONER.md` och ett klick på
  Koppla Google, inloggad som `info@nextrum.se`. Tills dess står den
  gamla texten om meddelanden kvar på passen. Kalendern, inbjudningarna
  och rekryteringsmötets länk valdes bort. Fortnox stod här som en
  ogjord koppling till Fas 14.8. Sedan Fas 14.9 sköts bokföringen,
  fakturorna och lönen i Fortnox, med flit utan koppling hit.
- **Bakgrundskontroller.** Godkännandet är en knapp, inte en process.
  Fas 13.1 gav rekryteringen en ORDNING (kontakt, digitalt möte,
  utbildning, poolen) med skälet till varje steg skrivet i vyn, men
  inget av stegen kontrollerar något utifrån: mötet bokas inte i en
  kalender (kopplingen till Google gör bara onlinepassens Meet-länkar,
  Fas 18.1). Sedan Fas 22.1 har utbildningen ett prov systemet läser
  resultatet av, men det prövar att hen läst handboken, inte vem hen
  är.
- **`materials` har inga läsare kvar utom oss själva** (efter Fas
  13.3). Studiehjälparvyns materialflik är ombyggd till biblioteket,
  och adminvyns detaljpanel skriver fortfarande dit men säger nu i
  klartext att familjen inte ser det. Tabellen och hinken `material`
  lever kvar. `NXMedia.laddaMaterial`, `materialRad` och
  `sparaMaterialfil` gör det INTE längre — de hade noll anropare kvar
  efter ombyggnaden, och en delad hjälpare som ingen ringer är en
  hjälpare nästa person bygger vidare på. Leo 2026-09-27: panelen står
  kvar som internt underlag. Det är alltså färdigt, och `materials` ska
  inte städas bort.
- **Skatt och anställning av minderåriga.** Olöst. Revisor före första
  utbetalningen, inte efter. Att lönen ska läggas in i Fortnox Lön
  (Fas 14.9) avgör inte frågan: `studiehjalpare_form` står på `oklart`.
  Därför räknar lönespecifikationen i studiehjälparvyn (2026-09-28)
  ingen skatt och ingen semesterersättning: den visar underlaget, före
  skatt. En lönespec med skatteavdrag är ett lönebesked, och det gör
  Fortnox Lön den dag frågan är avgjord. Den 25 oktober 2026, första
  utbetalningsdagen efter att lönespecen kom, är en söndag; vilken
  bankdag lönen går då är inte bestämt, och lönespecen visar den 25:e.
- **Riktiga foton på studiehjälparna.** Generisk siluett nu.
- **Uppgifterna (Fas 23.1) har ett startpaket, inte en kursplan.**
  Matematik från åk 1 till gymnasiet 1, engelska och svenska i tre
  årskurser var, NO i åk 5 och 8 — se `python3 verktyg/bygg-uppgifter.py`
  för vad som finns. SO, moderna språk och programmering har inga nivåer.
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
  3. **Migrationerna är inte körda när det här skrivs.**
     `fas23_1_uppgifterna_blir_digitala` först, sedan
     `uppgiftsbanken_startpaketet`, båda EFTER merge, och filerna döps om
     till versionerna driften registrerade (avsnitt 5). Vyerna tål att
     tabellerna saknas: uppgifterna syns som förut, utan banan.

---

## 12. Minne som inte finns i repot

Koden hänvisar på flera ställen till anteckningar som ligger utanför
den här mappen. Den som läser hänvisningen och inte hittar källan ska
veta att det inte är ett skrivfel:

- **`project-nextrum-engelska`** — numrerade fällor kring
  /en/-generatorn. "Fälla 4" (generatorn maskerar `<script>`) citeras i
  `nextrum-tjanster.js:38`; se även `arkiv/schema-v19.sql:21` och
  `verktyg/bygg-omradessidor.py:10`. Kärnan står i avsnitt 4 ovan.
- **"briefen"** — designdokument med numrerade paragrafer. §27 (fokal
  punkt, ansikten får aldrig beskäras bort) citeras i
  `nextrum-images.js:23`, §31 (lägg till en bild i bildberättelsen
  genom att lägga till ett objekt i listan) i `nextrum-motion.js:331`.

Hittar du de dokumenten: lägg in dem här i stället för att hänvisa
vidare. En hänvisning till något som inte går att öppna är inte ett
minne.

Övriga poster i Claude-projektets minne (`project-nextrum-oversikt`,
`-sakerhet`, `-databas`, `-sprak-kod`, `-genererat`, `-agenter`,
`-arbetssatt`) står i klartext i `MINNESPOSTER.md` och är sammanfattningar
av den här filen. De är alltså inte en källa: de pekar hit.
