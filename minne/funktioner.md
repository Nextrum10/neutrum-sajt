# Edge functions, agenterna och AI-lagret

Arkivet för avsnitt 7 i `CLAUDE.md`, ordagrant. Reglerna står i kärnan, `CLAUDE.md`. "Den här
filen" i texten är `CLAUDE.md` före delningen, och "avsnitt N" är kärnans.

---

## 7. Edge functions (`supabase/functions/`)

`_delad/` innehåller det som sju funktioner tidigare hade var sin kopia
av — och kopiorna hade hunnit glida isär (två `esc()` escapade inte
apostrofen, två hemlighetsjämförelser använde `===`). **Lägg inte
tillbaka en kopia.**

| Funktion | Gör | Anropas av |
|---|---|---|
| `fakturering` | Månadskörningen: underlag per studiehjälpare, som är studiehjälparens lönespecifikation (2026-09-28), ett fakturautkast per familj som valt faktura (Fas 14.6), och en lista över pass som hölls utan att betalas. Utkastet läggs in i Fortnox för hand. Ett sent pass läggs på sin egen månads utkast (`malmanad`, 2026-10-01) | pg_cron `manadskorning` varje natt sedan 2026-10-01 (`x-nextrum-notis`, alltid förra månaden), admin, eller `x-fakturering-nyckel` |
| `faktura-utskick` | Skickar underlaget till en studiehjälpare. **Mejlet först, statusen sedan.** Fakturor vägrar den sedan Fas 14.6: de skickas från Fortnox | Knapp under Löner |
| `bjud-in` | Skapar kontot åt den som tas in (2026-10-06): en familj, eller med `roll: 'tutor'` en studiehjälpare, med en Auth-inbjudan och `valkommen: 'losenord'`, aldrig ett lösenord. Med `igen: true` en ny inbjudan, eller länken för lösenordet. Rollen vitlistas i funktionen: allt utom `tutor` blir förälder, och en inbjuden studiehjälpare hamnar i väntläge tills admin godkänner | Adminvyn: Ta in familjen, Ta in i poolen, Skicka inbjudan igen |
| `lead-notis` | Avisering till ledningen **och kvitto till familjen** när en intresseanmälan kommer in | **Databaswebhook** `ny-intresseanmalan`, `verify_jwt` av, delad hemlighet i header |
| `generate-feedback`, `generate-message` | Claude-utkast. Använder **inte** `service_role`, vidarebefordrar användarens token | Vyerna |
| `material-forslag` | Övningsuppgifter **i klartext, aldrig som länk** | Adminvyn |
| `juridik`, `ekonomi` | Agenter. Läser aldrig ur minnet, läser bara | Adminvyn |
| `drift` | Tredje agenten (Fas 8). Läser verksamheten och siffrorna, föreslår. Inget utgående verktyg | Adminvyn |
| `notis-ko` | Kö-arbetaren (Runda 2). Tar rader ur `notis_utskick`, renderar och skickar. Får alla sina beroenden inskickade | pg_cron, via `notis_konfig.arbetare_url` |
| `ansokan-notis` | Ett besked till den som sökt jobb (Fas 16.1): kvittot, eller mejlet om ett steg framåt med hela processen och var hen står. Databasen bestämmer vad, funktionen skickar | Triggern `ansokan_besked` och pg_cron `ansokan-besked`, via `notis_konfig.ansokan_url` |
| `admin-paminnelse` | Ett mejl till superadminarna och `info@` (2026-10-02): en jobbansökan direkt (slag `direkt`) eller det som ligger kvar i Att göra kl. 9 svensk tid (slag `morgon`), antal per sort och en knapp, aldrig namn. Databasen bestämmer vad och till vem (`admin_paminnelse_ta()`), funktionen skickar. Samma form som `ansokan-notis` | triggern `admin_ansokan_direkt` och pg_cron `admin-paminnelse` via `intern.admin_paminnelse_koa()`, genom `notis_konfig.admin_paminnelse_url` |
| `ansokan-gallring` | Tar bort ansökningar som inte ledde till anställning och CV-filer utan ansökan när de är ett år gamla (2026-09-27, avsnitt 5). Filen först genom Storage-API:t, sedan raden genom `ansokan_gallra()`, som vägrar medan filen finns. Svarar 500 om något inte gick | pg_cron `ansokan-gallring` via `intern.ansokan_gallring_vack()` och `notis_konfig.gallring_url` |
| `notis-avanmal` | Stänger av EN notistyp i EN kanal utifrån en signerad token. Kan aldrig slå på något | Länken i mejlet, och mejlprogrammets One-Click |
| `stripe-checkout` | Familjens kortbetalning för ETT bekräftat pass. **Hela beloppet till Nextrum**, ingen destination och ingen avgift. Beloppet räknas här, aldrig i anropet. Kassan öppnas i en panel på sidan (Fas 14.5), med Stripes egen sida som reserv. Sedan Fas 16.1 också köpet av en plan eller ett klippkort (`erbjudande` i anropet), med priset ur `erbjudanden_pris`. Sedan Fas 20.1 tar ett genomfört pass den hållna tiden, och `tillagg: true` tar betalt för övertiden på ett förbetalt pass (en egen rad i `pass_tillagg`). Sedan 2026-09-28 också ett pass som valts för faktura och inte står på en faktura än: det står kvar som `faktura` tills webhooken skrivit betalningen. Sedan 2026-10-07 nekar databasen köpet av timmar åt en familj som inte godkänt användarvillkoren (`klippkort_kraver_villkor`); kassan svarar då sitt vanliga fel, och vyn har redan visat rutan | Knappen på passet i föräldravyn, Betala med kort nu på ett fakturapass, och Köp under Erbjudanden |
| `klippkort-betala` | Betalar ett bekräftat pass med köpta timmar (Fas 16.1). Prövar familjens token och flaggan, drar i `klippkort_dra()` och stänger en öppen kortkassa för passet. Med `timbank: true` dras minuterna i timbanken i stället, i `timbank_dra()` (Fas 22.1). Sedan Fas 22.2 betalar timmarna passen av sig själva i databasen, och knappen tar det de inte hann | Betala med timmar och Betala med timbanken i föräldravyn |
| `stripe-webhook` | Enda vägen som får sätta en betalning som betald. Signatur i konstant tid, idempotens via `stripe_handelser`. Ett tillägg (Fas 20.1) bär `tillagg_booking_id` och skrivs, återbetalas och bestrids på sin egen rad | Stripe |
| `stripe-aterbetalning` | Återbetalning till familjen, hel eller delvis. Beloppet tas ur raden, aldrig ur anropet | Återbetala under Betalningar (Att göra, Alla betalningar, Bokslut) |
| `stripe-avstamning` | Hämtar avgift, netto och läge (test eller skarpt) för betalningar som saknar dem (Fas 14.7). Högst femtio per tryck. Skriver bara de kolumnerna | Knappen Hämta från Stripe under Betalningar → Inställningar |
| `stripe-lage` | Frågar Stripe om nyckeln, kontot, kontoutdraget och webhookens händelser, och säger vad som saknas (Fas 14.3). **Läser, skriver ingenting.** Nyckeln lämnar aldrig funktionen, bara om den är test eller skarp | Knappen Kontrollera Stripe under Betalningar → Inställningar |
| `google-koppla` | Kopplingen till Google (Fas 18.1): adressen till Google, återkomsten med engångskoden, Prova och Koppla från. Koden byts mot en nyckel HÄR; vyn ser aldrig nyckeln eller klienthemligheten. Återkomsten bär ingen inloggning och skyddas av ett HMAC-signerat läge som gäller i tio minuter. Ett konto utanför nextrum.se nekas | Knapparna under System → Integrationer, och Googles omdirigering |
| `google-meet` | Meet-länken till ett bekräftat onlinepass (Fas 18.1). Läser passet med anroparens token först, skapar ett öppet rum och sparar länken i `pass_moten`. Ett rum som inte blev öppet sparas inte | Passets sida i föräldravyn och studiehjälparvyn |
| `utbildningsprov` | Provet efter utbildningsmötet (Fas 22.1). Lämnar ut frågorna utan facit, rättar, och sparar försöket genom `utbildningsprov_lamna()`. Skyddet är nyckeln i länken, inte en inloggning. I drift sedan 2026-09-27. Med `prova: true` och adminens token: provläget, som inte sparar något och svarar med facit (2026-10-02) | `/utbildningsprov`, från länken i mejlet, och `/utbildningsprov?prova` från adminvyn |

`supabase/config.toml` bär `verify_jwt = false` för de elva funktioner
som anropas utan inloggad användare. Inställningen satt länge bara i
dashboarden, och en `supabase functions deploy` utan filen hade slagit
på JWT-kravet igen — då svarar triggrarna och arbetaren 401, och
eftersom anroparen är ett schema finns ingen som ser det. **Filen är
sanningen, inte dashboarden.** Lägger du till en funktion utan
inloggning: skriv raden där i samma ändring.

**Driften och main, 2026-09-30.** Varje funktion hämtades ur driften
och jämfördes byte för byte med main (b21df9e). Sju var identiska:
`fakturering`, `notis-ko`, `drift`, `google-koppla`, `google-meet`,
`utbildningsprov` och `ansokan-gallring`. Resten var ÄLDRE i driften än
i main, i sin egen `index.ts` eller i `_delad/`. Det som gör skillnad:
- `stripe-webhook` (v12) saknar 2026-09-29: en tvist äger läget vid
  `charge.refunded`, och ett läs- eller skrivfel kastas så att Stripe
  försöker igen. `stripe-aterbetalning` (v6) nekar inte ett pass i
  tvist. Kärnan och `betalning.md` beskriver båda som om de gällde.
- `notis-avanmal` (v7) har en `typer.ts` utan `timmar_gar_ut`, så
  avanmälningslänken i det mejlet nekas som okänd typ.
- `juridik` och `ekonomi` prövar inte behörigheten först, och
  `generate-feedback` prövar API-nyckeln före behörigheten.
- `lead-notis`, `ansokan-notis` och `faktura-utskick` bär äldre mallar
  (Wint, utan fakturameningen).
**Alla sexton driftsattes samma kväll från main (8bad1d4)**, webhooken
först och kassan sedan, och varje funktion hämtades tillbaka och
jämfördes byte för byte innan nästa gick ut. Versionerna efteråt:
`stripe-webhook` 13, `stripe-checkout` 17, `stripe-aterbetalning` 7,
`klippkort-betala` 4, `stripe-lage` 5, `stripe-avstamning` 2,
`notis-avanmal` 8, `lead-notis` 30, `ansokan-notis` 5,
`faktura-utskick` 21, `juridik` 20, `ekonomi` 21, `generate-feedback`
22, `generate-message` 22, `material-forslag` 8 och `bjud-in` 8.
`verify_jwt` följer `config.toml`. Driften och main var då lika i alla
23; styckena ovan beskriver läget före.
**Efter barnkonton_och_admin, samma kväll**, driftsattes två nya
funktioner från main: `admin-skapa` (v1) och `barn-konto` (v2, med
rättelsen barnkonto_skapas_genom_auth), båda hämtade tillbaka och lika med
main. Därefter skilde driften från main i två saker, och båda var
kända: `notis-ko` (v20) saknade barnadresskollen i `notiser/ko.ts`
(`arBarnadress`), ett andra lager, för databasen tar redan aldrig ut en
barnadress ur kön (`notis_utskick_ta`, provat i `rls-test.sql`). Den gick
ut 2026-10-01, se nedan. Och de andra funktionernas `_delad/auth.ts`
saknar `appMetadata` i `Inloggad` och `harBehorighet`, som ingen av dem
använder.
**`bjud-in` (v7) var tvärtom NYARE i driften än i repot**: den kan
bjuda in en studiehjälpare (`roll: 'tutor'`, eget `TILLBAKA` per roll),
och koden fanns inte i någon gren. Leo samma dag: behåll den. Driftens
`index.ts` är hemtagen ordagrant; `_delad/auth.ts` är repots, för
driftens kopia hade den opinnade `supabase-js@2`. Ingen vy skickar
`roll` än, så i adminvyn bjuds bara familjer in. (Sedan 2026-10-06 gör
Ta in i poolen det; se nedan.)
**`fakturering` version 33, 2026-10-01**: driftsatt från main (7fa4286)
efter PR #167, en månad skapas först när den är slut, och hämtad
tillbaka och lika med main i alla sju filerna. Version 32 hade också den
äldre `_delad/auth.ts` ovan; nu har den mains. Provad mot driften: 401
utan inloggning, och schemats väg torrt gav 200 för september
(`manadenNu` i driftens körmiljö). Spärren själv, 409 för en månad som
inte är slut, är inte provad i driften: den nås bara med en
admininloggning eller `x-fakturering-nyckel`, för schemats väg tar alltid
förra månaden. Regeln den bygger på, `manadenArSlut`, är provad i
`pris_test.ts`.
**`fakturering` version 34, 2026-10-01**: driftsatt från main (847446d)
efter PR #171, passets månad (ett sent pass läggs på sin månads utkast,
`malmanad`), och hämtad tillbaka och lika med main i alla sju filerna;
bara `index.ts` och `_delad/pris.ts` skilde sig från version 33.
Schemats väg torrt gav 200 för september med det nya fältet `vantar`.
Migrationen `manadskorningen_gar_varje_natt` kördes efter funktionen.
**`notis-ko` v21, `notis-avanmal` v9 och `barn-inloggning` v1,
2026-10-01**: driftsatta från main (ffa5b6b) efter PR #175 och
migrationerna `nexlax_for_barnet` och `barnets_epost`, hämtade tillbaka
och lika med main i alla filer (15, 6 och 8). `notis-ko` är 115 kB med
sina beroenden och gick genom MCP, varje fil utskriven; det går, men
jämför md5 per fil efteråt, för ett felskrivet tecken i en kommentar syns
inte i ett prov. Driftens v20 innehöll bara sådant som finns i repots
historik, så ingenting gick förlorat. Provat mot driften med flaggan av:
`barn-inloggning` svarar 400 direkt utan att skriva ett försök, 400 efter
golvet för en teknisk barnadress, 405 på GET och CORS bara för
nextrum.se; `notis-avanmal` skickar GET vidare med 303 och svarar 403 på
en barntoken med fel signatur; `notis-ko` svarar 401 utan hemlighet, så
hela dess modulgraf laddar. En molnsession når inte `*.supabase.co`
(nätpolicyn), så anropen gick från databasen med tillägget `http` i en
transaktion som rullades tillbaka.
Kvar i driften, utan betydelse i sak: `faktura-utskick`,
`generate-feedback`, `generate-message` och `lead-notis` bär
`notiser/typer.ts` från 2026-09-30, utan barnets typer och `kod`, och
`stripe-checkout` bär `_delad/pris.ts` utan faktureringens tillägg (den
importerar bara prisfunktionerna). Driftsätts de av annat skäl följer
mains kopior med. `ansokan-notis` driftsattes 2026-10-06 som v7 från main
(c5e5fe1), med nejet och mejlet till vårdnadshavaren, och lästes tillbaka:
alla tretton filer är byte för byte som main. 2026-10-07 gick v8 ut från
main (43d2ef4), där bara `notiser/ansokan.ts` skilde (sista steget och
välkomsten säger att vi skapar kontot), och lästes tillbaka på samma
sätt. Röktest genom `intern.natanrop`: med hemligheten och ett okänt id
200 utan att något skickades, utan hemligheten 401 från funktionen.

### `pass-notis` och `meddelande-notis` är pensionerade (Fas 14.0)

Båda hade ingen anropare kvar: Runda 2 bytte webhookarna som ringde
dem mot kötriggrar. Beslutet är taget — källan är borttagen ur repot
och raderna ur `supabase/config.toml`.

De är borttagna ur driften också (kontrollerat 2026-09-30: driften och
repot har samma 23 funktioner). Supabase CLI och MCP kan driftsätta en
funktion men inte ta bort den; det görs i dashboarden under Edge
Functions.

Så här ser vägarna ut i dag:

| Tabell | Trigger i dag | Funktion |
|---|---|---|
| `bookings` | `bookings_notis` | `notis_vid_pass` — köar |
| `messages` | `messages_notis` | `notis_vid_meddelande` — köar |
| `barn_meddelanden` | `barn_meddelanden_notis` | `intern.notis_vid_barnmeddelande` — köar (bara barnets meddelanden, till studiehjälparen; barnets_chatt, 2026-10-06) |
| `lesson_reports` | `lesson_reports_notis` | `notis_vid_rapport` — köar |
| `leads` | `ny-intresseanmalan` | `http_request` → `lead-notis` |
| `applications` | `ansokan_besked` | `intern.ansokan_besked` — köar i `ansokan_utskick` och väcker `ansokan-notis` (Fas 16.1) |

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

Samma sak hände utbildningsprovet (Fas 22.1). Migrationerna, jobbet
`utbildningsprov-paminn`, funktionen `utbildningsprov` och
`ansokan-notis` med provstegen driftsattes 2026-09-27 från utkastet i
PR #88, som inte var mergat. I ett dygn låg en trigger, ett schemajobb
och mejlmallar i drift som main inte visste om, och en databas byggd ur
main föll på gallringens migration, som läste provkolumnerna. PR #99
tog hem databasdelen och funktionerna ordagrant 2026-09-28, och sidan
och adminvyns del kom med PR #88. **Driftsätt aldrig från en gren som
inte är mergad.**

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

**Agenternas bild av affären rättades 2026-10-07**: juridik och ekonomi sa
att studiehjälparna är gymnasie- och högskolestudenter (rättat i PR #210),
ekonomi att fakturan var avstängd, juridik ingenting om den, och
`_delad/nextrum-fakta.ts` (drift) att inga fakturor skapas. Fakturan är på
sedan 2026-09-27 (flaggan `faktura`). De tre driftsätts från main efter
merge; tills dess svarar agenterna med den gamla bilden.

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

### `barn-konto` och `admin-skapa` (barnkonton_och_admin, 2026-09-30)
Två funktioner, med det rena i `_delad/barnkonto.ts` och
`_delad/adminbehorighet.ts` och omvärlden som beroenden (samma mönster som
`notiser/ko.ts`), så att varje väg har ett prov.
- `barn-konto`: skapa, byt lösenord, pausa, aktivera, ta bort. Barnet läses
  med ANROPARENS token (RLS), och `parent_id` måste vara anroparen; en admin
  är inte förälder här. Först sedan `service_role`. Kontot skapas med ett id
  som funktionen väljer (`crypto.randomUUID()`) och ett skapandefönster för
  just det id:t, och `createUser` får varken `app_metadata` eller roll:
  GoTrue skriver raden innan den lägger till dem, så databasen skriver dem ur
  fönstret (barnkonto_skapas_genom_auth, 2026-09-30). Lösenordet byts i ett
  fönster på 60 sekunder. Båda fönstren stängs i `finally`, och barnet loggas
  ut överallt efter ett byte och en paus. Inga lösenord i loggen, bara namn,
  kod och status på felet.
- `admin-skapa`: frågar `admin_kan_ge()` med anroparens token innan
  inbjudan, bjuder in med `redirectTo` `https://nextrum.se/admin`, sätter
  profilens `role = 'admin'` och skriver rollen med `gor_till_admin` och
  anroparens token. Nekas rollen tas kontot bort igen. En adress med konto
  får 409 och pekas mot Befintlig användare.
Se `minne/barnkonton-och-admin.md`.

### `bjud-in` tar in personen (2026-10-06)
Leo: "när man ska ta in en anställd är det krångligt att skapa konto åt
den, samma med familj in i poolen". Funktionen skrevs om så att adminvyn
skapar kontot i samma tryck som personen tas in. Det rena står i
`_delad/inbjudan.ts` med omvärlden som beroenden (profilen med adressen,
kontot i Auth, inbjudan, lösenordslänken och anmälan), så att
`inbjudan_test.ts` kör varje väg; `index.ts` är bara admin först
(`kravAdmin`) och beroendena.
- **Ny inbjudan**: 409 om adressen redan har ett konto (det ska användas,
  inte bjudas in igen), annars `inviteUserByEmail` med `role`,
  `full_name` och `valkommen: 'losenord'`, och länken till vyn för
  rollen (`TILLBAKA`). Med `lead_id` blir anmälan kontaktad. Varför det är
  en länk och inte ett gemensamt lösenord står i filens huvud och i
  `minne/sakerhet.md`.
- **Igen** (`igen: true`): rollen tas ur profilen, inte ur anropet; 404
  utan konto och 409 för en roll som inte är förälder eller
  studiehjälpare. Ett obekräftat konto får en ny inbjudan (Auth bjuder in
  ett obekräftat konto en gång till och rör inte metadatan), ett
  bekräftat med `valkommen = 'losenord'` får länken som Glömt lösenordet
  ger, genom Auths öppna väg med den publika nyckeln (429 om ett mejl
  gick nyss), och ett konto med lösenord får 409: då är det Glömt
  lösenordet? som gäller.
- En barnadress (`@barn.nextrum.se`) bjuds aldrig in. Loggen tar namn, kod
  och status på felet, aldrig adressen.
- **I drift sedan 2026-10-07** som v9, från main (43d2ef4, PR #204),
  ihop med `ansokan-notis` v8 (vars mejl om sista steget säger att vi
  skapar kontot) och migrationen `barnets_behorigheter`
  (`DEPLOY-BARNKONTON.md` 9). Båda hämtades tillbaka och jämfördes fil
  för fil med main: lika. Röktest genom `intern.natanrop`: med den
  publika anon-nyckeln som token svarar funktionen själv 401
  (Inloggningen gick inte att verifiera), och utan token svarar grinden
  `UNAUTHORIZED_NO_AUTH_HEADER`, så `verify_jwt` står på. Före det skapade
  v8 kontot utan välkomsten, och Skicka inbjudan igen svarade 409 (v8
  kände inte `igen`).

### `barn-inloggning` (barnets_epost, 2026-10-01)
Ett barn loggar in med sin egen bekräftade e-post. Det rena i
`_delad/barninloggning.ts` (prov: `barninloggning_test.ts`), omvärlden som
beroenden. verify_jwt är av och står i `config.toml`: den som loggar in
har ingen token, så regeln om anroparens token har inget att pröva.
`service_role` används till exakt två funktioner, `barn_inloggning_uppslag`
och `barn_inloggning_lyckades`, och lösenordet prövas av Auth
(`/auth/v1/token?grant_type=password` med den publika nyckeln och den
tekniska adressen). CORS bara för nextrum.se, `no-store` på svaret,
kroppen läst med tak (`lasKropp` ur `notiser/avanmal.ts`). Auth ser
funktionens IP-nummer: `Sb-Forwarded-For` kräver en ny sorts hemlig nyckel
(sb_secret) och en inställning i projektet, och används inte. Samma
ändring rörde `notis-ko` (barnets rader, `notiser/barn.ts`) och
`notis-avanmal` (barnets token); alla tre är driftsatta från main sedan
2026-10-01 (se ovan), och flaggan slås på först efter juristen.
