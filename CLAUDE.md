# Nextrum — projektminne

Läxhjälpsförmedling i Stockholm. Publik sajt på två språk plus tre
inloggade vyer, byggd som statiska filer mot Supabase och driftsatt på
Vercel (`nextrum.se`).

Den här filen är minnet: vad som gäller, varför det gäller, och vilka
fel som redan har begåtts en gång. Driftinstruktionerna ligger kvar i
`START-HÄR.md` och `DEPLOY-*.md` — de upprepas inte här.

`.vercelignore` utesluter `*.md`, så filen serveras aldrig från sajten.

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

En studiehjälpare syns publikt först när admin satt läget till
**Godkänd**.

### Ordlistan (använd den, i kod och i text)

| Ord | Betyder |
|---|---|
| studiehjälpare | den som håller passet. Aldrig "lärare" utåt — `larare.html` heter så av historiska skäl |
| pass | ett bokat tillfälle (`bookings`). Hela timmar, 1–3 |
| rapport | `lesson_reports`. **Passet är genomfört först när rapporten finns** |
| underlag | vad studiehjälparen ska få (`payouts`) |
| faktura | vad familjen ska betala (`invoices`) |
| tjänst | rad i `tjanster`. `aktiv` avgör vad som syns, inget annat |

### Siffror som måste stämma överallt

- **379 kr/tim** (`nextrum-config.js: PRIS_PER_TIMME`)
- **69 kr/tim** tillägg för fler än ett barn — **fast, inte per barn**,
  tak tre barn (`tjanster.extra_personer_max`). Tre barn kostar 448, inte 517
- **10 dagars betalningsvillkor** (`_delad/konstanter.ts`). Står på
  fjorton ställen i fyra filtyper. `verktyg/kolla-betalningsvillkor.py`
  vaktar det, och den körs i CI. **En faktura som förfaller på en annan
  dag än villkoret lovar är en tvist, inte ett skrivfel.**
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
| `nextrum-config.js` | **Enda filen som ska ändras vid uppsättning.** URL, anon-nyckel, pris, e-post |
| `nextrum-app.js` | `NX` — delad grund: supa-klient, i18n, datum, fel, header, inloggning |
| `nextrum-fel.js` | Felrapportering till `klientfel`. Laddas **före** `nextrum-app.js`, annars missas uppstartsfelen |
| `nextrum-modulvakt.js` | Fångar "en modul laddade inte" innan vyn dör tyst på "Laddar din vy" |
| `nextrum-images.js` | **Enda stället bildvägar står skrivna.** Aldrig i HTML |
| `nextrum-motion.js` | `NXImg` (bildmarkup), `NXMotion` (scrollmotor), `NXStory`. Tre lägen: full / lite / still |
| `nextrum-studie.js`, `-arbetsyta.js`, `-kontakt.js`, `-betalning.js`, `-media.js`, `-tjanster.js` | Delat mellan vyerna |
| `nextrum-studie-vy.js` | Bara `foralder.html` |
| `nextrum-larare-vy.js` | Bara `larare.html` (2 800 rader) |
| `nextrum-admin.js` | Bara `admin.html` (4 700 rader) |
| `nextrum-admin-agenter.js` | Agentfliken. Delar inget med resten av adminvyn |
| `nextrum-maskot.js` + `-maskot-svar.js` | Hjälprutan. **Ingen språkmodell** |
| `verktyg/` | Kontroller och generatorer. Körs i CI |
| `supabase/migrations/` | Databasen. `arkiv/` är historik |

Sju områdessidor (`laxhjalp-*.html`) genereras. `/en/` är elva
översatta sidor.

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
`agent_korningar`, `agent_steg`, `admin_noteringar`, `foretagsfakta`.

---

## 6. Säkerhetsmodellen

Den här är inte förhandlingsbar och förklarar större delen av koden.

**Allt skydd ligger i RLS. Ingenting ligger i gränssnittet.**
Adminvyn hämtar med samma anon-nyckel som alla andra. Att gömma en
knapp är inte säkerhet — den som inte är admin får tomma svar oavsett
vad filen ritar. `is_admin`-kontrollen i `nextrum-admin.js` finns för
att visa **rätt sida**, inte för att skydda data.

- **anon-nyckeln är inte hemlig.** Den hör hemma i webbläsaren.
- **`service_role` får aldrig in i en klientfil.** Den går förbi RLS.
- **I edge functions: anroparens egen token prövas mot Auth och RLS
  INNAN `service_role` används.** En kontroll som ligger efter
  `service_role` är ingen kontroll. `_delad/auth.ts` har en väg per
  fråga — uppfinn inte en ny.
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
- **Notishemligheten ligger i `notis_konfig`, inte i en secret.** En
  secret och en webhook-header i två olika fönster glider isär, och då
  svarar funktionen 401 på varje anmälan emellan — de mejlen kommer
  aldrig. I en tabell byts båda i samma transaktion.

### Content-Security-Policy

`/admin`, `/larare` och `/foralder` får en **skarp** CSP från
`vercel.json`: `script-src 'self'`. Alltså:

**Ingen inline-JavaScript i de tre sidorna. Inga `<script>` utan `src`,
inga `onclick="…"`, inga `javascript:`-adresser.**

`verktyg/kolla-csp.py` kontrollerar det i CI. De publika sidorna har
kvar policyn i Report-Only eftersom de fortfarande har inline-skript.

---

## 7. Edge functions (`supabase/functions/`)

`_delad/` innehåller det som sju funktioner tidigare hade var sin kopia
av — och kopiorna hade hunnit glida isär (två `esc()` escapade inte
apostrofen, två hemlighetsjämförelser använde `===`). **Lägg inte
tillbaka en kopia.**

| Funktion | Gör | Anropas av |
|---|---|---|
| `fakturering` | Månadskörning: faktura per familj, underlag per hjälpare | Schema (`x-fakturering-nyckel`) eller admin |
| `faktura-utskick` | Skickar fakturan. **Mejlet först, statusen sedan** | Knapp i adminvyn |
| `bjud-in` | Auth-inbjudan till familj utan konto. Ger bara rollen förälder | Adminvyn |
| `lead-notis`, `pass-notis`, `meddelande-notis` | Aviseringar | **Databaswebhook**, `verify_jwt` av, delad hemlighet i header |
| `generate-feedback`, `generate-message` | Claude-utkast. Använder **inte** `service_role`, vidarebefordrar användarens token | Vyerna |
| `material-forslag` | Övningsuppgifter **i klartext, aldrig som länk** | Adminvyn |
| `juridik`, `ekonomi` | Agenter. Läser aldrig ur minnet, läser bara | Adminvyn |

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
| Ikonlänkar och storlekar | `verktyg/satt-logga.py` | `bilder/nextrum-logo.png` |

CI kör om maskotsvaren och FAQ-schemat och gör `git diff --exit-code`.
Ändrar du FAQ:n utan att bygga om blir bygget rött.

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
3. `verktyg/kolla-betalningsvillkor.py`
4. `verktyg/kolla-migrationer.py`
5. `verktyg/kolla-csp.py`
6. Genererade filer är aktuella (bygg om + `git diff --exit-code`)
7. Språkdiff mot baslinjen
8. `deno check supabase/functions/*/index.ts`, `deno test _delad/`

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

- **Betalning.** Fakturor skapas och skickas, men ingen betaltjänst är
  kopplad. `Betald` kryssas i för hand. Utbetalning görs från banken.
- **Google Workspace och Fortnox.** Statusflik finns, koppling saknas.
  `INTEGRATIONER.md` har hela receptet, inklusive fällan att Fortnox
  roterar refresh-token vid varje användning — sparas inte det nya
  blir ni utlåsta om en månad.
- **Bakgrundskontroller.** Godkännandet är en knapp, inte en process.
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
