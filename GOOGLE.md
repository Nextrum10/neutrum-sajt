# Få upp Nextrum på Google

Allt på sajtens sida är gjort och kontrollerat:

| | |
|---|---|
| favicon | finns, svarar 200 |
| sitemap.xml | 16 adresser, båda språken |
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
ska bli *Lyckades* med 16 upptäckta adresser.

Kartan är kontrollerad och fungerar — `https://nextrum.se/sitemap.xml`
svarar 200 med giltig XML och 16 adresser. Öppna den i webbläsaren om
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

Upprepa för de sidor som är viktigast:

```
https://nextrum.se/priser.html
https://nextrum.se/bli-studiehjalpare.html
https://nextrum.se/intresseanmalan.html
https://nextrum.se/faq.html
```

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

Google visar **faviconen** bredvid söketräffen. Den som ligger där nu
är en förenklad version av märket, inte den riktiga logotypen.

### Steg 1. Spara filen

Spara den kvadratiska loggan som:

```
bilder/nextrum-logo.png
```

Minst 512×512 pixlar, helst 1024×1024. Den **måste vara kvadratisk** —
Google beskär till en kvadrat, så en avlång bild får något bortkapat.
Använd märket, inte den breda varianten med texten NEXTRUM bredvid:
i 48 pixlar går en wordmark inte att läsa ändå.

### Steg 2. Kör verktyget

```bash
python3 verktyg/satt-logga.py
```

Det skalar fram alla storlekar som behövs (512, 192, 180, 96, 48),
lägger in ikonlänkarna på alla 18 sidor och pekar om den strukturerade
datan. Varnar om bilden är för liten eller inte kvadratisk.

### Steg 3. Publicera

```bash
git add -A && git commit -m "Riktiga logotypen som favicon" && git push
```

### Steg 4. Be Google hämta om den

Tillbaka i Search Console: **Inspektera URL** på `https://nextrum.se/`
→ **Begär indexering**. Utan det ligger den gamla ikonen kvar tills
Google råkar titta förbi.

---

## Om one.com fortfarande kommer upp

Det är ett gammalt indexerat spår, inte var sidan ligger. DNS pekar
redan rätt: Cloudflare → Vercel. Spåret försvinner av sig självt när
Google indexerat nextrum.se på riktigt.

Ligger det kvar efter att er egen sida börjat synas, går det att be
Google ta bort den gamla adressen under **Borttagningar** i Search
Console.

---

## Vad ni INTE behöver göra

- **Köpa annonser.** Det påverkar inte de vanliga träffarna alls.
- **Skicka in sajten till kataloger.** Onödigt sedan länge.
- **Byta hosting.** Vercel är inte problemet — sajten svarar 200 för
  Googlebot på varenda adress vi testat.
- **Lägga till fler nyckelord i koden.** Meta keywords ignoreras av
  Google sedan 2009.
