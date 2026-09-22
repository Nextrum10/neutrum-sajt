# Skiss: betalning via Stripe

*22 september 2026. **Designskiss, ingen kod.***

> Underlaget är en rekommendation från en säljare på Stripe. Den är
> kompetent, den är uppdaterad, och den beskriver en **marknadsplats**:
> kunden betalar med kort vid bokningen, plattformen tar en andel och
> resten går direkt till den som utför tjänsten.
>
> Nextrum är ingen marknadsplats. Nextrum sätter priset, matchar över
> telefon, äger studieplanen och fakturerar i efterskott en gång i
> månaden. Skillnaden är inte en detalj, den avgör vilket av Stripes
> flöden som är rätt, och den avgör om Connect överhuvudtaget behövs.
>
> Skissen skiljer på vad i rekommendationen som håller mot Nextrums
> modell och vad som inte gör det. Den innehåller **inga avgiftssiffror**
> och **ingen tidplan**: avgifterna hämtas från Stripes prissida den dag
> ett beslut tas, inte härifrån, och tidplanen hänger på ett svar som
> ingen i repot kan ge.

---

## Läget i driften, 22 september 2026

| Vad | Läge |
|---|---|
| Godkända studiehjälpare | **1** |
| Fakturor någonsin skapade | **0** |
| Underlag någonsin skapade | **0** |
| Pass / rapporter | 14 / 6, samtliga provpass mot adminkontot |
| Intresseanmälningar | 4 |
| `foretagsfakta.studiehjalpare_form` | **`oklart`** |
| `momsregistrerad` / `f_skatt` / `arbetsgivarregistrerad` | false / false / false |
| Redovisningskonsult | inte ifylld |
| Stripe-konto | finns inte. `DEPLOY-BETALNING.md` steg 7: "Inte påbörjat" |

Ingen har alltså betalat Nextrum någonting, och ingen studiehjälpare har
fått en utbetalning. Det är inte ett argument mot att tänka framåt. Det
är ett argument mot att bygga framåt, och repot har kvitton på varför:

* Knappen **Koppla utbetalningskonto** i studiehjälparvyn byggdes före
  edge-funktionen `stripe-konto`. Den kunde bara misslyckas och fick
  plockas bort igen. Kommentaren står kvar i `nextrum-larare-vy.js:2206`.
* `pass-notis` och `meddelande-notis` ligger ACTIVE i driften utan en
  enda anropare (CLAUDE.md avsnitt 7).
* Hela RUT-maskineriet är byggt, testat och har aldrig kört skarpt.
  `spara_skatteuppgifter()` anropas av ingenting (`SKISS-RUT-EXPORT.md`).

---

## Frågan som avgör allt

**Är studiehjälparna anställda eller uppdragstagare?**

Adminvyn kallar det själv "den viktigaste uppgiften på sidan", och
ekonomiagenten vägrar svara på personalfrågor så länge fältet står på
`oklart`. Den vägran är rätt, och den gäller den här skissen också.

* **Anställda.** Då går ersättningen via löneköring med skatteavdrag,
  arbetsgivaravgifter och AGI till Skatteverket varje månad. Stripe
  Connect är inte ett sämre alternativ till det, det är fel verktyg: en
  Connect-transfer är inte en löneutbetalning. **Hela hjälparsidan av
  rekommendationen faller då bort i sin helhet.**
* **Uppdragstagare med F-skatt.** Då betalas ersättningen mot faktura
  eller självfaktura. Connect blir möjligt, men fortfarande inte
  nödvändigt.

Signalerna i systemet pekar mot det första: Nextrum sätter priset,
matchar, styr studieplanen och sätter hjälparens timpenning. Att
hjälparen inte får sätta den själv är dessutom skyddat av en trigger
(`arkiv/schema-v8.sql:38`), eftersom en oskyddad `hourly_rate` var ett
hål när pengar började röra sig.

Det är en fråga för en redovisningskonsult, inte för den här filen. Men
notera följden: **att lägga på marknadsplatsarkitektur är i sig ett
påstående om relationen**, inskrivet i själva pengaflödet, i en fråga
som inte är utredd.

**I båda grenarna är kundsidan oförändrad.** Det är därför kundsidan går
att bygga först, och hjälparsidan inte gör det.

---

## Två sidor, olika mognad

| Sida | Beroende av anställningsfrågan | Läge |
|---|---|---|
| Kunden betalar fakturan | Nej | Kroken finns i koden, går att bygga |
| Hjälparen får sin ersättning | **Ja, helt** | Vilar tills frågan är besvarad |

---

## Kundsidan: Stripe Invoicing, inte Checkout

Rekommendationen säger Checkout plus destination charges. Det förutsätter
att kunden betalar vid bokningstillfället. Nextrums modell gör inte det,
och det är ett medvetet val: ett pass är genomfört först när rapporten
finns, och fakturan samlar en hel månads genomförda pass per familj.

Tre saker följer av det:

1. **Det finns ingen betalning att göra vid bokningen.** Checkout har
   inget tillfälle att köras på.
2. **En faktura kan ha flera mottagare.** Två barn med olika hjälpare,
   eller ett hjälparbyte mitt i månaden, ger en faktura vars rader hör
   till olika personer. Destination charges knyter en betalning till
   **ett** mottagarkonto och klarar inte det. Rekommendationen listar
   själv det fallet under "när ni i stället ska använda separate charges
   and transfers", men leder ändå med destination charges.
3. **`application_fee_amount` beskriver inte Nextrums ekonomi.** Den
   modellen säger: hjälparens pris är totalen, plattformen tar en andel.
   Hos Nextrum är 379 kr **Nextrums** pris, och ersättningen ett eget tal
   (`tutor_profiles.hourly_rate`, eller `tjanster.ersattning_per_timme_ore`).
   `_delad/pris.ts` är uttryckligen byggd så att ersättningen aldrig
   påverkas av familjens rabatt, av RUT eller av syskontillägget. Det
   finns alltså ingen fast relation mellan de två beloppen att uttrycka
   som en avgift, och att räkna fram ersättningen ur fakturan vore raka
   motsatsen till hur koden fungerar i dag.

### Vad som redan finns

| Finns | Var |
|---|---|
| `invoices.stripe_invoice_id`, `invoices.stripe_url` | `arkiv/schema-v8.sql:101` |
| Betala-knappen i föräldravyn, pekar redan på `stripe_url` | `nextrum-studie-vy.js:1234` |
| Den utmärkta platsen i koden | `supabase/functions/fakturering/index.ts:338` |
| Rätt ordning vid utskick: mejlet först, statusen sedan | `faktura-utskick` |

### Vad som ska byggas, i ordning

1. En Stripe-kund per familj, skapad första gången en faktura skickas.
2. En Stripe Invoice per rad i `invoices`, med samma rader som
   `invoice_lines`. Spara `stripe_invoice_id` och `hosted_invoice_url` i
   `stripe_url`. Knappen behöver ingen ändring.
3. En webhook som lyssnar på `invoice.paid` och sätter `status = 'betald'`
   och `betald_at`.
4. Statement descriptor och kvitto som bär periodens beteckning, så att
   familjen känner igen köpet på kontoutdraget.
5. Kreditering: se avsnittet om villkoren nedan.

### Reglerna som gäller oavsett

Det här är säljarens bästa punkter, och de gäller Invoicing precis lika
mycket som Checkout:

* **Markera aldrig betald på en redirect.** Bara en verifierad webhook
  får ändra status. Detsamma som `faktura-utskick` redan gör åt andra
  hållet: mejlet först, statusen sedan.
* **Verifiera signaturen.** En webhook utan signaturkontroll är en adress
  där vem som helst kan påstå att en faktura är betald.
* **Gör hanteringen idempotent.** Samma händelse kan komma flera gånger.
* **Den hemliga nyckeln bor som secret i Supabase**, aldrig i
  `nextrum-config.js` och aldrig i något webbläsaren hämtar.
* **Anroparens egen token prövas före `service_role`** (CLAUDE.md
  avsnitt 6). Kontrollen efter `service_role` är ingen kontroll.
* **Ören, alltid.** Stripe räknar också i minsta enhet, så omvandlingen
  ska inte finnas alls på den här vägen.

---

## Hjälparsidan: ingenting, än

Connect löser problemet "jag ska betala ut till många motparter
automatiskt, med identitetskontroll och bankuppgifter hanterade av någon
annan". Med en godkänd studiehjälpare och noll underlag är det inte ett
problem Nextrum har. En banköverföring i månaden är gratis och rätt, och
det är precis vad `DEPLOY-BETALNING.md` steg 6b beskriver.

Blir det ändå aktuellt är tre saker värda att veta i förväg:

**1. `stripe_klar` har fel form.** Kolumnen är en enda boolean
(`arkiv/schema-v8.sql:51`). Säljarens lista är riktigare: konto-id,
onboardingstatus, kan ta emot överföringar, bankutbetalningar aktiverade,
datum för senaste statuskontroll. Fem tillstånd som kan glida isär, inte
ett. Och hans viktigaste påpekande hör hit: **att användaren kommer
tillbaka till `return_url` betyder inte att onboardingen är klar**, och
kraven kan ändras i efterhand. En boolean satt vid återkomsten ljuger
förr eller senare.

**2. Minderåriga är inte en fotnot.** Stripes svenska avtal tillåter en
person som fyllt 13 att använda tjänsten med en vuxen representant. Det
svarar på frågan *tillåter Stripe det*, inte på frågan *är det korrekt*.
Att registrera en gymnasieelev som enskild näringsidkare är att påstå att
hen driver näringsverksamhet, vilket för en omyndig kräver
överförmyndarens samtycke. Och är svaret på anställningsfrågan
"anställda" är registreringen dessutom en felklassificering.

**3. Återinför inte knappen före funktionen.** Den togs bort en gång av
just det skälet, och texten som står där i stället säger sanningen:
utbetalningarna sköts för hand så länge.

---

## Vad i rekommendationen som inte stämmer mot Nextrum

| Säljarens antagande | Verkligheten i koden | Följd |
|---|---|---|
| Pengarna kan föras till hjälparens saldo när betalningen genomförs | Fakturering i efterskott. Rapporten gör passet genomfört | Destination charges faller. Hans egen slutfråga besvarar sig själv |
| En bokning gäller normalt en studiehjälpare | Sant per pass, men fakturan är per familj och månad | En faktura kan ha flera mottagare |
| Plattformen tar en andel av hjälparens pris | 379 kr är Nextrums pris, ersättningen är ett eget tal | `application_fee_amount` beskriver inte er ekonomi |

Det han har rätt i, oavsett gren: Accounts v2 framför de gamla
paketerade kontotyperna, hostad onboarding i stället för egna formulär
för personnummer, aldrig lita på `return_url`, verifierade och idempotenta
webhooks, spara kopplingen mellan fakturarad och Stripe-objekt, och att
juridik och skatt måste tas separat.

---

## Beslut som blockerar, och vem som svarar

| # | Beslut | Vem svarar | Blockerar |
|---|---|---|---|
| 1 | Anställda eller uppdragstagare, även under 18 | Redovisningskonsult | Hela hjälparsidan. Första utbetalningen |
| 2 | Moms på läxhjälp | Redovisningskonsult | Om 379 kr är med eller utan moms, och därmed fjorton ställen plus CI-kontrollen |
| 3 | Äger Nextrum kundrelationen för betalningen? | Ni, skriftligt | Vem kunden vänder sig till vid kreditering och tvist |
| 4 | Återbetalningspolicy | Ni | Två luckor i villkoren, se nedan |
| 5 | Omfattas Nextrum av DAC7? | Redovisningskonsult | Se nedan |

**Beslut 3** är i praktiken redan taget: systemet är byggt så att Nextrum
fakturerar, Nextrum skickar, Nextrum krediterar. Det saknas bara som en
skriven mening. Den meningen är vad som gör resten koherent.

**Beslut 5 talar emot rekommendationen.** DAC7 gäller
plattformsoperatörer. Att gå över till marknadsplatsarkitektur är ett
argument för att Nextrum **är** en sådan. Behålls byråmodellen, där
Nextrum är säljaren och hjälparen är personal eller underleverantör, är
frågan möjligen inte aktuell alls. Den hör hemma i samma möte som beslut
1 och 2, eftersom det mötet ändå ska bokas.

---

## Luckorna i villkoren

`anvandarvillkor.html` svarar redan på elevfrånvaro: uteblir eleven utan
att avboka räknas passet som genomfört och faktureras. Det är inte bara
text, det är kod: `narvaro` är obligatorisk på rapporten, och rapporten
gör passet genomfört i samma transaktion (Fas 2.3).

Två fall som säljaren räknar upp saknar svar:

* **Studiehjälparen uteblir.**
* **Halvt genomfört pass.**

Båda är två meningar i villkoren och noll kod, och båda är lättare att
skriva nu än mitt i en betalningspåminnelse. Ändras villkoren måste
`/en/`-sidan följa med för hand, annars säger `jamfor-sprak.py` ifrån.

**Och en skillnad mot säljarens text:** eftersom ingen betalar i förskott
är en "återbetalning" hos Nextrum i regel en **kreditering** av en
faktura, inte en Stripe-refund. Först när fakturor faktiskt betalas med
kort blir refunden verklig. `reverse_transfer` blir aldrig aktuellt, för
det finns ingen transfer att backa.

---

## Vad som INTE ska göras

* **Inte bygga Connect** innan anställningsfrågan är besvarad.
* **Inte skriva in Stripes avgifter** i den här filen eller i kod. Samma
  regel som `rut_tak.kalla`: en siffra utan källa blir sanning så fort
  någon läser den, och avgifter ändras.
* **Inte låta `return_url` betyda klar.**
* **Inte lägga den hemliga nyckeln** i `nextrum-config.js`, i HTML eller
  i något webbläsaren hämtar.
* **Inte driftsätta en betalfunktion som aldrig kört i testläge.** Två
  system kan glida isär utan att något blir rött (CLAUDE.md avsnitt 7),
  och pengar är sämsta tänkbara ställe att upptäcka det på.

---

## Nästa steg, i ordning

1. **Boka redovisningskonsulten.** Tre frågor i ett möte: anställningsform
   (även under 18), moms, DAC7. Fyll i `foretagsfakta` efteråt.
2. **Skriv de två saknade meningarna i villkoren**, på båda språken.
3. **Skapa Stripe-kontot och arbeta i testläge.** Ingenting av det nedan
   rör riktiga pengar förrän ni byter nyckel.
4. **Bygg kundsidan** mot testläget: kund, faktura, webhook, kvitto.
5. **Hjälparsidan** först efter svaret i punkt 1, och först när det finns
   fler än en studiehjälpare att betala.

Se även [DEPLOY-BETALNING.md](DEPLOY-BETALNING.md) steg 7,
[SKISS-RUT-EXPORT.md](SKISS-RUT-EXPORT.md) och
[SKISS-FORETAGSKUND.md](SKISS-FORETAGSKUND.md), som har samma form och
samma regel: inga påhittade siffror.
