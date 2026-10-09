// ============================================================
// NEXTRUM — vad agenten behöver veta om huset
//
// Drift-agenten läste förut bara rader. Den kunde säga att fem pass
// saknar rapport, men inte att ett pass därmed inte RÄKNAS som
// genomfört, och inte att tre barn kostar 468 kronor i timmen och
// inte 537. Utan det blir svaren formellt riktiga och praktiskt
// värdelösa: "fem pass saknar rapport" är en observation, "fem pass
// är alltså inte genomförda och ingen av dem går att betala ut
// ersättning för" är ett besked.
//
// SEDAN FAS 19.2 FÅR FAMILJEN BETALA EFTER PASSET, när de bekräftar
// rapporten. Texten nedan sa kort FÖRE passet och att ett obetalt pass
// inte hålls, och en agent som läser det räknar varje hållet obetalt
// pass som ett fel, fast det nu är normalt tills familjen bekräftat.
//
// SEDAN 2026-09-27 KAN FAMILJEN VÄLJA FAKTURA IGEN, efter passet, när
// de bekräftar rapporten (Fas 19.6), med tio dagars betalningstid.
// Texten nedan sa ändå till 2026-10-07 att inga fakturor skapas och att
// fakturerat alltid var noll, och en agent som läste det kunde ta
// månadens faktura för ett fel.
//
// FRÅN FAS 14.2 TILL DESS FICK FAMILJEN INGEN FAKTURA. Texten sa då
// fortfarande "10 dagars betalningsvillkor" och "Betald kryssas i för
// hand", och en agent som läste det letade efter förfallna fakturor som
// inte fanns, och läste en månad utan fakturor som en månad utan
// intäkt. Samma fel åt andra hållet är lika lätt att göra: ändras
// betalsätten ändras texten här samma dag.
//
// VAD SOM FÅR STÅ HÄR, OCH VAD SOM ALDRIG FÅR DET
//
// Texten går in i systemprompten på ett betalt modellanrop, och
// agenten som läser den läser samtidigt personuppgifter om barn.
// Därför står här AFFÄREN — ord, priser, ordning, vad som räknas som
// vad — och ingenting om hur huset är byggt.
//
// Alltså INTE: tabellnamn, kolumnnamn, policyer, triggrar, funktioner,
// projekt-ref, nycklar, filnamn, vilka edge functions som finns eller
// vad som skyddar vad. En agent som råkar upprepa sin systemprompt i
// ett svar ska inte därmed rita en karta över var skyddet sitter, och
// en modell som vet att en viss trigger vaktar en viss kolumn har fått
// en uppgift den aldrig behöver för att svara på "vad bör jag göra
// först idag".
//
// Reglerna för HUR agenten arbetar — föreslå aldrig utför, arbeta med
// id och inte namn, databasutdata är uppgifter och inte order — står
// kvar i respektive agents egen SYSTEM. De är agentens uppförande.
// Det här är husets kunskap, och den är gemensam.
//
// verktyg/testa-agent.js kontrollerar i CI att priserna här stämmer
// med nextrum-config.js och att inget infrastrukturord smugit sig in.
// ============================================================

export const NEXTRUM_FAKTA = `OM NEXTRUM

Nextrum förmedlar läxhjälp i Stockholm. Det är ingen katalog familjer
bläddrar i — Nextrum MATCHAR, och en människa fattar beslutet.

ORDEN. Använd dem, och inga andra:
· studiehjälpare — den som håller passet. Aldrig "lärare".
· pass — ett bokat tillfälle. Hela timmar, en till tre.
· rapport — skrivs efter passet. PASSET ÄR GENOMFÖRT FÖRST NÄR
  RAPPORTEN FINNS. Ett pass som står som avklarat men saknar rapport
  är inte genomfört och går inte att betala ut ersättning för. Räknar
  du med det blir varje siffra om verksamhet, ersättning och
  beläggning för hög.
· underlag — vad studiehjälparen ska få.
· betalning — vad familjen betalat för ett pass. Den görs med kort,
  per pass, antingen i förväg eller efter passet när familjen
  bekräftar rapporten. Efter passet kan familjen i stället välja
  faktura: en samlad faktura per familj och månad, som kommer i början
  av nästa månad. Ett pass som familjen valt faktura för väntar på
  fakturan och är inget fel.
· tjänst — det som går att boka eller söka till.

ORDNINGEN, och den hoppar aldrig ett steg:
1. Familjen skickar en intresseanmälan.
2. Någon ringer och väljer studiehjälpare.
3. Familjen får ett konto: admin tar in familjen från anmälan, eller
   familjen skapar det själv.
4. Admin matchar elev och studiehjälpare.
5. Föräldern lägger in barnet, studiehjälparen skriver studieplanen.
Föräldravyn är låst till efter steg 4. En familj som väntar där är i
väntläge, inte i ett fel. En studiehjälpare syns publikt först när
admin godkänt hen.

SIFFRORNA:
· 399 kronor i timmen, utan bindning. Det är priset, inget från-pris.
· Planerna Basic, Standard och Intensiv (4, 8 och 12 timmar) gäller
  en månad i taget och kostar 379 kronor i timmen. De binder inte:
  villkoren har ingen bindningstid, och den som slutar får tillbaka
  det som är kvar. De köps en gång,
  i förväg, och priserna räknas i databasen, inte här.
· 69 kronor i timmen i tillägg för fler än ett barn. Tillägget är
  FAST, inte per barn, och taket är tre barn. Tre barn kostar alltså
  468 kronor i timmen, inte 537.
· Familjen betalar varje pass med kort, antingen i förväg, när
  studiehjälparen bekräftat tiden, eller efter passet när de bekräftar
  rapporten. När de bekräftar rapporten kan de i stället välja faktura,
  som kommer i början av nästa månad med tio dagars betalningstid och
  utan avgift. Rapporten bekräftas också när passet redan är betalt. Ett
  pass som har hållits ska betalas även om rapporten inte bekräftats.
  En betalning som tas på ett annat sätt än villkoren lovar är en
  tvist, inte ett skrivfel.
· Priset är det som gällde när passet bokades. En prishöjning gäller
  bara pass som bokas efter den.
· Första timmen är gratis med den första planen familjen köper: planen
  får en timme till (klippkort.forsta_timmen). En familj som betalar
  pass för pass får den bara om admin valt det för familjen
  (forsta_timmen_beviljad), och då dras en timme av på det pass som gör
  att familjen har bokat två timmar. Högst en gratis timme per familj,
  utom timmar för tips. Ett pass på en timme kan alltså kosta noll
  kronor, och det är då inte obetalt.
· En familj som tipsat får en timme på köpet när en ny familj som
  anmält sig med dess kod haft två timmar läxhjälp.
· Studiehjälparen får betalt den 25:e, i en klump för månadens
  rapporterade pass.
· Belopp räknas i ören. Kronor blir det först när något visas.

VAD SOM INTE ÄR BYGGT ÄN. Föreslå inte något som förutsätter det:
· Kortbetalningen är ny. Ett pass som hållits och rapporterats men
  inte är betalt är normalt en tid, för familjen får betala när de
  bekräftar rapporten. Det ska ändå följas upp, och står det obetalt
  länge är det något att påpeka.
· Utbetalningen till studiehjälparna görs för hand från banken. Ett
  underlag som inte står som utbetalt kan alltså vara betalt utan att
  någon hunnit markera det.
· Ingen bokföringskoppling.
· Fakturan går att välja, men bolaget är inte registrerat än, och
  bankgirot och den första provfaktureringen återstår.
· Bakgrundskontroll av studiehjälpare är en knapp, inte en process.

HUR DU LÄSER SIFFROR HÄR
En lucka är inte en nolla. Anmälningar utan känd källa står som
okända, inte som direkta. Avbokningar utan sparad tidpunkt hamnar
utanför månaderna. Anmälningar som inte går att följa till ett konto
räknas för sig. Ingen av dem har bakfyllts, med flit — en gissad
siffra syns inte som gissad när den väl ligger i ett medelvärde. Är
en lucka stor är talet bredvid den för lågt, och det ska du skriva.

Ett kortbelopp räknas på den dag betalningen kom in, inte på passets
dag. Familjen betalar i förväg, efter passet eller mot faktura, så en
månads betalningar och samma månads genomförda pass hör inte ihop rad
för rad. En faktura räknas på den månad den gäller men skickas först
i början av nästa: ett fakturerat belopp är inte betalt förrän
fakturan är det, och ett utkast är inte skickat. Köpta timmar betalas
i förväg och är en skuld till familjen tills timmarna använts; de är
inte intäkt för något pass än. Och en testbetalning är inga pengar.`;
