# Trafik till nextrum.se: det som bara ni kan göra

Koden är gjord (se avsnittet sist). Det här är resten, i den ordning
det lönar sig. Varje steg har färdig text att klistra in. Detaljerna
för Google står i `GOOGLE.md` och `GOOGLE-FORETAGSPROFIL.md` och
upprepas inte här.

**Ärligt om tiden:** långa sökningar ("läxhjälp matte södermalm",
"hjälpa barn med läsförståelse") kan ge besök inom 2–6 månader. Kartrutan
för "läxhjälp stockholm" kräver företagsprofil och recensioner. Topp
tre i de vanliga träffarna för "läxhjälp stockholm" tar snarare ett år,
mot bolag som hållit på sedan 2004–2008. Den som lovar något annat
säljer något.

---

## 1. Mät först (5 minuter)

Mätningen är **inte påslagen** i projektet. Den 28 september 2026
svarade Vercel fortfarande "Web Analytics not found". Ni vet alltså i
dag inte hur många som besöker sajten eller varifrån de kommer. Det går
inte att slå på härifrån: Vercels verktyg har inget reglage för det.

1. vercel.com → projektet **nextrum-sajt** → fliken **Analytics** →
   **Enable**
2. Samma projekt → fliken **Speed Insights** → **Enable**
3. Gör det **före** nästa merge till main. Skripten börjar svara först
   i en driftsättning som görs efter påslaget.

Skripten laddas först när besökaren sagt ja till statistik i
samtyckesrutan (sedan 2026-09-27). Siffrorna i Vercel visar alltså bara
de som tackat ja och blir för låga. Jämför med Search Console, som
räknar sökträffarna oavsett rutan.

## 2. Gör repot privat (2 minuter)

En sökning på "nextrum läxhjälp stockholm" gav den 28 september en
GitHub-PR som första träff, inte nextrum.se. Repot är publikt, så den
som söker på ert namn hamnar i era interna PR:er och i `CLAUDE.md`, som
beskriver hela säkerhetsmodellen.

GitHub → repot → Settings → Danger Zone → Change visibility → Private.
`Nextrum10` är ett personligt konto, inte en organisation, så Vercel
fortsätter driftsätta som vanligt. De gamla träffarna försvinner ur
sökmotorerna av sig själva när sidorna svarar 404.

Det kostar en sak: i ett privat repo räknas GitHub Actions mot kontots
gratisminuter (2 000 i månaden på ett gratiskonto). Kontrollerna tar
några minuter per push, så håll ett öga på Settings → Billing den
första månaden.

## 3. Search Console och Bing (20 minuter)

1. Search Console: lägg till domänen och skicka in `sitemap.xml`
   (`GOOGLE.md` steg 1–3).
2. Be om indexering av de här, i den här ordningen (kvoten är ungefär
   tio om dagen, så de sista får vänta till dagen efter):
   ```
   https://nextrum.se/
   https://nextrum.se/laxhjalp-stockholm
   https://nextrum.se/laxhjalp-matematik
   https://nextrum.se/priser
   https://nextrum.se/laxhjalp-svenska
   https://nextrum.se/laxhjalp-engelska
   https://nextrum.se/laxhjalp-no
   https://nextrum.se/hjalpa-barn-med-matte
   https://nextrum.se/laxhjalp-online
   https://nextrum.se/plugga-infor-prov
   https://nextrum.se/hjalpa-barn-med-lasforstaelse
   https://nextrum.se/barnet-vill-inte-gora-laxorna
   https://nextrum.se/vad-kostar-laxhjalp
   https://nextrum.se/laxhjalp-hogstadiet
   https://nextrum.se/nationella-prov-ak-9
   https://nextrum.se/laxhjalp-eller-privatlarare
   https://nextrum.se/laxhjalp-mellanstadiet
   https://nextrum.se/nationella-prov-ak-6
   https://nextrum.se/laxhjalp-gymnasiet
   https://nextrum.se/en/tutoring-stockholm
   https://nextrum.se/infor-terminsbetyget
   https://nextrum.se/laxhjalp-efter-sommarlovet
   https://nextrum.se/laxhjalp-lagstadiet
   https://nextrum.se/laxhjalp-so
   https://nextrum.se/laxhjalp-moderna-sprak
   https://nextrum.se/laxhjalp-programmering
   ```
   Säsongsguiderna (efter sommarlovet, inför terminsbetyget och
   proven) har samma adress varje år: be om indexering igen när
   säsongen närmar sig, i juli, oktober och januari.
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

| Tjänst | Varför | Kategori att välja, om den finns |
|---|---|---|
| Bing Places | kan importera Google-profilen direkt | samma som i Google |
| Apple Business Connect | Apple Kartor och Siri | Läxhjälp, eller Utbildning om den saknas |
| hitta.se | läses av många, och Google ser den | Läxhjälp |
| Eniro | samma | Läxhjälp |
| Allabolag / Ratsit | kommer av sig själv efter registreringen, kontrollera att webbplatsen står rätt | |

Kategorinamnen är förslag: varje katalog har sin egen lista, så välj
det som ligger närmast läxhjälp. Ingen besöksadress någonstans, av samma
skäl som i Google-profilen.
Kräver en katalog en adress för att visa företaget, välj tjänsteområde
eller dold adress, och hoppa hellre över katalogen än att visa
bostadsadressen.

**Kort beskrivning (157 tecken):**
```
Läxhjälp i Stockholm, av unga för unga. Hemma hos er, på ett bibliotek eller online, från lågstadiet till gymnasiet. Studieplan och rapport efter varje pass.
```

**Längre beskrivning (359 tecken):**
```
Nextrum matchar elever i Stockholm med en studiehjälpare som nyligen läst samma kurser. Passen hålls hemma hos er, på ett bibliotek eller online, och efter varje pass skriver studiehjälparen en rapport som både elev och förälder ser. Bland annat matte, svenska, engelska och NO, från lågstadiet till gymnasiet. Ett timpris oavsett ämne och ingen bindningstid.
```

Texterna sa förut "från mellanstadiet till gymnasiet". Sajten tar
emot elever från ettan (`laxhjalp-stockholm`), och biblioteket stod
inte med.

## 7. Länkar från andra sajter

Det här är det som på sikt bär rankingen, och det enda som inte går
att göra på en eftermiddag. En riktig länk från en skola eller en
tidning väger mer än hundra från kataloger.

**a) Karriärsidor och jobbportaler.** Annonsen länkar till
`/bli-studiehjalpare`. Det ger både en länk och studiehjälpare.

| Var | Hur | Kostar |
|---|---|---|
| KTH | KTH Exjobbportal tar deltidsjobb och extrajobb, inte bara exjobb. Skapa ett konto som uppdragsgivare: kth.se/samverkan/exjobb/uppdragsgivare | inget |
| Stockholms universitet | Karriärportalen MyCareer, med ett rekryterarkonto. Frågor till reachtalent@su.se: su.se/om-universitetet/kontakt/na-vara-studenter | inget |
| KI, Handelshögskolan, Södertörn | fråga karriärtjänsten om de tar annonser för extrajobb; ingen öppen portal för det hittades | |
| Gymnasierna | mejla studie- och yrkesvägledaren (SYV) på skolor nära de områden ni har familjer i | inget |
| Platsbanken | Arbetsförmedlingens annonser, läses av många och indexeras brett. Kräver ett arbetsgivarkonto med organisationsnummer, alltså efter registreringen | inget |

Uppgifterna om portalerna är sökta 2026-10-07, inte provade: sidorna
gick inte att öppna härifrån. Kontrollera dem när ni skapar kontot.

Texten sa förut att gymnasie- och högskolestudenter hjälper yngre
elever. Alla som får jobba kan bli studiehjälpare (Leo, 2026-10-06), så
annonsen säger vem den söker utan att stänga ute någon. Den lovar ingen
lön i kronor och ingen anställningsform: ingen av dem står på
jobbsidan, och anställningsformen är inte bestämd (`CLAUDE.md`,
avsnitt 11).

**Annonsen** (portalerna och Platsbanken):

```
Rubrik: Extrajobb som studiehjälpare i Stockholm

Nextrum förmedlar läxhjälp i Stockholm, av unga för unga. Som studiehjälpare hjälper du en yngre elev med skolarbetet, en till tre timmar åt gången, hemma hos familjen, på ett bibliotek eller online.

Du väljer själv ämnen, årskurser och tider som funkar för dig, så jobbet går att kombinera med studier eller annat jobb. Vi matchar dig med elever i det du kan, helst i ämnen du själv nyligen läst. Efter varje pass skriver du en kort rapport, och du får betalt för dina pass varje månad.

Alla som får jobba kan söka. Är du under 18 behöver vi din vårdnadshavares skriftliga godkännande innan du börjar.

Läs mer och sök här: https://nextrum.se/bli-studiehjalpare
```

**Mejlet till karriärtjänsten eller SYV:**

```
Hej!

Vi heter Nextrum och driver läxhjälp i Stockholm, där unga hjälper yngre elever med skolarbetet. Vi söker studiehjälpare, och jobbet går att kombinera med studierna: man väljer själv ämnen och tider.

Får vi lägga upp en annons hos er, eller tipsa era elever och studenter om den? Annonsen och ansökan finns här:
https://nextrum.se/bli-studiehjalpare

Är någon under 18 ber vi om vårdnadshavarens skriftliga godkännande innan hen börjar.

Vänliga hälsningar
Leo Constantinos Thriskos och Alexandar Jovanovic, Nextrum
info@nextrum.se
```

**b) Lokalpress.** Mitt i:s lokala upplagor tar tips på mitti.se
(tipsformuläret eller redaktionens adress, i upplagan för stadsdelen).
Vinkeln är människorna, inte tjänsten. Skicka till en upplaga i taget,
där ni har en studiehjälpare eller en familj som kan tänka sig att vara
med, och vänta en vecka innan nästa.

```
Ämne: Tips: Unga startade läxhjälp där unga hjälper unga

Hej!

Vi är [ålder] och [ålder] år och har startat Nextrum, en läxhjälp i Stockholm där unga hjälper yngre elever med skolarbetet, ofta i ämnen de själva nyss läst. Studiehjälparna väljer själva ämnen och tider, och för [antal] av dem är det första jobbet.

Vi berättar gärna varför vi startade och hur det har gått hittills, och kan ställa upp med en studiehjälpare som vill vara med.

Leo Constantinos Thriskos och Alexandar Jovanovic
info@nextrum.se, [telefon]
https://nextrum.se
```

Fyll i siffran bara om ni vet den; stryk annars halva meningen. Lova
inte en familj i tipset innan ni har frågat en, och inget barn syns
utan vårdnadshavarens ja.

**c) Föräldragrupper** i stadsdelarna (Facebook och liknande). Skriv
bara där reklam är tillåten, säg att ni driver företaget och länka
hellre till en guide (`/plugga-infor-prov`,
`/barnet-vill-inte-gora-laxorna`) än till en säljsida. Folk sparar
något de har nytta av och scrollar förbi reklam.

```
Hej! Jag heter [namn] och driver Nextrum, en läxhjälp här i Stockholm. Vi har skrivit en kort guide för föräldrar om [ämnet, till exempel när läxorna blir ett gräl varje kväll], och jag tänkte att den kanske kan vara till nytta här. Den är gratis och kräver ingen inloggning:
[länk till guiden]
Har ni frågor om läxhjälp svarar jag gärna, men guiden går att läsa utan att ni behöver oss.
```

Säsongsguiderna passar när säsongen kommer: `/laxhjalp-efter-sommarlovet`
i augusti, `/infor-terminsbetyget` i oktober, `/nationella-prov-ak-9`
och `/nationella-prov-ak-6` i januari.

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

- **"privatlärare"** är ett stort sökord, och nästan alla konkurrenter
  har det i titeln. Sajten har det nu på ett ställe: FAQ-frågan "Är en
  studiehjälpare samma sak som en privatlärare?", som svarar nej och
  varför. Mer än så går inte utan att bryta ordlistan. Vill ni ha ordet
  i en titel eller rubrik är det ert beslut, och då med samma ärliga
  svar bredvid.
- **Online i hela Sverige?** Sidan `/laxhjalp-online` säger ingenting om
  var eleven får bo. "Läxhjälp online" söks i hela landet, men att ta
  emot familjer utanför Stockholm är ett beslut om affären. Bestämmer
  ni er för det ska sidan säga det.
- **Stadsdelssidorna är för lika varandra.** De sex har i snitt 72 %
  samma text, ord för ord. Google indexerar troligen bara några av dem.
  Bygg inga fler. Har ni något sant och lokalt att skriva om en
  stadsdel (en skola ni faktiskt har elever på, en studiehjälpare som
  bor där och vill synas) blir sidan starkare; annars är det bättre att
  slå ihop dem än att fylla ut.
- **Startsidans H1** är "Av unga, för unga." och har inget sökord.
  Titeln bär "Läxhjälp i Stockholm", så det är en liten sak, men heron
  är orörd med flit och därför er att ändra.

## 11. Följ upp efter fyra veckor

- Search Console → *Resultat*: vilka sökningar ger visningar? Skriv
  mer om det som redan rör sig.
- Vercel Analytics: varifrån kommer besöken, och vilka sidor leder
  till en intresseanmälan?

---

## Det som redan är gjort i koden

- Sju ämnessidor (matte, svenska, engelska, NO, SO, moderna språk och
  programmering), fyra stadiesidor (från lågstadiet) och tio guider i
  tre grupper, byggda av `verktyg/bygg-omradessidor.py`.
  Guiderna länkar det de påstår till myndigheternas och provgruppernas
  egna sidor
- `/en/tutoring-stockholm` för familjer som inte läser svenska, länkad
  från footern på alla öppna sidor
- En delningsbild per sida (`delning/`, 2026-10-07): sidans rubrik och
  priset på bilden som syns när någon delar länken
- `/laxhjalp-online`: hur ett onlinepass går till, när hemma är bättre,
  och samma pris. Länkad från footern, navet och ämnessidorna
- FAQ-frågan om privatlärare, på båda språken
- Footern länkar till de fyra första ämnessidorna och onlinesidan från varje sida,
  och ämnessidorna länkar till guiderna
- `sitemap.xml` byggs ur sidorna, med `lastmod` som bara flyttas när
  texten ändras (`verktyg/bygg-sitemap.py`, kontrolleras i CI)
- IndexNow: Bing får ändrade sidor inom minuter efter varje
  driftsättning (`verktyg/indexnow.py`, `.github/workflows/indexnow.yml`).
  Första driftsättningen efter merge skickar alla sidor.
- Typsnittet förladdas på läxhjälpssidorna: navet gick från 85 till
  95 i Lighthouse på mobil, och sidan hoppar inte längre när den laddas
- Strukturerad data (Service, Article, FAQ, brödsmulor) på alla nya
  sidor
