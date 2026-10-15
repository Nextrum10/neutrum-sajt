# Betalningen: siffrorna, kort och faktura, bokslutet och lönerna

Arkivet för betalningen ur avsnitt 1 och 11 i `CLAUDE.md`, ordagrant: siffrorna, bekräftelsen,
den hållna tiden, bokslutet, Betalningar, Månadens ekonomi, Löner, lönespecen och kortvägens
historia. Timmarna står i `timmar.md`. Reglerna står i kärnan, `CLAUDE.md`; "avsnitt N" i
texten är kärnans.

---

### Siffror som måste stämma överallt

- **399 kr/tim** utan bindning (`nextrum-config.js: PRIS_PER_TIMME`, och
  läxhjälpens `pris_per_timme_ore` i `tjanster`), sedan 2026-10-08; till
  dess 379. Det är priset, aldrig ett "från"-pris. Paketen kostar 379 kr i
  timmen, en månad i taget, utan bindning (nedan, och `timmar.md`).
- **69 kr/tim** tillägg för fler än ett barn — **fast, inte per barn**,
  tak tre barn (`tjanster.extra_personer_max`). Tre barn kostar 468, inte 537
  (448 och 517 med 379 kr i timmen)
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
  summan är timpris gånger de BETALDA timmarna (Fas 16.1d; sedan
  2026-10-07 `timmar − timmar_pa_kopet`, och ordinarie är alla timmarna,
  så visa aldrig ett snittpris för en plan med en timme på köpet:
  2 653 / 8 = 331,63 kr; skriv "8 timmar för priset av 7", som Standard
  sa 2026-10-07–08) — förut avrundades
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
- **Första timmen med planen, högst en per familj** (2026-10-09,
  `forsta_timmen_med_planen`). Leo: "bara folk som köper planen ska få
  gratis första lektion, men när vi skapar konto åt en kund ska de
  MAXIMALT få en timme gratis, aldrig mer än en timme gratis. de kan spara
  genom timbanken men inte få gratis av oss", och "vi ska kunna välja om
  vanliga kunder som köper timme för timme får gratis första lektion".
  - Den första planen familjen betalar får en timme till: triggern
    `klippkort_forsta_timmen` (BEFORE UPDATE OF status, när raden blir
    betald, och `klippkort_betald` är vägen dit) sätter `timmar` och
    `timmar_pa_kopet` ett steg upp och `forsta_timmen`. Timmen ges i planen
    och inte som rabatt på ett pass, för planens timmar betalar aldrig ett
    pass med `startrabatt` (Fas 22.2). `klippkort_saldo` räknar på
    `timmar`, så återbetalningen tar timmen med av sig själv: efter
    ångerfristen räknas den som använd till ordinarie timpris, inom
    fristen till betalt delat med alla timmarna, och den betalas aldrig ut.
    Ett köp som läggs in som redan betalt (fixturerna) får ingen timme.
  - Pass för pass bara för en familj vi valt: `forsta_timmen_beviljad`
    (ingen skrivpolicy; `ge_forsta_timmen()` med `is_admin()`, rutan i Ta
    in familjen och knappen i familjens panel), med regeln ovan.
  - Högst en: `intern.forsta_timmen_tagen` är sann när familjen har ett
    icke avbokat pass med `startrabatt` utan `TIPS`, eller en plan med
    `forsta_timmen` (också en återbetald, för timmen kan ha använts). Båda
    vägarna tar samma rådgivande lås som förut. Tipstimmen står utanför
    (Leo: "utan tips"), och sedan 2026-10-13 gratistimmarna admin sätter in
    (`minne/timmar.md`, Gratistimmar): de är en gåva och inget erbjudande.
  - `forsta_timmen_lage()` säger läget för familjen själv och för admin
    (`beviljad`, `tagen`, `i_planen`, `pa_pass`, `plan_id`). Studievyns
    `bjuden` visar timmen bara när den är `beviljad` och inte `tagen`;
    utan funktionen gäller den gamla regeln, som databasen då har, och
    innan svaret kommit visas ingen timme.
  - Spararaden räknar in timmen (`data-erb-spara-forsta`): 879, 1 359 och
    1 839 kr på 6 månader för Basic, Standard och Intensiv.
  - **60 dagar och först** (2026-10-13, `gratistimmarna_60_dagar`): planens
    gratis timme dras först och gäller efter planens månad så länge den
    inte använts, till 60 dagar efter köpet; tipstimmen och första timmen
    pass för pass gäller ett pass inom 60 dagar. Återbetalningen räknas
    som förut. Allt i `minne/timmar.md`.
- **Rabattkoden krockar inte med gratis timmar eller timbanken**
  (2026-10-13, `rabattkoden_krockar_inte`). Leo: "rabattkoden, fixa det
  ... koden får inte krocka med gratis timmar. jag ska bygga nytt system
  för gratis timmarna. gratis timmarna räknas i timbanken".
  - Förut kunde ett pass få en kod och något annat: första timmen lades
    ovanpå koden (två timmar med 10 % gav 478,80 kr i rabatt), tipstimmen
    gavs bara utan kod (koden sköt timmen till ett senare pass), och
    köpta timmar betalade ett pass med en kod som stod kvar och räknades
    som använd utan att ändra något.
  - Nu gäller koden bara det familjen betalar med pengar. **En gratis
    timme går först**: `forsta_timmen_bjuds` tar bort koden när den ger
    första timmen eller tipstimmen, och rabatten är timmen och inget mer.
    **Timbanken går före koden**: triggern
    `bookings_timmar_betalar_utan_kod` (BEFORE INSERT OR UPDATE, efter
    `bookings_timmar_betalar_forslaget` och före
    `bookings_timmarna_tillbaka` i namnordning) tar bort koden från ett
    pass som köpta timmar eller timbankens minuter betalar, när passet
    skapas och när de betalar det senare (bekräftelsen, jobbet
    `timmar-betalar`, ett köp som blir betalt, Betala med timmar). En egen
    trigger, för den ser passet efter vem som än betalat; ingen `UPDATE
    OF`-lista, för timmarna sätts av en BEFORE-trigger. Ett kortköp rör
    inte koden.
  - En kod som tas bort när passet skapas räknas inte som använd
    (`rakna_rabattkod` räknar efter INSERT). En som tas bort senare har
    redan räknats, som en kod på ett pass som avbokas.
  - Rutan står i förälderns egna förslag och i granskningen av ett barns
    (`NXArbete.bokning`, `o.rabattkod`), aldrig i barnets vy. Den säger när
    koden inte används och varför, och priset vid knappen följer samma
    ordning. Koden skickas ändå: databasen avgör, och blev timmarna tagna
    någon annanstans under tiden gäller den. Kvittot säger bara om en kod
    som försvann utan att en gratis timme eller timmarna förklarar det.
  - Planens gratis timme står i timbanken (i planen) och följer regeln
    om timbanken. Tipstimmen och första timmen pass för pass är avdrag på
    passet och följer regeln om en gratis timme. Villkoren nämner inga
    koder, så rabattkoden behövde ingen ny version.
  - Rabattkoderna var tomma i driften 2026-10-13 (bara `TIPS`). Taket kom
    samma kväll (nedan och `minne/sakerhet.md`).
- **Rabattkoden: timbanken, köpen, gränserna och taket** (2026-10-13,
  `rabattkoden_timmar_och_tak`). Leo samma kväll: "rabattkod kan inte
  användas om man har timmar i timbanken. rabattkoden kan användas för att
  köpa timmar i timbanken eller om man har noll timmar kvar och vill köpa
  pass för pass", och strax efter: "rabattkoder ska vi också bestämma hur
  många gånger de får användas".
  - **Timmar i timbanken stänger koden på ett pass** (`intern.har_timmar`):
    ett kort med timmar som går att använda i dag
    (`klippkort_saldo.brukbar`, köpta eller gratis) eller sparade minuter
    till en hel timme (`intern.timbank_saldo` minst 60). Bara med
    strömbrytaren `erbjudanden` på, för utan den betalar timmarna inga
    pass. Ett köp som väntar på betalning räknas inte: timmarna finns inte
    än. Utan timmar gäller koden som förut, på det familjen betalar med
    pengar. `skydda_rabatt` prövar det när passet skapas och tar bort en
    kod som inte gäller; rutan har redan sagt varför (`kolla_rabattkod`).
    Köper familjen timmar efter att passet skapats står koden kvar tills
    timmarna betalar passet, och då tar `bookings_timmar_betalar_utan_kod`
    bort den, som förut.
  - **Koden gäller köp av timmar**, en plan eller Fyll timbanken, också när
    familjen har timmar kvar. Rutan står ovanför korten under Erbjudanden
    i studievyn (`#erb-kod-rad`, bara när familjen kan köpa). Den prövar
    koden mot det första kortet med `kolla_rabattkod_kop` och, gäller den,
    mot resten, så en okänd kod är ett försök och inte ett per kort. Korten
    visar då katalogens pris överstruket och priset med koden. Köp skickar
    koden till `stripe-checkout`, som prövar den med familjens token och
    svarar med skälet (409) i stället för att ta fullt pris. Beloppet
    räknas ändå i databasen: BEFORE INSERT-triggern `klippkort_rabatt`
    (`intern.klippkort_rabatt`) läser katalogens pris (`erbjudanden_pris`)
    och sätter `rabatt_ore` och `begart_ore`, och kassan drar `begart_ore`.
    Tar triggern bort koden (den tog slut emellan) öppnas ingen kassa.
    Koden och rabatten står fast efter köpet (`klippkort_rabatt_star_fast`),
    och ett väntande köp återanvänds bara med samma kod. Gratistimmar bär
    aldrig en kod.
  - **Ett köp blir aldrig gratis av en kod**: kortet kan inte dra noll och
    `begart_ore` får inte vara noll, så en kod som tar hela priset gäller
    inte köp av timmar ("Koden gäller inte köp av timmar.").
  - **Tjänsten** för ett köp är den första aktiva tjänsten för kunder
    (`intern.kopets_tjanst`, i dag läxhjälpen), så en kod som bara gäller
    en annan tjänst gäller inte köpet.
  - **Återbetalningen** räknar på det familjen betalade, som förut:
    ångerrätten tar en andel av `betalt_ore` (`vid_anger_ore`), och vid
    uppsägning räknas de använda timmarna till ordinarie timpris vid köpet
    (`timpris_ore`), som för en plan, för koden gällde köpet av alla
    timmarna. Villkoren behövde ingen ändring för det.
  - **Hur många gånger**: `max_anvandningar` (totalt, fanns) och
    `max_per_familj` (ny; adminvyns förval är en gång, och tomt är utan
    gräns). En användning är ett pass som inte är avbokat och har kvar
    koden, eller ett betalt köp med koden (`intern.rabattkod_anvand`). Ett
    köp som väntar på betalning och är yngre än ett dygn håller sin plats
    mot gränsen totalt, men räknas inte i antalet och inte mot familjens
    egen gräns: en kassa familjen lämnade ska inte stänga koden för dem.
    `antal_anvandningar` räknas om ur passen och köpen när de ändras
    (`rakna_rabattkod`, med nya triggrar efter UPDATE på `bookings` och
    efter INSERT och UPDATE på `klippkort`), så ett avbokat pass ger
    tillbaka sin gång; förut räknades varje skapat pass, för alltid.
    Triggrarna låser kodens rad innan de prövar, så två familjer kan inte
    ta den sista gången samtidigt.
  - **Prövningen** är en funktion för alla vägar (`intern.rabattkod_prova`):
    tom, finns inte (också `TIPS` och en avstängd), datumen, gränsen
    totalt, gränsen per familj, tjänsten, timmarna (bara på ett pass) och
    sist att ett köp inte blir gratis. Svaren är meningar familjen kan
    läsa. Taket står i `minne/sakerhet.md`.
  - **Villkoren nämner inga koder** och fick ingen ny version. En kods
    villkor (hur många gånger, inte med timmar i timbanken) ska därför stå
    klart där koden delas ut, på affischen eller i mejlet (e-handelslagen
    9 §).
- Belopp lagras i **ören** överallt. Kronor blir det först vid visning
  (`NXBetalning.kronor`). Enda stället ett avrundningsfel kan smyga in
  är omvandlingen — gör den en gång, på ett ställe.

---

## Kortet reserveras vid bokningen (2026-10-13, i drift sedan 2026-10-14)

Leo: "när man klickar på boka pass eller godkänn förslaget från barnet
ska man kunna betala nu, eller på faktura. då reserveras pengar från
stripe och när passet har hållits och läxhjälparen har skrivit rapport så
dras pengarna om man betalar med kort". På två frågor samma kväll valde
han att **kortet sparas och beloppet reserveras två dagar före passet**,
och att **valet är frivilligt**: väljer familjen inget betalar de efter
passet, med kort eller faktura, som förut. Han sa också att designen kan
ändras. Databasen (`20261013170000_kortet_reserveras`), edge-funktionerna,
vyerna och villkoren är i drift sedan 2026-10-14, med strömbrytaren på (I
drift, sist i avsnittet).

**Stripes regel, och varför två dagar.** En reservation (ett
PaymentIntent med `capture_method: manual`) släpps av Stripe om den inte
dragits i tid. För en reservation vi gör utan att familjen är med (MIT,
merchant-initiated) gäller Visa 5 dagar, och Stripe räknar 4 dygn och 18
timmar, och Mastercard, American Express och Discover 7 dagar. Den
exakta gränsen står på chargen (`payment_method_details.card.capture_before`)
och läses därifrån, aldrig ur en tabell här. Reserverar vi vid bokningen
släpps reservationen före ett pass som ligger mer än några dagar fram.
Därför sparas kortet när familjen föreslår passet (Checkout i läget
`setup`), och beloppet reserveras två dagar före passet. Studiehjälparen
har då ungefär två och ett halvt dygn efter passet på sig att skriva
rapporten innan Visas reservation släpps. Längre förlängda reservationer
(30 dagar) finns bara för IC+-prissättning och bara när familjen är med.

**Flödet.**
1. **Valet** står i Föreslå pass och i granskningen av ett barns förslag:
   kort, faktura eller efter passet. Det visas inte när timmarna betalar
   passet eller passet kostar inget, och bara när strömbrytaren
   `kortreservation` är på: med den av är förslaget som förut, och
   fakturan väljs efter passet. Faktura väljs med samma skrivning som förut
   (`betalning_status` till `faktura`, prövad i `skydda_bokningsfalt`),
   nu direkt efter att förslaget skapats. Kort väljs med
   `valj_kort(pass, true)`.
2. **Kortet sparas** första gången: kassan öppnas i läget `setup` med
   familjens kund hos Stripe (`stripe_kunder`, en per familj, utan namn
   och e-post, bara familjens id i metadata), och webhooken skriver kortet
   (`kort_sparat()`). Sedan räcker valet: samma kort används för nästa
   pass. Stänger familjen kassan står kortet som valt utan kort; inget
   reserveras, och familjen betalar efter passet om inget kort läggs till.
3. **Reservationen**: jobbet `kortreservation` (var tionde minut) väcker
   `stripe-reservation` när `kortreservation_att_gora()` har något.
   Ett bekräftat pass som börjar inom 48 timmar reserveras med det
   sparade kortet utan att familjen är med (`off_session`), till passets
   pris för den bokade tiden. Nekas kortet blir läget `misslyckad`, och
   familjen får notisen `kort_nekat`; inget nytt försök görs förrän
   familjen lagt till ett kort eller tryckt Försök igen.
4. **Dragningen**: när rapporten finns (passet `completed`) dras priset för
   den hållna tiden, högst det reserverade (delvis dragning släpper
   resten). Leo samma kväll: "när passet har rapporterats kan pengarna
   dras". Familjens bekräftelse av rapporten väntas inte in, som för
   alla pass sedan Fas 19.2. Var passet längre betalas tillägget som förut
   (`pass_tillagg`). Webhooken skriver betalningen på passet
   (`payment_intent.succeeded`): bara den sätter `betald` och
   `betalt_ore`.
5. **Utan reservation**: hann ingen reservation göras, eller släppte
   Stripe den innan rapporten kom, dras kortet en gång efter rapporten
   (en vanlig betalning utan familjen). Nekas den betalar familjen efter
   passet som förut (`ej_betalt` larmar).
6. **Släppet**: en reservation släpps (PaymentIntent cancel) när passet
   avbokas, när timmarna, kassan eller fakturan betalar det, när familjen
   väljer bort kortet eller tar bort det, och när passet flyttas så att
   reservationen inte räcker till efter passet (då reserveras det igen två
   dagar före den nya tiden).

**Datat** (inga nya kolumner på `bookings`, så `skydda_bokningsfalt` rörs
inte):
- `stripe_kunder`: familjens kund hos Stripe. Bara tjänstekontot.
- `sparade_kort`: ett kort per familj, Stripes id för kortet och det
  familjen ser: märke, sista fyra siffror och giltighetstid. Familjen
  läser genom `mitt_kort()`, admin genom policyn.
- `kortreservationer`: en rad per pass där kort valts. Lägena: `vald`
  (inget reserverat än), `reserverad`, `dragen`, `slapps` (ska släppas),
  `slappt`, `utgangen` (Stripe släppte den) och `misslyckad` (`fel` är
  Stripes kod). Familjen läser sina rader.

**"Betala i förväg" går bort** när strömbrytaren slås på: att dra pengarna
direkt vid bokningen hade varit ett andra sätt att betala före passet,
och villkoren hade fått lova två. Knappen blir valet av kort, och ett
pass som redan är betalt i förväg står kvar som det är.

**Raderingen** väntar på kortet: ett sparat kort och en reservation är
hinder (`kort_sparat`, `kort_reserverat`) i `intern.radering_underlag`, så
att inget blir kvar hos Stripe när kontot tas bort.

**Edge-funktionerna** (byggda samma natt, i drift sedan 2026-10-14):
- **`stripe-checkout`** har två lägen till. `kort: 'spara'` öppnar en kassa i
  läget `setup` på familjens kund (bara familjen, bara med strömbrytaren på;
  kunden skapas utan namn och e-post). `kort: 'ta_bort'` anropar
  `kort_borttaget()` och kopplar bort alla kort på kunden hos Stripe, också
  ett som blev kvar vid ett byte. Familjen tar bort sitt eget kort och admin
  en familjs (`familj`). Det går alltid, också med strömbrytaren av.
- **`stripe-reservation`** (ny, `verify_jwt` av, hemligheten i
  `x-nextrum-notis`) gör det `kortreservation_att_gora()` säger, högst 20
  rader per väckning.
  - **Reservationen**: ett PaymentIntent med `capture_method: manual`,
    `off_session` och `confirm`.
  - **Dragningen**: `capture` med `amount_to_capture`, priset för den
    hållna tiden och högst det reserverade (`dragning()` i
    `_delad/kortreservation.ts`), och minuterna i metadata.
  - **Utan reservation**: en vanlig dragning, när reservationen inte
    hann göras eller gick ut.
  - **Släppet**: `cancel`, med vår egen orsak.
  - **Ett nej** (card_error, eller ett kort som inte finns) skriver bara
    den, som `misslyckad` med Stripes kod. Stripe nere, eller ett fel i
    vårt anrop, skriver inget: jobbet försöker igen om tio minuter.
- **Två dragningar får aldrig hända.** Innan ett PaymentIntent skapas
  frågas Stripe om kunden redan har ett för passet (listan över kundens, i
  realtid). Varje skapande har en idempotensnyckel med radens ändringstid:
  inom samma läge ger två körningar samma PaymentIntent, men ett nytt
  försök är ett nytt anrop. Stripe sparar annars ett nej på nyckeln i ett
  dygn.
- **Webhooken** är reserven och den som betalar passet.
  - `checkout.session.completed` i läget `setup` sparar kortet
    (`kort_sparat()`), med familjen ur kunden och aldrig ur metadata, och
    kopplar bort det förra.
  - `payment_intent.amount_capturable_updated` skriver en reservation som
    funktionen inte hann skriva.
  - `payment_intent.succeeded` skriver betalningen på passet genom samma
    `betalaPasset` som kassan (timmar och timbank som hann före, och
    uppgiften när raden redan bär en annan betalning).
  - `payment_intent.canceled` är `slappt` med vår orsak och `utgangen`
    utan.
  - `payment_failed` skriver inget för en reservation: funktionen har
    redan gjort det, och en andra skrivning hade räknat försöken dubbelt.
  - Bara ett PaymentIntent med `kortreservation` i metadata rörs. Med
    flit inte `booking_id`, som webhooken läser som kassans.
- **Ett släpp rör bara radens egen reservation.**
  `kortreservation_skriv(…, 'slappt', pi)` prövar nu, som `utgangen`, att
  raden pekar på just det PaymentIntent. Ett överblivet som släpps efter
  `avvisad` hade annars fått en reservation som fortfarande håller pengar
  att se släppt ut.
- **En delvis dragning är ingen återbetalning.** Stripe räknar sedan
  API-versionen 2025-03-31.basil (vi pinnar 2025-08-27.basil) inte det
  som släpps som återbetalt: inget `charge.refunded` och inget
  `amount_refunded`. Webhookens återbetalning räknar mot `amount_captured`,
  så att en hel återbetalning av det dragna blir `aterbetald`.

**Vyerna** (2026-10-14, bakom strömbrytaren; med den av är allt som förut):
- **Förslaget** och granskningen av ett barns förslag har raden
  **Betalning** i dagens panel: Efter passet (förvalet), Kort och, när
  familjen får välja faktura, Faktura, med en mening under om vad valet
  gör (`betalval` i `NXArbete.bokning`, `betalvalFörslag()`). Valet står
  kvar till nästa förslag. Passet skapas först och valet skrivs sedan
  (`efterBetalsätt()`: fakturan som förut, kortet med `valj_kort`); ett
  fel där fäller inte förslaget, och kvittot säger vad som gick. Saknas
  kortet är Spara kortet familjens drag i kvittot.
- **Passets sida**: före passet är valen Välj kort (orange, på platsen
  där Betala i förväg stod) och Betala mot faktura. Med kortet valt säger
  beskedet vad kortet gör och när, och Välj bort kortet står under. Ett
  fakturapass får Välj kort i stället, aldrig Betala med kort nu. Nekat:
  Byt kort (eller Lägg till kort) och Försök igen. Räcker familjens timmar
  eller timbanken till passet står Välj kort inte där (`kortKanVäljas`,
  2026-10-14): timmarna går först, `timmar-betalar` och
  `timmar_betalar_kommande` betalar passet också när kortet valts, och ett
  val av kort hade inte gjort något.
- **Listorna** märker passet med kortets läge (Kort, Reserverat på
  kortet, Kortet nekades) i stället för Ej betalt (`passMärke`), och
  **Bekräfta rapport** säger att priset dras från kortet inom några
  minuter, utan betalval: kortet dras när rapporten finns, inte när den
  bekräftas.
- **Profil → Kortet** (`#flik-kort`, dold tills strömbrytaren är på
  eller ett kort är sparat, så att ett kort alltid går att ta bort):
  märket, de sista fyra, giltigheten, Byt kort och Ta bort. Kassan för
  kortet öppnas inbäddad som de andra, och vyn läser om kortet i en halv
  minut efter kassan, för webhooken skriver det en stund senare.
- **Strömbrytaren av med ett val kvar**: jobbet reserverar och drar då
  inget val (`kortreservation_att_gora`), så vyn räknar inte med kortet
  (`kortBetalar` kräver strömbrytaren, utom för en reservation som står,
  som dras ändå) och säger att passet betalas som vanligt.
- **Utan migrationen** läser vyn flaggans rad först och frågar inte efter
  `mitt_kort()` eller `kortreservationer` när den saknas, så att varje
  inloggning inte ger två 404.
- **Adminvyn**: familjens panel under Ekonomi har Kortet, med kortet och
  Ta bort kortet (`stripe-checkout` med `familj`) och passen där kortet
  valts, med läge, belopp och sista dag för dragningen. Bara för en
  superadmin (policyerna), och utan migrationen står rubriken inte.
- **Förhandsvisningen** har strömbrytaren på, Annas Visa ·· 4242 och ett
  förslag med kortet valt, och `valj_kort` prövar som databasen. Kortet
  sparas och tas inte bort där: det går genom Stripe.
- **Provet** är `verktyg/prova-kortet.js` (`minne/genererat-och-ci.md`).

**Villkoren** (2026-10-14, migrationen `villkoren_kortet`, version
2026-10-15): med strömbrytaren på dras pengarna aldrig före rapporten, och
det är löftet. Meningen på alla 36 ställen och i mejlen är "Ni betalar varje
pass med kort, och pengarna dras först när studiehjälparen har skrivit
rapporten: väljer ni kort när ni bokar reserveras priset två dagar före
passet, annars betalar ni när ni bekräftar rapporten", och fakturan går att
välja "före eller efter passet" och kommer "i början av månaden efter
passet" (förut "nästa månad", som inte är entydigt när den väljs före).
Villkoren har en egen punkt, Kortet ni väljer när ni bokar (`#kortet`): att
valet ger oss rätt att reservera och dra, att reservationen är den bokade
tiden tidigast två dagar före ett bekräftat pass, att dragningen är den
hållna tiden och aldrig mer än det reserverade, att tillägget för ett
längre pass betalas när rapporten bekräftas, när reservationen släpps, att
kortet går att välja bort tills pengarna dragits och tas bort under Profil,
och att ett nej ger ett mejl. Stripe-punkten säger vad vi ser av ett sparat
kort (märket, sista fyra, giltighetstiden) i stället för "vi sparar dem
inte". FAQ:ns "Måste vi betala innan passet?", prissidans steg 02 (Välj hur
ni betalar), mejlets "Vill ni välja kort" och agenternas fakta säger samma
sak, och Betalning i studievyn heter Före passet i stället för Betala i
förväg.
- **Texten och strömbrytaren följs åt**: med strömbrytaren av finns Betala i
  förväg, och då stämmer inte meningen. `kolla-betalningsvillkor.py` har
  `KORTET_RESERVERAS` (som `FAKTURA_I_TEXTEN`): på kräver den nya meningen
  och förbjuder den gamla och "betala i förväg"; slås strömbrytaren av ska
  meningen tillbaka i samma ändring. PR:en skulle mergas när strömbrytaren
  slogs på, men **mergades 2026-10-14, före** (Leos beslut, PR #281), och
  kedjan i `DEPLOY-BETALNING.md` 9.14 kördes samma eftermiddag: i några timmar
  sa sidorna kortet medan vyn hade Betala i förväg (Stripe stod i testläge,
  så inga riktiga pengar drogs), och sedan 15.47 UTC står strömbrytaren på och
  databasens version är 2026-10-15. Vyns ord pass för pass (dras när
  studiehjälparen har skrivit rapporten, Betala mot faktura, i början av
  månaden efter passet) följde i PR #283 (Leo: "sajt ska säga samma sak som
  vyn, lektion per lektion").
- **Den som väljer kortet har godkänt villkoren**: triggern
  `kortreservationer_kraver_villkor` (i `villkoren_kortet`, som bokningens och
  köpets) prövar `intern.villkoren_godkanda` när familjen själv väljer kortet,
  en ny rad eller en som väljs igen. Jobbet, webhooken och admin går förbi,
  och att välja bort går alltid, som en avbokning. En trigger och inte en rad
  i `valj_kort()`, för `kortet_reserveras` körs i driften före villkoren och
  ändras inte efteråt. Provet står i avsnitt 33 i `rls-test.sql`.
- **Datumet** är 15 oktober, fast villkoren gick ut 2026-10-14: sidorna kom
  ut med det datumet, och versionen ska vara sidans datum
  (`kolla-villkor.py`).

**I drift** (2026-10-14, Leos "kör", i ordningen i `DEPLOY-BETALNING.md`
9.14, från main 1fbc18a; ingen annan session körde mot driften, och
NexLäx-sessionen väntade med sin bank tills kedjan var klar):
- Funktionerna, 12.41–12.47 UTC: `drift` v19, `stripe-reservation` v1
  (`verify_jwt` av), `stripe-webhook` v14, `ekonomi` v25 och `notis-ko` v25
  (mallen `kort_nekat` och mejlets mening). Agenterna som driftsatte dem
  stoppades av kvoten innan de hann jämföra, så de hämtades tillbaka
  15.35: `notis-ko` 15 av 15 filer, `stripe-reservation` 9 av 9, `drift` 5
  av 5 och `ekonomi` 4 av 4 byte för byte lika main, med hela importgrafen.
  Webhookens `index.ts` saknar en tom rad i en kommentar (rad 540), som föll
  bort när filen skrevs av; de andra sex filerna är lika. Koden är
  densamma, och den blir byte för byte lika nästa gång webhooken
  driftsätts. `stripe-checkout` v20 var redan lika main.
- Databasen, 15.40–15.48 UTC: `kortet_reserveras` och `villkoren_kortet`,
  jämförda med en lokal databas byggd ur main (`minne/databasen.md`, Kortet
  reserveras vid bokningen). Hela `rls-test.sql` 1739 av 1739 mot driften,
  tillbakarullat, före och efter strömbrytaren.
- Strömbrytaren `kortreservation` på 15.47:57 UTC, med SQL (auditloggen
  säger `system`). `stripe-reservation` svarade 200 (`{"ok":true,
  "utfall":{}}`) på ett röktest genom `intern.natanrop` med målet
  `rokprov:stripe-reservation`, och jobbet `kortreservation` (nr 42) gick
  första gången 15.50, utan något att göra.

**Kvar**:
- Juristen läser villkoren, särskilt rätten att dra från ett sparat kort
  utan att familjen är med, och rad 29 i `DATASKYDD.md`.
- Stripes endpoint: de tre nya händelserna
  (`payment_intent.amount_capturable_updated`, `payment_intent.succeeded`,
  `payment_intent.canceled`). Utan `succeeded` drar `stripe-reservation`
  pengarna, men passet blir aldrig betalt hos oss, för bara webhooken
  skriver betalningen. Kontrollera Stripe säger vilka som saknas.
- Provet i testläge (`DEPLOY-BETALNING.md` 9.14 steg 6), med strömbrytaren
  på. Det provet säger om kassan i läget `setup` behöver
  `managed_payments: { enabled: false }`, som kassan för ett pass har. Den
  står inte där, för läget tar ingen betalning.

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
**Påminn skriver ett utkast** i er Gmail (`kontaktaRuta`, 2026-10-11),
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
- **Bonusen för tips** (2026-10-13, Leo: "bonus redovisas som lön"): 300 kr
  till en studiehjälpare när vi tar in någon som sökt jobb med hens kod
  (`tipsbonus`, `minne/affaren.md`). Den är inget pass och har ingen tid,
  så den står inte i `payouts`: en `payout_lines`-rad kräver minuter, bara
  månadskörningen skriver underlag, och `las_utbetalningsbelopp` fryser
  beloppet. I stället har den ett eget läge (Utkast, Godkänd, Utbetald,
  Struken) i rutan Bonus för tips under Löner, med samma regel som
  underlaget (Utbetald bara efter Godkänd, och läget sparas bara om det är
  det som visades). Den hör till lönemånaden den tjänades in
  (`tipsbonus.period`), räknas i Att betala ut, i personens Att få och i
  Månadens ekonomi (`lönFörMånad`, där en månad är utbetald först när
  också bonusarna är det). Lönefilen tar den godkända som en egen
  `lonetrans`: lönearten `foretagsfakta.lonart_tipsbonus`, datumet den
  tjänades in, antal 1 och apris lika med beloppet. Filen går att bygga
  med bara bonusar, och stoppas om lönearten saknas när en bonus är
  godkänd. Bonusen är inklusive semesterersättning (Leo 2026-10-13: "den
  ska vara semestergrundande, men de ingår redan i de 300kr. så 300kr är
  inklusive semesterersättning"), som timlönen: lönearten i Fortnox ska
  därför inte vara markerad semestergrundande, annars lägger Fortnox på
  semesterersättningen en gång till. Beloppet ändras inte
  (`intern.tipsbonus_ore()` är 30000). Villkoren, studiehjälparvyn,
  lönespecen och strömbrytarens text säger det sedan 2026-10-14. Att
  semesterersättningen får ingå i lönen bekräftar revisorn med
  `studiehjalpare_form`. `Skicka underlag` (mejlet) handlar om passen och bär
  inte bonusen.

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
Sedan 2026-10-13 står månadens bonus för tips under passen, med summan
inklusive den, och under månadens lön (`o.bonus` i `lonespec`).

---

## Prissidans kalkylator och finstilen (2026-10-06)

**Omgjord 2026-10-07** (Leo: "Räkna själv på hemsidan gör de lite moderna
och bättre"). Reglagen är segmenterade väljare med en tumme i lera som
följer `data-v` på gruppen (siffrorna i tummen är motförskjutna, och
`[aria-pressed]` animeras inte). Svaret är två paneler, per pass och med
planen, med en stapel för andelen (`--andel` sätts på stapeln, där den
läses; den jämför bara två belopp som redan visas). Summor som byts glider
in med en Web Animation, aldrig vid första räkningen eller med reducerad
rörelse. Panelen med planen har tre lägen i samma cell (plan, syskon,
ingen), och den högsta bestämmer höjden, så inget hoppar. Med 4, 8 och 12
timmar (Basic, Standard, Intensiv) har varje val för ett barn en plan; vid
3 timmar i veckan visar den Intensiv, fast Basic + Standard är billigare
(Leos val). Planen hittas i `.pr-erb-plan[data-erb]`, aldrig i lyftet.
Texten nedan gäller fortfarande för hur priset läses.

**Räkna själv** på prissidan: barn i passet (1–3) och timmar i veckan
(1–3), fyra veckor. Svaret är månadskostnaden och säger det (2026-10-12):
rutorna heter "Månadskostnad, pass för pass" och "Månadskostnad med
Basic", och ingressen säger "så ser ni månadskostnaden" och att en månad
räknas som fyra veckor. Samma kväll fanns ett reglage för 1, 3 eller 6
månader (Leo: "lägg till i beräkning antal månader ... utgå alltid från 1
månad"), som gick igen innan det mergades (Leo: "ta bort månaderna, skriv
att det är månadskostnaden"). Det hade också visat två siffror för samma
sak: sex månader med Basic var 480 kr mindre än pass för pass där och 879
kr i plankortets Spara-lapp, som räknar in första timmen. Timpriset och tillägget kommer ur `CFG` som i
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

---

## Timpriset 399 och paketen 379 (2026-10-08)

Leo: "Läxhjälpen ska kosta 399kr standard obundet. Sen på våra paket blir
man bunden i 1 månad och de kostar 379kr per [timme]", "inte från utan för,
detta är vårt takpris utan tillägg", och om jämförelsen med de andra
aktörerna: "spara upp till 1200kr vid 6 månader" och "Upp till 45 % lägre
pris ... som en tejp bit som tejpas fast på erbjudandet".

- **Databasen** (`20261008100000_timpris_399_paketen_379`): läxhjälpens
  `pris_per_timme_ore` blir 39900, `prissattning` följer med genom
  triggern (och dess förval), och `plan_standard` får `rabatt_procent` 5
  och `timmar_pa_kopet` 0. `erbjudanden_pris` har inget eget tal, så vyn
  står orörd: 399 × 0,95 = 379,05, nedåt till hel krona 379 kr. Paketen blir
  1 516, 3 032 och 4 548 kr, klippkorten 379 kr i timmen (3 790 kr för 10).
  Frysta priser på pass (`bookings.timpris_ore`) och köpta kort rörs inte:
  en prishöjning gäller pass som bokas efter den, och prisgarantin gäller
  köpta timmar. Inget köp pekade på `plan_standard`, så koden fick nytt
  innehåll i stället för en ny kod.
- **Startrabatten och tipstimmen** är oförändrade: en timme till passets
  frysta pris, alltså 399 kr för pass som bokas efter migrationen.
- **Inget från-pris**: sajten säger "för 399 kr", och klippkortens rubrik
  på prissidan och i studievyn säger timpriset (379 kr) i stället för
  "från" det billigaste kortet, när alla kort har samma timpris.
- **Jämförelsen** (`data-erb-lagre`) avrundas till närmaste fem: 3 032 mot
  5 000 kr är 39,4 %, och sidan säger "upp till 40 %". Först samma dag
  nedåt till hel procent (39); Leo: "upp till 40% billigare är det, inte
  39%", och han valde 40 efter att ha fått uträkningen.
  **Spara-raden** (`data-erb-spara="6"`) är den största skillnaden mellan
  ordinarie (399 kr gånger timmarna) och planens pris bland planerna,
  gånger sex: Intensiv, 12 × 20 kr × 6 = 1 440 kr. Leo sa 1 200; talet
  räknas ur svaret, så sidan säger det som är sant för katalogen. Sedan
  samma kväll säger raden också planens namn (nedan).
- **Tejpen** (`.nx-tejp` i `nextrum-cinema.css`) är en allmän komponent:
  en remsa i ockra mot orange (`--tejp`, `--tejp-ink`, `--tejp-fiber`,
  på tre ställen), sågtandade kortändar med `clip-path`, `rotate` för
  lutningen, och `.nx-tejp-pa` lägger den över ett korts överkant. På
  prissidan sitter den på lyftet (Standard) med jämförelsen.
- **Bindningen** står på prissidan, i studievyn ("4 timmar · 1 månads
  bindning"), i FAQ:n och i agentens fakta, men **villkoren säger det
  inte**: de säger "ingen bindningstid" och att den som slutar med en plan
  får tillbaka det som är kvar, med de använda timmarna till ordinarie
  pris. FAQ:n förklarar bindningen med just den regeln. En bindning som
  betyder mer än så kräver en ny version av villkoren (CLAUDE.md avsnitt 11).
  **2026-10-09** frågade Leo igen ("379kr är bindning för aktuella
  månaden ... 399kr är lektion för lektion och är ingen bunden eller
  uppsägningstid"), fick veta att villkoren säger annat, och svarade: "De är
  ingen bindning för man köper ett erbjudande som ska förbrukas på en månad
  ta bort bindningstid inget är de". Ingen av dem binder alltså, och sajten
  ställer aldrig "utan bindning" mot paketen: 399 kr är "pass för pass"
  (`minne/vyerna.md`, Just nu 2026-10-09).
- **`rls-test.sql`**: avsnitt 25 provar de nya planerna och siffrorna med
  399 kr, och 19.5 och 20.1 räknar på passets eget frysta pris i stället
  för 379 kr, så att de inte beror på katalogen.

## Kronortejperna, spara-raden och märket (2026-10-08)

Leo samma kväll: "På dessa erbjudanden ska de stå på basic upp till 2000kr
mindre [än] liknande jämförbara paket från andra aktörer konkurrent då
allakando tar 3540, på [Standard] upp till 2800kr mindre än liknande
jämförbara paket från andra aktörer. Och på intensiv upp till 3800kr. Och
detta ska synas som tejp på erbjudanden", "Under erbjudanden ska de stå
litet ... jämförelserna gjordes med en årskurs 9 elev i oktober", "Ha
intensiv paketets besparing som standard för 6 månader så skriv spara upp
till … på 6månader med intensivplanen" och "Ta bort -5% på erbjudande skriv
istället 399 streck över de, 379". (Han skrev "basic" två gånger; den andra
är Standard, för 2 800 kr är Standards belopp.)

- **Kronortejperna** (`.nx-tejp.nx-tejp-kort` i varje plankort på
  prissidan, efter priset): "Upp till N kr mindre än liknande paket hos andra
  aktörer". Jämförelsepriset står på tejpen (`data-erb-jamfor-ore`, med
  `data-erb-jamfor-timmar`), och `initErbjudanden()` räknar skillnaden mot
  planens pris i svaret och avrundar den NEDÅT till hundratal kronor
  (`data-erb-mindre`): "upp till" får aldrig lova mer än skillnaden, så
  procentens avrundning till närmaste fem gäller inte här. Tejpen har eget
  `data-erb` och står dold (`data-erb-vantar`) tills talet är skrivet; den
  döljs ensam, aldrig kortet, vid fel antal timmar eller under 100 kr.
  Priserna: Basic 354000 öre (Allakandos 3 540 kr, Leos underlag), Standard
  583200 och Intensiv 834800, som är räknade baklänges ur Leos 2 800 och
  3 800 kr mot våra 3 032 och 4 548 kr: de är inga uppmätta priser, och
  Standards 5 832 är ett annat pris än lyftets och Just nus 5 000 kr+
  (CLAUDE.md avsnitt 11). Ingen aktör nämns på sajten. Tejpen ligger i
  flödet och inte över kortets kant, för korten har `overflow:hidden`
  (bandet över Standard) och telefonens svepraden klipper det som sticker upp;
  varje remsa lutar åt sitt håll och sätts fast i tur när raden glider in.
- **Raden under planerna** (`data-erb-jamfor-not`): "Jämförelserna gjordes
  med en elev i årskurs 9 i oktober 2026", liten, och bara när en tejp i
  sektionen syns.
- **Spara-raden** säger planen: "Spara upp till 1 440 kr på 6 månader med
  Intensivplanen" (`data-erb-spara-plan`, på prissidan och i Just nu).
  Leo trodde att 1 440 kr var Basics; Basics är 480 kr (4 × 20 × 6).
  Namnet är den plan som ger den största besparingen, ur planens kort på
  sidan (sidans språk), annars ur svaret, så engelska startsidan säger
  "Intensiv" där prissidan säger "Intensive".
- **Märket** på planerna och klippkortsraden, på prissidan och i
  studievyn, är timpriset utan bindning överstruket och det rabatterade
  bredvid (399 kr överstruket, 379 kr), båda ur svaret, i stället för
  "−5 %". Det döljs när de är lika, och studievyn visar det aldrig på ett
  kort med timmar på köpet. Plankortets rad längst ned, som sade samma
  timpris en gång till med "ni sparar" ("399 kr 379 kr / timme · Ni
  sparar 160 kr"), är borta sedan 2026-10-12, på prissidan, i studievyn
  och på engelska (Leo: "de ska bort från standardplanen. de finns också
  på intensiv och bas"). Märket säger timpriset, Spara-lappen och i
  studievyn den överstrukna summan besparingen. Prissidans kalkylator
  läste sitt "Ni sparar 80 kr · en månad i taget" ur raden; samma kväll
  gick det också (Leo: "ta bort de där "spara 80kr" per månad också"), och
  raden under planens summa säger bara "En månad i taget". Lappen längst
  ned i plankortet är det som trycks ner, så att den står i linje i alla
  tre korten. I
  studievyn står raden bara kvar på ett kort med timmar på köpet, utan
  "ni sparar", för där är den det enda som säger hur summan går ihop.

---

## Familjerabatterna (2026-10-15)

Leo: "vi i admin vill skapa egna rabattkoder som bara vi har tillgång till.
de ska skrivas i i familjernas konto som bara vi kan se och röra,
rabattkoden kan vara en samarbetsparter som anvönder den och vi vill ge 10 kr
billigare på alla timmar som köps tex. vi ska precis som när vi ger ut gratis
timmar i timbank kunna skriva in rabattkoder för familjerna som ändrar deras
pris tills vi tar bort rabatten. tex 10 kr tills vidare. de ser bara att de har
rabatt vid checkout men inte annat. vi ser rabatkoden när vi klickar på deras
namn och kan välja ta bort eller ändra. sen skapar vi våra rabattkoder."

Migrationen `20261015120000_familjerabatter`, kassan (`stripe-checkout`,
SESSIONSFORM 9, `_delad/erbjudanden.ts`), agentens fakta, adminvyn och
studievyn. Inte i drift när det skrevs: kedjan står i `DEPLOY-BETALNING.md`
9.15.

- **Två tabeller.** `familjerabatter` är koderna: kod (som rabattkoder:
  versaler, siffror och bindestreck), en beskrivning bara för oss,
  `ore_per_timme` (1–200 kr i hela kronor: taket fångar en nolla för mycket)
  och `aktiv`. Bara admin läser och skriver (`is_admin()`), och en kod tas
  aldrig bort och byter aldrig namn: den stängs av. `familjens_rabatt` är en
  rad per familj med koden, `andrad_at` och `andrad_av`. Bara admin läser den,
  och bara `satt_familjerabatt(familj, kod)` skriver, med `is_admin()` först;
  null tar bort, och raden står kvar utan kod (inget `delete`, kärnan avsnitt
  5). Familjen frågar `min_familjerabatt()` och får bara beloppet per timme,
  aldrig koden; barnets roll och anon når den inte.
- **Ingen rabattkod.** En rabattkod skriver familjen in, den räknas, har
  gränser och datum, och den prövas av `intern.rabattkod_prova`. En
  familjerabatt skriver familjen aldrig, den syns inte och den räknas inte.
  De står i var sin tabell så att en kod för en partner aldrig kan gissas i
  rabattkodsrutan, och fliken nekar ett namn som en rabattkod redan har.
- **Kronor av på varje timme, inte ett lägre baspris.** Leo sa "10 kr
  billigare på alla timmar som köps". En plan kostar timpriset minus 5 %,
  nedåt till hel krona, och sedan dras rabatten från varje betald timme
  (379 kr blir 369). Hade rabatten dragits från baspriset före planens 5 %
  hade 20 kr blivit 19 på en plan (floor(379 × 0,95) = 360 mot 359), och
  kassan hade dragit mindre än vi sagt till partnern. Därför står
  `klippkort.timpris_ore` kvar som katalogens, och rabatten bredvid, per timme.
  På ett pass dras den från det frysta timpriset, för allt som räknar ett
  pass läser `bookings.timpris_ore` (kortet, reservationen, fakturan,
  månadskörningen, första timmen, en rabattkod): att lägga rabatten i en egen
  kolumn hade krävt att varje sådan räkning skrevs om, och glömdes en hade en
  månad fått två belopp.
- **Priset fryses som förut.** Rabatten gäller det som bokas och köps medan
  den finns. Sätts, ändras eller tas den bort står det bokade och köpta kvar
  med sitt pris, som när timpriset ändras. En avstängd kod ger ingen rabatt,
  och den sätts inte på en ny familj. Att också sänka obetalda bokade pass hade
  krävt att första timmen, en kod och en reservation som redan står räknades
  om; det gör vi inte.
- **Vad den gäller.** Pass, planer, Fyll timbanken och timmar till en plan,
  när rabatten lämnar ett pris kvar. Tillägget för fler barn rörs inte (Leo
  sa timmar), och gratistimmar, första timmen och tipstimmen kostar redan
  ingenting. Lönen rörs inte: studiehjälparen får betalt för den tid som hölls.
- **En rabattkod gäller ovanpå**, räknad på priset efter familjerabatten: den
  är familjens pris, och en kod räknas på familjens pris som för vem som helst.
  `skydda_rabatt` läser redan passets frysta timpris, och `kolla_rabattkod_kop`
  och `intern.klippkort_rabatt` prövar koden mot priset efter rabatten. Vill
  Leo att de inte ska gälla samtidigt är det en rad i `intern.rabattkod_prova`
  och en mening i rutan.
- **Att sluta.** Villkoren räknar de använda timmarna till "ordinarie
  timpris". För en familj med rabatt var det lägre, och `vid_uppsagning_ore`
  räknar dem nu till `timpris_ore − familjerabatt_ore`, och
  `intern.timbank_varde` minuterna till samma, så att de två fortfarande tar ut
  varandra. Det blir aldrig mer än villkoren tillåter. Inom ångerfristen räknas
  andelen av det betalda, som förut.
- **Vad familjen ser.** Leo: "de ser bara att de har rabatt vid checkout men
  inte annat". Priset vid knappen i Boka pass ("1 timme, med er rabatt"), steget
  i Köp till timmar ("med er rabatt"), raden under rubriken när kassan öppnas,
  och raden i Stripes kassa och på kvittot ("Med er rabatt på 10 kr per timme",
  `kassarad`, och på ett pass "med er rabatt på 10 kr per timme"). Plankorten och
  Fyll timbanken visar katalogens pris, och Profil säger ingenting. Priset på ett
  bokat pass är det frysta, alltså med rabatten, utan ett ord om den.
- **Vad vi ser.** Fliken Tjänster → Familjerabatter: koderna, beloppet som
  ändras på raden, hur många familjer som har koden, och Stäng av, som frågar
  när en familj har den. Familjens panel: raden Familjerabatt under Översikt
  och rutan under Ekonomi, med vem och när, Byt till och Ta bort. Ta in
  familjen har valet bredvid gratistimmarna, när kontot skapas där. Passets
  panel säger timpriset med rabatten dragen, och Köpta timmar och familjens
  timbank säger att ett köp gjordes med rabatten.
- **Auditen** får när en kod skapas, stängs av eller får ett nytt belopp, och
  att en familj fick, bytte eller blev av med en rabatt och av vem
  (`har_rabatt`, en kolumn som räknas ur koden), aldrig vilken kod: koden kan
  säga vilken partner familjen kom genom, och auditen står kvar så länge
  verksamheten finns. Avidentifieras familjen tas koden bort
  (`profiles_familjerabatt_rensas`); raderas kontot går raden med.
- **Villkoren** nämner ingen rabatt och fick ingen ny version: ett lägre pris
  än prislistan ändrar dem inte. En rabatts villkor (beloppet, att den gäller
  tills vidare och att vi kan ta bort den) ska stå där vi ger den, i mejlet
  eller avtalet med partnern, som för en rabattkod.
- **Prov.** `rls-test.sql` avsnitt 35 (26 prov, `FR`); lokalt ur alla
  migrationer 1765 av 1765. `verktyg/prova-familjerabatter.js` (60 prov):
  fliken, panelen, Ta in familjen, passets panel, studievyn med och utan
  rabatt, och vyerna utan migrationen. `_delad/erbjudanden_test.ts`:
  kassaraden och regeln för köpet.
