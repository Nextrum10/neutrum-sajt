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
| `nextrum-admin.js` | Adminvyns **skal**: inloggning, sidomeny, sök, notiser, bevakning och `start()` |
| `nextrum-admin-karna.js` | `NXAdmin`: tillståndet `S`, hjälparna och hämtningarna. **Laddas först** |
| `nextrum-admin-*.js` | Ett område var: detalj, oversikt, kunder, rekrytering, kommunikation, drift, ekonomi, tjanster, system, automationer, ai. Anropar varandra via `NXAdmin.rita` |
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
`agent_korningar`, `agent_steg`, `admin_noteringar`, `foretagsfakta`,
och sedan Fas 5–7: `uppdrag`, `uppgifter`, `audit_logg`, `rut_tak`,
`kund_skatteuppgifter`. Fas 8–9 la till `ai_forslag`, `ai_konfig` och
`handlingar`.

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

**En tjänst får inte vara aktiv och oklar** (Fas 10).
`skydda_tjansteaktivering()` prövar tre INVARIANTER vid varje skrivning
på en aktiv rad — inte bara vid påslaget, annars gick det att aktivera
rätt och sedan tömma priset:

1. tjänsten måste gå att boka eller söka till
2. `for_kund` kräver ett pris — annars fakturerar `_delad/pris.ts:170`
   till läxhjälpens timpris och skriver det på raden som om det vore
   tjänstens eget
3. `extra_personer_max > 1` kräver ett tillägg, annars blir det tyst noll

**Avstängning släpps alltid igenom.** Den är nödbromsen.

Planen sa "pris, ersättning, krav och bokningstyp". Tre av dem gick
inte att koda: `bokningstyp` och `krav` är NOT NULL med förval och kan
aldrig "saknas", och `ersattning = null` är ett BESLUT som betyder
studiehjälparens egen timpenning — läxhjälp är aktiv med null, så ett
ovillkorligt krav hade låst 379-kronorsraden. De tre hör hemma i
lanseringschecklistan i adminvyn, där en människa läser dem.
**Ändras triggern måste spegeln i `nextrum-admin-tjanster.js` följa
med**, annars kommer felet ut som rå servertext.

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
- **Ett CHECK-villkor körs som ANROPAREN, inte som tabellägaren.**
  Dyrköpt i Fas 10: en `revoke execute` på `tjanstkoder_finns`, som
  backar `applications_tjanster_check`, slog sönder hela
  ansökningsvägen med `permission denied`. Ska en funktion som backar
  ett villkor sluta vara nåbar utifrån, FLYTTA den ur `public` i
  stället — schemat `intern` finns för just det, och PostgREST
  exponerar det inte. Ett rullat prov fångade det; utan provet hade
  rekryteringsformuläret tystnat i drift.

  **Flytten fungerar bara för en funktion som INGEN annan funktion
  anropar med namn.** Policyer och CHECK-villkor pekar ut funktionen
  med OID och följer med en flytt; en funktionskropp som skriver
  `public.is_admin()` gör det inte. Provat i en rullad transaktion
  2026-09-21: `is_admin` till `intern` gav `42883` på varje
  uppdatering av profiles, students och bookings, eftersom 25
  funktioner — bland dem alla `skydda_*` — anropar den med namn. Att i
  stället dra in anons EXECUTE på `is_admin` fällde den publika
  tjänstekatalogen, eftersom 39 policyer `TO public` anropar den.
  Advisorns varning för `is_admin` är därför brus att leva med, inte
  ett fel att laga i förbifarten.
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
  handlingens. Ett filnamn heter i praktiken "Avtal Alva Berg 2026.pdf",
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
| `drift` | Tredje agenten (Fas 8). Läser verksamheten och siffrorna, föreslår. Inget utgående verktyg | Adminvyn |

**Två funktioner i drift var aldrig i git:** `notis-ko` och
`notis-avanmal` (båda ACTIVE, `verify_jwt` av). Koden hämtades ur
driften 2026-09-21 och ligger nu i `supabase/funktioner-arkiv/`, med
en README som beskriver exakt vad de gör, vad de läser och vilka
hemligheter de använder. Arkivet ligger med flit utanför
`supabase/functions/`, så att CI och `supabase functions deploy` inte
tar det för levande kod.

**I dag gör de ingenting:** notis-ko svarar 401, eller 500 vid
`notis_hamta` som saknas; notis-avanmal svarar 503 eftersom
`notis_konfig.avanmal_nyckel` saknas. Ingenting anropar dem, och
`pg_cron` är inte installerat. **Men de vaknar halvvägs om någon lägger
till kolumnerna `lage` och `avanmal_nyckel` i `notis_konfig`** — använd
inte de namnen innan det är avgjort vad som händer med funktionerna.
Inget pg_cron-jobb förrän det är avgjort.

`supabase/config.toml` finns sedan 2026-09-20 och sätter
`verify_jwt = false` för de funktioner som webhookar och scheman
anropar. Tas notis-ko eller notis-avanmal bort ur driften ska deras
block strykas ur filen i samma ändring.

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

**Ett prov får inte läsa ett tillstånd som ett tidigare prov har
lämnat efter sig.** Proven körs i ordning i samma transaktion, och det
som ett prov lyckas med står kvar för nästa. De tre kända hålen
(`HÅL 1`, `HÅL 2`) prövades först mot familj Q, men 9.4 har redan
låtit admin matcha Q:s barn — fyra rader blev röda av fel skäl. Proven
har nu en egen familj (R) och kontrollerar sitt utgångsläge. Ett nytt
prov ska dessutom ses gå **rött** med skyddet avstängt innan man litar
på att det är grönt.

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

Övriga poster i Claude-projektets minne (`project-nextrum-oversikt`,
`-sakerhet`, `-databas`, `-sprak-kod`, `-genererat`, `-agenter`,
`-arbetssatt`) står i klartext i `MINNESPOSTER.md` och är sammanfattningar
av den här filen. De är alltså inte en källa: de pekar hit.
