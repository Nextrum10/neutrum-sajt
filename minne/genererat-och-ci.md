# Genererade filer, sidornas innehåll och CI

Arkivet för avsnitt 8 och 9 i `CLAUDE.md`, ordagrant. Reglerna står i kärnan, `CLAUDE.md`;
"avsnitt N" i texten är kärnans.

---

## 8. Genererade filer — ändra aldrig för hand

| Fil | Byggs av | Ur |
|---|---|---|
| `nextrum-maskot-svar.js` | `verktyg/bygg-maskotsvar.py` | `faq.html`, `en/faq.html` |
| FAQPage-märkningen i `faq.html` och `en/faq.html` | `verktyg/bygg-faq-schema.py` | frågorna på sidan |
| `laxhjalp-*.html` (6 stadsdelar, 4 ämnen, 3 stadier, online), de fyra guiderna, `404.html` och ämnes-, stadie- och guidekorten i `laxhjalp-stockholm.html` | `verktyg/bygg-omradessidor.py` | skalet läses ur `var-ide.html`, alt-texten ur `nextrum-images.js` |
| `sitemap.xml` | `verktyg/bygg-sitemap.py` | sidornas canonical, hreflang och noindex |
| Ikonlänkar och storlekar | `verktyg/satt-logga.py` | `bilder/nextrum-logo.png` — finns inte i dag; PNG:erna är renderade ur `favicon.svg`, se `GOOGLE.md` |
| `bank/*.png` (övningsbladen) | `verktyg/bygg-banken.py` | bladen står i klartext i `verktyg/bladen/` (en modul per stadium, en per NP-serie: `np_ak6.py`, `np_ak9.py`, `np_gymnasiet.py`, figurerna i `figurer.py`). Körs för hand (kräver Chromium), inte i CI; verktyget mäter varje sida och vägrar ett blad som inte ryms. `python3 verktyg/bygg-banken.py ak4-` ritar bara de bladen. `--sql <mönster>` ger raderna till `biblioteksmaterial`, och ett nytt blad är en NY migration med bara de nya raderna; `--kolla` visar vad som saknar bild, facit eller migration. Facit står i `verktyg/bladen/facit_<modul>.py` (ett svar per uppgift) och ritas med `--facit` till `bank/facit/*.png`, en sida per blad; ryms inte frågorna tas de bort, sedan blir stilen mindre. Länkarna till andras material (provgruppernas sidor) står i `verktyg/bladen/lankar.py`, ritas inte, och kommer med i `--sql` när namnet matchar. Ett blads id kommer ur filnamnet: ändra aldrig `fil` på ett befintligt blad, en rättelse är en ny PNG och ingen ny rad |
| `?v=`-stämplarna på alla script- och link-taggar | `verktyg/satt-version.py` | filernas egen md5 |
| `bilder/*.webp` | `verktyg/bygg-webp.py` | `bilder/*.jpg` |
| `bilder/intro-*.jpg` och `.webp` (introduktionens skärmdumpar, 2026-10-06) | `verktyg/bygg-introbilder.js` | studievyn och studiehjälparvyn, i Chromium mot en falsk Supabase med påhittade familjer (Anna och Alva Andersson, Karin och Kim Karlsson, studiehjälparen Sara Svensson) och klockan på tisdag 13 oktober 2026 kl. 15.30. Körs för hand när en del som en bild visar ändras, inte i CI (Chromium och Pillow, och en kodare ger inte samma bytes mellan versioner). Ett anrop till driften stoppar verktyget. `--mapp` sparar PNG:erna för den som vill titta först; utan Pillow blir det inga bilder. `kolla-webp.py` vaktar att varje jpg har sin webp |
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

**Områdessidorna har eget innehåll först** (2026-10-06). En genomgång
mätte dem med ortnamnet utbytt: 53–68 % av meningarna och 289 ord stod
likadant på alla sex, och titel och beskrivning skilde sig bara i
namnet. Nu börjar varje sida med det som bara gäller där: en ingress med
områdets ändpunkter, trafiken, biblioteken som neutral plats och en
fjärde fråga om just dem, och beskrivningen nämner delområden och
bibliotek. Det delade är kort: en mening om hur det går till med länk
till Så fungerar Nextrum, och priset i ett stycke (`prissektion_kort()`;
ämnes- och stadiesidorna har kvar den långa). Efter: 41–55 % av
meningarna och 193 ord gemensamt, nästan bara knappar, kort och
rubriker. Lägg inte till Kungsholmen, Vasastan eller Östermalm förrän de
har lika mycket eget att säga.

Biblioteken (`bibliotek` per område) är kontrollerade mot bibliotekens
egna sidor i sökträffarna 2026-10-06, inte öppnade: nätet släppte inte
fram dem. Saltsjöbanan har inte gått från Slussen sedan 2016 (sträckan
väntas öppna igen tidigast 2028), så Nackas text nämner den inte, och
Nockebybanan går från Alvik, inte Brommaplan. Hammarbys fråga om
kvällstider sa sju till tio; vyn tillåter 11–22 på vardagar och 9–22 på
helger (`HELA_DAGEN`).

**Stadiesidorna** (2026-10-06), `/laxhjalp-mellanstadiet`, `-hogstadiet`
och `-gymnasiet`, byggs med `amnessida()` ur `STADIER`. Samma regler som
ämnessidorna, och ingen betalningsmening: priset står kort och länkar
till prissidan, så `kolla-betalningsvillkor.py` behöver inte bevaka dem.
Navet, ämnessidorna och startsidan länkar dit.

**Tre ämnessidor och lågstadiet till** (2026-10-07): `/laxhjalp-so`,
`-moderna-sprak`, `-programmering` och `-lagstadiet`. Ämnena stod i
`NX.AMNEN` (det familjen kan be om i anmälan) men hade ingen sida, och
sajten lovade redan hjälp "från ettan" utan en sida för lågstadiet. Prisfrågan
länkar till prissidan som stadiesidornas, så betalningsmeningen och
`kolla-betalningsvillkor.py` berörs inte. Footern har kvar de fyra första
ämnena; de nya nås från navet och från ämneskorten på varje landningssida,
som generatorn lägger till av sig själv.

**`404.html`** (2026-10-06) byggs också här, för att få skalet. Vercel
visar den för varje adress som inte finns, också `/en/x/y`, så den har
`<base href="/">`: skalets länkar till css och skript är relativa.
`satt-version.py` stämplar bara relativa adresser, så en absolut
`/nextrum.css` hade blivit ostämplad. Den är noindex utan canonical och
står inte i kartan; i språkbaslinjen står den bland sidorna utan
engelsk tvilling, som stadiesidorna.

**Footern har en egen spalt Läxhjälp** med navet, de fyra ämnena och
onlinesidan, på
alla publika sidor och på båda språken. Den ersatte en länk till navet
som stod två gånger i den svenska footern, vilket också var skälet till
nästan alla TEXTNODER-avvikelser i språkbaslinjen.

**Guiderna är tio, i tre grupper** (2026-10-07): För er som hjälper till
hemma (de fyra första), Under läsåret (nationella proven i sexan och i
nian, efter sommarlovet och inför terminsbetyget) och Att välja läxhjälp
(vad läxhjälp kostar, läxhjälp eller privatlärare). `grupp` i `GUIDER`;
navet visar en sektion per grupp, och en guide visar sin egen grupp
först bland Fler guider, högst sex. Samma regler som förut: det en guide
påstår om skolan, proven eller skatten är länkat i `kallor`, och tider
står inte med. Provguiderna säger att de muntliga delarna görs på hösten
och de skriftliga på våren och länkar Skolverkets provdatum, aldrig
datumen; deras beskrivning av proven är densamma som i NexLäx
(`NP_INFO`), och länkarna till provgrupperna är materialbankens
(`lankar.py`). Rutavdraget för läxhjälp togs bort 2015 (den 1 augusti
enligt sökträffarna; guiden säger bara året och länkar Skatteverkets
lista), utvecklingssamtalet
nämns utan hur ofta det hålls (en gång per termin blir en gång per läsår
2028), och ingen guide lovar ett betyg. Källorna är kontrollerade mot
sökträffarna 2026-10-07, inte öppnade: nätet släppte inte fram
Skolverket eller Skatteverket.

**Sidan för utlandsfamiljer** (2026-10-07, `en/tutoring-stockholm`) finns
bara på engelska, är byggd på den engelska Vår idé:s skal och har ingen
hreflang="sv". Den lovar inte pass på engelska, bara att vi säger före
bokningen om vi har någon som kan hålla dem på engelska, och säger att
familjens vy är på svenska. Sidfoten länkar dit, "In English", på alla
öppna sidor och på båda språken, i samma tagg, så språkdiffen inte ser
någon skillnad. De engelska sidorna har `og:locale` `en_GB` (de hade
`sv_SE`).

**Delningsbilderna** (2026-10-07, `delning/`, `verktyg/bygg-delningsbilder.js`):
en bild per sida i kartan, 1200 × 630, med sidans foto, rubriken och en
rad med priset (en guide säger Guide för föräldrar, jobbsidan och
villkoren inget pris). Fotot är det sidan delade förut och står sedan
kvar i `delning/innehall.json`. Generatorn och de handskrivna sidorna
pekar `og:image` och `twitter:image` dit. Byggs för hand med Chromium;
mallen serveras från samma origin som typsnittet, annars ritas bilden
med reservtypsnittet. `kolla-delningsbilder.py` fäller CI om en sida i
kartan saknar sin bild, om rubriken i bilden inte är sidans `<h1>` eller
om priset inte är `PRIS_PER_TIMME`: en delningsbild med fel pris är
samma sak som en sida med fel pris.

**Orden på de öppna sidorna** (2026-10-07, resten av genomgången av
nextrum.se). Knappen till intresseanmälan heter Skicka intresseanmälan
överallt utom i heron, där den står bredvid Bli studiehjälpare och
därför heter Intresseanmälan för läxhjälp (Get started och Get tutoring
på engelska); i menyn och sidfoten heter den bara Intresseanmälan. Vårt
eget språk står inte där en familj eller en sökande läser: underlag,
tabell, API, databasen. Regeln att ett pass är genomfört först när
rapporten finns är vår; den står i villkoren och där rapporten förklaras
(Så fungerar Nextrum, För elever och föräldrar), inte i generatorns svar.
Starterbjudandet står på prissidan, i FAQ:n och i generatorns prisdelar,
alltid med villkoret bokade timmar (`minne/betalning.md`). Hemma eller
online väljer familjen för varje pass; matchningen avgör bara om någon
kan ta sig hem till dem. Priset gäller den tid passet höll, per påbörjad
kvart, så ingen sida lovar hela kostnaden innan ni bokar.

---

## 9. CI — `.github/workflows/kontroll.yml`

Körs på varje push och PR. Ska vara grön före merge.

1. `node --check` på all JavaScript
2. `node verktyg/testa-agent.js`
3. `verktyg/kolla-betalningsvillkor.py` (betalningslöftet, och att det gamla är borta)
4. `verktyg/kolla-migrationer.py`, och `verktyg/bygg-uppgifter.py --kolla`
   (uppgiftsbankens form, och att den har sin migration)
5. `verktyg/kolla-csp.py` (fyra vyer sedan `/barn`, och `/lank` sedan
   2026-10-01), och
   `verktyg/kolla-behorigheter.py`: adminbehörigheterna står lika i
   migrationen (villkoret och `intern.admin_behorigheter()`), i
   `_delad/adminbehorighet.ts` och i `nextrum-admin-behorighet.js`, och
   barnens användarnamn och domän prövas lika i databasen, `barn-konto`,
   inloggningen (`nextrum-studie.js` sedan 2026-10-01, delad av alla
   fyra vyerna) och föräldrarnas ruta (barnkonton_och_admin), och
   barnets sex behörigheter (2026-10-06) står lika i migrationen
   (`intern.barn_behorigheter_alla()`, villkoret, förvalet och
   återställningarna), i studievyn (`BARN_FÅR`, `BARN_FÅR_FÖRVAL`) och i
   barnets vy (`FÅR`)
6. `verktyg/kolla-webp.py`, och `verktyg/kolla-mejltexter.py` (2026-10-05):
   nejet som läget Avböjd visar (`NEJ_MEJLET` i
   `nextrum-admin-rekrytering.js`) är samma som mejlet (`NEJ` i
   `_delad/notiser/ansokan.ts`), fält för fält, och `verktyg/kolla-villkor.py`
   (2026-10-07): användarvillkorens datum, på båda språken, är versionen i
   `intern.villkor_version()` i den senaste migrationen som skriver den
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

**Sviten ser bara det den skriver själv** (2026-09-30). Ett prov som
lägger en färdig rad i `auth.users` med en INSERT säger ingenting om
GoTrue, som skriver raden först och resten i UPDATE efteråt: barnkontona
var gröna här (1139 av 1139) och gick ändå inte att skapa i driften. Prova
det Auth gör i Auths ordning (avsnitt 7b), och prova hela kedjan mot
riktiga Auth innan något kallas klart. Två andra saker driften lärde
samma kväll: `auth.sessions.id` har inget förval där, och ett prov som
lägger en faktura på "förra månaden" krockar med en fixtur som gör
detsamma när sviten körs den första i månaden (Fas 19.6 står därför på
januari 2025). `lokal-databas.sql` fick `phone_change_sent_at` och
`reauthentication_sent_at`, som bilden saknade och driften har.

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
Enklare sedan 2026-10-06 (barnets_chatt): ett enda do-block utan `begin;`
och `rollback;`, som hämtar filen med `extensions.http_get`, prövar md5,
tar bort filens `begin;`, slutraden och `rollback;`, kör den med
`execute`, räknar `utfall` och slutar med `raise exception 'RESULTAT % av
% gröna. FEL: %'`. Felet rullar tillbaka allt, tillägget behöver inte
skapas (det står i `extensions`), och svaret står i felmeddelandet.

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

### Webbläsarproven för intaget och introduktionen (2026-10-06)
Byggda som de nedan, med egna portar. `verktyg/prova-intag.js` (8969):
Ta in familjen på en anmälan (knappen och rutan heter så när kontot
saknas, rutan säger att ett mejl går, `bjud-in` får anmälans adress, namn
och anmälan, och sedan kopplas anmälan och eleven skapas på det nya
kontot, i den ordningen, och kvittot; och när eleven inte gick att skapa
efter kontot heter knappen Skapa elev och bjuder inte in igen, för
`medan()` ställer annars tillbaka den gamla texten), Ta in i poolen med Skapa kontot
förvalt (`roll: 'tutor'` före godkännandet, kvittot) och med ett konto som
fanns (ingen inbjudan, som förut), och Skicka inbjudan igen i personens
panel (en ny inbjudan och en länk för lösenordet; sedan 2026-10-07 också
Skicka länk för lösenord för den som loggat in). `verktyg/prova-introduktion.js` (8967): rutan för
lösenordet utan Inte nu efter en inbjudan och med `valkommen =
'losenord'`, att lösenordet sparas med `valkommen: 'intro'`,
introduktionen i studievyn (sju bilder) och studiehjälparvyn (åtta),
med och utan väntläge, att sista bilden säger var man loggar in nästa
gång (2026-10-07), att Fortsätt leder in och tar bort välkomsten,
Visa introduktionen under Profil (med Stäng), reserven utan
bildregistret, att knappen står still mellan bilderna på dator, telefon
och liten telefon (360 × 740), och mörkt läge. `prova-aterstallning.js`
följde med: rutan för en inbjudan heter Skapa ditt lösenord och har inget
Inte nu. `prova-barnkonton.js` har `provaBarnetsBehörigheter`: rutorna
när inloggningen skapas, på och av i kortet, och barnets vy med varje del
av, med main:s fem delar (Översikt, flikarna under Mina lektioner, tråden
och notiserna under Meddelanden).

Kör inte alla webbläsarprov samtidigt: under den lasten hann
ansökningsformulärets animation inte stanna innan `prova-ansokningar.js`
klickade, och provet kraschade på ett val som inte bytte läge (2026-10-06;
ensamt gröna två gånger av två, både på main och på grenen).

### Webbläsarprovet för användarvillkoren (2026-10-07)
`verktyg/prova-villkor.js` (8971), byggt som provet för introduktionen,
mot en falsk Supabase som kan `mitt_villkorslage`, `godkann_villkor` och
registreringen: rutan efter lösenordet och före introduktionen för den vi
tagit in (familj och studiehjälpare), att den inte går att stänga men att
Logga ut finns, att inget sparas utan kryss och att versionen skickas, att
länkarna ser ut som länkar och öppnas i en ny flik, rubriken för ändrade
villkor, ingen ruta för den som godkänt eller när funktionen saknas, och
(sedan 2026-10-07) att Skapa konto är borta i båda vyerna, att inloggningen
är densamma där, och att kontot avgör vyn: en studiehjälpare på
`/foralder` hamnar på `/larare` och en förälder på `/larare` på
`/foralder`, utan att studsa. Tryckytorna mäts med `offsetHeight`: rutan glider fram med en skala.
`prova-intag.js` provar raden i adminvyns panel.

### Webbläsarprovet för familjens faktura (2026-10-06)
`verktyg/prova-fakturor.js` är byggt som de nedan (egen port, 8964), med
klockan fast på 6 oktober 2026 (`page.clock.setFixedTime`): en rad per
familj och månad under Betalningar → Fakturor, oktobers faktura som
samlas och septembers utkast med det sena passet, att familjens namn
fäller ut passen med dag, klocka och studiehjälpare, att Skapa nu torrkör
i bakgrunden och visar vad innan det skarpa anropet, familjens panel,
Månadens ekonomi, en telefon, och samma rader med schemat av.

### Webbläsarprovet för ansökan under 18, nejet och det admin sett (2026-10-05)
`verktyg/prova-ansokningar.js` är byggt som de två nedan (egen port, 8963):
vårdnadshavarens fält i formuläret på båda språken och vad som skickas,
reserven när kolumnen saknas, rutan som visar nejet innan läget blir Avböjd,
godkännandet i ansökan, frågan i Ta in i poolen, och att siffran vid
Ansökningar och Intresseanmälningar går bort när sektionen visats, med och
utan tabellen `admin_sett`.

### Webbläsarprovet för barnkontona och adminbehörigheterna (2026-09-30)
`verktyg/prova-barnkonton.js` kör barnets vy, NexLäx i barnets vy och
e-post eller användarnamn i alla fyra inloggningarna (2026-10-01),
föräldrarnas ruta, barnets egen e-post (barnets_epost: förälderns del,
barnets inställningar, länken i bekräftelsen och inloggningen med
adressen) och adminvyn med behörigheter i Chromium, mot en
falsk Supabase på
`https://supabase.test` (`nextrum-config.js` byts i farten, Realtime
fångas, och ett anrop till den riktiga adressen stoppas och fäller
provet). Det ligger inte i CI: Playwright är ingen del av repot.
Kör det lokalt, med bilder i en mapp om du vill se dem:

    NODE_PATH="$(npm root -g)" node verktyg/prova-barnkonton.js /tmp/bilder

En vy är lång, och en helsidesbild av den svår att läsa. `bild()` tar
därför ett tredje argument, en väljare, och sparar då också bara den delen
(`<namn>-del.png`).

Det är ingen `_prov-*`-bänk: det serverar ingen sida, och `/verktyg`
står i `.vercelignore`.

`verktyg/prova-aterstallning.js` (Glömt lösenordet, 2026-09-30) är byggt
likadant och provar läget i inloggningsrutan i alla tre vyerna, vad som
skickas till `/auth/v1/recover` och vilket besked varje svar från Auth
ger, rutan för nytt lösenord när vyn öppnas med länkens adress, rutan
för en inbjudan i studievyn och studiehjälparvyn (2026-10-01), en länk
som gått ut, startsidan som skickar länken vidare, modulvakten mot en
gammal `nextrum-studie.js`, och `/lank` (2026-10-01): mallens länk kodad
som Supabase kodar den, knappen hela vägen genom en falsk `verify` till
vyn, och att allt annat än vårt Supabase blir "Länken är inte hel".
Samma körsätt, egen port (8962).

