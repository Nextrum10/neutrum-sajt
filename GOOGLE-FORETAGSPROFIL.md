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

**Sekundära kategorier: inga till att börja med.** Googles egen regel
är så få kategorier som möjligt, och bara sådana som beskriver det ni
gör. Listan föreslog förut `Educational institution` och `Coaching
center`. Den första betyder en skola, och Nextrum är ingen, och ingen av
dem beskriver läxhjälp bättre än den primära. En kategori som inte
stämmer ger fel sökningar och kan rapporteras av en konkurrent.

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

750 tecken är taket. Den här är 690 och säger bara sådant som är sant
i dag (2026-10-07). Erbjudandet och priset står inte här: Googles
riktlinjer vill inte ha erbjudanden i beskrivningen, och de har egna
platser (Tjänster och Inlägg nedan).

```
Nextrum förmedlar läxhjälp i Stockholm. Vi matchar varje elev med en studiehjälpare som nyligen läst samma kurser, och det är en människa på Nextrum som väljer.

Passen hålls hemma hos er, på ett bibliotek eller online, en till tre timmar åt gången, på tider ni väljer. Studiehjälparen gör en studieplan och skriver en rapport efter varje pass, så att både elev och förälder ser vad som hände och vad som är nästa steg.

Bland annat matte, svenska, engelska och NO, från lågstadiet till gymnasiet. Ett timpris oavsett ämne, ingen bindningstid och ingen månadsavgift.

Vi tar emot familjer i hela Stockholm, bland annat på Södermalm, i Hammarby Sjöstad, Farsta, Bromma, Solna och Nacka.
```

Den förra versionen kallade sex stadsdelar "våra vanligaste områden".
Det är ett påstående om var familjerna bor, och familjerna är för få
för att säga något om det (samma regel som för sidorna).

---

## 5. Tjänster

Lägg upp dem som egna poster. Varje post är en egen chans att matcha en
sökning, och de kostar ingenting.

| Tjänst | Pris |
|---|---|
| Läxhjälp | 379 kr/tim |
| Mattehjälp | 379 kr/tim |
| Läxhjälp gymnasiet | 379 kr/tim |
| Läxhjälp högstadiet | 379 kr/tim |
| Läxhjälp mellanstadiet | 379 kr/tim |
| Läxhjälp lågstadiet | 379 kr/tim |
| Onlineläxhjälp | 379 kr/tim |
| Provplugg och nationella prov | 379 kr/tim |
| Engelska | 379 kr/tim |
| Svenska | 379 kr/tim |
| NO | 379 kr/tim |

**Privatlärare står inte med längre.** Ordlistan säger aldrig "lärare"
utåt, och en tjänst som heter Privatlärare lovar något en studiehjälpare
inte är. Sökordet är stort, men att ta det är ert beslut (`TRAFIK.md`,
avsnitt 10), och guiden `/laxhjalp-eller-privatlarare` tar redan
sökningen ärligt.

**Erbjudandet** (första timmen på köpet för nya familjer) läggs som ett
inlägg av typen Erbjudande, inte i en tjänst: se Inlägg nedan.

**Priset står på fyra ställen som måste stämma överens:** här, på
prissidan, i FAQ:n och i användarvillkoren. Ändras det i adminvyn
(System → Tjänster & priser) måste alla fyra ändras samma dag.

---

## 6. Attribut

Kryssa i det som är sant:

- Onlinebokning: **nej** (ni matchar först, man bokar inte direkt)
- Erbjuder onlinetjänster: **ja**
- Språk: svenska, engelska

Lämna resten tomt hellre än att gissa. Ett felaktigt attribut syns i
sökresultatet och är svårt att ta tillbaka.

Listan föreslog förut *ungdomsägt*. Det attributet finns inte: Googles
identitetsattribut gäller bland annat kvinnoägt och veteranägt, och
inget av dem handlar om ålder.

---

## 7. Öppettider

Det här är **när ni svarar**, inte när pass hålls. Sätt tider ni
faktiskt läser mejlen, annars mäter Google er svarstid mot en öppettid
ni inte håller.

Förslag om ni inte vet: vardagar 09–20, lördag–söndag 10–18.

---

## 8. Bilder

**Bara riktiga foton i profilen.** Listan sa förut att bilderna i
`bilder/` är era egna. De är genererade (`nextrum-images.js`), och
personerna på dem är inte era studiehjälpare. **På sajten står de kvar,
det är Leos beslut (2026-10-07)**; det här gäller bara Google-profilen.
Google kräver att en profilbild visar den riktiga verksamheten, tar bort
genererade bilder och bildbanksbilder, och litar mindre på en profil som
laddat upp dem. I profilen ser en bild dessutom ut som ett foto av
verksamheten, så en genererad bild av "teamet" där blir en bild av
vilka som kommer hem till familjen.

| Plats | Vad |
|---|---|
| Logotyp | `favicon.svg`, exporterad som 512×512 PNG |
| Omslag och övriga | egna foton: ni två, en studiehjälpare som vill vara med, material på ett bord, en skärm med studievyn. Med ett ja från alla som syns, och inga barn utan vårdnadshavarens ja |

Ett telefonfoto går igenom Googles granskning lättare än en polerad
bild. Ladda upp ett nytt ungefär en gång i månaden: profiler som
uppdateras rankas bättre än profiler som står still.

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

## 10. Inlägg

Inlägg (Lägg till uppdatering) syns på profilen och visar Google att
någon sköter den. Ett i månaden räcker. Varje inlägg får en knapp
**Läs mer** med adressen under texten. Texterna är guidernas egna
beskrivningar och säger inga datum, för proven och terminerna flyttar
sig mellan åren.

**Erbjudande**, året runt (typen Erbjudande):

```
Titel: Första timmen på köpet

För nya familjer är första timmen läxhjälp på köpet: boka två timmar, så bjuder vi på den ena. Timmen dras av på det pass som gör att ni har bokat två timmar, och det syns på passet. Ett timpris oavsett ämne och ingen bindningstid.

Villkor: Gäller nya familjer, en gång. Timmen dras av på det pass som gör att ni har bokat två timmar.
Länk: https://nextrum.se/priser
```

Ändras erbjudandet på prissidan ändras inlägget samma dag, annars lovar
profilen något villkoren inte gör.

**Uppdateringar**, en i taget när säsongen kommer:

| När | Text | Länk |
|---|---|---|
| augusti | De första veckorna efter sommarlovet sätter rutinen för terminen. Vår guide för föräldrar: så kommer ni igång med läxorna igen, och vad hösten har i sig. | `https://nextrum.se/laxhjalp-efter-sommarlovet` |
| oktober | Från sexan sätts betyg i slutet av varje termin. Vår guide går igenom vad betyget bygger på, vad som går att göra de sista veckorna och vad som inte går. | `https://nextrum.se/infor-terminsbetyget` |
| januari | Vilka nationella prov nian skriver, när på året de kommer, vad de betyder för betyget och hur ni förbereder er, med länkar till provgruppernas egna övningar. | `https://nextrum.se/nationella-prov-ak-9` |
| februari | Sexan skriver nationella prov i svenska, engelska och matematik, samma år som de första betygen kommer. Vad proven prövar och hur ni förbereder er. | `https://nextrum.se/nationella-prov-ak-6` |
| när som helst | Blir läxan ett gräl varje kväll? Rutiner som tar bort förhandlingen, varför "jag vill inte" ofta betyder "jag förstår inte", och när ni behöver hjälp. | `https://nextrum.se/barnet-vill-inte-gora-laxorna` |

Bilden till ett inlägg följer samma regel som i avsnitt 8: ett riktigt
foto eller ingen bild.

---

## 11. Recensioner

Det här är den enda delen ingen kan skynda på, och den enda där ett
genvägsförsök kan stänga profilen.

**Fabricera aldrig recensioner.** Inte från er själva, inte från vänner
som inte varit kunder, inte i utbyte mot rabatt. Google upptäcker det
genom kontomönster, och påföljden är att hela profilen försvinner ur
sökresultaten. Det är också olagligt att vilseleda konsumenter på det
sättet.

**Sålla inte heller.** Att först fråga hur nöjd någon är och bara
skicka de nöjda vidare till Google är förbjudet i Googles regler. Alla
familjer får samma fråga, och därför styrs knappen i studievyn av
antalet rapporter, aldrig av något betyg.

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

**Inget riktmärke.** Ingen kan säga hur många recensioner som behövs
för kartrutan; listan lovade förut att fem räcker. Det som räknas är att
de är äkta, att det kommer nya och att ni svarar på varje.

Knappen i studievyn finns redan (`ritaRecension` i
`nextrum-studie-vy.js`) och ritas under rapporterna när barnet har
minst två. Den väntar bara på länken: klistra in den i
`GOOGLE_RECENSION_URL` i `nextrum-config.js`.

---

## Efter verifieringen

- [ ] Sök på *läxhjälp Farsta* i inkognitoläge och se om profilen syns
- [ ] Kontrollera att ingen adress visas publikt
- [ ] Lägg till Nextrum i Apple Maps Connect och Bing Places — samma
      uppgifter, tar tjugo minuter, och de matas in i andra tjänster
- [ ] Lägg upp profilens adress som `sameAs` i `index.html`, i
      JSON-LD-blocket under `"@type": "Organization"`
