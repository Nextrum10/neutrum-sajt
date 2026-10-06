# Grunden: stacken, filkartan, språket och arbetssättet

Arkivet för avsnitt 2, 4, 10 och 12 i `CLAUDE.md`, filkartan ur avsnitt 3 och filens gamla
inledning, ordagrant som de stod före delningen 2026-09-30. Reglerna står i kärnan, `CLAUDE.md`.
"Den här filen" i texten är `CLAUDE.md` före delningen, och "avsnitt N" är kärnans avsnitt, som
pekar vidare hit. Resten av avsnitt 3 står i `vyerna.md`.

---

## Inledningen, som den stod i CLAUDE.md

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

## 2. Stacken

**Inget byggsteg. Ingen pakethanterare. Inget ramverk.** Filerna i
repotroten är filerna som serveras. `supabase-js` ligger som en
vendorad fil i `bibliotek/`.

- **Frontend:** vanilla ES5/ES6 i `<script src>`, delade moduler som
  IIFE:er på `window` (`NX`, `NXStudie`, `NXArbete`, `NXMedia`,
  `NXKontakt`, `NXBetalning`, `NXTjanster`, `NXAgent`, `NXMotion`,
  `NXSamtycke`, `NXUppgifter`)
- **Backend:** Supabase (Postgres + RLS + Auth + Storage) och Deno
  edge functions i `supabase/functions/`
- **Hosting:** Vercel, `cleanUrls: true` (alltså `/priser`, inte
  `/priser.html`). Vercel-botten ska inte kommentera PR:er
  (2026-09-27): varje kommentar blev ett mejl från GitHub till
  info@nextrum.se, ett per PR. Det ställs in hos Vercel, under
  projektets Settings → Git (`gitComments` i API:t; Vercel-kopplingens
  `update_project` saknar fältet). `github.silent` i `vercel.json`
  hjälpte inte: grenen hade nyckeln, och botten kommenterade PR:en
  ändå. Stäng inte av repository_dispatch-händelserna i samma veva
  (`disableRepositoryDispatchEvents` i API:t, som Vercel-kopplingens
  `get_project` inte visar): `indexnow.yml` lyssnar på
  `vercel.deployment.success` sedan 2026-09-27 och tystnar utan dem,
  utan att något blir rött. GitHub-driftsättningarna behöver den inte
  längre (avsnitt 9)
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
| `nextrum-fel.js` | Felrapportering till `klientfel`. Laddas **före** `nextrum-app.js`, annars missas uppstartsfelen. Vem felet gällde sätter databasen (`intern.klientfel_vem`, 2026-09-28) ur `auth.uid()` och skriver över det klienten skickar: kolumnen fylldes aldrig förut, och varje fel stod som Utloggad. DATASKYDD.md rad 12 och integritetspolicyn räknar med konto-id, 90 dagar |
| `nextrum-modulvakt.js` | Fångar "en modul laddade inte" innan vyn dör tyst på "Laddar din vy". Laddas i **alla** vyerna sedan Fas 14.0 (barnets vy sedan 2026-09-30, med en egen gren) — adminvyn saknade den, fast den har 26 skript mot de andras 17. Prövar en FUNKTION per fil, inte bara att globalen finns: en gammal fil i cachen definierar sin global och ser frisk ut. Modulerna nås som IDENTIFIERARE, aldrig som `window[...]` — hälften deklareras `const NX… = …` på toppnivå och hamnar då inte på window |
| `nextrum-samtycke.js` | `NXSamtycke`: samtyckesrutan och det enda stället som svarar på "får vi?". Bara på de öppna sidorna, efter `nextrum-app.js`. Se avsnitt 6, Samtycket |
| `nextrum-images.js` | **Enda stället bildvägar står skrivna.** Aldrig i HTML |
| `nextrum-motion.js` | `NXImg` (bildmarkup), `NXMotion` (scrollmotor), `NXStory`. Tre lägen: full / lite / still |
| `nextrum-studie.js`, `-arbetsyta.js`, `-kontakt.js`, `-betalning.js`, `-media.js`, `-tjanster.js` | Delat mellan vyerna |
| `nextrum-uppgifter.js` + `nextrum-uppgifter.css` | `NXUppgifter` (Fas 23.1, NexLäx sedan Fas 23.2): vägen, spelaren, XP:n och serien ur `nexlax_lage()`, Din utveckling, stjärnorna, märkena, rättningen per område och genomgången. Sedan Fas 23.4 också väljaren, NP-sektionen, uppdragen, rangen och firandena. Studievyn, studiehjälparvyn och barnets vy, CSS:en efter arbetsytan. Rättar ingenting själv, räknar ingen XP och skriver inget resultat; det gör `niva_svara()` |
| `nextrum-ljud.js` | `NXLjud` (Fas 23.4): ljuden i NexLäx, räknade fram med Web Audio, och vibrationen (`navigator.vibrate`, och switch-tricket på iPhone). Av och på sparas i webbläsaren. Laddas före `nextrum-uppgifter.js` i de tre vyerna; modulvakten prövar `NXLjud.känn` |
| `nextrum-studie-vy.js` | Bara `foralder.html` |
| `nextrum-larare-vy.js` | Bara `larare.html` (2 800 rader) |
| `nextrum-barn-vy.js` | Bara `barn.html`, barnets egen vy (barnkonton_och_admin). Laddar NX, NXStudie och NXUppgifter (NexLäx, 2026-10-01) och ritar det `barn_oversikt()`, `barn_notiser()` och `barn_nexlax()` svarar, med `textContent` utom NexLäx, som NXUppgifter ritar med `esc()`. Se `minne/barnkonton-och-admin.md` |
| `lank.html` + `nextrum-lank.js` | `/lank` (2026-10-01): knappen som kontomejlens länk leder till, så att ett mejlfilter som öppnar länken i förväg inte förbrukar den. Ingen Supabase-klient, skarp CSP. Se `minne/sakerhet.md`, Kontomejlen |
| `nextrum-admin.js` | Adminvyns **skal**: inloggning, sidomeny, toppraden (sök, notiser, kontot), bevakning och `start()` |
| `nextrum-admin-karna.js` | `NXAdmin`: tillståndet `S`, hjälparna och hämtningarna. **Laddas först** |
| `nextrum-admin-*.js` | Ett område var: detalj, oversikt, kunder, rekrytering, bibliotek, kommunikation, drift, ekonomi (Betalningar), manaden (Månadens ekonomi), loner (Löner), tjanster, system, behorighet (vad en admin med behörigheter ser, och System → Adminhantering), automationer, ai, radera. Anropar varandra via `NXAdmin.rita`. En ny områdesfil ska in i `nextrum-modulvakt.js` också |
| `nextrum-admin-agenter.js` | Agentfliken. Delar inget med resten av adminvyn |
| `nextrum-maskot.js` + `-maskot-svar.js` | Hjälprutan. **Ingen språkmodell** |
| `nextrum.css` → `-home.css` → `-cinema.css` → `-vy.css` → `-arbetsyta.css` → `-agent.css` | Stillagren, i laddningsordning. **Cinema är sanningen** — den skriver över nästan allt de två första sätter. `-vy`, `-agent` och `-typsnitt` innehåller noll hexkoder och konsumerar bara. Papperet är `#F2EDE3` på hela sajten sedan 2026-09-25 (var `#EFE6D6`); det står i cinemas `:root` och i de ljusa formulär-öarna i mörkt läge, och `theme-color` på varje sida följer med. Mejlen har sin egen kopia av paletten (`FARG` i `_delad/notiser/rendera.ts`) och följer INTE med av sig själva |
| `nextrum-start.css` + `nextrum-start.js` | **Startsidan** (sv och en), efter cinema respektive före sidans eget skript, **och För elever & föräldrar**, som bara använder studievyns illustration ur dem. Rörelsen efter hero: ordfyllnaden, hållpunkterna 1–4, korten som stiger upp, det rullande bandet, bildväggen och studievyn som visar sig själv (en rundtur, men den går inte att klicka i). Skriptet startar av sig självt och skriver ingen text — allt man läser står i markupen, på båda språken |
| `nextrum-admin-palett.css` | Bara `admin.html`, laddas **sist**. Sedan 2026-09-24 **ingen egen palett**: adminvyn ärver jordpaletten som de två andra vyerna. Filen bär bara `--fel`, `--ln-kontroll`, agentflikens `--acc-lugn` och felsemantiken |
| `verktyg/` | Kontroller och generatorer. Körs i CI |
| `supabase/migrations/` | Databasen. `arkiv/` är historik |

Sex stadsdelssidor, fyra ämnessidor (`laxhjalp-*.html`), onlinesidan
(`laxhjalp-online`) och fyra guider (`hjalpa-barn-med-matte`,
`hjalpa-barn-med-lasforstaelse`, `plugga-infor-prov`,
`barnet-vill-inte-gora-laxorna`) genereras; navet
`laxhjalp-stockholm.html` är handskrivet. `/en/` är elva översatta sidor.

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
   ("Telefon: ", "Läst integritetspolicyn: ja") förblir svenska — de
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

## 10. Arbetssätt

- **Commit-meddelanden är svenska och beskriver följden, inte diffen.**
  "Fas 2.5: en faktura skickas bara en gång", inte "fix invoice bug".
  Arbetet har gått i faser (Fas 1 säkerhet, Fas 2 fakturering,
  Fas 3 struktur och CI); följ numreringen när arbetet hör till en fas.
- **Kommentarerna förklarar varför, inte vad.** Kodbasens
  filhuvuden säger vilket fel konstruktionen finns för att hindra. Håll
  den stilen — den är halva minnet.
- **Bilder:** `bilder/*.png` är gitignorerade (originalen, ~50 MB).
  Sajten laddar WebP genom `<picture>`, med JPG som reserv. Tappar du datorn finns
  originalen ingenstans.
- **`.claude/skills/`, `.agents/`, `skills-lock.json`** är
  gitignorerade Higgsfield-verktyg. De försvinner när miljön återskapas.
- **En Claude-artefaktlänk kan aldrig prata med Supabase.** Testa mot
  riktiga filer.

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
