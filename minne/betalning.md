# Betalningen: siffrorna, kort och faktura, bokslutet och lönerna

Arkivet för betalningen ur avsnitt 1 och 11 i `CLAUDE.md`, ordagrant: siffrorna, bekräftelsen,
den hållna tiden, bokslutet, Betalningar, Månadens ekonomi, Löner, lönespecen och kortvägens
historia. Timmarna står i `timmar.md`. Reglerna står i kärnan, `CLAUDE.md`; "avsnitt N" i
texten är kärnans.

---

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
  det andra gratis. Utåt är villkoret **bokade** timmar, aldrig köpta
  (2026-10-07): prissidan sa "när ni köper två timmar", men köpta
  timmar betalar aldrig passet med rabatten. Ett pass på noll kronor är INTE betalt (ett betalt
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

## Familjen bekräftar rapporten

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

## Den hållna tiden och bokslutet

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
   betala tillbaka (Återbetala under Betalningar → Att göra). Timmar på ett
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

**Månaden stängs i bokföringen (Fas 20.2).** Adminvyns Betalningar →
Bokslut väljer månad (`NXStudie.månadsval`, samma rad som i studiehjälparvyn) och visar
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
(2026-09-28, avsnitt 5). Studiehjälparens svar på ett förslag likaså
(2026-09-30). Underlag och fakturor låses inte: de betalas
efter månaden.

## Betalningar i adminvyn

**Betalningar (omgjord 2026-09-29).** Leo: "gör om betalningar. den
behöver vara mycket snyggare, lätt tolkad, lättanvänd och mycket mer
funktionell". Sektionen `ekonomi` i adminvyn (`nextrum-admin-ekonomi.js`)
har sex flikar, med adressen `#ekonomi/<flik>`:
- **Att göra** (`attgora`): allt som väntar på er, i alla månader, i
  grupper (korttvister, pengar tillbaka, fakturor, inte betalt än,
  rapporter, löner, övrigt), med knappen som gör det på raden:
  Återbetala, Lagd i Fortnox, Betald, Koppla rapport, Undanta, Kör
  månadskörningen, Öppna i Stripe och Påminn. Det är larmen ur
  `ekonomiska_avvikelser()` och fakturorna som väntar; Avvikelser är
  ingen egen flik längre. Menyns siffra är antalet rader här
  (`märkEkonomi`).
- **Alla betalningar** (`betalningar`): månadens pass, tillägg och köpta
  timmar som rader (`betalningsrader()`), med läget i färg och beloppet i
  en kolumn, filter med antal, sök, och fyra tal överst: inbetalt, att få
  in, kommande och tillbaka till familjer.
- **Fakturor**: flödet från fakturapass till betald faktura, oberoende av
  månad, med månadskörningen längst ner. Förut filtrerades fakturorna på
  sin period, och augustis utkast syntes inte i september förrän någon
  valde augusti. Sedan 2026-10-06 en rad per familj och månad (Familjens
  faktura nedan).
- **Bokslut**: vad som krävs för att stänga månaden, talen i tre kort, och
  larmen med samma rader och knappar som under Att göra.
- **Köpta timmar** och **Inställningar** (strömbrytarna `faktura`,
  `erbjudanden` och `kortsparr`, och Stripe: Kontrollera Stripe och Hämta
  från Stripe).

Månadsväljaren (en rad till 2026-10-06, sedan ett fält med en ruta för år och månad,
`minne/vyerna.md`) gäller Alla betalningar och Bokslut och syns bara där.
**Påminn skriver ett utkast** i ert eget mejlprogram (`kontaktaRuta`),
med det som inte är betalt och länken till passet eller till Bekräfta
rapport; servern skickar ingenting. Fakturan nämns bara när flaggan är
på, familjen inte är spärrad och brevet gäller ett pass: ett tillägg
betalas bara med kort. **Utbetalningarna bor under Löner**, som redan
hade samma underlag och knappar. De gamla adresserna leds rätt (`FLYTTAT`
i `nextrum-admin.js`): `#ekonomi/kortbetalningar`, `/avvikelser`,
`/utbetalningar` och `/korning`. Inget nytt i databasen: samma lyssnare
som förut ändrar något. **Raden i listorna heter `.eko-rad`**, och alla
dess delar börjar på `eko-`: `.bet-atg` fanns redan i familjens
Betalning, och den första versionen flyttade knapparna där.

## Familjens faktura

**En rad per familj och månad, och samma rad hela vägen (2026-10-06).**
Leo: "det ska inte vara 4 st olika underlag för en familj och sen köra
torrkörning, utan familjen ska samla på sig siffran på en stor faktura
som i slutet av månaden blir till underlag för fortnox, sedan när man
trycker på familjen ska man kunna se info och när och med vem de hade
lektionen". Databasen hade redan en faktura per familj och period
(`unique(parent_id, period)`); det som var splittrat var vyn. Fakturapass
utan faktura stod som en rad per MÅNAD med familjerna som länkar, utkastet
de skulle läggas på som en rad till, och knappen ledde till körningens
ruta, där det skulle torrköras innan något skapades.

- **Under Betalningar → Fakturor och Månadens ekonomi** är varje faktura
  en rad (`familjefakturor()` och `familjefakturaRad()` i
  `nextrum-admin-ekonomi.js`): Samlas, Lägg in i Fortnox, Hos familjen,
  Betalda. Under månaden finns fakturan bara i vyn, räknad ur passen med
  `NXBetalning.passpris`; summan står med "hittills". **Databasen skapar
  den fortfarande först när månaden är slut** (409 i `fakturering`, avsnitt
  Månadens ekonomi och Löner): att skapa raden i `invoices` mitt i månaden
  hade tagit tillbaka septemberfelet, där passet som rapporterades den
  sista kvällen inte fick plats. Natten mot den 1:a gör schemat utkastet,
  och varje natt efter det lägger det till sena pass så länge fakturan är
  ett utkast.
- **Passet hamnar där körningen lägger det**: `NXBetalning.lonemanad` med
  familjens fakturor, samma regel som `malmanad`. Ett sent septemberpass
  står alltså på septembers rad med "Läggs på i natt" (eller "Inte på
  fakturan än" när schemat är av, `S.körschemaPå` ur
  `manadskorning_lage`), och summan säger "varav … i natt". Ett pass utan
  rapport tar körningen inte: det står på raden, i lera, utanför summan.
- **Familjens namn fäller ut passen**: dag, veckodag och klocka, "Med"
  studiehjälparen först, ämnet, barnet, tiden och beloppet, och familjens
  e-post och telefon. Hela familjen öppnar panelen. Det utfällda står kvar
  när listan ritas om (`UTFÄLLDA`).
- **Skapa nu** (en avslutad månad utan utkast) och **Lägg till nu** (ett
  utkast med sena pass) gör nattens körning direkt, alltid för FÖRRA
  månaden som schemat: en körning för en äldre månad hade kunnat skapa
  dokument där som natten aldrig skapat. Torrkörningen görs ändå, i
  bakgrunden, och rutan som frågar visar fakturorna och studiehjälparnas
  underlag den skulle skapa. Den som trycker ser alltså vad som skapas
  innan något skrivs, utan ett eget steg. Samma knapp står under Att göra
  på `faktura_saknas` i stället för den gamla "Kör månadskörningen", som
  ledde till rutan.
- **Körningen för hand står hopfälld** under Fakturor och Månadens
  ekonomi, under schemats rad. Löners ruta står kvar som den var.
- **Familjens panel** säger med vem: Pass har studiehjälparen på raden,
  Översikt de fem senaste hållna passen, och Ekonomi varje faktura med
  passen på den, också den som samlas.
- Inget nytt i databasen eller i en edge function: en merge är hela
  driftsättningen. Provet är `verktyg/prova-fakturor.js` (Playwright mot en
  falsk Supabase, inte i CI).

## Månadens ekonomi och Löner

**Månadens ekonomi och Löner (2026-09-28)** är två egna sidor under
Ekonomi i adminvyn, bredvid Betalningar. Leo: "där ska
man aktuellt se hur många fakturor som ska skickas samt så många
lektioner som är betalda för. hur många timmar är betalt samt ej ännu
betalt ... detta för att ej ha problem om kassalikviditet", och "en till
avdelning för löner, personer och deras uppgifter samt exportera löner
till tex fortnox". Inget av dem ändrar databasen eller en edge function:
allt räknas ur det adminvyn redan hämtar, på passets månad, så en merge
är hela driftsättningen.
- **Månadens ekonomi** (`#manaden`, `nextrum-admin-manaden.js`, omgjord
  2026-09-29: "månadens ekonomi måste du göra mycket bättre också och
  funktionell") är månaden i stort: läget (betalda timmar av månadens,
  som en mätare), fyra tal (betalda, hållna men inte betalda, kommande
  och fakturor att skicka), pengarna, familjerna och fakturorna. De tre
  första talen är knappar som visar familjerna bakom talet; fakturornas
  leder till fakturorna. **Pengarna** är tre kolumner, kommit in, väntar
  och går ut (lönerna den 25:e månaden efter och det som ska tillbaka
  till familjer), och vad som blir kvar, i dag och när det som väntar har
  kommit in. Kvar är efter Stripes avgift och semesterersättningen (den
  ingår i timpenningen) men före arbetsgivaravgifter och alla andra
  kostnader, och köpta timmar räknas
  när de betalades fast de är familjens tills de använts. Sidan säger
  båda; en siffra för kassan som tiger om dem hade sett bättre ut än den
  är. **Allt räknas på Betalningars rader** (`betalningsrader(månad)`,
  med sidans egen månad). Förut räknade sidan på sitt eget sätt, och
  samma månad hade två belopp på två sidor: tillägget för övertid och ett
  avbokat pass som betalats stod bara i Betalningar. Kommit in är därför
  alltid samma tal som Inbetalt under Alla betalningar, och länken dit
  öppnar samma månad (`visaBetalningsmånad`). Ett pass räknas (`räknas`
  på raden) när det är bekräftat eller genomfört, inte undantaget och
  inte betalt med testkort. Familjerna är en rad var med lägena som
  märken, Påminn på raden och passen under (`betRad` med `utanFamilj`
  och `utanPåminn`), och ett pass betalt med köpta timmar står som
  timmar, inte som noll kronor. Lönen är Löners `lönFörMånad()`, som
  också säger om den är beräknad eller utbetald och hur många pass som
  saknar timpenning; har lönedagen passerat utan att underlagen
  markerats som utbetalda säger kolumnen det. **Mätaren har en färg**,
  mossa på papperets mörkare ton: mossa, ockra och lera bredvid varandra
  går inte att skilja åt för den som är färgblind (ockra mot lera ΔE 1,4
  med deuteranopi), och de bär redan ert drag, väntar och klart.
  Beloppet för det obetalda är vad passet kostar, med samma regel som
  familjens vy: `NXBetalning.passpris`, flyttad dit ur studievyn
  2026-09-28 så att webbläsaren har en prisregel och inte två. Köpta
  timmar räknas på dagen de betalades, och testbetalningar och testköp
  aldrig (`S.klippkortTest`). Timbankens pass känns igen på
  `timbank_uttag.sort = 'pass'` (`S.timbankPass`).
  **Intäkt denna månad på Översikt räknar samma köp** (2026-09-29), med
  passen och tilläggen för övertid: allt som kommit in på kort under
  månaden, på betalningsdagen, utan testbetalningar. Förut räknade den
  bara passen, med testbetalningarna, så ett köpt klippkort stod där
  som "inget betalt än". Ett pass betalt med timmar har inget eget
  kortbelopp, och räknas alltså inte två gånger. Köpen står också för
  sig under talet ("varav … köpta timmar"): de är en skuld till familjen
  tills timmarna använts.
- **Fakturorna skapas från sidan med månadskörningen**, samma körning som
  under Betalningar → Fakturor och Löner, och knapparna på varje faktura
  är desamma som där (`data-fakt-*` och `fakturaRad`, i
  `nextrum-admin-ekonomi.js`). Körningen är en ruta med `data-kor-ruta`
  som kan stå på flera ställen; torrkörningen hör till sin ruta, så en
  torrkörning på en sida ger ingen Skapa-knapp på en annan. **En månad
  som inte har börjat går inte att köra** från någon av rutorna
  (`körningensLäge`): sidorna visar kommande månader, och en körning för
  oktober i september hade lagt septembers pass på oktobers underlag.
  **En månad som pågår går att torrköra men inte skapa** (2026-10-01).
  Den gick förut, med en varning, och september kördes den 29:e: passet
  som rapporterades samma kväll fick inte plats på septembers underlag
  och fick vänta en månad på lönen. `fakturering` nekar detsamma med 409,
  så knappen är inte skyddet. Rutan säger när en tidigare månad har pass
  men inga underlag alls, alltså aldrig körts (`data-kor-not`): en
  körning skapar bara sin egen månads underlag.
- **Passets månad** (2026-10-01, samma kväll). Leo: "passen som är
  hållna i september ska spärras av för september". Ett pass hamnar på
  sin egen månads underlag och faktura så länge personens dokument för
  den månaden är ett utkast eller inte skapat än; körningen lägger raden
  på utkastet och räknar om summan ur raderna. Bara ett låst dokument
  (godkänt, utbetalt, skickat, betalt, makulerat) skickar passet vidare,
  till den första senare månaden som tar emot det, och ett nytt dokument
  skapas bara för körningens period. Regeln är `malmanad()` i
  `_delad/pris.ts` och, för vyerna, `NXBetalning.lonemanad`. **Körningen
  går varje natt** för förra månaden (`manadskorningen_gar_varje_natt`):
  den 1:a skapar den, resten av månaden lägger den till det som
  rapporterats eller satts på faktura sedan natten före. Förut tog
  körningen allt som inte stod på ett underlag till periodens: september
  kördes med knappen den 29:e, tre pass den 29 och 30 september
  rapporterades efter det och hade hamnat på oktobers underlag (720 kr,
  betalt den 25 november), och fakturapasset den 30:e på oktobers
  faktura. Studiehjälparvyn visade 960 kr för september bredvid en
  lönespec på 240. Leo valde samma kväll att september är 960 kr den 25
  oktober, och utkasten från den 29:e togs bort och september kördes om
  (underlag 960 kr, faktura 1 516 kr). **Lagd i Fortnox och Godkänd
  sparas bara om beloppet är det som visades** (`skrivOmOförändrad`):
  natten kan ha lagt ett pass på utkastet.
- **Löner** (`#loner`, `nextrum-admin-loner.js`) listar de godkända
  studiehjälparna och alla med något att få för månaden.
  **Månadsraden är utbetalningsmånaden** (samma kväll, Leo: "september
  jobb betalas i oktober, därför ska 240kronorna visas i oktober"):
  oktober är lönen den 25 oktober, för septembers pass, som en
  lönekörning i Fortnox Lön. Förvalt är nästa lönedag (efter den 25:e
  nästa månad), och en månad märks Utbetald när alla dess underlag är
  det. Allt under raden räknas på passens månad, månaden före
  (`passmånad`), och underlaget (`payouts.period`), körningen, Betalningar,
  Månadens ekonomi och studiehjälparens lönespec räknar fortfarande på
  passens månad. Länken från Månadens ekonomi öppnar därför månaden
  efter, och lönefilen heter efter utbetalningen. Anställningsnumret
  (`lon_anstallning`, Fas 17.1) och
  timpenningen sätts där; personnummer, adress, bankkonto och
  skattetabell står i Fortnox Lön och inte här, med flit. Månadens lön
  är underlaget plus de pass en körning lägger på det eller skapar det
  med (genomförda, rapporterade, inte undantagna, inte på ett underlag);
  de senare märks beräknat. **Varje pass räknas i EN månad**
  (`NXAdmin.lönemånad`, Passets månad ovan): sin egen, och en senare
  bara när den egna månadens underlag är godkänt eller utbetalt. Leo
  2026-09-28: "septembers pass räknar för lön i sep och okt". Körningen
  tar allt till och med periodens slut som inte står på ett underlag, och
  sidan räknade först likadant, så septembers pass stod som lön både i
  september och i oktober, också i Månadens ekonomi. Sedan stod ett pass
  i månaden efter den senaste med något underlag alls, tills regeln blev
  passets månad (2026-10-01). Ett pass vars månad redan är låst står i
  sin månad som "på nästa underlag" och i den som tar det som "från
  tidigare månader".
- **Lönefilen är PAXml 2.0**, som Fortnox Lön läser in under Lön →
  Kalender → Importera löneunderlag och matchar på anställningsnumret.
  En `lonetrans` per underlagsrad: anstid, löneart
  (`foretagsfakta.lonart_timlon`), passets datum, timmar, timpris och
  belopp. Bara GODKÄNDA underlag kommer med, och utbetalda inte, så ett
  underlag markerat Utbetald kan inte läsas in igen. Filen byggs inte om
  lönearten saknas, om någon med godkänt underlag saknar nummer, om
  raderna inte summerar till underlaget, eller om bolagsfakta säger att
  studiehjälparna är uppdragstagare. **Timpenningen är inklusive
  semesterersättning** (2026-10-01, Leo: "120 kr är inklusive
  semesterersättning, så det ska inte läggas på någon semesterersättning
  i fortnox"): filen skriver inget extra, och PAXml har inget fält som
  stänger av den. Fortnox lägger på den om lönearten är
  semestergrundande eller personen har semesterersättning inställd, så
  `lonart_timlon` ska vara en löneart som inte är det, och det kontrolleras
  i Fortnox, inte här. Läs den första filen och se att ingen
  semesterersättning tillkommit. Lönespecen säger att timpenningen är
  inklusive den. Semesterlagen kräver att en sådan inräkning görs öppet
  och tydligt, och bevisbördan ligger på arbetsgivaren; anställningsavtalet
  ska säga det, och det är revisorns fråga tillsammans med
  anställningsformen. **Filen är byggd efter standarden men
  inte provläst i Fortnox** (Fortnox hjälpsidor och paxml.se nåddes inte
  från sessionen som byggde den). Läs in den första i en löneperiod som
  går att kontrollera; nekar Fortnox den är det `paxml()` som ska rättas.

## Lönespecen

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
`manadskorning`, avsnitt 5; läget står under Betalningar → Fakturor),
så en månad har sin lönespec när den är slut. Sedan 2026-10-01 går den
varje natt och lägger ett pass som rapporteras sent på lönespecen, så
länge den inte är godkänd (Passets månad ovan). Svarar körningen något
annat än 200 blir det en uppgift en halvtimme senare, som står kvar
tills någon stänger den (avsnitt 5). Rutan ovanför lönespecen är
månadens lön: lönespecen plus det som läggs till vid nästa körning, och
lönespecen säger under summan hur många pass som läggs till, vilka av
månadens pass som står på en senare (för att den här var godkänd), och
vilka som saknar rapport. Förut räknade rutan alla pass med datum i
månaden, och september stod som 960 kr bredvid en lönespec på 240.
Månaderna som har en lönespec är märkta i månadsraden. **Ingen skatt, med flit**: `studiehjalpare_form`
står på `oklart` (avsnitt 11), och utan anställningsform finns ingen
skattetabell att dra efter. Summan står "före skatt". Blir
studiehjälparna anställda gör Fortnox Lön lönebeskedet med skatten, och
då ska lönespecen här säga var det finns i stället för att räkna själv.

---

## Prissidans kalkylator och finstilen (2026-10-06)

**Räkna själv** på prissidan: barn i passet (1–3) och timmar i veckan
(1–3), fyra veckor. Timpriset och tillägget kommer ur `CFG` som i
`initPris()`, och två och tre barn kostar lika mycket. Planens pris räknas
ALDRIG här: `initKalkyl()` läser det ur planens eget kort, som
`initErbjudanden()` skriver om ur `erbjudanden_pris`, och hittar planen
genom `data-erb-timmar` (står i HTML som reserv, skrivs om ur svaret).
Tipset visas bara för ett barn, för timmarna betalar ett barn per pass,
och bara när en plan har just så många timmar i månaden. När svaret
kommit skickar `initErbjudanden()` händelsen `nx:erbjudanden`, och
kalkylatorn räknar om. Är erbjudandena avstängda (tomt svar) döljs
sektionen, och då visas inget tips.

Samma dag i finstilen och FAQ:n:

- **"Får vi en faktura?"** svarade "Nej, i dag betalar ni med kort", i
  FAQ-märkningen också, fast fakturan är på. Svaret säger nu ja och hänvisar
  till betalningssvaret ovan för betalningstiden: att skriva
  fakturameningen en gång till hade gett `kolla-betalningsvillkor.py` fler
  fakturameningar än kortmeningar på sidan.
- **Ångerrätten** står i erbjudandenas finstil: ångrar man köpet inom 14
  dagar räknas de använda timmarna till det pris man betalade, inte till
  ordinarie.
- "priset du ser är hela kostnaden" krockade med att tiden debiteras per
  påbörjad kvart; nu "ni betalar bara timpriset för den tid passen pågår".

## 11. Vad som inte är byggt: betalningen

- **Obetalda pass på månadens faktura av sig själva** (beslutat
  2026-10-01, inte byggt). Leo: en familj som har ett pass den 30
  september och bekräftar i oktober "ska inte kunna välja hur de betalar
  utan bekräftar de inte läggs det automatiskt på faktura". Det ändrar
  villkoren: meningen på 36 ställen i 23 filer och i mejlen, på båda
  språken, och familjerna ska få veta. Leo valde en egen PR efter
  Passets månad (avsnitt Månadens ekonomi och Löner). Förslaget var att
  stänga kortet först när passet faktiskt står på en faktura: att stänga
  det vid månadsskiftet ger bara pengarna senare.
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
    (knappen **Hämta från Stripe** under Betalningar → Inställningar) hämtar den i
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
  Stripe** under Betalningar → Inställningar kör `stripe-lage`, som frågar Stripe
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
  - **Analysvyn räknar inte pengarna som Betalningar** (sett 2026-10-07).
    `analys_ekonomi`, som Analys-grafen Betalt och drift-agentens `analys`
    läser, tar kortbetalningar för pass utan att sortera bort
    testbetalningarna (`stripe_skarp = false`), har inte köpta timmar eller
    betald övertid, räknar en betald faktura på fakturans månad fast grafen
    säger "den månad pengarna kom in", och räknar ett utkast och en
    makulerad faktura som fakturerat. I driften gjorde det liten skillnad
    2026-10-07: inga kortbelopp, och ett utkast på 1 516 kr som stod som
    fakturerat i september. Rättelsen är en migration,
    grafens text och `analys`-beskrivningen i `drift` samtidigt, och om
    köpta timmar och fakturans betaldag ska räknas är ett beslut.
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
    **En tvist äger läget** (2026-09-29): `stripe-aterbetalning` nekar
    ett pass i tvist (Stripe nekar det också), adminvyn visar ingen
    knapp, och `charge.refunded` skriver beloppet men lämnar `tvist`
    orört på passet, klippkortet och tillägget. Läget räknas om när
    tvisten stängs. Varje skrivning och läsning i webhooken kastar sitt
    fel sedan samma dag, så att Stripe försöker igen i stället för att
    händelsen kvitteras med raden oskriven.
  - **Ingen avbokningsavgift.** Villkoren lovar hela beloppet tillbaka
    för ett pass som aldrig hölls. En avgift för sena avbokningar är ett
    nytt villkor, inte en inställning.
  - **Bokföringen i Fortnox har ingen koppling hit.** Ingenting ur den
    här koden når den; kortbetalningarna ska nå den genom en färdig
    Stripe-integration som väljs och kopplas i Fortnox, utanför koden.
    Stripes utbetalning till banken är netto efter avgiften, i en klump
    för flera pass; avgiften och nettot per pass står under
    Betalningar → Alla betalningar. Koppla integrationen, och bestäm med revisorn hur
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
    under Betalningar → Att göra, och `betald_men_avbokad` larmar tills den är
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

- **Skatt och anställning av minderåriga.** Olöst. Revisor före första
  utbetalningen, inte efter. Att lönen ska läggas in i Fortnox Lön
  (Fas 14.9) avgör inte frågan: `studiehjalpare_form` står på `oklart`.
  Därför räknar lönespecifikationen i studiehjälparvyn (2026-09-28)
  ingen skatt och ingen semesterersättning på toppen: den visar
  underlaget, före skatt, och säger att timpenningen är inklusive
  semesterersättning. En lönespec med skatteavdrag är ett lönebesked, och det gör
  Fortnox Lön den dag frågan är avgjord. Den 25 oktober 2026, första
  utbetalningsdagen efter att lönespecen kom, är en söndag; vilken
  bankdag lönen går då är inte bestämt, och lönespecen visar den 25:e.
