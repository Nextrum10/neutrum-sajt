# Trafik till nextrum.se: det som bara ni kan göra

Koden är gjord (se avsnittet sist). Det här är resten, i den ordning
det lönar sig. Varje steg har färdig text att klistra in. Detaljerna
för Google står i `GOOGLE.md` och `GOOGLE-FORETAGSPROFIL.md` och
upprepas inte här.

**Ärligt om tiden:** långa sökningar ("läxhjälp matte södermalm",
"gratis läxhjälp stockholm") kan ge besök inom 2–6 månader. Kartrutan
för "läxhjälp stockholm" kräver företagsprofil och recensioner. Topp
tre i de vanliga träffarna för "läxhjälp stockholm" tar snarare ett år,
mot bolag som hållit på sedan 2004–2008. Den som lovar något annat
säljer något.

---

## 1. Mät först (5 minuter)

Sidorna laddar redan Vercels mätskript, men mätningen är **inte
påslagen** i projektet. Den 27 september 2026 svarade Vercel "Web
Analytics not found". Ni vet alltså i dag inte hur många som besöker
sajten eller varifrån de kommer.

1. vercel.com → projektet **nextrum-sajt** → fliken **Analytics** →
   **Enable**
2. Samma projekt → fliken **Speed Insights** → **Enable**
3. Gör det **före** nästa merge till main. Skripten börjar svara först
   i en driftsättning som görs efter påslaget.

Sätter inga cookies. Det står redan i integritetspolicyn och på
`/lagring`.

## 2. Merga PR:en med guiderna

Ämnessidorna och sitemapen är redan i drift. Guiderna, footerlänkarna,
IndexNow och det snabbare navet ligger i en egen PR. Inget av det gör
nytta förrän det är i drift.

## 3. Search Console och Bing (20 minuter)

1. Search Console: lägg till domänen och skicka in `sitemap.xml`
   (`GOOGLE.md` steg 1–3).
2. Be om indexering av de här, i den här ordningen (kvoten är ungefär
   tio om dagen):
   ```
   https://nextrum.se/
   https://nextrum.se/laxhjalp-stockholm
   https://nextrum.se/laxhjalp-matematik
   https://nextrum.se/gratis-laxhjalp-stockholm
   https://nextrum.se/priser
   https://nextrum.se/laxhjalp-svenska
   https://nextrum.se/laxhjalp-engelska
   https://nextrum.se/laxhjalp-no
   https://nextrum.se/hjalpa-barn-med-matte
   ```
3. **Bing Webmaster Tools** (bing.com/webmasters): logga in och välj
   *Importera från Google Search Console*. Det är ett klick. Bing
   matar ChatGPT:s sökning, Copilot och DuckDuckGo, och sajten skickar
   redan ändrade sidor dit automatiskt (IndexNow, se nedan). Kontot
   ger er dessutom siffrorna.

## 4. Google-företagsprofilen (en kväll, plus verifiering)

Hela uppsättningen står i `GOOGLE-FORETAGSPROFIL.md`. Det är den
enskilt viktigaste punkten: kartrutan står ovanför de vanliga
träffarna, och där tävlar ni inte mot tjugo år av länkar.

När profilen finns: klistra in recensionslänken (`g.page/r/...`) i
`GOOGLE_RECENSION_URL` i `nextrum-config.js`. Knappen i studievyn
väntar bara på den.

## 5. Recensioner

Be **alla** familjer, inte bara de nöjda (Googles regel, och den står
redan i koden). Bäst är att fråga direkt efter den andra rapporten.

**Sms eller mejl, att skicka personligt:**

```
Hej! Hoppas passen med [studiehjälparens förnamn] fungerar bra.
Vi är ett litet och nytt företag, och det som hjälper oss mest är
om ni skriver några rader om hur det har gått, bra eller dåligt:
[länk]
Tack! /Leo och Alexandar, Nextrum
```

Svara på varje recension inom ett dygn, också de kritiska.

## 6. Kataloger (en timme, när bolaget är registrerat)

De flesta kräver organisationsnummer. Samma uppgifter överallt: namn
**Nextrum**, webbplats **https://nextrum.se/laxhjalp-stockholm**, e-post
**info@nextrum.se**, ingen besöksadress.

| Tjänst | Varför |
|---|---|
| Bing Places | kan importera Google-profilen direkt |
| Apple Business Connect | Apple Kartor och Siri |
| hitta.se | läses av många, och Google ser den |
| Eniro | samma |
| Allabolag / Ratsit | kommer av sig själv efter registreringen, kontrollera att webbplatsen står rätt |

**Kort beskrivning (160 tecken):**
```
Läxhjälp i Stockholm med unga studiehjälpare som nyligen läst samma kurser. Hemma hos er eller online. Studieplan och rapport efter varje pass.
```

**Längre beskrivning (400 tecken):**
```
Nextrum matchar elever i Stockholm med en studiehjälpare, en gymnasie- eller högskolestudent som nyligen läst samma kurser. Passen hålls hemma hos er eller online, och efter varje pass skriver studiehjälparen en rapport som både elev och förälder ser. Matte, svenska, engelska och NO från mellanstadiet till gymnasiet. Ett timpris oavsett ämne och ingen bindningstid.
```

## 7. Länkar från andra sajter

Det här är det som på sikt bär rankingen, och det enda som inte går
att göra på en eftermiddag. En riktig länk från en skola eller en
tidning väger mer än hundra från kataloger.

**a) Karriärsidor och jobbportaler.** Högskolorna i Stockholm (KTH,
Stockholms universitet, KI, Handelshögskolan) och gymnasiernas studie-
och yrkesvägledare. Annonsen länkar till `/bli-studiehjalpare`. Det ger
både en länk och studiehjälpare.

```
Hej!

Vi heter Nextrum och driver läxhjälp i Stockholm där gymnasie- och
högskolestudenter hjälper yngre elever i ämnen de själva nyligen läst.
Det är betalt, flexibelt och går att kombinera med studierna.

Får vi lägga upp en annons hos er, eller tipsa era studenter? All
information och ansökan finns här:
https://nextrum.se/bli-studiehjalpare

Vänliga hälsningar
Leo Constantinos Thriskos och Alexandar Jovanovic, Nextrum
info@nextrum.se
```

**b) Lokalpress.** Mitt i:s lokala upplagor tar tips via sitt
tipsformulär på mitti.se. Vinkeln är människorna, inte tjänsten:

```
Tips: Unga startade läxhjälp där unga hjälper unga

Vi är [ålder] och [ålder] år och har startat Nextrum, en läxhjälp i
Stockholm där gymnasie- och högskolestudenter hjälper yngre elever
med ämnen de själva nyss läst. För många av våra studiehjälpare är det
första jobbet. Vi berättar gärna mer, och kan ställa upp med en
studiehjälpare och en familj som vill vara med.

Leo Constantinos Thriskos och Alexandar Jovanovic
info@nextrum.se, [telefon]
https://nextrum.se
```

Lova inte en familj i tipset innan ni har frågat en.

**c) Föräldragrupper** i stadsdelarna (Facebook och liknande). Skriv
bara där reklam är tillåten, säg att ni driver företaget och länka
hellre till guiden `/gratis-laxhjalp-stockholm` än till en säljsida.
Folk sparar en användbar lista och scrollar förbi reklam.

## 8. Sociala medier med spårning

Länka från bion med de här adresserna, så syns det i Vercel Analytics
vilket konto som ger besök:

```
Instagram:  https://nextrum.se/?utm_source=instagram&utm_medium=social&utm_campaign=bio
TikTok:     https://nextrum.se/?utm_source=tiktok&utm_medium=social&utm_campaign=bio
Facebook:   https://nextrum.se/?utm_source=facebook&utm_medium=social&utm_campaign=bio
LinkedIn:   https://nextrum.se/bli-studiehjalpare?utm_source=linkedin&utm_medium=social&utm_campaign=bio
```

Sidornas canonical tar bort parametrarna för Google. Det blir inga
dubbletter. Säger besökaren ja i samtyckesrutan följer taggen också med
in i anmälan (`leads.kalla`), även om familjen läst flera sidor först.

## 9. Google Ads (valfritt, kostar pengar)

Det enda sättet att stå först på "läxhjälp stockholm" i morgon.

- En sökkampanj, område Stockholms län
- Sökord: `läxhjälp stockholm`, `mattehjälp stockholm`, `läxhjälp
  matte`, `läxhjälp gymnasiet stockholm`
- Uteslut: `gratis`, `jobb`, `extrajobb`, `lön`
- Landningssida: `/laxhjalp-stockholm`, och ämnessidan för
  ämnessökorden
- Sätt en dagsbudget ni klarar att förlora en månad, och läs
  sökordsrapporten varje vecka
- **Klistra aldrig in Googles tagg i sidorna.** Konverteringsspårningen
  skrivs som id:n i `NEXTRUM_CONFIG.SAMTYCKE` (`GOOGLE_TAG_ID`,
  `GOOGLE_ADS_LEAD`) och laddas först när besökaren sagt ja. En tagg
  direkt i sidan går förbi rutan, och då spårar sajten utan samtycke.
  Läs checklistan i `nextrum-config.js` först. Utan den spårningen
  syns annonsen ändå i anmälan som `google / cpc` (klick-id:t `gclid`
  i adressen): alltid när familjen anmäler sig på sidan de landade på,
  och efter flera sidor när de sagt ja i rutan

## 10. Beslut som är era

- **"privatlärare"** är ett stort sökord. Ordlistan säger aldrig
  "lärare" utåt. Företagsprofilen har redan tjänsten "Privatlärare".
  Ska sajten också ha det, till exempel i en rubrik som "Privatlärare
  eller studiehjälpare?"
- **Startsidans H1** är "Av unga, för unga." och har inget sökord.
  Titeln bär "Läxhjälp i Stockholm", så det är en liten sak, men heron
  är orörd med flit och därför er att ändra.
- **Repot är publikt.** GitHub-PR:erna syns när man söker på Nextrum,
  och `CLAUDE.md` beskriver hela säkerhetsmodellen för vem som helst.
  GitHub → Settings → Danger Zone → Change visibility.

## 11. Följ upp efter fyra veckor

- Search Console → *Resultat*: vilka sökningar ger visningar? Skriv
  mer om det som redan rör sig.
- Vercel Analytics: varifrån kommer besöken, och vilka sidor leder
  till en intresseanmälan?

---

## Det som redan är gjort i koden

- Fyra ämnessidor (matte, svenska, engelska, NO) och två guider, byggda
  av `verktyg/bygg-omradessidor.py`
- Footern länkar till alla ämnessidor från varje sida
- `sitemap.xml` byggs ur sidorna, med `lastmod` som bara flyttas när
  texten ändras (`verktyg/bygg-sitemap.py`, kontrolleras i CI)
- IndexNow: Bing får ändrade sidor inom minuter efter varje
  driftsättning (`verktyg/indexnow.py`, `.github/workflows/indexnow.yml`).
  Första driftsättningen efter merge skickar alla sidor.
- Typsnittet förladdas på läxhjälpssidorna: navet gick från 85 till
  95 i Lighthouse på mobil, och sidan hoppar inte längre när den laddas
- Strukturerad data (Service, Article, FAQ, brödsmulor) på alla nya
  sidor
