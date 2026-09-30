# Genererade filer, sidornas innehåll och CI

Arkivet för avsnitt 8 och 9 i `CLAUDE.md`, ordagrant. Reglerna står i kärnan, `CLAUDE.md`;
"avsnitt N" i texten är kärnans.

---

## 8. Genererade filer — ändra aldrig för hand

| Fil | Byggs av | Ur |
|---|---|---|
| `nextrum-maskot-svar.js` | `verktyg/bygg-maskotsvar.py` | `faq.html`, `en/faq.html` |
| FAQPage-märkningen i `faq.html` och `en/faq.html` | `verktyg/bygg-faq-schema.py` | frågorna på sidan |
| `laxhjalp-*.html` (6 stadsdelar, 4 ämnen, online), de fyra guiderna och ämnes- och guidekorten i `laxhjalp-stockholm.html` | `verktyg/bygg-omradessidor.py` | skalet läses ur `var-ide.html`, alt-texten ur `nextrum-images.js` |
| `sitemap.xml` | `verktyg/bygg-sitemap.py` | sidornas canonical, hreflang och noindex |
| Ikonlänkar och storlekar | `verktyg/satt-logga.py` | `bilder/nextrum-logo.png` — finns inte i dag; PNG:erna är renderade ur `favicon.svg`, se `GOOGLE.md` |
| `bank/*.png` (övningsbladen) | `verktyg/bygg-banken.py` | bladen står i klartext i verktyget. Körs för hand (kräver Chromium), inte i CI. `--sql` ger raderna till `biblioteksmaterial` |
| `?v=`-stämplarna på alla script- och link-taggar | `verktyg/satt-version.py` | filernas egen md5 |
| `bilder/*.webp` | `verktyg/bygg-webp.py` | `bilder/*.jpg` |
| `supabase/migrations/*_uppgiftsbanken_*.sql` (nivåerna och frågorna) | `verktyg/bygg-uppgifter.py --sql` | `verktyg/uppgiftsbanken/*.py`. Ändras banken skrivs en NY migration, den gamla står kvar. `--kolla` (CI) jämför den senaste med vad verktyget skriver nu, och `--visa` skriver ut frågorna med facit för den som ska läsa igenom dem. Sedan Fas 23.2 skriver verktyget också ett Mästarprov sist i varje område med minst två nivåer (`<prefix>-mastare-<område>`) och repetitionen sist i banan (`<prefix>-repetition`); områdena Mästarprov och Repetition är upptagna för handskrivna nivåer |

CI kör om maskotsvaren, FAQ-schemat och kartan och gör `git diff
--exit-code`. Ändrar du FAQ:n utan att bygga om blir bygget rött, och
samma sak om du ändrar vad en sida säger, lägger till en eller tar bort
en utan att köra `bygg-sitemap.py`.

**Kartans `lastmod` räknas ur texten, inte ur git** (2026-09-26). Den
skrevs för hand förut och hade glidit: `/laxhjalp-stockholm` stod två
gånger och sex sidor saknade datum. Git hade inte hjälpt, för
`satt-version.py` stämplar om varje sida när en js-fil ändras, och då
ser hela sajten nyskriven ut efter varje commit. Google slutar läsa
`lastmod` som inte stämmer. Skriptet räknar i stället en summa av
titel, beskrivning och texten i `<main>`, och flyttar datumet bara när
summan ändras.

**`satt-version.py` körs SIST.** Områdesgeneratorn skriver sina egna
script-taggar och tappar stämpeln, så ordningen är: bygg om, stämpla
sedan. CI kontrollerar med `--kolla` i stället för att skriva.

**`bygg-webp.py` körs INTE i CI**, och det är med flit: en bildkodare
ger inte samma bytes mellan versioner, så `git diff --exit-code` hade
blivit rött av sig självt vid varje uppgradering av cwebp. I stället
vaktar `verktyg/kolla-webp.py` att varje jpg HAR en webp och att den
inte är äldre. En saknad webp går inte sönder — `<picture>` faller
tillbaka på jpg:en — den gör bara den bilden tre gånger tyngre, tyst.

Områdessidorna får **inte** innehålla något som inte är sant: inga
antal, inga betyg, inga "vi har hjälpt N elever i Farsta", inga
okontrollerade skolnamn. Sju sidor som säger samma sak med utbytt
ortnamn är doorway pages, och en påhittad siffra på en sådan sida är
dessutom en påhittad siffra.

**Ämnessidorna** (2026-09-26) finns för sökningar som "läxhjälp matte"
och "läxhjälp kemi", som ingen områdessida svarar på. Samma regel, och
två till: inga betygshöjningar, och inga kursnamn med årtal (gymnasiet
bytte till ämnesbetyg och nivåer, och "Matte 2c" är fel för en del av
eleverna). Det som står om ämnet är vad kursplanen innehåller; det som
står om Nextrum är samma löfte som resten av sajten. Moderna språk, SO
och programmering har ingen sida, för navet säger "fråga i anmälan så
säger vi om vi har rätt person" och en egen sida hade lovat mer.

**Onlinesidan** (2026-09-28, `laxhjalp-online`) svarar på "läxhjälp
online", som ingen sida hade ett ord om fast tjänsten finns. Den byggs
med `amnessida()` men står i `ONLINE`, inte i `AMNEN`: annars hade den
stått som ett ämne under "Läxhjälp per ämne" överallt. Ämnessidorna
länkar dit bland områdena, under rubriken som redan säger "eller
online", och till guiderna längst ner. Sidan säger med flit ingenting
om var i landet eleven får bo, och nämner ingen videotjänst: länken
står "i studievyn", vilket är sant både med och utan Google-kopplingen
(Fas 18.1). Att ta emot familjer utanför Stockholm är ett beslut om
affären; fattas det ska sidan säga det, och inte förr.

**Guiderna** (2026-09-26) svarar på det föräldrar söker innan de vet
att de letar efter läxhjälp, och ska gå att ha nytta av utan att någon
bokar något. Det en guide påstår om forskning eller om andra
organisationer är länkat i `kallor`, och tider står med flit inte med:
de ändras varje termin. Författaren i Article-märkningen är Nextrum,
aldrig ett personnamn.

**Guiden om gratis läxhjälp är borttagen** (2026-09-28). Leo: "på
guider ta bort gratis läxhjälp och skriv andra guider istället". Den
räknade upp biblioteken, Röda Korset och Mattecentrums räknestugor. I
stället kom tre: läsförståelsen, plugga inför prov och när barnet inte
vill göra läxorna. `/gratis-laxhjalp-stockholm` omdirigeras permanent
till navet (`redirects` i `vercel.json`): adressen stod i kartan och i
`GOOGLE.md`:s lista att skicka in, och en adress som stått i kartan
ska inte bli en 404. Provguidens tre källor (Umeå universitet,
Dunlosky m.fl. 2013, SRCD om sömn) är kontrollerade mot sökträffarna,
inte öppnade: nätet i sessionen som skrev dem släppte inte fram sidorna.

**Typsnittet förladdas bara på läxhjälpssidorna och guiderna** (samma
hero med lång rubrik). Utan förladdning bröts navets rubrik om när
typsnittet kom, och bilden under hoppade 57 px (CLS 0,205 i Lighthouse
på mobil, 0,007 efter). På startsidan och prissidan gjorde samma rad
LCP 0,3–0,4 s sämre, eftersom den konkurrerar med herobilden om
bandbredden, och de hade ingen förskjutning att laga. Lägg den inte på
fler sidor utan att mäta.

**Footern har en egen spalt Läxhjälp** med navet, de fyra ämnena och
onlinesidan, på
alla publika sidor och på båda språken. Den ersatte en länk till navet
som stod två gånger i den svenska footern, vilket också var skälet till
nästan alla TEXTNODER-avvikelser i språkbaslinjen.

---

## 9. CI — `.github/workflows/kontroll.yml`

Körs på varje push och PR. Ska vara grön före merge.

1. `node --check` på all JavaScript
2. `node verktyg/testa-agent.js`
3. `verktyg/kolla-betalningsvillkor.py` (betalningslöftet, och att det gamla är borta)
4. `verktyg/kolla-migrationer.py`, och `verktyg/bygg-uppgifter.py --kolla`
   (uppgiftsbankens form, och att den har sin migration)
5. `verktyg/kolla-csp.py`
6. `verktyg/kolla-webp.py`
7. `verktyg/satt-version.py --kolla`
8. Genererade filer är aktuella (bygg om + `git diff --exit-code`):
   maskotsvaren, FAQ-schemat och `sitemap.xml`
9. Språkdiff mot baslinjen — **inklusive attributNAMNEN**, sedan
   `<div role="img" alt="…">` stod på den engelska startsidan där
   svenskan hade `aria-label`. `alt` betyder ingenting på en div, så
   illustrationen var namnlös för skärmläsare på ett av två språk.
   Taggsekvensen var identisk och texten översatt, så verktyget sa ok
10. `deno check supabase/functions/*/index.ts`, `deno test _delad/`

Kör dem lokalt innan du pushar. De är snabba och de fångar exakt det
som annars upptäcks i drift.

**`node --check` prövar bara syntaxen.** Ett namn som inte finns där
det används ger ReferenceError först när raden körs. I adminvyn är det
vanligaste fallet ett namn ur kärnan som aldrig hämtats in ur `NXAdmin`:
auditloggen kraschade från 2026-09-22 till 09-27 på `AVBOKNINGSSKAL`
så fort en avbokning med skäl stod bland raderna, och det syntes bara
som klientfel under System → Fel.

**`.github/workflows/indexnow.yml` är ingen kontroll** (2026-09-26). Den
körs när Vercel rapporterat en lyckad produktionsdriftsättning och
skickar de adresser vars summa i `sitemap.xml` ändrats till IndexNow
(Bing, och därmed ChatGPT:s sökning, Copilot och DuckDuckGo). Nyckeln
ligger i roten som `1ba8bf8c04595e17dff19c8eaf340825.txt` och i
`verktyg/indexnow.py`; den är offentlig med flit. Byts den, byt båda.
Det som återstår för trafiken och bara går att göra med era konton
står i `TRAFIK.md`.

Rapporten från Vercel är sedan 2026-09-27 en `repository_dispatch` av
typen `vercel.deployment.success`, och workflowen skickar bara när
`client_payload.environment` är `production`. Förut var det
`deployment_status` från GitHub-driftsättningarna, som Vercel kallar
föråldrad: slutade Vercel skapa dem hade IndexNow tystnat utan att
någon kontroll blev röd. Payloadens fält (`environment`, `git.sha`,
`git.ref`, `url`, `id`, `project`, `state`) är typade i Vercels eget
paket, `vercel/repository-dispatch` under
`packages/repository-dispatch/src/data/`. Tre saker följer av bytet:

1. **Workflowen körs på main, inte på den driftsatta commiten.** En
   repository_dispatch når bara workflows på default-grenen och körs
   på dess senaste commit; med `deployment_status` var det den
   driftsatta av sig självt. Därför checkas `client_payload.git.sha`
   ut, med `fetch-depth: 2` för jämförelsen med föräldern, och
   körningen blir röd om den inte fick just den commiten. Mergas två
   PR:er tätt kan main redan vara nästa commit när händelsen för den
   första kommer: en utcheckning av main hade då skickat nästa commits
   sidor innan de fanns på nextrum.se, och den förstas aldrig. Av samma
   skäl går en ändring i workflowen inte att prova på en gren.
2. **Bara `success`, aldrig `promoted` också.**
   `vercel.deployment.promoted` kommer för varje befordran till drift,
   automatisk eller manuell, alltså också för samma driftsättning som
   `success`: med båda skickas varje sida två gånger. Efter en
   befordran av en äldre eller en annan driftsättning säger
   jämförelsen med föräldercommiten ingenting om vad som ändrats på
   nextrum.se. Kör då workflowen för hand med `alla`.
3. **En händelse som uteblir syns inte.** Står
   repository_dispatch-händelserna av hos Vercel (avsnitt 2), eller
   slutar Vercel skicka dem, körs ingenting alls. Efter en
   produktionsdriftsättning ska det finnas en körning
   `IndexNow production <commit>` under Actions; saknas den har
   signalen slutat komma.

**`verktyg/rls-test.sql` körs inte i CI** — den behöver en databas.
Kör hela filen som **ett** anrop i SQL Editor eller via `execute_sql`.
Den lägger upp två hjälpare, två familjer, tre barn, pass och en admin,
kör varje behörighetstest i en egen deltransaktion och rullar tillbaka
allt på sista raden. Notistriggern på `bookings` stängs av under
körningen så att fixturpassen aldrig blir ett mejl, och flaggan
`erbjudanden` står av så att timmarna inte betalar dem (Fas 22.2). Svaret är en tabell
`test, ok, detalj` — **varje rad ska vara ok**. Ett villkor som blir
null visas som false sedan 2026-09-28: tre prov stod null i en lista
över ok utan att någon såg det. Kör den efter varje ändring i en policy
eller en trigger.

**Sviten går att köra lokalt** (2026-09-30): `verktyg/lokal-databas.sh`
bygger databasen i Docker (`supabase/postgres`) ur arkivet och alla
migrationer, i README:ns ordning, och kör hela `rls-test.sql` mot den, på
ungefär 20 sekunder. Första körningen gav 923 av 923, samma som driften.
Det bilden saknar av Auth och Storage står i `verktyg/lokal-databas.sql`.
`STOPP=<migration>.sql` bygger till och med den migrationen, så att samma
svit går att köra med och utan en ny migration. Lokalt först; driften
bara när något där måste provas. I en molnsession går Docker att starta
med `dockerd &`.

**Deno i en molnsession** (2026-09-30): `deno.land` och `esm.sh` är
stängda i nätet, men npm och jsr är öppna. `npm i deno@2` ger binären,
och en importkarta utanför repot som pekar
`https://esm.sh/@supabase/supabase-js@2.116.0` på `npm:` och
`https://deno.land/std@0.224.0/assert/mod.ts` på `jsr:@std/assert@0.224.0`
räcker för `deno check --import-map=…` och `deno test --import-map=…`.
Checka inte in kartan: CI når båda adresserna.

**Filen är för stor för ett enda `execute_sql` från en session** (350
kB). Låt databasen hämta den själv, i en transaktion som rullas
tillbaka: `begin; create extension if not exists http with schema
extensions;`, sedan ett do-block som hämtar filen (och en ny migration)
från `raw.githubusercontent.com` på en commit, inte en gren, prövar
md5, tar bort raden `begin;`, slutraden och `rollback;`, och kör dem
med `execute`. Sist `select … from utfall` och `rollback;`, som tar
tillägget med sig. Så provades Fas 22.4: hela filen med migrationen,
och utan den, mot driften, utan att något blev kvar.

**Kör hela filen, inte bara ditt eget avsnitt.** 2026-09-27 hade den
varit röd sedan förmiddagen utan att någon sett det, för varje session
provade sin egen del för sig. Fas 19.2 gjorde kortspärren omöjlig att
slå på, och elva äldre prov som slog på den föll med 23514; de lyfter nu
villkoret i sin egen deltransaktion (`pg_temp.sparren_pa()`), så att
koden hålls i form till den dag villkoren går tillbaka till betalning
före passet. Fas 19.5 flyttade sitt pass till i går klockan 10 hos
studiehjälpare A, där fixturen från Fas 14.2 redan stod, och krockade
med `bookings_tutor_slot_unique` i varje hel körning. En fixtur i
huvudtransaktionen syns för allt som kommer efter den i filen.
2026-09-28 igen: blocket för Fas 9.3/9.4 avbokar b0d1 på riktigt, och
b6c1 från Fas 14.6 står bekräftat och obetalt, så sex prov för
timmarna (22.1–22.3) föll i varje hel körning. Fixturerna ställs nu
tillbaka överst i avsnittet för 22.1.
