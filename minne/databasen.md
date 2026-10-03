# Databasen: tabellerna, migrationerna, jobben, gallringen och raderingen

Arkivet för avsnitt 5 i `CLAUDE.md` utom notiserna, beskeden och utbildningsprovet
(`notiser.md`), ordagrant. Reglerna står i kärnan, `CLAUDE.md`. "Notiserna nedan" i texten
står i `notiser.md`, och "avsnitt N" är kärnans.

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
`integrationer`, `notis_konfig`, `klientfel`,
`agent_korningar`, `agent_steg`, `admin_noteringar`, `foretagsfakta`,
och sedan Fas 5–7: `uppdrag`, `uppgifter`, `audit_logg`, `rut_tak`,
`kund_skatteuppgifter`. Fas 8–9 la till `ai_forslag`, `ai_konfig` och
`handlingar`. Fas 13.2 la till `biblioteksmaterial`. Fas 15.3 la till
`progress_historik` (skrivs bara av en trigger; ingen skrivpolicy).
Fas 14.3 la till `stripe_tvister` (skrivs bara av `stripe-webhook`,
läses bara av admin). Fas 14.6 la till `faktura_sparr` (admin skriver,
familjen läser sin egen rad). Fas 14.8 tog bort `fortnox_token`, som
hörde till en Fortnox-koppling som aldrig gjordes, när bokföringen
skulle ligga i Wint. Fas 14.9 bytte Wint mot Fortnox, utan koppling:
`fortnox_token` kom inte tillbaka, och `invoices.wint_fakturanummer`
heter `fortnox_fakturanummer`.
Fas 16.1 la till `erbjudanden` (katalogen, alla läser) och `klippkort`
(köpen: familjen läser sina, bara `service_role` skriver), med vyerna
`erbjudanden_pris` och `klippkort_saldo`. Timmarna dras bara i
`klippkort_dra()`, och triggrarna för klippkortet är EGNA — de rör inte
`skydda_bokningsfalt` eller `avvikelser_rader`, som Fas 14.6 skrev om.
Fas 22.1 la till `timbank_uttag` (minuterna familjen använt ur timbanken
eller fått utbetalda: parterna och admin läser, bara databasen skriver),
med vyerna `timbank_saldo` och `timbank_rorelser`. Insättningarna står
inte i någon tabell, de räknas ur passen. Fas 22.2 la till vyn
`klippkort_rorelser` (passen varje kort betalat) och triggrarna
`bookings_timmar_betalar` och `klippkort_betalar_passen`, som låter
timmarna betala passen av sig själva (avsnitt 1). Fas 22.3 la till
pg_cron-jobbet `timmar-betalar`, som låter timmar som blivit lediga
betala nästa bekräftade pass. Fas 22.4 la till
`bookings_timmar_betalar_forslaget` och
`intern.obesvarade_forslag_slapper_timmarna`: timmen dras när förslaget
skapas och kommer tillbaka om ingen svarat när dagen gått.
Lönespecifikationen (2026-09-28) la till pg_cron-jobbet `manadskorning`,
den 1:a klockan 04:17 UTC, och `notis_konfig.fakturering_url`. Sedan
2026-10-01 går det varje natt 04:17 (`manadskorningen_gar_varje_natt`),
för förra månaden som förut: den 1:a skapar det månadens underlag och
fakturautkast, och resten av månaden lägger det sent rapporterade pass
på sin månads utkast (Passets månad, `minne/betalning.md`). I drift
samma dag efter PR #171, efter `fakturering` version 34: migrationen
hämtad från merge-commiten och prövad mot sin md5, och hela
`rls-test.sql` 1151 av 1151 mot driften.
`intern.manadskorning_vack()` väcker `fakturering` genom
`intern.natanrop` med hemligheten i `x-nextrum-notis`, och den vägen
skriver alltid förra månaden. Saknas adressen blir det en uppgift
(`manadskorning:adress`) i stället för en tyst månad; går anropet fel
står det under System → Fel i sex timmar och blir en uppgift (nedan),
och passen larmar som `ej_utbetalt`.
Adminvyn visar om jobbet är på (`manadskorning_lage()`, bara admin): ett
schema som står av ser annars ut precis som ett som fungerar.
**Jobbet är på sedan 2026-09-28**, efter stegen i DEPLOY-BETALNING.md
avsnitt 6: `fakturering` version 32 driftsatt från main och jämförd
byte för byte, väckningen torrkörd, och sist migrationen med jobbet.
Hela `rls-test.sql` gick igenom mot driften efteråt, 702 av 702. Det
som körs skarpt skriver underlag och fakturautkast för allt som står
klart, och provpasset den 27 september undantogs inte: Leo ville se hur
lönespecen ser ut. Underlaget på 240 kr och fakturautkastet på 758 kr
skrevs redan den 29 september, när september kördes med knappen medan
den pågick, och ska tas bort när lönespecen är sedd, inte betalas ut
eller läggas in i Fortnox (DEPLOY-BETALNING.md avsnitt 6). Schemat gick
den 1 oktober som det skulle och svarade 207: ett pass den 29 september
hade rapporterats efter knappen, och en studiehjälpare har ett underlag
per månad (`unique(tutor_id, period)`), så passet fick vänta en månad på
sin lön. **Sedan 2026-10-01 skapas en månad bara när den är slut**:
`fakturering` nekar en skarp körning för en månad som pågår eller inte
har börjat med 409 (`manadenArSlut` i `_delad/pris.ts`, i svensk tid),
och rutan i adminvyn låter bara torrköra den.
**Månadskörningens svar blir en uppgift** (2026-09-29). Ingen läste
svaret, och `ej_utbetalt` säger inte att körningen misslyckades. En
halvtimme efter körningen läser `intern.manadskorning_svar()` (pg_cron
`manadskorning-svar`, 04:47 UTC) svaret, och allt utom 200 blir en
uppgift, `manadskorning:svar:<månad>`, som står kvar tills någon stänger
den: 207 (en del av skrivningarna gick fel), 4xx, 5xx, tidsgränsen, ett
anrop som aldrig fick svar, och ett anrop som saknas för att jobbet inte
gick eller föll före det. Uppgiften säger vad som hände och pekar på
Ekonomi → Månadskörning (texten står i databasen; rutan står sedan
2026-09-29 under Betalningar → Fakturor), utan namn, belopp eller något
ur svaret. En
månad ger en uppgift, också när den stängts: det var samma körning när
jobbet gick en gång i månaden. Sedan det går varje natt (2026-10-01)
blir en natt som går fel efter att månadens uppgift stängts ingen ny
uppgift; den står under System → Fel.
Funktionen läser bara anrop från den senaste timmen, för ett äldre svar
kan pg_net redan ha tagit bort, och ett borttaget svar hade lästs som
inget svar. **Flyttas `manadskorning` ska `manadskorning-svar` flyttas
med**; `rls-test.sql` prövar båda schemana. Byggt i databasen och inte
i `fakturering`, för funktionen ser aldrig det som går fel innan den
körs (grindens 401, 404, tidsgränsen), och hade behövt driftsättas
igen. **I drift sedan 2026-09-29**: migrationerna kördes efter att PR
#128 mergats, som `20260929093749` och `20260929093830`, och det
driften sparade har samma md5 som filerna. Emellan torrkördes vägen och
funktionen lästes för hand: 200 för augusti, ingen uppgift. Hela
`rls-test.sql` gick igenom efteråt, 794 av 796, där de två är Fas
23.1:s prov, som väntar på sin egen migration. Första skarpa läsningen
är den 1 oktober 04:47 UTC.
Fas 16.1 la också till `ansokan_utskick` (beskeden till den som sökt jobb;
skrivs bara av triggern och funktionen, läses bara av admin).
Fas 22.1 (utbildningsprovet) la till `utbildningsprov_forsok` (varje
försök på provet: admin läser, bara `utbildningsprov_lamna()` skriver)
och fyra kolumner på `applications`: `utbildningsmote_at`,
`prov_sista_dag`, `prov_nyckel` och `prov_godkant_at`. Numret krockar:
timbanken kördes som `fas22_1_timbanken` samma förmiddag i en annan
session. Namnen i driften går inte att byta i efterhand.
Fas 18.1 la till `google_koppling` (nyckeln till Nextrums Google-konto:
RLS utan policy, bara `service_role`) och `pass_moten` (Meet-länken per
pass: parterna och admin läser, bara `service_role` skriver, och
villkoret på kolumnen släpper bara igenom `https://meet.google.com/…`).
Fas 19.1 la till `rapport_bekraftelser` (familjen har läst rapporten).
Familjen får skriva EN kolumn, `rapport_id`, genom ett kolumnvis
grant; vem och när sätts av databasen, så en bekräftelse går varken att
skriva i någon annans namn eller bakdatera. Ingen update eller delete,
och admin bekräftar inte åt en familj. Egen tabell och inte en kolumn
på `lesson_reports`, för en uppdatering där kör fyra triggrar.
Fas 20.1 la till `pass_tillagg` (övertiden på ett förbetalt pass:
parterna och admin läser, bara `service_role` skriver) och Fas 20.2
`manadsbokslut` (stängda månader: admin läser, bara `stang_manad` och
`oppna_manad` skriver).
Fas 23.1 la till `nivaer` (katalogen: alla inloggade läser, admin och
migrationerna skriver), `niva_fragor` (frågorna MED facit: familjen har
ingen policy, godkända studiehjälpare och admin läser), `niva_forsok` och
`niva_svar` (försöken och svaren: familjen, elevens studiehjälpare och
admin läser, bara `niva_starta()` och `niva_svara()` skriver) och
`homework.niva_id`. `niva_fragor` får aldrig en rad borttagen som har
svar: en ändrad fråga får ett nytt id och den gamla blir inaktiv, så att
gamla svar pekar på det som faktiskt frågades.
Fas 23.2 (NexLäx, avsnitt 1) la till `nivaer.sort` (`vanlig`, `mastare`,
`repetition`), `nivaer.lastext`, frågetypen `para` och `nexlax_lage()`:
XP:n, serien, dagarna och underlaget för Din utveckling för ett barn,
SECURITY DEFINER med vakten först (familjen, elevens studiehjälpare
eller admin, annars 42501). XP-reglerna står i `intern.nexlax_*` och
ingen annanstans. Ingen ny tabell: allt räknas ur svaren och försöken.
`dokument_delas_med_personen` (2026-09-29, avsnitt 1) la till
`handlingar.delad_med_personen`, `mina_handlingar()` (personens egna,
med en fast kolumnlista, SECURITY DEFINER) och policyn "personen läser
sitt dokument" på hinken `dokument`. Två villkor: en koppling till
`profiles` har ett id skrivet som `auth.uid()` skriver det
(`handlingar_person_id`), och bara en handling kopplad till en person
kan delas (`handlingar_delas_med_en_person`). `delad_med_personen` står
i auditloggens vitlista. Tabellen har fortfarande bara adminpolicyerna.
`admin_oppnar_chatten` (2026-09-29, avsnitt 1) la till `chatt_las()`:
tråden mellan en familj och en studiehjälpare för admin, SECURITY
DEFINER med `is_admin()` på första raden, VOLATILE för att den skriver
`chatt.oppnad` i `audit_logg`. Den rör aldrig `messages`.
`avbokningar_och_svar` (2026-09-30, avsnitt 1) la till
`bookings.avbokad_fran`, `motforslag_at` och `svar_meddelande`,
`intern.svar_gallra()` med pg_cron-jobbet `svar-gallring`, och gör
`bookings_stampla_avbokning` till en trigger på insert och varje update:
den känner igen motförslaget på tiden och `created_by`, och en
`UPDATE OF status` hade inte sett det. `skydda_bokningsfalt`,
`intern.las_stangd_manad` och `radera_person` lappas med `replace()` och
en vakt, och migrationen går att köra två gånger.
`tipskoder_och_kampanjkoder` (2026-09-30, `minne/affaren.md`) la till
`tipskoder` (personen läser sin rad, admin allt och skapar bara
kampanjkoder, anon ingenting), `leads.kod` med främmande nyckel och
triggern `leads_tipskod`, `mina_tips()` och `tipskoder_lage()`,
`intern.tipsade_familjer`, `intern.tipstimmar_intjanade` och
`intern.tipstimmar_anvanda`, flaggan `tipstimme`, rabattkoden `TIPS`
som aldrig kan slås på, och `profiles_tipskod_raderas`.
`forsta_timmen_bjuds` skrivs om i sin helhet med en vakt på Fas 19.5:s
md5, och migrationen går att köra två gånger.
Den första tabellen i `intern` kom 2026-09-27: `intern.natanrop_logg`,
id:t på databasens egna pg_net-anrop (skrivs bara av `intern.natanrop()`,
ingen roll utom ägaren når den). Se Notiserna nedan.

**Flera sessioner kör mot samma databas samtidigt.** Fas 19.5 och Fas
20.1 skrevs samma förmiddag i två sessioner och ändrade båda
`avvikelser_rader`, `klippkort_dra` och `passunderlag`. Den som skrev om
en funktion ur sin egen kopia hade tagit bort den andras ändring utan
att något blev rött. Båda lappade därför med `replace()` på
`pg_get_functiondef()` och en vakt som räknar att texten hittades exakt
så många gånger som väntat, och vyns kolumner lästes i driften före
`create or replace view` (en vy kan inte tappa kolumner, så felet kom
direkt, men först i driften). **Läs driften, inte grenen, innan du
ändrar en funktion eller vy någon annan också ändrar.**
Runda 2 la till notisernas sju: `notiser` (i vyn), `notis_utskick` (kön), `notis_val` (av och på per person, typ och
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

Två LÄSNINGAR står också där, för att den de gäller inte märker dem:
personnumret (`skatteuppgifter.lasta`, Fas 6.1) och en chatt som admin
öppnar (`chatt.oppnad`, 2026-09-29). Båda skrivs av funktionen som
läser, i samma transaktion.

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
**Sedan Fas 19.2 går den inte att slå på**: villkoren låter familjen
betala efter passet, och spärren nekar just den rapporten familjen ska
bekräfta. `flaggor_kortsparr_av` är ett check-villkor på `flaggor`, och
adminvyn har ingen Slå på-knapp. Ska villkoren tillbaka till betalning
före passet tas villkoret bort i samma migration som texterna ändras.
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
- **En länk är en webbadress** (2026-09-29,
  `biblioteksmaterial_lank_webbadress`): http eller https, utan
  mellanslag. Familjen öppnar den med `window.open`, och förut var det
  bara CSP:n som stoppade en `javascript:`-adress. Vyerna prövar samma
  regel innan de sparar.
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
- **Banken har 158 övningsblad och 14 länkar** (2026-10-02,
  `materialbanken_fler_blad`, `materialbanken_np_traning` och
  `materialbanken_np_omgang_2`; Fas 15.5 la ett blad per årskurs). Leo:
  "Material sidan har väldigt lite material". De är VÅRA blad, ritade
  till `bank/*.png` av `verktyg/bygg-banken.py` och inga andras sidor,
  och de ger inget facit varken på bladet eller i beskrivningen: vyn
  fyller läxans text med beskrivningen, och den läser eleven. Alla sju
  ämnena i `NX.AMNEN` har blad, också Moderna språk (tyska, spanska,
  franska) och Programmering. **Bladen är skrivna med AI och granskade
  av andra AI-granskare, inte lästa av en lärare**; sägs inte något
  annat utåt än att de är Nextrums egna. Ett blad som rättas ritas om
  och raden rörs inte (id:t är ett uuid5 ur filnamnet); ett nytt blad
  är en ny migration med bara de nya raderna. Länkarna svarar 404 tills
  `bank/` är driftsatt, så migrationen körs efter merge.
- **Nationella prov och läromedel kopieras aldrig in i banken** (Fas 15.7,
  2026-10-02). Leo bad om att ladda ner alla nationella prov från åk 6 till
  gymnasiet, och läromedel från förlag som Liber. Proven och deras texter är
  upphovsrättsskyddade, och en kopia på nextrum.se är spridning i en
  kommersiell tjänst; förlagens böcker är inte gratis att ladda ner. Det
  som är fritt är att länka: `verktyg/bladen/lankar.py` har fjorton länkar
  till provgruppernas egna sidor (PRIM-gruppen vid Stockholms universitet,
  Göteborgs, Uppsala och Umeå universitet), en rad i `biblioteksmaterial`
  med `lank` var, id:t ur namnet. Adresserna kommer ur webbsökningar och är
  inte klickprovade, eftersom molnmiljön nekade alla de domänerna.
- **NP-träningen är egna uppgifter i provens stil, aldrig provens egna.**
  25 blad (`*-np-*`): delar med och utan räknare och nivåmärkena E, C och A
  (`{E}` i texten), läs- och skrivdelar med påhittat underlag som säger att
  det är påhittat. Varje blad säger på första instruktionsraden att det
  inte är riktiga provuppgifter. Prov finns i åk 6 (Ma, Sv, En), åk 9 (Ma,
  Sv, En, NO, SO) och med Gy25 i matematik nivå 1–2, svenska nivå 1 och 3
  och engelska nivå 1–2. Gymnasiebladen anger Gy25-nivån bara där den är
  bekräftad (matematik 1–2, svenska 1 och 3, engelska 1–2); trigonometriska
  ekvationer och radianer är Matematik 4, inte 3.
- **NP-omgång 2 och genomgångarna** (Fas 15.8, 2026-10-02). Leo bad om
  "många fler blad av riktig np" och om "material som besvarar frågorna från
  riktiga svenska böcker". Det blev 53 blad till, i
  `verktyg/bladen/np_ak6.py`, `np_ak9.py` och `np_gymnasiet.py` (alla NP-blad
  bor där, de första 25 flyttades dit): fler NP-blad i matte, svenska och
  engelska, ett NP-blad och en genomgång per NO- och SO-ämne i åk 9 (eleven
  gör provet i ett av vardera), och provträning i Matematik 3c och 4 för
  dem som läser de äldre kurserna. Det som "besvarar frågorna" är
  **genomgångarna** (`*-genomgang-*`): egna faktablad med lösta exempel,
  aldrig text ur läroböcker. Äldre svensk litteratur, som är fri att
  använda, hade passat i läsdelarna, men molnmiljön nådde varken
  runeberg.org, litteraturbanken.se eller Wikisource, och klassiker citeras
  inte ur minnet. `[[]]` är en bred svarsruta för längre svar.
- **Granskningen av omgång 2** (samma dag) lärde två saker. En skrivrad
  rymmer tio–tolv handskrivna ord: en fråga med två led får två rader och en
  A-uppgift fyra, och `[]` rymmer två siffror, `[[]]` fler. Och i åk 6 prövar
  delprov C2 sakprosa, där texttypen växlar mellan åren (argumenterande,
  beskrivande, förklarande eller instruerande, enligt provgruppens
  resultatrapporter): skriv aldrig att det alltid är en faktatext.
- **Facit till alla blad** (Fas 15.9, 2026-10-02). Leo: "Checka att alla
  uppgifter i materialbanken är korrekta och att det finns svar till
  uppgifterna lätttillgängligt". Facit skrevs uppgift för uppgift, och det
  var granskningen: den som skriver svaret löser uppgiften, och en uppgift
  utan entydigt svar syns då. En andra omgång löste uppgifterna blint och
  jämförde. Facit står i `verktyg/bladen/facit_<modul>.py` och ritas till
  `bank/facit/<fil>.png`, en egen sida som aldrig lämnas till eleven.
  **Vem som ser det:** studiehjälparen (knappen Facit på bibliotekskortet
  och på uppgiftsraden) och admin (biblioteket), genom `NX.facitLänk`, som
  bara känner igen bankens egna adresser. Familjens vy visar det inte,
  eftersom barnet gör NexLäx och läxorna i samma inloggning, och barnets vy
  aldrig. **Det är inte hemligt:** repot är publikt och bilderna ligger
  under /bank/, så den som letar hittar dem, precis som facit i bokens
  baksida. Ett riktigt dolt facit hade krävt en privat hink och en policy.

Ur avsnitt 11:

- **`materials` har inga läsare kvar utom oss själva** (efter Fas
  13.3). Studiehjälparvyns materialflik är ombyggd till biblioteket,
  och adminvyns detaljpanel skriver fortfarande dit men säger nu i
  klartext att familjen inte ser det. Tabellen och hinken `material`
  lever kvar. `NXMedia.laddaMaterial`, `materialRad` och
  `sparaMaterialfil` gör det INTE längre — de hade noll anropare kvar
  efter ombyggnaden, och en delad hjälpare som ingen ringer är en
  hjälpare nästa person bygger vidare på. Leo 2026-09-27: panelen står
  kvar som internt underlag. Det är alltså färdigt, och `materials` ska
  inte städas bort.

**Uppgifter som maskiner skapar går genom `skapa_uppgift()`** (Fas 7),
som kräver en nyckel och vägrar skapa en till när det redan finns en
öppen med samma nyckel. Adminvyn skriver direkt i `uppgifter` under sin
egen policy. Kontrollerna (`kontroll_saknade_rapporter`,
`kontroll_ekonomiska_avvikelser`, `paminnelse_forfallna_fakturor`,
`uppfoljning_leads_och_ansokningar`) SKAPAR bara uppgifter — ingen av
dem skickar något, och ingen av dem är schemalagd. `kor_kontrollerna()`
kör alla fyra från fliken System → Automationer. **Att de inte är
schemalagda är med flit och Leos beslut att ändra**, inte något som
väntar på pg_cron: pg_cron finns. Schemaläggs de ska texterna i
`nextrum-admin-automationer.js` och `admin.html` säga det i samma
ändring.

**Schemat syns under System → Automationer** (2026-09-29). Rutan
Schemalagda körningar läser `driftkorningar()` (migrationen
`schemalagda_korningar_syns`, körd i driften efter att PR #129 mergats,
som version `20260929084809`; det driften sparade har samma md5 som
filen). Fas 7 lät rutan tolka en saknad funktion (PGRST202) som att
pg_cron saknades, för funktionen skulle komma med pg_cron. pg_cron kom
med notiserna utan den, och rutan sa "Inget schema installerat" medan
tretton jobb gick varje minut och varje natt. Ett saknat svar betyder
nu bara att migrationen inte är körd, och rutan säger det. Fyra regler:

1. **En rad per jobb, inte en per körning.** `cron.job_run_details` hade
   11 800 körningar på en vecka, 10 355 av dem `notis-minut`. En lista
   över körningarna hade PostgREST kapat vid tusen rader, och nattens jobb
   hade aldrig syns. Svaret är varje jobb i `cron.job`, också ett som inte
   kört i fönstret: schemat, om det är på, den senaste körningen, antalet
   och de misslyckade, och det senaste felet.
2. **Bara admin.** SECURITY DEFINER med `is_admin()` på första raden och
   ingen EXECUTE för anon. Ett jobb som står av (`active = false`) står
   som Står av, i lera: ett schema som står av och ett som går ska inte
   se likadana ut (flaggan `notiser_mejl`, Notiserna nedan).
3. **Kommandot lämnas aldrig ut, och svaret bara vid fel.** Av ett fel
   bara första raden, för DETAIL bär radens värden ("Failing row contains
   …"), med `notis_konfig`s två hemligheter, långa nycklar och id:n,
   e-post och nummer utbytta (`intern.driftsvar()`), högst 200 tecken. I
   dag bär inget kommando något hemligt: hemligheten går i headers genom
   `intern.natanrop`. Funktionen litar inte på att det förblir så.
4. **Sju dagar.** `cron-stada` tar bort körningar äldre än så, och rutan
   frågar efter sju. Ett längre fönster ger samma svar.

Ett nytt jobb syns i rutan av sig självt, med sitt namn; en rad i `JOBB`
i `nextrum-admin-automationer.js` ger det en beskrivning.

Provat mot driften 2026-09-29 med hela `rls-test.sql` i en transaktion
som rullades tillbaka, på det sätt avsnitt 9 beskriver: 762 av 764 med
migrationen, där de två är Fas 23.1:s prov, som väntar på sin egen, och
754 av 762 utan den, där alla sex raderna för schemat föll. Med main
inslagen (de delade dokumenten): 779 av 781, samma två, och lika efter
att migrationen körts i driften. Provet lägger
in en misslyckad körning i `cron.job_run_details` med runid −9101, och
den försvinner med återrullningen.

Jobben 2026-09-29, alla som `postgres`, tider i UTC:

| Jobb | När | Gör |
|---|---|---|
| `notis-minut` | varje minut | köar påminnelserna och väcker `notis-ko` (Notiserna nedan) |
| `ansokan-besked` | var femte minut | nya försök med beskeden till den som söker jobb |
| `admin-paminnelse` | var femte minut | räknar Att göra och skriver kl. 9 svensk tid ETT mejl till admin med det som ligger kvar och inte mejlats; klockan avgörs i funktionen, inte i schemat (2026-10-02, Notiserna) |
| `timmar-betalar` | var femte minut | obesvarade förslag lämnar tillbaka timmen, lediga timmar betalar nästa pass (Fas 22.3–22.4) |
| `timmar-gar-ut` | :07 varje timme | mejlet tio dagar innan köpta timmar går ut (Fas 21.2) |
| `utbildningsprov-paminn` | :13 varje timme | påminnelserna om utbildningsprovet |
| `notis-stada` | 03:17 | städar notiserna och utskicken |
| `cron-stada` | 03:23 | tar bort körningar äldre än sju dagar ur `cron.job_run_details` |
| `ansokan-gallring` | 03:41 | ansökningar och CV:n efter ett år (Gallringen nedan) |
| `kontakt-och-fel-gallring` | 03:44 | kontaktmeddelanden och klientfel |
| `leads-avidentifiering` | 03:47 | intresseanmälningar sex månader efter senaste kontakten |
| `ai-och-uppgifter-gallring` | 03:51 | AI-texterna och avslutade uppgifter |
| `svar-gallring` | 03:53 | studiehjälparens svar på ett förslag, 30 dagar efter avslaget eller passet (2026-09-30) |
| `manadskorning` | 04:17 (varje natt sedan 2026-10-01) | förra månadens underlag och fakturautkast den 1:a, sedan sena pass på utkasten (avsnitt 1) |
| `manadskorning-svar` | 04:47 (varje natt sedan 2026-10-01) | månadskörningens svar: allt utom 200 blir en uppgift (ovan) |
| `konton-oanvanda` | den 1:a 04:53 | konton som inte använts på två år blir uppgifter |

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

### Gallringen (2026-09-27)

Integritetspolicyn lovar lagringstider, och det är databasen som
håller dem, inte en människa som kommer ihåg. `DATASKYDD.md` har hela
registret; det här är det som rör koden.

- **Intresseanmälningar avidentifieras, de tas inte bort.**
  `intern.leads_avidentifiera()` (pg_cron `leads-avidentifiering`,
  varje natt) tömmer namn, e-post, barnets namn, fritexten och
  noteringen sex månader efter senaste kontakten
  (`intern.leads_avidentifieras_fran()`, enda stället regeln står).
  `email = 'gallrad'` är markeringen. Raden står kvar så att
  analysvyerna räknar lika många anmälningar bakåt i tiden.
- **Konton raderas aldrig automatiskt.** `intern.konton_oanvanda()`
  (`konton-oanvanda`, den 1:a varje månad) gör ett konto som inte
  använts på två år till en uppgift. Ett konto hänger ihop med
  bokföringsunderlag som ska sparas i sju år, och det avgör en
  människa.
- **Ett jobb som fastnat blir en uppgift** (`gallring:leads:fastnat`).
  Ett jobb som tyst slutat fungera ser annars ut som ett som inte har
  något att göra.
- **Kontaktmeddelanden tas bort efter sex månader, klientfel efter
  nittio dagar** (`intern.kontakt_och_fel_gallra()`, pg_cron
  `kontakt-och-fel-gallring`). Notiserna har egna tider i
  `notis_stada()`: 180 dagar i vyn, 90 för utskicken.
- **AI-texterna och de avslutade uppgifterna** (2026-09-28,
  `intern.ai_och_uppgifter_gallra()`, pg_cron
  `ai-och-uppgifter-gallring`): agentloggens text efter 90 dagar
  (`gallra_agentloggen(90)`, som bara kördes från en knapp förut),
  `ai_forslag.motivering` 90 dagar efter beslutet, och klara eller
  avbrutna uppgifter ett år efter att de stängdes. `frys_forslaget`
  släpper igenom exakt den tömningen: till null, på ett avgjort förslag,
  utan inloggad användare. Allt annat i ett förslag är fortfarande fryst.
- **Studiehjälparens svar på ett förslag** (2026-09-30,
  `intern.svar_gallra()`, pg_cron `svar-gallring`) töms 30 dagar efter
  avslaget, eller 30 dagar efter passets dag för ett motförslag som blev
  ett pass. Passet står kvar: det är bokföring.
- **`landningssida` bär bara våra egna utm-taggar.** `NX.källa()` sparade
  förut hela adressen, med annonsnätverkens klick-id (`gclid`,
  `fbclid`), som går att koppla till en person hos Google och Meta.
  Avidentifieringen kapar dessutom fältet vid "?".
- Ansökningar och CV:n gallras av `ansokan-gallring`, med samma
  princip: filen först, raden sedan. Se "Gallringen: ansökningar och
  CV:n efter ett år" nedan.

### Gallringen: ansökningar och CV:n efter ett år (2026-09-27)

Integritetspolicyn lovar att en ansökan som inte leder till anställning
sparas högst ett år. Förut höll ingenting det: ingen policy, inget jobb
och ingen knapp tog bort vare sig raden eller CV:t.

```
pg_cron "ansokan-gallring", 03:41 UTC
  → intern.ansokan_gallring_vack()   något förfallet? annars inget anrop
  → pg_net → ansokan-gallring        hemligheten i x-nextrum-notis
      → ansokan_gallring_lista()     ansökan och dess filer
      → Storage tar bort filerna     svaret läses
      → ansokan_gallra(id)           raden, bara om filerna är borta
      → cv_foraldralosa() → Storage  filer som ingen ansökan pekar ut
```

Regeln står i `intern.ansokan_gallras_fran()` och ingen annanstans:

1. **En studiehjälpares ansökan står kvar medan hen arbetar, och två
   år till** (2026-09-28). Har ansökan samma adress
   (`intern.epost_nyckel`) som en godkänd studiehjälpare, och är den
   inte avböjd, räknas tiden från studiehjälparens senaste aktivitet:
   kontot, senaste inloggning, senaste pass som inte avbokats, senaste
   rapport. Det finns ingen status för "har slutat", så aktiviteten ÄR
   signalen. Adressen och inte bara läget, för "Ta in i poolen"
   godkänner profilen först och läser inte svaret när ansökan sätts
   till godkänd. En godkänd ansökan utan konto med den adressen gallras
   två år efter sitt senaste steg. En avböjd ansökan gallras alltid,
   också när samma person senare fått ja.
2. **Ett år från `created_at`, men inte mitt i en rekrytering.** En
   ansökan väntar till trettio dagar efter sitt senaste steg: kontakten,
   mötet, utbildningsmötet, provets sista dag, det godkända provet,
   utbildningen. Policyn säger "så att vi kan höra av oss om något dyker
   upp", och den som hörs av i månad elva ska inte förlora ansökan mitt i
   provet. **Får rekryteringen ett nytt steg med en egen tidsstämpel ska
   det in i funktionen**, annars kan en ansökan försvinna mitt i steget.
3. **Filen först, raden sedan, och databasen vaktar ordningen.**
   `storage.objects` går inte att ta bort ur med SQL
   (`protect_objects_delete`), så filen tas bort genom Storage-API:t i
   edge-funktionen. `ansokan_gallra()` vägrar ta bort raden så länge en
   fil den pekar ut finns kvar. En fil som en ansökan som ska vara kvar
   också pekar ut står kvar.
4. **Filer utan ansökan gallras ett år efter uppladdningen.** Kopplingen
   är raden `CV: cv/<sökväg>` i `why` (avsnitt 6, hinkarna), läst av
   `intern.ansokan_cv_namn()`, med flit vidare än `CV_RAD`. Året är också
   ett skydd: ändras CV-raden utan att tolkningen följer med ser varje CV
   föräldralöst ut, och då tas ändå inget bort som inte redan var ett år
   gammalt.
5. **Det som följer med:** `ansokan_utskick` och `utbildningsprov_forsok`
   (cascade) och uppgifter kopplade till ansökan, som kan bära namnet.
   Auditloggens rader om ansökan står kvar, för de bär bara läge och
   tidsstämplar. Borttagningen får en egen, `ansokan.borttagen` av
   `system`, med tidsstämplarna som visar att den var förfallen. Egen
   trigger (`applications_audit_borttagen`): `applications_audit` skrivs
   om av rekryteringens migrationer, och en borttagningsgren där hade
   försvunnit nästa gång.
6. **Vakten räknar utfallet, inte vägen.** Är något en vecka över tiden
   skapar väckningen uppgiften "Gallringen av ansökningar har fastnat".
   En funktion som svarar 401, en fil Storage vägrar ta bort och en rad
   som väntar på sin fil syns alla där. Funktionens svar står i
   `net._http_response`: 200 bara när inget gick fel, och aldrig ett
   filnamn, för det är vad den sökande själv döpt filen till.

Bara `service_role` når `ansokan_gallring_lista`, `cv_foraldralosa` och
`ansokan_gallra`, inte admin. Adressen står i `notis_konfig.gallring_url`,
härledd ur `arbetare_url` som `ansokan_url`. Provad mot driften
2026-09-27 med tre provansökningar och fyra provfiler. **pg_net skickar
bara `application/json`**, och hinken `cv` tar bara PDF och Word: filerna
laddades upp som anon med tillägget `http`, installerat i en transaktion
som rullades tillbaka. Storage sparar filen i sin egen anslutning, så den
blir kvar medan tillägget inte gör det.

### Rätta och radera en person (2026-09-28)

Leo: "alla personer som finns i våra system i admin, ska vi kunna
redigera och trycka ta bort på", och "radera personen från våra system
med en knapp där ifall personen inte ska anställas eller om personen
inte vill senare ha vår tjänst".

**Listorna är namn.** Intresseanmälningar, Ansökningar (med flikarna
Intervju och Utbildning), Familjer, Elever och Studiehjälpare ritas av
`namnlista()` i `nextrum-admin-karna.js`: namnet och läget, inget annat.
Allt annat står i personpanelen (`nextrum-admin-detalj.js`), som sedan
dess också öppnar anmälan och ansökan. Rekryteringens steg är fliken
Rekryteringen där; rutan de stod i förut är borta. Söket i sidhuvudet
öppnar träffen i panelen. Panelen ritas om när en lista gör det, utom
när något i den är påbörjat (`ritaPanelen()`): listorna ritas om när en
anmälan kommer in via realtid, och det hade suddat ut en halvskriven
anteckning.

**Redigera** sist i Översikt rättar de kolumner vyerna och formulären
själva skriver (`RED` i detalj.js), och bara det som ändrats skrivs.
E-posten på ett konto är inloggningen och ändras inte där: profiles
följer inte med när adressen byts i Auth. CV-raden i en ansökans `why`
står utanför formuläret och läggs tillbaka när texten sparas, för den är
enda kopplingen till filen (`CV_RAD`).

**Radera** (`nextrum-admin-radera.js`) frågar först `radering_lage()` och
visar svaret; `radera_person()` gör det. Båda är SECURITY DEFINER med
`is_admin()` på första raden, och samma `intern.radering_underlag()`
avgör vad rutan lovar och vad som händer. Sju regler:

1. **Databasen väljer sättet.** *Helt* när ingenting om personen är
   bokföring: inloggningen (`auth.users`) tas bort och resten följer med
   genom nycklarna. *Avidentifieras* annars: kontot heter "Raderad
   familj" eller "Raderad studiehjälpare", barnen "Raderad elev",
   adress, telefon, profilbild, chatten, läxorna, planerna, försöken på
   de digitala uppgifterna, rapporternas text och studiehjälparens svar
   på förslagen (2026-09-30) är borta, och
   inloggningen stängs som GoTrues egen mjuka radering gör. Försöken
   (`niva_forsok`, Fas 23.1) tas bort bara när tabellen finns, så att
   de två migrationerna kan köras i vilken ordning som helst. Vad som är bokföring står i
   `intern.passet_bar_bokforing()` och ingen annanstans.
2. **Pengar som inte är uppgjorda hindrar.** Betalt men inte hållet,
   timmar eller minuter kvar, en öppen kassa eller tvist, betalt för
   länge, ett pass som börjat utan rapport, och för en studiehjälpare
   matchade elever och kommande kortbetalda pass. Pengar personen är
   skyldig oss hindrar inte: de står som larm i rutan, och admin
   bestämmer.
3. **Samma adress följer med** (`intern.epost_nyckel`): anmälningar
   avidentifieras som i nattjobbet, ansökningar och frågor tas bort. Det
   är personen som raderas, inte en rad.
4. **Kommande obetalda pass avbokas**, med skälet `familjen_avslutar`
   eller `ingen_hjalpare`, och motparten får mejlet. Den som raderas får
   inget: `raderad_at` sätts först, och `notis_vill()` svarar nej för ett
   raderat konto.
5. **Filen först, och databasen vaktar ordningen.** `radering_lage()`
   svarar med profilbilden, barnens mapp och CV:t, adminvyn tar bort dem
   genom Storage och läser svaret, och `radera_person()` vägrar medan en
   fil finns kvar. Admin fick därför ta bort i hinkarna `cv` och
   `avatarer`.
6. **Ett adminkonto raderas inte här**, inte heller ens eget.
7. **Auditloggen får en rad utan namn**: `konto.raderat` eller
   `konto.avidentifierat`, `elev.raderad` eller `elev.avidentifierad`,
   `anmalan.avidentifierad`, `kontaktmeddelande.borttagen` och, genom
   sin egen trigger, `ansokan.borttagen`.

`profiles.raderad_at` och `students.raderad_at` är markeringen, och bara
databasen och admin sätter dem (`skydda_profilfalt`,
`skydda_studentfalt`). Ett avidentifierat konto eller barn står inte i
någon lista (`ärRaderad()` i kärnan), och en familj ser inte ett raderat
barn (policyn `förälder ser egna barn`). Ett gammalt pass pekar
fortfarande på dem, och panelen säger då varför namnet är borta.
`intern.konton_oanvanda()` hoppar över raderade konton.

**Avtalen under System → Dokument står kvar**, för familjen och för
studiehjälparen, i båda sätten: ett anställningsavtal eller ett
kundavtal är något vi kan behöva visa, och det är admin som tar bort
det, inte raderingen. Rutan säger hur många (`star_kvar.handlingar`).
Familjens rad kom med `dokument_delas_med_personen`, när en familj
kunde få ett avtal; lappen i `intern.radering_underlag` görs med
`replace()` och en vakt. Personens tillgång följer med kontot: en
raderad inloggning läser ingenting.

**Radera aldrig en person i dashboarden.** `bookings.parent_id` är ON
DELETE CASCADE: ett konto som tas bort där tar med sig sina betalda pass,
och bokföringen med dem. Ett konto med klippkort går inte att ta bort
alls där (`klippkort_parent_id_fkey` är RESTRICT).

Migrationen `personer_redigeras_och_raderas` kördes i driften efter
merge, som version `20260928231551`, och det driften sparade har samma
md5 som filen. Hela `rls-test.sql` gick igenom efteråt: 754 av 756, där
de två är Fas 23.1:s prov, som väntar på sin egen migration.
`rls-test.sql` har avsnittet RADERA EN PERSON; kör hela filen efter
varje ändring. Adminvyn tål att funktionerna saknas (en databas byggd
utan migrationen): Radera säger då att raderingen inte finns, och
ingenting raderas.

### Barnkontona och adminrollerna (2026-09-30)
Migrationen `barnkonton_och_admin` lade till `admin_roller`, `admin_logg`
(går inte att ändra eller tömma), `barn_notiser`, `barn_andringsfonster`
och sex kolumner på `students`, rollen `nextrum_barn`, triggrar på
`auth.users` och jobbet `barnkonton-gallring` (03.59 UTC). `is_admin()`
byttes med en md5-vakt och läser nu `admin_roller`; sex funktioner
lappades med `replace()` och en vakt som räknar träffarna. Triggern
`profiles_spegel_admin` sorterar efter `profiles_skydda`, och
`bookings_barnnotis` är en AFTER-trigger och påverkar inte ordningen
bland before-triggrarna på `bookings`. `rls-test.sql` har avsnittet
BARNKONTON OCH ADMIN MED BEHÖRIGHETER. Se `minne/barnkonton-och-admin.md`.

### Att köra en migration i driften från en session (2026-10-02)
`admin_paminnelser` tog fem försök att få in, och allt som gick fel var verktyget, inte SQL:en.
Supabase-verktygen (`execute_sql`, `apply_migration`) ber användaren bekräfta vissa satser. Svarar ingen
inom 60 sekunder får sessionen bara ett timeout och **inget har körts**: kolla alltid driften innan du
försöker igen (finns objekten, kör något, väntar något på ett lås). Det som utlöste det, och det som inte gjorde det:

| Utlöser bekräftelsen | Gick direkt |
|---|---|
| `drop` (också `drop policy if exists`), `delete` utanför en funktion, en funktion med två `delete` | `create`, `alter`, `comment`, `grant`, `revoke`, `update … where`, en funktion med ett `delete` eller en datamodifierande CTE, `do`-block, `select cron.unschedule(…)`, `select cron.schedule(…)` |

Orden i en sträng räknas inte. Runda aldrig spärren med dynamisk SQL (`execute 'drop …'`): den finns för att
användaren ska godkänna det som river något. En städning av egna provobjekt kräver alltså ett svar från
användaren, så ge inte dina provobjekt namn du måste riva, och gör prov som `create or replace` på en
funktion du ändå ska ha.

Det som fungerade, i ordning:
1. Skriv filen utan `drop` och med högst ett `delete` per funktion. En policy skapas i ett `do`-block efter en
   kontroll i `pg_policies`, så att filen ändå går att köra två gånger.
2. Kör filen avsnitt för avsnitt med `execute_sql` (varje anrop är en transaktion), och funktioner i egna anrop.
3. Registrera hela filens text som EN rad:
   `insert into supabase_migrations.schema_migrations (version, name, statements) values ('<version>', '<namn>', array[$mig$<texten>$mig$])`.
   Raderna för tidigare migrationer ser ut så. Kontrollera sedan `md5(statements[1])` mot `md5sum` på filen:
   samma summa betyder att det som driftsatts är det som ligger i git.
4. Bevisa funktionerna: `md5(prosrc)` i `pg_proc` mot samma text mellan `as $$` och `$$;` i filen. Ett byte
   fel syns direkt, och det är det enda som visar att en edge-funktion eller en kropp inte skrivits av fel.
5. Röktesta en edge-funktion utan att skicka något: `select intern.natanrop('<mål>', url := k.<kolumn>,
   headers := jsonb_build_object('Content-Type', 'application/json', 'x-nextrum-notis', k.hemlighet), body :=
   jsonb_build_object('id', gen_random_uuid())) from notis_konfig k`, och läs `net._http_response` för id:t.
   Hemligheten lämnar aldrig databasen.
6. Kör Supabases säkerhetskontroll (`get_advisors`) efteråt. Den fångade en `SECURITY DEFINER`-funktion i `public`
   som anon kunde anropa: ett provobjekt får `revoke execute … from public, anon, authenticated` direkt.

`apply_migration` registrerar en egen version (klockslaget), och tidigare migrationer har runda versioner.
Filens version ska vara den som står i `schema_migrations`, så välj den i förväg och registrera själv.

### Barnets egen e-post (barnets_epost, 2026-10-01)
Tabellen `barn_epost` (en rad per barn, inga rättigheter för någon
inloggad), `intern.barn_inloggning_forsok` (HMAC:ar, ett dygn), sekvensen
`intern.barn_epost_omgang`, kolumnen `notis_konfig.barn_nyckel`, flaggan
`barn_epost` (av), och `notis_utskick.barn_id` med villkoret att en rad
har antingen `mottagare` eller `barn_id`; `mottagare` är inte längre NOT
NULL. Fem funktioner lappades med `replace()` och en vakt som räknar
träffarna: `notis_utskick_ta` (två lappar), `intern.barnnotis_vid_pass`,
`notis_planera`, `intern.barnkonto_stadas` och `intern.barnkonton_gallra`.
`rls-test.sql` avsnitt 15. Körd i driften 2026-10-01 efter
`nexlax_for_barnet`, båda med filens egen version och samma md5 som
filen, och hela `rls-test.sql` (1220 rader) gick igenom mot driften före
och efter, i en transaktion som rullades tillbaka. Se
`minne/barnkonton-och-admin.md`.
