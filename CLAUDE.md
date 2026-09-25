# Nextrum — projektminne

Läxhjälpsförmedling i Stockholm. Publik sajt på två språk plus tre
inloggade vyer, byggd som statiska filer mot Supabase och driftsatt på
Vercel (`nextrum.se`).

Den här filen är minnet: vad som gäller, varför det gäller, och vilka
fel som redan har begåtts en gång. Driftinstruktionerna ligger kvar i
`START-HÄR.md` och `DEPLOY-*.md` — de upprepas inte här.

`MINNESPOSTER.md` är samma kunskap kokad till sju korta poster för
Claude-projektets minne. Ändras en regel här som också står där: ändra
båda i samma commit.

`.vercelignore` utesluter `*.md`, så ingen av dem serveras från sajten.

---

## 1. Affären, i ordning

Det här är inte en katalog man bläddrar i. Nextrum matchar.

1. Familjen skickar **intresseanmälan** → rad i `leads`
2. Ni ringer och väljer studiehjälpare
3. Familjen skapar konto på `foralder.html`
4. `admin.html` → **Familjer** → välj hjälpare i rullgardinen. Sätter
   `matched_tutor_id` och `match_status` **samtidigt** — förr var det
   två kolumner i Table Editor och satte man bara den ena såg familjen
   en låst vy utan att förstå varför
5. Föräldern lägger in barnet, hjälparen skriver studieplanen

Föräldravyn låses upp först efter steg 4. Innan dess: väntläge, inte
trasig sida.

**Ett pass bokas i två steg (Fas 15.1).** Familjen trycker på en dag i
en tom kalender, väljer ämne, tid och antal barn och FÖRESLÅR tiden.
Studiehjälparen accepterar eller föreslår en annan under Föreslagna
tider, och först då står passet under Mina lektioner. Det finns inga
veckotider längre: `tutor_availability` läses inte av något, och
triggern som bekräftade bokningar inom dem är borttagen. En avbokning
kräver ett skäl (fast kod), och motparten får det i mejlet (Fas 15.2).

**Förslaget bär var man ses (Fas 15.6).** Online, eller På plats med en
adress i `bookings.location`, och en valfri rad till studiehjälparen i
`note`. Fas 15.1 hade tagit bort frågan, och ett förslag hade då ingen
plats alls. Förval ur förra passet och barnets `format_onskemal`.
Platsen ändras inte när tiden flyttas — `skydda_bokningsfalt` släpper
bara igenom tid och status på ett befintligt pass.

**Studiehjälparens schema öppnar i Kommande** (2026-09-24): de närmaste
passen per dag, med klockslag och ämne, elevens namn och platsen på var
sin rad. Studievyn och adminvyn öppnar fortfarande i månaden — hos
familjen står schemat direkt under passlistan, och Kommande hade bara
upprepat den.

**Varje pass har en egen sida, `#pass/<id>`, i båda vyerna.** Ritas av
`NXStudie.passSida`; vyn bestämmer innehållet (familjen ser pris och
betalning, studiehjälparen eleven och familjen). Raderna i listorna
leder dit och bär bara det som är ens eget drag just nu — svara,
betala, skriva rapporten. Föreslå ny tid och avboka ligger på sidan.

En studiehjälpare syns publikt först när admin satt läget till
**Godkänd**.

### Ordlistan (använd den, i kod och i text)

| Ord | Betyder |
|---|---|
| studiehjälpare | den som håller passet. Aldrig "lärare" utåt — `larare.html` heter så av historiska skäl |
| pass | ett bokat tillfälle (`bookings`). Hela timmar, 1–3 |
| rapport | `lesson_reports`. **Passet är genomfört först när rapporten finns** |
| underlag | vad studiehjälparen ska få (`payouts`) |
| betalning | vad familjen betalat för ett pass: med kort, per pass, före passet (`bookings.betalning_status`, `betalt_ore`) |
| faktura | historik sedan Fas 14.2 (`invoices`). Familjen får ingen ny |
| tjänst | rad i `tjanster`. `aktiv` avgör vad som syns, inget annat |

### Siffror som måste stämma överallt

- **379 kr/tim** (`nextrum-config.js: PRIS_PER_TIMME`)
- **69 kr/tim** tillägg för fler än ett barn — **fast, inte per barn**,
  tak tre barn (`tjanster.extra_personer_max`). Tre barn kostar 448, inte 517
- **Kort per pass, före passet** (Fas 14.2). Familjen betalar varje
  pass med kort när studiehjälparen bekräftat tiden, senast innan
  passet börjar, och **ett pass som inte är betalt hålls inte**. Ingen
  månadsfaktura och inget betalningsvillkor i dagar. Meningen står på
  sexton ställen i tio filer, på båda språken, och sedan Fas 14.3 i
  familjens mejl.
  `verktyg/kolla-betalningsvillkor.py` räknar dem, letar efter det gamla
  löftet ("efterskott", "10 dagars …") i allt som serveras, och körs i
  CI. **En betalning som tas på ett annat sätt än villkoren lovar är en
  tvist, inte ett skrivfel.**
- **Den 25:e** får studiehjälparen betalt, i en klump för månadens
  rapporterade pass (`payouts`). Det är en lön, inte en andel av varje
  kortbetalning.
- Belopp lagras i **ören** överallt. Kronor blir det först vid visning
  (`NXBetalning.kronor`). Enda stället ett avrundningsfel kan smyga in
  är omvandlingen — gör den en gång, på ett ställe.

---

## 2. Stacken

**Inget byggsteg. Ingen pakethanterare. Inget ramverk.** Filerna i
repotroten är filerna som serveras. `supabase-js` ligger som en
vendorad fil i `bibliotek/`.

- **Frontend:** vanilla ES5/ES6 i `<script src>`, delade moduler som
  IIFE:er på `window` (`NX`, `NXStudie`, `NXArbete`, `NXMedia`,
  `NXKontakt`, `NXBetalning`, `NXTjanster`, `NXAgent`, `NXMotion`)
- **Backend:** Supabase (Postgres + RLS + Auth + Storage) och Deno
  edge functions i `supabase/functions/`
- **Hosting:** Vercel, `cleanUrls: true` (alltså `/priser`, inte
  `/priser.html`)
- **Mejl:** Resend
- **Modeller:** Anthropic, bara från edge functions — aldrig från
  webbläsaren

Lokal server: `python3 .claude/serve.py 8951`. Den härmar `cleanUrls`
med flit; `http.server` rakt av svarar 404 på varenda länk.

---

## 3. Filkartan

| Fil | Roll |
|---|---|
| `nextrum-config.js` | **Enda filen som ska ändras vid uppsättning.** URL, anon-nyckel, pris, e-post, utbildningslänk |
| `nextrum-app.js` | `NX` — delad grund: supa-klient, i18n, datum, fel, header, inloggning |
| `nextrum-fel.js` | Felrapportering till `klientfel`. Laddas **före** `nextrum-app.js`, annars missas uppstartsfelen |
| `nextrum-modulvakt.js` | Fångar "en modul laddade inte" innan vyn dör tyst på "Laddar din vy". Laddas i **alla tre** vyerna sedan Fas 14.0 — adminvyn saknade den, fast den har 26 skript mot de andras 17. Prövar en FUNKTION per fil, inte bara att globalen finns: en gammal fil i cachen definierar sin global och ser frisk ut. Modulerna nås som IDENTIFIERARE, aldrig som `window[...]` — hälften deklareras `const NX… = …` på toppnivå och hamnar då inte på window |
| `nextrum-images.js` | **Enda stället bildvägar står skrivna.** Aldrig i HTML |
| `nextrum-motion.js` | `NXImg` (bildmarkup), `NXMotion` (scrollmotor), `NXStory`. Tre lägen: full / lite / still |
| `nextrum-studie.js`, `-arbetsyta.js`, `-kontakt.js`, `-betalning.js`, `-media.js`, `-tjanster.js` | Delat mellan vyerna |
| `nextrum-studie-vy.js` | Bara `foralder.html` |
| `nextrum-larare-vy.js` | Bara `larare.html` (2 800 rader) |
| `nextrum-admin.js` | Adminvyns **skal**: inloggning, sidomeny, sök, notiser, bevakning och `start()` |
| `nextrum-admin-karna.js` | `NXAdmin`: tillståndet `S`, hjälparna och hämtningarna. **Laddas först** |
| `nextrum-admin-*.js` | Ett område var: detalj, oversikt, kunder, rekrytering, bibliotek, kommunikation, drift, ekonomi, tjanster, system, automationer, ai. Anropar varandra via `NXAdmin.rita` |
| `nextrum-admin-agenter.js` | Agentfliken. Delar inget med resten av adminvyn |
| `nextrum-maskot.js` + `-maskot-svar.js` | Hjälprutan. **Ingen språkmodell** |
| `nextrum.css` → `-home.css` → `-cinema.css` → `-vy.css` → `-arbetsyta.css` → `-agent.css` | Stillagren, i laddningsordning. **Cinema är sanningen** — den skriver över nästan allt de två första sätter. `-vy`, `-agent` och `-typsnitt` innehåller noll hexkoder och konsumerar bara. Papperet är `#F2EDE3` på hela sajten sedan 2026-09-25 (var `#EFE6D6`); det står i cinemas `:root` och i de ljusa formulär-öarna i mörkt läge, och `theme-color` på varje sida följer med |
| `nextrum-start.css` + `nextrum-start.js` | **Bara startsidan** (sv och en), efter cinema respektive före sidans eget skript. Rörelsen efter hero: ordfyllnaden, hållpunkterna 1–4, korten som stiger upp, det rullande bandet, bildväggen och studievyn som visar sig själv (en rundtur, men den går inte att klicka i). Skriptet startar av sig självt och skriver ingen text — allt man läser står i markupen, på båda språken |
| `nextrum-admin-palett.css` | Bara `admin.html`, laddas **sist**. Sedan 2026-09-24 **ingen egen palett**: adminvyn ärver jordpaletten som de två andra vyerna. Filen bär bara `--fel`, `--ln-kontroll`, agentflikens `--acc-lugn` och felsemantiken |
| `verktyg/` | Kontroller och generatorer. Körs i CI |
| `supabase/migrations/` | Databasen. `arkiv/` är historik |

Sju områdessidor (`laxhjalp-*.html`) genereras. `/en/` är elva
översatta sidor.

### Startsidan efter hero (2026-09-25)

Hero är orörd med flit. Allt annat på startsidan bor i
`nextrum-start.css` och `nextrum-start.js`, och startlägena gömmer
ingenting utan `html.nx-sr` — klassen sätts av skriptet, så en fil som
inte laddar lämnar sidan i slutläget.

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
   sidan.** `NX.initDrag()` visar kortet man tryckt på. I bandet, som
   klipps och förskjuts med transform, räknade Chrome fram ett mål
   400 px bort och rullade hela sidan dit. Anropet hoppas över i
   `.nx-band.pa`. Bandet är `overflow:clip`, inte `hidden`, av samma
   skäl: `hidden` gör det till något som går att scrolla. Kanterna tonas
   med två stilla gradienter, inte `mask-image`: en mask över något som
   rör sig ritas om varje bildruta i Safari.
4. **Bandets kopior måste finnas när `NX.initDrag()` körs.** Därför
   laddas `nextrum-start.js` före sidans eget skript. Kopiorna är
   `aria-hidden`, utanför tabbordningen och har egna id:n; en
   skärmläsare hör sex kort, inte arton.

Studievyns markup byggs för båda språken ur samma mall, så att
taggsekvensen är identisk. `jamfor-sprak.py` rapporterar bara den
FÖRSTA strukturskillnaden, och på startsidan är den språkväljaren —
en skillnad längre ner syns alltså inte i verktyget. Jämför
taggsekvenserna med `difflib` när du ändrar i sektionen.

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
   stängs ovanför det man tittar på hålls med `NXStudie.håll(ankare, fn)`.
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

Provbänken (`skanna.js` i en scratchpad, inte i repot) trycker på varje
knapp i varje sektion och rapporterar hopp över 40 px. Admin var ren.
Den mäter `scrollY`, inte vad som står stilla på skärmen, så fällan i
punkt 4 syntes inte i den: sidan scrollade inte, innehållet flyttade
sig. Mät ett element före och efter trycket (`getBoundingClientRect`).

---

## 4. Språk

**Koden är svensk.** Identifierare, kommentarer, commit-meddelanden,
filnamn, tabellkolumner. Skriv inte engelsk kod i den här kodbasen.

**Sidorna finns på två språk.** `/en/` är genererad ur de svenska
sidorna genom att textnoder byts ut en och en. Taggsekvensen är därför
identisk mellan språkparen, och det är precis vad
`verktyg/jamfor-sprak.py` utnyttjar.

Fyra saker att veta, alla dyrköpta:

1. **Generatorn översätter aldrig `<script>`.** Allt som skrivs till
   användaren från JavaScript måste därför ligga som ett **par** i
   `ORD` i modulen (`nextrum-app.js` `NX.t()`, `nextrum-tjanster.js`
   `ord()`), med språket läst ur `<html lang>` vid körning. En etikett
   skriven i sidans eget skript blir svensk på den engelska sidan och
   **ingen strukturkontroll ser det**.
2. **Bara det som visas.** Strängar som skrivs till databasen
   ("Telefon: ", "Samtycke till lagring: ja") förblir svenska — de
   läses av oss.
3. **Generatorn finns inte i repot.** `/en/`-sidorna är incheckade
   artefakter. Ändras en svensk sida måste engelskan följa med för
   hand, och `jamfor-sprak.py` är det som upptäcker att den inte gjort
   det.
4. **Baslinjen.** `verktyg/jamfor-sprak-baslinje.txt` innehåller de
   avvikelser som är avsiktliga (språkväljaren `<b>SV</b>` vs `<a>`,
   personnamn som inte översätts). CI diffar mot den. **Allt nytt är ett
   fel** — uppdatera baslinjen bara när avvikelsen är avsiktlig.

---

## 5. Databasen

**Sanningen om vad som är kört står i databasen, inte i filnamnen:**

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

- Ny SQL skrivs som `supabase/migrations/<version>_<namn>.sql`, där
  versionen är exakt den `apply_migration` registrerade.
  `verktyg/kolla-migrationer.py` vaktar namnregeln i CI.
- **Klistra aldrig in SQL i SQL Editor utan att den också blir en fil.**
  Det var så tre nummer (v13, v16, v17) kom att tas två gånger.
- `supabase/migrations/arkiv/` är de gamla `schema-v*.sql`. **Ändra dem
  inte** — en rättelse är en ny migration, inte en omskriven historia.
  `arkiv/README.md` mappar varje fil mot sin version i driften.
- `arkiv/schema-v22.sql` kördes **aldrig**. Kör den inte. Ersatt av v25.
- `arkiv/schema.sql` **rensar tabellerna**. Bara i tom miljö.

Projekt-ref i drift: `ddkfiuvcppalutfulvbi`.

Tabeller: `profiles`, `students`, `tutor_profiles`, `tutor_availability`,
`tutor_blocked`, `tutor_reviews`, `bookings`, `lesson_reports`,
`homework`, `materials`, `study_plans`, `progress_items`,
`student_notes`, `messages`, `leads`, `applications`,
`contact_messages`, `invoices`, `invoice_lines`, `payouts`,
`payout_lines`, `tjanster`, `prissattning`, `rabattkoder`,
`integrationer`, `fortnox_token`, `notis_konfig`, `klientfel`,
`agent_korningar`, `agent_steg`, `admin_noteringar`, `foretagsfakta`,
och sedan Fas 5–7: `uppdrag`, `uppgifter`, `audit_logg`, `rut_tak`,
`kund_skatteuppgifter`. Fas 8–9 la till `ai_forslag`, `ai_konfig` och
`handlingar`. Fas 13.2 la till `biblioteksmaterial`. Fas 15.3 la till
`progress_historik` (skrivs bara av en trigger; ingen skrivpolicy).
Fas 14.3 la till `stripe_tvister` (skrivs bara av `stripe-webhook`,
läses bara av admin). Runda 2 la till notisernas sju: `notiser` (i vyn),
`notis_utskick` (kön), `notis_val` (av och på per person, typ och
kanal), `notis_installning`, `notis_drift`, `notis_korningar` och
`notis_fel` — plus `flaggor`, som är strömbrytarna för det som
väntar på ett beslut om affär, juridik eller pengar.

Schemat **`intern`** (Fas 10.3) bär funktioner databasen behöver för
sin egen skull och som inte är ett API. PostgREST exponerar det inte.
Lägg inget där som ett gränssnitt ska anropa.

**Auditloggen (Fas 6) går inte att ändra.** `audit_logg` skrivs av
triggern `logga_andring`, som bara loggar VITLISTADE kolumner — aldrig
namn, adresser, meddelandetexter eller fritext om barn. Update, delete
och truncate är blockerade, också för admin. Lägger du en trigger på en
ny tabell: ta med tillstånd och kopplingar, inte innehåll.

Sedan Fas 9.3 täcker den hela passets liv (skapat, status, närvaro,
avbokning), rapportens födelse, AI-taket, vem som tog hand om ett
kontaktmeddelande, att ett klientfel städats bort och att bolagsfakta
ändrats. `materials` och `admin_noteringar` har MED FLIT ingen trigger:
ett filnamn heter i praktiken "Provräkning Alva v42.pdf".
`kund_skatteuppgifter` har ingen heller — funktionerna skriver redan
sina egna rader, och en trigger hade dubbelloggat.

**Sökningen i loggen går genom `audit_sok()`** (Fas 9.8), som filtrerar
OCH räknar i databasen. Totalen kommer ur `count(*) over ()` på den
filtrerade mängden, alltså före `limit`. Förut hämtades 300 rader och
filtrerades i webbläsaren — det fungerar medan loggen är tom och
slutar fungera tyst vid rad 301. Funktionen är SECURITY INVOKER: den
är ingen väg runt policyn.

**AI-märkningen i loggen läses inte ur `aktor_typ`.** Drift-agenten
talar med databasen genom adminens egen token, så `auth.uid()` ÄR
adminen och `aktor_typ` blir `admin` — det är med flit, för det är så
`skydda_*`-triggrarna fortsätter gälla. En rad märks i stället genom
att den sammanfaller med ett utfört `ai_forslag` på samma objekt:
`godkann_forslag` sätter `utford = now()`, och auditraden får samma
`now()` i samma transaktion.

**En tjänst får inte vara aktiv och oklar** (Fas 10, Fas 14.2).
`skydda_tjansteaktivering()` prövar fyra INVARIANTER vid varje skrivning
på en aktiv rad — inte bara vid påslaget, annars gick det att aktivera
rätt och sedan tömma priset:

1. tjänsten måste gå att boka eller söka till
2. `for_kund` kräver ett pris. Annars tar `stripe-checkout` läxhjälpens
   timpris ur `prissattning` för den och drar det av familjen som om det
   vore tjänstens eget
3. `extra_personer_max > 1` kräver ett tillägg, annars blir det tyst noll
4. `for_kund` och `rut_berattigad` går inte ihop (Fas 14.2). RUT drogs
   bara i månadsfakturan. Kortbetalningen tar hela beloppet, så en
   RUT-tjänst hade tagit fullt pris av en familj som lovats halva, och
   ingen hade begärt resten från Skatteverket. Att PLANERA en RUT-tjänst
   går: invarianten gäller en aktiv rad

**Avstängning släpps alltid igenom.** Den är nödbromsen.

Planen sa "pris, ersättning, krav och bokningstyp". Tre av dem gick
inte att koda: `bokningstyp` och `krav` är NOT NULL med förval och kan
aldrig "saknas", och `ersattning = null` är ett BESLUT som betyder
studiehjälparens egen timpenning — läxhjälp är aktiv med null, så ett
ovillkorligt krav hade låst 379-kronorsraden. De tre hör hemma i
lanseringschecklistan i adminvyn, där en människa läser dem.
**Ändras triggern måste spegeln i `nextrum-admin-tjanster.js` följa
med**, annars kommer felet ut som rå servertext.

**Spärren "ingen betalning, inget pass" är en flagga** (Fas 14.2):
`kortsparr` i `flaggor`, samma mekanism som `notiser_mejl`. Är den på
nekar `skydda_bokningsfalt` `completed` på ett fakturerbart pass vars
`betalning_status` inte är `betald` eller `tvist`. Rapporten gör passet
genomfört i samma skrivning (`rapport_gor_passet_genomfort`), så det
är rapporten som nekas, med ett meddelande som säger varför. Admin går
förbi, som i resten av triggern. Står den av syns ett hållet obetalt
pass i stället som avvikelsen `ej_betalt`, som ersatte `ej_fakturerat`.
`betald_men_avbokad` (Fas 14.2c) är samma sak åt andra hållet: ett
avbokat pass som familjen betalat, med beloppet som inte gått tillbaka.

**Materialbiblioteket är kurerat** (Fas 13.2). `biblioteksmaterial` är
Nextrums delade bank, inte elevens: `materials` gick inte att använda
eftersom `student_id` är NOT NULL, skrivpolicyn kräver
`is_my_student()` och hinken `material` kräver ett elev-uuid först i
sökvägen.

- **`delad` skiljer två sorter i samma tabell** (Fas 13.3).
  `delad = true` är Nextrums BANK: bara admin skriver, alla godkända
  studiehjälpare läser. `delad = false` är studiehjälparens EGET: bara
  ägaren ser och ändrar det. Banken är kurerad med flit — blir den ett
  fritt uppladdningsutrymme är den inte längre ett urval, och då är
  filtret på ämne och årskurs ingenting värt.
- **`delad` går inte att slå på nerifrån.** Uppdateringspolicyn har
  `not delad` i BÅDE using och with check, så en studiehjälpare kan
  ändra sitt eget men aldrig lyfta in det i banken. Admin gör det med
  knappen "Lyft in i banken", och bara åt det hållet: en delad rad som
  lämnades tillbaka hade försvunnit ur listan hos alla som redan gett
  den som läxa.
- **`ar_godkand_studiehjalpare()`** är den första policyn som ställer
  frågan "är den här personen godkänd" i databasen. Före Fas 13.2
  nämnde noll policyer `tutor_profiles` — det var något adminvyn visste
  och databasen inte.
- **`homework.bibliotek_id` PEKAR, den kopierar inte.** Ett övningsblad
  som rättas ska rättas en gång. `on delete set null`: en läxa som
  getts ska inte försvinna för att banken städas.
- **Familjen når materialet sin läxa bygger på, även om raden stängts
  av och även om den är någons egen.** Den policyn frågar inte efter
  `delad`: läxan ÄR kopplingen. En läxa vars material ger tomt svar är
  en läxa som inte går att göra.
- **`materials` når inte familjen längre.** Både studiehjälparvyns
  materialflik (Fas 13.3) och adminvyns detaljpanel skrev dit; fliken
  är ombyggd till biblioteket, panelen står kvar som VÅRT underlag om
  eleven och säger det i klartext. Vägen till familjen går genom
  biblioteket och en läxa, ingen annanstans.
- **Årskursen är enskild och låst** (`ak1`–`ak9`, `gy1`–`gy3`), och
  koden är inte etiketten. `NX.ARSKURSER` i `nextrum-app.js` speglar
  check-villkoret; `NX.AMNEN` är samma lista i alla tre vyerna.
  Fritext hade betytt att "åk7", "Åk 7" och "7" blir tre årskurser, och
  ett filter som tappar två tredjedelar av banken ser ut som ett tomt
  bibliotek.
- `verktyg/rls-test.sql` har nitton BIB-rader, sju av dem om
  delningen. Kör dem efter varje ändring i policyn.

**Uppgifter som maskiner skapar går genom `skapa_uppgift()`** (Fas 7),
som kräver en nyckel och vägrar skapa en till när det redan finns en
öppen med samma nyckel. Adminvyn skriver direkt i `uppgifter` under sin
egen policy. Kontrollerna (`kontroll_saknade_rapporter`,
`kontroll_ekonomiska_avvikelser`, `paminnelse_forfallna_fakturor`,
`uppfoljning_leads_och_ansokningar`) SKAPAR bara uppgifter — ingen av
dem skickar något, och ingen av dem är schemalagd. `kor_kontrollerna()`
kör alla fyra från fliken System → Automationer.

**Analysvyerna (Fas 9.6) bär tre regler.** `analys_leads_per_kalla`,
`analys_konvertering`, `analys_aktiva`, `analys_ekonomi` och
`analys_avbokningar` är alla `security_invoker=true`.

1. **"Genomfört pass" betyder `passunderlag.har_rapport`**, aldrig
   `status='completed'`. Ordlistan säger att passet är genomfört först
   när rapporten finns, och tre av fem completed-pass i driften saknar
   rapport. Räknas de med blir varje siffra om verksamhet, ersättning
   och beläggning för hög.
2. **Varje rad bär `underlag_rader`** — hur många rader ur
   grundtabellen just den raden räknats fram ur, så att talet går att
   stämma av mot en rå fråga.
3. **Luckor redovisas, de fylls inte.** Anmälningar utan `kalla` står
   som okända (inte "direkt"), avbokningar utan `avbokad_at` hamnar på
   en rad med `manad = null` (inte på passets månad), och
   konverteringar utan `leads.kund_id` räknas i `ej_sparbara`. Inget av
   det bakfylldes: en gissad siffra räknas med i medelvärdet utan att
   någon ser att den är gissad.

### Notiserna (Runda 2)

Vägen är alltid densamma, och ingen del av den kan hoppas över:

```
trigger på bookings/messages/lesson_reports
  → intern.notis_skapa()   skriver raden i notiser (syns i vyn)
  → intern.notis_koa()     lägger ett utskick i notis_utskick
  → pg_cron "notis-minut"  varje minut, notis_minut()
  → notis-ko               notis_utskick_ta() → Resend → notis_utskick_klar()
```

Åtta regler bär systemet:

0. **Strömbrytaren är flaggan `notiser_mejl` i `flaggor`, och den är
   inte samma sak som regel 4.** Regel 4 är personens eget val;
   flaggan är hela systemets. Står den av lämnar `notis_utskick_ta()`
   inte ut en enda mejlrad: raden märks **`loggad`**, notisen syns i
   vyn, och ingenting går ut. Kön, schemat och arbetaren fortsätter
   under tiden att se friska ut, för det är de.

   Flaggan stod av från Runda 2 till Fas 13.4 utan att någon fil i
   repot ens nämnde tabellen `flaggor`. Trettonde notisen i rad blev
   `loggad` och systemet såg ut att vara trasigt. **Ett avstängt
   system och ett trasigt system ser likadana ut inifrån** — därför
   finns reglaget nu i produkten, under **System → Notiser**: flaggan
   med sitt `vantar_pa`, sandlådan, provmejlen och köns läge.
   Läsningen är `notis_lage()` (Fas 13.4), som räknar i databasen och
   aldrig lämnar ut adresser, mottagare eller brödtext.

   `loggad` är ett slutläge. De mejl som aldrig gick under
   avstängningen går inte att skicka i efterhand, och ska inte
   heller: en påminnelse om ett pass förra veckan är inte en notis,
   den är förvirring.
1. **Ingen får en notis om sin egen åtgärd.** `intern.notis_skapa()`
   returnerar tyst när mottagaren är `auth.uid()`. Det är därför
   mallarna aldrig säger VEM som gjorde något: när admin ändrar ett
   pass får BÅDA parterna notisen, och "Tove har flyttat passet" hade
   då varit fel för den ena.
2. **Mallarna ser bara `RenData`.** `renData()` i
   `_delad/notiser/typer.ts` plockar ut datum, tid, ämne, förnamn och
   (sedan Fas 15.2) avbokningens skäl som en av sex FASTA KODER.
   Kommer det en nyckel till — `body`, `note`, `location`, ett
   efternamn — följer den inte med, för den läses aldrig. Ingen
   brödtext kan hamna i ett mejl hur mallen än formuleras, och skälet
   skrivs med mallens egna ord (`SKAL_TEXT` i `mallar.ts`), aldrig
   med databasens.
3. **Varje namn går genom `fornamn()`**, som speglar
   `intern.fornamn()`: första ordet, bara bokstäver och bindestreck,
   högst 30 tecken. `full_name` är fritext utan gräns, och ett "namn"
   som ser ut som en adress blir annars en klickbar länk i Gmail, i
   ett mejl från vår egen domän med godkänd DKIM.
4. **Mejl är på som förval, SMS av.** `notis_vill()` faller tillbaka
   på `p_kanal = 'mejl'` när personen inte valt något. Avanmälan
   skriver bara i `notis_val`, aldrig i `profiles`.

   Valen ändras under **Profil → Notiser** i båda vyerna
   (`NXStudie.notisval()`, delad mellan dem). Det är huvudvägen, och
   den enda som kan slå PÅ igen. Länken i mejlets fot är ett
   komplement för mejlprogrammens One-Click och för den som inte vill
   logga in: den stänger av EN sort och kan aldrig slå på något.
   **En saknad rad betyder PÅ** — visar vyn något annat ser en orörd
   inställning avstängd ut medan mejlen fortsätter komma.
5. **`rapport` mejlas aldrig.** Den står i `notis_typer()` men inte i
   `notis_mejlbara()` — den syns bara i vyn. Listorna finns också i
   `typer.ts` för att mallarna ska gå att prova utan databas; **ändras
   den ena ska den andra ändras i samma ändring.**
6. **Avanmälningstokenen har ingen utgångstid, med flit.** En länk i
   ett mejl från i våras ska fortfarande fungera. Byts
   `notis_konfig.avregistreringsnyckel` slutar alla gamla länkar gälla
   på en gång, och inget annat händer. Prefixet `avanmal:v2:` gör att
   en signatur från den gamla varianten aldrig kan läsas som en ny.
7. **Sandlådan är `notis_drift.mejl_sandlada`.** Är den satt går allt
   dit i stället för till mottagaren, och ämnesraden märks. SMS har
   samma sak i `sms_lage`, som står på `prov` och då bara torrkör.
   **Sätt sandlådan innan du provar något som köar.**

`notis_installning` styr takten: påminnelser 24 och 1 timme före,
chattmejl samlas i 10 minuter, passändringar i 3. Samlingen sker i
databasen genom `samlingsnyckel`, inte i arbetaren — fem repliker på
tre minuter blir ett mejl, och den som får fem mejl slutar läsa det
sjätte.

`DEPLOY-NOTISER.md` har resten: de tre konfigurationstabellerna, hur
sandlådan slås på innan något provas, och de fem stegen för att lägga
till en ny notistyp utan att den faller ut som `okänd notistyp` ur en
trigger.

---

## 6. Säkerhetsmodellen

Den här är inte förhandlingsbar och förklarar större delen av koden.

**Allt skydd ligger i RLS. Ingenting ligger i gränssnittet.**
Adminvyn hämtar med samma anon-nyckel som alla andra. Att gömma en
knapp är inte säkerhet — den som inte är admin får tomma svar oavsett
vad filen ritar. `is_admin`-kontrollen i `nextrum-admin.js` finns för
att visa **rätt sida**, inte för att skydda data.

- **Rå servertext visas bara i de inloggade vyerna.** `NX.felText`
  kände igen sex fel och skrev annars ut serverns egen text. På
  `body.vy` (admin, larare, foralder) är det rätt — den som läser är
  vi själva, och "new row violates row-level security policy for table
  bookings" är svaret på frågan. På en publik sida är det fel två
  gånger om: föräldern förstår den inte, och den beskriver en tabell
  och en policy för vem som helst. Sedan Fas 14.0 går den texten till
  konsolen och `klientfel` i stället, och besökaren får ett begripligt
  besked med en adress att mejla. **Varje meddelande som slutar i en
  återvändsgränd ska bära `{oss}`** — `t()` fyller den med `CFG.EPOST`
  utan att anroparen behöver veta om det. Förut stod "Fyll i
  nextrum-config.js" ordagrant på den publika intresseanmälan, och en
  familj som fick det hade ingen väg vidare alls.
- **anon-nyckeln är inte hemlig.** Den hör hemma i webbläsaren.
- **`service_role` får aldrig in i en klientfil.** Den går förbi RLS.
- **I edge functions: anroparens egen token prövas mot Auth och RLS
  INNAN `service_role` används.** En kontroll som ligger efter
  `service_role` är ingen kontroll. `_delad/auth.ts` har en väg per
  fråga — uppfinn inte en ny.
- **Ett CHECK-villkor körs som ANROPAREN, inte som tabellägaren.**
  Dyrköpt i Fas 10: en `revoke execute` på `tjanstkoder_finns`, som
  backar `applications_tjanster_check`, slog sönder hela
  ansökningsvägen med `permission denied`. Ska en funktion som backar
  ett villkor sluta vara nåbar utifrån, FLYTTA den ur `public` i
  stället — schemat `intern` finns för just det, och PostgREST
  exponerar det inte. Ett rullat prov fångade det; utan provet hade
  rekryteringsformuläret tystnat i drift.
- **Postgres RLS kan inte begränsa enskilda kolumner.** Därför vaktas
  `is_admin`, `matched_tutor_id`, `status` och bokningsfälten av
  **triggers** som vägrar ändringen från en inloggad session. Det går
  inte att göra sig själv till admin från någon vy, med flit.
  Admin sätts med SQL:
  ```sql
  update public.profiles set is_admin = true where email = '…';
  ```
- **`invoices` och `payouts` har med flit ingen INSERT-policy för
  användare.** Kan ingen skriva belopp från webbläsaren kan ingen
  skriva fel belopp. Beloppen sätts av `fakturering` med `service_role`.
- **`integrationer` har ingen skrivpolicy alls.** Adminvyn rapporterar
  status, den kopplar inte.
- **Hinkarna är privata, och sökvägen är ett uuid — aldrig ett namn.**
  `material` har elevens id som mapp, `dokument` (Fas 9.10) har
  handlingens, `bibliotek` (Fas 13.2) har materialradens. Ett filnamn heter i praktiken "Avtal Alva Berg 2026.pdf",
  och sökvägen är det enda i en hink som syns innan man öppnat filen.
  `mapp_uuid()` plockar ut den, och policyerna jämför den mot en rad.
  Fas 9.1 rättade att familjegrenen i materialpolicyn jämförde elevens
  NAMN med ett uuid, eftersom `storage.objects.name` skuggades av
  tabellaliaset — familjen hade alltså aldrig kunnat se sitt barns
  material, och en policy som nekar för mycket ser ut som en tom lista,
  inte som ett fel.
- **Tar du bort en fil: filen först, raden sedan, och LÄS SVARET.**
  Sökvägen finns bara i raden. Försvinner raden först blir filen omöjlig
  att hitta och omöjlig att städa. Det stod som en kommentar i
  adminvyn långt innan koden faktiskt gjorde det (Fas 9.2).
- **Notishemligheten ligger i `notis_konfig`, inte i en secret.** En
  secret och en webhook-header i två olika fönster glider isär, och då
  svarar funktionen 401 på varje anmälan emellan — de mejlen kommer
  aldrig. I en tabell byts båda i samma transaktion.

### Supabases säkerhetsadvisor larmar om saker som är med flit

`get_advisors(type: 'security')` ger ett trettiotal varningar. De flesta
är väntade, och listan nedan finns för att ingen ska utreda dem en
gång till. **Kontrollerat 2026-09-23, med prov mot driften:**

| Varning | Varför den är väntad |
|---|---|
| `rls_enabled_no_policy` på `notis_konfig`, `fortnox_token`, `kund_skatteuppgifter`, `stripe_handelser` | RLS på utan en enda policy ÄR skyddet: bara `service_role` ser dem. Se avsnitt 6 ovan |
| 23 SECURITY DEFINER-funktioner nåbara för `authenticated` | Alla fjorton adminfunktioner kontrollerar `is_admin()` internt. Att EXECUTE finns är inte samma sak som att funktionen gör något |
| `is_admin(uid)` nåbar för `anon` | Funktionen hämtar raden bara om `uid` är ens eget ELLER anroparen själv är admin. Som anon är `auth.uid()` null, så villkoret faller alltid |
| `kolla_rabattkod` nåbar för `anon` | Första raden i kroppen är `if auth.uid() is null then return 'Logga in först.'` |

Proven, körda som `anon` i en transaktion som rullades tillbaka:
`is_admin(<en riktig admin>)` → `false`, `is_admin(<vanlig användare>)`
→ `false`, `is_admin()` → `false`, `kolla_rabattkod(…)` → `"Logga in
först."`

**Ett larm som VAR äkta, och är rättat:** `ar_godkand_studiehjalpare(uid)`
var nåbar för `anon` och svarade om vilket uuid som helst — prövat mot
driften gav den `true` för en godkänd hjälpare där `is_admin` samma väg
gav `false`. Den saknade alltså precis den vakt som gör `is_admin`
ofarlig. Fas 14.0b gav den samma vakt och återkallade EXECUTE från
anon. Att revoke var säkert PRÖVADES FÖRST: alla fem policyer som
backar funktionen är `to authenticated`, och inget check-villkor, ingen
vy och ingen annan funktion nämner den. Hade någon varit `to anon` hade
Fas 10-fällan slagit till igen. **Lärdomen: en ny funktion som svarar
på en fråga om en PERSON ska ha is_admins vakt från första raden.**

**Två saker som inte är falsklarm:**

1. **Läckta lösenord kontrolleras inte.** Supabase Auth kan stämma av
   mot HaveIBeenPwned. Det är en kryssruta under Authentication →
   Policies, kostar ingenting och gäller nya och ändrade lösenord.
2. **`kolla_rabattkod` har inget tak per inloggad användare.** I dag
   spelar det ingen roll: `rabattkoder` är TOM, så det finns ingenting
   att gissa. **Skapas den första koden återkommer frågan** — en
   inloggad kan då pröva koder i en slinga. Lägg ett tak då, inte nu.

### Content-Security-Policy

`/admin`, `/larare` och `/foralder` får en **skarp** CSP från
`vercel.json`: `script-src 'self'`. Alltså:

**Ingen inline-JavaScript i de tre sidorna. Inga `<script>` utan `src`,
inga `onclick="…"`, inga `javascript:`-adresser.**

`verktyg/kolla-csp.py` kontrollerar det i CI. De publika sidorna har
kvar policyn i Report-Only eftersom de fortfarande har inline-skript.

**`/foralder` släpper in Stripe, och bara Stripe** (Fas 14.5). Kassan
ritas i en panel på sidan i stället för på Stripes egen, och Stripe.js
får inte vendoras: det ska alltid hämtas från `js.stripe.com`. Sidan
har därför en egen rad i `vercel.json`, med Stripes domäner i
`script-src`, `frame-src`, `connect-src` och `img-src`, och
`payment` tillåtet för Stripes ramar i Permissions-Policy (Apple Pay
och Google Pay). `/admin` och `/larare` har kvar exakt den gamla
policyn. Regeln om inline-JavaScript gäller oförändrat också på
`/foralder`: Stripe.js laddas med en `src`, när familjen trycker
Betala. **Lägg aldrig två skarpa CSP-rader som båda matchar samma
sida**: webbläsaren kräver då båda, och Stripe stoppas av den strängare.

---

## 7. Edge functions (`supabase/functions/`)

`_delad/` innehåller det som sju funktioner tidigare hade var sin kopia
av — och kopiorna hade hunnit glida isär (två `esc()` escapade inte
apostrofen, två hemlighetsjämförelser använde `===`). **Lägg inte
tillbaka en kopia.**

| Funktion | Gör | Anropas av |
|---|---|---|
| `fakturering` | Månadskörningen: underlag per studiehjälpare, och en lista över pass som hölls utan att betalas. **Skapar ingen faktura sedan Fas 14.2** | Schema (`x-fakturering-nyckel`) eller admin |
| `faktura-utskick` | Skickar en äldre faktura. **Mejlet först, statusen sedan.** Inga nya skapas sedan Fas 14.2, så den har bara historiken kvar | Knapp under Äldre fakturor |
| `bjud-in` | Auth-inbjudan till familj utan konto. Ger bara rollen förälder | Adminvyn |
| `lead-notis` | Avisering till ledningen **och kvitto till familjen** när en intresseanmälan kommer in | **Databaswebhook** `ny-intresseanmalan`, `verify_jwt` av, delad hemlighet i header |
| `pass-notis`, `meddelande-notis` | **Anropas inte längre.** Se nedan | — |
| `generate-feedback`, `generate-message` | Claude-utkast. Använder **inte** `service_role`, vidarebefordrar användarens token | Vyerna |
| `material-forslag` | Övningsuppgifter **i klartext, aldrig som länk** | Adminvyn |
| `juridik`, `ekonomi` | Agenter. Läser aldrig ur minnet, läser bara | Adminvyn |
| `drift` | Tredje agenten (Fas 8). Läser verksamheten och siffrorna, föreslår. Inget utgående verktyg | Adminvyn |
| `notis-ko` | Kö-arbetaren (Runda 2). Tar rader ur `notis_utskick`, renderar och skickar. Får alla sina beroenden inskickade | pg_cron, via `notis_konfig.arbetare_url` |
| `notis-avanmal` | Stänger av EN notistyp i EN kanal utifrån en signerad token. Kan aldrig slå på något | Länken i mejlet, och mejlprogrammets One-Click |
| `stripe-checkout` | Familjens kortbetalning för ETT bekräftat pass. **Hela beloppet till Nextrum**, ingen destination och ingen avgift. Beloppet räknas här, aldrig i anropet. Kassan öppnas i en panel på sidan (Fas 14.5), med Stripes egen sida som reserv | Knappen på passet i föräldravyn |
| `stripe-webhook` | Enda vägen som får sätta en betalning som betald. Signatur i konstant tid, idempotens via `stripe_handelser` | Stripe |
| `stripe-aterbetalning` | Återbetalning till familjen, hel eller delvis. Beloppet tas ur raden, aldrig ur anropet | Knappen under Ekonomi → Kortbetalningar |
| `stripe-lage` | Frågar Stripe om nyckeln, kontot, kontoutdraget och webhookens händelser, och säger vad som saknas (Fas 14.3). **Läser, skriver ingenting.** Nyckeln lämnar aldrig funktionen, bara om den är test eller skarp | Knappen Kontrollera Stripe under Ekonomi → Kortbetalningar |

`supabase/config.toml` bär `verify_jwt = false` för de sju funktioner
som anropas utan inloggad användare. Inställningen satt länge bara i
dashboarden, och en `supabase functions deploy` utan filen hade slagit
på JWT-kravet igen — då svarar triggrarna och arbetaren 401, och
eftersom anroparen är ett schema finns ingen som ser det. **Filen är
sanningen, inte dashboarden.** Lägger du till en funktion utan
inloggning: skriv raden där i samma ändring.

### `pass-notis` och `meddelande-notis` är pensionerade (Fas 14.0)

Båda hade ingen anropare kvar: Runda 2 bytte webhookarna som ringde
dem mot kötriggrar. Beslutet är taget — källan är borttagen ur repot
och raderna ur `supabase/config.toml`.

**KVAR ATT GÖRA FÖR HAND: de ligger fortfarande ACTIVE i driften.**
Supabase CLI och MCP kan driftsätta en funktion men inte ta bort den;
det görs i dashboarden under Edge Functions. Tills dess svarar de på
sin adress, skyddade av den delade hemligheten i headern, men de gör
ingenting någon ber om.

Så här ser vägarna ut i dag:

| Tabell | Trigger i dag | Funktion |
|---|---|---|
| `bookings` | `bookings_notis` | `notis_vid_pass` — köar |
| `messages` | `messages_notis` | `notis_vid_meddelande` — köar |
| `lesson_reports` | `lesson_reports_notis` | `notis_vid_rapport` — köar |
| `leads` | `ny-intresseanmalan` | `http_request` → `lead-notis` |

`leads` är alltså den enda som fortfarande går via en webhook, och
`lead-notis` den enda av de tre som lever.

Det kostade en gång: `verktyg/rls-test.sql` stängde av
`"nytt-passforslag"` på `bookings` och kraschade på den första satsen
efter `begin` med 42704 — hela sviten gick inte att köra, och en svit
som inte går att köra provar ingenting. Den slår nu upp triggrarna på
FUNKTIONEN i stället för på namnet.

`stripe-konto` hörde till samma sort och **är borttagen ur driften**
(Fas 12.5). Den skapade anslutna Stripe-konton, och ingen knapp
anropade den längre: studiehjälparen får betalt den 25:e genom
`payouts`, så ett anslutet konto fyller ingen funktion.

ACTIVE funktioner som ingen ringer är samma sorts halvfärdighet som
gjorde att hela det här systemet inte fanns i repot. Det är därför de
två ovan är avgjorda och inte utredda en gång till.

### Notissystemet kom hem i efterhand

`notis-ko` och `notis-avanmal` låg ACTIVE i driften utan att finnas i
någon gren, och fjorton migrationer (`r2_fas1_1` till `r2_fas2_4`)
hade körts utan att bli filer. Den här filen varnade för precis det
och sa att det skulle redas ut **innan pg_cron installerades**.
pg_cron installerades ändå. Varningen hann bli osann innan någon
läste den, och beskrev sedan en äldre version av funktionerna: en
`arbetare.ts` som inte längre finns, och en databasdel som sades vara
okörd när den i själva verket var körd.

Allt är nu hämtat hem ordagrant, varje migration kontrollerad mot
databasens md5-summa och funktionsfilerna diffade mot driften.

**Lärdomen är inte "kom ihåg att commit:a".** Den är att
`apply_migration` och `functions deploy` ändrar driften direkt, medan
git är ett skilt steg som ingen kontroll tvingar fram. Två system kan
alltså glida isär utan att något blir rött. Kör frågan i avsnitt 5
innan du tror på filerna — och när du driftsatt något, commit:a det
i samma arbetspass, inte i nästa.

### Agentregeln

`_delad/agent.ts` bär fyra regler som *är* agenterna:

1. **Hårt stegtak.** En agent som loopar fritt mot betalda API-anrop är
   en räkning som växer medan ingen tittar.
2. **Källtvång som kod, inte som prompt.** Koden kontrollerar att varje
   adress i svarets källista är en adress agenten **faktiskt hämtade**.
   Påhittade adresser plockas bort. Blir listan tom kastas svaret.
3. **Bara `kallor` blir klickbara i gränssnittet.** En påhittad adress
   ritas överstruken i en varningsruta. Att linkifiera med regex vore
   att bygga in precis det fel resten av systemet fångar.
4. **`ekonomi` skriver aldrig.** Alla verktyg är läsande. Det är
   designen, inte tillfällig försiktighet i väntan på bättre modeller.

`verktyg/testa-agent.js` och `_delad/agent_test.ts` vaktar spärrarna.
Testfallen med värdnamn i sökväg och `https://riksdagen.se@evil.com/`
står kvar för att det är så en naiv `indexOf` går sönder.

### AI-lagret (Fas 8)

Tre agenter: `juridik`, `ekonomi` och `drift`. De två första läser
rättskällor och bolagets siffror. Den tredje läser verksamheten —
anmälningar, omatchade elever, kommande pass, saknade rapporter — och
**har med flit inget utgående verktyg**: en agent som både läser
känsliga rader och kan hämta en adress kan bära ut dem, och det räcker
med en rad injicerad text i en intresseanmälan för att försöket ska
göras.

**Regeln "ingen AI-väg skriver i affärstabeller" bor i databasen, inte
i TypeScript.** Rollen `nextrum_ai` har inga tabellrättigheter alls.
Den kan köra sju funktioner, och dörren `ai_verktyg` — den enda väg
drift-agenten talar med databasen genom — **ägs av den rollen**.
Försöker något i dörren skriva i `students` svarar databasen
`permission denied`. Det första den garantin stoppade var dörrens egen
kontroll av att eleven fanns; den fick bli `ai_finns()`.

- **AI:n formulerar aldrig en nyckel eller en titel.** Nycklar byggs av
  kod ur typ och id. Modellens text får bara hamna i `motivering` och
  `beskrivning`, fält som INTE står i auditloggens vitlistor —
  auditloggen går inte att rätta.
- **Förslag, inte åtgärder.** `ai_forslag` bär det AI:n vill göra. En
  nyckel är ett förslag, för alltid: avvisas ett par kommer just det
  paret inte tillbaka. `godkann_forslag()` utför, i SQL, med
  **adminens egen token**, så att `skydda_*`-triggrarna och
  `logga_andring` fungerar precis som när en människa klickar. En gren
  per typ, aldrig `update <tabell> set <payload>`.
- **Databasutdata märks innan modellen ser det.** `somDatabasData()` i
  `_delad/agent.ts` lindar svaret i ett block med ett slumptal per
  anrop, så att texten inte kan stänga sitt eget block. Ett verktyg
  som svarar med `data` i stället för `text` lindas av motorn — att
  låta varje agent göra det själv vore att lita på att ingen glömmer.
- **Domänspärren gäller efter varje omdirigering.** `hamta()` följer
  hoppen för hand och prövar listan vid varje steg; förut kunde en
  tillåten källa svara 302 till vad som helst.
- **Läsverktygen lämnar inte ut namnKOLUMNERNA**, e-postadresser eller
  `bookings.location` (fältet är i praktiken en hemadress). Elever
  visas med initialer — det är en minimering, inte en avidentifiering:
  i Nextrums storlek pekar initialer plus årskurs i praktiken ut ett
  barn. Fritexten maskas på e-post och sifferföljder och kapas, men
  **den kan fortfarande innehålla namn**: familjen skriver ofta
  "Elsa behöver hjälp med matten" i rutan. Det är en avvägning, inte
  ett skydd som håller tätt.
- Matchningspoängen ligger i `matchningspoang()`. Adminvyn hämtar
  svaret och skriver meningarna själv — databasen svarar med koder,
  aldrig med svensk text, så att samma svar kan läsas av en agent utan
  att den får namn på köpet.
- **Analysvyerna når agenten bara genom omslag.** `ai_analys()` och
  `ai_avvikelser()` (Fas 9.9) är SECURITY DEFINER och ägs av postgres,
  eftersom `nextrum_ai` inte kan läsa en invoker-vy: rollen har inga
  tabellrättigheter, så svaret hade blivit `permission denied`, inte en
  tom lista. Omslagen lämnar ut en FAST kolumnlista, aldrig `select *`.
  Källfälten (`kalla`, `kampanj`, `sokord` …) står med flit inte i den:
  de skrivs av en anonym besökare i adressraden, och en modellprompt är
  fel ställe för text en främling formulerat.
- `verktyg/testa-agent.js` vaktar drift-agentens verktygslista i CI:
  exakt nio verktyg, inget utgående, och ett stegtak som är satt.

**Provbänken `_prov-admin-*` får aldrig checkas in.** Den laddar de
riktiga filerna mot en stubbad databas vars `auth` alltid svarar
"inloggad admin" — alltså hela adminvyn utan inloggning — och
`.vercelignore` är en nekande lista som inte täcker den. Den står i
`.gitignore` sedan den en gång följde med en commit.

### Maskoten har med flit ingen modell

En publik chatt mot en API-nyckel har sin adress i sidans JavaScript.
Utan spärr kan vem som helst köra den i en slinga på Nextrums räkning,
och en spärr i webbläsaren går att gå runt. Svaren är dessutom en känd,
ändlig mängd som redan står på `faq.html`. Maskoten kan därför inte
hitta på ett pris, ett villkor eller ett löfte.

---

## 8. Genererade filer — ändra aldrig för hand

| Fil | Byggs av | Ur |
|---|---|---|
| `nextrum-maskot-svar.js` | `verktyg/bygg-maskotsvar.py` | `faq.html`, `en/faq.html` |
| FAQPage-märkningen i `faq.html` och `en/faq.html` | `verktyg/bygg-faq-schema.py` | frågorna på sidan |
| `laxhjalp-*.html` (7 st) | `verktyg/bygg-omradessidor.py` | skalet läses ur `var-ide.html` |
| Ikonlänkar och storlekar | `verktyg/satt-logga.py` | `bilder/nextrum-logo.png` — finns inte i dag; PNG:erna är renderade ur `favicon.svg`, se `GOOGLE.md` |
| `bank/*.png` (övningsbladen) | `verktyg/bygg-banken.py` | bladen står i klartext i verktyget. Körs för hand (kräver Chromium), inte i CI. `--sql` ger raderna till `biblioteksmaterial` |
| `?v=`-stämplarna på alla script- och link-taggar | `verktyg/satt-version.py` | filernas egen md5 |
| `bilder/*.webp` | `verktyg/bygg-webp.py` | `bilder/*.jpg` |

CI kör om maskotsvaren och FAQ-schemat och gör `git diff --exit-code`.
Ändrar du FAQ:n utan att bygga om blir bygget rött.

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

---

## 9. CI — `.github/workflows/kontroll.yml`

Körs på varje push och PR. Ska vara grön före merge.

1. `node --check` på all JavaScript
2. `node verktyg/testa-agent.js`
3. `verktyg/kolla-betalningsvillkor.py` (betalningslöftet, och att det gamla är borta)
4. `verktyg/kolla-migrationer.py`
5. `verktyg/kolla-csp.py`
6. `verktyg/kolla-webp.py`
7. `verktyg/satt-version.py --kolla`
8. Genererade filer är aktuella (bygg om + `git diff --exit-code`)
9. Språkdiff mot baslinjen — **inklusive attributNAMNEN**, sedan
   `<div role="img" alt="…">` stod på den engelska startsidan där
   svenskan hade `aria-label`. `alt` betyder ingenting på en div, så
   illustrationen var namnlös för skärmläsare på ett av två språk.
   Taggsekvensen var identisk och texten översatt, så verktyget sa ok
10. `deno check supabase/functions/*/index.ts`, `deno test _delad/`

Kör dem lokalt innan du pushar. De är snabba och de fångar exakt det
som annars upptäcks i drift.

**`verktyg/rls-test.sql` körs inte i CI** — den behöver en databas.
Kör hela filen som **ett** anrop i SQL Editor eller via `execute_sql`.
Den lägger upp två hjälpare, två familjer, tre barn, pass och en admin,
kör varje behörighetstest i en egen deltransaktion och rullar tillbaka
allt på sista raden. Notistriggern på `bookings` stängs av under
körningen så att fixturpassen aldrig blir ett mejl. Svaret är en tabell
`test, ok, detalj` — **varje rad ska vara ok**. Kör den efter varje
ändring i en policy eller en trigger.

---

## 10. Arbetssätt

- **Commit-meddelanden är svenska och beskriver följden, inte diffen.**
  "Fas 2.5: en faktura skickas bara en gång", inte "fix invoice bug".
  Arbetet har gått i faser (Fas 1 säkerhet, Fas 2 fakturering,
  Fas 3 struktur och CI); följ numreringen när arbetet hör till en fas.
- **Kommentarerna förklarar varför, inte vad.** Kodbasens
  filhuvuden säger vilket fel konstruktionen finns för att hindra. Håll
  den stilen — den är halva minnet.
- **Bilder:** `bilder/*.png` är gitignorerade (originalen, ~50 MB).
  Sajten laddar bara JPG-varianterna. Tappar du datorn finns
  originalen ingenstans.
- **`.claude/skills/`, `.agents/`, `skills-lock.json`** är
  gitignorerade Higgsfield-verktyg. De försvinner när miljön återskapas.
- **En Claude-artefaktlänk kan aldrig prata med Supabase.** Testa mot
  riktiga filer.

---

## 11. Vad som inte är byggt

- **Betalning.** Familjen betalar varje pass med kort, **före passet**
  (Fas 14.2). Månadsfakturan till familjen är riven: `fakturering`
  skapar bara studiehjälparens underlag och räknar i sitt svar upp pass
  som hölls utan att betalas (`obetalda`). Fakturor som redan fanns står
  kvar som historik (det fanns noll), och `faktura-utskick` har bara dem
  kvar att skicka.

  **Kortvägen är driftsatt men har aldrig gått hela vägen.** Endpointen
  finns hos Stripe (sandlådan), och `STRIPE_WEBHOOK_SECRET` är satt och
  provad: en påhittad signatur faller på tidsstämpeln, inte på
  hemligheten. Men `stripe_handelser` är tom och inget pass har
  `betald_at` (kontrollerat 2026-09-24). Ingen leverans från Stripe har
  kommit fram, inte ens en testhändelse. `basil`, som `_delad/stripe.ts`
  pinnar, gick inte att välja när endpointen skapades, så den står
  troligen på förvalet `dahlia` (DEPLOY-BETALNING.md förklarar varför
  det sannolikt håller, och vad som ska kontrolleras). Provbetalningen i
  `DEPLOY-BETALNING.md` avsnitt 9 är det första som ska göras, före
  allt annat i den här listan.

  **Det behöver inte gissas längre (Fas 14.3).** Miljön som skrev
  betalkoden når inte `api.stripe.com`, så nyckeln stod som "okänd
  härifrån" och versionen som "troligen". Knappen **Kontrollera
  Stripe** under Kortbetalningar kör `stripe-lage`, som frågar Stripe
  med servernyckeln och säger vad som är rött: nyckelns sort,
  kontot, kontoutdragets grunddel, endpointens adress, version och
  händelser, och leveranserna i `stripe_handelser`. Reglerna står i
  `granskaStripe()` i `_delad/stripe.ts` och har egna prov. **Tryck på
  den före provbetalningen.**

  **Connect är borttaget (Fas 12.5.)** Studiehjälparen får betalt den
  25:e, som en löning, i en klump för månadens rapporterade pass. Det
  är `payouts` och månadskörningens jobb. En destination charge hade
  lagt hjälparens del på hens Stripe-saldo vid varje pass, och sedan
  hade månadskörningen betalat samma timmar en gång till.

  **Spärren "ingen betalning, inget pass" finns, och den är AV.** Den
  slås om under Betalningar & utbetalningar → Kortbetalningar (se
  avsnitt 5). **Slå inte på den förrän provbetalningen gått igenom.**
  Påslagen i dag hade den låst varenda studiehjälpare från att
  rapportera ett enda pass. Flaggans `vantar_pa` säger vad den väntar
  på, och `stampla_flaggan()` hindrar att texten skrivs om från en vy.

  **Kvar, och inget av det sköter koden åt er:**

  - **Startererbjudandet finns inte i koden.** Prissidan lovar "Första
    timmen på köpet … dras av när ni betalar", och kortbetalningen drar
    inte av något. Före en ny familjs första betalning: bestäm regeln
    och bygg den i `stripe-checkout`, sätt `rabatt_ore` på passet för
    hand innan familjen betalar (admin går förbi skyddet), eller ta bort
    erbjudandet.
  - **Villkoren lovar priset vid bokningen, kortbetalningen räknar
    priset när familjen betalar.** Glappet fanns redan med
    månadsfakturan, som också räknade på dagens pris. Rätt lösning är
    att frysa timpriset på bokningen, som rabatten redan gör, och skydda
    kolumnen i `skydda_bokningsfalt`. Tills dess säger prisdialogen i
    adminvyn hur många bokade pass som väntar på betalning när priset
    höjs.
  - **Ett avbokat pass kan bli betalt.** Betalsidan kan ligga öppen när
    passet avbokas, och Stripe drar pengarna om familjen betalar
    efteråt. Webhooken skriver ner betalningen, för pengarna är dragna,
    och `betald_men_avbokad` larmar tills beloppet är tillbaka.
    Återbetalningen är en knapp, inte automatisk.
  - **Villkoren ändrades.** Den som redan har konto godkände
    månadsfaktura i efterskott med tio dagars betalningsvillkor, och
    villkoren har ett avsnitt om ändringar. Meddela dem innan det nya
    gäller dem.
  - **Korttvister har en sista dag, och den är människans (Fas 14.3).**
    Förut satte webhooken bara `betalning_status = 'tvist'`: sista dagen
    att svara, orsaken och utfallet stod ingenstans, och en förlorad
    tvist såg ut som en öppen. Nu sparas de i `stripe_tvister`, en
    uppgift med dagen som förfallodag skapas, och adminvyn visar dagar
    kvar. Underlaget skickas in i Stripes dashboard, av en människa.
    DEPLOY-BETALNING.md 9.10 har processen. En förlorad tvist står kvar
    som `tvist`, inte `aterbetald`: passet hölls, och ett återkrav vi
    förlorat är inte en återbetalning vi valt.
  - **Ingen avbokningsavgift.** Villkoren lovar hela beloppet tillbaka
    för ett pass som aldrig hölls. En avgift för sena avbokningar är ett
    nytt villkor, inte en inställning.
  - **Fortnox.** Ingenting når bokföringen än. När det byggs: en
    verifikation per betalt pass, spårad med
    `stripe_balanstransaktion_id`, och Stripes utbetalning till banken
    som en egen händelse, netto efter avgiften.

  **Fas 14.3 tog säljarens MVP-lista som utgångspunkt** (punkterna står
  i DEPLOY-BETALNING.md 9.8). Utöver tvisterna och kontrollen ovan:
  checkout tar **bara kort**, för Klarna och Swish blir klara först i
  efterhand genom en händelse webhooken inte hanterar, och familjen
  hade betalat ett pass som stod obetalt för alltid. Kvittot skickas
  genom `receipt_email`, inte genom en kryssruta i dashboarden.
  Kontoutdragets tillägg kapas vid tio tecken, för hela raden får vara
  22 och ett långt ämne hade fått Stripe att neka betalningen. Och
  bokningsbekräftelsen och påminnelsen till familjen säger att passet
  betalas före, vilket var villkor 3 och 4 för spärren. Kvar av
  villkoren är bara provbetalningen.

  **Fas 14.1 lagade sex fel i kortvägen före omställningen**, och tre
  av dem ändrar hur man ska läsa raden:

  - **`betalt_ore` är ett kvitto, `begart_ore` är ett påstående.**
    Förut skrev `stripe-checkout` `betalt_ore` redan när sessionen
    skapades, alltså innan någon betalat, och resten av systemet läste
    namnet i stället för kommentaren. Nu skriver checkout `begart_ore`
    och **bara webhooken** skriver `betalt_ore`, ur sessionens
    `amount_total`. Skiljer de sig betalade familjen en äldre session
    som låg kvar öppen med ett annat belopp.
  - **`stripe_balanstransaktion_id` finns bara att hämta i stunden.**
    Stripe betalar ut i klumpar, netto efter avgift: ingen bankrad
    motsvarar ett pass. txn_-id:t är enda vägen dit, och avgiften
    (`stripe_avgift_ore`) finns ingen annanstans i systemet. Hämtas den
    inte när betalningen kommer in går den inte att få tag på sedan.
  - **Ett betalt pass går inte att avboka från en vy.**
    `skydda_bokningsfalt` hade `if new.status = 'cancelled' then null` —
    avbokning var det enda statusbytet som inte prövades alls. En familj
    kunde avboka ett pass de betalat och vi behöll pengarna tyst. Nu
    nekas det, med ett meddelande som säger varför. Ingen automatisk
    återbetalning: villkoren lovar sedan Fas 14.2 hela beloppet tillbaka
    för ett pass som aldrig hölls, men återbetalningen görs med en knapp
    under Kortbetalningar, och `betald_men_avbokad` larmar tills den är
    gjord.

  `aterbetald_ore` nollas när en ny betalning kommer in — kolumnerna
  beskriver den betalning som gäller NU, och en gammal återbetalning
  hör till den gamla chargen.

  **Föräldravyn visar bara kortet** (Leos val 2026-09-24: "bara kort,
  som Fas 14 sa"). Betalning listar pass att betala och betalda pass,
  båda ritade ur passen; ingen fakturahistorik, eftersom det aldrig
  skickades en enda faktura. Ett betalt pass har ingen
  avbokningsknapp i någon vy, inte heller "Avböj" eller "Dra tillbaka"
  på en flyttad tid, eftersom databasen nekar det. Med spärren på går
  också ett passerat, obetalt pass att betala: annars hade ett pass som
  faktiskt hölls fastnat mellan en studiehjälpare som inte får
  rapportera och en familj som inte får betala.

  `SKISS-BETALNING-STRIPE.md` beskriver hur beslutet gick.
- **Google Workspace och Fortnox.** Statusflik finns, koppling saknas.
  `INTEGRATIONER.md` har hela receptet, inklusive fällan att Fortnox
  roterar refresh-token vid varje användning — sparas inte det nya
  blir ni utlåsta om en månad.
- **Bakgrundskontroller.** Godkännandet är en knapp, inte en process.
  Fas 13.1 gav rekryteringen en ORDNING (kontakt, digitalt möte,
  utbildning, poolen) med skälet till varje steg skrivet i vyn, men
  inget av stegen kontrollerar något utifrån: mötet bokas inte i en
  kalender — Google Workspace är inte kopplat — och utbildningen är en
  länk i `UTBILDNING_URL`, inte ett prov systemet läser resultatet av.
- **`materials` har inga läsare kvar utom oss själva** (efter Fas
  13.3). Studiehjälparvyns materialflik är ombyggd till biblioteket,
  och adminvyns detaljpanel skriver fortfarande dit men säger nu i
  klartext att familjen inte ser det. Tabellen och hinken `material`
  lever kvar. `NXMedia.laddaMaterial`, `materialRad` och
  `sparaMaterialfil` gör det INTE längre — de hade noll anropare kvar
  efter ombyggnaden, och en delad hjälpare som ingen ringer är en
  hjälpare nästa person bygger vidare på. Kvar att bestämma: ska
  panelen vara kvar som internt underlag (då är det färdigt) eller ska
  `materials` bort helt (då är det en städning med en hink att tömma
  först)?
- **Skatt och anställning av minderåriga.** Olöst. Revisor före första
  utbetalningen, inte efter.
- **Riktiga foton på studiehjälparna.** Generisk siluett nu.

---

## 12. Minne som inte finns i repot

Koden hänvisar på flera ställen till anteckningar som ligger utanför
den här mappen. Den som läser hänvisningen och inte hittar källan ska
veta att det inte är ett skrivfel:

- **`project-nextrum-engelska`** — numrerade fällor kring
  /en/-generatorn. "Fälla 4" (generatorn maskerar `<script>`) citeras i
  `nextrum-tjanster.js:38`; se även `arkiv/schema-v19.sql:21` och
  `verktyg/bygg-omradessidor.py:10`. Kärnan står i avsnitt 4 ovan.
- **"briefen"** — designdokument med numrerade paragrafer. §27 (fokal
  punkt, ansikten får aldrig beskäras bort) citeras i
  `nextrum-images.js:23`, §31 (lägg till en bild i bildberättelsen
  genom att lägga till ett objekt i listan) i `nextrum-motion.js:331`.

Hittar du de dokumenten: lägg in dem här i stället för att hänvisa
vidare. En hänvisning till något som inte går att öppna är inte ett
minne.

Övriga poster i Claude-projektets minne (`project-nextrum-oversikt`,
`-sakerhet`, `-databas`, `-sprak-kod`, `-genererat`, `-agenter`,
`-arbetssatt`) står i klartext i `MINNESPOSTER.md` och är sammanfattningar
av den här filen. De är alltså inte en källa: de pekar hit.
