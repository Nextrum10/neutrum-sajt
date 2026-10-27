# Genererade filer, sidornas innehåll och CI

Arkivet för avsnitt 8 och 9 i `CLAUDE.md`, ordagrant. Reglerna står i kärnan, `CLAUDE.md`;
"avsnitt N" i texten är kärnans.

---

## 8. Genererade filer — ändra aldrig för hand

| Fil | Byggs av | Ur |
|---|---|---|
| `nextrum-maskot-svar.js` | `verktyg/bygg-maskotsvar.py` | `faq.html`, `en/faq.html` |
| FAQPage-märkningen i `faq.html` och `en/faq.html` | `verktyg/bygg-faq-schema.py` | frågorna på sidan |
| `laxhjalp-*.html` (34 orter, 6 ämnen, 4 stadier, online), de tio guiderna, `404.html` och ämnes-, stadie- och guidekorten och ortskatalogen i `laxhjalp-stockholm.html`, och ortslistan i `nextrum-affisch.js` (2026-10-27, mellan markeringarna `orter`) | `verktyg/bygg-omradessidor.py` | skalet läses ur `var-ide.html`, alt-texten ur `nextrum-images.js` |
| `sitemap.xml` | `verktyg/bygg-sitemap.py` | sidornas canonical, hreflang och noindex |
| `favicon.svg`, `favicon-48.png`, `favicon-96.png`, `apple-touch-icon.png`, `bilder/nextrum-logo-512.png`, `bilder/nextrum-logo-profil.png`, `bilder/nextrum-logo-bimi.svg` | `verktyg/bygg-logga.js` | märkets två vägar i `bilder/nextrum-logga.svg`, loggan spårad ur Leos bild 2026-10-15. Körs för hand (Chromium), inte i CI. PNG:erna står på papperet ända ut i kanten; profilbilden och BIMI har märket mindre, för Gmail beskär till en cirkel. Sidornas inline-svg skrivs inte härifrån (`CLAUDE.md` avsnitt 3). Ikonlänkarna står på alla sidor och läses av områdesgeneratorn ur `var-ide.html`; `satt-logga.py` (sips, bara på en Mac) togs bort samma dag |
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
står om Nextrum är samma löfte som resten av sajten. Moderna språk och
SO hade ingen sida, för navet sa "fråga i anmälan så säger vi om vi har
rätt person" och en egen sida hade lovat mer; sedan 2026-10-07 har de
det (nedan). Programmering erbjuds inte alls (Leo, 2026-10-07).

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
(`redirects` i `vercel.json`): adressen stod i kartan och i
`GOOGLE.md`:s lista att skicka in, och en adress som stått i kartan
ska inte bli en 404. Först till navet, sedan 2026-10-12 till
`/vad-kostar-laxhjalp`: Google visade fortfarande guidens gamla titel,
och den som söker gratis läxhjälp undrar vad det kostar, vilket
kostnadsguiden svarar på och navet inte gör. En omdirigering till en
sida om något annat kan Google dessutom räkna som en sida som inte
finns. Hur träffen byts ut står i `GOOGLE.md`. Provguidens tre källor (Umeå universitet,
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

**Två ämnessidor och lågstadiet till** (2026-10-07): `/laxhjalp-so`,
`-moderna-sprak` och `-lagstadiet`. Ämnena stod i `NX.AMNEN` (det
familjen kan be om i anmälan) men hade ingen sida, och sajten lovade
redan hjälp "från ettan" utan en sida för lågstadiet. `/laxhjalp-programmering`
byggdes samma dag och togs bort samma eftermiddag: Nextrum erbjuder inte
programmering (Leo). Adressen hade stått i kartan, så den omdirigeras
till navet i `vercel.json`. Prisfrågan
länkar till prissidan som stadiesidornas, så betalningsmeningen och
`kolla-betalningsvillkor.py` berörs inte. Sedan 2026-10-13 står alla
ämnen, stadier, områden och guider i footerns block Läxhjälp (nedan); de
nås också från navet och från ämneskorten på varje landningssida, som
generatorn lägger till av sig själv.

**Intresseanmälan tre gånger på varje landningssida** (2026-10-09, Leo: "på
alla landningssidor ska det finnas flera intresseanmälan knappar för
läxhjälp"). Förut stod knappen i innehållet bara i Nästa steg längst ner,
efter FAQ och korten. Nu står den också under ingressen (`hjalte()`) och
mitt på sidan: efter priset (`prissektion()`, `prissektion_kort()`) och i
guidernas textdel, där länken i löptexten blev en knapp (`ANMAL_KNAPP`,
`ANMAL_MITT`). De två handskrivna, navet och `en/tutoring-stockholm`, har
samma knapp i toppen och efter priset, och navet en till under de tre
stegen. Ingen knapp per sektion: tre i innehållet och en i sidhuvudet räcker.

**`404.html`** (2026-10-06) byggs också här, för att få skalet. Vercel
visar den för varje adress som inte finns, också `/en/x/y`, så den har
`<base href="/">`: skalets länkar till css och skript är relativa.
`satt-version.py` stämplar bara relativa adresser, så en absolut
`/nextrum.css` hade blivit ostämplad. Den är noindex utan canonical och
står inte i kartan; i språkbaslinjen står den bland sidorna utan
engelsk tvilling, som stadiesidorna.

**Footern har ett block Läxhjälp längst ner** (`.ftr-lax`, 2026-10-13) med
alla läxhjälps- och guidesidor i fyra grupper, på alla publika sidor och på
båda språken (`minne/vyerna.md`). Det ersatte spalten Läxhjälp (navet, fyra
ämnen och onlinesidan), som i sin tur ersatte en länk till navet som stod två
gånger i den svenska footern, vilket också var skälet till nästan alla
TEXTNODER-avvikelser i språkbaslinjen. Generatorn läser blocket ur
`var-ide.html`; de handskrivna sidorna ändras för hand, och
`utbildningsprov.html`, som saknade två länkar, fick samma block (sidan
togs bort 2026-10-21, med provet i ansökan). "Hammarby
Sjöstad" stod i baslinjen som svenska kvar i engelskan på varje engelsk sida
till 2026-10-26, då gruppen Område blev navets regioner (nedan).

**Orterna** (2026-10-26, Leo: "Lägg även till landningssidor för varje ort i
Stockholm"). Till de sex första kom 24: stadsdelarna i Stockholms stad som
saknade en sida (Kungsholmen, Vasastan, Östermalm, Hägersten och Liljeholmen,
Älvsjö, Skärholmen, Enskede, Årsta och Vantör, Skarpnäck, Vällingby och
Hässelby, Spånga och Tensta, Kista och Rinkeby) och de kommuner i länet som
gick att kontrollera (Sundbyberg, Danderyd, Täby, Lidingö, Sollentuna,
Vallentuna, Österåker (borttagen 2026-10-27, nedan), Huddinge, Botkyrka, Salem, Södertälje (borttagen 2026-10-27, nedan), Järfälla och
Upplands Väsby). Varje ort har lika mycket eget som de första: delarna,
trafiken, biblioteken och två egna frågor, och två av de gemensamma (`F_*`),
olika för grannar. Trafiken och biblioteken är kontrollerade genom sökträffar
(kommunernas och bibliotekens egna sidor och Wikipedia), inte öppnade: nätet
släppte inte fram sidorna. Vasastan nämner inget eget bibliotek (Stadsbiblioteket
är stängt för renovering).
**De sista kommunerna** (2026-10-27, Leo: "Fixa nya bilder osv om du kan" och
"De ska också vara snygga, bra för SEO och funktionella"): Sigtuna, Upplands-Bro
och Ekerö i Norr och väster om stan, Nykvarn, Haninge, Tyresö, Nynäshamn och
Värmdö i Söder och öster om stan (Nykvarn och Nynäshamn borttagna samma dag, nedan). Kontrollerade på samma sätt, och det som källorna inte bar står
inte där: inga linjenummer, restider eller turtätheter (källorna gick isär,
och de ändras utan att någon säger till), ingen pendelbåt till Ekerö (bara en
gammal sammanfattning), inget om SL-kortet på Mälartåget till Nykvarn (det var
ett förslag), och inget meröppet bibliotek som självklar plats för ett pass:
utan personal kommer bara den som är 18 och registrerad in (Tyresös filialer,
Hemmesta). Nykvarns bibliotek stod som "biblioteket på
Centrumvägen", för namnet fanns bara i en katalog från 2011. Nynäshamns
huvudbibliotek renoverades hösten 2026, så sidan bad familjen kolla
öppettiderna. **Sidrensningen** (samma dag): Leo bockade av en checklista med
alla sidor i sitemapen (en artefakt som sparar valen i sig själv) och tog bort
Vaxholm och Norrtälje, som byggts samma dag och aldrig gått ut, och Österåker,
som varit ute sedan #341. Österåkers adress leder till navets region
(`/laxhjalp-stockholm#norr-och-vaster`, en permanent omdirigering i
`vercel.json`), för en adress som stått i kartan blir aldrig en 404; delningsbilden
och raden i `delning/innehall.json` gick med sidan. Startsidan, intresseanmälan,
priser, FAQ, navet och villkoren stod låsta i listan. Navets `areaServed`
(handskriven, i `laxhjalp-stockholm.html`) nämnde ändå alla tre en timme till,
och sa till Google att vi åker dit (Leo: "österåker ska inte finnas med"); nu
stannar generatorn om den listan nämner en kommun utan ortssida
(`prova_navets_omraden()`). Samma förmiddag tog Leo bort Södertälje (ute
sedan #341), Nykvarn och Nynäshamn (ute sedan #342) också ("nykvarn,
nynäshamn, södertälje ska också bort"): de leder till Söder och öster om stan
(`/laxhjalp-stockholm#soder-och-oster`), Botkyrka, Salem och Haninge fick nya
grannar, och sitemapen har 80 adresser. Huddinges och Haninges trafik nämner
fortfarande pendeltåget mot Nynäshamn, för det är linjens namn. Ska en av de
sex orterna tillbaka står posten med kontrollerade fakta i `OMRADEN` i
4af8bea. En ny ort läggs in som en post i `OMRADEN` med
`region` och `grannar`; generatorn vägrar en granne som inte finns, en region
som inte finns, en regionrad som nämner en ort utan sida
(`prova_regionraderna()`) och två orter med samma par av allmänna frågor
(`prova_fragorna()`).

**Hur lika ortssidorna är** (2026-10-27). Av texten i `<main>` står 15 till 27
procent bara på den egna sidan (femordsföljder), resten är mallen: priset,
ämneskorten, Så går det till och de allmänna frågorna. Det är vanligt för
ortssidor, och Google räknar bort mall som står likadant på många sidor, men
de mest lika paren (Spånga och Tensta mot Sollentuna, 59 procent) hade samma
två allmänna frågor. Varje ort har sedan dess ett eget par (55 finns), och
inget par av ortssidor delar mer än 49 procent. Mer eget kommer bara ur fler
kontrollerade fakta om orten, aldrig ur fler ord. Följ sidorna i Search
Console: en ort som Google inte visar efter några månader slås hellre ihop med
sin region.

**Länkarna i löptexten** (2026-10-27). "Så fungerar det, steg för steg", "Se hela
prissidan", "vad läxhjälp kostar" och "FAQ-sidan" stod i textens egen färg och
utan understrykning på 53 genererade sidor och navet, så ingen kunde se att de
gick att trycka på (WCAG 1.4.1). Cinema stryker under dem (`.nx-text p a`,
`.faq ~ .xsmall a`, `.nx-note a` och `.nx-page-hero .xsmall a`), som FAQ-svarens
länkar. Ett prov i Chromium som letar efter länkar i löptext med samma färg,
vikt och ingen understrykning som texten runt om hittade dem; det står inte i
CI.

**Navet har en ortskatalog** (`#orter`, mellan `ORT_START` och `ORT_SLUT` i
`laxhjalp-stockholm.html`): orterna i fem regioner (Innerstaden, Söderort,
Västerort, Norr och väster om stan, Söder och öster om stan), i svensk
bokstavsordning, med ankarna `#innerstaden`, `#soderort`, `#vasterort`,
`#norr-och-vaster` och `#soder-och-oster`. Footerns grupp Område länkar till
ankarna i stället för till varje ort, och ämnes- och stadiesidorna visar ett
kort per region (`regionkort()`). En ortssida länkar till sina grannar och
till navet (`andra_omraden()`), inte till alla andra. Byter ett ankare namn
ändras footern på alla sidor med det.

**Titeln och beskrivningen** (2026-10-26). En förhandsvisning av sökträffarna
visade att Google kortade beskrivningen på 24 av 52 sidor och titeln på två,
och att det som föll bort på nio läxhjälpssidor var priset, som stod sist.
`verktyg/textbredd.py` mäter texten i Arial som Google ritar den (titeln i 20
px, beskrivningen i 14 px), och `kolla-titlar.py` fäller CI när en titel är
över 600 px eller en beskrivning över 920 px, när två sidor har samma titel
eller beskrivning och när `og:` eller `twitter:` säger något annat än sidan.
Generatorn skriver mot 580 och 900 px och stannar annars, och ortssidornas
titel väljs av `omradestitel()`: med pris och "hemma eller online" när den
får plats, annars med det ena. Läxhjälpssidornas beskrivningar börjar med
orten eller ämnet och priset. Titlarna slutar på " | Nextrum" på alla öppna
sidor. Startsidans titel säger idén (Läxhjälp av unga, för unga i
Stockholm), så att den inte tävlar med navet om "läxhjälp Stockholm", och prissidan och guiden om vad läxhjälp
kostar säger olika saker. Erbjudandet i JSON-LD är timpriset, som på
prissidan (det stod 379, paketens pris).

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
kvar i `delning/innehall.json`; de genererade sidorna har inget foto där
sedan 2026-10-26 och tar heron, som generatorn väljer per sida (ett ämne,
ett stadium eller en ort har sitt eget foto i stället för samma tre överallt),
och en ortssida säger "Hemma eller online" i stället för "Läxhjälp i
Stockholm" under rubriken. Generatorn och de handskrivna sidorna
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
3. `verktyg/kolla-betalningsvillkor.py` (betalningslöftet, och att det gamla är borta; `KORTET_RESERVERAS`
   väljer meningen efter strömbrytaren `kortreservation`. Fakturameningen, meningen om de obetalda
   passen och "tio dagar" står bland det gamla sedan 2026-10-21, då fakturan togs bort)
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
   `_delad/notiser/ansokan.ts`), fält för fält, och sedan 2026-10-21 också
   intervjumejlet (`INTERVJU_MEJLET` mot `INTERVJU` i
   `_delad/notiser/intervju.ts`), och `verktyg/kolla-villkor.py`
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

**Docker Hub kan svara 429** på `supabase/postgres`; samma bild finns som
`public.ecr.aws/supabase/postgres:15.8.1.085` (samma id), och `PORT=… NAMN=…`
låter två sessioner bygga var sin databas samtidigt (2026-10-07).

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

**Driftens provfrågor stängs av i sviten** (2026-10-20). Den första
körningen mot driften efter att utbildningsprovet fått sina frågor gav
1706 av 1772: med minst fem aktiva frågor spärrar `intern.provet_sparrar`
varje studiehjälpare utan godkänt prov, och fixturernas studiehjälpare
har inget, så varje prov där en studiehjälpare skriver en rapport, bokar
eller ser sina elever föll på policyn "utbildningsprovet först", och
avsnitt 41, som räknar med noll frågor, fick "Svara på alla frågor". En
lokal databas har inga frågor och gick igenom. Sviten stänger nu av alla
aktiva frågor och sätter `prov_installning` till migrationens förval
direkt efter `begin;`, i samma transaktion som allt annat. Samma fel
gick att återskapa lokalt med 26 aktiva frågor och gränsen 55, och med
rättelsen gav samma databas 1897 av 1897. En ny tabell i driften som
ändrar vad fixturerna får göra ska neutraliseras på samma ställe.

**Ett avsnitt för en migration som inte är körd klipps bort i blocket.**
Ett sådant avsnitt prövar tabeller som inte finns i driften och faller.
Så var det 2026-10-14 med avsnitt 33 (`kortet_reserveras`). Sviten slutar
då före avsnittets rubrik: `left(text, position(E'\n-- 33. Kortet
reserveras …' in text))`, plus `reset role;`.

En migration som står till hälften i driften körs i stället först i samma
block. Så var det med `gratistimmar`, som saknade
`ta_tillbaka_gratistimmar`, och resultatet blev 1664 av 1664. Båda filerna
hämtas från samma commit och prövas mot sin md5.

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
gång (2026-10-07), att Fortsätt leder in och tar bort välkomsten, att en
familj som inte är matchad kommer in men inte kan boka eller köpa (och en
matchad kan köpa, 2026-10-07),
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

### Webbläsarprovet för familjens faktura (2026-10-06, borttaget 2026-10-21)
Borttaget med fakturan 2026-10-21. Det som stod här:
`verktyg/prova-fakturor.js` var byggt som de nedan (egen port, 8964), med
klockan fast på 6 oktober 2026 (`page.clock.setFixedTime`): en rad per
familj och månad under Betalningar → Fakturor, oktobers faktura som
samlas och septembers utkast med det sena passet, att familjens namn
fäller ut passen med dag, klocka och studiehjälpare, att Skapa nu torrkör
i bakgrunden och visar vad innan det skarpa anropet, familjens panel,
Månadens ekonomi, en telefon, och samma rader med schemat av.

### Röktestet av adminvyn mot en riktig databas (2026-10-21)
Leo: "Öppna varje sektion i adminvyn i testmiljön. Läs konsol- och
nätverksfel, SQL/RLS-fel och trasiga knappar. ... Lägg till ett
regressionstest som öppnar varje adminsektion och misslyckas vid
konsolfel." `verktyg/prova-adminvyn.js` gör det mot riktiga tabeller: de
andra webbläsarproven svarar ur en falsk värld, där en kolumn som inte
finns, en funktion utan EXECUTE eller en policy som nekar aldrig syns.

    PORT=54331 NAMN=nextrum-adminprov verktyg/lokal-databas.sh bygg
    PGPASSWORD=postgres psql -h localhost -p 54331 -U postgres -d postgres -f verktyg/prova-adminvyn.sql
    PORT=54331 NODE_PATH="$(npm root -g)" node verktyg/prova-adminvyn.js [mapp för bilder]

En egen databas (`PORT`, `NAMN`), så att datan inte syns i `rls-test.sql`.
Provet sätter `authenticator`s lösenord, startar PostgREST
(`postgrest/postgrest:v12.2.3`, `--network host`, port 54332) och tar bort
den efteråt (`BEHALL=1` låter den stå). Inloggningen är en JWT signerad med
PostgREST:ens hemlighet för en admin i datan; REST går vidare till
PostgREST med den, Auth svarar ur provet, och edge-funktionerna svarar 404
som en funktion som inte är driftsatt. Varje sektion i menyn, varje flik i
den och den första panelen med sina flikar, som superadmin, som admin med
behörigheter (leads, användare, bokningar, rapporter, matchning, godkänna)
och på en telefon i mörkt läge, där ingenting heller får göra sidan bredare
än skärmen (en bred tabell i en ruta som rullar i sidled är med flit).
Provet faller på fel i konsolen, sidfel, en fil som saknas och varje svar
från databasen på 400 eller mer, med databasens text. Provat 2026-10-21:
med `select` på `leads` borttagen föll fem prov med "permission denied
for table leads"; med rättigheterna på plats 128 av 128.

Det första som gick (2026-10-21) hittade inga fel från databasen eller i
konsolen. Det som rättades den dagen var det adminvyn visade fel: märkena i
Liggaren och Kortet bar klasserna `klar`, `pa` och `fel`, som ingen regel
har, och var grå i båda lägena; Liggarens och Kortets tre rutor stod i fyra
kolumner med en tom; och Kortet sa att kortet reserveras två dagar före
passet, också när strömbrytaren `kortreservation` står av (Betala nu).

### Webbläsarprovet för ansökan under 18, nejet och det admin sett (2026-10-05)
`verktyg/prova-ansokningar.js` är byggt som de två nedan (egen port, 8963):
vårdnadshavarens fält i formuläret på båda språken och vad som skickas,
reserven när kolumnen saknas, rutan som visar nejet innan ansökan avböjs,
godkännandet i ansökan, och att siffran vid Ansökningar och
Intresseanmälningar går bort när sektionen visats, med och utan tabellen
`admin_sett`. Sedan 2026-10-21 också ansökningarnas steg (flikarna med antal,
Intervjus tre knappar, Ångra, Utbildning hållen med och utan konto på
adressen, och frågan om vårdnadshavarens godkännande där), Skriv till hen
vid adressen och vyn före migrationen.

### Webbläsarprovet för utbildningsprovet i studiehjälparvyn (2026-10-21)
`verktyg/prova-utbildningsprovet.js` (egen port, 8978) är byggt som
introduktionens: en falsk Supabase med en studiehjälpare, en admin och fyra
frågor. I studiehjälparvyn: rutan före vyn, inget facit i sidan, att alla
frågor måste besvaras och att bara fråga → alternativ skickas, underkänt med
tiden då provet går att göra om, godkänt med Fortsätt, den som väntar, den
som inte behöver provet och en databas utan migrationen (ingen ruta), på en
telefon och i mörkt läge (44 px, 16 px text, rutan ryms). I adminvyn: fliken
Provet i vyn, varningen under fem frågor, facit markerat, en ny fråga som
nekas och en som sparas, Stäng av under gränsen, gränsen som tal, och
Utbildningsprovet i studiehjälparens panel med Nollställ provet. Det som
skyddar provet prövas i `rls-test.sql` avsnitt 41; webbläsarprovet visar
bara att vyerna gör rätt. `prova-ansokningar.js` provar sedan samma dag
rutan som visar intervjumejlet innan en ansökan skickas vidare.

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


### Webbläsarproven för barnets förslag och förhandsvisningen (2026-10-12)
`verktyg/prova-barnforslag.js` (port 8973) kör barnets Boka pass (inget
pris, de upptagna timmarna, förslaget, Ta tillbaka, databasens nej, av
och avstängt, utan funktionerna, telefonen) och förälderns granskning
(listan, Att göra, siffran, granskningen med allt ifyllt, rabattkoden
fel och rätt, en annan längd som prövar koden igen, första timmen och
tipstimmen med en kod, Skicka, Skicka inte, Tillbaka, adressen
`#boka/forslag-<id>`, valet under Profil → Barn, en databas utan
migrationen, telefonen) mot en falsk Supabase, som de andra. Sedan
2026-10-13 (`rabattkoden_krockar_inte`) också familjens eget förslag med
en kod, och med timbanken: den falska databasen svarar på ett nytt pass
med raden, som PostgREST, och `bokat` säger vad triggrarna gjort av den.
`rls-test.sql` avsnitt 28 provar samma ordning i databasen, och mot den
gamla funktionen faller nio av dess elva rader. Samma dag (`gratistimmarna_60_dagar`)
3f och 3g: en plan som gått ut med gratistimmen kvar, en beviljad första
timme som gått ut och tipstimmens sista dag, vid knappen; och
`rls-test.sql` avsnitt 29 (17 rader). Pass i tips- och första
timmen-blocken som låg mer än 60 dagar fram flyttades inom dem, för en
gratis timme gäller inte längre för ett pass efter sina 60 dagar.
Sedan 2026-10-14 (3j, `kortet_reserveras`) också att Välj kort inte står på
ett pass som familjens timmar betalar, och att det står på ett med två barn,
som timmarna inte betalar.

`verktyg/prova-forhandsvisning.js` (port 8974) provar förhandsvisningen
mot den riktiga adressen, men svarar själv på den enda fråga den ställer
dit (`mina_behorigheter`); varje annat anrop dit stoppas och fäller
provet. Grinden (utloggad, inloggad utan roll, filen som inte kom fram,
utan adressen), studievyn och studiehjälparvyn sektion för sektion (det
vyerna frågar efter som världen saknar står som 404 i
`NXForhandsvisning.logg`), barnets förslag, ett eget förslag, ett
meddelande, en nivå i NexLäx hela vägen, ett köp, Logga ut, Acceptera,
en rapport, elevens tråd, de två vyerna kopplade (föreslå, byt, acceptera,
byt tillbaka, omladdningen, Börja om), telefonen och adminvyns sektion
och tal utan adminens konto. När vyerna börjar fråga efter en ny tabell
eller funktion säger provet det: lägg den i världen i
`nextrum-forhandsvisning.js`. Ett pass som provet skapar hittas på sitt id
(de som inte fanns före Boka), aldrig på datum och läge: provet bokar
kalenderns sista dag, alltså månadens sista, och världens pass ligger på
`dag(6)`, `dag(16)` och `dag(23)`. Den 15 oktober var `dag(16)` den 31:a,
och provet tog Saras motförslag för familjens förslag (tre prov föll).

### Webbläsarprovet för kortet (2026-10-14)
`verktyg/prova-kortet.js` (port 8976) provar kortets vyer
(`kortet_reserveras`) i förhandsvisningens värld, som har strömbrytaren
på, Annas Visa ·· 4242 och `valj_kort` med databasens prövning: raden
Betalning i förslaget och i granskningen av barnets förslag (Efter passet
och Kort, utan faktura sedan 2026-10-21, och valet som står kvar), Välj
kort, Välj bort och Välj kort igen på passets sida, märket i Mina lektioner,
Profil → Kortet, och lägena som jobbet och Stripe skriver (nekat,
reserverat, ett genomfört pass under Bekräfta rapport), inskrivna i
världen i webbläsarens lagring. Sedan strömbrytaren av och inget kort
(vyn som förut), migrationen inte körd (vyn frågar inte efter kortet),
strömbrytaren av med ett val kvar (passet betalas som vanligt),
telefonen, och adminvyns Ekonomi mot en falsk Supabase, med och utan
tabellerna. Spara och ta bort ett kort går genom Stripe och provas inte
här: det är steg 6 i `DEPLOY-BETALNING.md` 9.14.

`prova-barnkonton.js` fick två ändringar samma dag: Boka pass är en dold
menypost i barnets vy tills föräldern slagit på den, och Förhandsvisning
står i menyn för varje admin.

### Webbläsarprovet för familjerabatterna (2026-10-15)
`verktyg/prova-familjerabatter.js` (port 8977) provar familjerabatterna
(`familjerabatter`) mot en falsk Supabase, som `prova-koder.js`: fliken
Tjänster → Familjerabatter (koderna, formulärets besked, en ny kod i öre, nytt
belopp och Stäng av med sina frågor, telefonen och mörkt läge), familjens
panel (raden under Översikt, rutan under Ekonomi med vem och när, Byt till
utan familjens egen kod, Ta bort och Ge, och att fliken räknar familjen),
passets panel (timpriset med rabatten dragen) och valet i Ta in familjen.
Sedan studievyn med rabatt, utan och utan migrationen: priset vid knappen i
Boka pass (389 kr "med er rabatt", 458 kr med två barn), plankortet (2 952 kr
och 369 kr i timmen "med er rabatt") och Fyll timbanken (3 890 kr, 389 kr i
timmen) och utan rabatt katalogens pris, att korten aldrig säger koden, Köp
till timmar och att vyn frågar efter beloppet men aldrig efter koden. Sist
adminvyn utan tabellerna. 63 prov.

Flera prov samtidigt kan fälla `prova-ansokningar.js` på tid (den väntar
800 ms på adminvyns siffror). Ensam går den igenom.

### Webbläsarprovet för kassan, timbankens månader och Liggaren (2026-10-21)
`verktyg/prova-kassan.js` (port 8979) provar Fas 3 mot en falsk Supabase, som
`prova-familjerabatter.js`, med webbläsaren i Stockholms tid: timbankens två månader ("3 av 8
timmar återstår", "0 av 0", textContent utan undefined), batteriet som bara räknar det som gäller,
nästa månads plan som kommande, timmar som betalats tillbaka ("1 av 6"), månadsvalet på plankorten
(förval, bara sin plan, kortet byter inte höjd, 44 px), rutan med köpvillkoren (vad som köps, priset
och månaden, fokus på krysset, Till kassan stängd före krysset, Escape och Avbryt öppnar ingen kassa,
länken), kassans anrop (planen, `manad`, `villkor: true`, aldrig ett belopp; Fyll timbanken utan
månad), passets kassa, Profil → Timbanken, vyn utan migrationerna, tillbaka från Stripe (inga
skrivningar utöver en vanlig sidladdning, adressen städad), telefonen och mörkt läge. I adminvyn
Liggaren (summorna bara skarpa, raderna, filtren, sökningen, återbetalning av ett köp med timmar och
aldrig ett belopp, telefonen) och Kortet (de nekade överst, försöken, nästa försök bara när koden
tillåter, Försök igen) och adminvyn utan migrationerna. 83 prov. `prova-barnforslag.js` och
`prova-forhandsvisning.js` kryssar sedan samma dag i köpvillkoren före kassan.
`_delad/aterbetalning_test.ts` provar återbetalningen av ett köp med en falsk Stripe och databas
(nyckeln, Stripe först, ett nej från databasen eller Stripe, webhookens avstämning, och att en
återbetalning aldrig går under det som använts: `provaKopetsLage` prövar databasens svar innan
pengar går ut). Sedan Fas 4 (samma dag) provar `prova-kassan.js` också hela kassan med en falsk
Stripe.js (`js.stripe.com/v3/` byts mot ett skript med `initEmbeddedCheckout`): panelen öppnas med
funktionens nyckel och sessionens hemlighet, och när Stripe säger klart står beskedet och vyn skriver
ingenting själv.

### Stripe utan nät: webhookens mottagning och kortets rader (2026-10-21)
Leo bad om Stripe-logiken i rena moduler med en inskickad klient. `_delad/webhooken.ts` är webhookens
mottagning (signaturen på den råa kroppen och taket mot dubbletter i `stripe_handelser`), och
`webhooken_test.ts` provar en giltig och en ogiltig signatur, samma händelse två gånger med EN effekt,
en leverans som föll och körs om, och en tabell som inte svarar. `_delad/reservationen.ts` är det
`stripe-reservation` gör med en rad (reservera, dra, debitera, släppa), med 48-timmarsfönstret prövat
en gång till (`reservationsfonster`, `passetsStart` i Stockholms tid), och `reservationen_test.ts`
provar fönstret (före, exakt 48 timmar, efter, ett pass bokat närmare än så), reservationen, att inget
dras två gånger, dragningen och dess tak, en reservation som gått ut, ett nekat kort, en bank som vill
att familjen bekräftar, och släppet. Båda funktionerna gör samma sak som förut; koden flyttade.

### Två samtidiga dragningar (2026-10-21)
`verktyg/prova-samtidigt.sh` bygger en egen databas (`nextrum-samtidigt`, port 54330, med
`lokal-databas.sh`) och låter två sessioner ta samma sista timme samtidigt: den första håller låset
i två sekunder, den andra ska vänta, säga nej och lämna saldot på noll med en använd timme. `rls-test.sql`
kan inte pröva lås, för den är en transaktion. Provat 2026-10-21: 6 av 6, och med låset i
`klippkort_dra` bortlappat föll fyra av dem (båda passen tog timmen).

### Koderna bara på planer (koder_for_planer, 2026-10-21)
`_delad/koder.ts` är det kassan gör med en kod före Stripe (formen, nej på ett pass, ett tillägg, kortet och
timmar till planen, bara en plan, databasens svar och kontrollen av rabatten), med databasen inskickad
(`Kodklient`). `koder_test.ts` provar procent, kronor, noll och en rabatt över priset (samma exempel som
`rls-test.sql` avsnitt 46 räknar i databasen), databasens nej (utgången, inte börjad, slut, en gång per
familj, finns inte), en rabatt som inte stämmer med typen och värdet, ett fel och ett tomt svar, och vägen före
migrationen (`kolla_rabattkod_kop`). I `rls-test.sql` skrevs avsnitt 28 och 32 om till den nya regeln (ett pass
tar ingen kod, för någon; gränserna prövas på köpen), och avsnitt 46 är nytt: sort och partner, noll, inget
raderas, prövningen i svensk tid, användningen vid betalningen, familjens partner och avidentifieringen, vem
som når vad och statistiken med och utan testbetalningar. `prova-koder.js` provar flikarna under Koder
(planskoderna) med ett partnernamn som bär en `<img onerror>`, och `prova-barnforslag.js` att Boka pass och
granskningen inte har någon ruta för en kod och att Fyll timbanken aldrig visar ett pris med kod.

### Syskontillägget som skuld (syskontillagg_som_skuld, 2026-10-21)
`_delad/tillagg.ts` är det webhooken och kassan gör med tillägget (beloppet, raden i kassan, utgångstiden,
buntningen, fördelningen av en återbetalning per rad och händelserna), med databasen inskickad (`TillaggDb`), och
`tillagg_test.ts` (34) provar beloppen och avrundningen, raden utan kod, utgångstiden, en betald, en som väntar
(Klarna), en utgången och en misslyckad kassa, samma händelse två gånger, en signatur som inte stämmer, en
återbetalning per rad ur metadatan (också en som misslyckades och en köprad), och en tvist. I `rls-test.sql` är
avsnitt 51 (SK, 76 prov) nytt: villkoren och versionen, barnen och taket, att ingen klient skriver, lägena (hållet,
avslaget, avbokat i tid, sent och exakt 24 timmar), försöken och låsen i en transaktion, betalningen och raderna,
buntningen, återbetalningen per rad, tvisten, spärren (beloppet och åldern i Stockholms dagar), påminnelsen,
admins knappar och att barnen, längden och antalet står fast. `verktyg/prova-tillagg-samtidigt.sh` öppnar två
psql-sessioner mot den lokala databasen och betalar samma skuld samtidigt i tre varv (två flikar, en flik och ett
köp, två köp): varje post i exakt ett försök, och den andra sessionen väntade på låset. `prova-syskon.js` (port
8983, 95 prov) provar vyerna mot en falsk Supabase: Boka pass med syskon, livepriset, villkoren första gången och
krysset, att vyn skickar barnen och aldrig ett belopp, spärren, kortet Upplupet tillägg och Betala tillägg nu,
banderollerna, tillägget som egen rad i ett köp (obligatoriskt och valfritt), passens barn, strömbrytaren av och
utan migrationen, telefon och mörkt läge, och studiehjälparens Barnen på passet, med ett barnnamn som är HTML.
`prova-adminvyn.js` öppnar fliken mot en riktig databas med två poster ur `prova-adminvyn.sql`.

### Värvningsbonusen (varvningsbonus, 2026-10-21)
I `rls-test.sql` är avsnitt KB omskrivet: med `varvningsbonus` i databasen provar det den nya bonusen (raden när
ansökan kommer in, delningen 26 786 + 3 214, en gång, den som hade ett konto, flaggan av, att värvaren inte läser
tabellen men ser listan genom `mina_tips()`, att ingen klient skriver, hindret vid radering och Markera utbetald), och
utan den de gamla proven för `tipsbonus`. Avsnitt 52 (VB) är nytt: koden av sig själv, `prova_jobbkod()` och taket per
IP-nummer, att ansökan bär koden och ägaren och aldrig en värvare ur anropet, en ändrad inställning före och efter
intjänandet, mejlet en gång, samma person med en annan kod, lägena, Markera utbetald och Annullera, egen kod, den som
sökt förut, värvaren som inte är godkänd, provet och första passet som händelse, att de väntande prövas när händelsen
byts, och att värvaren följer koden. `prova-varvning.js` (port 8984, 57 prov) provar mot en falsk Supabase
jobbansökan med och utan kod på båda språken (koden ur adressen, beskedet, att ansökan går in utan en kod som inte
gäller, och taket), Värva en kompis (beloppet och händelsen ur inställningen, länken, listan med bara läget och
förnamnet, platshållaren för villkoren, Ersättning) och sektionen Värvningsbonus (filtren, summorna, summeringen per
värvare och lönemånad, CSV:n, Markera utbetald med lönemånaden och Annullera med skälet, bara genom funktionerna), med
ett namn som är HTML, telefon och mörkt läge. `prova-adminvyn.js` öppnar sektionen mot en riktig databas med tre rader
ur `prova-adminvyn.sql` (intjänad genom att kontot godkänns, väntande, och annullerad för ett konto som fanns före),
`prova-koder.js` provar Markera utbetald i Löner, och `prova-barnkonton.js` att en admin med behörigheter aldrig
hämtar bonusarna eller inställningen.


### Granskningen (2026-10-21)
Tre granskare som inte skrivit koden läste hela diffen (databasens skydd, pengaflödet, tidszonen och vyerna) och
bevisade sina fynd mot en lokal databas, varje gång mellan `begin` och `rollback`. Proven för rättelserna:
`rls-test.sql` fick 31 prov till (AS 3, KÄ 3, TI 1, SK 14, VB 10) och två ändrade (fel belopp släpper nu försöket,
och tvisten provas före återbetalningarna, för en helt återbetald betalning sätts inte längre i tvist); hela filen
gick 2106 av 2106 mot en databas byggd ur alla 220 migrationer. Ett av proven kör som `service_role` och visar att
tjänstekontot inte skriver direkt i tilläggets tabeller, `timmar_insatta` eller `ansokan_steg_logg`, men att
`tillagg_forsok_skapa` går. Två äldre prov (16.1 stegen och Intervjumejlet) gick
genom Avböjd för att hoppa över steg och fångar nu 23514. `tillagg_test.ts` fick 8 prov för en kassa åt gången
(`forsoketsKassa`, `gamlaKassanGarUt` med en falsk Stripe) och buntningen med samma regel som kassan
(`tillaggetFoljerMed`); proven för `huvudbeloppUrTotal` och ett pass som buntas är borta med funktionen och regeln.
`prova-adminvyn.sql` har en betald och en väntande betalning för tillägget, så att Släpp betalningen, raderna i
Betalningar och Månadens ekonomi och bokslutets rad ritas mot de riktiga tabellerna.

Ett fel i ett prov att komma ihåg: en DO-block-variabel heter som ett tabellalias utan att märkas (`B constant uuid`
och `from public.bookings b` ger "column reference "b" is ambiguous", för plpgsql skiljer inte på versaler). Avsnitt
51 har `B` för en studiehjälpare, så aliaset där är `bk`.

### Sen avbokning (sen_avbokning, 2026-10-22)
I `rls-test.sql` är avsnitt 53 (SA, 24 prov) nytt, och avsnitt 51 räknar halva tillägget vid en sen avbokning; hela
filen gick 2131 av 2131 lokalt. `prova-sen-avbokning.js` (port 8986, 54 prov) provar vyerna mot en falsk Supabase som
gör det `stampla_avbokningen` gör och svarar på `sen_avbokning_lage()`: familjens ruta, passets sida och Att betala,
med timmar, ett pass i tid och ett på de gamla villkoren, utan migrationen, telefon och mörkt läge, och adminvyns
fråga, Att göra, Alla betalningar, panelen och Efterskänk avgiften. `prova-syskon.js` (96 prov) läser villkorens
version 2026-10-23, gränsen 12 timmar och länken till `#syskontillagg`.

### Om oss och exemplen (om-oss-sida, 2026-10-22)
`test/innehall-regler.py` (CI, efter delningsbilderna) läser `<main>`, titeln och beskrivningarna i `om-oss.html`, och
till 2026-10-26 sektionen `#exempel` i båda startsidorna (borttagen den dagen, Leo: "ta bort den"). Den faller på namn ur repot och titlar, ett ord med stor bokstav mitt i en
mening som inte står i `EGNA`, procent, siffror före elever, familjer, timmar eller betyg, bevis, garanti, "forskning
visar", tusentals, bäst, kronbelopp, tankstreck, bakgrundskontroll, registerutdrag och omdöme utanför
`[data-vi-ar-nya]`. `[data-platshallare]` prövas inte utan skrivs ut. Medan exemplet fanns prövades engelskan på
procent, kronor och tankstreck, exemplet på en tejp per flik och ingen årskurs eller skola, och varje ekvation räknades
om; den delen gick med exemplet. Prövad med tjugo inplanterade fel, som alla föll.
`verktyg/prova-om-oss.js` (port 8989, 48 prov sedan 2026-10-26, inte i CI) öppnar `/om-oss` och startsidan i 1440, 820
och 390 i båda lägena (konsolen, sidledsrullningen, inga anrop utanför localhost från Om oss och bara Supabase som förut
från startsidan, och att inget exempel eller någon länk dit står kvar), rubrikerna med reducerad rörelse, utm på
knapparna och länken i Vi är nya. Delningsbilden för Om oss har inget foto (`UTAN_FOTO` i `bygg-delningsbilder.js`) och inget pris; bara
`delning/om-oss.jpg` byggdes om, de andra bilderna lämnades orörda. `om-oss.html` står i språkbaslinjen som en svensk
sida utan tvilling; ekvationerna i `#exempel` stod där som svenska kvar i engelskan tills exemplet togs bort.
