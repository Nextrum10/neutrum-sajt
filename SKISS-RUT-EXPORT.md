# Skiss: RUT-export till Skatteverket

*Fas 10, 21 september 2026. **Designskiss, ingen kod.***

> **Jag vet inte hur Skatteverkets begäran ska se ut.** Det går inte
> att läsa ur repot, och jag har inte hämtat det från Skatteverket.
> Den här skissen innehåller därför **inget filformat, inget tak och
> ingen procentsats**. CLAUDE.md säger att skattesiffror matas in och
> aldrig hårdkodas, och migrationen som skapade `rut_tak` säger samma
> sak i sitt eget filhuvud. En skiss som gissar blir sanning så fort
> någon läser den.
>
> Det skissen innehåller är två listor — vad vi har och vad vi saknar —
> plus den enda frågan som avgör allt.

---

## Frågan som avgör allt

**Begär Nextrum avdraget åt kunden, eller gör kunden det själv?**

* **Nextrum begär.** Då måste vi dra av på fakturan, ligga ute med
  pengarna, och skicka en begäran till Skatteverket för att få dem.
  Det är den vanliga modellen i branschen, och det är den som kräver
  en export.
* **Kunden begär.** Då fakturerar vi fullt belopp och lämnar ett
  underlag som kunden själv använder i sin deklaration. Ingen export
  behövs — men då är `invoices.rut_ore` och hela avdraget på fakturan
  fel byggt, för fakturan ska inte dras av.

Faktureringen är i dag byggd för **det första**: `pris.ts` drar RUT
från fakturabeloppet. Det är alltså redan ett svar, taget någon gång
— men aldrig uttalat. Det bör bekräftas innan något byggs vidare.

---

## Läget i driften, 21 september 2026

| Vad | Antal |
|---|---|
| Rader i `rut_tak` | **0** |
| Rader i `kund_skatteuppgifter` | **0** |
| Fakturor | **0** |
| Tjänster med `rut_berattigad = true` | **0** |

Det betyder att **inget av RUT-maskineriet någonsin har kört skarpt**.
Det som finns är byggt och aldrig prövat mot verkligheten.

Läxhjälp är inte RUT-berättigad — avdraget för läxhjälp togs bort
2015. Av de tre olanserade är **hushållsnära** den som rimligen skulle
kunna vara det. Barnvakt och försäljning står som `rut_berattigad =
false` i dag, och den här skissen tar inte ställning till om det är
rätt.

---

## Vad vi HAR

### Per köpare — `kund_skatteuppgifter`

| Kolumn | Typ | Kommentar |
|---|---|---|
| `kund_id` | uuid | → `profiles(id)` |
| `personnummer` | **bytea** | Krypterat med pgcrypto. Nyckeln `rut_personnummer` ligger i Vault. |
| `fastighetsbeteckning` | text | För villa |
| `brf_orgnr` | text | För bostadsrätt |
| `lagenhetsnummer` | text | För bostadsrätt |
| `uppdaterad`, `uppdaterad_av` | | |

Tabellen har **ingen RLS-policy alls**. Åtkomst går bara genom
`spara_/las_/radera_skatteuppgifter()`, som kräver admin. Det är
samma mönster som `student_notes`, och det är rätt.

### Per år — `rut_tak`

`ar`, `tak_ore`, **`kalla`** (NOT NULL), `uppdaterad`.

Att `kalla` är obligatorisk är designens bästa detalj: taket går inte
att lägga in utan att skriva var siffran kommer ifrån.

### Per faktura och rad

`invoices.rut_ore`, `invoices.rut_ar`, `invoice_lines.rut_ore`,
`tjanster.rut_berattigad`, `tjanster.rut_procent`, samt vyn
`rut_underlag` och CHECK-villkoret som kräver att `rut_berattigad`
och `rut_procent > 0` följs åt.

---

## Vad vi SAKNAR

### 1. En väg att mata in ett personnummer

**Det här är skissens hårdaste fynd.** Funktionerna
`spara_skatteuppgifter()`, `las_skatteuppgifter()` och
`radera_skatteuppgifter()` finns, är testade i `rls-test.sql` — och
**anropas av ingenting**. Det finns ingen ruta någonstans i
adminvyn.

Följden: även med ett tak inlagt och en RUT-berättigad tjänst
aktiverad blir avdraget **alltid noll**, eftersom listan över kunder
med skatteuppgifter alltid är tom. Faktureringen flaggar det redan
(`avvikelser_rader()` har en gren `rut_utan_skatteuppgifter`), men den
hindrar ingenting.

Det naturliga stället är kunddetaljvyn. Men det är ett gränssnitt mot
ett **krypterat personnummer**, alltså inget man bygger i förbifarten:
det ska visas maskerat, loggas i auditloggen som att-det-hände och
aldrig som värde, och det ska gå att radera.

### 2. Uppgifter om det utförda arbetet

En RUT-begäran handlar om arbete, inte om fakturor. Vi har datum,
minuter, belopp och tjänst per pass. Vi har **inte**:

* var arbetet utfördes — `bookings.location` är fritext och används
  i dag som hemadress, inte som en strukturerad adress
* en uppdelning i arbetskostnad och material, om det någonsin blir
  aktuellt
* utföraren som person gentemot Skatteverket

### 3. Själva formatet

Okänt. Måste hämtas från Skatteverket. Innan dess går det inte att
säga om något av ovanstående ens är rätt uppgifter.

---

## Vad som INTE ska göras

* **Inte gissa ett filformat.** Vare sig CSV, XML eller något annat.
* **Inte lägga in ett tak eller en procentsats i kod eller migration.**
  `rut_tak.kalla` finns för att tvinga fram var siffran kommer ifrån.
* **Inte bygga exporten före inmatningen.** En export av en tom tabell
  är en fil med noll rader, och den bevisar ingenting.

---

## Nästa steg, i ordning

1. Bekräfta: begär Nextrum avdraget åt kunden? (Faktureringen antar ja.)
2. Om ja — hämta Skatteverkets krav på begäran, och skriv ner vilka
   uppgifter den vill ha.
3. Jämför mot listan ovan. Först då vet vi vad som saknas på riktigt.
4. Bygg inmatningen av skatteuppgifter innan exporten.
5. Lägg in årets tak, med källa.

Se även [SKISS-FORETAGSKUND.md](SKISS-FORETAGSKUND.md).
