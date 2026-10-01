# Nextrum — projektminne
Läxhjälpsförmedling i Stockholm: publik sajt på två språk och tre inloggade vyer, statiska filer
mot Supabase, driftsatt på Vercel (`nextrum.se`). Driften står i `START-HÄR.md` och
`DEPLOY-*.md`. Det här är kärnan, som läses i varje session: reglerna och fällorna, kort.
Varför, historien och proven står i `minne/`, som läses när arbetet rör området:
- `minne/grunden.md`: stacken, hela filkartan, språket, arbetssättet
- `minne/affaren.md`: flödet, bokningen, svaren, passets sida, avtal, chatten, ordlistan
- `minne/betalning.md`: siffrorna, kort, faktura, Stripe, hållen tid, bokslut, löner
- `minne/timmar.md`: planer, klippkort och timbanken (Fas 16.1, 21, 22)
- `minne/nexlax.md`: uppgifterna, nivåerna, NexLäx och uppgiftsbanken (Fas 23)
- `minne/vyerna.md`: startsidan, paletten, fällorna i vyerna, adminvyn, tusen rader
- `minne/databasen.md`: tabeller, migrationer, audit, jobb, gallring, radering
- `minne/notiser.md`: notiserna, beskeden till den som söker, utbildningsprovet, mejlens skal
- `minne/sakerhet.md`: säkerheten, inloggningen, samtycket, advisorn, CSP
- `minne/funktioner.md`: edge functions, agenterna, AI-lagret, maskoten
- `minne/genererat-och-ci.md`: genererade filer, sidornas innehåll, CI, `rls-test.sql`
- `minne/barnkonton-och-admin.md`: barnens inloggning, rollen `nextrum_barn`, adminrollerna

**Ändras en regel: ändra kärnan och filen i `minne/` i samma commit**, och `MINNESPOSTER.md` om
regeln står där. `.vercelignore` utesluter `*.md` och `/minne`.

## 1. Affären, i ordning
1. Familjen skickar **intresseanmälan** → rad i `leads` (Nextrum matchar; ingen katalog)
2. Ni ringer och väljer studiehjälpare
3. Familjen skapar konto på `foralder.html`
4. `admin.html` → **Familjer** → välj hjälpare: sätter `matched_tutor_id` och `match_status`
   **samtidigt**. Först då öppnas föräldravyn; före det väntläge
5. Föräldern lägger in barnet, hjälparen skriver studieplanen
- **Uppstartsrutan**: `data-uppstart` och banans vecka byts tillsammans, på båda sidorna; när
  passen börjat går rutan, `nx-har-uppstart` och `nextrum-uppstart.css` bort.
- **Förslag**: inga nya statusar, inga raderade pass, avbokning med fast skäl; en vy ändrar bara
  tid, status och skäl. Tider 11–22 på vardagar och 9–22 på helger (`HELA_DAGEN`), bara i vyn.
  `svar_meddelande` hålls utanför audit, notiser och AI.
- **Ångerrätten** (14 dagar) gäller också köpta timmar, och använda timmar räknas då till
  avtalat pris. Meningen sist i bokningens dagpanel bär undantaget för hållna pass och får inte
  tas bort.
- **Omdömen** hittas aldrig på och visas bara ihop med hur de kontrolleras; alla familjer med
  två rapporter får samma Google-fråga, och `tutor_reviews` blir aldrig publik.
- **Chatten** läser admin med `chatt_las()` (loggat, aldrig cachat), aldrig `NXKontakt.tråd()`;
  att vi kan läsa står i policyn och chatten och tas inte bort.
- **Månader** väljs på passets månad, och ingen väljare börjar före september 2026.
- **Betalning**: kort i förväg, eller kort eller faktura efter passet när rapporten bekräftas;
  ett hållet pass betalas även obekräftat. Ett pass med kortpengar avbokas inte från en vy, ett
  i tvist återbetalas inte, och ett fakturapass står som `faktura` tills webhooken skrivit
  kortet. OCR räknas aldrig fram, och påminnelser tas ut utan avgift.
- **Hållen tid** (Fas 20.1) debiteras per påbörjad kvart; avvikelse kräver skäl, ingen ändring i
  efterhand. Övertid på egen rad (`pass_tillagg`), aldrig passets betalningskolumner. Lönen
  följer tiden nedåt, uppåt bara när övertiden är betald.
- **En stängd månad** (Fas 20.2) är låst i databasen, också för admin, tills den öppnas.
- **Betalningar, Månadens ekonomi och Löner** räknar på `betalningsrader()` och
  `NXBetalning.passpris`, så en månad har ett belopp; testbetalningar räknas aldrig. En månad
  skapas först när den är slut: `fakturering` nekar en som pågår med 409, och rutan låter bara
  torrköra den (2026-10-01). Ett pass hör till EN lönemånad och EN faktura: sin egen månads
  så länge den är ett utkast, och körningen går varje natt och lägger sena pass där
  (`malmanad`, `NXBetalning.lonemanad`); Godkänd och Lagd i Fortnox sparas bara om beloppet är
  det som visades. PAXml tar bara godkända, inte
  utbetalda underlag och är inte provläst i Fortnox. Personnummer, bankkonto och skatt står i
  Fortnox, aldrig här, och lönespecen räknar inget och drar ingen skatt. **Timpenningen är
  inklusive semesterersättning** (2026-10-01): filen lägger inget på, och Fortnox får inte heller
  (löneart som inte är semestergrundande, ingen semesterersättning inställd på personen).
- **Timmarna**: `bookings_timmarna_tillbaka` är den SISTA before-triggern på `bookings`
  (namnordning), och klippkortets triggrar rör inte `skydda_bokningsfalt`. Timmen dras bara i
  `klippkort_dra()`, när förslaget skapas, och kommer tillbaka vid nej, avbokning eller
  obesvarat förslag. `timmar-betalar` väntar aldrig på ett lås. Timbanken fylls bara av köpta
  timmar och går inte ut. Vid ånger eller uppsägning: avboka först allt kommande.
- **NexLäx**: rättningen sker i databasen; frågorna går ut utan facit, försök och svar har ingen
  skrivpolicy, och en digital uppgift bockas inte av för hand. Stjärnor, serie, märken och XP
  sparas aldrig; XP:s regler står bara i `intern.nexlax_*`, och XP minskar aldrig. Upplåsningen
  är en spelregel. Belöningar är märken, inte pengar, och serien påminns aldrig om: båda är
  beslut. `.nl-hopp` går med flit inte att trycka på.
- **Tipskoder** (2026-09-30): en kod per familj och godkänd studiehjälpare (`mina_tips()`) och
  en kampanjkod per affisch; `leads.kod`. Koden syns i formuläret och lagras aldrig i
  webbläsaren, och en okänd kod fäller aldrig anmälan. Tipstimmen är `startrabatt` med
  `rabattkod = 'TIPS'` (raden i `rabattkoder` blir aldrig aktiv): en per ny familj som haft sitt
  första pass, och intjänad ges den också med flaggan `tipstimme` av. Studiehjälpare får ingen
  ersättning, med flit. Den som tipsat ser antal, aldrig vilka. `/affisch` tar ingen fritext ur
  adressen, och QR-koden går till formuläret, inte till en områdessida.
- **Frågorna**: talregeln i `intern.niva_tal` och i Pythons `grund.lika()` ändras tillsammans.
  En fråga med svar tas aldrig bort, en ändrad får nytt id. De skrivs från grunden mot Lgr22,
  aldrig ur nationella prov, och ska förstås ensamma. Nytt läggs sist i en bana som används.
- **Barnkontona** (2026-09-30): ett barnkonto är ett användarnamn och ett lösenord, inget mer.
  Varje inloggning tar e-post eller användarnamn (`NXStudie.loggaIn`, 2026-10-01): med @ en
  vuxen, utan @ ett barn, som hamnar på `/barn`. Adressen `<namn>@barn.nextrum.se` finns bara
  för att Auth kräver en, nekas i inloggningen och tar aldrig emot mejl. Bara föräldern skapar, pausar och tar bort
  inloggningen, genom `barn-konto`. Barnet kan inte boka, avboka, svara eller ändra något utöver
  NexLäx och bocken på en vanlig uppgift (`nexlax_for_barnet`, 2026-10-01), och ser aldrig
  priser, betalningar, erbjudanden eller föräldern; timmarna är genomförda och bokade pass,
  aldrig timbanken. NexLäx görs i barnets vy och i familjens inloggning, med samma rader.
- **Barnets egen e-post** (`barnets_epost`, 2026-10-01; flaggan `barn_epost` står AV tills
  juristen läst): föräldern lägger till den, barnet bekräftar den med en knapp, och först då
  används den, till inloggning (`barn-inloggning`) och, om föräldern slår på det, till mejl om
  bokat, avbokat och påminnelse. Den står i `barn_epost`, aldrig i Auth, och ingen inloggad når
  tabellen. Föräldern styr adressen, mejlen och lösenordet; barnet väljer bara bort sorter.
  Ta bort och stäng av går alltid, också med flaggan av.
### Ordlistan (använd den, i kod och i text)
| Ord | Betyder |
|---|---|
| studiehjälpare | den som håller passet; aldrig "lärare" utåt; syns publikt först som Godkänd |
| pass | ett bokat tillfälle (`bookings`), hela timmar, 1–3 |
| rapport | `lesson_reports`; **passet är genomfört först när rapporten finns** |
| underlag | vad studiehjälparen ska få (`payouts`) |
| betalning | vad familjen betalat för ett pass (`betalning_status`, `betalt_ore`) |
| faktura | `invoices`: betalsätt per pass efter passet, skickas från Fortnox |
| tjänst | rad i `tjanster`; `aktiv` avgör vad som syns |
| uppgift | det eleven gör mellan passen (`homework`); i adminvyn att göra-listan |
| nivå | 5–12 frågor i en bana (`nivaer`); Mästarprov och repetition drar ur banan |
| NexLäx | studievyns sektion för banan (`nexlax`, `NXUppgifter`) |
| motförslag | en annan tid på samma pass (`motforslag_at`), ja eller nej; ett avslag är `cancelled` |
| XP | poäng ur svaren och försöken, aldrig sparade |
| tipskod | en familjs eller studiehjälpares egen kod i intresseanmälan (`tipskoder`); en kampanjkod är en affischs |
| tipstimme | en timme på köpet för ett tips: `startrabatt` och `rabattkod = 'TIPS'` på passet |
| barnkonto | barnets egen inloggning (`students.user_id`, `app_metadata.roll = 'barn'`, rollen `nextrum_barn`) |
| superadmin | admin med allt (`admin_roller.ar_superadmin`, `is_admin()`); andra admins har behörigheter (`har_behorighet()`) |
### Siffror som måste stämma överallt
- **379 kr/tim** (`PRIS_PER_TIMME`); **69 kr/tim** för fler barn, fast (tre barn: 448, inte
  517).
- Betalnings- och fakturameningen står på 36 ställen i 23 filer och i mejlen, och
  `kolla-betalningsvillkor.py` räknar dem. **En betalning som tas på ett annat sätt än villkoren
  lovar är en tvist, inte ett skrivfel.** Slås `faktura` av går meningen och `FAKTURA_I_TEXTEN`
  samtidigt. `BETALNINGSVILLKOR_DAGAR` (tio dagar) står på två ställen.
- **Den 25:e** lön för månadens rapporterade pass. Erbjudandenas priser står bara i
  `erbjudanden_pris`. Priset fryses vid bokningen. Första timmen är på köpet (`startrabatt`,
  och tipstimmen är samma rabatt); ett pass på noll kronor är INTE betalt. Belopp i **ören**, kronor först vid visning.

Detaljer: `minne/affaren.md`, `minne/betalning.md`, `minne/timmar.md`, `minne/nexlax.md`.

## 2. Stacken
**Inget byggsteg, ingen pakethanterare, inget ramverk.** Filerna i roten serveras som de är, och
`supabase-js` är vendorad i `bibliotek/`. Vanilla JS i `<script src>`, moduler som IIFE:er på
`window` (`NX`, `NXStudie`, `NXArbete` och de andra `NX*`). Supabase (Postgres, RLS, Auth,
Storage) och Deno edge functions. Vercel med `cleanUrls: true`; botten ska inte kommentera
PR:er, och repository_dispatch ska stå på, för IndexNow lyssnar. Mejl genom Resend. Modeller
från Anthropic, bara i edge functions. Lokalt: `python3 .claude/serve.py 8951`.

Detaljer: `minne/grunden.md`.

## 3. Filkartan
- `nextrum-config.js` är enda filen som ändras vid uppsättning; `nextrum-fel.js` laddas före
  `nextrum-app.js` (`NX`); bildvägar står bara i `nextrum-images.js`; `nextrum-samtycke.js` bara
  på öppna sidor. `nextrum-modulvakt.js` prövar en funktion per fil i alla fyra vyerna, moduler
  nås som identifierare (aldrig `window[...]`), och en ny `nextrum-admin-*.js` ska in där.
- Delat: `nextrum-studie.js` och syskonen; vyerna `-studie-vy`, `-larare-vy`, `-barn-vy` (bara NX,
  NXStudie och NXUppgifter) och `nextrum-admin.js`, med `-admin-karna.js` först och ett område per
  `-admin-*.js`; `-admin-behorighet.js` avgör vad en admin med behörigheter ser.
- CSS: `nextrum.css`, `-home`, `-cinema`, `-vy`, `-arbetsyta`, `-agent`. **Cinema är
  sanningen**; `-vy`, `-agent` och `-typsnitt` har inga hexkoder. Papperet (`#F2EDE3`) tar
  `theme-color` med sig, men mejlens `FARG` ändras för sig. Adminpaletten laddas sist.
### Startsidan efter hero
Hero är orörd med flit; startlägen gömmer inget utan `html.nx-sr`. Telefonens hero-film görs om
när originalet byts och provas som VP9. Mörka ytor glider in med `.nx-framme`, aldrig `.nx-in`.
Studievyns markup kopieras till `for-elever-och-foraldrar.html` (`jamfor-sprak.py` ser bara
första skillnaden). **Skriptet sätter klasser, CSS rör sig**: ingen stil per bildruta, ingen
animerad `box-shadow`, och en custom property sätts där den läses, för den ärvs.
1. En `once`-scen är klar först när `run()` svarar annat än `false`.
2. `preserve-3d` i en rullbar behållare ger fel `elementFromPoint`.
3. `scrollIntoView` i en rad som flyttas med transform rullar sidan; bandet är `overflow:clip`,
   och kanterna tonas med gradienter, aldrig `mask-image` (Safari).
4. Det som fälls ut i bandet klipps.
### Två fällor när en palett byts
Den dag någon sätter `--pap`, `--bl` eller `--acc` på en vy: (1) en alias-token på `:root`
fryser rotens värde, så hela mängden aliaser upprepas; (2) mörkerreglerna väger (0,4,0).
`--acc-lugn` är hovringens accent, ingen felfärg.
### Fyra fällor som gör vyerna hackiga
Safari har ingen scroll anchoring: prova som en telefon. Tryck och hovring rör sig med `scale`,
aldrig `transform`, `translate` eller ändrad storlek; `[aria-pressed]` animeras inte; iPhones
`:active` kräver touch-lyssnaren i `nextrum-studie.js`; `aria-busy` stoppar bara musen, så
knappen stängs med `NXStudie.medan()`.
1. **Byt aldrig en lista som har innehåll mot "Hämtar"**: `NXStudie.laddarFörsta`, `håll` och
   `hållLista` (ankaret är chipraden); visa det nya innan det gamla går.
2. **`1fr` är `minmax(auto,1fr)`**: skriv `minmax(0,1fr)`.
3. **Det som rör sig kostar**: ingen video under 700 px, inget `backdrop-filter` på sidhuvudet,
   ingen mjuk scrollning i vyerna.
4. **Det som står ovanför det man trycker på får inte byta höjd**: reservera höjden och håll det
   tryckta med `stilla()` och `NXStudie.håll`.
### Innehållet i studievyn och studiehjälparvyn
Lägets färg säger vems drag det är: lera ert drag eller fel, ockra väntar, mossa klart (tokens i
cinemas `:root` och båda mörka blocken); som serier skiljs de inte åt av färgblinda, och
ämnesfärgerna finns bara i NexLäx. Ett drag överst, en knapp per listrad, tid och plats genom
`NXKontakt.passRad`, betalvalen i `.vy-betalval`. En månadsrad i en dold sektion har bredden
noll; adminvyns rader har varje månad. **Tummen**: tryckytor minst 44 px, och `::after` provas
med `elementFromPoint`.
### Adminvyns skal
Samma hus som de andra vyerna: KÄNSLAN och INNEHÅLLET står på `.vy` och adminvyn har inga egna
ytor; ändras de andra vyerna oväntat är specificiteten första stället. Menyn är en egen rullyta
som `sidomeny()` drar, aldrig sidan, och en lång etikett får bryta; `täcktÖverst()` räknar
toppraden. `.btn-sm` är liten bara som `.vy-admin main .btn-sm`; Att göra är bara vårt drag.
Fällor: `h5` och `h6` har webbläsarens marginal; `--pap-2` och `--yta` är nästan samma i mörkt
läge (`--tint`, `--bricka`); KÄNSLAN står sist och väger lika mycket; `nextrum-admin-konsol.css`
vinner över arbetsytan. Headless Chromium döljer rullningslister; mät ett tryck med `el.click()`
i sidan och `getBoundingClientRect`.
### Tusen rader
PostgREST lämnar ut högst tusen rader utan att säga det. **En lista som växer hämtas med
`NXStudie.hämtaAlla`** (adminvyn: `hämtaAlla`): sida efter sida tills `count`, sorterad på en
unik nyckel; ett fel ger felet, aldrig en halv lista. En `.limit()` över tusen är tusen.

Detaljer: `minne/grunden.md` (filkartan), `minne/vyerna.md`.

## 4. Språk
**Koden är svensk**: identifierare, kommentarer, commits, filnamn, kolumner. `/en/` är genererad
ur de svenska sidorna, textnod för textnod.
1. Generatorn översätter aldrig `<script>`: text från JavaScript ligger som par i `ORD`
   (`NX.t()`, `ord()`), med språket ur `<html lang>`.
2. Det som skrivs till databasen förblir svenska.
3. Generatorn finns inte i repot: engelskan följer med för hand, och `jamfor-sprak.py` vaktar.
4. Baslinjen har bara avsiktliga avvikelser; allt nytt är ett fel.

Detaljer: `minne/grunden.md`.

## 5. Databasen
**Sanningen om vad som är kört står i databasen** (projekt-ref `ddkfiuvcppalutfulvbi`):
`select version, name from supabase_migrations.schema_migrations order by version;`
- Ny SQL: `supabase/migrations/<version>_<namn>.sql` med den version `apply_migration`
  registrerade (`kolla-migrationer.py`). **Klistra aldrig in SQL i SQL Editor utan att den blir
  en fil.** Migrationen körs efter merge, och vyerna tål att den saknas.
- `arkiv/` ändras aldrig; en rättelse är en ny migration. `schema-v22.sql` kördes aldrig, kör
  den inte. `schema.sql` rensar tabellerna.
- **Flera sessioner** kör mot samma databas: läs driften, inte grenen. Lappa en funktion med
  `replace()` på `pg_get_functiondef()` och en vakt som räknar träffarna; läs vyns kolumner i
  driften före `create or replace view`.
- **Auditloggen** går inte att ändra, inte ens för admin, och loggar bara vitlistade kolumner,
  aldrig namn eller fritext; en läsning den berörda inte märker loggas av funktionen som läser.
  Sök med `audit_sok()`; AI-märkningen läses inte ur `aktor_typ`.
- **Triggrar på samma händelse körs i namnordning.** En `UPDATE OF`-trigger ser bara kolumnerna
  i själva UPDATE:n, inte dem en BEFORE-trigger ändrar.
- **Ring aldrig `net.http_post` direkt**, bara `intern.natanrop(mal, …)`. Schemat `intern` är
  databasens egna funktioner, inget API.
- En tjänst får inte vara aktiv och oklar (`skydda_tjansteaktivering`); avstängning släpps
  alltid igenom; spegeln i `nextrum-admin-tjanster.js` följer triggern.
- `kortsparr` kan inte slås på; går villkoren tillbaka till betalning före passet tas villkoret
  bort i samma migration som texterna.
- Biblioteket är kurerat: `delad` slås inte på nerifrån, en länk är http(s), `bibliotek_id`
  pekar och kopierar inte, och `NX.ARSKURSER` speglar villkoret. Material når familjen bara
  genom en läxa, och `materials` (vårt eget underlag) städas inte bort.
- Maskiners uppgifter går genom `skapa_uppgift()` med nyckel; kontrollerna är med flit inte
  schemalagda, och schemaläggs de ska texterna säga det. Analysvyerna: genomfört är
  `har_rapport`, varje rad bär `underlag_rader`, och luckor redovisas i stället för att fyllas.
- Ett schema som står av ser ut som ett som fungerar: jobben syns under System → Automationer,
  utan sina kommandon. Flyttas `manadskorning` flyttas `manadskorning-svar` med.
- **Gallringen**: lagringstiderna hålls av databasen (`DATASKYDD.md` är registret). Anmälningar
  avidentifieras, konton raderas aldrig av sig själva, ett jobb som fastnat blir en uppgift, och
  `landningssida` bär bara våra utm-taggar. Ett nytt rekryteringssteg med tidsstämpel ska in i
  `intern.ansokan_gallras_fran()`.
- **Adminrollerna**: sanningen är `admin_roller`, och `profiles.is_admin` speglar superadmin.
  `is_admin()` är superadmin och `har_behorighet()` resten; en ny adminpolicy väljer en av dem.
  Reglerna står i triggern `admin_roller_vakt`, och `admin_logg` går inte att ändra.
- **Barnets roll** `nextrum_barn` har inga tabellrättigheter; en ny tabell eller vy ger den
  ingenting, och en ny barnfunktion hittar barnet med `intern.mitt_barn()`, eller med
  `intern.mitt_aktiva_barn()` när en pausad inloggning inte ska kunna göra den. **GoTrue skriver
  raden i `auth.users` före `app_metadata`**: ett barnkonto skapas bara genom ett fönster som
  `barn-konto` öppnar för kontots eget id, och lösenordet byts bara i ett fönster
  (`barn_andringsfonster`). Databasen skriver tillbaka barnets `app_metadata`, spärrar adress
  och återställning, och håller `*_sent_at` år 2999 så att Auth aldrig mejlar ett barn. Prova
  i GoTrues ordning, aldrig med raden färdig i en INSERT.
- **Rätta och radera en person** i adminvyns panel (`radera_person()`), **aldrig i
  dashboarden**: `bookings.parent_id` är ON DELETE CASCADE. Databasen väljer helt eller
  avidentifierat och vägrar medan pengar inte är uppgjorda eller filer finns kvar. Ett
  adminkonto raderas inte där, och e-posten ändras inte i Redigera (profiles följer inte Auth).
### Notiserna
- Trigger → `intern.notis_skapa()` → `intern.notis_koa()` → `notis-minut` → `notis-ko` → Resend.
  `notiser_mejl` är strömbrytaren (av och trasigt ser likadana ut); `loggad` är slutläge.
- Ingen får en notis om sin egen åtgärd. Mallarna ser bara `RenData`, varje namn och ämne går
  genom `fornamn()`, och `rapport` mejlas aldrig. Typlistorna i databasen och i `typer.ts`
  ändras tillsammans. En saknad rad i `notis_val` betyder PÅ, avanmälan skriver bara där, och
  länken i mejlet kan aldrig slå på något och har med flit ingen utgångstid.
- Barnkontots tekniska adress får aldrig ett mejl: `notis_utskick_ta` och `notis-ko` hoppar
  över `@barn.nextrum.se`, och barnets notiser står i `barn_notiser`. Ett barns egen bekräftade
  adress får mejl bara som en rad med `barn_id` (aldrig `mottagare`), som `notis_utskick_ta`
  prövar igen när den ska gå; barnets mallar (`barn.ts`) har aldrig pris, betalning eller skäl,
  bekräftelsen hälsar inte med namn och har ingen avanmälan, och barnets avanmälningstoken har
  fem delar, så den aldrig kan läsas som en vuxens.
- **Sätt sandlådan innan du provar något som köar.** Ett gammalt anrop utan pg_net-svar är inget
  fel. Mejlens papper står på `body` och som `bgcolor`; loggans `.gitignore`-undantag står kvar.
- Till den som söker: bara kvittot styrs av en INSERT, möteslänken är https, ett steg mejlas en
  gång, ett nej skrivs av en människa, och Godkänd i rullgardinen är inte Ta in i poolen.
  Provets facit finns bara i funktionen, resultatet visas per avsnitt, fel svar är lika
  utförliga som rätt, nyckeln hamnar aldrig i en logg, och ändras handboken läses frågorna om.

Detaljer: `minne/databasen.md`, `minne/notiser.md`.

## 6. Säkerhetsmodellen
Inte förhandlingsbar. **Allt skydd ligger i RLS, ingenting i gränssnittet**: adminvyn hämtar med
samma anon-nyckel, och `is_admin` i klienten visar bara rätt sida.
- Ändras vad som sparas, till vem eller hur länge: ändra `DATASKYDD.md` och integritetspolicyn
  på båda språken i samma ändring. `_delad/minimera.ts` och `maska_kontakt()` har samma regler.
- anon-nyckeln är inte hemlig. **`service_role` får aldrig in i en klientfil**, och **i en edge
  function prövas anroparens token mot Auth och RLS innan `service_role` används**
  (`_delad/auth.ts`; uppfinn ingen ny väg).
- **Ett CHECK-villkor körs som anroparen**: revoke aldrig en funktion som backar ett villkor,
  flytta den till `intern`.
- RLS begränsar inte kolumner: `is_admin`, `matched_tutor_id`, `status` och bokningsfälten
  vaktas av triggrar. Admin ges under System → Adminhantering (`gor_till_admin`, `ta_bort_admin`,
  `admin-skapa`) eller med SQL (`is_admin = true` blir superadmin); ingen vy skriver `is_admin`,
  ingen ändrar sin egen roll, och ett barn blir aldrig admin. En policy som nekar för mycket ser
  ut som en tom lista, inte som ett fel.
- En funktion som svarar om en PERSON har `is_admin`s vakt på första raden. Supabase ger varje
  ny funktion EXECUTE som förval; en triggerfunktion ska inte ha den.
- `invoices` och `payouts` har ingen INSERT-policy och `integrationer` ingen skrivpolicy;
  `google_koppling` ser ingen inloggad; delade avtal läses genom `mina_handlingar()`.
  Notishemligheten står i `notis_konfig`, inte i en secret.
- Rå servertext visas bara i de inloggade vyerna; en återvändsgränd bär `{oss}`. Anonyma
  skrivningar har tak, och deras `created_at` sätts av databasen.
- Hinkarna är privata och sökvägen är ett uuid, aldrig ett namn. I `cv` ändras `CV_RAD` och
  `NX.kopplaAnsökan` tillsammans, liksom sökvägens form och policyn.
- **Filen först, raden sedan, och läs svaret.** En fil öppnas i samma tryck
  (`NXMedia.öppnaFil`): Safari stoppar ett fönster som öppnas efter en väntan.
- **Inloggningen i vyerna**: logga ut med `scope: 'local'` (`NXStudie.loggaUt()`); ut överallt
  görs i databasen. `NXStudie.vaktaInloggningen()` byter en utloggad vy mot inloggningen.
  "permission denied" eller tomma listor: titta i API-loggen först. **Glömt lösenordet**:
  länken leder tillbaka till vyn där man bad om den, `type=recovery` och `type=invite` läses
  innan klienten skapas, rutan för lösenord väntas in före rolldirigeringen (också för en
  inbjudan, i alla tre vyerna), och beskedet är detsamma oavsett om kontot finns.
  Kontomejlen skickas av Supabase Auth (Googles SMTP som info@), med mallarna i
  `minne/sakerhet.md`; deras länk går genom knappen på `/lank`, aldrig rakt till Auth.
- **Samtycket**: öppna sidor sätter inga cookies; det som kräver samtycke går genom
  `NXSamtycke`, och rutan visas bara när något i `SAMTYCKE` är på (av sedan 2026-09-29). Dölj
  den aldrig med CSS medan skripten går. Vercels statistik laddas först efter ja, aldrig med
  statisk tagg; okänd källa är `null`, aldrig "direkt"; Global Privacy Control är nej; ja och
  nej är samma sorts knapp; klasserna heter `nx-kakor-*`. Ändras lagringen följer `lagring.html`
  med; före ett pixel-id, se `minne/sakerhet.md`.
- **Advisorn** larmar om det som är med flit (listan i `minne/sakerhet.md`). Läckta lösenord
  kontrolleras inte, och `kolla_rabattkod` får ett tak med den första koden.
- **Content-Security-Policy**: `/admin`, `/larare`, `/barn`, `/lank` och `/foralder` har `script-src 'self'`,
  alltså **ingen inline-JavaScript** där (`kolla-csp.py`). `/foralder` släpper in Stripe, som
  aldrig vendoras. **Två skarpa CSP-rader får aldrig matcha samma sida.**

Detaljer: `minne/sakerhet.md`.

## 7. Edge functions (`supabase/functions/`)
- Det delade bor i `_delad/`: **lägg inte tillbaka en kopia**. `verify_jwt = false` står i
  `supabase/config.toml`, inte i dashboarden; en ny funktion utan inloggning får sin rad där
  samtidigt.
- Belopp räknas i funktionen, aldrig ur anropet, och en nyckel lämnar aldrig funktionen. Bara
  `stripe-webhook` sätter en betalning som betald och skriver `betalt_ore` (`begart_ore` är det
  begärda); den kastar varje fel så att Stripe försöker igen, och en tvist äger läget. Kassan
  tar bara kort, `faktura-utskick` skickar mejlet före statusen, och `google-meet` sparar bara
  öppna rum.
- `apply_migration` och `functions deploy` ändrar driften direkt: commit:a i samma arbetspass,
  och **driftsätt aldrig från en gren som inte är mergad**. Driften var 2026-09-30 ÄLDRE än
  main i 16 av 23 funktioner; alla driftsattes samma kväll, och `notis-ko`, `notis-avanmal` och
  `barn-inloggning` 2026-10-01. Ingen skiljer i sak från main: en äldre kopia av en delad fil
  saknar bara tillägg som funktionen inte använder (`minne/funktioner.md`).
- `barn-konto` prövar föräldern och `admin-skapa` skriver rollen med anroparens token; bara det
  Auth kräver görs med `service_role`, och ett barnkonto skapas aldrig utan vårdnadshavarens ja.
  `barn-konto` väljer barnkontots id och ger Auth varken `app_metadata` eller roll: det skriver
  databasen, ur fönstret.
- `barn-inloggning` (verify_jwt av) är en inloggning, inte en anropare med token: den slår upp
  barnets tekniska adress med `service_role` och låter Auth pröva lösenordet. Samma svar och
  minst 0,9 sekunder för varje nej; databasen räknar försöken som HMAC. Ett vuxeninlogg som
  får "fel lösenord" provas också som barnadress (`NXStudie.loggaIn`).
- **Agentregeln**: hårt stegtak, källtvång i kod, bara verifierade `kallor` klickbara (aldrig
  med regex), `ekonomi` skriver aldrig, och agenterna läser källan, aldrig ur minnet.
- **AI-lagret**: `drift` har inget utgående verktyg, och ingen AI-väg skriver i affärstabeller
  (rollen `nextrum_ai`). AI:n formulerar aldrig en nyckel eller en titel; `godkann_forslag()`
  utför med adminens token, en gren per typ, aldrig `update <tabell> set <payload>`. Databasens
  svar märks för modellen, domänspärren gäller efter varje omdirigering, analysvyerna nås bara
  genom omslag med fast kolumnlista, och `material-forslag` ger aldrig länkar. Maskoten har
  ingen modell, och provbänken `_prov-admin-*` checkas aldrig in.

Detaljer: `minne/funktioner.md`.

## 8. Genererade filer — ändra aldrig för hand
Byggs av `verktyg/`: `bygg-maskotsvar.py`, `bygg-faq-schema.py`, `bygg-omradessidor.py`
(`laxhjalp-*`, guiderna, navets kort), `bygg-sitemap.py` (`lastmod` ur texten), `satt-logga.py`,
`bygg-banken.py` (för hand), `bygg-webp.py` (inte i CI; `kolla-webp.py` vaktar) och
`bygg-uppgifter.py --sql` (alltid en ny migration). **`satt-version.py` körs SIST.** Sidorna
säger bara det som är sant: inga antal, betyg, betygshöjningar, okontrollerade skolnamn eller
kursnamn med årtal; en guide länkar det den påstår, och dess författare är Nextrum. En adress
som stått i kartan blir aldrig en 404. Förladda inte typsnittet utan att mäta.

Detaljer: `minne/genererat-och-ci.md`.

## 9. CI — `.github/workflows/kontroll.yml`
Varje push och PR, och lokalt före push: `node --check`, `testa-agent.js`,
`kolla-betalningsvillkor.py`, `kolla-migrationer.py`, `bygg-uppgifter.py --kolla`,
`kolla-csp.py`, `kolla-behorigheter.py`, `kolla-webp.py`, `satt-version.py --kolla`, de genererade filerna
(`git diff --exit-code`), språkdiffen (också attributnamn), `deno check` och `deno test`.
- `node --check` ser bara syntax; ett namn som inte hämtats ur `NXAdmin` smäller vid körning.
- `indexnow.yml` är ingen kontroll. Nyckeln står i roten och i `verktyg/indexnow.py`: byt båda.
  Den tar `success`, aldrig `promoted`, och checkar ut den driftsatta commiten, så en ändring i
  den går inte att prova på en gren; en utebliven körning syns bara i Actions.
- **`verktyg/rls-test.sql`** körs inte i CI. Kör HELA filen som ett anrop efter varje ändring i
  en policy eller trigger; varje rad ska vara ok. Den slår upp triggrar på funktionen, har
  flaggan `erbjudanden` av, och en fixtur syns för resten av filen. Lokalt först, med
  `verktyg/lokal-databas.sh` (`STOPP=`); driften i en transaktion som rullas tillbaka, hämtad
  med tillägget `http` från en commit.
  I en molnsession: `dockerd &`, och Deno ur npm med en importkarta (`minne/genererat-och-ci.md`).

Detaljer: `minne/genererat-och-ci.md`.

## 10. Arbetssätt
Commits är svenska och beskriver följden ("Fas 2.5: en faktura skickas bara en gång"); följ
fasnumreringen. Kommentarerna förklarar varför, inte vad. `bilder/*.png`, `.claude/skills/`,
`.agents/` och `skills-lock.json` är gitignorerade och finns ingen annanstans. En
Claude-artefaktlänk kan aldrig prata med Supabase: testa mot riktiga filer.

Detaljer: `minne/grunden.md`.

## 11. Vad som inte är byggt
- **Skarp kortbetalning**: bara testläge. Stripes endpoint behöver `charge.updated` och
  `charge.dispute.updated`; före första skarpa betalningen kopplas Stripe till Fortnox.
- **Fakturan** är på, men bolaget, bankgirot, beskedet till befintliga familjer och
  provfaktureringen återstår (DEPLOY-BETALNING.md 9.11); när bolaget är registrerat ändras
  villkoren och integritetspolicyn. Spärren "ingen betalning, inget pass" kan inte slås på.
- **Timmarna**: provköpet (DEPLOY-BETALNING.md 9.12) är ogjort. Leos testköp står kvar med
  sina timmar till kortets sista dag, och är sedan 2026-09-30 märkt som test igen
  (`stripe_skarp = false`): det räknas inte längre som intäkt.
- **Skatt och anställning av minderåriga**: `studiehjalpare_form = oklart`; revisor före första
  utbetalningen. Övertid betald efter den 25:e når inte lönen.
- **Obetalda pass på månadens faktura av sig själva** är beslutat (2026-10-01), inte byggt: en
  villkorsändring på alla 36 ställen och i mejlen, i en egen PR (`minne/betalning.md`).
- **Med flit inte**: en Fortnox-koppling, en avbokningsavgift, en frist för betalning efter
  passet (`ej_betalt` larmar direkt). **Att säga till** familjer och studiehjälpare: om
  villkorsändringarna och om att vi kan läsa chatten, och familjerna om barnens inloggning
  (integritetspolicyn, 2026-09-30).
- **Affischerna** (2026-09-30): tipskoderna och `/affisch` är i drift; att sätta upp dem enligt
  `AFFISCHKAMPANJ.md` återstår.
- **Barnkontona och adminbehörigheterna** är i drift sedan 2026-09-30 (båda migrationerna,
  `barn-konto` v2, `admin-skapa` v1), och barnets hela kedja är provad mot riktiga Auth. Kvar
  (`DEPLOY-BARNKONTON.md`): tre Auth-inställningar (Redirect URL för inbjudan är redan rätt),
  null-MX:en i Cloudflare, en skarp inbjudan genom `admin-skapa`, och att säga till familjerna.
  En admin med behörigheter ser rätt sektioner, men knapparna i dem är superadminens; databasen
  säger nej.
- **Barnets egen e-post** (2026-10-01) är i drift men inte på: migrationen och de tre
  funktionerna gick ut samma dag, och flaggan `barn_epost` står av tills juristen läst policyn,
  registrets rad 22 och konsekvensbedömningen; sedan ett prov i sandlådan
  (`DEPLOY-BARNKONTON.md` 8). Adminvyn visar inte barnens inloggningar, och inte adressen.
- **Kontomejlen**: mallarna klistras in i Supabase för hand. `/lank` skyddar länken mot
  mejlfilter som öppnar den, inte mot ett som trycker på knappar; ingen kod i stället för
  länken (`minne/sakerhet.md`).
- Adminvyn har ingen vy över nivåerna, och banken är skriven med AI
  och inte läst av en lärare. Delade dokument: ingen notis, ingen underskrift, en person per
  handling. Inte heller: Google Workspace (Meet), bakgrundskontroller, riktiga foton.

Detaljer: `minne/betalning.md`, `minne/timmar.md`, `minne/nexlax.md`, `minne/affaren.md`, `minne/notiser.md`.

## 12. Minne som inte finns i repot
**`project-nextrum-engelska`** (fällorna kring /en/-generatorn; "Fälla 4" citeras i
`nextrum-tjanster.js:38`, och kärnan står i avsnitt 4) och **"briefen"** (designdokumentet; §27
i `nextrum-images.js:23`, §31 i `nextrum-motion.js:331`) finns utanför repot. Hittar du dem:
lägg in dem i `minne/` i stället för att hänvisa vidare. Övriga poster i Claude-projektets minne
står i `MINNESPOSTER.md`; de pekar hit och är ingen källa.

Detaljer: `minne/grunden.md`.
