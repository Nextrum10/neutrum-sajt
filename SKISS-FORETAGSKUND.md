# Skiss: företagskund

*Fas 10, 21 september 2026. **Designskiss, ingen kod.** Planen säger
uttryckligen "designskisser, men ingen kod" — och det är rätt, för
bolaget har i dag 2 familjer, 1 elev, 1 uppdrag och 0 fakturor. En
modell som ritas nu blir läst som ett beslut av den som läser den om
ett år.*

Skissen svarar på tre frågor: vad som redan finns, vad som saknas, och
vilken fråga som måste besvaras först.

---

## Varför frågan ställs

Masterplanen kopplar företagskunden till tjänsten **försäljning**:
uppdrag åt andra bolag. Men databasen säger något annat än premissen.

```
kod          for_kund   for_jobb
forsaljning  false      true
```

`forsaljning` är alltså modellerad som **något man söker till**, inte
något någon beställer. Det finns ingen köpväg, inget pris, och ingen
plats där en kund väljer den.

**Den första frågan är därför inte "hur ser en företagskund ut" utan
"vad är försäljning".** Två svar, och de leder åt olika håll:

* **Ett jobb vi förmedlar.** Då behövs ingen företagskund alls för att
  lansera den. Den fungerar som läxhjälp fast på jobbsidan, och
  Fas 10:s checklista räcker hela vägen.
* **En tjänst företag köper.** Då krävs `for_kund = true`, ett pris,
  och allt nedan.

Det är ett affärsbeslut, inte ett tekniskt. Resten av skissen antar
det andra svaret, eftersom det är det som kostar något.

---

## Vad som redan finns

| Finns | Var | Kommentar |
|---|---|---|
| `tjanster.kundtyp` | `'privat'` / `'foretag'` / `'bada'`, NOT NULL, förval `privat` | **Skrivs men läses aldrig.** Inget formulär, ingen prisräkning, ingen fakturering och ingen matchning tittar på den. Kolumnen är en plats att skriva i, inte ett beteende. |
| `uppdrag` | `kund_id → profiles(id)`, `tjanst → tjanster(kod)`, `typ`, `status`, `beskrivning` | Bär redan relationen kund→tjänst. **Den pekar inte på `students`** — kopplingen går åt andra hållet, via `students.uppdrag_id`. |
| `bookings.uppdrag_id` | nullable | Ett pass kan alltså redan höra till ett uppdrag utan att gå via ett barn. |
| `invoices.parent_id` | → `profiles(id)` | Fakturan hänger på en profil, inte på en familj som begrepp. |

**Det här är bättre nyheter än det låter.** Modellen är inte byggd
runt barn — den är byggd runt `profiles` och `uppdrag`. Det som är
låst är inte strukturen utan **skapandevägen**: triggern
`students_uppdrag` → `elevens_uppdrag()` är det enda som föder ett
uppdrag i dag, och den föds ur ett barn.

En företagskund behöver alltså **en andra väg in i `uppdrag`** — inte
en ny datamodell.

---

## Vad som saknas

### 1. Uppgifter om kunden

`profiles` har i dag: `id, role, full_name, email, is_admin,
created_at, match_status, matched_tutor_id, avatar_url, bio, phone,
last_seen_at`.

Det finns **ingen adress någonstans i hela databasen**. För en
privatperson har det gått: fakturan går på mejl. För ett företag går
det inte.

Saknas:

* organisationsnummer
* fakturaadress — postadress eller e-fakturaadress (PEPPOL-id)
* referens eller beställare, som ska stå på fakturan
* flera kontaktpersoner, med var sin roll
* eventuellt inköpsordernummer per uppdrag

**Var de ska bo är en riktig fråga.** Tre vägar:

| Väg | Talar för | Talar emot |
|---|---|---|
| Kolumner på `profiles` | Enklast, ett ställe | Tolv kolumner som är null för varje familj, alltså för nästan alla rader |
| Egen tabell `foretagskund` med `profiles.id` som nyckel | Håller familjeraden ren, samma mönster som `kund_skatteuppgifter` redan har | En join till |
| På `uppdrag` | Följer med det som faktiskt köps | Fel ställe för orgnr, som hör till bolaget och inte till köpet |

Skissens rekommendation är den mittersta, av samma skäl som
`kund_skatteuppgifter` blev en egen tabell: uppgifter som bara gäller
vissa kunder, och som har sina egna behörighetsregler, blir en egen
rad.

> **Obs:** `foretagsfakta` i databasen är **Nextrums egna**
> bolagsuppgifter — orgnr, momsperiod, bolagsform. Inte kundens. Namnen
> ligger nära varandra och det är värt att välja ett som inte krockar.

### 2. En roll

`profiles.role` har i dag `parent` och `tutor`. En företagskund är
ingendera. Antingen en tredje roll, eller — troligen bättre — en
`kundtyp` på profilen som speglar den på tjänsten, så att `role`
fortsätter betyda "vilken vy loggar du in i".

### 3. En väg in i uppdrag

Se ovan. Konkret: admin skapar kunden, skapar uppdraget, och passen
hänger på uppdraget i stället för på ett barn.

### 4. Ett gränssnitt

Studievyn (`foralder.html`) heter så för att kunden är en familj. Ett
företag som loggar in för att se sina pass och fakturor behöver en
vy som inte pratar om barn, läxor och studieplaner. Det är den
dyraste posten i hela skissen, och den bör inte byggas innan någon
faktiskt frågat efter den.

---

## Vad som går sönder om man inte tänker efter

**Betalningsvillkoret.** `verktyg/kolla-betalningsvillkor.py` vaktar i
CI att det står **10 dagar** på alla ställen i repot. Företagskunder
begär ofta 30. Ett villkor per kund bryter alltså en invariant som
CI:s enda uppgift är att skydda, och som CLAUDE.md kallar skillnaden
mellan ett skrivfel och en tvist. Det är inte omöjligt — men det är en
egen leverans med ett eget beslut, inte en kolumn man lägger till i
förbifarten.

**RLS.** Flera policyer talar om "familj" och utgår från
`students.parent_id`. En företagskund utan barn faller utanför dem.
Varje policy som nämner `parent_id` behöver läsas om, och
`verktyg/rls-test.sql` behöver fixturer för en företagskund.

**Matchningen.** `matchningspoang()` väger ämne och årskurs. För ett
försäljningsuppdrag betyder ingetdera något. Antingen får
`tjanster.matchningsregler` äntligen betydelse, eller så matchas
företagsuppdrag för hand.

---

## Vad som INTE ska göras

* **Inte rita en modell med kolumnnamn och typer.** Den blir läst som
  ett beslut. Den här skissen säger vad som saknas och vad det kostar.
* **Inte bygga något innan `forsaljning` fått sitt svar.** Blir den ett
  jobb behövs ingenting av detta.
* **Inte lägga företagsuppgifter på `profiles` "så länge".** Det är
  vägen till tolv null-kolumner som ingen vågar ta bort.

---

## Nästa steg, i ordning

1. Leo svarar: är försäljning ett jobb vi förmedlar, eller en tjänst
   företag köper?
2. Om det senare: vilket betalningsvillkor gäller företag? Svaret
   avgör om CI-invarianten måste byggas om.
3. Först därefter är det meningsfullt att rita tabeller.

Se även [SKISS-RUT-EXPORT.md](SKISS-RUT-EXPORT.md), som har samma form
och samma regel: inga påhittade siffror.
