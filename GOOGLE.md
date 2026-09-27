# Få upp Nextrum på Google

Allt på sajtens sida är gjort och kontrollerat:

| | |
|---|---|
| favicon | finns, svarar 200 |
| sitemap.xml | 33 adresser, båda språken, byggd av `verktyg/bygg-sitemap.py` |
| robots.txt | pekar på sitemap, blockerar inget publikt |
| strukturerad data | Organization + WebSite med namn, beskrivning, slogan, sociala konton |
| verifieringspost i DNS | finns redan (`google-site-verification=5o3n…`) |
| noindex / X-Robots-Tag | inget som stoppar indexering |

Googlebot kommer alltså in och får allt den behöver. **Men Google
kryper inte en ny sajt bara för att den finns.** Någon måste be om
det, och det kan bara göras från ett Google-konto. Därför de här
stegen.

---

## Del 1 — Search Console (det som avgör om sidan syns)

### Steg 1. Öppna Search Console

Gå till **search.google.com/search-console** och logga in med det
Google-konto som hör till Nextrum — samma konto som Workspace för
info@nextrum.se, om ni har det.

### Steg 2. Lägg till egendomen

Klicka **Lägg till egendom** uppe till vänster. Ni får två val:

- **Domän** (`nextrum.se`) — täcker allt: www, utan www, http och
  https. Verifieras med en DNS-post.
- **URL-prefix** (`https://nextrum.se`) — bara exakt den adressen.

**Välj Domän.** Ni har redan en `google-site-verification`-post i
DNS, så verifieringen kan gå igenom direkt. Gör den inte det, ger
Google en ny TXT-post — lägg in den i **Cloudflare → DNS → Records**
och klicka Verifiera igen. Det kan ta upp till en timme innan
Cloudflare spridit posten.

### Steg 3. Skicka in kartan över sidan

**Sitemaps ligger inte fritt i vänstermenyn.** Den är nästlad:

```
Vänstermenyn  ->  Indexering  ->  Sitemaps
```

Syns ingen meny alls är egendomen inte tillagd än — gör Steg 2 först.
På smal skärm är menyn hopfälld bakom hamburgerikonen uppe till
vänster.

Väl inne: skriv `sitemap.xml` i rutan och klicka **Skicka**. Status
ska bli *Lyckades* med 33 upptäckta adresser.

Kartan är kontrollerad och fungerar — `https://nextrum.se/sitemap.xml`
svarar 200 med giltig XML och 33 adresser. Öppna den i webbläsaren om
du vill se själv. Går den inte att skicka in är det något i Search
Console, inte i filen.

**Och om det ändå strular:** att skicka in kartan är inte nödvändigt.
robots.txt pekar redan ut den, så Google hittar den på egen hand.
Inskickningen gör det bara snabbare och ger dig en statusrad att titta
på. **Steg 4 är det som faktiskt betyder något** — hoppa dit.

### Steg 4. Be Google hämta startsidan nu

Det här är steget som faktiskt sätter fart på det.

1. Klistra in `https://nextrum.se/` i **sökrutan högst upp**
   (den heter *Inspektera URL*)
2. Vänta på svaret. Står det *URL:en finns inte på Google* är det
   väntat — det är hela problemet.
3. Klicka **Begär indexering**
4. Vänta ut kontrollen, ungefär en minut

Upprepa för de sidor som är viktigast, i den här ordningen:

```
https://nextrum.se/laxhjalp-stockholm
https://nextrum.se/laxhjalp-matematik
https://nextrum.se/priser
https://nextrum.se/bli-studiehjalpare
https://nextrum.se/intresseanmalan
https://nextrum.se/faq
```

`/laxhjalp-stockholm` först efter startsidan: det är sidan som
svarar på "läxhjälp stockholm", och den länkar vidare till alla
stadsdelar och ämnen, så Google hittar resten därifrån.

**Utan `.html`.** Adresserna är rena sedan september 2026 och
`.html`-varianten svarar med en omdirigering. Skickar du in den
gamla formen ber du Google indexera en vidarebefordran i stället
för sidan, och du bränner en plats i kvoten på den.

Det finns en kvot på ungefär tio per dygn. Ta startsidan först.

### Steg 5. Vänta

- **Träffen dyker upp:** några dagar till ett par veckor
- **Beskrivningen under träffen:** samtidigt som träffen
- **Faviconen bredvid träffen:** ofta senare än texten, ibland
  flera veckor. Google hämtar om ikoner i sin egen takt.

Sök på `site:nextrum.se` för att se vad som faktiskt är indexerat.
Kommer inget upp är sidan inte inne än — då är det bara att vänta,
inte att ändra något.

---

## Del 2 — Loggan

Google visar loggan på två ställen, och de läses ur två olika saker:

| Var | Läses ur | I dag |
|---|---|---|
| Den lilla ikonen bredvid träffen | `<link rel="icon">` på startsidan | `favicon.svg` plus `favicon-48.png` och `favicon-96.png` |
| Kunskapspanelen till höger | `logo` i den strukturerade datan | `bilder/nextrum-logo-512.png` |

Alla är samma märke som i sidhuvudet: N:et i den rundade rutan, bark
och lin. PNG:erna renderades ur `favicon.svg` 2026-09-23.

### Det här var fel före 2026-09-23

- **`logo` pekade på `favicon.svg` och påstod att den var 512×512.**
  Filen säger själv `width="26" height="26"`. Google kräver minst
  112×112 pixlar för loggan, och hur Google räknar storleken på en
  SVG står ingenstans. En PNG i den storlek datan påstår lämnar
  ingenting åt tolkning.
- **`satt-logga.py` hade aldrig fungerat hela vägen.** Den skriver
  `bilder/nextrum-logo-512.png`, men `.gitignore` ignorerar
  `bilder/*.png`. Hade den körts hade filen legat kvar på Macen,
  aldrig följt med en commit, och `logo` hade pekat på en 404 i
  drift. `.gitignore` har nu ett undantag för
  `bilder/nextrum-logo-*.png`.

SVG-faviconen i sig var giltig — Google tar SVG för ikonen bredvid
träffen. **Syns ingen logga i sökresultatet är orsaken nästan säkert
att Google inte hämtat om startsidan, inte filerna.** Se Steg 4 nedan.

### Om den riktiga logotypen är en annan

Tidigare stod här att märket i sidhuvudet är en förenklad version. Är
det så, och ni har loggan som bild:

**Steg 1.** Spara den kvadratiska loggan som `bilder/nextrum-logo.png`.
Minst 512×512 pixlar, helst 1024×1024. Den **måste vara kvadratisk** —
Google beskär till en kvadrat, så en avlång bild får något bortkapat.
Använd märket, inte den breda varianten med texten NEXTRUM bredvid:
i 48 pixlar går en wordmark inte att läsa ändå.

**Steg 2.** Kör verktyget (på Macen — det använder `sips`):

```bash
python3 verktyg/satt-logga.py
```

Det skriver över PNG:erna ovan med samma namn och pekar om den
strukturerade datan. Ikonlänkarna står redan rätt på alla sidor.

**`favicon.svg`, `bilder/nextrum-logo-bimi.svg` och
`bilder/nextrum-logo-profil.png` rör det inte.** De är ritade för
hand. Byts märket måste de ritas om, annars visar webbläsarfliken och
inkorgen det gamla medan Google visar det nya (`DEPLOY-EPOST.md`
avsnitt 5).

**Steg 3.** Commit och push.

### Steg 4. Be Google hämta om startsidan

I Search Console: **Inspektera URL** på `https://nextrum.se/` →
**Begär indexering**. Ikonen bredvid träffen kommer ofta senare än
texten, ibland flera veckor efter. Google hämtar om ikoner i sin egen
takt, och det finns ingen knapp som skyndar på just den.

Loggan i kunskapspanelen är ännu mer Googles eget beslut. Den
strukturerade datan är ett förslag, inte en beställning — en ny
sajt utan många omnämnanden får ofta ingen panel alls.

---

## Om one.com fortfarande kommer upp

Det gör det, och det är kontrollerat 2026-09-09: träffen heter
*"nextrum.se is hosted by one.com"* och pekar på **`http://nextrum.se`**
— med `http`, inte `https`. Det är hela förklaringen.

Google sparar en träff per adress, och `http://nextrum.se` var en egen
adress redan innan sajten flyttade. Den posten ligger kvar i indexet
med den gamla parkeringssidans text tills Google går tillbaka och
tittar på just den adressen igen.

**Servern gör redan rätt.** Kontrollerat med `curl`:

| adress | svar |
|---|---|
| `http://nextrum.se/` | 308 → `https://nextrum.se/` |
| `http://www.nextrum.se/` | 308 → `https://www.nextrum.se/` |
| `https://www.nextrum.se/` | 307 → `https://nextrum.se/` |

Alla vägar leder alltså till rätt sida. Det finns ingenting att laga i
koden, i DNS eller hos Vercel. Det som saknas är att Google ska hämta
om den gamla adressen och se omdirigeringen.

**Så snabbar ni på det.** I Search Console: **Inspektera URL** på
`http://nextrum.se/` (skriv `http` med flit) och klicka **Begär
indexering**. Google följer då omdirigeringen och byter ut träffen mot
den riktiga sidan.

Vill ni ha bort den fortare kan ni be om en tillfällig borttagning
under **Borttagningar**. Den gäller ungefär ett halvår och döljer bara
träffen — det är omindexeringen ovan som löser det på riktigt.

Vänta er inte att det går över en natt. Den gamla posten kan ligga kvar
i veckor, och den försvinner snabbare ju fler gånger Google hämtar den
riktiga sidan.

---

## Vad ni INTE behöver göra

- **Köpa annonser.** Det påverkar inte de vanliga träffarna alls.
- **Skicka in sajten till kataloger.** Onödigt sedan länge.
- **Byta hosting.** Vercel är inte problemet — sajten svarar 200 för
  Googlebot på varenda adress vi testat.
- **Lägga till fler nyckelord i koden.** Meta keywords ignoreras av
  Google sedan 2009.

---

## Vad som gjordes på sidan 2026-09-09

- **Titlarna skrevs om.** De var märkesnamn först och nyckelord sist,
  eller inget nyckelord alls: *Priser — Nextrum* var sexton tecken av
  sextio möjliga. Nu står det man faktiskt söker på först och Nextrum
  sist, och ingen titel kapas av Google. *Så fungerar Nextrum — Nextrum*
  sa dessutom märket två gånger.
- **Prissidan fick strukturerad data** med tjänst och timpris, så att
  Google kan visa priset i träffen. Siffran hämtas från
  `nextrum-config.js` vid sidladdning — ändra priset på ett ställe.
- **FAQ:n fick FAQPage-märkning**, byggd av
  `python3 verktyg/bygg-faq-schema.py`. **Kör om den när en fråga
  ändras.** Märkningen måste säga samma sak som sidan; gör den inte det
  är den ett fel och inte en bonus. Notera att Google sedan 2023 bara
  visar utfällbara FAQ-träffar för myndigheter och vården, så den ger
  inte den rika träffen här — den beskriver sidan maskinläsbart för
  andra läsare.
- **Nio av tjugonio frågor låg utanför sina grupplådor** på FAQ-sidan
  och tog med sig avståndet mellan rubrikerna. Det syntes som att
  frågorna hängde löst under fel rubrik. Rättat i båda språken.
