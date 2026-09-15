# Google Business Profile — uppsättning för Nextrum

Den här listan är skriven för att träffa exakt de sökningar ni vill
synas på: *läxhjälp Stockholm*, *läxhjälp Södermalm*, *läxhjälp Farsta*,
*läxhjälp Nacka*, *mattehjälp Stockholm*, *privatlärare Stockholm*,
*läxhjälp gymnasiet Stockholm*.

**Profilen måste ni skapa själva.** Den kräver inloggning med ert eget
Google-konto och en verifiering som Google skickar till er — ingen annan
kan göra det åt er, och det ska vara så.

Börja på <https://business.google.com>.

---

## 1. Adressen: tjänsteområde, inte besöksadress

Vid frågan **"Vill du lägga till en plats som kunder kan besöka?"** →
svara **Nej**.

Det är rätt svar för Nextrum, inte en försiktighetsåtgärd:

- Studiehjälparna åker hem till eleven. Det finns ingen lokal att besöka.
- En pin på Maps vid en bostadsadress gör adressen sökbar för vem som
  helst, och företaget kan få besök.
- Google rankar inte tjänsteområdesföretag sämre för att adressen är
  dold. Det som räknas är att tjänsteområdet är ifyllt.

Google frågar ändå efter adressen **för verifieringen**. Den lagras men
visas inte publikt. Kontrollera efter verifieringen att det står
*"Serves customers at their locations"* och att ingen adress syns på
den publika profilen.

### Tjänsteområden att fylla i

Lägg in i den här ordningen. Google tillåter upp till 20.

```
Stockholm
Södermalm, Stockholm
Hammarby Sjöstad, Stockholm
Farsta, Stockholm
Enskede, Stockholm
Årsta, Stockholm
Hägersten, Stockholm
Liljeholmen, Stockholm
Vasastan, Stockholm
Östermalm, Stockholm
Kungsholmen, Stockholm
Bromma, Stockholm
Solna
Nacka
Sundbyberg
```

De sju första har egna landningssidor på sajten. Håll listorna i takt:
lägger ni till ett tjänsteområde här, lägg till området i
`verktyg/bygg-omradessidor.py` också, annars pekar Google på en sida som
inte finns.

---

## 2. Kategorier

**Primär kategori:** `Tutoring service` (svenska gränssnittet: *Läxhjälp*)

Den primära kategorin väger tyngst av allt i lokal ranking. Byt den inte
sedan för att prova något annat — ranking byggs upp över månader och
nollställs delvis vid ett kategoribyte.

**Sekundära kategorier**, i den här ordningen:

1. `Educational institution`
2. `Coaching center`

Lägg **inte** till barnvakt eller hushållsnära tjänster som kategori
förrän de faktiskt är påslagna i adminvyn och beskrivna på sajten. En
kategori ni inte levererar ger fel sökningar och dåliga recensioner.

---

## 3. Namn

Skriv exakt:

```
Nextrum
```

Skriv **inte** "Nextrum – Läxhjälp Stockholm". Nyckelord i företagsnamnet
bryter mot Googles riktlinjer, konkurrenter kan rapportera det, och
profilen kan stängas av. Orten och tjänsten hamnar rätt ändå via
kategorin och tjänsteområdet.

---

## 4. Beskrivning

750 tecken är taket. Den här ligger under och säger bara sådant som är
sant idag:

```
Nextrum matchar elever i Stockholm med unga studiehjälpare — gymnasie-
och högskolestudenter som själva nyligen läst samma kurser. Varje elev
får en personlig matchning, en individuell studieplan och en rapport
efter varje pass, så att både elev och förälder ser vad som hände och
vad som är nästa steg.

Passen sker hemma hos er eller online, en till tre timmar, inom tider
ni väljer själva. Ett timpris oavsett ämne, ingen bindningstid och
ingen månadsavgift. All betalning går genom Nextrum.

Vi arbetar i hela Stockholm, med Södermalm, Hammarby Sjöstad, Farsta,
Bromma, Solna och Nacka som våra vanligaste områden.
```

---

## 5. Tjänster

Lägg upp dem som egna poster. Varje post är en egen chans att matcha en
sökning, och de kostar ingenting.

| Tjänst | Pris |
|---|---|
| Läxhjälp | 379 kr/tim |
| Mattehjälp | 379 kr/tim |
| Läxhjälp gymnasiet | 379 kr/tim |
| Läxhjälp grundskolan | 379 kr/tim |
| Privatlärare | 379 kr/tim |
| Onlineläxhjälp | 379 kr/tim |
| Provplugg och nationella prov | 379 kr/tim |
| Engelska | 379 kr/tim |
| Svenska | 379 kr/tim |

**Priset står på fyra ställen som måste stämma överens:** här, på
prissidan, i FAQ:n och i användarvillkoren. Ändras det i adminvyn
(System → Tjänster & priser) måste alla fyra ändras samma dag.

---

## 6. Attribut

Kryssa i det som är sant:

- Identifierar sig som: *ungdomsägt* — om det stämmer
- Onlinebokning: **nej** (ni matchar först, man bokar inte direkt)
- Erbjuder onlinetjänster: **ja**
- Språk: svenska, engelska

Lämna resten tomt hellre än att gissa. Ett felaktigt attribut syns i
sökresultatet och är svårt att ta tillbaka.

---

## 7. Öppettider

Det här är **när ni svarar**, inte när pass hålls. Sätt tider ni
faktiskt läser mejlen, annars mäter Google er svarstid mot en öppettid
ni inte håller.

Förslag om ni inte vet: vardagar 09–20, lördag–söndag 10–18.

---

## 8. Bilder

Ladda upp minst fem. Ta dem från `bilder/` i repot — de är era egna och
föreställer det ni säljer.

| Plats | Fil |
|---|---|
| Logotyp | `favicon.svg` (exportera som 512×512 PNG först) |
| Omslag | `bilder/hero-nextrum-1280.jpg` |
| Övriga | `01-en-till-en`, `04-sjalvfortroende`, `08-teamet`, `10-forsta-motet` |

Ladda upp en ny bild ungefär en gång i månaden. Profiler som uppdateras
rankas bättre än profiler som står still, och det är billigare än det
låter — ni tar ändå bilder.

---

## 9. Länkar

| Fält | Adress |
|---|---|
| Webbplats | `https://nextrum.se/laxhjalp-stockholm` |
| Bokningslänk | `https://nextrum.se/intresseanmalan` |

**Webbplatsen ska peka på områdessidan, inte på startsidan.** Den sidan
handlar om exakt det någon just sökte efter, och Google mäter om
besökaren stannar.

---

## 10. Recensioner

Det här är den enda delen ingen kan skynda på, och den enda där ett
genvägsförsök kan stänga profilen.

**Fabricera aldrig recensioner.** Inte från er själva, inte från vänner
som inte varit kunder, inte i utbyte mot rabatt. Google upptäcker det
genom kontomönster, och påföljden är att hela profilen försvinner ur
sökresultaten. Det är också olagligt att vilseleda konsumenter på det
sättet.

**Så här får ni äkta recensioner i stället:**

1. Hämta er recensionslänk: Google Business Profile → *Be om
   recensioner* → kopiera den korta länken (`g.page/r/...`).
2. Skicka den **när rapporten just skrivits**. Det är enda ögonblicket
   då en förälder precis sett vad de fått. En vecka senare är känslan
   borta.
3. Fråga personligt, inte i ett massutskick. "Hjälpte passen? Det skulle
   betyda mycket om ni skrev två rader" fungerar. En automatisk
   påminnelse tre gånger gör det inte.
4. Svara på varje recension, också de dåliga, inom ett dygn. Svaren är
   publika och läses av nästa förälder — ofta mer än recensionen själv.

**Riktmärke:** fem äkta recensioner räcker för att synas i den lokala
kartrutan för *läxhjälp Stockholm*. Tio med svar från er gör större
skillnad än trettio utan.

När ni har länken: säg till, så bygger jag in knappen i studievyn så
att föräldern får frågan i samma stund som rapporten dyker upp.

---

## Efter verifieringen

- [ ] Sök på *läxhjälp Farsta* i inkognitoläge och se om profilen syns
- [ ] Kontrollera att ingen adress visas publikt
- [ ] Lägg till Nextrum i Apple Maps Connect och Bing Places — samma
      uppgifter, tar tjugo minuter, och de matas in i andra tjänster
- [ ] Lägg upp profilens adress som `sameAs` i `index.html`, i
      JSON-LD-blocket under `"@type": "Organization"`
