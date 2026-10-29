# Vyerna: startsidan, paletten, fällorna och adminvyn

Arkivet för avsnitt 3 i `CLAUDE.md` utom filkartan (`grunden.md`), ordagrant. Reglerna och
fällorna står i kort form i kärnan, `CLAUDE.md`, med samma rubriker och samma numrering;
"avsnitt N" i texten är kärnans.

---

### Startsidan efter hero (2026-09-25)

Hero är orörd med flit. Allt annat på startsidan bor i
`nextrum-start.css` och `nextrum-start.js`, och startlägena gömmer
ingenting utan `html.nx-sr` — klassen sätts av skriptet, så en fil som
inte laddar lämnar sidan i slutläget.

Hero är orörd med flit. En dag (2026-10-06) stod "Läxhjälp i Stockholm"
som etikett och en ingress till föräldern; Leo tog tillbaka "Nextrum" och
den gamla ingressen 2026-10-07. Kvar av den dagen är raden under knapparna
(se Startsidan talar till föräldern nedan).

**Hero-filmen spelar också på telefon** (2026-09-29, Leo: "heron rullar
ej automatisk på mobil vy"). `heroVideo()` i `nextrum-motion.js` avstod
förut på skärmar under 641 px för att spara data, och heron stod då
stilla på sin poster. Nu får telefonen en egen fil, `data-video-mobil`
(`bilder/08-teamet-orbit-mobil.mp4`, 540 px hög, 255 kB mot 5 MB),
och det som fortfarande avstår är rörelse bortvald, `saveData` och 2G.
Filen är gjord ur originalet med `ffmpeg -an -vf scale=-2:540 -c:v libx264
-profile:v main -crf 27 -preset slow -movflags +faststart`; byts
originalet ska den göras om, annars visar telefonen ett annat klipp.
iPhone i strömsparläge nekar autouppspelning också för en tyst film:
då startar första trycket på sidan den (`nekad()`), och tills dess står
posterbilden kvar. Playwrights Chromium har ingen H.264, så uppspelning
går inte att prova med mp4:n; servera samma klipp som VP9 genom en
route och mät att `currentTime` går. Sidorna med hero-film är bara
`index.html` och `en/index.html`.

**Skriptet sätter klasser, CSS rör sig.** Första versionen räknade om
kort, ord och ett blad över filmen för varje bildruta medan man
scrollade, och studievyns lutning skrev CSS-variabler på fönstret.
Leo: "alla animationer måste se mer smooth ut och inte laggiga". En
scrollkopplad effekt i JavaScript hamnar ur takt med en scroll som
webbläsaren kör på grafikkortet, och **en custom property ärvs** — en
variabel på ett element med hundratals barn räknar om stilen för alla
vid varje skrivning. Nu säger en IntersectionObserver när något syns,
en klass sätts, och resten är transitions på opacity, transform,
translate och scale. Bandet är en Web Animation. Mätt med samma scroll
och musrörelse: stilomräkningen gick från cirka 700 till 165 ms.
Skriv inte tillbaka stil per bildruta, och animera inte box-shadow —
lägg skuggan i ett eget lager och tona dess opacitet.

**Landningssidorna rör sig med GSAP** (2026-10-28). Leo ville ha dem
"lite roligare", med GSAP, Lenis och react-bits som inspiration. react-bits
är React och Lenis tar över scrollen (som scenerna i nextrum-motion.js och
de snäppande raderna bygger på), så bara GSAP och ScrollTrigger 3.13.0 kom
in, vendorade i `bibliotek/` som supabase-js. `nextrum-landning.js` gör tre
saker och inget mer: skenan i Så går det till fylls med scrollen (scrub)
och stegen tänds med klassen `lp-tand`, platserna under Var vi matchar
elever ritas som en linjekarta (vågrät från 861 px, lodrät under, en bild
och ingen riktig linje i SL:s nät) och korten och listans rader kommer in i
tur, med högst en halv sekund mellan första och sista. GSAP skriver
transform per bildruta där; det är undantaget från regeln ovan, och det
gäller bara de genererade sidorna. Inget göms i CSS: det skriptet visar
döljer skriptet själv, så en sida utan GSAP eller med reducerad rörelse
står färdig. Ämnessidorna bär ämnets färg (`data-lp-amne` på main, `-l` i
mörkt läge) i listans siffror och stegen; annars ger ordningen färgen.
Navet `laxhjalp-stockholm` är handskrivet och har inte fått det.

Samma natt (Leo: "mer reaktiv och kul att gå igenom") kom flikar, ljus
och en lästråd. Vad passen går ut på (ämnes-, stadie- och onlinesidan,
alltid fyra rader) och Var passen hålls (Hemma, Biblioteket när området
har ett, Online) är flikar med en markering som glider: generatorn
skriver `data-lp-flikar` och `data-lp-flik`, och skriptet bygger raden.
Panelerna delar rutnätscell, så sektionen är lika hög som den längsta
fliken och inget under den hoppar; därför står meningen om att man väljer
för varje pass ovanför flikarna, där den inte får ett hål över sig.
Flikarna och ljuset som följer musen över korten (`--mx`, `--my` på
kortet, bara med mus) går också utan GSAP och med reducerad rörelse;
lästråden överst bara med rörelsen på. Utan skriptet står flikarnas
innehåll som förut, lista och stycken.

**Startsidan får en ny form** (2026-10-29). Leo: "Just nu är mycket bara i
kolumner och tråkiga", med reactbits.dev som förebild ("coolare övergångar,
sektionen som fångar ögat och en ny struktur"), och sedan "Du får göra allt,
men du ska [ge] en preview länk innan jag eventuellt merga". Nästan varje
sektion var samma mall: etikett, rubrik till vänster, ingress till höger
under ett streck och en rad vita kort, och "Allt på ett ställe" stod två
gånger. React Bits är React, så inget kom in därifrån: tre av dess idéer är
skrivna om för hand i `nextrum-start-scen.js`, med GSAP som redan låg i
`bibliotek/` för landningssidorna. Det som inte togs, med flit: effekterna på
muspekaren (finns inte på en telefon), glitch- och dekrypteringstext (fel ton)
och CountUp (sidan visar inga antal). Bakgrunderna i WebGL lät jag först bli
(tunga på en telefon), och det var fel avvägning: Leo ville ha just dem (Scenen, och
sedan trådarna i Raden som glider).
- **Kortet för den som vill jobba bort** (samma kväll, sist). Leo: "Gör kolumnerna mindre som innan
  och ta bort för dig som vill jobba kolumnen". Korten hade blivit högre för att det mörka kortet
  hade mest innehåll (rubrik, mening, tre lappar, knapp och Logga in) och raden sträcker alla kort
  till det högsta; utan det är de lika höga som före. För dig som vill jobba står inte på startsidan
  längre; Bli studiehjälpare nås från menyn och från Nästa steg.
- **Pilarna bort** (samma kväll). Leo, med en ring kring pilarna och en kring strecket under
  raden: "Ta bort dessa pilar. Här menade jag att den skulle vara så att de ej ser ut sådär att de
  är tydligt att de är två olika sektioner. Lite fadat under och den där animationen över".
  Bilderna var tagna före övergången i punkten nedan (hans klocka 22.00 är 21.00 UTC, och den gick
  ut 21.09), som redan gör just det. Pilarna gick; med en mus dras raden i stället (`pointerdown`
  på raden, snäppningen av medan man drar, och ett drag öppnar aldrig länken man släppte på).
- **För dig som vill jobba som ett kort, och övergången utan streck** (samma kväll). Leo:
  "För dig som vill jobba på main sidan ta bort den, och lägg till någon kolumn i slutet där de
  står för dig som vill jobba, var kreativ gör de snyggt", och om raden och garantin: "nu är det
  ett streck där som skiljer två färger de är ej snyggt, skugga till och ha den där animationen
  där". `#bli` är borta från startsidan (inget länkade dit, varken `#bli` eller `#unga`), och
  radens sjätte kort (`.hjs-jobb`) är Bli studiehjälpare-sidans svarta med leran i två hörn och i
  kanten, i båda lägena: etiketten, rubriken "Vill du hjälpa någon annan att lyckas?", sektionens
  första mening, tre av dess punkter som lappar, knappen och Logga in. Ytans vita tonar över i
  sidans papper i trådarnas band (`--hjs-fot-h`), så att garantin följer utan streck. **Fällan**:
  luften sist i raden (`.hjs-lista::after`) räknades med `--hjs-kant`, vars 100 % blir radens egen
  bredd där inne, så raden var nästan 500 px för bred och slutade i tomhet; den räknas nu mot
  100vw. Fokus räknas mot sista kortets snäpppunkt, inte radens yttersta kant, för en telefon
  stannar där. De rena `#bli`-reglerna gick; `:is(#bli,.bli-svart)` står kvar för specificitetens skull.
- **Korten i sin färg och bandet som glitchade** (samma kväll). Leo: "kolumnerna som du
  gjorde gör så de blir lite skyggade av färgen de har. Och elementet under de kolumners som rör
  sig måste blir bättre för den glitchar". Korten har en svag ton av sin färg (4 % över hela
  kortet och 14 % i hörnet vid ikonen) och en mjuk skugga i samma färg som står still; raden fick
  48 px luft nedtill, för `overflow-y:hidden` klipper annars skuggan (med 30 px syntes den klippta
  kanten som ett streck under korten, och bandet ligger 34 px upp över luften). Bandet glitchade av tre skäl:
  radens rullning lade till trådarnas tid (svep raden, och trådarna vred sig fort), de slog i
  bandets kanter och klipptes, och de ritades i CSS-pixlar, så att de tunna trådarna flimrade på en
  retinaskärm. Nu går de i sin egen takt utan pekare och rullning, tonas mot över- och underkanten
  i shadern, är 24 i stället för 30, och ritas i skärmens pixlar (högst 1,5 per CSS-pixel).
- **Raden tillbaka efter en timme** (samma kväll). Leo skrev "Asså istället för
  0102030405 ha de små kolumnerna som fanns förut", och jag satte bentots små kort i ett rutnät i
  stället för raden (fyra små och NexLäx hög), utan raden, pilarna och trådarna. Han frågade vart
  "den nya första sektionen" tagit vägen och skickade sedan en bild av raden med ikonerna: "Nej de
  du gjorde ska skicka". Raden med ikonerna är tillbaka som den var, ur commiten före rutnätet. Det
  som stod kvar från rutnätets commit är punktnätet i Nästa steg, som står på 9 % bläck i stället
  för 16 %: Nästa steg hade redan sidans färg (mätt: #F1EDE6 i ljust läge, #1A1813 i mörkt), men
  punkterna över hela ytan fick den att läsas som en annan ton (Leo: "ska ha samma färg som resten
  av sidan i den nyansen"). Läs en kort fråga som Leos nästa steg i det han nyss sett, och fråga
  hellre en gång till än bygger om en hel sektion på en gissning.
- **Ikonerna och fotot i manifestet** (samma kväll). Leo skickade bilder av bentot som
  stod i drift och skrev: "Skit i sofforna och kör såhär: ha dessa fel element istället för
  siffror. Och Info från den tredje bilden lägger du på rätt person kan göra stor skillnad."
  "sofforna" och "fel" lästes som siffrorna och fem: korten har bentots ikoner (`.hj-ikon`)
  i stället för 01–05, läxhjälpen folket, studiehjälparna studentmössan (bentots Expertisen),
  matchningen länken, NexLäx stigen och studievyn dokumentet. Den tredje bilden var bentots
  läxhjälpsruta med fotot hemma hos familjen och lapparna Hemma hos er, På biblioteket,
  Online och Rapporten efter passet är klar; fotot och lapparna står nu till höger om
  manifestets rubrik (`.mf-topp`, `.mf-foto`), under varandra under 980 px, och lapparna
  poppar fram i tur när fotot stigit in. Läxhjälpens text står kvar i raden.
- **Rubrikerna likadana, som förut** (samma kväll, efter Raden man sveper i).
  Leo: "Och jag gillade hur rubrikerna var likadana ändra tillbaka de du ändrade och centrera
  / 01 02 03 04 05 ska redan vara färgade". Före samma dag hade Hur hjälper vi, studievyn,
  studiehjälparna och omdömena samma huvud (`.nx-head split`: etiketten och rubriken till
  vänster, ingressen till höger), och under kvällen fick de fyra olika: en egen liten rubrik
  med pilar bredvid, studievyns i mitten och två med ingressen under (`.nx-head-en`). Jag
  läste "centrera" som rubrikerna och ställde alla fyra i mitten (`.nx-mitt-head`); Leo:
  "De ska inte vara centrade". Nu har alla fyra sitt huvud från före samma dag igen, tecken
  för tecken, och Hur hjälper vi sin rubrik ("Hur hjälper vi<br><em>ert barn?</em>").
  Pilarna står i mitten under raden, ovanpå trådarnas band, och korten hade en stund siffran
  ifylld i sin färg från början (Ikonerna ovan ersatte den); fokus syns bara på kanten. Manifestets rubrik rördes inte: den är
  större än de andra med flit, och Leo bad om den mindre.
- **Raden man sveper i** (femte varvet samma kväll). Leo skickade en video
  och skrev: "texten syns dålig då rörelse grejen tar för mycket plats med den färgen den
  har, jag gillar iden men vi måste antingen tona ner på färgen eller ej ha den över text
  utan mer som ett mönster att veta vart man ska scrolla. Jag gillar ej heller att man
  behöver scrolla ner för att nästa steg ska börja. Vi är ett läxhjälps företag som du vet
  inte et tech bolag. Så vi kör istället att man scrollar själv åt vänster. Och rubriken tar
  för stor del av sidan. Samma sak gäller rätt person kan göra stor skillnad gör den
  rubriken mindre och ta tillbaka kolumnen där som fanns. Samma sak med färg grejen gäller
  är du redo att ta nästa steg kör nåt sånt här där i bakrunden". Så: ingen sticky och
  ingen scroll som drar raden. Rubriken står ovanför i en vanlig storlek
  (clamp(1.9rem, 3.4vw, 3rem), på en rad på dator), korten i en rullbar rad med
  `scroll-snap` och, på dator, två pilar som rullar raden ett kort med `scrollBy` och står
  släckta vid ändarna. Trådarna står i ett band under korten (`.hjs-band`, 64–110 px),
  nedtonade (0,6), med full upplösning och tunna trådar (1,8 px), för i ett så lågt band
  blev förvalet ett suddigt streck. Fokus (`.pa`) och inträdet (`.inne`) räknas ur radens
  `scrollLeft`, och inträdet väntar tills raden syns (en observatör på raden, aldrig på
  korten). Manifestet fick sina två blad tillbaka och en mindre rubrik
  (clamp(2.2rem, 5vw, 4.4rem) mot cinemas 7,6rem), och meningen under rubriken gick, för
  den stod i Rätt match; Allt på ett ställe står alltså både där och i raden, som före
  samma dag. Nästa steg fick ett punktnät som i videon (React Bits Dot Grid, en 2d-duk,
  26 px mellan punkterna): svaga punkter i bläckets färg som kring pekaren (160 px) blir
  större, får accentens färg och viker undan, och glider tillbaka; slingan står när inget
  rör sig. (Ljuset vandrade först av sig självt på en telefon; Leo: "man själv när man rör
  då ska punkterna röra sig inte automatisk", så det följer fingret i stället, också medan
  sidan rullas under det, med touchstart och touchmove.)
- **Raden som glider** (fjärde varvet samma kväll, borttagen med Raden man sveper i). Leo om scenen
  nedan: "Jag gillar inte att bakrunden är svart och orange på den sektionen, och en
  grej till när de kolumnerna typ 5 stycken går sidleds snyggt med en vit rörlig
  bakrund som du hittar på react bits, annars helt ok". Ytan är nu `--yta` (det vita
  i paletten, mörk i mörkt läge) med trådar i WebGL (React Bits Threads, `data-tradar`:
  trettio trådar med två perlinbrus var, i WebGL 1), och rubriken och de fem
  budskapen står i EN rad av kort som glider åt vänster ett till ett med scrollen
  medan ytan står still. Kortet närmast en punkt som vandrar från en tredjedel till
  fyra femtedelar av bredden är i fokus (`.pa`: siffran ifylld, kanten i dess färg,
  de andra en aning mindre med `scale`), och trådarna glider till dess färg, så att
  ämnesfärgerna bokstavligen blir den röda tråden. Ett korts rubrik stiger upp när
  kortet kommer in (`.inne`). Pekaren och scrollen rör trådarna lite, som pekaren
  gör i förlagan. Två ändringar mot förlagans shader: trådens bredd räknas mot
  dukens höjd (förlagan räknar mot den längsta sidan, och då blir trådarna tjocka på
  en telefon på högkant), och kanterna skrivs med smoothstep åt rätt håll. Utan GSAP
  eller med reducerad rörelse är raden en rad att svepa i (`scroll-snap`). Norrskenet
  i Nästa steg står kvar: den sektionen var mörk med orange sken redan före, och Leo
  talade om scenen. **Fällorna**: (1) ytan är ett rutnät, och en `auto`-kolumn växte
  med raden (min-content), så vägen mättes till noll: `minmax(0,1fr)`; (2) trådarna
  blev trappsteg på en telefon i en tredjedels upplösning, så skalan är 0,62 där
  (0,5 på dator, där duken är större).
  **Nästa steg** samma kväll (punktnätet ersatte trådarna där i nästa varv; Leo, när jag frågade om den mörka sektionen längst ned:
  "Så den ska matcha sidan på mörk och ljus vy"): på startsidan har den ingen `.nx-mork`
  (`.nx-final-ljus`), så den står på sidans papper och bläck i båda lägena, och
  norrskenet (Aurora, som stod där några timmar) är bytt mot samma trådar, som går
  genom scenens fem färger, fyra sekunder var. Rubrikens ord i accenten, som andra
  rubrikers. Reglerna `#bli + .nx-mork` (Nästa steg som började i `#bli`:s svarta)
  gick med, för inget matchade dem längre. Menysidornas Nästa steg är mörka som förut.
- **Scenen** (tredje varvet samma kväll, borttagen med Raden). Leo om högen: "Jag sa
  ta inspiration av animationer osv på react bits, snygga rörliga bakgrunder, hur
  texter går osv du gjorde ingenting av det. De blir liksom 8 kolumner direkt du
  går strukturera om det". Två varv hade bara bytt rutornas form, och ingenting
  rörde sig så att det syntes. Då blev Hur hjälper vi en mörk scen i helskärm direkt
  efter heron (`.nx-hjs`, `data-hjscen`): ett norrsken i WebGL bakom (Aurora,
  samma fragmentshader som React Bits, i WebGL 1 utan bibliotek, med lera, orange
  och rosa ur `--aurora-1`–`3`), och sex lägen som byts mitt på skärmen medan
  scenen står still (`position:sticky`, sex gånger 78 vh scroll): rubriken med
  ingressen, sedan de fem budskapen med en stor konturerad siffra, rubrikens ord
  som stiger ur en springa (SplitText, `overflow:clip` per ord) och texten som
  tonar fram ur sudd (BlurText). En linje längst ned fylls med scrollen. Samma
  norrsken står i Nästa steg i stället för de tre CSS-fläckarna. Etiketterna har
  ett ljus som glider genom texten (ShinyText, en gradient i texten med
  `background-clip:text`), rubrikernas ord stiger och rätar upp sig i stället för
  att bara tona fram, och ämnesbandet lutar med farten (ScrollVelocity, `skewX` på
  raderna). Kostnaden hålls nere: duken ritas i halv upplösning (en tredjedel på
  tier `lite`), slingan går bara medan duken syns och fliken är framme, och med
  reducerad rörelse ritas en bild. Utan WebGL står ytans radiella gradient, och
  utan GSAP står de sex lägena under varandra. Det andra stycket hos
  studiehjälparna ("De vet hur det är ...") gick: scenen har en mening per läge.
  **Fällan**: hela bandet lutat med `skewX` breddade sidan med sju pixlar, för
  sektionens hörn sticker ut; raderna lutar inuti en sektion som klipper.
- **Högen** (ScrollStack, andra varvet samma kväll, borttagen med Scenen). Leo om bentot nedan: "Vad fan har du
  gjort jag sa till dig minimera alla kolumner så skapade massor med nya av kolumner jätte
  dåligt". Hans "Just nu är mycket bara i kolumner och tråkiga" betydde färre kolumner, och ett
  rutnät med sju rutor var fler. Då stod Hur hjälper vi i en kolumn: fem kort i full bredd
  (läxhjälpen på fotot, studiehjälparna, matchningen, NexLäx, Allt på ett ställe) som fastnar
  under sidhuvudet med `position:sticky`, en kant av det förra synlig, och kortet under krymper
  en aning med GSAP på dator. Inget kort har spalter inuti. Utan rörelse en vanlig lista. Samma
  ändring: rubrikerna på startsidan har ingressen under sig (`.nx-head-en`, tillbaka till `.nx-head split`
  sedan Rubrikerna likadana ovan) och ansökans fyra
  steg i `#bli` är en lodrät lista (`.nx-apply-lista`). Tryggheten gick som egen punkt, för
  "intervjuade och utbildade" står redan hos studiehjälparna och betalningen i Allt på ett
  ställe. Ljuset som följde musen gick med bentot.
- **Bentot** (MagicBento, borttaget samma kväll, se Högen) i Hur hjälper vi: sju rutor i fyra kolumner,
  läxhjälpen stor (två gånger två) med fotot hemma hos familjen
  (`21-hemma-hos-familjen`, som inget annat på startsidan använder) och
  platserna som lappar ovanpå, fyra små (expertisen, erfarenheten,
  matchningen, tryggheten) och två breda (NexLäx, Allt på ett ställe med
  plattformens delar som märken). Matchningen och tryggheten kom ur Trygg
  hjälps band, Allt på ett ställe ur manifestet, och Trygg hjälp-sektionen
  gick: bandets andra kort sa samma sak som rutorna. Garantins remsa står kvar
  under, oförändrad. Två och två under 1100 px, en spalt under 340 px.
- **Ljuset** (borta med bentot): med mus lyser rutans kant i dess färg där musen är (en
  radiell gradient i border-box, som `.nx-bubbla`), ett svagt sken lyser
  inuti, och ett stort sken följer musen över rutnätet (`.bn-sken`, med
  translate). `--gx`, `--gy` och `--gn` är registrerade utan arv
  (`@property`): studievyns gamla lutning hackade för att variabeln ärvdes
  ner i hela fönstret.
- **Manifestet** (ScrollReveal): inga blad, bara rubriken, Rätt matchs
  mening och knapparna, med mer luft. Med GSAP går orden från suddiga till
  skarpa i takt med scrollen och rubriken rätar upp sig från tre grader;
  suddet bara på dator. Utan GSAP tonar orden fram som förut (ordfyllnaden).
- **Studievyn** har rubriken i mitten, och på dator tippar fönstret upp ur
  papperet med scrollen (rotateX 26 grader till noll) i stället för att resa
  sig en gång. Rundturens pekare räknar med offsetLeft, så den hamnar rätt
  också medan fönstret lutar.
- **Stjärnkanten** (StarBorder) på manifestets och Nästa stegs knapp: två
  ljusfläckar som glider längs kanten med translate. Står still med reducerad
  rörelse.
- ScrollTrigger mäts om när sidans höjd ändras (Just nu visas först när
  erbjudandet hämtats, och studiehjälparna fylls i efteråt).
För elever och föräldrar och Vår idé har kvar sina kopior av studievyn och
Hur hjälper vi som förut.


Fyra saker som kostade en omgång:

1. **`once`-scenerna i `NXMotion` avslöjade aldrig något.** Scenen
   markerades klar efter första anropet, och det kommer när elementet
   når observatörens marginal — innan det syns, med p = 0. Nödbromsen
   visade sedan ALLT efter två sekunder, så sidan såg frisk ut:
   33 av 33 block under vikningen på startsidan var synliga innan
   någon scrollat. Nu är en once-scen klar först när `run()` svarar
   något annat än `false`, och bromsen visar bara det som står i eller
   ovanför vyn. Gäller alla publika sidor.
2. **`preserve-3d` och en rullbar behållare går inte ihop i Chrome.**
   Studievyns fönster lutade mot pekaren. Med `transform-style:
   preserve-3d` gav `elementFromPoint` föräldern i stället för knappen
   i sidomenyn, och klicket gjorde ingenting. Sedan dess har Leo valt
   bort att illustrationen går att röra (fönstret är `inert`), men
   fällan gäller varje lutat lager med något klickbart i.
3. **`scrollIntoView` i en rad som flyttas med transform rullar
   sidan.** Förr visade `NX.initDrag()` kortet man tryckt på. I
   bandet, som klipps och förskjuts med transform, räknade Chrome fram
   ett mål 400 px bort och rullade hela sidan dit. Bandet är
   `overflow:clip`, inte `hidden`, av samma skäl: `hidden` gör det
   till något som går att scrolla. Kanterna tonas med två stilla
   gradienter, inte `mask-image`: en mask över något som rör sig ritas
   om varje bildruta i Safari.
4. **Det som fälls ut i bandet klipps.** Korten var knappar som
   fällde ut en längre text, och bandet klipper sin höjd, så texten
   syntes bara till hälften. Leo 2026-09-27: ta bort den. Korten är nu
   vanliga `div`:ar utan pil, `NX.initDrag()` finns inte längre, och
   de längre förklaringarna (kontrollen, betalningen,
   kommunikationen, uppföljningen) står inte kvar någonstans på
   startsidan. Kopiorna är `aria-hidden` och har egna id:n; en
   skärmläsare hör sex kort, inte arton.

**De mörka ytorna** har sedan 2026-09-25 en varmare bark på hela
sajten: `--nt` är `#2B221C` (var `#2E2A20`, en grönaktig olivbrun som
blev en lerig vägg mot papperet), och `--band-bg` följer med. Sektionerna
(`.nx-mork`, sidhuvudet och bandet på Bli studiehjälpare, "Nästa steg"
på prissidan) mörknar nedåt mot `--nt-2` (`#1F1915`) och har ett svagt
sken av lera och mossa ur `--nt-glod` och `--nt-mossa`, i cinemas DE
MÖRKA YTORNA. Skenet tonar ut före nederkanten, och det som följer
direkt på en mörk yta — footern, bandet under sidhuvudet — börjar i
`--nt-2` utan lera i överkanten: annars syns en ljusare rand där två
mörka block möts. Footern var därför `--nt-2` på alla sidor, och i mörkt
läge, där `--nt-2` är samma som `--nt`, barken. Sedan 2026-10-08 står
footern i `--ftr-bg` (`#1F1915`, ljusa lägets `--nt-2`) i båda lägena
(Leo, med en skärmbild av footern i ljust läge: "Ha denna färg på denna
sektion på både ljus och mörk vy"); i mörkt läge möter den Nästa steg på
`--pap` (`#1A1813`), nästan samma ton, så ingen rand. **Hero behåller den gamla tonen**
(`--nt-film`), för hero är orörd med flit.

Ytorna går kant i kant. En första version lade Bli studiehjälpare och
Nästa steg som rundade kort på papperet som växte in med `scale`; Leo
ville inte ha papperet runt dem. Nu står ytan still och innehållet
glider upp med klassen `.nx-framme` — aldrig `.nx-in`, för
`.nx-in .nx-rad-i` i cinema tänder rubrikens rader på en gång. Stegen i
ansökan och hållpunkterna står två och två på telefon (2026-10-08). Leo:
"Återkommande kolumner och slide funktion som inte är clean": fokuset som
förstorade kortet mitt i skärmen och gråade grannarna (`hållpunkter()`,
`.har-pa`/`.pa`, `:has(:hover)`) togs bort, och kort som sa samma sak som
något annat på samma sida togs bort (ett blad på Vår idé, rapportbladen på
För elever & föräldrar och Så fungerar Nextrum, tre fördelar och listan
01–03 på Bli studiehjälpare). `.sid-kort` är en lista under 861 px.

Studievyns markup byggs för båda språken ur samma mall, så att
taggsekvensen är identisk. Samma markup står på `for-elever-och-foraldrar.html`
(sv och en, 2026-09-25: den gamla `.nx-mock` stod kvar där). Ändras
den på startsidan ska den kopieras dit. `jamfor-sprak.py` rapporterar bara den
FÖRSTA strukturskillnaden, och på startsidan är den språkväljaren —
en skillnad längre ner syns alltså inte i verktyget. Jämför
taggsekvenserna med `difflib` när du ändrar i sektionen.

### Menysidorna i startsidans form (2026-10-06)

Leo: sidorna i menyn (de tre strecken) var "typ bara text och ingen nice
animation", och skulle ta efter startsidan efter hero och vyerna. De sex
är Vår idé, Så fungerar Nextrum, För elever & föräldrar, Bli
studiehjälpare, Priser och FAQ, på båda språken. De laddar
`nextrum-start.css` och `nextrum-start.js` och använder startsidans
delar som de är, med `nextrum-sidor.css` sist för det startsidan inte
har. **Texten är densamma ord för ord**; bara formen är ny. Det som
tillkom är etiketter (Nästa steg), lapparna på fotot och hoppen på FAQ:n.

- **Rubrik och tre stycken** (`nx-two`) blev manifestet: rubriken med
  `data-ordfyll` och styckena som `.nx-bubbla` med var sin figur i
  `.sid-kort` (två, tre eller fyra spalter). Ett blad med en enda mening
  som bär poängen är `.sid-stor`.
- **Listor med 01–04** blev hållpunkterna (`.nx-holdpunkter`, i tre med
  `.sid-tre`), och Före/Under/Efter och Först/Sedan/Löpande står som ord
  i `.sid-et` i stället för en siffra. Före, under och efter på För
  elever & föräldrar är fotokort (`.sid-bildkort`).
- **Stegen till första passet** på Så fungerar Nextrum är startsidans
  scen. Fotona står i markupen där, och sedan 2026-10-07 bygger
  `stegFoton` startsidans foton ur registret med alt-texten ur stegets
  `data-alt`, så den engelska startsidan har engelsk alt (se Stegscenen
  under Startsidan och prissidan i ny form).
- **Text bredvid ett foto** (Priset på Vår idé, Vem kan söka, Varför
  priset ser ut så här) är cinemas `.nx-split` på ljus botten.
- **Lapparna** på sidhuvudets foto är vyernas notiser: två korta
  sanningar ur sidans egen text, `aria-hidden`, och bara den första på en
  telefon. De fjädrar in när `sidhuvud` satt `.sid-framme`, två
  bildrutor efter start så att startläget hinner ritas.
- **FAQ:n är kort**, på alla sex sidorna: varje fråga ett blad med kant
  i lera när den är öppen. Utfällningen är `NX.initFaq` som förut.
  Markupen i `.faq-item` är orörd, för `bygg-faq-schema.py` och
  `bygg-maskotsvar.py` läser den med reguljära uttryck. FAQ-sidans
  grupper har en klistrad spalt med rubrik och figur, och piller under
  ingressen hoppar till dem.
- **Slutet** är `nx-final-cinema` på alla sex, med `.nx-framme` från
  `mörkaYtor`; Bli studiehjälpare och Priser hade kvar den gamla
  `nx-final`.

Betalningsmeningen står kvar på sina ställen (`kolla-betalningsvillkor.py`),
och priserna på Priser skrivs fortfarande av `initPris` och
`initErbjudanden`. En lapp med ett pris ska ha `data-stat="pris-inline"`,
aldrig `"pris"`: `initPris` räknar upp den FÖRSTA `"pris"` på sidan, och
det ska vara det stora priset.

`jamfor-sprak.py` ser bara första skillnaden, så sidparen jämfördes med
`difflib` över hela taggsekvensen: lika många taggar och textnoder, samma
attributnamn, och den enda skillnaden är språkväljaren. Baslinjen flyttade
sig två taggar (de nya `<link>` i huvudet), inget annat.

### Startsidan talar till föräldern (2026-10-06)

En genomgång av sajten (Leo: "gör allt") visade att startsidan talade till
den som söker jobb först: ingressen började med "första steg in i
arbetslivet", nästa block var ett ensamt kort till blivande
studiehjälpare, och priset och första timmen stod bara inne i demovyn.
Den som betalar är en förälder. Ändrat, på båda språken:

- **Heron.** Under knapparna står pris, första timmen, svar inom 24
  timmar och ingen bindningstid. Priset är en `data-stat="pris-inline"`, så
  startsidan anropar nu `NX.initPris()`. Raden är `.nx-hero-fakta`: `li`
  är ett block och pricken en inline-block, för som flex fick priset och
  resten av meningen var sin cell med glapp emellan. Etiketten
  "Läxhjälp i Stockholm" och en ingress till föräldern stod där en dag;
  Leo tog tillbaka "Nextrum" och den gamla ingressen 2026-10-07.
- **Det ensamma kortet** under manifestet ("Så hjälper vi unga") är borta.
  En dag stod en rad med ämnena, online och priset där; Leo tog bort den
  2026-10-07, så manifestet slutar nu med knapparna. Startsidan länkar
  till ämnes- och stadiesidorna bara från sidfoten och navet.
  `.nx-omr-kort > b` och `> span` är barnselektorer sedan dess.
- **Bort från startsidan:** de fyra numrerade hållpunkterna (de upprepade
  heron och bandet, och "Resultat som märks" lovade det FAQ:n säger att vi
  inte lovar) och "Vi bygger nästa generation tillsammans." Länken "Till
  föräldravyn" ledde en ny besökare till en låst vy; den är "Se priserna".
  `.nx-holdpunkter` och `.nx-statement` används kvar på menysidorna.
- **Exempelkorten** står under "Möt några av våra studiehjälpare." igen
  (Leo 2026-10-07; en dag stod "Så kan din studiehjälpare se ut."), med
  märket Exempel kvar på korten. **Märket tas inte bort** medan korten är
  påhittade: utan det står tre personer som inte finns, med AI-porträtt,
  som "våra studiehjälpare" för föräldrar som ska släppa in någon i
  hemmet. Vägen bort från märket är riktiga profiler (`visa_publikt`),
  som ritas av sig själva, och då tas `EXEMPELKORT` bort. Ett fel i hämtningen visar inte längre
  `error.message` för en anonym besökare (rå servertext bara i de
  inloggade vyerna).
- **Prova NexLäx** stod en dag efter studievyn och är borttaget
  (`minne/nexlax.md`).

### Startsidan och prissidan i ny form (2026-10-07)

Leo: "Du får göra sidan lite moderna generellt och coolare", med en lista
över delarna. Designspråket som delarna delar: papperet bär allt (inga nya
mörka block), stora tunga siffror (800, −.06em, tabular-nums, lera när de
är aktiva) i stegscenen, garantin och betalningen, flöden med en linje som
fylls med `scale` i stället för kolumner, och mobilen som en app: rader man
sveper i, med snäpp och prickar.

**Menyn bakom de tre strecken** har inga pilar ("ta bort pilarna när man
trycker på tre strecken"). De togs bort på de 30 handskrivna sidorna och i
skalet i `var-ide.html`, som `bygg-omradessidor.py` kopierar till de 28
genererade.

**NexLäx under heron.** Leo: "Under heron ska vi nu sälja in Nexläx gör
en cool genomgång av nexläx som är lika stor som hero bilden." Första
sektionen efter heron säljer in NexLäx med en telefon som visar sig själv
och en stig med fyra delar som följer med; papperet bär den, och
ämnesfärgerna får synas här men i ingen annan sektion. Allt som byter läge
ligger i fasta rutor: skärmarna i samma cell och, på mobil, delarnas text
i samma cell. Rundturen ändrar aldrig någon höjd (uppmätt: 1156 px på
1440×900 före och efter). Detaljer i `minne/nexlax.md`.

**Efter granskningen (2026-10-07):** stegscenens öppna steg har en fast
höjd (`--hur-rader`, 2 rader, 3 under 1241 px) i stället för max-height,
så att rubriken står helt stilla; den fastnålade rutans foto har `--sk-2`
(`--sk-foto` klipptes i en rak kant). Garantins släckta text byter till
`--bl-3` i stället för opacity .4 (ungefär 2:1), och linjen ligger 78 %
ned. Prisraden överst på prissidan tänds med `data-stig`, inte `.rv`,
som var osynlig utan JS. `radAvslöj()` bygger rubrikens namn med
mellanslag mellan raderna. Kalkylatorn visar "8 timmar för priset av 7"
i stället för märket bredvid noten om första timmen, och ingressen och
betalflödets steg 2 nämner inget antal planer eller planens namn, för de
står kvar när planerna saknas i svaret.

**Stegscenen** (Från intresseanmälan till första passet, startsidan och Så
fungerar Nextrum, sv och en; Leo: "bättre animation mellan bilderna på
datorvy och mobil ska även få den animation. Stegen ska visas bredvid
bilderna. 01 osv ska vara större. Och svepningen ska fungera på
mobilen"). En markup och en kod: `stegFoton()` i `nextrum-start.js`, grunden
i cinema och formen i `nextrum-start.css` avsnitt 14.
- Lägena läses ur `html[data-motion]` vid varje händelse (`M.tier`, aldrig
  en `const` från laddningen). `full` (mus, över 900 px) är den pinnade
  scenen, 230svh. `lite` (pekskärm eller högst 900 px) är samma `ol` som
  scroll-snap-rad i samma rutnätscell som fotot (`container-type`, `cqi`,
  `display:contents` på `.nx-hur-text`, aldrig på ol eller li). På en
  platta liggande står texten till vänster och raden till höger.
- Allt rörligt kräver `html.nx-sr` och `.igang` på sektionen. Grunden i
  cinema har alla steg öppna; det är läget utan JS och med reducerad
  rörelse. Förut fastnade en platta i en scen som aldrig bytte steg, och
  steg 2–5 var dolda utan JS.
- Fotots övergång står i klasserna `.pa`, `.forbi` och `.tyst`: det nya
  glider in över det gamla, som sjunker bakåt i mörkret, och bilden landar
  med Ken Burns. Bara translate, scale och opacity; clip-path är bortvalt
  (avsnitt 9). `.tyst` sätts på fotona emellan när man hoppar över steg,
  så att de inte far genom ramen.
- Siffrorna 01–05 är stora (800, −.06em) och växer med fjädern till lera;
  en linje fylls ner till steget man står på; ett märke på fotot
  (`.nx-hur-mark`, aria-hidden) kopieras ur stegets `em` och `h3`.
- Fällor: (1) `.nx-hur-bild` måste vara en egen staplingskontext
  (`isolation:isolate`), annars hamnar fotot över raden och svepet når den
  aldrig. (2) Fråga `intersectionRatio >= .6`, inte `isIntersecting`. (3)
  Rulla raden med `scrollTo`, aldrig `scrollIntoView`. (4) Det mörka bakom
  fotot ligger 1 px innanför ramen, annars blöder det fram i de rundade
  hörnen som en hårlinje i ljust läge. (5) `sizes` räknar med att 16:9
  ritas i ett högt format: `(max-width: 900px) 180vw, 100vw`. (6) Den
  öppna texten är 46ch i det pinnade läget, så att rubriken inte glider
  när steget byts (på 1024×768 glider den fortfarande 12 px, mjukt).

**Garantiflödet** (borta sedan 2026-10-08, se Prissidan utan garantisektion
nedan; står kvar här som historik). `#betygsgaranti` lämnade `.nx-mork` och `.nx-apply-flow`
(som är kvar i #bli och på Bli studiehjälpare, och sköts av
`mörkaYtor()`). Markupen är `section.nx-sek-s.nx-gar >
.nx-gar-in` med `.nx-gar-head`, `ol.nx-gar-flode[data-gar-flode]` (li >
`span.nx-gar-nr` + `div.nx-gar-steg`) och `.nx-gar-cta`, på startsidan (till
2026-10-08, då sektionen bakades in i Hur hjälper vi ditt barn) och
prissidan (där i `.wrap`, för att linjera med priskorten). CSS i
nextrum-start.css avsnitt 15, JS i `garantiflöde()`. Skriptet sätter `.pa`
(tänt) och `.fylld` (sträckan nedåt fylld; på sista steget svansen när alla
är tända) när en siffra passerar en linje 62 % ned i fönstret, och läser
då om alla fyra siffrornas läge, så att ett ankarhopp ger rätt läge.
Första läget räknas innan `.i-gang` sätts. Fällor:
- Startläget kräver `.i-gang`, annars fastnar stegen nedtonade där
  IntersectionObserver saknas.
- `data-stig` får aldrig sitta på listan eller stegen: (0,3,1) slår ut
  nedtoningen.
- Linjen fylls med `scale`, aldrig `height`. Nästa siffra tänds .3 s efter
  att linjen börjat, bara på vägen in.
- `.nx-flode`, `[data-flode]` och `.pr-flode` hör till prissidans
  betalflöde, inte garantin.

**Manifestets blad bredvid varandra** (borta sedan 2026-10-29, se Startsidan får en ny form). Leo: "På mobil vyn ska de
kolumnerna under rätt person kan göra stor skillnad bredvid varandra." Två
spalter ner till 340 px (under det en). Varje blad har en h3, Rätt match
och Allt på ett ställe (The right match, All in one place). Bladet är ett
rutnät med `grid-template-rows:subgrid`, så texterna börjar på samma höjd.
På dator tar bladen hela bredden (förut slutade de vid 1000 px). På
telefon är det 14–21 tecken per rad, långt under bekväma 45–75: det är
vad två spalter på en telefon ger, och Leo bad om det. Safari avstavar
svenska (`hyphens:auto`), Chromium på Linux gör det inte.

**Studiehjälparna i en rad man sveper i.** Leo: "bredvid varandra på
mobil vyn så att man swipar som ett inlägg". En flexrad med scroll-snap i
alla bredder: ett kort och en kant på telefon, två på platta, tre som
fyller raden på dator. `overflow-y:hidden` står med flit, annars tar raden
det lodräta svepet på iPhone. Prickarna är inga knappar; pilarna finns bara
med mus och när korten inte ryms, och etiketterna står i markupen. Korten
stiger upp med `transform-origin:0 100%`: ett kort som sköts in från sidan
flyttade snäppunkten, och raden rullade 75 px av sig själv. En
`focusin`-lyssnare rullar raden till ett kort man tabbar till. Märket
Exempel står kvar, och `EXEMPELKORT` och `laddaShowcase()` är orörda.
Prova: en elementbild som är högre än vyn byter fönstrets mått i
Playwright och tappar pekskärmsemuleringen; ta bilden med
`page.screenshot({clip})`.

**Prissidan** (2026-10-07):
- Planerna: tre kort i en rad, Standard i mitten med bandet Vårt tips
  ovanför. Varje plan har en rad rutor, en per timme, och timmen på köpet
  är i lera (dekor, `aria-hidden`). Klippkorten är en egen bred rad
  (`<details>`).
- På telefon (högst 760 px) är planerna en rad man sveper i, som börjar
  med Standard i mitten: `svepraden()` i nextrum-app.js sätter `scrollLeft`
  en gång och aldrig medan någon rört raden. Prickarna sätts av en
  IntersectionObserver med raden som rot.
- Lyftet `.pr-lyft` under starterbjudandet säljer Standard med siffrorna
  ur samma svar; toppens priskort sträcks bara när lyftet syns.
- Startsidans lapp `.pr-std-lapp` i #plattformen togs bort 2026-10-08
  (Leo: "den passar ej in där"). Standard säljs i stället av Just nu
  (`#just-nu`, avsnitt 16 i nextrum-start.css) under NexLäx: Standard mot
  "Andra aktörer" 5 000 kr, med vårt pris och procenten ur samma svar
  (`data-erb-jamfor-ore`, `data-erb-lagre`, `data-erb-andel`,
  `data-erb-vantar` i `initErbjudanden()`). Procenten avrundas nedåt till
  fem, och sektionen döljs om planen inte har 8 timmar eller inte är minst
  5 % billigare, så att påståendet inte blir osant när ett pris ändras.
  Sedan 2026-10-08 står Just nu under Hur hjälper vi ditt barn, procenten
  avrundas till hel procent, och bara jämförelsen döljs (se nedan).
- Så fungerar betalningen är ett flöde med pilar (`ol.pr-flode
  [data-betalflode]`, `betalflöde()`, CSS i nextrum-sidor.css): vågrätt
  på dator, där stegen och pilarna tänds i tur (`.ar-igang`), och lodrätt
  med pilen nedåt från 1100 px, där varje steg tänds när det passerat
  mitten (`.ar-nadd`). Betalningsmeningen står en gång i flödet och en
  gång i FAQ:n (fakturameningen gick med fakturan 2026-10-21). `.nx-holdpunkter` är kvar på Vår idé och För
  elever & föräldrar.

### Startsidan med en röd tråd (2026-10-08)

Leo, kortfattat: "flytta ner nexläx, första sidan hur hjälper vi ditt barn.
Sen efter de erbjudande som vi gör om som jag förklara. Sen vår ide, sen
under de flytta upp illustration av studievyn. Sen illusion av nexläx
sektionen. Sen intresseanmälan till första passet. Betygsgarantin ska inte
ha en egen sektion, den ska bakas in i första sektionen [...] Omdömen flytta
upp de över för dig som vill jobba." Och: "Hela sidan ska enkelt sagt ha en
röd tråd. Implementerar några färger från nexläx sektionen till resten av
sidan där färgerna passar in."

**Ordningen**: hero, Hur hjälper vi ditt barn (`#sa-hjalper-vi`), Just nu
(`#just-nu`), Vår idé (`#om`), studievyn, NexLäx (`#nexlax`), Från
intresseanmälan till första passet (`#hur`), studiehjälparna, Trygg hjälp
(`#plattformen`, borta sedan 2026-10-29: bentot bär den), bildväggen, omdömena (`#rost`, brevet), För dig som vill
jobba (`#bli`) och Nästa steg. Sist före footern stod 2026-10-10 till 2026-10-13 Läxhjälp för just ert barn (`#laxhjalp-oversikt`): fyra grupper med länkar till alla läxhjälps- och guidesidor i `<details>`, för internlänkningens skull. 2026-10-12 blev grupperna stängda på alla bredder och fick glida upp med ett tryck (Leo: "ha de inbäddade i ämne, årskurs, område och guider så man behöver trycka på de för att få upp dem", "gör de lite mer smooth"), och ytan blev svart i ljust läge, footerns `--ftr-bg`. Dagen efter frågade Leo vart landningssidorna försvunnit: fyra hopfällda rubriker på samma svarta som footern direkt under såg ut som en del av footern. Först blev de öppna på datorn och stängda på telefonen, och samma kväll togs sektionen bort (Leo: "skit i att lägga tillbaka de, lägg in de längst ner vid de andra landingssidorna och gör de snyggt"). Länkarna står nu i footerns block Läxhjälp (`.ftr-lax`, cinemas FOTEN), på varje publik sida och båda språken, i stället för footerns gamla spalt Läxhjälp med sju länkar: rubriken och en rad till vänster, i första spalten (27 % över 1100 px, som märket i raden ovanför, så att grupperna börjar där Nextrum-spalten börjar), och de fyra grupperna med ämnesfärgens prick i ordningen från avsnitt 18, `-l`-syskonen eftersom footern är mörk i båda lägena. Guiderna har den bredare spalten (1,6 mot 1) så att de står på en rad på datorn, och "årskurs 6" och "årskurs 9" hålls ihop med `&nbsp;`. Under 820 px står grupperna två och två. Sedan 2026-10-26 är gruppen Område navets regioner (Hela Stockholm, Innerstaden, Söderort, Västerort, Norr och väster om stan, Söder och öster om stan), Online och In English, inte en länk per ort: orterna blev trettio, och de står i navets ortskatalog (`minne/genererat-och-ci.md`). Footerns länkar väger något mindre hos Google än en sektion i innehållet, men nu länkas varje landningssida från alla publika sidor i stället för från två. En ny sida i kartan läggs in i blocket på alla sidor (`var-ide.html` är `bygg-omradessidor.py`s källa till skalet). Sektionerna flyttades som hela block mellan
kommentarsbanderollerna, likadant på /en/; numren i banderollerna är gamla.
Hero är orörd utom priset (399 kr, `data-stat` ur `nextrum-config.js`).
Studievyns exempelpass står också på 399 (`data-sd-pris` skrivs ur `CFG`).

**Hur hjälper vi ditt barn** ("genom våran läxhjälp, exeperitsi,
årserfarnhet inom läxhjälp, betygsgarantin och nexläx"): fem blad i ett
rutnät (avsnitt 17 i nextrum-start.css), tre i första raden och garantin
bred bredvid NexLäx på dator, två och två på platta (`grid-auto-flow:dense`,
garantin över hela raden), en spalt med figuren till vänster på telefon.
Varje blad har en ämnesfärg ur NexLäx i `--f` (läxhjälpen matematikens blå,
expertisen engelskans lila, erfarenheten NO:s gröna, NexLäx moderna språkens
rosa; garantin leran). **Erfarenheten är studiehjälparnas**, aldrig bolagets:
Nextrum startade hösten 2026, och sidan säger inga år (CLAUDE.md, avsnitt 8).
Alla påståenden fanns redan på sajten (intervjuade och utbildade, nyligen
läst samma kurser, matchning efter ämne, nivå, behov och personlighet).
- **Betygsgarantin** har ingen egen sektion längre (andra varvet samma dag
  blev bladet en platt remsa under de fyra andra, se "Garantin som en
  remsa" nedan; det här är hur det var). Bladet bar
  `id="betygsgaranti"` (länken i Nästa steg landar där, `scroll-margin-top`),
  den gamla sektionens text, länken till villkoren och "Villkor gäller ..."
  ordagrant, och de fyra stegen (01 Välj ämnena ... 04 Vi står kvar) som ett
  litet flöde: `ol.nx-gar-flode.nx-gar-liten[data-gar-flode="tur"]`.
  `garantiflöde()` sätter `.i-gang`, och när flödet syns `.pa` och `.fylld`
  på alla fyra på en gång; fördröjningen per steg (`--d`) står i CSS.
  Fällor: avsnitt 15 lägger `.nx-gar-flode` i ytan `flode`, som inte finns i
  bladets rutnät (då hamnar flödet i en implicit cell och texten i en
  spalt på 100 px), så det lilla flödet har `grid-area:auto`; och regeln som
  fördröjer två tända steg i rad väger (0,6,3), så de små stegens regler bär
  `.nx-gar-flode.nx-gar-liten` och `:nth-child(n)`.
- NexLäx-bladet har en liten väg med fyra noder i ämnesfärgerna (SVG,
  `aria-hidden`), som poppar fram när bladet stigit in.

**Just nu, omgjort** (Leo: "Läxhjälpen ska kosta 399kr standard obundet. Sen
på våra paket blir man bunden i 1 månad och de kostar 379kr [...] spara upp
till 1200kr vid 6 månader", "Pris ska ändras andra aktörer 5000kr +", "inte
från utan för", "en lite rolig slogan", och tejpen "som tejpas fast på
erbjudandet, så förstora det"). Vänster: "Just nu", sloganen ("Läxorna får
vara kluriga. Priset behöver inte vara det.", andra meningen i NexLäx
gradient) och två prisrutor: "Läxhjälp utan bindning för 399 kr i timmen"
(`data-stat="pris-inline"`, "Det är priset, inte ett från-pris") och "Paket,
en månad i taget, för 379 kr i timmen" (`data-erb-rabatterat`, Standards
timpris; alla tre planerna kostar lika i timmen, och gör de det inte längre
ska raden skrivas om) med lappen "Spara upp till 1 440 kr på 6 månader"
(`data-erb-spara="6"`; beloppet räknas ur databasen, inte Leos 1 200).
Höger: jämförelsen "Andra aktörer 5 000 kr+" mot "Nextrum Standard" med
staplarna, och tejpen `.nx-tejp.nx-tejp-pa` över rutans överkant, större än
på prissidan och tillåten att sticka ut 14 px på var sida. Figuren har
eget `data-erb` med `data-erb-jamfor-ore`, så om jämförelsen inte håller
döljs bara den (och tejpen), och erbjudandet står kvar; sektionen döljs
bara om Standard saknas. Inget av våra priser står i HTML.

**Just nu 2026-10-09** (Leo om "Det är priset, inte ett från-pris": "gör det
snyggare på erbjudande liknande till gula tejpen"; om "Jämförelsen gäller 8
timmar läxhjälp i månaden": att den "är gjord baserat på priser för åk 9
läxhjälp"; och om bindningen, efter frågan om villkoren: "De är ingen
bindning för man köper ett erbjudande som ska förbrukas på en månad ta bort
bindningstid inget är de"):
- Den vänstra rutan heter "Läxhjälp, pass för pass" (förut "Läxhjälp utan
  bindning"): ingen av de två binder, så "utan bindning" ställs aldrig mot
  paketen. Samma sak på prissidan (ingressen, spara-raden "mot att betala
  pass för pass", kalkylatorns "Pass för pass, fyra veckor", sedan
  2026-10-12 "Månadskostnad, pass för pass") och i båda
  FAQ-svaren om att sluta ("varken pass för pass eller med en plan").
  Paketen heter fortfarande "en månad i taget", som villkoren tål.
- "Det är priset, inte ett från-pris" är en liten tejp (`dd.nx-tejp.jn-fast`,
  avsnitt 16 i `nextrum-start.css`): "Det är priset" stort och "inte ett
  från-pris" litet, i flödet längst ner i rutan som spara-lappen bredvid,
  lutad 2° åt andra hållet än jämförelsens, och fastsatt med samma
  `nx-tejp-fast`. Under 400 px står varje rad utan radbrytning och tejpen
  får gå 10 px ut i rutans kant.
- Figurens rad: "Jämförelsen gäller 8 timmar läxhjälp i månaden och bygger på
  priser för läxhjälp i årskurs 9." Underlaget är Leos (CLAUDE.md avsnitt 11).

**Spararaden och första timmen 2026-10-09, andra varvet** (Leo: "skriv spara
upp 1359 på 6 månader med standard planen", "gör samma beräkning för bas och
intensiv och skriv de i sina platser, men under erbjudande på main front end så
skriver du sparandet för 6 månader. gör med utropstecken också", "räkna in ...
399kr extra för att första lektion är gratis"). Jag sa först nej till 1 359 kr,
för då fick alla nya familjer första timmen, med eller utan plan, och en timme
alla får är ingen besparing med planen. Leo bytte regeln samma kväll: första
timmen ges bara med en plan (`minne/betalning.md`), och då är talet sant.
- Just nu: "Spara upp till 1 359 kr på 6 månader med Standardplanen!" och under,
  mindre, "Första timmen gratis ingår." (`data-erb-spara-kod`,
  `data-erb-spara-forsta`, `.jn-spara small`).
- Prissidan: raden överst är Standards, "... med Standardplanen! Mot att betala
  pass för pass, med första timmen gratis.", och varje plankort har en lapp
  längst ner (`.pr-erb-sex` i cinema): "Spara upp till 879 / 1 359 / 1 839 kr
  på 6 månader!" och "Första timmen gratis ingår.". Talen räknas ur svaret;
  de i HTML är reserven.
- Första timmen står som "gratis med en plan" i heron, prissidans
  starterbjudande ("Första timmen gratis", "Köp er första plan, så får ni en
  timme till, gratis."), kalkylatorns not, FAQ:n, affischen,
  områdessidornas generator och föräldravyn.

**Manifestet**: "Allt på ett ställe" trycker på plattformen ("Allt finns i
en och samma plattform: studieplan, bokning, rapporter, NexLäx och
betalning ...", Leo: "överstig ej så att texten blir längre än den
bredvid"): 141 tecken mot Rätt matchs 155 (144 mot 167 på engelska).
Bindningstiden står inte där längre. Leos "bunden i 1 månad" blev "en
månad i taget" överallt, för villkoren säger ingen bindningstid (2026-10-08).

**För dig som vill jobba** ("ändra färg till den svarta som är på
mörksidan. Och på mörksids ska för dig som vill jobba ha samma färg och inte
en gråare", "lite mer orange runt olika kolumner"): `#bli` står på
`--bli-bg` (#1A1813, mörka lägets papper) i båda lägena, med ett sken av
lera i två hörn och en linje av lera i överkanten (i mörkt läge står ytan i
ett med sidan, och det är linjen och kolumnerna som avgränsar). Fotot har en
ram av lera (`outline`), punkterna och ansökans fyra steg kanter i
`--bli-kant`, och stegens siffror står i ljus lera. Nästa steg följer direkt
efter sedan omdömena flyttade upp; `#bli + .nx-mork` börjar i samma svarta
och mörknar mot `--nt-2`, så att ingen skarv syns mot footern. Bara `#bli`:
Bli studiehjälpare-sidan har samma lista och står kvar (till andra varvet
samma dag, se "Garantin som en remsa" nedan).

**Den röda tråden**: ämnesfärgerna står på bladen i Hur hjälper vi ditt
barn, i rubrikens "ditt barn?" och sloganens andra mening (samma gradient som
NexLäx rubrik; de två står i leran sedan samma kväll), och på stegens siffror, linjen och fotots märke i `#hur`
(`--f` per `:nth-child`, reglerna läser `var(--f,var(--acc))`). Märkets siffra
står i `--kort` på färgen, för krämen på NO:s gröna var 4,4:1. Samma kväll
fördes de ut på resten av startsidan och menysidorna, också Så fungerar
Nextrum (nästa avsnitt). I vyerna står ämnesfärgerna fortfarande bara i NexLäx.

**Papperet** ("en liten mindre beige nyans på bakgrunden [...] väldigt lite"):
`--pap` #F2EDE3 → #F1EDE6, 30 % lägre kroma i OKLCH och samma luminans, så
varje kontrast mot bläcket är oförändrad. `--pap-2`, `--pap-3`, `--bricka`,
`--ln` och `--ln-2` följde med lika mycket (papper mot lugn yta 1,11:1 som
förut), också i formulärens ljusa öar i mörkt läge. `theme-color` i alla
sidor och i `bygg-omradessidor.py` följer; mejlens `FARG` och
delningsbildernas textfärg i `bygg-delningsbilder.js` (#F2EDE3 som text på
foto) är orörda.

### Ämnesfärgerna överallt, NexLäx och Hur hjälper vi på menysidorna (2026-10-08)

Leo: "De var bra med de nexläx färgerna du implementera, gör de på flera
delar på sidan och de separata sidorna ockps." Och: "På föräldrar och elever
sidan lägg in nexläx illustration under illustration av studie vyn", och "Så
hjälper vi ska också in på vår idé sidan så ta bort bakrunden där som jag
skicka bild på och ersätt."

**NexLäx på För elever & föräldrar**: startsidans `section#nexlax`, ordagrant,
direkt efter studievyns sektion, på båda språken. `nexlax()` tar den första
`[data-nexlax]` på sidan och kör samma rundtur. Länken Se studievyn är borta
där (studievyn står direkt ovanför, så den hade bara rullat en skärm upp).
Id:na (`nexlax`, `nexlax-t`, `nlx-del-0`–`3`) finns inte annars på sidan.
Ändras sektionen på startsidan ska den kopieras hit.

**Hur hjälper vi på Vår idé**: Bakgrunden ("Den som nyss förstått något
förklarar det bäst.", två blad) är borta, och startsidans
`section#sa-hjalper-vi` står i dess ställe, ordagrant utom NexLäx-bladets länk,
som går till `/for-elever-och-foraldrar#nexlax` (`/en/...` på engelska), för
sidan har ingen egen NexLäx. Tanken i Bakgrunden bär Erfarenheten ("Från
samma skolbänk"). Garantins blad har `id="betygsgaranti"`, som inget annat på
sidan har; länkarna till `/#betygsgaranti` från andra sidor går till
startsidan som förut. Det lilla flödet tänds i tur (`garantiflöde()`), och
villkorslänken och "Villkor gäller" följer med.

**Färgerna, två regler** (avsnitt 18 i nextrum-start.css, så att samma sorts
sak alltid har samma färg; en tredje, betoningen, gick samma kväll, se sist):
- **Ordningen**: i en rad blad eller steg får det n:te bladet färg n,
  matematikens blå, engelskans lila, NO:s gröna, leran, moderna språkens rosa
  (samma ordning som Hur hjälper vi och `#hur`), och SO:s ockra som sjätte i
  Trygg hjälps band (sex kort; `band()` kopierar hela uppsättningar om sex, så
  `:nth-child(6n+k)` håller). En regel sätter `--f` på barnen i
  `.nx-manifest-fot`, `.nx-holdpunkter`, `.sid-kort`, `.sid-bildkort`,
  `.nx-apply-flow`, `.nx-perks`, `.pr-flode` och `.sid-faq`, och `.nx-hur`
  (förut bara `#hur`) har sina egna. Delarna läser `var(--f, sin gamla
  färg)`: siffrorna (`.hp-nr` står i färg också i vila nu, `.nx-apply-step
  em`, `.pr-flode-nr`), figurerna (`.bu-fig`, `.dr-fig`, `.hp-mark`,
  `.nx-perk .i`, `.sid-faq-ikon`, `.pr-flode-ikon` och pilen),
  etiketterna (`.sid-et`: Först/Sedan/Löpande, Före/Under/Efter) och ljuset i
  `.nx-bubbla`s hörn. Aldrig texten, och en färg per blad.
- **Ämnet**: studiehjälparnas ämnen på startsidan får ämnets färg.
  Skriptet i `index.html` (och `en/index.html`, samma funktion) sätter
  `data-amne` ur namnet, på svenska ur databasen eller på sidans språk ur
  exempelkorten; Studieteknik har ingen färg och står kvar grått.
- **Betoningen** (borta sedan samma kväll): gradienten i "ditt barn?" stod
  på menysidornas `<em>` i rubriken överst (`.nx-page-hero .nx-d1 em`), på
  Nästa stegs `<em>` på alla sidor och på citattecknen i bildväggen och
  brevet. Leo: "Överallt där rubriken är med den färgen när de inte gäller
  nexläx lägg de tillbaka till antingen vit eller orange som de har förut".
  Gradienten står nu bara i NexLäx rubrik (`.nlx-rubrik em`); "ditt barn?"
  (`.hj-rubrik em`) och menysidornas rubriker föll tillbaka på `.nx-d1 em`
  och `.nx-d2 em` (`--acc-lugn`), Nästa steg på `--lera-l`, citattecknen på
  sin lera, och Just nus slogan fick `--acc-lugn` som rubrikens "nu".
  Citattecknen är ingen rubrik, men samma gradient utanför NexLäx, så de
  gick med.

Garantin har leran (remsan i Hur hjälper vi; prissidans flöde gick samma kväll), och erbjudandena på
prissidan och Just nu är orörda (en annan byggare arbetade där samma dag);
prissidan fick färgerna bara genom `nextrum-sidor.css` (betalflödet och Nästa
steg), `priser.html` är orörd. På bark (`.nx-mork`, `.band`, `.on-band`)
byts `--amne-*` mot `-l` på ytan, som cinema byter leran. **Kontrasten**,
mätt i Chromium på 360 px i båda lägena: all liten text i färg klarar 4,5:1
(lägst 5,19, NO:s gröna mot `--kort`); NO:s gröna mot `--pap-2` är 4,26, så
där står bara stora siffror och figurer. Studiehjälparnas taggar (9,5 px)
tappade AA på sin egen ton (4,44), så deras text har en sjättedel `--bl` i
sig (`color-mix`), vilket höjer kontrasten i båda lägena. Mät ett blad med
`--kort` som bakgrund: bladet målar den som en gradient, inte som
`background-color`.

### Garantin som en remsa, Bli studiehjälpare i svart och Nästa steg i mörkt läge (2026-10-08, andra varvet)

Leo: "Gör betygsgarantin mindre skriv Vi erbjuder betygsgarantin för att vi
är säkra på våra metoder. 01 - 02 - 03- 04 ska stå under de fyra kolumner
platt sådär - - - -. och bara meningen över och villkorl under. På bli
studiehjälpare på landningsidan ska den ha samma färg som main sidan på
mörkvy och ljus. På mörkvy ska alla redo att ta nästa steg matcha med den
mörka färgen på sidan på main och alla landingssidor. De är lite svårt att
särskilja färgen på mörk och ljus vy ibland när de finns kolumner osv. Gör en
liten orange skuggad runt kolumner osv och andra färger där de färgerna
finns redan."

**Garantin som en remsa** (avsnitt 17, startsidan och Vår idé, båda
språken). Hur hjälper vi ert barn (rubriken "ert barn?" sedan 2026-10-09,
Leo; förut "ditt barn?", och på engelska "your child?" som förut) har på Vår idé fyra blad i en rad, och
på startsidan sedan 2026-10-29 bentot (se Startsidan får en ny form) (läxhjälpen,
expertisen, erfarenheten, NexLäx; två och två på platta och telefon, en
spalt under 340 px), och under dem står garantin som en låg remsa med kant
av lera (`div.hj-gar#betygsgaranti`, utanför `ul.hj-grid`): meningen "Vi
erbjuder *betygsgarantin* för att vi är säkra på våra metoder." ("We offer
the *grade guarantee* because we are confident in our methods.") med en
liten sköld, de fyra stegen i en rad (`ol.hj-gar-steg`, bara siffra och
rubrik: 01 Välj ämnena, 02 Håll takten, 03 Se allt i er vy, 04 Vi står
kvar; 02 hette "Kör hela läsåret" till 2026-10-09, då Leo tyckte att det var
"lite dåligt": "Håll takten", "Keep the pace", säger det villkoren kräver,
jämna pass och uppgifterna i tid, utan en siffra) och "Villkor gäller." med länken till villkoren (samma `href` som
förut). Rubriken "Går betyget inte upp, fortsätter vi", stycket, raden om
andra ämnen och stegens beskrivningar gick med bladet. Meningen lovar inget
betyg (CLAUDE.md, avsnitt 1).
- **Varje steg står under sitt blad** på bred skärm: remsan har ingen egen
  luft i sidled, stegen har rutnätets kolumner och mellanrum (`--mellan`),
  och siffran står bladens luft (`--pad`) in. På telefon står de fyra kvar
  i en rad (Leo: "platt", aldrig staplade) med remsans egen luft
  (`--steg-in:0`, rubrikerna 0,78 rem och två rader).
- **Strecket** från siffra till siffra är `::before` (spåret, `--ln-2`) och
  `::after` (fyllnaden, lera) som grid-celler bredvid siffran, med negativ
  `margin-right` ut över mellanrummet och nästa stegs luft, som pilen i
  prissidans betalflöde. Efter 04 tonar det ut mot kanten. Fälla: ett
  steg med kort rubrik sträcks till radens höjd, och utan `align-content:
  start` delade raderna i det på luften, så att siffran sjönk ur linje.
- **I tur**: `data-gar-flode="tur"` som förut; `garantiflöde()` behövde
  ingen ändring (i tur söker den inte siffran). Släckt: siffran i
  `--ln-2` och `scale:.86`, rubriken i `--bl-3`, fyllnaden `scale:0 1`;
  provat med rörelse på 1280 och 390 (01 tänd och strecket på väg mot 02
  efter 0,7 s, alla fyra tända efter 3 s).
- `.nx-gar-liten` och dess fällor är borta; det stora flödet (`.nx-gar`)
  stod kvar på prissidan till samma kväll (nästa avsnitt).

**Bli studiehjälpare i svart** (avsnitt 10). Sidhuvudet och bandet under
det har klassen `bli-svart` (båda språken) och står i `--bli-bg` i båda
lägena, som `#bli`: lerans sken uppe till höger i sidhuvudet och nere till
vänster i bandet, en ram av lera runt fotot (`outline`), fördelarna och
stegen med kanter i `--bli-kant`, etiketterna i ljus lera, och en linje av
lera i bandets nederkant i stället för bandets grå kant (i mörkt läge möter
bandet papperet i samma svarta). Väljarna har tre klasser
(`.band.on-band.bli-svart`), för cinemas `.on-band + .on-band:not(.ftr)`
väger (0,3,0); de gemensamma reglerna med `#bli` står som
`:is(#bli,.bli-svart)`. **Kontrasten**, mätt i Chromium: kräm 14,3:1,
dämpat 7,5:1 (mörkt läge 6,7:1), ljus lera 6,1:1, stegens blå siffra 8,6:1,
knappen (kräm med barkens text) 12,6:1. Formuläret står på papperet under
och är orört.

**Nästa steg i mörkt läge** (cinema, DE MÖRKA YTORNA). På alla sidor med
`.nx-mork.nx-final-cinema` (menysidorna, de genererade sidorna, och startsidan till
2026-10-29, då dess Nästa steg började följa sidans läge: Raden som glider ovan)
står ytan i mörkt läge på `--pap` (#1A1813) med ett svagt ljus av lera mitt
bakom rubriken som inte når kanterna, i stället för barkens #262319; footern
under står kvar i barken. Ljust läge som förut. Efter `#bli` (startsidan)
väger `#bli + .nx-mork` (1,1,0), så den har egna regler för mörkt läge i
avsnitt 10. Där fortsätter också `#bli`:s sken nere till vänster över
gränsen, i båda lägena: samma bredd (70 %) och mitten i hörnet på båda
sidor om gränsen ger samma färg längs gränsen, så skenet klipps inte av
(förut syntes en kant där det tog slut).

**Inget sken runt korten** (Leo samma dag: "skit i de oranga osv runt
kolumner de blir för mycket och tror de kommer göra sidan svår"). Ett sken
av lera runt alla kort byggdes och visades som jämförelse; det ligger inte
i sajten. Korten skiljs från botten med `--kort`, `--kort-kant` och
skuggan, som förut.

### Prissidan utan garantisektion (2026-10-08, tredje varvet)

Leo: "ta bort betygsgarantin som är öndödigt stor på pris sidan. Den finns
redan på andra sidor. Ha bara en länk under Intresseanmälan på 399kr/h där
de står läs mer om betygsgarantin".

- Sektionen `#betygsgaranti` på prissidan är borta, på båda språken, och
  med den det stora flödet: `.nx-gar*` (avsnitt 15 i nextrum-start.css,
  där det nu bara står en gravsten) och grenen i `garantiflöde()` som
  följde scrollen. Funktionen tänder bara remsans steg i tur
  (`[data-gar-flode="tur"]`).
- I 399-kortet står raden "Betygsgaranti, utan extra kostnad (villkor
  gäller)", utan länk (den gick till sektionen), och under knappen Skicka
  intresseanmälan står länken "Läs mer om betygsgarantin"
  (`a.nx-lank.pr-gar-lank`, cinema efter priskortets flexregler) till
  `/anvandarvillkor#betygsgaranti`. Villkoren och inte startsidans remsa,
  för remsan säger mindre än raden man just läst. "(villkor gäller)" står
  på raden med löftet, för sektionens "Villkor gäller." gick med den, och
  avsnitt 1 kräver att prissidan säger att villkoren gäller, inte bara
  länkar till dem (granskningen samma kväll; FAQ-svaret ligger i en
  utfällning). FAQ-svaret längre ner står kvar.
- Länken är ett eget block (`display:block`, `width:fit-content`): i
  kortets flexkolumn (när lyftet syns) hade den annars sträckts, och som
  inline hade den hamnat bredvid knappen. Inte flex: den engelska texten
  bryts under 390 px, och i en flexrad stod pilen då ensam i högerkanten;
  pilen är inline och följer sista ordet. Tryckytan är 44 px med
  `::before`.

### Vad är Nextrum (2026-10-08, fjärde varvet)

Leo: "första sektionen så hjälper vi ska heta vad är Nextrum, och under i
korta beskrivningen skriver du detta: Nextrum erbjuder prisvärd läxhjälp
där elever matchas med en studiehjälpare som passar deras behov. Vi hjälper
elever att förstå mer, känna sig tryggare i skolan och utvecklas över tid."
Sedan "skriv där ditt barn istället för elever", och till sist "Så hjälper
vi ska vara vad är Nextrum och behåll så hjälper vi ditt barn som rubrik",
och sist "Ta bort ditt barn och skriv där elever" (rubriken säger redan
ditt barn). Så på startsidan, båda språken: etiketten (`.nx-et`) är "Vad är
Nextrum" ("What is Nextrum"), rubriken är kvar "Hur hjälper vi *ditt
barn?*", och ingressen i `.nx-head-aside` är Leos första text, med elever:
"Nextrum erbjuder prisvärd läxhjälp där elever matchas med en
studiehjälpare som passar deras behov. Vi hjälper elever att förstå mer,
känna sig tryggare i skolan och utvecklas över tid." (engelskan "students"
och "tutor", som resten av den). Ankaret `#sa-hjalper-vi`, bladen och remsan
är orörda, och Vår idé har kvar etiketten "Så hjälper vi" och den gamla
ingressen.

Läxhjälpens blad (samma kväll, Leo: "Där de står läxhjälpen skriv inte en
till en, hemma eller online skriv Rätt studiehjälp, på rätt plats"): rubriken
är "Rätt studiehjälp, på rätt plats" ("The right help, in the right place"),
på startsidan och Vår idé, båda språken, för bladen är samma kopia.

### Den nya loggan (2026-10-15)

Leo: "Du ska implementera våran nya logga i hemsidan", med loggan som
bild (1654 x 1654 px): märket, ett brunt och orange sicksack, ordet
nextrum i gemener och "av unga, för unga". Den ersätter N:et i den
rundade rutan och ordet NEXTRUM i text.

- **Källan är `bilder/nextrum-logga.svg`**, spårad i vektor ur bilden
  (potrace på en 4x förstorad bild, där varje pixel delats upp i sin
  andel brunt och orange; jämförd mot originalet, under en procent av
  pixlarna skiljer). Märket är 223,5 x 169,5 enheter, ordet 751,75
  bred i samma höjd, 51,75 till höger. Brunt #643820, orange #F88740.
  Det bruna i märket går in under det orange, så att det aldrig syns en
  springa i skarven.
- **Sidorna har två inline-svg**, `.mark` och `.logo-text`, i samma
  höjd (`--logga-h`, 26 px i sidhuvudet, 19 under 600 px (23 till 2026-10-16, Leo: "Gör denna logga lite mindre"), 22 i
  adminvyn, 10 mm på affischen); bredden räknas ur höjden i
  `nextrum.css`. Inline och inte `<use>` mot en fil: loggan ska stå
  där när sidan ritas, och sidhuvudet var redan samma markup på alla
  sidor. Ordet har `role="img" aria-label="Nextrum"`, så footerns länk
  har ett namn utan text.
- **Färgen**: det bruna och ordet är `currentColor`, och `.logo` tar
  `--logga-brun` (#643820, 9,4:1 mot papperet; kräm i båda mörka
  blocken). Mörka ytor sätter `color` på `.logo`: sidhuvudet över
  heron och Bli studiehjälpares svarta (`.pa-mork`), footern och
  maskotens öppna knapp. Det orange står i markupen och byts aldrig.
  Affischen är alltid brun, för papperet är vitt i båda lägena.
- **Sloganen** står inte i sidhuvudet (i 26 px går den inte att
  läsa); den står som text i footern och på affischen, som förut, och
  översätts på engelska.
- Hovringen vrider inte längre märket (det var N:et som vände sig);
  den förstorar det med `scale`.
- Introduktionens bilder visar inget sidhuvud och byggdes inte om.

### Två fällor när en palett byts

Båda kostade en omgång i Fas 11 och syns inte förrän i drift. Fas 11
gav adminvyn en egen mörkblå palett; den togs bort 2026-09-24 för att
adminvyn skulle se ut som samma hus som studievyn och
studiehjälparvyn. Ingen av fällorna gäller alltså i dag — men de
gäller igen den dag någon sätter `--pap`, `--bl` eller `--acc` på en
vy.

1. **En alias-token fryser rotens värde.** `nextrum-cinema.css:263` sätter
   `--muted-2:var(--bl-3)` på `:root`. En custom property med `var()` i
   värdet substitueras där den **deklareras**, inte där den används. Att
   byta `--bl-3` på `body.vy-admin` når den alltså aldrig — `--muted-2`
   ärvs färdigberäknad. Hela mängden som måste upprepas: `--bg`, `--fg`,
   `--muted`, `--muted-2`, `--line`, `--line-2`, `--surface`,
   `--surface-2`, `--btn-bg`, `--btn-fg`, `--focus`, `--tryck-yta`.
2. **Mörkerreglerna väger fyra klassnivåer.**
   `:root:not([data-theme="light"]) .vy .dbox` i `nextrum-vy.css:679` är
   (0,4,0). En `.vy-admin .dbox` är (0,2,0) och förlorar — men bara i
   mörkt OS-läge, alltså precis det läge den som bygger sitter i.

Och: **`--acc-lugn` är hover-accenten, inte en felfärg.** `cinema.css:517`
har `.btn-primary:hover{background:var(--acc-lugn)}`. Den betyder "fel"
bara i agentfliken.

### Fyra fällor som gör vyerna hackiga

Leo 2026-09-24: "när man trycker på knappar skickas man uppåt" och
"det är laggigt". Inget av det syns i Chrome på en dator, och därför
hade inget av det upptäckts. Mätt i provbänken med 250 ms per fråga,
strypt processor och scroll anchoring avstängd (som Safari):

1. **Byt aldrig en lista som har innehåll mot "Hämtar".** Sidan krymper
   med listans höjd, webbläsaren klämmer scrollen, och man hamnar
   1 000–1 800 px högre upp (läxornas "Klar"). Chrome kompenserar med
   scroll anchoring; **Safari har ingen**. Använd
   `NXStudie.laddarFörsta(host)`: "Hämtar" bara första gången, annars
   står listan kvar nedtonad tills den nya är ritad. Ett formulär som
   stängs ovanför det man tittar på hålls med `NXStudie.håll(ankare, fn)`,
   och en lista som ett filter eller ett sök kan göra kortare ritas om med
   `NXStudie.hållLista(lista, ankare, fn)`: `håll()` kan inte scrolla förbi
   sidans slut, och i adminvyns Betalningar och Månadens ekonomi hoppade
   chippen 146 till 588 px (2026-09-29). Ankaret är chipraden, inte
   chippet, som ritas om med listan. Samma sak inom en och samma omritning: tar man bort något och visar
   det som ersätter det först efteråt, räcker en påtvingad layout
   emellan (ett `focus()`, en `getBoundingClientRect`) för att scrollen
   ska klämmas. Visa det nya först (`ritaPlanElev`, 2026-09-28).
2. **`1fr` i ett grid är `minmax(auto,1fr)`.** Bokningens kolumn växte
   till 614 px på en 390 px bred telefon så fort en dag valdes, för att
   ämnesraden (en rad man drar i sidled) räknades som kolumnens minsta
   bredd. Tiderna låg utanför skärmen och sidan gick att dra i sidled.
   Skriv `minmax(0,1fr)`.
3. **Det som rör sig kostar hela tiden.** Toppen i vyerna spelade en
   video i loop, med en zoomande bild under och suddiga kort ovanpå —
   och sidhuvudet räknade om en oskärpa vid varje scrollsteg. Nu: ingen
   video under 700 px, allt pausas när toppen inte syns, ingen
   `backdrop-filter` på sidhuvudet i vyerna. Mjuk scrollning är
   avstängd i vyerna (`html:has(> body.vy)`): den fick varje fokus och
   varje omritning att glida iväg med sidan.
4. **Det som står ovanför det man trycker på får inte byta höjd av
   trycket.** Leo, samma dag efter merge: "det hoppar när man väljer
   längd och tid". Bokningens stegrad visade på en telefon bara det
   pågående steget och de gjorda — den växte 40 px vid varje val, och
   hjälpraden under bytte mellan två och tre rader. En vald tid sköt
   tiderna 69 px nedåt under fingret. Nu syns alla tre stegen hela
   tiden, hjälpraden har reserverad höjd, och bokningen ritar om
   genom `stilla()`, som håller det man tryckte på kvar med
   `NXStudie.håll`. Samma omritning nollställde dessutom ämnesraden i
   sidled — en rad man dragit fram Engelska i hoppade tillbaka till
   Matematik.

**Känslan i studievyn och studiehjälparvyn** (2026-09-25, sist i
`nextrum-arbetsyta.css`, `.vy:not(.vy-admin)`): rundare ytor, runda
dagar och tider som piller, och ett tryck som sjunker med `scale` och
fjädrar tillbaka. Aldrig `transform` (cinemas `.btn:active` äger den)
och aldrig en storlek som ändras av trycket (punkt 4). Ingen
animation på `[aria-pressed]`: bokningen ritar om sin panel vid varje
tryck, och allt som redan var valt hade studsat varje gång. iPhone
tänder `:active` först med en touch-lyssnare på sidan; den står i
`nextrum-studie.js`.

### Innehållet i studievyn och studiehjälparvyn (2026-09-28)

Leo: "spalterna till vänster är snygga men innehållet kan bli
snyggare", och sedan "det behöver se bra ut på mobil och enkelt att
använda". Förslaget visades som skärmbilder bredvid skisser och godkändes
("jätte bra"). Sidomenyn var orörd då. Allt står sist i
`nextrum-arbetsyta.css`, avsnittet INNEHÅLLET, först under
`.vy:not(.vy-admin)` och sedan 2026-09-29 under `.vy`: adminvyn fick
samma design (se Adminvyns rullning och design nedan). Sex regler:

1. **Färgen på ett läge säger vems drag det är.** Lera är ert drag
   eller ett fel, ockra väntar på någon annan, mossa är klart. Förut
   hade Betalt och Ej betalt samma grå kant. De mjuka tonerna
   (`--mossa-soft`, `--ockra-soft` och texttonerna), `--yta`,
   `--yta-fot`, `--tint` och `--bricka` står i cinemas `:root`, i båda
   mörka blocken; avsnittet i arbetsyta har inga egna hexkoder.
   **Orange är inget läge** (2026-10-01, Leo): `--orange`, `--orange-lugn`
   och `--orange-ink` bär bara knappen Betala i förväg (`.btn-orange`,
   `radBetala()`), ett val och inget drag. Bläcket är mörkt: kräm klarar
   inte AA på en ren orange. Använd den inte som lägesfärg. Sedan
   2026-10-12 (Leo: "Köp knappen ska vara orange") bär den också Köp på
   planerna och Fyll timbanken under Erbjudanden (`köpKnapp`), av samma
   skäl: ett val att betala med kort. Den låsta knappen före matchningen
   och med flaggan av är ghost som förut. Med strömbrytaren
   `kortreservation` på (2026-10-14) bär den Välj kort i stället för
   Betala i förväg, för valet av kort tar dess plats (`radBetala`,
   `betalVal`; `minne/betalning.md`, Kortet reserveras vid bokningen).
   Sedan 2026-10-15 (Leo: "orange timmar är köpta och gratis är gröna")
   bär den också köpta timmar i timbankens batteri och kortens mätare,
   där gratis timmar är mossa (`minne/timmar.md`, sist). Det är ingen
   lägesfärg där heller: den säger vad timmen är, inte vems drag det är.
2. **Ett drag överst, resten längst ner.** Passets sida
   (`NXStudie.passSida`) tar `datum`, `val` (betalvalen), `belopp`,
   `fakta` och `fot`, och ett block med `forst` står direkt under
   beskedet. Föreslå ny tid, skriv och avboka står i foten, och Avboka
   är en stilla länk (`.ps-fot-lank`), inte en knapp lika stor som
   Betala. Samma i båda vyerna.
3. **En knapp per rad i en lista** (`radBetala`). Två knappar bredvid ett
   märke bröt raden i tre på en telefon. Alla betalval står på passets
   sida, dit raden leder.
4. **Tiden och platsen ritar `NXKontakt.passRad`**, med ikon, ur passet.
   Anroparen skickar `med` ("med Alva"), `not`, `varning` och `lage`
   (null tar bort märket), inte tid eller plats i `under`: förut stod
   platsen två gånger när både raden och anroparen skrev den.
5. **Betalvalen heter `.vy-betalval`, inte `.vy-val`.** `.vy-val` är
   ämnes- och formatväljarna i formulären, och första versionen gjorde
   dem till ett rutnät med 220 px breda celler.
6. **Månaden väljs med en stegare** (`månadsval` med `stegare: true`) i
   studiehjälparens rapporter och ersättning och i familjens Bekräftade.
   Raden med tolv knappar låg i en dold flik när den ritades, så den
   innevarande månaden hamnade utanför kanten. "Den här månaden" står
   alltid och tar sin plats, osynlig på den innevarande, annars sköt den
   ner allt under raden efter första trycket. Adminvyn har kvar raden:
   där jämför man månader bredvid varandra.
   Raden är sedan 2026-09-29 ett spår med pilar (Leo: "ändra månaderna
   där så de ser bättre ut"), i Betalningar, Månadens ekonomi, Löner och
   Lektioner. Förut var varje månad ett piller med kant, ett piller med
   märke blev högre än de andra, årtalet svävade ovanför och klipptes i
   kanten, och raden slutade mitt i en månad. Nu är alla knappar 44 px
   höga, årtalet står i raden där det byts, kanten tonas där det finns
   mer, och den innevarande månaden har en dämpad prick, inte en kant.
   Den valda är mörk och flikarna under ljusa: i Betalningar står de två
   spåren efter varandra. Spåret (`.nx-manad-spar`) är det som rullar,
   inte host. Pilarna göms på en telefon, där man drar, och när hela
   raden ryms.
   **Ingen månadsväljare börjar före september 2026**
   (`NXStudie.FÖRSTA_MÅNAD`, samma kväll, Leo: "ta bort allt som inte är
   från september 2026 och framåt"), varken raderna i adminvyn eller
   stegarna i studievyn och studiehjälparvyn. De första passen hölls i
   september, och i driften låg inget pass, underlag, faktura eller köp
   före den. Gränsen döljer alltså ingenting; ändras den bakåt ska det
   vara för att något faktiskt ligger där.
   **Adminvyns fyra rader har varje månad sedan dess** (`alla: true`,
   samma kväll), inte de tolv senaste: med tolv hade september 2026
   fallit ur Betalningar, Månadens ekonomi och Löner i september 2027,
   och en bokförd månad hade inte gått att välja. Stegarna i studievyn
   och studiehjälparvyn har kvar tolv. Blir raden för lång efter några
   år är svaret att gruppera den per år, inte att flytta äldre månader
   till ett eget dokument: ett dokument är en andra sanning som slutar
   stämma, och det gallras inte (avsnitt 5, Gallringen). Bokföringen
   som ska sparas i sju år är Fortnox, inte adminvyn.
   **Adminvyns rad är ett fält sedan 2026-10-06** (Leo: "en kolumnen
   där man ser år och månad just nu och om man trycker på den kan man
   ändra månad och år", och att man måste kunna se flera månader framåt
   och år, i ekonomin, betalningarna, lönerna och lektionerna). Det är
   grupperingen per år som stycket ovan pekade på. `‹ [Oktober 2026 ▾] ›`:
   pilarna stegar en månad, fältet öppnar en ruta med året (pilar mellan
   åren), dess tolv månader och Den här månaden. Väljaren går från
   september 2026 till och med december nästa år (`årFramåt: 1`), och
   Löner en månad till: där är månaden utbetalningsmånaden, en efter
   passens, och länken från Månadens ekonomi ska alltid hitta sin
   månad. En månad utanför väljaren står grå i rutan. Fältet har fast
   bredd, annars flyttade sig pilen till höger under fingret när namnet
   bytte längd (fälla 4); på en telefon fyller det bredden mellan
   pilarna. Rutan ligger ovanpå sidan, så inget flyttar sig när den
   öppnas, och byggs om bara när året byts. Märkena (Stängd, Utbetald,
   2 saknas) står under namnet i fältet och på varje månad i rutan.
   Det raden gav som fältet inte ger är alla märken på en gång. I
   Ekonomi och Löner är de upplysningar, men i Lektioner är "saknas"
   sektionens larm, så där räknar en rad under väljaren upp de andra
   månaderna med pass utan rapport, med en knapp dit
   (`ritaSaknasAndra`). En månad som inte börjat är tom i Lektioner,
   som tittar bakåt, och tomraden pekar på Bokningar; bokslutet säger
   Har inte börjat om den, inte Pågår, för `manad_lage` säger `pagar`
   om varje månad från den innevarande. Felet med en rad i en dold
   sektion (bredden noll) finns inte längre: fältet rullar inte.

Och några saker som kostade en omgång: basrubriken `h5` bär en
`margin-top` i em, som med den större rubriken blev 27 px luft överst i
varje kort. En grupp som döljs när den är tom ligger i en `.vy-del`, och
då är rubriken första barnet där och tappar sin luft; regeln för
`.vy-del` ger tillbaka den. Studietiden per vecka på Översikt är fyllt
(genomfört) och streckat (bokat) i samma mossa: mossa och lera som två
serier föll i palettprovet för färgblinda. Krockkollen på föreslagna
tider (`krockFör`) finns bara i vyn: databasen nekar två bekräftade pass
på samma starttid, inte två som överlappar.

**Tummen** (samma kväll, Leo: "är det smidigt att använda mobilen?").
Mätt på 360 och 390 px i varje sektion av båda vyerna: inget spillde
över kanten och inget hoppade, men tre saker var fel.

1. **Tryckytorna var för små.** Kalenderdagarna i Boka pass var 34 px
   med dött mellanrum, schemats pilar 28 px, länkarna 21 px och de
   små knapparna 29–39 px. Under TUMMEN i `nextrum-arbetsyta.css` får
   de minst 44 px på en smal skärm eller med ett finger som pekare,
   länkarna en osynlig yta runt texten (`::after`), och i månadens
   schema är hela dagens ruta passets tryckyta när dagen har ett pass.
   Ett tryck i ytan provas med `elementFromPoint`, inte med
   `getBoundingClientRect`, som inte ser `::after`.
2. **Sektionsraden stod still.** Långt ned på en sida fanns ingen väg
   till en annan sektion utan att rulla upp. Den står nu fast under
   sidhuvudet under 900 px (`--vy-hdr-h`, satt av `sidomeny` på raden
   och inte på `:root`), och den aktiva posten dras in i raden.
3. **Ett sektionsbyte lämnade en mitt i nästa sektion.** Sidan
   flyttades bara när webbläsaren klämt ned scrollen; var nästa sektion
   lika lång stod man kvar på samma höjd. "Till rapporten" långt ned i
   Betalning ledde till mitten av Bekräfta rapport, med rubriken 1 000
   px ovanför skärmen. Nu läggs sektionen vid sin början när man annars
   inte hade sett den, direkt och utan animering, i alla tre vyerna.
   `täcktÖverst()` räknar sidhuvudet och den fasta raden, så att
   rubriken inte hamnar bakom den.

Sidhuvudet i vyerna är helt täckande sedan dess: med 97 % syntes text
som rullade under det. Hälsningen överst tar fortfarande 446 px av en
844 px hög telefon, med flit: nästa pass och meddelandena står där.
Sedan 2026-10-09 syns den bara när vyn öppnas (Telefonen, andra varvet).

**Adminvyns rullning och design** (2026-09-28 och 2026-09-29). Leo skrev
först "skroll funktion i admin är konstig", och sedan, när det första
svaret inte träffade: "när man scrollar på sidbaren behöver allt annat i
exempelvis översikt scrollas ner för att komma längre ner på sidbaren på
dator vyn", och att adminvyn ska få "samma design som studievyernas nya".
Provbänken nedan hade sagt "Admin var ren", för den mäter hopp vid tryck.
Allt här är mätt före och efter i Chromium på 1440×800 (och 1280×720,
1920×1080, 1024×768, 390×844) med en stubbad `supabase-js` (en falsk
`createClient` som svarar "inloggad admin", lagd över filen i `bibliotek/`
med en route i Playwright) och påhittad testdata: familjer, elever, pass,
fakturor. Inget av det ligger i repot.

**Rullningen, fem saker:**

1. **Menyn är en egen rullyta, och sidan en annan.** Den är 1 236 px hög,
   och stod fast utan egen rullning: på en bärbar syntes hälften, och
   resten nåddes först när HELA sidan rullats med Översiktens innehåll med
   sig. Nu har den `max-height` och `overflow-y:auto` på en dator, med
   `overscroll-behavior:contain`: hjulet över menyn rullar bara menyn (300
   px mot 0 på sidan) och över innehållet bara sidan (0 mot 300). Geometrin
   är mått, inte innehåll: toppraden är `--adm-topp-h` (56 px, 54 på en
   telefon), menyns fäste är toppraden plus `--adm-luft` (20), och högsta
   höjden är fönstret minus fästet minus 16. `main` har samma `--adm-luft`
   som padding-top, så menyn står lika långt ned överst på sidan som när
   den klistrat. Första versionen räknade högsta höjden på fästet men lät
   `main` ha 150 px padding kvar från heron som togs bort i Fas 6:
   nederdelen hängde 100 px under skärmkanten tills man rullat en bit.
   (Här stod först sajtens sidhuvud ovanför toppraden och en fot med den
   inloggade längst ned i menyn; se Adminvyns skal nedan.)
2. **`sidomeny()` drar menyn, aldrig sidan**, så att den valda posten syns
   när man kommer till den från en länk eller en adress. Bredden är 244 px: "Intresseanmälningar" plus
   märket plus en rullningslist är 243, och märket lade sig över ordet i
   212. Menyn klipper i sidled, och "Betalningar & utbetalningar" (199 px på
   158) stack ut 29 px och var på den valda posten delvis osynlig (ljus text
   på ljust): den bryter rad. Posten heter Betalningar sedan samma dag,
   men en längre etikett måste också få bryta.
3. **Ett sektionsbyte lade rubriken bakom toppraden.** `täcktÖverst()`
   räknade sidhuvudet och telefonens sektionsrad men inte adminvyns
   toppråd (`.adm-topp`). Från ett scrollat läge landade varje byte 66 px
   för lågt, med rubriken och ingressen dolda. Raden räknas nu där den STÅR
   när den klistrat (`top` + höjd), inte där den ligger just nu.
4. **Inglidningen mättes med.** En sektion som visas tonar in med
   `translate:0 12px` till 0 (`vy-in`), och `visaÖverst` mätte platsen i
   samma ögonblick: 12 px för lågt, så rubriken stod tätt intill raden i
   stället för med luft. `platsUtanInglidning()` drar bort översättningen.
   Gällde alla tre vyerna; i familje- och studiehjälparvyn på telefon
   landade rubriken på −1 och 0 px luft, nu 11 och 12. Mät var rubriken
   hamnar mot radens nederkant, inte bara `scrollY`.
5. **Sidan bakom personpanelen rullade** (756 px i provet).
   `html:has(.dp:not([hidden]))` låser den, av panelens egen `hidden`, så
   det finns inget lås att glömma att släppa, och `.dp-kropp` har
   `overscroll-behavior:contain`. `scrollbar-gutter:stable` hindrar att
   sidan hoppar när listen försvinner.

**Designen.** KÄNSLAN och INNEHÅLLET (avsnitten längst ned i
`nextrum-arbetsyta.css`) står nu på `.vy` och gäller alla tre vyerna. Det
enda som är kvar av `.vy:not(.vy-admin)` är telefonens fasta sektionsrad,
som i adminvyn står under toppraden i stället för under sidhuvudet
(Adminvyns skal nedan). Adminvyns egna delar har översatts till samma
språk, på sina egna namn:

- `.adm-status` är `.lage`: `ar-ny` lera (ert drag, eller något som gick
  fel), `ar-vantar` ockra, `ar-klar` mossa, utan färg mattgrå. Texten
  står alltid kvar.
- `.adm-kpi` är `.kpi` (ark i `--yta`, 20 px, skugga; `ar-larm` lera).
  `table.adm` står på kortet utan egen ruta: rubrikraden är en ruta i
  `--tint` med vanlig text (`border-collapse:separate`, för i det andra
  läget går det inte att runda en cell), raderna har streck emellan.
  `.adm-namnlista` är rader utan låda. `.adm-att-gora`, `.adm-pass`,
  `.adm-format`, `.adm-lugnt`, `.adm-koppling-kort`, `.adm-panel`,
  personpanelen (`.dp`: pillflikar, rutor i `--tint`, rundat hörn),
  konsolen (`--yta`, inga hörnmarkeringar längre; NEX-emblemet och
  ringarna står kvar) och toppraden (söket som pill, knapparna runda).
- Mono-versaler bara till små etiketter och tekniska texter (stackspår,
  JSON). Datum och tal i en tabellcell är sans med tabelltal, och
  formuläretiketter är vanlig text (`.pay-field label`, `.fgroup > label`).
- **`.btn-sm` har aldrig varit liten.** Den står i `nextrum.css` (10px 18px),
  och cinemas `.btn` laddas efter den med samma tyngd och vinner, så alla
  120 små knappar i adminvyn var 54 px höga. Studievyn löste det där
  knapparna står. `.vy-admin main .btn-sm` är nu liten på riktigt (8px 16px,
  .84rem), bara i innehållet: sidhuvudets Logga ut ska se ut som i de
  andra vyerna.
- **Specificiteten sjönk med ett steg** när `.vy:not(.vy-admin)` blev
  `.vy` (`:not()` räknar sitt argument). Jämförd byte för byte: alla 36
  sidbilder av familje- och studiehjälparvyn (alla sektioner, dator och
  telefon) blev identiska med orörda filer. Ändras något i de två vyerna
  oväntat efter en regel i det här avsnittet är det första stället att
  titta.

Headless Chromium döljer rullningslister som standard. Starta med
`ignoreDefaultArgs: ['--hide-scrollbars']`, annars syns inte vad en list
gör med menyns bredd.

Playwrights `page.click()` rullar själv fram ett element som ligger under
en fast rad (sektionsraden på en telefon), och flytten mäts då som ett
hopp sidan aldrig gjorde: 190 px i provet av Lektioners månadsrad
(2026-09-29). Mät ett tryck med `el.click()` i sidan (`page.evaluate`).

**Kvar, medvetet inte gjort.** Granskat bild för bild med testdata, på
dator och delvis på telefon och i mörkt läge: alla sektioner och flikar,
och personpanelen för en familj. Agentflikarna har egen
CSS (`nextrum-agent.css`) som inte rörts, och där har exempelfrågorna och
fältetiketten kvar sin äldre form. Det som bara ritas med riktig data
(auditloggen med rader) har inte setts med innehåll. Betalningar och
Månadens ekonomi är granskade med testdata i alla flikar, på dator, på
telefon och i mörkt läge (2026-09-29).

Provbänken (`skanna.js` i en scratchpad, inte i repot) trycker på varje
knapp i varje sektion och rapporterar hopp över 40 px. Admin var ren.
Ett prov som lägger knappen vid skärmkanten mäter Playwrights egen
rullning före klicket som ett hopp, och ett prov med knappen överst på
sidan kan inte se att sidan kläms: lägg knappen en bit ned, på en sida
som är scrollad (2026-09-29).
Den mäter `scrollY`, inte vad som står stilla på skärmen, så fällan i
punkt 4 syntes inte i den: sidan scrollade inte, innehållet flyttade
sig. Mät ett element före och efter trycket (`getBoundingClientRect`).

### Telefonen, andra varvet (2026-10-09)

Leo: "vyerna på mobil är jätte jobbiga att använda", utan mer. Provat i
en provbänk byggd på `verktyg/bygg-introbilder.js` (dess falska
Supabase och påhittade familjer, 390 och 360 px, `isMobile` och
`hasTouch`), i varje sektion av studievyn och studiehjälparvyn, och med
att använda dem: boka, skriva, byta sektion, öppna ett pass. Tummen
(ovan) höll: inget spillde, och tryckytorna var 44 px. Det som var fel
var fyra andra saker.

1. **Varje fält zoomade in sidan.** En iPhone zoomar när man trycker i
   ett fält med text under 16 px, och står kvar inzoomad tills man nyper
   ut. `.inp,.sel` var `.98rem` (15,68 px), och det var varje fält på
   sajten: inloggningen, chatten, profilen, intresseanmälan,
   jobbansökan. Rapportens kommentar (`.nx-fraga-bred textarea`) var
   14 px, barnväljaren 13,6 och maskotens fält och adminvyns sök 14.
   Nu är `.inp,.sel` 1rem, och de som är mindre med flit får 1rem
   under TUMMEN (och `.mk-falt` i cinema). Uppmätt efteråt: inget fält
   under 16 px på någon sida, med eller utan inloggning. `maximum-scale=1`
   i viewport hade stoppat zoomen men också nypet på Android: nej.
2. **Enter skickade chatten.** En telefons tangentbord har ingen Skift,
   så varje radbyte var ett halvskrivet meddelande som gick iväg. Med
   ett finger (`(pointer: coarse)`, prövat vid varje tangent) är Enter
   en ny rad och Skicka knappen, i familjens tråd (`NXKontakt.tråd`) och
   i barnens (`NXStudie`); tipset "Enter skickar" döljs där.
3. **Varje sektion började under hälsningen.** Ett sektionsbyte flyttar
   inte sidan när början syns (punkt 3 i Tummen), och högst upp syns den:
   under hälsningen, 450 px av 844, med en tredjedel av skärmen kvar.
   På en telefon (raden står fast, `fastRad()`) läggs sektionen nu alltid
   direkt under raden; på en dator som förut. Samma fel gjorde att ett
   pass som öppnades från Översikt flyttade sidan 6 px: `täcktÖverst()`
   mätte raden där den låg, under hälsningen, och räknade allt ovanför
   som täckt. Nu räknas den där den står när den klistrat, som adminvyns
   topprad. Två följder: en kort sektion (Skriv rapport med ett pass)
   gick inte att rulla upp till raden, så ytan med sektionerna är minst
   en skärm minus sidhuvudet och raden på en telefon; och studiehjälparvyns
   elevval står utanför sektionerna, före Uppgifter och Meddelanden, och
   visades först efter mätningen. Den sätts nu i `innan` (före mätningen),
   och sidan mäts från det första som syns i ytan (`början()`), så att
   elevvalet inte hamnar bakom raden.
4. **Sektionerna gick inte att hitta.** Raden är fyra skärmbredder lång
   (nio poster i studievyn, åtta i studiehjälparvyn) med "Mina l" och
   "Erbju" avklippta i kanten, och menyn bakom de tre strecken, där man
   letar först, hade bara sajtens sidor. Nu står vyns delar överst där
   (`sidomeny` med `mobilmeny: true`), med rubrikerna och siffrorna, och
   sajtens sidor under, mindre. Kopiorna ligger i sidomenyns `länkar`, så
   den valda och siffrorna följer med; menyn stänger sig med en lyssnare
   på menyn i stället för en per länk (`nextrum-app.js`), för kopiorna
   läggs dit efter inloggningen. Adminvy står också där för den som är
   admin: sidhuvudets knappar syns inte på en telefon. Elevvyn har ingen
   meny, med flit, och fem poster som ryms.

Hälsningen stod kvar när vyn öppnades och gick undan vid första bytet;
sedan 2026-10-12 står den kvar (punkt 3 är ändrad, Raden på telefonen
nedan). **Inte gjort**, sett i samma prov: Boka pass har en nålad
summering på 165 px längst ned (med sidhuvudet och raden är 300 av 844
px fasta medan man väljer tid), och studiehjälparvyns elevval är 520 px
högt på en telefon, så Uppgifter och Meddelanden börjar en skärm ned.
Båda är formfrågor att ta med Leo.

### Raden på telefonen (2026-10-12)

Leo: "på telefonen när man trycker på de olika kolumnerna i vyn
exempelvis mina lektioner osv ska skärmen inte automatiskt hoppa ner. Så
gör de också mer smooth när man trycker och de olika kolumnerna mer
moderna". Mätt i samma provbänk som andra varvet (390 × 844, `isMobile`,
`hasTouch`, ett tryck med `el.click()` i sidan):

1. **Hoppet var punkt 3 ovan.** Högst upp flyttade varje tryck sidan 403
   px i familjevyn och 378 i studiehjälparvyn, och raden for från 472 till
   75 px under fingret. `sidomeny` lägger nu sektionen vid sin början bara
   som på en dator: när början inte syns, eller när webbläsaren klämt
   scrollen. Högst upp står allt still (0 → 0 i alla sektioner, i alla
   fyra vyerna), och står raden fast långt ned läggs sektionen under den
   (1 200 → 403, raden kvar på 75). Raden flyttas alltså aldrig av ett
   tryck i den. Priset är det andra varvet löste: högst upp börjar
   sektionen under hälsningen, med en tredjedel av skärmen kvar. Ytan
   under raden är fortfarande minst en skärm, för fallet långt ned.
   Passets sida (`#pass/<id>`) har sin egen regel i `bytteSektion` och
   läggs fortfarande överst när dess början hamnar under 60 % av
   skärmen, också högst upp på sidan (0 → 403 i provet): det är ett tryck
   i innehållet, inte i raden, och inte ändrat.
2. **Pillen.** Den valda posten var en fylld post som bytte på ett
   ögonblick. Nu är den en pill (`.vy-sido-pil`) som ligger i raden under
   posterna (`z-index:-1` i radens stapel, som sticky ger) och glider dit
   (`translate` och `width`, 0,38 s, en aning förbi och tillbaka).
   Skriptet sätter bara var den ska stå (`--x`, `--y`, `--w`, `--h` på
   pillen, `läggPil`), efter `onByt`, för passets sida markerar posten man
   kom ifrån där. `har-pil` på raden gör den valda posten genomskinlig;
   utan den är posten fylld som förut, så en dator och en sida utan
   skriptet ser ut som innan. Glidningen slås på vid första bytet och
   aldrig av: ResizeObserver svarar i samma bildruta som ett byte och hade
   annars stoppat den mitt i. Med minska rörelse glider inget.
3. **Samma vikt.** En vald post i 600 var bredare och flyttade grannarna
   några pixlar vid varje tryck; alla poster är 500 på en telefon, och
   texten byter färg på 0,32 s, i pillens takt (med 0,22 s stod den ljus
   på papperet innan pillen kommit fram).
4. **Raden glider också**, med `scrollTo({behavior:'smooth'})` på raden,
   aldrig sidan, och drar fram posten till mitten när den står inom 40 px
   från en kant, så att grannen syns. Kom man från en länk eller menyn
   bakom strecken till en post utanför skärmen möts pillen och posten
   på vägen: de två rörelserna har olika kurvor, och pillen går förbi en
   bit och vänder. Kort, och bara då.
5. **Kanterna tonar**: en sticky gradient sist i raden (den sista posten
   står helt fram när man dragit hela vägen) och en först, som tar ingen
   plats och syns bara när raden är dragen (`ar-dragen`, satt av en
   passiv lyssnare som bara byter när raden lämnar eller når början).
   Strecken mellan grupperna är 18 px höga i stället för hela raden.
   Skuggan under pillen är mörk i båda lägena; av `--bl` blev den ett
   ljust sken i mörkt.

Provat på telefon i familjevyn, studiehjälparvyn, barnets vy och
adminvyn, ljust och mörkt, och med minska rörelse. På en dator (1280 ×
800) är menyn pixel för pixel som förut (största skillnaden 6 av 255, i
kantutjämningen), och sidan flyttas inte där heller.

### Adminvyns skal (2026-09-29)

Leo: "för vår admin snyggare och enklare". Mätt i provbänken före: drygt
160 px sidhuvud innan första raden (sajtens sidhuvud och en topprad under
det), samma arbetskö tre gånger på Översikt (5 300 px lång på en
telefon), nio menyrubriker där sex stod över en enda post, och en
marknadssidfot. Inget av det ändrade vad vyn kan göra; allt står i
`admin.html`, skalet i `nextrum-admin.js`, Översikt i
`nextrum-admin-oversikt.js` och `-konsol.js`, och CSS:en i adminskalet
(§6) i `nextrum-arbetsyta.css` och i `nextrum-admin-konsol.css`.
Designen är samma hus som ovan; det här är skalet runt den.

- **En rad överst.** `#adm-topp` står utanför `<main>`, fast högst upp
  (`top:0`), och bär loggan, sök, notiser och kontot (Studievyn,
  Studiehjälparvyn, Logga ut). Inne i vyn göms sajtens sidhuvud och
  sidfot av `body.adm-inne`, som `NXAdmin.visa()` sätter bara för
  `view-app`, och samma anrop göms raden i alla andra vyer: inloggningen
  och felvyerna har sajtens sidhuvud som förut, också när vakten över
  inloggningen byter dit (avsnitt 6). Menyn har ingen fot längre; kontot
  står i raden. `täcktÖverst()` räknar raden. Måtten står en gång, på
  `body.vy-admin` (`--adm-topp-h`, `--adm-bredd`, `--adm-pad`,
  `--adm-luft`). `--vy-hdr-h` läses inte i adminvyn: sidhuvudet den mäter
  är gömt där.
- **På en telefon** är söket en rund knapp som växer över raden,
  panelerna står under raden över hela bredden, och sektionsraden står
  fast under toppraden som raden i de andra vyerna står under
  sidhuvudet. Adminvyn var undantagen i TUMMEN för att sidhuvudet och en
  topprad redan tog 144 av 844 px; toppraden och sektionsraden tar nu
  mindre än sidhuvudet och raden i de andra vyerna.
- **Menyn** har fyra grupper under Översikt och Statistik. Betalningar
  hette Betalningar & utbetalningar, och sektionens rubrik heter likadant.
- **Arbetskön ritas en gång**, i Att göra under NEX, med det som gått
  fel först under en egen rubrik. `S.attGora` och `S.problem` räknas i
  `ritaÖversikt()` och läses av konsolen, notisklockan och menyns
  siffror, precis som förut. NEX är ett band (ringen, läget, samtalet),
  inte en 286 px hög ring med kön bredvid. `.adm-att-gora` finns inte
  längre; raderna är `.kon-rad` i `nextrum-admin-konsol.css`, i samma
  form som den hade.
- **Att göra är bara vårt drag** (samma dag). Passförfrågningarna stod
  där, men ett förslag väntar på svar från studiehjälparen, eller från
  familjen efter ett motförslag. Leo: "det är inte något vi gör eller har
  påverkan på". Hur många som väntar står i stället i Bokningars
  rubrikrad, i ockra (`ritaFörfrågningar()`), och Önskat i
  bokningslistan är ockra som i kalendern bredvid, inte lera. En rad i
  Att göra räknas också i NEX-ringen, notisklockan och menyns siffror,
  så det som väntar på en familj eller en studiehjälpare hör inte hemma
  där.
- **Bredden** är `--adm-bredd` (1760 px) på `body.vy-admin main.wrap`.
  `body` står framför med flit: `.vy main.wrap` under STORA SKÄRMAR väger
  annars lika mycket och står senare, och över 1500 px fastnade
  innehållet på 1560 medan toppraden gick till 1760.
- Namnlistorna har en avatar före namnet, Översiktens fyra tal en ikon i
  hörnet, och sektionernas inledningar är en mening.
- **`color-scheme` är `light dark`.** Den stod på `dark` från tiden då
  adminvyn var alltid mörk, och gav ljust läge mörka rullgardinslistor,
  datumväljare och rullist.

**Samma hus, inte ett eget.** Samma dag gjorde en annan session om
adminvyns design i samma filer (PR #123, ovan), och den mergades först.
Den här grenen hade under tiden gett adminvyn egna ytor: mindre knappar
och fält, understrukna flikar, en markering i lera för den valda
menyposten och månaden, en egen kant och skugga på arken och en egen
inglidning. Allt det togs bort när main kom in, för Leo bad om samma
design som studievyerna, och varje sådan avvikelse gör adminvyn till ett
annat hus igen. Det som skiljer adminvyn är skalet ovan och tätheten i
tabellerna och listorna, inte ytorna.

- **Fälla:** `h5` och `h6` har webbläsarens egen marginal (1,67 och
  2,33 em). INNEHÅLLET nollar den ovanför kortens h5, också ovanför en
  andra rubrik i samma kort, som då satt tätt mot listan ovanför;
  `body.vy-admin .dbox * + h5` ger tillbaka luften. Tjänste- och
  kopplingskortens h6 hade 35 px ovanför namnet
  (`.adm-koppling-kort h6{margin:0}`).
- **Fälla:** `--pap-2` och `--yta` är nästan samma färg i mörkt läge.
  Hovringen och ikonrutorna i sök- och notispanelen stod på `--pap-2` i en
  panel i `--yta` och syntes inte där; de är `--tint` och `--bricka` nu.
  Samma sak gäller kortets bakgrund: i mörkt läge vinner
  `:root:not([data-theme="light"]) .vy .dbox` (0,4,0), och en ändring av
  den måste möta vikten (avsnitt 3, Två fällor när en palett byts).
- **Fälla:** KÄNSLAN ger `.vy :is(.inp,.sel)` 16 px hörn och står sist
  i filen. `.adm-sokfalt .inp` väger lika mycket, så söket var en rundad
  ruta i stället för ett piller tills det fick `.adm-topp` framför sig.
- NEX-bandets yta står i `nextrum-admin-konsol.css`, som laddas efter och
  vinner på samma vikt; en regel för `.kon-*` i `arbetsyta.css` gör inget.

**Knapparna efter behörighet (2026-10-15).** En knapp som databasen bara
släpper fram för en superadmin eller en behörighet ritas efter kärnans
`ärSuperadmin()` eller `får(kod)`, och `skriv()` ber om raderna och säger
Ingenting sparades när en uppdatering inte träffade något (RLS nekar en
uppdatering utan fel). Listan över knapparna står i
`minne/barnkonton-och-admin.md`, under Adminvyn.


### Att göra, sak för sak (2026-10-26)

Leo: "nex visar 3 saker att göra, jag ser bara två", och sedan "när jag
trycker på att göra grejen ska jag få upp en flik som visar allt att göra".
Ringen i NEX-bandet räknar saker (summan av posternas antal) och Att göra
under den visar poster. I driften var det två elever utan studiehjälpare
på en rad med en tvåa, och en fråga i inkorgen på en rad till: ringen sa
3 och listan hade två rader. Ingenting saknades, men ögat räknar rader.

- **Sidan `#attgora`** (sektionen `attgora` i `admin.html`, ritad av
  `ritaSidan()` i `nextrum-admin-konsol.js`) har samma poster i samma
  ordning som Att göra, det som gått fel först, och en rad per sak i
  studievyernas form (`.vy-grupp`, `.vy-kort`, `.vy-rad`). Gruppens rubrik
  bär postens antal och en länk till sektionen där det görs.
- **Vägen dit** är talet vid ringen (`a.kon-nex-lage`), ringen själv (en
  andra länk för musen och fingret, `aria-hidden` och utanför
  tabbordningen) och Allt att göra, en rad per sak, under listan
  (`#kon-alla`, dold när inget väntar). Raderna i Att göra leder som förut
  till sin sektion.
- **Ingen post i menyn.** Översikt står vald medan sidan är framme
  (`onByt` i sidomenyn, `nextrum-admin.js`), och raden överst på en telefon
  säger Att göra (`SEKTIONSNAMN`). Bara superadmin, som Översikt: sektionen
  står inte i `SEKTIONER` (`nextrum-admin-behorighet.js`).
- **Sakerna byggs där antalet räknas**, i `byggAttGöra` och `byggProblem`
  (SAK FÖR SAK i `nextrum-admin-oversikt.js`), ur samma urval, så att sidan
  och ringen inte kan glida isär. En sak med `dp` öppnar sin panel på sidan
  (anmälan, ansökan, studiehjälpare, pass), och man står kvar i listan när
  den stängs. De andra leder dit det görs: en elev till Matchning med
  eleven vald (`data-mt-hoppa`), en fråga till inkorgen, ett genomfört pass
  utan rapport och en avvikelse till Betalningar → Att göra, en utbetalning
  till Löner, en uppgift till Uppgifter och ett fel till System → Fel.
  Avvikelsens namn är Betalningars (`avvText`) och utskickets System → Fels
  (`notisfelText`).
- **En rad kan stå för flera** (`gånger`, i sidan `data-ganger`): samma fel
  på samma sida, och samma utskick som fallit på samma sätt. Det som ska
  göras är att rätta felet, inte att läsa det tolv gånger, och raden säger
  hur många gånger. Är antalet databasens (`admin_lage`) och listan i vyn
  kortare (felen hos användarna är de 100 senaste) står resten som "Och N
  till", med länken dit.
- **En ny post i Att göra får sina saker i samma ändring**, annars står
  den på sidan som N saker utan rader.
- **Sidan har innehåll bara medan den står framme.** `ritaSidan()` tömmer
  den när sektionen är dold och ritar den ur det `ritaKonsol()` senast
  räknade när den kommer fram (sidomenyns `innan`, före mätningen). Ritad
  i det dolda stod samma knapp två gånger i dokumentet, här och i sin
  sektion, och `prova-intag.js` klickade på den dolda: `page.click` tar
  den första träffen, och sektionen ligger tidigt i `admin.html`.
- `verktyg/prova-adminvyn.js` prövar sidan mot den lokala databasen: talet
  leder dit, gruppernas antal och raderna är ringens tal, eleven utan
  studiehjälpare leder till Matchning med eleven vald, studiehjälparens
  panel öppnas på sidan, och en admin med behörigheter når den inte.


### Talen går att trycka på (2026-10-29)
Leo, om tratten i Statistik: "jag vill kunna klicka på allt för att få upp mer
info om det, gör så för resten av admin". Ett tal, en stapel eller ett trattsteg
med `data-urval` (och `data-urval-arg`, som en stapels månad) öppnar en ruta med
raderna talet är räknat ur, en per person, pass eller betalning, och raden öppnar
sin panel som Att göra gör (`sakRad` i `nextrum-admin-konsol.js`); rutan går
undan när panelen öppnas.
- Funktionerna står i `NXAdmin.urval` (tom i kärnan, fylld i
  `nextrum-admin-oversikt.js`): `st_*` för Statistik, `tr_*` för tratten och
  `ov_*` för Översiktens fyra tal. De räknar ur SAMMA urval som talet:
  Statistikens tal kommer ur analysvyerna, så raderna följer vyernas villkor
  (`passunderlag.har_rapport` utan adminkonton, `status = 'cancelled'` och
  `avbokad_av`). Passunderlaget hämtas först om Ekonomi inte öppnats.
- **Betalt och Översiktens intäkt räknar på samma lista** (2026-10-29, Leo: "ja"
  på att rätta skillnaden): `inbetalningar()` i `nextrum-admin-oversikt.js`, med
  passen, köpta timmar och tillägg för övertid, netto efter återbetalningar och
  utan testbetalningar, på månaden pengarna kom in. Förut tog Statistik bara
  passen ur `analys_ekonomi.kortbetalt_ore`, så en köpt plan stod på Översikt
  men inte i Statistik. Vyn är orörd; ingen annan läser den kolumnen.
- Ett nytt tal i Översikt eller Statistik får sitt urval i samma ändring.
  Listorna i de andra sektionerna (familjer, elever, pass, ansökningar,
  betalningarna) öppnade redan sin panel per rad, och deras tal är flikarnas
  antal: där finns inget dolt att visa.
- Det syns bara på muspekaren och en ton vid hovring, aldrig på att något flyttar
  sig, och går med tangentbordet (Enter och mellanslag).
- `verktyg/prova-adminvyn.js` trycker på varje tal i Översikt och Statistik, i
  båda storlekarna: rutan öppnas utan fel, trattstegen har lika många rader som
  sitt tal, och en rad öppnar panelen.

### Koder i adminvyn (2026-10-13)

Leo: "i admin vyn ska du skapa en ny spalt, där ska koder synas, allas
personliga kod ska synas där. först när jag klicka på koder så ska jag
klickar om jag vill kolla på familjer eller studiehjälpare ... gör det
snyggt." En egen sektion i gruppen Kunder, efter Studiehjälpare
(`#koder`, `nextrum-admin-koder.js`, `ritaKodsidan`, bara superadmin i
`BARA_SUPER`, i modulvakten och i `kolla-csp.py`).
- **Valet först**: två stora kort (`.kod-val`, `.kod-val-kort`), Familjer
  i lera och Studiehjälpare i ockra, med vad koden gör och tre tal. De är
  länkar till `#koder/familjer` och `#koder/studiehjalpare`, så att
  Tillbaka i webbläsaren går tillbaka till valet. Sektionen lyssnar själv
  på `hashchange`, för skalets `sidomeny` har inget `onByt`.
- **Listan**: flikar för att byta sort (`.vy-flikar` med länkar),
  nyckeltalen (`.adm-tal-rad`), regeln med strömbrytaren (`.kod-regel`;
  samma flagga som under Betalningar → Inställningar, och båda ritas om),
  filterchips med antal (`.eko-chips`), sök på namn, e-post och kod, och en
  `<details class="kod-rad">` per person: avatar, namn, e-post, koden i
  mono, talen och läget. Utfälld visar den vilka som använt koden
  (anmälningarna eller ansökningarna ur S, med länk till panelen och
  läget, för en studiehjälpare bonusens läge) och knapparna Öppna, Kopiera
  koden och Stäng av koden. Summary har inga knappar: de står i det
  utfällda. Raderna ordnas efter användning.
- **Hämtningen**: `koder_lage(p_sort)` för båda sorterna när sektionen
  öppnas, inte vid start, för den skapar de koder som saknas. En utfälld
  rad står kvar utfälld när listan ritas om.
- **Telefonen**: summary blir två rader under 720 px (person och läge,
  kod och tal) och tre under 420 px; tryckytorna är minst 44 px; hovring
  och tryck rör sig med `scale`.
- Ansökans panel har raderna Kod och Bonus för tipset, och Löner har rutan
  Bonus för tips (`minne/betalning.md`).
- **Rabattkoderna och partnerkoderna** (2026-10-21, `koder_for_planer`) står i
  samma val, som kort tre och fyra (mossa och bricka), på `#koder/rabattkoder`
  och `#koder/partnerkoder`, och ritas av `nextrum-admin-rabattkoder.js`
  (`ritaRabattkoder`, modulvakten och `BARA_SUPER`) i en egen yta (`#kp-vy`).
  `nextrum-admin-koder.js` ritar korten och de fyra flikarna (`kodflikar`) och
  döljer sin yta på de två adresserna. Ytan: regeln (bara planer), rutan Räkna
  testbetalningar, nyckeltalen, för partnerkoderna en tabell per partner
  (`partner_statistik`), formuläret (partnern bara för en partnerkod, noll i
  rabatt går, en gång per familj som förval för en rabattkod och tomt för en
  partnerkod), och en `<details class="kod-rad">` per kod som hämtar sina köp
  (`kodens_anvandningar`) första gången den fälls ut. Stäng av frågar först och
  skriver `aktiv`; ingen knapp raderar. Rabattkoderna stod under Tjänster till
  2026-10-21, och `#katalog/rabattkoder` skickas hit (`FLYTTAT`). Text ur
  databasen går genom `esc()`: `prova-koder.js` provar ett partnernamn med en
  `<img onerror>` och ett familjenamn med `<i>`.

### Mejl från adminvyn skrivs i Gmail (2026-10-11)

**Utom till den som sökt jobb sedan 2026-10-20** (nedan, Mejlet till den som
söker skickas härifrån): där är Gmail reserven bredvid Skicka.

Leo: "när vi ska skicka mail från plattformen, se till att det alltid görs i
gmail och inte mail". Adminvyn öppnade utkasten med `mailto:`, och det öppnar
datorns förvalda program, som på en Mac är Mail. Nu öppnar allt Gmails
skrivruta i en ny flik (`gmailLänk(till, ämne, text)` och `gmailAdress(adress)`
i kärnan, `https://mail.google.com/mail/?view=cm&fs=1&to=…&su=…&body=…`):
kontaktrutan (Öppna i Gmail, med anmälningarna, ansökningarna, Påminn,
studiehjälparna och felgrupperna), Svara på en kontaktfråga, varje adress som
går att klicka på i panelen, i Månadens ekonomi och vårdnadshavarens, och
sidfoten. **Ingen `mailto:` i adminvyn.**

- **Kontot är det Gmail öppnar först i webbläsaren** (`/u/0`). Länken väljer
  inget konto: en `authuser` till ett konto som inte är inloggat skickar till
  Googles inloggning i stället för utkastet.
- **Fliken öppnas före varje `await`** i kontaktrutan, för Safari stoppar ett
  fönster som öppnas efter en väntan; `kontaktad_at` stämplas efteråt, som förut.
- **Utkasten är korta** (under 1 000 tecken). Gmail tar texten i adressen, och
  en mycket lång text kan Google neka; en mall som växer mycket ska provas.
- **Familjernas och studiehjälparnas sidor behåller `mailto:`**: vilket program
  de skriver i är deras sak, och de flesta har inte Gmail. Regeln gäller det vi
  skickar.

### Läget sätts med märkena (2026-10-06)

Leo: "en grej jag inte gillar på admin är hur man trycker in läge. Gör de
mer modernt de ser ut som att de är för 20 år sedan". Läget var en
`<select>` (`väljare()` i kärnan): två tryck, och listan som fälls ut är
operativsystemets. Nu är det `lägesväljare(karta, värde, attribut)`: alla
lägen i rad som knappar, det valda ser ut som `.adm-status` i listan, och
de andra är tomma ringar med en blek prick i sin färg. Ett tryck byter.

- **Var:** anmälan, ansökan och studiehjälparen i panelen (under rubriken
  Läge, knapparna under raden), underlaget i Löner och uppgifterna under
  Att göra. Avbokningsskälen och Ansvarig är kvar som rullgardiner: de är
  inga lägen, och sju val eller en lista med personer är ingen rad.
  Filtren överst i listorna är också rullgardiner, med flit orörda.
- **Lyssnarna är desamma.** Gruppen bär samma `data-*` som rullgardinen,
  och kärnans klicklyssnare skickar `change` från gruppen med `value` som
  det tryckta läget. Att sätta `value` visar ett läge, så `el.value =
  gammal` efter ett nej på frågan (Godkänd, Avböjd, Utbetald) sätter
  tillbaka det. Ett tryck på det valda gör ingenting.
- **Knappar, inte radioknappar:** piltangenterna i en radiogrupp byter för
  varje steg, och här skriver varje byte till databasen och Avböjd köar
  ett nej. En knapp byter bara när den trycks (Tab och Enter).
- **Ett fel visar det sparade:** nekas skrivningen sätts läget tillbaka
  (anmälan, ansökan, studiehjälparen) eller ritas uppgiftslistan om.
- `verktyg/prova-ansokningar.js` trycker på Avböjd i den riktiga panelen
  och provar att Avbryt lämnar Kontaktad vald.

### Siffran vid Intresseanmälningar och Ansökningar är det du inte sett (2026-10-05)

Leo: "notiserna ska försvinna efter vi klickat på områden och exempelvis sett
att en ansökan kommit in, och just vilken ansökan som kommit in." Siffran
räknade allt med läget Ny (`admin_lage`) och stod kvar tills någon bytte
läget, också när man redan tittat: det fanns inget man kunde göra för att få
bort den utom att svara.

- **Per admin, i databasen.** `admin_sett` har en tid per admin och område
  (`leads`, `ansokningar`): den nyaste raden som stod i listan när hen
  öppnade sektionen. Den skrivs bara av `admin_sett_markera()`, som aldrig
  flyttar tiden bakåt och aldrig förbi nu, och bara för det man får se
  (leads med behörigheten, ansökningarna som superadmin). Var och en läser
  bara sina egna rader. I webbläsaren hade det följt datorn, inte personen.
- **Osett = läget Ny och efter tiden** (`osedda()` i kärnan). En anmälan som
  den andra admin redan kontaktat är inte ny för någon. Det är vad menyns
  siffror, Att göra, NEX-ringen och notisklockan räknar för de två
  områdena; resten av Att göra är som förut, och `intern.admin_att_gora()`
  har aldrig haft dem.
- **Att visa sektionen är att se den** (`sektionSedd()` i skalet, vid
  `hashchange`, efter första hämtningen, när en ny rad kommer in och när
  fliken kommer fram). Raderna som var osedda märks med en prick och "Ny
  sedan du tittade senast" så länge man står kvar (`S.nyttNu`, `ärNyNu()`);
  nästa besök är inget märkt. En dold flik har inte sett något. Titelns
  (n) nollas som när klockan öppnas.
- **Utan tabellen** (migrationen `admin_sett` inte körd) är `S.sett` null och
  allt räknas som förut, utan markering.
- `verktyg/prova-ansokningar.js` provar det i Chromium mot en falsk Supabase:
  siffran, markeringen, nästa besök, och reserven utan tabellen.

**Fälla: `.pay-field{display:flex}` tar över `[hidden]`** (`nextrum.css`).
Ett fält som skulle fällas ut först när det behövs syntes hela tiden:
"Andra ämnen" i intresseanmälan gjorde det sedan det kom till, och
vårdnadshavarens e-post i ansökan gjorde det tills `.pay-field[hidden]`
kom till samma dag. Samma fälla som `.adm-panel[hidden]` och de andra i
`nextrum-arbetsyta.css`: en klass med `display` behöver sin egen
`[hidden]`-regel.

### Ansökningarna skickas vidare, Bokningar filtreras på familj (2026-10-13)

Leo: "i ansökningar, gör en knapp för att skicka vidare från alla
ansökningar till intervju och sedan utbildningar så att man kan skicka runt
anställd och hålla koll på de". Fliken Intervju tog förut varje ansökan som
inte var avgjord, så Alla och Intervju var samma lista och ingen hade valt
vem som gick vidare.

- **Steget räknas ur raden, utan ny kolumn** (`ansSteg()` i
  `nextrum-admin-rekrytering.js`): Avböjd och Godkänd först, sedan Utbildad
  (`utbildad_at`, "Klar för poolen"), Utbildning (`intervju_at`, ett
  utbildningsmöte eller ett öppnat prov), Intervju (läget Kontaktad,
  `kontaktad_at` eller en bokad mötestid) och annars Ny. I driften var sex
  ansökningar Kontaktad utan `kontaktad_at`: Leo hade redan använt läget så,
  och ingen funktion i databasen läser `contacted`. Flikarna, listans märke,
  panelens märke överst och filtret (som nu är steget) läser samma funktion.
  **Ersatt 2026-10-15**: Intervju är ett eget steg, aldrig läget (nedan).
- **Knappen på raden** (`o.knapp` i `namnlista()`, bredvid namnknappen och
  aldrig i den; under namnet under 560 px): Alla har Till intervju på en ny
  (läget Kontaktad, inget mejl, ingen fråga; tillbaka är läget Ny i
  panelen). Intervju har Till utbildning, som är "Mötet är hållet" och
  därför frågar först: det mejlar tacket med introduktionen som nästa steg.
  Utbildning har utbildningens nästa steg (`utbKnapp`, 2026-10-21; förut
  Öppna provet, `provKnapp`, som gick med provet i ansökan):
  Utbildningsmötet är hållet, som inte mejlar och inte frågar, sedan
  Markera utbildad, som frågar först för den mejlar sista steget, och för
  den som är utbildad Ta in i poolen. Den utbildade stod förut varken
  under Intervju eller Utbildning.
- **Flikarna räknar** (`vy-flik-mark`), så att ett tryck i Alla syns flytta.
- **Bokningar har en väljare för familjen** (`#bok-familj`, `familjeval()` i
  `nextrum-admin-drift.js`): de familjer som har pass, med barnens namn
  efter, och den gäller ihop med söket, läget och tiden. Passförfrågningarnas
  Visa dem och ett pass i kalendern nollar den, annars hade de visat färre
  än de lovar. Kalendern filtreras inte.
- `verktyg/prova-ansokningar.js` provar stegen i Chromium: knapparna, frågan,
  vad som sparas, flikarnas tal, filtret och telefonens rad.

### Intervju är ett val, inte ett läge (2026-10-15)

Leo: "de fyra stadierna när en ansökan om jobb kommer in är ny, kontaktad,
godkänd eller avböjd. detta innebär att jag klickar själv i de vid klick av
profil ... där det passar ska det också finnas skicka vidare till intervju,
det är då för nya ansökningar. så i intervjudelen ska namn bara finnas där
som jag har klickat i att de ska vidare till intervju. sen när de ligger i
intervju så finns det att skicka vidare till utbildnings sektionen." Fliken
Intervju räknade läget Kontaktad som intervju (ovan), och i driften stod sju
av nio ansökningar där för att Leo hört av sig till dem.

- **Steget har en egen tidsstämpel**, `applications.till_intervju_at`
  (migrationen `ansokan_till_intervju`), och `ansSteg()` läser den, aldrig
  läget. Den sätts av Skicka vidare till intervju (Till intervju på raden i
  Alla, i ansökans panel under läget och i steg 1 i Rekryteringen) och av
  Boka möte, för mötet är intervjun. Ångra "till intervju" i steg 1 tar bort
  den medan hen står under Intervju. Ingen bakåtfyllning: ingen visste vilka
  av de sju som skulle dit, så fliken börjar tom.
- **Läget sätter Leo själv**, med märkena i panelen. Skicka vidare rör det
  inte. Skriv till hen sätter Kontaktad på en ny, som förut: det är en
  kontakt.
- **Listan visar läget för den som inte gått vidare** (`listSteg()`): Ny
  eller Kontaktad, och filtret har Kontaktade bredvid Nya. De andra står med
  steget (Intervju, Utbildning, Klar för poolen) eller Godkänd och Avböjd.
  Under Intervju står "Kontaktad" också för läget, inte bara för
  `kontaktad_at`.
- **Panelen** (`panelVidare()`): Skicka vidare till intervju på en ny eller
  kontaktad, Skicka vidare till utbildning på den som står under Intervju,
  som primär knapp under läget och samma handling som raden. Ta in i poolen
  är primär bara när inget steg står kvar före den. Till utbildning är
  "Mötet är hållet" och frågar först, för tacket mejlas.
- **Steg 1 i Rekryteringen heter Till intervju** (förut Kontakt): valet och
  Skriv till hen, med `till_intervju_at` som stämpel och när hen skrevs till
  under.
- **Utan kolumnen** (`harIntervjuKolumn()`, migrationen inte körd) är allt som
  2026-10-13: Kontaktad är Intervju, och Till intervju sätter läget.
- I databasen sätts steget aldrig utifrån (`skydda_ansokningsfalt`), gallringen
  räknar det, och auditloggen tar tidpunkten. Inget mejlas.
- `verktyg/prova-ansokningar.js` provar det i Chromium, med reserven utan
  kolumnen och panelens knapp på en telefon, och `rls-test.sql` databasen
  (proven TI). Provet fyller också i skolnivån, som jobbansökan kräver sedan
  2026-10-14: utan den skickades inget, och formulärets prov föll.
- **I drift 2026-10-15**: vyn med PR #289 (b85b892, Vercel 19.31 UTC) och
  migrationen direkt efter (`minne/databasen.md`). Mellan de två räknade vyn
  Intervju som förut, ur läget, och efter migrationen är fliken tom.

### Intervjun bokas på en bokningssida (2026-10-20)

Leo: "hur fixar jag som ett schema i google där de kan boka in sig för
google meet", och sedan "gör allt så att det blir klart så att jag bara kan
skicka ut länk till ansökande". Ingen koppling till kalendern: Google Kalenders
bokningsschema, med Meet som plats, och länken i vårt mejl.

- **Länken står i `INTERVJU_BOKNINGSLANK`** i `nextrum-config.js`, och bara en
  https-adress räknas (`bokningssida()`). Tom är allt som förut: mejlet
  föreslår tre tider.
- **Mallen** (`mallIntervju`) har länken i stället för de tre tiderna, säger
  att mötet är i Meet, att länken kommer i Googles bekräftelse, att inget
  Google-konto behövs och att den som inte hittar en tid kan svara på mejlet.
- **Skriv till hen skickar en ny till Intervju** när länken är satt
  (`till_intervju_at`, samma stämpel som Skicka vidare). Mejlet är då
  kallelsen: hen bokar själv, och Boka möte, som annars skickar vidare, används
  inte. Utan länken är Skriv till hen bara en kontakt, som 2026-10-15. Läget
  rörs som förut (Ny blir Kontaktad).
  Intervjumejlet (2026-10-21, `minne/notiser.md`) går då inte: databasen ser
  `kontaktad_at` i samma ändring som steget.
- **Steg 1 och 2 i Rekryteringen säger det**: steg 1 visar bokningssidan (och sedan samma dag att mejlet
  går från info@, nedan), eller
  var den sätts; steg 2 säger att mötet står i kalendern för info@, inte här,
  och att Boka möte mejlar tiden en gång till också när hen redan bokat.
- **Vyn läser aldrig kalendern.** En bokning syns i adminvyn först om någon
  sparar den med Boka möte, och fliken Intervju säger Kontaktad, inte en tid.
- **Bokningssidan ska ligga i info@nextrum.se**: där gäller Workspace-avtalet
  (`DATASKYDD.md` avsnitt 3), och policyn säger "vår kalender hos Google". Den
  lovar också att bokningen tas bort för hand senast ett år efter intervjun
  (rad 10 och avsnitt 8 i `DATASKYDD.md`).
- `verktyg/prova-ansokningar.js` provar mallen, stämpeln och stegens text med
  en länk satt, och att inget ändras utan den.
- Länken är satt sedan samma dag: `https://calendar.app.google/rRiTTLP5ymKQunSv7`
  (Leos bokningsschema i info@, med tider till kl. 20). Den första,
  `…/9pBZSKMmgtdMLX4i7`, var fel schema, med tider bara till kl. 17 (Leo
  2026-10-20: "du länkade fel", "ny mötesgrupp"). Byts länken ändras configen,
  `INTERVJU_MEJLET` i adminvyn och `intervju.ts` tillsammans, och `notis-ko`
  driftsätts efter merge: annars mejlar det automatiska intervjumejlet den gamla.

### Mejlet till den som söker skickas härifrån (2026-10-20)

Leo samma dag: "går det inte bara att skicka mail från plattformen? jag ska
kunna redigera mailet och sen bara tryck skicka". Rutan öppnade förut ett utkast
i Gmail, från det konto som råkade vara inloggat i webbläsaren.

- **`kontaktaRuta` tar `skicka`** (kärnan): då står Skicka som primär knapp,
  Öppna i Gmail bredvid som reserv, och Till går inte att ändra, för adressen
  väljer funktionen. Svaret är felet som text eller null; ett fel står i rutan,
  som står kvar, och inget stämplas. Går mejlet körs `efterat` som för Gmail.
- **Bara Rekryteringen har den**: Skriv till hen och Skicka utbildningen
  (`skickaTill()`, `ansokan-mejl`). Anmälningarna, studiehjälparna, Påminn och
  felgrupperna öppnar Gmail som förut.
- **Funktionen tar ansökans id, ämnet, texten och en nyckel per ruta**
  (`forsok`), aldrig en adress: adressen läses ur ansökan med adminens token.
  Mejlet går från info@ i mejlens skal, ett stycke per tom rad och
  https-adresser som länkar, med en hemlig kopia till info@. Varför:
  `supabase/functions/_delad/ansokan_mejl.ts`.
- **I drift sedan 2026-10-20** (`ansokan-mejl` v1, CLAUDE.md avsnitt 11). Inget riktigt mejl är skickat än.
- **Utan funktionen** (före driftsättningen) svarar den 404, och rutan säger
  att `ansokan-mejl` inte är driftsatt än och att Gmail går.
- Proven: `_delad/ansokan_mejl_test.ts` (adressen, gränserna, nyckeln,
  escapningen och länkarna) och `verktyg/prova-ansokningar.js` (rutan, anropet,
  stämpeln och felet).

### Tusen rader (2026-09-29)

Leo: "de raderna ska inte försvinna efter 1000st". PostgREST lämnar ut
högst tusen rader per svar (`max-rows`) och säger inte att det finns
fler: svaret ser helt ut, och ingenting blir rött. Vyerna hämtade varje
lista med en enda fråga. Provat med en stubbad `supabase-js` som kapar
som PostgREST, med 2 400 pass och 1 500 anmälningar:

- **Adminvyn** (nyast först) hade 1 000 av 2 400 pass: allt före 22
  januari 2026 saknades, elva månader, i Lektioner, Ekonomi, Löner och
  talen. Passunderlaget och anmälningarna likadant.
- **Studiehjälparvyn** (äldst först) tappade i stället de NYA: 0
  kommande pass, där det fanns 59. Familjens vy sa "Inga kommande pass".
- **Vakten i adminvyns skal** jämför listornas längd med databasens
  `count`. Med listan kapad vid tusen såg den 501 nya anmälningar vid
  varje koll, hämtade om listorna och stod på "(501)" i fliken för alltid.

Nu går varje lista som växer genom `NXStudie.hämtaAlla(supa, tabell,
kolumner, bygg, nyckel)` (adminvyn genom omslaget `hämtaAlla` i kärnan):
sida efter sida tills databasens eget antal (`count` på första sidan)
är nått, aldrig tills en kort sida kommer, för sänks `max-rows` är varje
sida kort (provat med 500). Sorteringen slutar på en unik nyckel, oftast
`id`, som också ska stå bland kolumnerna: sidorna är egna frågor, och en
rad som hann komma med på två sidor tas bort på den. Ett fel på en
senare sida ger felet, aldrig en halv lista.

- **Vad som går genom den:** i adminvyn allt i `hämtaAllt()` och
  `hämtaEkonomiunderlag()` utom inställningarna och frågorna med en
  avsiktlig gräns (de 400 senaste meddelandena, 100 klientfel, 40
  rapporter, 300 aktörer ur auditloggen), och dessutom skalets
  omhämtning av anmälningarna, biblioteket, dokumenten och lönefilens
  rader. I studiehjälparvyn passen och timbankens uttag, i familjens vy
  passen, passunderlaget och tilläggen, och i NexLäx
  (`nextrum-uppgifter.js`) nivåkatalogen och elevens försök. Det som
  hämtas per månad, per person eller med en gräns hämtas som förut.
- **En ny fråga som hämtar en hel tabell ska gå genom `hämtaAlla`.**
  Felet syns inte förrän tabellen har tusen rader, och då syns det inte
  heller: listan ser bara kortare ut.
- **En `.limit()` över tusen är en gräns på tusen.** Försöken i NexLäx
  (Fas 23.2) hämtades med `.limit(2000)`, äldst först, samma dag som
  det här byggdes: vid tusen försök hade de nyaste fallit bort, och
  stjärnorna, XP:n och serien räknats utan dem. En gräns som ska vara
  poängen ska ligga under tusen; allt annat går genom `hämtaAlla`.
- `nextrum-modulvakt.js` prövar `NXStudie.hämtaAlla`: en gammal
  `nextrum-studie.js` ur cachen hade annars gett ett TypeError mitt i
  hämtningen.
- I driften fanns 7 pass när det här byggdes, så ingenting hade hunnit
  försvinna. Priset är en `count` per lista när vyn laddas. Det som en
  dag blir för tungt att hämta i sin helhet ska hämtas per månad, inte
  kapas.

### Barnets vy och adminvyn med behörigheter (barnkonton_och_admin, 2026-09-30)
- `barn.html`: samma kort och rader som studievyn (`.vy-kort`, `.vy-rad`,
  `.lage`), och `.bv-*` i `nextrum-arbetsyta.css`, bara tokens. Ingen länk
  till föräldervyn. Sedan 2026-10-06 samma skal som studievyn: hälsningen
  (`NXArbete.hero`) och sidomenyn (`NXStudie.sidomeny`) med fem delar,
  Översikt, Mina lektioner, NexLäx, Meddelanden och Profil (se "Hälsningen,
  en bild per veckodag" nedan och `minne/barnkonton-och-admin.md`), och
  sedan 2026-10-12 Boka pass som en sjätte, bara när föräldern låtit barnet
  föreslå pass (`boka`; menyposten är dold annars). Förut en
  spalt utan meny och utan bild. Mina lektioner har studievyns flikar (Pass,
  Studieplan, Rapporter) men ingen betalning; Översikt räknar genomförda och
  kommande pass (`.bv-antal`). Barnets tråd med studiehjälparen ritas av
  `NXStudie.barnTråd` (`.bv-chatt` hos barnet, `.bc-*` hos studiehjälparen
  och föräldern), med familjens trådklasser (`.tr`, `.ch`).
- Föräldrarnas ruta Barnens inloggning heter `bi-*` (`#bi-ruta`,
  `data-bi-*`), för `bk-*` och `#bk-msg` är bokningens och stod redan i
  samma sida.
- En admin med behörigheter får sina sektioner genom `o.tillåten` i
  `NXStudie.sidomeny` (de andra döljs och går inte att nå med en adress),
  flikarna hen inte har tas bort ur DOM:en, och en rubrik utan synlig post
  göms (`städaMenyn`). Sedan 2026-10-15 ritas i en synlig sektion bara de
  knappar databasen släpper fram (`får(kod)`, `ärSuperadmin()`), och
  `skriv()` säger när en uppdatering inte träffade något. Se
  `minne/barnkonton-och-admin.md`.

### Hälsningen, en bild per veckodag (2026-10-06)
Leo: "På studievyerna ska rullande heron ändras varje dag så de blir en ny
bild, och de ska stå vilken dag på veckan de är också där", med sex bilder
"för de andra dagarna". Alla sex fanns redan i `bilder/` (01, 03, 04, 02, 07
och 09-online-v2, i den ordning de skickades), så inga nya filer.
- Listan är `NEXTRUM_HERO_VECKA` i `nextrum-images.js`, måndag först; en
  post pekar på en nyckel i `NEXTRUM_IMAGES`, så att `focal` följer med och
  sätts som `object-position` på bilden. Ansiktena står olika i varje bild,
  och på en telefon beskärs bilden hårt i sidled.
- Måndagen är den gamla hälsningen: hero-bilden och filmen
  (`hero-studievy.mp4`), som är filmad i samma scen. Filmen spelar bara den
  dagen; annars hade den tonat in över dagens bild och gömt den. De andra
  dagarna driver stillbilden som förut, och på en telefon spelas ingen film.
- `NXArbete.dagensHero()` väljer posten (getDay() börjar på söndag) och
  skriver dagen: "Tisdag 6 oktober", i etikettens rad, ljusare än etiketten.
  Står vyn öppen över midnatt byts dagen, bilden och hälsningen (en timer,
  och samma prövning när fliken kommer tillbaka); bara bildlagret ritas om.
- Laddar inte bildregistret står hero-bilden kvar utan film, och dagen står
  där ändå. Vyerna skickar inga bildvägar längre.
- Fredagen bytte 2026-10-27 från `anpassning` (02) till `forklaringen` (06),
  Leo: "vissa ser konstiga ut på mobilvy och byt ut en av de bilderna". På
  en telefon visade 02 bara studiehjälparens tröja, utan huvud; 06 har båda
  ansiktena i utsnittet. Söndagen bytte samma kväll från `online` (09), med
  bara ett halvt ansikte vid kanten, till `studiehjalparen` (11), Leo:
  "söndagen bilden gillar jag ej". Sju stilleben utan människor (skrivbord, block,
  lampor) skulle stå varannan dag, men Leo ändrade sig samma kväll ("de ska
  ej vara i studievyn"), så de finns inte i repot.
- Provat med klockan ställd på varje veckodag, på dator och telefon, och i
  `verktyg/prova-barnkonton.js` (`provaHälsningen`), som har listan en gång
  till med flit: ändras den i registret blir provet rött.

### Introduktionen (2026-10-06)
Leo: "skapa också en introduktion med skärmdump och förklaringar som
finns som en funktion i både anställdas och familjernas plattform ... sist
så är det fortsätt vilket låter en komma in på plattformen och börja boka
lektioner, detta ska ske efter att man bekräftat sitt nya lösenord."
- `nextrum-introduktion.js` (`NXIntro.visa`): en skärmdump ur vyn i taget,
  rubriken och vad delen är till för, prickar och Tillbaka och Nästa;
  sista bilden har Fortsätt. Sju bilder i studievyn och åtta i
  studiehjälparvyn (`STEG`). Samma ruta som bekräftelserna (`.nx-fraga`),
  stilen i `nextrum-vy.css` utan hexkoder.
- **När**: av sig själv när `user_metadata.valkommen` står på `'intro'`,
  alltså efter lösenordet för den som tagits in och efter första
  inloggningen för den som registrerat sig (`NXStudie.introduktion`,
  `minne/sakerhet.md`). Första gången går den bara framåt och bakåt, för
  Fortsätt är vägen in; öppnad igen (Visa introduktionen under Profil,
  `data-intro="<roll>"`) har den Stäng, och Escape stänger. Väntar
  familjen på sin matchning, eller studiehjälparens profil på att
  godkännas, säger sista bilden det (`VÄNTAR`): familjen kommer in men
  kan inte boka än (2026-10-07, `minne/affaren.md`), och studiehjälparen
  hamnar i väntläget.
- **Texterna säger bara det vyn själv säger.** Betalningen beskrivs inte:
  villkoren står på de ställen `kolla-betalningsvillkor.py` räknar, och en
  mening till vore ett ställe till att glömma. Ändras en del som en bild
  visar: ta om bilderna och läs texten igen. NexLäx-bilden visar Din väg,
  som Fas 23.5 inte ändrade (bilderna togs om efter den och blev byte för
  byte desamma).
- **Bilderna** är tagna i en telefons bredd (390 punkter, dubbel
  upplösning, 780 × 880) så att texten i dem går att läsa på en telefon;
  på en dator står bilden till vänster om texten (från 760 px). Vägarna
  står i `NEXTRUM_INTRO` i `nextrum-images.js`, webp med jpg som reserv.
  `verktyg/bygg-introbilder.js` tar dem mot en falsk Supabase med
  påhittade familjer, aldrig mot driften (`minne/genererat-och-ci.md`).
- **Knapparna står stilla** mellan bilderna (fälla 4 ovan): bilden har sina
  proportioner innan den laddat (`aspect-ratio`), texten har plats för den
  längsta (`min-height: 13em` på en telefon), och Nästa och Fortsätt är
  lika breda. Provat på 390 × 844, 360 × 740, 800 × 700 och 1280 × 900:
  Nästa står på samma punkt på varje bild. En längre text kan flytta den;
  `prova-introduktion.js` mäter.
- **Barnets vy har ingen introduktion**: barnet kommer in med ett
  användarnamn föräldern gett det, och vyn har fyra delar. Den
  behövs inte, och ingen bad om den.

### Utbildningsprovet före studiehjälparvyn (2026-10-21)
Ordningen vid inloggningen i studiehjälparvyn är lösenordet (`lösenordFörst`),
provet (`NXProvet.förstGörs`, bara för en godkänd studiehjälpare), villkoren
(`villkorFörst`) och introduktionen; provet kom efter villkoren till 2026-10-20
(Leo: "först välja lösenord och sen provet"). Provet är samma ruta (`.nx-fraga.nx-prov`)
och går inte att stänga: Escape gör inget, och utan provet finns inget att
visa, för databasen lämnar inte ut elever, pass eller meddelanden förrän det
är klart (`minne/affaren.md`). Logga ut står kvar. Alternativen är hela
etiketter på minst 44 px med 16 px text (`.nx-prov-alt`), och den valda tar
accentens färg med `:has(input:checked)`. Svarar databasen inte, eller saknas
`mitt_utbildningsprov()`, visas ingen ruta. Förhandsvisningens värld svarar
att provet är klart (`nextrum-forhandsvisning.js`).

### Köpvillkoren före kassan, planens månad och Liggaren (2026-10-21)
**Rutan före kassan** (`NXStudie.kassansVillkor`, `.nx-kassa-villkor`): varje väg till Stripe i studievyn
(Köp under Erbjudanden, Köp till timmar, Betala med kort och tillägget på passet, Spara kortet och Byt kort)
frågar först, i samma `.nx-fraga`-ruta som resten av vyn. Den säger vad som köps och priset (kodens pris när en
rabattkod gäller, annars `medRabatt()`), för en plan också månaden, och har kryssrutan med länken till
köpvillkoren (`CFG.KOPVILLKOR_URL`). Fokus står på krysset när den öppnas, Till kassan är `disabled` tills det
är ikryssat, Tab stannar i rutan, och Escape, Avbryt eller ett tryck utanför stänger utan att något händer.
Krysset är en etikett på minst 44 px, och knappen bär orange som Köp. Anropet bär `villkor: true`, aldrig ett
belopp.
**Planens månad**: plankorten har två knappar (`.erb-manad`, `[data-erb-manad]`, `aria-pressed`, minst 44 px)
och raden under (`[data-erb-manad-not]`); ett tryck byter bara knapparnas läge och radens text, så kortet inte
byter höjd under fingret (fälla 4). Valet bor i `S.erb.manad` per plan, och det syns bara när
`planens_manader()` svarat. **Timbanken** har en rad per månad under batteriet (`.tb-manader`, `.tb-manad`, i Er
timbank och i Profil → Timbanken), nästa månads plan står i listan med streckad linje ovanför
(`.ar-kommande`) men inte i batteriet, och timmar som betalats tillbaka räknas inte någonstans.
**Adminvyn**: Betalningar har flikarna Liggaren och Kortet (`nextrum-admin-liggaren.js`, `ritaLiggaren`, i
`BARA_SUPER` och modulvakten). Raderna är `.eko-rad` som Alla betalningar, med `data-lig-rad`; filtren är
chippen `[data-lig-filter]`, och sökningen är `#lig-sok`. Före migrationerna säger listan det i stället för ett
fel. Proven: `verktyg/prova-kassan.js`.

### Notiserna vid inloggningen (2026-10-12)
Leo: "gör ett notissystem som kommer som en popup när man loggar in. har
man inga nya notiser kommer en popup inte upp, har man nya notiser såsom
att man måste betala ett pass eller att man har en föreslagen tid att
granska kommer en popup med notisen där. det går inte att stänga av".
- **Samma poster som klockan.** Studievyn och studiehjälparvyn räknar det
  som väntar i `notisposter()`, och `ritaNotiser()` ger det till klockan
  i sidhuvudet (`NXStudie.notiser`) och `start()` till rutan
  (`NXStudie.notisruta`). En ruta som räknade på sitt eget sätt hade förr
  eller senare sagt något annat än klockan bredvid. Ingen post, ingen
  ruta. Tabellen `notiser` (händelserna, med `last_at`) läses fortfarande
  inte av vyerna: rutan visar det som väntar nu, inte det som hänt.
- **Raden säger vad som är kvar på passet** (Leo samma kväll: "ett pass
  att bekräfta ska det heta om det redan är betalt. ett pass att betala
  och bekräfta ska det heta om det inte är betalt än"): Ett pass att
  betala och bekräfta (obetalt, `rbObetald`, eller ett obetalt tillägg,
  och rapporten obekräftad), Ett pass att betala (rapporten bekräftad
  men kassan avbröts) och Ett pass att bekräfta (inget att betala).
  Förut stod alla som "En rapport att bekräfta", och betalningen syntes
  inte i notisen. Att bekräfta säger aldrig "betalt": ett fakturapass och
  ett pass på noll kronor har inget att betala i vyn men är inte betalda.
  Resten är som förut: föreslagna tider först, fakturor, meddelanden och
  sena uppgifter, och inget pass att betala i förväg (Fas 19.2: det är
  ett val, inte familjens drag).
- **En gång per inloggning**, och en inloggning är att vyn öppnas: en ny
  flik, efter att webbläsaren stängts, eller efter Logga ut och in igen.
  Inte när sidan laddas om. `sessionStorage` (`nx-notisruta`) bär bara
  vems rutan visats för, aldrig vad som väntade; `loggaUt()` tömmer den,
  och vakten gör det när någon blivit utloggad. Går lagringen inte att
  läsa kommer rutan varje gång vyn laddas.
- **När allt är hämtat**: familjens vy väntar också in trådens första
  hämtning (`NXKontakt.tråd(...).klar`), för det är den som räknar de nya
  meddelandena. Inte på väg tillbaka från kassan (`betalsvar`): webhooken
  har kanske inte hunnit, och då hade passet man just betalat stått som
  ett pass att betala. Står en annan `.nx-fraga` öppen går den först;
  rapportrutan i studiehjälparvyn står alltid i sidan med `hidden` och
  räknas inte.
- **Den går inte att stänga av**: inget val under Profil → Notiser, för
  det rutan visar slutar inte vänta för att man slutat se det. Rutan
  stängs med Stäng eller Escape och kommer tillbaka nästa inloggning så
  länge något väntar; ett tryck utanför stänger inte (på en telefon är
  det ett tryck som missade). En rad leder dit, som raden i klockan
  (`tillNotis`), och stänger rutan. Fokus på rutan, inte på första raden,
  så att ingen rad ser vald ut.
- **Barnets vy och adminvyn har ingen ruta**: barnet kan inte boka,
  svara eller betala, och adminvyn har Att göra och morgonmejlet.
- `verktyg/bygg-introbilder.js` sätter `nx-notisruta` innan sidan laddas,
  annars hade rutan legat över varje bild.
- Provat mot den falska Supabase-världen ur `bygg-introbilder.js`, i en
  telefons bredd, ljust och mörkt: rutan med motförslaget och passet att
  betala (familjen) och förslagen och passet utan rapport
  (studiehjälparen), ett oläst meddelande, ingen ruta när inget väntar,
  ingen efter omladdning, igen i en ny flik, Escape, Stäng, Tab och ett
  tryck utanför.

### Förhandsvisningen i adminvyn (2026-10-12)
Leo: "bygg två förhandsgranskningvyer där till vår admin vy, där ska vi
med våra konton kunna se en förhandsgranskning av studievy och
studielärarvyn", och samma kväll: "vyerna, studievy och studiecoachvyn
ska vara kopplade med varandra i förhandsgranskningen, man ska kunna leka
där och lätt kunna byta vy i admin. tex föreslå tid och byta vy och
acceptera. detta ingår inte i riktig statistik eller underlag för lön
eller faktura".

- **Adminvyn**: sektionen Förhandsvisning (`data-sek="forhandsvisning"`,
  under Inställningar, för varje admin: `SEKTIONER.forhandsvisning` är
  alla behörigheter) med två rader och Öppna i en ny flik, till
  `/foralder?forhandsvisning` (familjen Andersson: Anna, och Alva i
  årskurs 6) och `/larare?forhandsvisning` (Sara Svensson, med Alva och
  Kim). Ingen ritfunktion, bara länkarna och en ruta som säger hur den
  fungerar.
- **Vyerna** är de riktiga, med de riktiga filerna: bara klienten är en
  annan (`nextrum-forhandsvisning.js`, laddad före `nextrum-app.js`, som
  frågar den efter klienten). Världen är introduktionsbildernas familjer
  (`verktyg/bygg-introbilder.js`) med dagens datum och dagens pris, ett
  förslag från Alva, barnets tråd, en plan och NexLäx-nivåer med fyra
  påhittade frågor var. Den svarar som PostgREST så långt vyerna frågar
  (filtren, `or`, ordningen, `limit`, `count`, `.single()`, de inbäddade
  `nivaer`, `biblioteksmaterial` och `invoice_lines`), med RLS i
  `synlig()`: föräldern ser sin familj, studiehjälparen sina elever.
  Triggrarna som vyerna ser efteråt står i `stämpla()` (motförslaget och
  avbokningen, som `stampla_avbokningen`) och `efterSkrivning()` (en
  rapport gör passet genomfört).
- **De två vyerna delar världen.** Den sparas i `localStorage` efter
  varje skrivning och läses om före varje fråga, så föräldern föreslår,
  Byt till studiehjälparvyn i remsan, Acceptera, och tillbaka. En flik
  som står öppen laddar om när man kommer tillbaka till den och världen
  ändrats i en annan. Börja om tar bort den; den börjar också om en ny
  dag och när världen i filen ändras (ett fingeravtryck av den nya
  världen).
- **Remsan** står överst i sidhuvudet (`.nx-fv`, ockra, i
  `nextrum-arbetsyta.css`): vem man är, att det är påhittat och inte
  räknas, och Byt, Börja om och Till adminvyn, 44 px höga. Fliken heter
  "Förhandsvisning · …". I sidhuvudet och inte i innehållet: heron drar
  sig upp under sidhuvudet och hade täckt den.
- **Det som inte görs** säger det: edge-funktionerna (betalning, AI,
  mejl, Meet) svarar 409 med "Det här görs inte i förhandsvisningen",
  rabattkoderna prövas inte, betygsgarantin och barnets e-post sparas
  inte, och Mästarprov och repetition startar inte.
- **Statistiken.** Förhandsvisningen skriver aldrig i databasen. Konton
  vi redan har (ett adminkonto som också är förälder hade 2026-10-12 alla
  16 passen i driften) räknas inte i Översiktens tal (`räknas()`,
  `ärAdminkonto()` i kärnan, ur `admin_roller`) eller i Statistik
  (analysvyerna, `minne/databasen.md`). Listorna visar dem som förut.


## Värvningsbonusen i vyerna (2026-10-21, `varvningsbonus`)

Regeln står i `minne/affaren.md` (Värvningsbonusen); här bara ytorna.

- **Adminvyn, sektionen Värvningsbonus** (`#varvning`, `nextrum-admin-varvning.js`, `ritaVarvning`, efter Löner i
  menyn och bara superadmin: `BARA_SUPER`, modulvakten och `kolla-csp.py`). Raderna hämtar kärnan
  (`S.varvningsbonus`, med `manad` ur `intjanad_at` i svensk tid) bakom `bara()`, så en admin med behörigheter hämtar
  dem aldrig. Inställningen står i en rad överst, sedan Väntar, Intjänade, inte utbetalda och Utbetalt
  (`.adm-tal-rad`), chippen för läget och väljaren för månaden (månaden bonusen tjänades in, annars månaden raden
  skrevs), en rad per bonus i `tabell()` och summeringen per värvare och lönemånad. Markera utbetald och Annullera
  frågar i `fråga()` med ett fält (lönemånaden ÅÅÅÅ-MM, skälet minst tre tecken) och läser om allt efteråt, också
  Löner. Allt ur databasen går genom `esc()`, och CSV:n byggs ur samma rader som syns (BOM, semikolon,
  decimalkomma), med ören bredvid kronorna för lönen. Dagarna och lönemånaden räknas i Stockholms tid
  (`toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })`, också i kärnans `manad`), inte i webbläsarens.
- **Löner** har kvar sin ruta för månadens bonusar, med samma knappar; lyssnaren står i `nextrum-admin-varvning.js`,
  så knappen gör samma sak var den än står.
- **Studiehjälparvyn, Profil → Värva en kompis** (fliken hette Tipsa en studiehjälpare; `nextrum-studie.js`,
  `ritaVärvning`): koden, länken med Kopiera, beloppet och händelsen ur `mina_tips()`, och listan med en rad per
  kompis (`.nx-varv-lista`: förnamnet eller "En kompis som sökt", bonusens dag eller lönemånad och läget som märke;
  en väntande har inget datum, för när kompisen sökte är en uppgift ur ansökan). Villkoren länkas ur
  `CFG.VARVNING_VILLKOR_URL` (`#tips` sedan versionen 2026-10-22); tom ger den en platshållare. Utan `varvningar` i svaret
  (migrationen inte körd) ritas den gamla rutan med antal.
- **Jobbansökan** (`bli-studiehjalpare`, båda språken): beskedet under kodfältet (`.nx-kod-besked`, `role="status"`,
  `aria-describedby` på fältet) i mossa när koden gäller och i `--acc-lugn` när den inte gör det, som filnamnets fel
  (`.nx-fil-namn.fel`); ansökan går in ändå.

## Granskningen i adminvyn (2026-10-21)

En granskare som inte skrivit koden läste vyerna med fokus på tidszonen; en annan pengaflödet.

- **En dag ur en tidsstämpel är Stockholms.** `kortDatum` skar `slice(0, 10)` ur en tidsstämpel, alltså UTC-dagen,
  och grenen använde den på nya ställen (rekryteringen, Löner, Koder, Insatta timmar, Liggaren, Syskontillägg): en
  bonus intjänad 1 november kl. 00.30 stod under novembers lön med texten "intjänad 31 oktober". Kärnan har nu
  `sthlmDag(iso)` (`toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })`; ett datum utan tid lämnas som det
  är, och en ogiltig tid faller tillbaka på de tio första tecknen), `kortDatum` går genom den, och lönefilens datum
  (PAXml), Liggarens `datetime`, Värvningsbonus och Avser månad under Insatta timmar använder den. Ett datum ur
  databasen som redan är en dag (passets `wanted_date`) rörs inte.
- **Syskontillägg → Släpp betalningen**: en post som står i en betalning har knappen; den frågar efter orsaken (3–500
  tecken, utan namn) och kör `tillagg_forsok_slapp_admin`, som släpper hela betalningen (alla poster i den blir
  upplupna igen, utom ett hållet pass som avbokats). Svarar databasen nej var den redan släppt eller betald.
- **Betalningar och Månadens ekonomi** har en rad per syskontillägg, på dagen betalningen kom
  (`S.syskonRader`, hämtade med ekonomiunderlaget: liggarens rader av typen `syskon` och betalningen de hör till),
  med läget ur betalningen och raden (återbetald när raden är det), Stripes avgift bara för en betalning som är
  tillägg och inget annat, och testbetalningar utanför talen. Månadens ekonomi har raden Syskontillägg under Kommit
  in, och bokslutet raden Syskontillägg, betalda i månaden (`manad_lage` → `syskon`). Saknas tabellerna är raderna
  inga.
- **Radera**: hindret `syskon_kommande` säger att passen avbokas först, för barnen på ett pass ändras inte.
- Provat: `prova-adminvyn.js` mot en databas byggd ur alla migrationer, med en betald och en väntande betalning för
  tillägget i fixturen, så att knappen, raderna och bokslutet ritas mot de riktiga tabellerna.

## Sen avbokning i vyerna (2026-10-22, `sen_avbokning`)
- **Familjens vy**: Avboka frågar `sen_avbokning_lage()` när familjen trycker och säger vad det kostar ("Avboka
  ändå"); passets sida säger det de sista 12 timmarna och har ingen Föreslå ny tid (svaret sparas per pass i
  `S.senLäge`, och sidan ritas inte om efter en väntan om familjen gått vidare). Ett sent avbokat pass har beskedet,
  priset ("199,50 kr", eller "30 min ur timmarna", aldrig "0 kr") och Betala nu, och står under Att betala som "Avbokat
  sent: hälften av passet". Kolumnerna hämtas i en egen fråga (`laddaPass`), så vyn tål att de saknas.
- **Adminvyn**: Avboka frågar inom 12 timmar om familjen bad om avbokningen för sent (bara när databasen säger att
  regeln gäller), och skriver `avbokad_for_familjen` i samma uppdatering; Betalningar räknas om efteråt. Alla
  betalningar visar avgiften (obetald under Att få in, betald, eller "ur timmarna"), Att göra och Påminn säger "en sen
  avbokning", och passets panel har delen Sen avbokning med Efterskänk avgiften (superadmin). Kolumnerna hämtas i en
  egen fråga i kärnan och läggs på `S.bokningar`.
- Provat: `verktyg/prova-sen-avbokning.js` (port 8986).

## Om oss och Så ser ni att det funkar (2026-10-22, i drift sedan 2026-10-24, PR #332)
Leo ville ha en Om oss-sida och en sektion direkt efter Hur hjälper vi ert barn som visar att det funkar, utan något vi
inte kan belägga: vi är nya och har inga siffror, omdömen eller resultat.
- **Om oss** (`/om-oss`) är en berättelse i ordning (samma dag, Leo: "gör storytelling bättre"): hero med "Läxhjälp
  av någon som nyss gick kursen." och N-märket i ringar i stället för ett foto; Köksbordet på barken, där läxan låser
  sig mellan förälder och barn, med Leos "Ibland behövs bara någon annan än mamma och pappa." som vändning; Idén
  (iakttagelsen ur Vår idé, vad en studiehjälpare inte är, och sist Varför vi startade, `.om-egna`: tre
  meningar ur grundarnas citat på startsidan, skrivna 2026-10-24 när Leo sa "lös det själv" om storyn, utan en påhittad
  scen; platshållaren togs bort före merge samma dag och syntes aldrig live); Därför finns Nextrum med ett skäl för eleven, föräldern och studiehjälparen i
  ämnesfärgernas ordning; Så går det till; Vägen fram till första eleven (ansökan, intervju, utbildning, provet); Det
  här kan ni kräva av oss; rutan Vi är nya (det enda stället där ordet omdöme får stå); sex frågor och Nästa steg med
  "samma person varje gång". Ingen mening sägs två gånger. Knapparna går till intresseanmälan med
  `utm_source=om-oss&utm_medium=sajt&utm_campaign=okt26`. Texten är sajtens egen (Vår idé, FAQ:n, startsidan och
  guiderna `hjalpa-barn-med-matte` och `laxhjalp-eller-privatlarare`) eller Leos tre ankarmeningar; inget är nytt i
  sak, och ingenting säger hur ofta något händer ("ibland", aldrig "de flesta"). Ingen engelsk sida: engelskans
  footer länkar till den svenska.
- **Så ser ni att det funkar** (`#exempel`) **togs bort 2026-10-26** (Leo: "Exempel så ser ni att de funkar sektionen på
  main sidan ta bort den"): sektionen på båda språken, `nextrum-exempel.js` och `-css`, provens del om den och raden i
  språkbaslinjen. Om oss länk i Vi är nya går sedan dess till studievyn på För elever och föräldrar ("Se vad ni får i er
  vy"). Det som stod här beskrev den: rapporten med fälten som `NXStudie.rapportKort` ritar dem (läget ur
  `GICK`, Öva mer på, Nästa gång, "Rapport från er studiehjälpare" när namnet saknas), studieplanen (ämne, mål, planen)
  och Översikt i föräldrarnas vy (Att göra med Passar bra och Avböj, Kommande pass, och Så går det med Hur passen gick
  och Kunskapsområdena som `ritaFordelningar()` ritar dem för en elev med ett pass), med
  vyernas färger för läget: ockra väntar, mossa klart. Siffrorna i kortet pekar på listan bredvid och är dekor
  (`content: attr() / ""`), listan är en `<ol>`. Tejpen "Exempel, påhittad elev" står på varje flik. Varje flik börjar
  med en rad om var i familjens vecka delen står (`.ex-panel-intro`: Efter varje pass, Vart ni är på väg, Allt på ett
  ställe), som syns också när panelens rubrik göms av flikarna. Rutorna inne i
  kortet är `--tint`, för `--pap-2` och `--yta` är nästan samma i mörkt läge, och den valda fliken tar `--bricka` där.
  En siffra vid en text står i kortets marginal (`--ex-pad`), aldrig på en bokstav, och ekvationerna bryts inte
  (`.ex-ekv`). Granskad i två varv i 1440 och 390, ljust och mörkt.
- Engelskans knapp går till `/en/intresseanmalan` med samma utm; startsidans går till `/intresseanmalan` med
  `utm_source=startsida` och `utm_content=exempel`.
- **Säljet** (2026-10-24, Leo: "sälj in oss själva mer"): sidan ber om steget fler gånger, men lovar bara det sajten
  redan lovar. Tre bockar under heron (`.om-loften`: gratis att skriva upp sig, svar inom ett dygn, ingen
  bindningstid, ur startsidans rad under knapparna), rutan Första steget tar ett par minuter efter Så går det till
  (`.om-borja`, startsidans "ungefär två minuter"), krav-rubriken "Våra löften. Håll oss till dem." och raden "Det
  kostar ingenting att fråga och binder er inte till något." (guiden `laxhjalp-eller-privatlarare`) under sista
  knappen (`.om-sist-not`) och i `#exempel` (`.ex-fot-not`). "24 timmar" står som "ett dygn", för innehållsprovet
  fäller en siffra före "timmar". Inget pris, inget antal och inget om resultat: säljet är att det är lätt och
  ofarligt att börja, inte att det går bra för andra.

## Papperskorgen (2026-10-26, `papperskorgen`, i drift samma kväll)

Leo: "i intresseanmälningar och ansökan, under varje flik, gör en knapp för papperskorg, vilket är radera uppgifter
från det stället. alltså finns personen i familj och intresseanmälan och jag raderar den perosnen från
intresseanmälan så finns personen kvar i vårt system och i familj. när en person blir raderad och det stället är det
sista stället den är med i så kommer en notis om att det kan ta bort personen helt och sen avbryt eller gå vidare. jag
vill kunna optimera min admin och flytta folk vart jag vill eller ta bort de helt".

- **Knappen** är en ikon sist på varje rad under Intresseanmälningar (alla lägen) och i varje flik under Ansökningar
  (Nya, Intervju, Utbildning, Konto skapat, Avböjda): `papperskorg()` i kärnan, som `o.bort` i `namnlista()`, och bara
  för en superadmin (databasen nekar alla andra). 44 px, grå tills man pekar. Ensam på raden står den kvar på namnets
  rad också på en telefon (`li.bara-bort`); med ett nästa steg står den längst till höger under namnet.
- **Rutan** (`visaPapperskorg` i `nextrum-admin-radera.js`) frågar `stalle_lage()` först och säger vad som går och
  var personen står kvar (Under Familjer, Under Studiehjälpare, ett adminkonto, en anmälan eller ansökan till med samma
  adress, frågor under Kommunikation), och vad som inte går att ta tillbaka: en värvningsbonus som väntar på ansökan
  och annulleras, ett mejl till hen som inte gått (nejet, intervjumejlet), och vårdnadshavarens godkännande när
  personen är studiehjälpare. **Är raden det sista stället** heter rutan "Ta bort X helt?", säger det i en röd ruta och
  har Avbryt och Gå vidare (Leos ord). Annars "Ta bort X från Intresseanmälningar?" med Avbryt och Ta bort: rutan
  frågar också då, fast Leo bara bad om frågan för det sista stället, för en papperskorg i en lista är lätt att träffa
  och ett CV som är borta går inte att få tillbaka. Fokus på Avbryt.
- **Gå vidare och Ta bort** frågar databasen en gång till och vägrar om svaret på "sista stället" ändrats sedan
  rutan öppnades; sedan CV:t genom Storage (svaret läses, och en fil som inte gick ger ingen borttagning), sist
  `ta_bort_ur_stallet()` med `p_helt`. Listan ritas om ur det vyn redan har (raden går ur `S.leads` eller
  `S.ansokningar`), utan att hämta allt, så att nästa rad går att ta direkt; panelen stängs om den visade raden.
- **Radera i panelen står kvar** och är något annat: den tar bort personen ur våra system, med allt från samma adress
  (vägen när någon ber oss radera allt). Familjer och Studiehjälpare har ingen papperskorg; där är Radera vägen.
- **Flytta**: Leos "flytta folk vart jag vill" är redan knapparna Ta in familjen och Flytta till familjen på en
  anmälan, och stegen på en ansökan (Till intervju, Ångra intervju, Till utbildning, Utbildning hållen, Avböj, Ta
  tillbaka nejet). Utbildning tillbaka till Intervju och Konto skapat tillbaka finns inte (`ansokan_steg_vakt`).
- Provat i Chromium mot PostgREST och en lokal databas (ett riktat prov, inte incheckat): 29 av 29, med rutans text i
  alla fall, CV:t före raden, Avbryt som inte gör något, en admin med behörigheten leads utan knappen, och en
  telefon i mörkt läge. `prova-adminvyn.js` går igenom med knapparna på raderna.

## Fas 25 i vyerna och på sajten (2026-10-27)

Leo skrev en lång lista samma morgon och bad oss merga själva i slutet. Det här står i
vyerna och på de öppna sidorna; NexLäx del står i `minne/nexlax.md` (Fas 25).

**Betalning & planer är en sektion.** Leo: "Betalning och erbjudanden ska struktureras om, de är
de fulaste sidorna på studievyn ... Erbjudanden kan du integrera med betalning." Sektionen
Erbjudanden och dess menypost är borta; `section[data-sek="betalning"]` har överst Att betala och
Betalt, betalsätten (kort, Apple Pay, Google Pay, Klarna; kassan sköts av Stripe), listan Att betala
med Betala nu, Er timbank och sist planerna (`#bet-planer`), där korten är omgjorda och planen med
lyftet bär "Vårt förslag" (aldrig "populärast": det kan vi inte visa). Ingen rad med "ni sparar"
på korten (regeln 2026-10-12 står kvar). `#erbjudanden`, `#erbjudanden/...` och `#timbank` finns i
gamla mejl och länkar och leder hit (`ALIAS` i `nextrum-studie-vy.js`: `betalning` och `planer`
eller `timbank`), och `S.landa` lägger planerna eller timbanken överst också när innehållet
laddar in efter hoppet; ett hjul, en svepning eller en tangent släpper landningen.
Betalningsmeningen står ordagrant i sektionens ingress (kolla-betalningsvillkor.py räknar den).

**Datumrutan bär passets läge.** Leo: "Lektioner som ej är betalda ska vara röda vid sidan där de
exempelvis står tor 29 okt ... betalda ... gröna och önskade tider gula, ljusa toner ... önskad tid
till studiehjälparen och en tid som studiehjälper eller barnet som önskat måste gå att särkilja".
`dagTon()` ger datumrutan en klass (`dag-rod`, `dag-gron`, `dag-gul`, `dag-forslag`) i
`NXKontakt.passRad` (`o.dag`), med tokens `--dag-*` i cinemas `:root` och båda mörka blocken.
Röd: bekräftat och ska betalas med pengar. Grön: betalt, eller betalt med timmarna. Gul: en tid som
väntar på svar. Ett förslag från studiehjälparen eller barnet har en prick på rutan
(`.pass-nar-bubbla`) och märket "Sara föreslår" (`förslagsMärke`), familjens eget "Ni önskade";
ordet Önskad står inte längre ensamt. Barnets förslag står med i passlistan (`passLista` tar
`extra` och `extraRad`) och under Översikt.
Alla rutor har samma form och en enda kant; bara färgen skiljer (Leo samma kväll: den gula "har extra
streck inuti och de ser inte snyggt ut"). Förslaget hade en andra ring innanför kanten, som är borta;
pricken och märket skiljer det från familjens egna.

**Studievyn på hemskärmen** (`nextrum-hemskarm.js`, `NXHemskarm`). Leo skickade en skärminspelning
av hur det görs i Safari (tre punkter, Dela, Lägg till på hemskärmen, Öppna som webbapp) och bad om
en liten ruta med rörelse som slutar komma när man trycker på krysset, och samma guide under Profil
& inställningar, i studievyn och studiehjälparvyn. Telefonen är ritad i HTML och CSS, aldrig
inspelningen (den visade Leos telefon): stegen för iPhone och Android, en slinga som bara går medan
den syns. Rutan kommer på en telefon efter sex sekunder, väntar tills ingen annan ruta står öppen
(introduktionen, villkoren, notiserna), visas aldrig när vyn redan öppnats som app
(`display-mode: standalone`), och krysset sparas i webbläsaren (`nx.hemskarm`, lagring.html på båda
språken): installationen hör till enheten, inte kontot. Manifesten `studievy.webmanifest` och
`studiehjalparvy.webmanifest` (start på `/foralder` och `/larare`, ikonerna ur `bilder/`), och
modulvakten prövar `NXHemskarm.profil`.

**Introduktionen med rörelse** (`nextrum-introduktion.js`). Leo: "tänk dig en introduktion som
använder motion graphic för att leda kunden genom studievyn". Först en karta: märket och vyns delar
med menyns egna ikoner, som flyger in och går att trycka på. Sedan en del i taget: skärmdumpen
zoomar sakta mot det viktigaste (`ring` i `STEG`, procent av bilden), en ring tänds och ett tryck
syns. Sist, på en telefon som inte redan har vyn som app, telefonen ur NXHemskarm. Ett band överst
med ett streck per steg, och steget glider in från det håll man går. Rutan har fast höjd, så Nästa
står still (`prova-introduktion.js`: 85 av 85). Bekräfta rapport-bilden är borta och
Betalning & planer har en egen (`bygg-introbilder.js` tog om alla bilderna 2026-10-27, så
datumrutans färger syns i dem). Ändras en del i vyn: ta om bilderna och läs `ring` igen.

**Rundturen i den riktiga vyn** (samma kväll, Fas 25.3, `nextrum-introduktion.js`). Leo: "introduktionen
du gjorde på studievyerna var kassa, de jag ville var att de live skulle gå igenom en introduktion genom
vyn i systemet snyggt ... lite då och då ploppar de upp små rutor med två meningars beskrivningar, och att
man går vidare genom att bara trycka var som helst på skärmen". Skärmdumparna, kartan, zoomen och
`bygg-introbilder.js` är borta. Nu:
- Den körs när vyn är hämtad och står framme, före notisrutan (`NXStudie.introduktion` ropas sist i
  `start` i båda vyerna), och hemskärmsrutan väntar på den (`.nx-intro` står kvar på roten). En
  studiehjälpare som inte är godkänd har ingen vy: `valkommen` står kvar på `'intro'`, och rundturen kommer
  när profilen är godkänd.
- En välkomstruta mitt på, sedan en del i taget i menyns ordning, och sist "Nu är ni igång" med var man
  loggar in nästa gång (och, före matchningen, vad som öppnas då). Varje del byter sektion genom att trycka
  på menyns post (så gör sidomenyn allt den gör vid ett byte), lyfter menyn över hinnan med en pulserande
  ring runt posten (`.nt-lyft`, `.nt-pek`, utan tryck), och rullar sektionens början under sidhuvudet.
- Hålet (`.nt-hal`, vars skugga är hinnan och aldrig animeras) ramar in det första som syns i sektionen och
  det under, men slutar där rutan får plats under: rutan ritas dold först och mäts (`förbered`). I NexLäx är
  rubriken dold, så där är det kortet.
- Rutan har två meningar, "N av M" och prickar, och en pil mot hålet. Ett tryck var som helst går vidare
  (`.nt-yta` tar trycket, så inget i vyn under trycks), och Enter, mellanslag och pilarna gör detsamma.
  Första gången går den inte att stänga; igen från Profil har den Stäng och Escape, och slutar där den
  började. Sidan rullar inte under rundturen.
- `verktyg/prova-introduktion.js` (101 av 101): ordningen, att varje del byter till sin sektion, att hålet och
  rutan står på skärmen och aldrig över varandra, två meningar per del, att tryck mitt på skärmen inte
  skickar något, dator, telefon i ljust och mörkt och en liten telefon (360 × 640).

**Inga hopp vid tryck.** Leo: "överallt på vyerna när man trycker på knappar ska inget hoppa konstigt
allt ska vara smooth". Mätt i förhandsvisningen, på en telefon och en dator i båda vyerna: varje knapp,
flik och chip som inte gör något oåterkalleligt trycktes, och det tryckta elementet, sidans rullning
och layoutskiftet mättes. Inget tryckt element flyttade sig; det enda som rullade var Granska, som
med flit leder till bokningsrutan. Spelaren i NexLäx stod också still (frågan, alternativen och
knappen). Tre kort lyfte sig 1 px vid hovring (`.vy-roll`, `.vy-tid`, `.ev-kort`), vilket på en
telefon fastnar efter trycket; de har bara kantfärgen nu, och bara med mus. Genomgången av ett
försök kraschade i förhandsvisningen, som saknar rättningen; den säger nu samma sak som vid ett fel.

**De öppna sidorna.**
- NexLäx etikett på startsidan och För elever och föräldrar står utan strecket och i NexLäx färger
  (blå till lila, `.nlx-huvud .nx-et`).
- `#bli` har färre streck av lera: fotot utan ram, punkterna utan linjer och ringar, och ansökans
  steg utan kant. Linjen i överkanten och stegens siffror står kvar; Bli studiehjälpare-sidan behåller sina.
- **Trustpilot** under brevet i `#rost`: betyget, antalet och Skriv ett omdöme, och omdömena på ett
  band som rullar när de finns. Inte Trustpilots ruta: den är skript och ram från en annan domän, och de
  öppna sidorna laddar inget sådant och sätter inga cookies utan ja. Siffrorna och omdömena står i
  `omdomen.json` och skrivs av från Trustpilot för hand (`nextrum-socialt.js` ritar dem); alla
  omdömen står med, de senaste först, och texten under bandet säger det. Adressen
  `se.trustpilot.com/review/nextrum.se` är antagen, inte kontrollerad (nätet nådde inte Trustpilot).
- **Följ oss på Instagram** vid bildväggen: ett kort som poppar fram när väggen syns (i det övre högra
  hörnet från 1240 px, i flödet under), med ett av våra egna foton, inte ett ur flödet: en bild ur
  flödet läggs i `bilder/` och byts i markupen. Krysset gäller sidvisningen; inget sparas.
- **TikTok** stod redan i footern på varje sida (`@nextrum.ab`) när Leo skrev att den inte var länkad;
  den är inte ändrad, och handtaget är inte kontrollerat.
- **Vår idé**: priset är Just nus blad (de två priserna ur `erbjudanden_pris`, aldrig i HTML, och
  det som ingår), och urvalet har tre scener som spelas i tur när raden syns (`.sid-urval`,
  `nextrum-sidor.css` avsnitt 5c).
- **Så fungerar Nextrum**: bokningen är reglerna i tre rader och ett pass som bokas, betalas och
  flyttas med datumrutans färger (`bokscen()` i `nextrum-start.js`, avsnitt 5d). Regeln om 12 timmar
  och hälften står ordagrant.
- **Priser**: Varför priset ser ut så här är borttagen. Den sa att hjälpen "ofta" blir mer begriplig,
  vilket sidan inte kan visa, och "unga hjälper unga" står redan på Vår idé.

## Betala alla, egna upplägg och återbetalningarna i vyerna (2026-10-27)

Leo samma dag: "man ska kunna betala flera saker under samma kassa ... antingen alla eller pass för
pass", "bygg en återbetalningsfunktion för oss i admin" och "gör en funktion att admin kan skicka
egna upplägg att köpa". I drift sedan kvällen 2026-10-27 (`DEPLOY-BETALNING.md` 9.28); vyerna tål
att migrationerna saknas, och Vercel lade ut dem en halvtimme före migrationerna.

**Betala alla** står överst i listan Att betala under Betalning & planer (`#bet-alla`,
`ritaBetalaAlla`) när minst två pass ska betalas med pengar: antalet, summan och den orange
knappen Betala nu, och raden "En kassa, med en rad per pass". Med i den är bara pass vars rad
själv säger Betala nu (`radensVal(b) === 'betala'`): ett pass som går att betala med timmarna står
utanför, för en familj med timmar ska inte betala dem med kort av misstag, och kortet säger då
att det som inte är med betalas för sig. Högst 20 pass (`ALLA_MAX`, som databasen). Köpvillkorens
ruta listar passen med pris och säger att syskontillägget inte ingår. Pass för pass fungerar som
förut, i listan och på passet.

**Ett eget upplägg** står överst i Betalning & planer, under summan att betala (`#erb-upplagg`), och
först på Översikt (`#ov-upplagg`), sedan 2026-10-29 (Leo: "gör det egna upplägget lite synligare
... det blandas med massa annat"; förut bland planerna, under timbanken). `ritaUpplagg` ritar samma
kort på båda ställena, ett per upplägg som väntar: en ikon, "Ett upplägg bara till er", namnet
stort, "N timmar för X kr", timpriset (med "med er rabatt" när familjen har en), att det gäller i
30 dagar från köpet som en plan, sista dagen att köpa det som ett märke, och Köp upplägget, som går
till samma kassa som en plan. Utan studiehjälpare (`S.väntar`) eller
med erbjudandena av är Köp släckt. Ett upplägg som väntar står också bland notiserna. Leo samma
eftermiddag: "rabattkod gäller också för upplägg. Samma sak som vanliga planer bara annat antal
timmar". **Kodrutan** (Kod till en plan) prövar koden också på uppläggen som väntar
(`kod_pa_upplagget`, i `provaErbKod`), och kortet visar då priset utan koden överstruket, priset med
koden och "med koden X"; Köp skickar koden med (`upplaggetsPris` säger om den gäller upplägget).
Köp till timmar tar ett upplägg som en plan att köpa till (`planFörExtra`). Ett köpt upplägg står
inte kvar: listan läser bara de som går att köpa.

**I adminvyn** har familjens panel blocket Egna upplägg (`dpUpplagg`, bara superadmin):
uppläggen med läget (Väntar på familjen, Köpt, Tillbakadraget, Gick ut), Skriv i Gmail och Dra
tillbaka på ett som väntar, och formuläret Skicka ett upplägg (timmar 1–40, ett namn, dagar att köpa
det). Inget pris att välja: timpriset är planernas, som databasen sätter, och rutan före Skicka
räknar det med `PLANPRIS_KR`. Familjen får ett mejl om upplägget av sig själv (notistypen
`eget_upplagg`, valet Egna upplägg under Profil → Notiser i studievyn); Skriv i Gmail står kvar för
ett eget ord.
Betalningar har fliken **Återbetalningar** (`#ab-lista`): en rad per återbetalning i Stripe, var
den än gjordes, med vad, hur mycket, vem av oss och varför, och summorna Återbetalat, I adminvyn
och Utanför adminvyn (en återbetalning i Stripes dashboard, att stämma av). Under Liggaren betalas
ett pass i en kassa för flera pass tillbaka på sin rad, och övertiden och en betalning utan rad
har egna knappar (förut bara i Stripes dashboard); beloppet och anledningen frågas i samma ruta
(`beloppFråga`). `prova-kassan.js` prövar Betala alla, uppläggen och återbetalningarna.

## Effekter på de öppna sidorna (2026-10-27)
Fyra effekter i samma anda som React Bits (SplitText, SpotlightCard, Aurora, ShinyText), omskrivna i vanlig JS och CSS
eftersom sajten saknar React och byggsteg: `NXFin.ordRubriker` (h2 i main kommer in ord för ord med oskärpa; hoppar över
rubriker med `data-erb`/`data-stat`, som får sin text av data), `glans` (ljuspunkt under muspekaren på korten, ett eget
barn `.nx-glans`, bara `full` och mus), `norrsken` (tre färgfläckar på `.nx-final-cinema` och `.bli-svart`, går bara medan
sektionen syns) och `fotOrd` (ordet i foten fylls på en gång), plus glans över `.btn-primary` vid hovring (bara CSS). Stilen
står sist i `nextrum-cinema.css` (EFFEKTER). Ingen HTML ändrades, så `/en/` följer med; `still` delar ingenting och lägger
inget, `lite` får inga musglans och ingen oskärpa. Nödbromsen visar ord och fotord som aldrig avslöjats. Ett nytt kort
får glans genom att klassen läggs i listan i `allt()`.
**Mer rörelse på startsidan** (samma dag, Leo: "ta detta ... och mega ... merga sen allt"): `ritaIkoner` (linjeikonerna på
Hur hjälper vi och Rätt match/Allt på ett ställe ritas upp; bara former med `fill: none`), `etiketter` (strecket framför
`.nx-et` växer), understrykningen under det orange ordet i rubrikerna (CSS), **ämnesbandet** (`.nx-amnesband`, ny sektion före
Möt några av våra studiehjälpare, i `index.html` och `en/index.html`; `amnesband()` kopierar raden tills den är två fönster
bred och bandet går långsamt av sig självt som en CSS-animation (en radbredd per varv, pausad utanför bild; scrollstyrt laggade på iPhone); sedan 2026-10-27 alla tolv NexLäx-ämnen i var sin färg, mindre text och inga linjer, Leo) (scrollraden överst togs bort samma kväll, Leo: "ta bort detta") **Klassen `nx-ord` är
startsidans egen** (`delaOrd` i `nextrum-start.js`, rubriker med `data-ordfyll`); mina ordvisa rubriker heter `nx-ov` och
hoppar över allt som redan delats. Ämnesbandets ämnen är `NX.AMNEN` utan grupperna plus `NEXLAX_AMNEN`, och ändras med dem.
