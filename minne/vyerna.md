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

Hero var orörd med flit fram till 2026-10-06; sedan dess är bara filmen
och rubriken det (se Startsidan talar till föräldern nedan).

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
mörka block möts. Footern är därför `--nt-2` på alla sidor. I mörkt
läge är `--nt-2` samma som `--nt`, och där är allt som förut. **Hero behåller den gamla tonen**
(`--nt-film`), för hero är orörd med flit.

Ytorna går kant i kant. En första version lade Bli studiehjälpare och
Nästa steg som rundade kort på papperet som växte in med `scale`; Leo
ville inte ha papperet runt dem. Nu står ytan still och innehållet
glider upp med klassen `.nx-framme` — aldrig `.nx-in`, för
`.nx-in .nx-rad-i` i cinema tänder rubrikens rader på en gång. Stegen i
ansökan har samma 1–4-beteende som hållpunkterna; `hållpunkter()` tar
båda listorna.

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
  pinnade scen. Fotona står i markupen, inte i skriptet: registret har
  bara svensk alt-text, och startsidans skript bygger sina foton därur,
  så den engelska startsidan har svensk alt-text i den scenen (kvar,
  inte rörd här). `stegFoton` rör bara en scen som redan har foton, och
  startsidans ruta är tom när den körs.
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

- **Heron.** Filmen och rubriken "Av unga, för unga." är orörda. Etiketten
  säger "Läxhjälp i Stockholm" i stället för namnet (sökordet först på
  sidan), ingressen börjar med läxhjälpen, och under knapparna står pris,
  första timmen, svar inom 24 timmar och ingen bindningstid. Priset är en
  `data-stat="pris-inline"`, så startsidan anropar nu `NX.initPris()`.
  Raden är `.nx-hero-fakta`: `li` är ett block och pricken en
  inline-block, för som flex fick priset och resten av meningen var sin
  cell med glapp emellan. Etiketten är mindre och `nowrap`: "Läxhjälp i
  Stockholm" är tre gånger så långt som "Nextrum" och bröts på en telefon.
- **Ämnesraden** ersätter det ensamma kortet under manifestet: matte,
  svenska, engelska, NO, online och priser som `.nx-omr-kort`, och
  stadiesidorna som länkar i ingressen. Startsidan länkade förut till
  ämnessidorna bara från sidfoten. `.nx-omr-kort > b` och `> span` är
  barnselektorer sedan dess: Priser-kortets rad bär en egen span för
  priset, och med `span{display:block}` hamnade den på en egen rad.
- **Bort från startsidan:** de fyra numrerade hållpunkterna (de upprepade
  heron och bandet, och "Resultat som märks" lovade det FAQ:n säger att vi
  inte lovar) och "Vi bygger nästa generation tillsammans." Länken "Till
  föräldravyn" ledde en ny besökare till en låst vy; den är "Se priserna".
  `.nx-holdpunkter` och `.nx-statement` används kvar på menysidorna.
- **Exempelkorten** står under "Så kan din studiehjälpare se ut." och
  ingressen säger att korten med märket Exempel är exempel. Rubriken sa
  "Möt några av våra studiehjälpare" medan databasen hade noll publika.
  Ett fel i hämtningen visar inte längre `error.message` för en anonym
  besökare (rå servertext bara i de inloggade vyerna).
- **Prova NexLäx** står efter studievyn: se `minne/nexlax.md`.

Startsidan är ungefär 700 px kortare på dator, trots NexLäx-rutan.

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
   inte AA på en ren orange. Använd den inte som lägesfärg.
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
  (`NXArbete.hero`) och sidomenyn (`NXStudie.sidomeny`) med fyra delar,
  Översikt, NexLäx, Meddelanden och Profil (se "Hälsningen, en bild per
  veckodag" nedan och `minne/barnkonton-och-admin.md`). Förut en spalt utan
  meny och utan bild.
- Föräldrarnas ruta Barnens inloggning heter `bi-*` (`#bi-ruta`,
  `data-bi-*`), för `bk-*` och `#bk-msg` är bokningens och stod redan i
  samma sida.
- En admin med behörigheter får sina sektioner genom `o.tillåten` i
  `NXStudie.sidomeny` (de andra döljs och går inte att nå med en adress),
  flikarna hen inte har tas bort ur DOM:en, och en rubrik utan synlig post
  göms (`städaMenyn`). Knapparna i en synlig sektion är fortfarande
  superadminens; databasen säger nej. Se `minne/barnkonton-och-admin.md`.

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
  godkännas, säger sista bilden det (`VÄNTAR`), för Fortsätt leder då till
  väntläget och inte till bokningen.
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
