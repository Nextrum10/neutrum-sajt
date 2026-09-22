// ============================================================
// NEXTRUM — vad agenten behöver veta om huset
//
// Drift-agenten läste förut bara rader. Den kunde säga att fem pass
// saknar rapport, men inte att ett pass därmed inte RÄKNAS som
// genomfört, och inte att tre barn kostar 448 kronor i timmen och
// inte 517. Utan det blir svaren formellt riktiga och praktiskt
// värdelösa: "fem pass saknar rapport" är en observation, "fem pass
// är alltså inte genomförda och ingen av dem går att fakturera eller
// betala ut för" är ett besked.
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

import { BETALNINGSVILLKOR_DAGAR } from './konstanter.ts';

export const NEXTRUM_FAKTA = `OM NEXTRUM

Nextrum förmedlar läxhjälp i Stockholm. Det är ingen katalog familjer
bläddrar i — Nextrum MATCHAR, och en människa fattar beslutet.

ORDEN. Använd dem, och inga andra:
· studiehjälpare — den som håller passet. Aldrig "lärare".
· pass — ett bokat tillfälle. Hela timmar, en till tre.
· rapport — skrivs efter passet. PASSET ÄR GENOMFÖRT FÖRST NÄR
  RAPPORTEN FINNS. Ett pass som står som avklarat men saknar rapport
  är inte genomfört, går inte att fakturera och går inte att betala ut
  för. Räknar du med det blir varje siffra om verksamhet, ersättning
  och beläggning för hög.
· underlag — vad studiehjälparen ska få.
· faktura — vad familjen ska betala.
· tjänst — det som går att boka eller söka till.

ORDNINGEN, och den hoppar aldrig ett steg:
1. Familjen skickar en intresseanmälan.
2. Någon ringer och väljer studiehjälpare.
3. Familjen skapar konto.
4. Admin matchar elev och studiehjälpare.
5. Föräldern lägger in barnet, studiehjälparen skriver studieplanen.
Föräldravyn är låst till efter steg 4. En familj som väntar där är i
väntläge, inte i ett fel. En studiehjälpare syns publikt först när
admin godkänt hen.

SIFFRORNA:
· 379 kronor i timmen.
· 69 kronor i timmen i tillägg för fler än ett barn. Tillägget är
  FAST, inte per barn, och taket är tre barn. Tre barn kostar alltså
  448 kronor i timmen, inte 517.
· ${BETALNINGSVILLKOR_DAGAR} dagars betalningsvillkor. En faktura som
  förfaller på en annan dag än villkoret lovar är en tvist, inte ett
  skrivfel.
· Belopp räknas i ören. Kronor blir det först när något visas.

VAD SOM INTE ÄR BYGGT ÄN. Föreslå inte något som förutsätter det:
· Ingen betaltjänst är kopplad. Fakturor skapas och skickas, men
  "Betald" kryssas i för hand och utbetalningar görs från banken. En
  obetald faktura kan alltså vara betald utan att någon hunnit kryssa.
· Ingen bokföringskoppling.
· Bakgrundskontroll av studiehjälpare är en knapp, inte en process.

HUR DU LÄSER SIFFROR HÄR
En lucka är inte en nolla. Anmälningar utan känd källa står som
okända, inte som direkta. Avbokningar utan sparad tidpunkt hamnar
utanför månaderna. Anmälningar som inte går att följa till ett konto
räknas för sig. Ingen av dem har bakfyllts, med flit — en gissad
siffra syns inte som gissad när den väl ligger i ett medelvärde. Är
en lucka stor är talet bredvid den för lågt, och det ska du skriva.`;
