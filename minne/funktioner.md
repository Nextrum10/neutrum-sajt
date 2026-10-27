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
| `fakturering` | Månadskörningen: underlag per studiehjälpare, som är studiehjälparens lönespecifikation (2026-09-28), och en lista över pass som hölls utan att betalas. Ett sent pass läggs på sin egen månads utkast (`malmanad`, 2026-10-01). Fakturautkasten per familj (Fas 14.6) och obetalda pass på fakturan (2026-10-16) gick med fakturan 2026-10-21; namnet står kvar, för adressen står i schemat | pg_cron `manadskorning` varje natt sedan 2026-10-01 (`x-nextrum-notis`, alltid förra månaden), admin, eller `x-fakturering-nyckel` |
| `faktura-utskick` | Skickar underlaget till en studiehjälpare. **Mejlet först, statusen sedan.** Allt annat än ett underlag nekar den (409); fakturor finns inte sedan 2026-10-21 | Knapp under Löner |
| `ansokan-mejl` | Mejlet vi skriver till den som sökt jobb (2026-10-20). Tar ansökans id, ämnet, texten och en nyckel per ruta, läser adressen ur ansökan med adminens token (aldrig ur anropet) och skickar från info@ genom Resend, i mejlens skal och med en hemlig kopia till info@. Sparar inget, och loggar aldrig adressen eller texten. Kräver admin (`verify_jwt` på); använder inte `service_role`. **I drift sedan 2026-10-20**: v1 från merge-commiten av PR #306 (864e49e), hämtad tillbaka och byte för byte lika i alla tio filer; preflighten svarade `ok` och ett anrop utan inloggning 401 | Skicka i Skriv till hen och Skicka utbildningen i adminvyns Rekrytering |
| `bjud-in` | Skapar kontot åt den som tas in (2026-10-06): en familj, eller med `roll: 'tutor'` en studiehjälpare, med en Auth-inbjudan och `valkommen: 'losenord'`, aldrig ett lösenord. Med `igen: true` en ny inbjudan till den som inte tryckt på länken, annars länken för lösenordet, också för ett konto i bruk (2026-10-07; förut 409). Rollen vitlistas i funktionen: allt utom `tutor` blir förälder, och en inbjuden studiehjälpare hamnar i väntläge tills admin godkänner | Adminvyn: Ta in familjen, Ta in i poolen, Skicka inbjudan igen |
| `lead-notis` | Avisering till ledningen **och kvitto till familjen** när en intresseanmälan kommer in | **Databaswebhook** `ny-intresseanmalan`, `verify_jwt` av, delad hemlighet i header |
| `generate-message` | Claude-utkast (`generate-feedback`, rapportens omskrivning, är borta sedan 2026-10-27: rapporten går inte till en AI). Använder **inte** `service_role`, vidarebefordrar användarens token | Vyerna |
| `material-forslag` | Övningsuppgifter **i klartext, aldrig som länk** | Adminvyn |
| `juridik`, `ekonomi` | Agenter. Läser aldrig ur minnet, läser bara | Adminvyn |
| `drift` | Tredje agenten (Fas 8). Läser verksamheten och siffrorna, föreslår. Inget utgående verktyg | Adminvyn |
| `notis-ko` | Kö-arbetaren (Runda 2). Tar rader ur `notis_utskick`, renderar och skickar. Får alla sina beroenden inskickade. Sedan 2026-10-21 också intervjumejlet till den som söker (rollen `sokande`, `_delad/notiser/intervju.ts`, från info@), och den ska driftsättas före migrationen `intervjumejlet` | pg_cron, via `notis_konfig.arbetare_url` |
| `ansokan-notis` | Ett besked till den som sökt jobb (Fas 16.1): kvittot, eller mejlet om ett steg framåt med hela processen och var hen står. Databasen bestämmer vad, funktionen skickar | Triggern `ansokan_besked` och pg_cron `ansokan-besked`, via `notis_konfig.ansokan_url` |
| `admin-paminnelse` | Ett mejl till superadminarna och `info@` (2026-10-02): en jobbansökan direkt (slag `direkt`) eller det som ligger kvar i Att göra kl. 9 svensk tid (slag `morgon`), antal per sort och en knapp, aldrig namn. Databasen bestämmer vad och till vem (`admin_paminnelse_ta()`), funktionen skickar. Samma form som `ansokan-notis` | triggern `admin_ansokan_direkt` och pg_cron `admin-paminnelse` via `intern.admin_paminnelse_koa()`, genom `notis_konfig.admin_paminnelse_url` |
| `ansokan-gallring` | Tar bort ansökningar som inte ledde till anställning och CV-filer utan ansökan när de är ett år gamla (2026-09-27, avsnitt 5). Filen först genom Storage-API:t, sedan raden genom `ansokan_gallra()`, som vägrar medan filen finns. Svarar 500 om något inte gick | pg_cron `ansokan-gallring` via `intern.ansokan_gallring_vack()` och `notis_konfig.gallring_url` |
| `notis-avanmal` | Stänger av EN notistyp i EN kanal utifrån en signerad token. Kan aldrig slå på något | Länken i mejlet, och mejlprogrammets One-Click |
| `stripe-checkout` | Familjens kortbetalning för ETT bekräftat pass. **Hela beloppet till Nextrum**, ingen destination och ingen avgift. Beloppet räknas här, aldrig i anropet. Kassan öppnas i en panel på sidan (Fas 14.5), med Stripes egen sida som reserv. Sedan Fas 16.1 också köpet av en plan eller ett klippkort (`erbjudande` i anropet), med priset ur `erbjudanden_pris`. Sedan Fas 20.1 tar ett genomfört pass den hållna tiden, och `tillagg: true` tar betalt för övertiden på ett förbetalt pass (en egen rad i `pass_tillagg`). Sedan 2026-09-28 också ett pass som valts för faktura och inte står på en faktura än: det står kvar som `faktura` tills webhooken skrivit betalningen. Sedan 2026-10-07 nekar databasen köpet av timmar åt en familj som inte godkänt användarvillkoren (`klippkort_kraver_villkor`); kassan svarar då sitt vanliga fel, och vyn har redan visat rutan. Sedan 2026-10-13 (`kortet_reserveras`) sparar `kort: 'spara'` familjens kort i en kassa i läget `setup` på familjens kund (bara med strömbrytaren `kortreservation` på), och `kort: 'ta_bort'` tar bort det och kopplar bort korten hos Stripe (familjen sitt eget, admin en familjs, alltid). Sedan 2026-10-21 (SESSIONSFORM 10, i drift som v22 sedan 2026-10-20) nekar den allt utom Ta bort kortet utan `villkor: true` (rutan med köpvillkoren i vyn) och sparar krysset i `kopvillkor_godkannanden` med databasens tid (tål att tabellen saknas), och en plan tar sin månad ur `manad` (`denna` eller `nasta`, `galler_fran`; databasen prövar den) Sedan 2026-10-21 (i drift sedan 2026-10-20) tar den en kod bara på en plan: en kod på ett pass, ett tillägg, kortet eller timmar till planen är ett nej (409), och planens kod frågas i `kod_pa_planen` och räknas om ur typen och värdet innan Stripe får beloppet (`_delad/koder.ts`, `koder_test.ts`); beloppet som dras är fortfarande databasens `begart_ore` | Knappen på passet i föräldravyn, Betala med kort nu på ett fakturapass, Köp under Erbjudanden, och kortet i Föreslå pass och under Profil |
| `klippkort-betala` | Betalar ett bekräftat pass med köpta timmar (Fas 16.1). Prövar familjens token och flaggan, drar i `klippkort_dra()` och stänger en öppen kortkassa för passet. Med `timbank: true` dras minuterna i timbanken i stället, i `timbank_dra()` (Fas 22.1). Sedan Fas 22.2 betalar timmarna passen av sig själva i databasen, och knappen tar det de inte hann | Betala med timmar och Betala med timbanken i föräldravyn |
| `stripe-webhook` | Enda vägen som får sätta en betalning som betald. Signatur i konstant tid, idempotens via `stripe_handelser`. Ett tillägg (Fas 20.1) bär `tillagg_booking_id` och skrivs, återbetalas och bestrids på sin egen rad. Sedan 2026-10-13 sparar den kortet (en kassa i läget `setup`) och skriver reservationen, dragningen och släppet för ett PaymentIntent med `kortreservation` i metadata; en dragning betalar passet genom samma väg som kassan (`betalaPasset`). Sedan 2026-10-21 (i drift sedan 2026-10-20) står en betalning som inte kunde skrivas ner på sin rad i liggaren (`betalning_utan_rad`), och `charge.refunded` på ett köp av timmar stämmer av varje återbetalning med köpets id i Stripes metadata mot timmarna (`stamAvKopet`, `_delad/aterbetalning.ts`); en återbetalning utan id (Stripes dashboard) stänger köpet som förut och blir en uppgift. Liggaren skriver databasen själv, ur de rader webhooken skriver. Signaturen och taket mot dubbletter står i `_delad/webhooken.ts` (samma sak som förut, nu provad utan nät i `webhooken_test.ts`) | Stripe |
| `stripe-aterbetalning` | Återbetalning till familjen, hel eller delvis. Beloppet tas ur raden, aldrig ur anropet. Sedan 2026-10-21 (i drift sedan 2026-10-20) också ett köp av timmar (`{klippkort, timmar, anledning}`): beloppet och timmarna räknar databasen (`klippkort_aterbetalning_lage`), Stripe först med köpets id i metadata och en nyckel av köpet, det som redan gått tillbaka och beloppet, sedan timmarna (`klippkort_aterbetalad`); hann den inte skriver webhooken samma rad (`_delad/aterbetalning.ts`, provat med en falsk Stripe och databas i `aterbetalning_test.ts`) | Återbetala under Betalningar (Att göra, Alla betalningar, Bokslut, Liggaren) |
| `stripe-avstamning` | Hämtar avgift, netto och läge (test eller skarpt) för betalningar som saknar dem (Fas 14.7). Högst femtio per tryck. Skriver bara de kolumnerna | Knappen Hämta från Stripe under Betalningar → Inställningar |
| `stripe-lage` | Frågar Stripe om nyckeln, kontot, kontoutdraget och webhookens händelser, och säger vad som saknas (Fas 14.3). **Läser, skriver ingenting.** Nyckeln lämnar aldrig funktionen, bara om den är test eller skarp | Knappen Kontrollera Stripe under Betalningar → Inställningar |
| `stripe-reservation` | Kortet reserveras (2026-10-13): reserverar två dagar före passet med det sparade kortet, drar när rapporten finns (den hållna tiden, högst det reserverade), drar utan reservation när den inte gäller, och släpper. Frågar Stripe först om passet redan har ett PaymentIntent, så att inget dras två gånger. Skriver bara reservationens läge (`kortreservation_skriv`); betalningen på passet skriver webhooken. Högst 20 rader per väckning; svaret bär bara antal. De nya försöken och larmet styr databasen (`kortdragningen_forsoker_igen`, 2026-10-21), som också väcker den direkt när ett pass har något att göra nu. Vad den gör med en rad står sedan samma dag i `_delad/reservationen.ts` med Stripe inskickad (`reservationen_test.ts`), och den prövar 48-timmarsfönstret en gång till innan den reserverar (`RESERVATION_TIMMAR`, samma som `kortreservation_att_gora`; de ändras tillsammans) | pg_cron `kortreservation` via `intern.kortreservation_vack()` och `notis_konfig.kortreservation_url`, och `intern.kortreservation_vack_nu()` |
| `google-koppla` | Kopplingen till Google (Fas 18.1): adressen till Google, återkomsten med engångskoden, Prova och Koppla från. Koden byts mot en nyckel HÄR; vyn ser aldrig nyckeln eller klienthemligheten. Återkomsten bär ingen inloggning och skyddas av ett HMAC-signerat läge som gäller i tio minuter. Ett konto utanför nextrum.se nekas | Knapparna under System → Integrationer, och Googles omdirigering |
| `google-meet` | Meet-länken till ett bekräftat onlinepass (Fas 18.1). Läser passet med anroparens token först, skapar ett öppet rum och sparar länken i `pass_moten`. Ett rum som inte blev öppet sparas inte | Passets sida i föräldravyn och studiehjälparvyn |
| ~~`utbildningsprov`~~ | Provet i ansökan (Fas 22.1), **borttaget ur repot 2026-10-21** (`provet_i_ansokan_tas_bort`, `minne/notiser.md`): det enda provet görs i studiehjälparvyn och rättas i databasen. Funktionen står kvar i driften tills den tas bort i Supabases panel (verktygen kan inte ta bort en funktion), och med migrationen körd når den ingenting: `utbildningsprov_lage()` och `utbildningsprov_lamna()` kör ingen, inte heller `service_role` | Ingenting: sidan och Prova utbildningsprovet i adminvyn är borta |

`supabase/config.toml` bär `verify_jwt = false` för de elva funktioner
som anropas utan inloggad användare (tolv till 2026-10-21, då
`utbildningsprov` gick). Inställningen satt länge bara i
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
- `juridik` och `ekonomi` prövar inte behörigheten först.
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
`notiser/typer.ts` från 2026-09-30, utan barnets typer och `kod`.
Driftsätts de av annat skäl följer mains kopior med. `stripe-checkout`
gick ut som v18 från main (2f12977) 2026-10-07, före migrationen
`planerna_basic_standard_intensiv`, med kassaraden för en timme på köpet
och `sammaInnehall`; hämtad tillbaka är den byte för byte som main i alla
sju filer, också `_delad/pris.ts`. `ansokan-notis` driftsattes 2026-10-06 som v7 från main
(c5e5fe1), med nejet och mejlet till vårdnadshavaren, och lästes tillbaka:
alla tretton filer är byte för byte som main. 2026-10-07 gick v8 ut från
main (43d2ef4), där bara `notiser/ansokan.ts` skilde (sista steget och
välkomsten säger att vi skapar kontot), och lästes tillbaka på samma
sätt. Röktest genom `intern.natanrop`: med hemligheten och ett okänt id
200 utan att något skickades, utan hemligheten 401 från funktionen.

**PR #307, 2026-10-20 kväll** (fakturan bort, intervjumejlet, liggaren,
kortet som försöker igen och koderna): tio funktioner från merge-commiten
(e92104b), före migrationerna: `ekonomi` v26, `fakturering` v36,
`faktura-utskick` v23, `stripe-webhook` v15, `stripe-checkout` v22,
`notis-ko` v29, `drift` v23, `juridik` v23, `stripe-aterbetalning` v8 och
`stripe-reservation` v2. Nio gick ut genom MCP från parallella
hjälpagenter, en funktion var, och `ekonomi` härifrån. Både det skickade
och det hämtade jämfördes med repot, md5 per fil, ur sessionens
transkript och de sparade verktygssvaren (ett svar över cirka 50 kB står
i `tool-results/`, inte i transkriptet): byte för byte lika. Supabase
paketerar bara det som körs, så `stripe-reservation` saknar
`_delad/aterbetalning.ts`, som bara importeras som typ. Röktest från
databasen med tillägget `http` (inte `pg_net`, så inget syns som fel i
adminvyn), med den publika nyckeln som token: 401 "Inloggningen gick inte
att verifiera" ur funktionens egen kod för de inloggade, 400
"stripe-signature saknas" för webhooken och 401 "Fel eller saknad
hemlighet" för `notis-ko` och `stripe-reservation`; ingen grind svarade
(`sb-error-code`). De andra som delar de ändrade filerna i `_delad/`
gick inte ut: där skiljer bara kommentarer (`stripe.ts`, `mejl.ts`,
`notiser/ansokan.ts`), en konstant ingen av dem läser
(`BETALNINGSVILLKOR_DAGAR`), fakturans texter och kortets `igen` i
notisernas mallar, som bara `notis-ko` skickar, och två fakturatyper i
morgonmejlet (`notiser/admin.ts`) som databasen inte längre skapar. Det
gäller `admin-paminnelse`, `ansokan-gallring`, `ansokan-mejl`,
`ansokan-notis`, `barn-inloggning`, `bjud-in`, `generate-feedback`,
`generate-message`, `klippkort-betala`, `lead-notis`, `notis-avanmal`,
`stripe-avstamning` och `stripe-lage`. Driftsätts de av annat skäl
följer mains kopior med.

**Kedjan 2026-10-21 kväll** (PR #325 och det som stod på main: Betala nu,
AI-svaren, månadsrapporten, syskontillägget och värvningsbonusen), från
merge-commiten 829d2c0: `stripe-webhook` v16, `stripe-reservation` v3,
`drift` v24, `ekonomi` v27, `juridik` v24, `stripe-lage` v6,
`nex-manadsrapport` v1 (ny), `material-forslag` v9, `generate-feedback` v23,
`generate-message` v23 och `notis-ko` v32 före migrationerna, och
`stripe-checkout` v23 och `stripe-aterbetalning` v9 efter
`syskontillagg_som_skuld`, för kassan och återbetalningen från main anropar
tilläggets funktioner. Alla gick ut genom MCP från hjälpagenter och
hämtades tillbaka: byte för byte lika main, md5 per fil
(`jamfor_funktion.py` i scratchpaden läser ett sparat svar, eller det
senaste i sessionens och hjälpagenternas transkript). Röktest från
databasen med tillägget `http` och den publika nyckeln: 401 "Inloggningen
gick inte att verifiera" ur funktionens egen kod för de inloggade, 400
"stripe-signature saknas" för webhooken och 401 "Fel eller saknad
hemlighet" för `notis-ko` och `stripe-reservation`; ingen grind svarade.

**De andra sjutton** i driften jämfördes samma kväll med 829d2c0, fil för
fil (bara läsning, en hjälpagent). Var och en har exakt de filer dess
`index.ts` importerar, och `verify_jwt` stämmer med `config.toml` för alla
som finns i repot.
`barn-konto` och `fakturering` är lika i alla filer. I de andra skiljer bara
kommentarer eller kod som funktionen aldrig når:
- Notismallarnas `MALLAR`, `KATEGORI` och `vyAdress()` nås bara genom
  `renderaMejl()`, och den anropar bara `notis-ko`. Gamla meningar om
  faktura och "bekräfta rapporten" står alltså kvar i sex driftsatta kopior
  av `mallar.ts`, men ingen av dem skickar dem.
- `BETALSATT`, `descriptor()` och `WEBHOOK_HANDELSER` i `stripe.ts` läser
  varken `klippkort-betala` eller `stripe-avstamning`. Det de läser
  (`v1`, `StripeError`, `arStripeId`, `balans`, API-versionen) är lika main.
- `BETALNINGSVILLKOR_DAGAR` importeras inte.
- Morgonmejlets `ADMIN_SORTER` har två fakturarader som databasen inte
  längre skickar.

**Ett fel i sak:** `notis-avanmal` v9, från 2026-10-01, hade `typer.ts` utan
`barnforslag`, `kort_nekat`, `tillagg_paminnelse`, `tillagg_kvitto` och
`varvningsbonus`, så avanmälan i de mejlen svarade 403
(`minne/notiser.md`). Ingen hade drabbats, och v10 från 829d2c0 rättade
det samma kväll: byte för byte lika main, och röktestet svarade 403 ur
funktionens egen kod för en token som inte är en token.

Två detaljer till:
- `bjud-in` v12 och `admin-paminnelse` v4 är inte byte för byte någon
  commit. Deras kommentarer har stavfel som inte finns i git ("SÄLVA",
  "föräldern", "stånd", "bokstärliga"), så de gick ut ur omskriven text.
  Bara kommentarer berörs.
- `utbildningsprov` (v5) finns bara i driften. Med en nyckel svarar den 500,
  för `provet_i_ansokan_tas_bort` tog rätten att köra dess funktioner. Leo
  tar bort den i panelen.

**Verktygslagret avkodar bakstreck-u och fyra hexsiffror** i det som
skickas i ett verktygsanrop (2026-10-21). `notis-ko` v31 fick ett hårt
mellanslag i `notiser/mallar.ts` där källan har sex tecken (bakstreck, u,
00a0) i tre strängar, också när bakstrecket skickades dubbelt i JSON:
avkodningen sker efter JSON-tolkningen och tar varje sådan följd som inte
står efter ett bakstreck till. Mejlen blev desamma (strängen blir samma
tecken), men filen skilde, och jämförelsen fångade det. v32 skickade
bakstrecket självt som en sådan följd (u005c): JSON-tolkningen lämnar den,
den enda avkodningen gör den till ett bakstreck, och källans sex tecken
står kvar. Det gäller allt som skrivs i ett anrop, också ett grep eller
en text till en fil: sök med `grep -F 'u00a0'` och jämför mekaniskt, aldrig
med ögat.

**Samma fälla igen 2026-10-22** (sen avbokning, `DEPLOY-BETALNING.md`
9.27), för noteringen ovan lästes inte före uppladdningen. `notis-ko` v33
och v34 från hjälpagenter fick tecknet; v35 skickade fyra bakstreck i JSON,
som blev två i filen, och då skrev `kronor()` escapen som text i varje
belopp. Den stod ute i tio minuter medan kön var tom, så inget mejl gick.
v36 skickade två bakstreck och fick tecknet igen: avkodningen tar också
den följd JSON-tolkningen nyss lämnat. v37 skickade två bakstreck och
u005c (bakstrecket dubblat i JSON, sedan u005c och u00a0 som vanlig text),
och är byte för byte lika main. Skrivningen provades först på något
ofarligt: metadata i en uppgift (`TaskUpdate`), läst ur transkriptet, där
anropet står som verktyget fick det. Fem skrivningar gav tecknet, en gav
två bakstreck, och bara den med u005c gav källans sex tecken.

**Sen avbokning 2026-10-22 kväll**, från merge-commiten c0d787a: `drift`
v25 och `stripe-checkout` v24 (SESSIONSFORM 12) från hjälpagenter, och
`notis-ko` v37 (ovan), alla före migrationen och hämtade tillbaka: byte för
byte lika main, md5 per fil. Röktest från databasen: 401 "Inloggningen
gick inte att verifiera" för `drift` och `stripe-checkout`, och 401 "Fel
eller saknad hemlighet" för `notis-ko`; ingen grind svarade.

**Fyll timbanken säljs inte 2026-10-24 kväll**, från merge-commiten 9e72f81
(PR #331): `drift` v26 och `stripe-checkout` v25 (SESSIONSFORM oförändrad)
från två hjälpagenter, en funktion var, och hämtade tillbaka och jämförda
fil för fil med `git archive` av merge-commiten (md5 och byte). `drift` är
byte för byte lika i alla fem filer. `stripe-checkout` är lika i åtta av
nio; i `index.ts` saknas en tom rad mellan två satser (rad 361, efter
`sparaSessionen`), samma kod, och den blir lika nästa gång kassan
driftsätts, som webhookens tomma rad 2026-10-14. Båda hjälpagenterna
skickade tecknen utanför ASCII (å, ä, ö, tankstreck, pilar) som JSON-escapes,
bakstreck, u och fyra hexsiffror, i stället för råa: JSON-tolkningen gjorde
dem till tecken, och verktygets andra avkodning hade inget kvar att ändra,
så alla kom fram rätt. Filerna hade inga sådana escapes i källan. Röktest
från databasen med den publika nyckeln: 401 "Inloggningen gick inte att
verifiera" ur båda funktionernas egen kod, och ingen grind svarade.

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
sedan 2026-09-27 (flaggan `faktura`). juridik v22, ekonomi v23 och drift
v12 gick ut från main (556028f) samma dag och lästes tillbaka: juridik och
ekonomi var byte för byte som main, drift hade "uppörande" i två
kommentarer. **En fil som skrivs in i driftsättningsverktyget för hand kan
tappa en bokstav**, så jämför byte för byte, inte med ögat.
Samma dag fick ekonomins frågor och drifts `analys` säga vad siffrorna är
(PR #214): `fakturor` räknar utkasten för sig och makulerade i ingen summa,
`kortbetalningar` räknar aldrig en testbetalning, som Betalningar i
adminvyn, och `analys` säger att betalt varken har köpta timmar eller
betald övertid och inte sorterar bort testbetalningarna. Analysvyn räknar
inte som Betalningar (`minne/betalning.md`); rättas den ändras texten i
`analys` samtidigt. ekonomi v24 och drift v13 gick ut från main
(6c23394) efter merge av PR #214 och lästes tillbaka: alla filer byte för
byte som main, också de två kommentarerna i drift. juridik står kvar på
v22, som inte skiljer från main.

**drift v15, 2026-10-09**, från main (b6c6c1b) efter PR #242 och #243,
hämtad tillbaka och byte för byte lika i alla fem filer. `nextrum-fakta.ts`
fick regeln om första timmen (med den första planen, pass för pass bara
om admin valt det, högst en per familj utom tipstimmar) och tipstimmen
efter två timmar. Första utkastet av texten hade tabell- och kolumnnamn i
sig, och listan i `testa-agent.js` såg dem inte: sedan dess underkänns
varje ord med understreck. Vid genomläsningen före driftsättningen sa
texten också att familjen kunde skapa kontot själv och att föräldravyn
var låst i ett väntläge före matchningen, båda fel sedan 2026-10-07.
**Läs hela faktatexten mot kärnan innan `drift` driftsätts**, inte bara
stycket som ändrats.

**drift v16, 2026-10-12**, från main (2c19183) efter PR #254, hämtad
tillbaka och byte för byte lika i alla fem filer (`cmp` och md5).
`nextrum-fakta.ts` fick timbanken: en plan eller Fyll timbanken fyller
den, Fyll timbanken kostar timpriset och gäller i sex månader, sparade
minuter går aldrig ut, och pass för pass går inte genom den. Utan
tabellnamn, och `testa-agent.js` gick igenom.

**drift v20, 2026-10-15**, från main (bed3797) efter PR #286, 20.18
UTC, hämtad tillbaka och byte för byte lika i alla fem filer (v19 gick
ut 2026-10-14 med kortet, kärnans avsnitt 11). `nextrum-fakta.ts` säger
att den första planen får första timmen också med rabattkod, att senare
planer inte får någon, att en familj som betalar pass för pass inte får
någon, och att vi bjuder med gratistimmar (Leo samma dag). Att ett pass
på en timme kan kosta noll kronor står nu vid tipstimmen, den enda
timmen som fortfarande gör det. Stycket om ett pass som dras från två
köp sa "(första timmen eller tipstimmen)" om en timme på köpet på ett
pass, men sedan 2026-10-15 är det bara tipstimmen. Det stod kvar också
när #293 ändrade texten (8b28e1a). PR #298 (de obetalda passen) rättar
det till "(tipstimmen)", och det går ut med `drift` efter merge, inte med
en egen driftsättning.

**drift v21, 2026-10-16**, från merge-commiten av PR #293 (8b28e1a), 00.13
UTC, hämtad tillbaka och byte för byte lika i alla fem filer.
`nextrum-fakta.ts` fick familjerabatten: kronor av på varje timme familjen
betalar, tills admin tar bort den, en rabattkod räknas på priset efter den,
familjen ser bara det lägre priset, och ett pass eller köp under ordinarie pris
hos en sådan familj är inget fel. Texten lästes hel mot kärnan först, och det
enda som skilde mot v20 var det stycket; "(första timmen eller tipstimmen)"
står kvar, som ovan. `stripe-checkout` v21 (SESSIONSFORM 9) gick ut samma
natt, 00.06 UTC, alla sju filer lika. Båda svarade 401 ur sin egen kod på ett
röktest genom `intern.natanrop` med den publika nyckeln (`rokprov:drift` och
`rokprov:stripe-checkout`, `minne/databasen.md`).

**drift v22, notis-ko v27 och fakturering v35, 2026-10-16**, från
merge-commiten av PR #298 (b68509f), direkt efter migrationen
`obetalda_pass_pa_fakturan` (`DEPLOY-BETALNING.md` 9.17). Före körningen
skilde de sig från main bara i #298:s ändringar: `nextrum-fakta.ts` (regeln om
de obetalda passen och "(tipstimmen)", ovan), `notiser/mallar.ts` (meningen i
mejlen) och `fakturering/index.ts` med `_delad/pris.ts` (`fakturera_obetalda`
före fakturapassen, `somFaktura` i torrkörningen). Tre hjälpagenter laddade
upp var sin funktion ur filerna på disk, och alla tre hämtades sedan tillbaka
och jämfördes byte för byte med b68509f: 5, 15 och 7 filer lika, och
`verify_jwt` som förut (på för `drift`, av för de andra två). `notis-ko`
behöll grenen för gratis timmar (`RenData.gratis`, v26). Alla tre svarade 401
ur sin egen kod på ett röktest genom `extensions.http` från SQL, `drift` med
den publika nyckeln.

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
- **Ämnena jämförs som koder** (2026-10-21): `amnen_mots()` går genom `amne_koder()`, som gör
  Matte till matematik, NO till fysik, kemi och biologi, SO till sina fyra och "Flera ämnen"
  till matematik, svenska och engelska. Förut jämfördes fritext med `position()`, och en elev
  med flera ämnen fick ett hårt nej mot varje studiehjälpare. Driftsatt samma natt.
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

### Korta AI-svar läser textblocken (2026-10-21)

`generate-feedback`, `generate-message` och `material-forslag` gick från
`claude-sonnet-5` till `claude-sonnet-5-5`, och juridik och ekonomi (den delade
`MODELL`) från `claude-opus-5` till `claude-opus-5-5`. **Ett rakt byte av
modellsträngen hade brutit rapporterna**: Sonnet 5.5 tänker först som förval, på
high, så första blocket kan vara ett tankeblock och tänkandet äter av
`max_tokens` (220 och 400). De tre läste `content[0].text`. Nu går de genom
`_delad/kortsvar.ts`: `kortaSvar()` sätter `thinking: between_tools` (inga
verktyg, alltså inget tänkande) och ett uttryckligt `effort`, och `svarstext()`
läser bara textblocken och svarar null på ett avhugget svar, som motorn.
Juridik och ekonomi berördes inte av fällan: motorn skriver redan ut `high` och
filtrerar textblocken. I drift sedan kvällen 2026-10-21, alla fem från
merge-commiten av PR #325 (829d2c0): `generate-feedback` v23,
`generate-message` v23, `material-forslag` v9, `juridik` v24 och `ekonomi` v27.

### Nex månadsrapport (2026-10-21)

Leo: "det är ju bra att den automatiskt ger en inblick i läget av företaget
varje månad". Drift-agenten gjorde det aldrig av sig själv: den svarade när
någon skrev i rutan på Översikt, och den hade körts en gång sedan september.
En kväll tidigare stod drift och förslagskön på väg ut ur adminvyn (PR #319,
stängd utan merge samma förmiddag: Nex och drift står kvar), och i stället
kom det Leo faktiskt ville ha, en rapport ingen behöver be om.

- **Edge-funktionen `nex-manadsrapport`** (`verify_jwt` av). Släpps in med
  hemligheten i `x-nextrum-notis` (schemat) eller en superadmins egen token
  (Skriv nu, `kravAdmin`), prövat innan `service_role` används till något.
- **Inga verktyg och ingen slinga.** Drifts slinga går genom `ai_verktyg`, som
  kräver `is_admin()`, och ett schema har ingen inloggning. Funktionen läser i
  stället `ai_analys`, `ai_avvikelser`, `ai_omatchade_elever`,
  `ai_saknade_rapporter`, `ai_nya_leads` och `ai_kommande_pass` med
  `service_role` (som redan fick köra dem) och räknar ihop dem i
  `_delad/manadsrapport.ts`. **Bara summor går till modellen**: inga id:n,
  initialer eller anmälningarnas fritext (`manadsrapport_test.ts` och
  `testa-agent.js` vaktar).
- **En rapport per månad**: finns en klar körning med frågan "Månadsrapport för
  oktober 2026" skrivs den inte om, utom med Skriv om. Schemat skriver alltid
  förra månaden; Skriv nu kan välja en månad i väljaren (den innevarande ger
  ett läge hittills).
- **Var den syns**: rutan Nex månadsrapport på Översikt, under NEX-bandet
  (`nextrum-admin-konsol.js`, `ritaManadsrapport`), och en uppgift
  `nex-manad:ÅÅÅÅ-MM` ("… är klar") som tar den till Att göra och
  morgonmejlet kl. 9. Misslyckas schemats körning blir det en uppgift
  `nex-manad:fel:ÅÅÅÅ-MM`, och saknas adressen `nex-manad:adress`.
- **Modellen** är `claude-opus-5-5` med sitt förval medium, utan verktyg; svaret
  läses ur textblocken och ett avhugget svar sparas aldrig som en rapport.
- **Jobbet** är `nex-manadsrapport`, `13 6 1 * *` (UTC), två timmar efter
  månadskörningen, så att förra månadens löneunderlag finns.
- Texten töms med resten av agentloggen efter 90 dagar
  (`intern.ai_och_uppgifter_gallra`, `DATASKYDD.md` rad 16).
- **I drift** sedan kvällen 2026-10-21: v1 från 829d2c0, byte för byte lika
  main, före migrationen 20261021190000; jobbet står. Skriv nu och schemat
  är inte provade (`DEPLOY-AGENTER.md` steg 3 och 4).

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
kontot i Auth, länken, mejlet och anmälan), så att `inbjudan_test.ts` kör
varje väg; `index.ts` är bara admin först (`kravAdmin`) och beroendena.
- **Mejlet skickar funktionen själv** (2026-10-07): Auth gör kontot och
  länken med `generateLink` och mejlar inget, och mejlet går genom Resend
  från info@ med tiden i ämnet (`_delad/notiser/konto.ts`, prov i
  `konto_test.ts`). Förut mejlade Auth med Invite user-mallen, och Gmail
  lade tre inbjudningar i en tråd där det senaste mejlet såg tomt ut
  (`minne/sakerhet.md`). Länken prövas som `/lank` prövar den
  (`godLank`: verify hos vårt Supabase, med en token) innan den mejlas.
  Länken passerar Resend i stället för Googles SMTP; mejlet och Resends
  svar loggas aldrig, bara statusen.
- **Ny inbjudan**: 409 om adressen redan har ett konto (det ska användas,
  inte bjudas in igen), annars `generateLink` av sorten invite med `role`,
  `full_name` och `valkommen: 'losenord'`, och länken till vyn för
  rollen (`TILLBAKA`). Med `lead_id` blir anmälan kontaktad, först när
  mejlet gått. Går mejlet inte iväg finns kontot ändå, och svaret (502)
  säger att Skicka inbjudan igen gör resten. Varför det är en länk och
  inte ett gemensamt lösenord står i filens huvud och i `minne/sakerhet.md`.
- **Igen** (`igen: true`): rollen tas ur profilen, inte ur anropet; 404
  utan konto och 409 för en roll som inte är förälder eller
  studiehjälpare; 429 om Auth gjort en länk till kontot den senaste
  minuten (`MELLAN_MEJL_MS`, som Auths egen spärr för Glömt lösenordet).
  Ett obekräftat konto får en ny inbjudan (invite, metadatan rörs inte),
  och ett bekräftat en länk för att välja lösenord (recovery), också när
  lösenordet redan är valt (2026-10-07, Leo: "i admin ska vi kunna skicka
  inbjudningslänk när vi vill efter, ifall de missar den"). Hann kontot
  bekräftas mellan frågan och länken blir det recovery. Till v10 fick ett
  konto med lösenord 409, och till v11 mejlade Auth. v11 är i drift sedan
  2026-10-07 kväll, från merge-commiten av PR #222, hämtad tillbaka och
  byte för byte lika (12 av 12 filer).
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
- **v10 sedan 2026-10-07**, från main efter merge av PR #218 (46d49fe):
  bara `_delad/inbjudan.ts` skilde från v9. Alla fem filerna hämtades
  tillbaka och var byte för byte lika med main.

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
